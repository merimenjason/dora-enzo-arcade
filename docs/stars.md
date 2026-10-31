# Starstitch

Game 59, at `/stars`. A cosy constellation logic puzzle for one player. The old stories say the constellations come loose every autumn; Dora and Enzo lie on the hill above the burrow with Grandmother's spool of silver thread and stitch them back into the sky. Every sky is one puzzle: draw one continuous thread along every seam exactly once (an Euler trail), with new rules arriving one night at a time.

All numbers below come from `lib/stars-game.ts`, `lib/stars-puzzles.ts`, `lib/stars-solver.ts` and `app/stars/page.tsx`. Written 31-10-2026.

## Files

- `lib/stars-game.ts`: the rules. Deterministic and DOM-free: no `Math.random`, no clock. It holds the puzzle notation and parser, the nights, the stitch (`Stitch`: starting, stitching, the rules, unpicking, starting again, getting stuck, finishing), the pointer (press, drag, snap, unpick, tap), and progress and saving.
- `lib/stars-puzzles.ts`: the six nights (three lessons, then five nights) and their 43 hand-made constellations, each with its stars, seams, clouds, figure, two-line story and, the first time a rule appears, a tip.
- `lib/stars-solver.ts`: a depth-first solver with a memo of dead states, solution counting, a careless and a thoughtful simulated player (used by the tests to measure difficulty), the hints, and the generator behind the Daily Sky and the Shooting Star.
- `lib/stars-scene.ts`: Canvas 2D drawing: the night painting, the stars and their marks, the dotted seams, comets, clouds, the thread growing and blazing gold, the twin leaps, the figure painting fading in, and Dora and Enzo on the hill. It also paints the chart thumbnails.
- `app/stars/page.tsx`, `layout.tsx`, `stars.css` and `sound.ts`: the page. It handles the mouse, touch and keys, the loop, saving, the menu, the sky chart, the Night Journal, the tips, the done card and the ending. The sounds are made with WebAudio.
- `public/art/stars/`: the paintings; see [`stars-art-brief.md`](stars-art-brief.md).

## A stitch

Press on a star to start the thread there, then stitch to a star joined to the needle by a seam that still has stitches left. A seam is used up after one stitch; a double seam after two. Every stitch, unpick or refusal is an event the page turns into a sound and a message. The sky is finished when every seam is stitched and every bright star has its count. If no stitch is left and the sky is not finished, the thread is stuck, and the page says why (a loop left behind, a bright star short of touches, the full moon not reached).

The rules, each taught by a tip the first time it appears:

| Rule | First | What it does |
| --- | --- | --- |
| Odd stars | lesson 2 | Not a mark, a fact: a star with an odd number of seams must be where the thread starts or ends. |
| Bright stars | night 1 | Rays round a star (1 to 4). The thread must touch it exactly that many times; the start and the end each count as a touch. A full bright star refuses any more. |
| Knot stars | night 2 | Touched once only: the thread may pass through but never come back. |
| Double seams | night 2 | Stitched twice: there and back, or round the long way. |
| One-way seams | night 3 | A comet flies along the seam; it can only be stitched in the comet's direction. |
| Clouds | night 3 | Seams under a cloud are hidden. When the pointer or the needle comes within 15 sky units (the sky is 100 wide) of a hidden seam's middle it glimmers through, fading back over about a second once they move away. Stitched seams always show. |
| Moons | night 4 | The thread must start at the crescent moon and finish at the full moon; no other star may start it. |
| Twin stars | night 4 | Stitching into a twin lands the needle on its twin, which counts as a touch of both. A drag carries straight on: from then until the paw lets go, the pointer steers the needle from the twin (the pointer is read shifted by the leap), and dragging back the way the paw came unpicks the leap, unless that way lines up within about 30° with a star the needle could go on to, when going on wins. Unpicking undoes the leap. |

Unpicking takes off the last stitch (and a leap with it). Starting again unpicks everything. Either one, at any point, means the sky is no longer stitched "in one go".

## The pointer

The hit radius is 22 screen pixels for a mouse and 30 for a finger, never more than 48% of the gap to the nearest star, so close stars stay separate. Pressing on a star with no thread starts there; pressing on the needle picks it up; pressing on a star the needle can reach stitches it (a tap).

While dragging, the thread follows the pointer and snaps to a star when the pointer is within the hit radius of it, or when the drag is heading for it: the candidate whose direction from the needle is closest to the drag's, once the pointer is past 60% of the way along its seam and no further off the line than the hit radius or 28% of the seam's length. Up to four snaps happen in one move, so a fast drag doesn't lose stitches. Dragging back along the last stitch unpicks it, but only past 72% of the way back and within 0.8 hit radii of the thread, so brushing past the last star doesn't undo it. The keyboard cycles through the stars the needle can reach (left to right), and **Enter** stitches; after a twin's leap the star from the twin that keeps the stitch's heading is chosen already, so **Enter** carries straight on.

## Hints

Each sky has one free hint, and more come from a bank: the bank starts at 1, holds at most 5, and gains one for each story sky stitched for the first time without a hint, and each Shooting Star sky stitched without one. A hint is one of three things, worked out by the solver from the thread as it stands: where to start (a good starting star), the next stitch (one that keeps the sky solvable), or how far to unpick (the fewest stitches back to a solvable thread). Following the hints always finishes a sky.

## Nights

| Night | Name | Constellations (★ a painted figure) | Rules |
| --- | --- | --- | --- |
| Lessons | First Lessons | The Thread, The Kite, The Snail ★ | none |
| 1 | The Hill at Dusk | The Cottage, The Moth, The Spectacles, The Acorn ★, The Signpost, The Wheelbarrow, The Caterpillar, The Hare ★ | bright |
| 2 | Deep Autumn | The Mushroom, The Pinecone, The Conker, The Lantern ★, The Hoe, The Ladder, The Cartwheel, The Sleeping Fox ★ | + knot, double |
| 3 | Frost and Aurora | The Icicle, The Snowflake, The Sledge, The Owl ★, The Mitten, The Pine Tree, The Skater, The Stag ★ | + one-way, cloud |
| 4 | The Moonlit Lake | The Rowing Boat, The Lily Pad, The Dragonfly, The Leaping Trout ★, The Reeds, The Water Wheel, The Ripples, The Heron ★ | + moon, twin |
| 5 | The Meteor Shower | The Comet, The Bell, The Kite on the Wind, The Teapot ★, The Harp, The Burrow Door, The Shooting Star, The Two Chinchillas ★ | all |

Within a night the skies open one at a time. Night 1 is open from the start (the lessons can be skipped); each later night opens when the one before is finished. The Two Chinchillas, the last sky of night 5, plays the ending, a painted last page of the Night Journal; after it the Daily Sky and the Shooting Star open.

The engine tests hold every sky to these: 4 to 21 stars inside a 100 × 80 sky, stars at least 9 apart, no seam passing within 4 of a star it doesn't join, every cloud hiding a seam, at least one solution, and from the third sky of each night either two or more solutions or a careless thread that gets stuck at least half the time.

## Difficulty

Measured by the bot (`npm run bot:stars`) over 300 tries a sky. A careless player starts anywhere and stitches any seam it can; a thoughtful one starts on an odd star or the crescent moon and never stitches a seam that cuts the remaining seams in two.

| Night | Careless finishes | Thoughtful finishes in one go |
| --- | --- | --- |
| Lessons | 30% | 100% |
| 1 | 17% | 75% |
| 2 | 16% | 79% |
| 3 | 9% | 51% |
| 4 | 18% | 70% |
| 5 | 19% | 78% |

The moons fix where the thread starts and ends, which takes away the commonest mistake, so night 4 leans on the earlier rules and on loops to leave behind: the Rowing Boat's oar blades, the Lily Pad's bud and the Reeds' leaves are loops hanging off a single star, two comets turn the Water Wheel's rim the same way, and comets cross the Lily Pad, the Leaping Trout, the Reeds and the Heron. It was retuned on 31-10-2026 from careless 41% and thoughtful 94%, a dip below both its neighbours; the Rowing Boat still teaches the moons on their own. Within the night the skies grow harder (thoughtful finishes 100%, 71%, 100% for the Dragonfly, which teaches twins, then 68%, 68%, 53%, 53% and 45%). By these numbers the frosty night 3 is still the hardest of the five. The bot holds night 4 to under 25% careless finishes and no more thoughtful ones than night 5.

## Daily Sky and Shooting Star

Both use the generator in `lib/stars-solver.ts`. It scatters stars, joins neighbours with seams that don't cross, walks a random thread through them and keeps the walked seams, so every generated sky is solvable by construction; rules are then added to agree with the walk (bright counts from the walk's touches, one-ways in the walk's direction, knots on stars it passed once, moons on its ends), and of 40 attempts the one closest to the wanted difficulty is kept.

- **Daily Sky**: seeded from the date (read after the page mounts), so everyone gets the same sky each day. 9 to 13 stars and up to three rules from bright, knot, double, one-way, cloud and moon. Stitching it on consecutive days builds a streak.
- **Shooting Star**: endless skies seeded by their number. Sky *n* has min(18, 5 + 0.8 *n*) stars; a new rule unlocks every two skies (bright, double, one-way, knot, cloud, moon) and up to 1 + *n*/6 of them appear.

## Feel

Each stitch plays a soft plink one step up a pentatonic scale; unpicking a falling pluck; a twin's leap a shimmer; a refused stitch a soft bump; finishing a chord (a brighter one for the ★). The finished thread blazes gold over 2.2 seconds while the figure painting fades in behind it, and the done card follows after 1.5 seconds and makes room for itself, so it covers neither Dora and Enzo nor a star: on a big wide screen (at least 521 pixels tall) it sits above the pair, beside the sky; on a shorter or squarish wide screen (a phone held sideways) it sits on the right and the sky moves in between; on a phone held upright Dora and Enzo settle on the hill where the tools were, the card sits just above them and the sky above the card. The sky and the pair glide to their new places over 0.6 seconds, and the stitching tools hide while the card is up. Dora and Enzo lie on the hill in the corner: pointing up while you stitch, gasping when the sky blazes, and sleepy in the small hours.

## Saving

Progress is saved in `localStorage` under `starstitch-v1`: the skies stitched (and whether each won its ★ and used a hint), the hint bank, the tips seen, whether the ending has been seen, the Daily Sky (the last day, the streak and the days done), the Shooting Star (the next sky and the best) and the Sound and Music settings. Reading is defensive: unknown skies and malformed values are dropped, a sky whose predecessor in its night isn't stitched is dropped, the bank is clamped to 0 to 5, and anything that isn't a version-1 save starts fresh.
