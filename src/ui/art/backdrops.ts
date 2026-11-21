/**
 * The pub's first seven homes, from The Red Lion to the whole of Britain (abroad is in world.ts,
 * and space in cosmos.ts).
 *
 * Each one is painted in up to four passes:
 *   far    animated, behind everything (sky, street, space)
 *   shell  static architecture, cached; windows are punched through to `far`
 *   mid    animated things inside the room, behind the crowd (lamps, bunting, screens)
 *   front  animated light and particles over the whole scene
 */
import {
  TAU, alpha, at, blob, circle, curve, ellipse, glow, hash, hsl, lerp, line, mix, poly, rect, shade, tint, vgrad,
  type Ctx,
} from './draw';
import {
  SPAN, X0, X1, archPath, beam, birds, bottles, bunting, clouds, drift, festoon, fillAcross, hillY, hills, motes,
  pendant, picture, punch, sky, skyline, stars, wainscot, wallpaper,
} from './kit';

export interface BarStyle {
  kind: 'wood' | 'planks' | 'metal' | 'neon';
  top: string;
  front: string;
  trim: string;
  /** Light strip under the lip of the bar. */
  glow?: string;
}

export interface Backdrop {
  /** Colour the crowd fades towards with distance. */
  fog: string;
  haze: number;
  /** How dark the room is (0 = daylight). */
  dim: number;
  /** How strongly glass catches the light. */
  shine: number;
  vignette: number;
  bar: BarStyle;
  /** How far the crowd has come loose from the floor (0 = feet on the ground). */
  adrift?: number;
  far(ctx: Ctx, t: number): void;
  shell?(ctx: Ctx): void;
  mid?(ctx: Ctx, t: number): void;
  front?(ctx: Ctx, t: number): void;
}

const WARM = '#ffc56e';
const UNION = ['#c8323a', '#f4f1e8', '#24408e'];

/** Repeat something at regular x positions across the whole scene. */
function across(first: number, step: number, fn: (x: number, i: number) => void) {
  let i = 0;
  for (let x = first - Math.ceil((first - X0) / step) * step; x < X1; x += step) fn(x, i++);
}

// ---------------------------------------------------------------- 1. The Red Lion

const redlion: Backdrop = {
  fog: '#2b1c16', haze: 0.13, dim: 0.05, shine: 0.95, vignette: 0.6,
  bar: { kind: 'wood', top: '#8f5a30', front: '#4a2815', trim: '#d1a849' },
  far(ctx, t) {
    sky(ctx, ['#0d1430', '#1c2a55', '#33457a']);
    stars(ctx, t, 60, 11, { yMax: 120 });
    glow(ctx, 84, 48, 46, '#cfdcff', 0.5);
    circle(ctx, 84, 48, 11, '#f3ecd0');
    circle(ctx, 80, 45, 2.4, '#e2d8b6');
    circle(ctx, 88, 52, 1.6, '#e2d8b6');
    clouds(ctx, t, 7, 21, 30, 90, 5, 'rgba(58,74,120,0.85)', 'rgba(30,42,82,0.85)', 1.1);
    skyline(ctx, 124, 5, '#141c36', 10, 30, { roofs: true, lit: '#ffcf7a', t, density: 0.25 });
    // Rain against the glass.
    ctx.strokeStyle = 'rgba(190,210,255,0.3)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const x = X0 + hash(i, 31) * SPAN, y = ((t * (150 + hash(i, 32) * 90) + hash(i, 33) * 260) % 260) - 20;
      ctx.moveTo(x - y * 0.12, y);
      ctx.lineTo(x - y * 0.12 - 1.1, y + 9);
    }
    ctx.stroke();
  },
  shell(ctx) {
    wallpaper(ctx, -400, 150, '#27483b', 'rgba(16,36,28,0.4)', 'stripe');
    fillAcross(ctx, 15, 18.5, '#d9c7a0');
    fillAcross(ctx, 18.5, 20, 'rgba(0,0,0,0.25)');
    wainscot(ctx, 148, 226, '#5d3620');
    // Sash windows with heavy curtains.
    for (const x of [-148, 34, 430]) {
      const w = 76, y = 30, h = 88;
      rect(ctx, x - 6, y - 6, w + 12, h + 13, '#3a2114', 3);
      punch(ctx, () => archPath(ctx, x, y, w, h, 14));
      ctx.fillStyle = 'rgba(160,190,255,0.07)';
      archPath(ctx, x, y, w, h, 14);
      ctx.fill();
      poly(ctx, [x + 8, y + h, x + 30, y + 4, x + 40, y + 4, x + 20, y + h], 'rgba(255,255,255,0.05)');
      rect(ctx, x + w / 2 - 1.6, y, 3.2, h, '#4a2a18');
      rect(ctx, x, y + h * 0.5, w, 3.2, '#4a2a18');
      rect(ctx, x - 9, y + h, w + 18, 5, '#6a3f22', 1.5);
      for (const s of [-1, 1]) {
        const cx = s < 0 ? x - 5 : x + w + 5;
        blob(ctx, [cx, y - 8, cx + s * -20, y - 6, cx + s * -11, y + 40, cx + s * -6, y + 62, cx + s * -15, y + h + 6, cx, y + h + 8], '#6e1f22', 0.4);
        blob(ctx, [cx, y - 8, cx + s * -8, y - 6, cx + s * -4, y + 50, cx, y + h + 8], '#501418', 0.4);
        rect(ctx, cx + s * -13, y + 56, 12, 3, '#d1a849', 1.5);
      }
      rect(ctx, x - 12, y - 11, w + 24, 5, '#2a170e', 2);
    }
    // Dartboard.
    at(ctx, 372, 72, 0, 1, 1, () => {
      rect(ctx, -30, -30, 60, 60, '#2c1a10', 3);
      circle(ctx, 0, 0, 25, '#16130f');
      for (let i = 0; i < 20; i++) {
        const a0 = (i / 20) * TAU - TAU / 40, a1 = a0 + TAU / 20;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 20, a0, a1);
        ctx.fillStyle = i % 2 ? '#e9dfc4' : '#1c1a17';
        ctx.fill();
        for (const r of [19, 11.5]) {
          ctx.beginPath();
          ctx.arc(0, 0, r, a0, a1);
          ctx.strokeStyle = i % 2 ? '#2f8f4e' : '#c0392b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      circle(ctx, 0, 0, 3.4, '#2f8f4e');
      circle(ctx, 0, 0, 1.5, '#c0392b');
      line(ctx, 5, -9, 11, -17, '#d9d9e0', 0.9);
      poly(ctx, [11, -17, 15, -19, 14, -15], '#e23d3d');
    });
    // Pictures, a shelf of bottles and a row of tankards.
    picture(ctx, 206, 46, 30, 24, '#b8923e', 0);
    picture(ctx, -44, 40, 24, 30, '#8a6a34', 1);
    picture(ctx, 300, 96, 22, 18, '#8a6a34', 3);
    picture(ctx, 524, 44, 30, 24, '#b8923e', 2);
    rect(ctx, 196, 104, 86, 3.4, '#6a3f22', 1);
    rect(ctx, 196, 107.4, 86, 1.4, 'rgba(0,0,0,0.3)');
    bottles(ctx, 198, 104, 82, 7, 0.1);
    rect(ctx, -30, 112, 60, 3.4, '#6a3f22', 1);
    bottles(ctx, -28, 112, 56, 12, 0.1);
  },
  mid(ctx, t) {
    // Wall clock with a swinging pendulum.
    at(ctx, 320, 50, 0, 1, 1, () => {
      rect(ctx, -8, 6, 16, 34, '#4a2a18', 3);
      at(ctx, 0, 12, Math.sin(t * 3.1) * 0.3, 1, 1, () => {
        line(ctx, 0, 0, 0, 20, '#d1a849', 1);
        circle(ctx, 0, 21, 3.4, '#e0b85a');
      });
      circle(ctx, 0, 0, 13, '#4a2a18');
      circle(ctx, 0, 0, 10.5, '#f1e7cf');
      const d = new Date();
      const m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      line(ctx, 0, 0, Math.sin((h / 12) * TAU) * 5.2, -Math.cos((h / 12) * TAU) * 5.2, '#2a1a12', 1.5);
      line(ctx, 0, 0, Math.sin((m / 60) * TAU) * 8, -Math.cos((m / 60) * TAU) * 8, '#2a1a12', 1);
      circle(ctx, 0, 0, 1.1, '#8a2a22');
    });
    // Firelight from the hearth, off to one side.
    const fl = 0.5 + 0.2 * Math.sin(t * 7.3) + 0.12 * Math.sin(t * 13.1) + 0.08 * Math.sin(t * 23);
    glow(ctx, 520, 200, 150, '#ff8a3a', 0.3 * fl);
    glow(ctx, -130, 200, 130, '#ff8a3a', 0.22 * fl);
    across(150, 190, (x, i) => pendant(ctx, x, 30, t, i * 1.7, '#7a2b20', WARM, { cone: 1 }));
  },
  front(ctx, t) {
    motes(ctx, t, 26, 5, '#ffdca0', { y0: 20, y1: 200, a: 0.5 });
  },
};

// ---------------------------------------------------------------- 2. The beer garden

function tree(ctx: Ctx, x: number, base: number, s: number, t: number, ph: number, leaf: string) {
  const sway = Math.sin(t * 0.8 + ph) * 0.025;
  at(ctx, x, base, sway, s, s, () => {
    poly(ctx, [-4, 0, 4, 0, 2.4, -44, -2.4, -44], '#5a3d26');
    poly(ctx, [0, 0, 4, 0, 2.4, -44, 0, -44], '#3f2a1a');
    const lobes = [[-17, -52, 17], [14, -56, 19], [-3, -74, 20], [-22, -70, 13], [22, -76, 12], [3, -92, 14]];
    for (const [lx, ly, r] of lobes) circle(ctx, lx, ly + 3, r, shade(leaf, 0.28));
    for (const [lx, ly, r] of lobes) circle(ctx, lx + Math.sin(t * 1.3 + ph + lx) * 0.8, ly, r, leaf);
    for (const [lx, ly, r] of lobes) circle(ctx, lx - r * 0.25, ly - r * 0.3, r * 0.55, tint(leaf, 0.16));
  });
}

function parasol(ctx: Ctx, x: number, y: number, s: number, t: number, a: string, b: string) {
  at(ctx, x, y, Math.sin(t * 0.7 + x) * 0.012, s, s, () => {
    rect(ctx, -1.3, 0, 2.6, 100, '#e9e2d2');
    for (let i = 0; i < 6; i++) {
      const x0 = -45 + i * 15;
      poly(ctx, [0, -15, x0, 6, x0 + 15, 6], i % 2 ? a : b);
      ctx.beginPath();
      ctx.arc(x0 + 7.5, 6, 7.5, 0, Math.PI);
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fill();
    }
    poly(ctx, [0, -15, 15, 6, 45, 6], 'rgba(20,10,30,0.12)');
    circle(ctx, 0, -15.5, 2, '#e9e2d2');
  });
}

const garden: Backdrop = {
  fog: '#bfe3c4', haze: 0.12, dim: 0, shine: 1.15, vignette: 0.28,
  bar: { kind: 'planks', top: '#c99a63', front: '#a8774a', trim: '#f1ead9' },
  far(ctx, t) {
    sky(ctx, ['#4fa9e6', '#8fd0f2', '#d6f1f7']);
    // Sun with slow-turning rays.
    at(ctx, 338, 40, t * 0.05, 1, 1, () => {
      ctx.fillStyle = 'rgba(255,244,190,0.16)';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        poly(ctx, [-5, 0, 5, 0, 16, 150, -16, 150]);
        ctx.fill();
      }
    });
    glow(ctx, 338, 40, 80, '#fff3b0', 0.8);
    circle(ctx, 338, 40, 15, '#fff6cf');
    clouds(ctx, t, 8, 4, 20, 100, 4, '#ffffff', '#cfe6f2', 1.2);
    hills(ctx, 138, 18, 1.3, '#9ccf8f', 0.7);
    hills(ctx, 150, 14, 4.1, '#77b56c', 1.1);
    // A church on the hill.
    rect(ctx, 96, 118, 16, 16, '#d8cfb8');
    poly(ctx, [100, 118, 104, 100, 108, 118], '#6a5a52');
    rect(ctx, 86, 126, 12, 9, '#cfc5ad');
    birds(ctx, t, 6, 9, 30, 90, 14, 'rgba(40,50,70,0.7)');
  },
  shell(ctx) {
    // Hedge and fence.
    ctx.fillStyle = '#2f6a3a';
    ctx.beginPath();
    ctx.moveTo(X0, 226);
    for (let x = X0; x <= X1; x += 9) ctx.arc(x, 158 + hash(x, 3) * 6, 9, Math.PI, TAU);
    ctx.lineTo(X1, 226);
    ctx.fill();
    for (let x = X0; x <= X1; x += 9) circle(ctx, x + 2, 156 + hash(x, 3) * 6, 4.5, 'rgba(120,190,110,0.5)');
    across(0, 13, (x) => {
      rect(ctx, x, 170, 9, 60, '#f1ead9', 1);
      poly(ctx, [x, 171, x + 4.5, 164, x + 9, 171], '#f1ead9');
      rect(ctx, x + 6.5, 168, 2.5, 60, '#d9cfb8');
    });
    fillAcross(ctx, 184, 188, '#e2d8c2');
    // The back wall of the pub, with a hanging basket.
    for (const [x, w] of [[X0, 172], [498, 100]]) {
      rect(ctx, x, -400, w, 640, '#a4553f');
      for (let y = -6; y < 226; y += 8) {
        for (let bx = x + ((y / 8) % 2 ? 0 : 8); bx < x + w; bx += 16) rect(ctx, bx, y, 15, 7, hash(bx, y) < 0.3 ? '#93452f' : '#b0604a');
      }
      rect(ctx, x + (x < 0 ? w - 4 : 0), -400, 4, 640, 'rgba(0,0,0,0.18)');
    }
    rect(ctx, -160, 34, 62, 80, '#f1ead9', 2);
    rect(ctx, -155, 39, 52, 70, '#39536a');
    poly(ctx, [-150, 109, -128, 39, -118, 39, -140, 109], 'rgba(255,255,255,0.12)');
    rect(ctx, -131, 39, 3, 70, '#f1ead9');
    rect(ctx, -155, 72, 52, 3, '#f1ead9');
  },
  mid(ctx, t) {
    tree(ctx, 318, 212, 1.2, t, 0, '#4f9a4a');
    tree(ctx, 476, 214, 0.95, t, 2, '#5aa856');
    tree(ctx, 28, 210, 0.9, t, 4, '#5aa856');
    parasol(ctx, 86, 92, 1, t, '#d8473f', '#f6f1e4');
    parasol(ctx, 418, 100, 0.9, t, '#2f7fb0', '#f6f1e4');
    // Hanging basket on the pub wall.
    at(ctx, -22, 54, Math.sin(t * 1.1) * 0.03, 1, 1, () => {
      line(ctx, 0, -40, 0, 0, '#2a2a2a', 0.8);
      ellipse(ctx, 0, 6, 12, 8, '#5a3d26');
      for (let i = 0; i < 9; i++) circle(ctx, -11 + i * 2.8, 1 - Math.sin(i * 1.3) * 3, 3.2, ['#e84393', '#ffd23c', '#ff7a59'][i % 3]);
      for (let i = 0; i < 5; i++) circle(ctx, -9 + i * 4.5, 5 + Math.sin(i) * 2, 3, '#3f8f4a');
    });
    festoon(ctx, -180, 8, 200, 12, 14, t, ['#ffd27a', '#ff9a7a', '#fff1c2'], 16, 1.8, 0.5);
    festoon(ctx, 200, 12, 590, 6, 15, t, ['#ffd27a', '#ff9a7a', '#fff1c2'], 16, 1.8, 0.5);
    // Butterflies.
    for (let i = 0; i < 4; i++) {
      const x = drift(i * 210, 11 + i * 3, t) + Math.sin(t * 1.3 + i) * 14, y = 96 + i * 16 + Math.sin(t * 2.1 + i * 2) * 14;
      const flap = Math.abs(Math.sin(t * 13 + i));
      const c = ['#ff9a3c', '#f6f1e4', '#7ab8ff', '#ffe15c'][i];
      ellipse(ctx, x - 2.2 * flap, y, 2.6 * flap, 3, c, -0.3);
      ellipse(ctx, x + 2.2 * flap, y, 2.6 * flap, 3, c, 0.3);
    }
  },
  front(ctx, t) {
    motes(ctx, t, 16, 8, '#fffbe0', { y0: 20, y1: 200, a: 0.5, size: 0.8 });
  },
};

// ---------------------------------------------------------------- 3. High Street

function bus(ctx: Ctx, x: number, y: number, dir: number, t: number) {
  at(ctx, x, y + Math.sin(t * 9) * 0.3, 0, dir, 1, () => {
    rect(ctx, -34, -34, 68, 32, '#c8262f', 4);
    rect(ctx, -34, -18.5, 68, 2, '#8f1820');
    for (let i = 0; i < 6; i++) {
      rect(ctx, -30 + i * 10.4, -30.5, 8.4, 9, '#ffe6a8', 1);
      if (i < 5) rect(ctx, -30 + i * 10.4, -15, 8.4, 8, '#ffe6a8', 1);
    }
    rect(ctx, 23, -15, 8, 12, '#3a4a5a', 1);
    rect(ctx, -34, -4.6, 68, 2.6, '#22252c');
    circle(ctx, -20, -2, 4.6, '#17181c');
    circle(ctx, 20, -2, 4.6, '#17181c');
    circle(ctx, -20, -2, 1.8, '#8a8f98');
    circle(ctx, 20, -2, 1.8, '#8a8f98');
    glow(ctx, 36, -6, 16, '#fff0b0', 0.8);
  });
}

function cab(ctx: Ctx, x: number, y: number, dir: number) {
  at(ctx, x, y, 0, dir, 1, () => {
    blob(ctx, [-17, -2, -17, -9, -9, -10, -5, -17, 8, -17, 12, -10, 18, -8, 18, -2], '#17181c', 0.3);
    rect(ctx, -4, -15.5, 5.4, 5, '#ffe6a8', 1);
    rect(ctx, 2.6, -15.5, 5.4, 5, '#ffe6a8', 1);
    rect(ctx, -2, -19.5, 6, 2.6, '#ffb23c', 1);
    circle(ctx, -10, -2, 3.2, '#0c0c0e');
    circle(ctx, 11, -2, 3.2, '#0c0c0e');
    glow(ctx, 19, -6, 12, '#fff0b0', 0.8);
  });
}

const highstreet: Backdrop = {
  fog: '#4a2633', haze: 0.16, dim: 0.07, shine: 0.95, vignette: 0.55,
  bar: { kind: 'wood', top: '#7a4426', front: '#3d1d16', trim: '#d9b25a' },
  far(ctx, t) {
    sky(ctx, [0, '#2a2458', 0.45, '#8a4a7a', 0.7, '#f08a5a', 1, '#f9cf8a'], 170);
    stars(ctx, t, 30, 3, { yMax: 60 });
    clouds(ctx, t, 6, 14, 30, 90, 3, 'rgba(255,170,130,0.75)', 'rgba(150,80,120,0.6)', 1.2);
    skyline(ctx, 130, 9, '#5a3560', 14, 44, { roofs: true });
    // Shops across the road.
    let x = X0;
    for (let i = 0; x < X1; i++) {
      const w = 44 + hash(i, 41) * 26, h = 56 + hash(i, 42) * 34, top = 176 - h;
      const wall = ['#8a4b3a', '#b98a5a', '#6a7a8a', '#9a5a4a', '#c9b08a', '#55607a'][i % 6];
      rect(ctx, x, top, w, h, mix(wall, '#3a2040', 0.35));
      rect(ctx, x, top, w, 3, mix(wall, '#1a1020', 0.5));
      const cols = Math.floor(w / 15);
      for (let r = 0; r < Math.floor((h - 34) / 15); r++) {
        for (let c = 0; c < cols; c++) {
          const lit = hash(i * 50 + r * 7 + c, 43 + Math.floor(t * 0.05 + hash(i + c, r))) < 0.62;
          rect(ctx, x + 5 + c * ((w - 10) / cols), top + 8 + r * 15, 8, 10, lit ? '#ffd98a' : '#2a2038', 1);
        }
      }
      // Shopfront and awning.
      const awn = ['#c8323a', '#2f7a5a', '#24408e', '#d9a22a'][i % 4];
      rect(ctx, x + 3, 150, w - 6, 26, '#ffe2a0');
      rect(ctx, x + w * 0.62, 153, w * 0.26, 23, '#3a2a30');
      for (let s = 0; s < 6; s++) poly(ctx, [x + 2 + (s * (w - 4)) / 6, 142, x + 2 + ((s + 1) * (w - 4)) / 6, 142, x + ((s + 1) * w) / 6, 152, x + (s * w) / 6, 152], s % 2 ? awn : '#f4f1e8');
      glow(ctx, x + w / 2, 164, w * 0.7, '#ffcf7a', 0.35);
      x += w + 1;
    }
    fillAcross(ctx, 176, 181, '#8a7a82');
    fillAcross(ctx, 181, 226, vgrad(ctx, 181, 226, ['#3a3040', '#221a28']));
    // Wet road catching the shop lights.
    for (let i = 0; i < 14; i++) glow(ctx, X0 + i * 58 + 20, 196, 34, '#ffb060', 0.2, 0.3);
    // Street lamps.
    across(40, 150, (lx) => {
      rect(ctx, lx - 1, 112, 2, 66, '#1c1620');
      curve(ctx, [lx, 112, lx + 2, 106, lx + 9, 105], '#1c1620', 1.6);
      circle(ctx, lx + 10, 107, 2.6, '#fff0c0');
      glow(ctx, lx + 10, 108, 30, '#ffcf80', 0.75);
    });
    // Traffic.
    bus(ctx, drift(0, -34, t, 160), 196, -1, t);
    cab(ctx, drift(300, 46, t, 220), 206, 1);
    cab(ctx, drift(40, -52, t, 300), 201, -1);
    // People hurrying past.
    for (let i = 0; i < 9; i++) {
      const dir = i % 2 ? 1 : -1;
      const px = drift(i * 97, dir * (9 + hash(i, 5) * 8), t, 20), py = 180 - Math.abs(Math.sin(t * 5 + i)) * 1.1;
      const c = mix(['#3a2a4a', '#2a3a5a', '#5a2a3a'][i % 3], '#1a1020', 0.3);
      rect(ctx, px - 2.6, py - 15, 5.2, 12, c, 2.4);
      circle(ctx, px, py - 18, 2.7, c);
      if (i % 3 === 0) {
        // Umbrella.
        ctx.beginPath();
        ctx.arc(px, py - 22, 7.5, Math.PI, TAU);
        ctx.fillStyle = ['#c8323a', '#2f7fb0', '#d9a22a'][i % 3];
        ctx.fill();
      }
    }
  },
  shell(ctx) {
    wallpaper(ctx, -400, 150, '#5c2228', 'rgba(40,10,16,0.35)', 'diamond');
    wainscot(ctx, 150, 226, '#4a241a');
    // Big arched windows onto the street.
    across(16, 156, (x) => {
      const w = 130, y = 22, h = 128;
      rect(ctx, x - 6, y - 5, w + 12, h + 6, '#2a120e', 4);
      punch(ctx, () => archPath(ctx, x, y, w, h, 26));
      ctx.fillStyle = 'rgba(255,200,150,0.05)';
      archPath(ctx, x, y, w, h, 26);
      ctx.fill();
      poly(ctx, [x + 16, y + h, x + 56, y + 6, x + 74, y + 6, x + 34, y + h], 'rgba(255,255,255,0.045)');
      // Frosted lower panes with a gilt line.
      rect(ctx, x, y + h - 34, w, 34, 'rgba(240,225,200,0.2)');
      rect(ctx, x, y + h - 36, w, 2.4, '#d9b25a');
      rect(ctx, x + w / 2 - 1.5, y, 3, h, '#3a1a12');
      rect(ctx, x, y + 40, w, 2.6, '#3a1a12');
      rect(ctx, x - 9, y + h, w + 18, 5, '#5a2e1e', 2);
      // Pilaster with a brass sconce between windows.
      rect(ctx, x + w + 7, 30, 12, 122, '#4a1c20', 2);
      rect(ctx, x + w + 9, 62, 8, 3, '#d9b25a', 1);
    });
    fillAcross(ctx, 12, 16, '#d9b25a');
    fillAcross(ctx, 16, 17.4, 'rgba(0,0,0,0.3)');
  },
  mid(ctx, t) {
    across(16, 156, (x, i) => {
      const lx = x + 143, f = 0.85 + 0.15 * Math.sin(t * 8 + i * 2);
      circle(ctx, lx, 58, 4.4, '#fff0c8');
      glow(ctx, lx, 58, 34, WARM, 0.6 * f);
    });
    across(94, 156, (x, i) => pendant(ctx, x, 20, t, i * 2.1, '#3a1a12', WARM, { kind: 'globe', cone: 0.7 }));
  },
  front(ctx, t) {
    motes(ctx, t, 16, 15, '#ffd9a0', { y0: 20, y1: 200, a: 0.4 });
  },
};

// ---------------------------------------------------------------- 4. City Centre Superpub

const superpub: Backdrop = {
  fog: '#1a2244', haze: 0.18, dim: 0.14, shine: 1, vignette: 0.6,
  bar: { kind: 'neon', top: '#2a2c3c', front: '#12131c', trim: '#8a8fa8', glow: '#ff4fd8' },
  far(ctx, t) {
    sky(ctx, ['#070a1c', '#141a3e', '#3a2a66', '#6a3a7a'], 200);
    stars(ctx, t, 40, 6, { yMax: 70 });
    // Searchlights.
    for (let i = 0; i < 3; i++) beam(ctx, 40 + i * 190, 190, Math.PI + Math.sin(t * 0.35 + i * 2) * 0.5, 240, 0.05, '#9fb8ff', 0.2);
    skyline(ctx, 150, 17, '#141a36', 30, 110, { minW: 20, maxW: 44, lit: '#8fd0ff', t, density: 0.3, roofs: true });
    skyline(ctx, 186, 23, '#0b0e22', 26, 96, { minW: 22, maxW: 50, lit: '#ffd98a', t, density: 0.42, roofs: true });
    // Aircraft warning lights and a plane.
    for (let i = 0; i < 6; i++) {
      const on = Math.sin(t * 2.4 + i * 1.9) > 0.3 ? 1 : 0.15;
      glow(ctx, X0 + 60 + i * 124, 84 + hash(i, 2) * 30, 7, '#ff3a3a', on);
    }
    const px = drift(0, 22, t, 60);
    glow(ctx, px, 30 + Math.sin(px * 0.01) * 6, 5, '#ffffff', 0.6 + 0.4 * Math.sin(t * 9));
    glow(ctx, px - 5, 31 + Math.sin(px * 0.01) * 6, 4, '#ff4040', 0.8);
  },
  shell(ctx) {
    // Ceiling, ducting and a wall of glass.
    fillAcross(ctx, -400, 16, '#0d0e18');
    fillAcross(ctx, 16, 19, '#2a2d40');
    rect(ctx, X0, 4, SPAN, 6, '#1c1e2c');
    across(0, 34, (x) => rect(ctx, x, 4, 1.4, 6, '#2e3146'));
    across(0, 80, (x) => {
      rect(ctx, x - 1.4, 16, 2.8, 210, '#1b1d2c');
      rect(ctx, x - 1.4, 16, 0.8, 210, '#3a3e58');
    });
    fillAcross(ctx, 118, 120, '#1b1d2c');
    fillAcross(ctx, 19, 226, 'rgba(120,150,255,0.035)');
    across(30, 160, (x) => poly(ctx, [x, 226, x + 60, 19, x + 84, 19, x + 24, 226], 'rgba(255,255,255,0.03)'));
    // Screens.
    for (const x of [-116, 28, 362, 506]) {
      rect(ctx, x - 3, 30, 82, 49, '#07080e', 3);
      rect(ctx, x + 36, 16, 4, 14, '#1b1d2c');
    }
    // Back-bar shelves glowing between the screens.
    fillAcross(ctx, 166, 226, 'rgba(8,8,16,0.7)');
  },
  mid(ctx, t) {
    // The match is on.
    for (const [x, ph] of [[-116, 0], [28, 0.4], [362, 0], [506, 0.4]]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 33, 76, 43);
      ctx.clip();
      rect(ctx, x, 33, 76, 43, '#2f8a4a');
      for (let i = 0; i < 5; i++) rect(ctx, x + i * 16, 33, 8, 43, '#37984f');
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(x + 3, 36, 70, 37);
      line(ctx, x + 38, 36, x + 38, 73, 'rgba(255,255,255,0.7)', 0.7);
      ctx.beginPath();
      ctx.arc(x + 38, 54.5, 6, 0, TAU);
      ctx.stroke();
      const bx = x + 38 + Math.sin(t * 0.9 + ph) * 28, by = 54.5 + Math.sin(t * 1.7 + ph) * 12;
      for (let i = 0; i < 10; i++) {
        const px = x + 38 + Math.sin(t * 0.5 + i * 2.1) * 30 + (bx - x - 38) * 0.3, py = 54.5 + Math.cos(t * 0.6 + i * 1.3) * 15;
        circle(ctx, px, py, 1.3, i % 2 ? '#e23d3d' : '#f4f4f4');
      }
      circle(ctx, bx, by, 1, '#ffffff');
      rect(ctx, x + 2, 34.5, 22, 5, 'rgba(10,10,20,0.75)', 1);
      rect(ctx, x + 3.5, 36, 5, 2, '#e23d3d');
      rect(ctx, x + 17.5, 36, 5, 2, '#f4f4f4');
      ctx.restore();
      glow(ctx, x + 38, 55, 60, '#6fe09a', 0.14);
    }
    // Lit bottles on the back bar.
    across(0, 80, (x, i) => {
      rect(ctx, x + 6, 180, 68, 1.6, '#3a3e58');
      bottles(ctx, x + 6, 180, 68, i + 30, 0.25);
      glow(ctx, x + 40, 176, 44, i % 2 ? '#ff4fd8' : '#4fd8ff', 0.3);
    });
    across(120, 160, (x, i) => pendant(ctx, x, 26, t, i, '#222', i % 2 ? '#7fd6ff' : '#ff8ae0', { kind: 'bulb', cone: 0.5 }));
  },
  front(ctx, t) {
    // Sweeping club lights.
    const cols = ['#ff4fd8', '#4fd8ff', '#a06bff', '#4fffb0'];
    for (let i = 0; i < 4; i++) beam(ctx, 30 + i * 120, -6, Math.sin(t * 0.6 + i * 1.6) * 0.55, 300, 0.11, cols[i], 0.16);
    motes(ctx, t, 14, 3, '#b0c8ff', { y0: 10, y1: 200, a: 0.35 });
  },
};

// ---------------------------------------------------------------- 5. Festival Field

function firework(ctx: Ctx, t: number, i: number) {
  const period = 3.4 + hash(i, 61) * 2.2;
  const n = Math.floor(t / period), p = (t / period) % 1;
  const x = X0 + 80 + hash(n, 62 + i) * (SPAN - 160), y = 26 + hash(n, 63 + i) * 60;
  const c = ['#ff5c8a', '#ffd23c', '#5cd6ff', '#8cff9e', '#c78cff', '#ffffff'][Math.floor(hash(n, 64 + i) * 6)];
  if (p < 0.22) {
    // Rocket climbing.
    const u = p / 0.22;
    glow(ctx, x, lerp(170, y, u * (2 - u)), 4, '#ffe8b0', 0.9);
    return;
  }
  const u = (p - 0.22) / 0.78;
  if (u > 1) return;
  const r = 44 * (1 - (1 - u) ** 3), fade = (1 - u) ** 1.5;
  glow(ctx, x, y, 70 * fade + 10, c, 0.45 * fade);
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * TAU + hash(n, k) * 0.3, rr = r * (0.75 + hash(k, n) * 0.25);
    glow(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr + u * u * 14, 3.4 * fade + 0.6, c, fade);
  }
}

const festival: Backdrop = {
  fog: '#3a2760', haze: 0.17, dim: 0.1, shine: 0.95, vignette: 0.55,
  bar: { kind: 'planks', top: '#8f6a44', front: '#5a3f2a', trim: '#f2c94c', glow: '#ffb84a' },
  far(ctx, t) {
    sky(ctx, ['#140c30', '#2f1d5c', '#7a2f7a', '#e0607a'], 190);
    stars(ctx, t, 70, 8, { yMax: 110 });
    for (let i = 0; i < 3; i++) firework(ctx, t + i * 1.3, i);
    hills(ctx, 160, 10, 2.2, '#22143e', 0.8);
    // Big wheel.
    at(ctx, 62, 112, 0, 1, 1, () => {
      line(ctx, -16, 52, 0, 0, '#1a1030', 2);
      line(ctx, 16, 52, 0, 0, '#1a1030', 2);
      ctx.strokeStyle = '#3a2760';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = t * 0.12 + (i / 12) * TAU, x = Math.cos(a) * 40, y = Math.sin(a) * 40;
        line(ctx, 0, 0, x, y, '#3a2760', 0.7);
        rect(ctx, x - 3, y, 6, 5, ['#ff5c8a', '#ffd23c', '#5cd6ff'][i % 3], 1.5);
        glow(ctx, x, y, 8, ['#ff5c8a', '#ffd23c', '#5cd6ff'][i % 3], 0.8);
      }
    });
    // Main stage with a fan of lights.
    at(ctx, 318, 172, 0, 1, 1, () => {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i - 3) * 0.2 + Math.sin(t * 1.1 + i) * 0.16;
        beam(ctx, (i - 3) * 9, -44, a, 190, 0.045, ['#ff5c8a', '#5cd6ff', '#ffd23c', '#c78cff'][i % 4], 0.34);
      }
      rect(ctx, -48, -46, 96, 46, '#120a26');
      rect(ctx, -52, -52, 104, 8, '#1c1238', 2);
      rect(ctx, -52, -52, 5, 54, '#1c1238');
      rect(ctx, 47, -52, 5, 54, '#1c1238');
      const beat = 0.5 + 0.5 * Math.sin(t * 8);
      rect(ctx, -40, -40, 24, 30, hsl(t * 40, 0.8, 0.5 + beat * 0.15), 1);
      rect(ctx, 16, -40, 24, 30, hsl(t * 40 + 120, 0.8, 0.5 + beat * 0.15), 1);
      glow(ctx, 0, -24, 80, '#ff7ad1', 0.3 + beat * 0.2);
      for (let i = 0; i < 4; i++) rect(ctx, -9 + i * 6, -22 - Math.abs(Math.sin(t * 6 + i)) * 2, 3, 12, '#05030c', 1.5);
    });
    // Tents and flags.
    across(0, 72, (x, i) => {
      const tx = x + hash(i, 71) * 30, c = ['#e84393', '#f2c94c', '#3b7dd8', '#3fae6a', '#f2994a'][i % 5];
      poly(ctx, [tx - 13, 180, tx, 162, tx + 13, 180], mix(c, '#1a1030', 0.45));
      poly(ctx, [tx, 162, tx + 13, 180, tx + 3, 180], mix(c, '#1a1030', 0.65));
    });
    across(30, 96, (x, i) => {
      const fx = x + hash(i, 72) * 40, h = 60 + hash(i, 73) * 36, c = ['#ff5c8a', '#ffd23c', '#5cd6ff', '#8cff9e'][i % 4];
      line(ctx, fx, 180, fx, 180 - h, '#1a1030', 1);
      ctx.beginPath();
      ctx.moveTo(fx, 180 - h);
      for (let k = 0; k <= 6; k++) ctx.lineTo(fx + k * 2.6, 180 - h + Math.sin(t * 5 + k * 0.9 + i) * 1.6 * (k / 6) + k * 0.4);
      for (let k = 6; k >= 0; k--) ctx.lineTo(fx + k * 2.6, 180 - h + 22 - k * 1.6 + Math.sin(t * 5 + k * 0.9 + i + 1) * 1.6 * (k / 6));
      ctx.fillStyle = mix(c, '#2a1648', 0.25);
      ctx.fill();
    });
    // Lasers over everyone's heads.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + Math.sin(t * 0.7 + i * 1.9) * 1.1;
      beam(ctx, 318, 128, a, 420, 0.014, ['#8cff9e', '#ff5cf0'][i % 2], 0.32);
    }
    // The crowd at the stage, hands in the air.
    ctx.fillStyle = '#0e0820';
    ctx.beginPath();
    ctx.moveTo(X0, 226);
    for (let x = X0; x <= X1; x += 5) {
      const i = Math.round(x / 5);
      ctx.lineTo(x, 180 - hash(i, 74) * 4 - Math.abs(Math.sin(t * 4 + hash(i, 75) * 6)) * 2.4);
      if (hash(i, 76) < 0.22) {
        ctx.lineTo(x + 1, 170 - Math.abs(Math.sin(t * 4 + i)) * 5);
        ctx.lineTo(x + 2.4, 180);
      }
    }
    ctx.lineTo(X1, 226);
    ctx.fill();
  },
  shell(ctx) {
    // The beer tent: poles and a scalloped canopy.
    for (const x of [-34, 434]) {
      rect(ctx, x - 3, 0, 6, 230, '#e9e2d2');
      rect(ctx, x + 1, 0, 2, 230, '#bfb7a6');
    }
    fillAcross(ctx, -400, 10, '#f4f1e8');
    across(0, 26, (x, i) => {
      const c = i % 2 ? '#e23d6d' : '#f4f1e8';
      rect(ctx, x, -400, 26, 412, c);
      ctx.beginPath();
      ctx.arc(x + 13, 12, 13, 0, Math.PI);
      ctx.fillStyle = c;
      ctx.fill();
    });
    fillAcross(ctx, -400, 10, 'rgba(20,10,40,0.3)');
    across(0, 26, (x) => {
      ctx.beginPath();
      ctx.arc(x + 13, 12, 13, 0, Math.PI);
      ctx.fillStyle = 'rgba(20,10,40,0.14)';
      ctx.fill();
    });
  },
  mid(ctx, t) {
    festoon(ctx, -34, 30, 200, 34, 12, t, ['#ffd23c', '#ff5c8a', '#5cd6ff', '#8cff9e'], 14, 2);
    festoon(ctx, 200, 34, 434, 30, 12, t, ['#ffd23c', '#ff5c8a', '#5cd6ff', '#8cff9e'], 14, 2);
    festoon(ctx, -190, 40, -34, 30, 9, t, ['#ffd23c', '#ff5c8a', '#5cd6ff'], 9, 2);
    festoon(ctx, 434, 30, 590, 40, 9, t, ['#ffd23c', '#ff5c8a', '#5cd6ff'], 9, 2);
  },
  front(ctx, t) {
    motes(ctx, t, 18, 2, '#ffd9f0', { y0: 20, y1: 200, a: 0.4 });
  },
};

// ---------------------------------------------------------------- 6. The Whole Town

function timberHouse(ctx: Ctx, x: number, w: number, top: number, flip: number) {
  at(ctx, x, 0, 0, flip, 1, () => {
    rect(ctx, 0, top, w, 240, '#efe3c8');
    rect(ctx, 0, top, w, 240, 'rgba(240,150,80,0.16)');
    const beam = '#3a2418';
    for (let y = top; y < 230; y += 44) {
      rect(ctx, 0, y, w, 4, beam);
      for (let bx = 0; bx < w; bx += 26) {
        rect(ctx, bx, y, 3.4, 44, beam);
        line(ctx, bx + 3, y + 44, bx + 26, y + 4, beam, 2.2, 'butt');
      }
    }
    // Jettied gable.
    poly(ctx, [-8, top, w + 6, top, w + 6, top - 8, w * 0.5, top - 54, -8, top - 8], '#6a3a2a');
    poly(ctx, [0, top - 6, w, top - 6, w * 0.5, top - 44], '#efe3c8');
    line(ctx, w * 0.5, top - 44, w * 0.5, top - 6, beam, 3, 'butt');
    line(ctx, w * 0.25, top - 25, w * 0.75, top - 25, beam, 2.4, 'butt');
    // Leaded windows, lit.
    for (const [wx, wy] of [[w * 0.5 - 12, top + 12], [w * 0.5 - 12, top + 58], [w * 0.5 - 12, top + 104]]) {
      rect(ctx, wx - 2, wy - 2, 28, 24, beam, 1);
      rect(ctx, wx, wy, 24, 20, '#ffd27a');
      ctx.strokeStyle = 'rgba(60,36,24,0.55)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let k = -20; k < 30; k += 5) {
        ctx.moveTo(wx + Math.max(0, k), wy + Math.max(0, -k));
        ctx.lineTo(wx + Math.min(24, k + 20), wy + Math.min(20, 20 - k));
        ctx.moveTo(wx + Math.min(24, 24 - k), wy + Math.max(0, -k));
        ctx.lineTo(wx + Math.max(0, 4 - k), wy + Math.min(20, 20 - k));
      }
      ctx.stroke();
    }
  });
}

const town: Backdrop = {
  fog: '#c98a5e', haze: 0.15, dim: 0.03, shine: 1.05, vignette: 0.42,
  bar: { kind: 'wood', top: '#a8733f', front: '#5c3a22', trim: '#e0b85a' },
  far(ctx, t) {
    sky(ctx, [0, '#3f4a8a', 0.4, '#c8688a', 0.7, '#f79a5a', 1, '#ffd98a'], 176);
    glow(ctx, 226, 158, 150, '#ffd27a', 0.7);
    circle(ctx, 226, 158, 24, '#fff0c0');
    clouds(ctx, t, 7, 51, 24, 100, 3.4, 'rgba(255,190,140,0.9)', 'rgba(190,100,120,0.7)', 1.3);
    birds(ctx, t, 9, 52, 30, 100, 18, 'rgba(60,30,50,0.75)');
    skyline(ctx, 150, 53, '#b06a6a', 8, 26, { roofs: true, minW: 12, maxW: 22 });
    // Chimney smoke.
    across(20, 110, (x, i) => {
      for (let k = 0; k < 6; k++) {
        const p = (t * 0.12 + k / 6 + hash(i, 5)) % 1;
        circle(ctx, x + p * 26 + Math.sin(p * 5 + i) * 4, 128 - p * 44, 3 + p * 8, alpha('#ffd9c0', 0.3 * (1 - p)));
      }
    });
    skyline(ctx, 172, 54, '#7a4252', 12, 34, { roofs: true, minW: 16, maxW: 30, lit: '#ffe6a0', t, density: 0.35 });
    // Church spire and the town hall clock.
    poly(ctx, [86, 172, 86, 118, 94, 84, 102, 118, 102, 172], '#5a3044');
    at(ctx, 322, 172, 0, 1, 1, () => {
      rect(ctx, -13, -78, 26, 78, '#5a3044');
      poly(ctx, [-16, -78, 0, -104, 16, -78], '#472438');
      circle(ctx, 0, -60, 9, '#f6ecd0');
      const d = new Date();
      const m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      line(ctx, 0, -60, Math.sin((h / 12) * TAU) * 4.6, -60 - Math.cos((h / 12) * TAU) * 4.6, '#2a1420', 1.3);
      line(ctx, 0, -60, Math.sin((m / 60) * TAU) * 7, -60 - Math.cos((m / 60) * TAU) * 7, '#2a1420', 0.9);
      glow(ctx, 0, -60, 20, '#ffe6a0', 0.5);
    });
    skyline(ctx, 196, 55, '#4a2a40', 10, 30, { roofs: true, minW: 20, maxW: 38, lit: '#ffe6a0', t, density: 0.5 });
  },
  shell(ctx) {
    timberHouse(ctx, -190, 246, 30, 1);
    timberHouse(ctx, 590, 246, 44, -1);
    rect(ctx, 56, -400, 4, 640, 'rgba(40,20,30,0.25)');
    rect(ctx, 340, -400, 4, 640, 'rgba(40,20,30,0.25)');
  },
  mid(ctx, t) {
    bunting(ctx, 56, 30, 344, 34, 24, t, UNION, 19, 6.4);
    bunting(ctx, 56, 70, 344, 62, 20, t, ['#f2c94c', '#3fae6a', '#e84393', '#3b7dd8'], 17, 5.6);
    bunting(ctx, -190, 22, 56, 30, 12, t, UNION, 15, 6);
    bunting(ctx, 344, 34, 590, 22, 12, t, UNION, 15, 6);
    // Hanging baskets either side of the square.
    for (const [x, y] of [[62, 104], [338, 108]]) {
      at(ctx, x, y, Math.sin(t * 1.1 + x) * 0.03, 1, 1, () => {
        line(ctx, 0, -22, 0, 0, '#2a1a12', 0.9);
        ellipse(ctx, 0, 5, 11, 7, '#4a2e1e');
        for (let i = 0; i < 9; i++) circle(ctx, -10 + i * 2.5, 0 - Math.sin(i * 1.3) * 3, 3, ['#e84393', '#ffd23c', '#f4f1e8'][i % 3]);
      });
    }
  },
  front(ctx, t) {
    motes(ctx, t, 20, 12, '#ffe2b0', { y0: 20, y1: 200, a: 0.55 });
  },
};

// ---------------------------------------------------------------- 7. Great Britain

function balloon(ctx: Ctx, x: number, y: number, s: number, t: number, union: boolean) {
  at(ctx, x, y + Math.sin(t * 0.6 + x * 0.01) * 4, Math.sin(t * 0.5 + x) * 0.04, s, s, () => {
    const env = [-17, -8, -15, -24, 0, -34, 15, -24, 17, -8, 8, 8, 4, 14, -4, 14, -8, 8];
    blob(ctx, env, union ? '#24408e' : '#f2994a', 0.5);
    ctx.save();
    blob(ctx, env, undefined, 0.5);
    ctx.clip();
    if (union) {
      line(ctx, -20, -36, 20, 16, '#f4f1e8', 6, 'butt');
      line(ctx, 20, -36, -20, 16, '#f4f1e8', 6, 'butt');
      rect(ctx, -4.5, -40, 9, 60, '#f4f1e8');
      rect(ctx, -20, -15, 40, 9, '#f4f1e8');
      rect(ctx, -2.4, -40, 4.8, 60, '#c8323a');
      rect(ctx, -20, -13, 40, 5, '#c8323a');
    } else {
      for (let i = 0; i < 5; i++) rect(ctx, -20 + i * 9, -40, 4.5, 60, '#f6e27a');
    }
    rect(ctx, 6, -40, 20, 60, 'rgba(20,10,40,0.16)');
    ctx.restore();
    line(ctx, -4, 14, -3, 21, '#4a3a2a', 0.6);
    line(ctx, 4, 14, 3, 21, '#4a3a2a', 0.6);
    rect(ctx, -3.6, 21, 7.2, 5.4, '#8a5a2a', 1);
  });
}

const britain: Backdrop = {
  fog: '#c4e6f2', haze: 0.13, dim: 0, shine: 1.15, vignette: 0.26,
  bar: { kind: 'wood', top: '#b98a52', front: '#1f4a36', trim: '#e0b85a' },
  far(ctx, t) {
    sky(ctx, ['#3f8fe0', '#7fc3f2', '#d9f0f7'], 150);
    glow(ctx, 60, 30, 90, '#fff8d0', 0.6);
    clouds(ctx, t, 10, 81, 14, 96, 5, '#ffffff', '#c9dff0', 1.5);
    balloon(ctx, drift(120, 3, t, 60), 58, 1, t, true);
    balloon(ctx, drift(430, 2, t, 60), 82, 0.6, t, false);
    birds(ctx, t, 5, 82, 40, 100, 12, 'rgba(50,60,80,0.7)');
    // The sea, off the white cliffs.
    fillAcross(ctx, 128, 226, vgrad(ctx, 128, 200, ['#7fc8e0', '#2f86b8']));
    for (let i = 0; i < 40; i++) {
      const y = 132 + hash(i, 83) * 60, x = drift(hash(i, 84) * SPAN, 4 + hash(i, 85) * 5, t, 10);
      rect(ctx, x, y, 8 + hash(i, 86) * 10, 0.9, alpha('#ffffff', 0.25 + 0.3 * Math.abs(Math.sin(t * 1.5 + i))), 0.4);
    }
    // A ferry.
    at(ctx, drift(250, -5, t, 40), 139, 0, 1, 1, () => {
      poly(ctx, [-13, 0, 13, 0, 10, 4, -11, 4], '#f4f1e8');
      rect(ctx, -7, -4, 12, 4, '#f4f1e8');
      rect(ctx, -2, -7.5, 3, 3.5, '#c8323a');
    });
    // Rolling patchwork hills.
    hills(ctx, 138, 15, 6.2, '#9ad08a', 0.6);
    hills(ctx, 152, 14, 2.4, vgrad(ctx, 136, 226, ['#84c56f', '#5fa856']), 0.9);
    // Fields and hedgerows.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X0, 226);
    for (let x = X0; x <= X1; x += 6) ctx.lineTo(x, hillY(x, 152, 14, 2.4, 0.9));
    ctx.lineTo(X1, 226);
    ctx.clip();
    for (let i = 0; i < 26; i++) {
      const fx = X0 + i * 31, c = ['#a9d67a', '#e6d98a', '#6fb060', '#c9e08a'][i % 4];
      poly(ctx, [fx, 226, fx + 44, 130, fx + 76, 130, fx + 32, 226], alpha(c, 0.75));
      line(ctx, fx, 226, fx + 44, 130, '#3f7a40', 1.3, 'butt');
    }
    ctx.restore();
    // White cliffs and a lighthouse.
    blob(ctx, [X0, 226, X0, 120, -130, 112, -84, 116, -58, 128, -54, 170, -40, 226], '#f4f1e8', 0.3);
    blob(ctx, [X0, 124, X0, 114, -130, 106, -84, 110, -56, 124, -90, 122, -140, 118], '#7fc06a', 0.3);
    for (let i = 0; i < 9; i++) line(ctx, -66 - i * 13, 128 + (i % 3) * 3, -68 - i * 13, 200, 'rgba(160,170,180,0.35)', 1.4);
    at(ctx, -100, 110, 0, 1, 1, () => {
      beam(ctx, 0, -31, t * 0.8, 150, 0.07, '#fffbe0', 0.3);
      beam(ctx, 0, -31, t * 0.8 + Math.PI, 150, 0.07, '#fffbe0', 0.3);
      poly(ctx, [-5, 0, 5, 0, 3.4, -28, -3.4, -28], '#f4f1e8');
      rect(ctx, -4.4, -12, 8.8, 5, '#c8323a');
      rect(ctx, -4, -22, 8, 4, '#c8323a');
      rect(ctx, -4.4, -34, 8.8, 6, '#2a2a30', 1);
      circle(ctx, 0, -31, 2, '#fff6c0');
      poly(ctx, [-5, -34, 0, -39, 5, -34], '#c8323a');
    });
    // A steam train crossing the viaduct.
    const vy = 168;
    across(196, 22, (x) => {
      if (x < 180 || x > 470) return;
      ctx.beginPath();
      ctx.moveTo(x, 226);
      ctx.lineTo(x, vy + 14);
      ctx.arc(x + 9, vy + 14, 9, Math.PI, TAU);
      ctx.lineTo(x + 18, 226);
      ctx.lineTo(x + 22, 226);
      ctx.lineTo(x + 22, vy);
      ctx.lineTo(x, vy);
      ctx.closePath();
      ctx.fillStyle = '#b08a72';
      ctx.fill();
    });
    rect(ctx, 176, vy - 2, 320, 3, '#8f6a58');
    const tx = lerp(120, 560, (t * 0.035) % 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(176, 100, 320, vy - 100);
    ctx.clip();
    for (let k = 0; k < 7; k++) {
      const p = ((t * 0.5 + k / 7) % 1);
      circle(ctx, tx + 10 - p * 44, vy - 14 - p * 20, 2.6 + p * 7, alpha('#ffffff', 0.7 * (1 - p)));
    }
    rect(ctx, tx - 6, vy - 9, 20, 7, '#1f4a36', 1.5);
    rect(ctx, tx + 8, vy - 13, 3, 5, '#17181c');
    rect(ctx, tx - 6, vy - 12, 6, 4, '#1f4a36');
    for (let c = 1; c <= 3; c++) {
      rect(ctx, tx - 6 - c * 21, vy - 9, 19, 7, '#8a2a2a', 1);
      for (let w = 0; w < 4; w++) rect(ctx, tx - 4 - c * 21 + w * 4.4, vy - 7.6, 2.8, 2.6, '#ffe6a8');
    }
    ctx.restore();
    // Sheep.
    for (let i = 0; i < 9; i++) {
      const sx = 10 + i * 19 + hash(i, 88) * 10, sy = hillY(sx, 152, 14, 2.4, 0.9) + 12 + hash(i, 89) * 22;
      ellipse(ctx, sx, sy, 3.6, 2.6, '#fbf8f0');
      circle(ctx, sx + 3.4 * (i % 2 ? 1 : -1), sy - 0.8 + Math.max(0, Math.sin(t * 0.8 + i * 2)) * 1.6, 1.4, '#2a2a30');
    }
  },
  shell(ctx) {
    // A marquee: white poles and a red, white and blue valance.
    for (const x of [-40, 440]) {
      rect(ctx, x - 3, 0, 6, 230, '#f4f1e8');
      rect(ctx, x + 1, 0, 2, 230, '#c9c5ba');
    }
    across(0, 22, (x, i) => {
      const c = UNION[i % 3];
      rect(ctx, x, -400, 22, 410, c);
      poly(ctx, [x, 10, x + 22, 10, x + 11, 22], c);
    });
    fillAcross(ctx, -400, 10, 'rgba(255,255,255,0.12)');
    fillAcross(ctx, 8, 10, 'rgba(20,20,60,0.18)');
  },
  mid(ctx, t) {
    bunting(ctx, -40, 34, 200, 36, 18, t, UNION, 15, 7);
    bunting(ctx, 200, 36, 440, 34, 18, t, UNION, 15, 7);
    bunting(ctx, -190, 40, -40, 34, 9, t, UNION, 9, 7);
    bunting(ctx, 440, 34, 590, 40, 9, t, UNION, 9, 7);
  },
  front(ctx, t) {
    motes(ctx, t, 10, 18, '#ffffff', { y0: 20, y1: 190, a: 0.4, size: 0.7 });
  },
};

export const BACKDROPS: Record<string, Backdrop> = {
  redlion, garden, highstreet, superpub, festival, town, britain,
};

/** Add more locations (the world tour and space live in their own files). */
export function registerBackdrops(more: Record<string, Backdrop>) {
  Object.assign(BACKDROPS, more);
}
