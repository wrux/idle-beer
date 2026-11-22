import { describe, expect, it } from 'vitest';
import {
  availableUpgrades, buyDrinker, drinkerDiscount, invalidate, nextRound, pintsPerDrink, totalPps,
} from '../src/core/economy';
import { mods } from '../src/core/licenceState';
import { challengeProgress, checkChallenge, dealSpecials, pickChallenge, pickSpecial } from '../src/core/nights';
import { D } from '../src/core/num';
import { lastOrders, matMult } from '../src/core/prestige';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { CHALLENGES, SPECIALS } from '../src/data/nights';

/** A game on the morning after its first Last Orders. */
const morningAfter = (): GameState => {
  const s = newGame(0);
  s.lifetimePints = D(1e15);
  lastOrders(s, 0);
  invalidate();
  return s;
};

describe("tonight's special", () => {
  it('lays out three different specials after Last Orders, and none before', () => {
    expect(newGame(0).specialOffer).toEqual([]);
    const s = morningAfter();
    expect(s.specialOffer).toHaveLength(3);
    expect(new Set(s.specialOffer).size).toBe(3);
    expect(s.special).toBeNull();
  });

  it('can only be picked from the three on offer, and only the morning after', () => {
    const s = morningAfter();
    const other = SPECIALS.find((x) => !s.specialOffer.includes(x.id))!;
    expect(pickSpecial(s, other.id)).toBe(false);
    expect(pickSpecial(s, s.specialOffer[1])).toBe(true);
    expect(s.special).toBe(s.specialOffer[1]);
    // You can change your mind until you go back to the pub.
    expect(pickSpecial(s, s.specialOffer[0])).toBe(true);
    s.afterHours = false;
    expect(pickSpecial(s, s.specialOffer[2])).toBe(false);
    expect(s.special).toBe(s.specialOffer[0]);
  });

  it('lasts the night and no longer', () => {
    const s = morningAfter();
    s.specialOffer = ['two-for-one', 'strong-stuff', 'big-hands'];
    pickSpecial(s, 'two-for-one');
    s.afterHours = false;
    invalidate();
    expect(drinkerDiscount(s)).toBeCloseTo(0.5);
    s.lifetimePints = D(1e16);
    lastOrders(s, 0);
    invalidate();
    expect(s.special).toBeNull();
    expect(drinkerDiscount(s)).toBe(1);
  });

  it('dealing is driven by the dice it is given', () => {
    const a = newGame(0), b = newGame(0);
    dealSpecials(a, () => 0);
    dealSpecials(b, () => 0.999);
    expect(a.specialOffer).toEqual(SPECIALS.slice(0, 3).map((x) => x.id));
    expect(b.specialOffer).toEqual(SPECIALS.slice(-3).reverse().map((x) => x.id));
  });
});

describe('challenge nights', () => {
  const on = (id: string): GameState => {
    const s = morningAfter();
    expect(pickChallenge(s, id)).toBe(true);
    s.afterHours = false;
    invalidate();
    return s;
  };

  it('can only be taken on the morning after, and dropped again before the night starts', () => {
    const s = morningAfter();
    expect(pickChallenge(s, 'nope')).toBe(false);
    expect(pickChallenge(s, 'dry')).toBe(true);
    expect(pickChallenge(s, null)).toBe(true);
    expect(s.challenge).toBeNull();
    s.afterHours = false;
    expect(pickChallenge(s, 'dry')).toBe(false);
  });

  it('each handicap bites', () => {
    const alone = on('alone');
    alone.pints = D(1e6);
    alone.drinkers = { regular: 5 };
    invalidate();
    expect(buyDrinker(alone, 'regular', 1)).toBe(0);
    expect(totalPps(alone).toNumber()).toBe(0);

    expect(pintsPerDrink(on('dry')).toNumber()).toBe(0);

    const shelves = on('shelves');
    shelves.drinks = 1000;
    expect(availableUpgrades(shelves)).toEqual([]);

    const shandy = on('shandy');
    shandy.lifetimePints = D(1e6);
    expect(nextRound(shandy)).toBeNull();

    expect(drinkerDiscount(on('round'))).toBe(10);

    const pockets = on('pockets');
    pockets.beerMats = D(500);
    expect(matMult(pockets).toNumber()).toBe(1);
  });

  it('is beaten by what you drink in the night, not what you walked in with', () => {
    const s = morningAfter();
    s.lifetimePints = D(5e8); // a head start bigger than the goal
    pickChallenge(s, 'alone');
    expect(checkChallenge(s)).toBeNull(); // still the morning after
    s.afterHours = false;
    expect(checkChallenge(s)).toBeNull();
    s.lifetimePints = s.lifetimePints.add(9e7);
    expect(challengeProgress(s).toNumber()).toBe(9e7);
    expect(checkChallenge(s)).toBeNull();
    s.lifetimePints = s.lifetimePints.add(1e7);
    expect(checkChallenge(s)?.id).toBe('alone');
    // Beaten: the handicap lifts, the prize stays, and it can't be taken on again.
    expect(s.challenge).toBeNull();
    expect(s.challengesDone.has('alone')).toBe(true);
    invalidate();
    expect(mods(s).noDrinkers).toBe(false);
    expect(mods(s).perDrink).toBe(10);
    s.afterHours = true;
    expect(pickChallenge(s, 'alone')).toBe(false);
  });

  it('is lost at Last Orders if not beaten, and prizes outlast it', () => {
    const s = on('dry');
    s.challengesDone.add('shandy');
    s.lifetimePints = D(1e15);
    lastOrders(s, 0);
    invalidate();
    expect(s.challenge).toBeNull();
    expect(s.challengesDone.has('dry')).toBe(false);
    expect(mods(s).allMult).toBe(2);
  });

  it('every prize is something the handicap is not', () => {
    for (const c of CHALLENGES) {
      expect(c.goal.gt(0)).toBe(true);
      expect(c.prize.length).toBeGreaterThan(0);
      expect(c.handicap.length).toBeGreaterThan(0);
    }
  });
});

describe('saving nights', () => {
  it('remembers the offer, the pick, the challenge and what has been beaten', () => {
    const s = morningAfter();
    pickSpecial(s, s.specialOffer[2]);
    pickChallenge(s, 'round');
    s.challengesDone.add('alone');
    const back = deserialize(serialize(s));
    expect(back.specialOffer).toEqual(s.specialOffer);
    expect(back.special).toBe(s.special);
    expect(back.challenge).toBe('round');
    expect(back.challengeBase.eq(s.challengeBase)).toBe(true);
    expect([...back.challengesDone]).toEqual(['alone']);
  });

  it('drops anything it does not recognise, and old saves start with none', () => {
    const odd = deserialize(btoa(JSON.stringify({ version: 4, special: 'nope', specialOffer: ['nope', 'lock-in'], challenge: 'nope', challengesDone: ['nope', 'dry'] })));
    expect(odd.special).toBeNull();
    expect(odd.specialOffer).toEqual(['lock-in']);
    expect(odd.challenge).toBeNull();
    expect([...odd.challengesDone]).toEqual(['dry']);
    const old = deserialize(btoa(JSON.stringify({ version: 4 })));
    expect(old.specialOffer).toEqual([]);
    expect(old.challengesDone.size).toBe(0);
  });
});
