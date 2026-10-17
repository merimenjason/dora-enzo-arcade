# Whisker Ware · painted art

Generated and reviewed 17-10-2026 from [`whisker-ware-image-prompts.md`](whisker-ware-image-prompts.md) at main `e3918c6`. The design is [`17-10-2026-whisker-ware-design.md`](superpowers/specs/17-10-2026-whisker-ware-design.md). These production assets and the tested artwork loader are ready for Claude's planned game implementation. The user chose an artwork-loader handoff, rather than building the full game in this change. No playable Whisker Ware route is added.

## Delivery

All 34 requested PNGs are saved in `public/art/whisker-ware/`: a host sheet, four prop sheets, a title illustration, four break rooms and 24 microgame backdrops. Every file is 1536 × 1024. The five sheets and title preserve generated RGBA transparency; the 28 environments are opaque RGB. Exact built-in `image_gen` prompts, correction passes and selected original paths are recorded in [`whisker-ware-generation.json`](whisker-ware-generation.json).

Final filenames and SHA256 hashes, dimensions, alpha measurements and all generation/correction attempts are in the generation record. The images preserve their generated pixels and alpha. No background removal, painted-over repairs or synthetic replacement artwork is applied after generation. Review composites are diagnostic previews, separate from the shipped originals.

## Character and layer rules

- Dora is ivory-white with dark ruby-burgundy eyes; Enzo is grey with a white chest and black eyes. Both stay dry. The Owl is tawny with amber eyes, the Fox russet with a cream chest.
- Actors and props are RGBA cutouts, with complete tails, ears, whiskers, hands and props. Side-view chinchillas face right and the swooping Owl faces left.
- Backdrops are full-bleed 1536 × 1024, matching the 480 × 320 stage. Do not use a cover crop or stretch them to 16:9.
- Commands, timers, lives, counters, shadows, hazards and moving gameplay objects remain live drawing/UI. They are not baked into the backgrounds. The dust bath contains dry bathing powder.
- The title reserves its top third for live text. Use a UI text colour/panel that remains legible over the menu's own background.

## Sheet order

All indices below are zero-based, row-major. Host sheets and prop sheets have four columns and three rows; this describes logical ordering, not safe equal-grid crop rectangles.

| Sheet | Cells |
| --- | --- |
| `hosts.png` | Enzo, Dora, Owl, Fox presenting; the same four cheering; the same four oops. |
| `props-enzo.png` | raisin, pebble, bowl, acorn, jar, heap, cup, stick, enzo-face, enzo-stuffed, enzo-gnaw, enzo-carry. |
| `props-dora.png` | dora-sit, dust, dora-balance, bale, dora-sleek, dora-puffed, dora-run, dora-jump, log, comb, tangle, plank. |
| `props-owl.png` | owl-back, owl-glance, owl-watch, owl-sleep, owl-swoop, dora-tiptoe, enzo-crouch, toy-mouse, toy-ball, toy-carrot, pinecone, feather. |
| `props-fox.png` | card-back, balloon-red, balloon-yellow, balloon-blue, balloon-green, pop, slingshot, target, crate, peg, ring; final cell deliberately empty. |

## Integration

Use measured complete silhouettes, including detached dust particles, whiskers and pop fragments. Nominal cell boundaries can cut off a wide wing even when the adjacent drawing does not overlap. The measured rectangles are in [`whisker-ware-crops.json`](whisker-ware-crops.json): `bounds` is the visible silhouette and `frame` includes padding and shared dimensions for matching poses. Both use source-pixel `[x, y, width, height]`. Bounds are measured from connected alpha components above 8/255, with detached fragments grouped by sprite. Eight pixels of padding keep faint edges clear. A few isolated alpha-1 pixels can occur outside visible silhouettes; these were left intact with the original generated pixels. The Fox sheet's final logical cell has no visible sprite.

The hosts are half-length presenters: let their lower edge meet the stage edge, a UI frame or a foreground counter rather than floating a cut-off torso above the floor. Keep related poses at a common scale and baseline: host moods per character, Enzo's normal/stuffed head, Dora's sleek/puffed body, and the four balloons. Never fit every pose independently to its own tight bounds; that makes characters jump in size during a change. Keep source alpha intact and add any contact shadow separately in the renderer.

These are expressive poses and props, not walk-cycle or attack-frame strips. Natural animation should select the appropriate pose and animate position/rotation with grounded timing; interpolating unrelated cells or rapidly alternating run/jump poses will produce jitter.

Follow the existing small-loader pattern: load the current host/scene first, notify canvases to redraw on arrival, retain code drawings during pending/failed loads, and provide Retry artwork. Acorn Hand's suit sheet is reused for the Fox's card faces. The implementation plan, game runtime and gameplay validation remain Claude's next work. The artwork loader itself and its integration harness are delivered and tested here; see [`whisker-ware-integration.md`](whisker-ware-integration.md).

## Background geometry

The generator does not place every floor or countertop exactly on the requested percentage. The visual source-pixel survey in `whisker-ware-crops.json` records visible surface bands and suggested contact anchors for 15 scenes. Measurements are approximate to 10 source pixels and need confirmation in the running game. Convert coordinates with `stageY = sourceY * 320 / 1024` and `stageX = sourceX * 480 / 1536`.

In particular, Sneak's final perch top is around source y=430 rather than the requested 55%; put the Owl on that visible beam. Ring's useful tabletop is y=440–718; a peg at 85% would sit on the counter's front face, so use about y=650. Floors drawn in perspective have a surface band rather than one collision edge. Keep these presentation anchors separate from engine rules, and apply the same transform to drawing and hit targets.

The moon boss background was corrected to remove its entire foreground roof/parapet. The live scene must draw the playable rooftops and gaps. Shelf has only its upper hammock and open enclosure, with no baked shelves. Hide has no painted cast shadow; the live shadow/beam remains unambiguous. Find is lit without a baked lantern spotlight and has no acorns or pinecones. Dust's basin contains dry bathing powder.

## Review and handoff

- Verified all 34 exact filenames against the brief, full PNG decoding, 1536 × 1024 dimensions, RGB/RGBA layer roles and hashes matching the selected generation sources.
- Reviewed all 59 populated sheet cells (12 hosts and 47 props), with complete measured crops on dark and cream. Reviewed all 47 props at up to 60px and the host portraits at approximately 180px.
- Reviewed all 28 backdrops and host/room/title scale composites. Corrected crowded sheet spacing, restored the Owl feather, removed decorative marks from the Owl sheet, corrected Enzo's eye colour, cleared the title text band/replaced its suit-marked card with a card back, lowered Sneak's perch, and removed the moon boss's static roof.
- Confirmed shared frame dimensions for host moods, normal/stuffed cheeks, sleek/puffed Dora, run/jump Dora and balloons. Sprite frames preserve complete silhouettes and exclude adjacent sprites.
- Loader tests cover SSR, request deduplication, lazy priorities, nonblocking fallback, explicit retry, redraw notifications, stale request callbacks, dimension validation and cache hashes. The real browser harness paints all 34 images across 88 canvases, checks alpha, exercises native touch/retry, and verifies phone/desktop layouts. README consistency and Markdown whitespace/link checks pass. Game engines, pages and runtime animations remain separate work.

Review previews live under ignored `.checks/whisker-ware/`: `hosts-dark.png`, the four `props-*-dark.png` and matching cream previews, `props-at-60px.png`, `backdrops-review.png` and `art-preview.png`. These are local inspection artifacts; the production assets and provenance files are the durable handoff.

## Runtime package

- `lib/whisker-ware-crops.ts`: typed asset names, content hashes, measured sprite frames, named props and the source-pixel background survey.
- `lib/whisker-ware-paint.ts`: lazy loader, status/subscription/retry helpers, and Canvas painters for hosts, props, title and backdrops. It imports no game engine and performs no requests on the server.
- `npm run test:whisker-ware-art`: loader state and asset/crop regressions, included in `npm test`.
- `npm run test:e2e:whisker-ware-art`: standalone Playwright harness using the real loader and original PNGs; starts its own temporary local server, so no dev game route is required.

Public assets deploy with the repository when merged. They become visible in the game once Claude imports and calls these painters from its implementation. The arcade remains at 34 playable games until that implementation adds cabinet 35.

Environments ship as quality-85 WebP, about 6% of the PNG size; the PNG originals are at `b0fa421`. Sprite sheets and the title stay PNG for their alpha.
