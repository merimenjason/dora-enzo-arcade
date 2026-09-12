# Burrow Town

A cozy 3D city builder: Dora and Enzo settle a 16×12 tile Andean valley. Rules live in `lib/burrow-town-game.ts` (deterministic, no DOM), the Three.js view in `lib/burrow-town-scene.ts`, and the page in `app/burrow-town/`. Numbers below come from the engine's constants.

## Loop

- The engine ticks every `TICK` = 2 s of town time. A day is `DAY` = 120 s; the scene lights lamps for the second half. The clock runs at one of `SPEEDS` = ×1, ×2 or ×4.
- Every tick each linked producer adds its yield, then residents eat `HAY_PER_RESIDENT` = 0.2 each. Hay never drops below 0. When hay is 0 and income is below upkeep, homes only fill to half.
- `apply(x, y, tool)` returns an empty string on success or the reason it failed; `blocked()` gives the same reason without acting, and `advice(tile)` says why a standing building is idle.

## Resources

**Hay** is the wage and the food. The town holds `GRANARY` = 300 plus `SILO_CAP` = 250 for every linked silo; anything earned above that spills and is lost, which is what stops a wall of farms from being a strategy. Every `DRY_EVERY` = 3rd day is dry, and farms not beside the river grow half as much that day.

**Stone** comes only from quarries, 2 a tick, and is spent on the bigger buildings. A workshop burns `WORKSHOP_STONE` = 1 stone a tick while it mills, and only mills at all when a linked quarry sits within `WORKSHOP_RANGE` = 4 tiles and there is stone in store.

## Terrain

`makeTerrain(valley)` builds the map from the valley seed with a Mulberry32 generator, so a valley always looks the same. The 5×5 square around the centre plaza is always grass. A `split` river runs bank to bank and cuts the valley in two until it is bridged; otherwise it wanders. A share of the grass beside water becomes terrace. Rock comes in diamond-shaped clusters. Valleys with `ruins` scatter derelict buildings (`RUIN_KINDS`) that do nothing until rebuilt at half price.

| Terrain | Roads | Buildings | Note |
| --- | --- | --- | --- |
| grass | 4 hay | all but quarry | |
| terrace | 4 hay | all but quarry | farms earn 4 instead of 3 |
| rock | no | quarry, watchtower | |
| river | 12 hay (bridge) | none | farms beside it earn +1 and ignore dry days |

## Connectivity

`recompute()` floods the road network from every plaza. A road is linked if the flood reaches it; a building is linked if it is a plaza, or is four-neighbour adjacent to a linked road or a plaza. Unlinked producers yield nothing and unlinked homes lose residents. The scene flies a red marker over anything unlinked. Extra plazas root their own networks, and the last plaza cannot be demolished.

## Buildings

| Building | Hay | Stone | Unlock | Effect |
| --- | --- | --- | --- | --- |
| Burrow | 20 | 0 | start | houses 4 |
| Hay farm | 25 | 0 | start | 3 hay/tick; 4 on terrace; +1 beside river |
| Dust bath | 30 | 0 | start | comfort 1.5 over 3 tiles |
| Quarry | 40 | 0 | start, rock only | 2 stone/tick; −1.5 over 2 tiles |
| Silo | 45 | 0 | start | +250 granary |
| Garden | 25 | 0 | Dora 25 | comfort 1.5 over 2 tiles |
| Big burrow | 60 | 20 | Dora 50 | houses 10 |
| Plaza | 80 | 25 | Dora 75 | comfort 1.6 over 4 tiles; roots roads |
| Market | 50 | 0 | Enzo 25 | 1 hay/tick per 3 residents within 4, max 8 |
| Workshop | 45 | 10 | Enzo 50 | 4 hay/tick when fed with stone, else 1; −1.4 over 2 tiles |
| Watchtower | 35 | 15 | Enzo 75, rock allowed | comfort 1.4 over 5 tiles; lamp |

Distances are Manhattan. Demolition refunds half the hay and half the stone; a ruin refunds nothing.

## Comfort and residents

`desireAt(x, y)` sums the strongest contribution from each amenity kind in range and subtracts the same for each nuisance kind. A building at distance `d` with radius `r` contributes `strength × (1 − FALLOFF × d / (r + 1))` with `FALLOFF` = 0.6, so the same dust bath is worth much more next door than at its edge. A home's `comfort` is that total rounded and clamped to 0..4, and `OCCUPANCY` = [0.4, 0.6, 0.8, 1, 1] scales its beds by it. Residents move in one per tick and leave two per tick. A home at comfort 4 is delighted and earns `DELIGHT` = 0.15 extra hay per resident per tick. Happiness is the average comfort of occupied homes. New arrivals take a name from `NAMES`.

## Advisors and wishes

Three wishes are open at a time, drawn for whichever advisor has fewer, from a seeded generator. A wish is only drawn when it could actually be granted: `needs` keeps it back until the building it asks for is unlocked, and `viable` keeps it back when the valley cannot supply it (no terraces to farm, no rock to quarry). Without both gates an ungrantable wish would hold its slot forever, and with it the approval the valley is finished on. Targets scale with `level` (valley number; the sandbox counts as 3). Granting a wish pays its reward in both approval and hay, logs a line from the advisor, and emits `unlock:<id>` for anything the new approval just opened. Approval caps at 100 and never decays.

## Undo

`history` holds up to `UNDO_STEPS` = 25 steps. A step records the tile layout before the action and a running tally of what it spent; painting a road or a demolition between `beginStroke()` and `endStroke()` records as one step. `undo()` puts back only the tiles that action changed and refunds only what it spent, so the clock keeps running, residents who arrived elsewhere stay put, and an advisor pleased in the meantime stays pleased.

## Valleys and winning

`VALLEYS` lists seven maps with `{residents, approval}` goals: 20/25, 40/40, 60/50, 70/55, 90/60, 100/65 and 120/75. `goalMet` needs the population and both approvals; the tick that meets it sets `won`, emits `won` and stops the clock. `SANDBOX` (index −1) has infinite goals. The page keeps three save slots and the cleared count in local storage, writing every few seconds, when the tab hides, and on leaving.

## Scene

`BurrowTownScene` rebuilds only the tiles whose key changed (building, occupancy, link state, ruin, road neighbour mask). Terrain is boxes at four heights; buildings are small primitive assemblies; roads join their four neighbours and become plank bridges over water. Day-night blends the sky between day, dusk and night colours, drives the sun arc and the window and lamp emissive strength, and the six nearest lamps get point lights. Dora and Enzo (the shared `createChinchilla` model) and small residents walk the road graph. Picking intersects a ground plane and maps to tile coordinates; the page draws a green or red ghost from `blocked()`.

## Tests

`npm run test:burrow-town` compiles the engine and runs `tests/burrow-town.mjs`, 33 checks over terrain, costs, connectivity, both economies, the granary cap, dry days, workshop carting, comfort, unlocks, wishes, ruins, undo, demolition, pause and speed, winning, the sandbox, named residents and save round-trips.

`npm run bot:burrow-town` runs `tests/burrow-town-bot.mjs`, which plays every valley through the real engine with a policy a player could follow — keep the hay coming in, keep the roads reaching what is wanted next, build what the advisors ask for — and asserts each valley can be finished, printing how long each took. It is the balance test: it is what catches a goal that cannot be met, a wish that can never be granted, and a valley a town can seal itself into. It also checks no one building carries a town, comparing six workshops with no quarry against three with one, and farm spam against the granary cap.
