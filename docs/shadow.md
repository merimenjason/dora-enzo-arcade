# Shadowplay

A shadow-puppet theatre puzzle at `/shadow`, game 69 of the arcade, in a new shadow-puppet art style. Dora and Enzo run a little travelling paper theatre, and every night they tell a story in shadow: the player hangs lace-cut puppets between the lantern and the glowing paper screen, turns, flips and slides them near and far until their shadows make the picture, and the scene comes alive.

All numbers below come from `lib/shadow-game.ts`, `lib/shadow-levels.ts`, `lib/shadow-scene.ts` and `app/shadow/page.tsx`. Written 01-11-2026.

## Files

- `lib/shadow-game.ts`: the rules. The projection, the raster and the overlap score, coloured glass, the match, snapping, what each scene allows, a performance in progress (moves, undo, reset, hints), stars, unlocking and the save. Deterministic, no DOM, no randomness, no clock.
- `lib/shadow-levels.ts`: the 35 puppet outlines (all built from arcs, curves and strokes) and the five stories of six scenes, each with its starting layout and its designed solution.
- `lib/shadow-scene.ts`: the drawing (Canvas 2D): the theatre, curtains and carved frame, the paper, one light layer per lantern with every puppet's shadow cut out of it (softer the nearer it hangs to the lantern), glass tinting the light, lace holes letting it through, the faint target and its dotted outline, the board seen from above with beams, rods and lanterns, Dora and Enzo as jointed chinchilla puppets, the coming-alive animations and the finished pictures, dust and ambience, the final performance and its woodland audience, and the painted stand-ins.
- `lib/shadow-pictures.ts`: the finished pictures, drawn over the shadows when a scene comes alive (drawing only).
- `app/shadow/page.tsx`, `shadow.css`, `sound.ts`, `layout.tsx`: the page (menu, stories, stage, free stage, final performance, ending), input, saving and the HUD; the sounds and gamelan-like music are made with WebAudio.
- `tests/shadow.mjs`, `tests/shadow-bot.mjs`, `tests/shadow-solutions.json`, `tests/e2e/shadow.mjs`: engine checks, the searching bot and its recorded layouts, and the browser suite.
- Paintings in `public/art/shadow/`, briefed in [`shadow-art-brief.md`](shadow-art-brief.md).

## The projection

- The paper screen is 16 × 9 units. The lantern stands 12 units behind it (`LAMP_D`). A puppet hangs at one of seven depth notches, which cast its shadow at 1, 1.2, 1.45, 1.75, 2.1, 2.5 or 3 times its size (`KS`): against the screen it casts its own size, right by the lantern three times as big. The notch's distance from the screen is 12 × (1 − 1 / scale).
- A puppet's position is stored as where its shadow's middle falls from the lanterns' home (in eighths of a unit). When a lantern slides by Δ, a shadow at scale k moves by −Δ × (k − 1): puppets on the screen don't move at all, puppets by the lantern move twice as far the other way. Lanterns slide in quarter units within each scene's range.
- With two lanterns (gold at x = 6 and blue at x = 10), every puppet casts two shadows. On the screen they fall together; further back they part, the gold lantern's to the right and the blue's to the left. Where only one lantern's shadow falls the other colour shines; where both fall it's dark.
- Rotation turns in 24 steps of 15°. Flip mirrors left to right. Turn (only some puppets) tips a puppet on its rods in six steps, from face-on to edge-on; its shadow narrows to the cosine of the angle, but never below 12% (`EDGE`). A round fan's stick stays the same width as it turns, and a round puppet never needs rotating or flipping.
- **Glass:** the gold coin, gold fan, jade leaf, ruby drop and blue bow are coloured glass. They tint the light instead of blocking it; glass over glass mixes, and a dark puppet in front of glass still casts dark.

## The match

- The picture is rasterised at 8 cells a unit (128 × 72). Each cell records, for each lantern, clear, blocked or which glass colours tint it, and the overlap score is the share of cells that agree among those that are not clear in either picture.
- A scene is cast when the overlap is at least 86% (`MATCH`) and every part of the picture (each puppet's own shadow in the solution) has at least 75% of its cells right, counting a cell as right if any cell next to it is (`COVER`). The second rule stops a small part, a moon or an eye, being left out.
- The meter in the bar shows min(overlap / 86%, worst part / 75%), reaching 100% at a match.
- A puppet let go within 0.45 units of its place (or a twin's, the same outline) at the right depth, rotation, flip and turn clicks into it exactly (`SNAP`).
- The faint picture on the paper is the solution's own light and shadow, drawn into the paper with a dotted golden outline; it is always reachable.

## Moves, stars and unlocking

- A move is picking up a different puppet or lantern; changing the same one again is free. Undo doesn't refund a move; Reset starts the count again. Dragging a puppet undoes in one step.
- Par is the number of puppets and lanterns the designed solution changes, and the bot shows no layout needs fewer, except where it finds one (see below). Stars: one for casting the scene, one for casting it within par + 2 moves (`MOVE_SLACK`), one for the scene's flourish: a perfect fit (an overlap of 94% to 97% or more, by scene), or an extra puppet hung in the sky clear of the picture (at most a quarter of it over the picture). Stars and the fewest moves are kept and only ever improve.
- The first story is open. Inside an open story a scene opens when either of the two before it is cast; the finale waits for the other five. A story opens when the one before is performed to the end. The free stage opens after the first story; the final performance after the very last scene (5-6).
- The hint picks the lantern that is off its mark, or else the puppet furthest from its place (or a twin's), and shows its place as a pulsing glowing outline, with a line telling what to change (take it down, depth, flip, turn, rotate, move).

## The stories

1. **The Cat Who Wanted the Moon** (one warm lantern; drag, then rotate, then flip): Moonrise, A House on the Hill, The Cat, A Tail to Tell, Up on the Roof, The Cat Who Wanted the Moon.
2. **The Little Ship** (depth): Near and Far, The Little Ship, Rolling Waves, The Whale, The Lighthouse, Home Through the Storm.
3. **The Lantern Walk** (the lantern slides): Peekaboo Moon, The Owl’s Branch, The Hare in the Moon (glass), The Saucepan Stars (seven stars at different depths line up from one lantern spot only), Lanterns in the Trees, Home by Lantern Light.
4. **The Two Lanterns** (gold and blue): Gold and Blue, The Night Village, The Owl and the Crescent, The Rainbow Fish, The Peacock, The Lantern Festival.
5. **The Dragon of the Wood** (everything, with turning and taking down): Edge On, The Swan Pond, Too Many Puppets (two decoys), The Dragon’s Egg, The Dragon Wakes, The Dragon and the Moon (par 7, a decoy teapot).

Each scene has an opening line, a line when it comes alive, and on teaching scenes a tip card. When a scene is cast every puppet glides to its exact place, the light brightens, Dora and Enzo cheer, and the scene moves: the cat's tail wags, waves sway, stars twinkle, wings flap, with the story's ambience (stars, waves, fireflies, petals, snow or embers).

As a scene comes alive its shadows also sharpen into focus (the blur from hanging near the lantern falls to a fifth), and some pictures are finished by hand over the shadows (`lib/shadow-pictures.ts`), fading in as the puppets settle. Every stroke is tied to one puppet in its own outline units, so it moves with that puppet's animation:

- **the cat** (1-3, 1-4, 1-5, 1-6 and 3-6): the upturned bellflower head is filled in crisply, with glowing almond eyes that blink now and then, pink ears, a nose, a mouth and whiskers;
- **the peacock** (4-5): a great gold train of eyed feathers, fringed with blue, is painted into the lantern light behind the body (so the body's shadow falls across it, and it swells with the fan), the body and neck turn peacock blue, and the feather's tip gets a head with an eye, a beak and a crest of three plumes, with legs and toes under the pear;
- **the dragon that wakes** (5-5): fierce gold eyes and little horns on the cat's head, ribs on the chestnut wing and a hot gold heart in the ruby fire;
- **the dragon and the moon** (5-6): a horned head over the scissors (the blades are its open jaws, with teeth, a nostril and a gold eye), spikes along the wave crust's back with pale belly scales and two clawed legs, a spade on the tail's curl, ribs on the wing and the fire's gold heart.

The puppets, solutions and pars are unchanged.

Dora and Enzo are jointed shadow puppets in the Chinese style, and chinchillas: a plump round body, a big round head with a broad, smooth, gently flat crown and a short blunt muzzle, large round pink ears set at the crown's sides, a big bushy tail, short whiskers, carved ink lines and lace dots, a coloured gel flower on the belly and a riveted arm on a rod. Dora is cream-white with ruby-red eyes (and a ruby flower), Enzo cool blue-grey with black eyes (and a blue one). They stand turned three-quarters towards the play and point, think, talk, cheer and bow.

## The bot

`tests/shadow-bot.mjs` casts every scene seeing only the target raster. It slides each lantern to its best spot, then for each puppet tries every depth, turn, rotation, flip and (where allowed) on or off over a coarse grid of positions, refines the best dozen (and the best in each of the eight most promising two-unit patches of the screen, so a small spot is not lost behind a bigger one) to the eighth of a unit, and lets go (so the game's snapping applies, as for a player); it keeps the candidate with the most overlap, unless one casts the scene. It tries every puppet order where three or fewer move (otherwise biggest first, smallest first and the authored order), keeps the fewest moves, and must cast every scene within par + 2 and never in fewer than par. Its layouts and move counts are recorded in `tests/shadow-solutions.json`; `--quick` (part of `npm test`) replays them instead of searching, and `--write` records them again. A random puppeteer then throws every movable puppet and lantern anywhere it may go, 300 times a scene: where two or more things must be set it never casts the scene, and where only one puppet or lantern moves (Moonrise, Near and Far, Peekaboo Moon, The Saucepan Stars, Gold and Blue) a throw that lands on the spot may, at most one time in ten (a lantern has only a few dozen spots). The full search takes about half an hour.

## Controls

- **Mouse:** drag a shadow on the paper to move its puppet (picking it up selects it); drag the round ⟳ handle above the chosen puppet to rotate it; drag a puppet's rod on the board below the screen up or down to slide it nearer the screen or the lantern; drag a lantern on the board sideways; the mouse wheel changes the chosen puppet's depth.
- **Keyboard:** Q / E rotate, F flip, T turn (Shift+T back), + / − (or W / S) nearer the lantern or the screen, [ / ] slide the lantern, arrows nudge by an eighth (Shift: a whole unit), Tab / Shift+Tab next or previous puppet, X (or Delete) take it off the rods, Z undo, R reset, H hint, Esc deselect or pause.
- **Touch:** the same drags with a finger; the toolbar has ⟲ ⟳, ⇋, − and ＋ with a depth gauge, ◐ turn, 🪝 take down, ◀🏮 🏮▶, ↶ undo, ⟲ reset and 💡 hint (only the tools the scene uses appear). A puppet taken down waits as a chip by the toolbar to be hung again.

## The free stage

Any of the 35 puppets (up to 12 at once), one warm lantern or the gold and blue pair, every tool and no outline. It is kept in the save as it is made.

## The final performance

Casting 5-6 ends the show: each story's finale is played in turn on the screen with its puppets alive and a woodland audience in silhouette along the bottom, then Dora and Enzo come to the middle of the stage and bow while the audience claps, then the ending painting with the company's credits. It can be watched again from the menu, and skipped with Skip or Esc.

## Fitting the screen

The paper screen is as big as fits at 16 : 9 with the board (a fifth of its height, half on a tall screen) below it, between the bar and the toolbar, inside a carved frame with velvet curtains (dropped on tall screens). Dora and Enzo stand inside the screen's lower corners; on a tall screen (an upright phone), where the screen is only as wide as the phone, they stand instead in a loft above the frame (nearly as tall as the screen, at most 200 pixels and three tenths of the room), big and on their rods, and the deeper board is easier to drag on. On phones the toolbar wraps, the scene's line, toasts and tips move to the top, and the bar slims down on a phone held sideways.

When a scene's result card comes up, the toolbar steps aside and the theatre glides (in 0.6 s) to the picture alone, with no board, as big as fits beside the card: above it on a computer and an upright phone, to its left on a phone held sideways, where the card stands at the right. The card never covers the living picture. The scene's last line is in the story line above the stage; the card repeats it only on a phone held sideways, where that line is cut short.

## Saving

`localStorage` key `shadowplay-v1`: finished scenes with their stars (as bits) and fewest moves, the free stage (puppets with poses, one or two lanterns, lantern offsets), whether the first-scene guide is done, whether the ending has played, and the Sound and Music settings. Every field is checked as it is read: unknown scenes, poses off the grid, unknown puppets and bad numbers are dropped, and a save that cannot be read starts fresh.
