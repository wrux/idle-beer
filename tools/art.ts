/**
 * Turns the AI-generated art in art/source/ into game-ready sprites in public/art/.
 *
 *   npm run art
 *
 * Source art (generated in the "idle.beer art" Figma file):
 *   locations/<id>.png      empty pub interiors, bar counter straight-on along the bottom
 *   characters/*.png        the regular's puppet parts and crowd line-up sheets (on green/magenta)
 *   props/glasses.png       the four empty glass shapes
 *   props/taps-N.png        handpump sheets, one tap per beer in BEERS order
 *
 * Characters and props are generated on a flat green (or magenta) background; we key that out
 * with soft edges, remove the coloured fringe ("spill"), trim and save WebP. Each background's
 * bar edge is found automatically so the renderer can line the scene up with it.
 */
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';

const SRC = 'art/source';
const OUT = 'public/art';

type Key = 'green' | 'magenta';
interface Raster { data: Buffer; width: number; height: number }
interface Box { left: number; top: number; width: number; height: number }

async function load(file: string): Promise<Raster> {
  const { data, info } = await sharp(`${SRC}/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** How strongly a pixel looks like the key colour (0 = not at all, 255 = pure key). */
function keyness(r: number, g: number, b: number, key: Key): number {
  return key === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;
}

/** Key out the background in place: soft alpha ramp plus spill removal on the edges. */
function chromaKey(img: Raster, key: Key, lo = 40, hi = 120): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const k = keyness(r, g, b, key);
    const alpha = k <= lo ? 1 : k >= hi ? 0 : 1 - (k - lo) / (hi - lo);
    d[i + 3] = Math.round(alpha * 255);
    if (k > 0) {
      // Pull the key colour out of fringe pixels so edges don't glow green/pink.
      if (key === 'green') d[i + 1] = Math.max(r, b);
      else {
        d[i] = Math.max(0, r - k);
        d[i + 2] = Math.max(0, b - k);
      }
    }
  }
}

const opaque = (img: Raster, x: number, y: number, min = 24) => img.data[(y * img.width + x) * 4 + 3] > min;

/** Bounding box of pixels with real alpha, within an x range. */
function bbox(img: Raster, x0 = 0, x1 = img.width): Box {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = x0; x < x1; x++) {
      if (opaque(img, x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Split an image of `n` things in a row at the emptiest columns between them. */
function splitColumns(img: Raster, n: number): number[] {
  const count = (x: number) => {
    let c = 0;
    for (let y = 0; y < img.height; y++) if (opaque(img, x, y)) c++;
    return c;
  };
  const cuts = [0];
  for (let k = 1; k < n; k++) {
    const centre = (img.width * k) / n;
    const reach = (img.width / n) * 0.4;
    let best = centre, bestCount = Infinity;
    for (let x = Math.floor(centre - reach); x < centre + reach; x++) {
      const c = count(x);
      if (c < bestCount) {
        bestCount = c;
        best = x;
      }
    }
    cuts.push(best);
  }
  cuts.push(img.width);
  return cuts;
}

/**
 * Split the arm at the elbow into two pieces with ROUNDED ends: both end in a circle centred on
 * the elbow joint, as wide as the sleeve. However far the elbow bends, the two circles stay
 * on top of each other, so there's no gap on the outside of the bend and no corner on the inside.
 * The shoulder end is rounded the same way, so it reads as a shoulder rather than a cut sleeve.
 */
async function splitArm(img: Raster, box: Box, log: (n: string, r: { width: number; height: number; bytes: number }) => void) {
  const elbowX = Math.round(box.width * 0.42); // upper arm about as long as the forearm
  // Sleeve top and bottom at the elbow give the joint's centre and radius.
  let top = box.top, bottom = box.top + box.height - 1;
  while (top < bottom && !opaque(img, box.left + elbowX, top, 128)) top++;
  while (bottom > top && !opaque(img, box.left + elbowX, bottom, 128)) bottom--;
  const centreY = (top + bottom) / 2 - box.top;
  const radius = (bottom - top) / 2;

  const piece = async (x0: number, x1: number, keep: (x: number) => boolean, name: string, jointX = elbowX) => {
    const w = x1 - x0;
    const out = Buffer.alloc(w * box.height * 4);
    for (let y = 0; y < box.height; y++) {
      for (let x = 0; x < w; x++) {
        const sx = box.left + x0 + x, sy = box.top + y;
        const si = (sy * img.width + sx) * 4, di = (y * w + x) * 4;
        img.data.copy(out, di, si, si + 4);
        if (!keep(x0 + x)) {
          // Past the joint: keep only the circle around the elbow, with a 1.5px soft edge.
          const d = Math.hypot(x0 + x - jointX, y - centreY);
          const a = Math.max(0, Math.min(1, (radius - d) / 1.5 + 0.5));
          out[di + 3] = Math.round(out[di + 3] * a);
        }
      }
    }
    const info = await sharp(out, { raw: { width: w, height: box.height, channels: 4 } })
      .webp({ quality: 88, alphaQuality: 90 }).toFile(`${OUT}/${name}.webp`);
    log(name, { width: info.width, height: info.height, bytes: info.size });
  };
  const r = Math.ceil(radius) + 2;
  // Upper arm: rounded at the shoulder (a circle centred `radius` in from the cut end) and at the elbow.
  const shoulderX = Math.round(radius);
  await piece(0, Math.min(box.width, elbowX + r), (x) => x <= elbowX, 'arm-upper-tmp');
  await roundStart(`${OUT}/arm-upper-tmp.webp`, `${OUT}/arm-upper.webp`, shoulderX, centreY, radius);
  await piece(Math.max(0, elbowX - r), box.width, (x) => x >= elbowX, 'arm-fore');
  return {
    width: box.width, height: box.height, elbowX, shoulderX, centreY: +centreY.toFixed(1),
    radius: +radius.toFixed(1), foreStart: Math.max(0, elbowX - r),
  };
}

/** Round off the left end of a piece: keep only the circle around (cx, cy) left of cx. */
async function roundStart(src: string, dst: string, cx: number, cy: number, radius: number) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < cx; x++) {
      const i = (y * info.width + x) * 4 + 3;
      const a = Math.max(0, Math.min(1, (radius - Math.hypot(x - cx, y - cy)) / 1.5 + 0.5));
      data[i] = Math.round(data[i] * a);
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 90 }).toFile(dst);
  const { unlink } = await import('node:fs/promises');
  await unlink(src);
}

async function save(img: Raster, box: Box, name: string, size?: { width?: number; height?: number }) {
  let s = sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).extract(box);
  if (size) s = s.resize({ ...size, fit: 'inside', withoutEnlargement: true });
  const info = await s.webp({ quality: 88, alphaQuality: 90 }).toFile(`${OUT}/${name}.webp`);
  return { width: info.width, height: info.height, bytes: info.size };
}

/** Row where the bar counter's top edge is: the biggest jump from dark wall to bright bar top. */
function findBarEdge(img: Raster): number {
  const rowBrightness = (y: number) => {
    let sum = 0;
    for (let x = Math.floor(img.width * 0.3); x < img.width * 0.7; x++) {
      const i = (y * img.width + x) * 4;
      sum += img.data[i] + img.data[i + 1] + img.data[i + 2];
    }
    return sum / (img.width * 0.4);
  };
  let best = Math.floor(img.height * 0.55), bestJump = -Infinity;
  for (let y = Math.floor(img.height * 0.35); y < img.height * 0.8; y++) {
    const jump = (rowBrightness(y + 2) + rowBrightness(y + 4)) - (rowBrightness(y - 3) + rowBrightness(y - 5));
    if (jump > bestJump) {
      bestJump = jump;
      best = y;
    }
  }
  return best;
}

/**
 * Inside profile of a glass: for each of `samples` rows from rim to base, the half-width as a
 * fraction of the glass height, measured from the left wall (glasses are symmetric, which also
 * ignores a tankard's handle). Also how far down the liquid can go (above a stem or thick base).
 */
function glassProfile(img: Raster, box: Box, samples = 48) {
  const rimY = box.top + Math.round(box.height * 0.02);
  let rimL = box.left;
  while (rimL < box.left + box.width && !opaque(img, rimL, rimY, 60)) rimL++;
  let rimR = box.left + box.width - 1;
  while (rimR > rimL && !opaque(img, rimR, rimY, 60)) rimR--;
  const centre = (rimL + rimR) / 2;

  const half: number[] = [];
  for (let i = 0; i < samples; i++) {
    const y = box.top + Math.round(((i + 0.5) / samples) * box.height);
    let x = box.left;
    while (x < centre && !opaque(img, x, y, 60)) x++;
    half.push(+((centre - x) / box.height).toFixed(4));
  }
  // Liquid stops where the bowl narrows into a stem, or at the thick base.
  const widest = Math.max(...half);
  let bottom = samples - 1;
  for (let i = Math.floor(samples * 0.4); i < samples; i++) {
    if (half[i] < widest * 0.35) {
      bottom = i;
      break;
    }
  }
  return {
    half,
    liquidBottom: +Math.min(bottom / samples, 0.93).toFixed(3),
    aspect: +(box.width / box.height).toFixed(4),
    centre: +((centre - box.left) / box.width).toFixed(4),
  };
}

async function build() {
  for (const dir of ['locations', 'crowd', 'glass', 'taps']) await mkdir(`${OUT}/${dir}`, { recursive: true });
  const manifest: Record<string, any> = { locations: {}, crowd: {}, glass: {}, taps: [] };
  let total = 0;
  const log = (name: string, r: { width: number; height: number; bytes: number }) => {
    total += r.bytes;
    console.log(`  ${name.padEnd(30)} ${String(r.width).padStart(4)}×${String(r.height).padEnd(4)} ${(r.bytes / 1024).toFixed(0).padStart(4)} KB`);
  };

  // ----- locations -----
  for (const file of (await readdir(`${SRC}/locations`)).filter((f) => f.endsWith('.png')).sort()) {
    const id = file.replace('.png', '');
    const img = await load(`locations/${file}`);
    const edge = findBarEdge(img);
    const bg = sharp(`${SRC}/locations/${file}`);
    const a = await bg.clone().webp({ quality: 84 }).toFile(`${OUT}/locations/${id}.webp`);
    const b = await bg.clone().extract({ left: 0, top: edge, width: img.width, height: img.height - edge })
      .webp({ quality: 84 }).toFile(`${OUT}/locations/${id}-bar.webp`);
    log(`locations/${id} (bar at ${edge})`, { width: a.width, height: a.height, bytes: a.size + b.size });
    manifest.locations[id] = { width: img.width, height: img.height, barEdge: edge };
  }

  // ----- the regular: armless body and his arm, from one sheet at one scale -----
  const parts = await load('characters/regular-parts.png');
  chromaKey(parts, 'green');
  const [, split] = splitColumns(parts, 2);
  const body = bbox(parts, 0, split);
  const arm = bbox(parts, split, parts.width);
  log('regular', await save(parts, body, 'regular'));
  manifest.arm = await splitArm(parts, arm, log);

  // ----- crowd: one character per drinker type, all saved at the same height -----
  const sheets: [string, Key, string[]][] = [
    ['characters/sheet-1.png', 'green', ['regular', 'student', 'darts']],
    ['characters/sheet-2.png', 'green', ['stag', 'rugby', 'supporters']],
    ['characters/sheet-3.png', 'green', ['wmc', 'beerfest', 'musicfest']],
    ['characters/sheet-4.png', 'green', ['chain', 'bankhol', 'streetparty']],
    ['characters/sheet-5.png', 'green', ['toast', 'blackhole', 'multiverse']],
    ['characters/crowd-pair.png', 'green', ['galactic', 'lunar']],
    ['characters/alien-green.png', 'magenta', ['crawl']],
  ];
  for (const [file, key, ids] of sheets) {
    const img = await load(file);
    chromaKey(img, key);
    const cuts = splitColumns(img, ids.length);
    for (const [i, id] of ids.entries()) {
      const r = await save(img, bbox(img, cuts[i], cuts[i + 1]), `crowd/${id}`, { height: 360 });
      log(`crowd/${id}`, r);
      manifest.crowd[id] = { width: r.width, height: r.height };
    }
  }

  // ----- glasses, with their inside profile -----
  const glasses = await load('props/glasses.png');
  chromaKey(glasses, 'green', 30, 110);
  const gcuts = splitColumns(glasses, 4);
  for (const [i, shape] of ['nonic', 'tulip', 'snifter', 'tankard'].entries()) {
    const box = bbox(glasses, gcuts[i], gcuts[i + 1]);
    const profile = glassProfile(glasses, box);
    const r = await save(glasses, box, `glass/${shape}`, { height: 300 });
    log(`glass/${shape}`, r);
    manifest.glass[shape] = { ...profile, width: r.width, height: r.height };
  }

  // ----- taps: one per hand-written beer, in BEERS order -----
  const tapSheets: [string, number][] = [
    ['props/taps-1.png', 6], ['props/taps-2.png', 6], ['props/taps-3.png', 6], ['props/taps-4.png', 6], ['props/taps-5.png', 7],
  ];
  let tapIndex = 0;
  let tapBytes = 0;
  for (const [file, n] of tapSheets) {
    const img = await load(file);
    chromaKey(img, 'green');
    const cuts = splitColumns(img, n);
    for (let i = 0; i < n; i++) {
      const r = await save(img, bbox(img, cuts[i], cuts[i + 1]), `taps/${tapIndex}`, { height: 300 });
      manifest.taps.push({ width: r.width, height: r.height });
      tapBytes += r.bytes;
      tapIndex++;
    }
  }
  total += tapBytes;
  console.log(`  ${`taps/0..${tapIndex - 1}`.padEnd(30)} ${tapIndex} taps    ${(tapBytes / 1024).toFixed(0).padStart(4)} KB`);

  await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest) + '\n');
  console.log(`\n  total ${(total / 1024 / 1024).toFixed(1)} MB  →  ${OUT}/manifest.json`);
}

await build();
