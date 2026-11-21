/**
 * The far end of the game: pubs in orbit, on the Moon, in Saturn's rings, on somebody else's
 * planet, at the edge of the galaxy and where the universes meet.
 * Painted the same way as the others (see backdrops.ts): far, shell, mid, front.
 */
import type { Backdrop } from './backdrops';
import {
  TAU, alpha, arc, at, blob, circle, curve, ellipse, glow, hash, hgrad, hsl, lerp, line, poly, rect, rgrad, shade,
  sparkle, tint, vgrad, type Ctx,
} from './draw';
import {
  SPAN, X0, X1, archPath, beam, bottles, cloud, drift, festoon, fillAcross, hillY, hills, motes, pendant, punch, sky,
  stars, wainscot, wallpaper,
} from './kit';

/** Repeat something at regular x positions across the whole scene. */
function across(first: number, step: number, fn: (x: number, n: number) => void) {
  for (let n = -Math.ceil((first - X0) / step); first + n * step < X1; n++) fn(first + n * step, n);
}

// ---------------------------------------------------------------- shared bits of space

const sprites = new Map<string, HTMLCanvasElement>();

/** A cloud of glowing gas with dust lanes through it, painted once and reused. */
function nebula(seed: number, colours: string[]): HTMLCanvasElement {
  const key = `n${seed}${colours.join('')}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const walk = (strands: number, steps: number, r0: number, r1: number, paint: (s: number, i: number) => string, salt: number) => {
    for (let s = 0; s < strands; s++) {
      let x = 70 + hash(s, seed + salt) * 372, y = 60 + hash(s, seed + salt + 1) * 136;
      let a = hash(s, seed + salt + 2) * TAU;
      for (let i = 0; i < steps; i++) {
        const id = s * 131 + i;
        a += (hash(id, seed + salt + 3) - 0.5) * 1.3;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 5;
        const r = r0 + hash(id, seed + salt + 4) * (r1 - r0);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const col = paint(s, id);
        gr.addColorStop(0, col);
        gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  };
  g.globalCompositeOperation = 'lighter';
  walk(8, 44, 14, 52, (s, id) => alpha(colours[s % colours.length], 0.05 + hash(id, seed + 9) * 0.07), 0);
  g.globalCompositeOperation = 'destination-out';
  walk(5, 30, 5, 17, () => 'rgba(0,0,0,0.16)', 40);
  // Fade to nothing at the edges, so it can be dropped anywhere.
  g.globalCompositeOperation = 'destination-in';
  g.translate(256, 128);
  g.scale(2, 1);
  const fade = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  fade.addColorStop(0, '#000');
  fade.addColorStop(0.6, '#000');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(-128, -128, 256, 256);
  sprites.set(key, c);
  return c;
}

function gas(ctx: Ctx, sprite: HTMLCanvasElement, x: number, y: number, w: number, h: number, a: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function shootingStar(ctx: Ctx, t: number, i: number, colour = '#ffffff') {
  const period = 5 + hash(i, 101) * 6;
  const n = Math.floor(t / period), p = ((t / period) % 1) * 5;
  if (p > 1) return;
  const x = X0 + hash(n, 102 + i) * SPAN, y = hash(n, 103 + i) * 90;
  const hx = x + p * 90, hy = y + p * 36;
  const g = ctx.createLinearGradient(hx - 40, hy - 16, hx, hy);
  g.addColorStop(0, alpha(colour, 0));
  g.addColorStop(1, alpha(colour, arc(p)));
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - 40, hy - 16);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  glow(ctx, hx, hy, 5, colour, arc(p));
}

/** A sun with a hard core, a soft halo and the streak a lens makes of it. */
function sun(ctx: Ctx, x: number, y: number, r: number, t: number, core = '#ffffff', halo = '#ffd890') {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + t * 0.05, len = r * (5 + 2.4 * Math.sin(t * 0.9 + i * 2.4));
    beam(ctx, x, y, a, len, 0.05, halo, 0.22);
  }
  glow(ctx, x, y, r * 9, halo, 0.5);
  glow(ctx, x, y, r * 4, halo, 0.9);
  glow(ctx, x, y, r * 16, '#cfe0ff', 0.55, 0.035);
  glow(ctx, x, y, r * 2.2, core, 1);
  circle(ctx, x, y, r, core);
}

/** Home: a globe that turns, with weather, a night side and cities on it. */
function globe(ctx: Ctx, cx: number, cy: number, R: number, t: number, spin: number) {
  glow(ctx, cx, cy, R * 1.2, '#5fb0ff', R > 60 ? 0.32 : 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgrad(ctx, cx - R * 0.35, cy - R * 0.4, R * 0.1, R * 1.3, ['#4a98ec', '#2266c8', '#0f3080']);
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  /** Where a point on the surface is on screen, and how square-on we see it. */
  const place = (i: number, seed: number, speed: number) => {
    const lon = hash(i, seed) * TAU + t * spin * speed, lat = (hash(i, seed + 1) - 0.5) * 2.3;
    return { x: cx + R * Math.cos(lat) * Math.sin(lon), y: cy + R * Math.sin(lat) * 0.96, face: Math.cos(lon) * Math.cos(lat * 0.8) };
  };
  for (let i = 0; i < 34; i++) {
    const p = place(i, 91, 1);
    if (p.face < 0.08) continue;
    const s = R * (0.07 + hash(i, 93) * 0.14);
    const sand = i % 6 === 5;
    at(ctx, p.x, p.y, hash(i, 94) * 3, p.face, 1, () => {
      const pts: number[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, rr = s * (0.55 + hash(i * 9 + k, 95) * 0.75);
        pts.push(Math.cos(a) * rr, Math.sin(a) * rr * 0.8);
      }
      blob(ctx, pts, sand ? '#c9b074' : '#3f9e58', 0.6);
      blob(ctx, pts.map((v, k) => v * 0.55 + (k % 2 ? -s * 0.08 : s * 0.16)), sand ? '#d9c690' : '#62bb6c', 0.6);
    });
  }
  // Ice at the poles.
  ellipse(ctx, cx, cy - R * 0.98, R * 0.5, R * 0.1, '#f4f8ff');
  ellipse(ctx, cx, cy + R * 0.99, R * 0.42, R * 0.08, '#f4f8ff');
  // Weather.
  for (let i = 0; i < 26; i++) {
    const p = place(i, 96, 1.5);
    if (p.face < 0.1) continue;
    const s = R * 0.045 * (0.6 + hash(i, 98));
    ellipse(ctx, p.x, p.y, s * 3.4 * p.face, s, 'rgba(255,255,255,0.78)', 0.25);
    ellipse(ctx, p.x + s, p.y + s * 0.8, s * 2.2 * p.face, s * 0.7, 'rgba(255,255,255,0.6)', 0.25);
  }
  // Night creeping round one side, with the cities lit.
  const night = ctx.createLinearGradient(cx - R, cy - R * 0.3, cx + R, cy + R * 0.3);
  night.addColorStop(0, 'rgba(3,6,24,0)');
  night.addColorStop(0.5, 'rgba(3,6,24,0)');
  night.addColorStop(0.82, 'rgba(3,6,24,0.86)');
  night.addColorStop(1, 'rgba(3,6,24,0.94)');
  ctx.fillStyle = night;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  if (R > 60) {
    for (let i = 0; i < 46; i++) {
      const p = place(i % 34, 91, 1);
      const x = p.x + (hash(i, 87) - 0.5) * R * 0.2, y = p.y + (hash(i, 88) - 0.5) * R * 0.16;
      const dark = (x - cx) / R + (y - cy) / R * 0.3;
      if (p.face < 0.1 || dark < 0.42) continue;
      circle(ctx, x, y, 0.5 + hash(i, 89) * 0.6, alpha('#ffd98a', 0.5 + 0.4 * Math.sin(t * 2 + i)));
    }
  }
  // Sunlight off the sea, and air glowing at the edge.
  glow(ctx, cx - R * 0.42, cy - R * 0.36, R * 0.5, '#ffffff', R > 60 ? 0.12 : 0.28);
  ctx.fillStyle = rgrad(ctx, cx, cy, R * 0.88, R, ['rgba(140,210,255,0)', 'rgba(170,225,255,0.6)']);
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
}

/** A sphere lit from one side, optionally striped like a gas giant. */
function ball(
  ctx: Ctx, x: number, y: number, r: number, colour: string, lightFrom: number,
  o: { bands?: string[]; dark?: string; depth?: number } = {},
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = colour;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (o.bands) {
    const n = o.bands.length;
    o.bands.forEach((c, i) => {
      const y0 = y - r + (i / n) * r * 2, wob = Math.sin(i * 2.3) * r * 0.02;
      ctx.fillStyle = c;
      ctx.fillRect(x - r, y0 + wob, r * 2, (r * 2) / n * (0.5 + hash(i, 61) * 0.5));
    });
  }
  ctx.fillStyle = rgrad(ctx, x + Math.cos(lightFrom) * r * 0.5, y + Math.sin(lightFrom) * r * 0.5, 0, r * 1.2, ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const d = o.depth ?? 0.75;
  circle(ctx, x - Math.cos(lightFrom) * r * d, y - Math.sin(lightFrom) * r * d, r * 1.12, alpha(o.dark ?? '#0a0616', 0.7));
  ctx.restore();
}

// ---------------------------------------------------------------- The Earth Inn

/** A beer keg, end over end. */
function keg(ctx: Ctx, x: number, y: number, rot: number, s = 1) {
  at(ctx, x, y, rot, s, s, () => {
    rect(ctx, -4.4, -6, 8.8, 12, '#b9c0cc', 2);
    rect(ctx, -4.4, -6, 3, 12, '#e6ebf2', 2);
    for (const by of [-3.4, 2.6]) rect(ctx, -4.8, by, 9.6, 1.3, '#7a8498');
    rect(ctx, -1.2, -7.4, 2.4, 1.6, '#7a8498');
  });
}

const earthInn: Backdrop = {
  fog: '#0c1830', haze: 0.17, dim: 0.17, shine: 0.95, vignette: 0.62,
  bar: { kind: 'wood', top: '#b98a52', front: '#1f2a44', trim: '#d1a849', glow: '#5fd0ff' },
  far(ctx, t) {
    sky(ctx, ['#01020a', '#040818', '#081228']);
    gas(ctx, nebula(3, ['#2a3a8a', '#5a3a9a', '#1f5a8a']), 120, 70, 620, 230, 0.55, -0.25);
    stars(ctx, t, 190, 9, { twinkle: 0.4 });
    stars(ctx, t, 26, 10, { twinkle: 1.2, size: 1.7, colour: '#cfe0ff' });
    shootingStar(ctx, t, 0);
    sun(ctx, -34, 34, 5, t);
    // The glass makes ghosts of the Sun.
    for (const [u, r, a] of [[0.34, 9, 0.07], [0.52, 4, 0.1], [0.8, 16, 0.045]]) {
      circle(ctx, lerp(-34, 220, u), lerp(34, 110, u), r, alpha('#bfe0ff', a));
    }
    // The Moon, small and far.
    ball(ctx, 96, 30, 6, '#d9dbe2', Math.PI * 1.05, { depth: 0.6 });
    // Home, turning.
    globe(ctx, 352, 104, 124, t, 0.03);
    // A space station going over.
    at(ctx, drift(0, 8, t, 70), 44 + Math.sin(t * 0.2) * 5, -0.16, 1, 1, () => {
      line(ctx, -26, 0, 26, 0, '#aab3c2', 1.2, 'butt');
      for (const px of [-26, -17, 11, 20]) {
        for (const py of [-12, 2]) {
          rect(ctx, px, py, 6.4, 10, '#2a52b0');
          rect(ctx, px, py + 4.6, 6.4, 0.6, '#9fc0ff');
          rect(ctx, px + 2.9, py, 0.6, 10, '#9fc0ff');
        }
      }
      rect(ctx, -8, -2.4, 16, 4.8, '#e6ebf2', 2);
      rect(ctx, -2.4, -8, 4.8, 13, '#c9d0dc', 2);
      rect(ctx, -6, -1, 3, 2, '#3a4a6a', 0.6);
      glow(ctx, 0, 0, 7, '#ffffff', 0.4 + 0.4 * Math.sin(t * 4));
    });
    // The dray: this week's delivery, on a tow rope.
    const dx = drift(380, -9, t, 90), dy = 84 + Math.sin(t * 0.3) * 6;
    line(ctx, dx + 10, dy, dx + 62, dy + Math.sin(t * 0.9) * 2, 'rgba(220,228,240,0.6)', 0.6);
    for (let k = 0; k < 4; k++) keg(ctx, dx + 24 + k * 12, dy + Math.sin(t * 0.9 + k) * 1.6, t * 0.5 + k * 1.4, 0.8);
    at(ctx, dx, dy, 0, 1, 1, () => {
      glow(ctx, 13, 0, 9, '#7ad7ff', 0.8);
      poly(ctx, [10, -2, 10, 2, 16 + Math.sin(t * 30) * 2, 0], '#dff6ff');
      blob(ctx, [-13, 0, -7, -4.4, 6, -4.4, 10, -2.6, 10, 2.6, 6, 4.4, -7, 4.4], '#f1f3f7', 0.4);
      blob(ctx, [-13, 0, -7, 1, 6, 1.6, 10, 2.6, 6, 4.4, -7, 4.4], '#c2c9d6', 0.4);
      rect(ctx, -8, -2.8, 4.4, 2.6, '#24406e', 1.2);
      poly(ctx, [2, -4.4, 8, -9, 9.6, -4.4], '#c8323a');
    });
  },
  shell(ctx) {
    // The lounge: dark panelling round one long window, with the brass and timber of a proper pub.
    fillAcross(ctx, -400, 226, vgrad(ctx, 0, 226, ['#1c2436', '#232c42', '#161c2c']));
    punch(ctx, () => {
      ctx.beginPath();
      ctx.rect(X0 - 40, 24, SPAN + 80, 150);
    });
    fillAcross(ctx, 24, 174, 'rgba(120,180,255,0.035)');
    across(40, 200, (x) => {
      // Slim posts between the panes, each with a brass collar.
      rect(ctx, x - 4.5, 22, 9, 154, vgrad(ctx, 22, 176, ['#e9edf3', '#b9c1cf']));
      rect(ctx, x - 4.5, 22, 2.4, 154, 'rgba(255,255,255,0.5)');
      rect(ctx, x + 2.4, 22, 2.1, 154, 'rgba(40,50,80,0.3)');
      for (const y of [30, 164]) rect(ctx, x - 5.6, y, 11.2, 3.4, '#d1a849', 1);
      poly(ctx, [x + 26, 174, x + 70, 24, x + 90, 24, x + 46, 174], 'rgba(255,255,255,0.03)');
    });
    // A beam overhead, with the glasses hanging from it.
    fillAcross(ctx, -400, 16, vgrad(ctx, 0, 16, ['#4a2c1a', '#33200f']));
    fillAcross(ctx, 16, 18.4, '#e0b85a');
    fillAcross(ctx, 18.4, 24, '#12182a');
    across(4, 9, (x, n) => {
      if (((n % 11) + 11) % 11 > 6) return;
      line(ctx, x, 18, x, 21, 'rgba(230,240,255,0.55)', 0.6);
      poly(ctx, [x - 2.6, 21, x + 2.6, 21, x + 1.8, 27, x - 1.8, 27], 'rgba(200,225,255,0.3)');
      rect(ctx, x - 2.6, 21, 5.2, 0.8, 'rgba(255,255,255,0.6)');
    });
    // Sill, a strapped-down row of bottles, and panelling below.
    across(40, 200, (x, n) => bottles(ctx, x + 22, 172, 150, 40 + n, 0.6));
    fillAcross(ctx, 172, 177, vgrad(ctx, 172, 177, ['#f0d488', '#a8823a']));
    wainscot(ctx, 177, 226, '#4a2c1c');
  },
  mid(ctx, t) {
    across(140, 200, (x, n) => pendant(ctx, x, 30, t * 0.6, n * 2.1, '#b8923e', '#ffd9a0', { cone: 0.5 }));
    // Things that got away from somebody.
    const floaters: (() => void)[] = [
      () => { rect(ctx, -5, -5, 10, 10, '#c8323a', 1.6); rect(ctx, -3.4, -3.4, 6.8, 6.8, '#f4f1e8', 1); },
      () => { ellipse(ctx, 0, 0, 4.4, 2.6, '#d9a85a'); ellipse(ctx, -1.2, -0.4, 1.8, 1, '#c08a3a'); },
      () => {
        const w = Math.sin(t * 2.2) * 0.8;
        ellipse(ctx, 0, 0, 6 + w, 6 - w, 'rgba(232,160,48,0.88)');
        ellipse(ctx, -2, -2.2, 2, 1.3, 'rgba(255,255,255,0.65)', -0.6);
        circle(ctx, 2, 2, 0.8, 'rgba(255,240,200,0.7)');
      },
      () => { rect(ctx, -5, -0.6, 8, 1.2, '#b9c0cc'); poly(ctx, [3, -2.4, 7, -2.4, 5, 0, 7, 2.4, 3, 2.4], '#c8323a'); line(ctx, -5, 0, -9, 0, '#e6ebf2', 0.6); },
      () => { ellipse(ctx, 0, 0, 3.4, 3.8, 'rgba(232,160,48,0.85)'); circle(ctx, -1, -1.2, 1, 'rgba(255,255,255,0.6)'); },
      () => { rect(ctx, -4.6, -6, 9.2, 12, '#2f8fd0', 1.4); rect(ctx, -4.6, -2.4, 9.2, 4.8, '#f2c21c'); },
    ];
    floaters.forEach((draw, i) => {
      const sp = 0.3 + hash(i, 71) * 0.6;
      at(ctx, drift(i * 137, (i % 2 ? -1 : 1) * (2 + sp * 4), t, 20), 44 + hash(i, 72) * 70 + Math.sin(t * 0.4 + i * 2) * 9, t * (0.2 + sp * 0.5) + i, 1, 1, draw);
    });
  },
  front(ctx, t) {
    // Sunlight through the glass on one side of the room, earthlight on the other.
    glow(ctx, -40, 60, 200, '#fff0d0', 0.1);
    glow(ctx, 360, 110, 200, '#5fb0ff', 0.05 + 0.01 * Math.sin(t * 0.5));
    motes(ctx, t, 10, 22, '#cfeaff', { y0: 20, y1: 200, a: 0.3, size: 0.7 });
  },
};

// ---------------------------------------------------------------- The Moon Under Water

function vat(ctx: Ctx, x: number, s: number) {
  at(ctx, x, 226, 0, s, s, () => {
    const c = '#c77a44';
    rect(ctx, -30, -112, 60, 112, c, 3);
    ctx.beginPath();
    ctx.ellipse(0, -112, 30, 26, 0, Math.PI, TAU);
    ctx.fillStyle = c;
    ctx.fill();
    rect(ctx, -30, -112, 13, 112, tint(c, 0.25));
    rect(ctx, -20, -108, 3, 104, 'rgba(255,240,220,0.4)');
    rect(ctx, 12, -112, 18, 112, shade(c, 0.35));
    for (const y of [-92, -50]) rect(ctx, -31, y, 62, 3.4, shade(c, 0.4));
    for (let i = 0; i < 7; i++) circle(ctx, -27 + i * 9, -90.3, 0.9, tint(c, 0.4));
    rect(ctx, -3, -146, 6, 12, shade(c, 0.2));
    // Sight glass and gauge.
    rect(ctx, -6, -44, 5, 32, '#2a1a12', 2);
    circle(ctx, 9, -70, 7.4, shade(c, 0.45));
    circle(ctx, 9, -70, 6.2, '#f1ead9');
  });
}

/** Where the dome's glazing bars run: `k` counts bars out from the middle, `u` runs from the top down. */
const domeBar = (k: number, u: number) => ({
  x: 200 + k * 86 * (Math.sin(u * 1.4) / Math.sin(1.4)),
  y: -230 + u * 460 + k * k * 1.1 * u,
});

const moon: Backdrop = {
  fog: '#1c2030', haze: 0.17, dim: 0.14, shine: 0.9, vignette: 0.6,
  bar: { kind: 'metal', top: '#c9ccd4', front: '#6a6e7c', trim: '#c77a44', glow: '#ffb070' },
  far(ctx, t) {
    sky(ctx, ['#010206', '#05070f', '#0c0f1a']);
    gas(ctx, nebula(5, ['#2a3a7a', '#3a2a6a']), 60, 50, 520, 180, 0.4, 0.2);
    stars(ctx, t, 200, 4, { twinkle: 0, yMax: 150 });
    globe(ctx, 326, 50, 31, t, 0.09);
    // Mountains on the horizon with the sun on their shoulders, then the plain.
    hills(ctx, 131, 30, 5.5, '#d4d7e0', 1.3);
    hills(ctx, 133.4, 29, 5.56, vgrad(ctx, 104, 160, ['#7c8090', '#565a6a']), 1.3);
    hills(ctx, 143, 10, 2.2, '#c2c5cf', 2.2);
    hills(ctx, 144.6, 9.6, 2.24, '#74788a', 2.2);
    hills(ctx, 150, 5, 1.1, vgrad(ctx, 142, 226, ['#b6b9c4', '#8a8e9c', '#6e7282']), 0.8);
    for (let i = 0; i < 18; i++) {
      const x = X0 + hash(i, 111) * SPAN, y = 158 + hash(i, 112) * 40, r = 5 + hash(i, 113) * 14;
      ellipse(ctx, x, y, r, r * 0.26, '#d0d3dc');
      ellipse(ctx, x - r * 0.06, y - r * 0.02, r * 0.94, r * 0.23, '#5c6070');
      ellipse(ctx, x + r * 0.1, y + r * 0.06, r * 0.8, r * 0.16, '#8d919e');
    }
    // The colony: a few cans half-buried in the dust, a dish and a mast.
    at(ctx, 52, 152, 0, 1, 1, () => {
      for (const [mx, w] of [[-34, 30], [2, 38], [46, 24]]) {
        rect(ctx, mx, -11, w, 12, '#e6e9ef', 6);
        rect(ctx, mx + 3, -4, w - 6, 5, '#aeb3c0', 3);
        for (let k = 0; k * 7 + 6 < w - 4; k++) {
          const on = hash(k + mx, Math.floor(t * 0.2 + hash(k, mx))) < 0.75;
          rect(ctx, mx + 5 + k * 7, -8.6, 3.6, 2.8, on ? '#ffd98a' : '#3a4050', 1);
          if (on) glow(ctx, mx + 6.8 + k * 7, -7.2, 5, '#ffc56e', 0.5);
        }
      }
      rect(ctx, -6, -6, 10, 3, '#c9ccd6');
      rect(ctx, 38, -6, 10, 3, '#c9ccd6');
      line(ctx, 20, -11, 20, -24, '#c9ccd6', 0.8);
      ctx.beginPath();
      ctx.ellipse(20, -25, 6, 3, -0.5, 0, Math.PI);
      ctx.fillStyle = '#e6e9ef';
      ctx.fill();
      line(ctx, 62, -11, 62, -34, '#aeb3c0', 0.7);
      glow(ctx, 62, -34, 6, '#ff5a5a', Math.sin(t * 3) > 0.4 ? 0.9 : 0.1);
      // Solar panels, tilted at the sun.
      for (let k = 0; k < 3; k++) {
        line(ctx, -52 - k * 13, 0, -52 - k * 13, -5, '#8a8f9c', 0.8);
        poly(ctx, [-58 - k * 13, -4, -47 - k * 13, -9, -46 - k * 13, -6.6, -57 - k * 13, -1.6], '#2a52b0');
      }
    });
    // A rocket leaving, now and then.
    const lp = (t * 0.03) % 1;
    if (lp < 0.4) {
      const u = lp / 0.4, ry = 140 - u * u * 260;
      at(ctx, 178, ry, 0, 1, 1, () => {
        glow(ctx, 0, 12, 22, '#ffb060', 0.9);
        poly(ctx, [-2.6, 9, 2.6, 9, 0, 22 + Math.sin(t * 40) * 3], '#ffe6a0');
        blob(ctx, [-3.4, 9, -3.4, -6, 0, -14, 3.4, -6, 3.4, 9], '#f1f3f7', 0.4);
        poly(ctx, [-3.4, 9, -7, 11, -3.4, 2], '#c8323a');
        poly(ctx, [3.4, 9, 7, 11, 3.4, 2], '#c8323a');
        circle(ctx, 0, -3, 1.6, '#5fd0ff');
      });
      for (let k = 0; k < 8; k++) circle(ctx, 178 + (hash(k, 5) - 0.5) * 30 * u, 142 - hash(k, 6) * 10, 4 + u * 12, alpha('#c9ccd6', 0.35 * (1 - u)));
    }
    // What the first visitors left: the bottom half of a lander, and the flag.
    at(ctx, 262, 153, 0, 1, 1, () => {
      for (const s of [-1, 1]) {
        line(ctx, s * 4, -6, s * 10, 0, '#b9a05a', 0.9);
        rect(ctx, s * 10 - 2, -0.4, 4, 1, '#d9dde6');
      }
      rect(ctx, -6, -10, 12, 6, '#d9b25a', 1);
      rect(ctx, -6, -10, 12, 2, '#f0d488', 1);
      rect(ctx, -2, -4, 4, 2.4, '#5a5e6c');
      line(ctx, 16, 0, 16, -18, '#d9dde6', 0.8);
      rect(ctx, 16, -18, 11, 7, '#24408e');
      line(ctx, 16, -18, 27, -11, '#f4f1e8', 1.2, 'butt');
      line(ctx, 27, -18, 16, -11, '#f4f1e8', 1.2, 'butt');
      rect(ctx, 20.6, -18, 1.8, 7, '#c8323a');
      rect(ctx, 16, -15.4, 11, 1.8, '#c8323a');
    });
    // A rover trundling along.
    const rx = drift(0, 7, t, 30), ry = hillY(rx, 150, 5, 1.1, 0.8) + 8;
    at(ctx, rx, ry, Math.sin(t * 6) * 0.03, 1, 1, () => {
      rect(ctx, -9, -8, 18, 5, '#e6e9ef', 1.5);
      rect(ctx, -3, -13, 8, 5, '#f2c94c', 1);
      line(ctx, 6, -8, 9, -17, '#d9dde6', 0.7);
      circle(ctx, 9, -17.6, 1.6, '#d9dde6');
      for (const wx of [-7, 0, 7]) {
        circle(ctx, wx, -1.6, 2.7, '#2a2c36');
        circle(ctx, wx, -1.6, 1, '#8a8f9c');
      }
      for (let k = 0; k < 4; k++) circle(ctx, -12 - k * 5, -1 - k * 1.6, 1.5 + k, alpha('#c9ccd6', 0.3 - k * 0.07));
    });
    // Somebody out for a walk, in very little gravity.
    const hop = (t * 0.35) % 1, ax = drift(200, -5, t, 30), ay = 170 - Math.sin(hop * Math.PI) * 14;
    ellipse(ctx, ax + 2, 171, 4 - Math.sin(hop * Math.PI) * 1.6, 1, 'rgba(20,22,32,0.4)');
    at(ctx, ax, ay, Math.sin(hop * TAU) * 0.2, 1, 1, () => {
      rect(ctx, -3, -8, 6, 9, '#f1f3f7', 2.4);
      circle(ctx, 0, -11, 3.6, '#f1f3f7');
      rect(ctx, -2, -12.5, 4.4, 3, '#2a3a5a', 1.4);
      rect(ctx, -4.6, -8, 2, 6, '#d9dde6', 1);
    });
  },
  shell(ctx) {
    // The dome: glazing bars fanning down from overhead, with hoops across them.
    ctx.lineCap = 'round';
    const bars = (width: number, colour: string) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let k = -9; k <= 9; k++) {
        for (let i = 0; i <= 20; i++) {
          const p = domeBar(k, 0.2 + (i / 20) * 0.8);
          if (i) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
      }
      for (const u of [0.44, 0.58, 0.72, 0.86]) {
        for (let k = -9; k <= 9; k += 0.25) {
          const p = domeBar(k, u);
          if (k > -9) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
      }
      ctx.stroke();
    };
    bars(2.6, 'rgba(60,70,92,0.75)');
    bars(1.3, 'rgba(226,232,244,0.8)');
    for (const u of [0.44, 0.58, 0.72, 0.86]) {
      for (let k = -9; k <= 9; k++) {
        const p = domeBar(k, u);
        circle(ctx, p.x, p.y, 2.5, '#5a6478');
        circle(ctx, p.x - 0.4, p.y - 0.4, 1.5, '#e6ebf5');
      }
    }
    fillAcross(ctx, -400, 226, 'rgba(140,170,220,0.035)');
    poly(ctx, [250, 226, 330, -40, 372, -40, 292, 226], 'rgba(255,255,255,0.022)');
    // The brewery's copper.
    vat(ctx, -78, 1.05);
    vat(ctx, 474, 1.05);
    vat(ctx, -150, 0.85);
    vat(ctx, 548, 0.85);
    for (const [x0, x1] of [[-60, -4], [470, 404]]) {
      curve(ctx, [x0, 90, lerp(x0, x1, 0.6), 80, x1, 110, x1, 226], '#a8632f', 5);
      curve(ctx, [x0, 89, lerp(x0, x1, 0.6), 79, x1 - 1, 110, x1 - 1, 226], '#e09a5a', 1.4);
    }
  },
  mid(ctx, t) {
    for (const [x, s] of [[-78, 1.05], [474, 1.05]]) {
      // Gauge needle, bubbling sight glass, and a wisp of steam.
      const gx = x + 9 * s, gy = 226 - 70 * s;
      const a = -0.6 + Math.sin(t * 1.3 + x) * 0.5 + Math.sin(t * 7 + x) * 0.05;
      line(ctx, gx, gy, gx + Math.sin(a) * 5, gy - Math.cos(a) * 5, '#c8323a', 0.9);
      const sx = x - 3.5 * s;
      rect(ctx, sx - 1.6, 226 - 42 * s, 3.2, 28 * s, '#e0a030', 1.4);
      for (let k = 0; k < 4; k++) circle(ctx, sx + Math.sin(t * 4 + k) * 0.6, 226 - 15 * s - ((t * 9 + k * 7) % 27) * s, 0.9, '#fff3c8');
      for (let k = 0; k < 5; k++) {
        const p = (t * 0.25 + k / 5) % 1;
        circle(ctx, x + Math.sin(p * 4 + k) * 6, 226 - 146 * s - p * 40, 3 + p * 9, alpha('#f1f3f7', 0.3 * (1 - p)));
      }
      glow(ctx, x, 160, 70, '#ffb070', 0.22);
    }
    across(200, 148, (x, n) => pendant(ctx, x, 22, t * 0.5, n * 2, '#3a3e4a', '#ffd9a0', { kind: 'bulb', cone: 0.6 }));
  },
  front(ctx, t) {
    motes(ctx, t * 0.4, 16, 31, '#e6ebf5', { y0: 30, y1: 200, a: 0.35, size: 0.7 });
  },
};

// ---------------------------------------------------------------- Solar System Social Club

/** [distance in planet radii, width, colour, strength]: Saturn's rings, inside to out. */
const RINGS: [number, number, string, number][] = [
  [1.3, 0.1, '#a89270', 0.45], [1.5, 0.22, '#ecdcb0', 0.9], [1.76, 0.24, '#d9c290', 0.85], [2.05, 0.16, '#c9b68a', 0.75],
  [2.24, 0.03, '#ecdcb0', 0.45],
];
const SATURN = { x: 300, y: 62, r: 60, tilt: -0.2, squash: 0.25 };

function saturn(ctx: Ctx, t: number) {
  const S = SATURN;
  /** A point on the ring plane, `d` planet radii out. */
  const onPlane = (d: number, a: number) => {
    const x = Math.cos(a) * d * S.r, y = Math.sin(a) * d * S.r * S.squash;
    return { x: S.x + x * Math.cos(S.tilt) - y * Math.sin(S.tilt), y: S.y + x * Math.sin(S.tilt) + y * Math.cos(S.tilt), front: Math.sin(a) > 0 };
  };
  const moons: [number, number, number, string, number][] = [[3.1, 5, 0.13, '#e0a050', 1], [2.6, 2, 0.3, '#e6ebf2', 3], [3.8, 2.6, 0.09, '#b9c0cc', 5]];
  const drawMoons = (front: boolean) => {
    for (const [d, r, sp, c, ph] of moons) {
      const p = onPlane(d, t * sp + ph);
      if (p.front === front) ball(ctx, p.x, p.y, r, c, Math.PI * 1.02, { depth: 0.6 });
    }
  };
  const rings = (front: boolean) => {
    at(ctx, S.x, S.y, S.tilt, 1, 1, () => {
      for (const [d, w, c, a] of RINGS) {
        ctx.beginPath();
        ctx.ellipse(0, 0, S.r * d, S.r * d * S.squash, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
        ctx.strokeStyle = alpha(c, a);
        ctx.lineWidth = S.r * w * S.squash * 1.6;
        ctx.stroke();
      }
      if (!front) {
        // The planet's own shadow lies across the rings behind it.
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, S.r * 2.4, S.r * 2.4 * S.squash, 0, Math.PI, TAU);
        ctx.ellipse(0, 0, S.r * 1.2, S.r * 1.2 * S.squash, 0, TAU, Math.PI, true);
        ctx.clip();
        poly(ctx, [S.r * 0.2, -S.r, S.r * 2.6, -S.r * 1.4, S.r * 2.6, S.r * 0.2, S.r * 0.9, 0], 'rgba(8,4,16,0.6)');
        ctx.restore();
      }
    });
  };
  drawMoons(false);
  rings(false);
  glow(ctx, S.x, S.y, S.r * 1.3, '#e8c890', 0.3);
  at(ctx, S.x, S.y, S.tilt, 1, 1, () => {
    ball(ctx, 0, 0, S.r, '#e3c58e', Math.PI * 1.06, {
      bands: ['#d9b878', '#ecd6a0', '#c9a468', '#e8cf98', '#f0deb0', '#d2b074', '#e6cb92', '#c0995c', '#dcc088', '#b98f58'],
      dark: '#1a0e1c', depth: 0.62,
    });
    // The rings' shadow, a thin line across the cloud tops.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, S.r, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, -S.r * 0.12, S.r * 1.6, S.r * 1.6 * S.squash, 0, 0, Math.PI);
    ctx.strokeStyle = 'rgba(40,22,30,0.32)';
    ctx.lineWidth = S.r * 0.08;
    ctx.stroke();
    ctx.restore();
  });
  rings(true);
  drawMoons(true);
}

/** A lump of ring ice going past the window. */
function iceChunk(ctx: Ctx, x: number, y: number, s: number, rot: number, i: number) {
  at(ctx, x, y, rot, 1, 1, () => {
    const pts: number[] = [], lit: number[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU, r = s * (0.65 + hash(i * 7 + k, 67) * 0.5);
      pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.8);
      lit.push(Math.cos(a) * r * 0.62 - s * 0.16, Math.sin(a) * r * 0.5 - s * 0.14);
    }
    poly(ctx, pts, '#6a7890');
    poly(ctx, lit, '#dfe8f4');
  });
}

const solar: Backdrop = {
  fog: '#2a1634', haze: 0.18, dim: 0.16, shine: 0.9, vignette: 0.62,
  bar: { kind: 'neon', top: '#3a2a46', front: '#1a1222', trim: '#f0c878', glow: '#ff9a3c' },
  far(ctx, t) {
    sky(ctx, ['#05030c', '#0e0820', '#1a0e2c']);
    gas(ctx, nebula(8, ['#5a2a7a', '#8a3a5a', '#2a3a8a']), 300, 110, 700, 260, 0.5, 0.15);
    stars(ctx, t, 180, 13, { twinkle: 0.6 });
    // The Sun, a long way off, with the inner planets going round it like a mobile.
    const sx = 66, sy = 66;
    const inner: [number, number, number, string, number][] = [
      [22, 1.3, 0.9, '#c9b29a', 0.4], [34, 2, 0.62, '#f0d9a0', 2.2], [48, 2.2, 0.45, '#5aa8f4', 4.1], [62, 1.7, 0.34, '#e8724a', 1.3],
      [92, 5, 0.16, '#e3b889', 3.2],
    ];
    const where = (r: number, a: number) => ({ x: sx + Math.cos(a) * r - Math.sin(a) * r * 0.03, y: sy + Math.sin(a) * r * 0.2 + Math.cos(a) * r * 0.05, front: Math.sin(a) > 0 });
    ctx.strokeStyle = 'rgba(255,224,180,0.12)';
    ctx.lineWidth = 0.6;
    for (const [r] of inner) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.2, 0.05, 0, TAU);
      ctx.stroke();
    }
    const planets = (front: boolean) => {
      inner.forEach(([r, size, sp, c, ph], i) => {
        const p = where(r, t * sp * 0.5 + ph);
        if (p.front !== front) return;
        ball(ctx, p.x, p.y, size, c, Math.atan2(sy - p.y, sx - p.x), i === 4 ? { bands: ['#c98a5a', '#f0d0a8', '#c98a5a', '#f0d0a8', '#b97a4a'], depth: 0.5 } : { depth: 0.5 });
        if (i === 2) circle(ctx, p.x + Math.cos(t * 1.4) * 5, p.y + Math.sin(t * 1.4) * 1.6, 0.7, '#d9dbe2');
      });
    };
    planets(false);
    sun(ctx, sx, sy, 6, t, '#fff8e0', '#ffb850');
    planets(true);
    saturn(ctx, t);
    // A comet.
    const cp = (t * 0.045) % 1, cx = lerp(X1 + 60, X0 - 60, cp), cy = 14 + cp * 50;
    const g = ctx.createLinearGradient(cx, cy, cx + 90, cy - 26);
    g.addColorStop(0, 'rgba(190,230,255,0.75)');
    g.addColorStop(1, 'rgba(190,230,255,0)');
    ctx.fillStyle = g;
    poly(ctx, [cx, cy - 2, cx, cy + 2, cx + 90, cy - 26]);
    ctx.fill();
    glow(ctx, cx, cy, 9, '#dff4ff', 0.95);
    shootingStar(ctx, t, 4, '#ffe0c0');
    // We are parked in the outermost ring: ice drifts by the windows.
    for (let i = 0; i < 26; i++) {
      const depth = hash(i, 64);
      const s = 1 + depth * depth * 7;
      iceChunk(ctx, drift(hash(i, 65) * SPAN, -(2 + depth * 9), t, 20), 96 + hash(i, 66) * 90 + Math.sin(t * 0.3 + i) * 3, s, t * (hash(i, 68) - 0.5) * 0.8 + i, i);
    }
  },
  shell(ctx) {
    // A social club: plum flock wallpaper, and tall windows with their corners rounded off.
    wallpaper(ctx, -400, 180, '#2e1a3e', 'rgba(240,200,120,0.06)', 'diamond');
    across(14, 200, (x) => {
      const w = 172, y = 24, h = 150;
      archPath(ctx, x - 7, y - 7, w + 14, h + 9, 46);
      ctx.fillStyle = '#140a1e';
      ctx.fill();
      archPath(ctx, x - 4, y - 4, w + 8, h + 6, 43);
      ctx.fillStyle = vgrad(ctx, y, y + h, ['#f0c878', '#a8762e']);
      ctx.fill();
      archPath(ctx, x - 1.4, y - 1.4, w + 2.8, h + 3, 40.6);
      ctx.fillStyle = '#3a2412';
      ctx.fill();
      punch(ctx, () => archPath(ctx, x, y, w, h, 39.4));
      archPath(ctx, x, y, w, h, 39.4);
      ctx.fillStyle = 'rgba(255,190,130,0.03)';
      ctx.fill();
      poly(ctx, [x + 26, y + h - 2, x + 76, y + 4, x + 98, y + 4, x + 48, y + h - 2], 'rgba(255,255,255,0.03)');
      // A fan of gilt between the windows.
      const px = x + w + 14;
      for (let k = -3; k <= 3; k++) line(ctx, px, 74, px + k * 3.4, 52 + Math.abs(k) * 2.4, '#d9b25a', 1.1);
      rect(ctx, px - 5, 74, 10, 3, '#f0c878', 1);
      rect(ctx, px - 1.4, 77, 2.8, 96, 'rgba(240,200,120,0.3)');
    });
    wainscot(ctx, 176, 226, '#3a1e36');
    fillAcross(ctx, -400, 8, '#1a0e22');
  },
  mid(ctx, t) {
    // Tinsel along the top, as left up since some long-ago Christmas.
    for (let x = X0; x < X1; x += 2.6) {
      const i = Math.round(x * 10);
      const len = 9 + hash(i, 73) * 9;
      const sh = 0.35 + 0.65 * Math.abs(Math.sin(t * (1.5 + hash(i, 74) * 3) + i));
      rect(ctx, x, 6, 1.5, len, alpha(['#ffd36b', '#ff8fbd', '#fff3c8', '#c78cff'][i & 3], sh * 0.85));
    }
    // Wall lights over the gilt fans.
    across(200, 200, (x, n) => glow(ctx, x, 60, 34, '#ffc880', 0.5 + 0.08 * Math.sin(t * 2 + n)));
    // The mirror ball, and what it throws round the room.
    const bx = 200, by = 22;
    line(ctx, bx, -200, bx, by - 9, '#17100e', 1);
    circle(ctx, bx, by, 9, '#8a93a6');
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, TAU);
    ctx.clip();
    for (let r = -3; r <= 3; r++) {
      for (let c = -4; c <= 4; c++) {
        const lit = hash(r * 9 + c, Math.floor(t * 5 + hash(r, c) * 6));
        rect(ctx, bx + c * 2.6 + ((t * 3 + r) % 2.6) - 1.3, by + r * 2.6 - 1.1, 2.1, 2.1, lit > 0.72 ? '#ffffff' : lit > 0.4 ? '#c9d0dc' : '#6a7488');
      }
    }
    ctx.restore();
    glow(ctx, bx, by, 26, '#ffffff', 0.35);
    for (let i = 0; i < 20; i++) {
      const x = drift(i * 41, (i % 2 ? 1 : -1) * (16 + hash(i, 75) * 16), t, 10);
      const y = 20 + hash(i, 76) * 170 + Math.sin(t * 0.7 + i) * 6;
      glow(ctx, x, y, 5.5, ['#ffffff', '#ffd9b0', '#ffc0e8'][i % 3], 0.5);
    }
  },
  front(ctx, t) {
    glow(ctx, 60, 70, 220, '#ffa850', 0.1 + 0.02 * Math.sin(t));
    motes(ctx, t, 12, 35, '#ffd9b0', { y0: 20, y1: 200, a: 0.35, size: 0.8 });
  },
};

// ---------------------------------------------------------------- The Little Green Man

function saucer(ctx: Ctx, x: number, y: number, s: number, t: number, ph = 0, legs = false) {
  at(ctx, x, y, legs ? 0 : Math.sin(t * 1.7 + ph) * 0.07, s, s, () => {
    if (legs) {
      for (const lx of [-12, 12]) {
        line(ctx, lx * 0.7, 3, lx, 11, '#5a6478', 1.3);
        ellipse(ctx, lx, 11.4, 2.6, 0.9, '#3a4458');
      }
    } else glow(ctx, 0, 5, 28, '#9fffd0', 0.45, 0.5);
    // The bubble, and whoever's driving.
    ctx.beginPath();
    ctx.ellipse(0, -2, 9.4, 9.6, 0, Math.PI, TAU);
    ctx.fillStyle = 'rgba(122,240,255,0.5)';
    ctx.fill();
    if (!legs) {
      ellipse(ctx, 0, -5.4, 3, 3.6, '#4fbf62');
      ellipse(ctx, -1.2, -5.8, 0.9, 1.3, '#0c1410', -0.3);
      ellipse(ctx, 1.3, -5.8, 0.9, 1.3, '#0c1410', 0.3);
    }
    ellipse(ctx, -4, -7.4, 2.2, 1, 'rgba(255,255,255,0.6)', -0.6);
    // The hull.
    ellipse(ctx, 0, 0.6, 24, 6, '#6a7488');
    ellipse(ctx, 0, -0.8, 23.4, 4.8, '#c2c9d6');
    ellipse(ctx, 0, -2.2, 14, 2.6, '#e6ebf2');
    ellipse(ctx, 0, 4.2, 10, 2.2, '#4a5468');
    for (let i = 0; i < 7; i++) {
      const lx = -18 + i * 6, ly = 1.4 + (1 - (lx / 20) ** 2) * 1.8;
      const on = (((Math.floor(t * 7 + ph * 3) - i) % 7) + 7) % 7 < 2;
      circle(ctx, lx, ly, 1.2, on ? '#fff3a0' : '#7a6a3a');
      if (on) glow(ctx, lx, ly, 5, '#ffe15c', 0.8);
    }
  });
}

/** A tree, of a sort: a stalk with a glowing cap. */
function shroom(ctx: Ctx, x: number, base: number, h: number, t: number, ph: number, c: string, stalk = '#241a44') {
  const sway = Math.sin(t * 0.7 + ph) * h * 0.05;
  const cx = x + sway + h * 0.08, cy = base - h, r = h * 0.44;
  curve(ctx, [x, base, x - h * 0.06 + sway * 0.3, base - h * 0.5, cx, cy], stalk, Math.max(1.2, h * 0.1));
  glow(ctx, cx, cy, r * 2.6, c, 0.42 + 0.14 * Math.sin(t * 1.3 + ph));
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.66, 0, Math.PI, TAU);
  ctx.fillStyle = c;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.8, r * 0.5, 0, Math.PI * 1.08, Math.PI * 1.6);
  ctx.strokeStyle = alpha(tint(c, 0.6), 0.8);
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  ctx.stroke();
  ellipse(ctx, cx, cy, r, r * 0.16, shade(c, 0.5));
  ellipse(ctx, cx, cy + r * 0.04, r * 0.7, r * 0.08, alpha(tint(c, 0.7), 0.7));
  for (const [dx, dy, s] of [[0.36, -0.32, 0.11], [-0.2, -0.42, 0.08], [0.02, -0.2, 0.07], [0.62, -0.14, 0.06]]) {
    circle(ctx, cx + dx * r, cy + dy * r, r * s, tint(c, 0.65));
  }
}

/** A tower of rock, wider at the top than the bottom. */
function spire(ctx: Ctx, x: number, base: number, w: number, h: number, fill: string, lit: string) {
  const pts = [
    x - w * 0.5, base, x - w * 0.3, base - h * 0.56, x - w * 0.62, base - h * 0.74, x - w * 0.5, base - h, x + w * 0.46, base - h * 0.97,
    x + w * 0.62, base - h * 0.72, x + w * 0.3, base - h * 0.55, x + w * 0.5, base,
  ];
  poly(ctx, pts, fill);
  poly(ctx, [x + w * 0.1, base - h * 0.98, x + w * 0.46, base - h * 0.97, x + w * 0.62, base - h * 0.72, x + w * 0.3, base - h * 0.55, x + w * 0.5, base, x + w * 0.22, base, x + w * 0.1, base - h * 0.6, x + w * 0.34, base - h * 0.74], lit);
}

function cow(ctx: Ctx, x: number, y: number, s: number, rot: number, t: number) {
  at(ctx, x, y, rot, s, s, () => {
    const kick = Math.sin(t * 5) * 0.8;
    for (const [lx, k] of [[-6.4, 1], [-3.4, -1], [3.6, 1], [6.4, -1]]) {
      line(ctx, lx, 3.4, lx + kick * k, 10, '#f4f1e8', 1.9);
      line(ctx, lx + kick * k, 9.4, lx + kick * k, 10.4, '#3a2a22', 1.9, 'butt');
    }
    curve(ctx, [-9, -1.4, -12.4, 1, -12 + kick, 5.4], '#f4f1e8', 0.9);
    ellipse(ctx, 0, 0, 9.6, 5.6, '#f4f1e8');
    ellipse(ctx, -3.4, -1.6, 3.4, 2.4, '#26262c', 0.3);
    ellipse(ctx, 4, 2, 2.6, 1.8, '#26262c', -0.4);
    ellipse(ctx, 1.4, 5, 2.4, 1.3, '#f0a8b0');
    ellipse(ctx, 10.4, -3.6, 3.8, 3.2, '#f4f1e8');
    ellipse(ctx, 8.4, -6.4, 1.7, 1, '#26262c', -0.6);
    ellipse(ctx, 12.8, -2.6, 2, 1.7, '#f0b0b0');
    circle(ctx, 10.4, -4.6, 0.7, '#17131a');
  });
}

const alienWorld: Backdrop = {
  fog: '#2a2456', haze: 0.16, dim: 0.11, shine: 0.95, vignette: 0.58,
  bar: { kind: 'neon', top: '#1f3a44', front: '#0c1a22', trim: '#9fffd0', glow: '#5cffb0' },
  far(ctx, t) {
    sky(ctx, [0, '#0a1436', 0.3, '#2a2a72', 0.5, '#7a3a8c', 0.63, '#e86a7c', 0.7, '#ffc48a', 1, '#ffc48a']);
    stars(ctx, t, 90, 44, { yMax: 80, twinkle: 0.7 });
    // The neighbours: a ringed giant filling a corner of the sky, and two suns going down.
    ctx.save();
    ctx.globalAlpha = 0.85;
    at(ctx, 52, 26, -0.42, 1, 1, () => {
      const rings = (front: boolean) => {
        for (const [d, w, a] of [[1.5, 5, 0.5], [1.75, 3, 0.35], [1.95, 1.4, 0.3]]) {
          ctx.beginPath();
          ctx.ellipse(0, 0, 44 * d, 44 * d * 0.22, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
          ctx.strokeStyle = alpha('#f0c8e0', a);
          ctx.lineWidth = w;
          ctx.stroke();
        }
      };
      rings(false);
      ball(ctx, 0, 0, 44, '#c88ad0', 1.2, { bands: ['#b87ac8', '#d89ad8', '#a86ab8', '#e0a8dc', '#c080c8', '#9a5aa8', '#d090d0'], dark: '#2a2a72', depth: 0.6 });
      rings(true);
    });
    ctx.restore();
    glow(ctx, 392, 132, 110, '#ffb060', 0.75);
    circle(ctx, 392, 132, 17, '#fff0c0');
    glow(ctx, 438, 104, 40, '#bfe0ff', 0.9);
    circle(ctx, 438, 104, 5.5, '#ffffff');
    // Saucers coming and going, a long way off.
    for (let i = 0; i < 3; i++) saucer(ctx, drift(i * 300, (i % 2 ? -1 : 1) * (24 + i * 9), t, 60), 26 + i * 16 + Math.sin(t * 1.1 + i * 2) * 5, 0.34 + i * 0.07, t, i * 2);
    // Country the like of which you have not seen.
    for (const [x, w, h] of [[-150, 26, 70], [-96, 16, 46], [-20, 22, 84], [14, 12, 50], [150, 18, 58], [226, 30, 92], [262, 14, 54], [470, 24, 80], [520, 14, 48], [560, 20, 66]]) {
      spire(ctx, x, 150, w, h, '#4a2f78', '#8a4a8a');
    }
    hills(ctx, 141, 9, 3.3, '#3a2a6c', 1.4);
    for (let i = 0; i < 14; i++) {
      const x = X0 + hash(i, 201) * SPAN;
      shroom(ctx, x, hillY(x, 141, 9, 3.3, 1.4) + 2, 10 + hash(i, 202) * 14, t, i * 1.7, ['#5cffd0', '#ff7ad1', '#ffe15c', '#7ad7ff'][i % 4], '#2a1f54');
    }
    hills(ctx, 152, 8, 7.1, vgrad(ctx, 144, 226, ['#1f5a62', '#123a4a']), 1);
    // The car park.
    for (const [x, s] of [[-70, 0.6], [108, 0.5], [236, 0.66], [452, 0.56]]) {
      const y = hillY(x, 152, 8, 7.1, 1);
      ellipse(ctx, x, y + 8.6 * s, 20 * s, 2.4 * s, 'rgba(6,16,26,0.45)');
      saucer(ctx, x, y + 1, s, t, x, true);
    }
    // Closer in: bigger trees, and something with tentacles for leaves.
    for (const [x, h, c] of [[-120, 52, '#5cffd0'], [30, 40, '#ff7ad1'], [296, 34, '#ffe15c'], [410, 58, '#7ad7ff'], [540, 44, '#ff7ad1']] as const) {
      shroom(ctx, x, 176, h, t, x, c);
    }
    for (const x of [-40, 190, 500]) {
      for (let k = 0; k < 5; k++) {
        const a = -1.1 + k * 0.55, w = Math.sin(t * 1.1 + k * 1.3 + x) * 5;
        curve(ctx, [x, 178, x + Math.sin(a) * 9, 162, x + Math.sin(a) * 16 + w, 150 - Math.cos(a) * 8], '#2f8a6a', 1.6);
        circle(ctx, x + Math.sin(a) * 16 + w, 150 - Math.cos(a) * 8, 1.7, '#d6ff7a');
        glow(ctx, x + Math.sin(a) * 16 + w, 150 - Math.cos(a) * 8, 6, '#d6ff7a', 0.6);
      }
    }
    // Somebody is collecting livestock.
    const ux = 338 + Math.sin(t * 0.3) * 16, uy = 54 + Math.sin(t * 0.8) * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = vgrad(ctx, uy, 160, ['rgba(160,255,210,0.5)', 'rgba(160,255,210,0.1)']);
    poly(ctx, [ux - 6, uy + 4, ux + 6, uy + 4, ux + 24, 162, ux - 24, 162]);
    ctx.fill();
    ctx.restore();
    ellipse(ctx, ux, 162, 24, 4, 'rgba(160,255,210,0.35)');
    const lift = (t * 0.07) % 1;
    cow(ctx, ux + Math.sin(t * 1.3) * 3, lerp(150, uy + 12, lift), lerp(1, 0.45, lift), t * 0.9, t);
    saucer(ctx, ux, uy, 1.15, t, 1);
  },
  shell(ctx) {
    // The beer garden: poles for the lights, and the sign.
    across(85, 130, (x) => {
      rect(ctx, x - 1.6, 12, 3.2, 216, '#1a1638', 1.4);
      rect(ctx, x - 1.6, 12, 1, 216, 'rgba(160,255,210,0.25)');
      circle(ctx, x, 11, 3.4, '#d6ff7a');
    });
    at(ctx, 345, 0, 0, 1, 1, () => {
      line(ctx, 0, 30, 30, 30, '#1a1638', 2.4, 'butt');
      line(ctx, 0, 44, 16, 30, '#1a1638', 1.4);
      for (const hx of [10, 26]) line(ctx, hx, 30, hx, 37, '#0c0a1c', 0.9);
      rect(ctx, 4, 37, 28, 34, '#1a1638', 2.4);
      rect(ctx, 6, 39, 24, 30, '#f1ead9', 1.4);
      rect(ctx, 6, 39, 24, 30, 'rgba(60,40,90,0.12)', 1.4);
      // The Little Green Man himself.
      blob(ctx, [18, 43, 26.4, 47, 26, 54, 22, 62, 18, 65, 14, 62, 10, 54, 9.6, 47], '#4fbf62', 0.5);
      ellipse(ctx, 14.2, 52.4, 2.5, 3.9, '#0c1410', -0.4);
      ellipse(ctx, 21.8, 52.4, 2.5, 3.9, '#0c1410', 0.4);
      circle(ctx, 13.6, 51, 0.7, '#ffffff');
      circle(ctx, 21.2, 51, 0.7, '#ffffff');
      curve(ctx, [15.6, 60, 18, 61.2, 20.4, 60], '#1f5a2c', 0.8);
    });
  },
  mid(ctx, t) {
    glow(ctx, 363, 54, 36, '#d6ff7a', 0.16);
    across(85, 130, (x, n) => {
      glow(ctx, x, 11, 14, '#d6ff7a', 0.7 + 0.2 * Math.sin(t * 2 + n));
      festoon(ctx, x, 14, x + 130, 14, 7, t, ['#7affc1', '#ff7ad1', '#ffe15c', '#7ad7ff'], 8, 2, 1);
    });
    // Whatever these are, they like the lights.
    for (let i = 0; i < 9; i++) {
      const x = drift(i * 97, (i % 2 ? 1 : -1) * (5 + hash(i, 211) * 6), t, 20) + Math.sin(t * 2.3 + i) * 6;
      const y = 40 + hash(i, 212) * 90 + Math.sin(t * 1.7 + i * 2) * 8;
      const flap = Math.abs(Math.sin(t * 14 + i));
      const c = ['#d6ff7a', '#7affc1', '#ff9af0'][i % 3];
      glow(ctx, x, y, 7, c, 0.6);
      ellipse(ctx, x - 1.6, y - flap * 1.4, 2, 0.9, alpha(c, 0.8), -0.5 - flap * 0.5);
      ellipse(ctx, x + 1.6, y - flap * 1.4, 2, 0.9, alpha(c, 0.8), 0.5 + flap * 0.5);
      circle(ctx, x, y, 0.9, '#ffffff');
    }
  },
  front(ctx, t) {
    glow(ctx, 392, 132, 200, '#ff9a60', 0.1);
    motes(ctx, t, 18, 51, '#9fffd0', { y0: 30, y1: 205, a: 0.5, size: 0.8, rise: 6 });
  },
};

// ---------------------------------------------------------------- The Galaxy Arms

function galaxyImage(): HTMLCanvasElement {
  let c = sprites.get('galaxy');
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.globalCompositeOperation = 'lighter';
  const arms = 2;
  const armAngle = (r: number) => r * 0.026;
  // Gas along the arms first, then the stars in it.
  for (let i = 0; i < 150; i++) {
    const r = 26 + hash(i, 138) * 210, a = ((i % arms) / arms) * TAU + armAngle(r) + (hash(i, 139) - 0.5) * 0.5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, s = 18 + hash(i, 140) * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, alpha(i % 5 === 0 ? '#ff6ac0' : i % 2 ? '#5a7cff' : '#8a6aff', 0.1));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  for (let i = 0; i < 7000; i++) {
    const u = hash(i, 131) ** 0.8, r = 10 + u * 236;
    const arm = Math.floor(hash(i, 132) * arms);
    const a = (arm / arms) * TAU + armAngle(r) + (hash(i, 133) - 0.5) * (0.4 + (1 - u) * 1.3);
    const col = hash(i, 134) < 0.16 ? '#ff9ad6' : u < 0.3 ? '#fff0c8' : hash(i, 135) < 0.5 ? '#9fc8ff' : '#c9b0ff';
    g.fillStyle = alpha(col, 0.12 + hash(i, 136) * 0.5);
    const s = 0.6 + hash(i, 137) ** 3 * 2.6;
    g.fillRect(Math.cos(a) * r, Math.sin(a) * r, s, s);
  }
  // Dust on the inside edge of each arm.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 120; i++) {
    const r = 40 + hash(i, 145) * 170, a = ((i % arms) / arms) * TAU + armAngle(r) - 0.42 + (hash(i, 146) - 0.5) * 0.14;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, s = 7 + hash(i, 147) * 9;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  g.globalCompositeOperation = 'lighter';
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 84);
  core.addColorStop(0, 'rgba(255,250,230,1)');
  core.addColorStop(0.22, 'rgba(255,226,170,0.75)');
  core.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = core;
  g.fillRect(-84, -84, 168, 168);
  sprites.set('galaxy', c);
  return c;
}

/** Stars joined up into a picture. Points are x,y pairs; `links` are pairs of point numbers. */
function constellation(ctx: Ctx, t: number, x: number, y: number, pts: number[], links: number[], seed: number) {
  ctx.strokeStyle = 'rgba(190,220,255,0.3)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 0; i < links.length; i += 2) {
    ctx.moveTo(x + pts[links[i] * 2], y + pts[links[i] * 2 + 1]);
    ctx.lineTo(x + pts[links[i + 1] * 2], y + pts[links[i + 1] * 2 + 1]);
  }
  ctx.stroke();
  for (let i = 0; i < pts.length; i += 2) {
    const tw = 0.7 + 0.3 * Math.sin(t * (1 + hash(i, seed)) + i);
    glow(ctx, x + pts[i], y + pts[i + 1], 6, '#bfe0ff', 0.7 * tw);
    sparkle(ctx, x + pts[i], y + pts[i + 1], 2.2 + hash(i, seed + 1) * 1.4, '#ffffff', tw);
  }
}

const BAY = { first: 60, pitch: 150 };

const galaxy: Backdrop = {
  fog: '#1c1248', haze: 0.19, dim: 0.18, shine: 0.9, vignette: 0.62,
  bar: { kind: 'neon', top: '#2a2456', front: '#0e0b22', trim: '#e0c078', glow: '#7a5cff' },
  far(ctx, t) {
    sky(ctx, ['#03020c', '#0a0722', '#170d3a']);
    gas(ctx, nebula(16, ['#3a2a9a', '#8a2a7a', '#1f6a8a']), 10, 80, 560, 300, 0.9, 0.5 + Math.sin(t * 0.02) * 0.02);
    gas(ctx, nebula(17, ['#8a2a7a', '#c0508a', '#5a2aa0']), 470, 150, 460, 240, 0.8, -0.3);
    stars(ctx, t, 240, 16, { twinkle: 0.8 });
    stars(ctx, t, 40, 17, { twinkle: 1.4, size: 1.6, colour: '#bfd6ff' });
    // The galaxy itself, turning.
    const gx = 322, gy = 74;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(-0.3);
    ctx.scale(1, 0.42);
    ctx.rotate(t * 0.02);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(galaxyImage(), -250, -250, 500, 500);
    ctx.restore();
    glow(ctx, gx, gy, 66, '#fff0c8', 0.55 + 0.05 * Math.sin(t * 0.8));
    glow(ctx, gx, gy, 150, '#fff0c8', 0.3, 0.05);
    // The Great Pint, and The Plough.
    constellation(ctx, t, 28, 30, [0, 0, 26, 0, 22, 44, 4, 44, 2, 12, 24, 12, 13, 26], [0, 1, 1, 2, 2, 3, 3, 0, 4, 5], 301);
    constellation(ctx, t, 452, 22, [0, 14, 18, 8, 34, 12, 48, 20, 50, 38, 76, 42, 78, 22], [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 3], 311);
    for (let i = 0; i < 3; i++) shootingStar(ctx, t + i * 2.2, 10 + i, ['#ffffff', '#9fe7ff', '#ff9af0'][i]);
    // Ships jumping past in streaks.
    for (let i = 0; i < 3; i++) {
      const period = 7 + i * 3.1, p = ((t + i * 2.7) / period) % 1;
      if (p > 0.16) continue;
      const u = p / 0.16, y = 30 + hash(Math.floor((t + i * 2.7) / period), 140 + i) * 110;
      const dir = i % 2 ? 1 : -1, x = dir > 0 ? lerp(X0, X1, u) : lerp(X1, X0, u);
      const g = ctx.createLinearGradient(x, y, x - dir * 130, y);
      g.addColorStop(0, 'rgba(200,240,255,0.9)');
      g.addColorStop(1, 'rgba(200,240,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x, x - dir * 130), y - 0.8, 130, 1.6);
      glow(ctx, x, y, 7, '#dff6ff', 0.9);
    }
  },
  shell(ctx) {
    // A great glasshouse at the edge of everything: gilded columns, pointed arches, tracery between.
    const gilt = (width: number, trace: () => void) => {
      for (const [w, c] of [[width, '#4a3216'], [width * 0.66, '#d9b25a'], [width * 0.2, '#fff0b8']] as const) {
        ctx.beginPath();
        trace();
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    };
    const P = BAY.pitch, spring = 96;
    across(BAY.first, P, (x) => {
      const m = x + P / 2;
      // Tracery: two lights and a rose over them.
      gilt(2.2, () => {
        ctx.moveTo(m, 190);
        ctx.lineTo(m, 70);
        ctx.moveTo(x, spring);
        ctx.quadraticCurveTo(x + 4, 52, m - P / 4, 34);
        ctx.quadraticCurveTo(m - 4, 52, m, 70);
        ctx.quadraticCurveTo(m + 4, 52, m + P / 4, 34);
        ctx.quadraticCurveTo(x + P - 4, 52, x + P, spring);
        ctx.moveTo(m + 13, 22);
        ctx.arc(m, 22, 13, 0, TAU);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + 0.5;
          ctx.moveTo(m, 22);
          ctx.lineTo(m + Math.cos(a) * 13, 22 + Math.sin(a) * 13);
        }
      });
      // The main arch.
      gilt(6, () => {
        ctx.moveTo(x, spring);
        ctx.bezierCurveTo(x + 2, 30, x + 30, -30, m, -62);
        ctx.bezierCurveTo(x + P - 30, -30, x + P - 2, 30, x + P, spring);
      });
    });
    across(BAY.first, P, (x) => {
      // Columns, fluted, with a capital where the arches spring.
      rect(ctx, x - 6, spring, 12, 100, '#4a3216');
      rect(ctx, x - 5, spring, 10, 100, hgrad(ctx, x - 5, x + 5, ['#fff0b8', '#d9b25a', '#6a4a22']));
      for (const fx of [-2.4, 0.4, 3]) rect(ctx, x + fx, spring + 6, 0.8, 90, 'rgba(74,50,22,0.5)');
      poly(ctx, [x - 10, spring - 6, x + 10, spring - 6, x + 6.4, spring + 3, x - 6.4, spring + 3], '#d9b25a');
      rect(ctx, x - 11, spring - 9, 22, 3.4, '#fff0b8', 1);
      circle(ctx, x, spring - 14, 4.4, '#d9b25a');
      circle(ctx, x - 1.2, spring - 15.2, 1.6, '#fff0b8');
    });
    fillAcross(ctx, -400, 226, 'rgba(160,140,255,0.03)');
    // Balustrade.
    fillAcross(ctx, 190, 226, 'rgba(18,12,46,0.86)');
    across(0, 12, (x) => {
      ellipse(ctx, x, 208, 2.2, 9, 'rgba(217,178,90,0.5)');
      rect(ctx, x - 0.8, 192, 1.6, 34, 'rgba(217,178,90,0.5)');
    });
    fillAcross(ctx, 186, 191, vgrad(ctx, 186, 191, ['#fff0b8', '#a8823a']));
  },
  mid(ctx, t) {
    // Lanterns that float by themselves.
    for (let i = 0; i < 9; i++) {
      const x = X0 + 40 + i * 88 + Math.sin(t * 0.3 + i * 2) * 12, y = 52 + (i % 3) * 30 + Math.sin(t * 0.6 + i * 1.7) * 8;
      const c = ['#ff9af0', '#9fe7ff', '#ffe08a'][i % 3];
      glow(ctx, x, y, 34, c, 0.5 + 0.12 * Math.sin(t * 2 + i));
      ellipse(ctx, x, y, 4.6, 6, tint(c, 0.6));
      ellipse(ctx, x - 1.2, y - 1.4, 1.4, 2.4, 'rgba(255,255,255,0.7)');
      rect(ctx, x - 2.6, y - 8, 5.2, 2, '#d9b25a', 0.8);
      rect(ctx, x - 2.6, y + 6, 5.2, 2, '#d9b25a', 0.8);
      line(ctx, x, y + 8, x, y + 12, '#d9b25a', 0.6);
    }
  },
  front(ctx, t) {
    for (let i = 0; i < 14; i++) {
      const p = (t * (0.05 + hash(i, 141) * 0.05) + hash(i, 142)) % 1;
      sparkle(ctx, X0 + hash(i, 143) * SPAN, lerp(210, 0, p), 3.4 * arc(p), ['#ffffff', '#9fe7ff', '#ff9af0'][i % 3], arc(p) * 0.8);
    }
  },
};

// ---------------------------------------------------------------- The Multiverse Tavern

/** The doorways along the back wall. Each opens on the same pub in a different universe. */
const DOOR = { first: 68, pitch: 132, w: 98, top: 22, bottom: 188, arch: 49 };
const T = DOOR.top, B = DOOR.bottom;

/** A pub, wherever you go. */
function cottage(ctx: Ctx, x: number, y: number, s: number, wall: string, roof: string, win = '#ffe9a0') {
  rect(ctx, x - 9 * s, y - 11 * s, 18 * s, 11 * s, wall);
  poly(ctx, [x - 11 * s, y - 11 * s, x, y - 19 * s, x + 11 * s, y - 11 * s], roof);
  rect(ctx, x + 4 * s, y - 20 * s, 3 * s, 6 * s, roof);
  rect(ctx, x - 2 * s, y - 6 * s, 4 * s, 6 * s, roof);
  rect(ctx, x - 7 * s, y - 8 * s, 3.4 * s, 3.4 * s, win);
  rect(ctx, x + 3.6 * s, y - 8 * s, 3.4 * s, 3.4 * s, win);
  // And its sign.
  line(ctx, x + 14 * s, y, x + 14 * s, y - 15 * s, roof, 0.9 * s, 'butt');
  rect(ctx, x + 14 * s, y - 15 * s, 5 * s, 4.4 * s, win);
}

interface World {
  /** The colour its light throws into the room. */
  light: string;
  paint(ctx: Ctx, x: number, w: number, t: number): void;
  /** Something of it that drifts out through the doorway. */
  leak(ctx: Ctx, x: number, y: number, a: number, t: number, i: number): void;
}

const WORLDS: World[] = [
  {
    // A summer's afternoon that never ends.
    light: '#bfe6ff',
    paint(ctx, x, w, t) {
      rect(ctx, x, T - 30, w, B - T + 30, vgrad(ctx, T, 130, ['#3f9be8', '#8fd0ff', '#e6f6ff']));
      glow(ctx, x + w * 0.72, 48, 44, '#fff3b0', 0.9);
      circle(ctx, x + w * 0.72, 48, 9, '#fff8d0');
      for (let k = 0; k < 3; k++) cloud(ctx, x - 30 + ((t * (3 + k) + k * 57) % (w + 60)), 52 + k * 15, 0.5 + k * 0.12, '#ffffff', '#cfe4f5');
      ellipse(ctx, x + w * 0.85, 150, w * 0.6, 44, '#58ad4e');
      ellipse(ctx, x + w * 0.2, 154, w * 0.7, 46, '#74c45c');
      for (const [tx, s] of [[0.14, 1], [0.24, 0.7], [0.86, 1.1]]) {
        rect(ctx, x + w * tx - 0.8, 104, 1.6, 7, '#6a4a2a');
        circle(ctx, x + w * tx, 100, 6 * s, '#3f8f44');
        circle(ctx, x + w * tx - 2, 98, 3.4 * s, '#5aad54');
      }
      cottage(ctx, x + w * 0.5, 113, 1.5, '#f6efe0', '#8a4a2a');
      rect(ctx, x, 136, w, 60, '#4f9f48');
    },
    leak(ctx, x, y, a, t, i) {
      const flap = Math.abs(Math.sin(t * 12 + i));
      const c = ['#ffe15c', '#ff8fbd', '#ffffff'][i % 3];
      poly(ctx, [x, y, x - 3, y - 3 * flap - 1, x - 3, y + 2], alpha(c, a));
      poly(ctx, [x, y, x + 3, y - 3 * flap - 1, x + 3, y + 2], alpha(c, a));
    },
  },
  {
    // The one where it all went wrong.
    light: '#ff7a2a',
    paint(ctx, x, w, t) {
      rect(ctx, x, T - 30, w, B - T + 30, vgrad(ctx, T, 150, ['#1a0406', '#6a0f0c', '#e8501a', '#ffb040']));
      const flick = 0.8 + 0.2 * Math.sin(t * 7) * Math.sin(t * 3.1);
      for (let k = 0; k < 6; k++) {
        const p = (t * 0.14 + k / 6) % 1;
        circle(ctx, x + w * 0.5 + Math.sin(p * 5 + k) * 10 + p * 16, 70 - p * 60, 6 + p * 14, alpha('#2a0a0c', 0.5 * (1 - p)));
      }
      glow(ctx, x + w * 0.5, 72, 34, '#ffb040', flick);
      poly(ctx, [x - 4, 142, x + w * 0.38, 74, x + w * 0.46, 70, x + w * 0.54, 73, x + w * 0.62, 71, x + w + 4, 142], '#1c0a0c');
      curve(ctx, [x + w * 0.5, 72, x + w * 0.45, 92, x + w * 0.56, 112, x + w * 0.5, 142], '#ff8a2a', 3);
      curve(ctx, [x + w * 0.5, 72, x + w * 0.45, 92, x + w * 0.56, 112, x + w * 0.5, 142], '#ffe08a', 1.1);
      curve(ctx, [x + w * 0.56, 74, x + w * 0.68, 100, x + w * 0.76, 142], '#ff6a1a', 1.8);
      rect(ctx, x, 140, w, 60, vgrad(ctx, 140, 190, ['#ff8a2a', '#c8320a']));
      for (let k = 0; k < 5; k++) ellipse(ctx, x + hash(k, 181) * w, 146 + k * 7, 9 + hash(k, 182) * 9, 2, '#2a0a0c');
      glow(ctx, x + w * 0.5, 150, 60, '#ff6a1a', 0.5 * flick);
      cottage(ctx, x + w * 0.2, 141, 1.15, '#2a0d0d', '#12060a', '#ffd070');
      for (let k = 0; k < 12; k++) {
        const p = (t * (0.2 + hash(k, 183) * 0.2) + hash(k, 184)) % 1;
        circle(ctx, x + hash(k, 185) * w + Math.sin(t * 2 + k) * 3, 150 - p * 120, 0.9, alpha('#ffd070', 1 - p));
      }
    },
    leak(ctx, x, y, a) {
      glow(ctx, x, y, 5, '#ff8a2a', a);
      circle(ctx, x, y, 0.9, alpha('#ffe08a', a));
    },
  },
  {
    // The one where the sea won.
    light: '#5cf0ff',
    paint(ctx, x, w, t) {
      rect(ctx, x, T - 30, w, B - T + 30, vgrad(ctx, T, B, ['#48c8d8', '#0f7a9a', '#063a5a', '#031a30']));
      for (let k = 0; k < 4; k++) beam(ctx, x + w * (0.12 + k * 0.26) + Math.sin(t * 0.4 + k) * 6, T - 12, 0.14 * Math.sin(t * 0.3 + k * 1.7), 170, 0.09, '#bff6ff', 0.28);
      ellipse(ctx, x + w * 0.5, 160, w * 0.8, 26, '#0f4a5a');
      cottage(ctx, x + w * 0.56, 140, 1.4, '#3a7a84', '#1f4a58', '#bff6c0');
      for (let k = 0; k < 6; k++) {
        const kx = x + 6 + k * 17, h = 40 + hash(k, 191) * 40, s = Math.sin(t * 0.9 + k * 1.3) * 6;
        curve(ctx, [kx, B, kx + s * 0.4, B - h * 0.4, kx - s * 0.5, B - h * 0.7, kx + s, B - h], k % 2 ? '#1f8a5a' : '#2fa86a', 2.2);
      }
      for (let k = 0; k < 5; k++) {
        const dir = k % 2 ? 1 : -1, span = w + 36;
        const u = ((t * (7 + k * 2.4) + k * 41) % span) / span;
        const fx = x - 18 + (dir > 0 ? u : 1 - u) * span, fy = 52 + k * 16 + Math.sin(t * 1.2 + k * 2) * 4;
        const c = ['#ff9a3c', '#ffe15c', '#ff7ad1', '#f4f1e8', '#ff6a4a'][k], s = 0.8 + hash(k, 192) * 0.6;
        at(ctx, fx, fy, 0, dir * s, s, () => {
          poly(ctx, [-4, 0, -8.6, -3.4 + Math.sin(t * 9 + k) * 1, -8.6, 3.4 + Math.sin(t * 9 + k) * 1], c);
          ellipse(ctx, 0, 0, 5.6, 3, c);
          ellipse(ctx, 0.6, 1, 4, 1.6, 'rgba(255,255,255,0.35)');
          circle(ctx, 3.2, -0.6, 0.8, '#0a1420');
        });
      }
      ctx.strokeStyle = 'rgba(230,255,255,0.7)';
      ctx.lineWidth = 0.6;
      for (let k = 0; k < 10; k++) {
        const p = (t * (0.1 + hash(k, 193) * 0.12) + hash(k, 194)) % 1;
        ctx.beginPath();
        ctx.arc(x + hash(k, 195) * w + Math.sin(t * 2 + k) * 3, B - p * 170, 1 + hash(k, 196) * 1.8, 0, TAU);
        ctx.stroke();
      }
    },
    leak(ctx, x, y, a, _t, i) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + (i % 3) * 0.7, 0, TAU);
      ctx.strokeStyle = alpha('#dffcff', a);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    },
  },
  {
    // The one where it is always 1985 and always midnight.
    light: '#ff5ad0',
    paint(ctx, x, w, t) {
      rect(ctx, x, T - 30, w, B - T + 30, vgrad(ctx, T, 140, ['#12042a', '#4a1280', '#e8408a', '#ffb060']));
      const cx = x + w * 0.5, cy = 92, r = 34;
      glow(ctx, cx, cy, r * 2, '#ff5a8a', 0.6);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.clip();
      rect(ctx, cx - r, cy - r, r * 2, r * 2, vgrad(ctx, cy - r, cy + r, ['#ffe45a', '#ff8a4a', '#ff3a8a']));
      for (let k = 0; k < 6; k++) rect(ctx, cx - r, cy + 2 + k * 6.4, r * 2, 1.2 + k * 0.8, '#5a1680');
      ctx.restore();
      for (let k = 0; k < 2; k++) {
        const fx = x - 20 + ((t * (22 + k * 9) + k * 60) % (w + 40)), fy = 56 + k * 22;
        rect(ctx, fx - 22, fy - 0.4, 22, 0.8, alpha(k ? '#5cf0ff' : '#ff9af0', 0.6));
        rect(ctx, fx, fy - 1.4, 6, 2.6, '#12042a', 1);
        glow(ctx, fx - 1, fy, 4, k ? '#5cf0ff' : '#ff9af0', 0.9);
      }
      for (let bx = x - 2, i = 0; bx < x + w; i++) {
        const bw = 8 + hash(i, 197) * 10, bh = 22 + hash(i, 198) ** 1.5 * 50;
        rect(ctx, bx, 140 - bh, bw + 0.5, bh + 60, '#140626');
        for (let r2 = 0; r2 * 5 + 6 < bh; r2++) {
          for (let c = 0; c * 3.4 + 4 < bw; c++) {
            const id = i * 97 + r2 * 13 + c;
            if (hash(id, 199 + Math.floor(t * 0.15 + hash(id, 3) * 5)) < 0.42) rect(ctx, bx + 2 + c * 3.4, 144 - bh + r2 * 5, 1.8, 2.4, id % 3 ? '#5cf0ff' : '#ff9af0');
          }
        }
        bx += bw;
      }
    },
    leak(ctx, x, y, a, _t, i) {
      rect(ctx, x - 3, y - 0.5, 6, 1, alpha(i % 2 ? '#5cf0ff' : '#ff9af0', a));
    },
  },
  {
    // The one with rather fewer pixels.
    light: '#ffffff',
    paint(ctx, x, w, t) {
      const P = 4;
      const block = (bx: number, by: number, bw: number, bh: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(x + bx * P, T + by * P, bw * P + 0.3, bh * P + 0.3);
      };
      rect(ctx, x, T - 30, w, B - T + 30, '#6aa6ff');
      block(17, 6, 4, 4, '#ffe45a');
      block(18, 5, 2, 6, '#ffe45a');
      block(16, 7, 6, 2, '#ffe45a');
      for (let k = 0; k < 2; k++) {
        const cx = Math.floor((t * 1.2 + k * 17) % 34) - 7, cy = 9 + k * 6;
        block(cx, cy, 7, 2, '#ffffff');
        block(cx + 1, cy - 1, 4, 1, '#ffffff');
        block(cx + 1, cy + 2, 5, 1, '#d8e8ff');
      }
      for (let s = 0; s < 5; s++) block(-1 + s, 24 - s, 12 - 2 * s, 1, s ? '#3f9a4a' : '#2f8a3a');
      block(0, 25, 25, 1, '#5ac85a');
      block(0, 26, 25, 20, '#9a6a3a');
      for (let k = 0; k < 14; k++) block(Math.floor(hash(k, 221) * 25), 27 + Math.floor(hash(k, 222) * 12), 1, 1, '#7a4f28');
      block(12, 19, 9, 6, '#f0e0b8');
      block(11, 18, 11, 1, '#c8323a');
      block(12, 17, 9, 1, '#c8323a');
      block(13, 16, 7, 1, '#a8242c');
      block(16, 22, 2, 3, '#6a3a1a');
      block(13, 20, 2, 2, '#ffe45a');
      block(18, 20, 2, 2, '#ffe45a');
      // A pint, as best the hardware can manage.
      const bob = Math.floor(t * 2) % 2;
      block(5, 14 + bob, 3, 4, '#f0a020');
      block(5, 13 + bob, 3, 1, '#ffffff');
      block(8, 15 + bob, 1, 2, '#f0f0f0');
    },
    leak(ctx, x, y, a) {
      rect(ctx, Math.round(x / 3) * 3, Math.round(y / 3) * 3, 3, 3, alpha('#ffffff', a));
    },
  },
  {
    // The one that looks back.
    light: '#c8f03a',
    paint(ctx, x, w, t) {
      const cx = x + w * 0.5, cy = 86;
      rect(ctx, x, T - 30, w, B - T + 30, rgrad(ctx, cx, cy, 10, 110, ['#3a0f4a', '#1a0626', '#05010a']));
      for (let k = 0; k < 7; k++) {
        const bx = x + 4 + k * 15, s = Math.sin(t * 0.8 + k * 1.9) * 9;
        curve(ctx, [bx, B, bx + s * 0.3, 160, bx - s * 0.6, 136, bx + s, 114 + (k % 3) * 9], '#2a0a3a', 5 - (k % 3));
      }
      const beat = (t * 0.21) % 1;
      const open = beat < 0.05 ? Math.abs(beat - 0.025) / 0.025 : 1;
      const lx = Math.sin(t * 0.5) * 9 + Math.sin(t * 1.3) * 2, ly = Math.cos(t * 0.37) * 4;
      glow(ctx, cx, cy, 70, '#c8f03a', 0.35);
      const lids = () => {
        ctx.beginPath();
        ctx.moveTo(cx - 34, cy);
        ctx.quadraticCurveTo(cx, cy - 26 * open - 1, cx + 34, cy);
        ctx.quadraticCurveTo(cx, cy + 22 * open + 1, cx - 34, cy);
      };
      lids();
      ctx.fillStyle = '#f4eedc';
      ctx.fill();
      ctx.save();
      lids();
      ctx.clip();
      for (let k = 0; k < 6; k++) curve(ctx, [cx + (k < 3 ? -34 : 34), cy + (k % 3 - 1) * 9, cx + (k < 3 ? -22 : 22), cy + (k % 3 - 1) * 6 + 2, cx + (k < 3 ? -15 : 15), cy + (k % 3 - 1) * 2], 'rgba(200,60,60,0.5)', 0.6);
      circle(ctx, cx + lx, cy + ly, 13.6, '#4a7a0f');
      ctx.fillStyle = rgrad(ctx, cx + lx, cy + ly, 2, 13, ['#f0ff8a', '#a8d820', '#4a8a0f']);
      ctx.beginPath();
      ctx.arc(cx + lx, cy + ly, 12.6, 0, TAU);
      ctx.fill();
      ellipse(ctx, cx + lx, cy + ly, 2.6 + Math.sin(t * 0.9) * 0.8, 10.4, '#07030a');
      circle(ctx, cx + lx + 4, cy + ly - 5, 2.2, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = vgrad(ctx, cy - 26, cy - 6, ['rgba(20,6,30,0.5)', 'rgba(20,6,30,0)']);
      ctx.fillRect(cx - 36, cy - 28, 72, 24);
      ctx.restore();
      lids();
      ctx.strokeStyle = '#12041c';
      ctx.lineWidth = 2;
      ctx.stroke();
      // And its friends.
      for (let k = 0; k < 5; k++) {
        const ex = x + 12 + hash(k, 231) * (w - 24), ey = 122 + hash(k, 232) * 40;
        const o = ((t * 0.3 + hash(k, 233)) % 1) < 0.06 ? 0.15 : 1;
        ellipse(ctx, ex, ey, 3.6, 2.4 * o, '#f4eedc');
        ellipse(ctx, ex + lx * 0.12, ey, 1.3, 1.7 * o, '#07030a');
      }
    },
    leak(ctx, x, y, a) {
      glow(ctx, x, y, 4, '#c8f03a', a * 0.8);
    },
  },
  {
    // The one where the ice never left.
    light: '#9fffd0',
    paint(ctx, x, w, t) {
      rect(ctx, x, T - 30, w, B - T + 30, vgrad(ctx, T, 140, ['#030a1e', '#0e2a4a', '#2a5a7a']));
      for (let k = 0; k < 22; k++) circle(ctx, x + hash(k, 241) * w, T + hash(k, 242) * 80, 0.4 + hash(k, 243) * 0.5, 'rgba(255,255,255,0.8)');
      for (let k = 0; k < 3; k++) {
        const c = ['#5cffb0', '#7ad7ff', '#c78cff'][k];
        for (let xx = x; xx <= x + w; xx += 6) {
          const y0 = 48 + k * 9 + Math.sin(xx * 0.055 + t * 0.5 + k * 2) * 9 + Math.sin(xx * 0.13 - t * 0.3) * 3;
          glow(ctx, xx, y0, 9, c, 0.2 + 0.1 * Math.sin(xx * 0.2 + t + k), 2.6);
        }
      }
      poly(ctx, [x - 6, 136, x + w * 0.2, 86, x + w * 0.36, 112, x + w * 0.58, 76, x + w * 0.84, 118, x + w + 6, 100, x + w + 6, 136], '#4a7696');
      poly(ctx, [x + w * 0.2, 86, x + w * 0.27, 98, x + w * 0.2, 96, x + w * 0.13, 104], '#e8f4ff');
      poly(ctx, [x + w * 0.58, 76, x + w * 0.67, 92, x + w * 0.58, 90, x + w * 0.5, 96, x + w * 0.5, 88], '#e8f4ff');
      rect(ctx, x, 132, w, 60, vgrad(ctx, 132, 190, ['#eaf5ff', '#a8c8e4']));
      for (const [tx, s] of [[0.1, 1], [0.2, 0.75], [0.9, 1.1], [0.78, 0.8]]) {
        const bx = x + w * tx;
        poly(ctx, [bx - 5 * s, 134, bx, 134 - 18 * s, bx + 5 * s, 134], '#1f4a3a');
        poly(ctx, [bx - 3 * s, 124 - 2 * s, bx, 134 - 18 * s, bx + 3 * s, 124 - 2 * s], '#eaf5ff');
      }
      cottage(ctx, x + w * 0.46, 135, 1.35, '#8a6a52', '#eaf5ff', '#ffc56e');
      glow(ctx, x + w * 0.46, 126, 16, '#ffc56e', 0.5);
      for (let k = 0; k < 20; k++) {
        const p = (t * (0.08 + hash(k, 244) * 0.08) + hash(k, 245)) % 1;
        circle(ctx, x + hash(k, 246) * w + Math.sin(t + k) * 4, T + p * 170, 0.7 + hash(k, 247) * 0.7, 'rgba(255,255,255,0.9)');
      }
    },
    leak(ctx, x, y, a, _t, i) {
      circle(ctx, x, y, 0.9 + (i % 2) * 0.5, alpha('#ffffff', a));
    },
  },
];

function doors(fn: (cx: number, world: World, n: number) => void) {
  for (let n = -2; n <= 4; n++) fn(DOOR.first + n * DOOR.pitch, WORLDS[((n % WORLDS.length) + WORLDS.length) % WORLDS.length], n);
}

const multiverse: Backdrop = {
  fog: '#2a1444', haze: 0.17, dim: 0.14, shine: 1, vignette: 0.58,
  bar: { kind: 'wood', top: '#8a5638', front: '#3a1a3a', trim: '#e0b85a', glow: '#c78cff' },
  far(ctx, t) {
    fillAcross(ctx, -400, 226, '#0a0418');
    doors((cx, world) => {
      const x = cx - DOOR.w / 2;
      ctx.save();
      archPath(ctx, x - 1, T - 1, DOOR.w + 2, B - T + 2, DOOR.arch + 1);
      ctx.clip();
      world.paint(ctx, x, DOOR.w, t);
      // The surface of the doorway: a slow shimmer across whatever is behind it.
      const sweep = ((t * 0.12 + cx * 0.003) % 1) * (DOOR.w + 120) - 60;
      poly(ctx, [x + sweep, T - 30, x + sweep + 16, T - 30, x + sweep - 34, B, x + sweep - 50, B], 'rgba(255,255,255,0.07)');
      ctx.restore();
    });
  },
  shell(ctx) {
    // The back wall of a snug old tavern, which happens to have doorways to everywhere.
    wallpaper(ctx, -400, 190, '#38204c', 'rgba(255,214,140,0.075)', 'diamond');
    fillAcross(ctx, -400, 10, vgrad(ctx, 0, 10, ['#2a1620', '#3f2418']));
    fillAcross(ctx, 10, 12, '#7a5430');
    doors((cx) => {
      const x = cx - DOOR.w / 2, w = DOOR.w, h = B - T;
      // The surround: dark timber, a band of brass, then the stone lip of the doorway itself.
      archPath(ctx, x - 10, T - 10, w + 20, h + 10, DOOR.arch + 10);
      ctx.fillStyle = '#2a1420';
      ctx.fill();
      archPath(ctx, x - 8, T - 8, w + 16, h + 8, DOOR.arch + 8);
      ctx.fillStyle = vgrad(ctx, T - 8, B, ['#7a4a2e', '#4a2a22']);
      ctx.fill();
      // Stones round the arch.
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        line(ctx, cx + Math.cos(a) * (DOOR.arch + 2.4), T + DOOR.arch + Math.sin(a) * (DOOR.arch + 2.4), cx + Math.cos(a) * (DOOR.arch + 8), T + DOOR.arch + Math.sin(a) * (DOOR.arch + 8), 'rgba(30,14,22,0.6)', 0.8, 'butt');
      }
      for (let y = T + DOOR.arch + 16; y < B; y += 17) {
        line(ctx, x - 8, y, x - 2.4, y, 'rgba(30,14,22,0.6)', 0.8, 'butt');
        line(ctx, x + w + 2.4, y, x + w + 8, y, 'rgba(30,14,22,0.6)', 0.8, 'butt');
      }
      archPath(ctx, x - 2.6, T - 2.6, w + 5.2, h + 2.6, DOOR.arch + 2.6);
      ctx.fillStyle = vgrad(ctx, T, B, ['#f0d488', '#a8823a']);
      ctx.fill();
      punch(ctx, () => archPath(ctx, x, T, w, h, DOOR.arch));
      poly(ctx, [cx - 7, T - 13, cx + 7, T - 13, cx + 4.6, T + 1.4, cx - 4.6, T + 1.4], '#e0b85a');
      poly(ctx, [cx - 7, T - 13, cx - 4, T - 13, cx - 2.6, T + 1.4, cx - 4.6, T + 1.4], '#fff0b8');
      // Between the doors: a pilaster, and a clock keeping that universe's time.
      const px = cx + DOOR.pitch / 2;
      rect(ctx, px - 6, 46, 12, 144, vgrad(ctx, 46, 190, ['#6a3e2a', '#40221e']));
      rect(ctx, px - 6, 46, 2.4, 144, 'rgba(255,220,170,0.16)');
      rect(ctx, px + 3.4, 46, 2.6, 144, 'rgba(20,8,16,0.3)');
      rect(ctx, px - 9, 42, 18, 5, '#8a5638', 1);
      rect(ctx, px - 9, 42, 18, 1.4, '#c08a5a', 1);
      circle(ctx, px, 25, 11.6, '#2a1420');
      circle(ctx, px, 25, 10.4, '#e0b85a');
      circle(ctx, px, 25, 8.6, '#f6efe0');
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        line(ctx, px + Math.cos(a) * 7, 25 + Math.sin(a) * 7, px + Math.cos(a) * 8.2, 25 + Math.sin(a) * 8.2, '#3a2418', k % 3 ? 0.5 : 1, 'butt');
      }
      // A bracket for the lantern.
      line(ctx, px, 84, px, 92, '#17100e', 1);
    });
    wainscot(ctx, 188, 226, '#4a2438');
  },
  mid(ctx, t) {
    ctx.lineCap = 'round';
    doors((cx, world, n) => {
      const x = cx - DOOR.w / 2;
      // Each doorway lights the room its own colour, and hums at the edges.
      glow(ctx, cx, 96, 96, world.light, 0.16 + 0.03 * Math.sin(t * 1.3 + n));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      archPath(ctx, x + 1.6, T + 1.6, DOOR.w - 3.2, B - T, DOOR.arch - 1.6);
      ctx.strokeStyle = alpha(world.light, 0.3 + 0.12 * Math.sin(t * 2.1 + n * 1.7));
      ctx.lineWidth = 4.4;
      ctx.stroke();
      ctx.strokeStyle = alpha('#ffffff', 0.5);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
      // A spark running round the frame.
      const u = (t * 0.16 + n * 0.37) % 1, a = Math.PI + u * Math.PI;
      const sx = cx + Math.cos(a) * (DOOR.arch - 1.6), sy = T + DOOR.arch + Math.sin(a) * (DOOR.arch - 1.6);
      glow(ctx, sx, sy, 12, world.light, 0.9 * arc(u));
      sparkle(ctx, sx, sy, 3.4 * arc(u), '#ffffff', arc(u));
      // Things from the other side, drifting through.
      for (let k = 0; k < 7; k++) {
        const p = (t * (0.07 + hash(k, n + 300) * 0.07) + hash(k, n + 301)) % 1;
        const a0 = Math.PI * (1.08 + hash(k, n + 302) * 0.84), r = DOOR.arch - 14 + p * 44;
        world.leak(ctx, cx + Math.cos(a0) * r + Math.sin(t * 1.4 + k) * 3, T + DOOR.arch + Math.sin(a0) * r, arc(p) * 0.95, t, k);
      }
      // The clock, and the lantern.
      const px = cx + DOOR.pitch / 2, rate = [1, -2.6, 0.3, 7, -0.6, 13, 0.08][((n % 7) + 7) % 7];
      const hh = t * rate * 0.05 + n, mm = t * rate * 0.6 + n * 2;
      line(ctx, px, 25, px + Math.sin(hh) * 4.4, 25 - Math.cos(hh) * 4.4, '#2a1820', 1.3);
      line(ctx, px, 25, px + Math.sin(mm) * 6.6, 25 - Math.cos(mm) * 6.6, '#2a1820', 0.8);
      circle(ctx, px, 25, 1, '#c8323a');
      const sway = Math.sin(t * 0.9 + n) * 0.05;
      at(ctx, px, 92, sway, 1, 1, () => {
        const flick = 0.85 + 0.15 * Math.sin(t * 11 + n * 3) * Math.sin(t * 4.3 + n);
        glow(ctx, 0, 8, 34, world.light, 0.5 * flick);
        rect(ctx, -4.4, 0, 8.8, 2, '#17100e', 0.8);
        rect(ctx, -3.6, 2, 7.2, 11, alpha(tint(world.light, 0.5), 0.5), 1);
        ellipse(ctx, 0, 9, 1.5, 3 * flick, tint(world.light, 0.7));
        rect(ctx, -4.4, 13, 8.8, 2, '#17100e', 0.8);
        for (const lx of [-3.6, 3.6]) line(ctx, lx, 2, lx, 13, '#17100e', 0.7, 'butt');
      });
    });
  },
  front(ctx, t) {
    for (let i = 0; i < 10; i++) {
      const p = (t * (0.05 + hash(i, 171) * 0.05) + hash(i, 172)) % 1;
      sparkle(ctx, X0 + hash(i, 173) * SPAN, lerp(210, 0, p), 3 * arc(p), hsl((i * 47 + t * 30) % 360, 0.9, 0.85), arc(p) * 0.7);
    }
    motes(ctx, t, 10, 61, '#ffd9a0', { y0: 20, y1: 200, a: 0.35, size: 0.7 });
  },
};

export const COSMOS_BACKDROPS: Record<string, Backdrop> = {
  earth: earthInn, moon, solar, greenman: alienWorld, galaxy, multiverse,
};
