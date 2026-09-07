# Enzo and Dora Escapes from ICE

A tense, nonviolent perspective 3D stealth escape with an orbiting camera and vertical platform exploration. Enzo (grey) and Dora (white) move as one pair. Solve puzzles in a cage inspired by their actual photographs, then sneak through a guarded room to freedom.

## Run

Requires Node.js 22.13+ and a browser supporting WebGL 2.

```sh
npm ci
npm run dev
```

## Controls

- WASD / arrows: move the pair relative to the current camera view.
- E: interact with the nearby objective, marked by a gold ring.
- Shift: sneak. Under a blue-tinted table, sneaking hides the pair.
- Space: jump onto shelves. Descending onto a shelf lands the pair; walking off an edge drops them to the next surface. Jumping again requires a supported landing.
- Z / X, right-drag, or camera buttons: orbit. Right-drag vertically adjusts camera elevation.
- Scroll or + / − camera buttons: zoom. C / Reset view restores the camera.
- Q: throw a dust decoy four steps in the direction you last moved. Three uses per room attempt. Nearby guards turn toward it for 3.5 seconds.
- P / Escape: pause/resume. Switching away also pauses.
- On-screen controls support movement, sneaking, interaction, hops and decoys.

## Escape route

Jump to the lower shelf to search the blue tunnel for a chew stick. Climb the staggered shelves to retrieve a latch clip on the upper ledge. Cross to the right-hand feeder shelf and retrieve the toy key, then descend to the wire door. Each interaction requires landing near the objective at its height. In the room, collect the exit card from the desk and reach the green door together. The cage includes wooden shelves, silver wire mesh, feeding trays, a blue tunnel, a pink hay feeder a water bottle, a log shelter, a litter tray, a fan grille, an adjacent cabinet and translucent side panel based on the supplied photos. Metal-edged shelves use the same geometry dimensions as their landing surfaces. Near-side cage walls fade according to the camera angle. Wood grain, perspective, soft shadows and ground shadows provide depth.

Two ICE agents patrol the room. Their vision cones increase the alert meter while they see the pair. Cabinets block sight; covered tables conceal sneaking chinchillas except at very close range. Alert decreases out of sight. A full alert meter causes capture. Retry restarts at the opened cage, resets the patrols, exit card and decoys, and retains the completed cage puzzles. Nothing is saved between reloads.

## Earlier games

- `/soccer`: Fluffball Cup. See `docs/fluffball-cup.md`.
- `/kart`: Pawprint Grand Prix.
- `/hop`: Border Hop.
- `/survival`: Night Survivors.
- `/adventure`: original RPG.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

`lib/escape-game.ts` implements puzzles, collision, sight, hiding, decoys and checkpoints. `lib/escape-scene.ts` renders the cage and room with Three.js. `tests/escape.mjs` covers puzzle ordering/range, an entire playable escape route including platform jumps and landings, collisions, view direction, sight occlusion, hiding, capture/retry, decoys, pause and hops. Earlier modes retain their tests. No browser rendering tests are included.

The project uses Vinext and a Cloudflare Worker. GitHub source upload does not automatically deploy to GitHub Pages.
