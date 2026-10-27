# Kit Parade: art brief

Paintings for Kit Parade (`/parade`), 28-10-2026. Every image below is loaded by `lib/parade-scene.ts` from `public/art/parade/`. Until an image loads (or if it is missing) the scene draws its own stand-in, so the images can arrive in any order.

**Style for every image:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters or numbers anywhere in the images. Dora is cream-white with pink ears and ruby eyes; Enzo is grey with a pale chest and black eyes. Baby kits are drawn in code, so no kits are needed in the sprites unless a line below says so.

Save as `.webp` at the exact pixel size given. "Transparent" means a clean alpha background with no shadow box or halo; "opaque" fills the frame.

## Title

| Path | Size | Alpha | Description |
| --- | --- | --- | --- |
| `title.webp` | 1600×1000 | opaque | Title card. A sunny clover meadow hillside at golden hour. A line of six tiny baby chinchilla kits (mixed coats: cream, pale grey, beige, white, dark grey, fawn) marches left to right in single file out of a round burrow in the hillside, tails up. On the right, Dora and Enzo kneel beside a cosy round home burrow with a little wooden door and a lantern, paws open to welcome them. One kit in the middle wears a tiny hard hat, one holds a hay bale. Keep the top third fairly calm (sky) and the bottom fifth darker so a title can sit over it. |

## World backgrounds

Painted behind the terrain, which covers most of the lower half, so the interest belongs in the sky and the far distance. Each is 1920×1080, opaque, with no ground plane in the bottom 40% (keep it soft, hazy and low in contrast there).

| Path | Size | Alpha | Description |
| --- | --- | --- | --- |
| `bg-meadow.webp` | 1920×1080 | opaque | Clover Meadow: bright spring sky with puffy clouds, rolling green hills in the distance, a far windmill and dandelion fluff drifting. |
| `bg-pantry.webp` | 1920×1080 | opaque | The Big Pantry, seen from a mouse's height: warm wooden pantry shelves fading into the distance, giant jam jars, flour sacks and a cheese wheel, soft lamplight from above. |
| `bg-cave.webp` | 1920×1080 | opaque | Pebble Cave: a cool blue-green cavern with glowing mushrooms, soft crystals, gentle drips and a faint underground pond glow; calm and friendly, never dark or spooky. |
| `bg-roofs.webp` | 1920×1080 | opaque | Moonlit Rooftops: a deep blue night sky with a big friendly full moon, stars, and a skyline of crooked cottage roofs and chimneys with warm lit windows far away. |

## Terrain textures

Seamless tiles (they repeat in both directions). The scene cuts them to the shape of the ground, so paint only the material, edge to edge, with no edges, grass tops or shadows (the scene adds those). Painted at roughly 4 screen pixels per world pixel, so detail of about 6 to 30 pixels reads best.

| Path | Size | Alpha | Description |
| --- | --- | --- | --- |
| `earth-meadow.webp` | 256×256 | opaque, seamless | Soft brown garden soil with little pebbles, roots and the odd tiny clover seed. |
| `earth-pantry.webp` | 256×256 | opaque, seamless | Packed oat-and-biscuit crumble, warm golden brown, with oat flakes. |
| `earth-cave.webp` | 256×256 | opaque, seamless | Soft blue-grey cave clay with flecks of sparkle. |
| `earth-roofs.webp` | 256×256 | opaque, seamless | Old terracotta roof moss and soft packed thatch, dusky orange-brown under moonlight. |
| `stone.webp` | 256×256 | opaque, seamless | Pebble stone: smooth rounded grey and slate pebbles set tight together, clearly hard and undiggable. |
| `hay.webp` | 256×256 | opaque, seamless | Pale golden straw hay packed in horizontal strands (the scene paints direction arrows over it). |
| `bale.webp` | 128×128 | opaque, seamless | Freshly tied hay bale surface, brighter yellow than `hay.webp`, with a hint of twine. |

## Burrows and the family

| Path | Size | Alpha | Description |
| --- | --- | --- | --- |
| `burrow-in.webp` | 256×256 | transparent | The entrance: a round earthy burrow hole seen from the front, framed by roots and a tiny wooden sign post (blank), with a soft dark opening in the lower half where kits pop out. |
| `burrow-home.webp` | 320×256 | transparent | The home burrow: a round green front door set into a mossy mound, a warm lantern beside it, a doormat and a little flower pot. The door stands open with warm light inside; the doorstep is at the bottom centre. |
| `parent-dora.webp` | 512×512 | transparent | Dora standing on her hind legs facing right, front paws open in a welcoming hug, smiling, feet at the bottom centre. |
| `parent-enzo.webp` | 512×512 | transparent | Enzo standing on his hind legs facing left, one paw waving and one on his chest, proud and happy, feet at the bottom centre. |
| `mum-carry.webp` | 384×384 | transparent | Dora gently carrying a sleepy, dizzy baby kit (pale grey) wrapped in a leaf blanket in her arms, little swirls of dizziness above the kit, Dora looking down at it kindly. Side view, facing right. |

## Things in the levels

| Path | Size | Alpha | Description |
| --- | --- | --- | --- |
| `lilypad.webp` | 256×96 | transparent | A round green lily pad seen from the side and slightly above, flat top, with a small pink flower at one edge; it sits on water. |
| `seesaw.webp` | 512×96 | transparent | A long wooden plank (like an old ruler) with a little cushion at each end, drawn level; the scene tilts it. A small wooden pivot block is painted under its middle. |
| `fan.webp` | 256×128 | transparent | A chimney-top fan: a round brick chimney pot with a friendly spinning propeller of feathers on top, seen from the front. |
| `puff.webp` | 192×128 | transparent | A springy, bouncy cloud of dust: soft, round and fluffy, cream with lilac shading, a few sparkles. |

## Job icons

Shown on the job buttons and in a little bubble above each kit. 128×128, transparent, a single clear object or pose centred with some padding, readable at 28 pixels.

| Path | Size | Alpha | Description |
| --- | --- | --- | --- |
| `job-stopper.webp` | 128×128 | transparent | A small chinchilla paw held up, palm out, in a "stop" gesture. |
| `job-digger.webp` | 128×128 | transparent | A little garden trowel pointing down into a mound of earth with an arrow-shaped divot. |
| `job-tunneller.webp` | 128×128 | transparent | A tiny pickaxe beside a round tunnel opening. |
| `job-builder.webp` | 128×128 | transparent | Three small hay bales stacked as stairs. |
| `job-climber.webp` | 128×128 | transparent | A small rope with a grappling hook and a paw print. |
| `job-glider.webp` | 128×128 | transparent | A fluffy chinchilla tail spread like a parachute. |
| `job-bouncer.webp` | 128×128 | transparent | A small springy dust cloud with a curved bounce line above it. |
| `job-hugger.webp` | 128×128 | transparent | Two little chinchilla arms in a hug around a pink heart. |


## Painted (28-10-2026)

Partial delivery: **2 of 29 images painted** using only the built-in image generation tool. The title request timed out twice. After the meadow and pantry backgrounds succeeded, the tool returned HTTP 429 `usage_limit_reached`; generation stopped with 27 assets unfinished. The reported reset was 28-10-2026 at 06:02:11 UTC (14:02:11 Singapore time). No paid CLI/API fallback was used.

### Processing and validation

The two completed opaque images were converted to RGB, fitted with Pillow `ImageOps.fit` and Lanczos to 1920×1080, and saved as WebP quality 90. Both were reopened and fully decoded, with exact size and RGB mode asserted. Both saved images were visually inspected; the compositions match the reference painting style, contain no writing, and leave the lower area soft and hazy for terrain. They are opaque, so alpha, chroma removal and small-sprite checks are not applicable. No transparent sprites or seamless textures have yet been produced or validated.

In the table, dimensions and mode for unfinished files are **targets only**, not successful validation results.

| File | Size | Mode | Notes |
| --- | --- | --- | --- |
| `title.webp` | 1600×1000 | RGB | NOT PAINTED: both requests timed out. |
| `bg-meadow.webp` | 1920×1080 | RGB | PASS: saved, fully decoded, exact size/mode, visually inspected. |
| `bg-pantry.webp` | 1920×1080 | RGB | PASS: saved, fully decoded, exact size/mode, visually inspected. |
| `bg-cave.webp` | 1920×1080 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `bg-roofs.webp` | 1920×1080 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `earth-meadow.webp` | 256×256 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `earth-pantry.webp` | 256×256 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `earth-cave.webp` | 256×256 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `earth-roofs.webp` | 256×256 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `stone.webp` | 256×256 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `hay.webp` | 256×256 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `bale.webp` | 128×128 | RGB | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `burrow-in.webp` | 256×256 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `burrow-home.webp` | 320×256 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `parent-dora.webp` | 512×512 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `parent-enzo.webp` | 512×512 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `mum-carry.webp` | 384×384 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `lilypad.webp` | 256×96 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `seesaw.webp` | 512×96 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `fan.webp` | 256×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `puff.webp` | 192×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-stopper.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-digger.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-tunneller.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-builder.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-climber.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-glider.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-bouncer.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |
| `job-hugger.webp` | 128×128 | RGBA | NOT PAINTED: generation blocked by usage limit; target size/mode unvalidated. |

### Exact prompts and references

The title prompt below was submitted twice unchanged (both timed out), with all four supplied references: `public/art/disco/dancer-dora-idle.webp`, `public/art/disco/dancer-enzo-idle.webp`, `public/art/disco/venue-burrow.webp`, and `public/art/pebble/place-meadow.webp`.

The meadow and other non-character prompts used `venue-burrow.webp` and `place-meadow.webp` as references. Character prompts were prepared with `dancer-dora-idle.webp` and `dancer-enzo-idle.webp` as references. Generated chroma-matte inputs were requested as opaque images, to be keyed afterward; no such input succeeded before the limit was reached.

Prompts for the two completed files are the exact submitted prompts. The title is the exact failed prompt. Other prompts below were prepared for this batch: requests through `puff.webp` were rejected by the usage limit; the job icon prompts remain unsubmitted. These are retained for completing the remaining work without changing the brief.

#### `title.webp` — timed out

```text
Use case: illustration-story. Paint Kit Parade title card, landscape 1600x1000 composition. Use the four supplied reference images: Dora and Enzo are exact character identity references; venue and meadow are painting style references. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Sunny clover meadow hillside at golden hour. Exactly six tiny baby chinchilla kits, coats cream, pale grey, beige, white, dark grey, fawn, march left to right in single file out of a round burrow at left, tails up. One middle kit wears a tiny hard hat, another carries a hay bale. Right: Dora and Enzo kneel beside a cosy round home burrow with little wooden door and lantern, paws open welcoming them. Dora cream-white, pink ears, ruby eyes. Enzo cool mid-grey, darker back, pale chest, pink ears, solid black eyes. Bold simple kit silhouettes. Top third calm sky; bottom fifth darker for future title overlay. No text, letters, numbers, symbols resembling writing, or watermark anywhere. Opaque full-frame painting.
```

#### `bg-meadow.webp` — painted

```text
Paint an opaque landscape background for Kit Parade, 1920x1080 composition. Reference the supplied meadow and burrow paintings for the same warm hand-painted toon storybook style, soft cel shading, gentle fine brown ink edges, cosy kind mood. Clover Meadow: bright spring sky with puffy clouds, rolling green hills far in the distance, a far windmill, dandelion fluff drifting. Interest in sky and far distance. Bottom 40 percent has no ground plane: soft hazy low-contrast pale green atmosphere only, for game terrain overlay. No characters. No text, letters, numbers or watermark. Fill frame.
```

#### `bg-pantry.webp` — painted

```text
Use case: illustration-story. Paint one Kit Parade game asset: bg-pantry.webp, intended final size 1920x1080. The Big Pantry, seen from a mouse's height: warm wooden pantry shelves fading into the distance, giant jam jars, flour sacks and a cheese wheel, soft lamplight from above.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Wide 16:9 composition. Painted behind game terrain. Put interest in sky and far distance; no ground plane in bottom 40 percent: keep that area soft hazy low contrast.
```

#### `bg-cave.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: bg-cave.webp, intended final size 1920x1080. Pebble Cave: a cool blue-green cavern with glowing mushrooms, soft crystals, gentle drips and a faint underground pond glow; calm and friendly, never dark or spooky.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Wide 16:9 composition. Painted behind game terrain. Put interest in sky and far distance; no ground plane in bottom 40 percent: keep that area soft hazy low contrast.
```

#### `bg-roofs.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: bg-roofs.webp, intended final size 1920x1080. Moonlit Rooftops: a deep blue night sky with a big friendly full moon, stars, and a skyline of crooked cottage roofs and chimneys with warm lit windows far away.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Wide 16:9 composition. Painted behind game terrain. Put interest in sky and far distance; no ground plane in bottom 40 percent: keep that area soft hazy low contrast.
```

#### `earth-meadow.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: earth-meadow.webp, intended final size 256x256. Soft brown garden soil with little pebbles, roots and the odd tiny clover seed.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `earth-pantry.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: earth-pantry.webp, intended final size 256x256. Packed oat-and-biscuit crumble, warm golden brown, with oat flakes.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `earth-cave.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: earth-cave.webp, intended final size 256x256. Soft blue-grey cave clay with flecks of sparkle.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `earth-roofs.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: earth-roofs.webp, intended final size 256x256. Old terracotta roof moss and soft packed thatch, dusky orange-brown under moonlight.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `stone.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: stone.webp, intended final size 256x256. Pebble stone: smooth rounded grey and slate pebbles set tight together, clearly hard and undiggable.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `hay.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: hay.webp, intended final size 256x256. Pale golden straw hay packed in horizontal strands (the scene paints direction arrows over it).
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `bale.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: bale.webp, intended final size 128x128. Freshly tied hay bale surface, brighter yellow than `hay.webp`, with a hint of twine.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Square seamless repeating material texture, orthographic flat material only, fills edge to edge. No object outline, edges, grass tops, lighting gradients or cast shadows. Detail should read at roughly 6 to 30 pixels in final tile. Continuous matching opposite edges in both directions.
```

#### `burrow-in.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: burrow-in.webp, intended final size 256x256. The entrance: a round earthy burrow hole seen from the front, framed by roots and a tiny wooden sign post (blank), with a soft dark opening in the lower half where kits pop out.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 256:256; preserve the requested side/front view.
```

#### `burrow-home.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: burrow-home.webp, intended final size 320x256. The home burrow: a round green front door set into a mossy mound, a warm lantern beside it, a doormat and a little flower pot. The door stands open with warm light inside; the doorstep is at the bottom centre.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure magenta #ff00ff chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 320:256; preserve the requested side/front view.
```

#### `parent-dora.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: parent-dora.webp, intended final size 512x512. Dora standing on her hind legs facing right, front paws open in a welcoming hug, smiling, feet at the bottom centre.
Reference images: exact character identity and painting style; Dora cream-white with pink ears and ruby eyes; Enzo COOL MID-GREY with darker back, pale chest, pink ears and solid black eyes. Match reference faces, round ears and fluffy curled tails exactly.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 512:512; preserve the requested side/front view.
```

#### `parent-enzo.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: parent-enzo.webp, intended final size 512x512. Enzo standing on his hind legs facing left, one paw waving and one on his chest, proud and happy, feet at the bottom centre.
Reference images: exact character identity and painting style; Dora cream-white with pink ears and ruby eyes; Enzo COOL MID-GREY with darker back, pale chest, pink ears and solid black eyes. Match reference faces, round ears and fluffy curled tails exactly.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 512:512; preserve the requested side/front view.
```

#### `mum-carry.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: mum-carry.webp, intended final size 384x384. Dora gently carrying a sleepy, dizzy baby kit (pale grey) wrapped in a leaf blanket in her arms, little swirls of dizziness above the kit, Dora looking down at it kindly. Side view, facing right.
Reference images: exact character identity and painting style; Dora cream-white with pink ears and ruby eyes; Enzo COOL MID-GREY with darker back, pale chest, pink ears and solid black eyes. Match reference faces, round ears and fluffy curled tails exactly.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure magenta #ff00ff chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 384:384; preserve the requested side/front view.
```

#### `lilypad.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: lilypad.webp, intended final size 256x96. A round green lily pad seen from the side and slightly above, flat top, with a small pink flower at one edge; it sits on water.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure magenta #ff00ff chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 256:96; preserve the requested side/front view.
```

#### `seesaw.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: seesaw.webp, intended final size 512x96. A long wooden plank (like an old ruler) with a little cushion at each end, drawn level; the scene tilts it. A small wooden pivot block is painted under its middle.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 512:96; preserve the requested side/front view.
```

#### `fan.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: fan.webp, intended final size 256x128. A chimney-top fan: a round brick chimney pot with a friendly spinning propeller of feathers on top, seen from the front.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 256:128; preserve the requested side/front view.
```

#### `puff.webp` — rejected by usage limit

```text
Use case: illustration-story. Paint one Kit Parade game asset: puff.webp, intended final size 192x128. A springy, bouncy cloud of dust: soft, round and fluffy, cream with lilac shading, a few sparkles.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Match the intended aspect ratio 192:128; preserve the requested side/front view.
```

#### `job-stopper.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-stopper.webp, intended final size 128x128. A small chinchilla paw held up, palm out, in a "stop" gesture.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-digger.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-digger.webp, intended final size 128x128. A little garden trowel pointing down into a mound of earth with an arrow-shaped divot.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-tunneller.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-tunneller.webp, intended final size 128x128. A tiny pickaxe beside a round tunnel opening.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-builder.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-builder.webp, intended final size 128x128. Three small hay bales stacked as stairs.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-climber.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-climber.webp, intended final size 128x128. A small rope with a grappling hook and a paw print.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-glider.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-glider.webp, intended final size 128x128. A fluffy chinchilla tail spread like a parachute.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-bouncer.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-bouncer.webp, intended final size 128x128. A small springy dust cloud with a curved bounce line above it.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

#### `job-hugger.webp` — prepared, unsubmitted

```text
Use case: illustration-story. Paint one Kit Parade game asset: job-hugger.webp, intended final size 128x128. Two little chinchilla arms in a hug around a pink heart.
Reference images: painting style only, not the subjects or composition.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers, watermark or writing anywhere.
Isolated single cutout on a perfectly flat uniform pure green #00ff00 chroma background, no gradient, no ground, no shadows on background, no ambient background color cast. Keep the entire subject inside the image, centered. Bold simple readable silhouette. Icon must read clearly at 28 pixels, single simple subject, padding around silhouette. Match the intended aspect ratio 128:128; preserve the requested side/front view.
```

