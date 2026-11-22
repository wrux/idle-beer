import './styles/main.css';
import './styles/theme.css';
import './styles/phone.css';
import { newDrinkState, stepDrink } from './core/drinking';
import {
  availableUpgrades, upgradeCost, buyDrinker, buyNextRound, buyPub, buyUpgrade, currentBeer, drinkerPpsEach, drinkTime, earn,
  hasDownInOne, invalidate, offlineGain, pintsPerDrink, priceOf, pubBonus, pubsForSale, refillTime, storeVisibility, totalPps,
} from './core/economy';
import {
  BUFFS, buffDuration, freeRoundLifetime, nextFreeRoundIn, rollFreeRound, startBuff, tickBuffs,
} from './core/events';
import { mods } from './core/licenceState';
import { canBang, collectLiveMats, finishGame, startFinale, stopwatch } from './core/bang';
import { playTime } from './ui/panels';
import { challengeShare, checkChallenge } from './core/nights';
import { BangPanel, voidBeersText } from './ui/bigBang';
import { CHALLENGE_BY_ID, SPECIAL_BY_ID } from './data/nights';
import { autoBuyLegend, matMult, matsOnReset } from './core/prestige';
import { format, formatBrief } from './core/format';
import { LOCALES, currentLocale, localeUrl, preferredLocale, tr, trn } from './i18n';
import { localiseData, pintsLabel } from './i18n/data';
import { startLoop } from './core/loop';
import { big, D, Decimal } from './core/num';
import { deserialize, loadGame, saveGame, serialize, wipeSave } from './core/save';
import { newGame, owned } from './core/state';
import { drinkCycle, newStreak, registerFinish, streakMult, streakRemaining } from './core/streak';
import {
  checkAchievements, grantAchievement, type Achievement, type GrantedAchievement,
} from './data/achievements';
import { BEERS } from './data/beers';
import { DRINKERS } from './data/drinkers';
import { LOCATIONS, LOCATION_BY_ID } from './data/locations';
import { StageRenderer } from './ui/art/stage';
import { FreeRoundView } from './ui/freeRound';
import { bonusText, LastOrdersPanel } from './ui/lastOrders';
import { AchievementsPanel, SettingsPanel, StatsPanel } from './ui/panels';
import { computePose, popupAnchor, type Renderer } from './ui/scene';
import { icon } from './ui/glyphs';
import { Sound } from './ui/sound';
import { StoreView } from './ui/store';
import { SCENARIOS } from './dev/scenarios';
import { browserSaysNo, observe, setStatsWanted, startTelemetry, statsWanted, track } from './telemetry';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Names, descriptions and jokes go into the page's language before anything is built from them.
localiseData();

let state = loadGame();
// Dev: ?debug&scenario=veteran looks at a ready-made game without touching the real save.
const previewScenario = new URLSearchParams(location.search).has('debug')
  ? SCENARIOS.find((sc) => sc.id === new URLSearchParams(location.search).get('scenario'))
  : undefined;
if (previewScenario) state = previewScenario.build();
const drink = newDrinkState(state.glassFill);
let resetting = !!previewScenario;
if (!previewScenario) startTelemetry(() => state, state.lifetimePints.gt(0) || state.prestiges > 0);
const SKIP_TITLE = 'idleBeer.skipTitle';

/** Gaps longer than this (laptop asleep, etc.) count as being away, not as live play. */
const AWAY_THRESHOLD_SECONDS = 60;
/** Drinking animation step, so a big gap can't skip through a whole pint in one frame. */
const DRINK_STEP = 0.05;

/** Game clock in seconds since the page loaded (streaks and Free Rounds run on this). */
let clock = 0;
const streak = newStreak();
const sound = new Sound();
sound.enabled = state.settings.sound;

// ---------- toasts ----------

const toastsEl = $('toasts');
/** False while the title screen is up: nothing is said, and nothing can be pressed, until you go in. */
let started = false;
const heldToasts: (() => void)[] = [];

function toast(emoji: string, html: string, ms = 6000) {
  if (!started) {
    // Anything worth saying on load ("while you were away…") waits until you're through the door.
    heldToasts.push(() => toast(emoji, html, ms));
    return;
  }
  // Keep the stack short: a burst of achievements shouldn't bury the pub.
  while (toastsEl.childElementCount >= 4) toastsEl.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  const body = document.createElement('div');
  body.className = 'toast-body';
  body.innerHTML = html;
  el.append(icon(emoji), body);
  const close = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener('click', close);
  setTimeout(close, ms);
  toastsEl.appendChild(el);
}

function duration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return trn(Math.round(seconds), '{n} second', '{n} seconds');
  if (m < 60) return trn(m, '{n} minute', '{n} minutes');
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = trn(h, '{n} hour', '{n} hours');
  return rest ? tr('{hours} {minutes} min', { hours, minutes: rest }) : hours;
}

// ---------- achievements ----------

/** Toast new achievements (a few at most, so a big jump doesn't flood the screen). */
function announce(list: (Achievement | null)[]) {
  const fresh = list.filter((a): a is Achievement => a !== null);
  if (!fresh.length) return;
  invalidate(); // Reputation depends on the achievement count
  sound.play('beer');
  for (const a of fresh.slice(0, 3)) toast('🏆', `<strong>${a.name}</strong>${a.desc}`, 5000);
  if (fresh.length > 3) toast('🏆', `<strong>${tr('…and {n} more achievements', { n: fresh.length - 3 })}</strong>`, 5000);
}
const grant = (id: GrantedAchievement) => announce([grantAchievement(state, id)]);

/** Credit time spent away (closed, asleep) at the offline rate, and say so. */
function creditAway(seconds: number) {
  if (seconds < AWAY_THRESHOLD_SECONDS) return;
  track('offline_return', '', Math.round(seconds));
  if (seconds >= 8 * 60 * 60) grant('hair-of-the-dog');
  if (tickBuffs(state, seconds)) invalidate();
  const gain = offlineGain(state, seconds);
  if (gain.pints.lte(0)) return;
  earn(state, gain.pints);
  const shown = gain.pints.floor();
  const amount = `<b>${format(shown)}</b> ${pintsLabel(shown)}`;
  toast(
    '🌙',
    gain.seconds < seconds
      ? tr('While you were away for {time}, your drinkers sank {amount} (they stop after {limit} without you).', {
        time: duration(seconds), amount, limit: duration(gain.seconds),
      })
      : tr('While you were away for {time}, your drinkers sank {amount}.', { time: duration(seconds), amount }),
  );
}

creditAway((Date.now() - state.lastSaved) / 1000);

// ---------- scene ----------

const renderer: Renderer = new StageRenderer(currentBeer(state).look);
renderer.setBeer(currentBeer(state).look, state.beer);
const pose = () => {
  const look = currentBeer(state).look;
  return computePose(drink, look.glass, look.foamScale, renderer.layout);
};
$('scene').appendChild(renderer.root);

// The pub you're in. You open pubs and move between them in the shop.
const locationEl = $('location-name');
let shownPub = '';
function showLocation(announce = false) {
  if (state.pub === shownPub) return;
  const first = shownPub === '';
  shownPub = state.pub;
  const loc = LOCATION_BY_ID.get(state.pub) ?? LOCATIONS[0];
  renderer.setLocation(loc);
  locationEl.textContent = loc.name;
  if (first || !announce) return;
  renderer.cheer(2);
  sound.play('beer');
  const bonus = Math.round((pubBonus(loc.id) - 1) * 100);
  toast('🍻', `<strong>${tr('Welcome to {pub}', { pub: loc.name })}</strong>${loc.perk}${bonus ? ` ${tr('Everything drinks {percent}% more here.', { percent: bonus })}` : ''}`);
}
showLocation();

/** Who's in the pub, plus a headcount so the crowd's real size is always clear. */
const crowdCountEl = $('crowd-count');
const crowdCountText = $('crowd-count-text');
/** Debug: pretend to own this many of everything, to look at a full pub. */
let crowdOverride: ((id: string) => number) | null = null;
function updateCrowd() {
  renderer.setCrowd(crowdOverride ?? ((id) => owned(state, id)));
  const total = DRINKERS.reduce((sum, d) => sum + owned(state, d.id), 0);
  crowdCountEl.hidden = total === 0;
  if (total > 0) setText(crowdCountText, tr('{n} in the pub', { n: format(D(total)) }));
}

// The scene carries on underneath the shop. Tell it how much is covered, so it keeps you and
// your pint in the middle of what can actually be seen.
{
  const sceneEl = $('scene'), stageEl = $('stage');
  const cover = () => renderer.setCover?.(Math.max(0, sceneEl.clientWidth - stageEl.clientWidth));
  new ResizeObserver(cover).observe(sceneEl);
  new ResizeObserver(cover).observe(stageEl);
  cover();
}

// ---------- settings ----------

const soundButton = $<HTMLButtonElement>('sound-toggle');
function showSoundSetting() {
  soundButton.classList.toggle('muted', !state.settings.sound);
  soundButton.setAttribute('aria-pressed', String(state.settings.sound));
  soundButton.title = state.settings.sound ? tr('Sound on') : tr('Sound off');
}
function setSound(on: boolean) {
  state.settings.sound = on;
  sound.enabled = on;
  sound.unlock();
  showSoundSetting();
  settings.sync();
  if (!on) grant('silent-pint');
}
showSoundSetting();
soundButton.addEventListener('click', () => setSound(!state.settings.sound));

function hardReset() {
  track('reset', '', 0, true);
  resetting = true;
  wipeSave();
  state = newGame();
  location.reload();
}

const settings = new SettingsPanel(() => state, {
  onSoundChange: setSound,
  stats: { wanted: statsWanted, blocked: browserSaysNo, set: setStatsWanted },
  exportSave: () => {
    saveGame(state);
    return serialize(state);
  },
  importSave: (text) => {
    try {
      const imported = deserialize(text);
      resetting = true;
      saveGame(imported);
      location.reload();
      return null;
    } catch {
      return tr("That doesn't look like an idle.beer save. Check you copied all of it.");
    }
  },
  hardReset,
});
const achievementsPanel = new AchievementsPanel(() => state);
const statsPanel = new StatsPanel(() => state);

// ---------- full screen ----------

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
const fsDoc = document as FsDoc;
const fsRoot = document.documentElement as FsEl;
const fullscreenButton = $<HTMLButtonElement>('fullscreen-toggle');
const canFullscreen = !!(document.fullscreenEnabled || fsDoc.webkitFullscreenEnabled) && !!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen);
const isFullscreen = () => !!(document.fullscreenElement || fsDoc.webkitFullscreenElement);

function toggleFullscreen() {
  if (!canFullscreen) return;
  try {
    if (isFullscreen()) void (document.exitFullscreen ? document.exitFullscreen() : fsDoc.webkitExitFullscreen?.());
    else void (fsRoot.requestFullscreen ? fsRoot.requestFullscreen({ navigationUI: 'hide' }) : fsRoot.webkitRequestFullscreen?.());
  } catch {
    /* refused (not a user gesture, or blocked by the page embedding us): nothing to do */
  }
}
function showFullscreen() {
  const on = isFullscreen();
  fullscreenButton.classList.toggle('muted', on); // shows the "leave" icon
  fullscreenButton.setAttribute('aria-pressed', String(on));
  fullscreenButton.title = on ? tr('Leave full screen (F)') : tr('Full screen (F)');
}
// Only offer it where it works (it doesn't on an iPhone: there, add the game to the home screen).
fullscreenButton.hidden = !canFullscreen;
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', showFullscreen);
document.addEventListener('webkitfullscreenchange', showFullscreen);

// Audio can only start after a user gesture.
window.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
window.addEventListener('keydown', () => sound.unlock(), { capture: true });

// ---------- input: click/touch and hold, or hold Space ----------

const stage = $('stage');
let pointerHeld = false;
let keyHeld = false;
/** A press since the last tick, so a quick tap still counts (matters for Down in One). */
let pressQueued = false;

stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // Buttons laid over the scene are buttons, not a drink.
  if ((e.target as Element).closest('button, a, .toast, .counter')) return;
  pointerHeld = true;
  pressQueued = true;
  stage.setPointerCapture(e.pointerId);
  e.preventDefault();
});
const releasePointer = () => (pointerHeld = false);
stage.addEventListener('pointerup', releasePointer);
stage.addEventListener('pointercancel', releasePointer);
stage.addEventListener('lostpointercapture', releasePointer);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

const isSpace = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ';
window.addEventListener('keydown', (e) => {
  if (!isSpace(e) || !started) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'SELECT' || tag === 'BUTTON' || tag === 'INPUT') return;
  e.preventDefault();
  keyHeld = true;
  pressQueued = true;
});
window.addEventListener('keyup', (e) => {
  if (isSpace(e)) keyHeld = false;
});

// Shortcuts: F for full screen, M for sound, 1 / 2 / 3 for the shop's tabs.
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !started) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' || document.querySelector('dialog[open]')) return;
  const key = e.key.toLowerCase();
  if (key === 'f') toggleFullscreen();
  else if (key === 'm') setSound(!state.settings.sound);
  else if (key === '1' || key === '2' || key === '3') store.showTab((['drinkers', 'upgrades', 'pubs'] as const)[Number(key) - 1]);
});
window.addEventListener('blur', () => {
  pointerHeld = false;
  keyHeld = false;
});

// ---------- popups ----------

const popupsEl = $('popups');
function popup(text: string, x: number, y: number, kind = '') {
  if (popupsEl.childElementCount > 24) popupsEl.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `popup ${kind}`;
  el.textContent = text;
  el.style.left = `${(x * 100).toFixed(2)}%`;
  el.style.top = `${(y * 100).toFixed(2)}%`;
  el.addEventListener('animationend', () => el.remove());
  popupsEl.appendChild(el);
}

// ---------- HUD ----------

const hud = {
  pints: $('pints'),
  pps: $('pps'),
  label: $('pints-label'),
  perDrink: $('per-drink'),
  drinks: $('drinks'),
  lifetime: $('lifetime'),
  bestStreak: $('best-streak'),
  bangMeter: $('bang-meter'),
  bangBar: $('bang-meter-bar'),
  bangText: $('bang-meter-text'),
  bangClock: $('bang-meter-clock'),
  mats: $('mats'),
  matsCount: $('mats-count'),
  matsBonus: $('mats-bonus'),
  hint: $('hint'),
  buffs: $('buffs'),
  streak: $('streak'),
  streakLabel: document.querySelector<HTMLElement>('#streak .streak-label')!,
  streakBar: document.querySelector<HTMLElement>('#streak .streak-bar i')!,
};
const lastText = new Map<HTMLElement, string>();
function setText(el: HTMLElement, text: string) {
  if (lastText.get(el) === text) return;
  lastText.set(el, text);
  el.textContent = text;
}

// Say how to drink in the words that fit the device.
hud.hint.textContent = matchMedia('(pointer: coarse)').matches ? tr('Touch and hold to drink') : tr('Click and hold to drink (or hold Space)');

const cycleSeconds = () => drinkCycle(drinkTime(state), refillTime(state));

// On a phone the counter keeps its numbers short ("1.24 Oc") and the Beer Mats to a bare count,
// so they stay off the drinker's face. A tap spells it all out for a few seconds.
const phone = matchMedia('(max-width: 600px)');
const counterEl = document.querySelector<HTMLElement>('.counter')!;
const COUNTER_OPEN_MS = 4000;
let counterTimer = 0;
counterEl.addEventListener('click', () => {
  if (!phone.matches) return;
  clearTimeout(counterTimer);
  if (counterEl.classList.toggle('open')) {
    counterTimer = window.setTimeout(() => counterEl.classList.remove('open'), COUNTER_OPEN_MS);
  }
});

function renderHud() {
  const shown = state.pints.floor();
  const count = phone.matches && !counterEl.classList.contains('open') ? formatBrief : format;
  setText(hud.pints, count(shown));
  setText(hud.label, pintsLabel(shown));
  setText(hud.pps, count(totalPps(state)));
  setText(hud.perDrink, format(pintsPerDrink(state)));
  setText(hud.drinks, format(D(state.drinks)));
  setText(hud.lifetime, format(state.lifetimePints));
  setText(hud.bestStreak, String(state.bestStreak));
  hud.hint.hidden = state.drinks > 0;
  // Once you've seen one universe end, a meter shows how close this one is.
  hud.bangMeter.hidden = state.bangs < 1;
  if (state.bangs > 0) {
    const share = BangPanel.share(state);
    hud.bangBar.style.width = `${(share * 100).toFixed(1)}%`;
    setText(hud.bangText, `${format(D(Math.floor(share * 100)))}%`);
    setText(hud.bangClock, stopwatch(state.universeSeconds));
  }
  hud.mats.hidden = state.beerMats.lte(0);
  if (state.beerMats.gt(0)) {
    setText(hud.matsCount, count(state.beerMats));
    setText(hud.matsBonus, bonusText(matMult(state)));
  }

  // Chug streak meter
  const m = mods(state);
  const left = streakRemaining(streak, clock, cycleSeconds(), m.streakSlack);
  hud.streak.hidden = left <= 0;
  if (left > 0) {
    setText(hud.streakLabel, tr('{n} in a row · ×{mult}', { n: streak.count, mult: streakMult(streak.count, m.streakMaxSteps ?? undefined).toFixed(2) }));
    hud.streakBar.style.width = `${(left * 100).toFixed(1)}%`;
  }
}

let buffKey = '';
function renderBuffs() {
  const key = `${state.buffs.map((b) => `${b.kind}:${Math.ceil(b.remaining)}`).join(',')}|${state.special}|${state.challenge}|${Math.floor(challengeShare(state) * 100)}`;
  if (key === buffKey) return;
  buffKey = key;
  // Happy Hour lights the edge of the scene gold for as long as it lasts.
  document.getElementById('stage')!.classList.toggle('happy-hour', state.buffs.some((b) => b.kind === 'happyHour'));
  hud.buffs.replaceChildren(...state.buffs.map((b) => {
    const info = BUFFS[b.kind];
    const chip = document.createElement('div');
    chip.className = `buff buff-${b.kind}`;
    chip.title = info.desc;
    const secs = Math.ceil(b.remaining);
    const label = document.createElement('span');
    label.textContent = `${info.name} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    chip.append(icon(info.icon), label);
    return chip;
  }), ...nightChips());
}

/** Tonight's special and the challenge you're on, as quiet tags beside the timed rewards. */
function nightChips(): HTMLElement[] {
  const special = state.special ? SPECIAL_BY_ID.get(state.special) : undefined;
  const challenge = state.challenge ? CHALLENGE_BY_ID.get(state.challenge) : undefined;
  // The challenge's tag counts up to its goal, then shows a tick: the handicap is still on, but the prize is won.
  const share = challengeShare(state);
  const tally = share >= 1 ? '✓' : `${format(D(Math.floor(share * 100)))}%`;
  return [special && { text: special.name, title: special.desc }, challenge && { text: `${challenge.name} · ${tally}`, title: challenge.rule }]
    .flatMap((c) => {
      if (!c) return [];
      const chip = document.createElement('div');
      chip.className = 'buff night-chip';
      chip.title = c.title;
      chip.textContent = c.text;
      return [chip];
    });
}

// ---------- store ----------

const store = new StoreView($('store'), () => state, {
  onBought: () => {
    sound.play('buy');
    renderHud();
    updateCrowd();
  },
  onBeerChanged: () => {
    sound.play('beer');
    renderer.setBeer(currentBeer(state).look, state.beer);
    renderer.cheer(1);
  },
  onPubChanged: (opened) => showLocation(opened),
});
let lastStoreUpdate = 0;

// ---------- Free Rounds ----------

let nextFreeRound = nextFreeRoundIn(state);
const freeRound = new FreeRoundView($('free-rounds'), () => freeRoundLifetime(state), () => grant('missed-it'), (x, y) => {
  state.freeRounds++;
  renderer.cheer(2);
  sound.play('freeRound');
  // Doubles All Round: two rewards, the second popping up just above the first.
  for (let n = 0, rewards = mods(state).doubleRounds ? 2 : 1; n < rewards; n++) giveFreeRound(x, y - n * 0.09);
});

function giveFreeRound(x: number, y: number) {
  const outcome = rollFreeRound(state, totalPps(state));
  if (outcome.kind === 'lucky') {
    earn(state, outcome.amount);
    popup(`${tr('Lucky Round!')} +${format(outcome.amount.floor())}`, x, y, 'big');
    toast('🍀', `<strong>${tr('Lucky Round!')}</strong>${tr('The landlord stands you {pints} pints.', { pints: format(outcome.amount.floor()) })}`, 4000);
  } else {
    startBuff(state, outcome.buff);
    invalidate();
    const info = BUFFS[outcome.buff];
    const title = info.name.endsWith('!') ? info.name : `${info.name}!`;
    popup(title, x, y, 'big');
    toast(info.icon, `<strong>${title}</strong>${tr('{effect} for {seconds} seconds.', { effect: info.desc, seconds: Math.round(buffDuration(state, outcome.buff)) })}`, 4000);
  }
}

// ---------- Last Orders ----------

const lastOrdersPanel = new LastOrdersPanel(() => state, {
  onReset: (gained) => {
    drink.fill = 1;
    drink.lift = 0;
    drink.refilling = false;
    drink.committed = false;
    streak.count = 0;
    renderer.setBeer(currentBeer(state).look, state.beer);
    updateCrowd();
    showLocation();
    store.update();
    save();
    sound.play('freeRound');
    toast('🔔', `<strong>${tr('Time, gentlemen, please!')}</strong>${tr('You woke up with {mats} Beer Mats in your pockets. Back to The Red Lion.', { mats: format(gained) })}`, 7000);
  },
  onLicenceBought: () => {
    sound.play('buy');
    renderHud();
    save();
  },
  onBackToPub: () => save(),
});

// ---------- the Big Bang ----------

const bangPanel = new BangPanel(() => state, {
  onBang: (gained) => {
    drink.fill = 1;
    drink.lift = 0;
    drink.refilling = false;
    drink.committed = false;
    streak.count = 0;
    renderer.setBeer(currentBeer(state).look, state.beer);
    updateCrowd();
    showLocation();
    store.update();
    save();
    toast('🕳️', `<strong>${tr('A new universe')}</strong>${tr('You came through with {beers}.', { beers: voidBeersText(gained) })}`, 8000);
  },
  onBought: () => {
    sound.play('buy');
    renderHud();
    updateCrowd();
    save();
  },
  onClosed: () => {
    // The Last Pint of All is bought: the universe you start now is the last one.
    if (startFinale(state)) enterFinale();
    save();
  },
});

// ---------- the end: one pint, drunk by hand, alone ----------

/** The ending is up: the pub is drawn and nothing else happens. */
let ended = false;

/** Put the pub into its last state: nobody in, nothing to buy, the Final Pint full on the bar. */
function enterFinale() {
  document.getElementById('app')!.classList.add('finale');
  drink.fill = 1;
  drink.lift = 0;
  drink.refilling = false;
  drink.committed = false;
  drink.autoSip = 0;
  streak.count = 0;
  renderer.setBeer(currentBeer(state).look, state.beer);
  updateCrowd();
  showLocation();
  store.update();
  renderHud();
  renderBuffs();
}

/** One frame of the last universe. Only holding drinks, slowly, and one pint is all there is. */
function finaleFrame(elapsed: number, now: number) {
  const holding = pointerHeld || keyHeld || pressQueued;
  pressQueued = false;
  stage.classList.toggle('holding', holding);
  hud.hint.hidden = holding || drink.fill < 1;
  let left = Math.min(elapsed, 1), finished = false;
  while (left > 0 && !finished) {
    const dt = Math.min(DRINK_STEP, left);
    left -= dt;
    // No Down in One and no sipping on his own: this one is yours to drink, and it takes its time.
    if (stepDrink(drink, dt, holding, { drinkTime: 4, refillTime: 1e9 })) finished = true;
  }
  state.glassFill = drink.refilling ? 0 : drink.fill;
  const p = pose();
  gulpTimer -= elapsed;
  if (p.sipping && gulpTimer <= 0) {
    sound.play('gulp');
    gulpTimer = 0.9;
  }
  renderer.render(p, now / 1000);
  if (finished) theEnd();
}

function theEnd() {
  if (!finishGame(state)) return;
  save();
  sound.play('clink');
  window.setTimeout(showEnd, 900);
}

/**
 * The End. There is one way on from it: start again, from nothing. (It is also where a finished
 * save opens, so closing the page here doesn't leave a game to carry on with.)
 */
function showEnd() {
  ended = true;
  const dialog = $<HTMLDialogElement>('end-dialog');
  if (dialog.open) return;
  // The Final Pint's own line says it best.
  $('end-line').textContent = BEERS[BEERS.length - 1].flavour;
  $('end-stats').textContent = [playTime(state.playSeconds), state.fastestUniverse > 0 ? `${tr('Fastest universe')} ${stopwatch(state.fastestUniverse)}` : '']
    .filter(Boolean).join(' · ');
  // It goes when you say so, not by Escape or a stray click.
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  $('end-restart').addEventListener('click', () => {
    // Looking at a debug scenario, the real save is somebody's game: leave it, and just go to the door.
    if (previewScenario) location.href = location.pathname;
    else hardReset();
  }, { once: true });
  dialog.showModal();
}

// ---------- auto-buyers (Management branch of the Licence) ----------

function autoBuy() {
  const m = mods(state);
  if (!m.auto.size) return;
  let bought = false;
  if (m.auto.has('beer') && state.settings.auto.beer && buyNextRound(state)) {
    renderer.setBeer(currentBeer(state).look, state.beer);
    bought = true;
  }
  if (m.auto.has('upgrades') && state.settings.auto.upgrades) {
    for (const u of availableUpgrades(state).slice(0, 10)) {
      if (state.pints.gte(upgradeCost(state, u)) && buyUpgrade(state, u.id)) bought = true;
    }
  }
  if (m.auto.has('upgrades') && state.settings.auto.upgrades) {
    // The bar staff open new pubs too, but leave it to you where to drink.
    const here = state.pub, ready = state.pubReadyAt;
    for (const l of pubsForSale(state)) if (buyPub(state, l.id)) bought = true;
    if (state.pub !== here) {
      state.pub = here;
      state.pubReadyAt = ready;
      invalidate();
    }
  }
  if (m.auto.has('drinkers') && state.settings.auto.drinkers) {
    // Keep buying whichever drinker pays for itself fastest, a handful per tick.
    for (let i = 0; i < 25; i++) {
      const vis = storeVisibility(state);
      let best: { id: string; ratio: Decimal } | null = null;
      DRINKERS.forEach((d, j) => {
        if (vis[j] !== 'shown') return;
        const ratio = priceOf(state, d, owned(state, d.id), 1).div(drinkerPpsEach(state, d));
        if (!best || ratio.lt(best.ratio)) best = { id: d.id, ratio };
      });
      const pick = best as { id: string; ratio: Decimal } | null;
      if (!pick || buyDrinker(state, pick.id, 1) === 0) break;
      bought = true;
    }
  }
  if (bought) updateCrowd();
}
let lastAutoBuy = 0;

// ---------- loop ----------

/** Debug: hold the drinking pose still (for checking animation frames). */
let frozenPose: { lift: number; fill: number } | null = null;

let gulpTimer = 0;
let wasPouring = false;

function finishPint() {
  if (drink.lastFinishAuto) {
    // He finished this one on his own: full pints, but no streak and not "by hand".
    const amount = pintsPerDrink(state);
    earn(state, amount);
    state.autoDrinks++;
    const a = renderer.project(popupAnchor(pose()));
    popup(`+${format(amount)}`, a.x, a.y, 'quiet');
    sound.play('clink');
    return;
  }
  const m = mods(state);
  const mult = registerFinish(streak, clock, cycleSeconds(), {
    extraSlack: m.streakSlack, maxSteps: m.streakMaxSteps ?? undefined, halveOnBreak: m.streakHalf,
  });
  state.bestStreak = Math.max(state.bestStreak, streak.count);
  const amount = pintsPerDrink(state).mul(mult);
  earn(state, amount);
  state.handPints = state.handPints.add(amount);
  state.drinks++;
  hud.pints.classList.remove('bump');
  void hud.pints.offsetWidth; // restart the animation
  hud.pints.classList.add('bump');
  const a = renderer.project(popupAnchor(pose()));
  popup(`+${format(amount)}`, a.x, a.y, streak.count >= 2 ? 'streaky' : '');
  sound.play('clink');
  if (streak.count >= 2) sound.play('streak', streak.count);
  if (streak.count >= 2 && streak.count % 5 === 0) renderer.cheer(1);
}

startLoop((elapsed, now) => {
  // Inside the black hole (the scene, or its screen) nothing happens outside it: the pub is
  // drawn as it stood and that is all.
  if (state.finale || ended) {
    if (state.finale && started && !bangPanel.paused) finaleFrame(elapsed, now);
    else renderer.render(pose(), now / 1000);
    lastAutoBuy = now;
    return;
  }
  if (bangPanel.paused) {
    stage.classList.remove('holding');
    pressQueued = false;
    lastAutoBuy = now;
    renderer.render(pose(), now / 1000);
    if (now - lastStoreUpdate > 200) {
      lastStoreUpdate = now;
      bangPanel.update();
    }
    return;
  }

  // Idle income. Hidden tabs get throttled, so this can be several seconds at once;
  // that's still live play. Much longer gaps (machine asleep) are treated as time away.
  if (elapsed >= AWAY_THRESHOLD_SECONDS) {
    creditAway(elapsed);
  } else {
    const pps = totalPps(state);
    if (pps.gt(0)) earn(state, pps.mul(elapsed));
    if (tickBuffs(state, elapsed)) invalidate();
    clock += elapsed;
    state.playSeconds += elapsed;
    state.universeSeconds += elapsed;
  }

  // Drinking by hand, in small steps.
  const holding = pointerHeld || keyHeld || pressQueued;
  pressQueued = false;
  stage.classList.toggle('holding', holding);
  const params = {
    drinkTime: drinkTime(state), refillTime: refillTime(state), downInOne: hasDownInOne(state), auto: true,
    autoFull: mods(state).autoFull,
  };
  let left = Math.min(elapsed, 1);
  while (left > 0) {
    const dt = Math.min(DRINK_STEP, left);
    left -= dt;
    if (stepDrink(drink, dt, holding, params)) finishPint();
  }
  // A pint that's being poured counts as full, so a refresh never costs you a drink.
  state.glassFill = drink.refilling ? 1 : drink.fill;
  if (frozenPose) Object.assign(drink, frozenPose, { refilling: false });

  // Sounds that follow the glass.
  const p = pose();
  gulpTimer -= elapsed;
  if (p.sipping && gulpTimer <= 0) {
    sound.play('gulp');
    gulpTimer = Math.max(0.22, drinkTime(state) / 4);
  }
  const pouring = drink.refilling && drink.lift === 0;
  if (pouring && !wasPouring) sound.play('pour');
  wasPouring = pouring;

  // Free Rounds turn up every few minutes.
  if (!freeRound.active && clock >= nextFreeRound) {
    freeRound.spawn();
    nextFreeRound = clock + freeRoundLifetime(state) + nextFreeRoundIn(state);
  }
  freeRound.update(Math.min(elapsed, 1), mods(state).autoRounds);

  renderer.setStreak(streakRemaining(streak, clock, cycleSeconds(), mods(state).streakSlack) > 0 ? streak.count : 0);
  renderer.render(p, now / 1000);
  renderHud();
  if (now - lastAutoBuy > 1000) {
    observe((now - lastAutoBuy) / 1000);
    lastAutoBuy = now;
    // No More Mornings: the mats a Last Orders would pay just arrive.
    if (mods(state).liveMats) collectLiveMats(state, matsOnReset(state));
    // Legend in Your Sleep: and they are spent on the tree as they come.
    if (autoBuyLegend(state) > 0) renderHud();
    // 1e100 pints in the night: there is no beer left anywhere, and nobody is asked.
    if (started && canBang(state)) bangPanel.bang();
    // Cellar-Aged and Counted Already grow as the night goes on, so the sums are done again.
    if (mods(state).aged > 0 || mods(state).pendingMats) invalidate();
    autoBuy();
    // Pints in the tab title, so you can keep an eye on the pub from another tab. Not until
    // you've gone in, though: a search engine reading the page should see its proper title.
    const shown = state.pints.floor();
    const title = `${format(shown)} ${pintsLabel(shown)} · idle.beer`;
    if (started && document.title !== title) document.title = title;
  }
  if (now - lastStoreUpdate > 200) {
    lastStoreUpdate = now;
    store.update();
    renderBuffs();
    showLocation();
    updateCrowd();
    announce(checkAchievements(state, { pps: totalPps(state), now: new Date() }));
    const beaten = checkChallenge(state);
    if (beaten) {
      invalidate();
      sound.play('freeRound');
      renderer.cheer(2);
      renderBuffs();
      toast('🏆', `<strong>${tr('Challenge beaten!')}</strong>${beaten.name}: ${beaten.reward}`, 8000);
      save();
    }
    achievementsPanel.update();
    lastOrdersPanel.update();
    bangPanel.update();
    statsPanel.update();
  }
});

updateCrowd();

// ---------- saving ----------

const save = () => {
  if (!resetting) saveGame(state);
};
setInterval(save, 30_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('pagehide', save);

// ---------- debug panel (?debug) ----------

if (new URLSearchParams(location.search).has('debug')) {
  const tab = $('debug-tab');
  const panel = $<HTMLDialogElement>('debug-dialog');
  tab.hidden = false;
  tab.addEventListener('click', () => panel.showModal());
  panel.querySelector('.dialog-close')!.addEventListener('click', () => panel.close());
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.close();
  });
  // Ready-made saves: the game at particular moments.
  for (const scenario of SCENARIOS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'debug-scenario';
    button.innerHTML = '<b></b><span></span>';
    button.querySelector('b')!.textContent = scenario.name;
    button.querySelector('span')!.textContent = scenario.desc;
    button.addEventListener('click', () => {
      resetting = true;
      saveGame(scenario.build());
      // Straight back in afterwards: no need to sit through the title for a debug load.
      sessionStorage.setItem(SKIP_TITLE, '1');
      location.reload();
    });
    $('debug-scenarios').appendChild(button);
  }
  panel.addEventListener('click', (e) => {
    const value = (e.target as HTMLElement).dataset.debug;
    if (!value) return;
    if (value === 'reset') {
      if (confirm('Wipe your save and start again?')) hardReset();
      return;
    }
    panel.close();
    if (value === 'happyhour') {
      state.buffs = state.buffs.filter((b) => b.kind !== 'happyHour');
      state.buffs.push({ kind: 'happyHour', remaining: 30 });
      invalidate();
      return;
    }
    if (value === 'x1000') {
      state.debugPerDrinkMult = state.debugPerDrinkMult.mul(1000);
      return;
    }
    if (value === 'drinkers') {
      for (const d of DRINKERS) state.drinkers[d.id] = (state.drinkers[d.id] ?? 0) + 10;
      invalidate();
      updateCrowd();
      return;
    }
    if (value === 'beer') {
      state.beer = (state.beer + 1) % BEERS.length;
      invalidate();
      renderer.setBeer(currentBeer(state).look, state.beer);
      return;
    }
    if (value === 'away') {
      creditAway(2 * 60 * 60); // pretend we were gone two hours (capped to one)
      return;
    }
    if (value === 'freeround') {
      freeRound.spawn();
      return;
    }
    if (value === 'location') {
      // Open the next pub for free and move there (or go round again).
      const next = LOCATIONS.find((l) => !state.pubs.has(l.id)) ?? LOCATIONS[(LOCATIONS.findIndex((l) => l.id === state.pub) + 1) % LOCATIONS.length];
      state.pubs.add(next.id);
      state.pub = next.id;
      state.pubReadyAt = 0;
      invalidate();
      showLocation(true);
      return;
    }
    const amount: Decimal = value === '1e1e10' ? big(1, 1e10) : D(value);
    state.pints = amount;
    state.lifetimePints = Decimal.max(state.lifetimePints, amount);
  });
}

// ---------- loading, then the title screen ----------

/** Through the door: the title goes, the HUD and shop come in, and anything held back is said. */
function enterPub() {
  if (started) return;
  started = true;
  track('start');
  const title = $('title-screen');
  title.classList.add('leaving');
  setTimeout(() => (title.hidden = true), 700);
  $('app').classList.remove('intro');
  crowdOverride = null;
  updateCrowd();
  sound.unlock();
  for (const say of heldToasts.splice(0)) say();
  // Reloaded part-way through spending Beer Mats: carry on where you were.
  lastOrdersPanel.resume();
  bangPanel.resume();
  // Closed the game alone in the pub with the last pint: that is where you still are.
  if (state.finale) enterFinale();
  if (state.finished) showEnd();
}

{
  // The pub behind the title is never empty: until you have a crowd of your own, the house provides one.
  const own = DRINKERS.reduce((sum, d) => sum + owned(state, d.id), 0);
  if (own < 12) {
    crowdOverride = (id) => (DRINKERS.findIndex((d) => d.id === id) < 7 ? 30 : 0);
    updateCrowd();
  }
  const returning = state.lifetimePints.gt(0) || state.prestiges > 0;
  $('title-start').textContent = returning ? tr('Back to the bar') : tr('Start drinking');
  $('title-save').textContent = returning
    ? tr('{pints} on the bar, at {pub}.', {
      pints: `${format(state.pints.floor())} ${pintsLabel(state.pints.floor())}`,
      pub: LOCATION_BY_ID.get(state.pub)?.name ?? '',
    })
    : tr('Hold to drink. Buy a round. See where it goes.');
  $('title-start').addEventListener('click', enterPub);

  // ----- languages -----
  // The picker (on the title and in Settings) is a list of addresses: each language is its own page.
  const here = currentLocale();
  const CHOSEN = 'idleBeer.lang';
  const go = (path: string) => {
    // Remember it was asked for, so nobody is offered their browser's language on top of it.
    try {
      localStorage.setItem(CHOSEN, path);
    } catch {
      // Private browsing: they'll just be offered again.
    }
    save();
    location.href = localeUrl(LOCALES.find((l) => l.path === path) ?? LOCALES[0]) + location.search;
  };
  for (const select of document.querySelectorAll<HTMLSelectElement>('.language-select')) {
    for (const l of LOCALES) select.add(new Option(l.name, l.path, l === here, l === here));
    select.addEventListener('change', () => go(select.value));
  }
  // Landed on one language with a browser set to another we have: offer it, once.
  const theirs = preferredLocale(navigator.languages ?? [navigator.language]);
  let settled: string | null = null;
  try {
    settled = localStorage.getItem(CHOSEN);
  } catch {
    // As above.
  }
  if (theirs && theirs !== here && settled !== here.path) {
    $('lang-offer-text').textContent = tr('This game also comes in {language}.', { language: theirs.name });
    $('lang-offer-yes').textContent = tr('Play in {language}', { language: theirs.name });
    $('lang-offer').hidden = false;
    $('lang-offer-yes').addEventListener('click', () => go(theirs.path));
    $('lang-offer-no').addEventListener('click', () => {
      $('lang-offer').hidden = true;
      try {
        localStorage.setItem(CHOSEN, here.path);
      } catch {
        // As above.
      }
    });
  }
  // "reduced", after a discounted price, is written by the stylesheet.
  document.documentElement.style.setProperty('--reduced', JSON.stringify(` ${tr('reduced')}`));

  // Ready means: the save is loaded (it is, by now), the lettering has arrived, and the pub has
  // been drawn at least twice. Never wait on any of that for more than a few seconds.
  const frames = new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  void Promise.all([Promise.race([Promise.all([fonts, frames]), wait(4000)]), wait(500)]).then(() => {
    const loading = $('loading');
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
    // Looking at a ready-made game from the debug dialog: straight in, no title. Anything
    // else, a hard reset included, starts at the front door.
    const skip = sessionStorage.getItem(SKIP_TITLE) === '1' || !!previewScenario;
    sessionStorage.removeItem(SKIP_TITLE);
    if (skip) {
      $('title-screen').hidden = true;
      enterPub();
      return;
    }
    $('title-screen').hidden = false;
    $('title-start').focus();
  });
}

// Handy for poking at things from the console while prototyping.
(window as unknown as { game: unknown }).game = {
  get state() { return state; }, drink, save, streak, freeRound, store, achievementsPanel, lastOrdersPanel, renderer,
  /** Look at a location (by index) without changing the save. */
  scene(i: number) {
    renderer.setLocation(LOCATIONS[i]);
  },
  /** Fill the pub with `n` of every drinker type, for looking at the crowd; pass nothing to go back. */
  crowd(n?: number | ((id: string) => number)) {
    crowdOverride = n === undefined ? null : typeof n === 'number' ? () => n : n;
    updateCrowd();
  },
  /** Hold the pose at a lift (0 = on the bar, 1 = at the lips) and fill; pass nothing to release. */
  freezePose(lift?: number, fill = 0.7) {
    frozenPose = lift === undefined ? null : { lift, fill };
  },
  /** Average milliseconds for one frame's work (scene, HUD) and one store/panel refresh. */
  bench(n = 200) {
    let t0 = performance.now();
    for (let i = 0; i < n; i++) {
      renderer.render(pose(), i / 60);
      renderHud();
    }
    const frame = (performance.now() - t0) / n;
    t0 = performance.now();
    for (let i = 0; i < n; i++) {
      store.update();
      renderBuffs();
      achievementsPanel.update();
      lastOrdersPanel.update();
    }
    return { frameMs: +frame.toFixed(3), storeRefreshMs: +((performance.now() - t0) / n).toFixed(3) };
  },
};
