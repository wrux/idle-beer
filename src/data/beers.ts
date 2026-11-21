import { D, Decimal } from '../core/num';

export type GlassShape = 'nonic' | 'tulip' | 'snifter' | 'tankard';
export type BeerEffect = 'none' | 'glow' | 'shimmer' | 'void' | 'sparkle' | 'singularity';

/** How a beer looks in the glass. */
export interface BeerLook {
  liquid: string;
  liquidShade: string;
  foam: string;
  foamShade: string;
  /** Head thickness relative to a normal pint. */
  foamScale: number;
  glass: GlassShape;
  effect: BeerEffect;
  /** Colour for glows, shimmer and sparkles. */
  effectColour?: string;
}

export interface Beer {
  id: string;
  name: string;
  flavour: string;
  /** Price; it shows in the store once lifetime pints reach half of this. */
  cost: Decimal;
  /** Multiplies all income (idle and by hand). */
  mult: number;
  look: BeerLook;
}

const look = (
  liquid: string, liquidShade: string, foam: string, foamShade: string,
  extra: Partial<BeerLook> = {},
): BeerLook => ({ liquid, liquidShade, foam, foamShade, foamScale: 1, glass: 'nonic', effect: 'none', ...extra });

/** Bought in order. See DESIGN.md §4. */
export const BEERS: Beer[] = [
  {
    id: 'lager', name: 'Warm Watery Lager', cost: D(0), mult: 1,
    flavour: "It's wet. That's about all you can say for it.",
    look: look('#f3d36b', '#ddb44a', '#fbf6e9', '#e6dcc2', { foamScale: 0.6 }),
  },
  {
    id: 'bitter', name: 'Pint of Bitter', cost: D(100), mult: 1.5,
    flavour: 'Amber, honest and served at cellar temperature.',
    look: look('#d9822b', '#b4651c', '#f8efd9', '#e3d3b0'),
  },
  {
    id: 'best', name: 'Best Bitter', cost: D(2e4), mult: 2,
    flavour: 'Like bitter, but it went to grammar school.',
    look: look('#b8621b', '#93480f', '#f6ead0', '#dfcca6'),
  },
  {
    id: 'realale', name: 'Proper Real Ale', cost: D(2e6), mult: 2,
    flavour: 'Hand-pulled from the cask. Comes with a beard.',
    look: look('#c46f22', '#9d5416', '#f6ecd4', '#e2d2ad', { foamScale: 1.2, glass: 'tankard' }),
  },
  {
    id: 'ipa', name: 'Session IPA', cost: D(2e8), mult: 2,
    flavour: 'Hazy, hoppy and smells faintly of grapefruit.',
    look: look('#e9b54a', '#cf9733', '#fffaf0', '#ece2cc'),
  },
  {
    id: 'stout', name: 'Irish-style Stout', cost: D(2e10), mult: 3,
    flavour: 'Black as night, with a head you could stand a spoon in.',
    look: look('#1d1310', '#0e0907', '#efe3c8', '#d9c9a5', { foamScale: 1.6 }),
  },
  {
    id: 'dipa', name: 'Craft Double IPA', cost: D(2e12), mult: 3,
    flavour: 'Eight per cent, nine quid, served in a tulip.',
    look: look('#f2a33a', '#d4861f', '#fff6e2', '#eadbbd', { glass: 'tulip' }),
  },
  {
    id: 'barleywine', name: 'Barley Wine', cost: D(2e14), mult: 4,
    flavour: 'Ruby red and dangerously warming. Sip it. Or don\'t.',
    look: look('#8e2a1e', '#6a1c13', '#f1dcc4', '#d8bea0', { foamScale: 0.5, glass: 'snifter' }),
  },
  {
    id: 'reserve', name: "Landlord's Secret Reserve", cost: D(5e16), mult: 5,
    flavour: 'Kept under the bar. Glows slightly. Nobody asks why.',
    look: look('#e0a43c', '#bf8424', '#fff3d6', '#efd9a8', { glass: 'tankard', effect: 'glow', effectColour: '#ffd36b' }),
  },
  {
    id: 'moonmead', name: 'Moon Mead', cost: D(1e20), mult: 6,
    flavour: 'Brewed in low gravity. Pours upwards if you let it.',
    look: look('#cfd6e6', '#a9b3c9', '#ffffff', '#e1e6f2', { glass: 'tulip', effect: 'shimmer', effectColour: '#ffffff' }),
  },
  {
    id: 'darkmatter', name: 'Dark Matter Porter', cost: D(1e23), mult: 8,
    flavour: 'Makes up 85% of all beer in the universe. Nobody has ever seen it.',
    look: look('#0b0b16', '#241a3d', '#5b4a86', '#3d3160', { effect: 'void', effectColour: '#7a5cff' }),
  },
  {
    id: 'nectar', name: 'Nectar of the Gods', cost: D(1e27), mult: 10,
    flavour: 'Previously reserved for Olympus. They got barred.',
    look: look('#ffcf40', '#f0ad1c', '#fffbe8', '#fbecc0', { glass: 'snifter', effect: 'sparkle', effectColour: '#fff7c2' }),
  },
  {
    id: 'singularity', name: 'Singularity Stout', cost: D(1e32), mult: 15,
    flavour: 'Infinitely dense. The glass bends the light around it.',
    look: look('#05050a', '#16102a', '#2a2140', '#1a1430', { effect: 'singularity', effectColour: '#b48cff' }),
  },
  {
    id: 'quasar', name: 'Quasar Quadrupel', cost: D(1e37), mult: 15,
    flavour: 'Outshines entire galaxies. Also your judgement.',
    look: look('#c2571d', '#93400f', '#fff1dc', '#f2d9b4', { glass: 'tulip', effect: 'glow', effectColour: '#ffe1a8' }),
  },
  {
    id: 'pulsar', name: 'Pulsar Pilsner', cost: D(1e42), mult: 16,
    flavour: 'Crisp, clean, and blinks 700 times a second.',
    look: look('#f6e27a', '#dfc552', '#ffffff', '#e9eef7', { effect: 'shimmer', effectColour: '#cfe8ff' }),
  },
  {
    id: 'nebula', name: 'Nebula Hazy IPA', cost: D(1e47), mult: 16,
    flavour: 'Hazier than a nebula, which is saying something.',
    look: look('#e88fb4', '#b65f93', '#fff0f6', '#efd3e2', { glass: 'tulip', effect: 'sparkle', effectColour: '#ffd6f0' }),
  },
  {
    id: 'supernova', name: 'Supernova Saison', cost: D(1e52), mult: 17,
    flavour: 'Goes out with a bang. So will you.',
    look: look('#ff9a2e', '#e0661b', '#fff3d1', '#f6d79a', { effect: 'glow', effectColour: '#ffb347' }),
  },
  {
    id: 'wormhole', name: 'Wormhole Wheat Beer', cost: D(1e57), mult: 17,
    flavour: "You've finished it before you've ordered it.",
    look: look('#f0c96a', '#d1a443', '#fffaf0', '#efe4cb', { glass: 'tulip', effect: 'void', effectColour: '#57c7ff' }),
  },
  {
    id: 'antimatter', name: 'Antimatter Ale', cost: D(1e62), mult: 18,
    flavour: "Don't let it touch the normal beer.",
    look: look('#e9f6ff', '#b8d8f0', '#2b2b38', '#1c1c26', { glass: 'snifter', effect: 'glow', effectColour: '#9fe7ff' }),
  },
  {
    id: 'bigbang', name: 'Big Bang Bitter', cost: D(1e68), mult: 18,
    flavour: 'Where every other pint came from.',
    look: look('#d9822b', '#b4651c', '#fff6e0', '#ecd8b2', { effect: 'sparkle', effectColour: '#fff2b3' }),
  },
  {
    id: 'entropy', name: 'Entropy Export Stout', cost: D(1e74), mult: 19,
    flavour: 'Only ever gets more disordered. Like the pub at closing time.',
    look: look('#120c0a', '#2a1a12', '#d9cdb4', '#b9aa8c', { foamScale: 1.5, glass: 'tankard', effect: 'void', effectColour: '#ff7a59' }),
  },
  {
    id: 'higgs', name: 'Higgs Barley Wine', cost: D(1e80), mult: 19,
    flavour: 'Gives everything else its body.',
    look: look('#7d1e2a', '#5a131d', '#f3d9cf', '#d9b8ab', { foamScale: 0.5, glass: 'snifter', effect: 'shimmer', effectColour: '#ffc2d1' }),
  },
  {
    id: 'darkenergy', name: 'Dark Energy Dubbel', cost: D(1e86), mult: 20,
    flavour: 'Pushes the universe apart. Pulls the pub together.',
    look: look('#3a1424', '#240c16', '#c9a6b8', '#a3839a', { glass: 'tulip', effect: 'void', effectColour: '#ff5ca8' }),
  },
  {
    id: 'cosmicstring', name: 'Cosmic String Sour', cost: D(1e92), mult: 20,
    flavour: 'Puckering on eleven dimensions at once.',
    look: look('#d6e86a', '#aebf3f', '#fbffe6', '#e5ecc0', { glass: 'tulip', effect: 'shimmer', effectColour: '#f5ff9e' }),
  },
  {
    id: 'heatdeath', name: 'Heat Death Helles', cost: D(1e99), mult: 22,
    flavour: 'Served at exactly absolute zero.',
    look: look('#f4efd6', '#d9d1ae', '#ffffff', '#eef0f4', { effect: 'shimmer', effectColour: '#e6f4ff' }),
  },
  {
    id: 'schrodinger', name: "Schrödinger's Shandy", cost: D(1e106), mult: 22,
    flavour: "Both full and empty until you look. Don't look.",
    look: look('#f7d98b', '#dcb75e', '#ffffff', '#eae6dc', { effect: 'void', effectColour: '#7fffd4' }),
  },
  {
    id: 'planck', name: 'Planck-Length Porter', cost: D(1e113), mult: 24,
    flavour: 'The smallest possible measure. Somehow still a pint.',
    look: look('#2a1710', '#170c07', '#e8dcc4', '#c9b89a', { foamScale: 1.3, glass: 'tankard', effect: 'sparkle', effectColour: '#ffe9c2' }),
  },
  {
    id: 'paradox', name: 'Paradox Pale Ale', cost: D(1e120), mult: 24,
    flavour: 'You drank it tomorrow. It was lovely.',
    look: look('#f2b84b', '#d39430', '#fff8e6', '#eedfbd', { glass: 'snifter', effect: 'singularity', effectColour: '#8cf2ff' }),
  },
  {
    id: 'omniverse', name: 'Omniverse Old Ale', cost: D(1e128), mult: 25,
    flavour: 'Aged in every barrel that could ever exist.',
    look: look('#6e2c14', '#4d1d0b', '#f0dcc4', '#d4bb9c', { glass: 'tankard', effect: 'glow', effectColour: '#ffcf8a' }),
  },
  {
    id: 'eternity', name: 'Eternity Lager', cost: D(1e136), mult: 25,
    flavour: 'Never warms up. Never goes flat. Never ends.',
    look: look('#fff0a8', '#e8d277', '#ffffff', '#f2f2ea', { effect: 'sparkle', effectColour: '#ffffff' }),
  },
  {
    id: 'finalpint', name: 'The Final Pint', cost: D(1e145), mult: 30,
    flavour: "There's always one more.",
    look: look('#ffd24a', '#f0ad1c', '#fffdf2', '#fbefc6', { glass: 'tankard', effect: 'singularity', effectColour: '#ffe27a' }),
  },
];

// ---------- endless beers after the hand-written ones ----------

/** Each generated beer costs this many times the last and multiplies everything by GENERATED_MULT. */
export const GENERATED_COST_STEP = 1e8;
export const GENERATED_MULT = 3;

const PREFIXES = [
  'Hyper', 'Ultra', 'Omni', 'Quantum', 'Astral', 'Celestial', 'Primordial', 'Transcendent', 'Fractal', 'Chrono',
  'Void', 'Prism', 'Aurora', 'Zenith', 'Infinity', 'Eternal', 'Mythic', 'Radiant', 'Spectral', 'Stellar',
  'Galactic', 'Abyssal', 'Ethereal', 'Hadron', 'Photon', 'Tachyon', 'Neutrino', 'Graviton', 'Plasma', 'Comet',
  'Meteor', 'Solar', 'Lunar', 'Orbital', 'Nova', 'Hyperspace', 'Warp', 'Rift', 'Paradox', 'Dimensional',
];
const STYLES = [
  'Stout', 'Porter', 'Bitter', 'Mild', 'Pale Ale', 'IPA', 'Lager', 'Pilsner', 'Saison', 'Dubbel',
  'Tripel', 'Quadrupel', 'Barley Wine', 'Sour', 'Gose', 'Bock', 'Doppelbock', 'Kölsch', 'Märzen', 'Helles',
  'Wheat Beer', 'Red Ale', 'Brown Ale', 'Old Ale', 'Scotch Ale', 'Golden Ale', 'Black IPA', 'Cream Ale',
  'Smoked Beer', 'Lambic',
];
const SUFFIXES = ['', 'Reserve', 'Grand Cru', 'Double', 'Imperial', 'Cask Edition', 'Vintage', 'Barrel-Aged'];
const FLAVOURS = [
  'Brewed somewhere that technically does not exist.',
  'Tasting notes include "yes" and "more".',
  'The landlord swears it is the last one. It is not.',
  'Pairs well with an expanding universe.',
  'Awarded five stars by a civilisation of stars.',
  'Smells faintly of tomorrow.',
  'Served in a glass made of folded time.',
  'Nobody remembers ordering it. Everybody wants another.',
];
const GLASSES: GlassShape[] = ['nonic', 'tulip', 'snifter', 'tankard'];
const EFFECTS: BeerEffect[] = ['glow', 'shimmer', 'void', 'sparkle', 'singularity'];

/** Small deterministic hash so each generated beer always looks the same. */
function hash(n: number): number {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (k: number) => {
    const t = (k + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Name for the n-th generated beer. Every combination is used before any repeats. */
export function generatedBeerName(n: number): string {
  const total = PREFIXES.length * STYLES.length * SUFFIXES.length;
  const k = n % total;
  // Stride through prefixes and styles so neighbouring beers don't share words.
  const prefix = PREFIXES[(k * 7) % PREFIXES.length];
  // 11·(k + ⌊k/40⌋) mod 30 hits every style exactly once for each prefix, so names never collide.
  const style = STYLES[(11 * (k + Math.floor(k / PREFIXES.length))) % STYLES.length];
  const suffix = SUFFIXES[Math.floor(k / (PREFIXES.length * STYLES.length)) % SUFFIXES.length];
  const lap = Math.floor(n / total);
  return [prefix, style, suffix, lap > 0 ? `Mk ${lap + 1}` : ''].filter(Boolean).join(' ');
}

function generatedBeer(n: number): Beer {
  const h = hash(n);
  const hue = h % 360;
  const dark = (h >>> 9) % 4 === 0;
  const liquid = hsl(hue, 0.7, dark ? 0.12 : 0.55);
  return {
    id: `gen-${n}`,
    name: generatedBeerName(n),
    flavour: FLAVOURS[(h >>> 12) % FLAVOURS.length],
    cost: BEERS[BEERS.length - 1].cost.mul(Decimal.pow(GENERATED_COST_STEP, n + 1)),
    mult: GENERATED_MULT,
    look: look(liquid, hsl(hue, 0.7, dark ? 0.06 : 0.42), hsl(hue, 0.3, 0.95), hsl(hue, 0.25, 0.82), {
      glass: GLASSES[(h >>> 5) % GLASSES.length],
      effect: EFFECTS[(h >>> 7) % EFFECTS.length],
      effectColour: hsl((hue + 40) % 360, 0.9, 0.75),
      foamScale: dark ? 1.4 : 1,
    }),
  };
}

/** The beer at any index: hand-written first, then generated forever. */
export function beerAt(index: number): Beer {
  return index < BEERS.length ? BEERS[index] : generatedBeer(index - BEERS.length);
}

/** Product of every beer's multiplier up to and including `index`. */
export function beerMultUpTo(index: number): Decimal {
  const hand = BEERS.slice(0, Math.min(index, BEERS.length - 1) + 1).reduce((m, b) => m * b.mult, 1);
  const generated = Math.max(0, index - (BEERS.length - 1));
  return D(hand).mul(Decimal.pow(GENERATED_MULT, generated));
}
