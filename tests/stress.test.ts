/**
 * Stress tests: the whole economy at absurd scales (DESIGN.md §8.2 rule 7).
 * Nothing may become NaN, hang, or lose the save.
 */
import { describe, expect, it } from 'vitest';
import {
  availableUpgrades, buyDrinker, buyNextRound, buyUpgrade, currentBeer, earn, invalidate, nextRound,
  pintsPerDrink, totalPps,
} from '../src/core/economy';
import { format, type NumberFormat } from '../src/core/format';
import { big, D, type Decimal } from '../src/core/num';
import { buyLicence, lastOrders, matMult, matsOnReset } from '../src/core/prestige';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { checkAchievements } from '../src/data/achievements';
import { beerAt } from '../src/data/beers';
import { DRINKERS } from '../src/data/drinkers';
import { LICENCE } from '../src/data/licence';

const ok = (d: Decimal) => Number.isFinite(d.mantissa) && Number.isFinite(d.exponent) && d.gte(0);
const FORMATS: NumberFormat[] = ['short', 'scientific', 'engineering'];
const readable = (d: Decimal) => FORMATS.every((f) => !/NaN|undefined/.test(format(d, f)));

/** Buy everything you can: max of every drinker, every upgrade, and a run of beers. */
function buyEverything(s: GameState, beers = 200) {
  for (const d of DRINKERS) buyDrinker(s, d.id, 'max');
  for (let pass = 0; pass < 3; pass++) for (const u of availableUpgrades(s)) buyUpgrade(s, u.id);
  for (let i = 0; i < beers && buyNextRound(s); i++);
}

describe('stress: e(1e10) pints', () => {
  const rich = () => {
    const s = newGame();
    s.pints = big(1, 1e10);
    s.lifetimePints = big(1, 1e10);
    s.drinks = 1e6;
    invalidate();
    return s;
  };

  it('buys everything without breaking', () => {
    const s = rich();
    const start = performance.now();
    buyEverything(s);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(DRINKERS.every((d) => (s.drinkers[d.id] ?? 0) > 1e10)).toBe(true);
    expect(s.upgrades.size).toBeGreaterThan(240);
    expect(s.beer).toBeGreaterThan(100);
    for (const v of [s.pints, totalPps(s), pintsPerDrink(s)]) {
      expect(ok(v)).toBe(true);
      expect(readable(v)).toBe(true);
    }
  });

  it('a generated beer deep into the list still works', () => {
    const b = beerAt(1_000_000);
    expect(b.name.length).toBeGreaterThan(3);
    expect(ok(b.cost)).toBe(true);
    expect(b.cost.exponent).toBeGreaterThan(7_900_000); // ≈ 1e145 × (1e8)^999,969
  });

  it('earning on top of absurd numbers works', () => {
    const s = rich();
    buyEverything(s, 20);
    const before = s.pints;
    earn(s, totalPps(s).mul(0.016));
    expect(s.pints.gte(before)).toBe(true);
    expect(ok(s.pints)).toBe(true);
  });

  it('Last Orders at e(1e10) all-time pays astronomical mats, and the next run still works', () => {
    const s = rich();
    buyEverything(s, 20);
    const gained = lastOrders(s);
    expect(gained.exponent).toBeGreaterThan(3e9); // ∛ of e(1e10)
    expect(ok(matMult(s))).toBe(true);
    for (const n of LICENCE) buyLicence(s, n.id);
    expect(s.licence.size).toBe(30);
    s.drinkers = { regular: 1 };
    invalidate();
    expect(ok(totalPps(s))).toBe(true);
    expect(totalPps(s).exponent).toBeGreaterThan(3e9); // mats boost carries straight through
    // Collecting's ×1.25 and ×1.5 mat bonuses re-value what you've already drunk.
    expect(matsOnReset(s).div(s.matsEarned).toNumber()).toBeCloseTo(0.875);
  });

  it('achievements check cleanly', () => {
    const s = rich();
    buyEverything(s, 20);
    const fresh = checkAchievements(s, { pps: totalPps(s), now: new Date() });
    expect(fresh.length).toBeGreaterThan(80);
  });

  it('the save round-trips exactly', () => {
    const s = rich();
    buyEverything(s, 50);
    lastOrders(s);
    const back = deserialize(serialize(s));
    expect(back.beerMats.eq(s.beerMats)).toBe(true);
    expect(back.pastRunsPints.eq(s.pastRunsPints)).toBe(true);
    expect(serialize(back)).toBe(serialize(s));
  });
});

describe('stress: the very top of the range', () => {
  it('numbers at the 1e(9e15) ceiling stay readable and saveable', () => {
    const s = newGame();
    s.pints = big(9.9, 9e15 - 1);
    s.lifetimePints = big(9.9, 9e15 - 1);
    earn(s, big(9.9, 9e15 - 1)); // overflows to the cap
    expect(readable(s.pints)).toBe(true);
    const back = deserialize(serialize(s));
    expect(back.pints.exponent).toBeGreaterThanOrEqual(9e15 - 1);
  });

  it('max-buying at the ceiling does not hang', () => {
    const s = newGame();
    s.pints = big(1, 9e15 - 1);
    const start = performance.now();
    buyDrinker(s, 'multiverse', 'max');
    expect(performance.now() - start).toBeLessThan(100);
    expect(s.drinkers.multiverse).toBeGreaterThan(1e16);
  });
});

describe('stress: performance', () => {
  it('recalculating income with every upgrade owned is fast', () => {
    const s = newGame();
    s.pints = big(1, 1e10);
    s.lifetimePints = s.pints;
    s.drinks = 1e6;
    buyEverything(s, 50);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      invalidate();
      totalPps(s);
    }
    const perCall = (performance.now() - start) / 1000;
    expect(perCall).toBeLessThan(1); // ms; it only runs after a purchase anyway
  });

  it('cached reads used every frame are effectively free', () => {
    const s = newGame();
    s.drinkers = { student: 5 };
    invalidate();
    totalPps(s);
    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      totalPps(s);
      pintsPerDrink(s);
      currentBeer(s);
      nextRound(s);
    }
    expect(performance.now() - start).toBeLessThan(500);
  });
});

/** Make sure the helper itself is honest. */
describe('helpers', () => {
  it('ok() rejects NaN', () => {
    expect(ok(D(NaN))).toBe(false);
    expect(ok(D(5))).toBe(true);
  });
});
