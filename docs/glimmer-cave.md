# Glimmer Cave

Game 38, at `/cave`, is a cosy cave survival dive in the spirit of Deep Rock Galactic: Survivor. Dora or Enzo goes down five layers of a glowing cave and digs through rock while swarms close in. The weapons aim themselves; the player only moves.

- **Design:** [`docs/superpowers/specs/19-10-2026-glimmer-cave-design.md`](superpowers/specs/19-10-2026-glimmer-cave-design.md)
- **Build plan:** [`docs/superpowers/plans/19-10-2026-glimmer-cave-plan.md`](superpowers/plans/19-10-2026-glimmer-cave-plan.md)
- **Art briefs and reviews:** [`docs/cave-survival-art.md`](cave-survival-art.md)

All numbers below come from `lib/glimmer-cave-data.ts`.

## How a dive goes

1. **At camp,** pick a hero and a hazard level from 1 to 5. Hazard 1 is open from the start, and each finished hazard opens the next.
2. **Each layer lasts 5:00.** Critters spawn just off screen. Bonked critters drop crystals, which give experience. Each level-up pauses the game and offers three cards.
3. **When a layer's timer runs out, the drop pod lands** 12–20 tiles away. An arrow at the screen edge points to it, a pulsing ring marks it on the mini-map, and the swarm doubles. Reach the pod within 45 s to bank the layer's gold and descend. If the pod leaves without you, the dive ends.
4. **Layer 5 has no job.** The Rock Wyrm bursts out of the rock at 3:00, and the pod lands only once the wyrm is bonked.
5. **When the dive ends,** you keep the gold already banked. If you were bonked, you also keep half of the gold from the layer you were on. Gold buys camp upgrades.

The run is saved at the start of every layer, so **Continue** picks up at that layer with the build it began with.

## Heroes

| Hero | Starts with | Perks |
| --- | --- | --- |
| **Dora** | Pickaxe Bonk | Digs twice as fast, ×1.15 max Fluff |
| **Enzo** | Acorn Sling | ×1.1 move speed, ×1.15 projectile size, a lamp 30% wider |

**Base stats:** 100 Fluff, 3.2 tiles/s, a 1.5-tile pickup radius, a 5% chance of a ×2 crit, and 0.5 s of grace after each bump.

**The buddy:** the other chinchilla trots behind. It fires its own starting weapon at 50% damage and never takes a bump.

## Digging

- **Dig times:** dirt 0.6 s, gold 1.0 s and crates 1.0 s. Bedrock and lanterns can't be dug.
- **Gold blocks** drop 3–6 gold on layer 1, rising by one at each end per layer (7–10 on layer 5).
- **Diggier** (camp) and **Strong Arms** (card) make digging faster.

## Critters

| Critter | Fluff | Speed (tiles/s) | Bump | Experience | Habit |
| --- | --- | --- | --- | --- | --- |
| **Soot sprite** | 6 | 2.2 | 5 | 1 | Drifts straight at the hero |
| **Pink mite** | 4 | 2.8 | 4 | 1 | Comes in packs of 5–8 and hops in dashes (1.2 s on, 0.25 s rest) |
| **Mossy beetle** | 30 | 1.4 | 10 | 4 | Within 4 tiles, rams 2 tiles every 4 s |

**Mix per layer** (soot/mite/beetle %): 70/30/0, 60/30/10, 45/35/20, 40/35/25, 40/30/30.

**Fluff scaling:** a critter's Fluff is multiplied by `1 + 3 × (layer − 1)` and by `1 + 0.25 × (hazard − 1)`.

**Spawn ramp:**
- The target number alive ramps from 20 to 72 across a layer, multiplied by 1.45 for each layer below the first and by `1 + 0.2 × (hazard − 1)`.
- It doubles during a pod run, and never exceeds 300 alive.
- Every 60 s, a burst of 30 critters arrives from one side.

**Elites:**
- They appear from layer 2, about one a minute.
- Each is 1.6× the size, with ×8 Fluff and ×1.5 bump, a warm glow and a Fluff bar.
- Each drops a cache of 20 crystals.

## Levels and cards

**Experience** to the next level is `round(6 + 2.8 × level + 0.15 × level²)`: 9 at level 1, 24 at level 5, 49 at level 10 and 122 at level 20.

**Cards:** each level-up offers three, drawn evenly from:
- **a new weapon:** up to 4 weapons, and while a slot is free at least one card is a new weapon;
- **a level for a held weapon:** +15% damage, alternating with a rate, size or count step;
- **a passive.**

**Overclocks:** at weapon levels 5 and 10, that weapon's card becomes a choice of its two overclocks.

**Rarity:**
- Each card rolls Common 60, Uncommon 28, Rare 10 or Epic 2 (out of 100). Each hazard above 1 moves 4 points from Common to Uncommon and 1 from Uncommon to Rare.
- Rarity multiplies the card's bonus by ×1, ×1.5, ×2 or ×3.

**Rerolls:** one reroll per layer, plus one per dive for each level of the Rerolls upgrade. The layer's reroll is spent first. Overclock offers can't be rerolled. When the pool runs dry, a lone Snack heals 20 Fluff.

**Passives** (each up to 5 times):

| Passive | Each card |
| --- | --- |
| Thick Fluff | +15 max Fluff, and heals 15 |
| Quick Paws | +6% move speed |
| Magnet Whiskers | +25% pickup radius |
| Sharp Claws | +8% all damage |
| Busy Paws | −6% weapon cooldowns |
| Strong Arms | +25% dig speed |
| Lucky Tail | +4% crit chance |
| Tough Coat | +1 armour: takes 1 off each bump, down to a minimum of 1 |

## Weapons

**Aiming:** weapons aim themselves.
- The Pickaxe, Puffer and Drill turn to the nearest critter within reach, and otherwise swing the way the hero faces.
- The Bomb and the Drill fire only when a critter is in range, so they never dig on their own.

The first eight weapons are in the pool from the start. The last four are unlocked by reaching layer 3 (Burrow Bomb), finishing a dive (Glow Moths), finishing hazard 2 (Rumble Drum) and bonking 5,000 critters in all (Pebble Drill).

| Weapon | Damage | Every | Digs | Level 5 overclocks | Level 10 overclocks |
| --- | --- | --- | --- | --- | --- |
| **Acorn Sling** | 8 | 0.6 s | no | Twin Sling, Heavy Acorn | Ricochet, Acorn Storm |
| **Pickaxe Bonk** | 14 | 0.9 s | yes | Wide Swing, Double Tap | Quake Bonk, Gold Rush |
| **Pebble Popper** | 10 | 1.2 s | no | Cluster, Big Pebble | Sticky, Bouncy |
| **Lantern Pulse** | 6 | 2 s | no | Bright, Warm | Beacon, Hearth |
| **Crystal Lance** | 16 | 1.5 s | no | Prism, Long Shard | Resonance, Glimmer |
| **Dust Puffer** | 5 | 0.8 s | no | Big Puff, Sneezy | Choking Cloud, Pepper Dust |
| **Twig Boomerang** | 9 | 1.4 s | no | Pair, Long Throw | Whirl, Sharp Twig |
| **Seed Orbit** | 7 | 0.4 s | no | More Seeds, Wide Orbit | Twin Ring, Sprout |
| **Burrow Bomb** | 55 | 2.5 s | yes | Bigger Bang, Quick Fuse | Chain Blast, Prospector |
| **Glow Moths** | 13 | 0.5 s | no | Swarm, Dazzle | Moonlit, Firefly |
| **Rumble Drum** | 24 | 4 s | no | Deep Drum, Quick Beat | Avalanche, Echo |
| **Pebble Drill** | 20 | 2 s | yes | Twin Drill, Long Bore | Diamond Bit, Tunnel Rat |

## Jobs

Layers 1–4 each get one job, and no job repeats within a dive. A finished job pays 25 gold × the layer.

| Job | What |
| --- | --- |
| Crystal haul | Pick up 60 crystals on the layer |
| Dig out the crates | Dig 3 buried crates out of the rock; each spills 15 crystals |
| Light the lanterns | Stand by 3 unlit lanterns for 3 s each; a lit lantern's pool slows critters by 30% |
| Bonk the big one | An elite appears at 2:30; bonk it |

## Power-ups

One-time pickups on the floor (`POWERUPS` and `DROPS` in the data file). The hero takes one by walking within 0.6 tiles of it.

**Where they come from:** every elite bonked (the big one included), every dug crate, and 1 in 80 other dug blocks (none from the wyrm's digging). At most 4 lie on the floor; a drop past that is skipped. Drops are drawn from the layer's own loot generator (`mix(seed, layer + 200)`), so they never shift any other draw, and a new layer clears the floor and every timer.

| Power-up | Weight | What it does |
|---|---|---|
| Boomerang Storm | 3 | For 8 s, 8 mini boomerangs on a turning ring swing out to 3.2 tiles and back every 2 s. Each hits a critter (or the wyrm's head) it touches for 8 × the layer's critter Fluff scale, at most once every 0.4 s per critter. |
| Whisker Vacuum | 2 | For 3 s every crystal on the layer flies to the hero at 3 × a crystal's speed. |
| Snack | 2 | +20 Fluff. |
| Big Sneeze | 2 | Every critter in the view loses half its most Fluff (an elite a fifth), with no crit or damage bonus, and is dizzy 2 s. |
| Hourglass | 2 | For 5 s critters don't move and can't bump; the wyrm keeps going. |
| Zoomies | 3 | +50% move and dig speed for 8 s. |
| Gold Pouch | 3 | 10 + 5 × hazard gold, with Prospector. |

**Balance:** the bot set the Snack and the block rate. At first (Snack +30 Fluff at weight 3, tripled under 40% Fluff; 1 in 40 blocks) first dives finished 39.7% against 23.8% without power-ups, over the 30% gate; leaving out one power-up at a time showed the Snack was nearly all of that. As shipped: first dives finish 28.1%, upgraded dives 62.5% at hazard 1 and 35.0% at hazard 3 (`npm run bot:cave`).

**On screen:** each lies as its card icon (Twig Boomerang, Magnet Whiskers, Snack, Dust Puffer, Busy Paws, Quick Paws and Prospector), bobbing and glowing through the dark, and as a purple disc with a gold plus on the mini-map. The storm's minis are small spinning boomerangs, the Sneeze bursts a ring of dust, and the Hourglass lays a frost over the cave. The timed ones show their seconds left under the job.

## The Rock Wyrm

**Body:** a head, 8 body segments and a tail.
- Its Fluff is 12,000, multiplied by `1 + 0.25 × (hazard − 1)`.
- It burrows through rock and surfaces to circle the hero at 2.6 tiles/s.

**Attacks:**
- Only the head takes damage. The body segments block shots.
- Every 8 s it rears up for 1 s, then sends out a rumbling ring that spreads 4 tiles and hits for 15 where its edge passes. Step out of the edge's path.
- A bump from the wyrm also costs 15 Fluff.

**At half Fluff,** it dives underground for 6 s and comes back 1.3× as fast.

**When bonked,** it tumbles into a pile of boulders, drops 100 crystals and 200 gold × hazard, and the pod lands. It never dies; it was just grumpy.

## Camp

**Upgrades:** level *n* of an upgrade costs its base × *n* gold.

| Upgrade | Each level | Max | Base cost |
| --- | --- | --- | --- |
| Fluffier | +8 max Fluff | 5 | 40 |
| Sharper | +5% all damage | 5 | 60 |
| Quicker | +3% move speed | 5 | 40 |
| Diggier | +10% dig speed | 5 | 30 |
| Magnetic | +10% pickup radius | 5 | 30 |
| Prospector | +8% gold | 5 | 50 |
| Rerolls | +1 reroll per dive | 3 | 80 |
| Head start | Start one level higher | 3 | 100 |

**Hazards above 1** raise critter Fluff (+25% per step) and the spawn ramp (+20%), shift card rarity upward, and multiply the wyrm's gold.

## Balance

`tests/glimmer-cave-bot.mjs` plays seeded dives on worker threads at 15 Hz.

**The bot's policy:**
- It flees the weighted centre of nearby critters and heads for crystals, the job, gold and the pod.
- It routes along the flow field.
- It picks cards by fixed weights and rerolls offers that hold nothing for its build.

**Running it:** QUICK runs in `npm test`; `npm run bot:cave` (FULL) runs four times as many dives.

Measured on 20-10-2026, with the power-ups in:

| Gate | Target | QUICK | FULL |
| --- | --- | --- | --- |
| First dives reach layer 2 | ≥70% | 93.8% | 92.8% |
| First dives finish | 5–30% | 28.7% | 28.1% |
| Gap over a random-card player | ≥10 points | 17.4 | 10.6 |
| Upgraded (every upgrade at 3, all unlocked), hazard 1 | 50–85% | 70.0% | 62.5% |
| Upgraded, hazard 3 | 15–50% | 36.7% | 35.0% |
| Every weapon taken | ≥3% of dives | ≥16.7% | ≥21.3% |
| Wyrm bonked within 30–150 s, of fights the hero survives | ≥80% | 89.5% | 91.4% |
| 60 Hz step with 300 critters | <2 ms | 0.20 ms | 0.23 ms |

Before the power-ups, first dives finished 23.8% (FULL) and upgraded hazard 1 sat on its 50% floor in QUICK. First dives now sit 2 points under their 30% ceiling and the random-card gap less than a point over its floor in FULL, so anything that makes dives easier needs the bot rerun. Rerun the bot after any change to a number in `lib/glimmer-cave-data.ts`. The tuning knobs, in order, are:
1. critter Fluff scaling (`FLUFF_SCALE`);
2. the spawn ramp (`RAMP`);
3. weapon base damage;
4. experience (`XP`);
5. the card tables.

## Art

**Source sheets:** the accepted sheets live in `public/art/cave-survival/`:
- the heroes, critters and effects (v2);
- environment v3 and floor v2;
- row 2 of wyrm v1 (body, flinch, tail, boulders);
- wyrm-heads v2;
- Enzo's dig frames (enzo-dig v4);
- the card and upgrade icons (icons v1);
- the `sprites-0` fallback poses.

**The importer:** `python3 scripts/glimmer-cave-import.py` cleans each sheet's alpha. It finds each frame's pieces, crop, foot line and scale, and writes:
- `art/glimmer-cave/<sheet>.png`, the cleaned sheet the art tests read pixel by pixel;
- `public/art/cave/<sheet>.webp`, the copy the game loads: colour at WebP quality 90, alpha lossless and checked to match the PNG exactly;
- `docs/glimmer-cave-crops.json`;
- the generated `lib/glimmer-cave-crops.ts`.

The importer is deterministic, so rerunning it reproduces its outputs byte for byte. Per-frame fixes, each with its reason, live in its `FIX` table: two left-facing frames are flipped.

**At runtime:**
- `lib/glimmer-cave-paint.ts` loads sheets on demand (hash-versioned URLs, one request each, Retry) and caches each frame at its drawn size.
- `lib/glimmer-cave-scene.ts` tries the painting for every piece and falls back to its code drawing in the same frame.
- The page asks for the heroes' sheets at camp and the rest when a dive starts; the icons sheet also loads as soon as a camp upgrade or card shows an icon.
- The icons are drawn by the page, not the canvas: one cell of the icons sheet as a CSS background, fitted into each card's, camp upgrade's and weapon slot's box. Camp upgrades reuse the icon of the passive they match (Fluffier is Thick Fluff, Sharper is Sharp Claws, Quicker is Quick Paws, Diggier is Strong Arms, Magnetic is Magnet Whiskers); overclock cards show their weapon with a spark badge.
- The HUD's mini-map (`drawMinimap`) draws the layer one pixel per tile, cached until a block is dug or a lantern lit, with fixed-size symbols outlined in plum on top: the hero's white chinchilla head, crates, lanterns (pale, gold once lit), red stars for elites, the wyrm's head, power-ups and the pod's capsule. Each weapon slot has a 12-step level bar with the overclock levels, 5 and 10, as diamonds.
- Projectiles grow with their weapon's size cards (`1 + size`), as their reach does. Each hero stands on a two-tone foot shadow, a soft wide edge and a dark core, so it's plain where they stand in front of a wall: block paintings are taller than their row on the floor, and a chinchilla is about a block and a half tall.

## Saves

| Key | Holds |
| --- | --- |
| `glimmer-cave-run-v1` | The dive at the start of its layer: hero, hazard, seed, layer, Fluff, experience, level, picks, weapons with their overclocks, passives, camp rerolls left, banked gold, jobs used, critters bonked. Written only at layer starts. |
| `glimmer-cave-v1` | The profile: gold, upgrades, unlocked weapons and hazards, stats |
| `glimmer-cave-sound-v1` | Mute |

**Validation:** a malformed save loads as a fresh start, never a broken dive. `Dive.fromSave` checks every field: ids, ranges, at most 4 weapons with no duplicates, and overclocks that belong to their weapon at its level.

**Restore:** a restored layer plays exactly like one that was never saved.

**Abandoned dives:** a dive abandoned mid-layer is recorded as bonked at that layer's start when the next dive begins.

## Tests

- `npm run test:cave` runs the engine suite (`tests/glimmer-cave.mjs`) and the art suite (`tests/glimmer-cave-art.mjs`).
- `npm run bot:cave` runs the bot at FULL size.
- `npm run test:e2e:cave` runs the browser checks (`tests/e2e/cave.mjs`). It needs `npm run dev`, and Playwright installed without saving it.
  - `E2E_BASE_URL` points it at another server.
  - `ONLY=<text>` runs the matching checks.
  - Screenshots go to `.checks/cave/`.
  - On a loaded machine a timing check can time out; rerun it before changing code.
