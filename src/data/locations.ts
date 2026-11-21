/** Where the pub is (DESIGN.md §6). Mostly cosmetic, plus +2% everything per move. */
import { D, Decimal } from '../core/num';

export type WindowView =
  | 'night' | 'garden' | 'street' | 'city' | 'festival' | 'town'
  | 'britain' | 'earth' | 'moon' | 'solar' | 'galaxy' | 'multiverse';

export interface Location {
  id: string;
  name: string;
  /** Text on the sign above the bar. */
  sign: string;
  /** Lifetime pints needed to move here. */
  threshold: Decimal;
  view: WindowView;
  wall: string;
  wallStripe: string;
  panel: string;
  panelInset: string;
}

export const LOCATION_BONUS = 0.02;

const loc = (
  id: string, name: string, sign: string, threshold: number, view: WindowView,
  wall: string, wallStripe: string, panel = '#6a3f22', panelInset = '#5c361d',
): Location => ({ id, name, sign, threshold: D(threshold), view, wall, wallStripe, panel, panelInset });

export const LOCATIONS: Location[] = [
  loc('redlion', 'The Red Lion', 'THE RED LION', 0, 'night', '#2f4f3e', '#2a4738'),
  loc('garden', 'The Red Lion Beer Garden', 'BEER GARDEN', 1e3, 'garden', '#3d5a35', '#36512f'),
  loc('highstreet', 'High Street Pub Crawl', 'HIGH STREET', 1e5, 'street', '#5a2d2d', '#512828'),
  loc('superpub', 'City Centre Superpub', 'THE SUPERPUB', 1e7, 'city', '#263b5a', '#213450', '#4a3326', '#3e2a1f'),
  loc('festival', 'Festival Field', 'FESTIVAL BAR', 1e9, 'festival', '#4a3a66', '#42345c', '#6b4a2a', '#5a3e23'),
  loc('town', 'The Whole Town', 'TOWN ARMS', 1e11, 'town', '#5c4a2e', '#534229'),
  loc('britain', 'Great British Boozer', 'GREAT BRITAIN', 1e13, 'britain', '#22375e', '#1e3154'),
  loc('earth', 'The Earth Inn', 'THE EARTH INN', 1e16, 'earth', '#1d3b4a', '#193442', '#3d3a4a', '#33303f'),
  loc('moon', 'The Moon Under Water', 'THE MOON', 1e20, 'moon', '#3a3d47', '#34373f', '#4a4d57', '#3f424b'),
  loc('solar', 'Solar System Social Club', 'SOLAR SOCIAL', 1e25, 'solar', '#3a2340', '#331f39', '#3d2c4a', '#33243f'),
  loc('galaxy', 'The Galaxy Arms', 'GALAXY ARMS', 1e31, 'galaxy', '#1b1838', '#171431', '#2c2650', '#241f44'),
  loc('multiverse', 'The Multiverse Tavern', 'MULTIVERSE', 1e40, 'multiverse', '#2a1640', '#241338', '#3b2258', '#311c4b'),
];

/** Index of the furthest location your lifetime pints have reached. */
export function locationIndex(lifetime: Decimal): number {
  let i = 0;
  while (i + 1 < LOCATIONS.length && lifetime.gte(LOCATIONS[i + 1].threshold)) i++;
  return i;
}
