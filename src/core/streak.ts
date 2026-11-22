/**
 * Chug streak: finish pints back to back and each one counts for more, up to +50%.
 * "Back to back" means within a second of the fastest you physically could have.
 */

export const STREAK_SLACK = 1.0; // seconds of leeway on top of a full drink cycle
export const STREAK_STEP = 0.05; // +5% per pint in the streak
export const STREAK_MAX_STEPS = 10; // so +50% at most

export interface Streak {
  count: number;
  /** Game-clock time of the last finished pint. */
  lastFinish: number;
}

export const newStreak = (): Streak => ({ count: 0, lastFinish: -Infinity });

/** Seconds allowed between finishes before the streak breaks. */
export const streakWindow = (cycleSeconds: number, extraSlack = 0) => cycleSeconds + STREAK_SLACK + extraSlack;

/** Licence tweaks: a longer window and a higher cap. */
export interface StreakOptions {
  extraSlack?: number;
  maxSteps?: number;
  /** A broken streak drops to half, not to nothing. */
  halveOnBreak?: boolean;
}

/** Record a finished pint. Returns the multiplier that pint earns. */
export function registerFinish(s: Streak, now: number, cycleSeconds: number, opts: StreakOptions = {}): number {
  const unbroken = now - s.lastFinish <= streakWindow(cycleSeconds, opts.extraSlack);
  s.count = unbroken ? s.count + 1 : opts.halveOnBreak ? Math.max(1, Math.floor(s.count / 2)) : 1;
  s.lastFinish = now;
  return streakMult(s.count, opts.maxSteps);
}

export const streakMult = (count: number, maxSteps = STREAK_MAX_STEPS): number =>
  1 + STREAK_STEP * Math.min(Math.max(0, count - 1), maxSteps);

/** 0..1: how much of the window is left before the streak breaks (for the meter). */
export function streakRemaining(s: Streak, now: number, cycleSeconds: number, extraSlack = 0): number {
  if (s.count < 2) return 0;
  return Math.max(0, 1 - (now - s.lastFinish) / streakWindow(cycleSeconds, extraSlack));
}

/** Seconds for one full pint: lift to the lips, drain, put down, pour. */
export const drinkCycle = (drinkTime: number, refillTime: number): number => 0.25 * 0.85 + drinkTime + 0.3 + refillTime;
