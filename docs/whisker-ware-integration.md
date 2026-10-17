# Whisker Ware · implementation handoff

17-10-2026. The user requested integration, merge and push, then clarified **prepare the artwork loader and handoff for Claude**. This package ships all 34 PNGs and the tested Canvas loader. It does not build the game from the [approved design](superpowers/specs/17-10-2026-whisker-ware-design.md), add a menu card or change the arcade's count of 34 playable games. Claude's implementation plan and runtime come next.

## Files to use

| File | Purpose |
| --- | --- |
| `public/art/whisker-ware/*.png` | 34 selected originals, all 1536 × 1024: five sprite sheets, title, four rooms, 24 microgame backgrounds. |
| [`whisker-ware-art.md`](whisker-ware-art.md) | Visual review, sheet order, character canon and integration traps. |
| [`whisker-ware-crops.json`](whisker-ware-crops.json) | Measured complete silhouettes, padded matching-pose frames, visual ground/contact survey. |
| [`whisker-ware-generation.json`](whisker-ware-generation.json) | Exact prompts/corrections, source and final hashes, dimensions and alpha measurements. |
| [`../lib/whisker-ware-crops.ts`](../lib/whisker-ware-crops.ts) | Typed runtime copy of frames, names, content hashes and background anchors. |
| [`../lib/whisker-ware-paint.ts`](../lib/whisker-ware-paint.ts) | Optional, nonblocking loader and painters; no game-engine dependency. |

## Load during transitions

```ts
import {
  prefetchWareMenu, prefetchWareHost, prefetchWareGame,
  subscribeWareArt, wareArtVersion, wareArtServerVersion,
  wareArtStatus, retryWareArt,
  paintWareHost, paintWareProp, paintWareTitle, paintWareBackdrop,
} from '@/lib/whisker-ware-paint';

// Menu mount: only hosts/title. Selecting a host loads its room/props.
prefetchWareMenu();
prefetchWareHost('dora');
// Once the next game is selected, preload it during the break.
prefetchWareGame('hop');
```

Do not request all 28 environments on the title screen. Helpers deduplicate requests; repeated calls from a render loop are safe. Missing or wrong-sized images become failed entries and wait for an explicit retry, rather than making another request on every frame. PNG URLs include their selected source hash; update `WARE_HASHES` when replacing an image.

For React, subscribe with `useSyncExternalStore(subscribeWareArt, wareArtVersion, wareArtServerVersion)` and use the returned version in each static canvas's redraw effect. A continuously redrawing stage can also subscribe to update its status UI. Subscribing returns an unsubscriber. `wareArtStatus()` returns `{ ready, pending, failed }`; show a **Retry artwork** button when `failed.length > 0`, calling `retryWareArt()`. No painter or prefetch helper waits for an image or advances simulation state.

## Draw paintings with code fallbacks

All boxes are `{ x, y, w, h }` in the caller's canvas coordinate system. Hosts and props contain-fit their complete shared source frame and align its bottom to the box's bottom. This preserves aspect ratio and pose scale without clipping tails, ears or detached effects.

```ts
const stage = { x: 0, y: 0, w: 480, h: 320 };
if (!paintWareBackdrop(ctx, 'bg-hop', stage)) drawCodeHopBackdrop(ctx);
if (!paintWareHost(ctx, 'dora', 'cheering', hostBox)) drawCodeDora(ctx, hostBox);
if (!paintWareProp(ctx, 'dora', 'dora-jump', actorBox)) drawCodeJump(ctx, actorBox);
if (!paintWareTitle(ctx, titleBox)) drawCodeTitle(ctx, titleBox);
```

The `drawCode…` calls above are placeholders for the upcoming scene's own fallback functions; they are not exports from this package. All painters return `false` immediately for pending/failed images, invalid indices or the intentionally empty Fox cell, so the caller can draw its fallback and keep the game running.

`paintWareSprite(ctx, sheet, zeroBasedIndex, box)` is available for indexed effects. Prefer named `paintWareProp` calls for clarity. Hosts use `presenting | cheering | oops`, and props use the names in `WARE_PROPS` (including the original brief's exact order). The title painter keeps the full image, including its transparent top third. Backdrops keep their full 3:2 image; a box of another ratio is letterboxed rather than cover-cropped. Fill the surrounding canvas if that case is needed.

The hosts are half-length presenters. Let their lower edge meet the stage/UI edge or a foreground counter; do not leave a flat-cut torso floating above the floor. These sheets are expressive poses, not animation-cycle frames. Keep movement grounded and use appropriate poses rather than cycling unrelated cells rapidly.

## Geometry and animation

- Use a 480 × 320 logical stage. Scale canvas and pointer coordinates together for phones and device pixel ratio.
- `fitWareBox(box, sourceWidth, sourceHeight, bottom?)` exposes the same contain transform used by the painters. For source-pixel anchors use `x = dest.x + sourceX / 1536 * dest.w`, `y = dest.y + sourceY / 1024 * dest.h`. Share that transform with hit targets; a different image transform causes invisible or misplaced interactions.
- `WARE_SURFACES` records visually surveyed source-pixel surface bands and suggested contact points. These are approximate presentation anchors, not engine collision rules. Sneak's perch top is about y=430, and Ring's useful tabletop is y=440–718 with contact around y=650; the requested percentages were not followed exactly by the generator. Confirm in the running game.
- Crop by measured `WARE_CROPS` frames, never by dividing the image into twelve equal rectangles. A wide Owl wing crosses a nominal cell boundary while still remaining separate from Dora. Common frame dimensions preserve size across moods, cheeks, fluff, run/jump and balloons.
- The dust bath is dry. Shelf has no baked platforms; Moon has no baked foreground roofs. Runtime draws those surfaces/hazards, plus Hide's shadow/lantern beam and Find's darkness/spotlight. Card faces reuse Acorn Hand's painted suit sheet as specified in the design.
- Respect reduced motion, pause and focus loss in the future page. The loader does not animate, set timers, change game state or start audio.

## Checks already completed

```sh
npm run test:whisker-ware-art
npm run test:e2e:whisker-ware-art
```

The first suite is included in `npm test`. It checks all 34 selected source hashes and PNG dimensions/types, 59 populated crop frames and matching-pose dimensions, SSR, deduplication, nonblocking pending/failure, explicit retry, stale callbacks, wrong-sized-image fallback and content-hash URLs.

The browser suite starts its own temporary local server and uses the real transpiled loader and original PNGs. It holds and aborts a host image, verifies controls/fallback, retries and observes subscribed redraw, checks menu/game load priorities, and draws all assets across 88 canvases. It verifies real alpha, opaque 3:2 backgrounds, single requests and 390px/1280px layouts with no page errors. Its gallery is a test harness, not a public route or a playable game. Screenshots are ignored under `.checks/whisker-ware/loader-phone.png` and `loader-desktop.png`.

When implementing cabinet 35, follow the README's complete **Adding a game** checklist and add the engine, bot, input, gameplay, pause/reduced-motion and real-page artwork regressions from the design. The asset harness does not substitute for those game tests. No implementation work is blocked on generating these 34 images.

Local validation before merge: typecheck, the full `npm test` suite (including all 34 existing games and the new art tests), production build, targeted oxlint, README consistency, Markdown whitespace/link checks and the final browser harness all passed.

Environments ship as quality-85 WebP, about 6% of the PNG size; the PNG originals are at `b0fa421`. `wareArtUrl` picks the extension from `WARE_EXT`.
