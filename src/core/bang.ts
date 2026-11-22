/**
 * The Big Bang (DESIGN.md §6): the layer above Last Orders. Drink 1e100 pints in a single night
 * and there is no beer left anywhere; the universe falls in, starts again, and leaves you a
 * Black Hole Beer or two to spend on the perks in data/bang.ts.
 */
import { VOID_BY_ID } from '../data/bang';
import { BEERS } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { invalidate } from './economy';
import { mods } from './licenceState';
import { D, Decimal } from './num';
import { newGame, type GameState } from './state';

/** The universe lasting under this many seconds of play earns one more Black Hole Beer… */
export const QUICK_UNIVERSE = 2 * 3600;
/** …and under this many, another. */
export const QUICKER_UNIVERSE = 20 * 60;

/** A stopwatch reading: "0:42", "12:05", "3:07:09". */
export function stopwatch(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Pints to drink in one night for the universe to run dry. */
export const bangGoal = (s: GameState): Decimal => D(10).pow(mods(s).bangGoal);

export const canBang = (s: GameState): boolean => !s.afterHours && !s.finale && s.lifetimePints.gte(bangGoal(s));

/** Black Hole Beers a Big Bang would leave right now: one, more with perks, more for being quick. */
export function bangReward(s: GameState): number {
  return 1 + mods(s).bangBonus + (s.universeSeconds < QUICK_UNIVERSE ? 1 : 0) + (s.universeSeconds < QUICKER_UNIVERSE ? 1 : 0);
}

/**
 * End the universe. Everything a Last Orders takes goes, and so do Beer Mats and your legend.
 * Achievements, stats, challenge prizes and Black Hole Beers stay. Returns how many were gained
 * (0 if the universe isn't dry yet).
 */
export function bigBang(s: GameState, now = Date.now()): number {
  if (!canBang(s)) return 0;
  const gained = bangReward(s);
  s.voidBeers += gained;
  s.voidEarned += gained;
  s.bangs++;
  // You come round on the Big Bang screen, and stay there (across a reload too) until you close it.
  s.voidOpen = true;
  // Every universe is the same race to the same 1e100 (or whatever Small Universe makes it): keep the best time.
  if (s.fastestUniverse <= 0 || s.universeSeconds < s.fastestUniverse) s.fastestUniverse = s.universeSeconds;
  s.universeSeconds = 0;

  emptyUniverse(s, now);
  headStarts(s);
  return gained;
}

/** A universe with nothing in it: no pints, no mats, no legend, the first beer, the first pub. */
function emptyUniverse(s: GameState, now: number): void {
  const fresh = newGame(now);
  s.pints = fresh.pints;
  s.lifetimePints = fresh.lifetimePints;
  s.pastRunsPints = fresh.pastRunsPints;
  s.beerMats = fresh.beerMats;
  s.matsEarned = fresh.matsEarned;
  s.licence = new Set();
  s.drinkers = {};
  s.upgrades = fresh.upgrades;
  s.beer = 0;
  s.pubs = fresh.pubs;
  s.pub = fresh.pub;
  s.pubReadyAt = 0;
  s.buffs = [];
  s.special = null;
  s.specialOffer = [];
  s.challenge = null;
  s.challengeBase = fresh.challengeBase;
  s.afterHours = false;
  s.glassFill = 1;
  s.runStartedAt = now;
  s.debugPerDrinkMult = fresh.debugPerDrinkMult;
  invalidate();
}

/** The head starts that apply to a new universe: what Black Hole Beers bought. */
function headStarts(s: GameState): void {
  const m = mods(s);
  s.pints = D(m.startPints);
  s.lifetimePints = D(m.startPints);
  s.drinkers = { ...m.startDrinkers };
  if (m.startAll > 0) for (const d of DRINKERS) s.drinkers[d.id] = Math.max(s.drinkers[d.id] ?? 0, m.startAll);
  invalidate();
}

// ---------- the end ----------

/** The perk that ends the game. */
export const LAST_PINT = 'last-pint';

/** You own The Last Pint of All and haven't yet drunk it. */
export const finaleDue = (s: GameState): boolean => s.voidTree.has(LAST_PINT) && !s.finished && !s.finale;

/**
 * The last universe. There is nothing in it but you, the pub and one pint: The Final Pint, the
 * last beer on the list. Nobody else comes in and nothing can be bought. Returns false if it
 * isn't time (the perk isn't owned, or this has all happened already).
 */
export function startFinale(s: GameState, now = Date.now()): boolean {
  if (!finaleDue(s)) return false;
  emptyUniverse(s, now);
  s.voidOpen = false;
  s.universeSeconds = 0;
  s.beer = BEERS.length - 1;
  s.finale = true;
  invalidate();
  return true;
}

/**
 * The last pint has been drunk, by hand. That is the end of the game. Whoever wants to carry on
 * finds an ordinary new universe waiting, with everything Black Hole Beers bought.
 */
export function finishGame(s: GameState): boolean {
  if (!s.finale) return false;
  s.finale = false;
  s.finished = true;
  s.drinks++;
  s.beer = 0;
  headStarts(s);
  return true;
}

export type VoidStatus = 'owned' | 'available' | 'locked';

export function voidStatus(s: GameState, id: string): VoidStatus {
  if (s.voidTree.has(id)) return 'owned';
  const node = VOID_BY_ID.get(id);
  return node && node.requires.every((r) => s.voidTree.has(r)) ? 'available' : 'locked';
}

export function buyVoid(s: GameState, id: string): boolean {
  const node = VOID_BY_ID.get(id);
  if (!node || voidStatus(s, id) !== 'available' || s.voidBeers < node.cost) return false;
  s.voidBeers -= node.cost;
  s.voidTree.add(id);
  invalidate();
  return true;
}

/**
 * No More Mornings: the mats a Last Orders would pay are simply yours, as you go. Call now and
 * then (the game does, once a second). Returns true if any arrived.
 */
export function collectLiveMats(s: GameState, pending: Decimal): boolean {
  if (!mods(s).liveMats || pending.lte(0)) return false;
  s.beerMats = s.beerMats.add(pending);
  s.matsEarned = s.matsEarned.add(pending);
  invalidate();
  return true;
}
