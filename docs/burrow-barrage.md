# Burrow Barrage

Game 23, at `/barrage`. Turn-based artillery in the style of Gunbound: two teams of two take turns to set an angle and a power and fire across ground that every shot digs away. The rides, the art and the maps are the arcade's own.

Built on 04-10-2026. Tuned with the bot only; nobody has yet played it by hand, so the feel of the power bar, the speed of a shot in flight and the size of the craters are first guesses.

## How a match goes

- Each team has two chinchillas, each on a **ride**. Dora and Enzo are team one.
- On your turn you may **walk** a limited number of cells, set the **angle** (5° to 175°; 90° is straight up) and the **power** (0 to 100), choose one of the ride's three **shots**, and fire.
- **Wind** runs from 10 left to 10 right. It bends every shot, and drifts by up to 2 each turn.
- A blast digs a **crater**, hurts everyone in reach (your own side included), and may **shove** them. Damage is full on a direct hit and falls to 35% at the edge of the blast.
- A chinchilla with no ground under it falls. If there is nothing below, or it is shoved off the side of the map, it is **out** at once. At 0 health it is out too.
- A team with nobody left loses. If the last of both teams go in the same blast, it is a draw.
- From turn 49 it is **dusk**: everyone loses 8 health at the start of each turn, so no match goes on for ever.

### Turn order

There are no fixed rounds. Every action adds to the chinchilla's **wait**, and whoever has waited least goes next (ties go to the lower-numbered chinchilla). A quick shot can earn a second turn before a slow one comes round. Skipping a turn adds 40. The **Next up** strip shows the next six turns, assuming everyone takes an ordinary shot.

### Rides

| Ride | Health | Walks | Shot 1 | Shot 2 | Big shot |
| --- | --- | --- | --- | --- | --- |
| Hay Catapult | 125 | 26 | Hay Bale: 30, wide blast, wait 70 | Heavy Bale: 36, small blast, wait 95 | Bale Storm: three bales of 24, wait 125 |
| Seed Spitter | 110 | 40 | Seed Burst: three seeds of 13, wait 65 | Pip Shot: 30, tiny blast, wait 55 | Seed Hail: six seeds of 13, wait 110 |
| Tunnel Digger | 120 | 32 | Mole Shot: 34, tunnels 26 cells first, wait 75 | Sinkhole: 20, a crater of 22, wait 85 | Deep Mole: 50, tunnels 60 cells, wait 120 |
| Dust Cannon | 115 | 32 | Dust Puff: 21, shoves 15, wait 70 | Gale: 8, shoves 34, wait 85 | Dust Storm: 32, shoves 25, wait 120 |

The **big shot** charges by one for each turn taken (a skipped turn counts) and needs three; using it empties the charge.

### Items

Every chinchilla carries one of each, usable once a match.

- **Double Shot** fires the chosen shot twice and adds 55 to the wait.
- **Dandelion** heals 40, takes the place of the shot, and adds 60.
- **Burrow Hop** lobs a marker with the current aim and moves the chinchilla to where it lands, in place of the shot, adding 50. A marker that hits someone or leaves the map is wasted.

## Modes

- **The ladder:** six matches against rival pairs, one on each map, opened one at a time. The rivals aim at three levels: Sleepy (off by up to 8° and 14 power), Sharp (4° and 7) and Deadeye (1° and 3). Stars: one for a win, two with both Dora and Enzo still in, three with half the pair's health left as well.
- **Pass and play:** two people on one device. Pick a map and the rides for Pip and Mora; Dora and Enzo use the rides chosen at the top of the menu.

Stars are saved as soon as a match is decided, before its final animation finishes, so leaving or reloading cannot lose a win. A result resolved on the computer's turn reads the latest save, keeping earlier stars and the current sound preference. Held walking and charging controls are released between turns and when the window loses focus. A cancelled walking press stops walking. When an angle or power slider has focus, arrow keys adjust that slider rather than walking.

## Maps

Six, each 400 × 225 cells and mirrored left to right: Clover Meadow (gentle hills), Mossy Valley (high banks and a deep dip), The Mound (a hill in the middle), Rope Bridge (two cliffs and a thin bridge over a drop), Sky Ledges (floating ledges) and Broken Crags (steep ridges with two gaps).

## How it is built

- **Engine**, `lib/burrow-barrage-game.ts`. A `Match` is plain data: the ground as a `Uint8Array` of solid and empty cells, four units, the wind, and the seed. `flight()` flies a shot without changing anything, and both the real shot and the computer use it, so what the computer plans is what happens. `fire()` resolves a whole turn at once and leaves `events` for the scene.
- **Scene**, `lib/burrow-barrage-scene.ts`. `Stage` plays the events back in order and keeps its own copy of the ground, so a crater appears when its shot lands on screen. The ground is painted a cell at a time into an off-screen canvas and drawn at twice the size.
- **Page**, `app/barrage/page.tsx`. Input, the loop, the computer's turns, saving. The save key is `burrow-barrage-v1` (stars, sound, and Dora's and Enzo's rides). A match in progress is not saved.
- **Camera.** When the board is drawn under 620 pixels wide (a phone), `Stage.zoom` is 2: the view centres on whoever's turn it is, follows the shot and then the blast, and can be dragged about with two fingers (`Stage.pan`). **Whole map** in the header, or Z, switches back to zoom 1. The page aims through `Stage.toWorld()`, so a drag means the same on the map at any zoom. The wind gauge and the turn banner are drawn larger on a small board (`Stage.hud`). On a wide screen the whole map is always shown.
- **Test hook:** `window.__barrage()` returns `{ match, stage, plan }`; `plan()` is the computer's exact plan for whoever's turn it is.

### The computer

`Match.plan(level)` sweeps every barrel height from 5° in steps of 3° and every power from 20 in steps of 5, towards whichever sides have a rival, flies each through `flight()`, and scores where it lands for each shot the ride has ready: hurt done to rivals, less one and a half times the hurt done to its own side, with a bonus for a knock-out. It then searches finely round the best. If nothing scores 12 or more from where it stands, it tries walking its full reach and half its reach each way first. If nothing can reach at all, it fires the shot that lands closest to a rival, which digs towards them. It eats its Dandelion at 40% health or less when no knock-out is on offer, and Sharp and Deadeye use Double Shot on a good hit. The level then spoils the aim by a seeded amount.

The computer does not plan to drop a rival by digging or shoving, though its blasts often do. So the bot's figures understate the Tunnel Digger's Sinkhole and the Dust Cannon's Gale.

## Balance

`npm run bot:barrage` plays computer against computer. With `SEEDS=5` (60 matches for each pairing of rides, Deadeye on both sides, both orders of play, all six maps), on 04-10-2026:

- each ride won between 42% and 57% of its matches against the other three (Hay Catapult 56%, Seed Spitter 57%, Tunnel Digger 42%, Dust Cannon 45%);
- matches lasted 17 turns on average, and about a third of knock-outs were falls;
- the side going first won 52% of mirror matches;
- a Deadeye computer playing Dora and Enzo (Hay Catapult and Seed Spitter) won 10, 10, 8, 10, 5 and 5 of 10 on the six ladder matches.

The bot fails if any ride wins under 30% or over 70% of its matches. Rerun it after changing any number in `RIDES`, `ITEMS` or the constants at the top of the engine.

## Known limits

The focused browser suite, `tests/e2e/newest-quality.mjs`, checks interrupted walking, held keys across turns, keyboard slider controls and stars kept when leaving during a victory animation. It runs with the four games' main browser suites through `npm run test:e2e:newest`.

- **Not played by hand.** See the note at the top.
- **No saving mid-match**, and no online play: the arcade has no game server.
- **The aiming guide** shows only the start of a shot's path, wind included.
