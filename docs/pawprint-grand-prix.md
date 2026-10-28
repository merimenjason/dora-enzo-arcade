# Dora & Enzo's Arcade · Pawprint Grand Prix

An arcade 3D kart racer starring Dora and Enzo in a shared kart. Race Copper Fox, Night Owl, Sly Snake and Mountain Cougar for the Pawprint Cup, three laps on each of three circuits.

## Run locally

Requires Node.js 22.13+ and WebGL 2.

```sh
npm ci
npm run dev
```

## Controls

- W / Up: accelerate. S / Down: brake.
- A D / Left Right: steer across the road. The kart automatically follows the circuit bends.
- Hold Shift while steering at speed to charge a drift. After 0.65 seconds, release Shift for a boost.
- Space: use the item in your pocket.
- P / Escape: pause or resume. Switching away pauses the countdown or race.
- On-screen hold buttons also control acceleration, braking, steering and drifting.

Mint crystals near the road center award items. Gold strips on the outside racing line give speed boosts. Driving off the asphalt slows the kart; bumps with rivals also reduce speed.

Items cycle through Hay Turbo (three-second speed boost), Frost Pellet (slows the closest rival ahead), and Dust Bath (slows rivals within 35 track units behind). A targeted item is retained when no suitable rival exists. The minimap and running order track all five racers. Finish three laps for your placement and time.

## The Pawprint Cup

A cup is three races in a row, scored 10, 7, 5, 3 and 1 points for 1st to 5th. Dora & Enzo win a tie on points. Finish in the top three of the final standings for a Gold, Silver or Bronze trophy.

| Circuit | Shape | Hazard |
| --- | --- | --- |
| Dust Valley Circuit | Wide oval; gold strips on the outside line | None |
| Moonpebble Canyon | Three sweeping bends; strips alternate sides | Mud patches cap speed at 50 km/h |
| Frostwhisker Pass | Snowy hourglass; four strips | Ice puddles cut steering and braking to about a third |

The class sets the rivals' pace: Pebble Cup ×1.08, Boulder Cup ×1.27, Summit Cup ×1.36 (Frostwhisker Pass adds ×1.02). Holding gas alone wins Pebble races; Summit needs the strips, drifts and clean lines. `tests/kart.mjs` checks both with two scripted drivers.

Best race time per circuit and the best trophy per class are saved in `localStorage` under `pawprint-grand-prix-v1`.

## Retained games

- `/hop`: Border Hop, with saved best score and Perfect Pair bonuses. See `docs/border-hop.md`.
- `/survival`: chinchilla survival arena. See `docs/night-survivors.md`.
- `/adventure`: original RPG.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Kart tests cover countdown and pause, acceleration, braking, drift boosts, off-road speed, items, pickups, lap progression, track closure and a complete race. Retained modes also run their simulation tests. No browser rendering tests are included.

## Source

- `app/page.tsx`: race UI and keyboard/touch controls.
- `lib/kart-game.ts`: race simulation, rivals, boosts, items and placement.
- `lib/kart-scene.ts`: Three.js circuit, shared kart, chinchillas and predator racers.

The project uses Vinext and a Cloudflare Worker. `npm run build` creates `dist/`; uploading source to GitHub does not automatically deploy it to GitHub Pages.
