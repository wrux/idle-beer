import { describe, expect, it } from 'vitest';
import { newDrinkState, stepDrink } from '../src/core/drinking';

const params = { drinkTime: 2, refillTime: 0.6 };

/** Simulate holding (or not) for `seconds` at 60fps; returns pints finished. */
function run(s: ReturnType<typeof newDrinkState>, seconds: number, holding: boolean) {
  let finished = 0;
  for (let t = 0; t < seconds; t += 1 / 60) finished += stepDrink(s, 1 / 60, holding, params);
  return finished;
}

describe('hold to drink', () => {
  it('finishes a pint after lifting and drinking for the drink time', () => {
    const s = newDrinkState();
    expect(run(s, 2.0, true)).toBe(0); // still lifting at the start
    expect(run(s, 0.4, true)).toBe(1);
    expect(s.refilling).toBe(true);
  });

  it('keeps progress when you let go early', () => {
    const s = newDrinkState();
    run(s, 1.2, true);
    const fill = s.fill;
    expect(fill).toBeGreaterThan(0.2);
    expect(fill).toBeLessThan(0.8);
    run(s, 1, false);
    expect(s.fill).toBe(fill);
    expect(s.lift).toBe(0);
  });

  it('refills and carries on while you keep holding', () => {
    const s = newDrinkState();
    expect(run(s, 10, true)).toBe(3); // each pint ≈ 0.2s lift + 2s drink + 0.3s lower + 0.6s pour
  });

  it('with Down in One, a single tap finishes the pint', () => {
    const s = newDrinkState();
    stepDrink(s, 1 / 60, true, { ...params, downInOne: true }); // one frame of pressing
    let finished = 0;
    for (let t = 0; t < 3; t += 1 / 60) finished += stepDrink(s, 1 / 60, false, { ...params, downInOne: true });
    expect(finished).toBe(1);
    expect(s.committed).toBe(false);
  });

  it('without Down in One, a tap does not finish the pint', () => {
    const s = newDrinkState();
    stepDrink(s, 1 / 60, true, params);
    expect(run(s, 3, false)).toBe(0);
  });

  it('does nothing if you never hold', () => {
    const s = newDrinkState();
    expect(run(s, 10, false)).toBe(0);
    expect(s.fill).toBe(1);
  });
});
