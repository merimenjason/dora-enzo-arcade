# Whisker Ware · image prompts for ChatGPT

Written 17-10-2026. A handoff for painting Whisker Ware's art in ChatGPT. The game is built fully code-drawn first ([design](superpowers/specs/17-10-2026-whisker-ware-design.md)), so every image below replaces one drawing on its own and the code keeps the drawing as the fallback. Nothing here blocks the build: generate in any order, but the priority order gets the most out of each image.

## How to use this

1. Start a new ChatGPT conversation. Attach the style references:
   - `public/art/saga/heroes-0.png`, the arcade's painted storybook look;
   - `public/art/dora.jpeg` and `public/art/enzo.jpeg`, the real Dora and Enzo;
   - `public/art/acorn-hand/rivals-0.png`, where the Owl and the Fox come from (top row, second and first cells).
2. Paste the **Style block** once, then one prompt per message, in the priority order. Begin each message with "Generate the image:" so ChatGPT paints rather than discusses.
3. Ask for a **PNG with a transparent background** wherever a prompt says "transparent". Download the PNG; don't screenshot the preview.
4. Check each result against the **Acceptance checklist**. To fix one cell, use ChatGPT's select-and-edit tool on that cell and quote the failed check; to fix a whole sheet, ask for a repaint of that sheet only.
5. After about eight images, or as soon as faces or colours start to drift, start a fresh conversation and attach the references again. Long conversations drift.
6. Save the files under the names given, into `public/art/whisker-ware/`, and hand them back to Claude Code to wire in.

## Why the prompts are written this way

A microgame lasts as little as 2.5 seconds, so the player must understand the screen in under half a second. The art is split into two layers that never compete:

- **Backdrops** are opaque, soft, slightly muted and calm in the middle, with detail only at the edges.
- **Actors and props** are transparent cut-outs: saturated, with a thicker outline and even light so they sit on any backdrop.

The stage is 3:2 (480 × 320) on purpose: it is exactly ChatGPT's landscape size, 1536 × 1024, so a backdrop needs no cropping. Side-view backdrops put the ground at a stated height so the code can stand actors on it.

## Style block (paste once, first)

> You are painting production art for **Whisker Ware**, a fast, funny microgame party game: dozens of five-second games where two chinchillas, Dora and Enzo, stuff their cheeks, dodge feathers and sneak past an owl. Match the attached Whisker Saga sheet: soft, detailed gouache on cream paper, round cute bodies, big rounded ears, thin dark-plum outlines, charming and never scary. Whisker Ware is that same world played at cartoon speed, so push it slightly: livelier poses, squash-and-stretch expressions, cleaner silhouettes.
>
> There are two kinds of image, and the rules differ:
> **Actor and prop sheets** are transparent cut-outs. Use bold, simple silhouettes that read at 60 pixels, saturated colour, an outline a little thicker than the Saga sheet, and even soft light from the upper left with no cast shadow. The background must be truly transparent (alpha zero), with no glow, haze, halo, sparkle, vignette or ground shadow around any subject. Keep every subject wholly inside its own cell, with at least 10% clear space on every side, and nothing crossing into a neighbour.
> **Backdrops** are full-bleed paintings at exactly 1536 × 1024. Keep the play area calm, low in detail and a little muted so small bright characters read on top of it; put texture and story detail only around the edges. Use no characters or animals unless asked.
>
> For every image: no text, letters, numbers, signs, logos or symbols painted in, because the game prints all words itself. If something would normally carry writing, leave it blank. Use no frames, borders, grid lines or labels.

**Character canon, every time they appear:**
- **Dora** has ivory-white fur and very **dark ruby-burgundy eyes** (nearly black in shadow, never pink or glowing).
- **Enzo** has grey fur with a white chest and black eyes.
- **The Owl** is a round tawny owl with big amber eyes.
- **The Fox** is a slim russet fox with a cream chest and a white-tipped tail.
- In side views, chinchillas face **right**.

## Priority order

| # | Image | File | Shape |
| --- | --- | --- | --- |
| 1 | Hosts | `hosts.png` | transparent, 4 × 3 |
| 2–5 | Props, one sheet per host | `props-enzo.png`, `props-dora.png`, `props-owl.png`, `props-fox.png` | transparent, 4 × 3 each |
| 6 | Title | `title.png` | transparent, single |
| 7–10 | Break rooms | `room-enzo.png`, `room-dora.png`, `room-owl.png`, `room-fox.png` | backdrop, 1536 × 1024 |
| 11–34 | Microgame backdrops | `bg-<id>.png`, 24 of them | backdrop, 1536 × 1024 |

The hosts and props come first because they are what the player watches. The backdrops can stay code-drawn the longest.

---

## 1 · Hosts — `hosts.png`, transparent

Shown at about 180 pixels tall in the break between games, where they react to how you did.

> Transparent RGBA sprite sheet, landscape 1536 × 1024, EXACTLY 4 columns × 3 rows, TWELVE separate half-length character portraits, all facing the viewer in a slight three-quarter turn, same head size across the sheet, generous transparent gutters. Each COLUMN is one host in costume:
> Column 1, **Enzo** (grey fur, white chest, black eyes): a red-and-cream striped snack-stand apron and a little paper cap.
> Column 2, **Dora** (ivory-white fur, very dark ruby-burgundy eyes): a fluffy mint spa towel round her shoulders and a soft headband.
> Column 3, **the Owl** (round tawny owl, big amber eyes): a long blue nightcap with a pompom, holding a small brass lantern (unlit, no glow).
> Column 4, **the Fox** (slim russet fox, cream chest): a red ringmaster's tailcoat with gold buttons and a small black top hat.
> Each ROW is one mood, the same for all four:
> Row 1, presenting: a cheerful open-pawed "here we go!" pose.
> Row 2, cheering: both arms up, eyes squeezed happily shut, big open smile.
> Row 3, oops: wincing, ears flat back, one paw over the eyes, a single painted sweat drop.
> No background, shadows, sparkles or text.

## 2 · Enzo's props — `props-enzo.png`, transparent

> Transparent RGBA sprite sheet, landscape 1536 × 1024, EXACTLY 4 columns × 3 rows, TWELVE separate cut-out game sprites, each centred in its cell with generous transparent gutters. Small objects are painted LARGE so they fill about 60% of their cell. Cells, left to right, top row first:
> (1) a single plump dark-purple raisin; (2) a smooth grey pebble, clearly NOT food; (3) an empty round wooden bowl seen from the side; (4) a glossy brown acorn with a cross-hatched cap; (5) a terracotta jar half full of acorns, side view; (6) a small heap of grey pebbles; (7) an upturned red clay cup, side view; (8) a pale applewood stick lying horizontally with one deep V-shaped notch in its middle; (9) Enzo's head, front view, normal cheeks, eager eyes; (10) the SAME head with cheeks hugely stuffed round like balloons, eyes squeezed shut; (11) Enzo in side view facing right, mouth open, about to gnaw; (12) Enzo in side view facing right, running, holding the wooden bowl over his head with both paws.

Cells map to `raisin, pebble, bowl, acorn, jar, heap, cup, stick, enzo-face, enzo-stuffed, enzo-gnaw, enzo-carry`.

## 3 · Dora's props — `props-dora.png`, transparent

> Transparent RGBA sprite sheet, landscape 1536 × 1024, EXACTLY 4 columns × 3 rows, TWELVE separate cut-out game sprites, each centred in its cell with generous transparent gutters. Dora always has ivory-white fur and very dark ruby-burgundy eyes. Cells, left to right, top row first:
> (1) Dora sitting, front view, calm and clean; (2) a soft, round puff of sandy-beige bathing dust, opaque, with a clear rounded silhouette (not a haze); (3) Dora standing, front view, arms out, wobbling for balance, worried eyes; (4) a round hay bale lying on its side, seen end-on so it looks like a wheel; (5) Dora sleek and slim, front view, fur smoothed flat; (6) the SAME Dora fully fluffed into a near-perfect round ball of fur, with only her face, ears and feet showing; (7) Dora in side view facing right, running; (8) Dora in side view facing right, mid-leap, legs tucked; (9) a short rolling log, side view, bark and a pale cut end; (10) a small wooden grooming comb; (11) a messy tangle of white fur, a little knotted tuft; (12) a plain wooden shelf plank, side view, wide and thin.

Cells map to `dora-sit, dust, dora-balance, bale, dora-sleek, dora-puffed, dora-run, dora-jump, log, comb, tangle, plank`.

## 4 · The Owl's props — `props-owl.png`, transparent

> Transparent RGBA sprite sheet, landscape 1536 × 1024, EXACTLY 4 columns × 3 rows, TWELVE separate cut-out game sprites, each centred in its cell with generous transparent gutters. The Owl is a round tawny owl with big amber eyes wearing a long blue nightcap, as in the host sheet. Cells, left to right, top row first:
> (1) the Owl perched, seen from BEHIND, back turned, relaxed; (2) the Owl perched, head turned to the side, one eye glancing back, suspicious; (3) the Owl perched, facing straight out, eyes wide open, staring; (4) the Owl asleep, eyes shut, head drooping in the nightcap; (5) the Owl flying, side view facing LEFT, wings spread in a low swoop; (6) Dora (ivory-white fur, dark ruby-burgundy eyes) tiptoeing, side view facing right, one foot raised, paws up; (7) Enzo (grey, white chest) crouched small, side view facing right, ears flat, hiding; (8) a little grey rubber toy mouse; (9) a bright red jingle ball; (10) a squeaky orange rubber carrot; (11) a brown pinecone, about the same size and shape as an acorn; (12) a single soft tawny feather, drifting at an angle.

Cells map to `owl-back, owl-glance, owl-watch, owl-sleep, owl-swoop, dora-tiptoe, enzo-crouch, toy-mouse, toy-ball, toy-carrot, pinecone, feather`.

## 5 · The Fox's props — `props-fox.png`, transparent

> Transparent RGBA sprite sheet, landscape 1536 × 1024, EXACTLY 4 columns × 3 rows, game sprites each centred in its cell with generous transparent gutters. Cells, left to right, top row first:
> (1) a playing-card back, portrait, deep red with a gold fox-tail swirl pattern, no letters; (2) a shiny red party balloon with a curly string; (3) the same balloon in sunflower yellow; (4) the same balloon in sky blue; (5) the same balloon in leaf green; (6) a balloon pop burst: a star-shaped puff of torn rubber scraps and confetti, opaque, no glow; (7) a wooden Y-shaped slingshot with a leather pouch and a slack band; (8) a round straw archery target with red, cream and blue painted rings, front view; (9) a sturdy wooden crate, side view, with metal-banded corners; (10) a short wooden peg standing upright on a small round base; (11) a thick rope ring, seen at a slight angle so it reads as a hoop; (12) leave EMPTY and fully transparent.

Cells map to `card-back, balloon-red, balloon-yellow, balloon-blue, balloon-green, pop, slingshot, target, crate, peg, ring`. The card faces reuse Acorn Hand's painted suits (`public/art/acorn-hand/suits.png`).

## 6 · Title — `title.png`, transparent

Shown above the host cards on the menu. The game prints "WHISKER WARE" over the empty band.

> Transparent RGBA illustration, landscape 1536 × 1024. An explosive comic action burst: Dora (ivory-white fur, very dark ruby-burgundy eyes) and Enzo (grey fur, white chest, black eyes) leaping towards the viewer from the lower half, grinning, paws flung wide, as if bursting out of a game. Around them, a ring of flying objects tumbles outwards: a raisin, a wooden comb, a tawny feather, a red balloon, an acorn, a red clay cup and a playing card. Leave the TOP THIRD completely empty and transparent for the game's own title lettering. Squash-and-stretch energy, no motion-blur smears, no speed lines, no background, no shadows, no text.

## 7–10 · Break rooms — backdrops

Shown for one and a half seconds between games. The host stands in the centre and the game prints the lives and the count across the top, so keep the centre and the top fifth calm.

Use this frame for each room, with the room's description in place of the brackets:

> Wide 3:2 painted game backdrop, exactly 1536 × 1024, full bleed edge to edge, front view. [ROOM]. Keep the central half and the top fifth calm, plain and slightly muted, with a clear floor in the lower middle where a character will stand; put props and texture only at the left and right edges. Warm, welcoming light. No characters, animals, text, signs, frames or vignette.

- **`room-enzo.png`**: a tiny snack shack inside a hollow log, with a striped red-and-cream awning edge at the top corners, jars of raisins and seeds on shelves at the sides, and a wooden counter front along the bottom.
- **`room-dora.png`**: a cosy chinchilla spa, with pale mint tiles, rolled towels and a basin of sandy dust at the sides, potted ferns, and soft daylight.
- **`room-owl.png`**: an owl's attic at night, with moonlight through a round window high on one side, rafters, stacked books and an unlit lantern at the edges, in deep blues with a warm floor.
- **`room-fox.png`**: backstage at a travelling fair, with red-and-gold striped tent walls, a corner of velvet curtain, a trunk of juggling props and strings of unlit bulbs at the edges.

## 11–34 · Microgame backdrops — `bg-<id>.png`

One per microgame, shown full-screen behind the play. Use this frame, with the line from the table in place of the brackets:

> Wide 3:2 painted game backdrop, exactly 1536 × 1024, full bleed edge to edge. Scene: [SCENE]. Camera: [CAMERA]. The play area is [PLAY AREA]: keep it calm, low in detail and a little muted so small bright cut-out characters read on top of it, and put texture and story detail only around the edges. No characters, animals, food, loose objects, text, signs, frames or vignette.

"Ground at N%" means the top of the walkable floor sits N% of the way down from the top edge, perfectly level across the whole width.

### Enzo

| File | Scene | Camera | Play area |
| --- | --- | --- | --- |
| `bg-stuff.png` | a warm pantry wall with shelves of jars and hay bundles at the sides, a gingham curtain at one edge | front view | the centre 60%, where a big face will sit |
| `bg-catch.png` | a kitchen with a long high shelf edge across the top and a tiled floor | side view, ground at 82% | the open middle between shelf and floor |
| `bg-sort.png` | a market-stall counter top in warm wood | front view, counter top at 70% | the whole counter, with the left and right thirds clear for a jar and a heap |
| `bg-sniff.png` | a red-and-cream checked tablecloth | slightly high three-quarter view | a wide band across the middle for three cups |
| `bg-gnaw.png` | a carpenter's nook with a workbench, wood shavings and small tools at the edges | side view, bench top at 60% | a horizontal band across the middle |
| `bg-raisin.png` | a dramatic pantry storm: three wooden chutes pour from the top edge at 25%, 50% and 75% across, with stormy plum light and a tiled floor | side view, ground at 85% | everything below the chutes |

### Dora

| File | Scene | Camera | Play area |
| --- | --- | --- | --- |
| `bg-dust.png` | a stone bathhouse with mint tiles and a wide, shallow, empty dust-bath bowl on the floor, lit by a sunbeam | front view, bowl rim at 75% | the centre above the bowl |
| `bg-balance.png` | a sunny meadow with a dirt path along the bottom, low hills and a wide sky | side view, ground at 80% | the sky and the middle of the path |
| `bg-fluff.png` | a spa salon with a large empty round mirror frame behind, and towels and a hanging hair-dryer at the edges | front view | the centre, inside and around the mirror |
| `bg-hop.png` | a long, earthy burrow tunnel lit by root lanterns at the edges | side view, ground at 80% | the whole tunnel floor and the space above it |
| `bg-comb.png` | a grooming parlour wall with a soft towel on a hook and a stool at the edges | front view | the centre 60%, where a big Dora will sit |
| `bg-shelf.png` | a tall chinchilla cage interior (match the attached `public/art/cage-interior.jpg` if available) with wire mesh walls and a hammock hanging at the top centre | front view | the whole height of the middle; no shelves painted in |

### The Owl

| File | Scene | Camera | Play area |
| --- | --- | --- | --- |
| `bg-sneak.png` | a moonlit attic floor, with a rafter beam on the right at 55% height where an owl will perch | side view, ground at 80% | the floor from left to right |
| `bg-hide.png` | a night garden with a stone wall and plain flagstones | side view, ground at 80% | the flagstones; paint NO shadows on them |
| `bg-hush.png` | the Owl's bedroom, with an empty round nest bed at the top centre and a rug | front view, floor at 70% | the floor, with three clear spots at left, centre and right |
| `bg-find.png` | a forest floor of moss, fallen leaves, roots and pebbles, painted EVENLY LIT and evenly detailed everywhere (the game darkens it and shines a lantern) with no acorns, cones or nuts | top-down view | the whole image |
| `bg-dodge.png` | under a big oak at night, with roots, moonlight and a soft drift of leaves at the edges | side view, ground at 85% | the whole middle |
| `bg-moon.png` | a huge friendly moon over a distant sleepy village skyline and deep blue sky (the game draws the rooftops you run on) | side view | the lower half, kept dark and simple |

### The Fox

| File | Scene | Camera | Play area |
| --- | --- | --- | --- |
| `bg-pick.png` | a striped carnival booth with a red velvet table top across the lower third | front view, table top at 65% | the table, wide enough for three cards |
| `bg-pop.png` | a bright fairground sky with soft clouds, and distant tents and bunting along the bottom edge | front view | the whole sky |
| `bg-aim.png` | a grassy shooting-gallery lawn with hay bales at the edges and a plain post on the right where a target will hang | side view, ground at 82% | from the left edge to the post |
| `bg-stack.png` | a fairground loading yard with a wooden crane arm across the top edge | side view, ground at 88% | the middle below the crane |
| `bg-count.png` | a fortune-teller's tent with draped purple fabric and a round, plain cream tablecloth in the centre | top-down three-quarter view | the tablecloth |
| `bg-ring.png` | a ring-toss stall with a striped back wall and a wooden counter edge in the foreground | front view, counter at 85% | a horizontal band across the middle where pegs slide |

---

## Acceptance checklist

Check every image before saving it:

- [ ] **Sheets:** exactly the grid asked for, with cells in the stated order.
- [ ] **Transparency:** open the PNG over a dark background. There must be no haze, glow, pale boxes or ground shadows. Midnight Kitchen's chefs once arrived with a half-transparent glow that had to be cut out by hand; ask for a clean repaint instead.
- [ ] **Cell edges:** nothing touches or crosses a cell border, and ears, tails, whiskers, strings and props are complete.
- [ ] **No text:** no letters, numbers or stray symbols anywhere, including on cards, jars, signs, aprons and books.
- [ ] **Eyes:** Dora's eyes are dark ruby-burgundy, not pink or black; Enzo's are black.
- [ ] **Facing:** side-view chinchillas face right; the swooping owl faces left.
- [ ] **Matching pairs:** they are the same character, the same size and in the same place in their cells. The pairs are Enzo face/stuffed, Dora sleek/puffed and the four balloons.
- [ ] **Backdrop play area:** it really is calm. Squint at it: if a small bright object would be hard to spot in the middle, ask for "the centre quieter and plainer".
- [ ] **Ground level:** for a side-view backdrop, the ground is level and close to the stated height.
- [ ] **Backdrop size:** backdrops are 1536 × 1024 and have no characters, food or loose objects in them.

## For Claude Code, when the files come back

Put them in `public/art/whisker-ware/` and follow the Whisker Saga and Acorn Hand pattern: a small loader, sheet cells cropped by measured alpha bounds (not by dividing the sheet evenly), and the Canvas drawings kept as the fallback while images load and if one fails. For each side-view backdrop, measure the real ground line and record it in a `GROUND` table in the scene, since ChatGPT lands near the stated height but not exactly. Record the prompts actually used, and any corrections, in `docs/whisker-ware-art.md`, as `docs/kitchen-art.md` does.
