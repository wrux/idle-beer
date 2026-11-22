/**
 * Last Orders, from the drinker's side of the bar: the landlord calls time, you drink up, and
 * the morning after you spend the Beer Mats in your pockets on being a Local Legend.
 * (In the code the tree is still called the licence, from when it was the landlord's.)
 */
import { icon } from './glyphs';
import { blackOut } from './blackout';
import { format } from '../core/format';
import { tr, trn } from '../i18n';
import { mods } from '../core/licenceState';
import { Decimal } from '../core/num';
import {
  allTimePints, buyLicence, lastOrders, licenceCost, licenceStatus, matMult, matsOnReset, pintsForNextMat,
} from '../core/prestige';
import type { GameState } from '../core/state';
import { BRANCHES, LICENCE, LICENCE_BY_ID, type AutoBuy, type LicenceNode } from '../data/licence';
import { CHALLENGES, CHALLENGE_BY_ID, SPECIAL_BY_ID } from '../data/nights';
import { challengeProgress, pickChallenge, pickSpecial } from '../core/nights';
import { invalidate } from '../core/economy';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SVG = 'http://www.w3.org/2000/svg';

export interface LastOrdersEvents {
  /** After the reset, so the scene and HUD can catch up. */
  onReset(gained: Decimal): void;
  onLicenceBought(): void;
  /** Leaving the after-hours screen for the new night. */
  onBackToPub(): void;
}

const autoLabel = (what: AutoBuy): string => ({
  upgrades: tr('The staff buy upgrades for you'),
  drinkers: tr('The barman gets the rounds in'),
  beer: tr('Your next beer is poured unasked'),
})[what];

/** "3 Beer Mats", with the count already formatted. */
const matsText = (count: Decimal): string =>
  trn(count.lt(1e6) ? count.toNumber() : 1e6, '{n} Beer Mat', '{n} Beer Mats', { n: format(count) });

/** "+12%" / "+1.2 thousand%" for the mat bonus. */
export function bonusText(mult: Decimal): string {
  return `+${format(mult.sub(1).mul(100))}%`;
}

/**
 * How a Licence node shows in the tree. You only see what you own, what you can buy next, and
 * a hint of the one after that; the rest of each thread stays out of sight until you get there.
 */
type Shown = 'owned' | 'available' | 'hint' | 'hidden';

/**
 * A count short enough for the hub in the middle of the tree: "842", "46.6M", "1.2e45".
 * The full figure is in the card beside the tree.
 */
function hubCount(n: Decimal): string {
  if (n.lt(10_000)) return format(n.floor());
  const e = Math.floor(n.log10());
  const units = ['K', 'M', 'B', 'T'];
  const step = Math.floor(e / 3);
  if (step > units.length) return `${n.div(Decimal.pow(10, e)).toNumber().toFixed(1)}e${e}`;
  const v = n.div(Decimal.pow(10, step * 3)).toNumber();
  return `${v >= 100 ? Math.floor(v) : (Math.floor(v * 10) / 10).toFixed(1)}${units[step - 1]}`;
}

/**
 * The tree is drawn on a grid with the hub in the middle, big enough for its furthest node
 * (the long lines run a long way out) plus a margin for the note that follows the pointer.
 */
const MARGIN = 4;
const GRID = {
  w: 2 * (Math.max(...LICENCE.map((n) => Math.abs(n.at.x))) + MARGIN),
  h: 2 * (Math.max(...LICENCE.map((n) => Math.abs(n.at.y))) + MARGIN),
};
/** Pixels to a grid square, before any zoom. */
const SQUARE = 52;
const px = (x: number) => ((x + GRID.w / 2) / GRID.w) * 100;
const py = (y: number) => ((y + GRID.h / 2) / GRID.h) * 100;

/** A node's name as shown: the steps of a long line are numbered. */
const nodeName = (node: LicenceNode): string =>
  node.rank ? `${node.name} ${format(new Decimal(node.rank), true)}` : node.name;

export class LastOrdersPanel {
  private dialog = $<HTMLDialogElement>('last-orders-dialog');
  private confirm = $<HTMLDialogElement>('prestige-dialog');
  private openButton = $<HTMLButtonElement>('open-last-orders');
  private badge = $('last-orders-badge');
  private nodes = new Map<string, HTMLButtonElement>();
  private links = new Map<string, SVGLineElement>();
  private shown = new Map<string, Shown>();
  /** The node whose note is up: on a touch screen, the first tap shows it and the second buys. */
  private armed: string | null = null;
  private autoBoxes = new Map<AutoBuy, HTMLLabelElement>();

  constructor(private getState: () => GameState, private events: LastOrdersEvents) {
    this.openButton.addEventListener('click', () => {
      this.dialog.showModal();
      this.centre();
      this.update();
    });
    for (const d of [this.dialog, this.confirm]) {
      d.addEventListener('click', (e) => {
        if (e.target === d) d.close();
      });
    }
    this.dialog.querySelector('.dialog-close')!.addEventListener('click', () => this.dialog.close());

    // Ringing the bell asks first: it is the one thing in the game you cannot take back.
    $('ring-bell').addEventListener('click', () => {
      const s = this.getState();
      const gain = matsOnReset(s);
      if (gain.lte(0)) return;
      const rate = mods(s).matRate;
      $('prestige-gain').textContent = matsText(gain);
      $('prestige-bonus').textContent =
        tr('Unspent, that takes your bonus to everything from {from} to {to}.', { from: bonusText(matMult(s)), to: bonusText(s.beerMats.add(gain).mul(rate).add(1)) });
      this.confirm.showModal();
    });
    $('prestige-cancel').addEventListener('click', () => this.confirm.close());
    $('prestige-confirm').addEventListener('click', () => {
      this.confirm.close();
      this.dialog.close();
      void blackOut(() => {
        const s = this.getState();
        if (matsOnReset(s).lte(0)) return;
        const gained = lastOrders(s);
        this.events.onReset(gained);
        this.armed = null;
        // Out the other side: nothing but the Licence, until you choose to go back to the pub.
        this.openAfterHours(tr('You wake up with {mats} in your pockets. Spend what you like, then head back to the pub.', { mats: matsText(gained) }));
      });
    });
    // Back to the pub, by the button or by Escape. Done at once, not left to the dialog's own
    // (later) close event, so it is saved even if the page is closed straight afterwards.
    const backToPub = () => {
      if (!this.dialog.classList.contains('after-hours')) return;
      this.dialog.classList.remove('after-hours');
      $('last-orders-title').textContent = tr('Last Orders');
      this.getState().afterHours = false;
      this.events.onBackToPub();
    };
    $('back-to-pub').addEventListener('click', () => {
      backToPub();
      this.dialog.close();
    });
    this.dialog.addEventListener('cancel', backToPub);
    this.dialog.addEventListener('close', backToPub);

    this.buildWeb();
    this.setupPanZoom();

    const toggles = $('auto-toggles');
    for (const what of ['upgrades', 'drinkers', 'beer'] as AutoBuy[]) {
      const label = document.createElement('label');
      label.className = 'setting';
      label.innerHTML = `<span></span><input type="checkbox" />`;
      label.querySelector('span')!.textContent = autoLabel(what);
      const box = label.querySelector('input')!;
      box.addEventListener('change', () => {
        this.getState().settings.auto[what] = box.checked;
      });
      toggles.appendChild(label);
      this.autoBoxes.set(what, label);
    }
  }

  /** The screen between one night and the next: the Licence, and a way back to the pub. */
  private openAfterHours(note: string) {
    $('after-hours-note').textContent = note;
    $('last-orders-title').textContent = tr('The morning after');
    this.dialog.classList.add('after-hours');
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.scrollTop = 0;
    this.centre();
    this.update();
  }

  /** On load: if the bell had rung and you never went back to the pub, you are still after hours. */
  resume(): void {
    const s = this.getState();
    if (!s.afterHours) return;
    this.openAfterHours(tr('You have {mats} in your pockets. Spend what you like, then head back to the pub.', { mats: matsText(s.beerMats) }));
  }

  // ----- looking round the tree: drag to pan, wheel or pinch to zoom -----

  private view = { x: 0, y: 0, k: 1 };
  /** The tree's own size, before any zoom. */
  private static readonly TREE = { w: GRID.w * SQUARE, h: GRID.h * SQUARE };
  private static readonly ZOOM = { min: 0.06, max: 2.4 };

  private applyView() {
    const port = $('licence-scroll'), T = LastOrdersPanel.TREE, v = this.view;
    // Never let the tree be dragged right out of sight.
    const slackX = port.clientWidth * 0.6, slackY = port.clientHeight * 0.6;
    v.x = Math.min(slackX, Math.max(port.clientWidth - T.w * v.k - slackX, v.x));
    v.y = Math.min(slackY, Math.max(port.clientHeight - T.h * v.k - slackY, v.y));
    $('licence-web').style.transform = `translate(${v.x.toFixed(1)}px, ${v.y.toFixed(1)}px) scale(${v.k.toFixed(4)})`;
  }

  /** Zoom by `factor`, keeping the point at (cx, cy) in the viewport where it is. */
  private zoomAt(factor: number, cx: number, cy: number) {
    const v = this.view, Z = LastOrdersPanel.ZOOM;
    const k = Math.min(Z.max, Math.max(Z.min, v.k * factor));
    v.x = cx - ((cx - v.x) * k) / v.k;
    v.y = cy - ((cy - v.y) * k) / v.k;
    v.k = k;
    this.applyView();
  }

  /**
   * Show as much of the tree as you have found (what you own, what you can buy and the "?" beyond),
   * as big as fits, clear of whatever is floating over the edges.
   */
  private centre() {
    const port = $('licence-scroll');
    if (!port.clientWidth) return;
    const s = this.getState();
    // The middle of the tree is always in the picture, and never less than the first ring round it.
    let x0 = -9.5, x1 = 9.5, y0 = -5.3, y1 = 5.3;
    for (const node of LICENCE) {
      if (this.status(s, node.id) === 'hidden') continue;
      x0 = Math.min(x0, node.at.x - 1.5);
      x1 = Math.max(x1, node.at.x + 1.5);
      y0 = Math.min(y0, node.at.y - 1.5);
      y1 = Math.max(y1, node.at.y + 1.5);
    }
    const box = { x: (x0 + GRID.w / 2) * SQUARE, y: (y0 + GRID.h / 2) * SQUARE, w: (x1 - x0) * SQUARE, h: (y1 - y0) * SQUARE };
    // After hours the title sits over the top and the way out over the bottom.
    const pad = this.afterHours ? { top: 76, bottom: 96, side: 36 } : { top: 40, bottom: 22, side: 14 };
    const w = port.clientWidth - pad.side * 2, h = port.clientHeight - pad.top - pad.bottom;
    const k = Math.max(LastOrdersPanel.ZOOM.min, Math.min(1.25, w / box.w, h / box.h));
    this.view = { k, x: pad.side + (w - box.w * k) / 2 - box.x * k, y: pad.top + (h - box.h * k) / 2 - box.y * k };
    this.applyView();
  }

  private setupPanZoom() {
    const port = $('licence-scroll');
    const pointers = new Map<number, { x: number; y: number }>();
    let dragged = false, pinch = 0;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = port.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    port.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), p.x, p.y);
    }, { passive: false });
    port.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) dragged = false;
      pinch = 0;
    });
    port.addEventListener('pointermove', (e) => {
      const was = pointers.get(e.pointerId);
      if (!was) return;
      const now = local(e);
      pointers.set(e.pointerId, now);
      if (pointers.size === 1) {
        if (!dragged && Math.hypot(now.x - was.x, now.y - was.y) < 0.5) return;
        // A little movement is still a click; more than that is a drag.
        this.dragTravel += Math.hypot(now.x - was.x, now.y - was.y);
        if (this.dragTravel < 6) return;
        if (!dragged) {
          dragged = true;
          try {
            port.setPointerCapture(e.pointerId);
          } catch {
            // The pointer has already gone (it can, mid-gesture); the drag still works without capture.
          }
          port.classList.add('panning');
          this.tip.hidden = true;
        }
        this.view.x += now.x - was.x;
        this.view.y += now.y - was.y;
        this.applyView();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomAt(dist / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = dist;
        dragged = true;
      }
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      if (!pointers.size) {
        this.dragTravel = 0;
        port.classList.remove('panning');
      }
    };
    port.addEventListener('pointerup', up);
    port.addEventListener('pointercancel', up);
    // Letting go after a drag is not a click on whatever was underneath.
    port.addEventListener('click', (e) => {
      if (!dragged) return;
      dragged = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);

    const centreOf = () => ({ x: port.clientWidth / 2, y: port.clientHeight / 2 });
    $('licence-zoom-in').addEventListener('click', () => this.zoomAt(1.3, centreOf().x, centreOf().y));
    $('licence-zoom-out').addEventListener('click', () => this.zoomAt(1 / 1.3, centreOf().x, centreOf().y));
    $('licence-zoom-fit').addEventListener('click', () => this.centre());
    new ResizeObserver(() => {
      if (this.dialog.open) this.centre();
    }).observe(port);
  }

  private dragTravel = 0;

  /** The Licence as a tree: threads out from the middle that fork as they go. */
  private buildWeb() {
    const web = $('licence-web');
    web.style.width = `${LastOrdersPanel.TREE.w}px`;
    web.style.height = `${LastOrdersPanel.TREE.h}px`;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'lw-lines');
    svg.setAttribute('aria-hidden', 'true');
    // One line from each node back to the one it hangs off (or to the middle).
    for (const node of LICENCE) {
      const from = node.requires ? LICENCE_BY_ID.get(node.requires)!.at : { x: 0, y: 0 };
      const l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', `${px(from.x).toFixed(2)}%`);
      l.setAttribute('y1', `${py(from.y).toFixed(2)}%`);
      l.setAttribute('x2', `${px(node.at.x).toFixed(2)}%`);
      l.setAttribute('y2', `${py(node.at.y).toFixed(2)}%`);
      l.setAttribute('class', 'lw-link');
      l.dataset.branch = node.branch;
      svg.appendChild(l);
      this.links.set(node.id, l);
    }
    web.appendChild(svg);

    const hub = document.createElement('div');
    hub.className = 'lw-hub';
    hub.innerHTML = '<i class="mat-ico" aria-hidden="true"></i><b id="licence-mats">0</b>';
    web.appendChild(hub);

    for (const node of LICENCE) {
      const branch = BRANCHES.find((b) => b.id === node.branch)!;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = node.unique ? 'lw-node unique' : 'lw-node';
      el.style.left = `${px(node.at.x)}%`;
      el.style.top = `${py(node.at.y)}%`;
      el.dataset.branch = branch.id;
      el.append(icon(branch.icon));
      const mark = document.createElement('span');
      mark.className = 'lw-mark';
      el.appendChild(mark);
      el.addEventListener('click', (e) => this.pick(node.id, (e as PointerEvent).pointerType !== 'touch'));
      for (const on of ['pointerenter', 'focus']) el.addEventListener(on, () => this.showTip(node.id));
      for (const off of ['pointerleave', 'blur']) el.addEventListener(off, () => (this.tip.hidden = true));
      web.appendChild(el);
      this.nodes.set(node.id, el);
    }

    this.tip.className = 'lw-tip';
    this.tip.hidden = true;
    this.tip.innerHTML = '<b></b><span></span><em><i class="mat-ico" aria-hidden="true"></i><u></u></em>';
    web.appendChild(this.tip);
  }

  private tip = document.createElement('div');

  /** Mats are only spent after hours, between one night and the next. Until then the tree is a preview. */
  private get shopOpen() {
    return this.afterHours || mods(this.getState()).liveMats;
  }

  /** On the morning-after screen (as opposed to looking at Last Orders during the night). */
  private get afterHours() {
    return this.dialog.classList.contains('after-hours');
  }

  /** A node was clicked or tapped: buy it if the shop is open (a tap first shows what it is). */
  private pick(id: string, pointer: boolean) {
    const ready = pointer || this.armed === id;
    this.armed = id;
    if (this.shopOpen && ready && buyLicence(this.getState(), id)) {
      const el = this.nodes.get(id)!;
      el.classList.remove('just-bought');
      void el.offsetWidth;
      el.classList.add('just-bought');
      this.events.onLicenceBought();
      this.update();
    }
    this.showTip(id);
  }

  /** A note beside the node under the pointer: what it is, what it does, what it costs. */
  private showTip(id: string) {
    const s = this.getState();
    const node = LICENCE_BY_ID.get(id)!;
    const state = this.status(s, id);
    const hint = state === 'hint';
    this.tip.querySelector('b')!.textContent = hint ? '???' : nodeName(node);
    this.tip.querySelector('span')!.textContent = hint ? tr('Buy {name} to find out.', { name: nodeName(LICENCE_BY_ID.get(node.requires!)!) }) : node.desc;
    const price = licenceCost(s, node);
    const cost = trn(price.toNumber(), '{n} mat', '{n} mats', { n: format(price, true) });
    const foot = this.tip.querySelector('em')!;
    foot.hidden = hint;
    // The mat icon goes with a price, not with "Owned".
    foot.querySelector<HTMLElement>('.mat-ico')!.hidden = state === 'owned';
    foot.querySelector('u')!.textContent =
      state === 'owned' ? tr('Owned')
        : !this.shopOpen ? tr('{cost} · buy the morning after', { cost })
          : s.beerMats.gte(price) ? tr('{cost} · click to buy', { cost }) : tr('{cost} · not enough mats', { cost });
    this.tip.dataset.branch = node.branch;
    // Above the node, unless that would go off the top of what you can see.
    const y = py(node.at.y);
    this.tip.style.left = `${px(node.at.x)}%`;
    this.tip.style.top = `${y}%`;
    const onScreen = this.view.y + (y / 100) * LastOrdersPanel.TREE.h * this.view.k;
    this.tip.classList.toggle('below', onScreen < 150 * Math.max(1, this.view.k));
    // The note stays a readable size however far out you have zoomed.
    this.tip.style.setProperty('--tip-scale', String(Math.max(1, 1 / this.view.k)));
    this.tip.hidden = false;
  }

  private status(s: GameState, id: string): Shown {
    const st = licenceStatus(s, id);
    if (st !== 'locked') return st;
    const before = LICENCE_BY_ID.get(id)?.requires;
    return before && licenceStatus(s, before) === 'available' ? 'hint' : 'hidden';
  }

  // ----- tonight's special and challenge nights -----

  private nightKey = '';

  /** One row of either list: a name, what it does, and (for a challenge) its goal, prize and how far along. */
  private nightItem(lines: (string | null)[], on: boolean, enabled: boolean, done: boolean, pick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'night-item';
    b.classList.toggle('on', on);
    b.classList.toggle('done', done);
    b.disabled = !enabled;
    b.setAttribute('aria-pressed', String(on));
    lines.forEach((text, i) => {
      if (!text) return;
      const el = document.createElement(i === 0 ? 'b' : 'span');
      el.textContent = text;
      b.appendChild(el);
    });
    b.addEventListener('click', () => {
      pick();
      invalidate();
      this.events.onLicenceBought();
      this.update();
    });
    return b;
  }

  /**
   * The morning after you pick a special from three, and may take on a challenge. The card is
   * only there then: during the night the Last Orders panel is about the bell, and what you
   * chose shows as tags in the pub.
   */
  private updateNight(s: GameState) {
    const card = $('lo-night');
    card.hidden = !this.afterHours;
    if (card.hidden) return;
    const open = this.afterHours;
    const progress = s.challenge ? format(challengeProgress(s).floor()) : '';
    const key = [open, s.special, s.specialOffer.join(), s.challenge, [...s.challengesDone].join(), progress].join('|');
    if (key === this.nightKey) return;
    this.nightKey = key;

    const offered = open ? s.specialOffer : s.special ? [s.special] : [];
    $('special-note').textContent = open ? tr('Pick one for the night ahead.') : s.special ? '' : tr('Nothing special tonight.');
    $('special-list').replaceChildren(...offered.flatMap((id) => {
      const sp = SPECIAL_BY_ID.get(id);
      return sp ? [this.nightItem([sp.name, sp.desc], s.special === id, open, false, () => pickSpecial(s, id))] : [];
    }));

    const now = s.challenge ? CHALLENGE_BY_ID.get(s.challenge) : undefined;
    $('challenge-now').textContent = now ? now.name
      : tr('{n} of {total}', { n: format(new Decimal(s.challengesDone.size), true), total: format(new Decimal(CHALLENGES.length), true) });
    $('challenge-list').replaceChildren(...CHALLENGES.map((c) => {
      const done = s.challengesDone.has(c.id), on = s.challenge === c.id;
      const goal = on && !open
        ? tr('{have} of {goal} pints', { have: progress, goal: format(c.goal, true) })
        : tr('Drink {pints} pints in the night.', { pints: format(c.goal, true) });
      return this.nightItem([c.name, c.rule, done ? null : goal, c.reward, done ? tr('Beaten') : null], on, open && !done, done,
        () => pickChallenge(s, on ? null : c.id));
    }));
  }

  /** Cheap: the topbar button. Called often. */
  updateButton(): void {
    const s = this.getState();
    const gain = matsOnReset(s);
    const show = gain.gt(0) || s.prestiges > 0 || s.beerMats.gt(0);
    this.openButton.hidden = !show;
    this.badge.hidden = gain.lte(0);
    this.badge.textContent = gain.gt(0) ? format(gain) : '';
  }

  update(): void {
    this.updateButton();
    if (!this.dialog.open) return;
    const s = this.getState();
    const gain = matsOnReset(s);

    $('mats-on-reset').textContent = format(gain);
    $('next-mat').textContent = tr('Next mat at {pints} all-time pints', { pints: format(pintsForNextMat(s).ceil()) });
    $<HTMLButtonElement>('ring-bell').disabled = gain.lte(0);

    const next = pintsForNextMat(s);
    $('next-mat-bar').style.width = `${Math.min(100, allTimePints(s).div(next).toNumber() * 100).toFixed(1)}%`;

    // Collectors' Fair makes this a fraction, so it goes through format() like any other number.
    const rate = format(new Decimal(mods(s).matRate * 100));
    $('licence-summary').textContent = mods(s).matsCountSpent
      ? tr('Every mat you have ever earned gives +{rate}%, spent or not.', { rate })
      : tr('Each unspent mat gives +{rate}%. Spending mats on your legend gives up their bonus.', { rate });
    $('licence-mats').textContent = hubCount(s.beerMats);
    $('lo-mats').textContent = format(s.beerMats, true);
    $('lo-bonus').textContent = bonusText(matMult(s));

    for (const node of LICENCE) {
      const el = this.nodes.get(node.id)!;
      const now = this.status(s, node.id);
      const was = this.shown.get(node.id);
      if (was !== now) {
        this.shown.set(node.id, now);
        el.hidden = now === 'hidden';
        el.classList.toggle('owned', now === 'owned');
        el.classList.toggle('open', now === 'available');
        el.classList.toggle('mystery', now === 'hint');
        // Something you can now buy fades up; the "?" beyond it just turns up quietly.
        el.classList.toggle('appear', was === 'hint' && now === 'available');
        el.querySelector('.lw-mark')!.textContent = now === 'owned' ? '✓' : now === 'hint' ? '?' : '';
        this.links.get(node.id)!.classList.toggle('on', now === 'owned');
        this.links.get(node.id)!.classList.toggle('next', now === 'available');
        this.links.get(node.id)!.classList.toggle('faint', now === 'hint');
      }
      el.classList.toggle('affordable', this.shopOpen && now === 'available' && s.beerMats.gte(licenceCost(s, node)));
      el.setAttribute('aria-label', now === 'hint' ? tr('Not yet revealed') : `${nodeName(node)}: ${node.desc}`);
    }
    $('licence-count').textContent = tr('{n} of {total}', { n: format(new Decimal(s.licence.size), true), total: format(new Decimal(LICENCE.length), true) });

    this.updateNight(s);

    const auto = mods(s).auto;
    for (const [what, label] of this.autoBoxes) {
      label.hidden = !auto.has(what);
      label.querySelector('input')!.checked = s.settings.auto[what];
    }
  }
}
