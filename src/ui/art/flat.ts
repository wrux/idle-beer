/** Flat vector art style: crisp SVG shapes, gradients and soft shading. */
import type { BeerLook, GlassShape } from '../../data/beers';
import type { Drinker } from '../../data/drinkers';
import type { Location } from '../../data/locations';
import { figureMarkup } from './crowd';
import { windowView } from './views';
import {
  BAR_TOP, GLASS, HEAD, INNER_BOT, INNER_TOP, NECK, SCENE_H, SCENE_W, SHOULDER,
  depthBelowSurface, halfWidth, toWorld, type Pose, type Renderer,
} from '../scene';

const NS = 'http://www.w3.org/2000/svg';

const C = {
  wall: '#2f4f3e', wallStripe: '#2a4738', dado: '#8b5a33', panel: '#6a3f22', panelInset: '#5c361d',
  barTop: '#9a6338', barTopHi: '#b37a4a', barFront: '#4b2a17', barLine: '#3d2212', brass: '#d1a849',
  frame: '#6a3f22', night: '#1f2c4d', moon: '#f4e9c1', gold: '#e0b85a', signBg: '#3a1712',
  jacket: '#6d5a46', jacketHi: '#7d6a55', shirt: '#ece6d6', skin: '#f0c39d', skinShade: '#dba57f',
  cap: '#4f463d', capShade: '#3e372f', hair: '#b9b2a8', ink: '#2b1d14', blush: '#e88f80',
  glass: '#e8f4f7',
};

/** Outline of the glass as an SVG path in local coords, inset by `inset`. */
function glassPath(shape: GlassShape, inset: number, top: number, bottom: number): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let y = top; y <= bottom + 0.001; y += 1) {
    const hw = Math.max(0.5, halfWidth(y, shape) - inset);
    left.push(`${(-hw).toFixed(2)},${y.toFixed(2)}`);
    right.unshift(`${hw.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${left.join(' L')} L${right.join(' L')} Z`;
}

/** Half-plane polygon below a line through p with normal `down`, offset upwards by `up`. */
function band(p: { x: number; y: number }, down: { x: number; y: number }, up: number, depth: number): string {
  const B = 200;
  const tx = down.y, ty = -down.x; // tangent along the surface
  const ox = p.x - down.x * up, oy = p.y - down.y * up;
  const pts = [
    [ox + tx * B, oy + ty * B],
    [ox - tx * B, oy - ty * B],
    [ox - tx * B + down.x * depth, oy - ty * B + down.y * depth],
    [ox + tx * B + down.x * depth, oy + ty * B + down.y * depth],
  ];
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/** Where the crowd stands behind the bar (x), avoiding the regular, the pint and the pump. */
const CROWD_SLOTS = [24, 58, 92, 205, 290, 318, 384];
const CROWD_SCALE = 0.62;
const CROWD_FEET = 214;

const BUBBLES = [
  { x: -9, speed: 0.55, offset: 0.1 },
  { x: -3, speed: 0.8, offset: 0.6 },
  { x: 4, speed: 0.65, offset: 0.35 },
  { x: 9, speed: 0.9, offset: 0.8 },
  { x: 0, speed: 0.5, offset: 0.0 },
];

export class FlatRenderer implements Renderer {
  readonly root: SVGSVGElement;
  private glassG: SVGGElement;
  private headG: SVGGElement;
  private liquid: SVGPolygonElement;
  private foam: SVGPolygonElement;
  private arm: SVGPathElement;
  private hand: SVGGElement;
  private eyeOpen: SVGElement;
  private eyeClosed: SVGElement;
  private bubbles: SVGCircleElement[];
  private aura: SVGGElement;
  private ring: SVGEllipseElement;
  private shimmer: SVGRectElement;
  private look!: BeerLook;
  private crowd: SVGGElement;
  private crowdSlots: { g: SVGGElement; arms: SVGGElement[]; x: number; flip: boolean; phase: number; speed: number }[] = [];

  constructor(look: BeerLook) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${SCENE_W} ${SCENE_H}`);
    svg.setAttribute('class', 'art art-flat');
    svg.setAttribute('aria-hidden', 'true');

    const panels = [0, 1, 2, 3, 4, 5, 6]
      .map((i) => `<rect class="panel-inset" x="${8 + i * 58}" y="162" width="46" height="42" rx="3" fill="${C.panelInset}"/>`)
      .join('');
    const barLines = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) => `<rect x="${24 + i * 52}" y="222" width="3" height="78" fill="${C.barLine}"/>`)
      .join('');

    svg.innerHTML = `
      <defs>
        <pattern id="flat-stripes" width="14" height="10" patternUnits="userSpaceOnUse">
          <rect class="wall-stripe" width="7" height="10" fill="${C.wallStripe}"/>
        </pattern>
        <clipPath id="flat-window-clip"><rect x="40" y="30" width="76" height="76" rx="2"/></clipPath>
        <radialGradient id="flat-glow">
          <stop offset="0" stop-color="#ffd58a" stop-opacity="0.45"/>
          <stop offset="1" stop-color="#ffd58a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="flat-beer" gradientUnits="userSpaceOnUse" x1="-18" y1="0" x2="18" y2="0">
          <stop class="beer-shade" offset="0"/>
          <stop class="beer-main" offset="0.55"/>
          <stop class="beer-shade" offset="1"/>
        </linearGradient>
        <linearGradient id="flat-shimmer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/>
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.7"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="flat-aura">
          <stop class="aura-inner" offset="0.35" stop-opacity="0.55"/>
          <stop class="aura-outer" offset="1" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="flat-glass-clip"><path class="glass-inner"/></clipPath>
      </defs>

      <rect class="wall" width="400" height="152" fill="${C.wall}"/>
      <rect width="400" height="152" fill="url(#flat-stripes)"/>
      <circle cx="100" cy="30" r="120" fill="url(#flat-glow)"/>

      <rect x="34" y="24" width="88" height="88" rx="5" fill="${C.frame}"/>
      <g class="window-view" clip-path="url(#flat-window-clip)"></g>
      <rect x="76" y="30" width="4" height="76" fill="${C.frame}"/>
      <rect x="40" y="66" width="76" height="4" fill="${C.frame}"/>

      <rect x="198" y="26" width="124" height="48" rx="6" fill="${C.signBg}" stroke="${C.gold}" stroke-width="3"/>
      <text x="260" y="56" text-anchor="middle" fill="${C.gold}" font-size="15" font-weight="800"
            font-family="Georgia, serif" class="sign-text" lengthAdjust="spacingAndGlyphs">THE RED LION</text>

      <circle cx="362" cy="80" r="27" fill="#1b1b1b"/>
      <circle cx="362" cy="80" r="22" fill="#e8dcc0"/>
      <circle cx="362" cy="80" r="16" fill="#1b1b1b"/>
      <circle cx="362" cy="80" r="10" fill="#2f8f4e"/>
      <circle cx="362" cy="80" r="4" fill="#c0392b"/>

      <line x1="100" y1="0" x2="100" y2="16" stroke="#222" stroke-width="2"/>
      <path d="M86,28 L92,14 L108,14 L114,28 Z" fill="#7a2b20"/>
      <ellipse cx="100" cy="28" rx="14" ry="3" fill="#ffe2a0"/>

      <rect y="150" width="400" height="6" fill="${C.dado}"/>
      <rect class="panel" y="156" width="400" height="56" fill="${C.panel}"/>
      ${panels}

      <g class="crowd"></g>

      <g class="body">
        <path d="M116,214 L116,160 Q116,136 140,133 L160,133 Q180,136 180,160 L180,214 Z" fill="${C.jacket}"/>
        <path d="M139,133 L150,154 L161,133 Z" fill="${C.shirt}"/>
        <path d="M146,140 L150,158 L154,140 Z" fill="#8c2d22"/>
        <rect x="143" y="122" width="14" height="16" fill="${C.skinShade}"/>
        <g class="head">
          <ellipse cx="${HEAD.x - 18}" cy="${HEAD.y + 4}" rx="8" ry="12" fill="${C.hair}"/>
          <circle cx="${HEAD.x}" cy="${HEAD.y}" r="${HEAD.r}" fill="${C.skin}"/>
          <ellipse cx="${HEAD.x - 7}" cy="${HEAD.y + 3}" rx="5" ry="6.5" fill="${C.skinShade}"/>
          <circle cx="${HEAD.x + 26}" cy="${HEAD.y + 1}" r="6" fill="${C.skin}"/>
          <circle class="blush" cx="${HEAD.x + 13}" cy="${HEAD.y + 9}" r="5" fill="${C.blush}" opacity="0.55"/>
          <circle class="eye-open" cx="${HEAD.x + 15}" cy="${HEAD.y - 5}" r="2.7" fill="${C.ink}"/>
          <path class="eye-closed" d="M${HEAD.x + 10},${HEAD.y - 5} q5,3 10,0" stroke="${C.ink}" stroke-width="2"
                fill="none" stroke-linecap="round"/>
          <path d="M${HEAD.x + 10},${HEAD.y - 12} l10,-1" stroke="${C.hair}" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M${HEAD.x + 15},${HEAD.y + 15} q5,2 9,-1" stroke="${C.ink}" stroke-width="2"
                fill="none" stroke-linecap="round"/>
          <path d="M${HEAD.x - 28},${HEAD.y - 4} Q${HEAD.x - 26},${HEAD.y - 32} ${HEAD.x},${HEAD.y - 32}
                   Q${HEAD.x + 24},${HEAD.y - 32} ${HEAD.x + 28},${HEAD.y - 10}
                   L${HEAD.x + 46},${HEAD.y - 6} Q${HEAD.x + 40},${HEAD.y + 1} ${HEAD.x + 26},${HEAD.y - 2}
                   L${HEAD.x - 26},${HEAD.y - 1} Z" fill="${C.cap}"/>
          <path d="M${HEAD.x - 26},${HEAD.y - 4} L${HEAD.x + 27},${HEAD.y - 5}" stroke="${C.capShade}"
                stroke-width="3"/>
        </g>
      </g>

      <rect y="${BAR_TOP - 6}" width="400" height="12" rx="2" fill="${C.barTop}"/>
      <rect y="${BAR_TOP - 6}" width="400" height="3" fill="${C.barTopHi}"/>
      <rect y="${BAR_TOP + 6}" width="400" height="${SCENE_H - BAR_TOP - 6}" fill="${C.barFront}"/>
      ${barLines}
      <rect y="272" width="400" height="5" fill="${C.brass}"/>

      <rect x="341" y="160" width="10" height="${BAR_TOP - 160}" fill="#2b2b2b"/>
      <rect x="334" y="${BAR_TOP - 14}" width="24" height="10" rx="2" fill="${C.brass}"/>
      <rect x="343" y="118" width="6" height="44" rx="3" fill="#161616"/>
      <rect x="334" y="124" width="24" height="22" rx="3" fill="#c0392b" stroke="${C.gold}" stroke-width="2"/>
      <text x="346" y="139" text-anchor="middle" fill="${C.gold}" font-size="8" font-weight="800"
            font-family="Georgia, serif">BEST</text>

      <g class="aura" visibility="hidden">
        <circle r="46" fill="url(#flat-aura)"/>
        <ellipse class="ring" rx="42" ry="11" fill="none" stroke-width="1.6" opacity="0.8"/>
      </g>

      <path class="arm" fill="none" stroke="${C.jacketHi}" stroke-width="13" stroke-linecap="round"
            stroke-linejoin="round"/>

      <g class="glass">
        <path class="glass-outer" fill="${C.glass}" opacity="0.18"/>
        <path class="handle" fill="none" stroke="${C.glass}" stroke-width="4.5" stroke-linecap="round" opacity="0.85"/>
        <g clip-path="url(#flat-glass-clip)">
          <polygon class="liquid" fill="url(#flat-beer)"/>
          <rect class="shimmer" y="-40" width="10" height="80" fill="url(#flat-shimmer)" visibility="hidden"/>
          ${BUBBLES.map(() => `<circle class="bubble" r="1.1"/>`).join('')}
          <polygon class="foam"/>
        </g>
        <path class="glass-outer" fill="none" stroke="${C.glass}" stroke-width="${GLASS.WALL}" opacity="0.9"/>
        <path class="glass-base" fill="${C.glass}" opacity="0.55"/>
        <path class="highlight" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
      </g>

      <g class="hand">
        <circle r="7.5" fill="${C.skin}"/>
        <ellipse cx="3" cy="-6" rx="3" ry="4" fill="${C.skinShade}"/>
      </g>
    `;

    const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T;
    this.root = svg;
    this.glassG = q('.glass');
    this.headG = q('.head');
    this.liquid = q('.liquid');
    this.foam = q('.foam');
    this.arm = q('.arm');
    this.hand = q('.hand');
    this.eyeOpen = q('.eye-open');
    this.eyeClosed = q('.eye-closed');
    this.bubbles = Array.from(svg.querySelectorAll('.bubble'));
    this.aura = q('.aura');
    this.ring = q('.ring');
    this.shimmer = q('.shimmer');
    this.crowd = q('.crowd');
    this.setBeer(look);
  }

  setLocation(loc: Location): void {
    const svg = this.root;
    const set = (sel: string, attr: string, value: string) =>
      svg.querySelectorAll(sel).forEach((el) => el.setAttribute(attr, value));
    set('.wall', 'fill', loc.wall);
    set('.wall-stripe', 'fill', loc.wallStripe);
    set('.panel', 'fill', loc.panel);
    set('.panel-inset', 'fill', loc.panelInset);
    svg.querySelector('.window-view')!.innerHTML = windowView(loc.view);
    const sign = svg.querySelector<SVGTextElement>('.sign-text')!;
    sign.textContent = loc.sign;
    sign.setAttribute('textLength', String(Math.min(110, loc.sign.length * 9)));
  }

  /** Characters behind the bar, one per entry (left to right). */
  setCrowd(drinkers: Drinker[]): void {
    this.crowd.replaceChildren();
    this.crowdSlots = drinkers.slice(0, CROWD_SLOTS.length).map((d, i) => {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = figureMarkup(d);
      this.crowd.appendChild(g);
      const x = CROWD_SLOTS[i];
      return {
        g, x, flip: i % 2 === 1,
        arms: Array.from(g.querySelectorAll<SVGGElement>('.c-arm')),
        phase: (i * 2.39) % 7, speed: 0.13 + ((i * 37) % 9) / 100,
      };
    });
  }

  setBeer(look: BeerLook): void {
    this.look = look;
    const svg = this.root;
    const shape = look.glass;
    const all = (sel: string) => Array.from(svg.querySelectorAll<SVGElement>(sel));

    for (const el of all('.beer-shade')) el.setAttribute('stop-color', look.liquidShade);
    for (const el of all('.beer-main')) el.setAttribute('stop-color', look.liquid);
    this.foam.setAttribute('fill', look.foam);

    const outer = glassPath(shape, 0, -GLASS.H / 2, GLASS.H / 2);
    for (const el of all('.glass-outer')) el.setAttribute('d', outer);
    all('.glass-inner')[0].setAttribute('d', glassPath(shape, GLASS.WALL, INNER_TOP, INNER_BOT));
    all('.glass-base')[0].setAttribute('d', glassPath(shape, 0, INNER_BOT, GLASS.H / 2));

    // Highlight streak follows the right-hand wall of whatever glass this is.
    const hx = (y: number) => (halfWidth(y, shape) * 0.55).toFixed(2);
    all('.highlight')[0].setAttribute('d', `M${hx(-22)},-22 L${hx(-8)},-8 L${hx(12)},12`);

    const hw = halfWidth(0, shape);
    all('.handle')[0].setAttribute(
      'd',
      shape === 'tankard' ? `M${hw},-18 C${hw + 15},-18 ${hw + 15},14 ${hw},14` : '',
    );

    const fx = look.effect;
    const colour = look.effectColour ?? '#ffffff';
    this.glassG.style.setProperty('--glow', colour);
    this.glassG.classList.toggle('fx-glow', fx === 'glow' || fx === 'sparkle');
    this.aura.setAttribute('visibility', fx === 'void' || fx === 'singularity' ? 'visible' : 'hidden');
    for (const el of all('.aura-inner, .aura-outer')) el.setAttribute('stop-color', colour);
    this.ring.setAttribute('stroke', colour);
    this.ring.setAttribute('visibility', fx === 'singularity' ? 'visible' : 'hidden');
    this.shimmer.setAttribute('visibility', fx === 'shimmer' ? 'visible' : 'hidden');
    const sparkly = fx === 'sparkle' || fx === 'shimmer';
    for (const b of this.bubbles) {
      b.setAttribute('fill', sparkly ? colour : '#fff6d8');
      b.setAttribute('opacity', fx === 'void' || fx === 'singularity' ? '0.35' : '0.8');
    }
  }

  render(pose: Pose, t: number): void {
    const deg = (-pose.tilt * 180) / Math.PI;
    this.glassG.setAttribute(
      'transform',
      `translate(${pose.lip.x.toFixed(2)} ${pose.lip.y.toFixed(2)}) rotate(${deg.toFixed(2)}) ` +
        `translate(${(-pose.lipLocal.x).toFixed(2)} ${(-pose.lipLocal.y).toFixed(2)})`,
    );
    this.headG.setAttribute('transform', `rotate(${((-pose.headTilt * 180) / Math.PI).toFixed(2)} ${NECK.x} ${NECK.y})`);

    const hasBeer = pose.fill > 0.001;
    this.liquid.setAttribute('points', hasBeer ? band(pose.surface, pose.down, 0, 200) : '');
    this.foam.setAttribute('points', hasBeer && pose.foam > 0.2 ? band(pose.surface, pose.down, pose.foam, pose.foam) : '');

    const fx = this.look.effect;
    const span = INNER_BOT - INNER_TOP;
    BUBBLES.forEach((b, i) => {
      const y = INNER_BOT - ((t * b.speed + b.offset) % 1) * span;
      const visible = hasBeer && depthBelowSurface(pose, b.x, y) > 2;
      const el = this.bubbles[i];
      el.setAttribute('cx', String(b.x));
      el.setAttribute('cy', y.toFixed(2));
      el.setAttribute('visibility', visible ? 'visible' : 'hidden');
      if (fx === 'sparkle') el.setAttribute('r', (0.6 + 1.4 * Math.abs(Math.sin(t * 4 + i * 1.7))).toFixed(2));
    });

    if (fx === 'shimmer') this.shimmer.setAttribute('x', (-30 + ((t * 0.45) % 1) * 60).toFixed(2));
    if (fx === 'void' || fx === 'singularity') {
      const c = toWorld(pose, 0, 0);
      const pulse = 1 + 0.08 * Math.sin(t * 2.2);
      this.aura.setAttribute('transform', `translate(${c.x.toFixed(2)} ${c.y.toFixed(2)}) scale(${pulse.toFixed(3)})`);
      if (fx === 'singularity') this.ring.setAttribute('transform', `rotate(${((t * 25) % 360).toFixed(1)})`);
    }

    // Crowd: a gentle bob, and every few seconds a sip from their pint.
    for (const c of this.crowdSlots) {
      const bob = Math.sin(t * 1.6 + c.phase) * 0.8;
      const sx = c.flip ? -CROWD_SCALE : CROWD_SCALE;
      c.g.setAttribute('transform', `translate(${c.x} ${(CROWD_FEET + bob).toFixed(2)}) scale(${sx} ${CROWD_SCALE})`);
      const cycle = (t * c.speed + c.phase) % 1; // 0..1
      const sip = cycle < 0.18 ? Math.sin((cycle / 0.18) * Math.PI) : 0;
      for (const arm of c.arms) arm.setAttribute('transform', `rotate(${(-95 * sip).toFixed(1)} 10 -44)`);
    }

    const { hand, elbow } = pose;
    this.arm.setAttribute(
      'd',
      `M${SHOULDER.x},${SHOULDER.y} L${elbow.x.toFixed(2)},${elbow.y.toFixed(2)} L${hand.x.toFixed(2)},${hand.y.toFixed(2)}`,
    );
    this.hand.setAttribute('transform', `translate(${hand.x.toFixed(2)} ${hand.y.toFixed(2)})`);

    this.eyeOpen.setAttribute('visibility', pose.sipping ? 'hidden' : 'visible');
    this.eyeClosed.setAttribute('visibility', pose.sipping ? 'visible' : 'hidden');
  }

  destroy(): void {
    this.root.remove();
  }
}
