# Powder Paws · art brief

Written 01-11-2026.

Powder Paws is drawn as **crisp, colourful pixel art**: clean one-pixel dark outlines (`#1d1b2e`), a small bright palette (snow whites and ice blues, pine greens, cherry red, blueberry blue, sunny yellow), no gradients or soft brushes, and every pixel square at a whole-number scale (`imageSmoothingEnabled = false`). It is a new style for the arcade, unlike the painted, stained-glass, papercraft and clay looks of the games before it.

## In-game sprites (drawn in code)

Every sprite in play is drawn pixel by pixel in `lib/powder-art.ts` and cached:

- **Dora** (cream-white fur, ruby-red eyes) and **Enzo** (cool blue-grey fur, black eyes), each with a broad, slightly flat, smooth rounded crown, clean pink ears out to the sides and nothing sticking up from the head, a scarf, boots, poles and skis. Four views (front, three-quarter, side, back) in riding, tuck, snowplough, air, tail-grab, cheer and sitting poses, the skis drawn at the exact carving angle, plus a four-frame rolling snowball for the tumble. Cosmetic scarves, hats (beanie, goggles, helmet, all close to the head) and skis recolour them.
- The mountain: two pine sizes, birches, rocks, stumps, snowbanks, fences, huts, the cabins with their red postboxes, signposts, slalom flags, kickers and big ramps, moguls, ice and deep powder, the edge forest and the white-out storm front.
- The animals: a marmot and a stoat on skis, rabbits on a toboggan, a hedgehog on a tea tray. Every one faces the way it moves.

## Illustrations (Codex, then quantised)

Codex paints three illustrations as pixel art. Each is checked, then downscaled with nearest-neighbour sampling to a true low resolution and reduced to a limited palette with Pillow, so it is real pixel art when scaled back up:

- `public/art/powder/title.webp`: Dora and Enzo skiing side by side down a sunny snowy mountain, the snowstorm curling over the peak behind them.
- `public/art/powder/cocoa.webp`: inside a snug log cabin, the pair in blankets by the fire with mugs of cocoa while the storm blows past the window. Shown when the storm catches you.
- `public/art/powder/ending.webp`: the lodge party at the foot of Whiskerpeak: lanterns, bunting, the animals of the mountain, and Dora and Enzo in the middle with the ten postcards pinned up behind them.

Character rules for every illustration: Dora cream-white with ruby-red eyes; Enzo cool blue-grey (never brown or taupe) with black eyes; a broad, slightly flat, smooth rounded crown with a soft short-fur edge; clean pink ears; both wear scarves. If an illustration is missing, the page draws a pixel-art stand-in in code.
