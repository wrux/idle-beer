/** Small canvases for the shop, drawn with the same rigs as the scene so everything matches. */
import type { BeerLook } from '../../data/beers';
import { BACKDROPS } from './backdrops';
import { circle, rgrad } from './draw';
import { Figure } from './figures';
import { drawGlassIcon } from './glass';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * 1.5;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return [c, ctx];
}

/** Each drinker's backdrop colour in their portrait. */
const BACKS: Record<string, string> = {
  regular: '#3f5a48', student: '#3a2f5c', darts: '#5c2a24', stag: '#5a2a48', rugby: '#2f5a3a', supporters: '#2a3f6a',
  wmc: '#5a4428', beerfest: '#4a4a2a', musicfest: '#2a5a5c', chain: '#39405a', bankhol: '#2f6a8a', streetparty: '#6a2a34',
  toast: '#2a5c4a', lunar: '#2a3144', crawl: '#2f2a5c', galactic: '#1f1f52', blackhole: '#1a1030', multiverse: '#4a2a6a',
};

/** Head and shoulders of a drinker, in a round frame. */
export function drinkerPortrait(id: string, size = 46): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.clip();
  const back = BACKS[id] ?? '#3a2a1c';
  ctx.fillStyle = rgrad(ctx, r, r * 0.8, 0, r * 1.3, ['#ffffff', back]);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgrad(ctx, r, r * 0.7, 0, r * 1.4, [back, '#150c14']);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  // Local y runs from about -106 (hat) to -30 (chest).
  const s = size / 70;
  ctx.translate(r, size + 26 * s);
  ctx.scale(s, s);
  const seeds: Record<string, number> = { student: 5, toast: 3, musicfest: 2, supporters: 4 };
  new Figure(id, seeds[id] ?? 1).drawBust(ctx);
  return c;
}

/** A full pint of a beer. */
export function beerIcon(look: BeerLook, size = 46): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  circle(ctx, size / 2, size / 2, size / 2, 'rgba(255,236,200,0.06)');
  const s = size / 72;
  ctx.translate(size / 2, size / 2);
  ctx.scale(s, s);
  drawGlassIcon(ctx, look);
  return c;
}

/** A postcard of a pub: its sky, its walls and its lights, without the people. */
export function pubThumb(id: string, w = 76, h = 56): HTMLCanvasElement {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * 1.5;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    // Show world x 60..340, y 6..212.
    const s = (w * dpr) / 280;
    ctx.setTransform(s, 0, 0, s, -60 * s, -6 * s);
    return [c, ctx] as const;
  };
  const b = BACKDROPS[id] ?? BACKDROPS.redlion;
  const [c, ctx] = make();
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  b.far(ctx, 1.3);
  if (b.shell) {
    // The shell punches its windows out, so it needs a layer of its own.
    const [layer, lctx] = make();
    b.shell(lctx);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  b.mid?.(ctx, 1.3);
  return c;
}
