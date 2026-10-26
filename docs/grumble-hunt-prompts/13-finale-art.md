# Grumble Hunt: the epilogue retry, the finale panel and the keepsake icons

Sent to Codex through the plugin on 26-10-2026. Three pieces, in this order. Icons first, because small requests have worked and full story panels have been timing out:

1. `public/art/hunt/icons-keepsakes.webp`: the finale keepsake and the turf-bonk emblem.
2. `public/art/hunt/story-6.webp`: the epilogue panel from brief 12. All eight earlier attempts timed out.
3. `public/art/hunt/story-7.webp`: the finale panel.

Don't change any code: Claude wires the art in. Leave the files uncommitted. If a panel still times out after three tries, stop trying it and say so; the game falls back to the ending painting.

## Keepsake icons

**File:** `icons-keepsakes.webp`, 1024 × 1024, lossless WebP with alpha, a 4 × 4 grid of 256 × 256 cells. Only cells 0 and 1 are used; the other 14 cells stay fully transparent.

Generate one 1024 × 256 strip of four cells with the `icons-charms` preamble in `docs/grumble-hunt-art.md` (cells 3 and 4 empty), then put it in the sheet's top row.

```text
Left to right: Best of Friends ribbon (a soft rosette keepsake made of a teal river-blue ribbon and a sand-brown ribbon woven together, with one smooth round grey river stone and one small sand-coloured pebble stitched in the middle, short tails hanging down); Turf bonk emblem (an orange dashed circle on the ground with two small round puffs of dust bumping in the middle and three little yellow stars popping up, no animals); EMPTY; EMPTY.
```

## Epilogue panel (`story-6.webp`)

Same prompt as brief 12, sent text only, 1600 × 1000 RGB WebP at quality about 90.

## Finale panel (`story-7.webp`)

1600 × 1000 RGB WebP at quality about 90. Use the `story-end` preamble and character description from `docs/grumble-hunt-story-art.md`, then this story beat:

```text
Story beat: Golden sunset on a grassy riverbank beside a pebbly hill. Dora and Enzo sit happily with two beasts curled up asleep together: Paddlepaw, a chubby river otter with warm-brown fur, cream face and belly, white whiskers, a flat paddle tail and a woven-grass pouch with one grey stone; and Rumblesnout, a stocky grey badger with a white-and-charcoal striped face, a long pink-tipped snout and a little crown of sand-coloured pebbles. The otter's tail rests across the badger like a blanket. A woven teal-and-sand ribbon rosette lies on the grass in front of Dora. Fireflies, soft warm light. Count exactly two beasts, both peacefully asleep, never scary.
```

## Docs

Add `### icons-keepsakes` to `docs/grumble-hunt-art.md`, and update `### story-6` and add `### story-7` in `docs/grumble-hunt-story-art.md`. Record the prompts actually used, any timeouts, and the table rows, in the same shape as the existing entries.
