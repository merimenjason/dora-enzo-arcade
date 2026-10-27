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
