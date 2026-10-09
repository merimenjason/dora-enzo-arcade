# Handoff · 09-10-2026

Where Dora & Enzo's Arcade stands, how the newest games fit together, how to check your work, and what is worth doing next. For the arcade as a whole, start with [`README.md`](README.md); for how the code is laid out and the traps to avoid, [`CLAUDE.md`](CLAUDE.md); for the documentation and changelog rules, [`AGENTS.md`](AGENTS.md).

This file replaces the handover of 26-09-2026 (`HANDOVER.md`), whose notes are folded in below.

## Quality pass · 08-10-2026

The four newest games received a focused quality pass on `fix/newest-games-quality-pass`. PR #15 is merged to main.

- **Burrow Tactics** and **Burrow Barrage** bank finished battles immediately, while the result screen still waits for the animation. Leaving or reloading during a victory no longer loses stars or a run reward. A resumed Tactics reward is banked once.
- **Burrow Barrage** releases walking, charging and board gestures between turns and on focus loss. Cancelled walking presses stop walking. Focused sliders keep their native arrow-key controls, and Space sets power to zero immediately when charging starts. Results resolved by the computer read the latest save, preserving current sound settings and earlier stars.
- **Poof Panic** pauses matches and Endless on focus loss and clears held input and unfinished gestures. A cancelled gesture does not rotate or hard-drop a pair; ordinary taps still work after cancellation.
- **Summit Shuffle** keeps the hand scrollable on landscape phones and narrow tablets rather than spilling sideways, and its introduction describes shared cards and each hero's own cards accurately.
- **Older games, same pass (PR #18, merged 09-10-2026):** Chinchilla Clash, Hay Maze Defence and Chinchillas vs Zombies bank a result inside the game loop as soon as the engine ends the game (it used to happen on the page's next redraw, after the part-way save was already cleared), read the save through a ref, and pause on `visibilitychange` as well as `blur`. Clash forgets a card drag on `pointercancel`. Burrow Tactics reads its save through a ref too. `npm run test:e2e:older` runs the three suites and `tests/e2e/older-quality.mjs`. Its Clash and Hay Maze checks and the Zombies hidden-tab check fail on the pages as they were; the Zombies save, Tactics and layout checks passed before too and are there to keep it that way.
- **Repeatable checks:** `npm run test:e2e:newest` runs the four quality-pass browser suites, Burrow Express and `tests/e2e/newest-quality.mjs`. Run `npm test` first to compile the engines and keep `npm run dev` running. The quality suite includes portrait and landscape layouts at 320 × 568, 568 × 320, 390 × 844 and 844 × 390.

Validation completed with the project's locked runtime dependencies: typecheck, `npm test`, the production build, all four main browser suites, all 16 quality regressions and the contrast check across 26 routes passed. Screenshots of the four phone layouts were inspected; browser checks reported no page errors.

This is a browser and regression pass, not a human balance or sound review. Real-phone gestures, animation feel, a listening pass and end-to-end human campaign/climb playtesting remain open. The eight lint findings in these four pages were reproduced on the unchanged baseline; they predate this pass.

Still open from the layout checks: the Bounce / Burrow (`/adventure`) and Paw Fighter II (`/fighter`) pages are wider than a 390-pixel phone screen (about 512 and 400 pixels), so they scroll sideways there. Neither has a layout check yet.


## Burrow Express · 09-10-2026

Game 26, `/express`, was merged to main in PR #16 on 09-10-2026, following the merged quality pass. It has a guided tutorial, three maps, eight-day shifts and Endless; route construction, transfers, fleet and seat upgrades, hay, rocky ground, cave-ins, mid-journey saving and touch controls. Full rules and balance numbers: [`docs/burrow-express.md`](docs/burrow-express.md).

The usual split is `lib/burrow-express-game.ts`, `lib/burrow-express-scene.ts`, and `app/express/`. Checks: `npm run test:express`, `npm run bot:express`, `tests/e2e/burrow-express.mjs`, `tests/e2e/burrow-express-animation.mjs`. Save keys: `burrow-express-v1`, `burrow-express-run-v1`, and `burrow-express-sound-v1`. The browser hook is `window.__express()`.

Routes and saves preserve passenger identities. The route finder ignores lines without carts and blocked tunnels. Editing parks a cart's passengers at the nearest end of its current segment before reassigning it. Dawn choices stop the engine clock. `Game.load` checks geometry, references, resources and passenger conservation before returning a saved route. Bump `v` if the saved shape changes. The game now uses the approved mock-up's painted terrain, station/cart atlases and close-up portrait, preserving Dora's dark ruby eyes. See `docs/burrow-express-art.md` for asset provenance and prompts; editing controls are in the station/tools drawer.

Validation on 08-10-2026: typecheck, the complete engine/README suite, build, targeted lint, the full Burrow Express browser playthrough, arcade navigation and contrast across 27 routes passed. The planner won 9 of 12 seeded shifts, 3 of 4 per map.

On 09-10-2026, live passenger groups and exact counts replaced baked-in station characters. Active art loads stations-empty.png, passengers.png and rail-props.png alongside terrain, carts and duo. Routes use sleepers, rails, coloured strips, timber crossings and directional markers. Transit events are presentation-only and excluded from v1 saves. The renderer follows passenger identities; pause/reduced motion suppress hops and freeze decoration. Dust baths contain dry powder. The focused animation suite passed with identity, simulation independence, pause, reduced motion, overflow and restored-count checks. Typecheck, targeted lint, the complete engine/README suite, production build, both Express browser suites and contrast across 27 routes passed. The planner remains at 9/12 seeded wins. PR #16 has been merged to main.

Human balance playtesting, real-device gesture checks and listening to the cues remain open; the planner and browser playthroughs provide the first balance check. Merging future feature branches to main deploys them.

## Moonlight Mischief · 09-10-2026

Game 27, `/moonlight`, was merged to main in PR #17 on 09-10-2026. It has three timed stealth heists, untimed practice, two distinct heroes, vision occluded by cottages, noisy paths, dry dust, hiding, a rescue and both heroes returning home. Code follows the engine/scene/page split in lib/moonlight-game.ts, lib/moonlight-scene.ts and app/moonlight. Artwork derives from the approved mock-up; exact prompts are in docs/moonlight-art.md. Save keys: moonlight-mischief-v1, moonlight-mischief-run-v1 and moonlight-mischief-sound-v1. Run saves resume paused, clear transient input and rebuild the rescued friend’s route. Results are banked before leaving the win screen. The browser hook is window.__moonlight().

Checks: npm run test:moonlight, npm run bot:moonlight and tests/e2e/moonlight.mjs. Validation: typecheck, targeted lint, the full engine/README suite, production build, a complete timed browser heist with saved results and unlocking, four phone layouts, asset-failure recovery, and contrast across 28 routes pass. The engine planner completes all three timed nights through legal navigation and abilities. Human balance, real-device feel and a listening pass remain useful follow-ups. The refinement pass adds objective hints, both heroes’ attention meters and warnings, keyboard focus after actions, standstill dashes, mobile creeping, zoom follow with manual-pan grace, and all-night practice. Practice never bypasses timed unlocks or awards stars. Saved owl positions validate against actual patrol segments and the engine’s corner tolerance; snapshot checks cover whole runs and a catch recovery. The planner wins all 15 patrol-phase variations. The engine suite validates 1,433 snapshots throughout complete heists and a catch recovery. Both browser suites, targeted lint, typecheck, build and contrast across 28 routes pass. Focused regression: tests/e2e/moonlight-polish.mjs, included in both browser scripts. New features go through a PR; merging to main deploys.

## Pawprint Pinball · 09-10-2026

Game 28, `/pinball`, is on `feat/pawprint-pinball` for review, based on latest main after the older-game fixes. It follows the approved Clockwork Warren mock-up, with authored table/piece PNGs, deterministic 240 Hz ball physics, rotating capsule flippers, ball-to-ball collisions, rescue targets, guided raised ramps, dry dust locks and three-ball multiball. Arcade uses three berries; practice is unlimited. Launch and multiball ball-save windows are seven and twelve seconds. Three quick nudges produce a three-second tilt. Save keys: pawprint-pinball-v1, pawprint-pinball-run-v1 and pawprint-pinball-sound-v1. Results bank immediately; snapshots restore paused and clear held launch/flip input. Browser hook: window.__pinball().

Checks: npm run test:pinball, npm run bot:pinball and tests/e2e/pinball.mjs. Validation passes: typecheck, targeted lint, full engine/README suite, production build, complete three-ball browser run, saved physics/records, native two-finger controls and cancellation, four phone layouts, arcade navigation and contrast across 29 routes. The planner exercises eight seeded runs, reaching rescues, ramps and multiball; the engine suite validates 14,400 in-play snapshots. Geometry constants are shared with the scene. Raised ramps guide the ball along visible tracks; ordinary field movement uses collision physics. Art provenance and exact prompts: docs/pinball-art.md. Human flipper feel and a listening pass remain useful follow-ups. Merging the PR deploys the game.

## Current state

- **27 games on `main`**; the deployed arcade is at https://chinchillas.jason.engineering. Game 22, **Burrow Tactics** (`/tactics`), was merged on 04-10-2026 (PR #5) together with the Bounce / Burrow combat work and the documentation round of 03-10-2026 it was stacked on.
- Game 23, **Burrow Barrage** (`/barrage`), was added on 04-10-2026. It has been tuned with its bot only and not yet played by hand; see **Burrow Barrage, briefly**. Its phone camera and a fix to the Chin x Pit browser test followed on the same day (PR #7).
- Game 24, **Summit Shuffle** (`/summit`), was built on 06-10-2026: a deck-building climb in the style of Slay the Spire. It too has been balanced with its bot only; see **Summit Shuffle, briefly**. The same change moved the 2D predator drawings out of `lib/burrow-tactics-scene.ts` into a shared `lib/predator-art.ts`, which both games now use.
- Game 25, **Poof Panic** (`/poof`), was also built on 06-10-2026: a versus falling-pair puzzler in the style of Puyo Puyo. Its rivals were set with its bot only; see **Poof Panic, briefly**.
- Left uncommitted in the working tree, and not reviewed in that round: `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs`, and six added lines about reporting dollar savings in `.claude/skills/graft/SKILL.md`. All three were modified before the round began.

For Summit Shuffle the typecheck, `npm test`, the build and the browser suites were all rerun on 06-10-2026.

## What shipped recently

The four newest cabinets, all merged to `main` and deployed.

| # | Game | Route | Added | Notes |
| --- | --- | --- | --- | --- |
| 18 | Chinchilla Clash | `/clash` | 26-09-2026 | PR #1 |
| 19 | Hay Maze Defence | `/hay-maze` | 26-09-2026 | PR #2, then reworked in the style of Emberward (PR #3); runs save between waves |
| 20 | Chinchillas vs Zombies | `/chinchillas-vs-zombies` | 26-09-2026 | Given a moonlit 2.5D lawn on 27-09-2026 |
| 21 | Chinchilla Scribble | `/scribble` | 30-09-2026 | |

- **Chinchilla Clash** is a Clash Royale-style lane battler. It has a deck of 8 cards from 12 and bath dust instead of elixir. There are princess and king towers, double dust in the last minute, overtime and a tie-break. The trophy road has three rival chinchilla clans (beige, violet, ebony), each with its own computer opponent. Full rules: [`docs/chinchilla-clash.md`](docs/chinchilla-clash.md).
- **Hay Maze Defence** is a roguelite tower defence in the style of [Emberward](https://store.steampowered.com/app/2459550/Emberward/). Predators take the shortest open route to the Hearthlight. The player draws hay-bale blocks as cards (tetromino-like shapes), turns them and lays them into a maze, which can never be sealed completely. Towers stand on top of the bales or rocks. There are eight towers with elements that react with each other (chilled foes shatter under sparks, and burning foes flare under moonlight), plus relics. A run is six levels on generated meadows, with a reward after each. Full rules: [`docs/hay-maze.md`](docs/hay-maze.md).
- **Chinchillas vs Zombies** is a Plants vs Zombies-style lane defence. Zombies walk the lanes of a 9 × 5 lawn towards the burrow. You plant chinchilla defenders one to a tile, paying with sunflower seeds from the sky and from Seed Gatherers. There are seven defenders and six zombies (including a pogo that jumps your first defender and a Brute that smashes defenders in one hit). Eight nights, each unlocking a defender, and a hay cart per lane that saves you once. Full rules: [`docs/chinchillas-vs-zombies.md`](docs/chinchillas-vs-zombies.md).
- **Chinchilla Scribble** is a Scribblenauts-style word puzzler. Write the name of a thing and it appears, with adjectives in front to change it; things act on each other (fire spreads, water puts it out, rivers freeze). Twelve levels plus a sandbox and a word book. Full rules: [`docs/scribble.md`](docs/scribble.md).

All four have README rows and guides, docs pages and changelog entries. The hardcoded game counts are updated as listed in the README's **Adding a game** checklist.

## Where the code lives

All four follow the arcade's usual split: a deterministic engine with no DOM, a Canvas 2D scene, and a client page.

| Part | Chinchilla Clash | Hay Maze Defence | Chinchillas vs Zombies | Chinchilla Scribble |
| --- | --- | --- | --- | --- |
| Rules (deterministic, testable in Node) | `lib/chinchilla-clash-game.ts` | `lib/hay-maze-game.ts` | `lib/cvz-game.ts` | `lib/scribble-game.ts`, with the vocabulary (177 nouns, 47 adjectives) in `lib/scribble-words.ts` |
| Drawing | `lib/chinchilla-clash-scene.ts` | `lib/hay-maze-scene.ts` | `lib/cvz-scene.ts` | `lib/scribble-scene.ts`, `lib/scribble-art.ts` |
| Page, styles, metadata | `app/clash/` | `app/hay-maze/` | `app/chinchillas-vs-zombies/` | `app/scribble/` |
| Engine tests (`npm test`) | `tests/chinchilla-clash.mjs` | `tests/hay-maze.mjs`, `tests/hay-maze-bot.mjs` | `tests/cvz.mjs`, `tests/cvz-bot.mjs` | `tests/scribble.mjs` |
| Browser test (`npm run test:e2e`) | `tests/e2e/chinchilla-clash.mjs` | `tests/e2e/hay-maze.mjs` | `tests/e2e/chinchillas-vs-zombies.mjs` | `tests/e2e/scribble.mjs` |
| Save keys (`localStorage`) | `chinchilla-clash-v1` | `hay-maze-v2` (stats) and `hay-maze-run-v1` (the run in progress); the first version's `hay-maze-v1` is no longer read | `chinchillas-vs-zombies-v1` (nights won) and `chinchillas-vs-zombies-night-v1` (the night in progress) | `chinchilla-scribble-v1` |
| Test hook on `window` | `__clash()` | `__maze()` | `__cvz()` | `__scribble()` |

Clash, Hay Maze and Chinchillas vs Zombies draw Dora, Enzo and the other chinchillas with the shared `drawChinchilla` from `lib/chinchilla-art.ts`, using `coatLike` for other coats.

### Chinchilla Clash, briefly

- Arena of 18 × 32 tiles; side 0 (the player) owns the bottom. `local(side, y)` flips y so every side sees itself at the bottom, and the computer player (`think`) is written in that view.
- All randomness comes from `rng(seed)` (mulberry32), so a seed replays a match exactly.
- The computer player spells towers it can finish, then defends the most urgent push, then supports a crossing tank, and attacks once it has saved enough dust. Each rival's `AiLevel` in `RIVALS` sets how it plays; `STEADY` is a neutral bot for tests.
- Balance as of 26-09-2026: `STEADY` playing the starter deck wins about 29/30, 21/30 and 9/30 against the three rivals. `tests/chinchilla-clash.mjs` asserts that each arena is harder than the last.

### Hay Maze Defence, briefly

- The state is split into two classes. `Run` holds what carries over: the Hearthlight, the deck, unlocked towers, relics and the reward choice. `Battle` is one level: the generated meadow (`makeLayout`), its wave plan (`planWaves`), bales, towers, hand, draw and discard piles, and hay.
- Grid of 20 × 12 tiles. `field()` is a BFS from the burrow door round rocks and bales. Ground predators step to the neighbouring tile with fewer steps to go.
- **Only bales block the route; towers don't** (they stand on bales or rocks). `canPlace()` refuses a piece that would cut off a way in, and bales can only be laid in the build phase.
- Pieces are `PIECES` cells, turned by `shape()` and centred by `cellsAt()`.
- Elements are resolved in `Battle.fire()` and `fly()`: `SHATTER` for sparks on chilled foes, and `FLARE` for moonlight on burning foes.
- Relics change a tower's numbers in `Battle.stats()`, plus a few hooks: Hay Loft, Lucky Raisin, Old Map and Hearthstone.
- Everything random comes from `rng(seed)`: the run's rewards from the run's seed, and each level's meadow, waves and shuffles from the seed and the level number. A seed replays a run exactly.
- Balance knobs: `hpScale` and `toughness` (health growth, mostly within a level, because each level starts from scratch), `budget` and `COST` (wave size), `LEVEL_HAY` and `LEVEL_HAY_STEP`, `FIRST_DRAW` and `DRAW_PER_WAVE`, and the tower, enemy and relic tables. The first wave of each level has no hawks or badgers, which stops a new level from opening with a wave you can't answer yet.
- `tests/hay-maze-bot.mjs` plays six seeded runs. It lays bales along a snaking plan to lengthen the walk, stands towers where they cover the route (and anti-air along the hawks' flight line), and picks rewards. As of 26-09-2026 it won 4 of 6, usually with the flame well down, and `npm test` needs at least 3. Rerun it after any balance change; it takes about five seconds.

### Chinchillas vs Zombies, briefly

- `Game` is one night. Tiles are `row` (0–4) and `col` (0–8); zombies have a fractional `x` and walk left. `planLevel(n, seed)` lays out every zombie of a night up front, and `update()` lets them in as their time comes.
- `touching(z, d)` is the one contact rule, used both for a zombie stopping to bite and for a Dust Trap going off, so the two can't disagree. An earlier version had them disagree, and a ready trap then blocked a zombie forever without firing.
- Balance knobs: `ZOMBIES` speeds and health, the `DEFENDERS` table, each level's `base` and `step` (wave points), `COST` (points per zombie), `FIRST_WAVE`, `WAVE_GAP`, `SKY_EVERY` and `START_SEEDS`.
- `tests/cvz-bot.mjs` plays each night with a simple gardener and must win all eight on seed 1. As of 26-09-2026, across seeds 1–6 it won 47 of 48, with night 8 the one it sometimes loses. Rerun it after any balance change; it takes a couple of seconds.

### Chinchilla Scribble, briefly

No engine notes have been written for Scribble yet. [`docs/scribble.md`](docs/scribble.md) covers the world, the words, what things do to each other, the levels, and stars and saving; the README guide lists what `tests/scribble.mjs` covers, including 24 scripted solutions across the 12 levels.

### Bounce / Burrow, briefly

Game 05 (`/adventure`, titled *Dustbound* in game) was reworked on 03-10-2026 on `feat/dustbound-combat`, then merged on 04-10-2026 with PR #5. Rules in `lib/arpg-game.ts`, drawing in `lib/arpg-scene.ts`, page in `app/adventure/page.tsx`, styles at the end of `app/globals.css`, tests in `tests/arpg.mjs`. Full rules: [`docs/dustbound-rpg.md`](docs/dustbound-rpg.md).

- **Attack visuals are cosmetic.** `Hero.swing` and `Hero.aim` are set when an attack fires and only the scene reads them; damage timing is unchanged. `Adventure.shake` drives the camera shake.
- **Shift-attack** is `standAttack()` / `release()` and `strike()`: the leader stays put while `hold` is set.
- **Elites** are chosen in `setup()` from a generator seeded by the floor, separate from `generateFloor`, so floor layouts for a seed did not change.
- **Gear** is forged by `forge()` from `Adventure.roll`, a generator seeded by the run. `wear()` is the one place that moves maximum courage with gear. Critical hits only roll when gear gives a critical chance.
- **Saving:** `snapshot()` and `Adventure.restore()`, key `dustbound-v1`. Bump `SAVE_VERSION` when the shape changes; older saves are then ignored. A restore rebuilds the floor from its start.
- **Balance** of elites and gear has only been checked by the existing bot playthroughs (four floors on three seeds, no revivals). Deeper floors have not been played.
- The page has no `window` test hook and there is no browser test for this game.

### Burrow Tactics, briefly

Game 22 (`/tactics`), turn-based tactics in the style of Into the Breach. Rules in `lib/burrow-tactics-game.ts`, drawing and animation in `lib/burrow-tactics-scene.ts`, page, styles and sounds in `app/tactics/`, tests in `tests/burrow-tactics.mjs`, the planner bot in `tests/burrow-tactics-bot.mjs`, the browser test in `tests/e2e/burrow-tactics.mjs`. Full rules: [`docs/burrow-tactics.md`](docs/burrow-tactics.md). Design notes and the build plan are under `docs/superpowers/`.

- **A `Battle` is plain data.** `clone()` copies it cheaply, and previews, the forecast, the reset button, saving and the bot all work on copies. Keep every field JSON-safe.
- **The engine does not animate.** It resolves an action or a whole predator phase at once and leaves events in `Battle.events`. The page hands them to `Stage.feed()`, which plays them and then syncs to the engine. A new kind of effect needs an event in `Ev` and a case in `Stage.anim()`.
- **Attacks are directions.** `Unit.dir` (and `dist` for the hawk) is set by `think()`; `threat()` turns it into tiles from where the predator stands now. That is what makes pushing a predator move its attack.
- **The only randomness after setup is in `think()` and `placeMarks()`**, both after attacks resolve, which is why `forecast()` can be exact. Keep it that way.
- **Balance knobs:** the `HEROES` and `PREDATORS` tables, each mission's map, squad, turns, warren and arrivals in `MISSIONS`, and for the run `START_BUDGET`, `START_STEP`, `WAVE_BUDGET`, `WAVE_STEP`, `ALPHA_FROM`, `ALPHA_CHANCE`, `RUN_WARREN` and the `DIFFICULTY` table.
- **The planner lives in the engine** (`boardValue`, `bestStep`, `planTurn`, `hint`). The Hint button and the bot in `tests/burrow-tactics-bot.mjs` both use it. It wins all eighteen missions and, as of 04-10-2026, 8 of the 12 seeded Standard runs that `npm test` plays (it needs 6); over 48 runs with six squads it wins 46 on Gentle, 42 on Standard and 24 on Fierce. It looks one turn ahead with perfect knowledge of the coming attacks, so a person will do worse than it does. Rerun `npm run bot:tactics` (`ALL=1` for every difficulty) after any balance change; it takes a few seconds.
- **Chapter two** (added 04-10-2026, the same day): classes with a perk each (`CLASSES`), a second action per chinchilla (`Unit.skill`), ice, high ground and fire, the objectives `escort` and `hunt` and the nursery burrow (`BattleDef.goal`, `key`), the mole, skunk and Great Bear, a deployment step (`Battle.state === 'deploy'`, `zone`, `place`, `ready`), run difficulty (`DIFFICULTY`), and the guided first mission (`guide` in the page). Design: `docs/superpowers/specs/04-10-2026-burrow-tactics-chapter-two-design.md`.
- Saves: `burrow-tactics-v1` (stars, sound, difficulty, best runs) and `burrow-tactics-run-v2` (the run in progress) and `burrow-tactics-mission-v1` (a campaign mission in progress). Test hook: `window.__tactics()` returns `{ battle, stage, run }`.

### Burrow Barrage, briefly

`lib/burrow-barrage-game.ts`, `lib/burrow-barrage-scene.ts`, `app/barrage/`, `tests/burrow-barrage.mjs`, `tests/burrow-barrage-bot.mjs`, `tests/e2e/burrow-barrage.mjs`. Save key `burrow-barrage-v1`; test hook `__barrage()`. Full notes in [`docs/burrow-barrage.md`](docs/burrow-barrage.md).

- **The ground is a grid of cells** (`Match.terrain`, 400 × 225). Shots carve circles out of it and units drop onto whatever is left; falling out of the bottom or being shoved off the side is a knock-out.
- **`flight()` changes nothing**, and both the real shot and the computer's search use it. Keep it that way, so what the computer plans is what happens.
- **The engine does not animate.** `fire()` resolves the whole turn and leaves `Match.events`; `Stage.feed()` plays them, and `Stage` carves its own copy of the ground when each blast is shown.
- **Turn order is by wait** (`Unit.delay`), not rounds: the lowest goes next.
- **Balance knobs:** the `RIDES` and `ITEMS` tables, `AI_LEVELS`, and the constants at the top of the engine (`GRAVITY`, `SPEED`, `WIND_PULL`, `DUSK_TURN`). Small changes swing the ride win rates a long way, so rerun `npm run bot:barrage` with `SEEDS=5` after any of them.
- **Not checked by a person:** the speed of the power bar (`CHARGE_RATE` in the page), how a shot looks in flight, and the crater sizes. The phone camera (`Stage.zoom`, `Stage.pan`, `Stage.toWorld`) has only been checked in a phone-sized browser window, not on a real phone.

### Summit Shuffle, briefly

`lib/summit-shuffle-game.ts` (rules), `lib/summit-shuffle-cards.ts` (cards, trinkets, statuses), `lib/summit-shuffle-foes.ts` (predators and encounters), `lib/summit-shuffle-scene.ts`, `app/summit/`, `tests/summit-shuffle.mjs`, `tests/summit-shuffle-bot.mjs`, `tests/e2e/summit-shuffle.mjs`. Save key `summit-shuffle-v1`; test hook `__summit()`. Full notes and every table in [`docs/summit-shuffle.md`](docs/summit-shuffle.md).

- **A climb is one `Run` of plain data**: three stretches of six rows of stops and a guardian, 21 stops. `run.save()` and `Run.load()` round-trip it. Saved during a fight, it gives the moment before the fight, and loading walks back into the same fight.
- **Three seeded streams** live in the run (`rng.map`, `rng.loot`, `rng.fight`), so nothing outside it affects a climb.
- **Cards ask, the engine does.** A card's `play` calls the `Ops` interface (`hit`, `fluff`, `hex`, `buff`, `draw` and so on), which `Run` implements. Adding a card is one `add(...)` or `aimed(...)` line in the cards file, plus a number in the bot's `WANT` table.
- **Predators are data.** Each has a table of moves and a `next` function that picks one; the engine turns the picked move into the intent on screen. Special behaviour keeps notes in the foe's `mem` (the dozing owl, the old fox's kits, the cougar's fury).
- **Timed statuses on the chinchilla count down at the start of its turn**, and land one higher when a predator applies them, so the number shown is the turns still to be felt. On predators they count down at the end of the predator's turn.
- **`run.clone()` copies everything but the maps.** The bot searches on clones; an earlier version shared the deck and trinkets, and fights won inside the search handed the real run their rewards.
- **The finished fight stays on the run** (`run.fight`) until the stop is left, so the scene can still draw its last moments. `textOf()` and the page check `run.phase`, not `run.fight`, to know whether a fight is on.
- **The scene draws at the canvas's own size** in CSS pixels, so a phone gets full-size text; predators share the line in proportion to their size.
- **The look was reworked on 07-10-2026**: a painted backdrop per stretch (cached, with clouds, motes or snow drawn live over it), claw marks, puffs and confetti fed by the same events, health bars that drain, drawn intent badges, a fanned hand, a painted trail map with drawn stop icons. The predators were redrawn the same day in the shared `lib/predator-art.ts` (which Burrow Tactics and Poof Panic also use): `blob()` outlines, `fur()` gradients lit from above, far-side limbs in shadow and outlines mixed from each animal's own tint, so a new tint recolours the whole animal. The scene still lays a light wash and the white hit flash over them (`Stage.shaded`). `tests/e2e/.tmp/pred-gallery.mjs` (git-ignored) renders every animal big and small for judging a change by eye.
- **Hover notes** go through one module-level `peek` in `app/summit/page.tsx`: `tipOn(make)` gives any element the mouse-over and long-press handlers, and the note is made again on every render so its numbers stay true. The words it explains are `GLOSSARY` in the cards file, and `npm test` checks every status a card names is in it.
- **Balance knobs:** the numbers in the cards file, the moves and health in the foes file, `HEROES`, `ALTITUDES`, `NAP`, the row weights (`WEIGHTS`) and reward odds (`offer()`). The game is sensitive: an early pair of altitude rules (12% more predator health and 10% harder hits) took the bot from about 50% to about 5%. Rerun `npm run bot:summit` after any change; `npm test` holds Base Camp between 50% and 95% for the bot.
- **Not checked by a person:** how fast the animations feel, whether tap-to-choose then tap-to-play is comfortable, and how hard each altitude is for someone who is not the bot.

### Poof Panic, briefly

`lib/poof-panic-game.ts` (rules, rivals, lessons), `lib/poof-panic-scene.ts`, `app/poof/page.tsx`. [`docs/poof-panic.md`](docs/poof-panic.md) has every number.

- **One tick, one input.** A `Board` advances in 60 ticks a second and takes one `Input` a tick. The page's `Pad` turns held keys and touches into those inputs; a rival's `Brain` produces the same thing, so rivals move pairs press by press like a player.
- **The grid functions are shared.** `collapse`, `findPops`, `resolve` and `land` are used by the board, by the rivals when they weigh a placement, and by `solve`, which checks the lessons. Change a rule there and all three follow.
- **Rivals are a row of numbers** in `RIVALS`; `harder()` makes the hard-ladder version. After changing any of them run `npm run bot:poof`, which fails if a rival stops beating the one below it. The bot is not part of `npm test`.
- **Dust has two counters**: `incoming` while the sender's chain is still running, `pending` once it may fall. `give()` cancels against both before sending.
- **Not yet played by hand.** How fast the pairs feel, whether the touch gestures are comfortable, and whether Mossy and Pongo are gentle enough for a first-time player are guesses from the bot's stand-in players.

## Checking your work

```sh
npm ci
npm run typecheck
npm test                    # every engine suite, the bots, and the README check
npm run build
npm run test:clash          # one game at a time
npm run test:hay-maze
npm run bot:hay-maze
npm run test:cvz
npm run bot:cvz
npm run test:scribble
npm run test:tactics
npm run bot:tactics
npm run test:barrage
npm run bot:barrage
npm run test:summit
npm run bot:summit
```

Browser tests need `npm run dev` running and Playwright. Playwright is **not** in `devDependencies`. Install it with `npm i -D playwright`, or link a global copy (`ln -s "$(npm root -g)/playwright" node_modules/playwright`). Then run one suite, such as `node tests/e2e/scribble.mjs`, or the whole `npm run test:e2e`. The browser tests write screenshots to `.checks/<game>/`, which git ignores.

CI (`.github/workflows/ci.yml`) runs typecheck, `npm test` and the build on every push and pull request. Every push to `main` then deploys to https://chinchillas.jason.engineering on Cloudflare Workers. So merging to `main` means going live. The pull requests so far were all rebase-merged to keep `main` linear.

## Things to know

- **`tests/checkpoint-remake.mjs` is not run by `npm test`.** The file exists, but neither it nor `lib/checkpoint-remake-game.ts` is in the `test` script in `package.json`. Whether that is deliberate is not recorded anywhere.
- **Test hooks.** The four pages above expose their running game on `window` so the browser tests can read state and fast-forward. Anyone can use them from the console. That's harmless in a single-player game, but remove them if that ever matters.
- **Formatting.** `oxfmt --check` fails across most of the repo, old files included, so new files match the surrounding hand-formatted style instead. `oxlint` was clean for Clash, Hay Maze and Chinchillas vs Zombies when they were added; the repo has older lint errors elsewhere.
- **The panel-contrast test** (`tests/e2e/panel-contrast.mjs`) covers the routes in its route list, the newest games included. Those pages hand text colour back to `p` elements (`color: inherit`), as the test expects.

## Agent configuration

The round of 03-10-2026 was spent on the Claude Code setup, not the games:

- **Prompt audit.** Three edits were applied to the graft instructions. In `AGENTS.md`, "For ANY task here" became "For tasks about this repo's code". In `.claude/skills/graft/SKILL.md`, the line calling card spans authoritative now excepts files edited in the same turn, and two mentions of old command names were removed.
- **One audit finding is still open.** `AGENTS.md` says to run `graft build` after big code changes; the graft skill says the tools refresh the graph themselves and `build` isn't needed after editing. Both passages came in the same commit, so someone has to decide which is right for the installed graft version and delete the other.
- **Both graft files look tool-generated** (the `AGENTS.md` block sits between `<!-- graft:start -->` markers), so regenerating them with graft may undo the audit edits.
- **Graft** is installed at 0.19.0, with 0.21.1 available (`npm i -g @nanonets/graft@latest`). `graft/` is git-ignored, so each checkout builds its own graph.
- **A context-bar mod** for Claude Code was written this round. It lives outside the repo, under `~/.claude/dev-mods/`, and is not part of this project.

## Known limitations and ideas for next time

**Fitting drawings into boxes (07-10-2026).** `lib/art-fit.ts` measures a drawing by painting it once off screen (`span`), and `fitDraw(c, key, x, y, w, h, paint, face)` then draws it standing on the bottom of a box, centred and scaled so that all of it is inside. `paint` draws with its feet at the origin, facing right. Every title banner and portrait that used to be placed by a fixed offset now goes through it (Clash, Hay Maze, Zombies, Barrage, Summit Shuffle, Burrow Tactics, Poof Panic, Scribble, Fluff Forge and `components/chinchilla-portrait.tsx`), because the chinchilla's tail and the redrawn predators made the old offsets overlap or run off the edge. Use it for any new portrait; give each animal its own box and they cannot overlap. The measurement is cached by `key`, so a key must name one drawing. The 3D games and the older hand-placed sprites inside play fields were looked at on their first screens only.

**Hit effects, same day.** Clash, Hay Maze and Zombies redraw the engine's `effects` (hits, dust, blasts, a broken-ice shatter, a zombie's splat, the brute's smash) in their scenes, and Clash shakes the arena when a tower falls. Burrow Tactics has `Stage.bursts` (a star where a chinchilla lands a blow, claw marks where a predator does, a ring when a burrow falls) and Burrow Barrage a fireball with smoke that hangs over the crater. They were checked by staging each effect at several ages in a screenshot, not by watching them move.

**Hover notes outside Summit Shuffle (07-10-2026).** `components/hover-note.tsx` is a small shared hook: a page calls `useHoverNote()`, spreads `tip(() => note)` on anything worth explaining (passing the element's own pointer handlers as the second argument so both run), and renders `view`. Chinchilla Clash (cards), Hay Maze Defence (towers, cards, relics), Chinchillas vs Zombies (packets) and Burrow Tactics (actions, chinchillas) and Burrow Barrage (rides, shots, items, team panels) use it. A long press was tried on a touch screen in all five on 07-10-2026 and shows the note without also counting as a tap. Scrolling hides a note, so a browser test must scroll the thing into view before it hovers. Summit Shuffle keeps its own richer version in its page.

**Units, same day.** Hay Maze's predators now come from the shared `predator-art` (its lynx is the cougar in a grey-tan tint); Clash's towers, capybara and gliders, the zombies' shading and Barrage's carts were redrawn in place.

**Graphics pass of 07-10-2026.** Chinchilla Clash, Hay Maze Defence, Burrow Tactics, Burrow Barrage and Chinchillas vs Zombies were repainted in the manner of Summit Shuffle. Clash, Hay Maze and Barrage now paint their ground or far view once onto a canvas of their own (`paintArena`, `paintGround`, `paintBackdrop`) and copy it each frame, keyed on the level and the canvas scale; anything that changes the static picture must change that key. It was judged from screenshots of a handful of screens per game, not by playing. Scratch screenshot scripts are in `tests/e2e/.tmp/` (`maze-look`, `clash-look`, `barrage-look2`, `tactics-look`; git-ignored).

The lists for Clash, Hay Maze and Chinchillas vs Zombies date from 26-09-2026 and have not been re-checked against the code since.

- **Sound.** Clash, Hay Maze and Chinchillas vs Zombies got sound on 07-10-2026. `lib/cue-sound.ts` is the shared synth: `makeSound(key, cues)` returns `cue`, `muted` and `setMuted`, remembers the mute under its own `localStorage` key (`chinchilla-clash-sound-v1`, `hay-maze-sound-v1`, `chinchillas-vs-zombies-sound-v1`: `on` or `off`), and will not restart the same cue within a short gap, so a volley is one sound. Each page plays a cue for every engine event and for every new entry on the engine's `effects` list (a `WeakSet` remembers which it has heard). Nobody has listened to it: the cues were written blind and need a pass by ear. M mutes in Clash and Zombies; in Hay Maze M already picks the seventh tower, so only the button does. The older games each have their own copy of much the same synth (`app/poof/sound.ts` and others) and could move onto the shared one.
- **Hay Maze on phones:** the meadow is only about 16 px a tile at phone width. Building uses tap-to-preview, then tap-again-to-build, to avoid misplacing. A zoomed or scrollable view would help more.
- **Hay Maze:** towers have no targeting modes (they always shoot the predator furthest along). There is no endless mode and no difficulty setting. Runs save between waves, at the reward screen and, since 07-10-2026, in the middle of a wave (`Run.snapshot()` and `Run.load()`, key `hay-maze-run-v1`); a wave comes back paused. Bump `SAVE_VERSION` when the save format changes; older saves are then simply not offered. Emberward's multi-tile towers (archways, line shooters) and its branching region map aren't in yet, and would be natural next steps.
- **Chinchilla Clash:** no card levels, emotes or two-player mode. The computer player never uses the pocket placement opened by a fallen tower.
- **Chinchillas vs Zombies:** a night in progress is saved since 07-10-2026 (`Game.snapshot()` and `Game.restore()`) and comes back paused. There's no endless mode, no mini-games and no night-time or pool lawns. On a phone the lawn is small (tiles about 32 px); tap-to-preview keeps planting accurate.
- **Chinchilla Scribble:** no bot plays the levels, and its limits haven't been written up.
- **Burrow Tactics:** balance has only been tuned against the bot; nobody has played the campaign or a run by hand from start to finish. A campaign mission in progress is saved since 07-10-2026. The hint looks one turn ahead only.
- **Summit Shuffle:** balanced against the bot only. Since 07-10-2026 each chinchilla has cards of their own (`who` on a card, `poolFor()`), sixteen of them new; the new ones have not been through `TRIAL=1`. One-use treats and more chance meetings are the obvious next additions. The bot plans one turn at a time, so cards that need setting up (Belly Flop, Puff Up, Sore Spot) score badly in its trials and may be stronger in a person's hands than their numbers suggest.
- **Balance** has only been tuned against bots. Watch real players on levels 5–6 of Hay Maze, against Baron Ebony in Clash, and on nights 7–8 of Chinchillas vs Zombies, the hardest of each.
