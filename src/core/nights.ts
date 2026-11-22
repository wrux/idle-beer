/** Tonight's special and Challenge nights: choosing them, and knowing when a challenge is beaten. */
import { CHALLENGE_BY_ID, SPECIAL_BY_ID, SPECIALS, SPECIALS_OFFERED, type Challenge } from '../data/nights';
import { Decimal } from './num';
import type { GameState } from './state';

/** Lay out a fresh three for the morning after (and clear last night's). */
export function dealSpecials(s: GameState, rng: () => number = Math.random): void {
  const pool = SPECIALS.map((x) => x.id);
  const offer: string[] = [];
  while (offer.length < SPECIALS_OFFERED && pool.length) offer.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  s.specialOffer = offer;
  s.special = null;
}

/** Choose one of the three on offer. Only the morning after, before you go back to the pub. */
export function pickSpecial(s: GameState, id: string): boolean {
  if (!s.afterHours || !s.specialOffer.includes(id) || !SPECIAL_BY_ID.has(id)) return false;
  s.special = id;
  return true;
}

/** Take a challenge on for the night ahead (or `null` to back out). Only the morning after, and it lasts until Last Orders. */
export function pickChallenge(s: GameState, id: string | null): boolean {
  if (!s.afterHours) return false;
  if (id !== null && (!CHALLENGE_BY_ID.has(id) || s.challengesDone.has(id))) return false;
  s.challenge = id;
  // The goal is what you drink from here: pints you walked in with don't count.
  s.challengeBase = s.lifetimePints;
  return true;
}

/** Pints drunk towards the challenge you're on. */
export const challengeProgress = (s: GameState): Decimal => Decimal.max(0, s.lifetimePints.sub(s.challengeBase));

/** How far along tonight's challenge is, 0 to 1 (1 once it is beaten). */
export function challengeShare(s: GameState): number {
  const c = s.challenge ? CHALLENGE_BY_ID.get(s.challenge) : undefined;
  if (!c) return 0;
  return s.challengesDone.has(c.id) ? 1 : Math.min(1, challengeProgress(s).div(c.goal).toNumber());
}

/**
 * If tonight's challenge has just been beaten: bank the prize and say which it was. The handicap
 * stays until Last Orders. A night's rules don't change halfway through: with a big enough mat
 * bonus the goal can fall in seconds, and a handicap that vanished then looked like one that had
 * never worked.
 */
export function checkChallenge(s: GameState): Challenge | null {
  const c = s.challenge ? CHALLENGE_BY_ID.get(s.challenge) : undefined;
  if (!c || s.afterHours || s.challengesDone.has(c.id) || challengeProgress(s).lt(c.goal)) return null;
  s.challengesDone.add(c.id);
  return c;
}
