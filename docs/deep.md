# Deepglow

A sonar dive into an uncharted trench at `/deep`. Dora pilots the Thimble, a little yellow research sub, down from Enzo's boat. Enzo reads the sonar on deck and talks to her over the radio. The cave is dark below the shallows: a sonar ping shows the walls as dots of light, the headlamp lights a cone in front of the sub, and everything else is black except the creatures that glow. Scoop up specimens for Enzo's journal, bring them up to bank them for research, spend the research on the sub, and dive deep enough to find the Lantern Whale that sings at the bottom.

Rules: `lib/deep-game.ts`. Drawing: `lib/deep-scene.ts` (Canvas 2D). Page, input, HUD and save: `app/deep/page.tsx`. Sound: `app/deep/sound.ts`.

## The cave

One hand-shaped world, the same for everyone (`WORLD_SEED` 1207): a grid of 150 × 545 cells of 2 m, so 300 m wide and 1,090 m deep. `makeWorld` carves a spine of chambers down the middle, tunnels between them, side caves (some looping back), and the whale's hall at the bottom, then roughens the walls with noise and builds a signed distance field (`sdf`, negative in rock) for collisions, sonar and drawing. `reach` marks every cell the sub fits through from the surface; anything placed in the world has to be reachable. A world that fails a check (a placement with no room, say) is rebuilt with the next seed, up to 40 times.

Four zones, each with its own species:

| Zone | Depth | Species |
| --- | --- | --- |
| The Twilight | 0–200 m | Glass Moth Jelly, Ribbon Eel (shy), Pepper Krill |
| The Midnight | 200–560 m | Lanterncrown Squid, Velvet Hatchetfish (shy), Ghostfin Ray |
| The Abyss | 560–960 m | Teacup Octopus, Starseed Cucumber, Lampshade Siphonophore |
| The Trench | 960 m and down | Pearl Isopod, Ember Vent Snail, Lanternjaw (shy) |

Swimmers drift, swim, swarm or dart; crawlers sit on the floor (vent snails next to the hot vents). Air bells, pockets of air trapped under the rock, sit at the top of spine chambers at least every 130 m. Hot vents below 760 m push the sub upwards.

## The sub

Arrows or WASD (or the touch stick) thrust at 7 m/s² times the propeller's level, against a drag of 1.35; the sub sinks very slowly (0.12 m/s²) when left alone. Hitting rock faster than 3.4 m/s dents the hull by 7 per m/s over that. Air drains one second a second and refills at the surface (at once) or in an air bell (45 seconds of air a second). Below the hull's **rating** it creaks and loses `1.6 + (depth − rating) / 30` hull a second.

- **Sonar** (Space, J or PING): 200 rays out to the sonar's range; each ray's echo appears where it hits rock when the ring (70 m/s) gets there, and fades over seven seconds. It also marks every cell it crosses on the chart and shows nearby creatures as rings for a few seconds. Then it has to recharge.
- **Lamp** (L, K or LAMP): a cone in front of the sub, cast against the rock so it never shines through a wall. It marks what it lights on the chart too. Shy creatures dart away from the lamp (or from a sub barging in fast): switch it off and creep up.
- **Catching:** come within 2.4 m of a specimen slower than 3.4 m/s and it is scooped into the tray. A full tray says so.
- Enzo's radio warns about low air (a quarter left), a low hull, the first creak, each new zone, every 200 m of depth and hazards. Under 30% air, the screen shows a dotted line to the nearest air (`wayToAir`).

## Hazards

- **Purple veils** (22, all in open chambers) sting for 9 hull and push you away.
- **Grimlures** (7, in big chambers) hunt a ping heard within 1.5 times the sonar's range, a lamp seen within 24 m, or a sub closer than 4.5 m. They swim at 4.4 m/s; a bite takes 25 hull, and then the Grimlure swims home and leaves you be for 25 s. Lamp off and no pings, and it loses interest.

## Ending a dive

- **Surface** (back to the top): everything in the tray is banked.
- **Out of air** or **out of hull**: Enzo winches you up. The chart is kept but the tray floats away. Pause also offers "Winch me up".
- **The whale:** reach the Lantern Whale's hall at the bottom of the trench and the ending plays. The dive counts as banked.

## Research and upgrades

Banking pays 30 research for each species new to the journal, 10 for each repeat, and 1 for every 120 newly charted cells (480 m²) of the reachable cave, even on a rescue.

| Upgrade | Levels | Costs |
| --- | --- | --- |
| Pressure hull | rated to 250 / 520 / 820 / 1,100 m, hull 100 / 120 / 150 / 180 | 40, 90, 140 |
| Air tank | 3 min / 4 min 20 / 6 min / 8 min | 30, 70, 130 |
| Propeller | thrust ×1 / 1.15 / 1.3 / 1.45 | 30, 70, 120 |
| Sonar | 40 / 55 / 70 / 90 m, recharge 2.6 / 2.2 / 1.8 / 1.4 s | 25, 60, 110 |
| Headlamp | 9 / 11 / 13 / 15 m | 20, 50, 90 |
| Sample tray | 3 / 5 / 7 / 10 | 25, 55, 100 |

The whale's hall is centred about 1,040 m down, so the last hull level is needed to reach it.

## Bots

`npm run bot:deep` plays two whole campaigns with a diver that plans like a player with a map: the nearest specimen it still wants within its rating, lamp off near shy ones, a ping every few seconds, air when the tank says so, home when the tray is full, the whale when the hull allows; it goes dark and backs off from a hunting Grimlure and steers round veils. One campaign spends on the hull first, the other on comfort (air, tray, propeller) first. Both must reach the whale on dive 6 to 24, play 25 to 150 minutes and never stall.

Current results: hull first reaches the whale on dive 11 and fills the journal on dive 12 (43 minutes); comfort first, dives 13 and 14 (51 minutes).

## Tests

- `npm run test:deep`: the world (reachable, every species placed, bells, vents, the whale), the sub (thrust, drag, knocks, air, bells, pressure), sonar and lamp (echoes on walls, the chart, lamp blocked by rock), catching and hazards (gentle and fast approaches, shy darters, veils, Grimlures), banking, upgrades, the packed chart and saves including corrupt ones.
- `npm run bot:deep`: the campaigns above.
- `node tests/e2e/deep.mjs` (dev server running): the title, the briefing, steering, ping, lamp, chart, pause, a catch banked, the journal and an upgrade across a reload, an out-of-air rescue, a corrupt save, and phones held either way with the touch controls. It uses `window.__deep().debug` to jump to a specimen, the surface or out of air.

## Save

`localStorage` key `deepglow-v1`: research points, upgrade levels, the journal (count per species), the chart (run-length packed, base 36), whether the whale was found, whether the briefing was heard, settings (sound, music) and stats (dives, rescues, deepest, specimens banked). `parseSave` clamps every field and falls back to a new save for anything corrupt.
