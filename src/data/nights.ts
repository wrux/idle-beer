/**
 * What makes one night different from the last (DESIGN.md §6): Tonight's special, one of three
 * offered the morning after, and Challenge nights, a handicap you take on for a reward you keep.
 * Both are written as the same effects the Local Legend tree uses, so `mods(state)` folds them in.
 */
import { D, Decimal } from '../core/num';
import type { LicenceEffect } from './licence';

export interface Special {
  id: string;
  name: string;
  desc: string;
  effects: LicenceEffect[];
}

const special = (id: string, name: string, desc: string, effects: LicenceEffect[]): Special => ({ id, name, desc, effects });

/** Each lasts one night. Three are offered after every Last Orders. */
export const SPECIALS: Special[] = [
  special('two-for-one', 'Two for One', 'Drinkers cost half tonight.', [{ kind: 'drinkerCost', mult: 0.5 }]),
  special('thirsty-crowd', 'Thirsty Crowd', 'Your drinkers drink three times as much tonight.', [{ kind: 'idleMult', mult: 3 }]),
  special('strong-stuff', 'Strong Stuff', 'Everything drinks twice as much tonight.', [{ kind: 'allMult', mult: 2 }]),
  special('big-hands', 'Big Hands', 'Pints you drink by hand count ten times tonight.', [{ kind: 'perDrink', mult: 10 }]),
  special('lucky-night', 'Lucky Night', 'Lucky Rounds pay five times tonight.', [{ kind: 'luckyMult', mult: 5 }]),
  special('busy-night', 'Busy Night', 'Free Rounds turn up three times as often tonight.', [{ kind: 'freeRoundGap', mult: 1 / 3 }]),
  special('long-hours', 'Long Hours', 'Free Round rewards last three times as long tonight.', [{ kind: 'buffDuration', mult: 3 }]),
  special('brewery-visit', 'Brewery Visit', 'Beers cost 90% less tonight.', [{ kind: 'beerDiscount', mult: 0.1 }]),
  special('on-a-roll', 'On a Roll', 'Your chug streak can reach +200% tonight.', [{ kind: 'streakMax', steps: 40 }]),
  special('lock-in', 'Lock-In', 'Earn the full 100% while you are away tonight.', [{ kind: 'offlineRate', rate: 1 }]),
];

export const SPECIAL_BY_ID = new Map(SPECIALS.map((s) => [s.id, s]));
/** How many are offered each morning. */
export const SPECIALS_OFFERED = 3;

export interface Challenge {
  id: string;
  name: string;
  /** The handicap, in words. */
  rule: string;
  /** Pints to drink in the night, on top of whatever you walked in with. */
  goal: Decimal;
  /** What beating it gives you for good, in words. */
  reward: string;
  handicap: LicenceEffect[];
  prize: LicenceEffect[];
}

const challenge = (
  id: string, name: string, rule: string, goal: number, reward: string, handicap: LicenceEffect[], prize: LicenceEffect[],
): Challenge => ({ id, name, rule, goal: D(goal), reward, handicap, prize });

/** One at a time, chosen the morning after. Beaten once, the prize is yours for good. */
export const CHALLENGES: Challenge[] = [
  challenge('alone', 'Drinking Alone', 'No drinkers: it is just you and the pint.', 1e8,
    'Pints you drink by hand count ten times, for good.', [{ kind: 'noDrinkers' }], [{ kind: 'perDrink', mult: 10 }]),
  challenge('dry', 'Dry January', 'Pints you drink yourself count for nothing.', 1e12,
    'Your drinkers drink twice as much, for good.', [{ kind: 'noHand' }], [{ kind: 'idleMult', mult: 2 }]),
  challenge('shelves', 'Empty Shelves', 'No upgrades can be bought.', 1e13,
    'Everything drinks 50% more, for good.', [{ kind: 'noUpgrades' }], [{ kind: 'allMult', mult: 1.5 }]),
  challenge('shandy', 'Shandy Night', 'No moving on to a new beer.', 1e14,
    'Everything drinks twice as much, for good.', [{ kind: 'noBeer' }], [{ kind: 'allMult', mult: 2 }]),
  challenge('round', 'Your Round', 'Drinkers cost ten times as much.', 1e15,
    'Drinkers cost 20% less, for good.', [{ kind: 'drinkerCost', mult: 10 }], [{ kind: 'drinkerCost', mult: 0.8 }]),
  challenge('pockets', 'Empty Pockets', 'Your Beer Mats give no bonus.', 1e18,
    "Each Beer Mat's bonus is 25% stronger, for good.", [{ kind: 'noMats' }], [{ kind: 'matRateMult', mult: 1.25 }]),
];

export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
