# Acorn Hand · art

Everything in Acorn Hand is drawn in code today, in `lib/acorn-hand-scene.ts`. This page lists what each picture is, so a painted pass can replace them one at a time without touching the rules.

## What is drawn, and where

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

Item icons in the shop and the item slots are emoji (`itemIcon` in the page).

## Prompts for a painted pass

Keep the arcade's painted storybook look (see `docs/saga-art.md`): soft gouache, warm lantern light, clean silhouettes on a transparent background, no text in the image.

- **Suit sheet**, 2 × 2 cells, transparent: "Four storybook card-suit emblems on a transparent background, each centred in its own cell: a glossy brown acorn with a cross-hatched cap and a curled stalk; a three-leaf heart-shaped clover in fresh green; a cluster of three ripe red berries under two leaves; a smooth blue-grey river pebble with a pale band and a gleam. Soft gouache, warm light from the upper left, thin dark outlines, no text."
- **Face-card portraits**, 3 cells: "Three chinchilla card-court portraits, waist up, on transparent backgrounds: a grey chinchilla jack in a tunic bib, a white chinchilla queen with a ribbon, a brown elder chinchilla king in a small gold crown. Each faces right with a gentle smile, storybook gouache, warm lantern light, no text or letters."
- **Charm portraits**, 44 cells in a 6 × 8 grid: one small chinchilla friend per charm in the coat colour and bib colour listed in `CHARMS[].look`, seated, facing right, each with a single prop that hints at its effect (a lantern for Lantern, a comet trail for Comet, a stag-antler circlet for Stag, a mirror pond for Echo). Transparent background, no text.
- **Rivals**, 13 cells: the fox, owl, hawk, snake, badger, skunk, weasel, mole, bear, cougar, beetle, lizard and armadillo as slightly smug card-table rivals, half-length, facing left, holding a fan of cards, storybook gouache, transparent background.
- **Table**: "A moss-green felt card table seen from above in a hollow-log den at night, lantern glow pooling in the centre, roots and a few acorns at the edges, wide 16:9, no cards, no text."

When a painted sheet arrives, follow the Saga pattern: load it with a small loader, crop cells by measured silhouettes, and keep the drawn versions as the fallback while it loads.
