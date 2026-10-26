# Grumble Hunt story art

Created 24-10-2026 from `origin/grumble-hunt-base` (`ecc7ec2`). Art only, following `docs/grumble-hunt-prompts/4-story-art.md`. All 26 images were generated with the built-in imagegen tool, then exported as WebP with `cwebp -q 85 -m 6 -alpha_q 100 -metadata none`.

Read the expansion design and first-pass art log; inspected the Dora/Enzo photos, model screenshots and all five beast reference sheets. The story character revision uses `docs/grumble-hunt/screenshots/idle-front.png` as its second input, solely for chinchilla identity. No game code or existing art files were changed.

## Files

Paths are relative to the repository root. Sizes describe final encoded files. Source dimensions describe the selected generated PNG before export. Skies and modelling references are upscaled to the requested dimensions; story panels receive a small resize to exactly 1600 × 1000.

| File | Decoded pixels | Bytes | Alpha | Generated source pixels |
| --- | --- | ---: | --- | --- |
| `public/art/hunt/tex-marsh-mud.webp` | 1024 × 1024 | 177,494 | no | 1254 × 1254 |
| `public/art/hunt/tex-ridge-slate.webp` | 1024 × 1024 | 254,100 | no | 1254 × 1254 |
| `public/art/hunt/tex-hollow-sand.webp` | 1024 × 1024 | 149,666 | no | 1254 × 1254 |
| `public/art/hunt/tex-peak-snow.webp` | 1024 × 1024 | 64,242 | no | 1254 × 1254 |
| `public/art/hunt/tex-peak-ice.webp` | 1024 × 1024 | 142,950 | no | 1254 × 1254 |
| `public/art/hunt/sky-marsh.webp` | 4096 × 2048 | 364,288 | no | 1774 × 887 |
| `public/art/hunt/sky-ridge.webp` | 4096 × 2048 | 565,990 | no | 1774 × 887 |
| `public/art/hunt/sky-hollow.webp` | 4096 × 2048 | 413,922 | no | 1774 × 887 |
| `public/art/hunt/sky-peak.webp` | 4096 × 2048 | 411,078 | no | 1774 × 887 |
| `public/art/hunt/card-reeds.webp` | 512 × 512 | 85,170 | yes | 1254 × 1254 |
| `public/art/hunt/card-pine.webp` | 512 × 512 | 79,190 | yes | 1254 × 1254 |
| `public/art/hunt/card-snowfir.webp` | 512 × 512 | 54,096 | yes | 1254 × 1254 |
| `public/art/hunt/card-mushrooms.webp` | 512 × 512 | 72,112 | yes | 1254 × 1254 |
| `public/art/hunt/story-0a.webp` | 1600 × 1000 | 256,962 | no | 1585 × 992 |
| `public/art/hunt/story-0b.webp` | 1600 × 1000 | 260,518 | no | 1586 × 992 |
| `public/art/hunt/story-1.webp` | 1600 × 1000 | 280,388 | no | 1584 × 993 |
| `public/art/hunt/story-1-end.webp` | 1600 × 1000 | 254,604 | no | 1585 × 992 |
| `public/art/hunt/story-2.webp` | 1600 × 1000 | 235,970 | no | 1584 × 993 |
| `public/art/hunt/story-3.webp` | 1600 × 1000 | 316,982 | no | 1586 × 992 |
| `public/art/hunt/story-4.webp` | 1600 × 1000 | 240,376 | no | 1585 × 992 |
| `public/art/hunt/story-5a.webp` | 1600 × 1000 | 274,648 | no | 1584 × 993 |
| `public/art/hunt/story-5b.webp` | 1600 × 1000 | 297,544 | no | 1584 × 993 |
| `public/art/hunt/story-end.webp` | 1600 × 1000 | 362,934 | no | 1584 × 993 |
| `public/art/hunt/story-6.webp` (pending; generation timed out) | 1600 × 1000 target | — | no (target) | unavailable |
| `public/art/hunt/story-7.webp` | 1600 × 1000 | 314,740 | no | 1586 × 992 |
| `public/art/hunt/ref-villagers.webp` | 2048 × 1024 | 170,708 | no | 1774 × 887 |
| `public/art/hunt/portraits-villagers.webp` | 1024 × 1024 | 185,094 | yes | 1254 × 1254 |
| `public/art/hunt/icons-weapons-2.webp` | 1024 × 1024 | 269,624 | yes | 1254 × 1254 |

## Export and verification

All 26 files were decoded with Pillow and checked against their requested WebP dimensions. Every transparent card and atlas retains fully transparent, fully opaque and intermediate alpha values. Cards are fitted with side/top padding and their opaque bases anchored at the bottom edge. Atlases are sliced by connected alpha silhouettes and packed into exact 256 × 256 or 512 × 512 cells, with even margins; soft-alpha pixels remain with their corresponding sprite. All occupied cells and clear padding were checked.

The five ground tiles received the boundary revision recorded below. Inspected 2 × 2 repeat previews for continuous material details, consistent lighting and no visible border. The four skies received a boundary revision and a second imagegen repair after a lossless half-width offset moved the wrapping seam into the image centre. Inspected decoded crops crossing the final left/right wrap. These are visually continuous painted assets, not claims of byte-identical edges after lossy WebP encoding. There is no sun disc. Scenery sits along the low horizon.

Inspected every generated sheet and story panel for requested subjects and poses, character colours, round ears, continuous plume tails, child-friendly expressions and absence of lettering. The ending contains one of each of the five napping beasts. The villager reference is four rows (one villager each), with side/front/three-quarter columns. The villager portraits are Mossback/Bramble/Pip/Wren in reading order. The weapon atlas follows the prompt's sixteen-cell order.

Temporary inspection images and export helpers are outside the repository. Original generated PNGs remain in the imagegen output directory. Checked-in deliverables are only these 26 WebPs and this log.

## Exact prompts

Each asset has its initial prompt and subsequent edit prompts below. For boundary/crown edits, the initial PNG was the edit target. For sky offset repair, the input was the boundary-revised PNG with a lossless horizontal half-width offset; the repaired, offset orientation is the final panorama. Villager portrait edits use their first sheet. No fallback API or CLI image generation was used.

### tex-marsh-mud

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One seamless tiling diffuse/albedo texture, 1024x1024 square: soft brown-green mud with moss patches. Seen straight from above, flat surface fills entire canvas. Even flat lighting, no baked cast shadows, bright highlights, vignette, perspective, horizon, focal object or borders. Low contrast consistent material density. ALL FOUR EDGES join seamlessly and continuously: matching left/right and top/bottom colour and surface details, periodic painted pattern. Output one tile, no grid.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted repeatable albedo texture. Correct ONLY tile boundary continuity on ALL FOUR EDGES. Left/right AND top/bottom borders must match exactly in colour and every cut detail must continue naturally across each wrap. Keep flat even lighting, no highlights or cast shadows. Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

### tex-ridge-slate

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One seamless tiling diffuse/albedo texture, 1024x1024 square: short wind-swept grass over grey-blue slate. Seen straight from above, flat surface fills entire canvas. Even flat lighting, no baked cast shadows, bright highlights, vignette, perspective, horizon, focal object or borders. Low contrast consistent material density. ALL FOUR EDGES join seamlessly and continuously: matching left/right and top/bottom colour and surface details, periodic painted pattern. Output one tile, no grid.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted repeatable albedo texture. Correct ONLY tile boundary continuity on ALL FOUR EDGES. Left/right AND top/bottom borders must match exactly in colour and every cut detail must continue naturally across each wrap. Keep flat even lighting, no highlights or cast shadows. Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

### tex-hollow-sand

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One seamless tiling diffuse/albedo texture, 1024x1024 square: warm ochre sand with small round pebbles. Seen straight from above, flat surface fills entire canvas. Even flat lighting, no baked cast shadows, bright highlights, vignette, perspective, horizon, focal object or borders. Low contrast consistent material density. ALL FOUR EDGES join seamlessly and continuously: matching left/right and top/bottom colour and surface details, periodic painted pattern. Output one tile, no grid.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted repeatable albedo texture. Correct ONLY tile boundary continuity on ALL FOUR EDGES. Left/right AND top/bottom borders must match exactly in colour and every cut detail must continue naturally across each wrap. Keep flat even lighting, no highlights or cast shadows. Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

### tex-peak-snow

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One seamless tiling diffuse/albedo texture, 1024x1024 square: soft blue-white snow with faint tiny painted sparkles. Seen straight from above, flat surface fills entire canvas. Even flat lighting, no baked cast shadows, bright highlights, vignette, perspective, horizon, focal object or borders. Low contrast consistent material density. ALL FOUR EDGES join seamlessly and continuously: matching left/right and top/bottom colour and surface details, periodic painted pattern. Output one tile, no grid.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted repeatable albedo texture. Correct ONLY tile boundary continuity on ALL FOUR EDGES. Left/right AND top/bottom borders must match exactly in colour and every cut detail must continue naturally across each wrap. Keep flat even lighting, no highlights or cast shadows. Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

### tex-peak-ice

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One seamless tiling diffuse/albedo texture, 1024x1024 square: pale blue ice with soft cracks. Seen straight from above, flat surface fills entire canvas. Even flat lighting, no baked cast shadows, bright highlights, vignette, perspective, horizon, focal object or borders. Low contrast consistent material density. ALL FOUR EDGES join seamlessly and continuously: matching left/right and top/bottom colour and surface details, periodic painted pattern. Output one tile, no grid.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted repeatable albedo texture. Correct ONLY tile boundary continuity on ALL FOUR EDGES. Left/right AND top/bottom borders must match exactly in colour and every cut detail must continue naturally across each wrap. Keep flat even lighting, no highlights or cast shadows. Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

### sky-marsh

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One full 360-degree equirectangular panorama, 2:1 aspect, final 4096x2048: overcast lavender evening over misty wetlands. Sky fills upper 85 percent; all distant scenery confined to bottom 15 percent. Equirectangular spherical projection, calm uncluttered zenith. Left and right edges join seamlessly with clouds and terrain continuing across the wrap; identical edge colours at each height. No sun disc, no foreground props or characters. Full bleed.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted equirectangular sky. Correct horizontal wrap ONLY: exact LEFT and RIGHT image borders must match in colour and cloud/terrain forms so the panorama joins invisibly. Keep all distant scenery in the bottom15 percent, no sun disc.  Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

Offset seam repair:

```text
Use case: precise-object-edit. Edit target is a horizontally half-offset Grumble Hunt equirectangular panorama. Its wrapping seam is now the VERTICAL CENTER LINE. Paint over ONLY a narrow strip around this center line to reconnect cloud brushstrokes and distant terrain organically, removing the straight visible join and mirrored cusp. Keep the entire outer left/right 25 percent of image EXACTLY unchanged: those two edges already come from adjacent original pixels and must still join seamlessly. Preserve sky identity, colour palette, 2:1 framing, hand-painted style, no sun disc, scenery confined to bottom15 percent. Do not move or mirror the rest of the scene. Output one full image without text, labels or watermark.
```

### sky-ridge

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One full 360-degree equirectangular panorama, 2:1 aspect, final 4096x2048: bright morning with fast streaky painted clouds over rocky ridges. Sky fills upper 85 percent; all distant scenery confined to bottom 15 percent. Equirectangular spherical projection, calm uncluttered zenith. Left and right edges join seamlessly with clouds and terrain continuing across the wrap; identical edge colours at each height. No sun disc, no foreground props or characters. Full bleed.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted equirectangular sky. Correct horizontal wrap ONLY: exact LEFT and RIGHT image borders must match in colour and cloud/terrain forms so the panorama joins invisibly. Keep all distant scenery in the bottom15 percent, no sun disc. Replace the distant water with grass-covered rocky ridges, no ocean or islands. Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

Offset seam repair:

```text
Use case: precise-object-edit. Edit target is a horizontally half-offset Grumble Hunt equirectangular panorama. Its wrapping seam is now the VERTICAL CENTER LINE. Paint over ONLY a narrow strip around this center line to reconnect cloud brushstrokes and distant terrain organically, removing the straight visible join and mirrored cusp. Keep the entire outer left/right 25 percent of image EXACTLY unchanged: those two edges already come from adjacent original pixels and must still join seamlessly. Preserve sky identity, colour palette, 2:1 framing, hand-painted style, no sun disc, scenery confined to bottom15 percent. Do not move or mirror the rest of the scene. Output one full image without text, labels or watermark.
```

### sky-hollow

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One full 360-degree equirectangular panorama, 2:1 aspect, final 4096x2048: warm canyon afternoon with ochre cliffs. Sky fills upper 85 percent; all distant scenery confined to bottom 15 percent. Equirectangular spherical projection, calm uncluttered zenith. Left and right edges join seamlessly with clouds and terrain continuing across the wrap; identical edge colours at each height. No sun disc, no foreground props or characters. Full bleed.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted equirectangular sky. Correct horizontal wrap ONLY: exact LEFT and RIGHT image borders must match in colour and cloud/terrain forms so the panorama joins invisibly. Keep all distant scenery in the bottom15 percent, no sun disc.  Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

Offset seam repair:

```text
Use case: precise-object-edit. Edit target is a horizontally half-offset Grumble Hunt equirectangular panorama. Its wrapping seam is now the VERTICAL CENTER LINE. Paint over ONLY a narrow strip around this center line to reconnect cloud brushstrokes and distant terrain organically, removing the straight visible join and mirrored cusp. Keep the entire outer left/right 25 percent of image EXACTLY unchanged: those two edges already come from adjacent original pixels and must still join seamlessly. Preserve sky identity, colour palette, 2:1 framing, hand-painted style, no sun disc, scenery confined to bottom15 percent. Do not move or mirror the rest of the scene. Output one full image without text, labels or watermark.
```

### sky-peak

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One full 360-degree equirectangular panorama, 2:1 aspect, final 4096x2048: pale winter dusk over snowy mountains, gentle snowfall. Sky fills upper 85 percent; all distant scenery confined to bottom 15 percent. Equirectangular spherical projection, calm uncluttered zenith. Left and right edges join seamlessly with clouds and terrain continuing across the wrap; identical edge colours at each height. No sun disc, no foreground props or characters. Full bleed.
```

Revision:

```text
Use case: precise-object-edit. Input is the edit target: Grumble Hunt painted equirectangular sky. Correct horizontal wrap ONLY: exact LEFT and RIGHT image borders must match in colour and cloud/terrain forms so the panorama joins invisibly. Keep all distant scenery in the bottom15 percent, no sun disc.  Preserve painted brushwork, colour palette, material or sky identity, aspect ratio and other content. One complete image, no grid or preview. No text, logo or watermark.
```

Offset seam repair:

```text
Use case: precise-object-edit. Edit target is a horizontally half-offset Grumble Hunt equirectangular panorama. Its wrapping seam is now the VERTICAL CENTER LINE. Paint over ONLY a narrow strip around this center line to reconnect cloud brushstrokes and distant terrain organically, removing the straight visible join and mirrored cusp. Keep the entire outer left/right 25 percent of image EXACTLY unchanged: those two edges already come from adjacent original pixels and must still join seamlessly. Preserve sky identity, colour palette, 2:1 framing, hand-painted style, no sun disc, scenery confined to bottom15 percent. Do not move or mirror the rest of the scene. Output one full image without text, labels or watermark.
```

### card-reeds

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One transparent foliage/prop billboard card, 512x512: a clump of marsh reeds and cattails. Full readable silhouette with side/top transparent padding; rooted BASE TOUCHES BOTTOM EDGE, centered. Soft painted brush texture. Genuine transparent background and clean alpha, no ground plane, scenery, cast shadow, border or checkerboard pattern.
```

### card-pine

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One transparent foliage/prop billboard card, 512x512: one wind-bent pine crown for a billboard ridge tree. Full readable silhouette with side/top transparent padding; rooted BASE TOUCHES BOTTOM EDGE, centered. Soft painted brush texture. Genuine transparent background and clean alpha, no ground plane, scenery, cast shadow, border or checkerboard pattern.
```

Revision:

```text
Use case: precise-object-edit. This is a Grumble Hunt foliage-card edit target. Make ONLY the leafy wind-bent pine CROWN, a cluster of chunky painted foliage boughs for a billboard tree canopy. REMOVE the exposed lower trunk, roots and ground. Foliage lower edge touches the BOTTOM canvas edge, with clean transparent padding at sides and top. Preserve existing painted style and colours and wind-bent shape. Actual transparent alpha background, no checkerboard, no text, no shadow. Square512x512.
```

### card-snowfir

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One transparent foliage/prop billboard card, 512x512: one snowy fir crown. Full readable silhouette with side/top transparent padding; rooted BASE TOUCHES BOTTOM EDGE, centered. Soft painted brush texture. Genuine transparent background and clean alpha, no ground plane, scenery, cast shadow, border or checkerboard pattern.
```

Revision:

```text
Use case: precise-object-edit. This is a Grumble Hunt foliage-card edit target. Make ONLY the leafy snowy fir CROWN, a cluster of chunky painted foliage boughs for a billboard tree canopy. REMOVE the exposed lower trunk, roots and ground. Foliage lower edge touches the BOTTOM canvas edge, with clean transparent padding at sides and top. Preserve existing painted style and colours and snowy boughs. Actual transparent alpha background, no checkerboard, no text, no shadow. Square512x512.
```

### card-mushrooms

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
One transparent foliage/prop billboard card, 512x512: a cluster of chunky spotted toadstools for marsh decoration. Full readable silhouette with side/top transparent padding; rooted BASE TOUCHES BOTTOM EDGE, centered. Soft painted brush texture. Genuine transparent background and clean alpha, no ground plane, scenery, cast shadow, border or checkerboard pattern.
```

### story-0a

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: A cosy chinchilla village at dawn, rounded cottages and garden paths. A cold blue wind visibly curls down from a distant snowy peak into the village. Villagers look up with puzzled, gentle expressions.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-0b

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: Old Mossback, a kindly old tortoise with a mossy domed shell, little round glasses and walking stick, talks warmly to Dora and Enzo in their cosy village. Both listen attentively.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-1

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: In sunny Clover Meadow, a huffy round warm-brown Bristleback boar with a big hunched back, dark bristle crest, short curved ivory tusks, pink snout, heavy brows and stubby legs puffs harmless steam from its nostrils. Dora holds the Acorn Hammer and Enzo holds the Seed Bow nearby, determined but kind.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-1-end

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: Bristleback, round brown boar with hunched back, dark bristle crest, ivory tusks and pink snout, is curled up napping peacefully under a leafy meadow tree. Dora and Enzo tiptoe gently past with relieved smiles.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-2

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: In Soggy Marsh among reeds and soft moss, Puffwart, a chubby olive-green marsh toad with pale belly, rounded back warts, big inflated throat sac and sleepy half-closed eyes, puffs a soft sleepy cloud. Enzo yawns widely with drowsy eyes; Dora watches with an affectionate smile.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-3

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: On Windy Ridge, Skreel, a sulky round slate-blue sky-owl with broad wings, short tail fan, small yellow beak and frowning brow, swoops safely overhead. Below, Enzo sniffs a clearly visible trail of gently glowing pawprints along the ground. Dora follows. Wind-bent pines and grey-blue rocky grassland.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-4

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: In warm ochre Pebble Hollow, Hornclack, a stubborn rounded rhino-beetle with domed slate shell made of simple plates, ONE big sand-coloured rounded horn and exactly SIX stubby legs, stands among round canyon pebbles. Dora peeks playfully around the side of its shell; Enzo stands nearby.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-5a

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: Frosty Peak, soft snowy blue dusk. Grand but cute Frostmane, a pale white-blue snow lynx with a large icy-blue mane, tufted ears, golden eyes, fluffy continuous tail and soft paws, stands in front of a rounded ancient shrine. The shrine cradles a CRACKED glowing warm crystal, the Glimmer Stone; crack clearly visible. Cold wind curls softly away from the crack. Dora and Enzo look up in concern, not fear.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-5b

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: At the Frosty Peak shrine, Bramble, a kindly brown hedgehog smith in a leather apron, carefully mends the Glimmer Stone using a small rounded hammer. Warm golden light spreads from the repaired crystal through the snowy scene. Frostmane, the grand white-blue snow lynx with icy-blue mane and tufted ears, naps peacefully nearby. Dora and Enzo watch, pleased.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### story-end

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: A warm sunshine village picnic. Dora and Enzo join Old Mossback the mossy tortoise with round glasses, Bramble the apron-wearing hedgehog smith, Pip the degu cook with little chef scarf, and Wren the small wren bird with note satchel. Around the picnic ALL FIVE distinct beasts peacefully nap: round brown bristle-crested boar with pink snout and tusks; chubby olive warted toad with pale throat; round slate-blue owl with yellow beak; domed slate rhino-beetle with sand horn and six legs; grand white-blue tufted-ear lynx with icy-blue mane. Count exactly five beasts, one of each. Warm friendly ending.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.
```

Revision:

```text
Use case: identity-preserve. Image1 is the edit target, a Grumble Hunt story panel. Image2 is the 3D-model identity reference ONLY, never copy its UI or lettering. Refine ONLY Dora and Enzo to match their chinchilla identity in image2: huge ROUND circular dish ears tilted OUTWARD, smooth rounded rims, never pointed or triangular; broad soft cheeks, tiny nose, w-shaped mouth, big glossy eyes with two highlights. Dora cream-white with pink ears and ruby eyes; Enzo grey with pale chest, mauve-pink ears and black eyes. Each tail is one long continuous bushy plume; Dora's cream, Enzo's grey darkening to a sooty tip (no white tail tip). Preserve their poses, weapons, clothing, story beat, all other characters, scenery, lighting, full-bleed8:5 framing and hand-painted style. Remove any emblem resembling a logo on banners, replace with plain fabric. No text/logos/watermark. Do not add UI.
```

### ref-villagers

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
3D modelling reference sheet, wide 2:1, final2048x1024. Plain light cream background. FOUR horizontal rows, one per villager, THREE columns: strict side, front, three-quarter views. Exactly twelve complete figures, same scale across all views and species. Top row Old Mossback, kindly tortoise, mossy shell, round glasses, walking stick; second row Bramble, hedgehog smith, apron and small rounded hammer; third row Pip, degu cook, little chef scarf; bottom row Wren, small wren bird, satchel of notes (blank papers). Clear chunky simple forms, generous spacing, all feet/tails visible. No text, labels, dividers or scenery.
```

### portraits-villagers

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent portrait atlas, exactly2x2 grid on1024x1024, each cell512x512, invisible grid. Head-and-shoulders, same framing and even generous padding. Top left: Old Mossback, kindly old tortoise, mossy shell, round glasses. Top right: Bramble, brown hedgehog smith in apron. Bottom left: Pip, degu cook with little chef scarf. Bottom right: Wren, small warm-brown wren bird with notes satchel. All welcoming expressions. Genuine transparent background, no borders, checkerboard, writing, or shadow.
```

Revision:

```text
Use case: precise-object-edit. Preserve all four villager identities and order in this2x2 transparent portrait atlas. Make each complete head-and-shoulders portrait SMALLER within its own cell, centered with generous equal transparent padding all around, no touching or overlapping cell boundaries, no clipped head or prop. Order Mossback tortoise top left, Bramble hedgehog smith top right, Pip degu cook bottom left, Wren bird bottom right. Retain mossy shell, round glasses, apron, chef scarf, note satchel and painted toon style. No text, border or grid, actual transparency.
```

### icons-weapons-2

Initial generation:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Transparent inventory sprite atlas, exact4x4 grid,1024x1024, sixteen256x256 cells. Center ONE icon per cell, even generous padding, no crossings. Same three-quarter angle and light top-left. THICK dark-brown outline readable at48px, chunky rounded toy-like nature equipment. No text, grid lines, frames, checkerboard or cast shadows. Row1 left-right: Thistle Lance with its Leaf Shield (blunt wooden thistle stem and rounded leaf shield); same upgraded with bramble bindings; same final with ornate rounded natural cap; Bubble Wand (reed handle and circular bubble loop). Row2: upgraded Bubble Wand with twine; final Bubble Wand with frothy rounded ornament; Pinecone Yo-yo (two round pinecone halves and string); upgraded Pinecone Yo-yo with twine detail. Row3: final Pinecone Yo-yo with shell detail; Glimmer Hammer (acorn hammer with warm gold crystal); Glimmer Bow (leaf-tipped wood bow with warm glowing crystal); Glimmer Claws (PAIR of rounded wood paw blades with warm crystal accents). Row4: Glimmer Lance with Leaf Shield and warm crystal; Glimmer Wand with crystal and circular bubble loop; Glimmer Yo-yo with warm crystal; Glimmer Stone itself, one faceted glowing warm golden crystal. Exactly sixteen occupied cells. Genuine transparent background.
```


### story-6

Attempted 26-10-2026 with built-in imagegen using a text-only prompt, no reference images, and the generator's default landscape size. **Not delivered:** this request also timed out without an image, following seven earlier timeouts. `public/art/hunt/story-6.webp` was not created; the intended Pillow export remains 1600 × 1000 RGB WebP at quality 90. No CLI/API fallback was used.

Exact prompt used:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: A sunny afternoon at Clover Camp after the picnic. Dora and Enzo stand by the hunt board with Old Mossback the mossy tortoise with round glasses, looking curious and excited. Two new grumpy-but-cute beasts peek in from the edge of camp: Paddlepaw, a chubby sulky river otter with sleek warm-brown fur, a cream face and belly, long white whiskers, a flat paddle tail and a woven-grass pouch holding one round grey stone, sliding in on its belly from a stream; and Rumblesnout, a stocky grey badger with a white-and-charcoal striped face, a long pink-tipped snout, rounded digging paws and a little crown of sand-coloured pebbles on its head, poking up out of a fresh molehill of earth. Count exactly two beasts. Both look grumpy but endearing, never scary.
```

Retry series · 26-10-2026, brief 13: **Not delivered after three further timeouts** (eleven total including the eight historical attempts above). All three requests used the identical text-only prompt below, without reference images. Stopped after the third timeout as instructed; no `public/art/hunt/story-6.webp` was created. Intended export remains 1600 × 1000 RGB WebP at quality 90. No CLI/API fallback.

Exact prompt used for all three retries (restores the word-for-word story-end preamble and closing constraints):

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: A sunny afternoon at Clover Camp after the picnic. Dora and Enzo stand by the hunt board with Old Mossback the mossy tortoise with round glasses, looking curious and excited. Two new grumpy-but-cute beasts peek in from the edge of camp: Paddlepaw, a chubby sulky river otter with sleek warm-brown fur, a cream face and belly, long white whiskers, a flat paddle tail and a woven-grass pouch holding one round grey stone, sliding in on its belly from a stream; and Rumblesnout, a stocky grey badger with a white-and-charcoal striped face, a long pink-tipped snout, rounded digging paws and a little crown of sand-coloured pebbles on its head, poking up out of a fresh molehill of earth. Count exactly two beasts. Both look grumpy but endearing, never scary.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.```

### story-7

File: `public/art/hunt/story-7.webp`
Size: 1600 × 1000 px; 314,740 bytes; RGB WebP at quality 90. Created 26-10-2026 with built-in imagegen following brief 13. The first request timed out; the second delivered a 1586 × 992 PNG. Both used the identical text-only prompt below, with no reference images. Resized with Pillow Lanczos and exported at quality 90, method 6. Verified decoded dimensions and RGB channels. Inspected the sunset riverbank, both chinchillas, exactly two sleeping beasts, otter tail across the badger, pebble crown, rosette and fireflies. No CLI/API fallback.

Exact prompt used for both attempts:

```text
Use case: stylized-concept. Grumble Hunt children's game art. Warm hand-painted toon storybook look in the spirit of Monster Hunter Stories and Wind Waker: chunky rounded readable forms, soft painted brushwork, three-band cel shading, thin dark-brown ink contours, saturated but gentle colours. No photorealism, text, letters, logos, watermarks, blood, injury or scary imagery. Nothing is ever hurt.
Use case: illustration-story. Single full-bleed storybook panel, landscape 8:5, final 1600x1000. Dora and Enzo are chibi CHINCHILLAS, with huge round dish ears tilted outward, big glossy eyes with two white highlights, tiny noses and w-shaped mouths, rounded pear bodies and short paws. Each has a long bushy tail formed as ONE continuous curved plume, never segmented or ringed. Dora has cream-white fur, pink inner ears and ruby eyes. Enzo has grey fur, a pale chest, mauve-pink inner ears and black eyes. Dora's Acorn Hammer is a big acorn head on stout wooden handle with leather grip; Enzo's Seed Bow is curved green wood with leaf tips and a seed pouch. All equipment is rounded and toy-like.
Story beat: Golden sunset on a grassy riverbank beside a pebbly hill. Dora and Enzo sit happily with two beasts curled up asleep together: Paddlepaw, a chubby river otter with warm-brown fur, cream face and belly, white whiskers, a flat paddle tail and a woven-grass pouch with one grey stone; and Rumblesnout, a stocky grey badger with a white-and-charcoal striped face, a long pink-tipped snout and a little crown of sand-coloured pebbles. The otter's tail rests across the badger like a blanket. A woven teal-and-sand ribbon rosette lies on the grass in front of Dora. Fireflies, soft warm light. Count exactly two beasts, both peacefully asleep, never scary.
One complete scene, no panels, page borders, labels, speech bubbles or text. Keep both chinchillas consistent in every illustration. Clear readable composition for a child's story page.```
