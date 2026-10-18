# Chinchilla Trek

A roguelite trek in the spirit of Capybara Go!, at `/trek`. Dora or Enzo walks thirty days through one of five chapters, one event a day; fights play out by themselves, and the player's part is the skill picks, the choices on the path and the camp between treks. The design is in [`docs/superpowers/specs/18-10-2026-chinchilla-trek-design.md`](superpowers/specs/18-10-2026-chinchilla-trek-design.md) and the build plan in [`docs/superpowers/plans/18-10-2026-chinchilla-trek-plan.md`](superpowers/plans/18-10-2026-chinchilla-trek-plan.md).

## Code

- `lib/chinchilla-trek-data.ts`: the data and tuning: skills, evolutions, foes, chapters, scenes, gear and the balance numbers.
- `lib/chinchilla-trek-game.ts`: the engine, with no DOM. `fight()` works a whole fight out at once and returns its events; `Trek` is the thirty-day state machine; the profile, camp, the chest and the bot's policy (`decide`, `playTrek`, `campStep`) follow. Randomness comes from a seeded `Rand`, so a seed and the same choices replay a trek exactly.
- `lib/chinchilla-trek-scene.ts`: Canvas 2D drawing: the path, the landmarks, the foes, and the fight replay.
- `app/trek/page.tsx`, `trek.css` and `sound.ts`: the page, its screens (title, camp, trek, end card, journal), input, saving and sound.

## The trek

A trek is 30 days. `next()` walks to the next day:

1. A follow-up scene that is due comes first (the freed bird coming back, Pip asking for help).
2. Then the fixed days: day 10 and day 20 are an elite fight, day 15 the crossroads, day 25 the Pedlar, day 30 the boss.
3. Day 1 is always a fight.
4. Any other day is drawn from these weights, redrawn when it is the same kind as the day before: fight 40, story 20, skill cache 12, find 10, rest 8, wheel 5, Pedlar 5.

Fights, finds and rests resolve at once. A find is acorns (`5 × chapter`), a snack (heal 20%) or a little chest (`15 × chapter` acorns); a rest heals 30%. Stories, the wheel, the Pedlar, the crossroads and visits wait for a choice; a skill cache opens a pick.

A won fight gives experience (3 for a foe, 8 for an elite) and acorns (`3`, `12` or `30` for the boss, times the chapter, times Lucky Paw). Experience to the next level is `2 + floor(level / 4)`. Each level-up heals 20% of max HP and offers three skills; several level-ups queue their picks. A pick offers three distinct cards from the skills below level 3 and the evolutions that are ready, fewer when fewer can be drawn, and a single **Rest** (heal 30%) when there are none. The offer can be rerolled once a trek. After an elite win, the Owl or the Fox visits once the picks are done. A lost fight ends the trek; the boss's fall clears it. A fight that reaches 40 rounds ends with the foe wandering off, with no experience or acorns; on day 30 that ends the trek, since there is no day after it.

Max HP changes carry current HP with them: a raise adds the same to HP, a drop clamps HP to the new max, never below 1.

## Fights

`fight()` is pure: the same input gives the same events. The hero acts first each round.

- **Start:** the shield is set (Shell Guard, or Bramble Shell), then Dust Roll hits.
- **The hero's turn:** one attack, then Combo's extra attack (once, or twice with Thunder Combo). Each attack can crit (×2, ×3 with Fluffy Fury), zap with Static Fluff (25% chance; with Thunder Combo every extra attack zaps for 120%), freeze the foe with Frost Whiskers and add a stack of Pepper Dust (up to 5). Pounce multiplies the first attack of the fight. Grit adds attack below half HP.
- **The foe's turn:** one attack, two every third turn for a foe with `double`. The hero's dodge cancels a whole attack. The shield soaks first. Prickles reflect their share (at least 1, never reflected again; Bramble Shell reflects 60%). Counter may hit back; a counter or a reflect never sets off Combo or Counter.
- **The end of the round:** the foe's burn (`stacks × Pepper × attack`), then the hero's sting burn, then Power Nap's heal (and Midnight Feast's 6%), then Bramble Shell's refill (10% of max HP), then the foe's regen.
- **Healing from damage:** Snack Break, or Midnight Feast's 25%, heals from attack, combo, counter, zap and Dust Roll damage; burns and reflects don't heal.
- **Knock-outs** are checked after every hit: the foe at 0 is a win at once. The hero at 0 uses Second Wind once a trek (back to its share of max HP), otherwise loses.
- Every hit deals at least 1. Dust Roll doesn't crit. Burns ignore the shield.
- **Foe traits:** `sting` (the first hit that lands burns 10% of the foe's attack a round), `shell` (the first hit it takes is halved), `chill` (every fourth foe turn that lands freezes the hero for a turn), `swift` (15% dodge), `rage` (+50% attack below half HP), `regen` (heals 5% of max HP a round), and `double` above.
- Foes scale as `round(base × CHAPTER_SCALE[chapter] × (1 + 0.045 × day))`, with `CHAPTER_SCALE = [1, 1.5, 2.2, 3.1, 4.3]`.

The hero's stats are camp's (base 100 HP, 10 attack, 5% crit, 0 dodge, plus training and worn gear), then the hero's perk (Dora +10% HP, Enzo +10% attack), then Extra Fluff, Sharp Teeth and any charms or story bonuses as fractions, then Keen Eye and Dust Cloud added. Crit is capped at 90% and dodge at 60%.

## Skills

| Skill | Name | Level 1 / 2 / 3 |
| --- | --- | --- |
| `combo` | Combo | 20% chance to attack again (once a turn). / 35% chance to attack again (once a turn). / 50% chance to attack again (once a turn). |
| `counter` | Counter | 20% chance to hit back when hit. / 35% chance to hit back when hit. / 50% chance to hit back when hit. |
| `sharp` | Sharp Teeth | +15% attack. / +25% attack. / +40% attack. |
| `keen` | Keen Eye | +10% crit chance. / +20% crit chance. / +30% crit chance. |
| `fluff` | Extra Fluff | +20% max HP. / +35% max HP. / +50% max HP. |
| `shell` | Shell | Start of fight: a shield of 15% of max HP. / Start of fight: a shield of 25% of max HP. / Start of fight: a shield of 40% of max HP. |
| `dust` | Dust Cloud | +8% dodge. / +15% dodge. / +22% dodge. |
| `static` | Static Fluff | Each attack: 25% chance of a zap for 50% of attack. / Each attack: 25% chance of a zap for 80% of attack. / Each attack: 25% chance of a zap for 120% of attack. |
| `snack` | Snack Break | Heal 8% of the damage you deal. / Heal 14% of the damage you deal. / Heal 20% of the damage you deal. |
| `nap` | Power Nap | End of each round: heal 2% of max HP. / End of each round: heal 4% of max HP. / End of each round: heal 6% of max HP. |
| `grit` | Grit | Below half HP: +30% attack. / Below half HP: +50% attack. / Below half HP: +80% attack. |
| `prickle` | Prickles | Reflect 15% of the damage you take. / Reflect 25% of the damage you take. / Reflect 40% of the damage you take. |
| `pounce` | Pounce | Your first attack in a fight deals ×2.5. / Your first attack in a fight deals ×4. / Your first attack in a fight deals ×5.5. |
| `roll` | Dust Roll | Start of fight: deal 150% of attack. / Start of fight: deal 250% of attack. / Start of fight: deal 350% of attack. |
| `pepper` | Pepper Dust | Hits add a burn of 10% of attack each round (up to 5). / Hits add a burn of 15% of attack each round (up to 5). / Hits add a burn of 20% of attack each round (up to 5). |
| `frost` | Frost Whiskers | 12% chance a hit freezes the foe for a turn. / 20% chance a hit freezes the foe for a turn. / 28% chance a hit freezes the foe for a turn. |
| `lucky` | Lucky Paw | +20% acorns, and the wheel's bad slice turns lucky. / +40% acorns, and the wheel's bad slice turns lucky. / +60% acorns, and the wheel's bad slice turns lucky. |
| `wind` | Second Wind | Once a trek, at 0 HP, stand back up with 30% of max HP. / Once a trek, at 0 HP, stand back up with 50% of max HP. / Once a trek, at 0 HP, stand back up with 70% of max HP. |

An evolution is offered once both its halves are at level 3. Picking it removes the halves from the tray; they keep working at level 3, and the evolution adds its own line.

| Evolution | Name | From | Effect |
| --- | --- | --- | --- |
| `storm` | Thunder Combo | Combo + Static Fluff | Every extra attack also zaps for 120%, and Combo can chain twice. |
| `fury` | Fluffy Fury | Keen Eye + Grit | Crits deal ×3; below half HP, +30% crit chance. |
| `bramble` | Bramble Shell | Shell + Prickles | Your shield refills by 10% of max HP each round; reflect 60%. |
| `feast` | Midnight Feast | Snack Break + Power Nap | Heal 25% of the damage you deal, and 6% of max HP each round. |

## Chapters and foes

Base HP/attack before scaling, with each foe's trait.

| Chapter | Foes (trait) | Elite (trait) | Boss (trait) |
| --- | --- | --- | --- |
| 1. Clover Meadow | Beetle 46/5, Field Mouse Gang 36/6 (double), Grumpy Toad 44/5 (regen), Wasp 34/7 (sting) | Hedge Pig 96/8 (shell) | King Mole 180/11 (rage) |
| 2. Bramble Wood | Magpie 36/7 (swift), Stoat 38/6 (double), Thornbush Sprite 42/5 (regen), Wild Boar Piglet 46/6 (rage) | Old Raccoon 90/8 (double) | Grumbleton the Badger 196/11 (rage) |
| 3. Willow River | Crab 44/5 (shell), Heron 36/7 (swift), Pike 38/6 (double), Water Vole 42/6 | Snapping Turtle 104/7 (shell) | Captain Otter 172/12 (double) |
| 4. Frosty Peak | Snow Hare 34/7 (swift), Ptarmigan 40/6, Mountain Goat Kid 46/6 (rage), Ice Imp 38/6 (chill) | Yeti Pika 86/9 (swift) | The Snow Fox Queen 184/11 (chill) |
| 5. Moon Hollow | Bat 34/7 (swift), Moth 40/6, Will-o'-wisp 38/6 (regen), Night Owlet 42/6 (sting) | Shadow Cat 88/9 (swift) | The Great Horned Owl 190/12 (regen) |

## Story scenes

Twenty scenes can be drawn (the chapter ones only in their chapter), and two follow-ups come only when an earlier choice sends them. `{other}` is the chinchilla you didn't pick, who is drawn at the path's edge in those scenes. Choices with odds show them on the button; their acorn rewards are multiplied by the chapter.

| Scene | Chapter | Text |
| --- | --- | --- |
| `mushroom` | any | A mushroom glows softly by the path. It smells like toast. |
| `bird` | any | A little bird is tangled in some twine and peeping crossly. |
| `birdback` | any (follow-up) | The bird you freed swoops down, carrying a pouch of acorns. |
| `dustbath` | any | A patch of perfect, powdery dust. A chinchilla's dream. |
| `pip` | any | Pip scampers up with a tiny bag, asking to come along. |
| `piphelp` | any (follow-up) | Pip pops out of your satchel holding a snack. |
| `puddle` | any | A wide puddle lies across the path. |
| `berrybush` | any | A bush heavy with berries, some ordinary, some shiny. |
| `napspot` | any | A warm, flat rock, exactly chinchilla-sized. |
| `signpost` | any | A signpost has a riddle carved into it. |
| `picnic` | any | {other} waves from a hilltop beside a picnic basket. |
| `stash` | any | A forgotten pile of acorns, with a little sign: "Help yourself." |
| `clover` | 1 | The meadow is a sea of clover. |
| `beehive` | 1 | A hive hums in a hollow log. Honey drips from it. |
| `thornpath` | 2 | A shortcut through the brambles. Something glints inside. |
| `oldstump` | 2 | An old stump with a door in it. The door is ajar. |
| `stones` | 3 | Stepping stones cross the river, slippery with moss. |
| `raft` | 3 | A little raft is tied to a willow. |
| `snowball` | 4 | {other} pops up from behind a snowdrift with a snowball. |
| `hotspring` | 4 | Steam rises from a hot spring between the rocks. |
| `fireflies` | 5 | Fireflies drift between the trees, blinking in patterns. |
| `moonpool` | 5 | A still pool holds the whole moon. |


## The Pedlar, the wheel and the crossroads

- **The Pedlar** sells a snack (heal 40%, `15 × chapter` acorns), a skill card (a pick, `25 × chapter`) and a charm (+8% attack, +10% HP or +5% crit, `30 × chapter`), one of each. After a card's pick you are back at the stall.
- **The wheel** has eight equal slices: small acorns (`3 × chapter`, three slices), big acorns (`12 × chapter`), a snack (heal 25%), a skill pick, +5% attack, and a bump (−10% HP). With Lucky Paw the bump turns into big acorns.
- **The crossroads** (day 15): the Owl heals to full or raises a skill below level 3 by one; the Fox gives two skills you don't have at level 2 for 20% of max HP. **Visits** after an elite win offer half: the Owl heals 50%, the Fox gives one skill at level 2 for 10% of max HP.

## Camp, gear and chests

The profile keeps the banked acorns, training, gear, unlocked chapters, the best day per chapter, what the Journal has seen, and the page's settings.

- **Training:** +1 attack or +10 HP; each costs `20 + 10 × times trained` acorns.
- **Gear:** four slots: hat (HP 10, 20, 35, 55, 80), scarf (attack 1, 2, 4, 6, 9), charm (crit 2%, 4%, 6%, 9%, 12%) and boots (dodge 1%, 2%, 4%, 6%, 8%), by rarity Plain, Fine, Rare, Grand, Legend. Three pieces of a slot and rarity below Legend merge into one of the next rarity, which is worn when it beats the worn piece. Tap a piece to wear it.
- **Chests:** every finished trek, won or lost, banks its acorns and opens a chest: `2 × chapter × day reached` acorns and one piece of gear, two on a clear. Rarity weights start at Plain 60, Fine 30, Rare 9, Grand 1; each chapter above 1 and each 10 days reached moves 8 points up from the lowest rarity that has any. Legend is possible from chapter 4 (1 point per chapter above 3). A chapter's first clear makes one piece at least Rare. New pieces are worn when they beat the worn one. A trek is counted once, by its seed.

## Saving

- `chinchilla-trek-run-v1`: the whole trek after every action, including the generator's state; a fight's events are not kept, so a reload mid-fight continues from the day's result without replaying it.
- `chinchilla-trek-v1`: the profile, with `ui: { fast, auto }` for the ×2 and Auto-walk settings.
- `chinchilla-trek-sound-v1`: sound on or off.

A malformed trek save is dropped; a malformed profile loads fresh, and unknown pieces and ids in it are dropped.

## Balance

`npm run bot:trek` (also in `npm test`) plays 300 fresh chapter-1 treks with the policy and with a random player, then 40 campaigns from a fresh profile until chapter 5 is cleared, training and merging between treks. The gates: the policy clears chapter 1 in 25–55% of treks and at least 20 points more often than the random player; the median campaign takes 15–45 treks and none more than 90; every skill is picked in at least 2% of treks and every evolution reached in at least 5% of clears; under 2% of fights stall.

On 19-10-2026 it gave: the policy clears chapter 1 in 46% of treks against 13% at random; the median campaign takes 27 treks (the longest 35), with 1.6, 2.4, 2.9, 5.8 and 14.7 treks per chapter; a trek gives about 12 level-ups; 8 of 16,320 fights stalled. It runs in under a second.

## Art

Everything is drawn in code on a 480 × 320 canvas. Each chapter has its own sky, hills, ground and scenery (clover, berry bushes, reeds and a river, snowy pines and peaks, a moonlit night with mushrooms and fireflies), scrolling in layers while the hero walks. The day's landmark waits on the path: a sign for a story, the wheel, the Pedlar's cart, the Owl and the Fox. The 30 foes share one round body with their own colours, ears, tails and touches (beaks, shells, masks, crowns for the bosses); they never get hurt, they just tumble off dizzy. The fight shows damage numbers, crits, zaps, dodges, the shield bubble, burn and frost marks and skill callouts. Reduced motion stops the walk's bounce and the fireflies, keeps the lunges small and fades the foe out instead of tumbling. Painted art can come later through an image-prompts document, as for Hay Bale Brawl.
