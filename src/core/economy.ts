import { BEERS, beerAt, beerMultUpTo, type Beer } from '../data/beers';
import { DRINKERS, DRINKER_BY_ID, type Drinker } from '../data/drinkers';
import { LOCATIONS, LOCATION_BONUS, LOCATION_BY_ID, type Location } from '../data/locations';
import { UPGRADES, UPGRADE_BY_ID, type Upgrade } from '../data/upgrades';
import { DOWN_IT_MULT, HAPPY_HOUR_MULT, hasBuff, QUIZ_DISCOUNT, startBuff } from './events';
import { AGED_CAP, BASE_COST_RATIO } from '../data/licence';
import { matsWorth } from './mats';
import { mods, perkPubs } from './licenceState';
import { PUB_COOLDOWN_SECONDS } from './pubs';
import { D, Decimal } from './num';
import { owned, type BuyMode, type GameState } from './state';

// ---------- derived values (cached) ----------

const BASE_DRINK_TIME = 1.0;
const MIN_DRINK_TIME = 0.25;
const BASE_REFILL_TIME = 0.4;

interface Derived {
  /** Per-drinker multiplier from tier upgrades (2^n). */
  drinkerMult: Map<string, number>;
  synergies: { target: string; source: string; perUnit: number }[];
  /** Beer × pub upgrades × Brew Again. Applies to idle and hand income. */
  globalMult: Decimal;
  perDrinkMult: number;
  drinkTime: number;
  refillTime: number;
  downInOne: boolean;
  lunchSeconds: number;
  /** Bonus to everything from Reputation upgrades (1 = none). */
  reputationMult: number;
  /** Price multiplier on drinkers from the pub you're in. */
  drinkerCost: number;
  ppsEach: Map<string, Decimal>;
  totalPps: Decimal;
}

/**
 * Everything derived from upgrades and drinkers is computed once and cached until
 * something changes (call invalidate() after purchases), not every frame.
 */
let cache: { state: GameState; value: Derived } | null = null;

export function invalidate(): void {
  cache = null;
}

function derive(state: GameState): Derived {
  if (cache?.state === state) return cache.value;

  const drinkerMult = new Map<string, number>();
  const synergies: Derived['synergies'] = [];
  let pubMult = 1;
  let perDrinkMult = 1;
  let drinkTime = BASE_DRINK_TIME;
  let refillTime = BASE_REFILL_TIME;
  let downInOne = false;
  let lunchSeconds = 0;
  let reputationMult = 1;

  for (const id of state.upgrades) {
    const e = UPGRADE_BY_ID.get(id)?.effect;
    if (!e) continue;
    switch (e.kind) {
      case 'drinker': drinkerMult.set(e.drinker, (drinkerMult.get(e.drinker) ?? 1) * e.mult); break;
      case 'synergy': synergies.push(e); break;
      case 'global': pubMult *= 1 + e.add; break;
      case 'perDrink': perDrinkMult *= e.mult; break;
      case 'drinkTime': drinkTime *= e.mult; break;
      case 'refillTime': refillTime *= e.mult; break;
      case 'downInOne': downInOne = true; break;
      case 'liquidLunch': lunchSeconds += e.seconds; break;
      case 'reputation': reputationMult *= 1 + e.rate * state.achievements.size; break;
    }
  }

  // The pub you're in: a little to everything, more the further along it is, plus its own perk
  // (or the perk of every pub you've opened, with Pub Crawl Legend).
  const licence = mods(state);
  let locationMult = pubBonus(state.pub);
  let drinkerCost = licence.drinkerCost;
  for (const pub of perkPubs(state, licence)) {
    for (const e of LOCATION_BY_ID.get(pub)?.effects ?? []) {
      if (e.kind === 'all') locationMult *= e.mult;
      else if (e.kind === 'perDrink') perDrinkMult *= e.mult;
      else if (e.kind === 'drinkTime') drinkTime *= e.mult;
      else if (e.kind === 'drinkerCost') drinkerCost *= e.mult;
    }
  }
  if (licence.downInOne) downInOne = true;
  lunchSeconds += licence.lunch;
  perDrinkMult *= licence.perDrink;
  // Beer Mats: +1% for each one unspent (more with the Collecting branch).
  const matMult = matBonus(state);
  // The Local Legend tree's own boosts to everything: its long line, achievements, beers.
  const treeMult = D(licence.allMult)
    .mul(1 + licence.achMult * state.achievements.size)
    .mul(Decimal.pow(licence.beerPower, Math.min(state.beer, BEERS.length - 1)))
    // Gravity Well: more for every Black Hole Beer held.
    .mul(Decimal.pow(licence.voidPower, state.voidBeers))
    // Cellar-Aged: more for every minute of the night (the caller refreshes this as time passes).
    .mul(1 + Math.min(AGED_CAP, licence.aged * Math.max(0, (Date.now() - state.runStartedAt) / 60_000)));
  const globalMult = beerMultUpTo(state.beer).mul(pubMult * locationMult * reputationMult).mul(matMult).mul(treeMult);

  const happyHour = hasBuff(state, 'happyHour') ? (licence.happyHour ?? HAPPY_HOUR_MULT) + licence.happyHourAdd : 1;
  if (hasBuff(state, 'downIt')) perDrinkMult *= DOWN_IT_MULT;
  // Drinkers only: the tree's long line, and Packed to the Rafters (more for every drinker in the pub).
  let crowd = 0;
  if (licence.crowd > 0) for (const d of DRINKERS) crowd += owned(state, d.id);
  const idleMult = globalMult.mul(licence.idleMult).mul(1 + licence.crowd * crowd);

  const ppsEach = new Map<string, Decimal>();
  let totalPps = D(0);
  for (const d of DRINKERS) {
    let synergy = 1;
    for (const s of synergies) if (s.target === d.id) synergy += s.perUnit * owned(state, s.source);
    // Drinking Alone: whoever is in doesn't drink.
    const each = licence.noDrinkers ? D(0) : d.basePps.mul((drinkerMult.get(d.id) ?? 1) * synergy * happyHour).mul(idleMult);
    ppsEach.set(d.id, each);
    totalPps = totalPps.add(each.mul(owned(state, d.id)));
  }

  const value: Derived = {
    drinkerMult, synergies, globalMult, perDrinkMult,
    drinkTime: Math.max(MIN_DRINK_TIME, drinkTime),
    refillTime, downInOne, lunchSeconds, reputationMult, drinkerCost, ppsEach, totalPps,
  };
  cache = { state, value };
  return value;
}

/** The bonus to everything from Beer Mats: 1 + rate × mats (unspent ones, or all of them with The Complete Set). */
export function matBonus(state: GameState): Decimal {
  const m = mods(state);
  if (m.noMats) return D(1);
  let mats = m.matsCountSpent ? Decimal.max(state.beerMats, state.matsEarned) : state.beerMats;
  // Counted Already: what Last Orders would pay tonight is in your pocket as far as the bonus goes.
  if (m.pendingMats) {
    mats = mats.add(Decimal.max(0, matsWorth(state.pastRunsPints.add(state.lifetimePints), m.matGain).sub(state.matsEarned)));
  }
  return mats.mul(m.matRate).add(1);
}

// ---------- drinking by hand ----------

/** Seconds of holding to drain a full pint. */
export const drinkTime = (state: GameState): number => derive(state).drinkTime;

/** Seconds to pour a fresh pint. */
export const refillTime = (state: GameState): number => derive(state).refillTime;

export const hasDownInOne = (state: GameState): boolean => derive(state).downInOne;

export function pintsPerDrink(state: GameState): Decimal {
  // Dry January: what you drink yourself counts for nothing.
  if (mods(state).noHand) return D(0);
  const d = derive(state);
  const base = d.globalMult.mul(d.perDrinkMult).mul(state.debugPerDrinkMult);
  return d.lunchSeconds > 0 ? base.add(d.totalPps.mul(d.lunchSeconds)) : base;
}

export function earn(state: GameState, amount: Decimal): void {
  state.pints = state.pints.add(amount);
  state.lifetimePints = state.lifetimePints.add(amount);
}

// ---------- drinker costs ----------

export const COST_RATIO = D(BASE_COST_RATIO);

/**
 * Cost of buying `qty` more, having `have` already: base × 1.15^have × (1.15^qty − 1) / 0.15,
 * rounded up to whole pints (a no-op once numbers are huge). `ratio` is the 1.15, which
 * Inflation (after the Big Bang) brings down.
 */
export function costOf(d: Drinker, have: number, qty: number, ratio: Decimal = COST_RATIO): Decimal {
  if (qty <= 0) return D(0);
  return Decimal.sumGeometricSeries(qty, d.baseCost, ratio, have).ceil();
}

/** How much dearer each drinker of a kind is than the last, for this player. */
const costRatio = (state: GameState): Decimal => {
  const r = mods(state).costRatio;
  return r === BASE_COST_RATIO ? COST_RATIO : D(r);
};

/**
 * Step n down until fits(n). Starts with tiny steps and doubles them, so it always finishes in
 * a few dozen checks, even past 2^53 where integers are spaced more than 1 apart and n-- does nothing.
 */
function backOff(n: number, fits: (n: number) => boolean, floor: number): number {
  let step = Math.max(1, n * Number.EPSILON * 4);
  for (let i = 0; i < 80 && n > floor && !fits(n); i++) {
    n = Math.max(floor, Math.floor(n - step));
    step *= 2;
  }
  return n;
}

/** How many you can afford right now. Closed form, so it's instant even for billions. */
export function maxAffordable(d: Drinker, have: number, funds: Decimal, ratio: Decimal = COST_RATIO): number {
  if (funds.lt(costOf(d, have, 1, ratio))) return 0;
  let n = Math.floor(Decimal.affordGeometricSeries(funds, d.baseCost, ratio, have).toNumber());
  if (!Number.isFinite(n) || n < 1) n = 1;
  // Floating point can overshoot at the boundary.
  return backOff(n, (k) => costOf(d, have, k, ratio).lte(funds), 1);
}

/** Price multiplier on drinkers right now (a Pub Quiz Win, or the right pub, makes them cheaper). */
export const drinkerDiscount = (state: GameState): number =>
  (hasBuff(state, 'quizWin') ? QUIZ_DISCOUNT : 1) * derive(state).drinkerCost;

/** What buying `qty` more drinkers costs you right now, including any discount. */
export function priceOf(state: GameState, d: Drinker, have: number, qty: number): Decimal {
  const m = drinkerDiscount(state);
  const base = costOf(d, have, qty, costRatio(state));
  return m === 1 ? base : base.mul(m).ceil();
}

/** How many you can afford right now, including any discount. */
export function affordableNow(state: GameState, d: Drinker, have: number): number {
  let n = maxAffordable(d, have, state.pints.div(drinkerDiscount(state)), costRatio(state));
  return backOff(n, (k) => k === 0 || priceOf(state, d, have, k).lte(state.pints), 0);
}

/** How many a click would buy in this mode (Max shows at least 1 so there's a price to display). */
export function quantityFor(state: GameState, mode: BuyMode, d: Drinker, have: number): number {
  if (mode !== 'max') return mode;
  return Math.max(1, affordableNow(state, d, have));
}

function spend(state: GameState, cost: Decimal): boolean {
  if (state.pints.lt(cost)) return false;
  state.pints = Decimal.max(0, state.pints.sub(cost));
  return true;
}

/** Buy drinkers. Returns how many were bought (0 if you couldn't afford them). */
export function buyDrinker(state: GameState, id: string, mode: BuyMode): number {
  const d = DRINKER_BY_ID.get(id);
  if (!d || mods(state).noDrinkers) return 0;
  const have = owned(state, id);
  const qty = mode === 'max' ? affordableNow(state, d, have) : mode;
  if (qty <= 0 || !spend(state, priceOf(state, d, have, qty))) return 0;
  state.drinkers[id] = have + qty;
  // Plus One: each brings a friend from the crowd before.
  const before = DRINKERS[DRINKERS.indexOf(d) - 1];
  if (before && mods(state).plusOne) state.drinkers[before.id] = owned(state, before.id) + qty;
  invalidate();
  return qty;
}

// ---------- production ----------

/** Pints per second from one of this drinker, with all upgrades. */
export const drinkerPpsEach = (state: GameState, d: Drinker): Decimal =>
  derive(state).ppsEach.get(d.id) ?? D(0);

export const drinkerPps = (state: GameState, d: Drinker): Decimal =>
  drinkerPpsEach(state, d).mul(owned(state, d.id));

export const totalPps = (state: GameState): Decimal => derive(state).totalPps;

export const globalMult = (state: GameState): Decimal => derive(state).globalMult;

/** Bonus to everything from Reputation (achievements × Reputation upgrades). 1 = none. */
export const reputationMult = (state: GameState): number => derive(state).reputationMult;

// ---------- upgrades ----------

/** Upgrades you can see in the store: unlocked and not yet bought, cheapest first. */
export function availableUpgrades(state: GameState): Upgrade[] {
  if (mods(state).noUpgrades) return [];
  return UPGRADES.filter((u) => !state.upgrades.has(u.id) && u.unlocked(state)).sort((a, b) => a.cost.cmp(b.cost));
}

/** What an upgrade costs this player: its price, or nothing with Free Bar. */
export const upgradeCost = (state: GameState, u: Upgrade): Decimal => (mods(state).freeShop ? D(0) : u.cost);

export function buyUpgrade(state: GameState, id: string): boolean {
  const u = UPGRADE_BY_ID.get(id);
  if (!u || mods(state).noUpgrades || state.upgrades.has(id) || !u.unlocked(state) || !spend(state, upgradeCost(state, u))) return false;
  state.upgrades.add(id);
  invalidate();
  return true;
}

// ---------- beers ----------

export const currentBeer = (state: GameState): Beer => beerAt(state.beer);

export interface NextRound {
  beer: Beer;
  cost: Decimal;
  mult: number;
}

/** The next beer for sale, or null if it isn't revealed yet, or you're on the last one. */
export function nextRound(state: GameState): NextRound | null {
  if (state.beer >= BEERS.length - 1 || mods(state).noBeer) return null;
  const beer = beerAt(state.beer + 1);
  if (state.lifetimePints.lt(beer.cost.mul(0.5))) return null;
  const discount = mods(state).beerDiscount;
  const cost = discount === 1 ? beer.cost : beer.cost.mul(discount).ceil();
  return { beer, cost, mult: beer.mult };
}

export function buyNextRound(state: GameState): boolean {
  const offer = nextRound(state);
  if (!offer || !spend(state, offer.cost)) return false;
  state.beer++;
  // Guest Ale: a new beer on is an occasion.
  if (mods(state).beerHappyHour) startBuff(state, 'happyHour');
  invalidate();
  return true;
}

// ---------- pubs ----------

/** The share every pub gives to everything while you're in it: +2% per step along the list. */
export const pubBonus = (id: string): number =>
  1 + LOCATION_BONUS * Math.max(0, LOCATIONS.findIndex((l) => l.id === id));

export type PubStatus = 'here' | 'open' | 'forSale' | 'mystery' | 'hidden';

/**
 * Where each pub stands: you're in it, it's open (you can move there), it's for sale, or it's
 * still a rumour. Like drinkers, the next unknown one shows as "???".
 */
export function pubStatuses(state: GameState): PubStatus[] {
  let mysteryUsed = false;
  return LOCATIONS.map((l) => {
    if (l.id === state.pub) return 'here';
    if (state.pubs.has(l.id)) return 'open';
    if (state.lifetimePints.gte(l.threshold.mul(0.1))) return 'forSale';
    if (mysteryUsed) return 'hidden';
    mysteryUsed = true;
    return 'mystery';
  });
}

/** The next pub you could open, if one is on offer. */
export function pubsForSale(state: GameState): Location[] {
  const status = pubStatuses(state);
  return LOCATIONS.filter((_, i) => status[i] === 'forSale');
}

/** Seconds until you can move pub again (0 = you can move now). */
export const pubCooldownLeft = (state: GameState, now = Date.now()): number =>
  Math.max(0, Math.min(PUB_COOLDOWN_SECONDS, (state.pubReadyAt - now) / 1000));

/** Open a pub and move there. Opening is always allowed; it starts the cooldown on moving again. */
export function buyPub(state: GameState, id: string, now = Date.now()): boolean {
  const l = LOCATION_BY_ID.get(id);
  if (!l || state.pubs.has(id) || !state.lifetimePints.gte(l.threshold.mul(0.1)) || !spend(state, l.threshold)) return false;
  state.pubs.add(id);
  state.pub = id;
  state.pubReadyAt = now + PUB_COOLDOWN_SECONDS * 1000;
  invalidate();
  return true;
}

/** Move to a pub you've already opened, if you've been where you are long enough. */
export function selectPub(state: GameState, id: string, now = Date.now()): boolean {
  if (!state.pubs.has(id) || state.pub === id || pubCooldownLeft(state, now) > 0) return false;
  state.pub = id;
  state.pubReadyAt = now + PUB_COOLDOWN_SECONDS * 1000;
  invalidate();
  return true;
}

// ---------- offline progress ----------

export const OFFLINE_RATE = 0.5;
export const OFFLINE_CAP_SECONDS = 60 * 60;

/** Pints earned while the game was closed. Returns the amount and the seconds it covered. */
export function offlineGain(state: GameState, awaySeconds: number): { pints: Decimal; seconds: number } {
  const m = mods(state);
  const seconds = Math.min(Math.max(0, awaySeconds), ((m.offlineCap ?? OFFLINE_CAP_SECONDS) + m.offlineCapAdd) * m.offlineCapMult);
  return { pints: totalPps(state).mul(seconds * (m.offlineRate ?? OFFLINE_RATE)), seconds };
}

// ---------- store visibility ----------

export type Visibility = 'shown' | 'mystery' | 'hidden';

/**
 * A drinker shows once you own one or have earned over half its price; the next one
 * after the last shown drinker appears as "???" so there's always something to aim for.
 */
export function storeVisibility(state: GameState): Visibility[] {
  const result: Visibility[] = [];
  let mysteryUsed = false;
  for (const [i, d] of DRINKERS.entries()) {
    const known = i === 0 || owned(state, d.id) > 0 || state.lifetimePints.gte(d.baseCost.mul(0.5));
    if (known) result.push('shown');
    else if (!mysteryUsed) {
      result.push('mystery');
      mysteryUsed = true;
    } else result.push('hidden');
  }
  return result;
}
