/**
 * The game's content (drinkers, beers, pubs, upgrades, achievements, perks) is written in English
 * in src/data. This puts it into the active language, once, before anything is shown.
 * Everything is generated in English first and translated as finished sentences, so a
 * translation never has to fit a name into somebody else's grammar.
 */
import { BUFFS } from '../core/events';
import type { Decimal } from '../core/num';
import { ACHIEVEMENTS } from '../data/achievements';
import { BEERS } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { BRANCHES, LICENCE } from '../data/licence';
import { LOCATIONS } from '../data/locations';
import { CHALLENGES, SPECIALS } from '../data/nights';
import { UPGRADES } from '../data/upgrades';
import { tr, trn } from './index';

type Slot = [object: Record<string, unknown>, field: string];

/** Every translatable field in the game's data. */
export function dataSlots(): Slot[] {
  const out: Slot[] = [];
  const add = (list: readonly object[], ...fields: string[]) => {
    for (const item of list) for (const f of fields) out.push([item as Record<string, unknown>, f]);
  };
  add(DRINKERS, 'name', 'flavour');
  add(BEERS, 'name', 'flavour');
  add(LOCATIONS, 'name', 'perk');
  add(UPGRADES, 'name', 'desc');
  add(ACHIEVEMENTS, 'name', 'desc');
  add(LICENCE, 'name', 'desc');
  add(BRANCHES, 'name');
  add(SPECIALS, 'name', 'desc');
  add(CHALLENGES, 'name', 'rule', 'reward');
  add(Object.values(BUFFS), 'name', 'desc');
  return out;
}

let done = false;
export function localiseData(): void {
  if (done) return;
  done = true;
  for (const [item, field] of dataSlots()) item[field] = tr(item[field] as string);
}

/** "pint" or "pints", for a count that may be far too big to be an ordinary number. */
export const pintsLabel = (count: Decimal): string => trn(count.lt(1e6) ? count.toNumber() : 1e6, 'pint', 'pints');
