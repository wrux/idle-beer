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
  /** The people you find drinking here whoever you bring (character ids from the art). */
  locals: string[];
}

/** Every pub also gives this much to everything, per step along the list, while you're there. */
export const LOCATION_BONUS = 0.02;

const loc = (
  id: string, name: string, sign: string, threshold: number, perk: string, effects: PubEffect[], locals: string[] = [],
): Location => ({ id, name, sign, threshold: D(threshold), perk, effects, locals });

export const LOCATIONS: Location[] = [
  loc('redlion', 'The Red Lion', 'THE RED LION', 0, 'Your local: an extra second before a chug streak breaks.',
    [{ kind: 'streakSlack', seconds: 1 }]),
  loc('garden', 'The Red Lion Beer Garden', 'BEER GARDEN', 1e3, 'Free Rounds turn up 20% more often.',
    [{ kind: 'freeRoundGap', mult: 0.8 }]),
  loc('highstreet', 'High Street Pub Crawl', 'HIGH STREET', 1e5, 'Drinkers cost 5% less.',
    [{ kind: 'drinkerCost', mult: 0.95 }], ['irish']),
  loc('superpub', 'City Centre Superpub', 'THE SUPERPUB', 1e7, 'Every pint you drink by hand counts triple.',
    [{ kind: 'perDrink', mult: 3 }]),
  loc('festival', 'Festival Field', 'FESTIVAL BAR', 1e9, 'Free Round rewards last 50% longer.',
    [{ kind: 'buffDuration', mult: 1.5 }]),
  loc('town', 'The Whole Town', 'TOWN ARMS', 1e11, 'Drinkers keep going twice as long while you are away.',
    [{ kind: 'offlineCapMult', mult: 2 }], ['irish']),
  loc('britain', 'Great British Boozer', 'GREAT BRITAIN', 1e13, 'Lucky Rounds pay double.',
    [{ kind: 'luckyMult', mult: 2 }]),
  // ----- the world tour: eleven pubs abroad, each with its own locals. About ten times the
  // price each step, so there's a few minutes' drinking between one and the next. -----
  loc('highlands', 'The Highland Bothy', 'THE BOTHY', 1e14, 'Chug streaks can build to +100%.',
    [{ kind: 'streakMax', steps: 20 }], ['scot']),
  loc('meadhall', 'The Mead Hall', 'MEAD HALL', 1e15, 'Skål! Two extra seconds before a chug streak breaks.',
    [{ kind: 'streakSlack', seconds: 2 }], ['viking']),
  loc('prague', 'Prague Castle', 'PRAGUE CASTLE', 1e16, 'Beers cost 20% less.',
    [{ kind: 'beerDiscount', mult: 0.8 }], ['czech']),
  loc('oktoberfest', 'Oktoberfest', 'OKTOBERFEST', 1e17, 'The tent never empties: earn 75% instead of 50% while you are away.',
    [{ kind: 'offlineRate', rate: 0.75 }], ['german', 'bavarian']),
  loc('bavaria', 'The Castle Bierkeller', 'BIERKELLER', 1e18, 'A litre at a time: pints you drink by hand count five times.',
    [{ kind: 'perDrink', mult: 5 }], ['bavarian']),
  loc('redsquare', 'Red Square', 'RED SQUARE', 1e19, 'Drinkers cost 10% less.',
    [{ kind: 'drinkerCost', mult: 0.9 }], ['russian']),
  loc('forbidden', 'The Forbidden City', 'FORBIDDEN CITY', 1e20, 'Lucky Rounds pay triple.',
    [{ kind: 'luckyMult', mult: 3 }], ['uncle']),
  loc('pocha', 'Seoul Pocha', 'POCHA', 1e21, 'One more bottle: Free Round rewards last twice as long.',
    [{ kind: 'buffDuration', mult: 2 }], ['korean']),
  loc('izakaya', 'Tokyo Izakaya', 'IZAKAYA', 1e22, 'Free Rounds turn up 35% more often.',
    [{ kind: 'freeRoundGap', mult: 0.65 }], ['salaryman']),
  loc('pirateship', 'The Jolly Roger', 'JOLLY ROGER', 1e23, 'Buried treasure: Lucky Rounds pay four times.',
    [{ kind: 'luckyMult', mult: 4 }], ['pirate']),
  loc('outback', 'The Outback Pub', 'THE OUTBACK', 3e24, 'No worries: everything drinks a further 10% more.',
    [{ kind: 'all', mult: 1.1 }], ['aussie']),
  loc('earth', 'The Earth Inn', 'THE EARTH INN', 1e26, 'Everything drinks a further 15% more.',
    [{ kind: 'all', mult: 1.15 }]),
  loc('moon', 'The Moon Under Water', 'THE MOON', 1e30, 'Low gravity: pints go down 30% faster.',
    [{ kind: 'drinkTime', mult: 0.7 }]),
  loc('solar', 'Solar System Social Club', 'SOLAR SOCIAL', 1e35, 'Happy Hour is ×10 instead of ×7.',
    [{ kind: 'happyHour', mult: 10 }]),
  loc('greenman', 'The Little Green Man', 'LITTLE GREEN MAN', 1e38, 'Beamed straight up: Free Rounds turn up twice as often.',
    [{ kind: 'freeRoundGap', mult: 0.5 }], ['grey', 'greenman', 'stalks']),
  loc('galaxy', 'The Galaxy Arms', 'GALAXY ARMS', 1e41, 'Drinkers cost 15% less.',
    [{ kind: 'drinkerCost', mult: 0.85 }]),
  loc('multiverse', 'The Multiverse Tavern', 'MULTIVERSE', 1e50, 'Everything drinks a further 50% more.',
    [{ kind: 'all', mult: 1.5 }]),
];

export const LOCATION_BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));

/** Index of the furthest location these lifetime pints would have reached (used to place old saves). */
export function locationIndex(lifetime: Decimal): number {
  let i = 0;
  while (i + 1 < LOCATIONS.length && lifetime.gte(LOCATIONS[i + 1].threshold)) i++;
  return i;
}
