# Dora & Enzo's Arcade · Burrow Tactics

Turn-based tactics in the style of Into the Breach. Predators raid a meadow of burrows, and every one of them shows what it will hit next turn. You have up to three chinchillas, each with one move and one action a turn, and almost every action pushes something. Hold out for the set number of turns and the raid is over.

The rules live in `lib/burrow-tactics-game.ts`, a deterministic engine with no browser dependencies. `lib/burrow-tactics-scene.ts` draws the board and animates what the engine resolved, and `app/tactics/page.tsx` is the page. The design notes are in [`superpowers/specs/04-10-2026-burrow-tactics-design.md`](superpowers/specs/04-10-2026-burrow-tactics-design.md) and, for chapter two, [`superpowers/specs/04-10-2026-burrow-tactics-chapter-two-design.md`](superpowers/specs/04-10-2026-burrow-tactics-chapter-two-design.md).

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/tactics`.

## The board

- 8 × 8 tiles (`SIZE`). `x` runs down and to the right on screen, `y` down and to the left. Burrows and chinchillas start on the low-`x` side; predators come from the high-`x` side.
- Terrain is `grass`, `water`, `bramble`, `ice` or `hill` (high ground). A tile can also hold a feature: `rock` (blocks, never breaks), `bale` (blocks, breaks when hit), `burrow` (blocks, must be protected) or `rubble` (a collapsed burrow, walkable).
- A dust or stink cloud sits over a tile for two predator phases (`CLOUD_TURNS`). A tile can be on fire (`Battle.fire`, turns left).
- **The warren** is a shared health pool. A burrow that is hit collapses and costs 1 warren. At 0 warren, or with every chinchilla knocked out, the battle is lost.

Map letters: `.` grass, `~` water, `^` brambles, `=` ice, `n` high ground, `*` grass on fire, `#` rock, `h` hay bale, `B` burrow.

## A turn

0. **Choosing where to start.** A battle made with `deploy` (chapter two and every run battle) begins in the state `deploy`: the predators are on the board but have not picked attacks. `zone()` lists the open tiles in the four home-side columns, `place(id, x, y)` puts a chinchilla on one (swapping if a friend is there), and `ready()` lets the predators move and telegraph and starts turn 1. The first ten missions skip this; their starts are part of the puzzle.
1. **Your phase.** Each chinchilla may move (through friends, not through predators or features, never into water), then act once. A move can be undone until the chinchilla acts, unless the move hurt it. The whole turn can be reset once per battle (`resetTurn`).
2. **The predators' phase** (`endTurn`), in this order:
   - telegraphed attacks resolve in the numbered order shown on the predators;
   - fire burns (see below);
   - predators come up out of rustling grass. If something is standing there, it takes 1 and the grass stays for next turn; a hay bale on the grass is broken instead;
   - every predator moves and telegraphs its next attack (`think`);
   - the next turn's rustling grass appears, and clouds fade by one.
3. How the battle ends depends on its objective (below).

## Pushing

`push` moves a unit one tile.

- Off the board: nothing happens.
- Into a rock, bale, burrow or another unit: it stays put and takes 1; the other unit takes 1 as well, a bale breaks and a burrow collapses.
- Into water: a ground predator drowns (not the cougar or the bear). A chinchilla is soaked: it cannot attack while it stands in water, but it can walk out or groom.
- Into brambles: 1 damage. Stopping a move in brambles costs 1 too.
- Onto ice: it keeps sliding the same way until it leaves the ice or something stops it, and then it is bumped as above.
- Onto a burning tile: 1 damage.
- Flying units (owl, hawk) ignore water, brambles, ice and fire.

**Attacks follow the attacker.** A telegraphed attack is a direction, not a tile (`Unit.dir`, plus `dist` for the hawk). `threat(u)` works out the tiles from where the predator stands now, so pushing it moves the attack. A predator in a cloud when its turn comes does nothing.

## Ice, high ground and fire

- **Ice** is walked on normally; it only matters when something is pushed.
- **High ground**: whoever stands on it does 1 more damage with any action or attack that does damage. Predators too.
- **Fire**: stopping on a burning tile costs 1. After the predators' attacks, everything on the ground standing in fire takes 1, each fire spreads to brambles and hay bales next to it (a bale burns away), and each fire burns down by one. A new fire lasts 3 predator phases (`FIRE_TURNS`); brambles that burn out become grass. The fire step has no randomness and is part of `resolveAttacks()`, so the forecast counts it.

## Chinchillas

| Name | Class | Health | Move | Action | Second action |
| --- | --- | --- | --- | --- | --- |
| Dora | Scout | 3 | 4 | **Seed Shot**: a straight line; the first thing in the way takes 1 and is pushed back. | **Piercing Seed**: every creature in the line takes 1, up to the first rock, bale or burrow, which is hit too. No push. |
| Enzo | Bruiser | 4 | 3 | **Tail Whack**: the tile next to him takes 2 and is pushed away. | **Ground Slam**: all four tiles around him take 1 and are pushed away. |
| Pip | Scout | 2 | 5 | **Dust Puff**: lobbed 2 to 4 tiles in a line; a dust cloud lands there and everything next to it is pushed outward. | **Switcheroo**: swaps places with the first creature in a straight line, friend or predator. |
| Grandpa Pebble | Warden | 5 | 3 | **Hay Toss**: lobbed 2 to 3 tiles in a line; an empty tile gets a hay bale, an occupied one takes 1. | **Brace**: a burrow next to him survives the next hit it takes. |
| Mochi | Warden | 3 | 4 | **Tug**: a straight line; the first creature is pulled right up to her. | **Lullaby**: a predator 1 or 2 tiles away in a line forgets its attack. Not the cougar or the bear. |
| Biscuit | Bruiser | 3 | 4 | **Pounce**: leaps 2 to 4 tiles in a line to an empty tile; everyone next to the landing takes 1 and is pushed outward. | **Drop Kick**: the creature next to her slides up to 3 tiles and is bumped if something stops it. |

Everyone can also **Groom** (heal 1) as their action. It is still one action a turn: a chinchilla that knows its second action chooses between the two. Your own shots hurt your own side: a Seed Shot that reaches a burrow collapses it.

A second action has to be learned (`Unit.skill`). In the campaign, each chapter-two mission lists who knows theirs (`Mission.skills`) and introduces one (`Mission.teaches`). In The Long Night it is one of the rewards.

### Classes

A class (`CLASSES`) gives a perk that is always on, in every mission.

| Class | Perk | Upgrade caps in a run (health / move / damage) |
| --- | --- | --- |
| Scout | **Hit and run**: may still move after acting, if it has not moved yet this turn. | 1 / 3 / 1 |
| Bruiser | **Heavy paws**: anything they knock into something takes 1 more. | 2 / 1 / 2 |
| Warden | **Stand guard**: a predator's attack on a burrow next to a Warden hits the Warden instead. | 3 / 2 / 1 |

## Predators

| Name | Health | Move | Attack |
| --- | --- | --- | --- |
| Fox | 3 | 3 | **Bite**: the tile in front, 1. |
| Snake | 2 | 2 | **Spit**: a straight line; the first thing in the way takes 1. |
| Owl (flies) | 2 | 4 | **Swoop**: flies in a line until something is in the way; it takes 2 and is knocked back. |
| Weasel | 2 | 4 | **Lunge**: the two tiles in front, 1 each. |
| Mole | 2 | 4 | **Nip**: the tile in front, 1. Tunnels under rocks, bales, water and creatures when it moves. |
| Skunk | 3 | 3 | **Spray**: the tile in front takes 1 and is covered by a stink cloud, which works like a dust cloud. |
| Badger | 5 | 2 | **Sweep**: the tile in front and the two beside it, 2 each. |
| Hawk (flies) | 3 | 4 | **Dive**: one tile 2 to 4 away in a line, 2. |
| Mountain Cougar | 9 | 3 | **Rake**: all four tiles around it take 2 and are thrown back. Too heavy to drown. |
| Great Bear | 12 | 2 | **Charge**: runs in a line until something is in the way, hits it for 3 and knocks it back. Too heavy to drown. |

An **alpha** has 2 more health and does 1 more damage; it has a gold rim on its health bar. A **marked** predator (`Unit.mark`, a gold crosshair by its health bar) is the one a hunt or a boss battle is about.

**How they think.** In id order, each predator scores every tile it can reach with every direction (and dive distance): a burrow is worth 6 (9 for the nursery, 3 with a Warden beside it, 1 if it is braced or another predator already has it), a chinchilla 4 (7 if the hit would knock it out, 3 more for the kit), a bale 0.5, and hitting another predator costs 5. Ending in brambles or fire costs 3 and in a cloud 4; high ground is worth a little. With nothing to hit, it closes on the nearest burrow or chinchilla. Ties break on the battle's seeded generator. This is the only randomness after a battle is set up, and it runs after attacks resolve, so `forecast()` is exact.

## Objectives

`BattleDef.goal`, shown under the mission title (`goalText`):

- **hold** (the default): the battle is won after the last turn's predator phase, or as soon as no predators are left and none are coming.
- **escort**: a kit (2 health, moves 3, can only groom) starts at `BattleDef.kit` and has to reach the den at `BattleDef.exit`. Won the moment it stands there; lost if the kit is knocked out or the turns run out.
- **hunt**: won the moment the marked predator is knocked out; lost if the turns run out first.

`BattleDef.key` makes one burrow the **nursery** (a gold star over it): if it collapses the battle is lost, whatever the objective. A **boss** battle is `hold` with a marked boss: it is won the moment the boss is knocked out, or by lasting the turns.

## Seeing ahead

- `threat(u)` gives the tiles a predator is about to hit; the scene draws them red, with an arrow.
- `preview(id, ability, x, y)` returns a copy of the battle after an action. While you aim, the scene draws that copy's features and threats, arrows for everything that would move, and the damage each thing would take.
- `forecast()` resolves the coming attacks and the fire on a copy and reports the warren and health that would be lost. The page shows it as "If you end the turn now".
- `hint(battle)` returns what the planner would do next (below). The page's Hint button marks the move and the target on the board.

A `Battle` is plain data, so `clone()` is cheap. Previews, forecasts, the hint, the reset button, saving and the test bot all work on copies.

## The planner

`boardValue`, `bestStep`, `planTurn` and `hint` are in the engine. For each chinchilla, `bestStep` tries every move and every action it knows on a copy (and, for a Scout, acting first and moving after), lets the predators' attacks and the fire resolve there, and keeps what leaves the board best. `planTurn` tries each order of the chinchillas and keeps the best whole turn. It looks one turn ahead and knows nothing about where predators will go next. The Hint button and the test bot use the same code.

## The guided first mission

The first time mission 1 is played (no stars on it yet), a guide bar over the top of the board walks through turn 1: press Seed Shot, hover and click the fox, move or whack with Enzo, read the forecast, end the turn. Each step is worked out from the state of the battle (`guide` in the page), so it follows whatever the player actually does. The button to press pulses and a gold pointer hangs over the tile to click. It says one more thing on turn 2 and then stops.

## Campaign

Eighteen fixed missions (`MISSIONS`). Stars: one for winning, one for losing no burrow, one for the mission's bonus (`stars`, `bonusMet`). A mission opens when the one before it is won.

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
| 10 | The Mountain Cougar | Dora, Enzo, Biscuit | 6 | Knock out the Mountain Cougar | Chapter two |

Missions 5, 8, 9 and 10 have a warren of 4; the rest have 3.

**Chapter two** (`CHAPTER_TWO` is its first index). You choose where the squad starts in all of these.

| # | Mission | Squad | Turns | What is new | Second action taught | Bonus |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | Thin Ice | Dora, Enzo, Mochi | 4 | Ice | Enzo: Ground Slam | Send 2 predators into the water |
| 12 | Wildfire | Dora, Pip, Grandpa Pebble | 4 | Fire | Dora: Piercing Seed | Knock out 3 predators |
| 13 | High Ground | Dora, Biscuit, Enzo | 5 | High ground, skunks | Biscuit: Drop Kick | Keep every chinchilla standing |
| 14 | The Lost Kit | Pip, Mochi, Enzo | 6 | Escort | Pip: Switcheroo | Keep every chinchilla standing |
| 15 | The Nursery | Grandpa Pebble, Enzo, Dora | 5 | The nursery, moles | Grandpa Pebble: Brace | Knock out 3 predators |
| 16 | The Old Badger | Mochi, Biscuit, Dora | 5 | Hunt (an alpha badger with 10 health) | Mochi: Lullaby | Make one predator hit another |
| 17 | Smoke and Stink | Pip, Grandpa Pebble, Enzo | 5 | Everything at once | | Smother 2 attacks in dust |
| 18 | The Great Bear | Dora, Mochi, Biscuit | 6 | The Great Bear | | Knock out the Great Bear |

Missions 13 and 15 to 18 have a warren of 4; the rest have 3.

## The Long Night

A run (`Run`) of seven battles (`RUN_STAGES`) with three chinchillas of your choice: two in the Meadow, two in the Foothills, two in the High Pass, then a boss: the Great Bear on even seeds, the Mountain Cougar on odd ones (`runBoss`). The warren carries through.

- **Difficulty** (`DIFFICULTY`), chosen on the menu: Gentle has a warren of 6 and 0.8 × the predator budgets, Standard a warren of 5 (`RUN_WARREN`), Fierce a warren of 4 and 1.3 × the budgets.
- `makeField(seed, stage, difficulty)` builds each battle from the run's seed: one or two ponds, three or four burrows on the home side, rocks, brambles and bales, high ground from the Foothills on, a patch of ice in the High Pass, sometimes a fire burning beside the Foothills' brambles, then predators bought from a budget. From the third night on, about one battle in three makes one burrow the nursery. It rejects any board where part of the open ground cannot be walked to.
- Budgets on Standard: 7 points on the board at the start plus 1 per stage (`START_BUDGET`, `START_STEP`), and 3.8 a turn plus 0.8 per stage arriving through rustling grass (`WAVE_BUDGET`, `WAVE_STEP`). A fox or snake costs 2, an owl, weasel, mole or skunk 3, a hawk 4, a badger 5. Skunks appear from the Foothills, moles in the High Pass. From the fourth battle a predator can be an alpha for 2 more (`ALPHA_FROM`, `ALPHA_CHANCE`).
- Battles last 4 turns in the Meadow, 5 after that and 6 against the boss.
- After each battle, pick one of three rewards: an upgrade for one chinchilla (+1 health, +1 move or +1 damage, up to its class's caps), a second action for one chinchilla, a relic, or a warren repair when the warren is hurt.
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

- `burrow-tactics-v1`: best stars for each mission, the most battles of a run ever won, the difficulties a run has been finished on, the difficulty last chosen, and whether sound is off. A save from before chapter two is read as it is, with no stars on the new missions.
- `burrow-tactics-run-v2`: the run in progress (`Run.snapshot()`), written after every move, action and turn, so a run resumes exactly where it was left. It is removed when the run ends. (`-v1` runs, from before difficulty and second actions, are ignored.)
- A campaign mission in progress is not saved.

## Drawing and animation

The engine resolves a whole action or predator phase at once and leaves a list of events (`Battle.events`). The `Stage` in the scene keeps its own picture of the board and plays those events in order (walks, shots, pushes, knock-outs, fires), then syncs to the engine. While events are playing, the page shows the Stage's warren and health, not the engine's, so the HUD never gets ahead of what you have seen. Clicking the board, or pressing Enter or Space, skips to the end of the animation.

The three regions each have their own sky, mountains, grass and soil. The backdrop and tiles are drawn once per battle and cached (and redrawn when brambles burn away); water, fire, features, creatures and effects are drawn every frame. High ground is drawn raised, and everything on it is drawn that much higher (`Stage.center`). Chinchillas are the arcade's `drawChinchilla` with a coat and a scarf each.

## Tests

- `npm run test:tactics` (also in `npm test`): moving and undo, every action and second action, the three class perks, pushing into each kind of thing, ice, high ground and fire, every predator attack, attacks following a pushed predator, the forecast matching what then happens on every mission, previews, rustling grass, each objective, choosing where to start, the hint, reset, snapshots, relics, the campaign's maps, generated boards for 30 seeds, difficulty, and the run's rewards and saving.
- `npm run bot:tactics`: `tests/burrow-tactics-bot.mjs` plays all eighteen missions and twelve seeded runs with the engine's planner and prints the results (`ALL=1` plays the runs on every difficulty). `npm test` needs it to win every mission with at least 2 stars and at least 6 of 12 Standard runs, and needs an idle player to lose every mission. As of 04-10-2026 it wins 8 of those 12 runs, and over 48 runs with six squads it wins 46 on Gentle, 42 on Standard and 24 on Fierce. Rerun it after any balance change.
- `tests/e2e/burrow-tactics.mjs` (in `npm run test:e2e`): the page in a browser, including the guided first mission, the hint, choosing where to start and a second action.
