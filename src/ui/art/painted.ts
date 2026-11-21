/**
 * Painted art style: AI-generated illustrations layered in a PixiJS (WebGL) scene.
 *
 * - Each location has its own painting; the scene lines up with the painting's bar edge.
 * - The regular is a puppet (armless body + arm) posed by the shared pose maths.
 * - The glass is painted per shape; the beer inside is drawn live and clipped to the
 *   painted shape, so every beer's colour, level, foam and effects keep working.
 * - The tap on the bar shows the current beer's pump clip.
 * - The crowd fills the pub in three rows as you own more drinkers (see crowdPlan).
 */
import {
  Application, Assets, ColorMatrixFilter, Container, FillGradient, Graphics, Sprite, Texture,
} from 'pixi.js';
import type { BeerLook, GlassShape } from '../../data/beers';
import { DRINKERS } from '../../data/drinkers';
import type { Location } from '../../data/locations';
import {
  GLASS, SCENE_H, SCENE_W, crowdPlan, toWorld, type CrowdFigure, type Pose, type PoseLayout, type Pt,
  type Renderer,
} from '../scene';

const ART = `${import.meta.env.BASE_URL}art/`;

interface GlassArt { half: number[]; liquidBottom: number; aspect: number; centre: number; width: number; height: number }
/** The arm, split at the elbow into two pieces with rounded ends (measured by tools/art.ts). */
interface ArmArt {
  width: number; height: number; elbowX: number; shoulderX: number; centreY: number; radius: number; foreStart: number;
}

interface Manifest {
  arm: ArmArt;
  locations: Record<string, { width: number; height: number; barEdge: number }>;
  crowd: Record<string, { width: number; height: number }>;
  glass: Record<GlassShape, GlassArt>;
  taps: { width: number; height: number }[];
}

/** Backgrounds are 1280×960, exactly the scene's 4:3, so they're shown whole. */
const BG_SCALE = SCENE_W / 1280;
/** The glass stands this far into the bar surface, below its back edge. */
const SURFACE_DEPTH = 8;

/**
 * The regular is a puppet: an armless body (regular.webp, 438×944) and his arm
 * (arm.webp, 627×220), painted together at the same scale, so the arm is never stretched.
 */
// The shoulder joint sits in the middle of his torso, where a real shoulder is.
const REGULAR = { mouth: { x: 391, y: 265 }, shoulder: { x: 190, y: 420 }, scale: 0.15 };
/** His mouth sits this far above the bar surface, and at this x. */
const MOUTH_ABOVE_BAR = 83;
const MOUTH_X = 172;
/** Where the fist grips, in the full arm's source pixels (the arm lies flat, fist on the right). */
const GRIP = { x: 548, y: 90 };

const GLASS_SCALE = 0.68;
const GLASS_REST_X = 198;

const TAP = { x: 336, height: 74 };
const HAND_WRITTEN_TAPS = 31;

/** Row looks: size, how far below the bar edge their (cut-off) waist sits, and depth shading. */
const ROW_STYLE = [
  { height: 82, below: 22, tint: 0xffffff },
  { height: 68, below: 6, tint: 0xc9b9b4 },
  { height: 56, below: 3, tint: 0x8f7f88 },
];

const BUBBLES = [
  { x: -0.5, speed: 0.55, offset: 0.1 }, { x: -0.18, speed: 0.8, offset: 0.6 },
  { x: 0.22, speed: 0.65, offset: 0.35 }, { x: 0.5, speed: 0.9, offset: 0.8 }, { x: 0, speed: 0.5, offset: 0 },
];

/** Same polygon as flat.ts: a band below the liquid surface, `up` units above it, `depth` deep. */
function band(p: Pt, down: Pt, up: number, depth: number): number[] {
  const B = 200;
  const tx = down.y, ty = -down.x;
  const ox = p.x - down.x * up, oy = p.y - down.y * up;
  return [
    ox + tx * B, oy + ty * B,
    ox - tx * B, oy - ty * B,
    ox - tx * B + down.x * depth, oy - ty * B + down.y * depth,
    ox + tx * B + down.x * depth, oy + ty * B + down.y * depth,
  ];
}

/**
 * Two-bone IK. The elbow always bends to the same side (clockwise from shoulder→hand, which
 * is downwards for his arm), so it never flips over when the arm is nearly straight.
 */
function elbowFor(s: Pt, h: Pt, a: number, b: number): Pt {
  const dx = h.x - s.x, dy = h.y - s.y;
  const d = Math.min(Math.hypot(dx, dy), a + b - 0.01);
  const base = Math.atan2(dy, dx);
  const ang = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d || 1))));
  return { x: s.x + a * Math.cos(base + ang), y: s.y + a * Math.sin(base + ang) };
}

/** Half-width of a painted glass at local height ly (the glass is GLASS.H tall locally). */
function profileHalfWidth(half: number[], ly: number): number {
  const t = Math.min(0.999, Math.max(0, (ly + GLASS.H / 2) / GLASS.H)) * half.length - 0.5;
  const i = Math.max(0, Math.min(half.length - 2, Math.floor(t)));
  const f = Math.min(1, Math.max(0, t - i));
  return (half[i] * (1 - f) + half[i + 1] * f) * GLASS.H;
}

/** A soft round glow texture for lamps, beer auras and dust. */
function glowTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

interface Mote { x: number; y: number; vx: number; vy: number; phase: number; sprite: Sprite }

export class PaintedRenderer implements Renderer {
  readonly root: HTMLDivElement;
  private app = new Application();
  private ready = false;
  private resizeObserver?: ResizeObserver;
  private manifest: Manifest | null = null;

  // What the game has asked us to show (applied once assets load).
  private look: BeerLook;
  private beerIndex = 0;
  private location: Location | null = null;
  private ownedFn: ((id: string) => number) | null = null;

  /** Layout for the pose maths; changes with each location's bar height and glass shape. */
  layout: PoseLayout;
  private barEdgeWorld = 203;
  private liquidTop = -GLASS.H / 2 + 3;
  private liquidBottom = GLASS.H / 2 - 5;

  // Layers, back to front.
  private bg = new Sprite();
  private crowdLayer = new Container();
  private regular!: Sprite;
  private bar = new Sprite();
  private tap = new Sprite();
  private tapHue = new ColorMatrixFilter();
  private aura!: Sprite;
  private glass = new Container();
  private liquid = new Graphics();
  private foam = new Graphics();
  private bubbles = new Graphics();
  private glassMask = new Graphics();
  private glassSprite = new Sprite();
  private upperArm!: Sprite;
  private foreArm!: Sprite;
  private lamps: Sprite[] = [];
  private motes: Mote[] = [];
  private beerGradient: FillGradient | null = null;
  private crowdSprites: { s: Sprite; phase: number; feet: number }[] = [];

  constructor(look: BeerLook) {
    this.look = look;
    this.root = document.createElement('div');
    this.root.className = 'art art-painted';
    this.layout = this.layoutFor(203, null);
    void this.init();
  }

  // ---------- setup ----------

  private async init() {
    await this.app.init({
      width: SCENE_W, height: SCENE_H, backgroundAlpha: 0, antialias: true, autoStart: false,
      resolution: 2, autoDensity: false, preference: 'webgl',
    });
    Object.assign(this.app.canvas.style, { width: '100%', height: '100%', display: 'block' });
    this.root.appendChild(this.app.canvas);
    this.resizeObserver = new ResizeObserver(() => this.fitResolution());
    this.resizeObserver.observe(this.root);

    this.manifest = await (await fetch(`${ART}manifest.json`)).json();
    const [regular, upper, fore] = await Promise.all([
      Assets.load<Texture>(`${ART}regular.webp`),
      Assets.load<Texture>(`${ART}arm-upper.webp`),
      Assets.load<Texture>(`${ART}arm-fore.webp`),
    ]);
    this.build(regular, upper, fore);
    this.ready = true;
    this.fitResolution();
    if (this.location) await this.applyLocation(this.location);
    await this.applyBeer(this.look, this.beerIndex);
    await this.placeCrowd();
  }

  private fitResolution() {
    const w = this.root.clientWidth;
    if (!w || !this.ready) return;
    const res = Math.min(4, (w / SCENE_W) * (window.devicePixelRatio || 1));
    if (Math.abs(this.app.renderer.resolution - res) < 0.05) return;
    this.app.renderer.resolution = res;
    this.app.renderer.resize(SCENE_W, SCENE_H);
    Object.assign(this.app.canvas.style, { width: '100%', height: '100%' });
  }

  private build(regularTex: Texture, upperTex: Texture, foreTex: Texture) {
    const stage = this.app.stage;
    const glow = glowTexture();

    this.bg.scale.set(BG_SCALE);
    stage.addChild(this.bg, this.crowdLayer);

    this.regular = new Sprite(regularTex);
    this.regular.anchor.set(REGULAR.mouth.x / regularTex.width, REGULAR.mouth.y / regularTex.height);
    this.regular.scale.set(REGULAR.scale);
    stage.addChild(this.regular);

    this.bar.scale.set(BG_SCALE);
    this.tap.anchor.set(0.5, 1);
    stage.addChild(this.bar, this.tap);

    this.aura = new Sprite(glow);
    this.aura.anchor.set(0.5);
    this.aura.blendMode = 'add';
    this.aura.visible = false;
    stage.addChild(this.aura);

    const inside = new Container();
    inside.addChild(this.liquid, this.bubbles, this.foam);
    inside.mask = this.glassMask;
    this.glass.addChild(inside, this.glassMask, this.glassSprite);
    stage.addChild(this.glass);

    // Arm: upper arm from the shoulder, forearm (with the fist) from the elbow. Both pieces end
    // in a circle centred on the elbow, and both pivot exactly there, so the joint stays whole.
    const arm = this.manifest!.arm;
    this.upperArm = new Sprite(upperTex);
    this.foreArm = new Sprite(foreTex);
    this.upperArm.anchor.set(arm.shoulderX / upperTex.width, arm.centreY / arm.height);
    this.foreArm.anchor.set((arm.elbowX - arm.foreStart) / foreTex.width, arm.centreY / arm.height);
    this.upperArm.scale.set(REGULAR.scale);
    this.foreArm.scale.set(REGULAR.scale);
    stage.addChild(this.upperArm, this.foreArm);

    // Warm lamp light and dust drifting through it.
    for (const x of [78, 330]) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.position.set(x, 42);
      s.tint = 0xffc070;
      s.blendMode = 'add';
      s.scale.set(0.9);
      stage.addChild(s);
      this.lamps.push(s);
    }
    for (let i = 0; i < 36; i++) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.tint = 0xffe2b0;
      s.blendMode = 'add';
      s.scale.set(0.012 + Math.random() * 0.014);
      stage.addChild(s);
      this.motes.push({
        x: Math.random() * SCENE_W, y: 20 + Math.random() * 150,
        vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, phase: Math.random() * 6, sprite: s,
      });
    }
  }

  /** Pose layout for a bar at `barEdge` (world y) and the current glass's painted shape. */
  private layoutFor(barEdge: number, shape: GlassShape | null): PoseLayout {
    const barTop = barEdge + SURFACE_DEPTH;
    const art = shape && this.manifest ? this.manifest.glass[shape] : null;
    return {
      glassScale: GLASS_SCALE,
      restX: GLASS_REST_X,
      barTop,
      mouth: { x: MOUTH_X, y: barTop - MOUTH_ABOVE_BAR },
      mouthTipsBack: false,
      halfWidth: art ? (ly) => profileHalfWidth(art.half, ly) : undefined,
    };
  }

  // ---------- what to show ----------

  setLocation(loc: Location): void {
    this.location = loc;
    if (this.ready) void this.applyLocation(loc);
  }

  private async applyLocation(loc: Location) {
    const m = this.manifest!;
    const id = m.locations[loc.id] ? loc.id : 'redlion';
    const [bg, bar] = await Promise.all([
      Assets.load<Texture>(`${ART}locations/${id}.webp`), Assets.load<Texture>(`${ART}locations/${id}-bar.webp`),
    ]);
    if (this.location !== loc) return; // moved on while loading
    this.bg.texture = bg;
    this.bar.texture = bar;
    this.barEdgeWorld = m.locations[id].barEdge * BG_SCALE;
    this.bar.position.set(0, this.barEdgeWorld);
    this.layout = this.layoutFor(this.barEdgeWorld, this.look.glass);
    await this.placeCrowd();
  }

  setBeer(look: BeerLook, index = this.beerIndex): void {
    this.look = look;
    this.beerIndex = index;
    if (this.ready) void this.applyBeer(look, index);
  }

  private async applyBeer(look: BeerLook, index: number) {
    const shape = look.glass;
    const art = this.manifest!.glass[shape];
    const [glassTex, tapTex] = await Promise.all([
      Assets.load<Texture>(`${ART}glass/${shape}.webp`),
      Assets.load<Texture>(`${ART}taps/${index % HAND_WRITTEN_TAPS}.webp`),
    ]);
    if (this.look !== look) return;

    // Painted glass, scaled so it's GLASS.H tall in glass-local units, rim centred on x = 0.
    this.glassSprite.texture = glassTex;
    this.glassSprite.anchor.set(art.centre, 0);
    this.glassSprite.scale.set(GLASS.H / glassTex.height);
    this.glassSprite.position.set(0, -GLASS.H / 2);

    // The beer is clipped to the inside of the painted shape, from the rim down to the base.
    const top = -GLASS.H / 2;
    const bottom = top + art.liquidBottom * GLASS.H;
    const hw = (ly: number) => Math.max(0.5, profileHalfWidth(art.half, ly) - 1.4);
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let y = top; y <= bottom; y += 1) {
      left.push([-hw(y), y]);
      right.push([hw(y), y]);
    }
    this.glassMask.clear().poly([...left, ...right.reverse()].flat()).fill(0xffffff);
    this.liquidTop = top + 3;
    this.liquidBottom = bottom;

    this.beerGradient?.destroy();
    const w = art.aspect * GLASS.H;
    this.beerGradient = new FillGradient({
      type: 'linear', start: { x: -w / 2, y: 0 }, end: { x: w / 2, y: 0 }, textureSpace: 'global',
      colorStops: [
        { offset: 0, color: look.liquidShade }, { offset: 0.55, color: look.liquid }, { offset: 1, color: look.liquidShade },
      ],
    });

    // Tap for this beer; generated beers reuse a design with a shifted hue.
    this.tap.texture = tapTex;
    this.tap.scale.set(TAP.height / tapTex.height);
    if (index >= HAND_WRITTEN_TAPS) {
      this.tapHue.reset();
      this.tapHue.hue(((index * 137) % 360) - 180, false);
      this.tap.filters = [this.tapHue];
    } else {
      this.tap.filters = [];
    }

    const fx = look.effect;
    this.aura.visible = fx !== 'none';
    this.aura.tint = look.effectColour ?? 0xffffff;
    this.aura.alpha = fx === 'void' || fx === 'singularity' ? 0.55 : 0.35;
    this.layout = this.layoutFor(this.barEdgeWorld, shape);
  }

  private crowdKey = '';

  setCrowd(owned: (id: string) => number): void {
    this.ownedFn = owned;
    if (!this.ready) return;
    const key = JSON.stringify(crowdPlan(DRINKERS, owned));
    if (key === this.crowdKey) return;
    this.crowdKey = key;
    void this.placeCrowd();
  }

  private async placeCrowd() {
    const owned = this.ownedFn;
    const plan: CrowdFigure[] = owned ? crowdPlan(DRINKERS, owned) : [];
    const ids = [...new Set(plan.map((f) => f.id))];
    const textures = await Promise.all(ids.map((id) => Assets.load<Texture>(`${ART}crowd/${id}.webp`)));
    const tex = new Map(ids.map((id, i) => [id, textures[i]]));

    this.crowdLayer.removeChildren();
    // Back row first so the front row overlaps it.
    this.crowdSprites = [...plan].sort((a, b) => b.row - a.row).map((f, i) => {
      const style = ROW_STYLE[f.row];
      const t = tex.get(f.id)!;
      const s = new Sprite(t);
      s.anchor.set(0.5, 1);
      const scale = style.height / t.height;
      s.scale.set(i % 2 ? -scale : scale, scale);
      const feet = this.barEdgeWorld + style.below;
      s.position.set(f.x, feet);
      s.tint = style.tint;
      this.crowdLayer.addChild(s);
      return { s, phase: i * 1.7 + f.x * 0.01, feet };
    });
  }

  // ---------- per frame ----------

  render(pose: Pose, t: number): void {
    if (!this.ready) return;

    // Regular, with his mouth at the layout's spot; he leans back a touch as he drinks.
    const mouth = this.layout.mouth;
    this.regular.position.set(mouth.x, mouth.y);
    this.regular.rotation = -pose.headTilt * 0.35;

    // Tap stands on the bar.
    this.tap.position.set(TAP.x, this.layout.barTop + 2);

    // Glass and beer.
    this.glass.position.set(pose.lip.x, pose.lip.y);
    this.glass.pivot.set(pose.lipLocal.x, pose.lipLocal.y);
    this.glass.rotation = -pose.tilt;
    this.glass.scale.set(pose.scale);
    this.liquid.clear();
    this.foam.clear();
    this.bubbles.clear();
    if (pose.fill > 0.001) {
      const surface = { x: 0, y: this.liquidBottom - pose.fill * (this.liquidBottom - this.liquidTop) };
      this.liquid.poly(band(surface, pose.down, 0, 200)).fill(this.beerGradient ?? this.look.liquid);
      if (pose.foam > 0.2) {
        this.foam.poly(band(surface, pose.down, pose.foam, pose.foam)).fill(this.look.foam);
        this.foam.poly(band(surface, pose.down, pose.foam, Math.min(1.4, pose.foam))).fill({ color: 0xffffff, alpha: 0.6 });
      }
      const w = (this.manifest?.glass[this.look.glass]?.aspect ?? 0.5) * GLASS.H;
      const span = this.liquidBottom - this.liquidTop;
      BUBBLES.forEach((b, i) => {
        const x = b.x * w * 0.5;
        const y = this.liquidBottom - ((t * b.speed + b.offset) % 1) * span;
        const depth = (x - surface.x) * pose.down.x + (y - surface.y) * pose.down.y;
        if (depth > 2) {
          const r = this.look.effect === 'sparkle' ? 0.6 + 1.2 * Math.abs(Math.sin(t * 4 + i)) : 1.1;
          this.bubbles.circle(x, y, r).fill({ color: 0xfff6d8, alpha: 0.75 });
        }
      });
    }
    if (this.aura.visible) {
      const c = toWorld(pose, 0, 0);
      this.aura.position.set(c.x, c.y);
      this.aura.scale.set((0.75 + 0.06 * Math.sin(t * 2.2)) * pose.scale);
    }

    // Arm: the shoulder follows the body; IK to the grip on the glass.
    const rot = this.regular.rotation;
    const ox = (REGULAR.shoulder.x - REGULAR.mouth.x) * REGULAR.scale;
    const oy = (REGULAR.shoulder.y - REGULAR.mouth.y) * REGULAR.scale;
    const sh = { x: mouth.x + ox * Math.cos(rot) - oy * Math.sin(rot), y: mouth.y + ox * Math.sin(rot) + oy * Math.cos(rot) };
    // The fist sits a little above the sleeve's centre line, so the forearm's reach is the
    // elbow→fist distance and it's turned by that angle to put the fist on the glass.
    const arm = this.manifest!.arm;
    const gx = (GRIP.x - arm.elbowX) * REGULAR.scale, gy = (GRIP.y - arm.centreY) * REGULAR.scale;
    const upper = (arm.elbowX - arm.shoulderX) * REGULAR.scale;
    const fore = Math.hypot(gx, gy);
    const hand = pose.hand;
    const elbow = elbowFor(sh, hand, upper, fore);
    this.upperArm.position.set(sh.x, sh.y);
    this.upperArm.rotation = Math.atan2(elbow.y - sh.y, elbow.x - sh.x);
    this.foreArm.position.set(elbow.x, elbow.y);
    this.foreArm.rotation = Math.atan2(hand.y - elbow.y, hand.x - elbow.x) - Math.atan2(gy, gx);

    // Crowd: a gentle bob and sway.
    for (const c of this.crowdSprites) {
      c.s.y = c.feet + Math.sin(t * 1.5 + c.phase) * 0.9;
      c.s.rotation = Math.sin(t * 0.7 + c.phase) * 0.02;
    }

    // Atmosphere.
    this.lamps.forEach((l, i) => (l.alpha = 0.32 + 0.05 * Math.sin(t * 7.3 + i * 2) + 0.02 * Math.sin(t * 17 + i)));
    for (const m of this.motes) {
      m.x += m.vx * 0.016;
      m.y += m.vy * 0.016;
      if (m.y < 10 || m.x < 0 || m.x > SCENE_W) {
        m.x = Math.random() * SCENE_W;
        m.y = 120 + Math.random() * 40;
      }
      m.sprite.position.set(m.x + Math.sin(t + m.phase) * 3, m.y);
      m.sprite.alpha = 0.2 + 0.3 * Math.abs(Math.sin(t * 0.8 + m.phase));
    }

    this.app.render();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.root.remove();
    if (this.ready) this.app.destroy(true, { children: true });
  }
}
