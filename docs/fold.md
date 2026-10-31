# Paperfold

An origami folding puzzle at `/fold`, game 62 of the arcade, in a new cut-paper art style. A gust has scattered the pages of the valley's paper-lantern festival book, and Dora and Enzo fold sheets of coloured paper to make the lanterns, boats, cranes and stars the festival needs.

All numbers below come from `lib/fold-game.ts`, `lib/fold-levels.ts` and `app/fold/page.tsx`. Written 31-10-2026; the puzzles were deepened the same day.

## Files

- `lib/fold-game.ts`: the rules. Sheets, layered folding, holes, tape and creases, the picture and the match, the exhaustive solver behind the hints and the tests, seals, unlocking and the save. Deterministic, no DOM; the only randomness (for the look of the paper) is a seeded generator.
- `lib/fold-levels.ts`: the five chapters and forty pages, each a sheet written as text with its designed solution.
- `tests/fold.mjs` also holds a plain breadth-first search over whole paper states, the reference the solver is checked against.
- `lib/fold-scene.ts`: the drawing (Canvas 2D): the folding table, the paper with grain, layered edges, holes, tape and creases, the fold turning over in perspective with its shadow, the hover preview and hint, the target card, confetti, Dora and Enzo, and the festival.
- `app/fold/page.tsx`, `fold.css`, `sound.ts`, `layout.tsx`: the page (menu, book, table, festival, ending), input, saving and the HUD; the sounds and music are made with WebAudio.
- `tests/fold.mjs`, `tests/fold-bot.mjs`, `tests/fold-solutions.json`, `tests/e2e/fold.mjs`: engine checks, the solver bot and its recorded solutions, and the browser suite.
- Paintings in `public/art/fold/`, briefed in [`fold-art-brief.md`](fold-art-brief.md).

## The rules

- A sheet is a set of grid squares. Each square has a front and a back face, each a colour and maybe a printed mark (star, window, moon, ribbon, flower, wave, eye, heart, sun, leaf, flame or dot). A square can be punched with a hole.
- The paper on the table is a stack of layers at each grid position, bottom to top; each layer remembers which face is up. After every fold the paper is shifted so its top-left is at 0,0.
- A fold is a full grid line that crosses the paper (x = 1 … width − 1, or y = 1 … height − 1) and the side that lifts. Every position on that side is mirrored across the line; its stack is reversed and every face flipped, and it lands on top of whatever is there (a valley fold). A fold never makes the paper bigger; a longer flap simply folds out past the shorter side.
- **Holes:** the top of a stack is the highest face that isn't punched; punched layers above it are drawn as frames around a round hole. A stack of only punched squares shows the table.
- **Tape** joins two neighbouring squares. A fold is refused when the two would land on different sides of its line.
- **Creases** sit between two neighbouring squares and are a valley or a mountain as seen on the front. A fold whose line parts creased squares follows the crease as seen from above (a mountain on paper lying face down is a valley): a mountain fold tucks the flap underneath instead of on top. Creases along one line that disagree block it until a fold turns one of them over so that they agree. Plain lines always fold over. A valley crease on paper lying face up folds over like a plain line, so a valley matters when its paper has been turned face down (it tucks behind) or when it shares a line with a mountain (it locks the line).
- **The match:** the picture from above (the outline and the colour and mark on top of each position) must equal the target exactly. Every target is the picture the page's designed solution makes, so it is always reachable.

## Seals, hints and unlocking

- Par is the designed solution's length, and the bot proves it is the minimum. The fold count includes undone folds and resets to zero with Reset. Gold seal: folds ≤ par. Silver: ≤ par + 2. Paper seal: any finish. The best seal and fewest folds are kept.
- The Hint button appears after a reset or once the count passes par. It runs the solver from the paper as it lies, with no depth limit, and shows the first fold of a shortest way in pulsing yellow; if the target can no longer be reached it says so. On the 6 × 6 finale a hint takes at most about a tenth of a second.
- Pages in an open chapter open two ahead of the folded ones; a chapter's eighth page (the showpiece) opens when the other seven are folded; a chapter opens when six pages of the one before are folded. Folding the final page, Festival Night, shows the ending.

## The pages

Size is width × height of the sheet. Solutions use `x2>` for "the part left of x = 2 folds right", `x2<` for the part right of it folding left, `y1v` for the part above y = 1 folding down and `y1^` for the part below it folding up.

| Page | Name | Size | Constraints | Par | Designed solution |
| --- | --- | --- | --- | --- | --- |
| l1 | First Fold | 2×1 | – | 1 | `x1<` |
| l2 | Corner to Corner | 2×2 | – | 2 | `x1< y1^` |
| l3 | Paper Strip | 3×1 | – | 2 | `x1< x1>` |
| l4 | Two Windows | 3×2 | – | 2 | `x1< y1v` |
| l5 | Long Lantern | 4×2 | – | 3 | `y1^ x3> x2<` |
| l6 | Striped Lantern | 4×2 | – | 3 | `y1v x1< x1>` |
| l7 | Lantern Window | 3×3 | – | 3 | `x1< y1v x1>` |
| l8 | The Great Lantern | 4×3 | – | 3 | `x3> x2< y1^` |
| b1 | Little Hull | 3×2 | notched | 2 | `x1< x1>` |
| b2 | Corner Sheet | 2×2 | notched | 2 | `x1> y1v` |
| b3 | Sailcloth | 3×2 | notched | 2 | `x2< y1v` |
| b4 | Long Keel | 4×2 | – | 3 | `x1< y1v x1<` |
| b5 | Two-Tone Raft | 4×2 | notched | 3 | `x3< x2> y1v` |
| b6 | Mast and Sail | 4×3 | notched | 3 | `x3> y2v x1<` |
| b7 | Duck Boat | 4×2 | notched | 3 | `x3> x2> y1v` |
| b8 | The Festival Barge | 4×3 | notched | 3 | `x1< x2< y2^` |
| c1 | Peephole | 2×1 | holes | 1 | `x1>` |
| c2 | Wing Tips | 4×1 | holes | 2 | `x1< x2<` |
| c3 | Window Bird | 2×2 | holes | 2 | `x1> y1^` |
| c4 | Long Neck | 3×2 | holes | 2 | `x1< y1v` |
| c5 | Lace Crane | 4×4 | holes | 4 | `x3> y1^ x1< y1v` |
| c6 | Folded Wings | 5×4 | holes | 5 | `x1< x3< x2> y3v y2^` |
| c7 | Crane Tail | 6×4 | holes | 5 | `x1> x1> y3v y1v x1>` |
| c8 | The Thousand Cranes | 5×5 | holes | 6 | `y4v x1< x1< y1v x1> y2^` |
| s1 | Taped Together | 3×1 | tape | 1 | `x2>` |
| s2 | Mountain Fold | 2×1 | mountain | 1 | `x1<` |
| s3 | Valley Fold | 3×2 | mountain, valley | 2 | `y1v x1<` |
| s4 | Starlight Strip | 4×4 | tape, mountain | 4 | `y1v x3> x2> y2^` |
| s5 | Twinkle | 5×4 | tape, mountain, valley | 5 | `y3^ x1< x1< y2v x1>` |
| s6 | Upside Down | 6×4 | mountain, valley | 6 | `x1> y1v x1< x3> y2v x1>` |
| s7 | Patchwork Sky | 5×5 | tape, mountain, valley, notched | 6 | `x1< y4^ y3^ x1< y1v x1>` |
| s8 | The Evening Star | 6×5 | tape, mountain, valley, notched | 6 | `x1< y3v x1< x3> y1v x2<` |
| n1 | Ribbon Tie | 4×2 | – | 3 | `x3> x1> y1v` |
| n2 | Paper Carp | 6×3 | – | 5 | `x5> x4> y1^ x3> y1^` |
| n3 | Ribbon Lantern | 5×5 | holes | 5 | `x1< x3< y4v x1< y3v` |
| n4 | Candle Boat | 6×5 | tape, notched | 6 | `x5> y4^ x1> y1^ y1v x3<` |
| n5 | Ribbon Crane | 5×5 | holes, mountain | 6 | `x1< x3< x2< y4v y1v y1v` |
| n6 | Shooting Star | 6×5 | tape, mountain, valley | 7 | `y4v y1v y1v x5> y1^ x4< x1>` |
| n7 | Moon Carp | 6×6 | mountain, valley, notched | 7 | `y1^ y4v y1^ x5> x4> y1^ x3<` |
| n8 | Festival Night | 6×6 | holes, tape, mountain, valley | 8 | `y5^ x1< y1v x4< x1< y3^ x2< y1v` |

Lanterns and Boats stay within 4 × 4 and three folds, and so do the first half of Cranes and the teaching pages of Stars (Taped Together, Mountain Fold and Valley Fold, which teaches the blue valley crease: on its line a valley and a mountain disagree, so the line is locked until folding the top down turns the valley over). From Lace Crane (c5) the pages are deep: sheets of 4 × 4 up to 6 × 6, some notched or punched, pars from 4 to 8, and targets that need one particular order of folds, because whatever folds last lands on top. Valley creases come back in Twinkle, Upside Down, Patchwork Sky, The Evening Star, Shooting Star, Moon Carp and Festival Night: without them Patchwork Sky can't be made at all, and Shooting Star opens a shortcut a fold shorter.

The deep pages were composed backwards from a picture: first the target (a crane's head with its red crown and eye, a lantern with two windows and a flame, a candle boat on the waves, a moon and a star), then a fold order whose structure has a single shortest solution even if every face were different, found by sampling fold chains along each axis and interleaving them; then the picture is painted onto the faces that order brings to the top, and a few hidden back faces are recoloured until the solver finds no other shortest way. `tests/fold-bot.mjs` checks them all again on every run.

## The solver

A breadth-first search over whole paper states is far too slow for the big sheets: a 6 × 6 sheet can reach millions of different stackings. The solver in `lib/fold-game.ts` splits the problem by axis instead. Where a square ends up along x depends only on the vertical folds (in their order), never on the horizontal ones, and the same holds for y; which face is up depends only on how many folds lifted it. Every fold makes the paper strictly narrower or shorter, so each axis has only a few hundred fold chains. The solver lists the chains of each axis that end at the target's size, keeps only the pairs whose landing places alone could make the picture (the outline, holes over holes, and a square with the wanted face at every position), and then plays out every interleaving of each pair with the real fold rules, tape and creases included. Pairs that share the folds made so far share the paper too, and an interleaving is dropped as soon as a square the picture needs on top is buried in the middle of its stack (two squares in one stack never part again, and their order flips exactly when their stack is lifted). The search is exhaustive, so the minimum and the count of shortest solutions are exact, and `tests/fold.mjs` checks it against the plain breadth-first search on every page small enough for that (from the flat sheet and after each first fold) and on a hundred-odd random sheets with holes, tape and creases. Proving all forty pages takes about 0.2 s.

## Balance and the bots

`npm run bot:fold`: every page is solved exhaustively at its par, with 49 shortest solutions over the 40 pages: 33 pages have exactly one, 5 have two (Corner to Corner, Wing Tips, Window Bird, Paper Carp and Shooting Star) and 2 have three (Moon Carp and Festival Night). The pars by chapter are Lanterns 1, 2, 2, 2, 3, 3, 3, 3; Boats 2, 2, 2, 3, 3, 3, 3, 3; Cranes 1, 2, 2, 2, 4, 5, 5, 6; Stars 1, 1, 2, 4, 5, 6, 6, 6; Festival Night 3, 5, 5, 6, 6, 7, 7, 8. Sixteen pages have par 4 or more; the bot calls them the deep pages.

A random folder making exactly par legal folds wins 8.1% of tries overall and none of its tries on the deep pages. A patient random folder with 60 folds a try (random legal folds, starting again after par + 2 folds or when the paper can't fold any more), 60 tries a page, finishes 48% of its tries on the gentle pages (every try on First Fold, 2% on The Great Lantern) and not one try on any deep page. The hint from the flat sheet is always a first fold of a shortest solution, and following the hints finishes every page in par; following them from one to three random wrong folds (undoing when the hint says the target is out of reach) finishes every page, and the slowest hint took 94 ms (on Festival Night).

## Controls

Mouse: hover to preview the fold under the pointer (the nearest line that crosses the paper, lifting the side the pointer is on), click to fold; or drag across a line: the crease is halfway between the press and the release on the axis moved most, and the side pressed lifts. Touch: tap to preview, tap the same fold again to make it, or drag. Keyboard: arrows pick a line (left and right for vertical lines, up and down for horizontal ones), D, A, S and W fold the left part right, the right part left, the top part down and the bottom part up across it; Z or Backspace undoes, R resets, H shows the hint when offered, Esc goes back to the book.

## Feel

A fold takes 0.46 s: the flap turns over the crease with an ease-in-out, in perspective toward a camera above the table, its top face until it stands on edge and then its underside, shaded as it turns, with a soft shadow on the table; the crease line glows while it turns. Then the paper eases back to the middle of the table. A refused fold flashes red over its line with a toast saying why. When the picture matches, the paper flashes and lifts, paper confetti bursts, Dora and Enzo switch to their delighted cut-outs and hop, the seal is stamped on the result card, and the finished piece (drawn in the page's two colours) waits to float into the festival. Dora and Enzo sit either side of the table in curious, thinking and delighted poses that follow the play.

The sounds: a crisp rustle as the paper lifts and a crease tick as it lands (muffled for a fold tucked behind), a hollow tap for a refused fold, a swish for undo, a papery snap and chime for a match, then a stamp and a bell run that climbs with the seal, and rising notes as a piece floats to the festival. Each chapter has its own plucked pentatonic loop; Stars, Festival Night and the festival add crickets.

## Fitting the screen

Wide screens put the table in the middle with Dora on the left, Enzo on the right and the target card pinned top right; the squares stay the same size through a page, and the paper is re-centred after each fold. Tall screens put the card above the table and Dora and Enzo below it, either side of the buttons.

## Saving

`localStorage` key `paperfold-v1`: `{ v: 1, done: { id: { seal, best } }, tips, ended, settings: { sound, music } }`. A save is read defensively: anything that isn't the right shape, an unknown page, a seal other than 1 to 3 or a fold count out of range is dropped, so a corrupt save starts afresh rather than misreading.
