# Grumble Hunt reference

Reference material for building Grumble Hunt (game 39, route `/hunt`).

## Dora and Enzo

`lib/hunt-chinchilla.ts` is the Storybook (toon) Dora and Enzo, made for Grumble Hunt only. Use it in the hunt scene. Don't change the shared `lib/chinchilla.ts`: 15 other scenes use it.

- `createHuntChinchilla(white)` builds Dora (`true`) or Enzo (`false`). The model faces +x and is about 1.6 units tall, so scale it to the scene.
- `animateHuntChinchilla(model, time, speed, onGround)` runs the hop, squash, ear and tail sway, and blinks.
- `poseArms(model, leftGrip, rightGrip, [leftWeight, rightWeight])` aims the front arms at grip points given in body space. Call it every frame after posing the weapon, so the paws stay on the handle. Pass `null` for a paw at rest. A weight from 0 to 1 blends a paw between rest and its grip.
- The materials are `MeshToonMaterial` with a 3-step ramp (96/178/255). The scene renders them through `OutlineEffect` (thickness 0.0042, dark brown). The tail sets its own softer, thinner outline.

## Look test

`look-test/` is the throwaway prototype that proved the style: one meadow, the Bristleback, Dora with the Acorn Hammer, and Enzo with the Seed Bow. `main.ts.txt` is TypeScript renamed so the repo's `tsc` skips it. The useful parts are:

- the scene setup (lights, gradient sky, instanced grass with wind, terrain);
- the Bristleback model;
- the weapon grip (`poseGrips`);
- the game feel (hit-stop, shake, dust, trail).

Build it from the repo root with `bash docs/grumble-hunt/look-test/build.sh`. Pass a JSON list of `[name, query]` pairs to also take screenshots. `?portrait=<offset>` puts the camera in front of Dora. `?pose=<seconds>` freezes her swing: 0.12 is the wind-up, 0.22 the slam and 0.35 the follow-through.

`screenshots/` holds the current renders: idle from the front and side, the hunt camera, and the three swing phases.

## Weapons

Choose the first weapon shown with `?weapon=<id>`. The bottom-centre panel shows its
name, Monster Hunter equivalent (where applicable), signature move and first-pick
badge from `lib/grumble-hunt-content.ts`. Use ‹ / › or `[` / `]` to cycle in place.
J swings the Acorn Hammer; the other weapons bob on their held grips.

| `?weapon=` id | Name |
| --- | --- |
| `greatsword` | Driftwood Greatsword |
| `katana` | Bamboo Katana |
| `sword` | Twig Sword and Acorn Shield |
| `claws` | Twin Claws |
| `hammer` | Acorn Hammer |
| `horn` | Gourd Horn |
| `lance` | Thistle Lance |
| `gunlance` | Puffcap Lance |
| `switchaxe` | Switch Spade |
| `chargeblade` | Seedpod Blade |
| `glaive` | Firefly Staff |
| `lightbow` | Acorn Slingshot |
| `heavybow` | Pumpkin Popper |
| `bow` | Seed Bow |
| `wand` | Bubble Wand |
| `yoyo` | Pinecone Yo-yo |

To capture all 32 reference shots from the repo root:

```sh
mkdir -p docs/grumble-hunt/screenshots/weapons
SHOTS="$PWD/docs/grumble-hunt/screenshots/weapons" bash docs/grumble-hunt/look-test/build.sh "$(cat docs/grumble-hunt/look-test/weapons-shots.json)"
```

The screenshots are written as PNG; the committed set in `screenshots/weapons/` (`<id>-front.webp` and `<id>-side.webp`) was converted to WebP to keep it small. They were checked by eye on 24-10-2026: every weapon sits in Dora's paws and none covers her face, from the front or the side.
