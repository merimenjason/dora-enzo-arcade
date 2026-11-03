# Kumori Pass

A night mountain drift racer at `/pass`, game 75 of the arcade. At four in the morning Dora drives the Hillside Bun Bakery's little hatchback, the Biscuit, up Mount Kumori with warm buns for the summit inn, while Enzo reads the corners from his notebook. Street crews want to pass the bun car, so the pair race seven rivals in touge duels, ending in a dawn relay.

All numbers below come from `lib/pass-car.ts`, `lib/pass-tracks.ts`, `lib/pass-game.ts`, `lib/pass-scene.ts` and `app/pass/page.tsx`. Written 02-11-2026.

## Files

- `lib/pass-tracks.ts`: the six passes, written as straights and corners (angle, radius, gradient, gutters, wide places, tunnels, crests) and sampled every metre into a smoothed centreline with its heading, curvature, height, gradient and the road width on each side. `locate` finds where a car is on the road, and a pass can be built reversed (the uphill relay leg).
- `lib/pass-car.ts`: the car. A bicycle model at a fixed step of 1/120 s with a tyre curve, a rear friction circle, the engine, gears, brakes, handbrake, assists and the seven upgrades.
- `lib/pass-game.ts`: the rules. Guardrails, gutters, crests, car-to-car bumps, the drift meter and boost, the bun tray, Enzo's pace notes, the racing line and the rivals' AI, the duel rules, ghosts, medals, coins, the story and the save. No `Math.random` and no clock: every random choice comes from a seeded generator, so a seed and the inputs replay a race exactly.
- `lib/pass-scene.ts`: the drawing (Three.js). The terrain, the road ribbon and its edges, guardrails, tunnels, lamps, the sky, moon, stars and dawn sun, fog, smoke, sparks, skid marks, the chase camera, the rear-view mirror and the garage turntable.
- `lib/pass-models.ts`: the cars, built in code: lofted low-poly bodies (bonnet, cabin, roof, hatch or boot, flared arches) in each car's livery, glass, lamps that brighten under braking, headlight beams, spoked wheels that spin and steer, and the toon ramp, ink and glass materials shared with the scenery.
- `lib/pass-scenery.ts`: layered rock cuttings, cedars in two shapes, shrine gates and vending machines merged into a few meshes, glows, three layers of distant ridges, the town's lights and the moonlit lake on Lakeside Esses.
- `app/pass/page.tsx`, `pass.css`, `sound.ts`, `layout.tsx`: the page (menu, story ladder and scenes, course picker, Free Duel, garage, settings, VS card, race HUD, round cards, the overtake cut-in, results and the ending), keyboard, touch and gamepad input, saving, and the Web Audio engine, tyres and music.
- `tests/pass.mjs`, `tests/pass-bot.mjs`, `tests/e2e/pass.mjs`: engine checks, the bots and the browser suite.
- `docs/pass-art-brief.md`: the brief for the paintings.

## The car

The Biscuit is a front-engined, rear-drive hatchback: 1050 kg, wheelbase 2.4 m (1.12 m to the front axle, 1.28 m to the rear), 235 N·m, a 7600 rpm redline, five gears (3.3, 2.05, 1.45, 1.1, 0.88 with a 4.1 final drive). Each axle has a tyre curve that peaks and then falls away (front stiffness 8, rear 12; a sliding front keeps 85% of its peak, a sliding rear 78%), and the rear tyres share their grip between driving and cornering, so full throttle in a corner steps the tail out. The handbrake locks the rear wheels.

- **Steering**: keys, touch pads and sticks all reach the car raw and go through the car's steering filter. **Smooth** (the default) eases the steering in over 0.3 s and back to the centre in 0.15 s, so a tap is a small correction; **Sharp** takes 0.12 s and 0.08 s. The lock (0.6 rad) falls with speed as 0.6 / (1 + u/14 + u²/400): 0.31 rad at 10 m/s, 0.17 at 20, 0.11 at 30, 0.08 at 40, so a held key asks the tyres for about their limit and no more. Counter-steering into a slide may use up to the full lock.
- **Lift-off rotation**: off the throttle with the wheel turned more than 70% in above 10 m/s, the rear gives up to 22% of its grip, so a lift and a turn-in starts a slide.
- **Drift hold** (part of the assist): a slide past 0.13 rad, a handbrake pull with the wheel turned, or a lift-off turn-in starts it. In the slide the steering held into the corner sets the angle the car settles at (up to about 0.5 rad, more with throttle), and letting go of the steering eases it straight in about a second with no snap the other way. It ends below 0.05 rad.

- **Assist**: Strong 1 (the default), Light 0.5, Off 0. Outside a drift it turns the front wheels into any slip past 0.08 rad by that share; it also runs the drift hold and a damper on the slip angle. On Strong no ordinary corner entry spins (264 scripted entries from 12 to 34 m/s, `tests/pass.mjs`); at Off the player has to catch every slide, and a full handbrake at top speed spins.

Measured with keyboard-style inputs (a scripted flat-ground run of the bare car), before and after the 03-11-2026 handling update: a 0.1 s tap at 25 m/s turned the car 0.033 rad and now 0.015 rad (peak yaw 0.26 → 0.15 rad/s); a handbrake slide at 16 m/s with throttle and steering held now holds the whole 2.6 s at about 0.55 rad on Strong and straightens when let go; spins from the 144 open-ground corner entries went from 3 (old default assist) to 0 on Strong and Light.
- **Gears**: automatic shifts up at 94% of the redline and down at 50%; manual uses Shift and Ctrl, and the engine hits a hard limiter at the redline.

### Upgrades

Bought in Enzo's garage with bakery coins. Each changes the car's numbers and the stat card (power, grip, rotation, stability, bun safety, each out of 10).

| Part | Coins | Effect |
| --- | --- | --- |
| Sticky Tyres | 60 | More grip everywhere |
| Lighter Flywheel | 70 | Revs rise quicker |
| Stiffer Rear | 80 | The tail steps out sooner; keener to spin |
| Limited-Slip Diff | 110 | Longer, steadier drifts |
| Quick Steering Rack | 90 | More lock, faster hands |
| Sprung Bun Tray | 50 | The buns barely wobble |
| Big Intake & Turbo | 150 | More power up top, turbo whistle and backfires |

## The road

Roads are 3.6 m to each side of the centreline, 5.8 m in the wide places (where passing is possible). Both edges are drawn the same way so they read on every pass and in the dark: a solid white edge line 0.32–0.5 m inside the edge, a pale concrete shoulder strip out to the guardrail, reflective studs on the edge line every 8 m (tunnels too), white delineator posts every 8 m with an amber reflector on the left and a white one on the right, and guardrails on both sides with a reflector on every other post. The paint and reflectors are unlit, so they show in the dark and fade into the fog with distance. The uphill side also has a ditch and a rock cutting behind the rail. A dashed yellow centre line (2 m of paint, 4 m gap) runs everywhere but the passing places; a drain gutter replaces the paint and shoulder on its side. A hit scrubs 0.085 of the speed per m/s of impact; above 8.5 m/s the car is spun round, and above 11 m/s it is wrecked: it sits for 1.4 s and is set back on the road. Light crests reduce grip for a moment.

**Gutters** on the inside of the Hairpin Stairs hairpins (0.9 m wide) can be hooked: drop the inside wheels in under 17.5 m/s and with the car less than 0.38 rad sideways, and the gutter adds 45% grip and carries the car round. Too fast or too sideways, and the wheels trip and the car snaps round.

### The passes

| Pass | Character | Bot time |
| --- | --- | --- |
| Cedar Switchbacks | fast sweepers then four switchbacks | 65.57 s |
| Lakeside Esses | linked esses | 55.14 s |
| Hairpin Stairs | seven stacked hairpins with drain gutters | 67.79 s |
| Fog Ridge | thick fog; the headlights barely reach | 57.07 s |
| Ghost Tunnel | unlit, through a long tunnel | 54.23 s |
| Summit Dawn | the whole mountain; the relay climbs it first | 82.38 s |

Delivery medals: gold within 1.03× the bot time with 11 or more buns, silver 1.16× with 7 or more, bronze 1.4× with 4 or more.

## Drifting

A drift starts above 9 m/s with the car more than 0.14 rad sideways. The meter fills at 0.42 a second (faster at bigger angles, up to 1.6×). When the drift ends cleanly (no wall) with the meter at 0.25 or more, the car gets a boost of 1.6 s × the meter at 1.22× drive. A wall hit breaks the drift and empties the meter.

## The bun tray

Deliveries carry 12 buns. Cornering or braking harder than 0.9 g fills a wobble gauge (the Sprung Bun Tray slows it); a full gauge drops a bun. A guardrail hit above 3 m/s throws buns off the seat (one more for every 3.2 m/s, and one extra above 5.5 m/s).

## Enzo's notes

The notes come from the road itself: each corner is graded by its radius into seven severities (under 18 m is a hairpin, then 30, 45, 65, 95, 140, 250 m), with "tightens", "opens", "into" for linked corners, and calls for gutters, crests, wide places and tunnels. The notebook for each pass gets better with finished runs there (1 run: level 1, 2 runs: level 2, 4 runs: level 3):

| Level | Name | Called |
| --- | --- | --- |
| 0 | Scribbles | 0.7 s ahead (at least 14 m), a vague guess at the direction |
| 1 | Rough notes | 1.7 s ahead (30 m), direction and how tight |
| 2 | Numbered notes | 2.5 s ahead (45 m), severity numbers and "into" |
| 3 | Full notes | 3.2 s ahead (60 m), plus gutters, crests and passing places |

In the relay's uphill leg Dora reads the notes and Enzo drives.

## Duels

A touge duel is lead and chase. In round 1 the player leads: the round is won by finishing more than 1.0 s ahead or lost by being passed; anything in between is held. In round 2 the player chases: falling 3.0 s behind loses the round, passing and staying ahead wins it. A spin or wreck loses the round. After two rounds the most round wins takes the duel; level means sudden death until a round is won outright, up to six rounds. The relay's first round is the uphill leg.

### Rivals

Each rival drives the racing line (90% of the grip limit) with their own pace, braking, blocking and how they cope with fog and darkness, small seeded mistakes, and a night-to-night form of ±2%. Their cars carry the same upgrades the ladder would give the player by then.

| # | Rival | Car | Pass | Pace | Bot wins (16 seeds) |
| --- | --- | --- | --- | --- | --- |
| 1 | Skitter, stoat | Kestrel, red wedge | Cedar Switchbacks | 0.915 | 16 |
| 2 | Ripple, otter | Lagoon, teal roadster | Lakeside Esses | 0.9456 | 14 |
| 3 | Bodger, badger | Coalscuttle, boxy saloon | Hairpin Stairs | 0.8517 | 13 |
| 4 | Pippa, pika | Mochi, pink kei car | Fog Ridge | 0.9923 | 12 |
| 5 | Vesper, bat | Nightjar, black fastback | Ghost Tunnel | 0.9192 | 10 |
| 6 | Old Crag, mountain goat | Ironhorn, silver coupe | Summit Dawn | 0.9097 | 10 |
| 7 | Aurora, silver fox | Daybreak, white fastback | Summit Dawn relay | 0.912 | 7 |

"Bot wins" is the competent bot (pace 0.985 on Strong assist, with full notes and the ladder's upgrades) from `npm run bot:pass`. The bot drives like a person: it acts on what it decided 0.2 s earlier (steering for where the car will be by then), wanders up to 0.4 m either side of the racing line, and its steering goes through the Smooth filter. `tests/pass-bot.mjs` holds each rival to within 2 wins of the ladder 16, 14, 13, 12, 11, 9, 7 and the first two at 15 and 12 or more. Duel results swing a lot with small pace changes (a few thousandths can move a rival by three wins), so retune by bisecting each rival's pace against the bot and confirm with the full `bot:pass`. A flat-out, no-brakes driver wins none past the first rival. The rivals' own AI steers without the filter and doesn't use the drift hold.

## Coins and progress

Deliveries pay 2 coins a bun plus 10, 20 or 35 for bronze, silver or gold; a won duel pays 45 + 15 per rival number (12 for a loss); time attack pays 5. The story is 17 steps: scenes, deliveries and duels, with the passes opening as it goes. Beaten rivals open in Free Duel. Time Attack races a ghost of the best run on each pass (recorded inputs, replayed on the car it was recorded with).

## Save

`localStorage` key `kumori-pass-v1`: coins, upgrades, runs per pass, story step, beaten rivals, medals, best times, ghosts and settings (assist, steering, gears, Lite, sound, music, camera). Anything missing or malformed falls back to the default. Saves from before the 03-11-2026 handling update keep working: an assist of Off stays Off, Low becomes Light and the rest become Strong, and their ghosts (recorded with the old handling) are dropped; new ghosts carry `hv: 2`.

## Rendering

90s anime cel shading: a three-step toon ramp, inverted-hull ink outlines (a normal-extruded shader on the cars, cedars, rock and props), flat night colours, speed lines on a 2D overlay at the screen edges, and a split comic-panel cut-in in slow motion (0.28× for 1.5 s) at every overtake. Each pass keeps its mood: thick fog on Fog Ridge, no lamps in the Ghost Tunnel, the lake glinting under the moon below Lakeside Esses, and dawn colours and a low sun on Summit Dawn.

The cars lean on a damped spring from their real accelerations: they squat under throttle, dive under braking and roll out of a corner. The chase camera keeps the car low in the frame, looks a little into the next corner, widens its field of view at speed and on boost, and shakes lightly on guardrail hits. In a duel a rival tailgating between the camera and the player fades out rather than lifting the camera, and a rear-view mirror at the top of the screen shows the road behind (a small render target from the player's roof, drawn on a flipped quad inside the `.kp-mirror` frame; Enzo's notes sit below it).

Ink outlines and particles are on layer 1, which Lite mode and the mirror leave out. The device pixel ratio is capped at 1.5. Lite mode drops shadows, outlines, particles and speed lines. Cedars are instanced in six chunks along the road so the ones out of view are culled; lamps and posts are instanced, gates, vending machines and glows are merged, and particles and skid marks are fixed pools, so a frame allocates nothing. `renderer.info` is reset once a frame, so `__pass().debug.draws()` counts the mirror pass too.
