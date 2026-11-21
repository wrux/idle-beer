import { DRINKERS } from '../data/drinkers';
import { BUFFS, type BuffKind } from './events';
import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { LICENCE_BY_ID } from '../data/licence';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { Decimal, toDecimal } from './num';
import { newGame, SAVE_VERSION, type GameState } from './state';

const KEY = 'idleBeer.save';
/** Beers that existed when Brew Again was replaced by more beers. */
const BEERS_BEFORE_BREW = 13;
const BACKUP_KEY = 'idleBeer.save.bak';

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
    achievements: [...state.achievements],
    licence: [...state.licence],
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
  if (Number.isInteger(raw.beer) && raw.beer > 0) s.beer = raw.beer;
  // Older saves had "Brew Again" levels after Singularity Stout (beer 12); they become the beers after it.
  if (Number.isInteger(raw.brewAgain) && raw.brewAgain > 0) s.beer = Math.max(s.beer, BEERS_BEFORE_BREW - 1) + raw.brewAgain;
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

/** Load the save, falling back to the backup, then to a new game. */
export function loadGame(storage: Storage = localStorage, now = Date.now()): GameState {
  for (const key of [KEY, BACKUP_KEY]) {
    try {
      const text = storage.getItem(key);
      if (text) return deserialize(text, now);
    } catch (err) {
      console.warn(`Could not load ${key}`, err);
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
