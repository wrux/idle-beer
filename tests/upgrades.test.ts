import { describe, expect, it } from 'vitest';
import {
  availableUpgrades, buyNextRound, buyPub, buyUpgrade, costOf, currentBeer, drinkTime, globalMult, hasDownInOne,
  invalidate, nextRound, offlineGain, pintsPerDrink, priceOf, pubBonus, pubCooldownLeft, pubStatuses, refillTime, selectPub, selectPub as move, totalPps,
} from '../src/core/economy';
import { buyAllUpgrades } from '../src/core/economy';
import { mods } from '../src/core/licenceState';
import { PUB_COOLDOWN_SECONDS } from '../src/core/pubs';
import { lastOrders } from '../src/core/prestige';
import { D } from '../src/core/num';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { BEERS, beerAt } from '../src/data/beers';
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
    expect(currentBeer(s).id).toBe('shandy');
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

  it('end at The Final Pint: there is nothing after it to buy', () => {
    const s = rich();
    s.pints = D('1e9000');
    s.lifetimePints = D('1e9000');
    for (let i = 1; i < BEERS.length; i++) expect(buyNextRound(s)).toBe(true);
    expect(currentBeer(s).id).toBe('final');
    expect(nextRound(s)).toBeNull();
    const before = globalMult(s);
    expect(buyNextRound(s)).toBe(false);
    expect(globalMult(s).eq(before)).toBe(true);
    expect(beerAt(BEERS.length + 42)).toBe(BEERS[BEERS.length - 1]);
  });

  it('every beer has a name and a look of its own', () => {
    expect(new Set(BEERS.map((b) => b.id)).size).toBe(BEERS.length);
    expect(new Set(BEERS.map((b) => b.name)).size).toBe(BEERS.length);
    const looks = BEERS.map((b) => `${b.look.glass}|${b.look.effect}|${b.look.liquid}|${b.look.vessel ?? ''}|${b.look.size ?? 1}`);
    expect(new Set(looks).size).toBe(BEERS.length);
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
    expect(buyPub(s, 'highstreet', 0)).toBe(true);
    expect(s.pints.toNumber()).toBe(0);
    expect(s.pub).toBe('highstreet');
    expect(totalPps(s).toNumber()).toBeCloseTo(1.04); // third pub along: +4%
    expect(buyPub(s, 'garden', 0)).toBe(false); // can't afford it now

    const later = PUB_COOLDOWN_SECONDS * 1000;
    expect(selectPub(s, 'redlion', later)).toBe(true);
    expect(totalPps(s).toNumber()).toBeCloseTo(1);
    expect(selectPub(s, 'moon', later * 3)).toBe(false); // not open
  });

  it('make you stay put for a while after moving, so perks cannot be cherry-picked', () => {
    const s = newGame();
    s.pubs = new Set(['redlion', 'garden', 'highstreet']);
    expect(pubCooldownLeft(s, 0)).toBe(0);
    expect(selectPub(s, 'garden', 0)).toBe(true);
    expect(pubCooldownLeft(s, 1000)).toBe(PUB_COOLDOWN_SECONDS - 1);
    expect(selectPub(s, 'redlion', 60_000)).toBe(false);
    expect(s.pub).toBe('garden');
    expect(selectPub(s, 'redlion', PUB_COOLDOWN_SECONDS * 1000)).toBe(true);

    // Opening a new pub is always allowed, and counts as a move.
    s.lifetimePints = D(1e8);
    s.pints = D(1e8);
    const t = PUB_COOLDOWN_SECONDS * 1000 + 5000;
    expect(buyPub(s, 'superpub', t)).toBe(true);
    expect(selectPub(s, 'garden', t + 1000)).toBe(false);

    // Last Orders clears it, and a saved cooldown survives a reload.
    const back = deserialize(serialize(s), t);
    expect(pubCooldownLeft(back, t)).toBe(PUB_COOLDOWN_SECONDS);
    lastOrders(s);
    expect(pubCooldownLeft(s, t)).toBe(0);
  });

  it('each have a perk that only applies while you are there', () => {
    const s = newGame();
    const regular = DRINKER_BY_ID.get('regular')!;
    expect(mods(s).streakSlack).toBe(1); // The Red Lion
    s.pubs = new Set(LOCATIONS.map((l) => l.id));
    /** Move without waiting out the cooldown. */
    const selectPub = (state: GameState, id: string) => {
      state.pubReadyAt = 0;
      return move(state, id);
    };

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

describe('Buy all', () => {
  it('buys every upgrade you can afford, cheapest first, and stops at the first you cannot', () => {
    const s = newGame(0);
    s.drinks = 30; // Bigger Gulps (50), Two-Handed (50) and Quick Pour (200) are on offer
    s.pints = D(120);
    invalidate();
    expect(buyAllUpgrades(s)).toBe(2);
    expect(s.upgrades.has('gulp-1') && s.upgrades.has('perdrink-1')).toBe(true);
    expect(s.upgrades.has('pour-1')).toBe(false);
    expect(s.pints.toNumber()).toBe(20);
    expect(buyAllUpgrades(s)).toBe(0);
  });

  it('goes round again for what buying one brings into the shop, and buys nothing on Empty Shelves', () => {
    const s = newGame(0);
    s.drinks = 5000;
    s.pints = D(1e12);
    invalidate();
    const first = availableUpgrades(s).length;
    expect(buyAllUpgrades(s)).toBeGreaterThanOrEqual(first);
    const t = newGame(0);
    t.drinks = 5000;
    t.pints = D(1e12);
    t.challenge = 'shelves';
    invalidate();
    expect(buyAllUpgrades(t)).toBe(0);
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

  it('gives an old save a beer worth about what its old one was', () => {
    // Old beer 6 was the Craft Double IPA at 2e12: the same price as today's Hladinka.
    expect(beerAt(deserialize(btoa(JSON.stringify({ version: 3, beer: 6 }))).beer).id).toBe('hladinka');
    // "Brew Again" levels from the very first saves counted as beers after number 12 (so 15, at 1e47).
    expect(beerAt(deserialize(btoa(JSON.stringify({ version: 1, beer: 12, brewAgain: 3 }))).beer).id).toBe('yard');
    // Anything past the old end of the list, generated beers included, is The Final Pint.
    expect(beerAt(deserialize(btoa(JSON.stringify({ version: 3, beer: 30 }))).beer).id).toBe('final');
    expect(beerAt(deserialize(btoa(JSON.stringify({ version: 3, beer: 5000 }))).beer).id).toBe('final');
    // A save already on the new list is left alone.
    expect(deserialize(btoa(JSON.stringify({ version: 4, beer: 6 }))).beer).toBe(6);
  });
});
