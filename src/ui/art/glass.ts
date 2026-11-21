/**
 * The pint: glass, beer, head, bubbles and each beer's special effect.
 * Everything is drawn in glass-local units (x across, y from -30 at the rim to +30 at the base),
 * so the caller only has to position, tilt and scale the canvas.
 */
import type { BeerLook, GlassShape } from '../../data/beers';
import { GLASS, LIQUID_BOTTOM, halfWidth, type Pt } from '../scene';
import {
  TAU, alpha, circle, clamp, ellipse, glow, hash, hgrad, lerp, mix, shade, sparkle, tint, vgrad, type Ctx,
} from './draw';

const TOP = -GLASS.H / 2;
const BOT = GLASS.H / 2;
const liquidBottom = (shape: GlassShape) => TOP + LIQUID_BOTTOM[shape] * GLASS.H;

/** Trace the glass outline between two heights, inset from the wall. */
function trace(ctx: Ctx, shape: GlassShape, inset: number, top: number, bottom: number) {
  ctx.beginPath();
  for (let y = top; y <= bottom + 0.001; y += 0.75) ctx.lineTo(-Math.max(0.4, halfWidth(y, shape) - inset), y);
  for (let y = bottom; y >= top - 0.001; y -= 0.75) ctx.lineTo(Math.max(0.4, halfWidth(y, shape) - inset), y);
  ctx.closePath();
}

export interface GlassDraw {
  look: BeerLook;
  /** 0 empty … 1 full. */
  fill: number;
  /** Head thickness in local units. */
  foam: number;
  /** World-down in glass-local coords (unit vector); tilts the surface as the glass tips. */
  down: Pt;
  /** Extra surface tilt from movement, radians. */
  slosh: number;
  t: number;
  /** A fresh pint is being pulled: more fizz, a livelier head. */
  pouring: boolean;
  /** How much of the room's light catches the glass (dim space bars vs a sunny garden). */
  shine?: number;
}

const BUBBLES = Array.from({ length: 14 }, (_, i) => ({
  x: hash(i, 1) * 2 - 1, speed: 0.25 + hash(i, 2) * 0.5, offset: hash(i, 3), r: 0.45 + hash(i, 4) * 0.7, wob: hash(i, 5) * TAU,
}));

/** Light and distortion behind the glass, for the more unusual beers. */
export function drawGlassAura(ctx: Ctx, look: BeerLook, t: number) {
  const fx = look.effect;
  const c = look.effectColour ?? '#ffffff';
  if (fx === 'glow' || fx === 'sparkle') {
    glow(ctx, 0, 2, 46 + 4 * Math.sin(t * 2.1), c, 0.34 + 0.08 * Math.sin(t * 2.1));
  } else if (fx === 'shimmer') {
    glow(ctx, 0, 2, 40, c, 0.2 + 0.06 * Math.sin(t * 1.3));
  } else if (fx === 'void' || fx === 'singularity') {
    // A dark well with a bright edge, pulling in motes of light.
    ctx.fillStyle = (() => {
      const g = ctx.createRadialGradient(0, 2, 6, 0, 2, 50);
      g.addColorStop(0, 'rgba(4,2,12,0.75)');
      g.addColorStop(0.6, 'rgba(8,4,22,0.4)');
      g.addColorStop(1, 'rgba(8,4,22,0)');
      return g;
    })();
    ctx.fillRect(-52, -50, 104, 104);
    glow(ctx, 0, 2, 58, c, 0.22 + 0.05 * Math.sin(t * 1.7));
    for (let i = 0; i < 10; i++) {
      const p = (t * (0.18 + hash(i, 9) * 0.2) + hash(i, 8)) % 1;
      const a = hash(i, 7) * TAU + p * 2.2;
      const r = lerp(50, 14, p * p);
      glow(ctx, Math.cos(a) * r, 2 + Math.sin(a) * r * 0.8, 2.6 * (1 - p) + 0.8, c, 0.9 * arcFade(p));
    }
    if (fx === 'singularity') {
      // The back half of the accretion ring; the front half goes over the glass.
      ring(ctx, c, t, false);
    }
  }
}

const arcFade = (p: number) => Math.min(1, p * 5, (1 - p) * 3);

function ring(ctx: Ctx, c: string, t: number, front: boolean) {
  ctx.save();
  ctx.translate(0, 4);
  ctx.rotate(-0.28 + 0.05 * Math.sin(t * 0.7));
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 34 + i * 5, 8 + i * 1.6, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.strokeStyle = alpha(i === 0 ? '#ffffff' : c, [0.75, 0.4, 0.18][i]);
    ctx.lineWidth = [1.1, 2.2, 3.4][i];
    ctx.stroke();
  }
  // Bright clumps orbiting in the ring.
  for (let i = 0; i < 5; i++) {
    const a = t * (1.1 + i * 0.13) + i * 1.26;
    const inFront = Math.sin(a) > 0;
    if (inFront === front) glow(ctx, Math.cos(a) * 37, Math.sin(a) * 9, 4, c, 0.9);
  }
  ctx.restore();
}

export function drawGlass(ctx: Ctx, g: GlassDraw) {
  const { look, t } = g;
  const shape = look.glass;
  const fx = look.effect;
  const fxc = look.effectColour ?? '#ffffff';
  const shine = g.shine ?? 1;
  const lb = liquidBottom(shape);
  const lt = TOP + 2.5;
  const dark = fx === 'void' || fx === 'singularity';

  // The body of the glass: a faint cool tint so it reads against any background.
  trace(ctx, shape, 0, TOP, BOT);
  ctx.fillStyle = 'rgba(214,236,246,0.13)';
  ctx.fill();

  // Tankard handle sits behind the beer, on the side away from the drinker.
  if (shape === 'tankard') {
    const hw = halfWidth(0, shape);
    ctx.beginPath();
    ctx.moveTo(hw - 1, -17);
    ctx.bezierCurveTo(hw + 17, -19, hw + 17, 15, hw - 1, 13);
    ctx.strokeStyle = 'rgba(226,242,250,0.5)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * shine})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ----- beer -----
  ctx.save();
  trace(ctx, shape, GLASS.WALL, TOP + 0.6, lb);
  ctx.clip();

  // Surface: a line through `s`, tilted by the glass and by slosh.
  const cs = Math.cos(g.slosh), sn = Math.sin(g.slosh);
  const dx = g.down.x * cs - g.down.y * sn, dy = g.down.x * sn + g.down.y * cs;
  const tx = dy, ty = -dx; // along the surface
  const s = { x: 0, y: lb - g.fill * (lb - lt) };
  const band = (up: number, depth: number) => {
    const B = 90, ox = s.x - dx * up, oy = s.y - dy * up;
    ctx.beginPath();
    ctx.moveTo(ox + tx * B, oy + ty * B);
    ctx.lineTo(ox - tx * B, oy - ty * B);
    ctx.lineTo(ox - tx * B + dx * depth, oy - ty * B + dy * depth);
    ctx.lineTo(ox + tx * B + dx * depth, oy + ty * B + dy * depth);
    ctx.closePath();
  };

  if (g.fill > 0.002) {
    // Thin film of head left on the glass above the beer.
    ctx.fillStyle = alpha(look.foam, 0.1);
    ctx.fillRect(-30, TOP, 60, GLASS.H);

    band(0, 140);
    ctx.fillStyle = hgrad(ctx, -GLASS.W / 2, GLASS.W / 2, [
      0, shade(look.liquidShade, 0.18), 0.22, look.liquidShade, 0.5, look.liquid,
      0.68, dark ? look.liquid : tint(look.liquid, 0.14), 1, look.liquidShade,
    ]);
    ctx.fill();
    // Light pooling at the bottom of the glass, as it does in a real pint.
    if (!dark) {
      ctx.fillStyle = vgrad(ctx, lb - 16, lb, [alpha(tint(look.liquid, 0.5), 0), alpha(tint(look.liquid, 0.5), 0.3 * shine)]);
      ctx.fillRect(-30, lb - 16, 60, 16);
    }

    // Special beers.
    if (fx === 'shimmer') {
      const p = (t * 0.4) % 1;
      ctx.save();
      ctx.transform(1, 0, -0.5, 1, 0, 0);
      const x = lerp(-50, 50, p);
      ctx.fillStyle = hgrad(ctx, x - 9, x + 9, [alpha(fxc, 0), alpha(fxc, 0.6), alpha(fxc, 0)]);
      ctx.fillRect(x - 9, TOP, 18, GLASS.H);
      ctx.restore();
    }
    if (dark) {
      // A little night sky in the glass.
      for (let i = 0; i < 12; i++) {
        const x = (hash(i, 21) * 2 - 1) * 14, y = lerp(lt, lb, hash(i, 22));
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (1 + hash(i, 23) * 2) + i));
        circle(ctx, x, y, 0.35 + hash(i, 24) * 0.5, alpha(i % 3 ? '#ffffff' : fxc, tw));
      }
      glow(ctx, Math.sin(t * 0.6) * 5, lerp(lt, lb, 0.55), 14, fxc, 0.3);
    }

    // Bubbles rising and wobbling; more of them while it's being poured.
    const span = lb - lt;
    const count = g.pouring ? BUBBLES.length : 8;
    for (let i = 0; i < count; i++) {
      const b = BUBBLES[i];
      const p = (t * b.speed * (g.pouring ? 2.4 : 1) + b.offset) % 1;
      const y = lb - p * span;
      const x = b.x * (halfWidth(y, shape) - 3.5) + Math.sin(t * 3 + b.wob + p * 9) * 0.8;
      const depth = (x - s.x) * dx + (y - s.y) * dy;
      if (depth < 1.5) continue;
      const twinkle = fx === 'sparkle';
      const r = b.r * (0.6 + p * 0.6);
      if (twinkle) sparkle(ctx, x, y, r * 2.4 * (0.5 + 0.5 * Math.abs(Math.sin(t * 4 + i * 1.7))), fxc, 0.95);
      else {
        circle(ctx, x, y, r, alpha(dark ? fxc : '#fffbe6', dark ? 0.35 : 0.5));
        circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.4, 'rgba(255,255,255,0.7)');
      }
    }

    // Bright meniscus just under the surface.
    band(0, 1.3);
    ctx.fillStyle = alpha(tint(look.liquid, 0.45), dark ? 0.25 : 0.55);
    ctx.fill();

    // The head: a soft band with a bumpy top.
    if (g.foam > 0.25) {
      const f = g.foam;
      band(f, f + 0.6);
      ctx.fillStyle = look.foam;
      ctx.fill();
      const w = halfWidth(clamp(s.y, TOP, BOT), shape) + 6;
      ctx.beginPath();
      for (let k = -w; k <= w; k += 3.1) {
        const i = Math.round(k * 3);
        const wob = Math.sin(t * (g.pouring ? 9 : 1.4) + i) * (g.pouring ? 0.7 : 0.25);
        const r = 1.9 + hash(i, 31) * 1.3;
        const cx = s.x - dx * (f + wob) + tx * k, cy = s.y - dy * (f + wob) + ty * k;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, TAU);
      }
      ctx.fillStyle = look.foam;
      ctx.fill();
      // Shadow where the head meets the beer, and a lit top edge.
      band(1.1, 1.1);
      ctx.fillStyle = alpha(look.foamShade, 0.85);
      ctx.fill();
      band(f + 0.2, Math.min(1.2, f * 0.4));
      ctx.fillStyle = `rgba(255,255,255,${0.55 * shine})`;
      ctx.fill();
    }
  } else {
    // Empty: the dregs of the head sliding down.
    ctx.fillStyle = alpha(look.foam, 0.16);
    ctx.fillRect(-30, TOP, 60, GLASS.H);
    ctx.fillStyle = alpha(look.foam, 0.5);
    ctx.fillRect(-30, lb - 2.2, 60, 3);
  }
  ctx.restore();

  // ----- glass over the top -----

  // Thick base (or stem and foot).
  trace(ctx, shape, 0, lb, BOT);
  ctx.fillStyle = vgrad(ctx, lb, BOT, ['rgba(232,246,252,0.5)', 'rgba(190,220,236,0.28)']);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.5 * shine})`;
  ctx.fillRect(-halfWidth(BOT - 1, shape) + 1.5, BOT - 1.6, halfWidth(BOT - 1, shape) * 1.1, 0.8);

  if (shape === 'tankard') {
    // Dimples.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.7;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.roundRect(-15.5 + c * 10.6, -11 + r * 11.5, 9.4, 10, 2.6);
        ctx.stroke();
      }
    }
  }

  // Walls.
  trace(ctx, shape, 0, TOP, BOT);
  ctx.strokeStyle = 'rgba(238,250,255,0.62)';
  ctx.lineWidth = 1.15;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Darker inner edge gives the glass thickness.
  trace(ctx, shape, 1.5, TOP + 1, lb);
  ctx.strokeStyle = 'rgba(20,30,50,0.13)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Reflections: a long soft one down the near side, a short sharp one on the far side.
  const hl = (x0: number, y0: number, y1: number, w: number, a: number) => {
    ctx.beginPath();
    for (let y = y0; y <= y1; y += 2) ctx.lineTo(halfWidth(y, shape) * x0, y);
    ctx.strokeStyle = `rgba(255,255,255,${a * shine})`;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  const bowlEnd = lb - 3;
  hl(-0.66, TOP + 6, Math.min(bowlEnd, 12), 3.4, 0.2);
  hl(-0.7, TOP + 8, Math.min(bowlEnd, 4), 1.3, 0.55);
  hl(0.74, TOP + 5, TOP + 16, 1.1, 0.5);
  hl(0.7, Math.min(bowlEnd - 6, 8), bowlEnd, 0.9, 0.3);

  // Rim.
  ellipse(ctx, 0, TOP, halfWidth(TOP, shape), 1.5, 'rgba(255,255,255,0.14)');
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * shine})`;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Effects in front of the glass.
  if (fx === 'singularity') ring(ctx, fxc, t, true);
  if (fx === 'sparkle' || fx === 'glow') {
    const n = fx === 'sparkle' ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const p = (t * (0.25 + hash(i, 41) * 0.2) + hash(i, 42)) % 1;
      const a = hash(i, 43) * TAU;
      const r = 14 + hash(i, 44) * 20;
      sparkle(ctx, Math.cos(a) * r, Math.sin(a) * r * 1.2 - p * 10, 3.2 * arcFade(p), mix(fxc, '#ffffff', 0.5), arcFade(p));
    }
  }
}

/** A small standalone pint for icons: upright, full, no effects. */
export function drawGlassIcon(ctx: Ctx, look: BeerLook, t = 0) {
  if (look.effect !== 'none') glow(ctx, 0, 2, 40, look.effectColour ?? '#fff', 0.35);
  drawGlass(ctx, {
    look: { ...look, effect: look.effect === 'singularity' || look.effect === 'void' ? look.effect : 'none' },
    fill: 1, foam: 5 * look.foamScale, down: { x: 0, y: 1 }, slosh: 0, t, pouring: false,
  });
}
