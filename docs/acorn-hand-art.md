# Acorn Hand · art

Acorn Hand uses nineteen painted PNGs through `lib/acorn-hand-paint.ts` and the Canvas scene renderer. Card ranks, scoring, gloss labels, prices and controls stay live. The original code drawings remain available while an image loads or if its request fails.

## Canvas API and fallback drawings

| Picture | Function | Size it is drawn at | Notes |
| --- | --- | --- | --- |
| Suit pips: acorn, clover, berry, pebble | `drawSuit` | any; 24-unit frame | Also used as the faint emblem behind suit charms. |
| Card face | `drawCard` | 150 × 210 canvas | Corner rank and pip, printed-deck pip layouts for 2 to 10 (`PIPS`), a large pip in a ring for the ace. |
| Face cards | `faceArt` inside `drawCard` | 88% × 55% of the card | Jack is Enzo, queen is Dora, king a brown elder in a crown, each in a bib of the suit's ink with the rank on it. |
| Glossed card | `drawCard` | | Honey, ember, crystal and gold tint the paper, colour the border and print the gloss name at the foot. |
| Card back and face-down cards | `drawCard` with `down` | | Plum back with a gold inner frame and a lattice of acorns. |
| Charm | `drawCharm` | 120 × 150 canvas | A chinchilla in the charm's coat and bib colour (`look` in `CHARMS`) over a faint family emblem: its suit, ×, +, ◆ for chips, ¤ for nuts or ★. The frame is bronze, silver or gold by rarity. |
| Rival | `drawRival` | 160 × 120 canvas | The shared predators and critters from `lib/predator-art.ts`, facing left. |
| Title | `TitleArt` in the page | 520 × 300 canvas | Dora and Enzo either side of a royal flush of acorns, the ace gilded. |

Item icons use `drawItem` in shop offers, inventory slots and pack choices: thirteen painted treats and one shared almanac book. Their names and effects remain accessible HTML.

## Prompts for a painted pass

The full, sheet-by-sheet handoff for ChatGPT, vouchers, packs and item icons included, is [`acorn-hand-image-prompts.md`](acorn-hand-image-prompts.md). A focused redo of the suit pips, which turned to mush at card size, and the prompts for the rivals' happy and sad reaction poses are in [`acorn-hand-suit-prompts.md`](acorn-hand-suit-prompts.md). The notes below are the original short version.

Keep the arcade's painted storybook look (see `docs/saga-art.md`): soft gouache, warm lantern light, clean silhouettes on a transparent background, no text in the image.

- **Suit sheet**, 2 × 2 cells, transparent: "Four storybook card-suit emblems on a transparent background, each centred in its own cell: a glossy brown acorn with a cross-hatched cap and a curled stalk; a three-leaf heart-shaped clover in fresh green; a cluster of three ripe red berries under two leaves; a smooth blue-grey river pebble with a pale band and a gleam. Soft gouache, warm light from the upper left, thin dark outlines, no text."
- **Face-card portraits**, 3 cells: "Three chinchilla card-court portraits, waist up, on transparent backgrounds: a grey chinchilla jack in a tunic bib, a white chinchilla queen with a ribbon, a brown elder chinchilla king in a small gold crown. Each faces right with a gentle smile, storybook gouache, warm lantern light, no text or letters."
- **Charm portraits**, 44 cells in a 6 × 8 grid: one small chinchilla friend per charm in the coat colour and bib colour listed in `CHARMS[].look`, seated, facing right, each with a single prop that hints at its effect (a lantern for Lantern, a comet trail for Comet, a stag-antler circlet for Stag, a mirror pond for Echo). Transparent background, no text.
- **Rivals**, 13 cells: the fox, owl, hawk, snake, badger, skunk, weasel, mole, bear, cougar, beetle, lizard and armadillo as slightly smug card-table rivals, half-length, facing left, holding a fan of cards, storybook gouache, transparent background.
- **Table**: "A moss-green felt card table seen from above in a hollow-log den at night, lantern glow pooling in the centre, roots and a few acorns at the edges, wide 16:9, no cards, no text."

When a painted sheet arrives, follow the Saga pattern: load it with a small loader, crop cells by measured silhouettes, and keep the drawn versions as the fallback while it loads.

## Generated asset set · 15-10-2026

All nineteen requested PNGs are saved in `public/art/acorn-hand/` on `feat/acorn-hand-painted-assets`. They are prepared assets; the game's current Canvas/emoji presentation has not been changed in this pass.

Generation used the built-in imagegen tool, with the detailed sheet order and character lists in [`acorn-hand-image-prompts.md`](acorn-hand-image-prompts.md). The exact submitted prompts, correction attempts, references, selected source paths, native dimensions and SHA-256 hashes are recorded in [`acorn-hand-generation.json`](acorn-hand-generation.json). Selected outputs were copied byte-for-byte; no manual masks, recolouring, resizing or bitmap extraction were applied.

| File | Layout | Native pixels | Format |
| --- | --- | --- | --- |
| `vouchers.png` | 5 × 2 | 1774 × 887 | RGBA |
| `packs.png` | 4 × 2 | 1774 × 887 | RGBA |
| `items.png` | 7 × 2 | 1983 × 793 | RGBA |
| `suits.png` | 2 × 2 | 1254 × 1254 | RGBA |
| `court.png` | 3 × 1 | 2172 × 724 | RGBA |
| `card-back.png` | 1 × 1 | 1060 × 1484 | Opaque RGB |
| `charms-0.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-1.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-2.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-3.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-4.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-5.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-6.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `charms-7.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `rivals-0.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `rivals-1.png` | 3 × 2 | 1536 × 1024 | RGBA |
| `rival-armadillo.png` | 1 × 1 | 1254 × 1254 | RGBA |
| `table.png` | 1 × 1 | 1672 × 940 | Opaque RGB |
| `title.png` | 1 × 1 | 1650 × 953 | RGBA |

The charms cover all 44 friends in eight 3 × 2 sheets. `charms-7.png` contains only Bloom and Tumble in the first two top-row cells. Rivals cover all thirteen species, facing left; court and charm characters face right. The title is the intentional exception: Dora faces Enzo across five acorn-only card faces. Dora retains ivory-white fur and dark ruby-burgundy eyes; Enzo has grey fur, a white chest and black eyes.

### Review and integration notes

- Inspected PNGs composited over a dark plum browser background, rather than interpreting the hidden RGB under transparent pixels as a visible matte. Seventeen files have real alpha channels; table and card back are opaque full-bleed artwork. All nineteen match their selected source bytes.
- Corrections cleared voucher price stubs, increased atlas gutters, removed unrequested court props and Bloom's extra bouquet, contained long pinwheel/ribbon/water/book props, and added title margins. Card-back refinement introduced opposing acorn orientations for the reversible motif.
- The generator's native dimensions are recorded above. The table is approximately 16:9 and the card back exactly 5:7; the renderer contains them proportionally in the existing boxes.
- The four unused cells in the partial charm sheet have no visible artwork, but contain isolated generator alpha noise up to 1/255. Ignore alpha ≤ 1 when measuring blank cells. Preserve real feathered fur, whiskers, detached water drops and sparkles when measuring complete silhouettes.
- `visibleBoundsAlpha32` in the manifest is an inspection aid for the whole image, not a set of final per-character crop rectangles. `lib/acorn-hand-crops.ts` records measured connected silhouettes and detached prop pieces rather than nominal grid slices. The original Canvas drawings remain asynchronous-loading and failed-request fallbacks.
- The runtime integration is active: `lib/acorn-hand-paint.ts` loads sheets on demand; canvas subscribers repaint when images arrive. The page loads the table separately and uses dark reading surfaces over it. All cards draw at twice their logical resolution. Item slots, shop offers and pack choices share the same painted item renderer; pack mapping explicitly handles the interleaved data order. Failed requests expose **Retry artwork** without blocking play. Rules, saves and sound are unchanged.
- Validation: typecheck, targeted lint, existing Acorn Hand browser suite (gameplay, saves, all pack kinds, reduced motion and six layouts), plus a painted loading/failure/retry regression. A complete gallery was visually reviewed for all 44 charms, 13 rivals, vouchers, packs and treats.
