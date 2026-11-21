/** The licence modifiers for a game, cached until another node is bought. */
import { licenceMods, type LicenceMods } from '../data/licence';
import type { GameState } from './state';

let cache: { state: GameState; size: number; mods: LicenceMods } | null = null;

export function mods(state: GameState): LicenceMods {
  if (cache && cache.state === state && cache.size === state.licence.size) return cache.mods;
  const m = licenceMods(state.licence);
  cache = { state, size: state.licence.size, mods: m };
  return m;
}
