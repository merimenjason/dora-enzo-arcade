# Handover · 26-09-2026

What was added to Dora & Enzo's Arcade in this round of work, how it fits together, how to check it, and what is worth doing next. For the arcade as a whole, start with [`README.md`](README.md). For the house rules on documentation and the changelog, see [`AGENTS.md`](AGENTS.md).

## What shipped

Two new cabinets. The arcade now has 19 games.

| # | Game | Route | Status |
| --- | --- | --- | --- |
| 18 | Chinchilla Clash | `/clash` | Merged to `main` (PR #1) and deployed |
| 19 | Hay Maze Defence | `/hay-maze` | Merged to `main` (PR #2), then reworked in the style of Emberward (PR #3) |

- **Chinchilla Clash** is a Clash Royale-style lane battler. It has a deck of 8 cards from 12 and bath dust instead of elixir. There are princess and king towers, double dust in the last minute, overtime and a tie-break. The trophy road has three rival chinchilla clans (beige, violet, ebony), each with its own computer opponent. Full rules: [`docs/chinchilla-clash.md`](docs/chinchilla-clash.md).
- **Hay Maze Defence** is a roguelite tower defence in the style of [Emberward](https://store.steampowered.com/app/2459550/Emberward/). Predators take the shortest open route to the Hearthlight. The player draws hay-bale blocks as cards (tetromino-like shapes), turns them and lays them into a maze, which can never be sealed completely. Towers stand on top of the bales or rocks. There are eight towers with elements that react with each other (chilled foes shatter under sparks, and burning foes flare under moonlight), plus relics. A run is six levels on generated meadows, with a reward after each. Full rules: [`docs/hay-maze.md`](docs/hay-maze.md).

Both have README rows and guides, docs pages and changelog entries (under 26-09-2026). The hardcoded game counts are updated as listed in the README's **Adding a game** checklist.

## Where the code lives

Both games follow the arcade's usual split: a deterministic engine with no DOM, a Canvas 2D scene, and a client page.

| Part | Chinchilla Clash | Hay Maze Defence |
| --- | --- | --- |
| Rules (deterministic, testable in Node) | `lib/chinchilla-clash-game.ts` | `lib/hay-maze-game.ts` |
| Drawing | `lib/chinchilla-clash-scene.ts` | `lib/hay-maze-scene.ts` |
| Page, styles, metadata | `app/clash/` | `app/hay-maze/` |
| Engine tests (`npm test`) | `tests/chinchilla-clash.mjs` | `tests/hay-maze.mjs`, `tests/hay-maze-bot.mjs` |
| Browser test (`npm run test:e2e`) | `tests/e2e/chinchilla-clash.mjs` | `tests/e2e/hay-maze.mjs` |
| Save key (`localStorage`) | `chinchilla-clash-v1` | `hay-maze-v2` (the first version's `hay-maze-v1` is no longer read) |

Both draw Dora, Enzo and the other chinchillas with the shared `drawChinchilla` from `lib/chinchilla-art.ts`, using `coatLike` for other coats.

### Chinchilla Clash, briefly

- Arena of 18 × 32 tiles; side 0 (the player) owns the bottom. `local(side, y)` flips y so every side sees itself at the bottom, and the computer player (`think`) is written in that view.
- All randomness comes from `rng(seed)` (mulberry32), so a seed replays a match exactly.
- The computer player spells towers it can finish, then defends the most urgent push, then supports a crossing tank, and attacks once it has saved enough dust. Each rival's `AiLevel` in `RIVALS` sets how it plays; `STEADY` is a neutral bot for tests.
- Balance at the time of writing: `STEADY` playing the starter deck wins about 29/30, 21/30 and 9/30 against the three rivals. `tests/chinchilla-clash.mjs` asserts that each arena is harder than the last.

### Hay Maze Defence, briefly

- The state is split into two classes. `Run` holds what carries over: the Hearthlight, the deck, unlocked towers, relics and the reward choice. `Battle` is one level: the generated meadow (`makeLayout`), its wave plan (`planWaves`), bales, towers, hand, draw and discard piles, and hay.
- Grid of 20 × 12 tiles. `field()` is a BFS from the burrow door round rocks and bales. Ground predators step to the neighbouring tile with fewer steps to go.
- **Only bales block the route; towers don't** (they stand on bales or rocks). `canPlace()` refuses a piece that would cut off a way in, and bales can only be laid in the build phase.
- Pieces are `PIECES` cells, turned by `shape()` and centred by `cellsAt()`.
- Elements are resolved in `Battle.fire()` and `fly()`: `SHATTER` for sparks on chilled foes, and `FLARE` for moonlight on burning foes.
- Relics change a tower's numbers in `Battle.stats()`, plus a few hooks: Hay Loft, Lucky Raisin, Old Map and Hearthstone.
- Everything random comes from `rng(seed)`: the run's rewards from the run's seed, and each level's meadow, waves and shuffles from the seed and the level number. A seed replays a run exactly.
- Balance knobs: `hpScale` and `toughness` (health growth, mostly within a level, because each level starts from scratch), `budget` and `COST` (wave size), `LEVEL_HAY` and `LEVEL_HAY_STEP`, `FIRST_DRAW` and `DRAW_PER_WAVE`, and the tower, enemy and relic tables. The first wave of each level has no hawks or badgers, which stops a new level from opening with a wave you can't answer yet.
- `tests/hay-maze-bot.mjs` plays six seeded runs. It lays bales along a snaking plan to lengthen the walk, stands towers where they cover the route (and anti-air along the hawks' flight line), and picks rewards. It currently wins 4 of 6, usually with the flame well down, and `npm test` needs at least 3. Rerun it after any balance change; it takes about five seconds.

## Checking your work

```sh
npm ci
npm run typecheck
npm test                    # every engine suite, both bots, and the README check
npm run build
npm run test:clash          # one game at a time
npm run test:hay-maze
npm run bot:hay-maze
```

Browser tests need `npm run dev` running and Playwright. Playwright is **not** in `devDependencies`. Install it with `npm i -D playwright`, or link a global copy (`ln -s "$(npm root -g)/playwright" node_modules/playwright`). Then run `node tests/e2e/chinchilla-clash.mjs`, `node tests/e2e/hay-maze.mjs` or the whole `npm run test:e2e`. The browser tests write screenshots to `.checks/<game>/`, which git ignores.

CI (`.github/workflows/ci.yml`) runs typecheck, `npm test` and the build on every push and pull request. Every push to `main` then deploys to https://chinchillas.jason.engineering on Cloudflare Workers. So merging to `main` means going live. Both pull requests so far were rebase-merged to keep `main` linear.

## Things to know

- **Test hooks.** Each page exposes its running game on `window` (`window.__clash()` and `window.__maze()`) so the browser tests can read state and fast-forward. Anyone can use them from the console. That's harmless in a single-player game, but remove them if that ever matters.
- **Graft.** `AGENTS.md` asks agents to use the `graft` context graph, but `graft` wasn't installed in this environment and `graft/` is git-ignored. Run `graft build` wherever it's available so the graph picks up the new files.
- **Formatting.** `oxfmt --check` fails across most of the repo, old files included, so the new files match the surrounding hand-formatted style instead. `oxlint` is clean for all new files; the repo has older lint errors elsewhere.
- **The panel-contrast test** (`tests/e2e/panel-contrast.mjs`) now covers `/clash` and `/hay-maze`. Both pages hand text colour back to `p` elements (`color: inherit`), as the test expects.

## Known limitations and ideas for next time

- Neither new game has sound yet. Other cabinets have WebAudio helpers (`app/dusty-hollow/sound.ts`, `app/mountain-retreat/sound.ts`) that could be borrowed.
- **Hay Maze on phones:** the meadow is only about 16 px a tile at phone width. Building uses tap-to-preview, then tap-again-to-build, to avoid misplacing. A zoomed or scrollable view would help more.
- **Hay Maze:** towers have no targeting modes (they always shoot the predator furthest along). There is no endless mode, no difficulty setting and no mid-run save; leaving the page ends the run. Emberward's multi-tile towers (archways, line shooters) and its branching region map aren't in yet, and would be natural next steps.
- **Chinchilla Clash:** no card levels, emotes or two-player mode. The computer player never uses the pocket placement opened by a fallen tower.
- **Balance** has only been tuned against bots. Watch real players on levels 5–6 of Hay Maze and against Baron Ebony in Clash, the hardest of each.
