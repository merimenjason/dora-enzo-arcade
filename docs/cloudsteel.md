# Cloudsteel

A 3D sword adventure at `/cloudsteel` with painted figures. **The climb** is the story: free roam in four directions through three areas (the Rain Terrace, the Cloud-Forest Path and the Citadel Gate), talking to people, finding quipus and upgrades, waking hidden bridges and sealed gates with Enzo's lantern, and six sword duels (three on the way, three optional) that end at Ukhu, the warden. About half an hour for a first climb. **The terrace duel** on the title menu is the original three-round fight on its own.

## Code layout

- `lib/cloudsteel-game.ts`: the fight. A fixed 60 Hz simulation with no DOM. `new Fight(seed, assist, { rounds?, ups? })` then `tick(input)` once per step; `events` holds what happened in that step. All randomness comes from the seed. Without `rounds` it is the terrace duel's three rounds; a story duel passes its own one round and the sword upgrades Dora carries.
- `lib/cloudsteel-world.ts`: the climb. Also 60 Hz, no DOM, no randomness. `new World()` then `tick({ x, z, act, lantern, choose })`: walking with wall sliding, the scenes that start by themselves, talk and choices, pickups, the lantern, gates and stones, handing a duel to the page and taking the result back (`endDuel(won, stats)`, `placeFromFight`), Enzo following, and `toSave()` / `World.fromSave()`.
- `lib/cloudsteel-story.ts`: the content. The three areas (walkable shapes, solids, gates, planks, exits, triggers, signs, props), the stones, pickups, duels, people and every scene of talk. A scene is a function of the world, so its lines change with what has happened.
- `lib/cloudsteel-scene.ts`: drawing only. Builds each area, draws every figure as a painted card, runs the effects and the cameras.
- `lib/cloudsteel-sprites.ts`: generated: the layout of each character's sprite atlas.
- `app/cloudsteel/page.tsx`: input, both loops, the HUD and the talk box, menus, results, the endings and the save. `sound.ts` synthesises every sound and the four songs with WebAudio. `cloudsteel.css` styles the menus and HUD.
- `public/art/cloudsteel/`: the painted art; `sprites/` holds the character atlases.

## The climb

The Sun Lamp on the Condor Gate of Phuyu Pukara, the cloud fortress, has gone dark and the condors cannot find their way home through the mist. Enzo carries the last ember in his lantern. Mallku, captain of the sword-kin, smuggles jade through the mist and wants the Lamp dark; he has hired Atoq, a fox sellsword, to turn back anyone carrying a flame. Ukhu, the bear warden, guards the gate under an old law and lets nobody by who has not crossed blades with him.

| Area | Who is there | Puzzle | Duels | Secrets |
|---|---|---|---|---|
| The Rain Terrace | Qori the vizcacha bell-keeper | The sun-stone: the lantern wakes it and the gate north opens | Atoq (on the way); the Sword-Kin Sami and Wayra on the east balcony (optional, the Rain-Tempered Edge) | the Long Wick behind the bell-house; quipus 1 to 3 |
| The Cloud-Forest Path | Tupa the llama potter; Atoq again, once beaten | The spirit bridge: twelve sleeping planks over the gorge, woken a few at a time by the lantern; a branch west whose middle planks lie deep and need the Long Wick | the Sword-Kin ambush past the bridge (on the way); Titu the puma in the fern glade (optional, the Puma-Claw Guard) | the Condor-Feather Wrap by the bamboo; Tupa gives the Jade Glass for the crossing; quipus 4 to 6 |
| The Citadel Gate | Atoq, who has changed sides | a jade seal on the outer gate and on the west door (the Jade Glass opens them); the three stones of the worlds, woken below, middle, above (serpent, puma, condor), or they go dark | Mallku and Rumi in the west yard (optional, the Second Flame); Ukhu at the gate (the last duel) | quipus 7 to 9 |

- Upgrades: the **Rain-Tempered Edge** (cuts do 1.2× damage), the **Condor-Feather Wrap** (cuts do 1.25× posture), the **Puma-Claw Guard** (the deflect moment is 3 ticks longer), the **Long Wick** (the lantern reaches 5.5 m instead of 3.5 and wakes deep planks), the **Jade Glass** (opens jade seals) and the **Second Flame** (Enzo's meter fills 1.3× faster and his lantern strike does 26 damage and 70 posture).
- Walking is 3.6 m/s. Talk, pick up and read reach 1.9 m (a little more for duellists). The lantern takes 54 ticks and acts at tick 24: planks within its reach, stones within 2.6 m and jade seals within 3.2 m. Picking up takes 72 ticks; the item is kept at tick 32.
- A duel on the way starts by itself within 6.5 m of its foes. An optional one starts from talk, with a choice: duel now or not now. Losing offers another try on full health or a step back down the path; the foe waits.
- Lines change with progress: Qori, Tupa and Atoq each say different things as the story moves on, and every beaten optional foe stays to talk.

## Painted figures and cameras

Every figure is a camera-facing card showing one cell of its character's atlas. Walking and standing pick a front, back or side painting from the angle between the figure's facing and the camera, and the side painting is mirrored for the other side. Walks have four frames a direction (Dora, Enzo) or three side frames (the duellists). Every action has its own painting. Dora: front, side and back idles, three talk frames, a two-frame pickup, the fight stance, a cut wind-up, two cuts and the heavy lunge, guard, deflect, dodge, hit, recoil, stagger (her guard broken), a two-frame finisher, the dash when Enzo is called, down and win. Enzo: three idles, two talk frames, the lantern lift and sweep, a leap, ready, the tag strike, a cheer and a brace. Each duellist: idle, a walk, both attacks' wind-ups and strikes (Ukhu has three), recover, hit, deflected, parry, broken, down, talk and bow. Qori and Tupa: front and side idles and two talk frames. Exploring uses a follow camera behind Dora that the player turns; a duel or a talk swings it side-on, on the side Enzo is not standing.

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
| Puma (Titu) | 210 | 120 | swipe (14, quick), **jade pounce** (22, leaps 3 m, cannot be guarded) |

Mallku is a fox with 200 health.

- A foe that has taken three cuts since its last attack turns the next one aside (Dora recoils) and attacks at once.
- Cuts never stop a foe that has begun its wind-up, so cutting into one is a trade. Otherwise a fox or the puma flinches at every cut and the bear only at the third.
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
- Figures are painted cards (see above) lit by the scene: a `MeshStandardMaterial` with the atlas as its map and a little of it as emissive, colour 0.72, so lanterns warm them without blowing them out and bloom never reaches the faces. Hit flashes are kept small and below white for the same reason.
- Tells: a glint on the weapon grows through a steel wind-up; a jade ring on the ground marks the slam's reach.

## Art

Painted by Codex from `docs/ideas/cloudsteel/game-art-brief.md` and, for the climb, from reference sheets of each character: the title, the two ending pictures, the three mountain panoramas, the terrace floor, stone, roof, moss and bark, the foliage, item and carving sheets, nine portraits, four HUD icons, and a sprite sheet set for every character (Dora, Enzo, Atoq, the Sword-Kin, Mallku, Titu, Ukhu, Qori, Tupa). Dora is cream-white and Enzo grey; neither wears a signature item. Dora wears a saffron jacket with indigo bands; Enzo a long slate-blue coat with gold-and-jade bands and carries the lantern staff.

The sheets were painted as 2×2 grids on magenta, keyed (with the magenta unmixed from the edges), cut into cells and packed into one WebP atlas per character, every frame at one scale with its feet on one baseline (`lib/cloudsteel-sprites.ts` records each atlas's grid and the anchor under the head). One frame painted at the wrong size (Ukhu's slam wind-up) is scaled up in packing.

## Save

`localStorage['cloudsteel-v2']`: `{ v: 2, best: Result | null, wins, fights, seenHow, settings: { assist, sound, music, fx }, story, climbs }`. `story` is the place on the mountain (`World.toSave()`: area, position, flags, items, lit planks and stones, duels won, the stone sequence, stats, done) or null; it is saved after every talk, pickup, gate, duel and area change and every 15 s. `parseSave` falls back to a new save on anything it cannot read, and `World.fromSave` refuses a story it cannot read and drops unknown items and duels. Version 1 saves are ignored.

## Tests

- `npm run test:cloudsteel`: 19 fight tests and 12 story tests (see the README).
- `npm run bot:cloudsteel`: human-paced players with thresholds, from `tests/cloudsteel-bots.mjs`, then (`--story`) every story duel without upgrades and the whole story played through on several seeds by `tests/cloudsteel-story-bots.mjs`, which walks by A* over the world's own walkable test. Rerun it after changing any number above.
- `npm run test:e2e:cloudsteel`: browser run; needs a running server and Playwright. Set `BASE_URL` for a server other than `localhost:3000`; Playwright installed elsewhere can be found through `NODE_PATH`.

## Debug hook

`window.__cloudsteel()` returns `{ screen, paused, scene, save, done, backend, fight, story, debug }`. `fight` has the phase, round, Dora's state and bars, stats and every foe. `story` has the area, mode, position, flags, items, lit planks and stones, duels won, what is near, the current line, whether a choice is open, the duel, Enzo and the camera's yaw. `debug` has `tag(v)`, `foeHp(v)`, `foePosture(v)`, `hp(v)` and `place(x, z)` for fights, and `go(x, z, face?)`, `area(id, x, z, face?)`, `flag(f)`, `give(item)` and `win(duel)` for the climb.

## Not built yet

The road beyond the Condor Gate, more foes (the pitch has vizcacha archers and condor assassins), playing as Enzo, and climbing or jumping: the climb is walked on one level.
