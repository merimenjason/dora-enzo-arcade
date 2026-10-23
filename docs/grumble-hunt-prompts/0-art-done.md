Repo: dora-enzo-arcade. Work on a new branch `codex/grumble-hunt-art`. Art only: do not write game code or edit any file outside `public/art/hunt/` and `docs/grumble-hunt-art.md`.

Context: Grumble Hunt is a new 3D (Three.js) Monster Hunter-style game for kids starring two real pet chinchillas: Dora (white) and Enzo (grey). Grumpy beasts are bonked until they curl up for a nap; nothing is ever hurt, and there is no blood or scary imagery. The game renders in a toon "storybook" style: flat three-band cel shading, thin dark-brown ink outlines, chunky rounded shapes, saturated but gentle colours, in the spirit of Monster Hunter Stories and Wind Waker. Every image must match that style: clean cel-shaded colour areas with a soft painted touch, no photo-realism, no text, no logos, no watermarks.

Make these images. Save each as WebP (quality 85) at the path given, then write `docs/grumble-hunt-art.md` listing every file, its size, and the prompt you used.

A. Dora and Enzo. Look at the real photos `public/art/dora.jpeg` and `public/art/enzo.jpeg` first and keep each chinchilla recognisable: the colours, ear shape, eye colour and tail must match. Chibi proportions: the head is nearly as big as the round, pear-shaped body; huge round dish-shaped ears that tilt outward; big glossy eyes with two white highlights; tiny pink nose; a small "w" mouth; short whiskers; little pink paws; a long bushy tail that curls up over the back. The tail is one continuous soft plume: thin at the base, fullest past the middle, tapering to a soft tip, with a gently tufted outline. It must not look segmented, ringed, beaded or built from separate balls.
- Dora: soft cream-white all over, pale pink ears with pinker insides, ruby-red eyes, pink nose and paws, white tail.
- Enzo: standard chinchilla grey, a darker grey saddle on the back fading to a near-white belly and chest, grey ears with mauve-pink insides, black eyes, a dark nose, a grey tail that darkens smoothly (no bands) to a sooty tip.
1. `public/art/hunt/ref-dora.webp`, 2048×1024: modelling turnaround on a plain light background. Dora standing on all fours in side view, front view, three-quarter front view and back view, all at the same scale, evenly spaced, with even lighting.
2. `public/art/hunt/ref-enzo.webp`, 2048×1024: the same turnaround for Enzo.
3. `public/art/hunt/portraits-dora.webp`, 1024×1024, transparent background: a 2×2 grid of head-and-shoulders portraits, each centred in its own 512×512 cell with even padding and the same framing: top-left happy, top-right determined (holding a little acorn hammer over her shoulder), bottom-left dizzy (swirly eyes, little stars), bottom-right sleepy and content (eyes closed, smiling).
4. `public/art/hunt/portraits-enzo.webp`, 1024×1024, transparent background: the same 2×2 grid for Enzo, with the determined cell holding a small berry pouch instead of a hammer.

B. Sky:
5. `public/art/hunt/sky-meadow.webp`, 4096×2048 equirectangular panorama (the left and right edges must join seamlessly): late-afternoon sky, soft blue fading to warm cream at the horizon, big round cel-shaded cumulus clouds with soft ink edges, distant rolling green hills along the bottom 15%. No sun disc.

C. Beast reference sheets (plain light background; same toon style; each sheet shows the beast in side view, front view and three-quarter view, all at the same scale, no text). These are modelling references, so keep the shapes clear and simple:
6. `public/art/hunt/ref-bristleback.webp`, 2048×1024: a huffy, round-bodied boar with a big hunched back, a crest of dark bristle spikes along the spine, short curved ivory tusks, a pink snout, small grumpy eyes under heavy brows, stubby legs. Grumpy, never scary.
7. `public/art/hunt/ref-puffwart.webp`, 2048×1024: a chubby marsh toad, olive green with a pale belly, round warts on the back, a big throat sac that puffs up, sleepy half-closed eyes.
8. `public/art/hunt/ref-skreel.webp`, 2048×1024: a sulky round sky-owl, slate-blue feathers, broad wings, a short tail fan, a small yellow beak, a frowning brow.
9. `public/art/hunt/ref-hornclack.webp`, 2048×1024: a stubborn rhino-beetle, a domed slate shell made of plates, one big sand-coloured horn, six stubby legs.
10. `public/art/hunt/ref-frostmane.webp`, 2048×1024: a grumpy snow lynx with a big icy-blue mane, tufted ears, a fluffy tail, pale white-blue fur. It is the final beast: grand but still cute.

Do not commit anything outside `public/art/hunt/` and `docs/grumble-hunt-art.md`. Commit with a short message and stop. Don't open a pull request.
