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
grows **×1.15 per one owned** (the standard formula). Each tier costs roughly 11–14× more
than the one before and produces about 6–8× more.

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
| 12 | Royal Street Party         | 14T       | 65M         | Bunting as far as the eye can see            |
| 13 | Global Toast               | 170T      | 430M        | Cheers in every language                     |
| 14 | Lunar Brewery              | 2.1Qa     | 2.9B        | Low gravity, high ABV                        |
| 15 | Interplanetary Pub Crawl   | 26Qa      | 21B         | Next stop: Mars Arms                         |
| 16 | Galactic Happy Hour        | 310Qa     | 150B        | Two-for-one across the Milky Way             |
| 17 | Black Hole Beer Garden     | 7.1Qi     | 1.1T        | Last orders lasts forever here               |
| 18 | Multiverse Lock-In         | 120Qi     | 8.3T        | Infinite pubs, infinite yous, infinite pints |

The Regular is the first drinker, so the "one person in the pub" opening is literally
the player alone, with the first purchase adding someone at the bar.

**Bulk buying:** Buy ×1 / ×10 / ×100 / Max. Use the closed-form geometric-series
formulas (section 8.3) so "Max" works instantly even for millions of units.

**Visuals:** owned drinkers appear in the pub scene (one small sprite per type, with a
count badge after a few, so the scene never fills up with thousands of sprites).

---

## 4. Beers (the "better beers" line)

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

**As built (Phase 6):** the Licence has six branches of five nodes (Regulars, Brewing, Charm,
Management, Technique, Collecting). Each node needs the one before it in its branch and costs
1 / 4 / 15 / 60 / 250 mats by tier (330 per branch, 1,980 for all of it). What a reset keeps:
achievements, lifetime stats (drinks, best streak, Free Rounds, play time), all-time pints, mats and
the Licence. Everything else, including the location, starts again. Save format version 2 added
these fields, and v1 saves migrate automatically. A casual first run (holding to drink a quarter of
the time) reaches about 10 mats in 1h 40m in the simulator.

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
| The Little Green Man | 1e38 | Free Rounds turn up twice as often |
| The Galaxy Arms | 1e41 | Drinkers cost 15% less |
| The Multiverse Tavern | 1e50 | Everything drinks a further 50% more |

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
7. **A stress-test mode** (`?debug`) sets pints to `1e1000`, `1e100000` and `1e1e10`
   so we can check formatting, buying and saving at extreme values.

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

Players choose a format in Settings:

- **Short names (default):** `1.23 million`, `45.6 billion` … up to decillion (1e33),
  then short suffixes `Ud, Dd, Td …` up to about 1e303.
- **Scientific:** `1.23e45`. This is the automatic fallback past the named range.
- **Engineering:** `123.4e42`.
- **Huge exponents:** once the exponent itself passes 1e6, show `e1.23e9` (an exponent
  of an exponent) so the number always fits in the counter.

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
  under the Earth Inn, a rover and a rocket on the Moon, planets orbiting in the Solar System.

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
