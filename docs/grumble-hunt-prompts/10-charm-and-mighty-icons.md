# Grumble Hunt: painted icons for the charms and the Mighty armour

Sent to Codex through the plugin on 26-10-2026. These icons replace the charm emoji (🍀 🌰 🪶) in the Forge's Charms tab and the gold CSS tint over the Bristle gear icons in the Mighty armour row.

**Where the icons go:** one new sheet, `public/art/hunt/icons-charms.webp`, 1024 × 1024, a 4 × 4 grid of 256 × 256 cells:

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
|---|---|---|---|---|
| 1 | Clover Charm I | Clover Charm II | Clover Charm III | empty |
| 2 | Acorn Charm I | Acorn Charm II | Acorn Charm III | empty |
| 3 | Feather Charm I | Feather Charm II | Feather Charm III | empty |
| 4 | Mighty helm | Mighty vest | Mighty boots | empty |

Don't change any code: Claude wires the sheet into `app/hunt/` afterwards. Leave the files uncommitted.

**Style, matching the existing sheets** (look at `icons-gear.webp`, `icons-items.webp` and `icons-materials.webp` first):
- Warm hand-painted toon storybook style, like Wind Waker and Monster Hunter Stories, for a kind children's game.
- Each icon is centred in its 256 × 256 cell within 208 × 208, on a transparent background.
- Three-quarter view, light from the top left, and a thick dark-brown outline that reads at 48 px.
- No text, letters, Roman numerals, logos, grid lines or watermarks.
- **Charm levels:** each charm is a small round wooden keepsake on a loop of twine, the kind Bramble the tinker would make. Level I is plain; level II adds a teal ribbon and a second small bead; level III adds gold trim and a small warm amber Glimmer Stone with a soft warm glow. Keep the same silhouette across a row.
- **Mighty armour:** the Bristle helm, vest and boots in `icons-gear.webp` (cells 9–11) are the shape reference. The Mighty set is the same cosy shape but golden: honey-gold fabric, gold trim, a small warm amber Glimmer Stone set in each piece and a soft warm glow. The helm leaves room for big chinchilla ears; the boots are a pair. No whole characters.

**Generate one row per request.** Full-sheet and two-row requests timed out on 25-10-2026; single rows worked.

## Prompts

Shared preamble for every row:

```text
Use case: stylized-concept. Game icon atlas row for Grumble Hunt, a kind children's adventure. Warm hand-painted toon storybook style inspired by Wind Waker and Monster Hunter Stories: chunky rounded readable forms, soft painted brushwork, three-band cel shading, saturated but gentle colours. Transparent background, a wide 1024x256 strip of four 256x256 cells. One complete centered icon per occupied cell within centered 208x208 bounds. Consistent three-quarter view and top-left lighting, THICK dark-brown outline readable at 48px. Genuine transparent alpha, no checkerboard. No text, letters, numerals, grid lines, logo, watermark, scenery or cast shadows. The fourth cell is completely empty and transparent.
```

Row 1:

```text
Left to right: Clover Charm I (a round wooden disc carved with a four-leaf clover, painted fresh green, hanging from a loop of brown twine); Clover Charm II (the same with a teal ribbon bow on the twine and one green bead); Clover Charm III (the same with gold trim round the disc, a small warm amber Glimmer Stone set in the clover's middle and a soft warm glow); EMPTY.
```

Row 2:

```text
Left to right: Acorn Charm I (a plump polished acorn with its cap, hanging from a loop of brown twine); Acorn Charm II (the same with a teal ribbon bow and one wooden bead); Acorn Charm III (the same with a gold band round the cap, a small warm amber Glimmer Stone on top and a soft warm glow); EMPTY.
```

Row 3:

```text
Left to right: Feather Charm I (a soft pale-blue sky feather tied to a small wooden ring with brown twine); Feather Charm II (the same with a teal ribbon and a second smaller white owl-down feather); Feather Charm III (the same with gold trim on the ring, a small warm amber Glimmer Stone at the tie and a soft warm glow); EMPTY.
```

Row 4:

```text
Left to right: Mighty helm (a cosy rounded honey-gold cap with a soft bristle crest, two big openings for large chinchilla ears, gold trim and a small warm amber Glimmer Stone on the brow, soft warm glow); Mighty vest (a honey-gold padded vest with gold trim, leaf-shaped shoulder pads and a small amber Glimmer Stone clasp, soft warm glow); Mighty boots (a PAIR of puffy honey-gold boots with gold trim and a small amber Glimmer Stone on each, soft warm glow); EMPTY.
```

## Packing

- Downscale each generated strip to 1024 × 256, keeping the alpha, and stack the four strips into one 1024 × 1024 sheet in row order.
- Check that every drawing sits inside its own 256 × 256 cell with even padding, and that column 4 is fully transparent.
- Save as lossless WebP at `public/art/hunt/icons-charms.webp`.
- Add an `### icons-charms` section to `docs/grumble-hunt-art.md` with the prompts actually used, and a row for the file in its file table, in the same shape as the other sheets.
