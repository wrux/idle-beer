import { describe, expect, it } from 'vitest';
import {
  buyDrinker, costOf, maxAffordable, offlineGain, OFFLINE_CAP_SECONDS, storeVisibility, totalPps,
} from '../src/core/economy';
import { big, D } from '../src/core/num';
import { newGame } from '../src/core/state';
import { DRINKERS, DRINKER_BY_ID } from '../src/data/drinkers';

const regular = DRINKER_BY_ID.get('regular')!;
const student = DRINKER_BY_ID.get('student')!;

describe('drinker costs', () => {
  it('first one costs the base price, then grows 15% each', () => {
    expect(costOf(regular, 0, 1).toNumber()).toBeCloseTo(10);
    expect(costOf(regular, 1, 1).toNumber()).toBe(12); // 11.5, rounded up
    expect(costOf(regular, 10, 1).toNumber()).toBe(Math.ceil(10 * 1.15 ** 10));
  });

  it('buying 10 at once costs the same as buying them one by one', () => {
    // Compare unrounded: whole-pint rounding is applied once to the total.
    let oneByOne = 0;
    for (let i = 0; i < 10; i++) oneByOne += 100 * 1.15 ** (5 + i);
    expect(costOf(student, 5, 10).toNumber()).toBe(Math.ceil(oneByOne));
  });

  it('every tier is pricier and stronger than the last', () => {
    for (let i = 1; i < DRINKERS.length; i++) {
      expect(DRINKERS[i].baseCost.gt(DRINKERS[i - 1].baseCost)).toBe(true);
      expect(DRINKERS[i].basePps.gt(DRINKERS[i - 1].basePps)).toBe(true);
    }
  });
});

describe('max affordable', () => {
  it('is zero when you cannot afford one', () => {
    expect(maxAffordable(regular, 0, D(9))).toBe(0);
  });

  it('is exact at the boundary', () => {
    const exactlyFive = costOf(regular, 3, 5);
    expect(maxAffordable(regular, 3, exactlyFive)).toBe(5);
    expect(maxAffordable(regular, 3, exactlyFive.mul(0.9999))).toBe(4);
  });

  it('never returns more than you can pay for', () => {
    for (const funds of ['1e3', '1e7', '1e50', '1e300', '1e5000']) {
      const n = maxAffordable(student, 7, D(funds));
      expect(costOf(student, 7, n).lte(D(funds))).toBe(true);
      expect(costOf(student, 7, n + 1).gt(D(funds))).toBe(true);
    }
  });

  it('is instant for absurd amounts of pints', () => {
    const start = performance.now();
    const n = maxAffordable(regular, 0, big(1, 1e10));
    expect(performance.now() - start).toBeLessThan(50);
    // log_1.15(1e(1e10)) ≈ 1.65e11
    expect(n).toBeGreaterThan(1.6e11);
    expect(n).toBeLessThan(1.7e11);
  });
});

describe('buying', () => {
  it('spends pints and adds drinkers', () => {
    const s = newGame();
    s.pints = D(100);
    expect(buyDrinker(s, 'regular', 1)).toBe(1);
    expect(s.drinkers.regular).toBe(1);
    expect(s.pints.toNumber()).toBe(90);
  });

  it('refuses a bulk buy you cannot afford in full', () => {
    const s = newGame();
    s.pints = D(50);
    expect(buyDrinker(s, 'regular', 10)).toBe(0);
    expect(s.pints.eq(50)).toBe(true);
  });

  it('max buys as many as possible and updates PPS', () => {
    const s = newGame();
    s.pints = D(1000);
    const n = buyDrinker(s, 'regular', 'max');
    expect(n).toBe(maxAffordable(regular, 0, D(1000)));
    expect(s.pints.gte(0)).toBe(true);
    expect(totalPps(s).toNumber()).toBeCloseTo(0.1 * n);
  });

  it('max at e(1e10) pints works without breaking anything', () => {
    const s = newGame();
    s.pints = big(1, 1e10);
    const n = buyDrinker(s, 'multiverse', 'max');
    expect(n).toBeGreaterThan(1e11);
    expect(s.pints.gte(0)).toBe(true);
    expect(Number.isFinite(totalPps(s).exponent)).toBe(true);
  });
});

describe('production', () => {
  it('adds up every drinker type', () => {
    const s = newGame();
    s.drinkers = { regular: 10, student: 2 };
    expect(totalPps(s).toNumber()).toBeCloseTo(10 * 0.1 + 2 * 1);
  });

  it('offline progress is half rate and capped at an hour', () => {
    const s = newGame();
    s.drinkers = { student: 1 }; // 1 pint/s
    expect(offlineGain(s, 600).pints.toNumber()).toBeCloseTo(300);
    const long = offlineGain(s, 10 * 60 * 60);
    expect(long.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(long.pints.toNumber()).toBeCloseTo(OFFLINE_CAP_SECONDS * 0.5);
  });
});

describe('store visibility', () => {
  it('starts with the Regular shown and the Student as a mystery', () => {
    const v = storeVisibility(newGame());
    expect(v[0]).toBe('shown');
    expect(v[1]).toBe('mystery');
    expect(v.slice(2).every((x) => x === 'hidden')).toBe(true);
  });

  it('reveals drinkers as lifetime pints approach their price', () => {
    const s = newGame();
    s.lifetimePints = D(600); // over half the Darts Team's 1,100
    const v = storeVisibility(s);
    expect(v.slice(0, 3)).toEqual(['shown', 'shown', 'shown']);
    expect(v[3]).toBe('mystery');
  });
});
