# Pawhaven painted building sprites

Date: 27-10-2026

52 isolated building, scenery and moving-part sprites for the Canvas 2D scene's 64 × 32 px (2:1) tile grid. Assets are prepared here; renderer integration is a separate change.

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
| `dustMill.webp` | 2 | 512 × 438 | Pass | Pass | Pass | Pass |
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

## Animation anchors — 27-10-2026

`public/art/pawhaven/sprites/anchors.json` covers all 52 WebP sprites, including empty objects when no requested feature is visible. Coordinates are in each exported image's own pixels, with x right and y down from the top-left. `smoke`, `flags` and `glow` contain point lists; `hub`, `spout` and `fountain` contain a single point; `sails` is the intended rendered diameter; `water` is `[cx, cy, rx, ry]`. Door windows are included in `glow`. The lavender dust in the bathhouse and mill is not water. Hanging fabric and tent garlands without dedicated flagpoles are not flag anchors.

Every existing sprite was inspected on a temporary red-dot copy under `/tmp/pawhaven-followup/`, including the featureless sprites. Water ellipses were checked with dots at their centre and four extrema. Missed window centres and water extents were corrected and inspected again. Debug copies are outside the repository. The mill hub and window anchors were rechecked after its repaint; its rendered sail diameter is 300 px. New home anchors were verified on temporary red-dot copies, and featureless scenery and the rotating part have empty entries. All pre-existing entries other than the repainted mill were retained.

## Follow-up paintings — 27-10-2026 (completed)

All requested follow-up paintings are saved. Generation used only the built-in image tool, one image at a time, in this order: sail-free mill, separate sails, home-3b, home-5b, home-7b, home-2b, home-4b, home-6b, the six scenery sprites in table order, then home-2c through home-7c. Each accepted export was saved before the next generation. No API key or CLI/API fallback was used.

The mill succeeded on this run's third attempt after two timeouts; the separate sails succeeded on the fifth attempt after four timeouts. Every timeout was followed by a one-minute wait before retrying. All home and scenery calls succeeded on their first attempt. Earlier work had also recorded two mill timeouts before this follow-up run.

The subjects below reuse the shared prompt verbatim, substituting the chroma shown and appending `Footprint 1 by 1 tiles.`. The garden image remained the style-only reference. Grounded variants use the documented chroma extraction and export; the mill edit and separate sails retain generated alpha, then are resampled for export.

| Sprite | Chroma | Subject prompt |
| --- | --- | --- |
| `home-2b` | `#ff00ff` | Twig Hut: a small hut of woven twigs with a russet thatched cone roof, round teal door, white daisies, small wicker basket. Same modest size and grandeur as home-2. |
| `home-2c` | `#ff00ff` | Twig Hut: a small hut of woven twigs with a pale oatmeal thatched cone roof, arched plum door, yellow flowers, clay jug. Same modest size and grandeur as home-2. |
| `home-3b` | `#ff00ff` | Snug Burrow: a grassy hillock burrow with a round teal wooden door, little round window, clover roof and terracotta chimney on the left rear, white flowers and watering can. |
| `home-3c` | `#ff00ff` | Snug Burrow: a grassy hillock burrow with a round burgundy wooden door, little round window, golden-green moss roof, squat stone chimney on the right rear, blue flowers and mushroom garden. |
| `home-4b` | `#ff00ff` | Dusty Burrow: a larger snug burrow with a tiny tray of pale dust-bath sand beside an arched blue door, sage moss roof, left brick chimney, yellow flower pots and little bench. |
| `home-4c` | `#ff00ff` | Dusty Burrow: a larger snug burrow with a tiny tray of pale dust-bath sand beside a round red door, golden grassy roof, right stone chimney, white daisies and wooden bucket. |
| `home-5b` | `#00ff00` | Cosy Burrow: a cottage burrow with a stone chimney on the right, mauve flower-covered turf roof, round teal door, a flower box and a clay pot by the door, tiny basket. |
| `home-5c` | `#ff00ff` | Cosy Burrow: a cottage burrow with a brick chimney on the left, amber moss roof, arched burgundy door, a flower box of white daisies and a blue clay pot by the door. |
| `home-6b` | `#00ff00` | Fine Burrow: a two-storey burrow cottage with a round plum door, sage and lavender flowered turf roof, right stone chimney, flower boxes and a small wooden toy cart on the step. Same two storeys and grandeur as home-6. |
| `home-6c` | `#ff00ff` | Fine Burrow: a two-storey burrow cottage with an arched forest-green door, golden moss roof, left brick chimney, red geranium flower boxes and a small wooden toy duck on the step. Same two storeys and grandeur as home-6. |
| `home-7b` | `#00ff00` | Grand Burrow: a grand hillside burrow manor with an arched blue door, lantern, soft pink bedding airing on a line, white flowers, right brick chimney, golden-green turf roof and tiny plain lavender pennant. |
| `home-7c` | `#00ff00` | Grand Burrow: a grand hillside burrow manor with an arched burgundy door, lantern, soft cream bedding airing on a line, lavender flowers, left stone chimney, bright moss roof and tiny plain gold pennant. |
| `decor-tree-1` | `#ff00ff` | One round leafy tree with a chunky warm brown branching trunk, bright apple-green rounded foliage, a few tiny daisies around its base. |
| `decor-tree-2` | `#ff00ff` | One round leafy tree with a short twisting brown trunk, broad deep sage and golden-green rounded foliage, small clover and stones at its base. |
| `decor-pine` | `#ff00ff` | One friendly rounded pine tree, layered chunky blue-green evergreen boughs, short brown trunk, a few pinecones at its base. |
| `decor-bush-flowers` | `#ff00ff` | One rounded leafy flowering bush, abundant white daisies and yellow and coral blossoms, small clover around its base. |
| `decor-rocks` | `#ff00ff` | A compact cluster of three rounded warm grey garden rocks, moss and tiny white daisies between them. |
| `decor-mushrooms` | `#ff00ff` | A compact cluster of three chunky red and cream spotted mushrooms of different heights, with clover around their feet. |

Accepted mill edit prompt (third attempt of this run; original mill supplied as edit target, transparent output requested):

```text
Edit this image: remove the windmill's four lavender sails and their wooden radial arms, leaving a small round wooden hub on the roof. Restore roof and wall behind the removed sails. Keep the same painting, colours, isometric building, base and transparency. No text.
```

The first mill retry prepended `Use case: precise-object-edit.` to the earlier edit prompt below; the second used it verbatim. Both timed out:

```text
Remove all four sails and radial arms from this windmill. Keep only a small round wooden hub cap where they attached. Repaint the revealed purple roof and cream wall. Preserve everything else exactly, including footprint and transparent background. No text.
```

Accepted separate-part prompt (fifth attempt; transparent output requested):

```text
Use case: illustration-story. Paint part-sails.webp for Pawhaven: four lavender-and-cream windmill sails alone, with warm wooden frames and a small wooden hub, matching the original dustMill sails exactly in warm hand-painted toon storybook style, soft cel shading, fine brown ink edges and warm upper-left light. Face-on, four sails evenly spaced in an X around the hub at the exact image centre. Square transparent 512 by 512 image, complete sail tips inside the frame, no building, ground, shadow, text, letters, logos or watermark.
```

The timed-out sails calls used this same subject and constraints with shorter wording on attempts 1, 2 and 4; attempt 3 used the accepted prompt verbatim. No timed-out call returned an image.

The separate rotating part is face-on and has no ground footprint. Its reopened WebP passes RGBA, transparent top corners, 512 × 512 size, visually centred hub, intact tips and no-writing checks. The opaque bottom-centre ground check applies only to grounded sprites. All new grounded exports pass RGBA, exact width, transparent top corners, opaque bottom centre and visual no-writing checks. Red-dot inspection copies are under `/tmp/pawhaven-followup/`, outside the repository.

### Follow-up export validation

| Sprite | Export (px) | RGBA / width / transparent corners | Opaque bottom centre | Visual / anchors |
| --- | --- | --- | --- | --- |
| `dustMill.webp` | 512 × 438 | Pass | Pass | Pass |
| `part-sails.webp` | 512 × 512 | Pass | N/A (floating part) | Pass |
| `home-3b.webp` | 256 × 167 | Pass | Pass | Pass |
| `home-5b.webp` | 256 × 202 | Pass | Pass | Pass |
| `home-7b.webp` | 256 × 193 | Pass | Pass | Pass |
| `home-2b.webp` | 256 × 265 | Pass | Pass | Pass |
| `home-4b.webp` | 256 × 180 | Pass | Pass | Pass |
| `home-6b.webp` | 256 × 218 | Pass | Pass | Pass |
| `decor-tree-1.webp` | 256 × 279 | Pass | Pass | Pass |
| `decor-tree-2.webp` | 256 × 282 | Pass | Pass | Pass |
| `decor-pine.webp` | 256 × 350 | Pass | Pass | Pass |
| `decor-bush-flowers.webp` | 256 × 188 | Pass | Pass | Pass |
| `decor-rocks.webp` | 256 × 169 | Pass | Pass | Pass |
| `decor-mushrooms.webp` | 256 × 223 | Pass | Pass | Pass |
| `home-2c.webp` | 256 × 254 | Pass | Pass | Pass |
| `home-3c.webp` | 256 × 157 | Pass | Pass | Pass |
| `home-4c.webp` | 256 × 178 | Pass | Pass | Pass |
| `home-5c.webp` | 256 × 228 | Pass | Pass | Pass |
| `home-6c.webp` | 256 × 238 | Pass | Pass | Pass |
| `home-7c.webp` | 256 × 188 | Pass | Pass | Pass |
