/** How pints turn into Beer Mats. On its own so the economy and Last Orders can both use it. */
import { D, Decimal } from './num';

/** Lifetime pints for the first Beer Mat. */
export const MAT_SCALE = D(1e10);

/** Total mats your all-time pints are worth: ⌊∛(pints ÷ 1e12) × gain bonus⌋. */
export function matsWorth(allTime: Decimal, gain = 1): Decimal {
  if (allTime.lt(MAT_SCALE)) return D(0);
  return allTime.div(MAT_SCALE).cbrt().mul(gain).floor();
}

/** The first this-many mats each give their full bonus… */
export const MAT_FULL = 20;
/** …and past that a pile of mats is worth this power of its size (×10 the mats is ×2.5 the bonus). */
export const MAT_FADE = 0.2;

/**
 * How many mats a pile counts as, for the bonus. Up to a hundred, every one counts. After that
 * each is worth less than the one before: without this, a few thousand mats multiplied income a
 * few thousand times, and every beer from 1e20 to 1e60 went by in under ten minutes.
 */
export function matsCounted(mats: Decimal): Decimal {
  if (mats.lte(MAT_FULL)) return mats;
  return mats.div(MAT_FULL).pow(MAT_FADE).mul(MAT_FULL);
}

/** The bonus to everything from a pile of mats at a given rate (0.01 = +1% for each one that counts). */
export const matBonusOf = (mats: Decimal, rate: number): Decimal => matsCounted(mats).mul(rate).add(1);
