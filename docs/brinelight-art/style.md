# Brinelight · palette and style guide

Written 12-11-2026, before the second round of painting. Every Brinelight painting follows this page. The prompts are
in [`jobs.txt`](jobs.txt) (`<id>|<size>|<prompt>`), the runner is [`gen.sh`](gen.sh), and
`scripts/brinelight-art.py` keys, scales and packs the sheets into `public/art/brinelight/`.

## The look

Polished hand-painted 2D game art: a harbour town on festival night. Warm paper-lantern glow against a deep
blue-violet dusk, rich painterly texture, crisp readable silhouettes, soft warm rim light, bright and comic, never
scary. The two mock-ups (`brine-play`, `brine-boss`) are the target and are passed to every job as references. This
is not pixel art: sprites are painted at about 300 px tall and drawn at 150 to 180 px, so they stay smooth.

## Palette

| Role | Colours | Notes |
|---|---|---|
| Dusk sky | `#1d1b4a` `#3b2f78` `#7a4f9a` `#e58aa0` | violet to rose at the horizon |
| Harbour water | `#1f3d6e` `#2f6fa0` `#9fd8ff` (glints) | |
| Lantern light | `#ffd27a` `#ffb347` `#ff8f4a` | the reward colour; only lit lanterns and gold use it |
| Wood (quay, crates) | `#6b3e22` `#a8652f` `#d9934a` | |
| Stone (breakwater, market) | `#4b4f5e` `#7d8292` `#b9bfcc` | |
| Night wash (code) | `rgba(16,18,58,.30–.44)` | lifts as lanterns are relit |
| Cream rule (Dora) | `#fff0c8` glint, `#ffe9b0` outline | wings and things in the air |
| Grey rule (Enzo) | `#dfe6ef` glint, `#c9d3df` sparks | shells, armour, claws, barrels |
| Hurt / danger (code) | `#ff8a6a` `#ff7850` | wind-up flicker, hurt sparks |
| HUD ink | `#fff4dc` on `#2a1a36` stroke | Fredoka 700 |

**Keys.** Sheets are painted on flat magenta `#FF00FF`. Anything violet, pink or purple (the mantis shrimp, jellies,
urchins) is painted on flat green `#00FF00` instead. The key-out removes the magenta cast that the ground leaves on
grey fur and white feathers.

## The heroes

Faces and fur come from `docs/bellspire-art/ref-pair.png` only; every accessory in it is ignored.

- **Dora:** cream-white fur, red eyes, big round pink ears, a fluffy cream tail. Festival outfit: a short coral-red
  jacket with gold braid frogging over a white sash, rolled cream sailcloth trousers, barefoot.
- **Enzo:** grey fur, dark eyes, big round pink ears, a fluffy grey tail. A sleeveless teal dockhand's waistcoat with
  brass buttons, a wide ochre sash, rolled canvas trousers, barefoot.
- Neither carries anything of their own. They are told apart by fur and silhouette: Dora is light and leggy, Enzo
  is broad and low.
- Every frame faces right, full body, side-on, on one shared ground line and scale. Every later sheet repeats the
  idle stance as its first frame, so the packer can match its scale to the first sheet.

## Animation

Every action has its own painted frames; code adds only squash, shake and effects.

| Action | Dora | Enzo |
|---|---|---|
| Idle | 2 (breathing) | 2 |
| Walk | 4 | 4 |
| Dash | 1 lean + dash attack | 1 charge + shoulder barge |
| Combo | 3 hits, each a wind-up and a strike, plus a follow-through on the finisher | 3 hits, the slam with raise and impact |
| Jump / fall / land | 3 | 3 |
| Air attack | dive kick, rising kick | air hammer |
| Grab / hold / throw | (kicks a popped shell) | reach, hold overhead, wind-up, release |
| Hurt / down / get up | 2 / 1 / 1 | 2 / 1 / 1 |
| Tag-in | leap, flying kick | belly-flop fall, landing |
| Dash special | take-off, spin ×2, impact | take-off, dive ×2, shockwave landing |
| Heave | – | tug (ripping barrels, wrenching claws, pinning) |
| Interact | crouch to pick up | crouch to pick up |
| Victory | 2 | 2 |

Foes get idle, a two-frame walk, a two-frame wind-up (the tell), the attack, hurt, knock-down and get-up.

## Composition rules for prompts

- Each item centred in its own cell with plenty of key colour around it, never touching or cropped.
- No ground shadows, floor, borders or grid lines on sprite sheets; code draws the shadows.
- No text anywhere, not even blurry fake writing. HUD words are typeset by the page.
- Backgrounds for the walkable belt are painted as a strip: transparent (key colour) sky in the top 40 percent, then
  the back railing or stall line, then the floor down to the bottom edge, tileable left to right.
- Far backgrounds are opaque paintings with no foreground and no walkway.
- Fewer, bigger, readable shapes: a crowd of tiny details turns to mush at play size.
