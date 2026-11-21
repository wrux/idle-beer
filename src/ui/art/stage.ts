/**
 * The scene: one canvas that fills the stage, drawn fresh every frame.
 *
 * Back to front: the location's sky or street, its (cached) architecture, lamps and bunting,
 * the crowd in three rows, you, the bar (cached), the hand pump, your pint, then light and
 * particles over the top. The world is 300 units tall and centred on x = 200; how much of its
 * width you see depends on the shape of the stage.
 */
import { beerAt, type BeerLook } from '../../data/beers';
import { DRINKERS } from '../../data/drinkers';
import type { Location } from '../../data/locations';
import {
  GLASS, crowdPlan, crowdSpots, toWorld, type CrowdFigure, type Pose, type PoseLayout, type Pt, type Renderer,
} from '../scene';
import { BACKDROPS, registerBackdrops, type Backdrop, type BarStyle } from './backdrops';
import {
  TAU, alpha, approach, at, circle, clamp, curve, ellipse, glow, hash, hgrad, hsl, lerp, mix, poly, rect, rgrad,
  shade, tint, vgrad, type Ctx, type View,
} from './draw';
import { Figure } from './figures';
import { drawGlass, drawGlassAura } from './glass';
import { X0, X1, SPAN } from './kit';
import { Hero } from './player';
import { COSMOS_BACKDROPS } from './cosmos';
import { WORLD_BACKDROPS } from './world';

registerBackdrops(WORLD_BACKDROPS);
registerBackdrops(COSMOS_BACKDROPS);

const WORLD_H = 300;
const MIN_W = 270;
const MAX_W = 760;
const BAR_BACK = 204;
const BAR_LIP = 220;
export const LAYOUT: PoseLayout = { glassScale: 1, restX: 243, barTop: 212, mouth: { x: 165, y: 120.5 }, mouthTipsBack: false };
const DISPLAY_FONT = '"Abril Fatface", "Baloo 2", Georgia, serif';

/** Size, height and haze of each crowd row, front to back. */
const ROWS = [
  { scale: 1, headY: 146, haze: 0.5 },
  { scale: 0.84, headY: 137, haze: 1.5 },
  { scale: 0.7, headY: 128, haze: 2.5 },
];

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; colour: string;
  kind: 'dot' | 'confetti' | 'puff';
  spin: number;
}

export class StageRenderer implements Renderer {
  readonly root: HTMLDivElement;
  readonly layout = LAYOUT;
  private canvas = document.createElement('canvas');
  private ctx: Ctx;
  private shell = document.createElement('canvas');
  private barLayer = document.createElement('canvas');
  private layersDirty = true;
  private observer: ResizeObserver;

  private cssW = 0;
  private px = 1; // canvas pixels per world unit
  private view: View = { x0: 0, x1: 400, y0: 0, w: 400 };

  private look: BeerLook;
  private beerName = '';
  private backdrop: Backdrop = BACKDROPS.redlion;
  private hero = new Hero();
  private figures = new Map<string, Figure>();
  private order: Figure[] = [];
  private crowdKey = '';
  private owned: (id: string) => number = () => 0;
  /** Characters who belong to the pub you're in (two or three of each kind it has). */
  private locals: string[] = [];
  private firstCrowd = true;
  private particles: Particle[] = [];

  private lastT = 0;
  private lastLipX = 0;
  private slosh = 0;
  private sloshV = 0;
  private pull = 0;
  private land = 0;
  private wasLifted = false;
  private wasRefilling = false;
  private streak = 0;
  private lastPose: Pose | null = null;

  constructor(look: BeerLook) {
    this.look = look;
    this.root = document.createElement('div');
    this.root.className = 'art';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.root);
    // The sign is lettered in a web font; repaint the cached layers once it arrives.
    void document.fonts?.load(`20px ${DISPLAY_FONT}`).then(() => (this.layersDirty = true));
    this.applyTone();
  }

  // ---------- what to show ----------

  setBeer(look: BeerLook, index = 0): void {
    this.look = look;
    this.beerName = beerAt(index).name;
  }

  setLocation(loc: Location): void {
    this.backdrop = BACKDROPS[loc.id] ?? BACKDROPS.redlion;
    // Three of the place's own: a pub abroad is never empty, even before your lot arrive.
    this.locals = loc.locals.length ? Array.from({ length: 3 }, (_, i) => loc.locals[i % loc.locals.length]) : [];
    this.seatCrowd();
    this.layersDirty = true;
    this.applyTone();
  }

  setCrowd(owned: (id: string) => number): void {
    this.owned = owned;
    this.seatCrowd();
  }

  /** Where the pub's own locals stand: one at the bar, the others just behind. */
  private static LOCAL_SPOTS = [1, 7, 10, 3];

  /**
   * Work out who stands where. The pub's locals take a few fixed spots (they're there whoever
   * you bring); your drinkers fill the rest in the usual order.
   */
  private seatCrowd() {
    const spots = crowdSpots();
    const seated: (CrowdFigure & { visit: number; local: boolean })[] = [];
    const taken = new Set<number>();
    this.locals.forEach((id, i) => {
      const at = StageRenderer.LOCAL_SPOTS[i % StageRenderer.LOCAL_SPOTS.length];
      taken.add(at);
      seated.push({ id, ...spots[at], visit: 0, local: true });
    });
    const free = spots.filter((_, i) => !taken.has(i));
    crowdPlan(DRINKERS, this.owned).slice(0, free.length).forEach((f, i) => {
      // Whoever has since taken this spot keeps it, as long as you still have their sort.
      const now = this.visitors.get(`${free[i].row}:${free[i].x}`);
      const id = now && this.owned(now.id) > 0 ? now.id : f.id;
      seated.push({ id, ...free[i], visit: now?.visit ?? 0, local: false });
    });

    const key = seated.map((f) => `${f.row}:${f.x}:${f.id}:${f.visit}`).join('|');
    if (key === this.crowdKey) return;
    this.crowdKey = key;
    const next = new Map<string, Figure>();
    this.regulars = [];
    let fresh = 0;
    for (const spot of seated) {
      const id = `${spot.row}:${spot.x}:${spot.id}:${spot.visit}`;
      let f = this.figures.get(id);
      if (!f) {
        f = this.place(spot, spot.visit);
        // Everyone's already here when the game loads; later arrivals pop up one by one.
        if (this.firstCrowd) f.settle();
        else f.arrive(fresh++ * 0.07);
      }
      next.set(id, f);
      if (!spot.local) this.regulars.push({ spot: `${spot.row}:${spot.x}`, figure: f, visit: spot.visit });
    }
    this.figures = next;
    this.order = [...next.values()].sort((a, b) => b.row - a.row || a.x - b.x);
    this.firstCrowd = false;
    this.applyTone();
  }

  /** Who has taken over which spot since the plan was made, and how many have stood there. */
  private visitors = new Map<string, { id: string; visit: number }>();
  private regulars: { spot: string; figure: Figure; visit: number }[] = [];
  private going: { spot: string; figure: Figure; visit: number } | null = null;
  private nextChange = 6;

  /**
   * People come and go. Every few seconds somebody ducks out and somebody else takes their
   * place: any sort of drinker you have, the numerous ones more often, and never the same face.
   */
  private comeAndGo(dt: number) {
    if (this.going && !this.order.includes(this.going.figure)) this.going = null;
    if (this.going) {
      if (!this.going.figure.gone) return;
      const types = DRINKERS.map((d, tier) => ({ id: d.id, w: Math.sqrt(this.owned(d.id)) * (1 + tier * 0.1) })).filter((d) => d.w > 0);
      let pick = Math.random() * types.reduce((sum, d) => sum + d.w, 0);
      const id = types.find((d) => (pick -= d.w) <= 0)?.id ?? types[0]?.id;
      if (id) this.visitors.set(this.going.spot, { id, visit: this.going.visit + 1 });
      this.going = null;
      this.seatCrowd();
      return;
    }
    this.nextChange -= dt;
    if (this.nextChange > 0 || this.regulars.length < 3) return;
    this.nextChange = 3.5 + Math.random() * 5;
    this.going = this.regulars[Math.floor(Math.random() * this.regulars.length)];
    this.going.figure.leave();
  }

  private place(spot: CrowdFigure, visit = 0): Figure {
    const seed = Math.floor(hash(spot.x + 1000, spot.row * 7 + spot.id.length + visit * 131) * 1e6) + spot.id.charCodeAt(0);
    const f = new Figure(spot.id, seed);
    const row = ROWS[spot.row];
    f.row = spot.row;
    f.x = spot.x + (hash(seed, 1) - 0.5) * 9;
    f.headY = row.headY + (hash(seed, 2) - 0.5) * 6;
    f.scale = row.scale * (0.96 + hash(seed, 3) * 0.1);
    f.flip = hash(seed, 4) < 0.5 ? 1 : -1;
    return f;
  }

  private applyTone() {
    const b = this.backdrop;
    for (const f of this.figures.values()) {
      f.adrift = b.adrift ?? 0;
      f.tone = { fog: b.fog, amount: clamp(b.haze * ROWS[f.row].haze, 0, 0.6), dim: b.dim * (0.7 + f.row * 0.35) };
    }
    this.hero.tone = { fog: b.fog, amount: b.haze * 0.2, dim: b.dim * 0.55 };
  }

  cheer(strength = 1): void {
    for (const f of this.order) f.cheer(hash(f.seed, 9) * 0.35);
    if (strength >= 2) {
      const v = this.view;
      for (let i = 0; i < 70; i++) {
        this.particles.push({
          x: v.x0 + Math.random() * v.w, y: v.y0 - 10 - Math.random() * 40, vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 60,
          life: 0, max: 2.6 + Math.random() * 1.4, r: 2 + Math.random() * 2, colour: hsl(Math.random() * 360, 0.85, 0.62),
          kind: 'confetti', spin: Math.random() * TAU,
        });
      }
    }
  }

  setStreak(n: number): void {
    this.streak = n;
    this.hero.merry = clamp(n / 10);
  }

  project(p: Pt): Pt {
    const v = this.view;
    return { x: (p.x - v.x0) / v.w, y: (p.y - v.y0) / (WORLD_H - v.y0) };
  }

  // ---------- sizing and cached layers ----------

  private resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = w;
    let worldW = (WORLD_H * w) / h;
    let scale = h / WORLD_H;
    if (worldW < MIN_W) {
      worldW = MIN_W;
      scale = w / MIN_W;
    } else if (worldW > MAX_W) {
      worldW = MAX_W;
      scale = w / MAX_W;
    }
    this.px = scale * dpr;
    this.view = { x0: 200 - worldW / 2, x1: 200 + worldW / 2, y0: WORLD_H - h / scale, w: worldW };
    for (const c of [this.canvas, this.shell, this.barLayer]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    this.layersDirty = true;
    // Resizing clears the canvas; repaint straight away rather than flash black for a frame.
    if (this.lastPose) this.render(this.lastPose, this.lastT);
  }

  private toWorldSpace(ctx: Ctx) {
    ctx.setTransform(this.px, 0, 0, this.px, -this.view.x0 * this.px, -this.view.y0 * this.px);
  }

  private paintLayers() {
    this.layersDirty = false;
    const s = this.shell.getContext('2d')!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, this.shell.width, this.shell.height);
    this.toWorldSpace(s);
    this.backdrop.shell?.(s);

    const b = this.barLayer.getContext('2d')!;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, this.barLayer.width, this.barLayer.height);
    this.toWorldSpace(b);
    paintBar(b, this.backdrop.bar, this.backdrop.dim);
    // A beer mat for the pint to come home to.
    ellipse(b, LAYOUT.restX, LAYOUT.barTop + 0.6, 23, 4.2, mix('#f1ead9', '#07040d', this.backdrop.dim));
    ellipse(b, LAYOUT.restX, LAYOUT.barTop + 0.6, 19, 3.2, mix('#b8322c', '#07040d', this.backdrop.dim));
    ellipse(b, LAYOUT.restX, LAYOUT.barTop + 0.6, 14, 2.3, mix('#f1ead9', '#07040d', this.backdrop.dim));
  }

  // ---------- per frame ----------

  render(pose: Pose, t: number): void {
    if (!this.cssW) this.resize();
    if (!this.cssW) return;
    if (this.layersDirty) this.paintLayers();
    this.lastPose = pose;
    const dt = clamp(t - this.lastT, 0, 0.1);
    this.lastT = t;
    this.step(pose, dt);

    const ctx = this.ctx;
    const b = this.backdrop;
    const v = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.toWorldSpace(ctx);

    b.far(ctx, t);
    this.blit(this.shell);
    b.mid?.(ctx, t);

    for (const f of this.order) f.draw(ctx, t);

    // A little haze between the room and the bar, so you and your pint stand clear of the crowd.
    ctx.fillStyle = vgrad(ctx, 120, BAR_BACK + 4, [alpha(b.fog, 0), alpha(b.fog, 0.22 + b.dim * 0.4)]);
    ctx.fillRect(X0, 120, SPAN, BAR_BACK - 116);

    this.hero.drawBody(ctx, pose, t);
    this.blit(this.barLayer);
    this.barGlow(ctx, t);
    this.drawPump(ctx, pose, t);
    this.drawPint(ctx, pose, t);
    this.drawParticles(ctx);

    b.front?.(ctx, t);

    // Pull the eye to the middle.
    const cx = 200, cy = 150, r = Math.hypot(v.w / 2, WORLD_H - v.y0) * 0.92;
    ctx.fillStyle = rgrad(ctx, cx, cy, r * 0.42, r, ['rgba(8,4,14,0)', `rgba(8,4,14,${b.vignette})`]);
    ctx.fillRect(v.x0, v.y0, v.w, WORLD_H - v.y0);
  }

  private blit(layer: HTMLCanvasElement) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  private step(pose: Pose, dt: number) {
    for (const f of this.order) f.update(dt);
    this.comeAndGo(dt);
    this.hero.update(dt, pose);

    // Beer sloshes against the way the glass is moving.
    const vx = dt > 0 ? (pose.lip.x - this.lastLipX) / dt : 0;
    this.lastLipX = pose.lip.x;
    const drive = clamp(vx * 0.0035, -0.5, 0.5);
    this.sloshV += (-(this.slosh - drive) * 120 - this.sloshV * 9) * dt;
    this.slosh = clamp(this.slosh + this.sloshV * dt, -0.6, 0.6);

    // The pump is pulled while a fresh pint pours.
    const pouring = pose.refilling && pose.tilt < 0.02;
    this.pull = approach(this.pull, pouring ? 1 : 0, pouring ? 16 : 7, dt);

    // Glass meets bar.
    const lifted = pose.tilt > 0.03;
    if (this.wasLifted && !lifted) this.land = 1;
    this.wasLifted = lifted;
    this.land = Math.max(0, this.land - dt / 0.22);

    // Finished: a sigh and a spray of foam.
    if (pose.refilling && !this.wasRefilling) {
      this.hero.finished();
      const m = { x: LAYOUT.mouth.x + 6, y: LAYOUT.mouth.y - 4 };
      for (let i = 0; i < 10; i++) {
        const a = -0.4 + (Math.random() - 0.5) * 1.6;
        this.particles.push({
          x: m.x, y: m.y, vx: Math.cos(a) * (30 + Math.random() * 50), vy: Math.sin(a) * 50 - 30, life: 0, max: 0.5 + Math.random() * 0.4,
          r: 1 + Math.random() * 1.6, colour: this.look.foam, kind: 'dot', spin: 0,
        });
      }
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: m.x + 4, y: m.y + 4, vx: 16 + i * 9, vy: -8 - i * 5, life: -i * 0.12, max: 1, r: 4 + i * 1.6, colour: '#ffffff',
          kind: 'puff', spin: 0,
        });
      }
      if (this.streak >= 3) for (const f of this.order) if (hash(f.seed, Math.floor(this.lastT)) < 0.35) f.cheer(Math.random() * 0.3);
    }
    this.wasRefilling = pose.refilling;

    // Froth kicked up by the pour.
    if (pouring && Math.random() < dt * 40) {
      const top = toWorld(pose, 0, lerp(GLASS.H / 2 - 6, -GLASS.H / 2 + 6, pose.fill));
      this.particles.push({
        x: top.x + (Math.random() - 0.5) * 12, y: top.y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0,
        max: 0.3, r: 0.8 + Math.random(), colour: this.look.foam, kind: 'dot', spin: 0,
      });
    }

    for (const p of this.particles) {
      p.life += dt;
      if (p.life < 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dot') p.vy += 260 * dt;
      if (p.kind === 'confetti') {
        p.vx += Math.sin(p.life * 5 + p.spin) * 60 * dt;
        p.vy = Math.min(p.vy + 30 * dt, 70);
      }
      if (p.kind === 'puff') {
        p.vx *= 1 - 2 * dt;
        p.r += 9 * dt;
      }
    }
    if (this.particles.length) this.particles = this.particles.filter((p) => p.life < p.max);
  }

  private drawParticles(ctx: Ctx) {
    for (const p of this.particles) {
      if (p.life < 0) continue;
      const u = p.life / p.max;
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin + p.life * 6);
        ctx.scale(1, Math.cos(p.life * 9 + p.spin));
        ctx.globalAlpha = clamp((1 - u) * 4);
        rect(ctx, -p.r, -p.r * 0.6, p.r * 2, p.r * 1.2, p.colour);
        ctx.restore();
      } else if (p.kind === 'puff') {
        circle(ctx, p.x, p.y, p.r, alpha(p.colour, 0.3 * (1 - u)));
      } else {
        circle(ctx, p.x, p.y, p.r * (1 - u * 0.5), alpha(p.colour, 1 - u * u));
      }
    }
  }

  private barGlow(ctx: Ctx, t: number) {
    const g = this.backdrop.bar.glow;
    if (!g) return;
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.6);
    ctx.fillStyle = alpha(tint(g, 0.55), 0.95);
    ctx.fillRect(X0, BAR_LIP + 5.4, SPAN, 1.5);
    for (let x = X0 + 20; x < X1; x += 56) glow(ctx, x, BAR_LIP + 8, 46, g, 0.34 * pulse, 0.5);
    if (this.backdrop.bar.kind === 'neon') {
      ctx.fillStyle = alpha(tint(g, 0.4), 0.8);
      ctx.fillRect(X0, 288, SPAN, 1.2);
      for (let x = X0 + 40; x < X1; x += 70) glow(ctx, x, 289, 40, g, 0.22 * pulse, 0.4);
    }
  }

  /** The hand pump: brass column, swan neck over the glass, and a handle wearing the beer's clip. */
  private drawPump(ctx: Ctx, pose: Pose, t: number) {
    const dim = this.backdrop.dim;
    const k = (c: string) => mix(c, '#07040d', dim * 0.7);
    const top = LAYOUT.barTop, gh = GLASS.H * LAYOUT.glassScale;
    const bx = LAYOUT.restX + 50;
    const spout = { x: LAYOUT.restX + 3, y: top - gh - 12 };
    const brass = k('#d1a849'), brassHi = k('#f6e3a0'), brassSh = k('#8a6a24');

    // Shadow on the bar.
    ellipse(ctx, bx, top + 1, 19, 3, 'rgba(0,0,0,0.28)');
    // Swan neck.
    const neck = [bx - 3, top - 30, bx - 3, top - gh - 24, bx - 16, top - gh - 38, spout.x + 6, top - gh - 34, spout.x, spout.y];
    curve(ctx, neck, brassSh, 5.6);
    curve(ctx, neck, brass, 3.8);
    curve(ctx, neck.map((n, i) => (i % 2 ? n - 0.9 : n - 0.6)), brassHi, 1);
    rect(ctx, spout.x - 3, spout.y - 2, 6, 5, k('#2a2a30'), 1.4);

    // Pour.
    const pouring = pose.refilling && pose.tilt < 0.02;
    if (pouring && this.pull > 0.3) {
      const lb = top - 6;
      const surface = lerp(lb, top - gh + 6, pose.fill);
      const wob = Math.sin(t * 30) * 0.4;
      ctx.fillStyle = hgrad(ctx, spout.x - 2, spout.x + 2, [this.look.liquidShade, this.look.liquid, tint(this.look.liquid, 0.3)]);
      ctx.fillRect(spout.x - 1.6 + wob * 0.3, spout.y + 3, 3.2, Math.max(0, surface - spout.y - 3));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(spout.x - 0.9, spout.y + 3, 0.8, Math.max(0, surface - spout.y - 3));
    }

    // Base and column.
    rect(ctx, bx - 15, top - 12, 30, 13, k('#4a2a18'), 2.5);
    rect(ctx, bx - 15, top - 12, 30, 3, k('#6a4024'), 2);
    rect(ctx, bx - 8, top - 34, 16, 23, brass, 2.5);
    rect(ctx, bx - 8, top - 34, 4.4, 23, brassHi, 2);
    rect(ctx, bx + 3, top - 34, 5, 23, brassSh, 2);
    rect(ctx, bx - 10, top - 37, 20, 5, brassSh, 2);

    // Handle, leaning back; it comes forward when pulled.
    at(ctx, bx + 2, top - 35, 0.14 + this.pull * 0.5, 1, 1, () => {
      const wood = k('#1c1512');
      poly(ctx, [-3.4, 0, 3.4, 0, 5, -58, -5, -58], wood);
      poly(ctx, [-3.4, 0, -1.4, 0, -2.4, -58, -5, -58], k('#3a2c24'));
      rect(ctx, -5.6, -66, 11.2, 10, wood, 4);
      rect(ctx, -4.4, -2.6, 8.8, 4, brass, 1.4);
      rect(ctx, -5.6, -59.5, 11.2, 2.6, brass, 1);
      // Pump clip.
      const l = this.look;
      const edge = k(shade(l.liquid, 0.55));
      ctx.translate(0, -30);
      const shield = [-11.5, -13, 11.5, -13, 11.5, 3, 0, 14.5, -11.5, 3];
      ctx.beginPath();
      ctx.moveTo(shield[0], shield[1]);
      ctx.lineTo(shield[2], shield[3]);
      ctx.lineTo(shield[4], shield[5]);
      ctx.quadraticCurveTo(10, 11, 0, 14.5);
      ctx.quadraticCurveTo(-10, 11, shield[8], shield[9]);
      ctx.closePath();
      ctx.fillStyle = k('#f4ead2');
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = k(l.liquid);
      ctx.fillRect(-12, -8.5, 24, 30);
      ctx.fillStyle = k(l.liquidShade);
      ctx.fillRect(2, -8.5, 12, 30);
      ctx.fillStyle = k(l.foam);
      ctx.fillRect(-12, -14, 24, 6.4);
      if (l.effect !== 'none') glow(ctx, 0, 0, 16, l.effectColour ?? '#fff', 0.5);
      ctx.restore();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.font = `400 13px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = k('#fffaf0');
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      const letter = (this.beerName.replace(/^The /, '')[0] ?? 'B').toUpperCase();
      ctx.strokeText(letter, 0, 2.6);
      ctx.fillText(letter, 0, 2.6);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    });
  }

  private drawPint(ctx: Ctx, pose: Pose, t: number) {
    const s = pose.scale;
    const base = toWorld(pose, 0, GLASS.H / 2);
    // Contact shadow, fading as the glass leaves the bar.
    const near = clamp(1 - (LAYOUT.barTop - base.y) / 40);
    ellipse(ctx, base.x + 2, LAYOUT.barTop + 1.2, 17 * s * (0.7 + near * 0.3), 3 * s, `rgba(0,0,0,${0.3 * near})`);
    // Its glow on the polished wood.
    if (near > 0.2) glow(ctx, base.x, LAYOUT.barTop + 3, 30, tint(this.look.liquid, 0.3), 0.2 * near * this.backdrop.shine, 0.2);

    this.hero.drawArm(ctx, pose, t);

    ctx.save();
    ctx.translate(pose.lip.x, pose.lip.y);
    ctx.rotate(-pose.tilt);
    ctx.scale(s, s);
    ctx.translate(-pose.lipLocal.x, -pose.lipLocal.y);
    // A little squash as it's set down.
    if (this.land > 0) {
      const q = Math.sin(this.land * Math.PI) * 0.05;
      ctx.translate(0, GLASS.H / 2);
      ctx.scale(1 + q, 1 - q);
      ctx.translate(0, -GLASS.H / 2);
    }
    drawGlassAura(ctx, this.look, t);
    drawGlass(ctx, {
      look: this.look, fill: pose.fill, foam: pose.foam, down: pose.down, slosh: this.slosh, t,
      pouring: pose.refilling, shine: this.backdrop.shine,
    });
    ctx.restore();

    this.hero.drawFingers(ctx, pose, t);
  }

  destroy(): void {
    this.observer.disconnect();
    this.root.remove();
  }
}

// ---------- the bar ----------

function paintBar(ctx: Ctx, bar: BarStyle, dim: number) {
  const k = (c: string) => mix(c, '#07040d', dim * 0.75);
  const top = k(bar.top), front = k(bar.front), trim = k(bar.trim);
  const B = 310;

  // Counter top, seen from slightly above.
  ctx.fillStyle = vgrad(ctx, BAR_BACK, BAR_LIP, [k(tint(bar.top, 0.3)), top, k(shade(bar.top, 0.18))]);
  ctx.fillRect(X0, BAR_BACK, SPAN, BAR_LIP - BAR_BACK);
  ctx.fillStyle = k(tint(bar.top, 0.5));
  ctx.fillRect(X0, BAR_BACK, SPAN, 0.9);
  // Soft reflections of the room in the polish.
  for (let x = X0; x < X1; x += 47) {
    const w = 14 + hash(x, 1) * 26;
    poly(ctx, [x, BAR_LIP, x + 7, BAR_BACK + 1, x + 7 + w, BAR_BACK + 1, x + w, BAR_LIP], `rgba(255,255,255,${0.035 + hash(x, 2) * 0.05})`);
  }
  if (bar.kind === 'planks') {
    for (let x = X0; x < X1; x += 31) rect(ctx, x, BAR_BACK, 0.8, BAR_LIP - BAR_BACK, 'rgba(60,30,10,0.25)');
  }

  // Rounded front edge.
  ctx.fillStyle = vgrad(ctx, BAR_LIP, BAR_LIP + 6, [k(tint(bar.top, 0.16)), k(shade(bar.top, 0.42))]);
  ctx.fillRect(X0, BAR_LIP, SPAN, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(X0, BAR_LIP + 6, SPAN, 3);

  // Front.
  ctx.fillStyle = vgrad(ctx, BAR_LIP + 6, B, [front, k(shade(bar.front, 0.4))]);
  ctx.fillRect(X0, BAR_LIP + 6, SPAN, B - BAR_LIP - 6);
  if (bar.kind === 'wood') {
    for (let x = X0 + 8; x < X1; x += 66) {
      rect(ctx, x, 236, 56, 58, k(shade(bar.front, 0.22)), 3);
      rect(ctx, x + 3, 239, 50, 52, k(tint(bar.front, 0.05)), 2);
      rect(ctx, x + 3, 239, 50, 1.2, k(tint(bar.front, 0.22)));
      rect(ctx, x + 3, 239, 1.2, 52, k(tint(bar.front, 0.14)));
      rect(ctx, x + 3, 290, 50, 1.2, 'rgba(0,0,0,0.3)');
    }
  } else if (bar.kind === 'planks') {
    for (let x = X0, i = 0; x < X1; x += 22, i++) {
      rect(ctx, x, BAR_LIP + 9, 21, B, k(mix(bar.front, i % 2 ? '#3a2412' : '#f1d9a8', 0.08 + hash(i, 5) * 0.1)));
      rect(ctx, x + 21, BAR_LIP + 9, 1, B, 'rgba(30,14,6,0.4)');
      circle(ctx, x + 10.5, BAR_LIP + 16, 0.9, 'rgba(30,14,6,0.45)');
      circle(ctx, x + 10.5, 290, 0.9, 'rgba(30,14,6,0.45)');
    }
    ctx.fillStyle = vgrad(ctx, BAR_LIP + 6, B, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']);
    ctx.fillRect(X0, BAR_LIP + 6, SPAN, B);
  } else if (bar.kind === 'metal') {
    for (let x = X0 + 6; x < X1; x += 78) {
      rect(ctx, x, 236, 70, 60, k(tint(bar.front, 0.1)), 4);
      rect(ctx, x, 236, 70, 1.4, k(tint(bar.front, 0.4)), 1);
      for (const [rx, ry] of [[4, 4], [66, 4], [4, 56], [66, 56]]) circle(ctx, x + rx, 236 + ry, 1.1, k(shade(bar.front, 0.35)));
    }
  } else {
    // Dark gloss with a sheen.
    for (let x = X0; x < X1; x += 90) poly(ctx, [x, B, x + 30, BAR_LIP + 9, x + 52, BAR_LIP + 9, x + 22, B], 'rgba(255,255,255,0.03)');
  }

  // Foot rail and brackets.
  if (bar.kind === 'wood' || bar.kind === 'metal') {
    for (let x = X0 + 30; x < X1; x += 132) {
      rect(ctx, x - 2, 266, 4, 12, k(shade(bar.trim, 0.45)), 1);
      circle(ctx, x, 266, 3, trim);
    }
    ctx.fillStyle = vgrad(ctx, 271, 277, [k(tint(bar.trim, 0.5)), trim, k(shade(bar.trim, 0.5))]);
    ctx.fillRect(X0, 271, SPAN, 5.4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(X0, 277, SPAN, 2.4);
  }
  // A strip of trim under the lip.
  ctx.fillStyle = alpha(trim, 0.85);
  ctx.fillRect(X0, BAR_LIP + 9, SPAN, 1.3);
}
