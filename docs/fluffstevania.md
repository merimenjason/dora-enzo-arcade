# Fluffstevania: Symphony of the Dust

A Symphony of the Night-style castle explorer starring Dora and Enzo. Route: `/fluffstevania`.

## Files

- `lib/fluffstevania-world.ts`: the map (every room drawn with a small pen of `fill` and `put` calls), gear, food, relics and the story lines.
- `lib/fluffstevania-game.ts`: the deterministic engine, with physics, combat, the tag, enemies, the owl, pickups, shrines, saves and the menu actions.
- `lib/fluffstevania-scene.ts`: Canvas 2D drawing. It covers the cached backdrops for each area, tiles, candles and shrines, enemies, the owl, both heroes (the shared `drawChinchilla` from `lib/chinchilla-art.ts`), weapon swings, effects, the HUD, the minimap and the full map.
- `app/fluffstevania/page.tsx`: the title screen, game loop, dialogue box, menu, game-over and chapter cards, touch pad and saving.
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
| `D` | Sealed door. |

Markers, which become objects when you enter the room:

| Marker | Object |
| --- | --- |
| `S` | Dust-bath shrine |
| `i` | Candle |
| `n` | Sign |
| `H` | Wolfberry Leaf |
| `R` | Relic |
| `I` | Item (from the room's `items` list, in reading order) |
| `O` | Boss |
| `b` `m` `k` `x` `a` | Bat, moth, beetle, bone mouse, armadillo |

Enemies and candles come back every time you enter a room. Items, leaves, relics, broken walls and beaten bosses are remembered as flags.

## Chapter I

Twelve rooms on 22 cells:

- **Moonlit Approach:** `path` (2 screens) and `gate`.
- **Entrance Hall:** `hall` (3×2), with a staircase of ledges up to a broken gallery, and `save-hall`.
- **Hay Cellar:** `shaft` (1×2), `cellar` (3 screens), `relic` (the Dust Dash) and `secret`, which sits behind a cracked wall and holds the Acorn Cudgel and Bramble Whip.
- **Owl Belfry:** `stair` (1×2), `save-belfry`, `belfry` (the boss) and `sealed`.

The gallery gap is 9 tiles wide. A running jump covers about 6. A jump and an air dash, or a dash into a jump, covers 10 or more.

## Heroes

The leader has the physics body; the partner follows the leader's path 22 pixels behind. They share one level, and each has their own HP and three gear slots. XP to the next level is `round(10 × level^1.7)`.

| | HP | ATK | DEF | LCK | Walk | Growth per level |
| --- | --- | --- | --- | --- | --- | --- |
| Dora | 50 | 6 | 1 | 6 | 140 | +6 HP, +1.6 ATK, +0.7 DEF |
| Enzo | 66 | 7 | 3 | 3 | 124 | +8 HP, +1.8 ATK, +1 DEF |

Weapon styles:

| Style | Reach | Wind-up / active / total (s) | Damage × ATK |
| --- | --- | --- | --- |
| Whip | 42 | 0.09 / 0.12 / 0.36 | 1 |
| Claws | 20 | 0.03 / 0.08 / 0.2 | 0.75 |
| Club | 28 | 0.12 / 0.1 / 0.42 | 1.3 |

A ground attack roots you in place; an air attack keeps your momentum. Damage is `ATK × multiplier − foe DEF`, at least 1. Luck is the percentage chance of a 1.5× critical, and it also raises drop rates.

Movement:

- Gravity 1400, jump 470 (a held jump rises about 79 pixels), cut to 150 on release.
- Coyote time 0.08 s, jump buffer 0.1 s.
- Dust Dash: 340 px/s for 0.24 s, with gravity off during it and one per airtime. A jump out of a dash carries 290 px/s through the air.

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

## Saves

`localStorage` key `fluffstevania-v1` holds the `Save` object. It's written only at shrines and loaded with `parseSave`, which rejects unknown rooms, drops unknown items and clamps HP to the maximum. A new game doesn't touch the save until its first shrine. Sound on or off is kept under `fluffstevania-v1-sound`.

## Adding a chapter

1. Add rooms to `ROOMS` on free cells, and extend `AreaId`, `AREAS` and `THEMES` in the scene.
2. Add relics to `RelicId` and `RELICS`, then gate the new rooms with geometry the relic crosses.
3. Extend the reachability model in `tests/fluffstevania.mjs` with the relic's reach, and assert what each relic unlocks.
4. Move the chapter end in `touchStep`, which is currently the `sealed` room's sign.
