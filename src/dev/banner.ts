/**
 * Banner and screenshots for the README (dev only): the real scene, with a full pub, no HUD.
 * /banner.html?pub=festival&beer=5&lift=1&fill=0.5&title=0
 */
import { newDrinkState } from '../core/drinking';
import { beerAt } from '../data/beers';
import { DRINKERS } from '../data/drinkers';
import { LOCATIONS, LOCATION_BY_ID } from '../data/locations';
import { StageRenderer } from '../ui/art/stage';
import { computePose } from '../ui/scene';

const q = new URLSearchParams(location.search);
const pub = LOCATION_BY_ID.get(q.get('pub') ?? 'redlion') ?? LOCATIONS[0];
const beerIndex = Number(q.get('beer') ?? 1);
const tiers = Number(q.get('tiers') ?? 10);
// title=0 is the bare scene, for the README's screenshots; otherwise the name goes along the bar.
document.documentElement.classList.toggle('plain', q.get('title') === '0');

const beer = beerAt(beerIndex);
const stage = new StageRenderer(beer.look);
document.getElementById('scene')!.appendChild(stage.root);
stage.setBeer(beer.look, beerIndex);
stage.setLocation(pub);
// A lively pub: plenty of the first `tiers` drinker types.
stage.setCrowd((id) => (DRINKERS.findIndex((d) => d.id === id) < tiers ? 4000 : 0));

const ds = newDrinkState(Number(q.get('fill') ?? 1));
ds.lift = Number(q.get('lift') ?? 0);
const frame = (now: number) => {
  stage.render(computePose(ds, beer.look.glass, beer.look.foamScale, stage.layout), now / 1000 + 20);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
