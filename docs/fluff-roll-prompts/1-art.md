Repo: dora-enzo-arcade, worktree `.worktrees/roll` (branch `claude/fluff-roll-full`). This is art only. Don't write game code. Don't run git commands that change history (no commit, no checkout, no stash). Don't edit any file outside `public/art/roll/` and `docs/fluff-roll-art.md`. Another agent is writing the game code in this same worktree at the same time, so leave every other file alone.

Context: Fluff Roll is a 3D (Three.js) storybook rolling game in the Dora & Enzo arcade. It stars two real pet chinchillas: Dora (white) and Enzo (grey). Dora pushes a big fluffy dust ball across a meadow, and Enzo rides on top of it. Everything smaller than the ball sticks to it, so the ball grows from a crumb collector into a ball as big as a barn, covered in rolled-up things: buttons, acorns, teacups, socks, carrots, apples, pumpkins, hay bales, and later sheds and windmills.

It must match Grumble Hunt's art exactly: a warm, hand-painted toon storybook look with soft cel shading, gentle ink edges, and saturated but soft colours. Look at these first and match their style, palette and brush feel: `public/art/hunt/sky-meadow.webp`, `public/art/hunt/story-1.webp`, `public/art/hunt/story-6.webp`, `public/art/hunt/portraits-dora.webp` and `public/art/hunt/portraits-enzo.webp`.

When Dora and Enzo appear, match `public/art/dora.jpeg`, `public/art/enzo.jpeg` and the Grumble Hunt story panels:
- chibi chinchillas with huge round dish ears that tilt outward;
- big glossy eyes with two highlights;
- long bushy tails, each one a single continuous plume, never segmented;
- Dora is cream white with pink ears and ruby eyes;
- Enzo is grey with a pale chest and black eyes.

The tone is kind and cosy, never scary. Everything rolled up looks happy to ride along.

Save every image as WebP (quality 85) at the path given. Every image is full-bleed, with no text, no letters and no logos. Make each image in its own separate step, one at a time. If one fails, retry it once and move on.

Then write `docs/fluff-roll-art.md`. List every file, its size and the exact prompt used, and check that each file decodes at its requested size.

1. `public/art/roll/title.webp` (1600×1000): Dora, seen from behind and to the side, pushing a huge round fluffy cream dust ball across a sunny clover meadow. The ball is studded with buttons, acorns, a teacup, a sock, a carrot and daisies. Enzo stands on top of the ball with his arms up, cheering. Morning light, with a few small things on the grass ahead, waiting to be rolled up. Leave calm sky in the left third for a title.
2. `public/art/roll/level-corner.webp` (1200×750): a close-up storybook scene by a chinchilla dust-bath tub. Seeds, oat crumbs, clover leaves, buttons, blueberries and acorns are scattered on the ground, with a tiny new dust ball no bigger than a walnut. A ladybird sits on a clover leaf.
3. `public/art/roll/level-garden.webp` (1200×750): a cottage clover garden with apples, flower pots, cabbages, a watering can, sunflowers, a golf flag and a sleepy hedgehog curled up. A medium dust ball, studded with apples and socks, rolls in from one side.
4. `public/art/roll/level-yard.webp` (1200×750): a sunny farm yard with hay bales, a wheelbarrow, a rain barrel, a garden shed, a haystack and ducks walking by. The dust ball is now as tall as a chinchilla door, studded with pumpkins and hay bales.
5. `public/art/roll/level-meadow.webp` (1200×750): a wide rolling meadow seen from high up, with windmills, a big red barn, a silo, old oaks and grassy hills. A gigantic dust ball rolls across it, covered in sheds, haystacks and trees, with tiny Dora pushing and tiny Enzo waving from the top.

Stop when the files and the doc are written. Don't open a pull request.
