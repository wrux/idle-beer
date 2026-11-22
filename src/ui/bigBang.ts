/**
 * The Big Bang: the scene when the universe goes (by itself, the moment it runs dry), and its
 * dialog: how close the next one is and what Black Hole Beers buy.
 */
import { bangGoal, bigBang, buyVoid, canBang, stopwatch, voidStatus } from '../core/bang';
import { format } from '../core/format';
import { Decimal } from '../core/num';
import type { GameState } from '../core/state';
import { VOID_BY_ID, VOID_COLUMNS, VOID_TREE, type VoidNode } from '../data/bang';
import { tr, trn } from '../i18n';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const num = (n: number) => format(new Decimal(n), true);

/** "3 Black Hole Beers". */
export const voidBeersText = (n: number): string => trn(n, '{n} Black Hole Beer', '{n} Black Hole Beers', { n: num(n) });

export interface BangEvents {
  /** After the universe has been reset, while the screen is still dark. */
  onBang(gained: number): void;
  onBought(): void;
  /** The Big Bang screen was closed (so that's worth saving: it won't come back up on loading). */
  onClosed(): void;
}

let imploding = false;

/**
 * The end of the universe, in three parts. A black hole opens in the middle of the pub and grows
 * until it is all there is, while the room dims and is drawn in. Three lines are said in the dark.
 * Then a point of light, which becomes everything: `atLight` runs at its brightest, which is the
 * moment to put the next screen up. `atDark` runs once nothing can be seen: reset the game then.
 */
async function implode(atDark: () => void, atLight: () => void): Promise<void> {
  if (imploding) return;
  imploding = true;
  const app = $('app');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlay = document.createElement('div');
  overlay.className = 'big-bang';
  overlay.innerHTML = '<div class="bb-dim"></div><div class="bb-hole"><i></i></div><p></p><div class="bb-light"></div>';
  const dim = overlay.querySelector('.bb-dim')!, hole = overlay.querySelector('.bb-hole')!;
  const line = overlay.querySelector('p')!, light = overlay.querySelector('.bb-light')!;
  document.body.appendChild(overlay);
  document.documentElement.classList.add('blacking-out');
  const run = (el: Element, frames: Keyframe[], duration: number, easing = 'ease-in') =>
    Promise.race([el.animate(frames, { duration, fill: 'forwards', easing }).finished.catch(() => undefined), wait(duration + 250)]);
  const say = async (text: string, ms: number) => {
    line.textContent = text;
    await run(line, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], ms, 'linear');
  };
  try {
    if (still) {
      await run(dim, [{ opacity: 0 }, { opacity: 1 }], 500);
    } else {
      // The room loses its colour and is drawn, a little, towards the middle. No spinning.
      void run(app, [
        { transform: 'scale(1)', filter: 'saturate(1) brightness(1) blur(0px)' },
        { transform: 'scale(0.985)', filter: 'saturate(0.5) brightness(0.8) blur(0px)', offset: 0.45 },
        { transform: 'scale(0.9)', filter: 'saturate(0) brightness(0.3) blur(3px)' },
      ], 4200, 'ease-in');
      void run(dim, [{ opacity: 0 }, { opacity: 0.35, offset: 0.5 }, { opacity: 0.8 }], 4200, 'ease-in');
      // The hole: a speck, then the size of a pint, then everything.
      await run(hole, [
        { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(0.08)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1, offset: 0.62 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%, -50%) scale(14)', opacity: 1 },
      ], 4200, 'cubic-bezier(0.5, 0, 0.9, 0.4)');
      overlay.classList.add('dark');
    }
    atDark();
    for (const a of app.getAnimations()) a.cancel();
    await say(tr('The last pint in the universe is gone.'), still ? 1600 : 2400);
    await say(tr('Everything falls in.'), still ? 1300 : 1900);
    await say(tr('And then: a pop, a hiss, and a head forming.'), still ? 1600 : 2400);
    line.textContent = '';
    if (still) {
      atLight();
    } else {
      // A point of light, held for a breath, and then it is everywhere.
      await run(light, [
        { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(0.012)', opacity: 1, offset: 0.45 },
        { transform: 'translate(-50%, -50%) scale(0.012)', opacity: 1, offset: 0.6 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      ], 1500, 'cubic-bezier(0.7, 0, 1, 0.5)');
      atLight();
      // Whatever `atLight` put up is on top of this now and fading in from the glare by itself.
      await wait(900);
    }
  } finally {
    overlay.remove();
    document.documentElement.classList.remove('blacking-out');
    imploding = false;
  }
}

export class BangPanel {
  private dialog = $<HTMLDialogElement>('bang-dialog');
  private openButton = $<HTMLButtonElement>('open-bang');
  private cards = new Map<string, HTMLButtonElement>();
  private key = '';

  constructor(private getState: () => GameState, private events: BangEvents) {
    this.openButton.addEventListener('click', () => this.show());
    // Looking in from the pub, the screen closes like any other. After a Big Bang it doesn't:
    // the game is stopped there until you say to start the next universe.
    this.dialog.querySelector('.dialog-close')!.addEventListener('click', () => {
      if (!this.getState().voidOpen) this.leave();
    });
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog && !this.getState().voidOpen) this.leave();
    });
    this.dialog.addEventListener('cancel', (e) => {
      if (this.getState().voidOpen) e.preventDefault();
      else this.left();
    });
    $('bang-start').addEventListener('click', () => this.leave());
    this.build();
  }

  /**
   * The universe has run dry: end it. Nobody is asked. Call whenever `canBang` is true; it does
   * nothing while the scene is already playing.
   */
  bang(): void {
    if (imploding || !canBang(this.getState())) return;
    // Anything open would sit on top of the scene (dialogs are drawn above everything).
    for (const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) d.close();
    void implode(() => {
      const gained = bigBang(this.getState());
      if (gained > 0) this.events.onBang(gained);
    }, () => this.show(true));
  }

  /** Close the screen and carry on. */
  private leave() {
    if (this.dialog.open) this.dialog.close();
    this.left();
  }

  /**
   * The screen has gone. Done at once, not left to the dialog's own close event, which comes
   * later or (in some embedded browsers) not at all: what follows may be the last universe.
   */
  private left() {
    this.getState().voidOpen = false;
    this.events.onClosed();
  }

  /**
   * The game stands still while the universe is ending and for as long as the Big Bang screen is
   * up, however you got to it: nothing is drunk, nothing is bought, no clock runs.
   */
  get paused(): boolean {
    return imploding || this.dialog.open;
  }

  /** Put the Big Bang screen up. `fromLight`: it arrives out of the glare of a new universe, not out of the dark. */
  private show(fromLight = false) {
    this.dialog.classList.toggle('from-light', fromLight);
    // "Arrived": here by Big Bang, not by the button, so the only way on is to start the next universe.
    this.dialog.classList.toggle('arrived', this.getState().voidOpen);
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.scrollTop = 0;
    this.update();
  }

  /** On load: if a Big Bang had just happened and its screen was never closed, you are still on it. */
  resume(): void {
    if (this.getState().voidOpen) this.show();
  }

  /** How far tonight is towards the universe running dry, 0 to 1, counted in noughts. */
  static share(s: GameState): number {
    return s.lifetimePints.gt(1) ? Math.min(1, Math.max(0, s.lifetimePints.log10() / bangGoal(s).log10())) : 0;
  }

  /** Three columns bought top to bottom, and the last perk of all underneath. */
  private build() {
    const grid = $('bang-grid');
    const card = (node: VoidNode): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'void-node';
      b.innerHTML = '<b></b><span></span><em></em>';
      b.querySelector('b')!.textContent = node.name;
      b.querySelector('span')!.textContent = node.desc;
      b.addEventListener('click', () => {
        if (buyVoid(this.getState(), node.id)) this.events.onBought();
        this.update();
      });
      this.cards.set(node.id, b);
      return b;
    };
    for (const c of VOID_COLUMNS) {
      const col = document.createElement('div');
      col.className = 'void-column';
      const head = document.createElement('h3');
      head.textContent = c.name;
      col.append(head, ...VOID_TREE.filter((n) => n.column === c.id).map(card));
      grid.appendChild(col);
    }
    const last = VOID_TREE.find((n) => n.column === null);
    if (last) {
      const b = card(last);
      b.classList.add('last');
      grid.appendChild(b);
    }
  }

  /** Cheap: the top-bar button. Called often. */
  updateButton(): void {
    const s = this.getState();
    // Nothing gives the first one away: the button, like the meter in the pub, is there from then on.
    this.openButton.hidden = !(s.bangs > 0 || s.voidEarned > 0);
    const badge = $('bang-badge');
    badge.hidden = s.voidBeers < 1;
    badge.textContent = s.voidBeers > 0 ? num(s.voidBeers) : '';
  }

  update(): void {
    this.updateButton();
    if (!this.dialog.open) return;
    const s = this.getState();
    const goal = bangGoal(s);
    const share = BangPanel.share(s);
    const key = [s.voidBeers, s.voidTree.size, format(s.lifetimePints.floor(), true), format(goal, true), Math.floor(s.universeSeconds)].join('|');
    if (key === this.key) return;
    this.key = key;

    $('bang-beers').textContent = num(s.voidBeers);
    $('bang-note').textContent = tr('Drink {goal} pints in a single night and there is no beer left anywhere. The universe ends, and begins again.', { goal: format(goal, true) });
    $('bang-bar').style.width = `${(share * 100).toFixed(1)}%`;
    $('bang-progress').textContent = tr('{have} of {goal} pints', { have: format(s.lifetimePints.floor(), true), goal: format(goal, true) });
    // The race: how long this universe has taken so far, and the time to beat.
    $('bang-times').textContent = [
      `${tr('This universe')} ${stopwatch(s.universeSeconds)}`,
      s.fastestUniverse > 0 ? `${tr('Fastest universe')} ${stopwatch(s.fastestUniverse)}` : '',
    ].filter(Boolean).join(' · ');

    for (const node of VOID_TREE) {
      const b = this.cards.get(node.id)!;
      const status = voidStatus(s, node.id);
      b.classList.toggle('owned', status === 'owned');
      b.classList.toggle('locked', status === 'locked');
      b.classList.toggle('affordable', status === 'available' && s.voidBeers >= node.cost);
      b.disabled = status !== 'available' || s.voidBeers < node.cost;
      const needs = node.requires.filter((r) => !s.voidTree.has(r));
      b.querySelector('em')!.textContent = status === 'owned' ? tr('Owned')
        : status === 'locked' && needs.length === 1 ? tr('{cost} · needs {name}', { cost: voidBeersText(node.cost), name: VOID_BY_ID.get(needs[0])!.name })
          : status === 'locked' ? tr('{cost} · needs the last of each column', { cost: voidBeersText(node.cost) })
            : voidBeersText(node.cost);
    }
  }
}
