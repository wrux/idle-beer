/** The golden "Free Round!" pint that drifts across the pub. Position is driven by game time. */
import { tr } from '../i18n';


const GOLDEN_PINT = `
<svg viewBox="-20 -26 40 52" aria-hidden="true">
  <defs>
    <linearGradient id="fr-gold" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#e89a1c"/><stop offset="0.45" stop-color="#ffe27a"/><stop offset="1" stop-color="#f0a92a"/>
    </linearGradient>
  </defs>
  <path d="M-12.500,-19 L12.500,-19 L10,21 Q0,23.500 -10,21 Z" fill="url(#fr-gold)" stroke="#fff7d1" stroke-width="2" stroke-linejoin="round"/>
  <path d="M-11,3 L-9.300,19 Q0,21.300 9.300,19 L11,3 Z" fill="#fff3b0" opacity="0.28"/>
  <path d="M-13.500,-19 Q-15,-25 -9,-24 Q-6,-28.500 -1,-25 Q4,-29 8,-24.500 Q15,-25.500 13.500,-19 L12.800,-12.500 Q6,-10 2,-13 Q-3,-9.500 -7,-13 Q-10,-11 -12.800,-12.500 Z" fill="#fffdf2"/>
  <path d="M-7,-7 L-6,13" stroke="#fff" stroke-width="2.600" stroke-linecap="round" opacity="0.75"/>
  <circle cx="4" cy="6" r="1.300" fill="#fff8d0"/><circle cx="1" cy="-2" r="1" fill="#fff8d0"/><circle cx="6" cy="13" r="0.900" fill="#fff8d0"/>
  <path d="M15,-12 l1.600,-4 l1.600,4 l4,1.600 l-4,1.600 l-1.600,4 l-1.600,-4 l-4,-1.600 Z" fill="#fff" opacity="0.95"/>
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
    b.setAttribute('aria-label', tr('Free Round! Click to claim'));
    b.innerHTML = GOLDEN_PINT + `<span class="free-round-label">${tr('Free Round!')}</span>`;
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
