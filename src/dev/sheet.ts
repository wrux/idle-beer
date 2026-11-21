/**
 * Character sheet (dev only): every drinker type, large, plus the player in a few poses.
 * Open /sheet.html on the dev server. `?only=regular,student` narrows it, `?scale=4` zooms,
 * `?act=sip|talk|laugh|special|cheer` holds everyone in that pose (`&at=steps` shows a sip in three stages).
 */
import { newDrinkState } from '../core/drinking';
import { BEERS } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { Figure } from '../ui/art/figures';
import { drawGlass } from '../ui/art/glass';
import { Hero } from '../ui/art/player';
import { LAYOUT } from '../ui/art/stage';
import { computePose } from '../ui/scene';

const q = new URLSearchParams(location.search);
const only = q.get('only')?.split(',');
const S = Number(q.get('scale')) || 2.6;
const types = DRINKERS.filter((d) => !only || only.includes(d.id));
const PER = 3, CW = 70, CH = 124;
const showHero = !only || only.includes('hero');
const cols = Math.min(types.length * PER, 9) || 1;
const rows = Math.ceil((types.length * PER) / cols);
const heroH = showHero ? 250 : 0;

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
const dpr = 2;
canvas.width = Math.max(cols * CW, 560) * S * dpr;
canvas.height = (rows * CH + heroH) * S * dpr;
canvas.style.width = `${canvas.width / dpr}px`;
canvas.style.height = `${canvas.height / dpr}px`;
const ctx = canvas.getContext('2d')!;

const figures = types.flatMap((d, ti) => Array.from({ length: PER }, (_, k) => {
  const f = new Figure(d.id, k * 17 + 3);
  const i = ti * PER + k;
  f.x = (i % cols) * CW + CW / 2;
  f.headY = Math.floor(i / cols) * CH + 62;
  f.flip = k === 2 ? -1 : 1;
  f.settle();
  f.held = (q.get('act') as typeof f.held) ?? null;
  // `?act=sip&at=steps` shows the lift in three stages across each type's three figures.
  f.holdAt = q.get('at') === 'steps' ? [0.3, 0.6, 1][k] : Number(q.get('at') ?? 1);
  if (q.get('at') === 'steps') f.flip = 1;
  return f;
}));

const hero = new Hero();
const poses = [[0, 1], [0.6, 0.8], [1, 0.4], [1, 0.05]].map(([lift, fill]) => {
  const ds = newDrinkState(fill);
  ds.lift = lift;
  return computePose(ds, 'nonic', 1, LAYOUT);
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
  ctx.fillStyle = '#6a5442';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const f of figures) {
    f.update(dt);
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x - CW / 2, f.headY - 62, CW, CH);
    ctx.clip();
    f.draw(ctx, t);
    ctx.restore();
  }
  if (showHero) {
    poses.forEach((pose, i) => {
      ctx.save();
      ctx.translate(i * 140 - 90, rows * CH - 50);
      ctx.beginPath();
      ctx.rect(92, 52, 136, 246);
      ctx.clip();
      hero.update(10, pose); // jump straight to each pose
      hero.drawBody(ctx, pose, t);
      ctx.fillStyle = '#7a4a28';
      ctx.fillRect(80, 206, 200, 100);
      hero.drawArm(ctx, pose, t);
      ctx.save();
      ctx.translate(pose.lip.x, pose.lip.y);
      ctx.rotate(-pose.tilt);
      ctx.scale(pose.scale, pose.scale);
      ctx.translate(-pose.lipLocal.x, -pose.lipLocal.y);
      drawGlass(ctx, { look: BEERS[1].look, fill: pose.fill, foam: pose.foam, down: pose.down, slosh: 0, t, pouring: false });
      ctx.restore();
      hero.drawFingers(ctx, pose, t);
      ctx.restore();
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
