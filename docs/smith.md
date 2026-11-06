# Pixel Smith

Game 86, `/smith`. A pixel-art action roguelite where Enzo draws Dora's weapon pixel by pixel on a 12 by 12 grid between rooms, and Dora fights with exactly what he drew. The weapon's shape is its hitbox and its colours are its powers. Five kinds of critter (Pebble Beetles, Glint Magpies, Frost Newts, Ember Salamanders and Moss Tortoises) burst into loose pixels that are the paint for the next weapon, and Dora's health is her own fur, patched with the same paint, so every pixel spent on a bigger weapon is one that can't patch her up. It was the top-scoring original pixel roguelite in [`game-ideas.md`](game-ideas.md) (8.40), built on 06-11-2026.

## Files

| File | What it is |
|---|---|
| `lib/smith-game.ts` | The rules, deterministic at 60 ticks a second with no DOM: painting, the weapon's geometry and weight, swings, the critters, ice, the Smudge, loose pixels, rooms and waves, the sketchbook, the run and the save. |
| `lib/smith-scene.ts` | Canvas 2D drawing at 384 by 216 pixels, scaled up with nearest-neighbour: the room, loose pixels, critters (white when hit, blue when chilled, flickering when burning), the Smudge's rub marked on the floor, ice, and Dora with the weapon, losing pixels from her sprite as she loses fur. `weaponPicture` and `drawWeapon` also draw the easel's preview. |
| `app/smith/page.tsx` | The easel (the grid, paint pots, rubber, sketches, patching fur, a preview), the fight's HUD, input (mouse and keys, or a thumb stick and buttons), Enzo's pointers, the sketchbook, results and the save. Exposes `window.__smith()` with `debug` helpers for the browser tests. |
| `app/smith/sound.ts` | Synthesised effects (a whoosh that gets lower for heavier weapons, a different hit for each colour, bursts, a rising blip for each pixel picked up, ice, chips, the Smudge's squeaky rub, Enzo's brush and rubber) and seven original chiptune loops (title, the easel, the mine, the cellar, the forge, the Smudge, ending). |
| `app/smith/smith.css` | The workshop look. On a phone held upright the HUD goes above the room and the thumb stick, ROLL and SWING below it; the easel stacks with the grid first. |
| `public/art/smith/` | The art (see **Art**). |
| `scripts/smith-art.py` | Turns the Codex paintings into the game's pixel art. |
| `tests/smith.mjs`, `tests/smith-bot.mjs`, `tests/e2e/smith.mjs` | Engine checks, bots and the browser suite. |

## The weapon

- **Painting.** The handle is the bottom-left square and is always there. A pixel can only go down touching the handle or a pixel joined to it (corners count, so a diagonal line holds together). Painting over a pixel swaps its colour and puts the old paint back; rubbing one out puts it back too, along with anything that was only joined through it.
- **Shape.** On screen the easel picture is turned so its diagonal, from the handle to the top-right corner, points where Dora aims (it is turned, never mirrored). Each weapon pixel is two game pixels across, so the longest reach is about 39 game pixels. Wherever there is a pixel, the swing hits.
- **The tip hits hardest.** A pixel's damage is multiplied by 0.6 plus its distance from the paw in cells over 12: about 0.66 by the paw and about 2 at the far corner.
- **Weight.** A swing takes 0.2 seconds plus 0.005 a pixel; Dora walks at 78 pixels a second, minus 0.35% a pixel (at most 45% slower), and at 55% while swinging.
- **Swings** sweep 2.4 radians across the aim (a full turn with Twirl), alternating direction. Each critter can be hit once a swing, by up to 14 of the pixels touching it.

| Paint | From | Each touching pixel |
|---|---|---|
| Stone (grey) | Pebble Beetles | 0.6 damage, and a shove (26 a pixel, up to 170); stops a dash. |
| Gold | Glint Magpies | 1 damage (1.5 with Polish). |
| Frost (blue) | Frost Newts | 0.3 damage and 0.25 seconds of chill (double with Cold snap): chilled critters move at half speed; 2 seconds of chill freezes one solid (no moving, no biting; not the Smudge). |
| Ember (red) | Ember Salamanders | 0.3 damage and 0.5 seconds of burning (double with Hot coals, up to 6): 2 damage a second. |
| Moss (green) | Moss Tortoises | 0.3 damage, and half a fur back (double with Green thumb, up to 4 a swing). |
| Handle (wood) | | 0.5 damage. |

The weapon also blocks ice: an ice ball that touches a weapon pixel stops, and knocks that pixel off (and anything only joined through it) onto the floor as a loose pixel to pick back up.

## Fur

Dora has 30 fur (40 with Thick fur). Bumps knock it off: 4 for a Pebble Beetle or Glint Magpie, 3 for ice (and half speed for 1.2 seconds), 3 for an Ember Salamander plus smouldering (1 more every 0.7 seconds for 2.1 seconds), 5 for the Smudge. After a bump she can't be bumped for 0.8 seconds. A roll (0.26 seconds, every 0.7 seconds, or 0.35 with Quick paws) goes straight through anything. At the easel, **Patch fur** spends one pixel of paint for 2 fur (4 with Fur patch). As she loses fur, up to about half of her sprite's pixels go missing.

## Critters

| Critter | Health | Speed | Does | Bursts into |
|---|---|---|---|---|
| Pebble Beetle | 5 | 26 | Plods straight at Dora. | 3 stone |
| Glint Magpie | 3 | 20 | Circles, sparkles for 0.55 seconds, then swoops at 150 for 0.4 seconds. | 3 gold |
| Frost Newt | 6 | 16 | Keeps 70 to 95 pixels away and spits ice every 2.1 to 2.9 seconds. | 3 blue |
| Ember Salamander | 7 | 34 | Chases; a bump sets Dora's fur smouldering. | 3 red |
| Moss Tortoise | 10 | 15 | Heals every other critter within 55 pixels by 1.2 a second. | 4 green |
| The Smudge | 260 | 22 | Up close, winds up for 0.7 seconds (marked in pink on the floor) and rubs: up to 8 weapon pixels in the patch come off, and Dora takes 5 if she's in it. Every few seconds of walking it calls two Pebble Beetles. Weapon damage to it is 80%; it can be chilled but not frozen. Bursts into four of every paint. | |

Critters get 12% more health for every room into the run. Every critter that bursts leaves its pixels on the floor; they fly to Dora when she's close, and all of them come to her once the room is clear. Bigger pots adds one more pixel to every burst.

## The run

Three places and ten rooms: the **Pebble Mine** (Pebble and Glint), the **Frost Cellar** (adds Frost) and the **Ember Forge** (Pebble, Frost, Ember and Moss), then the Smudge's lair. Each room is two waves (three from the fourth room on), from a budget of crumbles that grows from 5 to 20; the first room of the cellar and of the forge always starts with the new kind. The Smudge's lair is the Smudge, then two more waves. A new wave comes when the last one is gone, out of the doorway and the far corners, with a second's warning.

Before every room is the easel. After the third, sixth and ninth rooms Enzo opens his sketchbook: pick one of three ideas you don't have yet.

| Idea | Effect |
|---|---|
| Thick fur | 10 more fur, and all of it grows back. |
| Bigger pots | Every critter bursts into one more pixel. |
| Polish | Gold cuts half as deep again. |
| Cold snap | Blue chills twice as fast. |
| Hot coals | Red burns twice as long. |
| Green thumb | Green heals twice as much. |
| Feather handle | The weapon weighs half as much. |
| Twirl | Every swing goes all the way round, 30% slower. |
| Quick paws | Roll twice as often. |
| Fur patch | A pixel of paint patches 4 fur. |

The run starts with 12 stone and 6 gold. Sketches (Sword, Dagger, Hammer, Fan) lay a shape out from the handle in the chosen paint first, as far as the paint goes; **Last one** draws the last weapon taken into a fight again.

## Art

All the art is Codex-painted pixel art: a 2×2 sheet of Dora (standing ready with empty paws, two running steps, flinching), one of Enzo (painting, cheering, and portraits of Enzo and Dora), two critter sheets (a pebble-shelled beetle, a golden magpie, a frosty newt and an ember salamander; a mossy tortoise, plus its healing glow), the boss sheet (the Smudge as a giant pink rubber eraser with a grumpy face, an ice ball and an ember ball), three rooms seen from above (the mine, the frosty cellar, the forge), Enzo's workshop, the title and the ending. `scripts/smith-art.py` keys the magenta, crops and shrinks each sprite with a box filter and a small palette, crops the rooms and workshop to 384 by 216 and speckles the plain floors. The weapon is the one thing drawn by the game itself, from the grid. The source paintings are not in the repo.

## Bots and balance

`npm run bot:smith` (with `--quick`, twelve runs, part of `npm test`), forty seeded runs:

| Bot | Plays | Result (06-11-2026) |
|---|---|---|
| Smith | Patches Dora to three quarters while there's enough paint for a weapon, sketches a sword in gold first (then red, blue, green, stone), goes for Moss Tortoises first, stands so the weighted middle of the weapon lands, swings in reach and rolls from ice, dashes and the rub. | 39 of 40 won, 3.2 minutes of fighting a win. Must win at least 30%. |
| Clumsy | Draws like the smith but sees everything a fifth of a second late and misses half its rolls: a stand-in for a person. | 28 of 40 won, 8.8 rooms on average. Must reach at least four rooms on average. |
| Twig | Fights like the smith with a two-pixel stub, spending all the rest on fur. | 0 won, 2.1 rooms. Must do clearly worse than the smith. |
| Random | Random paint, random walking and swinging. | 0 won, 0.1 rooms. Must never win. |

Shape matters: with the smith's fighting, a sword or fan in gold wins nearly every time, a hammer about two thirds, and a long thin weapon rarely, because only its tip lands. Rerun the bots after changing any number in the tables above.

## Ideas not done

- Mirror and symmetry brushes for the easel, and stamping a critter's own shape.
- Paints that mix where they touch (blue next to red makes steam).
- A gallery wall of every weapon that won, and a daily seed.
