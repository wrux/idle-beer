/**
 * The shop: the next beer on top, then tabs for drinkers, upgrades and pubs. DOM is built once
 * and patched (upgrade rows are only rebuilt when the set of available upgrades changes).
 */
import {
  availableUpgrades, buyDrinker, buyNextRound, buyPub, buyUpgrade, currentBeer, drinkerDiscount, drinkerPpsEach,
  nextRound, priceOf, pubBonus, pubCooldownLeft, pubStatuses, quantityFor, selectPub, storeVisibility,
} from '../core/economy';
import { format as formatNumber, type NumberFormat } from '../core/format';
import { D, type Decimal } from '../core/num';
import { owned, type BuyMode, type GameState } from '../core/state';
import { BEERS, beerAt } from '../data/beers';
import { tr } from '../i18n';
import { DRINKERS } from '../data/drinkers';
import { LOCATIONS } from '../data/locations';
import type { Upgrade } from '../data/upgrades';
import { beerIcon, drinkerPortrait, pubThumb } from './art/icons';
import { icon } from './glyphs';

/** Prices and targets sit still, so they're shown without trailing zeros ("100 million", not "100.000 million"). */
const format = (v: Decimal, f: NumberFormat) => formatNumber(v, f, true);

const MODES: BuyMode[] = [1, 10, 100, 'max'];
const modeLabel = (m: BuyMode) => (m === 'max' ? tr('Max') : `×${m}`);
type Tab = 'drinkers' | 'upgrades' | 'pubs';

/** The label on an upgrade saying what sort it is. */
const groupLabel = (group: Upgrade['group']): string => ({
  drinker: tr('Drinkers'), drinking: tr('Drinking'), synergy: tr('Teamwork'), pub: tr('The pub'), reputation: tr('Reputation'),
})[group];

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

/** Name something for screen readers (and, for plain buttons, as a native tooltip). */
function describe(el: HTMLElement, text: string, tooltip = false) {
  if (el.getAttribute('aria-label') === text) return;
  el.setAttribute('aria-label', text);
  if (tooltip) el.title = text;
}

/** What the compact shop's hover card says about a row. */
interface Tip {
  name: string;
  desc: string;
  /** A price in pints, if it has one. */
  cost?: string;
  affordable?: boolean;
  /** A line of small print: what it earns, how many you own, where you stand. */
  note?: string;
}

const COMPACT_KEY = 'idleBeer.compactShop';

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

  // Hover card for the compact shop, where rows are icons only.
  private tip = document.createElement('div');
  private tips = new Map<HTMLElement, () => Tip>();
  private tipRow: HTMLElement | null = null;

  // Pubs
  private pubCount: HTMLElement;
  private pubRows: {
    el: HTMLButtonElement; thumb: HTMLElement; name: HTMLElement; perk: HTMLElement; bonus: HTMLElement; action: HTMLElement;
    drawn: boolean;
  }[] = [];

  constructor(private root: HTMLElement, private getState: () => GameState, private events: StoreEvents) {
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

    // ----- size: full, or a narrow strip of icons that leaves more room for the pub -----
    const sizeButton = q<HTMLButtonElement>('.shop-size');
    // Only on a wide window: on a phone the shop sits under the pub and should stay full.
    const wide = matchMedia('(min-width: 861px)');
    let wantCompact = false;
    try {
      wantCompact = localStorage.getItem(COMPACT_KEY) === '1';
    } catch {
      /* private browsing: it just won't be remembered */
    }
    const applySize = () => {
      const on = wantCompact && wide.matches;
      root.classList.toggle('compact', on);
      root.parentElement?.classList.toggle('compact-shop', on);
      sizeButton.setAttribute('aria-pressed', String(on));
      describe(sizeButton, on ? tr('Show the full shop') : tr('Shrink the shop to icons'), true);
      if (!on) this.hideTip();
    };
    applySize();
    wide.addEventListener('change', applySize);
    sizeButton.addEventListener('click', () => {
      wantCompact = !wantCompact;
      try {
        localStorage.setItem(COMPACT_KEY, wantCompact ? '1' : '0');
      } catch {
        /* ignore */
      }
      applySize();
    });

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
    this.tip.className = 'shop-tip';
    this.tip.hidden = true;
    document.body.appendChild(this.tip);
    const text = (el: HTMLElement) => el.textContent ?? '';
    this.addTip(this.beerCard, () => ({
      name: text(this.beerName), desc: text(this.beerDesc), cost: text(this.beerCost) || undefined,
      affordable: this.beerCard.classList.contains('affordable'),
    }));
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
      this.addTip(el, () => ({
        name: text(r('.d-name')), desc: text(r('.d-flavour')), cost: el.classList.contains('mystery') ? undefined : text(r('.d-cost')),
        affordable: el.classList.contains('affordable'),
        note: [text(r('.d-pps')), text(r('.d-owned')) && tr('{n} in the pub', { n: text(r('.d-owned')) })].filter(Boolean).join(' · '),
      }));
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
      this.addTip(el, () => {
        const forSale = el.classList.contains('forSale');
        return {
          name: text(r('.p-name')), desc: text(r('.p-perk')), cost: forSale ? text(r('.p-action')) : undefined,
          affordable: el.classList.contains('affordable'),
          note: [text(r('.p-bonus')), forSale ? '' : text(r('.p-action'))].filter(Boolean).join(' · '),
        };
      });
    }
    this.update();
  }

  /** Switch tab (also bound to the 1, 2 and 3 keys). */
  showTab(tab: Tab) {
    this.show(tab);
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
    this.refreshTip();
  }

  // ---------- hover card (compact shop) ----------

  private addTip(row: HTMLElement, get: () => Tip) {
    this.tips.set(row, get);
    row.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !this.root.classList.contains('compact')) return;
      this.tipRow = row;
      this.refreshTip();
    });
    row.addEventListener('pointerleave', () => {
      if (this.tipRow === row) this.hideTip();
    });
  }

  private hideTip() {
    this.tipRow = null;
    this.tip.hidden = true;
  }

  /** Fill and place the card beside the row it describes. Called on every refresh, so prices stay live. */
  private refreshTip() {
    const row = this.tipRow;
    if (!row) return;
    const get = this.tips.get(row);
    if (!get || !row.isConnected || row.hidden || !this.root.classList.contains('compact')) {
      this.hideTip();
      return;
    }
    const t = get();
    const el = (cls: string, content: string) => {
      const d = document.createElement('div');
      d.className = cls;
      d.textContent = content;
      return d;
    };
    const parts = [el('st-name', t.name), el('st-desc', t.desc)];
    if (t.cost) parts.push(el(`st-cost${t.affordable ? '' : ' short'}`, t.cost));
    if (t.note) parts.push(el('st-note', t.note));
    const key = parts.map((p) => `${p.className}:${p.textContent}`).join('|');
    if (this.tip.dataset.key !== key) {
      this.tip.dataset.key = key;
      this.tip.replaceChildren(...parts);
    }
    this.tip.hidden = false;
    // To the left of the strip, level with the row, kept on screen.
    const r = row.getBoundingClientRect();
    const h = this.tip.offsetHeight;
    const top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top + r.height / 2 - h / 2));
    this.tip.style.top = `${Math.round(top)}px`;
    this.tip.style.right = `${Math.round(window.innerWidth - this.root.getBoundingClientRect().left + 10)}px`;
  }

  // ---------- beer ----------

  private updateBeer() {
    const state = this.getState();
    const f = state.settings.numberFormat;
    const now = currentBeer(state);
    this.set(this.beerNow, tr('Drinking: {beer}', { beer: now.name }));

    const offer = nextRound(state);
    const shown = offer ? offer.beer : beerAt(state.beer + 1);
    const iconKey = `${shown.id}:${offer ? 1 : 0}`;
    if (iconKey !== this.beerIconKey) {
      this.beerIconKey = iconKey;
      this.beerIconEl.replaceChildren(beerIcon(shown.look, 52));
    }
    if (!offer && state.beer >= BEERS.length - 1) {
      // The end of the list: nothing left to order.
      this.beerCard.disabled = true;
      this.beerCard.classList.remove('affordable', 'mystery');
      this.set(this.beerName, tr('Nothing left to order'));
      describe(this.beerCard, tr('You are drinking The Final Pint. There is nothing after it.'));
      this.set(this.beerDesc, tr("You've drunk your way through the lot. This is the one."));
      this.set(this.beerCost, '');
      return;
    }
    if (!offer) {
      // Tease the next one with when it shows up.
      const next = beerAt(state.beer + 1);
      this.beerCard.disabled = true;
      this.beerCard.classList.remove('affordable');
      this.beerCard.classList.add('mystery');
      this.set(this.beerName, '???');
      describe(this.beerCard, tr('The next beer is revealed at {pints} lifetime pints.', { pints: format(next.cost.mul(0.5), f) }));
      this.set(this.beerDesc, tr('Revealed at {pints} lifetime pints.', { pints: format(next.cost.mul(0.5), f) }));
      this.set(this.beerCost, '');
      return;
    }
    const affordable = state.pints.gte(offer.cost);
    this.beerCard.disabled = false;
    this.beerCard.classList.remove('mystery');
    this.beerCard.classList.toggle('affordable', affordable);
    setProgress(this.beerCard, state.pints, offer.cost);
    this.set(this.beerName, offer.beer.name);
    describe(this.beerCard, tr('{beer}: {mult} everything. {cost} pints.', { beer: offer.beer.name, mult: multText(offer.mult), cost: format(offer.cost, f) }));
    this.set(this.beerDesc, `${tr('{mult} everything.', { mult: multText(offer.mult) })} ${offer.beer.flavour}`);
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
      describe(row.el, `${u.name}. ${u.desc} ${format(u.cost, f)} pints.`);
    }
    // The badge counts what you can buy right now, so it's worth a look when it lights up.
    this.set(this.upgradeCount, ready ? String(ready) : '');
  }

  private rebuildUpgrades(list: Upgrade[]) {
    this.upgradeKey = list.map((u) => u.id).join(',');
    for (const row of this.upgradeRows.values()) this.tips.delete(row.el);
    if (this.tipRow && !this.tipRow.classList.contains('drinker') && !this.tipRow.classList.contains('pub') && this.tipRow !== this.beerCard) this.hideTip();
    this.upgradeRows.clear();
    this.upgradeList.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = tr('Nothing on offer yet. Keep drinking.');
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
      r('.u-group').textContent = groupLabel(u.group);
      b.addEventListener('click', () => {
        if (buyUpgrade(this.getState(), u.id)) this.events.onBought();
        this.update();
      });
      this.upgradeList.appendChild(b);
      this.upgradeRows.set(u.id, { el: b, cost: r('.u-cost') });
      this.addTip(b, () => ({
        name: u.name, desc: u.desc, cost: r('.u-cost').textContent ?? '', affordable: b.classList.contains('affordable'),
        note: groupLabel(u.group),
      }));
    }
  }

  // ---------- pubs ----------

  private updatePubs() {
    const state = this.getState();
    const f = state.settings.numberFormat;
    const status = pubStatuses(state);
    // After a move you have to stay put for a while before moving again.
    const wait = Math.ceil(pubCooldownLeft(state));
    const waitText = tr('Move in {time}', { time: `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}` });
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
      this.set(row.perk, mystery ? tr('Word gets round at {pints} lifetime pints.', { pints: format(l.threshold.mul(0.1), f) }) : l.perk);
      this.set(row.bonus, mystery || !bonus ? '' : tr('+{percent}% everything', { percent: bonus }));
      this.set(row.action, st === 'here' ? tr("You're here") : st === 'open' ? (settling ? waitText : tr('Move here')) : mystery ? '' : format(l.threshold, f));
      describe(
        row.el,
        mystery ? tr('Unknown pub') : `${l.name}. ${l.perk} ${st === 'here' ? tr("You're here") : st === 'open' ? (settling ? waitText : tr('Move here')) : tr('Stand the house a round for {pints} pints.', { pints: format(l.threshold, f) })}`,
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
      this.set(row.flavour, mystery ? tr('Keep drinking to find out who turns up.') : d.flavour);
      this.set(row.owned, have > 0 ? format(D(have), f) : '');
      this.set(row.cost, qty > 1 ? tr('{cost} for {n}', { cost: format(cost, f), n: format(D(qty), f) }) : format(cost, f));
      this.set(row.pps, mystery ? '' : tr('+{pints}/s each', { pints: format(drinkerPpsEach(state, d), f) }));
      describe(
        row.el,
        mystery ? tr('Unknown drinker') : tr('{name}, owned {have}. Buy {n} for {cost} pints.', { name: d.name, have, n: qty, cost: format(cost, f) }),
      );
    });
  }
}
