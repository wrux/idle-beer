import { D, Decimal } from './num';
import type { Buff } from './events';
import type { NumberFormat } from './format';
import type { AutoBuy } from '../data/licence';

export const SAVE_VERSION = 2;

export type BuyMode = 1 | 10 | 100 | 'max';

export interface GameState {
  version: number;
  /** Spendable pints (the score). */
  pints: Decimal;
  /** Every pint ever earned this run. */
  lifetimePints: Decimal;
  /** Pints earned by drinking by hand. */
  handPints: Decimal;
  /** Pints finished by hand. Stays small enough for a plain number. */
  drinks: number;
  /** Pints he finished on his own while you weren't holding. */
  autoDrinks: number;
  /** How full the glass in your hand is, 0..1, so a refresh mid-pint keeps it. */
  glassFill: number;
  /** Drinkers owned, by drinker id. A plain number: even Max-buying at 1e(9e15) stays below 1e17. */
  drinkers: Record<string, number>;
  /** Upgrade ids bought this run. */
  upgrades: Set<string>;
  /** Index of the beer you're drinking (see beerAt: hand-written first, then generated forever). */
  beer: number;
  /** Timed rewards from Free Rounds. */
  buffs: Buff[];
  /** Golden pints clicked. */
  freeRounds: number;
  /** Longest chug streak. */
  bestStreak: number;
  /** Achievement ids unlocked (kept across prestige, later). */
  achievements: Set<string>;
  /** Seconds spent with the game open. */
  playSeconds: number;

  // ----- prestige (kept across Last Orders) -----
  /** Lifetime pints from every finished run (this run's are in lifetimePints). */
  pastRunsPints: Decimal;
  /** Unspent Beer Mats; each one boosts everything. */
  beerMats: Decimal;
  /** Every Beer Mat ever earned (spent or not), so a reset only pays out new ones. */
  matsEarned: Decimal;
  /** Landlord's Licence nodes bought. */
  licence: Set<string>;
  /** Times you've called Last Orders. */
  prestiges: number;
  /** Reserved for the second prestige layer (Brewery Empire). */
  kegs: Decimal;
  /** When this run started. */
  runStartedAt: number;
  /** Debug-only multiplier so we can test huge per-drink values. */
  debugPerDrinkMult: Decimal;
  settings: {
    numberFormat: NumberFormat;
    buyMode: BuyMode;
    sound: boolean;
    /** Auto-buyer switches (they only run once the Licence node is bought). */
    auto: Record<AutoBuy, boolean>;
  };
  startedAt: number;
  lastSaved: number;
}

export function newGame(now = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    pints: D(0),
    lifetimePints: D(0),
    handPints: D(0),
    drinks: 0,
    autoDrinks: 0,
    glassFill: 1,
    drinkers: {},
    upgrades: new Set(),
    beer: 0,
    buffs: [],
    freeRounds: 0,
    bestStreak: 0,
    achievements: new Set(),
    playSeconds: 0,
    pastRunsPints: D(0),
    beerMats: D(0),
    matsEarned: D(0),
    licence: new Set(),
    prestiges: 0,
    kegs: D(0),
    runStartedAt: now,
    debugPerDrinkMult: D(1),
    settings: { numberFormat: 'short', buyMode: 1, sound: true, auto: { upgrades: true, drinkers: true, beer: true } },
    startedAt: now,
    lastSaved: now,
  };
}

export const owned = (state: GameState, id: string): number => state.drinkers[id] ?? 0;
