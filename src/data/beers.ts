import { D, Decimal } from '../core/num';

export type GlassShape =
  | 'nonic' | 'tulip' | 'snifter' | 'tankard'
  /** A half-pint tumbler, a small straight Kölsch glass, a tall wheat-beer glass. */
  | 'half' | 'stange' | 'weizen'
  /** A stemmed chalice, a thistle, a litre stein, a yard glass, a drinking horn. */
  | 'goblet' | 'thistle' | 'mass' | 'yard' | 'horn';

export type BeerEffect =
  | 'none' | 'glow' | 'shimmer' | 'void' | 'sparkle' | 'singularity'
  /** A stout settling: pale streaks sinking down the inside of the glass. */
  | 'cascade'
  /** The whole glass is head, with a little beer underneath. */
  | 'allfoam'
  /** A shot glass sunk in the beer. */
  | 'shot'
  /** Wisps rising off the top: steam, or smoke. */
  | 'steam' | 'smoke'
  /** Blobs of beer drifting up out of the glass. */
  | 'float'
  /** Bubbles that go down instead of up. */
  | 'sink'
  /** There one moment, not the next. */
  | 'flicker';

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
  /** How big the glass is next to a pint (a half is smaller, a Maß bigger). */
  size?: number;
  /** What it's made of, if it isn't glass (horn, pewter, stone): you can't see the beer through it. */
  vessel?: string;
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

/**
 * Bought in order: what you'd find in a pub, then what you'd find abroad, then what you'd find
 * nowhere at all. Twenty-seven beers, each in its own glass or with its own trick, and then no
 * more: The Final Pint is the last one.
 */
export const BEERS: Beer[] = [
  {
    id: 'shandy', name: 'Half of Shandy', cost: D(0), mult: 1,
    flavour: 'Half lemonade, in a half-pint glass. Everybody starts somewhere.',
    look: look('#f6e08a', '#e6c95e', '#ffffff', '#ece6d2', { glass: 'half', size: 0.78, foamScale: 0.5 }),
  },
  {
    id: 'bitter', name: 'Pint of Bitter', cost: D(100), mult: 1.5,
    flavour: 'Amber, honest and served at cellar temperature.',
    look: look('#d9822b', '#b4651c', '#f8efd9', '#e3d3b0'),
  },
  {
    id: 'mild', name: 'Pint of Mild', cost: D(2e4), mult: 2,
    flavour: 'Dark, flat and four per cent. The old boys swear by it.',
    look: look('#5a2f1a', '#3f1f10', '#e8d9b8', '#cdbb94', { foamScale: 0.45 }),
  },
  {
    id: 'nitro', name: 'Nitro Stout', cost: D(2e6), mult: 2,
    flavour: 'Black, with a head like cream. Wait for it to settle.',
    look: look('#1a1210', '#0c0807', '#f0e2c4', '#d8c7a2', { foamScale: 1.35, effect: 'cascade' }),
  },
  {
    id: 'hazy', name: 'Hazy IPA', cost: D(2e8), mult: 2,
    flavour: 'Looks like orange juice. Smells like a fruit bowl. Costs like a mortgage.',
    look: look('#f0a53a', '#d98a22', '#fbf3df', '#e6d8b6', { glass: 'tulip', foamScale: 0.9 }),
  },
  {
    id: 'kolsch', name: 'Kölsch', cost: D(2e10), mult: 3,
    flavour: 'A tiny glass, gone in two sips, replaced before you can say no.',
    look: look('#f4dc78', '#e0c456', '#ffffff', '#ebe5d0', { glass: 'stange', size: 0.9, foamScale: 0.8 }),
  },
  {
    id: 'hladinka', name: 'Czech Hladinka', cost: D(2e12), mult: 3,
    flavour: 'The proper pour: golden lager under three fingers of dense, wet foam.',
    look: look('#eab93a', '#cf9c22', '#fffdf4', '#ece2c4', { glass: 'tankard', foamScale: 2.4 }),
  },
  {
    id: 'mliko', name: 'Czech Mlíko', cost: D(2e14), mult: 2.5,
    flavour: 'A whole glass of sweet foam, with a rumour of beer at the bottom. Down in one.',
    look: look('#eab93a', '#cf9c22', '#fffaea', '#efe3c4', { glass: 'tankard', foamScale: 1.6, effect: 'allfoam' }),
  },
  {
    id: 'hefeweizen', name: 'Hefeweizen', cost: D(1e17), mult: 1.8,
    flavour: 'Cloudy, tall, and tastes of banana, apparently on purpose.',
    look: look('#f2c14e', '#dba636', '#fffdf2', '#eee2c0', { glass: 'weizen', size: 1.16, foamScale: 1.9 }),
  },
  {
    id: 'mass', name: 'German Maß', cost: D(1e20), mult: 1.8,
    flavour: 'A litre. One hand. No excuses.',
    look: look('#f0b23a', '#d6962a', '#fffbec', '#ecdfbe', { glass: 'mass', size: 1.22, foamScale: 1.5 }),
  },
  {
    id: 'tripel', name: 'Trappist Tripel', cost: D(1e23), mult: 3,
    flavour: 'Brewed by monks. Nine per cent. They know what they are doing.',
    look: look('#f0c040', '#d6a428', '#fffdf4', '#efe4c2', { glass: 'goblet', foamScale: 1.4 }),
  },
  {
    id: 'heavy', name: 'Scotch Heavy', cost: D(1e26), mult: 5,
    flavour: 'Copper-coloured, malty, and served with a look that dares you to ask for ice.',
    look: look('#a8481c', '#84330f', '#f3e3c2', '#d9c69c', { glass: 'thistle' }),
  },
  {
    id: 'warmer', name: 'Cask Winter Warmer', cost: D(1e29), mult: 7,
    flavour: 'Ruby dark and served by the fire. There is always a fire.',
    look: look('#6a1f1a', '#4a120e', '#f0dcc0', '#d6bf9a', { glass: 'tankard', effect: 'steam', effectColour: '#f3efe4' }),
  },
  {
    id: 'somaek', name: 'Somaek', cost: D(1e31), mult: 12,
    flavour: 'A shot of soju, dropped in the beer. One shot!',
    look: look('#f3d36b', '#ddb44a', '#fbf6e9', '#e6dcc2', { effect: 'shot', effectColour: '#dff4e6' }),
  },
  {
    id: 'sakebomb', name: 'Sake Bomb', cost: D(1e33), mult: 20,
    flavour: 'Bang the table. The cup falls in. Everybody drinks.',
    look: look('#f0c860', '#d8ac40', '#fffdf4', '#ece2c4', { foamScale: 1.4, effect: 'shot', effectColour: '#ffffff' }),
  },
  {
    id: 'yard', name: 'Yard of Ale', cost: D(1e35), mult: 22,
    flavour: 'Three feet of glass with a bulb at the end. It all arrives at once.',
    look: look('#d9822b', '#b4651c', '#f8efd9', '#e3d3b0', { glass: 'yard', size: 1.42, foamScale: 0.7 }),
  },
  {
    id: 'mead', name: 'Viking Mead', cost: D(1e37), mult: 28,
    flavour: 'Honey, water and time, drunk from the horn of something large.',
    look: look('#f2b23c', '#d4922a', '#fff6dc', '#e8d8ac', { glass: 'horn', foamScale: 0.6, vessel: '#e9dcc0' }),
  },
  {
    id: 'grog', name: 'Grog', cost: D(1e39), mult: 35,
    flavour: 'Rum, water and whatever was in the barrel before. Do not look into the tankard.',
    look: look('#6a4a2a', '#4a321a', '#d8c8a8', '#b8a684', { glass: 'tankard', foamScale: 0.5, vessel: '#8d9299' }),
  },
  {
    id: 'dwarven', name: 'Dwarven Stout', cost: D(1e41), mult: 40,
    flavour: 'Mined, not brewed. The head has to be chiselled.',
    look: look('#120c0a', '#080504', '#e0c89a', '#bfa678', { glass: 'tankard', foamScale: 1.5, vessel: '#77716c' }),
  },
  {
    id: 'fairy', name: 'Fairy Cider', cost: D(1e43), mult: 45,
    flavour: 'A thimbleful. It is stronger than it looks, and it is watching you.',
    look: look('#c8f08a', '#a6d466', '#fdfff2', '#e2edc8', { glass: 'tulip', size: 0.7, effect: 'sparkle', effectColour: '#ffd6fa' }),
  },
  {
    id: 'dragon', name: "Dragon's Breath Ale", cost: D(1.5e45), mult: 50,
    flavour: 'Served smoking. Sip, do not sniff.',
    look: look('#e0401a', '#b02a0c', '#ffe0a8', '#e8b878', { glass: 'snifter', effect: 'smoke', effectColour: '#ff7a2a' }),
  },
  {
    id: 'moonmead', name: 'Moon Mead', cost: D(3e47), mult: 55,
    flavour: 'Brewed in one-sixth gravity. It keeps trying to leave the glass.',
    look: look('#c8d8f0', '#9fb6dc', '#ffffff', '#dfe8f6', { glass: 'snifter', effect: 'float', effectColour: '#dfeaff' }),
  },
  {
    id: 'alien', name: 'Alien Lager', cost: D(3e49), mult: 64,
    flavour: 'Luminous. The bubbles go down. The label says not to worry.',
    look: look('#7dff5a', '#4fd838', '#f2ffe8', '#cdeebc', { effect: 'sink', effectColour: '#b8ff7a' }),
  },
  {
    id: 'darkmatter', name: 'Dark Matter Porter', cost: D(5e51), mult: 73,
    flavour: 'Makes up 85% of all beer in the universe. Nobody has ever seen it.',
    look: look('#0b0b16', '#241a3d', '#5b4a86', '#3d3160', { effect: 'void', effectColour: '#7a5cff' }),
  },
  {
    id: 'schrodinger', name: "Schrödinger's Pint", cost: D(1e54), mult: 82,
    flavour: 'Both full and empty until somebody drinks it.',
    look: look('#e0a030', '#bd8220', '#fbf6e9', '#e6dcc2', { effect: 'flicker', effectColour: '#9fe7ff' }),
  },
  {
    id: 'singularity', name: 'Singularity Stout', cost: D(3e56), mult: 92,
    flavour: 'Infinitely dense. The glass bends the light around it.',
    look: look('#05050a', '#16102a', '#2a2140', '#1a1430', { effect: 'singularity', effectColour: '#b48cff' }),
  },
  {
    id: 'final', name: 'The Final Pint', cost: D(1e59), mult: 140,
    flavour: 'After all that: a perfectly ordinary, perfectly poured pint. It was this all along.',
    look: look('#f6b93a', '#dc9a22', '#fffdf4', '#ece2c4', { foamScale: 1.1, effect: 'glow', effectColour: '#ffe27a' }),
  },
];

/** The beer at an index. Past the end of the list there is only The Final Pint. */
export function beerAt(index: number): Beer {
  return BEERS[Math.max(0, Math.min(index, BEERS.length - 1))];
}

/** Product of every beer's multiplier up to and including `index`. */
export function beerMultUpTo(index: number): Decimal {
  return D(BEERS.slice(0, Math.min(index, BEERS.length - 1) + 1).reduce((m, b) => m * b.mult, 1));
}
