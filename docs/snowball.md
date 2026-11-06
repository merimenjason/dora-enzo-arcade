# Snowball Siege

Game 90, `/snowball`. The arcade's first voxel game: a snowball fight between two snow forts in a little Andean valley at golden hour. **Your snowballs come out of your own walls.** Every scoop leaves a hole in your cover, and every hit knocks real cubes out of theirs. Knock the top off their flag tower and the flag falls. Dora and Enzo take on a different pair of Andean neighbours on each of six slopes, or two players share one keyboard in Versus. It isn't a roguelite: the slopes are hand-made and open one after another. Built on 06-11-2026 from the voxel mock-up `vx-snow`.

## Files

| File | What it is |
|---|---|
| `lib/snowball-game.ts` | The engine: 60 ticks a second, deterministic from a seed, no DOM. The 42 × 14 × 11 cube grid and the forts, the characters, scooping, patching, the throw's flight, hits, support (cubes left hanging fall), the flag, ice, wind, pines, time-up, the rivals' brains and the test bots, and the save. |
| `lib/voxel-model.ts` | Shared, for later voxel games, with no DOM and no Three.js (it compiles in Node). Parses a voxel model's JSON and meshes any grid of cubes into plain arrays: faces between a cube and empty space only, flat normals, per-vertex ambient occlusion, the quad split along the brighter diagonal. A model can paint its front face and its sides from different views. |
| `lib/snowball-scene.ts` | Three.js: each slope's own light, fog and Codex sky (golden hour with a low warm sun from the right, peach highlights and lilac shadows, cold morning, bright windy noon, the wood, a pink sunset, starry dusk with glowing lanterns); a material that draws a dark edge round every cube face (the ground gets a fainter world grid with a shade per cell) and per-cube colour noise; drifts of loose blocks in front; per-slope dressing (cracked ice sheet, rocks and blowing snow, a dense wood, a mirror lagoon with wading flamingos); the fort cubes meshed in chunks of 8 columns (only a touched chunk is remeshed), the voxel characters and props, snowballs with puff trails, chunky debris that tumbles and bounces, a white flash and powder burst on every hit, dizzy stars, a white flash on a stunned character, confetti when a flag falls, the flags flapping, sinking and tipping over, cracking ice, wobbling pines, the windsock, the first third of the throw's arc, the camera's sway and shake, and picking (the cube under the pointer). |
| `app/snowball/page.tsx` | The screens (title, slopes, match, result and ending, how to play, settings), mouse, keyboard and touch, the fixed-step loop, the save, and `window.__snowball()` with `debug` helpers for the browser tests. |
| `app/snowball/sound.ts` | Synthesised effects (scoop, pat, whoosh, thud, powder, ice crack, splash, flag fall, cheer, groan, stun birdies, wind) and four original chiptune loops (title, match, the Summit, ending). |
| `app/snowball/snowball.css` | The look (prefix `sb-`): the score bar above the valley, Enzo's tips and the buttons below it, so no words ever sit over a face. |
| `public/art/snowball/` | The voxel models (`<name>.json`) and the sky, title and ending paintings (see **Art**). |
| `scripts/snowball-art.py` | Turns the Codex paintings into the models and pictures. |
| `tests/snowball.mjs`, `tests/snowball-bot.mjs`, `tests/e2e/snowball.mjs` | Engine checks, the bots, the browser suite. |

## The rules

- **The valley** is 42 cubes wide and 11 deep. Each fort has a front wall 2 cubes thick and 2 high with crenellations, side walls (the far one 2 high, the near one 1 high, so you can see in), and a 3 × 3 flag tower 6 high at the back. The Summit's forts have a 3-thick front wall, an 8-high tower, an inner wall in front of it and two 2 × 2 corner turrets four high.
- **Two chinchillas a side.** You control one; Tab, Q, the Switch button or a tap on the other swaps them. The one waiting ducks a couple of steps back (it can't be hit) and rolls a snowball from the floor snow every 5 s.
- **Scoop:** click or tap a cube of your own fort within 3.2 cubes and no higher than 4: 0.35 s, +1 snowball, and the top cube of that column goes (so nothing is left floating). You carry 5. Never the flag tower's top three layers. **Floor snow** (click the ground of your fort, the button, or G with nothing in reach): 2.2 s, costs no wall.
- **Patch:** right-click or long-press a gap in your wall (on the ground or on a cube) to pat a snowball back in as a cube: 0.3 s, −1 snowball.
- **Throw:** drag back from anywhere and let go, like a slingshot; the further, the harder (up to 36 cubes a second). Only the first third of the arc is shown. Throws fly straight across the valley at the thrower's depth, so walk along the fort (A/D, or tap the wall or ground further along) to line up. Hold the aim for 1 s with 2 or more snowballs to pack a **hard snowball**: it costs two, and the preview turns blue.
- **Hits:** a snowball takes out the cube it hits, and each of the four cubes above, below and beside it with a 22% chance; a hard snowball takes the whole cross of five. Then any cube no longer joined through faces to the ground falls.
- **Characters** are exposed only while standing: aiming, and for half a second after a throw (3.3 cubes tall standing, 1.3 ducked). A hit stuns for 1.5 s: no aiming, scooping or patching, and dizzy stars.
- **Win** by clearing the top three layers of their 3 × 3 tower (27 cubes): the flag sinks as they go and falls with the last. At 2:00, the tower with more of its top three layers left wins; level, whoever knocked more cubes out of the other fort; still level, a draw.
- **Stars:** the win; your own tower kept (at most 2 cubes lost); a win inside a minute.

## The slopes and the neighbours

| # | Slope | Rivals | Twist | Their brain |
|---|---|---|---|---|
| 1 | Sunny Slope | the Vizcacha Twins, Vicu and Chita | the tutorial, with Enzo's tips | slow (react 24 ticks, a throw every 3.6 s), wild aim, dig their own front wall away |
| 2 | Frozen Pond | the Pudú Pair, Pía and Poco | the fort floors are ice: each snowball that lands cracks a cell (a hard one twice), the third makes a hole for 12 s, and anyone on a hole falls in (stunned 2.5 s) | slow and wild, but every miss that lands inside your fort cracks the ice |
| 3 | Windy Ridge | the Guanaco Gang, Gus and Guada | wind of 2 to 6 cubes/s² that changes every 15 s, shown by the windsock and the score bar | long lobs, allow for half the wind |
| 4 | Pine Wood | the Culpeo Foxes, Cula and Pepo | four pines just outside the forts block throws; hit one and its snow drops on anyone within 4 cubes, stunning them | swap throwers after most throws |
| 5 | Salt Lagoon | the Flamingo Sisters, Rosa and Lila | a lagoon between the forts swallows snowballs | high lobs, hunt anyone standing |
| 6 | The Summit | the Spectacled Bears, Oso and Osa | the big forts | hard snowballs, and they pat holes back in |

Each slope opens when the one before is won. The rivals have human reaction delays (11 to 24 ticks), aim error (a spread of 4 to 15% of the throw's speed), learn from where their last throw landed, and dig with personality: early ones take the front wall in front of them, later ones spare cubes from the back.

**Versus:** Dora's fort against Enzo's, one chinchilla each. Player 1: A/D walk, W/S angle, hold F to throw (the power swings up and down while held), G to scoop. Player 2: ←/→, ↑/↓, hold `.`, `,`. One player can use the same keys (or Space) instead of the mouse.

## Controls

- **Mouse:** click your snow to scoop, the ground of your fort for floor snow, further along to walk there; drag back to throw; right-click to patch; Tab or Q to switch; Esc or P to pause.
- **Keyboard:** as in Versus.
- **Phone, sideways:** tap to scoop or walk, drag to throw, long-press to patch, tap the other chinchilla to switch. **Upright:** a closer camera on our fort and a "turn your phone sideways" hint; it still plays.

## Art

All painted by Codex (prompts in `scratchpad/art2/jobs.txt`, prefixes `sb-`, `sb2-` and `sb3-`; Dora was repainted as `sb3-dora`), then built by `python3 scripts/snowball-art.py <folder>`:

- **Characters** (Dora, Enzo, vizcacha, pudú, guanaco, culpeo fox, flamingo, spectacled bear): each a chibi pixel-art front view (about 24 × 30) and side view (about 16 deep) on magenta (`sb2-*`). The script keys the magenta, crops, finds the size of one painted pixel (the commonest run of one colour along the rows), samples both views at the centres of that grid (43 to 76 model pixels tall) and keeps a cube wherever both views are solid (a visual hull). Each cube keeps two colours: its front face from the front view; its sides and back from the side view in the back half of each row (tail, hat, satchel) and from the front view in the front half, so the profile's eye never reads as a second face. The dark outline is painted over on the sides and back. Only surface cubes are written.
- **Props** (pine, rock, snowman, lantern post, red and blue pennants): one sheet of front views; round ones reuse the front as the side, thin ones are two cubes deep.
- **Skies** (one per slope: `sky`, `sky-pond`, `sky-ridge`, `sky-pines`, `sky-lagoon`, `sky-summit`), **title, ending:** voxel-style paintings, written as WebP. The title keeps its left 40% clear for the logo; the ending's words sit in a panel under the painting.
- The fort snow, ice, water, snowballs, debris and powder are drawn in code.

## Bots

`tests/snowball-bot.mjs` plays our side through the engine at 60 ticks a second. The rivals are each slope's brain; our side is one of:

- **pro:** react 12 ticks, aim spread 4.5%, a throw every 1.2 s, digs walls 75% of the time (sparing cubes), sometimes hard snowballs and patches.
- **casual:** react 15, spread 8.5%, a throw every 1.8 s, digs carelessly.
- **turtle:** the pro, but never digs a wall (floor snow only).
- **random:** throws anywhere.

Results (30 matches a slope, 06-11-2026):

| | Sunny | Pond | Ridge | Pines | Lagoon | Summit |
|---|---|---|---|---|---|---|
| casual | 29/30 | 30/30 | 20/30 | 13/30 | 8/30 | 7/30 |
| pro | 30/30 | 30/30 | 30/30 | 27/30 | 28/30 | 21/30 |
| turtle | 29/30 | 28/30 | 27/30 | 20/30 | 16/30 | 13/30 |
| random | 0 | 0 | 0 | 0 | 0 | 0 |

Head to head the pro beats the turtle 109 times in 120 (both sides of the valley), so scooping your own walls is worth the holes. A pro's match lasts about 60 s; the casual player's about 75 s. The test asserts: casual ≥ 80% on slopes 1 and 2 and 25 to 85% on slope 3; pro ≥ 60% everywhere (40% on the Summit); the turtle never digs and loses ≥ 70% to the pro; random never wins past slope 1; average match 25 to 110 s.

## Tests

- `npm run test:snowball`: scooping and floor snow, patching, the preview matching the real flight, a seed replaying a match, hits and the hard cross, support, the flag, stuns, ice, wind, pines, time-up, every slope loading and won by the pro, Versus, the save, and the voxel mesher.
- `npm run bot:snowball` (`--quick` in `npm test`).
- `node tests/e2e/snowball.mjs` (dev server running): the title, the how-to, the slopes, a click scooping, a drag throwing, a right-click patching, Tab, pause, a win and its save, a loss, the settings, Versus keys, a corrupt save, and phones sideways and upright.

## Ideas not done

- Painted poses (digging, throwing, dizzy); the poses are whole-body tilts for now.
- A sled prop, and the snowman being hittable.
- The hull's sides take each row's front-edge colour, so they look stripy side-on; in the match the characters face the camera (within about 10°, twisting towards the target only as they throw) so the sides barely show.
