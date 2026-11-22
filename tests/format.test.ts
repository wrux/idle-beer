import { describe, expect, it } from 'vitest';
import { format, formatBrief, groupSuffix } from '../src/core/format';
import { big, D } from '../src/core/num';

describe('format: names up to quintillion', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [0.1, '0.1'],
    [12.5, '12.5'],
    [999, '999'],
    [1234, '1,234'],
    [999_999, '999,999'],
    [1e6, '1.000 million'],
    [1_234_567, '1.235 million'],
    [45.6e9, '45.600 billion'],
    [1e18, '1.000 quintillion'],
    [999.9e18, '999.900 quintillion'],
  ])('%s → %s', (n, expected) => {
    expect(format(D(n))).toBe(expected);
  });

  it('carries rounding into the next group', () => {
    expect(format(D(999_999_999))).toBe('1.000 billion');
  });

  it('knows its names, and where they stop', () => {
    expect(groupSuffix(1)).toBe('thousand');
    expect(groupSuffix(6)).toBe('quintillion');
    expect(groupSuffix(7)).toBeNull();
  });
});

describe('format: scientific from a sextillion up', () => {
  it.each([
    [1e21, '1.00e21'],
    [1.234e27, '1.23e27'],
    [9.999e32, '1.00e33'],
    ['1e303', '1.00e303'],
    ['4.2e5000', '4.20e5,000'],
    ['1e100000', '1.00e100,000'],
  ])('%s → %s', (n, expected) => {
    expect(format(D(n))).toBe(expected);
  });

  it('a quintillion that rounds up to a thousand of them goes scientific, not to a name that is not there', () => {
    expect(format(D(999.9996e18))).toBe('1.00e21');
  });
});

describe('format: absurdly big numbers', () => {
  it('shows the exponent of the exponent', () => {
    expect(format(big(1, 1e10))).toBe('e1.00e10');
    expect(format(big(5, 123_456_789))).toBe('e1.23e8');
  });

  it('handles the top of the range', () => {
    expect(format(big(1, 9e15))).toBe('∞');
  });

  it('negative numbers', () => {
    expect(format(D(-2.5e6))).toBe('-2.500 million');
    expect(format(D(-2.5e30))).toBe('-2.50e30');
  });
});

describe('tidy numbers (prices and targets)', () => {
  it('drop trailing zeros from named and scientific numbers', () => {
    expect(format(D(1e8), true)).toBe('100 million');
    expect(format(D(1.5e9), true)).toBe('1.5 billion');
    expect(format(D(1_234_567), true)).toBe('1.235 million');
    expect(format(D(999_999_999), true)).toBe('1 billion');
    expect(format(D(1e36), true)).toBe('1e36');
    expect(format(D(2.5e59), true)).toBe('2.5e59');
    expect(format(D('1e1000'), true)).toBe('1e1,000');
  });

  it('leave everything else alone', () => {
    expect(format(D(1e8))).toBe('100.000 million');
    expect(format(D(12_345), true)).toBe('12,345');
  });
});

describe('formatBrief: the same number in less room', () => {
  it.each([
    [999_999, '999,999'],
    [1_234_567, '1.23 M'],
    [45.6e9, '45.60 B'],
    [1.243e18, '1.24 Qi'],
    [1.243e27, '1.24e27'],
    [999.996e18, '1.00e21'],
  ])('%s → %s', (n, expected) => {
    expect(formatBrief(D(n))).toBe(expected);
  });
});
