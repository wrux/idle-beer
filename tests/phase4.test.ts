import { describe, expect, it } from 'vitest';
import {
  buyDrinker, costOf, invalidate, pintsPerDrink, priceOf, totalPps,
} from '../src/core/economy';
import { BUFFS, luckyAmount, rollFreeRound, startBuff, tickBuffs } from '../src/core/events';
import { D } from '../src/core/num';
import { deserialize, serialize } from '../src/core/save';
import { newGame, owned } from '../src/core/state';
import { newStreak, registerFinish, streakMult, streakRemaining } from '../src/core/streak';
import { DRINKERS, DRINKER_BY_ID } from '../src/data/drinkers';
import { LOCATIONS, locationIndex } from '../src/data/locations';
import { pickCrowd } from '../src/ui/scene';

describe('chug streak', () => {
  it('builds while pints come back to back, capped at +50%', () => {
    const s = newStreak();
    const cycle = 2;
    let mult = 1;
    for (let i = 0; i < 15; i++) mult = registerFinish(s, i * 2.5, cycle);
    expect(s.count).toBe(15);
    expect(mult).toBeCloseTo(1.5);
  });

  it('first pint gets nothing extra, the second +5%', () => {
    const s = newStreak();
    expect(registerFinish(s, 0, 2)).toBe(1);
    expect(registerFinish(s, 2.5, 2)).toBeCloseTo(1.05);
  });

  it('breaks if you wait too long', () => {
    const s = newStreak();
    registerFinish(s, 0, 2);
    registerFinish(s, 2.5, 2);
    expect(streakRemaining(s, 3, 2)).toBeGreaterThan(0);
    expect(streakRemaining(s, 10, 2)).toBe(0);
    expect(registerFinish(s, 10, 2)).toBe(1);
    expect(s.count).toBe(1);
  });

  it('multiplier table', () => {
    expect(streakMult(0)).toBe(1);
    expect(streakMult(1)).toBe(1);
    expect(streakMult(11)).toBeCloseTo(1.5);
    expect(streakMult(500)).toBeCloseTo(1.5);
  });
});

describe('Free Rounds', () => {
  const fixed = (v: number) => () => v;

  it('rolls each outcome by weight', () => {
    const s = newGame();
    expect(rollFreeRound(s, D(10), fixed(0))).toEqual({ kind: 'buff', buff: 'happyHour' });
    expect(rollFreeRound(s, D(10), fixed(0.5)).kind).toBe('lucky');
    expect(rollFreeRound(s, D(10), fixed(0.9))).toEqual({ kind: 'buff', buff: 'downIt' });
    expect(rollFreeRound(s, D(10), fixed(0.99))).toEqual({ kind: 'buff', buff: 'quizWin' });
  });

  it('never stacks a buff with itself', () => {
    const s = newGame();
    startBuff(s, 'happyHour');
    for (let r = 0; r < 1; r += 0.05) {
      const o = rollFreeRound(s, D(10), fixed(r));
      expect(o.kind === 'buff' && o.buff === 'happyHour').toBe(false);
    }
  });

  it('Lucky Round is the smaller of 15% of the bank and 15 minutes of income, plus 13', () => {
    const s = newGame();
    s.pints = D(1e6);
    expect(luckyAmount(s, D(1)).toNumber()).toBe(900 + 13);
    expect(luckyAmount(s, D(1e6)).toNumber()).toBe(150_000 + 13);
  });

  it('buffs count down and expire', () => {
    const s = newGame();
    startBuff(s, 'downIt');
    expect(tickBuffs(s, 5)).toBe(false);
    expect(s.buffs[0].remaining).toBeCloseTo(BUFFS.downIt.duration - 5);
    expect(tickBuffs(s, 100)).toBe(true);
    expect(s.buffs).toHaveLength(0);
  });
});

describe('buff effects', () => {
  it('Happy Hour makes drinkers drink 7×', () => {
    const s = newGame();
    s.drinkers = { student: 2 };
    invalidate();
    startBuff(s, 'happyHour');
    invalidate();
    expect(totalPps(s).toNumber()).toBeCloseTo(14);
  });

  it('Down It! makes each pint count 777×', () => {
    const s = newGame();
    startBuff(s, 'downIt');
    invalidate();
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo(777);
  });

  it('Pub Quiz Win takes 25% off drinkers', () => {
    const s = newGame();
    s.pints = D(1000);
    const d = DRINKER_BY_ID.get('student')!;
    startBuff(s, 'quizWin');
    expect(priceOf(s, d, 0, 1).toNumber()).toBe(75);
    expect(costOf(d, 0, 1).toNumber()).toBe(100);
    buyDrinker(s, 'student', 1);
    expect(s.pints.toNumber()).toBe(925);
  });

  it('buffs survive a save and reload', () => {
    const s = newGame();
    startBuff(s, 'happyHour');
    tickBuffs(s, 10);
    const back = deserialize(serialize(s));
    expect(back.buffs).toEqual([{ kind: 'happyHour', remaining: BUFFS.happyHour.duration - 10 }]);
  });
});

describe('locations', () => {
  it('are in order and reached by lifetime pints', () => {
    for (let i = 1; i < LOCATIONS.length; i++) expect(LOCATIONS[i].threshold.gt(LOCATIONS[i - 1].threshold)).toBe(true);
    expect(locationIndex(D(0))).toBe(0);
    expect(locationIndex(D('1e1000'))).toBe(LOCATIONS.length - 1);
  });
});

describe('crowd', () => {
  it('shows one figure per owned type, more for big counts, at most 7', () => {
    const s = newGame();
    const pick = () => pickCrowd(DRINKERS, (id) => owned(s, id));
    expect(pick()).toHaveLength(0);
    s.drinkers = { regular: 1 };
    expect(pick().map((d) => d.id)).toEqual(['regular']);
    s.drinkers = { regular: 150 };
    expect(pick()).toHaveLength(3);
    for (const d of DRINKERS) s.drinkers[d.id] = 5;
    const crowd = pick();
    expect(crowd).toHaveLength(7);
    // Newest (highest) tiers get priority when there isn't room.
    expect(crowd.map((d) => d.id)).toContain('multiverse');
    expect(crowd.map((d) => d.id)).not.toContain('regular');
  });

  it('is stable for the same drinkers', () => {
    const own = (id: string) => ({ regular: 12, student: 3, darts: 1 } as Record<string, number>)[id] ?? 0;
    expect(pickCrowd(DRINKERS, own)).toEqual(pickCrowd(DRINKERS, own));
  });
});
