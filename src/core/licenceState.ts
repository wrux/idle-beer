/**
 * The modifiers in force for a game: the Landlord's Licence plus the perk of the pub you're
 * drinking in. Cached until another node is bought or you move.
 */
import { applyEffect, licenceMods, type LicenceMods } from '../data/licence';
import { LOCATION_BY_ID } from '../data/locations';
import type { GameState } from './state';

let cache: { state: GameState; key: string; mods: LicenceMods } | null = null;

/** The pubs whose perks count: the one you're in, or every one you've opened with Pub Crawl Legend. */
export function perkPubs(state: GameState, m: LicenceMods): string[] {
  return m.allPubPerks ? [...new Set([state.pub, ...state.pubs])] : [state.pub];
}

export function mods(state: GameState): LicenceMods {
  const key = `${state.licence.size}|${state.pub}|${state.pubs.size}|${state.achievements.size}`;
  if (cache && cache.state === state && cache.key === key) return cache.mods;
  const m = licenceMods(state.licence);
  for (const pub of perkPubs(state, m)) {
    for (const e of LOCATION_BY_ID.get(pub)?.effects ?? []) {
      if (e.kind === 'all' || e.kind === 'perDrink' || e.kind === 'drinkTime' || e.kind === 'drinkerCost') continue;
      applyEffect(m, e);
    }
  }
  // Trophy Cabinet: what you've achieved makes every mat count for more.
  m.matGain *= 1 + m.matGainPerAch * state.achievements.size;
  cache = { state, key, mods: m };
  return m;
}
