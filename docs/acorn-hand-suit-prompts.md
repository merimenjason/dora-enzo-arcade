# Acorn Hand · art redo prompts for ChatGPT

Written 15-10-2026, updated 16-10-2026. Focused redos of painted art from [`acorn-hand-image-prompts.md`](acorn-hand-image-prompts.md) that didn't work in the game: the four card suits, the [Squirrel Hoard voucher](#squirrel-hoard-voucher) and the [rival reaction poses](#rival-reaction-poses).

## Suit pips

The four card suits. The first painted `public/art/acorn-hand/suits.png` is a good illustration but a poor card pip, and it is the most-seen art in the game: every card face draws it two to ten times.

### Why the current sheet doesn't work

`drawSuit` in `lib/acorn-hand-scene.ts` fits each painted cell into a square, so the shape of each painting decides how big it looks on a card. On a card in a hand, a corner pip is about 20 px across and a number-card pip about 25 to 35 px.

- **Detail turns to mush at 20 to 35 px.** The cross-hatched cap, the leaf veins, the berry calyxes and the pebble's speckle all blur into noise, and the thick dark-plum outline becomes a muddy halo.
- **Unequal sizes.** The cells measure 373 × 477 (acorn), 439 × 420 (clover), 383 × 403 (berry) and 424 × 332 (pebble). Fitted into the same square, the acorn shrinks to fit its height and the pebble comes out as a thin flat lozenge. The four suits don't look like one deck.
- **Off-centre shapes.** The acorn's curled stalk and the clover's sideways stem pull each shape to one side, so rows of pips look crooked.
- **The berry is busy.** Three berries and two leaves make a cluster that reads as a blob, not a symbol.
- **Colour doesn't match the card.** The rank letters are printed in each suit's ink (below), and the painted pips drift from it: the acorn is orange and the berry pinker.

### What a good pip looks like

The suits on a printed card deck (spade, heart, club, diamond) work because each one is a **bold, symmetrical, flat silhouette** that is still readable as a tiny shape. Acorn Hand's suits should do the same in the arcade's storybook style: **enamel-pin or wax-seal flatness with a touch of gouache warmth**, not a still-life painting.

| Cell | Suit | Ink (rank letters) | Silhouette |
| --- | --- | --- | --- |
| Top left | Acorn | `#7a4a1e` | Tall, round-bottomed nut with a wide, scalloped cap and a short straight stalk pointing straight up. Mirror-symmetric. |
| Top right | Clover | `#2f7a33` | Three heart-shaped leaves meeting in the centre (top, lower left, lower right) and a short, thick stem straight down, like a playing-card club. Mirror-symmetric. |
| Bottom left | Berry | `#b42840` | One plump round berry, slightly heart-shaped at the top, with a small star-shaped leafy cap and a short stalk on top. Mirror-symmetric. One berry, not a cluster. |
| Bottom right | Pebble | `#4d5d72` | A smooth, upright egg-shaped stone (taller than wide, about 5 : 6), with one pale band running diagonally across it and a gleam at upper left. |

The four silhouettes must be different enough to tell apart in **greyscale** at 20 px: a tall nut with a cap, a three-lobed club, a round fruit with a star on top and a plain egg.

### How to use this

1. Start a new ChatGPT conversation. Attach two images:
   - `public/art/acorn-hand/suits.png`, the current sheet, as the **subject and colour reference only**;
   - a screenshot of a hand of cards in the game, to show how small the pips are drawn.
2. Paste the **Prompt** below as one message.
3. Download the PNG (don't screenshot the preview) and run the **Acceptance checklist**. If a check fails, reply with **Fix-up prompt** naming the failed check.
4. Save it as `public/art/acorn-hand/suits.png`, replacing the current one, and hand it back to Claude Code for the **Integration notes**.

### Prompt

> You are drawing the four card-suit pips for **Acorn Hand**, a cosy storybook poker game played by two chinchillas. The first attached image shows the four subjects in our art style, but it fails as card art: it is a detailed illustration, and on a playing card each pip is only 20–35 pixels wide, so the detail blurs into mush. The second image shows how small they are drawn. Redraw them as **card pips**: bold, simple, symmetrical icons that read instantly at tiny sizes, like the spade, heart, club and diamond on a printed deck, but in our warm storybook style, like enamel pins or wax seals with a little gouache warmth.
>
> **Sheet:** a square PNG with a truly transparent background (alpha zero), EXACTLY 2 columns × 2 rows of equal square cells, one pip centred in each cell. No grid lines, frames, cards, labels, text, letters or numbers.
>
> **Size and balance:** every pip fills the same area, about 70% of its cell's width and 70% of its height, with its centre exactly at the centre of the cell. All four must look equally heavy side by side. Nothing touches a cell edge.
>
> **Style:** a solid flat base colour, one soft darker shade on the lower right and one light highlight on the upper left (light comes from the upper left), and a single clean outline in a darker tone of the pip's own colour, the same weight on all four. No texture, speckle, hatching, veins, grain, fine lines or tiny parts. No drop shadow, glow, halo or coloured fringe outside the outline.
>
> **Cells, left to right, top row then bottom row:**
> 1. **Acorn**, warm brown `#7a4a1e` (nut a little lighter, cap a little darker): a tall nut with a rounded bottom ending in a small point, under a wide cap with a scalloped lower edge and three or four simple rows of bumps, and a short, straight, thick stalk pointing straight up. Mirror-symmetric left to right. No curl.
> 2. **Clover**, moss green `#2f7a33`: three plump heart-shaped leaves meeting in the centre, one up, one lower left, one lower right, with a short, thick stem going straight down, shaped like a playing-card club. Mirror-symmetric. No veins.
> 3. **Berry**, berry red `#b42840`: ONE plump, round berry, slightly heart-shaped at the top, with a small five-pointed green leafy cap and a tiny stalk on top, and one round white gleam at upper left. Mirror-symmetric. Not a cluster, not a cherry pair, not a strawberry.
> 4. **Pebble**, slate blue-grey `#4d5d72`: a smooth upright egg-shaped river stone, taller than it is wide (about 5 wide to 6 tall), with one soft pale band running diagonally across it from lower left to upper right and a gleam at upper left. No speckle.
>
> The four pips must be easy to tell apart even in greyscale at 20 pixels: a nut with a cap, a three-lobed club, a round fruit with a star on top, a plain egg.

### Fix-up prompt

> Keep everything that works and change only this: _[name the failed check, for example "the pebble is still wider than it is tall: make it an upright egg, 5 wide to 6 tall, filling 70% of the cell height like the others"]_. Same 2 × 2 grid, same order, transparent background, no text.

### Acceptance checklist

- [ ] 2 × 2 grid in the order acorn, clover, berry, pebble; square image.
- [ ] Background truly transparent: the empty cells are checkerboard in a viewer, with no white, cream or dark matte and no glow around the pips.
- [ ] **The squint test:** shrink the image so each pip is about 20 px wide (the sheet about 60 px). Each suit is still instantly recognisable, with no muddy edges.
- [ ] **The greyscale test:** desaturate it; the four are still easy to tell apart by shape alone.
- [ ] All four fill about the same area and sit centred in their cells; none is visibly smaller, flatter or off to one side.
- [ ] Acorn and clover are mirror-symmetric with straight stems (acorn's up, clover's down). The berry is a single berry. The pebble is taller than wide.
- [ ] Colours sit close to the inks: `#7a4a1e`, `#2f7a33`, `#b42840`, `#4d5d72`. Acorn brown, not orange; berry red, not pink.
- [ ] Flat shading with one shade and one highlight; no texture, hatching or veins.
- [ ] No text, letters, numbers, card shapes or frames.

### Integration notes (for Claude Code)

- The crops for `suits` in `lib/acorn-hand-crops.ts` are measured from the current file, so the new sheet needs them **measured again** from its alpha bounds. Make each suit's crop a **square of the same size**, centred on the silhouette's centre, so `paintAcorn` fits all four at the same scale and the four look equally heavy on a card. Contain-fitting each tight bounding box (as now) is what made the pebble shrink.
- Bump the cache key in `loadAcornPainting` (`?v=painted-1`) so browsers drop the old sheet.
- `drawSuit` is also used for the faint emblem behind suit charms, the pip on booster packs, the ace's big centre pip and the card-back pattern; check each one in the browser at the phone sizes, and with the painted file blocked to be sure the canvas fallback still draws.
- Optional, only if the big centre pip on aces looks too plain with the flat style: generate the detailed illustration again as `suits-large.png`, the same 2 × 2, with the same symmetrical silhouettes, and use it only for the ace and the charm emblems (drawn at 50 px or more).
- Record the final prompt in `docs/acorn-hand-art.md`, and add a **Changed** entry for **Acorn Hand** in `CHANGELOG.md`.

## Squirrel Hoard voucher

The fourth ticket in `public/art/acorn-hand/vouchers.png` (top row, fourth from the left) is Squirrel Hoard: it raises the interest cap, so nuts you hold earn up to 10 a round instead of 5. The painted ticket doesn't say that.

### What's wrong

- **There is no squirrel.** It shows a clay pot tipped on its side with acorns spilling out, which reads as a horn of plenty, or as one more acorn picture in a game full of them. Nothing says *squirrel* or *hoard*.
- **It breaks out of the ticket.** The pot's rim sticks out past the top edge of the ticket, so in the shop it looks like a sticker slapped on top, not a printed ticket like the other nine.
- **Brown on brown.** Brown acorns and a brown pot on a walnut-brown ticket blur into one muddy blob at the shop's 150 × 110 px.
- **Spilling is the wrong idea.** The voucher is about *keeping* nuts and having them grow, not losing them.

### What it should show

A small red squirrel with a big bushy tail, standing upright and hugging a tall, plump clay jar packed to the brim with acorns, a few acorns heaped on top: a proud saver guarding the stash. The squirrel's orange and the jar's terracotta stand out against the ticket, which goes a lighter walnut-tan so the brown acorns read against it.

### How to use this

1. Start a new ChatGPT conversation. Attach `public/art/acorn-hand/vouchers.png` as the **style reference**: the ticket shape, paper, perforation and painting style must match the other nine.
2. Paste the **Prompt** below as one message.
3. Download the PNG and run the **Acceptance checklist**. If a check fails, reply with the **Fix-up prompt** naming it.
4. Save it as `public/art/acorn-hand/voucher-hoard.png` and hand it back to Claude Code for the **Integration notes**.

### Prompt

> The attached sheet holds ten painted ticket stubs for vouchers in **Acorn Hand**, a cosy storybook card game. Paint ONE new ticket to replace the fourth one (top row, fourth from the left, the brown one with a tipped clay pot), which doesn't work. Match the other nine exactly in shape, size, paper, painting style and lighting.
>
> **Image:** a single landscape PNG, about 4:3, with a truly transparent background (alpha zero) and the ticket centred with a small transparent margin all round. No text, numbers, letters or symbols anywhere.
>
> **Ticket:** thick cream card stock washed in a **light walnut-tan**, a half-round notch cut from the middle of each short end, a dotted perforation line about three-quarters of the way across, and the narrow area right of the perforation left PLAIN, with no marks at all, because the game prints the price there. Same dark outline and soft paper texture as the attached tickets.
>
> **Emblem, on the larger left part only:** a small **red squirrel** with a big bushy curled tail, standing upright, proudly hugging a tall, plump **terracotta clay jar** packed to the brim with acorns, with a little heap of acorns crowned on top. Both upright, not tipped over, nothing spilling. The squirrel and jar fill most of the left part's height but stay **completely inside the ticket's edges**, with a clear gap to the top and bottom edges and to the perforation. The squirrel's bright orange and the jar's terracotta must stand out clearly against the tan ticket.
>
> It must read at 150 pixels wide as "a squirrel guarding its stash of nuts".

### Fix-up prompt

> Keep everything that works and change only this: _[name the failed check, for example "the jar's rim crosses the top edge of the ticket: shrink the squirrel and jar so both sit fully inside the ticket with a clear gap"]_. Same single ticket, transparent background, no text.

### Acceptance checklist

- [ ] One ticket, landscape, transparent background with no matte or glow.
- [ ] The same shape, notches, perforation and paper as the other nine tickets; it doesn't look out of place next to them.
- [ ] The stub right of the perforation is plain.
- [ ] A squirrel is the first thing you see; at 150 px wide it still reads as a squirrel with its jar of nuts.
- [ ] The squirrel and jar sit fully inside the ticket, with nothing crossing an edge or the perforation.
- [ ] The jar is upright and full; nothing is spilling.
- [ ] The ticket is a lighter tan than the acorns, so they don't blur together.
- [ ] No text, numbers or letters.

### Integration notes (for Claude Code)

- Paste `voucher-hoard.png` into the fourth cell of `vouchers.png`, scaled to the cell's crop size in `lib/acorn-hand-crops.ts` (`vouchers[3]`, 321 × 241 at 1081, 131) and aligned on the same baseline as its neighbours, then re-measure that one crop from the alpha bounds. Delete `voucher-hoard.png` afterwards so it isn't shipped twice.
- Bump the cache key in `loadAcornPainting` so browsers drop the old sheet.
- Check the shop card at desktop and phone widths: the price the game prints at the stub must not overlap the emblem.
- Add a **Changed** entry for **Acorn Hand** in `CHANGELOG.md`.

## Rival reaction poses

The rival across the table already reacts with motion: it slides in, leans in on a discard, recoils from a big hand, slumps when beaten and bounces when it wins. When painted **happy** and **sad** poses exist, the game shows them too: happy when a rival enters and gloats, sad when it recoils and is beaten. Until then it uses the calm portrait.

**Files**, saved in `public/art/acorn-hand/`, with the same grids and cell order as the calm sheets:

| Calm sheet (reference) | Happy | Sad | Cells, left to right, top row first |
| --- | --- | --- | --- |
| `rivals-0.png` | `rivals-0-happy.png` | `rivals-0-sad.png` | fox, owl, hawk, snake, badger, skunk |
| `rivals-1.png` | `rivals-1-happy.png` | `rivals-1-sad.png` | weasel, mole, bear, cougar, beetle, lizard |
| `rival-armadillo.png` | `rival-armadillo-happy.png` | `rival-armadillo-sad.png` | armadillo |

Make one sheet per message. Attach the matching calm sheet as the reference, so each rival keeps its look, colours, size and place in the grid.

### Happy prompt

> Redraw the attached sheet of card-table rivals with every character in a **happy, smug** pose: a sly grin, eyes bright, the fan of cards raised a little as if about to win. Keep everything else exactly as in the attachment: the same characters, colours, size, framing and position in the same grid, half-length, all facing left, storybook gouache with warm lantern light. Truly transparent background, no text, letters or numbers.

### Sad prompt

> Redraw the attached sheet of card-table rivals with every character in a **sad, beaten** pose: ears or crest drooping, shoulders slumped, eyes downcast, the fan of cards drooping in its paws. Keep everything else exactly as in the attachment: the same characters, colours, size, framing and position in the same grid, half-length, all facing left, storybook gouache with warm lantern light. Truly transparent background, no text, letters or numbers.

### Integration notes (for Claude Code)

- Measure each sheet's crops from its alpha bounds into `lib/acorn-hand-crops.ts` under the keys `rivals-0-happy`, `rivals-0-sad`, `rivals-1-happy`, `rivals-1-sad`, `rival-armadillo-happy` and `rival-armadillo-sad`. `drawRival` in `lib/acorn-hand-scene.ts` looks a pose sheet up only when its crop key exists, so nothing is requested before then.
- Check that each pose sits where the calm portrait sits, so the swap during a reaction doesn't jump; bump the cache key in `loadAcornPainting`, record the prompts in `docs/acorn-hand-art.md`, and add a **Changed** entry for **Acorn Hand** in `CHANGELOG.md`.
