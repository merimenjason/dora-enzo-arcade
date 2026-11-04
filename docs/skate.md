# Pawpark Skate

A 3D skateboarding game at `/skate`. Dora or Enzo skates two-minute sessions in three parks, strings ollies, flips, grabs, spins, grinds and manuals into combos, clears gaps, collects golden acorns and works through each park's six goals. Goals open the next park; the trick goal in all three parks brings the ending.

Rules: `lib/skate-game.ts`. Drawing: `lib/skate-scene.ts` (Three.js, toon shading with ink outlines; the skaters use the shared rig in `lib/hunt-chinchilla.ts`). Page, input, HUD and save: `app/skate/page.tsx`. Sound: `app/skate/sound.ts`.

## The parks

Every park is built from four kinds of piece, and the scene draws exactly what the engine rides on:

- **Box:** a ledge, bench, planter, deck or funbox top, flat at height `h`. With `grind` set, its four top edges are grindable ledges.
- **Ramp:** a flat slope from `h0` to `h1` across its rectangle: kickers, banks and the hall steps.
- **Quarter-pipe:** a circular curve of radius `r` up to height `h` (at most 0.97 r), with a grindable coping along the lip and usually a deck behind it.
- **Hole:** fall in and you bail (the street between the rooftops).

Rails are their own list, with a name for the ones that make gaps.

| Park | Opens at | Size | What's there |
| --- | --- | --- | --- |
| Pawpark Plaza | start | 64 × 64 m | The fountain with a kicker either side, the town hall terrace with its steps and the Hall Handrail, the Long and Market Ledges, benches and planters, quarter-pipes along the east and south, the café bank and wall, a flat rail and a bike rack rail |
| Cloverdrop Hill | 3 goals | 70 × 70 m | A big halfpipe (3.4 m), a pyramid funbox with a rail, a mini ramp, a bank up to the Lighthouse Deck, the Clover Ledge, the Long Rail and a kicker over a hedge |
| Lanternfall Rooftops | 8 goals | 72 × 72 m | Two roofs with the street between them (a hole 6 m wide), kickers to jump it, the Plank Bridge to grind across it, quarter-pipes, the Water Tower funbox, chimneys, ledges and the Lantern and Washing Line Rails |

## The board

60 Hz, gravity 14 m/s².

- **Rolling:** gravity pulls along the surface. Up the slope of a kicker or bank it only slows you at 30% strength, which is what makes kickers launch. Rolling friction is light.
- **Push:** hold up on the flat to push at 8 m/s² up to 10 m/s (times the skater's speed). Down brakes.
- **Pump:** hold up on a slope or in a quarter-pipe's curve to gain speed, up to 12.5 m/s.
- **Steer:** 2.5 rad/s, turning the travel round the surface normal. Ride backwards and you're fakie.
- **Ollie:** 6.4 m/s up times the skater's pop. Off a slope (a kicker's lip) the pop is 45% on top of the launch.
- **Quarter-pipes:** leave the lip while still going up and you fly straight up, with your speed along the pipe kept, and come back down into it.

| Skater | Pop | Speed | Spin | Balance | Special |
| --- | --- | --- | --- | --- | --- |
| Dora | 1.08 | 1.0 | 1.12 | 0.95 | Comet Kickflip |
| Enzo | 0.97 | 1.06 | 0.95 | 1.15 | Lantern Varial |

## Tricks

| Trick | How | Points |
| --- | --- | --- |
| Ollie | Space | 50 (in a combo only) |
| Kickflip / Heelflip / Pop Shove-it | Flip, Flip + left, Flip + right | 100 |
| Impossible / Hardflip | Flip + up, Flip + down | 250 |
| Double Kickflip | a second kickflip within half a second of the air | 400 |
| Special | hold Grab and press Flip with a full star meter | 1,500 |
| Indy / Melon / Tailgrab | Grab, Grab + left, Grab + right | 120, then 260 a second held |
| Nosegrab / Stalefish | Grab + up, Grab + down | 140 (+280/s), 160 (+300/s) |
| Spin | hold left or right in the air (6.2 rad/s times the skater's spin) | 120 per half turn, +25% for each half turn past the first |
| 50-50 / Nosegrind / 5-0 / Boardslide | Grind near a rail in the air; with up, down, or left or right held | 100 (+120/s), 150 (+150/s), 150 (+150/s), 120 (+130/s) |
| Lipslide | Grind a ledge or coping going slowly along it | 160 (+160/s) |
| Manual / Nose Manual | Grind just after a landing (with up held for a nose manual) | 80, then 100 a second |
| Air | a quarter-pipe air over 0.9 s with no other trick | 150 |

Flips take 0.36–0.85 s to turn the board; land before it's round and you bail. A grab still held more than 0.25 s into the landing is a bail too. The direction held to pick a flip or a grab doesn't spin you until you let it go.

**Landing:** on the flat or a slope, the board has to point along the travel (or exactly against it, for fakie) to within 0.62 rad. Back into a quarter-pipe, the spin has to come round to a half turn within 0.62 rad; a straight air comes back fakie.

**Grinds and manuals** wobble: the balance drifts at random and leans further the longer you hold it, and every grind or manual already in the combo makes the next one wobblier (+50% each). Left and right balance a grind; up and down balance a manual. Lean past the edge and you bail. Jump off a grind with Space; press Grind again to step down from a manual.

## Combos

Everything from one take-off to rolling away on the flat is one combo, and grinds and manuals keep it going between landings. A combo pays the sum of its tricks times the number of tricks. The same trick again in one combo is worth half as much each time. After a clean landing the combo banks once you've rolled 0.45 s on the flat (time in a quarter-pipe's curve doesn't count, so you can roll out of one into a manual). A bail loses the whole combo, and after 1.4 s you're back on your feet, at the last safe spot if you fell into a hole.

Banked combos fill the star meter (up to 40 per combo, a sixtieth of its score); at 100 the special is ready.

## Gaps

A gap counts when you take off in one zone and land (or, for a grind gap, leave the named rail) in another. Its points join the combo, and it is marked done when the combo banks.

| Park | Gap | Points |
| --- | --- | --- |
| Plaza | Fountain Gap (either way), Hall Steps Gap, Hall Handrail (grind it down), Café Drop | 400, 300, 350, 250 |
| Hill | Hedge Hop, Over the Pyramid (either way), Lighthouse Drop, Long Rail (grind it, either way) | 500, 350, 300, 400 |
| Rooftops | Sky Gap, Sky Gap (back), Plank Bridge (grind it, either way), Over the Water Tower (either way) | 800, 800, 600, 450 |

## Goals

Each park has six, each from a mentor: Barnaby the badger (keeps the parks), Zip the raccoon (knows every trick), Coral the otter, or Enzo (hid the acorns).

| Park | Score | Pro | Combo | Acorns | Gap | Trick |
| --- | --- | --- | --- | --- | --- | --- |
| Plaza | 6,000 | 18,000 | 2,500 | all five | the Hall Handrail | a flip over the Fountain Gap |
| Hill | 12,000 | 30,000 | 5,000 | all five | the Hedge Hop | a grab over the Hedge Hop |
| Rooftops | 12,000 | 20,000 | 1,800 | all five | the Plank Bridge | a flip over the Sky Gap |

Golden acorns are collected within 1.1 m; some sit above quarter-pipes or rails and need a big air or a grind. A goal counts the moment it happens, and is saved when the session ends. In free skate (no clock) the score and pro goals and the best score don't count. Three goals open the Hill and eight the Rooftops. The three trick goals together bring the ending.

## Bots

`npm run bot:skate` plays four two-minute sessions per park (Dora on odd seeds, Enzo on even) with a vert skater on a quarter-pipe (on the Hill, wall to wall across the halfpipe) who pushes and pumps, throws a flip and a grab in every air, varies them, rolls out and turns back. A second version (the "linker") also manuals between airs to chain them into one combo. A third skater only pushes about. The checks: the simple skater reaches the score goal but not the pro goal, the linker reaches the pro and combo goals at its best, and pushing alone earns less than a quarter of the score goal.

Current results (averages; goals score / pro / combo):

| Park | Simple | Linker | Linker best combo | Pusher | Goals |
| --- | --- | --- | --- | --- | --- |
| Plaza | 15,656 | 21,640 | 2,477 (best 6,432) | 270 | 6,000 / 18,000 / 2,500 |
| Hill | 26,454 | 61,077 | 58,485 | 120 | 12,000 / 30,000 / 5,000 |
| Rooftops | 14,778 | 20,234 | 2,120 | 0 | 12,000 / 20,000 / 1,800 |

## Tests

- `npm run test:skate`: pushing and ollies, quarter-pipe launches and coming back down, flips, grabs and spins (and bailing each), grinds and manuals (balancing them and falling off), combos (multiplied, repeats halved, banked, lost on a bail), the holes between the rooftops, a route to every golden acorn and gap in all three parks, the session clock, goals, unlocking, the ending and saves including corrupt ones.
- `npm run bot:skate`: the sessions above.
- `node tests/e2e/skate.mjs` (dev server running): the title, the welcome, a session pushed, ollied and flipped, a grind with the balance bar and an acorn, pause, the end of a session saved, goals opening the Hill, Enzo, free skate, a corrupt save, and phones held either way with the touch controls. It uses `window.__skate().debug` to place the skater, run the clock down and grant goals.

## Save

`localStorage` key `pawpark-skate-v1`: the skater, the goals done, the best score and best combo per park, whether the welcome and the ending have been seen, settings (sound, music, camera) and stats (sessions, gaps, acorns). `parseSave` clamps every field, keeps only known goals and falls back to a new save for anything corrupt.
