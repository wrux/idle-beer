import { describe, expect, it } from 'vitest';
import { invalidate, nextRound, offlineGain, pintsPerDrink, totalPps, hasDownInOne } from '../src/core/economy';
import { buffDuration, luckyAmount, startBuff } from '../src/core/events';
import { big, D } from '../src/core/num';
import {
  allTimePints, buyLicence, lastOrders, licenceStatus, matMult, matsOnReset, matsWorth, pintsForNextMat,
} from '../src/core/prestige';
import { deserialize, serialize } from '../src/core/save';
import { newGame, SAVE_VERSION, type GameState } from '../src/core/state';
import { checkAchievements } from '../src/data/achievements';
import { LICENCE } from '../src/data/licence';

const withMats = (n: number): GameState => {
  const s = newGame();
  s.beerMats = D(n);
  s.matsEarned = D(n);
  invalidate();
  return s;
};

const buyBranch = (s: GameState, branch: string, upTo: number) => {
  for (let t = 1; t <= upTo; t++) expect(buyLicence(s, `${branch}-${t}`)).toBe(true);
};

describe('Beer Mats', () => {
  it('first mat at a trillion all-time pints, then the cube root', () => {
    expect(matsWorth(D(9.99e11)).toNumber()).toBe(0);
    expect(matsWorth(D(1e12)).toNumber()).toBe(1);
    expect(matsWorth(D(8e12)).toNumber()).toBe(2);
    expect(matsWorth(D(1e18)).toNumber()).toBe(100);
    expect(matsWorth(D(1e15), 1.25).toNumber()).toBe(12);
  });

  it('handle absurd all-time pints', () => {
    expect(matsWorth(big(1, 3e12)).exponent).toBeCloseTo((3e12 - 12) / 3, -2);
  });

  it('a reset only pays out mats you have not had before', () => {
    const s = newGame();
    s.lifetimePints = D(1e18);
    expect(matsOnReset(s).toNumber()).toBe(100);
    expect(lastOrders(s).toNumber()).toBe(100);
    expect(matsOnReset(s).toNumber()).toBe(0);
    s.lifetimePints = D(7e18); // all-time 8e18 → 200 mats
    expect(matsOnReset(s).toNumber()).toBe(100);
  });

  it('says how many pints the next mat needs', () => {
    const s = newGame();
    s.lifetimePints = D(1e18); // 100 mats
    const next = pintsForNextMat(s);
    expect(matsWorth(next).toNumber()).toBe(101);
    expect(matsWorth(next.mul(0.999)).toNumber()).toBe(100);
  });

  it('each unspent mat adds 1% to everything', () => {
    const s = withMats(50);
    s.drinkers = { student: 2 };
    invalidate();
    expect(matMult(s).toNumber()).toBeCloseTo(1.5);
    expect(totalPps(s).toNumber()).toBeCloseTo(3);
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo(1.5);
  });
});

describe('Last Orders reset', () => {
  it('wipes the run but keeps achievements, stats and prestige progress', () => {
    const s = newGame();
    s.lifetimePints = D(1e15);
    s.pints = D(5e14);
    s.drinkers = { regular: 50, student: 10 };
    s.upgrades.add('regular-1');
    s.beer = 6;
    s.drinks = 400;
    s.achievements.add('lifetime-1');
    startBuff(s, 'happyHour');
    lastOrders(s);
    expect(s.pints.eq(0)).toBe(true);
    expect(s.lifetimePints.eq(0)).toBe(true);
    expect(s.drinkers).toEqual({});
    expect(s.upgrades.size).toBe(0);
    expect(s.beer).toBe(0);
    expect(s.buffs).toEqual([]);
    expect(s.drinks).toBe(400);
    expect(s.achievements.has('lifetime-1')).toBe(true);
    expect(s.prestiges).toBe(1);
    expect(s.beerMats.toNumber()).toBe(10);
    expect(allTimePints(s).toNumber()).toBe(1e15);
  });
});

describe("Landlord's Licence", () => {
  it('has 30 nodes in six branches of five', () => {
    expect(LICENCE).toHaveLength(30);
  });

  it('nodes need the one before them and enough mats', () => {
    const s = withMats(3);
    expect(licenceStatus(s, 'regulars-2')).toBe('locked');
    expect(buyLicence(s, 'regulars-2')).toBe(false);
    expect(buyLicence(s, 'regulars-1')).toBe(true);
    expect(s.beerMats.toNumber()).toBe(2);
    expect(licenceStatus(s, 'regulars-2')).toBe('available');
    expect(buyLicence(s, 'regulars-2')).toBe(false); // costs 4
    expect(buyLicence(s, 'regulars-1')).toBe(false); // already owned
  });

  it('Regulars branch gives a head start', () => {
    const s = withMats(1000);
    buyBranch(s, 'regulars', 5);
    lastOrders(s);
    expect(s.drinkers).toEqual({ regular: 25, student: 25, darts: 25, stag: 25 });
    expect(s.pints.toNumber()).toBe(1e6);
  });

  it('Brewing keeps beers and makes them cheaper', () => {
    const s = withMats(1000);
    buyBranch(s, 'brewing', 5);
    s.beer = 14;
    s.lifetimePints = D('1e60');
    lastOrders(s);
    expect(s.beer).toBe(7);
    s.lifetimePints = D('1e60');
    // Kept 7 of 14 beers, so next up is the Landlord's Reserve (5e16), discounted 25% then 50%.
    expect(nextRound(s)!.beer.id).toBe('reserve');
    expect(nextRound(s)!.cost.toNumber()).toBeCloseTo(5e16 * 0.75 * 0.5);
  });

  it('Charm stretches Free Rounds', () => {
    const s = withMats(1000);
    buyBranch(s, 'charm', 3);
    expect(buffDuration(s, 'happyHour')).toBeCloseTo(77 * 1.5);
    s.pints = D(1e6);
    expect(luckyAmount(s, D(1)).toNumber()).toBe((900 + 13) * 2);
  });

  it('Management improves offline progress', () => {
    const s = withMats(1000);
    s.drinkers = { student: 1 };
    invalidate();
    expect(offlineGain(s, 10 * 3600).seconds).toBe(3600);
    buyBranch(s, 'management', 2);
    const g = offlineGain(s, 10 * 3600);
    expect(g.seconds).toBe(4 * 3600);
    // (the unspent mats boost income too)
    expect(g.pints.div(matMult(s)).toNumber()).toBeCloseTo(4 * 3600 * 0.75);
  });

  it('Technique gives Down in One from the start and can keep drinking upgrades', () => {
    const s = withMats(1000);
    buyBranch(s, 'technique', 5);
    expect(hasDownInOne(s)).toBe(true);
    s.upgrades.add('gulp-1');
    s.upgrades.add('regular-1');
    lastOrders(s);
    expect([...s.upgrades]).toEqual(['gulp-1']);
  });

  it('Collecting makes mats stronger and more plentiful', () => {
    const s = withMats(400);
    buyBranch(s, 'collecting', 5); // 330 mats
    expect(s.beerMats.toNumber()).toBe(70);
    expect(matMult(s).toNumber()).toBeCloseTo(1 + 0.05 * 70);
    s.lifetimePints = D(1e21); // worth ∛1e9 = 1,000 mats, ×1.875 with both gain nodes
    expect(matsOnReset(s).toNumber()).toBe(1875 - 400);
  });
});

describe('saves', () => {
  it('round-trip prestige state', () => {
    const s = withMats(20);
    buyLicence(s, 'charm-1');
    s.pastRunsPints = D('1e40');
    s.prestiges = 3;
    const back = deserialize(serialize(s));
    expect(back.version).toBe(SAVE_VERSION);
    expect([...back.licence]).toEqual(['charm-1']);
    expect(back.beerMats.toNumber()).toBe(19);
    expect(back.matsEarned.toNumber()).toBe(20);
    expect(back.pastRunsPints.eq('1e40')).toBe(true);
    expect(back.prestiges).toBe(3);
  });

  it('migrate version 1 saves', () => {
    const v1 = btoa(JSON.stringify({ version: 1, pints: '500', lifetimePints: '2e12', startedAt: 1234 }));
    const s = deserialize(v1);
    expect(s.version).toBe(2);
    expect(s.pints.toNumber()).toBe(500);
    expect(s.beerMats.eq(0)).toBe(true);
    expect(s.runStartedAt).toBe(1234);
    expect(matsOnReset(s).toNumber()).toBe(1);
  });
});

describe('prestige achievements', () => {
  it('unlock on the first Last Orders', () => {
    const s = newGame();
    s.lifetimePints = D(1e12);
    lastOrders(s);
    const ids = checkAchievements(s, { pps: D(0), now: new Date(2026, 10, 18, 19) }).map((a) => a.id);
    expect(ids).toContain('prestige-1');
  });
});
