import { describe, expect, it } from 'vitest';
import {
  availableUpgrades, buyNextRound, buyPub, buyUpgrade, costOf, currentBeer, drinkTime, globalMult, hasDownInOne,
  invalidate, nextRound, offlineGain, pintsPerDrink, priceOf, pubBonus, pubStatuses, refillTime, selectPub, totalPps,
} from '../src/core/economy';
import { mods } from '../src/core/licenceState';
import { lastOrders } from '../src/core/prestige';
import { D } from '../src/core/num';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { BEERS, beerAt, generatedBeerName } from '../src/data/beers';
import { DRINKERS, DRINKER_BY_ID } from '../src/data/drinkers';
import { LOCATIONS } from '../src/data/locations';
import { UPGRADES } from '../src/data/upgrades';

/** The bonus from the pub a save is in (new games are at The Red Lion, which adds nothing to output). */
const loc = (s: GameState) => pubBonus(s.pub);

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

describe('pubs', () => {
  it('are opened with pints, then you can move between them', () => {
    const s = newGame();
    s.drinkers = { student: 1 };
    invalidate();
    expect(totalPps(s).toNumber()).toBeCloseTo(1);
    expect(pubStatuses(s).slice(0, 3)).toEqual(['here', 'mystery', 'hidden']);

    s.lifetimePints = D(1e5);
    s.pints = D(1e5);
    expect(pubStatuses(s).slice(0, 4)).toEqual(['here', 'forSale', 'forSale', 'mystery']);
    expect(buyPub(s, 'highstreet')).toBe(true);
    expect(s.pints.toNumber()).toBe(0);
    expect(s.pub).toBe('highstreet');
    expect(totalPps(s).toNumber()).toBeCloseTo(1.04); // third pub along: +4%
    expect(buyPub(s, 'garden')).toBe(false); // can't afford it now

    expect(selectPub(s, 'redlion')).toBe(true);
    expect(totalPps(s).toNumber()).toBeCloseTo(1);
    expect(selectPub(s, 'moon')).toBe(false); // not open
  });

  it('each have a perk that only applies while you are there', () => {
    const s = newGame();
    const regular = DRINKER_BY_ID.get('regular')!;
    expect(mods(s).streakSlack).toBe(1); // The Red Lion
    s.pubs = new Set(LOCATIONS.map((l) => l.id));

    selectPub(s, 'highstreet');
    expect(mods(s).streakSlack).toBe(0);
    expect(priceOf(s, regular, 0, 1).toNumber()).toBe(10); // 9.5, rounded up
    expect(priceOf(s, regular, 20, 1).toNumber()).toBe(Math.ceil(costOf(regular, 20, 1).toNumber() * 0.95));

    selectPub(s, 'superpub');
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo(3 * pubBonus('superpub'));

    selectPub(s, 'moon');
    expect(drinkTime(s)).toBeCloseTo(0.7);

    selectPub(s, 'town');
    expect(offlineGain(s, 1e9).seconds).toBe(2 * 60 * 60);

    selectPub(s, 'multiverse');
    expect(pintsPerDrink(s).toNumber()).toBeCloseTo(1.5 * pubBonus('multiverse'));
  });

  it('close again at Last Orders', () => {
    const s = newGame();
    s.pubs = new Set(['redlion', 'garden']);
    s.pub = 'garden';
    lastOrders(s);
    expect([...s.pubs]).toEqual(['redlion']);
    expect(s.pub).toBe('redlion');
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
