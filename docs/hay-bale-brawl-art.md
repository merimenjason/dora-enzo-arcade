# Hay Bale Brawl · painted art handoff

Prepared 18-10-2026 using the built-in image generation tool from the supplied production prompts, and **wired into the game the same day**: every subject is painted from these files, with the original code drawings as loading and failure fallbacks.

What was built, and how it was checked, is in the **Status** section of [the integration instructions](hay-bale-brawl-integration.md), which also keeps the original brief: proposed loader contract, exact engine-to-atlas mappings, shared renderer entry points, stage placement, static-canvas redraws and the validation checklist.

## Delivered originals

All files were delivered as **1536 × 1024 PNGs**, copied byte-for-byte from the selected image generation outputs into `public/art/brawl/`. No resampling, alpha cleanup or atlas cutting was applied. At integration the two opaque backdrops were re-encoded as quality-85 WebP for serving (`bg-shop.webp`, SHA-256 `0cf59b966cd5100466abc536c768b7f9ef45975231279be95f840e246cf1994f`; `bg-fight.webp`, `5b20d425bc038ab1a7410d2656cb9df5da2d2b2f3fc5f582ccdb253248f8d151`); their PNG originals remain in git at `f4f1ac5`, with hashes in the manifest. The sheets and title are served as delivered.

| File | Contents | Background |
| --- | --- | --- |
| `critters-1.png` | Tiers 1–2, 12 subjects | Transparent RGBA |
| `critters-2.png` | Tiers 3–4, 12 subjects | Transparent RGBA |
| `critters-3.png` | Tier 5, summons, coaches and bale, 12 subjects | Transparent RGBA |
| `snacks.png` | Eight snacks | Transparent RGBA |
| `bg-shop.png` | Golden-hour barn workshop | Opaque RGB |
| `bg-fight.png` | Meadow and continuous flat bale stage | Opaque RGB |
| `title.png` | Dora and Enzo on bale, five friends below | Transparent RGBA |

The complete delivery was about 13.7 MB in decimal units; with the WebP backdrops the game serves about 9.5 MB, loaded a screen at a time. Generation prompts, correction prompts, candidate history, selected source paths, file sizes and SHA256 hashes are in [the generation manifest](hay-bale-brawl-generation.json). The normalized original brief is in [the prompt document](hay-bale-brawl-image-prompts.md). The three supplied reference images were used for style and identity, not copied into the output.

## Atlas order

Indices below are **zero-based**, left to right and top to bottom. Critters use a 4 × 3 layout; snacks use 4 × 2.

- **critters-1:** Wren, Field Mouse, Ladybird, Toad / Bee, Dormouse, Hedgehog, Squirrel / Robin, Mole, Frog, Pip.
- **critters-2:** Badger, Otter, Magpie, Rabbit / Porcupine, Beaver, Stoat, Tortoise / Crow, Skunk, Raccoon, Hare.
- **critters-3:** Boar, Bear, Stag, Duchess / Hawk, Goose, Mouselet, Log Dam / Fawn, Dora, Enzo, Hay Bale.
- **snacks:** Apple, Raisin, Honey, Hay Bundle / Mint Leaf, Chilli, Sunflower Seed, Acorn Cake.

This covers all 30 recruitable critters, three summons, two coaches, one bale and eight snacks. Map game identifiers explicitly to these indices; do not assume a unit table is in sheet order.

## Crops and placement

[The crop map](hay-bale-brawl-crops.json) records all 44 subjects by name. `bounds` is the measured visible alpha silhouette; `rect` adds eight source pixels of transparent padding. Both are **[x, y, width, height] in source pixels**. `cell` is [left, top, right, bottom]. Alpha greater than 8 was used to exclude nearly invisible generation noise from the visual bounds.

Every visible silhouette has at least 10% clear margin on all four sides of its own logical cell; every padded crop stays within that cell. Include the entire crop, preserve aspect ratio and bottom-align it in its destination box. Do not stretch whole grid cells into actor boxes: the intended large gutters would make actors unnecessarily small. Mirror only the actor art for the rival crew; keep stat badges and labels readable. Preserve tails, whiskers, wing tips and stag antlers.

The title's visible artwork starts at y263, leaving the upper quarter visually clear for code-rendered text. That quarter contains isolated alpha-1 noise in the unchanged original, which is invisible in normal use; the visible crop threshold excludes it. Prefer the full 3:2 title canvas when retaining that empty text band. A tight alpha-bounds crop removes it.

### Actual backdrop geometry

These are visual surveys, about ten source pixels of precision, rather than engine coordinates:

- **Fight:** stage contact line about **y650 / 1024** (rough straw top band y638–663), or **y203** on the 480 × 320 logical canvas. The final painting places it around 63% of the height, close to the requested 60%. Align critter feet to the painted line. If the renderer retains another foot baseline, apply one consistent backdrop/actor transform rather than modifying battle rules or placing actors in front of the bale face.
- **Shop:** the perspective floor starts around **y750**, or y234 on the logical canvas. Central wall and floor are deliberately calm. Cards may overlay them.

Keep full-bleed 3:2 compositions intact. At logical size, source x scales by 480/1536 and source y by 320/1024. For another aspect ratio, contain/letterbox the complete composition and use the same transform for interaction coordinates.

## Visual checks completed

- Seven PNGs decode at exactly 1536 × 1024; five have real alpha-zero backgrounds and two are fully opaque.
- All 44 expected subjects are present in the specified order, facing right where meaningful. No text, visible grid, UI badges or labels are baked into the paintings.
- All 44 visible silhouettes pass the 10% cell margin check, and all eight-pixel padded crops stay inside their own cells.
- Reviewed the full sheets and individual crops on dark navy and cream backgrounds at 50 pixels tall. No visible background boxes or clipped silhouettes.
- Dora retains ivory fur and dark ruby-burgundy eyes; Enzo has grey fur, a white chest and black eyes. Pip remains lavender-grey; Duchess honey-gold with a crown.
- Production-file SHA256 hashes match the chosen generated originals.

These are static poses, **not animation strips**. Reuse the existing state-driven movement and impacts; avoid rapidly cycling different species or adding continuous whole-body bouncing. Any true articulated animation frames would be a separate art task.

## Integration checks

The art delivery changed no runtime code. The integration on 18-10-2026 ran all of these; see the integration **Status** for the tests that keep them:

1. Load lazily, repaint on arrival, retain drawn fallbacks and provide explicit retry for failed requests.
2. Check every unit/snack and summon, both coaches, rival mirroring, stat-label clearance, drag ghosts and knock-out positions.
3. Check fight feet against the actual stage, title text over its empty band and shop-card contrast.
4. Exercise a slow/failed image request, reduced motion, desktop and touch layouts.
5. Run `npm run test:hay-bale`, `npm run bot:hay-bale`, `npm run test:e2e:brawl`, typecheck and build; add focused painted-art browser coverage to the existing test conventions.
