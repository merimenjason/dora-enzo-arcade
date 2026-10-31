# Cubby Valley · art brief

Paintings for Cubby Valley (`/cubby`), a cosy block-building sandbox. Dora and Enzo arrive in a green valley made of blocks and build it into a home that six animal neighbours want to move into; when all six live there, the valley holds its summer fair. The game builds its world, Dora, Enzo and the neighbours out of little cubes in Three.js and draws its own voxel stand-in for every painting until the file loads, so the paintings are optional and can arrive in any order. Written 01-11-2026.

**A new art style for this game: voxel diorama.** Every painting looks like a tiny hand-painted wooden toy diorama built from small cubes: chunky blocky shapes, soft warm ambient-occlusion shading in every crease, gentle tilt-shift depth of field, a warm low-poly palette (meadow green, birch white, chalk cream, river blue, honey gold, rose), sunny soft light. Everything is made of cubes and looks like painted wooden blocks. No text, letters, numbers or logos; no photo look; no characters or blocks from any existing video game.

**Dora and Enzo in this style (critical):** both are small chinchillas built from little cubes, like wooden block toys, cute and rounded in silhouette. **Dora** is cream-white with ruby-red eyes and clean pink ears. **Enzo** is a little bigger, cool blue-grey (never taupe, beige or brown) with a pale grey chest and solid black eyes, and clean pink ears. Their heads have a broad, slightly flat, smooth rounded crown with a soft short-fur edge; nothing is on top of the head except the two round ears (compare the head shape in `public/art/driftwood/title.webp` and `public/art/roll/title.webp`; never the Hayloft Tycoon portraits). Neither wears clothes.

The neighbours, all voxel toys too: Hazel the hedgehog baker, Morrow the mole miner, Ottoline the owl librarian, Bramble the rabbit gardener, Fennel the fox musician and Barnaby the badger smith.

All files live in `public/art/cubby/` as `.webp` (quality about 88).

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | A voxel diorama of Cubby Valley in morning sun: a block meadow, white birch trees, a pebble river, chalk cliffs. Dora and Enzo stand in the left-centre on the grass beside a half-built little cube house, facing the viewer. The right third is calm open sky and meadow for the title card. |
| `ending.webp` | The summer fair in the valley at golden evening: bunting between birch trees, little stalls, lanterns; Dora and Enzo in the middle with all six neighbours round them, everyone happy, fireflies starting to glow. |

## The game's own drawing

Everything else is drawn in code: the block textures are painted into a small atlas at load, and Dora, Enzo, the neighbours, the dust-bunnies and every prop are voxel models (a palette and a list of cubes) meshed like the world, with soft corner shading. Dora and Enzo bob as they walk, wiggle their ears and sway their tails.
