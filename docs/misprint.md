# Misprint (`/misprint`)

A cosy, turn-based two-ink puzzle printed like a risograph zine. Dora is printed on the **pink** plate and Enzo on the
**teal** plate. Each plate can be slid one cell at a time, so the two prints drift out of register, and that drift is
the puzzle. Three zines of ten pages each.

Code: `lib/misprint-game.ts` (rules, solver, save), `lib/misprint-levels.ts` (the thirty pages),
`lib/misprint-scene.ts` (Canvas 2D drawing), `app/misprint/page.tsx` (screens, input, saving), `app/misprint/sound.ts`
(Web Audio music and effects), `app/misprint/misprint.css` (all classes prefixed `mp-`).

## Rules

- **Who stands on what.** Pink ink holds Dora, teal ink holds Enzo, and purple (where pink and teal overlap) holds
  both. The yellow key plate holds both. The other chinchilla's ink is a ghost: you walk and fall straight through it.
  The two chinchillas are solid to each other.
- **Walking.** ◀ ▶ walk one cell. A step up of one cell is climbed automatically, onto ink, yellow or your partner's
  head (never over a fold). Gravity pulls a chinchilla down until something holds them.
- **Nobody falls off the page.** A walk or a shift that would drop a chinchilla out of the bottom of the page is refused
  ("would fall off the page"). This was a choice: falling off would only ever mean pressing Undo, so the game refuses it
  outright and says why.
- **Shifting.** A shift slides the active chinchilla's whole plate one cell, with them on it. It is refused, with a
  wobble and a thunk, when:
  - any of the plate's ink would leave the paper (**edge**). Registration marks (⊕) are ink on the plate too, so they
    are how a page limits how far a plate may slide. Marks hold nobody;
  - a chinchilla would be pushed into something solid (**blocked**);
  - the move would drop someone off the page (**fall**), or print ink on top of someone (**embed**).
- **Riding.** A chinchilla standing on their partner's head rides along when the partner walks, climbs or shifts. If the
  rider can't move with them, a sideways move leaves the rider behind; an upward move is refused.
- **Switching** (Tab / Q, the face button, or a tap on the other chinchilla) is free. Every other successful move counts.
- **Finishing.** Both chinchillas on the staple at once.

### Later ideas, each introduced on its own page

| Idea | First page | What it does |
| --- | --- | --- |
| Key plate (yellow) | Night Market Flyer 1, *Key Plate* | Printed first, never moves, holds both. |
| Stamps | Night Market Flyer 5, *Rubber Stamp* | While anyone stands on a pink stamp, the teal plate's dotted (hidden) cells are printed, and the other way round. A stamp moves with its plate. Pressing a stamp that would print ink on someone is refused. |
| Folds | Summit Poster 1, *Fold Here* | One-way paper flaps fixed to the page. You can pass in the direction of the arrow but not against it, so an up-fold is a floor from above. |
| Ladders | Summit Poster 5, *Rope Ladder* | Printed in ink: only their owner can climb them (W/S or ▲▼ Climb). A passenger on the climber's head comes along. |

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Walk | ← → or A / D | ◀ Walk / ▶ Walk |
| Climb a ladder | ↑ ↓ or W / S | ▲ / ▼ Climb (shown on ladder pages) |
| Switch | Tab or Q | the face button, or tap the other chinchilla |
| Shift the active plate | Shift + arrows or Shift + WASD | the Shift cross (labelled with the plate's colour) |
| Undo / Restart / Hint | Z / R / H | Undo / Restart / Hint |
| Next page (when done) | Enter | Next page |
| Back to the contact sheet | Escape | ← Pages |

Undo is unlimited, and Restart can itself be undone. **Hint** lights up the button for the next move of an optimal
solution from where you are (or says there is no way from here); hints are counted but never block stars.

## Stars, pars and unlocking

Each page has three stars: finished, finished at or under par, and the ink drop collected. Stars are kept across runs.
The first zine is open; each later zine opens once the one before has 7 pages done. Within a zine, a page opens once
you are no more than two pages ahead of what you have finished. **Peek ahead** in Settings opens everything.

Pars are the solver's optimum plus about 15% (always at least the optimum and at most 30% over it):

| Page | Name | Optimal | Par | Optimal with ink drop |
| --- | --- | --- | --- | --- |
| Burrow Gazette 1 | First Proof | 10 | 12 | 10 |
| 2 | Two Inks | 17 | 20 | 19 |
| 3 | Slide the Pink | 7 | 9 | 11 |
| 4 | Meet in the Middle | 12 | 14 | 14 |
| 5 | Lend a Back | 16 | 19 | 20 |
| 6 | Piggyback Lift | 11 | 13 | 14 |
| 7 | Bridge of Fur | 18 | 21 | 20 |
| 8 | Edge of the Paper | 10 | 12 | 14 |
| 9 | Crane | 13 | 15 | 15 |
| 10 | Front Page | 15 | 18 | 19 |
| Night Market Flyer 1 | Key Plate | 10 | 12 | 14 |
| 2 | Hold Still | 16 | 19 | 20 |
| 3 | Low Beam | 14 | 17 | 18 |
| 4 | Night Bus | 15 | 18 | 19 |
| 5 | Rubber Stamp | 13 | 15 | 19 |
| 6 | Take Turns | 20 | 23 | 22 |
| 7 | Stamp and Carry | 13 | 15 | 16 |
| 8 | Noodle Queue | 14 | 17 | 18 |
| 9 | Lantern Lift | 15 | 18 | 19 |
| 10 | Last Orders | 17 | 20 | 21 |
| Summit Poster 1 | Fold Here | 7 | 9 | 10 |
| 2 | Switchback | 12 | 14 | 16 |
| 3 | Cloud Shelf | 14 | 17 | 18 |
| 4 | Wind Gap | 14 | 17 | 17 |
| 5 | Rope Ladder | 9 | 11 | 13 |
| 6 | Base Camp | 11 | 13 | 14 |
| 7 | Scree | 13 | 15 | 17 |
| 8 | Ice Bridge | 23 | 27 | 27 |
| 9 | Condor Ledge | 15 | 18 | 18 |
| 10 | The Summit | 25 | 29 | 29 |

`node tests/misprint.mjs` prints this table from the solver and fails if a par drifts out of range.

## Designing a page

Pages are text maps in `lib/misprint-levels.ts`; the legend is at the top of that file. The solver
(`solve()` in `lib/misprint-game.ts`) is a Dijkstra search over (positions, plate offsets, active chinchilla, ink drop)
that finds the fewest moves, then the fewest switches. Its options switch rules off (`noShift`, `noRide`, `noYellow`,
`noStamp`, `noFold`, `noLadder`) or restrict play to one chinchilla (`only`). The tests use these to check that every
page needs both chinchillas (unless it is a tutorial marked `solo`) and that each introduction page needs its idea.

## Save

`localStorage` key `misprint-v1`: `{ v: 1, pages: { [id]: { best, drop, hints } }, settings: { sound, music, peek,
motion }, seenIntro, ended }`. `parseSave` validates every field; anything unreadable starts a fresh save, and bad
records are dropped one by one.

## Testing

- `node tests/misprint.mjs`: the rules (solidity, ghost ink, marks, gravity, ledges, all four refusals, riding and the
  scoop, stamps, folds, ladders), undo and restart, every page against the solver (solvable, par range, at most 40
  moves, ink drop reachable, idea needed, not solvable by one chinchilla), stars, unlocking, the save and corrupt saves.
- `node tests/misprint-bot.mjs --quick`: a human-ish bot (hint 60% of presses, otherwise a random move or an undo) must
  finish every Burrow Gazette page with 8 seeds inside 400 presses; it also reports a shyer 30% hint player and pure
  random play on page 1.
- `node tests/e2e/misprint.mjs` (dev server running): every action through the real buttons and keys, the shelf and
  contact-sheet locks, settings, mute, the save across a reload, a corrupt save, the reward print, and phone landscape
  (844×390) and portrait (390×844) without sideways scrolling or page errors.

Compile the engine first: `npx tsc lib/misprint-game.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck`.

The page exposes `window.__misprint()` for the browser tests and marks `main[data-ready="true"]` once the art has
loaded.

## Art

Everything is painted with Codex in a risograph style: the title poster, three zine covers, three reward prints, a
pink-only Dora sheet and a teal-only Enzo sheet (idle, two walk frames, fall, cheer, push), a paper texture and a tile
sheet (three block textures, ladder, staple, ink drop, stamp, fold flap). `scripts/misprint-art.py <folder of
paintings>` turns them into `public/art/misprint/*.webp` (about 2.8 MB): it resizes the paintings, makes the paper tile
seamless, and keys the single-ink sprite and tile sheets to alpha masks that the scene tints with each plate's ink.

The scene prints each plate into its own offscreen canvas (ink texture, halftone dot shadow, grain and uneven density),
composites the plates onto the paper with `multiply`, turns the pink-teal overlap purple, and offsets each plate by a
couple of pixels so the print is visibly out of register. A shift smears the plate as it slides; a refused shift
wobbles it. Dora wears an aviator cap and goggles, Enzo headphones.
