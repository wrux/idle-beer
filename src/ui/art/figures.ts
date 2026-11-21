/**
 * The crowd: one rigged character per drinker, built from a shared body with its own hair, hat,
 * face, clothes and drink. Each one breathes, blinks, sips, chats, laughs and cheers on its own
 * timer, and most types have a party piece of their own.
 *
 * Local coordinates: x across, y up is negative. The head is centred on (0, -62) and the body
 * carries on down past y = 0 so the bar (or the row in front) can cut it off anywhere.
 */
import {
  TAU, alpha, approach, arc, backOut, blob, circle, clamp, curve, ellipse, glow, hash, lerp, limb, line, mix, poly,
  rect, rng, shade, smooth, tint, type Ctx,
} from './draw';

type Hair = 'bald' | 'short' | 'side' | 'long' | 'bun' | 'afro' | 'mohawk' | 'greySides' | 'curly' | 'bob' | 'quiff';
type Hat = 'none' | 'flatcap' | 'mortarboard' | 'cone' | 'antlers' | 'scrumcap' | 'bobble' | 'bucket' | 'hanky'
  | 'crown' | 'party' | 'helmet' | 'antennae' | 'cap';
type Face = 'plain' | 'glasses' | 'shades' | 'cyclops' | 'three' | 'void';
type Beard = 'none' | 'moustache' | 'full' | 'stubble' | 'goatee';
type Pattern = 'none' | 'hoops' | 'stripes' | 'flames' | 'tie' | 'lanyard' | 'sash' | 'lplate' | 'unionjack' | 'vest'
  | 'hawaiian' | 'suit' | 'cardigan' | 'print' | 'stars' | 'hoodie' | 'tiedye';
type Drink = 'pint' | 'can' | 'flute' | 'tankard' | 'tasting' | 'cocktail';
type Special = 'dance' | 'dart' | 'scarf' | 'glowstick' | 'flag' | 'float' | 'camera' | 'spark' | 'warp' | 'glitch';

export interface Look {
  skin: string;
  shirt: string;
  /** Open jacket over the shirt. */
  jacket?: string;
  /** Bare forearms. */
  shortSleeves?: boolean;
  build?: number;
  hair: Hair;
  hairColour: string;
  hat?: Hat;
  hatColour?: string;
  hatAccent?: string;
  face?: Face;
  beard?: Beard;
  pattern?: Pattern;
  patternColour?: string;
  patternColour2?: string;
  scarf?: string;
  drink?: Drink;
  drinkColour?: string;
  special?: Special;
  /** Lit from within (aliens' antennae, the black hole's halo). */
  glow?: string;
}

const SKINS = ['#f4cfae', '#ecbc98', '#dba27a', '#c0825a', '#96603f', '#6f4530', '#f7d9c0'];
const HAIRS = ['#2a1b15', '#47301f', '#7b4b24', '#b07c38', '#d9b565', '#8d8d8f', '#d8d3cb', '#a23d24'];
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** Each drinker type's wardrobe. The seed varies people of the same type. */
const LOOKS: Record<string, (r: () => number) => Look> = {
  regular: (r) => ({
    skin: pick(r, SKINS.slice(0, 4)), shirt: pick(r, ['#e9e1cf', '#d5dbe0', '#e3d2c0']),
    jacket: pick(r, ['#6b5a48', '#4e5a4a', '#5a4a58', '#40506a']), hair: 'greySides', hairColour: pick(r, ['#d8d3cb', '#b9b4ad']),
    hat: 'flatcap', hatColour: pick(r, ['#5d4a3a', '#4a4f46', '#6a5a4a', '#3f4550']), face: r() < 0.5 ? 'glasses' : 'plain',
    beard: pick(r, ['moustache', 'stubble', 'none']), pattern: 'tie', patternColour: pick(r, ['#8c2d22', '#2f5a3a', '#34406a']),
    drink: 'tankard',
  }),
  student: (r) => ({
    skin: pick(r, SKINS), shirt: pick(r, ['#6a45a8', '#1f8a84', '#c6423b', '#e0a52e', '#2d5fae']), pattern: 'hoodie',
    patternColour: '#f1ece2', hair: pick(r, ['long', 'bun', 'mohawk', 'curly', 'side', 'afro']),
    hairColour: pick(r, [...HAIRS.slice(0, 5), '#3fc7b5', '#e0559a']), hat: pick(r, ['mortarboard', 'mortarboard', 'cone', 'none', 'none']),
    hatColour: '#1d1d24', hatAccent: '#f2c94c', face: r() < 0.3 ? 'glasses' : 'plain', drink: 'pint', special: 'dance',
  }),
  darts: (r) => ({
    skin: pick(r, SKINS.slice(0, 4)), shirt: pick(r, ['#16161f', '#1c2a4a', '#3a1420']), pattern: 'flames',
    patternColour: pick(r, ['#ff7a1a', '#ffd23c', '#3fd0ff']), patternColour2: '#ffe27a', build: 1.22, shortSleeves: true,
    hair: pick(r, ['bald', 'short', 'quiff']), hairColour: pick(r, HAIRS.slice(0, 3)), beard: pick(r, ['goatee', 'moustache', 'stubble']),
    special: 'dart',
  }),
  stag: (r) => ({
    skin: pick(r, SKINS), shirt: pick(r, ['#ff6fa8', '#ff8fbd', '#f25c9a']), pattern: r() < 0.5 ? 'lplate' : 'sash',
    patternColour: '#ffffff', patternColour2: '#d8263a', shortSleeves: true, hair: pick(r, ['short', 'quiff', 'side']),
    hairColour: pick(r, HAIRS.slice(0, 5)), hat: 'antlers', hatColour: '#c89a5b', hatAccent: '#ff8fbd',
    face: r() < 0.3 ? 'shades' : 'plain', beard: pick(r, ['none', 'stubble']), special: 'dance',
  }),
  rugby: (r) => {
    const kit = pick(r, [['#1f7a3a', '#f4f4f4'], ['#1c2c5a', '#c8323a'], ['#7a1f2a', '#f2c94c'], ['#111111', '#f4f4f4']]);
    return {
      skin: pick(r, SKINS), shirt: kit[0], pattern: 'hoops', patternColour: kit[1], build: 1.3, shortSleeves: true,
      hair: pick(r, ['short', 'bald', 'curly']), hairColour: pick(r, HAIRS.slice(0, 4)),
      hat: r() < 0.55 ? 'scrumcap' : 'none', hatColour: pick(r, ['#1b2a4a', '#222222', '#8a1f2a']),
      beard: pick(r, ['none', 'stubble', 'full']), special: 'dance',
    };
  },
  supporters: (r) => {
    const kit = pick(r, [['#c8262f', '#ffffff'], ['#1f4fa8', '#ffffff'], ['#6a1f3a', '#8fd0f2'], ['#f2c94c', '#17503a']]);
    return {
      skin: pick(r, SKINS), shirt: kit[0], pattern: 'stripes', patternColour: kit[1], shortSleeves: true,
      hair: pick(r, ['short', 'side', 'long', 'bob']), hairColour: pick(r, HAIRS), hat: r() < 0.7 ? 'bobble' : 'cap',
      hatColour: kit[0], hatAccent: kit[1], scarf: kit[0], patternColour2: kit[1], beard: pick(r, ['none', 'stubble', 'none']),
      special: 'scarf',
    };
  },
  wmc: (r) => ({
    skin: pick(r, SKINS.slice(0, 3)), shirt: '#e6dfcf', jacket: pick(r, ['#7a5232', '#5a5f3a', '#6a3a34', '#44506a']),
    pattern: 'cardigan', patternColour: pick(r, ['#8c2d22', '#34406a']), hair: pick(r, ['greySides', 'bald']), hairColour: '#cfcac2',
    hat: r() < 0.6 ? 'flatcap' : 'none', hatColour: pick(r, ['#3e3a35', '#55483a']), face: 'glasses',
    beard: pick(r, ['moustache', 'none']), drink: 'tankard',
  }),
  beerfest: (r) => ({
    skin: pick(r, SKINS.slice(0, 4)), shirt: pick(r, ['#2c2c30', '#3a4a2a', '#4a2a2a', '#2a3a4a']), pattern: 'print',
    patternColour: pick(r, ['#e0a53a', '#e9e2cf', '#9ad06a']), patternColour2: '#e23d6d', shortSleeves: true, build: 1.12,
    hair: pick(r, ['long', 'bald', 'bun', 'short']), hairColour: pick(r, [...HAIRS.slice(1, 4), '#8d8d8f']), beard: 'full',
    hat: r() < 0.25 ? 'bucket' : 'none', hatColour: '#6b7a4a', face: r() < 0.4 ? 'glasses' : 'plain', drink: 'tasting',
  }),
  musicfest: (r) => ({
    skin: pick(r, SKINS), shirt: pick(r, ['#f2c94c', '#ff7fb0', '#5fd6c2', '#b58cff']), pattern: 'tiedye',
    patternColour: pick(r, ['#ff5c8a', '#5cd6ff', '#ffe15c', '#8cff9e']), patternColour2: '#e23d6d', shortSleeves: true,
    hair: pick(r, ['long', 'curly', 'bun', 'afro', 'side']), hairColour: pick(r, [...HAIRS.slice(0, 5), '#ff7fb0', '#5fd6c2']),
    hat: r() < 0.75 ? 'bucket' : 'none', hatColour: pick(r, ['#3b7dd8', '#e84393', '#3fae6a', '#f2994a']), hatAccent: '#ffffff',
    face: r() < 0.6 ? 'shades' : 'plain', drink: 'can', drinkColour: pick(r, ['#d8263a', '#2d8f4e', '#e0a53a']), special: 'glowstick',
    glow: pick(r, ['#8cff9e', '#ff5cf0', '#5cd6ff']),
  }),
  chain: (r) => ({
    skin: pick(r, SKINS), shirt: '#f1f0ec', jacket: pick(r, ['#232f4a', '#2e2e36', '#3a2a3f']), pattern: 'tie',
    patternColour: pick(r, ['#c8323a', '#d08a2a', '#2f8f7a']), patternColour2: '#f2c94c',
    hair: pick(r, ['side', 'bob', 'short', 'bun']), hairColour: pick(r, HAIRS.slice(0, 5)), face: r() < 0.3 ? 'glasses' : 'plain',
  }),
  bankhol: (r) => ({
    skin: pick(r, ['#f29a82', '#ef8c76', '#f4a48c']), shirt: '#f6f4ee', pattern: 'vest', shortSleeves: true, build: 1.14,
    hair: pick(r, ['bald', 'greySides', 'short']), hairColour: pick(r, HAIRS.slice(1, 4)), hat: 'hanky', hatColour: '#ffffff',
    face: r() < 0.6 ? 'shades' : 'plain', beard: pick(r, ['none', 'moustache', 'stubble']), special: 'flag',
  }),
  streetparty: (r) => ({
    skin: pick(r, SKINS), shirt: '#24408e', pattern: 'unionjack', hair: pick(r, ['bob', 'curly', 'long', 'side', 'bun']),
    hairColour: pick(r, HAIRS), hat: 'crown', hatColour: '#f2c94c', hatAccent: '#c8323a', drink: 'flute',
    drinkColour: '#f7e3a1', special: 'flag',
  }),
  toast: (r) => ({
    skin: pick(r, SKINS), shirt: pick(r, ['#16a085', '#e67e22', '#8e44ad', '#c0392b', '#2980b9', '#d4ac0d']),
    pattern: pick(r, ['sash', 'stars', 'none']), patternColour: pick(r, ['#ffe27a', '#ffffff', '#ff8fbd']),
    hair: pick(r, ['afro', 'long', 'bun', 'short', 'curly', 'bob', 'bald']), hairColour: pick(r, HAIRS),
    hat: r() < 0.7 ? 'party' : 'none', hatColour: pick(r, ['#e84393', '#f2c94c', '#3b7dd8', '#3fae6a']), hatAccent: '#ffffff',
    beard: pick(r, ['none', 'none', 'full', 'moustache']), drink: 'flute', drinkColour: '#f7e3a1',
  }),
  lunar: (r) => ({
    skin: pick(r, SKINS), shirt: '#eef1f5', pattern: 'suit', patternColour: pick(r, ['#e86a3a', '#3b7dd8', '#3fae6a']),
    patternColour2: '#c8ced8', hair: pick(r, ['short', 'bun', 'side', 'bald']), hairColour: pick(r, HAIRS), hat: 'helmet',
    special: 'float', build: 1.1,
  }),
  crawl: (r) => ({
    skin: pick(r, ['#7bd36f', '#63c98a', '#9bdc5a']), shirt: pick(r, ['#6c3fa0', '#e8643a', '#1f8a9a']), pattern: 'hawaiian',
    patternColour: pick(r, ['#ffe15c', '#ff8fbd', '#ffffff']), patternColour2: '#2f9e5a', shortSleeves: true, hair: 'bald',
    hairColour: '#000000', hat: 'antennae', face: 'three', drink: 'cocktail', drinkColour: '#ff7ad1', special: 'camera', glow: '#d6ff7a',
  }),
  galactic: (r) => ({
    skin: pick(r, ['#a58cff', '#7fa6ff', '#d08cff']), shirt: '#1d1b4f', pattern: 'stars', patternColour: '#9fe7ff', hair: 'bald',
    hairColour: '#000000', hat: 'antennae', face: 'cyclops', drink: 'cocktail', drinkColour: pick(r, ['#7affc1', '#ffd36b', '#7ad7ff']),
    special: 'spark', glow: pick(r, ['#7affc1', '#ff8cf0', '#9fe7ff']), build: 0.95,
  }),
  blackhole: () => ({
    skin: '#141020', shirt: '#0b0814', hair: 'bald', hairColour: '#000000', face: 'void', drink: 'cocktail', drinkColour: '#b48cff',
    special: 'warp', glow: '#b48cff',
  }),
  multiverse: (r) => ({
    skin: pick(r, SKINS), shirt: '#e9e1cf', jacket: pick(r, ['#3b82f6', '#e84393', '#16a085', '#f59e0b', '#8e44ad']),
    hair: 'greySides', hairColour: '#d8d3cb', hat: 'flatcap', hatColour: pick(r, ['#5d4a3a', '#3b5d8a', '#8a3b6a']),
    beard: 'moustache', pattern: 'tie', patternColour: '#8c2d22', special: 'glitch', glow: '#8cf2ff',
  }),
};

/** How the room's light and distance change a figure's colours. */
export interface Tone {
  fog: string;
  /** 0 = right at the bar, towards 1 = lost in the haze. */
  amount: number;
  /** Extra darkening for dim rooms. */
  dim: number;
}

type Action = 'idle' | 'sip' | 'talk' | 'laugh' | 'special';

const HEAD_Y = -62;
const UPPER = 21, FORE = 20;

/** Two-bone IK that always bends the elbow outwards (`side` = ±1). */
function elbow(sx: number, sy: number, hx: number, hy: number, side: number): [number, number] {
  const dx = hx - sx, dy = hy - sy;
  const d = clamp(Math.hypot(dx, dy), 0.01, UPPER + FORE - 0.01);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1));
  const e1: [number, number] = [sx + UPPER * Math.cos(base + a), sy + UPPER * Math.sin(base + a)];
  const e2: [number, number] = [sx + UPPER * Math.cos(base - a), sy + UPPER * Math.sin(base - a)];
  return (e1[0] - e2[0]) * side + (e1[1] - e2[1]) * 0.6 > 0 ? e1 : e2;
}

export class Figure {
  readonly look: Look;
  x = 0;
  /** World y of the head's centre. */
  headY = 150;
  scale = 1;
  flip = 1;
  row = 0;
  tone: Tone = { fog: '#000000', amount: 0, dim: 0 };

  private phase: number;
  private rand: () => number;
  private action: Action = 'idle';
  private actionT = 0;
  private actionDur = 1;
  private wait: number;
  private blink = 0;
  private blinkIn: number;
  private level = 1;
  private enter = 0;
  private enterDelay = 0;
  private cheerT = -1;
  private cheerDelay = 0;
  // Smoothed animation channels.
  private sip = 0;
  private talk = 0;
  private laugh = 0;
  private cheerV = 0;
  private special = 0;
  private gaze = 0;
  private gazeTarget = 0;

  constructor(readonly id: string, readonly seed: number) {
    this.rand = rng(seed * 7919 + 13);
    this.look = (LOOKS[id] ?? LOOKS.regular)(rng(seed * 104729 + id.length * 31 + id.charCodeAt(0)));
    this.phase = this.rand() * TAU;
    this.wait = 0.5 + this.rand() * 4;
    this.blinkIn = 1 + this.rand() * 4;
    this.level = 0.3 + this.rand() * 0.7;
  }

  /** Start hidden and pop up after `delay` seconds. */
  arrive(delay: number) {
    this.enter = 0;
    this.enterDelay = delay;
  }

  /** Already here: no entrance. */
  settle() {
    this.enter = 1;
  }

  cheer(delay: number) {
    this.cheerT = 0;
    this.cheerDelay = delay;
  }

  update(dt: number) {
    if (this.enterDelay > 0) this.enterDelay -= dt;
    else this.enter = Math.min(1, this.enter + dt / 0.55);

    // Blink.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 1;
      this.blinkIn = 1.6 + this.rand() * 4.5;
    }
    this.blink = Math.max(0, this.blink - dt / 0.16);

    // Pick something to do.
    if (this.action === 'idle') {
      this.wait -= dt;
      if (this.wait <= 0) {
        const r = this.rand();
        const next: Action = r < 0.34 ? 'sip' : r < 0.62 ? 'talk' : r < 0.78 ? 'laugh' : r < 0.93 ? 'special' : 'idle';
        this.action = next;
        this.actionT = 0;
        this.actionDur = next === 'sip' ? 2.1 : next === 'talk' ? 1.8 + this.rand() * 2.6 : next === 'laugh' ? 1.5 : next === 'special' ? 2.6 : 0.1;
        this.gazeTarget = (this.rand() - 0.5) * 2;
      }
    } else {
      this.actionT += dt;
      if (this.actionT >= this.actionDur) {
        if (this.action === 'sip') {
          this.level -= 0.26;
          if (this.level <= 0.05) this.level = 1; // someone's got the next round in
        }
        this.action = 'idle';
        this.wait = 1 + this.rand() * 5;
      }
    }

    let cheer = 0;
    if (this.cheerT >= 0) {
      if (this.cheerDelay > 0) this.cheerDelay -= dt;
      else {
        this.cheerT += dt;
        cheer = this.cheerT < 1.5 ? 1 : 0;
        if (this.cheerT > 1.5) this.cheerT = -1;
      }
    }

    const p = this.actionT / this.actionDur;
    const env = smooth(p / 0.22) * smooth((1 - p) / 0.22);
    const on = (a: Action) => (this.action === a ? env : 0);
    this.sip = approach(this.sip, cheer ? 0 : on('sip'), 14, dt);
    this.talk = approach(this.talk, on('talk'), 10, dt);
    this.laugh = approach(this.laugh, on('laugh'), 10, dt);
    this.special = approach(this.special, cheer ? 0 : on('special'), 9, dt);
    this.cheerV = approach(this.cheerV, cheer, cheer ? 16 : 6, dt);
    this.gaze = approach(this.gaze, this.gazeTarget, 4, dt);
  }

  /** Colour as seen through this figure's distance and the room's light. */
  private k = (c: string): string => mix(mix(c, this.tone.fog, this.tone.amount), '#07040d', this.tone.dim);

  draw(ctx: Ctx, t: number) {
    const e = this.enter;
    if (e <= 0) return;
    const L = this.look;
    const ph = this.phase;
    const floaty = L.special === 'float';
    const dance = L.special === 'dance' ? this.special : 0;
    let bob = Math.sin(t * 1.35 + ph) * 0.9
      - this.laugh * Math.abs(Math.sin(t * 13)) * 1.6
      - this.cheerV * (2 + 3 * Math.abs(Math.sin(t * 7 + ph)))
      - dance * Math.abs(Math.sin(t * 6.5 + ph)) * 3.2;
    let sway = Math.sin(t * 0.8 + ph) * 0.022 + dance * Math.sin(t * 6.5 + ph) * 0.07 + this.talk * Math.sin(t * 2.3) * 0.02;
    if (floaty) {
      bob += Math.sin(t * 0.55 + ph) * 5 - 4 - this.special * 7;
      sway += Math.sin(t * 0.4 + ph) * 0.09 + this.special * Math.sin(t * 1.2) * 0.12;
    }
    const pop = backOut(e);

    ctx.save();
    ctx.translate(this.x, this.headY - HEAD_Y * this.scale + (bob + (1 - pop) * 80) * this.scale);
    ctx.scale(this.scale * this.flip, this.scale);
    ctx.rotate(sway);
    if (L.special === 'warp') {
      // The black hole's regular stretches and squashes, never quite the same shape twice.
      const w = Math.sin(t * 1.3 + ph) * 0.05 + this.special * Math.sin(t * 9) * 0.12;
      ctx.translate(0, HEAD_Y);
      ctx.scale(1 - w, 1 + w * 1.6);
      ctx.translate(0, -HEAD_Y);
    }
    if (L.special === 'glitch') {
      // Other versions of him from next door's universe keep bleeding through.
      const g = 0.35 + this.special * 0.65;
      const off = (3 + this.special * 9) * (0.6 + 0.4 * Math.sin(t * 2 + ph));
      const jit = hash(Math.floor(t * 9), this.seed) < 0.08 + this.special * 0.3 ? (hash(Math.floor(t * 30), 3) - 0.5) * 6 : 0;
      for (const [dx, c] of [[-off, '#ff5c8a'], [off, '#5cd6ff']] as const) {
        ctx.save();
        ctx.translate(dx + jit, 0);
        ctx.globalAlpha = 0.34 * g;
        this.body(ctx, t, { ...L, jacket: c, hatColour: shade(c, 0.4) });
        ctx.restore();
      }
    }
    this.body(ctx, t, L);
    ctx.restore();
  }

  /** A still head-and-shoulders portrait (for the shop). */
  drawBust(ctx: Ctx) {
    this.enter = 1;
    this.body(ctx, 0.6, this.look, true);
  }

  private body(ctx: Ctx, t: number, L: Look, still = false) {
    const k = this.k;
    const ph = this.phase;
    const w = 19 * (L.build ?? 1);
    const skin = k(L.skin), skinSh = k(shade(L.skin, 0.2));
    const top = L.jacket ?? L.shirt;
    const cloth = k(top), clothSh = k(shade(top, 0.26)), clothHi = k(tint(top, 0.12));
    const sip = still ? 0 : this.sip, cheer = still ? 0 : this.cheerV, special = still ? 0 : this.special;
    const talk = still ? 0 : this.talk, laugh = still ? 0 : this.laugh;
    const breath = still ? 0 : Math.sin(t * 1.7 + ph) * 0.5;
    const sp = L.special;

    if (L.glow && L.face === 'void') {
      // Accretion halo behind the head.
      ctx.save();
      ctx.translate(0, HEAD_Y);
      ctx.rotate(-0.3);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 25 + i * 4, 7 + i * 1.5, 0, 0, TAU);
        ctx.strokeStyle = alpha(i ? L.glow : '#ffffff', [0.8, 0.45, 0.2][i] * (1 - this.tone.amount));
        ctx.lineWidth = [1, 2.4, 4][i];
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = t * (1.5 + i * 0.3) + i * 2.1 + ph;
        glow(ctx, Math.cos(a) * 27, Math.sin(a) * 8, 5, L.glow, 0.9);
      }
      ctx.restore();
    }

    // ----- arms: work out where the hands are -----
    const sRx = w - 3, sLx = -w + 3, sY = -40 + breath;
    // Drinking hand.
    let hx = lerp(w - 6, 6, sip), hy = lerp(-17, -50, sip), tilt = -1.05 * sip;
    hx = lerp(hx, w + 8, cheer);
    hy = lerp(hy, -90 + Math.sin(t * 7 + ph) * 3, cheer);
    tilt = lerp(tilt, 0.22, cheer);
    // Other hand: down by the side unless there's something to do with it.
    let ox = -w - 1, oy = -2, prop: Special | null = null;
    const up = (x: number, y: number, a: number) => {
      ox = lerp(ox, x, a);
      oy = lerp(oy, y, a);
    };
    if (cheer > 0.01) up(-w - 9, -88 + Math.sin(t * 7 + ph + 1) * 3, cheer);
    if (special > 0.01) {
      if (sp === 'dart') {
        const throwP = clamp((this.actionT - 1.0) / 0.22);
        up(lerp(-w - 4, -w + 16, smooth(throwP)), lerp(-70, -62, smooth(throwP)), special);
        prop = 'dart';
      } else if (sp === 'scarf') {
        up(-w - 10, -92, special);
        hx = lerp(hx, w + 10, special);
        hy = lerp(hy, -92, special);
        tilt = lerp(tilt, 0, special);
        prop = 'scarf';
      } else if (sp === 'glowstick' || sp === 'flag') {
        up(-w - 8 + Math.sin(t * 5 + ph) * 7, -86 + Math.cos(t * 5 + ph) * 3, special);
        prop = sp;
      } else if (sp === 'camera') {
        up(-5, -52, special);
        prop = 'camera';
      } else if (sp === 'dance') {
        up(-w - 8, -70 + Math.sin(t * 6.5 + ph) * 8, special);
      }
    }
    const [eRx, eRy] = elbow(sRx, sY, hx, hy, 1);
    const [eLx, eLy] = elbow(sLx, sY, ox, oy, -1);
    const sleeve = cloth;
    const fore = L.shortSleeves ? skin : sleeve;
    const drawArm = (sx: number, ex: number, ey: number, x: number, y: number) => {
      limb(ctx, sx, sY, ex, ey, 5.6, 4.8, sleeve);
      if (L.shortSleeves) {
        // Sleeve stops just short of the elbow.
        limb(ctx, lerp(sx, ex, 0.6), lerp(sY, ey, 0.6), ex, ey, 4.4, 4.2, skin);
      }
      limb(ctx, ex, ey, x, y, 4.5, 3.9, fore);
    };

    // Back arm goes behind the body unless it's raised.
    const backRaised = oy < -40;
    if (!backRaised) {
      drawArm(sLx, eLx, eLy, ox, oy);
      circle(ctx, ox, oy, 4.1, skin);
    }

    // ----- torso -----
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-w, 70);
      ctx.lineTo(-w, -34 + breath);
      ctx.quadraticCurveTo(-w, -47 + breath, -w + 11, -48 + breath);
      ctx.lineTo(w - 11, -48 + breath);
      ctx.quadraticCurveTo(w, -47 + breath, w, -34 + breath);
      ctx.lineTo(w, 70);
      ctx.closePath();
    };
    torso();
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.save();
    torso();
    ctx.clip();
    if (L.jacket) {
      // Shirt showing between the lapels.
      poly(ctx, [-7, -49, 7, -49, 4, 70, -4, 70], k(L.shirt));
    }
    this.pattern(ctx, L, w, t);
    if (L.jacket) {
      poly(ctx, [-7.5, -49, -1, -28, -4.5, -24, -11, -44], clothHi);
      poly(ctx, [7.5, -49, 1, -28, 4.5, -24, 11, -44], clothSh);
    }
    // Shadow down the far side, and under the chin.
    ctx.fillStyle = alpha('#140a24', 0.2);
    ctx.fillRect(w * 0.5, -60, w, 140);
    ellipse(ctx, 0, -47, 9, 4.5, alpha('#140a24', 0.22));
    ctx.restore();

    if (L.scarf && !(prop === 'scarf')) {
      rect(ctx, -10, -51, 20, 6.5, k(L.scarf), 3);
      rect(ctx, 3, -47, 6.5, 19, k(L.scarf), 2);
      rect(ctx, 3, -40, 6.5, 3, k(L.patternColour2 ?? '#fff'));
      rect(ctx, 3, -33, 6.5, 3, k(L.patternColour2 ?? '#fff'));
    }

    // ----- neck and head -----
    rect(ctx, -4.6, -52, 9.2, 8, skinSh);
    this.head(ctx, t, L, { sip, cheer, talk, laugh, special, still });

    // ----- raised back arm and what it's holding -----
    if (backRaised) {
      drawArm(sLx, eLx, eLy, ox, oy);
      if (prop === 'flag') this.flag(ctx, ox, oy, t);
      if (prop === 'glowstick') {
        const a = -1.2 + Math.sin(t * 5 + ph) * 0.5;
        const c = L.glow ?? '#8cff9e';
        line(ctx, ox, oy, ox + Math.cos(a) * 15, oy + Math.sin(a) * 15, c, 2.2);
        glow(ctx, ox + Math.cos(a) * 9, oy + Math.sin(a) * 9, 12, c, 0.8 * (1 - this.tone.amount * 0.5));
      }
      if (prop === 'dart') {
        const fly = clamp((this.actionT - 1.22) / 0.5);
        if (fly <= 0) {
          line(ctx, ox, oy - 2, ox + 9, oy - 4, k('#d8d8e0'), 1.1);
          poly(ctx, [ox - 1, oy - 4, ox - 5, oy - 4.5, ox - 5, oy + 0.5, ox - 1, oy - 1.5], k(L.patternColour ?? '#f00'));
        } else if (fly < 1) {
          const fx = ox + 9 + fly * 90, fy = oy - 4 - Math.sin(fly * Math.PI) * 8;
          ctx.globalAlpha *= 1 - fly;
          line(ctx, fx - 9, fy + 1, fx, fy, k('#d8d8e0'), 1.1);
          ctx.globalAlpha /= 1 - fly;
        }
      }
      if (prop === 'camera') {
        rect(ctx, ox - 7, oy - 5, 14, 9, k('#2a2a34'), 2);
        circle(ctx, ox, oy - 0.5, 3, k('#5f6a80'));
        const flash = arc(clamp((this.actionT - 1.2) / 0.25));
        if (flash > 0.02) glow(ctx, ox + 4, oy - 5, 40, '#ffffff', flash);
      }
      circle(ctx, ox, oy, 4.1, skin);
    }
    if (prop === 'scarf' && L.scarf) {
      // Held aloft between both hands, sagging and swaying.
      const sag = 6 + Math.sin(t * 3 + ph) * 2;
      const midX = (ox + hx) / 2, midY = (oy + hy) / 2 + sag;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(midX, midY, hx, hy);
      ctx.strokeStyle = k(L.scarf);
      ctx.lineWidth = 7;
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = k(L.patternColour2 ?? '#ffffff');
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ----- drinking arm, glass, hand -----
    drawArm(sRx, eRx, eRy, hx, hy);
    if (prop !== 'scarf') {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(tilt);
      this.drink(ctx, L, t);
      ctx.restore();
    }
    circle(ctx, hx, hy, 4.2, skin);
    // Knuckles wrapping the glass.
    ellipse(ctx, hx + 0.6, hy + 0.4, 3.3, 2.2, skinSh);
  }

  private head(
    ctx: Ctx, t: number, L: Look,
    a: { sip: number; cheer: number; talk: number; laugh: number; special: number; still: boolean },
  ) {
    const k = this.k;
    const ph = this.phase;
    const skin = k(L.skin), skinSh = k(shade(L.skin, 0.2)), skinHi = k(tint(L.skin, 0.1));
    const hair = k(L.hairColour), hairSh = k(shade(L.hairColour, 0.25));
    const ink = k('#2a1a1c');
    const nod = a.still ? 0 : Math.sin(t * 2.3 + ph) * 0.03 * a.talk - a.sip * 0.16 - a.laugh * 0.1 + a.cheer * -0.08;
    const Y = HEAD_Y;

    ctx.save();
    ctx.translate(0, Y + 14);
    ctx.rotate(nod);
    ctx.translate(0, -(Y + 14));

    // Hair behind the head.
    if (L.hair === 'long') blob(ctx, [-17, Y - 4, -14, Y - 18, 0, Y - 21, 14, Y - 18, 17, Y - 4, 18, Y + 18, 10, Y + 22, -10, Y + 22, -18, Y + 18], hairSh);
    if (L.hair === 'bob') blob(ctx, [-17, Y - 2, -14, Y - 17, 0, Y - 20, 14, Y - 17, 17, Y - 2, 17, Y + 11, 10, Y + 13, -10, Y + 13, -17, Y + 11], hairSh);
    if (L.hair === 'afro') {
      circle(ctx, 0, Y - 6, 22, hairSh);
      for (let i = 0; i < 9; i++) circle(ctx, Math.cos(Math.PI + (i / 8) * Math.PI) * 20, Y - 6 + Math.sin(Math.PI + (i / 8) * Math.PI) * 20, 5, hair);
    }
    if (L.hat === 'crown') blob(ctx, [-12, Y - 12, -8, Y - 22, 8, Y - 22, 12, Y - 12], k(L.hatAccent ?? '#c8323a'));

    // Ears, then the head with a lit side and a shaded side.
    ellipse(ctx, -14.4, Y + 1, 2.8, 4, skinSh);
    ellipse(ctx, 14.4, Y + 1, 2.8, 4, skinSh);
    ellipse(ctx, 0, Y, 14.6, 16, skinSh);
    ellipse(ctx, -1.5, Y - 0.9, 13, 14.9, skin);
    ellipse(ctx, -5, Y - 7, 6, 5, alpha(skinHi, 0.5));

    // Hair on top.
    switch (L.hair) {
      case 'short': blob(ctx, [-15, Y, -14.5, Y - 12, -6, Y - 18, 6, Y - 18, 14.5, Y - 12, 15, Y, 11.5, Y - 8, 0, Y - 11, -11.5, Y - 8], hair); break;
      case 'side': case 'long': case 'bun':
        blob(ctx, [-15, Y + 2, -15, Y - 12, -5, Y - 19, 8, Y - 18, 15, Y - 10, 15, Y, 12, Y - 7, 2, Y - 10, -8, Y - 5], hair);
        if (L.hair === 'bun') circle(ctx, 0, Y - 21, 5.2, hair);
        break;
      case 'bob': blob(ctx, [-14.5, Y - 9, -8, Y - 17, 8, Y - 17, 14.5, Y - 9, 13, Y - 5, 0, Y - 8, -13, Y - 5], hair); break;
      case 'quiff': blob(ctx, [-15, Y, -14, Y - 12, -8, Y - 20, 4, Y - 25, 12, Y - 19, 15, Y - 9, 15, Y, 11, Y - 8, 2, Y - 11, -11, Y - 7], hair); break;
      case 'curly':
        for (let i = 0; i < 8; i++) circle(ctx, lerp(-13, 13, i / 7), Y - 11 - Math.sin((i / 7) * Math.PI) * 6, 4.6, i % 2 ? hair : hairSh);
        break;
      case 'mohawk':
        for (let i = 0; i < 5; i++) poly(ctx, [-5 + i * 2.2, Y - 14, -1.5 + i * 2.2, Y - 30 + Math.abs(i - 2) * 3, 2 + i * 2.2, Y - 14], hair);
        break;
      case 'greySides':
        ellipse(ctx, -13.6, Y - 3, 3.4, 6.5, hair);
        ellipse(ctx, 13.6, Y - 3, 3.4, 6.5, hair);
        break;
      case 'afro': blob(ctx, [-14.5, Y - 6, -10, Y - 15, 0, Y - 17, 10, Y - 15, 14.5, Y - 6, 8, Y - 10, -8, Y - 10], hair); break;
      default: break;
    }

    // ----- face -----
    const blink = a.still ? 1 : 1 - this.blink * 0.9;
    const happy = Math.max(a.laugh, a.cheer, a.sip);
    const open = blink * (1 - happy * 0.75);
    const gx = a.still ? 0 : this.gaze * 0.9;
    const eyeY = Y - 1.5;
    const face = L.face ?? 'plain';
    const eye = (x: number) => {
      if (happy > 0.5) {
        curve(ctx, [x - 2, eyeY + 0.4, x, eyeY - 1.2, x + 2, eyeY + 0.4], ink, 1.1);
      } else {
        ellipse(ctx, x + gx, eyeY, 1.65, Math.max(0.25, 2 * open), ink);
        if (open > 0.6) circle(ctx, x + gx + 0.5, eyeY - 0.7, 0.5, 'rgba(255,255,255,0.75)');
      }
    };
    if (face === 'cyclops') {
      ellipse(ctx, 0, eyeY - 1, 6.2, Math.max(0.5, 6 * blink), k('#fbfaf5'));
      circle(ctx, gx * 1.6, eyeY - 1, 2.9 * Math.min(1, blink * 1.5), k(L.glow ?? '#333'));
      circle(ctx, gx * 1.6, eyeY - 1, 1.4 * Math.min(1, blink * 1.5), ink);
    } else if (face === 'three') {
      eye(-6);
      eye(6);
      ellipse(ctx, gx, eyeY - 6.5, 1.5, Math.max(0.25, 1.8 * open), ink);
    } else if (face === 'void') {
      const c = L.glow ?? '#fff';
      for (const x of [-5.2, 5.2]) {
        circle(ctx, x, eyeY, 1.5, '#ffffff');
        glow(ctx, x, eyeY, 7, c, 0.9 * (1 - this.tone.amount * 0.6));
      }
    } else if (face === 'shades') {
      rect(ctx, -11.5, eyeY - 3.4, 10, 6.8, k('#16141c'), 2.4);
      rect(ctx, 1.5, eyeY - 3.4, 10, 6.8, k('#16141c'), 2.4);
      rect(ctx, -2, eyeY - 2.4, 4, 1.4, k('#16141c'));
      line(ctx, -9.5, eyeY - 1.8, -6, eyeY - 1.8, 'rgba(255,255,255,0.35)', 0.9);
      line(ctx, 3.5, eyeY - 1.8, 7, eyeY - 1.8, 'rgba(255,255,255,0.35)', 0.9);
    } else {
      eye(-5.2);
      eye(5.2);
      if (face === 'glasses') {
        ctx.strokeStyle = k('#3a2a22');
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(-5.4, eyeY, 4.3, 0, TAU);
        ctx.moveTo(9.7, eyeY);
        ctx.arc(5.4, eyeY, 4.3, 0, TAU);
        ctx.moveTo(-1.1, eyeY - 0.6);
        ctx.lineTo(1.1, eyeY - 0.6);
        ctx.stroke();
        line(ctx, -8, eyeY - 2, -6, eyeY - 3, 'rgba(255,255,255,0.4)', 0.8);
      }
    }
    if (face !== 'shades' && face !== 'cyclops' && face !== 'void') {
      const lift = happy * 1.6 + a.talk * Math.sin(t * 5 + ph) * 0.7;
      const brow = L.hair === 'bald' && L.hat === 'antennae' ? skinSh : mix(hairSh, ink, 0.4);
      line(ctx, -7.6, eyeY - 4.6 - lift, -3, eyeY - 5.2 - lift, brow, 1.25);
      line(ctx, 3, eyeY - 5.2 - lift, 7.6, eyeY - 4.6 - lift, brow, 1.25);
    }
    if (face !== 'void') {
      // Nose and rosy cheeks.
      ellipse(ctx, 0.3, Y + 3.2, 2.1, 2.7, skinSh);
      circle(ctx, -8.6, Y + 5.5, 3.1, alpha(k('#e8756a'), 0.3 + happy * 0.2));
      circle(ctx, 8.6, Y + 5.5, 3.1, alpha(k('#e8756a'), 0.3 + happy * 0.2));
    }

    // Beard goes under the mouth.
    const beardC = k(mix(L.hairColour, '#8a8078', L.hair === 'bald' || L.hair === 'greySides' ? 0 : 0.15));
    if (L.beard === 'full') blob(ctx, [-14, Y + 1, -13.5, Y + 11, -7, Y + 19, 0, Y + 21, 7, Y + 19, 13.5, Y + 11, 14, Y + 1, 9, Y + 5.5, 0, Y + 4.6, -9, Y + 5.5], beardC);
    if (L.beard === 'stubble') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-16, Y + 5, 32, 14);
      ctx.clip();
      ellipse(ctx, -1, Y, 12.6, 14.6, alpha(k('#3a2c2a'), 0.22));
      ctx.restore();
    }
    if (L.beard === 'goatee') blob(ctx, [-4.5, Y + 9, 0, Y + 8, 4.5, Y + 9, 4, Y + 16, 0, Y + 18.5, -4, Y + 16], beardC);

    // Mouth.
    const my = Y + 9.4;
    if (face !== 'void') {
      const wide = Math.max(a.laugh, a.cheer);
      if (wide > 0.25) {
        const h = 2 + wide * 4.2 + (a.laugh > 0.3 ? Math.abs(Math.sin(t * 13)) * 1.2 : 0);
        ctx.beginPath();
        ctx.moveTo(-5.4, my - 1.2);
        ctx.lineTo(5.4, my - 1.2);
        ctx.quadraticCurveTo(4.6, my + h, 0, my + h);
        ctx.quadraticCurveTo(-4.6, my + h, -5.4, my - 1.2);
        ctx.fillStyle = k('#4a161c');
        ctx.fill();
        rect(ctx, -4.2, my - 1.2, 8.4, 1.5, k('#fbf7ee'));
        ellipse(ctx, 0, my + h - 1, 2.6, 1.3, k('#d9626a'));
      } else if (a.talk > 0.2) {
        const h = 0.6 + Math.abs(Math.sin(t * 10.5 + ph)) * 2.7 * a.talk;
        ellipse(ctx, 0, my + 0.4, 2.6 + Math.sin(t * 7 + ph) * 0.7, h, k('#4a161c'));
      } else if (a.sip < 0.4) {
        curve(ctx, [-4.2, my - 0.6, 0, my + 1.5, 4.2, my - 0.6], ink, 1.15);
      }
    }
    if (L.beard === 'moustache') {
      blob(ctx, [-0.2, Y + 5.6, -6.5, Y + 6, -8.4, Y + 9.4, -3.5, Y + 8.6, 0, Y + 7.6], beardC);
      blob(ctx, [0.2, Y + 5.6, 6.5, Y + 6, 8.4, Y + 9.4, 3.5, Y + 8.6, 0, Y + 7.6], beardC);
    }

    this.hat(ctx, t, L, a.cheer + a.special);
    ctx.restore();
  }

  private hat(ctx: Ctx, t: number, L: Look, energy: number) {
    const k = this.k;
    const Y = HEAD_Y, ph = this.phase;
    const c = k(L.hatColour ?? '#444'), cSh = k(shade(L.hatColour ?? '#444', 0.28)), cHi = k(tint(L.hatColour ?? '#444', 0.14));
    const ac = k(L.hatAccent ?? '#ffffff');
    const wob = Math.sin(t * 5 + ph) * (0.6 + energy * 2);
    switch (L.hat) {
      case 'flatcap':
        blob(ctx, [-16.2, Y - 7, -15.4, Y - 16, -6, Y - 21.5, 7, Y - 21.5, 15.4, Y - 16, 16.2, Y - 7], c);
        blob(ctx, [-6, Y - 20.5, 4, Y - 20.5, 9, Y - 16, -9, Y - 16], cHi, 0.6);
        blob(ctx, [-17.4, Y - 8.4, 0, Y - 11.4, 17.4, Y - 8.4, 16.4, Y - 4.4, 0, Y - 7, -16.4, Y - 4.4], cSh);
        circle(ctx, 0, Y - 21.3, 1.3, cSh);
        break;
      case 'cap':
        blob(ctx, [-15.4, Y - 6, -14.5, Y - 15, -5, Y - 20.5, 5, Y - 20.5, 14.5, Y - 15, 15.4, Y - 6], c);
        ellipse(ctx, 0, Y - 6.2, 13.6, 3.3, cSh);
        circle(ctx, 0, Y - 13, 3, ac);
        break;
      case 'mortarboard': {
        rect(ctx, -11.5, Y - 17, 23, 8.5, cSh, 2);
        poly(ctx, [-22, Y - 18.5, 0, Y - 25.5, 22, Y - 18.5, 0, Y - 11.5], c);
        poly(ctx, [-22, Y - 18.5, 0, Y - 11.5, 22, Y - 18.5, 22, Y - 17, 0, Y - 10, -22, Y - 17], cSh);
        const sx = 13 + wob * 1.4;
        line(ctx, 0, Y - 18.5, sx, Y - 15, ac, 0.9);
        line(ctx, sx, Y - 15, sx + wob * 0.5, Y - 6.5, ac, 0.9);
        rect(ctx, sx + wob * 0.5 - 1.4, Y - 7.5, 2.8, 4.6, ac, 1);
        break;
      }
      case 'cone':
        poly(ctx, [-8.5, Y - 12, 8.5, Y - 12, 2.6, Y - 39, -2.6, Y - 39], k('#f2762a'));
        poly(ctx, [-6.6, Y - 20.5, 6.6, Y - 20.5, 5.1, Y - 27.5, -5.1, Y - 27.5], k('#f6f2e8'));
        poly(ctx, [2.6, Y - 39, 8.5, Y - 12, 4, Y - 12, 0.8, Y - 39], alpha('#3a1208', 0.22));
        rect(ctx, -12.5, Y - 14, 25, 4, k('#d85f1c'), 1.5);
        break;
      case 'antlers': {
        curve(ctx, [-13.5, Y - 9, -9, Y - 16, 0, Y - 18.5, 9, Y - 16, 13.5, Y - 9], ac, 2.6);
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.translate(s * 8, Y - 17);
          ctx.rotate(s * (0.05 + wob * 0.03));
          curve(ctx, [0, 0, s * 4.5, -9, s * 4, -19], c, 3.1);
          line(ctx, s * 4.4, -9, s * 11, -13.5, c, 2.6);
          line(ctx, s * 4.2, -15, s * -1.5, -21, c, 2.4);
          circle(ctx, s * 11, -13.5, 1.5, cHi);
          circle(ctx, s * 4, -19.4, 1.5, cHi);
          ctx.restore();
        }
        break;
      }
      case 'scrumcap':
        blob(ctx, [-16, Y, -16, Y - 12, -7, Y - 19.5, 7, Y - 19.5, 16, Y - 12, 16, Y, 13, Y - 6, 0, Y - 9, -13, Y - 6], c);
        rect(ctx, -17.2, Y - 5, 4.6, 11, c, 2);
        rect(ctx, 12.6, Y - 5, 4.6, 11, c, 2);
        curve(ctx, [-9, Y - 9, -7, Y - 16, 0, Y - 18.5, 7, Y - 16, 9, Y - 9], cHi, 1.2);
        line(ctx, 0, Y - 19, 0, Y - 9.5, cHi, 1.2);
        curve(ctx, [-14, Y + 5, -8, Y + 16, 0, Y + 18.6, 8, Y + 16, 14, Y + 5], cSh, 1.5);
        break;
      case 'bobble':
        blob(ctx, [-16, Y - 6, -15, Y - 16, -6, Y - 22, 6, Y - 22, 15, Y - 16, 16, Y - 6], c);
        rect(ctx, -16.6, Y - 10.5, 33.2, 6.6, ac, 3);
        for (let i = 0; i < 5; i++) rect(ctx, -13 + i * 6.2, Y - 10.5, 2, 6.6, alpha('#1a1024', 0.14));
        circle(ctx, wob * 0.8, Y - 25, 5, ac);
        circle(ctx, wob * 0.8 - 1.2, Y - 26.2, 2.4, 'rgba(255,255,255,0.35)');
        break;
      case 'bucket':
        blob(ctx, [-12, Y - 9, -11, Y - 20, 0, Y - 23, 11, Y - 20, 12, Y - 9], c);
        blob(ctx, [-21, Y - 5, -12, Y - 10.5, 12, Y - 10.5, 21, Y - 5, 12, Y - 4, -12, Y - 4], cSh);
        rect(ctx, -11.6, Y - 13, 23.2, 2.2, ac);
        break;
      case 'hanky':
        blob(ctx, [-14.5, Y - 8, -12, Y - 16, 0, Y - 19.5, 12, Y - 16, 14.5, Y - 8, 0, Y - 11], c);
        for (const [x, y] of [[-15, -8], [15, -8], [-9.5, -17.5], [9.5, -17.5]]) circle(ctx, x, Y + y, 2.5, cSh);
        break;
      case 'crown':
        poly(ctx, [-13, Y - 10, -14.5, Y - 24, -7, Y - 17.5, 0, Y - 27, 7, Y - 17.5, 14.5, Y - 24, 13, Y - 10], c);
        rect(ctx, -13.4, Y - 13.5, 26.8, 4.2, cSh, 1);
        for (const [x, y, col] of [[-14.5, -24.6, '#e8f1ff'], [0, -27.6, '#ff5c6a'], [14.5, -24.6, '#e8f1ff'], [-6, -11.4, '#5cd6ff'], [6, -11.4, '#7affc1'], [0, -11.4, '#ff5c6a']] as const) {
          circle(ctx, x, Y + y, 1.5, k(col));
        }
        break;
      case 'party':
        ctx.save();
        ctx.translate(-2, Y - 12);
        ctx.rotate(-0.16 + wob * 0.012);
        poly(ctx, [-8, 0, 8, 0, 0, -25], c);
        ctx.save();
        poly(ctx, [-8, 0, 8, 0, 0, -25]);
        ctx.clip();
        for (let i = 0; i < 5; i++) poly(ctx, [-12, -4 - i * 7, 12, -9 - i * 7, 12, -6.5 - i * 7, -12, -1.5 - i * 7], ac);
        ctx.restore();
        circle(ctx, 0, -25.5, 3, ac);
        ctx.restore();
        break;
      case 'antennae':
        for (const s of [-1, 1]) {
          const tx = s * (9 + wob * 0.8), ty = Y - 29 + Math.sin(t * 3 + ph + s) * 1.4;
          curve(ctx, [s * 5, Y - 14, s * 6.5, Y - 22, tx, ty], k(shade(L.skin, 0.15)), 1.6);
          circle(ctx, tx, ty, 2.7, k(L.glow ?? '#fff'));
          glow(ctx, tx, ty, 9 + energy * 5, L.glow ?? '#fff', (0.75 + energy * 0.25) * (1 - this.tone.amount * 0.6));
        }
        break;
      case 'helmet':
        // Collar ring, then a glass bubble with a sweep of reflection.
        rect(ctx, -17.5, Y + 13, 35, 6.5, k('#b9c0cc'), 3);
        rect(ctx, -17.5, Y + 13, 35, 2.2, k('#e3e8ef'), 1.5);
        circle(ctx, 0, Y - 1.5, 22.5, 'rgba(190,225,255,0.13)');
        ctx.beginPath();
        ctx.arc(0, Y - 1.5, 22.5, 0, TAU);
        ctx.strokeStyle = alpha(k('#f4f8fc'), 0.85);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, Y - 1.5, 18.5, Math.PI * 1.08, Math.PI * 1.42);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      default: break;
    }
  }

  private pattern(ctx: Ctx, L: Look, w: number, t: number) {
    const k = this.k;
    const p1 = k(L.patternColour ?? '#ffffff'), p2 = k(L.patternColour2 ?? '#c8323a');
    switch (L.pattern) {
      case 'hoops':
        for (let y = -46; y < 70; y += 13) rect(ctx, -w, y, w * 2, 6, p1);
        poly(ctx, [-6, -49, 6, -49, 0, -41], k('#f4f4f4'));
        break;
      case 'stripes':
        for (let x = -w + 3; x < w; x += 10) rect(ctx, x, -50, 5, 130, p1);
        poly(ctx, [-6, -49, 6, -49, 0, -42], p2);
        break;
      case 'flames':
        blob(ctx, [-w - 2, 70, -w - 2, 2, -w + 6, -20, -w + 9, -2, -5, -27, -1, -6, 5, -24, 9, -4, w - 5, -19, w + 2, 2, w + 2, 70], p1, 0.35);
        blob(ctx, [-w, 70, -w + 4, 16, -w + 8, 0, -5, 14, -2, -8, 3, 12, 8, -2, w - 4, 16, w, 70], p2, 0.35);
        poly(ctx, [-5, -49, 5, -49, 0, -40], k('#f4f4f4'));
        break;
      case 'tie':
        poly(ctx, [-7, -49, 0, -41, -3.4, -37], k('#ffffff'));
        poly(ctx, [7, -49, 0, -41, 3.4, -37], k('#e6e2da'));
        poly(ctx, [-2.4, -41.5, 2.4, -41.5, 1.6, -38, -1.6, -38], p1);
        poly(ctx, [-1.7, -38, 1.7, -38, 3.2, -8, 0, -3, -3.2, -8], p1);
        if (L.patternColour2) rect(ctx, w - 12, -30, 7, 4.4, p2, 1); // name badge
        break;
      case 'cardigan':
        poly(ctx, [-7, -49, 0, -41, -3.4, -37], k('#ffffff'));
        poly(ctx, [7, -49, 0, -41, 3.4, -37], k('#e6e2da'));
        poly(ctx, [-1.7, -39, 1.7, -39, 2.6, -24, 0, -21, -2.6, -24], p1);
        for (let i = 0; i < 4; i++) circle(ctx, 0, -14 + i * 11, 1.2, k('#2a1c14'));
        break;
      case 'lanyard':
      case 'print':
        circle(ctx, 0, -18, 9, p1);
        circle(ctx, 0, -18, 6, k(L.shirt));
        poly(ctx, [-3, -22, 3, -22, 2.4, -13.5, -2.4, -13.5], p1);
        curve(ctx, [-6, -49, -3, -34, 3, -34, 6, -49], p2, 1.4);
        rect(ctx, -3.6, -36, 7.2, 9, k('#f4f2ea'), 1);
        break;
      case 'tiedye':
        for (let i = 4; i >= 0; i--) circle(ctx, 0, -20, 6 + i * 7, i % 2 ? p1 : k(L.shirt));
        curve(ctx, [-6, -49, -3, -32, 3, -32, 6, -49], p2, 1.4);
        rect(ctx, -3.6, -34, 7.2, 9, k('#f4f2ea'), 1);
        break;
      case 'sash':
        poly(ctx, [-w, -40, -w + 9, -49, w, -2, w, 10], p1);
        poly(ctx, [-w, -40, -w + 2, -42, w, 8, w, 10], alpha('#1a1024', 0.12));
        break;
      case 'lplate':
        rect(ctx, -8.5, -31, 17, 17, p1, 1.5);
        poly(ctx, [-3.6, -28, -0.6, -28, -0.6, -20, 4, -20, 4, -17, -3.6, -17], p2);
        break;
      case 'unionjack': {
        const W = w * 2, y0 = -50, H = 120;
        rect(ctx, -w, y0, W, H, k('#24408e'));
        ctx.lineCap = 'butt';
        line(ctx, -w, y0, w, y0 + 62, k('#ffffff'), 8, 'butt');
        line(ctx, w, y0, -w, y0 + 62, k('#ffffff'), 8, 'butt');
        line(ctx, -w, y0, w, y0 + 62, k('#c8323a'), 3, 'butt');
        line(ctx, w, y0, -w, y0 + 62, k('#c8323a'), 3, 'butt');
        rect(ctx, -6, y0, 12, H, k('#ffffff'));
        rect(ctx, -w, y0 + 24, W, 13, k('#ffffff'));
        rect(ctx, -3.4, y0, 6.8, H, k('#c8323a'));
        rect(ctx, -w, y0 + 27, W, 7, k('#c8323a'));
        break;
      }
      case 'vest': {
        // A string vest's worth of sunburn either side.
        const skin = k(L.skin);
        rect(ctx, -w, -50, w * 2, 130, skin);
        blob(ctx, [-9, -50, -11, -36, -w + 2, -16, -w + 1, 70, w - 1, 70, w - 2, -16, 11, -36, 9, -50, 5, -40, -5, -40], k(L.shirt), 0.4);
        break;
      }
      case 'hawaiian':
        for (let i = 0; i < 14; i++) {
          const x = (hash(i, this.seed) * 2 - 1) * w, y = -44 + hash(i, this.seed + 5) * 100;
          for (let j = 0; j < 5; j++) circle(ctx, x + Math.cos(j * 1.256) * 2.2, y + Math.sin(j * 1.256) * 2.2, 1.7, i % 3 ? p1 : p2);
          circle(ctx, x, y, 1, k('#ffffff'));
        }
        poly(ctx, [-7, -49, 0, -39, -5, -34, -10, -45], k(tint(L.shirt, 0.15)));
        poly(ctx, [7, -49, 0, -39, 5, -34, 10, -45], k(shade(L.shirt, 0.15)));
        break;
      case 'suit':
        rect(ctx, -9, -34, 18, 13, p2, 2);
        for (let i = 0; i < 3; i++) circle(ctx, -5 + i * 5, -30, 1.5, k(['#ff5c6a', '#ffe15c', '#7affc1'][i]));
        rect(ctx, -6.5, -26.5, 13, 2.4, k('#3a4252'), 1);
        rect(ctx, -w, -8, w * 2, 3, p1);
        rect(ctx, -w, -3.5, w * 2, 1.2, p2);
        break;
      case 'stars':
        for (let i = 0; i < 12; i++) {
          const x = (hash(i, this.seed + 2) * 2 - 1) * (w - 2), y = -44 + hash(i, this.seed + 7) * 100;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
          circle(ctx, x, y, 0.7 + hash(i, 3) * 0.7, alpha(p1, tw));
        }
        poly(ctx, [-8, -49, 8, -49, 0, -36], alpha(p1, 0.35));
        break;
      case 'hoodie':
        blob(ctx, [-12, -50, -9, -40, 0, -36.5, 9, -40, 12, -50], k(shade(L.shirt, 0.2)), 0.5);
        line(ctx, -3.4, -40, -4, -27, p1, 1.1);
        line(ctx, 3.4, -40, 4, -29, p1, 1.1);
        rect(ctx, -11, -6, 22, 30, k(shade(L.shirt, 0.12)), 4);
        break;
      default: break;
    }
  }

  private drink(ctx: Ctx, L: Look, t: number) {
    const k = this.k;
    const kind = L.drink ?? 'pint';
    const beer = k(L.drinkColour ?? '#e0a030'), beerSh = k(shade(L.drinkColour ?? '#e0a030', 0.22));
    const glassEdge = 'rgba(240,250,255,0.6)';
    const lv = clamp(this.level);
    if (kind === 'can') {
      rect(ctx, -4, -9, 8, 15, beer, 1.6);
      rect(ctx, -4, -4.5, 8, 3.4, k('#f4f2ea'));
      rect(ctx, -3.2, -9.6, 6.4, 1.5, k('#c9ced6'), 0.7);
      rect(ctx, 2, -9, 2, 15, alpha('#140a24', 0.2), 1);
      return;
    }
    if (kind === 'flute' || kind === 'cocktail') {
      const bowl = kind === 'flute' ? [-3.4, -17, 3.4, -17, 2.6, -5, 0, -2.5, -2.6, -5] : [-7.5, -15, 7.5, -15, 0, -5];
      line(ctx, 0, -4, 0, 6, glassEdge, 1.1);
      line(ctx, -4, 6.4, 4, 6.4, glassEdge, 1.3);
      poly(ctx, bowl, 'rgba(220,240,250,0.2)');
      ctx.save();
      poly(ctx, bowl);
      ctx.clip();
      rect(ctx, -9, lerp(-4, -15.5, lv), 18, 16, beer);
      if (kind === 'flute') for (let i = 0; i < 3; i++) circle(ctx, -1.6 + i * 1.6, -5 - ((t * 5 + i * 3.3) % 10), 0.5, 'rgba(255,255,255,0.8)');
      ctx.restore();
      poly(ctx, bowl);
      ctx.strokeStyle = glassEdge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (kind === 'cocktail') {
        glow(ctx, 0, -11, 12, L.drinkColour ?? '#fff', 0.7 * (1 - this.tone.amount * 0.6));
        line(ctx, 3, -15, 7, -21, k('#f4f2ea'), 0.9);
      }
      return;
    }
    const small = kind === 'tasting';
    const hw = small ? 3.6 : kind === 'tankard' ? 5.6 : 5, top = small ? -8 : -11, bot = small ? 5 : 7;
    const shapePts = kind === 'tankard' ? [-hw, top, hw, top, hw, bot, -hw, bot] : [-hw, top, hw, top, hw * 0.8, bot, -hw * 0.8, bot];
    if (kind === 'tankard') {
      ctx.beginPath();
      ctx.moveTo(hw, top + 3);
      ctx.bezierCurveTo(hw + 6, top + 3, hw + 6, bot - 3, hw, bot - 3);
      ctx.strokeStyle = glassEdge;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    poly(ctx, shapePts, 'rgba(220,240,250,0.2)');
    ctx.save();
    poly(ctx, shapePts);
    ctx.clip();
    const ly = lerp(bot - 1.5, top + 2.6, lv);
    rect(ctx, -hw, ly, hw * 2, bot - ly, beer);
    rect(ctx, hw * 0.25, ly, hw, bot - ly, beerSh);
    rect(ctx, -hw, ly - 2.4, hw * 2, 2.6, k('#fbf6e9'));
    ctx.restore();
    poly(ctx, shapePts);
    ctx.strokeStyle = glassEdge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    line(ctx, -hw * 0.5, top + 2.5, -hw * 0.46, bot - 3, 'rgba(255,255,255,0.45)', 0.9);
  }

  private flag(ctx: Ctx, x: number, y: number, t: number) {
    const k = this.k;
    line(ctx, x, y + 3, x + 2, y - 22, k('#e9e2cf'), 1.1);
    const wave = (i: number) => Math.sin(t * 8 + this.phase + i * 1.3) * 1.3;
    const fx = x + 2, fy = y - 22;
    const pts: number[] = [];
    for (let i = 0; i <= 4; i++) pts.push(fx + i * 4.5, fy + wave(i));
    for (let i = 4; i >= 0; i--) pts.push(fx + i * 4.5, fy + 11 + wave(i));
    ctx.save();
    poly(ctx, pts, k('#24408e'));
    poly(ctx, pts);
    ctx.clip();
    line(ctx, fx, fy, fx + 18, fy + 11, k('#ffffff'), 2.6, 'butt');
    line(ctx, fx + 18, fy, fx, fy + 11, k('#ffffff'), 2.6, 'butt');
    rect(ctx, fx + 7, fy - 2, 4, 15, k('#ffffff'));
    rect(ctx, fx, fy + 3.6, 18, 4, k('#ffffff'));
    rect(ctx, fx + 8, fy - 2, 2, 15, k('#c8323a'));
    rect(ctx, fx, fy + 4.6, 18, 2, k('#c8323a'));
    ctx.restore();
  }
}
