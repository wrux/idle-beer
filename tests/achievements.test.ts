import { describe, expect, it } from 'vitest';
import { buyUpgrade, invalidate, reputationMult, totalPps } from '../src/core/economy';
import { D } from '../src/core/num';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import {
  ACHIEVEMENTS, checkAchievements, grantAchievement, type AchievementContext,
} from '../src/data/achievements';
import { UPGRADES } from '../src/data/upgrades';

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  pps: D(0), now: new Date(2026, 10, 18, 19, 0), ...over, // a Wednesday evening
});

describe('achievement catalogue', () => {
  it('has around 150 achievements with unique ids, names and descriptions', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(120);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.desc.length).toBeGreaterThan(5);
  });

  it('describes big numbers readably', () => {
    const million = ACHIEVEMENTS.find((a) => a.id === 'lifetime-1e6')!;
    expect(million.desc).toBe('Drink 1 million pints in total.');
  });
});

describe('unlocking', () => {
  it('a fresh game has none', () => {
    expect(checkAchievements(newGame(), ctx())).toEqual([]);
  });

  it('unlocks once and only once', () => {
    const s = newGame();
    s.lifetimePints = D(150);
    s.drinks = 12;
    const first = checkAchievements(s, ctx()).map((a) => a.id);
    expect(first).toContain('lifetime-1');
    expect(first).toContain('lifetime-1e2');
    expect(first).toContain('drinks-10');
    expect(first).not.toContain('lifetime-1e3');
    expect(checkAchievements(s, ctx())).toEqual([]);
  });

  it('per-second ones read the current production', () => {
    const s = newGame();
    expect(checkAchievements(s, ctx({ pps: D(1e6) })).map((a) => a.id)).toContain('pps-1e6');
  });

  it('hidden time-of-day ones need you to have drunk something', () => {
    const s = newGame();
    const lateNight = ctx({ now: new Date(2026, 10, 18, 2, 0) });
    expect(checkAchievements(s, lateNight).map((a) => a.id)).not.toContain('lock-in');
    s.drinks = 1;
    expect(checkAchievements(s, lateNight).map((a) => a.id)).toContain('lock-in');
  });

  it('Designated Driver: a million pints still on the lager', () => {
    const s = newGame();
    s.lifetimePints = D(1e6);
    expect(checkAchievements(s, ctx()).map((a) => a.id)).toContain('designated-driver');
    const t = newGame();
    t.lifetimePints = D(1e6);
    t.beer = 1;
    expect(checkAchievements(t, ctx()).map((a) => a.id)).not.toContain('designated-driver');
  });

  it('granted ones are given once', () => {
    const s = newGame();
    expect(grantAchievement(s, 'silent-pint')?.name).toBe('A Quiet One');
    expect(grantAchievement(s, 'silent-pint')).toBeNull();
  });

  it('survive a save and reload, dropping unknown ids', () => {
    const s = newGame();
    s.achievements.add('lifetime-1');
    s.playSeconds = 1234;
    const back = deserialize(serialize(s));
    expect([...back.achievements]).toEqual(['lifetime-1']);
    expect(back.playSeconds).toBe(1234);
    const odd = deserialize(btoa(JSON.stringify({ version: 1, achievements: ['lifetime-1', 'nope'] })));
    expect([...odd.achievements]).toEqual(['lifetime-1']);
  });
});

describe('reputation', () => {
  const withAchievements = (n: number): GameState => {
    const s = newGame();
    s.pints = D('1e60');
    for (const a of ACHIEVEMENTS.slice(0, n)) s.achievements.add(a.id);
    s.drinkers = { student: 1 };
    invalidate();
    return s;
  };

  it('does nothing until you buy a Reputation upgrade', () => {
    const s = withAchievements(40);
    expect(reputationMult(s)).toBe(1);
    expect(totalPps(s).toNumber()).toBeCloseTo(1);
  });

  it('Reputation upgrades unlock by achievement count and scale with it', () => {
    const s = withAchievements(9);
    expect(buyUpgrade(s, 'rep-local-legend')).toBe(false); // needs 10
    const t = withAchievements(40);
    expect(buyUpgrade(t, 'rep-local-legend')).toBe(true);
    expect(reputationMult(t)).toBeCloseTo(1 + 0.005 * 40);
    expect(totalPps(t).toNumber()).toBeCloseTo(1.2);
  });

  it('stack multiplicatively', () => {
    const s = withAchievements(60);
    buyUpgrade(s, 'rep-local-legend');
    buyUpgrade(s, 'rep-name-on-the-wall');
    expect(reputationMult(s)).toBeCloseTo((1 + 0.005 * 60) * (1 + 0.006 * 60));
  });

  it('there is a Reputation line of upgrades', () => {
    expect(UPGRADES.filter((u) => u.group === 'reputation').length).toBeGreaterThanOrEqual(8);
  });
});
