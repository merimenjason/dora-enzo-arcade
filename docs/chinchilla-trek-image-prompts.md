# Chinchilla Trek · image prompts for ChatGPT

Written 19-10-2026. A handoff for painting Chinchilla Trek's art in ChatGPT. The game is fully code-drawn ([design](superpowers/specs/18-10-2026-chinchilla-trek-design.md), [rules](chinchilla-trek.md)), so every image below replaces one drawing on its own and the code keeps the drawing as the fallback. Generate in any order; the priority order gets the most out of each image.

Dora and Enzo themselves are not in this list: the trek draws them with the arcade's shared `drawChinchilla`, as most games do. They appear only in the title illustration.

## How to use this

1. Start a new ChatGPT conversation. Attach the style references:
   - `public/art/saga/heroes-0.png`, the arcade's painted storybook look;
   - `public/art/brawl/critters-1.png`, the most recent critter sheet, for outline weight and cuteness;
   - `public/art/dora.jpeg` and `public/art/enzo.jpeg`, the real Dora and Enzo (needed for the title only).
2. Paste the **Style block** once, then one prompt per message, in the priority order. Begin each message with "Generate the image:" so ChatGPT paints rather than discusses.
3. Ask for a **PNG with a transparent background** wherever a prompt says "transparent". Download the PNG; don't screenshot the preview.
4. Check each result against the **Acceptance checklist**. To fix one cell, use ChatGPT's select-and-edit tool on that cell and quote the failed check; to fix a whole sheet, ask for a repaint of that sheet only.
5. After about six images, or as soon as faces or colours start to drift, start a fresh conversation and attach the references again.
6. Save the files under the names given, into `public/art/trek/`, and hand them back to Claude Code to wire in.

## Why the prompts are written this way

- The stage is 480 × 320 (3:2), exactly ChatGPT's landscape size, 1536 × 1024, so a backdrop needs no cropping.
- The hero always stands on the left, facing right; every foe stands on the right and faces LEFT toward the hero. The Owl and the Fox also face left. So every critter is painted facing left.
- A foe is drawn in a 120 × 120 box: about 70 pixels tall for a plain foe, 80 for an elite and 95 for a boss. The code does that scaling, so every critter fills about the same share of its cell, and rank shows through boldness and detail (crowns, capes, bigger poses), not size.
- The path scrolls sideways while the hero walks, so each chapter backdrop must **wrap**: its left and right edges have to join without a seam.
- The hero's feet are at 81% of the stage's height and the path runs from about 77% to 90%. Health bars, names and callouts sit in the top third. So the band between them must stay calm.
- The game prints every name, number, price and label itself, so nothing may carry painted text.
- Foes are never hurt in this game: a beaten foe tumbles off dizzy. No angry teeth, wounds or weapons.

## Style block (paste once, first)

> You are painting production art for Chinchilla Trek, a cosy roguelite. A chinchilla, Dora or Enzo, walks a thirty-day trek through five places, meets woodland critters who want a friendly scrap, chooses between little adventures, and visits a wise Owl and a sly Fox. Nobody is ever hurt: a beaten critter just tumbles off dizzy. Match the attached sheets: soft, detailed gouache on cream paper, round cute bodies, thin dark-plum outlines, charming and never scary. Even the bosses (a King Mole, a grumpy Badger, a Snow Fox Queen, a Great Horned Owl) are cuddly, just grander and bolder.
>
> There are two kinds of image:
> **Character and item sheets** are transparent cut-outs on a grid. Use bold, simple silhouettes that read at 60 pixels tall, saturated colour, an outline a little thicker than the Saga sheet, and even soft light from the upper left with no cast shadow. The background must be truly transparent (alpha zero), with no glow, haze, sparkle or ground shadow. Every subject sits wholly inside its own cell with at least 10% clear space on every side. Critters stand near the cell's bottom and face LEFT in a three-quarter side view, as if squaring up to someone on their left. Every critter's body fills about the same share of its cell, so a beetle and a badger read at similar sizes; rank shows through boldness and detail, not scale.
> **Backdrops** are full-bleed side-view paintings at exactly 1536 × 1024 that scroll sideways, so the left and right edges must match and join seamlessly when tiled. A sandy footpath runs straight across the whole width between 77% and 90% of the height. Keep the band from 35% to 90% of the height calm and slightly muted, because small bright characters stand there. Put the detail in the sky, the far distance and the bottom edge. No characters.
>
> For every image: no text, letters, numbers, logos or symbols painted in; the game prints all words itself. No frames, borders, grid lines or labels.

**Character canon, every time they appear:**
- **Dora:** ivory-white chinchilla fur, very dark ruby-burgundy eyes (nearly black, never pink).
- **Enzo:** grey chinchilla fur, white chest, black eyes.
- **Pip:** a small young chinchilla with soft lavender-grey fur and black eyes, eager and wide-eyed.
- **The Owl:** a kind old tawny owl, round, with little ear tufts and small round spectacles.
- **The Fox:** a slim orange fox with a cream chest and a fluffy white-tipped tail, a sly but friendly grin.

## Priority order

| # | Image | File | Shape |
| --- | --- | --- | --- |
| 1 | Foes, Clover Meadow and Bramble Wood | `foes-1.png` | transparent, 4 × 3 |
| 2 | Foes, Willow River and Frosty Peak | `foes-2.png` | transparent, 4 × 3 |
| 3 | Foes, Moon Hollow, the guides and Pip | `foes-3.png` | transparent, 4 × 3 |
| 4 | Landmarks on the path | `landmarks.png` | transparent, 4 × 2 |
| 5 | Clover Meadow | `bg-1.png` | backdrop, 1536 × 1024, wraps |
| 6 | Bramble Wood | `bg-2.png` | backdrop, 1536 × 1024, wraps |
| 7 | Willow River | `bg-3.png` | backdrop, 1536 × 1024, wraps |
| 8 | Frosty Peak | `bg-4.png` | backdrop, 1536 × 1024, wraps |
| 9 | Moon Hollow | `bg-5.png` | backdrop, 1536 × 1024, wraps |
| 10 | Skill icons | `skills.png` | transparent, 6 × 4 |
| 11 | Gear | `gear.png` | transparent, 5 × 4 |
| 12 | Title | `title.png` | transparent, single |

The foes come first because the player watches one in every fight; the backdrops next, since one is on screen all the time; the icons and gear last, as the code-drawn ones already read.

---

## 1 · `foes-1.png`

> Generate the image: a transparent character sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells, one critter per cell, all facing LEFT, read left to right, top to bottom:
> 1 **Beetle:** a round dark-green beetle with a glossy shell and two curly antennae, standing up like a mascot.
> 2 **Field Mouse Gang:** two or three small grey-brown field mice huddled together, each in a little red bandana, cheeky.
> 3 **Grumpy Toad:** a squat olive-green toad with a pale belly, arms folded, frowning grumpily.
> 4 **Wasp:** a round yellow-and-black striped wasp with clear wings and a small dark stinger, buzzing crossly.
> 5 **Hedge Pig** (elite): a big round hedgehog with a cream face, spines bristling proudly, a little leaf on his head, puffed up.
> 6 **King Mole** (boss): a plump velvety plum-grey mole with a pink snout and big pink digging claws, a small gold crown and a short red cape, squinting regally.
> 7 **Magpie:** a black-and-white magpie with an iridescent blue-green tail, head cocked, eyeing something shiny.
> 8 **Stoat:** a slim chestnut stoat with a cream belly and a black tail tip, poised to pounce.
> 9 **Thornbush Sprite:** a small round leafy spirit made of green leaves and bramble twigs, pointed leaf ears, a berry nose, mischievous.
> 10 **Wild Boar Piglet:** a little striped brown-and-cream boar piglet with a pink snout, stamping a hoof.
> 11 **Old Raccoon** (elite): a grey raccoon with a black bandit mask, a ringed fluffy tail, a little grey beard and a walking stick, crafty.
> 12 **Grumbleton the Badger** (boss): a big stocky grey badger with a bold black-and-white striped face, a small gold crown and a waistcoat, grumbling.

## 2 · `foes-2.png`

> Generate the image: a transparent character sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells, one critter per cell, all facing LEFT, read left to right, top to bottom:
> 1 **Crab:** a round orange-red crab with two big raised claws and eyes on stalks, scuttling sideways.
> 2 **Heron:** a blue-grey heron with a long neck, a long yellow beak and long thin legs, standing tall and haughty.
> 3 **Pike:** a green-gold pike fish leaping up on its tail, fins spread, toothless and comical.
> 4 **Water Vole:** a round chestnut-brown water vole with a cream belly and tiny round ears, wet-whiskered and plucky.
> 5 **Snapping Turtle** (elite): a big green turtle with a high ridged shell and a beaky snout, standing upright, stubborn.
> 6 **Captain Otter** (boss): a sleek brown otter with a cream chest and a navy captain's hat with a gold badge, a little brass spyglass under one arm.
> 7 **Snow Hare:** a pure-white hare with very long ears and black ear tips, mid-hop.
> 8 **Ptarmigan:** a round white snow bird with feathered feet and a small dark beak, fluffed up against the cold.
> 9 **Mountain Goat Kid:** a little cream-white goat kid with small curved horns, head lowered for a playful butt.
> 10 **Ice Imp:** a small pale-blue imp made of frost, with pointed ears, a thin curly tail and a gentle icy shimmer on its body (not a glow around it).
> 11 **Yeti Pika** (elite): a big round fluffy white pika with small round ears, shaggy like a tiny yeti, arms raised.
> 12 **The Snow Fox Queen** (boss): an elegant white arctic fox with a huge fluffy tail, a small icy-blue crystal crown and a pale-blue cape, chin up.

## 3 · `foes-3.png`

> Generate the image: a transparent character sheet, 1536 × 1024, a 4 × 3 grid of 12 equal cells, one subject per cell, all facing LEFT, read left to right, top to bottom:
> 1 **Bat:** a round dusky-purple bat with big pointed ears, wings spread, fangless and cute.
> 2 **Moth:** a soft lilac moth with feathery antennae and broad patterned wings, fluttering.
> 3 **Will-o'-wisp:** a small floating pale-aqua flame-shaped spirit with a friendly face and a wispy tail; its light stays inside its outline, with no glow around it.
> 4 **Night Owlet:** a small round brown owlet with big eyes, tiny ear tufts and fluffy down.
> 5 **Shadow Cat** (elite): a sleek indigo-purple cat with lilac markings and bright golden eyes, tail curled, mysterious.
> 6 **The Great Horned Owl** (boss): a grand brown horned owl with big ear tufts, a pale speckled chest, a small gold crown and wings half spread.
> 7 **The Owl** (see canon), friendly, holding a little lantern.
> 8 **The Fox** (see canon), friendly, holding a small bundle tied to a stick.
> 9 **Pip** (see canon), standing, a tiny satchel over one shoulder.
> 10 **Pip** (see canon), peeking out of a small brown satchel, holding up a snack.
> 11 **The Pedlar's pony**: a small round shaggy pony with a striped saddle blanket, friendly, for pulling the cart.
> 12 **Dizzy stars**: a ring of three little yellow stars and two spirals, as shown over a critter who has tumbled over, no critter.

## 4 · `landmarks.png`

> Generate the image: a transparent item sheet, 1536 × 1024, a 4 × 2 grid of 8 equal cells, one object per cell, standing on the cell's bottom edge, seen from the side, read left to right, top to bottom:
> 1 **Story sign:** a little wooden signpost with one blank board, a leaf or two twined around the post.
> 2 **Crossroads sign:** a wooden signpost with two blank arrow boards pointing different ways.
> 3 **Closed chest:** a small wooden treasure chest with gold bands and a gold clasp.
> 4 **Open chest:** the same chest with its lid open and acorns heaped inside, a soft gold gleam.
> 5 **Lucky wheel:** a round wooden prize wheel on a short post, eight blank coloured slices (three cream, then yellow, mint, sky blue and pink, then one soft red), a small pointer at the top.
> 6 **The Pedlar's cart:** a small wooden cart with a red-and-white striped awning, two round wheels, jars, little bags and a hanging lantern, no pony.
> 7 **Rest spot:** a small clear pond with a flat stone and a tuft of soft grass beside it, cosy.
> 8 **Acorn:** one plump shiny brown acorn with a textured darker cap and a tiny stalk, like a coin.

## 5 · `bg-1.png` · Clover Meadow

> Generate the image: a backdrop, 1536 × 1024, that tiles seamlessly left to right. A sunny spring meadow seen from the side: a soft blue sky with round white clouds, far rolling green hills, a near band of bright grass with clover and small white and pink flowers at the bottom edge. A sandy footpath runs straight across the whole width between 77% and 90% of the height. Keep the middle calm. No characters.

## 6 · `bg-2.png` · Bramble Wood

> Generate the image: a backdrop, 1536 × 1024, that tiles seamlessly left to right. A friendly woodland at late afternoon seen from the side: warm dappled light, far rows of soft green-brown trees, bramble bushes with red and black berries at the bottom edge. A packed-earth footpath runs straight across the whole width between 77% and 90% of the height. Keep the middle calm. No characters.

## 7 · `bg-3.png` · Willow River

> Generate the image: a backdrop, 1536 × 1024, that tiles seamlessly left to right. A riverbank in soft morning light seen from the side: willows trailing in the distance, a calm blue river running straight across the width just above the path at about 72% of the height, reeds and pebbles at the bottom edge. A pale sandy towpath runs straight across the whole width between 77% and 90% of the height. Keep the middle calm. No characters.

## 8 · `bg-4.png` · Frosty Peak

> Generate the image: a backdrop, 1536 × 1024, that tiles seamlessly left to right. A snowy mountainside on a crisp clear day seen from the side: pale blue sky, far white peaks, snowy pine trees in the middle distance, soft snowdrifts at the bottom edge. A trodden snowy footpath runs straight across the whole width between 77% and 90% of the height. Keep the middle calm. No characters.

## 9 · `bg-5.png` · Moon Hollow

> Generate the image: a backdrop, 1536 × 1024, that tiles seamlessly left to right. A gentle moonlit hollow at night seen from the side: a deep indigo sky with small stars and a big soft full moon in the upper part, dark rounded hills, glowing mushrooms and a few fireflies at the bottom edge. A pale moonlit footpath runs straight across the whole width between 77% and 90% of the height. Cosy and magical, never spooky. Keep the middle calm and readable. No characters.

## 10 · `skills.png`

> Generate the image: a transparent icon sheet, 1536 × 1024, a 6 × 4 grid of 24 equal cells, one round badge icon per cell: a cream disc with a thin dark-plum rim and a simple bold symbol on it, readable at 32 pixels. Read left to right, top to bottom:
> 1 **Combo:** two little paw prints, one behind the other, with speed lines.
> 2 **Counter:** a curved arrow bouncing back off a small paw.
> 3 **Sharp Teeth:** two big white chinchilla front teeth.
> 4 **Keen Eye:** one bright eye with a four-pointed sparkle.
> 5 **Extra Fluff:** a big puffy white cloud of fur.
> 6 **Shell:** a round pale-blue bubble shield.
> 7 **Dust Cloud:** a soft swirl of sandy dust.
> 8 **Static Fluff:** a fluffy tuft with a small yellow zigzag spark.
> 9 **Snack Break:** a sunflower seed with a crumb.
> 10 **Power Nap:** a tiny pillow with three small "z"-shaped puffs drawn as curls, not letters.
> 11 **Grit:** a clenched paw with a little orange glow behind it.
> 12 **Prickles:** a ball of soft brown hedgehog spines.
> 13 **Pounce:** a paw mid-leap with an arc behind it.
> 14 **Dust Roll:** a chinchilla-sized dust ball rolling with motion lines.
> 15 **Pepper Dust:** a small red chilli with a pinch of red dust.
> 16 **Frost Whiskers:** three whiskers with a little snowflake.
> 17 **Lucky Paw:** a paw holding a four-leaf clover.
> 18 **Second Wind:** a curl of breeze around a small feather.
> 19 **Thunder Combo** (evolution): two paw prints inside a yellow lightning ring, on a gold disc.
> 20 **Fluffy Fury** (evolution): a fierce little tuft of fur with a red-gold star, on a gold disc.
> 21 **Bramble Shell** (evolution): a bubble shield wrapped in a thorny green vine, on a gold disc.
> 22 **Midnight Feast** (evolution): a crescent moon over a little acorn cake, on a gold disc.
> 23 **Rest:** a small cosy campfire.
> 24 **Reroll:** two curved arrows chasing each other in a circle.
>
> Evolution badges use a gold disc with a gold rim; all the others use the cream disc. No letters or numbers anywhere.

## 11 · `gear.png`

> Generate the image: a transparent item sheet, 1536 × 1024, a 5 × 4 grid of 20 equal cells, one piece of chinchilla-sized gear per cell, centred with clear space around it. Each row is one kind of gear and each column one rarity, getting grander from left to right:
> - **Row 1, hats:** a plain knitted beanie; a green felt hat with a feather; a blue explorer's hat; a purple velvet hat with a jewel; a golden crown-like hat with a star.
> - **Row 2, scarves:** a plain oatmeal scarf; a green striped scarf; a blue woolly scarf; a purple silky scarf with tassels; a golden scarf embroidered with stars.
> - **Row 3, charms:** a plain pebble on a cord; a green leaf charm; a blue crystal charm; a purple gem charm in a silver setting; a golden sun charm.
> - **Row 4, boots:** plain cream booties; green moss booties; blue travel boots; purple boots with silver buckles; golden boots with little wings.
>
> The columns' main colours are cream-grey, mint green, sky blue, soft purple and gold, in that order. No text.

## 12 · `title.png`

> Generate the image: a transparent title illustration, 1536 × 1024. Dora and Enzo (see canon) walk side by side along a sandy footpath that curves away into rolling hills, each with a tiny satchel; Dora looks ahead eagerly and Enzo carries a walking stick. Behind them, small in the distance, a signpost, a wooden chest and a snowy peak under a crescent moon hint at the trek ahead. Leave the top quarter empty for the game's own title text. No text.

## Acceptance checklist

- Every critter faces LEFT and stays wholly inside its own cell, with clear space around it.
- The background is truly transparent: no halo, glow or ground shadow (the Will-o'-wisp and Ice Imp included).
- Nothing carries painted text, numbers or symbols; signs and the wheel are blank.
- Elites and bosses are bolder and more decorated, not larger, than plain foes; every boss wears its crown or hat.
- Nobody looks hurt, angry-toothed or scary; Moon Hollow is cosy, not spooky.
- Each critter reads clearly when the sheet is shrunk so a cell is about 60 pixels tall; each skill icon at 32 pixels.
- Each backdrop tiles: put two copies side by side and the join can't be seen. The path sits between 77% and 90% of the height on both edges.
- The gear columns go cream-grey, mint, blue, purple, gold, and the five pieces in a row are clearly the same kind of thing.
- In the title, Dora's eyes are dark ruby, not pink, and Enzo is grey with a white chest.

## Wiring it in

Like Hay Bale Brawl: measure each sheet's crops, add the images to a loader with their hashes, and draw each sprite where the scene now draws the critter, landmark, piece or backdrop layers, keeping every drawing as the loading and failure fallback. A backdrop that doesn't tile cleanly can still be used by mirroring every other copy.
