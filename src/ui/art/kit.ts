/** Scenery building blocks shared by the locations: skies, skylines, lamps, bunting and so on. */
import {
  TAU, alpha, at, circle, clamp, ellipse, glow, hash, lerp, line, mix, poly, rect, shade, tint, vgrad, type Ctx,
} from './draw';

/** Scenery is painted this wide so any window shape is covered. */
export const X0 = -190;
export const X1 = 590;
export const SPAN = X1 - X0;

export function fillAcross(ctx: Ctx, y0: number, y1: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.fillRect(X0, y0, SPAN, y1 - y0);
}

/** A vertical gradient sky, from above the top of the stage down to `bottom`. */
export function sky(ctx: Ctx, stops: (string | number)[], bottom = 222) {
  fillAcross(ctx, -400, bottom, vgrad(ctx, 0, bottom, stops));
}

/** Wraps a drifting x back across the scene. */
export const drift = (base: number, speed: number, t: number, pad = 80) =>
  X0 - pad + ((((base + speed * t) % (SPAN + pad * 2)) + SPAN + pad * 2) % (SPAN + pad * 2));

export function stars(
  ctx: Ctx, t: number, n: number, seed: number,
  o: { yMax?: number; colour?: string; twinkle?: number; drift?: number; size?: number } = {},
) {
  const yMax = o.yMax ?? 210, tw = o.twinkle ?? 1, size = o.size ?? 1;
  ctx.fillStyle = o.colour ?? '#ffffff';
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const x = drift(hash(i, seed) * SPAN, (o.drift ?? 0) * (0.4 + hash(i, seed + 3)), t, 0);
    const y = -120 + hash(i, seed + 1) * (yMax + 120);
    const r = (0.35 + hash(i, seed + 2) ** 4 * 1.3) * size;
    ctx.globalAlpha = a0 * (0.3 + 0.7 * (tw ? Math.abs(Math.sin(t * (0.4 + hash(i, seed + 4)) * tw + i * 1.7)) : hash(i, seed + 5)));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = a0;
}

export function cloud(ctx: Ctx, x: number, y: number, s: number, fill: string, under?: string) {
  const lobes = [[-19, 1, 10], [-7, -7, 13.5], [9, -4, 11.5], [21, 2, 8.5], [2, 3, 12]];
  if (under) {
    ctx.fillStyle = under;
    ctx.beginPath();
    for (const [lx, ly, r] of lobes) {
      ctx.moveTo(x + (lx + r) * s, y + (ly + 3) * s);
      ctx.arc(x + lx * s, y + (ly + 3) * s, r * s, 0, TAU);
    }
    ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (const [lx, ly, r] of lobes) {
    ctx.moveTo(x + (lx + r) * s, y + ly * s);
    ctx.arc(x + lx * s, y + ly * s, r * s, 0, TAU);
  }
  ctx.fill();
}

/** A band of clouds drifting across. */
export function clouds(ctx: Ctx, t: number, n: number, seed: number, y0: number, y1: number, speed: number, fill: string, under?: string, scale = 1) {
  for (let i = 0; i < n; i++) {
    const s = (0.6 + hash(i, seed) * 0.9) * scale;
    cloud(ctx, drift(hash(i, seed + 1) * SPAN * 1.2, speed * (0.6 + hash(i, seed + 2) * 0.8), t), lerp(y0, y1, hash(i, seed + 3)), s, fill, under);
  }
}

/** Rolling hills: a few sine waves, filled down to `bottom`. */
export function hills(ctx: Ctx, baseY: number, amp: number, seed: number, fill: string | CanvasGradient, freq = 1, bottom = 224) {
  ctx.beginPath();
  ctx.moveTo(X0, bottom);
  for (let x = X0; x <= X1; x += 6) ctx.lineTo(x, hillY(x, baseY, amp, seed, freq));
  ctx.lineTo(X1, bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
export const hillY = (x: number, baseY: number, amp: number, seed: number, freq = 1) =>
  baseY - amp * (0.5 * Math.sin(x * 0.011 * freq + seed) + 0.3 * Math.sin(x * 0.026 * freq + seed * 2.1) + 0.2 * Math.sin(x * 0.052 * freq + seed * 3.7));

/** A row of buildings. With `lit`, their windows glow and flick on and off. */
export function skyline(
  ctx: Ctx, baseY: number, seed: number, fill: string, minH: number, maxH: number,
  o: { minW?: number; maxW?: number; lit?: string; t?: number; density?: number; roofs?: boolean; bottom?: number } = {},
) {
  const minW = o.minW ?? 14, maxW = o.maxW ?? 34, bottom = o.bottom ?? 224;
  let x = X0 - hash(seed, 99) * 20;
  for (let i = 0; x < X1; i++) {
    const w = lerp(minW, maxW, hash(i, seed));
    const h = lerp(minH, maxH, hash(i, seed + 1) ** 1.6);
    const top = baseY - h;
    ctx.fillStyle = fill;
    ctx.fillRect(x, top, w + 0.6, bottom - top);
    if (o.roofs) {
      const kind = hash(i, seed + 2);
      if (kind < 0.35) poly(ctx, [x - 1, top, x + w / 2, top - w * 0.42, x + w + 1, top], fill);
      else if (kind < 0.5) ctx.fillRect(x + w * 0.42, top - h * 0.28, 1.6, h * 0.28);
      else if (kind < 0.62) ctx.fillRect(x + w * 0.2, top - 5, w * 0.6, 5);
    }
    if (o.lit) {
      const t = o.t ?? 0, dens = o.density ?? 0.45;
      const cols = Math.max(1, Math.floor((w - 3) / 4.4)), rows = Math.floor((h - 4) / 5.5);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = i * 977 + r * 31 + c;
          const epoch = Math.floor(t * 0.08 + hash(id, seed + 7) * 10);
          if (hash(id, seed + 3 + epoch) > dens) continue;
          ctx.fillStyle = alpha(o.lit, 0.45 + hash(id, seed + 4) * 0.55);
          ctx.fillRect(x + 2.2 + c * 4.4, top + 3 + r * 5.5, 2.2, 2.8);
        }
      }
    }
    x += w + (hash(i, seed + 5) < 0.2 ? 3 : 0);
  }
}

/** Cut a see-through hole in a cached layer (for windows). Trace the path in `fn`. */
export function punch(ctx: Ctx, fn: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  fn();
  ctx.fill();
  ctx.restore();
}

/** An arch-topped (or flat, with `arch` 0) window outline. */
export function archPath(ctx: Ctx, x: number, y: number, w: number, h: number, arch: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + arch);
  if (arch > 0) ctx.ellipse(x + w / 2, y + arch, w / 2, arch, 0, Math.PI, TAU);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/** A swaying pendant lamp with a pool of light under it. Returns where the bulb is. */
export function pendant(
  ctx: Ctx, x: number, len: number, t: number, ph: number, shadeC: string, light: string,
  o: { cone?: number; power?: number; kind?: 'shade' | 'globe' | 'bulb' } = {},
) {
  const a = Math.sin(t * 0.9 + ph) * 0.03 + Math.sin(t * 2.3 + ph * 2) * 0.008;
  const bx = x + Math.sin(a) * (len + 60), by = len;
  const flick = 0.92 + 0.05 * Math.sin(t * 9 + ph * 3) + 0.03 * Math.sin(t * 23 + ph);
  const power = (o.power ?? 1) * flick;
  line(ctx, x, -200, bx, by - 8, '#17100e', 1.1);
  if (o.cone) {
    // A soft cone of light falling from the lamp.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = vgrad(ctx, by, 230, [alpha(light, 0.17 * power * o.cone), alpha(light, 0)]);
    poly(ctx, [bx - 9, by + 2, bx + 9, by + 2, bx + 78, 232, bx - 78, 232]);
    ctx.fill();
    ctx.restore();
  }
  at(ctx, bx, by, a, 1, 1, () => {
    if (o.kind === 'globe') {
      rect(ctx, -2.2, -11, 4.4, 4, '#3a2a1a', 1);
      circle(ctx, 0, 0, 7.5, tint(light, 0.55));
    } else if (o.kind === 'bulb') {
      rect(ctx, -1.6, -8, 3.2, 4, '#2a2a2a', 1);
      circle(ctx, 0, 0, 3.4, tint(light, 0.7));
    } else {
      poly(ctx, [-4.6, -9, 4.6, -9, 14.5, 3, -14.5, 3], shadeC);
      poly(ctx, [1, -9, 4.6, -9, 14.5, 3, 7, 3], shade(shadeC, 0.3));
      poly(ctx, [-4.6, -9, -2, -9, -8, 3, -14.5, 3], tint(shadeC, 0.16));
      ellipse(ctx, 0, 3, 14.5, 2.6, tint(light, 0.6));
      rect(ctx, -2, -12, 4, 3.4, '#2a1c14', 1);
    }
  });
  glow(ctx, bx, by + 3, 52, light, 0.42 * power);
  glow(ctx, bx, by + 2, 15, '#fff6dc', 0.7 * power);
  return { x: bx, y: by };
}

/** Flags on a sagging string, fluttering. */
export function bunting(
  ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, t: number, colours: string[], n: number, size = 7,
) {
  const pt = (u: number) => ({
    x: lerp(x0, x1, u), y: lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.3 + u * 7 + x0) * 0.9 * Math.sin(u * Math.PI),
  });
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const p = pt(i / 24);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = 'rgba(40,28,22,0.75)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const p = pt((i + 0.5) / n);
    const f = Math.sin(t * 3.6 + i * 1.9 + x0 * 0.1);
    const c = colours[i % colours.length];
    at(ctx, p.x, p.y, f * 0.16, 1, 1, () => {
      poly(ctx, [-size * 0.55, 0, size * 0.55, 0, f * 1.2, size * 1.25], c);
      poly(ctx, [0, 0, size * 0.55, 0, f * 1.2, size * 1.25], alpha('#1a1024', 0.14));
    });
  }
}

/** A string of bulbs. */
export function festoon(
  ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, t: number, colours: string[], n: number, r = 1.7, power = 1,
) {
  const pt = (u: number) => ({
    x: lerp(x0, x1, u), y: lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.1 + u * 6 + x0) * 0.8 * Math.sin(u * Math.PI),
  });
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const p = pt(i / 24);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = 'rgba(20,14,12,0.8)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const p = pt((i + 0.5) / n);
    const c = colours[i % colours.length];
    const tw = 0.75 + 0.25 * Math.sin(t * 2.2 + i * 2.4);
    circle(ctx, p.x, p.y + 1.8, r, tint(c, 0.5));
    glow(ctx, p.x, p.y + 1.8, r * 6.5, c, 0.7 * tw * power);
  }
}

/** Bottles along a shelf. */
export function bottles(ctx: Ctx, x: number, y: number, w: number, seed: number, dim = 0) {
  const cols = ['#3d7a4a', '#8a5a22', '#b9c7c9', '#2e4f73', '#7a2a2a', '#c99a3a', '#23402c'];
  let bx = x + 2;
  for (let i = 0; bx < x + w - 5; i++) {
    const bw = 4 + hash(i, seed) * 2.6, bh = 10 + hash(i, seed + 1) * 9;
    const c = mix(cols[Math.floor(hash(i, seed + 2) * cols.length)], '#0a0610', dim);
    rect(ctx, bx, y - bh, bw, bh, c, 1.2);
    rect(ctx, bx + bw * 0.3, y - bh - 5, bw * 0.4, 6, c, 0.8);
    rect(ctx, bx + bw * 0.24, y - bh - 5.8, bw * 0.52, 1.5, mix('#d8c27a', '#0a0610', dim));
    rect(ctx, bx + 0.5, y - bh * 0.62, bw - 1, bh * 0.3, mix('#efe6cf', '#0a0610', dim + 0.1));
    rect(ctx, bx + 0.8, y - bh + 1.2, 0.9, bh - 3, 'rgba(255,255,255,0.3)');
    bx += bw + 1.4 + hash(i, seed + 3) * 2;
  }
}

/** A framed picture. */
export function picture(ctx: Ctx, x: number, y: number, w: number, h: number, frame: string, kind: number) {
  rect(ctx, x - 1, y + 1.5, w + 2, h + 1, 'rgba(0,0,0,0.25)', 1);
  rect(ctx, x, y, w, h, frame, 1);
  rect(ctx, x + 1, y + 1, w - 2, 1, tint(frame, 0.3));
  const ix = x + 2.6, iy = y + 2.6, iw = w - 5.2, ih = h - 5.2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  if (kind === 0) {
    // Landscape.
    rect(ctx, ix, iy, iw, ih, '#d9c9a0');
    circle(ctx, ix + iw * 0.7, iy + ih * 0.35, ih * 0.16, '#e9a86a');
    ellipse(ctx, ix + iw * 0.3, iy + ih, iw * 0.6, ih * 0.5, '#6f8f5a');
    ellipse(ctx, ix + iw * 0.85, iy + ih, iw * 0.5, ih * 0.36, '#4f7a4a');
  } else if (kind === 1) {
    // Somebody's portrait.
    rect(ctx, ix, iy, iw, ih, '#5a4a52');
    ellipse(ctx, ix + iw / 2, iy + ih * 1.02, iw * 0.42, ih * 0.4, '#2e2a36');
    circle(ctx, ix + iw / 2, iy + ih * 0.42, Math.min(iw, ih) * 0.2, '#e3b792');
  } else if (kind === 2) {
    // A ship.
    rect(ctx, ix, iy, iw, ih, '#b8d2d8');
    rect(ctx, ix, iy + ih * 0.66, iw, ih, '#4f7f95');
    poly(ctx, [ix + iw * 0.25, iy + ih * 0.62, ix + iw * 0.78, iy + ih * 0.62, ix + iw * 0.68, iy + ih * 0.76, ix + iw * 0.33, iy + ih * 0.76], '#4a2f22');
    poly(ctx, [ix + iw * 0.5, iy + ih * 0.16, ix + iw * 0.72, iy + ih * 0.56, ix + iw * 0.5, iy + ih * 0.56], '#f1ead9');
    poly(ctx, [ix + iw * 0.47, iy + ih * 0.24, ix + iw * 0.47, iy + ih * 0.56, ix + iw * 0.3, iy + ih * 0.56], '#e2d8c2');
  } else {
    // A prize pint.
    rect(ctx, ix, iy, iw, ih, '#2f4a3a');
    poly(ctx, [ix + iw * 0.34, iy + ih * 0.26, ix + iw * 0.66, iy + ih * 0.26, ix + iw * 0.62, iy + ih * 0.82, ix + iw * 0.38, iy + ih * 0.82], '#e0a030');
    rect(ctx, ix + iw * 0.33, iy + ih * 0.2, iw * 0.34, ih * 0.13, '#fbf6e9', 1);
  }
  ctx.restore();
}

/** Wall with a repeating motif, used by the cosier pubs. */
export function wallpaper(ctx: Ctx, y0: number, y1: number, base: string, motif: string, kind: 'stripe' | 'diamond' | 'none' = 'stripe') {
  fillAcross(ctx, y0, y1, vgrad(ctx, 0, y1, [tint(base, 0.06), base, shade(base, 0.2)]));
  ctx.fillStyle = motif;
  if (kind === 'stripe') {
    for (let x = X0; x < X1; x += 13) ctx.fillRect(x, y0, 5.5, y1 - y0);
  } else if (kind === 'diamond') {
    for (let y = -6; y < y1; y += 15) {
      for (let x = X0 + ((y / 15) % 2 ? 9 : 0); x < X1; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, y - 4.2);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x, y + 4.2);
        ctx.lineTo(x - 3, y);
        ctx.fill();
      }
    }
  }
}

/** Panelled wood along the bottom of a wall. */
export function wainscot(ctx: Ctx, y0: number, y1: number, wood: string) {
  fillAcross(ctx, y0, y1, vgrad(ctx, y0, y1, [wood, shade(wood, 0.25)]));
  fillAcross(ctx, y0, y0 + 3.4, tint(wood, 0.22));
  fillAcross(ctx, y0 + 3.4, y0 + 5, shade(wood, 0.35));
  for (let x = X0 + 4; x < X1; x += 46) {
    rect(ctx, x, y0 + 10, 38, y1 - y0 - 14, shade(wood, 0.16), 2);
    rect(ctx, x + 1.2, y0 + 11.2, 35.6, 1.2, tint(wood, 0.1));
  }
}

/** A flock of birds: little flapping ticks. */
export function birds(ctx: Ctx, t: number, n: number, seed: number, y0: number, y1: number, speed: number, colour: string, size = 1) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.9 * size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = drift(hash(i, seed) * SPAN, speed * (0.7 + hash(i, seed + 1) * 0.6), t, 20);
    const y = lerp(y0, y1, hash(i, seed + 2)) + Math.sin(t * 0.7 + i) * 3;
    const flap = Math.sin(t * 7 + i * 2.3) * 2.2 * size;
    const s = (2.6 + hash(i, seed + 3) * 1.6) * size;
    ctx.moveTo(x - s, y - flap);
    ctx.quadraticCurveTo(x - s * 0.4, y - 0.6, x, y + 0.6);
    ctx.quadraticCurveTo(x + s * 0.4, y - 0.6, x + s, y - flap);
  }
  ctx.stroke();
}

/** A sweeping beam of light from a point. */
export function beam(ctx: Ctx, x: number, y: number, angle: number, len: number, spread: number, colour: string, a: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, alpha(colour, clamp(a)));
  g.addColorStop(1, alpha(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-1.5, 0);
  ctx.lineTo(1.5, 0);
  ctx.lineTo(len * spread, len);
  ctx.lineTo(-len * spread, len);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Slow drifting specks: dust in lamplight, pollen, embers, snow. */
export function motes(
  ctx: Ctx, t: number, n: number, seed: number, colour: string,
  o: { y0?: number; y1?: number; rise?: number; size?: number; a?: number } = {},
) {
  const y0 = o.y0 ?? 0, y1 = o.y1 ?? 210, rise = o.rise ?? 4;
  for (let i = 0; i < n; i++) {
    const life = (t * (0.03 + hash(i, seed) * 0.04) + hash(i, seed + 1)) % 1;
    const x = X0 + hash(i, seed + 2) * SPAN + Math.sin(t * 0.5 + i) * 8;
    const y = lerp(y1, y0, (hash(i, seed + 3) + life * rise * 0.25) % 1);
    const a = (o.a ?? 0.6) * Math.sin(life * Math.PI) * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.9 + i)));
    glow(ctx, x, y, (1.6 + hash(i, seed + 4) * 2.2) * (o.size ?? 1), colour, a);
  }
}
