import { describe, expect, it } from 'vitest';
import { format, groupSuffix } from '../src/core/format';
import { big, D } from '../src/core/num';

describe('format: short names', () => {
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
    [1e33, '1.000 decillion'],
    [1e36, '1.000 UDc'],
    [1e63, '1.000 Vg'],
    [1.5e300, '1.500 NNg'],
  ])('%s → %s', (n, expected) => {
    expect(format(D(n), 'short')).toBe(expected);
  });

  it('carries rounding into the next group', () => {
    expect(format(D(999_999_999), 'short')).toBe('1.000 billion');
  });

  it('falls back to scientific past the named range', () => {
    expect(format(D('1e303'), 'short')).toBe('1.00e303');
    expect(format(D('4.2e5000'), 'short')).toBe('4.20e5,000');
  });

  it('knows its suffixes', () => {
    expect(groupSuffix(1)).toBe('thousand');
    expect(groupSuffix(11)).toBe('decillion');
    expect(groupSuffix(101)).toBeNull();
  });
});

describe('format: scientific and engineering', () => {
  it('scientific', () => {
    expect(format(D(1_234_567), 'scientific')).toBe('1.23e6');
    expect(format(D(9.999e8), 'scientific')).toBe('1.00e9');
    expect(format(D('1e100000'), 'scientific')).toBe('1.00e100,000');
  });

  it('engineering', () => {
    expect(format(D(1_234_567), 'engineering')).toBe('1.23e6');
    expect(format(D(12_345_678), 'engineering')).toBe('12.35e6');
    expect(format(D(999.999e6), 'engineering')).toBe('1.00e9');
  });

  it('small numbers are plain in every format', () => {
    expect(format(D(42), 'scientific')).toBe('42');
    expect(format(D(42), 'engineering')).toBe('42');
  });
});

describe('format: absurdly big numbers', () => {
  it('shows the exponent of the exponent', () => {
    expect(format(big(1, 1e10), 'short')).toBe('e1.00e10');
    expect(format(big(5, 123_456_789), 'scientific')).toBe('e1.23e8');
  });

  it('handles the top of the range', () => {
    expect(format(big(1, 9e15))).toBe('∞');
  });

  it('negative numbers', () => {
    expect(format(D(-2.5e6))).toBe('-2.500 million');
  });
});

describe('tidy numbers (prices and targets)', () => {
  it('drop trailing zeros from named numbers', () => {
    expect(format(D(1e8), 'short', true)).toBe('100 million');
    expect(format(D(1.5e9), 'short', true)).toBe('1.5 billion');
    expect(format(D(1_234_567), 'short', true)).toBe('1.235 million');
    expect(format(D(1e36), 'short', true)).toBe('1 UDc');
    expect(format(D(999_999_999), 'short', true)).toBe('1 billion');
  });

  it('leave everything else alone', () => {
    expect(format(D(1e8), 'short')).toBe('100.000 million');
    expect(format(D(12_345), 'short', true)).toBe('12,345');
    expect(format(D(1e8), 'scientific', true)).toBe('1.00e8');
  });
});
