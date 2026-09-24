# Fluffstevania: Symphony of the Dust

A Symphony of the Night-style castle explorer starring Dora and Enzo. Route: `/fluffstevania`.

## Files

- `lib/fluffstevania-world.ts`: the map (every room drawn with a small pen of `fill` and `put` calls), gear, food, relics, Pip's shop list and the story lines.
- `lib/fluffstevania-game.ts`: the deterministic engine, with physics, combat, the tag, enemies, the four bosses, pickups, shrines, the shop, saves and the menu actions.
- `lib/fluffstevania-scene.ts`: Canvas 2D drawing (see **Graphics** below).
- `lib/fluffstevania-music.ts`: the synthesised music (see **Music** below).
- `app/fluffstevania/page.tsx`: the title screen, game loop, dialogue box, menu, shop, game-over and chapter cards, touch pad and saving. `fluffstevania.css` loads the Cinzel and Cormorant Garamond faces from Google Fonts; the canvas uses them once they arrive and Georgia until then.
- `tests/fluffstevania.mjs` and `tests/e2e/fluffstevania.mjs`.

## The map

Every map cell is one screen of 24×14 tiles of 16 pixels (384×224, drawn at 3×). A room covers a rectangle of cells, and its tiles sit at fixed world coordinates. The Clock Tower climbs above the rest of the castle, so its upper rooms sit on negative map rows. There are no door objects: the engine looks up whichever room covers a tile, so walking off one room's edge lands in the next. Off the map counts as wall. Side doors are three tiles tall with the floor at row 12 of that screen.

Tiles:

| Tile | Meaning |
| --- | --- |
| `#` | Wall |
| `=` | Ledge. You can jump up through it; ↓ + jump drops through. |
| `^` | Spikes. Standing on them costs 12 before defence and bounces you up. |
| `%` | Cracked wall. Any hit breaks the whole connected section; it's saved as a flag. |
| `G` | Boss gate. Shut only while a fight is on. |
| `D` | Sealed door. It opens for good once its room's `opens` flag is set (`sealed` opens on `boss:owl`, `library` on `boss:rat`, the archive's hidden door on `puzzle:archive` and the balcony's on `boss:fox`). The hatch in `clock-top` has no flag and stays shut. |

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
| `U` | The room's sub-weapon (`sub`) |
| `T` | A spell scroll: reading it teaches the room's `spell` |
| `W` | Nutmeg's pocket watch (sets the `watch` flag) |
| `X` | The Golden Wolfberry (sets the `wolfberry` flag) |
| `O` | Boss |
| `b` `m` `k` `x` `a` | Bat, moth, beetle, bone mouse, armadillo |
| `r` `g` `p` | Pantry rat, jar ghost, cellar spider |
| `v` `q` `j` | Flying tome, ink quill, ink blot |
| `c` `u` `t` | Clockwork mouse, cuckoo, spring toad |
| `o` `w` | Gargoyle, storm crow |
| `P` `Z` `Y` `C` | Familiars waiting to be befriended: Pudding, Zippy's cage, Mochi, Nutmeg |

Enemies and candles come back every time you enter a room. Items, leaves, relics, broken walls and beaten bosses are remembered as flags.

## Chapter I

Twelve rooms on 22 cells:

- **Moonlit Approach:** `path` (2 screens) and `gate`.
- **Entrance Hall:** `hall` (3×2), with a staircase of ledges up to a broken gallery, and `save-hall`.
- **Hay Cellar:** `shaft` (1×2), `cellar` (3 screens), `relic` (the Dust Dash) and `secret`, which sits behind a cracked wall and holds the Acorn Cudgel and Moonlit Fan. The cellar also has the Seed Spread on a shelf and Pudding the guinea pig.
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
- `jam-vault`: the Wolfberry Fan and a Wolfberry Leaf on a ledge six tiles above the last one.
- `chimney` (1×2): the climb from the shrine to the throne room.
- `throne` (2 screens): Gnawdrick the Rat King.
- `library`: the library door, which opens once the Rat King is beaten (`opens: 'boss:rat'`). The room itself belongs to the `library` area.

Beating the Rat King ends chapter II.

## Chapter III: Count Culpeo's Library

Ten rooms beyond the library door on 17 cells, all in the `library` area. It has bookcases, moonlit windows, reading lamps and busts in the scenery, red wood-panelled stone, and its own waltz.

- `reading` (3 screens): the reading room. A hole in the floor drops into the stacks. A reading nook high on the right holds a Wolfberry Leaf behind an iron grate, so only Dust Form gets in.
- `stacks` (1×2): a shaft of shelves down to the Dust Form vault (lower left) and the archive (lower right). Ledges every four tiles lead back up, and the last jump out through the hole needs the Cloud Hop.
- `dust-vault`: Dust Form on a pedestal.
- `archive` (2 screens): the shelf puzzle. The sign says the Count reads the book bound in the colour of his eyes, which is red, so shelf II. Striking it sets `puzzle:archive` and opens the door to the reliquary. Striking I or III sends a Flying Tome off the shelf at you.
- `reliquary`: the Heavy Tome (Enzo's club: ATK 24, reach +6) and a Wolfberry Leaf.
- `save-library`: a shrine.
- `scriptorium` (2 screens): a flask of Timothy Tea on a high ledge. At the far end an iron grate bars the way to the tower.
- `tower` (1×2): the climb down to the Count's study, with ledges every four tiles.
- `study` (2 screens): Count Culpeo, below his own portrait and beside a fireplace.
- `balcony`: a shrine, and a locked door to the Clock Tower, where the story pauses for now.

Beating Count Culpeo ends chapter III.

### Iron grates and Dust Form

`|` is an iron grate. It is solid to everything, except that a hero with **Dust Form** moves through it (`move(…, dust)`). While the lead's box overlaps a grate (`sifting`), both heroes crumble into swirling clouds of sandy bath dust (pale for Dora, grey-tinged for Enzo) with grains sifting down, dust puffs trail behind, and a `dustform` sound plays. Mist Form was renamed Dust Form to suit the chinchillas: older saves swap the `mist` relic for `dustform` and the `mist-vault` room for `dust-vault` as they load (`RENAMED_RELICS`, `RENAMED_ROOMS`).

### Shelf puzzles

Markers `1`, `2` and `3` are puzzle bookcases (`Shelf`). A room with `puzzle: n` and `opens: 'flag'` opens its sealed doors when shelf `n` is struck by a swing or a tag tumble, and the right book is then drawn pulled out. A wrong shelf spawns an awake Flying Tome and can't be struck again for 0.8 s.

## Chapter IV: the Clock Tower

Ten rooms on 20 cells, all in the `clock` area, beyond the balcony door (`opens: 'boss:fox'`). Brass-and-stone walls with round windows onto the night sky high above the castle, gears turning behind the stonework, and a ticking music-box theme.

- `gear-hall` (2 screens): clockwork mice, a spring toad and a cuckoo.
- `clock-shaft` (1×4): the tower's great shaft. Ledges every four tiles climb from the gear hall to a landing with a door to the claw vault. Above the landing the shaft rises sheer for thirteen tiles, so only the Wall Cling climbs on to the ledges above and the top landing (a ledge you can jump up through), out to the clockworks. A door at the bottom right leads to the cuckoo gallery.
- `claw-vault`: the **Wall Cling** on a pedestal.
- `cuckoo-gallery` (1×2): a walkway with a drop to the floor below, and a wall of clock cases down the middle. The pocket watch and a Wolfberry Leaf sit on a shelf 22 tiles above the lower floor, so only claws that cling reach them.
- `clockworks` (2 screens): the **Clockwork Cog** on a high shelf, a flask of Timothy Tea, and Nutmeg.
- `save-clock`: a shrine and Pip's second stall.
- `pendulum-hall` (2 screens): two spike pits, a great pendulum swinging behind the room, Enzo's **Boulder Roll** scroll, and the **Clockwork Cuirass** (armour, DEF +12) on top of a clock case.
- `winding-stair` (1×3): ledges every four tiles up to the clock face, and Dora's **Petal Ward** scroll in a niche.
- `clockface` (2 screens): Tick-Tock the Clockwork Cat, behind the moonlit back of the great clock face.
- `clock-top`: a shrine and the hatch to the roof, bolted from above for now.

Beating Tick-Tock ends chapter IV and opens the `clock-top` door to the roof stair (`opens: 'boss:cat'`).

## Chapter V: the Moonlit Roof

Seven rooms on 14 cells, all in the `roof` area: out on the castle's rooftops in a storm under a full moon, with rain, lightning, a stormy theme and its own scenery. The slates, the summit and the garden are open to the sky; above the rooms counts as solid, so nobody flies off the top. The map's side-edge test lets the roof, like the approach, be open above its doorways.

- `roof-stair` (1×2): ledges up from the clock tower to the slates.
- `slates` (3 screens): the rooftop, with chimneys to hop between, gargoyles on their perches and storm crows overhead. The great chimney in the middle rises ten tiles, so only the Wall Cling gets to its top, and from there up through a hole into the roost.
- `roost` (2 screens): the gargoyle roost above the slates, with the **Celestial Fan** (Dora: ATK +22, reach +12), the **Gargoyle Maul** (Enzo's club: ATK +32, reach +8) and a Wolfberry Leaf.
- `save-roof`: a shrine and Pip's last stall.
- `spire` (1×3): ledges and twelve sheer tiles of wall to climb up to the summit.
- `summit` (2 screens): Count Culpeo, the Night Fox.
- `garden`: a shrine and the Golden Wolfberry on its terrace.

Beating the Night Fox ends chapter V. Picking the Golden Wolfberry heals both heroes, saves at once, puts the **Golden Wolfberry** accessory (ATK +5, DEF +5, LCK +10) in the bag and plays the `ending` lines; when they finish the game's `state` becomes `'ending'` and the page shows the credits (level, time, how much was explored, foes bested, friends made and difficulty) with its own gentle theme. Keep exploring (`resume`) goes back to playing. The title screen marks a save with the berry found.

### The Wall Cling

With the relic, a hero in mid-air who holds toward a wall (not spikes or a grate) while falling, or rising slower than 60 px/s, clings to it (`clinging`, `body.cling`). The slide down is capped at 70 px/s (`CLING_FALL`), dust scrapes off the claws, and landing on a ledge or floor ends it. Jump while clinging, or within 0.1 s of letting go, kicks off: 440 px/s up (`WALL_JUMP_V`) and 170 px/s away for 0.16 s (`WALL_KICK_V`, `KICK_T`), after which you steer again. A kick gives back the air dash and the Cloud Hop, and steering back to the same wall and kicking again climbs about four tiles a kick.

The reachability model counts any open spot beside a wall as one a hero can cling to, and treats a kick from it like a jump.

## Heroes

The leader has the physics body; the partner follows the leader's path 22 pixels behind. They share one level, and each has their own HP and three gear slots. XP to the next level is `round(10 × level^1.7)`.

| | HP | ATK | DEF | LCK | Walk | Growth per level |
| --- | --- | --- | --- | --- | --- | --- |
| Dora | 50 | 6 | 1 | 6 | 140 | +6 HP, +1.6 ATK, +0.7 DEF |
| Enzo | 66 | 7 | 3 | 3 | 124 | +8 HP, +1.8 ATK, +1 DEF |

Weapon styles:

| Style | Reach | Wind-up / active / total (s) | Damage × ATK | Lunge (px/s) |
| --- | --- | --- | --- | --- |
| Fan (Dora) | 34 (24 tall) | 0.05 / 0.1 / 0.3 | 1 | 40 |
| Claws (Enzo) | 28 | 0.03 / 0.1 / 0.22 | 0.75 | 190 |
| Club (Enzo) | 30 | 0.12 / 0.1 / 0.42 | 1.3 | 100 |

Reach is measured from 4 pixels in front of the hero's middle, and gear can add to it (Moonlit Fan +6, Wolfberry Fan +10, Iron Claws +4, Rolling Pin +4).

- **Lunge:** a ground attack carries the hero forward at the lunge speed through the wind-up and live frames. It stops when it connects with something, including a shield, and it never carries anyone off a ledge. A connecting lunge gives 0.15 s of safety so it doesn't run into the foe's body. Enzo's claws cover about 20 pixels this way.
- **In the air:** an attack keeps your momentum.
- **Damage:** `ATK × multiplier − foe DEF`, at least 1. Luck is the percentage chance of a 1.5× critical, and it also raises drop rates.
- **Hitstop:** a melee hit on a foe freezes the world for 0.05 s (0.08 s on a critical); a hit on a boss freezes it for 0.04 s. Tag tumbles and seeds don't.

Older saves are updated when they load. The Ribbon Whip and Dust Rapier become the Dust Fan, the Bramble Whip and Moonlit Sabre become the Moonlit Fan, and the Wolfberry Blade becomes the Wolfberry Fan. Saves without the newer fields start on Normal with full Dust, the seed as their only sub-weapon and no familiars.

### Combos, the fan and the Duo Strike

- **Combo:** pressing attack in a swing's recovery, or within 0.22 s of it ending, chains the next hit. The third hit is a finisher that does 1.5× damage. With the fan it blows a big gust that goes through foes; with claws it uppercuts foes 330 px/s into the air; with a club it sends two short shockwaves along the floor (170 px/s for 0.45 s, `0.8 × ATK`), throwing up stone shards.
- **Gusts:** every fan sweep blows a gust ahead at the start of its live frames: 260 px/s for 0.35 s, half ATK. Shields stop gusts as they stop swings.
- **Spin:** Dora holds attack after a swing for 0.55 s and lets go. She whirls for 0.5 s, hitting 38 px either side twice, at 2× ATK.
- **Duo meter:** fills from damaging hits: melee +7, tag tumbles +10, boss melee +5, boss tags +8, shots +3 (+2 on a boss). It's full at 100.
- **Duo Strike:** press tag and attack together, or V, Q or LT. It lasts 1 s, during which the world holds still and the heroes are invincible. At 0.55 s every foe, boss and candle in view takes `(Dora's ATK + Enzo's ATK) × 1.2 + 10`, and the frame freezes for 0.12 s.

### Dust, spells and sub-weapons

**Dust** is `30 + 2 per level`. It refills 1 every 1.2 s, and by 8 from the dust orbs candles sometimes drop. Every defeated foe also gives off two Dust motes that burst out, then home in on the lead after 0.3 s (or are caught automatically after 2.5 s). Each is worth 1 Dust, or 2 from foes with 30 HP or more.

Spells are cast with the motion plus attack (numpad directions relative to facing, all within 0.5 s) or with F, RT or the pad's SPELL.

| Spell | Hero | Learnt at | Motion | Dust | Effect |
| --- | --- | --- | --- | --- | --- |
| Whirlwind | Dora | Level 3 | ↓ ↘ → | 12 | A tornado drifting forward at 120 px/s for 1.6 s, hitting each foe every 0.25 s for `0.7 × ATK + 3`. |
| Burrow Quake | Enzo | Level 4 | → ↓ ↘ | 15 | Two quakes at 210 px/s for 0.9 s, `1.4 × ATK + 6` each, throwing foes up. |
| Petal Ward | Dora | Scroll in the winding stair | → ↘ ↓ | 14 | Six petals orbit Dora for 4 s (`PETAL_T`), each hitting foes for `0.5 × ATK + 4` every 0.3 s and knocking away any enemy shot they touch except shockwaves, flames and chimes. |
| Boulder Roll | Enzo | Scroll in the pendulum hall | → ↘ ↓ | 16 | Enzo rolls forward at 300 px/s for 0.7 s (`ROLL_V`, `ROLL_T`), untouchable, hitting everything in his path for `1.3 × ATK + 8` every 0.25 s and throwing foes up. He bounces back off walls. |

F (or RT, or the pad's SPELL) casts the lead's first spell; with ↓ held it casts their second, once they've read its scroll. Scrolls are remembered as `spell:<id>` flags.

Sub-weapons are thrown with ↑ + attack and cost seeds. You ready one from the Magic tab, and a new one is readied as you find it.

| Sub-weapon | Seeds | Where | Effect |
| --- | --- | --- | --- |
| Sunflower Seed | 1 | from the start | An arc, `6 + 2 × level`; breaks cracked walls |
| Seed Spread | 2 | cellar shelf | Three seeds fanned upward, `5 + 2 × level` each |
| Boomerang Acorn | 2 | high on the belfry stair (Cloud Hop) | Out at 300 px/s, pulled back at 520 px/s², goes through foes, `8 + 2.2 × level` (again on the way back) |
| Pumpkin Flask | 3 | larder shelf | Bursts on a wall, floor or foe into five flames on the floor below for 1.4 s, `6 + 1.6 × level` every 0.4 s |
| Clockwork Cog | 3 | high shelf in the clockworks | Drops to the floor, then rolls along it at 230 px/s for up to 2.6 s, through foes (`10 + 2.4 × level`, again every 0.3 s), bouncing back off walls |

### Familiars

A familiar joins through a small quest. The first to join comes along at once, and after that you choose from the Familiars tab. Only the one travelling with you gains XP: as much as the heroes do, needing `round(15 × level^1.5)` per level, up to level 10.

| Familiar | Quest | What they do |
| --- | --- | --- |
| Pudding (guinea pig), `P` in the cellar | Talk to her with a Hay Cake in the bag. | When the lead is below 40% HP, heals `6 + 3 × level`, then waits `max(5, 12 − 0.6 × level)` s. |
| Zippy (sugar glider), `Z` cage on the belfry stair | Three hits break the cage. | Rides on the lead's shoulder. Glides at the nearest foe within 150 px at 250 px/s for `3 + 2 × level`, every `max(0.6, 1.5 − 0.08 × level)` s. |
| Mochi (capybara), `Y` by the catacomb shrine | Talk to her after beating the Rat King. | Knocks away one enemy shot within 40 px of the lead (not shockwaves), then waits `max(2, 7 − 0.45 × level)` s. Also gives away cracked walls. |
| Nutmeg (chipmunk), `C` in the clockworks | Find her pocket watch (`W`, high in the cuckoo gallery) and talk to her. | Fetches loose raisins, seeds, Dust and food within `60 + 8 × level` px to the lead. When a foe falls there's a `15 + 3 × level` % chance she digs up 3 more raisins. |

### Rests, respawns and warps

- **Respawns:** a defeated foe from a map marker stays down until you rest at a shrine or enter a different area. Foes a boss summons don't count.
- **Warps:** a shrine is remembered once you touch it. With two or more, ↑ at a shrine opens the list and you step out of any other.
- **Bosses:** a boss is saved the moment it falls. If its Wolfberry Leaf wasn't picked up, it waits in the room.
- **Secrets:** with the Silver Bell worn by either hero, or Mochi along, the first cracked wall within 5 tiles of the lead in each room sparkles and chimes.
- **Bestiary:** counts every kind of foe and each boss you defeat. It shows a silhouette until the first one falls, then the name, stats, weakness and a line of lore from `LORE`.

### Difficulty

Each new game picks a difficulty, and it's kept in the save.

| | Foe HP | Foe damage | Doorways | Bosses |
| --- | --- | --- | --- | --- |
| Easy | 0.7× | 0.6× | Heal 15% of max HP on every room change | As Normal |
| Normal | 1× | 1× | — | Phase two at half HP |
| Hard | 1.5× | 1.5× | — | Phase-two moves from the start (the owl's dive and 2 more feathers; the Rat King's extra rocks and bouncing wheel), 1.1× faster |

### Music

Each area has its own loop, and so do bosses (the Night Fox has a grander one of his own) and the ending.

`lib/fluffstevania-music.ts` synthesises a two-bar loop for each area and one for bosses: a lead, a bass line on the eighths and a chord pad in harmonic minor, scheduled ahead with Web Audio. The page switches themes as you change area or a boss appears. Its on/off setting is kept under `fluffstevania-v1-music`.

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
| Flying Tome | 38 | 16 | 2 | 22 | Rests shut until you come within 140 px, then flaps after you. After 1.6 s, within 110 px, it gathers for 0.3 s and snaps forward at 200 px/s for 0.35 s. |
| Ink Quill | 30 | 14 | 1 | 20 | Hovers about its post and every 2.4 s, within 230 px, flicks a blot of ink (12) at you at 170 px/s. |
| Ink Blot | 50 | 17 | 4 | 26 | Oozes along at 28 px/s. Within 80 px it gathers for 0.35 s and springs at you (140 px/s across, 340 px/s up), then rests for 0.7 s. |
| Clockwork Mouse | 44 | 18 | 5 | 28 | Trundles at 30 px/s. Within 160 px its key spins for 0.5 s, then it zooms at 260 px/s for 0.8 s, bouncing back off walls and ledges, then rests for 0.9 s. |
| Cuckoo | 40 | 16 | 3 | 26 | Shut in its clock, where it can't hurt or be hurt (`foeHidden`). Within 200 px it pops out every 2.6 s for 1.3 s and spits a note (14) at you at 150 px/s. |
| Gargoyle | 72 | 24 | 8 | 42 | Stone on its perch, where it can't hurt or be hurt (`foeHidden`). Within 110 px it wakes, stalks you through the air at 80 px/s, and after 1.2 s within 120 px gathers for 0.3 s and dives at 240 px/s for 0.5 s. After 3.5 s awake, or a dive, it flies home at 100 px/s and turns back to stone. |
| Storm Crow | 46 | 21 | 3 | 36 | Waits on the wind until you come within 220 px, then circles 80 px above you. Every 2.2 s within 200 px it gathers for 0.25 s, swoops at you at 260 px/s for 0.6 s, and climbs back. |
| Spring Toad | 60 | 20 | 5 | 32 | Sits on its spring. Every 1.3 s within 220 px it leaps at you (420 px/s up and 130 across; 520 up and 90 across within 90 px), then rests where it lands. |

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

**Count Culpeo:** 980 HP, DEF 8, contact 24, 600 XP. He floats just off the floor about 90 px from the lead and picks one of these without repeating it three times:

- **Fireballs:** 3 fireballs (18 each) fanned at you at 185 px/s. In phase two it's 5, twice.
- **Vanish:** he bursts into bats. After 0.2 s he can't be hit. He reappears 60 px behind the lead, then sweeps his cape along the floor at 330 px/s.
- **Swoop:** he rises to one side and dips across the room to the other.
- **Fire pillars** (phase two only): the floor glows under the lead and 64 px either side, then fire roars up there for 1.1 s (16).
- At half HP he speeds up by 1.25× and calls two bats.
- He can't be hit while arriving, while vanished, in the first 0.15 s of reappearing, or while dying.
- He drops a Wolfberry Leaf. Beaten, he flees as bats to his Clock Tower.

A simple bot beats him at level 9 in about 47 s, taking 8 hits; at level 11 in about 53 s.

**Tick-Tock the Clockwork Cat:** 1,900 HP, DEF 12, contact 28, 900 XP. She prowls the floor toward the lead and picks one of these without repeating it three times:

- **Pounce:** a crouch, then a leap to where you stand, landing with two floor shockwaves (14 each).
- **Cogs:** she bowls an iron cog (14) that rolls along the floor and bounces back off the walls. In phase two a second one bounces along in arcs.
- **Wall dive:** she sprints to the nearer wall, runs up it, clings there for 0.5 s and dives at the lead at 420 px/s. The landing leaves her dizzy for 0.9 s, when she takes 1.25× damage.
- **Chime** (phase two only): she rings the bell on her collar. A low ring (15) rolls out both ways along the floor, to jump over, then a high one to stay down under.
- At half HP she speeds up by 1.25× and lets two clockwork mice loose.
- She drops a Wolfberry Leaf.

**Count Culpeo, the Night Fox:** 2,600 HP, DEF 14, contact 30, 2,000 XP. On the summit the Count fights as in his study, but all-out from the start and 1.1× faster, and adds **lightning**: three spots on the roof glow around the lead, then bolts strike each in turn (20; two stacked hitboxes from the floor up, which Petal Ward and Mochi can't stop). At half HP he stops, bites the Golden Wolfberry and transforms for 2.4 s (he can't be hit), calling two bats. As the **Night Fox** (64 × 40, `NIGHT_BEAST`) he picks one of these without repeating it three times:

- **Soar:** between moves he hovers high on the far side from the lead.
- **Fire breath:** a stream of fireballs (20) from his mouth, sweeping along the roof from under him to the far side.
- **Dive:** a great swoop low across the roof, then he lands to catch his breath for 1.3 s, when he takes 1.25× damage.
- **Falling stars:** seven stars (22) glow on the roof, one where the lead stands, then fall.

On Hard the Night Fox is 1.15× faster. He drops a Wolfberry Leaf.

A simple bot that only fights from the ground beats him at level 20 in about 70 s with the Wolfberry Fan and Heavy Tome, and in about two minutes at levels 16 to 18.

The same simple bot with the starting weapons beats Tick-Tock at level 11 in about 40 s, taking 7 hits, and at level 13 in about 31 s. With the Wolfberry Fan and Heavy Tome it takes 18 to 26 s.

## Pip's shop

Pip keeps a stall by the catacomb shrine, a second by the Clock Tower shrine and a third by the rooftop shrine. Stand at either and press ↑. The world waits while it is open. Escape or Leave closes it.

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
  - Library: bookcases, moonlit windows, reading lamps and busts. The study has the Count's portrait and a fireplace.
  - Moonlit Roof: a stormy sky with a full moon (huge behind the summit and garden) and storm clouds, the mountains and the lit valley far below, and the castle's spires with a chinchilla weathervane. `drawStorm` adds two layers of slanting rain, wind-blown leaves and lightning flashes, brighter when the Count calls a bolt down. Rain puddles catch the moon on the slates.
  - Clock Tower: the night sky over the castle far below, a wall of round brass-framed windows and pipes, and great still gears. On top of those, `drawClockwork` paints live gears turning in meshed pairs, a great pendulum swinging behind the pendulum hall, and in Tick-Tock's room the moonlit clock face with its hands creeping round.
- **Tiles:** a room's stonework is painted once, at the screen's resolution, into a cache. The cache is redrawn when a wall breaks, a gate shuts or a door opens.
  - Blocks are bevelled, with cracks, moss, carved skulls in the catacombs, grass caps outside, stalactites and roots underneath, and soft shadows where air meets stone.
  - Ledges are wood with iron brackets, or stone with corbels.
  - Chains, cobwebs, bones and hay are scattered deterministically.
- **Lighting:** a darkness layer in each area's colour is cut away around lights, then a warm glow is added on top. Lights come from candles, shrines, Pip's lantern, both heroes, treasures, jar ghosts, bursts and the boss.
- **Combat effects:** these are drawn above the darkness.
  - Hit sparks: a white core with gold streaks spraying the way the blow travelled.
  - Slashes: a streak where each swing lands. Enzo's claws leave three claw marks instead, gold on a finisher.
  - Damage numbers: they pop in large and bounce once. Criticals are gold; finishers, spin attacks, tags, spells and the Duo Strike (`Pop.big`) are bigger again, with a gold gradient.
  - Burning away: a defeated foe lingers for `BURN_T` (0.45 s). It flashes white-hot, cools to orange and crumbles from the feet up in cinders, with embers rising, ash in its own colours and an orange light. Its Dust motes fly into the lead with violet tails.
- **Weapons:** each weapon looks different, in the menu, in paw and mid-swing.
  - The Dust Fan is pale pink paper on bamboo ribs painted with cherry blossoms. The Moonlit Fan is midnight silk on silver ribs with a crescent moon, stars and a silver tassel. The Wolfberry Fan is crimson on black lacquer with a scalloped gold edge, clusters of golden berries and a red tassel. Each leaves its own sparkle along the rim of its sweep: petals, stars or embers.
  - Scrappy Claws are Enzo's own paw, raking warm cream streaks. The Iron Claws are a riveted steel gauntlet with three blades, raking cold steel-blue streaks with sparks.
  - The Celestial Fan is pale gold silk stitched with a blue constellation and a gold star, trailing shooting stars. The Gargoyle Maul is a scowling horned stone head with glowing violet eyes on an iron haft, with a violet smear.
  - Clubs leave a heavy smear with speed lines: gold for the Acorn Cudgel, flour-white (with puffs of flour) for the Rolling Pin, and crimson (with loose pages) for the Heavy Tome, which is drawn as a red leather book with gold corners and a clasp.
  - Slash marks where a blow lands take the weapon's colour (`SLASH_TINT`), and claw marks are cream or steel.
  - Out of a swing the weapon is carried (`carryWeapon`): Dora holds her fan folded in her front paw, the Iron Claws sit on Enzo's paw, and his clubs are strapped across his back.
- **Shockwaves:** Enzo's club finisher and Burrow Quake are drawn as an arc of force rolling along the floor. Slabs heave up behind the arc, a glowing crack trails it, stone shards fly (`shard` effects) and the wave lights the room. The finisher's wave is gold; the spell's is bigger and violet, and a rune circle turns on the floor under Enzo as he casts.
- **Heroes:** the lead squashes for 0.14 s on landing and stretches while rising fast. Dashing sheds tufts of fur. Worn armour shows: the Wool Scarf's tails fly out behind, the Moth Cape is a pair of moth wings on the back, and the Thimble Helm sits on the crown. The scarf and cape stream back further at speed.
- **Level up:** a column of light pours down on the lead with motes rising through it and a gold LEVEL UP.
- **Pickups:** everything bobs once it has settled, and dropped things glint now and then. Relics, sub-weapons and Wolfberry Leaves have a halo with two sets of slowly turning rays.
- **Foreground:** each area has a 1152-pixel strip of dark silhouettes that scrolls at 1.35× the camera's speed in front of everything: a tree with ivy and grass outside, a column, chandelier chain and webs in the hall, a beam, a hook and barrels in the cellar, bell ropes and a great cog in the belfry, stalactites, bones and webs in the catacombs, and a great cog, chains and a girder in the Clock Tower.
- **Weather and air:**
  - Rain runs down the hall's stained-glass windows. About every 7.3 s lightning flashes through them twice and the whole room flickers.
  - In the hall and belfry, slanted shafts of light with dust drifting in them.
  - In the cellar and catacombs, water drips from the ceilings and splashes on the floor below.
  - The existing mist drifts along the approach and catacomb floors.
- **Colour grading:** a soft-light wash per area over everything but the HUD: cold blue on the approach, warm candlelight in the hall and cellar, pale blue in the belfry, a sickly green in the catacombs, rose in the library and brass in the Clock Tower.
- **Speakers:** every portrait in the dialog box is drawn from the character's sprite: Dora and Enzo's portraits, the familiars (`drawPal`), and for the bosses, Pip and signs `drawSpeaker`, a close-up of the owl, the Rat King, Count Culpeo and Tick-Tock's heads, Pip as he appears behind his stall, or a wooden signboard. Pip's shop shows the same Pip.
- **The Night Fox:** in his own shape the Count wears a violet storm aura. While he transforms he swells and fades into the winged fox, with violet light crackling round him. The Night Fox has ribbed, torn bat wings, a russet brush tipped with violet flame, a mane of violet fire, red eyes and fangs; his mouth glows while he breathes fire, and his wings fold when he lands. Lightning is a jagged fork from the storm to the roof; falling stars trail gold. The spots where either will strike glow blue-white or gold first.
- **Clock Tower moves:** a clinging hero turns to look out from the wall, with claw scratches and sparks where they scrape. Boulder Roll draws Enzo curled up and tumbling inside a violet ring, with afterimages. Petal Ward's petals glow pink as they circle Dora.
- **Room transitions:** entering a room sweeps a dark curtain with a gold edge off the screen in the direction of travel, over 0.34 s.
- **Boss intro:** as a fight begins, a black band crosses the screen with the boss's title in italics ("Warden of the Belfry", "Tyrant of the Larder") and the name slams in with a shake and a flash.
- **Afterimages:** a hero who is dashing, lunging or tumbling in a tag leaves tinted copies behind: violet for Dora, blue for Enzo.
- **HUD:** gold double-bordered panels with corner diamonds, an ornate ring around the leader's portrait, a gold-framed HP bar, the partner's tag ring and the minimap. Area names appear as a banner with flourishes. The boss bar has notches every tenth, a diamond at half health where the second phase starts, spiked end caps and skulls, and lost health lingers pale for 0.5 s before draining away.
- **Maps:** rooms are coloured by area; the room you're in is brighter. `roomMarks` lists what a room shows, only where its map cell has been visited, and the same `mapIcon` drawings appear on the minimap, the full map and the Map tab's legend:
  - dust-bath shrines, Pip's stall, and guardians, crossed out once beaten;
  - relics, treasure, sub-weapons and Wolfberry Leaves, until taken;
  - familiars, until befriended;
  - sealed doors, until they open;
  - where you are.
  The full map also names each explored area in the middle of its rooms, nudging names apart where they'd overlap. It is drawn at 40 px per screen (`mapLayout`) inside a frame that scrolls sideways, opening scrolled to where the heroes are.

## Saves

`localStorage` key `fluffstevania-v1` holds the `Save` object: position, level, HP, gear, bag, relics, flags, visited cells, raisins, seeds, time, leaves, difficulty, Dust, sub-weapons, familiars and Bestiary kills. It's written at shrines and when a boss falls, and loaded with `parseSave`, which rejects unknown rooms, drops unknown items, renames old weapons and clamps HP and Dust to the maximum. A new game doesn't touch the save until its first shrine. Sound on or off is kept under `fluffstevania-v1-sound`.

## Adding a chapter

1. Add rooms to `ROOMS` on free cells (negative map rows are fine). For a new area, extend `AreaId`, `AREAS`, `THEMES`, `GRADE`, `layersFor` and `foreground` in the scene, and add a song to `SONGS` in the music.
2. Add relics to `RelicId` and `RELICS`, then gate the new rooms with geometry the relic crosses.
3. Extend the reachability model in `tests/fluffstevania.mjs` with the relic's reach, and assert what each relic unlocks.
4. Add the boss to `BossId`, `BOSSES`, `BOSS_KILLS`, `BOSS_CHAPTER`, a step function beside `owlStep`, `ratStep`, `foxStep` and `catStep`, a drawing and a `BOSS_TITLE`. `bossDown` plays `<boss>Down` and shows the chapter card, and the page's `CHAPTERS` holds each card's text; mark the newest card `last`. Give the next sealed door's room an `opens` flag.
