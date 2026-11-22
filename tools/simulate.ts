/**
 * Headless pacing simulator (DESIGN.md §8.8). Plays the real economy with a simple
 * "best payback" bot and prints when milestones are reached.
 *
 *   npm run simulate                    # one run, always holding to drink, to 1e15
 *   npm run simulate -- 0.25            # holding a quarter of the time
 *   npm run simulate -- 1 1e18          # stop at 1e18 lifetime pints
 *   npm run simulate -- 0.5 1e70        # the whole of a first run: the late game needs checking too
 *   npm run simulate -- 0.25 1e15 4     # four runs with Last Orders in between
 *   npm run simulate -- 0.5 1e15 600    # as many runs as it takes to buy the whole Local Legend tree
 *
 * Multi-run strategy: call Last Orders once it would at least double your total mats
 * (and pay 10+), then spend up to half your mats on the cheapest Licence nodes.
 * Free Rounds and streaks are ignored, so real players get a bit of a bonus on top.
 */
import {
  availableUpgrades, buyDrinker, buyNextRound, buyPub, buyUpgrade, costOf, drinkTime, earn, invalidate,
  nextRound, pintsPerDrink, pubsForSale, refillTime, storeVisibility, totalPps,
} from '../src/core/economy';
import { autoCycleSeconds } from '../src/core/drinking';
import { format } from '../src/core/format';
import { mods } from '../src/core/licenceState';
import { D, Decimal } from '../src/core/num';
import { buyLicence, lastOrders, licenceStatus, matsOnReset } from '../src/core/prestige';
import { newGame, owned, type GameState } from '../src/core/state';
import { checkAchievements } from '../src/data/achievements';
import { beerAt } from '../src/data/beers';
import { DRINKERS } from '../src/data/drinkers';
import { LICENCE } from '../src/data/licence';

const activity = Number(process.argv[2] ?? 1); // fraction of time spent holding to drink
const target = D(process.argv[3] ?? '1e15');
const runs = Number(process.argv[4] ?? 1);
const MAX_RUN_SECONDS = 12 * 60 * 60;

// Physical drink cycle: lift to the lips, drain, put down, pour.
const cycleTime = (s: GameState) => 0.25 * 0.85 + drinkTime(s) + 0.3 + refillTime(s);
// Holding for `activity` of the time; the rest of the time he sips slowly on his own.
const handRate = (s: GameState) =>
  pintsPerDrink(s).mul(activity / cycleTime(s) + (1 - activity) / (mods(s).autoFull ? cycleTime(s) : autoCycleSeconds(drinkTime(s), refillTime(s))));
const income = (s: GameState) => totalPps(s).add(handRate(s));

function clone(s: GameState): GameState {
  return { ...s, drinkers: { ...s.drinkers }, upgrades: new Set(s.upgrades), pubs: new Set(s.pubs), settings: { ...s.settings } };
}

interface Option {
  label: string;
  cost: Decimal;
  buy: (s: GameState) => boolean;
}

function options(s: GameState): Option[] {
  const out: Option[] = [];
  const vis = storeVisibility(s);
  DRINKERS.forEach((d, i) => {
    if (vis[i] !== 'shown') return;
    out.push({ label: d.name, cost: costOf(d, owned(s, d.id), 1), buy: (x) => buyDrinker(x, d.id, 1) > 0 });
  });
  for (const u of availableUpgrades(s)) {
    out.push({ label: `upgrade: ${u.name}`, cost: u.cost, buy: (x) => buyUpgrade(x, u.id) });
  }
  const offer = nextRound(s);
  if (offer) out.push({ label: `beer: ${offer.beer.name}`, cost: offer.cost, buy: buyNextRound });
  // Opening a pub moves you there; the bot judges it, like everything else, by what it does to income.
  for (const l of pubsForSale(s)) out.push({ label: `pub: ${l.name}`, cost: l.threshold, buy: (x) => buyPub(x, l.id) });
  return out;
}

/** How much more income an option gives, measured by actually buying it on a copy. */
function gain(s: GameState, o: Option): Decimal {
  const before = income(s);
  const c = clone(s);
  c.pints = D('1e9000');
  o.buy(c);
  invalidate();
  const after = income(c);
  invalidate();
  return after.sub(before);
}

/** Lower is better: time to save up for it plus time for it to pay for itself. */
function score(s: GameState, o: Option): number {
  const g = gain(s, o);
  const inc = income(s);
  if (g.lte(0)) return o.cost.lte(s.pints.mul(0.01)) ? -1 : Infinity; // freebies like Down in One
  const wait = Decimal.max(0, o.cost.sub(s.pints)).div(inc).toNumber();
  return wait + o.cost.div(g).toNumber();
}

const fmtTime = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60);
  return `${h ? `${h}h ` : ''}${String(m).padStart(h ? 2 : 1, '0')}m ${String(sec).padStart(2, '0')}s`;
};

interface RunResult {
  seconds: number;
  milestones: Map<string, number>;
}

/** Play one run. Stops at `stop()` or the time cap. */
function playRun(s: GameState, stop: (s: GameState) => boolean, verbose: boolean): RunResult {
  let t = 0;
  const seen = new Set<string>();
  const result: RunResult = { seconds: 0, milestones: new Map() };
  const marks = Array.from({ length: 50 }, (_, i) => D(10).pow(3 * (i + 1)));
  const log = (what: string) => {
    if (verbose) console.log(`${fmtTime(t).padStart(12)}  ${format(s.lifetimePints).padStart(18)}  ${`${format(income(s))}/s`.padStart(20)}  ${what}`);
  };
  const note = (key: string) => {
    if (!result.milestones.has(key)) result.milestones.set(key, t);
  };

  while (!stop(s) && t < MAX_RUN_SECONDS) {
    let best: Option | null = null;
    let bestScore = Infinity;
    for (const o of options(s)) {
      const sc = score(s, o);
      if (sc < bestScore) {
        bestScore = sc;
        best = o;
      }
    }

    const inc = income(s);
    // Rolling in it (a late run, when a moment's income buys the shop): buy the lot, as the
    // auto-buyers would, not one drinker at a time.
    if (best && s.pints.gte(best.cost.mul(1e6))) {
      for (const u of availableUpgrades(s)) buyUpgrade(s, u.id);
      while (buyNextRound(s));
      for (const l of pubsForSale(s)) buyPub(s, l.id);
      const vis = storeVisibility(s);
      for (let i = DRINKERS.length - 1; i >= 0; i--) if (vis[i] === 'shown') buyDrinker(s, DRINKERS[i].id, 'max');
      invalidate();
    }
    if (best && s.pints.gte(best.cost)) {
      best.buy(s);
      const key = /^(upgrade|beer|pub)/.test(best.label) ? best.label : `first ${best.label}`;
      const important = key.startsWith('beer') || key.startsWith('pub') || key.startsWith('first') || key.includes('Down in One');
      if (!seen.has(key) && important) {
        log(key);
        note(key);
      }
      seen.add(key);
      continue;
    }

    // Wait for the target (re-checking now and then, as new options get revealed).
    const need = best ? best.cost.sub(s.pints).div(inc).toNumber() : 60;
    const step = Math.max(0.5, Math.min(need, Math.max(5, t * 0.02)));
    earn(s, inc.mul(step));
    s.drinks += (activity * step) / cycleTime(s);
    t += step;
    if (checkAchievements(s, { pps: totalPps(s), now: new Date(2026, 0, 7, 19) }).length) invalidate();

    while (marks.length && s.lifetimePints.gte(marks[0])) {
      const m = marks.shift()!;
      log(`reached ${format(m)} lifetime pints`);
      note(`pints ${m.toString()}`);
    }
  }
  result.seconds = t;
  return result;
}

/** Spend up to half your mats on the cheapest nodes you can buy. */
function spendMats(s: GameState): string[] {
  const keep = s.beerMats.div(2);
  const bought: string[] = [];
  for (;;) {
    const node = LICENCE
      .filter((n) => licenceStatus(s, n.id) === 'available' && s.beerMats.sub(n.cost).gte(keep))
      .sort((a, b) => a.cost.cmp(b.cost))[0];
    if (!node || !buyLicence(s, node.id)) break;
    bought.push(node.name);
  }
  return bought;
}

// ---------- main ----------

const s = newGame(0);

if (runs <= 1) {
  console.log(`Activity ${activity * 100}% holding · stop at ${format(target)} lifetime pints\n`);
  console.log(`${'time'.padStart(12)}  ${'lifetime pints'.padStart(18)}  ${'income'.padStart(20)}  event`);
  const r = playRun(s, (x) => x.lifetimePints.gte(target), true);
  console.log(`\nAfter ${fmtTime(r.seconds)}:`);
  console.log(`  income        ${format(income(s))}/s (drinkers ${format(totalPps(s))}/s, hand ${format(handRate(s))}/s)`);
  console.log(`  beer          ${beerAt(s.beer).name}`);
  console.log(`  upgrades      ${s.upgrades.size}`);
  console.log(`  achievements  ${s.achievements.size}`);
  console.log(`  Last Orders   would pay ${format(matsOnReset(s))} Beer Mats`);
  console.log(`  drinkers      ${DRINKERS.filter((d) => owned(s, d.id)).map((d) => `${d.name} ${owned(s, d.id)}`).join(', ')}`);
} else {
  console.log(`Activity ${activity * 100}% holding · ${runs} runs\n`);
  console.log('run     length   total time  drunk this run        mats in all  perks  bought');
  let total = 0;
  for (let run = 1; run <= runs; run++) {
    // Prestige once it would at least double your mats (and pay at least 10).
    const stop = (x: GameState) => {
      const gain = matsOnReset(x);
      return gain.gte(10) && gain.gte(x.matsEarned);
    };
    const r = playRun(s, stop, false);
    total += r.seconds;
    const drunk = s.lifetimePints;
    lastOrders(s);
    const bought = spendMats(s);
    const names = [...new Set(bought)];
    console.log(
      `${String(run).padStart(3)}  ${fmtTime(r.seconds).padStart(9)}  ${fmtTime(total).padStart(11)}  ${format(drunk).padStart(14)}  ` +
        `${format(s.matsEarned).padStart(17)}  ${String(s.licence.size).padStart(5)}  ${names.slice(0, 4).join(', ') || '-'}${names.length > 4 ? '…' : ''}`,
    );
    if (s.licence.size === LICENCE.length) break;
  }
  console.log(`\nTotal time ${fmtTime(total)} · ${format(s.beerMats)} mats unspent · ${s.licence.size} Licence nodes`);
}
