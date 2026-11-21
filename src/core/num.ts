/**
 * The one place the game touches the big-number library.
 * If we ever outgrow break_infinity (~1e9e15) we can swap to break_eternity here.
 *
 * Rules (see DESIGN.md §8.2):
 *  - every game quantity is a Decimal
 *  - never compare Decimals with < or >, use .lt()/.gte() etc.
 *  - saves store Decimals as strings
 */
import Decimal, { type DecimalSource } from 'break_infinity.js';

export { Decimal };
export type { DecimalSource };

export const D = (v: DecimalSource): Decimal => new Decimal(v);

/** Build a number too large to write as a string literal, e.g. big(1, 1e10) = 1e(1e10). */
export const big = (mantissa: number, exponent: number): Decimal =>
  Decimal.fromMantissaExponent(mantissa, exponent);

/** Parse an untrusted value (e.g. from a save) into a Decimal, falling back if it's broken. */
export function toDecimal(v: unknown, fallback: DecimalSource = 0): Decimal {
  if (v instanceof Decimal) return v;
  if (typeof v === 'number' || typeof v === 'string') {
    try {
      const d = new Decimal(v);
      if (Number.isFinite(d.mantissa) && Number.isFinite(d.exponent)) return d;
    } catch {
      /* fall through */
    }
  }
  return new Decimal(fallback);
}
