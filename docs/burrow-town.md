# Burrow Town

A cozy 3D city builder: Dora and Enzo settle a 16×12 tile Andean valley. Rules live in `lib/burrow-town-game.ts` (deterministic, no DOM), the Three.js view in `lib/burrow-town-scene.ts`, and the page in `app/burrow-town/`. Numbers below come from the engine's constants.

## Loop

- The engine ticks every `TICK` = 2 s. A day is `DAY` = 120 s; the scene lights lamps for the second half.
- `hay` is the only currency and starts at 120. Every tick each linked producer adds its yield, then residents eat 0.2 each. Hay never goes below 0. When hay is 0 and income is below upkeep, homes only fill to half.
- `apply(x, y, tool)` returns an empty string on success or the reason it failed (`blocked()` gives the same reason without acting). The page shows the reason as a notice and plays a deny blip.

## Terrain

`makeTerrain(valley)` builds the map from the valley seed with a Mulberry32 generator, so a valley always looks the same. The 5×5 square around the centre plaza is always grass. Rivers are one tile wide and wander across or down the map; a share of the grass beside them becomes terrace. Rock comes in diamond-shaped clusters; extra terrace bands are straight runs.

| Terrain | Roads | Buildings | Note |
| --- | --- | --- | --- |
| grass | 4 hay | all but quarry | |
| terrace | 4 hay | all but quarry | farms earn 4 instead of 3 |
| rock | no | quarry, watchtower | |
| river | 12 hay (bridge) | none | farms beside it earn +1 |

## Connectivity

`recompute()` floods the road network from every plaza. A road is linked if that flood reaches it; a building is linked if it is a plaza, or is four-neighbour adjacent to a linked road or to a plaza. Unlinked producers yield nothing, and unlinked homes lose residents (2 per tick). The scene hangs a red marker over anything unlinked. Extra plazas (Dora 75) root their own networks. The last plaza cannot be demolished.

## Buildings

| Building | Cost | Unlock | Effect |
| --- | --- | --- | --- |
| Burrow | 20 | start | houses 4 |
| Hay farm | 25 | start | 3 hay/tick; 4 on terrace; +1 beside river |
| Dust bath | 30 | start | comfort within 3 |
| Quarry | 40 | start, rock only | 2 hay/tick; enables workshops; nuisance within 2 |
| Garden | 25 | Dora 25 | comfort within 2 |
| Big burrow | 60 | Dora 50 | houses 10 |
| Plaza | 80 | Dora 75 | comfort within 4; roots roads |
| Market | 50 | Enzo 25 | 1 hay/tick per 3 residents within 4, max 8 |
| Workshop | 45 | Enzo 50 | 4 hay/tick with a linked quarry, else 1; nuisance within 2 |
| Watchtower | 35 | Enzo 75, rock allowed | comfort within 5; lamp |

Distances are Manhattan. Demolition refunds half the cost (2 for a road).

## Comfort and residents

Each home counts one comfort point per amenity kind in range (dust bath, garden, plaza, watchtower) and loses one per nuisance kind in range (quarry, workshop), clamped 0..4. `OCCUPANCY` = [0.4, 0.6, 0.8, 1, 1] scales capacity by comfort. Residents move in one per tick toward that target and leave two per tick. Happiness is the average comfort of occupied homes divided by 3, capped at 100.

## Advisors and wishes

`REQUESTS` holds 8 wishes for Dora and 9 for Enzo. Three are open at a time; when one is filled the next is drawn for whichever advisor has fewer open, from a seeded generator. Targets use `level` (valley number, sandbox counts as 3). Filling a wish pays its reward (15 or 20) in both approval and hay, logs a line from the advisor, and emits `unlock:<id>` for any building the new approval just crossed. Approval caps at 100 and never decays.

## Valleys and winning

`VALLEYS` lists five campaign maps with `{residents, approval}` goals: 20/25, 40/40, 60/50, 90/60 and 120/75. `goalMet` needs the population and both approvals; the tick that meets it sets `won`, emits `won` and stops the clock. `SANDBOX` (index −1) has infinite goals. The page stores cleared count under `burrow-town-progress-v1` and the current town under `burrow-town-save-v1` (`save()` / `BurrowTown.load()`), writing every 5 s, when the tab hides, and on leaving.

## Scene

`BurrowTownScene` rebuilds only tiles whose key changed (building, occupancy, link state, road neighbour mask). Terrain is boxes at four heights; buildings are small primitive assemblies; roads join their four neighbours and become plank bridges over water. Day-night blends the sky between day, dusk and night colours, drives the sun arc and window and lamp emissive strength, and the six nearest lamps get point lights. Dora and Enzo (the shared `createChinchilla` model) and up to 28 small residents (one per 3 residents) walk the road graph at random. Picking intersects a ground plane and maps to tile coordinates; the page draws a green or red ghost from `blocked()`.

## Tests

`npm run test:burrow-town` compiles the engine and runs `tests/burrow-town.mjs`, 21 checks covering terrain, costs, terrain rules, connectivity, economy, comfort, unlocks, wishes, demolition, second plazas, pause, winning, the sandbox, save round-trips and a 20-minute unattended run.
