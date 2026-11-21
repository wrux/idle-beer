/**
 * The modifiers in force for a game: the Landlord's Licence plus the perk of the pub you're
 * drinking in. Cached until another node is bought or you move.
 */
import { applyEffect, licenceMods, type LicenceMods } from '../data/licence';
import { LOCATION_BY_ID } from '../data/locations';
import type { GameState } from './state';

let cache: { state: GameState; size: number; pub: string; mods: LicenceMods } | null = null;

export function mods(state: GameState): LicenceMods {
  if (cache && cache.state === state && cache.size === state.licence.size && cache.pub === state.pub) return cache.mods;
  const m = licenceMods(state.licence);
  for (const e of LOCATION_BY_ID.get(state.pub)?.effects ?? []) {
    if (e.kind === 'all' || e.kind === 'perDrink' || e.kind === 'drinkTime' || e.kind === 'drinkerCost') continue;
    applyEffect(m, e);
  }
  cache = { state, size: state.licence.size, pub: state.pub, mods: m };
  return m;
}
