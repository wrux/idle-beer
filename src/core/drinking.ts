/**
 * Hold-to-drink state machine. Pure logic, no DOM, so it's easy to test.
 *
 *   resting ──hold──► lifting ──reach mouth──► drinking ──empty──► lowering+refilling
 *      ▲                 │ release                │ release              │
 *      └─────────────────┴────────────────────────┘                     │
 *      ◄─────────────────────────── full again ─────────────────────────┘
 *
 * Releasing early never loses progress: the glass just goes back down part-drunk.
 *
 * Left alone, he drinks on his own too, just much more slowly: every few seconds he lifts
 * the glass for a slow sip of about a quarter of the pint, then puts it back down. Holding
 * (or Down in One) takes over straight away.
 */

export interface DrinkState {
  /** 0 = on the bar, 1 = at your lips. */
  lift: number;
  /** 0 = empty, 1 = full. */
  fill: number;
  /** True while a fresh pint is being poured. */
  refilling: boolean;
  /** With Down in One: a click commits to finishing the pint even if you let go. */
  committed: boolean;
  /** How much of the pint is left in his current sip on his own (0 = not sipping). */
  autoSip: number;
  /** Seconds until he takes his next sip on his own. */
  autoWait: number;
  /** Whether the last pint he finished was drunk on his own. */
  lastFinishAuto: boolean;
}

export interface DrinkParams {
  drinkTime: number;
  refillTime: number;
  downInOne?: boolean;
  /** Let him sip on his own when you're not holding. */
  auto?: boolean;
  /** On his own he drinks as you would: the whole pint, at full speed, with no wait between. */
  autoFull?: boolean;
}

const LIFT_TIME = 0.25; // seconds from bar to lips
const LOWER_TIME = 0.3;
const DRINK_FROM_LIFT = 0.85; // you can only drink once the glass is nearly at your mouth

/** Sipping on his own: this many times slower than when you hold… */
export const AUTO_SLOWDOWN = 4;
/** …a quarter of a pint per sip… */
export const AUTO_SIP = 0.25;
/** …with this long between sips. */
export const AUTO_PAUSE = 2.5;

export function newDrinkState(fill = 1): DrinkState {
  return { lift: 0, fill, refilling: fill <= 0, committed: false, autoSip: 0, autoWait: AUTO_PAUSE, lastFinishAuto: false };
}

/** Seconds per pint when he's left to drink on his own (for pacing maths). */
export const autoCycleSeconds = (drinkTime: number, refillTime: number): number =>
  (LIFT_TIME * DRINK_FROM_LIFT + AUTO_SIP * drinkTime * AUTO_SLOWDOWN + LOWER_TIME + AUTO_PAUSE) / AUTO_SIP + refillTime;

/** Advance by dt seconds. Returns how many pints were finished this step (0 or 1). */
export function stepDrink(s: DrinkState, dt: number, holding: boolean, p: DrinkParams): number {
  if (s.refilling) {
    s.lift = Math.max(0, s.lift - dt / LOWER_TIME);
    if (s.lift === 0) {
      s.fill = Math.min(1, s.fill + dt / p.refillTime);
      if (s.fill >= 1) s.refilling = false;
    }
    return 0;
  }

  if (holding && p.downInOne) s.committed = true;
  const manual = holding || s.committed;

  if (manual) {
    // You're in charge: drop any sip he was taking, and wait a bit before he starts again.
    s.autoSip = 0;
    s.autoWait = AUTO_PAUSE;
  } else if (p.auto && p.autoFull && s.autoSip <= 0) {
    s.autoSip = s.fill;
  } else if (p.auto && s.autoSip <= 0) {
    s.autoWait -= dt;
    if (s.autoWait <= 0) {
      s.autoSip = Math.min(AUTO_SIP, s.fill);
      s.autoWait = AUTO_PAUSE;
    }
  }
  const auto = !manual && !!p.auto && s.autoSip > 0;

  if (!manual && !auto) {
    s.lift = Math.max(0, s.lift - dt / LOWER_TIME);
    return 0;
  }

  s.lift = Math.min(1, s.lift + dt / LIFT_TIME);
  if (s.lift < DRINK_FROM_LIFT) return 0;

  const drunk = dt / (p.drinkTime * (auto && !p.autoFull ? AUTO_SLOWDOWN : 1));
  s.fill -= drunk;
  if (auto) s.autoSip -= drunk;
  if (s.fill > 1e-9) return 0;

  s.fill = 0;
  s.refilling = true;
  s.committed = false;
  s.autoSip = 0;
  s.lastFinishAuto = auto;
  return 1;
}

/** Smoothed lift for animation. */
export const easeLift = (lift: number) => lift * lift * (3 - 2 * lift);

/**
 * How far the glass is tipped, in radians. You tip it further as it empties,
 * like a real pint: ~15° when full, ~105° for the last drop.
 */
export function tiltFor(s: DrinkState): number {
  const deg = easeLift(s.lift) * (15 + 90 * (1 - s.fill));
  return (deg * Math.PI) / 180;
}

/** Foam thickness as a fraction of the glass height. Extra head while pouring. */
export function foamFor(s: DrinkState): number {
  const base = s.refilling ? 0.16 : 0.05 + 0.05 * s.fill;
  return base * Math.min(1, s.fill * 6);
}
