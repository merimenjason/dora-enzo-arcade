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
| 7 | Rock Wyrm heads | 2 × 2 | `wyrm-heads-v1.png` (section 7) | `… 2 2 docs/cave-survival-wyrm-heads-review-v1.json` |
| 8 | Enzo digging | 4 × 2 | `enzo-dig-v1.png` (section 8) | `… 4 2 docs/cave-survival-enzo-dig-review-v1.json` |
| 9 | Enzo digging, round 2 | 4 × 2 | `enzo-dig-v3.png` (section 9) | `… 4 2 docs/cave-survival-enzo-dig-review-v3.json` |
| 10 | Card and upgrade icons | 6 × 4 | `icons-v1.png` (section 10) | `… 6 4 docs/cave-survival-icons-review-v1.json` |

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

## 7 · Rock Wyrm heads (round 2)

The first wyrm sheets drew whole curled wyrms in the head cells. Row 2 of `wyrm-v1.png` (body, flinch, tail, boulders) is accepted; only the four heads are needed. Output `wyrm-heads-v1.png`, retry `wyrm-heads-v2.png`.

Inputs: GUIDE `docs/cave-survival-layout-guides/wyrm-head-guide.png` (the accepted tail and body pieces chained, with a grey circle where the head goes), WYRM `public/art/cave-survival/wyrm-v1.png` (the face to match), SPRITES.

Check: `python3 scripts/cave-frame-review.py public/art/cave-survival/wyrm-heads-v1.png 2 2 docs/cave-survival-wyrm-heads-review-v1.json`. Also check by eye: **any body segment, coil or tail in a cell counts as a failed check.**

```
Create the Rock Wyrm's HEAD sheet: a transparent 1536 × 1024 PNG with 2 columns × 2 rows of equal 768 × 512 cells, one head centred in each cell, resting on a common ground line about 80 px above the bottom of the cells.

The game builds the wyrm from separate pieces. Image 1 shows the pieces it already has, chained together: the tail on the left and round mossy body segments, with a plain grey circle where the HEAD goes. Draw ONLY that missing head: one big rounded mossy stone head, about the size of the grey circle compared with the body segments, seen from the side and slightly above, facing RIGHT. Its face, ears, small stone horns, moss tufts and little white flowers are exactly like the wyrm's face in image 2, in the same soft detailed gouache with thin dark-plum outlines. Friendly and never scary.

The head ends at the back of the skull in a short, rounded neck stub. NOTHING behind it: no body segments, no coils, no tail, no second wyrm. Each cell holds one head and nothing else.

Cells, left to right, top to bottom:
1 sleepy: eyes closed, calm.
2 grumpy: eyes wide open, frowning brows.
3 rumbling: mouth wide open in a big yawn-roar, eyes squeezed shut, no teeth, no fire.
4 bonked: dizzy spiral eyes and three small stars circling just above the head, inside the cell.

The four heads are the SAME size and outline; only the face changes. Every head stays well inside its cell, with at least 60 px of transparent space to every cell edge.

Genuine alpha-zero transparency. No floor, ground shadow, glow, haze, backdrop, grid or text. Do not draw the grey circle.
```

Retry note: `A body, coil or tail appears behind a head, or a head comes near a cell edge: draw each head alone, as a separate puppet piece ending in a rounded neck stub, smaller, with wide transparent space around it.`

## 8 · Enzo digging

Written by Claude Code on 20-10-2026. Enzo has no dig frames: Dora's sheet has two (row 4), Enzo's row 4 was spent on his spin and cheers, so in the game he pushes into dirt with his walk. He carries no tool, so he digs the way a chinchilla does, scrabbling with his front paws. Output `enzo-dig-v1.png`, retry `enzo-dig-v2.png`.

Cell 1 is a copy of an accepted idle frame. The importer scales the dig frames by it, so they match the rest of Enzo's frames exactly; it is not used in the game.

Inputs: ENZO (his design, size and style; row 3, column 1 is the idle frame to copy), DORA (her row 4, columns 1–2: the dig strokes these frames stand in for), SCENE.

Check: `python3 scripts/cave-frame-review.py public/art/cave-survival/enzo-dig-v1.png 4 2 docs/cave-survival-enzo-dig-review-v1.json`. Also check by eye: **he faces RIGHT in all eight cells, holds no tool, and cell 1 matches image 1's row 3, column 1 in size.**

```
Create a short digging sheet for Enzo: a transparent 1536 × 1024 PNG with 4 columns × 2 rows of equal 384 × 512 cells, one Enzo in each cell, all standing on a common ground line about 60 px above the bottom of the cells.

Enzo EXACTLY as in image 1, at the SAME size as he is there: grey chinchilla with a big fluffy tail, round pink-lined ears, dark eyes, yellow miner's helmet with its lamp, brown satchel and strap. Same camera (high, tilted about 55° down, three-quarter view), same soft gouache on cream paper and thin dark-plum outlines. He faces RIGHT in every cell. He holds NO pickaxe, shovel or other tool, and no acorn: he digs with his front paws, like a real chinchilla.

Cells, left to right, top to bottom:
1 a copy of image 1's row 3, column 1 (standing idle), same size and pose. This is the size reference.
2 dig ready: crouched low and leaning forward to the right, both front paws raised in front of his chest, tail up behind him.
3 left front paw scraping down into the ground in front of him, right paw lifted; two or three small brown dirt clods flicking up and back past his belly.
4 right front paw scraping down, left paw lifted; clods flicking back.
5 the same as 3 with the clods in a different place.
6 the same as 4 with the clods in a different place.
7 leaning in hard, both paws pushing flat against the ground in front, cheeks puffed with effort.
8 sitting up and shaking dirt off one front paw, a few small specks falling, pleased.

Cells 2 to 7 loop as one digging cycle, so keep his crouch height, body size and helmet in the same place across them: only the paws, tail tip and dirt change. Cells 3 to 6 must clearly alternate paws.

Every cell's content stays inside its own cell with at least 40 px of transparent space to every cell edge: the tail, ears, helmet lamp and dirt clods never reach a cell edge or a neighbouring cell. Dirt clods are a few separate small pieces close to his paws, not a cloud.

Genuine alpha-zero transparency outside Enzo and the clods. No ground, hole, ground shadow, glow, lamp beam, haze, backdrop, motion lines, speed lines, grid or text.
```

Retry note: `Enzo is holding a tool, faces left, changes size between cells, or dirt reaches a cell edge: draw him with empty front paws, facing right, the same size as image 1 in every cell, with only two or three small clods kept close to his paws.`

## 9 · Enzo digging, round 2 (use this one)

Written by Claude Code on 20-10-2026, after section 8's two attempts failed (see **Enzo digging — Claude's review** in `cave-survival-art.md`). What changed:
- **No size-reference cell.** Section 8's cell 1 asked for a copy of an idle frame, which holds an acorn. That put an acorn on the sheet by instruction, and the model carried it into the dig frames. The importer will size these frames against Enzo's walk frames instead.
- **Only ENZO as input.** DORA and SCENE added nothing the prompt doesn't say, and fewer pictures of Enzo holding acorns is better.
- **Big outline changes, not paw swaps.** In a three-quarter view the far paw is hidden behind the near one, so "left paw, then right paw" can't read, and both attempts drew the same crouch four times. The cycle is now three beats with very different outlines (tall, long and low, rocked back) that read at game size.

Output `enzo-dig-v3.png`, retry `enzo-dig-v4.png`. Inputs: ENZO only.

Check: `python3 scripts/cave-frame-review.py public/art/cave-survival/enzo-dig-v3.png 4 2 docs/cave-survival-enzo-dig-review-v3.json`. Also check by eye, and count any of these as a failed check: **an acorn anywhere; any cell facing left; cells 1, 2 and 3 of a row with outlines that are hard to tell apart.** Size differences between the sheet and ENZO don't matter.

```
Create a short digging sheet for Enzo: a transparent 1536 × 1024 PNG with 4 columns × 2 rows of equal 384 × 512 cells, one Enzo in each cell, all standing on a common ground line about 80 px above the bottom of the cells.

Enzo's design EXACTLY as in image 1: grey chinchilla with a big fluffy tail, round pink-lined ears, dark eyes, yellow miner's helmet with its lamp, brown satchel and strap. Same camera (high, tilted about 55° down, three-quarter view), same soft gouache and thin dark-plum outlines. He faces RIGHT in every cell, and he is the same size in every cell.

In image 1 he holds an acorn; that is only for throwing. On this sheet the acorn is put away: NO acorn anywhere, not in his paws, not at his chest, not on the ground. His front paws are EMPTY in every cell, with pink pads showing. No pickaxe, shovel or other tool.

He digs like a cartoon dog digging a hole, in three big beats. Each beat has a VERY different outline:

Row 1, left to right:
1 RAISE: sitting up tall on his hind legs, the near front paw lifted HIGH beside his cheek, pads showing, the other paw at his chest. Tail low on the ground.
2 SLAM: dropped long and low, body stretched far forward, chin near the ground, the near front paw reaching out and pressed into the ground in front of his nose. Three or four small brown dirt clods jump up around that paw.
3 FLING: rocked back on his haunches, both front paws swept back under his belly, three or four small brown clods flying out behind him past his tail. Tail flicked UP high.
4 DONE: sitting up, shaking dirt off one paw, eyes happily closed, a few tiny specks falling.

Row 2: the same four beats again, drawn fresh, with the clods in different places.

Tall in cell 1, long and low in cell 2, rocked back with tail up in cell 3: someone seeing only their outlines must tell them apart at a glance.

Every cell's content stays inside its own cell with at least 40 px of transparent space to every cell edge: the tail, ears, helmet lamp and clods never reach a cell edge or a neighbouring cell. Clods are a few separate small pieces, not a cloud.

Genuine alpha-zero transparency outside Enzo and the clods. No ground, hole, ground shadow, glow, lamp beam, haze, backdrop, motion lines, speed lines, grid or text.
```

Retry note: `An acorn appears, or the RAISE, SLAM and FLING cells look alike: no acorn anywhere and empty paws in every cell; make RAISE tall with one paw up by his cheek, SLAM long and low with his chin near the ground, and FLING leaning back with his tail straight up and dirt flying behind him.`

---

## 10 · Card and upgrade icons

Written by Claude Code on 20-10-2026. The level-up cards, the camp upgrades and the weapon slots are text only. One small painted icon per thing gives each card a picture. The camp upgrades reuse the matching passive's icon (Fluffier = Thick Fluff, Sharper = Sharp Claws, Quicker = Quick Paws, Diggier = Strong Arms, Magnetic = Magnet Whiskers), and overclocks reuse their weapon's icon with a badge drawn in code, so 24 icons cover everything. Output `icons-v1.png`, retry `icons-v2.png`.

Inputs: FX `public/art/cave-survival/fx-animation-v2.png` (the painted acorns, crystals, dust and rings to match), SPRITES (the crystal, gold block and chinchillas' designs), ENZO (style, outline and palette).

Check: `python3 scripts/cave-frame-review.py public/art/cave-survival/icons-v1.png 6 4 docs/cave-survival-icons-review-v1.json`. Also check by eye: **every cell holds its own object in the listed order, each still reads when shrunk to 48 px, and no cell has text, a frame or a backdrop.**

```
Create an icon sheet for a cosy cave game: a transparent 1536 × 1024 PNG with 6 columns × 4 rows of equal 256 × 256 cells, one icon centred in each cell.

Each icon is ONE bold, simple object, about 170 px across, painted in the same soft gouache with thin dark-plum outlines as images 1–3, seen from slightly above, with a warm light from the top left. Chunky shapes and a clear silhouette: each must still read when shrunk to 48 px. Friendly and cute, never scary. No chinchilla bodies or faces, unless a cell says so: paws and tails only where named.

Cells, left to right, top to bottom:
Row 1 (weapons):
1 Acorn Sling: a small wooden Y-slingshot with an acorn in its pouch.
2 Pickaxe Bonk: a tiny pickaxe with a wooden handle and grey head, tilted mid-swing.
3 Pebble Popper: a round grey pebble flying in an arc with a little cream splash puff under it.
4 Lantern Pulse: a small brass lantern glowing warm yellow with one soft ring around it.
5 Crystal Lance: one long pointed blue crystal shard, like image 2's crystal, angled up-right.
6 Dust Puffer: a little cloth bellows puffing a cream dust cloud.
Row 2 (weapons):
1 Twig Boomerang: a bent twig boomerang with two small leaves.
2 Seed Orbit: three sunflower seeds circling a small dot, in a ring.
3 Burrow Bomb: a round brown clay bomb with a short lit fuse and a tiny spark.
4 Glow Moths: two small round fuzzy moths with glowing pale-yellow wings.
5 Rumble Drum: a small round wooden drum with a stick resting on it.
6 Pebble Drill: a spinning cone-shaped stone drill bit with spiral grooves.
Row 3 (passives):
1 Thick Fluff: a big round puff of soft grey chinchilla fur with a small pink heart on it.
2 Quick Paws: one pink-padded chinchilla paw print with two little speed swooshes.
3 Magnet Whiskers: a red horseshoe magnet with three blue crystals drawn toward it.
4 Sharp Claws: a chinchilla paw with three small pale claws out, a tiny sparkle at one tip.
5 Busy Paws: a little brass hourglass with sand running, a tiny spark beside it.
6 Strong Arms: a small shovel stuck in a heap of brown dirt.
Row 4 (passives, then camp):
1 Lucky Tail: a fluffy grey chinchilla tail curled around a green four-leaf clover.
2 Tough Coat: a round wooden shield with a soft fur trim.
3 Prospector: a small cloth sack spilling gold nuggets.
4 Rerolls: two cream dice with dark-plum pips, tumbling.
5 Head start: a little green sprout arrow pointing up out of a dirt mound.
6 Snack: a plump raisin and a sunflower seed on a tiny leaf.

Every icon is the SAME size and weight and stays inside its own cell with at least 30 px of transparent space to every cell edge. Nothing touches a neighbouring cell.

Genuine alpha-zero transparency outside the icons. No circle, badge, frame, card, tile, backdrop, ground shadow, glow halo, text, letters, numbers or grid.
```

Retry note: `An icon is missing, in the wrong cell, sits on a disc or frame, or reaches a cell edge: draw exactly the 24 objects in the listed order, each a single object alone on transparency, smaller, with clear space all round.`

---

## Results

(Add one entry per generated sheet: file, check status, and any frame that's wrong by eye.)

- **Card and upgrade icons** (20-10-2026): `public/art/cave-survival/icons-v1.png` and retry `icons-v2.png` both **pass the script, fail the exact-object visual review**. All 24 cells of each were checked against section 10. Nothing is missing or displaced; no text/letters/numbers or backing disc/frame/card/tile was found. Bold silhouettes generally read when mentally reduced to 48 px; v2's acorn-shaped Dust Puffer is ambiguous as a cloth bellows. Exact section 10 prompt used with FX, SPRITES, ENZO in that order; v2 appends only its Retry note. Both PNGs are unmodified with their original review JSONs. **Stopped after the single retry.**

  | Row | V1 matching cells / wrong cells | V2 matching cells / wrong cells |
  | --- | --- | --- |
  | 1 weapons | C1–4 and C6 match; C5 adds a brown handle to the crystal, reading as a sword instead of one bare shard. | C1–4 match; C5 still has a brown handle; C6 substitutes an acorn-shaped bellows body for the requested cloth bellows. |
  | 2 weapons | C2–6 match; C1 is a readable twig boomerang but has three leaves rather than two. C3 also has an extra paw-print motif. | C2–6 match; C1 still has three leaves rather than two. |
  | 3 passives | C1–6 match their requested icon concepts. | C1, C4–6 match; C2 has three speed swooshes rather than two; C3 has four blue crystal pieces rather than three. |
  | 4 passives/camp | C1–6 match: tail/clover, fur-trimmed shield, gold sack, two dice, sprout-arrow and raisin/seed/leaf. | C1–6 match the same six concepts and are readable. |

- **Enzo digging, round 2** (20-10-2026): `public/art/cave-survival/enzo-dig-v3.png` **script pass, eye fail** (acorns at the chest in DONE cells 4 and 8). Retry `enzo-dig-v4.png` **script pass, eye pass** under section 9's gates: no acorn, no tool, all right-facing, with distinct RAISE/SLAM/FLING outlines in both rows. V4's row-height warning is consistent with the deliberately different poses. In both versions, FLING's paws stay nearer the chest/front than the requested sweep under the belly, though the upright tail and backward dirt clearly distinguish its outline. Size differences from ENZO were not treated as failures. Built-in generation used the section 9 prompt verbatim and **ENZO as the only input image**; v4 adds only section 9's Retry note. Both PNGs are saved unmodified with review JSONs; no prior sheet was touched.

  | Cell | Pose | V3 acorn | V4 acorn | Facing, both versions | Outline check, both versions |
  | --- | --- | --- | --- | --- | --- |
  | R1C1 (1) | RAISE | No | No | Right | Tall, paw by cheek; distinct from 2–3 |
  | R1C2 (2) | SLAM | No | No | Right | Long and low, chin near ground; distinct from 1 and 3 |
  | R1C3 (3) | FLING | No | No | Right | Upright/rocked back, tail up and dirt behind; distinct from 1–2 |
  | R1C4 (4) | DONE | Yes, chest | No | Right | Seated paw shake; not part of the 1–3 gate |
  | R2C1 (5) | RAISE | No | No | Right | Tall, paw by cheek; distinct from 6–7 |
  | R2C2 (6) | SLAM | No | No | Right | Long and low, chin near ground; distinct from 5 and 7 |
  | R2C3 (7) | FLING | No | No | Right | Upright/rocked back, tail up and dirt behind; distinct from 5–6 |
  | R2C4 (8) | DONE | Yes, chest | No | Right | Seated paw shake; not part of the 5–7 gate |

- **Enzo digging** (20-10-2026): `public/art/cave-survival/enzo-dig-v1.png` and retry `enzo-dig-v2.png` both **pass the script, fail visual review**. All eight cells in both were checked: Enzo faces right throughout and has no tool, but acorns remain (clearly in cells 1 and 8 of both); cells 3–6 repeat the same lowered front paw rather than clearly alternating. Cell 1 resembles the reference idle pose but fails the required size match: alpha > 128 bounds are 270 × 286 px in v1 and 300 × 309 px in v2, versus 181 × 188 px for ENZO row 3 column 1. Ready, two-paw push and dirt-shake poses are present in cells 2, 7 and 8; some scraping cells have more than three clods. Both outputs are unmodified 1536 × 1024 RGBA originals. Built-in image generation used section 8 verbatim with ENZO, DORA, SCENE in order; v2 adds only section 8's Retry note. Script review JSONs retain automated status `pass`. **Stopped after the failed visual retry; no other sheet was generated or changed.**

- **Rock Wyrm heads, round 2** (20-10-2026): `public/art/cave-survival/wyrm-heads-v1.png` and retry `wyrm-heads-v2.png` both **pass the script, fail visual review**. All four cells of both reviewed: right-facing sleepy, grumpy, toothless yawn-roar and spiral-eye dizzy are in order, with similar head scales, matching stone/moss/flowers, and no grey circle. No distinct tail remains, but the large segmented mass behind every face still reads as attached body pieces rather than a clearly isolated skull ending in a short neck stub; isolation is flagged for Claude's review. Both grumpy faces are half-lidded rather than wide-eyed. V1 dizzy content reaches 11 px into the upper row; v2 dizzy content starts only 1 px below its cell top, violating the requested 60 px clearance, and v2 has four stars instead of three. Roar top clearance is 42 px in v1 and 29 px in v2. Exact section 7 prompt used with GUIDE, WYRM, SPRITES in order; retry appends only its Retry note. Both PNGs are unmodified and committed with the original script review JSONs (which correctly retain automated status `pass`). No other artwork regenerated.

- **Environment round 2**: `public/art/cave-survival/environment-v3.png` **pass** by script (non-failing row 2 height warning), and **pass** on the explicit camera/texture visual gate: all five block tops are square-on rather than diamond-shaped, with loose gouache dabs rather than a pixel-art grid. All eight cells reviewed: correct object order, matching block outlines/scale, coiled roof rope, lantern and crystal crate. Row 1 column 3 cracks are stronger than hairlines; the lift roof/coil has less than the requested 40 px top clearance. No retry needed under the stated gate. Built-in image generation used the exact round-2 environment prompt with SCENE then ENVREF; result saved unmodified.
- **Floor tile**: `public/art/cave-survival/floor-v1.png` and retry `floor-v2.png` both **pass the --tile check**, but both **fail the requested exact size**: the built-in tool returned 1254 × 1254, not 1024 × 1024. V1 edge differences: left/right 9.92, top/bottom 8.53, neighbouring columns 6.13; v2: 9.89, 11.20, 6.81. Both tiles reviewed in full: dusky purple/plum gouache, scattered small pebbles and cracks, even overall lighting, no crystals/gold/objects/vignette; crack/pebble detail is more noticeable than the requested faint treatment. V2 was attempted for the dimension mismatch, using the exact floor prompt plus only its Retry note and SCENE then ENZO. Both originals and review JSONs are committed without cropping/rescaling. Continuing to Rock Wyrm under the current instruction even though exact-size compliance failed twice.
- **Rock Wyrm**: `public/art/cave-survival/wyrm-v1.png` **pass by script, fail by visual review**: all four top cells depict whole curled wyrms, not separate head pieces; row 1 columns 1–2 have almost identical sleepy/grumpy expressions. Retry `wyrm-v2.png` **fail by script** (row 2 column 4: rubble piece overhang 36 px) and **fail by visual review** (same four whole-body figures in the head row). All eight cells of both versions reviewed: heads face right; toothless yawn and spiral-eye dizzy poses, two round body pieces, tapered tail and rubble/dust are present and ordered; v2 improves sleepy-versus-grumpy differentiation. Both add small white flowers to the moss, beyond the reference design. Built-in generation used the exact section 6 prompt and SPRITES, accepted CRITTERS v2, SCENE in that order; v2 appends only the supplied Retry note. Both originals and review JSONs committed unmodified. Run complete: environment v3 passes, floor dimensions and wyrm head isolation require review; accepted Dora/critters/effects v2 were not regenerated.

- **Dora**: `public/art/cave-survival/dora-animation-v1.png` **fail** (row 2 column 4: piece overhang 28 px); retry `dora-animation-v2.png` **pass**. Both unmodified versions and their review JSONs are saved. All 24 frames reviewed: right-facing except row 4 column 2, which faces left; row 2 column 5 is close to ready instead of a distinct recoil; row 3 column 2 closes her eyes rather than just breathing/squashing. Ivory fur, red bandana, satchel, pickaxe and nearly black burgundy eyes match the references. V1 has the same recoil/idle ambiguity but its row 4 column 2 faces right. No post-generation image processing applied. Generated with the built-in image generation tool using the exact Dora prompt; v2 appends only the supplied Retry note.
- **Critters**: `public/art/cave-survival/critters-animation-v1.png` **fail** (row 1 columns 2, 6, 5: overhang 29, 30, 31 px); retry `critters-animation-v2.png` **pass**. Both versions and reviews saved unmodified. Reviewed all 24 frames in each: designs match SPRITES, heads/eyes orient right, flinch/dizzy frames and the soot/mite/beetle attack pairs are in order. Soot and mite figures look larger than half Enzo's height; beetle walk poses in row 3 columns 1–4 differ only subtly, and the lower-head/ram distinction in row 4 columns 5–6 is weak. Dizzy stars have connecting arc strokes. Generated using the exact critter prompt with listed inputs; v2 appends only its Retry note.
- **Effects**: `public/art/cave-survival/fx-animation-v1.png` **fail** (row 1 column 3: overhang 25 px); retry `fx-animation-v2.png` **pass** with non-failing row-height warnings, expected for growing/fading effects. Both unmodified versions and reviews saved. Reviewed all 24 frames in both: the requested dust, impact stars, rock chips, acorns, crystal twinkles, pickaxe arcs and floor rings are in the right cells and match the painted palette. In both versions dust is largest in row 1 column 3 and already separates in column 4; v1 adds rock chips to dust poofs. V2 row 3 columns 1–3 have very similar acorn orientations rather than successive quarter turns; both versions add curved strokes around acorns. Floor rings include connecting strokes rather than only isolated sparkles. Exact effects prompt and listed input order used; v2 appends only its Retry note.
- **Environment**: `public/art/cave-survival/environment-v1.png` **fail** (row 2 column 2: lift/rope piece overhang 49 px); retry `environment-v2.png` **fail** (same cell: overhang 25 px, exceeding the script's 24 px allowance). Both unmodified versions and reviews saved. All eight cells reviewed in each: plain dirt, gold, cracked gold, crumbling gold, purple-grey bedrock, lift, lantern post and blue-crystal crate are in order and match the reference style and camera. Row 1 column 3 has deep large cracks instead of small cracks; row 1 column 4 includes some detached chips rather than only touching chunks. The lift rope still extends into the upper row. Exact environment prompt and listed input order used; v2 appends only its Retry note. **Stopped after this second failed check as instructed; the floor tile and Rock Wyrm have not been generated.**
