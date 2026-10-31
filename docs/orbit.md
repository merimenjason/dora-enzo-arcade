# Moonhop

Game 60, at `/orbit`. A cosy gravity-slingshot skill game for one player. Dora and Enzo's paper-lantern balloon has drifted up past the clouds into a sky of tiny round moons, and the fireflies that light it home have wandered off between them. Holding paws, the pair walk round whichever moon they stand on, crouch, and leap; every moon pulls on them, so leaps curve, slingshot and swing into orbit. Gather every firefly to open the home lantern, then land on its moon.

All numbers below come from `lib/orbit-game.ts`, `lib/orbit-levels.ts` and `app/orbit/page.tsx`. Written 31-10-2026.

## Files

- `lib/orbit-game.ts`: the rules. A deterministic fixed-step simulation with no DOM, no clock and no `Math.random`: `Hop` holds the moons, the pair, the fireflies and the lantern and moves them one 1/120 s step at a time from an input (`left`, `right`, `up`, `down`, `jump`, and a world `point` for the mouse or a finger). It also holds `play` and `walkTo`, which play one leap (or a walk into a rabbit hole) with exactly the inputs a player gives, used by the bots, the Moon Garden and the tests.
- `lib/orbit-levels.ts`: the five skies and their forty stages, the pars and Starlight times, the save and the progress rules, and the Moon Garden's field grower (with its seeded generator).
- `lib/orbit-scene.ts`: Canvas 2D drawing: the painted sky behind three layers of drifting stars, the moons with their painted surfaces turning as they spin, props on their rims, jelly wobbles, bean ripples, breathing rings, comet tails and rabbit holes; the fireflies and the home lantern; the dotted path, the charge ring and the aim mark; Dora and Enzo as painted cut-outs in four poses; puffs, dust, sparkles and the lantern string; the camera; and the off-screen arrows. It also paints the little stage maps and the drawn stand-ins for the title and ending.
- `app/orbit/page.tsx`, `layout.tsx`, `orbit.css` and `sound.ts`: the page. It turns the mouse, touch and keys into the game's input, runs the fixed-step loop, saves, and shows the menu, the sky map, the tips, the done card and the ending. The sounds and the music are made with WebAudio.
- `public/art/orbit/`: the paintings; see [`orbit-art-brief.md`](orbit-art-brief.md).

## The pull

Every moon pulls towards its centre with `μ / (d² + (2.5 r)²)`, inverse-square with a soft cap near the surface. `μ` is set so a moon of radius 50 has a surface pull of 700 px/s², and the pull at the surface grows with the square root of the radius, so big moons pull harder and further. The pull is full out to 6 radii and fades smoothly to nothing by 10. Comets pull at 55% and black-bean moons push at 85%. A pulsing moon's pull is multiplied by `1 + amp · sin(2πt / period)` (amp 0.5 to 0.7, a 4 to 5 second breath).

## Walking, charging and leaping

- **Walking** runs at 110 px/s along the surface (moss 75%, ice 125%). The arrow keys are latched: whichever way **→** first walks (clockwise on the top half of a moon, anticlockwise underneath) it keeps walking while held, so going over the bottom of a moon never turns them round. With the pointer they walk the shorter way to the spot under it.
- **Charging**: holding the button (or **Space**) fills the ring over 1.1 s. With the pointer the ring only fills once they reach the spot. Holding through a landing does nothing until the button is let go and pressed again.
- **Leaping**: letting go launches them straight off the surface at 150 to 420 px/s, plus the moon's own movement and spin (a spinning moon flings them sideways).
- **The puff**: once per leap, a 95 px/s nudge towards the pointer, or along the held arrows, or (with nothing held) along the flight. Landing (or a jelly or bean bounce) refills it.
- **Lost in the dark**: flying more than 320 px past the field's edge, or for more than 8 s, starts the lantern string's 0.75 s rewind to the spot they leapt from. The leap still counts.

## Moons

| Moon | First | What it does |
| --- | --- | --- |
| Plain | sky 1 | Lands them, with a little slide (30% of the sideways speed). |
| Big and small | sky 1 | Bigger moons pull harder and further, and take a fuller ring to leave. |
| Moss | sky 2 | Stops them dead on landing; slower walking. |
| Jelly | sky 2 | A landing faster than 95 px/s into the surface bounces them off (86% of the speed back), puff refilled. Softer landings stand. |
| Spinning | sky 2 | Carries them round (ice only a fifth as much) and adds its rim speed to a leap. |
| Ice | sky 3 | Skids: a landing keeps 90% of the sideways speed, and walking speeds up and slows down slowly. |
| Pulsing | sky 3 | The pull breathes in and out; a ring pulses outward with it. |
| Comets | sky 4 | Small icy moons on long loops, with tails. Land on one to ride it; leaping off keeps its speed. |
| Twin moons | sky 4 | Two moons circling a shared centre half a turn apart. |
| Black beans | sky 4 | Push instead of pull, and always bounce them off (at least 120 px/s). |
| Rabbit holes | sky 5 | Walking into one pops them out of the matching hole on another moon; stepping off and back on goes through again. |

## Fireflies, the lantern and the stars

A firefly is gathered when it comes within 24 px of the pair's middle (17 px above their feet), in flight or walking. Some hover still and some circle a moon. Gathering every firefly (the golden one is never needed) opens the home lantern; landing on its moon then finishes the stage, and standing on it as the last one is gathered does too. Landing on it shut shows how many are still out there.

Each stage has three stars, kept for good once earned: ★ home, ★ the golden firefly (one per stage, hidden off the obvious way), ★ home within the leap par. The gathered fireflies circle the pair until the lantern takes them in.

## Skies

| Sky | Stages | Teaches |
| --- | --- | --- |
| 1 · Lantern Clouds | First Hop, Hold for Higher, Round the Moon, The Big Moon, Puff!, Firefly Ring, Slingshot, Lantern Row | Walking, charging, aiming by walking round, big moons, the puff, circling fireflies, slingshots. |
| 2 · Mushroom Moons | Soft Moss, Jelly Bounce, Turning Moon, Jelly Ladder, Mushroom Ring, Pinball, Spin Cycle, Toadstool Tops | Moss, jelly, spinning moons. |
| 3 · Frost Moons | Slippery, Breathing Moon, Skating Round, Frost Pulse, Icicle Chain, Two Breaths, Skid and Leap, Aurora Crown | Ice and pulsing moons. |
| 4 · The Comet Stream | Catch a Comet, Twin Moons, Black Bean, Comet Rider, Bean Field, Twin Waltz, Stream Crossing, Comet's Tail | Comets, twin moons, black beans. |
| 5 · The Night Garden | Rabbit Hole, Burrow Maze, Garden Swing, Moonflowers, Under the Leaves, Night Bloom, Old Lantern Path, The Home Lantern | Rabbit holes, then everything together. |

Stages open one after another, and the first stage of a sky opens when the last sky's final stage is home. A tip card explains each new moon the first time it appears. The dotted path shows the first second of a leap in the first two skies, 0.9 s then 0.75, 0.6 and 0.45 s in the later skies. The Home Lantern (5-8) plays the ending.

## Pars, Starlight and the bots

The search bot in `tests/orbit-solve.mjs` plays each stage with the page's own inputs on copies of the game: from each spot it tries 24 aims, 11 ring levels and, on stages where things move, three waits (and, if that finds nothing, a puff at 0.35 s or 0.7 s in four directions). It is a breadth-first search over (moon, fireflies gathered), so its route home has the fewest leaps, and it only keeps leaps a person could repeat: the same leap anywhere up to 0.05 rad off in aim or 0.035 off in charge, checked every 0.005 rad and every step of the ring so there is no gap an exact hand would have to find, must end the same way (on the same moon with the same fireflies, so a last leap that snatches the golden firefly on the way home must snatch it every time). The par is the bot's leaps with the golden firefly plus one (plus two from six leaps up). The **Starlight** time is the bot's route time × 1.25 + 4 s.

`npm run bot:orbit` takes a few minutes. For each stage it proves what the stars rest on: the saved route in `tests/orbit-solutions.json` is checked leap by leap (home with every firefly and the golden one, within the par, every leap steady), and a search to par − 3 leaps (with the puff when the route needs it) finds no way home, so the par is never more than two leaps of headroom. Only when a saved route no longer works (or with `--write`) does it search in full, putting the saved route first in each layer, which changes the order and never the answer. It also measures each route's **success window**, how far each leap's aim and power can each go wrong, either way, before the leap ends differently, and checks every stage's narrowest leap is at least 0.05 rad and 0.035, and that Skid and Leap's is at least as wide as its neighbours'. `npm test` runs `--quick`, which replays the saved routes and measures their windows without searching. Skid and Leap's golden firefly sits just under the jelly moon, where a real hop reaches it: it used to hang so low that the only way to it was a leap that drifted off into the dark and was reeled back.

**Starlight** opens once the Frost Moons are done: the same stages with no dotted path and a clock, and a 🏅 medal for coming home within the Starlight time.

## The Moon Garden

Opens once Lantern Clouds is done. An endless run of generated fields: field `n` always grows the same from its number. A field is grown leap by leap: from the newest moon the grower plays a leap with the real inputs, sets the next moon down where that flight is heading 0.85 to 1.6 s in, replays the leap with the new moon's pull to hang a firefly on the actual path, and keeps the moon only if the whole route so far still works. The finished field is replayed from the start once more, so every field comes with a route that finishes it. Fields grow from 3 moons to 7, and moss, ice, spinning and pulsing moons join from fields 2, 3, 4 and 5.

## Controls

- **Mouse**: point and hold on the side of the moon to leap from (a dashed mark shows the spot as you hover); they walk there and the ring fills; let go to leap. In the air, click the way to puff.
- **Touch**: the same with a finger; tap the way to puff.
- **Keys**: **←**/**→** (or **A**/**D**) walk, hold **Space** (or **J**) and let go to leap, **Space** in the air puffs (aimed with the arrows), **L** or holding **Shift** looks at the whole sky, **R** restarts, **Esc** goes back to the sky map, **Enter** goes on from a finished stage.
- **Look** and **Again** buttons sit in the corner. Sound and Music are toggles on the menu and the map.

## Feel

The camera eases in from the whole field at the start of a stage, then frames the pair, the moon they stand on and the moons near them, drawing back in long flights and never letting the pair get smaller than about 56 px on screen (42 px on a phone held upright, so the next moon fits across the narrow view). Off-screen fireflies (and the open lantern) get arrows at the edge of the view. Leaps whoosh, landings squish (a boing on jelly, a crunch on ice), each firefly rings a chime one step up the scale, and the music box gains a layer every quarter of the fireflies gathered.

## Saving

Progress is saved in `localStorage` under `moonhop-v1`: each stage's three stars, fewest leaps, best Starlight time and medal; the Moon Garden's next field and best; the tips seen; whether the ending has been seen; and the Sound and Music settings. A save is read defensively: anything malformed is ignored, and a stage only counts if the way to it is open.
