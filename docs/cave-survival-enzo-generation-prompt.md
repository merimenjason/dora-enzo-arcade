# Enzo animation generation prompt

Generated with the built-in image_gen tool. Reference images: public/art/cave-survival/sprites-0.png and public/art/cave-survival/gameplay-style-test.png.

Create a transparent PNG sprite animation sheet, exactly 1536 × 1024 pixels: 6 columns × 4 rows of equal 256 × 256 cells. No drawn grid, no text, no numbers.
Reference image 1 is the existing sprite sheet: use its TOP LEFT character as Enzo's exact character design. Reference image 2 is the gameplay style test: use its camera and gouache material style, not its composition or backdrop.
Character: Enzo, EXACTLY as in the attached sprite sheet (top-left subject): grey chinchilla, white chest, black eyes, rounded ears, fluffy grey tail, yellow miner's helmet with a painted lamp lens, brown satchel, carrying acorns. Same soft detailed gouache on cream paper, thin dark-plum outlines, round cute proportions. Same camera as the attached gameplay image: high above and in front, tilted about 55° down, three-quarter view. Enzo faces RIGHT in every frame.
Every frame shows the SAME character at the SAME size: the whole body fits in a 180 × 180 box centred horizontally in its cell, and his feet rest on a line 30 px above the bottom of each cell. The six column centres are x=128,384,640,896,1152,1408. Foot lines are y=226,482,738,994. Keep his size, helmet, colours and proportions identical across all 24 frames; only the pose changes. Leave empty space around every figure; never enlarge figures to fill cells.
Rows, left to right:
Row 1, walk cycle, 6 frames: a bouncy chinchilla hop-walk loop; frame 1 and frame 6 nearly identical so it loops; ears and tail bob with each step.
Row 2, throw, 6 frames: reach into satchel, wind up, overarm fling of an acorn to the right, follow-through with release in this frame, settle, ready. The acorn leaves his paw in frame 4 and is NOT shown after that.
Row 3, idle and reactions, 6 frames: idle breathe 1, idle breathe 2 (slightly squashed), blink, startled hop when bumped (eyes squeezed shut, no injury), dizzy with little stars circling his helmet, back on his feet shaking it off.
Row 4, special, 6 frames: crouch, big spin throwing a ring of acorns (acorns may be shown in the spin frames only, close to his body), land, cheer with both paws up, happy bounce, cheer.
Background must be genuine alpha-zero transparency. No backdrop, floor, ground shadow, glow, haze, light spill from the helmet lamp, motion blur, speed lines, checkerboard or text. Painted texture only inside his silhouette. Nothing crosses a cell edge. Friendly and never scary.
