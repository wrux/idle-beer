/**
 * The store panel: next beer, upgrades and drinkers. DOM is built once and patched
 * (upgrade tiles are only rebuilt when the set of available upgrades changes).
 */
import {
  availableUpgrades, buyDrinker, buyNextRound, buyUpgrade, currentBeer, drinkerDiscount, drinkerPpsEach, priceOf,
  nextRound, quantityFor, storeVisibility,
} from '../core/economy';
import { format } from '../core/format';
import { D } from '../core/num';
import { owned, type BuyMode, type GameState } from '../core/state';
import { beerAt } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import type { Upgrade } from '../data/upgrades';
import { beerIcon, drinkerPortrait } from './art/icons';

const MODES: BuyMode[] = [1, 10, 100, 'max'];
const modeLabel = (m: BuyMode) => (m === 'max' ? 'Max' : `×${m}`);

/** Only touch the DOM when text actually changes. */
function textSetter() {
  const last = new Map<HTMLElement, string>();
  return (el: HTMLElement, text: string) => {
    if (last.get(el) === text) return;
    last.set(el, text);
    el.textContent = text;
  };
}

const multText = (m: number) => `×${m % 1 === 0 ? m : m.toFixed(1)}`;

export interface StoreEvents {
  /** Anything bought: drinkers, upgrades or a beer. */
  onBought(): void;
  /** The beer in your hand changed. */
  onBeerChanged(): void;
}

export class StoreView {
  private set = textSetter();
  private modeButtons: HTMLButtonElement[] = [];
  private rows: {
    el: HTMLButtonElement; name: HTMLElement; owned: HTMLElement;
    flavour: HTMLElement; cost: HTMLElement; pps: HTMLElement;
  }[] = [];

  // Beer card
  private beerNow: HTMLElement;
  private beerCard: HTMLButtonElement;
  private beerName: HTMLElement;
  private beerDesc: HTMLElement;
  private beerCost: HTMLElement;
  private beerIconEl: HTMLElement;
  private beerIconKey = '';

  // Upgrades
  private upgradeGrid: HTMLElement;
  private upgradeCount: HTMLElement;
  private detail: HTMLElement;
  private tiles = new Map<string, HTMLButtonElement>();
  private tileKey = '';
  private focused: string | null = null;
  private lastPointer = 'mouse';

  constructor(root: HTMLElement, private getState: () => GameState, private events: StoreEvents) {
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

    // ----- beer -----
    this.beerNow = q('.beer-now');
    this.beerCard = q('.beer-card');
    this.beerName = q('.beer-name');
    this.beerDesc = q('.beer-desc');
    this.beerCost = q('.beer-cost');
    this.beerIconEl = q('.beer-icon');
    this.beerCard.addEventListener('click', () => {
      if (buyNextRound(this.getState())) {
        this.events.onBought();
        this.events.onBeerChanged();
      }
      this.update();
    });

    // ----- upgrades -----
    this.upgradeGrid = q('.upgrade-grid');
    this.upgradeCount = q('.upgrade-count');
    this.detail = q('.upgrade-detail');
    this.upgradeGrid.addEventListener('pointerdown', (e) => (this.lastPointer = e.pointerType));
    this.upgradeGrid.addEventListener('pointerleave', () => {
      if (this.lastPointer === 'mouse') this.showDetail(null);
    });

    // ----- drinkers -----
    const modes = q('.buy-modes');
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = modeLabel(m);
      b.addEventListener('click', () => {
        this.getState().settings.buyMode = m;
        this.update();
      });
      modes.appendChild(b);
      this.modeButtons.push(b);
    }

    const list = q('.store-list');
    for (const d of DRINKERS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'drinker';
      el.innerHTML = `
        <span class="d-icon" aria-hidden="true"></span>
        <span class="d-main">
          <span class="d-name"></span>
          <span class="d-flavour"></span>
          <span class="d-meta"><span class="d-cost"></span><span class="d-pps"></span></span>
        </span>
        <span class="d-owned"></span>`;
      el.addEventListener('click', () => {
        const state = this.getState();
        if (buyDrinker(state, d.id, state.settings.buyMode) > 0) this.events.onBought();
        this.update();
      });
      list.appendChild(el);
      const r = (s: string) => el.querySelector<HTMLElement>(s)!;
      r('.d-icon').appendChild(drinkerPortrait(d.id));
      this.rows.push({
        el, name: r('.d-name'), owned: r('.d-owned'),
        flavour: r('.d-flavour'), cost: r('.d-cost'), pps: r('.d-pps'),
      });
    }
    this.update();
  }

  update(): void {
    this.updateBeer();
    this.updateUpgrades();
    this.updateDrinkers();
  }

  // ---------- beer ----------

  private updateBeer() {
    const state = this.getState();
    const f = state.settings.numberFormat;
    const now = currentBeer(state);
    this.set(this.beerNow, `Drinking: ${now.name}`);

    const offer = nextRound(state);
    const shown = offer ? offer.beer : beerAt(state.beer + 1);
    const iconKey = `${shown.id}:${offer ? 1 : 0}`;
    if (iconKey !== this.beerIconKey) {
      this.beerIconKey = iconKey;
      this.beerIconEl.replaceChildren(beerIcon(shown.look, 52));
    }
    if (!offer) {
      // Tease the next one with when it shows up.
      const next = beerAt(state.beer + 1);
      this.beerCard.disabled = true;
      this.beerCard.classList.remove('affordable');
      this.beerCard.classList.add('mystery');
      this.set(this.beerName, '???');
      this.set(this.beerDesc, `Revealed at ${format(next.cost.mul(0.5), f)} lifetime pints.`);
      this.set(this.beerCost, '');
      return;
    }
    const affordable = state.pints.gte(offer.cost);
    this.beerCard.disabled = false;
    this.beerCard.classList.remove('mystery');
    this.beerCard.classList.toggle('affordable', affordable);
    this.set(this.beerName, offer.beer.name);
    this.set(this.beerDesc, `${multText(offer.mult)} everything. ${offer.beer.flavour}`);
    this.set(this.beerCost, format(offer.cost, f));
  }

  // ---------- upgrades ----------

  private updateUpgrades() {
    const state = this.getState();
    const list = availableUpgrades(state);
    const key = list.map((u) => u.id).join(',');
    if (key !== this.tileKey) this.rebuildTiles(list);

    this.set(this.upgradeCount, list.length ? String(list.length) : '');
    for (const u of list) this.tiles.get(u.id)!.classList.toggle('affordable', state.pints.gte(u.cost));
    if (this.focused && !this.tiles.has(this.focused)) this.focused = null;
    this.renderDetail();
  }

  private rebuildTiles(list: Upgrade[]) {
    this.tileKey = list.map((u) => u.id).join(',');
    this.tiles.clear();
    this.upgradeGrid.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'upgrade-empty';
      empty.textContent = 'Nothing on offer yet. Keep drinking.';
      this.upgradeGrid.appendChild(empty);
      return;
    }
    for (const u of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `upgrade-tile group-${u.group}`;
      b.innerHTML = `<span class="u-icon" aria-hidden="true"></span>${u.badge ? '<span class="u-badge"></span>' : ''}`;
      const iconEl = b.querySelector<HTMLElement>('.u-icon')!;
      if (u.effect.kind === 'drinker') iconEl.appendChild(drinkerPortrait(u.effect.drinker, 38));
      else iconEl.textContent = u.icon;
      if (u.badge) b.querySelector<HTMLElement>('.u-badge')!.textContent = u.badge;
      b.setAttribute('aria-label', `${u.name}: ${u.desc}`);
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') this.showDetail(u.id);
      });
      b.addEventListener('focus', () => this.showDetail(u.id));
      b.addEventListener('click', () => {
        // Mouse: click buys. Touch: first tap shows details, second tap buys.
        if (this.lastPointer !== 'mouse' && this.focused !== u.id) {
          this.showDetail(u.id);
          return;
        }
        if (buyUpgrade(this.getState(), u.id)) {
          this.events.onBought();
          this.focused = null;
        }
        this.update();
      });
      this.upgradeGrid.appendChild(b);
      this.tiles.set(u.id, b);
    }
  }

  private showDetail(id: string | null) {
    this.focused = id;
    for (const [tid, el] of this.tiles) el.classList.toggle('focused', tid === id);
    this.renderDetail();
  }

  private renderDetail() {
    const state = this.getState();
    const list = availableUpgrades(state);
    const u = this.focused ? list.find((x) => x.id === this.focused) : null;
    // The panel sits below the grid and is always there, so hovering never shifts the tiles.
    this.detail.hidden = list.length === 0;
    if (!u) {
      if (this.detail.dataset.id !== '') {
        this.detail.dataset.id = '';
        this.detail.innerHTML = '<div class="ud-placeholder"></div>';
      }
      this.set(
        this.detail.querySelector<HTMLElement>('.ud-placeholder')!,
        this.lastPointer === 'mouse' ? 'Hover an upgrade to see what it does.' : 'Tap an upgrade to see what it does.',
      );
      return;
    }
    const f = state.settings.numberFormat;
    const affordable = state.pints.gte(u.cost);
    const action = this.lastPointer === 'mouse' ? 'Click' : 'Tap again';
    const html =
      `<div class="ud-head"><span class="ud-name"></span><span class="ud-cost ${affordable ? '' : 'short'}"></span></div>` +
      `<div class="ud-desc"></div><div class="ud-hint"></div>`;
    if (this.detail.dataset.id !== u.id) {
      this.detail.dataset.id = u.id;
      this.detail.innerHTML = html;
    }
    const d = (s: string) => this.detail.querySelector<HTMLElement>(s)!;
    this.set(d('.ud-name'), u.name);
    this.set(d('.ud-cost'), format(u.cost, f));
    d('.ud-cost').classList.toggle('short', !affordable);
    this.set(d('.ud-desc'), u.desc);
    this.set(d('.ud-hint'), affordable ? `${action} to buy` : 'Not enough pints yet');
  }

  // ---------- drinkers ----------

  private updateDrinkers() {
    const state = this.getState();
    const f = state.settings.numberFormat;
    const mode = state.settings.buyMode;
    this.modeButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(MODES[i] === mode)));

    const vis = storeVisibility(state);
    DRINKERS.forEach((d, i) => {
      const row = this.rows[i];
      row.el.hidden = vis[i] === 'hidden';
      if (vis[i] === 'hidden') return;
      const mystery = vis[i] === 'mystery';

      const have = owned(state, d.id);
      const qty = quantityFor(state, mode, d, have);
      const cost = priceOf(state, d, have, qty);
      const affordable = state.pints.gte(cost);

      row.el.classList.toggle('mystery', mystery);
      row.el.classList.toggle('discounted', drinkerDiscount(state) < 1);
      row.el.classList.toggle('affordable', affordable && !mystery);
      row.el.disabled = mystery;

      this.set(row.name, mystery ? '???' : d.name);
      this.set(row.flavour, mystery ? 'Keep drinking to find out who turns up.' : d.flavour);
      this.set(row.owned, have > 0 ? format(D(have), f) : '');
      this.set(row.cost, `${format(cost, f)}${qty > 1 ? ` for ${format(D(qty), f)}` : ''}`);
      this.set(row.pps, mystery ? '' : `+${format(drinkerPpsEach(state, d), f)}/s each`);
      row.el.setAttribute(
        'aria-label',
        mystery ? 'Unknown drinker' : `${d.name}, owned ${have}. Buy ${qty} for ${format(cost, f)} pints.`,
      );
    });
  }
}
