# Driftwood Post

A cosy sailing adventure at `/driftwood`. The post boat on Lake Whisker has sprung a leak and the islands have stopped writing to each other. Dora and Enzo patch up an old driftwood dinghy and take over the round for their grandmother, Granny Tuft. Twenty-four story letters, carried between ten island villages, get every island back in touch for the Lantern Regatta.

Started 29-10-2026.

## Files

- `lib/driftwood-world.ts`: the lake (4000 × 3000 units), its 15 islands (10 with jetties, 5 dockless islets), rocks, reed beds, currents, fog banks, hidden shells, message bottles, the residents, the 24 story letters and the 16 side-post templates.
- `lib/driftwood-game.ts`: the rules. Deterministic, no DOM, a seeded generator for wind and side post. Runs at 30 ticks a second.
- `lib/driftwood-scene.ts`: Canvas 2D drawing of the lake, the boat, the HUD, the chart, and the drawn stand-ins for every painting.
- `app/driftwood/page.tsx`, `driftwood.css`, `sound.ts`: the page, its styles and the WebAudio sound.
- `tests/driftwood.mjs` (engine), `tests/driftwood-bot.mjs` (a bot that plays the whole story), `tests/e2e/driftwood.mjs` (browser).
- Art is in `public/art/driftwood/` (see `docs/driftwood-post-art-brief.md`). Every painting has a drawn stand-in, so the game is complete without it.
- Each island's coast is traced from its painting (`ART_SHAPES` in `lib/driftwood-world.ts`): the ground's outline, kept just inside the sandy rim and capped above by its mirror image, so towers, trees and crags don't count as land. The boat bumps on that coast, the drawn stand-ins use it, and sailing behind an island its tall parts are drawn over the boat. Whisker Cove and Slipway Isle tie up at their painted jetty and slipway.

## Sailing

- The wind drives the boat. Speed follows a polar curve on the true wind angle: nothing inside the **no-go zone** (42° either side of the wind, 34° with the deep keel), rising to 62% at the edge of it, 100% on a beam reach (90°), and easing back to 62% running dead downwind. Top speed is 3.3 units a tick in full wind.
- **Tacking:** to go upwind, zig-zag. Turning through the wind costs speed; inside the no-go zone the boat slows towards a stop ("in irons").
- **Wind strength** comes from the weather: Calm 0.55, Breezy 0.85, Gusty 0.92 (with gusts of up to ±26% of that), Rain squall 1.18. The wind mostly blows from the west-south-west and swings up to 115° either side of it. Shifts are announced: the compass shows where it is heading next and a countdown.
- **Trim:** automatic by default. With manual trim on (menu or pause chip), W/S or ↑/↓ haul and ease the sheet; a well-trimmed sail is worth a little extra, a badly trimmed one luffs and slows.
- **Leeway:** the wind pushes the boat downwind by 0.2 × the wind's strength a tick when she's still, easing to half that at full speed (the deep keel halves it again).
- **Currents** carry the boat: The Long Current runs east across the middle of the lake, The Homeward Drift west along the south, and Heron's Race past Crag Top.
- **Reeds** slow the boat to 42%. **Heavy parcels** take 8% off each, down to 76% at worst.
- **Rocks and shores:** bumping at more than 1.0 speed knocks the boat back and scuffs it. Three scuffs and Enzo stops to patch the hull for 4 seconds. A bump that scuffs the hull also jostles every fragile parcel aboard, which loses its bonus (so with the sturdy hull nothing is jostled). Pressed against a shore, the boat slides along it: only the first touch bumps. Movement is substepped (at most 4 units a step), so the boat never passes through a rock.
- **Brake:** X or Shift drops a drag anchor.

## Day, night and weather

A day lasts 6 real minutes (10,800 ticks), starting at 6:40. Dawn, day, golden hour and night each have their own light and their own tune. How far you can see shrinks at night (290 units, 480 with the lantern) and in fog (× 0.42, × 0.62 with the lantern); rain takes off a further fifth. Islands you have not seen yet are blank on the chart, which fills in as you sail.

## Docking and the post

- Within 120 units of a jetty, hold E or Space (or the ⚓ button): the boat brakes, and ties up once it is under 1.0 speed. Drifting in very slowly (under 0.5, within 48 units) ties up on its own. A dock key still held from casting off doesn't count until it's let go, and casting off points the boat at open water.
- At the jetty: hand over what's addressed here, pick up what's waiting, read every letter, and cast off. The voyage saves every time you tie up.
- The bag holds 3 items (up to 6 with mail crates).
- Pay, in shells: a letter 5, a parcel 7; side letters 3, side parcels 5; +2 for heavy, +4 for express on time, +3 for a fragile parcel delivered without a scratch.
- **Express** items must arrive by the time on their tag (1.5 × the straight-line sailing time plus 30 minutes, rounded up to ten minutes).
- **Side post** starts once story letter 4 is delivered: everyday letters and parcels between the islands, for shells.
- **Hidden shells** (20, worth 5 each) sit in coves and behind rocks; **message bottles** (6, worth 3 each) carry notes from the lake's past.

## The story

Twenty-four letters, each unlocked by the ones before it:

1. Granny Tuft → Old Pip at Lighthouse Rock, 2. Pip orders a seed loaf from Bun at Crumb Isle, 3. Bun sends six cream buns home (fragile), 4. Tuft asks Tamsin at Slipway Isle to look at the boat (this opens the boatyard and side post), 5. Tamsin sends Pip a lamp wick and an anchor (heavy), 6–8. Pip answers Clover at Twin Hills years late, and Clover and Bramble start writing (8 is express), 9–13. honey, flour, Mrs Grisel's new spectacles, her complaint, and lily pads for Mossy at Reedmere, 14–15. Mossy asks Professor Quill about stars, and Quill's urgent reply to Pip, 16–19. Pip's idea of a regatta, Dabble telling Tamsin (express), a lens mount and the great lens for the lighthouse, 20–21. Clover's very brave question (express) and Bramble's YES, 22–23. Mrs Grisel reserves cake and Bun sends the Lantern Cake (heavy and fragile), 24. Pip's invitation home.

Delivering the invitation turns the clock to 18:30 (express post in the bag keeps the time it had left): sail to Lighthouse Rock for the Lantern Regatta, the ending. Afterwards the lake carries on with side post and shells.

## The boatyard

Tamsin's boatyard on Slipway Isle opens once letter 4 is delivered. Upgrades, in shells:

| Upgrade | Price | Effect |
| --- | --- | --- |
| Bigger sail | 30, 60 | +12% speed a level |
| Deep keel | 40 | no-go zone 42° → 34°, half the leeway |
| Mail crates | 20, 35, 55 | one more bag slot each, up to 6 |
| Lantern | 30 | see further at night and in fog |
| Spyglass | 25 | the next delivery's arrow shows from anywhere (otherwise within 1500 units) |
| Sturdy hull | 50 | bumps don't scuff or jostle |

## Controls

- Keyboard: A/D or ←/→ steer (eased: tap to nudge, hold to turn), W/S or ↑/↓ trim (manual trim), E or Space tie up, X or Shift brake, M chart, Esc or P pause. Space or Enter casts off at a jetty.
- Touch: slide on the wheel at the bottom left to steer; the buttons on the right are brake, dock and (with manual trim) haul and ease.
- The game pauses when the tab is hidden or the window loses focus while sailing; tied up at a jetty nothing moves, so it just waits. The sound goes quiet either way and comes back on unpausing.

## Saving

`localStorage` key `driftwood-post-v1`: settings (sound, music, manual trim), the number of finished regattas, and the voyage as it was at the last jetty. A damaged or foreign save is ignored field by field rather than misread.

## For tests

The page sets `main[data-ready="true"]` once hydrated and the lake can draw, and `data-phase` to `sail`, `dock`, `patch` or `ending`. `window.__driftwood()` returns the running game, `window.__driftwoodStart({ seed })` starts a fresh voyage, and `window.__driftwoodDock(id)` ties up at any island's jetty.

Commands: `npm run test:driftwood`, `npm run bot:driftwood`, and with `npm run dev` running, `npm run test:e2e:driftwood`.
