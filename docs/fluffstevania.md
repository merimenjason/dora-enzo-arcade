# Fluffstevania: Symphony of the Dust

A Symphony of the Night-style castle explorer starring Dora and Enzo. Route: `/fluffstevania`.

## Files

- `lib/fluffstevania-world.ts`: the map (every room drawn with a small pen of `fill` and `put` calls), gear, food, relics, Pip's shop list and the story lines.
- `lib/fluffstevania-game.ts`: the deterministic engine, with physics, combat, the tag, enemies, both bosses, pickups, shrines, the shop, saves and the menu actions.
- `lib/fluffstevania-scene.ts`: Canvas 2D drawing (see **Graphics** below).
- `app/fluffstevania/page.tsx`: the title screen, game loop, dialogue box, menu, shop, game-over and chapter cards, touch pad and saving. `fluffstevania.css` loads the Cinzel and Cormorant Garamond faces from Google Fonts; the canvas uses them once they arrive and Georgia until then.
- `tests/fluffstevania.mjs` and `tests/e2e/fluffstevania.mjs`.

## The map

Every map cell is one screen of 24×14 tiles of 16 pixels (384×224, drawn at 3×). A room covers a rectangle of cells, and its tiles sit at fixed world coordinates. There are no door objects: the engine looks up whichever room covers a tile, so walking off one room's edge lands in the next. Off the map counts as wall. Side doors are three tiles tall with the floor at row 12 of that screen.

Tiles:

| Tile | Meaning |
| --- | --- |
| `#` | Wall |
| `=` | Ledge. You can jump up through it; ↓ + jump drops through. |
| `^` | Spikes. Standing on them costs 12 before defence and bounces you up. |
| `%` | Cracked wall. Any hit breaks the whole connected section; it's saved as a flag. |
| `G` | Boss gate. Shut only while a fight is on. |
| `D` | Sealed door. It opens for good once its room's `opens` flag is set (`sealed` opens on `boss:owl`; the library door stays shut). |

Markers, which become objects when you enter the room:

| Marker | Object |
| --- | --- |
| `S` | Dust-bath shrine |
| `$` | Pip's stall (↑ on or beside it opens the shop) |
| `i` | Candle |
| `n` | Sign |
| `H` | Wolfberry Leaf |
| `R` | Relic |
| `I` | Item (from the room's `items` list, in reading order) |
| `O` | Boss |
| `b` `m` `k` `x` `a` | Bat, moth, beetle, bone mouse, armadillo |
| `r` `g` `p` | Pantry rat, jar ghost, cellar spider |

Enemies and candles come back every time you enter a room. Items, leaves, relics, broken walls and beaten bosses are remembered as flags.

## Chapter I

Twelve rooms on 22 cells:

- **Moonlit Approach:** `path` (2 screens) and `gate`.
- **Entrance Hall:** `hall` (3×2), with a staircase of ledges up to a broken gallery, and `save-hall`.
- **Hay Cellar:** `shaft` (1×2), `cellar` (3 screens), `relic` (the Dust Dash) and `secret`, which sits behind a cracked wall and holds the Acorn Cudgel and Moonlit Sabre.
- **Owl Belfry:** `stair` (1×2), `save-belfry`, `belfry` (the boss) and `sealed`.

The gallery gap is 9 tiles wide. A running jump covers about 6. A jump and an air dash, or a dash into a jump, covers 10 or more.

Beating the owl ends chapter I (the chapter card) and opens the sealed door.

## Chapter II: the Pantry Catacombs

Nine rooms on 17 cells, all in the `catacombs` area:

- `crypt-stair` (1×3): a shaft down from the sealed door, with ledges every four tiles for the climb back.
- `ossuary` (3 screens): a hole in its floor drops to the larder. A Wolfberry Leaf sits on a ledge seven tiles up.
- `save-crypt`: a shrine and Pip's stall. Its ceiling opens into the chimney, but the first ledge is seven tiles up. One jump rises about 5 tiles and the Cloud Hop adds about 4 more, so only the hop reaches it.
- `larder` (3 screens): ledges climb back up to the ossuary hole. The Rolling Pin sits on a shelf.
- `hop-vault`: the Cloud Hop on a pedestal past a 9-tile spike trench that needs the Dust Dash.
- `jam-vault`: the Wolfberry Blade and a Wolfberry Leaf on a ledge six tiles above the last one.
- `chimney` (1×2): the climb from the shrine to the throne room.
- `throne` (2 screens): Gnawdrick the Rat King.
- `library`: a locked door and the sign where the story pauses for now.

Beating the Rat King ends chapter II.

## Heroes

The leader has the physics body; the partner follows the leader's path 22 pixels behind. They share one level, and each has their own HP and three gear slots. XP to the next level is `round(10 × level^1.7)`.

| | HP | ATK | DEF | LCK | Walk | Growth per level |
| --- | --- | --- | --- | --- | --- | --- |
| Dora | 50 | 6 | 1 | 6 | 140 | +6 HP, +1.6 ATK, +0.7 DEF |
| Enzo | 66 | 7 | 3 | 3 | 124 | +8 HP, +1.8 ATK, +1 DEF |

Weapon styles:

| Style | Reach | Wind-up / active / total (s) | Damage × ATK | Lunge (px/s) |
| --- | --- | --- | --- | --- |
| Rapier (Dora) | 40 | 0.05 / 0.1 / 0.28 | 1 | 60 |
| Claws (Enzo) | 28 | 0.03 / 0.1 / 0.22 | 0.75 | 190 |
| Club (Enzo) | 30 | 0.12 / 0.1 / 0.42 | 1.3 | 100 |

Reach is measured from 4 pixels in front of the hero's middle, and gear can add to it (Moonlit Sabre +6, Wolfberry Blade +10, Iron Claws +4, Rolling Pin +4).

- **Lunge:** a ground attack carries the hero forward at the lunge speed through the wind-up and live frames. It stops when it connects with something, including a shield, and it never carries anyone off a ledge. A connecting lunge gives 0.15 s of safety so it doesn't run into the foe's body. Enzo's claws cover about 20 pixels this way.
- **In the air:** an attack keeps your momentum.
- **Damage:** `ATK × multiplier − foe DEF`, at least 1. Luck is the percentage chance of a 1.5× critical, and it also raises drop rates.
- **Hitstop:** a melee hit on a foe freezes the world for 0.05 s (0.08 s on a critical); a hit on a boss freezes it for 0.04 s. Tag tumbles and seeds don't.

Older saves are updated when they load: the Ribbon Whip becomes the Dust Rapier and the Bramble Whip becomes the Moonlit Sabre.

Movement:

- Gravity 1400, jump 470 (a held jump rises about 79 pixels), cut to 150 on release.
- Coyote time 0.08 s, jump buffer 0.1 s.
- Dust Dash: 340 px/s for 0.24 s, with gravity off during it and one per airtime. A jump out of a dash carries 290 px/s through the air.
- Cloud Hop: one more jump in mid-air at 420 px/s, reset on landing.

**Tag:** 0.44 s long, with a 1 s cooldown.

- For the first 0.2 s the incoming hero arcs from the follower's spot to the leader's. After that they roll forward at 260 px/s.
- Anything within the 32×28 box around them takes `1.6 × ATK + 4`, which ignores shields.
- You're invincible throughout and for 0.3 s after.
- At 0 HP the partner is tagged in automatically. A worn-out hero can't be tagged back in until a shrine or food heals them. Both worn out ends the run: continue from the last shrine save.

**Hurt:** knockback, 0.3 s without control and 1 s of invincibility.

## Foes

| Foe | HP | ATK | DEF | XP | Notes |
| --- | --- | --- | --- | --- | --- |
| Cave Bat | 10 | 7 | 0 | 3 | Hangs until you come within 120 px, then chases. |
| Dust Moth | 14 | 8 | 0 | 4 | Drifts toward you inside 200 px. |
| Shell Beetle | 24 | 9 | 3 | 6 | Walks and turns at walls and ledges. |
| Bone Mouse | 22 | 9 | 1 | 8 | Lobs a bone (9) every 2.2 s within 190 px. |
| Armadillo Guard | 46 | 12 | 4 | 15 | Shield blocks hits from the side it faces. Within 90 px it winds up for 0.4 s, lunges at 220 px/s, then rests for 0.8 s with its guard down. |
| Pantry Rat | 30 | 13 | 2 | 14 | Scurries about. Within 150 px it bristles for 0.35 s, charges at 230 px/s for up to 0.55 s (stopping at walls and ledges), then rests for 0.6 s. |
| Jar Ghost | 34 | 14 | 0 | 18 | Drifts after you inside 220 px. It is solid for 2.4 s, then faded for 1.4 s, when it can neither hurt nor be hurt. |
| Cellar Spider | 26 | 12 | 1 | 13 | Hangs on a thread and drops at 280 px/s when you pass within 26 px underneath, then climbs back up. A hit sends it back up. |

Candles drop:

- seeds (50%, sometimes 5 at once);
- raisins (35%, sometimes 5);
- a wolfberry (8%).

**Duke Hootsworth:** 260 HP, DEF 3, contact 12, 120 XP.

- He hovers on alternating sides, then picks one of these without repeating it three times:
  - **Feathers:** 3 aimed feathers (9 each), 5 in phase two.
  - **Swoop:** a dip across the room that you jump over.
  - **Dive** (phase two only): he tracks you, drops and sends two floor shockwaves (11 each) that you jump over.
- At half HP he speeds up by 1.3× and summons two bats.
- He drops a Wolfberry Leaf.

**Gnawdrick the Rat King:** 560 HP, DEF 6, contact 18, 320 XP. He fights on the floor of a two-screen room and picks one of these without repeating it three times:

- **Charge:** he winds up for 0.6 s, then runs at 300 px/s until he hits a wall. The crash stuns him for 1.3 s (he takes 1.25× damage while dizzy) and drops 4 rocks from the ceiling (6 in phase two).
- **Leap:** a crouch, then a jump to where you stand, landing with two floor shockwaves (13 each).
- **Cheese:** he bowls a wheel of cheese (12) that rolls along the floor and bounces back off the walls. In phase two a second wheel bounces along in arcs.
- At half HP he speeds up by 1.25× and calls two pantry rats.
- He drops a Wolfberry Leaf.

## Pip's shop

Stand at the stall and press ↑. The world waits while it is open. Escape or Leave closes it.

| Item | Raisins |
| --- | --- |
| Wolfberry (heals 20) | 8 |
| Hay Cake (heals 40) | 24 |
| Timothy Tea (heals 80) | 45 |
| Ten sunflower seeds (up to 99) | 12 |
| Thimble Helm (armour, DEF +8) | 90 |
| Raisin Ring (accessory, DEF +2, LCK +6) | 130 |
| Iron Claws (Enzo, ATK +10, reach +4) | 160 |

## Graphics

Everything is Canvas 2D in the 384×224 view, scaled up by the page.

- **Parallax:** each area has three layers (far, middle, near), painted once into 768×320 canvases that wrap around. They scroll at 3–12%, 12–35% and 35–60% of the camera's speed. Tall rooms pan them vertically as the camera descends.
- **Layers by area:**
  - Approach: a moon, clouds, ridges, the castle, dead trees, gravestones and a fence.
  - Hall: a colonnade, stained-glass windows with coloured light shafts and banners, columns and chandeliers.
  - Cellar: barrel vaults, barrel and hay stacks, beams and hanging herbs.
  - Belfry: the sky through great arches, clock gears, ropes, and the bell in the boss room.
  - Catacombs: burial niches, shelves of glowing jars, pillars, cobwebs and coffins. The throne room has the cheese throne.
- **Tiles:** a room's stonework is painted once, at the screen's resolution, into a cache. The cache is redrawn when a wall breaks, a gate shuts or a door opens.
  - Blocks are bevelled, with cracks, moss, carved skulls in the catacombs, grass caps outside, stalactites and roots underneath, and soft shadows where air meets stone.
  - Ledges are wood with iron brackets, or stone with corbels.
  - Chains, cobwebs, bones and hay are scattered deterministically.
- **Lighting:** a darkness layer in each area's colour is cut away around lights, then a warm glow is added on top. Lights come from candles, shrines, Pip's lantern, both heroes, treasures, jar ghosts, bursts and the boss.
- **Combat effects:** sparks, slash streaks and damage numbers are drawn above the darkness. Numbers pop in large and criticals are bigger and gold. Defeated foes crumble into drifting ash in their own colours.
- **Afterimages:** a hero who is dashing, lunging or tumbling in a tag leaves tinted copies behind: violet for Dora, blue for Enzo.
- **HUD:** gold double-bordered panels with corner diamonds, an ornate ring around the leader's portrait, a gold-framed HP bar, the partner's tag ring, the minimap, and a boss bar with skulls. Area names appear as a banner with flourishes.

## Saves

`localStorage` key `fluffstevania-v1` holds the `Save` object. It's written only at shrines and loaded with `parseSave`, which rejects unknown rooms, drops unknown items and clamps HP to the maximum. A new game doesn't touch the save until its first shrine. Sound on or off is kept under `fluffstevania-v1-sound`.

## Adding a chapter

1. Add rooms to `ROOMS` on free cells. For a new area, extend `AreaId`, `AREAS`, `THEMES` and `layersFor` in the scene.
2. Add relics to `RelicId` and `RELICS`, then gate the new rooms with geometry the relic crosses.
3. Extend the reachability model in `tests/fluffstevania.mjs` with the relic's reach, and assert what each relic unlocks.
4. Add the boss to `BossId`, `BOSSES`, a step function beside `owlStep` and `ratStep`, and a drawing. `bossDown` plays `<boss>Down` and shows the chapter card, and the page's `CHAPTERS` holds each card's text. Give the next sealed door's room an `opens` flag.
