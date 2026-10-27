# Pawhaven painted building sprites

Date: 27-10-2026

33 isolated building and scenery sprites for the Canvas 2D scene's 64 × 32 px (2:1) tile grid. Assets are prepared here; renderer integration is a separate change.

Generated with the built-in imagegen tool, one sprite per call. The only image reference supplied was `public/art/roll/level-garden.webp`, used for style only. Each prompt is the shared prompt below, with BACKGROUND substituted from the table, followed by the per-sprite subject and footprint sentence. No source code was changed.

## Shared prompt

```text
Use case: illustration-story. Paint one production game sprite for Pawhaven, a cosy chinchilla town-builder. Use the supplied garden image ONLY as a style reference: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours, warm upper-left light. Rounded chunky chinchilla-scale architecture, round doors and big friendly windows where appropriate. VIEW CRITICAL: true orthographic 2:1 isometric seen from front-right corner, camera down about 30 degrees, two visible faces, parallel ground edges slope exactly 1 up/down for 2 across. Ground footprint is a 2:1 diamond, front vertex at bottom centre, lateral vertices at the object's extreme left and right; all roof/details fit within footprint width. Include a thin painted diamond base patch entirely inside footprint, no surrounding terrain. Leave margin around object for clean extraction. Single isolated object on perfectly flat uniform pure BACKGROUND chroma, no gradient, no cast shadow on background. No text, letters, numbers, logos, writing, UI, watermark or characters. Do not copy the reference scene or creatures. Subject:
```

## Per-sprite prompts

Append `Footprint N by N tiles.` to each subject unless the table already includes it. The first Hay Nest call used `Footprint 1 tile.`.

| Sprite | Footprint | Chroma | Subject prompt |
| --- | --- | --- | --- |
| `home-1` | 1 × 1 | `#ff00ff` magenta | Hay Nest: a round mound nest of golden hay with a small dark doorway. |
| `home-2` | 1 × 1 | `#ff00ff` magenta | Twig Hut: a small hut of woven twigs with a thatched cone roof and round door. |
| `home-3` | 1 × 1 | `#ff00ff` magenta | Snug Burrow: a grassy hillock burrow with a round wooden door and a little round window. |
| `home-4` | 1 × 1 | `#ff00ff` magenta | Dusty Burrow: a larger snug burrow with a tiny tray of pale dust-bath sand beside the door. |
| `home-5` | 1 × 1 | `#ff00ff` magenta | Cosy Burrow: a cottage burrow with a stone chimney, a flower box and a clay pot by the door. |
| `home-6` | 1 × 1 | `#ff00ff` magenta | Fine Burrow: a two-storey burrow cottage with a blue round door, flowers and a small wooden toy on the step. |
| `home-7` | 1 × 1 | `#00ff00` green | Grand Burrow: a grand hillside burrow manor with an arched door, a lantern, soft pink bedding airing on a line, flowers and a tiny plain pennant. |
| `well` | 1 × 1 | `#ff00ff` magenta | A round stone well with a little red shingle roof and a bucket. |
| `tower` | 2 × 2 | `#00ff00` green | A wooden water tower on stilts with a big blue water tank and a red cone roof. Footprint 2 by 2 tiles. All holes and open spaces between beams must show the same pure green chroma background. No pink surfaces. |
| `berry` | 2 × 2 | `#ff00ff` magenta | A patch of round berry bushes heavy with red berries, edged by a tiny picket fence. |
| `woodcutter` | 1 × 1 | `#ff00ff` magenta | A small log cabin with a chopping stump and neatly stacked logs. |
| `clayPit` | 2 × 2 | `#ff00ff` magenta | A dug pit of orange-brown clay with a wooden ramp and two buckets. |
| `sandPit` | 2 × 2 | `#ff00ff` magenta | A pit of pale sand with a wooden sieve and sand piles. |
| `dustMill` | 2 × 2 | `#00ff00` green | A small windmill with lavender sails, sacks of fine lavender-white dust. Footprint 2 by 2 tiles. Preserve the soft lavender and pale purple materials clearly; no green or pink dust. Open gaps show pure green chroma background. |
| `potter` | 2 × 2 | `#ff00ff` magenta | A potter's workshop with a round kiln chimney and pots on shelves outside. |
| `toymaker` | 2 × 2 | `#ff00ff` magenta | A toymaker's cottage with wooden toys (spinning tops, little carts) on the porch. |
| `weaver` | 2 × 2 | `#00ff00` green | A weaver's cottage with a loom under an awning and soft pink blankets hanging. |
| `granary` | 3 × 3 | `#ff00ff` magenta | A round granary with a conical thatched roof and grain sacks. |
| `storehouse` | 3 × 3 | `#ff00ff` magenta | A wooden storehouse barn with crates and barrels. |
| `market` | 2 × 2 | `#ff00ff` magenta | A market stall with a striped awning, baskets of berries and pots. |
| `bathhouse` | 2 × 2 | `#00ff00` green | An open-air dust bath house: a wide round tub of fine lavender dust under a little canopy. Footprint 2 by 2 tiles. Preserve the soft lavender and pale purple materials clearly; no green or pink dust. Open gaps show pure green chroma background. |
| `herb` | 1 × 1 | `#ff00ff` magenta | A herb hut with a green roof and bundles of herbs drying. |
| `story` | 2 × 2 | `#ff00ff` magenta | A story circle: a ring of log stools around a big tree stump with an open book on it. Book pages blank, no writing. |
| `music` | 2 × 2 | `#ff00ff` magenta | A music stump: a wide tree-stump stage with a little drum and pan pipes. |
| `fireWatch` | 1 × 1 | `#ff00ff` magenta | A tall wooden watch tower with a brass bell and a red roof. |
| `foxWatch` | 1 × 1 | `#ff00ff` magenta | A wooden lookout post with a green roof and a horn. |
| `garden` | 1 × 1 | `#00ff00` green | A small raised flower bed with colourful flowers. |
| `pond` | 2 × 2 | `#ff00ff` magenta | A small round pond with lily pads and reeds. |
| `statue` | 3 × 3 | `#ff00ff` magenta | A pale stone statue of a chibi chinchilla (huge round ears, big eyes, one bushy tail) on a plinth. |
| `plaza` | 2 × 2 | `#ff00ff` magenta | A paved round stone plaza with a small fountain. |
| `tradingPost` | 3 × 3 | `#ff00ff` magenta | A trading post with a red-and-cream tent canopy, crates and a little handcart. |
| `hall` | 3 × 3 | `#ff00ff` magenta | A town hall: a grand timber hall with a bell tower and plain coloured banners (no writing). |
| `rubble` | 1 × 1 | `#ff00ff` magenta | A tidy pile of stones and planks. |

The water tower was regenerated on green after visual inspection found shaded magenta in its open structure. The original tower used the same shared prompt on magenta with the subject “A wooden water tower on stilts with a big blue water tank and a red cone roof.” The dust mill and bathhouse were also regenerated on green to preserve their lavender colours. Their original calls used the same subject descriptions on magenta, without the final colour-preservation sentences. All other accepted images use their first generation. No generation timeouts occurred.

## Chroma extraction and export

Pillow and numpy remove the chroma matte, unmix background colour from partially covered edges, crop to the nontransparent object bounds, and resample with Lanczos to exactly 256 px per footprint tile. The resampled alpha gives a soft approximately 1–2 px boundary. Empty terminal rows from resampling are trimmed to the last near-opaque row. Outputs are WebP with alpha at quality 90, under `public/art/pawhaven/sprites/`.

Validation is performed on the reopened WebP files. Top-corner checks require alpha 0 at both top corner pixels; bottom checks require alpha ≥250 in the central 20% of the final row. Visual checks inspect the isometric diamond footprint, bottom-centre front corner, object containment, painted style, background removal, and absence of writing. These are prepared assets, not screenshots of in-game integration.

## Validation

| Sprite | Tiles | Export (px) | RGBA | Top corners transparent | Bottom centre opaque | Isometric / no writing |
| --- | --- | --- | --- | --- | --- | --- |
| `home-1.webp` | 1 | 256 × 212 | Pass | Pass | Pass | Pass |
| `home-2.webp` | 1 | 256 × 270 | Pass | Pass | Pass | Pass |
| `home-3.webp` | 1 | 256 × 173 | Pass | Pass | Pass | Pass |
| `home-4.webp` | 1 | 256 × 172 | Pass | Pass | Pass | Pass |
| `home-5.webp` | 1 | 256 × 216 | Pass | Pass | Pass | Pass |
| `home-6.webp` | 1 | 256 × 227 | Pass | Pass | Pass | Pass |
| `home-7.webp` | 1 | 256 × 201 | Pass | Pass | Pass | Pass |
| `well.webp` | 1 | 256 × 286 | Pass | Pass | Pass | Pass |
| `tower.webp` | 2 | 512 × 499 | Pass | Pass | Pass | Pass |
| `berry.webp` | 2 | 512 × 310 | Pass | Pass | Pass | Pass |
| `woodcutter.webp` | 1 | 256 × 218 | Pass | Pass | Pass | Pass |
| `clayPit.webp` | 2 | 512 × 288 | Pass | Pass | Pass | Pass |
| `sandPit.webp` | 2 | 512 × 298 | Pass | Pass | Pass | Pass |
| `dustMill.webp` | 2 | 512 × 446 | Pass | Pass | Pass | Pass |
| `potter.webp` | 2 | 512 × 364 | Pass | Pass | Pass | Pass |
| `toymaker.webp` | 2 | 512 × 422 | Pass | Pass | Pass | Pass |
| `weaver.webp` | 2 | 512 × 356 | Pass | Pass | Pass | Pass |
| `granary.webp` | 3 | 768 × 610 | Pass | Pass | Pass | Pass |
| `storehouse.webp` | 3 | 768 × 539 | Pass | Pass | Pass | Pass |
| `market.webp` | 2 | 512 × 427 | Pass | Pass | Pass | Pass |
| `bathhouse.webp` | 2 | 512 × 392 | Pass | Pass | Pass | Pass |
| `herb.webp` | 1 | 256 × 232 | Pass | Pass | Pass | Pass |
| `story.webp` | 2 | 512 × 307 | Pass | Pass | Pass | Pass |
| `music.webp` | 2 | 512 × 384 | Pass | Pass | Pass | Pass |
| `fireWatch.webp` | 1 | 256 × 372 | Pass | Pass | Pass | Pass |
| `foxWatch.webp` | 1 | 256 × 321 | Pass | Pass | Pass | Pass |
| `garden.webp` | 1 | 256 × 188 | Pass | Pass | Pass | Pass |
| `pond.webp` | 2 | 512 × 343 | Pass | Pass | Pass | Pass |
| `statue.webp` | 3 | 768 × 652 | Pass | Pass | Pass | Pass |
| `plaza.webp` | 2 | 512 × 317 | Pass | Pass | Pass | Pass |
| `tradingPost.webp` | 3 | 768 × 545 | Pass | Pass | Pass | Pass |
| `hall.webp` | 3 | 768 × 660 | Pass | Pass | Pass | Pass |
| `rubble.webp` | 1 | 256 × 179 | Pass | Pass | Pass | Pass |
