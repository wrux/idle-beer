import { describe, expect, it } from 'vitest';
import { deserialize, loadGame, saveGame, serialize, UNREADABLE_KEY } from '../src/core/save';
import { big, D } from '../src/core/num';
import { newGame } from '../src/core/state';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return Array.from(this.data.keys())[i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('save', () => {
  it('round-trips huge numbers exactly', () => {
    const s = newGame(1000);
    s.pints = big(1.2345, 1e10);
    s.lifetimePints = D('6.789e123456');
    s.drinks = 42;
    s.glassFill = 0.4;
    s.settings.numberFormat = 'engineering';
    s.settings.buyMode = 'max';
    s.drinkers = { regular: 12, multiverse: 160_000_000_000 };

    const back = deserialize(serialize(s), 2000);
    expect(back.pints.eq(s.pints)).toBe(true);
    expect(back.lifetimePints.eq(s.lifetimePints)).toBe(true);
    expect(back.drinks).toBe(42);
    expect(back.glassFill).toBe(0.4);
    expect(back.settings).toEqual({
      numberFormat: 'engineering', buyMode: 'max', sound: true, auto: { upgrades: true, drinkers: true, beer: true },
    });
    expect(back.drinkers).toEqual({ regular: 12, multiverse: 160_000_000_000 });
  });

  it('stores numbers as strings, never JSON numbers', () => {
    const s = newGame();
    s.pints = D('1e500');
    const json = JSON.parse(atob(serialize(s)));
    expect(json.pints).toBe('1e+500');
  });

  it('fills in defaults for missing or broken fields', () => {
    const text = btoa(JSON.stringify({ version: 1, pints: 'banana', settings: { numberFormat: 'crayon' } }));
    const s = deserialize(text);
    expect(s.pints.eq(0)).toBe(true);
    expect(s.settings.numberFormat).toBe('short');
    expect(s.glassFill).toBe(1);
  });

  it('loads Phase 1 saves (no drinkers) and drops unknown or broken drinker counts', () => {
    const phase1 = btoa(JSON.stringify({ version: 1, pints: '50', settings: { numberFormat: 'short' } }));
    expect(deserialize(phase1).drinkers).toEqual({});
    const odd = btoa(JSON.stringify({ version: 1, drinkers: { regular: 3.7, student: -2, ghost: 9, darts: 'x' } }));
    expect(deserialize(odd).drinkers).toEqual({ regular: 3 });
  });

  it('rejects saves from a newer version', () => {
    expect(() => deserialize(btoa(JSON.stringify({ version: 999 })))).toThrow();
  });

  it('falls back to the backup when the main save is corrupt', () => {
    const storage = new MemoryStorage();
    const s = newGame();
    s.pints = D(100);
    saveGame(s, storage);
    s.pints = D(200);
    saveGame(s, storage); // previous save (100) becomes the backup
    storage.setItem('idleBeer.save', 'not base64 at all!!');
    expect(loadGame(storage).pints.eq(100)).toBe(true);
  });

  it('sets an unreadable save aside rather than letting autosave write over it', () => {
    const storage = new MemoryStorage();
    storage.setItem('idleBeer.save', 'not base64 at all!!');
    const fresh = loadGame(storage);
    expect(fresh.pints.eq(0)).toBe(true);
    saveGame(fresh, storage);
    saveGame(fresh, storage); // by now both the save and its backup are the new game
    expect(storage.getItem(UNREADABLE_KEY)).toBe('not base64 at all!!');
  });

  it('starts a new game when there is nothing saved', () => {
    expect(loadGame(new MemoryStorage()).pints.eq(0)).toBe(true);
  });
});
