# Moonpond painted artwork · 11-10-2026

Mode: built-in imagegen. Approved reference: `public/art/moonpond/reference.png` (documentation only).

## Runtime assets

`environment.png` is an empty painted pond without a moon, creatures, dock or UI. Its source bank is mapped to the live horizon and water strips shimmer with scene time. `dock.png` is a separate transparent foreground. `heroes.png` holds the original Dora/Enzo seated reference poses. `fishing-heroes.png` supplies the inward-facing dock poses, and `portraits.png` supplies dedicated selection-button busts, with Dora’s dark ruby and Enzo’s black eyes. `props.png` has the original six props, three lures, the moon texture and decorative rope. Individual `umbrella.png` and `velvet-crayfish.png` preserve full canopy, pole, antennae and legs.

Five `creatures-0.png` through `creatures-4.png` packs hold eight entries each, in the same forty-entry order as `SPECIES`. Colours and markings follow `LOOKS` in `lib/moonpond-art.ts`. Measured rectangles in `lib/moonpond-crops.ts` are expanded before retaining each main connected alpha silhouette and adding padding. This removes neighbouring fragments and preserves complete outlines. Generated alpha is preserved; no image post-processing tools were used.

## Rendering and animation

The named `creature`/`prop` API and original drawn fallbacks remain in `lib/moonpond-art.ts`. `lib/moonpond-paint.ts` loads assets, prewarms cropped cells and exposes read-only crop QA through the browser test hook. Retry reloads only missing images and refreshes thumbnails. The moon mask/reflection, water, weather, rod, line, bobber, catch lift/release and celebrations stay live in `lib/moonpond-scene.ts`. The horizontal tension meter follows actual engine tension and line upgrades. No numerical state or controls are baked into artwork.

## Exact prompts

### Dedicated character portraits

Mode: built-in imagegen edit using `public/art/moonpond/heroes.png`. Output: `public/art/moonpond/portraits.png`, two transparent head-and-shoulder portraits in Dora/Enzo order. The original seated sprites are no longer cropped or stretched for the selection buttons. Generated source: `/Users/jasonchua/.codex/generated_images/01a11b2e-5086-7442-85fb-ba7476ca25b4/exec-32203e8b-36bc-4507-a537-488a591060ab.png`.

undefined

### Fishing poses correction

Mode: built-in imagegen edit, using `public/art/moonpond/heroes.png` as the reference. Original portraits remain on that sheet; the scene uses `public/art/moonpond/fishing-heroes.png` with the same Dora/Enzo row and angler/keeper column order. Generated source: `/Users/jasonchua/.codex/generated_images/01a11b2e-5086-7442-85fb-ba7476ca25b4/exec-d8900314-16cc-4e3b-b381-3012dfc11afc.png`.

Edit the reference character sheet into FOUR complete isolated chinchilla sprites, transparent background, a perfectly even 2 by 2 grid with generous empty gutters. Preserve detailed painted fur and warm lantern lighting, no clothes, no props, no text. Top row white Dora with very dark ruby red eyes; bottom row grey Enzo with black eyes. LEFT COLUMN: fishing pose seen from behind in a three-quarter rear view, body and head turned away from the viewer toward the UPPER RIGHT, looking out across the pond. Show the right-facing cheek and one eye subtly, round ears, fluffy curled tail, BOTH front paws raised forward on the RIGHT side of the body to grip a separately drawn fishing rod. RIGHT COLUMN: companion pose three-quarter rear view facing UPPER LEFT, looking into the pond and toward the angler, front paws held together on the LEFT side of body. Camera elevated slightly behind them. They must clearly face AWAY into the scene, not side-on facing the left screen edge as in the reference. All four seated full bodies, paws and tails completely contained within their own cells, same scale and foot baseline in each cell. No rod or lantern baked into image. Transparent background.

### environment

Output: `public/art/moonpond/environment.png`.

Use case: illustration-story. Production environment layer for Moonpond matching reference's rich painted night pond EXACTLY. Landscape 1536x1024. EMPTY SCENE ONLY: no chinchillas, dock, fishing rod, line, bobber, creatures, UI, text, moon, sun, stars, moon reflection or bright glowing patch. Top 30% plain smooth deep indigo twilight SKY reserved for live stars and moving moon. Detailed layered mountain ridge and willow forest far bank, shoreline at exactly 36% image height. Below that is calm deep teal-blue pond filling bottom64%, finely painted gentle low-contrast wave textures but no fixed light reflection. Lush weeping willow framing hangs only along extreme left/right edges, distant tiny wooden cottage lights at far bank. Fine cattail reeds confined to far SIDE edges, central 70% water stays clean unobstructed for fishing. No foreground platform, dock, bridges or boats. Atmosphere still neutral moonlit blue, live code adds dawn/dusk weather light. Hand-painted luminous storybook water, foliage, mountains and fine detail as approved screenshot. Single opaque background with no text, borders or interface.

### dock

Output: `public/art/moonpond/dock.png`.

Use case: illustration-story. Production transparent foreground DOCK layer matching Moonpond reference. Landscape 1536x1024 transparent canvas. ONLY weathered timber dock extending from center bottom foreground into pond in perspective. At top edge of DOCK at 65% canvas height, dock width about35% canvas; by bottom edge dock width65% canvas. Top deck platform clear and flat, warm honey wood but no baked lightpool. Posts and rope rails run along sides, little empty wooden tackle box tied near right railing. Clear central dry deck for two chinchillas and lantern added by code. Dock ABOVE water but render no water: everything outside the dock is genuinely transparent, especially upper60% canvas. Fine wood grain, moss specks on outer posts, beautifully painted dimensional perspective match source. NO animals, lantern, fish, fishing rod, line, moon, sky, land, water, UI, text, cast shadows outside dock. Entire dock artwork inside canvas except intentional bottom edge where dock continues into foreground.

### heroes

Output: `public/art/moonpond/heroes.png`.

Use case: illustration-story. Production transparent character pose atlas for Moonpond, EXACT same Dora and Enzo as reference. Exactly TWO columns TWO rows, four isolated full-body SEATED chinchillas, each in equal square cell with at least15% transparent margin on every side, ears paws and curled fluffy tails all wholly visible. All face LEFT in three-quarter view. ROW1: Dora WHITE fine fluffy fur and DARK RUBY RED iris #8e1f33 with nearly-black pupils; left cell angler seated with BOTH front paws held forward LEFT ready to hold a rod added by code; right cell same Dora seated lantern keeper with paws together slightly forward. ROW2: Enzo GRAY fine fluffy fur, BLACK eyes; left cell angler with paws forward LEFT; right cell same Enzo lantern keeper. No actual rod, lantern, objects, clothes, ground, water, shadows, UI or text. Dry healthy fur, short snout, large round ears, fine whiskers and curled bushy tail, NOT mice or rabbits. Same pose scale and exact same identity for each animal across poses. Warm neutral lantern light upperleft, refined painted natural storybook fur, same character appeal and realism as source scene. Keep 15% alpha gutters, no sprite crosses cells.

### props

Output: `public/art/moonpond/props.png`.

Use case: illustration-story. Production transparent prop atlas for Moonpond matching reference painted artwork. PORTRAIT1024x1360, exactly THREE columns FOUR rows, 12 isolated props in equal cells, at least18% transparent margin ALL sides, no crop/overlap. No text, labels, borders, shadows or backgrounds. Exact order row-major ROW1 red-and-cream fishing bobber with little pale stem; green notched lily pad seen low overhead; same pad with pale pink open water lily. ROW2 clump of5green reeds and brown cattail heads; wood/brass lantern with amber lit glass and ring (no surrounding glow, code adds); lilac scallop moon shell fan upward. ROW3 tiny glowing green bead lure with bronze hook; clover-leaf knot lure with bronze hook; small soft pale bathing-dust puff lure with bronze hook (no water). ROW4 full round ivory MOON disc with soft detailed craters and no glow, face on; coiled rustic dock rope; deep indigo canvas fishing UMBRELLA canopy on wooden pole, fully open side view (no characters under it). Every silhouette complete and clean alpha, hand painted detail consistent with approved mock-up.

### creatures-0

Output: `public/art/moonpond/creatures-0.png`.

Use case: illustration-story. Production Moonpond creature atlas matching reference's journal card art, BUT no cards or UI. Landscape1536x768, FOUR columns TWO rows, eight isolated creatures/curios on genuinely TRANSPARENT alpha background. Each cell equal SQUARE, every complete silhouette centered with at least20% transparent margin on EVERY side. Each object occupies no more than60% of cell width/height so tails, fins, legs, feelers and whiskers NEVER cross cells. No text, labels, outlines around cells, borders, water, ground or shadows. Refined hand-painted storybook gouache with natural scales/feathers/fur, soft dark contour, neutral warm upperleft light; calm small eyes, no caricature human faces. All aquatic creatures face RIGHT side view unless explicitly ABOVE. Keep exact colors/markings and count. Exact row-major order LEFT to RIGHT: ROW1 small gray-green minnow; brown tadpole round head long tail; orange newt with dark spots seen ABOVE; small bright green tree frog yellow eye-ring; ROW2 rust-colored crab seen ABOVE; nearly transparent shrimp coral feelers; pond snail softly golden shell; darker green spotted frog. All eight complete objects equally detailed, any glow confined to the object's body with alpha outside. Do not add any extra object or replace any species.

### creatures-1

Output: `public/art/moonpond/creatures-1.png`.

Use case: illustration-story. Production Moonpond creature atlas matching reference's journal card art, BUT no cards or UI. Landscape1536x768, FOUR columns TWO rows, eight isolated creatures/curios on genuinely TRANSPARENT alpha background. Each cell equal SQUARE, every complete silhouette centered with at least20% transparent margin on EVERY side. Each object occupies no more than60% of cell width/height so tails, fins, legs, feelers and whiskers NEVER cross cells. No text, labels, outlines around cells, borders, water, ground or shadows. Refined hand-painted storybook gouache with natural scales/feathers/fur, soft dark contour, neutral warm upperleft light; calm small eyes, no caricature human faces. All aquatic creatures face RIGHT side view unless explicitly ABOVE. Keep exact colors/markings and count. Exact row-major order LEFT to RIGHT: ROW1 pale silver-blue minnow; long sandy loach with dark bands and whiskers; deep-bodied moss-green carp pale green spots whiskers; slim silver-gray darter one dark stripe; ROW2 small orange guppy tall fin yellow glow; sleepy green terrapin seen ABOVE; green perch dark bars and red fins; slim bright-silver fish gray stripe. All eight complete objects equally detailed, any glow confined to the object's body with alpha outside. Do not add any extra object or replace any species.

### creatures-2

Output: `public/art/moonpond/creatures-2.png`.

Use case: illustration-story. Production Moonpond creature atlas matching reference's journal card art, BUT no cards or UI. Landscape1536x768, FOUR columns TWO rows, eight isolated creatures/curios on genuinely TRANSPARENT alpha background. Each cell equal SQUARE, every complete silhouette centered with at least20% transparent margin on EVERY side. Each object occupies no more than60% of cell width/height so tails, fins, legs, feelers and whiskers NEVER cross cells. No text, labels, outlines around cells, borders, water, ground or shadows. Refined hand-painted storybook gouache with natural scales/feathers/fur, soft dark contour, neutral warm upperleft light; calm small eyes, no caricature human faces. All aquatic creatures face RIGHT side view unless explicitly ABOVE. Keep exact colors/markings and count. Exact row-major order LEFT to RIGHT: ROW1 very deep-bodied golden bream; brown water strider six long legs seen ABOVE, no water dimples; long olive pike pale spots; long slate-blue sturgeon whiskers tiny pale-gold star flecks; ROW2 gray-blue ray pale spots thin tail seen ABOVE; plain gray-green chub; dark green eel in S-curve; mottled sandy goby. All eight complete objects equally detailed, any glow confined to the object's body with alpha outside. Do not add any extra object or replace any species.

### creatures-3

Output: `public/art/moonpond/creatures-3.png`.

Use case: illustration-story. Production Moonpond creature atlas matching reference's journal card art, BUT no cards or UI. Landscape1536x768, FOUR columns TWO rows, eight isolated creatures/curios on genuinely TRANSPARENT alpha background. Each cell equal SQUARE, every complete silhouette centered with at least20% transparent margin on EVERY side. Each object occupies no more than60% of cell width/height so tails, fins, legs, feelers and whiskers NEVER cross cells. No text, labels, outlines around cells, borders, water, ground or shadows. Refined hand-painted storybook gouache with natural scales/feathers/fur, soft dark contour, neutral warm upperleft light; calm small eyes, no caricature human faces. All aquatic creatures face RIGHT side view unless explicitly ABOVE. Keep exact colors/markings and count. Exact row-major order LEFT to RIGHT: ROW1 dark slate catfish long whiskers; small electric-blue tetra pale stripe PINK fin cyan glow; long narrow olive gar yellow spots; plum-purple crayfish seen ABOVE; ROW2 cream fish brown speckles tall moth-wing fin; dark blue-gray mussel slightly open on glowing pearl; round red FOUR-hole coat button; tiny white teacup BLUE rim THREE pink dots. All eight complete objects equally detailed, any glow confined to the object's body with alpha outside. Do not add any extra object or replace any species.

### creatures-4

Output: `public/art/moonpond/creatures-4.png`.

Use case: illustration-story. Production Moonpond creature atlas matching reference's journal card art, BUT no cards or UI. Landscape1536x768, FOUR columns TWO rows, eight isolated creatures/curios on genuinely TRANSPARENT alpha background. Each cell equal SQUARE, every complete silhouette centered with at least20% transparent margin on EVERY side. Each object occupies no more than60% of cell width/height so tails, fins, legs, feelers and whiskers NEVER cross cells. No text, labels, outlines around cells, borders, water, ground or shadows. Refined hand-painted storybook gouache with natural scales/feathers/fur, soft dark contour, neutral warm upperleft light; calm small eyes, no caricature human faces. All aquatic creatures face RIGHT side view unless explicitly ABOVE. Keep exact colors/markings and count. Exact row-major order LEFT to RIGHT: ROW1 corked GREEN glass bottle rolled paper note inside; glass marble PINK and YELLOW swirls; small BRASS key; small weathered BRASS bell green patina specks; ROW2 long INK-BLACK eel violet gleam; pale IVORY carp GOLD crescent marking; old DARK GREEN turtle mossy shell seen ABOVE; WHITE koi ORANGE spots ORANGE tail TALL fin, silver-blue gleam. All eight complete objects equally detailed, any glow confined to the object's body with alpha outside. Do not add any extra object or replace any species.

### Isolated Velvet Crayfish

Output: `public/art/moonpond/velvet-crayfish.png`.

Production transparent standalone VELVET CRAYFISH sprite for Moonpond, matching reference's hand-painted creature style and plum-purple crayfish. ONE animal seen directly from ABOVE, entire body, both claws, all legs, BOTH long antennae/feelers and tail fan fully visible with at least15% TRANSPARENT padding on ALL four sides. Place complete silhouette inside central65% of square1024x1024 canvas; shrink body if needed to preserve antennae. Deep plum/purple shell with muted lighter violet highlights, fine dark outlines, calm natural small eyes, rich painted texture, no clothes, no text, no grid, no water/ground/shadow/props. No clipped feelers or limbs. Exact species identity; matching cozy painted pond journal. Genuine alpha background.

### Isolated umbrella

Output: `public/art/moonpond/umbrella.png`.

Production transparent standalone fishing UMBRELLA for Moonpond matching the reference's deep indigo canvas umbrella in its lower-right cell. ONE open cloth canopy on a straight wooden pole, warm brass finial and spokes, side view. Full canopy tips and FULL pole end must be wholly visible, centered inside square1024x1024 canvas with at least15% genuinely TRANSPARENT margin on EVERY side. No people, ground, water, props, labels, shadows or surrounding scene. Refined hand-painted storybook detail, fine dark outlines, indigo waterproof cloth. Reduce size to show full outline without any cropped edges. This is a separate sprite for a dry fishing dock shelter, not a UI image.
