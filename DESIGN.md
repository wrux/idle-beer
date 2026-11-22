# idle.beer — Game Design Plan

A UK pub-themed incremental (idle/clicker) web game. You start as one person in a pub
with one pint. Click and **hold** to lift the glass and drink it. Pints are the currency.
Spend them on better beers, more drinkers, and upgrades until you are running a
galaxy-spanning lock-in that drinks absurd numbers of pints per second.

> Name and domain: **idle.beer**. "Last Orders" is the name of the prestige reset.

---

## 1. Design pillars

1. **A tactile core action.** Click-and-hold to drink is the hook. It should feel good:
   the glass tilts up, the beer drains, foam clings to the sides, there's a satisfying
   "ahh" and the empty glass thunks back down.
2. **Very British, gently silly.** Real pub culture early on (regulars, darts team, stag
   dos), escalating to ridiculous scale (national bank holiday, lunar brewery, multiverse
   lock-in).
3. **Numbers go up. A lot.** The engine must handle numbers far beyond `1e308` (where
   normal JavaScript numbers become `Infinity`) without losing performance.
4. **Simple to build, easy to tune.** Plain web app, all game content in data files, a
   balancing simulator to check pacing.

---

## 2. Core loop

```
Hold to drink ──► earn Pints ──► buy Drinkers / Beers / Upgrades
      ▲                                     │
      └──── more Pints per drink & per second ◄┘
                         │
          (later) Last Orders prestige ──► Beer Mats ──► permanent bonuses
```

### 2.1 The drinking mechanic (click and hold)

- The player's pint sits on the bar in front of their character.
- **Press and hold** (mouse, touch, or Space) → the glass lifts and tilts, the liquid
  level drops over **Drink Time** (starts at 1.5 s).
- **Release early** → the glass goes back down, keeping its current level. Progress is
  never lost, so holding is about speed, not punishment.
- **Pint finished** → earn **Pints per Drink** (starts at 1), the glass refills (a short
  pour animation, 0.5 s, reduced by upgrades) and you can drink again.
- **Keep holding through the refill** and the next pint starts automatically, so the
  player can just hold down.
- **Chug streak:** finishing pints back to back (less than 1 s between them) builds a
  streak that gives up to +50% per drink at the start (upgradeable). It shows as a small
  combo meter. This rewards active play without making idle play pointless.

Upgrades change the feel of drinking over time:

| Upgrade line            | Effect                                              |
|-------------------------|-----------------------------------------------------|
| Bigger Gulps            | Drink Time ×0.8 each (down to a floor of 0.25 s)    |
| Quick Pour / Pump Clip  | Refill time shorter                                 |
| Two-Handed / Yard of Ale| Pints per Drink multipliers                         |
| Down in One             | A single click finishes the pint instantly          |
| Liquid Lunch            | Each drink also earns 0.1 / 0.2 / 0.3 / 0.5 / 1 / 2 extra seconds of Pints per second (like Cookie Clicker's "cursor scales with CpS") |

The last one matters: it keeps the active drinker relevant once idle production is huge.

### 2.2 Currency

- **Pints** is the main currency (both score and money). Shown as e.g. `1.23 million pints`.
- **Pints per second (PPS)** is the idle production from drinkers.
- **Lifetime Pints** counts towards achievements, location unlocks and prestige.
- **Beer Mats** is the prestige currency (section 6).

---

## 3. Drinkers (idle generators)

You "pay for more people to drink". Each drinker type produces pints per second. Cost
grows **×1.15 per one owned** (the standard formula). Up to the Bank Holiday each tier costs
roughly 11–14× more than the one before and produces about 6–8× more. After that the steps widen
(×30 up to ×1,000 in price for ×9 up to ×45 the pints), so the last drinker arrives at 1e27, not
1.2e20: see the rebalance in section 8.8.

| #  | Drinker                    | Base cost | Base PPS    | Flavour                                     |
|----|----------------------------|-----------|-------------|---------------------------------------------|
| 1  | The Regular                | 10        | 0.1         | Old fella who's had the same stool since 1974 |
| 2  | Uni Student                | 100       | 1           | Here for the £2 Tuesday deal                 |
| 3  | Darts Team                 | 1.1K      | 8           | Treble twenty, treble pint                   |
| 4  | Stag Do                    | 12K       | 47          | Matching T-shirts, unclear groom             |
| 5  | Rugby Club                 | 130K      | 260         | Boat races every Saturday                    |
| 6  | Supporters' Club           | 1.4M      | 1.4K        | Pre-match, half-time, post-match             |
| 7  | Working Men's Club         | 20M       | 7.8K        | Subsidised bitter and a meat raffle          |
| 8  | Beer Festival              | 330M      | 44K         | Tasting glasses, real ale, sandals           |
| 9  | Music Festival             | 5.1B      | 260K        | Warm cans in a muddy field                   |
| 10 | Pub Chain                  | 75B       | 1.6M        | Every high street, same carpet               |
| 11 | Bank Holiday               | 1T        | 10M         | The whole nation goes to the pub             |
| 12 | Royal Street Party         | 30T       | 65M         | Bunting as far as the eye can see            |
| 13 | Global Toast               | 1.5Qa     | 560M        | Cheers in every language                     |
| 14 | Lunar Brewery              | 100Qa     | 5.6B        | Low gravity, high ABV                        |
| 15 | Interplanetary Pub Crawl   | 10Qi      | 70B         | Next stop: Mars Arms                         |
| 16 | Galactic Happy Hour        | 2Sx       | 1.3T        | Two-for-one across the Milky Way             |
| 17 | Black Hole Barfly     | 1Sp       | 40T         | Last orders lasts forever here               |
| 18 | Multiverse Lock-In         | 1Oc       | 1.8Qa       | Infinite pubs, infinite yous, infinite pints |

The Regular is the first drinker, so the "one person in the pub" opening is literally
the player alone, with the first purchase adding someone at the bar.

**Bulk buying:** Buy ×1 / ×10 / ×100 / Max. Use the closed-form geometric-series
formulas (section 8.3) so "Max" works instantly even for millions of units.

**Visuals:** owned drinkers appear in the pub scene (one small sprite per type, with a
count badge after a few, so the scene never fills up with thousands of sprites).

---

## 4. Beers (the "better beers" line)

> **As built now.** There are 27 beers and no generated ones: the list ends at The Final Pint.
> They run from pub beers (Half of Shandy, Pint of Bitter, Mild, Nitro Stout, Hazy IPA) through
> beers from abroad (Kölsch, Hladinka, Mlíko, Hefeweizen, Maß, Tripel, Scotch Heavy, Winter
> Warmer, Somaek, Sake Bomb, Yard of Ale) to ones from nowhere (Viking Mead, Grog, Dwarven Stout,
> Fairy Cider, Dragon's Breath, Moon Mead, Alien Lager, Dark Matter Porter, Schrödinger's Pint,
> Singularity Stout). Each has its own glass (twelve shapes, three of them opaque: horn, pewter,
> stone), size, or trick (a settling cascade, a glass of foam, a sunk shot, steam, smoke, floating
> blobs, sinking bubbles, flickering in and out). Costs followed the old ladder up to 1e145 until the
> rebalance in section 8.8: from Scotch Heavy on they now sit two to three powers of ten apart
> (1e26, 1e29, 1e31, 1e33 … The Final Pint at 1e59), because past the last drinker the beers are
> what keeps a run moving. The multipliers were re-spread so the total is about what the old 31 gave. Save version 4 maps an old
> beer to the dearest new one that cost no more. `/beers.html` shows them all. The table below is
> the original plan.

Beers are a tiered upgrade line that changes the pint in your hand (glass shape, colour,
foam) and applies a **global multiplier** to everything. They're bought in order, once each,
and each one appears in the store when lifetime pints reach half its price. (Prices were
raised about 10× after the Phase 3 pacing simulation.)

| Tier | Beer                         | Price             | Effect                    | Look                     |
|------|------------------------------|-------------------|---------------------------|--------------------------|
| 0    | Warm Watery Lager            | start             | ×1                        | Pale yellow, flat        |
| 1    | Pint of Bitter               | 200               | ×1.5 all                  | Amber, nonic glass       |
| 2    | Best Bitter                  | 20K               | ×2                        | Deeper amber             |
| 3    | Proper Real Ale (cask)       | 2M                | ×2                        | Hand-pulled, tight head  |
| 4    | Session IPA                  | 200M               | ×2                        | Hazy gold                |
| 5    | Irish-style Stout            | 20B                | ×3                        | Black with a creamy head |
| 6    | Craft Double IPA             | 2T                | ×3                        | Hazy, in a tulip glass   |
| 7    | Barley Wine                  | 200T               | ×4                        | Ruby, snifter            |
| 8    | Landlord's Secret Reserve    | 50Qa               | ×5                        | Glowing faintly          |
| 9    | Moon Mead                    | 1e20               | ×6                        | Silver, shimmering       |
| 10   | Dark Matter Porter           | 1e23              | ×8                        | Absorbs light            |
| 11   | Nectar of the Gods           | 1e27              | ×10                       | Golden, with sparkles    |
| 12   | Singularity Stout            | 1e32              | ×15                       | The glass bends space    |

After Singularity Stout come 18 more hand-written beers (Quasar Quadrupel, Pulsar Pilsner, Nebula Hazy IPA,
Supernova Saison, Wormhole Wheat Beer, Antimatter Ale, Big Bang Bitter, Entropy Export Stout, Higgs Barley Wine,
Dark Energy Dubbel, Cosmic String Sour, Heat Death Helles, Schrödinger's Shandy, Planck-Length Porter, Paradox
Pale Ale, Omniverse Old Ale, Eternity Lager, The Final Pint), up to 1e145. After that, beers are generated forever:
each has a unique name (prefix × style × suffix, 9,600 combinations before a "Mk 2" lap), its own colour, glass and
effect, costs ×1e8 the previous one and multiplies everything ×3. (This replaced the original "Brew Again" ×2 levels.)

---

## 5. Upgrades

All upgrades are one-off purchases in an upgrade row above the drinkers list. They
appear when their unlock condition is met (Cookie Clicker style). The categories:

1. **Drinker upgrades:** for each drinker, at 1 / 5 / 25 / 50 / 100 / 150 / 200 / 250 /
   300 / 400 / 500 owned, that drinker's output ×2. Cost about 10× / 50× / 500× … the
   drinker's base cost. Named per drinker (e.g. Regular: "Own Tankard", "Name on the Stool",
   "Lifetime Tab"; Darts Team: "Tungsten Darts", "Oche Extension", …).
2. **Drinking upgrades:** the click lines in section 2.1.
3. **Synergies:** "Students join the Rugby Club": Students +5% per Rugby Club owned, and
   so on. These create interesting buying choices.
4. **Pub upgrades:** cosmetic plus small global bonuses. Jukebox, Fruit Machine, Pub Quiz
   Night, Beer Garden, Sky Sports, Sunday Roast, Lock-in Licence.
5. **Reputation:** each achievement earns Reputation. Nine Reputation upgrades ("Local Legend",
   "Name on the Wall", "Blue Plaque"… "The Myth, the Legend") unlock at 10–140 achievements, cost
   1e6–1e41, and each multiplies everything by (1 + rate × achievements), with rates from 0.5% to 2%.
   This is the same role as Cookie Clicker's milk/kittens. (Rates were halved after a pacing run.)

Target: about 250 upgrades at launch, mostly generated from templates in the data files,
not written one by one.

---

## 6. Prestige: "Last Orders"

> **Whose side of the bar.** You are the regular, not the landlord, and the wording says so
> throughout. The landlord calls Last Orders; your button is "Drink up". You black out, and "the
> morning after" you find Beer Mats in your pockets and spend them on being a **Local Legend** (the
> tree that used to be the Landlord's Licence, and is still `licence` in the code). Its auto-buyers
> are favours from the staff, pubs are places you get known by standing the house a round, and
> drinkers are people you get a round in for. Below, "ring the bell" and "Licence" are the old names.

When the bell rings you can call **Last Orders**: reset pints, drinkers and non-permanent
upgrades in exchange for **Beer Mats**.

- `beerMatsTotal = floor( cbrt( lifetimePintsAllRuns / 1e12 ) )`
  (first mat at 1 trillion lifetime pints; the cube root means it scales slowly).
- Mats earned on a reset = `beerMatsTotal − beerMatsAlreadyEarned`.
- **Each unspent Beer Mat gives +1% to all production** (+2% after an upgrade).
- Mats can also be **spent** on a permanent **Landlord's Licence** tree (about 30 nodes):
  start with a free Regular, keep beer tier on reset, longer offline progress, more Free
  Round events, auto-buyers, "Down in One" from the start, and so on.
  Spending is a trade-off against the passive bonus.

**The Licence is a tree.** Its 30 nodes sit on a grid round a hub: each branch starts as a line out
from the middle and then forks in its own way (`SHAPE` in `data/licence.ts`), so a node's
prerequisite is not always the tier before it. You only see nodes you own, nodes you can buy,
and a "?" for whatever each of those would open; buying one reveals the next.

**Ringing the bell** asks first, in a dialog that says what you lose and what you bank. On yes, a
room starts to swim, your eyelids droop and you black out (`ui/blackout.ts`); the reset happens
in the dark, and you come round on an "After hours" screen with nothing but the tree. A button takes you back
to the pub.

**As built (Phase 6):** the Licence has six branches of five nodes (Regulars, Brewing, Charm,
Management, Technique, Collecting). Each node needs the one before it in its branch and costs
1 / 4 / 15 / 60 / 250 mats by tier (330 per branch, 1,980 for all of it; since repriced, see "The
long tree" below). What a reset keeps:
achievements, lifetime stats (drinks, best streak, Free Rounds, play time), all-time pints, mats and
the Licence. Everything else, including the location, starts again. Save format version 2 added
these fields, and v1 saves migrate automatically. A casual first run (holding to drink a quarter of
the time) reaches about 10 mats in 1h 40m in the simulator.

**The long tree.** The thirty nodes above cost 1,980 mats between them, and a run that reaches
1e24 pints pays ten thousand, so the tree used to be finished almost as soon as it was started.
Each branch now carries on from its fifth node (`data/licence.ts`):

- **A line of thirty steps**, the same plain boost each time, numbered in the tree ("Cellar Craft 7"):

| Branch | Line | Each step |
|--------|------|-----------|
| Regulars | Round for the House | Drinkers ×10 |
| Brewing | Cellar Craft | Everything ×10 |
| Charm | Happier Hours | Happy Hour's multiplier +2 |
| Favours | Late Licence | 2 more hours away |
| Technique | Drinking Arm | 1 more second of drinkers' output per pint drunk |
| Collecting | Bigger Pockets | Mats ×8 |

- **Four one-off perks** hanging off it, round in the tree: the first off the fifth node (1e10 to
  1e20 mats), the others off steps 10, 20 and 30 at five times that step's price.

The middle of the tree was repriced with it. The first three nodes of a branch are still 1, 4 and
15 mats, but the fourth is 300 to 10,000 and the fifth 30,000 to 100 million, each branch its own
price (Technique cheapest, Collecting dearest). Mats themselves were left alone: a run still pays
tens, then thousands, then 1e20 within about thirty runs. The prices climb to match, so there is
one thing to buy every run or two all the way up, where before all thirty were bought by 3,000.

| Branch | One-off perks |
|--------|---------------|
| Regulars | Full House (walk in to 50 each of the first nine drinkers) · Packed to the Rafters (+1% per drinker in the pub) · Coach Party (walk in to 100 of every drinker) · Everybody Knows Your Name (drinkers 90% cheaper) |
| Brewing | Cellar Key (keep your beer) · Connoisseur (×1.5 per beer past the first) · Brewery Tap (beers 99% cheaper) · Master Brewer (×2 per beer) |
| Charm | Fortune's Favourite (Lucky Rounds ×5) · Round After Round (Free Rounds twice as often) · Golden Touch (rewards last three times as long) · Talk of the Town (+2% per achievement) |
| Favours | Keys to the Pub (pubs stay open through Last Orders) · Open All Hours (100% while away) · Pub Crawl Legend (every open pub's perk at once) · Photographic Memory (keep every upgrade) |
| Technique | Bottomless (streak to +250%) · Never Spill a Drop (3 s more streak slack) · Hollow Leg (hand pints ×100) · One for the Road (+10 s of drinkers' output per pint) |
| Collecting | Framed Collection (+10% per unspent mat) · Trophy Cabinet (+1% mats per achievement) · Mint Condition (+25% per mat) · The Complete Set (spent mats count too) |

- **Two perks that change how the game is played.** The first hangs off the middle of the tree
  for 50 to 4,000 mats, so it turns up in the first few nights; the second hangs off step 5 of the
  long line.

| Branch | Early (mats) | Late |
|--------|--------------|------|
| Regulars | Plus One (120): every drinker bought brings a free one of the kind before | Never Go Home: a tenth of your drinkers stay through Last Orders |
| Brewing | Guest Ale (50): a new beer starts a Happy Hour | Cellar-Aged: +1% to everything per minute of the night, up to +1,000% |
| Charm | Doubles All Round (250): a Free Round gives two rewards | Never-Ending Happy Hour: a reward you already have gets longer |
| Favours | Table Service (1,500): Free Rounds claim themselves | Whip-Round: start with 1% of last night's pints |
| Technique | Second Nature (700): left alone he drinks at full speed | Unbroken: a broken streak halves |
| Collecting | Counted Already (4,000): tonight's mats count towards the bonus before Last Orders | Collectors' Fair: each mat's bonus +1% per perk owned |

  Cellar-Aged and Counted Already both pay for staying in a night longer, which is the point: they
  pull against calling Last Orders the moment it would pay. Both change with time, so `main.ts`
  recalculates once a second while either is owned.

246 nodes, about 3e99 mats for all of them. The long lines curve as they go, like the arms of a
spiral. You still only see what you own, what you can buy and a "?" beyond; the tree screen fits
itself to what you have found, and the title counts them.

**How the long lines are priced.** Past the last beer nothing in the shop grows any more, so a
run's pints go as (your multiplier × time). Mats are the cube root of pints times the mat bonus,
and the mats you hold multiply everything, so drinkers ×10 and everything ×10 are worth ×10 the
mats between them and mats ×8 is worth ×22.6: ×226 a round of the six. Prices go up ×240 a round,
and within a round each line is priced by what you have when you reach it. Two things to know
before touching any of it:

- **Where it starts (1e23.4 mats).** With a few thousand mats' bonus a run goes through every beer
  in seconds and pays about 1e20 mats, so anything cheaper is bought without a night's drinking.
  The first one-off perks sit in that stretch on purpose, as something to pick up on the way.
- **It is sensitive.** Time per run goes as the square of (price ÷ what you can earn), so a perk
  that makes mats come a little faster than its price allows makes runs much shorter. The steps
  after 10 and 20 are dearer by what the one-off perks there add (`UNIQUE_BUMPS`).

Simulated (holding half the time, Last Orders whenever it would double your mats, half of them
spent): the first ten runs take about 6h 15m between them and the next twenty a few minutes (the
stretch above, buying a node of the middle or a first one-off perk most runs), then about 190 more
runs of up to fifty minutes each buy the long lines, about 37 hours in all. The simulator ignores Free Rounds and Cellar-Aged, and counts no time for the tree screen.

**Tonight's special and Challenge nights** (`data/nights.ts`, `core/nights.ts`). Two things to
choose on the morning after, in a card under your mats, so that one night is not like the last.
Neither is earned by counting Last Orders: a prize comes from a night's drinking, not from ringing
the bell often.

- **Tonight's special.** Three of ten are laid out after every Last Orders and you may pick one.
  It lasts the night: Two for One (drinkers half price), Thirsty Crowd (drinkers ×3), Strong Stuff
  (everything ×2), Big Hands (hand pints ×10), Lucky Night (Lucky Rounds ×5), Busy Night (Free
  Rounds three times as often), Long Hours (rewards last three times as long), Brewery Visit (beers
  90% cheaper), On a Roll (streak to +200%), Lock-In (100% while away).
- **Challenge nights.** One at a time, taken on the morning after. Drink the goal *during the
  night* (pints you walked in with don't count) and the prize is yours for good. The handicap
  stays on until Last Orders whether you have beaten it or not: at first it lifted the moment the
  goal fell, and for a player with a big mat bonus that was seconds in, so the challenge looked as
  if it had never worked. Call Last Orders before the goal and it is lost, to try another night.

| Challenge | Handicap | Goal | Prize, for good |
|-----------|----------|------|-----------------|
| Drinking Alone | No drinkers | 1e8 | Hand pints ×10 |
| Dry January | Pints you drink yourself count for nothing | 1e12 | Drinkers ×2 |
| Empty Shelves | No upgrades | 1e13 | Everything ×1.5 |
| Shandy Night | No new beers | 1e14 | Everything ×2 |
| Your Round | Drinkers cost ×10 | 1e15 | Drinkers 20% cheaper |
| Empty Pockets | Beer Mats give no bonus | 1e18 | Each mat's bonus ×1.25 |

Specials, handicaps and prizes are all lists of the tree's own effects, folded in by `mods(state)`,
so nothing else in the economy knows they exist beyond five small switches (`noDrinkers`, `noHand`,
`noUpgrades`, `noBeer`, `noMats`). Both show as tags beside the timed rewards during the night;
the challenge's tag counts up to its goal and then shows a tick. The card itself is only on the
morning-after screen: during the night the Last Orders panel is left to the bell. The
save gained `special`, `specialOffer`, `challenge`, `challengeBase` and `challengesDone`; old saves
simply have none. The goals are fixed, so a player deep in the tree will find the early ones easy:
they are meant for the first dozen nights. On screens under 860px, where the side column is hidden
after hours, the card sits across the bottom above the way back to the pub.

**The Big Bang** (`core/bang.ts`, `data/bang.ts`, `ui/bigBang.ts`). The layer above Last Orders,
and the answer to the long lines being a grind: the simulator reaches it at about eight hours,
which is where the long lines begin.

- **When.** Drink 1e100 pints in a single night and there is no beer left anywhere. Nobody is
  asked: a black hole opens in the middle of the pub and grows until it is all there is, three
  lines are said in the dark, a point of light becomes everything, and the Big Bang screen comes up
  out of the glare. (The first version spun the whole page down a plughole, which looked cheap.)
  The save records that you are on that screen (`voidOpen`), so a reload comes back to it. The whole
  game is paused during the scene and for as long as that screen is up, whether you arrived by
  Big Bang or by the button: nothing is drunk or bought and the stopwatch does not run. After a Big Bang the
  screen has no close button and ignores Escape: the one way on is "Start the next universe",
  which is when the stopwatch starts. Nothing hints at the first one. From then on a meter under the counter shows how close
  this universe is (counted in noughts, so halfway along is 1e50), and a button along the top
  opens the Big Bang screen.
- **What goes.** Everything a Last Orders takes, and Beer Mats and the Local Legend tree with it.
  Achievements, stats, challenge prizes and Black Hole Beers stay.
- **What you get.** One Black Hole Beer, one more if the universe lasted under two hours of play
  and another under twenty minutes, plus whatever the Singularity perks add.
- **What they buy.** Sixteen perks for exactly 100: three columns of five costing 1, 2, 4, 8 and
  16, bought top to bottom, and a last one for 7 that needs the bottom of all three.

| | Matter | Time | Singularity |
|---|--------|------|-------------|
| 1 | Primordial Soup: everything ×1e6 | Déjà Vu: start with all three auto-buyers and Down in One | Event Horizon: +1 Black Hole Beer a Big Bang |
| 2 | Inflation: drinkers 7% dearer each, not 15% | No More Mornings: mats arrive as you drink and the tree is always open | Gravity Well: everything ×2 per Black Hole Beer held |
| 4 | Dark Energy: everything ×100 | Crowded Universe: walk in to 500 of every drinker | Spaghettification: long-line steps cost their square root |
| 8 | Free Bar: beers and upgrades cost nothing | Legend in Your Sleep: the tree's perks are bought for you | Hawking Radiation: +2 Black Hole Beers a Big Bang |
| 16 | Heat Death Postponed: everything ×10,000 | Mat Storm: mats ×1e6 | Small Universe: runs dry at 1e50 |

  And The Last Pint of All: everything ×1e100.

Primordial Soup is the one great leap. Dark Energy was ×1e12, Heat Death Postponed ×1e30 and
Gravity Well ×10 a beer at first; in play Dark Energy alone took a six-minute universe to twelve
seconds, because a multiplier that size skips the part where the auto-buyers fill the pub. They
are now ×100, ×10,000 and ×2 a beer: each should take a slice off the time, not most of it.

They are lists of the tree's own effects, folded in by `mods(state)`, with eight new kinds
(`costRatio`, `freeShop`, `liveMats`, `sqrtLines`, `bangBonus`, `bangGoal`, `voidPower`,
`autoLegend`). No More Mornings is second in its column on purpose: with it there is no Last Orders
to call, so a universe is one unbroken run. The screen is all black: you are inside the thing.

Simulated (`npm run simulate -- 0.5 1e15 4000 40`): the first universe lasts about 8 hours; the
second, with one perk, 36 seconds; by the sixth they are under ten seconds, and the whole tree is
bought in about 22 Big Bangs. The simulator buys everything in an instant, so a real universe is
limited by how fast the auto-buyers tick, a minute or two. That is deliberately quick, and
every universe is the same race to the same goal: it is a speed-run, and the time is the score.
A stopwatch beside the meter counts this universe's seconds of play, and the Big Bang screen
shows it against the fastest so far (`fastestUniverse`). It has not been played by hand.

**The end.** The Last Pint of All is the last thing to buy, and buying it ends the game. The next
universe you start (whenever the Big Bang screen next closes) is the last one: the pub is empty,
the shop, counters and buttons are out of sight, and The Final Pint stands full on the bar. Nobody
sips it for you and Down in One does not apply: you hold, for four seconds, and drink it. Then a
black screen says The End, with the Final Pint's own line, your play time and your fastest
universe, and one button: Start again, which wipes the save and goes back to the opening screen
with a new game. There is no carrying on. A reload mid-pint comes back to the empty pub (`finale`)
and a reload at The End comes back to The End (`finished`).

Debug: `?debug&scenario=one-to-go` has every perk but the last and the 7 beers to buy it;
`?debug&scenario=last-pint` is the last universe itself. `?debug&scenario=before-bang` is a night forty seconds short of the first one, and
`?debug&scenario=after-bang` a new universe with twelve Black Hole Beers to spend.

**Second layer (later, for truly massive numbers): "Brewery Empire".** You reset Beer
Mats for **Kegs**, which give exponential multipliers. Only needed once numbers pass
around `1e100`. The save already has a `kegs` field reserved for it; build it after launch.

### Pubs (levels you open and choose)

Each location is a pub you **open with pints** in the shop's Pubs tab (it is listed once lifetime
pints reach a tenth of its price), and you can **move between any you have opened**. Only the pub
you are in counts. Every pub gives +2% to everything per step along the list, plus a perk of its
own, so the newest is usually best for output but an older one can suit what you are doing:

| Pub | Price | Perk while you are there |
|-----|-------|--------------------------|
| The Red Lion | start | An extra second before a chug streak breaks |
| The Red Lion Beer Garden | 1K | Free Rounds turn up 20% more often |
| High Street Pub Crawl | 100K | Drinkers cost 5% less |
| City Centre Superpub | 10M | Pints drunk by hand count triple |
| Festival Field | 1B | Free Round rewards last 50% longer |
| The Whole Town | 100B | Drinkers keep going twice as long while you are away |
| Great British Boozer | 10T | Lucky Rounds pay double |
| The Highland Bothy | 1e14 | Chug streaks can build to +100% |
| The Mead Hall | 1e15 | Two extra seconds before a chug streak breaks |
| Prague Castle | 1e16 | Beers cost 20% less |
| Oktoberfest | 1e17 | Earn 75% instead of 50% while you are away |
| The Castle Bierkeller | 1e18 | Pints drunk by hand count five times |
| Red Square | 1e19 | Drinkers cost 10% less |
| The Forbidden City | 1e20 | Lucky Rounds pay triple |
| Seoul Pocha | 1e21 | Free Round rewards last twice as long |
| Tokyo Izakaya | 1e22 | Free Rounds turn up 35% more often |
| The Jolly Roger | 1e23 | Lucky Rounds pay four times |
| The Outback Pub | 3e24 | Everything drinks a further 10% more |
| The Earth Inn | 1e26 | Everything drinks a further 15% more |
| The Moon Under Water | 1e30 | Pints go down 30% faster |
| Solar System Social Club | 1e35 | Happy Hour is ×10 instead of ×7 |
| The Little Green Man | 1e39 | Free Rounds turn up twice as often |
| The Galaxy Arms | 1e43 | Drinkers cost 15% less |
| The Multiverse Tavern | 1e48 | Everything drinks a further 50% more |

Moving (or opening a pub, which moves you there) starts a **5 minute cooldown** before you can move
again, so a perk can't be picked up for a few seconds and dropped. Opening a pub is always allowed.

**Locals.** A pub can name `locals`: characters who are always found there, whoever you bring.
Three of them take fixed spots in the crowd (one at the bar) and your drinkers fill the rest.
The eleven pubs of the world tour (the Highlands to the Outback) each have their own, and an
Irishman turns up on the High Street and in The Whole Town. The Little Green Man, on somebody
else's planet, has three kinds of alien regular. Locals are art only: they cost
nothing and earn nothing.

Perks are data (`effects` in `data/locations.ts`) and reuse the Licence's effect kinds, so
`mods(state)` already includes the pub you are in. Pubs close again at Last Orders. Save format
version 3 added `pubs` and `pub`; older saves keep every pub their lifetime pints had reached.
The upgrades auto-buyer opens new pubs but never moves you.

**The shop** has the next beer on top, then three tabs: Drinkers, Upgrades (a list, with a badge
counting what you can afford) and Pubs.

---

## 7. Random events: "Free Round!"

The equivalent of Cookie Clicker's golden cookie. Every 3–8 minutes a frothing golden pint
slides along the bar or floats across the screen for about 12 s. Clicking it gives one of:

| Event            | Effect                                               | Weight |
|------------------|------------------------------------------------------|--------|
| Happy Hour       | PPS ×7 for 77 s                                      | 45%    |
| Lucky Round      | Instantly gain min(15% of bank, 900 s of PPS) pints  | 40%    |
| Down It!         | Pints per Drink ×777 for 13 s                        | 10%    |
| Pub Quiz Win     | All drinker costs −25% for 30 s                      | 5%     |
| (rare) Hangover  | PPS ×0.5 for 60 s (only with an opt-in "risky" upgrade) | —   |

Events stack with each other but not with themselves. Upgrades make them appear more
often and last longer.

---

## 8. Technical design

### 8.1 Stack

- **Vite + TypeScript**, no UI framework. The UI is a handful of panels with fast,
  targeted DOM updates, so a framework adds weight without much benefit.
- **break_infinity.js** (`Decimal` class) for all game numbers. It handles values up to
  about `1e9e15` (a 1 followed by 9 quadrillion zeros) and is designed for incremental
  games, so it's much faster than general big-number libraries.
  - If we ever want past that (tetration-level numbers), **break_eternity.js** has a
    near-identical API and can be swapped in. Keeping all maths behind our own
    `num.ts` wrapper makes that a one-file change.
- **One 2D canvas** for the whole scene, drawn in code every frame (section 13). No image
  assets and no art pipeline: every character, glass and location is shapes and rigs, so it is
  crisp at any size and everything can move.
- **Web Audio** for a few small sounds (glug, "ahh", glass clink, pub ambience), with mute.
- Static build, deployable anywhere (Cloudflare Pages, GitHub Pages, Netlify).

### 8.2 Handling massive numbers: rules

1. **Every game quantity is a `Decimal`.** Pints, costs, PPS, multipliers, lifetime stats.
   Plain `number` only for counts that stay small (drinkers owned, upgrade flags, time).
2. **Never compare with `<` or `>`.** Use `.gte()`, `.lt()` and so on. A lint rule or code
   review checklist enforces this.
3. **Work in log space for formulas that would overflow:** prestige roots, bulk-buy
   maths, max-affordable.
4. **Cache derived values.** PPS and Pints per Drink are recalculated only when something
   changes (a purchase, an event starting or ending, an achievement) via a `dirty` flag,
   not every frame.
5. **Avoid per-frame allocations.** Reuse `Decimal` instances in the hot tick path where
   possible. break_infinity supports in-place style operations.
6. **Saves store Decimals as strings** (`"1.234e5678"`), never as JSON numbers.
7. **A debug mode** (`?debug`) adds a tab on the edge of the screen that opens a dialog. It can
   load ready-made games (`src/dev/scenarios.ts`: brand new, an hour in, ready for the first Last
   Orders, twenty-four Last Orders later, the end of everything), set pints to `1e1000`,
   `1e100000` and `1e1e10` to check formatting, buying and saving at extreme values, and trigger
   a Free Round or Happy Hour.

### 8.3 Key formulas

```
cost(n-th unit)          = base × 1.15^owned
cost(buy k)              = base × 1.15^owned × (1.15^k − 1) / 0.15
maxAffordable(funds)     = floor( log_{1.15}( funds × 0.15 / (base × 1.15^owned) + 1 ) )

drinkerPPS(i)            = basePPS_i × owned_i × upgradeMult_i × synergyMult_i
totalPPS                 = Σ drinkerPPS(i) × beerMult × reputationMult × matMult × eventMult
pintsPerDrink            = (1 + flatBonuses) × drinkMult × beerMult × streakMult
                           + liquidLunchFraction × totalPPS
```

For "Max" buying at huge counts, `1.15^owned` is computed as `Decimal.pow(1.15, owned)`
and the log uses `Decimal.log10` / `Decimal.affordGeometricSeries` (built into
break_infinity).

### 8.4 Number formatting

There is one way numbers are written, and no setting for it:

- **In full** up to a million: `123,456`.
- **Named** from there to quintillion: `1.235 million`, `45.600 quintillion`. Other languages use
  their own words as far as `Intl` has them, which is about a quadrillion.
- **Scientific** after that: `1.23e21`. The names past quintillion are ones nobody can place, and
  the abbreviations that used to follow decillion (`QaDc`, `SpTg`) were worse.
- **Huge exponents:** once the exponent itself passes 1e6, show `e1.23e9` (an exponent
  of an exponent) so the number always fits in the counter.

Counters keep their decimals so they don't change width (`1.50e21`); prices and targets drop
trailing zeros (`1.5e21`, `1e59`). There used to be a Settings choice between names, scientific
and engineering, with a hidden achievement ("Name Your Poison") for changing it. Both are gone;
a save that has the setting or the achievement simply drops it.

Formatting lives in one `format.ts` module with unit tests at every boundary.

### 8.5 Game loop and time

- **Logic tick:** delta-time based, driven by `requestAnimationFrame`, with a minimum
  of about 20 ticks/s via `setInterval` as a backup when the tab is hidden (browsers
  throttle hidden tabs).
- **Rendering:** the counter updates every frame. Store prices and unlock checks update
  about 5 times a second.
- **Offline progress:** on load, `elapsed = now − lastSave`, granted at 50% PPS (upgradeable),
  capped at 1 hour (more with Licence upgrades). Shows a "While you were away…" popup.
- **Cheating the clock** (changing system time) is not worth defending against in a
  single-player game. Just clamp negative elapsed time to 0.

### 8.6 Saving

- **Autosave** to `localStorage` every 30 s and on `visibilitychange` / `beforeunload`.
- **Format:** JSON → base64 string with a `version` field and a **migration** function per
  version, so updates never break old saves.
- **Export / Import** a save string (copy and paste) and **Hard Reset** with a confirmation.
- Keep a single rolling backup slot so one corrupted save can be recovered.

### 8.7 Project structure

```
beer-incrimental/
├── index.html
├── package.json / vite.config.ts / tsconfig.json
├── src/
│   ├── main.ts              # boot, wire up loop & UI
│   ├── core/
│   │   ├── num.ts           # Decimal wrapper/helpers (swap point for break_eternity)
│   │   ├── format.ts        # number formatting
│   │   ├── state.ts         # GameState type + defaults
│   │   ├── loop.ts          # tick + offline progress
│   │   ├── economy.ts       # costs, PPS, pints-per-drink, bulk buy
│   │   ├── drinking.ts      # hold-to-drink state machine, streaks
│   │   ├── events.ts        # Free Round spawning & buffs
│   │   ├── prestige.ts      # Last Orders / Beer Mats
│   │   └── save.ts          # serialise, migrate, autosave
│   ├── data/
│   │   ├── drinkers.ts      # table from section 3
│   │   ├── beers.ts         # table from section 4
│   │   ├── upgrades.ts      # templates + generators
│   │   ├── achievements.ts
│   │   ├── locations.ts
│   │   └── licence.ts       # prestige tree
│   ├── ui/
│   │   ├── scene.ts         # pose maths (glass, arm, crowd plan), art-agnostic and tested
│   │   ├── art/             # the canvas scene (section 13)
│   │   ├── store.ts         # beer, upgrades, drinkers list, buy ×1/10/100/max
│   │   ├── panels.ts / lastOrders.ts / freeRound.ts
│   │   └── sound.ts
│   └── styles/              # stage.css (scene + HUD), main.css (shop, dialogs)
├── tools/
│   └── simulate.ts          # headless balance simulator
└── tests/                   # vitest: format, economy, save/migrate
```

### 8.8 Balancing tools

- **`npm run simulate -- [activity] [target] [runs]`** runs the real economy headlessly with a
  "best payback" bot. `activity` is the fraction of time spent holding to drink (1 = always,
  0.25 = casual). With `runs` > 1 it calls Last Orders once that would at least double its mats
  (10+), then spends up to half its mats on the cheapest Licence nodes. Free Rounds and streaks
  are ignored, so real players get a little extra on top, but they also choose less well than the bot.
- Target pacing (first run, active play) and what the simulator measures (Phase 7):

| Target | Goal | Simulated |
|--------|------|-----------|
| First drinker | under 30 s | 19 s |
| Pint of Bitter affordable | about 2 min | 2m 10s (the bot buys it at 4m) |
| 1 million pints | about 20 min | 19m 36s (24m casual) |
| First Last Orders possible (1 mat) | 2–3 h | 58m active, 1h 10m casual; about 1h 40m for a worthwhile 10 mats |
| Later runs faster | yes | casual runs: 1h 37m → 1h 27m → 1h 16m → 56m → 46m |

  The bot plays perfectly, so real players will land later than these figures. That puts the first
  worthwhile Last Orders inside the 2–3 h target.
- Phase 7 balance changes: base drink time 1.5 → 1.0 s, pour 0.5 → 0.4 s, Pint of Bitter 200 → 100,
  Two-Handed 100 → 50 (unlocks at 10 drinks).
- **Late-game rebalance.** The first pass only looked as far as 1e15. Past it, a run sprinted and
  then stopped: the simulator (half the time holding) went from 1e15 to 1e24 in 11 minutes, because
  the drinkers kept their early spacing while beers, Reputation, Liquid Lunch and eight or nine ×2
  upgrades per power of ten all stacked on top, so income grew faster than the total drunk. Then the
  drinkers ran out at 1.2e20, the next beers were 1e4 to 1e22 apart, and after twelve hours
  the run was still on the beer it bought at 1h 48m. Two changes:
  - Drinkers 12–18 are spread from 3e13 to 1e27 (they were 1.4e13 to 1.2e20), each step dearer than
    the last and worth less per pint of price. Their upgrades and synergies follow, since those are
    priced from the drinker.
  - The sixteen beers from Scotch Heavy on are 1e26 to 1e59 (they were 1e27 to 1e145), and the last
    three pubs are 1e39, 1e43 and 1e48 (they were 1e38, 1e41 and 1e50).

  What the simulator shows now, first run, half the time holding: about 17 minutes per thousandfold
  all the way from 1e12 to 1e30, a new drinker every 10–18 minutes, then a slow-down that builds
  gradually once the drinkers are all met (a beer every 5–15 minutes to 1e41, then 30 minutes, an
  hour, two hours). The wall is still there in the end, on purpose: it is what Last Orders is for.

| Reached | Before | After |
|---------|--------|-------|
| 1e15 | 1h 29m | 1h 30m |
| 1e18 | 1h 37m | 1h 48m |
| 1e24 | 1h 40m | 2h 23m |
| 1e30 | several hours | 2h 53m |
| 1e36 | not in 12h | 3h 11m |
| 1e45 | not in 12h | 4h 33m |
| The Final Pint on sale | not in 12h | not in 12h (four beers short) |

  The late beers are a knife edge: a little closer together and the run takes off again (every
  beer from Somaek to The Final Pint inside half an hour), a little further apart and it stops dead.
  Re-run the simulator to 1e70 after touching any of them. Old saves are unaffected: a save keeps
  the beer, pubs and drinkers it has, and `save.ts` matches pre-version-4 beers against the prices
  of the time, not today's.

### 8.9 Stress testing and performance (Phase 7)

- `tests/stress.test.ts` buys everything at e(1e10) pints (every drinker maxed, all upgrades, 200 beers),
  calls Last Orders for about e(3.3e9) mats, buys the whole Licence, and round-trips the save. It also
  max-buys at the 1e(9e15) ceiling. Nothing goes NaN or hangs.
- It found a real hang: past 2^53, `n--` does nothing, so the max-buy correction loop never ended.
  It now backs off in doubling steps and always finishes.
- In the browser, with a busy late-game scene: about 0.05 ms per frame, and 0.1–0.2 ms per store refresh
  (5 times a second). Number grouping now reuses one `Intl.NumberFormat`; `toLocaleString` was
  ~25× slower and made each store refresh take about 8 ms.
- Phone layout (375 px): compact top bar, the Licence tree wraps into two columns, dialogs fit
  the screen, and there's no sideways scrolling.

---

## 9. Screen layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  🍺 1.23 million pints        +4.56K / second        [Stats][⚙]       │
├──────────────────────────┬──────────────────────┬─────────────────────┤
│                          │                      │  UPGRADES (icons)   │
│    THE PUB SCENE         │   YOUR PINT          │  [ ][ ][ ][ ][ ]    │
│  (background by location,│  (big SVG glass,     ├─────────────────────┤
│   drinker sprites,       │   hold to drink,     │  DRINKERS  ×1 ×10 ×100 Max
│   Free Round pops up     │   streak meter,      │  The Regular   15   │
│   here)                  │   +N pints popups)   │  Uni Student   100  │
│                          │                      │  Darts Team    1.1K │
│                          │   "Hold to drink"    │  …                  │
└──────────────────────────┴──────────────────────┴─────────────────────┘
```

- **Mobile:** a single column with the pint at the top and tabbed panels (Drinkers /
  Upgrades / Pub) below. Touch-and-hold works natively. Prevent the long-press context
  menu and text selection on the pint.
- **Accessibility:** Space/Enter can be held to drink, buttons are reachable by keyboard,
  and there's a reduced-motion setting.

---

## 10. Achievements and stats

- About 120 achievements from templates: lifetime pints milestones (every ×10), PPS
  milestones, drinker counts (1/50/100/…), drinks by hand, Free Rounds clicked, streak
  length, prestiges, plus a few hidden jokes ("Designated Driver": reach 1M pints without
  buying a single beer upgrade).
- Each achievement earns Reputation (section 5).
- **Stats page:** current and lifetime pints, PPS, pints by hand, total drinks, time played,
  Free Rounds, best streak, Beer Mats, number of prestiges.

---

## 11. Build phases

Each phase ends in something playable.

| Phase | Scope | Done when |
|-------|-------|-----------|
| **1. Core loop** | Vite/TS setup, `num.ts`, `format.ts`, state, loop, hold-to-drink pint (basic SVG), counter, save/load | You can hold to drink, pints go up, refresh keeps progress |
| **2. Drinkers** | Drinker data, store panel with ×1/10/100/Max, PPS, offline progress | Idle income works; Max buy is instant at huge counts |
| **3. Beers and upgrades** | Beer tiers (glass visuals change), upgrade templates, synergies, click upgrades | A full first run is playable to about 1e15 |
| **4. Juice** | Pub scene, drinker sprites, locations, Free Round events, streaks, sound, popups | It feels like a game, not a spreadsheet |
| **5. Progression** | Achievements, Reputation, stats, settings (number format, mute, export/import) | Long-term goals exist |
| **6. Prestige** | Last Orders, Beer Mats, Licence tree, save migration | Reset loop works and feels rewarding |
| **7. Balance and polish** | Simulator, pacing pass, stress-test at 1e1e10, mobile layout, tests | Pacing hits the targets in section 8.8 |
| **Later** | Brewery Empire second prestige, seasonal events (Christmas, Six Nations), cloud saves | — |

---

## 12. Decisions

1. **Currency:** Pints are both the score and the money. Beer Mats are the prestige currency.
2. **Art style:** hand-built vector art on a canvas, animated throughout (section 13). Earlier
   prototypes (flat SVG, pixel art, and AI-generated paintings in PixiJS) were all removed.
3. **Tone:** no "drink responsibly" line. It's just a game.
4. **Hosting:** to be deployed on Cloudflare later, as a static Vite build served as
   Workers static assets or on Pages.
5. **No React.** State is one plain object changed by the game loop. Views update the DOM,
   SVG and canvas directly. Preact could be added later for menu panels if they get
   complicated, but it isn't needed.

---

## 13. The scene (art and animation)

The stage is a single canvas that fills the left of the screen, with the HUD laid over it. The
world is 300 units tall and centred on x = 200; a wider stage simply shows more of the room
(roughly 270 to 760 units), so anything that matters sits between 0 and 400.

| File (`src/ui/art/`) | What it draws |
|----------------------|---------------|
| `draw.ts` | Canvas toolkit: colour mixing, easing, blobs, limbs, cached glows |
| `kit.ts` | Scenery pieces shared by locations: skies, skylines, lamps, bunting, bottles |
| `backdrops.ts`, `world.ts`, `cosmos.ts` | The twenty-four locations (Britain, the world tour, and space) |
| `figures.ts` | The crowd: one rig, eighteen wardrobes |
| `player.ts` | You, at the bar |
| `glass.ts` | The pint: four glass shapes, beer, head, bubbles, beer effects |
| `stage.ts` | Puts it together: layers, bar, hand pump, particles, sizing |
| `icons.ts` | Shop portraits and pint icons, drawn with the same rigs |

**Layers, back to front:** the location's `far` pass (sky, street, space; animated) → its `shell`
(architecture; static, cached, with windows punched through) → `mid` (lamps, bunting, screens) →
the crowd in three rows, hazier with distance → you → the bar (cached) → hand pump → your pint
and hand → particles → the location's `front` pass (light beams, dust) → vignette.

**What moves:**

- **You:** breathing, blinking, eyes shut and a swallow while drinking, an "ahh" with a foam
  moustache after each pint, a flush that builds with a chug streak, drumming fingers when idle.
- **The pint:** beer sloshes against the glass's movement, bubbles rise, the head wobbles, the
  pump handle is pulled and a stream pours on a refill, and the glass squashes as it lands.
- **The crowd:** each figure runs its own timer through sipping (their glass empties and gets
  refilled), talking, laughing and a party piece for their type (a dart thrown, a scarf held
  aloft, a glow stick, a flag, an astronaut drifting, an alien's camera flash, the black hole
  regular warping, the multiverse regular glitching). New arrivals pop up from behind the bar,
  and the whole pub cheers for a new beer, a Free Round, a new location or a long streak.
- **Locations:** every one has its own motion: rain and a swinging clock at The Red Lion,
  buses and umbrellas on the High Street, the match on the Superpub's screens, fireworks and a
  big wheel at the festival, a steam train over the viaduct in Great Britain, the Earth turning
  beside the Earth Inn, a rover and a rocket on the Moon, Saturn's rings outside the Social Club,
  a cow being collected at The Little Green Man, and a pub falling into a black hole at the end.

- **Coming and going:** every few seconds somebody in the crowd ducks out and somebody else
  takes the spot: any sort of drinker you own (the numerous ones more often), never the same
  face twice. Locals stay put. In the Multiverse Tavern there is no floor, so everyone floats.
- **Their drinks:** the level in a drinker's glass goes down while it is at their lips, stays
  level with the room as the glass tips, sloshes when it moves, and is topped up when empty.

**Characters** are drawn as illustration rather than assembled from primitives: heads turned
three-quarters with a nose that breaks the silhouette, eyes with whites and lids, shaped torsos
with sloping shoulders, mitten hands, and an outline round every shape in a darker shade of its
own fill. Each person also gets their own jaw, nose and belly from their seed. Open `/sheet.html`
on the dev server to see every drinker type and the player's poses large (`?only=regular,hero`,
`?scale=3`).

**Rules for adding art:** colours go through the figure's or the room's `tone` so a new character
sits in every location's light; anything static belongs in `shell` (it is cached); anything
additive uses `glow()` (a cached sprite) rather than a fresh gradient. A full pub costs about
2 ms a frame. `game.scene(i)` and `game.crowd(n)` in the console preview a location or a full
house without touching the save.

## Play statistics

The game reports anonymous moments so we can see how far people get and how long they play.

- `src/core/telemetry.ts` works out what happened from the save alone: it compares a snapshot of the game
  each second with the last one (`moments`) and lists the numbers sent with every moment (`progress`).
- `src/telemetry.ts` queues moments and posts them in batches to `/api/event`. It only runs in a production
  build, never with `?debug`, and never for a browser sending Do Not Track or Global Privacy Control. Settings has an
  "Anonymous play statistics" switch with a short note; turning it off stores `idleBeer.noStats` and
  forgets the browser's random id. The switch is off and greyed out when the browser itself says no.
  Each browser gets a random id (`idleBeer.pid` in localStorage); nothing else identifies anyone.
- `worker/index.ts` is the only server code. It writes one row per moment to the Workers Analytics Engine
  dataset `idle_beer_events` (bound as `EVENTS` in `wrangler.jsonc`). Rows are kept for three months.
- `npm run stats -- [days]` prints the funnel, pubs and beers reached, visit lengths and where players are.

Moments: `load` (label `new`/`returning`), `start`, `first_drink` (by hand), `first_drinker`, `crowd`
(value: size), `pub` and `beer` (label: id, value: place in the list), `last_orders` and `back_to_pub`
(value: how many times), `licence` and `achievement` (label: id), `free_round`, `offline_return` (value:
seconds away), `heartbeat` (every minute in view), `session_end` (value: seconds in view), `reset`.

Columns: `index1` player; `blob1` event, `blob2` label, `blob3` language, `blob4` device, `blob5` country,
`blob6` referring site; `double1` the moment's value, then play seconds, seconds this visit, visit number,
Last Orders rung, furthest pub, beer, Licence nodes, achievements, log10 of all pints ever, drinkers, drinks.
Only ever add columns at the end.
