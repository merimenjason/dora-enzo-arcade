# Summit Shuffle

Game 24, at `/summit`. A deck-building climb in the style of Slay the Spire: Dora or Enzo starts with ten plain cards and climbs three stretches of mountain, adding a card after every fight. The cards, predators, trinkets and art are the arcade's own.

Built on 06-10-2026. Balanced with the bot only; nobody has yet played it by hand, so the pace of the animations and how hard each altitude feels to a person are first guesses.

## How a climb goes

- Choose **Dora** or **Enzo** and an **altitude**. Both have 80 health and the same ten cards: five Nips, four Fluff Ups and a Dust Kick. They differ by one trinket: Dora's **Ruby Bell** (two more cards and one more energy on the first turn of every fight) or Enzo's **Grey Scarf** (heal 5 after every fight).
- The mountain is three **stretches** (The Foothills, The Cliffs, The Snowline). Each is a trail map of six rows of stops and a **guardian** at the top: 21 stops in all.
- You pick your own route. Trails fork and join, never cross, and you can see the whole stretch before you start.
- Reach 0 health and the climb is over. Beat the third guardian, the Cougar of the Summit, and you have won.
- A climb is **saved** after every choice. Leave in the middle of a fight and you come back to the start of that same fight, with the same cards in the same order.

### The stops

| Stop | What happens |
| --- | --- |
| 🐾 Predators | A fight. Win 10 to 19 seeds and choose one of three cards (or none). |
| 🔥 Alpha | A harder fight. Win 25 to 34 seeds, a trinket, and a better choice of cards. |
| 💤 Rest burrow | **Nap** to heal 30% of your max health, or **groom** to upgrade one card. |
| 🍎 Treat stall | Five cards (one at half price) and two trinkets for seeds, and it will take one card out of your deck for 75 seeds, 25 more each time. |
| ❓ Something on the trail | One of eight chance meetings, each a choice. No meeting repeats until all eight have been seen. |
| 🎁 Hidden stash | A free trinket. |
| 👑 Guardian | The stretch's boss. Win 60 to 79 seeds, one of three guardian trinkets, one of three rare cards, and all your health back. |

The first row of every stretch is fights, the second is fights and meetings, and the sixth is always rest burrows, so there is a burrow before every guardian. Every stretch has at least one alpha, one stall and one meeting somewhere on it. The first fight of a stretch is one of three easier ones.

### A fight

- Each turn you draw **5 cards** and have **3 energy**. Unplayed cards are discarded at the end of the turn; when the draw pile runs out the discard pile is shuffled back in. A hand holds at most 10.
- Every predator shows its **intent**: what it will do on its turn, with attack damage already worked out.
- **Fluff** soaks up damage before health does. Yours is gone at the start of your next turn; a predator's at the start of its own.
- Attack damage is the card's number, plus the attacker's **Zoomies**, less a quarter if the attacker is **Winded**, plus half if the target is **Exposed**, rounded down.
- Fluff from a card is its number plus your **Thick Fur**, less a quarter if you are **Matted**, rounded down.
- Exposed, Winded and Matted count down by one each turn. The number on you is how many more of your turns (or of the predators' attacks) it will be felt for.
- **Burrs** on a predator cost it that much health at the start of its turn, past its Fluff, then one falls off.
- A **power** stays for the whole fight. An **exhausted** card is gone until the fight ends.
- Cards are upgraded once (shown with a +). Upgrades last for the climb.

## Cards

48 cards can be found, in three rarities, plus the three kinds you start with. Ordinary fights offer mostly commons; a rare becomes a little more likely each time a common is offered, until one turns up. After the first stretch some offered cards arrive already upgraded.

### Starting cards

| Card | Type | Cost | What it does | Upgraded |
| --- | --- | --- | --- | --- |
| Nip | Attack | 1 | Deal 6 damage. | Deal 9 damage. |
| Fluff Up | Skill | 1 | Gain 5 Fluff. | Gain 8 Fluff. |
| Dust Kick | Attack | 2 | Deal 8 damage. Apply 2 Exposed. | Deal 10 damage. Apply 3 Exposed. |

### Common

| Card | Type | Cost | What it does | Upgraded |
| --- | --- | --- | --- | --- |
| Pounce | Attack | 1 | Deal 8 damage. Draw 1 card. | Deal 11 damage. Draw 1 card. |
| Double Kick | Attack | 1 | Deal 5 damage twice. | Deal 7 damage twice. |
| Tail Whip | Attack | 1 | Deal 8 damage to ALL foes. | Deal 11 damage to ALL foes. |
| Bowl Over | Attack | 2 | Deal 11 damage. Apply 1 Winded. | Deal 14 damage. Apply 2 Winded. |
| Quick Nip | Attack | 0 | Deal 4 damage. | Deal 7 damage. |
| Hay Toss | Attack | 1 | Gain 5 Fluff. Deal 5 damage. | Gain 7 Fluff. Deal 7 damage. |
| Burr Fling | Attack | 1 | Deal 5 damage. Apply 4 Burrs. | Deal 7 damage. Apply 5 Burrs. |
| Follow Up | Attack | 1 | Deal 6 damage. If the foe is Exposed, gain 1 energy and draw 1 card. | Deal 9 damage. If the foe is Exposed, gain 1 energy and draw 1 card. |
| Flurry | Attack | 1 | Deal 3 damage once for every card played this turn, this one included. | Deal 4 damage once for every card played this turn, this one included. |
| Shake It Off | Skill | 1 | Gain 7 Fluff. Draw 1 card. | Gain 10 Fluff. Draw 1 card. |
| Dust Bath | Skill | 1 | Gain 7 Fluff. Shake off Exposed, Winded and Matted. | Gain 10 Fluff. Shake off Exposed, Winded and Matted. |
| Popcorn | Skill | 0 | Draw 2 cards. | Draw 3 cards. |
| Dust Cloud | Skill | 1 | Apply 2 Winded to ALL foes. | Apply 3 Winded to ALL foes. |
| Burr Patch | Skill | 1 | Apply 6 Burrs. | Apply 8 Burrs. |
| Squeak | Skill | 0 | Apply 1 Exposed. Draw 1 card. | Apply 2 Exposed. Draw 1 card. |
| Wind Up | Skill | 0 | Gain 2 Zoomies until the end of this turn. | Gain 4 Zoomies until the end of this turn. |
| Scamper | Skill | 1 | Gain 3 Fluff once for every card played this turn, this one included. | Gain 4 Fluff once for every card played this turn, this one included. |
| Prickly Curl | Skill | 1 | Gain 6 Fluff and 2 Bristle. | Gain 8 Fluff and 3 Bristle. |

### Uncommon

| Card | Type | Cost | What it does | Upgraded |
| --- | --- | --- | --- | --- |
| Full Pelt | Attack | 2 | Deal 16 damage. Zoomies count 3 times for this card. | Deal 16 damage. Zoomies count 5 times for this card. |
| Belly Flop | Attack | 1 | Deal damage equal to your Fluff. | Costs 0. |
| Zoom Around | Attack | X | Spend all your energy. Deal 6 damage to ALL foes once for each energy spent. | Spend all your energy. Deal 9 damage to ALL foes once for each energy spent. |
| Ambush | Attack | 1 | Deal 8 damage. Deal it twice if this is the first card you play this turn. | Deal 11 damage. Deal it twice if this is the first card you play this turn. |
| Drumming Feet | Attack | 1 | Deal 3 damage 3 times. | Deal 4 damage 3 times. |
| Gnaw Through | Attack | 2 | Remove the foe’s Fluff, then deal 14 damage. | Remove the foe’s Fluff, then deal 18 damage. |
| Burr Storm | Attack | 2 | Deal 6 damage and apply 5 Burrs to ALL foes. | Deal 8 damage and apply 7 Burrs to ALL foes. |
| Sore Spot | Attack | 1 | Deal 8 damage, then as much again as the foe has Burrs. | Deal 11 damage, then as much again as the foe has Burrs. |
| Puff Up | Skill | 1 | Double your Fluff. | Costs 0. |
| Tangle | Skill | 1 | Apply 3 Burrs, then double the foe’s Burrs. Exhaust. | Apply 5 Burrs, then double the foe’s Burrs. Exhaust. |
| Alarm Bark | Skill | 1 | Apply 1 Exposed and 2 Winded. | Apply 2 Exposed and 3 Winded. |
| Groom | Skill | 1 | Heal 5 health. Exhaust. | Heal 8 health. Exhaust. |
| Cheek Stash | Skill | 1 | Gain 6 Fluff. Next turn, gain 1 more energy. | Gain 9 Fluff. Next turn, gain 1 more energy. |
| Dust Devil | Skill | 1 | Gain 5 Fluff. Apply 1 Exposed to ALL foes. | Gain 8 Fluff. Apply 1 Exposed to ALL foes. |
| Winter Coat | Power | 1 | Gain 2 Thick Fur. | Gain 3 Thick Fur. |
| The Zoomies | Power | 1 | Gain 2 Zoomies. | Gain 3 Zoomies. |
| Sticky Coat | Power | 1 | At the start of your turn, apply 2 Burrs to ALL foes. | At the start of your turn, apply 3 Burrs to ALL foes. |
| Cosy Nest | Power | 1 | At the end of your turn, gain 3 Fluff. | At the end of your turn, gain 4 Fluff. |
| Light Feet | Power | 2 | Whenever you play a card, gain 1 Fluff. | Costs 1. |
| Bramble Coat | Power | 1 | Gain 4 Bristle. | Gain 6 Bristle. |

### Rare

| Card | Type | Cost | What it does | Upgraded |
| --- | --- | --- | --- | --- |
| Feast | Attack | 2 | Deal 12 damage. If that knocks the foe out, raise your max health by 3. Exhaust. | Deal 16 damage. If that knocks the foe out, raise your max health by 4. Exhaust. |
| Fur Slip | Skill | 2 | The next hit that would cost you health costs none. Exhaust. | Costs 1. |
| Endless Zoomies | Power | 3 | At the start of your turn, gain 2 Zoomies. | Costs 2. |
| Deep Burrow | Power | 2 | Your Fluff no longer falls away at the start of your turn. | Costs 1. |
| Avalanche | Attack | 3 | Deal 28 damage to ALL foes. | Deal 36 damage to ALL foes. |
| Stampede | Attack | 2 | Deal 6 damage to a random foe 4 times. | Deal 6 damage to a random foe 5 times. |
| Raisin | Skill | 0 | Gain 1 energy. Draw 2 cards. Exhaust. | Gain 2 energy. Draw 2 cards. Exhaust. |
| Snow Den | Skill | 2 | Gain 24 Fluff. Exhaust. | Gain 30 Fluff. Exhaust. |
| Encore | Skill | 1 | Your next attack this turn is played twice. | Costs 0. |
| Bright Eyed | Power | 1 | Draw 1 more card every turn. | Costs 0. |

### Cards nobody wants

| Card | Type | Cost | What it does | Upgraded |
| --- | --- | --- | --- | --- |
| Daze | Status | – | Cannot be played. Fades at the end of the turn. | – |
| Thorn | Status | – | Cannot be played. Deals 2 damage to you if it is in your hand at the end of your turn. | – |
| Mud | Status | 1 | Does nothing. Exhaust. | – |
| Fright | Curse | – | Cannot be played. It stays in your deck until a treat stall or a dust hollow takes it out. | – |

## Statuses

| Status | What it does (shown for 2) |
| --- | --- |
| ⚡ Zoomies | Every attack hit deals 2 more damage. |
| 🧥 Thick Fur | Cards give 2 more Fluff. |
| 🌵 Bristle | Whoever attacks this creature takes 2 damage for each hit. |
| 🍂 Burrs | Loses 2 health at the start of its turn, then one burr falls off. |
| 🎯 Exposed | Takes half as much again from attacks for 2 turns. |
| 💨 Winded | Attacks deal a quarter less for 2 turns. |
| 🌀 Matted | Cards give a quarter less Fluff for 2 turns. |
| ✨ Fur Slip | The next 2 hits that would cost health cost none. |
| 🔁 Encore | The next 2 attacks this turn are played twice. |
| 🥜 Cheek Stash | 2 more energy next turn. |
| 🏡 Cosy Nest | Gains 2 Fluff at the end of each turn. |
| 🍯 Sticky Coat | Puts 2 Burrs on every foe at the start of each turn. |
| 🕳️ Deep Burrow | Fluff is kept from turn to turn. |
| 🔥 Endless Zoomies | Gains 2 Zoomies at the start of each turn. |
| 🐾 Light Feet | Gains 2 Fluff for every card played. |
| 👀 Bright Eyed | Draws 2 more cards each turn. |
| 🍖 Hungry | Gains 2 Zoomies at the end of each of its turns. |
| 🐚 Curl Up | Gains 2 Fluff the first time an attack hurts it. |
| 💢 Short Temper | Gains 2 Zoomies each time an attack hurts it. |
| 💤 Dozing | Asleep for 2 turns, or until something hurts it. |
| 🤝 Pack Bond | Gains 2 Zoomies if a packmate is knocked out. |

## Trinkets

| Trinket | From | What it does |
| --- | --- | --- |
| 🔔 Ruby Bell | Dora starts with it | On the first turn of every fight, draw 2 more cards and gain 1 more energy. |
| 🧣 Grey Scarf | Enzo starts with it | Heal 5 health after every fight. |
| 📦 Hay Cube | Alphas, stashes, stalls, meetings | Start every fight with 8 Fluff. |
| 🌑 Pumice Stone | Alphas, stashes, stalls, meetings | Start every fight with 1 Zoomies. |
| 🥢 Chew Stick | Alphas, stashes, stalls, meetings | Your first attack card in every fight deals 8 more damage with each hit. |
| 🌹 Dried Rosehip | Alphas, stashes, stalls, meetings | Naps at a rest burrow heal 15 more health. |
| 🍒 Golden Wolfberry | Alphas, stashes, stalls, meetings | Raises your max health by 10. |
| 🍀 Lucky Pebble | Alphas, stashes, stalls, meetings | Every fight you win pays 12 more seeds. |
| 🎡 Running Wheel | Alphas, stashes, stalls, meetings | Gain 1 more energy on every third turn of a fight. |
| 🌋 Lava Ledge | Alphas, stashes, stalls, meetings | Exposed foes take three quarters more from your attacks, not half. |
| 🏠 Dust House | Alphas, stashes, stalls, meetings | Every foe starts the fight Exposed for 1 turn. |
| 🛏️ Fleece Hammock | Alphas, stashes, stalls, meetings | If you end your turn with no Fluff, gain 6. |
| ⬛ Granite Slab | Alphas, stashes, stalls, meetings | Every hit that gets through your Fluff costs 1 less health, down to 1. |
| 🖌️ Burr Comb | Alphas, stashes, stalls, meetings | Whenever you apply Burrs, apply 1 more. |
| 🌵 Bramble Collar | Alphas, stashes, stalls, meetings | Start every fight with 3 Bristle. |
| 🎟️ Stall Stamp Card | Alphas, stashes, stalls, meetings | Everything at a treat stall costs 30% less. |
| 🌾 Hay Rack | Alphas, stashes, stalls, meetings | Whenever your discard pile is shuffled back into your draw pile, gain 5 Fluff. |
| 🍇 Raisin Stash | Alphas, stashes, stalls, meetings | If you finish a fight at half health or less, heal 10. |
| 🍎 Apple Chew | Alphas, stashes, stalls, meetings | When you find this, two cards in your deck are upgraded. |
| 📯 Tin Whistle | Alphas, stashes, stalls, meetings | Whenever a foe is knocked out, gain 1 energy and draw 1 card. |
| 🌿 Moss Blanket | Alphas, stashes, stalls, meetings | Gain 12 Fluff at the start of your second turn in every fight. |
| ☘️ Four-leaf Clover | Alphas, stashes, stalls, meetings | Card rewards show one more card to choose from. |
| 🏮 Glow Beetle Jar | Alphas, stashes, stalls, meetings | Gain 1 more energy on the first turn of every fight. |
| 👓 Snow Goggles | Alphas, stashes, stalls, meetings | Whenever you draw a Daze, a Thorn or a Mud, draw another card. |
| 💧 Spring Water | Guardians | Gain 1 more energy every turn. You can no longer nap at rest burrows. |
| 🌻 Sunflower Crown | Guardians | Gain 1 more energy every turn. Every fight starts with 2 Thorns in your draw pile. |
| 👝 Hole in the Pouch | Guardians | Gain 1 more energy every turn. Fights no longer pay seeds. |
| 🌱 Apple Twigs | Guardians | Draw 1 more card every turn. |
| 🍵 Summit Tea | Guardians | Raises your max health by 12 and heals you to full. |
| 💅 Filed Claws | Guardians | Start every fight with 2 Zoomies. So does every foe, with 1. |

## Predators

### Stretch 1: The Foothills

| Predator | Health | Starts with | Moves |
| --- | --- | --- | --- |
| Grass Snake | 32–38 | – | **Bite**: 7 damage; **Hiss**: you: Exposed 2; **Tail Lash**: 5 damage, 5 Fluff |
| Weasel | 20–25 | – | **Nip**: 5 damage; **Scurry**: 2 × 2 damage; **Work Up**: 3 Fluff, +2 Zoomies |
| Burr Beetle | 12–14 | Curl Up 3 | **Bite**: 4 damage; **Mud Fling**: 3 damage, 1 Mud to your discard pile |
| Young Fox | 49–55 | – | **Snap**: 8 damage; **Crouch**: 8 Fluff; **Pounce**: 14 damage |
| Thieving Vizcacha | 41–46 | – | **Swipe**: 6 damage, steals 12 seeds a hit; **Pack Up**: 12 Fluff; **Run Off**: runs off |
| Alpha Skunk (alpha) | 78–84 | – | **Spray**: +2 Zoomies, you: Winded 2, you: Matted 2; **Claw**: 10 damage; **Double Scratch**: 5 × 2 damage; **Tail Slam**: 14 damage |
| Dozing Owl (alpha) | 86–92 | Dozing 3, 8 Fluff | **Asleep**: 8 Fluff; **Waking Up**: nothing; **Talon**: 13 damage; **Screech**: you: Exposed 2, 2 Daze to your draw pile |
| Russet, the Old Fox (guardian) | 130–136 | – | **Stalk**: 10 Fluff, you: Exposed 1; **Snap**: 5 × 2 damage; **Pounce**: 16 damage; **Howl**: +2 Zoomies, you: Winded 1; **Call the Kits**: 8 Fluff, calls 2 Fox Kits |
| Fox Kit (called by the guardian) | 13–16 | – | **Nip**: 4 damage; **Yap**: 3 Fluff, +1 Zoomies |

First fight of the stretch: Grass Snake; Weasel + Weasel; Burr Beetle + Burr Beetle + Burr Beetle. Later fights: Young Fox; Grass Snake + Weasel; Burr Beetle + Burr Beetle + Grass Snake; Thieving Vizcacha; Young Fox + Burr Beetle; Weasel + Weasel + Weasel. Alphas: Alpha Skunk; Dozing Owl.

### Stretch 2: The Cliffs

| Predator | Health | Starts with | Moves |
| --- | --- | --- | --- |
| Cliff Hawk | 61–67 | – | **Circle**: 9 Fluff, +1 Zoomies; **Peck**: 9 damage; **Dive**: 16 damage |
| Mountain Viper | 54–61 | – | **Strike**: 10 damage; **Coil**: 6 Fluff, +2 Zoomies; **Hiss**: you: Exposed 2, 1 Daze to your discard pile |
| Rock Lizard | 21–24 | – | **Bite**: 5 damage; **Tail Lash**: 3 damage, you: Winded 1; **Bask**: +1 Zoomies |
| Grumpy Armadillo | 57–64 | Bristle 2 | **Curl**: 12 Fluff; **Roll**: 11 damage |
| Pampas Cat | 74–79 | – | **Swipe**: 6 × 2 damage; **Pounce**: 13 damage, you: Exposed 1; **Hide**: 10 Fluff |
| Vizcacha Bandit | 64–70 | – | **Swipe**: 8 damage, steals 15 seeds a hit; **Pack Up**: 16 Fluff; **Run Off**: runs off |
| Alpha Horned Owl (alpha) | 131–140 | – | **Silent Swoop**: 18 damage; **Screech**: you: Winded 2, 2 Daze to your draw pile; **Talons**: 6 × 3 damage; **Mantle**: 16 Fluff, +2 Zoomies |
| Alpha Grison (alpha) | 64–69 | Pack Bond 3 | **Bite**: 10 damage; **Flurry**: 3 × 3 damage; **Brace**: 9 Fluff |
| The Old Condor (guardian) | 221–232 | – | **Wing Buffet**: 5 × 3 damage; **Updraft**: 16 Fluff, +1 Zoomies; **Rock Drop**: 20 damage; **Great Shadow**: you: Exposed 1, you: Matted 2, 2 Daze to your discard pile |

First fight of the stretch: Cliff Hawk; Mountain Viper; Rock Lizard + Rock Lizard + Rock Lizard. Later fights: Grumpy Armadillo + Mountain Viper; Pampas Cat; Cliff Hawk + Rock Lizard; Rock Lizard + Rock Lizard + Grumpy Armadillo; Vizcacha Bandit; Mountain Viper + Mountain Viper; Pampas Cat + Rock Lizard. Alphas: Alpha Horned Owl; Alpha Grison + Alpha Grison.

### Stretch 3: The Snowline

| Predator | Health | Starts with | Moves |
| --- | --- | --- | --- |
| Andean Cat | 88–96 | – | **Slash**: 12 damage; **Stalk**: 12 Fluff, +2 Zoomies; **Lunge**: 7 × 2 damage |
| Buzzard-Eagle | 92–99 | – | **Rise**: 14 Fluff; **Dive**: 19 damage; **Screech**: you: Exposed 2 |
| Snow Viper | 54–61 | – | **Strike**: 10 damage; **Frost Hiss**: you: Matted 2, you: Winded 1; **Coil**: 8 Fluff, +2 Zoomies |
| Condor Scavenger | 65–72 | Hungry 1 | **Peck**: 7 damage; **Flap**: 4 damage, 8 Fluff |
| Young Puma | 120–130 | – | **Swipe**: 14 damage; **Roar**: +2 Zoomies, you: Winded 2; **Maul**: 8 × 2 damage |
| Ice Beetle | 24–27 | Curl Up 4 | **Bite**: 5 damage; **Slush Fling**: 4 damage, 1 Mud to your discard pile |
| Alpha Puma (alpha) | 176–187 | – | **Maul**: 20 damage; **Rake**: 8 × 2 damage, you: Exposed 1; **Roar**: 12 Fluff, +2 Zoomies |
| Alpha Snowy Owl (alpha) | 164–175 | – | **Blizzard Wings**: 4 × 4 damage; **Hush**: 15 Fluff, 3 Daze to your draw pile; **Talon**: 21 damage; **Glare**: +2 Zoomies, you: Winded 2, you: Matted 2 |
| The Cougar of the Summit (guardian) | 302–314 | – | **Prowl**: 12 Fluff, +1 Zoomies; **Swipe**: 10 × 2 damage; **Maul**: 23 damage; **Roar**: you: Winded 1, you: Exposed 1, you: Matted 1; **Fury**: 16 Fluff, +2 Zoomies, sheds its statuses; **Frenzy**: 6 × 4 damage; **Crushing Maul**: 26 damage |

First fight of the stretch: Andean Cat; Buzzard-Eagle; Snow Viper + Snow Viper. Later fights: Condor Scavenger + Condor Scavenger; Young Puma; Andean Cat + Snow Viper; Ice Beetle + Ice Beetle + Ice Beetle + Ice Beetle; Buzzard-Eagle + Ice Beetle + Ice Beetle; Young Puma + Ice Beetle. Alphas: Alpha Puma; Alpha Snowy Owl.

## Altitudes

Reaching the summit with a chinchilla opens the next altitude for that chinchilla. Each keeps the rules of every altitude below it.

| Altitude | Adds |
| --- | --- |
| Base Camp | The mountain as it is. |
| Altitude 1 | Predators have 6% more health. |
| Altitude 2 | Predators hit 15% harder (rounded down, so the smallest bites are unchanged). |
| Altitude 3 | Naps heal 25%, and beating a guardian mends 70% of the health you have lost, not all of it. |
| Altitude 4 | You set out with a Fright in your deck. |
| Altitude 5 | Guardians have 12% more health, and you set out with 5 less. |

## Chance meetings

| Meeting | Choices |
| --- | --- |
| A Fallen Apple Tree | Heal 18; or upgrade a card of your choice. |
| A Dust Hollow | Take a card of your choice out of your deck; or heal 10. |
| The Vizcacha Trader | Lose 8 health for a trinket; pay 60 seeds for a rare card; or walk on. |
| Something Shiny | Climb for it (60%: a trinket; 40%: lose 10 health, but never your last); or leave it. |
| A Sleeping Fox | Take 80 seeds and a Fright; or take the 15 seeds it dropped. |
| A Hot Spring | Raise max health by 6; or heal a quarter of it. |
| The Old Chinchilla | Gain an upgraded uncommon card; or copy a card of your choice. |
| A Rockslide | Lose 7 health for 45 seeds; lose 3 health to upgrade a random card; or go round. |

## Controls

- Tap or click a card to choose it: its rules, with the numbers as they stand right now, appear under the board. Tap it again to play it.
- A card aimed at one predator is marked on a foe (the last one you aimed at, or the first still standing). Tap a predator to play the card on that one.
- With no card chosen, tap a predator to read its intent and statuses, or tap your chinchilla to read yours.
- Rest the mouse on a card for a note beside it: a big copy of the card, the numbers worked out against the foe it would go at (green where they are above the printed number, red where below), one line for every word on it from the glossary (`GLOSSARY` in the cards file), and what the upgraded card says. It works wherever a card is shown: the hand, rewards, the stall, the piles and the card book. On a phone, hold a finger on the card for about a third of a second; letting go puts the note away without choosing the card.
- The same notes hang off predators (health, Fluff, the next move in words, every status with its count), your chinchilla, trinkets, health, seeds, energy and every stop on the trail. Any press, scroll or key puts a note away.
- **End turn** hands over to the predators. Tap the board, or press Enter, to skip their animations.
- Keyboard: 1 to 9 and 0 choose a card (press again, or Enter, to play it); ← and → change the foe; E ends the turn; Esc puts a card back or closes a list; F changes the animation speed (1×, 2×, 3×); M turns sound on and off.
- **Draw**, **Discard** and **Deck** open the piles. The draw pile is shown in no particular order.
- On a phone the hand is five small cards across (cost, name and picture); the rules of the chosen card are shown above them.

## Code

| Part | File |
| --- | --- |
| Rules: the run, the trail, fights, rewards, stalls, meetings, saving | `lib/summit-shuffle-game.ts` |
| Cards, trinkets and statuses | `lib/summit-shuffle-cards.ts` |
| Predators and which fight where | `lib/summit-shuffle-foes.ts` |
| Drawing: the fight and its backdrops and effects, the painted trail, card pictures, portraits | `lib/summit-shuffle-scene.ts` |
| Predator art shared with Burrow Tactics | `lib/predator-art.ts` |
| Page | `app/summit/page.tsx`, `summit.css`, `sound.ts` |

- The whole run is one `Run` object of plain data. `run.save()` gives it as text and `Run.load(text)` brings it back.
- Chance comes from three seeded streams kept in the run (the trail, loot, and fights), so a seed replays a climb exactly.
- A card is data plus one small `play` function that asks the fight to do things through the `Ops` interface (`hit`, `fluff`, `hex`, `draw` and so on), which `Run` implements. A new card is one `add(...)` or `aimed(...)` line.
- A predator's moves are data and its `next` function picks one; the engine turns the chosen move into the intent shown.
- The engine resolves a card or a whole predator turn at once and lists what happened in `run.events`. The scene's `Stage` plays those back, so the picture lags the engine until its queue is empty.
- The finished fight stays on the run until the stop is left, so its last moments can still be drawn.
- Saves live under `summit-shuffle-v1`: records per chinchilla, the cards and trinkets seen, sound and speed, and the climb in progress.
- The browser tests read the game through `window.__summit()`, which returns `{ run, stage }`.

## Balance

`npm run bot:summit` climbs with a bot. In a fight it tries the orders it could play its hand in on copies of the run, lets the predators answer, and keeps the turn that leaves it best off. Between fights it follows simple rules. On 06-10-2026, over 500 climbs per chinchilla per altitude, it reached the summit:

| Altitude | Dora | Enzo |
| --- | --- | --- |
| Base Camp | 79% | 82% |
| Altitude 1 | 68% | 68% |
| Altitude 2 | 57% | 52% |
| Altitude 3 | 46% | 40% |
| Altitude 4 | 32% | 31% |
| Altitude 5 | 14% | 17% |

- A Base Camp climb took the bot about 55 turns over about 13 fights.
- Averaged by encounter, ordinary fights lasted 2 to 6 turns and cost 2 to 25 health; alphas 5 to 6 turns and 17 to 27 health; guardians 8 to 10 turns and 30 to 33 health.
- Climbs that failed ended at a guardian about five times in six, spread fairly evenly over the three.
- `FIGHTS=1` adds a line per fight; `RUNS` and `LEVELS` set how many climbs and which altitudes.
- `TRIAL=1 npm run bot:summit` measures each card by putting one copy in the deck from the first stop. In the last full trial, at Altitude 1 with a baseline of 70%, the best card added 14 points and the worst took away 7; Light Feet, Burr Storm and Sore Spot were adjusted afterwards. The cards that scored below zero (Belly Flop, Puff Up, Sore Spot) need other cards to work, which the bot does not plan for.

`npm test` fails if either chinchilla reaches the summit from Base Camp in under 50% or over 95% of 80 climbs, if Altitude 5 is not at least 20 points harder, or if the two chinchillas are more than 20 points apart. Rerun the bot after changing any number on a card, a predator or a trinket.

## Known limits

- **Not played by hand.** See the note at the top.
- **One card pool** for both chinchillas; only the starting trinket differs.
- **No potions or one-use items**, and no way to look at a trinket's count-downs (the Running Wheel's third turn, for example) other than counting turns.
- **The bot is a one-turn planner.** It does not save cards for later or build its deck around a plan, so a person who does should find Base Camp easier than its numbers suggest.
