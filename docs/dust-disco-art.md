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

