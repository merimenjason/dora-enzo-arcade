# Grumble Hunt expansion design

Written 24-10-2026. This is the plan for what comes after the first build (`docs/grumble-hunt-prompts/1-build-game.md`): story mode, six weapons with upgrade trees, armour, crafting, and the Monster Hunter mechanics that suit a kids' game. Build it only after the first build is reviewed and merged, as the PRs in **Build order** at the end. The numbers are starting points: tune them with the bot.

## Ground rules

- **Kind:** nothing is hurt. Beasts are calmed and nap; the player gets "tuckered out". Use bonk, dizzy, calm, nap, boop and shed. Never use injury words.
- **Short:** a hunt takes 3 to 6 minutes. A whole chapter, story pages included, takes 10 to 15.
- **No grind walls:** every story chapter can be cleared with the gear you can craft from that chapter's beast and the one before it. Rare materials only speed things up or unlock extra looks.
- **Read little:** story pages have at most two short sentences each, and every menu has an icon.
- **Deterministic:** all drops, gathering and story state go through the engine's seeded generator, so a seed replays a run exactly.

## 1. Story mode: "The Grumble Wind"

**The premise:** a cold, cranky wind has started blowing down from Frosty Peak, and every beast it touches wakes up grumpy. Old Mossback, the village's tortoise elder, asks Dora and Enzo to calm the beasts one by one and find out where the wind comes from. In the end they learn that Frostmane's Glimmer Stone, the warm crystal in its mane, has cracked. They calm Frostmane, and Bramble the hedgehog smith mends the stone. The wind turns warm again.

**The villagers:**
- **Old Mossback** (tortoise) gives the story quests.
- **Bramble** (hedgehog) runs the Forge.
- **Pip** (degu) runs the Pantry, for snacks and item crafting.
- **Wren** (wren) keeps the Beast Book and the bounty board.

They're simple low-poly toon figures who stand at their stations and bob when you talk to them.

**How it's told:** each beat is a storybook page. A painted panel fills the top two thirds of the screen, with a paper card underneath holding one or two sentences and the speaker's portrait. Pages advance with a tap, Enter or J, and "Skip" skips the whole scene. Seen scenes can be replayed from the Beast Book.

| # | Chapter | Area | Beast | What it teaches | Unlocks |
| --- | --- | --- | --- | --- | --- |
| 0 | A Grumpy Morning | Village paddock | Bristleback calf (tutorial, Grump 40, no attacks for the first 20 s) | Move, bonk, roll, lock on, the Grump meter, napping | The Forge, the Acorn Hammer and Seed Bow at tier 1 |
| 1 | The Huffy Hog | Clover Meadow | Bristleback | Dodging telegraphs, tree crashes cause dizzy, part breaks, materials | The Bristle armour set, Twin Claws at tier 1 |
| 2 | Snores in Soggy Marsh | Soggy Marsh | Puffwart | Items and the Pantry, sleepy clouds, snacks | Item crafting, the Thistle Lance at tier 1 |
| 3 | Swoops over Windy Ridge | Windy Ridge | Skreel | Tracking with Enzo's sniff, gathering spots, ranged openings when it lands | Gathering, the Bubble Wand at tier 1 |
| 4 | The Stubborn Beetle | Pebble Hollow | Hornclack | Weak spots (sides and back), shell breaks, traps | Traps, the Pinecone Yo-yo at tier 1 |
| 5 | The Frosty Peak | Frosty Peak | Frostmane (three phases) | Everything above | The ending, then free hunt, Extra Grumpy beasts and bounties |

Story progress lives in the save as `story: { chapter, scenesSeen[] }`. Each chapter is cleared when its beast first naps. A free hunt of any beast already met is always available from the hunt board.

## 2. Weapons

There are six types, each with its own feel. Every type has **Bonk** (lowers Grump), **Dizzy** (builds the dizzy meter) and one signature move. Values are for tier 1; the tree below scales them.

| Weapon | Feel | Bonk | Dizzy | Speed | Signature move |
| --- | --- | --- | --- | --- | --- |
| Acorn Hammer | Slow, heavy | 12 | 14 | slow | **Big Swing**: hold K for 3 charge levels (×1, ×1.6, ×2.4 Bonk). A level-3 hit on the head adds 25 Dizzy. |
| Seed Bow | Ranged | 6 per shot | 3 | medium | **Charged Shot**: hold J for 3 levels (1, 2 or 3 seeds). K switches seed type: plain, sticky (slows), pop (extra Dizzy). |
| Twin Claws | Fast combos | 4 per hit | 3 | fast | **Zoomies**: K toggles; you move and attack 30% faster while a Zoom meter drains. Hits refill the meter. |
| Thistle Lance and Leaf Shield | Steady, defensive | 9 | 6 | medium | **Guard**: hold K to block from the front. Release just as an attack lands for a **Counter Boop** (×2 Bonk, +15 Dizzy). |
| Bubble Wand | Support, mid range | 5 | 4 | medium | **Bubble Burst**: K blows a slow bubble that pops for an area hit. Bubbles on the ground lift loose materials towards you, and a bubble on your buddy heals 15 Fluff. |
| Pinecone Yo-yo | Mid-range whip | 7 | 5 | medium | **Loop-the-Loop**: K spins the yo-yo around you, hitting everything near you. On a dizzy beast it pulls you up onto its back for a **Hop-on** (see Mechanics). |

**Everyone fights well with anything:** Dora and Enzo can both use every weapon. Their starting weapons are just defaults. The buddy uses whatever you last gave them at the Forge.

### Weapon trees

Each type has 4 tiers. Tier 3 splits into two beast-themed branches, and tier 4 finishes each branch. Branch perks are small and readable.

**Multipliers:** stats are tier 1 × 1.0, tier 2 × 1.3, tier 3 × 1.65 and tier 4 × 2.1.

**Costs:**
- **Tier 2:** 3 common materials from the chapter-1 or chapter-2 beast, plus 2 berries.
- **Tier 3:** 4 of the branch beast's common materials and 1 of its part-break materials.
- **Tier 4:** 3 of the branch beast's rare materials, 1 icy mane lock and 1 glimmer stone.

| Weapon | Tier 2 | Tier 3, branch A | Tier 4, A | Tier 3, branch B | Tier 4, B |
| --- | --- | --- | --- | --- | --- |
| Acorn Hammer | Iron-band Hammer | Bristle Basher (Bristleback): Big Swing charges 20% faster | Tuskquake Hammer: a level-3 Big Swing sends out a short shockwave | Puffball Pounder (Puffwart): hits leave a sleepy puff (+5 Dizzy over time) | Snoozecloud Hammer: a level-3 hit on a dizzy beast extends the dizzy by 1.5 s |
| Seed Bow | Twine Bow | Feather Flight (Skreel): seeds fly 30% faster | Galeseed Bow: level-3 shots pierce through | Sticky Reed (Puffwart): sticky seeds slow 40% longer | Bogroot Bow: three sticky hits root the beast in place for 2 s |
| Twin Claws | Pebble Claws | Shell Snips (Hornclack): +20% Bonk on shell parts | Plateclack Claws: Zoomies doesn't drain while hitting from behind | Down Dusters (Skreel): +15% move speed | Skydown Claws: rolling through an attack refills Zoom |
| Thistle Lance | Bramble Lance | Horncap Lance (Hornclack): guarding costs no stamina for the first 0.5 s | Rhinoclack Lance: a Counter Boop knocks a part off at once | Bristle Pike (Bristleback): +10% Bonk while guarding | Tusk Pike: a successful guard reflects a charge and causes dizzy |
| Bubble Wand | Reedstraw Wand | Frothy Wand (Puffwart): bubbles are 25% bigger | Puffsac Wand: heal bubbles heal 25 Fluff | Breezy Wand (Skreel): bubbles drift towards the locked-on beast | Cyclone Wand: Bubble Burst hits twice |
| Pinecone Yo-yo | Twine Yo-yo | Tusk Spinner (Bristleback): Loop-the-Loop is 20% wider | Boarhog Spinner: a Hop-on lasts 2 s longer | Plate Spinner (Hornclack): +25 Dizzy on shell parts | Shellstorm Spinner: Loop-the-Loop pulls loose materials in |

**Finale weapon:** the Frostmane gives each type one capstone, the **Glimmer** version (for example the Glimmer Hammer). It costs 2 frost fur, 2 icy mane locks and 2 glimmer stones on top of either tier-4 weapon. It keeps that branch's perk and adds **Warm Glow**: every 10th hit restores 10 Fluff to you and your buddy.

**How the tree appears:** the Forge screen shows the tree as a left-to-right node graph for the selected weapon type. Nodes show their icon, name and cost, and are greyed out until the materials are in your pouch. Crafting is one press, followed by a 1 s hammer-on-anvil animation, with Bramble cheering.

## 3. Armour

Each beast gives one set: a helm, a vest and boots. Each piece adds Fluff, and wearing 2 or 3 pieces of a set turns on its skill. Pieces from different sets can be mixed.

| Set | Fluff per piece | 2-piece skill | 3-piece skill |
| --- | --- | --- | --- |
| Bristle | +10 | **Steady Paws**: knock-backs push you 40% less | **Charge Guard**: you're never knocked down by charges |
| Puffwart | +8 | **Snooze Proof**: sleepy clouds slow you half as much | **Deep Breath**: item use is 50% faster |
| Skreel | +7 | **Feather Step**: the roll dodge window is 30% longer | **Updraft**: one free double-jump roll |
| Hornclack | +12 | **Shell Stance**: guarding blocks attacks from the sides too | **Hard Head**: +20% Dizzy on head hits |
| Frostmane | +10 | **Frost Fluff**: regain 1 Fluff every 2 s out of combat | **Warm Heart**: being tuckered out once per hunt is forgiven (you get back up at 50% Fluff) |

**Costs:** each piece takes 3 common materials and 1 part or rare material from its beast. Armour is drawn as a small toon accessory on the chinchilla: a bristle crest cap, a leaf vest, puffy boots and so on. They can't cover the face or the ears.

## 4. Materials and crafting

There are 16 materials, the same ones as in the icon sheet (`icons-materials.webp`).

| Material | From | How | Rarity |
| --- | --- | --- | --- |
| bristle tuft | Bristleback | Shed on a bonk (20% chance per bonk) | common |
| tusk shard | Bristleback | Part break: tusks | part |
| boar hide patch | Bristleback | Calm reward | common |
| curly tail tuft | Bristleback | Calm reward (25% chance) | rare |
| wart pebble | Puffwart | Shed on a bonk | common |
| puff sac | Puffwart | Part break: throat sac | part |
| sleepy-cloud wisp | Puffwart | Calm reward (25% chance) | rare |
| marsh reed | Soggy Marsh | Gathering spots | common |
| sky feather | Skreel | Shed on a bonk; extra from a landing crash | common |
| owl down | Skreel | Calm reward (25% chance) | rare |
| beetle shell plate | Hornclack | Part break: shell | part |
| horn chip | Hornclack | Part break: horn, or calm reward | part |
| frost fur | Frostmane | Shed on a bonk | common |
| icy mane lock | Frostmane | Part break: mane, or calm reward | part |
| glimmer stone | Every area | Rare gathering spot (one per map, and it sparkles); Frostmane calm reward | rare |
| berry | Every area | Berry bushes (2–3 per map) | common |

**Calm rewards:** 3 common materials, one roll for the rare one, and any part-break materials still owed. They're shown on a results card ("Bristleback is napping! You got...") with the materials flying into a pouch.

### Pantry recipes (items)

Items are carried in a ring of 6 slots, chosen with Q/E and used with F. Each item stacks up to its own limit.

| Item | Recipe | Effect | Max carried |
| --- | --- | --- | --- |
| fluffberry | 1 berry | Restores 30 Fluff | 10 |
| big fluffberry | 2 berries and 1 marsh reed | Restores 70 Fluff | 5 |
| sleepy seed | 1 berry and 1 sleepy-cloud wisp | Thrown: the beast gets drowsy, moving 30% slower for 8 s | 3 |
| dizzy bell | 1 horn chip and 2 bristle tufts | Rung near the beast: +40 Dizzy | 2 |
| sticky sap | 2 marsh reeds | A trap: the beast is stuck for 4 s. One trap at a time. | 2 |
| smoke puffball | 1 puff sac | You're hidden for 6 s; the beast loses track and wanders | 3 |
| pathfinder acorn | 1 berry and 1 sky feather | Enzo sniffs out the beast: a trail of glowing pawprints leads to it for 20 s | 3 |
| hay bundle | 3 marsh reeds | A snack ingredient (see Snacks) | 5 |

### Snacks (meal buffs)

Before a hunt you can have one snack at the Pantry. It lasts for that hunt. Snacks cost berries and hay bundles.

| Snack | Cost | Effect |
| --- | --- | --- |
| Clover Crunch | 2 berries | +20 max Fluff |
| Hay Nibble | 1 hay bundle | Stamina (rolls and guard) recovers 25% faster |
| Berry Stack | 3 berries and 1 hay bundle | +10% Dizzy on every hit |
| Lucky Seed Bun | 2 berries, 1 hay bundle and 1 glimmer stone | One extra rare-material roll on calming |

## 5. Monster Hunter mechanics, adapted

These are ranked by how much fun they add for a kid against the effort to build them. S, M and L are rough sizes: under a day, about two days, and a week. The "first build" column marks what `1-build-game.md` already asks for.

| # | Mechanic | MH original | Grumble Hunt version | Size | First build | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Telegraphed attacks | Wind-ups | Wind-up pose plus an orange ground marker at least 0.6 s ahead | — | yes | Keep |
| 2 | Part breaks | Breaking tails and horns | Parts pop off with a "boing" and drop part materials | — | yes | Keep |
| 3 | Capture | Traps and tranquillisers | Every hunt ends in a nap, so this is built in | — | yes | Keep |
| 4 | Enrage | Enraged state | **Extra Grumpy**: below 30% Grump the beast puffs steam from its ears, moves 15% faster and telegraphs 0.1 s earlier. Its eyebrows go red. | S | no | Do in PR 1 |
| 5 | Tracking | Scoutflies | **Enzo's sniff**: when the beast is out of sight, glowing pawprints lead to it. A pathfinder acorn makes the trail last longer. | S | no | Do in PR 1 |
| 6 | Gathering | Mining and gathering | Berry bushes, marsh reeds and sparkling glimmer spots. Press F to gather (1.2 s). | S | no | Do in PR 2 |
| 7 | Traps and items | Shock traps, flash pods | Sticky sap, dizzy bell and smoke puffball (Pantry recipes) | M | partly | Do in PR 2 |
| 8 | Meals | Canteen or Bunny Dango | Snacks at the Pantry | S | no | Do in PR 2 |
| 9 | Weapon trees | Forge trees | Section 2 | M | 3 levels only | Do in PR 3 |
| 10 | Armour skills | Set bonuses | Section 3 | M | no | Do in PR 3 |
| 11 | Mounting | Mounts | **Hop-on**: hop onto a dizzy beast's back (Pinecone Yo-yo, or a running jump off a ledge). Tap J to bonk while it bucks, and roll off at any time. Three full bonks make it plop over (+30 Dizzy, materials drop). | M | no | Do in PR 4 |
| 12 | Turf wars | Monster clashes | **Grump-offs**: if two beasts meet in a free hunt they bonk heads, both lose 10 Grump, and both get a little dizzy. Free hunt only. | M | no | Later |
| 13 | Palico | Felyne companion | Buddy commands: hold Tab and tap Q/E to tell Enzo or Dora to "stay close", "go bonk" or "gather". | S | AI buddy only | Do in PR 1 |
| 14 | Bounties | Optional quests | Wren's board: 3 small daily-style tasks ("Calm a beast without using items", "Break both tusks"), each worth a material bundle. They're seeded by date, so everyone gets the same ones that day. | S | no | Do in PR 5 |
| 15 | Tempered and variant beasts | Tempered or variant monsters | **Extra Grumpy beasts** after the story: Grump +60%, new colours (a blond Bristleback, a blue Puffwart), and they drop rare materials more often | M | no | Do in PR 5 |
| 16 | Multiple zones | Numbered areas | Each map has 2 or 3 zones joined by short paths, with a loading puff between them. The beast moves zones when its Grump drops past each third. | L | no | Later |
| 17 | Seikret mount | Rideable dinosaur | A friendly hare you can ride between zones | L | no | Skip for now |
| 18 | Online co-op | Co-op | Local co-op only, if ever: the buddy is already there | L | no | Skip |

Mechanics 4, 5 and 13 are the cheapest big wins. They make hunts feel alive without new screens.

## 6. New areas

Each chapter area reuses the meadow's layout code with its own textures, sky, props and fog colour. The art is in `docs/grumble-hunt-prompts/4-story-art.md`.

| Area | Ground | Props | Sky and fog |
| --- | --- | --- | --- |
| Clover Meadow | grass and dirt (done) | trees, boulders | `sky-meadow` (done) |
| Soggy Marsh | mud and moss, shallow water planes | reeds, lily pads, mushroom clusters, logs | overcast lavender evening |
| Windy Ridge | short grass and slate | wind-bent pines, standing stones, flags | bright morning, fast clouds |
| Pebble Hollow | sand and pebbles | stacked boulders, crystal nubs, beetle burrows | warm canyon afternoon |
| Frosty Peak | snow and blue ice | snowy firs, ice spires, the cracked Glimmer Stone shrine | pale winter dusk, glittering snowfall |

## 7. Save format

This expansion changes the save, so bump the key to `grumble-hunt-v2`. Read a v1 save once and carry over its materials, its calmed beasts (they count as story chapters cleared) and its weapon levels: hammer and bow levels 1–3 map to tiers 1, 2 and 3 on branch A. Then write v2.

```ts
type SaveV2 = {
  hero: 'dora' | 'enzo';
  story: { chapter: number; scenesSeen: string[] };
  pouch: Record<MaterialId | ItemId, number>;
  weapons: Record<WeaponType, { tier: 1 | 2 | 3 | 4 | 5; branch: 'A' | 'B' | null }>; // 5 = Glimmer
  equipped: { hero: WeaponType; buddy: WeaponType };
  armour: { owned: ArmourPieceId[]; worn: { helm?: ArmourPieceId; vest?: ArmourPieceId; boots?: ArmourPieceId } };
  beastBook: Record<BeastId, { met: boolean; napped: number; partsBroken: string[] }>;
  bounties: { day: string; done: string[] };
  extraGrumpyUnlocked: boolean;
};
```

## 8. Tests and bots

- **Engine tests:**
  - Every recipe and tree node is craftable from materials the game can drop.
  - No tree node needs a material from a later chapter than the one that unlocks it.
  - Branch perks apply.
  - Armour skills turn on at 2 and 3 pieces.
  - A v1 save migrates.
  - A seed replays a drop table exactly.
- **Bot:** `bot:grumble-hunt` plays the story from chapter 0 to chapter 5 with the gear it can craft, choosing the cheapest upgrade path. It must clear every chapter within 6 attempts of each hunt. That's the "no grind walls" rule, so `npm test` should enforce it.
- **Browser test:** the Forge tree renders, crafting updates the pouch, and a story page advances and can be skipped.

## Build order

Each step is one PR on its own branch from `main`, after the first build has merged.

1. **Alive hunts:** Extra Grumpy, Enzo's sniff tracking and buddy commands.
2. **Pantry:** gathering, item recipes, traps and snacks.
3. **Forge:** the six weapon types, weapon trees and armour sets, including the v2 save and migration.
4. **Hop-on:** mounting, with the Pinecone Yo-yo making it easy.
5. **Story mode:** villagers, storybook pages, chapters 0–5, the four new areas, and the post-game (Extra Grumpy beasts and bounties).
