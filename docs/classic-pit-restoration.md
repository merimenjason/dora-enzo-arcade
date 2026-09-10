# Chin x Pit · Classic restoration

## Source and isolation

Restored from `6acbb9795049fb437fbae4decbb705abcf0b1546`, verified as the exact parent of survival conversion `23b35d5`. This is the original ball-bouncing game, not a survival rename.

- Historical `app/page.tsx` becomes `app/chin-x-pit/page.tsx`, with adjusted imports, namespaced classes and an explicit MAIN ARCADE return.
- Historical engine, passives, scene and weapon miniatures are copied to `lib/classic-pit-{game,passives,scene,weapons}.ts`. Apart from import paths, their historical implementations are unchanged.
- Historical pit CSS is copied to route-local `classic.css` with `.classic-pit-*` selectors. Current global CSS is unchanged.
- Shared `dungeon.ts` and `pit-predators.ts` are identical to the historical versions. Shared `chinchilla.ts` retains the compatible create/animate API and incorporates current paw improvements. Existing UI components and art remain compatible.
- Current survival page, pit engine, scene, passives and weapons are untouched. No existing game was removed.
- Historical `tests/pit.mjs` is preserved as `tests/classic-pit.mjs`, changing only the isolated module imports. It runs in `npm test` alongside the existing baseline suite.
- Arcade has ten distinct cards, including Classic and Night Survivors. Navigation and checkpoint-remake menu expectations now require ten.

## Observed validation (09-09-2026, +08:00)

| Check | Evidence |
| --- | --- |
| `npm run typecheck` | Passed after restoration and style isolation. |
| `npm test` | Historical Classic tests and all existing included game suites passed. Classic simulated all 12 waves, 48 kills, 100 courage, victory at level 7. Tests cover wall/enemy/paw rebounds, firing, all eight recipes, six passive effects, upgrade gating, pause, breach loss, boss victory and descent persistence. Survival also won its existing 239.4-second simulation. |
| `node tests/e2e/classic-pit.mjs` | Entered through the real arcade card, rendered WebGL, opened the 20-weapon catalogue, started a run, disabled auto-fire, aimed and held the mouse to fire, observed score 35 and chain 3, sent movement input, paused/resumed, reached wave 2, opened all eight fusion recipes, returned to arcade and entered survival. No page runtime errors. No game state injection. |
| `node tests/e2e/arcade-navigation.mjs` | All ten games returned through exactly one MAIN ARCADE link to ten cards. |
| `node tests/e2e/checkpoint-remake.mjs` | Existing original checkpoint gameplay, full remake shift, budget, next day, mobile layout, five species × both WebGL departure routes and updated arcade expectations passed. |
| `npm run build` | Passed, route table includes `/chin-x-pit` and all previous routes. Nonblocking large-chunk and vinext route-classification notices remain. |
| Visual inspection | `classic-pit-playing.png` in the Jcode scratch directory shows wave 2, the two chinchillas, aiming guide, multiple seed/stone projectiles and approaching predators inside the historical walled pit. |

The browser acceptance test validates real launching and early combat progression. Full-run victory and exhaustive fusion/passive mechanics are validated by the historical deterministic engine suite, not claimed as a full manual browser playthrough. Classic gameplay and ten-route navigation tests are included in `npm run test:e2e` for future runs. Browser tests expect the dev server at localhost:3000.
