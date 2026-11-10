# Cloudsteel

A third-person 3D sword duel at `/cloudsteel`: Dora against three rounds of foes on a rain-soaked terrace, with Enzo as a tag-in. This is the first slice of the game: one arena, three rounds, an ending.

## Code layout

- `lib/cloudsteel-game.ts`: the rules. A fixed 60 Hz simulation with no DOM. `new Fight(seed, assist)` then `tick(input)` once per step; `events` holds what happened in that step. All randomness comes from the seed.
- `lib/cloudsteel-scene.ts`: drawing only. Builds the terrace and the figures, poses them from the fight's state, runs the effects and the camera.
- `app/cloudsteel/page.tsx`: input, the loop, the HUD, menus, results, the ending and the save. `sound.ts` synthesises every sound with WebAudio. `cloudsteel.css` styles the menus and HUD.
- `public/art/cloudsteel/`: the painted art.

## Rules and numbers

Angles are yaw with 0 facing +z. The arena is a circle of radius `ARENA_R` (7.6 m).

| Dora | |
|---|---|
| Health | 100 |
| Cuts | three in a chain: 5, 6 and 10 damage; 4, 4 and 9 posture. A cut at a foe that is recovering, deflected or broken does 1.3× posture; at a broken foe 1.5× damage |
| Guard | blocks steel attacks. Each block adds the attack's `press` to Dora's guard bar; at 100 her guard breaks and she is open for 70 ticks |
| Deflect | a steel blow that lands within 14 ticks of the guard press with help on (9 without) is deflected: no damage, the foe is staggered for 46 ticks and gains 40 posture (46 for the bear) |
| Dodge | 22 ticks, 3.2 m, safe from tick 2 to 15 |
| Finisher | a cut at a broken foe within reach: 60 damage (90 to the bear) |
| Enzo's tag | needs a full meter (100): +6 a hit, +22 a deflect, +8 a dodged blow. His lantern does 20 damage and 50 posture to every foe within 4.5 m |

| Foe | Health | Posture | Attacks |
|---|---|---|---|
| Fox (Atoq, the Sword-Kin) | 130 | 100 | slash (16), lunge (20, steps in 2.4 m) |
| Bear (Ukhu) | 620 | 180 | sweep (24, wide), thrust (22, long), **jade slam** (34, all round within 3 m, cannot be guarded) |

- A foe that has taken three cuts since its last attack turns the next one aside (Dora recoils) and attacks at once.
- Cuts never stop a foe that has begun its wind-up, so cutting into one is a trade. Otherwise a fox flinches at every cut and the bear only at the third.
- With several foes, only one winds up or strikes at a time; the others circle.
- Below half health the bear attacks more often.
- Foe posture drains slowly after 2.5 s without being pressed; a broken foe stays open for 190 ticks with help on (150 without).
- A fall restarts the round on full health and counts against the seal.
- Seals: gold for no falls and at most 45 damage taken; silver for at most one fall and 140 damage; bronze otherwise.

## Help

On by default (Settings, or the pause menu for the next fight): wind-ups are 25% longer, foes wait 15% longer between attacks, the deflect window is 14 ticks, damage taken is 75%, health refills between rounds (otherwise +40), Dora's cuts step in from further away, and the HUD prompts "Guard now", "Dodge away", "Finish it" and "Call Enzo".

## Renderer

Three.js 0.185 with `WebGPURenderer` (`three/webgpu`), which falls back to WebGL 2 by itself where WebGPU is missing; Settings shows which one is in use. The scene module is loaded with a dynamic import so the server never evaluates it.

- The floor is a `MeshStandardNodeMaterial` with a planar `reflector()` added to its emissive, rippled with noise.
- Post-processing is a `RenderPipeline`: the scene pass plus `bloom()` on anything brighter than white, and a vignette. Lanterns, sparks and strokes use colours above 1 so they bloom.
- **Effects** in Settings turns the reflection and bloom off and lowers the pixel ratio for slow devices (it reloads the page).
- Figures are jointed groups built in code. Each state has its own pose function (`doraPose`, `enzoPose`, `foePose`): idle, run, three cuts, guard, deflect, dodge, hit, recoil, broken, finisher, tag, fall and win for Dora; per-attack wind-ups and strikes, recover, flinch, deflected, broken and fall for foes. Figures ease between poses.
- Tells: a glint on the weapon grows through a steel wind-up; a jade ring on the ground marks the slam's reach.

## Art

Painted by Codex from `docs/ideas/cloudsteel/game-art-brief.md`: the title and ending pictures, the mountain panorama wrapped round the arena (mirrored so it joins), the terrace floor, stone, roof and the two woven cloths used as textures, four portraits and four HUD icons. Dora wears a saffron jacket with indigo woven bands and a waist sash; Enzo a long slate-blue coat with gold-and-jade bands and carries the lantern staff. The pitch mock-ups are in the same folder.

## Save

`localStorage['cloudsteel-v1']`: `{ v: 1, best: Result | null, wins, fights, seenHow, settings: { assist, sound, music, fx } }`. `parseSave` falls back to a new save on anything it cannot read.

## Tests

- `npm run test:cloudsteel`: 18 engine tests (see the README).
- `npm run bot:cloudsteel`: human-paced players with thresholds, from `tests/cloudsteel-bots.mjs`. Rerun it after changing any number above.
- `npm run test:e2e:cloudsteel`: browser run; needs the dev server and Playwright.

## Debug hook

`window.__cloudsteel()` returns `{ screen, paused, save, done, backend, fight, debug }`. `fight` has the phase, round, Dora's state and bars, stats and every foe. `debug` has `tag(v)`, `foeHp(v)`, `foePosture(v)`, `hp(v)` and `place(x, z)`.

## Not built yet

One arena only. The road beyond the Condor Gate, more foes (the pitch has vizcacha archers and condor assassins), playing as Enzo, and modelled characters in place of the code-built figures.
