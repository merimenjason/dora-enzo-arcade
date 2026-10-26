Repo: dora-enzo-arcade, worktree `.worktrees/putt` (branch `claude/puttering-paws`). Art only: don't write game code, don't run git commands that change history (no commit, no checkout, no stash), and don't edit any file outside `public/art/putt/` and `docs/puttering-paws-art.md`. Another agent is writing the game code in this same worktree at the same time, so leave every other file alone.

Context: Puttering Paws is a new 3D (Three.js) storybook mini-golf game for the Dora & Enzo arcade, starring two real pet chinchillas: Dora (white) and Enzo (grey). It must match Grumble Hunt's art exactly: a warm, hand-painted toon storybook look with soft cel shading, gentle ink edges and saturated but soft colours. Look at these first and match their style, palette and brush feel: `public/art/hunt/sky-meadow.webp`, `public/art/hunt/tex-meadow-grass.webp`, `public/art/hunt/story-1.webp`, `public/art/hunt/story-6.webp`, `public/art/hunt/card-mushrooms.webp`, `public/art/hunt/portraits-dora.webp` and `public/art/hunt/portraits-enzo.webp`.

When Dora and Enzo appear, match `public/art/dora.jpeg`, `public/art/enzo.jpeg` and the Grumble Hunt story panels:
- chibi chinchillas with huge round dish ears tilted outward;
- big glossy eyes with two highlights;
- long bushy tails, each one continuous plume, never segmented;
- Dora is cream white with pink ears and ruby eyes; Enzo is grey with a pale chest and black eyes.
The game's mini-golf course is built from bright green felt fairways edged with chunky painted wooden rails (honey-coloured wood), with ramps, a little hay-thatched windmill, burrow tunnels, pale dust-bath sand traps, ponds, red-and-white spotted mushroom bumpers, and a cup with a little flag. Kind and cosy, never scary.

Save every image as WebP (quality 85; keep alpha where it's asked for) at the path given. Then write `docs/puttering-paws-art.md` listing every file, its size and the exact prompt used, and check that each file decodes at its requested size.

A. Paintings. 1600×1000, full-bleed, no text, no letters, no logos:
1. `public/art/putt/title.webp`: Dora crouched over a tiny wooden putter, lining up a putt on a sunny storybook mini-golf green in a clover meadow; Enzo beside the cup holding the little flag and cheering; a hay-thatched windmill, a wooden ramp and a mushroom bumper in the background; morning light. Leave calm space in the left third for a title to sit on top.
2. `public/art/putt/lantern.webp`: the same mini-golf course at warm dusk, strung with glowing paper lanterns, fireflies, a peach-to-violet sky with the first stars, Dora and Enzo walking side by side carrying their putters toward a hole lit by a lantern. Leave calm space in the left third.
3. `public/art/putt/trophy.webp`: a celebration on the last green under lanterns: Dora and Enzo hugging and holding up a small golden acorn trophy, confetti of clover leaves, both chinchillas beaming.

B. Sky. Equirectangular 4096×2048, the left and right edges joining seamlessly, distant scenery in the bottom 15%, no sun disc:
4. `public/art/putt/sky-lantern.webp`: a warm dusk sky, peach at the horizon rising to soft violet and deep blue at the top, a few lavender cel-shaded clouds, the first few stars, distant rolling hills with a few tiny warm lantern lights.

C. Textures. Seamless tiling on all four edges, seen straight from above, even flat lighting, no strong features that would show as an obvious repeat, 1024×1024:
5. `public/art/putt/tex-felt.webp`: putting-green felt, fine soft fibres, a fresh mid green, very subtle mottling. It will be tinted in-game, so keep it fairly even in brightness.
6. `public/art/putt/tex-wood.webp`: painted honey-coloured wooden planks running horizontally, soft grain, a few tiny knots, storybook style.
7. `public/art/putt/tex-dust.webp`: fine pale cream bathing dust, like chinchilla dust-bath sand, with tiny soft ripples and a few paw-dimples.
8. `public/art/putt/tex-water.webp`: a shallow storybook pond surface, soft teal with gentle painted ripples and light glints.

D. Cards. Transparent background, base at the bottom edge, 512×512:
9. `public/art/putt/card-tree.webp`: one round, puffy leafy tree crown with a short trunk, for billboard trees around the course.
10. `public/art/putt/card-flowers.webp`: a clump of meadow flowers (clover, daisies, little pink blooms) with leaves.
11. `public/art/putt/card-lantern-tree.webp`: one round tree crown at dusk, darker green-violet, with two small glowing paper lanterns hanging from it.

Stop when the files and the doc are written. Don't open a pull request.
