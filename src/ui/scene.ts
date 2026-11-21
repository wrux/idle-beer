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
  tankard: [[0, 1.04], [1, 1.04]],
  tulip: [[0, 0.9], [0.18, 0.8], [0.5, 1.0], [0.8, 0.72], [0.92, 0.3], [1, 0.62]],
  snifter: [[0, 0.62], [0.2, 0.82], [0.55, 1.08], [0.8, 0.8], [0.9, 0.24], [1, 0.62]],
};

/** Outer half-width at height ly for a glass shape. */
export function halfWidth(ly: number, shape: GlassShape = 'nonic'): number {
  const t = Math.min(1, Math.max(0, (ly - TOP) / GLASS.H)); // 0 at rim, 1 at base
  if (shape === 'nonic') {
    // Tapers towards the base, with the nonic bulge near the top.
    let hw = (GLASS.W / 2) * (1 - 0.16 * t);
    if (t > 0.1 && t < 0.28) hw += 1.6 * Math.sin((Math.PI * (t - 0.1)) / 0.18);
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
export const lipLocal = (shape: GlassShape): Pt => ({ x: -halfWidth(TOP, shape), y: TOP });

// Character (a regular in a flat cap, facing right)
export const HEAD = { x: 150, y: 106, r: 26 };
export const NECK: Pt = { x: 150, y: 134 };
export const SHOULDER: Pt = { x: 148, y: 150 };
export const UPPER_ARM = 46;
export const FOREARM = 46;
const MOUTH: Pt = { x: 175, y: 116 };
const HEAD_TILT_MAX = 0.22; // radians, head tips back as you drink

/** Glass standing on the bar: centre x 245, base on the bar top. */
const GLASS_REST_X = 245;
/** Where on the glass the hand holds it (local coords): the widest part of the body. */
function gripLocal(shape: GlassShape): Pt {
  const y = shape === 'nonic' || shape === 'tankard' ? 4 : 0;
  return { x: -halfWidth(y, shape) - 1, y };
}

export interface Pose {
  shape: GlassShape;
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
  const dx = lx - pose.lipLocal.x, dy = ly - pose.lipLocal.y;
  return { x: pose.lip.x + dx * cos - dy * sin, y: pose.lip.y + dx * sin + dy * cos };
}

/** World → glass-local. */
export function toLocal(pose: Pose, wx: number, wy: number): Pt {
  const a = pose.tilt;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = wx - pose.lip.x, dy = wy - pose.lip.y;
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

export function computePose(ds: DrinkState, shape: GlassShape = 'nonic', foamScale = 1): Pose {
  const e = easeLift(ds.lift);
  const lipL = lipLocal(shape);
  const restLip = { x: GLASS_REST_X + lipL.x, y: BAR_TOP - GLASS.H };
  const tilt = tiltFor(ds);
  const headTilt = HEAD_TILT_MAX * e;
  // The mouth moves as the head tips back, so aim for where it will be.
  const mouth = rotateAround(MOUTH, NECK, -HEAD_TILT_MAX);
  const lip = { x: lerp(restLip.x, mouth.x, e), y: lerp(restLip.y, mouth.y, e) };

  const pose: Pose = {
    shape,
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
  const grip = gripLocal(shape);
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

/** Where "+N pints" popups start, as a fraction of the stage. */
export function popupAnchor(pose: Pose): Pt {
  const top = toWorld(pose, 0, TOP);
  return { x: top.x / SCENE_W, y: top.y / SCENE_H };
}

export interface Renderer {
  readonly root: HTMLElement | SVGElement;
  /** Swap the beer in the glass (colour, head, glass shape, effects). */
  setBeer(look: BeerLook): void;
  /** Move the pub (sign, walls, window view). */
  setLocation(loc: Location): void;
  /** Who's standing behind the bar. */
  setCrowd(drinkers: Drinker[]): void;
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
