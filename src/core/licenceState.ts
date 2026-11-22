/**
 * The modifiers in force for a game: the Landlord's Licence, the perk of the pub you're drinking
 * in, tonight's special, and any challenge you're on or have beaten. Cached until another node is bought or you move.
 */
import { applyEffect, licenceMods, type LicenceMods } from '../data/licence';
import { LOCATION_BY_ID } from '../data/locations';
import { VOID_BY_ID } from '../data/bang';
import { CHALLENGE_BY_ID, SPECIAL_BY_ID } from '../data/nights';
import type { GameState } from './state';

let cache: { state: GameState; key: string; mods: LicenceMods } | null = null;

/** The pubs whose perks count: the one you're in, or every one you've opened with Pub Crawl Legend. */
export function perkPubs(state: GameState, m: LicenceMods): string[] {
  return m.allPubPerks ? [...new Set([state.pub, ...state.pubs])] : [state.pub];
}

export function mods(state: GameState): LicenceMods {
  const key = `${state.licence.size}|${state.pub}|${state.pubs.size}|${state.achievements.size}|${state.special}|${state.challenge}|${state.challengesDone.size}|${state.voidTree.size}`;
  if (cache && cache.state === state && cache.key === key) return cache.mods;
  const m = licenceMods(state.licence);
  for (const pub of perkPubs(state, m)) {
    for (const e of LOCATION_BY_ID.get(pub)?.effects ?? []) {
      if (e.kind === 'all' || e.kind === 'perDrink' || e.kind === 'drinkTime' || e.kind === 'drinkerCost') continue;
      applyEffect(m, e);
    }
  }
  // The night itself: tonight's special, the challenge you're on, and the prizes of those you've beaten.
  for (const e of (state.special && SPECIAL_BY_ID.get(state.special)?.effects) || []) applyEffect(m, e);
  for (const e of (state.challenge && CHALLENGE_BY_ID.get(state.challenge)?.handicap) || []) applyEffect(m, e);
  for (const id of state.challengesDone) for (const e of CHALLENGE_BY_ID.get(id)?.prize ?? []) applyEffect(m, e);
  // What Black Hole Beers have bought, which outlasts the universe.
  for (const id of state.voidTree) for (const e of VOID_BY_ID.get(id)?.effects ?? []) applyEffect(m, e);
  m.matRate *= m.matRateMult;
  // Trophy Cabinet: what you've achieved makes every mat count for more.
  m.matGain *= 1 + m.matGainPerAch * state.achievements.size;
  cache = { state, key, mods: m };
  return m;
}
