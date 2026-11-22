/**
 * Last Orders (DESIGN.md §6): reset the run for Beer Mats, which boost everything
 * and buy permanent Landlord's Licence nodes.
 */
import { LICENCE_BY_ID, type LicenceNode } from '../data/licence';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { DRINKERS } from '../data/drinkers';
import { invalidate, matBonus } from './economy';
import { mods } from './licenceState';
import { dealSpecials } from './nights';
import { MAT_SCALE, matsWorth } from './mats';
import { Decimal } from './num';
import { newGame, type GameState } from './state';

export { MAT_SCALE, matsWorth } from './mats';

/** Pints from every run, including this one. */
export const allTimePints = (s: GameState): Decimal => s.pastRunsPints.add(s.lifetimePints);


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

/** Bonus to everything from mats: 1 + rate × mats (the unspent ones, unless you own The Complete Set). */
export const matMult = (s: GameState): Decimal => matBonus(s);

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
  const keptUpgrades = m.keepUpgrades ? [...s.upgrades] : m.keepDrinking ? [...s.upgrades].filter(isDrinkingUpgrade) : [];
  const keptPubs = m.keepPubs ? { pubs: new Set(s.pubs), pub: s.pub } : null;

  // Never Go Home: some of the crowd is still there. Whip-Round: so is some of what you drank.
  const stayed: Record<string, number> = {};
  if (m.keepDrinkers > 0) {
    for (const [id, n] of Object.entries(s.drinkers)) if (n * m.keepDrinkers >= 1) stayed[id] = Math.floor(n * m.keepDrinkers);
  }
  const kitty = Decimal.max(m.startPints, s.lifetimePints.mul(m.whipRound).floor());

  s.pastRunsPints = allTimePints(s);
  s.matsEarned = s.matsEarned.add(gained);
  s.beerMats = s.beerMats.add(gained);
  s.prestiges++;
  // You stay on the Licence screen until you choose to go back to the pub, even across a reload.
  s.afterHours = true;

  // Everything that belongs to a single run starts again.
  const fresh = newGame(now);
  s.pints = kitty;
  s.lifetimePints = kitty;
  s.drinkers = { ...m.startDrinkers };
  for (const [id, n] of Object.entries(stayed)) s.drinkers[id] = Math.max(s.drinkers[id] ?? 0, n);
  if (m.startAll > 0) for (const d of DRINKERS) s.drinkers[d.id] = Math.max(s.drinkers[d.id] ?? 0, m.startAll);
  s.upgrades = new Set(keptUpgrades);
  s.beer = Math.min(keptBeer, s.beer);
  s.pubs = keptPubs?.pubs ?? fresh.pubs;
  s.pub = keptPubs?.pub ?? fresh.pub;
  s.pubReadyAt = 0;
  s.buffs = [];
  // Last night's special is over, a challenge not beaten by now is lost, and three new specials are laid out.
  s.challenge = null;
  dealSpecials(s);
  s.glassFill = 1;
  s.runStartedAt = now;
  s.debugPerDrinkMult = fresh.debugPerDrinkMult;
  invalidate();
  return gained;
}

/**
 * Legend in Your Sleep (a Black Hole Beer perk): buy whatever of the tree the mats will stretch
 * to, cheapest first, a handful at a time. Returns how many were bought.
 */
export function autoBuyLegend(s: GameState, most = 20): number {
  if (!mods(s).autoLegend) return 0;
  let bought = 0;
  while (bought < most) {
    let pick: LicenceNode | null = null;
    for (const node of LICENCE_BY_ID.values()) {
      if (licenceStatus(s, node.id) !== 'available') continue;
      if (!pick || licenceCost(s, node).lt(licenceCost(s, pick))) pick = node;
    }
    if (!pick || !buyLicence(s, pick.id)) break;
    bought++;
  }
  return bought;
}

export type LicenceStatus = 'owned' | 'available' | 'locked';

export function licenceStatus(s: GameState, id: string): LicenceStatus {
  if (s.licence.has(id)) return 'owned';
  const node = LICENCE_BY_ID.get(id);
  if (!node) return 'locked';
  return node.requires === null || s.licence.has(node.requires) ? 'available' : 'locked';
}

/** What a node costs this player: its price, or for a step of a long line with Spaghettification, the square root of it. */
export const licenceCost = (s: GameState, node: LicenceNode): Decimal =>
  node.rank && mods(s).sqrtLines ? node.cost.sqrt().ceil() : node.cost;

export function buyLicence(s: GameState, id: string): boolean {
  const node = LICENCE_BY_ID.get(id);
  if (!node || licenceStatus(s, id) !== 'available') return false;
  const cost = licenceCost(s, node);
  if (s.beerMats.lt(cost)) return false;
  s.beerMats = s.beerMats.sub(cost);
  s.licence.add(id);
  invalidate();
  return true;
}
