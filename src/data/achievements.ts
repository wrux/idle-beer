/**
 * Achievements (DESIGN.md §10), mostly generated from templates. Each one earns
 * Reputation, which Reputation upgrades turn into a bonus to everything.
 */
import { format } from '../core/format';
import { D, Decimal } from '../core/num';
import { owned, type GameState } from '../core/state';
import { BEERS } from './beers';
import { DRINKERS } from './drinkers';
import { LICENCE } from './licence';
import { LOCATIONS } from './locations';

export interface AchievementContext {
  /** Current pints per second. */
  pps: Decimal;
  /** Local time, for the time-of-day ones. */
  now: Date;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Hidden until unlocked (the joke ones). */
  hidden?: boolean;
  /**
   * Checked a few times a second. Achievements without a check are granted
   * directly by the game when something happens (see GRANTED).
   */
  check?: (s: GameState, ctx: AchievementContext) => boolean;
}

const noun = (name: string) => name.replace(/^The /, '');
/** "1 million", "1,000", "1e303": readable in descriptions. */
const nice = (n: string) => format(D(n), true);

// ---------- lifetime pints ----------

const LIFETIME: [string, string][] = [
  ['1', 'First Pint'], ['1e2', 'Getting a Taste'], ['1e3', 'Regular Customer'], ['1e4', 'Running a Tab'],
  ['1e5', "Brewery's Best Friend"], ['1e6', "Millionaire's Round"], ['1e7', 'Liver of Steel'],
  ['1e8', 'Legend of the Local'], ['1e9', 'A Billion Bottles of Beer'], ['1e10', 'Ten-Billion Thirst'],
  ['1e11', 'Barrel Baron'], ['1e12', 'Trillion Thirst'], ['1e13', 'Brewery on Speed Dial'],
  ['1e14', 'Hops Hoarder'], ['1e15', 'Quadrillion Quaffer'], ['1e18', 'Quintillion Quencher'],
  ['1e21', 'Sextillion Sesh'], ['1e24', 'Septillion Swigs'], ['1e27', 'Octillion Ale'],
  ['1e30', 'Nonillion Nightcaps'], ['1e33', 'Decillion Drams'], ['1e36', 'Thirst Without End'],
  ['1e39', 'Oceans of Ale'], ['1e42', 'Planetary Pints'], ['1e45', 'Stellar Session'],
  ['1e50', 'Galactic Gallons'], ['1e60', 'Cosmic Kegs'], ['1e75', 'Universal Usual'],
  ['1e100', 'A Googol of Grog'], ['1e150', 'Beyond Counting'], ['1e200', 'Infinite Tab'],
  ['1e303', 'Centillion Session'], ['1e500', 'The Number Ran Out'], ['1e1000', 'A Thousand Zeros'],
  ['1e10000', 'Mathematically Hammered'],
];

const lifetimeAchievements: Achievement[] = LIFETIME.map(([n, name]) => ({
  id: `lifetime-${n}`, name, icon: '🍺',
  desc: `Drink ${n === '1' ? 'your first pint' : `${nice(n)} pints in total`}.`,
  check: (s) => s.lifetimePints.gte(n),
}));

// ---------- pints per second ----------

const PPS: [string, string][] = [
  ['1', 'Steady Sipper'], ['10', 'Busy Bar'], ['100', 'Rammed on a Friday'], ['1e3', 'Standing Room Only'],
  ['1e4', 'Queue Out the Door'], ['1e5', 'Taps Never Stop'], ['1e6', 'A Million a Second'],
  ['1e7', 'Brewery Can\'t Keep Up'], ['1e8', 'National Shortage'], ['1e9', 'Billion-Pint Heartbeat'],
  ['1e10', 'Rivers of Bitter'], ['1e11', 'Tidal Taproom'], ['1e12', 'Trillion a Tick'],
  ['1e15', 'Pouring Faster Than Light'], ['1e18', 'Relativistic Rounds'], ['1e21', 'Black Hole Bar Tab'],
  ['1e24', 'Big Bang Every Second'], ['1e30', 'Cosmic Flow'], ['1e40', 'Omnipresent Pint'],
];

const ppsAchievements: Achievement[] = PPS.map(([n, name]) => ({
  id: `pps-${n}`, name, icon: '⏱️',
  desc: `Drink ${nice(n)} pints per second.`,
  check: (_s, ctx) => ctx.pps.gte(n),
}));

// ---------- drinker counts ----------

const DRINKER_MILESTONES: [number, (n: string) => string][] = [
  [1, (n) => `The ${n} Arrives`],
  [50, (n) => `${n} Fan Club`],
  [100, (n) => `${n} Hall of Fame`],
];

const drinkerAchievements: Achievement[] = DRINKERS.flatMap((d) =>
  DRINKER_MILESTONES.map(([need, name]) => ({
    id: `drinker-${d.id}-${need}`,
    name: name(noun(d.name)),
    icon: d.icon,
    desc: need === 1 ? `Get your first ${noun(d.name)}.` : `Have ${need} × ${d.name}.`,
    check: (s: GameState) => owned(s, d.id) >= need,
  })),
);

// ---------- drinking by hand ----------

const HAND: [number, string][] = [
  [10, 'Finding Your Rhythm'], [100, 'Proper Drinker'], [1000, 'Elbow Exercise'],
  [10_000, 'Repetitive Strain Injury'], [100_000, 'Arm of Iron'],
];

const handAchievements: Achievement[] = HAND.map(([n, name]) => ({
  id: `drinks-${n}`, name, icon: '💪',
  desc: `Drink ${n.toLocaleString('en-GB')} pints by hand.`,
  check: (s) => s.drinks >= n,
}));

// ---------- streaks, Free Rounds, upgrades ----------

const misc: Achievement[] = [
  ...([[3, 'Getting Going'], [6, 'On a Roll'], [11, 'Maximum Chug'], [25, 'Unstoppable'], [50, 'Bottomless']] as const)
    .map(([n, name]) => ({
      id: `streak-${n}`, name, icon: '🔥', desc: `Drink ${n} pints in a row.`,
      check: (s: GameState) => s.bestStreak >= n,
    })),
  ...([[1, 'Free Round!'], [7, 'Lucky Seven'], [27, 'Golden Touch'], [77, 'Golden Pint Hunter']] as const)
    .map(([n, name]) => ({
      id: `freerounds-${n}`, name, icon: '🌟', desc: `Claim ${n} Free Round${n > 1 ? 's' : ''}.`,
      check: (s: GameState) => s.freeRounds >= n,
    })),
  ...([[10, 'Kitting Out the Pub'], [50, 'Refurbishment'], [100, 'Full Makeover'], [200, 'Nothing Left to Buy']] as const)
    .map(([n, name]) => ({
      id: `upgrades-${n}`, name, icon: '🛠️', desc: `Buy ${n} upgrades.`,
      check: (s: GameState) => s.upgrades.size >= n,
    })),
];

// ---------- beers and locations ----------

const BEER_MILESTONES: [number, string, string][] = [
  [1, 'Moving On Up', 'Graduate from the Half of Shandy.'],
  [3, 'Pint of the Black Stuff', 'Get on to the Nitro Stout.'],
  [9, 'Ein Prosit', 'Lift a full litre of German Maß.'],
  [15, 'All in One Go', 'Take on the Yard of Ale.'],
  [20, 'Here Be Dragons', "Brave the Dragon's Breath Ale."],
  [25, 'Event Horizon', 'Drink Singularity Stout.'],
  [BEERS.length - 1, 'It Was This All Along', 'Reach The Final Pint.'],
];

const beerAchievements: Achievement[] = BEER_MILESTONES.map(([n, name, desc]) => ({
  id: `beer-${n}`, name, desc, icon: '🍻', check: (s: GameState) => s.beer >= n,
}));

const locationAchievements: Achievement[] = LOCATIONS.slice(1).map((loc) => ({
  id: `location-${loc.id}`, name: `Welcome to ${loc.name}`, icon: '🗺️',
  desc: `Get known at ${loc.name}.`,
  check: (s: GameState) => s.pubs.has(loc.id),
}));

// ---------- Last Orders ----------

const prestigeAchievements: Achievement[] = [
  ...([[1, 'Last Orders!', '🔔'], [5, 'Regular at Closing Time', '🔔'], [25, 'Lock-In Legend', '🔔'], [100, 'Eternal Closing Time', '🔔']] as const)
    .map(([n, name, icon]) => ({
      id: `prestige-${n}`, name, icon, desc: n === 1 ? 'Drink up at Last Orders for the first time.' : `Drink up at Last Orders ${n} times.`,
      check: (s: GameState) => s.prestiges >= n,
    })),
  ...([['1e2', 'Coaster Collector'], ['1e4', 'Beer Mat Mountain'], ['1e6', 'A Million Mats'], ['1e9', 'Mat Magnate']] as const)
    .map(([n, name]) => ({
      id: `mats-${n}`, name, icon: '🟫', desc: `Earn ${nice(n)} Beer Mats in total.`,
      check: (s: GameState) => s.matsEarned.gte(n),
    })),
  {
    id: 'licence-first', name: 'Known Round Here', icon: '📜', desc: 'Earn your first Local Legend perk.',
    check: (s) => s.licence.size >= 1,
  },
  {
    id: 'licence-all', name: 'Living Legend', icon: '📜', desc: 'Earn every Local Legend perk.',
    check: (s) => s.licence.size >= LICENCE.length,
  },
];

// ---------- hidden ones ----------

const hidden: Achievement[] = [
  {
    id: 'designated-driver', name: 'Designated Driver', icon: '🚗', hidden: true,
    desc: 'Earn a million pints without moving on from the Half of Shandy.',
    check: (s) => s.beer === 0 && s.lifetimePints.gte(1e6),
  },
  {
    id: 'self-service', name: 'Self-Service', icon: '🙋', hidden: true,
    desc: 'Drink 250 pints by hand without paying anyone to join you.',
    check: (s) => s.drinks >= 250 && DRINKERS.every((d) => owned(s, d.id) === 0),
  },
  {
    id: 'lock-in', name: 'Lock-In', icon: '🌙', hidden: true,
    desc: 'Be in the pub between midnight and 5am.',
    check: (s, ctx) => s.drinks > 0 && ctx.now.getHours() < 5,
  },
  {
    id: 'sunday-session', name: 'Sunday Session', icon: '🍖', hidden: true,
    desc: 'Have a pint on a Sunday.',
    check: (s, ctx) => s.drinks > 0 && ctx.now.getDay() === 0,
  },
  { id: 'hair-of-the-dog', name: 'Hair of the Dog', icon: '🐕', hidden: true, desc: 'Come back after 8 hours away.' },
  { id: 'silent-pint', name: 'A Quiet One', icon: '🔇', hidden: true, desc: 'Turn the sound off.' },
  { id: 'missed-it', name: 'Missed the Round', icon: '😩', hidden: true, desc: 'Let a Free Round get away.' },
];

/** Achievements granted by the game directly rather than by a check. */
export type GrantedAchievement = 'hair-of-the-dog' | 'silent-pint' | 'missed-it';

export const ACHIEVEMENTS: Achievement[] = [
  ...lifetimeAchievements, ...ppsAchievements, ...handAchievements, ...misc,
  ...beerAchievements, ...locationAchievements, ...prestigeAchievements, ...drinkerAchievements, ...hidden,
];
export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Unlock any achievements whose conditions are now met. Returns the newly unlocked ones. */
export function checkAchievements(s: GameState, ctx: AchievementContext): Achievement[] {
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.has(a.id) || !a.check?.(s, ctx)) continue;
    s.achievements.add(a.id);
    fresh.push(a);
  }
  return fresh;
}

/** Unlock an achievement the game grants directly. Returns it if it's new. */
export function grantAchievement(s: GameState, id: GrantedAchievement): Achievement | null {
  if (s.achievements.has(id)) return null;
  s.achievements.add(id);
  return ACHIEVEMENT_BY_ID.get(id) ?? null;
}
