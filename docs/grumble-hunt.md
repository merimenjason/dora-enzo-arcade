# Grumble Hunt

Built 24-10-2026 as game 39, at `/hunt`, from `grumble-hunt-base`. This is the reference for how the game works now; the **History** section at the end lists when each part arrived.

## A gentle adventure

Choose Dora (white chinchilla) or Enzo (grey chinchilla), then pick a weapon at the rack. Their starting suggestions are the Acorn Hammer and Seed Bow. The other friend follows, helps bonk, and tosses a berry for 28 Fluff when the leader has 45 Fluff or less, with a ten-second berry cooldown. The buddy never loses Fluff.

Clover Camp has four stations, reachable on foot with F or through the camp buttons: the Forge, hunt board, Beast Book and Pantry. Old Mossback’s hunt board follows story chapters 0–5. Friends already met remain available for free hunts, including after the ending. New game asks for confirmation and resets only this game.

Each hunt uses its chapter’s area, with trees, pines and rocks; the original meadow keeps its seeded layout. There is no time limit. Bonks lower Grump. At zero, the beast folds its legs and curls up, rests for a moment, and goes to the sanctuary. Beasts are never hurt.

## The beasts

Five beasts carry the story, and two more arrive after it (see **Post-game beasts**).

| Beast | Starting Grump | Movement and openings | Material | Pop-off part |
| --- | ---: | --- | --- | --- |
| Bristleback | 420 | Paws the ground, charges a marked lane, becomes dizzy after a tree or rock crash | Bristle tufts | Tusks |
| Puffwart | 440 | Hops, flicks its tongue along a lane, or blows a sleepy cloud; bonk between moves | Marsh beads | Warts |
| Skreel | 400 | Circles in the air, swoops along a lane, then lands for a 4.5-second rest | Sky feathers | Crest |
| Hornclack | 560 | Its front shell blocks bonks; circle to the sides or back. Sweeps its horn and charges | Shell buttons | Horn cap |
| Frostmane | 840 | Pounces in mood 1, adds an icy mane shake in mood 2, and favours quick pounces in mood 3 | Frost fluff | Mane tufts |
| Paddlepaw (post-game) | 700 | Belly-slides down a marked lane (a tree makes it dizzy), splashes three water lanes, hops | Otter fluff | Pebble pouch |
| Rumblesnout (post-game) | 760 | Burrows under an orange circle and pops up inside it, sweeps, charges | Striped fur | Pebble crown |

Charges and swoops stop at the end of their 12-unit marked lane. The final-hunt unlock banner appears only on the result that earned the third different nap.

Every attack, including each Mighty move and Rumblesnout's burrow, has a **0.9-second** wind-up (0.8 seconds when Extra Grumpy) and an orange ground marker. Frostmane changes mood below two-thirds and one-third Grump; its later rests become shorter. The mane shake pushes the leader away. A sleepy cloud lasts five seconds and slows movement while inside; it never lowers Fluff.

At tier one, Dizzy builds from two big hammer bonks or big bow shots; buddy bonks help a little. Hits during dizzy do not build the next dizzy. A crash or dizzy dust also makes a beast dizzy, providing at least three seconds of opportunity. Bonks during dizzy are 1.7 times as large. Hornclack’s front shell is open during dizzy. Dora’s hammer reaches Skreel when it is low; the bow can reach it in the air.

## Paws, tools, and treasures

The leader has 100 Fluff. Ordinary bumps have a 1.4-second recovery window. A roll lasts 0.46 seconds with a dodge window for its first 0.32 seconds; another roll is available after 0.85 seconds. At zero Fluff the leader is tuckered out, returns to camp, and keeps all materials, including drops still in the meadow. Retrying is immediate, with full Fluff and the fluffberries topped back up to three. There is no other penalty.

Dora’s ordinary hammer bonk is 14 Grump, a charged swing 27. Enzo’s seed shots are 9 or 20. Once the tool cooldown ends, hold K for at least 0.35 seconds and release for the big version. The HUD shows tool recovery and reports a big bonk or shot ready only after 0.35 seconds of actual charge. While K is held, `game.hold()` says what it is doing: guarding (guard tools), a charge with one level (0.35 s) or two (0.35 and 1.0 s, Hammer and Bow), or a signature that fires on release. The scene rings the hero with 18 petals that fill towards the last level, bursts a ring and plays a chime as each level is ready, and pulses once the charge is full. The hero crouches and trembles, the tool draws back, and a meter under the hero names the release. Guarding shows a leaf-green bubble and a stamina bar, and lifts the shield. Weapon trees scale Bonk by ×1, ×1.3, ×1.65, ×2.1 and ×2.4. Every tier scales the original hammer’s 14 / 27 quick-swing Bonk; a full charge starts at 28.8. Hammer tiers 2 and 3 use ×1.35 / ×1.70, and bow tier 2 uses ×1.32, preserving old save power. Charged Hammer and Bow Dizzy starts at 50 and scales at every tier. The tier-one bow keeps 9 / 20 total Bonk and timing, sharing a charged shot across two or three seeds. Buddy bonks are smaller and less frequent. Each toy is built around its handle, with the group origin at a paw grip. `hold` places it so the grips sit under the chin, and long blades rest back over the right shoulder, leaning out past the head. Each rest pose was chosen by `.checks/clip-search.mjs` (a git-ignored lab script) to keep the toy out of the head, ears and body fluff across idle, charge, swing and guard; the hammer swings in a plane tilted 0.45 rad outwards and winds up to 1.3 rad, so it passes beside the right ear. The slingshot and bow rest upright in one paw at the right side and the pumpkin cannon hangs by its stalk at the left, out past the body's outline so the camera behind the hero can see them. Upgrades show on the toy: `decorateHuntWeapon` builds each tier's marks once (tier 2 a band or binding, tiers 3–4 gold trim plus one or two motifs in the colour of the branch's beast, tier 5 an amber Glimmer stone with a soft halo) and `setLook(type, tier, branch)` switches them, called every frame from the scene with `game.node(weapon)`. `poseArms` runs after each pose so the paws track the handles, and `keepInReach` slides a toy towards the shoulders if a grip would sit more than 0.42 from one. Thrusts and jabs step the body forward rather than stretch the arms.

Each beast has its own materials, from the drop tables in `lib/grumble-hunt-content.ts`. Every connecting bonk has a 20% chance to shed one of the beast’s common materials (10% for Hornclack’s shell plate). At 32% of a beast’s initial Grump bonked away, its part pops off once and drops its part material: a tusk shard, a puff sac (Puffwart’s throat sac deflates), two sky feathers, a horn chip or an icy mane lock. A nap rewards three commons from the beast’s list plus a 25% roll for its rare material (50% for Frostmane’s glimmer stone); the result card shows what you got. Walk within 2.6 units to pick up a drop; calming or getting tuckered out collects every drop still in the meadow. Drops float as their painted icons.

The Beast Book shows each reference picture, sanctuary status, home area, pop-off part, tips and the beast’s materials in your pouch.

## Alive hunts

**Extra Grumpy.** The first time a bonk takes a beast below 30% of its starting Grump, it turns Extra Grumpy for the rest of the hunt: steam puffs from its ears, its eyebrows go red, the HUD says so, and a low cue plays. It moves 15% faster (roaming, circling, charges, swoops, hops and pounces) and its wind-up is 0.1 seconds shorter, 0.8 seconds, so every attack still warns well over 0.6 seconds ahead. Grump, damage and materials are unchanged.

**Roars and name cards.** Each beast has a title (Bristleback, the Bristly Charger; Puffwart, the Puffy Pond Toad; Skreel, the Swooping Sky Crest; Hornclack, the Shell-Horned Wanderer; Frostmane, the Snowy Mane of the Peak), shown in the Beast Book. Outside the paddock, the first wind-up of a hunt that starts while a friend is in sight is a **roar** instead of an attack, and so is the first wind-up after turning Extra Grumpy. It warns like any attack: the normal wind-up (0.9 seconds, or 0.8 when Extra Grumpy) with a large orange circle of radius **7**. The roar lasts **1.1 seconds**, with a screen shake, the beast puffing up and three sound rings rolling out. **0.2 seconds** in, a leader inside the circle who isn't rolling, guarding, invincible or in the air covers their ears for **0.9 seconds**, unable to move or act, but loses no Fluff. A buddy inside it waits 0.9 seconds before its next bonk. The first roar of each hunt shows a **name card** (painted portrait, name and title) for **3.2 seconds** of hunt time without pausing play. The hunt's attack pattern then continues where it was.

**Weather.** Each wild area has its own weather: rain showers in the meadow and marsh, mist on the ridge, dust storms in the hollow and blizzards on the peak; the paddock stays clear. A hunt starts clear for 25 to 40 seconds, then a spell of 16 to 24 seconds blows in over **3 seconds** and clears the same way, and the pattern repeats. Both lengths come from a hash of the seed and the hunt count, so a replay has the same weather. At full strength the beast stays in sight only within 75% of the usual 12 steps in rain, 60% in mist, 55% in dust and 50% in a blizzard, so Enzo's sniff trail matters more. The fog thickens, the light dims, and rain streaks, dust motes or snowflakes fill the air. The HUD names the weather while it blows.

**Wild visitors and turf bonks.** Once a hunt, between 40 and 65 seconds in, a second beast wanders in from the edge: Puffwart in the meadow, Bristleback in the marsh and hollow, Hornclack on the ridge and Skreel on the peak (never in the paddock, and never while the hunted beast is tired). It walks towards the hunted beast. When the two are within 5 steps while the hunted beast is roaming, circling or resting, they square off for **1 second** inside an orange circle of radius **4.5** round the pair. Then comes the **turf bonk**: the hunted beast loses **10%** of its starting Grump (never all of it) and is dizzy for 2.5 seconds, and a friend inside the circle is bumped. The visitor then wanders back out. If the two haven't met within 25 seconds, the visitor leaves.

**Grab-on vine.** G (or Vine) throws a vine at a beast within **9 steps** that is no higher than 2.6. It lands 0.25 seconds later and the friend holds on for up to **4 seconds**; a held beast never attacks. While holding on, two bonk presses tickle it **soft** for **12 seconds** (bonks take 20% more Grump and 50% more part), K **yanks** it **6 steps** the way the stick points (or towards the friend's side), and Space lets go. A yank that runs into a tree, a rock or the edge is a **wall bonk**: 3% of its starting Grump and 2 seconds of dizzy. The vine takes **20 seconds** to coil back up.

**Pebble slinger.** R (or Sling) flicks a pebble at the locked-on beast, or straight ahead. A pebble takes **3** Grump and adds **6** dizzy but charges no weapon meters. Three pebbles bring a flying Skreel down to rest on the ground for 2.5 seconds, and a pebble wakes a snoozing beast. A pebble at a tree knocks out a berry, one per tree and three a hunt. A hunt starts with **5** pebbles; gathering adds 3 and every dizzy shakes 1 loose, up to **12**.

**Hit numbers and weak spots.** Every bonk shows how much Grump it took as a number that rises over the beast, with a burst of sparks. A bonk on a **weak spot** takes **15%** more and shows in orange: the face for most beasts, and the sides for Hornclack, between its shell plates. Big bonks show larger numbers, and the hammer leaves a soft swoosh, orange on a charged swing.

**Area hazards.** Every zone of a wild area hides one hazard, placed from a hash of the seed clear of trees, rocks, gathering spots and the nest: an acorn bough in the meadow, a bubble spring in the marsh, a rock pile on the ridge, sticky vines in the hollow and icicles on the peak. Hit it with a pebble, or press F within 2.2 steps, and an orange circle of radius **3.2** warns for **0.8 seconds** before it drops. A beast inside (or just at its edge) loses **8%** of its starting Grump (never all of it) and is dizzy for **3 seconds**. A flying Skreel is only caught by the bubble spring. A friend inside gets a bump. Each hazard works once.

**Best times.** The results show how long a calm took, in tenths of a second. The Beast Book keeps each beast's best time from normal hunts (not Extra Grumpy hunts or the paddock calf), and the results cheer a new best time.

**Fluff finches.** Three little fluff finches hop about every zone of a wild area, placed from a hash of the seed, clear of trees, rocks, gathering spots, the nest, the hazard and each other. Walking within 1.4 steps of one adds **5 Fluff** and **5 most Fluff** for the rest of the hunt, and it flutters off.

**Zones.** Every wild area is three zones, each with its own name: the meadow's Clover Field, Bramble Dell and Sunny Knoll; the marsh's Lily Pools, Reed Maze and Misty Bog; the ridge's Pine Steps, Windy Ledge and High Saddle; the hollow's Red Dunes, Echo Canyon and Sandstone Den; and the peak's Frost Gate, Icicle Run and Summit Bowl. The paddock stays one zone. Each zone turns the area's inner trees and rocks to a new spot, gets its own gathering spots, nest, hazard and fluff finches, and opens worn paths through gaps in the ring of trees: on to the next zone at the far (north) edge, back at the near (south) edge, each with a signpost. Below **70%** of its starting Grump the beast **wanders** to the far path and on to zone 2; below **35%** it goes on to its den, zone 3. It makes no attacks on the way (it can still be bonked), and gives up and slips away after 12 seconds if something blocks it. While it is away it can't be seen or bonked, the open path glows, and Enzo's pawprints lead to it. Walking within **2.4 steps** of the open path follows it: the next zone fades in with the friends at its near edge, 1.5 seconds of safety, and the beast resting ahead. Materials on the ground are collected and a sap trap left behind returns to the pouch. Under the beast's name, the zone map marks where the friends are and where the beast is.

**Tired and home to snooze.** Outside the paddock, the first time a bonk takes a beast below **20%** of its starting Grump, it gets tired (a note, a cue and “So sleepy…”). Once any attack, dizzy, sap or rest in progress has finished, it trudges home at **2.2 units a second** (Extra Grumpy pace applies) without attacking, and a flying Skreel lands. The nest is the first clear spot on a ring around the arena's edge (radius 15, or 8 in a smaller arena), found without the random generator: at least 2.4 units clear of trees and rocks and 2 from gathering spots. In its nest the beast **snoozes for 8 seconds**, its eyes closed and its back rising and falling, with lavender sleepy puffs. The snooze restores up to **8%** of its starting Grump, and the buddy holds off. The first bonk or shot on a snoozing beast is a **wake-up bonk** worth double Grump, which adds no dizzy and wakes it into a 1.5-second rest. A snooze that ends by itself also leads into a 1.5-second rest. A beast goes home only once per hunt. The nest, a twig ring round a bed of hay, is drawn for the whole hunt.

**Enzo’s sniff.** The beast is out of sight when it is more than 12 units from the leader, or when a tree or rock stands between them. After one second out of sight Enzo sniffs the air (a note and a high cue): a trail of up to 16 glowing pawprints, 1.1 units apart, leads from the leader towards the beast, skipping any print under a tree or rock. It stays lit while the beast is out of sight and fades two seconds after it is seen again. Enzo sniffs whichever friend is leading.

**Buddy orders.** Hold Tab and tap E or Q to step the buddy’s order forwards or back through **Stay close**, **Go bonk** and **Gather**; the order button under the Fluff bar does the same with a click or tap. While an order is being given, Q and E don’t change the pouch item and releasing Tab doesn’t toggle lock-on; a plain Tab tap toggles lock-on when it is let go. Hunts start on Go bonk, the original behaviour: the buddy helps once the leader is within 11 units of the beast, and Dora runs in to bonk. Stay close keeps the buddy at the leader’s side and lets it help only from there, which for Dora means only when the beast is next to you. Gather sends the buddy to the nearest material on the ground, picks it up within 1.2 units, and never bonks. Healing berries come in every order. The order is not saved.

## The Pantry

The Pantry is a striped market stall at Clover Camp. Items are now made, not handed out, and the pouch persists between hunts.

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

**Armour:** the armour tab makes a helm, vest or boots from any of the seven beast sets; the golden Mighty set is described under **Post-game**. Each costs 3 beast commons and 1 part (helm/boots) or rare (vest). Click an owned piece to wear or remove it; pieces may be mixed. Bristle adds 10 Fluff per piece, Puffwart 8, Skreel 7, Hornclack 12, Frostmane 10, Paddlepaw 11 and Rumblesnout 12. Two matching pieces activate their first skill, three add the second: reduced push / charge protection, weaker sleepy clouds / faster item recovery, longer roll dodges / an extra roll, side guarding / head Dizzy, distant Fluff regeneration / one half-Fluff recovery from tuckered out, River Rest / Soft Landing (Paddlepaw) or Pebble Pouch / Dizzy Dig (Rumblesnout). The Forge lists active skills. Caps, vests and boots are small coloured toon accessories.

Weapon geometry is ported from `docs/grumble-hunt/look-test/main.ts.txt` into `lib/grumble-hunt-weapons.ts`, with the original hammer pose and transformed handle grips. The first hammer, claws and bow icons use `icons-gear.webp`: there is no `icons-weapons-1.webp` in this checkout. Lance, Wand and Yo-yo use sheet 2; the other types use sheets 3–5. The gear sheet holds the Bristle and Puffwart armour icons (cells 9–14); `icons-armour.webp` holds the other five sets, three cells each in the order Skreel, Hornclack, Frostmane, Paddlepaw, Rumblesnout, and `icons-charms.webp` holds the charms and the Mighty pieces.

## Hop-on

Only the leader rides; the buddy keeps its own ground position, equipment and bonk AI. A beast may be ridden **twice per hunt**. It stays still and starts no attacks while ridden, including grounded dizzy Skreel.

**Getting on.** Release K for the Pinecone Yo-yo’s Loop-the-Loop: its connecting hit starts a ride on a dizzy or sap-stuck beast within **4 units**, multiplied by 1.2 with Wide Loop. Any weapon can instead roll off a rock; the Firefly Staff can vault after holding J for **0.35 seconds**. At jump start the leader must be within **0.6 units of the rock’s radius** (absolute distance from its edge). Movement input must have length at least **0.1**, point away from the rock’s centre (positive dot product), and project a landing **2 units** along its normalized direction. The dizzy or sap-stuck beast must be within **3 units of that landing**. Sprint is optional. A soft “hop!” ring previews an outward jump towards the beast when that rule is available.

**Bonking and holding on.** The HUD has three pawprint pips and a five-tap meter. Each fresh **J press** adds one tap; holding J adds no more. **Five taps** make a full bonk and a “Boop!” cue. Each full bonk lowers Grump by an ordinary bonk of the equipped weapon at its tier (including the normal dizzy ×1.7 bonus), and builds the part meter as usual. Hold **K** through the warning and the buck to grip, at no stamina cost. Touch uses Bonk taps, “Hold · big” to grip and Roll to hop off.

The first warning starts **1.2–1.6 seconds** into the ride. Every buck warns **0.65 seconds** ahead with a tense squash, orange shake mark, sound and “Hold on! (K)”. Bucks last **0.3 seconds**, or **0.5 seconds for Frostmane**. Subsequent buck starts are **1.6–2.6 seconds** apart, from the seeded generator. Letting go during a buck gives a soft landing, **1 second of invincibility**, no Fluff loss, and leaves the meter visible in engine state until another ride or hunt reset. Roll hops off freely at any time. A new ride starts with an empty meter.

**Time and plop.** The ride ends when the current dizzy / sap timer ends or after **8 seconds**, whichever comes first. Boarhog Spinner’s Long Hop adds **2 seconds** to both the cap and the current dizzy / sap duration at entry. Three full bonks make a **plop**: +30 Dizzy, a fresh **3.2-second** dizzy opening, a seeded part chance of `min(1, part / (maxGrump × 0.32))` if the part has not already popped, and **2 commons** chosen uniformly from that beast’s calm-drop commons through the seeded generator. The plop adds no extra Grump reduction. The beast tips sideways with stars, the leader hops off, and the result card remembers the plop reward. All ride state resets at village, camp, nap or tuckered out; rides are not saved.

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

The ending unlocks **Extra Grumpy variants** on the hunt board: **×1.6 Grump**, **×2 rare-roll probability** (capped at 100%), and a new coat colour. The colours are blond Bristleback, blue Puffwart, lavender Skreel, peach Hornclack, rose Frostmane, teal Paddlepaw and tan Rumblesnout. The usual below-30% enrage still applies, with its 15% pace increase and 0.8-second warning. Variants use the ordinary beast's material table and can still benefit from Lucky Seed Bun's extra roll.

**Wren's bounty board** offers three distinct tasks from a pool of thirteen: a nap without items, Bristleback tusks, Puffwart sac, Skreel crest, Hornclack horn cap, Frostmane mane, Paddlepaw's pebble pouch, Rumblesnout's pebble crown, a nap without a bump, three gathering spots, three dizzy openings, watching a turf bonk, or any lovely nap. Checks use actual hunt facts, including the buddy's gathering. Tasks are checked when the beast naps. Each claim gives **3 berries, 2 bristle tufts and 2 wart pebbles**, subject to pouch caps, once per task that day. Ready and claimed tasks persist across reloads. These are optional favours; no story progress requires them.

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
| **Dandelion Puffer** | medium | 4 / 7 | Calm each of the **five** story beasts' Extra Grumpy variants once |
| **Pogo Spring** | medium | 8 / 5 | **10** Hop-on plops in total |
| **Leaf Umbrella** | medium | 6 / 5 | The Beast Book shows every part broken on all **five** story beasts |

- **Tickle Feather.** Each leader hit fills the **Giggle** meter by 12 (15 on a beast that's already dizzy). At 100 the beast giggle-dizzies for **3 s** and the meter empties. A K tap is a double-tickle flurry: one swing that lands twice. Branch A perks fill Giggle 25% faster.
- **Dandelion Puffer.** J blows a cone **3.5 units** long and **60°** wide. Fluff clings to the beast and adds **2 Dizzy per second for 3 s**; another puff refreshes the time but doesn't stack it. Hold K past 0.35 s and release for a **Big Breath**: a 120°, 4.5-unit gust that adds **+15 Dizzy** and pushes the beast back **2.5 units**, stopping short of trees, rocks and the arena edge, then a **6 s** recharge. While it recharges the seed clock visibly thins out. Branch A widens the cone 25%; branch B makes fluff cling 1 s longer.
- **Pogo Spring.** J is a hop-bonk that steps 0.6 units forward. Hold K past 0.35 s and release for a **High Bounce**: about **0.8 s** in the air, landing with a bonk from above (×1.6) that also reaches a flying Skreel. Landing within **2.5 units** of a dizzy beast starts a Hop-on directly, inside the usual limit of two rides a hunt. (Beast bodies keep paws 1.85 units away, so 2.5 is "right beside it".) Branch A bounces higher and pulls loose materials in.
- **Leaf Umbrella.** Holding K opens the umbrella: it guards **from every side** at **half** walking speed, using the normal guard rules and stamina. While it's open, a J tap is a **Raindrop Spin** that hits everything within **3 units**. After a roll the umbrella floats you down; holding K makes the float last twice as long. Branch A's spin gives the buddy 5 Fluff; branch B's first 0.5 s of guard costs no stamina.

Each has the usual tree: tiers 1–2, branch A (Frostmane materials) or B (Hornclack) at tier 3, tier 4, and the Glimmer tier 5 with Warm Glow. Tier 2 costs 3 frost fur, 2 shell plates and 2 bristle tufts; the higher tiers are priced like every other tree. Their single-hit numbers sit inside the existing weapons' range and scale by `TIER_MULT`. The buddy can carry any of them and uses J only. Buddy hits never touch the leader's Giggle meter.

## Strings and finishers

Melee tools chain J swings into a three-hit string: start each swing within 0.6 seconds of the last one recovering (`COMBO_WINDOW`, 0.9 s with Mighty Rhythm), and the third is the tool's finisher (`FINISHERS`). It hits 1.5 times as hard and recovers 1.3 times slower. Slow tools add 20 Dizzy, medium tools loosen parts twice as fast, and fast tools bonk a second time at base power. A roll, a bump or a late swing starts the string again. The bows, the Bubble Wand and the Dandelion Puffer have no string. The HUD shows three pips after Stamina, and the Forge names each tool's finisher.

## Charms

The Forge's Charms tab opens in chapter 2 (`CHARM_CHAPTER`). There are three charms (`CHARMS`), each with levels I to III, and one is worn at a time. Clover adds +1/+1/+2 common materials to every nap reward, with +0/+1/+1 extra rare rolls. Acorn adds +10/+20/+30 Fluff. Feather makes rolls recover 15/30/45% faster and brings the vine back 2/4/6 s sooner. Level I costs only materials; levels II and III also cost 2 and 5 quest stars. The first charm made is worn straight away. Charms are made and worn only at camp, and a bad level in a save is clamped to 0–3. Their painted icons are `icons-charms.webp` cells 0–11 (four cells a charm, one per level).

## Quest board

Old Mossback's quest board sits under the free hunts. `QUESTS` has eleven quests from chapter 2 to 6, then the Mighty quests and the finale:

- **Timed calms:** Speedy Snooze (Bristleback, 90 s), Frosty Sprint (Frostmane, 240 s) and Slippery Sprint (Paddlepaw, 180 s). Running out of time doesn't stop the hunt.
- **Goals:** Paws Only (no vine), Feather Duster (a pebble knockdown), Shell Rhythm (three finishers) and Featherlight (three bumps or fewer).
- **Two-beast quests:** Double Trouble, Sky and Shell, Peak Parade, and Splash and Dig. The second beast arrives 11 steps across the zone, with full Grump, and roars hello.

A quest opens once its chapter is reached and every beast in it has been met (`freeHuntOpen`). A success pays 1 to 3 stars and a bundle of materials every time, and counts in `profile.quests`. A miss still ends in a nap and the normal reward, and the result card says what was missed. Tuckering out drops the quest.

**Mighty quests.** Seven Mighty quests (`mighty-<beast>`) open once the story is done and three other quests have been finished (`MIGHTY_AT`). A Mighty beast has `MIGHTY_GRUMP` (2) times the Grump, twice the rare chance, a golden glow, is drawn 15% bigger, and adds one move to its pattern (`MIGHTY_MOVES`, names in `MIGHTY_NAMES`):

- **Double Dash** (Bristleback): two charges, each with its own full wind-up and orange lane.
- **Bubble Rain** (Puffwart), **Icicle Rain** (Frostmane) and **Pebble Shower** (Rumblesnout): orange circles of radius 2.2 (`RAIN_REACH`), one on the leader and the rest in a ring 3.6 away.
- **Feather Fan** (Skreel): three lanes 11 long and 2.2 wide, 0.55 rad apart.
- **Shell Spin** (Hornclack) and **Whirlpool Spin** (Paddlepaw): a circle of radius 6 (`SPIN_REACH`).

A Mighty calm pays 3 stars and a bundle, and keeps its own best time (`mightyBest`). On the hunt board, a beast whose Mighty quest is open wears a gold "Mighty quest open!" badge, or "✓ Mighty calmed" once it's done.

**The finale.** Old Mossback's last quest, **Best of Friends** (`finale`), opens once Mighty Rumblesnout and Mighty Paddlepaw have both been calmed (`Quest.needs`; until then the board names them). It is a Mighty Rumblesnout, then a Mighty Paddlepaw that wanders in for a second nap, both with their Mighty moves. It pays 5 stars, a river pearl, a geode heart and 2 glimmer stones, plus the **Best of Friends ribbon** keepsake (`Quest.keepsake`), shown on the result card and in the Beast Book. The first time it is met, the three-page `finale` scene plays on `story-7.webp`.

**Mighty armour.** The Forge's Armour tab shows a sixth set, Mighty, after the story (`ARMOUR_SETS.mighty`, +15 Fluff a piece). Each piece needs Mighty quests finished at least once and costs 4 quest stars (`MIGHTY_ARMOUR`):

- **Helm:** Mighty Bristleback and Puffwart; 2 curly tail tufts, 2 sleepy-cloud wisps, 2 tusk shards.
- **Vest:** Mighty Skreel and Hornclack; 2 owl down, 3 shell plates, 3 horn chips.
- **Boots:** Mighty Frostmane; 2 glimmer stones, 3 icy mane locks, 3 frost fur.

Two pieces give Mighty Rhythm: the string window grows to 0.9 s (`MIGHTY_RHYTHM`) and finishers hit 1.1 times as hard (`MIGHTY_FINISHER`); the fast tools' second bonk stays at base power. Three pieces add Full Fluff: the leader's bonks take 15% more Grump while Fluff is full (`FULL_FLUFF`). The pieces are gold with a soft glow on the hero.

## Post-game beasts

Two beasts arrive after the story (`POST_GAME_BEASTS`). They have no chapter, so they open on the hunt board with the ending (`freeHuntOpen`), and each lives in an area it shares with a story beast (`POST_GAME_AREA`). Goals that count "all five" beasts (the Dandelion Puffer and Leaf Umbrella unlocks, the Mighty armour) still count the five story beasts (`STORY_BEASTS`).

- **Paddlepaw**, the belly-sliding river otter, in Soggy Marsh: 700 Grump. Its pattern is a belly slide (a charge lane; a tree on the way makes it dizzy), a splash of three water lanes (the Feather Fan shape) and a hop. Its pop-off part is its pebble pouch.
- **Rumblesnout**, the burrowing badger, in Pebble Hollow: 760 Grump. Its pattern is a burrow, a sweep and a charge. The burrow drops one orange circle of radius 2.4 (`BURROW_REACH`) on the leader at the start of the normal wind-up. The badger sinks 2.2 below the ground over the first half second and can't be bonked or grabbed with the vine while it is under. Then it pops up inside the circle, bumps anyone still in it for 15, and rests 2.8 seconds while it shakes off the dirt. Its pop-off part is its pebble crown, which drops two crown pebbles.

Their materials are on `icons-materials-2.webp` (cells 16–21 in `MATERIALS`): otter fluff, smooth river stone (part) and river pearl (rare, 30%) for Paddlepaw; striped fur, crown pebble (part) and geode heart (rare, 30%) for Rumblesnout. Their armour sets:

- **Paddlepaw:** +11 Fluff a piece. River Rest: fluffberries and big fluffberries heal 25% more (`RIVER_REST`). Soft Landing: bumps take 20% less Fluff (`SOFT_LANDING`).
- **Rumblesnout:** +12 Fluff a piece. Pebble Pouch: 4 more pebbles at the start and up to 16 in the sling (`PEBBLE_POUCH`). Dizzy Dig: the leader's bonks on a dizzy beast take 10% more Grump (`DIZZY_DIG`).

**Epilogue.** The `epilogue` scene (`EPILOGUE`, three pages from Wren, Old Mossback and Enzo) introduces the two. It plays straight after the ending's outro; a player who finished the story before it existed sees it the first time they open the hunt board. Its painting is `story-6.webp`.

## The Beast Book

The Beast Book has, in order: Wren's bounty board link; the **Story** list, replaying every seen scene (intros, outros, "New Friends" and the finale); a page for each of the seven beasts with its reference sheet, sanctuary status, home area, part, title, tips, best time and the materials in your pouch; the **Mighty** page (each Mighty beast, its new move, how often it was calmed and its Mighty best time, greyed until calmed); the **Turf bonks** page (`TURF_PAIRS`: each beast and its area's visitor, seven pairs, marked once seen in `turfPairs`, with where to hunt for the rest); and **Keepsakes** (the Best of Friends ribbon). The turf emblem and the ribbon are cells 1 and 0 of `icons-keepsakes.webp`.

## Saving and architecture

- `lib/grumble-hunt-content.ts`: materials, drop tables, gathering, Pantry recipes, snacks, armour sets, the story chapters, the epilogue and the finale, as data. `storyScene(id)` looks up any scene.
- `lib/grumble-hunt-game.ts`: seeded deterministic rules, no DOM or Three.js. Fixed steps are 1/60 second; the page bounds catch-up after a slow frame.
- `lib/grumble-hunt-scene.ts`: Three.js drawing, camera, posed tools, chunky beasts, texture loading, effects, and disposal.
- `lib/hunt-chinchilla.ts`: the dedicated existing hunt model; its only change is an optional `shade` hook that the scene uses to give the coat, ears and paw pads the `fluffy` shading. Shared chinchilla modules are unchanged.
- `app/hunt/page.tsx`: input, hydration, the loop, story scenes, the result card and storage. The rest of the page is split out: `hud.tsx` (beast HUD and name card), `camp-panels.tsx` (hunt and quest board, bounties, Beast Book, Pantry), `forge-panel.tsx` (weapons, armour and charms), `field-guide.tsx`, `ui.tsx` (shared helpers such as `Art`, `Icon` and `readSave`) and `hunt.css`.
- `app/hunt/sound.ts`: gesture-unlocked synthesised cues and audio cleanup.

Permanent progress is saved under `grumble-hunt-v6`: selected hero, all weapon tiers and branches, each friend's equipped weapon, owned and worn armour (Mighty pieces included), pouch, ring, packed snack, nap counts and hunt count; `story: { chapter, scenesSeen }` (the epilogue and finale are scene ids too); `beastBook` entries (`met`, `napped`, `partsBroken`, `best`); `bounties: { day, done, ready }` and `extraGrumpyUnlocked`; the post-game counters `bountiesClaimed`, `variantNaps` and `totalPlops`; quest `stars` and `quests`; `charms`; `mightyBest` (Mighty best times) and `turfPairs` (turf bonks seen). Fields added after v6 began (charms, Mighty, the two new beasts, `mightyBest`, `turfPairs`) load as empty from an older v6 save, so the version didn't change.

The page reads v6, then v5, v4, v3, v2 and v1. Old nap counts clear matching chapters, with chapter 0 cleared if any beast napped; the first remaining chapter is current. Matching old scenes count as seen, including chapters beyond a gap. Equipment and pouch carry over unchanged from v3; v2 and v1 retain the earlier level and material migrations. The loader validates versions, numeric ranges, known scene/part/task identifiers, arrays and booleans. Reloading returns safely to camp. The final bonk saves progress before the nap animation ends. Sound still uses `grumble-hunt-sound-v1`; `window.__hunt()` exposes `{ game, refresh, metrics, input }` for checks.

## Drawing and resource budget

The scene uses `MeshToonMaterial`, the 96/178/255 three-step ramp, `OutlineEffect`, and `NoToneMapping`. Ground, sky, foliage, effects and instanced grass disable outlines. The existing paintings are unchanged: repeating grass and dirt ground, bark trunks, rock boulders and Bristleback fur; the equirectangular sky; billboard leaf clusters, transparent grass tufts and 8,000 instanced grass blades. The ground shader blends in one extra, rotated and slightly blurred sample of its painting at about six times the scale (35%, rising to 50–75% on the busier slate, mud and sand) and a slow light-and-dark patchwork, so the repeat doesn't show; the sand and mud, and the trail over them, are also muted 35% and 25% toward grey. Paths and the hunt-start trail fade out at their sides and ends through a canvas-drawn wobbly alpha edge; the trail samples the area's ground painting at the ground's own scale, tinted per area. Fog runs from 22 to 86 units. The distant hills are two rings in one instanced draw, a near ring at 63 units and a taller one at 78 between its humps, which the fog turns to haze; the hills, rocks, trail and the hemisphere light's ground bounce take each area's colours. Rocks are a lumpy, flat-bottomed icosahedron; ice is a merged cluster of four pointed six-sided crystals, and the peak's snow mounds are flattened spheres. Every tree, rock and gathering spot gets a soft canvas contact shadow from one instanced draw, and marsh ponds have a mud shore and a light glint. Pond water ripples: its shader moves bands of light in world space on the wind clock, so reduced motion keeps it still. Grass blades lean away from both friends (0.8 units) and from the beast while it is on the ground (1.6 units), flattening a little as they bend, in the grass vertex shader. Beast coats, villagers, Dora and Enzo, tree crowns and the hills share a `fluffy` shader tweak: the top lit and the underside shaded by the world-space normal, plus a soft warm rim. Bristleback keeps its painted fur under a near-white coat colour; Skreel and Frostmane wear canvas-drawn fur strokes and Puffwart a soft mottled skin; legs are a lathed shape with a domed top, a soft knee and a narrower ankle. Pine crowns stack four lathed tiers that droop to a scalloped rim and curl under. Hornclack's horn is lathed with growth rings around its base and sweeps back at the tip. Berry bushes are a clump of five `fluffy`-shaded leaf mounds, the top one lighter, with twelve berries resting just outside their surfaces. Clover Camp's walls and roofs carry canvas-painted planks, plaster speckle and staggered shingles, and nine outline-free flower clumps sit between the paths. Ten butterflies flutter over the meadow, paddock and Clover Camp, each wing side one instanced draw of a two-lobed shape that flaps about the body line as the butterfly wanders a loop around its own home spot; eighteen small glowing fireflies drift low over the marsh. Both hide when motion is reduced, like the Peak's snowfall of 140 plain white, outline-free flakes. Skreel has three darker flight feathers fanning out under each wing. Crown, bush and mane blobs are a welded, gently bumped icosahedron, so they shade smooth rather than faceted. Camp paths are muted 22% toward grey; in an area, paths match its ground. In the marsh the reed card stands in a bed around each trunk's foot rather than behind the crown. Trunks, leaf cards and solid canopy shapes are each batched into one instanced draw, and so is Enzo’s pawprint trail, a canvas-drawn print with a soft glow. Extra Grumpy steam is six small puffs on the beast’s head; its eyebrows have their own material so they can turn red. The ref sheets guide the five 3D models and appear in the Beast Book.

The page draws single cells of the painted atlases as CSS backgrounds (`Art` in `app/hunt/ui.tsx`). The hero picker shows each friend’s happy portrait. The HUD portrait changes with play: dizzy during the 1.4-second recovery after a bump, sleepy below 30 Fluff, determined while swinging or charging, and happy otherwise. The Forge draws each tool’s three tiers from `icons-gear.webp` (cells 0–2 for the hammer, 6–8 for the bow), greyed until reached, and lists the satchel by beast with icons from `icons-materials.webp`. The Beast Book uses the same material icons. The pouch keeps text labels: Dizzy dust and Pep seed have no matching icon yet. The expansion art (story panels, area skies, ground tiles and foliage cards, villagers, and weapon sheets 2–5) is in `public/art/hunt/` and logged in [`grumble-hunt-story-art.md`](grumble-hunt-story-art.md) and [`grumble-hunt-weapon-icons.md`](grumble-hunt-weapon-icons.md); the expansion build will connect it.

The camera orbits above flat walkable terrain, keeps a minimum height, and shortens its distance when a trunk, rock or village building would clip the view. A tree crown near the camera, or across its view of the leader, shrinks away over 0.2 seconds and grows back afterwards, so leaves never fill the screen; the camera doesn't move in for crowns. Desktop resolution is capped at 1.5 device pixels with 1024-pixel PCF shadows; touch devices use a 1.25 cap and 512-pixel basic shadows. Tiny facial features do not cast shadows, and there are no postprocessing passes beyond outlines. Projectiles, drops and extra dust use bounded mesh pools. Weapon trails, squash/stretch, a small camera shake and 0.08–0.11-second hit-stop give bonks weight.

On exit, the page cancels its animation frame, removes keyboard, focus, visibility and context listeners, disconnects its resize observer, and closes audio. The scene disposes geometries, materials, loaded textures, shadows, render lists and renderer/context; late texture callbacks also dispose their result. Phone browser emulation and rendering budgets are checked automatically (see **Verification**); actual mid-range phone hardware still needs a device play-test.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:grumble-hunt
npm run bot:grumble-hunt
# With npm run dev running and Playwright installed locally:
npm run test:e2e:grumble-hunt
```

**Engine suite** (`tests/grumble-hunt.mjs`, plus the content checks in `tests/grumble-hunt-content.mjs`): **118 checks** on 26-10-2026. They cover determinism, the 0.6-second warning rule for every attack, Mighty move and burrow, tools, strings, dizzy, items, gathering, the buddy, every Iceborne-style system, the Forge, armour and charms, Hop-on, story progress, quests, Mighty beasts, the finale, saves from v1 to v6, and malformed saves.

**Bot** (`tests/grumble-hunt-bot.mjs` with the policy in `tests/grumble-hunt-policy.mjs`) uses only movement, actions and earned materials. It plays twelve seeds as each hero, one buddy order per seed. Latest results (26-10-2026):

- Campaigns: **168/168** beasts calmed, every one going Extra Grumpy, one attempt per hunt; median hunt 32.5 s, slowest 66.5 s.
- Story bot: **144/144** chapters; median 24.4 s, slowest 74.6 s.
- Post-game tools, Extra Grumpy beasts: all **168/168** with each tool. Medians: Feather 64.6 s, Puffer 126.9 s, Pogo 78.9 s (335 Hop-ons), Umbrella 91.1 s.
- Quests: every quest calmed 24/24, with every goal met except Shell Rhythm (12/24: Enzo's bow can't land finishers). Medians run from 21.4 s (Speedy Snooze) to 130.9 s (Best of Friends).
- Mighty armour pieces made from earned stars: 66/72.

**Browser suite** (`tests/e2e/grumble-hunt.mjs`, `ONLY=<name part>` runs one check): **28 checks**, about 50 minutes on this machine, screenshots in git-ignored `.checks/hunt/`. Every hunt check asserts under 400 draw calls. The phone check (390 × 844 touch, DPR 3, 4× CPU throttling) writes `.checks/hunt/performance.json`. On 26-10-2026, the meadow hunt drew 178 calls and 172k triangles. The busiest newer hunts, each a Mighty beast in full weather with a wild visitor, drew 271 calls (Paddlepaw in marsh rain) and 278 (Rumblesnout in a hollow dust storm), with about 189k triangles. Chromium renders with SwiftShader there, so frame times don't predict a real phone; a hardware play-test is still outstanding.

## History

All dates 2026.

- **24-10:** the base game (five beasts, two heroes, camp), then the expansion steps: alive hunts (Extra Grumpy, Enzo's sniff, buddy orders), painted icons and portraits, the Pantry (save v2), the Forge (save v3), Hop-on, and Story mode with areas, villagers, post-game variants and bounties (save v4).
- **25-10:** the four post-game weapons (save v5).
- **26-10:** the Iceborne-style systems, one at a time: tired beasts and nests, roars and name cards, weather, wild visitors and turf bonks, the grab-on vine, the pebble slinger, hit numbers and weak spots, area hazards, best times, fluff finches and zones. Then merged scenery draw calls, strings and finishers, the quest board (save v6), charms, Mighty beasts and Mighty armour. Then the page split, the painted charm icons, Paddlepaw and Rumblesnout, the epilogue, the Beast Book's Mighty page and per-set armour icons. Last came the Best of Friends finale, the turf-bonk page, Mighty badges and three new bounties.
- **27-10:** the epilogue's own painting, and this reference in place of the dated run logs.

The art for every step, with the prompts used, is logged in [`grumble-hunt-art.md`](grumble-hunt-art.md), [`grumble-hunt-story-art.md`](grumble-hunt-story-art.md) and [`grumble-hunt-weapon-icons.md`](grumble-hunt-weapon-icons.md); the briefs sent to Codex are in [`grumble-hunt-prompts/`](grumble-hunt-prompts/). `CHANGELOG.md` has the player-facing notes for each change.
