# Hay Bale Brawl · painted artwork integration instructions

Written 18-10-2026 for the art delivery (PR #68). **Implemented the same day:** the game now paints every subject from these files, with its code drawings as loading and failure fallbacks. The instructions below are kept as the record of what was asked; **Status** says what was built and how it was checked.

## Status · implemented 18-10-2026

- **Files.** `lib/hay-bale-crops.ts` is the typed table generated from the crop map and the files' hashes; `lib/hay-bale-paint.ts` is the loader and painters (`requestBrawlArt`, `subscribeBrawlArt`, `brawlArtVersion`, `brawlArtStatus`, `retryBrawlArt`, `paintBrawlUnit`, `paintBrawlSnack`, `paintBrawlExtra`, `paintBrawlBackdrop`, `paintBrawlTitle`). URLs carry the first 12 hex digits of each served file's SHA-256 as `?v=`. Nothing is fetched or created at import.
- **One change from the delivery:** the two opaque backdrops are served as quality-85 WebP (`bg-shop.webp` 226,920 bytes, SHA-256 `0cf59b96…`; `bg-fight.webp` 231,702 bytes, `5b20d425…`), about 10% of the PNGs, as Whisker Ware does. The PNG originals stay in git at `f4f1ac5` and their hashes in the generation manifest. The four sheets and the title are the delivered PNGs byte for byte.
- **Renderer.** `drawCritter`, `drawSnack`, `drawCoach`, `drawShop`, `drawFight` and `drawTitle` try the painting first and keep their drawings. The fight row moved down so feet stand on the painted straw (y203) and badges sit below them; the result panel moved below the badges. The title's name sits on a cream plate in the picture's empty band. Level labels, hints and fight names sit on light plates. The decorative bale is the coach's perch in the shop.
- **Page.** Each screen prefetches its files; the title and Almanac canvases subscribe to the art version; a **Retry artwork** notice appears under the bar only after a failure. Reduced motion shrinks the lunge and stops rising numbers, the knock-out puff and the fallback's breathing, without touching replay timing.
- **Checks.** `tests/hay-bale-art.mjs` (in `npm test` and `npm run test:hay-bale`) checks the files' sizes and hashes, every key's crop against the crop map, and the loader (SSR safety, one request per file, fallback while pending, no per-frame retry, stale callbacks after a retry, wrong-sized images, contain fit, bottom alignment, mirroring). `tests/e2e/brawl.mjs` adds five painted-art browser checks: all 44 subjects both ways on dark and cream; shop, drag, the three summons and a whole fight at 390 × 844, DPR 3, reduced motion; a hidden tab; a whole turn with the art held back; every file failing, one request each, and Retry repainting the title and Almanac in place. Screenshots go to `.checks/brawl/`.

Start with [the delivery notes](hay-bale-brawl-art.md), [the crop map](hay-bale-brawl-crops.json) and [the generation manifest](hay-bale-brawl-generation.json). The running game is described in [the rules](hay-bale-brawl.md). Keep its engine, replay events, seeded results, saves, prices, abilities and shop interaction coordinates intact.

## 1. Build a small, independent painted-art layer

Suggested new files: `lib/hay-bale-crops.ts` for typed asset/crop mappings and `lib/hay-bale-paint.ts` for browser loading and Canvas painting (both built; see **Status**). Use the on-demand loading and subscription patterns in `lib/whisker-ware-paint.ts` as a reference, with a separate Brawl asset registry and cache.

- Registry: exactly the seven delivered files under `/art/brawl/`, with content-hashed URLs derived from the delivered SHA256 values. Validate decoded dimensions against 1536 × 1024.
- Importing the module must be safe on the server: create no `Image`, touch no `window`, and start no requests at module scope.
- Track pending/ready/failed per asset, deduplicate requests and notify subscribers on completion or failure. Painters return `false` immediately if their image is unavailable; the caller uses the existing drawing in that frame.
- Retry is explicit, for failed files only. Ignore stale completion callbacks after a retry; a failed file must not be requested again on every animation frame.
- Suggested helpers: `requestBrawlArt(keys)`, `subscribeBrawlArt(callback)`, `brawlArtVersion()`, `brawlArtStatus()`, `retryBrawlArt()` and `paintBrawlSprite(context, key, box, facing)`. These are proposed APIs, not existing exports.
- Read the crop map at build time or generate a typed static table from it. Do not fetch the JSON manifest at runtime or ship machine-local generation paths in a client bundle.

Suggested request priorities:

| Screen | Request |
| --- | --- |
| Title | `title.png` and `bg-shop.png` |
| Shop | `bg-shop.png`, `snacks.png`, `critters-3.png` for the coach, and sheets needed by the current crew/offers |
| Preparing a fight | `bg-fight.png` and every sheet used by both lineups; preload all three critter sheets if summons may introduce another sheet |
| Almanac | All three critter sheets and `snacks.png` |

Never wait for artwork before allowing play, opening the Almanac or advancing a replay.

## 2. Map exact engine identifiers to atlas indices

Every index is **zero-based, row-major**. `rect` in the crop map is the padded source rectangle, `[x, y, width, height]`; use it rather than a whole equal-sized cell. The names below match `UnitId`, `TokenId` and `SnackId` in `lib/hay-bale-units.ts`.

| Sheet | Engine keys in index order |
| --- | --- |
| `critters-1.png` | `wren`, `mouse`, `ladybird`, `toad`, `bee`, `dormouse`, `hedgehog`, `squirrel`, `robin`, `mole`, `frog`, `pip` |
| `critters-2.png` | `badger`, `otter`, `magpie`, `rabbit`, `porcupine`, `beaver`, `stoat`, `tortoise`, `crow`, `skunk`, `raccoon`, `hare` |
| `critters-3.png` | `boar`, `bear`, `stag`, `duchess`, `hawk`, `goose`, `mouselet`, `log`, `fawn`, coach `dora`, coach `enzo`, decorative `bale` |
| `snacks.png` | `apple`, `raisin`, `honey`, `hay`, `mint`, `chilli`, `seed`, `cake` |

Important name differences: Field Mouse is `mouse`, Log Dam is token `log`, Hay Bundle is snack `hay`, Mint Leaf is `mint`, Sunflower Seed is `seed`, Acorn Cake is `cake`. Keep coach/decorative keys separate from unit/token keys. The bale is not a recruitable unit or summon.

## 3. Replace drawings at the shared entry points

All scene entry points below are in `lib/hay-bale-scene.ts`.

| Entry point | Integration |
| --- | --- |
| `drawCritter` | Try the mapped painted unit/token first, then return on success. Keep the existing body as fallback, including the Pip and Duchess branches. This one entry point covers crew, offers, fight replay, drag ghosts and Almanac previews. |
| `drawSnack` | Try the mapped snack in an inset art box that leaves the cost text clear. Keep the existing code drawing if unavailable. Check the larger Almanac use of this same function. |
| `drawCoach` | Select coach Dora/Enzo at indices 9/10 of `critters-3.png`; use the original `drawChinchilla` while unavailable. Do not accidentally use Pip or Duchess. |
| `drawShop` | Paint `bg-shop.png` before panels, cards and actors. Use its existing backdrop as fallback. Retain shop slot boxes, selection/frozen cues, hover descriptions, cost/stat text and controls. |
| `drawFight` | Paint `bg-fight.png` before crews and effects. When it is ready, avoid drawing a second code bale over the painted one. Preserve the fallback backdrop and bale together when it is unavailable. |
| `drawTitle` | Paint the full title illustration over a suitable backdrop; keep game title/tagline as code-rendered text with sufficient contrast. When the illustration loads, omit the old individual coaches/critters/bale so the scene is not doubled. Keep those drawings as the fallback group. |
| `bale` | Use the isolated bale crop only where a discrete decorative bale is wanted. Do not stretch the round bale sprite across the fight's entire width; its backdrop already provides the continuous stage. |

Keep `drawStats`, ability callouts, hit/buff feedback, result panels and labels code-rendered. A clipped or unreadable stat badge must not be solved by painting it into the sprite.

## 4. Fit actors to the actual artwork

- Preserve each source crop's aspect ratio. Start with contain fitting inside the available art box, horizontally centred and bottom-aligned. Include the eight-pixel transparent crop padding. Check body size across the roster, especially a wide tail versus a narrow bird; adjust per-actor art-box padding if needed while keeping the complete silhouette inside its slot.
- Mirror only the painted actor around its destination centre for the rival crew, using `save`/`restore`. Stats, text and effects keep their normal orientation. Do not mirror a whole scene or card.
- Preserve the existing replay attack displacement and knock-out opacity. Avoid adding a second independent bob/scale loop to the painted sprite. These sheets contain one static pose per subject, not frames of a walk or attack cycle.
- The fight's painted straw contact line is about source **y650**, or logical **y203.1**. Its rough top spans y638–663. Check actor **feet**, not the bottom of the full stats box: the current renderer reserves 18 logical pixels below critter art for stats, so reusing that art box without a placement adjustment can leave painted actors floating above the stage. Keep labels clear beneath or beside the feet.
- Render full backdrops with the same 3:2 transform as the scene. The shop's logical `LAYOUT` is also used by pointer targeting; do not move its boxes without updating input mapping and its tests together.
- The title has a visually empty upper quarter. Drawing the complete 1536 × 1024 image preserves this band; using a tight silhouette crop removes it. Test title/subtitle positions and contrast against both loaded and fallback scenes.

## 5. Refresh static canvases when art arrives

`app/brawl/page.tsx` has two rendering paths:

- Shop/fight use the animation loop, which redraws continuously while visible. Keep its existing hidden-tab behaviour and avoid advancing replay time from artwork callbacks.
- `Still` draws the title and all Almanac pictures in an effect that currently depends only on `draw`. A title receiving the stable `drawTitle` function will otherwise remain on its fallback after a late image load. Subscribe `Still` to a stable artwork version, such as through `useSyncExternalStore`, and include that version in its drawing effect. Supply an SSR-safe server snapshot and unsubscribe on unmount.

Add one unobtrusive, accessible Retry artwork control when failures exist. A retry should repaint title/Almanac canvases as well as the stage. Do not duplicate requests per Almanac card or reset a run/profile while retrying.

## 6. Validation and completion handoff

Before merging the runtime integration:

1. Verify all seven assets resolve and their content hashes match the delivered manifest. Validate every unit/token/snack key is mapped once, with separate coach/bale entries, and all crops remain inside their source image.
2. In a browser, render every one of the 44 subjects on dark and cream backgrounds, including both unit facings; inspect at approximately 50 pixels tall. Check tails, antlers, wing tips, whistle cords and badge clearance.
3. Exercise title, both coaches, shop offers/crew/snacks, selected and frozen cards, drag ghosts, all three summons, the fight's front and back slots, attack offsets, knock-outs, result panel and the complete Almanac.
4. Delay an image request and prove controls remain usable. Fail a request, check fallback/Retry, then prove a successful retry replaces the fallback without navigation. Explicitly test the static title and Almanac redraws. Check no repeated per-frame requests and no stale callback overriding a retry.
5. Check desktop and phone layouts, DPR sizing, keyboard/tap/drag input, hidden-tab resume, reduced motion and readable text over the paintings. Keep screenshots relative to the project, under `.checks/`.
6. Run `npm run typecheck`, `npm run test:hay-bale`, `npm run bot:hay-bale`, `npm run test:e2e:brawl` and `npm run build`, plus focused painted-art checks following the existing test conventions. Broader CI runs `npm test` too.
7. Update `HANDOFF.md`, the README game guide, `docs/hay-bale-brawl.md`, this document and the dated changelog to say what is actually integrated and tested. Keep generation prompts, original hashes and crop provenance; if optimizing runtime copies to WebP, record their paths/hashes and retain clear source-to-runtime mapping.

All seven steps were done on 18-10-2026; see **Status**.
