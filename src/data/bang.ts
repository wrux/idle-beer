/**
 * After the Big Bang (DESIGN.md §6): what Black Hole Beers buy. Three columns of five, bought in
 * order down each column, and one last perk that needs the bottom of all three: sixteen in all,
 * exactly 100 Black Hole Beers. They are written as the Local Legend tree's own effects, so
 * `mods(state)` folds them in with everything else.
 */
import type { LicenceEffect } from './licence';

export interface VoidNode {
  id: string;
  /** Which column it is in (the last perk of all has none). */
  column: string | null;
  tier: number;
  name: string;
  desc: string;
  /** Black Hole Beers. */
  cost: number;
  /** Every one of these must be owned first. */
  requires: string[];
  effects: LicenceEffect[];
}

export const VOID_COLUMNS: { id: string; name: string }[] = [
  { id: 'matter', name: 'Matter' },
  { id: 'time', name: 'Time' },
  { id: 'singularity', name: 'Singularity' },
];

/** Black Hole Beers for each step down a column: 31 a column. */
const TIER_COSTS = [1, 2, 4, 8, 16];

type Spec = [name: string, desc: string, effects: LicenceEffect[]];

/*
 * On the sizes of these. Primordial Soup is the one great leap (a first universe of hours becomes
 * minutes). After it, a universe is mostly as long as the auto-buyers take to fill the pub, and a
 * big multiplier skips that altogether: Dark Energy was ×1e12 at first and took a six-minute
 * universe to twelve seconds on its own. So the later ones are modest, and each should take a
 * slice off the time, not most of it.
 */

const SPECS: Record<string, Spec[]> = {
  matter: [
    ['Primordial Soup', 'Everything drinks a million times as much.', [{ kind: 'allMult', mult: 1e6 }]],
    ['Inflation', "Drinkers' prices rise 7% a time, not 15%.", [{ kind: 'costRatio', ratio: 1.07 }]],
    ['Dark Energy', 'Everything drinks 100 times as much.', [{ kind: 'allMult', mult: 100 }]],
    ['Free Bar', 'Beers and upgrades cost nothing.', [{ kind: 'freeShop' }, { kind: 'beerDiscount', mult: 0 }]],
    ['Heat Death Postponed', 'Everything drinks 10,000 times as much.', [{ kind: 'allMult', mult: 1e4 }]],
  ],
  time: [
    ['Déjà Vu', 'Every universe starts with the staff buying your upgrades, drinkers and beers, and with Down in One.',
      [{ kind: 'auto', what: 'upgrades' }, { kind: 'auto', what: 'drinkers' }, { kind: 'auto', what: 'beer' }, { kind: 'downInOne' }]],
    ['No More Mornings', 'Beer Mats arrive as you drink, and your legend can be bought at any time: no need for Last Orders.', [{ kind: 'liveMats' }]],
    ['Crowded Universe', 'Walk in to 500 of every drinker.', [{ kind: 'startAll', count: 500 }]],
    ['Legend in Your Sleep', "Your legend's perks are bought for you as soon as you can afford them.", [{ kind: 'autoLegend' }]],
    ['Mat Storm', 'Earn a million times the Beer Mats.', [{ kind: 'matGain', mult: 1e6 }]],
  ],
  singularity: [
    ['Event Horizon', 'Every Big Bang leaves one more Black Hole Beer.', [{ kind: 'bangBonus', add: 1 }]],
    ['Gravity Well', 'Everything drinks twice as much for each Black Hole Beer you hold.', [{ kind: 'voidPower', base: 2 }]],
    ['Spaghettification', 'The long lines of your legend cost the square root of their price.', [{ kind: 'sqrtLines' }]],
    ['Hawking Radiation', 'Every Big Bang leaves two more Black Hole Beers.', [{ kind: 'bangBonus', add: 2 }]],
    ['Small Universe', 'The universe runs dry at 1e50 pints.', [{ kind: 'bangGoal', exponent: 50 }]],
  ],
};

const columns: VoidNode[] = VOID_COLUMNS.flatMap((c) =>
  SPECS[c.id].map(([name, desc, effects], tier) => ({
    id: `${c.id}-${tier + 1}`, column: c.id, tier, name, desc, effects,
    cost: TIER_COSTS[tier], requires: tier === 0 ? [] : [`${c.id}-${tier}`],
  })),
);

export const VOID_TREE: VoidNode[] = [
  ...columns,
  {
    id: 'last-pint', column: null, tier: 5, name: 'The Last Pint of All', desc: 'Everything drinks a googol times as much.',
    cost: 7, requires: VOID_COLUMNS.map((c) => `${c.id}-5`), effects: [{ kind: 'allMult', mult: 1e100 }],
  },
];

export const VOID_BY_ID = new Map(VOID_TREE.map((n) => [n.id, n]));
