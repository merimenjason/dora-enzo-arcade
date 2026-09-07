# Enzo and Dora Escapes from ICE

A tense, nonviolent isometric 3D stealth escape. Enzo (grey) and Dora (white) move as one pair. Solve puzzles in a cage inspired by their actual photographs, then sneak through a guarded room to freedom.

## Run

Requires Node.js 22.13+ and a browser supporting WebGL 2.

```sh
npm ci
npm run dev
```

## Controls

- WASD / arrows: move the pair relative to the isometric view.
- E: interact with the nearby objective, marked by a gold ring.
- Shift: sneak. Under a blue-tinted table, sneaking hides the pair.
- Space: hop.
- Q: throw a dust decoy four steps in the direction you last moved. Three uses per room attempt. Nearby guards turn toward it for 3.5 seconds.
- P / Escape: pause/resume. Switching away also pauses.
- On-screen controls support movement, sneaking, interaction, hops and decoys.

## Escape route

Search the blue tunnel for a chew stick, use it to open the pink hideout and retrieve a toy key, then unlock the wire door. In the room, collect the exit card from the desk and reach the green door together. The cage includes wooden shelves, silver wire mesh, feeding trays, a blue tunnel, a pink hideout and a water bottle based on the supplied photos.

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

`lib/escape-game.ts` implements puzzles, collision, sight, hiding, decoys and checkpoints. `lib/escape-scene.ts` renders the cage and room with Three.js. `tests/escape.mjs` covers puzzle ordering/range, an entire playable escape route, collisions, view direction, sight occlusion, hiding, capture/retry, decoys, pause and hops. Earlier modes retain their tests. No browser rendering tests are included.

The project uses Vinext and a Cloudflare Worker. GitHub source upload does not automatically deploy to GitHub Pages.
