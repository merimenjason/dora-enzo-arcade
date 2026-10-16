# Acorn Hand · image prompts for ChatGPT

Written 15-10-2026. A handoff for generating Acorn Hand's painted art in ChatGPT. Everything in the game is drawn in code today (`lib/acorn-hand-scene.ts`, listed in [`acorn-hand-art.md`](acorn-hand-art.md)), and the shop items are emoji. Each sheet below can replace one drawing on its own; the code keeps the drawn version as a fallback.

## How to use this

1. Start a new ChatGPT conversation. Attach the style references:
   - `public/art/saga/heroes-0.png`, the arcade's painted storybook look;
   - `public/art/dora.jpeg` and `public/art/enzo.jpeg`, the real Dora and Enzo.
2. Paste the **Style block** once, then one sheet prompt per message, in the priority order below.
3. Ask for a **PNG with a transparent background** wherever a prompt says "transparent". Download the PNG; don't screenshot the preview.
4. Check each result against the **Acceptance checklist** before moving on. If a sheet fails, ask for a corrected version of that sheet only, quoting the failed check.
5. Save the files under the names given, into `public/art/acorn-hand/`, and hand them back to Claude Code to wire in.

## Style block (paste once, first)

> You are painting production game art for **Acorn Hand**, a cosy card game where two chinchillas, Dora and Enzo, play poker-style hands by lantern light in a hollow-log den against woodland rivals. Match the attached Whisker Saga sheet: soft detailed gouache, round cute bodies, big rounded ears, warm lantern rim light from the upper left, thin dark-plum outlines, charming and never scary. Palette: warm gold, moss green, plum, berry red and pebble blue on cream paper. Rules for every image: no text, letters, numbers or symbols painted in (the game prints all text itself); no frames, borders, grid lines or labels unless asked; when a sheet says "transparent", the background must be truly transparent (alpha zero), with no glow, haze, halo, vignette or drop shadow around the subjects; keep every subject wholly inside its own cell, with at least 10% clear space on every side and nothing crossing into a neighbour.

**Character canon, every time they appear:** Dora has ivory-white fur and very **dark ruby-burgundy eyes** (nearly black in shadow, never pink or glowing). Enzo has grey fur with a white chest and black eyes. Every other chinchilla has black eyes.

## Priority order

| # | Sheet | File | Grid | Replaces |
| --- | --- | --- | --- | --- |
| 1 | Vouchers | `vouchers.png` | 5 × 2 | `drawVoucher` (new) |
| 2 | Booster packs | `packs.png` | 4 × 2 | `drawPack` (new) |
| 3 | Item icons | `items.png` | 7 × 2 | the emoji for treats and almanac pages |
| 4 | Suit emblems | `suits.png` | 2 × 2 | `drawSuit` |
| 5 | Court cards | `court.png` | 3 × 1 | `faceArt` |
| 6 | Card back | `card-back.png` | single | the face-down card |
| 7–14 | Charms | `charms-0.png` … `charms-7.png` | 3 × 2 each | `drawCharm` |
| 15–17 | Rivals | `rivals-0.png`, `rivals-1.png`, `rival-armadillo.png` | 3 × 2, 3 × 2, single | `drawRival` |
| 18 | Table | `table.png` | single, 16:9 | the page background |
| 19 | Title | `title.png` | single | `TitleArt` |

---

## 1 · Vouchers — `vouchers.png`, transparent

Shown at about 150 × 110 pixels in the shop. The code prints the name and the price (10) over the right-hand stub, so leave that stub plain.

> Transparent RGBA sprite sheet, EXACTLY 5 columns × 2 rows, TEN separate painted ticket stubs, all the same size and landscape shape (about 4:3), centred in their cells with generous transparent gutters. Each ticket is thick cream card stock with a half-round notch cut from the middle of each short end, a dotted perforation line about three-quarters of the way across, and the small area right of the perforation left PLAIN with no marks. Each ticket is washed in its own colour and carries ONE painted emblem on the larger left part. No text, numbers, letters or symbols. Order, left to right:
> Row 1: (1) burnt-orange ticket, a small wooden shelf with six little cubbies; (2) sage-green ticket, a stitched leather pouch with three pockets; (3) mustard-gold ticket, a tiny brass balance scale tipping towards a single acorn; (4) light walnut-tan ticket, a small red squirrel standing upright hugging a tall, upright terracotta jar packed to the brim with acorns, kept fully inside the ticket's edges; (5) brick-red ticket, a chinchilla paw print with a small golden sparkle beside it.
> Row 2: (6) slate-blue ticket, a paw flicking a single playing card away; (7) violet ticket, a large chinchilla paw holding a fan of plain card backs; (8) honey-gold ticket, a tiny striped market stall with three charms hanging from its awning; (9) teal ticket, a striped awning with a string of bunting flags; (10) leaf-green ticket, a burrow entrance framed by a four-leaf clover with gentle sparkles.

Cells map to the vouchers in order: Wider Shelf, Deep Pockets, Haggler, Squirrel Hoard, Extra Paw (row 1); Spare Paw, Big Paws, Bigger Stall, Market Day, Lucky Burrow (row 2).

## 2 · Booster packs — `packs.png`, transparent

Shown at about 76 × 104 pixels in the shop. The code prints the name and the price.

> Transparent RGBA sprite sheet, EXACTLY 4 columns × 2 rows, EIGHT separate upright foil booster-pack packets (portrait, about 3:4), crimped zig-zag seals across the top and bottom, a soft paper sheen, each with ONE large painted emblem in the middle. Same size and baseline in every cell, generous transparent gutters, no shadows. No text, numbers or letters.
> Row 1, the normal packs: (1) plum-purple packet with a cluster of three ripe red berries; (2) moss-green packet with a three-leaf heart-shaped clover; (3) rust-orange packet with a glossy acorn; (4) pebble-blue packet with a smooth blue-grey river pebble.
> Row 2, the big packs: the SAME four packets in the same order and colours, but trimmed with shining gold-foil edges and a plain blank gold band across the lower third.

Cells map to: charm, almanac, treat, card (row 1), then the big version of each (row 2).

## 3 · Item icons — `items.png`, transparent

Shown at about 40–64 pixels in the item slots and the shop, so silhouettes must read small.

> Transparent RGBA icon atlas, EXACTLY 7 columns × 2 rows, FOURTEEN separate painted storybook item icons, each centred with 15% transparent margin, consistent scale and strong simple silhouettes that read at 40 pixels. No characters, background, shadows, glow, text or labels.
> Row 1: (1) a single golden honey drop on a tiny wooden dipper; (2) a small red chilli with a curl of warm ember sparks; (3) a clear crystal dewdrop on a leaf; (4) a curled gold leaf; (5) a little pot of acorn-brown dye with a brush; (6) a little pot of clover-green dye with a brush; (7) a little pot of berry-red dye with a brush.
> Row 2: (8) a little pot of pebble-blue dye with a brush; (9) a round hand mirror reflecting a still pond; (10) a small heap of rich compost with a wriggling earthworm; (11) a green sprout uncurling from a seed; (12) a lidded clover-patterned teacup, no steam; (13) a smooth wishing stone with a golden star glint; (14) an open almanac book with a ribbon bookmark and blank illustrated pages.

Cells map to: honey, spice, dew, leaf, dye0, dye1, dye2, dye3, mirror, compost, sprout, tea, wish, almanac.

## 4 · Suit emblems — `suits.png`, transparent

> Transparent RGBA sheet, EXACTLY 2 columns × 2 rows, four storybook card-suit emblems, each centred in its own cell: top left a glossy brown acorn with a cross-hatched cap and a curled stalk; top right a three-leaf heart-shaped clover in fresh green; bottom left a cluster of three ripe red berries under two leaves; bottom right a smooth blue-grey river pebble with a pale band and a gleam. Equal visual weight, warm light from the upper left, thin dark outlines, no text, no shadows.

## 5 · Court cards — `court.png`, transparent

Drawn inside the card face, about 130 × 115 pixels each.

> Transparent RGBA sheet, EXACTLY 3 columns × 1 row, three chinchilla card-court portraits, waist up, facing right, gentle smiles, same head size: LEFT the jack, Enzo (grey fur, white chest, black eyes) in a plain tunic bib; CENTRE the queen, Dora (ivory-white fur, very dark ruby-burgundy eyes) with a soft ribbon at one ear; RIGHT the king, a dignified brown elder chinchilla in a small gold crown. Bibs left blank (the game prints the rank). No text, no frames, no background.

## 6 · Card back — `card-back.png`

> A single playing-card back, portrait 5:7, filling the whole image edge to edge: deep plum card stock with a thin gold inner frame and a repeating lattice of tiny gold acorns, a soft painted sheen, symmetrical top to bottom. No text, no rounded-corner background (the game clips the corners).

## 7–14 · Charms — `charms-0.png` … `charms-7.png`, transparent

44 chinchilla friends, six to a sheet (the last sheet has two). Each charm card is about 120 × 150 pixels; the game draws the bronze, silver or gold frame by rarity and the name below, so paint the character only. Use this prompt for each sheet, replacing the six cell descriptions with the rows below:

> Transparent RGBA sprite sheet, EXACTLY 3 columns × 2 rows, SIX seated chinchilla friends, full body, three-quarter view facing RIGHT, same head and body size and the same baseline in each row, generous transparent gutters, ears, tails and whiskers wholly inside each cell. Each wears a small cloth bib in the colour given (bibs blank, no letters) and holds or sits beside ONE prop. No background, frames, shadows, glow or text. Cells, left to right, top row then bottom row: [six descriptions]

**`charms-0.png`**
1. Dora — ivory-white fur, dark ruby-burgundy eyes, amber bib; holding a small glowing red ember.
2. Enzo — grey fur, white chest, burnt-orange bib; holding a little stack of blue poker chips.
3. Bramble — walnut-brown fur, rust bib; hugging an acorn.
4. Pip — cream fur, leaf-green bib; holding a clover sprig.
5. Mossy — blush-beige fur, raspberry bib; holding a cluster of red berries.
6. Flint — slate-grey fur, steel-blue bib; holding a smooth river pebble.

**`charms-1.png`**
1. Willow — pale linen fur, sage-green bib; holding two matching leaves.
2. Nutmeg — light-brown fur, ochre bib; two pairs of acorns at its feet.
3. Pebble — ash-grey fur, cornflower-blue bib; three stacked pebbles.
4. Gale — blue-grey fur, sky-blue bib; holding a spinning pinwheel.
5. Thistle — lavender-grey fur, purple bib; a posy of purple thistles.
6. Wren — sandy fur, terracotta bib; a row of tiny seedlings in pots.

**`charms-2.png`**
1. Hazel — hazelnut-brown fur, dark-chocolate bib; wearing a tiny paper crown.
2. Robin — peach fur, red bib; holding one large golden acorn.
3. Sorrel — russet fur, mustard bib; a coin purse jingling with nuts.
4. Cashew — cream-tan fur, honey-gold bib; a full pouch of nuts.
5. Mags — charcoal fur, dark-teal bib; perched on a little pile of shiny nuts.
6. Burrowby — dark umber fur, bronze bib; leaning on a small spade.

**`charms-3.png`**
1. Driftwood — grey-brown fur, sea-green bib; beside a neat bundle of driftwood sticks.
2. Poppy — pale blush fur, poppy-red bib; holding a single red poppy.
3. Ember — caramel-orange fur, flame-orange bib; a small lantern with a safe flame.
4. Clover — cream fur, clover-green bib; holding a four-leaf clover.
5. Cinder — dark cocoa fur, brick-red bib; a softly glowing coal in a little dish.
6. Frost — icy blue-white fur, ice-blue bib; holding a large snowflake.

**`charms-4.png`**
1. Onyx — near-black fur, antique-gold bib; holding a small crowned king's sceptre.
2. Zephyr — silver-white fur, periwinkle bib; holding a long feather.
3. Aurora — pink-white fur, rose-pink bib; a soft ribbon of dawn light in its paws.
4. Fennel — straw-yellow fur, olive bib; a feathery fennel sprig.
5. Sable — dark-brown fur, navy bib; holding an hourglass.
6. Bracken — khaki-brown fur, moss-green bib; holding a curled fern frond.

**`charms-5.png`**
1. Rill — misty grey-white fur, teal bib; a little watering can pouring a thin stream.
2. Juniper — grey-green fur, slate-blue bib; a sprig of juniper berries.
3. Prism — lilac-white fur, violet bib; holding a crystal prism casting a small rainbow.
4. Sage — taupe fur, deep-indigo bib; an open book with sage leaves.
5. Lantern — warm cream fur, golden bib; holding a glowing paper lantern.
6. Thrift — dun-brown fur, olive-green bib; a patched satchel.

**`charms-6.png`**
1. Honeycomb — honey-cream fur, amber bib; holding a dripping piece of honeycomb.
2. Stag — oak-brown fur, forest-green bib; wearing a small antler circlet.
3. Echo — dark slate fur, grey-violet bib; holding a hand mirror that shows its reflection.
4. Luna — moon-white fur, pale-lavender bib; cradling a crescent moon.
5. Regent — plum-brown fur, gold bib; holding a jewelled sceptre.
6. Comet — cream-white fur, orange bib; a little star with a comet trail.

**`charms-7.png`** (only two cells; leave the other four empty and transparent)
1. Bloom — pink-white fur, magenta bib; wearing a crown of blossoms.
2. Tumble — chestnut fur, orange bib; holding a twirling acrobat's ribbon.

## 15–17 · Rivals — transparent

Shown at about 160 × 120 pixels on the round and boss screens, always facing LEFT (towards the chinchillas).

> Transparent RGBA sprite sheet, EXACTLY 3 columns × 2 rows, SIX woodland card-table rivals, half-length, all facing LEFT, each holding a fan of plain card backs and looking slightly smug but friendly, same head size, generous transparent gutters, nothing crossing cell borders. Cute round storybook proportions, never frightening. No background, table, shadows or text. Cells, left to right, top row then bottom row: [six descriptions]

- **`rivals-0.png`:** a russet fox; a tawny owl; a brown hawk; a green snake coiled upright; a grey-and-white badger; a black-and-white skunk.
- **`rivals-1.png`:** a slim brown weasel; a velvety dark mole with pink paws; a big brown bear; a tawny cougar; a shiny brown beetle; a green lizard with yellow eyes.
- **`rival-armadillo.png`** (single image, square, same style): a tan armadillo with a banded shell, holding a fan of cards, facing left.

## 18 · Table — `table.png`

> Wide 16:9 painted background, 1536 × 864: a moss-green felt card table seen from above, inside a hollow-log den at night. Warm lantern glow pools softly in the centre; roots, bark and a few acorns frame the edges. The central 70% is calm, evenly lit felt with no objects, so cards and buttons stay readable on top. No cards, characters, text, icons or UI.

## 19 · Title — `title.png`, transparent

> Transparent RGBA illustration, landscape 520 × 300 proportions: Dora on the left (ivory-white fur, very dark ruby-burgundy eyes) and Enzo on the right (grey fur, white chest, black eyes), seated and facing each other across a fanned royal flush of five acorn-suit playing cards (ten to ace, the ace gilded). The cards show only the painted acorn emblems, no letters or numbers. Warm lantern rim light, no background, no shadows, no text.

---

## Acceptance checklist

Check every sheet before saving it:

- [ ] Exactly the grid asked for, with cells in the stated order.
- [ ] The background is truly transparent: open the PNG over a dark background and look for haze, glow or pale boxes around subjects. Midnight Kitchen's chefs arrived with a half-transparent glow that had to be cut out by hand; ask for a clean repaint instead.
- [ ] Nothing touches or crosses a cell border, and ears, tails, whiskers and props are complete.
- [ ] No text, letters, numbers or stray symbols anywhere (including on bibs, tickets, cards and books).
- [ ] Dora's eyes are dark ruby-burgundy, not pink or black; Enzo's are black.
- [ ] Every chinchilla faces right; every rival faces left.
- [ ] Same scale and baseline across a sheet.

## For Claude Code, when the files come back

Put them in `public/art/acorn-hand/` and follow the Whisker Saga pattern: a small loader, cells cropped by measured alpha bounds (not by dividing the sheet evenly), and the current Canvas drawings kept as the fallback while images load and if one fails. Record the prompts actually used, and any corrections, in `docs/acorn-hand-art.md`, as `docs/kitchen-art.md` does.
