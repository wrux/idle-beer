/**
 * Every upgrade in the game, mostly generated from templates (DESIGN.md §5).
 * Effects are plain data; economy.ts folds them into multipliers.
 */
import { D, Decimal } from '../core/num';
import { owned, type GameState } from '../core/state';
import { DRINKERS, DRINKER_BY_ID } from './drinkers';

export type Effect =
  /** One drinker type produces `mult`× as much. */
  | { kind: 'drinker'; drinker: string; mult: number }
  /** `target` produces +perUnit (e.g. 0.05 = +5%) for every `source` you own. */
  | { kind: 'synergy'; target: string; source: string; perUnit: number }
  /** Everything (idle and by hand) ×(1 + add). */
  | { kind: 'global'; add: number }
  | { kind: 'perDrink'; mult: number }
  | { kind: 'drinkTime'; mult: number }
  | { kind: 'refillTime'; mult: number }
  /** A single click drinks the whole pint. */
  | { kind: 'downInOne' }
  /** Each drink also earns this many seconds of idle production. */
  | { kind: 'liquidLunch'; seconds: number }
  /** Everything ×(1 + rate × achievements unlocked). */
  | { kind: 'reputation'; rate: number };

export type UpgradeGroup = 'drinker' | 'drinking' | 'synergy' | 'pub' | 'reputation';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Small label over the icon, e.g. a tier numeral. */
  badge?: string;
  group: UpgradeGroup;
  cost: Decimal;
  /** When it appears in the store. */
  unlocked: (s: GameState) => boolean;
  effect: Effect;
}

/** "The Regular" reads badly mid-sentence ("every The Regular"), so drop the article. */
const noun = (name: string) => name.replace(/^The /, '');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// ---------- 1. drinker tier upgrades: ×2 at owned milestones ----------

/** [owned needed, cost as a multiple of the drinker's base cost] */
const DRINKER_TIERS: [number, number][] = [
  [1, 10], [5, 50], [25, 500], [50, 5e4], [100, 5e6], [150, 5e8],
  [200, 5e10], [250, 5e13], [300, 5e16], [400, 5e20], [500, 5e24],
];

const DRINKER_UPGRADE_NAMES: Record<string, string[]> = {
  regular: ['Own Tankard', 'Name on the Stool', 'Lifetime Tab', 'Reserved Corner', 'Dog at His Feet',
    "Knows the Landlord's Mum", 'Crossword Champion', 'Brass Plaque', 'Saw the Pub Built',
    'Older Than the Pub', 'Part of the Furniture'],
  student: ["Freshers' Week", 'Student Loan Day', 'Two-for-One Wristbands', 'Society Social', 'Pub Golf',
    'Dissertation Avoidance', 'Reading Week', 'Graduation Pints', 'Gap Yah', 'Mature Student', 'Eternal PhD'],
  darts: ['Tungsten Darts', 'Oche Extension', 'Nine-Dart Finish', 'Sponsored Shirts', 'Walk-On Music',
    'League Champions', 'Bullseye Banter', 'Floor Trophy', 'Big Stage Debut', 'Big Fish', 'Legendary Checkout'],
  stag: ['L-Plates', 'Inflatable Accessories', 'Matching T-Shirts', "Best Man's Speech", 'Weekend Abroad',
    'Missing Groom', 'Kebab Pit Stop', 'Shot Roulette', 'Three-Day Stag', 'Fancy Dress Theme', 'Stag of Legend'],
  rugby: ['Boat Race', 'Scrum Down', 'Third Half', 'Kit Sponsorship', 'Shoeys', 'Clubhouse Bar', 'Tour Bus',
    'Hip Flask Hymns', 'Six Nations Weekend', 'Lions Tour', 'Hall of Fame'],
  supporters: ['Pre-Match Pints', 'Away Day Coach', 'Half-Time Dash', 'Scarf Season', 'Derby Day', 'Cup Run',
    'Promotion Party', 'Open-Top Bus', 'European Away', 'Season Ticket for Life', 'Treble Winners'],
  wmc: ['Meat Raffle', 'Bingo Night', 'Subsidised Bitter', 'Turn on the Club Stage', 'Committee Vote',
    'Pool League', 'Christmas Do', "Members' Card", 'Domino Champions', 'Club Trip to Blackpool', 'Life Members'],
  beerfest: ['Tasting Glasses', 'Token Lanyards', 'Real Ale Society', 'Beard Growth', 'Sandal Season',
    'Cask of the Show', 'Volunteer Crew', 'Bring Your Own Tankard', 'Trade Session', 'Champion Beer', 'Festival Legend'],
  musicfest: ['Warm Cans', 'Wellies', 'Bucket Hats', 'Flags on Poles', 'Secret Set', 'Headliner Pints',
    'Hospitality Tent', 'Glamping', 'Silent Disco Bar', 'Main Stage Bar', 'Festival Forever'],
  chain: ['Same Carpet', 'Curry Club', 'Breakfast Pints', 'App Ordering', 'Steak Night', 'Two Meals Deal',
    'Airport Branch', 'Motorway Services', 'Megapub', 'Franchise Empire', 'Every Town Has One'],
  bankhol: ['Long Weekend', 'Beer Garden Sun', 'Barbecue Smoke', 'Traffic Jams', 'Sunburnt Necks',
    'Four-Day Weekend', 'National Hangover', 'Extra Bank Holiday', 'Bank Holiday Tuesday', 'Endless Summer',
    'Permanent Holiday'],
  streetparty: ['Bunting', 'Trestle Tables', 'Paper Crowns', 'Coronation Chicken', 'Street Piano',
    'Commemorative Mugs', 'Conga Line', 'Fireworks', 'Royal Wave', 'Jubilee Pints', 'Long Live the Pint'],
  toast: ['Cheers', 'Salud', 'Prost', 'Kanpai', 'Skål', 'Sláinte', 'Santé', 'Na Zdrowie', 'Gānbēi',
    'Şerefe', 'Iechyd Da'],
  lunar: ['Low-Gravity Pours', 'Crater Cellar', 'Moon Hops', 'Lunar Lager', 'Dark Side Taproom',
    'Helium Heads', 'Tidal Kegs', 'Moonbase Lock-In', 'Eclipse Party', 'Full Moon Pints', 'Harvest Moon'],
  crawl: ['The Mars Arms', 'Venus Vaults', 'Jupiter Jug', 'Saturn Rings Bar', 'Asteroid Belt Inn',
    'Rocket Fuel Shandy', 'Comet Tail Tavern', 'Pluto Still Counts', 'Orbital Ordering', 'Space Taxi', 'Grand Tour'],
  galactic: ['Two-for-One Nebulae', 'Star Cluster Rounds', 'Wormhole Waiters', 'Supernova Shots',
    'Light-Speed Service', 'Galactic Ale Standard', 'Alien Regulars', 'Cosmic Jukebox', 'Interstellar Tab',
    'Milky Way Stout', 'Happy Aeon'],
  blackhole: ['Event Horizon Bar', 'Spaghettified Pints', 'Time-Dilated Happy Hour', 'Hawking Lager',
    'Accretion Disc Seating', 'Singularity Snacks', 'Lensing Glasses', 'No-Escape Lock-In',
    'Infinite Last Orders', 'Dark Garden', 'Beyond the Horizon'],
  multiverse: ['Parallel Pints', 'Infinite Yous', 'Alternate Landlords', 'Quantum Rounds', 'Many-Worlds Tab',
    'Timeline Pub Crawl', 'Every Possible Pint', 'Mirror-Universe Bitter', 'Cosmic Lock-In', 'Reality Brewing',
    'Omniverse Opening Time'],
};

const drinkerUpgrades: Upgrade[] = DRINKERS.flatMap((d) =>
  DRINKER_TIERS.map(([need, costMult], i) => ({
    id: `${d.id}-${i + 1}`,
    name: DRINKER_UPGRADE_NAMES[d.id][i],
    desc: `Twice as many pints from every ${noun(d.name)}.`,
    icon: d.icon,
    badge: ROMAN[i],
    group: 'drinker' as const,
    cost: d.baseCost.mul(costMult),
    unlocked: (s: GameState) => owned(s, d.id) >= need,
    effect: { kind: 'drinker' as const, drinker: d.id, mult: 2 },
  })),
);

// ---------- 2. drinking upgrades ----------

const drinksAtLeast = (n: number) => (s: GameState) => s.drinks >= n;
const lifetimeAtLeast = (n: number) => (s: GameState) => s.lifetimePints.gte(n);

const gulpNames = ['Bigger Gulps', 'Hollow Legs', 'Practised Swallow', 'Open Throat', 'Iron Stomach',
  'Gullet of Steel', 'Bottomless Pit', 'Human Funnel'];
const gulpDrinks = [10, 40, 100, 250, 500, 1000, 2000, 4000];
const gulpCosts = [50, 1e3, 2e4, 4e5, 8e6, 1.6e8, 3.2e9, 6.4e10];

const pourNames = ['Quick Pour', 'Second Barman', 'Self-Service Taps'];
const pourDrinks = [25, 150, 600];
const pourCosts = [200, 2e4, 2e6];

const perDrink: [string, string, number, number, (s: GameState) => boolean][] = [
  ['Two-Handed', '🙌', 2, 50, drinksAtLeast(10)],
  ['Yard of Ale', '📏', 3, 1e4, drinksAtLeast(75)],
  ['Boot of Beer', '🥾', 3, 1e6, lifetimeAtLeast(5e5)],
  ['Bucket of Pints', '🪣', 4, 1e9, lifetimeAtLeast(5e8)],
  ['Keg Stand', '🛢️', 5, 1e12, lifetimeAtLeast(5e11)],
  ['Brewery Hose', '🚒', 5, 1e15, lifetimeAtLeast(5e14)],
  ['Beer Pipeline', '🛤️', 10, 1e18, lifetimeAtLeast(5e17)],
];

const lunchNames = ['Liquid Lunch', 'Long Lunch', 'Boozy Afternoon', 'Lost Weekend', 'Bender', 'Legendary Session'];
const lunchSeconds = [0.1, 0.2, 0.3, 0.5, 1, 2];
const lunchCosts = [5e4, 5e7, 5e10, 5e13, 5e16, 5e19];

const drinkingUpgrades: Upgrade[] = [
  ...gulpNames.map((name, i) => ({
    id: `gulp-${i + 1}`, name, icon: '😮', badge: ROMAN[i], group: 'drinking' as const,
    desc: 'Drink each pint 20% faster.',
    cost: D(gulpCosts[i]), unlocked: drinksAtLeast(gulpDrinks[i]),
    effect: { kind: 'drinkTime' as const, mult: 0.8 },
  })),
  ...pourNames.map((name, i) => ({
    id: `pour-${i + 1}`, name, icon: '🚰', badge: ROMAN[i], group: 'drinking' as const,
    desc: 'Fresh pints are poured 40% faster.',
    cost: D(pourCosts[i]), unlocked: drinksAtLeast(pourDrinks[i]),
    effect: { kind: 'refillTime' as const, mult: 0.6 },
  })),
  ...perDrink.map(([name, icon, mult, cost, unlocked], i) => ({
    id: `perdrink-${i + 1}`, name, icon, group: 'drinking' as const,
    desc: `Each pint you drink counts ${mult}× as much.`,
    cost: D(cost), unlocked,
    effect: { kind: 'perDrink' as const, mult },
  })),
  {
    id: 'down-in-one', name: 'Down in One', icon: '⚡', group: 'drinking',
    desc: 'A single click drinks the whole pint. No need to hold.',
    cost: D(1e6), unlocked: drinksAtLeast(300),
    effect: { kind: 'downInOne' },
  },
  ...lunchNames.map((name, i) => ({
    id: `lunch-${i + 1}`, name, icon: '🥪', badge: ROMAN[i], group: 'drinking' as const,
    desc: `Each pint you drink also earns ${lunchSeconds[i]} second${lunchSeconds[i] === 1 ? '' : 's'} of your drinkers' output.`,
    cost: D(lunchCosts[i]), unlocked: lifetimeAtLeast(lunchCosts[i] / 2),
    effect: { kind: 'liquidLunch' as const, seconds: lunchSeconds[i] },
  })),
];

// ---------- 3. synergies: a bigger crowd makes a smaller one drink more ----------

const SYNERGIES: [string, string, string][] = [
  ['regular', 'wmc', 'Regulars Join the Club'],
  ['student', 'rugby', 'Students Join the Rugby Club'],
  ['darts', 'supporters', 'Darts on the Big Screen'],
  ['stag', 'musicfest', 'Stag Do at the Festival'],
  ['rugby', 'chain', 'Rugby on Every Telly'],
  ['supporters', 'bankhol', 'Bank Holiday Derby'],
  ['wmc', 'streetparty', 'Club Lays On the Street Party'],
  ['beerfest', 'toast', 'Festival Goes Global'],
  ['musicfest', 'lunar', 'Gig on the Moon'],
  ['chain', 'crawl', 'Franchise Goes Interplanetary'],
  ['toast', 'galactic', 'Toast Heard Across the Galaxy'],
  ['lunar', 'blackhole', 'Tidal Brewing'],
];

const synergyUpgrades: Upgrade[] = SYNERGIES.map(([target, source, name]) => {
  const t = DRINKER_BY_ID.get(target)!;
  const src = DRINKER_BY_ID.get(source)!;
  return {
    id: `syn-${target}-${source}`, name, icon: '🤝', group: 'synergy',
    desc: `Each ${noun(t.name)} drinks 5% more for every ${noun(src.name)} you own.`,
    cost: src.baseCost.mul(50),
    unlocked: (s) => owned(s, target) >= 15 && owned(s, source) >= 5,
    effect: { kind: 'synergy', target, source, perUnit: 0.05 },
  };
});

// ---------- 4. pub upgrades: small boosts to everything ----------

const PUB: [string, string, string, number, number][] = [
  ['jukebox', '🎵', 'Jukebox', 0.05, 5e3],
  ['fruit-machine', '🎰', 'Fruit Machine', 0.05, 5e4],
  ['pub-quiz', '❓', 'Pub Quiz Night', 0.1, 5e5],
  ['beer-garden', '🌳', 'Beer Garden', 0.1, 5e6],
  ['big-screen', '📺', 'Sport on the Big Screen', 0.15, 1e8],
  ['sunday-roast', '🍖', 'Sunday Roast', 0.15, 1e10],
  ['lock-in', '🔒', 'Lock-In Licence', 0.2, 1e12],
  ['real-fire', '🔥', 'Real Fire', 0.2, 1e14],
  ['snug', '🛋️', 'The Snug', 0.25, 1e16],
  ['function-room', '🎉', 'Function Room', 0.25, 1e18],
  ['microbrewery', '🏭', 'Microbrewery Out Back', 0.3, 1e21],
  ['skittle-alley', '🎳', 'Skittle Alley', 0.3, 1e24],
];

const pubUpgrades: Upgrade[] = PUB.map(([id, icon, name, add, cost]) => ({
  id: `pub-${id}`, name, icon, group: 'pub',
  desc: `Everyone drinks ${Math.round(add * 100)}% more, including you.`,
  cost: D(cost), unlocked: lifetimeAtLeast(cost / 2),
  effect: { kind: 'global', add },
}));

// ---------- 5. reputation: achievements become a bonus to everything ----------

const REPUTATION: [string, string, string, number, number, number][] = [
  ['local-legend', '🏅', 'Local Legend', 10, 1e6, 0.005],
  ['name-on-the-wall', '🖼️', 'Name on the Wall', 25, 1e9, 0.006],
  ['pub-folklore', '📜', 'Pub Folklore', 40, 1e12, 0.0075],
  ['blue-plaque', '🔵', 'Blue Plaque', 55, 1e15, 0.009],
  ['statue', '🗿', 'Statue in the Square', 70, 1e18, 0.01],
  ['national-treasure', '💎', 'National Treasure', 85, 1e22, 0.0125],
  ['cosmic-celebrity', '🌠', 'Cosmic Celebrity', 100, 1e27, 0.015],
  ['legend-of-every-pub', '👑', 'Legend of Every Pub', 120, 1e33, 0.0175],
  ['the-myth', '🐉', 'The Myth, the Legend', 140, 1e41, 0.02],
];

const reputationUpgrades: Upgrade[] = REPUTATION.map(([id, icon, name, need, cost, rate]) => ({
  id: `rep-${id}`, name, icon, group: 'reputation',
  desc: `Everything gets +${+(rate * 100).toFixed(2)}% for every achievement you've unlocked.`,
  cost: D(cost), unlocked: (s) => s.achievements.size >= need,
  effect: { kind: 'reputation', rate },
}));

export const UPGRADES: Upgrade[] = [
  ...drinkingUpgrades, ...reputationUpgrades, ...pubUpgrades, ...synergyUpgrades, ...drinkerUpgrades,
];
export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));
