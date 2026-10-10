# Moonpond — artwork

Moonpond's pictures are drawn in code today. The scene never draws a creature or a prop itself: it asks `lib/moonpond-art.ts` for one by name, with `creature(c, id, x, y, size, t, opts)` and `prop(c, key, x, y, size, t)`. That is the seam for a painted pass: paint two sheets, switch one flag, and nothing in the rules, the scene or the page changes.

## Switching to painted art

1. Put the two sheets below in `public/art/moonpond/`.
2. Set `PAINTED = true` in `lib/moonpond-art.ts`.
3. Run `node tests/e2e/moonpond.mjs` and look at the journal with every page sketched.

`loadPondArt()` already waits for the sheets before the title screen appears. If a sheet is missing it rejects, the page carries on, and each name falls back to its drawn version.

Painted cells are fitted inside the square asked for and centred, so leave transparent padding rather than cropping tight. Silhouettes (unfound journal pages and the shadows under the bobber) are made from the same cells by flattening them to one colour, so every cell needs a clean transparent background.

## `creatures.png`

8 columns by 5 rows, 256 × 256 px cells (2048 × 1280), RGBA. Cells follow journal order, left to right, top to bottom. Every creature faces **right**, seen from the side, except where noted.

| Row | Cells |
| --- | --- |
| 1 | Reed Skipper, Mud Puppy, Dusk Newt (from above), Rain Peeper, Cattail Crab (from above), Glass Shrimp, Lantern Snail, Lily Hopper |
| 2 | Pad Minnow, Whisker Loach, Clover Carp, Mist Darter, Firefly Guppy, Sleepy Terrapin (from above), Ripple Perch, Silverside |
| 3 | Pond Bream, Dust Skater (from above), Storm Pike, Star Sturgeon, Fog Ray (from above), Channel Chub, Deepwater Eel, Pebble Goby |
| 4 | Night Catfish, Glow Tetra, Thunder Gar, Velvet Crayfish (from above), Moth Fish, Pearl Mussel, Lost Button, Tiny Teacup |
| 5 | Message in a Bottle, Glass Marble, Brass Key, Sunken Bell, Ink Eel, Crescent Carp, Old Mossback (from above), Moon Koi |

Colours and markings for each are in `LOOKS` in `lib/moonpond-art.ts`; keep them, because the journal's clues describe them.

### Prompt

> A production sprite sheet for a cozy night-fishing game, 2048 × 1280 PNG with a fully transparent background. EIGHT equal columns and FIVE equal rows, forty isolated objects, one centred in each cell with generous transparent padding and nothing crossing a cell edge. Soft hand-painted storybook gouache with gentle dark outlines, lit as if by warm lantern light from the upper left, the same style and scale of detail in every cell. No text, no labels, no borders, no shadows on the ground, no water. Every creature is friendly, small-eyed and calm, facing RIGHT in side view unless marked (from above).
> Row 1: a small grey-green minnow; a brown tadpole with a round head and a long tail; an orange newt with dark spots (from above); a small bright green tree frog with a yellow eye-ring; a rust-coloured crab (from above); a nearly transparent shrimp with coral feelers; a pond snail with a softly glowing golden shell; a darker green spotted frog.
> Row 2: a pale silver-blue minnow; a long sandy loach with dark bands and whiskers; a deep-bodied moss-green carp with pale spots and whiskers; a slim silver-grey darter with one dark stripe; a small orange guppy with a tall fin and a warm yellow glow; a sleepy green terrapin (from above); a green perch with dark bars and red fins; a slim bright-silver fish with a grey stripe.
> Row 3: a very deep-bodied golden bream; a brown water strider on six long legs with tiny dimples under its feet (from above); a long olive pike with pale spots; a long slate-blue sturgeon with whiskers and tiny pale-gold star flecks; a grey-blue ray with pale spots and a thin tail (from above); a plain grey-green chub; a dark green eel in an S-curve; a mottled sandy goby.
> Row 4: a dark slate catfish with long whiskers; a small electric-blue tetra with a pale stripe, a pink fin and a cyan glow; a long narrow olive gar with yellow spots; a plum-purple crayfish (from above); a cream fish with brown speckles and a tall moth-wing fin; a dark blue-grey mussel just open on a glowing pearl; a round red four-hole coat button; a tiny white teacup with a blue rim and three pink dots.
> Row 5: a corked green glass bottle with a rolled paper note inside; a glass marble with pink and yellow swirls; a small brass key; a small weathered brass bell with flecks of green; a long ink-black eel with a violet glow; a pale ivory carp with a golden crescent on its side and a soft glow; an old dark-green turtle with moss on its shell (from above); a white koi with orange spots, an orange tail and a tall fin, softly glowing silver-blue.

## `props.png`

6 columns by 1 row, 256 × 256 px cells (1536 × 256), RGBA, in this order: `bobber`, `lily`, `lily-flower`, `reed`, `lantern`, `shell`.

### Prompt

> A production sprite sheet for a cozy night-fishing game, 1536 × 256 PNG with a fully transparent background. SIX equal columns in ONE row, six isolated objects, one centred in each cell with generous transparent padding. Soft hand-painted storybook gouache with gentle dark outlines, matching a moonlit pond. No text, no borders, no cast shadows.
> Left to right: a round fishing bobber, red on top and cream below, with a short pale stem; a single green lily pad seen at a low angle, with a notch; the same lily pad with one open pale-pink water lily on it; a clump of five green reeds with brown cattail heads; a small wood-and-brass lantern with a warm lit window and a carrying ring; a single pale lilac scallop shell, fan upward.

Two things stay drawn in code whatever the flag says, because they follow the game from frame to frame: the lantern's glow and flicker, and the whole pond (sky, moon phase, far bank, water, weather, dock, rod, line and gauge) in `lib/moonpond-scene.ts`. Dora and Enzo are the shared `drawChinchilla`.
