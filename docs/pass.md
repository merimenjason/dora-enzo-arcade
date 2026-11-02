# Kumori Pass

A night mountain drift racer at `/pass`, game 75 of the arcade. At four in the morning Dora drives the Hillside Bun Bakery's little hatchback, the Biscuit, up Mount Kumori with warm buns for the summit inn, while Enzo reads the corners from his notebook. Street crews want to pass the bun car, so the pair race seven rivals in touge duels, ending in a dawn relay.

All numbers below come from `lib/pass-car.ts`, `lib/pass-tracks.ts`, `lib/pass-game.ts`, `lib/pass-scene.ts` and `app/pass/page.tsx`. Written 02-11-2026.

## Files

- `lib/pass-tracks.ts`: the six passes, written as straights and corners (angle, radius, gradient, gutters, wide places, tunnels, crests) and sampled every metre into a smoothed centreline with its heading, curvature, height, gradient and the road width on each side. `locate` finds where a car is on the road, and a pass can be built reversed (the uphill relay leg).
- `lib/pass-car.ts`: the car. A bicycle model at a fixed step of 1/120 s with a tyre curve, a rear friction circle, the engine, gears, brakes, handbrake, assists and the seven upgrades.
- `lib/pass-game.ts`: the rules. Guardrails, gutters, crests, car-to-car bumps, the drift meter and boost, the bun tray, Enzo's pace notes, the racing line and the rivals' AI, the duel rules, ghosts, medals, coins, the story and the save. No `Math.random` and no clock: every random choice comes from a seeded generator, so a seed and the inputs replay a race exactly.
- `lib/pass-scene.ts`: the drawing (Three.js). Toon-shaded cars with inked outlines, the road ribbon, guardrails, rock cuttings, cedars, lamps and light pools, vending machines, shrine gates, tunnels, fog, the town glow, smoke, sparks, skid marks, the chase camera and the garage turntable.
- `app/pass/page.tsx`, `pass.css`, `sound.ts`, `layout.tsx`: the page (menu, story ladder and scenes, course picker, Free Duel, garage, settings, VS card, race HUD, round cards, the overtake cut-in, results and the ending), keyboard, touch and gamepad input, saving, and the Web Audio engine, tyres and music.
- `tests/pass.mjs`, `tests/pass-bot.mjs`, `tests/e2e/pass.mjs`: engine checks, the bots and the browser suite.
- `docs/pass-art-brief.md`: the brief for the paintings.

## The car

The Biscuit is a front-engined, rear-drive hatchback: 1050 kg, wheelbase 2.4 m (1.12 m to the front axle, 1.28 m to the rear), 235 N·m, a 7600 rpm redline, five gears (3.3, 2.05, 1.45, 1.1, 0.88 with a 4.1 final drive). Each axle has a tyre curve that peaks and then falls away (front stiffness 8, rear 12; a sliding front keeps 85% of its peak, a sliding rear 78%), and the rear tyres share their grip between driving and cornering, so full throttle in a corner steps the tail out. Steering lock (0.6 rad) shrinks with speed so the car stays calm at the top end. The handbrake locks the rear wheels.

- **Assist** (counter-steer): Off 0, Low 0.35, Medium 0.6 (the default), High 0.85 (the default on a touch screen). It turns the front wheels into a slide by that share of the slip angle; at Off the player has to catch every slide.
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

Roads are 3.6 m to each side of the centreline, 5.8 m in the wide places (where passing is possible). Guardrails line the downhill side and a rock cutting the uphill side. A hit scrubs 0.085 of the speed per m/s of impact; above 8.5 m/s the car is spun round, and above 11 m/s it is wrecked: it sits for 1.4 s and is set back on the road. Light crests reduce grip for a moment.

**Gutters** on the inside of the Hairpin Stairs hairpins (0.9 m wide) can be hooked: drop the inside wheels in under 17.5 m/s and with the car less than 0.38 rad sideways, and the gutter adds 45% grip and carries the car round. Too fast or too sideways, and the wheels trip and the car snaps round.

### The passes

| Pass | Character | Bot time |
| --- | --- | --- |
| Cedar Switchbacks | fast sweepers then four switchbacks | 65.08 s |
| Lakeside Esses | linked esses | 55.62 s |
| Hairpin Stairs | seven stacked hairpins with drain gutters | 67.8 s |
| Fog Ridge | thick fog; the headlights barely reach | 57.09 s |
| Ghost Tunnel | unlit, through a long tunnel | 54.55 s |
| Summit Dawn | the whole mountain; the relay climbs it first | 82.18 s |

Delivery medals: gold within 1.04× the bot time with 11 or more buns, silver 1.13× with 8 or more, bronze 1.28× with 5 or more.

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

A touge duel is lead and chase. In round 1 the player leads: the round is won by finishing more than 1.0 s ahead or lost by being passed; anything in between is held. In round 2 the player chases: falling 2.6 s behind loses the round, passing and staying ahead wins it. A spin or wreck loses the round. After two rounds the most round wins takes the duel; level means sudden death until a round is won outright, up to six rounds. The relay's first round is the uphill leg.

### Rivals

Each rival drives the racing line (90% of the grip limit) with their own pace, braking, blocking and how they cope with fog and darkness, small seeded mistakes, and a night-to-night form of ±2%. Their cars carry the same upgrades the ladder would give the player by then.

| # | Rival | Car | Pass | Pace | Bot wins (16 seeds) |
| --- | --- | --- | --- | --- | --- |
| 1 | Skitter, stoat | Kestrel, red wedge | Cedar Switchbacks | 0.9 | 16 |
| 2 | Ripple, otter | Lagoon, teal roadster | Lakeside Esses | 0.987 | 13 |
| 3 | Bodger, badger | Coalscuttle, boxy saloon | Hairpin Stairs | 1.0 | 12 |
| 4 | Pippa, pika | Mochi, pink kei car | Fog Ridge | 1.011 | 13 |
| 5 | Vesper, bat | Nightjar, black fastback | Ghost Tunnel | 0.9625 | 10 |
| 6 | Old Crag, mountain goat | Ironhorn, silver coupe | Summit Dawn | 0.9925 | 9 |
| 7 | Aurora, silver fox | Daybreak, white fastback | Summit Dawn relay | 1.017 | 6 |

"Bot wins" is the competent bot (pace 0.985 with full notes and the ladder's upgrades) from `npm run bot:pass`; a flat-out, no-brakes driver wins none past the first rival.

## Coins and progress

Deliveries pay 2 coins a bun plus 10, 20 or 35 for bronze, silver or gold; a won duel pays 45 + 15 per rival number (12 for a loss); time attack pays 5. The story is 17 steps: scenes, deliveries and duels, with the passes opening as it goes. Beaten rivals open in Free Duel. Time Attack races a ghost of the best run on each pass (recorded inputs, replayed on the car it was recorded with).

## Save

`localStorage` key `kumori-pass-v1`: coins, upgrades, runs per pass, story step, beaten rivals, medals, best times, ghosts and settings (assist, gears, Lite, sound, music, camera). Anything missing or malformed falls back to the default.

## Rendering

90s anime cel shading: a three-step toon ramp, inverted-hull ink outlines on the cars, flat night colours, speed lines on a 2D overlay at the screen edges, and a split comic-panel cut-in in slow motion (0.28× for 1.5 s) at every overtake. The device pixel ratio is capped at 1.5. Lite mode drops shadows, outlines, particles and speed lines. Props (cedars, lamps, posts) are instanced, and particles and skid marks are fixed pools, so a frame allocates nothing.
