import { Decimal } from './num';

/**
 * Word names for 10^(3g), g = 0..6. They stop at quintillion on purpose: past that the names are
 * ones nobody can place ("is a septillion more than an octillion?") and the made-up abbreviations
 * beyond decillion ("QaDc", "SpTg") were worse, so from 1e21 a number is written 1.23e21.
 */
const NAMES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];

/** Suffix for the group 10^(3g), or null if past the named range. */
export function groupSuffix(group: number): string | null {
  return group < NAMES.length ? NAMES[group] : null;
}

/** Below this, numbers are always shown in full ("123,456"). */
const PLAIN_LIMIT = 1e6;
/** Once the exponent itself is this big, show "e1.23e9". */
const HUGE_EXPONENT = 1e6;

// Shared formatters: toLocaleString() builds a new one on every call, which is ~25× slower.
// They follow the language the game is being played in (see setNumberLocale).
let lang = 'en-GB';
let english = true;
let GROUPED = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
let SMALL = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
let FIXED: Intl.NumberFormat[] = [];
let TRIMMED = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, useGrouping: false });
let COMPACT: Intl.NumberFormat | null = null;
let COMPACT_TIDY: Intl.NumberFormat | null = null;
let COMPACT_BRIEF: Intl.NumberFormat | null = null;
const grouped = (n: number) => GROUPED.format(Math.floor(n));
/** A number to exactly `places` decimals, with the language's own decimal mark. */
const fixed = (n: number, places: number) =>
  (FIXED[places] ??= new Intl.NumberFormat(lang, { minimumFractionDigits: places, maximumFractionDigits: places, useGrouping: false })).format(n);

/**
 * Show numbers the way a language writes them: its digit grouping and decimal mark, and its own
 * words for big numbers ("1,234 Millionen", "123.4万"). English has names up to quintillion; other
 * languages use what Intl knows, which runs out around a quadrillion. After that, everyone gets
 * scientific notation.
 */
export function setNumberLocale(tag: string): void {
  lang = tag;
  english = tag.toLowerCase().startsWith('en');
  GROUPED = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
  SMALL = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  FIXED = [];
  TRIMMED = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, useGrouping: false });
  COMPACT = english ? null : new Intl.NumberFormat(lang, { notation: 'compact', compactDisplay: 'long', minimumFractionDigits: 3, maximumFractionDigits: 3 });
  COMPACT_TIDY = english ? null : new Intl.NumberFormat(lang, { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 3 });
  COMPACT_BRIEF = english ? null : new Intl.NumberFormat(lang, { notation: 'compact', compactDisplay: 'short', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** How far Intl's own big-number words go before it starts writing "1000 trillion". */
const COMPACT_LIMIT = 1e15;

function formatSmall(n: number): string {
  if (n >= 1000) return grouped(n);
  if (Number.isInteger(n)) return english ? String(n) : GROUPED.format(n);
  // 0.1 / 12.5 style: one decimal, dropped when it rounds to .0
  return SMALL.format(n);
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
  return `${fixed(m, 2)}e${x2}`;
}

/**
 * Format a number for display. There is one way numbers are written, not a setting for it:
 * in full up to a million, then named ("1.500 million") as far as the names go, then scientific
 * ("1.50e21"), then just the size of the exponent ("e1.23e9").
 *
 * Named and scientific numbers keep their decimals ("1.500 million", "1.50e21") so a counter
 * that's changing doesn't jiggle in width. Pass `tidy` for numbers that sit still (prices,
 * targets) to drop the trailing zeros: "100 million", "1.5 billion", "1e21".
 */
export function format(value: Decimal, tidy = false): string {
  if (Number.isNaN(value.mantissa) || Number.isNaN(value.exponent)) return 'NaN';
  if (value.sign() < 0) return '-' + format(value.neg(), tidy);
  if (value.exponent >= 9e15) return '∞';
  if (value.lt(PLAIN_LIMIT)) return formatSmall(value.toNumber());

  const e = value.exponent;
  const m = value.mantissa;

  // Exponent so large the mantissa is meaningless: just show the order of magnitude.
  if (e >= HUGE_EXPONENT) return 'e' + formatExponent(e);

  if (COMPACT) {
    // Another language's own words for it, as far as they go; then scientific below.
    if (e < 15) {
      const n = value.toNumber();
      if (n < COMPACT_LIMIT) return (tidy ? COMPACT_TIDY! : COMPACT).format(n);
    }
  } else {
    const group = Math.floor(e / 3);
    const scaled = m * Math.pow(10, e - group * 3);
    const [r, e2] = roundCarry(scaled, group * 3, 3, 3);
    const suffix = groupSuffix(e2 / 3);
    if (suffix !== null) return `${tidy ? String(Number(r.toFixed(3))) : r.toFixed(3)} ${suffix}`;
    // fall through to scientific past quintillion
  }

  return scientific(m, e, tidy);
}

/** "1.23e45": two decimals, in the language's own decimal mark. */
function scientific(m: number, e: number, tidy = false): string {
  const [r, e2] = roundCarry(m, e, 2, 1);
  return `${tidy ? TRIMMED.format(r) : fixed(r, 2)}e${formatExponent(e2)}`;
}

/** One or two letters for 10^(3g), g = 1..6, where there is no room for the word. */
const BRIEF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/**
 * The same number in as few characters as it will go: "1.24 Qa" for "1.243 quadrillion". For a
 * counter on a small screen, where the full figure is a tap away. Only the named numbers get
 * shorter: scientific is as short as it comes already.
 */
export function formatBrief(value: Decimal): string {
  const e = value.exponent;
  if (Number.isNaN(value.mantissa) || Number.isNaN(e) || value.sign() < 0) return format(value);
  if (e >= HUGE_EXPONENT || value.lt(PLAIN_LIMIT)) return format(value);
  if (COMPACT_BRIEF) {
    if (e < 15) {
      const n = value.toNumber();
      if (n < COMPACT_LIMIT) return COMPACT_BRIEF.format(n);
    }
    return format(value);
  }
  const group = Math.floor(e / 3);
  const [r, e2] = roundCarry(value.mantissa * Math.pow(10, e - group * 3), group * 3, 2, 3);
  const g = e2 / 3;
  // Rounded to two places, 999.996 quintillion is a thousand of them, and there is no name for that.
  return g < BRIEF.length ? `${r.toFixed(2)} ${BRIEF[g]}` : scientific(value.mantissa, e);
}

/** "1 pint" / "2 pints" / "1.234 million pints". */
export function pintsWord(value: Decimal): string {
  return value.eq(1) ? 'pint' : 'pints';
}
