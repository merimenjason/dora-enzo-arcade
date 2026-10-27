# Dust Bunny Dungeon art brief

Date: 27-10-2026

Every painting the game loads, all from `public/art/dungeon/` as WebP (quality about 82). None exist yet: the game draws each one itself in Canvas 2D until its painting loads, so they can be added one at a time and nothing else needs to change. The list of names is `ART` in `lib/dungeon-scene.ts`; the menu also uses `title`, `player-<dora|enzo>`, `enemy-<kind>` and `tool-<tool>` in `app/dungeon/page.tsx`.

## Style for every image

Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy cellar colours. **Dora** is a cream-white chinchilla with pink ears and ruby eyes; **Enzo** is a grey chinchilla with a pale chest and black eyes. The dust bunnies are round, fluffy, grumpy-cute balls of grey dust with stubby ears and little eyes: mischievous, never scary, no teeth or claws. No text, letters, numbers, logos, frames or UI in any image.

**Sprites** (everything except `title` and `floor-*`) are seen from a slight top-down three-quarter view, on a **transparent** background, centred, filling the square with the feet (or base) about 5% above the bottom edge, with a soft painted contact shadow left out (the game draws its own shadow). They are drawn about 40–60 px on screen, so keep silhouettes bold and readable and details chunky.

## Images

| # | Path | Size | Background | Description |
| --- | --- | --- | --- | --- |
| 1 | `title.webp` | 1600×900 | opaque | Menu banner, shown cropped to a wide strip (focus 50% across, 35% down; the bottom-left third is darkened for the title text, so keep it calm). Dora with a little broom and Enzo with a feather duster at the top of a lantern-lit burrow cellar stair, peering down at a tumble of grey dust bunnies bouncing up the steps; jam jars and roots on the walls, warm lantern glow against cool deep shadow. |
| 2 | `floor-0.webp` | 512×512 | opaque | Root Cellar floor texture, cut by the game into a 4 × 4 grid of 128 px tiles, so it must tile seamlessly in both directions and each 128 px cell should read as one floor square. Packed warm brown earth with tiny pebbles, root threads and soft dust; low contrast so marks drawn on top stay readable. |
| 3 | `floor-1.webp` | 512×512 | opaque | Pantry Tunnels floor, same 4 × 4 seamless tiling. Honey-brown wooden planks with a few oat flakes and crumbs; low contrast. |
| 4 | `floor-2.webp` | 512×512 | opaque | Old Mine floor, same 4 × 4 seamless tiling. Cool blue-grey flagstones with mossy grout and a little coal dust; low contrast. |
| 5 | `player-dora.webp` | 512×512 | transparent | Dora standing ready, facing **right** (the game mirrors her to face left), holding a small straw broom, a tiny tidy kerchief on her head; cream-white fur, pink ears, ruby eyes. |
| 6 | `player-enzo.webp` | 512×512 | transparent | Enzo in the same pose and size, facing **right**, holding a feather duster, a little scarf; grey fur, pale chest, black eyes. |
| 7 | `enemy-fluff.webp` | 512×512 | transparent | Dust Bunny: a small round puff of grey dust with stubby ears and a grumpy pout. |
| 8 | `enemy-hopper.webp` | 512×512 | transparent | Hop Bunny: a pale dusty bunny with long springy ears and pink-lined ears, mid-hop, cheeky grin. |
| 9 | `enemy-roller.webp` | 512×512 | transparent | Tumble Fluff: a tan tumbleweed-like ball of dust and twigs curled up to roll, two eyes peeking out. |
| 10 | `enemy-puffer.webp` | 512×512 | transparent | Puff Bunny: a rosy-pink dust bunny with puffed-out cheeks about to blow a little dust cloud. |
| 11 | `enemy-sneezer.webp` | 512×512 | transparent | Sneezy Bunny: a straw-yellow dust bunny with a pink twitchy nose, eyes squeezed shut mid “ah-choo”. |
| 12 | `enemy-mimic.webp` | 512×512 | transparent | Bale Mimic awake: a golden hay bale with stubby feet, two eyes and a sly smile, wisps of straw sticking out. |
| 13 | `enemy-burrower.webp` | 512×512 | transparent | Burrow Bunny: a brown earthy dust bunny wearing a tiny miner's helmet, popping half out of a hole of loose soil. |
| 14 | `enemy-bigbun.webp` | 512×512 | transparent | Great Dust Bunny (boss, drawn larger): an enormous, very fluffy grey dust bunny with pink inner ears, small grumpy eyes, a few little dust bunnies clinging to its fluff. |
| 15 | `enemy-foreman.webp` | 512×512 | transparent | Mole Foreman (boss): a stout dusty brown mole in a yellow hard hat and work apron, holding a small shovel and a whistle, gruff but comic. |
| 16 | `enemy-king.webp` | 512×512 | transparent | Dust King (boss): a large lavender-grey dust bunny with a tiny gold crown and a dusty velvet cape, holding a feather-duster sceptre, haughty pout. |
| 17 | `bale.webp` | 512×512 | transparent | A plain golden hay bale tied with twine, no face (a Bale Mimic in disguise looks exactly like this). |
| 18 | `crate.webp` | 512×560 | transparent | A small wooden crate with rope handles, a little dusty; drawn slightly taller than a tile so its top shows. |
| 19 | `chest.webp` | 512×540 | transparent | A small round-lidded treasure chest with brass corners and a keyhole, closed. |
| 20 | `stairs.webp` | 512×512 | opaque | Stairs down, seen from above: a square opening in the floor with wooden steps going down into warm lantern light; fills the whole tile. |
| 21 | `prickles.webp` | 512×560 | transparent | A raised prickle trap: four little clumps of green thistle spikes with pink thistle flowers on a square of earth; slightly taller than a tile. |
| 22 | `switch.webp` | 512×512 | transparent | A floor lever on a wooden base, the handle leaning to the **right** with a coral-red knob (the game mirrors it when the traps are down). |
| 23 | `bellows.webp` | 512×512 | transparent | A round leather bellows plate set into the floor, seen from above, with brass rim and four little air vents pointing out. |
| 24 | `key.webp` | 256×256 | transparent | A small brass key with a heart-shaped bow. |
| 25 | `heart.webp` | 256×256 | transparent | A heart charm: a soft pink felt heart stitched with cream thread. |
| 26 | `tool-duster.webp` | 256×256 | transparent | A feather duster with a wooden handle and soft cream and brown feathers. |
| 27 | `tool-sling.webp` | 256×256 | transparent | A little wooden slingshot with a smooth grey pebble in its pouch. |
| 28 | `tool-soap.webp` | 256×256 | transparent | A small bottle of bubble soap with a wand and three iridescent bubbles. |
| 29 | `tool-lantern.webp` | 256×256 | transparent | A small brass lantern glowing warm orange. |
| 30 | `tool-acorn.webp` | 256×256 | transparent | A plump glossy acorn with its cap, one bite-sized nibble taken out. |

The tool and enemy sprites also appear as icons in the HUD tool bar (30 px) and the bestiary (48 px), so they must read at that size.


## Painted (28-10-2026)
Completed all 30 listed assets using only the built-in image generation tool. Painted 23 missing images; retained the six good existing paintings unchanged and retained/refitted the existing key. No paid CLI/API fallback was used.
Character references: `public/art/disco/dancer-dora-idle.webp` and `public/art/disco/dancer-enzo-idle.webp`. Painting-style references: `public/art/disco/venue-burrow.webp` and `public/art/pebble/place-meadow.webp`. Each new non-banner image used both painting-style images as attached references; the plain bale also used the generated awake mimic as an attached reference. The final banner used the two character images as attached references. The earlier banner attempts attached all four references.
Processed one image at a time with Pillow and numpy. Transparent sprites were generated on green chroma backgrounds (magenta for green thistles), keyed with a noise-tolerant matte, unmixed at soft edges, despilled, cropped to the subject and Lanczos-fitted without stretching, centred horizontally with the base about 5% above the bottom. Opaque paintings were fitted with `ImageOps.fit` and Lanczos. New assets and the refitted key were saved as WebP quality 88, method 6. The six unchanged existing assets retain their original encoding; their original encoder quality setting is unavailable, so their decoded visual quality was inspected rather than inventing a quality value.
Validation: reopened and fully decoded every WebP; asserted every exact size and RGB/RGBA mode against the brief, and both fully transparent and opaque pixels for each RGBA asset. Viewed every sprite over mid-dark `#414047`, including 60 px, 48 px and 30 px previews; checked silhouettes, colours, no text and no visible chroma fringe. Inspected each floor as a 2×2 repeat; opposite-edge mean RGB differences were 2.1–3.2/255, lower than ordinary neighbouring-pixel differences. Checked the banner at full size and as a wide-strip crop focused at (50%, 35%).
### Validation table

| File | Size | Mode | Notes |
| --- | --- | --- | --- |
| `title.webp` | 1600×900 | RGB | Painted; opaque full bleed; checked wide strip at focal position (50%, 35%); Dora ruby eyes and Enzo black eyes match references. |
| `floor-0.webp` | 512×512 | RGB | Kept existing painting; packed earth, roots and pebbles; low contrast; 2×2 repeat visually seamless. |
| `floor-1.webp` | 512×512 | RGB | Kept existing painting; honey-brown planks and crumbs; low contrast; 2×2 repeat visually seamless. |
| `floor-2.webp` | 512×512 | RGB | Kept existing painting; cool flagstones and mossy grout; low contrast; 2×2 repeat visually seamless. |
| `player-dora.webp` | 512×512 | RGBA | Kept existing painting; right-facing; cream-white, pink ears, ruby eyes, kerchief and broom; clean edges. |
| `player-enzo.webp` | 512×512 | RGBA | Kept existing painting; right-facing; grey back, pale chest, pink ears, black eyes, scarf and duster; clean edges. |
| `enemy-fluff.webp` | 512×512 | RGBA | Kept existing painting; round grey puff, stubby ears, grumpy pout; clean edges. |
| `enemy-hopper.webp` | 512×512 | RGBA | Painted; pale dust bunny, long pink-lined springy ears, mid-hop grin. |
| `enemy-roller.webp` | 512×512 | RGBA | Painted; tan rolling dust-and-twig ball; two eyes visible through the twigs. |
| `enemy-puffer.webp` | 512×512 | RGBA | Painted; rosy pink, puffed cheeks and small dust cloud. |
| `enemy-sneezer.webp` | 512×512 | RGBA | Painted; straw yellow, pink nose, eyes squeezed shut in a sneeze. |
| `enemy-mimic.webp` | 512×512 | RGBA | Painted; golden twine-bound hay bale, stubby feet, eyes and sly smile. |
| `enemy-burrower.webp` | 512×512 | RGBA | Painted; brown bunny, miner helmet, half out of contained loose-soil hole. |
| `enemy-bigbun.webp` | 512×512 | RGBA | Painted; large fluffy grey boss, pink ears, small grumpy eyes and clinging baby dust bunnies. |
| `enemy-foreman.webp` | 512×512 | RGBA | Painted; stout brown mole, yellow hard hat, apron, shovel and whistle. |
| `enemy-king.webp` | 512×512 | RGBA | Painted; lavender-grey boss, crown, velvet cape, duster sceptre and haughty pout. |
| `bale.webp` | 512×512 | RGBA | Painted using awake mimic as an extra reference; matching golden hay and twine; no face or feet. |
| `crate.webp` | 512×560 | RGBA | Painted; rope handles and visible top; taller canvas retained. |
| `chest.webp` | 512×540 | RGBA | Painted; closed round lid, brass corners and clear keyhole; taller canvas retained. |
| `stairs.webp` | 512×512 | RGB | Painted; opaque full-tile square opening, descending wooden steps and warm lantern light. |
| `prickles.webp` | 512×560 | RGBA | Painted on magenta; four green thistle clumps with pink flowers on square earth; green foliage preserved. |
| `switch.webp` | 512×512 | RGBA | Painted; coral-red knob visibly right of pivot; handle leans right. |
| `bellows.webp` | 512×512 | RGBA | Painted; overhead round leather plate, brass rim, four outward vents. |
| `key.webp` | 256×256 | RGBA | Kept existing painting; cropped and refitted to correct undersized, off-centre placement; heart-shaped brass bow. |
| `heart.webp` | 256×256 | RGBA | Painted; soft pink felt heart with chunky cream stitching. |
| `tool-duster.webp` | 256×256 | RGBA | Painted; wooden handle, cream and brown feathers; clear at 30 px. |
| `tool-sling.webp` | 256×256 | RGBA | Painted; wooden Y fork and grey pebble visibly seated in leather pouch; clear at 30 px. |
| `tool-soap.webp` | 256×256 | RGBA | Painted; unlabelled soap bottle, wand and three floating iridescent bubbles; clear at 30 px. |
| `tool-lantern.webp` | 256×256 | RGBA | Painted; brass lantern with contained warm orange glow; clear at 30 px. |
| `tool-acorn.webp` | 256×256 | RGBA | Painted; glossy capped acorn with one visible bite-sized nibble; clear at 30 px. |

### Exact generation prompts
The following are the exact prompt strings submitted in this run. Identical timeout retries reused the same string. Three initial banner attempts timed out with no output; the shorter final banner prompt succeeded with the two character references. The first lever, slingshot and soap attempts also timed out without output; each identical retry succeeded. No delivered painting required regeneration after visual review.
The seven inherited paintings were not regenerated. Their original generation prompts were not present in this brief or available from the interrupted run, so they are not reconstructed or represented as known prompts here. The key received only the crop/refit described above.

#### `title.webp` — initial prompt (timed out)

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. Paint a wide 16:9 menu banner for Dust Bunny Dungeon, final 1600×900. Match Dora and Enzo exactly to reference characters: Dora cream-white chinchilla, pink ears, ruby eyes; Enzo cool mid-grey chinchilla, darker back, pale chest, pink ears, solid black eyes with white glints. Dora with little broom and Enzo with feather duster at the top of a lantern-lit burrow cellar stair, peering down at a tumble of grey dust bunnies bouncing up the steps. Jam jars and roots on walls, warm lantern glow against cool deep shadow. Keep focal characters near 50% across and 35% down so they survive a wide-strip crop. Bottom-left third calm and dark, uncluttered. Opaque scene filling image edge to edge. References 1 and 2 character identities, 3 and 4 painting style.
```

#### `title.webp`

```text
Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy kind burrow-cellar painting. Wide 16:9 banner, no text, letters, numbers, logos, frames or UI. Use the attached images as exact character references. Dora is cream-white with pink ears and ruby eyes; Enzo is cool mid-grey with darker back, pale chest, pink ears and solid black eyes with white glints. Dora with a little broom and Enzo with a feather duster stand at the top of a lantern-lit cellar stair, peering down at grey dust bunnies bouncing up the steps. Jam jars and roots on walls, warm lantern glow against cool deep shadow. Characters centred near 50% across, 35% down for a wide-strip crop. Keep bottom-left third calm and dark. Opaque edge-to-edge scene for title.webp, final 1600×900.
```

#### `enemy-hopper.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. Reference images supply painting style only. Paint Hop Bunny: a pale dusty bunny with long springy ears and pink-lined ears, mid-hop, cheeky closed-mouth grin. A round fluffy ball of pale grey dust, mischievous never scary, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-hopper.webp, 512×512.
```

#### `enemy-roller.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Tumble Fluff: a tan tumbleweed-like ball of dust and twigs curled up to roll, two little eyes peeking out. Round, fluffy, mischievous, never scary, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-roller.webp, 512×512.
```

#### `enemy-puffer.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Puff Bunny: a rosy-pink round fluffy dust bunny with stubby ears, puffed-out cheeks about to blow a little dust cloud. Little mischievous eyes, comically pursed mouth. Cute never scary, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-puffer.webp, 512×512.
```

#### `enemy-sneezer.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Sneezy Bunny: a straw-yellow round fluffy dust bunny with stubby ears, a pink twitchy nose, eyes squeezed shut mid sneeze, an expressive ah-choo pose without any lettering. Cute and comic, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-sneezer.webp, 512×512.
```

#### `enemy-mimic.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Bale Mimic awake: a golden rectangular hay bale tied with plain twine, stubby feet, two little eyes and a sly closed-mouth smile, wisps of straw sticking out. A cute comic living bale, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-mimic.webp, 512×512.
```

#### `enemy-burrower.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Burrow Bunny: a brown earthy round fluffy dust bunny with stubby ears wearing a tiny miner's helmet, popping half out of a hole of loose soil. Little grumpy-cute eyes and pout, mischievous never scary, no teeth or claws. Keep the hole and soil contained as part of the isolated sprite. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-burrower.webp, 512×512.
```

#### `enemy-bigbun.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Great Dust Bunny boss: an enormous very fluffy round grey dust bunny, stubby ears with pink inner ears, small grumpy eyes and pout. A few tiny little grey dust bunnies cling to its voluminous fluff. Massive rounded silhouette, mischievous and cuddly never scary, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-bigbun.webp, 512×512.
```

#### `enemy-foreman.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Mole Foreman boss: a stout dusty brown mole in a yellow hard hat and work apron, holding a small shovel in one paw and a whistle in the other, gruff but comic. Rounded friendly silhouette, little eyes, broad mole nose, no threatening claws or teeth. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-foreman.webp, 512×512.
```

#### `enemy-king.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint Dust King boss: a large lavender-grey round fluffy dust bunny with stubby ears, a tiny gold crown and a dusty velvet cape, holding a feather-duster sceptre, haughty little pout and small eyes. Regal but comic, mischievous never scary, no teeth or claws. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset enemy-king.webp, 512×512.
```

#### `bale.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. Paint a plain golden rectangular hay bale tied with twine, wisps of straw sticking out, NO face, NO eyes, NO limbs or feet. Match the supplied awake Bale Mimic reference's bale shape, warm straw colours and twine arrangement, but this is an ordinary inanimate bale in disguise. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset bale.webp, 512×512.
```

#### `crate.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a small wooden crate with rope handles, a little dusty; drawn slightly taller than a floor tile so its top shows. Simple chunky wooden planks and a visible top, no labels or markings. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset crate.webp, 512×560, slightly taller canvas.
```

#### `chest.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a small closed treasure chest with a round lid, brass corners and a clear keyhole. Warm brown wood and softly worn brass, simple chunky silhouette, visible top. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset chest.webp, 512×540, slightly taller canvas.
```

#### `stairs.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint stairs down seen from above: a square opening in a burrow cellar floor with wooden steps going down into warm lantern light. Opaque 512×512 game floor tile, opening and its earthy rim fill the entire tile edge to edge. Top-down square layout, no isometric diamond, no white or blank margin, no UI border. Clear depth from descending wooden steps, cosy amber light below, packed brown earth around the square rim.
```

#### `prickles.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a raised prickle trap: exactly four little clumps of green thistle spikes with pink thistle flowers, arranged on one square of earth. Slightly taller than a tile, readable chunky plant silhouettes, friendly storybook garden hazard. Single isolated game sprite, slight top-down three-quarter view, centre complete square of earth and all four clumps; base about 5% above bottom, no contact shadow. Perfectly flat uniform pure magenta #ff00ff chroma background because the subject is green; no magenta reflected light. No other objects. Final asset prickles.webp, 512×560.
```

#### `switch.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a floor lever on a wooden base, handle leaning to the RIGHT, with a coral-red knob. Pivot on the left/lower part and knob unmistakably to the right of pivot. Simple chunky old cellar mechanism, one isolated lever and base. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset switch.webp, 512×512.
```

#### `bellows.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a round leather bellows plate set into the floor, seen from above, with a brass rim and exactly four little air vents pointing out in four directions. Isolated circular brown leather floor mechanism with short radial vents, no surrounding floor. Bold chunky parts. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Use a mostly overhead view as this is a floor plate. Final asset bellows.webp, 512×512.
```

#### `heart.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. Reference images supply painting style only. Paint one soft pink felt heart charm stitched with cream thread. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset heart.webp, 256×256.
```

#### `tool-duster.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a feather duster with a wooden handle and soft cream and brown feathers. One simple chunky cleaning tool, diagonally arranged so the entire handle and feather tuft read clearly at 30px. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset tool-duster.webp, 256×256.
```

#### `tool-sling.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a little wooden slingshot with a smooth grey pebble in its leather pouch. Clear Y-shaped wooden fork, short elastic bands and one visible round grey pebble seated in the pouch between the prongs. Simple bold toy-like silhouette readable at 30px. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset tool-sling.webp, 256×256.
```

#### `tool-soap.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a small bottle of bubble soap with a bubble wand and exactly three iridescent bubbles. Simple short rounded bottle, no label or lettering, wand beside it and three chunky bubbles clustered closely so the icon stays readable at 30px. Keep bubbles with clear painted pearl-white and pale blue/pink rims and filled pearly translucent-looking centres, no green colour within them. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset tool-soap.webp, 256×256.
```

#### `tool-lantern.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a small brass lantern glowing warm orange. Compact rounded glass enclosure with a clear warm orange flame inside, sturdy brass cap, base and little carry loop; bold simple silhouette readable at 30px. Keep the glow inside the lantern, no surrounding halo or shadow. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset tool-lantern.webp, 256×256.
```

#### `tool-acorn.webp`

```text
Warm hand-painted toon storybook matching the supplied reference images, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos, frames or UI. References supply painting style only. Paint a plump glossy acorn with its textured cap, one bite-sized nibble taken out of the side revealing pale inner nut. Make the single missing bite clearly visible in the outline at 30px. Warm chestnut brown body, golden-brown cap and short stem, simple chunky shape. Single isolated game sprite, slight top-down three-quarter view, bold chunky silhouette readable at 40–60px and 30px icon size. Centre the entire subject with generous narrow margin, base about 5% above bottom, no floor or contact shadow. Perfectly flat uniform pure green #00ff00 background, no green reflected light or green elements on subject. Final asset tool-acorn.webp, 256×256.
```
