/**
 * The picture that goes with a shared link (dev only): the real pub, full of people, with the
 * name on a board beside it. Screenshot /share.html at 1200x630 for public/og.jpg.
 * /share.html?pub=redlion&beer=3&lift=0.55&fill=0.7
 */
import { newDrinkState } from '../core/drinking';
import { beerAt } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { LOCATIONS, LOCATION_BY_ID } from '../data/locations';
import { StageRenderer } from '../ui/art/stage';
import { computePose } from '../ui/scene';

const q = new URLSearchParams(location.search);
const pub = LOCATION_BY_ID.get(q.get('pub') ?? 'redlion') ?? LOCATIONS[0];
const beerIndex = Number(q.get('beer') ?? 3);
const beer = beerAt(beerIndex);

const stage = new StageRenderer(beer.look);
document.getElementById('scene')!.appendChild(stage.root);
stage.setBeer(beer.look, beerIndex);
stage.setLocation(pub);
// A good mixed crowd: the first dozen sorts of drinker, plenty of each.
stage.setCrowd((id) => (DRINKERS.findIndex((d) => d.id === id) < Number(q.get('tiers') ?? 12) ? 4000 : 0));

// On a wide picture the board covers the right-hand side, so look that way a little.
const board = document.querySelector<HTMLElement>('.board')!;
const fit = () => {
  const wide = innerWidth / innerHeight > 1.25;
  stage.setCover(wide ? innerWidth - board.getBoundingClientRect().left + innerWidth * 0.03 : 0);
};
addEventListener('resize', fit);
fit();

const ds = newDrinkState(Number(q.get('fill') ?? 1));
ds.lift = Number(q.get('lift') ?? 0);
const frame = (now: number) => {
  stage.render(computePose(ds, beer.look.glass, beer.look.foamScale, stage.layout), now / 1000 + 20);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
