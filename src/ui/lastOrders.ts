/** The Last Orders dialog: ring the bell for Beer Mats, and spend them on the Landlord's Licence. */
import { icon } from './glyphs';
import { format } from '../core/format';
import { mods } from '../core/licenceState';
import { Decimal } from '../core/num';
import {
  allTimePints, buyLicence, lastOrders, licenceStatus, matMult, matsOnReset, pintsForNextMat,
} from '../core/prestige';
import type { GameState } from '../core/state';
import { BRANCHES, LICENCE, type AutoBuy } from '../data/licence';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface LastOrdersEvents {
  /** After the reset, so the scene and HUD can catch up. */
  onReset(gained: Decimal): void;
  onLicenceBought(): void;
}

const AUTO_LABELS: Record<AutoBuy, string> = {
  upgrades: 'Bar Back buys upgrades',
  drinkers: 'Head Barman buys drinkers',
  beer: 'Area Manager buys the next beer',
};

/** "+12%" / "+1.2 thousand%" for the mat bonus. */
export function bonusText(mult: Decimal, f: Parameters<typeof format>[1]): string {
  return `+${format(mult.sub(1).mul(100), f)}%`;
}

export class LastOrdersPanel {
  private dialog = $<HTMLDialogElement>('last-orders-dialog');
  private openButton = $<HTMLButtonElement>('open-last-orders');
  private badge = $('last-orders-badge');
  private nodes = new Map<string, HTMLButtonElement>();
  private autoBoxes = new Map<AutoBuy, HTMLLabelElement>();

  constructor(private getState: () => GameState, private events: LastOrdersEvents) {
    this.openButton.addEventListener('click', () => {
      this.dialog.showModal();
      this.update();
    });
    this.dialog.querySelector('.dialog-close')!.addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.dialog.close();
    });

    $('ring-bell').addEventListener('click', () => {
      const s = this.getState();
      const gain = matsOnReset(s);
      if (gain.lte(0)) return;
      const f = s.settings.numberFormat;
      if (!confirm(`Call Last Orders? You'll bank ${format(gain, f)} Beer Mats and start a new night at The Red Lion.`)) return;
      const gained = lastOrders(s);
      this.events.onReset(gained);
      this.update();
    });

    // Licence tree: one column per branch.
    const grid = $('licence-grid');
    for (const b of BRANCHES) {
      const col = document.createElement('div');
      col.className = 'licence-branch';
      const head = document.createElement('div');
      head.className = 'licence-branch-name';
      const label = document.createElement('span');
      label.textContent = b.name;
      head.append(icon(b.icon), label);
      col.appendChild(head);
      for (const node of LICENCE.filter((n) => n.branch === b.id)) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'licence-node';
        el.innerHTML = '<span class="ln-name"></span><span class="ln-desc"></span><span class="ln-cost"></span>';
        el.querySelector('.ln-name')!.textContent = node.name;
        el.querySelector('.ln-desc')!.textContent = node.desc;
        el.addEventListener('click', () => {
          if (buyLicence(this.getState(), node.id)) this.events.onLicenceBought();
          this.update();
        });
        col.appendChild(el);
        this.nodes.set(node.id, el);
      }
      grid.appendChild(col);
    }

    const toggles = $('auto-toggles');
    for (const what of ['upgrades', 'drinkers', 'beer'] as AutoBuy[]) {
      const label = document.createElement('label');
      label.className = 'setting';
      label.innerHTML = `<span></span><input type="checkbox" />`;
      label.querySelector('span')!.textContent = AUTO_LABELS[what];
      const box = label.querySelector('input')!;
      box.addEventListener('change', () => {
        this.getState().settings.auto[what] = box.checked;
      });
      toggles.appendChild(label);
      this.autoBoxes.set(what, label);
    }
  }

  /** Cheap: the topbar button. Called often. */
  updateButton(): void {
    const s = this.getState();
    const gain = matsOnReset(s);
    const show = gain.gt(0) || s.prestiges > 0 || s.beerMats.gt(0);
    this.openButton.hidden = !show;
    this.badge.hidden = gain.lte(0);
    this.badge.textContent = gain.gt(0) ? format(gain, s.settings.numberFormat) : '';
  }

  update(): void {
    this.updateButton();
    if (!this.dialog.open) return;
    const s = this.getState();
    const f = s.settings.numberFormat;
    const gain = matsOnReset(s);

    $('mats-on-reset').textContent = format(gain, f);
    $('next-mat').textContent =
      `All-time pints: ${format(allTimePints(s).floor(), f)}. Next mat at ${format(pintsForNextMat(s).ceil(), f)}.`;
    $<HTMLButtonElement>('ring-bell').disabled = gain.lte(0);

    const rate = mods(s).matRate * 100;
    $('licence-summary').textContent =
      `You have ${format(s.beerMats, f)} Beer Mats (${bonusText(matMult(s), f)}, ${rate}% each). Spending them gives up their bonus.`;

    for (const node of LICENCE) {
      const el = this.nodes.get(node.id)!;
      const status = licenceStatus(s, node.id);
      const affordable = status === 'available' && s.beerMats.gte(node.cost);
      el.classList.toggle('owned', status === 'owned');
      el.classList.toggle('locked', status === 'locked');
      el.classList.toggle('affordable', affordable);
      el.disabled = status !== 'available';
      const cost = el.querySelector<HTMLElement>('.ln-cost')!;
      const text = status === 'owned' ? '✓ Owned' : `${format(node.cost, f, true)} ${node.cost.eq(1) ? 'mat' : 'mats'}`;
      if (cost.textContent !== text) cost.textContent = text;
    }

    const auto = mods(s).auto;
    for (const [what, label] of this.autoBoxes) {
      label.hidden = !auto.has(what);
      label.querySelector('input')!.checked = s.settings.auto[what];
    }
  }
}

