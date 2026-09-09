# Dora & Enzo's Arcade · Pawprint Grand Prix

An arcade 3D kart racer starring Dora and Enzo in a shared kart. Race Copper Fox, Night Owl, Sly Snake and Mountain Cougar over three laps of Dust Valley Circuit.

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

Items cycle through Hay Turbo (three-second speed boost), Frost Pellet (slows the closest rival ahead), and Dust Bath (slows rivals within 35 track units behind). A targeted item is retained when no suitable rival exists. The minimap and running order track all five racers. Finish three laps for your placement and time; Race again starts a fresh race.

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
