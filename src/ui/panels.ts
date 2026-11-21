/** Achievements, Stats and Settings dialogs. */
import {
  currentBeer, drinkTime, pintsPerDrink, reputationMult, totalPps,
} from '../core/economy';
import { format, pintsWord, type NumberFormat } from '../core/format';
import { D } from '../core/num';
import type { GameState } from '../core/state';
import { ACHIEVEMENTS, type Achievement } from '../data/achievements';
import { DRINKERS } from '../data/drinkers';
import { LOCATION_BY_ID } from '../data/locations';
import { UPGRADES } from '../data/upgrades';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Wire up a <dialog>: open button, close button, click on the backdrop to close. */
function dialog(id: string, openId: string, onOpen: () => void): HTMLDialogElement {
  const d = $<HTMLDialogElement>(id);
  $(openId).addEventListener('click', () => {
    d.showModal();
    onOpen(); // after opening: panels only render while open
  });
  d.querySelector('.dialog-close')!.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  return d;
}

export function playTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

// ---------- achievements ----------

export class AchievementsPanel {
  private dialog: HTMLDialogElement;
  private grid = $('achievement-grid');
  private detail = $('achievement-detail');
  private summary = $('achievements-summary');
  private badge = $('achievement-badge');
  private tiles = new Map<string, HTMLButtonElement>();
  private seen: number;
  private selected: Achievement | null = null;

  constructor(private getState: () => GameState) {
    this.seen = getState().achievements.size;
    this.dialog = dialog('achievements-dialog', 'open-achievements', () => {
      this.seen = this.getState().achievements.size;
      this.update();
    });
    for (const a of ACHIEVEMENTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'achievement-tile';
      const show = () => this.select(a);
      b.addEventListener('pointerenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', show);
      this.grid.appendChild(b);
      this.tiles.set(a.id, b);
    }
    this.update();
  }

  private select(a: Achievement) {
    this.selected = a;
    this.renderDetail();
  }

  private renderDetail() {
    const a = this.selected;
    const has = a ? this.getState().achievements.has(a.id) : false;
    if (!a) {
      this.detail.innerHTML = '<span class="ad-placeholder">Hover or tap an achievement to see how to get it.</span>';
      return;
    }
    const secret = a.hidden && !has;
    this.detail.innerHTML = '';
    const name = document.createElement('div');
    name.className = 'ad-name';
    name.textContent = `${secret ? '❓' : a.icon} ${secret ? 'Secret achievement' : a.name}${has ? ' ✓' : ''}`;
    const desc = document.createElement('div');
    desc.className = 'ad-desc';
    desc.textContent = secret ? 'Keep playing. Some things are best discovered.' : a.desc;
    this.detail.append(name, desc);
  }

  /** Refresh tiles, summary and the unseen-count badge. */
  update(): void {
    const s = this.getState();
    const got = s.achievements.size;
    const unseen = got - this.seen;
    this.badge.hidden = unseen <= 0;
    this.badge.textContent = String(unseen);
    if (!this.dialog.open) return;

    const bonus = (reputationMult(s) - 1) * 100;
    this.summary.textContent =
      `${got} of ${ACHIEVEMENTS.length} unlocked · Reputation bonus +${bonus.toFixed(bonus < 10 ? 1 : 0)}%` +
      (bonus === 0 ? ' (buy Reputation upgrades to turn achievements into a bonus)' : '');
    for (const a of ACHIEVEMENTS) {
      const t = this.tiles.get(a.id)!;
      const has = s.achievements.has(a.id);
      const icon = has || !a.hidden ? a.icon : '❓';
      if (t.textContent !== icon) t.textContent = icon;
      t.classList.toggle('unlocked', has);
      t.setAttribute('aria-label', has || !a.hidden ? `${a.name}${has ? ' (unlocked)' : ''}` : 'Secret achievement');
    }
    this.renderDetail();
  }
}

// ---------- stats ----------

export class StatsPanel {
  private dialog: HTMLDialogElement;
  private list = $('stats-list');

  constructor(private getState: () => GameState) {
    this.dialog = dialog('stats-dialog', 'open-stats', () => this.update());
  }

  update(): void {
    if (!this.dialog.open) return;
    const s = this.getState();
    const f = s.settings.numberFormat;
    const n = (v: number) => format(D(v), f);
    const drinkers = DRINKERS.reduce((t, d) => t + (s.drinkers[d.id] ?? 0), 0);
    const rows: [string, string][] = [
      ['Pints', format(s.pints.floor(), f)],
      ['Lifetime pints', format(s.lifetimePints.floor(), f)],
      ['Pints per second', format(totalPps(s), f)],
      ['Pints per drink', format(pintsPerDrink(s), f)],
      ['Drunk by hand', `${format(s.handPints.floor(), f)} ${pintsWord(s.handPints.floor())} in ${n(s.drinks)} drink${s.drinks === 1 ? '' : 's'}`],
      ['Drunk on his own', `${n(s.autoDrinks)} pint${s.autoDrinks === 1 ? '' : 's'}`],
      ['Time per pint', `${drinkTime(s).toFixed(2)}s`],
      ['Best chug streak', n(s.bestStreak)],
      ['Free Rounds claimed', n(s.freeRounds)],
      ['Drinkers', n(drinkers)],
      ['Upgrades', `${s.upgrades.size} of ${UPGRADES.length}`],
      ['Beer', currentBeer(s).name],
      ['Drinking at', LOCATION_BY_ID.get(s.pub)?.name ?? ''],
      ['Pubs open', String(s.pubs.size)],
      ['Achievements', `${s.achievements.size} of ${ACHIEVEMENTS.length}`],
      ['Time played', playTime(s.playSeconds)],
      ['Started', new Date(s.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
    ];
    const html = rows.map(() => `<dt></dt><dd></dd>`).join('');
    if (this.list.childElementCount !== rows.length * 2) this.list.innerHTML = html;
    rows.forEach(([k, v], i) => {
      const dt = this.list.children[i * 2] as HTMLElement;
      const dd = this.list.children[i * 2 + 1] as HTMLElement;
      if (dt.textContent !== k) dt.textContent = k;
      if (dd.textContent !== v) dd.textContent = v;
    });
  }
}

// ---------- settings ----------

export interface SettingsEvents {
  onFormatChange(f: NumberFormat): void;
  onSoundChange(on: boolean): void;
  exportSave(): string;
  importSave(text: string): string | null;
  hardReset(): void;
}

export class SettingsPanel {
  private format = $<HTMLSelectElement>('number-format');
  private sound = $<HTMLInputElement>('sound-setting');
  private text = $<HTMLTextAreaElement>('save-text');
  private message = $('save-message');

  constructor(private getState: () => GameState, events: SettingsEvents) {
    dialog('settings-dialog', 'open-settings', () => {
      this.sync();
      this.message.textContent = '';
    });
    this.format.addEventListener('change', () => events.onFormatChange(this.format.value as NumberFormat));
    this.sound.addEventListener('change', () => events.onSoundChange(this.sound.checked));

    $('export-save').addEventListener('click', async () => {
      const save = events.exportSave();
      this.text.value = save;
      this.text.select();
      try {
        await navigator.clipboard.writeText(save);
        this.message.textContent = 'Copied to your clipboard. Keep it somewhere safe.';
      } catch {
        this.message.textContent = 'Copy the text above and keep it somewhere safe.';
      }
    });

    $('import-save').addEventListener('click', () => {
      const text = this.text.value.trim();
      if (!text) {
        this.message.textContent = 'Paste a save into the box first.';
        return;
      }
      if (!confirm('Replace your current game with this save?')) return;
      const error = events.importSave(text);
      if (error) this.message.textContent = error;
    });

    $('hard-reset').addEventListener('click', () => {
      if (confirm('Wipe everything and start again from a single pint? This cannot be undone.')) events.hardReset();
    });
  }

  sync(): void {
    const s = this.getState();
    this.format.value = s.settings.numberFormat;
    this.sound.checked = s.settings.sound;
  }
}
