import './styles/main.css';
import { newDrinkState, stepDrink } from './core/drinking';
import {
  availableUpgrades, buyDrinker, buyNextRound, buyPub, buyUpgrade, currentBeer, drinkerPpsEach, drinkTime, earn,
  hasDownInOne, invalidate, offlineGain, pintsPerDrink, priceOf, pubBonus, pubsForSale, refillTime, storeVisibility, totalPps,
} from './core/economy';
import {
  BUFFS, buffDuration, freeRoundLifetime, nextFreeRoundIn, rollFreeRound, startBuff, tickBuffs,
} from './core/events';
import { mods } from './core/licenceState';
import { matMult } from './core/prestige';
import { format, pintsWord, type NumberFormat } from './core/format';
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

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let state = loadGame();
const drink = newDrinkState(state.glassFill);
let resetting = false;

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
function toast(emoji: string, html: string, ms = 6000) {
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
  if (m < 1) return `${Math.round(seconds)} seconds`;
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} hour${h === 1 ? '' : 's'}${rest ? ` ${rest} min` : ''}`;
}

// ---------- achievements ----------

/** Toast new achievements (a few at most, so a big jump doesn't flood the screen). */
function announce(list: (Achievement | null)[]) {
  const fresh = list.filter((a): a is Achievement => a !== null);
  if (!fresh.length) return;
  invalidate(); // Reputation depends on the achievement count
  sound.play('beer');
  for (const a of fresh.slice(0, 3)) toast('🏆', `<strong>${a.name}</strong>${a.desc}`, 5000);
  if (fresh.length > 3) toast('🏆', `<strong>…and ${fresh.length - 3} more achievements</strong>`, 5000);
}
const grant = (id: GrantedAchievement) => announce([grantAchievement(state, id)]);

/** Credit time spent away (closed, asleep) at the offline rate, and say so. */
function creditAway(seconds: number) {
  if (seconds < AWAY_THRESHOLD_SECONDS) return;
  if (seconds >= 8 * 60 * 60) grant('hair-of-the-dog');
  if (tickBuffs(state, seconds)) invalidate();
  const gain = offlineGain(state, seconds);
  if (gain.pints.lte(0)) return;
  earn(state, gain.pints);
  const shown = gain.pints.floor();
  const capped = gain.seconds < seconds ? ` (they stop after ${duration(gain.seconds)} without you)` : '';
  toast(
    '🌙',
    `While you were away for ${duration(seconds)}, your drinkers sank ` +
      `<b>${format(shown, state.settings.numberFormat)}</b> ${pintsWord(shown)}${capped}.`,
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
  toast('🍻', `<strong>Welcome to ${loc.name}</strong>${loc.perk}${bonus ? ` Everything drinks ${bonus}% more here.` : ''}`);
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
  if (total > 0) setText(crowdCountText, `${format(D(total), state.settings.numberFormat)} in the pub`);
}

// ---------- settings ----------

const soundButton = $<HTMLButtonElement>('sound-toggle');
function showSoundSetting() {
  soundButton.classList.toggle('muted', !state.settings.sound);
  soundButton.setAttribute('aria-pressed', String(state.settings.sound));
  soundButton.title = state.settings.sound ? 'Sound on' : 'Sound off';
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
  resetting = true;
  wipeSave();
  state = newGame();
  location.reload();
}

const settings = new SettingsPanel(() => state, {
  onFormatChange: (f: NumberFormat) => {
    state.settings.numberFormat = f;
    grant('name-your-poison');
  },
  onSoundChange: setSound,
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
      return "That doesn't look like an idle.beer save. Check you copied all of it.";
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
  fullscreenButton.title = on ? 'Leave full screen (F)' : 'Full screen (F)';
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
  if ((e.target as Element).closest('button, a, .toast')) return;
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
  if (!isSpace(e)) return;
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
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
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
hud.hint.textContent = matchMedia('(pointer: coarse)').matches ? 'Touch and hold to drink' : 'Click and hold to drink (or hold Space)';

const cycleSeconds = () => drinkCycle(drinkTime(state), refillTime(state));

function renderHud() {
  const f = state.settings.numberFormat;
  const shown = state.pints.floor();
  setText(hud.pints, format(shown, f));
  setText(hud.label, pintsWord(shown));
  setText(hud.pps, format(totalPps(state), f));
  setText(hud.perDrink, format(pintsPerDrink(state), f));
  setText(hud.drinks, format(D(state.drinks), f));
  setText(hud.lifetime, format(state.lifetimePints, f));
  setText(hud.bestStreak, String(state.bestStreak));
  hud.hint.hidden = state.drinks > 0;
  hud.mats.hidden = state.beerMats.lte(0);
  if (state.beerMats.gt(0)) {
    setText(hud.matsCount, format(state.beerMats, f));
    setText(hud.matsBonus, bonusText(matMult(state), f));
  }

  // Chug streak meter
  const m = mods(state);
  const left = streakRemaining(streak, clock, cycleSeconds(), m.streakSlack);
  hud.streak.hidden = left <= 0;
  if (left > 0) {
    setText(hud.streakLabel, `${streak.count} in a row · ×${streakMult(streak.count, m.streakMaxSteps ?? undefined).toFixed(2)}`);
    hud.streakBar.style.width = `${(left * 100).toFixed(1)}%`;
  }
}

let buffKey = '';
function renderBuffs() {
  const key = state.buffs.map((b) => `${b.kind}:${Math.ceil(b.remaining)}`).join(',');
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
  }));
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
  const outcome = rollFreeRound(state, totalPps(state));
  sound.play('freeRound');
  if (outcome.kind === 'lucky') {
    earn(state, outcome.amount);
    popup(`Lucky Round! +${format(outcome.amount.floor(), state.settings.numberFormat)}`, x, y, 'big');
    toast('🍀', `<strong>Lucky Round!</strong>The landlord stands you ${format(outcome.amount.floor(), state.settings.numberFormat)} pints.`, 4000);
  } else {
    startBuff(state, outcome.buff);
    invalidate();
    const info = BUFFS[outcome.buff];
    const title = info.name.endsWith('!') ? info.name : `${info.name}!`;
    popup(title, x, y, 'big');
    toast(info.icon, `<strong>${title}</strong>${info.desc} for ${Math.round(buffDuration(state, outcome.buff))} seconds.`, 4000);
  }
});

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
    toast('🔔', `<strong>Time, gentlemen, please!</strong>You banked ${format(gained, state.settings.numberFormat)} Beer Mats. A fresh night at The Red Lion awaits.`, 7000);
  },
  onLicenceBought: () => {
    sound.play('buy');
    renderHud();
  },
});

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
      if (state.pints.gte(u.cost) && buyUpgrade(state, u.id)) bought = true;
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
    popup(`+${format(amount, state.settings.numberFormat)}`, a.x, a.y, 'quiet');
    sound.play('clink');
    return;
  }
  const m = mods(state);
  const mult = registerFinish(streak, clock, cycleSeconds(), {
    extraSlack: m.streakSlack, maxSteps: m.streakMaxSteps ?? undefined,
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
  popup(`+${format(amount, state.settings.numberFormat)}`, a.x, a.y, streak.count >= 2 ? 'streaky' : '');
  sound.play('clink');
  if (streak.count >= 2) sound.play('streak', streak.count);
  if (streak.count >= 2 && streak.count % 5 === 0) renderer.cheer(1);
}

startLoop((elapsed, now) => {
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
  }

  // Drinking by hand, in small steps.
  const holding = pointerHeld || keyHeld || pressQueued;
  pressQueued = false;
  stage.classList.toggle('holding', holding);
  const params = {
    drinkTime: drinkTime(state), refillTime: refillTime(state), downInOne: hasDownInOne(state), auto: true,
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
  freeRound.update(Math.min(elapsed, 1));

  renderer.setStreak(streakRemaining(streak, clock, cycleSeconds(), mods(state).streakSlack) > 0 ? streak.count : 0);
  renderer.render(p, now / 1000);
  renderHud();
  if (now - lastAutoBuy > 1000) {
    lastAutoBuy = now;
    autoBuy();
    // Pints in the tab title, so you can keep an eye on the pub from another tab.
    const shown = state.pints.floor();
    const title = `${format(shown, state.settings.numberFormat)} ${pintsWord(shown)} · idle.beer`;
    if (document.title !== title) document.title = title;
  }
  if (now - lastStoreUpdate > 200) {
    lastStoreUpdate = now;
    store.update();
    renderBuffs();
    showLocation();
    updateCrowd();
    announce(checkAchievements(state, { pps: totalPps(state), now: new Date() }));
    achievementsPanel.update();
    lastOrdersPanel.update();
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
  const panel = $('debug');
  panel.hidden = false;
  panel.addEventListener('click', (e) => {
    const value = (e.target as HTMLElement).dataset.debug;
    if (!value) return;
    if (value === 'reset') {
      if (confirm('Wipe your save and start again?')) hardReset();
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
      state.beer = (state.beer + 1) % (BEERS.length + 6); // includes a few generated beers
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
