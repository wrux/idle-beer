/** Small canvas toolkit shared by every part of the scene: colours, easing, shapes and glows. */

export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
/** Overshoots a little past 1 before settling: for things that pop in. */
export const backOut = (t: number) => {
  const c = clamp(t) - 1;
  return 1 + c * c * (2.70158 * c + 1.70158);
};
/** 0 → 1 → 0 over t = 0..1. */
export const arc = (t: number) => Math.sin(clamp(t) * Math.PI);
/** Move `v` towards `target` at `rate` per second, frame-rate independent. */
export const approach = (v: number, target: number, rate: number, dt: number) =>
  target + (v - target) * Math.exp(-rate * dt);

/** Deterministic 0..1 from an integer or two. */
export function hash(a: number, b = 0): number {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Seeded random stream. */
export function rng(seed: number): () => number {
  let i = 0;
  return () => hash(seed, ++i);
}

// ---------- colour ----------

type RGB = [number, number, number];
const parsed = new Map<string, RGB>();

export function rgb(c: string): RGB {
  let v = parsed.get(c);
  if (v) return v;
  if (c[0] === '#') {
    const h = c.length === 4 ? c.replace(/[0-9a-f]/gi, '$&$&') : c;
    const n = parseInt(h.slice(1, 7), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const m = c.match(/[\d.]+/g) ?? ['0', '0', '0'];
    v = [+m[0], +m[1], +m[2]];
  }
  parsed.set(c, v);
  return v;
}

const mixed = new Map<string, string>();
/** Blend a towards b. Results are cached, so this is cheap to call while drawing. */
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  const q = Math.round(clamp(t) * 64);
  const key = `${a}|${b}|${q}`;
  let out = mixed.get(key);
  if (!out) {
    const A = rgb(a), B = rgb(b), u = q / 64;
    out = `rgb(${Math.round(lerp(A[0], B[0], u))},${Math.round(lerp(A[1], B[1], u))},${Math.round(lerp(A[2], B[2], u))})`;
    if (mixed.size > 6000) mixed.clear();
    mixed.set(key, out);
  }
  return out;
}

/** Shadow side of a colour: darker and a touch cooler, which reads richer than plain black. */
export const shade = (c: string, t = 0.25) => mix(c, '#1a0f2b', t);
export const tint = (c: string, t = 0.25) => mix(c, '#fff6e0', t);
export function alpha(c: string, a: number): string {
  const v = rgb(c);
  return `rgba(${v[0]},${v[1]},${v[2]},${clamp(a).toFixed(3)})`;
}
export function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
}

// ---------- shapes ----------

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, r = 0) {
  ctx.beginPath();
  if (r > 0) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Closed polygon from a flat list of x,y pairs. */
export function poly(ctx: Ctx, pts: number[], fill?: string | CanvasGradient) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

/** A smooth closed curve through the points (flat x,y list): for anything organic. */
export function blob(ctx: Ctx, pts: number[], fill?: string | CanvasGradient, tension = 0.5) {
  const n = pts.length / 2;
  const P = (i: number) => {
    const k = ((i % n) + n) % n;
    return [pts[k * 2], pts[k * 2 + 1]];
  };
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

/** A smooth open curve through the points, stroked. */
export function curve(ctx: Ctx, pts: number[], stroke: string, width: number, cap: CanvasLineCap = 'round') {
  const n = pts.length / 2;
  const P = (i: number) => {
    const k = clamp(i, 0, n - 1);
    return [pts[k * 2], pts[k * 2 + 1]];
  };
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
    ctx.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stroke: string, width: number, cap: CanvasLineCap = 'round') {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.stroke();
}

/** A limb: a capsule that can taper from one end to the other. */
export function limb(ctx: Ctx, ax: number, ay: number, bx: number, by: number, ra: number, rb: number, fill: string) {
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / d, ny = (bx - ax) / d;
  const a = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.arc(ax, ay, ra, a, a + Math.PI);
  ctx.arc(bx, by, rb, a + Math.PI, a + TAU);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Trace a (possibly tapered) capsule without filling it. */
export function capsule(ctx: Ctx, ax: number, ay: number, bx: number, by: number, ra: number, rb: number) {
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const a = Math.atan2((bx - ax) / d, -(by - ay) / d);
  ctx.beginPath();
  ctx.arc(ax, ay, ra, a, a + Math.PI);
  ctx.arc(bx, by, rb, a + Math.PI, a + TAU);
  ctx.closePath();
}

/** Trace a smooth closed curve through points without filling it. */
export function blobPath(ctx: Ctx, pts: number[], tension = 0.5) {
  blob(ctx, pts, undefined, tension);
}

export function vgrad(ctx: Ctx, y0: number, y1: number, stops: (string | number)[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  addStops(g, stops);
  return g;
}
export function hgrad(ctx: Ctx, x0: number, x1: number, stops: (string | number)[]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  addStops(g, stops);
  return g;
}
export function rgrad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: (string | number)[]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, Math.max(r0 + 0.01, r1));
  addStops(g, stops);
  return g;
}
/** Stops are either evenly spaced colours, or offset, colour pairs. */
function addStops(g: CanvasGradient, stops: (string | number)[]) {
  if (typeof stops[0] === 'number') {
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i] as number, stops[i + 1] as string);
  } else {
    stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c as string));
  }
}

// ---------- light ----------

const glowSprites = new Map<string, HTMLCanvasElement>();
function glowSprite(colour: string): HTMLCanvasElement {
  let c = glowSprites.get(colour);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, alpha(colour, 1));
    grad.addColorStop(0.25, alpha(colour, 0.55));
    grad.addColorStop(0.6, alpha(colour, 0.14));
    grad.addColorStop(1, alpha(colour, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    glowSprites.set(colour, c);
  }
  return c;
}

/** A soft additive light. Cheap: it's a cached sprite, so use it freely for lamps and sparks. */
export function glow(ctx: Ctx, x: number, y: number, r: number, colour: string, a = 1, sy = 1) {
  if (a <= 0.003 || r <= 0) return;
  const prevA = ctx.globalAlpha, prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = prevA * clamp(a);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(colour), x - r, y - r * sy, r * 2, r * 2 * sy);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/** A four-point twinkle. */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, colour: string, a = 1) {
  if (a <= 0.01 || r <= 0.05) return;
  const k = r * 0.18;
  ctx.globalAlpha *= clamp(a);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.globalAlpha /= clamp(a);
}

/** Run `fn` with a saved state, translated, rotated and scaled. */
export function at(ctx: Ctx, x: number, y: number, rot: number, sx: number, sy: number, fn: () => void) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  fn();
  ctx.restore();
}

/** What part of the world the canvas is showing. */
export interface View {
  /** Left and right edges in world units; the scene is centred on x = 200. */
  x0: number;
  x1: number;
  /** Top edge (0, or negative when the stage is taller than 4:3). */
  y0: number;
  w: number;
}
