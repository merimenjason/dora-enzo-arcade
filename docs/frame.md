# Out of Frame

Game 83, `/frame`. A pixel-art puzzle platformer where the camera is the controller: Dora walks on her own, and only what is inside Enzo's viewfinder moves. Everything outside the frame, Dora included, is frozen in sepia. It was the top pick of the unbuilt game ideas on 05-11-2026.

## Files

| File | What it is |
|---|---|
| `lib/frame-game.ts` | The rules, deterministic at 60 ticks a second from a seed with no DOM: segments and the run's plan, the live rule, Dora, hazards and machines, the film, lenses and the save. |
| `lib/frame-scene.ts` | Canvas 2D drawing at 480 by 256 pixels, scaled up with nearest-neighbour. The world is drawn once into a buffer, shown in sepia, and the frame's rectangle is drawn again on top in full colour. |
| `app/frame/page.tsx` | Input, the loop, the HUD, Enzo's pointers, the lens picker, results and the save. Exposes `window.__frame()` with `debug` helpers for the browser tests. |
| `app/frame/sound.ts` | Synthesised effects and five original chiptune loops (title, one for each place, ending). |
| `app/frame/frame.css` | The film-camera look. On an upright phone the HUD sits above the picture and Enzo's pointers below it. |
| `public/art/frame/` | The art (see **Art**). |
| `scripts/frame-art.py` | Turns the Codex paintings into the game's pixel art. |
| `tests/frame.mjs`, `tests/frame-bot.mjs`, `tests/e2e/frame.mjs` | Engine checks, bots and the browser suite. |

## The live rule

- The screen is 30 by 16 tiles of 16 px. The frame starts 144 by 112 px and glides towards where the player points at 240 px/s (it can't leave the screen).
- A thing is **live** while its middle is strictly inside the frame. Dora is live while her face (12 px above her feet) is.
- Live things move; frozen things don't. Timers that belong to a thing (a trap's next arrow, a chute's next boulder, crumbling floor, a raft's wait at the dock) only count down while it's live.
- **Frozen hazards are solid.** A frozen Grumble, boulder or falling rock is a block Dora can stand on or walk into, and so is a frog frozen mid-hop or a bat frozen mid-swoop: a stepping stone in the air. A frozen arrow, or one stuck in rock, is a one-way plank she can stand on from above. A bat asleep on its roost isn't solid.
- **Frozen Dora is safe.** A live Grumble that walks into her turns round, a frog bounces off, a bat turns back to its roost, a boulder breaks, an arrow tinks off and a falling rock shatters.
- **Where the frame can be.** The frame can't go below the bottom of the screen, so to freeze something and keep Dora moving, the frozen thing's middle has to be below her face (the frame's bottom edge between them) or off to one side. That's why the frog and bat puzzles freeze them as they come level with the ground.

## Dora

- Walks right at 64 px/s on her own. Gravity 980 px/s², falling at most 380 px/s.
- **Hops** single steps by herself (230 px/s up), and waits at anything two tiles or taller.
- **Jumps** at 320 px/s (350 with **Springy boots**) on a click, Space, J or Z, or the JUMP button. A jump pressed up to 0.14 s before landing still counts, and so does one up to 0.08 s after walking off an edge.
- On a moving raft or lift she stands still and won't walk off its edge into nothing.
- Landing on a live Grumble's head squashes it and bounces her up. Landing on a live frog squashes it flat for 2.5 seconds (of being live), then it pops back up, so a frog a puzzle needs can never be lost. A bat in flight can't be stomped.
- Four hearts. A live hazard touching her costs one and gives 1.2 s of safety. Spikes, water and falling off the bottom cost one too, and put her back on the last solid rock she stood still on for half a second.

## Hazards and machines

| Thing | Live | Frozen |
|---|---|---|
| **Grumble** | Patrols at 30 px/s, turning at walls and ledges. Hurts on touch; stomp it from above. | A step. |
| **Hopper frog** | Every 1.6 s hops towards Dora: 260 px/s up and 60 across, two tiles high and two along. Never hops into water, onto spikes or off into nothing (then it hops the other way, or straight up). Floats in water and hops up out of it. Hurts on touch; stomp it flat. | A block wherever it was in its hop. |
| **Bat** | Sleeps on a roost under rock. When Dora is within 80 px on her feet, it dives to skim the ground 40 px ahead of her and rises as far again beyond (1.2 s), flies the same curve home, and rests a second. Turns back if it meets rock. Hurts in flight; can't be stomped. | Asleep: nothing. In flight: a little platform. |
| **Arrow trap** | Fires an arrow every 1.8 s at 150 px/s (four in flight at most). | Waits. |
| **Arrow** | Flies; sticks in rock for good, and an arrow that hits a stuck one sticks to its end, so a trap left running builds a bridge. A trap whose mouth is blocked stops firing. | Hangs in the air as a plank. |
| **Boulder chute** | Drops a boulder every 3.2 s (three out at most). | Waits. |
| **Boulder** | Rolls left at 80 px/s. Breaks on a wall, in water or off the screen. Rolls into spikes and comes to rest there as a harmless block; the next one stacks on it. | A block. |
| **Hanging rock** | Shakes for 0.35 s when Dora is under it (within 28 px), then falls. | Never notices her. |
| **Crumbling floor** | Gives way 0.4 s after Dora steps on it. | Waits. |
| **Raft / lift** | Moves 80 px (rafts across at 36 px/s, lifts up at 30), waiting 0.8 s at each end. | Waits. |

## The run

- Nine screens in three places: the Jungle Ruins, the Crystal Cave and the Sunken Temple. Each screen is two segments of 15 columns side by side. The first screen is the start segment and one more; each place deals its own segments in a shuffled order, so no segment comes twice in a run.
  - Ruins: grumble, gap (a frog beyond it), trap, crumble, chute, rocks, raft, pond.
  - Cave: bridge, lift, cellar (a bat among the hanging rocks), rolling, roost, gallery, ferry (a bat over the raft), steps.
  - Temple: pegs, gauntlet, moat, shaft, crossing, patrol (a Grumble and a frog), rafts, ladder.
- Two segments are puzzles about the new creatures, and the bots check that neither can be crossed without them:
  - **Pond:** a pond five tiles wide with a frog floating in the middle. It hops straight up out of the water; frozen as it comes up level with the ground (the frame's bottom edge just below Dora's face), it's the stepping stone across.
  - **Roost:** a spiked pit three tiles wide under a bat's roost. Freeze Dora at the edge and leave the bat in the picture: it dives at the ground just ahead of her, and with the frame's bottom edge at her knees it freezes itself at the bottom of the dive, right over the pit.
- Every screen has one film can somewhere in the middle, and the first screen of the cave and of the temple has a heart.
- **Film.** The run starts with 75 seconds of film, at most 90. It runs down all the time Dora is playing (not while paused or picking a lens). Finishing a screen adds 14 seconds and a film can 10. If it runs out, the run is over.
- Reaching the right edge finishes a screen. At the end of each place Dora gets a heart back.
- After each screen Enzo offers three different **lenses**; pick one.

| Lens | Most | Effect |
|---|---|---|
| Wide lens | 2 | The frame is two tiles (32 px) wider. |
| Tall lens | 2 | The frame is a tile and a half (24 px) taller. |
| Smooth tripod | 2 | The frame moves 40% faster. |
| Long reel | 2 | 20 more seconds of film, now and at most. |
| Plasters | 2 | One more heart, and heal one. |
| Springy boots | 1 | Dora jumps a tile higher. |
| Slow shutter | 1 | Everything but Dora moves at three quarters speed. |
| Acorn cache | 1 | Every acorn is worth 2 seconds of film. |

## Controls

- **Mouse:** the frame follows the pointer; a click jumps.
- **Keyboard:** WASD or the arrows nudge the frame, Space, J or Z jump, C centres the frame on Dora, Esc or P pauses, and 1, 2 or 3 picks a lens.
- **Touch:** drag on the picture (or on the strip beside the JUMP button on an upright phone) to move the frame by as much as the finger moves, and tap JUMP.

## Art

All the art is Codex-painted: 2×2 sprite sheets on flat magenta (Dora's walk, stand and tumble; Grumble, boulder, trap face, hanging rock; arrow, rope lift, acorn, film can; water, raft, heart; the hopper frog sitting, crouched, rising and falling; the bat hanging, wings up, wings down and gliding), a 2×2 tile sheet for each place (top, fill, crumbling floor, spikes), a backdrop for each place, the title, the ending and portraits of Dora and Enzo. `scripts/frame-art.py` keys the magenta, crops each sprite to what's painted, shrinks it to game size with a box filter and a small palette, and fits the backdrops to 480 by 256 with a little more colour. The source paintings are not in the repo; to redo one, paint a new sheet and rerun the script on a folder holding all the sources.

The scene darkens the backdrop a little so the ground stands out. Outside the frame it puts a sepia `color` wash and a `multiply` over everything, then draws the frame's rectangle again from the buffer in full colour, with corner marks, a centre cross and a blinking record light. Frozen Dora gets a dashed outline so she's easy to find.

## Bots and balance

`npm run bot:frame` (with `--quick`, part of `npm test`):

- **Segments:** the looker has to clear every segment on its own, after the start segment, with plenty of film.
- **Runs:** eight seeded runs. The looker tries frame positions round Dora (and a jump or not) on copies of the run five seconds ahead, plus a reflex that follows Dora, jumps gaps it can cross and watches the nearest machine or creature at a gap it can't. It must win some runs; the careless player, which keeps the frame centred on Dora and never jumps, must get at least two screens less far on average. With `--quick` (four runs) the looker must reach screen 5 on average instead of winning.
- **Puzzles:** with its frog or bat taken out, the looker can't cross the pond or the roost.
- **Results (06-11-2026, with the frogs and bats):** looker 1 of 8 runs won, screen 6.3 on average, all its losses to hearts (the roost costs it about as many falls as the moat and the bridge), about 1.2 minutes a run; careless 0 of 8, screen 0.4. Before them (05-11-2026): looker 2 of 8, screen 7.0.

The bot plays far less well than a person who can see the whole screen, so the game is meant to be beatable but not easy for a first-timer: the film pressure is the main lever if it turns out too hard (`FILM` in the engine).

## Ideas not done

- A daily seed, and a photo album of the best shot from each screen.
- Two-player: one moves the frame, the other jumps.
- A boss screen where the frame itself is the target.
