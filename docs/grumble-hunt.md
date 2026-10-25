# Grumble Hunt

Built 24-10-2026 as game 39, at `/hunt`, from `grumble-hunt-base`.

## A gentle adventure

Choose Dora (white chinchilla) or Enzo (grey chinchilla), then pick a weapon at the rack. Their starting suggestions are the Acorn Hammer and Seed Bow. The other friend follows, helps bonk, and tosses a berry for 28 Fluff when the leader has 45 Fluff or less, with a ten-second berry cooldown. The buddy never loses Fluff.

Clover Camp has four stations, reachable on foot with F or through the camp buttons: the Forge, hunt board, Beast Book and Pantry. Old Mossback’s hunt board follows story chapters 0–5. Friends already met remain available for free hunts, including after the ending. New game asks for confirmation and resets only this game.

Each hunt uses its chapter’s area, with trees, pines and rocks; the original meadow keeps its seeded layout. There is no time limit. Bonks lower Grump. At zero, the beast folds its legs and curls up, rests for a moment, and goes to the sanctuary. Beasts are never hurt.

## The five friends

| Beast | Starting Grump | Movement and openings | Material | Pop-off part |
| --- | ---: | --- | --- | --- |
| Bristleback | 420 | Paws the ground, charges a marked lane, becomes dizzy after a tree or rock crash | Bristle tufts | Tusks |
| Puffwart | 440 | Hops, flicks its tongue along a lane, or blows a sleepy cloud; bonk between moves | Marsh beads | Warts |
| Skreel | 400 | Circles in the air, swoops along a lane, then lands for a 4.5-second rest | Sky feathers | Crest |
| Hornclack | 560 | Its front shell blocks bonks; circle to the sides or back. Sweeps its horn and charges | Shell buttons | Horn cap |
| Frostmane | 840 | Pounces in mood 1, adds an icy mane shake in mood 2, and favours quick pounces in mood 3 | Frost fluff | Mane tufts |

Charges and swoops stop at the end of their 12-unit marked lane. The final-hunt unlock banner appears only on the result that earned the third different nap.

Every attack has a **0.9-second** wind-up (0.8 seconds when Extra Grumpy) and an orange ground marker. Frostmane changes mood below two-thirds and one-third Grump; its later rests become shorter. The mane shake pushes the leader away. A sleepy cloud lasts five seconds and slows movement while inside; it never lowers Fluff.

At tier one, Dizzy builds from two big hammer bonks or big bow shots; buddy bonks help a little. Hits during dizzy do not build the next dizzy. A crash or dizzy dust also makes a beast dizzy, providing at least three seconds of opportunity. Bonks during dizzy are 1.7 times as large. Hornclack’s front shell is open during dizzy. Dora’s hammer reaches Skreel when it is low; the bow can reach it in the air.

## Paws, tools, and treasures

The leader has 100 Fluff. Ordinary bumps have a 1.4-second recovery window. A roll lasts 0.46 seconds with a dodge window for its first 0.32 seconds; another roll is available after 0.85 seconds. At zero Fluff the leader is tuckered out, returns to camp, and keeps all materials, including drops still in the meadow. Retrying is immediate, with full Fluff and the fluffberries topped back up to three. There is no other penalty.

Dora’s ordinary hammer bonk is 14 Grump, a charged swing 27. Enzo’s seed shots are 9 or 20. Once the tool cooldown ends, hold K for at least 0.35 seconds and release for the big version. The HUD shows tool recovery and reports a big bonk or shot ready only after 0.35 seconds of actual charge. While K is held, `game.hold()` says what it is doing: guarding (guard tools), a charge with one level (0.35 s) or two (0.35 and 1.0 s, Hammer and Bow), or a signature that fires on release. The scene rings the hero with 18 petals that fill towards the last level, bursts a ring and plays a chime as each level is ready, and pulses once the charge is full. The hero crouches and trembles, the tool draws back, and a meter under the hero names the release. Guarding shows a leaf-green bubble and a stamina bar, and lifts the shield. Weapon trees scale Bonk by ×1, ×1.3, ×1.65, ×2.1 and ×2.4. Every tier scales the original hammer’s 14 / 27 quick-swing Bonk; a full charge starts at 28.8. Hammer tiers 2 and 3 use ×1.35 / ×1.70, and bow tier 2 uses ×1.32, preserving old save power. Charged Hammer and Bow Dizzy starts at 50 and scales at every tier. The tier-one bow keeps 9 / 20 total Bonk and timing, sharing a charged shot across two or three seeds. Buddy bonks are smaller and less frequent. Each toy is built around its handle, with the group origin at a paw grip. `hold` places it so the grips sit under the chin, and long blades rest back over the right shoulder, clear of the head. `poseArms` runs after each pose so the paws track the handles, and `keepInReach` slides a toy towards the shoulders if a grip would sit more than 0.42 from one. Thrusts and jabs step the body forward rather than stretch the arms.

Each beast has its own materials, from the drop tables in `lib/grumble-hunt-content.ts`. Every connecting bonk has a 20% chance to shed one of the beast’s common materials (10% for Hornclack’s shell plate). At 32% of a beast’s initial Grump bonked away, its part pops off once and drops its part material: a tusk shard, a puff sac (Puffwart’s throat sac deflates), two sky feathers, a horn chip or an icy mane lock. A nap rewards three commons from the beast’s list plus a 25% roll for its rare material (50% for Frostmane’s glimmer stone); the result card shows what you got. Walk within 2.6 units to pick up a drop; calming or getting tuckered out collects every drop still in the meadow. Drops float as their painted icons.

The Beast Book shows each reference picture, sanctuary status, home area, pop-off part, tips and the beast’s materials in your pouch.

## Alive hunts

**Extra Grumpy.** The first time a bonk takes a beast below 30% of its starting Grump, it turns Extra Grumpy for the rest of the hunt: steam puffs from its ears, its eyebrows go red, the HUD says so, and a low cue plays. It moves 15% faster (roaming, circling, charges, swoops, hops and pounces) and its wind-up is 0.1 seconds shorter, 0.8 seconds, so every attack still warns well over 0.6 seconds ahead. Grump, damage and materials are unchanged.

**Enzo’s sniff.** The beast is out of sight when it is more than 12 units from the leader, or when a tree or rock stands between them. After one second out of sight Enzo sniffs the air (a note and a high cue): a trail of up to 16 glowing pawprints, 1.1 units apart, leads from the leader towards the beast, skipping any print under a tree or rock. It stays lit while the beast is out of sight and fades two seconds after it is seen again. Enzo sniffs whichever friend is leading.

**Buddy orders.** Hold Tab and tap E or Q to step the buddy’s order forwards or back through **Stay close**, **Go bonk** and **Gather**; the order button under the Fluff bar does the same with a click or tap. While an order is being given, Q and E don’t change the pouch item and releasing Tab doesn’t toggle lock-on; a plain Tab tap toggles lock-on when it is let go. Hunts start on Go bonk, the original behaviour: the buddy helps once the leader is within 11 units of the beast, and Dora runs in to bonk. Stay close keeps the buddy at the leader’s side and lets it help only from there, which for Dora means only when the beast is next to you. Gather sends the buddy to the nearest material on the ground, picks it up within 1.2 units, and never bonks. Healing berries come in every order. The order is not saved.

## The Pantry

The second step of the expansion. The Pantry is a striped market stall at Clover Camp. Items are now made, not handed out, and the pouch persists between hunts.

**Gathering.** Each hunt places gathering spots around the meadow by the seeded generator, at 6–15 units from the middle, clear of trees and rocks and at least 3 units apart. Each beast lives in an area: Bristleback in the meadow (3 berry bushes), Puffwart in the marsh (2 bushes, 4 reed clumps), Skreel on the ridge (2 bushes, a glimmer sparkle half the time), Hornclack in the hollow (2 bushes, 1 reed clump, a glimmer half the time) and Frostmane on the peak (2 bushes, a glimmer three times in four). Each bush or reed clump gives 2, a glimmer 1. Stand within 1.8 units, press **F** (or the Gather button) and stay still for 1.2 seconds; moving, rolling, bonking, charging or a bump stops it. A cream ring marks the spot in reach and fills as you gather; a picked spot loses its berries, cattails or crystals. On the Gather order the buddy visits spots after any drops.

**Items.** Camp tops the pouch up to three fluffberries before every hunt. Recipes open with the current story chapter (the Pantry begins in chapter 2):

| Item | Recipe | Holds | Effect | Opens |
| --- | --- | --- | --- | --- |
| Fluffberry | 1 berry | 10 | +30 Fluff | always |
| Big fluffberry | 2 berries, 1 marsh reed | 5 | +70 Fluff | after 1 nap |
| Sleepy seed | 1 berry, 1 sleepy-cloud wisp | 3 | within 10 units, the beast moves 30% slower for 8 s | after 1 nap |
| Smoke puffball | 1 puff sac | 3 | hidden for 6 s: the beast loses track, wanders and starts no attacks; your bonk ends it | after 1 nap |
| Hay bundle | 3 marsh reeds | 5 | snack ingredient | after 1 nap |
| Pathfinder acorn | 1 berry, 1 sky feather | 3 | glowing pawprints to the beast for 20 s | after 2 naps |
| Dizzy bell | 1 horn chip, 2 bristle tufts | 2 | within 4 units, +40 Dizzy (100 makes a beast dizzy) | after 3 naps |
| Sticky sap | 2 marsh reeds | 2 | a puddle; a grounded beast that walks within 1.6 units is stuck for 4 s, even mid-attack, then rests 1.2 s | after 3 naps |

Healing is capped at max Fluff and refused at full Fluff; a bell is refused when the beast is already dizzy or stuck; only one sap puddle at a time. Refused items are not spent. A hammer big bonk adds 50 Dizzy and a buddy bonk 30.

**The item ring.** Up to six items ride in the ring; Q and E step through it and F uses the one shown. The Pantry’s ring buttons add and remove items (at least one stays), always in recipe order. The default ring is fluffberry, big fluffberry, sleepy seed, dizzy bell, sticky sap and smoke puffball.

**Snacks.** Snacks open after the first nap. One snack is packed at a time and eaten at the start of the next hunt: Clover Crunch (2 berries) gives +20 max Fluff, Hay Nibble (1 hay bundle) makes rolls recover 25% faster, Berry Stack (3 berries, 1 hay bundle) adds 10% Dizzy to every hit, and the Lucky Seed Bun (2 berries, 1 hay bundle, 1 glimmer stone, after two naps) adds one extra rare-material roll at nap time.

## The Forge

After choosing a hero, the rack offers fourteen free basic weapons. Bubble Wand opens in story chapter 3 and Pinecone Yo-yo in chapter 4. Both friends can use every open weapon. Beyond the two tier-one compatibility tools, Bonk and Dizzy follow the content stats and tier multipliers. At the Forge, choose Dora or Enzo before clicking a rack tool; the buddy remembers their own equipment when you switch leaders.

The rack and weapon tab show a live 3D preview of the selected friend holding their equipped tool, drawn at ten frames per second while the menu is open and disposed on close. The weapon tab shows a left-to-right tree: basic, tier 2, branches A and B at tier 3, tier 4, then Glimmer. A node can be crafted only from its direct parent, with the exact materials shown. Tier 2 takes 3 bristle tufts and 2 berries (wart pebbles for Wand and Yo-yo). Tier 3 takes 4 branch commons and 1 part; tier 4 takes 3 branch rares, an icy mane lock and a glimmer stone. Glimmer takes 2 frost fur, 2 mane locks and 2 glimmer stones, keeps both branch perks and heals both friends by 10 Fluff every tenth connecting hit. Bramble cheers for one second after crafting.

**Moves:** J bonks or shoots with the equipped tool. Hold K and release for a big swing, shot, Poof or Focus Spin. Tap K for a shield bash, a Swish Counter window, Spade/Bloom or Seedpod mode, a horn song, a firefly glow, or an ammo change with the bow and slingshot. Holding K guards with the Greatsword, Lance, Puffcap, Seedpod shield or Pumpkin shell. A K tap under 0.2 seconds uses a signature; releasing a longer guard only ends the guard. Hold J+K, then release K for Big Finish, Big Poof or a timely Lance Counter Boop. Touch uses Bonk and “Hold · big” together for these moves. Slingshots reload with a roll. Hold J for at least 0.35 seconds with the Staff to vault; hold K standing still with the Pumpkin for its Flurry. Tool meters appear below the Fluff bar. Loop-the-Loop with the Yo-yo starts Hop-on when it connects with a dizzy or sap-stuck beast.

**Armour:** the armour tab makes a helm, vest or boots from any of the five sets. Each costs 3 beast commons and 1 part (helm/boots) or rare (vest). Click an owned piece to wear or remove it; pieces may be mixed. Bristle adds 10 Fluff per piece, Puffwart 8, Skreel 7, Hornclack 12 and Frostmane 10. Two matching pieces activate their first skill, three add the second: reduced push / charge protection, weaker sleepy clouds / faster item recovery, longer roll dodges / an extra roll, side guarding / head Dizzy, or distant Fluff regeneration / one half-Fluff recovery from tuckered out. The Forge lists active skills. Caps, vests and boots are small coloured toon accessories.

Weapon geometry is ported from `docs/grumble-hunt/look-test/main.ts.txt` into `lib/grumble-hunt-weapons.ts`, with the original hammer pose and transformed handle grips. The first hammer, claws and bow icons use `icons-gear.webp`: there is no `icons-weapons-1.webp` in this checkout. Lance, Wand and Yo-yo use sheet 2; the other types use sheets 3–5. The gear sheet contains Bristle and Puffwart armour icons, reused for the other sets alongside their explicit names.

## Hop-on

Only the leader rides; the buddy keeps its own ground position, equipment and bonk AI. A beast may be ridden **twice per hunt**. It stays still and starts no attacks while ridden, including grounded dizzy Skreel.

**Getting on.** Release K for the Pinecone Yo-yo’s Loop-the-Loop: its connecting hit starts a ride on a dizzy or sap-stuck beast within **4 units**, multiplied by 1.2 with Wide Loop. Any weapon can instead roll off a rock; the Firefly Staff can vault after holding J for **0.35 seconds**. At jump start the leader must be within **0.6 units of the rock’s radius** (absolute distance from its edge). Movement input must have length at least **0.1**, point away from the rock’s centre (positive dot product), and project a landing **2 units** along its normalized direction. The dizzy or sap-stuck beast must be within **3 units of that landing**. Sprint is optional. A soft “hop!” ring previews an outward jump towards the beast when that rule is available.

**Bonking and holding on.** The HUD has three pawprint pips and a five-tap meter. Each fresh **J press** adds one tap; holding J adds no more. **Five taps** make a full bonk and a “Boop!” cue. Each full bonk lowers Grump by an ordinary bonk of the equipped weapon at its tier (including the normal dizzy ×1.7 bonus), and builds the part meter as usual. Hold **K** through the warning and the buck to grip, at no stamina cost. Touch uses Bonk taps, “Hold · big” to grip and Roll to hop off.

The first warning starts **1.2–1.6 seconds** into the ride. Every buck warns **0.65 seconds** ahead with a tense squash, orange shake mark, sound and “Hold on! (K)”. Bucks last **0.3 seconds**, or **0.5 seconds for Frostmane**. Subsequent buck starts are **1.6–2.6 seconds** apart, from the seeded generator. Letting go during a buck gives a soft landing, **1 second of invincibility**, no Fluff loss, and leaves the meter visible in engine state until another ride or hunt reset. Roll hops off freely at any time. A new ride starts with an empty meter.

**Time and plop.** The ride ends when the current dizzy / sap timer ends or after **8 seconds**, whichever comes first. Boarhog Spinner’s Long Hop adds **2 seconds** to both the cap and the current dizzy / sap duration at entry. Three full bonks make a **plop**: +30 Dizzy, a fresh **3.2-second** dizzy opening, a seeded part chance of `min(1, part / (maxGrump × 0.32))` if the part has not already popped, and **2 commons** chosen uniformly from that beast’s calm-drop commons through the seeded generator. The plop adds no extra Grump reduction. The beast tips sideways with stars, the leader hops off, and the result card remembers the plop reward. All ride state resets at village, camp, nap or tuckered out; rides are not saved; permanent progress now uses `grumble-hunt-v4`.

## Story mode · The Grumble Wind

Old Mossback sends Dora and Enzo after the cold, cranky wind. The hunt board follows the six chapters in `STORY`: **0 · A Grumpy Morning**, **1 · The Huffy Hog**, **2 · Snores in Soggy Marsh**, **3 · Swoops over Windy Ridge**, **4 · The Stubborn Beetle**, and **5 · The Frosty Peak**. The first chapter that has not cleared is the current chapter. The tutorial Bristleback calf has **40 Grump**, is drawn at **55% size**, and starts no attacks for its first **20 seconds**. Its small fenced paddock has a twelve-unit walking radius.

Painted intro pages play before the chapter's hunt. Its first nap opens the outro before the reward card. Tap the painting or paper, press **Enter** or **J**, or use Next page; **Skip** skips the whole scene. The Beast Book's **Story** list replays seen intros and outros. Frostmane's outro mends the Glimmer Stone, followed by **The End · free hunt is open**.

The Forge opens after the calf; the Bristle armour set opens after chapter 1. The Pantry and snacks open when chapter 2 begins, gathering and the Bubble Wand in chapter 3, and traps and the Pinecone Yo-yo in chapter 4. Other armour sets open with their beast's chapter. Basic tools can be chosen at the initial rack. Locked recipes and tools carry chapter hints. Free hunts remain open for beasts already met, including after the ending.

Frostmane already has three phases, retained here: above two thirds Grump it pounces and rests **2.0 s**; below two thirds it alternates pounces and mane shakes and rests **1.7 s**; below one third its pattern is pounce, pounce, shake and its rests shorten to **1.4 s**. Pounce bumps add the phase number to 17 Fluff. Every new attack warns for **0.9 s**, or **0.8 s** while enraged, safely above the 0.6-second minimum.

Old Mossback is a moss-shelled tortoise with glasses and a walking stick at the hunt board. Bramble is an apron-wearing hedgehog at the Forge; Pip is a round-eared degu with a scarf at the Pantry; Wren is a small bird with a note satchel at the Beast Book. They are built in `lib/grumble-hunt-villagers.ts` from toon primitives baked into a few merged, vertex-coloured meshes each (body, head, face details, eyes and moving limbs), about 11 draw calls per villager. They breathe, blink and look about, and lean in and wave near the leader; use **F** at their station or its camp button to open their panel. Wren's Beast Book links to the bounty board.

## Areas

Each hunt uses its chapter area, or `HUNT_AREA` on a free hunt. Collision tables use tree, pine and rock obstacles; the meadow's original thirty-obstacle seeded layout is unchanged. The four other wilderness layouts are fixed tables with clear centres. All use the same camera, movement and world-building code.

| Area | Drawing |
| --- | --- |
| Village paddock | Small wooden fence, meadow ground and the smaller calf |
| Clover Meadow | Original painted grass, dirt, trees and boulders |
| Soggy Marsh | Mud, lavender fog and sky, shallow water, lily pads and painted reeds |
| Windy Ridge | Slate, bright sky, bent pine trunks and conical crowns, standing stones and flags |
| Pebble Hollow | Sand, warm canyon sky, stacked boulders, crystal nubs, burrows and mushroom cards |
| Frosty Peak | Snow and ice, winter sky, snowy firs, ice spires, split Glimmer Stone shrine and eighty instanced falling sparkles |

Area ground, sky and card textures are disposed when switching, including late loads. Shared meadow textures are retained for camp. Snowfall and villager bobbing respect reduced motion. Browser metrics expose the area and visible villager count.

## Post-game

The ending unlocks **Extra Grumpy variants** on the hunt board: **×1.6 Grump**, **×2 rare-roll probability** (capped at 100%), and a new coat colour. The colours are blond Bristleback, blue Puffwart, lavender Skreel, peach Hornclack and rose Frostmane. The usual below-30% enrage still applies, with its 15% pace increase and 0.8-second warning. Variants use the ordinary beast's material table and can still benefit from Lucky Seed Bun's extra roll.

**Wren's bounty board** offers three distinct tasks from a pool of ten: a nap without items, Bristleback tusks, Puffwart sac, Skreel crest, Hornclack horn cap, Frostmane mane, a nap without a bump, three gathering spots, three dizzy openings, or any lovely nap. Checks use actual hunt facts, including the buddy's gathering. Tasks are checked when the beast naps. Each claim gives **3 berries, 2 bristle tufts and 2 wart pebbles**, subject to pouch caps, once per task that day. Ready and claimed tasks persist across reloads. These are optional favours; no story progress requires them.

The page passes a local-calendar `YYYY-MM-DD` string to the engine and updates it at midnight (checked once a minute). A separate date-seeded shuffle picks the same three tasks for the same date without advancing hunt randomness. Changing the day clears ready and claimed tasks. Browser checks can set a fixed date with `window.__hunt().game.setBountyDay(...)`.

## Controls and accessibility

| Input | Action |
| --- | --- |
| WASD / arrows | Move relative to the camera |
| Shift | Sprint |
| J | Bonk / shoot |
| Hold K, release | Charge a big bonk / shot |
| Space | Roll |
| Tab, with the meadow focused | Toggle lock on, when let go |
| Q / E | Previous / next item in the ring |
| Hold Tab, tap Q / E | Change the buddy’s order |
| F | Gather at a nearby spot, otherwise use the item; at camp, talk to the shopkeeper in reach (a speech bubble shows who) to open their place |
| Drag / scroll | Orbit / zoom camera |
| P / Escape | Pause; Escape also closes a panel |
| M | Toggle sound |

Touch has a joystick and Sprint, Roll, Lock, Bonk/Shoot and Hold · big buttons. The item ring, the Gather button and the buddy order button are tappable. Short action taps are buffered until an engine step processes input, including through hit-stop. A cancelled charge is cleared without releasing a shot. Blur, page hiding, pointer cancellation, and lost pointer capture release held controls. Hiding or leaving pauses a hunt and saves gathered progress. UI buttons retain ordinary Tab navigation; Tab locks when the meadow or body has focus, including Shift+Tab while sprinting. Pouch and sound buttons return focus to the meadow during hunts. Losing WebGL context pauses only an active hunt; restoring it clears the pause.

The field guide is always available, panels trap focus, buttons have visible focus rings, and reduced motion removes shake, trails, wind and extra dust. Sound begins only after a gesture, has its own persisted mute choice, and uses short quiet synthesised cues. Main arcade navigation remains available.

## Post-game weapons

Four more Grumble Hunt originals open after the story ends (chapter 5 cleared), each through its own goal. Until then the rack and Forge show a locked card with the goal and progress, for example "Complete 5 bounties · 2/5".

| Weapon | Speed | Tier 1 Bonk / Dizzy | Unlock |
| --- | --- | --- | --- |
| **Tickle Feather** | fast | 3 / 6 | Claim **5** of Wren's bounties (counted across days) |
| **Dandelion Puffer** | medium | 4 / 7 | Calm each of the **five** Extra Grumpy variants once |
| **Pogo Spring** | medium | 8 / 5 | **10** Hop-on plops in total |
| **Leaf Umbrella** | medium | 6 / 5 | The Beast Book shows every part broken on all **five** beasts |

- **Tickle Feather.** Each leader hit fills the **Giggle** meter by 12 (15 on a beast that's already dizzy). At 100 the beast giggle-dizzies for **3 s** and the meter empties. A K tap is a double-tickle flurry: one swing that lands twice. Branch A perks fill Giggle 25% faster.
- **Dandelion Puffer.** J blows a cone **3.5 units** long and **60°** wide. Fluff clings to the beast and adds **2 Dizzy per second for 3 s**; another puff refreshes the time but doesn't stack it. Hold K past 0.35 s and release for a **Big Breath**: a 120°, 4.5-unit gust that adds **+15 Dizzy** and pushes the beast back **2.5 units**, stopping short of trees, rocks and the arena edge, then a **6 s** recharge. While it recharges the seed clock visibly thins out. Branch A widens the cone 25%; branch B makes fluff cling 1 s longer.
- **Pogo Spring.** J is a hop-bonk that steps 0.6 units forward. Hold K past 0.35 s and release for a **High Bounce**: about **0.8 s** in the air, landing with a bonk from above (×1.6) that also reaches a flying Skreel. Landing within **2.5 units** of a dizzy beast starts a Hop-on directly, inside the usual limit of two rides a hunt. (Beast bodies keep paws 1.85 units away, so 2.5 is "right beside it".) Branch A bounces higher and pulls loose materials in.
- **Leaf Umbrella.** Holding K opens the umbrella: it guards **from every side** at **half** walking speed, using the normal guard rules and stamina. While it's open, a J tap is a **Raindrop Spin** that hits everything within **3 units**. After a roll the umbrella floats you down; holding K makes the float last twice as long. Branch A's spin gives the buddy 5 Fluff; branch B's first 0.5 s of guard costs no stamina.

Each has the usual tree: tiers 1–2, branch A (Frostmane materials) or B (Hornclack) at tier 3, tier 4, and the Glimmer tier 5 with Warm Glow. Tier 2 costs 3 frost fur, 2 shell plates and 2 bristle tufts; the higher tiers are priced like every other tree. Their single-hit numbers sit inside the existing weapons' range and scale by `TIER_MULT`. The buddy can carry any of them and uses J only. Buddy hits never touch the leader's Giggle meter.

## Saving and architecture

- `lib/grumble-hunt-content.ts`: materials, drop tables, gathering, Pantry recipes, snacks and the story chapters, as data.
- `lib/grumble-hunt-game.ts`: seeded deterministic rules, no DOM or Three.js. Fixed steps are 1/60 second; the page bounds catch-up after a slow frame.
- `lib/grumble-hunt-scene.ts`: Three.js drawing, camera, posed tools, chunky beasts, texture loading, effects, and disposal.
- `lib/hunt-chinchilla.ts`: the dedicated existing hunt model, used unchanged. Shared chinchilla modules are unchanged.
- `app/hunt/page.tsx`: input, hydration, loop, HUD, panels and storage.
- `app/hunt/sound.ts`: gesture-unlocked synthesised cues and audio cleanup.

Permanent progress is saved under `grumble-hunt-v5`: selected hero, all weapon tiers and branches, each friend's equipped weapon, owned and worn armour, pouch, ring, packed snack, nap counts and hunt count. It adds `story: { chapter, scenesSeen }`, `beastBook` entries (`met`, `napped`, `partsBroken`), `bounties: { day, done, ready }` and `extraGrumpyUnlocked`. The extra `ready` list keeps unclaimed completed daily tasks across reloads. v5 adds the post-game counters `bountiesClaimed`, `variantNaps` (per beast) and `totalPlops`. A v4 save starts `bountiesClaimed` at the tasks claimed that day and the others at 0; broken parts already in the Beast Book carry over.

The page reads v5, then v4, v3, v2 and v1. Old nap counts clear matching chapters, with chapter 0 cleared if any beast napped; the first remaining chapter is current. Matching old scenes count as seen, including chapters beyond a gap. Equipment and pouch carry over unchanged from v3; v2 and v1 retain the earlier level and material migrations. The loader validates versions, numeric ranges, known scene/part/task identifiers, arrays and booleans. Reloading returns safely to camp. The final bonk saves progress before the nap animation ends. Sound still uses `grumble-hunt-sound-v1`; `window.__hunt()` exposes `{ game, refresh, metrics, input }` for checks.

## Drawing and resource budget

The scene uses `MeshToonMaterial`, the 96/178/255 three-step ramp, `OutlineEffect`, and `NoToneMapping`. Ground, sky, foliage, effects and instanced grass disable outlines. The existing paintings are unchanged: repeating grass and dirt ground, bark trunks, rock boulders and Bristleback fur; the equirectangular sky; billboard leaf clusters, transparent grass tufts and 5,000 instanced grass blades. Trunks, leaf cards and solid canopy shapes are each batched into one instanced draw, and so is Enzo’s pawprint trail, a canvas-drawn print with a soft glow. Extra Grumpy steam is six small puffs on the beast’s head; its eyebrows have their own material so they can turn red. The ref sheets guide the five 3D models and appear in the Beast Book.

The page draws single cells of the painted atlases as CSS backgrounds (`Art` in `app/hunt/page.tsx`). The hero picker shows each friend’s happy portrait. The HUD portrait changes with play: dizzy during the 1.4-second recovery after a bump, sleepy below 30 Fluff, determined while swinging or charging, and happy otherwise. The Forge draws each tool’s three tiers from `icons-gear.webp` (cells 0–2 for the hammer, 6–8 for the bow), greyed until reached, and lists the satchel by beast with icons from `icons-materials.webp`. The Beast Book uses the same material icons. The pouch keeps text labels: Dizzy dust and Pep seed have no matching icon yet. The expansion art (story panels, area skies, ground tiles and foliage cards, villagers, and weapon sheets 2–5) is in `public/art/hunt/` and logged in [`grumble-hunt-story-art.md`](grumble-hunt-story-art.md) and [`grumble-hunt-weapon-icons.md`](grumble-hunt-weapon-icons.md); the expansion build will connect it.

The camera orbits above flat walkable terrain, keeps a minimum height, and shortens its distance when a trunk, rock or village building would clip the view. A tree crown near the camera, or across its view of the leader, shrinks away over 0.2 seconds and grows back afterwards, so leaves never fill the screen; the camera doesn't move in for crowns. Desktop resolution is capped at 1.5 device pixels with 1024-pixel PCF shadows; touch devices use a 1.25 cap and 512-pixel basic shadows. Tiny facial features do not cast shadows, and there are no postprocessing passes beyond outlines. Projectiles, drops and extra dust use bounded mesh pools. Weapon trails, squash/stretch, a small camera shake and 0.08–0.11-second hit-stop give bonks weight.

On exit, the page cancels its animation frame, removes keyboard, focus, visibility and context listeners, disconnects its resize observer, and closes audio. The scene disposes geometries, materials, loaded textures, shadows, render lists and renderer/context; late texture callbacks also dispose their result. Phone browser emulation and rendering budgets can be checked automatically; actual mid-range phone hardware still needs a device play-test.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:grumble-hunt
npm run bot:grumble-hunt
# With npm run dev running and Playwright installed locally:
npm run test:e2e:grumble-hunt
npm run test:e2e
```

The engine suite covers determinism, warning time in all phases, armour, air/ground openings, tool timing, charged shots, cancelled inputs, dizzy multipliers, crashes, rolls, items, sleepy clouds, buddy healing, collisions, pop-offs, reward idempotency, unlocks, upgrades, safe camp returns, malformed saves, Extra Grumpy timing and speed, sniff sight and trails, and buddy orders. The bot uses only movement/actions and collected materials, plays twelve seeds as each hero, keeps one buddy order per seed so all three are played, and must calm all 120 beasts, each of them going Extra Grumpy on the way. On the initial 24-10-2026 curve it calmed 120/120, with a median hunt of 20.7 seconds and slowest 35.0 seconds.

The browser suite follows the repo’s Playwright style and writes its village, five hunt, dizzy, nap, phone and victory screenshots to ignored `.checks/hunt/`.

### Run results · 24-10-2026

- `npm run typecheck`, the complete `npm test` suite, and `npm run build` passed.
- The Grumble Hunt browser suite passed all functional, campaign, saving, desktop, touch, portrait/landscape, attack-animation and cleanup checks. Screenshots were inspected for the village, every beast, dizzy, nap and victory.
- A 390 × 844 touch viewport at DPR 3 (capped internally at 1.25), with 4× CPU throttling, used 279 draw calls, 114,774 triangles, and 13 textures in the sampled frame. Chromium reported **SwiftShader**, a software GPU. It produced nine frames in the two-second sample, with a 216.6 ms median frame interval. This verifies bounded rendering and continued drawing under emulation; it does **not** establish an acceptable frame rate on physical mid-range phones. A hardware phone play-test remains outstanding.
- The broader `npm run test:e2e` command passed Classic Pit and the arcade navigation/count checks, then stopped in the existing `tests/e2e/checkpoint.mjs:54` on a 15-second `NEXT IN LINE` click timeout. That game and its test are unchanged by this work; subsequent suites in that chained command did not run. The new hunt suite was run separately.
- Playwright was installed only for local browser checks. No Playwright dependency or lockfile change is included.

### Review fixes · 24-10-2026

- Added regressions for HUD focus, sprint lock-on, hit-stop taps, cooldown charge display, graphics context recovery, dizzy chains, lane endpoints, airborne buddy hammer hits, distant camp drops and one-time unlock results.
- `npm run typecheck` and all 23 `npm run test:grumble-hunt` checks passed. The bot still calmed 120/120 beasts across 24 full campaigns; the revised median was 23.1 seconds and slowest 35.8 seconds.
- Browser regressions were added and syntax-checked, but this sandbox could not launch Chromium (`Operation not permitted`). The dev server also could not write its Vite config cache through the read-only linked `node_modules`. The browser suite needs a run outside this sandbox.

### Alive hunts · 24-10-2026

- Added Extra Grumpy, Enzo’s sniff trail and buddy orders, the first step of the expansion in [`grumble-hunt/expansion-design.md`](grumble-hunt/expansion-design.md).
- `npm run typecheck`, all 27 `npm run test:grumble-hunt` checks and the content checks passed. The bot calmed 120/120 beasts across 24 full campaigns, 40 per buddy order, with a median hunt of 23.0 seconds and slowest 47.6 seconds; the slowest hunts are the Gather campaigns, where the buddy never bonks.
- The browser suite passed with a new check for the buddy-order keys and button, the pawprint trail and Extra Grumpy steam, saving `sniff-trail.png` and `extra-grumpy.png`.

### Painted icons and portraits · 24-10-2026

- Brought in the final art from `codex/grumble-hunt-art` (`cecaa4f`), `codex/grumble-hunt-story-art` (`07d6bff`) and `codex/grumble-hunt-weapon-icons` (`88c62a7`, with the chinchilla engravings on sheet 3). All 48 files decode at their logged sizes; every atlas has transparent, opaque and soft alpha, its occupied cells match its cell map, and no drawing touches a cell border.
- The browser suite has a new check that the portraits, tool tiers and satchel icons load, follow the upgrade level and material counts, and that the HUD face follows Fluff and bumps.

### The Pantry · 24-10-2026

- Added the Pantry, gathering spots, eight craftable items, the six-item ring and four snacks, the second step of the expansion. Beasts drop their own materials from the content drop tables, the save moved to `grumble-hunt-v2` with v1 migration, and the old dizzy dust and pep seed are gone.
- `npm run typecheck`, all 40 `npm run test:grumble-hunt` checks and the content checks passed. The bot, which now crafts fluffberries from gathered berries before each hunt, calmed 120/120 beasts across 24 full campaigns, crafting 56 fluffberries, with a median hunt of 24.8 seconds and slowest 90.5 seconds.
- The browser suite has a new check for v1 migration, crafting, the ring, a packed snack, F gathering, the sap puddle, smoke, drop icons and a stuck beast, saving `pantry.png`, `gathering.png`, `sap-smoke-drop.png` and `stuck.png`.

### Forge run results · 24-10-2026

The Forge work passes **61 engine checks** and the expansion content checks. It adds engine checks for every tree path, exact payments and prerequisites, free swapping, equipped buddy weapons, v1/v2 migration into v3, strict equipment loading, armour sets, guards, counters, Focus/Bloom/seedpods, firefly glows, songs, Warm Glow, sleepy puffs, reloading and Poof recovery. The original hammer and bow timing checks still pass; the old pooled-material upgrade test is replaced by exact tree-cost checks.

All seven suspected engine issues were confirmed with small scripts and fixed: Staff taps incorrectly vaulted, a hero vault reached a melee buddy, buddy double bubbles counted as hero hits, distant Swish Counters landed, buddy bubbles fell short, Spade hits filled Bloom, and three of four pods triggered Dizzy. Regression checks cover each, along with final-bonk mist, camp resets, tier power, migrations, guard controls, buddy shot ownership and two quick item uses. Item recovery now animates a short nod without blocking another item; Deep Breath halves that animation.

Browser checks were updated for reopening Weapons after an Armour visit, the weapon rack, tree prerequisites and payment, armour crafting and v3 persistence, and syntax-checked. Chromium was not run, as required; model appearance, handle alignment, phone layouts and the anvil animation still need a browser review.

Forge bot: **24 full campaigns, 120/120 beasts calmed**, 24 of each beast and 40 with each buddy order; every hunt needed one attempt (limit six). It bought 16 tree upgrades and 72 armour pieces, and crafted 56 fluffberries. Median hunt **29.8 s**, slowest **155.9 s**. The content planner also checks all fourteen basic paths across 40 seeds; no chapter needed more than two earning hunts.

Validation: `npm run typecheck`, `npm run test:grumble-hunt`, `npm run bot:grumble-hunt` and the full `npm test` suite passed. Browser test syntax and `git diff --check` passed; the local Graft graph was rebuilt. No commit or push was made.

### Hop-on run results · 24-10-2026

Step 4 adds **70 engine checks total**, including connecting Yo-yo entry, outward rock rolls and Staff vaults, rejected jumps, tap edges, held J, all five beasts’ buck warnings, free grips, gentle shake-offs, plop rewards and part chance, a plop that also calms, two-ride limits, Long Hop, dizzy expiry, the eight-second cap, seeded replay, safe camp / nap / village resets, and releasing grip after hopping off. The result card remembers plop rewards. No save migration or Story mode change is included.

The bot uses the earned Yo-yo unlock on later hunts, takes available rock jumps, taps while riding and grips through bucks. It calmed **120/120 beasts in 24 campaigns**, with **96 rides and 96 plops**, all 120 beasts becoming Extra Grumpy, 24 of each beast and 40 with each buddy order. It crafted **56 fluffberries**, bought **26 tree upgrades** and **72 armour pieces**, and needed **one attempt per hunt**. Median hunt **29.8 s**, slowest **112.0 s**.

`npm run typecheck`, `npm run test:grumble-hunt`, `npm run bot:grumble-hunt` and the full `npm test` suite pass, including the README consistency check. The browser suite adds a real keyboard Yo-yo ride, five J taps, the HUD pip and grip prompt, metrics and a free roll off, with screenshots at `.checks/hunt/hop-on-rider.png` and `.checks/hunt/hop-on-hold-on.png`. Its JavaScript syntax was checked; Chromium was unavailable, so this browser check and its screenshots have **not been run or captured**.

### Story mode run results · 24-10-2026

Step 5 adds chapters 0–5, story pages and replay, the tutorial paddock, four wilderness areas, four village figures, post-game variants and Wren's daily tasks, with v1/v2/v3 migration into v4. The engine suite now has **80 checks**, including tutorial timing, chapter gates and progression, per-area layouts, variants and rare chances, all ten bounty checks, one-time claims, strict new save fields, migration and seeded story replay. Existing content checks continue covering recipes, tree costs, branch perks, armour and earning paths.

The existing bot calmed **120/120 beasts in 24 campaigns**, with **96 rides and 96 plops**, all 120 beasts becoming enraged, **48 fluffberries crafted**, **12 upgrades** and **71 armour pieces**. Median **29.8 s**, slowest **111.0 s**. The new story bot completed **144/144 chapters in 24 campaigns**, bought **11 upgrades** and **72 armour pieces**, with median **27.8 s**, slowest **143.9 s**. Both needed **one attempt per hunt**, below the enforced six-attempt limit. Bots buy the cheapest affordable next tool node and armour from earned materials; gathering-order campaigns also earn berries for upgrades. No gear or pouch materials are injected into the story bot.

Browser checks were added for intro/Enter/Skip, the paddock calf and outro, four visible village figures, each wilderness area with screenshot destinations, a fixed-date three-card bounty board, variant colour, v3 migration and scene replay. Existing browser fixtures explicitly set story progress through `window.__hunt()`. Browser JavaScript is syntax-checked. **Chromium was not run; new screenshots and visual/frame-budget checks remain unverified.**

Validation: `npm run typecheck`, `npm run test:grumble-hunt`, `npm run bot:grumble-hunt` and the full `npm test` suite passed. Browser-test syntax and `git diff --check` passed. The local Graft graph was refreshed; no commit or push was made.

### Post-game weapons run results · 25-10-2026

Step 6 adds the Tickle Feather, Dandelion Puffer, Pogo Spring and Leaf Umbrella, their trees, unlock goals and the v5 save. The engine suite has **89 checks**, adding each unlock and its progress count, Giggle filling and giggle-dizzy, fluff over time without stacking, Big Breath's push stopping at a rock and its recharge, High Bounce reaching a flying Skreel and landing into a Hop-on within the ride limit, the umbrella guarding from four sides at half speed with its spin and slow float, v4 → v5 migration and seeded replay of all four. The tree-tier check covers them for the leader and the buddy.

The bot now adds a post-game run: after each story campaign both friends carry each new tool and calm all five Extra Grumpy beasts. All **120/120** hunts per tool ended in a nap (tier 1 tools, no upgrades): Feather median **61.6 s**, slowest 115.6 s; Puffer median **161.5 s**, slowest 325.4 s; Pogo median **101.0 s**, slowest 290.6 s, with **240 Hop-ons** from High Bounces; Umbrella median **104.5 s**, slowest 282.9 s. The story bots are unchanged (120/120 beasts, 144/144 chapters).

The browser suite checks the four locked cards' progress text, unlocking, the Forge preview of each tool, both icon sheets loading, and a short hunt with each tool under 400 draw calls, with screenshots under `.checks/hunt/postgame-*`.

The tier icons are hand-painted into the free cells of `icons-weapons-5.webp` and the new `icons-weapons-6.webp`; the prompts are in `docs/grumble-hunt-prompts/9-new-weapon-icons.md` and `docs/grumble-hunt-weapon-icons.md`.
