# Dora & Enzo's Arcade · Chinchillas vs Zombies

A lane defence in the style of Plants vs Zombies. Zombies shamble in from the street along the lanes of a lawn towards Dora and Enzo's burrow. You plant chinchilla defenders, one to a tile, and pay for them with sunflower seeds. A hay cart at the end of each lane saves you once; after that, a zombie that reaches the end of a lane gets into the burrow.

The rules live in `lib/cvz-game.ts`, a deterministic engine with no browser dependencies: every random choice (wave plans, lanes, falling seeds) comes from the seed, so a night replays exactly. `lib/cvz-scene.ts` draws it, and `app/chinchillas-vs-zombies/page.tsx` is the page.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/chinchillas-vs-zombies`.

## The lawn

- 9 columns × 5 lanes (`COLS`, `ROWS`). Zombies enter just past column 9 and walk left. Column 0 is next to the burrow.
- Each night lists the lanes in play (`LevelDef.rows`). Nights 1–2 use the middle three; the rest use all five. Lanes not in play are bare earth: nothing grows there, and no zombie walks them.
- Each lane in play has a **hay cart** (`carts`). The first zombie to reach the end of the lane (x < 0.05) sets it rolling. It runs the length of the lane at 4 tiles a second and flattens every zombie it meets. Once it's gone, the next zombie to reach the end loses the night (`breach`).

## Seeds

- You start with 75 (`START_SEEDS`).
- A pouch worth 25 (`SEED_VALUE`) falls from the sky every 7 to 10 seconds (`SKY_EVERY` plus up to 3), the first after 6. It lands on a random lane in play.
- A Seed Gatherer finds a pouch on its own tile 7 to 12 seconds after it's planted, then every 24.
- A pouch fades 12 seconds (`SEED_LIFE`) after it lands. `collect(id)` picks one up; `collectAll()` picks up all of them.

## Defenders

`plant(kind, row, col)` returns `ok` or why not: `seeds`, `recharge`, `taken`, `lane` (bare earth), `locked`, `state` (paused or over) or `bounds`. After planting, that packet recharges. Grandpa Pebble, the Dust Trap and Enzo's Boulder start each night 60% recharged. `shovel(row, col)` digs a defender up, without a refund.

| Defender | Cost | Recharge (s) | Health | What it does |
| --- | --- | --- | --- | --- |
| Seed Gatherer | 50 | 7.5 | 300 | A seed pouch every 24 s. |
| Pellet Flicker | 100 | 7.5 | 300 | 25 damage every 1.3 s at the first zombie ahead of it in its lane. |
| Grandpa Pebble | 50 | 30 | 4,000 | A wall. |
| Dust Trap | 25 | 30 | 300 | Ready after 14 s; then the first zombie to touch its tile sets it off for 1,800 damage on that tile. Before then it's eaten like anything else. |
| Enzo's Boulder | 150 | 50 | — | Lands a second after planting: 1,800 damage to every zombie in the 3 × 3 tiles around it. |
| Dora's Frost Fan | 175 | 7.5 | 300 | As the Flicker, and each puff chills for 10 s: half speed, walking and biting. |
| Twin Flickers | 200 | 7.5 | 300 | As the Flicker, two pellets a volley. |

Night 1 starts with the Gatherer and the Flicker. Each of the first five nights unlocks one more (`LevelDef.unlock`, `unlockedBy`): Grandpa Pebble, the Dust Trap, Enzo's Boulder, the Frost Fan, then Twin Flickers.

Pellets fly at 5 tiles a second and hit the first zombie they reach in their lane. A shooter only fires while a zombie is on the lawn ahead of it in its lane.

## Zombies

| Zombie | Health | Armour | Speed (tiles/s) | Notes |
| --- | --- | --- | --- | --- |
| Zombie | 200 | 0 | 0.18 | |
| Flag Zombie | 200 | 0 | 0.24 | Leads each huge wave. |
| Conehead | 200 | 370 | 0.18 | |
| Pogo Zombie | 340 | 0 | 0.35 | Bounces over the first defender it touches (0.7 s in the air, 1.25 tiles, can't be hit), then walks at a zombie's pace. |
| Buckethead | 200 | 1,100 | 0.18 | |
| Brute | 3,000 | 0 | 0.16 | Flattens a defender in one smash, every 1.5 s. Takes two boulders or traps. |

- Armour soaks up damage first (`hurt`); the rest carries on to health.
- A zombie stops at the first defender its front touches (`touching`: its middle is 0.35 tiles behind its front) and bites for 100 a second. It doesn't stop for a boulder, and a Dust Trap that's ready goes off under it instead of being eaten.

## Waves

`planLevel(n, seed)` lays out every zombie of a night:

- Waves come every 22 seconds (`WAVE_GAP`), the first 25 seconds in (`FIRST_WAVE`). Nights have 6, 8, 10, 10, 12, 14, 14 and 16 waves.
- Wave `w` spends `base + w × step` points on zombies: a Zombie or Flag Zombie costs 1, a Conehead or Pogo 2, a Buckethead 4, a Brute 10. `step` grows from 0.35 on night 1 to 0.75 on night 8.
- Flag waves (`LevelDef.flags`, two on most nights, and always the last) have twice the points and a Flag Zombie in front.
- The first two waves of every night are plain Zombies. Brutes only come in the second half of a night. The last wave always brings the toughest zombie the night knows.
- Lanes are dealt like cards from a shuffled deck, so a wave spreads across the lawn instead of piling into one lane.

The night is won once every zombie has arrived and been stopped.

## Balance

`tests/cvz-bot.mjs` plays each night with a simple gardener. It collects every pouch, answers a threatened lane with a shooter for every 250 health coming, puts a cheap wall in front of a pogo, plants two gatherers a lane, then builds up to five shooters a lane (Frost Fans and Twin Flickers once it has them), drops boulders on crowded lanes and lays spare traps at the front. `npm test` asserts that it wins all eight nights on seed 1 and that doing nothing loses. Across seeds 1–6 it wins 47 of 48 nights, usually without needing a hay cart; night 8 is the one it sometimes loses.

## Saves

The page keeps `chinchillas-vs-zombies-v1` in `localStorage`: `{ cleared }`, the number of nights won. A night in progress isn't saved.

## Controls

- Pick a seed packet (click, or 1–7 in seed-bar order) and click a tile to plant. Right-click or Escape puts it down. S picks the shovel.
- Click a pouch to collect it, or press Space for all of them.
- The arrow keys move the cursor and Enter plants. F cycles 1×, 2× and 3× speed. P, or Escape with nothing picked, pauses; so does the window losing focus.
- Touch: the first tap on a tile previews, and a second tap on the same tile plants.

## Drawing

- **The lawn:** a sky with drifting clouds and a hedge, striped grass lanes, the street the zombies come from, and the burrow on the left with Dora and Enzo peeking out. Hay carts wait at the end of each lane.
- **Defenders:** drawn with the arcade's shared chinchilla art. Gatherers carry a basket and a sunflower, Flickers a slingshot, Dora a fan with frost, and Enzo holds his boulder overhead. A Dust Trap counts down until it's ready, then sparkles. Chewed defenders show their health.
- **Zombies:** cartoon zombies in brown suits, with a traffic cone, a pail, a flag, a pogo stick or a club. Chilled zombies turn blue, and armour and health show as bars once hurt.
- **Effects:** pellets, frost puffs, dust clouds, boulder craters, splats, seed pouches that glow, and a banner when the zombies arrive and before each huge wave.
