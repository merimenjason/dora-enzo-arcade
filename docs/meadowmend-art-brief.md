# Meadowmend · art brief

Paintings for Meadowmend (`/meadow`), a cosy hex tile-laying valley builder. Winter is over and the valley below the burrow is patchy and bare; Dora and Enzo mend it one hexagonal tile of meadow, woods, burrow-hill or stream at a time, while the valley's neighbours (a hedgehog, a duck, a bee and a rabbit) make little wishes. The game draws the hex tiles, the critters and the wish flags itself, and draws its own stand-in for every image until the file loads, so the images can arrive in any order. Written 30-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, fresh spring colours (new green grass, wildflowers, soft blue water, birch and pine woods, sandy burrow-hills), matching how Dora and Enzo look in `public/art/driftwood/title.webp` and `public/art/roll/title.webp`. **Their heads (critical):** copy the heads in those two paintings: a broad, slightly flat crown with a soft edge of short dense fur, NO spiky tufts, cowlicks or forelocks anywhere on the head, and clean pink ear insides with NO fluffy ear tufts. Never use the Hayloft Tycoon portraits as a reference (they have these tufts). No text, letters, numbers or logos. **Dora** is a small cream-white chinchilla with pink ears and ruby-red eyes. **Enzo** is a bigger cool blue-grey chinchilla with a darker wavy back, a pale chest and solid black eyes (never taupe, beige or brown). Neither wears clothes. Export as `.webp` (quality about 88). All files live in `public/art/meadow/`.

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | Early spring morning above a little valley that is half mended: in the background a patchwork of green meadows, birch woods, sandy burrow-hills and a winding blue stream, laid out in soft hexagonal patches like a quilt, with bare brown winter ground still showing at the edges. In the foreground, on a grassy rise, Dora is setting down a hexagonal piece of fresh meadow turf (flowers sprouting from it) while Enzo carries another hexagonal piece with a tiny stream running across it. A hedgehog, a duck and a bee watch happily. Keep the lower third calmer (gentle grass) for text. |
| `ending.webp` | The valley fully mended at golden sunset: Dora and Enzo sit side by side on the bank of a round pond, a line of ducklings paddling past, fireflies starting to glow, meadows full of wildflowers, woods and burrow-hills behind them, the hedgehog, duck, bee and rabbit nearby. Warm, content, peaceful. |

## Dora and Enzo (transparent, 1024 × 1024, side-on three-quarter view, facing **right**, the whole body in frame, feet near the bottom centre)

Six poses, three each, all drawn at the same scale for each chinchilla so the game can swap them without a jump: Dora's files are `dora-<pose>.webp`, Enzo's `enzo-<pose>.webp`. A truly transparent background (alpha), no ground, no shadow, no props, clean outlines.

| Pose | Description |
| --- | --- |
| `walk` | A happy trotting walk to the right on all fours, one front paw lifted, tail curled up behind. |
| `sit` | Sitting up on the hind legs, front paws held together at the chest, content and relaxed, looking slightly towards the viewer. |
| `cheer` | Sitting up on the hind legs, both forepaws raised high in a happy cheer, eyes shut with joy. |

## In the game

After painting, the poses are trimmed and rescaled with Pillow onto 768 × 512 canvases: Enzo's sit figure is 360 pixels tall and Dora's 320, every pose of a chinchilla uses that chinchilla's sit scale, and all of them stand on a line 16 pixels above the bottom edge. A pose that fails to load borrows the nearest painted pose (`sit` for `cheer`, `sit` for `walk`), and the shared drawn chinchillas stand in until any painting arrives.
