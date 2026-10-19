# Cave-survival style references

These are visual development references for a proposed cosy cave-survival arcade game starring Dora and Enzo. They are ready for comparison with the gameplay mock-up; no game integration or new menu entry is included.

## Files

- `public/art/cave-survival/gameplay-style-test.png`: 1536 × 1024 gameplay concept showing the purple cave arena, warm lighting, heroes, approaching critters, diggable gold-flecked blocks, dust puffs and blue crystal drops.
- `public/art/cave-survival/sprites-0.png`: 1536 × 1024 RGBA sprite concept sheet with eight subjects in four columns and two rows. The background contains actual alpha-zero pixels; inspect edge alpha and framing before treating the sheet as a production atlas.
- `docs/cave-survival-image-prompts.md`: prompts and layout refinements used with the built-in OpenAI image generation tool.

## Sprite order

Each equal grid cell is 384 × 512 pixels. Read left to right, then top to bottom:

1. Enzo: grey chinchilla, white chest, black eyes, yellow miner helmet and acorn.
2. Dora: ivory-white chinchilla, very dark ruby-burgundy eyes, tiny pickaxe.
3. Fuzzy black soot sprite with white eyes.
4. Pink cave mite with two antennae.
5. Mossy-green shelled beetle.
6. Grey stone rock wyrm with moss and a sleepy grumpy face.
7. Blue crystal.
8. Brown rock cube flecked with gold.

## Review before implementation

Preserve the soft gouache treatment, thin dark-plum outlines, rounded silhouettes and cosy mood. Dora's eyes must stay nearly black burgundy, never pink. Review the camera angle against the actual game mock-up and test silhouette readability with cells displayed at 50 pixels tall. The concept scene does not establish final gameplay scale or production-ready animation frames. Decide which floor, wall, block and effect assets are needed separately before implementation.

## Enzo animation draft — correction required

`public/art/cave-survival/enzo-animation-draft.png` is the first animation generation: 1536 × 1024 RGBA, six columns by four rows of 256 × 256 cells. It is a review draft, not a production atlas. The complete seven-image brief is saved in `docs/cave-survival-animation-prompts.md`, and the normalized prompt actually used for this first generation is in `docs/cave-survival-enzo-generation-prompt.md`.

The brief explicitly requests Enzo first and a correction prompt if his frames drift. This draft fails that gate, so Dora, critters, effects, environment, floor and boss have not been generated yet.

Observed issues:

- Walk frames occupy about 180–193 px in width and 190–202 px in height, exceeding the requested 180 × 180 maximum in most frames.
- Walk frame silhouette bottoms range from local y=237 to y=243 (exclusive bounds), versus the requested foot line at local y=226. Most non-hopping frames in subsequent rows also move relative to the requested line.
- Some spin-frame content reaches cell boundaries, so crops cannot safely be treated as independent sprites.
- Spin poses face left/back despite the requested right-facing rule. Some special frames include motion lines, and the throw release frame does not clearly show the released acorn.

`docs/cave-survival-enzo-frame-review.json` records the per-cell visible bounds measured at alpha > 128. These bounds include tools, tails, acorns and stars; they are silhouette measurements rather than semantic foot coordinates. Background transparency exists, but edge/low-alpha cleanup still needs inspection.

Next step: write a correction prompt for Enzo's grid, frame size, anchoring and pose details before generating the remaining sheets. No animation integration has been attempted.

## Layout guides

`docs/cave-survival-layout-guides/` holds one placement guide per animated sheet, at the sheet's exact size. They are for the image generator only, never drawn into the art: grey cell borders, a blue box the whole subject must fit inside, a red foot line where feet rest, and a green arrow for the facing (right).

| Guide | Sheet | Box (w × h) | Feet above cell bottom |
| --- | --- | --- | --- |
| `hero-6x4.png` | Enzo and Dora, 256 px cells | 160 × 160 | 48 px |
| `critters-6x4.png` | soot row 1, mite row 2, beetle row 3, attacks row 4 (2 cells each) | 112 × 112, 120 × 104, 168 × 140 | 48 px |
| `fx-6x4.png` | effects, 256 px cells | 176 × 176, centred low | none |
| `environment-4x2.png` | 384 × 512 cells | 260 × 300; pod and lantern 260 × 380 | 90 px |
| `wyrm-4x2.png` | 384 × 512 cells | head 300 × 300; body 220 × 200; tail 220 × 180; boulders 300 × 260 | 80 px |

The boxes are deliberately about 80% of the earlier targets: the Enzo draft overshot its 180 px box by about 10% and sat 11–17 px below its foot line. Small drift is corrected by the import script, which scales each frame and puts its feet on the line; wrong facing, missing frames and content touching a cell edge cannot be corrected.

## Enzo animation v2 — generated for review

`public/art/cave-survival/enzo-animation-v2.png` is the unmodified image-generator result using the draft, `hero-6x4.png` and `sprites-0.png` as the three image inputs from commit `90d9a79`. The original draft is preserved. The exact correction prompt is saved in `docs/cave-survival-enzo-generation-prompt-v2.md`.

`docs/cave-survival-enzo-frame-review-v2.json` uses the same schema and alpha > 128 measurement as the first review, with the new target foot line at local y=208. The output is 1536 × 1024 RGBA with actual alpha-zero background pixels. No rescaling, alignment or alpha cleanup has been applied after generation.

V2 is still marked `draft_requires_correction`: all 24 measured silhouettes exceed 160 px in width or height; five cells have visible content touching a cell edge (row 2 columns 4–5, row 4 columns 2–4). These measurements can include neighbouring-cell spill and all props/effects. Grounded walk silhouette bottoms range from local y=247–251 exclusive, versus target y=208; the airborne walk frame bottom is y=221. The airborne walk pose and released acorn are clearer, but row 4 column 2 still faces left, and row 2 column 6 still holds an acorn. Stars retain a connecting arc in the dizzy frame. Review the individual poses before generating the remaining six sheets.

## Enzo v2 — Claude's review: accepted as the source sheet (19-10-2026)

Two rounds show the generator draws Enzo at about 180–190 px whatever box it is given, so the 160 px target is dropped. Size and foot line were always going to be normalised on import (each frame scaled to one height, each row's grounded frames set its foot line), so they are not reasons to regenerate. What import cannot fix is content that merges between cells, wrong facing in a held pose, or missing frames.

Splitting v2 into connected pieces at alpha > 128 and assigning each piece to the cell holding its centre: **every piece belongs to exactly one cell; no two cells' content touches.** The five "edge" cells are three small overhangs and their neighbours: the released acorn (row 2, column 4) reaches 15 px into column 5, the spin's body (row 4, column 2) 2 px into column 3, and one spin acorn (row 4, column 3) 11 px into column 4. The importer crops by piece, not by cell, so these are harmless. Within each row the grounded feet agree within 4 px (row 1 y 247–251, row 2 236–238, row 3 224, row 4 202–207).

The remaining pose notes are accepted:
- Row 4, column 2 faces front-left: it is the middle of a spin, played at about 0.08 s a frame, and reads as turning.
- Row 2, column 6 holds an acorn: Enzo always carries one in his idle design (as in `sprites-0.png`).
- The dizzy stars' thin arc stays; it reads as the stars' path.

Import will snap alpha ≥ 240 to 255 and clear colour under alpha 0 (alpha still peaks at 254). The remaining sheets use Enzo v2 as their size and layout reference instead of a pixel box, and must keep each cell's content apart from its neighbours'.

## Round 1 sheets — Claude's review (19-10-2026)

Every frame of the eight sheets from `adaaf71` was checked by eye, both on the raw file and composited on the cave purple.

| Sheet | Verdict | Import fixes |
| --- | --- | --- |
| `dora-animation-v2.png` | **Accepted** | Mirror row 4, column 2 (her dig-up frame faces left; mirrored, it reads as the pick raised in front). |
| `critters-animation-v2.png` | **Accepted** | None. The scene adds a 1–2 px bob to the walk loops and moves the attackers forward in code, so the subtle walk frames and the weak beetle ram don't matter. |
| `fx-animation-v2.png` | **Accepted** | The acorn spin is drawn with the four row 3 frames plus a quarter-turn per frame in code. |
| `environment-v1.png`, `environment-v2.png` | **Rejected** | Not repairable on import (see below). |
| `dora-animation-v1.png`, `critters-animation-v1.png`, `fx-animation-v1.png` | Kept, unused | Their overhangs are harmless, but v2 of each is as good or better. |

Notes on the accepted sheets:
- **Dora v2.** Ivory fur, red bandana, satchel and pickaxe match `sprites-0.png`; eyes are dark burgundy, not pink. Row 2 column 5 (recoil) is close to ready, and row 3 column 2 closes her eyes instead of squashing; both are fine at 48 px and 0.1 s a frame.
- **Critters v2.** Designs match the scene; the mite has exactly two antennae; every critter faces right; flinch and dizzy frames are in order. The importer sets their heights (soot and mite about half Enzo's), so their drawn size doesn't matter.
- **Effects v2.** All 24 cells are the requested effects in order. The thin swirl strokes on the acorns and the ring's connecting line read as motion and are kept.
- **All three: faint halo.** 7–12% of each sheet's pixels have alpha 1–31, a faint glow around every subject. It is invisible on the floor but would tint it, so import also **clears alpha below 32**, alongside the existing alpha ≥ 240 → 255 snap and clearing colour under alpha 0.

Why the environment is rejected. The rope overhang (25 px in v2) is harmless on its own, as the importer crops by piece. The real problem is the camera and style: both versions draw crisp, corner-on isometric cubes with diamond-shaped tops and a pixel-art texture. The scene (`gameplay-style-test.png`) shows soft gouache blocks seen square-on from the front, a big top face above a front face, and the floor grid needs exactly that to tile. `docs/cave-survival-layout-guides/environment-reference.png` holds crops of two scene blocks, the lantern and the crystal crate as the reference for the corrected prompt (round 2 in `cave-survival-animation-prompts-v2.md`).

## Round 2 sheets — Claude's review (19-10-2026)

| Sheet | Verdict | Notes |
| --- | --- | --- |
| `environment-v3.png` | **Accepted** | Square-on blocks in gouache, as asked. The stronger cracks read well as dig stages at tile size, and the lift's tight top clearance is harmless because the importer crops by piece. The lantern post faces left; it's a prop, so it isn't mirrored. |
| `floor-v2.png` | **Accepted** | Calmer and more even than v1, which shows a repeating blotch pattern when tiled 2 × 2. Both are seamless. The 1254 × 1254 size is fine: the scene scales the tile to the view, so the importer accepts any square tile and records its size instead of resampling it. |
| `floor-v1.png` | Kept, unused | |
| `wyrm-v1.png` row 2 | **Accepted** | Body segment, body flinch, tail and boulder pile: all four are separate pieces, as the game needs. |
| `wyrm-v1.png` row 1, `wyrm-v2.png` | **Rejected** | The head cells show whole curled wyrms, not separate heads. The game chains a head, 8 body segments and a tail, so it needs the head alone. |

The wyrm's heads get their own sheet, `wyrm-heads-v1.png` (prompt 7 in `cave-survival-animation-prompts-v2.md`). Its input `docs/cave-survival-layout-guides/wyrm-head-guide.png` chains the accepted tail and body pieces with a plain grey circle where the head goes, so the generator sees that only the head is missing.
