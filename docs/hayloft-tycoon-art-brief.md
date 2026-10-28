# Hayloft Tycoon · art brief

Every painted image Hayloft Tycoon (`/hayloft`) loads. Until a file exists (or if it never loads) the scene draws its own Canvas stand-in, so these can arrive in any order. Written 28-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and bright. No text, letters, numbers or logos anywhere in the images. **Dora** is a cream-white chinchilla with pink ears and ruby-red eyes; **Enzo** is a grey chinchilla with a pale chest and black eyes. Both have big round ears, long whiskers and fluffy tails. Export as `.webp` (quality about 85).

All files live in `public/art/hayloft/`.

## Valley backdrops (5, opaque)

Wide panoramas the valley scrolls across, with slow parallax. **2400 × 900 px, not transparent.** The bottom quarter is a soft, fairly flat ground band in the valley's colour (the buildings stand on a line about 78% of the way down), so keep it free of big objects. No buildings and no animals: the game draws those on top. Leave the top third calm sky for visitors to fly through.

| File | Description |
| --- | --- |
| `valley-meadowvale.webp` | Meadowvale, the home valley: rolling green hills, a gentle river far away, wildflowers, puffy clouds, a warm morning sky from pale blue to soft cream. |
| `valley-snowdrift.webp` | Snowdrift Valley: snowy hills and frosted pines, smoke curling from distant chimneys, pale lavender-blue winter sky, soft snow on the ground band. |
| `valley-cove.webp` | Pebble Cove: a seaside bay with smooth round pebbles, a turquoise sea and gentle waves on the left and right horizon, a sandy ground band, a peachy afternoon sky. |
| `valley-glowcap.webp` | Glowcap Hollow: a twilight mushroom forest, giant soft glowing mushrooms in pink, teal and gold in the background, fireflies, a purple-to-rose dusk sky, mossy ground band. |
| `valley-cloudreach.webp` | Cloudreach Isles: floating grassy islands with little waterfalls drifting among pink and gold clouds, a bright sky; the ground band is a big grassy island top. |

## Helpers (10, transparent)

The chinchilla who runs each building stands beside it, small, so each needs to read at about 60 px tall. **256 × 256 px, transparent background.** One chinchilla, full body, sitting upright in three-quarter view **facing left**, centred with its feet on the bottom edge, filling most of the frame. Big round ears with pink insides, long whiskers, fluffy tail, solid black eyes, the fur colour below, and one small prop. Same painted style as `dora.webp`. Dora runs the meadow and Enzo the Dust Bath Spa; they use `dora.webp` and `enzo.webp`.

| File | Helper | Coat | Prop |
| --- | --- | --- | --- |
| `helper-pebble.webp` | Pebble | fur #6d6862 (dark charcoal grey) | a small round pebble held in its front paws |
| `helper-juniper.webp` | Juniper | fur #e8d2b0 (warm sandy beige) | a sprig of juniper tucked behind one ear |
| `helper-tuft.webp` | Tuft | fur #fbf4ea (cream-white with an extra fluffy tuft on its head) | a little cushion hugged to its chest |
| `helper-biscuit.webp` | Biscuit | fur #b3a89a (light grey-beige) | a small round biscuit in its paws |
| `helper-lumen.webp` | Lumen | fur #f6ead8 (pale cream) | a tiny glowing lantern |
| `helper-nova.webp` | Nova | fur #4f4b48 (very dark ebony grey with a pale chest) | a small brass telescope |
| `helper-breeze.webp` | Breeze | fur #efe2d0 (light oat beige) | a tiny paper pinwheel |
| `helper-sage.webp` | Sage | fur #c9c2bb (silver grey) | a small cup of green tea with steam |
| `helper-chime.webp` | Chime | fur #fdf6ee (snow white) | a tiny silver bell on a ribbon round its neck |
| `helper-captain-wisp.webp` | Captain Wisp | fur #8a847d (mid grey with a pale chest) | a little sky-captain hat and goggles |

## Buildings (12, transparent)

One per building in the production chain, front three-quarter view, each a cosy little chinchilla-sized structure. **512 × 512 px, transparent background.** The building sits centred with its base resting on the bottom edge (about 16 px of soft shadow below is fine). Similar scale across all twelve; later buildings may be a little grander. No chinchillas in these (the game draws helpers beside them).

| File | Building | Description |
| --- | --- | --- |
| `building-meadow.webp` | Hay Meadow | A small wooden hay shed with an open front, golden bales stacked inside and a patch of tall timothy grass beside it, a little scythe leaning on the wall. |
| `building-spa.webp` | Dust Bath Spa | A round sandstone bathhouse with a domed roof, a big shallow bowl of fine volcanic dust inside the doorway, a towel rack and a puff of dust in the air. |
| `building-pebble.webp` | Pebble Polishery | A stone workshop with a water wheel turning a tumbling barrel, baskets of shiny smooth pebbles in grey, blue and pink out front. |
| `building-orchard.webp` | Apple-Twig Orchard | Two little apple trees in blossom and fruit, with a twig-drying rack and a wooden crate of neat apple-twig bundles. |
| `building-cushion.webp` | Cozy Cushion Mill | A cottage mill with a soft fabric windmill, plump pastel cushions piled by the door, a spool of yarn. |
| `building-bakery.webp` | Hay Biscuit Bakery | A half-timbered bakery with a round brick oven glowing orange, a tray of golden hay biscuits on the sill, a striped awning. |
| `building-lantern.webp` | Glimmer Lantern Works | A workshop with a glass roof, many small paper and glass lanterns hanging outside glowing warm yellow. |
| `building-observatory.webp` | Moonlight Observatory | A small round stone tower with a silver dome open to a brass telescope, a crescent-moon weathervane. |
| `building-balloon.webp` | Cloudhopper Balloon Port | A wooden landing platform with a patchwork hot-air balloon tethered above it and a wicker basket. |
| `building-tea.webp` | Starleaf Tea Garden | A terraced tea garden with a little pagoda-roofed tea house, rows of round green tea bushes and a steaming teapot. |
| `building-bells.webp` | Aurora Bell Tower | A slender bell tower with a row of silver bells, faint ribbons of aurora colour (green, violet, pink) shimmering off the bells. |
| `building-skyship.webp` | Comet Skyship Dock | A tall wooden dock with a small airship moored to it: a cosy hull, hay-coloured sails, a comet-tail pennant, ropes and a gangplank. |

## Dora and Enzo (4, transparent)

They stand at the front of the valley; tapping them is the main tap. **512 × 512 px, transparent**, standing on the bottom edge, three-quarter view, roughly 80% of the frame tall, each facing slightly towards the centre (Dora faces right, Enzo faces left).

| File | Description |
| --- | --- |
| `dora.webp` | Dora standing on her hind legs holding a small bundle of hay, gentle smile, ears up. |
| `dora-cheer.webp` | Dora mid-hop with both front paws up, delighted, a few tufts of fluff floating around her. |
| `enzo.webp` | Enzo standing holding a little wooden clipboard, calm happy look. |
| `enzo-cheer.webp` | Enzo mid-hop with paws up and his clipboard tossed in the air, a few tufts of fluff floating. |

## Visitors (5, transparent)

They drift across the sky; the player taps them. **256 × 256 px, transparent**, facing right (the game flips them), centred.

| File | Description |
| --- | --- |
| `visitor-acorn.webp` | A tiny emerald hummingbird carrying a shining golden acorn, sparkles around the acorn. |
| `visitor-pedlar.webp` | A friendly viscacha pedlar riding a little dandelion-seed parachute, with a bulging coin sack. |
| `visitor-owl.webp` | A round little owl scholar with round spectacles, flying with a rolled blueprint in its talons. |
| `visitor-bat.webp` | A small fluffy fruit bat, smiling, holding a glowing orange sunberry. |
| `visitor-breeze.webp` | A swirl of soft wind carrying puffs of chinchilla fluff and a few flower petals, with a happy face in the swirl. |

## Twig Shower (2, transparent)

The falling pieces in the catch-the-twigs minigame. **128 × 128 px, transparent**, diagonal from lower left to upper right, centred.

| File | Description |
| --- | --- |
| `twig.webp` | A short apple twig with two small green leaves. |
| `twig-gold.webp` | The same twig glowing gold with tiny sparkles. |

## Title (1, opaque)

| File | Description |
| --- | --- |
| `title.webp` | **1600 × 900 px, opaque.** Dora and Enzo on a hilltop at golden hour overlooking a busy little valley: the hay shed, the dust spa, lanterns, a balloon and a skyship in the distance. Leave the lower-left third calm for a title laid over it. |

Total: 29 images.

## Painted (28-10-2026)

All 29 assets were painted with the built-in `image_gen` tool. No paid CLI/API fallback was used. WebP quality 88, method 6. Prompts below are verbatim; identical timeout retries reused their listed prompt.

### References and processing

Character references: `public/art/disco/dancer-dora-idle.webp` and `public/art/disco/dancer-enzo-idle.webp`. Painting references: `public/art/disco/venue-burrow.webp` and `public/art/pebble/place-meadow.webp`. The hay shed painting was then used to keep the buildings consistent. The golden twig used the generated ordinary twig as its shape reference. For the title retries, the same four supplied references were also packed into a temporary reference sheet; this sheet was reference material only.

Transparent assets were generated against flat pure magenta for the buildings, emerald hummingbird and both twigs, and flat pure green for the characters and other visitors. Pillow and NumPy removed the matte, estimated alpha from chroma dominance, unmixed the matte colour from soft edges, cropped to the subject and Lanczos-fitted within the exact box. Buildings and characters were bottom-aligned; characters occupy approximately 80% of the frame height. Other cutouts were centred. Opaque assets were fitted with `ImageOps.fit` and Lanczos. Every exported file was reopened and fully decoded, with exact dimensions and RGB/RGBA mode asserted. Alpha files were checked for transparent and opaque pixels and strong matte-colour contamination. Every asset was viewed on a mid-dark background, with reduced phone-size previews (visitors 74 px, twigs 40 px; other assets also previewed smaller).

The first Dora image had a painted checkerboard and was rejected and regenerated. Built-in generation timeouts for the polishery, orchard, cushion mill, skyship dock and title were retried. Discarded intermediate images and processing scripts are not project assets.

### Validation

| File | Size (px) | Mode | Notes |
| --- | --- | --- | --- |
| `valley-meadowvale.webp` | 2400 × 900 | RGB | Opaque; fully decoded; exact size; calm sky and clear ground band reviewed. |
| `valley-snowdrift.webp` | 2400 × 900 | RGB | Opaque; fully decoded; exact size; calm sky and clear ground band reviewed. |
| `valley-cove.webp` | 2400 × 900 | RGB | Opaque; fully decoded; exact size; calm sky and clear ground band reviewed. |
| `valley-glowcap.webp` | 2400 × 900 | RGB | Opaque; fully decoded; exact size; calm sky and clear ground band reviewed. |
| `valley-cloudreach.webp` | 2400 × 900 | RGB | Opaque; fully decoded; exact size; calm sky and clear ground band reviewed. |
| `building-meadow.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-spa.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-pebble.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-orchard.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-cushion.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-bakery.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-lantern.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-observatory.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-balloon.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-tea.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-bells.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `building-skyship.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/phone-size review; matched angle, light and bottom alignment. |
| `dora.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/reduced-size review; reference colours, eyes and facing checked. |
| `dora-cheer.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/reduced-size review; reference colours, eyes and facing checked. |
| `enzo.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/reduced-size review; reference colours, eyes and facing checked. |
| `enzo-cheer.webp` | 512 × 512 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark/reduced-size review; reference colours, eyes and facing checked. |
| `visitor-acorn.webp` | 256 × 256 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 74 px review; faces right. |
| `visitor-pedlar.webp` | 256 × 256 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 74 px review; faces right. |
| `visitor-owl.webp` | 256 × 256 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 74 px review; faces right. |
| `visitor-bat.webp` | 256 × 256 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 74 px review; faces right. |
| `visitor-breeze.webp` | 256 × 256 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 74 px review; faces right. |
| `twig.webp` | 128 × 128 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 40 px review; lower-left to upper-right diagonal. |
| `twig-gold.webp` | 128 × 128 | RGBA | Alpha; fully decoded; exact size; no chroma fringe seen; dark and 40 px review; lower-left to upper-right diagonal. |
| `title.webp` | 1600 × 900 | RGB | Opaque; fully decoded; exact size; four-reference style/character review; calm lower-left overlay area. |

### Exact prompts

#### `valley-meadowvale.webp`

```text
Use case: illustration-story. Paint a wide 8:3 opaque panorama for Hayloft Tycoon: Meadowvale home valley, rolling green hills, gentle river far away, wildflowers, puffy clouds, warm morning sky pale blue to soft cream. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Use the supplied venue-burrow and place-meadow images as painting-style references. Bottom quarter must be a soft fairly flat green ground band free of big objects, building ground line at 78% height. Top third calm sky for flying visitors. No buildings, animals, text, letters, numbers or logos. Final target 2400 by 900.
```

#### `valley-snowdrift.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint an opaque wide 8:3 valley panorama, final target 2400 × 900 px. Snowdrift Valley: snowy hills and frosted pines, smoke curling from distant chimneys, pale lavender-blue winter sky, soft snow on the ground band. Bottom quarter soft fairly flat ground band, free of big objects, buildings will stand at 78% height. Top third calm sky for visitors. No buildings and no animals. For Snowdrift suggest the distant chimney smoke as wisps beyond the hills without visible buildings.
```

#### `valley-cove.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint an opaque wide 8:3 valley panorama, final target 2400 × 900 px. Pebble Cove: a seaside bay with smooth round pebbles, a turquoise sea and gentle waves on the left and right horizon, a sandy ground band, a peachy afternoon sky. Bottom quarter soft fairly flat ground band, free of big objects, buildings will stand at 78% height. Top third calm sky for visitors. No buildings and no animals. For Snowdrift suggest the distant chimney smoke as wisps beyond the hills without visible buildings.
```

#### `valley-glowcap.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint an opaque wide 8:3 valley panorama, final target 2400 × 900 px. Glowcap Hollow: a twilight mushroom forest, giant soft glowing mushrooms in pink, teal and gold in the background, fireflies, a purple-to-rose dusk sky, mossy ground band. Bottom quarter soft fairly flat ground band, free of big objects, buildings will stand at 78% height. Top third calm sky for visitors. No buildings and no animals.
```

#### `valley-cloudreach.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint an opaque wide 8:3 valley panorama, final target 2400 × 900 px. Cloudreach Isles: floating grassy islands with little waterfalls drifting among pink and gold clouds, a bright sky; the ground band is a big grassy island top. Bottom quarter soft fairly flat ground band, free of big objects, buildings will stand at 78% height. Top third calm sky for visitors. No buildings and no animals.
```

#### `building-meadow.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated chinchilla-sized Hay Meadow building: A small wooden hay shed with an open front, golden bales stacked inside and a patch of tall timothy grass beside it, a little scythe leaning on the wall. Part of a matched twelve-building set: front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Same scale and ground line throughout set. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-spa.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Dust Bath Spa: A round sandstone bathhouse with a domed roof, a big shallow bowl of fine volcanic dust inside the doorway, a towel rack and a puff of dust in the air. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-pebble.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Pebble Polishery: A stone workshop with a water wheel turning a tumbling barrel, baskets of shiny smooth pebbles in grey, blue and pink out front. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-orchard.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Apple-Twig Orchard: Two little apple trees in blossom and fruit, with a twig-drying rack and a wooden crate of neat apple-twig bundles. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only. This asset is an orchard rather than a shed: two trees, twig rack and crate, no added hut.
```

#### `building-cushion.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Cozy Cushion Mill: A cottage mill with a soft fabric windmill, plump pastel cushions piled by the door, a spool of yarn. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-bakery.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Hay Biscuit Bakery: A half-timbered bakery with a round brick oven glowing orange, a tray of golden hay biscuits on the sill, a striped awning. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-lantern.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Glimmer Lantern Works: A workshop with a glass roof, many small paper and glass lanterns hanging outside glowing warm yellow. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-observatory.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Moonlight Observatory: A small round stone tower with a silver dome open to a brass telescope, a crescent-moon weathervane. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-balloon.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Cloudhopper Balloon Port: A wooden landing platform with a patchwork hot-air balloon tethered above it and a wicker basket. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-tea.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Starleaf Tea Garden: A terraced tea garden with a little pagoda-roofed tea house, rows of round green tea bushes and a steaming teapot. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only.
```

#### `building-bells.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Aurora Bell Tower: A slender bell tower with a row of silver bells, faint ribbons of aurora colour (green, violet, pink) shimmering off the bells. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only. Keep the silver bells and green, violet, pink aurora ribbons clearly separate from the pure magenta extraction background.
```

#### `building-skyship.webp`

```text
Use case: illustration-story. Asset for the phone game Hayloft Tycoon. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Match the supplied venue-burrow and place-meadow painting-style references. No text, letters, numbers, logos or watermarks anywhere. Paint ONE isolated Comet Skyship Dock: A tall wooden dock with a small airship moored to it: a cosy hull, hay-coloured sails, a comet-tail pennant, ropes and a gangplank. Part of a matched twelve-building set: match the supplied hay shed reference angle, scale, lighting and ground line. Front three-quarter view showing front and right side, modest elevation, warm upper-left daylight, fine brown outlines, rounded cosy proportions. Entire structure and props fully visible, centred, broad base at bottom, fills most of square; no terrain slab, no animals. Final 512 × 512 with transparent background after extraction. For extraction paint perfectly flat uniform pure magenta #ff00ff background, including all gaps; no gradient, no magenta bounce or cast shadow. Small neutral contact shadow only. Show a complete small sailing airship and dock, ropes and gangplank readable; the comet-tail pennant is plain decorative fabric without symbols or text.
```

#### `dora.webp`

Attempt 1:

```text
Use case: illustration-story. Paint Dora for Hayloft Tycoon, matching the supplied dancer-dora-idle.webp character reference exactly in face, round ears, fluffy tail, proportions, cream-white fur, pink ears and ruby-red eyes. Dora standing on her hind legs holding a small bundle of hay, gentle smile, ears up. Three-quarter view facing slightly RIGHT toward the centre of the game. Entire body and fluffy tail in frame, upright on hind legs, feet at bottom; character will occupy roughly 80% of final square height. Warm hand-painted toon storybook, soft cel shading and gentle fine brown ink edges, cosy and kind. No clothing or accessories except the hay bundle. No text, letters, numbers, logos or watermark. Isolated on perfectly flat uniform pure green #00ff00 chroma background including gaps; no gradient or green reflected light. No scenery or ground patch. Final transparent 512 × 512 after matte removal.
```

Attempt 2 (regeneration: remove painted checkerboard):

```text
Use case: illustration-story. Paint Dora for Hayloft Tycoon, matching the supplied dancer-dora-idle.webp character reference exactly in face, round ears, fluffy tail, proportions, cream-white fur, pink ears and ruby-red eyes. Dora standing on her hind legs holding a small bundle of hay, gentle smile, ears up. Three-quarter view facing slightly RIGHT toward the centre of the game. Entire body and fluffy tail in frame, upright on hind legs, feet at bottom; character will occupy roughly 80% of final square height. Warm hand-painted toon storybook, soft cel shading and gentle fine brown ink edges, cosy and kind. No clothing or accessories except the hay bundle. No text, letters, numbers, logos or watermark. Isolated on perfectly flat uniform pure green #00ff00 chroma background including gaps; no gradient or green reflected light. No scenery or ground patch. Final transparent 512 × 512 after matte removal. CRITICAL: replace any checkerboard or transparency-grid appearance from the reference with a solid flat bright pure GREEN RGB(0,255,0) background. The background must be green paint with absolutely no checks or grey pixels.
```

#### `dora-cheer.webp`

```text
Use case: illustration-story. Paint Dora for Hayloft Tycoon, matching the supplied dancer-dora-idle.webp reference exactly in face, round ears, fluffy tail, proportions, cream-white fur, pink ears and ruby-red eyes. Dora mid-hop with both front paws up, delighted, a few tufts of fluff floating around her. Three-quarter view facing slightly RIGHT toward the centre of the game. Entire body, both raised paws, tufts and fluffy tail fully in frame; bottom feet near bottom, character roughly 80% of final square height. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy and kind. No clothing or hay. No text, letters, numbers, logos or watermark. Paint an actual flat uniform pure green #00ff00 background including gaps, no gradient or green reflected light. CRITICAL: no checkerboard, transparency grid or grey backdrop; solid green paint only. No scenery or ground patch. Final transparent 512 × 512 after matte removal.
```

#### `enzo.webp`

```text
Use case: illustration-story. Paint Enzo for Hayloft Tycoon, matching the supplied dancer-enzo-idle.webp character reference exactly in face, big round ears, fluffy tail and proportions. Enzo has COOL MID-GREY fur with a darker grey back, pale chest, pink ears, and solid BLACK eyes with small white catchlights (no brown irises). Enzo standing holding a little wooden clipboard, calm happy look. Three-quarter view facing slightly LEFT toward the centre of the game; tail on right side. Entire body and fluffy tail in frame, upright on hind legs, feet at bottom; character roughly 80% of final square height. Little wooden clipboard must be blank, no marks. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No clothing. No text, letters, numbers, logos or watermark. Isolated on perfectly flat uniform pure green #00ff00 chroma background including gaps; no gradient or green reflected light. CRITICAL: no checkerboard, transparency grid or grey backdrop; solid green paint only. No scenery or ground patch. Final transparent 512 × 512 after matte removal.
```

#### `enzo-cheer.webp`

```text
Use case: illustration-story. Paint Enzo for Hayloft Tycoon, matching the supplied dancer-enzo-idle.webp character reference exactly in face, big round ears, fluffy tail and proportions. Enzo has COOL MID-GREY fur with a darker grey back, pale chest, pink ears, and solid BLACK eyes with small white catchlights (no brown irises). Enzo mid-hop with paws up and his clipboard tossed in the air, a few tufts of fluff floating. Three-quarter view facing slightly LEFT toward the centre of the game; tail on right side. Entire body, raised paws, airborne clipboard and tufts in frame; bottom feet near bottom, character roughly 80% of final square height. Little wooden clipboard tossed above must be blank, no marks. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No clothing. No text, letters, numbers, logos or watermark. Isolated on perfectly flat uniform pure green #00ff00 chroma background including gaps; no gradient or green reflected light. CRITICAL: no checkerboard, transparency grid or grey backdrop; solid green paint only. No scenery or ground patch. Final transparent 512 × 512 after matte removal.
```

#### `visitor-acorn.webp`

```text
Use case: illustration-story. Paint a Hayloft Tycoon visitor. A tiny emerald hummingbird carrying a shining golden acorn, sparkles around the acorn. One centred isolated sky visitor facing RIGHT, fully visible, bold readable silhouette for a 74px phone display, final transparent 256 × 256 after extraction. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos or watermark, no scenery, no ground. Isolated on a perfectly flat uniform pure MAGENTA #ff00ff chroma background, including gaps. Emerald green hummingbird, shiny golden acorn held securely. No gradient or magenta reflected light. No checkerboard or transparency grid. Use supplied meadow image as painting-style reference.
```

#### `visitor-pedlar.webp`

```text
Use case: illustration-story. Paint a Hayloft Tycoon visitor. A friendly viscacha pedlar riding a little dandelion-seed parachute, with a bulging coin sack. One centred isolated sky visitor facing RIGHT, fully visible, bold readable silhouette for a 74px phone display, final transparent 256 × 256 after extraction. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos or watermark, no scenery, no ground. A viscacha is a long-eared fluffy grey South American rodent; make it friendly and small, riding suspended under one fluffy dandelion seed parachute and holding a bulging gold-coin sack without symbols. Use the supplied Enzo image as a reference for the arcade's rodent rendering style, but make a distinct viscacha. Isolated on perfectly flat uniform pure GREEN #00ff00 chroma background including gaps. No gradient or green reflected light. No checkerboard or transparency grid.
```

#### `visitor-owl.webp`

```text
Use case: illustration-story. Paint a Hayloft Tycoon visitor. A round little owl scholar with round spectacles, flying with a rolled blueprint in its talons. One centred isolated sky visitor facing RIGHT, fully visible, bold readable silhouette for a 74px phone display, final transparent 256 × 256 after extraction. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos or watermark, no scenery, no ground. Friendly round brown-and-cream owl with round spectacles; blue rolled blueprint has no writing, letters, numbers, diagram marks or symbols. Isolated on perfectly flat uniform pure GREEN #00ff00 chroma background including gaps. No gradient or green reflected light. No checkerboard or transparency grid. Supplied meadow is painting-style reference.
```

#### `visitor-bat.webp`

```text
Use case: illustration-story. Paint a Hayloft Tycoon visitor. A small fluffy fruit bat, smiling, holding a glowing orange sunberry. One centred isolated sky visitor facing RIGHT, fully visible, bold readable silhouette for a 74px phone display, final transparent 256 × 256 after extraction. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos or watermark, no scenery, no ground. A small fluffy fruit bat, kind smile, wings spread in flight facing right, holding a glowing orange sunberry. Isolated on perfectly flat uniform pure GREEN #00ff00 chroma background including gaps. No gradient or green reflected light. No checkerboard or transparency grid. Supplied meadow is painting-style reference.
```

#### `visitor-breeze.webp`

```text
Use case: illustration-story. Paint a Hayloft Tycoon visitor. A swirl of soft wind carrying puffs of chinchilla fluff and a few flower petals, with a happy face in the swirl. One centred isolated sky visitor facing RIGHT, fully visible, bold readable silhouette for a 74px phone display, final transparent 256 × 256 after extraction. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, logos or watermark, no scenery, no ground. A graceful readable pale cream and soft powder-blue wind curl travelling right, carrying little cream-white and grey chinchilla fluff puffs and a few pink and peach flower petals, a kind happy face in the curl. Keep airy soft edges and distinct silhouette. Isolated on perfectly flat uniform pure GREEN #00ff00 chroma background including gaps. No gradient or green reflected light. No checkerboard or transparency grid. Supplied meadow is painting-style reference.
```

#### `twig.webp`

```text
Use case: illustration-story. Hayloft Tycoon minigame pickup. Paint one short APPLE TWIG with exactly two small GREEN LEAVES. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind, match supplied meadow painting style. A simple stout brown twig with tiny buds, diagonal from LOWER LEFT to UPPER RIGHT, centred and fully visible, bold clear silhouette at 40px phone gameplay size. Final transparent 128 × 128. For extraction paint perfectly flat uniform pure MAGENTA #ff00ff chroma background including gaps. No gradient, magenta bounce, cast shadow, scenery or ground. No text, letters, numbers, logos, watermark or checkerboard.
```

#### `twig-gold.webp`

```text
Use case: illustration-story. Paint the GOLDEN VERSION of the supplied apple twig for Hayloft Tycoon. SAME short apple twig shape, exactly two small leaves, same diagonal from LOWER LEFT to UPPER RIGHT, same angle and layout; turn the twig and leaves luminous warm gold, add tiny golden sparkles and a soft gold glow. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Centred fully visible, bold clear silhouette at 40px phone gameplay size, final transparent 128 × 128. For extraction paint perfectly flat uniform pure MAGENTA #ff00ff chroma background including all gaps. No gradient or magenta reflected light, no scenery or ground. No text, letters, numbers, logos, watermark or checkerboard.
```

#### `title.webp`

Attempt 1:

```text
Use case: illustration-story. Paint the opaque 16:9 title illustration for Hayloft Tycoon, final size 1600 × 900. Dora and Enzo on a hilltop at golden hour overlooking a busy little valley: the hay shed, sandstone domed dust spa, warm glowing lanterns, patchwork hot-air balloon and a cosy wooden sailing skyship in the distance. Dora and Enzo stand together on the RIGHT foreground, seen in three-quarter profile looking fondly over their valley, faces visible. Keep the LOWER-LEFT THIRD quiet open softly lit grass without characters or large objects so a game title can be overlaid later. Dora must match dancer-dora-idle.webp exactly: cream-white fur, pink ears, ruby-red eyes, big round ears, fluffy tail. Enzo must match dancer-enzo-idle.webp exactly: cool mid-grey, darker back, pale chest, pink ears, solid black eyes, big round ears and fluffy tail. Supplied venue-burrow.webp and place-meadow.webp are painting-style references: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Warm golden-hour light, inviting layered hills and little paths. NO text, letters, numbers, logos, watermark or title painted into the image.
```

Attempt 2 (retry with four references packed into one sheet):

```text
Use case: illustration-story. Paint the opaque 16:9 title illustration for Hayloft Tycoon, final size 1600 × 900. Dora and Enzo on a hilltop at golden hour overlooking a busy little valley: the hay shed, sandstone domed dust spa, warm glowing lanterns, patchwork hot-air balloon and a cosy wooden sailing skyship in the distance. Dora and Enzo stand together on the RIGHT foreground, seen in three-quarter profile looking fondly over their valley, faces visible. Keep the LOWER-LEFT THIRD quiet open softly lit grass without characters or large objects so a game title can be overlaid later. Dora must match dancer-dora-idle.webp exactly: cream-white fur, pink ears, ruby-red eyes, big round ears, fluffy tail. Enzo must match dancer-enzo-idle.webp exactly: cool mid-grey, darker back, pale chest, pink ears, solid black eyes, big round ears and fluffy tail. Supplied venue-burrow.webp and place-meadow.webp are painting-style references: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Warm golden-hour light, inviting layered hills and little paths. NO text, letters, numbers, logos, watermark or title painted into the image. The single supplied reference sheet contains the four references: Dora upper left, Enzo upper right, venue-burrow lower left and place-meadow lower right. Use these as references only; paint one unified landscape, no panels, no collage.
```

Attempt 3 (shorter retry after timeout):

```text
Paint a warm hand-painted toon storybook game title scene, 16:9 opaque landscape. Dora and Enzo stand together on a hilltop at golden hour overlooking a busy cosy valley with a hay shed, domed dust spa, glowing lanterns, patchwork balloon and little wooden sailing skyship in the distance. Keep the lower-left third calm empty grass for an overlay. Characters on right: Dora cream-white with pink ears and ruby eyes, Enzo cool grey with darker back, pale chest, pink ears and black eyes. Match the four images in the supplied reference sheet: Dora top left, Enzo top right, painting styles bottom left and bottom right. Soft cel shading, fine brown ink edges, cosy and kind. Paint ONE unified scene. No text, letters, numbers, logos, borders or panels. Final 1600 × 900.
```


## Enzo repaint (28-10-2026)

### Follow-up repaint — title retry

`public/art/hayloft/title.webp` remains skipped: short-prompt generation and its identical retry both timed out; original remains untouched. Backup: `/tmp/enzo-old/hayloft-title.webp`.

The general Enzo identity references are the photo `public/art/enzo.jpeg`, command `portrait-enzo.webp`, and safari `walker-enzo.webp`; this title call deliberately used ONLY the current title and `public/art/command/portrait-enzo.webp`, per the requested timeout workaround. No photo or safari reference was attached to title calls.

Exact prompt (both calls):

```text
Edit the current warm hand-painted Hayloft Tycoon title scene: Dora and Enzo on the right hilltop overlooking a golden-hour valley with hay shed, domed dust spa, lanterns, patchwork balloon and wooden sailing skyship; keep the exact composition, scenery, style, poses and Dora unchanged. Repaint ONLY Enzo using the portrait colour reference: COOL BLUE-GREY mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, solid BLACK eyes with white glints, never taupe, beige or brown; opaque 1600x900, no text.
```


Used only the built-in image generation tool, one image at a time. No CLI/API fallback or API key was used. No code or CHANGELOG.md was edited; nothing was committed.

Every generation used these three identity references: `public/art/enzo.jpeg` (real photo), `public/art/command/portrait-enzo.webp`, and `public/art/safari/walker-enzo.webp`. The current image being replaced was also supplied for its pose, composition, props and painting style, never as an identity-colour reference. Disco calls additionally supplied the matching `public/art/disco/dancer-dora-<pose>.webp` for scale and feet placement. No disco Enzo dancer was used as an identity reference.

### Files and outcomes

- `public/art/hayloft/enzo.webp` — Repainted and saved.
- `public/art/hayloft/enzo-cheer.webp` — Repainted and saved.
- `public/art/hayloft/title.webp` — Skipped: Generation and identical retry both timed out. Original left untouched.

Completed images were saved as WebP quality 88, preserving exact original pixel size and RGB/RGBA mode, and reopened and fully decoded to assert those properties. Originals were copied before replacement to `/tmp/enzo-old/<game>-<name>.webp`. Transparent sprites were generated on flat pure green #00ff00, keyed with Pillow and numpy, with green spill unmixed from soft edges, resampled with Lanczos into the original subject bounds and baseline, and checked after WebP encoding for chroma fringe. Opaque images used `ImageOps.fit` with Lanczos. Saved results were visually compared beside the originals on a dark purple background. Enzo has cool grey fur and black eyes (original closed eyes and dizzy spirals retained); props and poses were retained.

Clipboard Enzo: initial generation timed out; identical retry succeeded. Cheer succeeded on its initial call.

### Exact prompts used

Each block is the exact submitted string; identical timeout retries reused it unchanged.

#### `public/art/hayloft/enzo.webp`

```text
Use case: illustration-story. Paint Enzo for Hayloft Tycoon, matching the supplied dancer-enzo-idle.webp character reference exactly in face, big round ears, fluffy tail and proportions. Enzo has COOL MID-GREY fur with a darker grey back, pale chest, pink ears, and solid BLACK eyes with small white catchlights (no brown irises). Enzo standing holding a little wooden clipboard, calm happy look. Three-quarter view facing slightly LEFT toward the centre of the game; tail on right side. Entire body and fluffy tail in frame, upright on hind legs, feet at bottom; character roughly 80% of final square height. Little wooden clipboard must be blank, no marks. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No clothing. No text, letters, numbers, logos or watermark. Isolated on perfectly flat uniform pure green #00ff00 chroma background including gaps; no gradient or green reflected light. CRITICAL: no checkerboard, transparency grid or grey backdrop; solid green paint only. No scenery or ground patch. Final transparent 512 × 512 after matte removal.

EDIT OVERRIDE: Image 1 real Enzo photo, 2 command portrait-enzo and 3 safari walker-enzo define identity colours only. Image 4 is the CURRENT EDIT TARGET: keep its exact composition, pose, expression, props, framing, background and painting style, change ONLY Enzo colours. Do not copy any outfit or prop from identity references. Enzo is a COOL BLUE-GREY chinchilla: mid-grey coat with a darker grey wavy back, pale grey-white face and chest, pink ears, solid BLACK eyes with white glints, NO brown iris or warm eye reflections. Never taupe, beige or brown. Dora must stay EXACTLY as she is: cream-white, ruby eyes, pink ears. Supersede original reference instructions and warm fur colours. Flat uniform pure green #00ff00 background; no spill, gradient or shadow. Match target subject bounds and feet baseline exactly, final 512x512 RGBA.
```

#### `public/art/hayloft/enzo-cheer.webp`

```text
Use case: illustration-story. Paint Enzo for Hayloft Tycoon, matching the supplied dancer-enzo-idle.webp character reference exactly in face, big round ears, fluffy tail and proportions. Enzo has COOL MID-GREY fur with a darker grey back, pale chest, pink ears, and solid BLACK eyes with small white catchlights (no brown irises). Enzo mid-hop with paws up and his clipboard tossed in the air, a few tufts of fluff floating. Three-quarter view facing slightly LEFT toward the centre of the game; tail on right side. Entire body, raised paws, airborne clipboard and tufts in frame; bottom feet near bottom, character roughly 80% of final square height. Little wooden clipboard tossed above must be blank, no marks. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No clothing. No text, letters, numbers, logos or watermark. Isolated on perfectly flat uniform pure green #00ff00 chroma background including gaps; no gradient or green reflected light. CRITICAL: no checkerboard, transparency grid or grey backdrop; solid green paint only. No scenery or ground patch. Final transparent 512 × 512 after matte removal.

EDIT OVERRIDE: Image 1 real Enzo photo, 2 command portrait-enzo and 3 safari walker-enzo define identity colours only. Image 4 is the CURRENT EDIT TARGET: keep its exact composition, pose, expression, props, framing, background and painting style, change ONLY Enzo colours. Do not copy any outfit or prop from identity references. Enzo is a COOL BLUE-GREY chinchilla: mid-grey coat with a darker grey wavy back, pale grey-white face and chest, pink ears, solid BLACK eyes with white glints, NO brown iris or warm eye reflections. Never taupe, beige or brown. Dora must stay EXACTLY as she is: cream-white, ruby eyes, pink ears. Supersede original reference instructions and warm fur colours. Flat uniform pure green #00ff00 background; no spill, gradient or shadow. Match target subject bounds and feet baseline exactly, final 512x512 RGBA.
Eyes must be SOLID BLACK throughout with white glints, no brown lower-eye crescent.
```

#### `public/art/hayloft/title.webp`

```text
Use case: illustration-story. Paint the opaque 16:9 title illustration for Hayloft Tycoon, final size 1600 × 900. Dora and Enzo on a hilltop at golden hour overlooking a busy little valley: the hay shed, sandstone domed dust spa, warm glowing lanterns, patchwork hot-air balloon and a cosy wooden sailing skyship in the distance. Dora and Enzo stand together on the RIGHT foreground, seen in three-quarter profile looking fondly over their valley, faces visible. Keep the LOWER-LEFT THIRD quiet open softly lit grass without characters or large objects so a game title can be overlaid later. Dora must match dancer-dora-idle.webp exactly: cream-white fur, pink ears, ruby-red eyes, big round ears, fluffy tail. Enzo must match dancer-enzo-idle.webp exactly: cool mid-grey, darker back, pale chest, pink ears, solid black eyes, big round ears and fluffy tail. Supplied venue-burrow.webp and place-meadow.webp are painting-style references: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Warm golden-hour light, inviting layered hills and little paths. NO text, letters, numbers, logos, watermark or title painted into the image.

EDIT OVERRIDE: Image 1 real Enzo photo, 2 command portrait-enzo and 3 safari walker-enzo define identity colours only. Image 4 is the CURRENT EDIT TARGET: keep its exact composition, pose, expression, props, framing, background and painting style, change ONLY Enzo colours. Do not copy any outfit or prop from identity references. Enzo is a COOL BLUE-GREY chinchilla: mid-grey coat with a darker grey wavy back, pale grey-white face and chest, pink ears, solid BLACK eyes with white glints, NO brown iris or warm eye reflections. Never taupe, beige or brown. Dora must stay EXACTLY as she is: cream-white, ruby eyes, pink ears. Supersede original reference instructions and warm fur colours.
Precise localized recolour: Enzo is the RIGHTMOST foreground chinchilla. Dora to his left and every landscape detail must remain exactly unchanged. Keep current front-facing poses, do not restage from original text.
```
## Painted (28-10-2026, follow-up)

Skipped `public/art/hayloft/title.webp`: both built-in generation attempts timed out; original unchanged. Backup: `/tmp/enzo-old/hayloft-title.webp`.

Initial prompt:

```text
Repaint image 1, keeping the entire scene, composition and Dora exactly unchanged; change only Enzo on the right to COOL BLUE-GREY with a darker back, pale chest and solid BLACK eyes, matching image 2, never taupe or brown. Preserve warm hand-painted toon storybook style, soft cel shading and fine brown ink edges. Opaque 1600x900 landscape, no text, letters or borders.
```

Retry prompt:

```text
Keep image 1 exactly unchanged except recolour rightmost Enzo cool blue-grey, darker back, pale chest, solid black eyes like image 2. Preserve Dora, every scene detail and storybook style; opaque 1600x900, no text or borders.
```


## Enzo recolour (28-10-2026, evening)

The image tool timed out on every repaint of `title.webp` (nine attempts), so Enzo was recoloured in the existing painting with Pillow instead: inside ellipses traced around his head, ears, body and tail, warm low-saturation fur (hue 18°–58°, saturation under 0.55, or near-neutral) was blended to a faintly cool grey at 86% of its brightness; the pink inner ears, cheeks and tongue were left alone; brown iris pixels were darkened to near-black. Dora and the scene are untouched. The page does not currently display `title.webp`.

## Upgraded buildings and helper frames (29-10-2026)

The shop's three upgrades per building now show as paintings instead of drawn bunting and lanterns, and each helper gets extra frames so they work, carry and cheer rather than only hop. **Use the existing painting as the reference for every new one**, so it is clearly the same building or the same helper: same camera angle, same size and position in the frame, same style.

**Upgraded buildings: 512 × 512 transparent**, the building footprint and base in exactly the same place as in `building-<id>.webp`, no ground beyond its own base.

| File | Shown from | Description |
| --- | --- | --- |
| `building-<id>-up1.webp` | upgrades 1 and 2 | The same building spruced up: fresh paint, flower boxes, a string of colourful bunting, a couple of warm paper lanterns, a little extra detail that fits its trade (more hay bales, a second tub, bigger sign-board with no text). Clearly busier and cosier. |
| `building-<id>-up2.webp` | upgrade 3 | The same building at its grandest: grown a little taller (an extra floor, tower or wing), gold trim, a pennant flag in its colour on top, lanterns lit, sparkles. Still recognisably the same place. |

for each `<id>` in: `meadow` (Hay Meadow), `spa` (Dust Bath Spa), `pebble` (Pebble Polishery), `orchard` (Apple-Twig Orchard), `cushion` (Cozy Cushion Mill), `bakery` (Hay Biscuit Bakery), `lantern` (Glimmer Lantern Works), `observatory` (Moonlight Observatory), `balloon` (Cloudhopper Balloon Port), `tea` (Starleaf Tea Garden), `bells` (Aurora Bell Tower), `skyship` (Comet Skyship Dock).

**Helper frames: 256 × 256 transparent** (512 × 512 for Dora and Enzo, to match `dora.webp` and `enzo.webp`), full body, feet near the bottom edge, same scale as the existing frame.

| File | Description |
| --- | --- |
| `<who>-work.webp` | Busy at its building's job, facing the viewer at three-quarters: Dora pitching hay with a little fork; Enzo scrubbing with a brush in a puff of dust; Pebble polishing a stone with a cloth; Juniper reaching up to pick an apple; Tuft plumping a cushion; Biscuit sliding a tray of biscuits; Lumen lighting a lantern wick; Nova peering through its telescope; Breeze tugging a balloon rope; Sage pouring tea from a pot; Chime pulling a bell rope; Captain Wisp turning a ship's wheel. |
| `<who>-carry.webp` | Walking side-on **facing right**, mid-stride, carrying its building's goods: a hay bundle, a towel, a basket of shiny pebbles, a basket of apples, a stack of cushions, a tray of biscuits, a lit lantern, a rolled star chart, a sandbag, a teapot, a tiny bell, a little comet-shaped parcel. |
| `<who>-cheer.webp` | Cheering, both arms up, sparkles (not needed for Dora and Enzo, who have one). |

where `<who>` is `dora`, `enzo`, and `helper-<slug>` for `pebble`, `juniper`, `tuft`, `biscuit`, `lumen`, `nova`, `breeze`, `sage`, `chime`, `captain-wisp`. Each helper keeps its fur colour, eyes and accessory from its row above (Dora cream-white with ruby-red eyes; Enzo cool blue-grey with solid black eyes, never taupe).
