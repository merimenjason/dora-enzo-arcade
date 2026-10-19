# Chinchilla Trek · painted artwork handoff

Prepared 19-10-2026 using the built-in image generation tool. **All twelve requested PNGs are generated; runtime integration is pending.** The current game still uses its code drawings. Original brief: [image prompts](chinchilla-trek-image-prompts.md). Rules and code overview: [Chinchilla Trek](chinchilla-trek.md).

## Delivery

Every file is **1536 × 1024**, under `public/art/trek/`. The twelve selected originals total 25,888,385 bytes. Production files were copied byte-for-byte from image generation outputs; no resizing, alpha cleanup, recolouring, mirroring or compositing was applied to their pixels. QA previews are separate and are not game assets.

| File | Contents | Layout/background |
| --- | --- | --- |
| `foes-1.png` | Clover Meadow and Bramble Wood foes | 4 × 3, transparent |
| `foes-2.png` | Willow River and Frosty Peak foes | 4 × 3, transparent |
| `foes-3.png` | Moon Hollow foes, Owl, Fox, two Pip poses, pony, dizzy stars | 4 × 3, transparent |
| `landmarks.png` | Signs, closed/open chest, wheel, cart, rest pond, acorn | 4 × 2, transparent |
| `bg-1.png` | Clover Meadow | Opaque |
| `bg-2.png` | Bramble Wood | Opaque |
| `bg-3.png` | Willow River | Opaque |
| `bg-4.png` | Frosty Peak | Opaque |
| `bg-5.png` | Moon Hollow | Opaque |
| `skills.png` | Eighteen skills, four evolutions, Rest and Reroll | 6 × 4, transparent |
| `gear.png` | Hats, scarves, charms and boots across five rarities | 5 × 4, transparent |
| `title.png` | Dora and Enzo walking into the trek | Single transparent vignette |

[The generation manifest](chinchilla-trek-generation.json) records exact prompts, all correction attempts, references, selected originals, SHA256 hashes, dimensions and alpha statistics. [The crop map](chinchilla-trek-crops.json) contains all **88** cutout frames, plus measured background placement and tiling notes. The original seven Hay Bale Brawl paintings and its FX package are unchanged.

## Sheet mapping

Indices are **zero-based, left to right and top to bottom**. Use the crop map's names and indices to map engine IDs explicitly; do not infer order from another game's roster.

- **foes-1:** Beetle, Field Mouse Gang, Grumpy Toad, Wasp / Hedge Pig, King Mole, Magpie, Stoat / Thornbush Sprite, Wild Boar Piglet, Old Raccoon, Grumbleton the Badger.
- **foes-2:** Crab, Heron, Pike, Water Vole / Snapping Turtle, Captain Otter, Snow Hare, Ptarmigan / Mountain Goat Kid, Ice Imp, Yeti Pika, Snow Fox Queen.
- **foes-3:** Bat, Moth, Will-o'-wisp, Night Owlet / Shadow Cat, Great Horned Owl, friendly Owl, friendly Fox / Pip standing, Pip peeking from satchel, Pedlar's pony, dizzy stars.
- **landmarks:** Story sign, Crossroads sign, closed chest, open chest / Lucky wheel, Pedlar's cart, rest spot, acorn.
- **skills:** Combo, Counter, Sharp Teeth, Keen Eye, Extra Fluff, Shell / Dust Cloud, Static Fluff, Snack Break, Power Nap, Grit, Prickles / Pounce, Dust Roll, Pepper Dust, Frost Whiskers, Lucky Paw, Second Wind / Thunder Combo, Fluffy Fury, Bramble Shell, Midnight Feast, Rest, Reroll. Only indices 18–21 have gold evolution discs; every other disc is cream.
- **gear:** rows hat, scarf, charm, boots; columns cream-grey, green, blue, purple, gold. These correspond to the five rarity levels, indexed 0–4. A pair of boots is one complete sprite.

The thirty foes occupy the first two full sheets and indices 0–5 of the third. Keep indices 6–11 separate from recruitable/combat foe IDs. The friendly spectacled Owl and crowned Great Horned Owl are different subjects. Pip's two poses are distinct frames, not separate characters.

## Cropping, facing and scale

`bounds` and `rect` use **[x, y, width, height] in source pixels**. `bounds` is the measured visible silhouette; `rect` adds eight pixels of transparent padding. `cell` uses [left, top, right, bottom]. Alpha greater than 8 excludes nearly invisible generation noise from measurement.

All 88 visible silhouettes have at least 10% clear margin on every side of their logical cell, and every padded crop stays within that cell. Paint the complete `rect` with aspect ratio preserved. Contain-fit into the destination art box and align feet or landmark bases deliberately; using the full grid cell as a sprite would retain the large gutters and make the art too small. Keep tails, whiskers, crowns, wing tips, staff, pony tack and detached dizzy-star marks intact.

The foes, friendly guides and Pip face **left**, toward the hero. Their default painter must not flip them as if they were Hay Bale Brawl's right-facing sprites. The crab is a front/three-quarter scuttling pose, with both claws visible. Icons and landmarks have no marching-direction requirement. The title's heroes walk right, into the journey.

The title's visible artwork starts at source y337. Preserve its full 3:2 canvas to retain the empty upper quarter for game-rendered title text. The otherwise empty upper quarter contains at most alpha-1 noise in the unchanged source; the visible crop excludes it. Dora has ivory-white fur and dark ruby-burgundy eyes; Enzo is grey with a white chest and black eyes. Neither hero needs a new gameplay sprite in this delivery: the brief deliberately retains the shared `drawChinchilla` for walking/fighting heroes.

These are static poses and icons, **not animation strips**. Retain the existing event-driven movement, wind-ups, lunges, tumbles, alpha and reduced-motion behaviour. Do not cycle between species or between Pip poses as if they formed a smooth animation sequence, and do not add a second idle-bounce loop.

## Scrolling backgrounds: required alternating-mirror fallback

**The five PNGs are not certified seamless under plain left-to-right repetition. Use alternating mirrored world tiles.** The original prompt document's **Wiring it in** section explicitly permits this fallback. Side-by-side checks found discontinuities under plain repeat; the normal/mirrored pairs have identical pixels at both kinds of edge and were visually reviewed. No mirrored production copies were created.

Use one stable world-tile index for orientation, rather than flipping the whole scene according to the current scroll offset. At native logical scale a tile is 480 × 320:

```ts
// Illustration of the required tiling transform, not an existing runtime API.
const tileW = 480;
const first = Math.floor(scrollX / tileW);
for (let i = first; i <= first + 1; i++) {
  const x = i * tileW - scrollX;
  const mirrored = ((i % 2) + 2) % 2 === 1;
  ctx.save();
  ctx.translate(mirrored ? x + tileW : x, 0);
  ctx.scale(mirrored ? -1 : 1, 1);
  ctx.drawImage(image, 0, 0, tileW, 320);
  ctx.restore();
}
```

Keep full-image aspect ratio and consistent sampling at joins; verify subpixel scrolling on high-DPR screens to avoid hairline cracks. Never mirror actors, labels or interface elements with the background. These are flattened scenes: do not try to scroll their painted sky, mountains and foreground at separate rates without separate layer art. Do not draw another code moon over the moon already painted in chapter 5.

The current scene's `GROUND` is **258** on its 480 × 320 canvas, equivalent to source y825.6. All five final path bands contain that foot position at native scale. Visual surveys below have about 20 source pixels of precision; use screenshots to finish grounding, not the requested percentages alone.

| Backdrop | Source path band | Approximate logical band |
| --- | --- | --- |
| Clover Meadow | y748–865 | y234–270 |
| Bramble Wood | y744–890 | y233–278 |
| Willow River | y765–902 | y239–282 |
| Frosty Peak | y755–862 | y236–269 |
| Moon Hollow | y744–850 | y233–266 |

The painter did not follow the requested 77–90% boundaries exactly; the table records the delivered geometry. The critical result is a continuous track beneath the existing foot baseline. Check white snow foes against Frosty Peak and dark foes against Moon Hollow in the actual renderer; retain readable outlined names, health bars and callouts over the paintings.

## Integration instructions for Claude

1. Add typed Trek asset/crop mappings and a separate lazy loader, using the existing Brawl loader as a pattern. Keep server imports safe, deduplicate requests, validate dimensions, use content-hashed URLs, notify subscribers on completion/failure, and retry failed requests explicitly. Do not send machine-local generation paths or the full generation manifest to clients.
2. Integrate `drawFoe`, `drawGuide`, `landmark`, `drawPath`, `drawTitle` and `drawPiece` in `lib/chinchilla-trek-scene.ts` at their shared drawing entry points. Keep existing drawings as pending/failed fallbacks. Do not paint a loaded background and then draw its original scenery over it. Retain state-driven effects, shadows, bars and labels where appropriate.
3. Map the 24 skill badge names to the actual skill/evolution/action IDs in `lib/chinchilla-trek-data.ts` and the relevant page UI. Rest/Reroll are actions, not learned skills. Match gear row to slot and column to rarity; preserve readable upgrade stats and prices. Keep guide, Pip, pony and dizzy-star mappings separate from the thirty foe IDs.
4. Request only the active chapter background, visible foe/landmark/gear/skill sheets and title as needed. Loading must never delay input, walking, choices or replay. Ensure title and other still canvases repaint when assets arrive or Retry succeeds; an animation loop alone is not sufficient for static screens.
5. Implement the documented alternating mirrored background tiling, preserve the 258px foot baseline, and check joins while moving through several tile boundaries. Do not change the game engine, world progression, RNG, saves, fight rules or replay timing to fit artwork.
6. Add focused checks for all mappings/crops/hashes, late/static redraws, slow/failed art and Retry, every chapter at multiple scroll offsets, both heroes, all thirty foes, guides, Pip, landmarks, 24 badges and all twenty gear pieces. Exercise phone/desktop, high DPR, reduced motion and continued saves. Use the current Trek test hook and existing browser conventions.
7. Run `npm run typecheck`, `npm run test:trek`, `npm run bot:trek`, `npm run test:e2e:trek`, production build and the required full CI checks. Update documentation to state what is actually integrated and tested, preserving source hashes and provenance. Runtime optimization to WebP can be a separate serving-copy step with recorded source-to-runtime hashes; do not silently overwrite source PNGs.

## Validation completed for this delivery

- Twelve PNGs decode at 1536 × 1024: seven RGBA cutout/title assets with real alpha-zero backgrounds and five opaque RGB backdrops.
- Every selected original and saved production file has the same SHA256. All generation/correction prompts and selected/discarded candidates are recorded.
- All 88 visible cutouts pass the 10% margin check; eight-pixel padded frames stay inside their cells.
- Reviewed complete crops on navy and cream at 60px tall, and skill badges at 32px. No visible background boxes or clipped tails, wing tips, crowns or props.
- Checked requested subject ordering, colours, blank signs, wheel sectors, matched chests, four gold evolution badges, rarity columns and hero identity in the title. Captain Otter's badge is unmarked; the Fox's bundle is plain teal; both Pip poses face left.
- Compared plain-repeat and alternating-mirror background pairs. Plain-repeat differences are recorded in crop metadata; both mirrored edge joins measure zero pixel difference. A moving browser check remains part of integration.
- Verified that the existing hero foot baseline falls inside each surveyed final path band.

No runtime source was changed and no gameplay/browser integration pass is claimed for this asset delivery.

## Prompt-branch repair

The supplied prompt commit `3ea3bae197fb37656a8b392ccb2584ad05a63378` was preserved as `e0bec28` on `docs/trek-image-prompts`, created from main `6e43165`. That docs branch was pushed. Only after preserving the commit was the obsolete remote `feat/chinchilla-trek` deleted, guarded by an exact old-tip lease. This artwork branch includes the preserved prompt commit; the art package is delivered on `art/chinchilla-trek-painted-assets` for Claude to integrate; it is not yet merged into main.
