> **Superseded for everything after Enzo** by [`cave-survival-animation-prompts-v2.md`](cave-survival-animation-prompts-v2.md) (19-10-2026), which sizes each sheet from the accepted Enzo v2 sheet instead of pixel boxes.

Here are the prompts: seven images, one prompt each. Paste them one at a time, and attach the two existing images as references every time: public/art/cave-survival/sprites-0.png (on the codex branch) and gameplay-style-test.png.

Every sheet uses a fixed grid with a set centre and foot line for each frame. That's what lets the game play frames in sequence without the character sliding around. Making the first Enzo
sheet took ChatGPT several correction rounds, so the layout, transparency and no-glow rules
are written into each prompt up front.
Order: do Enzo first. If his frames come back consistent, the rest will too. If they drift,
send me the image and I'll write a correction prompt.
---
                                                                                               1 · Enzo animation sheet

Create a transparent PNG sprite animation sheet, exactly 1536 × 1024 pixels: 6 columns × 4     rows of equal 256 × 256 cells. No drawn grid, no text, no numbers.
Character: Enzo, EXACTLY as in the attached sprite sheet (top-left subject): grey chinchilla,
white chest, black eyes, rounded ears, fluffy grey tail, yellow miner's helmet with a painted  lamp lens, brown satchel, carrying acorns. Same soft detailed gouache on cream paper, thin   dark-plum outlines, round cute proportions. Same camera as the attached gameplay image: high
above and in front, tilted about 55° down, three-quarter view. Enzo faces RIGHT in every
frame.                                                                                                                                                                                      Every frame shows the SAME character at the SAME size: the whole body fits in a 180 × 180 bocentred horizontally in its cell, and his feet rest on a line 30 px above the bottom of each cell. Keep his size, helmet, colours and proportions identical across all 24 frames; only the pose changes.
Rows, left to right:                                                                         Row 1, walk cycle, 6 frames: a bouncy chinchilla hop-walk loop; frame 1 and frame 6 nearly   identical so it loops; ears and tail bob with each step.                                      Row 2, throw, 6 frames: reach into satchel, wind up, overarm fling of an acorn to the right,
follow-through, settle, ready. The acorn leaves his paw in frame 4 and is NOT shown afterthat.
Row 3, idle and reactions, 6 frames: idle breathe 1, idle breathe 2 (slightly squashed), blink, startled hop when bumped (eyes squeezed shut, no injury), dizzy with little stars circling his helmet, back on his feet shaking it off.
Row 4, special, 6 frames: crouch, big spin throwing a ring of acorns (acorns may be shown in the spin frames only, close to his body), land, cheer with both paws up, happy bounce, cheer.

Background must be genuine alpha-zero transparency. No backdrop, floor, ground shadow, glow, haze, light spill from the helmet lamp, motion blur, speed lines, checkerboard or text.
Painted texture only inside his silhouette. Nothing crosses a cell edge. Friendly and nevscary.
2 · Dora animation sheet                                                                                                                                                          Create a transparent PNG sprite animation sheet, exactly 1536 × 1024 pixels: 6 columns × 4
rows of equal 256 × 256 cells. No drawn grid, no text, no numbers.
                                                                                         Character: Dora, EXACTLY as in the attached sprite sheet (top row, second subject):
ivory-white chinchilla, eyes very dark ruby-burgundy, nearly black, NEVER pink or red, roears with pink insides, fluffy white tail, red bandana, brown satchel, tiny pickaxe. Samesoft detailed gouache on cream paper, thin dark-plum outlines, round cute proportions. Same
camera as the attached gameplay image: high above and in front, tilted about 55° down,
three-quarter view. Dora faces RIGHT in every frame.
Every frame shows the SAME character at the SAME size: the whole body INCLUDING the pickaxe fits in a 200 × 190 box centred horizontally in its cell, and her feet rest on a line 30 px above the bottom of each cell. Keep her size, bandana, colours and proportions identical across all 24 frames; only the pose changes.

Rows, left to right:
Row 1, walk cycle, 6 frames: a bouncy chinchilla hop-walk loop, pickaxe held over her shoulder; frame 1 and frame 6 nearly identical so it loops.
Row 2, pickaxe bonk, 6 frames: raise pickaxe high behind her, top of the swing, swing down to the right, impact low in front (small cream dust tuft at the pick tip only), recoil, back to ready.
Row 3, idle and reactions, 6 frames: idle breathe 1, idle breathe 2 (slightly squashed), blink, startled hop when bumped (eyes squeezed shut, no injury), dizzy with little stars     circling her ears, back on her feet shaking it off.
Row 4, dig and cheer, 6 frames: dig stroke down, dig stroke up, wipe brow, cheer with picraised, happy bounce, cheer.                                                                                                                                                          Background must be genuine alpha-zero transparency. No backdrop, floor, ground shadow, glow,haze, motion blur, speed lines, checkerboard or text. Painted texture only inside her silhouette. Nothing crosses a cell edge. Friendly and never scary.

3 · Critters animation sheet                                                                                      Create a transparent PNG sprite animation sheet, exactly 1536 × 1024 pixels: 6 columns × 4rows of equal 256 × 256 cells. No drawn grid, no text, no numbers.

Characters EXACTLY as in the attached sprite sheet: the fuzzy black soot sprite with big white eyes and tiny feet; the round pink cave mite with exactly two antennae and a grumpy-cute  face; the mossy-green shelled beetle with yellow star-shaped moss flecks. Same soft detaigouache on cream paper, thin dark-plum outlines. Same camera: high above and in front, tilted about 55° down, three-quarter view. Every critter faces RIGHT.                                                                                                                         Sizes, identical in every frame of each critter, centred horizontally, standing on a linepx above the bottom of each cell: soot sprite fits 130 × 130; mite fits 140 × 120; beetle fit 200 × 170.                                                                                                                                                                            Rows, left to right:                                                                           Row 1, soot sprite: 4-frame bouncy scuttle loop (fuzz ripples, feet patter), 1 frame flin(eyes squeezed shut), 1 frame bonked dizzy (spiral eyes, a few stars).                       Row 2, pink mite: 4-frame skittering walk loop (legs alternate, antennae bob), 1 frame         flinching, 1 frame bonked dizzy.                                                         Row 3, beetle: 4-frame slow plodding walk loop (shell rocks side to side), 1 frame flinching,1 frame bonked dizzy, tipped slightly back.                                                    Row 4, attacks, 2 frames each: soot sprite crouch then pounce forward; mite rear up then nibble lunge; beetle lower its head then shell-ram forward.                                                                                                                                 They are bonked, never hurt: no injury, blood or scary faces. Background must be genuine alpha-zero transparency. No backdrop, floor, ground shadow, glow, haze, motion blur,         checkerboard or text. Nothing crosses a cell edge.                                             4 · Effects animation sheet                                                                                                                                                           Create a transparent PNG effects animation sheet, exactly 1536 × 1024 pixels: 6 columns × 4   rows of equal 256 × 256 cells. No drawn grid, no text, no numbers.                                                                                          Style: the same soft gouache on cream paper with thin dark-plum outlines as the attached     references, seen from the same high camera tilted about 55° down. Each effect is centred in   its cell and fits within the middle 200 × 200.

Rows, left to right:
Row 1, dust poof, 6 frames: a soft cream-white cloud of round puffs bursting outward, from a small tight puff (frame 1) to large and airy (frame 4), then breaking into a few drifting
wisps (frames 5–6). This is what a bonked critter turns into.
Row 2, frames 1–3: a cartoon bonk impact star, small, large, fading. Frames 4–6: brown rock chips and gold flecks bursting from a dug block, tight, spread, settling.Row 3, frames 1–4: one acorn spinning in flight, four rotations, brown cap and shiny nut.Frames 5–6: a blue crystal sparkle twinkle, small and large, painted as solid four-point starshapes.Row 4, frames 1–3: a curved pale-cream pickaxe swoosh arc sweeping left to right, start, full,
fading. Frames 4–6: a level-up ring of golden sparkles on the floor in perspective (a     flattened ellipse), small, wide, fading.
                                                                                          Fading frames are shown by smaller and sparser shapes, NOT by transparency haze. Background
must be genuine alpha-zero transparency between and around the shapes. No glow, bloom, hallight rays, backdrop, checkerboard or text. Nothing crosses a cell edge.
                                                                                          5 · Cave environment sheet
Create a transparent PNG environment sprite sheet, exactly 1536 × 1024 pixels: 4 columns ×rows of equal 384 × 512 cells. No drawn grid, no text.
Style and camera EXACTLY like the attached gameplay image: soft detailed gouache on cream paper, thin dark-plum outlines, warm cosy palette, seen from high above and in front, tilted  about 55° down, so blocks show their TOP face and their FRONT face. All blocks are the same
size: a top face 240 px wide and a front face 120 px tall, centred in the cell, its bottomedge 90 px above the bottom of the cell.
Row 1, left to right: plain brown diggable dirt block; brown block flecked with gold (matcthe attached gold cube); the gold block with small cracks; the gold block badly cracked and   starting to crumble.Row 2, left to right: a solid dark grey-purple bedrock wall block, clearly undiggable; a cosy
wooden drop pod / mine-lift cage with a little roof and a rope, about 240 wide and 340 talstanding in the cell; a wooden post with a hanging warm lantern (the lantern lens painted     bright, no light spilling outside it); a small wooden crate full of blue crystals.

Background must be genuine alpha-zero transparency. No floor, ground shadow, glow, haze, backdrop, checkerboard or text. Nothing crosses a cell edge.

6 · Cave floor tile
                                                                                         Create a SEAMLESS TILEABLE square texture, exactly 1024 × 1024 pixels: the cave floor from the
attached gameplay image, dusky purple stone, seen from high above at about 55°, so it reads
as flat ground.
                                                                                         Soft gouache texture on cream paper: gentle mottled purple and plum tones, a few faint cracks,
a scattering of tiny pebbles. It must be LOW CONTRAST and calm, because characters and
critters are drawn on top of it and must stand out; no large rocks, no crystals, no objects,
no light pools, no shadows, no vignette, no dark corners.

The left edge must continue seamlessly into the right edge and the top into the bottom, stile repeats in a grid with no visible seams. Even lighting across the whole tile. No text,
border or frame.

7 · Rock Wyrm boss sheet (second round, not needed for the prototype)
                                                                                         Create a transparent PNG boss sprite sheet, exactly 1536 × 1024 pixels: 4 columns × 2 rows of
equal 384 × 512 cells. No drawn grid, no text.

Character: the Rock Wyrm EXACTLY as in the attached sprite sheet (bottom row, second subj
chunky grey stone segments, moss tufts, small stone horns, sleepy grumpy face, friendly and
never scary. Same soft detailed gouache, thin dark-plum outlines, same camera tilted aboudown. The head faces RIGHT.

The wyrm is built from separate pieces that the game chains together:
Row 1, the HEAD only, 4 frames, the same size in each (fits 300 × 300, centred, bottom 80 pxabove the cell bottom): sleepy idle; eyes open and grumpy; mouth wide open in a big rumbling yawn-roar (no teeth, no fire); bonked dizzy with spiral eyes and stars.
Row 2, left to right: one round BODY segment (a mossy stone ball about 220 × 200, seen from the same camera); the same body segment flinching, slightly squashed with cracks of dust; the TAIL tip segment (tapering, about 220 × 180); a pile of tumbling boulders and dust as the wyrm settles when defeated (fits 300 × 260).

Background must be genuine alpha-zero transparency. No floor, ground shadow, glow, haze, backdrop, checkerboard or text. Nothing crosses a cell edge.

---

When the images come back, commit them to public/art/cave-survival/ the same way as before. I'll measure every frame and normalise any that drift on size or foot line. Then I'll build the animations: walk cycles timed to movement speed, attack frames synced to the weapons, flinch on a hit, and a dizzy frame before the poof.

I've only put these prompts here in the chat, not in the repo. I'll write the cave design document next unless you'd rather wait for the art.
