# Dora & Enzo's Arcade · Hay Maze Defence

A maze-building tower defence. Predators cross a meadow to raid Dora and Enzo's raisin stash, and they always take the shortest open route to the burrow. Every tower blocks its tile, so what you build decides the path they walk: lay hay bales and towers into a long, winding maze, slow them with dust and stop them with the Snooze Bell.

The rules live in `lib/hay-maze-game.ts`, a deterministic engine with no randomness and no browser dependencies, so a game replays exactly. `lib/hay-maze-scene.ts` draws it, and `app/hay-maze/page.tsx` is the page.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/hay-maze`.

## The route

- The meadow is 20 × 12 tiles. Maps are strings in `MAPS`: `.` grass, `#` rock, `E` an entrance on the left or top edge, `X` the burrow door on the right edge.
- `field()` is a breadth-first search from the burrow doors over open tiles (not rocks, not towers), giving every tile its number of steps to the burrow. It is recomputed whenever a tower is built or sold.
- A ground predator heads for the neighbouring tile (up, down, left or right) with fewer steps, keeping its current heading when two are equally good. It moves toward that tile's centre, so it never cuts through a blocked tile.
- Hawks ignore the grid and fly straight at the burrow.
- The dotted line on the map is `route()` from each entrance. While a tower is being placed, the line shows the route with that tile blocked.

## Building

A build is refused when the tile is a rock, an entrance, a burrow door or already built on (`taken`), when you can't afford it (`hay`), when a ground predator is standing on it (`occupied`), or when it would leave an entrance, or a tile a ground predator is on, with no way to the burrow (`blocked`). Flyers don't stop you building under them.

| Tower | Cost | Upgrades | Hits | Level 1 → 2 → 3 |
| --- | --- | --- | --- | --- |
| Hay Bale | 4 | none | nothing | blocks the tile |
| Pellet Flicker | 12 | 14, 26 | ground and air | 10 / 18 / 32 damage every 0.5 / 0.45 / 0.4 s, range 2.6 / 2.8 / 3.1 |
| Dora's Dust Puffer | 18 | 18, 30 | ground | every 0.5 s: 3 / 6 / 10 damage and a 40% / 50% / 60% slow lasting 0.9 s, range 1.7 / 1.9 / 2.1 |
| Enzo's Boulder Roller | 25 | 25, 45 | ground | 30 / 55 / 95 splash damage every 1.5 / 1.4 / 1.3 s, range 3 / 3.2 / 3.5, splash 0.9 / 1 / 1.2 |
| Snooze Bell | 30 | 25, 40 | ground and air | every 3.2 / 2.8 / 2.4 s: 4 / 8 / 14 damage and a 0.6 / 0.8 / 1 s nap for everything in range 1.9 / 2.1 / 2.3 |
| Glider Nest | 20 | 20, 35 | air | 32 / 58 / 100 damage every 0.8 / 0.75 / 0.7 s, range 3.4 / 3.7 / 4 |

Ranges are in tiles. Shooters (the Flicker, the Glider Nest and the Boulder Roller) aim at the predator furthest along its way; boulders are lobbed at where the target will be when they land, and hit everything on the ground in the splash. The Puffer and the Bell hit everything in range at once, and fire only when something is there. Selling returns 70% of everything spent on a tower, rounded down.

## Predators

| Predator | Health | Speed (tiles/s) | Hay | Raisins taken | Notes |
| --- | --- | --- | --- | --- | --- |
| Weasel | 28 | 1.7 | 2 | 1 | |
| Fox | 55 | 1.15 | 3 | 1 | |
| Snake | 85 | 0.85 | 4 | 1 | feels only half of any slow |
| Badger | 150 | 0.7 | 6 | 2 | armour 4 |
| Hawk | 40 | 1.35 | 4 | 1 | flies over the maze |
| Lynx | 800 | 0.75 | 40 | 5 | armour 3, feels 70% of a slow, naps half as long |

Armour is taken off every hit, which always does at least 1. Health grows each wave by `1 + 0.2 (w − 1) + 0.016 (w − 1)²` (about ×10.6 by wave 20) and is multiplied by the map's toughness: ×1 on Clover Meadow, ×0.85 on Cactus Canyon and ×1.3 on Moonlit Summit.

## Waves and hay

- 20 waves are listed in `WAVES` as groups of predators with a gap between each; groups follow each other after 1.5 s. On maps with two entrances, predators alternate between them. Wave 5 is all hawks, and waves 10 and 20 bring the lynx.
- You start with 80 hay and 20 raisins. The first wave waits for you. Once a wave has finished arriving, an 18-second countdown runs to the next; sending it early pays a hay for every whole second left. Each wave from the second on also pays a bonus of 8 hay plus the number of the wave before it.
- The map is won when all 20 waves are over with raisins left, and lost when the raisins run out.

`tests/hay-maze-bot.mjs` plays every map with a simple planner that builds walls every third column, open at alternate ends, and places towers where they cover the most of the route. It wins Clover Meadow with all 20 raisins, Cactus Canyon with 14 and Moonlit Summit with 5.

## Saves

The page keeps `hay-maze-v1` in `localStorage`: how many maps are won (each opens the next) and the most raisins kept on each. A missing or broken save starts fresh; private browsing still plays.

## Controls

- 1–6 or the bar under the meadow pick a tower. Click tiles to build; building stays on until right-click or Escape. Click a tower to inspect, upgrade (U) or sell (Delete or Backspace).
- The arrow keys move the build cursor and Enter builds or selects. N or Space sends the next wave. F cycles 1×, 2× and 3× speed. P pauses; Escape cancels building or, with nothing picked, pauses.
- On a touch screen, the first tap on a tile previews the tower and the route it makes, and a second tap on the same tile builds.

## Drawing

Towers are crewed by the shared Dora and Enzo drawing from `lib/chinchilla-art.ts`: a kit with a slingshot on the Flicker, Dora with her fan in a swirl of dust, Enzo beside a pile of boulders (and holding one up when he throws), Grandpa Pebble dozing by the bell, and a sugar glider peeking out of a hollow stump. Platforms are trimmed bronze, silver or gold by level. The predators are drawn side-on and face the way they walk: slowed ones trail dust and sleeping ones float z's. The burrow at the right has Dora and Enzo at the door (dizzy when something gets in) and a pile of raisins that shrinks as they're taken. Each map has its own grass, rocks and details: clover, sandy specks or twinkling stars.
