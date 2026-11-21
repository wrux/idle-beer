/**
 * Pubs you can open and drink in (DESIGN.md §6). Each one gives a little to everything, more the
 * further along it is, plus a perk of its own. You pick which one you're in.
 */
import { D, Decimal } from '../core/num';
import type { LicenceEffect } from './licence';

/** What a pub does for you while you're drinking there. */
export type PubEffect =
  /** Everything (idle and by hand) ×mult. */
  | { kind: 'all'; mult: number }
  /** Pints per drink by hand ×mult. */
  | { kind: 'perDrink'; mult: number }
  /** Seconds to drain a pint ×mult. */
  | { kind: 'drinkTime'; mult: number }
  /** Drinker prices ×mult. */
  | { kind: 'drinkerCost'; mult: number }
  /** Anything the Landlord's Licence can do (Free Rounds, streaks, time away). */
  | LicenceEffect;

export interface Location {
  id: string;
  name: string;
  /** Text on the sign above the bar. */
  sign: string;
  /** Pints to open this pub. It shows in the shop once lifetime pints reach a tenth of this. */
  threshold: Decimal;
  /** What makes this pub worth drinking in, in words. */
  perk: string;
  effects: PubEffect[];
}

/** Every pub also gives this much to everything, per step along the list, while you're there. */
export const LOCATION_BONUS = 0.02;

const loc = (
  id: string, name: string, sign: string, threshold: number, perk: string, effects: PubEffect[],
): Location => ({ id, name, sign, threshold: D(threshold), perk, effects });

export const LOCATIONS: Location[] = [
  loc('redlion', 'The Red Lion', 'THE RED LION', 0, 'Your local: an extra second before a chug streak breaks.',
    [{ kind: 'streakSlack', seconds: 1 }]),
  loc('garden', 'The Red Lion Beer Garden', 'BEER GARDEN', 1e3, 'Free Rounds turn up 20% more often.',
    [{ kind: 'freeRoundGap', mult: 0.8 }]),
  loc('highstreet', 'High Street Pub Crawl', 'HIGH STREET', 1e5, 'Drinkers cost 5% less.',
    [{ kind: 'drinkerCost', mult: 0.95 }]),
  loc('superpub', 'City Centre Superpub', 'THE SUPERPUB', 1e7, 'Every pint you drink by hand counts triple.',
    [{ kind: 'perDrink', mult: 3 }]),
  loc('festival', 'Festival Field', 'FESTIVAL BAR', 1e9, 'Free Round rewards last 50% longer.',
    [{ kind: 'buffDuration', mult: 1.5 }]),
  loc('town', 'The Whole Town', 'TOWN ARMS', 1e11, 'Drinkers keep going twice as long while you are away.',
    [{ kind: 'offlineCapMult', mult: 2 }]),
  loc('britain', 'Great British Boozer', 'GREAT BRITAIN', 1e13, 'Lucky Rounds pay double.',
    [{ kind: 'luckyMult', mult: 2 }]),
  loc('earth', 'The Earth Inn', 'THE EARTH INN', 1e16, 'Everything drinks a further 15% more.',
    [{ kind: 'all', mult: 1.15 }]),
  loc('moon', 'The Moon Under Water', 'THE MOON', 1e20, 'Low gravity: pints go down 30% faster.',
    [{ kind: 'drinkTime', mult: 0.7 }]),
  loc('solar', 'Solar System Social Club', 'SOLAR SOCIAL', 1e25, 'Happy Hour is ×10 instead of ×7.',
    [{ kind: 'happyHour', mult: 10 }]),
  loc('galaxy', 'The Galaxy Arms', 'GALAXY ARMS', 1e31, 'Drinkers cost 15% less.',
    [{ kind: 'drinkerCost', mult: 0.85 }]),
  loc('multiverse', 'The Multiverse Tavern', 'MULTIVERSE', 1e40, 'Everything drinks a further 50% more.',
    [{ kind: 'all', mult: 1.5 }]),
];

export const LOCATION_BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));

/** Index of the furthest location these lifetime pints would have reached (used to place old saves). */
export function locationIndex(lifetime: Decimal): number {
  let i = 0;
  while (i + 1 < LOCATIONS.length && lifetime.gte(LOCATIONS[i + 1].threshold)) i++;
  return i;
}
