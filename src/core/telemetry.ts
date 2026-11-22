/**
 * What gets counted about a game, worked out from the save alone: a small snapshot of how far
 * it has got, and the moments (a new pub, a new beer, a Last Orders) between two snapshots.
 * Nothing here talks to the network; src/telemetry.ts does the sending.
 */
import type { GameState } from './state';
import { BEERS } from '../data/beers';
import { LOCATIONS } from '../data/locations';

export interface Snapshot {
  drinks: number;
  drinkers: number;
  pubs: string[];
  beer: number;
  prestiges: number;
  licence: string[];
  achievements: string[];
  freeRounds: number;
  afterHours: boolean;
}

export interface Moment {
  /** What happened, e.g. `pub`. */
  event: string;
  /** Which one, e.g. the pub's id. */
  label?: string;
  /** A number that goes with it, e.g. the pub's place in the list. */
  value?: number;
}

/** Crowd sizes worth a moment of their own. */
const CROWDS = [10, 50, 100, 500, 1000];
/** A big jump (an import, a long time away) shouldn't send a flood. */
const MOST_AT_ONCE = 5;

export function snapshot(state: GameState): Snapshot {
  return {
    drinks: state.drinks,
    drinkers: Object.values(state.drinkers).reduce((sum, n) => sum + n, 0),
    pubs: [...state.pubs],
    beer: state.beer,
    prestiges: state.prestiges,
    licence: [...state.licence],
    achievements: [...state.achievements],
    freeRounds: state.freeRounds,
    afterHours: state.afterHours,
  };
}

const added = (before: string[], after: string[]) => after.filter((id) => !before.includes(id));

/** Everything worth counting that happened between two snapshots of the same game. */
export function moments(before: Snapshot, after: Snapshot): Moment[] {
  const out: Moment[] = [];
  if (before.drinks === 0 && after.drinks > 0) out.push({ event: 'first_drink' });
  if (before.drinkers === 0 && after.drinkers > 0) out.push({ event: 'first_drinker' });
  for (const size of CROWDS) {
    if (before.drinkers < size && after.drinkers >= size) out.push({ event: 'crowd', value: size });
  }
  for (const id of added(before.pubs, after.pubs).slice(-MOST_AT_ONCE)) {
    out.push({ event: 'pub', label: id, value: LOCATIONS.findIndex((l) => l.id === id) });
  }
  if (after.beer > before.beer) out.push({ event: 'beer', label: BEERS[after.beer]?.id, value: after.beer });
  if (after.prestiges > before.prestiges) out.push({ event: 'last_orders', value: after.prestiges });
  if (before.afterHours && !after.afterHours) out.push({ event: 'back_to_pub', value: after.prestiges });
  for (const id of added(before.licence, after.licence).slice(-MOST_AT_ONCE)) out.push({ event: 'licence', label: id });
  for (const id of added(before.achievements, after.achievements).slice(-MOST_AT_ONCE)) {
    out.push({ event: 'achievement', label: id });
  }
  if (after.freeRounds > before.freeRounds) out.push({ event: 'free_round', value: after.freeRounds });
  return out;
}

/**
 * The numbers sent with every moment, in this order (they become double2… in the dataset;
 * double1 is the moment's own value). Add to the end only: the order is the schema.
 */
export function progress(state: GameState, sessionSeconds: number, session: number): number[] {
  const everything = state.lifetimePints.add(state.pastRunsPints);
  return [
    Math.round(state.playSeconds),
    Math.round(sessionSeconds),
    session,
    state.prestiges,
    Math.max(...[...state.pubs].map((id) => LOCATIONS.findIndex((l) => l.id === id)), 0),
    state.beer,
    state.licence.size,
    state.achievements.size,
    everything.gt(1) ? Math.round(everything.log10() * 100) / 100 : 0,
    Object.values(state.drinkers).reduce((sum, n) => sum + n, 0),
    state.drinks,
  ];
}
