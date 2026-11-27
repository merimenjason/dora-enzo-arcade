# Moth Hoop

A fixed-screen shooter drawn entirely in cross stitch. Written 28-11-2026 as an overnight surprise: the brief was "a new
game with a new form of graphics". It came out of the retro pitch round (the Moth Hoop mock-up), keeps the arcade's
Singapore setting, and avoids being a clone of any one shooter: there are no marching rank-and-file enemies and no
bunkers, and the core loop is *making* a picture while defending it, not clearing a wave.

## The idea

Ah Ma left six cross-stitch kits half-done on her table in Tiong Bahru, and the clothes moths found them. Dora and Enzo
ride a cotton reel along a tape measure under the embroidery hoop and throw needles straight up. A needle that meets the
kit's printed picture stitches it, a few crosses at a time from the bottom up; a needle that meets a moth pins it. The
moths land on finished stitches and chew them into holes, so every kit is a tug of war between your thread and their
appetite.

## The graphics

Everything on the canvas is thread on aida:

- **The cloth** is a painted aida weave (`public/art/moth/aida.webp`, one weave square per stitch cell) inside a painted
  beech hoop on Ah Ma's sewing table (`frame.webp`, the hoop's inside keyed out).
- **Every stitch** is one of 32 painted white floss crosses (`stitches.webp`), tinted per thread colour at run time by
  multiplying the white floss by the colour and cutting it back to the cross's shape. Each finished cell gets a solid bed
  of the thread colour a shade darker under the cross, so stitched areas read as dense floss.
- **The printed kit** is the picture screen-printed faintly onto the cloth; very light colours print a shade darker so
  white parts still show on cream.
- **Sprites** (Dora, Enzo, every moth, the queen, the reel, buttons, needle) are Codex pixel paintings decoded to a
  shared 56-colour palette, and every art pixel is drawn as one tinted cross with a felt shadow, so the characters look
  embroidered too.
- **The HUD** is stitched: a 5×7 cross-stitch font on cream aida patches with dashed borders, and the progress and tear
  bars fill with crosses.
- **Holes** are painted frayed-aida rings over the dark under the cloth (`holes.webp`).

`scripts/moth-art.py` turns the Codex paintings into all of this: it finds each painting's pixel pitch from flat-colour
run lengths, samples one colour per block, splits sprite sheets into named frames, and writes `lib/moth-art.ts` (the
sprites as palette rows) and `lib/moth-patterns.ts` (the six kit pictures, about 80×40 stitches each, kopi smaller).

## Rules

| | |
|---|---|
| Field | 128 × 72 stitch cells; the picture sits in rows 7 to 48 |
| Reel | moves 44 cells a second, directly (no momentum), between columns 14 and 114 |
| Needle | one every 0.15 s held (0.18 s with gentle moths off), flies 84 cells a second |
| Stitch run | 5 crosses a needle on the first kit, 12 on the rest; it stops at a landed moth or a stitched cell |
| Hole | one needle darns it back to plain cloth; the next stitches it |
| Row bonus | 150 for every row of the picture finished |
| Win | every stitch in (and, on National Day, the queen pinned): 1000 + 300 a spool left |
| Lose | no spools left, or holes reach the tear limit (16 to 20% of the picture, at least 10) |
| Stars | finishing; keeping every spool; beating par |

Ah Ma hands back one lost spool as the picture passes a third and two thirds.

## Foes

| | |
|---|---|
| Moth | hunts a finished stitch, lands, chews it into a hole (2.7 to 3.6 s, a red ring shows it), may lay a larva, then hops to a neighbour or flies off |
| Larva | crawls along its row eating stitches; after four it spins a cocoon |
| Cocoon | hatches a moth after 5 s unless pinned |
| Gold moth | hovers, shivers (0.95 s with gentle moths, 0.7 s without, a dotted line shows the aim) and dives at the nearest reel; a hit costs a spool |
| Silk moth | glides across the top; three pins and it drops a button |
| Atlas Moth (queen) | National Day only: arrives at a quarter done, takes 36 pins, lays a larva on your stitches every 6 s (4.5 s without gentle moths); when she falls every moth flees |

Arrivals thicken as the picture fills and thin out for the last 15% so the finish is never a chase.

## Powers (buttons from the silk moth)

| Button | Effect |
|---|---|
| Lavender sachet | moths flee and none arrive for 7 s |
| Three needles | throws three columns at once for 9 s |
| Golden thread | each needle darns and stitches, twice as far, for 9 s |
| Thimble | blocks the next dive |

## The kits

| # | Kit | Picture | Moths |
|---|---|---|---|
| 1 | Kopi & Kaya | a kopitiam breakfast | moths only |
| 2 | Tiong Bahru Flats | the art-deco flats on Seng Poh Road | the silk moth arrives; larvae |
| 3 | The Merlion | Merlion Park at Marina Bay | gold moths |
| 4 | Peranakan Tiles | a shophouse front on Koon Seng Road | more of everything, hungrier larvae |
| 5 | Supertree Grove | Gardens by the Bay at night | the whole swarm |
| 6 | National Day | fireworks over Marina Bay | the Atlas Moth queen |

## Controls

| | Solo | Dora (two players) | Enzo (two players) |
|---|---|---|---|
| Move | A / D or ← / → | A / D | ← / → |
| Throw (hold) | Space, W, ↑ or K | Space, W or K | ↑, Enter or Numpad 0 |
| Swap who sews | Q | – | – |
| Player two joins | Enter | – | – |

Esc or P pauses; from pause R restarts the kit and Q goes back to the kits.

## Tuning for people

Gentle moths is on by default: moths fly 15% slower and take about 18% longer to chew, arrivals come 15% further apart, the gold moth shivers
longer, the queen lays more slowly and a faint running stitch shows where your next needle goes. The bots in
`tests/moth.mjs` react 12 to 18 frames late (about a quarter of a second) and aim with noise; a casual one clears every
kit on at least three of four seeds, and one that never throws never wins. Par times are set just above the casual
bot's clear times.

## Files

- `lib/moth-game.ts`: the rules, deterministic (seeded, 60 Hz fixed step, no DOM), and the bot.
- `lib/moth-scene.ts`: the stitch renderer.
- `lib/moth-art.ts`, `lib/moth-patterns.ts`: generated by `scripts/moth-art.py`; don't edit by hand.
- `app/moth-hoop/`: the page (screens, keys, loop, save `moth-hoop-v1`), WebAudio sound (every stitch plucks a
  pentatonic note that rises up the picture; a music-box tune over a sewing-machine shuffle), styles.
- `tests/moth.mjs`, `tests/e2e/moth-hoop.mjs`.
