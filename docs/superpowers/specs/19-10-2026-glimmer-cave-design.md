# Glimmer Cave · design

Written 19-10-2026. The arcade's 38th game: a cosy cave-survival dive in the spirit of Deep Rock Galactic: Survivor, starring Dora and Enzo. Jason settled the shape in conversation:
- a dive of 20–30 minutes, as in Deep Rock;
- layers with jobs and drop pods;
- Dora and Enzo as the two classes;
- four weapon slots, with cards and rarities, and overclock-style twists at weapon levels 5 and 10;
- gold for camp upgrades;
- painted art, with more animation than one pose per character.

He asked for the rest to be decided with judgement: "nothing annoyed me, use your judgement". Every choice not in that list is Claude's call and is marked **(call)**. The name **Glimmer Cave** and the route `/cave` are calls too.

## Why this game

Jason: "it's just fun to kill the monsters." The pleasure is a swarm melting around you while you only steer:
- the weapons fire themselves;
- every few seconds a crystal pops into experience;
- every level-up adds a card that makes the swarm melt faster.

Deep Rock adds two things to the usual survivor formula: **digging** (you tunnel through rock by walking into it, and the rock is both cover and treasure) and **extraction** (a layer ends when you reach the drop pod, so the last thirty seconds are a run for it).

In this arcade the critters are never hurt: they are **bonked** and burst into dust puffs. Copy never says kill, die or blood; a defeated critter is "bonked" or "poofed", and a knocked-out hero is "bonked" too and goes home.

The arcade already has **Night Survivors** (`/survival`), a 3D survival roguelite on an Andean plateau. Glimmer Cave must feel different, not like a reskin:
- **digging** shapes the map;
- the run is a **descent** through five layers with jobs and extraction, not one endless night;
- Dora and Enzo are **classes** that play differently;
- **weapon levels** come from cards, with overclock choices;
- **gold** buys a meta-progression between dives.

No weapon name is shared with Night Survivors.

## The dive

- At camp you pick a **hero** (Dora or Enzo) and a **hazard** level (1–5; each unlocks by finishing a dive at the one below).
- A dive is **five layers**. Each layer is about **5 minutes**, so a whole dive is about 25 minutes.
- A layer opens with the drop pod landing in a fresh cave. The **layer timer** counts down 5:00. Critters arrive in waves that grow through the layer.
- Each layer has a **job** (below). Finishing it is optional and pays bonus gold.
- At 0:00 the **pod returns**, landing somewhere 12–20 tiles from the hero, marked by an arrow at the screen edge. The swarm surges. Reach the pod within **45 s** to finish the layer. Miss it and the hero is bonked; the dive ends.
- **Layer 5** has no timer job. After 3:00 the **Rock Wyrm** bursts out of the rock. Bonk it, and the pod arrives for the last run.
- When **Fluff** (HP) reaches 0, the hero is bonked and the dive ends.

### Banking and saving

- **Gold** collected on a layer is banked when you reach its pod.
- If the hero is bonked, half the gold from the unfinished layer is kept, rounded down **(call)**. Banked gold is always kept.
- **The game saves at each drop pod**: the whole build, Fluff, banked gold, the layer reached and the seed. **Continue** resumes at the start of the next layer.
- A reload in the middle of a layer restarts that layer from its pod, with the build as it was when the layer began **(call)**.

### The buddy (call)

The hero you didn't pick follows as a **buddy**, so both chinchillas are on screen as in the mock-up and the style test:
- it trots after the hero and never takes damage;
- it uses its own class's starting weapon at 50% damage and never levels;
- it's flavour and a small help, not a second build.

## Heroes

| Hero | Starts with | Class perk |
| --- | --- | --- |
| **Dora**, the digger | **Pickaxe Bonk** | Digs 2× as fast. +15% max Fluff. Her pickaxe also digs any block it sweeps. |
| **Enzo**, the scout | **Acorn Sling** | +15% projectile speed. A 30% wider lamp, so crystals and gold show further away. +10% move speed. |

The base stats are:
- **Fluff:** 100 (max HP);
- **move speed:** 3.2 tiles/s;
- **pickup radius:** 1.5 tiles;
- **armour:** 0;
- **crit chance:** 5%, and a crit does ×2.

Contact with a critter takes its damage from Fluff, with **0.5 s of grace** after each hit. During the grace period the hero flinches and flashes.

## Controls

- **Move** with WASD or the arrow keys, or on touch with a **floating joystick**: put a thumb down anywhere on the stage and drag.
- That's the only control in play. Weapons aim themselves.
- **P** or **Escape** pauses, and so does a pause button. The game also pauses when the tab is hidden.
- On a card screen, **1 / 2 / 3** pick a card and **R** rerolls.
- **Digging:** walking into a diggable block digs it. Each block has a dig time, and the hero chips at it while pushing into it. Dirt takes 0.6 s and a gold block 1.0 s, halved for Dora. Bedrock can't be dug.

## The cave

- Each layer is a seeded **64 × 48 tile** map.
- Open caverns are carved by cellular automata, linked by tunnels, inside a bedrock border.
- The remaining rock is a mix of:
  - **dirt** (diggable, drops nothing);
  - **gold blocks** (diggable; each drops 3–6 gold, more deeper);
  - a little **bedrock** inside the cave, to shape corridors.
- Job props are placed in pockets of rock.
- The pod's landing spots must be open floor. Every spot is reachable from the start, which the test checks with a flood fill.
- The **camera** follows the hero. It looks down at the 55° of the style art, so the floor is squashed to 0.8 of its depth and blocks show a front face.
- The view shows **11 tiles** across its shorter side **(call)**. That keeps heroes about 48 px tall on a 960 × 600 stage, as in the mock-up.
- **Layers 1–5** change tint (warm purple, deeper violet, blue-violet, plum, ember-lit for the wyrm's den), the critter mix and the gold richness. The floor painting is shared and tinted in code **(call)**.

### Jobs (one per layer 1–4, drawn from these)

| Job | Goal | Reward |
| --- | --- | --- |
| **Crystal haul** | Pick up 60 crystals on this layer. | 25 gold × layer |
| **Dig out the crates** | Dig 3 buried crystal crates out of the rock (each holds 15 crystals). | 25 gold × layer |
| **Light the lanterns** | Stand by 3 unlit lanterns for 3 s each. Each lights a warm pool where critters are 30% slower. | 25 gold × layer |
| **Bonk the big one** | An elite critter appears at 2:30. Bonk it. | 30 gold × layer, plus a crystal cache |

The job and its progress show in the HUD. Jobs never repeat within a dive.

## Critters

The same three critters appear throughout. Hazard and depth scale their numbers and toughness.

| Critter | Fluff | Speed (tiles/s) | Contact | Habit |
| --- | --- | --- | --- | --- |
| **Soot sprite** | 6 | 2.2 | 5 | Streams straight at the hero in loose crowds. |
| **Pink mite** | 4 | 2.8 | 4 | Comes in packs of 5–8 and hops forward in short dashes. |
| **Mossy beetle** | 30 | 1.4 | 10 | Slow. Every 4 s, if within 4 tiles, it lowers its head and shell-rams 2 tiles. |

- **Elites** are any critter at 1.6× size, with a warm rim tint, ×8 Fluff and ×1.5 contact. They drop a **crystal cache** (20 crystals) and show a Fluff bar. Elites appear from layer 2 onward, about one a minute.
- **Waves:** critters spawn just off screen, in open tiles. The target number alive ramps from 20 to 120 across a layer (×1.25 per layer below the first, ×(1 + 0.2 × (hazard − 1)) by hazard), capped at **300** alive. Every 60 s a **swarm burst** spawns 30 at once from one direction.
- **The pod run** doubles spawns for its 45 s.
- **A bonked critter** shows its flinch frame on the bonk, its dizzy frame for 0.25 s, then a dust poof. It drops a **crystal**: 1 experience for a soot sprite or mite, 4 for a beetle. Crystals within the pickup radius fly to the hero.
- **Critter Fluff** scales ×(1 + 0.35 × (layer − 1)) × (1 + 0.25 × (hazard − 1)) **(call; the bot tunes it)**.

### The Rock Wyrm (layer 5)

- A chain of a **head**, **8 body segments** and a **tail**.
- It burrows through rock, digging every block on its path, and surfaces to circle the hero.
- Every 8 s it rears up and **rumbles**: a ring shockwave with a telegraphed edge that the hero steps out of.
- Only the **head** takes damage. Segments block shots but take none. The head shows a big Fluff bar.
- At 50% Fluff it dives underground for 6 s and resurfaces faster.
- When its Fluff hits 0 it is **bonked**: it tumbles into a pile of boulders and dust, drops 100 crystals and 200 gold × hazard, and the pod arrives.
- It **never dies**; it was just grumpy.

## Levels, cards and weapons

- **Experience** comes from crystals. Reaching the next level pauses the game for a **level-up**: pick one of **three cards**.
- **One reroll** per layer, plus any from camp.
- Experience to the next level is `5 + 3 × level` **(call)**.

### Weapons

- Up to **four weapon slots**. The starting weapon fills one.
- Every weapon has **levels 1–12**. Each card for a weapon raises its level by one.
- At **level 5** and **level 10** the next card is an **overclock**: the weapon's two twists, one of which you pick (below).

| Weapon | What it does (level 1) | Mines? | Overclocks at 5 (pick one) | Overclocks at 10 (pick one) |
| --- | --- | --- | --- | --- |
| **Acorn Sling** (Enzo) | Flings an acorn at the nearest critter every 0.6 s; 8 damage. | no | **Twin Sling**: two acorns, aimed apart · **Heavy Acorn**: +80% damage, knocks back | **Ricochet**: acorns bounce to 2 more critters · **Acorn Storm**: every 5th volley fires 8 acorns all round |
| **Pickaxe Bonk** (Dora) | Swings a 110° arc in the facing direction every 0.9 s; 14 damage. | yes | **Wide Swing**: 200° arc · **Double Tap**: a second, quicker swing | **Quake Bonk**: each swing sends a short shockwave · **Gold Rush**: blocks dug by a swing drop +50% gold |
| **Pebble Popper** | Lobs a pebble that splashes 1 tile around where it lands; every 1.2 s, 10 damage. | no | **Cluster**: splits into 3 on landing · **Big Pebble**: +60% splash radius | **Sticky**: leaves a 2 s patch that slows · **Bouncy**: bounces twice more |
| **Lantern Pulse** | Every 2 s, a warm ring pulses out 2.5 tiles from the hero; 6 damage and a push. | no | **Bright**: +40% radius · **Warm**: critters hit are 25% slower for 2 s | **Beacon**: every 3rd pulse reaches double radius · **Hearth**: each pulse heals 1 Fluff per critter hit, up to 5 |
| **Crystal Lance** | Fires a piercing shard in a line toward the densest crowd, every 1.5 s; 12 damage. | no | **Prism**: splits into 3 lances · **Long Shard**: twice as long, pierces all | **Resonance**: a hit critter chimes, hitting its neighbours for 50% · **Glimmer**: bonked critters drop double crystals 10% of the time |
| **Dust Puffer** | Puffs a short cone ahead every 0.8 s; 5 damage and 30% slow for 1.5 s. | no | **Big Puff**: wider cone · **Sneezy**: the cone also fires behind | **Choking Cloud**: leaves a lingering cloud 2 s · **Pepper Dust**: +100% damage, no slow |
| **Twig Boomerang** | Throws a twig that flies 4 tiles and returns, every 1.4 s; 9 damage both ways. | no | **Pair**: two boomerangs · **Long Throw**: 6 tiles | **Whirl**: hovers and spins at its far point for 1 s · **Sharp Twig**: +70% damage |
| **Seed Orbit** | 3 seeds circle the hero at 1.6 tiles; 7 damage on touch, each seed every 0.4 s. | no | **More Seeds**: 5 seeds · **Wide Orbit**: 2.4 tiles | **Twin Ring**: a second, counter-rotating ring · **Sprout**: seeds leave a brief bramble patch |
| **Burrow Bomb** | Drops a bomb where the hero stands every 2.5 s; after 1 s it bursts 1.5 tiles for 25 damage and **digs** blocks in range. | yes | **Bigger Bang**: +50% radius · **Quick Fuse**: 0.4 s fuse | **Chain Blast**: each burst sets off another 2 tiles away · **Prospector**: blocks it digs always drop gold |
| **Glow Moths** | 2 moths fly out, home in on critters and return; 6 damage per hit, 0.5 s apart. | no | **Swarm**: 4 moths · **Dazzle**: hit critters are stunned for 0.3 s | **Moonlit**: moths pierce · **Firefly**: moths explode for 15 when they return |
| **Rumble Drum** | Every 4 s, a thump shakes everything within 3.5 tiles; 10 damage, stuns 0.5 s. | no | **Deep Drum**: +1.5 tiles radius · **Quick Beat**: every 2.5 s | **Avalanche**: the thump digs blocks in range · **Echo**: a second thump follows 0.5 s later |
| **Pebble Drill** | Sends a spinning drill 6 tiles in the facing direction every 2 s; 8 damage per tick through everything, and it **digs** blocks in its path. | yes | **Twin Drill**: also drills backward · **Long Bore**: 10 tiles | **Diamond Bit**: +100% damage · **Tunnel Rat**: the hero moves 25% faster for 2 s after each drill |

- Each card raises a weapon's damage by **+15%** and alternates a secondary stat: rate, size or count **(call; exact numbers in the data file, set by the bot)**.
- Eight weapons are in the pool from the start: Acorn Sling, Pickaxe Bonk, Pebble Popper, Lantern Pulse, Crystal Lance, Dust Puffer, Twig Boomerang and Seed Orbit.
- The other four unlock through camp milestones (see **Camp**).

### Passive cards

These take no weapon slot and stack up to 5 times.

| Card | Per stack |
| --- | --- |
| **Thick Fluff** | +15 max Fluff, and heals 15 |
| **Quick Paws** | +6% move speed |
| **Magnet Whiskers** | +25% pickup radius |
| **Sharp Claws** | +8% all damage |
| **Busy Paws** | −6% weapon cooldowns |
| **Strong Arms** | +25% dig speed |
| **Lucky Tail** | +4% crit chance |
| **Tough Coat** | +1 armour (takes 1 off each hit, to a minimum of 1) |

### Rarity (call)

- Every card is drawn at a rarity: **Common** 60, **Uncommon** 28, **Rare** 10, **Epic** 2.
- Each hazard level above 1 moves 4 points from Common to Uncommon and 1 point from Uncommon to Rare.
- Rarity **scales the card's bonus**: ×1, ×1.5, ×2, ×3. A weapon card still adds one level, whatever its rarity.
- An overclock card has no rarity.
- **The offer:** three different cards.
  - With a slot free, at least one is a new weapon.
  - With four weapons, only those four and passives are offered.
  - A weapon at level 12, or a passive at 5 stacks, is not offered.

## Camp

Camp is between dives: the cosy pod bay, with Dora and Enzo. It has:
- the **hero** and **hazard** pickers;
- the **upgrades**;
- **Dive**, and **Continue** when a dive is saved.

**Upgrades** are bought with banked gold and last forever. Each has 5 levels, and the cost is `base × level` gold **(call; the bot sets the bases)**.

| Upgrade | Per level |
| --- | --- |
| **Fluffier** | +8 max Fluff |
| **Sharper** | +5% all damage |
| **Quicker** | +3% move speed |
| **Diggier** | +10% dig speed |
| **Magnetic** | +10% pickup radius |
| **Prospector** | +8% gold |
| **Rerolls** | +1 reroll per dive (levels 1–3 only) |
| **Head start** | Start each dive at level 2, 3, 4… (levels 1–3 only) |

**Unlocks**, shown at camp with what earns them:
- **Burrow Bomb**: reach layer 3;
- **Glow Moths**: finish a dive;
- **Rumble Drum**: finish hazard 2;
- **Pebble Drill**: bonk 5,000 critters across all dives.

**Pacing target (call):**
- A first dive at hazard 1 usually reaches layer 2 or 3.
- Hazard 1 is usually finished after 3–6 dives.
- Hazard 5 is the long goal, roughly 30–50 dives in.

## Screens

- **Title:** Continue (if saved), Camp and mute. The title painting comes later. Until then the title is code-drawn from the gameplay style test's colours.
- **Camp:** described above.
- **Dive:** the canvas fills the page, and a slim DOM HUD sits over it:
  - Fluff bar, layer and timer, job and progress, gold;
  - an experience bar along the top edge;
  - the four weapon slots with their levels;
  - pause.

  On a phone it keeps the same layout, with smaller type. The joystick appears where the thumb lands.
- **Level-up and overclock:** three or two cards over a dimmed, paused stage, with Reroll.
- **Pod:** after each layer, a summary card (gold banked, job done or not, critters bonked) and **Descend**. The save happens here.
- **Dive end:** the layer reached or "Dive complete!", gold banked, unlocks earned, and back to camp.

## Art and animation

The art is painted, with animation. The direction is `public/art/cave-survival/gameplay-style-test.png` and `sprites-0.png` (on `codex/cave-survival-style-art`):
- soft gouache;
- thin dark-plum outlines;
- rounded cute shapes;
- the purple cave floor and warm lantern light;
- Dora ivory-white with nearly black burgundy eyes, Enzo grey with a white chest and black eyes.

**Sheets requested from ChatGPT on 19-10-2026.** All are 1536 × 1024 with alpha, characters facing RIGHT; the game mirrors them for left.

| File | Grid | Contents |
| --- | --- | --- |
| `enzo.png` | 6 × 4, 256 px cells | walk 6, throw 6, idle 2 + blink + flinch + dizzy + recover, crouch–spin–land + cheer 3 |
| `dora.png` | 6 × 4, 256 px cells | walk 6, pickaxe bonk 6, idle 2 + blink + flinch + dizzy + recover, dig 2 + wipe + cheer 3 |
| `critters.png` | 6 × 4, 256 px cells | for each critter: walk 4, flinch, dizzy; then the three attacks, 2 frames each |
| `fx.png` | 6 × 4, 256 px cells | dust poof 6, bonk star 3, rock chips 3, acorn spin 4, crystal twinkle 2, swing arc 3, level-up ring 3 |
| `environment.png` | 4 × 2, 384 × 512 cells | dirt, gold, gold cracked ×2, bedrock, drop pod, lantern, crystal crate |
| `floor.png` | 1024² seamless tile | calm purple stone |
| `wyrm.png` | 4 × 2, 384 × 512 cells | head ×4 (idle, grumpy, rumble, dizzy), body, body flinch, tail, boulder pile (second round) |

**How the frames play:**
- **Walking:** frames advance with **distance moved**, not time, so feet don't skate. When the hero or a critter stops, the walk gives way to the 2-frame idle breathe with an occasional blink.
- **Attacks:** a weapon's fire event starts its attack frames: Enzo's throw for Acorn Sling, Dora's bonk for Pickaxe Bonk. Other weapons use effects only, so the hero doesn't windmill nonstop.
- **Hits:** the flinch frame shows for 0.15 s on a hit. A bonked critter shows flinch, then dizzy for 0.25 s, then the 6-frame poof.
- **Mining:** digging plays Dora's dig frames, or Enzo's walk frames pushing, with rock chips from `fx.png` and the block's crack stages from `environment.png`.

**Fallbacks:**
- While a sheet loads, or if it fails, the game uses the single painted pose from `sprites-0.png` with a procedural hop and flip, as the mock-up does.
- If that fails too, it uses code drawings: `drawChinchilla` for the heroes and the mock-up's shapes for everything else.
- A **Retry artwork** button appears after a failure, as in Chinchilla Trek.
- Effects and the floor have code fallbacks too.

**Clean-up and cropping:**
- Before use, an offline script snaps alpha ≥ 240 to 255 and clears colour under alpha 0. The delivered sheet was 1–2% see-through, with dark halo colours hidden under its transparent pixels.
- The script also measures every frame's bounds and foot line, and **normalises** drifting frames to a common size and foot line.
- It writes `docs/glimmer-cave-crops.json` and records the hashes, as the trek did.
- The originals stay in `public/art/cave-survival/` **(call)**.

**Drawing:**
- Each frame is drawn once to an off-screen canvas at its display size × device pixel ratio, and gameplay draws from that cache, never from the 1536 px sheet. This keeps 300 critters smooth on a phone.
- Health bars and numbers are outlined so they read on the painting.
- **Reduced motion:** no screen shake, smaller poofs, and no swarm-burst camera nudge. The walk and attack frames still play, because they are the game's content, not decoration.

## Sound

`makeSound('glimmer-cave-sound-v1', …)` from `lib/cue-sound.ts`, with these cues:
- sling, bonk, poof;
- crystal (a soft tick, throttled to 12 a second);
- level-up, dig, gold, hurt;
- pod incoming, pod reached;
- wyrm rumble, dive complete.

## Saving

- **`glimmer-cave-run-v1`** is written at each pod. It holds:
  - `{ v: 1, hero, hazard, seed, layer, fluff, xp, level, weapons: [{ id, level, overclocks }], passives, rerolls, gold: { banked, layer }, jobsUsed, bonked }`.
  - It's cleared when a dive ends.
- **`glimmer-cave-v1`** is the profile: `{ v: 1, gold, upgrades, unlocked: { hazard, weapons }, stats: { dives, bestLayer, bonked, finished } }`.
- **`glimmer-cave-sound-v1`** holds the mute setting.
- **Malformed data** loads fresh. Unknown ids are dropped.

## Architecture

The arcade's split. The engine is deterministic and runs at a fixed **60 steps a second**.

- **`lib/glimmer-cave-data.ts`**: weapons and their per-level tables, overclocks, passives, rarities, critters, jobs, upgrades, unlocks and tuning.
- **`lib/glimmer-cave-map.ts`**: seeded layer generation (caverns, rock, gold, props, pod spots), and `dig(map, x, y)`.
- **`lib/glimmer-cave-game.ts`**:
  - `Rand`, copied from Chinchilla Trek;
  - the `Dive` class with `step(input: { x: number; y: number })`, which moves the hero, digs, runs weapons, critters, crystals, jobs, the timer and the pod;
  - `pick(i)`, `reroll()`, `descend()`;
  - critters in a **spatial hash**;
  - the events the scene and sound need, as `{ kind, x, y, … }` per step;
  - camp actions (`buy`, unlock checks);
  - the profile (`loadProfile`, `record`);
  - the bot policy `drive(dive)`, shared with the bot test.

  The same seed and the same input sequence give the same dive.
- **`lib/glimmer-cave-crops.ts`** and **`lib/glimmer-cave-paint.ts`**: generated crop and frame tables, and the lazy loader on Chinchilla Trek's pattern (hashed URLs, one request per file, subscribers, `retry`, painters that return false so the scene draws its fallback).
- **`lib/glimmer-cave-scene.ts`**: Canvas 2D in the 55° view:
  - the floor, and blocks drawn depth-sorted with their front faces;
  - heroes, buddy, critters, the wyrm, crystals and effects, also sorted by depth;
  - the lantern light;
  - the pod arrow and numbers;
  - the frame selection rules from **Art and animation**.
- **`app/cave/page.tsx`** and **`app/cave/cave.css`**:
  - screens, the HUD, input and the joystick;
  - the fixed-step loop, pause on blur, sound and saving;
  - `window.__cave()` (the dive, the profile, and helpers that set level, weapons, Fluff, timer and layer);
  - `main[data-ready="true"]` and `main[data-screen]`.

## Balance

`drive(dive)` is a plain policy:
- it steers away from the crowd's weighted centre and toward crystals, job targets, gold blocks within 3 tiles and, once it arrives, the pod;
- it picks cards by a fixed weight per card, preferring to fill weapon slots early;
- it takes the first overclock.

`tests/glimmer-cave-bot.mjs` is part of `npm test` and runs in under 90 s. The builder sets the dive count to fit. It gates:
- **First dives:** with a fresh profile at hazard 1, the policy reaches layer 2 in at least 70% of dives and finishes the dive in 5–30%. A random-card player finishes at least 10 points less often.
- **Upgraded:** with all upgrades at level 3, the policy finishes hazard 1 in 50–85% of dives and hazard 3 in 15–50%.
- **Variety:** every weapon is taken in at least 3% of dives, and every overclock in at least 1% of the times its weapon reaches its level.
- **Timing:** the Rock Wyrm is bonked within 30–150 s in at least 80% of fights reached.
- **Performance:** a step with 300 critters alive averages under 2 ms in Node.

The tuning knobs, in order: critter Fluff scaling, the spawn ramp, weapon base damage, experience per level, then the per-level tables. Hay Maze's and Chinchillas vs Zombies' bots set the precedent: thresholds enforced by `npm test`.

## Testing

**`tests/glimmer-cave.mjs`** tests the engine in `npm test`:
- **Maps:**
  - seeded maps are reproducible;
  - every open tile and every pod spot is reachable;
  - the bedrock border is solid;
  - digging turns a block into floor, drops gold from gold blocks, and never digs bedrock.
- **Movement:**
  - the hero can't pass rock;
  - pushing into a block digs it in its dig time, halved for Dora.
- **Weapons:** each weapon at level 1 bonks a placed critter as its table says, and each overclock changes what it says.
- **Levels:**
  - level-ups pause and offer three valid cards;
  - rarity scales bonuses;
  - weapon level 5 and 10 offer overclocks;
  - nothing is offered past its cap;
  - four slots fill.
- **Layer flow:**
  - the timer, the pod landing and the 45 s run;
  - bonked at 0 Fluff, and bonked when the pod is missed;
  - half the layer's gold kept;
  - jobs completing and paying;
  - no job repeated within a dive;
  - the wyrm appearing on layer 5 at 3:00 and taking damage only on its head.
- **Determinism:** the same seed and inputs give the same events.
- **Camp:** costs, unlocks, banking.
- **Saving:** round-trips at a pod; a malformed save loads fresh.

**`tests/glimmer-cave-art.mjs`**: the delivered files and hashes, every frame inside its cell with a consistent foot line, and the loader (one request per file, failures, Retry, stale callbacks, wrong sizes). As for Chinchilla Trek.

**`tests/glimmer-cave-bot.mjs`**: the gates above.

**`tests/e2e/cave.mjs`** (Playwright):
- hydration;
- start as each hero;
- move with keys and dig a block;
- a level-up card and a reroll;
- reach the pod and see the summary;
- Continue after a reload resumes at the next layer;
- an overclock offer;
- buy a camp upgrade;
- slow and failed art play on, then Retry;
- the stage and HUD fit at 390 × 844 and 1280 × 860;
- no page errors.

## Build order

1. **Art branch:** merge `codex/cave-survival-style-art` (the style test, `sprites-0.png` and their docs) through its own PR, so the references are on `main`.
2. **Engine and map, with tests.** The data file is written from this document.
3. **The bot** and the first tuning.
4. **Scene and page**, playable with code drawings and `sprites-0.png` poses.
5. **Painted animation:** the loader and frame tables, wired as each sheet arrives (heroes first).
6. **Arcade integration** and documentation.

Each step is its own pull request, following the trek's pattern. The design and the plan get one PR first.

## Arcade integration

Follow the README's **Adding a game** checklist in full:
- the `GAMES` card, 38th, after Chinchilla Trek;
- every hardcoded count goes from thirty-seven to thirty-eight, including the number word in `tests/readme.mjs`, the e2e files and the `panel-contrast` route list;
- the README row `| 38 | Glimmer Cave | \`/cave\` | Cave survival |` and its guide;
- `docs/glimmer-cave.md`;
- the `test:cave`, `bot:cave` and `test:e2e:cave` scripts;
- a CHANGELOG entry.

## Out of scope

- Co-op or a second player steering the buddy.
- More classes, sub-classes or per-class weapon restrictions beyond the starting weapon.
- Biomes beyond tinted layers, and more critter species. The art asks for three; more can come later.
- Artifacts, missions with multiple stages, daily or weekly seeds, and leaderboards.
- Music beyond cue sounds.
- Anything bought with real money, energy timers or adverts.
