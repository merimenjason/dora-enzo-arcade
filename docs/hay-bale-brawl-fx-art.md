# Hay Bale Brawl · effects artwork handoff

Prepared 18-10-2026 from main `8bd5103` using the built-in image generation tool and the three existing critter sheets as style references. **Wired into the game the same day (PR #77);** see **Status** below. The instructions are kept as the record of what was asked.

## Status · implemented 18-10-2026

- **Registry.** `fx` is the eighth entry in `lib/hay-bale-crops.ts` (`BRAWL_ASSETS`, PNG, hash `fe0a4128c317`); `BRAWL_FX_IDS` lists the twelve keys above in cell order and `BRAWL_FX` their measured padded rects, copied from `hay-bale-brawl-fx-crops.json`. The original seven entries and hashes are unchanged.
- **Painter.** `paintBrawlFx(c, id, x, y, size, { alpha, flip, rot })` in `lib/hay-bale-paint.ts` centres one cell on its anchor and contain-fits the whole padded crop into a `size` square, so every silhouette keeps its aspect and is never cropped. It returns false while the sheet is pending or failed, through the same request deduplication, failure state, subscriptions and Retry as the other files.
- **Scene.** `lib/hay-bale-scene.ts` paints: `bonk` (hits), `hay` (flung away from the hit, mirrored for direction), `dust` (landing, a mirrored pair), `poof` (knock-outs, summons, Sell), `gold` (abilities, level-ups), `green` (buffs), `frost` (freeze), `crumbs` (eating), `acorn` (purse, price tags, card footers, Sell, the sold acorn's flight) and `shell`/`mint`/`chilli` (status charms; a used-up Shell swells and fades). Each is a still picture that only grows, drifts and fades with its event's progress or effect age, with the timings, anchors and reduced-motion rules of `lib/hay-bale-motion.ts` unchanged; nothing cycles through the sheet and nothing moves between events. Every code drawing stays as the fallback. Charms sit beside the level plate when the box has room (the shop line) and just above the box's top-right corner when it doesn't (40 px fight boxes), so no pips, badges or prices are covered. Confetti and speed lines stay code-drawn (they have no cell).
- **Page.** The shop and fight screens (and End turn) request `fx` with their other files; `window.__brawl().art.fx` exposes the painter for tests.
- **Checks.** `tests/hay-bale-art.mjs`: eight files at 1536 × 1024 with their hashes, `fx.png` byte-identical to the manifest, all twelve rects equal to the crop map, inside their cells and covering their measured silhouettes, and the painter (one request, fallback while pending, centred, fitted, aspect kept, alpha restored). `tests/e2e/brawl.mjs` adds six checks that record which `fx.png` cell every draw uses: all twelve cells at their game sizes on dark and cream; frozen shop and fight frames on desktop and on a DPR-3 phone (every shop effect, the charms, the price tags, then a fight's hit, buff, ability, faint, summon and used-up shell, with no rect outside the twelve and only the still icons once effects end); reduced motion (charms and acorns only); a slow sheet (drawings stand in, buying works, paintings take over); and a failed sheet (asked for once, play goes on, Retry paints). A deliberately broken painter made the frozen-frame check fail. Typecheck, `npm test`, `npm run bot:hay-bale` (policy 37.3%), all 23 brawl browser checks and the production build passed.

## Delivered file

- **File:** `public/art/brawl/fx.png`
- **Format:** 1536 × 1024 RGBA PNG, invisible 4 × 3 grid.
- **Size:** 1,567,292 bytes.
- **SHA256:** `fe0a4128c317a147936afd70aeaf2f9dd10d69b10ddda6b6129da972340aef1f`.
- **Transparency:** real alpha-zero exterior; 87.3% of the canvas is fully transparent.
- The selected image generation output was copied byte-for-byte. No alpha cleanup, resampling, recolouring or crop processing was applied to the production file.

Exact generation and spacing-correction prompts, reference paths, candidates and hash: [generation manifest](hay-bale-brawl-fx-generation.json). Measured complete silhouettes and eight-pixel padded source rectangles: [crop map](hay-bale-brawl-fx-crops.json).

## Cell order

Indices are zero-based, left to right, top to bottom. The keys below are proposed effect keys for integration, not existing runtime exports.

| Index | Key | Painting |
| --- | --- | --- |
| 0 | `bonk` | Yellow impact burst with eight uneven points and orange-red edge |
| 1 | `dust` | Small cream-white landing puff |
| 2 | `poof` | Larger round cloud with loose wisps |
| 3 | `hay` | Flying golden straw wisps |
| 4 | `gold` | Golden four-point twinkle |
| 5 | `green` | Matching green four-point twinkle |
| 6 | `frost` | Pale-blue snowflake glint cluster |
| 7 | `crumbs` | Brown and cream cake/seed crumbs |
| 8 | `acorn` | Brown acorn, textured dark cap and tiny stalk, matching the Squirrel reference |
| 9 | `shell` | Glossy amber honey bubble |
| 10 | `mint` | Two bright mint leaves and cool green glints |
| 11 | `chilli` | Red chilli with a warm orange heat curl |

## Integration instructions for Claude

1. Add `fx` as an eighth asset in `lib/hay-bale-paint.ts` / `lib/hay-bale-crops.ts`, following their actual registry and hash conventions. Keep the existing seven asset entries and source hashes intact. The original seven-image manifest remains unchanged; this supplementary sheet has its own manifest and crops.
2. Generate a typed effect crop table from the supplementary JSON. Its `rect` values are **[x, y, width, height] in source pixels**, including eight pixels of transparent padding. Do not copy equal grid cells as tight sprites; the deliberate gutters would make effects too small.
3. Request the sheet lazily for shop/fight screens where effects or status icons need it. Reuse the existing request deduplication, failure state, explicit Retry and subscriber notification paths. Loading artwork must not delay play.
4. In `lib/hay-bale-scene.ts`, use each painting where its corresponding code effect is already drawn: bonks, landing puffs, faint poofs, hay, gold/green twinkles, frost, crumbs and purse/price acorns. Use the final three cells for Shell, Mint and Chilli status icons, sized so they cannot cover stats or prices. Keep every original drawing as the pending/failed-image fallback and omit it only when its painted replacement actually draws.
5. Preserve the existing event timing, alpha, direction, destination and reduced-motion rules from `lib/hay-bale-motion.ts`. Each cell is a single effect/icon, not an animation frame. The full sheet must never be played as a twelve-frame animation. Reuse bounded, event-driven scale/fade/translation; add no continuous bouncing or flashing.
6. Fit complete crops with preserved aspect ratio and centre impact/twinkle effects on their event anchor. Keep dust/poof wisps and hay fragments inside the intended effect area. Paint the coloured glow/heat illustrated inside a crop as part of that icon; do not add external CSS glow, white matte or drop shadow.
7. Extend the art mapping/hash/loader checks and browser coverage for all twelve cells, status icons and price tags. Exercise slow/failed `fx.png`, fallback, successful Retry and reduced motion. Recheck title/Almanac artwork subscriptions if shared loader code changes.
8. Run the existing Hay Bale Brawl art, motion, engine, bot and browser suites, typecheck and production build. Update the effects delivery status in the prompt document, main art notes, handoff and changelog only after runtime wiring is verified.

## Checks completed for this delivery

- Image decodes as the requested 1536 × 1024 RGBA PNG with true transparency.
- All twelve expected subjects occupy the requested cells. No text, labels or visible grid is painted into the sheet.
- Every visible silhouette has at least 10% clear margin on all four sides of its cell, measured at alpha greater than 8 to exclude nearly invisible generation noise; every padded crop remains inside its cell.
- Complete crops were reviewed against dark navy and cream at 30 pixels tall. The dust and larger poof remain distinct, and the acorn reads as a brown nut rather than a metal coin.
- The two twinkles have the same four-point design and matching proportions. Normalized visible silhouettes overlap by 96.2%; tiny raster differences remain, so they are not claimed to be pixel-identical masks.
- The copied production file's SHA256 matches the selected original. Runtime code was not modified, and no runtime integration checks are claimed for this art-only delivery.
