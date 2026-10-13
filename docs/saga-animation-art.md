> Historical experiment, retired from runtime. The current implementation is described in `docs/saga-rig-art.md`.

# Whisker Saga pose animation


## Pose animation production pass · 13-10-2026

Mode: built-in image generation, with the approved pose storyboard and original character sheets as references. The PNGs are copied unchanged into `public/art/saga/`; read-only alpha/component analysis produces `lib/saga-animation-crops.ts`. Runtime extraction removes neighbouring fragments and detached background specks. Every frame retains its measured body pivot, supporting-foot baseline and a common scale for its sheet; it is not independently resized to its changing bounding box.

Assets:

- `motion-dora.png`, `motion-enzo.png`, `motion-beetle.png`: 4 columns × 6 rows; 8 walk/scuttle poses, 8 action poses, 4 idle/blink poses, 4 flinch poses, in row-major order.
- `motion-enzo-action.png`: 2 columns × 4 rows, stronger shield-bash sequence. Enzo's ordinary attacks use this sheet; his ward braces using the original sheet rather than mimicking a bash.

`lib/saga-animation.ts` selects poses from actual movement, cooldown anticipation, hit/cast events and hurt recovery. Contact frames begin when the hit event arrives; basic-attack recovery then plays once. Walks advance from road travel, with opposite contact phases for neighbours. Each character completes the step to a planted-foot contact before settling, rather than freezing mid-stride. The front line uses compact diagonal depth so the rear member’s tail is drawn behind the nearer hero’s face, while the smaller rear row keeps teammates visible. See `docs/saga-inbetween-art.md` for the sixteen-pose extension. Pause freezes the clock and rendered pixels. Reduced motion and defeated/stunned units hold a neutral pose. Atlases load on demand; missing sheets fall back to the existing painted characters and can retry without blocking play. Dora, Enzo and the scuttler are the approved first set; the other heroes and enemies retain their existing movement. Gameplay, rewards and saved progress are unchanged.

Exact initial prompts:

### Dora

```text
Use case: stylized-concept. Production game animation sprite atlas, transparent background, no text, no labels, no dividers, no ground, no shadows, no lighting backdrop. Match the approved storybook painted fur/shell rendering from references. Strict four equal columns and six equal rows, 24 fully separated poses, row-major order. Portrait image 1536 by 2048 if possible. Each cell identical size, subject body anchored at horizontal 50% of that cell, planted foot baseline at 88% cell height, head top around 20%, plenty of empty safety margins around ALL tails, weapons, ears and limbs. Fixed scale and consistent anatomy in ALL frames. Actually articulate limbs, do not just rotate or bounce one cutout. Keep the same camera, facing and identity. No motion trails or glowing effects; runtime adds them. Reference 1 is the approved keyframe storyboard, reference 2 is Dora's exact appearance. ONLY Dora, white chinchilla, dark burgundy ruby eyes, green scarf, brown belt pouch, silver sword with gold hilt in same forepaw, facing RIGHT.
Rows 1-2: eight sequential looping WALK frames, 0 contact left hind paw forward/right behind, 1 weight down, 2 passing right hind paw lifted past planted left, 3 right hind paw reaches ahead, 4 opposite contact right forward/left behind, 5 weight down opposite, 6 passing left lifted, 7 left reaches ahead into next contact. Short hind legs, upright fluffy body, exactly two hind paws/two forepaws, sword held in guard consistently. Tail and scarf trail with gentle follow-through, no jumping.
Rows 3-4: eight SWORD ATTACK frames: guard, crouched preparation with arm bending sword back, windup farther back, acceleration raising sword, extended horizontal rightward strike, downward follow-through, sword arm retracts, upright recovered guard. Sword clearly changes position, feet support weight throughout.
Row 5: four IDLE frames: guard eyes open, gentle breath, blink eyes closed, eyes reopening. Same guard silhouette.
Row 6: four HURT frames: small flinch, crouched recoil with narrowed eyes, regain footing, return to guard. No injury, no new costume.
```

### Enzo

```text
Use case: stylized-concept. Production game animation sprite atlas, transparent background, no text, no labels, no dividers, no ground, no shadows, no lighting backdrop. Match the approved storybook painted fur/shell rendering from references. Strict four equal columns and six equal rows, 24 fully separated poses, row-major order. Portrait image 1536 by 2048 if possible. Each cell identical size, subject body anchored at horizontal 50% of that cell, planted foot baseline at 88% cell height, head top around 20%, plenty of empty safety margins around ALL tails, weapons, ears and limbs. Fixed scale and consistent anatomy in ALL frames. Actually articulate limbs, do not just rotate or bounce one cutout. Keep the same camera, facing and identity. No motion trails or glowing effects; runtime adds them. Reference 1 is approved storyboard; reference 3 TOP MIDDLE hero is Enzo. ONLY Enzo, grey fluffy chinchilla, black eyes, orange scarf, brown belt pouch, round wooden clover shield with gold rim in same forepaw in ALL frames, facing RIGHT.
Rows 1-2: eight sequential looping WALK frames: 0 left hind foot forward/right behind; 1 weight down; 2 passing right foot lifted past planted left; 3 right foot reaches forward; 4 opposite contact right forward/left behind; 5 down opposite; 6 passing left lifted; 7 left reaches forward. Exactly two short hind paws and two forepaws, no long human limbs, no bouncing/hopping. Shield stays coherent, free forepaw counterbalances. Tail trails, minimal head displacement.
Rows 3-4: eight SHIELD ACTION frames: guard, lower hips, brace shield close to chest, thrust shield forward, extended shield bash with weight on forward hind paw, retract shield, regain footing, return upright guard. No sword, no magical sphere, shield is the ONLY weapon.
Row 5: four IDLE frames: open eyes guard, breath, blink closed, reopen. Same size.
Row 6: four HURT frames: slight flinch behind shield, compressed guard recoil, regain footing, return guard.
```

### Beetle

```text
Use case: stylized-concept. Production game animation sprite atlas, transparent background, no text, no labels, no dividers, no ground, no shadows, no lighting backdrop. Match the approved storybook painted fur/shell rendering from references. Strict four equal columns and six equal rows, 24 fully separated poses, row-major order. Portrait image 1536 by 2048 if possible. Each cell identical size, subject body anchored at horizontal 50% of that cell, planted foot baseline at 88% cell height, head top around 20%, plenty of empty safety margins around ALL tails, weapons, ears and limbs. Fixed scale and consistent anatomy in ALL frames. Actually articulate limbs, do not just rotate or bounce one cutout. Keep the same camera, facing and identity. No motion trails or glowing effects; runtime adds them. Reference 1 approved storyboard, reference 4 TOP LEFT is green scuttler beetle. ONLY this olive-green armoured beetle with gold shell accents, two amber eyes, mandibles, two antennae, exactly SIX articulated legs. Facing LEFT in fixed three-quarter side view. Every cell beetle body anchor 50%, body top ~30%, feet baseline 88%. Keep shell low and same size.
Rows 1-2: eight sequential looping SCUTTLE frames with alternating tripod gait: tripod A support / B reaching, A push / B swing, B lowers, weight transfers, tripod B support / A reaching, B push / A swing, A lowers, weight transfers back. Six clear legs changing joint and foot positions; shell stays level. Antennae slightly lag.
Rows 3-4: eight BITE ATTACK frames: guard, lower front of shell, mandibles open preparing, front legs extend, jaws close forward, pull back, regain tripod stance, return guard. Do not leap.
Row 5: four IDLE frames with antennae twitch then settle, mandibles subtly open/close.
Row 6: four HURT frames: mandibles wince, front legs buckle slightly, regain stance, recover. No damage to shell.
```

### Gutter correction, applied separately to each atlas

```text
Edit target: attached animation atlas. Preserve the exact character identity, paint style, facing direction and each of the 24 distinct articulated poses in row-major order. Re-layout only for production-safe framing. Strict 4 columns by 6 rows of equal cells. The current figures are too large and swords/legs/shields touch adjacent cells and outer image edges. Reduce EACH complete figure to about 70% of its current scale, keeping them equal scale to each other. Each cell must have at least 16% empty width on both sides, 12% empty height above and below, with torso at horizontal50% and supporting paws at vertical85% of its cell. Full sword swings, ears, tails, shields, antennae and feet all preserved and entirely inside own cell. Restore any tiny extremities previously touching outer edge. Keep poses and limb differences; do not replace with identical stills. Transparent RGBA background: remove ALL white/coloured background specks, glow and stray particles outside actual fur/shell. No shadows, no background, no labels, no gridlines. This is a game-ready sprite atlas; deliberate visible transparent gutters between every frame are mandatory.
```

### Enzo shield action

```text
Use case: stylized-concept. Transparent production sprite atlas. Exactly TWO columns and FOUR rows, 8 distinct sequential Enzo SHIELD BASH poses. The attached original character atlas top-middle is Enzo: grey fluffy chinchilla, black eyes, orange neckerchief, brown belt pouch, round brown wooden clover shield with gold rim. Match exactly its lovely richly painted fur and lighting. ONLY Enzo facing RIGHT throughout, identical size, same forepaw holding shield throughout. Full bodies and all tail and shield edges within each cell with at least 15% blank margin left/right and 12% above/below. No background, shadow, effect, text, label, extra objects or frame border. Equal cells, torso centered at50% x, feet baseline85% y.
Frame0 upright guard with shield in front of chest.
Frame1 lower hips, bend both hind knees, tuck shield close; feet plant.
Frame2 crouch deeper and draw shield arm back toward torso, opposite free forepaw counterbalances.
Frame3 PUSH OFF rear hind foot, extend near shield forearm clearly forward to the RIGHT. Torso leans into movement.
Frame4 FULL IMPACT: visibly outstretched shield arm and shield as far right as safely fits. Shield is away from body, NOT held tight to chest. Forward hind foot plants, rear hind foot extends, body low.
Frame5 shield stays extended but starts retracting; torso settles over planted front foot.
Frame6 draw shield back halfway, straighten hind legs.
Frame7 recovered upright guard matching frame0.
These MUST be distinct articulated actions, not eight copies of standing guard. Short animal limbs, coherent anatomy, no human proportions. All paws keep consistent structure. Entire shield fully visible in impact pose.
```
