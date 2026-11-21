/**
 * Free Round! events (DESIGN.md §7): a golden pint shows up now and then; clicking it
 * gives a random reward. Timed rewards live in state.buffs.
 */
import { mods } from './licenceState';
import { Decimal } from './num';
import type { GameState } from './state';

export type BuffKind = 'happyHour' | 'downIt' | 'quizWin';

export interface Buff {
  kind: BuffKind;
  /** Seconds left. */
  remaining: number;
}

export const BUFFS: Record<BuffKind, { name: string; icon: string; duration: number; desc: string }> = {
  happyHour: { name: 'Happy Hour', icon: '🍻', duration: 77, desc: 'Drinkers drink 7× as much' },
  downIt: { name: 'Down It!', icon: '⚡', duration: 13, desc: 'Each pint you drink counts 777×' },
  quizWin: { name: 'Pub Quiz Win', icon: '🧠', duration: 30, desc: 'Drinkers are 25% cheaper' },
};

export const HAPPY_HOUR_MULT = 7;
export const DOWN_IT_MULT = 777;
export const QUIZ_DISCOUNT = 0.75;

/** How long a golden pint stays on screen, and how often one turns up. */
export const FREE_ROUND_LIFETIME = 12;
export const FREE_ROUND_MIN_GAP = 180;
export const FREE_ROUND_MAX_GAP = 480;

export type Outcome = { kind: 'buff'; buff: BuffKind } | { kind: 'lucky'; amount: Decimal };

export const hasBuff = (s: GameState, kind: BuffKind): boolean => s.buffs.some((b) => b.kind === kind);

/** Lucky Round: 15% of your pints or 15 minutes of drinking, whichever is smaller, plus 13 for luck. */
export function luckyAmount(s: GameState, pps: Decimal): Decimal {
  return Decimal.min(s.pints.mul(0.15), pps.mul(900)).add(13).mul(mods(s).luckyMult);
}

/** Pick a reward. Weights: Happy Hour 45, Lucky 40, Down It! 10, Pub Quiz 5. Buffs never stack with themselves. */
export function rollFreeRound(s: GameState, pps: Decimal, rng: () => number = Math.random): Outcome {
  const table: [Outcome['kind'] | BuffKind, number][] = [
    ['happyHour', 45], ['lucky', 40], ['downIt', 10], ['quizWin', 5],
  ];
  const options = table.filter(([k]) => k === 'lucky' || !hasBuff(s, k as BuffKind));
  const total = options.reduce((t, [, w]) => t + w, 0);
  let r = rng() * total;
  for (const [k, w] of options) {
    r -= w;
    if (r < 0) return k === 'lucky' ? { kind: 'lucky', amount: luckyAmount(s, pps) } : { kind: 'buff', buff: k as BuffKind };
  }
  return { kind: 'lucky', amount: luckyAmount(s, pps) };
}

/** How long a buff lasts for this player (the Charm branch stretches them). */
export const buffDuration = (s: GameState, kind: BuffKind): number => BUFFS[kind].duration * mods(s).buffDuration;

export function startBuff(s: GameState, kind: BuffKind): void {
  s.buffs = s.buffs.filter((b) => b.kind !== kind);
  s.buffs.push({ kind, remaining: buffDuration(s, kind) });
}

/** Count buffs down. Returns true if any ran out (so multipliers need recalculating). */
export function tickBuffs(s: GameState, dt: number): boolean {
  if (!s.buffs.length) return false;
  for (const b of s.buffs) b.remaining -= dt;
  const before = s.buffs.length;
  s.buffs = s.buffs.filter((b) => b.remaining > 0);
  return s.buffs.length !== before;
}

/** Seconds until the next golden pint. */
export const nextFreeRoundIn = (s: GameState, rng: () => number = Math.random): number =>
  (FREE_ROUND_MIN_GAP + rng() * (FREE_ROUND_MAX_GAP - FREE_ROUND_MIN_GAP)) * mods(s).freeRoundGap;

/** How long a golden pint stays on screen for this player. */
export const freeRoundLifetime = (s: GameState): number => FREE_ROUND_LIFETIME * mods(s).freeRoundLifetime;

