/**
 * The Landlord's Licence: a permanent upgrade tree bought with Beer Mats (DESIGN.md §6).
 * Six branches. Each starts with five hand-written nodes round the middle, then runs out in a
 * long line of plain boosts (the same boost thirty times, each dearer than the last) with four
 * one-off perks hanging off it. Each branch also has two perks that change how the game is
 * played. 246 nodes, about 1e99 mats for all of them.
 */
import { D, Decimal } from '../core/num';
import { DRINKERS } from './drinkers';

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
  | { kind: 'matGain'; mult: number }
  // ----- the long lines: the same plain boost, bought again and again -----
  /** Drinkers ×mult. */
  | { kind: 'idleMult'; mult: number }
  /** Everything (idle and by hand) ×mult. */
  | { kind: 'allMult'; mult: number }
  /** Happy Hour's multiplier +add, on top of whichever multiplier is in force. */
  | { kind: 'happyHourAdd'; add: number }
  /** This many more seconds away, before any stretching. */
  | { kind: 'offlineCapAdd'; seconds: number }
  // ----- one-off perks -----
  /** Walk in to at least this many of every drinker. */
  | { kind: 'startAll'; count: number }
  /** Drinkers ×(1 + rate × drinkers owned, of every kind). */
  | { kind: 'crowd'; rate: number }
  | { kind: 'drinkerCost'; mult: number }
  /** Everything ×power for each beer past the first. The best one owned applies. */
  | { kind: 'beerPower'; power: number }
  /** Everything ×(1 + rate × achievements). */
  | { kind: 'achMult'; rate: number }
  /** Mats earned ×(1 + rate × achievements). */
  | { kind: 'matGainPerAch'; rate: number }
  | { kind: 'perDrink'; mult: number }
  /** Pubs you've opened stay open (and you stay where you are) through Last Orders. */
  | { kind: 'keepPubs' }
  /** Every upgrade you bought survives Last Orders. */
  | { kind: 'keepUpgrades' }
  /** Every pub you've opened gives its perk at once. */
  | { kind: 'allPubPerks' }
  /** The mat bonus counts every mat ever earned, not only the unspent ones. */
  | { kind: 'matsCountSpent' }
  // ----- perks that change how the game is played -----
  /** Buying a drinker also gives you one of the kind before it. */
  | { kind: 'plusOne' }
  /** This fraction of each kind of drinker is still there after Last Orders. */
  | { kind: 'keepDrinkers'; fraction: number }
  /** Everything ×(1 + rate × minutes since the night began), up to 1 + AGED_CAP. */
  | { kind: 'aged'; rate: number }
  /** Buying a beer starts a Happy Hour. */
  | { kind: 'beerHappyHour' }
  /** A Free Round gives two rewards. */
  | { kind: 'doubleRounds' }
  /** A reward you already have gets longer; it isn't started again (and can be rolled again). */
  | { kind: 'stackBuffs' }
  /** Free Rounds claim themselves. */
  | { kind: 'autoRounds' }
  /** Start the night with this fraction of the pints you drank the night before. */
  | { kind: 'whipRound'; fraction: number }
  /** Left alone, he drinks at the speed you would. */
  | { kind: 'autoFull' }
  /** A broken streak drops to half. */
  | { kind: 'streakHalf' }
  /** The mats Last Orders would pay count towards the mat bonus already. */
  | { kind: 'pendingMats' }
  /** Each mat's bonus ×(1 + rate × perks owned). */
  | { kind: 'perkRate'; rate: number }
  // ----- nights (data/nights.ts): challenge handicaps and a prize -----
  /** Pints drunk by hand earn nothing. */
  | { kind: 'noHand' }
  | { kind: 'noBeer' }
  | { kind: 'noUpgrades' }
  /** No drinkers can be bought, and any you have don't drink. */
  | { kind: 'noDrinkers' }
  /** Beer Mats give no bonus. */
  | { kind: 'noMats' }
  /** Each mat's bonus ×mult. */
  | { kind: 'matRateMult'; mult: number };

/** The most Cellar-Aged can add: +1,000%. */
export const AGED_CAP = 10;

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
  /** Where it sits in the tree, in grid squares from the middle (x right, y down). */
  at: { x: number; y: number };
  /** Which step this is along its branch's long line (1–30). Shown after the name. */
  rank?: number;
  /** A one-off perk, not a step of a long line. */
  unique?: boolean;
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
  { id: 'management', name: 'Favours', icon: '🗝️' },
  { id: 'technique', name: 'Technique', icon: '💪' },
  { id: 'collecting', name: 'Collecting', icon: '🟫' },
];

/**
 * Mat cost by tier within a branch. The first three are the same in every branch. After that the
 * prices climb steeply and no two are alike, because mats do: a run pays tens, then thousands,
 * then (once the mat bonus carries a run through every beer in seconds) 1e20. There is one thing
 * to buy every run or two all the way up, and the dearest in each round is the Collecting node,
 * since those are the ones that make the next run pay more.
 */
const TIER_COSTS = [1, 4, 15];
const FOURTH_COSTS = [300, 600, 1.2e3, 2.5e3, 5e3, 1e4];
const FIFTH_COSTS = [3e4, 1e5, 3e5, 1e6, 1e7, 1e8];
/** The first one-off perk of each branch: the last things to buy before the long lines begin. */
const FIRST_UNIQUE_COSTS = [1e10, 1e12, 1e14, 1e16, 1e18, 1e20];
/** Where each branch comes in those lists, cheapest first. */
const PRICE_RANK: Record<string, number> = { technique: 0, charm: 1, regulars: 2, management: 3, brewing: 4, collecting: 5 };
const coreCost = (branch: string, tier: number): number =>
  tier < 3 ? TIER_COSTS[tier] : (tier === 3 ? FOURTH_COSTS : FIFTH_COSTS)[PRICE_RANK[branch]];

type Spec = [string, string, LicenceEffect[]];

const SPECS: Record<string, Spec[]> = {
  regulars: [
    ['Old Faithful', 'A Regular is already at the bar every time you walk in.', [{ kind: 'startDrinkers', drinkers: { regular: 1 } }]],
    ['Familiar Faces', 'Walk in to 10 Regulars and 5 Uni Students.', [{ kind: 'startDrinkers', drinkers: { regular: 10, student: 5 } }]],
    ['Money Behind the Bar', 'Start every night with 1,000 pints behind the bar.', [{ kind: 'startPints', pints: 1e3 }]],
    ['The Usual Crowd', 'Walk in to 25 each of the first four drinkers.',
      [{ kind: 'startDrinkers', drinkers: { regular: 25, student: 25, darts: 25, stag: 25 } }]],
    ['Welcome Back', 'Start every night with a million pints behind the bar.', [{ kind: 'startPints', pints: 1e6 }]],
  ],
  brewing: [
    ['The Usual', 'The barman remembers: you start every night on the Pint of Bitter.', [{ kind: 'keepBeer', min: 1 }]],
    ["Mates' Rates", 'Beers are 25% cheaper.', [{ kind: 'beerDiscount', mult: 0.75 }]],
    ['Your Own Tankard', 'Start every night on anything up to the Nitro Stout.', [{ kind: 'keepBeer', min: 3 }]],
    ['On the House', 'Beers are another 50% cheaper.', [{ kind: 'beerDiscount', mult: 0.5 }]],
    ['Top Shelf', "Start every night halfway up the beers you'd reached.", [{ kind: 'keepHalfBeers' }]],
  ],
  charm: [
    ['Golden Reputation', 'Free Rounds turn up 20% more often.', [{ kind: 'freeRoundGap', mult: 0.8 }]],
    ['Long Happy Hours', 'Free Round rewards last 50% longer.', [{ kind: 'buffDuration', mult: 1.5 }]],
    ['Lucky Streak', 'Lucky Rounds pay double.', [{ kind: 'luckyMult', mult: 2 }]],
    ['Lingering Pint', 'Golden pints stay twice as long before they go.', [{ kind: 'freeRoundLifetime', mult: 2 }]],
    ['Happiest Hour', 'Happy Hour makes drinkers drink 10× instead of 7×.', [{ kind: 'happyHour', mult: 10 }]],
  ],
  management: [
    ['Lock-In', 'Drinkers keep going for up to 4 hours while you are away.', [{ kind: 'offlineCap', seconds: 4 * 3600 }]],
    ['Saved Seat', 'Earn 75% instead of 50% while you are away.', [{ kind: 'offlineRate', rate: 0.75 }]],
    ['A Quiet Word', 'The staff buy upgrades for you as soon as you can afford them.', [{ kind: 'auto', what: 'upgrades' }]],
    ['Same Again', 'The barman gets the rounds in: drinkers are bought for you.', [{ kind: 'auto', what: 'drinkers' }]],
    ['Friends in High Places', 'Your next beer is poured without asking, and drinkers keep going for 12 hours while you are away.',
      [{ kind: 'auto', what: 'beer' }, { kind: 'offlineCap', seconds: 12 * 3600 }]],
  ],
  technique: [
    ['Muscle Memory', 'Start every run with Down in One.', [{ kind: 'downInOne' }]],
    ['Second Wind', 'Your chug streak can reach +100% instead of +50%.', [{ kind: 'streakMax', steps: 20 }]],
    ['Steady Hand', 'An extra second between pints before your streak breaks.', [{ kind: 'streakSlack', seconds: 1 }]],
    ['Practised Lunch', 'Each drink earns half a second of idle production from the start.', [{ kind: 'lunch', seconds: 0.5 }]],
    ['Iron Liver', 'Keep your drinking upgrades when the landlord calls time.', [{ kind: 'keepDrinking' }]],
  ],
  collecting: [
    ['Coaster Collector', 'Each unspent Beer Mat gives +2% instead of +1%.', [{ kind: 'matRate', rate: 0.02 }]],
    ['Mat Hoarder', 'Earn 25% more Beer Mats.', [{ kind: 'matGain', mult: 1.25 }]],
    ['Rare Prints', 'Each unspent Beer Mat gives +3%.', [{ kind: 'matRate', rate: 0.03 }]],
    ['Limited Editions', 'Earn another 50% more Beer Mats.', [{ kind: 'matGain', mult: 1.5 }]],
    ['Museum Collection', 'Each unspent Beer Mat gives +5%.', [{ kind: 'matRate', rate: 0.05 }]],
  ],
};

/**
 * The shape of the tree. For each branch, in tier order: [x, y, tier it hangs off (0 = the middle)].
 * Branches start as a line out from the middle and then fork, each in its own way, so a later
 * node is not always behind the one before it.
 */
const SHAPE: Record<string, [number, number, number][]> = {
  regulars: [[0, -2, 0], [0, -4, 1], [-2, -4, 2], [2, -4, 2], [4, -3, 4]],
  brewing: [[2, 0, 0], [4, 0, 1], [6, -1, 2], [6, 1, 2], [8, -3, 3]],
  charm: [[2, 2, 0], [4, 2, 1], [6, 3, 2], [4, 4, 2], [8, 4, 3]],
  management: [[0, 2, 0], [0, 4, 1], [-2, 3, 2], [-4, 4, 3], [-6, 3, 4]],
  technique: [[-2, 0, 0], [-4, 0, 1], [-6, 0, 2], [-8, -1, 3], [-8, 1, 3]],
  collecting: [[-2, -2, 0], [-4, -2, 1], [-6, -3, 2], [-4, -4, 2], [-8, -4, 3]],
};

const CORE: LicenceNode[] = BRANCHES.flatMap((b) =>
  SPECS[b.id].map(([name, desc, effects], tier) => ({
    id: `${b.id}-${tier + 1}`,
    branch: b.id,
    tier,
    name,
    desc,
    cost: D(coreCost(b.id, tier)),
    requires: SHAPE[b.id][tier][2] === 0 ? null : `${b.id}-${SHAPE[b.id][tier][2]}`,
    effects,
    at: { x: SHAPE[b.id][tier][0], y: SHAPE[b.id][tier][1] },
  })),
);

// ---------- perks that change how the game is played ----------

/**
 * Two a branch. The first hangs off the middle of the tree and costs tens to thousands of mats,
 * so it turns up in the first few nights; the second hangs off step 5 of the branch's long line.
 */
const MECHANICS: Record<string, [Spec, Spec]> = {
  regulars: [
    ['Plus One', 'Every drinker you buy brings along a free one of the kind before it.', [{ kind: 'plusOne' }]],
    ['Never Go Home', 'A tenth of your drinkers are still at the bar the next night.', [{ kind: 'keepDrinkers', fraction: 0.1 }]],
  ],
  brewing: [
    ['Guest Ale', 'Moving on to a new beer starts a Happy Hour.', [{ kind: 'beerHappyHour' }]],
    ['Cellar-Aged', 'Everything drinks 1% more for every minute the night has lasted, up to +1,000%.', [{ kind: 'aged', rate: 0.01 }]],
  ],
  charm: [
    ['Doubles All Round', 'Every Free Round gives two rewards.', [{ kind: 'doubleRounds' }]],
    ['Never-Ending Happy Hour', 'A Free Round reward you already have gets longer, not started again.', [{ kind: 'stackBuffs' }]],
  ],
  management: [
    ['Table Service', 'Free Rounds are brought to you: no need to click them.', [{ kind: 'autoRounds' }]],
    ['Whip-Round', 'Start every night with 1% of the pints you drank the night before.', [{ kind: 'whipRound', fraction: 0.01 }]],
  ],
  technique: [
    ['Second Nature', 'Left alone, he drinks at full speed, not in slow sips.', [{ kind: 'autoFull' }]],
    ['Unbroken', 'A broken chug streak drops to half, not back to nothing.', [{ kind: 'streakHalf' }]],
  ],
  collecting: [
    ['Counted Already', 'The Beer Mats that Last Orders would pay count towards your bonus straight away.', [{ kind: 'pendingMats' }]],
    ["Collectors' Fair", "Each Beer Mat's bonus is 1% stronger for every perk you have earned.", [{ kind: 'perkRate', rate: 0.01 }]],
  ],
};

/** The first of each pair: [core node it hangs off, x, y, mats]. */
const EARLY_MECHANICS: Record<string, [number, number, number, number]> = {
  regulars: [3, -2, -5.7, 120],
  brewing: [2, 4, -1.5, 50],
  charm: [3, 6, 4.7, 250],
  management: [3, -2, 4.7, 1.5e3],
  technique: [2, -4, 1.6, 700],
  collecting: [3, -6, -4.7, 4e3],
};
/** The step of the long line the second of each pair hangs off. */
const MECHANIC_STEP = 5;

const EARLY: LicenceNode[] = BRANCHES.map((b) => {
  const [name, desc, effects] = MECHANICS[b.id][0];
  const [parent, x, y, cost] = EARLY_MECHANICS[b.id];
  return {
    id: `${b.id}-m1`, branch: b.id, tier: parent, name, desc, effects,
    cost: D(cost), requires: `${b.id}-${parent}`, at: { x, y }, unique: true,
  };
});

// ---------- the long lines ----------

/** Steps along each branch's line. */
export const LINE_LENGTH = 30;
/**
 * The first step of the first line costs 10^this mats. It is this far out on purpose: once mats
 * are worth a few thousand times your income, a run goes through every beer in seconds and pays
 * about 1e20 mats, so anything cheaper would be bought without a night's drinking. From here a
 * run is a few minutes to half an hour (`npm run simulate -- 0.5 1e15 600`).
 */
const LINE_START = 23.4;
/** …each step along a line is 10^this times the one before (a shade over the ×226 a round gives)… */
const LINE_STEP = 2.38;
/**
 * …and within a round of the six, each line is 10^this times the cheapest. Prices follow what you
 * have by then: the three that make mats come faster are spaced by what the one before them gave,
 * and each of the other three sits just under one of those, so it never holds the next one up.
 */
const BRANCH_OFFSET: Record<string, number> = {
  charm: 0, regulars: 0.05, management: 0.5, brewing: 0.55, technique: 1, collecting: 1.05,
};

/**
 * What each line does, every step. Three of them carry the late game between them: drinkers ×10
 * and everything ×10 are ×100 the pints, which is ×4.6 the mats (a cube root), and ×8 mats on top
 * is ×226 mats a round of the six, for prices that go up ×240. See DESIGN.md §6.
 */
const LINES: Record<string, Spec> = {
  regulars: ['Round for the House', 'Your drinkers drink ten times as much.', [{ kind: 'idleMult', mult: 10 }]],
  brewing: ['Cellar Craft', 'Everything drinks ten times as much.', [{ kind: 'allMult', mult: 10 }]],
  charm: ['Happier Hours', "Happy Hour's multiplier goes up by 2.", [{ kind: 'happyHourAdd', add: 2 }]],
  management: ['Late Licence', 'Drinkers keep going 2 more hours while you are away.', [{ kind: 'offlineCapAdd', seconds: 2 * 3600 }]],
  technique: ['Drinking Arm', "Each pint you drink also earns 1 more second of your drinkers' output.", [{ kind: 'lunch', seconds: 1 }]],
  collecting: ['Bigger Pockets', 'Earn eight times the Beer Mats.', [{ kind: 'matGain', mult: 8 }]],
};

/** The one-off perks: the first hangs off the end of the core, the rest off steps 10, 20 and 30 of the line. */
const UNIQUES: Record<string, Spec[]> = {
  regulars: [
    ['Full House', 'Walk in to 50 each of the first nine drinkers.',
      [{ kind: 'startDrinkers', drinkers: Object.fromEntries(DRINKERS.slice(0, 9).map((d) => [d.id, 50])) }]],
    ['Packed to the Rafters', 'Your drinkers drink 1% more for every drinker in the pub.', [{ kind: 'crowd', rate: 0.01 }]],
    ['Coach Party', 'Walk in to 100 of every drinker.', [{ kind: 'startAll', count: 100 }]],
    ['Everybody Knows Your Name', 'Drinkers cost 90% less.', [{ kind: 'drinkerCost', mult: 0.1 }]],
  ],
  brewing: [
    ['Cellar Key', 'Start every night on the best beer you have ever reached.', [{ kind: 'keepBeer', min: 999 }]],
    ['Connoisseur', 'Everything drinks 50% more for each beer past the Half of Shandy.', [{ kind: 'beerPower', power: 1.5 }]],
    ['Brewery Tap', 'Beers cost 99% less.', [{ kind: 'beerDiscount', mult: 0.01 }]],
    ['Master Brewer', 'Everything drinks twice as much for each beer past the Half of Shandy.', [{ kind: 'beerPower', power: 2 }]],
  ],
  charm: [
    ["Fortune's Favourite", 'Lucky Rounds pay five times.', [{ kind: 'luckyMult', mult: 5 }]],
    ['Round After Round', 'Free Rounds turn up twice as often.', [{ kind: 'freeRoundGap', mult: 0.5 }]],
    ['Golden Touch', 'Free Round rewards last three times as long.', [{ kind: 'buffDuration', mult: 3 }]],
    ['Talk of the Town', 'Everything drinks 2% more for every achievement.', [{ kind: 'achMult', rate: 0.02 }]],
  ],
  management: [
    ['Keys to the Pub', 'The pubs you have opened stay open when the landlord calls time.', [{ kind: 'keepPubs' }]],
    ['Open All Hours', 'Earn the full 100% while you are away.', [{ kind: 'offlineRate', rate: 1 }]],
    ['Pub Crawl Legend', 'Every pub you have opened gives you its perk at once, wherever you are drinking.', [{ kind: 'allPubPerks' }]],
    ['Photographic Memory', 'Keep every upgrade you bought when the landlord calls time.', [{ kind: 'keepUpgrades' }]],
  ],
  technique: [
    ['Bottomless', 'Your chug streak can reach +250%.', [{ kind: 'streakMax', steps: 50 }]],
    ['Never Spill a Drop', 'Three extra seconds between pints before your streak breaks.', [{ kind: 'streakSlack', seconds: 3 }]],
    ['Hollow Leg', 'Pints you drink by hand count a hundred times.', [{ kind: 'perDrink', mult: 100 }]],
    ['One for the Road', "Each pint you drink also earns ten seconds of your drinkers' output.", [{ kind: 'lunch', seconds: 10 }]],
  ],
  collecting: [
    ['Framed Collection', 'Each unspent Beer Mat gives +10%.', [{ kind: 'matRate', rate: 0.1 }]],
    ['Trophy Cabinet', 'Earn 1% more Beer Mats for every achievement.', [{ kind: 'matGainPerAch', rate: 0.01 }]],
    ['Mint Condition', 'Each unspent Beer Mat gives +25%.', [{ kind: 'matRate', rate: 0.25 }]],
    ['The Complete Set', 'Every Beer Mat you have ever earned gives its bonus, spent or not.', [{ kind: 'matsCountSpent' }]],
  ],
};

/** The steps of a line that the other three hang off. */
const UNIQUE_STEPS = [10, 20, 30];

/** Which way each branch's line runs from its fifth node (x right, y down). */
const LINE_DIRECTION: Record<string, [number, number]> = {
  regulars: [0.5, -1],
  brewing: [1, -0.3],
  charm: [1, 0.55],
  management: [-0.5, 1],
  technique: [-1, 0.3],
  collecting: [-1, -0.55],
};
/** Grid squares between one step of a line and the next. */
const LINE_SPACING = 1.7;
/** Each step turns this far (radians) from the one before, so the lines sweep round like the arms of a spiral. */
const LINE_CURVE = 0.045;

/** 10^exponent, as a price: two figures and then noughts. */
/**
 * The one-off perks make mats come faster too, so the line gets dearer by 10^this after the step
 * they hang off: mostly Connoisseur (×1.5 for each of 26 beers) and Master Brewer (×2 for each).
 */
const UNIQUE_BUMPS: [afterStep: number, exponent: number][] = [[MECHANIC_STEP, 0.6], [10, 3.9], [20, 0.35]];

const price = (exponent: number): Decimal => {
  const whole = Math.floor(exponent);
  return D(`${Math.round(10 ** (exponent - whole) * 10) / 10}e${whole}`);
};

const LONG: LicenceNode[] = BRANCHES.flatMap((b) => {
  const [dx, dy] = LINE_DIRECTION[b.id];
  const heading = Math.atan2(dy, dx);
  const start = CORE.find((n) => n.id === `${b.id}-5`)!;
  // Where each step sits, and which way the line is heading there.
  const path: { x: number; y: number; a: number }[] = [{ ...start.at, a: heading }];
  for (let step = 1; step <= LINE_LENGTH; step++) {
    const a = heading + LINE_CURVE * step;
    const from = path[step - 1];
    path.push({ x: from.x + Math.cos(a) * LINE_SPACING, y: from.y + Math.sin(a) * LINE_SPACING, a });
  }
  const at = (step: number, side = 0) => ({
    x: +(path[step].x - Math.sin(path[step].a) * LINE_SPACING * side).toFixed(2),
    y: +(path[step].y + Math.cos(path[step].a) * LINE_SPACING * side).toFixed(2),
  });
  const [lineName, lineDesc, lineEffects] = LINES[b.id];
  const uniques = UNIQUES[b.id];
  const out: LicenceNode[] = [{
    id: `${b.id}-u1`, branch: b.id, tier: 5, name: uniques[0][0], desc: uniques[0][1], effects: uniques[0][2],
    cost: D(FIRST_UNIQUE_COSTS[PRICE_RANK[b.id]]), requires: start.id,
    // Technique's would land on its own fourth node, so it sits out to the side.
    at: b.id === 'technique' ? { x: -9.6, y: -0.3 } : at(0, 1), unique: true,
  }];
  for (let step = 1; step <= LINE_LENGTH; step++) {
    const bump = UNIQUE_BUMPS.reduce((sum, [after, exponent]) => sum + (step > after ? exponent : 0), 0);
    const cost = price(LINE_START + LINE_STEP * (step - 1) + BRANCH_OFFSET[b.id] + bump);
    out.push({
      id: `${b.id}-x${step}`, branch: b.id, tier: 5 + step, name: lineName, desc: lineDesc, effects: lineEffects,
      cost, requires: step === 1 ? start.id : `${b.id}-x${step - 1}`, at: at(step), rank: step,
    });
    if (step === MECHANIC_STEP) {
      const [name, desc, effects] = MECHANICS[b.id][1];
      out.push({
        id: `${b.id}-m2`, branch: b.id, tier: 5 + step, name, desc, effects,
        cost: cost.mul(5), requires: `${b.id}-x${step}`, at: at(step, 1), unique: true,
      });
    }
    const u = UNIQUE_STEPS.indexOf(step);
    if (u >= 0) {
      const [name, desc, effects] = uniques[u + 1];
      out.push({
        id: `${b.id}-u${u + 2}`, branch: b.id, tier: 5 + step, name, desc, effects,
        cost: cost.mul(5), requires: `${b.id}-x${step}`, at: at(step, u % 2 ? 1 : -1), unique: true,
      });
    }
  }
  return out;
});

/** Every node, in an order where each comes after the one it hangs off. */
export const LICENCE: LicenceNode[] = [...CORE, ...EARLY, ...LONG];

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
  idleMult: number;
  allMult: number;
  happyHourAdd: number;
  offlineCapAdd: number;
  startAll: number;
  crowd: number;
  drinkerCost: number;
  beerPower: number;
  achMult: number;
  matGainPerAch: number;
  perDrink: number;
  keepPubs: boolean;
  keepUpgrades: boolean;
  allPubPerks: boolean;
  matsCountSpent: boolean;
  plusOne: boolean;
  keepDrinkers: number;
  aged: number;
  beerHappyHour: boolean;
  doubleRounds: boolean;
  stackBuffs: boolean;
  autoRounds: boolean;
  whipRound: number;
  autoFull: boolean;
  streakHalf: boolean;
  pendingMats: boolean;
  perkRate: number;
  noHand: boolean;
  noBeer: boolean;
  noUpgrades: boolean;
  noDrinkers: boolean;
  noMats: boolean;
  matRateMult: number;
}

export const BASE_MAT_RATE = 0.01;

/** Modifiers with nothing bought. */
export function baseMods(): LicenceMods {
  return {
    startDrinkers: {}, startPints: 0, keepBeer: 0, keepHalfBeers: false, beerDiscount: 1,
    freeRoundGap: 1, buffDuration: 1, luckyMult: 1, freeRoundLifetime: 1, happyHour: null,
    offlineCap: null, offlineCapMult: 1, offlineRate: null, auto: new Set(), downInOne: false, streakMaxSteps: null,
    streakSlack: 0, lunch: 0, keepDrinking: false, matRate: BASE_MAT_RATE, matGain: 1,
    idleMult: 1, allMult: 1, happyHourAdd: 0, offlineCapAdd: 0, startAll: 0, crowd: 0, drinkerCost: 1, beerPower: 1,
    achMult: 0, matGainPerAch: 0, perDrink: 1, keepPubs: false, keepUpgrades: false, allPubPerks: false,
    matsCountSpent: false,
    plusOne: false, keepDrinkers: 0, aged: 0, beerHappyHour: false, doubleRounds: false, stackBuffs: false,
    autoRounds: false, whipRound: 0, autoFull: false, streakHalf: false, pendingMats: false, perkRate: 0,
    noHand: false, noBeer: false, noUpgrades: false, noDrinkers: false, noMats: false, matRateMult: 1,
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
    case 'idleMult': m.idleMult *= e.mult; break;
    case 'allMult': m.allMult *= e.mult; break;
    case 'happyHourAdd': m.happyHourAdd += e.add; break;
    case 'offlineCapAdd': m.offlineCapAdd += e.seconds; break;
    case 'startAll': m.startAll = Math.max(m.startAll, e.count); break;
    case 'crowd': m.crowd = Math.max(m.crowd, e.rate); break;
    case 'drinkerCost': m.drinkerCost *= e.mult; break;
    case 'beerPower': m.beerPower = Math.max(m.beerPower, e.power); break;
    case 'achMult': m.achMult += e.rate; break;
    case 'matGainPerAch': m.matGainPerAch += e.rate; break;
    case 'perDrink': m.perDrink *= e.mult; break;
    case 'keepPubs': m.keepPubs = true; break;
    case 'keepUpgrades': m.keepUpgrades = true; break;
    case 'allPubPerks': m.allPubPerks = true; break;
    case 'matsCountSpent': m.matsCountSpent = true; break;
    case 'plusOne': m.plusOne = true; break;
    case 'keepDrinkers': m.keepDrinkers = Math.max(m.keepDrinkers, e.fraction); break;
    case 'aged': m.aged = Math.max(m.aged, e.rate); break;
    case 'beerHappyHour': m.beerHappyHour = true; break;
    case 'doubleRounds': m.doubleRounds = true; break;
    case 'stackBuffs': m.stackBuffs = true; break;
    case 'autoRounds': m.autoRounds = true; break;
    case 'whipRound': m.whipRound = Math.max(m.whipRound, e.fraction); break;
    case 'autoFull': m.autoFull = true; break;
    case 'streakHalf': m.streakHalf = true; break;
    case 'pendingMats': m.pendingMats = true; break;
    case 'perkRate': m.perkRate += e.rate; break;
    case 'noHand': m.noHand = true; break;
    case 'noBeer': m.noBeer = true; break;
    case 'noUpgrades': m.noUpgrades = true; break;
    case 'noDrinkers': m.noDrinkers = true; break;
    case 'noMats': m.noMats = true; break;
    case 'matRateMult': m.matRateMult *= e.mult; break;
  }
}

/** Fold every owned node into one set of modifiers. */
export function licenceMods(owned: ReadonlySet<string>): LicenceMods {
  const m = baseMods();
  for (const id of owned) for (const e of LICENCE_BY_ID.get(id)?.effects ?? []) applyEffect(m, e);
  // Collectors' Fair: every perk you own makes each mat worth more.
  m.matRate *= 1 + m.perkRate * owned.size;
  return m;
}
