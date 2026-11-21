/**
 * Scene geometry and the drinking pose, in "world units" (a 400×300 stage).
 * Kept separate from the renderer so the maths stays testable and art-agnostic.
 */
import { easeLift, foamFor, tiltFor, type DrinkState } from '../core/drinking';
import type { BeerLook, GlassShape } from '../data/beers';
import type { Drinker } from '../data/drinkers';
import type { Location } from '../data/locations';

export const SCENE_W = 400;
export const SCENE_H = 300;
export const BAR_TOP = 212;

export interface Pt { x: number; y: number }

/** Glass in local coords: x across, y from -H/2 (rim) to +H/2 (base). */
export const GLASS = { W: 36, H: 60, WALL: 1.6, BASE: 5 };
const TOP = -GLASS.H / 2;
const BOT = GLASS.H / 2;
export const INNER_TOP = TOP;
export const INNER_BOT = BOT - GLASS.BASE;

/** Width profiles as [t, fraction of W/2] control points, t = 0 at the rim, 1 at the base. */
const PROFILES: Record<Exclude<GlassShape, 'nonic'>, [number, number][]> = {
  // A dimpled mug: a gentle barrel.
  tankard: [[0, 1.0], [0.5, 1.07], [1, 0.98]],
  // Stemmed glasses: a bowl, a thin stem, then a foot.
  tulip: [[0, 0.84], [0.16, 0.78], [0.46, 1.0], [0.7, 0.84], [0.8, 0.4], [0.84, 0.1], [0.945, 0.1], [0.97, 0.56], [1, 0.62]],
  snifter: [[0, 0.6], [0.2, 0.84], [0.5, 1.08], [0.68, 0.9], [0.78, 0.42], [0.82, 0.1], [0.945, 0.1], [0.97, 0.56], [1, 0.62]],
};

/** Where the beer stops, as a fraction of the glass height: the base, or the top of the stem. */
export const LIQUID_BOTTOM: Record<GlassShape, number> = { nonic: 0.92, tankard: 0.91, tulip: 0.79, snifter: 0.77 };

/** Outer half-width at height ly for a glass shape. */
export function halfWidth(ly: number, shape: GlassShape = 'nonic'): number {
  const t = Math.min(1, Math.max(0, (ly - TOP) / GLASS.H)); // 0 at rim, 1 at base
  if (shape === 'nonic') {
    // Tapers towards the base, with the nonic bulge near the top.
    let hw = (GLASS.W / 2) * (1 - 0.2 * t);
    if (t > 0.1 && t < 0.32) hw += 1.8 * Math.sin((Math.PI * (t - 0.1)) / 0.22) ** 2;
    return hw;
  }
  const pts = PROFILES[shape];
  for (let i = 1; i < pts.length; i++) {
    const [t0, w0] = pts[i - 1];
    const [t1, w1] = pts[i];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0 || 1);
      const smooth = u * u * (3 - 2 * u);
      return (GLASS.W / 2) * (w0 + (w1 - w0) * smooth);
    }
  }
  return (GLASS.W / 2) * pts[pts.length - 1][1];
}

/** The rim point that touches your lips; the glass pivots around it. */
type HalfWidth = (ly: number, shape: GlassShape) => number;
export const lipLocal = (shape: GlassShape, hw: HalfWidth = halfWidth): Pt => ({ x: -hw(TOP, shape), y: TOP });

// Character (a regular in a flat cap, facing right)
export const HEAD = { x: 150, y: 106, r: 26 };
export const NECK: Pt = { x: 150, y: 134 };
export const SHOULDER: Pt = { x: 148, y: 150 };
export const UPPER_ARM = 46;
export const FOREARM = 46;
const HEAD_TILT_MAX = 0.22; // radians, head tips back as you drink

/**
 * Per-art-style layout: how big the glass is, where it stands on the bar, and where his mouth
 * is. The flat style uses the defaults; the painted style has a smaller pint closer to him.
 */
export interface PoseLayout {
  glassScale: number;
  /** x of the glass's centre when it's standing on the bar. */
  restX: number;
  /** y of the bar surface the glass stands on. */
  barTop: number;
  mouth: Pt;
  /** Whether the mouth moves as the head tips back (flat style), or stays put (painted). */
  mouthTipsBack: boolean;
  /** Glass outline override (painted glasses measure their own shape). */
  halfWidth?: (ly: number, shape: GlassShape) => number;
}

export const DEFAULT_LAYOUT: PoseLayout = {
  glassScale: 1, restX: 245, barTop: BAR_TOP, mouth: { x: 175, y: 116 }, mouthTipsBack: true,
};
/** Where on the glass the hand holds it (local coords): the widest part of the body. */
function gripLocal(shape: GlassShape, hw: HalfWidth = halfWidth): Pt {
  const y = shape === 'nonic' || shape === 'tankard' ? 4 : 0;
  return { x: -hw(y, shape) - 1, y };
}

export interface Pose {
  shape: GlassShape;
  /** Glass size multiplier (local glass units × scale = world units). */
  scale: number;
  /** Glass-local point the glass pivots around (the rim at your lips). */
  lipLocal: Pt;
  lip: Pt;
  /** Glass tilt in radians (positive = tipped towards your face). */
  tilt: number;
  hand: Pt;
  elbow: Pt;
  headTilt: number;
  /** Liquid surface: a point and the world-down direction, both in glass-local coords. */
  surface: Pt;
  down: Pt;
  fill: number;
  /** Foam thickness in world units. */
  foam: number;
  refilling: boolean;
  /** Glass is at the lips and draining. */
  sipping: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rotateAround(p: Pt, c: Pt, angle: number): Pt {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** Glass-local → world. The glass is rotated by -tilt (anticlockwise on screen) about the lip. */
export function toWorld(pose: Pose, lx: number, ly: number): Pt {
  const a = -pose.tilt;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = (lx - pose.lipLocal.x) * pose.scale, dy = (ly - pose.lipLocal.y) * pose.scale;
  return { x: pose.lip.x + dx * cos - dy * sin, y: pose.lip.y + dx * sin + dy * cos };
}

/** World → glass-local. */
export function toLocal(pose: Pose, wx: number, wy: number): Pt {
  const a = pose.tilt;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = (wx - pose.lip.x) / pose.scale, dy = (wy - pose.lip.y) / pose.scale;
  return { x: pose.lipLocal.x + dx * cos - dy * sin, y: pose.lipLocal.y + dx * sin + dy * cos };
}

/** Signed distance below the liquid surface (positive = in the beer). */
export function depthBelowSurface(pose: Pose, lx: number, ly: number): number {
  return (lx - pose.surface.x) * pose.down.x + (ly - pose.surface.y) * pose.down.y;
}

/** Two-bone IK: elbow position for a shoulder→hand reach, bending downwards. */
function solveElbow(s: Pt, h: Pt): Pt {
  const dx = h.x - s.x, dy = h.y - s.y;
  const d = Math.min(Math.hypot(dx, dy), UPPER_ARM + FOREARM - 0.01);
  const base = Math.atan2(dy, dx);
  const cosA = (UPPER_ARM * UPPER_ARM + d * d - FOREARM * FOREARM) / (2 * UPPER_ARM * d || 1);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const e1 = { x: s.x + UPPER_ARM * Math.cos(base + a), y: s.y + UPPER_ARM * Math.sin(base + a) };
  const e2 = { x: s.x + UPPER_ARM * Math.cos(base - a), y: s.y + UPPER_ARM * Math.sin(base - a) };
  return e1.y > e2.y ? e1 : e2;
}

export function computePose(
  ds: DrinkState, shape: GlassShape = 'nonic', foamScale = 1, layout: PoseLayout = DEFAULT_LAYOUT,
): Pose {
  const e = easeLift(ds.lift);
  const s = layout.glassScale;
  const hw: HalfWidth = layout.halfWidth ?? halfWidth;
  const lipL = lipLocal(shape, hw);
  const restLip = { x: layout.restX + lipL.x * s, y: layout.barTop - GLASS.H * s };
  const tilt = tiltFor(ds);
  const headTilt = HEAD_TILT_MAX * e;
  // The mouth moves as the head tips back, so aim for where it will be.
  const mouth = layout.mouthTipsBack ? rotateAround(layout.mouth, NECK, -HEAD_TILT_MAX) : layout.mouth;
  const lip = { x: lerp(restLip.x, mouth.x, e), y: lerp(restLip.y, mouth.y, e) };

  const pose: Pose = {
    shape,
    scale: s,
    lipLocal: lipL,
    lip,
    tilt,
    hand: { x: 0, y: 0 },
    elbow: { x: 0, y: 0 },
    headTilt,
    // Level line through the glass axis; for a near-cylinder this keeps the volume right as it tips.
    surface: { x: 0, y: INNER_BOT - ds.fill * (INNER_BOT - (INNER_TOP + 6)) },
    down: { x: -Math.sin(tilt), y: Math.cos(tilt) },
    fill: ds.fill,
    foam: foamFor(ds) * GLASS.H * foamScale,
    refilling: ds.refilling,
    sipping: ds.lift >= 0.85 && !ds.refilling && ds.fill > 0,
  };
  const grip = gripLocal(shape, hw);
  pose.hand = toWorld(pose, grip.x, grip.y);
  pose.elbow = solveElbow(SHOULDER, pose.hand);
  return pose;
}

/** Head-local ↔ world helpers for the head tipped back about the neck. */
export function headToWorld(headTilt: number, hx: number, hy: number): Pt {
  return rotateAround({ x: HEAD.x + hx, y: HEAD.y + hy }, NECK, -headTilt);
}
export function worldToHead(headTilt: number, wx: number, wy: number): Pt {
  const p = rotateAround({ x: wx, y: wy }, NECK, headTilt);
  return { x: p.x - HEAD.x, y: p.y - HEAD.y };
}

/** Where "+N pints" popups start: the top of the glass, in world units. */
export function popupAnchor(pose: Pose): Pt {
  return toWorld(pose, 0, TOP);
}

export interface Renderer {
  readonly root: HTMLElement | SVGElement;
  /** Glass size and placement for this art style. */
  readonly layout: PoseLayout;
  /** Swap the beer in the glass (colour, head, glass shape, effects). */
  setBeer(look: BeerLook, index?: number): void;
  /** Move the pub. */
  setLocation(loc: Location): void;
  /**
   * Who's in the pub: how many of each drinker type you own. Called often; the renderer
   * works out its own line-up and only changes it when it would look different.
   */
  setCrowd(owned: (id: string) => number): void;
  /** The current chug streak, so the scene can get merrier with it. */
  setStreak(count: number): void;
  /** The pub cheers. 1 = a raised glass, 2 = a proper celebration. */
  cheer(strength?: number): void;
  /** A point in world units, as fractions of the stage (for DOM popups over the canvas). */
  project(p: Pt): Pt;
  render(pose: Pose, t: number): void;
  destroy(): void;
}

/**
 * Who stands behind the bar: each drinker type you own gets 1–3 figures (more at 10 and 100
 * owned), newest tiers first when there isn't room, then mixed up so types don't bunch together.
 */
export function pickCrowd(drinkers: readonly Drinker[], owned: (id: string) => number, slots = 7): Drinker[] {
  const picked: Drinker[] = [];
  for (const d of [...drinkers].reverse()) {
    const n = owned(d.id);
    if (n <= 0) continue;
    const copies = 1 + (n >= 10 ? 1 : 0) + (n >= 100 ? 1 : 0);
    for (let i = 0; i < copies && picked.length < slots; i++) picked.push(d);
  }
  // Deterministic shuffle so the line-up only changes when what you own changes.
  const key = (d: Drinker, i: number) => {
    let h = i * 2654435761;
    for (const ch of d.id) h = Math.imul(h ^ ch.charCodeAt(0), 2246822519);
    return h >>> 0;
  };
  return picked.map((d, i) => ({ d, k: key(d, i) })).sort((a, b) => a.k - b.k).map((x) => x.d);
}

// ---------- crowd plan ----------

export interface CrowdFigure {
  id: string;
  /** 0 = front row, nearest the bar, 1 = middle, 2 = back. */
  row: 0 | 1 | 2;
  x: number;
}

/**
 * Spots in each row, front to back, in world x (the scene is centred on 200 and wide stages
 * show well beyond 0..400). The front row stays clear of you, your pint and the pump.
 */
export const CROWD_ROWS: number[][] = [
  [-96, -22, 50, 340, 412, 486],
  [-152, -102, -50, 2, 56, 330, 382, 434, 486, 538],
  [-170, -132, -94, -56, -18, 20, 58, 96, 134, 172, 210, 248, 286, 324, 362, 400, 438, 476, 514, 552],
];
export const CROWD_CAPACITY = CROWD_ROWS.reduce((n, r) => n + r.length, 0);

/** How many figures to show for this many drinkers: the pub fills up on a log scale. */
export const crowdSize = (total: number): number =>
  total <= 0 ? 0 : Math.min(CROWD_CAPACITY, Math.max(1, Math.round(3 * Math.log10(total + 1))), Math.ceil(total));

/**
 * Who stands where. Every owned type gets at least one figure (newest types first if there
 * isn't room), the rest are shared out by sqrt(count) so a huge type dominates without
 * hiding the others. Figures are dealt round-robin so the front row shows the variety.
 */
export function crowdPlan(drinkers: readonly Drinker[], owned: (id: string) => number): CrowdFigure[] {
  const present = drinkers.map((d, tier) => ({ id: d.id, n: owned(d.id), tier })).filter((t) => t.n > 0);
  const total = present.reduce((sum, t) => sum + t.n, 0);
  const size = crowdSize(total);
  if (!size) return [];

  // Newest first when there isn't room for every type.
  const types = [...present].sort((a, b) => b.tier - a.tier).slice(0, size);
  const weights = types.map((t) => Math.sqrt(t.n) * (1 + t.tier * 0.1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const counts = types.map(() => 1);
  let left = size - types.length;
  const shares = weights.map((w) => (w / wsum) * left);
  types.forEach((_, i) => (counts[i] += Math.floor(shares[i])));
  left = size - counts.reduce((a, b) => a + b, 0);
  shares
    .map((sh, i) => ({ i, rem: sh - Math.floor(sh) }))
    .sort((a, b) => b.rem - a.rem)
    .slice(0, left)
    .forEach(({ i }) => counts[i]++);

  // Deal round-robin, most numerous type first.
  const order = types.map((t, i) => ({ id: t.id, count: counts[i] })).sort((a, b) => b.count - a.count);
  const dealt: string[] = [];
  for (let round = 0; dealt.length < size; round++) {
    for (const o of order) if (round < o.count) dealt.push(o.id);
  }

  return crowdSpots().slice(0, dealt.length).map((spot, i) => ({ id: dealt[i], ...spot }));
}

/**
 * Every place someone can stand, in the order they fill up: front row first, and within a row
 * from the middle outwards (so a narrow stage sees the first arrivals), with a stable scatter so
 * it looks natural rather than symmetrical.
 */
export function crowdSpots(): { row: 0 | 1 | 2; x: number }[] {
  const out: { row: 0 | 1 | 2; x: number }[] = [];
  for (const [row, spots] of CROWD_ROWS.entries()) {
    const ordered = spots
      .map((x, i) => ({ x, key: Math.abs(x - 200) + 70 * Math.abs(Math.sin(i * 12.9898 + row * 78.233)) }))
      .sort((a, b) => a.key - b.key);
    for (const spot of ordered) out.push({ row: row as 0 | 1 | 2, x: spot.x });
  }
  return out;
}
