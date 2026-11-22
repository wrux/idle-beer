import { BEERS } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { BUFFS, type BuffKind } from './events';
import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { LICENCE_BY_ID } from '../data/licence';
import { CHALLENGE_BY_ID, SPECIAL_BY_ID, SPECIALS_OFFERED } from '../data/nights';
import { LOCATIONS, LOCATION_BY_ID, locationIndex } from '../data/locations';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { Decimal, toDecimal } from './num';
import { PUB_COOLDOWN_SECONDS } from './pubs';
import { newGame, SAVE_VERSION, type GameState } from './state';

const KEY = 'idleBeer.save';
/** Beers that existed when Brew Again was replaced by more beers. */
const BEERS_BEFORE_BREW = 13;
/**
 * What each beer cost (as a power of ten) before the list was rewritten in version 4: thirty-one
 * hand-written beers, then generated ones a hundred million times dearer each.
 */
const OLD_BEER_COSTS = [
  -1, 2, 4.3, 6.3, 8.3, 10.3, 12.3, 14.3, 16.7, 20, 23, 27, 32, 37, 42, 47, 52, 57, 62, 68, 74, 80, 86, 92, 99, 106, 113, 120,
  128, 136, 145,
];
/**
 * What the twenty-seven beers of version 4 cost (as a power of ten) when that list was written.
 * Prices have been rebalanced since, so the old list is matched against these, not today's.
 */
const V4_BEER_COSTS = [
  -1, 2, 4.3, 6.3, 8.3, 10.3, 12.3, 14.3, 17, 20, 23, 27, 32, 37, 42, 47, 53, 59, 66, 73, 81, 90, 100, 112, 123, 134, 145,
];
/** An old beer number → the dearest beer in the version 4 list that cost no more than it did. */
function beerFromOldList(old: number): number {
  const cost = old < OLD_BEER_COSTS.length ? OLD_BEER_COSTS[old] : Infinity;
  let i = 0;
  while (i + 1 < BEERS.length && i + 1 < V4_BEER_COSTS.length && V4_BEER_COSTS[i + 1] <= cost + 0.5) i++;
  return i;
}
const BACKUP_KEY = 'idleBeer.save.bak';
/** A save we couldn't read is parked here before anything overwrites it, so it can be rescued by hand. */
export const UNREADABLE_KEY = 'idleBeer.save.unreadable';

type Raw = Record<string, any>;

/** One function per old version, upgrading a raw save object to the next version. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  // v1 → v2: Last Orders arrived. Everything you'd drunk so far counts as this run.
  1: (raw) => ({
    ...raw,
    version: 2,
    pastRunsPints: '0',
    beerMats: '0',
    matsEarned: '0',
    licence: [],
    prestiges: 0,
    kegs: '0',
    runStartedAt: raw.startedAt,
  }),
  // v2 → v3: pubs are opened and chosen, rather than following lifetime pints. Keep everyone where they were.
  2: (raw) => {
    const reached = locationIndex(toDecimal(raw.lifetimePints));
    return { ...raw, version: 3, pubs: LOCATIONS.slice(0, reached + 1).map((l) => l.id), pub: LOCATIONS[reached].id };
  },
  // v3 → v4: the beers were rewritten (27 of them, and no more after The Final Pint). You keep
  // a beer worth about what yours was.
  3: (raw) => {
    let old = Number.isInteger(raw.beer) && raw.beer > 0 ? raw.beer : 0;
    // Before that, "Brew Again" levels had become the beers after Singularity Stout.
    if (Number.isInteger(raw.brewAgain) && raw.brewAgain > 0) old = Math.max(old, BEERS_BEFORE_BREW - 1) + raw.brewAgain;
    return { ...raw, version: 4, beer: beerFromOldList(old), brewAgain: 0 };
  },
};

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Decimals serialise themselves as strings via their toJSON(); Sets become arrays. */
export function serialize(state: GameState): string {
  return toBase64(JSON.stringify({
    ...state,
    upgrades: [...state.upgrades],
    pubs: [...state.pubs],
    achievements: [...state.achievements],
    licence: [...state.licence],
    challengesDone: [...state.challengesDone],
  }));
}

export function deserialize(text: string, now = Date.now()): GameState {
  let raw: Raw = JSON.parse(fromBase64(text));
  if (typeof raw !== 'object' || raw === null) throw new Error('Save is not an object');

  let version = Number(raw.version) || 0;
  if (version > SAVE_VERSION) throw new Error(`Save is from a newer version (${version})`);
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (migrate) raw = migrate(raw);
    version++;
  }

  // Rebuild field by field on top of a fresh game, so missing or broken fields get defaults.
  const s = newGame(now);
  s.pints = toDecimal(raw.pints);
  s.lifetimePints = toDecimal(raw.lifetimePints);
  s.handPints = toDecimal(raw.handPints);
  s.drinks = Number.isFinite(raw.drinks) ? raw.drinks : 0;
  s.autoDrinks = Number.isFinite(raw.autoDrinks) && raw.autoDrinks > 0 ? raw.autoDrinks : 0;
  s.glassFill = Number.isFinite(raw.glassFill) ? Math.min(1, Math.max(0, raw.glassFill)) : 1;
  s.debugPerDrinkMult = toDecimal(raw.debugPerDrinkMult, 1);
  // Only keep drinkers we still know about, with sane counts. Saves from before Phase 2 have none.
  for (const d of DRINKERS) {
    const n = raw.drinkers?.[d.id];
    if (Number.isFinite(n) && n > 0) s.drinkers[d.id] = Math.floor(n);
  }
  if (Array.isArray(raw.upgrades)) {
    for (const id of raw.upgrades) if (UPGRADE_BY_ID.has(id)) s.upgrades.add(id);
  }
  if (Number.isInteger(raw.beer) && raw.beer > 0) s.beer = Math.min(raw.beer, BEERS.length - 1);
  if (Array.isArray(raw.pubs)) for (const id of raw.pubs) if (LOCATION_BY_ID.has(id)) s.pubs.add(id);
  if (typeof raw.pub === 'string' && s.pubs.has(raw.pub)) s.pub = raw.pub;
  // Never longer than a full cooldown from now, whatever the clock has done since.
  if (Number.isFinite(raw.pubReadyAt) && raw.pubReadyAt > 0) s.pubReadyAt = Math.min(raw.pubReadyAt, now + PUB_COOLDOWN_SECONDS * 1000);
  if (['short', 'scientific', 'engineering'].includes(raw.settings?.numberFormat)) {
    s.settings.numberFormat = raw.settings.numberFormat;
  }
  if ([1, 10, 100, 'max'].includes(raw.settings?.buyMode)) s.settings.buyMode = raw.settings.buyMode;
  if (typeof raw.settings?.sound === 'boolean') s.settings.sound = raw.settings.sound;
  if (Array.isArray(raw.buffs)) {
    for (const b of raw.buffs) {
      if (b && b.kind in BUFFS && Number.isFinite(b.remaining) && b.remaining > 0) {
        s.buffs.push({ kind: b.kind as BuffKind, remaining: Math.min(b.remaining, BUFFS[b.kind as BuffKind].duration * 2) });
      }
    }
  }
  if (Number.isInteger(raw.freeRounds) && raw.freeRounds > 0) s.freeRounds = raw.freeRounds;
  if (Number.isInteger(raw.bestStreak) && raw.bestStreak > 0) s.bestStreak = raw.bestStreak;
  if (Array.isArray(raw.achievements)) {
    for (const id of raw.achievements) if (ACHIEVEMENT_BY_ID.has(id)) s.achievements.add(id);
  }
  if (Number.isFinite(raw.playSeconds) && raw.playSeconds > 0) s.playSeconds = raw.playSeconds;
  s.pastRunsPints = toDecimal(raw.pastRunsPints);
  s.beerMats = toDecimal(raw.beerMats);
  s.matsEarned = Decimal.max(toDecimal(raw.matsEarned), s.beerMats);
  if (Array.isArray(raw.licence)) {
    for (const id of raw.licence) if (LICENCE_BY_ID.has(id)) s.licence.add(id);
  }
  if (Number.isInteger(raw.prestiges) && raw.prestiges > 0) s.prestiges = raw.prestiges;
  s.afterHours = raw.afterHours === true;
  if (Array.isArray(raw.specialOffer)) s.specialOffer = raw.specialOffer.filter((id: unknown) => typeof id === 'string' && SPECIAL_BY_ID.has(id)).slice(0, SPECIALS_OFFERED);
  if (typeof raw.special === 'string' && SPECIAL_BY_ID.has(raw.special)) s.special = raw.special;
  if (Array.isArray(raw.challengesDone)) {
    for (const id of raw.challengesDone) if (CHALLENGE_BY_ID.has(id)) s.challengesDone.add(id);
  }
  if (typeof raw.challenge === 'string' && CHALLENGE_BY_ID.has(raw.challenge) && !s.challengesDone.has(raw.challenge)) s.challenge = raw.challenge;
  s.challengeBase = toDecimal(raw.challengeBase);
  s.kegs = toDecimal(raw.kegs);
  s.runStartedAt = Number.isFinite(raw.runStartedAt) ? raw.runStartedAt : s.startedAt;
  for (const k of ['upgrades', 'drinkers', 'beer'] as const) {
    if (typeof raw.settings?.auto?.[k] === 'boolean') s.settings.auto[k] = raw.settings.auto[k];
  }
  s.startedAt = Number.isFinite(raw.startedAt) ? raw.startedAt : now;
  s.lastSaved = Number.isFinite(raw.lastSaved) ? raw.lastSaved : now;
  return s;
}

/** Write the save, keeping the previous one as a backup. */
export function saveGame(state: GameState, storage: Storage = localStorage, now = Date.now()): void {
  state.lastSaved = now;
  try {
    const previous = storage.getItem(KEY);
    if (previous) storage.setItem(BACKUP_KEY, previous);
    storage.setItem(KEY, serialize(state));
  } catch (err) {
    console.warn('Could not save game', err);
  }
}

/**
 * Load the save, falling back to the backup, then to a new game. A save that exists but won't
 * load (a bug, a bad update) is set aside first: the new game's autosaves would otherwise write
 * over it and its backup within a minute.
 */
export function loadGame(storage: Storage = localStorage, now = Date.now()): GameState {
  for (const key of [KEY, BACKUP_KEY]) {
    let text: string | null = null;
    try {
      text = storage.getItem(key);
      if (text) return deserialize(text, now);
    } catch (err) {
      console.warn(`Could not load ${key}`, err);
      try {
        if (text && key === KEY) storage.setItem(UNREADABLE_KEY, text);
      } catch {
        /* storage full or blocked: nothing more we can do */
      }
    }
  }
  return newGame(now);
}

export function wipeSave(storage: Storage = localStorage): void {
  try {
    storage.removeItem(KEY);
    storage.removeItem(BACKUP_KEY);
  } catch {
    /* ignore */
  }
}
