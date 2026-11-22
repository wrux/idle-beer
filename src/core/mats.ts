/** How pints turn into Beer Mats. On its own so the economy and Last Orders can both use it. */
import { D, Decimal } from './num';

/** Lifetime pints for the first Beer Mat. */
export const MAT_SCALE = D(1e12);

/** Total mats your all-time pints are worth: ⌊∛(pints ÷ 1e12) × gain bonus⌋. */
export function matsWorth(allTime: Decimal, gain = 1): Decimal {
  if (allTime.lt(MAT_SCALE)) return D(0);
  return allTime.div(MAT_SCALE).cbrt().mul(gain).floor();
}
