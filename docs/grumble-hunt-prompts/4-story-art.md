Repo: dora-enzo-arcade. Run `git fetch origin`, then create branch `codex/grumble-hunt-story-art` from `origin/grumble-hunt-base`. Art only: don't write game code, and don't edit any file outside `public/art/hunt/` and `docs/grumble-hunt-story-art.md`. Don't touch the existing files in `public/art/hunt/`.

Context: read `docs/grumble-hunt/expansion-design.md` (the story, the villagers, the areas and the weapons) and `docs/grumble-hunt-art.md` (the first art pass), and look at `docs/grumble-hunt/screenshots/`. Match the first pass's style exactly: a warm, hand-painted toon storybook look like Monster Hunter Stories and Wind Waker, with chunky readable shapes, soft painted brushwork and saturated but gentle colours. Nothing is ever hurt. No text, logos or watermarks.

When Dora and Enzo appear, match `public/art/dora.jpeg`, `public/art/enzo.jpeg` and the screenshots:
- chibi chinchillas with huge round dish ears tilted outward;
- big glossy eyes with two highlights;
- long bushy tails, each one continuous plume, never segmented;
- Dora is cream white with pink ears and ruby eyes; Enzo is grey with a pale chest and black eyes.

Save every image as WebP (quality 85; keep alpha where it's asked for). Then write `docs/grumble-hunt-story-art.md` listing every file, its size and the exact prompt used, and check that each file decodes at its requested size.

A. Area textures. Seamless tiling on all four edges, seen straight from above, even flat lighting, 1024×1024:
1. `tex-marsh-mud.webp`: soft brown-green mud with moss patches.
2. `tex-ridge-slate.webp`: short wind-swept grass over grey-blue slate.
3. `tex-hollow-sand.webp`: warm ochre sand with small round pebbles.
4. `tex-peak-snow.webp`: soft blue-white snow with faint sparkles.
5. `tex-peak-ice.webp`: pale blue ice with soft cracks.

B. Area skies. Equirectangular 4096×2048, with the left and right edges joining seamlessly, distant scenery in the bottom 15%, and no sun disc:
6. `sky-marsh.webp`: an overcast lavender evening over misty wetlands.
7. `sky-ridge.webp`: a bright morning with fast streaky clouds over rocky ridges.
8. `sky-hollow.webp`: a warm canyon afternoon with ochre cliffs.
9. `sky-peak.webp`: a pale winter dusk over snowy mountains, with gentle snowfall.

C. Foliage and prop cards. Transparent background, base at the bottom edge, 512×512:
10. `card-reeds.webp`: a clump of marsh reeds and cattails.
11. `card-pine.webp`: one wind-bent pine crown, for billboard trees on the ridge.
12. `card-snowfir.webp`: one snowy fir crown.
13. `card-mushrooms.webp`: a cluster of chunky spotted toadstools, for marsh decoration.

D. Story panels. 1600×1000, full-bleed painted illustrations with no text. One panel per story beat, keeping the characters consistent across all of them:
14. `story-0a.webp`: a cosy chinchilla village at dawn, with a cold blue wind curling down from a distant snowy peak and villagers looking up, puzzled.
15. `story-0b.webp`: Old Mossback, a kindly old tortoise with a mossy shell and little round glasses, talking to Dora and Enzo.
16. `story-1.webp`: a huffy Bristleback in Clover Meadow, steam puffing from its nostrils, with Dora holding the Acorn Hammer and Enzo holding the Seed Bow.
17. `story-1-end.webp`: the Bristleback curled up napping under a tree, with Dora and Enzo tiptoeing past.
18. `story-2.webp`: the Puffwart in Soggy Marsh puffing a sleepy cloud, with Enzo yawning.
19. `story-3.webp`: the Skreel swooping over Windy Ridge, with Enzo sniffing a trail of glowing pawprints.
20. `story-4.webp`: the Hornclack in Pebble Hollow, with Dora peeking around its shell.
21. `story-5a.webp`: Frosty Peak, with the grand Frostmane in front of a shrine holding a cracked glowing crystal (the Glimmer Stone).
22. `story-5b.webp`: Bramble, a hedgehog smith in an apron, mending the Glimmer Stone while Frostmane naps and warm light spreads out.
23. `story-end.webp`: the whole village having a picnic in warm sunshine, with all five beasts napping peacefully around them.

E. Villager reference sheets. 2048×1024, plain light background, side, front and three-quarter views:
24. `ref-villagers.webp`, showing all four together at the same scale:
    - Old Mossback, a tortoise with round glasses and a walking stick;
    - Bramble, a hedgehog smith with an apron and a small hammer;
    - Pip, a degu cook with a little chef's scarf;
    - Wren, a small wren bird with a satchel of notes.

F. Villager portraits. Transparent background, 1024×1024: a 2×2 grid of head-and-shoulders portraits, each centred in a 512×512 cell with even padding: Mossback top left, Bramble top right, Pip bottom left, Wren bottom right.
25. `portraits-villagers.webp`.

G. Icons for the new weapons. Transparent background: a 4×4 grid of 256×256 cells, 1024×1024 overall. Use the same angle, lighting and thick dark-brown outline as `icons-gear.webp` if it exists. Fill left to right, top to bottom:
26. `icons-weapons-2.webp`, with these cells:
    - Thistle Lance with its Leaf Shield;
    - the same, upgraded;
    - the same, final;
    - Bubble Wand;
    - Bubble Wand, upgraded;
    - Bubble Wand, final;
    - Pinecone Yo-yo;
    - Pinecone Yo-yo, upgraded;
    - Pinecone Yo-yo, final;
    - Glimmer Hammer;
    - Glimmer Bow;
    - Glimmer Claws;
    - Glimmer Lance;
    - Glimmer Wand;
    - Glimmer Yo-yo;
    - the Glimmer Stone itself.

Commit with a short message and push `codex/grumble-hunt-story-art`. Don't open a pull request.
