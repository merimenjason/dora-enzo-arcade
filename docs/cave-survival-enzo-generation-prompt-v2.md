# Enzo animation v2 correction prompt

Generated using the built-in image_gen tool with the three repository image inputs listed below, from parent commit 90d9a79. The draft is preserved. Output: `public/art/cave-survival/enzo-animation-v2.png`.

Image inputs:
- image 1: Enzo's animation draft sheet, the sheet to edit.
- image 2: hero-6x4.png, LAYOUT GUIDE ONLY.
- image 3: sprites-0.png, character reference.

Edit image 1, Enzo's animation sheet. Keep Enzo's design EXACTLY as it is in image 1: grey fur, white chest, black eyes, yellow miner's helmet with painted lamp lens, brown satchel, fluffy grey tail, soft gouache with thin dark-plum outlines. Keep the 1536 × 1024 canvas and the 6 columns × 4 rows of 256 × 256 cells. Correct only size, placement and the poses listed below.

Image 2 is a LAYOUT GUIDE ONLY. Do NOT draw any of its lines, boxes, arrows or white background. In every cell:
- Enzo's whole body, including tail, ears and helmet, fits INSIDE the blue box (160 × 160, centred in the cell). He is noticeably SMALLER than in image 1, about 80% of his current size, with wide empty transparent space around him.
- His feet rest exactly on the red line, 48 px above the bottom of the cell, in every frame except the airborne frames named below, where his body rises but stays within the blue box.
- He faces RIGHT (toward the green arrow), three-quarter view from the same high camera tilted about 55° down, in EVERY frame.
- He is the SAME size in all 24 frames.

Pose fixes, left to right within each row:
Row 1 walk cycle: make the six frames a clearly different bouncy hop-walk: 1 contact, 2 crouch, 3 push-off, 4 airborne (body lifted, feet tucked), 5 landing, 6 almost the same as 1. Feet and tail must visibly change between frames.
Row 2 throw: frame 4 shows ONE acorn clearly just leaving his raised paw, to the right of his body and inside the blue box. No acorn in his paw in frames 5 and 6.
Row 3: frame 4 is a startled hop, both feet off the red line, eyes squeezed shut. Frame 5 dizzy: the little stars circle his helmet and stay inside the blue box. Frame 6: shaking it off with NO motion lines.
Row 4: frames 2 and 3 are the spin, but he still FACES RIGHT toward the viewer: frame 2 crouched and twisting with arms out and 3 acorns close to his paws; frame 3 mid-spin, three-quarter front view, 4 acorns flying out close around him, all inside the blue box. No rings, swirls or motion lines.

Everywhere: genuine alpha-zero transparency outside Enzo. NO glow from the helmet lamp, no halo, haze, backdrop, shadow, motion lines, speed lines, grid, guide lines or text. Nothing crosses a cell edge.
