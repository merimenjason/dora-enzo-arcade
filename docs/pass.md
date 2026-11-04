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
| Coilovers | 120 | Lower centre of gravity (×0.88) and a sharper front (front stiffness ×1.08) |
| Stripped Interior | 140 | Mass and yaw inertia down (×0.92, ×0.9), but the tray wobbles 15% more |

On their own, Coilovers take 0.3 to 0.6 s off the bot's delivery times (0.4 s slower on Hairpin Stairs, where the sharper nose costs drift) and Stripped Interior 0.1 to 0.4 s; Sticky Tyres is still the biggest single gain at 1.2 to 2.6 s. Bigger brakes were tried and left out: braking is grip-limited at the front, so stronger brakes only made the car brake later and arrive too fast. The bot ladder in `tests/pass-bot.mjs` still uses the first five parts, so these two make the duels a little easier for whoever buys them.

### Cars

Beating a rival unlocks a car in their style (`CARS` in `lib/pass-game.ts`); the Biscuit is always yours. Each car is the Biscuit's spec with a few numbers changed, so every part fits every car (the Sprung Bun Tray scales each car's own bun wobble). The garage picks the car for Delivery Runs, Time Attack and Free Duel; the story always drives the Biscuit, because it is the car in every scene. The save keeps the pick only while that car is unlocked, and a ghost remembers the car it was driven in.

| Car | Shape | Unlocked by | Character | Stock bot vs the Biscuit |
| --- | --- | --- | --- | --- |
| Biscuit | hatch | always | forgiving all-rounder | 0% |
| Shortbread | wedge | Skitter | loose tail, a stronger diff (slideR 0.72, LSD 0.55) | −0.3% |
| Meringue | roadster | Ripple | light and low with more grip, less power (930 kg, 195 N·m) | −0.5% (slower on Hairpin Stairs) |
| Pumpernickel | saloon | Bodger | heavy, more power, calm buns (1260 kg, 295 N·m, bun wobble ×0.75) | +0.4% |
| Crumpet | kei | Pippa | 740 kg and more lock: best on Hairpin Stairs and Fog Ridge, worst on Cedar | 0% |
| Brioche | fastback | Vesper | 310 N·m and a loose tail | −1.4% |
| Stollen | coupe | Old Crag | long wheelbase, more grip and power | −1.3% |
| Pavlova | brake (shooting brake) | Hush, after the story | light, grippy and strong, calm buns | −1.8% |

"Stock bot" is the competent bot's delivery time averaged over the six passes. `tests/pass.mjs` holds every car within 3% of the Biscuit on each pass and between −2% and +1% overall, with no spins and at most one bun lost. The garage cards use painted portraits `public/art/pass/car-<id>.webp` (generated with the Codex CLI's image tool from `story-carpark.webp` as the style reference, then resized).

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

**Enzo's line** (the ▶ button under each open pass in Delivery Runs) is a demo: the stock Biscuit drives the pass by itself with every note called. It is the same racing-line follower as the bot with the human parts removed (no reaction lag, no wander, no off nights, no slips), and it drifts where drifting pays: on each corner without a gutter to hook, up to a set radius, it kicks the handbrake just before turn-in, then holds a steady slide through the whole corner and takes the drift boost out. The slide is held on the throttle: 0.6 plus 3 × (the target slip angle − the actual one), eased to 0.35 when the car is over the racing line's speed so the slide scrubs speed instead of carrying it wide, with a little countersteer on some passes when the angle swings past. Gutter hairpins it hooks in grip instead, and on Fog Ridge it never commits to a drift blind. `DEMO` in `lib/pass-game.ts` holds the shared numbers (braking at 0.88 of the bot's, a 0.3 s kick, the throttle gain `kp`) and, per pass, the pace, the widest radius it drifts, how early it kicks, the slip angle it holds (`hold`, 0.25 to 0.3 rad), the kick's length (`hand`) and the countersteer (`kc`); each is the fastest setting found by sweeping that runs clean and is also clean one pace step slower. Holding the slide (04-11-2026) took 0.8 s off the six passes in all (0.5 s on Ghost Tunnel, 0.3 s on Summit Dawn) and raised the drift points by about 30%; a held slide without the speed easing ran wide into the rails. `tests/pass.mjs` holds it to no rail hits, no spins, all 12 buns, at least 100 drift points and a faster time than the bot on every pass: 0.2 s (Lakeside Esses, which has no hairpins) to 2.2 s (Fog Ridge) faster, with 404 to 926 drift points. It is the best run found that way, not a proven optimum. A demo saves nothing and pays nothing. In Time Attack, 👻 Race Enzo's line replays the demo as a ghost (`enzoGhost` records the demo run's inputs; `ENZO_CAR` is the stock Biscuit it was driven in), so it replays exactly whatever car the player brings; the result shows the gap to his time, and the run still counts for your best and your own ghost.

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
| 8 | Hush, snowy owl (after the story) | Moonmoth, pearl-grey shooting brake | Fog Ridge | 0.945 | 6 |

"Bot wins" is the competent bot (pace 0.985 on Strong assist, with full notes and the ladder's upgrades) from `npm run bot:pass`. The bot drives like a person: it acts on what it decided 0.2 s earlier (steering for where the car will be by then), wanders up to 0.4 m either side of the racing line, and its steering goes through the Smooth filter. `tests/pass-bot.mjs` holds each rival to within 2 wins of the ladder 16, 14, 13, 12, 11, 9, 7 and the first two at 15 and 12 or more. Duel results swing a lot with small pace changes (a few thousandths can move a rival by three wins), so retune by bisecting each rival's pace against the bot and confirm with the full `bot:pass`. A flat-out, no-brakes driver wins none past the first rival. The rivals' own AI steers without the filter and doesn't use the drift hold.

### After the story

The ending scene sets `ended`, which opens every pass, every story rival in Free Duel and the six story cars. Two more steps follow it in `STORY` (after `STORY_END`): a scene at the bakery (`story-owl.webp`) and a duel with Hush on Fog Ridge, with every part the ladder gives. She is the hardest rival (`bot:pass` wants about 5 bot wins in 16, and fewer than Aurora). Hush (`POSTGAME_RIVAL`) and her car, the Pavlova, stay locked until she is beaten; the story ladder hides the two steps until the ending, and the ending card's Follow it button plays them.

## Side jobs

Three jobs on every open pass (`JOBS` and `JOB` in `lib/pass-game.ts`), in the garage's car, each paying coins when it works and `JOB.firstBonus` (40) more the first time on that pass (`jobs` in the save).

| Job | What it is | Works when | Pays | Tuning |
| --- | --- | --- | --- | --- |
| 🎂 The wedding cake | one cake instead of twelve buns | the cake arrives (`buns` 1) | 60 | wobble starts at 0.8 g (buns 0.9), gain 1.5 (1.1), settles at 0.2/s; a rail knock over 5.5 m/s breaks it |
| 🩺 The doctor's run | no cargo, a deadline | time ≤ the bot's time × 1.08 (`jobDeadline`) | 50 + 2 a second early | |
| 🦔 Granny Bramble | a passenger with a mood (`Race.mood`, 0 to 100, from 50) | mood ≥ 60 at the line | 30 + mood ÷ 2 | a clean drift adds 8 × (0.5 + meter), a rail hit takes 6 + the impact speed, every second under 7 m/s takes 6 |

`tests/pass.mjs` holds the jobs: a careful bot (0.88) delivers the cake on every pass while flat out (0.985) breaks it on Cedar, Hairpin Stairs and Ghost Tunnel; a good run (0.96) makes every deadline and a gentle one (0.85) misses them; Enzo's drifting line keeps Granny happy everywhere, while a tidy run with no drifting bores her on four passes. Her lines are in `RIDER_LINES` on the page, said in the note bubble with her portrait (`granny-bramble.webp`).

## Coins and progress

Deliveries pay 2 coins a bun plus 10, 20 or 35 for bronze, silver or gold; a won duel pays 45 + 15 per rival number (12 for a loss); time attack pays 5. The story is 17 steps: scenes, deliveries and duels, with the passes opening as it goes. Beaten rivals open in Free Duel. Time Attack races a ghost of the best run on each pass (recorded inputs, replayed on the car it was recorded with).

## Save

`localStorage` key `kumori-pass-v1`: coins, upgrades, runs per pass, story step, beaten rivals, medals, best times, ghosts and settings (assist, steering, gears, Lite, sound, music, camera). Anything missing or malformed falls back to the default. Saves from before the 03-11-2026 handling update keep working: an assist of Off stays Off, Low becomes Light and the rest become Strong, and their ghosts (recorded with the old handling) are dropped; new ghosts carry `hv: 2`.

## Rendering

90s anime cel shading: a three-step toon ramp, inverted-hull ink outlines (a normal-extruded shader on the cars, cedars, rock and props), flat night colours, speed lines on a 2D overlay at the screen edges, and a split comic-panel cut-in in slow motion (0.28× for 1.5 s) at every overtake. Each pass keeps its mood: thick fog on Fog Ridge, no lamps in the Ghost Tunnel, the lake glinting under the moon below Lakeside Esses, and dawn colours and a low sun on Summit Dawn.

The cars lean on a damped spring from their real accelerations: they squat under throttle, dive under braking and roll out of a corner. The chase camera keeps the car low in the frame, looks a little into the next corner, widens its field of view at speed and on boost, and shakes lightly on guardrail hits. In a duel a rival tailgating between the camera and the player fades out rather than lifting the camera, and a rear-view mirror at the top of the screen shows the road behind (a small render target from the player's roof, drawn on a flipped quad inside the `.kp-mirror` frame; Enzo's notes sit below it).

The minimap (`.kp-minimap`, top right under the progress bar) is a small 2D canvas drawn each frame from the track samples: the road from 140 m behind to 280 m ahead of the player, turned heading-up with the player 68% of the way down, and every racer and the ghost as inked arrowheads. On passes with fog above 0.5 or `dark` set (Fog Ridge, the Ghost Tunnel) it draws only 35 m ahead.

Ink outlines and particles are on layer 1, which Lite mode and the mirror leave out. The device pixel ratio is capped at 1.5. Lite mode drops shadows, outlines, particles and speed lines. Cedars are instanced in six chunks along the road so the ones out of view are culled; lamps and posts are instanced, gates, vending machines and glows are merged, and particles and skid marks are fixed pools, so a frame allocates nothing. `renderer.info` is reset once a frame, so `__pass().debug.draws()` counts the mirror pass too.
