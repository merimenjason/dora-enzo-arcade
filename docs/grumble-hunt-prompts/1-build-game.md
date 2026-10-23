Repo: dora-enzo-arcade.

Build Grumble Hunt, game 39 at `/hunt`: a kid-friendly 3D Three.js Monster Hunter-style adventure starring Dora, a white chinchilla, and Enzo, a grey chinchilla.

Setup:
- Read AGENTS.md, CLAUDE.md and README.md (especially the **Adding a game** checklist), and look at two existing 3D games for conventions: the Hay Maze (`app/hay-maze/`, `lib/hay-maze-*`) and the Acorn Hand page for `main[data-ready="true"]`.
- Fetch and branch from `origin/grumble-hunt-base`, not `main`. Create `codex/grumble-hunt`. The base already holds the art (`public/art/hunt/`, listed in `docs/grumble-hunt-art.md`) and the Dora and Enzo model, so no cherry-pick is needed.
- Read `docs/grumble-hunt/README.md` and look at `docs/grumble-hunt/screenshots/`. Never push to `main`: pushing to `main` deploys.

Dora and Enzo:
- Use `lib/hunt-chinchilla.ts` (`createHuntChinchilla`, `animateHuntChinchilla`, `poseArms`) for both of them. Don't use or change the shared `lib/chinchilla.ts` or `lib/chinchilla-art.ts`.
- The player picks Dora or Enzo at the start. The other one comes along as an AI buddy who follows, helps bonk and tosses a healing berry when the player's Fluff is low.
- Dora fights with the Acorn Hammer: slow, big bonks that build dizzy. Its grip, rest and swing are in `docs/grumble-hunt/look-test/main.ts.txt` (`hamPivot`, `poseGrips`, `stepDora`). Keep the paws on the handle with `poseArms` in every pose.
- Enzo fights with the Seed Bow: ranged shots that charge while held. He grips it as in the look test.

Gameplay:
- A small village hub with three spots: a Forge that upgrades the hammer and the bow, three levels each, paid for with beast materials; a Beast Book with each beast's picture, its napping status and its materials; and a hunt board for picking a hunt.
- Each hunt is one open meadow arena with trees and rocks.
- Beasts are never hurt. Each has a visible "Grump" meter. Bonks lower it; at zero the beast curls up for a nap and goes home to a sanctuary.
  - Beasts get dizzy from heavy hits or from crashing into things, and dizzy beasts take bigger bonks.
  - They shed materials when bonked, when a breakable part pops off (tusks, warts and so on) and when calmed.
- Use the words bonk, dizzy, calm and nap. Never use injury words; there is no blood, death, scary imagery or harsh punishment.
- Five beasts, each with distinct movement, attacks signalled at least 0.6 s ahead (a wind-up pose plus an orange ground marker), a dizzy state and a readable nap animation:
  - Bristleback (boar): paws the ground, then charges along an orange lane; it gets dizzy if it hits a tree or rock. Breakable tusks.
  - Puffwart (toad): hops, does a tongue flick, and puffs a sleepy cloud that slows you if you stand in it.
  - Skreel (owl): circles, then swoops along a marked line; it lands to rest, which is your window.
  - Hornclack (rhino-beetle): its shell blocks bonks from the front, so go for the sides and back; it does a horn sweep.
  - Frostmane (snow lynx): the final hunt, with pounces, an icy mane shake that pushes you away, and three phases.
  - The first three hunts are open from the start; Hornclack and Frostmane unlock once any three beasts have napped. Calming Frostmane is the victory, and a victory screen follows. After that every hunt can be replayed, and a "New game" option resets the save.
- The hero's health is "Fluff". At zero Fluff the hero gets "tuckered out": they return to camp, keep the materials they gathered, and the hunt can be retried at once. There's no other penalty.
- Controls:
  - WASD to move, Shift to sprint.
  - J to bonk or shoot; hold K for a charged big swing or charged shot.
  - Space rolls, with a brief dodge window.
  - Tab locks on to the beast.
  - Q/E pick an item, F uses it.
  - Drag to orbit the camera.
  - On-screen touch controls: a joystick plus buttons.
  - Explain the controls on screen and keep inputs forgiving.
- Follow the existing keyboard, touch, audio and accessibility conventions.

Art and rendering (Storybook style, as in the look test):
- Use `MeshToonMaterial` with a 3-step ramp and `OutlineEffect`, with `NoToneMapping`.
- Turn the outlines off on instanced meshes, the ground, the sky and the foliage cards (`material.userData.outlineParameters = { visible: false }`).
- Use the textures in `public/art/hunt/` as repeating maps: grass and dirt on the ground (dirt for the paths), bark on trunks, rock on boulders, boar fur on the Bristleback.
- Use `sky-meadow.webp` as the equirectangular sky background.
- Use `leaf-cluster.webp` as billboard foliage on the trees and `grass-tuft.webp` for scattered tufts, alongside instanced 3D grass.
- The `ref-*.webp` sheets are modelling references: build simple, chunky 3D beasts from their shapes and colours. The look test's Bristleback is a good start.
- Keep the game feel: hit-stop of 0.08–0.12 s, camera shake, squash and stretch, dust puffs, a weapon trail.
- Keep the existing art files unchanged.

Implementation:
- Use the repo's split:
  - `lib/grumble-hunt-game.ts` is the deterministic engine with a seeded random generator and no DOM.
  - `lib/grumble-hunt-scene.ts` is the Three.js drawing.
  - `app/hunt/page.tsx` is the page. It wires input, the loop, saving under `grumble-hunt-v1`, and the HUD. It exposes `window.__hunt()` and sets `main[data-ready="true"]` once it has hydrated.
- Add these:
  - `tests/grumble-hunt.mjs`, the engine tests;
  - a bot (`bot:grumble-hunt`) that plays every hunt and must calm every beast;
  - a browser test in the repo's e2e style.
- Add the engine to both the `tsc` list and the `node` list in the `test` script.
- Integrate it into the arcade menu (`GAMES` in `app/page.tsx`). Follow the README **Adding a game** checklist in full: the game count becomes 39 everywhere, and add the Games table row and the game guide. Write `docs/grumble-hunt.md`, and add a CHANGELOG entry under today's date. Markdown dates are dd-mm-yyyy.
- Check the responsive layout (phone and desktop), camera behaviour (no clipping into trees or terrain), collisions, performance on a mid-range phone, and resource cleanup when leaving the page (dispose geometries, materials, textures and the renderer; remove listeners).
- Run `npm run typecheck`, `npm test` and `npm run build`. Run the browser suite with `npm run dev` going (install Playwright with `npm i -D playwright`, but don't commit that change). Play-test it in the browser and look at screenshots of the village, every hunt, a dizzy beast, a nap and the victory screen.

Finish by committing to `codex/grumble-hunt` and pushing the branch. Don't open a pull request. Report what works, what was tested, and any remaining limitations.
