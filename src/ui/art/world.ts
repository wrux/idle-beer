/**
 * The world tour: eight pubs abroad, between Great Britain and The Earth Inn.
 * Painted the same way as the others (see backdrops.ts): far, shell, mid, front.
 */
import type { Backdrop } from './backdrops';
import {
  TAU, alpha, arc, at, blob, circle, curve, ellipse, glow, hash, lerp, line, mix, poly, rect, shade, tint, vgrad, type Ctx,
} from './draw';
import {
  SPAN, X0, X1, archPath, birds, bottles, bunting, clouds, drift, festoon, fillAcross, hillY, hills, motes, pendant,
  punch, sky, skyline, stars, wainscot, wallpaper,
} from './kit';

/** Repeat something at regular x positions across the whole scene. */
function across(first: number, step: number, fn: (x: number, i: number) => void) {
  let i = 0;
  for (let x = first - Math.ceil((first - X0) / step) * step; x < X1; x += step) fn(x, i++);
}

/** A ridge of mountains: jagged where `rough` is high, optionally snow-capped. */
function mountains(ctx: Ctx, baseY: number, height: number, seed: number, fill: string | CanvasGradient, rough = 1, snow?: string) {
  const y = (x: number) =>
    baseY - height * (0.5 + 0.34 * Math.sin(x * 0.009 + seed) + 0.22 * Math.sin(x * 0.023 + seed * 2.3))
    - rough * 9 * Math.abs(Math.sin(x * 0.06 + seed * 1.7)) - rough * 4 * Math.abs(Math.sin(x * 0.17 + seed));
  ctx.beginPath();
  ctx.moveTo(X0, 230);
  for (let x = X0; x <= X1; x += 4) ctx.lineTo(x, y(x));
  ctx.lineTo(X1, 230);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (snow) {
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(X0, -200);
    for (let x = X0; x <= X1; x += 4) ctx.lineTo(x, y(x) + 9 + 5 * Math.sin(x * 0.4));
    ctx.lineTo(X1, -200);
    ctx.closePath();
    ctx.fillStyle = snow;
    ctx.fill();
    ctx.restore();
  }
  return y;
}

/** A paper or silk lantern on a cord, swaying, lit from inside. */
function lantern(ctx: Ctx, x: number, len: number, t: number, ph: number, colour: string, s = 1, round = true) {
  const a = Math.sin(t * 1.1 + ph) * 0.05;
  line(ctx, x, -200, x + Math.sin(a) * len, len - 9 * s, '#1c1410', 0.8);
  at(ctx, x + Math.sin(a) * len, len, a, s, s, () => {
    glow(ctx, 0, 0, 30, colour, 0.5 + 0.08 * Math.sin(t * 5 + ph));
    if (round) {
      ellipse(ctx, 0, 0, 9.5, 8, colour);
      ellipse(ctx, -2.6, -1, 4.4, 6.6, alpha(tint(colour, 0.5), 0.6));
      for (const lx of [-5.4, 0, 5.4]) curve(ctx, [lx, -7.4, lx * 1.5, 0, lx, 7.4], alpha('#3a0a0a', 0.3), 0.6);
    } else {
      rect(ctx, -6.5, -10, 13, 20, colour, 3);
      rect(ctx, -4, -8, 3.4, 16, alpha(tint(colour, 0.5), 0.55), 1.5);
      for (const ly of [-5, 0, 5]) line(ctx, -6.5, ly, 6.5, ly, alpha('#3a0a0a', 0.25), 0.6);
    }
    rect(ctx, -4.6, -10.6 * (round ? 0.85 : 1.06), 9.2, 2.4, '#2a1a12', 1);
    rect(ctx, -4.6, 7.6 * (round ? 0.9 : 1.1), 9.2, 2.4, '#2a1a12', 1);
    line(ctx, 0, 10, Math.sin(t * 2 + ph) * 1.4, 17, '#d9b25a', 1);
  });
}

const CJK = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

/** Lettering set vertically, one character under the next, as on a street sign. */
function vtext(ctx: Ctx, text: string, x: number, y: number, size: number, colour: string) {
  ctx.font = `700 ${size}px ${CJK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  [...text].forEach((ch, i) => {
    const cy = y + i * size * 1.12;
    if (ch === 'ー') {
      // The long-vowel dash stands upright in vertical writing.
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    } else ctx.fillText(ch, x, cy);
  });
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/** Lettering set across. */
function htext(ctx: Ctx, text: string, x: number, y: number, size: number, colour: string) {
  ctx.font = `700 ${size}px ${CJK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ---------------------------------------------------------------- The Highland Bothy

const highlands: Backdrop = {
  fog: '#9aa8ae', haze: 0.14, dim: 0.03, shine: 1, vignette: 0.42,
  bar: { kind: 'wood', top: '#8a6a4a', front: '#3f3228', trim: '#b8a47a' },
  far(ctx, t) {
    sky(ctx, [0, '#5f7a94', 0.5, '#a8b4c4', 0.8, '#e8c4b4', 1, '#f2d9c0'], 170);
    glow(ctx, 310, 70, 110, '#fff0d8', 0.45);
    clouds(ctx, t, 6, 201, 10, 70, 5, 'rgba(232,236,242,0.8)', 'rgba(150,164,184,0.7)', 1.1);
    mountains(ctx, 150, 86, 3.1, '#7a8aa6', 1.4);
    mountains(ctx, 160, 62, 7.4, '#6a7a86', 1);
    // Mist lying in the glen.
    for (let i = 0; i < 8; i++) {
      ellipse(ctx, drift(i * 110, 3 + (i % 3), t, 120), 132 + (i % 3) * 7, 90, 7, 'rgba(236,240,244,0.32)');
    }
    // The loch, and a ruined keep on its island.
    fillAcross(ctx, 150, 230, vgrad(ctx, 150, 200, ['#8fa6b8', '#4f6a80']));
    for (let i = 0; i < 26; i++) {
      const x = drift(hash(i, 211) * SPAN, 3, t, 10), y = 154 + hash(i, 212) * 40;
      rect(ctx, x, y, 10 + hash(i, 213) * 16, 0.8, alpha('#ffffff', 0.2 + 0.25 * Math.abs(Math.sin(t * 1.2 + i))), 0.4);
    }
    at(ctx, 96, 152, 0, 1, 1, () => {
      ellipse(ctx, 0, 2, 40, 5, '#4f5a44');
      rect(ctx, -16, -18, 20, 19, '#5a5a62');
      rect(ctx, -22, -28, 9, 29, '#4e4e58');
      for (let i = 0; i < 3; i++) rect(ctx, -22 + i * 3.4, -31, 2, 3.4, '#4e4e58');
      poly(ctx, [4, 1, 4, -11, 12, -8, 16, 1], '#5a5a62');
      rect(ctx, -11, -11, 3, 5, '#2a2a34');
      ellipse(ctx, 0, 9, 34, 3, 'rgba(40,50,60,0.25)');
    });
    // The near shore: heather and bracken.
    hills(ctx, 176, 12, 5.2, vgrad(ctx, 160, 226, ['#6f7f52', '#4a5a3a']), 1.2);
    for (let i = 0; i < 60; i++) {
      const x = X0 + hash(i, 214) * SPAN;
      circle(ctx, x, hillY(x, 176, 12, 5.2, 1.2) + 4 + hash(i, 215) * 30, 2.4 + hash(i, 216) * 2, alpha(i % 3 ? '#9a5a9a' : '#7a4a8a', 0.75));
    }
    // A stag on the skyline, and a highland cow by the water.
    at(ctx, 312, hillY(312, 176, 12, 5.2, 1.2) + 1, 0, 1, 1, () => {
      const c = '#3a2c24';
      ellipse(ctx, 0, -11, 9, 4.6, c);
      for (const lx of [-6, -3, 4, 7]) rect(ctx, lx, -9, 1.6, 10, c);
      poly(ctx, [6, -13, 11, -21, 14, -20, 10, -11], c);
      ellipse(ctx, 13, -21.6, 3.4, 2.2, c);
      const nod = Math.sin(t * 0.6) * 0.6;
      for (const s of [-1, 1]) {
        curve(ctx, [12, -23, 12 + s * 3, -29 + nod, 12 + s * 6.6, -33 + nod], c, 1);
        line(ctx, 12 + s * 3, -28.6 + nod, 12 + s * 6, -27 + nod, c, 0.9);
      }
    });
    at(ctx, 214, 182, 0, 1, 1, () => {
      const c = '#c26a2c';
      ellipse(ctx, 0, -8, 12, 7, c);
      for (const lx of [-8, -4, 4, 8]) rect(ctx, lx, -4, 2.4, 8, shade(c, 0.2));
      circle(ctx, -12, -11, 5.6, c);
      blob(ctx, [-18, -13, -12, -17, -7, -13, -8, -6, -12, -4, -17, -6], tint(c, 0.12), 0.5);
      curve(ctx, [-17, -14, -21, -17, -22, -21], '#f1ead9', 1.3);
      curve(ctx, [-8, -14, -4, -17, -3, -21], '#f1ead9', 1.3);
    });
    birds(ctx, t, 4, 217, 30, 80, 9, 'rgba(40,50,60,0.6)', 1.2);
  },
  shell(ctx) {
    // A drystone wall, and the timber frame of the bothy's open front.
    fillAcross(ctx, 186, 230, '#6a6a6e');
    for (let y = 186; y < 230; y += 7) {
      for (let x = X0 + ((y / 7) % 2 ? 0 : 9); x < X1; x += 18 + (hash(x, y) * 8)) {
        rect(ctx, x, y, 16 + hash(x, y + 1) * 7, 6, mix('#7a7a80', '#55555c', hash(x, y + 2)), 2);
      }
    }
    for (const x of [-30, 430]) {
      rect(ctx, x - 5, -20, 10, 250, '#4a3a2c');
      rect(ctx, x - 5, -20, 3, 250, '#5e4a38');
    }
    fillAcross(ctx, -400, 12, '#3a2e24');
    fillAcross(ctx, 12, 16, '#5e4a38');
    for (const x of [-30, 430]) {
      poly(ctx, [x + 5, 16, x + 30, 16, x + 5, 44], '#4a3a2c');
      poly(ctx, [x - 5, 16, x - 30, 16, x - 5, 44], '#4a3a2c');
    }
  },
  mid(ctx, t) {
    across(96, 208, (x, i) => pendant(ctx, x, 28, t, i * 1.9, '#3a3a40', '#ffd9a0', { kind: 'bulb', cone: 0.5 }));
    bunting(ctx, -30, 22, 200, 24, 12, t, ['#2f5a3a', '#24408e', '#f4f1e8'], 12, 6);
    bunting(ctx, 200, 24, 430, 22, 12, t, ['#2f5a3a', '#24408e', '#f4f1e8'], 12, 6);
  },
  front(ctx, t) {
    for (let i = 0; i < 5; i++) ellipse(ctx, drift(i * 170, 5, t, 140), 196 - (i % 2) * 14, 120, 9, 'rgba(236,240,244,0.07)');
    motes(ctx, t, 8, 218, '#ffffff', { y0: 30, y1: 190, a: 0.3, size: 0.7 });
  },
};

// ---------------------------------------------------------------- Prague

const prague: Backdrop = {
  fog: '#b98a6a', haze: 0.15, dim: 0.06, shine: 1, vignette: 0.52,
  bar: { kind: 'wood', top: '#9a6a3c', front: '#4a2c18', trim: '#d9b25a' },
  far(ctx, t) {
    sky(ctx, [0, '#34406e', 0.4, '#a8607a', 0.72, '#f29a5a', 1, '#ffd98a'], 170);
    glow(ctx, 110, 150, 130, '#ffd27a', 0.6);
    clouds(ctx, t, 6, 221, 20, 80, 3, 'rgba(255,180,140,0.8)', 'rgba(170,90,120,0.6)', 1.3);
    birds(ctx, t, 7, 222, 30, 90, 14, 'rgba(50,30,50,0.7)');
    // Castle hill: the long palace, and the cathedral's spires behind it.
    hills(ctx, 138, 16, 0.4, '#6a4660', 0.5);
    at(ctx, 236, 112, 0, 1, 1, () => {
      const c = '#4a2e4a';
      rect(ctx, -110, 0, 250, 26, c);
      for (let i = 0; i < 24; i++) rect(ctx, -104 + i * 10, 7, 3, 5, alpha('#ffd98a', hash(i, 223) < 0.6 ? 0.85 : 0.2));
      poly(ctx, [-110, 0, 140, 0, 136, -6, -106, -6], '#5a3650');
      // St Vitus.
      rect(ctx, -16, -34, 40, 34, c);
      for (const [sx, h] of [[-12, 44], [2, 60], [16, 44]]) {
        rect(ctx, sx - 4, -h + 16, 8, h - 16, c);
        poly(ctx, [sx - 5, -h + 16, sx, -h - 8, sx + 5, -h + 16], '#3a2440');
        line(ctx, sx, -h - 8, sx, -h - 13, '#3a2440', 0.8);
      }
      poly(ctx, [24, -34, 44, -22, 44, 0, 24, 0], c);
      for (let i = 0; i < 4; i++) poly(ctx, [-70 + i * 16, -6, -65 + i * 16, -16, -60 + i * 16, -6], '#5a3650');
    });
    skyline(ctx, 158, 224, '#7a4458', 8, 22, { roofs: true, minW: 12, maxW: 22, lit: '#ffe6a0', t, density: 0.3 });
    // The river and the old bridge, with its statues and lamps.
    fillAcross(ctx, 170, 230, vgrad(ctx, 170, 210, ['#c8785a', '#4a3a5e']));
    for (let i = 0; i < 20; i++) {
      rect(ctx, drift(hash(i, 225) * SPAN, 4, t, 10), 174 + hash(i, 226) * 30, 12, 0.8, alpha('#ffe6b0', 0.3 + 0.3 * Math.abs(Math.sin(t + i))), 0.4);
    }
    const by = 172;
    across(0, 46, (x) => {
      ctx.beginPath();
      ctx.moveTo(x, 232);
      ctx.lineTo(x, by + 8);
      ctx.arc(x + 23, by + 22, 19, Math.PI, TAU);
      ctx.lineTo(x + 46, 232);
      ctx.lineTo(x + 46, by);
      ctx.lineTo(x, by);
      ctx.closePath();
      ctx.fillStyle = '#5a3a44';
      ctx.fill();
      rect(ctx, x - 1.2, by - 8, 2.4, 8, '#3a2434');
      circle(ctx, x, by - 10, 2.2, '#3a2434');
      if ((Math.round(x / 46) % 2) === 0) glow(ctx, x + 23, by - 4, 14, '#ffd27a', 0.7);
    });
    fillAcross(ctx, by - 1.6, by + 1.4, '#3a2434');
  },
  shell(ctx) {
    // A vaulted cellar: plaster arches open onto the river.
    wallpaper(ctx, -400, 160, '#e6d4b4', 'rgba(150,110,70,0.1)', 'none');
    across(18, 150, (x) => {
      const w = 124, y = 26, h = 134;
      punch(ctx, () => archPath(ctx, x, y, w, h, 46));
      ctx.strokeStyle = '#b89a70';
      ctx.lineWidth = 5;
      archPath(ctx, x, y, w, h, 46);
      ctx.stroke();
      ctx.strokeStyle = '#f4e8cc';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      rect(ctx, x + w + 4, 60, 18, 100, '#d9c4a0', 2);
      rect(ctx, x + w + 2, 56, 22, 5, '#b89a70', 1);
    });
    fillAcross(ctx, -400, 14, '#b89a70');
    wainscot(ctx, 158, 226, '#5a3620');
  },
  mid(ctx, t) {
    // Hop garlands and wrought-iron lamps.
    across(18, 150, (x, i) => {
      const lx = x + 137;
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const u = k / 20, gx = lerp(lx - 150, lx, u), gy = 18 + Math.sin(u * Math.PI) * 13 + Math.sin(t + u * 6) * 0.6;
        ctx.lineTo(gx, gy);
        if (k % 2) circle(ctx, gx, gy + 2, 2.6 + (k % 3), k % 4 ? '#5f8a3a' : '#8ab04a');
      }
      pendant(ctx, lx, 44, t, i * 2.3, '#2a2420', '#ffcf7a', { kind: 'globe', cone: 0.6 });
    });
  },
  front(ctx, t) {
    motes(ctx, t, 18, 229, '#ffe2b0', { y0: 20, y1: 200, a: 0.5 });
  },
};

// ---------------------------------------------------------------- Oktoberfest

const oktoberfest: Backdrop = {
  fog: '#d9b27a', haze: 0.14, dim: 0.04, shine: 1.05, vignette: 0.46,
  bar: { kind: 'planks', top: '#d0a66c', front: '#9a6e42', trim: '#3f7fc8' },
  far(ctx, t) {
    // Inside the big tent: a ceiling of blue and white cloth running away to the far end.
    fillAcross(ctx, -400, 232, '#f4ead2');
    const vx = 200, vy = 118;
    for (let i = -16; i < 16; i++) {
      poly(ctx, [vx + i * 6, vy, vx + (i + 1) * 6, vy, vx + (i + 1) * 60, -60, vx + i * 60, -60], i % 2 ? '#3f7fc8' : '#f4f1e8');
    }
    for (let k = 0; k < 6; k++) {
      // Swags of cloth across the roof.
      const y = lerp(vy - 6, -30, (k / 5) ** 1.6), w = lerp(40, 620, (k / 5) ** 1.6);
      ctx.beginPath();
      ctx.moveTo(vx - w, y);
      ctx.quadraticCurveTo(vx, y + 10 + k * 5, vx + w, y);
      ctx.strokeStyle = 'rgba(30,50,110,0.18)';
      ctx.lineWidth = 1.2 + k * 0.5;
      ctx.stroke();
    }
    ctx.fillStyle = vgrad(ctx, 60, 130, ['rgba(255,236,190,0)', 'rgba(255,226,170,0.6)']);
    ctx.fillRect(X0, 60, SPAN, 70);
    // The bandstand, and the band.
    at(ctx, 200, 150, 0, 1, 1, () => {
      rect(ctx, -52, -34, 104, 34, '#7a4a2a');
      poly(ctx, [-58, -34, 0, -58, 58, -34], '#2f5a8a');
      rect(ctx, -52, -36, 104, 4, '#f4f1e8');
      for (let i = 0; i < 7; i++) rect(ctx, -48 + i * 15, -34, 6, 34, 'rgba(255,255,255,0.12)');
      const beat = Math.sin(t * 5);
      for (let i = 0; i < 5; i++) {
        const x = -36 + i * 18, y = -8 - Math.abs(Math.sin(t * 5 + i)) * 1.6;
        rect(ctx, x - 4, y - 8, 8, 16, i % 2 ? '#f4f1e8' : '#c8323a', 2);
        circle(ctx, x, y - 12, 3.6, '#e8bc98');
        poly(ctx, [x - 4.4, y - 14, x + 4.4, y - 14, x + 2, y - 18, x - 2, y - 18], '#2f5a3a');
        // Brass.
        ellipse(ctx, x + 5 + beat * 0.6, y - 4, 3.6, 4.4, '#e0b85a');
        ellipse(ctx, x + 5 + beat * 0.6, y - 4, 2, 2.6, '#8a6a24');
      }
      glow(ctx, 0, -20, 90, '#ffe6a8', 0.3);
    });
    // Long tables, and everybody swaying on the benches.
    for (let row = 0; row < 3; row++) {
      const y = 158 + row * 14, sc = 1 + row * 0.3;
      ctx.fillStyle = mix('#5a3a2a', '#d9b27a', 0.45 - row * 0.15);
      ctx.beginPath();
      ctx.moveTo(X0, 232);
      for (let x = X0; x <= X1; x += 7 * sc) {
        const i = Math.round(x / 7), sway = Math.sin(t * 2.4 + row + x * 0.004) * 2 * sc;
        ctx.lineTo(x + sway, y);
        ctx.arc(x + 3.5 * sc + sway, y - 3 * sc - hash(i, 311 + row) * 2, 3.2 * sc, Math.PI, TAU);
        if (hash(i, 320 + row) < 0.2) {
          // A mug in the air.
          ctx.lineTo(x + 6 * sc + sway, y - 12 * sc - Math.abs(Math.sin(t * 3 + i)) * 3);
          ctx.lineTo(x + 7 * sc + sway, y);
        }
      }
      ctx.lineTo(X1, 232);
      ctx.fill();
    }
  },
  shell(ctx) {
    // Tent poles wound with garlands, and a scalloped valance of blue and white lozenges.
    for (const x of [-34, 122, 278, 434]) {
      rect(ctx, x - 4, 0, 8, 232, '#e9e2d2');
      rect(ctx, x + 1, 0, 3, 232, '#c9c1b0');
      for (let y = 20; y < 230; y += 9) {
        circle(ctx, x - 3 + ((y / 9) % 2) * 6, y, 3.4, (y / 9) % 3 ? '#3f7a3a' : '#5a9a4a');
      }
    }
    across(0, 18, (x, i) => {
      for (let r = 0; r < 2; r++) {
        const y = 2 + r * 9, off = r ? 9 : 0;
        poly(ctx, [x + off, y, x + off + 9, y - 9, x + off + 18, y, x + off + 9, y + 9], (i + r) % 2 ? '#3f7fc8' : '#f4f1e8');
      }
    });
    fillAcross(ctx, -400, -6, '#3f7fc8');
  },
  mid(ctx, t) {
    // Hop wreaths hung from the roof, turning a little, with ribbons.
    across(44, 156, (x, i) => {
      const a = Math.sin(t * 0.8 + i * 1.7) * 0.05;
      line(ctx, x, -200, x + Math.sin(a) * 60, 40, '#1c1410', 0.8);
      at(ctx, x + Math.sin(a) * 60, 58, a, 1, 1, () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 9, 0, 0, TAU);
        ctx.strokeStyle = '#3f7a3a';
        ctx.lineWidth = 6;
        ctx.stroke();
        for (let k = 0; k < 16; k++) {
          const an = (k / 16) * TAU;
          circle(ctx, Math.cos(an) * 24, Math.sin(an) * 9, 3, k % 3 ? '#5a9a4a' : '#8ab04a');
        }
        for (let k = 0; k < 4; k++) {
          const rx = -18 + k * 12, sw = Math.sin(t * 2 + k + i) * 2;
          poly(ctx, [rx - 1.6, 8, rx + 1.6, 8, rx + 1.6 + sw, 24, rx - 1.6 + sw, 24], k % 2 ? '#3f7fc8' : '#f4f1e8');
        }
        for (let k = 0; k < 6; k++) glow(ctx, Math.cos((k / 6) * TAU) * 24, Math.sin((k / 6) * TAU) * 9 - 2, 9, '#ffe6a8', 0.7);
      });
    });
    festoon(ctx, -34, 30, 122, 30, 10, t, ['#ffd27a', '#fff1c2'], 8, 1.7, 0.6);
    festoon(ctx, 122, 30, 278, 30, 10, t, ['#ffd27a', '#fff1c2'], 8, 1.7, 0.6);
    festoon(ctx, 278, 30, 434, 30, 10, t, ['#ffd27a', '#fff1c2'], 8, 1.7, 0.6);
  },
  front(ctx, t) {
    motes(ctx, t, 16, 329, '#fff0c8', { y0: 20, y1: 200, a: 0.45 });
  },
};

// ---------------------------------------------------------------- The Mead Hall

function longship(ctx: Ctx, x: number, y: number, s: number, t: number) {
  at(ctx, x, y + Math.sin(t * 1.1 + x) * 1.2, Math.sin(t * 0.9 + x) * 0.03, s, s, () => {
    const hull = '#3a2a22';
    // Sail, striped.
    line(ctx, 0, -4, 0, -40, hull, 1.4);
    const belly = 3 + Math.sin(t * 1.4) * 1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-16, -37);
    ctx.lineTo(16, -37);
    ctx.quadraticCurveTo(16 + belly, -22, 16, -10);
    ctx.lineTo(-16, -10);
    ctx.quadraticCurveTo(-16 + belly, -22, -16, -37);
    ctx.closePath();
    ctx.fillStyle = '#f1ead9';
    ctx.fill();
    ctx.clip();
    for (let i = 0; i < 4; i++) rect(ctx, -18 + i * 9.4, -40, 4.7, 34, '#b8322c');
    ctx.restore();
    // Hull, with a dragon at the prow and shields along the side.
    blob(ctx, [-30, -6, -24, 2, 0, 5, 24, 2, 30, -6, 20, -2, 0, 0, -20, -2], hull, 0.5);
    curve(ctx, [28, -5, 33, -12, 31, -19], hull, 2.6);
    circle(ctx, 31.6, -20, 2.4, hull);
    poly(ctx, [33, -21, 37, -20, 33.6, -18.4], hull);
    curve(ctx, [-28, -5, -33, -11, -32, -16], hull, 2.2);
    for (let i = 0; i < 7; i++) circle(ctx, -18 + i * 6, -1, 2.4, ['#c8323a', '#f2c94c', '#2f5a8a'][i % 3]);
  });
}

const meadhall: Backdrop = {
  fog: '#2a3a5a', haze: 0.16, dim: 0.11, shine: 0.95, vignette: 0.6,
  bar: { kind: 'wood', top: '#7a5234', front: '#3a2418', trim: '#b8862e' },
  far(ctx, t) {
    sky(ctx, ['#060a22', '#10204a', '#1f4a6a', '#3a6a7a'], 170);
    stars(ctx, t, 90, 331, { yMax: 120 });
    // Northern lights, hanging in folds.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      const col = ['#3fffa8', '#5fe0ff', '#b06bff'][band];
      for (let x = X0; x < X1; x += 6) {
        const wave = Math.sin(x * 0.014 + t * 0.35 + band * 2) + 0.5 * Math.sin(x * 0.037 - t * 0.5 + band);
        const top = 24 + band * 12 + wave * 14, h = 44 + 22 * Math.sin(x * 0.05 + t * 0.7 + band);
        const g = ctx.createLinearGradient(0, top, 0, top + h);
        g.addColorStop(0, alpha(col, 0));
        g.addColorStop(0.25, alpha(col, 0.2 + 0.08 * Math.sin(x * 0.2 + t * 2)));
        g.addColorStop(1, alpha(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, top, 6.4, h);
      }
    }
    ctx.restore();
    mountains(ctx, 150, 80, 2.4, '#2a3a5e', 1.7, '#c9dcee');
    mountains(ctx, 160, 52, 6.6, '#1f2c4a', 1.2, '#9ab4d0');
    // The fjord, with the lights in it, and the ships coming home.
    fillAcross(ctx, 156, 232, vgrad(ctx, 156, 210, ['#2a5a6a', '#0e1c38']));
    for (let i = 0; i < 26; i++) {
      rect(ctx, drift(hash(i, 332) * SPAN, 3, t, 10), 160 + hash(i, 333) * 46, 12 + hash(i, 334) * 14, 0.9, alpha(i % 2 ? '#3fffa8' : '#5fe0ff', 0.2 + 0.25 * Math.abs(Math.sin(t * 1.3 + i))), 0.4);
    }
    longship(ctx, drift(120, 5, t, 80), 174, 0.7, t);
    longship(ctx, drift(420, 3.4, t, 80), 166, 0.5, t);
  },
  shell(ctx) {
    // A timber hall, open at the gable: carved posts, a beam of shields.
    for (const x of [-30, 430]) {
      rect(ctx, x - 8, 0, 16, 232, '#4a3020');
      rect(ctx, x - 8, 0, 5, 232, '#63422c');
      for (let y = 30; y < 230; y += 26) {
        curve(ctx, [x - 5, y, x + 5, y + 6, x - 5, y + 13, x + 5, y + 19], '#2a1a10', 1.2);
      }
    }
    fillAcross(ctx, -400, 10, '#2e1e14');
    fillAcross(ctx, 10, 24, '#4a3020');
    fillAcross(ctx, 10, 13, '#63422c');
    across(22, 44, (x, i) => {
      const c = ['#b8322c', '#2f5a8a', '#d9a22a', '#2f6a4a'][i % 4];
      circle(ctx, x, 17, 12, '#2a1a10');
      circle(ctx, x, 17, 10.6, c);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, 17, 10.6, 0, TAU);
      ctx.clip();
      if (i % 2) {
        rect(ctx, x - 12, 14.6, 24, 4.8, '#f1ead9');
        rect(ctx, x - 2.4, 5, 4.8, 24, '#f1ead9');
      } else {
        for (let k = 0; k < 4; k++) poly(ctx, [x, 17, x + Math.cos(k * 1.571) * 14, 17 + Math.sin(k * 1.571) * 14, x + Math.cos(k * 1.571 + 0.785) * 14, 17 + Math.sin(k * 1.571 + 0.785) * 14], '#f1ead9');
      }
      ctx.restore();
      circle(ctx, x, 17, 2.8, '#b9c0cc');
    });
    for (const x of [-30, 430]) {
      // Dragon heads where the rafters cross.
      const s = x < 0 ? 1 : -1;
      curve(ctx, [x, 26, x + s * 12, 36, x + s * 22, 30, x + s * 28, 38], '#4a3020', 5);
      poly(ctx, [x + s * 26, 34, x + s * 36, 38, x + s * 27, 42], '#4a3020');
    }
    // A wall of rough planks along the bottom.
    fillAcross(ctx, 188, 232, '#3a2418');
    across(0, 16, (x) => rect(ctx, x, 188, 1.4, 44, '#2a1a10'));
  },
  mid(ctx, t) {
    // Fire bowls on chains.
    across(96, 208, (x, i) => {
      const fl = 0.75 + 0.15 * Math.sin(t * 9 + i * 3) + 0.1 * Math.sin(t * 17 + i);
      line(ctx, x - 9, 24, x - 7, 62, '#1c1410', 0.7);
      line(ctx, x + 9, 24, x + 7, 62, '#1c1410', 0.7);
      glow(ctx, x, 54, 70, '#ff9a3a', 0.45 * fl);
      for (let k = 0; k < 5; k++) {
        const p = (t * 1.4 + k / 5 + i) % 1;
        ellipse(ctx, x + Math.sin(p * 7 + k) * 3, 60 - p * 18, 4 * (1 - p) + 1, 6 * (1 - p) + 1, alpha(k % 2 ? '#ffd23c' : '#ff7a2a', 0.85 * (1 - p)));
      }
      poly(ctx, [x - 11, 61, x + 11, 61, x + 7, 68, x - 7, 68], '#2a2a30');
    });
  },
  front(ctx, t) {
    // Sparks from the fires.
    for (let i = 0; i < 14; i++) {
      const p = (t * (0.12 + hash(i, 335) * 0.1) + hash(i, 336)) % 1;
      glow(ctx, 96 + (i % 2) * 208 + Math.sin(p * 6 + i) * 18, 60 - p * 70, 2.4, '#ffb060', (1 - p) * 0.9);
    }
  },
};

// ---------------------------------------------------------------- Bavaria

const bavaria: Backdrop = {
  fog: '#c4e2f2', haze: 0.12, dim: 0, shine: 1.15, vignette: 0.26,
  bar: { kind: 'planks', top: '#d0a66c', front: '#a47a4c', trim: '#f4f1e8' },
  far(ctx, t) {
    sky(ctx, ['#3f8fe0', '#86c6f2', '#dff2f8'], 160);
    glow(ctx, 70, 34, 90, '#fff8d0', 0.6);
    clouds(ctx, t, 8, 241, 14, 80, 4, '#ffffff', '#c9dff0', 1.5);
    // The Alps, snow on top.
    mountains(ctx, 150, 104, 1.2, '#8a9ac0', 1.8, '#f4f8fc');
    mountains(ctx, 160, 72, 5.3, '#6f86a8', 1.3, '#eef4fa');
    // A fairy-tale castle on its crag.
    at(ctx, 292, 132, 0, 1, 1, () => {
      blob(ctx, [-46, 40, -30, 8, -8, -2, 22, 2, 40, 16, 54, 40], '#5a6a5a', 0.4);
      const w = '#f4f1ea', sh = '#d9d4ca', roof = '#4a5a80';
      rect(ctx, -22, -30, 40, 32, w);
      rect(ctx, 4, -30, 14, 32, sh);
      poly(ctx, [-24, -30, -2, -42, 20, -30], roof);
      for (const [tx, tw, th] of [[-26, 8, 46], [18, 7, 58], [-6, 6, 70], [30, 6, 38]]) {
        rect(ctx, tx, -th, tw, th + 2, w);
        rect(ctx, tx + tw * 0.6, -th, tw * 0.4, th + 2, sh);
        poly(ctx, [tx - 1.6, -th, tx + tw / 2, -th - tw * 2.4, tx + tw + 1.6, -th], roof);
        rect(ctx, tx + tw / 2 - 0.8, -th + 6, 1.6, 4, '#3a4660');
      }
      for (let i = 0; i < 5; i++) rect(ctx, -18 + i * 7, -20, 2.4, 5, '#3a4660');
      // A pennant on the tallest tower.
      const fy = -70 - 14.4;
      line(ctx, -3, fy, -3, fy - 8, '#3a4660', 0.6);
      poly(ctx, [-3, fy - 8, 4 + Math.sin(t * 5) * 1, fy - 6.4, -3, fy - 4.6], '#3f7fc8');
    });
    // Pine forest, in layers.
    for (const [by, c, seed] of [[166, '#3f6a4a', 3], [178, '#2f5a3e', 9]] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(X0, 232);
      for (let x = X0; x <= X1; x += 7) {
        const top = by - 9 - hash(x, seed) * 9 - Math.sin(x * 0.02 + seed) * 5;
        ctx.lineTo(x, by);
        ctx.lineTo(x + 3.5, top);
      }
      ctx.lineTo(X1, 232);
      ctx.fill();
    }
    // Paragliders riding the thermals.
    for (let i = 0; i < 2; i++) {
      const x = drift(i * 330 + 60, 6 - i * 2, t, 40), y = 62 + i * 26 + Math.sin(t * 0.5 + i * 2) * 6;
      ctx.beginPath();
      ctx.arc(x, y, 9, Math.PI * 1.1, Math.PI * 1.9);
      ctx.strokeStyle = i ? '#f2c94c' : '#e84393';
      ctx.lineWidth = 3;
      ctx.stroke();
      line(ctx, x - 7, y - 3, x, y + 8, 'rgba(40,40,60,0.5)', 0.4);
      line(ctx, x + 7, y - 3, x, y + 8, 'rgba(40,40,60,0.5)', 0.4);
      circle(ctx, x, y + 9, 1.3, '#2a2a3a');
    }
    birds(ctx, t, 5, 247, 30, 90, 12, 'rgba(50,60,80,0.6)');
  },
  shell(ctx) {
    // A beer garden under chestnut trees, with a maypole.
    fillAcross(ctx, 190, 230, '#6fa85a');
    across(0, 15, (x) => {
      rect(ctx, x, 176, 10, 60, '#b98a5a', 1);
      rect(ctx, x + 7.4, 176, 2.6, 60, '#96683e');
    });
    fillAcross(ctx, 184, 188, '#96683e');
    for (const mx of [-14, 414]) {
      for (let y = -20; y < 232; y += 10) {
        poly(ctx, [mx - 4, y, mx + 4, y - 7, mx + 4, y - 2, mx - 4, y + 5], '#3f7fc8');
        poly(ctx, [mx - 4, y + 5, mx + 4, y - 2, mx + 4, y + 3, mx - 4, y + 10], '#f4f1e8');
      }
      rect(ctx, mx + 2, -20, 2, 252, 'rgba(20,30,60,0.2)');
      for (const [yy, ww] of [[40, 30], [70, 24]]) {
        rect(ctx, mx - ww, yy, ww * 2, 3, '#6a4326', 1);
        for (const s of [-1, 1]) rect(ctx, mx + s * (ww - 5) - 4, yy - 9, 8, 9, s > 0 ? '#c8323a' : '#f2c94c', 1);
      }
    }
    // Leaves overhead.
    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath();
    ctx.moveTo(X0, -400);
    ctx.lineTo(X0, 14);
    for (let x = X0; x <= X1; x += 13) ctx.arc(x, 12 + hash(x, 5) * 9, 12, Math.PI, 0, true);
    ctx.lineTo(X1, -400);
    ctx.fill();
    for (let x = X0; x <= X1; x += 9) circle(ctx, x + 3, 6 + hash(x, 6) * 14, 5, hash(x, 7) < 0.5 ? '#5a9a4a' : '#2f6a34');
  },
  mid(ctx, t) {
    const lozenge = ['#3f7fc8', '#f4f1e8'];
    bunting(ctx, -14, 36, 200, 40, 16, t, lozenge, 16, 6.6);
    bunting(ctx, 200, 40, 414, 36, 16, t, lozenge, 16, 6.6);
    festoon(ctx, -14, 58, 414, 58, 14, t, ['#ffd27a', '#fff1c2'], 22, 1.7, 0.5);
    bunting(ctx, -190, 44, -14, 36, 8, t, lozenge, 10, 6.6);
    bunting(ctx, 414, 36, 590, 44, 8, t, lozenge, 10, 6.6);
  },
  front(ctx, t) {
    // Chestnut leaves letting go.
    for (let i = 0; i < 7; i++) {
      const p = (t * (0.04 + hash(i, 248) * 0.04) + hash(i, 249)) % 1;
      const x = X0 + hash(i, 250) * SPAN + Math.sin(p * 9 + i) * 16;
      at(ctx, x, lerp(10, 210, p), p * 9 + i, 1, 1, () => ellipse(ctx, 0, 0, 3, 1.6, alpha(i % 2 ? '#c9a23a' : '#6fa84a', arc(p) * 0.9)));
    }
  },
};

// ---------------------------------------------------------------- Red Square

function onionDome(ctx: Ctx, x: number, baseY: number, r: number, h: number, a: string, b: string, t: number) {
  // Drum, then the dome with its twist of colour, then the cross.
  rect(ctx, x - r * 0.62, baseY - h, r * 1.24, h, '#b8452c');
  rect(ctx, x + r * 0.1, baseY - h, r * 0.52, h, '#96321e');
  rect(ctx, x - r * 0.75, baseY - h - 2, r * 1.5, 3, '#f1ead9');
  const top = baseY - h;
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, top);
    ctx.bezierCurveTo(x - r * 1.5, top - r * 0.9, x - r * 0.5, top - r * 1.7, x, top - r * 2.6);
    ctx.bezierCurveTo(x + r * 0.5, top - r * 1.7, x + r * 1.5, top - r * 0.9, x + r * 0.6, top);
    ctx.closePath();
  };
  dome();
  ctx.fillStyle = a;
  ctx.fill();
  ctx.save();
  dome();
  ctx.clip();
  for (let i = -4; i < 6; i++) poly(ctx, [x + i * r * 0.5, top, x + i * r * 0.5 + r * 0.24, top, x + i * r * 0.5 + r * 0.9, top - r * 2.8, x + i * r * 0.5 + r * 0.66, top - r * 2.8], b);
  ctx.fillStyle = 'rgba(20,10,40,0.2)';
  ctx.fillRect(x + r * 0.3, top - r * 3, r * 2, r * 3);
  ctx.restore();
  line(ctx, x, top - r * 2.6, x, top - r * 3.4, '#f2c94c', 0.9);
  line(ctx, x - r * 0.24, top - r * 3.1, x + r * 0.24, top - r * 3.1, '#f2c94c', 0.9);
  glow(ctx, x, top - r * 3.1, r * 0.9, '#ffe6a0', 0.3 + 0.1 * Math.sin(t * 2 + x));
}

const redsquare: Backdrop = {
  fog: '#3a4a78', haze: 0.16, dim: 0.09, shine: 1, vignette: 0.55,
  bar: { kind: 'wood', top: '#8a4a34', front: '#4a1c18', trim: '#e0b85a' },
  far(ctx, t) {
    sky(ctx, ['#0c1238', '#22306e', '#5a4a8a', '#c0708a'], 180);
    stars(ctx, t, 70, 251, { yMax: 110 });
    // The Kremlin wall, and the clock tower with its star.
    fillAcross(ctx, 138, 232, '#8a2a24');
    across(0, 9, (x) => poly(ctx, [x, 138, x, 132, x + 2, 134, x + 4.4, 132, x + 4.4, 138], '#8a2a24'));
    fillAcross(ctx, 146, 148, '#6a1c18');
    at(ctx, 84, 138, 0, 1, 1, () => {
      const c = '#9a3028';
      rect(ctx, -15, -44, 30, 44, c);
      rect(ctx, 3, -44, 12, 44, '#7a221c');
      rect(ctx, -17, -47, 34, 4, '#f1ead9');
      rect(ctx, -11, -66, 22, 20, c);
      circle(ctx, 0, -56, 6.6, '#1c1a22');
      circle(ctx, 0, -56, 5.6, '#f4ecd0');
      const d = new Date();
      const m = d.getMinutes(), h = (d.getHours() % 12) + m / 60;
      line(ctx, 0, -56, Math.sin((h / 12) * TAU) * 3, -56 - Math.cos((h / 12) * TAU) * 3, '#1c1a22', 0.9);
      line(ctx, 0, -56, Math.sin((m / 60) * TAU) * 4.6, -56 - Math.cos((m / 60) * TAU) * 4.6, '#1c1a22', 0.6);
      poly(ctx, [-9, -66, 0, -98, 9, -66], '#2f6a4a');
      poly(ctx, [0, -98, 9, -66, 3, -66], '#24523a');
      // The star.
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 1.8 : 4.4;
        ctx.lineTo(Math.cos(an) * rr, -102 + Math.sin(an) * rr);
      }
      ctx.fillStyle = '#ff3a44';
      ctx.fill();
      glow(ctx, 0, -102, 14, '#ff3a44', 0.7 + 0.2 * Math.sin(t * 2));
    });
    // St Basil's: every dome a different sweet.
    const bx = 290, by = 150;
    glow(ctx, bx, by - 40, 110, '#ffcf8a', 0.25);
    rect(ctx, bx - 44, by - 22, 88, 26, '#a83a2a');
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(bx - 38 + i * 11, by - 6, 3.4, Math.PI, 0);
      ctx.fillStyle = '#f1ead9';
      ctx.fill();
    }
    onionDome(ctx, bx - 34, by - 20, 8, 16, '#2f8a4a', '#f2c94c', t);
    onionDome(ctx, bx + 34, by - 20, 8, 18, '#3b6fd8', '#f4f1e8', t);
    onionDome(ctx, bx - 16, by - 20, 7, 30, '#c8323a', '#f4f1e8', t);
    onionDome(ctx, bx + 17, by - 20, 7, 28, '#e8843a', '#2f8a4a', t);
    // The tall tent roof in the middle.
    rect(ctx, bx - 7, by - 66, 14, 46, '#b8452c');
    poly(ctx, [bx - 9, by - 66, bx, by - 104, bx + 9, by - 66], '#a83a2a');
    for (let i = 0; i < 4; i++) line(ctx, bx - 7 + i * 4.6, by - 66, bx, by - 104, alpha('#f1ead9', 0.5), 0.5);
    onionDome(ctx, bx, by - 102, 4.4, 4, '#f2c94c', '#e0a82a', t);
    // Snow on the ground, and a line of lights.
    fillAcross(ctx, 172, 232, vgrad(ctx, 172, 232, ['#dfe8f6', '#a8b8dc']));
    for (let i = 0; i < 12; i++) ellipse(ctx, X0 + i * 70 + hash(i, 252) * 30, 176 + hash(i, 253) * 16, 30, 3, 'rgba(255,255,255,0.5)');
    festoon(ctx, X0, 150, X1, 150, 6, t, ['#ffd27a'], 50, 1.1, 0.5);
  },
  shell(ctx) {
    // A winter market stall: striped awning and frosted posts.
    for (const x of [-36, 436]) {
      rect(ctx, x - 4, 0, 8, 232, '#5a2a22');
      rect(ctx, x - 4, 0, 2.6, 232, '#7a3a2e');
    }
    across(0, 24, (x, i) => {
      const c = i % 2 ? '#c8323a' : '#f4f1e8';
      rect(ctx, x, -400, 24, 412, c);
      ctx.beginPath();
      ctx.arc(x + 12, 12, 12, 0, Math.PI);
      ctx.fillStyle = c;
      ctx.fill();
    });
    // Snow sitting on the awning's edge.
    ctx.fillStyle = '#f4f8fc';
    ctx.beginPath();
    ctx.moveTo(X0, -400);
    ctx.lineTo(X0, 4);
    for (let x = X0; x <= X1; x += 12) ctx.arc(x + 6, 3, 6, Math.PI, 0, true);
    ctx.lineTo(X1, -400);
    ctx.fill();
  },
  mid(ctx, t) {
    festoon(ctx, -36, 34, 200, 38, 12, t, ['#ffd27a', '#ff6a6a', '#fff1c2'], 14, 1.9);
    festoon(ctx, 200, 38, 436, 34, 12, t, ['#ffd27a', '#ff6a6a', '#fff1c2'], 14, 1.9);
  },
  front(ctx, t) {
    // Snow.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 110; i++) {
      const sp = 14 + hash(i, 254) * 22;
      const y = ((t * sp + hash(i, 255) * 260) % 260) - 30;
      const x = X0 + hash(i, 256) * SPAN + Math.sin(t * 0.8 + i) * 8;
      ctx.globalAlpha = 0.35 + hash(i, 257) * 0.55;
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + hash(i, 258) * 1.3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------- The Forbidden City

/** A palace hall: red columns, and a double roof of golden tiles turned up at the corners. */
function hall(ctx: Ctx, x: number, baseY: number, w: number, s: number) {
  at(ctx, x, baseY, 0, s, s, () => {
    const gold = '#e0a83a', goldSh = '#b87a22', red = '#b8322c';
    // Marble terrace.
    rect(ctx, -w * 0.62, -8, w * 1.24, 8, '#eee6d6');
    for (let i = 0; i < 14; i++) rect(ctx, -w * 0.6 + (i * w * 1.2) / 13.4, -12, 1.4, 5, '#d9cfbc');
    rect(ctx, -w * 0.62, -12.6, w * 1.24, 1.4, '#d9cfbc');
    // Walls and columns.
    rect(ctx, -w * 0.5, -34, w, 26, red);
    for (let i = 0; i < 9; i++) rect(ctx, -w * 0.5 + (i * w) / 8 - 1.4, -34, 2.8, 26, '#8a1f1c');
    rect(ctx, -w * 0.5, -37, w, 4, '#2f6a8a');
    for (let i = 0; i < 16; i++) rect(ctx, -w * 0.5 + (i * w) / 15.4, -36.4, 2, 2.6, i % 2 ? '#f2c94c' : '#3fae6a');
    // Lower roof.
    const roof = (y: number, half: number, h: number) => {
      ctx.beginPath();
      ctx.moveTo(-half - 8, y - 1.6);
      ctx.quadraticCurveTo(-half, y, -half + 6, y - h * 0.5);
      ctx.quadraticCurveTo(-half * 0.5, y - h, -half * 0.36, y - h);
      ctx.lineTo(half * 0.36, y - h);
      ctx.quadraticCurveTo(half * 0.5, y - h, half - 6, y - h * 0.5);
      ctx.quadraticCurveTo(half, y, half + 8, y - 1.6);
      ctx.lineTo(half + 6, y + 2.4);
      ctx.lineTo(-half - 6, y + 2.4);
      ctx.closePath();
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let i = -20; i < 20; i++) line(ctx, i * 4, y - h - 2, i * 5.4, y + 3, alpha(goldSh, 0.55), 0.6);
      ctx.restore();
      rect(ctx, -half - 6, y + 1, half * 2 + 12, 1.8, goldSh);
    };
    roof(-37, w * 0.6, 12);
    rect(ctx, -w * 0.36, -56, w * 0.72, 9, red);
    roof(-56, w * 0.46, 15);
    rect(ctx, -w * 0.18, -72.6, w * 0.36, 1.8, goldSh);
  });
}

const forbidden: Backdrop = {
  fog: '#e2c49a', haze: 0.13, dim: 0.01, shine: 1.1, vignette: 0.34,
  bar: { kind: 'wood', top: '#a83a2a', front: '#6a1c18', trim: '#f2c94c' },
  far(ctx, t) {
    sky(ctx, [0, '#6aa6d8', 0.5, '#bfdcec', 0.85, '#f4e2bc', 1, '#f7d9a0'], 170);
    glow(ctx, 318, 52, 100, '#fff3c0', 0.6);
    clouds(ctx, t, 6, 261, 16, 80, 3, 'rgba(255,255,255,0.9)', 'rgba(220,210,190,0.6)', 1.4);
    // Jingshan hill and its pavilion, hazy in the distance.
    hills(ctx, 132, 20, 2.6, '#a8b89a', 0.5);
    at(ctx, 96, 112, 0, 0.6, 0.6, () => {
      rect(ctx, -9, -12, 18, 12, '#b86a5a');
      poly(ctx, [-16, -12, 0, -24, 16, -12], '#c9a05a');
      poly(ctx, [-10, -22, 0, -32, 10, -22], '#c9a05a');
    });
    // The outer court: a long red wall, then the great hall.
    fillAcross(ctx, 146, 232, '#a83a2c');
    fillAcross(ctx, 141, 147, '#e0a83a');
    fillAcross(ctx, 146, 148, '#b87a22');
    hall(ctx, 62, 166, 60, 0.7);
    hall(ctx, 352, 166, 60, 0.7);
    hall(ctx, 206, 172, 104, 1.1);
    // The flagstones of the court.
    fillAcross(ctx, 172, 232, vgrad(ctx, 172, 232, ['#d9cdb6', '#b8a88a']));
    for (let i = 0; i < 9; i++) line(ctx, X0, 176 + i * i * 0.9, X1, 176 + i * i * 0.9, 'rgba(120,100,80,0.2)', 0.6);
    for (let i = -8; i < 18; i++) line(ctx, 200 + i * 26, 172, 200 + i * 70, 232, 'rgba(120,100,80,0.16)', 0.6);
    // Pigeons? No: kites.
    for (let i = 0; i < 3; i++) {
      const x = 60 + i * 150 + Math.sin(t * 0.4 + i * 2) * 18, y = 46 + i * 12 + Math.cos(t * 0.5 + i) * 7;
      const c = ['#c8323a', '#f2c94c', '#3b7dd8'][i];
      poly(ctx, [x, y - 7, x + 5, y, x, y + 9, x - 5, y], c);
      curve(ctx, [x, y + 9, x + 4, y + 18 + Math.sin(t * 3 + i) * 2, x - 3, y + 28, x + 2, y + 40], alpha(c, 0.8), 0.7);
      line(ctx, x, y, 200 + (i - 1) * 60, 180, 'rgba(60,40,40,0.25)', 0.3);
    }
  },
  shell(ctx) {
    // A gate pavilion: lacquered columns and a painted beam.
    for (const x of [-26, 426]) {
      rect(ctx, x - 9, 0, 18, 232, '#b8322c');
      rect(ctx, x - 9, 0, 5, 232, '#d04a3a');
      rect(ctx, x + 4, 0, 5, 232, '#8a1f1c');
      rect(ctx, x - 12, 26, 24, 5, '#e0a83a', 1);
    }
    fillAcross(ctx, -400, 8, '#8a1f1c');
    fillAcross(ctx, 8, 26, '#2f6a8a');
    across(0, 30, (x, i) => {
      rect(ctx, x + 2, 11, 26, 12, i % 2 ? '#3fae6a' : '#3b6fd8', 2);
      circle(ctx, x + 15, 17, 3.4, '#f2c94c');
      circle(ctx, x + 15, 17, 1.5, '#c8323a');
    });
    fillAcross(ctx, 8, 10, '#f2c94c');
    fillAcross(ctx, 24, 26, '#f2c94c');
    // A fretwork screen along the bottom.
    fillAcross(ctx, 190, 232, '#8a1f1c');
    across(0, 18, (x) => {
      ctx.strokeStyle = '#e0a83a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, 194, 14, 14);
      ctx.strokeRect(x + 6, 198, 6, 6);
    });
  },
  mid(ctx, t) {
    across(48, 76, (x, i) => lantern(ctx, x, 40 + (i % 2) * 12, t, i * 1.7, '#e0342c', 1 + (i % 2) * 0.16));
  },
  front(ctx, t) {
    // Blossom on the breeze.
    for (let i = 0; i < 12; i++) {
      const p = (t * (0.04 + hash(i, 262) * 0.04) + hash(i, 263)) % 1;
      const x = drift(hash(i, 264) * SPAN + p * 90, 0, t, 0);
      at(ctx, x, lerp(0, 210, p) + Math.sin(p * 12 + i) * 6, p * 8, 1, 1, () => ellipse(ctx, 0, 0, 2.2, 1.3, alpha('#ffd0dc', arc(p) * 0.85)));
    }
  },
};

// ---------------------------------------------------------------- Tokyo Izakaya

const izakaya: Backdrop = {
  fog: '#3a2a3a', haze: 0.16, dim: 0.1, shine: 1, vignette: 0.58,
  bar: { kind: 'planks', top: '#d9b27c', front: '#8a5a34', trim: '#2a1a14', glow: '#ff9a5a' },
  far(ctx, t) {
    // The alley outside: wet tarmac and a stack of neon signs.
    sky(ctx, ['#0c0a22', '#241a44', '#4a2a5a'], 200);
    skyline(ctx, 176, 271, '#1a1430', 60, 130, { minW: 26, maxW: 46, lit: '#ffd98a', t, density: 0.3 });
    across(10, 54, (x, i) => {
      const c = ['#ff4f8a', '#4fd8ff', '#ffd23c', '#7affc1', '#ff8a3c'][i % 5];
      const h = 50 + hash(i, 272) * 46, top = 40 + hash(i, 273) * 26;
      const on = hash(Math.floor(t * 9), i) < 0.03 ? 0.35 : 1;
      rect(ctx, x, top, 13, h, alpha('#120a1e', 0.9), 2);
      ctx.strokeStyle = alpha(tint(c, 0.5), on);
      ctx.lineWidth = 1.1;
      ctx.strokeRect(x + 1.4, top + 1.4, 10.2, h - 2.8);
      // Beer and sake, taking turns down the sign, with a clear gap so they read as two words.
      const words = ['ビール', '酒'];
      const size = 7.4, step = size * 1.14, gap = step * 1.5;
      const run: string[] = [];
      let used = 0;
      for (let k = 0; k < 12; k++) {
        const word = words[(i + k) % 2];
        const need = word.length * step + (run.length ? gap : 0);
        if (used + need > h - 9) break;
        run.push(word);
        used += need;
      }
      let y = top + h / 2 - used / 2 + step / 2;
      for (const word of run) {
        vtext(ctx, word, x + 6.5, y, size, alpha(tint(c, 0.35), on));
        y += word.length * step + gap;
      }
      glow(ctx, x + 6.5, top + h / 2, 34, c, 0.3 * on);
    });
    fillAcross(ctx, 178, 232, vgrad(ctx, 178, 232, ['#2a2038', '#140e1e']));
    for (let i = 0; i < 16; i++) glow(ctx, X0 + i * 52 + 10, 196, 30, ['#ff4f8a', '#4fd8ff', '#ffd23c'][i % 3], 0.18, 0.3);
    // Rain.
    ctx.strokeStyle = 'rgba(200,210,255,0.22)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = X0 + hash(i, 274) * SPAN, y = ((t * (170 + hash(i, 275) * 80) + hash(i, 276) * 250) % 250) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1.4, y + 9);
    }
    ctx.stroke();
    // People with umbrellas.
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1;
      const px = drift(i * 140, dir * (8 + hash(i, 277) * 6), t, 20), py = 186;
      rect(ctx, px - 2.6, py - 15, 5.2, 13, '#120c1c', 2.4);
      ctx.beginPath();
      ctx.arc(px, py - 17, 8, Math.PI, TAU);
      ctx.fillStyle = alpha(['#f4f1e8', '#c8323a', '#2f7fb0'][i % 3], 0.85);
      ctx.fill();
    }
  },
  shell(ctx) {
    // Timber and plaster, open at the front under the eaves.
    fillAcross(ctx, -400, 22, '#3a2418');
    fillAcross(ctx, 22, 26, '#5a3a24');
    for (const x of [-22, 126, 274, 422]) {
      rect(ctx, x - 5, 0, 10, 232, '#4a2e1c');
      rect(ctx, x - 5, 0, 3, 232, '#63402a');
    }
    // Low wall of slats, with the menu pinned along it.
    fillAcross(ctx, 150, 232, '#5a3a24');
    across(0, 7, (x) => rect(ctx, x, 152, 3.4, 80, '#3f2616'));
    fillAcross(ctx, 148, 152, '#7a5234');
    across(-14, 148, (x) => {
      for (let i = 0; i < 6; i++) {
        const mx = x + 14 + i * 19;
        rect(ctx, mx, 114, 12, 32, '#f4ecd6', 1);
        for (let k = 0; k < 4; k++) {
          line(ctx, mx + 3, 119 + k * 6.6, mx + 9, 119 + k * 6.6, '#2a1a14', 0.9);
          line(ctx, mx + 6, 117.6 + k * 6.6, mx + 6, 122.6 + k * 6.6, '#2a1a14', 0.9);
        }
        if (i % 3 === 0) rect(ctx, mx + 1.6, 139, 8.8, 4, '#c8323a', 0.6);
      }
    });
    // A shelf of sake.
    rect(ctx, 300, 98, 96, 3, '#7a5234', 1);
    bottles(ctx, 302, 98, 92, 279, 0.1);
    rect(ctx, -160, 98, 110, 3, '#7a5234', 1);
    bottles(ctx, -158, 98, 106, 280, 0.1);
  },
  mid(ctx, t) {
    // Noren: the split curtain over the doorway, lifting in the draught.
    across(-22, 148, (x) => {
      for (let i = 0; i < 5; i++) {
        const sx = x + 8 + i * 27, sway = Math.sin(t * 1.3 + i * 0.9 + x * 0.02) * 2.4;
        poly(ctx, [sx, 26, sx + 25, 26, sx + 25 + sway, 60, sx + sway, 60], '#27345e');
        poly(ctx, [sx + 18, 26, sx + 25, 26, sx + 25 + sway, 60, sx + 18 + sway, 60], 'rgba(10,10,30,0.25)');
        if (i === 2) {
          circle(ctx, sx + 12.5 + sway * 0.5, 42, 6.4, '#f4f1e8');
          circle(ctx, sx + 12.5 + sway * 0.5, 42, 4, '#27345e');
        }
      }
    });
    // Paper lanterns.
    lantern(ctx, 52, 86, t, 0.4, '#e8402c', 1.2, false);
    lantern(ctx, 348, 80, t, 2.2, '#e8402c', 1.2, false);
    lantern(ctx, -96, 84, t, 1.2, '#f4e6c0', 1.1, false);
    lantern(ctx, 496, 84, t, 3.1, '#f4e6c0', 1.1, false);
    across(200, 148, (x, i) => pendant(ctx, x, 70, t, i, '#2a1a14', '#ffc070', { kind: 'bulb', cone: 0.5 }));
  },
  front(ctx, t) {
    // Steam from the grill.
    for (let i = 0; i < 9; i++) {
      const p = (t * 0.16 + i / 9) % 1;
      circle(ctx, 372 + Math.sin(p * 5 + i) * 10, 210 - p * 90, 6 + p * 16, alpha('#fff4e6', 0.1 * (1 - p)));
    }
    motes(ctx, t, 10, 281, '#ffd9b0', { y0: 20, y1: 200, a: 0.35 });
  },
};

// ---------------------------------------------------------------- Seoul Pocha

const pocha: Backdrop = {
  fog: '#5a3a2a', haze: 0.15, dim: 0.08, shine: 1.05, vignette: 0.55,
  bar: { kind: 'metal', top: '#d9dde6', front: '#8a93a6', trim: '#f08a2a', glow: '#ff9a3a' },
  far(ctx, t) {
    // The street outside the tent: towers, the hill with its needle, signs for soju and beer.
    sky(ctx, ['#0a0c22', '#1c2048', '#4a2a5a'], 200);
    stars(ctx, t, 30, 341, { yMax: 60 });
    hills(ctx, 124, 26, 1.9, '#1c2440', 0.5);
    at(ctx, 96, 92, 0, 1, 1, () => {
      rect(ctx, -1.2, -40, 2.4, 44, '#aab2c8');
      ellipse(ctx, 0, -40, 6, 3.4, '#c9d0e2');
      rect(ctx, -0.6, -58, 1.2, 18, '#aab2c8');
      glow(ctx, 0, -40, 12, '#7fd6ff', 0.6);
      glow(ctx, 0, -58, 5, '#ff4a4a', Math.sin(t * 2.6) > 0 ? 1 : 0.2);
    });
    skyline(ctx, 176, 342, '#1a1c38', 40, 110, { minW: 24, maxW: 44, lit: '#ffd98a', t, density: 0.4 });
    across(18, 62, (x, i) => {
      const c = ['#ff4f6a', '#4fd8ff', '#7affc1', '#ffd23c'][i % 4];
      const on = hash(Math.floor(t * 8), i) < 0.03 ? 0.4 : 1;
      const word = i % 2 ? '맥주' : '소주';
      rect(ctx, x, 62 + (i % 3) * 14, 16, 34, alpha('#120a1e', 0.9), 2);
      ctx.strokeStyle = alpha(tint(c, 0.5), on);
      ctx.lineWidth = 1.1;
      ctx.strokeRect(x + 1.4, 63.4 + (i % 3) * 14, 13.2, 31.2);
      vtext(ctx, word, x + 8, 72 + (i % 3) * 14, 11, alpha(tint(c, 0.35), on));
      glow(ctx, x + 8, 79 + (i % 3) * 14, 30, c, 0.3 * on);
    });
    fillAcross(ctx, 178, 232, vgrad(ctx, 178, 232, ['#2a2238', '#141020']));
    for (let i = 0; i < 14; i++) glow(ctx, X0 + i * 58 + 20, 198, 30, ['#ff4f6a', '#4fd8ff', '#ffd23c'][i % 3], 0.16, 0.3);
    // Scooters, delivering.
    for (let i = 0; i < 2; i++) {
      const dir = i ? -1 : 1, x = drift(i * 300, dir * 70, t, 300);
      at(ctx, x, 196 + i * 6, 0, dir, 1, () => {
        circle(ctx, -8, 0, 3.4, '#0c0c12');
        circle(ctx, 8, 0, 3.4, '#0c0c12');
        blob(ctx, [-10, -3, -4, -9, 4, -8, 9, -3, 4, -1, -6, -1], '#c8323a', 0.4);
        rect(ctx, -12, -15, 9, 8, '#f4f1e8', 1);
        rect(ctx, 0, -17, 4, 9, '#1c1c28', 2);
        circle(ctx, 2, -19.6, 3, '#f2c21c');
        glow(ctx, 12, -5, 12, '#fff0c0', 0.8);
      });
    }
  },
  shell(ctx) {
    // The tent: orange tarp, clear plastic windows, a steel frame.
    const tarp = '#f08a2a';
    fillAcross(ctx, -400, 232, tarp);
    across(0, 40, (x) => rect(ctx, x, -400, 1, 640, 'rgba(120,50,10,0.18)'));
    across(20, 152, (x) => {
      const w = 118, y = 44, h = 104;
      punch(ctx, () => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
      });
      ctx.fillStyle = 'rgba(255,236,200,0.1)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = '#c96a18';
      ctx.lineWidth = 2;
      ctx.stroke();
      poly(ctx, [x + 14, y + h, x + 50, y + 4, x + 66, y + 4, x + 30, y + h], 'rgba(255,255,255,0.06)');
      rect(ctx, x + w + 14, 0, 6, 232, '#aab2c0');
      rect(ctx, x + w + 14, 0, 2, 232, '#dfe5ee');
    });
    fillAcross(ctx, -400, 14, '#d6741c');
    across(0, 30, (x) => {
      ctx.beginPath();
      ctx.arc(x + 15, 14, 15, 0, Math.PI);
      ctx.fillStyle = '#d6741c';
      ctx.fill();
    });
    // The menu, hung along the top.
    across(34, 152, (x, i) => {
      rect(ctx, x, 22, 90, 16, '#f4ecd6', 2);
      htext(ctx, i % 2 ? '맥주  3000' : '소주  4000', x + 45, 30.6, 9.5, '#b8322c');
    });
    fillAcross(ctx, 160, 232, 'rgba(120,50,10,0.25)');
  },
  mid(ctx, t) {
    across(78, 152, (x, i) => pendant(ctx, x, 36, t, i * 1.6, '#2a2a2a', '#ffd9a0', { kind: 'bulb', cone: 0.7, power: 1.2 }));
    // Green bottles lined up along the back.
    across(0, 152, (x) => {
      for (let k = 0; k < 6; k++) {
        const bx = x + 150 + k * 5 - 15;
        rect(ctx, bx, 150, 3.4, 10, '#3f9a4a', 1);
        rect(ctx, bx + 1, 145.6, 1.4, 5, '#3f9a4a');
        rect(ctx, bx, 153, 3.4, 3, '#f4f1e8');
      }
    });
  },
  front(ctx, t) {
    // Steam off the tteokbokki and the fish-cake broth.
    for (let i = 0; i < 12; i++) {
      const p = (t * 0.18 + i / 12) % 1;
      circle(ctx, 60 + (i % 2) * 300 + Math.sin(p * 5 + i) * 12, 212 - p * 100, 7 + p * 18, alpha('#fff4e6', 0.1 * (1 - p)));
    }
    motes(ctx, t, 8, 349, '#ffd9b0', { y0: 20, y1: 200, a: 0.3 });
  },
};

// ---------------------------------------------------------------- The Jolly Roger

const pirateship: Backdrop = {
  fog: '#7fb0c8', haze: 0.13, dim: 0.02, shine: 1.1, vignette: 0.38,
  bar: { kind: 'planks', top: '#9a6a44', front: '#5a3a26', trim: '#d9b25a' },
  far(ctx, t) {
    // Everything out there rolls with the ship.
    ctx.save();
    ctx.translate(200, 150);
    ctx.rotate(Math.sin(t * 0.55) * 0.025);
    ctx.translate(-200, -150 + Math.sin(t * 0.8) * 2.4);
    sky(ctx, [0, '#2f7fd0', 0.55, '#8fd0f2', 1, '#f7e2b0'], 150);
    glow(ctx, 316, 60, 110, '#fff3c0', 0.6);
    circle(ctx, 316, 60, 16, '#fff6cf');
    clouds(ctx, t, 8, 351, 20, 100, 5, '#ffffff', '#c9dff0', 1.4);
    birds(ctx, t, 6, 352, 30, 100, 16, 'rgba(240,244,248,0.9)', 1.2);
    // The sea, in three rows of swell.
    fillAcross(ctx, 140, 260, vgrad(ctx, 140, 220, ['#3fa8c8', '#1f5f9a']));
    // An island with a hill like a skull, and one palm tree.
    at(ctx, 74, 142, 0, 1, 1, () => {
      ellipse(ctx, 0, 2, 44, 6, '#e6d09a');
      blob(ctx, [-22, 0, -20, -16, -8, -26, 8, -24, 16, -12, 16, 0], '#8a8f98', 0.5);
      circle(ctx, -9, -13, 3.6, '#3a3e4a');
      circle(ctx, 3, -13, 3.6, '#3a3e4a');
      poly(ctx, [-3, -7, -1, -4, -5, -4], '#3a3e4a');
      curve(ctx, [26, 0, 28, -14, 24, -26], '#6a4a2a', 2);
      for (let i = 0; i < 5; i++) {
        const an = -2.6 + i * 0.55 + Math.sin(t * 1.2 + i) * 0.04;
        curve(ctx, [24, -26, 24 + Math.cos(an) * 8, -26 + Math.sin(an) * 8 - 3, 24 + Math.cos(an) * 15, -26 + Math.sin(an) * 15 + 2], '#3f8f4a', 2.2);
      }
    });
    // Another ship, hull down on the horizon.
    at(ctx, drift(300, -3, t, 60), 142, 0, 0.6, 0.6, () => {
      blob(ctx, [-16, -2, -12, 4, 12, 4, 18, -3, 0, 0], '#3a2a22', 0.4);
      for (const mx of [-6, 5]) {
        line(ctx, mx, 0, mx, -24, '#3a2a22', 1);
        poly(ctx, [mx - 6, -22, mx + 6, -22, mx + 7, -12, mx - 7, -12], '#f1ead9');
        poly(ctx, [mx - 5, -11, mx + 5, -11, mx + 6, -3, mx - 6, -3], '#e2d8c2');
      }
    });
    for (let row = 0; row < 4; row++) {
      const y = 150 + row * 18, sp = 14 + row * 9;
      ctx.beginPath();
      ctx.moveTo(X0 - 40, 280);
      for (let x = X0 - 40; x <= X1 + 40; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.045 + t * (1 + row * 0.3) + row * 2) * (2.4 + row * 1.2));
      ctx.lineTo(X1 + 40, 280);
      ctx.closePath();
      ctx.fillStyle = ['#3a9ac0', '#2f86b4', '#2472a6', '#1c6096'][row];
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const x = drift(hash(i, 353 + row) * SPAN, sp, t, 20);
        rect(ctx, x, y + 2 + Math.sin(x * 0.045 + t * (1 + row * 0.3) + row * 2) * (2.4 + row * 1.2), 9 + row * 3, 1, 'rgba(255,255,255,0.5)', 0.5);
      }
    }
    ctx.restore();
  },
  shell(ctx) {
    // On deck: the mast and its rigging, the rail, and a furled sail overhead.
    const wood = '#5a3a26';
    // Ratlines.
    ctx.strokeStyle = 'rgba(40,28,20,0.8)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const [x0, x1] of [[-10, 96], [410, 304]]) {
      for (let k = 0; k <= 4; k++) {
        ctx.moveTo(lerp(x0, x1, k / 4), 190);
        ctx.lineTo(x0 + (x1 > x0 ? 52 : -52), -40);
      }
      for (let y = 20; y < 190; y += 13) {
        const u = (190 - y) / 230, a = lerp(x0, x0 + (x1 > x0 ? 52 : -52), u), b = lerp(x1, x0 + (x1 > x0 ? 52 : -52), u);
        ctx.moveTo(a, y);
        ctx.lineTo(b, y + 1.6);
      }
    }
    ctx.stroke();
    for (const x of [42, 358]) {
      rect(ctx, x - 9, -40, 18, 280, wood);
      rect(ctx, x - 9, -40, 6, 280, '#74503a');
      rect(ctx, x + 4, -40, 5, 280, '#3f2618');
      for (const y of [60, 140]) rect(ctx, x - 11, y, 22, 5, '#2a2a30', 1);
    }
    // The yard, with the sail lashed up to it.
    fillAcross(ctx, 4, 12, wood);
    blob(ctx, [X0, 12, X0 + 80, 26, 200, 30, X1 - 80, 26, X1, 12, X1, 16, 200, 20, X0, 16], '#e9e0c8', 0.2);
    across(0, 46, (x) => {
      ellipse(ctx, x, 20, 21, 8, '#e9e0c8');
      ellipse(ctx, x + 4, 22, 14, 4, 'rgba(120,100,70,0.18)');
      rect(ctx, x + 21.6, 10, 2.4, 16, '#3a2a1c', 1);
    });
    // The rail.
    fillAcross(ctx, 182, 188, '#74503a');
    fillAcross(ctx, 188, 232, wood);
    across(0, 20, (x) => rect(ctx, x, 188, 2, 44, '#3f2618'));
  },
  mid(ctx, t) {
    // The colours, snapping in the wind.
    const fx = 364, fy = 44;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) ctx.lineTo(fx + k * 5.4, fy + Math.sin(t * 6 + k * 0.7) * 2.4 * (k / 10));
    for (let k = 10; k >= 0; k--) ctx.lineTo(fx + k * 5.4, fy + 34 + Math.sin(t * 6 + k * 0.7 + 0.6) * 2.4 * (k / 10));
    ctx.closePath();
    ctx.fillStyle = '#17141c';
    ctx.fill();
    const wob = Math.sin(t * 6 + 3.5) * 1.4;
    circle(ctx, fx + 27, fy + 14 + wob, 7, '#f1ead9');
    rect(ctx, fx + 23, fy + 19 + wob, 8, 4.6, '#f1ead9', 1);
    circle(ctx, fx + 24.4, fy + 13.4 + wob, 1.9, '#17141c');
    circle(ctx, fx + 29.6, fy + 13.4 + wob, 1.9, '#17141c');
    line(ctx, fx + 17, fy + 23 + wob, fx + 37, fy + 30 + wob, '#f1ead9', 1.8);
    line(ctx, fx + 37, fy + 23 + wob, fx + 17, fy + 30 + wob, '#f1ead9', 1.8);
    // A ship's lantern, swinging with the roll.
    for (const [x, ph] of [[150, 0], [262, 1.4]]) {
      const a = Math.sin(t * 0.55 + ph) * 0.2;
      at(ctx, x, 20, a, 1, 1, () => {
        line(ctx, 0, 0, 0, 30, '#1c1410', 0.8);
        glow(ctx, 0, 40, 46, '#ffc56e', 0.45);
        rect(ctx, -5, 32, 10, 15, '#ffd98a', 2);
        rect(ctx, -6.4, 30, 12.8, 3, '#2a2a30', 1);
        rect(ctx, -6.4, 46, 12.8, 3, '#2a2a30', 1);
        line(ctx, -5, 33, -5, 46, '#2a2a30', 0.9);
        line(ctx, 5, 33, 5, 46, '#2a2a30', 0.9);
      });
    }
  },
  front(ctx, t) {
    // Spray coming over the rail.
    for (let i = 0; i < 12; i++) {
      const p = (t * (0.3 + hash(i, 361) * 0.3) + hash(i, 362)) % 1;
      circle(ctx, X0 + hash(i, 363) * SPAN + p * 16, 196 - Math.sin(p * Math.PI) * 26, 1.2, alpha('#ffffff', (1 - p) * 0.55));
    }
  },
};

// ---------------------------------------------------------------- The Outback

function kangaroo(ctx: Ctx, x: number, y: number, s: number, dir: number, hop: number, c: string) {
  // Mid-hop the body stretches out; on landing it tucks in.
  const up = Math.sin(hop * Math.PI);
  at(ctx, x, y - up * 12 * s, (0.5 - hop) * 0.3 * dir, s * dir, s, () => {
    blob(ctx, [-8, -6, -2, -15, 6, -19, 10, -14, 6, -4, 0, 0, -6, 0], c, 0.5);
    curve(ctx, [-6, -3, -15, 0 + up * 3, -24, -6 + up * 6], c, 3.4);
    blob(ctx, [6, -18, 9, -25, 13, -27, 15, -23, 12, -18], c, 0.5);
    poly(ctx, [9, -26, 9.6, -32, 11.6, -26], c);
    poly(ctx, [11.6, -27, 13.4, -32.6, 14.4, -26], c);
    line(ctx, 5, -11, 10, -7 + up * 2, c, 1.4);
    curve(ctx, [-2, -2, 3 - up * 5, 4 - up * 2, 9 - up * 8, 5 + up * 2], c, 2.6);
  });
}

const outback: Backdrop = {
  fog: '#d98a5a', haze: 0.15, dim: 0.03, shine: 1.05, vignette: 0.44,
  bar: { kind: 'planks', top: '#b8865a', front: '#7a4a30', trim: '#d9cdb6' },
  far(ctx, t) {
    sky(ctx, [0, '#3a3a7a', 0.35, '#b85a7a', 0.65, '#f2884a', 1, '#ffd070'], 130);
    glow(ctx, 318, 112, 170, '#ffc060', 0.8);
    circle(ctx, 318, 114, 28, '#fff0b8');
    clouds(ctx, t, 5, 291, 30, 90, 2.4, 'rgba(255,170,120,0.8)', 'rgba(180,90,110,0.6)', 1.4);
    birds(ctx, t, 6, 292, 40, 100, 16, 'rgba(60,24,30,0.7)', 1.1);
    // Everything on the ground sits high in the frame: the pub is in a dip, looking up at the plain.
    ctx.save();
    ctx.translate(0, -42);
    // The rock, glowing at sundown.
    ctx.save();
    ctx.translate(-206, 0);
    blob(ctx, [220, 168, 232, 140, 262, 128, 310, 126, 356, 132, 380, 148, 388, 168], vgrad(ctx, 124, 168, ['#d8643a', '#8a2e2a']), 0.45);
    for (let i = 0; i < 9; i++) line(ctx, 244 + i * 15, 132 + (i % 3) * 3, 240 + i * 15, 166, 'rgba(90,24,24,0.3)', 1);
    ctx.restore();
    // Red earth, spinifex and a road going nowhere.
    fillAcross(ctx, 166, 290, vgrad(ctx, 166, 250, ['#c8552e', '#8a3220']));
    poly(ctx, [150, 232, 196, 168, 204, 168, 250, 232], 'rgba(60,30,30,0.45)');
    for (let i = 0; i < 6; i++) poly(ctx, [199, 170 + i * i * 1.9, 201, 170 + i * i * 1.9, 201.6 + i * 0.5, 174 + i * i * 2.2, 198.4 - i * 0.5, 174 + i * i * 2.2], 'rgba(255,230,180,0.6)');
    for (let i = 0; i < 40; i++) {
      const x = X0 + hash(i, 293) * SPAN, y = 172 + hash(i, 294) * 40;
      ellipse(ctx, x, y, 5 + hash(i, 295) * 5, 2.4, alpha(i % 3 ? '#b8a05a' : '#8a8a4a', 0.8));
    }
    // Gum trees.
    for (const [gx, gs] of [[40, 1], [430, 0.8], [-110, 0.9]]) {
      at(ctx, gx, 176, 0, gs, gs, () => {
        curve(ctx, [0, 0, -2, -22, 3, -44], '#e6dcc8', 3);
        curve(ctx, [1, -24, 10, -34, 16, -44], '#e6dcc8', 1.8);
        curve(ctx, [-1, -30, -9, -40, -13, -50], '#e6dcc8', 1.6);
        for (const [lx, ly, r] of [[4, -50, 13], [18, -48, 9], [-14, -54, 10], [-2, -62, 9]]) {
          ellipse(ctx, lx + Math.sin(t * 0.9 + lx) * 0.8, ly, r, r * 0.62, 'rgba(90,110,70,0.92)');
        }
      });
    }
    // A windmill pump and its tank.
    at(ctx, 236, 176, 0, 1, 1, () => {
      for (const s of [-1, 1]) line(ctx, s * 7, 0, s * 1.4, -46, '#4a3a34', 1.1);
      for (let i = 1; i < 4; i++) line(ctx, -7 + i * 1.5, -i * 11.5, 7 - i * 1.5, -i * 11.5, '#4a3a34', 0.7);
      at(ctx, 0, -48, t * 2.2, 1, 1, () => {
        for (let i = 0; i < 12; i++) {
          ctx.rotate(TAU / 12);
          poly(ctx, [1.2, -2.4, 12, -4.4, 12, 0.4], '#6a5a54');
        }
        circle(ctx, 0, 0, 1.8, '#3a2c28');
      });
      poly(ctx, [0, -48, 16, -52, 16, -44], '#6a5a54');
      rect(ctx, 16, -12, 22, 12, '#8a8f98', 1);
      for (let i = 0; i < 5; i++) rect(ctx, 16 + i * 4.6, -12, 1, 12, 'rgba(40,40,50,0.3)');
    });
    // A warning sign, and the reason for it.
    at(ctx, 76, 180, 0, 1, 1, () => {
      rect(ctx, -0.9, -20, 1.8, 20, '#5a5a5a');
      poly(ctx, [0, -34, 9, -25, 0, -16, -9, -25], '#f2c21c');
      poly(ctx, [0, -32.4, 7.4, -25, 0, -17.6, -7.4, -25], 'rgba(0,0,0,0)');
      kangaroo(ctx, -0.6, -20.4, 0.24, 1, 0.3, '#1c1a16');
    });
    for (let i = 0; i < 4; i++) {
      const sp = 26 + i * 7, dir = i % 2 ? 1 : -1;
      const x = drift(i * 190 + 40, dir * sp, t, 60);
      const hop = (t * 1.5 + i * 0.37) % 1;
      const s = 0.8 + (i % 3) * 0.16;
      ellipse(ctx, x, 186 + i * 4, 10 * s, 2 * s, `rgba(60,20,20,${0.25 * (1 - Math.sin(hop * Math.PI) * 0.6)})`);
      kangaroo(ctx, x, 186 + i * 4, s, dir, hop, '#5a2a24');
    }
    // Heat coming off the ground.
    for (let i = 0; i < 4; i++) ellipse(ctx, drift(i * 220, 4, t, 150), 170 + i * 2, 120, 2.4, 'rgba(255,220,170,0.12)');
    ctx.restore();
  },
  shell(ctx) {
    // The veranda of a tin-roofed pub.
    for (const x of [-28, 428]) {
      rect(ctx, x - 5, 0, 10, 232, '#6a4a34');
      rect(ctx, x - 5, 0, 3, 232, '#8a6244');
      poly(ctx, [x + 5, 18, x + 28, 18, x + 5, 42], '#6a4a34');
      poly(ctx, [x - 5, 18, x - 28, 18, x - 5, 42], '#6a4a34');
    }
    fillAcross(ctx, -400, 14, '#8f98a4');
    across(0, 7, (x, i) => rect(ctx, x, -400, 3.4, 414, i % 2 ? '#aab2bc' : '#7a828e'));
    fillAcross(ctx, -400, 14, 'rgba(160,80,40,0.22)');
    for (let i = 0; i < 14; i++) ellipse(ctx, X0 + hash(i, 296) * SPAN, 6 + hash(i, 297) * 6, 9, 3, 'rgba(150,70,30,0.3)');
    fillAcross(ctx, 14, 18, '#5a3e2c');
    // Rail.
    fillAcross(ctx, 190, 194, '#8a6244');
    across(0, 22, (x) => rect(ctx, x, 194, 3, 40, '#6a4a34'));
  },
  mid(ctx, t) {
    festoon(ctx, -28, 26, 200, 30, 12, t, ['#ffd27a', '#ff9a5a'], 13, 1.8, 0.6);
    festoon(ctx, 200, 30, 428, 26, 12, t, ['#ffd27a', '#ff9a5a'], 13, 1.8, 0.6);
    // A ceiling fan, turning as slowly as it can get away with.
    at(ctx, 200, 30, 0, 1, 0.26, () => {
      ctx.rotate(t * 1.6);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(TAU / 4);
        blob(ctx, [3, -3, 30, -5, 34, 0, 30, 5, 3, 3], '#5a3e2c', 0.4);
      }
    });
    rect(ctx, 198, 14, 4, 16, '#3a2a1e');
    circle(ctx, 200, 31, 3.4, '#3a2a1e');
  },
  front(ctx, t) {
    // Flies. Of course.
    for (let i = 0; i < 9; i++) {
      const x = 200 + Math.sin(t * (1.3 + i * 0.21) + i * 2) * (90 + i * 16) + Math.sin(t * 7 + i) * 4;
      const y = 110 + Math.cos(t * (1.7 + i * 0.17) + i) * 50 + Math.cos(t * 9 + i) * 3;
      circle(ctx, x, y, 0.8, 'rgba(30,20,20,0.7)');
    }
    motes(ctx, t, 12, 298, '#ffd9a0', { y0: 20, y1: 200, a: 0.45 });
  },
};

export const WORLD_BACKDROPS: Record<string, Backdrop> = {
  highlands, meadhall, prague, oktoberfest, bavaria, redsquare, forbidden, pocha, izakaya, pirateship, outback,
};
