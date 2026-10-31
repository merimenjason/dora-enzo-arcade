# Kiln & Clay

Game 58, at `/pottery`. A cosy pottery workshop for one player. Dora and Enzo run a little pottery on the hill; the valley's neighbours leave orders on the board, and each pot is thrown on the wheel, glazed, fired in the kiln and delivered.

All numbers below come from `lib/pottery-game.ts` and `lib/pottery-orders.ts`. Written 30-10-2026.

## Files

- `lib/pottery-game.ts`: the rules. Deterministic and DOM-free: no `Math.random`, no clock, a fixed step of 1/60 s. It holds the wheel (the clay, centring, opening, raising, shaping, water, trimming, strain and collapse), replays, the shape and glaze scoring, the kiln, stars and pay, and the save format.
- `lib/pottery-orders.ts`: the shapes, the glazes, the seven neighbours, the seven days and their twenty-one orders, the upgrades and the handles.
- `lib/pottery-scene.ts`: Canvas 2D drawing: the workshop painting, the wheel and its splash pan, the spinning pot (throwing rings, grit, the wet sheen, the strain glow, the rim and inside), the finger ring and flung slip, the slump, glazes (pale and chalky before the kiln, glossy after), handles, lids and spouts, the kiln and its dial, the delivery counter, the painted Dora and Enzo in three moods and the painted neighbours, with drawn stand-ins for every painting. Dora and Enzo are the same height on the wheel, kiln and counter screens (a quarter of the width on wide screens, 44% upright, capped by the height), and the kiln and the counter lay out round the page's panels and tool bar so nothing sits over them or the pot.
- `app/pottery/page.tsx`, `layout.tsx`, `pottery.css` and `sound.ts`: the page. It handles the mouse, touch and keys, the loop, saving, the board, the shop, the gallery, the tips and the first-pot walkthrough, and the WebAudio sound and music. The picnic ending puts its words and the rolling cast in a band below the painting (beside it on a sideways phone), so they never cover Dora, Enzo or Mrs Prickle.
- `tests/pottery.mjs`, `tests/pottery-bot.mjs` and `tests/e2e/pottery.mjs`: the tests.
- `docs/pottery-art-brief.md`: the paintings and their stand-ins.

## The wheel

The clay is a stack of rings from the wheel head up. Each ring has an outer radius R and a clay area A (R² minus its inner radius squared, over π), and keeps a fixed volume of clay; its height comes from the volume and the area. So the clay's volume never changes: pushing a wall in makes it taller, pulling it out makes it shorter and thinner. Rings split when taller than 0.3 and merge when shorter than 0.06. A touch reaches nearby rings through a quartic falloff (0.62 wide, 0.48 with the Quiet Wheel).

What a press does depends on where it lands (the ring under the mouse shows it before you press):

- **Centring.** Until the lump is centred, any press on it centres it. It takes about 1.6 seconds on a medium wheel; a stopped wheel does nothing and a slow one takes longer.
- **Inside the pot** (or the top middle of an unopened lump): pressing down opens the lump and deepens the floor (never below 0.5), pressing outwards pushes the wall out at the same thickness, and sliding up lifts.
- **Outside the wall:** pushing in narrows it (a ring pushed in past its inside fills solid), and sliding up from the bottom raises the wall: it evens out towards a 0.28 gap and the clay moves up, so each pass makes the walls taller and thinner.
- **Lids** are solid: pressing on the top squashes them low and wide, and pushing in from the side near the top raises a knob.

How fast the clay moves depends on the wheel speed (slow, medium, fast) and the water: dry clay (under 0.3) drags, very wet clay (over 0.85) moves quicker. The clay dries all the time the wheel turns, faster under a finger (the Big Sponge slows it by 40%); 💧 adds 0.2. ✂ Trim cuts the rim level at the height you click, above the floor.

**Strain** is the worst of three, ring by ring: a wall too thin (0.16 over its thickness), a wall too tall for its thickness (the height above it over 75 times its thickness), and the clay flared out above it (its weight times its reach, over 12 times its thickness squared times its radius). Very wet or very dry clay multiplies it by 1.3 or 1.25, a fast wheel under a pot wider than 4.5 flings it outwards, a lump not yet centred adds up to half, and the Quiet Wheel takes off 10%. Over 0.7 the pot wobbles and creaks; at 1 for a quarter of a second it collapses ("flump"), slumps for 1.1 seconds and becomes a lump again with all its clay, part-centred and unopened.

Every press, move, release, water, speed change and trim is recorded with its frame, so a throw replays exactly.

## Scoring

The pot is compared with the order's outline at 49 heights up the taller of the two: the mean gap between the radii, over a tolerance of 0.5 plus a tenth of the outline's widest radius. Within 0.55 of the tolerance is three stars, within 1 two, within 1.7 one, and beyond that none. A hollow pot never opened gets none; a floor thicker than 1.7 or walls heavier than 1.35 (the median) cost a star. The customer only takes the pot with at least one star; a multi-part order scores the average of its parts, rounded down. Each order gets 1.22 times the clay of its outline (1.12 for lids), so there is enough to throw it without having to think about it.

Glaze wishes are scored loosely: a colour all over (the dip), a rim (the colour at the very top, ideally different from the base), a foot (at the very bottom), a number of stripes of a colour (bands between 12% and 88% of the height; close counts half), speckles and drips of a colour. The glaze score is the share of wishes met.

## The kiln

Firing lasts 13 seconds, the first 2.5 warming up. Holding the bellows heats the kiln (0.3 a second), letting go cools it (0.19 a second), and the fire flares or dies back on its own every 0.9 to 2.5 seconds from a seeded generator, so the same pot and save always fire the same way. The sweet band is 0.58 to 0.74 on the dial (0.555 to 0.765 with the Big Kiln). Over 85% of the firing (after the warm-up) in the band is a shining glaze, over 55% a good one, and less a dull one; 1.2 seconds above the band in all cracks it.

## Stars and acorns

A delivered order's stars are its throw stars, less one each for a glaze score under 0.5, a crack and a dull firing (at most two off, never below one). It pays 6 acorns plus 4 a star, plus 3 for a shine. Making an order again keeps the best stars and pays a thank-you of 3.

## Days and orders

Each day has three orders and the next day opens when all three are delivered; earlier orders can be made again from the board. Every new skill comes with a tip card the first time.

| Day | Name | Orders |
| --- | --- | --- |
| 1 | Opening Day | A blackberry bowl (Mrs Prickle), the ducklings' cup (Mother Duck), a dough bowl (Bramble) |
| 2 | Handles | A mug for Father Duck, a honey pot (Hazel), a flower pot (Clover) |
| 3 | Tall Things | A tall vase for reeds (Professor Heron), a pudding basin (Mrs Prickle), a quill pot (Old Mr Hoot) |
| 4 | Wide and Low | A pie dish (Bramble), a paddling dish (Mother Duck), a carrot-juice jug (Clover) |
| 5 | Lids | An acorn jar with a lid (Hazel), a bud vase (Professor Heron), a round vase (Old Mr Hoot) |
| 6 | Grand Pieces | A big storage jar with a lid (Mrs Prickle), a tall cider jug (Bramble), a gourd vase (Professor Heron) |
| 7 | The Valley Picnic | Teacups (Old Mr Hoot), a milk jug (Clover), the picnic teapot (Hazel) |

Mugs, cups and jugs take a handle (loop, ear, big or twig); jugs get a pulled lip. The teapot is thrown in three parts, body, spout and lid, and takes a handle. Delivering it the first time plays the ending, the valley picnic.

Glazes: honey, cream, sky blue and moss green from the start; rose on day 2, cobalt on day 3, celadon on day 4, amber on day 5; plum and charcoal from the shop.

## The shop

| Upgrade | Acorns | From day | What it does |
| --- | --- | --- | --- |
| Big Sponge | 15 | 1 | The clay dries 40% slower. |
| Quiet Wheel | 40 | 2 | A finer touch (0.48 instead of 0.62) and 10% less strain. |
| Plum & Charcoal | 25 | 2 | Two more glazes. |
| Display Shelf | 35 | 3 | Each new day, an acorn for each pot in the gallery, up to 5. |
| Big Kiln | 60 | 3 | Two pots fire at once and the sweet band is wider. |

With the Big Kiln, a glazed pot can wait on the rack while you throw the next order, and both go in together.

## Free throw and the gallery

After the first order, the free throw is a wheel with 70 units of clay and no outline: make anything, add a handle or not, glaze it and fire it. Any fired pot, free or ordered, can be kept on the gallery shelves; the shelves hold 12, newest first.

## Saving

Everything is saved in `localStorage` under `kiln-clay-v1`: acorns, the day, the best stars per order, upgrades, the gallery, pots waiting on the rack, the tips seen, the settings (sound, music, the outline) and a few counts. A save that fails to parse starts fresh; one with bad fields keeps what it can (the day is clamped to the days actually reached, unknown orders and broken pots are dropped).
