# Dust Disco art

Date: 27-10-2026

Generated with the built-in image generation tool, one scene at a time. **Complete delivery:** all seven images are saved. Every image succeeded on its initial call; there were no generation failures, timeouts or retries. No CLI or API fallback was used. No code or CHANGELOG.md was changed. Nothing was committed.

## Reference art

Inspected before generation:

- `public/art/roll/title.webp` — style and Dora/Enzo identities.
- `public/art/hunt/portraits-dora.webp` — Dora's face.

The title call used both references. Each venue call used only `public/art/roll/title.webp` as a style reference. No call used more than two reference images. References supplied style and character identity, not scene content.

## Files and validation

All images were converted to RGB, fitted using Pillow `ImageOps.fit` with Lanczos resampling, and encoded as WebP at **quality 82**. Each saved file was reopened with Pillow and fully decoded with `Image.load()`; WebP format and exact dimensions were asserted. All seven fitted files were visually inspected individually. The title shows Dora and Enzo dancing, dust puffs, cheering silhouettes and a calmer dark left third. Every venue is empty of characters, with the main decoration at the sides and top and an open central area. The hayloft retains a bright sunset in the upper centre; the hall retains subtle floor ornament and reflections. No text, logos, borders or panels were observed.

| Requested file | Requested size | Bytes | Decode check | Outcome |
| --- | --- | ---: | --- | --- |
| `public/art/disco/title.webp` | 1600×1000 | 210494 | PASS: WebP, 1600×1000 | Saved, quality 82; visually inspected |
| `public/art/disco/venue-burrow.webp` | 1600×900 | 223736 | PASS: WebP, 1600×900 | Saved, quality 82; visually inspected |
| `public/art/disco/venue-hayloft.webp` | 1600×900 | 237946 | PASS: WebP, 1600×900 | Saved, quality 82; visually inspected |
| `public/art/disco/venue-pond.webp` | 1600×900 | 253788 | PASS: WebP, 1600×900 | Saved, quality 82; visually inspected |
| `public/art/disco/venue-market.webp` | 1600×900 | 247100 | PASS: WebP, 1600×900 | Saved, quality 82; visually inspected |
| `public/art/disco/venue-summit.webp` | 1600×900 | 287158 | PASS: WebP, 1600×900 | Saved, quality 82; visually inspected |
| `public/art/disco/venue-hall.webp` | 1600×900 | 291224 | PASS: WebP, 1600×900 | Saved, quality 82; visually inspected |

Failures: the first local conversion command used unavailable `python`; rerunning it with `python3` succeeded. This did not involve image generation or a fallback. No image validation failures occurred.

## Exact prompts

Each block below is the complete prompt submitted verbatim.

### title.webp

```text
Use case: illustration-story. Create a full-bleed landscape title illustration for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are references only: roll/title.webp for style and both characters, portraits-dora.webp for Dora's face. Primary request: Dora and Enzo dancing joyfully on a little round stage inside a cosy underground burrow turned disco: a big glittering disco ball made of pebbles and mica, sparkly dust clouds puffing under their feet, coloured spotlights, fairy lights strung along roots, a small crowd of happy chinchilla silhouettes cheering at the front edge. Keep the left third calmer (soft dark wall with gentle lights) for a title. Render no title. Aspect ratio 8:5, requested final size 1600x1000.
```

### venue-burrow.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input image is a style reference only; create a new scene. Primary request: the Home Burrow, a cosy earthen den with root beams, warm fairy lights, hay bales, a rug and a pebble disco ball; warm amber and rose. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Aspect ratio 16:9, requested final size 1600x900.
```

### venue-hayloft.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input image is a style reference only; create a new scene. Primary request: a barn hayloft at sunset, stacked hay bales, hanging lanterns, open loft door with an orange sky, bunting; golden. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Aspect ratio 16:9, requested final size 1600x900.
```

### venue-pond.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input image is a style reference only; create a new scene. Primary request: a lily pond at night, a big moon reflected in still water, fireflies, glowing lily pads as a stage, reeds; teal and violet. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Aspect ratio 16:9, requested final size 1600x900.
```

### venue-market.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input image is a style reference only; create a new scene. Primary request: a night market street, paper lanterns criss-crossing overhead, little stalls with fruit and ribbons, cobbles; magenta and orange. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Aspect ratio 16:9, requested final size 1600x900.
```

### venue-summit.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input image is a style reference only; create a new scene. Primary request: a snowy mountaintop stage under a green and violet aurora, pine trees, a wooden stage with lanterns, stars; icy blue. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Aspect ratio 16:9, requested final size 1600x900.
```

### venue-hall.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input image is a style reference only; create a new scene. Primary request: the Grand Dust Hall, a glittering ballroom cave with crystal walls, a giant disco ball, sparkling dust in the air, velvet curtains; violet and gold. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Aspect ratio 16:9, requested final size 1600x900.
```


## More venues (27-10-2026)

Generated with the built-in image generation tool, one image at a time, following the Fluff Roll art workflow with the requested WebP quality **82**. All six images succeeded on their initial calls. No generation failures, timeouts, retries, CLI or API fallback occurred. Starlight Stage took longer than the initial tool wait and completed successfully when resumed; this was not a timeout failure.

Both `public/art/disco/venue-burrow.webp` (primary style and staging reference) and `public/art/roll/title.webp` (supporting painted style reference) were visually inspected before generation and supplied to every call. Each call used exactly these two references. No character portrait reference was needed because all six scenes are empty.

Every output was converted to RGB and fitted to **1600×900** using Pillow `ImageOps.fit` with `Image.Resampling.LANCZOS`, then saved as WebP at **quality 82**. Each final file was reopened and fully decoded using `Image.load()`; format `WEBP` and exact size `(1600, 900)` were asserted. Each fitted WebP was visually inspected individually. No characters, animals, character silhouettes, faces, text, logos, watermarks, borders or panels were observed. Fine scenic detail is concentrated at the sides and top; the observations below record remaining lighting and detail in the centre. No conversion or decode validation failures occurred.

| File | Size | Bytes | Decode check | Visual inspection |
| --- | --- | ---: | --- | --- |
| `public/art/disco/venue-beach.webp` | 1600×900 | 290616 | PASS: WebP, fully decoded, exact size | Striped parasols, lake and pebbles frame a wooden bandstand; quiet dark central backdrop, sunlit foreground. |
| `public/art/disco/venue-garden.webp` | 1600×900 | 287668 | PASS: WebP, fully decoded, exact size | Blossom trees, paper lanterns and glowing flowers frame a moss-edged round stage; fireflies are abstract light specks. |
| `public/art/disco/venue-meadow.webp` | 1600×900 | 343308 | PASS: WebP, fully decoded, exact size | Maypole at right, small stage at left, bunting and hay bales; shaded open central lawn, with bright upper sky and distant landscape retained. |
| `public/art/disco/venue-cafe.webp` | 1600×900 | 256098 | PASS: WebP, fully decoded, exact size | Rain-streaked round windows, lamps, plants and side tables surround an empty rug stage and dark central wall; rug retains subtle ornament. |
| `public/art/disco/venue-storm.webp` | 1600×900 | 246336 | PASS: WebP, fully decoded, exact size | Purple storm clouds and distant lightning frame an open clifftop stage; dark central sky and mountains, warmly lit stone floor. |
| `public/art/disco/venue-stars.webp` | 1600×900 | 229400 | PASS: WebP, fully decoded, exact size | Cloud stage, crescent moon, planets, shooting stars and light ribbons frame a dark central sky; cloud floor remains luminous. |

### Exact prompts

Every block is the complete prompt submitted verbatim with both references listed above.

#### venue-beach.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are style references only: image 1, public/art/disco/venue-burrow.webp, is the primary reference for the exact painted finish, edge detail and quiet central staging; image 2, public/art/roll/title.webp, supports the storybook brushwork and colours only. Do not copy any characters from references. Primary request: the Pebble Beach, a sunny lakeside beach stage with striped parasols, a little wooden bandstand, pebbles, gentle waves, palm-like reeds; warm turquoise and coral, midday. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces, including on decorative objects or celestial bodies. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Keep the full-height central third softly shaded and uncluttered, even in daylight scenes. Aspect ratio 16:9, requested final size 1600x900.
```

#### venue-garden.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are style references only: image 1, public/art/disco/venue-burrow.webp, is the primary reference for the exact painted finish, edge detail and quiet central staging; image 2, public/art/roll/title.webp, supports the storybook brushwork and colours only. Do not copy any characters from references. Primary request: the Lantern Garden at dusk, paper lanterns hanging from blossom trees, a mossy round stage, glowing flowers, soft fireflies represented only as tiny abstract light specks without insect bodies or faces; rose and lavender twilight. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces, including on decorative objects or celestial bodies. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Keep the full-height central third softly shaded and uncluttered, even in daylight scenes. Aspect ratio 16:9, requested final size 1600x900.
```

#### venue-meadow.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are style references only: image 1, public/art/disco/venue-burrow.webp, is the primary reference for the exact painted finish, edge detail and quiet central staging; image 2, public/art/roll/title.webp, supports the storybook brushwork and colours only. Do not copy any characters from references. Primary request: the Clover Fair, a sunny meadow fair with a ribboned maypole at one side, bunting, flower garlands, a small wooden stage, hay bales, blue sky with puffy clouds; green and gold. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces, including on decorative objects or celestial bodies. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Keep the full-height central third softly shaded and uncluttered, even in daylight scenes. Aspect ratio 16:9, requested final size 1600x900.
```

#### venue-cafe.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are style references only: image 1, public/art/disco/venue-burrow.webp, is the primary reference for the exact painted finish, edge detail and quiet central staging; image 2, public/art/roll/title.webp, supports the storybook brushwork and colours only. Do not copy any characters from references. Primary request: the Raindrop Café, a cosy café on a rainy evening, rain on big round windows, warm lamps, potted plants, little tables at the edges, a small stage with a rug; amber and teal. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces, including on decorative objects or celestial bodies. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Keep the full-height central third softly shaded and uncluttered, even in daylight scenes. Aspect ratio 16:9, requested final size 1600x900.
```

#### venue-storm.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are style references only: image 1, public/art/disco/venue-burrow.webp, is the primary reference for the exact painted finish, edge detail and quiet central staging; image 2, public/art/roll/title.webp, supports the storybook brushwork and colours only. Do not copy any characters from references. Primary request: Thunder Peak, a clifftop stage on a stormy night, dramatic but friendly purple clouds with soft distant lightning, glowing lanterns on rope, rocks; deep purple and electric blue, exciting, never scary. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces, including on decorative objects or celestial bodies. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Keep the full-height central third softly shaded and uncluttered, even in daylight scenes. Aspect ratio 16:9, requested final size 1600x900.
```

#### venue-stars.webp

```text
Use case: illustration-story. Create a full-bleed landscape venue backdrop for Dust Disco. Shared style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, glowing party lights; kind, cosy and joyful, never scary; chibi chinchillas with huge round dish ears, big glossy eyes with two highlights, a single continuous bushy tail; Dora cream white with pink ears and ruby eyes; Enzo grey with a pale chest and black eyes; no text, letters, numbers, logos, watermarks, borders or panels. Input images are style references only: image 1, public/art/disco/venue-burrow.webp, is the primary reference for the exact painted finish, edge detail and quiet central staging; image 2, public/art/roll/title.webp, supports the storybook brushwork and colours only. Do not copy any characters from references. Primary request: the Starlight Stage, a stage made of a fluffy cloud floating among stars and planets, a crescent moon, a shower of shooting stars, ribbons of light; navy, pink and gold, the grand finale. An empty stage scene seen from the audience, eye level. NO characters at all, no animals, no silhouettes or faces, including on decorative objects or celestial bodies. Keep the middle third of the picture simple, darker and low-detail (a play lane will be drawn over it), with the interesting detail at the left and right edges and the top. Keep the full-height central third softly shaded and uncluttered, even in daylight scenes. Aspect ratio 16:9, requested final size 1600x900.
```

Only these six new venue assets and this appended documentation section were written. Existing art and documentation content were preserved. No code or CHANGELOG.md changes were made. Nothing was committed.


## Dancers (27-10-2026)

Generated exclusively with the built-in image generation tool. Every call used `public/art/disco/title.webp` as its sole character and painted-style reference, inspected before generation. No CLI/API fallback or API key was used. Ten sprites were selected from fourteen successful generations: both jump poses were regenerated twice because earlier paws did not reach above the head. All other poses used their first generation.

Processing used Pillow and numpy: sample the actual green matte from the image border (the generated green varied slightly from requested #00ff00), estimate alpha from green excess, discard near-matte residue below 0.12 opacity, unmix the sampled matte from edge RGB, suppress remaining green spill, crop to nontransparent bounds, and scale proportionally with Lanczos. RGB green was constrained again after resampling before WebP encoding at quality **90** with alpha. Standing sprites touch the bottom row; jump sprites have **31 transparent rows** below the feet (6.05% of 512). Each file was reopened and fully decoded with `Image.load()`, checked for RGBA mode, height 512 and zero pixels satisfying `g > r+40 and g > b+40 and alpha > 32`.

Every final sprite was individually inspected composited on dark purple `#241332`: right-facing three-quarter view, correct cream/ruby Dora or grey/cream/black-eyed Enzo identity, one tail, two arms and two legs, whole ears and feet, no clothing, floor or cast shadow, and clean edges. Closed eyes on jump poses and spiral eyes on dizzy poses intentionally replace glossy eyes. Both final jumps have paws above the ears. `dancers.json` maps each exact filename to width, height and an integer horizontal body-centre anchor at foot level, chosen from visual inspection; the anchor excludes the tail.

| File | Size | Foot x | Bytes | Fully decoded RGBA | Green-fringe pixels | Bottom gap | Dark-purple inspection |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| `dancer-dora-idle.webp` | 504×512 | 312 | 58588 | PASS | 0 | 0 px | PASS |
| `dancer-dora-step.webp` | 512×512 | 328 | 54104 | PASS | 0 | 0 px | PASS |
| `dancer-dora-up.webp` | 376×512 | 241 | 42678 | PASS | 0 | 31 px | PASS |
| `dancer-dora-point.webp` | 518×512 | 337 | 63114 | PASS | 0 | 0 px | PASS |
| `dancer-dora-dizzy.webp` | 581×512 | 366 | 70130 | PASS | 0 | 0 px | PASS |
| `dancer-enzo-idle.webp` | 500×512 | 310 | 63522 | PASS | 0 | 0 px | PASS |
| `dancer-enzo-step.webp` | 510×512 | 332 | 62250 | PASS | 0 | 0 px | PASS |
| `dancer-enzo-up.webp` | 377×512 | 245 | 46012 | PASS | 0 | 31 px | PASS |
| `dancer-enzo-point.webp` | 528×512 | 343 | 68010 | PASS | 0 | 0 px | PASS |
| `dancer-enzo-dizzy.webp` | 554×512 | 349 | 74468 | PASS | 0 | 0 px | PASS |

### Exact dancer prompts

Each block is the complete prompt submitted with the reference above; background transparency was set to false to generate the requested green matte.

#### dancer-dora-idle.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: Standing tall, bopping, both paws together at the chest, smiling, single tail curled behind. Lowest foot at baseline.
```

#### dancer-dora-step.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: Mid dance step, one hind foot stepping out, arms swinging, happy open-mouth smile. Lowest foot at baseline.
```

#### dancer-dora-up.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: overhead victory jump. Critical silhouette: each arm extends UP for the full height of the head, with the wrists HIGHER THAN BOTH EAR TIPS. Both hands are the TOPMOST parts of the entire sprite. There is empty green space between the raised arms and ears. Both small paws are at the very top, ears below paws, closed joyful eyes below ears, shoulders below face, round belly below shoulders, two airborne feet below belly. Extend arms vertically like a gymnast saluting, not sideways. You must elongate the arms enough to reach above the ears. Tall portrait framing to include paws and feet with margin. Single curled tail to left, nose points right. No ground.
```

#### dancer-dora-point.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: Disco pose: one paw pointing diagonally up to the sky, the other paw on the hip, cheeky grin. Lowest foot at baseline.
```

#### dancer-dora-dizzy.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: Wobbly and dazed but cute, swirly spiral eyes, little yellow stars round the head, paws out for balance. Lowest foot at baseline.
```

#### dancer-enzo-idle.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Standing tall, bopping, both paws together at the chest, smiling, single tail curled behind. Lowest foot at baseline.
```

#### dancer-enzo-step.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Mid dance step, one hind foot stepping out, arms swinging, happy open-mouth smile. Lowest foot at baseline.
```

#### dancer-enzo-up.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: overhead victory jump. Critical silhouette: each arm extends UP for the full height of the head, with the wrists HIGHER THAN BOTH EAR TIPS. Both hands are the TOPMOST parts of the entire sprite. There is empty green space between the raised arms and ears. Both small paws are at the very top, ears below paws, closed joyful eyes below ears, shoulders below face, round belly below shoulders, two airborne feet below belly. Extend arms vertically like a gymnast saluting, not sideways. You must elongate the arms enough to reach above the ears. Tall portrait framing to include paws and feet with margin. Single curled tail to left, nose points right. No ground.
```

#### dancer-enzo-point.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Disco pose: one paw pointing diagonally up to the sky, the other paw on the hip, cheeky grin. Lowest foot at baseline.
```

#### dancer-enzo-dizzy.webp — selected prompt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Wobbly and dazed but cute, swirly spiral eyes, little yellow stars round the head, paws out for balance. Lowest foot at baseline.
```

### Earlier jump attempts

These successful generations were discarded because their paws were below the ear tips.

#### dora-up — initial attempt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: Jumping with joy, both arms raised high above the head, feet just off the ground, eyes closed happy. Both feet visible, small hop.
```

#### enzo-up — initial attempt

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Jumping with joy, both arms raised high above the head, feet just off the ground, eyes closed happy. Both feet visible, small hop.
```

#### dora-up — first retry

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Dora: cream-white chinchilla, pink inner ears, ruby-red eyes with two highlights when open, soft pink nose, white bushy tail. Pose: Jumping with joy, eyes closed happy, both feet airborne. BOTH ARMS STRETCHED STRAIGHT UP, long enough that BOTH PAWS ARE ABOVE THE TOPS OF THE EARS, hands higher than the entire head. Arms reach upward alongside the outside of the ears in a narrow high V, never out sideways or near cheeks. Maintain two natural arms attached at shoulders, no extra limbs. Frame entire raised paws with margin, full body and single tail. Small hop.
```

#### enzo-up — first retry

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Jumping with joy, eyes closed happy, both feet airborne. BOTH ARMS STRETCHED STRAIGHT UP, long enough that BOTH PAWS ARE ABOVE THE TOPS OF THE EARS, hands higher than the entire head. Arms reach upward alongside the outside of the ears in a narrow high V, never out sideways or near cheeks. Maintain two natural arms attached at shoulders, no extra limbs. Frame entire raised paws with margin, full body and single tail. Small hop.
```

Validation history: the first conversion detected two green-fringe pixels after lossy WebP encoding; constraining green again after resampling fixed this. Dark-purple inspection then revealed faint matte residue; sampling the actual background and discarding near-matte pixels removed it. All final files passed every check above. Only the ten requested dancer WebPs, `public/art/disco/dancers.json`, and this appended section were written in the repository. Existing documentation was preserved. No code or CHANGELOG.md changes were made, and nothing was committed.


## Crowd (27-10-2026)

Painted using only the built-in image generation tool, one sprite per call. Both `public/art/disco/dancer-dora-idle.webp` and `public/art/disco/dancer-enzo-idle.webp` were inspected and supplied to every call as style references. Every call used `transparent_background: false` and requested a pure green chroma background. No paid CLI/API fallback or API key was used. Only the twelve requested crowd WebPs and this appended section were written in the repository by this task. No code or CHANGELOG.md edits were made by this task; nothing was committed.

### Processing and inspection

Pillow and NumPy removed the matte and unmixed green from soft edges: alpha was estimated as `1 - max(0, g - max(r,b))/255`, clamped to [0,1]; near-matte pixels (`g > 200`, `r < 45`, `b < 45`) and alpha below 0.10 were discarded. Foreground colour was recovered by subtracting `(1-alpha) * (0,255,0)` and dividing by alpha. Residual green was constrained to at most `max(r,b)+12`, including after resampling. Each image was cropped to its nontransparent bounds and resized proportionally with Lanczos to exactly 320 px tall, preserving the body cutoff at the bottom row, then saved as WebP with alpha at quality 90.

Each final WebP was reopened and fully decoded with `Image.load()`. Assertions checked format-compatible RGBA, height 320, body pixels on the bottom row, and zero pixels satisfying `g > r+40 and g > b+40 and alpha > 32`. Each decoded sprite was composited on dark purple `#251336` and inspected individually, as well as in a contact sheet. All selected sprites have clean edges, rear-facing heads and fur-covered ear backs, one continuous tail, two arms, flat cropped hips, and the requested coat/accessory. Cheer poses have both paws above the ears; bob poses have paws down (a far paw can be occluded by the body or tail). The glow-stick is yellow. No extra limbs, floor or cast shadow were observed in the final set.

### Validation

| File | Size | Bytes | Decode | Green-fringe pixels | Flat bottom | Purple visual review |
| --- | --- | ---: | --- | ---: | --- | --- |
| `public/art/disco/crowd-f1-bob.webp` | 319×320 | 34606 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f1-cheer.webp` | 301×320 | 34210 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f2-bob.webp` | 317×320 | 30006 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f2-cheer.webp` | 300×320 | 28626 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f3-bob.webp` | 316×320 | 33312 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f3-cheer.webp` | 317×320 | 35338 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f4-bob.webp` | 319×320 | 28564 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f4-cheer.webp` | 307×320 | 27762 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f5-bob.webp` | 314×320 | 34502 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f5-cheer.webp` | 314×320 | 34164 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f6-bob.webp` | 319×320 | 35420 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |
| `public/art/disco/crowd-f6-cheer.webp` | 310×320 | 31354 | PASS: RGBA, fully decoded | 0 | PASS: body on bottom row | PASS |

### Generation and retry history

There were 25 successful generations: the initial twelve, six cheer pose replacements, six bob rear-ear replacements, and one further f5-cheer anatomy replacement. Three additional calls timed out: initial f5-bob, the first f5-cheer pose-replacement attempt, and the first f1-bob rear-ear replacement attempt. Each was retried with exactly the same prompt and succeeded. Initial cheer sprites had paws too low; initial bob sprites showed pink ear interiors rather than fur-covered backs. The first f5-cheer replacement had extra side paws and was discarded. Final inspection passed after these regenerations. No timed-out call contributed a selected image. Local dependency setup used a temporary Python virtual environment with Pillow and NumPy; no repository dependency files were changed.

### Exact selected prompts

The following blocks are the complete prompts submitted verbatim for the selected files.

#### crowd-f1-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f1, light silver-grey coat with a darker grey back. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music. Critical rear-view correction: the backs of BOTH ears face the camera and are entirely fur-covered in the coat colour, with ONLY a very thin pink rim, NO visible pink inner-ear dishes. No face. Exactly TWO paws total, both down by hips. No green leaves or green accessories.
```

#### crowd-f1-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f1, light silver-grey coat with a darker grey back. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture.  Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves.
```

#### crowd-f2-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f2, warm beige / tan coat. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music. Critical rear-view correction: the backs of BOTH ears face the camera and are entirely fur-covered in the coat colour, with ONLY a very thin pink rim, NO visible pink inner-ear dishes. No face. Exactly TWO paws total, both down by hips. No green leaves or green accessories.
```

#### crowd-f2-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f2, warm beige / tan coat. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture.  Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves.
```

#### crowd-f3-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f3, dark charcoal grey coat. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music. Critical rear-view correction: the backs of BOTH ears face the camera and are entirely fur-covered in the coat colour, with ONLY a very thin pink rim, NO visible pink inner-ear dishes. No face. Exactly TWO paws total, both down by hips. No green leaves or green accessories.
```

#### crowd-f3-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f3, dark charcoal grey coat. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture.  Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves.
```

#### crowd-f4-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f4, cream white coat with a little pink flower tucked behind one ear. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music. Critical rear-view correction: the backs of BOTH ears face the camera and are entirely fur-covered in the coat colour, with ONLY a very thin pink rim, NO visible pink inner-ear dishes. No face. Exactly TWO paws total, both down by hips. No green leaves or green accessories.
```

#### crowd-f4-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f4, cream white coat with a little pink flower tucked behind one ear. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture.  Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves.
```

#### crowd-f5-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f5, soft brown-grey sandy mosaic coat with a small red bow on the single tail. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music. Critical rear-view correction: the backs of BOTH ears face the camera and are entirely fur-covered in the coat colour, with ONLY a very thin pink rim, NO visible pink inner-ear dishes. No face. Exactly TWO paws total, both down by hips. No green leaves or green accessories.
```

#### crowd-f5-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f5, soft brown-grey sandy mosaic coat with a small red bow on the single tail. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture.  Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves. Anatomy correction: EXACTLY TWO ARMS TOTAL, both raised overhead. Remove all side paws at ear bases: those are NOT additional paws. Only two hands in the entire image, both above ear tips. No hands at sides or next to ears.
```

#### crowd-f6-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f6, pale grey coat with a tiny glowing YELLOW glow-stick held in one paw; yellow light only, never green. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music. Critical rear-view correction: the backs of BOTH ears face the camera and are entirely fur-covered in the coat colour, with ONLY a very thin pink rim, NO visible pink inner-ear dishes. No face. Exactly TWO paws total, both down by hips. No green leaves or green accessories.
```

#### crowd-f6-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f6, pale grey coat with a tiny glowing YELLOW glow-stick held in one paw; yellow light only, never green. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. Hold the yellow glow-stick up in one raised paw. Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves.
```

### Exact earlier prompts (discarded generations)

Each initial prompt below produced one discarded sprite. The f5-bob timeout retry used its same initial prompt.

#### Initial crowd-f1-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f1, light silver-grey coat with a darker grey back. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music.
```

#### Initial crowd-f1-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f1, light silver-grey coat with a darker grey back. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. 
```

#### Initial crowd-f2-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f2, warm beige / tan coat. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music.
```

#### Initial crowd-f2-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f2, warm beige / tan coat. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. 
```

#### Initial crowd-f3-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f3, dark charcoal grey coat. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music.
```

#### Initial crowd-f3-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f3, dark charcoal grey coat. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. 
```

#### Initial crowd-f4-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f4, cream white coat with a little pink flower tucked behind one ear. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music.
```

#### Initial crowd-f4-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f4, cream white coat with a little pink flower tucked behind one ear. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. 
```

#### Initial crowd-f5-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f5, soft brown-grey sandy mosaic coat with a small red bow on the single tail. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music.
```

#### Initial crowd-f5-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f5, soft brown-grey sandy mosaic coat with a small red bow on the single tail. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. 
```

#### Initial crowd-f6-bob.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f6, pale grey coat with a tiny glowing YELLOW glow-stick held in one paw; yellow light only, never green. Pose: bob: both paws down at the sides, head tilted slightly, swaying to music.
```

#### Initial crowd-f6-cheer.webp

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f6, pale grey coat with a tiny glowing YELLOW glow-stick held in one paw; yellow light only, never green. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture. Hold the yellow glow-stick up in one raised paw.
```

#### f5-cheer — first pose replacement (discarded extra paws)

The timed-out attempt and its successful retry both used this exact prompt:

```text
Use case: illustration-story. Asset type: single Dust Disco front-row audience sprite. The two supplied dancer images are STYLE REFERENCES ONLY: match exactly their warm hand-painted toon storybook rendering, soft cel shading, gentle fine brown ink edges, fluffy fine fur strokes, chibi chinchilla proportions and huge round dish ears with pink insides. Paint ONE chinchilla SEEN STRICTLY FROM BEHIND, watching a stage away from us: back of head, backs of big ears, back and ONE continuous bushy tail; no face, eyes or muzzle visible. Kind joyful mood. Centered portrait from whole ear tips (and raised paws if any) down to hips. Body continues beyond the BOTTOM IMAGE EDGE and is cut off horizontally flat there; no feet or rounded body ending. Leave green margin above and at sides, none beneath the body. Exactly two arms and one tail, no other characters. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No floor, shadows, text, border, stage or scenery. Subject: friend f5, soft brown-grey sandy mosaic coat with a small red bow on the single tail. Pose: cheer: BOTH paws raised HIGH above the head and waving, ears perked, joyful back-view gesture.  Critical pose correction: elongate BOTH arms vertically upward so BOTH PAWS are ABOVE THE TIPS OF BOTH EARS, the topmost parts of the sprite. Narrow high V with green gaps between arms and ears. Hands above ears, not beside ears or cheeks. Keep rear view and flat cropped hips at bottom. Ear backs are fur-covered; show at most a thin pink inner-ear rim. Accessories contain no green leaves.
```

The f1-bob rear-ear replacement timeout and successful retry both used the exact selected f1-bob prompt above. All other successful replacement prompts are the selected prompts above.


## Notes, spot and ball (27-10-2026)

Generated exclusively with the built-in image generation tool. Both `public/art/disco/dancer-dora-idle.webp` and `public/art/disco/venue-burrow.webp` were inspected and passed as style references to every call; neither was an edit target. No paid image CLI/API fallback or API key was used. No code or CHANGELOG.md was changed, and nothing was committed.

Seven final pieces were delivered. Each note and the ball succeeded on its first generation. The spot was generated four times: three versions were discarded because the top ellipse was too shallow; the fourth was selected. The selected outer gold-rim ellipse is approximately 2.7 times wider than tall, with an empty, unpatterned plum surface and two lanterns below it. The ball's short braided suspension string reaches the top edge of the cropped sprite.

Processing used Pillow and numpy in a temporary environment outside the repository. For each source, a chroma-dominance mask identified the clean foreground. A normalized Gaussian neighbourhood estimated foreground edge colours, alpha was solved from `C = alpha F + (1-alpha) B`, and the chroma contribution was unmixed from soft edges. Residual spill was suppressed. Alpha below 4/255 was cleared, then the image was cropped to nontransparent bounds. Notes were centred on a transparent square and Lanczos-resized to 256×256; spot and ball were Lanczos-resized proportionally to widths 512 and 256. Files were encoded as WebP with alpha at **quality 90**. Green was the chroma for all pieces except mint `note-2`, which used magenta.

Every saved WebP was reopened and fully decoded with `Image.load()`, with format, RGBA mode and dimensions asserted. On the decoded pixels, all green-matte files have zero pixels with `g > r+40 and g > b+40 and alpha > 32`; the magenta-matte mint note has zero pixels with `r > g+60 and b > g+60 and alpha > 32`. Each saved piece was composited on dark purple `#251532` and visually inspected; each note was additionally inspected at exactly 40×40. Faces remain legible, lane colours distinct, fluffy edges clean, and the golden-white Dust Up puff visibly sparkly. No chroma fringe, text, letters or numbers were observed. Local setup required a temporary Python environment because numpy was absent; this was not an image-generation fallback.

`pieces.json` records the selected stage's dimensions and the approximate centre and horizontal radius of the outer top ellipse in final sprite pixels: `{"spot": {"w": 512, "h": 240, "topY": 96, "topRx": 251}}`.

| File | Decoded size | Bytes | RGBA / full decode | Chroma violations | Dark-purple inspection | 40 px note inspection |
| --- | --- | ---: | --- | ---: | --- | --- |
| `note-0.webp` | 256×256 | 20014 | PASS | 0 | PASS | PASS |
| `note-1.webp` | 256×256 | 20250 | PASS | 0 | PASS | PASS |
| `note-2.webp` | 256×256 | 21526 | PASS | 0 | PASS | PASS |
| `note-3.webp` | 256×256 | 20990 | PASS | 0 | PASS | PASS |
| `note-gold.webp` | 256×256 | 22838 | PASS | 0 | PASS | PASS |
| `spot.webp` | 512×240 | 28304 | PASS | 0 | PASS | N/A |
| `ball.webp` | 256×319 | 29638 | PASS | 0 | PASS | N/A |

### Exact generation prompts

Every call used the two reference paths stated above and `transparent_background: false`, to generate the explicitly requested chroma backdrop. Each block is the full verbatim prompt.

#### note-0.webp

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE round fluffy dust puffball seen straight on, whole puff tinted pink #ff8fb1. Soft fuzzy fringe all round, two small shiny black dot eyes and a tiny happy mouth, little highlight on top. Bold simple circular shape and strong face that read clearly at 40 pixels across. No ears, limbs, tail or accessories. Centered circular puff filling most of a square frame, with a small clear margin all around. Background perfectly flat uniform pure GREEN #00ff00, no gradient, no shadow on the background. Never let the subject contain the chroma colour. No floor or scenery.
```

#### note-1.webp

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE round fluffy dust puffball seen straight on, whole puff tinted golden yellow #ffc95c. Soft fuzzy fringe all round, two small shiny black dot eyes and a tiny happy mouth, little highlight on top. Bold simple circular shape and strong face that read clearly at 40 pixels across. No ears, limbs, tail or accessories. Centered circular puff filling most of a square frame, with a small clear margin all around. Background perfectly flat uniform pure GREEN #00ff00, no gradient, no shadow on the background. Never let the subject contain the chroma colour. No floor or scenery.
```

#### note-2.webp

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE round fluffy dust puffball seen straight on, whole puff tinted mint green #7fe0b0. Soft fuzzy fringe all round, two small shiny black dot eyes and a tiny happy mouth, little highlight on top. Bold simple circular shape and strong face that read clearly at 40 pixels across. No ears, limbs, tail or accessories. Centered circular puff filling most of a square frame, with a small clear margin all around. Background perfectly flat uniform pure MAGENTA #ff00ff, no gradient, no shadow on the background. Never let the subject contain the chroma colour. No floor or scenery.
```

#### note-3.webp

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE round fluffy dust puffball seen straight on, whole puff tinted sky blue #7cc6ff. Soft fuzzy fringe all round, two small shiny black dot eyes and a tiny happy mouth, little highlight on top. Bold simple circular shape and strong face that read clearly at 40 pixels across. No ears, limbs, tail or accessories. Centered circular puff filling most of a square frame, with a small clear margin all around. Background perfectly flat uniform pure GREEN #00ff00, no gradient, no shadow on the background. Never let the subject contain the chroma colour. No floor or scenery.
```

#### note-gold.webp

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE round fluffy dust puffball seen straight on, whole puff tinted sparkly golden-white with tiny star glints. Soft fuzzy fringe all round, two small shiny black dot eyes and a tiny happy mouth, little highlight on top. Bold simple circular shape and strong face that read clearly at 40 pixels across. No ears, limbs, tail or accessories. Centered circular puff filling most of a square frame, with a small clear margin all around. Background perfectly flat uniform pure GREEN #00ff00, no gradient, no shadow on the background. Never let the subject contain the chroma colour. No floor or scenery.
```

#### Initial spot — discarded

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE short round wooden drum pedestal, front view at a low angle. The TOP surface is a wide ellipse exactly about 2.6 times wider than tall, a plain dark plum surface with NO pattern at all, bordered by a soft gold rim. Short front wooden side showing a little painted trim and two tiny warm amber lanterns attached to the FRONT SIDE below the top, one on each side. Nothing on top. Entire pedestal visible with small clear margin, horizontally centered. Perfectly flat uniform pure GREEN #00ff00 background, no gradient, no background shadow. No green anywhere on the subject. No floor, characters or scenery.
```

#### Second spot — discarded

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE short round wooden drum pedestal, front view at a low angle. The TOP surface is a wide ellipse exactly about 2.6 times wider than tall, a plain dark plum surface with NO pattern at all, bordered by a soft gold rim. Short front wooden side showing a little painted trim and two tiny warm amber lanterns attached to the FRONT SIDE below the top, one on each side. Nothing on top. Entire pedestal visible with small clear margin, horizontally centered. Perfectly flat uniform pure GREEN #00ff00 background, no gradient, no background shadow. No green anywhere on the subject. No floor, characters or scenery. Critical geometry: the top ellipse must have substantial visible depth: for example 780 pixels wide and 300 pixels tall, width divided by height = 2.6. Show the whole oval dark plum top prominently, viewed from slightly above while still seeing the short front side. Do not flatten the oval into a thin sliver. Overall pedestal silhouette about 2.1 times wider than tall.
```

#### Third spot — discarded

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE short round wooden drum pedestal, front view at a low angle. The TOP surface is a wide ellipse exactly about 2.6 times wider than tall, a plain dark plum surface with NO pattern at all, bordered by a soft gold rim. Short front wooden side showing a little painted trim and two tiny warm amber lanterns attached to the FRONT SIDE below the top, one on each side. Nothing on top. Entire pedestal visible with small clear margin, horizontally centered. Perfectly flat uniform pure GREEN #00ff00 background, no gradient, no background shadow. No green anywhere on the subject. No floor, characters or scenery. REQUIRED camera adjustment: see much more of the TOP. The top oval must be 800 units wide and 308 units TALL (height is 38.5 percent of width). A plump deep oval, NOT a thin horizontal ellipse. Tilt camera further downward until this ratio is achieved. Front wooden side is only 90 units tall. Overall isolated object 800 wide and 398 tall. Keep the plain plum top entirely empty, NO texture pattern. Use the references only for painting style, not camera angle.
```

#### spot.webp — selected fourth spot

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE short round wooden drum pedestal, front view at a low angle. The TOP surface is a wide ellipse exactly about 2.6 times wider than tall, a plain dark plum surface with NO pattern at all, bordered by a soft gold rim. Short front wooden side showing a little painted trim and two tiny warm amber lanterns attached to the FRONT SIDE below the top, one on each side. Nothing on top. Entire pedestal visible with small clear margin, horizontally centered. Perfectly flat uniform pure GREEN #00ff00 background, no gradient, no background shadow. No green anywhere on the subject. No floor, characters or scenery. CAMERA: elevated front view, looking down at 25 degrees. The TOP ellipse must be very deep: its width is 2.6 times its height. Top surface dimensions 780 wide by 300 tall. Total pedestal dimensions 800 wide by 370 tall. The top occupies most of the image height; very short 60-unit wooden front side. Top should appear almost halfway between a circle and a thin ellipse. Do NOT use the low camera angle of the venue reference. Plain flat dark plum top, no pattern. Entire object visible with margin.
```

#### ball.webp

```text
Use case: illustration-story. Asset type: one isolated Dust Disco game piece. Input images are STYLE REFERENCES ONLY: dancer-dora-idle.webp and venue-burrow.webp. Match their warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cute joyful mood. No text, letters, numbers, logos or watermark. Paint ONE round disco ball made of smooth coloured pebbles in pink, gold, mint, sky blue and cream, hanging from a short braided string centered at the very top. Seen straight on, softly glowing with warm highlights confined to the object. Entire ball and entire string visible with small clear margin. Mint pebbles must be pale desaturated pastel mint with blue, never vivid green. Perfectly flat uniform pure GREEN #00ff00 background, no gradient, no background shadow, no glow on background. Never pure green in the subject. No scenery or other objects.
```


## Enzo repaint (28-10-2026)

### Follow-up repaint — remaining idle

Repainted `public/art/disco/dancer-enzo-idle.webp` using only the built-in image tool. Identity references: `public/art/enzo.jpeg` (photo), `public/art/command/portrait-enzo.webp`, and `public/art/safari/walker-enzo.webp`. The current idle was the pose/style target; the new grey point and step were combined into one supporting reference sheet to meet the five-image tool limit. Dora idle was inspected for scale. No taupe disco dancer supplied identity colours.

Exact prompt:

```text
Warm hand-painted toon storybook, soft cel shading, fine fur strokes, chibi chinchilla, huge dish ears, small paws, joyful expression. Full-body upright three-quarter view facing right, both paws together at chest, smiling, single bushy tail curled behind. Edit image 4 ONLY: preserve its exact pose, silhouette, composition and painting style, same scale and foot baseline. Images 1 photo, 2 command portrait, 3 safari walker give Enzo identity; image 5 contains already corrected grey point and step colour matches. Do not draw extra characters. Enzo is COOL BLUE-GREY: mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, solid jet BLACK eyes with white glints, no brown iris or brown reflections. Never taupe, beige or brown fur. No clothes, props, text or shadows. Entire character with small margin on flat uniform pure green #00ff00 chroma background, no green on subject. Final canvas 500x512; preserve old idle subject bounds and baseline.
```

Succeeded on the first valid generation call. Original backed up at `/tmp/enzo-old/disco-dancer-enzo-idle.webp`. Pillow + numpy removed the pure-green matte and unmixed edge spill; Lanczos fitted the subject to the old bounds (0, 0, 500, 512) and baseline. Saved WebP quality 88, reopened as 500×512 RGBA, visually compared beside the old sprite, and checked for chroma fringe after encoding (zero pixels exceeding the green-spill threshold; two residual edge pixels removed). No code, changelog or commits.


Used only the built-in image generation tool, one image at a time. No CLI/API fallback or API key was used. No code or CHANGELOG.md was edited; nothing was committed.

Every generation used these three identity references: `public/art/enzo.jpeg` (real photo), `public/art/command/portrait-enzo.webp`, and `public/art/safari/walker-enzo.webp`. The current image being replaced was also supplied for its pose, composition, props and painting style, never as an identity-colour reference. Disco calls additionally supplied the matching `public/art/disco/dancer-dora-<pose>.webp` for scale and feet placement. No disco Enzo dancer was used as an identity reference.

### Files and outcomes

- `public/art/disco/dancer-enzo-idle.webp` — Skipped: Initial call timed out; identical retry produced grey fur but retained brown eyes and was rejected. Eye-correction generation and its identical retry both timed out. Original left untouched.
- `public/art/disco/dancer-enzo-point.webp` — Repainted and saved.
- `public/art/disco/dancer-enzo-step.webp` — Repainted and saved.
- `public/art/disco/dancer-enzo-up.webp` — Repainted and saved.
- `public/art/disco/dancer-enzo-dizzy.webp` — Repainted and saved.

Completed images were saved as WebP quality 88, preserving exact original pixel size and RGB/RGBA mode, and reopened and fully decoded to assert those properties. Originals were copied before replacement to `/tmp/enzo-old/<game>-<name>.webp`. Transparent sprites were generated on flat pure green #00ff00, keyed with Pillow and numpy, with green spill unmixed from soft edges, resampled with Lanczos into the original subject bounds and baseline, and checked after WebP encoding for chroma fringe. Opaque images used `ImageOps.fit` with Lanczos. Saved results were visually compared beside the originals on a dark purple background. Enzo has cool grey fur and black eyes (original closed eyes and dizzy spirals retained); props and poses were retained.

Point: initial generation timed out; identical retry succeeded. Step: initial output retained brown eye shading and was rejected; eye-correction call timed out and its identical retry succeeded. Up: initial call timed out; identical retry succeeded. Dizzy succeeded on its initial call; three residual fringe pixels detected during processing were removed before final validation.

### Exact prompts used

Each block is the exact submitted string; identical timeout retries reused it unchanged.

#### `public/art/disco/dancer-enzo-idle.webp`

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Standing tall, bopping, both paws together at the chest, smiling, single tail curled behind. Lowest foot at baseline.

EDIT OVERRIDE: Image 1 is the real Enzo photo; image 2 command portrait-enzo and image 3 safari walker-enzo are identity references ONLY (do not copy clothing, camera or poses). Image 4 is the CURRENT EDIT TARGET, not an identity reference: preserve its exact pose, expression, silhouette, painting style and framing, changing ONLY Enzo colours. Image 5 Dora is scale and baseline reference only; do not draw Dora. Enzo is a COOL BLUE-GREY chinchilla: mid-grey coat with a darker grey wavy back, pale grey-white face and chest, pink ears, solid black eyes with white glints. Never taupe, beige or brown. Replace the transparent background with flat uniform pure green #00ff00 with no spill or shadow. Match target bounding box and foot baseline exactly; final canvas 500x512. No new props or clothes. The edit override supersedes original reference instructions and pale cream colouring.
```

Eye-correction prompt (both calls timed out):

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Standing tall, bopping, both paws together at the chest, smiling, single tail curled behind. Lowest foot at baseline.

EDIT OVERRIDE: Image 1 is the real Enzo photo; image 2 command portrait-enzo and image 3 safari walker-enzo are identity references ONLY (do not copy clothing, camera or poses). Image 4 is the CURRENT EDIT TARGET, not an identity reference: preserve its exact pose, expression, silhouette, painting style and framing, changing ONLY Enzo colours. Image 5 Dora is scale and baseline reference only; do not draw Dora. Enzo is a COOL BLUE-GREY chinchilla: mid-grey coat with a darker grey wavy back, pale grey-white face and chest, pink ears, solid black eyes with white glints. Never taupe, beige or brown. Replace the transparent background with flat uniform pure green #00ff00 with no spill or shadow. Match target bounding box and foot baseline exactly; final canvas 500x512. No new props or clothes. The edit override supersedes original reference instructions and pale cream colouring.
CRITICAL: BOTH ENTIRE EYES MUST BE SOLID JET BLACK #000000, with only white glints. Absolutely NO brown iris, NO brown crescent or warm lower-eye reflection. Coat and pale chest must be cool neutral blue-grey and grey-white, never warm cream. This is a precise colour correction of image 4.
```

#### `public/art/disco/dancer-enzo-point.webp`

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Disco pose: one paw pointing diagonally up to the sky, the other paw on the hip, cheeky grin. Lowest foot at baseline.

EDIT OVERRIDE: References 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo define identity colours ONLY, no clothing. Reference 4 CURRENT EDIT TARGET defines exact pose, silhouette, framing and painting style; NOT an identity reference. Reference 5 Dora defines scale and feet baseline only, do not draw Dora. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, SOLID JET BLACK eyes with white glints. NO brown iris or brown eye reflections; never taupe, beige or brown fur. Preserve closed eyes or spiral eyes if in target. Preserve ALL anatomy, expression and pose; match target bounding box and baseline within a few pixels. Uniform pure green #00ff00 background, no spill, shadow or gradient. Supersede original reference and cream-colour instructions.
```

#### `public/art/disco/dancer-enzo-step.webp`

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Mid dance step, one hind foot stepping out, arms swinging, happy open-mouth smile. Lowest foot at baseline.

EDIT OVERRIDE: References 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo define identity colours ONLY, no clothing. Reference 4 CURRENT EDIT TARGET defines exact pose, silhouette, framing and painting style; NOT an identity reference. Reference 5 Dora defines scale and feet baseline only, do not draw Dora. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, SOLID JET BLACK eyes with white glints. NO brown iris or brown eye reflections; never taupe, beige or brown fur. Preserve closed eyes or spiral eyes if in target. Preserve ALL anatomy, expression and pose; match target bounding box and baseline within a few pixels. Uniform pure green #00ff00 background, no spill, shadow or gradient. Supersede original reference and cream-colour instructions.
```

Eye-correction prompt (selected final output):

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Mid dance step, one hind foot stepping out, arms swinging, happy open-mouth smile. Lowest foot at baseline.

EDIT OVERRIDE: References 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo define identity colours ONLY, no clothing. Reference 4 CURRENT EDIT TARGET defines exact pose, silhouette, framing and painting style; NOT an identity reference. Reference 5 Dora defines scale and feet baseline only, do not draw Dora. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, SOLID JET BLACK eyes with white glints. NO brown iris or brown eye reflections; never taupe, beige or brown fur. Preserve closed eyes or spiral eyes if in target. Preserve ALL anatomy, expression and pose; match target bounding box and baseline within a few pixels. Uniform pure green #00ff00 background, no spill, shadow or gradient. Supersede original reference and cream-colour instructions.
CRITICAL EYE CORRECTION: every pixel within both irises must be pure jet black except white glints. NO warm lower-eye reflection, no brown gradient, no brown crescent. Preserve everything else exactly.
```

#### `public/art/disco/dancer-enzo-up.webp`

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: overhead victory jump. Critical silhouette: each arm extends UP for the full height of the head, with the wrists HIGHER THAN BOTH EAR TIPS. Both hands are the TOPMOST parts of the entire sprite. There is empty green space between the raised arms and ears. Both small paws are at the very top, ears below paws, closed joyful eyes below ears, shoulders below face, round belly below shoulders, two airborne feet below belly. Extend arms vertically like a gymnast saluting, not sideways. You must elongate the arms enough to reach above the ears. Tall portrait framing to include paws and feet with margin. Single curled tail to left, nose points right. No ground.

EDIT OVERRIDE: References 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo define identity colours ONLY, no clothing. Reference 4 CURRENT EDIT TARGET defines exact pose, silhouette, framing and painting style; NOT an identity reference. Reference 5 Dora defines scale and feet baseline only, do not draw Dora. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, SOLID JET BLACK eyes with white glints. NO brown iris or brown eye reflections; never taupe, beige or brown fur. Preserve closed eyes or spiral eyes if in target. Preserve ALL anatomy, expression and pose; match target bounding box and baseline within a few pixels. Uniform pure green #00ff00 background, no spill, shadow or gradient. Supersede original reference and cream-colour instructions.
```

#### `public/art/disco/dancer-enzo-dizzy.webp`

```text
Use case: illustration-story. Asset type: single full-body dance sprite for Dust Disco. Input image public/art/disco/title.webp is the exact character and painted style reference. Match its chinchilla identity exactly, but remove ALL clothing and accessories. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fine fur strokes, chibi proportions, huge round dish ears, big glossy eyes with two highlights when open, small paws, kind joyful cute expression. Exactly one character, two arms, two hind legs and ONE continuous bushy tail. Full body upright on hind feet, three-quarter view FACING TO THE VIEWER'S RIGHT (nose points right). Whole ears, paws, feet and tail in frame with generous margin. Perfectly flat uniform pure green #00ff00 chroma background, no gradient, no green on character. No clothes, props, text, floor, cast shadow or background shadow. Subject: Enzo: grey chinchilla with darker grey back and fine fur strokes, pale cream chest and belly, black glossy eyes with two highlights when open, pink inner ears, grey bushy tail. Pose: Wobbly and dazed but cute, swirly spiral eyes, little yellow stars round the head, paws out for balance. Lowest foot at baseline.

EDIT OVERRIDE: References 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo define identity colours ONLY, no clothing. Reference 4 CURRENT EDIT TARGET defines exact pose, silhouette, framing and painting style; NOT an identity reference. Reference 5 Dora defines scale and feet baseline only, do not draw Dora. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, SOLID JET BLACK eyes with white glints. NO brown iris or brown eye reflections; never taupe, beige or brown fur. Preserve closed eyes or spiral eyes if in target. Preserve ALL anatomy, expression and pose; match target bounding box and baseline within a few pixels. Uniform pure green #00ff00 background, no spill, shadow or gradient. Supersede original reference and cream-colour instructions.
```
