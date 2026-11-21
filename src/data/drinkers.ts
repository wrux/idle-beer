import { D, Decimal } from '../core/num';

export interface Drinker {
  id: string;
  name: string;
  /** Placeholder store icon until drinkers get proper art in Phase 4. */
  icon: string;
  flavour: string;
  baseCost: Decimal;
  /** Pints per second for one of these, before upgrades. */
  basePps: Decimal;
}

const drinker = (
  id: string, icon: string, name: string, cost: number, pps: number, flavour: string,
): Drinker => ({ id, icon, name, flavour, baseCost: D(cost), basePps: D(pps) });

/** Each tier costs ~11–14× the last and drinks ~6–8× as much. See DESIGN.md §3. */
export const DRINKERS: Drinker[] = [
  drinker('regular', '👴', 'The Regular', 10, 0.1, "Old fella who's had the same stool since 1974."),
  drinker('student', '🎓', 'Uni Student', 100, 1, 'Here for the £2 Tuesday deal.'),
  drinker('darts', '🎯', 'Darts Team', 1_100, 8, 'Treble twenty, treble pint.'),
  drinker('stag', '🤵', 'Stag Do', 12_000, 47, 'Matching T-shirts. Nobody is sure which one is the groom.'),
  drinker('rugby', '🏉', 'Rugby Club', 130_000, 260, 'Boat races every Saturday.'),
  drinker('supporters', '⚽', "Supporters' Club", 1.4e6, 1_400, 'Pre-match, half-time, post-match.'),
  drinker('wmc', '🎱', "Working Men's Club", 2e7, 7_800, 'Subsidised bitter and a meat raffle.'),
  drinker('beerfest', '🍻', 'Beer Festival', 3.3e8, 44_000, 'Tasting glasses, real ale, sandals.'),
  drinker('musicfest', '🎸', 'Music Festival', 5.1e9, 260_000, 'Warm cans in a muddy field.'),
  drinker('chain', '🏪', 'Pub Chain', 7.5e10, 1.6e6, 'Every high street, same carpet.'),
  drinker('bankhol', '📅', 'Bank Holiday', 1e12, 1e7, 'The whole nation goes to the pub.'),
  drinker('streetparty', '👑', 'Royal Street Party', 1.4e13, 6.5e7, 'Bunting as far as the eye can see.'),
  drinker('toast', '🌍', 'Global Toast', 1.7e14, 4.3e8, 'Cheers in every language.'),
  drinker('lunar', '🌙', 'Lunar Brewery', 2.1e15, 2.9e9, 'Low gravity, high ABV.'),
  drinker('crawl', '🪐', 'Interplanetary Pub Crawl', 2.6e16, 2.1e10, 'Next stop: the Mars Arms.'),
  drinker('galactic', '🌌', 'Galactic Happy Hour', 3.1e17, 1.5e11, 'Two-for-one across the Milky Way.'),
  drinker('blackhole', '🕳️', 'Black Hole Barfly', 7.1e18, 1.1e12, 'Last orders lasts forever here.'),
  drinker('multiverse', '♾️', 'Multiverse Lock-In', 1.2e20, 8.3e12, 'Infinite pubs, infinite yous, infinite pints.'),
];

export const DRINKER_BY_ID = new Map(DRINKERS.map((d) => [d.id, d]));
