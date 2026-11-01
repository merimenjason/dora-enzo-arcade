# Kite Day

Game 68, at `/kite`. A side-on kite-flying game for one player, painted like a loose watercolour and gouache picture book. Dora or Enzo holds the reel; you pull, ease and steer the kite through a summer of six places, from the first wobbly flight in Clover Meadow to the Kite Festival on the cliffs.

All numbers below come from `lib/kite-world.ts`, `lib/kite-levels.ts` and `lib/kite-game.ts`. Written 01-11-2026.

## Files

- `lib/kite-world.ts`: the six places (ground, water, trees, buildings, thermals, cliff updrafts) and the wind: seeded smooth noise that travels downwind, so a seed always blows the same gusts and lulls. Deterministic and DOM-free.
- `lib/kite-levels.ts`: the 24 challenges, four in each place, with their targets, medal marks and awards.
- `lib/kite-game.ts`: the rules: the six kite shapes, the tethered kite's physics, stalls and tumbles, landing and reeling in, the trick reader, the duel rival and the finale partner, medals, unlocking and the save format.
- `lib/kite-scene.ts`: the Canvas 2D scene: the place painting, the ground, trees, buildings, water, thermals and rotors painted in code, the targets, the line, the kites and their tails, the chinchilla cut-outs, the wind (dandelion seeds, bending grass, cloud streaks), effects and the camera.
- `app/kite/page.tsx`, `layout.tsx`, `kite.css` and `sound.ts`: the page. It handles the menu, the summer map, each place, the workshop, the play screen, results and the ending, the mouse, keyboard and touch, the fixed-step loop, saving and the WebAudio sound and music.
- `tests/kite.mjs`, `tests/kite-bot.mjs` and `tests/e2e/kite.mjs`: the tests.
- `public/art/kite/`: the paintings (brief in [`kite-art-brief.md`](kite-art-brief.md)).

## Flying

The wind blows from left to right, so the kite flies to the right of its flier. The engine steps at 60 Hz (four substeps each) and works in metres and seconds.

- **The line.** It runs from the paws (1.1 m above the ground) to the kite, between 4 m and the kite's longest line (26 to 32 m). **Pull** reels in at 3.4 m/s and, because pulling moves the paws against the wind, also adds 3.4 m/s of air over the sail: the kite speeds up and climbs. **Ease** lets the line run out at 1.4 m/s plus a little more the harder the kite pulls, up to 4.5 m/s. With neither, the reel holds (it only slips if the kite pulls with more than 40 N).
- **Power and the wind window.** On a tight line the sail turns the wind's share along the line into drive along its nose, so the kite pulls hardest low in the middle of the window and hardly at all straight overhead, where it parks and floats. A real line stretches and sags a little (3.5 m of give), so a nearly tight line still carries some pull.
- **Steering.** The pointer (or a finger) is where you want the kite to go: on a tight line the nose leans along the line's arc toward it, and you pull or ease to bring the line to the right length. **←** and **→** turn the nose directly. Hands off, the bridle holds the nose along the arc and the kite settles at the top of the window. Turning is quicker in faster air.
- **Stalls and tumbles.** A slack line in slow air (under 2.6 m/s of airflow for 0.7 seconds) and the kite stalls and tumbles. It recovers when the line is tight and pulling again for 0.3 seconds, so pull to recover. Touching the ground, the water, a tree's leaves or a roof brings it down; after 0.9 seconds it is reeled back to the paws (faster while you pull) and relaunched as soon as there is a breeze.
- **Walking.** **A** and **D** (or the ◀ ▶ buttons) walk at 2.4 m/s within each place's patch, to bring far targets within reach of the line.

## The kites

| Kite | How it flies | Earned by |
| --- | --- | --- |
| Diamond | The classic: steady, easy to steer, happy in most winds. | Yours from the start |
| Sled | Very light and floaty: flies in the lightest breeze, turns lazily, longest line (32 m). | Clover Rings |
| Delta | Little drag: the fastest kite across the wind. | Between the Boughs |
| Box | Heaviest and steadiest, lots of drag: shrugs off gusts, loves strong wind. | Figure-Eights |
| Swallow | A bird-shaped stunt kite that turns fastest of all (6.2 against the diamond's 3.6), nervy in gusts. | Hang Time |
| Dragon | A long ribbon tail (5.2 m) makes it very steady, and gives duels a streamer to aim at. | Rooftop Post |

The workshop paints any kite you own: ten gouache colours for the sail, the stencil and the tail, and nine stencils. Plain and stripes and dots are there from the start; sun, leaf, waves, feather, star and heart come with the first medal in the meadow, orchard, beach, downs, fête and cliffs.

## The wind

Each place has a mean speed ten metres up, slower near the ground. Gusts (up to 16 to 34 per cent stronger) and lulls (the wind dropping by up to 25 to 55 per cent for a few seconds) travel downwind at the wind's speed, so you can see them coming: the grass darkens and bends harder as a gust runs through it, the dandelion seeds and their streaks speed up, the clouds stream faster, and the **wind ribbon** in the corner shows the next ten seconds of wind reaching the paws (upwind on the left, now on the right; dark bars are gusts, pale ones lulls). Behind trees and buildings the air is slowed by half and tumbles in a rotor for about two and a half times their height downwind, drawn as faint curling strokes. Thermals over the warm fields of the High Downs rise at 3.2 to 4.2 m/s, breathing on and off over 18 to 26 seconds and shown as shimmering columns. At the Festival Cliffs the sea breeze lifts 3 m/s where it meets the cliff edge.

| Place | Wind | What to learn |
| --- | --- | --- |
| Clover Meadow | 5.4 m/s, steady | Pull, ease and steer; tricks |
| Apple Orchard | 5.8 m/s, rotors behind the trees | Coming in over the leaves; parcels |
| Breezy Beach | 8.2 m/s, strong gusts and deep lulls | Easing in gusts, pulling in lulls |
| High Downs | 4.4 m/s, light, with thermals | Riding rising air; holding height |
| Village Fête | 6 m/s, rolling over the roofs | Rooftops and bubbles |
| Festival Cliffs | 6.4 m/s, cliff updraft | Duels and the finale |

## Tricks

The trick reader follows the kite's nose. A **loop** is a full turn of the nose one way (within a little wobble) while the kite moves at least 2.2 m/s through a space at least 1.6 m across; 0.8 seconds without steering resets it: 100 points. A loop one way and then, within 4 seconds, a loop the other way is a **figure-eight**: 250. A **swoop** is a dive from over 9 m above the ground to under 2.4 m at more than 7 m/s and back up over 5 m within 3.5 seconds: 150. Tricks within 3 seconds of each other chain: each one in a chain scores ×1.5, ×2, ×2.5, up to ×3.

## The summer

Four challenges in each place; each opens when the one before it has a medal, and a place opens when the place before it has all but one of its challenges done. The cliffs need every place nearly done, and the finale needs both duels and the Updraft Rings. Medal marks come from the bot's runs (see Tests).

| Place | Challenges |
| --- | --- |
| Clover Meadow | First Flight (3 big rings), Clover Rings (6 rings; wins the sled), Loop the Loop (45 s of tricks), Dandelion Clocks (pop 8 drifting puffs) |
| Apple Orchard | Parcel Post (2 parcels to treehouse baskets), Between the Boughs (5 rings over the trees; wins the delta), Dragonfly Dash (race a dragonfly through 6 gates), The Big Delivery (3 parcels, one far down the row) |
| Breezy Beach | Sea Wind Rings (5 rings in a gusty sea wind), Figure-Eights (wins the box), Hold Steady (40 s: stay in the sunny circle), Dune Dragonfly (7 gates) |
| High Downs | Balloons Aloft (pop 5 high balloons on thermals), Hang Time (45 s: stay in the high circle; wins the swallow), Sky Show (50 s of chained tricks), Cloud Rings (5 climbing rings) |
| Village Fête | Bubble Fair (pop 10 drifting bubbles), Rooftop Post (3 parcels over the roofs; wins the dragon), Bunting Run (7 bunting gates), Show for the Fête (50 s of tricks) |
| Festival Cliffs | Updraft Rings (6 rings toward the edge), Duel: Saffron the stoat, Duel: Old Burdock the badger, The Festival Finale |

- **Parcels** hang under the kite; each adds 35 g and some drag. Dip the kite to a basket (within a metre) to drop one.
- **Races**: the dragonfly flies the gates at 3.4 or 4.2 m/s. Beat it to the last gate for bronze; silver and gold are faster times.
- **Hold** challenges count the seconds the kite is inside the circle.
- **Duels**: touch the rival's tail streamer with your kite three times before they touch yours. Crossed lines for 1.6 seconds tangle, and both kites come down to be reeled in (nobody scores). After scoring, the rival backs off for 3 seconds. Gold is winning without a touch against you, silver 3–1, bronze any win.
- **The Festival Finale**: Dora and Enzo fly together, the partner in formation a little behind and below. Sixteen gates come on the beat every 3.6 seconds: being there within 1.4 seconds of the beat scores 100, within 0.45 seconds 150, with 30 more if the partner is close; three are loop cues, where a loop near the beat scores 200.

Winning the finale the first time shows the ending: the festival at sunset.

## Controls

- **Mouse**: the pointer is where the kite flies; hold the left button to pull, the right button to ease.
- **Keyboard**: **Space**, **↑** or **W** pull; **Shift**, **↓** or **S** ease; **←** and **→** turn the nose; **A** and **D** walk; **Esc** or **P** pauses; **R** tries again from the results.
- **Touch**: drag a finger in the sky to steer; hold **Pull** and **Ease**; ◀ ▶ walk. Phones work held either way.

## Saving

Progress is saved in `localStorage` under `kite-day-v1`: the best result and medal for each challenge, the paint on each kite, the kite and flier chosen, whether the ending has been seen, and the Sound and Music settings. A save that does not parse, or has another version, is ignored; anything out of range (a medal above gold, a negative time, an unknown stencil, a kite not yet earned) is dropped.

## Tests

- `npm run test:kite`: the engine: the line never stretches and nothing goes non-finite in any place with any kite under random inputs; a hands-off kite keeps flying; pulling and easing; the wind window; stalls, tumbles and still air; landing in the pond and being reeled in; the kites' differences (turning, steadiness, speed, light-wind height); trick detection; rings in order; parcels; races; tangles and touches; the finale's beats; determinism; the wind's gusts, lulls, thermals and shelter; medals, unlocking and saves (corrupt ones included).
- `npm run bot:kite`: a careful flier with a human's reaction time (it sees the sky a fifth of a second late, decides six times a second and wobbles its aim) clears every challenge with the suggested kite in at least two of three runs, and its best run reaches silver or gold; a flier who does nothing, and one who holds the pull and points straight at everything, fail nearly all of them. `npm test` runs it with `--quick` (two runs, one win needed). `--calibrate` prints suggested marks.
- `npm run test:e2e:kite`: the browser: the menu and map, First Flight flown to the finish with the real mouse, the keyboard, pausing, the medal across a reload, corrupt saves, the framing at 1280×800 and 1920×1080 and phones held either way, flown by touch.
