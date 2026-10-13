# Whisker Saga stable painted rigs

13-10-2026. Mode: built-in image generation, using the original painted character artwork as references.

Runtime assets are `public/art/saga/rig-dora.png`, `rig-enzo.png` and `rig-beetle.png`. Each contains eight reusable painted parts. PNGs are copied unchanged; `lib/saga-rig-crops.ts` records complete connected-part bounds from read-only analysis. Independent generated animation poses have been retired from runtime loading because their changing anatomy and paint detail caused visible morphing.

Hero part order: head, torso/scarf/belt, tail, far hind leg/paw, near hind leg/paw, far forearm, near forearm, sword or shield. Beetle order: shell/body/head, front leg, middle leg, rear leg, far antenna, near antenna, far mandible, near mandible. Measured bounds may cross the nominal atlas cell lines; extraction preserves each complete part.

`lib/saga-animation.ts` computes continuous joint positions. Paws move backward on a planted stance, then return along a small eased arc. The hip stays attached while one small hip-to-ankle bend connects to a rigid paw; the sole stays horizontal. Body, face, fur texture and scale remain constant. Tail and head movement is restrained; attacks rotate the same forearm and weapon around their joints. Weapon placement derives from the fitted forearm's grip geometry. There are no frame swaps, no image crossfades and no whole-body marching hops. Left-facing beetles reverse the foot trajectory and advance their gait from actual screen travel; paused or stationary feet do not churn. The scene's road speed and stride pace are slower, the stop follows the remaining road travel and lowers a lifted paw vertically where it is, preserving each planted foot instead of continuing a synthetic stride or sliding back to zero. Pause freezes the clock; reduced motion holds the joints still. Three part atlases load on demand, with the existing painted image as a playable fallback.

Original poses and intermediate experiments are archived outside the runtime under the project outputs; they are not requested by the game. Other heroes and enemies retain the original restrained painted transforms. Gameplay, rewards, targeting and saves are unchanged.

## Exact prompts

### Dora

```text
Use case: stylized-concept. Transparent game animation RIG PARTS atlas, NOT animation frames. Exactly FOUR equal columns and TWO equal rows, eight isolated connected parts. No text, labels, dividers, background, shadows, glow, particles or extra figures. Each complete part has generous transparent margins and never touches a neighbouring cell or image border. Match the reference's painterly fur/material, light direction and character identity precisely. All eight parts belong to ONE character and must assemble into the reference's neutral right-facing three-quarter standing pose. No duplicate whole characters. Parts have smooth fur overlap at their root ends; no sharp severed anatomical cuts. Only Dora: white fur, dark burgundy ruby eyes, pink inner ears, green neckerchief, brown belt/pouch, silver sword gold hilt. Reference exact look.
Row1 cell0: HEAD ONLY, both round ears, face, eyes, muzzle, whiskers, fluffy lower jaw. No torso, arms or scarf. Right-facing.
Row1 cell1: ROUND TORSO ONLY, from fuzzy neck to lower belly, green scarf around upper chest and brown belt with small side pouch. No head, tail, feet or arms. Seamless white fur beneath the arm areas so animated arms can uncover it.
Row1 cell2: WHOLE FLUFFY CURLED TAIL ONLY, attached base at lower-right, plume rising and curling upper-left.
Row1 cell3: FAR HIND LEG AND PAW ONLY, short furry upper limb, pink sole and three small toes pointing right; upper knee at top, paw at bottom.
Row2 cell0: NEAR HIND LEG AND PAW ONLY matching other leg, furry root at top, complete pink sole/rightward toes at bottom.
Row2 cell1: FAR FOREARM AND PAW ONLY, short furry shoulder root upper-left, paw lower-right; no weapon.
Row2 cell2: NEAR FOREARM AND GRIPPING PAW ONLY, short furry shoulder root upper-left, paw lower-right curled to grip a sword. Do not include sword.
Row2 cell3: SILVER SWORD WITH GOLD HILT ONLY, horizontal, grip and pommel at LEFT, blade pointing RIGHT. No paw. Complete blade tip.
No blood or exposed cut surfaces; these are clean toy-like layered animation components, not dismemberment.
```

### Enzo

```text
Use case: stylized-concept. Transparent game animation RIG PARTS atlas, NOT animation frames. Exactly FOUR equal columns and TWO equal rows, eight isolated connected parts. No text, labels, dividers, background, shadows, glow, particles or extra figures. Each complete part has generous transparent margins and never touches a neighbouring cell or image border. Match the reference's painterly fur/material, light direction and character identity precisely. All eight parts belong to ONE character and must assemble into the reference's neutral right-facing three-quarter standing pose. No duplicate whole characters. Parts have smooth fur overlap at their root ends; no sharp severed anatomical cuts. Only Enzo, the TOP-MIDDLE grey chinchilla in the reference hero atlas: grey fur, black eyes, orange neckerchief, brown belt/pouch, wooden clover shield gold rim. Right-facing, exactly that identity.
Row1 cell0: HEAD ONLY, both ears, face, eyes, muzzle, whiskers, fluffy lower jaw. No torso, arms or scarf.
Row1 cell1: ROUND TORSO ONLY, fuzzy neck to lower belly, orange neckerchief on upper chest, brown belt with small side pouch. No head, tail, legs or arms. Seamless grey fur behind the arm areas.
Row1 cell2: WHOLE FLUFFY CURLED TAIL ONLY, attached base at lower-right, plume rising/curling upper-left.
Row1 cell3: FAR HIND LEG AND PAW ONLY, short furry upper limb root at top, pink sole and three small rightward toes at bottom.
Row2 cell0: NEAR HIND LEG AND PAW ONLY matching far one.
Row2 cell1: FAR FOREARM AND PAW ONLY, short fuzzy shoulder root upper-left, paw lower-right, no object.
Row2 cell2: NEAR FOREARM AND GRIPPING PAW ONLY, short furry shoulder root upper-left, gripping paw lower-right. No shield.
Row2 cell3: WHOLE ROUND WOODEN CLOVER SHIELD ONLY with gold rim, same three-quarter oval perspective. No paw.
Clean overlapping fur-root animation components; no exposed anatomy, no blood.
```

### Scuttler

```text
Transparent game rig-parts atlas, exactly FOUR columns TWO rows, eight individual connected parts for the TOP LEFT olive-green beetle in the reference. Same painted green/gold shell, angry amber eyes and left-facing 3/4 view. No text, labels, gridlines, shadows, glow, particles or background. Generous clear margins around each complete part. All parts assemble into one coherent beetle.
Row1 cell0: COMPLETE SHELL, BODY AND HEAD with amber eyes, NO legs, antennae or mandibles. Low continuous carapace, head faces left; smooth lower-head surface at jaw attachment.
Row1 cell1: ONE FRONT LEG, root at upper-right, jointed green limb bending down-left with pointed complete tarsus at lower-left.
Row1 cell2: ONE MIDDLE LEG, root upper-middle, jointed green limb bending down with pointed tarsus lower-middle.
Row1 cell3: ONE REAR LEG, root upper-left, jointed green limb bending down-right, pointed tarsus lower-right.
Row2 cell0: FAR ANTENNA, root at lower-right, thin connected segmented bronze/green curve arching up-left to a rounded tip.
Row2 cell1: NEAR ANTENNA matching far one, root lower-right, arch up-left, complete connected tip.
Row2 cell2: FAR MANDIBLE, green jaw root at upper-right, a single small amber/tan pointed pincer curving down-left.
Row2 cell3: NEAR MANDIBLE matching opposite pincer, green root upper-right, claw down-left. No body.
Each part is a separate isolated animation component. No duplicate full beetles. Preserve solid painted detailing and connected silhouettes.
```
