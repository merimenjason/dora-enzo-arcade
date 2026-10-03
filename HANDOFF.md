# Handoff · 03-10-2026

Where Dora & Enzo's Arcade stands, how the newest games fit together, how to check your work, and what is worth doing next. For the arcade as a whole, start with [`README.md`](README.md); for how the code is laid out and the traps to avoid, [`CLAUDE.md`](CLAUDE.md); for the documentation and changelog rules, [`AGENTS.md`](AGENTS.md).

This file replaces the handover of 26-09-2026 (`HANDOVER.md`), whose notes are folded in below.

## Current state

- **21 games**, all on `main` and live at https://chinchillas.jason.engineering.
- The last game commit on `main` is `d0a02a6` (30-09-2026), which added Chinchilla Scribble.
- The documentation round of 03-10-2026 is committed on the branch `docs/handoff-and-agent-guide`, which `feat/dustbound-combat` is built on; neither is merged to `main`: this file (replacing `HANDOVER.md`), the expanded `CLAUDE.md`, a README pointer, a changelog entry, and the prompt-audit edits to `AGENTS.md` and `.claude/skills/graft/SKILL.md` (see **Agent configuration**).
- Left uncommitted in the working tree, and not reviewed in that round: `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs`, and six added lines about reporting dollar savings in `.claude/skills/graft/SKILL.md`. All three were modified before the round began.

In that round only `tests/readme.mjs` was rerun (it passes); the rest of `npm test`, the typecheck and the build were not, because no game code changed.

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
| Save keys (`localStorage`) | `chinchilla-clash-v1` | `hay-maze-v2` (stats) and `hay-maze-run-v1` (the run in progress); the first version's `hay-maze-v1` is no longer read | `chinchillas-vs-zombies-v1` (nights won) | `chinchilla-scribble-v1` |
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

Game 05 (`/adventure`, titled *Dustbound* in game) was reworked on 03-10-2026, on the branch `feat/dustbound-combat`, pushed but not yet merged. Rules in `lib/arpg-game.ts`, drawing in `lib/arpg-scene.ts`, page in `app/adventure/page.tsx`, styles at the end of `app/globals.css`, tests in `tests/arpg.mjs`. Full rules: [`docs/dustbound-rpg.md`](docs/dustbound-rpg.md).

- **Attack visuals are cosmetic.** `Hero.swing` and `Hero.aim` are set when an attack fires and only the scene reads them; damage timing is unchanged. `Adventure.shake` drives the camera shake.
- **Shift-attack** is `standAttack()` / `release()` and `strike()`: the leader stays put while `hold` is set.
- **Elites** are chosen in `setup()` from a generator seeded by the floor, separate from `generateFloor`, so floor layouts for a seed did not change.
- **Gear** is forged by `forge()` from `Adventure.roll`, a generator seeded by the run. `wear()` is the one place that moves maximum courage with gear. Critical hits only roll when gear gives a critical chance.
- **Saving:** `snapshot()` and `Adventure.restore()`, key `dustbound-v1`. Bump `SAVE_VERSION` when the shape changes; older saves are then ignored. A restore rebuilds the floor from its start.
- **Balance** of elites and gear has only been checked by the existing bot playthroughs (four floors on three seeds, no revivals). Deeper floors have not been played.
- The page has no `window` test hook and there is no browser test for this game.

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

The lists for Clash, Hay Maze and Chinchillas vs Zombies date from 26-09-2026 and have not been re-checked against the code since.

- **Sound.** Clash, Hay Maze and Chinchillas vs Zombies had none. Other cabinets have WebAudio helpers (`app/dusty-hollow/sound.ts`, `app/mountain-retreat/sound.ts`) that could be borrowed.
- **Hay Maze on phones:** the meadow is only about 16 px a tile at phone width. Building uses tap-to-preview, then tap-again-to-build, to avoid misplacing. A zoomed or scrollable view would help more.
- **Hay Maze:** towers have no targeting modes (they always shoot the predator furthest along). There is no endless mode and no difficulty setting. Runs save between waves and at the reward screen (`Run.snapshot()` and `Run.load()`, key `hay-maze-run-v1`), but not mid-wave: leaving mid-wave restarts that wave. Bump `SAVE_VERSION` when the save format changes; older saves are then simply not offered. Emberward's multi-tile towers (archways, line shooters) and its branching region map aren't in yet, and would be natural next steps.
- **Chinchilla Clash:** no card levels, emotes or two-player mode. The computer player never uses the pocket placement opened by a fallen tower.
- **Chinchillas vs Zombies:** a night in progress isn't saved, only the nights won. There's no endless mode, no mini-games and no night-time or pool lawns. On a phone the lawn is small (tiles about 32 px); tap-to-preview keeps planting accurate.
- **Chinchilla Scribble:** no bot plays the levels, and its limits haven't been written up.
- **Balance** has only been tuned against bots. Watch real players on levels 5–6 of Hay Maze, against Baron Ebony in Clash, and on nights 7–8 of Chinchillas vs Zombies, the hardest of each.
