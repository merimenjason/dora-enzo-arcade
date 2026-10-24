# Grumble Hunt art

Created 24-10-2026 for `dora-enzo-arcade` on `codex/grumble-hunt-art`.

Warm hand-painted storybook assets for a gentle children's 3D adventure. The beasts are grumpy and unharmed; there is no blood, injury, frightening imagery, text, logo, or watermark. Artwork was generated and revised with the built-in imagegen tool.

## Files

All 13 images are WebP encoded with libwebp `cwebp -q 85 -m 6`. Foliage cards use `-alpha_q 100` to preserve their full alpha channel. File sizes below are the final encoded sizes, in bytes and binary KiB.

| File | Dimensions (px) | Bytes | KiB | Channels |
| --- | --- | ---: | ---: | --- |
| `public/art/hunt/tex-meadow-grass.webp` | 1024 × 1024 | 235,878 | 230.3 | RGB |
| `public/art/hunt/tex-meadow-dirt.webp` | 1024 × 1024 | 175,116 | 171.0 | RGB |
| `public/art/hunt/tex-bark.webp` | 512 × 1024 | 55,056 | 53.8 | RGB |
| `public/art/hunt/tex-rock.webp` | 1024 × 1024 | 157,398 | 153.7 | RGB |
| `public/art/hunt/tex-boar-fur.webp` | 1024 × 1024 | 104,802 | 102.3 | RGB |
| `public/art/hunt/sky-meadow.webp` | 4096 × 2048 | 299,810 | 292.8 | RGB |
| `public/art/hunt/leaf-cluster.webp` | 512 × 512 | 43,070 | 42.1 | RGBA |
| `public/art/hunt/grass-tuft.webp` | 256 × 256 | 21,422 | 20.9 | RGBA |
| `public/art/hunt/ref-bristleback.webp` | 2048 × 1024 | 93,654 | 91.5 | RGB |
| `public/art/hunt/ref-puffwart.webp` | 2048 × 1024 | 63,096 | 61.6 | RGB |
| `public/art/hunt/ref-skreel.webp` | 2048 × 1024 | 88,588 | 86.5 | RGB |
| `public/art/hunt/ref-hornclack.webp` | 2048 × 1024 | 71,432 | 69.8 | RGB |
| `public/art/hunt/ref-frostmane.webp` | 2048 × 1024 | 100,302 | 98.0 | RGB |

Total image payload: **1,509,624 bytes (1.44 MiB)**.

## Export and verification

The generator returned square sources at 1254 × 1254, the bark at 887 × 1774, and the sky and beast sheets at 1774 × 887. Final exports were resized to the exact requested dimensions; the 4096 × 2048 sky and 2048 × 1024 reference sheets are upscaled from those generated sources.

The five material textures received an imagegen seam revision, followed by periodic/smooth boundary correction and a smooth border match during export. The sky received a horizontal seam revision and a smooth left/right border match. Texture interiors retain the painted artwork; the sky's top and bottom are deliberately different. The sky uses the requested 2:1 panorama layout with distant hills confined to the bottom approximately 15% and no sun disc.

Verified that all 13 final files decode as WebP at their requested sizes. Inspected 2 × 2 repeats of all five decoded surface textures and a crop crossing the sky's left/right wrap. Opposite borders match before lossy encoding; small pixel differences from WebP compression remain. Both foliage cards retain alpha values from 0 through 255, including partially transparent edge pixels, and the grass has opaque pixels touching the bottom edge. Inspected the beast sheets for the side/front/three-quarter layout, consistent scale, readable forms, and child-friendly expressions. Temporary inspection images are excluded from the deliverables. No game code was changed.

## Prompts

Each initial prompt below is the exact prompt sent for that asset. The six repeatable assets also used the exact seam-edit prompts recorded at the end of this document, with their initial generated image supplied as the edit target.

### tex-meadow-grass

File: `public/art/hunt/tex-meadow-grass.webp`
Size: 1024 × 1024 px; 235,878 bytes.
Revision: shared four-edge texture seam edit below.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: seamless repeatable diffuse/albedo ground texture, square 1024x1024. Painted meadow ground, short grass clumps, a few tiny clover leaves, mid green. Straight-down orthographic surface only, fills the entire canvas. Perfectly periodic seamless tiling on ALL FOUR edges: left continues into right, top into bottom, no border. Uniform small-scale details throughout, no focal composition. Even flat lighting, no cast shadows, no baked highlights, no vignette, no directional shading, no perspective or horizon.
```

### tex-meadow-dirt

File: `public/art/hunt/tex-meadow-dirt.webp`
Size: 1024 × 1024 px; 175,116 bytes.
Revision: shared four-edge texture seam edit below.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: seamless repeatable diffuse/albedo ground texture, square 1024x1024. Painted packed earth path surface, warm tan, a few small pebbles. Straight-down orthographic surface only, fills the entire canvas. Perfectly periodic seamless tiling on ALL FOUR edges: left continues into right, top into bottom, no border. Uniform small-scale details throughout, no path boundaries or focal composition. Even flat lighting, no cast shadows, no baked highlights, no vignette, no directional shading, no perspective or horizon.
```

### tex-bark

File: `public/art/hunt/tex-bark.webp`
Size: 512 × 1024 px; 55,056 bytes.
Revision: shared four-edge texture seam edit below.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: seamless repeatable diffuse/albedo bark texture, portrait 512x1024, aspect ratio 1:2. Painted tree bark, warm brown vertical grooves. Straight-on orthographic flat unwrapped surface, equivalent to straight above the texture plane, fills the entire canvas. Perfectly periodic seamless tiling on ALL FOUR edges: left continues into right, top into bottom, continuous grooves. Uniform detail distribution, no trunk outline, no foliage. Even flat lighting, no cast shadows, no baked highlights, no vignette, no directional lighting or perspective.
```

### tex-rock

File: `public/art/hunt/tex-rock.webp`
Size: 1024 × 1024 px; 157,398 bytes.
Revision: shared four-edge texture seam edit below.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: seamless repeatable diffuse/albedo texture, square 1024x1024. Painted grey boulder surface with soft shallow cracks and a little moss. Straight-down orthographic flat surface fills the entire canvas; no boulder silhouette. Perfectly periodic seamless tiling on ALL FOUR edges, opposite edges match continuously. Uniform detail density and grey colour distribution; subtle moss flecks. Even flat illumination, no cast shadows or baked highlights, no vignette, no gradients, no perspective.
```

### tex-boar-fur

File: `public/art/hunt/tex-boar-fur.webp`
Size: 1024 × 1024 px; 104,802 bytes.
Revision: shared four-edge texture seam edit below.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: seamless repeatable diffuse/albedo fur texture, square 1024x1024. Short coarse brown boar fur brush strokes, all running vertically in one direction; only TWO CLOSE warm brown tones, very low contrast. Texture surface only, uniformly distributed fine short strokes, no animal outline or body parts. Perfectly periodic seamless tiling on ALL FOUR edges, opposite edges continue perfectly. Straight-down orthographic surface, even flat lighting, no cast shadows, no baked highlights, no vignette, no directional lighting.
```

### sky-meadow

File: `public/art/hunt/sky-meadow.webp`
Size: 4096 × 2048 px; 299,810 bytes.
Revision: sky horizontal seam edit below.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: full 360-degree equirectangular sky panorama, exact 2:1 aspect ratio, intended final dimensions 4096x2048. Late-afternoon soft blue sky fading into warm cream at the horizon, big round painted cumulus clouds. Distant rolling green hills only along the BOTTOM 15 percent of the image; sky fills upper 85 percent. Equirectangular spherical projection with gentle polar distortion, uncluttered uniform blue zenith at top. LEFT AND RIGHT EDGES MUST JOIN SEAMLESSLY with continuous clouds and hills across the wrap. No sun disc, no foreground, no objects, no lettering. Gentle diffuse painted lighting.
```

### leaf-cluster

File: `public/art/hunt/leaf-cluster.webp`
Size: 512 × 512 px; 43,070 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: transparent tree-foliage billboard card, square 512x512. ONE rounded clump of painted leaves, mid green with lighter top edges, soft scalloped silhouette, chunky simple readable clusters. Entire clump visible with a little transparent margin around all edges. No trunk, no branch sticking out, no pot, no background scenery. Actual transparent background with clean alpha, no checkerboard painted into image, no drop shadow.
```

### grass-tuft

File: `public/art/hunt/grass-tuft.webp`
Size: 256 × 256 px; 21,422 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: transparent grass billboard card, square 256x256. ONE small tuft of painted green grass blades, clear simple tapered blades with soft brush texture, rooted base AT THE BOTTOM EDGE of the canvas, blades grow upward and spread slightly. Tuft occupies lower three quarters of the canvas. Actual transparent background with clean alpha, no soil patch, no ground, no pot, no cast shadow, no checkerboard painted into image.
```

### ref-bristleback

File: `public/art/hunt/ref-bristleback.webp`
Size: 2048 × 1024 px; 93,654 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: 3D modelling turnaround reference sheet, wide 2:1 canvas, intended final size 2048x1024. Plain uniform warm off-white background. Exactly THREE full-body drawings of the SAME beast in one horizontal row: strict SIDE PROFILE at left, straight FRONT VIEW in middle, THREE-QUARTER VIEW at right. Same physical scale, same anatomy, same proportions and colours in all three, feet aligned on one baseline. Leave generous whitespace between drawings and margins. Simple chunky clearly separable volumes, soft painted surface, readable silhouette, no perspective exaggeration. All body parts fit inside the canvas, no cropped tails or wings. NO text, labels, frames, props, ground, cast shadows, scenery, or extra poses. Grumpy, endearing and safe for young kids.
Subject: Bristleback, a huffy round-bodied boar with a big hunched back, a crest of dark bristle spikes along the spine, two short curved ivory tusks, a pink snout, small grumpy eyes under heavy brows, and four stubby legs. Warm brown fur. Bristles are chunky soft cartoon wedges. Relaxed standing pose, mouth closed, grumpy but never scary.
```

### ref-puffwart

File: `public/art/hunt/ref-puffwart.webp`
Size: 2048 × 1024 px; 63,096 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: 3D modelling turnaround reference sheet, wide 2:1 canvas, intended final size 2048x1024. Plain uniform warm off-white background. Exactly THREE full-body drawings of the SAME beast in one horizontal row: strict SIDE PROFILE at left, straight FRONT VIEW in middle, THREE-QUARTER VIEW at right. Same physical scale, same anatomy, same proportions and colours in all three, feet aligned on one baseline. Leave generous whitespace between drawings and margins. Simple chunky clearly separable volumes, soft painted surface, readable silhouette, no perspective exaggeration. All body parts fit inside the canvas, no cropped tails or wings. NO text, labels, frames, props, ground, cast shadows, scenery, or extra poses. Grumpy, endearing and safe for young kids.
Subject: Puffwart, a chubby marsh toad, olive green with a pale cream belly, rounded warts on its back, a big round inflated throat sac, sleepy half-closed eyes. Four short squat legs with simple rounded toes, broad soft body and no tail. Resting squat pose, same puffed throat size in every view. Cute, sleepy and a little grumpy.
```

### ref-skreel

File: `public/art/hunt/ref-skreel.webp`
Size: 2048 × 1024 px; 88,588 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: 3D modelling turnaround reference sheet, wide 2:1 canvas, intended final size 2048x1024. Plain uniform warm off-white background. Exactly THREE full-body drawings of the SAME beast in one horizontal row: strict SIDE PROFILE at left, straight FRONT VIEW in middle, THREE-QUARTER VIEW at right. Same physical scale, same anatomy, same proportions and colours in all three, feet aligned on one baseline. Leave generous whitespace between drawings and margins. Simple chunky clearly separable volumes, soft painted surface, readable silhouette, no perspective exaggeration. All body parts fit inside the canvas, no cropped tails or wings. NO text, labels, frames, props, ground, cast shadows, scenery, or extra poses. Grumpy, endearing and safe for young kids.
Subject: Skreel, a sulky round sky-owl, slate-blue feathers, broad wings, a short tail fan, a small yellow beak, a frowning brow. Two short legs with simple rounded feet. Wings held slightly away from the body in a consistent relaxed modelling pose so wing shape is clear. Gentle feather tufts, sleepy sulky eyes, no bared claws, never menacing.
```

### ref-hornclack

File: `public/art/hunt/ref-hornclack.webp`
Size: 2048 × 1024 px; 71,432 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: 3D modelling turnaround reference sheet, wide 2:1 canvas, intended final size 2048x1024. Plain uniform warm off-white background. Exactly THREE full-body drawings of the SAME beast in one horizontal row: strict SIDE PROFILE at left, straight FRONT VIEW in middle, THREE-QUARTER VIEW at right. Same physical scale, same anatomy, same proportions and colours in all three, feet aligned on one baseline. Leave generous whitespace between drawings and margins. Simple chunky clearly separable volumes, soft painted surface, readable silhouette, no perspective exaggeration. All body parts fit inside the canvas, no cropped tails or wings. NO text, labels, frames, props, ground, cast shadows, scenery, or extra poses. Grumpy, endearing and safe for young kids.
Subject: Hornclack, a stubborn rhino-beetle with a chunky domed slate-grey shell made of clear simple plates, ONE big sand-coloured rounded horn growing from the forehead, exactly SIX stubby legs total attached as three pairs, a tiny round head with stubborn grumpy eyes. Toy-like simple rounded shell forms, no scary insect mouthparts, closed mouth, friendly child-safe proportions. Consistent single horn in each view.
```

### ref-frostmane

File: `public/art/hunt/ref-frostmane.webp`
Size: 2048 × 1024 px; 100,302 bytes.
Revision: none.

```text
Use case: stylized-concept. Art for Grumble Hunt, a gentle children's 3D adventure. Warm hand-painted storybook look in the spirit of Monster Hunter Stories and Wind Waker, chunky readable shapes, soft painted brush texture, saturated but gentle colours, no photorealism. No text, logos, watermark, blood, injuries, or scary imagery.
Asset type: 3D modelling turnaround reference sheet, wide 2:1 canvas, intended final size 2048x1024. Plain uniform warm off-white background. Exactly THREE full-body drawings of the SAME beast in one horizontal row: strict SIDE PROFILE at left, straight FRONT VIEW in middle, THREE-QUARTER VIEW at right. Same physical scale, same anatomy, same proportions and colours in all three, feet aligned on one baseline. Leave generous whitespace between drawings and margins. Simple chunky clearly separable volumes, soft painted surface, readable silhouette, no perspective exaggeration. All body parts fit inside the canvas, no cropped tails or wings. NO text, labels, frames, props, ground, cast shadows, scenery, or extra poses. Grumpy, endearing and safe for young kids.
Subject: Frostmane, a grumpy snow lynx with a big icy-blue mane like chunky soft fur petals, tufted ears, a long fluffy tail, pale white-blue fur, four large soft paws. Final beast: grand and majestic but still cute. Broad soft cheeks and heavy grumpy brows, small nose, closed mouth, no exposed teeth or claws. Relaxed standing pose with head proudly raised; same mane shape and tail proportions in each view.
```

### Shared four-edge texture seam edit

Applied separately to `tex-meadow-grass`, `tex-meadow-dirt`, `tex-bark`, `tex-rock`, and `tex-boar-fur`, using each initial generated texture as the edit target.

```text
Use case: precise-object-edit. Input image is the edit target: a Grumble Hunt hand-painted game albedo texture. Correct ONLY its tile boundary continuity: make a truly seamless periodic texture on ALL FOUR EDGES, with the left/right and top/bottom borders exactly matching and every cut surface detail continuing naturally across each wrap. Remove any lighting gradient and keep even flat illumination. Preserve material identity, colour palette, painted brush strokes, detail density, and existing aspect ratio. No baked cast shadows or light highlights, no new objects, no text, no logo, no frame. Output one complete texture tile, not a grid or preview. Keep the surface straight-on and uniform.
```

### Sky horizontal seam edit

Applied to `sky-meadow`, using its initial generated panorama as the edit target.

```text
Use case: precise-object-edit. Input image is the edit target: the Grumble Hunt painted equirectangular sky panorama. Correct ONLY the horizontal wrapping seam: the exact left and right image borders must match in colour and painted cloud and hill shapes, so they join invisibly when the panorama repeats left-to-right. Keep the same blue-to-cream late-afternoon sky, rounded clouds, hills in bottom 15%, no sun disc, same storybook brush style, same 2:1 framing and all other content. No text, logo or watermark. Output one seamless full panorama, not a preview or grid. Preserve warm gentle colours.
```

## Icons and portraits pass · 24-10-2026

Followed `docs/grumble-hunt-prompts/2-icons-and-portraits.md` from `origin/grumble-hunt-base`. Pulled `codex/grumble-hunt-art` before writing the six new assets. The original thirteen WebPs above remain unchanged. This branch now contains nineteen Grumble Hunt art files.

Generated with the built-in imagegen tool and exported with `cwebp -q 85 -m 6 -alpha_q 100 -metadata none`. Transparent backgrounds and soft alpha edges are retained. The 2048 × 1024 weapon sheet is upscaled from the generated source; the square sheets are downscaled and packed into exact cells.

| File | Decoded pixels | Bytes | Alpha | Generated source pixels |
| --- | --- | ---: | --- | --- |
| `public/art/hunt/icons-materials.webp` | 1024 × 1024 | 235,732 | yes | 1254 × 1254 |
| `public/art/hunt/icons-items.webp` | 1024 × 1024 | 169,490 | yes | 1254 × 1254 |
| `public/art/hunt/icons-gear.webp` | 1024 × 1024 | 226,240 | yes | 1254 × 1254 |
| `public/art/hunt/ref-weapons.webp` | 2048 × 1024 | 133,276 | no | 1774 × 887 |
| `public/art/hunt/portraits-dora.webp` | 1024 × 1024 | 181,314 | yes | 1254 × 1254 |
| `public/art/hunt/portraits-enzo.webp` | 1024 × 1024 | 175,508 | yes | 1254 × 1254 |

### Layout and verification

All six exports decode as WebP at the requested dimensions. All five transparent atlases contain fully transparent, fully opaque and intermediate alpha values. Complete icon silhouettes were sliced by connected alpha regions and centered into their exact 256 × 256 or 512 × 512 cells with consistent padding. Touching portrait whiskers were separated at the column boundary; no face or ear was cut off. Soft-alpha pixels stay with their corresponding drawing. Checked every occupied cell, clear padding and unused cell; also inspected icons at 48 px.

Materials fill all sixteen cells in the requested order. Items fill the first eleven (the final five are empty); gear fills the first fifteen (the final cell is empty). Portrait order is happy/determined/dizzy/sleepy. Dora has the Acorn Hammer in the determined cell; Enzo has the Seed Bow. The weapon reference has side/front views with cream-white paws showing the grips. All wooden claw tips are rounded.

Consulted the real `public/art/dora.jpeg` and `public/art/enzo.jpeg` photos and model screenshots on `origin/grumble-hunt-base`. Portrait revision inputs were the initial generated sheet, `docs/grumble-hunt/screenshots/idle-front.png`, and the corresponding real photo. Enzo received a final catchlight edit so each open black eye has two distinct white highlights. Initial and revision prompts are reproduced exactly below. No game code was changed. Temporary export helpers/previews are outside the repository, and original generated PNGs remain in the imagegen output directory.

### icons-materials

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent inventory atlas, exact4x4 grid,1024x1024, each cell256x256. Fill left to right, top to bottom in the specified order. One icon/group per cell, perfectly centered, generous even padding at least24px, no crossing cell boundaries. Same three-quarter angle, top-left lighting, THICK dark-brown outline, three-band shading, readable at48px. Genuine transparent alpha, no checkerboard, no grid lines or cell borders. Keep unused cells fully transparent. No text.
Row1: bristle tuft, tusk shard, boar hide patch, curly tail tuft. Row2: puff sac, wart pebble, sleepy-cloud wisp, marsh reed. Row3: sky feather, owl down, beetle shell plate, horn chip. Row4: frost fur, icy mane lock, glimmer stone, berry. Sixteen occupied cells. Tusk and horn materials look like naturally shed rounded toy pieces, no harm. Palette follows brown boar, olive toad, slate-blue owl/beetle, icy-blue lynx; crystal warm gold.
```

### icons-items

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent inventory atlas, exact4x4 grid,1024x1024, each cell256x256. Fill left to right, top to bottom in the specified order. One icon/group per cell, perfectly centered, generous even padding at least24px, no crossing cell boundaries. Same three-quarter angle, top-left lighting, THICK dark-brown outline, three-band shading, readable at48px. Genuine transparent alpha, no checkerboard, no grid lines or cell borders. Keep unused cells fully transparent. No text.
Row1: fluffberry (healing red berry with leaves), big fluffberry (bigger berry bunch), sleepy seed (round lavender seed with sleepy motif but no letters), dizzy bell (small golden jingle bell). Row2: sticky sap (amber sap blob), smoke puffball (round grey puffball), pathfinder acorn (acorn with small leaf), hay bundle (tied hay). Row3: map scroll (rolled parchment with abstract path, NO letters), berry pouch (round fabric pouch full of berries), empty slot ring (one simple brown outlined ring), EMPTY. Row4: all FOUR EMPTY. Exactly eleven icons, five unused cells fully transparent.
```

### icons-gear

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent inventory atlas, exact4x4 grid,1024x1024, each cell256x256. Fill left to right, top to bottom in the specified order. One icon/group per cell, perfectly centered, generous even padding at least24px, no crossing cell boundaries. Same three-quarter angle, top-left lighting, THICK dark-brown outline, three-band shading, readable at48px. Genuine transparent alpha, no checkerboard, no grid lines or cell borders. Keep unused cells fully transparent. No text.
Row1: Acorn Hammer (large acorn head, wooden handle and leather grip); upgraded Acorn Hammer with iron band; final Acorn Hammer with golden cap; Twin Claws (PAIR of curved wooden paw-blades with rounded tips, no sharp edges). Row2: upgraded Twin Claws (PAIR with pebble detail); final Twin Claws (PAIR with golden rounded caps); Seed Bow (small curved green wood, leaf at each tip and seed pouch); upgraded Seed Bow (twine bindings). Row3: final Seed Bow (golden natural details); Bristle helm (brown bristle crest cap with space for huge chinchilla ears); Bristle vest (brown leaf vest); Bristle boots (PAIR of brown puffy boots). Row4: Puffwart helm (olive cap with rounded warts, ear openings); Puffwart vest (olive pale-belly vest); Puffwart boots (PAIR of olive puffy boots); EMPTY. Exactly fifteen occupied cells. No whole characters.
```

Revision:

```text
Use case: precise-object-edit. Edit ONLY the Twin Claws in cells4,5,6 (row1col4,row2col1,row2col2) of this4x4 atlas: make them curved WOODEN paw-blades with very broad ROUNDED blunt ends and visible wood grain, toy-like. Preserve pairs, tiers, all other icons, exact cell order, thick brown outlines, painted toon style, transparent background. Improve generous equal padding within all256px cells; do not add anything to empty last cell. No text or grid.
```

### ref-weapons

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Weapon modelling reference sheet, wide2:1,final2048x1024. Plain light cream background. THREE columns for three weapons, two rows SIDE VIEW above FRONT VIEW, matching scale across views. Weapons: Acorn Hammer, a big acorn head on stout wooden handle with leather grip wrap; Twin Claws, a PAIR of curved wooden paw-blades with rounded tips, nothing sharp; Seed Bow, small curved green-wood bow with leaf at each tip and pouch of seeds as ammunition. A cream white chinchilla paw drawn HOLDING each weapon grip to show size, cropped furry forearm only, no full character. Simple chunky clear separable model volumes. Same weapon design in both views, complete silhouettes, generous spacing. No labels,text,dividers,scenery or shadows.
```

### portraits-dora

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent HUD portrait atlas, exactly2x2 grid,1024x1024, each cell512x512. Four head-and-shoulders portraits of the SAME chibi chinchilla, same framing and scale, centered with generous even padding, no overlap. Huge ROUND CIRCULAR dish ears tilted OUTWARD with rounded rims (never triangular, no pointed ear tops), big glossy eyes with TWO highlights, broad chubby chinchilla cheeks, tiny nose, little w-shaped mouth, soft painted fur. Dora is cream white with pink inner ears and deep ruby eyes. Top left HAPPY; top right DETERMINED with Acorn Hammer over her shoulder (big acorn head, stout wooden leather-wrapped handle); bottom left DIZZY with swirly eyes and little stars; bottom right SLEEPY and content with closed eyes. Genuine transparent background, no checkerboard, borders, letters, logos or watermark. Warm three-band cel shading and dark-brown ink outlines matching the game model.
```

Revision:

```text
Use case: identity-preserve. Image1 is the portrait atlas edit target, image2 the game model reference, image3 the real chinchilla photo as coat/ear reference ONLY. Match Dora, cream white with pink inner ears and deep RUBY eyes. Huge perfectly ROUND dish ears tilted outward like the3D model; broad chubby chinchilla cheeks; tiny nose, w mouth. Open eyes have TWO white highlights each. Preserve four exact expressions and order: happy top-left; determined top-right holding Acorn Hammer over shoulder; dizzy swirly eyes and little stars bottom-left; sleepy-content bottom-right. Consistent head-and-shoulders framing and scale, ample equal transparent margins within each512x512 cell. Keep painted three-band toon style, actual transparent background. Do not copy any screenshot UI or lettering. No text/logos/grid.
```

### portraits-enzo

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent HUD portrait atlas, exactly2x2 grid,1024x1024, each cell512x512. Four head-and-shoulders portraits of the SAME chibi chinchilla, same framing and scale, centered with generous even padding, no overlap. Huge ROUND CIRCULAR dish ears tilted OUTWARD with rounded rims (never triangular, no pointed ear tops), big glossy eyes with TWO highlights, broad chubby chinchilla cheeks, tiny nose, little w-shaped mouth, soft painted fur. Enzo is grey with a pale chest, mauve-pink inner ears and black eyes. Top left HAPPY; top right DETERMINED holding Seed Bow (curved green-wood with leaf tips and seed pouch); bottom left DIZZY with swirly eyes and little stars; bottom right SLEEPY and content with closed eyes. Genuine transparent background, no checkerboard, borders, letters, logos or watermark. Warm three-band cel shading and dark-brown ink outlines matching the game model.
```

Revision:

```text
Use case: identity-preserve. Image1 is the portrait atlas edit target, image2 the game model reference, image3 the real chinchilla photo as coat/ear reference ONLY. Match Enzo, grey with a pale chest, mauve-pink inner ears and truly BLACK eyes. Huge perfectly ROUND dish ears tilted outward like the3D model; broad chubby chinchilla cheeks; tiny nose, w mouth. Open eyes have TWO white highlights each. Preserve four exact expressions and order: happy top-left; determined top-right holding Seed Bow; dizzy swirly eyes and little stars bottom-left; sleepy-content bottom-right. Consistent head-and-shoulders framing and scale, ample equal transparent margins within each512x512 cell. Keep painted three-band toon style, actual transparent background. Do not copy any screenshot UI or lettering. No text/logos/grid.
```

Catchlight revision:

```text
Use case: precise-object-edit. Change ONLY the four open black eyes in the TOP TWO portraits of Enzo in this atlas: each eye must have exactly TWO clearly visible WHITE catchlights, one large circle at upper-left and one SMALL white dot at lower-right. The small dot should be about one-third the large circle's diameter. Keep eye colour jet black. Do not change the swirly eyes, closed eyes, character, ears, expressions, bow, framing, artwork, grid or transparent alpha. No other change.
```
