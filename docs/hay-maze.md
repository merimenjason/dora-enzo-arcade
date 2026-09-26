# Dora & Enzo's Arcade · Hay Maze Defence

A roguelite, maze-building tower defence in the style of [Emberward](https://store.steampowered.com/app/2459550/Emberward/). Predators cross a meadow at night to snuff out the **Hearthlight**, the lantern that keeps Dora and Enzo's burrow warm, and always take the shortest open route there. You build the maze from hay-bale blocks drawn as cards, stand elemental towers on top of the bales, and carry a deck, towers and relics through a run of six levels.

The rules live in `lib/hay-maze-game.ts`, a deterministic engine with no browser dependencies: every random choice (maps, waves, shuffles and rewards) comes from the run's seed, so a run replays exactly. `lib/hay-maze-scene.ts` draws it, and `app/hay-maze/page.tsx` is the page.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/hay-maze`.

## A run

- A `Run` holds what carries over: the Hearthlight (starts at 20), the deck (11 cards), the unlocked towers (three to start) and relics. Its `battle` is the current level.
- There are six levels (`LEVELS`), each a `Battle` on a newly generated meadow. Levels 1–2 are Clover Meadow, 3–4 Cactus Canyon and 5–6 Moonlit Summit, each with its own look.
- Each level has five waves (`WAVES_PER_LEVEL`). Between waves is the build phase: lay bales, build towers, then start the wave. Towers can also go up during a wave; bales can't.
- Clearing the fifth wave ends the level. After levels 1–5 you pick one of three rewards (`Run.offer`): a tower you don't have yet, a relic you don't have, and either more cards (two bale shapes and an item) or, when the Hearthlight is 6 or more below full, 8 more flame. Clearing level 6 wins the run.
- A predator that reaches the Hearthlight dims it by its `steal` (1, a badger 2, the lynx 5). At 0 the run is lost.

## A level

- **The meadow** (`makeLayout`) is 20 × 12 tiles. The burrow door is two tiles on the right edge. The first way in is two tiles on the left edge. A second way in, two tiles on the top edge, appears on half of levels 3–4 and on every level from 5. Rocks (7 plus 2 per level) are scattered away from the ways in, never cutting off the route.
- **The route** (`field`) is a breadth-first search from the burrow door round rocks and bales. Ground predators step to the neighbouring tile with fewer steps to go, keeping their heading on ties. Hawks fly straight to the Hearthlight.
- **Hay** starts at 70 on level 1 and 30 more on each later level (`LEVEL_HAY`, `LEVEL_HAY_STEP`). Caught predators pay their bounty, and each finished wave pays 6 plus the level number (counting from 0).
- **Waves** (`planWaves`) are one group of predators for the first wave and two after that, drawn from the level's pool. A wave's strength is `5 + 2.5 × level + 4.5 × wave` fox-sized predators (a weasel counts 0.6, a snake 1.4, a badger 2.4 and a hawk 1.8). The first wave of every level has no hawks or badgers. Every second level ends with a lynx (two on the last). Health grows by `hpScale(level × 3 + wave)`, where `hpScale(g) = 1 + 0.14 g + 0.006 g²`. Most of the growth is within a level, because every level starts from scratch.

## Cards

- **The deck** starts with the Long Wall (I), Bale Stack (O), T-, L-, J-, S- and Z-Bales, a Double Bale, a Bale Corner, a Bale Row and a Shovel. The Single Bale and more copies come as rewards.
- Each level shuffles the whole deck into a draw pile and deals 7 (`FIRST_DRAW`). After each wave you draw 3 (`DRAW_PER_WAVE`), 4 with the Old Map. The hand holds 8 (`HAND_MAX`). Played cards go to the discard pile, which is shuffled back in when the draw pile runs out.
- **Bales** (`canPlace`) go down centred on the tile you point at (`cellsAt`), turned a quarter at a time (`shape`). Every tile must be on the meadow and free of rocks, bales, ways in and the burrow door, and the route must stay open from every way in. Bales can only be laid between waves.
- **Items:** the Shovel digs up one bale with no tower on it (between waves), the Hay Bundle gives 25 hay, and Warm Cocoa brightens the Hearthlight by 3 (never past full).

## Towers and elements

Towers (`canBuild`) stand on a bale or a rock, one per tile. They must be unlocked and cost hay.

| Tower | Element | Cost | Upgrades | Hits | Level 1 → 2 → 3 |
| --- | --- | --- | --- | --- | --- |
| Pellet Flicker | pellet | 10 | 12, 22 | ground, air | 9 / 16 / 28 damage every 0.5 / 0.45 / 0.4 s, range 2.6 / 2.8 / 3.1 |
| Dora's Frost Fan | ice | 16 | 16, 28 | ground | every 0.5 s: 3 / 5 / 8 damage and a 35% / 45% / 55% chill for 0.9 s, range 1.7 / 1.9 / 2.1 |
| Enzo's Boulder Roller | earth | 22 | 22, 40 | ground | 28 / 50 / 85 splash every 1.5 / 1.4 / 1.3 s, range 3 / 3.2 / 3.5, splash 0.9 / 1 / 1.2 |
| Ember Brazier | fire | 18 | 18, 32 | ground | every 0.6 s: 4 / 7 / 12 damage and burning at 6 / 11 / 18 a second for 3 s, range 1.6 / 1.8 / 2 |
| Spark Wheel | spark | 24 | 22, 40 | ground, air | 18 / 32 / 55 damage chaining to 3 / 4 / 5 foes every 1.1 / 1 / 0.9 s, range 2.6 / 2.8 / 3 |
| Moon Lantern | arcane | 28 | 26, 45 | ground, air | 24 / 42 / 72 damage every 1.3 / 1.2 / 1.1 s, range 4 / 4.4 / 4.8 |
| Snooze Bell | sleep | 30 | 25, 40 | ground, air | every 3.2 / 2.8 / 2.4 s: 4 / 8 / 14 damage and a 0.6 / 0.8 / 1 s nap, range 1.9 / 2.1 / 2.3 |
| Glider Nest | air | 18 | 18, 32 | air | 32 / 58 / 100 damage every 0.8 / 0.75 / 0.7 s, range 3.4 / 3.7 / 4 |

The Flicker, Frost Fan and Boulder Roller are the starters (`START_TOWERS`). Shooters aim at the predator furthest along its way. Boulders lead their target. Spark chains jump to the nearest foe within 1.8 tiles that hasn't been hit, at 80% of the damage each time. Selling returns 70% of everything spent, rounded down.

**Reactions:**

- **Shatter:** a Spark Wheel zap on a chilled foe does double damage (`SHATTER`).
- **Flare:** a Moon Lantern bolt on a burning foe also hits every foe within a tile for half its damage (`FLARE`).
- Burning and moonlight ignore armour; everything else loses the target's armour, down to at least 1.

## Relics

| Relic | Effect |
| --- | --- |
| Frost Mittens | Chill slows 10% more. |
| Tinderbox | Burns last 6 s instead of 3 and burn 50% hotter. |
| Static Fur | Spark Wheels chain to two more foes. |
| Hay Loft | +30 hay at the start of every level. |
| Lucky Raisin | Every foe caught pays 1 more hay. |
| Crystal Lens | Every tower reaches half a tile further. |
| Old Map | Draw one more card after every wave. |
| Pocket Watch | The Snooze Bell naps 0.4 s longer and rings 20% sooner. |
| Slingshot Wax | Pellet Flickers shoot 30% faster. |
| Glow Moth | Moon Lantern bolts hit 50% harder. |
| Hearthstone | The Hearthlight grows 6 bigger and is topped up. |
| Bellows | Fire towers deal 30% more damage. |

`Battle.stats()` applies them to a tower's numbers.

## Predators

| Predator | Health | Speed (tiles/s) | Hay | Dims the flame by | Notes |
| --- | --- | --- | --- | --- | --- |
| Weasel | 28 | 1.7 | 2 | 1 | |
| Fox | 55 | 1.15 | 3 | 1 | |
| Snake | 85 | 0.85 | 4 | 1 | feels only half of any chill |
| Badger | 120 | 0.7 | 6 | 2 | armour 4 |
| Hawk | 40 | 1.35 | 4 | 1 | flies straight over the maze |
| Lynx | 700 | 0.75 | 40 | 5 | armour 3, feels 70% of a chill, naps half as long; the guardian |

## Balance

`tests/hay-maze-bot.mjs` plays whole seeded runs with a simple planner. It lays bales where they lengthen the walk most along a snaking plan, stands towers where they reach most of the route (and anti-air along the hawks' flight line, when hawks are coming), upgrades, and picks rewards. It takes two strong towers first, then relics, and tops up the flame when it's low. It wins 4 of its 6 seeded runs, and it usually finishes with the Hearthlight well down, so a run should feel close. `npm test` asserts it wins at least 3.

## Saves

The page keeps `hay-maze-v2` in `localStorage`: runs started, runs won and the furthest level reached. A run in progress isn't saved.

## Controls

- Cards: 1–8 or click. R, right-click or the mouse wheel turns a bale. Items play when picked.
- Towers: Z, X, C, V, B, N, M and comma, in the order of the crew list, or click the bar.
- Arrow keys move the cursor; Enter places or selects. Space starts the wave. U upgrades, Delete sells. F cycles 1×, 2× and 3× speed. P pauses; Escape cancels, or pauses when nothing is picked. On the reward screen, 1–3 pick.
- Touch: the first tap on a tile previews, and a second tap on the same tile places.

## Drawing

In the spirit of Emberward's warm, chunky look:

- **Blocks:** every bale is a block with a lit straw top, a shaded front with twine, and outlines only round the outside of each piece. Rocks are grey stone blocks.
- **Towers:** they stand on the blocks on small plinths striped in their element's colour. Dora fans frost, Enzo heaves boulders, a kit runs the Spark Wheel, a violet chinchilla holds the Moon Lantern, Grandpa Pebble dozes by the bell, and a sugar glider peeks from its stump.
- **Predators:** chilled ones turn frosty, burning ones carry flames, and sleeping ones float z's.
- **The Hearthlight:** a stone brazier by the burrow with Dora and Enzo beside it. Its flame shrinks as it dims.
- **Night:** the meadow sits under a dusk sky with a colour wash, pools of firelight and moonlight, embers drifting up from the Hearthlight, and a vignette. The route glows like a line of embers.
