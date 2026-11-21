/**
 * The Landlord's Licence: a permanent upgrade tree bought with Beer Mats (DESIGN.md §6).
 * Six branches of five nodes; each node needs the one before it in its branch.
 */
import { D, Decimal } from '../core/num';

export type LicenceEffect =
  | { kind: 'startDrinkers'; drinkers: Record<string, number> }
  | { kind: 'startPints'; pints: number }
  /** Keep at least this beer index when you call Last Orders. */
  | { kind: 'keepBeer'; min: number }
  /** Keep half the beers you'd reached. */
  | { kind: 'keepHalfBeers' }
  | { kind: 'beerDiscount'; mult: number }
  /** Time between Free Rounds ×mult. */
  | { kind: 'freeRoundGap'; mult: number }
  | { kind: 'buffDuration'; mult: number }
  | { kind: 'luckyMult'; mult: number }
  | { kind: 'freeRoundLifetime'; mult: number }
  | { kind: 'happyHour'; mult: number }
  | { kind: 'offlineCap'; seconds: number }
  /** Stretches whatever the cap is. */
  | { kind: 'offlineCapMult'; mult: number }
  | { kind: 'offlineRate'; rate: number }
  | { kind: 'auto'; what: AutoBuy }
  | { kind: 'downInOne' }
  | { kind: 'streakMax'; steps: number }
  | { kind: 'streakSlack'; seconds: number }
  | { kind: 'lunch'; seconds: number }
  /** Keep drinking upgrades (gulps, pours, per drink, lunch, Down in One) on reset. */
  | { kind: 'keepDrinking' }
  /** Each unspent mat gives this much (0.02 = +2%). The best one owned applies. */
  | { kind: 'matRate'; rate: number }
  | { kind: 'matGain'; mult: number };

export type AutoBuy = 'upgrades' | 'drinkers' | 'beer';

export interface LicenceNode {
  id: string;
  branch: string;
  tier: number;
  name: string;
  desc: string;
  cost: Decimal;
  requires: string | null;
  effects: LicenceEffect[];
}

export interface Branch {
  id: string;
  name: string;
  icon: string;
}

export const BRANCHES: Branch[] = [
  { id: 'regulars', name: 'Regulars', icon: '👥' },
  { id: 'brewing', name: 'Brewing', icon: '🍺' },
  { id: 'charm', name: 'Charm', icon: '🌟' },
  { id: 'management', name: 'Management', icon: '🗝️' },
  { id: 'technique', name: 'Technique', icon: '💪' },
  { id: 'collecting', name: 'Collecting', icon: '🟫' },
];

/** Mat cost by tier within a branch. */
const TIER_COSTS = [1, 4, 15, 60, 250];

type Spec = [string, string, LicenceEffect[]];

const SPECS: Record<string, Spec[]> = {
  regulars: [
    ['Old Faithful', 'Start every run with a Regular already at the bar.', [{ kind: 'startDrinkers', drinkers: { regular: 1 } }]],
    ['Familiar Faces', 'Start with 10 Regulars and 5 Uni Students.', [{ kind: 'startDrinkers', drinkers: { regular: 10, student: 5 } }]],
    ['Float in the Till', 'Start every run with 1,000 pints.', [{ kind: 'startPints', pints: 1e3 }]],
    ['The Usual Crowd', 'Start with 25 each of the first four drinkers.',
      [{ kind: 'startDrinkers', drinkers: { regular: 25, student: 25, darts: 25, stag: 25 } }]],
    ['Opening Night', 'Start every run with a million pints.', [{ kind: 'startPints', pints: 1e6 }]],
  ],
  brewing: [
    ['Cellar Knowledge', 'Keep the Pint of Bitter when you call Last Orders.', [{ kind: 'keepBeer', min: 1 }]],
    ["Brewer's Friend", 'Beers are 25% cheaper.', [{ kind: 'beerDiscount', mult: 0.75 }]],
    ['House Recipe', 'Keep beers up to Proper Real Ale.', [{ kind: 'keepBeer', min: 3 }]],
    ['Master Brewer', 'Beers are another 50% cheaper.', [{ kind: 'beerDiscount', mult: 0.5 }]],
    ['Family Brewery', "Keep half of the beers you'd reached.", [{ kind: 'keepHalfBeers' }]],
  ],
  charm: [
    ['Golden Reputation', 'Free Rounds turn up 20% more often.', [{ kind: 'freeRoundGap', mult: 0.8 }]],
    ['Long Happy Hours', 'Free Round rewards last 50% longer.', [{ kind: 'buffDuration', mult: 1.5 }]],
    ['Lucky Streak', 'Lucky Rounds pay double.', [{ kind: 'luckyMult', mult: 2 }]],
    ['Lingering Pint', 'Golden pints stay twice as long before they go.', [{ kind: 'freeRoundLifetime', mult: 2 }]],
    ['Happiest Hour', 'Happy Hour makes drinkers drink 10× instead of 7×.', [{ kind: 'happyHour', mult: 10 }]],
  ],
  management: [
    ['Night Manager', 'Drinkers keep going for up to 4 hours while you are away.', [{ kind: 'offlineCap', seconds: 4 * 3600 }]],
    ['Trusted Staff', 'Earn 75% instead of 50% while you are away.', [{ kind: 'offlineRate', rate: 0.75 }]],
    ['Bar Back', 'Automatically buys upgrades you can afford.', [{ kind: 'auto', what: 'upgrades' }]],
    ['Head Barman', 'Automatically buys drinkers.', [{ kind: 'auto', what: 'drinkers' }]],
    ['Area Manager', 'Automatically buys the next beer, and drinkers keep going for 12 hours while you are away.',
      [{ kind: 'auto', what: 'beer' }, { kind: 'offlineCap', seconds: 12 * 3600 }]],
  ],
  technique: [
    ['Muscle Memory', 'Start every run with Down in One.', [{ kind: 'downInOne' }]],
    ['Second Wind', 'Your chug streak can reach +100% instead of +50%.', [{ kind: 'streakMax', steps: 20 }]],
    ['Steady Hand', 'An extra second between pints before your streak breaks.', [{ kind: 'streakSlack', seconds: 1 }]],
    ['Practised Lunch', 'Each drink earns half a second of idle production from the start.', [{ kind: 'lunch', seconds: 0.5 }]],
    ['Iron Liver', 'Keep your drinking upgrades when you call Last Orders.', [{ kind: 'keepDrinking' }]],
  ],
  collecting: [
    ['Coaster Collector', 'Each unspent Beer Mat gives +2% instead of +1%.', [{ kind: 'matRate', rate: 0.02 }]],
    ['Mat Hoarder', 'Earn 25% more Beer Mats.', [{ kind: 'matGain', mult: 1.25 }]],
    ['Rare Prints', 'Each unspent Beer Mat gives +3%.', [{ kind: 'matRate', rate: 0.03 }]],
    ['Limited Editions', 'Earn another 50% more Beer Mats.', [{ kind: 'matGain', mult: 1.5 }]],
    ['Museum Collection', 'Each unspent Beer Mat gives +5%.', [{ kind: 'matRate', rate: 0.05 }]],
  ],
};

export const LICENCE: LicenceNode[] = BRANCHES.flatMap((b) =>
  SPECS[b.id].map(([name, desc, effects], tier) => ({
    id: `${b.id}-${tier + 1}`,
    branch: b.id,
    tier,
    name,
    desc,
    cost: D(TIER_COSTS[tier]),
    requires: tier === 0 ? null : `${b.id}-${tier}`,
    effects,
  })),
);

export const LICENCE_BY_ID = new Map(LICENCE.map((n) => [n.id, n]));

// ---------- folded modifiers ----------

export interface LicenceMods {
  startDrinkers: Record<string, number>;
  startPints: number;
  keepBeer: number;
  keepHalfBeers: boolean;
  beerDiscount: number;
  freeRoundGap: number;
  buffDuration: number;
  luckyMult: number;
  freeRoundLifetime: number;
  happyHour: number | null;
  offlineCap: number | null;
  offlineCapMult: number;
  offlineRate: number | null;
  auto: Set<AutoBuy>;
  downInOne: boolean;
  streakMaxSteps: number | null;
  streakSlack: number;
  lunch: number;
  keepDrinking: boolean;
  matRate: number;
  matGain: number;
}

export const BASE_MAT_RATE = 0.01;

/** Modifiers with nothing bought. */
export function baseMods(): LicenceMods {
  return {
    startDrinkers: {}, startPints: 0, keepBeer: 0, keepHalfBeers: false, beerDiscount: 1,
    freeRoundGap: 1, buffDuration: 1, luckyMult: 1, freeRoundLifetime: 1, happyHour: null,
    offlineCap: null, offlineCapMult: 1, offlineRate: null, auto: new Set(), downInOne: false, streakMaxSteps: null,
    streakSlack: 0, lunch: 0, keepDrinking: false, matRate: BASE_MAT_RATE, matGain: 1,
  };
}

/** Fold one effect into a set of modifiers. */
export function applyEffect(m: LicenceMods, e: LicenceEffect): void {
  switch (e.kind) {
    case 'startDrinkers':
      for (const [k, v] of Object.entries(e.drinkers)) m.startDrinkers[k] = Math.max(m.startDrinkers[k] ?? 0, v);
      break;
    case 'startPints': m.startPints = Math.max(m.startPints, e.pints); break;
    case 'keepBeer': m.keepBeer = Math.max(m.keepBeer, e.min); break;
    case 'keepHalfBeers': m.keepHalfBeers = true; break;
    case 'beerDiscount': m.beerDiscount *= e.mult; break;
    case 'freeRoundGap': m.freeRoundGap *= e.mult; break;
    case 'buffDuration': m.buffDuration *= e.mult; break;
    case 'luckyMult': m.luckyMult *= e.mult; break;
    case 'freeRoundLifetime': m.freeRoundLifetime *= e.mult; break;
    case 'happyHour': m.happyHour = Math.max(m.happyHour ?? 0, e.mult); break;
    case 'offlineCap': m.offlineCap = Math.max(m.offlineCap ?? 0, e.seconds); break;
    case 'offlineCapMult': m.offlineCapMult *= e.mult; break;
    case 'offlineRate': m.offlineRate = Math.max(m.offlineRate ?? 0, e.rate); break;
    case 'auto': m.auto.add(e.what); break;
    case 'downInOne': m.downInOne = true; break;
    case 'streakMax': m.streakMaxSteps = Math.max(m.streakMaxSteps ?? 0, e.steps); break;
    case 'streakSlack': m.streakSlack += e.seconds; break;
    case 'lunch': m.lunch += e.seconds; break;
    case 'keepDrinking': m.keepDrinking = true; break;
    case 'matRate': m.matRate = Math.max(m.matRate, e.rate); break;
    case 'matGain': m.matGain *= e.mult; break;
  }
}

/** Fold every owned node into one set of modifiers. */
export function licenceMods(owned: ReadonlySet<string>): LicenceMods {
  const m = baseMods();
  for (const id of owned) for (const e of LICENCE_BY_ID.get(id)?.effects ?? []) applyEffect(m, e);
  return m;
}
