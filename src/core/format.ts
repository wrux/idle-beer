import { Decimal } from './num';

export type NumberFormat = 'short' | 'scientific' | 'engineering';

/** Word names for 10^(3g), g = 0..11 (up to decillion). */
const NAMES = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion',
  'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion',
];
/** Abbreviations for undecillion (1e36) up to novenonagintillion (1e300). */
const UNITS = ['', 'U', 'D', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'O', 'N'];
const TENS = ['', 'Dc', 'Vg', 'Tg', 'Qag', 'Qig', 'Sxg', 'Spg', 'Og', 'Ng'];

/** Suffix for the group 10^(3g), or null if past the named range. */
export function groupSuffix(group: number): string | null {
  if (group < NAMES.length) return NAMES[group];
  const illion = group - 1; // 1e36 = group 12 = illion 11 = "UDc"
  if (illion >= 100) return null;
  return UNITS[illion % 10] + TENS[Math.floor(illion / 10)];
}

/** Below this, numbers are always shown in full ("123,456"). */
const PLAIN_LIMIT = 1e6;
/** Once the exponent itself is this big, show "e1.23e9". */
const HUGE_EXPONENT = 1e6;

// One shared formatter: toLocaleString() builds a new one on every call, which is ~25× slower.
const GROUPED = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const grouped = (n: number) => GROUPED.format(Math.floor(n));

function formatSmall(n: number): string {
  if (n >= 1000) return grouped(n);
  if (Number.isInteger(n)) return String(n);
  // 0.1 / 12.5 style: one decimal, dropped when it rounds to .0
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Round mantissa m (with exponent e) to `places`, carrying into the exponent on overflow. */
function roundCarry(m: number, e: number, places: number, step: number): [number, number] {
  const limit = Math.pow(10, step);
  let r = Number(m.toFixed(places));
  if (r >= limit) {
    r = Number((r / limit).toFixed(places));
    e += step;
  }
  return [r, e];
}

function formatExponent(e: number): string {
  if (e < HUGE_EXPONENT) return grouped(e);
  // e is a plain JS number (break_infinity caps it at 9e15)
  const x = Math.floor(Math.log10(e));
  const [m, x2] = roundCarry(e / Math.pow(10, x), x, 2, 1);
  return `${m.toFixed(2)}e${x2}`;
}

export function format(value: Decimal, fmt: NumberFormat = 'short'): string {
  if (Number.isNaN(value.mantissa) || Number.isNaN(value.exponent)) return 'NaN';
  if (value.sign() < 0) return '-' + format(value.neg(), fmt);
  if (value.exponent >= 9e15) return '∞';
  if (value.lt(PLAIN_LIMIT)) return formatSmall(value.toNumber());

  const e = value.exponent;
  const m = value.mantissa;

  // Exponent so large the mantissa is meaningless: just show the order of magnitude.
  if (e >= HUGE_EXPONENT) return 'e' + formatExponent(e);

  if (fmt === 'short') {
    const group = Math.floor(e / 3);
    const scaled = m * Math.pow(10, e - group * 3);
    const [r, e2] = roundCarry(scaled, group * 3, 3, 3);
    const suffix = groupSuffix(e2 / 3);
    if (suffix !== null) return `${r.toFixed(3)} ${suffix}`;
    // fall through to scientific past centillion
  }

  if (fmt === 'engineering') {
    const e3 = Math.floor(e / 3) * 3;
    const [r, e2] = roundCarry(m * Math.pow(10, e - e3), e3, 2, 3);
    return `${r.toFixed(2)}e${formatExponent(e2)}`;
  }

  const [r, e2] = roundCarry(m, e, 2, 1);
  return `${r.toFixed(2)}e${formatExponent(e2)}`;
}

/** "1 pint" / "2 pints" / "1.234 million pints". */
export function pintsWord(value: Decimal): string {
  return value.eq(1) ? 'pint' : 'pints';
}
