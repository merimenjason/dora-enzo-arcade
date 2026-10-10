# Dora & Enzo's Arcade

Thirty original browser games starring two chinchillas, served from one arcade menu at `/`. Live at https://chinchillas.jason.engineering. `README.md` has the full game list, per-game guides and the deployment guide; `HANDOFF.md` has the current state of the work.

## Commands

```sh
npm ci
npm run dev          # arcade at http://localhost:3000
npm run typecheck
npm test             # every engine suite, the bots, and the README check
npm run build        # vinext build of the Cloudflare Worker into dist/
npm run test:e2e     # browser suites; needs `npm run dev` running and Playwright
```

Node 22.13 or newer. One game at a time: `npm run test:<game>` and `npm run bot:<game>` (see `package.json` for the names). Playwright is not a dependency: install it with `npm i -D playwright` before running the browser suites, and don't commit that change.

## How a game is built

Each game is split three ways, and new games follow the same split:

- **Engine**, `lib/<name>-game.ts`: the rules, deterministic, with no DOM. Randomness comes from a seeded generator, so a seed replays a game exactly. The Node tests in `tests/<name>.mjs` drive the engine directly.
- **Scene**, `lib/<name>-scene.ts`: drawing only. Three.js for the 3D games, Canvas 2D for the flat ones. Chinchillas are drawn with the shared `drawChinchilla` in `lib/chinchilla-art.ts`.
- **Page**, `app/<route>/page.tsx`: the client page that wires input, the loop, saving and the HUD.

`npm test` compiles the engines with `tsc` into `.checks/` (git-ignored) and runs the suites against the compiled output, so a new engine has to be added to both the `tsc` list and the `node` list in the `test` script.

Progress is saved in `localStorage` under a versioned key per game (for example `hay-maze-run-v1`). When a save format changes, bump the version so old saves are ignored, not misread.

The ten newest games expose the running game on `window` (for example `window.__maze()`) for the browser tests.

`components/` is the stock shadcn UI kit; only a handful of pages import from it.

## Things that bite

- **Pushing to `main` deploys.** CI runs typecheck, tests and build, then publishes to Cloudflare Workers. Work on a branch and open a pull request; merges so far were rebase-merged to keep `main` linear.
- **The game count is hardcoded in many places.** Adding or removing a game means following the **Adding a game** checklist in `README.md` in full; `tests/readme.mjs` (part of `npm test`) fails when the README and `GAMES` in `app/page.tsx` disagree.
- **Don't run `oxfmt` across the repo.** `oxfmt --check` fails on most files, old ones included, so match the hand-formatted style of the file you are in.
- **Balance changes need the bots.** Rerun the game's `bot:` script after changing any balance number; the Hay Maze and Chinchillas vs Zombies bots have win-count thresholds that `npm test` enforces.
- **Dates in Markdown are dd-mm-yyyy.**

## House rules

The documentation and changelog rules, and how to use the graft context graph, are in `AGENTS.md`:

@AGENTS.md
