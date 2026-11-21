/**
 * The shop: the next beer on top, then tabs for drinkers, upgrades and pubs. DOM is built once
 * and patched (upgrade rows are only rebuilt when the set of available upgrades changes).
 */
import {
  availableUpgrades, buyDrinker, buyNextRound, buyPub, buyUpgrade, currentBeer, drinkerDiscount, drinkerPpsEach,
  nextRound, priceOf, pubBonus, pubCooldownLeft, pubStatuses, quantityFor, selectPub, storeVisibility,
} from '../core/economy';
import { format } from '../core/format';
import { D, type Decimal } from '../core/num';
import { owned, type BuyMode, type GameState } from '../core/state';
import { beerAt } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { LOCATIONS } from '../data/locations';
import type { Upgrade } from '../data/upgrades';
import { beerIcon, drinkerPortrait, pubThumb } from './art/icons';
import { icon } from './glyphs';

const MODES: BuyMode[] = [1, 10, 100, 'max'];
const modeLabel = (m: BuyMode) => (m === 'max' ? 'Max' : `×${m}`);
type Tab = 'drinkers' | 'upgrades' | 'pubs';

const GROUP_LABEL: Record<Upgrade['group'], string> = {
  drinker: 'Drinkers', drinking: 'Drinking', synergy: 'Teamwork', pub: 'The pub', reputation: 'Reputation',
};

/** Only touch the DOM when text actually changes. */
function textSetter() {
  const last = new Map<HTMLElement, string>();
  return (el: HTMLElement, text: string) => {
    if (last.get(el) === text) return;
    last.set(el, text);
    el.textContent = text;
  };
}

/** How far towards affording something you are, as a CSS variable the row fills itself with. */
function setProgress(el: HTMLElement, have: Decimal, cost: Decimal) {
  const p = cost.lte(0) ? 1 : Math.min(1, Math.max(0, have.div(cost).toNumber()));
  const v = (Math.round(p * 200) / 200).toString();
  if (el.dataset.p !== v) {
    el.dataset.p = v;
    el.style.setProperty('--p', v);
  }
}

/** A quick flash on something you've just bought. */
function flash(el: HTMLElement) {
  el.classList.remove('bought');
  void el.offsetWidth;
  el.classList.add('bought');
}

const multText = (m: number) => `×${m % 1 === 0 ? m : m.toFixed(1)}`;

export interface StoreEvents {
  /** Anything bought: drinkers, upgrades, a beer or a pub. */
  onBought(): void;
  /** The beer in your hand changed. */
  onBeerChanged(): void;
  /** You moved pub. `opened` is true when it's one you've just bought. */
  onPubChanged(opened: boolean): void;
}

export class StoreView {
  private set = textSetter();
  private tab: Tab = 'drinkers';
  private tabButtons: HTMLButtonElement[];
  private panels: HTMLElement[];
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
  private upgradeList: HTMLElement;
  private upgradeCount: HTMLElement;
  private upgradeRows = new Map<string, { el: HTMLButtonElement; cost: HTMLElement }>();
  private upgradeKey = '';

  // Pubs
  private pubCount: HTMLElement;
  private pubRows: {
    el: HTMLButtonElement; thumb: HTMLElement; name: HTMLElement; perk: HTMLElement; bonus: HTMLElement; action: HTMLElement;
    drawn: boolean;
  }[] = [];

  constructor(root: HTMLElement, private getState: () => GameState, private events: StoreEvents) {
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

    // ----- tabs -----
    this.tabButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.tab'));
    this.panels = Array.from(root.querySelectorAll<HTMLElement>('.tab-panel'));
    for (const b of this.tabButtons) b.addEventListener('click', () => this.show(b.dataset.tab as Tab));

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
    this.upgradeList = q('.upgrade-list');
    this.upgradeCount = q('.upgrade-count');

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
        if (buyDrinker(state, d.id, state.settings.buyMode) > 0) {
          this.events.onBought();
          flash(el);
        }
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

    // ----- pubs -----
    this.pubCount = q('.pub-count');
    const pubs = q('.pub-list');
    for (const l of LOCATIONS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pub';
      el.innerHTML = `
        <span class="p-thumb" aria-hidden="true"></span>
        <span class="p-main">
          <span class="p-name"></span>
          <span class="p-perk"></span>
          <span class="p-bonus"></span>
        </span>
        <span class="p-action"></span>`;
      el.addEventListener('click', () => {
        const state = this.getState();
        if (buyPub(state, l.id)) {
          this.events.onBought();
          this.events.onPubChanged(true);
        } else if (selectPub(state, l.id)) {
          this.events.onPubChanged(false);
        }
        this.update();
      });
      pubs.appendChild(el);
      const r = (s: string) => el.querySelector<HTMLElement>(s)!;
      this.pubRows.push({
        el, thumb: r('.p-thumb'), name: r('.p-name'), perk: r('.p-perk'), bonus: r('.p-bonus'), action: r('.p-action'),
        drawn: false,
      });
    }
    this.update();
  }

  private show(tab: Tab) {
    this.tab = tab;
    for (const b of this.tabButtons) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    for (const p of this.panels) p.hidden = p.dataset.panel !== tab;
    this.update();
  }

  update(): void {
    this.updateBeer();
    this.updateUpgrades();
    this.updatePubs();
    if (this.tab === 'drinkers') this.updateDrinkers();
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
    setProgress(this.beerCard, state.pints, offer.cost);
    this.set(this.beerName, offer.beer.name);
    this.set(this.beerDesc, `${multText(offer.mult)} everything. ${offer.beer.flavour}`);
    this.set(this.beerCost, format(offer.cost, f));
  }

  // ---------- upgrades ----------

  private updateUpgrades() {
    const state = this.getState();
    const f = state.settings.numberFormat;
    const list = availableUpgrades(state);
    const key = list.map((u) => u.id).join(',');
    if (key !== this.upgradeKey) this.rebuildUpgrades(list);

    let ready = 0;
    for (const u of list) {
      const affordable = state.pints.gte(u.cost);
      if (affordable) ready++;
      const row = this.upgradeRows.get(u.id)!;
      row.el.classList.toggle('affordable', affordable);
      setProgress(row.el, state.pints, u.cost);
      this.set(row.cost, format(u.cost, f));
    }
    // The badge counts what you can buy right now, so it's worth a look when it lights up.
    this.set(this.upgradeCount, ready ? String(ready) : '');
  }

  private rebuildUpgrades(list: Upgrade[]) {
    this.upgradeKey = list.map((u) => u.id).join(',');
    this.upgradeRows.clear();
    this.upgradeList.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = 'Nothing on offer yet. Keep drinking.';
      this.upgradeList.appendChild(empty);
      return;
    }
    for (const u of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `upgrade group-${u.group}`;
      b.innerHTML = `
        <span class="u-tile" aria-hidden="true"><span class="u-icon"></span>${u.badge ? '<span class="u-badge"></span>' : ''}</span>
        <span class="u-main">
          <span class="u-name"></span>
          <span class="u-desc"></span>
          <span class="u-meta"><span class="u-cost"></span><span class="u-group"></span></span>
        </span>`;
      const r = (s: string) => b.querySelector<HTMLElement>(s)!;
      if (u.effect.kind === 'drinker') r('.u-icon').appendChild(drinkerPortrait(u.effect.drinker, 40));
      else r('.u-icon').appendChild(icon(u.icon));
      if (u.badge) r('.u-badge').textContent = u.badge;
      r('.u-name').textContent = u.name;
      r('.u-desc').textContent = u.desc;
      r('.u-group').textContent = GROUP_LABEL[u.group];
      b.addEventListener('click', () => {
        if (buyUpgrade(this.getState(), u.id)) this.events.onBought();
        this.update();
      });
      this.upgradeList.appendChild(b);
      this.upgradeRows.set(u.id, { el: b, cost: r('.u-cost') });
    }
  }

  // ---------- pubs ----------

  private updatePubs() {
    const state = this.getState();
    const f = state.settings.numberFormat;
    const status = pubStatuses(state);
    // After a move you have to stay put for a while before moving again.
    const wait = Math.ceil(pubCooldownLeft(state));
    const waitText = `Move in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
    let ready = 0;
    LOCATIONS.forEach((l, i) => {
      const row = this.pubRows[i];
      const st = status[i];
      if (st === 'forSale' && state.pints.gte(l.threshold)) ready++;
      if (this.tab !== 'pubs') return;
      row.el.hidden = st === 'hidden';
      if (st === 'hidden') return;
      const mystery = st === 'mystery';
      const affordable = st === 'forSale' && state.pints.gte(l.threshold);
      const settling = st === 'open' && wait > 0;
      row.el.className = `pub ${st}${affordable || (st === 'open' && !settling) ? ' affordable' : ''}${settling ? ' settling' : ''}`;
      row.el.disabled = mystery || st === 'here' || settling;
      setProgress(row.el, state.pints, st === 'forSale' ? l.threshold : D(0));
      if (!mystery && !row.drawn) {
        row.drawn = true;
        row.thumb.replaceChildren(pubThumb(l.id));
      }
      const bonus = Math.round((pubBonus(l.id) - 1) * 100);
      this.set(row.name, mystery ? '???' : l.name);
      this.set(row.perk, mystery ? `Word gets round at ${format(l.threshold.mul(0.1), f)} lifetime pints.` : l.perk);
      this.set(row.bonus, mystery || !bonus ? '' : `+${bonus}% everything`);
      this.set(row.action, st === 'here' ? "You're here" : st === 'open' ? (settling ? waitText : 'Move here') : mystery ? '' : format(l.threshold, f));
      row.el.setAttribute(
        'aria-label',
        mystery ? 'Unknown pub' : `${l.name}. ${l.perk} ${st === 'here' ? 'You are here.' : st === 'open' ? (settling ? `${waitText}.` : 'Move here.') : `Open for ${format(l.threshold, f)} pints.`}`,
      );
    });
    this.set(this.pubCount, ready ? String(ready) : '');
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
      setProgress(row.el, state.pints, cost);

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
