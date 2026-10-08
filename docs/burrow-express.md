# Burrow Express

Game 26, at `/express`. Draw a coloured tunnel network and carry chinchillas between burrows, hay markets, dust baths and mountain retreats. Passengers use the shortest connected route, changing carts at shared stations. Built on 08-10-2026.

## Modes and maps

- **Tutorial:** four stations and five passengers in gentle Clover Meadow. Connect two stations to start a cart, connect all four destination types, deliver the five passengers, then choose an upgrade. The clock waits until all four stations can reach each other. Rocky ground does not cost drills in the lesson.
- **Eight-day shift:** eight 45-second days, six minutes at 1× excluding pauses and upgrade choices. Stay open to sunset and meet the map's target. Delivering the target early does not end the shift: the whole network must survive all eight days.
- **Endless:** the same growing warren, continuing beyond day eight until a station stays overcrowded too long. Records keep the furthest day and highest delivery total for each map.

| Map | Target in a shift | Ground |
| --- | --- | --- |
| Clover Meadow | 100 | Short journeys, one rocky outcrop |
| Mossy Gorge | 115 | Longer crossings, two outcrops |
| Starlit Summit | 130 | A wide warren, three outcrops |

All three maps are available from the start. Each begins with four stations, one of every type. Another station opens each morning from day two to day seven, for ten in total.

## Passengers and lines

Destinations are both shapes and colours: **circle** for a home, **square** for hay, **diamond** for a dust bath, **triangle** for a retreat. The shapes under a building are its waiting passengers' destinations.

A line is an ordered list of distinct stations. Carts shuttle back and forth, or go around a loop when the ends are joined. Different lines can share stations, but the same station cannot appear twice on one line. The first cart is assigned automatically when a line gets its second station and a spare cart is available.

Passengers find the shortest distance through the usable tunnel network. They board a cart only when its next stop is their next hop. They stay aboard while the cart follows that path, get off to transfer when it does not, and arrive at any station of their destination type. Lines with no assigned cart and tunnels closed by a cave-in are excluded from routing.

**Reroute** pauses the clock. Remove stops from the selected line's end, then add different ones and carry on. Editing a line or freeing a cart returns its passengers to the nearest end of their current tunnel, preserving their identities and waiting ages; passengers who reach their destination there count as delivered. A line reduced below two stations frees its carts. Dug tunnels stay available even if the route is removed.

## Resources, crowding and growth

- Start with three lines, three carts, four seats per cart, two rock drills and 62 hay. Carts travel at 72 map units per second and wait 0.6 seconds at a station. The meadow is 960 × 600 units.
- Departing a station costs one hay. Hay-market deliveries earn three hay, other deliveries half a hay; a slow background supply adds 0.15 hay a second. Stores hold 120. A cart waits at its platform if there is not enough fuel, but still delivers passengers on arrival.
- A platform can hold eight waiting passengers. **More than eight** starts its crowding clock; 18 continuous seconds of crowding ends the route. Once the queue falls back to eight or fewer, the clock recovers twice as fast. The amber ring on the station shows the danger.
- Passenger demand starts at 0.32 per second in Clover Meadow, with 0.025 added per map and 0.075 per new day, capped at 1.65 per second. A seeded generator chooses an open station and a destination other than its own type.
- A tunnel crossing rocky ground costs one drill, even if it crosses more than one outcrop. Once bored, it is free to reuse in either direction and on any line.
- Days four, seven, ten and every third day after that may bring a cave-in on an operating tunnel. It clears after 20 game seconds, or one drill clears it immediately. Carts already in the tunnel complete their journey; those about to enter wait. Pause, clear it or reroute around it.

Each new morning pauses the game for an upgrade, with up to three choices:

| Upgrade | Effect |
| --- | --- |
| Extra cart | One more cart, offered while the fleet is below nine |
| Bigger carts | One extra seat in every cart, offered until eight seats |
| Rock drill | Two more drills |
| New line | One new coloured line and one extra cart, offered on even-numbered days until five lines |
| Quick wheels | All carts travel 15% faster, capped at 240 units per second |
| Hay hamper | 40 hay, capped at the 120-hay store limit; appears when other upgrades have reached their limits |

After taking an upgrade, spare carts still need to be assigned with **Add cart**. A new line can automatically take a spare when its second station is connected. More carts use more hay, so efficient short routes matter too.

## Controls

- **Mouse/touch:** drag from a line's last station to another building, or tap stations in order. Start an empty line by dragging between two stations. The station buttons below the map offer the same actions and larger phone targets. A cancelled or interrupted gesture makes no connection.
- **1–5:** pick a line. **Arrow keys:** pick a station in that direction. **Enter:** connect the chosen station while the map has focus.
- **Z:** remove the last stop. **A:** add a cart. **L:** join/open a loop. **Free a cart** returns the last cart on that line to the spare fleet.
- **P / Escape:** pause or carry on. Routes remain editable while paused. **F:** cycle 1×, 2× and 3×. **M:** toggle sound. Losing window focus or hiding the tab pauses the game.
- **Save & menu:** pause, keep the current route and return home. **Continue your route** restores it paused. A new route replaces the previous one.

## Art, sound and saving

The terrain is painted once into a cached canvas, with live buildings, queues, tunnel lines, moving carts and cave-in markers. `lib/chinchilla-art.ts` draws Dora and Enzo, including Dora's established dark ruby iris (`#8e1f33`) and deep wine pupil (`#3b0913`). The portrait uses the shared measured fitting helpers so the tails remain inside their boxes. Destination symbols stay distinct without relying on colour alone.

`app/express/sound.ts` uses the shared `makeSound` synth for tunnels, deliveries, new stations, warnings, upgrades and results. Mute is kept under `burrow-express-sound-v1`.

`burrow-express-v1` stores tutorial completion and map records. `burrow-express-run-v1` stores the engine's full state: clocks, seeded random stream, queues, passenger identities, cart positions and loads, lines, tunnels and resources. It is written after edits and events and at least every three wall-clock seconds. Results are banked immediately and finished routes are removed. Malformed or incompatible saves are ignored. Saving unavailable in a private window does not stop play.

## Code and checks

- `lib/burrow-express-game.ts`: deterministic rules, routing, resource limits, edits, seeded demand, saves and validation.
- `lib/burrow-express-scene.ts`: cached terrain, destination symbols, buildings, carts and the shared chinchillas.
- `app/express/`: page, styles, metadata and sound. `window.__express()` exposes `{ game, stage, fast, advance }` to single-player browser checks.
- `npm run test:express` (also in `npm test`): construction, limits, transfers, unserved lines, seats, fuel, safe edits, tutorial completion, crowding and recovery, pause, upgrades, stations opening, cave-ins, save/replay, malformed saves, passenger conservation and nine real seeded shifts. At least six of nine must be won by the planner, and Endless must continue beyond day eight.
- `npm run bot:express`: twelve seeded shifts across the three maps, through the player's own build and upgrade rules. At least nine must be won. Rerun after any balance change.
- `tests/e2e/burrow-express.mjs` (in `npm run test:e2e`): tutorial, actual drawing/cancellation, keyboard, carts and loops, route edits, saving mid-journey, focus loss, clearing a cave-in, a whole eight-day shift through the controls, records, losing, broken saves, native touch drawing and four portrait/landscape phone sizes.

On 08-10-2026 the planner won 9 of 12 shifts (3 of 4 on each map); the smaller engine gate won 6 of 9. Balance is checked with this planner and browser playthroughs. Human difficulty, real-phone gesture feel and a listening pass remain useful follow-ups.
