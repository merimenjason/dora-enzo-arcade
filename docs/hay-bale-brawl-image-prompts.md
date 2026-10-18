# Hay Bale Brawl · image prompts for ChatGPT

## Artwork delivery · 18-10-2026

All seven original PNGs are now generated under `public/art/brawl/`. Runtime integration is pending. Read [the integration instructions](hay-bale-brawl-integration.md) before wiring them into the game; [delivery notes](hay-bale-brawl-art.md), [measured crops](hay-bale-brawl-crops.json) and [exact generated/correction prompts and hashes](hay-bale-brawl-generation.json) accompany them. The original production brief below is preserved for future replacements.

Written 18-10-2026. A handoff for painting Hay Bale Brawl's art in ChatGPT. The game shipped fully code-drawn ([design](superpowers/specs/18-10-2026-hay-bale-brawl-design.md), [rules](hay-bale-brawl.md)), so every image below replaces one drawing on its own and the code keeps the drawing as the fallback. Generate in any order; the priority order gets the most out of each image.

## How to use this

1. Start a new ChatGPT conversation. Attach the style references:
   - `public/art/saga/heroes-0.png`, the arcade's painted storybook look;
   - `public/art/dora.jpeg` and `public/art/enzo.jpeg`, the real Dora and Enzo.
2. Paste the **Style block** once, then one prompt per message, in the priority order. Begin each message with "Generate the image:" so ChatGPT paints rather than discusses.
3. Ask for a **PNG with a transparent background** wherever a prompt says "transparent". Download the PNG; don't screenshot the preview.
4. Check each result against the **Acceptance checklist**. To fix one cell, use ChatGPT's select-and-edit tool on that cell and quote the failed check; to fix a whole sheet, ask for a repaint of that sheet only.
5. After about six images, or as soon as faces or colours start to drift, start a fresh conversation and attach the references again.
6. Save the files under the names given, into `public/art/brawl/`, and hand them back to Claude Code to wire in.

## Why the prompts are written this way

- Critters are drawn small: about 48 × 84 pixels in the shop and 40 × 88 in a fight, so silhouettes must read at 50 pixels tall.
- Your crew faces right and the rival crew is the same art mirrored, so every critter is painted facing right.
- Every critter fills about the same share of its cell, so the code can scale them all alike; rank shows through boldness and detail, not size.
- The stage is 3:2 (480 × 320), exactly ChatGPT's landscape size, 1536 × 1024, so a backdrop needs no cropping.
- The game prints every name, number and stat badge itself, so nothing may carry painted text.

## Style block (paste once, first)

> You are painting production art for Hay Bale Brawl, a cosy auto-battler. Two chinchilla coaches, Dora and Enzo, recruit crews of woodland critters who line up on a hay bale and bump into a rival crew until one side is knocked out. Nobody is hurt: critters are "knocked out" and tumble off the bale. Match the attached Whisker Saga sheet: soft, detailed gouache on cream paper, round cute bodies, thin dark-plum outlines, charming and never scary or bloody. Even the Bear, Boar and Hawk are cuddly, just bigger and bolder.
>
> There are two kinds of image:
> **Character and item sheets** are transparent cut-outs on a grid. Use bold, simple silhouettes that read at 50 pixels tall, saturated colour, an outline a little thicker than the Saga sheet, and even soft light from the upper left with no cast shadow. The background must be truly transparent (alpha zero), with no glow, haze, sparkle or ground shadow. Every subject sits wholly inside its own cell with at least 10% clear space on every side, standing near the cell's bottom and facing RIGHT in a three-quarter side view, as if marching toward an opponent on the right. Every critter's body fills about the same share of its cell, so a ladybird and a bear read at similar sizes. Size shows rank through boldness and detail, not through scale.
> **Backdrops** are full-bleed paintings at exactly 1536 × 1024. Keep the middle calm and slightly muted so small bright critters read on top. Put the detail at the edges. No characters unless asked.
>
> For every image: no text, letters, numbers, logos or symbols painted in; the game prints all words itself. No frames, borders, grid lines or labels.

**Character canon, every time they appear:**
- **Dora:** ivory-white chinchilla fur, very dark ruby-burgundy eyes (nearly black, never pink).
- **Enzo:** grey chinchilla fur, white chest, black eyes.
- **Pip:** a small young chinchilla with soft lavender-grey fur and black eyes, eager and wide-eyed.
- **The Duchess:** a regal chinchilla with honey-gold fur and a small gold crown with three points, chin up, gracious.

## Priority order

| # | Image | File | Shape |
| --- | --- | --- | --- |
| 1 | Critters, tiers 1–2 | `critters-1.png` | transparent, 4 × 3 |
| 2 | Critters, tiers 3–4 | `critters-2.png` | transparent, 4 × 3 |
| 3 | Critters, tier 5, summons, coaches, bale | `critters-3.png` | transparent, 4 × 3 |
| 4 | Snacks | `snacks.png` | transparent, 4 × 2 |
| 5 | Shop | `bg-shop.png` | backdrop, 1536 × 1024 |
| 6 | Fight | `bg-fight.png` | backdrop, 1536 × 1024 |
| 7 | Title | `title.png` | transparent, single |
| 8 | Effects (optional, added later) | `fx.png` | transparent, 4 × 3 |

The critters come first because the player watches them all the time; the backdrops can stay code-drawn the longest.

---

## 1 · `critters-1.png`

> Generate the image: a transparent character sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells, one critter per cell, all facing right, read left to right, top to bottom:
> 1 **Wren:** tiny round brown wren, cocked tail, cheerful.
> 2 **Field Mouse:** small tan mouse with big pink ears, long tail curled.
> 3 **Ladybird:** red ladybird with black spots, standing up on little legs like a mascot, tiny antennae.
> 4 **Toad:** warty olive-brown toad, wide grin, sturdy.
> 5 **Bee:** fuzzy yellow-and-black bumblebee, small wings, plucky.
> 6 **Dormouse:** golden-orange dormouse, very round, sleepy half-closed eyes, fluffy tail.
> 7 **Hedgehog:** brown hedgehog with a cream face, spines bristling, determined.
> 8 **Squirrel:** red squirrel with an enormous bushy tail and ear tufts, holding an acorn.
> 9 **Robin:** plump robin, bright orange-red breast, chest puffed out proudly.
> 10 **Mole:** velvety dark-grey mole, pink nose and big pink digging paws, squinting.
> 11 **Frog:** bright green frog, crouched to leap, big eyes.
> 12 **Pip** (see canon): small lavender-grey chinchilla, eager and bouncing.

## 2 · `critters-2.png`

> Generate the image: a transparent character sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells, one critter per cell, all facing right, read left to right, top to bottom:
> 1 **Badger:** black-and-white striped face, grey body, low and stocky, scrappy.
> 2 **Otter:** sleek brown otter with a cream chest, standing upright, playful.
> 3 **Magpie:** black-and-white magpie with iridescent blue-green wing and tail, holding a shiny coin with no markings.
> 4 **Rabbit:** soft brown rabbit with long upright ears and a white cotton tail, kind.
> 5 **Porcupine:** dark-brown porcupine with long cream-tipped quills fanned out.
> 6 **Beaver:** chunky brown beaver, flat paddle tail, big orange front teeth, carrying a stick.
> 7 **Stoat:** slim chestnut stoat with a cream belly and black tail tip, poised to pounce.
> 8 **Tortoise:** green-grey tortoise with a high domed patterned shell, steady and wise.
> 9 **Crow:** glossy black crow with a blue sheen, clever look.
> 10 **Skunk:** black skunk with a bold white stripe and huge fluffy tail raised, smug.
> 11 **Raccoon:** grey raccoon with a black bandit mask and ringed tail, sly grin.
> 12 **Hare:** tall lean brown hare, very long black-tipped ears, mid-sprint.

## 3 · `critters-3.png`

> Generate the image: a transparent character sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells, all subjects facing right, read left to right, top to bottom:
> 1 **Boar:** bristly dark-brown wild boar, small curved tusks, charging stance, fierce but cute.
> 2 **Bear:** big round brown bear, standing tall and protective, gentle face.
> 3 **Stag:** red deer stag with grand branching antlers, noble.
> 4 **The Duchess** (see canon): honey-gold chinchilla with a gold crown.
> 5 **Hawk:** brown hawk with a pale speckled chest and a hooked yellow beak, wings half spread.
> 6 **Goose:** white goose with an orange beak and feet, neck stretched out, honking bravely.
> 7 **Mouselet:** a tiny baby mouse, tan, oversized ears, wobbly.
> 8 **Log Dam:** a stack of three short logs bound with twigs and mud, a small beaver-built wall, no face.
> 9 **Fawn:** a spotted baby deer with long wobbly legs and big eyes.
> 10 **Dora** (see canon), as a coach: standing, cheering with one paw raised, a little whistle on a cord.
> 11 **Enzo** (see canon), as a coach: standing, arms folded, a confident grin, a little whistle on a cord.
> 12 **Hay bale:** a single round hay bale seen from the side, golden straw, two twine bands, no face.

## 4 · `snacks.png`

> Generate the image: a transparent item sheet, 1536 × 1024, a 4 × 2 grid of 8 equal cells, one snack per cell, each large and centred with clear space around it, read left to right, top to bottom:
> 1 **Apple:** a shiny red apple with one leaf.
> 2 **Raisin:** a small cluster of three plump dark raisins.
> 3 **Honey:** a small round clay honey pot with golden honey dripping over the lip, a wooden dipper.
> 4 **Hay Bundle:** a small bundle of golden hay tied with a twine bow.
> 5 **Mint Leaf:** a sprig of two bright green mint leaves.
> 6 **Chilli:** a glossy red chilli pepper with a green stem.
> 7 **Sunflower Seed:** one large striped sunflower seed.
> 8 **Acorn Cake:** a little round cake topped with an acorn and cream, on no plate.

## 5 · `bg-shop.png`

> Generate the image: a backdrop, 1536 × 1024. The inside of a cosy barn workshop at golden hour, seen straight on: wooden plank walls, hay stacked at the sides, a lantern and hanging tools at the edges, dusty light through a high window. The upper middle is a calm plank wall and the lower third a calm wooden floor, both low in detail, because cards and critters sit on top. No characters.

## 6 · `bg-fight.png`

> Generate the image: a backdrop, 1536 × 1024. A summer meadow at late afternoon, seen from the side: a long low line of hay bales runs straight across the whole width at about 60% of the height, its top making a flat stage. Rolling hills, a few trees and wildflowers at the far edges, a soft warm sky. Keep the band just above the bales calm and empty, because two crews of critters stand there. No characters.

## 7 · `title.png`

> Generate the image: a transparent title illustration, 1536 × 1024. Dora and Enzo (see canon) stand on top of a big round hay bale in the centre, Dora cheering and Enzo with arms folded, each with a whistle. Around the bale's foot stand a Badger, a Hedgehog, a Frog, a Bee and a Bear, ready for a brawl. Leave the top quarter empty for the game's own title text. No text.

## 8 · `fx.png` (optional)

**Delivery 18-10-2026:** `public/art/brawl/fx.png` is now generated and checked. [Effects artwork handoff](hay-bale-brawl-fx-art.md), [measured crops](hay-bale-brawl-fx-crops.json) and [exact prompts and provenance](hay-bale-brawl-fx-generation.json) accompany it. It was wired into the game the same day (PR #77). For this effects-only request, omit the critter pose/facing and backdrop instructions; use transparent centred effects, the existing painted style and the checks specific to `fx.png`.

Added 18-10-2026, after the game gained its fight and shop animations. The game already draws every one of these effects in code, so this sheet is polish: it repaints them in the storybook style and replaces the plain coloured status dots for Shell, Mint and Chilli. Painted attack or faint poses for each critter are deliberately not asked for: poses drift too much between generations for 33 critters to stay on-model across frames, so the code keeps moving the existing paintings instead. Attach the critter sheets as references so the outlines and the acorn match.

> Generate the image: a transparent effects sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells. One effect or icon per cell, each large and centred with clear space around it. They match the critter sheets' gouache style and thin dark-plum outlines. These are cartoon effects for a cosy game, never fiery, violent or scary. Read left to right, top to bottom:
> 1 **Bonk burst:** a chunky cartoon impact star, sunny yellow with an orange-red edge, eight uneven points, like a storybook "bonk".
> 2 **Dust puff:** a small soft cloud of cream-white dust, three or four round puffs, seen from the side as if kicked up by a landing.
> 3 **Poof cloud:** a bigger, rounder cloud of white puffs, like a critter tumbling out of sight, with a few loose wisps.
> 4 **Hay wisps:** five or six loose golden straws flying apart, as if knocked off a bale.
> 5 **Gold twinkle:** a four-pointed golden sparkle with a soft cream centre.
> 6 **Green twinkle:** the same four-pointed sparkle in fresh leaf green.
> 7 **Frost sparkle:** a small cluster of pale ice-blue snowflake glints, delicate.
> 8 **Crumbs:** a little scatter of cake and seed crumbs, warm browns and cream.
> 9 **Acorn:** one plump, shiny brown acorn with a textured darker cap and a tiny stalk, like a coin; match the Squirrel's acorn in the attached critter sheet.
> 10 **Honey shell:** a small round, glossy amber bubble of honey, like a protective shield, with a highlight.
> 11 **Mint charm:** a sprig of two bright mint leaves with a few cool pale-green glints.
> 12 **Chilli charm:** a small glossy red chilli with a little curl of warm orange heat above it, cute, not flames.
>
> No text, numbers or symbols. Truly transparent background: no glow, haze or shadow outside the subjects. Nothing touches the edge of its cell.

Wiring it in means measuring its 12 crops like the other sheets, adding it to the loader with its hash, and drawing each sprite where the scene now draws the burst, puffs, hay, twinkles, frost, crumbs, acorn and status dots, with those drawings kept as the fallback.

## Acceptance checklist

- Every critter faces right and stays wholly inside its own cell, with clear space around it.
- The background is truly transparent: no halo, glow or ground shadow.
- Nothing carries painted text, numbers or symbols.
- Dora's eyes are dark ruby, not pink; Enzo is grey with a white chest; the Duchess wears her crown.
- Tier-5 critters are bolder, not larger, than tier-1 ones.
- Each critter reads clearly when the sheet is shrunk so a cell is about 50 pixels tall.
- For `fx.png`: each item reads clearly when a cell is about 30 pixels tall, the two twinkles share one shape, and the acorn matches the one the Squirrel holds.
