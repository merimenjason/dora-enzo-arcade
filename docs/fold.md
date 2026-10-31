# Paperfold

An origami folding puzzle at `/fold`, game 62 of the arcade, in a new cut-paper art style. A gust has scattered the pages of the valley's paper-lantern festival book, and Dora and Enzo fold sheets of coloured paper to make the lanterns, boats, cranes and stars the festival needs.

All numbers below come from `lib/fold-game.ts`, `lib/fold-levels.ts` and `app/fold/page.tsx`. Written 31-10-2026.

## Files

- `lib/fold-game.ts`: the rules. Sheets, layered folding, holes, tape and creases, the picture and the match, the breadth-first solver and hints, seals, unlocking and the save. Deterministic, no DOM; the only randomness (for the look of the paper) is a seeded generator.
- `lib/fold-levels.ts`: the five chapters and forty pages, each a sheet written as text with its designed solution.
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
- **Creases** sit between two neighbouring squares and are a valley or a mountain as seen on the front. A fold whose line parts creased squares follows the crease as seen from above (a mountain on paper lying face down is a valley): a mountain fold tucks the flap underneath instead of on top. Creases along one line that disagree block it. Plain lines always fold over.
- **The match:** the picture from above (the outline and the colour and mark on top of each position) must equal the target exactly. Every target is the picture the page's designed solution makes, so it is always reachable.

## Seals, hints and unlocking

- Par is the designed solution's length, and the bot proves it is the minimum. The fold count includes undone folds and resets to zero with Reset. Gold seal: folds ≤ par. Silver: ≤ par + 2. Paper seal: any finish. The best seal and fewest folds are kept.
- The Hint button appears after a reset or once the count passes par. It runs the solver from the paper as it lies (up to par + 2 folds deep) and shows the first fold of a shortest way in pulsing yellow; if the target can no longer be reached it says so.
- Pages in an open chapter open two ahead of the folded ones; a chapter's eighth page (the showpiece) opens when the other seven are folded; a chapter opens when six pages of the one before are folded. Folding the final page, Festival Night, shows the ending.

## The pages

Size is width × height of the sheet. Solutions use `x2>` for "the part left of x = 2 folds right", `x2<` for the part right of it folding left, `y1v` for the part above y = 1 folding down and `y1^` for the part below it folding up.

| Page | Name | Size | Par | Designed solution |
| --- | --- | --- | --- | --- |
| l1 | First Fold | 2×1 | 1 | `x1<` |
| l2 | Corner to Corner | 2×2 | 2 | `x1< y1^` |
| l3 | Paper Strip | 3×1 | 2 | `x1< x1>` |
| l4 | Two Windows | 3×2 | 2 | `x1< y1v` |
| l5 | Long Lantern | 4×2 | 3 | `y1^ x3> x2<` |
| l6 | Striped Lantern | 4×2 | 3 | `y1v x1< x1>` |
| l7 | Tall Order | 5×1 | 3 | `x1< x1> x1>` |
| l8 | The Great Lantern | 4×3 | 3 | `x3> x2< y1^` |
| b1 | Little Hull | 3×2 | 2 | `x1< x1>` |
| b2 | Corner Sheet | 2×2 | 2 | `x1> y1v` |
| b3 | Sailcloth | 3×2 | 2 | `x2< y1v` |
| b4 | Long Keel | 4×2 | 3 | `x1< y1v x1<` |
| b5 | Two-Tone Raft | 4×2 | 3 | `x3< x2> y1v` |
| b6 | Mast and Sail | 4×3 | 3 | `x3> y2v x1<` |
| b7 | Duck Boat | 4×2 | 3 | `x3> x2> y1v` |
| b8 | The Festival Barge | 4×3 | 3 | `x1< x2< y2^` |
| c1 | Peephole | 2×1 | 1 | `x1>` |
| c2 | Wing Tips | 4×1 | 2 | `x1< x2<` |
| c3 | Window Bird | 2×2 | 2 | `x1> y1^` |
| c4 | Long Neck | 3×2 | 2 | `x1< y1v` |
| c5 | Lace Crane | 4×2 | 3 | `x1< x1< y1^` |
| c6 | Two Holes | 3×3 | 3 | `x2> x1> y2v` |
| c7 | Crane Tail | 4×2 | 3 | `x1< x1< y1v` |
| c8 | The Thousand Cranes | 4×3 | 4 | `x1< x2> y1^ x1>` |
| s1 | Taped Together | 3×1 | 1 | `x2>` |
| s2 | Mountain Fold | 2×1 | 1 | `x1<` |
| s3 | Starlight Strip | 4×1 | 2 | `x1> x1>` |
| s4 | Tucked Away | 3×2 | 2 | `x1< x1>` |
| s5 | Twinkle | 3×3 | 3 | `x1< y1v x1>` |
| s6 | Upside Down | 4×2 | 3 | `x3> x1< y1^` |
| s7 | Patchwork Sky | 3×3 | 3 | `y2v x2> x1<` |
| s8 | The Evening Star | 4×3 | 4 | `x1< y1v y1^ x1<` |
| n1 | Ribbon Tie | 3×1 | 2 | `x1< x1<` |
| n2 | Paper Carp | 3×2 | 2 | `x2> y1^` |
| n3 | Ribbon Lantern | 3×3 | 3 | `x1< x1> y2v` |
| n4 | Candle Boat | 4×2 | 3 | `y1^ x1< x1>` |
| n5 | Ribbon Crane | 4×2 | 3 | `x1> y1^ x2>` |
| n6 | Shooting Star | 4×2 | 3 | `y1^ x3> x1>` |
| n7 | Moon Carp | 4×3 | 3 | `y2v y1v x3<` |
| n8 | Festival Night | 4×4 | 4 | `y1^ y2^ x1< x1>` |

The pages were chosen with a design pass over every state each sheet can reach: for each sheet the target is a picture whose minimum fold count is the chapter's step in difficulty, with as few shortest solutions as possible, as many marks showing as possible and more than one square once par reaches 3. `tests/fold-bot.mjs` checks them all again on every run.

## Balance and the bots

`npm run bot:fold`: every page is solved breadth first at its par, with 50 shortest solutions over the 40 pages (1.25 a page, never more than 4). A random folder making exactly par legal folds wins 9.5% of tries overall and 0.9% on pages with par 3 or more. A flailing player (random legal folds, resetting after par + 2) needs a median of 53.5 times par folds, and gives up on the 4 × 4 finale after 5,000. Following the hints from two random wrong folds (undoing when the hint says the target is out of reach) finishes every page.

## Controls

Mouse: hover to preview the fold under the pointer (the nearest line that crosses the paper, lifting the side the pointer is on), click to fold; or drag across a line: the crease is halfway between the press and the release on the axis moved most, and the side pressed lifts. Touch: tap to preview, tap the same fold again to make it, or drag. Keyboard: arrows pick a line (left and right for vertical lines, up and down for horizontal ones), D, A, S and W fold the left part right, the right part left, the top part down and the bottom part up across it; Z or Backspace undoes, R resets, H shows the hint when offered, Esc goes back to the book.

## Feel

A fold takes 0.46 s: the flap turns over the crease with an ease-in-out, in perspective toward a camera above the table, its top face until it stands on edge and then its underside, shaded as it turns, with a soft shadow on the table; the crease line glows while it turns. Then the paper eases back to the middle of the table. A refused fold flashes red over its line with a toast saying why. When the picture matches, the paper flashes and lifts, paper confetti bursts, Dora and Enzo switch to their delighted cut-outs and hop, the seal is stamped on the result card, and the finished piece (drawn in the page's two colours) waits to float into the festival. Dora and Enzo sit either side of the table in curious, thinking and delighted poses that follow the play.

The sounds: a crisp rustle as the paper lifts and a crease tick as it lands (muffled for a fold tucked behind), a hollow tap for a refused fold, a swish for undo, a papery snap and chime for a match, then a stamp and a bell run that climbs with the seal, and rising notes as a piece floats to the festival. Each chapter has its own plucked pentatonic loop; Stars, Festival Night and the festival add crickets.

## Fitting the screen

Wide screens put the table in the middle with Dora on the left, Enzo on the right and the target card pinned top right; the squares stay the same size through a page, and the paper is re-centred after each fold. Tall screens put the card above the table and Dora and Enzo below it, either side of the buttons.

## Saving

`localStorage` key `paperfold-v1`: `{ v: 1, done: { id: { seal, best } }, tips, ended, settings: { sound, music } }`. A save is read defensively: anything that isn't the right shape, an unknown page, a seal other than 1 to 3 or a fold count out of range is dropped, so a corrupt save starts afresh rather than misreading.
