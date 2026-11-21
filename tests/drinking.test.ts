import { describe, expect, it } from 'vitest';
import { AUTO_PAUSE, autoCycleSeconds, newDrinkState, stepDrink } from '../src/core/drinking';

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

describe('drinking on his own', () => {
  const auto = { ...params, auto: true };
  /** Simulate at 60fps; returns [pints finished on his own, pints finished by hand]. */
  function play(st: ReturnType<typeof newDrinkState>, seconds: number, holding: boolean) {
    let own = 0, hand = 0;
    for (let t = 0; t < seconds; t += 1 / 60) {
      if (stepDrink(st, 1 / 60, holding, auto)) {
        if (st.lastFinishAuto) own++;
        else hand++;
      }
    }
    return [own, hand];
  }

  it('waits, then takes slow sips without you holding', () => {
    const st = newDrinkState();
    play(st, AUTO_PAUSE - 0.1, false);
    expect(st.fill).toBe(1); // still waiting for his first sip
    play(st, 2.5, false);
    expect(st.fill).toBeLessThan(1);
    expect(st.fill).toBeGreaterThan(0.6); // only about a quarter per sip
  });

  it('is much slower than holding', () => {
    const [own] = play(newDrinkState(), 120, false);
    const [, hand] = play(newDrinkState(), 120, true);
    expect(own).toBeGreaterThanOrEqual(4);
    expect(hand).toBeGreaterThan(own * 4);
    // The pacing formula matches what actually happens.
    expect(120 / autoCycleSeconds(params.drinkTime, params.refillTime)).toBeCloseTo(own, 0);
  });

  it('holding takes over straight away and counts as by hand', () => {
    const st = newDrinkState();
    play(st, AUTO_PAUSE + 0.5, false); // mid-sip on his own
    expect(st.autoSip).toBeGreaterThan(0);
    const [own, hand] = play(st, 3, true);
    expect(st.autoSip).toBe(0);
    expect(own).toBe(0);
    expect(hand).toBe(1);
  });

  it('stays off unless enabled', () => {
    const st = newDrinkState();
    for (let t = 0; t < 30; t += 1 / 60) stepDrink(st, 1 / 60, false, params);
    expect(st.fill).toBe(1);
  });
});
