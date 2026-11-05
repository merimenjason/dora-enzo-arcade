# Paperwing Post

A 3D paper-glider game at `/glider`. The post office bicycle has a flat tyre and it is Granny Juniper's birthday on Saturday, so Dora flies a huge paper glider out of the attic window and over the town while Enzo rides behind her with the satchel and posts the letters through people's windows. A second player can take Enzo's button.

Rules: `lib/glider-game.ts`. Drawing: `lib/glider-scene.ts` (Three.js, toon shading with ink outlines; Dora and Enzo use the shared rig in `lib/hunt-chinchilla.ts`). Page, input, HUD and save: `app/glider/page.tsx`. Sound: `app/glider/sound.ts` (synthesised; the waltzes are original). Painted art: `public/art/glider/` (title, map, workshop, ending, portraits of Dora, Enzo and Granny Juniper, the three gliders, the envelope, and the plaster, roof tile, cobble, grass and paper textures the town is built from).

## The town

About 440 m across: x is east, z is south, y is up.

- Dora and Enzo's house is on a hill in the north-west corner at (-160, -160); Granny Juniper's cottage is on a hill in the south-east at (165, 172). The clock tower stands in the middle of the market square at (0, 0), 40 m to the eaves.
- The river winds across the south: its middle is at `z = 92 + 24 sin(x / 70)` and it is 18 m wide. There are two bridges.
- The rest of the town is built on a grid of blocks 40 m apart, one or two houses a block, kept clear of the market square, the river and the two hills. The same town every time (seed 7): 159 houses, two thirds of them with a chimney. The bakery is the house nearest (-40, -40).
- A letter's window is a metre out from the wall of its house, about two thirds of the way up, on the side facing where you come from (the letter before, or home for the first). If another house stands too close in front of that wall to fly in, it uses the next best wall.

## The glider

The engine runs at 60 ticks a second.

- **Turning:** steering banks the wings up to 0.75 rad, and a banked glider turns at `turn × g × tan(bank) / speed` (a coordinated turn). A banked glider sinks a little faster.
- **Pitch:** the nose settles at -0.06 rad with the stick centred; up takes it to +0.44 and down to -0.71.
- **Speed:** gravity along the path against drag: `dv/dt = -g sin(pitch) - drag × v²`, between 3 and 34 m/s. Diving trades height for speed; pulling up trades speed for height.
- **Stall:** below 6.5 m/s the glider stalls and the nose drops to -0.55 rad, whatever the stick says, until it is back above 9 m/s.
- **Sinking:** the glider always sinks at `sink / cos(bank)` m/s through the air; warm air is the only way up.
- **Wind** carries it along at the flight's wind speed.
- **The edge:** more than 60 m past the edge of the town the glider turns gently back.

| Glider | Pages | Drag | Sink (m/s) | Turn | Knocks |
| --- | --- | --- | --- | --- | --- |
| The Dart | free | 0.0032 | 0.45 | 1.6 | 4 |
| The Broadwing | 25 | 0.0052 | 0.22 | 1.9 | 4 |
| The Swoop | 50 | 0.0042 | 0.36 | 2.5 | 5 |

## Warm air

- **Chimneys:** a column of rising air from the eaves to 70 m over the pot, `up × exp(-d² / 120)` within 22 m of the chimney, fading over its top 20 m. Ordinary chimneys give 3.2 to 4.0 m/s at the middle, the two homes 3.6 and the bakery 4.8. The smoke shows where it is and drifts with the wind.
- **Sunny squares** (on some flights): `up × (1 - (d / r)²)` within the radius, up to 95 m above the ground.
- Circling a chimney slowly in a tight bank is the way to climb; the HUD's height gauge glows gold in warm air.

## Posting and pages

- A window is **in reach** within 14 m across, from 6 m below the window to 16 m above it (Enzo tosses the letter down). The post button posts to the nearest window in reach; one press is one letter.
- Within 6 m and within 6 m of its height is a **perfect** post.
- A **page** is caught by flying within 3.5 m of it. The pages drift along the way between the letters, 8 to 24 m above the roofs.
- **Home:** with the satchel empty (or not), flying within 3.5 m of the blue ring at the attic window after the first 6 seconds glides home and ends the flight.

## Knocks and endings

- Flying into a wall or a roof is a **knock**: the glider is pushed back out, turned away from the wall and slowed (to 50% for a wall, 70% for a roof, never below 7 m/s). Knocks within 1.2 s of each other count once. As many knocks as the glider can take **crumples** it and ends the flight.
- Touching the ground ends the flight: **landed** (soft if slower than 14 m/s with the nose above -0.3 rad), or a **splash** in the river.

## Tips

Enzo's line at the top of the screen says what to do next from where the glider is: post when a window is in reach, nose down when too slow, find warm air when low, glide home when the satchel is empty, and on the first flight how to steer, dive and climb. The tips can be turned off in Settings or the pause menu.

## The flights

| # | Flight | Sky | Wind (m/s east, south) | Letters | Sunny squares | Pages (goal) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Morning Post | morning | calm | 3 | none | 10 (6) |
| 2 | Market Day | noon | 1, 0 | 4 | the market square, 26 m, 2 m/s | 12 (8) |
| 3 | Down the River | afternoon | 1.3, 0 | 4 | by the river, 18 m, 1.5 m/s | 12 (8) |
| 4 | The Clockmaker | noon | 0, 0.8 | 3 and the Clockmaker at the top of the tower | the market square, 30 m, 2.4 m/s | 12 (8) |
| 5 | Washing Day | afternoon | -0.9, 1.8 | 4 | the north-east, 20 m, 1.8 m/s | 16 (10) |
| 6 | Granny's Birthday | sunset | 0.6, 0.6 | 4, the last to Granny Juniper | the square and by the river | 12 (8) |

## Points and stars

- 200 points a letter, 100 more for a perfect post, 25 a page, 400 for gliding home or 100 for a soft landing.
- Stars: one for posting every letter, one more for the page goal as well, one more for gliding home as well. No stars without every letter.
- Posting every letter of a flight opens the next one. Caught pages are banked in the workshop on every flight, finished or not.
- Posting every letter of Granny's Birthday plays the ending, the first time.

## Bots

`npm run bot:glider` (part of `npm test`) flies every flight for up to six minutes with four pilots: hurried and careful, each in the Dart and the Broadwing. A pilot heads for the next letter in order while it has the height to glide there (about 9:1, plus a margin), and otherwise turns for the best warm air it can reach and circles in it until it has; it pulls up or turns away from roofs ahead, spirals down onto a window it is high above, and posts when the window is closest. The careful pilot also detours for pages near its way. Once the satchel is empty it heads home.

It checks that every flight is finished (every letter posted) by at least three pilots, that every pilot finishes at least five flights, that the pilots get home at least three times between them, and that a pilot who never steers posts nothing. At the last run, all four pilots finished all six flights and got home 4 times out of 24. The bots are poor at pages and at getting home; a player does much better.

## Tests

- `npm run test:glider`: the engine (see the top of `tests/glider.mjs`).
- `npm run bot:glider`: the bots above.
- `node tests/e2e/glider.mjs` with `npm run dev` running: the title, the welcome, steering and diving, posting with Space and with Enter, pause, gliding home, the workshop, a corrupt save, and phones held either way with the stick and POST. The browser test uses `window.__glider().debug` to put the glider by a window.

## Save

`localStorage` key `paperwing-post-v1`: whether the welcome has been seen, the best points and stars of every flight, the banked pages, the gliders folded and the one picked, whether the ending has played, the settings (sound, music, Enzo's tips, flipped up and down) and totals (flights, letters, pages, times home, crumples). A corrupt or unknown save starts again from new; odd values are clamped.
