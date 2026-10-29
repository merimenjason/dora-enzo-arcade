# Ropeclimb: Dora & Enzo Tied Together

Game 53, at `/ropeclimb`. A side-on physics climber. Dora and Enzo are tied together by a short, stretchy rope and climb the inside of a giant barn tower, from the cellar to the weathervane on the roof at dawn. One climber moves while the other holds on. A missed leap is caught by the rope, and the climber left dangling can swing to a post or be hauled up. Falls cost height, never lives.

All numbers below come from `lib/ropeclimb-game.ts` and `lib/ropeclimb-world.ts`. Written 30-10-2026.

## Files

- `lib/ropeclimb-world.ts`: the tower. Six sections, twelve floors of 750 units each, with every ledge, post, hazard, tub and acorn written out by hand.
- `lib/ropeclimb-game.ts`: the rules. Deterministic and DOM-free, it runs at a fixed 60 ticks a second. The physics is position-based for both climbers and the rope's links. The rest of the randomness comes from a seeded mulberry32. It also holds the saving helpers.
- `lib/ropeclimb-scene.ts`: Canvas 2D drawing. It covers the camera, the paintings and their stand-ins, the rope, squash and stretch, dust and other particles, and screen shake.
- `app/ropeclimb/page.tsx`, `layout.tsx`, `ropeclimb.css` and `sound.ts`: the page. It handles input, the loop, saving, the HUD and WebAudio.
- `tests/ropeclimb.mjs`, `tests/ropeclimb-bot.mjs` and `tests/e2e/ropeclimb.mjs`: the tests.
- `docs/ropeclimb-art-brief.md`: the art brief. The paintings live in `public/art/ropeclimb/`.

## Moving

- **Walk** at 85 units a second. Heights point up. A climber is 18 units wide and 16 tall, and the tower is 480 wide and 9,000 tall.
- **Leap:** hold to crouch and charge, then let go to spring. Take-off speed grows from 290 (a hop of about 28 units) to 640 (about 136 units, some eight times their height) over 0.75 s of charge. Full aim tilts the leap 0.62 radians from straight up. A leap still works for 6 ticks after you walk off a ledge. In the air you steer at 520 units/s², up to 170 units a second. Falls top out at 900.
- **Grip** with your claws. Posts, the sides of hay stacks, beams (from underneath) and hay nets can be gripped. Your claws reach 6 units. After a leap you can't grip again for 9 ticks. You catch a beam from underneath only while rising at 90 a second or slower; any faster and you sail up through it and land on top. Hold up to climb a post at 60 a second.
- **Auto claws** is on by default: you grip whatever you touch, and hold the grip key to let go. With it off, you hold the grip key to grip.
- **Beams** and **straw** ledges are one-way: you jump up through them and land on top. Floors, stone blocks, chimneys, the bell and the roof ridge are solid. Each floor has a hatch to the next one, covered by a hay net you can climb up through but can't fall back down. Hard Knot has no nets.

## The rope

- **Length:** 130 units, or 90 on Hard Knot. It is made of 6 links solved 12 times a tick as inequality constraints, so it goes slack but never pulls longer than its length. It can stretch 10% before it stops like a wall. The links drape over ledges. The rope never cuts through a floor or a block: it bends round the nearest corner, so a climber hanging below a floor hangs from the edge of the hatch.
- **Weight:** a climber who grips, or one braced standing still on a ledge, is anchored and can't be moved by the rope. One standing without bracing gives way at 0.4 of the weight. In the air you are weightless to it. In 1 player, the climber you aren't steering braces by itself.
- **Catches:** when the rope suddenly stops a flying climber, that's a catch if the partner is anchored. If the partner is standing and gets pulled, that's a drag; if both are in the air, it's a yank. A taut rope damps 75% of its spring-back, so a catch doesn't bounce. The swing across is kept, so you swing like a pendulum. Steering with the swing pumps it higher.
- **Hauling:** an anchored climber holding up reels the rope in at 60% of its length a second, down to a quarter of its length, lifting the partner. The rope pays back out at 80% a second once it's slack or nobody hangs on it.
- **Tired claws:** holding a hanging partner tires your claws. That's 12 s while gripping, or 20 s braced on a ledge. A warning comes first, then you slip. Claws recover in 3 s.

## Falls

- **What counts as a fall:** a drop of more than 140 units below where you last stood. Both climbers dropping together count as one fall.
- **Hard landings:** landing faster than 640 a second shakes the screen and dazes you for 10 ticks. A fall just costs the height; you climb back up from wherever you land.

## The tower

There are six sections of two floors each. Every floor starts with a dust-bath tub.

| Section | Floors | Hazard |
| --- | --- | --- |
| The Cellar | 1–2 | Crumbling straw: holds 50 ticks once stood on, then is gone for 300 |
| The Stables | 3–4 | Hay bales sliding along beams: ride on top, and one sliding into a climber gripping beside its path knocks them loose |
| The Hayloft | 5–6 | Knothole gusts: dust puffs 45 ticks before one blows; it pushes climbers in the air sideways at 1,500 units/s² (up to 360) and slides standing ones |
| The Rafters | 7–8 | Swinging lanterns: radius 11, knock you off at 320 and daze you for 18 ticks; the first owl |
| The Bell Loft | 9–10 | The bell and two more owls |
| The Rooftop | 11–12 | Strong wind and loose shingles, up to the ridge |

**Owls** hear noise within 230 units:

- **Noise:** a landing makes 0.5 per 1,000 units a second of speed. A leap over 60% charge makes up to 0.3, a rope snapping taut 0.35, and the bell 1.3. Noise fades at 0.28 a second.
- **Waking:** at 0.55 an owl stirs, and at 1 she wakes. After a 40-tick wind-up she flaps for 50 ticks, which blows off anyone not gripping. Then she sleeps soundly for 300 ticks.

**The top:** both climbers standing on the ridge by the weathervane ends the climb.

## Dust baths and saving

- **Tubs:** walk both climbers into the next tub and they roll in the dust for 110 ticks. The clock stops while they roll, and the tub becomes the checkpoint. On Hard Knot the tubs are dry.
- **What is saved:** progress is kept in `localStorage` under `ropeclimb-v1`. That covers the climb at its last tub (tub, clock, falls, leaps, catches and acorns), every acorn charm found (saved as soon as you touch it), best times and fewest falls kept separately for normal and Hard Knot, how many climbs you've finished, the player count and the settings (sound, music, shake, auto claws). A broken save reads as fresh, and every number is clamped.

## Replay

- **The clock:** a speedrun timer that counts ticks.
- **Medals** for fewest falls: Sure-Footed (no falls), Steady Paws (5 or fewer) and Hay Hopper (15 or fewer).
- **30 acorn charms** are hidden in nooks across the tower.
- **Hard Knot** opens after the first finish. It has the 90-unit rope, no tub saves and no hay nets.

## Controls

- **1 player:**
  - ←/→ or A/D aim and walk.
  - Hold Space, Enter or J to charge, and let go to leap.
  - ↓, S or Shift let go (or grip, with auto claws off).
  - ↑ or W hauls the rope or climbs a post.
  - Tab, Q or E swap to the other climber.
  - Esc or P pauses.
- **2 players on one keyboard:**
  - Dora uses A/D, Space, S and W.
  - Enzo uses ←/→, Enter, ↓ and ↑.
- **Gamepads:** the first two pads. The stick aims, Ⓐ leaps, Ⓑ or a trigger grips or lets go, d-pad ↑ hauls, Ⓨ or a bumper swaps, and Start pauses.
- **Touch:**
  - ◀ ▶ aim, and the big button holds to charge a leap.
  - Smaller buttons haul, grip or let go, and swap.
  - Works on phones held either way.
- **Pausing:** the game pauses when the tab is hidden or the window loses focus. The clock doesn't jump when you come back.

## Sound

`app/ropeclimb/sound.ts` makes everything with WebAudio, and the audio context is created on the first key or tap. It covers:

- springs and plinks for leaps and grips;
- a twang for a catch and a creak for hauling;
- crumbles, gusts, an owl's hoot and the bell;
- a gentle music loop per section, plus a dawn tune for the ending.

The context is suspended in a hidden tab and closed when you leave the page.

## For tests

- **Hooks:** the page marks `main[data-ready="true"]` once it is ready. It exposes `window.__ropeclimb()` (the running `RopeclimbGame`) and `window.__ropeclimbStart({ seed, fresh, hard, tub })`. The engine's `place()` puts both climbers anywhere, and `clone()`, `stable()` and `hash()` serve the bot.
- **The bot:** `tests/ropeclimb-bot.mjs` climbs every floor from its tub the way a player would. It searches ahead with copies of the engine for the next real gain, then plays the route with a human's wobble on the charge and aim, and replans whenever a move lands somewhere unplanned. It checks that standing still for a minute climbs nothing, and that each floor takes under 8 minutes of climbing. `--quick` (in `npm test`) climbs floors 1, 5 and 9. `--floor=N` climbs one floor, and `--hard` climbs on Hard Knot.
