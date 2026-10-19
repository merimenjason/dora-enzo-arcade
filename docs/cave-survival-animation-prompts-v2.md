# Cave survival animation prompts, v2

Written by Claude Code on 19-10-2026, after Enzo v2 was accepted (see **Enzo v2 — Claude's review** in `cave-survival-art.md`). These replace the remaining prompts in `cave-survival-animation-prompts.md`.

What changed from v1:
- Two Enzo rounds showed the generator ignores pixel boxes. So each sheet takes its **size and spacing from a picture**: `enzo-animation-v2.png` for every character sheet, and the earlier sheets for the later ones.
- The importer rescales every frame and puts its feet on one line. So exact size is not a gate. What it can't repair is content shared between cells, wrong facing, and missing or wrong poses.
- `scripts/cave-frame-review.py` measures a sheet, writes its review JSON and passes or fails it. Run it on every result before committing.

## Inputs used by every prompt

All paths are in this repository on `codex/cave-survival-style-art`; nothing is attached by hand.

| Name in prompts | File |
| --- | --- |
| ENZO | `public/art/cave-survival/enzo-animation-v2.png` |
| SPRITES | `public/art/cave-survival/sprites-0.png` |
| SCENE | `public/art/cave-survival/gameplay-style-test.png` |
| DORA | `public/art/cave-survival/dora-animation-v2.png` (accepted) |
| CRITTERS | `public/art/cave-survival/critters-animation-v2.png` (accepted) |
| ENVREF | `docs/cave-survival-layout-guides/environment-reference.png` (crops of the scene's blocks, lantern and crate) |

## Order, outputs and checks

| # | Sheet | Grid | Output | Check |
| --- | --- | --- | --- | --- |
| 1 | Dora | 6 × 4 | `dora-animation-v1.png` | `python3 scripts/cave-frame-review.py <png> 6 4 docs/cave-survival-dora-frame-review-v1.json` |
| 2 | Critters | 6 × 4 | `critters-animation-v1.png` | `… 6 4 docs/cave-survival-critters-frame-review-v1.json` |
| 3 | Effects | 6 × 4 | `fx-animation-v1.png` | `… 6 4 docs/cave-survival-fx-frame-review-v1.json` |
| 4 | Environment | 4 × 2 | `environment-v3.png` (round 2, below) | `… 4 2 docs/cave-survival-environment-review-v3.json` |
| 5 | Floor tile | one 1024² tile | `floor-v1.png` | `python3 scripts/cave-frame-review.py --tile <png> docs/cave-survival-floor-review-v1.json` |
| 6 | Rock Wyrm | 4 × 2 | `wyrm-v1.png` | `… 4 2 docs/cave-survival-wyrm-review-v1.json` |

Outputs go in `public/art/cave-survival/`.

**If a check fails**, generate once more with the same prompt plus the **Retry note** below it, saved as `-v2`. If that fails too, commit both versions and their reviews and stop for review. Never edit or rescale a generated image by script; the importer does that later.

After each sheet, look at every frame against its prompt (facing, pose, design), and add a short note under **Results** below: what passed, and any frame that's wrong.

---

## 1 · Dora

Inputs: ENZO (layout, size and style reference), SPRITES (Dora's design: top row, second subject), SCENE (Dora in play).

```
Create Dora's animation sheet: a transparent 1536 × 1024 PNG with 6 columns × 4 rows of equal 256 × 256 cells, laid out EXACTLY like image 1 (Enzo's sheet). Draw Dora at the SAME size and in the SAME position within each cell as Enzo is in image 1, frame for frame, so the two sheets match. Same camera (high, tilted about 55° down, three-quarter view), same soft gouache on cream paper and thin dark-plum outlines.

Dora EXACTLY as in images 2 and 3: ivory-white chinchilla, eyes very dark ruby-burgundy, nearly black, NEVER pink or red; rounded ears with pink insides; fluffy white tail; red bandana; brown satchel; tiny pickaxe. She faces RIGHT in every frame. Same size in all 24 frames.

Rows, left to right:
Row 1 walk cycle, pickaxe resting on her shoulder: 1 contact, 2 crouch, 3 push-off, 4 airborne (body lifted, feet tucked), 5 landing, 6 almost the same as 1. Feet and tail visibly change between frames.
Row 2 pickaxe bonk: 1 ready, 2 pickaxe raised behind her head, 3 top of the swing, 4 striking down in front of her to the right with a small cream dust tuft at the pick tip, 5 recoil, 6 back to ready. Keep the pickaxe CLOSE to her body: a short, compact swing.
Row 3: 1 idle breathe, 2 idle breathe slightly squashed, 3 blink, 4 startled hop (both feet up, eyes squeezed shut, no injury), 5 dizzy with little stars circling her ears, 6 shaking it off.
Row 4: 1 dig stroke down (pick striking the ground in front of her), 2 dig stroke up, 3 wiping her brow, 4 cheering with the pickaxe raised, 5 happy bounce in the air, 6 cheering.

Every cell's content stays inside its own cell with clear transparent space between it and every neighbouring cell: the pickaxe, tail, ears, stars and dust never reach a cell edge.

Genuine alpha-zero transparency outside Dora. No glow, halo, haze, backdrop, shadow, motion lines, speed lines, grid or text.
```

Retry note: `Dora is too large for her cells or her pickaxe reaches the neighbouring frame: draw her about 85% of Enzo's size in image 1, and keep the pickaxe within her own cell in every frame.`

## 2 · Critters

Inputs: ENZO (size, spacing and style), SPRITES (the critters' designs: top row third and fourth, bottom row first), SCENE (the critters in play, around Enzo and Dora).

```
Create the critters' animation sheet: a transparent 1536 × 1024 PNG with 6 columns × 4 rows of equal 256 × 256 cells, spaced like image 1 (Enzo's sheet), one critter centred in each cell standing on the same ground line as Enzo's feet. Same camera (high, tilted about 55° down, three-quarter view), same soft gouache on cream paper and thin dark-plum outlines.

Critters EXACTLY as in images 2 and 3, sized against Enzo in image 1 as they are in image 3:
- soot sprite: a round ball of black fuzz with two big white eyes and tiny feet, about HALF Enzo's height;
- pink cave mite: round, pink, exactly two antennae, little legs, grumpy-cute face, about half Enzo's height and a little wider than tall;
- mossy beetle: chunky rounded green shell with yellow star-shaped moss flecks, simple brown legs, about Enzo's width and three-quarters of his height.
Each critter is the SAME size in all its frames. Every critter faces RIGHT.

Rows, left to right:
Row 1 soot sprite: frames 1–4 a bouncy scuttle loop (fuzz ripples, feet patter, body bobs); 5 flinching with eyes squeezed shut; 6 bonked dizzy with spiral eyes and three small stars.
Row 2 pink mite: frames 1–4 a skittering walk loop (legs alternate, antennae bob); 5 flinching; 6 bonked dizzy.
Row 3 mossy beetle: frames 1–4 a slow plodding walk loop (shell rocks side to side, legs alternate); 5 flinching; 6 bonked dizzy, tipped slightly back.
Row 4 attacks, two frames each: 1–2 soot sprite crouching then pouncing forward to the right; 3–4 mite rearing up then lunging forward to nibble; 5–6 beetle lowering its head then ramming forward with its shell.

They are bonked, never hurt: no injury, tears, blood or scary faces. Every cell's content stays inside its own cell with clear transparent space between it and every neighbouring cell.

Genuine alpha-zero transparency outside the critters. No glow, halo, haze, backdrop, ground shadow, motion lines, speed lines, grid or text.
```

Retry note: `A critter reaches its neighbouring cell or the sizes drift between frames: keep each critter well inside its own cell, at one size for all its frames, smaller than in your last attempt.`

## 3 · Effects

Inputs: ENZO (spacing and scale: an effect should suit a character that size), SCENE (the dust puffs, crystals and acorns in play), SPRITES (the crystal: bottom row third).

```
Create the effects animation sheet: a transparent 1536 × 1024 PNG with 6 columns × 4 rows of equal 256 × 256 cells, spaced like image 1, each effect centred in its cell and no bigger than Enzo is in image 1. Same soft gouache on cream paper with thin dark-plum outlines, seen from the same high camera tilted about 55° down.

Rows, left to right:
Row 1 dust poof, 6 frames: a soft cream-white cloud of round puffs bursting outward, like the puffs in image 2: frame 1 small and tight, frames 2–4 larger and airier, frames 5–6 broken into a few drifting wisps. This is what a bonked critter turns into.
Row 2: frames 1–3 a cartoon bonk impact star (small, large, smaller and thinner); frames 4–6 brown rock chips with a few gold flecks bursting from a dug block (tight, spread, settling).
Row 3: frames 1–4 one acorn spinning in flight (brown cap, shiny nut), turned a quarter more in each frame; frames 5–6 a blue crystal twinkle, a small then a larger solid four-point star in the crystal's colours from image 3.
Row 4: frames 1–3 a curved pale-cream pickaxe swoosh arc sweeping left to right (starting, full, thinning); frames 4–6 a level-up ring of golden sparkles lying flat on the floor in perspective as a flattened ellipse (small, wide, fading to a few sparkles).

Fading frames are shown by smaller and sparser shapes, NOT by transparency haze. Every cell's content stays inside its own cell.

Genuine alpha-zero transparency between and around the shapes. No glow, bloom, halo, light rays, backdrop, grid or text.
```

Retry note: `An effect reaches its neighbouring cell: draw every effect smaller, well inside its own cell, with wide transparent space around it.`

## 4 · Environment

Inputs: SCENE (the blocks, crate and lantern in play), SPRITES (the gold block: bottom row fourth), ENZO (scale).

```
Create the cave environment sheet: a transparent 1536 × 1024 PNG with 4 columns × 2 rows of equal 384 × 512 cells, one object centred in each cell, standing on a common ground line about 90 px above the bottom of the cells. Style and camera EXACTLY like image 1: soft detailed gouache on cream paper, thin dark-plum outlines, warm cosy palette, seen from high above and in front, tilted about 55° down, so blocks show their TOP face and their FRONT face.

All five blocks are the SAME size and shape, a chunky cube about 260 px wide, like the gold block in image 2:
Row 1, left to right: a plain brown diggable dirt block; the brown block flecked with gold (matching image 2); the gold block with small cracks; the gold block badly cracked and starting to crumble, with a few loose chunks still touching it.
Row 2, left to right: a solid dark grey-purple bedrock block, clearly harder and undiggable; a cosy wooden drop pod / mine-lift cage with a little roof and a rope, about the block's width and one and a half times its height; a wooden post with a hanging lantern whose lens is painted bright warm yellow, with NO light spilling outside the lantern; a small open wooden crate full of blue crystals like the ones in image 1.

Each object stays inside its own cell with clear transparent space around it.

Genuine alpha-zero transparency. No floor, ground shadow, glow, haze, backdrop, grid or text.
```

Retry note: `An object reaches the cell edge or the blocks differ in size: draw every object smaller and keep the five blocks identical in size and shape.`

## 4 · Environment, round 2 (use this one)

Round 1 (above, `environment-v1.png` and `-v2.png`) drew crisp corner-on isometric cubes in a pixel-art texture; see **Round 1 sheets — Claude's review** in `cave-survival-art.md`. Output `environment-v3.png`, retry `environment-v4.png`.

Inputs: SCENE (style and camera), ENVREF (the blocks, lantern and crate to match).

```
Create the cave environment sheet: a transparent 1536 × 1024 PNG with 4 columns × 2 rows of equal 384 × 512 cells, one object centred in each cell, all standing on a common ground line about 90 px above the bottom of the cells.

Match images 1 and 2 EXACTLY in style and camera: soft, loose gouache brushwork on cream paper with thin dark-plum outlines and a warm cosy palette. NOT pixel art, NOT crisp isometric game tiles. The camera looks from the FRONT, high above, tilted about 55° down: every block shows a large TOP face with its FRONT face below it, square-on, like the blocks in image 2. Never turn a block corner-on: no diamond-shaped tops; the left and right sides are hidden or only a sliver.

The five blocks are soft-edged, slightly uneven chunky blocks with rounded corners, like image 2, about 260 px wide, all the SAME size and outline:
Row 1, left to right: a plain brown diggable dirt block; the same block flecked with a few gold nuggets like image 2; the gold block with a few small hairline cracks; the gold block split into big chunks starting to fall apart, every chunk still touching the block.
Row 2, left to right: a solid dark grey-purple bedrock block, same size, clearly harder (smoother, darker, no gold); a cosy wooden mine-lift cage about the block's width and one and a half times its height, with a little roof and a coil of rope lying ON the roof, with NO rope rising above it; a wooden post with a hanging lantern like image 2's, its lens painted bright warm yellow, with NO light spilling outside it; a small open wooden crate full of blue crystals like image 2's.

Every object stays well inside its own cell, with at least 40 px of transparent space to every cell edge.

Genuine alpha-zero transparency. No floor, ground shadow, glow, haze, backdrop, grid or text.
```

Retry note: `The blocks are turned corner-on, look like pixel art, or an object comes near a cell edge: show only each block's top and front faces, square-on, painted in loose gouache like image 2, and draw every object smaller.`

Check by eye as well as by script: the script cannot see the camera. If the tops are diamond-shaped or the texture is pixelated, count it as a failed check.

## 5 · Floor tile

Inputs: SCENE (the floor's colour and texture only), ENZO (to judge the scale of the stone texture against a character).

```
Create a SEAMLESS TILEABLE square texture, exactly 1024 × 1024 pixels: the cave floor from image 1, dusky purple stone, seen from high above at about 55°, so it reads as flat ground.

Soft gouache texture on cream paper: gentle mottled purple and plum tones, a few faint thin cracks, a light scattering of tiny pebbles no bigger than Enzo's paw in image 2. It must be LOW CONTRAST and calm, because characters and critters are drawn on top of it and must stand out. No large rocks, crystals, gold, objects, puddles, light pools, shadows, vignette or dark corners.

The left edge continues seamlessly into the right edge and the top into the bottom, so the tile repeats in a grid with no visible seams. Even lighting across the whole tile. No text, border or frame.
```

Retry note: `The tile shows a seam or uneven lighting when repeated: make the texture finer and more even, and make the edges match exactly.`

## 6 · Rock Wyrm

Inputs: SPRITES (the wyrm's design: bottom row second), CRITTERS (the critters' scale and spacing, once made; otherwise ENZO), SCENE (style).

```
Create the Rock Wyrm boss sheet: a transparent 1536 × 1024 PNG with 4 columns × 2 rows of equal 384 × 512 cells, one piece centred in each cell, standing on a common ground line about 80 px above the bottom of the cells. The Rock Wyrm EXACTLY as in image 1 (bottom row, second subject): chunky grey stone segments, moss tufts, small stone horns, sleepy grumpy face, friendly and never scary. Same soft detailed gouache, thin dark-plum outlines, same camera tilted about 55° down. The head faces RIGHT.

The game chains separate pieces into a long wyrm, so draw each piece on its own:
Row 1, the HEAD only, 4 frames at the same size, about twice a mossy beetle's height in image 2: sleepy idle; eyes open and grumpy; mouth wide open in a big rumbling yawn-roar (no teeth, no fire); bonked dizzy with spiral eyes and stars.
Row 2, left to right: one round BODY segment, a mossy stone ball about two-thirds of the head's height; the same body segment flinching, slightly squashed with puffs of dust; the TAIL tip segment, tapering, about the body segment's size; a pile of tumbling boulders and dust as the wyrm settles when bonked, about the head's size.

Each piece stays inside its own cell with clear transparent space around it.

Genuine alpha-zero transparency. No floor, ground shadow, glow, haze, backdrop, grid or text.
```

Retry note: `A piece reaches the cell edge: draw every piece smaller, keeping the four head frames identical in size.`

---

## Results

(Add one entry per generated sheet: file, check status, and any frame that's wrong by eye.)

- **Dora**: `public/art/cave-survival/dora-animation-v1.png` **fail** (row 2 column 4: piece overhang 28 px); retry `dora-animation-v2.png` **pass**. Both unmodified versions and their review JSONs are saved. All 24 frames reviewed: right-facing except row 4 column 2, which faces left; row 2 column 5 is close to ready instead of a distinct recoil; row 3 column 2 closes her eyes rather than just breathing/squashing. Ivory fur, red bandana, satchel, pickaxe and nearly black burgundy eyes match the references. V1 has the same recoil/idle ambiguity but its row 4 column 2 faces right. No post-generation image processing applied. Generated with the built-in image generation tool using the exact Dora prompt; v2 appends only the supplied Retry note.
- **Critters**: `public/art/cave-survival/critters-animation-v1.png` **fail** (row 1 columns 2, 6, 5: overhang 29, 30, 31 px); retry `critters-animation-v2.png` **pass**. Both versions and reviews saved unmodified. Reviewed all 24 frames in each: designs match SPRITES, heads/eyes orient right, flinch/dizzy frames and the soot/mite/beetle attack pairs are in order. Soot and mite figures look larger than half Enzo's height; beetle walk poses in row 3 columns 1–4 differ only subtly, and the lower-head/ram distinction in row 4 columns 5–6 is weak. Dizzy stars have connecting arc strokes. Generated using the exact critter prompt with listed inputs; v2 appends only its Retry note.
- **Effects**: `public/art/cave-survival/fx-animation-v1.png` **fail** (row 1 column 3: overhang 25 px); retry `fx-animation-v2.png` **pass** with non-failing row-height warnings, expected for growing/fading effects. Both unmodified versions and reviews saved. Reviewed all 24 frames in both: the requested dust, impact stars, rock chips, acorns, crystal twinkles, pickaxe arcs and floor rings are in the right cells and match the painted palette. In both versions dust is largest in row 1 column 3 and already separates in column 4; v1 adds rock chips to dust poofs. V2 row 3 columns 1–3 have very similar acorn orientations rather than successive quarter turns; both versions add curved strokes around acorns. Floor rings include connecting strokes rather than only isolated sparkles. Exact effects prompt and listed input order used; v2 appends only its Retry note.
- **Environment**: `public/art/cave-survival/environment-v1.png` **fail** (row 2 column 2: lift/rope piece overhang 49 px); retry `environment-v2.png` **fail** (same cell: overhang 25 px, exceeding the script's 24 px allowance). Both unmodified versions and reviews saved. All eight cells reviewed in each: plain dirt, gold, cracked gold, crumbling gold, purple-grey bedrock, lift, lantern post and blue-crystal crate are in order and match the reference style and camera. Row 1 column 3 has deep large cracks instead of small cracks; row 1 column 4 includes some detached chips rather than only touching chunks. The lift rope still extends into the upper row. Exact environment prompt and listed input order used; v2 appends only its Retry note. **Stopped after this second failed check as instructed; the floor tile and Rock Wyrm have not been generated.**
