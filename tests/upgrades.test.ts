import { describe, expect, it } from 'vitest';
import {
  availableUpgrades, buyNextRound, buyUpgrade, currentBeer, drinkTime, globalMult, hasDownInOne,
  invalidate, nextRound, pintsPerDrink, refillTime, totalPps,
} from '../src/core/economy';
import { D } from '../src/core/num';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { BEERS, beerAt, generatedBeerName } from '../src/data/beers';
import { DRINKERS } from '../src/data/drinkers';
import { LOCATION_BONUS, locationIndex } from '../src/data/locations';
import { UPGRADES } from '../src/data/upgrades';

/** The location bonus a save gets from its lifetime pints (rich saves are at the Multiverse). */
const loc = (s: GameState) => 1 + LOCATION_BONUS * locationIndex(s.lifetimePints);

const rich = (): GameState => {
  const s = newGame();
  s.pints = D('1e100');
  s.lifetimePints = D('1e100');
  return s;
};

describe('upgrade catalogue', () => {
  it('has about 250 upgrades with unique ids', () => {
    expect(UPGRADES.length).toBeGreaterThanOrEqual(240);
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });

  it('every drinker gets 11 named tier upgrades', () => {
    for (const d of DRINKERS) {
      const tiers = UPGRADES.filter((u) => u.effect.kind === 'drinker' && u.effect.drinker === d.id);
      expect(tiers).toHaveLength(11);
      expect(tiers.every((u) => u.name && u.name.length > 1)).toBe(true);
    }
  });
});

describe('buying upgrades', () => {
  it('drinker tiers double that drinker', () => {
    const s = rich();
    s.drinkers = { regular: 10 };
    invalidate();
    const before = totalPps(s);
    expect(buyUpgrade(s, 'regular-1')).toBe(true);
    expect(totalPps(s).div(before).toNumber()).toBeCloseTo(2);
  });

  it('cannot buy what has not unlocked, or twice', () => {
    const s = rich();
    expect(buyUpgrade(s, 'regular-1')).toBe(false); // own no Regulars yet
    s.drinkers = { regular: 1 };
    expect(buyUpgrade(s, 'regular-1')).toBe(true);
    expect(buyUpgrade(s, 'regular-1')).toBe(false);
  });

  it('synergies scale with the source drinker count', () => {
    const s = rich();
    s.drinkers = { student: 20, rugby: 10 };
    invalidate();
    const rugby = D(260).mul(10).mul(loc(s));
    const studentsBefore = totalPps(s).sub(rugby);
    expect(buyUpgrade(s, 'syn-student-rugby')).toBe(true);
    const studentsAfter = totalPps(s).sub(rugby);
    expect(studentsAfter.div(studentsBefore).toNumber()).toBeCloseTo(1 + 0.05 * 10);
  });

  it('pub upgrades boost idle and hand income', () => {
    const s = rich();
    s.drinkers = { student: 1 };
    invalidate();
    buyUpgrade(s, 'pub-jukebox');
    expect(totalPps(s).toNumber()).toBeCloseTo(1.05 * loc(s));
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo(1.05 * loc(s));
  });

  it('drinking upgrades speed you up, down to a floor', () => {
    const s = rich();
    s.drinks = 1e6;
    for (const u of UPGRADES.filter((x) => x.effect.kind === 'drinkTime' || x.effect.kind === 'refillTime')) {
      buyUpgrade(s, u.id);
    }
    expect(drinkTime(s)).toBe(0.25); // 1.0 × 0.8⁸ ≈ 0.17, held at the floor
    expect(refillTime(s)).toBeCloseTo(0.4 * 0.6 ** 3);
    expect(hasDownInOne(s)).toBe(false);
    buyUpgrade(s, 'down-in-one');
    expect(hasDownInOne(s)).toBe(true);
  });

  it('Liquid Lunch adds seconds of idle income to each drink', () => {
    const s = rich();
    s.drinkers = { student: 100 }; // 100/s
    invalidate();
    buyUpgrade(s, 'lunch-1'); // +0.1s
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo((1 + 10) * loc(s));
  });

  it('lists available upgrades cheapest first', () => {
    const s = rich();
    s.drinkers = { regular: 50, student: 50 };
    s.drinks = 100;
    const list = availableUpgrades(s);
    for (let i = 1; i < list.length; i++) expect(list[i].cost.gte(list[i - 1].cost)).toBe(true);
  });
});

describe('beers', () => {
  it('are bought in order and multiply everything', () => {
    const s = rich();
    s.drinkers = { student: 1 };
    invalidate();
    expect(currentBeer(s).id).toBe('lager');
    expect(buyNextRound(s)).toBe(true);
    expect(currentBeer(s).id).toBe('bitter');
    expect(totalPps(s).toNumber()).toBeCloseTo(1.5 * loc(s));
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo(1.5 * loc(s));
  });

  it('stay hidden until lifetime pints reach half the price', () => {
    const s = newGame();
    s.lifetimePints = D(49); // the Bitter costs 100
    expect(nextRound(s)).toBeNull();
    s.lifetimePints = D(50);
    expect(nextRound(s)?.beer.id).toBe('bitter');
  });

  it('carry on forever after the hand-written ones, each with its own name', () => {
    const s = rich();
    s.pints = D('1e9000');
    s.lifetimePints = D('1e9000');
    for (let i = 1; i < BEERS.length + 5; i++) expect(buyNextRound(s)).toBe(true);
    expect(currentBeer(s).id).toBe('gen-4');
    const before = globalMult(s);
    expect(buyNextRound(s)).toBe(true);
    expect(globalMult(s).div(before).toNumber()).toBeCloseTo(3);
  });

  it('generated beers get unique names and always look the same', () => {
    const names = new Set<string>();
    for (let n = 0; n < 9600; n++) names.add(generatedBeerName(n));
    expect(names.size).toBe(9600);
    expect(beerAt(BEERS.length + 42)).toEqual(beerAt(BEERS.length + 42));
    expect(beerAt(BEERS.length + 42).cost.gt(beerAt(BEERS.length + 41).cost)).toBe(true);
  });

  it('every hand-written beer costs more than the last', () => {
    for (let i = 2; i < BEERS.length; i++) expect(BEERS[i].cost.gt(BEERS[i - 1].cost)).toBe(true);
  });
});

describe('locations', () => {
  it('move as lifetime pints grow and add 2% each', () => {
    const s = newGame();
    s.drinkers = { student: 1 };
    invalidate();
    expect(locationIndex(s.lifetimePints)).toBe(0);
    expect(totalPps(s).toNumber()).toBeCloseTo(1);
    s.lifetimePints = D(1e5);
    invalidate();
    expect(locationIndex(s.lifetimePints)).toBe(2);
    expect(totalPps(s).toNumber()).toBeCloseTo(1.04);
  });
});

describe('saving upgrades and beers', () => {
  it('round-trips', () => {
    const s = rich();
    s.drinkers = { regular: 5 };
    buyUpgrade(s, 'regular-1');
    buyNextRound(s);
    const back = deserialize(serialize(s));
    expect([...back.upgrades]).toEqual(['regular-1']);
    expect(back.beer).toBe(1);
  });

  it('drops unknown upgrade ids and broken beer values', () => {
    const text = btoa(JSON.stringify({ version: 1, upgrades: ['regular-1', 'made-up'], beer: -4 }));
    const s = deserialize(text);
    expect([...s.upgrades]).toEqual(['regular-1']);
    expect(s.beer).toBe(0);
  });

  it('turns old Brew Again levels into the beers after Singularity Stout', () => {
    const s = deserialize(btoa(JSON.stringify({ version: 1, beer: 12, brewAgain: 3 })));
    expect(s.beer).toBe(15);
    expect(beerAt(s.beer).name).toBe('Nebula Hazy IPA'); // 12 + 3: Quasar, Pulsar, Nebula
  });
});
