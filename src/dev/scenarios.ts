/**
 * Ready-made saves for the debug dialog (?debug): the game at particular moments, so a screen
 * that takes hours to reach can be looked at straight away.
 */
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
    desc: 'Every pub open, the whole Licence, drinking in the Multiverse Tavern.',
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
];
