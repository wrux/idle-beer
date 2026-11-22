/**
 * Ready-made saves for the debug dialog (?debug): the game at particular moments, so a screen
 * that takes hours to reach can be looked at straight away.
 */
import { startFinale } from '../core/bang';
import { invalidate, totalPps } from '../core/economy';
import { VOID_TREE } from '../data/bang';
import { D } from '../core/num';
import { newGame, type GameState } from '../core/state';
import { DRINKERS } from '../data/drinkers';
import { LICENCE } from '../data/licence';
import { LOCATIONS } from '../data/locations';

export interface Scenario {
  id: string;
  name: string;
  desc: string;
  build(now?: number): GameState;
}

/** `first` of the earliest drinker type, thinning out to `last` of the `types`-th. */
function crowd(types: number, first: number, last: number): Record<string, number> {
  const out: Record<string, number> = {};
  DRINKERS.slice(0, types).forEach((d, i) => {
    out[d.id] = Math.round(first + ((last - first) * i) / Math.max(1, types - 1));
  });
  return out;
}

/** Every pub up to and including `id`. */
const pubsTo = (id: string) => new Set(LOCATIONS.slice(0, LOCATIONS.findIndex((l) => l.id === id) + 1).map((l) => l.id));

/** Every Licence node up to `tier` (1-5) in every branch. */
const licenceTo = (tier: number) => new Set(LICENCE.filter((n) => n.tier < tier).map((n) => n.id));

export const SCENARIOS: Scenario[] = [
  {
    id: 'fresh',
    name: 'Brand new game',
    desc: 'One person, one pint, nothing bought.',
    build: (now) => newGame(now),
  },
  {
    id: 'mid',
    name: 'An hour in',
    desc: 'A busy Superpub, a few beers up, long before Last Orders.',
    build(now) {
      const s = newGame(now);
      s.pints = D(4e8);
      s.lifetimePints = D(3e9);
      s.handPints = D(2e6);
      s.drinks = 260;
      s.drinkers = crowd(8, 45, 3);
      s.beer = 3;
      s.pubs = pubsTo('superpub');
      s.pub = 'superpub';
      s.playSeconds = 3600;
      return s;
    },
  },
  {
    id: 'first-prestige',
    name: 'Ready for the first Last Orders',
    desc: 'Never rung the bell. Enough pints for 3 Beer Mats, so the bell has just appeared.',
    build(now) {
      const s = newGame(now);
      s.pints = D(4e12);
      s.lifetimePints = D(3e13);
      s.handPints = D(5e9);
      s.drinks = 900;
      s.drinkers = crowd(12, 70, 2);
      s.beer = 6;
      s.pubs = pubsTo('britain');
      s.pub = 'britain';
      s.bestStreak = 14;
      s.freeRounds = 9;
      s.playSeconds = 3 * 3600;
      return s;
    },
  },
  {
    id: 'veteran',
    name: 'Twenty-four Last Orders later',
    desc: 'A big stack of Beer Mats, half the Licence bought, and another bell worth ringing.',
    build(now) {
      const s = newGame(now);
      s.prestiges = 24;
      s.pastRunsPints = D(6.4e25); // worth 40,000 mats
      s.matsEarned = D(40_000);
      s.beerMats = D(31_000);
      s.licence = licenceTo(3);
      s.licence.add('management-4');
      s.pints = D(2e24);
      s.lifetimePints = D(1e26);
      s.handPints = D(1e20);
      s.drinks = 21_000;
      s.drinkers = crowd(18, 160, 30);
      s.beer = 11;
      s.pubs = pubsTo('outback');
      s.pub = 'outback';
      s.bestStreak = 40;
      s.freeRounds = 310;
      s.playSeconds = 60 * 3600;
      return s;
    },
  },
  {
    id: 'endgame',
    name: 'The end of everything',
    desc: 'Every pub open, the middle of the Licence, drinking in the Multiverse Tavern.',
    build(now) {
      const s = newGame(now);
      s.prestiges = 80;
      s.pastRunsPints = D(1e50);
      s.matsEarned = D(4.6e12);
      s.beerMats = D(4e12);
      s.licence = licenceTo(5);
      s.pints = D(1e52);
      s.lifetimePints = D(1e53);
      s.handPints = D(1e40);
      s.drinks = 400_000;
      s.drinkers = crowd(18, 420, 180);
      s.beer = 16;
      s.pubs = pubsTo('multiverse');
      s.pub = 'multiverse';
      s.bestStreak = 120;
      s.freeRounds = 4_000;
      s.playSeconds = 400 * 3600;
      return s;
    },
  },
  {
    id: 'before-bang',
    name: 'Just before the Big Bang',
    desc: 'A night at 9.5e99 pints, drinking fast enough to reach 1e100, where the universe ends by itself, in about ten seconds.',
    build(now) {
      const s = newGame(now);
      s.prestiges = 60;
      s.pastRunsPints = D('1e95');
      s.licence = licenceTo(5);
      s.drinks = 500_000;
      s.drinkers = crowd(18, 900, 600);
      s.beer = 26;
      s.pubs = pubsTo('multiverse');
      s.pub = 'multiverse';
      s.bestStreak = 150;
      s.freeRounds = 6_000;
      s.playSeconds = 9 * 3600;
      s.universeSeconds = 9 * 3600;
      s.pints = D('9.5e99');
      s.lifetimePints = D('9.5e99');
      // Enough unspent mats for the crowd to drink the last 5e98 pints in about ten seconds.
      // (Measured with a known pile of mats, then scaled: the bonus is as good as proportional to them.)
      s.matsEarned = D('1e80');
      s.beerMats = D('1e60');
      invalidate();
      s.beerMats = D('1e60').mul(D('5e97').div(totalPps(s)));
      invalidate();
      return s;
    },
  },
  {
    id: 'after-bang',
    name: 'A new universe, Black Hole Beers to spend',
    desc: 'Three Big Bangs in: 12 Black Hole Beers in hand, the first perks bought, a Happy Hour and a special running, and the top bar as full as it gets.',
    build(now) {
      const s = newGame(now);
      s.bangs = 3;
      s.voidEarned = 16;
      s.voidBeers = 12;
      s.voidTree = new Set(['matter-1', 'time-1', 'singularity-1']);
      s.prestiges = 90;
      s.drinks = 600_000;
      s.playSeconds = 10 * 3600;
      s.universeSeconds = 30;
      s.fastestUniverse = 95;
      s.beerMats = D(5e26);
      s.matsEarned = D(8e26);
      s.lifetimePints = D('1e80');
      s.special = 'two-for-one';
      s.buffs = [{ kind: 'happyHour', remaining: 70 }];
      return s;
    },
  },
  {
    id: 'one-to-go',
    name: 'One perk from the end',
    desc: 'Every Black Hole Beer perk bought but The Last Pint of All, and the 7 beers to buy it. It opens on the Big Bang screen: buy it, then start the next universe.',
    build(now) {
      const s = newGame(now);
      s.bangs = 23;
      s.voidEarned = 100;
      s.voidBeers = 7;
      s.voidTree = new Set(VOID_TREE.filter((n) => n.id !== 'last-pint').map((n) => n.id));
      s.prestiges = 120;
      s.drinks = 700_000;
      s.playSeconds = 14 * 3600;
      // A universe only just begun, and the Big Bang screen up: nothing happens until you choose.
      s.universeSeconds = 0;
      s.fastestUniverse = 48;
      s.voidOpen = true;
      return s;
    },
  },
  {
    id: 'last-pint',
    name: 'The last pint',
    desc: 'Every Black Hole Beer perk bought and the last universe started: alone in the pub, one pint to drink by hand, and then the end.',
    build(now) {
      const s = newGame(now);
      s.bangs = 24;
      s.voidEarned = 100;
      s.voidTree = new Set(VOID_TREE.map((n) => n.id));
      s.prestiges = 120;
      s.drinks = 700_000;
      s.playSeconds = 14 * 3600;
      s.fastestUniverse = 48;
      startFinale(s, now);
      return s;
    },
  },
  {
    id: 'legend',
    name: 'The morning after, deep in the tree',
    desc: 'After hours with 1e83 mats: the middle of the tree bought, and each long line a different way along.',
    build(now) {
      const s = newGame(now);
      s.prestiges = 200;
      s.pastRunsPints = D('1e200');
      s.matsEarned = D('2e83');
      s.beerMats = D('1e83');
      const along: Record<string, number> = { regulars: 12, brewing: 7, charm: 3, management: 22, technique: 0, collecting: 10 };
      s.licence = new Set(LICENCE.filter((n) => n.tier < 5 || (n.rank ?? 0) <= along[n.branch] && (n.rank || n.tier <= 5 + along[n.branch])).map((n) => n.id));
      s.drinks = 900_000;
      s.playSeconds = 900 * 3600;
      s.afterHours = true;
      s.specialOffer = ['two-for-one', 'strong-stuff', 'lucky-night'];
      s.challengesDone = new Set(['alone']);
      return s;
    },
  },
];
