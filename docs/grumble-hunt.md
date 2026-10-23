# Grumble Hunt

Built 24-10-2026 as game 39, at `/hunt`, from `grumble-hunt-base`.

## A gentle adventure

Choose Dora (white chinchilla, Acorn Hammer) or Enzo (grey chinchilla, Seed Bow). The other friend follows, helps bonk, and tosses a berry for 28 Fluff when the leader has 45 Fluff or less, with a ten-second berry cooldown. The buddy never loses Fluff.

Clover Camp has three places, reachable on foot with F or through the camp buttons: the Forge, hunt board, and Beast Book. The board offers the first three hunts immediately. Calming three **different** beasts opens both Hornclack and Frostmane. Calming Frostmane ends the story with a victory screen. Open hunts remain replayable, including after victory. New game asks for confirmation and resets only this game.

Each hunt uses the same open meadow, with seed-driven trees and rocks. There is no time limit. Bonks lower Grump. At zero, the beast folds its legs and curls up, rests for a moment, and goes to the sanctuary. Beasts are never hurt.

## The five friends

| Beast | Starting Grump | Movement and openings | Material | Pop-off part |
| --- | ---: | --- | --- | --- |
| Bristleback | 420 | Paws the ground, charges a marked lane, becomes dizzy after a tree or rock crash | Bristle tufts | Tusks |
| Puffwart | 440 | Hops, flicks its tongue along a lane, or blows a sleepy cloud; bonk between moves | Marsh beads | Warts |
| Skreel | 400 | Circles in the air, swoops along a lane, then lands for a 4.5-second rest | Sky feathers | Crest |
| Hornclack | 560 | Its front shell blocks bonks; circle to the sides or back. Sweeps its horn and charges | Shell buttons | Horn cap |
| Frostmane | 840 | Pounces in mood 1, adds an icy mane shake in mood 2, and favours quick pounces in mood 3 | Frost fluff | Mane tufts |

Charges and swoops stop at the end of their 12-unit marked lane. The final-hunt unlock banner appears only on the result that earned the third different nap.

Every attack has a **0.9-second** wind-up and an orange ground marker. Frostmane changes mood below two-thirds and one-third Grump; its later rests become shorter. The mane shake pushes the leader away. A sleepy cloud lasts five seconds and slows movement while inside; it never lowers Fluff.

Dizzy builds from two big bonks or big shots; buddy bonks help a little. Hits during dizzy do not build the next dizzy. A crash or dizzy dust also makes a beast dizzy, providing at least three seconds of opportunity. Bonks during dizzy are 1.7 times as large. Hornclack’s front shell is open during dizzy. Dora’s hammer reaches Skreel when it is low; the bow can reach it in the air.

## Paws, tools, and treasures

The leader has 100 Fluff. Ordinary bumps have a 1.4-second recovery window. A roll lasts 0.46 seconds with a dodge window for its first 0.32 seconds; another roll is available after 0.85 seconds. At zero Fluff the leader is tuckered out, returns to camp, and keeps all materials, including drops still in the meadow. Retrying is immediate, with full Fluff and a fresh pouch. There is no other penalty.

Dora’s ordinary hammer bonk is 14 Grump, a charged swing 27. Enzo’s seed shots are 9 or 20. Once the tool cooldown ends, hold K for at least 0.35 seconds and release for the big version. The HUD shows tool recovery and reports a big bonk or shot ready only after 0.35 seconds of actual charge. Tools have three levels; each further level adds 35% to Dora’s bonks and 32% to Enzo’s shots. Buddy bonks are smaller and less frequent. Weapon grips follow the reference look test; `poseArms` is called after each pose so the paws track the handles.

Every third connecting bonk sheds one material. At 32% of a beast’s initial Grump bonked away, its part pops off once and drops three materials. Calming drops five. Walk within 2.6 units to gather a drop; calming or getting tuckered out collects every drop still in the meadow. The Forge upgrades each tool from level 1 to 2 for six materials, then to level 3 for twelve. Any beast material can pay, and buddy tools benefit too. The Beast Book shows each reference picture, sanctuary status, pop-off part, tips, and current material count.

Each hunt refills three berries (35 Fluff each), two dizzy dust pouches (six-unit range, 3.5 seconds dizzy), and two pep seeds (35% faster for ten seconds). An item is not spent when it cannot help: a berry at full Fluff or dust beyond range stays in the pouch.

## Controls and accessibility

| Input | Action |
| --- | --- |
| WASD / arrows | Move relative to the camera |
| Shift | Sprint |
| J | Bonk / shoot |
| Hold K, release | Charge a big bonk / shot |
| Space | Roll |
| Tab, with the meadow focused | Toggle lock on |
| Q / E | Previous / next pouch item |
| F | Use item; visit a nearby camp place |
| Drag / scroll | Orbit / zoom camera |
| P / Escape | Pause; Escape also closes a panel |
| M | Toggle sound |

Touch has a joystick and Sprint, Roll, Lock, Bonk/Shoot and Hold · big buttons. The pouch is tappable. Short action taps are buffered until an engine step processes input, including through hit-stop. A cancelled charge is cleared without releasing a shot. Blur, page hiding, pointer cancellation, and lost pointer capture release held controls. Hiding or leaving pauses a hunt and saves gathered progress. UI buttons retain ordinary Tab navigation; Tab locks when the meadow or body has focus, including Shift+Tab while sprinting. Pouch and sound buttons return focus to the meadow during hunts. Losing WebGL context pauses only an active hunt; restoring it clears the pause.

The field guide is always available, panels trap focus, buttons have visible focus rings, and reduced motion removes shake, trails, wind and extra dust. Sound begins only after a gesture, has its own persisted mute choice, and uses short quiet synthesised cues. Main arcade navigation remains available.

## Saving and architecture

- `lib/grumble-hunt-game.ts`: seeded deterministic rules, no DOM or Three.js. Fixed steps are 1/60 second; the page bounds catch-up after a slow frame.
- `lib/grumble-hunt-scene.ts`: Three.js drawing, camera, posed tools, chunky beasts, texture loading, effects, and disposal.
- `lib/hunt-chinchilla.ts`: the dedicated existing hunt model, used unchanged. Shared chinchilla modules are unchanged.
- `app/hunt/page.tsx`: input, hydration, loop, HUD, panels and storage.
- `app/hunt/sound.ts`: gesture-unlocked synthesised cues and audio cleanup.

Permanent progress is saved under `grumble-hunt-v1`: selected hero, both tool levels, materials, individual nap counts, and hunt count. The final bonk is saved before its animation finishes. **Reloading returns to camp**, rather than resuming an encounter. Version and numeric fields are checked when loading. `grumble-hunt-sound-v1` stores mute separately. `window.__hunt()` exposes `{ game, refresh, metrics, input }` for browser tests and inspection. It does not run a bot by itself.

## Drawing and resource budget

The scene uses `MeshToonMaterial`, the 96/178/255 three-step ramp, `OutlineEffect`, and `NoToneMapping`. Ground, sky, foliage, effects and instanced grass disable outlines. The existing paintings are unchanged: repeating grass and dirt ground, bark trunks, rock boulders and Bristleback fur; the equirectangular sky; billboard leaf clusters, transparent grass tufts and 5,000 instanced grass blades. Trunks, leaf cards and solid canopy shapes are each batched into one instanced draw. The ref sheets guide the five 3D models and appear in the Beast Book.

The camera orbits above flat walkable terrain, keeps a minimum height, and shortens its distance when a trunk, rock or village building would clip the view. Desktop resolution is capped at 1.5 device pixels with 1024-pixel PCF shadows; touch devices use a 1.25 cap and 512-pixel basic shadows. Tiny facial features do not cast shadows, and there are no postprocessing passes beyond outlines. Projectiles, drops and extra dust use bounded mesh pools. Weapon trails, squash/stretch, a small camera shake and 0.08–0.11-second hit-stop give bonks weight.

On exit, the page cancels its animation frame, removes keyboard, focus, visibility and context listeners, disconnects its resize observer, and closes audio. The scene disposes geometries, materials, loaded textures, shadows, render lists and renderer/context; late texture callbacks also dispose their result. Phone browser emulation and rendering budgets can be checked automatically; actual mid-range phone hardware still needs a device play-test.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:grumble-hunt
npm run bot:grumble-hunt
# With npm run dev running and Playwright installed locally:
npm run test:e2e:grumble-hunt
npm run test:e2e
```

The engine suite covers determinism, warning time in all phases, armour, air/ground openings, tool timing, charged shots, cancelled inputs, dizzy multipliers, crashes, rolls, items, sleepy clouds, buddy healing, collisions, pop-offs, reward idempotency, unlocks, upgrades, safe camp returns and malformed saves. The bot uses only movement/actions and collected materials, plays twelve seeds as each hero, and must calm all 120 beasts. On the initial 24-10-2026 curve it calmed 120/120, with a median hunt of 20.7 seconds and slowest 35.0 seconds.

The browser suite follows the repo’s Playwright style and writes its village, five hunt, dizzy, nap, phone and victory screenshots to ignored `.checks/hunt/`. The optional separate icons/portraits pass is not part of this implementation.

### Run results · 24-10-2026

- `npm run typecheck`, the complete `npm test` suite, and `npm run build` passed.
- The Grumble Hunt browser suite passed all functional, campaign, saving, desktop, touch, portrait/landscape, attack-animation and cleanup checks. Screenshots were inspected for the village, every beast, dizzy, nap and victory.
- A 390 × 844 touch viewport at DPR 3 (capped internally at 1.25), with 4× CPU throttling, used 279 draw calls, 114,774 triangles, and 13 textures in the sampled frame. Chromium reported **SwiftShader**, a software GPU. It produced nine frames in the two-second sample, with a 216.6 ms median frame interval. This verifies bounded rendering and continued drawing under emulation; it does **not** establish an acceptable frame rate on physical mid-range phones. A hardware phone play-test remains outstanding.
- The broader `npm run test:e2e` command passed Classic Pit and the arcade navigation/count checks, then stopped in the existing `tests/e2e/checkpoint.mjs:54` on a 15-second `NEXT IN LINE` click timeout. That game and its test are unchanged by this work; subsequent suites in that chained command did not run. The new hunt suite was run separately.
- Playwright was installed only for local browser checks. No Playwright dependency or lockfile change is included.

### Review fixes · 24-10-2026

- Added regressions for HUD focus, sprint lock-on, hit-stop taps, cooldown charge display, graphics context recovery, dizzy chains, lane endpoints, airborne buddy hammer hits, distant camp drops and one-time unlock results.
- `npm run typecheck` and all 23 `npm run test:grumble-hunt` checks passed. The bot still calmed 120/120 beasts across 24 full campaigns; the revised median was 23.1 seconds and slowest 35.8 seconds.
- Browser regressions were added and syntax-checked, but this sandbox could not launch Chromium (`Operation not permitted`). The dev server also could not write its Vite config cache through the read-only linked `node_modules`. The browser suite needs a run outside this sandbox.
