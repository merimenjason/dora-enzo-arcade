# Grumble Hunt: art for the two post-game beasts

Sent to Codex through the plugin on 26-10-2026, after brief 10 finished. Two new beasts arrive after the story: **Paddlepaw**, a belly-sliding river otter in Soggy Marsh, and **Rumblesnout**, a burrowing badger in Pebble Hollow. They need turnaround sheets like the other five beasts (the sheets are shown on the hunt board, the quest board, the Beast Book and the entrance card) and icons for their six materials.

Don't change any code: Claude wires the art into `app/hunt/`, `lib/` and the 3D models. Leave the files uncommitted.

## Files

| File | Size | What |
|---|---|---|
| `public/art/hunt/ref-paddlepaw.webp` | 2048 × 1024, RGB | Paddlepaw turnaround |
| `public/art/hunt/ref-rumblesnout.webp` | 2048 × 1024, RGB | Rumblesnout turnaround |
| `public/art/hunt/icons-materials-2.webp` | 1024 × 1024, RGBA | the six new materials |

Match the existing files: look at `ref-bristleback.webp`, `ref-hornclack.webp` and `icons-materials.webp` first. Save the turnarounds as WebP at quality about 90, and the icon sheet as lossless WebP with alpha.

## Turnarounds

Use the same preamble as the five existing `ref-*` prompts in `docs/grumble-hunt-art.md`, word for word, then one of these subjects.

```text
Subject: Paddlepaw, a chubby sulky river otter with sleek warm-brown fur, a cream face and belly, small round ears, long white whiskers, a thick flat paddle tail and four short webbed paws. A little woven-grass pouch on a cord across its chest holds one round grey river stone. Small grumpy eyes under heavy brows, closed mouth, never scary. Relaxed standing pose on all four paws, tail lying flat behind; same pouch and tail in every view.
```

```text
Subject: Rumblesnout, a stocky grumpy badger, grey back with a bold white-and-charcoal striped face, a long pink-tipped snout, small round ears, short sturdy legs with big rounded digging paws (no sharp claws), and a short tufted tail. A little crown of smooth sand-coloured pebbles sits stuck in the fur on top of its head like a cap. Small grumpy eyes under heavy brows, closed mouth, never scary. Relaxed standing pose; same pebble crown in every view.
```

## Material icons

`icons-materials-2.webp`, a 4 × 4 grid of 256 × 256 cells. Only the first six cells are used:

| Cell | Material |
|---|---|
| 0 | Otter fluff: a soft curl of warm-brown fur with a cream tip |
| 1 | Smooth river stone: one round flat grey stone, polished and shiny |
| 2 | River pearl (rare): a round pearl with a soft pink-blue sheen, on a little water lily leaf |
| 3 | Striped fur: a tuft of grey fur with a white-and-charcoal stripe |
| 4 | Crown pebble: three smooth sand-coloured pebbles stuck together with a little fur |
| 5 | Geode heart (rare): a split round geode with warm purple crystals inside |

Cells 6–15 stay fully transparent.

Generate the row strips one at a time (full sheets time out): row 1 is cells 0–3, row 2 is cells 4–5 then two empty cells. Use the `icons-materials` preamble in `docs/grumble-hunt-art.md`, changed from a 4 × 4 atlas to a single 1024 × 256 strip of four cells.

## Packing

- Downscale the turnarounds to 2048 × 1024.
- Stack the icon strips into one 1024 × 1024 sheet; check every drawing sits inside its own cell with even padding, and that cells 6–15 are fully transparent.
- Add `### ref-paddlepaw`, `### ref-rumblesnout` and `### icons-materials-2` sections to `docs/grumble-hunt-art.md` with the prompts actually used, and rows for the three files in its file tables, in the same shape as the existing sheets.
