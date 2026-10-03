# Dora & Enzo's Arcade · Burrow Tactics

Turn-based tactics in the style of Into the Breach. Predators raid a meadow of burrows, and every one of them shows what it will hit next turn. You have up to three chinchillas, each with one move and one action a turn, and almost every action pushes something. Hold out for the set number of turns and the raid is over.

The rules live in `lib/burrow-tactics-game.ts`, a deterministic engine with no browser dependencies. `lib/burrow-tactics-scene.ts` draws the board and animates what the engine resolved, and `app/tactics/page.tsx` is the page. The design notes are in [`superpowers/specs/04-10-2026-burrow-tactics-design.md`](superpowers/specs/04-10-2026-burrow-tactics-design.md).

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/tactics`.

## The board

- 8 × 8 tiles (`SIZE`). `x` runs down and to the right on screen, `y` down and to the left. Burrows and chinchillas start on the low-`x` side; predators come from the high-`x` side.
- Terrain is `grass`, `water` or `bramble`. A tile can also hold a feature: `rock` (blocks, never breaks), `bale` (blocks, breaks when hit), `burrow` (blocks, must be protected) or `rubble` (a collapsed burrow, walkable).
- A dust cloud sits over a tile for two predator phases (`CLOUD_TURNS`).
- **The warren** is a shared health pool. A burrow that is hit collapses and costs 1 warren. At 0 warren, or with every chinchilla knocked out, the battle is lost.

## A turn

1. **Your phase.** Each chinchilla may move (through friends, not through predators or features, never into water), then act once. Acting ends that chinchilla's turn. A move can be undone until the chinchilla acts, unless the move hurt it. The whole turn can be reset once per battle (`resetTurn`).
2. **The predators' phase** (`endTurn`), in this order:
   - telegraphed attacks resolve in the numbered order shown on the predators;
   - predators come up out of rustling grass. If something is standing there, it takes 1 and the grass stays for next turn; a hay bale on the grass is broken instead;
   - every predator moves and telegraphs its next attack (`think`);
   - the next turn's rustling grass appears, and dust clouds fade by one.
3. After the last turn's predator phase the battle is won. It is also won as soon as no predators are left and none are coming, and a boss battle is won the moment the Mountain Cougar is knocked out.

## Pushing

`push` moves a unit one tile.

- Off the board: nothing happens.
- Into a rock, bale, burrow or another unit: it stays put and takes 1; the other unit takes 1 as well, a bale breaks and a burrow collapses.
- Into water: a ground predator drowns (not the cougar). A chinchilla is soaked: it cannot attack while it stands in water, but it can walk out or groom.
- Into brambles: 1 damage. Stopping a move in brambles costs 1 too.
- Flying units (owl, hawk) ignore water and brambles.

**Attacks follow the attacker.** A telegraphed attack is a direction, not a tile (`Unit.dir`, plus `dist` for the hawk). `threat(u)` works out the tiles from where the predator stands now, so pushing it moves the attack. A predator in a dust cloud when its turn comes does nothing.

## Chinchillas

| Name | Health | Move | Action |
| --- | --- | --- | --- |
| Dora | 3 | 4 | **Seed Shot**: a straight line; the first thing in the way takes 1 and is pushed back. |
| Enzo | 4 | 3 | **Tail Whack**: the tile next to him takes 2 and is pushed away. |
| Pip | 2 | 5 | **Dust Puff**: lobbed 2 to 4 tiles in a line; a dust cloud lands there and everything next to it is pushed outward. |
| Grandpa Pebble | 5 | 3 | **Hay Toss**: lobbed 2 to 3 tiles in a line; an empty tile gets a hay bale, an occupied one takes 1. |
| Mochi | 3 | 4 | **Tug**: a straight line; the first creature is pulled right up to her. |
| Biscuit | 3 | 4 | **Pounce**: leaps 2 to 4 tiles in a line to an empty tile; everyone next to the landing takes 1 and is pushed outward. |

Everyone can also **Groom** (heal 1) as their action. Your own shots hurt your own side: a Seed Shot that reaches a burrow collapses it.

## Predators

| Name | Health | Move | Attack |
| --- | --- | --- | --- |
| Fox | 3 | 3 | **Bite**: the tile in front, 1. |
| Snake | 2 | 2 | **Spit**: a straight line; the first thing in the way takes 1. |
| Owl (flies) | 2 | 4 | **Swoop**: flies in a line until something is in the way; it takes 2 and is knocked back. |
| Weasel | 2 | 4 | **Lunge**: the two tiles in front, 1 each. |
| Badger | 5 | 2 | **Sweep**: the tile in front and the two beside it, 2 each. |
| Hawk (flies) | 3 | 4 | **Dive**: one tile 2 to 4 away in a line, 2. |
| Mountain Cougar | 9 | 3 | **Rake**: all four tiles around it take 2 and are thrown back. Too heavy to drown. |

An **alpha** has 2 more health and does 1 more damage; it has a gold rim on its health bar.

**How they think.** In id order, each predator scores every tile it can reach with every direction (and dive distance): a burrow is worth 6 (1 if another predator already has it), a chinchilla 4 (7 if the hit would knock it out), a bale 0.5, and hitting another predator costs 5. Ending in brambles costs 3 and in a dust cloud 4. With nothing to hit, it closes on the nearest burrow or chinchilla. Ties break on the battle's seeded generator. This is the only randomness after a battle is set up, and it runs after attacks resolve, so `forecast()` is exact.

## Seeing ahead

- `threat(u)` gives the tiles a predator is about to hit; the scene draws them red, with an arrow.
- `preview(id, ability, x, y)` returns a copy of the battle after an action. While you aim, the scene draws that copy's features and threats, arrows for everything that would move, and the damage each thing would take.
- `forecast()` resolves the coming attacks on a copy and reports the warren and health that would be lost. The page shows it as "If you end the turn now".

A `Battle` is plain data, so `clone()` is cheap. Previews, forecasts, the reset button, saving and the test bot all work on copies.

## Campaign

Ten fixed missions (`MISSIONS`). Stars: one for winning, one for losing no burrow, one for the mission's bonus (`stars`, `bonusMet`). A mission opens when the one before it is won.

| # | Mission | Squad | Turns | Bonus | Unlocks |
| --- | --- | --- | --- | --- | --- |
| 1 | First Steps | Dora, Enzo | 3 | Knock out a fox | |
| 2 | Mind the Water | Dora, Enzo | 4 | Push a predator into the water | |
| 3 | Crossfire | Dora, Enzo | 4 | Make one predator hit another | Pip |
| 4 | Dust Up | Dora, Enzo, Pip | 4 | Smother 2 attacks in dust | Grandpa Pebble |
| 5 | Owl Country | Dora, Enzo, Grandpa Pebble | 4 | Keep every chinchilla standing | The Long Night |
| 6 | Bramble Patch | Dora, Enzo, Pip | 4 | Knock out 3 predators | Mochi |
| 7 | Rustling Grass | Dora, Enzo, Mochi | 5 | Block rustling grass twice | |
| 8 | The Badger Sett | Enzo, Mochi, Grandpa Pebble | 5 | Knock out the badger | Biscuit |
| 9 | Hawk Shadow | Dora, Biscuit, Pip | 5 | Knock out 4 predators | |
| 10 | The Mountain Cougar | Dora, Enzo, Biscuit | 6 | Knock out the Mountain Cougar | |

Missions 5, 8, 9 and 10 have a warren of 4; the rest have 3.

## The Long Night

A run (`Run`) of seven battles (`RUN_STAGES`) with three chinchillas of your choice: two in the Meadow, two in the Foothills, two in the High Pass, then the Mountain Cougar. The warren starts at 5 (`RUN_WARREN`) and carries through.

- `makeField(seed, stage)` builds each battle from the run's seed: one or two ponds, three or four burrows on the home side, rocks, brambles and bales, then predators bought from a budget. It rejects any board where part of the open ground cannot be walked to.
- Budgets: 7 points on the board at the start plus 1 per stage (`START_BUDGET`, `START_STEP`), and 3.5 a turn plus 0.8 per stage arriving through rustling grass (`WAVE_BUDGET`, `WAVE_STEP`). A fox or snake costs 2, an owl or weasel 3, a hawk 4, a badger 5. From the fourth battle a predator can be an alpha for 2 more (`ALPHA_FROM`, `ALPHA_CHANCE`).
- Battles last 4 turns in the Meadow, 5 after that and 6 against the cougar.
- After each battle, pick one of three rewards: an upgrade for one chinchilla (+1 health or +1 move, up to twice each, or +1 damage once), a relic, or a warren repair when the warren is hurt.
- A chinchilla knocked out in a battle comes back with 1 less maximum health for the rest of the run.

| Relic | Effect |
| --- | --- |
| Thick Fur | Each chinchilla ignores the first damage it takes in a battle. |
| Reinforced Doors | Each burrow survives the first hit it takes in a battle. |
| Spring Paws | Predators take 1 more damage when they are bumped into something. |
| Burr Seeds | Predators take 1 more damage from brambles. |
| Quick Start | Every chinchilla moves 1 further on the first turn of a battle. |
| Deep Roots | Standing on rustling grass to block it no longer hurts. |

## Saving

- `burrow-tactics-v1`: best stars for each mission, the most battles of a run ever won, and whether sound is off.
- `burrow-tactics-run-v1`: the run in progress (`Run.snapshot()`), written after every move, action and turn, so a run resumes exactly where it was left. It is removed when the run ends.
- A campaign mission in progress is not saved.

## Drawing and animation

The engine resolves a whole action or predator phase at once and leaves a list of events (`Battle.events`). The `Stage` in the scene keeps its own picture of the board and plays those events in order (walks, shots, pushes, knock-outs), then syncs to the engine. While events are playing, the page shows the Stage's warren and health, not the engine's, so the HUD never gets ahead of what you have seen. Clicking the board, or pressing Enter or Space, skips to the end of the animation.

The three regions each have their own sky, mountains, grass and soil. The backdrop and tiles are drawn once per battle and cached; water, features, creatures and effects are drawn every frame. Chinchillas are the arcade's `drawChinchilla` with a coat and a scarf each.

## Tests

- `npm run test:tactics` (also in `npm test`): moving and undo, every action, pushing into each kind of thing, every predator attack, attacks following a pushed predator, the forecast matching what then happens on every mission, previews, rustling grass, winning and losing, reset, snapshots, relics, the campaign's maps, generated boards for 30 seeds, and the run's rewards and saving.
- `npm run bot:tactics`: the planner in `tests/burrow-tactics-bot.mjs` plays all ten missions and twelve seeded runs and prints the results. For each chinchilla it tries every move and action on a copy, lets the predators' attacks resolve there, and keeps the best. `npm test` needs it to win every mission with at least 2 stars and at least 6 of 12 runs, and needs an idle player to lose every mission. As of 04-10-2026 it wins 11 of those 12 runs, and 40 of 48 over six squads. Rerun it after any balance change.
- `tests/e2e/burrow-tactics.mjs` (in `npm run test:e2e`): the page in a browser.
