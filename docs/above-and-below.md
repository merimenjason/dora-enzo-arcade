# Above & Below

Game 99, at `/above-and-below`. Chapter One of a two-hero cross-section co-op platformer. Every room is one painting
cut in half by the soil line: Dora works the sunny meadow on top, Enzo digs through the burrows underneath, and every
puzzle needs both of them. Four rooms in order: The Meadow, The Orchard Roots, The Stream Bank and Old Grubber's Den.
Play solo (swap between the heroes; the one you leave behind gets light help) or two players on one keyboard, with
touch and gamepads too. Assist is on by default.

Written 13-11-2026, ported from the finished standalone prototype (`arcade-protos/above/`, plain JS with globals) into
the arcade's engine / scene / page split. The gameplay, tuning numbers, art and feel are the prototype's; the port
changed one thing in the rules (see [The hand-off](#the-hand-off)).

## Code layout

| File | What it holds |
| --- | --- |
| `lib/above-world.ts` | The room grid (8-unit cells: air, solid, soft soil, hidden soil), digging, the stamp reveal, loose soil settling, the basin water. Pure. |
| `lib/above-game.ts` | `AboveGame`: heroes, direct-control physics, actions and braces, the leaf ride, the hawk, the chapter flow, the hints and auto-help, the frame picker, the save format, the key maps (`Keys`, shared by the page and the bots) and `snapshot()`. Seeded and deterministic. |
| `lib/above-rooms.ts` | The room interface, The Meadow and The Orchard Roots: geometry, beats, rules, stations for auto-help, glints. |
| `lib/above-rooms2.ts` | The Stream Bank and Old Grubber's Den. |
| `lib/above-art.ts` | Generated frame table for the Codex atlases. |
| `lib/above-scene.ts` | `AboveScene`: layout (wide, phone upright, phone on its side), the follow camera, sprites, particles, soil layer, water, hawk, hero drawing, ghost, glints, bubbles, key prompts, the in-play HUD, room card and touch controls. |
| `lib/above-scene-rooms.ts` | Each room's own drawing (sluice, waterfall, sapling, flagstone, the dark chamber and sunbeam, gates, the clay wall, bushes, Old Grubber). |
| `app/above-and-below/page.tsx` | Title, HUD toggles, pause, end card; keys, touch, gamepads; the fixed 60 Hz loop; the save. |
| `app/above-and-below/sound.ts` | The WebAudio synth, one sound per game event. |
| `scripts/above-art.py` | The art pipeline (keys, cuts, scales and packs the Codex paintings). |

The game is exposed as `window.__above()` (`{ game, scene, screen, paused, save, labels, keys, start(twoP, room) }`)
for the browser tests, like the other recent games.

## Controls

| | Keys (solo) | Two players | Touch | Gamepad |
| --- | --- | --- | --- | --- |
| Move | arrows or WASD | Dora WASD, Enzo arrows | the stick (it floats from where your thumb lands) | left stick or d-pad |
| Jump | Space | Dora Space, Enzo `/` | the arrow button | A |
| Act / hold | E or Enter | Dora E, Enzo `.` | the star button | X or B |
| Swap | Shift or Q | (none) | the face button | Y or a shoulder |
| Climb, duck, hide | up, down | up, down | stick up, down | up, down |

On the title: Enter, Space, E, 1 or any move key starts one player, 2 starts two players, C continues from the
checkpoint room. In play: Esc or P (or Start) pauses, Shift + R restarts the room, M toggles sound; the top-right chips
toggle sound, assist, 1P/2P and pause. In 2P a second gamepad drives Enzo.

The key prompt (shown over the hero after 7 s without a new input, and at once for the hand-off) uses the keys you
last used: arrows or WASD, the 2P keys, pad glyphs, or on touch it lights the button to press instead.

## The rules

**Direct controls.** No momentum: 200 units/s for Dora, 185 for Enzo, stop dead on release. Jump 640 up against 1900
gravity. Walking into a ledge up to 20 units steps up; a jump at a ledge up to 92 units clambers instead (with assist,
pushing into one for 0.22 s clambers too). Both heroes duck on down.

**Dora** (meadow): Act stamps (0.45 s; the thump lands at 55%), or pulls the sluice / holds a lever where there is one.
Landing from a jump counts as a stamp on the flagstone and on Grubber's nose. Up climbs the grown sapling.
**Enzo** (burrows): Act digs (sideways a tall slot, or up/down when held), or heaves a boulder, waters the root, holds
the bridge, boops Grubber. Holding Act digs again every 0.22 s; with assist, walking into soft soil digs it.

**Braces.** Holding Act at a brace spot (root bridge, rope, lever) keeps the hero bracing while the key is held.

### The hand-off

Solo, swap away while holding and the hero you left keeps bracing on their own for a grace of 3.6 s with assist
(2.4 s without), shown as a shrinking ring over them; then they let go, tired. That is how one player works both ropes.
Port change: the act key you are still holding through the swap no longer starts a hold-dig for the hero you swap
to. In the prototype Enzo would start digging the moment you swapped to him with E still held, and a fresh press could
land during the dig and be lost, so the hand-off at the ropes sometimes failed for no visible reason (the explorer bot
stalled there in two runs of three). A fresh press still works as before.

### The rooms

1. **The Meadow.** Dora pulls the sluice; the basin fills; Enzo floats up on the leaf and clambers onto the ledge; he
   digs through the soft plug and waters the thirsty root; the sapling grows in three stages and Dora climbs it onto
   the high bank; a stamp (or a landing) on the cracked flagstone cracks it, the second crack lets a sunbeam into the
   woodlouse's dark chamber and it rolls away; Enzo heaves the two boulders out of the bolt-holes; the hawk sweeps the
   open meadow (a screech and a circling speck first, then its shadow), so Dora ducks into a bolt-hole; both go
   through the round door.
2. **The Orchard Roots.** The root bridge over the ditch rises only while Enzo holds it from below (Dora left in the
   ditch scrambles back out after 1.2 s). Then twin ropes on either side of the soil line: one alone only creaks the
   gates to a quarter; both together lift them in about 1.25 s.
3. **The Stream Bank.** The sluice runs only while Dora holds the lever, so Enzo rides the leaf across while she
   holds. Hard clay blocks the tunnel: each stamp above reveals a seam for 7 s (4.5 s without assist), with dust
   sifting down to show where, and Enzo must dig it before it sets. The hawk is back; ducking in one of three bushes
   hides Dora.
4. **Old Grubber's Den.** Below, Grubber winds up and swipes high (duck) or sends a dirt wave along the floor (jump),
   with the hero's face in a bubble over each tell. Every third attack he dives and the meadow heaves under Dora: rings
   and a mound for 1.3 s (2.08 s the first time, +0.3 s with assist) while clods fall in the den. His nose then pokes
   out for 5.5 s (4 s without assist): Dora stamps it, he tumbles down dizzy for 6.5 s (4.5 s), and Enzo boops him.
   Three boops and he yawns and falls asleep.

### Hints and help

Wordless first: glints on the next thing to use, the other hero points (every 4 s) with a picture bubble, the hero
you need calls ("!") when you are steering the wrong one. A key prompt after 7 s idle. With assist, a ghost walks the
needed hero to the spot and strikes the pose after 24 s on a beat (or 12 s idle). With assist the hero you aren't
steering walks to their station, ducks into cover when the hawk calls, and dodges Grubber's swipe and wave by
themselves; the leaf drifts to the far bank.

## The save

`above-and-below-v1` in localStorage, read and written inside try/catch: `{ v: 1, ck, assist, sound, best }`. `ck` is
the room to continue from (set on entering each room, cleared on the end card), `best` the best chapter time.

## The art

All painted by Codex image generation, the same way as the prototype; no code-drawn characters or props (the water,
waterfall, glints, light and particles are code effects). The prompts are in `docs/above-and-below-art/jobs.txt` and
`docs/above-and-below-art/gen.sh` paints one job: hero sheets (`dora1-3`, `enzo1-3`, 3×4 or 2×4 grids on flat
magenta, with a reference image of the pair so Dora stays cream-white with red eyes and Enzo grey), props
(`props`, `props2`, `sapling`), critters and Old Grubber (on flat green), the four room paintings (each repainted from
a flat-colour blockout so the ground lines match the collision geometry) and a soil tile.
`python3 scripts/above-art.py <folder of paintings>` keys the ground colour out (pulling the magenta cast back out of
Enzo's grey fur), keeps the biggest blob in each grid cell, scales each sheet so its reference frame stands at its
world height (heroes 118 units), anchors heroes at the head and props at the centre of mass, and packs eight WebP
atlases into `public/art/above-and-below/` plus `lib/above-art.ts` (107 frames). The room paintings are 1536×1024,
one world unit per pixel.

## Tests

- `npm run test:above`: 24 engine tests (save, key maps, seed replay, every frame painted, each room's rules, the
  hand-off grace with and without assist, the tells, hints and auto-help).
- `npm run bot:above` (`--quick` in `npm test`): human-delay bots on a virtual clock (they look, then wait 200–300 ms
  of game time; taps last 60–110 ms; wrong-way fumbles; ported from the prototype's Playwright bots). Casual (solo,
  knows the answer, one run in three ignores the hawk), pair (two players on one keyboard, own hands each) and
  explorer (solo, no answer key: only glints, calls, key prompts and the ghost). Thresholds: casual with assist clears
  every run with a median under 200 s; casual without assist two in three; the pair every run; the explorer with
  assist two in three (its one quick run must clear).
- `npm run test:e2e:above` (needs `npm run dev`, Playwright): 71 checks pressing every action with real keys and real
  touches at 1280×800, 390×844 and 844×390.

### Bot results (13-11-2026)

| Bot | Assist | Cleared | Median | Range | Prototype |
| --- | --- | --- | --- | --- | --- |
| casual | on | 6/6 | 112 s | 109–114 s | 3/3, 118–137 s |
| casual | off | 6/6 | 182 s | 166–187 s | 3/3, 186–219 s |
| pair | on | 6/6 | 113 s | 111–116 s | 3/3, 127–138 s |
| explorer | on | 3/3 | 307 s | 266–330 s | 3/3, 458–557 s |
| explorer | off | 2/2 | 938 s | 587–938 s | 1/2, 811 s |

Bumps per run: casual 3 with assist, 6 without (nearly all Enzo in the den); hawk catches 0.2 with assist, 3.5
without. The bots run faster than the prototype's mainly because the virtual clock has none of the browser
round-trip latency the Playwright bots paid on every look and key; the explorer also now waits to land before trying
the next button (in the prototype it pressed Act mid-jump in a fixed rhythm and could miss the sluice for minutes).

## What is weakest

- **The Stream Bank's clay** is the slowest beat for someone with no answer key (the explorer spends over half its
  run there): stamp, swap, dig before it sets is three things to discover at once.
- **Old Grubber in the upright phone view** zooms out to the whole room (the camera keeps both heroes and his body in
  frame), so the heroes are small and the view letterboxes inside its band.
- **No gamepad check in a browser**: gamepads are wired like the other games but only the keys and touches are
  exercised by the e2e suite.
- **One chapter, four rooms.** No chapter select; Continue starts from the last room entered.
