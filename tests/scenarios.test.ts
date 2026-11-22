import { describe, expect, it } from 'vitest';
import { matsOnReset } from '../src/core/prestige';
import { deserialize, serialize } from '../src/core/save';
import { SCENARIOS } from '../src/dev/scenarios';
import { LOCATION_BY_ID } from '../src/data/locations';

const get = (id: string) => SCENARIOS.find((s) => s.id === id)!.build(0);

describe('debug scenarios', () => {
  it('all survive a save and load', () => {
    for (const scenario of SCENARIOS) {
      const s = scenario.build(0);
      const back = deserialize(serialize(s), 0);
      expect(back.pints.eq(s.pints)).toBe(true);
      expect(back.prestiges).toBe(s.prestiges);
      expect([...back.licence].sort()).toEqual([...s.licence].sort());
      expect(LOCATION_BY_ID.has(back.pub)).toBe(true);
      expect(back.pubs.has(back.pub)).toBe(true);
    }
  });

  it('the first Last Orders is there to be called, and never has been', () => {
    const s = get('first-prestige');
    expect(s.prestiges).toBe(0);
    expect(s.beerMats.eq(0)).toBe(true);
    expect(matsOnReset(s).gt(0)).toBe(true);
  });

  it('the veteran has rung the bell many times and can again', () => {
    const s = get('veteran');
    expect(s.prestiges).toBeGreaterThan(10);
    expect(s.beerMats.gt(0)).toBe(true);
    expect(s.licence.size).toBeGreaterThan(10);
    expect(matsOnReset(s).gt(0)).toBe(true);
  });

  it('a new game and an hour in have nothing to ring the bell for', () => {
    expect(matsOnReset(get('fresh')).eq(0)).toBe(true);
    expect(matsOnReset(get('mid')).eq(0)).toBe(true);
  });
});
