# Whisker Saga equipment artwork · 13-10-2026

Mode: built-in imagegen. Runtime asset: `public/art/saga/equipment.png`, copied unchanged from the generated RGBA source. Reference: `public/art/saga/heroes-0.png` for painted materials and clover motifs.

Layout: 2 columns × 2 rows; weapon, armour / charm, boots. `lib/saga-crops.ts` contains measured alpha bounds with a four-pixel transparent gutter. Read-only alpha analysis measured the source; no image pixels were edited. The cropper preserves disconnected parts such as the boots. Squad, Forge and loot use the same icons, coloured tier frames and five small tier pips. Empty slots show a subdued silhouette; labels, exact bonuses, accessible tier descriptions and bag counts remain live. Artwork loads on demand and has a recognizable icon fallback while downloading or if unavailable. Gear rules, tiers and saved progress are unchanged.

Exact generation prompt:

```text
Use case: stylized-concept. Production EQUIPMENT ICON ATLAS for Whisker Saga, genuine transparent RGBA background. EXACTLY 2 equal columns × 2 equal rows, FOUR isolated complete objects, consistent hand-painted storybook art matching the reference game's tangible wood, leather, gold metal and emerald clover styling. Square canvas preferably1024x1024. Each object centered in its own quadrant, occupies70-78% of cell, generous transparent margin around all edges. No background, ground, pedestal, cast shadow, frame, border, text, numerals, labels, glow, sparkles, extra objects, or characters. Easy to recognize when displayed at56px.
TOP LEFT WEAPON: one elegant short silver sword with gold clover-emblem hilt and brown wrapped grip, diagonal lower-left handle to upper-right tip, full blade and pommel.
TOP RIGHT ARMOUR: one small sturdy brown leather adventurer's chest vest/cuirass, front three-quarter view, rounded shoulder tabs, stitched padding, warm gold buckles and a small embossed clover emblem. No wearer, face, arms or legs, no helmet or shield.
BOTTOM LEFT CHARM: one gold clover-shaped medallion with bright emerald gem center, attached short brown leather cord loop, a complete readable pendant shape, no staff.
BOTTOM RIGHT BOOTS: one PAIR of small brown leather adventurer boots as one grouped icon, slightly offset three-quarter view facing right, golden buckles, soft cream fur cuff, sturdy short rounded soles, no feet or wearer.
Strong silhouettes, polished painterly material detail, natural soft upper-left highlight. Transparent gutters keep all four icons separate. Reference image only supplies material/art styling, do not include any of its characters or scenery.
```
