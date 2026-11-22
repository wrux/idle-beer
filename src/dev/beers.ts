/** Every beer, full and at rest, side by side (dev only): /beers.html?fill=0.6&tilt=0.5 */
import { BEERS } from '../data/beers';
import { drawGlass, drawGlassAura } from '../ui/art/glass';

const q = new URLSearchParams(location.search);
const fill = Number(q.get('fill') ?? 1), tilt = Number(q.get('tilt') ?? 0);
const grid = document.getElementById('grid')!;
const cells = BEERS.map((beer, i) => {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = 260;
  c.height = 320;
  const cap = document.createElement('figcaption');
  cap.textContent = `${i}. ${beer.name}`;
  fig.append(c, cap);
  grid.appendChild(fig);
  return { beer, ctx: c.getContext('2d')! };
});

const frame = (now: number) => {
  const t = now / 1000 + 20;
  for (const { beer, ctx } of cells) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 260, 320);
    const s = 3 * (beer.look.size ?? 1);
    // Stand every glass on the same line, whatever its size.
    ctx.translate(130, 280 - 30 * s);
    ctx.scale(s, s);
    ctx.rotate(-tilt);
    drawGlassAura(ctx, beer.look, t);
    drawGlass(ctx, {
      look: beer.look, fill, foam: 5 * beer.look.foamScale, down: { x: -Math.sin(tilt), y: Math.cos(tilt) }, slosh: 0, t,
      pouring: false,
    });
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
