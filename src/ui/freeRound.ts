/** The golden "Free Round!" pint that drifts across the pub. Position is driven by game time. */

const GOLDEN_PINT = `
<svg viewBox="-20 -26 40 52" aria-hidden="true">
  <path d="M-12,-20 L12,-20 L10,20 L-10,20 Z" fill="#ffd34d" stroke="#fff7d1" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M-12,-20 L12,-20 L11.5,-12 L-11.5,-12 Z" fill="#fffdf2"/>
  <circle cx="-12" cy="-19" r="4" fill="#fffdf2"/><circle cx="-4" cy="-21" r="4.5" fill="#fffdf2"/>
  <circle cx="5" cy="-21" r="4" fill="#fffdf2"/><circle cx="11" cy="-19" r="3.5" fill="#fffdf2"/>
  <path d="M5,-8 L4,14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
</svg>`;

export class FreeRoundView {
  private el: HTMLButtonElement | null = null;
  private age = 0;
  private fromLeft = true;
  private baseY = 0.3;

  constructor(
    private layer: HTMLElement,
    /** Seconds a golden pint stays (the Licence can stretch it). */
    private lifetime: () => number,
    private onMiss: () => void,
    private onClaim: (x: number, y: number) => void,
  ) {}

  get active(): boolean {
    return this.el !== null;
  }

  spawn(): void {
    this.remove();
    this.age = 0;
    this.fromLeft = Math.random() < 0.5;
    this.baseY = 0.15 + Math.random() * 0.35;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'free-round';
    b.setAttribute('aria-label', 'Free Round! Click to claim');
    b.innerHTML = GOLDEN_PINT + '<span class="free-round-label">Free Round!</span>';
    // Don't let the click also start drinking on the stage underneath.
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const { x, y } = this.position();
      this.remove();
      this.onClaim(x, y);
    });
    this.layer.appendChild(b);
    this.el = b;
    this.update(0);
  }

  /** Fractions of the stage. */
  private position(): { x: number; y: number } {
    const p = this.age / this.lifetime();
    const x = this.fromLeft ? -0.05 + p * 1.1 : 1.05 - p * 1.1;
    const y = this.baseY + Math.sin(this.age * 1.7) * 0.05;
    return { x, y };
  }

  update(dt: number): void {
    if (!this.el) return;
    this.age += dt;
    if (this.age >= this.lifetime()) {
      this.remove();
      this.onMiss();
      return;
    }
    const { x, y } = this.position();
    this.el.style.left = `${(x * 100).toFixed(2)}%`;
    this.el.style.top = `${(y * 100).toFixed(2)}%`;
    this.el.style.setProperty('--tilt', `${(Math.sin(this.age * 2.3) * 12).toFixed(1)}deg`);
    this.el.style.opacity = String(Math.min(1, (this.lifetime() - this.age) / 2, this.age * 3));
  }

  remove(): void {
    this.el?.remove();
    this.el = null;
  }
}
