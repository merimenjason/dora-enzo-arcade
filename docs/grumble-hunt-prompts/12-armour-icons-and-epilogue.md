# Grumble Hunt: armour icons for five sets, and the epilogue panel

Sent to Codex through the plugin on 26-10-2026. Two pieces of art:

1. **Armour icons.** In the Forge, only the Bristle and Puffwart sets have their own painted icons (`icons-gear.webp` cells 9–14). The Skreel, Hornclack, Frostmane, Paddlepaw and Rumblesnout sets reuse the Bristle icons. This sheet gives each of those five sets its own helm, vest and boots.
2. **An epilogue story panel.** It introduces the two post-game beasts after the ending.

Don't change any code: Claude wires the art into `app/hunt/`. Leave the files uncommitted.

## Armour icons

**File:** `public/art/hunt/icons-armour.webp`, 1024 × 1024, lossless WebP with alpha, a 4 × 4 grid of 256 × 256 cells. Fill the cells in reading order, three per set (helm, vest, boots):

| Cells | Set | Look |
|---|---|---|
| 0–2 | Skreel | slate-blue feathers, cream down trim, a small yellow beak-shaped clasp |
| 3–5 | Hornclack | slate-grey rounded shell plates, sand-coloured horn-tip details |
| 6–8 | Frostmane | pale white-blue fur, icy-blue mane tufts, soft frosty trim |
| 9–11 | Paddlepaw | warm-brown otter fur, cream trim, a woven-grass pouch with a little round grey stone |
| 12–14 | Rumblesnout | grey fur with a white-and-charcoal stripe, a few smooth sand-coloured pebbles as studs |

Cell 15 stays fully transparent.

**Style:** match the Bristle and Puffwart armour in `icons-gear.webp` cells 9–14, and use them as shape references. Each set has:

- a cosy rounded **helm** with two big openings for large chinchilla ears;
- a padded **vest**;
- a **pair** of puffy **boots**.

Keep the same three-quarter view, top-left light, thick dark-brown outline readable at 48 px, and each icon centred within 208 × 208 of its cell. No whole characters, text, grid lines or watermarks.

**Generate one set (three icons) per request.** Full sheets time out. Use the `icons-gear` preamble in `docs/grumble-hunt-art.md`, changed to a 768 × 256 strip of three cells. Then pack the five strips into the grid in the order above.

## Epilogue panel

**File:** `public/art/hunt/story-6.webp`, 1600 × 1000, RGB, WebP at quality about 90.

Use the `story-end` prompt in `docs/grumble-hunt-story-art.md` word for word for the preamble and the character description, then this story beat in place of its own:

```text
Story beat: A sunny afternoon at Clover Camp after the picnic. Dora and Enzo stand by the hunt board with Old Mossback the mossy tortoise with round glasses, looking curious and excited. Two new grumpy-but-cute beasts peek in from the edge of camp: Paddlepaw, a chubby sulky river otter with sleek warm-brown fur, a cream face and belly, long white whiskers, a flat paddle tail and a woven-grass pouch holding one round grey stone, sliding in on its belly from a stream; and Rumblesnout, a stocky grey badger with a white-and-charcoal striped face, a long pink-tipped snout, rounded digging paws and a little crown of sand-coloured pebbles on its head, poking up out of a fresh molehill of earth. Count exactly two beasts. Both look grumpy but endearing, never scary.
```

Look at `ref-paddlepaw.webp` and `ref-rumblesnout.webp` first, so both beasts match their turnarounds.

## Packing and docs

- Check that every armour icon sits inside its own cell, and that cell 15 is fully transparent.
- Add an `### icons-armour` section to `docs/grumble-hunt-art.md`, and a `### story-6` section to `docs/grumble-hunt-story-art.md`, each with the prompts actually used. Add rows to both files' tables, in the same shape as the existing entries.
