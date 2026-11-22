import { describe, expect, it } from 'vitest';
import { D } from '../src/core/num';
import { newGame } from '../src/core/state';
import { moments, progress, snapshot } from '../src/core/telemetry';
import { SCENARIOS } from '../src/dev/scenarios';

describe('play statistics', () => {
  it('sees nothing when nothing has changed', () => {
    const s = newGame(0);
    expect(moments(snapshot(s), snapshot(s))).toEqual([]);
  });

  it('notices the first drink, the first drinker and a new pub', () => {
    const s = newGame(0);
    const before = snapshot(s);
    s.drinks = 1;
    s.drinkers = { regular: 12 };
    s.pubs.add('superpub');
    const seen = moments(before, snapshot(s));
    expect(seen.map((m) => m.event)).toEqual(['first_drink', 'first_drinker', 'crowd', 'pub']);
    expect(seen[3]).toMatchObject({ label: 'superpub' });
    expect(seen[3].value).toBeGreaterThan(0);
  });

  it('counts Last Orders, the walk back and what was bought after hours', () => {
    const s = newGame(0);
    s.beer = 4;
    const before = snapshot(s);
    s.prestiges = 1;
    s.afterHours = true;
    s.beer = 0;
    const rung = snapshot(s);
    expect(moments(before, rung)).toEqual([{ event: 'last_orders', value: 1 }]);
    s.licence.add('management-1');
    s.afterHours = false;
    expect(moments(rung, snapshot(s))).toEqual([{ event: 'back_to_pub', value: 1 }, { event: 'licence', label: 'management-1' }]);
  });

  it('does not flood after a big jump', () => {
    const before = snapshot(newGame(0));
    const after = snapshot(SCENARIOS.find((sc) => sc.id === 'endgame')!.build(0));
    const seen = moments(before, after);
    expect(seen.filter((m) => m.event === 'pub').length).toBeLessThanOrEqual(5);
    expect(seen.filter((m) => m.event === 'licence').length).toBeLessThanOrEqual(5);
  });

  it('sends plain finite numbers however big the game is', () => {
    for (const sc of SCENARIOS) {
      const s = sc.build(0);
      s.lifetimePints = D('1e9000000000000000');
      const numbers = progress(s, 12.4, 3);
      expect(numbers).toHaveLength(11);
      expect(numbers.every(Number.isFinite)).toBe(true);
    }
    expect(progress(newGame(0), 0, 1)[8]).toBe(0);
  });
});
