/**
 * The crowd: one rigged character per drinker, built from a shared body with its own hair, hat,
 * face, clothes and drink. Each one breathes, blinks, sips, chats, laughs and cheers on its own
 * timer, and most types have a party piece of their own.
 *
 * Local coordinates: x across, y up is negative. The head is centred on (0, -62) and the body
 * carries on down past y = 0 so the bar (or the row in front) can cut it off anywhere.
 */
import {
  TAU, alpha, approach, arc, at, backOut, blob, blobPath, capsule, circle, clamp, curve, ellipse, glow, hash, lerp, line,
  mix, poly, rect, rng, shade, smooth, tint, type Ctx,
} from './draw';

type Hair = 'bald' | 'short' | 'side' | 'long' | 'bun' | 'afro' | 'mohawk' | 'greySides' | 'curly' | 'bob' | 'quiff' | 'swept';
type Hat = 'none' | 'horned' | 'tricorn' | 'akubra' | 'ushanka' | 'hachimaki' | 'tyrolean' | 'flatcap' | 'mortarboard' | 'cone' | 'antlers' | 'scrumcap' | 'bobble' | 'bucket' | 'hanky'
  | 'crown' | 'party' | 'helmet' | 'antennae' | 'stalks' | 'cap';
type Face = 'plain' | 'glasses' | 'shades' | 'patch' | 'cyclops' | 'three' | 'void' | 'grey' | 'stalks';
type Beard = 'none' | 'moustache' | 'full' | 'stubble' | 'goatee';
type Pattern = 'none' | 'jumper' | 'tartan' | 'furcoat' | 'zip' | 'maosuit' | 'plaid' | 'germany' | 'lederhosen' | 'hoops' | 'stripes' | 'flames' | 'tie' | 'lanyard' | 'sash' | 'lplate' | 'unionjack' | 'vest'
  | 'hawaiian' | 'suit' | 'cardigan' | 'print' | 'stars' | 'hoodie' | 'tiedye';
type Drink = 'pint' | 'can' | 'flute' | 'tankard' | 'tasting' | 'cocktail' | 'shot' | 'bottle' | 'mass' | 'horn';
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
  /** How much belly, for those known for it (otherwise it varies from person to person). */
  belly?: number;
  /** Woad down one side of the face. */
  paint?: string;
  freckles?: boolean;
  /** A permanent glow in the cheeks. */
  flush?: number;
  /** A swollen skull over a small chin, as seen at Roswell. */
  bigHead?: boolean;
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
  // ----- locals: the people you find in pubs abroad -----
  aussie: (r) => ({
    skin: pick(r, ['#e0a878', '#d99a6c', '#c98a5c']), shirt: pick(r, ['#2f7fb0', '#d9a22a', '#3f8f5a']), pattern: 'vest', shortSleeves: true,
    // Cropped, so nothing sticks out through the hat.
    hair: 'bald', hairColour: pick(r, ['#d9b565', '#b07c38', '#7b4b24']), hat: 'akubra',
    hatColour: pick(r, ['#a8875a', '#8a6a44']), hatAccent: '#3a2a1c', beard: pick(r, ['stubble', 'none', 'goatee']),
    face: r() < 0.4 ? 'shades' : 'plain', drink: 'can', drinkColour: pick(r, ['#f2c21c', '#1f7a3a']), belly: r() * 3, special: 'dance',
  }),
  irish: (r) => {
    const hair = pick(r, ['#9a4a26', '#8a4222', '#a85a30']);
    const capped = r() < 0.5;
    return {
      skin: pick(r, ['#f2cdb2', '#efc6aa']), shirt: pick(r, ['#efe6d2', '#2f7a4a', '#e9dcc0']), pattern: 'jumper', patternColour: '#cfc3a6',
      hair: capped ? 'short' : pick(r, ['side', 'short', 'quiff']), hairColour: hair, hat: capped ? 'flatcap' : 'none',
      hatColour: pick(r, ['#4a5a42', '#5d4a3a']), beard: pick(r, ['stubble', 'goatee', 'none', 'full']), freckles: true, flush: 0.15,
      drink: 'pint', drinkColour: '#1d1310', special: 'dance',
    };
  },
  scot: (r) => ({
    skin: pick(r, ['#f2c9a8', '#ecbc98']), shirt: pick(r, ['#4a3a2c', '#3a3f34']), pattern: 'tartan',
    patternColour: pick(r, ['#2f5a3a', '#24408e', '#8a2a2a']), patternColour2: pick(r, ['#c8323a', '#f2c94c']), build: 1.22,
    hair: 'long', hairColour: pick(r, ['#7b4b24', '#a23d24', '#47301f']), beard: pick(r, ['stubble', 'none']), paint: '#2f62c8',
    drink: 'tankard', special: 'dance',
  }),
  russian: (r) => ({
    skin: pick(r, ['#f2cdb0', '#eabf9e']), shirt: pick(r, ['#3a4a3a', '#4a4038', '#2e3a4a']), pattern: 'furcoat', patternColour: '#8a7a6a',
    hair: 'short', hairColour: pick(r, HAIRS.slice(0, 4)), hat: 'ushanka', hatColour: pick(r, ['#6a5a4c', '#8a8076', '#3e3a36']),
    hatAccent: '#d8263a', beard: pick(r, ['moustache', 'stubble', 'none']), flush: 0.3, build: 1.15, drink: 'shot', drinkColour: '#e6f2f7',
  }),
  // A gentleman in the green suit and swept-back hair made famous by a certain Chairman.
  uncle: (r) => ({
    skin: pick(r, ['#f0c9a0', '#ecc296']), shirt: pick(r, ['#6f7f5a', '#66785a', '#74805c']), pattern: 'maosuit',
    hair: 'swept', hairColour: '#17130f', belly: 3 + r() * 2, build: 1.1, flush: 0.2, drink: 'shot', drinkColour: '#f4f8fa',
  }),
  salaryman: (r) => ({
    skin: pick(r, ['#f4d2b0', '#efc7a2']), shirt: '#f3f1ec', jacket: pick(r, ['#2a3040', '#33343c', '#27303a']), pattern: 'tie',
    patternColour: pick(r, ['#c8323a', '#2f5fae', '#8a2a6a']), hair: pick(r, ['side', 'short']), hairColour: '#17130f',
    hat: 'hachimaki', hatColour: '#f6f3ea', hatAccent: '#d8263a', face: r() < 0.5 ? 'glasses' : 'plain', flush: 0.6,
    drink: 'tankard', special: 'dance',
  }),
  czech: (r) => ({
    skin: pick(r, ['#f4cfae', '#ecbc98']), shirt: pick(r, ['#b8322c', '#2f5a8a', '#3f6a3a']), pattern: 'plaid', patternColour: '#f2ead8',
    patternColour2: '#1c1a22', hair: pick(r, ['short', 'side', 'bald']), hairColour: pick(r, HAIRS.slice(0, 4)),
    beard: pick(r, ['moustache', 'moustache', 'stubble']), belly: 3 + r() * 3, drink: 'tankard', drinkColour: '#e6b030',
  }),
  german: (r) => ({
    skin: pick(r, ['#f4cfae', '#f7d9c0']), shirt: '#f4f2ee', pattern: 'germany', shortSleeves: true,
    hair: pick(r, ['short', 'quiff', 'side']), hairColour: pick(r, ['#d9b565', '#b07c38', '#7b4b24']), face: r() < 0.4 ? 'glasses' : 'plain',
    beard: pick(r, ['moustache', 'none', 'stubble']), hat: r() < 0.35 ? 'bucket' : 'none', hatColour: '#1c1c22', hatAccent: '#f2c21c',
    belly: r() * 4, drink: 'pint', drinkColour: '#f0c040', special: 'scarf', scarf: '#1c1c22', patternColour2: '#f2c21c',
  }),
  bavarian: (r) => ({
    skin: pick(r, ['#f4cfae', '#f0c4a0']), shirt: pick(r, ['#e9eef6', '#f1e9e2']), pattern: 'lederhosen', patternColour: '#6a4326',
    patternColour2: pick(r, ['#3f7fc8', '#c8323a', '#3f8f5a']), hair: pick(r, ['short', 'greySides', 'side']),
    hairColour: pick(r, ['#8d8d8f', '#7b4b24', '#d9b565']), hat: 'tyrolean', hatColour: pick(r, ['#2f5a3a', '#4a4a44', '#3a4a2c']),
    hatAccent: '#f2ead8', beard: 'moustache', belly: 4 + r() * 3, flush: 0.3, build: 1.12, drink: 'mass', drinkColour: '#f0b83a', special: 'dance',
  }),
  viking: (r) => ({
    skin: pick(r, ['#f4cfae', '#f0c4a0']), shirt: pick(r, ['#5a4a3a', '#4a5a4a', '#6a3a2e']), pattern: 'furcoat', patternColour: pick(r, ['#8a6a4a', '#b8a88a']),
    hair: 'long', hairColour: pick(r, ['#d9b565', '#c2562a', '#b07c38']), hat: 'horned', hatColour: '#8a8f98', hatAccent: '#f1ead9',
    beard: 'full', build: 1.28, belly: 2, drink: 'horn', drinkColour: '#e6b030', special: 'dance',
  }),
  korean: (r) => ({
    // Straight from the office or straight off the mountain, in a hiking jacket either way.
    skin: pick(r, ['#f4d2b0', '#efc7a2']), shirt: pick(r, ['#e8432c', '#2f8fd0', '#8a3fb0', '#2fa87a']), pattern: 'zip',
    patternColour: pick(r, ['#1c1c22', '#f4f1e8', '#f2c21c']), hair: pick(r, ['short', 'side', 'curly', 'bob']), hairColour: '#17130f',
    face: r() < 0.45 ? 'glasses' : 'plain', flush: 0.5, drink: 'bottle', drinkColour: '#3f9a4a', special: 'dance',
  }),
  pirate: (r) => ({
    skin: pick(r, ['#d99a6c', '#c98a5c', '#e8b48f']), shirt: '#f1ead9', jacket: pick(r, ['#3a2a3a', '#5a1f24', '#1f3a4a']), pattern: 'hoops',
    patternColour: pick(r, ['#c8323a', '#24408e']), hair: 'long', hairColour: pick(r, ['#17130f', '#47301f', '#7b4b24']), hat: 'tricorn',
    hatColour: '#1c1a22', hatAccent: '#e0b85a', face: 'patch', beard: pick(r, ['full', 'goatee', 'stubble']), drink: 'tankard',
    drinkColour: '#8a4a22', special: 'dance',
  }),
  // ----- the locals at The Little Green Man -----
  grey: (r) => ({
    skin: pick(r, ['#b4bcc0', '#a8b4b0', '#c2c4cc']), shirt: pick(r, ['#c9d0dc', '#aeb8c8']), pattern: 'zip', patternColour: '#5cf0ff',
    hair: 'bald', hairColour: '#000000', face: 'grey', bigHead: true, drink: 'pint', special: 'spark', glow: '#9fe7ff', build: 0.9,
  }),
  greenman: (r) => ({
    skin: pick(r, ['#6fcf62', '#5cc27a', '#8ad45a']), shirt: '#e9e1cf', jacket: pick(r, ['#6b5a48', '#4e5a4a', '#40506a']), hair: 'bald',
    hairColour: '#000000', hat: 'flatcap', hatColour: pick(r, ['#5d4a3a', '#6a5a4a', '#3f4550']), face: 'grey', pattern: 'tie',
    patternColour: pick(r, ['#8c2d22', '#34406a']), drink: 'tankard', build: 0.94,
  }),
  stalks: (r) => ({
    skin: pick(r, ['#ff9a6a', '#f07ab0', '#e8c24a']), shirt: pick(r, ['#2f8fd0', '#6c3fa0', '#1f8a7a']), pattern: 'stars',
    patternColour: '#ffe15c', hair: 'bald', hairColour: '#000000', hat: 'stalks', face: 'stalks', drink: 'cocktail',
    drinkColour: pick(r, ['#7affc1', '#7ad7ff']), special: 'dance', shortSleeves: true,
  }),
  /** You. */
  hero: () => ({
    skin: '#f1c6a0', shirt: '#f4eddc', jacket: '#3f5f73', hair: 'greySides', hairColour: '#e8e3da', hat: 'flatcap',
    hatColour: '#6b7355', beard: 'moustache', pattern: 'cardigan', patternColour: '#9a2f28', build: 1.08,
  }),
};

/** How the player's figure is posed from outside: the hand follows the pint, the face follows the drinking. */
export interface Puppet {
  /** Which layer to draw: everything behind the bar, the drinking arm, or the fingers over the glass. */
  part: 'body' | 'arm' | 'fingers';
  /** Where the drinking hand is, in the figure's own coordinates. */
  hx: number;
  hy: number;
  /** Rotation of whatever the hand is holding. */
  tilt: number;
}

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

/** Tops that are a plain T-shirt or jumper at the neck (the rest draw collars of their own). */
const CREW_NECKS = new Set<Pattern>(['none', 'print', 'tiedye', 'sash', 'lplate', 'stars', 'lanyard']);

/** Drinks are drawn this much bigger than their own coordinates. */
const DRINK_SCALE = 1.4;

/**
 * How each kind of drink is held, relative to the hand: where the middle of the glass sits
 * (gx, gy), its half-width and the height of its rim, all in figure units.
 */
const GRIPS: Record<Drink, { gx: number; gy: number; half: number; top: number; stem?: boolean; handle?: boolean }> = {
  pint: { gx: -5.6, gy: -1, half: 7, top: -15.4 },
  tasting: { gx: -3.8, gy: -1, half: 5, top: -11.2 },
  can: { gx: -4.4, gy: -1, half: 5.6, top: -12.6 },
  // The tankard's handle is on the arm's side, and that's what gets held.
  tankard: { gx: -13.6, gy: -1, half: 7.8, top: -15.4, handle: true },
  flute: { gx: 0, gy: 1.5, half: 4.8, top: -23.8, stem: true },
  cocktail: { gx: 0, gy: 1.5, half: 10.5, top: -21, stem: true },
  shot: { gx: -2.2, gy: 0, half: 3.6, top: -8.4 },
  bottle: { gx: -2.8, gy: -1, half: 4.2, top: -24 },
  // A litre of it: held, like a tankard, by the handle.
  mass: { gx: -16.4, gy: -1, half: 9.8, top: -19.2, handle: true },
  horn: { gx: -1, gy: 1, half: 6, top: -19 },
};
const UPPER = 21, FORE = 20;

/** Where a steady elbow settles when the hand is tucked in by the shoulder (radians, 0 = forwards, positive = down). */
const STEADY_ELBOW = 0.7;

/**
 * Two-bone IK. Of the two ways the arm could bend, pick the one whose elbow is further out
 * (`side` = ±1) and lower.
 *
 * With `steady`, always bend the same way round instead (1 = clockwise from shoulder to hand,
 * -1 = anticlockwise). Picking "the lower one" each frame flips between the two bends as the
 * hand passes the shoulder, which makes a moving arm flop, or leaves a drinker's elbow in the air.
 */
function elbow(sx: number, sy: number, hx: number, hy: number, side: number, steady: -1 | 0 | 1 = 0): [number, number] {
  const dx = hx - sx, dy = hy - sy;
  const d = clamp(Math.hypot(dx, dy), 0.01, UPPER + FORE - 0.01);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1));
  if (steady) {
    // With the hand almost on the shoulder (a glass at the lips) the bend direction is barely
    // defined and swings wildly as the hand shifts, so ease towards a fixed, natural angle
    // there: elbow out in front and down.
    const w = smooth((16 - d) / 12);
    const ik = base + a * steady;
    if (w <= 0) return [sx + UPPER * Math.cos(ik), sy + UPPER * Math.sin(ik)];
    let diff = STEADY_ELBOW - ik;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const th = ik + diff * w;
    return [sx + UPPER * Math.cos(th), sy + UPPER * Math.sin(th)];
  }
  const e1: [number, number] = [sx + UPPER * Math.cos(base + a), sy + UPPER * Math.sin(base + a)];
  const e2: [number, number] = [sx + UPPER * Math.cos(base - a), sy + UPPER * Math.sin(base - a)];
  return (e1[0] - e2[0]) * side + (e1[1] - e2[1]) * 0.6 > 0 ? e1 : e2;
}

/** Every character there is a wardrobe for (drinkers, locals and the player). */
export const LOOK_IDS = Object.keys(LOOKS);

export class Figure {
  readonly look: Look;
  x = 0;
  /** World y of the head's centre. */
  headY = 150;
  scale = 1;
  flip = 1;
  row = 0;
  tone: Tone = { fog: '#000000', amount: 0, dim: 0 };
  /** 0..1, how weightless the room is (set by the stage for places with no floor). */
  adrift = 0;

  private phase: number;
  private rand: () => number;
  private action: Action = 'idle';
  private actionT = 0;
  private actionDur = 1;
  private wait: number;
  private blink = 0;
  private blinkIn: number;
  private level = 1;
  /** A fresh one is being poured. */
  private topUp = false;
  /** The drink's surface: how far it has swung off level, and how fast it is swinging. */
  private slosh = 0;
  private sloshV = 0;
  private glassTilt = 0;
  private lastGlassTilt = 0;
  private leaving = false;
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
  // Each person's own build: how much belly, how strong a jaw, how much nose.
  private belly: number;
  private jaw: number;
  private nose: number;

  constructor(readonly id: string, readonly seed: number) {
    this.rand = rng(seed * 7919 + 13);
    this.look = (LOOKS[id] ?? LOOKS.regular)(rng(seed * 104729 + id.length * 31 + id.charCodeAt(0)));
    this.phase = this.rand() * TAU;
    this.wait = 0.5 + this.rand() * 4;
    this.blinkIn = 1 + this.rand() * 4;
    this.level = 0.3 + this.rand() * 0.7;
    const b = rng(seed * 31 + 7);
    this.belly = b() < 0.45 ? b() * 5 : 0;
    this.jaw = (b() - 0.4) * 2.4;
    this.nose = (b() - 0.4) * 2.2;
    if (this.look.belly !== undefined) this.belly = this.look.belly;
    if (id === 'hero') {
      this.belly = 3.5;
      this.jaw = 0.8;
      this.nose = 1.6;
    }
  }

  /** Foam left on the moustache (0..1). */
  foam = 0;

  /**
   * Draw this figure as a puppet: no behaviour of its own, just the expression and hand it's given.
   * `sip` (0..1) tips the head back and shuts the eyes; `ahh` (0..1) opens the mouth.
   */
  drawPuppet(ctx: Ctx, t: number, p: Puppet, face: { sip: number; ahh: number; flush: number }) {
    this.enter = 1;
    this.sip = face.sip;
    this.laugh = face.ahh;
    this.talk = this.cheerV = this.special = 0;
    this.flush = face.flush;
    ctx.save();
    ctx.translate(this.x, this.headY - HEAD_Y * this.scale);
    ctx.scale(this.scale * this.flip, this.scale);
    this.body(ctx, t, this.look, false, p);
    ctx.restore();
  }

  /** Blinking and glancing about, for a puppet (which skips `update`). */
  tick(dt: number) {
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 1;
      this.blinkIn = 1.8 + this.rand() * 4.5;
      this.gazeTarget = (this.rand() - 0.3) * 1.6;
    }
    this.blink = Math.max(0, this.blink - dt / 0.16);
    this.gaze = approach(this.gaze, this.gazeTarget, 4, dt);
  }

  /** World point → this figure's own coordinates. */
  toLocal(wx: number, wy: number): [number, number] {
    return [((wx - this.x) / this.scale) * this.flip, (wy - (this.headY - HEAD_Y * this.scale)) / this.scale];
  }

  private flush = 0;

  /** Dev: hold one pose indefinitely. */
  held: Action | 'cheer' | null = null;
  /** Dev: how far through a held sip (0 = glass at rest, 1 = at the lips). */
  holdAt = 1;

  /** Start hidden and pop up after `delay` seconds. */
  arrive(delay: number) {
    this.enter = 0;
    this.enterDelay = delay;
  }

  /** Time to go: duck out the way they came in. */
  leave() {
    this.leaving = true;
  }

  /** Left, and out of sight. */
  get gone() {
    return this.leaving && this.enter <= 0;
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
    if (this.leaving) this.enter = Math.max(0, this.enter - dt / 0.5);
    else if (this.enterDelay > 0) this.enterDelay -= dt;
    else this.enter = Math.min(1, this.enter + dt / 0.55);

    // The drink: it goes down while the glass is at the lips, and comes back up when a fresh one
    // is poured. Its surface swings against the way the glass is moving, then settles.
    if (this.topUp) {
      this.level = Math.min(1, this.level + dt / 0.9);
      if (this.level >= 1) this.topUp = false;
    } else if (this.sip > 0.8) this.level = Math.max(0, this.level - dt * 0.2);
    if (dt > 0) {
      const drive = clamp(((this.glassTilt - this.lastGlassTilt) / dt) * 0.12, -0.5, 0.5);
      this.lastGlassTilt = this.glassTilt;
      this.sloshV += (-(this.slosh - drive) * 90 - this.sloshV * 7) * dt;
      this.slosh = clamp(this.slosh + this.sloshV * dt, -0.5, 0.5);
    }

    // Blink.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 1;
      this.blinkIn = 1.6 + this.rand() * 4.5;
    }
    this.blink = Math.max(0, this.blink - dt / 0.16);

    if (this.held) {
      // Held in one pose (for checking the art): keep the action at its midpoint.
      this.action = this.held === 'cheer' ? 'idle' : this.held;
      this.actionDur = 2.6;
      this.actionT = this.held === 'special' ? 0.9 + ((this.actionT + dt) % 1.2) : 1.3;
      this.wait = 9;
      if (this.held === 'cheer') {
        this.cheerT = 0.5;
        this.cheerDelay = 0;
      }
    }

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
        // Nearly empty: someone's got the next round in.
        if (this.action === 'sip' && this.level <= 0.12) this.topUp = true;
        this.action = 'idle';
        this.wait = 1 + this.rand() * 5;
      }
    }

    let cheer = 0;
    if (this.cheerT >= 0) {
      if (this.cheerDelay > 0) this.cheerDelay -= dt;
      else {
        this.cheerT += dt;
        if (this.held === 'cheer') this.cheerT = 0.5;
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
    if (this.held === 'sip') this.sip = this.holdAt;
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
    if (this.adrift) {
      // No floor to speak of: everyone hangs where they are, turning slowly.
      bob += (Math.sin(t * 0.47 + ph * 1.7) * 8 - 5) * this.adrift;
      sway += (Math.sin(t * 0.31 + ph * 2.3) * 0.17 + Math.sin(t * 0.83 + ph) * 0.05) * this.adrift;
    }
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

  /** Outline colour for a fill: the same hue, much darker, so lines belong to what they draw. */
  private edge = (c: string): string => this.k(mix(c, '#1d0f1c', 0.62));

  /** Fill the current path and give it an outline. */
  private ink(ctx: Ctx, fill: string, edge: string, width = 1.05) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /** Several shapes drawn as one: outlined together round the outside, with no lines where they join. */
  private merged(ctx: Ctx, edge: string, parts: [() => void, string][], width = 1.05) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width * 2;
    ctx.lineJoin = 'round';
    for (const [path] of parts) {
      path();
      ctx.stroke();
    }
    for (const [path, fill] of parts) {
      path();
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  private body(ctx: Ctx, t: number, L: Look, still = false, pup?: Puppet) {
    const k = this.k;
    const ph = this.phase;
    const w = 17.5 * (L.build ?? 1);
    const belly = this.belly;
    const skin = k(L.skin), skinSh = k(shade(L.skin, 0.18));
    const top = L.jacket ?? L.shirt;
    const cloth = k(top), clothSh = k(shade(top, 0.26)), clothHi = k(tint(top, 0.07));
    const eCloth = this.edge(top), eSkin = this.edge(L.skin);
    const sip = still ? 0 : this.sip, cheer = still ? 0 : this.cheerV, special = still ? 0 : this.special;
    const talk = still ? 0 : this.talk, laugh = still ? 0 : this.laugh;
    const breath = still ? 0 : Math.sin(t * 1.7 + ph) * 0.5;
    const sp = L.special;

    const ringed = L.glow && L.face === 'void' && !pup ? L.glow : null;
    if (ringed) {
      // A faint light of its own, so it can be found in a dark room; then the far half of its ring.
      const seen = 1 - this.tone.amount * 0.5;
      glow(ctx, 0, HEAD_Y, 38, ringed, 0.34 * seen);
      glow(ctx, 0, -26, 44, ringed, 0.2 * seen, 1.3);
      this.halo(ctx, t, ringed, false);
    }

    // ----- arms: work out where the hands are -----
    // He faces +x: the drinking arm is the far one (front of the picture plane is his near side).
    const sRx = w - 3.5, sLx = -w + 3, sY = -38.5 + breath;
    // The hand holds the glass by its side (or its handle, or its stem), so the glass sits
    // beside the hand, not on top of it. To drink, the hand goes wherever puts the near edge of
    // the rim on the lips. Astronauts can only get as far as the visor.
    const grip = GRIPS[L.drink ?? 'pint'];
    const visor = L.hat === 'helmet';
    const sipTilt = visor ? -0.5 : -1.0;
    const lipX = grip.gx - grip.half * 0.7, lipY = grip.gy + grip.top;
    const mouthX = visor ? 22 : 9.5, mouthY = visor ? -50 : -50.5;
    const sipX = mouthX - (lipX * Math.cos(sipTilt) - lipY * Math.sin(sipTilt));
    const sipY = mouthY - (lipX * Math.sin(sipTilt) + lipY * Math.cos(sipTilt));
    // At rest the glass is held out in front, at chest height.
    let hx = lerp(w + 7, sipX, sip), hy = lerp(-24, sipY, sip), tilt = sipTilt * sip;
    hx = lerp(hx, w + 8, cheer);
    hy = lerp(hy, -90 + Math.sin(t * 7 + ph) * 3, cheer);
    tilt = lerp(tilt, 0.22, cheer);
    if (pup) {
      hx = pup.hx;
      hy = pup.hy;
      tilt = pup.tilt;
    }
    let ox = -w - 2.4, oy = 1.6, prop: Special | null = null;
    const up = (x: number, y: number, a: number) => {
      ox = lerp(ox, x, a);
      oy = lerp(oy, y, a);
    };
    if (cheer > 0.01) up(-w - 9, -88 + Math.sin(t * 7 + ph + 1) * 3, cheer);
    if (special > 0.01) {
      if (sp === 'dart') {
        const throwP = clamp((this.actionT - 1.0) / 0.22);
        up(lerp(-w - 4, -w + 16, smooth(throwP)), lerp(-72, -64, smooth(throwP)), special);
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
        up(10, -57, special);
        prop = 'camera';
      } else if (sp === 'dance') {
        up(-w - 8, -70 + Math.sin(t * 6.5 + ph) * 8, special);
      }
    }
    // The drinking arm keeps one bend throughout (clockwise from shoulder to hand), for the crowd
    // and the player alike. At rest that hangs the upper arm down the body with the forearm out
    // in front; as the glass comes up the elbow swings forward and stays below the hand.
    // Bending the other way puts the elbow up by the ear with the forearm across the face.
    const [eRx, eRy] = elbow(sRx, sY, hx, hy, 1, 1);
    const [eLx, eLy] = elbow(sLx, sY, ox, oy, -1);
    const short = !!L.shortSleeves;

    const drawArm = (sx: number, ex: number, ey: number, x: number, y: number) => {
      const upper = () => capsule(ctx, sx, sY, ex, ey, 6.4, 5.3);
      const fore = () => capsule(ctx, ex, ey, x, y, 5.1, 4.2);
      if (short) {
        // Bare arm, with a sleeve over the top of it.
        this.merged(ctx, eSkin, [[upper, skin], [fore, skin]]);
        capsule(ctx, sx, sY, lerp(sx, ex, 0.55), lerp(sY, ey, 0.55), 6.8, 6.2);
        this.ink(ctx, cloth, eCloth);
      } else {
        this.merged(ctx, eCloth, [[upper, cloth], [fore, cloth]]);
        // Cuff.
        capsule(ctx, lerp(ex, x, 0.72), lerp(ey, y, 0.72), lerp(ex, x, 0.86), lerp(ey, y, 0.86), 4.8, 4.7);
        this.ink(ctx, clothSh, eCloth, 0.8);
      }
    };
    /** An open hand: a mitten with a thumb. */
    const hand = (x: number, y: number, ang: number) => {
      at(ctx, x, y, ang, 1, 1, () => {
        const palm = () => {
          ctx.beginPath();
          ctx.ellipse(1.6, 0, 4.8, 4.2, 0, 0, TAU);
        };
        const thumb = () => {
          ctx.beginPath();
          ctx.ellipse(1, -4, 1.9, 2.8, 0.5, 0, TAU);
        };
        this.merged(ctx, eSkin, [[thumb, skin], [palm, skin]]);
        line(ctx, 3.8, -1.6, 5.6, -1.2, eSkin, 0.6);
        line(ctx, 4, 0.6, 5.9, 0.9, eSkin, 0.6);
      });
    };

    if (!pup || pup.part === 'body') {
    // Back arm goes behind the body unless it's raised.
    const backRaised = oy < -40;
    if (!backRaised) {
      drawArm(sLx, eLx, eLy, ox, oy);
      hand(ox, oy, Math.atan2(oy - eLy, ox - eLx));
    }

    // ----- torso: sloping shoulders, a chest, and a belly for those who've earned one -----
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-5.5, -47 + breath);
      ctx.bezierCurveTo(-10, -46.6 + breath, -w + 3.5, -45.5 + breath, -w, -38.5 + breath);
      ctx.bezierCurveTo(-w - 2, -30, -w - 1, -10, -w + 1.5, 70);
      ctx.lineTo(w - 1 + belly * 0.6, 70);
      ctx.bezierCurveTo(w + belly * 1.4, 26, w + belly, -12, w - 0.4, -30 + breath);
      ctx.bezierCurveTo(w + 0.6, -40 + breath, w - 5, -46 + breath, 5.5, -47 + breath);
      ctx.closePath();
    };
    torso();
    this.ink(ctx, cloth, eCloth, 1.15);
    ctx.save();
    torso();
    ctx.clip();
    if (L.jacket) {
      // A buttoned jacket: the shirt (and tie, or a jumper) only shows in the V between the lapels.
      const vee = () => poly(ctx, [-7, -50, 8.6, -50, 3.2, -17]);
      vee();
      ctx.fillStyle = k(L.shirt);
      ctx.fill();
      ctx.save();
      vee();
      ctx.clip();
      this.pattern(ctx, L, w + belly, t);
      ctx.restore();
      // The front edge where one side crosses over the other, and its buttons.
      curve(ctx, [3.2, -17, 4.6, 10, 4.2, 70], eCloth, 0.9);
      for (const y of [-9, 5, 19]) {
        ctx.beginPath();
        ctx.arc(0.4, y, 1.5, 0, TAU);
        this.ink(ctx, clothSh, eCloth, 0.6);
      }
      // Notched lapels lying flat along the V: the near one catches the light.
      poly(ctx, [-7.4, -50.4, 3.2, -17, -2.6, -22.4, -9.4, -34.6, -6.6, -38.4, -11.6, -44.6]);
      this.ink(ctx, clothHi, eCloth, 0.8);
      poly(ctx, [9, -50.4, 3.2, -17, 6.8, -22.4, 11.2, -34.6, 9, -38, 12.4, -44.6]);
      this.ink(ctx, clothSh, eCloth, 0.8);
      // Breast pocket.
      line(ctx, -13.4, -22.6, -6.4, -23.6, eCloth, 0.9);
      // Shoulder seam, where the sleeve is set in.
      curve(ctx, [-w + 6.4, -45.4, -w + 4.6, -38, -w + 4.2, -29], alpha(eCloth, 0.45), 0.8);
    } else {
      this.pattern(ctx, L, w + belly, t);
      if (CREW_NECKS.has(L.pattern ?? 'none')) {
        // A ribbed collar, and a glimpse of neck above it.
        ellipse(ctx, 0.6, -47.6, 6.6, 2.6, skinSh);
        curve(ctx, [-7.6, -48.4, 0.6, -43.4, 8.8, -48.4], clothSh, 2.6);
        curve(ctx, [-7.6, -48.4, 0.6, -43.4, 8.8, -48.4], alpha(eCloth, 0.5), 0.6);
      }
      // A fold where the cloth pulls across the chest.
      curve(ctx, [-w + 5, -30, -w + 9, -24, -w + 8, -15], alpha(eCloth, 0.28), 0.8);
    }
    // Shade under the chin and down the far side; a little light on the near shoulder.
    ellipse(ctx, 1.5, -46.5, 9.5, 4.2, alpha('#190a26', 0.2));
    // A soft falloff, not a hard-edged wedge: on white clothes a wedge reads as a tear in the cloth.
    const far = ctx.createLinearGradient(w * 0.1, 0, w + belly + 2, 0);
    far.addColorStop(0, 'rgba(25,10,38,0)');
    far.addColorStop(1, 'rgba(25,10,38,0.26)');
    ctx.fillStyle = far;
    ctx.fillRect(w * 0.1, -60, w + 20, 140);
    curve(ctx, [-w + 2.6, -39 + breath, -w + 6, -43.8 + breath, -8, -45.6 + breath], alpha(k(tint(top, 0.5)), 0.5), 1.1);
    ctx.restore();

    if (L.scarf && prop !== 'scarf') {
      const sc = k(L.scarf), es = this.edge(L.scarf), st = k(L.patternColour2 ?? '#ffffff');
      ctx.beginPath();
      ctx.roundRect(2.4, -46.5, 7, 21, 2);
      this.ink(ctx, sc, es);
      rect(ctx, 2.9, -40, 6, 2.8, st);
      rect(ctx, 2.9, -33.5, 6, 2.8, st);
      ctx.beginPath();
      ctx.roundRect(-9.5, -51.5, 20, 7, 3.4);
      this.ink(ctx, sc, es);
      for (let i = 0; i < 3; i++) rect(ctx, -6 + i * 6, -51, 2.4, 6, st);
    }

    // ----- neck and head -----
    ctx.beginPath();
    ctx.moveTo(-5, -55);
    ctx.lineTo(6, -54);
    ctx.lineTo(6.4, -45);
    ctx.quadraticCurveTo(0.5, -42.6, -5.6, -45);
    ctx.closePath();
    this.ink(ctx, skinSh, eSkin, 0.9);
    this.head(ctx, t, L, { sip, cheer, talk, laugh, special, still });
    // The near half of the ring passes in front of the face.
    if (ringed) this.halo(ctx, t, ringed, true);

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
        ctx.beginPath();
        ctx.roundRect(ox - 7.5, oy - 5.5, 15, 10, 2);
        this.ink(ctx, k('#2a2a34'), k('#0e0e14'));
        rect(ctx, ox - 5, oy - 7.4, 5, 2.4, k('#2a2a34'), 1);
        circle(ctx, ox + 1, oy - 0.5, 3.3, k('#8a96b0'));
        circle(ctx, ox + 1, oy - 0.5, 2, k('#1c2434'));
        const flash = arc(clamp((this.actionT - 1.2) / 0.25));
        if (flash > 0.02) glow(ctx, ox + 5, oy - 6, 44, '#ffffff', flash);
      }
      hand(ox, oy, Math.atan2(oy - eLy, ox - eLx) + (prop === 'camera' ? 1.2 : 0));
    }
    if (prop === 'scarf' && L.scarf) {
      // Held aloft between both hands, sagging and swaying.
      // Arms only reach so high, so the scarf bows up over the head between them rather than
      // sagging across the face.
      const sag = -16 + Math.sin(t * 3 + ph) * 2;
      const midX = (ox + hx) / 2, midY = Math.min(oy, hy) + sag;
      const band = () => {
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(midX, midY, hx, hy);
      };
      ctx.lineCap = 'butt';
      band();
      ctx.strokeStyle = this.edge(L.scarf);
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = k(L.scarf);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = k(L.patternColour2 ?? '#ffffff');
      ctx.stroke();
      ctx.setLineDash([]);
    }

    }
    if (pup) {
      // The player's pint is drawn by the stage, between his arm and his fingers.
      if (pup.part === 'arm') {
        drawArm(sRx, eRx, eRy, hx, hy);
        ctx.beginPath();
        ctx.arc(hx, hy, 4.4, 0, TAU);
        this.ink(ctx, skinSh, eSkin);
      } else if (pup.part === 'fingers') {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(tilt);
        for (let i = 0; i < 4; i++) {
          capsule(ctx, -1.4, -4.2 + i * 2.7, 7.4 - Math.abs(i - 1.4) * 0.9, -4.3 + i * 2.7, 1.6, 1.45);
          this.ink(ctx, skin, eSkin, 0.7);
        }
        ctx.restore();
      }
      return;
    }

    // ----- drinking arm, glass, hand -----
    drawArm(sRx, eRx, eRy, hx, hy);
    if (prop === 'scarf') {
      hand(hx, hy, Math.atan2(hy - eRy, hx - eRx));
      return;
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tilt);
    ctx.save();
    ctx.translate(grip.gx, grip.gy);
    ctx.scale(DRINK_SCALE, DRINK_SCALE);
    this.glassTilt = tilt;
    this.drink(ctx, L, t, tilt);
    ctx.restore();
    if (grip.stem) {
      // A fist round the stem.
      ctx.beginPath();
      ctx.roundRect(-5.4, -0.6, 10.8, 8.6, 4);
      this.ink(ctx, skin, eSkin);
      for (let i = 0; i < 3; i++) line(ctx, -4.4, 1.7 + i * 2.2, 1.6, 1.5 + i * 2.2, eSkin, 0.6);
    } else {
      // The hand comes in from the arm's side: the heel of it beside the glass, the fingers
      // wrapping across the front (or round the handle of a tankard).
      const reach = grip.handle ? 4.6 : Math.min(8.4, grip.half * 1.25);
      ctx.beginPath();
      ctx.ellipse(1.8, 1, 4, 5.4, 0, 0, TAU);
      this.ink(ctx, skinSh, eSkin);
      for (let i = 0; i < 4; i++) {
        const y = -3.4 + i * 2.75;
        capsule(ctx, 1.4, y, -reach + Math.abs(i - 1.4) * 0.8, y + 0.2, 1.65, 1.5);
        this.ink(ctx, skin, eSkin, 0.75);
      }
    }
    ctx.restore();
  }

  /** The black hole's accretion ring, tilted round the head: draw the far half, the head, then the near half. */
  private halo(ctx: Ctx, t: number, colour: string, front: boolean) {
    ctx.save();
    ctx.translate(0, HEAD_Y - 1);
    ctx.rotate(-0.3);
    ctx.globalCompositeOperation = 'lighter';
    const seen = 1 - this.tone.amount;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 25 + i * 4, 7 + i * 1.5, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.strokeStyle = alpha(i ? colour : '#ffffff', [0.85, 0.5, 0.22][i] * seen);
      ctx.lineWidth = [1.1, 2.6, 4.2][i];
      ctx.lineCap = 'butt';
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const a = t * (1.5 + i * 0.3) + i * 2.1 + this.phase;
      if (Math.sin(a) > 0 === front) glow(ctx, Math.cos(a) * 27, Math.sin(a) * 8, 5, colour, 0.9);
    }
    ctx.restore();
  }

  private head(
    ctx: Ctx, t: number, L: Look,
    a: { sip: number; cheer: number; talk: number; laugh: number; special: number; still: boolean },
  ) {
    const k = this.k;
    const ph = this.phase;
    const skin = k(L.skin), skinSh = k(shade(L.skin, 0.17)), skinHi = k(tint(L.skin, 0.16));
    const eSkin = this.edge(L.skin);
    const hair = k(L.hairColour), hairSh = k(shade(L.hairColour, 0.28)), eHair = this.edge(L.hairColour);
    const dark = k('#2a1820');
    const nod = a.still ? 0 : Math.sin(t * 2.3 + ph) * 0.03 * a.talk - a.sip * 0.2 - a.laugh * 0.1 - a.cheer * 0.1;
    const face = L.face ?? 'plain';
    const alien = face === 'cyclops' || face === 'three' || face === 'grey' || face === 'stalks';

    ctx.save();
    ctx.translate(0, HEAD_Y + 14);
    ctx.rotate(nod);
    ctx.translate(0, -14);
    // From here (0, 0) is the middle of the head, which is turned three-quarters towards +x.

    // Hair that hangs behind the head.
    if (L.hair === 'long') {
      blobPath(ctx, [-16.5, -6, -14, -17.5, -3, -22, 9, -19.5, 14, -11, 10, 4, 12, 20, 2, 24, -12, 23, -19, 16, -18.5, 4]);
      this.ink(ctx, hairSh, eHair);
    }
    if (L.hair === 'bob') {
      blobPath(ctx, [-16.5, -6, -14, -17.5, -3, -21.5, 9, -19, 14, -10, 11, 2, 10, 12, 0, 14, -13, 13.5, -18, 8, -18, -2]);
      this.ink(ctx, hairSh, eHair);
    }
    if (L.hair === 'afro') {
      ctx.beginPath();
      for (let i = 0; i < 11; i++) {
        const an = Math.PI * 0.86 + (i / 10) * Math.PI * 1.36;
        const x = -1 + Math.cos(an) * 17.5, y = -6 + Math.sin(an) * 17;
        ctx.moveTo(x + 7, y);
        ctx.arc(x, y, 7, 0, TAU);
      }
      ctx.moveTo(17, -6);
      ctx.arc(-1, -6, 18, 0, TAU);
      this.ink(ctx, hair, eHair);
      circle(ctx, -1, -6, 18.4, hair);
      for (let i = 0; i < 11; i++) {
        const an = Math.PI * 0.86 + (i / 10) * Math.PI * 1.36;
        circle(ctx, -1 + Math.cos(an) * 17.5, -6 + Math.sin(an) * 17, 6.5, hair);
      }
    }
    if (L.hat === 'crown') {
      blobPath(ctx, [-12, -12, -8, -23, 8, -23, 12, -12]);
      this.ink(ctx, k(L.hatAccent ?? '#c8323a'), this.edge(L.hatAccent ?? '#c8323a'));
    }

    // The head: a rounded skull narrowing to a chin that leads the way he's facing.
    const jaw = L.bigHead ? -2.2 : this.jaw;
    const rawHead = [
      -1, -17.6, 9, -15.6, 14.4, -8.4, 14.2, -1.5, 15.3, 4.4,
      12.6 + jaw, 11.4 + jaw * 0.6, 6.8 + jaw * 0.8, 16.8 + jaw * 0.5, -1.6, 17.3 + jaw * 0.3,
      -9.2 - jaw, 13.6 + jaw * 0.5, -14, 5.6, -15.8, -4, -11.6, -13.6,
    ];
    // A big head swells above the eyes and stays put below them.
    const headPts = L.bigHead ? rawHead.map((v, i) => (rawHead[i | 1] < 2 ? v * (i % 2 ? 1.14 : 1.13) + (i % 2 ? -1 : 0) : v)) : rawHead;
    blobPath(ctx, headPts);
    this.ink(ctx, skin, eSkin, 1.15);
    ctx.save();
    blobPath(ctx, headPts);
    ctx.clip();
    // Shade round the back of the head and under the jaw; light on the brow.
    blob(ctx, [-20, -22, -9, -17, -10.5, -2, -6.5, 10, 4, 17, 14, 15, 14, 24, -22, 24], alpha(skinSh, 0.9), 0.5);
    ellipse(ctx, 6, -9, 6.5, 4, alpha(skinHi, 0.55), -0.2);
    if (face !== 'void' && !L.paint) {
      const rosy = Math.max(a.laugh, a.cheer, a.sip) + this.flush * 2 + (L.flush ?? 0);
      ellipse(ctx, 10.4, 6.6, 3.8, 2.8, alpha(k('#ec6f62'), 0.34 + rosy * 0.2));
      ellipse(ctx, -3.6, 7.2, 3.6, 2.6, alpha(k('#ec6f62'), 0.24 + rosy * 0.16));
    }
    if (L.paint) {
      // Woad over the whole face, with a white slash across it.
      ctx.fillStyle = alpha(k(L.paint), 0.9);
      ctx.fillRect(-20, -22, 40, 46);
      poly(ctx, [-18, -9, -12, -15, 18, 8, 13, 14], alpha(k('#f6f4ee'), 0.95));
      ctx.fillStyle = alpha('#0c1a4a', 0.22);
      blob(ctx, [-20, -22, -9, -17, -10.5, -2, -6.5, 10, 4, 17, 14, 15, 14, 24, -22, 24], undefined, 0.5);
      ctx.fill();
    }
    if (L.freckles) {
      for (const [x, y] of [[8.6, 4.6], [11, 5.4], [12.8, 4.2], [-4.6, 5.4], [-2.6, 6.4]]) {
        circle(ctx, x, y, 0.45, alpha(k('#a8502a'), 0.45));
      }
    }
    if (L.beard === 'stubble') {
      blob(ctx, [-14, 4, -4, 8, 6, 7, 16, 3, 16, 22, -14, 22], alpha(k('#3a2c2e'), 0.2), 0.5);
    }
    ctx.restore();

    // Near ear (or, for some visitors, just the hole).
    if (face === 'grey' || face === 'stalks') {
      ellipse(ctx, -11.6, 3, 0.9, 1.5, alpha(eSkin, 0.7), -0.2);
    } else {
      ctx.beginPath();
      ctx.ellipse(-12.4, 2.4, 3.1, 4.5, -0.15, 0, TAU);
      this.ink(ctx, skin, eSkin, 0.9);
      curve(ctx, [-11.6, 0.2, -13.6, 1.8, -12.6, 4.6], eSkin, 0.7);
    }

    // Hair on top.
    const hairShape = (pts: number[], c = hair) => {
      blobPath(ctx, pts);
      this.ink(ctx, c, eHair);
    };
    switch (L.hair) {
      case 'short':
        hairShape([-16, -1, -15.6, -10, -10, -17.8, -1, -19.8, 9, -17.4, 14.6, -10, 14.2, -6.4, 9.5, -10.6, 2, -12.4, -6, -10.6, -10.6, -5, -11.2, 2.6]);
        break;
      case 'side': case 'long':
        hairShape([-16, 0, -16.2, -10, -10.6, -18.6, 0, -21.2, 10, -18.8, 15.2, -10.6, 14.8, -5.6, 11, -10, 4, -9, -4, -12, -10, -5.4, -11.2, 3]);
        curve(ctx, [-9, -15, -1, -15.6, 7, -12.5], alpha(hairSh, 0.9), 1);
        break;
      case 'bob':
        hairShape([-16.4, 2, -16.4, -10, -10.6, -18.4, 0, -20.8, 10, -18.4, 15.2, -10, 15, -3.6, 11.5, -6.4, 3, -7.4, -6, -6.8, -10.4, -2, -11, 6, -15, 7]);
        break;
      case 'bun':
        circle(ctx, -8.5, -19.5, 6, hair);
        ctx.beginPath();
        ctx.arc(-8.5, -19.5, 6, 0, TAU);
        this.ink(ctx, hair, eHair);
        hairShape([-16, -1, -15.6, -10, -10, -17.8, -1, -19.8, 9, -17.4, 14.6, -10, 14.2, -6.4, 9.5, -10.6, 2, -12.4, -6, -10.6, -10.6, -5, -11.2, 2.6]);
        break;
      case 'quiff':
        hairShape([-16, -1, -15.6, -10, -10.5, -18, -2, -21.5, 6, -26.5, 14.5, -23, 17, -15, 14.4, -7.6, 10.5, -12.4, 3, -12.6, -6, -10.6, -10.6, -5, -11.2, 2.6]);
        curve(ctx, [-2, -18, 6, -22, 13, -19], alpha(hairSh, 0.9), 1);
        break;
      case 'curly': {
        // A mop: one mass with a bumpy edge, and a few curls picked out on top.
        const base = () => blobPath(ctx, [-16, -1, -15.6, -10, -10, -17, -1, -19, 9, -16.6, 14.6, -10, 14.2, -6.4, 9.5, -10.6, 2, -12.4, -6, -10.6, -10.6, -5, -11.2, 2.6]);
        const bumps: [number, number, number][] = [[-14.6, -6, 4.2], [-13.4, -13, 4.6], [-7.6, -18.6, 5], [-0.4, -20.6, 5.2], [7, -19, 4.8], [12.6, -14, 4.4], [14.6, -8.6, 3.4], [-13.4, 1.6, 3.2]];
        this.merged(ctx, eHair, [[base, hair], ...bumps.map(([x, y, r]): [() => void, string] => [() => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
        }, hair])]);
        for (const [x, y, r] of bumps.slice(1, 6)) {
          ctx.beginPath();
          ctx.arc(x + 0.6, y + 1.4, r * 0.55, Math.PI * 1.05, Math.PI * 1.9);
          ctx.strokeStyle = alpha(hairSh, 0.9);
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
        break;
      }
      case 'mohawk':
        blobPath(ctx, [-11, -14, -9, -24, -4, -19, -1, -28, 3, -20, 7, -27, 9.5, -18.5, 12.5, -22, 11.5, -13, 0, -16.4], 0.2);
        this.ink(ctx, hair, eHair);
        break;
      case 'swept':
        // Brushed back off a high forehead, full at the sides.
        hairShape([-16.4, 3, -17.4, -8, -12.6, -17.4, -3, -20.4, 6, -19, 10.6, -14.6, 5, -14.4, -2, -15, -8, -11, -10, -4, -10.6, 4.6, -14, 6.4]);
        curve(ctx, [-13, -12, -6, -17, 3, -17.4], alpha(k(tint(L.hairColour, 0.4)), 0.5), 1.2);
        break;
      case 'greySides':
        hairShape([-16, -2, -15, -9.6, -10.4, -10.2, -8.6, -4, -10.4, 3.6, -11.6, 7.4, -15, 6]);
        break;
      case 'afro':
        hairShape([-15.5, -4, -11, -15, 0, -18, 10, -16, 14.6, -8, 9, -11.4, 0, -12.4, -8, -9.6]);
        break;
      default: break;
    }
    if (L.hair === 'bald' && !alien && face !== 'void') ellipse(ctx, -3, -12.5, 4.6, 2, alpha(skinHi, 0.7), -0.3);
    if (L.hair === 'short' || L.hair === 'side' || L.hair === 'long' || L.hair === 'bob' || L.hair === 'bun' || L.hair === 'quiff') {
      // A sheen across the crown.
      curve(ctx, [-11, -12.6, -5, -16.4, 3, -16.6], alpha(k(tint(L.hairColour, 0.45)), 0.55), 1.3);
    }

    // ----- face -----
    const blink = a.still ? 1 : 1 - this.blink * 0.92;
    const happy = Math.max(a.laugh, a.cheer, a.sip);
    const gx = a.still ? 0.5 : 0.5 + this.gaze * 0.9;
    const eyeY = -1.8;
    const white = k('#fdfaf2');
    /** One eye: a white, a pupil that looks about, and a heavy upper lid. */
    const eye = (x: number, rx: number, y = eyeY) => {
      if (happy > 0.5) {
        curve(ctx, [x - rx, y + 0.8, x, y - 1.8, x + rx, y + 0.8], dark, 1.3);
        return;
      }
      const ry = Math.max(0.3, 3.5 * blink * (rx / 3));
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      this.ink(ctx, white, eSkin, 0.6);
      if (blink > 0.35) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
        ctx.clip();
        circle(ctx, x + gx * (rx / 3), y + 0.4, rx * 0.62, dark);
        circle(ctx, x + gx * (rx / 3) + 0.6, y - 0.6, rx * 0.2, 'rgba(255,255,255,0.9)');
        ctx.restore();
      }
      curve(ctx, [x - rx - 0.3, y - ry * 0.35, x, y - ry - 0.5, x + rx + 0.3, y - ry * 0.3], dark, 1.15);
    };
    if (face === 'cyclops') {
      ctx.beginPath();
      ctx.ellipse(4.5, -3, 7, Math.max(0.6, 6.6 * blink), 0, 0, TAU);
      this.ink(ctx, white, eSkin, 0.9);
      if (blink > 0.3) {
        circle(ctx, 4.5 + gx * 1.6, -2.6, 3.4, k(L.glow ?? '#444'));
        circle(ctx, 4.5 + gx * 1.6, -2.6, 1.7, dark);
        circle(ctx, 5.6 + gx * 1.6, -3.9, 0.9, 'rgba(255,255,255,0.9)');
      }
      curve(ctx, [-2.8, -5.4, 4.5, -10.4 * Math.max(0.4, blink), 11.8, -5.2], dark, 1.2);
    } else if (face === 'three') {
      eye(-0.6, 2.9);
      eye(9, 2.4);
      eye(4.6, 2.2, -9.4);
    } else if (face === 'grey') {
      // Great black almonds, tilted, with the room reflected in them.
      const squint = happy > 0.5 ? 0.45 : blink;
      for (const [x, rx, rot] of [[-1.6, 4.5, 0.42], [9.2, 3.7, -0.36]]) {
        ctx.beginPath();
        ctx.ellipse(x, -1.4, rx, Math.max(0.5, rx * 1.42 * squint), rot, 0, TAU);
        this.ink(ctx, k('#0d0b14'), eSkin, 0.7);
        if (squint > 0.4) {
          ellipse(ctx, x + 1 + gx * 0.5, -3.6, rx * 0.34, rx * 0.5, 'rgba(255,255,255,0.75)', rot);
          circle(ctx, x - 1, 1.6, rx * 0.16, 'rgba(160,220,255,0.5)');
        }
      }
    } else if (face === 'stalks') {
      // Its eyes are up on the stalks.
    } else if (face === 'void') {
      const c = L.glow ?? '#fff';
      for (const x of [0.5, 9.5]) {
        ellipse(ctx, x, eyeY, 2, 1.6, '#ffffff');
        glow(ctx, x, eyeY, 7.5, c, 0.95 * (1 - this.tone.amount * 0.6));
      }
    } else if (face === 'shades') {
      const lens = () => {
        ctx.beginPath();
        ctx.roundRect(-5.6, eyeY - 3.6, 9.6, 7.4, [2, 2, 3.6, 3.6]);
        ctx.roundRect(5.4, eyeY - 3.6, 8.2, 7.4, [2, 2, 3.6, 3.6]);
      };
      lens();
      this.ink(ctx, k('#1b1722'), k('#07060a'), 0.9);
      line(ctx, -12, eyeY - 1.6, -5.6, eyeY - 2.4, k('#07060a'), 1);
      line(ctx, -3.8, eyeY - 2, -0.6, eyeY - 2, 'rgba(255,255,255,0.4)', 0.9);
      line(ctx, 6.8, eyeY - 2, 9.6, eyeY - 2, 'rgba(255,255,255,0.4)', 0.9);
    } else if (face === 'patch') {
      eye(-0.6, 3);
      line(ctx, -15, -9, 14, -4.6, dark, 0.9);
      ctx.beginPath();
      ctx.ellipse(9, eyeY + 0.2, 3.4, 3.8, 0.1, 0, TAU);
      this.ink(ctx, k('#17141c'), dark, 0.7);
    } else {
      eye(-0.6, 3);
      eye(9, 2.5);
      if (face === 'glasses') {
        ctx.strokeStyle = k('#33241f');
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.arc(-0.6, eyeY, 4.7, 0, TAU);
        ctx.moveTo(13, eyeY);
        ctx.ellipse(9, eyeY, 4, 4.7, 0, 0, TAU);
        ctx.moveTo(4.1, eyeY - 0.8);
        ctx.lineTo(5, eyeY - 0.8);
        ctx.moveTo(-5.3, eyeY - 0.8);
        ctx.lineTo(-12, eyeY - 1.6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(210,235,255,0.14)';
        ctx.beginPath();
        ctx.arc(-0.6, eyeY, 4.7, 0, TAU);
        ctx.ellipse(9, eyeY, 4, 4.7, 0, 0, TAU);
        ctx.fill();
        line(ctx, -3.6, eyeY - 2.6, -1.8, eyeY - 3.4, 'rgba(255,255,255,0.5)', 0.8);
      }
    }
    if (face === 'plain' || face === 'glasses' || face === 'three' || face === 'patch') {
      const lift = happy * 1.7 + a.talk * Math.sin(t * 5 + ph) * 0.7;
      const brow = alien ? this.edge(L.skin) : k(mix(shade(L.hairColour, 0.3), '#2a1820', 0.35));
      const by = (face === 'three' ? -2 : 0) - lift;
      curve(ctx, [-4.4, -7.6 + by, -0.6, -9.3 + by, 3, -7.6 + by], brow, 1.8);
      curve(ctx, [6.6, -7.8 + by, 9.4, -9.2 + by, 12.4, -7.8 + by], brow, 1.7);
    }
    if (face === 'grey' || face === 'stalks') {
      // No nose to speak of: two slits.
      line(ctx, 5.8, 5.6, 6.1, 7, alpha(eSkin, 0.85), 0.8);
      line(ctx, 7.8, 5.5, 7.9, 6.9, alpha(eSkin, 0.85), 0.8);
    } else if (face !== 'void') {
      // Nose: it breaks the outline of the cheek, which is what makes the head read as turned.
      const nose = this.nose;
      const tip = 16.2 + nose;
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(11.4, -1.6);
        ctx.bezierCurveTo(13.6, 0.4, tip + 1.6, 3.4, tip, 6.4 + nose * 0.4);
        ctx.bezierCurveTo(tip - 1.2, 8.6 + nose * 0.4, 12.2, 8, 10.6, 6.8);
      };
      trace();
      ctx.fillStyle = L.paint ? k(mix(L.paint, '#ffffff', 0.08)) : k(mix(L.skin, '#e8705f', alien ? 0 : 0.16));
      ctx.fill();
      trace();
      ctx.strokeStyle = eSkin;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.stroke();
      // A catch of light on the end of the nose, and the hint of a nostril.
      ellipse(ctx, tip - 1.6, 4.6 + nose * 0.3, 1.3, 1, alpha(skinHi, 0.8));
      curve(ctx, [11.6, 7.2, 12.6, 6.4, 13.6, 7], alpha(eSkin, 0.7), 0.7);
    }

    // Beard goes under the mouth.
    const beardBase = mix(L.hairColour, '#8a8078', L.hair === 'bald' || L.hair === 'greySides' ? 0 : 0.12);
    const beardC = k(beardBase), eBeard = this.edge(beardBase);
    if (L.beard === 'full') {
      blobPath(ctx, [-13.8, 2, -13, 11, -8, 18.5, 0.5, 22, 8.5, 21, 13.6, 14.6, 15.4, 6, 12, 8.6, 8, 7.4, 3, 8.4, -4, 7, -10, 3.4]);
      this.ink(ctx, beardC, eBeard);
      curve(ctx, [-6, 13, 0, 17, 7, 16.4], alpha(eBeard, 0.4), 0.8);
    }
    if (L.beard === 'goatee') {
      blobPath(ctx, [3.6, 13.6, 7.8, 12.8, 11.6, 13.6, 10.8, 18.6, 6.8, 20.4, 3.2, 18.4]);
      this.ink(ctx, beardC, eBeard, 0.9);
    }

    // Mouth.
    const mx = 7.4, my = 11;
    if (face !== 'void') {
      const wide = Math.max(a.laugh, a.cheer);
      if (wide > 0.25) {
        const h = 2.4 + wide * 4.4 + (a.laugh > 0.3 ? Math.abs(Math.sin(t * 13)) * 1.2 : 0);
        const shape = () => {
          ctx.beginPath();
          ctx.moveTo(mx - 5.4, my - 1.6);
          ctx.quadraticCurveTo(mx, my - 0.4, mx + 5, my - 2);
          ctx.quadraticCurveTo(mx + 4.6, my + h, mx, my + h);
          ctx.quadraticCurveTo(mx - 4.6, my + h, mx - 5.4, my - 1.6);
        };
        shape();
        this.ink(ctx, k('#4a141c'), dark, 0.9);
        ctx.save();
        shape();
        ctx.clip();
        rect(ctx, mx - 6, my - 2.4, 12, 2.6, k('#fdf8ee'));
        ellipse(ctx, mx, my + h - 0.4, 3, 1.8, k('#e0606c'));
        ctx.restore();
      } else if (a.talk > 0.2) {
        const h = 0.8 + Math.abs(Math.sin(t * 10.5 + ph)) * 2.8 * a.talk;
        ctx.beginPath();
        ctx.ellipse(mx, my + 0.6, 2.8 + Math.sin(t * 7 + ph) * 0.7, h, 0, 0, TAU);
        this.ink(ctx, k('#4a141c'), dark, 0.8);
      } else if (a.sip < 0.4) {
        // A lopsided smile, with a dimple at the near corner.
        curve(ctx, [mx - 4.6, my - 1, mx - 0.4, my + 1.9, mx + 4.4, my - 1.4], dark, 1.25);
        curve(ctx, [mx - 5.4, my - 2, mx - 4.9, my - 0.7, mx - 4, my - 0.2], dark, 0.9);
        // The shadow under the lower lip gives the mouth some depth.
        if (L.beard !== 'full' && L.beard !== 'goatee') curve(ctx, [mx - 1.8, my + 3.6, mx + 0.4, my + 4.1, mx + 2.4, my + 3.4], alpha(eSkin, 0.4), 0.8);
      }
    }
    if (L.beard === 'moustache') {
      blobPath(ctx, [0.6, 7.6, 7.4, 6.2, 14.4, 7.4, 15, 10.6, 9.4, 9.4, 7.4, 8.8, 4, 10, -0.4, 11.4]);
      this.ink(ctx, beardC, eBeard, 0.9);
      if (this.foam > 0.02) {
        // The head of his last pint.
        ctx.globalAlpha *= clamp(this.foam * 2);
        blob(ctx, [2.4, 7.2, 7.6, 6, 14, 7.2, 14.4, 9.2, 9.4, 8.4, 7.4, 8, 4.4, 8.8], k('#fffaf0'), 0.5);
        circle(ctx, 5.4, 8.6, 1, k('#fffaf0'));
        circle(ctx, 11.4, 8.8, 1.1, k('#fffaf0'));
        ctx.globalAlpha /= clamp(this.foam * 2);
      }
    }

    this.hat(ctx, t, L, a.cheer + a.special);
    ctx.restore();
  }

  private hat(ctx: Ctx, t: number, L: Look, energy: number) {
    const k = this.k;
    const ph = this.phase;
    const base = L.hatColour ?? '#444444';
    const c = k(base), cSh = k(shade(base, 0.28)), cHi = k(tint(base, 0.16)), e = this.edge(base);
    const acc = L.hatAccent ?? '#ffffff';
    const ac = k(acc), eAc = this.edge(acc);
    const wob = Math.sin(t * 5 + ph) * (0.6 + energy * 2);
    const shape = (pts: number[], fill: string, edge = e, tension = 0.5) => {
      blobPath(ctx, pts, tension);
      this.ink(ctx, fill, edge);
    };
    const polyInk = (pts: number[], fill: string, edge = e) => {
      poly(ctx, pts);
      this.ink(ctx, fill, edge);
    };
    switch (L.hat) {
      case 'horned': {
        // An iron cap with a nose guard and two horns. Historically dubious; nobody minds.
        for (const sgn of [-1, 1]) {
          const hx = sgn < 0 ? -13 : 12;
          blobPath(ctx, [hx, -14, hx + sgn * 8, -17, hx + sgn * 12, -27 - wob * 0.2, hx + sgn * 8.6, -22, hx + sgn * 2, -19.6], 0.5);
          this.ink(ctx, ac, eAc);
        }
        shape([-16.6, -6.4, -16, -15, -8, -22, 5, -22.6, 13.6, -17, 15.8, -8.4, 0, -7.6], c);
        blob(ctx, [-9, -19.6, 3, -20.4, 10, -16.4, 0, -16.6], alpha(cHi, 0.8), 0.5);
        ctx.beginPath();
        ctx.roundRect(-17, -10.4, 33.4, 4.6, 2);
        this.ink(ctx, cSh, e);
        for (let i = 0; i < 6; i++) circle(ctx, -13.6 + i * 5.4, -8.1, 0.9, cHi);
        ctx.beginPath();
        ctx.roundRect(8.4, -7, 3.4, 9, 1.4);
        this.ink(ctx, cSh, e, 0.8);
        break;
      }
      case 'tricorn': {
        // Three corners, gold braid, and a skull to make the point.
        shape([-23, -8, -14, -17, -2, -14.6, 9, -18.6, 22, -9.4, 12, -5.4, -1, -8.6, -13, -5], c);
        shape([-12.6, -11, -10, -20, -1, -23, 8.6, -20.6, 12, -11.6, 0, -9.6], cHi);
        curve(ctx, [-22, -8.6, -13, -15.4, -2, -13, 9, -17, 21, -9.8], ac, 1.1);
        circle(ctx, -0.4, -16.6, 2.6, k('#f1ead9'));
        circle(ctx, -1.4, -17, 0.6, c);
        circle(ctx, 0.6, -17, 0.6, c);
        line(ctx, -3.4, -13.4, 2.6, -19.4, k('#f1ead9'), 0.8);
        line(ctx, 2.6, -13.4, -3.4, -19.4, k('#f1ead9'), 0.8);
        break;
      }
      case 'akubra': {
        // Wide brim, pinched crown, and corks on strings to keep the flies off.
        shape([-25, -6.6, -12, -12, 12, -12.6, 26, -8, 14, -4.6, -12, -4], cSh);
        shape([-12.4, -10, -11.4, -19.4, -4.6, -22.6, 0.4, -19.6, 5.6, -23, 12.4, -19.4, 12.8, -10.6], c);
        rect(ctx, -12, -13, 24.6, 2.4, ac);
        for (let i = 0; i < 5; i++) {
          const x = -20 + i * 10.6, sw = Math.sin(t * 3.4 + ph + i * 1.3) * (1.2 + energy * 2);
          line(ctx, x, -5.2, x + sw, 2.2, k('#3a2a1c'), 0.5);
          ctx.beginPath();
          ctx.ellipse(x + sw, 3.6, 1.3, 1.9, 0, 0, TAU);
          this.ink(ctx, k('#c9a26a'), k('#5a4026'), 0.6);
        }
        break;
      }
      case 'ushanka': {
        // Fur hat with the ear flaps down and a red star on the front.
        shape([-18.6, -7, -13, -8, -11.4, 8, -15.4, 12, -19.6, 6], cSh);
        shape([-17.4, -4.6, -17, -16, -8, -23.4, 6, -24, 15.4, -17.6, 16.8, -6.6], c);
        shape([-11, -13.6, 2, -15.6, 13, -14, 16, -7, 2, -8.6, -12.6, -6], cHi);
        for (let i = 0; i < 6; i++) line(ctx, -13 + i * 5.2, -21.4 + Math.abs(i - 2.4) * 1.6, -12 + i * 5.2, -19.6 + Math.abs(i - 2.4) * 1.6, alpha(e, 0.5), 0.7);
        const sx = 4.4, sy = -11;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const an = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 1.3 : 3;
          ctx.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr);
        }
        ctx.closePath();
        this.ink(ctx, ac, eAc, 0.5);
        break;
      }
      case 'hachimaki': {
        // White headband: a red sun on the brow, a character either side, tails flying behind.
        polyInk([-15.6, -9.6, -19 - wob * 0.5, -3, -22 - wob * 0.8, 3, -18.6 - wob * 0.5, 4, -14.4, -4], cSh);
        polyInk([-15.6, -8, -21 - wob * 0.6, -9.6, -25 - wob, -6, -21.6 - wob * 0.6, -4.4, -14.6, -5], c);
        shape([-16, -9.8, 0, -13, 14.8, -11, 14.6, -5.8, 0, -7.8, -16, -4.8], c);
        circle(ctx, 5.4, -9.2, 2.3, ac);
        const ink = k('#1c1a22');
        for (const kx of [-0.6, 10.6]) {
          line(ctx, kx - 1.5, -10.4, kx + 1.5, -10.6, ink, 0.7);
          line(ctx, kx, -11.4, kx, -7.4, ink, 0.7);
          line(ctx, kx - 1.6, -8, kx + 1.6, -8.4, ink, 0.7);
        }
        break;
      }
      case 'tyrolean': {
        // Alpine hat, cord band, and a tuft on the side.
        const fx = -8.6, fy = -13;
        curve(ctx, [fx, fy, fx - 3 + wob * 0.3, fy - 9, fx - 1 + wob * 0.6, fy - 17], k('#f4f1e8'), 3.4);
        curve(ctx, [fx, fy, fx - 3 + wob * 0.3, fy - 9, fx - 1 + wob * 0.6, fy - 17], k('#8a8f98'), 1);
        shape([-22, -6.6, -11, -11.6, 13, -12.2, 23, -8.2, 13, -5, -11, -4.6], cSh);
        shape([-12.6, -10, -10.4, -21, -1, -25.4, 8.6, -22.4, 12.8, -11], c);
        blob(ctx, [-8, -20, -1, -23.4, 6, -21, -1, -19.6], alpha(cHi, 0.8), 0.5);
        rect(ctx, -12.4, -13.4, 25, 2.6, ac);
        circle(ctx, fx, fy + 1, 1.8, k('#c8323a'));
        break;
      }
      case 'flatcap':
        // Peak first, so the crown sits over it.
        shape([8, -12.4, 17, -11.6, 24, -7.6, 20, -4.8, 10, -6.6], cSh);
        shape([-16.8, -6, -16.4, -14.6, -9, -21.4, 4, -22.4, 13.6, -17, 16.6, -9.6, 0, -8.2], c);
        blob(ctx, [-9, -19.6, 3, -20.6, 11, -16.4, 2, -16.4, -8, -15], alpha(cHi, 0.85), 0.5);
        curve(ctx, [-16.6, -6.6, 0, -8.6, 16.4, -10], e, 0.9);
        circle(ctx, -2, -22.2, 1.4, cSh);
        break;
      case 'cap':
        shape([7, -11.6, 17, -11, 25.5, -7.4, 21, -4.8, 9, -6.4], cSh);
        shape([-16.4, -5.6, -16, -14, -9, -20.6, 3, -21.4, 12.6, -16.4, 15.8, -9.2, 0, -7.8], c);
        circle(ctx, 4, -14, 3.2, ac);
        curve(ctx, [-2, -21, -1, -14, 0, -8.2], alpha(e, 0.5), 0.7);
        break;
      case 'mortarboard': {
        ctx.beginPath();
        ctx.roundRect(-12, -17.6, 24.6, 9, 2.4);
        this.ink(ctx, cSh, e);
        polyInk([-23, -18, -1, -26, 23, -19.4, 1.6, -11.6], c);
        poly(ctx, [-23, -18, 1.6, -11.6, 23, -19.4, 23, -17.8, 1.6, -10, -23, -16.4], cSh);
        const sx = 14 + wob * 1.4;
        circle(ctx, 0.4, -18.8, 1.4, ac);
        line(ctx, 0.4, -18.8, sx, -15.4, ac, 1);
        line(ctx, sx, -15.4, sx + wob * 0.5, -7, ac, 1);
        ctx.beginPath();
        ctx.roundRect(sx + wob * 0.5 - 1.6, -8, 3.2, 5.2, 1);
        this.ink(ctx, ac, eAc, 0.7);
        break;
      }
      case 'cone': {
        const or = '#f2762a';
        polyInk([-9, -12.4, 9, -12.4, 3, -40, -2.6, -40], k(or), this.edge(or));
        poly(ctx, [-7, -21, 7.2, -21, 5.6, -28.4, -5.2, -28.4], k('#f6f2e8'));
        poly(ctx, [3, -40, 9, -12.4, 4.4, -12.4, 1, -40], alpha('#3a1208', 0.22));
        ctx.beginPath();
        ctx.roundRect(-13, -14.6, 26, 4.6, 1.6);
        this.ink(ctx, k('#d85f1c'), this.edge(or));
        break;
      }
      case 'antlers': {
        const band = [-14, -8.6, -9.4, -16, -0.6, -19, 9, -16.4, 14, -9.6];
        curve(ctx, band, eAc, 4.2);
        curve(ctx, band, ac, 2.6);
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.translate(s * 8 - 0.6, -17);
          ctx.rotate(s * (0.06 + wob * 0.03));
          const stem = [0, 0, s * 4.6, -9.4, s * 4, -20];
          for (const [wd, col] of [[5, e], [3.3, c]] as const) {
            curve(ctx, stem, col, wd);
            line(ctx, s * 4.4, -9.4, s * 11.4, -14, col, wd - 0.5);
            line(ctx, s * 4.2, -15.4, s * -1.6, -21.6, col, wd - 0.7);
          }
          circle(ctx, s * 11.4, -14, 1.4, cHi);
          circle(ctx, s * 4, -20.2, 1.4, cHi);
          ctx.restore();
        }
        break;
      }
      case 'scrumcap':
        shape([-16.6, 1, -16.6, -11, -8, -19.8, 5, -20.4, 14.6, -14, 15.6, -7, 12.4, -8.6, 2, -11, -8, -8, -11, -1, -11.4, 7, -15.6, 7], c);
        curve(ctx, [-9.4, -9.6, -7, -16.4, 1, -18.8, 9, -15.4, 12, -9.6], cHi, 1.2);
        line(ctx, 1, -19.6, 1.4, -10.6, cHi, 1.2);
        curve(ctx, [-13.4, 6.4, -7, 16.6, 2, 20.2, 9, 18.4, 13.6, 11], e, 1.5);
        break;
      case 'bobble':
        circle(ctx, wob * 0.8 - 1, -25.6, 5.4, ac);
        ctx.beginPath();
        ctx.arc(wob * 0.8 - 1, -25.6, 5.4, 0, TAU);
        this.ink(ctx, ac, eAc);
        circle(ctx, wob * 0.8 - 2.4, -27, 2.4, 'rgba(255,255,255,0.4)');
        shape([-16.6, -6, -16, -15, -8, -22, 5, -22.4, 14, -16.8, 15.6, -8], c);
        ctx.beginPath();
        ctx.roundRect(-17.4, -11.4, 33.6, 7.2, 3.4);
        this.ink(ctx, ac, eAc);
        for (let i = 0; i < 5; i++) rect(ctx, -13.6 + i * 6.3, -10.8, 2, 6, alpha('#1a1024', 0.16));
        break;
      case 'bucket':
        shape([-22, -5.4, -13, -11.4, 12, -12.2, 21.4, -7, 13, -4.4, -12, -3.6], cSh);
        shape([-12.6, -9, -11.6, -20, -1, -23.4, 10.4, -20.6, 12, -10], c);
        rect(ctx, -12.2, -13.6, 24, 2.4, ac);
        break;
      case 'hanky':
        shape([-15, -8, -12.4, -16.4, -1, -20.2, 11, -17, 14.4, -9.4, 0, -11.4], c);
        for (const [x, y] of [[-15.4, -8.4], [14.6, -9.6], [-10, -18], [9, -18.4]]) {
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, TAU);
          this.ink(ctx, cSh, e, 0.8);
        }
        break;
      case 'crown':
        polyInk([-13.6, -10, -15.4, -24.6, -7.6, -18, -0.6, -27.6, 6.6, -18.4, 14, -25.4, 13, -10.6], c);
        ctx.beginPath();
        ctx.roundRect(-14, -14, 27.4, 4.6, 1.2);
        this.ink(ctx, cSh, e, 0.8);
        for (const [x, y, col] of [[-15.4, -25.2, '#e8f1ff'], [-0.6, -28.2, '#ff5c6a'], [14, -26, '#e8f1ff'], [-6.4, -11.7, '#5cd6ff'], [5.6, -11.9, '#7affc1'], [-0.4, -11.8, '#ff5c6a']] as const) {
          circle(ctx, x, y, 1.6, k(col));
        }
        break;
      case 'party':
        ctx.save();
        ctx.translate(-3, -13);
        ctx.rotate(-0.2 + wob * 0.012);
        polyInk([-8.4, 0, 8.4, 0, 0, -26], c);
        ctx.save();
        poly(ctx, [-8.4, 0, 8.4, 0, 0, -26]);
        ctx.clip();
        for (let i = 0; i < 5; i++) poly(ctx, [-12, -4 - i * 7, 12, -9 - i * 7, 12, -6.5 - i * 7, -12, -1.5 - i * 7], ac);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(0, -26.6, 3.1, 0, TAU);
        this.ink(ctx, ac, eAc, 0.8);
        ctx.restore();
        break;
      case 'stalks':
        for (const s of [-1, 1]) {
          const tx = s * 8.6 + 2 + wob * 0.7, ty = -29 + Math.sin(t * 2.4 + ph + s) * 1.6;
          const stalk = [s * 4.6 + 1, -15, s * 6.4 + 1, -22, tx, ty + 3];
          curve(ctx, stalk, this.edge(L.skin), 4.2);
          curve(ctx, stalk, k(L.skin), 2.6);
          const open = Math.max(0.12, 1 - this.blink * 0.92);
          ctx.beginPath();
          ctx.ellipse(tx, ty, 4.4, 4.4 * open, 0, 0, TAU);
          this.ink(ctx, k('#fdfaf2'), this.edge(L.skin), 0.9);
          if (open > 0.4) {
            const px = tx + 0.8 + this.gaze * 1.6;
            circle(ctx, px, ty + 0.2, 2.2, k('#2a1820'));
            circle(ctx, px + 0.7, ty - 0.8, 0.7, 'rgba(255,255,255,0.9)');
          }
        }
        break;
      case 'antennae':
        for (const s of [-1, 1]) {
          const tx = s * 9.6 - 1 + wob * 0.8, ty = -30 + Math.sin(t * 3 + ph + s) * 1.4;
          const stalk = [s * 5 - 1, -15, s * 6.6 - 1, -23, tx, ty];
          curve(ctx, stalk, this.edge(L.skin), 3);
          curve(ctx, stalk, k(L.skin), 1.5);
          ctx.beginPath();
          ctx.arc(tx, ty, 2.9, 0, TAU);
          this.ink(ctx, k(L.glow ?? '#fff'), this.edge(L.glow ?? '#fff'), 0.8);
          glow(ctx, tx, ty, 9 + energy * 5, L.glow ?? '#fff', (0.75 + energy * 0.25) * (1 - this.tone.amount * 0.6));
        }
        break;
      case 'helmet': {
        // Collar ring, then a glass bubble with a sweep of reflection.
        ctx.beginPath();
        ctx.roundRect(-17.6, 13.6, 36, 7, 3.4);
        this.ink(ctx, k('#b9c0cc'), k('#4a5262'));
        rect(ctx, -16.6, 14.2, 34, 2, k('#eef2f7'), 1);
        circle(ctx, 0.6, -1, 23, 'rgba(190,225,255,0.14)');
        ctx.beginPath();
        ctx.arc(0.6, -1, 23, 0, TAU);
        ctx.strokeStyle = k('#4a5262');
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.strokeStyle = alpha(k('#f4f8fc'), 0.95);
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0.6, -1, 18.6, Math.PI * 1.08, Math.PI * 1.42);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 2.8;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0.6, -1, 18.6, Math.PI * 1.47, Math.PI * 1.53);
        ctx.stroke();
        break;
      }
      default: break;
    }
  }

  private pattern(ctx: Ctx, L: Look, w: number, t: number) {
    const k = this.k;
    const p1 = k(L.patternColour ?? '#ffffff'), p2 = k(L.patternColour2 ?? '#c8323a');
    switch (L.pattern) {
      case 'jumper': {
        // Cable knit: a ribbed crew neck and ropes running down the front.
        curve(ctx, [-8, -48.6, 0.5, -43.6, 9, -48.6], k(shade(L.shirt, 0.18)), 3);
        for (const x of [-9, 0.5, 10]) {
          ctx.beginPath();
          for (let y = -42; y < 70; y += 2) ctx.lineTo(x + Math.sin(y * 0.55) * 1.6, y);
          ctx.strokeStyle = alpha(p1, 0.9);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          for (let y = -42; y < 70; y += 2) ctx.lineTo(x - Math.sin(y * 0.55) * 1.6, y);
          ctx.stroke();
        }
        break;
      }
      case 'tartan': {
        // A rough tunic with a plaid over one shoulder, pinned with a brooch.
        poly(ctx, [-6, -49, 6, -49, 0.5, -40], k(L.skin));
        const sash = () => poly(ctx, [-w - 2, -36, -w + 11, -50, w + 2, -6, w + 2, 14, -w - 2, -18]);
        sash();
        ctx.fillStyle = p1;
        ctx.fill();
        ctx.save();
        sash();
        ctx.clip();
        for (let i = -6; i < 8; i++) {
          line(ctx, -w - 4 + i * 9, -60, -w + 40 + i * 9, 40, alpha(k(shade(L.patternColour ?? '#000', 0.4)), 0.7), 3.2, 'butt');
          line(ctx, -w - 4 + i * 9 + 4.4, -60, -w + 44.4 + i * 9, 40, p2, 0.7, 'butt');
          line(ctx, w + 4 - i * 9, -60, w - 40 - i * 9, 40, alpha(k(shade(L.patternColour ?? '#000', 0.4)), 0.55), 3.2, 'butt');
          line(ctx, w + 4 - i * 9 - 4.4, -60, w - 44.4 - i * 9, 40, alpha(p2, 0.8), 0.7, 'butt');
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(-w + 9, -42, 2.6, 0, TAU);
        this.ink(ctx, k('#d9b25a'), k('#5a4020'), 0.7);
        break;
      }
      case 'furcoat': {
        // Greatcoat: a deep fur collar and two rows of buttons.
        blobPath(ctx, [-13, -50.5, 0.5, -47, 14, -50.5, 17, -40, 9, -33.6, 0.5, -37, -8, -33.6, -16, -40]);
        this.ink(ctx, p1, this.edge(L.patternColour ?? '#8a7a6a'), 0.9);
        for (let i = 0; i < 7; i++) line(ctx, -12 + i * 4.2, -44 + Math.abs(i - 3) * 1.4, -11.4 + i * 4.2, -41.4 + Math.abs(i - 3) * 1.4, alpha(k('#3a2c22'), 0.4), 0.7);
        line(ctx, 0.5, -36, 1.4, 70, this.edge(L.shirt), 0.9);
        for (const y of [-26, -12, 2]) {
          circle(ctx, -5, y, 1.4, k('#d9b25a'));
          circle(ctx, 6.6, y, 1.4, k('#d9b25a'));
        }
        break;
      }
      case 'zip': {
        // A hiking jacket: stand-up collar, a zip down the front, shoulders in a second colour.
        blob(ctx, [-w - 4, -52, w + 6, -52, w + 6, -36, 0.8, -31, -w - 4, -36], alpha(p1, 0.9), 0.3);
        line(ctx, 0.8, -46, 1.6, 70, this.edge(L.shirt), 1);
        line(ctx, 0.8, -46, 1.6, 70, alpha(k('#f4f1e8'), 0.5), 0.4);
        rect(ctx, -0.2, -40, 2.2, 3.4, k('#c9ced6'), 0.6);
        ctx.beginPath();
        ctx.roundRect(-8, -52, 17.6, 7, 3);
        this.ink(ctx, k(shade(L.shirt, 0.12)), this.edge(L.shirt), 0.8);
        rect(ctx, 6, -24, 8, 5, alpha(k('#f4f1e8'), 0.85), 1);
        break;
      }
      case 'maosuit': {
        // Buttoned to the throat: a turned-down collar, five buttons, and flapped pockets.
        const cloth = L.shirt, e = this.edge(cloth);
        line(ctx, 0.8, -44, 1.6, 70, e, 0.9);
        for (const y of [-38, -26, -14, -2, 10]) {
          ctx.beginPath();
          ctx.arc(1.2, y, 1.4, 0, TAU);
          this.ink(ctx, k(shade(cloth, 0.3)), e, 0.6);
        }
        for (const [px, py, pw] of [[-14.6, -31, 10], [5.6, -31, 10], [-15.6, -6, 12], [5.6, -6, 12]]) {
          ctx.beginPath();
          ctx.roundRect(px, py, pw, 9, 1.4);
          this.ink(ctx, k(tint(cloth, 0.05)), e, 0.7);
          poly(ctx, [px, py, px + pw, py, px + pw, py + 3, px + pw / 2, py + 4.6, px, py + 3]);
          this.ink(ctx, k(shade(cloth, 0.12)), e, 0.7);
          circle(ctx, px + pw / 2, py + 2.4, 0.7, e);
        }
        poly(ctx, [-8.6, -50.6, 0.6, -47.6, 0.2, -41.4, -6.6, -42.6]);
        this.ink(ctx, k(tint(cloth, 0.1)), e, 0.8);
        poly(ctx, [10, -50.6, 0.8, -47.6, 1.4, -41.4, 8, -42.6]);
        this.ink(ctx, k(shade(cloth, 0.1)), e, 0.8);
        break;
      }
      case 'plaid': {
        // Checked shirt, open at the neck.
        for (let x = -w - 4; x < w + 10; x += 9) rect(ctx, x, -52, 4, 130, alpha(p1, 0.34));
        for (let y = -50; y < 70; y += 9) rect(ctx, -w - 6, y, w * 2 + 16, 4, alpha(p1, 0.34));
        for (let x = -w - 2; x < w + 10; x += 9) rect(ctx, x, -52, 0.8, 130, alpha(p2, 0.5));
        for (let y = -48; y < 70; y += 9) rect(ctx, -w - 6, y, w * 2 + 16, 0.8, alpha(p2, 0.5));
        poly(ctx, [-6, -49.6, 7, -49.6, 0.8, -39], k(L.skin));
        poly(ctx, [-7.6, -50.4, 0.6, -42, -4.4, -37.6, -10.6, -45]);
        this.ink(ctx, k(tint(L.shirt, 0.12)), this.edge(L.shirt), 0.8);
        poly(ctx, [9, -50.4, 0.8, -42, 5.6, -37.6, 11.6, -45]);
        this.ink(ctx, k(shade(L.shirt, 0.12)), this.edge(L.shirt), 0.8);
        line(ctx, 0.8, -39, 1.6, 70, this.edge(L.shirt), 0.8);
        for (const y of [-30, -17, -4]) circle(ctx, 3.4, y, 1, k('#f2ead8'));
        break;
      }
      case 'germany': {
        // The away shirt: white, with the colours in a band across the chest.
        curve(ctx, [-8, -48.6, 0.5, -43.6, 9, -48.6], k('#1c1c22'), 2.4);
        rect(ctx, -w - 6, -31, w * 2 + 16, 3, k('#1c1c22'));
        rect(ctx, -w - 6, -28, w * 2 + 16, 3, k('#c8323a'));
        rect(ctx, -w - 6, -25, w * 2 + 16, 3, k('#f2c21c'));
        break;
      }
      case 'lederhosen': {
        // A checked shirt under leather braces, with a carved chest strap.
        for (let x = -w - 4; x < w + 10; x += 5) rect(ctx, x, -52, 2.4, 130, alpha(p2, 0.3));
        for (let y = -50; y < 70; y += 5) rect(ctx, -w - 6, y, w * 2 + 16, 2.4, alpha(p2, 0.3));
        poly(ctx, [-6, -49.6, 7, -49.6, 0.8, -40], k(L.skin));
        const leather = L.patternColour ?? '#6a4326', el = this.edge(leather);
        for (const x of [-11.4, 8.6]) {
          ctx.beginPath();
          ctx.rect(x, -50, 5, 130);
          this.ink(ctx, p1, el, 0.8);
        }
        ctx.beginPath();
        ctx.roundRect(-12.4, -27, 27, 7, 2);
        this.ink(ctx, k(tint(leather, 0.1)), el, 0.8);
        for (let i = 0; i < 5; i++) circle(ctx, 1 + Math.cos(i * 1.256) * 1.7, -23.5 + Math.sin(i * 1.256) * 1.7, 1, k('#f4f1e8'));
        circle(ctx, 1, -23.5, 0.8, k('#f2c21c'));
        break;
      }
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
      case 'cardigan': {
        // A proper tie: a blade hanging down the middle of the V, a knot at the throat, and the
        // shirt's collar points folded over either side of it.
        const tie = L.patternColour ?? '#8c2d22', eTie = this.edge(tie), eShirt = this.edge(mix(L.shirt, '#8a7a66', 0.5));
        poly(ctx, [-0.9, -42, 2.7, -42, 6.4, -24.5, 3.2, -15.5, 0, -24.5]);
        this.ink(ctx, p1, eTie, 0.8);
        poly(ctx, [2.7, -42, 6.4, -24.5, 3.2, -15.5, 2.2, -30], alpha(k(shade(tie, 0.35)), 0.5));
        poly(ctx, [-1.9, -46.4, 3.7, -46.4, 2.8, -41.6, -1, -41.6]);
        this.ink(ctx, k(shade(tie, 0.14)), eTie, 0.8);
        poly(ctx, [-7.4, -50.4, 0.6, -46.6, -3.4, -40.4]);
        this.ink(ctx, k(tint(L.shirt, 0.5)), eShirt, 0.8);
        poly(ctx, [9, -50.4, 1.2, -46.6, 5.2, -40.4]);
        this.ink(ctx, k(shade(L.shirt, 0.06)), eShirt, 0.8);
        break;
      }
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

  private drink(ctx: Ctx, L: Look, t: number, tilt = 0) {
    const k = this.k;
    /**
     * Fill the (already clipped) glass up to `ly` on its centre line. The surface stays level
     * with the room however the glass is tipped, give or take a slosh, so it runs up the low side.
     */
    const pour = (ly: number, fill: string, head?: string) => {
      ctx.save();
      ctx.translate(0, ly);
      ctx.rotate(-tilt + this.slosh);
      rect(ctx, -40, 0, 80, 60, fill);
      if (head) rect(ctx, -40, -2.4, 80, 2.6, head);
      ctx.restore();
    };
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
      if (lv > 0.03) pour(lerp(-4, -15.5, lv), beer);
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
    if (kind === 'bottle') {
      const glass = k(L.drinkColour ?? '#2f8a4a'), eg = this.edge(L.drinkColour ?? '#2f8a4a');
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(-3, 7);
        ctx.lineTo(-3, -6);
        ctx.quadraticCurveTo(-3, -9, -1.3, -10.6);
        ctx.lineTo(-1.3, -16);
        ctx.lineTo(1.3, -16);
        ctx.lineTo(1.3, -10.6);
        ctx.quadraticCurveTo(3, -9, 3, -6);
        ctx.lineTo(3, 7);
        ctx.closePath();
      };
      body();
      this.ink(ctx, glass, eg, 0.7);
      rect(ctx, -3, -4, 6, 6, k('#f4f2ea'));
      rect(ctx, -3, -2, 6, 1.6, k('#c8323a'));
      rect(ctx, -1.5, -17, 3, 1.6, k('#d9b25a'), 0.5);
      line(ctx, -1.9, -7, -1.9, 5.6, 'rgba(255,255,255,0.4)', 0.7);
      return;
    }
    if (kind === 'horn') {
      // A drinking horn, banded in brass, mead to the brim.
      const horn = () => {
        ctx.beginPath();
        ctx.moveTo(-4.4, -13);
        ctx.lineTo(4.4, -13);
        ctx.bezierCurveTo(5, -2, 2, 5, -6, 9.6);
        ctx.bezierCurveTo(-3, 4, -4.4, -3, -4.4, -13);
        ctx.closePath();
      };
      horn();
      this.ink(ctx, k('#e9dcc0'), k('#5a4a34'), 0.7);
      ctx.save();
      horn();
      ctx.clip();
      rect(ctx, -8, 2, 16, 10, k('#3a2c22'));
      rect(ctx, 1.6, -14, 4, 26, alpha('#3a2010', 0.2));
      ctx.restore();
      ellipse(ctx, 0, -13, 4.4, 1.5, lv > 0.1 ? beer : k('#5a4a34'));
      rect(ctx, -4.8, -11.6, 9.6, 1.8, k('#d9b25a'), 0.6);
      return;
    }
    if (kind === 'shot') {
      const pts = [-2.6, -6, 2.6, -6, 2.1, 3, -2.1, 3];
      poly(ctx, pts, 'rgba(220,240,250,0.3)');
      ctx.save();
      poly(ctx, pts);
      ctx.clip();
      if (lv > 0.03) pour(lerp(2, -4.4, lv), alpha(beer, 0.75));
      ctx.restore();
      poly(ctx, pts);
      ctx.strokeStyle = glassEdge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      rect(ctx, -2.2, 1.8, 4.4, 1.4, 'rgba(240,250,255,0.6)');
      return;
    }
    const small = kind === 'tasting', big = kind === 'mass', mug = kind === 'tankard' || big;
    const hw = small ? 3.6 : big ? 7 : mug ? 5.6 : 5, top = small ? -8 : big ? -13 : -11, bot = small ? 5 : big ? 8 : 7;
    const shapePts = mug ? [-hw, top, hw, top, hw, bot, -hw, bot] : [-hw, top, hw, top, hw * 0.8, bot, -hw * 0.8, bot];
    if (mug) {
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
    if (lv > 0.03) {
      pour(ly, beer, k('#fbf6e9'));
      // Bubbles, rising straight up whatever the glass is doing.
      if (!mug) {
        for (let i = 0; i < 3; i++) {
          const by = bot - 1 - ((t * 4 + i * 4.7 + this.phase * 3) % (bot - ly + 0.01));
          circle(ctx, -hw * 0.5 + i * hw * 0.45 + Math.sin(t * 3 + i) * 0.4, by, 0.45, 'rgba(255,255,255,0.55)');
        }
      }
    }
    rect(ctx, hw * 0.3, top, hw, bot - top, alpha(beerSh, lv > 0.03 ? 0.22 : 0));
    if (big) {
      // Dimples.
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) circle(ctx, -4.4 + i * 4.4, -6 + j * 5, 1.5, 'rgba(255,255,255,0.14)');
    }
    ctx.restore();
    if (big && lv > 0.7) {
      // A proper head, standing proud of the rim.
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(-5 + i * 3.4 + 2.6, top - 0.6);
        ctx.arc(-5 + i * 3.4, top - 0.6, 2.6, 0, TAU);
      }
      ctx.fillStyle = k('#fbf6e9');
      ctx.fill();
    }
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
