/**
 * Hold-to-drink state machine. Pure logic, no DOM, so it's easy to test.
 *
 *   resting ──hold──► lifting ──reach mouth──► drinking ──empty──► lowering+refilling
 *      ▲                 │ release                │ release              │
 *      └─────────────────┴────────────────────────┘                     │
 *      ◄─────────────────────────── full again ─────────────────────────┘
 *
 * Releasing early never loses progress: the glass just goes back down part-drunk.
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
}

export interface DrinkParams {
  drinkTime: number;
  refillTime: number;
  downInOne?: boolean;
}

const LIFT_TIME = 0.25; // seconds from bar to lips
const LOWER_TIME = 0.3;
const DRINK_FROM_LIFT = 0.85; // you can only drink once the glass is nearly at your mouth

export function newDrinkState(fill = 1): DrinkState {
  return { lift: 0, fill, refilling: fill <= 0, committed: false };
}

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
  if (!holding && !s.committed) {
    s.lift = Math.max(0, s.lift - dt / LOWER_TIME);
    return 0;
  }

  s.lift = Math.min(1, s.lift + dt / LIFT_TIME);
  if (s.lift < DRINK_FROM_LIFT) return 0;

  s.fill -= dt / p.drinkTime;
  if (s.fill > 0) return 0;

  s.fill = 0;
  s.refilling = true;
  s.committed = false;
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
