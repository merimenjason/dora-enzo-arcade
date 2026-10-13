> Historical experiment, retired from runtime. The current implementation is described in `docs/saga-rig-art.md`.

# Whisker Saga intermediate poses


## Sixteen-pose cycles · 13-10-2026

Mode: built-in image generation, using the original registered key sheets as references. Five PNGs are copied unchanged into `public/art/saga/`:

- `motion-dora-between.png` and `motion-enzo-between.png`: only the first two rows (eight walk intermediates) are selected. The generated lower action rows were rejected; separate action atlases are used instead.
- `motion-beetle-between.png`: 4 × 4; eight scuttle intermediates followed by eight bite intermediates.
- `motion-dora-action-between.png` and `motion-enzo-action-between.png`: 2 × 4; eight dedicated action intermediates.

The new drawings interleave with each original key to provide sixteen-pose walk/scuttle and action cycles. Source body pivots and paw baselines are measured without editing PNG pixels. Intermediate sheets use a common scale matched to the corresponding original clip's median physical height. Missing intermediate sheets fall back to the nearest existing key. The neutral/blink and flinch keyframes are retained. The front line is compact and diagonal: the rear member is drawn first, so its tail cannot obscure the foreground hero's opaque face. The foreground weapon envelope remains clear of the rear member's face. Neither animation timing nor depth changes gameplay, targeting or saved progress.

### Initial intermediate prompts

#### Dora

```text
Production intermediate animation poses on a genuinely transparent RGBA background. Exactly 4 equal columns by 4 equal rows, 16 complete separate figures, row-major order. No text, labels, grid, background, glow, dust, particles or shadows. Keep every ear, tail, weapon and leg within its cell, at least 12% transparent padding. Same character scale, same 3/4 side camera, same torso pivot, same supporting-foot ground line in all cells. This is an IN-BETWEEN atlas: derive each new pose halfway between adjacent keyframes from the reference, retaining exactly the face shape, body proportions, materials and costume. Do not make new dramatic key poses, do not resize or rotate the whole cutout. Move the limbs in small increments, keep head and body steady. Original keyframes are retained in the game; these new images must blend seamlessly between them.
Rows 1-2: exactly eight intermediate WALK poses between reference walk keyframes0→1,1→2,2→3,3→4,4→5,5→6,6→7,7→0. Those source keys are the reference's first two rows. Complete loop: short alternating hind paw strides, feet make clear contact, minimal head displacement. Pose each lifted paw HALF-WAY through its arc between keys, not another jump. Cloth and tail move just slightly.
Rows 3-4: exactly eight intermediate ACTION poses between action keyframes0→1,1→2,2→3,3→4,4→5,5→6,6→7,7→0. Keep body mass and face extremely consistent. Preserve the planted paw line. New poses are midpoints, not copies of the keyframes.
Only Dora, white fur, dark burgundy ruby eyes, green scarf, brown belt pouch, silver sword with gold hilt, facing RIGHT. The reference's action keys are rows3-4, sword guard→lower sword preparation→draw sword back→raise overhead→horizontal strike→lower diagonal follow-through→retract→guard. The new action rows show HALF-WAY sword angles and forepaw positions for each pair; no duplicate swords, no motion arcs.
```

#### Enzo

```text
Production intermediate animation poses on a genuinely transparent RGBA background. Exactly 4 equal columns by 4 equal rows, 16 complete separate figures, row-major order. No text, labels, grid, background, glow, dust, particles or shadows. Keep every ear, tail, weapon and leg within its cell, at least 12% transparent padding. Same character scale, same 3/4 side camera, same torso pivot, same supporting-foot ground line in all cells. This is an IN-BETWEEN atlas: derive each new pose halfway between adjacent keyframes from the reference, retaining exactly the face shape, body proportions, materials and costume. Do not make new dramatic key poses, do not resize or rotate the whole cutout. Move the limbs in small increments, keep head and body steady. Original keyframes are retained in the game; these new images must blend seamlessly between them.
Rows 1-2: exactly eight intermediate WALK poses between reference walk keyframes0→1,1→2,2→3,3→4,4→5,5→6,6→7,7→0. Those source keys are the reference's first two rows. Complete loop: short alternating hind paw strides, feet make clear contact, minimal head displacement. Pose each lifted paw HALF-WAY through its arc between keys, not another jump. Cloth and tail move just slightly.
Rows 3-4: exactly eight intermediate ACTION poses between action keyframes0→1,1→2,2→3,3→4,4→5,5→6,6→7,7→0. Keep body mass and face extremely consistent. Preserve the planted paw line. New poses are midpoints, not copies of the keyframes.
Only Enzo, grey fur, black eyes, orange scarf, brown belt pouch, wooden clover shield with gold rim in the same forepaw, facing RIGHT. Reference1 rows1-2 provide the walk keys and exact identity. Reference2 is the eight action keys, arranged2columns4rows: upright guard→crouch→brace→push off→extended bash→begin retracting→recover→guard. The action in-betweens must use reference2's sequence. Keep the face and body proportions identical to reference1 for ALL sixteen frames; action forearm extension subtle and anatomically short.
```

#### Beetle

```text
Production intermediate animation poses on a genuinely transparent RGBA background. Exactly 4 equal columns by 4 equal rows, 16 complete separate figures, row-major order. No text, labels, grid, background, glow, dust, particles or shadows. Keep every ear, tail, weapon and leg within its cell, at least 12% transparent padding. Same character scale, same 3/4 side camera, same torso pivot, same supporting-foot ground line in all cells. This is an IN-BETWEEN atlas: derive each new pose halfway between adjacent keyframes from the reference, retaining exactly the face shape, body proportions, materials and costume. Do not make new dramatic key poses, do not resize or rotate the whole cutout. Move the limbs in small increments, keep head and body steady. Original keyframes are retained in the game; these new images must blend seamlessly between them.
Rows 1-2: exactly eight intermediate WALK poses between reference walk keyframes0→1,1→2,2→3,3→4,4→5,5→6,6→7,7→0. Those source keys are the reference's first two rows. Complete loop: short alternating hind paw strides, feet make clear contact, minimal head displacement. Pose each lifted paw HALF-WAY through its arc between keys, not another jump. Cloth and tail move just slightly.
Rows 3-4: exactly eight intermediate ACTION poses between action keyframes0→1,1→2,2→3,3→4,4→5,5→6,6→7,7→0. Keep body mass and face extremely consistent. Preserve the planted paw line. New poses are midpoints, not copies of the keyframes.
Only the olive green scuttler beetle, gold shell accents, amber eyes, two antennae, exactly SIX articulated legs, facing LEFT. Reference rows3-4 are bite action keys. Interpolate alternating-tripod foot positions, mandibles and antennae. Shell stays level with a completely consistent size and shape; do not rock it up and down.
```

### Dedicated action intermediates

#### Dora

```text
Production transparent game sprite sheet. Exactly TWO columns FOUR rows, eight carefully specified intermediate SWORD poses for Dora. Match the supplied reference's exact white fluffy chinchilla, dark burgundy ruby eyes, green scarf, brown belt pouch, short silver sword with gold hilt, same near forepaw grip, right-facing three-quarter view. Same head shape, body scale, lighting and grounded paw line for all eight drawings. Full body, ears, tail and blade visible inside each cell with12% safety gutters. No text, labels, grid, shadows, motion trails, glow or background.
Read poses left-to-right row-by-row:
0 forearm at waist height, sword pointing HORIZONTALLY RIGHT, halfway between upward guard and lowered preparation.
1 forearm half raised, sword pointing steeply UP AND RIGHT at about65degrees above horizontal; hips slightly lowered. This is midway through bringing the sword back and up.
2 sword drawn BACK, tip pointing UP AND LEFT; forepaw raised halfway toward overhead; elbow bent, feet planted.
3 forepaw ABOVE head and sword pointing almost VERTICALLY UP, leaning a little right (80degrees above horizontal), preparing to accelerate forward. Do not point the blade left in this frame.
4 forepaw clearly extended RIGHT, sword pointing slightly DOWN AND RIGHT at20degrees below horizontal; front paw supports weight after contact.
5 retract the extended forearm halfway, sword pointing RIGHT with just8degrees downward angle; hips begin returning to guard. Do not point the sword steeply down.
6 forearm close to body, sword pointing UP RIGHT in normal guard, head/ears settling.
7 recovered normal UP RIGHT sword guard, steady breathing pose.
These are intermediate images to be interleaved with existing keyframes. Exact blade directions and gradually changing arm extension are essential. No duplicate blades or missing paws. Keep short animal limbs and consistent cute round anatomy.
```

#### Enzo

```text
Transparent game sprite sheet, exactly TWO columns by FOUR rows, eight new intermediate poses. The supplied sheet is the EXISTING EIGHT KEYFRAMES of Enzo's shield bash, read left-to-right row-by-row. Produce ONLY HALF-WAY POSES between those existing keyframes:
new0 halfway old0→old1, knees just beginning to bend, shield halfway down.
new1 halfway old1→old2, hips lowered, shield halfway toward brace, free forepaw halfway back.
new2 halfway old2→old3, shield forearm pushing HALF-WAY forward, torso weight moving forward.
new3 halfway old3→old4, near forearm ALMOST FULLY EXTENDED to the right, shield visibly away from chest, front hind paw planted.
new4 halfway old4→old5, forearm stays clearly extended but shield begins moving toward chest.
new5 halfway old5→old6, shield arm bent halfway back, hips begin rising.
new6 halfway old6→old7, near upright recovered guard.
new7 halfway old7→old0, settled guard matching the first pose.
DO NOT draw eight copies with shield against chest: new2,3,4,5 MUST visibly extend and retract the shield arm as described. EXACTLY match the reference's Enzo: grey fluffy chinchilla, black eyes, orange scarf, brown belt pouch, wooden clover shield gold rim, right facing 3/4 profile; retain the original head/body size, camera, fur finish, face expression, limb proportions and the SAME paw holding shield. These images will be interleaved with the originals; consistency is essential. Fixed body pivot and planted-foot line across frames. Exactly two short hind paws and two forepaws. Full ears, tail, and entire shield within every cell, at least12% safety gutters. No text, border, dust, glow, particles, ground, shadow, colour background; transparent alpha only.
```

### Beetle framing repair

```text
Edit the attached beetle intermediate atlas only. Keep exactly all sixteen distinct articulated poses, same order in four columns and four rows, same body/shell/eyes/legs, same camera and paint style. Shrink every complete beetle to75% of its current footprint WITHIN its own cell, at uniform scale. Recenter all body pivots at50% cell width and supporting paws at82% cell height. Ensure at least10% empty transparent margin all around every full antenna and leg. Some feet at the far right currently touch the image edge; restore their complete pointed tarsi and move them inward with the figure. No toe, leg, antenna or mandible may touch a cell or outer image border. Preserve distinct leg/mandible motion and original proportions. No text or lines, no colour/background/shadows/glow/particles. Transparent alpha only. This is framing repair, not a new sequence.
```
