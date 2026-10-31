# Powder Paws

Written 01-11-2026.

Game 66, at `/powder`. A top-down downhill skiing game in crisp pixel art. Dora and Enzo ski Whiskerpeak, a mountain that never runs out, racing a snowstorm down toward the lodge. One of them skis (you choose who); the other follows a short way behind on the same line and cheers every clean trick.

## Files

- `lib/powder-world.ts`: the mountain. Chunks of 480 pixels (ten pixels to a metre), each generated from its own seed, the clear line, the zones, the cabins, the slalom courses and the Big Air park.
- `lib/powder-game.ts`: the rules. Physics on a fixed 60 Hz step, collisions, tricks, the storm, scoring, medals, gear and the save.
- `lib/powder-art.ts`: every sprite, drawn pixel by pixel into a colour grid with an automatic one-pixel outline.
- `lib/powder-scene.ts`: Canvas 2D drawing into a low-resolution buffer that is scaled up by a whole number.
- `app/powder/page.tsx`, `powder.css`, `sound.ts`: the page, the pixel UI and the WebAudio sounds and chiptune music.
- `tests/powder.mjs`, `tests/powder-bot.mjs`, `tests/e2e/powder.mjs`: engine checks, bots and the browser suite.

## The skiing

The skis point one way (the heading) and the skier travels another (the line). Steering turns the heading at 3.4 radians a second (2.1 in a tuck, 4.2 in a snowplough, 5 when nearly stopped); the line follows the skis at a rate set by the grip: 8.5 on snow, 11 in powder, 12 while braking and only 1.7 on ice, so on ice you slide. Every bit the line turns costs 20% of that fraction of your speed (6% on ice), which is the carve bleed: hard turns slow you.

Gravity pulls 165 px/s² times the pitch along the line's downhill component, so straight down is fastest and across the slope gravity does nothing. The pitch drifts between about 0.76 and 1.36 down the mountain. Friction is 22 px/s² on snow, 6 on ice and 115 in deep powder, the snowplough adds 380 (120 on ice), and air drag is 0.0045 v² (0.003 in a tuck). That tops out near 175 px/s (63 km/h) on an ordinary pitch and about 215 px/s in a tuck. Nearly stopped and facing across, holding that way shuffles you sideways.

Moguls throw a small hop every 34 pixels at speed (no tricks on a hop). Snowbanks halve your speed with a puff of snow. Gate poles cost 15% with a clack. Trees, rocks, stumps, fences, huts, cabins, the animals and the deep woods past the edge forest knock you into a tumble: a rolling snowball for 1.25 seconds, then half a second sitting up dazed, then you set off again facing downhill with a second of grace.

## Jumps and tricks

Crossing a ramp's lip with the skis within 72 degrees of downhill launches you: a kicker at 45 + 0.5 × speed px/s upward (at most 180), a big ramp at 90 + 0.8 × speed (at most 300), against 330 px/s² of gravity, so up to about a second and nearly two seconds of air. In the air:

- left or right spins at 560 degrees a second (Twirl 180 to Twirl 1260, 100 to 1,400 points);
- up flips at 430 degrees a second (Snowball Flip 500, Double Snowball 1,300);
- down grabs the tail (from a quarter of a second: Tail Tap, Tail Grab, Long Tail Grab; 150 points plus 250 a second).

Combining kinds multiplies by 1.25 for each extra kind, and big ramps by 1.2. Land with the spin within 50 degrees of a whole turn and the flip within 55 for a clean landing (a small speed boost, the full points, and the storm blown back by 30 pixels plus an eighth of the points). Up to 80 and 85 degrees is a wobbly landing: half points and 40% of your speed lost. Past that, or still holding the grab, is a wipeout.

## The storm

In Freeride and the Daily Mountain the storm front starts 420 pixels behind and, after a second and a half, follows at 100 px/s plus 0.03 for every metre skied, up to 178. It is never more than 900 pixels behind. When it reaches you the run ends and the pair shelter in the nearest cabin with a cocoa. Closer than 260 pixels the screen starts to white out at the edges and the storm bar in the bar flashes red.

## The mountain

Each chunk picks a zone (open groomer, forest, mogul field, frozen ponds, jump park, village with huts and a fence, deep powder) weighted toward forest the further you go, and its density rises over the first 45 chunks (about 2 km). A winding clear line (a sum of three slow sines, never steeper than 45 degrees) runs down every mountain, and nothing solid is placed within 24 pixels of it, below a ramp's landing, or on top of anything else; fences leave a gap where the line crosses. So there is always a way through, which `tests/powder.mjs` checks with a path search over 840 chunks of 12 seeds, every slalom course and the park.

Ten hidden cabins stand in clearings off the edge of the piste at 260, 620, 1,020, 1,460, 1,940, 2,460, 3,020, 3,620, 4,260 and 4,940 metres, on a side chosen by the seed, with a wooden sign 25 metres before the gap in the trees. Ski onto a cabin's porch for its postcard. All ten open the lodge party, the ending.

Moving things: marmots and stoats ski down in lazy zigzags, rabbits toboggan across the slope and bounce off its edges, and hedgehogs drift down on tea trays. All are slower than you, and all face the way they move.

## Modes

- **Freeride**: endless, a new mountain each run; score is metres plus trick points. Best distance and best trick points are saved.
- **Daily Mountain**: the same for everyone on a given day (the seed comes from the date, read after the page mounts); the day's best score is saved for the last 30 days.
- **Slalom**: six courses (6 to 10 chunks, gates 54 to 70 pixels wide, swinging 60 to 120 pixels). A missed gate adds 5 seconds; more than two misses means no medal.
- **Big Air**: a nine-chunk jump park with kickers and big ramps; score is trick points.

## Difficulty, from the bots

`tests/powder-bot.mjs` plays with a steering bot that looks a second ahead, simulates each candidate heading with the real turning rate, and acts on what it saw a reaction time ago with a wobble in its aim. In the air it plans a spin, flip or grab for the airtime it guesses and lets go with a timing error. Three players: careless (0.55 s reaction, big wobble, never brakes or tricks), human-like (0.25 s, small wobble) and good (0.12 s, steady, bolder tricks).

Typical results over 24 seeds: careless about 500 metres, human-like about 1,850 metres, good about 4,000 metres. The storm numbers above were set so these land there. Slalom gold is the good bot's median time, silver 1.06 × and bronze 1.35 × the human-like bot's median. Big Air gold is 95% of the good bot's median score, silver 95% and bronze half of the human-like median:

| Course | Gold | Silver | Bronze |
| --- | --- | --- | --- |
| Nursery Gates | 22 s | 31 s | 40 s |
| Birchwood Bends | 33 s | 44 s | 56 s |
| Icicle Run | 30 s | 41 s | 52 s |
| The Corkscrew | 39 s | 46 s | 59 s |
| Hedgehog Hollow | 38 s | 55 s | 70 s |
| Whiskerpeak Cup | 46 s | 69 s | 88 s |
| Big Air | 3,000 | 1,400 | 800 |

## Gear

Cosmetic only: five scarves, four hats (bare head, knitted beanie, snow goggles, racing helmet, all close to the head) and four pairs of skis, unlocked by postcards (2, 5, all 10), distance (1,000 m in one run), a first clean trick, slalom medals (any medal, three golds, gold on every course) and 3,000 in Big Air. Each chinchilla keeps their own outfit.

## Save

`localStorage` key `powder-paws-v1`: who skis, best distances and scores, slalom times and medals, the Big Air medal, postcards, gear, tips seen and the sound settings. `readSave` ignores anything it doesn't recognise, so a corrupt save falls back to a fresh one without crashing.
