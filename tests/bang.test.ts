import { describe, expect, it } from 'vitest';
import {
  bangGoal, bangReward, bigBang, buyVoid, canBang, collectLiveMats, finaleDue, finishGame, QUICK_UNIVERSE, QUICKER_UNIVERSE, startFinale,
  stopwatch, voidStatus,
} from '../src/core/bang';
import { beerAt } from '../src/data/beers';
import { affordableNow, buyNextRound, invalidate, nextRound, priceOf, upgradeCost } from '../src/core/economy';
import { mods } from '../src/core/licenceState';
import { D } from '../src/core/num';
import { autoBuyLegend, buyLicence, licenceCost, matsOnReset } from '../src/core/prestige';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { VOID_TREE } from '../src/data/bang';
import { DRINKER_BY_ID } from '../src/data/drinkers';
import { LICENCE_BY_ID } from '../src/data/licence';
import { UPGRADES } from '../src/data/upgrades';

/** A night that has drunk the universe dry, some hours into it. */
const dry = (): GameState => {
  const s = newGame(0);
  s.lifetimePints = D('1e100');
  s.pints = D('1e99');
  s.universeSeconds = 10 * 3600;
  invalidate();
  return s;
};

describe('the Big Bang', () => {
  it('needs 1e100 pints in the one night', () => {
    const s = newGame(0);
    s.pastRunsPints = D('1e200'); // other nights don't count
    s.lifetimePints = D('9.9e99');
    expect(canBang(s)).toBe(false);
    expect(bigBang(s)).toBe(0);
    s.lifetimePints = D('1e100');
    expect(canBang(s)).toBe(true);
    s.afterHours = true;
    expect(canBang(s)).toBe(false);
  });

  it('leaves one Black Hole Beer, and more for a quick universe', () => {
    const s = dry();
    expect(bangReward(s)).toBe(1);
    s.universeSeconds = QUICK_UNIVERSE - 1;
    expect(bangReward(s)).toBe(2);
    s.universeSeconds = QUICKER_UNIVERSE - 1;
    expect(bangReward(s)).toBe(3);
  });

  it('takes the night, the mats and the legend, and leaves the rest', () => {
    const s = dry();
    s.pastRunsPints = D('1e120');
    s.beerMats = D(1e30);
    s.matsEarned = D(1e31);
    s.licence = new Set(['regulars-1', 'regulars-x1']);
    s.drinkers = { regular: 900 };
    s.upgrades.add('gulp-1');
    s.beer = 20;
    s.pubs.add('garden');
    s.achievements.add('lifetime-1');
    s.challengesDone.add('dry');
    s.prestiges = 40;
    s.playSeconds = 99;
    expect(bigBang(s, 5000)).toBe(1);
    expect(s.voidBeers).toBe(1);
    expect(s.voidEarned).toBe(1);
    expect(s.bangs).toBe(1);
    expect(s.universeSeconds).toBe(0);
    expect(s.pints.eq(0)).toBe(true);
    expect(s.lifetimePints.eq(0)).toBe(true);
    expect(s.pastRunsPints.eq(0)).toBe(true);
    expect(s.beerMats.eq(0)).toBe(true);
    expect(s.matsEarned.eq(0)).toBe(true);
    expect(s.licence.size).toBe(0);
    expect(s.drinkers).toEqual({});
    expect(s.upgrades.size).toBe(0);
    expect(s.beer).toBe(0);
    expect([...s.pubs]).toEqual(['redlion']);
    expect(s.runStartedAt).toBe(5000);
    // What stays.
    expect(s.achievements.has('lifetime-1')).toBe(true);
    expect(s.challengesDone.has('dry')).toBe(true);
    expect(s.prestiges).toBe(40);
    expect(s.playSeconds).toBe(99);
    expect(matsOnReset(s).eq(0)).toBe(true);
  });
});

describe('the race', () => {
  it('times each universe and keeps the fastest', () => {
    const s = dry();
    s.universeSeconds = 5000;
    bigBang(s);
    expect(s.fastestUniverse).toBe(5000);
    expect(s.universeSeconds).toBe(0);
    s.lifetimePints = D('1e100');
    s.universeSeconds = 90;
    bigBang(s);
    expect(s.fastestUniverse).toBe(90);
    s.lifetimePints = D('1e100');
    s.universeSeconds = 400;
    bigBang(s);
    expect(s.fastestUniverse).toBe(90);
    expect(deserialize(serialize(s)).fastestUniverse).toBe(90);
  });

  it('reads like a stopwatch', () => {
    expect(stopwatch(0)).toBe('0:00');
    expect(stopwatch(42.9)).toBe('0:42');
    expect(stopwatch(725)).toBe('12:05');
    expect(stopwatch(3 * 3600 + 7 * 60 + 9)).toBe('3:07:09');
  });
});

describe('what Black Hole Beers buy', () => {
  it('is sixteen perks for exactly a hundred', () => {
    expect(VOID_TREE).toHaveLength(16);
    expect(VOID_TREE.reduce((sum, n) => sum + n.cost, 0)).toBe(100);
    expect(new Set(VOID_TREE.map((n) => n.id)).size).toBe(16);
  });

  it('is bought down each column, and the last perk needs the bottom of all three', () => {
    const s = newGame(0);
    s.voidBeers = 3;
    expect(voidStatus(s, 'matter-2')).toBe('locked');
    expect(buyVoid(s, 'matter-2')).toBe(false);
    expect(buyVoid(s, 'matter-1')).toBe(true);
    expect(buyVoid(s, 'matter-1')).toBe(false);
    expect(s.voidBeers).toBe(2);
    expect(buyVoid(s, 'matter-2')).toBe(true);
    expect(buyVoid(s, 'matter-3')).toBe(false); // costs 4, none left
    s.voidBeers = 500;
    expect(voidStatus(s, 'last-pint')).toBe('locked');
    for (const n of VOID_TREE) if (!s.voidTree.has(n.id)) expect(buyVoid(s, n.id)).toBe(true);
    expect(s.voidTree.size).toBe(16);
    expect(s.voidBeers).toBe(500 - 97);
  });

  const withPerks = (...ids: string[]): GameState => {
    const s = newGame(0);
    for (const id of ids) s.voidTree.add(id);
    invalidate();
    return s;
  };

  it('Inflation makes each drinker 7% dearer than the last, not 15%', () => {
    const regular = DRINKER_BY_ID.get('regular')!;
    const plain = newGame(0), cheap = withPerks('matter-2');
    expect(priceOf(plain, regular, 100, 1).toNumber()).toBeCloseTo(10 * 1.15 ** 100, -4);
    expect(priceOf(cheap, regular, 100, 1).toNumber()).toBeCloseTo(10 * 1.07 ** 100, -1);
    plain.pints = D(1e9);
    cheap.pints = D(1e9);
    expect(affordableNow(cheap, regular, 0)).toBeGreaterThan(affordableNow(plain, regular, 0) * 1.5);
  });

  it('Free Bar makes beers and upgrades cost nothing', () => {
    const s = withPerks('matter-4');
    expect(upgradeCost(s, UPGRADES[0]).eq(0)).toBe(true);
    s.lifetimePints = D(1e6);
    expect(nextRound(s)!.cost.eq(0)).toBe(true);
    expect(buyNextRound(s)).toBe(true);
  });

  it('Gravity Well doubles everything for each Black Hole Beer held', () => {
    const s = withPerks('singularity-2');
    const base = mods(s).allMult;
    s.voidBeers = 3;
    s.drinkers = { regular: 1 };
    invalidate();
    const three = await0(s);
    s.voidBeers = 0;
    invalidate();
    expect(three / await0(s)).toBeCloseTo(8);
    expect(base).toBe(1);
  });

  it('Spaghettification takes the square root of a long-line price, and nothing else', () => {
    const s = withPerks('singularity-3');
    const step = LICENCE_BY_ID.get('regulars-x10')!, core = LICENCE_BY_ID.get('regulars-5')!, unique = LICENCE_BY_ID.get('regulars-u2')!;
    expect(licenceCost(s, step).log10()).toBeCloseTo(step.cost.log10() / 2, 5);
    expect(licenceCost(s, core).eq(core.cost)).toBe(true);
    expect(licenceCost(s, unique).eq(unique.cost)).toBe(true);
  });

  it('Small Universe and the bonus perks change the goal and the reward', () => {
    const s = withPerks('singularity-1', 'singularity-4', 'singularity-5');
    s.universeSeconds = 10 * 3600;
    expect(bangGoal(s).eq('1e50')).toBe(true);
    expect(bangReward(s)).toBe(4);
  });

  it('Crowded Universe fills the pub after a Big Bang, and the legend never comes through', () => {
    const s = dry();
    s.voidTree.add('time-3');
    s.licence = new Set(['regulars-1', 'regulars-m1', 'regulars-x1']);
    invalidate();
    bigBang(s);
    expect(s.licence.size).toBe(0);
    expect(s.drinkers.multiverse).toBe(500);
    expect(s.drinkers.regular).toBe(500);
  });

  it('Legend in Your Sleep buys the tree as the mats allow, cheapest first', () => {
    const plain = newGame(0);
    plain.beerMats = D(30);
    expect(autoBuyLegend(plain)).toBe(0);

    const s = withPerks('time-4');
    s.beerMats = D(30);
    // Six first perks at 1 mat and six second ones at 4: thirty mats' worth exactly.
    expect(autoBuyLegend(s)).toBe(12);
    expect(s.beerMats.toNumber()).toBe(0);
    expect(s.licence.has('regulars-1') && s.licence.has('collecting-2')).toBe(true);
    expect(autoBuyLegend(s)).toBe(0);
    // A handful at a time, so a mountain of mats doesn't freeze the game for a frame.
    s.beerMats = D('1e200');
    expect(autoBuyLegend(s, 5)).toBe(5);
  });

  it('No More Mornings pays mats as you go and opens the tree at any time', () => {
    const s = withPerks('time-2');
    s.lifetimePints = D(1e19); // worth 1,000 mats
    expect(collectLiveMats(s, matsOnReset(s))).toBe(true);
    expect(s.beerMats.toNumber()).toBe(1000);
    expect(matsOnReset(s).eq(0)).toBe(true);
    expect(collectLiveMats(s, matsOnReset(s))).toBe(false);
    // buyLicence itself never needed the morning after: only the screen did.
    expect(buyLicence(s, 'regulars-1')).toBe(true);
    const plain = newGame(0);
    plain.lifetimePints = D(1e21);
    expect(collectLiveMats(plain, matsOnReset(plain))).toBe(false);
  });
});

describe('the end', () => {
  const owning = (): GameState => {
    const s = newGame(0);
    for (const n of VOID_TREE) s.voidTree.add(n.id);
    s.drinkers = { regular: 50 };
    s.beerMats = D(1e30);
    s.licence.add('regulars-1');
    s.lifetimePints = D('1e60');
    s.voidOpen = true;
    invalidate();
    return s;
  };

  it('only starts once The Last Pint of All is owned', () => {
    const s = newGame(0);
    expect(finaleDue(s)).toBe(false);
    expect(startFinale(s)).toBe(false);
    expect(s.finale).toBe(false);
  });

  it('is an empty universe with the Final Pint in your hand', () => {
    const s = owning();
    expect(finaleDue(s)).toBe(true);
    expect(startFinale(s, 7000)).toBe(true);
    expect(s.finale).toBe(true);
    expect(s.voidOpen).toBe(false);
    // Nobody in, nothing carried over, not even what Crowded Universe would walk you in to.
    expect(s.drinkers).toEqual({});
    expect(s.pints.eq(0)).toBe(true);
    expect(s.beerMats.eq(0)).toBe(true);
    expect(s.licence.size).toBe(0);
    expect(beerAt(s.beer).id).toBe('final');
    // And the universe can't end under you, whatever the numbers say.
    s.lifetimePints = D('1e200');
    expect(canBang(s)).toBe(false);
    expect(startFinale(s)).toBe(false);
  });

  it('ends once, when the pint is drunk, and leaves an ordinary universe behind', () => {
    const s = owning();
    expect(finishGame(s)).toBe(false); // not in the last universe yet
    startFinale(s);
    const drinks = s.drinks;
    expect(finishGame(s)).toBe(true);
    expect(s.finished).toBe(true);
    expect(s.finale).toBe(false);
    expect(s.drinks).toBe(drinks + 1);
    expect(s.beer).toBe(0);
    // The perks still do what they did: Crowded Universe fills the pub again.
    expect(s.drinkers.regular).toBe(500);
    // It never comes round again.
    expect(finaleDue(s)).toBe(false);
    expect(startFinale(s)).toBe(false);
  });

  it('is remembered, so closing the game mid-pint or after the end changes nothing', () => {
    const s = owning();
    startFinale(s);
    expect(deserialize(serialize(s)).finale).toBe(true);
    finishGame(s);
    const back = deserialize(serialize(s));
    expect(back.finale).toBe(false);
    expect(back.finished).toBe(true);
    // A save claiming the last universe without the perk is not believed.
    const odd = deserialize(btoa(JSON.stringify({ version: 4, finale: true })));
    expect(odd.finale).toBe(false);
  });
});

describe('saving the Big Bang', () => {
  it('remembers Black Hole Beers, perks and how long the universe has lasted', () => {
    const s = newGame(0);
    s.voidBeers = 4;
    s.voidEarned = 9;
    s.bangs = 3;
    s.voidTree = new Set(['matter-1', 'time-1']);
    s.universeSeconds = 1234;
    const back = deserialize(serialize(s));
    expect(back.voidBeers).toBe(4);
    expect(back.voidEarned).toBe(9);
    expect(back.bangs).toBe(3);
    expect([...back.voidTree]).toEqual(['matter-1', 'time-1']);
    expect(back.universeSeconds).toBe(1234);
  });

  it('remembers that the Big Bang screen is still up, so a reload comes back to it', () => {
    const s = dry();
    expect(s.voidOpen).toBe(false);
    bigBang(s);
    expect(s.voidOpen).toBe(true);
    expect(deserialize(serialize(s)).voidOpen).toBe(true);
    s.voidOpen = false; // closed
    expect(deserialize(serialize(s)).voidOpen).toBe(false);
  });

  it('an old save has none, and its play so far is its first universe', () => {
    const old = deserialize(btoa(JSON.stringify({ version: 4, playSeconds: 5000, voidTree: ['nope'] })));
    expect(old.voidBeers).toBe(0);
    expect(old.voidTree.size).toBe(0);
    expect(old.universeSeconds).toBe(5000);
  });
});

/** Total drinker output as a plain number, for comparing. */
import { totalPps } from '../src/core/economy';
function await0(s: GameState): number {
  return totalPps(s).toNumber();
}
