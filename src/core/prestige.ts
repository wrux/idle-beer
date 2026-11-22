/**
 * Last Orders (DESIGN.md §6): reset the run for Beer Mats, which boost everything
 * and buy permanent Landlord's Licence nodes.
 */
import { LICENCE_BY_ID } from '../data/licence';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { invalidate } from './economy';
import { mods } from './licenceState';
import { D, Decimal } from './num';
import { newGame, type GameState } from './state';

/** Lifetime pints for the first Beer Mat. */
export const MAT_SCALE = D(1e12);

/** Pints from every run, including this one. */
export const allTimePints = (s: GameState): Decimal => s.pastRunsPints.add(s.lifetimePints);

/** Total mats your all-time pints are worth: ⌊∛(pints ÷ 1e12) × gain bonus⌋. */
export function matsWorth(allTime: Decimal, gain = 1): Decimal {
  if (allTime.lt(MAT_SCALE)) return D(0);
  return allTime.div(MAT_SCALE).cbrt().mul(gain).floor();
}

/** Mats you'd get by calling Last Orders right now. */
export function matsOnReset(s: GameState): Decimal {
  return Decimal.max(0, matsWorth(allTimePints(s), mods(s).matGain).sub(s.matsEarned));
}

/** All-time pints needed for your next mat (so the UI can say "next mat at …"). */
export function pintsForNextMat(s: GameState): Decimal {
  const gain = mods(s).matGain;
  const next = matsWorth(allTimePints(s), gain).add(1);
  // Invert ⌊∛(p/1e12)·g⌋ ≥ next  →  p ≥ (next/g)³ · 1e12
  return next.div(gain).pow(3).mul(MAT_SCALE);
}

/** Bonus to everything from unspent mats: 1 + rate × mats. */
export const matMult = (s: GameState): Decimal => s.beerMats.mul(mods(s).matRate).add(1);

/** Drinking upgrades kept by "Iron Liver". */
const isDrinkingUpgrade = (id: string) => UPGRADE_BY_ID.get(id)?.group === 'drinking';

/**
 * Ring the bell: bank this run's mats, start a fresh run, and apply the Licence's
 * head starts. Returns how many mats were earned.
 */
export function lastOrders(s: GameState, now = Date.now()): Decimal {
  const gained = matsOnReset(s);
  const m = mods(s);
  const keptBeer = Math.max(m.keepBeer, m.keepHalfBeers ? Math.floor(s.beer / 2) : 0, 0);
  const keptUpgrades = m.keepDrinking ? [...s.upgrades].filter(isDrinkingUpgrade) : [];

  s.pastRunsPints = allTimePints(s);
  s.matsEarned = s.matsEarned.add(gained);
  s.beerMats = s.beerMats.add(gained);
  s.prestiges++;
  // You stay on the Licence screen until you choose to go back to the pub, even across a reload.
  s.afterHours = true;

  // Everything that belongs to a single run starts again.
  const fresh = newGame(now);
  s.pints = D(m.startPints);
  s.lifetimePints = D(m.startPints);
  s.drinkers = { ...m.startDrinkers };
  s.upgrades = new Set(keptUpgrades);
  s.beer = Math.min(keptBeer, s.beer);
  s.pubs = fresh.pubs;
  s.pub = fresh.pub;
  s.pubReadyAt = 0;
  s.buffs = [];
  s.glassFill = 1;
  s.runStartedAt = now;
  s.debugPerDrinkMult = fresh.debugPerDrinkMult;
  invalidate();
  return gained;
}

export type LicenceStatus = 'owned' | 'available' | 'locked';

export function licenceStatus(s: GameState, id: string): LicenceStatus {
  if (s.licence.has(id)) return 'owned';
  const node = LICENCE_BY_ID.get(id);
  if (!node) return 'locked';
  return node.requires === null || s.licence.has(node.requires) ? 'available' : 'locked';
}

export function buyLicence(s: GameState, id: string): boolean {
  const node = LICENCE_BY_ID.get(id);
  if (!node || licenceStatus(s, id) !== 'available' || s.beerMats.lt(node.cost)) return false;
  s.beerMats = s.beerMats.sub(node.cost);
  s.licence.add(id);
  invalidate();
  return true;
}
