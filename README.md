# Dora & Enzo's Arcade

A collection of twenty-eight original browser games starring Dora (a white chinchilla) and Enzo (a grey one). Pick a cabinet from the arcade menu at `/` and play in the browser, with no install and no sign-in. Three.js renders the 3D games and Canvas 2D the flat ones. Every game keeps its rules in a standalone deterministic engine under `lib/`, which the tests drive directly.

**Chin x Pit** is the sub-brand for the two pit-diving games: Classic (`/chin-x-pit`) and Night Survivors (`/survival`).

## Games

Listed in arcade-menu order.

| # | Game | Route | Genre |
| --- | --- | --- | --- |
| 01 | Paw Fighter II | `/fighter` | Fighting |
| 02 | Dust & Documents: Remake | `/checkpoint-remake` | Inspection |
| 03 | Dust & Documents | `/checkpoint` | Inspection |
| 04 | Spy Escape | `/escape` | Stealth |
| 05 | Bounce / Burrow | `/adventure` | Action RPG |
| 06 | Chin x Pit · Classic | `/chin-x-pit` | Ball-bouncing roguelite |
| 07 | Chin x Pit · Night Survivors | `/survival` | Survival roguelite |
| 08 | Pawprint Grand Prix | `/kart` | Racing |
| 09 | Fluffball Cup | `/soccer` | Sports |
| 10 | Border Hop | `/hop` | Arcade flyer |
| 11 | Dust Bath Dash | `/dust-bath` | Cozy spa |
| 12 | Dora & Enzo’s Mountain Retreat | `/mountain-retreat` | Idle lodge |
| 13 | Paw Buster X | `/paw-buster` | Action platformer |
| 14 | Burrow Town | `/burrow-town` | City builder |
| 15 | Dusty Hollow | `/dusty-hollow` | Village life |
| 16 | Fluff Forge | `/fluff-forge` | Course maker platformer |
| 17 | Fluffstevania: Symphony of the Dust | `/fluffstevania` | Metroidvania action RPG |
| 18 | Chinchilla Clash | `/clash` | Card battler |
| 19 | Hay Maze Defence | `/hay-maze` | Roguelite maze tower defence |
| 20 | Chinchillas vs Zombies | `/chinchillas-vs-zombies` | Lane defence |
| 21 | Chinchilla Scribble | `/scribble` | Word puzzle |
| 22 | Burrow Tactics | `/tactics` | Turn-based tactics |
| 23 | Burrow Barrage | `/barrage` | Turn-based artillery |
| 24 | Summit Shuffle | `/summit` | Deck-building climb |
| 25 | Poof Panic | `/poof` | Versus puzzle |
| 26 | Burrow Express | `/express` | Transport puzzle |
| 27 | Moonlight Mischief | `/moonlight` | Cozy stealth adventure |
| 28 | Pawprint Pinball | `/pinball` | Woodland pinball |

## Run

Use Node 22.13 or newer:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` for the arcade menu, or go straight to any route above. The 3D games need a browser with WebGL 2. Every game has a **MAIN ARCADE** link back to the menu.

## Game guides

Every game uses the same layout: **Play** (what it is), **Controls**, **Tests** and **Docs** (longer write-ups, where one exists).

### 01 · Paw Fighter II (`/fighter`)

**Play:** A one-on-one fighter with seven fighters. Arcade mode is a six-rival ladder. Each match is first to two round wins, and rounds last 60 seconds. Tied rounds award no win. Story mode follows a chinchilla leaving the Andes to chase American citizenship. Rivals appear in a fixed south-to-north order: the burrow in Chile, the Antofagasta docks, the Atacama crossing, the Darien Gap, the Rio Grande at midnight, an ICE checkpoint and the naturalization podium. Narration runs before and after each chapter. Training mode gives infinite power, no round timer, a self-healing dummy (set it to stand, block, jump or fight back) and a live combo-damage readout. Guarding reduces damage, attacks build power, and projectiles can be jumped. Picking a fighter from the roster at any time returns to selection and resets the run. Progress is session-only.

**Controls:**

- A / D or ← / →: move. Space, W or ↑: jump. I, S or ↓: block while grounded.
- J: jab. K: kick. L: special (35 power). U: rising attack (20 power, grounded only). O: super (100 power, grounded only), a staggered barrage unique to each fighter.
- Fireball motion: down, down-forward, forward + J (S, S+D, D+J facing right; mirror with A facing left). Rising attacks also accept forward, down, down-forward + J.
- P / Escape: pause. Losing window focus also pauses. On-screen buttons support touch; sound is toggled from the header.

Each fighter's special (35 power) is shown on its roster card, and an on-screen callout confirms activation or insufficient power:

- Dora: Dust Blossom, a broad, slow dust fireball.
- Enzo: Thunder Chew, a fast, heavy chew bolt.
- Andean Fox: Ember Pounce, a fast ember shot.
- Night Owl: Feather Cyclone, three feathers at different heights.
- Viper: Venom Wave, a low projectile that can be jumped.
- ICE Agent: Red Tape. A hit briefly slows movement; blocking prevents the slow.
- Donald Trump: Golden Tweet, a large, slow, powerful energy wave.

**Tests:** `tests/fighter.mjs` (in `npm test`). Browser: `tests/e2e/fighter.mjs`.

**Docs:** This section.

### 02 · Dust & Documents: Remake (`/checkpoint-remake`)

**Play:** A reimagined edition of Dust & Documents at the North Pass, with its own engine and 3D scene. There are seven seeded shifts. Compare the traveler card, entry permit and verified scale reading against the day's bulletin, then approve or deny. A denial needs at least one selected discrepancy, and every reason given must be true. Correct decisions earn 6 credits and a citation costs 3. Rent is deducted automatically. Between shifts, choose supper: 3-credit hay, or a 7-credit warm meal that adds 20 seconds to the next shift. Shifts are untimed by default. Optional timed shifts last 150 seconds, and the clock pauses while the tab is hidden. There is no detention-for-profit mechanic, no save data and no audio. Restart replays the same queue.

**Controls:** Mouse or touch on the on-screen documents and buttons. There are no keyboard shortcuts.

**Tests:** `tests/checkpoint-remake.mjs` (engine; not in `npm test`, so run it with the commands in the doc). Browser: `tests/e2e/checkpoint-remake.mjs` and `tests/e2e/checkpoint-remake-behavior.mjs`.

**Docs:** [Remake design and scene layout](docs/checkpoint-remake.md) · [verification record](docs/checkpoint-remake-verification.md).

### 03 · Dust & Documents (`/checkpoint`)

**Play:** The original document-inspection game in the spirit of Papers, Please, rendered in 3D. It is set in a lit border booth in the Andes at night. Dora works the window and Enzo works behind her, while travelers walk up the queue to be judged. The permit, traveler card, seal and stamps are physical objects on the sill, and the scale stands outside. Approving slams the green stamp and raises the gate. Denying slams the red stamp, flashes the lamp and sends the traveler back down the queue. Each shift opens with a briefing: the day's rules, the quota and Enzo's commentary. Eight violations appear over seven days: expired permits, closed regions, mismatched names, missing permits, missing seals, padded weights, barred species and suspended purposes. Rules escalate daily. Permits apply from day 1, closed regions from day 2, the scale from day 3, species bans from day 4, seals from day 5 and suspended transit from day 6. Correct calls pay 5 credits, citations cost 7 and detentions pay 1. Rent climbs every shift, from 17 on day 1 to 35 on day 7. Run out of credits and the booth closes. Three endings depend on your final credits.

**Controls:**

- A: approve. D: deny. X: detain a denied violator. Enter: call the next traveler.

**Tests:** `tests/checkpoint.mjs` (in `npm test`). Browser: `tests/e2e/checkpoint.mjs`.

**Docs:** This section.

### 04 · Spy Escape (`/escape`)

**Play:** *Enzo and Dora Escapes from ICE*, a nonviolent 3D stealth escape with an orbiting camera and platform climbing. The pair moves as one. First solve the cage: roll the blue tunnel, take the chew stick, fetch the latch clip and the toy key, and open the wire door. Then sneak through a room patrolled by three ICE agents. Take the exit card at the desk, download intel at the covered terminal and reach the green door together. Guards' vision cones fill an alert meter, and a full meter means capture. Retry restarts at the opened cage with the cage puzzles kept. Nothing is saved between reloads.

**Controls:**

- WASD / arrows: move, relative to the camera. Space: jump onto shelves. Shift: sneak (hides the pair under blue-tinted tables).
- E: interact. R: switch leader (Enzo rolls the tunnel; Dora squeezes into the upper gap). H: hide in the hay feeder. B: dust roll.
- Q: dust decoy (two per attempt). V: cardboard-box camouflage. F: pocket dust stuns the nearest guard for 4 seconds (two charges).
- Z / X or right-drag: orbit the camera. Scroll or + / −: zoom. C: reset the view.
- P / Escape: pause. Switching away also pauses. On-screen controls cover movement, sneaking, interaction, hops and decoys. Sound is optional and off by default.

**Tests:** `tests/escape.mjs` (in `npm test`).

**Docs:** [Controls and full escape route](docs/escape-game.md).

### 05 · Bounce / Burrow (`/adventure`)

**Play:** An isometric action RPG, titled *Dustbound* in game, set across endless procedurally generated floors. Lead Dora (ranged seeds) or Enzo (melee) while the other follows and fights automatically. Shared XP levels the party. Each level gives one skill point to spend in either hero's two branching skill trees. A Great Sweeper guardian appears every third floor. From floor 2, tinted elite machines are tougher and carry one trait each (Swift, Armoured or Volatile). Machines drop gear in three rarities for three slots, and courage potions heal on a cooldown. Running out of courage resets the floor but keeps levels, skills and gear. The adventure is saved in the browser and continues from the start of the floor you were on.

**Controls:**

- Left click floor / enemy: move, or pursue and attack. Hold to keep attacking whatever is under the cursor; hold Shift as well to stand still and attack towards it. WASD / arrows also move.
- Tab: switch hero (1 for Dora, 2 for Enzo). R: target the nearest enemy.
- Right click or F: special (Dora's seed fan, Enzo's whirling paws). Space: dodge. Q: bond burst (costs 50 bond).
- H: courage potion (40% of courage, 8 seconds apart). I: gear and bag (pauses combat).
- E at a cleared chamber's arch: next floor. K: skill trees (pauses combat). Escape or P: pause.

**Tests:** `tests/arpg.mjs` (in `npm test`) covers floor generation and reachability, skills and stances, attack swings and Shift-attacks, elites and their traits, gear forging, equipping and salvaging, potions, saving and restoring, and bot playthroughs of four floors on three seeds.

**Docs:** [Dustbound RPG guide](docs/dustbound-rpg.md). It uses the earlier hero names: White for Dora, Grey for Enzo.

### 06 · Chin x Pit · Classic (`/chin-x-pit`)

**Play:** The original ball-bouncing roguelite, restored separately from Night Survivors. Aim bouncing balls at advancing enemies and catch returning balls for stronger ricochets. Clear twelve waves, defeat the Dustbreaker and descend with your build. There are three starting kits, twenty weapons, eight fusions and six passive items. Progress lasts for the current run.

**Controls:**

- Mouse: aim. WASD / arrows: move both chinchillas.
- Auto-fire is on by default. Toggle it off and hold left click to fire.
- Q / Space: Double Trouble (costs 50 bond). F: fusion lab. P / Escape: pause.

**Tests:** `tests/classic-pit.mjs` (in `npm test`). Browser: `tests/e2e/classic-pit.mjs`.

**Docs:** [Classic restoration evidence](docs/classic-pit-restoration.md).

### 07 · Chin x Pit · Night Survivors (`/survival`)

**Play:** A 3D survival roguelite on an Andean plateau. Foxes, owls and snakes pursue the pair from every direction. Survive three minutes, then defeat the Mountain Cougar to reach dawn. You can continue into harder nights with the same build. Weapons fire automatically. Collect green XP gems to level up and pick one of three upgrades. Equip up to four weapons, each upgradeable to rank 5. There are twelve base weapons and eight evolved forms made by fusing compatible rank-2 pairs. Six passive items stack to rank 3 without using weapon slots. Builds reset on a new run or a reload.

**Controls:**

- WASD / arrows: move both chinchillas. Weapons target nearby predators automatically.
- Q / Space: dust blast (costs 50 bond). F: fusion lab (pauses). P / Escape: pause.

**Tests:** `tests/survival.mjs` (in `npm test`). `tests/pit.mjs` documents the earlier ball-mode rules and is not run.

**Docs:** [Night Survivors guide](docs/night-survivors.md).

### 08 · Pawprint Grand Prix (`/kart`)

**Play:** An arcade 3D kart racer. Dora and Enzo share a kart and race Copper Fox, Night Owl, Sly Snake and Mountain Cougar over three laps of Dust Valley Circuit. Mint crystals near the road center award items, and gold strips on the outside line give boosts. Driving off the asphalt or bumping rivals costs speed. There are three items: Hay Turbo (a three-second boost), Frost Pellet (slows the closest rival ahead) and Dust Bath (slows rivals close behind). The minimap and running order track all five racers.

**Controls:**

- W / ↑: accelerate. S / ↓: brake. A / D or ← / →: steer. The kart follows the circuit's bends automatically.
- Hold Shift while steering at speed to charge a drift. Release after 0.65 seconds for a boost.
- Space: use your item. P / Escape: pause. On-screen hold buttons cover driving and drifting.

**Tests:** `tests/kart.mjs` (in `npm test`).

**Docs:** [Pawprint Grand Prix guide](docs/pawprint-grand-prix.md).

### 09 · Fluffball Cup (`/soccer`)

**Play:** Top-down arcade soccer, four a side. You control Dora's Sky Squad (blue) and pick a mode on the title screen. **The cup** is three knockout rounds: Viscacha United, then Degu Dynamo, then Enzo's Ember FC in the final. Each rival is sharper than the last: faster chasers who read your run, a second defender covering the shot, and a keeper who dives quicker. A cup match level after 90 seconds goes to golden goal. **A friendly** is one 90-second match against Ember FC that can end in a draw. Control follows the blue player receiving or winning the ball, and running into the ball carrier tackles. Keepers dive at shots on target, so long shots get saved and the far corner from close in is the way to score. Passes that arrive and tackles you win fill the Fluff meter; a full meter buys a **Cloud Chip**, a lofted shot that sails over everyone, keeper included. Enzo now and then bursts forward with an **Ember Dash**. Balls rebound off the touchlines, and a shot over the bar is a goal kick; there are no fouls, offside or throw-ins. Full time shows shots and possession, and the page remembers cups won and the furthest round reached.

**Controls:**

- WASD / arrows: move. Shift: sprint while stamina lasts. Mouse: aim shots.
- J: pass. K / Space: shoot. L: Cloud Chip (with a full Fluff meter). Tab: switch to the teammate nearest the ball.
- P / Escape: pause. Touch buttons cover movement, sprint, pass, shoot, chip and switching.

**Tests:** `tests/soccer.mjs` (in `npm test`). Browser: `tests/e2e/fluffball-cup.mjs`.

**Docs:** [Fluffball Cup guide](docs/fluffball-cup.md).

### 10 · Border Hop (`/hop`)

**Play:** A Flappy Bird-style flyer. Dora and Enzo fly together on paper wings across a desert and must pass 20 striped checkpoint gaps to reach the welcome gate. A point is awarded only when both clear a checkpoint, and each checkpoint is worth 100. A **Perfect Pair** bonus of 50 is earned when both cross near the gap center. Hitting a column, the ground or the ceiling ends the flight. A brief freeze shows who clipped it. Your best score is saved in this browser when storage is available.

**Controls:**

- Space, ↑, W, or tap/click the canvas: flap. Release to descend.
- P / Escape: pause. Switching away also pauses. Sound is optional and off by default.

**Tests:** `tests/flappy.mjs` (in `npm test`).

**Docs:** [Border Hop guide](docs/border-hop.md).

### 11 · Dust Bath Dash (`/dust-bath`)

**Play:** Dora and Enzo run a gentle dust-bath spa. Pick a waiting guest and an empty bath, then scrub. Release in the striped sweet spot (about 1.3 seconds) to earn up to 12 coins. Too short needs another try. Too long makes the guest sneeze and splash occupied neighboring baths, which cuts their tips. Enzo's treats restore patience and remove one splash. His refill restocks six dust scoops and three treats after three seconds. You can play two-minute shifts or an untimed cozy mode. Between shifts, buy cloud towels (30 coins: wider sweet spot, less mess), a golden scoop (40 coins: one-second refills) and fern decor (25 coins: more patience). Coins and upgrades last for the page visit, not after a reload.

**Controls:**

- Select guests and baths with touch, mouse or keyboard.
- Hold **SCRUB** (touch, mouse, Space or Enter) and release in the sweet spot. Optional two-tap scrubbing avoids holding.
- Pause and the guide stop the simulation. Switching tabs pauses and cancels a held scrub. Reduced motion is respected.

**Tests:** `npm run test:dust-bath` (also in `npm test`). Browser: `tests/e2e/dust-bath.mjs`.

**Docs:** This section · [acceptance checklist](tests/dust-bath-acceptance.md).

### 12 · Dora & Enzo’s Mountain Retreat (`/mountain-retreat`)

**Play:** A responsive, pixel-styled idle game set in a cutaway of Juniper Lodge. Dora handles hospitality and Enzo handles supplies. Open the kitchen, suite and alpine bath, then raise all four rooms to level 3, which takes 5 to 10 minutes. Supplies feed automatic guest visits, which earn hearts and tips. Dora and Enzo walk between the open rooms, and before each visit one visiting chinchilla per open room walks up the path and settles in. Welcome serves a guest every 6 seconds. Comfort serves every 10 seconds for triple hearts. Enzo delivers supplies every 2 seconds: Gather brings 3, while Craft with care brings 1 but earns 50% higher tips and turns 2 supplies into an oat cake or herbal soap every 6 seconds.

Every visit has a featured guest with a wish: a room, sometimes an oat cake or herbal soap, and sometimes Extra comfort. A guest book shows who is coming next. Granted wishes earn bonus tips, hearts and reputation. Unmet wishes cost 1 reputation, and guests turned away for lack of supplies cost 3. Every 20 reputation adds a star (up to 5), which unlocks new guest types and bigger tips. At level 3 each room picks one of two specialties. Regulars Pip, Mochi and Luna return every fifth visit and send postcards at friendship 3, 6 and 10, and every featured guest fills a coat album. Seasons change every 6 minutes of lodge time and night falls every 2 minutes, each with its own bonus. Stargazers only come at night, and winter closes the summit. A ? beside tips, hearts, supplies and the rating breaks each number down. A countdown ring shows the next guest arriving, and a season strip shows the time until the next season and until nightfall. Each visit shows its rewards floating over the room and marks coats that are new to the album. After time away, a summary lists what happened. Soft synthesized sound is available and off by default. Guests wear an accessory for their type, show their wish in a bubble as they arrive, and react to how their stay went; regulars wear name tags. The scene has seasonal weather, stars and a rooftop stargazer at night, art for each room specialty, six summit decorations on the lodge, a backdrop for each outing, the occasional mountain viscacha, and chimney smoke that grows with the number of guests.

Every guest you see can be clicked to open a profile: a name, home village, bio, wish, friendship and album status. The guest in a room can be offered an oat cake or herbal soap once per visit, for +3 hearts and +2 tips; a treat for a regular also adds friendship. Nine lodge goals (such as reaching 3 stars, hosting 3 festivals or rescuing a lost hiker) each pay tips once, leave a keepsake by the lodge and raise its title, from Mountain hut up to Legend of the Andes. Every 3 minutes of lodge time a surprise may arrive: a storm (+50% tips and +1 heart per room), a travelling musician (+2 hearts per room), or a lost hiker to rescue on a 20-second outing for +40 tips and +8 reputation. Two optional mini-games pay small bonuses: pouring tea into the gold band (up to +25 tips, once a lodge minute) and catching the season's weather (+1 tip each, up to 15, every 90 lodge seconds). A camera snaps the scene into a scrapbook of up to 12 photos with editable captions.

On screens at least 1024×640 the game fits one screen without scrolling. The lodge scene is on the left, and seven tabs on the right hold everything else: Hosts, Rooms, Trips, Fun, Guests, Goals and Scrapbook. A dot marks a tab with something waiting. Narrower screens keep a scrolling page with the same tabs. Dora learns from every guest and Enzo from every day of work. At levels 2 to 5 each picks one of two skills, such as Tip jar, Kind words, Strong back or Tinkerer. The Goals tab has a daily wish list of three requests, the same for every player on a given day; finishing all three pays +100 tips, +10 hearts and +3 reputation once. Pip, Mochi and Luna each have a three-part story that unlocks at friendship 3, 6 and 10. Each season hosts its own festival: the Blossom fair (stocks the pantry), Midsummer lanterns (half as much again), the Harvest feast (+40 supplies) and the Snow-lantern night (+10 reputation). A tenth lodge goal rewards hosting all four.

All outings pause normal production:

- Glass lake: 25 seconds. Costs 5 supplies and returns 18 supplies, 12 tips, an oat cake and a herbal soap.
- Juniper trail: 45 seconds. Costs 12 supplies and returns 48 supplies plus 35 tips.
- Condor summit (2 stars, not in winter): 90 seconds. Costs 30 supplies and returns 60 supplies, 90 tips, 10 hearts and a lodge decoration worth +1 tip per visit.
- Festival: 60 seconds. Costs 12 hearts and 20 supplies and returns 110 tips, 24 hearts and 5 reputation, plus the season's twist: 2 oat cakes and 2 soaps in spring, half as much again in summer, +40 supplies in autumn, or 10 reputation instead of 5 in winter.

Progress is saved locally under `dora-enzo-mountain-retreat-v1` (save format version 4; older journals upgrade automatically). The scrapbook is stored separately under `mountain-retreat-scrapbook`, with offline progress capped at eight hours. Malformed saves start fresh. The light/dark theme choice is stored separately under `mountain-retreat-theme`. There is no account and no network service. Play in one tab, because cross-tab conflicts are not resolved.

**Controls:**

- Native keyboard and touch buttons with visible focus and selected-state announcements.
- Tabs switch the side panel. With a tab focused, the arrow keys, Home and End move between tabs.
- Click or tap any guest to open their profile. Escape or "Close profile" closes it and returns focus to the guest.
- Keys 1–4 set the hosts' duties: 1 Welcome, 2 Extra comfort, 3 Gather, 4 Craft with care. They are ignored while a form control has focus.
- The field guide explains the economy, and each ? opens a breakdown that works with touch, keyboard and screen readers. Reduced motion is respected.

**Tests:** `npm run test:mountain-retreat` (also in `npm test`). Browser: `tests/e2e/mountain-retreat.mjs`, `tests/e2e/mountain-retreat-theme.mjs`, `tests/e2e/mountain-retreat-scene.mjs`, `tests/e2e/mountain-retreat-depth.mjs`, `tests/e2e/mountain-retreat-ux.mjs`, `tests/e2e/mountain-retreat-scenery.mjs`, `tests/e2e/mountain-retreat-fun.mjs` and `tests/e2e/mountain-retreat-layout.mjs`.

**Docs:** [Mountain Retreat validation and known limitations](docs/mountain-retreat-validation.md).

### 13 · Paw Buster X (`/paw-buster`)

**Play:** A Mega Man X-style side-scrolling action platformer. Dora (blue armour) fires a paw buster that charges through two levels: a tap shot deals 1, a half charge (0.55 s) deals 2, and a full charge (1.4 s) deals 4 and pierces. Enzo (red armour) swings a whisker saber for 3 (4 on every third swing), and his swings cut enemy shots out of the air. Both heroes run, dash, dash-jump, wall-slide and wall-jump. Each has separate health (16 to start). Tag your partner in at any time for a two-second tag strike that deals ×1.5 damage; when one hero falls, the other tags in automatically, and the run ends only when both are down. Kills, weakness hits and hits of 4 or more freeze the action for a moment.

Pick any of six maverick stages: Snowcap Ridge (Frost Fox), Cloud Forest (Storm Owl), Ember Caldera (Magma Snake), Crystal Mines (Quartz Armadillo), Salt Flats (Volt Vicuña) or Titicaca Falls (Tide Toad). Each has checkpoints, beetles, bats, turrets or hopping frogs, chain-hung ceiling turrets, shielded walkers (their shield stops weak shots from the front, so hit them from behind or with a charged shot) and bombers that drop bombs which burst into shock waves, plus pits and spikes (6 damage each; a pit puts you back on the last safe ground) and a boss room that seals behind you. Halfway through each stage a guardian mid-boss (20 health, 30 on hard) blocks the way with a three-way volley and a shock-wave leap, and drops health and weapon energy when it falls. Each maverick takes triple damage, and flinches, from another maverick's weapon; the Quartz Armadillo deflects every other shot while it rolls. Once you've found a boss's weakness, its health bar names it, and the pause screen lists which boss each weapon beats. Beating a maverick also changes another stage: the Frost Fox freezes Titicaca Falls' pits into ice, the Tide Toad cools Ember Caldera's spikes into rock, and the Storm Owl takes the bats with it from the Salt Flats.

Beating a maverick gives its weapon (28 energy, 2 per shot): Frost Shard pierces, Gale Feather fires a fan of three, Ember Coil rolls along the ground, Quartz Orbit circles you with three crystals for 3 s that block enemy shots, Volt Spark curves toward the nearest enemy, and Bubble Burst fires two rising bubbles that pass through enemies. Hold fire to charge a special weapon for 4 energy: an ice wall that blocks shots for 3 s, a slow tornado, a pillar of fire, six crystals bursting outward, three homing sparks or one giant bubble. Special weapons tint the heroes' armour.

Hidden in the stages: a heart tank in each maverick stage (+2 maximum health for both heroes, up to 28); sub-tanks in Cloud Forest, Ember Caldera, Crystal Mines and Titicaca Falls, which store health picked up beyond your maximum (up to 16 each) and heal you from the pause screen; and five armour parts. The Dash Boots (Salt Flats) give one air dash per jump and the Saber Crest (Crystal Mines) turns Enzo's dashing slash into a 5-damage dash slash; the other three sit in capsules behind walls only a later weapon opens, so cleared stages are worth revisiting: the Scout Helmet (Cloud Forest) is up a waterfall you float with Bubble Burst and outlines hidden walls and points arrows at items you haven't found, Body Armour (Ember Caldera) is behind a crystal wall that Quartz Orbit shatters and takes a quarter off every hit and all of its knockback, and the Arm Cannon (Snowcap Ridge) is behind a dead power door that a Volt Spark opens and gives Dora a third charge level, a 6-damage spiral shot at 2.4 seconds. The last two sit at the bottom of trenches most heroes dash-jump straight over. Crystal Mines, the Salt Flats, Titicaca Falls and the citadel also hide small stashes under a patch of ground that looks solid but isn't: drop through it and jump back out. The pause screen names the wall each missing capsule sits behind once you hold the weapon that opens it. Enemies drop health (+6) and weapon energy (+8).

Clearing all six mavericks opens the Cougar Citadel; saves that already beat it keep it open. It has three sectors, each ending in a teleporter, and health and weapon energy carry from one to the next: the outer wall; the conveyor works, with conveyor belts, crushers (4 damage) and moving platforms; and the throne room. Its boss room is a rush: all six mavericks again with 16 health each and a health capsule between fights, then the Cougar Kingpin (44), who switches to the mavericks' lightning, sparks and crystals below half health. A retry restarts the rush at the boss you lost to.

Every clear is graded. A stage rank from S to C comes from up to three points for the time medal (each stage shows its gold, silver and bronze target times), three for taking little damage and two for clearing out the enemies, and the best rank and medal are kept. Four challenge badges are shown on each stage card: Untouched (beat the boss without taking a hit in its room), Buster only (clear it without firing a special weapon), Dry tanks (beat the Kingpin without drinking a sub-tank) and Hard clear.

Options on the stage select: a difficulty of easy (half damage, and pits don't hurt), normal, or hard, which unlocks once the citadel falls and gives enemies and bosses half again as much health, faster patterns and an extra aimed volley after every move; two players; music; a best-time ghost; screen shake; and separate sound-effect and music volume sliders. Every special weapon has its own sound. In two-player co-op Dora and Enzo are both on screen with their own health and weapons and can't tag; a fallen player can be revived by standing beside them for two seconds or by reaching the next checkpoint, and the run ends when both are down. A single-player run that sets a new best time without a retry is saved as that stage's ghost, which replays translucently alongside you next time. The boss gallery refights any boss you've beaten on its own, with its own best time, and beating the Kingpin rolls an ending and the credits. Progress lives in three save slots, and a save code copies a slot to another browser. Cleared stages, collectibles, found weaknesses, best times, ranks, medals, badges, ghosts, options and key bindings are saved in this browser.

**Controls:**

- ← → or A D: move. Space, K or Z: jump (hold for height; jump against a wall to wall-jump; hold it in a waterfall with Bubble Burst to float up).
- T, J or X: fire (hold to charge Dora's buster or any special weapon; Enzo slashes). Y, L, C or Shift: dash (hold while jumping to dash-jump; with the Dash Boots, press it in mid-air).
- U, V or I: tag your partner in. T, Y and U sit together above the WASD keys, so the left hand can move while the right hand fires, dashes and tags; or move with A and D and use T, Y and U with the right hand. Q / E: switch weapon. P / Esc: pause (sub-tanks are used from the pause screen). Enter retries after a defeat.
- **Customise keys** on the stage select moves any action to a key of your choice (P, Esc, Enter and Tab stay reserved).
- Co-op player 2 (Enzo): ← → move, ↑ jump, . fire, / dash, [ ] switch weapon (or numpad 0, 1 and 2 to jump, fire and dash).
- Gamepad: d-pad or left stick to move, A jump, X fire, B or RT dash, Y tag, LB / RB switch weapon, Start pause (or retry after a defeat). In co-op the first gamepad plays Enzo and the second Dora.
- Touch screens and narrow windows get an on-screen pad. Sound is optional and off by default; music plays while sound is on.

- Co-op: stand beside a fallen partner for two seconds to revive them.

**Tests:** `npm run test:paw-buster` (also in `npm test`). `npm run bot:paw-buster` (also in `npm test`, about 30 s) plays the game with the engine: it searches every sector for the ways a hero can move and checks the route to each boss door can be walked without upgrades and every item can be reached with them, then fights each boss with a keep-your-distance bot and prints the route and fight times the medal targets are based on. Browser: `tests/e2e/paw-buster.mjs`.

**Docs:** This section.

### 14 · Burrow Town (`/burrow-town`)

**Play:** A cozy 3D city builder on a 16×12 tile Andean valley, rendered with Three.js. Every valley starts with one plaza and 120 hay. A building only works when it is linked: it must touch a road that leads back to a plaza, or sit beside one. Anything unlinked flies a red marker and earns nothing, and unlinked homes empty out. Roads cost 4 hay, bridges over the river cost 12, and roads cannot cross rock. Hovering a tile names what stands there and, when a building is idle, says why.

There are two resources. **Hay** feeds everyone: farms earn 3 a tick, 4 on a terrace and 1 more beside the river, and each resident eats 0.2. Every third day is dry, and farms away from water grow half as much that day. The granary only holds 300 hay, and anything above that spills, so a big town needs silos at 250 each. **Stone** comes only from quarries on rock, 2 a tick, and pays for the bigger buildings: 20 for a big burrow, 25 for a plaza, 15 for a watchtower, 10 for a workshop. A workshop mills 4 hay a tick when a linked quarry is within 4 tiles and there is stone in store, burning 1 stone each tick; with no stone to cart it manages 1. Markets earn 1 a tick per 3 residents within 4 tiles, up to 8.

Comfort decides how full a home gets. Every amenity casts desirability over its radius, strongest right beside it and fading with distance: dust baths and gardens 1.5, plazas 1.6, watchtowers 1.4. Quarries and workshops cast the same thing negative. A home adds up the best of each kind in range, and the rounded total from 0 to 4 is its comfort, filling it to 40, 60, 80 or 100 per cent of its beds. A home at comfort 4 is delighted and brings in a little extra hay. Residents arrive one a tick and take a name as they move in.

Dora and Enzo each keep three wishes open between them, drawn so both are always asking for something. Dora wants homes, dust baths in range, gardens, happiness, quiet, big burrows and delighted homes; Enzo wants quarries, farms, stored hay, stored stone, silos, income, markets, workshops, watchtowers and terrace farms. An advisor never asks for something they have not unlocked, or for something the valley cannot give. Granting a wish pays 15 or 20 approval and the same in hay, and approval unlocks buildings: Dora gives gardens at 25, big burrows at 50 and extra plazas at 75; Enzo gives markets at 25, workshops at 50 and watchtowers at 75. Clearing a tile refunds half; a ruin is worth nothing and the last plaza cannot be cleared.

Seven valleys unlock in order, each with a population goal and an approval both advisors must reach: Meadow Hollow (20 residents, 25), Silver Creek (40, 40), Terrace Steps (60, 50), Old Orchard (70, 55), Condor Shelf (90, 60), Canyon Split (100, 65) and Lake Titicaca Shore (120, 75). Old Orchard and Canyon Split are scattered with derelict buildings that rebuild for half price, and Canyon Split's river runs bank to bank, so nothing on the far side works until it is bridged. Meeting a goal completes the valley and offers the next, or you can stay and keep building. The Open Valley sandbox has no goal. A day lasts 2 minutes at normal speed, lamps light after dusk, and Dora, Enzo and the residents wander the roads. Three save slots keep their own town, saved in this browser every few seconds.

**Controls:**

- Click or tap a tile to use the selected tool. A green ghost means it fits, red means it doesn't, and the tile card at the bottom left says why. Road and Clear paint while you drag, and a whole drag undoes as one action.
- Tools: 1 burrow, 2 hay farm, 3 dust bath, 4 garden, 5 big burrow, 6 plaza, 7 quarry, 8 silo, 9 market, 0 workshop, T watchtower, R road, X clear. Escape returns to the road tool.
- Z undoes, up to 25 actions back. Undo puts back only what that action changed: the clock keeps running, residents who moved in elsewhere stay, and an advisor pleased in the meantime stays pleased.
- `,` and `.` step the clock between ×1, ×2 and ×4. Space or P pauses.
- Camera: drag, WASD or arrows to pan; right-drag, Q and E to rotate; scroll, pinch, + and − to zoom. The ⌂ button resets the view. On-screen buttons cover pan, rotate and zoom for touch.
- Sound can be toggled from the header. The Valleys button returns to the valley menu and keeps the save.

**Tests:** `npm run test:burrow-town` (also in `npm test`) compiles `lib/burrow-town-game.ts` and runs `tests/burrow-town.mjs`: 33 checks covering terrain generation, road and bridge costs, terrain rules, plaza connectivity, hay and stone economies, the granary cap and spill, dry days, workshop carting, comfort and occupancy, approval unlocks, wish completion and replacement, ruins, undo, demolition refunds, pause and speed, winning, the sandbox, named residents and save round-trips. `npm run bot:burrow-town` (also in `npm test`, about a second) plays every valley with the engine to prove each one can actually be finished, and checks that no single building carries a town: six workshops with no quarry earn less than three with one, and farm spam without silos stalls at the granary.

**Docs:** [`docs/burrow-town.md`](docs/burrow-town.md).

### 15 · Dusty Hollow (`/dusty-hollow`)

**Play:** A cozy top-down village-life game on a fixed 32×24 tile seaside hollow, drawn with Canvas 2D in a soft storybook style: one palette across the whole village, one light from the upper left so every shadow falls the same way, paper grain over the ground instead of a checkerboard, feathered joins between grass, path, sand and water, ink outlines on anything that stands up, and a warm grade and vignette over the finished frame. Dora and Enzo move in together. You steer one and the other walks a step behind; press X to swap at any time, or turn the escort off in Settings and they keep neighbour hours like everyone else. Both wear name tags, and the one you are steering reads “(you)” in amber. Burrow Works next door holds your house loan and keeps a list of eleven things to try, each paying raisins when you first do it. A day lasts 6 minutes of real time and seasons change every 4 days, or switch on the live clock in Settings and the hollow follows your real time and calendar (with Andean seasons, so December is summer). Roughly one day in four is rainy, snowy in winter. Fruit trees drop 3 apples a day; foreign fruit (pear, peach, cherry, orange) comes from neighbours and wishes and sells for 500 instead of 100, before Vito’s fruit market, which pays 70% to 150% depending on the day. Planting a fruit with the shovel grows a new tree in 3 days, and about one foreign sapling in eight grows into a golden tree whose three daily fruit sell for 1,500 each (they cannot be planted). Four money rocks pay 25, 50, 75 and 100 raisins for four shovel hits a day. Three fossils are buried each morning; they come up unidentified and Bubo at the museum assesses them for free, one at a time, saying what each is worth and whether the museum already has one. Three shells wash up on the sand each day.

**Fishing:** cast into the river, pond or sea and a shadow shows how big the fish is (three sizes by value). Up to two nibbles dip the bobber first; pressing on a nibble spooks the fish. On the real tug, press within 0.9 s to hook it, then hold the action button to reel and let go when the line strains: reeling adds progress and tension, easing off drops both, and big fish fight harder. The line snaps at full tension and the fish slips if progress falls to nothing. The 18 fish depend on the water, the season and day or night, from a 100-raisin pond frog to a 7,000-raisin tuna, with a rare pejerrey in autumn rivers. Every season also hides a jackpot that surfaces only on its festival day, and only once: the Golden Dorado (9,000) in the spring river, the Hercules Beetle (11,000) under the summer trees, the Great Zúngaro (12,000) in the autumn river and the Titicaca Water Frog (10,000) in the winter pond. The board announces the day's jackpot and says when someone has landed it. The 15 bugs spawn by season, time and habitat (grass, trees, flowers, water), up to six at once, and notice you: running within a tile or so scares any bug off, and the rare ones (stag beetle, winter moth) flee even from a walker who gets within a tile, but a sneaking hero (C or Ctrl, 1.2 tiles a second) can get within half a tile. Snails only come out in the rain; winter has moths and snow fleas. Flowers can be picked bare-pawed, or watered so that two watered neighbours may breed overnight: red and yellow can make orange, red and white pink, white and yellow purple, and white and white blue, and hybrids sell for 400 instead of 40.

**Shaping the hollow:** the Trowel (2,400 at Vito’s) is the landscaping tool. On clear grass it lays a path stone, and on a stone you laid it lifts it again, so you can run your own paths anywhere; the village’s original street is not yours to dig up. On a tree it digs the whole tree up and hands back its fruit, which replants elsewhere and takes the usual 3 days to bear, so moving an orchard costs you time rather than nothing. With a piece of furniture selected it stands that piece out in the hollow, where it is drawn exactly as it is indoors and counts toward Vito’s Home Rating; bare paws or the trowel take it back. Paving, moved trees and everything standing outside are saved with the village.

**The ending:** when every goal on the list is ticked, all 41 species are on display and every neighbour is a Best friend, the whole village comes up the street at dusk with lanterns and says its piece. Nothing stops afterwards: the seasons keep turning and the hollow is still yours.

**The hollow:** Vito’s Emporium (open 8:00 to 22:00) buys anything and sells the shovel (600), watering can (400) and trowel (2,400), red, yellow and white seeds (80) and three rotating pieces of furniture a day from twelve in three sets (Cabin, Seaside, Andean). One day a season, announced on the board the day before, is a sale: fruit pays 150% and one piece in stock is half price. The museum takes one of each of the 41 species; completing a wing (all 18 fish, 15 bugs or 8 fossils) pays 3,000 raisins and a plaque for your burrow. Your pockets hold 20 things (the counter turns amber with three or fewer free); pin an item to keep it out of “sell everything”, and O sorts them. Four neighbours (Pia the flamingo, Rodri the fox, Vivi the viscacha and Tato the condor) are out from 7:00 to 22:00 and keep a schedule: mornings near home, afternoons at a favourite spot (Pia by the sea, Rodri in the orchard, Vivi in the flower meadow, Tato on the cliff path) and evenings on the street or by the shop; the board and the Neighbours card say where each one is. Each has a favourite kind of gift and a daily request, and two more (Lupe the llama, Nico the Andean cat) move into empty plots once 4 and 8 goals are done. The first chat of the day is +1 friendship, a gift +1 or +3 if it is their favourite and nothing if you gave them the same thing recently (they remember your last three gifts and sometimes mention them), a delivered request +3 plus 300 raisins or a foreign fruit, and a gift on their birthday +5 more. At Best friend (10 hearts) a neighbour tells you where they came from and hands over a framed photo of themselves for the burrow, once each. The notice board by the street lists today’s festival or the countdown to it, birthdays, the fruit market and sale, Vito’s Home Rating for your room, tomorrow’s weather, the balloon, who is visiting whom, where everyone will be in the afternoon and the weather. On about two clear days in five a balloon drifts in from the west in the early afternoon; select a fruit or shell and press the action button as it passes overhead to pop it for a piece of furniture or 500 raisins. Festivals fall on the last day of each season: a Fishing Tourney in spring and autumn and a Bug-Off in summer score everything you catch that day by value against the neighbours (3,000, 1,500 and 500 raisins for the top three, and a Festival Trophy for first), and Snowman Day in winter scatters three snowballs to roll into snowmen for 500 each. On clear summer nights after 20:00 a shooting star crosses the sky every so often; press the action button with nothing in front of you to wish, and next morning brings 300 raisins, a foreign fruit, a piece of furniture, a hollow that likes you a little more or a clear sky.

The loan runs 4,800 for the tent, 19,800 for the Cozy Burrow and 49,800 for the Roomy Burrow, paid in any amounts at Burrow Works; each payoff moves you up and grows the room from 3×2 to 4×2, 4×3 and 5×3 tiles. Inside, the burrow is drawn as a room you look into: canvas walls in the tent and plaster in the burrows, a window showing the same sky and weather as outside, floorboards, and every piece of furniture drawn rather than listed. Click a piece from your pockets and then a floor tile to place it, click a placed piece and another tile to move it, or click it twice to pick it up. The paper lamp casts a pool of light, brightest at night, and the pebble stove burns; place either and it shows from the street too, as a warmer window or a smoking chimney. Three placed pieces from one set pay a one-time 1,000-raisin bonus, and Vito rates the room from “Bare but honest” to “The talk of the hollow”. Neighbours at Friend level or better may follow you in once a day to admire it (+1 friendship). Sleeping at home skips to 7:00 the next morning (not in live mode) and shows a summary of the day: catches, gathering, the most valuable single find, raisins earned and friendship gained. The first morning of each season shows a title card, and the ambient pad changes key with the season. Sound is a written tune, one phrase per season played over an ambient pad that changes with the time of day, an octave lower and thinner at night and softer in the rain, plus rain and sea loops, with separate music and effects sliders. F enters photo mode, which hides the interface and offers a PNG download of the view. The game autosaves in this browser every few seconds.

**Controls:**

- WASD or arrows: move. Shift: run. C or Ctrl: sneak (slow, but shy bugs let you closer). X: swap between Dora and Enzo, who trade places. Space, E or Enter: use the tool the target needs (the game swaps to it if you own it), talk to a neighbour in front of you, shake a tree, pick up a shell, read the board, enter a door when facing it or throw the selected fruit or shell at a balloon overhead. Hold it to reel a hooked fish. The line under the map always says what you are facing and what the button will do.
- 1–6 or Tab: choose bare paws, net, rod, shovel, watering can or trowel (the last three must be bought). Click a pocket to select an item for gifting, planting or pinning; O sorts pockets.
- In a conversation, 1–3 pick a reply and Space takes the last one. Escape closes conversations, leaves the shop, museum, board or burrow and closes the passport, the day summary and photo mode. P opens the passport of everything caught. F toggles photo mode.
- On-screen arrows, a swap button, a sneak toggle and an action button appear on touch screens and narrow windows; hold the action button to reel. Sound can be toggled from the header, and Save & quit returns to the title screen.

**Tests:** `npm run test:dusty-hollow` (also in `npm test`) compiles `lib/dusty-hollow-game.ts` and runs `tests/dusty-hollow.mjs`: 52 checks covering the fixed map and bridge, walking, running and collisions, the clock, seasons and deterministic weather, fruit trees with effects and reactions, nibbles, biting, hooking and reeling, fish filtered by habitat, season and time, bug spawning, fleeing and netting, money rocks and tool auto-swap, fossil assessment and museum donations, flower watering, breeding and hybrids, planting, pockets with pins and sorting, the shop’s hours, prices, stock and fruit market, the room grid, the loan ladder, neighbour chats, gifts, memory and requests, birthdays, late arrivals, wandering and bedtime, the notice board, festivals, Snowman Day, shells, shooting stars, the facing hint, live mode, goal rewards, v1 to v3 save round-trips, deterministic replays, villager schedules, the friend’s fishing remarks, home visits, the forecast and sky-clearing wishes, museum wing rewards, furniture sets and the home rating, golden trees, sale days, sneaking, one-at-a-time assessment, the five wish outcomes, balloons, the day summary, the pocket warning, the season title card, the festival-day jackpots and their one-a-day limit, Best-friend keepsakes, the summary's best find, the two chinchillas moving in together with a following companion, the swap and the escort setting, paving and lifting paving, digging up and replanting trees, furniture standing outside, and the closing ceremony. `npm run bot:dusty-hollow` (also in `npm test`) plays the engine to prove every fish and bug can be caught in its listed window, that a year of fishing pays off the whole loan ladder, and that a full year runs all four festivals.

**Docs:** [`docs/dusty-hollow.md`](docs/dusty-hollow.md).

### 16 · Fluff Forge (`/fluff-forge`)

**Play:** A Mario Maker-style course builder, drawn in Canvas 2D. Build a side-scrolling course on a grid 15 tiles tall and 25 to 240 tiles wide, then run it as Dora or Enzo. Dora jumps higher (her held jump rises about three and a half blocks) and Enzo runs faster (155 pixels a second at a run against her 135); press C at any time to tag the other one in: they dash in from behind, the two boop noses and your partner runs off, and you keep control throughout. Jumps go higher the longer you hold the button and the faster you are running, and a jump still counts for a moment after you step off a ledge.

There are 19 parts in five groups. **Terrain:** ground, stone, ice (slow to speed up and slow to stop), cloud ledges you jump up through and stand on (hold down to drop through), drifting clouds three tiles wide that swing 40 pixels each way every 4 seconds and carry you, and cactus spikes that hurt from any side. **Blocks:** adobe bricks, raisin blocks, clover blocks and feather blocks, all bumped from below; a bump also flips any enemy standing on top. **Items:** raisins and springs (a spring throws you about four and a half tiles, much higher if you hold jump as you land). **Enemies:** beetles walk and turn at walls, frogs hop toward you every 1.1 seconds, bats chase you once you are within about ten tiles, and prickles walk, turn at ledges too and cannot be stomped. Stomping bounces you up, higher with jump held. **Markers:** one start, one goal flag and any number of checkpoints.

A clover makes you big: bricks break when you bump them and a hit shrinks you back with 1.5 seconds of safety instead of ending the try. A condor feather does the same and adds one extra jump in the air, and holding jump while falling floats you down. A second hit, spikes while small, a pit or the timer (100 to 500 seconds, set per course) ends the try: the course resets and you start again from the last checkpoint touched, keeping the raisins you had there. Clearing a course shows your time, raisins and number of tries.

Four starter courses show what the parts can do: Dora’s First Hop (meadow), Salt Flat Sprint (salt flats), Night Cave Crawl (cave) and Snowcap Summit (snow). Best times are kept for starters and your own courses.

**Making and sharing:** the editor has a parts palette, a title, theme, timer and width, undo and redo, and saves every change in this browser. Terrain paints as you drag; enemies and markers go down one per click, and placing a start or goal moves the old one. **Test play** runs the course from its start; **Test from here** starts at the left edge of the view for practice and never counts. Like Mario Maker, a course has to be cleared from its start by its maker before it can be shared: the first clear of each version unlocks a **Share** button with a code beginning `FLUFF-`, and any edit locks it again until you clear the new version. The code carries the whole course, so nothing is uploaded. Paste a friend’s code under **Play a friend’s course** to play it, or save it to your courses to edit it.

**Controls:**

- ← → or A D: move. Space, Z, W or ↑: jump (hold for height). Shift or X: run. ↓ or S: drop through a cloud ledge. C: tag Dora or Enzo in. P or Escape: pause. R: restart the course.
- Gamepad: d-pad or left stick to move, A jump, X or B run, Y tag, down to drop through.
- On touch screens and narrow windows an on-screen pad has move, drop, tag, run and jump.
- Editor: click or drag on the course to place the selected part; right-click erases (or pick the eraser). Scroll with the slider under the course, ← → or A D (hold Shift for bigger steps) or the mouse wheel. Ctrl+Z undoes, Ctrl+Shift+Z or Ctrl+Y redoes.

**Tests:** `npm run test:fluff-forge` (also in `npm test`) compiles `lib/fluff-forge-game.ts` and runs `tests/fluff-forge.mjs`: 24 checks covering the parts list, the starter courses, share codes (round trips, whitespace, unicode titles and every kind of broken code), painting with one start and one goal, resizing, walking and running speeds and each hero’s jump, variable jumps and coyote time, bumping raisin blocks and bricks, clovers, hits and restarts, stomping each enemy, bumping enemies off blocks, walkers turning at walls and ledges, cloud ledges, springs, spikes, ice, drifting clouds, the feather, checkpoints, pits and the timer, clearing and tagging, the tag scene and dust and sparkle effects, and independent clones. `npm run bot:fluff-forge` (also in `npm test`) runs a search over the real engine to prove every starter course can be cleared by both heroes without dying. Browser: `tests/e2e/fluff-forge.mjs` plays a starter, builds a course, test-plays it, checks the clear check unlocks a share code that survives a reload and relocks on an edit, imports the code and drives the touch pad on a phone-sized screen.

**Docs:** [`docs/fluff-forge.md`](docs/fluff-forge.md).

### 17 · Fluffstevania: Symphony of the Dust (`/fluffstevania`)

**Play:** A Symphony of the Night-style castle explorer, drawn in Canvas 2D with the same Dora and Enzo as Fluff Forge. Grandpa Pebble says the Golden Wolfberry, a berry that never runs out of snacks, grows at the top of the castle on the mountain, and the two go in together. The castle is one connected map of rooms, each one or more screens of 24×14 tiles; walking off an edge takes you into the next room, and a minimap and a full map in the menu fill in as you explore, with icons for shrines, Pip’s stall, guardians, treasure you haven’t taken, familiars and sealed doors, and a legend. The story runs to its end over five chapters: chapter I is the Moonlit Approach, Entrance Hall, Hay Cellar and Owl Belfry, chapter II is the Pantry Catacombs behind the belfry's sealed door, chapter III is Count Culpeo’s Library beyond the Rat King’s door, chapter IV is the Clock Tower above the Count’s balcony, and chapter V is the Moonlit Roof, 48 rooms over 90 map screens. Each weapon has its own look, carried and mid-swing: three painted fans, bare paws or a steel gauntlet, and a cudgel, marble rolling pin or red leather tome strapped to Enzo's back, each with its own trail and slash colour. Every area has three layers of parallax scenery (moonlit graveyards, stained-glass windows, barrel vaults, clockwork, shelves of glowing jars, round windows high above the castle, stormy rooftops under a full moon), rain and lightning on the roof, gears that turn behind the Clock Tower’s stonework, candlelight that cuts through the dark, afterimages when a hero dashes or lunges, and a dark foreground that slides past in front. Rain and lightning show through the hall's windows, light shafts fall through the hall and belfry, water drips in the cellar and catacombs, and each area has its own colour grade.

You control one hero while the other follows a step behind. Press C to **tag**: the partner tumbles from behind to the front in a spinning ball that hurts anything on its path (1.6× their attack plus 4, and it gets past an armadillo’s shield), then carries on as the lead. Tags have a one-second cooldown. Dora sweeps a **Dust Fan** (34-pixel reach, 140 px/s walk): every sweep blows a small gust of dust ahead, and holding attack then letting go spins her in a whirlwind that hits both sides for double damage. Enzo **lunges** into quick 28-pixel claw swipes (124 px/s walk, more HP and defence): each swipe carries him forward, stops when it connects, and won’t take him off a ledge. Pressing attack again as a swing ends chains a **three-hit combo**, and the third hit does 1.5× damage: Dora’s blows a big gust that goes through foes, Enzo’s claws uppercut foes into the air, and a club slams out little quakes. Each hero has their own HP; when the lead is worn out the partner takes over automatically and the worn-out one can’t tag back in until a rest. Both worn out sends you back to the last save.

Landing hits fills a **Duo meter**. When it’s full, tag and attack together (or V) set off a **Duo Strike**: both heroes streak across the screen and strike every foe in view. Spells run on **Dust**, which trickles back over time, drops from candles and comes from defeated foes. Dora learns **Whirlwind** at level 3 (↓ ↘ → + attack), a drifting tornado that hits again and again. Enzo learns **Burrow Quake** at level 4 (→ ↓ ↘ + attack), quakes both ways that throw foes up. F casts either without the motion. Scrolls in the Clock Tower teach each a second spell, cast with → ↘ ↓ + attack or ↓ + F: Dora’s **Petal Ward** sets six petals whirling around her for four seconds, cutting foes and knocking shots out of the air, and Enzo’s **Boulder Roll** curls him into a ball that bowls through everything and bounces back off walls. Up + attack throws the readied **sub-weapon**, paid for in seeds:

- a sunflower seed;
- the **Seed Spread**, three seeds at once, found in the cellar;
- the **Boomerang Acorn**, which flies out and back through foes, high on the belfry stair;
- the **Pumpkin Flask**, which bursts into a row of flames, in the larder;
- the **Clockwork Cog**, which drops to the floor and rolls along it through foes, bouncing back off walls, in the clockworks.

Choose between them and read up on spells in the menu’s Magic tab. A difficulty is picked for each new game: Easy softens foes and heals a little at every doorway, and Hard makes foes 1.5× tougher and has bosses fight all-out from the start.

Chapter I has cave bats that wake and chase, dust moths that drift after you, shell beetles, bone mice that lob bones, and armadillo guards whose shield blocks hits from the front until a lunge leaves them open. The catacombs add pantry rats that bristle and charge, jar ghosts that fade out of reach, and cellar spiders that drop on their threads. The Clock Tower adds clockwork mice that wind up and zoom, bouncing off walls; cuckoos that pop out of their clocks to spit notes and can only be hit while they’re out; and spring toads that leap at you in high arcs. Every hit freezes the frame for an instant and shows its damage in a bouncing number, with big gold ones for finishers, spells and the Duo Strike; your luck gives a chance of a 1.5× critical. Defeated foes burn away into embers and give off Dust motes that fly into the lead and top up the Dust meter. Foes give XP (one shared level for both, with more HP, attack and defence each level) and drop raisins and sometimes gear or food. Candles hide seeds, raisins and wolfberries. Gear goes in three slots per hero (weapon, armour, accessory): the Moonlit Fan and Wolfberry Fan for Dora; the Acorn Cudgel, Rolling Pin, Heavy Tome and Iron Claws for Enzo; the Wool Scarf, Moth Cape, Thimble Helm, Clockwork Cuirass, Silver Bell, Beetle Shell and Raisin Ring. Hay Cakes heal 40, wolfberries 20 and Timothy Tea 80 from the Items menu. Wolfberry Leaves raise both heroes’ max HP by 10. Pip the hamster keeps a stall in the catacombs, and a second one in the Clock Tower, that sells food, seeds, the Thimble Helm, Raisin Ring and Iron Claws for raisins. Defeated foes stay down until you rest at a shrine or move to another area, and the **Bestiary** tab records each kind you’ve beaten with its stats, weakness and a line of lore.

Four **familiars** can be befriended, and one comes along at a time, levelling up as you win fights:

- **Pudding the guinea pig** is lost and hungry in the Hay Cellar. Bring her a Hay Cake and she’ll heal the lead when they’re badly hurt.
- **Zippy the sugar glider** is locked in a cage on the belfry stair. Break it and he glides at nearby foes and nips them.
- **Mochi the capybara** soaks by the catacomb shrine, too worried about the rats to relax. Once the Rat King falls she joins, bonking away shots aimed at the lead and sniffing out cracked walls.
- **Nutmeg the chipmunk** frets in the clockworks: a cuckoo knocked her pocket watch onto a shelf high in the cuckoo gallery. Bring it back and she joins, fetching loose raisins, seeds, Dust and food to the lead and sometimes digging up extra raisins where a foe falls.

The **Dust Dash** relic in the cellar lets you burst forward, once in mid-air, and dashing into a jump carries you far; it is the only way across the broken gallery in the Entrance Hall. The **Cloud Hop** relic in the catacombs is a second jump in mid-air, and it reaches the chimney up to the Rat King and two high treasures. Cracked walls crumble when hit and hide a Wolfberry Leaf and a secret room. Golden **dust-bath shrines** heal and revive both heroes and save the game in this browser, and once you’ve found two, pressing up at one warps you to another. Bosses are saved the moment they fall, so they never come back. Each area has its own synthesised music, and bosses have a theme of their own. At the top of the belfry stair waits **Duke Hootsworth**, a great horned owl (260 HP) who throws feather volleys and swoops low across the room; at half health he summons two bats and adds a dive that sends shockwaves along the floor. Beating him ends chapter I and opens the sealed door. At the top of the catacomb chimney sits **Gnawdrick the Rat King** (560 HP) on his cheese throne. He charges wall to wall, stunning himself and shaking rocks from the ceiling; he leaps at you and lands with shockwaves; and he bowls wheels of cheese. At half health he calls two rats and bowls a bouncing wheel too. Beating him ends chapter II and unlocks **Count Culpeo’s Library**: flying tomes that snap, ink quills that flick ink, ink blots that spring at you, a bookshelf puzzle whose sign tells you which book to pull, and the **Dust Form** relic, which lets you drift through iron grates to reach the Count’s tower and a hidden reading nook. **Count Culpeo** (980 HP), a fox in a vampire’s cape, throws fans of fireballs, bursts into bats to reappear behind you and sweep his cape along the floor, swoops across his study, and at half health calls his bats and raises pillars of fire. Beating him ends chapter III and opens the balcony door to the **Clock Tower**. Its **Wall Cling** relic lets a hero cling to a wall in mid-air, slide slowly down it and kick off it; kicking back and forth climbs the tower’s sheer shaft and reaches a pocket watch and a Wolfberry Leaf on a high shelf. At the top of the tower waits **Tick-Tock the Clockwork Cat** (1,900 HP). She pounces and lands with shockwaves, bowls cogs that bounce off the walls, and runs up a wall to cling there and dive at you, which leaves her dizzy and open. At half health she lets two clockwork mice loose and rings the bell on her collar: a low chime to jump and a high one to stay down under. Beating her ends chapter IV and opens the door to the roof. The **Moonlit Roof** is out in a storm: gargoyles that sleep as stone on their perches until you come close, then wake, dive at you and fly home; storm crows that circle and swoop; a great chimney only the Wall Cling climbs, up to a gargoyle roost holding the **Celestial Fan** (Dora, ATK +22) and the **Gargoyle Maul** (Enzo, ATK +32); Pip’s last stall; and a spire up to the summit. There **Count Culpeo** fights for the last time (2,600 HP): all-out from the start, with lightning called down on the roof, until at half health he bites the Golden Wolfberry and becomes the **Night Fox**, a great winged fox who soars, sweeps fire breath along the roof, swoops low and lands (the moment to strike), and brings down falling stars. Beating him ends chapter V. In the garden beyond, the **Golden Wolfberry** ends the story with the credits, and goes in your bag as an accessory (ATK, DEF and LCK up); you can keep exploring afterwards.

**Controls:**

- ← → or A D: walk. Space, Z or K: jump (hold for height; again in mid-air with the Cloud Hop). ↓ + jump: drop through a ledge. With the Wall Cling, hold toward a wall in mid-air to cling, and jump to kick off it.
- X or J: attack (tap again for a combo; as Dora, hold and let go to spin). ↑ + attack: throw the sub-weapon. F: cast the lead’s first spell, ↓ + F their second (or use a spell’s motion + attack). C or E: tag. C + X, V or Q: Duo Strike. Shift or L: Dust Dash.
- ↑: read a sign, talk, shop at Pip’s stall, or warp at a shrine. Escape, Enter, M, P or Tab: open or close the menu (Status, Equip, Magic, Items, Familiars, Bestiary, Map), or leave the shop or warp list. In the menu, shop, warp list and the game-over and chapter cards, the arrow keys (or WASD) move between buttons, and tabs open as you reach them; Z, X, J, K or Space picks the highlighted button.
- The title screen picks Easy, Normal or Hard for a new game. Sound and Music each have their own toggle.
- Gamepad: d-pad or left stick to move, A jump, X attack, B or RB dash, Y or LB tag, RT spell, LT Duo Strike.
- On touch screens and narrow windows an on-screen pad has move, up, down, spell, Duo, tag, dash, attack, jump and menu.

**Tests:** `npm run test:fluffstevania` (also in `npm test`) compiles `lib/fluffstevania-game.ts` and runs `tests/fluffstevania.mjs`: 64 checks. They cover:

- the room grid, and that every doorway leads somewhere;
- a reachability search over the whole map proving the belfry needs the Dust Dash, the catacombs need the owl beaten, the Rat King and the high treasures need the Cloud Hop, the library needs the Rat King beaten, the Count’s tower needs Dust Form and the reliquary needs the shelf puzzle, the Clock Tower needs the Count beaten and its upper rooms and the pocket watch need the Wall Cling, the roof needs Tick-Tock beaten, and that every spot can get back to the start;
- real physics for the broken gallery, the Cloud Hop’s height, and the shrine ledge only the hop reaches;
- the opening story, walking, jumping and the follower, attacks, damage numbers, XP and levels;
- Enzo’s lunge and how it stops at a hit and at a ledge;
- tagging and the tag tumble, the Dust Dash, getting hurt and the worn-out swap;
- shrines, saves, loading, and older saves swapping the old whips and swords for fans and Mist Form for Dust Form;
- cracked walls and the Wolfberry Leaf, candles and seeds, the armadillo’s shield, gear and food;
- Pip’s shop, rats, ghosts and spiders;
- all five boss fights from gates to defeat and the chapter endings, the Night Fox’s transformation, and the Golden Wolfberry’s ending;
- the library door waiting for the Rat King, iron grates and Dust Form, the archive’s shelf puzzle, and the library’s foes;
- the balcony door waiting for the Count, a bot climbing the sheer shaft by kicking off the wall, and the Clock Tower’s foes;
- the roof door waiting for Tick-Tock, the roost up a chimney only claws climb, and gargoyles and storm crows;
- the spell scrolls, Petal Ward knocking a bone out of the air, Boulder Roll flattening a foe and bouncing off a door, and the Clockwork Cog rolling and bouncing;
- difficulty scaling, doorway healing on Easy and fierce bosses on Hard;
- foes staying down until a rest or a change of area, and bosses saved as they fall;
- combos and finishers, the fan’s gusts and spin, the Duo Strike;
- Dust, the first spells and their motions, and the older sub-weapons;
- shrine warps, all four familiar quests and what each familiar does, the Bestiary count, and the Silver Bell’s chime;
- foes burning away and their Dust motes topping up the Dust meter, big damage numbers for finishers and spells, the level-up pillar, fur from dashing, and the club finisher’s shockwaves;
- deterministic replays.

Browser: `tests/e2e/fluffstevania.mjs`:

- picks Hard and starts a new game, reads the opening story, walks and attacks, and tags;
- opens every menu tab, walks the tabs with the arrow keys, and checks the map legend lists every icon;
- continues from an older save and equips a fan;
- buys from Pip with the arrow keys and Z, warps between shrines and toggles the music;
- continues from a save in the library and checks the map scrolls across to it;
- continues from a save in the Clock Tower and checks the Magic tab and the Wall Cling;
- checks the Count speaks with a portrait drawn from his sprite on the summit;
- picks the Golden Wolfberry, mashes through the last lines without skipping the credits, and keeps exploring;
- checks a phone-sized screen.

**Docs:** [`docs/fluffstevania.md`](docs/fluffstevania.md).

### 18 · Chinchilla Clash (`/clash`)

**Play:** A Clash Royale-style lane battler, drawn in Canvas 2D on an 18 × 32 tile arena. Dora and Enzo hold the Dust Palace at the bottom; a rival clan holds the top. Each side has two princess towers (1400 health) and a king tower (2400), which sleeps until it is hit or a princess tower falls. A river crosses the middle, and ground troops cross it on the two bridges. You play cards with **bath dust**: you start with 5, gain one every 2.8 seconds up to 10, and gain it twice as fast in the last minute. Your deck of eight cycles through a hand of four, with the next card shown beside it. Troops and buildings go on your own half, or in the enemy half of a lane whose princess tower you have knocked down; spells go anywhere. Everything takes a second to drop in.

There are 12 cards. **Troops:** Kit Squad (2 dust, four fast kits), Pellet Flickers (3, two ranged shooters that hit flyers), **Dora, Dust Duchess** (5, dust puffs that splash crowds and flyers), **Enzo, Boulder Brawler** (4, a spin that hits every ground troop around him), Grandpa Pebble (5, a slow tank that only hits buildings), Dust Dasher (4, a fast tower-hitter that leaps the river), Glider Gang (3, three flying sugar gliders), Mochi the Capybara (3, a sturdy blocker) and Hay Balloon (5, flies to towers, drops bales and one last bale when popped). **Spells:** Dust Bomb (4, heavy damage in a small area, with knockback) and Pellet Volley (3, lighter damage over a wide area); towers take 35% of spell damage. **Building:** Hay Cannon (3, shoots ground troops for 30 seconds and pulls tower-hitters). Dora and Enzo are hero cards only you can play. Build a deck of any eight on the title screen.

Knock down a princess tower for a crown, or the king tower for all three and an instant win. After three minutes the side with more crowns wins; if it's level, one minute of overtime follows where the next crown wins, and after that the side whose weakest tower has less health loses it. The trophy road has three arenas, each opened by beating the one before: Sandy’s Beige Brigade at the Salt Flat Arena, Duchess Velvet’s Violets in Cactus Canyon and Baron Ebony’s Night Guard on the Moonlit Summit, rival clans of beige, violet and ebony chinchillas, each with its own deck and a sharper computer player. Your deck, the arenas you've opened and your wins are kept in this browser.

**Controls:**

- Tap a card, then tap the arena to play it, or drag a card straight onto the arena. A ghost shows where it lands, with its range, and red tiles show where it can't go.
- Keyboard: 1–4 pick a card, the arrow keys or WASD move the drop point, Enter or Space drops it, Escape puts the card back.
- P or Escape (with no card picked): pause. Losing window focus also pauses. M, or the speaker button, turns sound on and off.
- Rest the mouse on a card, in the deck builder or in your hand, for its health, damage, speed, range and what it aims at. On a touch screen, hold a finger on it.

**Tests:** `npm run test:clash` (also in `npm test`) compiles `lib/chinchilla-clash-game.ts` and runs `tests/chinchilla-clash.mjs`:

- the cards, deck rules and rival decks, and the set-up: towers, sleeping kings, the shuffled hand and starting dust;
- dust filling, its cap and double dust; the deploy zone, the river, spells anywhere, and the card cycle;
- troops waiting to deploy, crossing on a bridge without touching the water, the Dasher leaping the river and gliders flying over;
- tower-hitters ignoring troops, stepping around blockers and being pulled by a cannon, and the cannon crumbling;
- towers opening fire at their range, crowns, kings waking, and the pocket a fallen tower opens;
- Dust Bomb damage, knockback and the tower share, a volley clearing kits, Dora's splash, Enzo's spin and the balloon's last bale;
- a king-tower win, crowns at full time, overtime, the tie-break and a draw;
- the computer defending a push, replaying exactly from a seed, and whole computer-vs-computer matches in every arena, each harder than the last.

Browser: `tests/e2e/chinchilla-clash.mjs` checks the menu card and locked arenas, the deck builder's limits and that the deck survives a reload, tap, keyboard and drag plays, a troop refused on the enemy half, a spell on an enemy tower, pausing, a king-tower victory that opens the next arena, and tap plays on a phone-sized screen. `tests/e2e/older-quality.mjs` checks that a win is saved in the frame the battle ends, that a cancelled card drag plays nothing, that a hidden tab pauses, and layouts from 320 to 844 pixels wide.

**Docs:** [`docs/chinchilla-clash.md`](docs/chinchilla-clash.md).

### 19 · Hay Maze Defence (`/hay-maze`)

**Play:** A roguelite tower defence in the style of Emberward, drawn in Canvas 2D on a 20 × 12 tile meadow at nightfall. Predators come for the **Hearthlight**, the lantern that keeps Dora and Enzo's burrow warm, and always take the shortest open way to it, shown as a glowing line. You build the maze from **hay-bale blocks drawn as cards**: 11 shapes from a single bale to the tetrominoes, which you turn and lay between waves. While you place one, the line shows the route it would make, and you can never close the way completely. **Towers stand on top of bales**, or on the meadow's rocks, so the bales are both the maze and the foundations. Hawks fly straight over it all.

There are eight towers, each with an element. You start with three: the **Pellet Flicker** (10 hay, hits flyers too), **Dora's Frost Fan** (16, ice: chills everything nearby by 35%, up to 55%) and **Enzo's Boulder Roller** (22, splash). The other five are rewards: the **Ember Brazier** (fire: sets foes burning for 3 s, and burning ignores armour), the **Spark Wheel** (a chain of zaps that jumps to 3 foes, up to 5), the **Moon Lantern** (arcane: long-range bolts that ignore armour), the **Snooze Bell** (naps of 0.6 to 1 s) and the **Glider Nest** (flyers only). Elements react: chilled foes **shatter** for double damage from sparks, and burning foes **flare** when moonlight hits them, scorching their neighbours for half. Towers upgrade twice and sell for 70% back.

A run is six levels, each on a newly generated meadow with its own rocks and ways in (from the third level a second way in may come down from the top, and always does from the fifth). Each level is five waves, and every second level ends with a lynx. You start each level with fresh bales, no towers, 70 hay (30 more each level after the first) and a hand of 7 cards from your deck of 11. After each wave you draw 3 more, and you can hold 8. Towers can go up during a wave; bales wait until it's over. Clear a level to pick one of three rewards: a new tower, a relic (12, such as Static Fur for longer chains or the Old Map for an extra card each wave), more cards for your deck, or a brighter flame. Predators that reach the Hearthlight dim it (badgers by two, the lynx by five); it starts at 20 and carries over between levels, and the run ends if it goes out. The run in progress is saved in this browser as you play, so you can close the page and **Continue your run** later. A wave left part-way comes back paused, with every predator where it was. Runs played, runs won and the furthest level reached are kept too.

**Controls:**

- Pick a card from your hand (or press 1–8) and click the meadow to lay it. R, right-click or the mouse wheel turns it. Hay Bundles and Warm Cocoa play as soon as you pick them; the Shovel digs up a bale.
- Pick a tower from the bar (Z, X, C, V, B, N, M or comma) and click bales or rocks to build. Click a tower to see its stats, upgrade it (U) or sell it (Delete).
- Space starts the wave. The arrow keys move the cursor and Enter places or selects. F cycles 1×, 2× and 3× speed. P pauses, and Escape cancels, or pauses when nothing is picked. On the reward screen, 1–3 pick. **Save and leave** (in the pause menu or on the reward screen) goes back to the start screen, where **Continue your run** picks it up again.
- Touch: tap a tile to preview, then tap it again to place.
- The speaker button at the top turns sound on and off.
- Rest the mouse on a tower button, a card in your hand or a relic for a note on what it does, with this run's relics counted in a tower's numbers. On a touch screen, hold a finger on it.

**Tests:** `npm run test:hay-maze` (also in `npm test`) compiles `lib/hay-maze-game.ts` and runs `tests/hay-maze.mjs`:

- pieces and turning, seeded maps and waves (light opening waves, a lynx every second level), and the gentle step from one level to the next;
- starting a run, laying bales (never on bales, rocks, ways in or off the edge, never sealing the way, and not during a wave);
- towers only on bales and rocks, locked towers, upgrading and selling;
- hindrance: a snaking wall of bales makes a fox take 3.7 times as long, hawks fly straight over, and no predator walks through a bale;
- every element: chill, chains and shatter, burning through armour, moonlight through armour and flares, naps, splash and flyers;
- relics, the item cards, drawing after each wave, the hand limit and reshuffling;
- clearing a level to three rewards and the next level, losing the Hearthlight, winning the run and pausing;
- saving mid-run: a run saved between waves, at the reward screen or mid-wave loads and carries on exactly as the original would, and broken or impossible saves are refused;
- a deterministic replay.

`npm run bot:hay-maze` (also in `npm test`) runs `tests/hay-maze-bot.mjs`, a planner that plays whole runs through the real engine: it lays bales to lengthen the walk along a snaking plan, stands towers where they reach the most of the route (and anti-air along the hawks' flight line), and picks rewards. It must win at least three of six seeded runs.

Browser: `tests/e2e/hay-maze.mjs` starts a run, lays and turns a bale, has a bale refused on a rock and a tower refused on grass, builds on a bale and a rock, upgrades and sells, reloads the page between waves, mid-wave and at the reward screen and continues the saved run each time, starts a wave with Space, pauses, clears a level to the reward screen and level 2, loses the Hearthlight (after which there's nothing to continue), and taps to preview and place on a phone-sized screen. `tests/e2e/older-quality.mjs` checks that a finished run is saved in the frame it ends, that a hidden tab pauses the wave and keeps the run, and layouts from 320 to 844 pixels wide.

**Docs:** [`docs/hay-maze.md`](docs/hay-maze.md).

### 20 · Chinchillas vs Zombies (`/chinchillas-vs-zombies`)

**Play:** A lane defence in the style of Plants vs Zombies, drawn in Canvas 2D. Zombies shamble in from the street along the lanes of a 9 × 5 lawn towards Dora and Enzo's burrow, and you stop them by planting chinchilla defenders, one to a tile. Defenders cost **sunflower seeds**. You start each night with 75. A glowing pouch worth 25 drifts down from the sky every 7 to 10 seconds, and each Seed Gatherer finds one every 24 seconds. Click a pouch to collect it before it fades, 12 seconds after it lands. Every defender has a recharge before you can plant another of the same kind. There are seven: the **Seed Gatherer** (50 seeds), the **Pellet Flicker** (100, 25 damage every 1.3 s down its lane), **Grandpa Pebble** (50, a 4,000-health wall), the **Dust Trap** (25, ready after 14 s, then it wipes out the first zombie on its tile), **Enzo's Boulder** (150, 1,800 damage to every zombie in the 3 × 3 around it), **Dora's Frost Fan** (175, puffs that chill a zombie to half speed, bites included, for 10 s) and **Twin Flickers** (200, two pellets a volley). The shovel digs a defender up, without a refund. A night left part-way is kept in this browser: the home screen offers **Continue Night N**, and it comes back paused.

Six zombies: the plain **Zombie** (200 health), the faster **Flag Zombie** that leads each huge wave, the **Conehead** (370 armour on top) and **Buckethead** (1,100), the **Pogo Zombie**, which bounces over the first defender it meets and can't be hit in mid-air, and the **Brute**, 3,000 health, which flattens any defender in one smash and takes two boulders. There are eight nights. The first two use only the middle three lanes, and every other night uses all five. A night is 6 to 16 waves, 22 seconds apart. The first two waves are always plain zombies, flag waves are twice the size, the last wave brings the night's toughest zombie, and a progress bar with flags shows what's to come. Each lane has a **hay cart** that clears it the first time a zombie gets to the end. After that, a zombie at the end of the lane gets into the burrow and the night is lost. Winning a night opens the next and adds a defender to your seed bar (Grandpa Pebble, the Dust Trap, Enzo's Boulder, the Frost Fan, then Twin Flickers). The nights you've cleared are kept in this browser.

**Controls:**

- Pick a seed packet (or press 1–7) and click a tile on the lawn to plant. Right-click or Escape puts the packet down. S picks the shovel.
- Click a seed pouch to collect it, or press Space to collect every pouch on the lawn.
- The arrow keys move the cursor and Enter plants. F cycles 1×, 2× and 3× speed. P, or Escape with nothing picked, pauses. The game also pauses when the window loses focus.
- Touch: tap a tile to preview, then tap it again to plant.
- M, or the speaker button at the top, turns sound on and off.
- Rest the mouse on a seed packet for the defender's health, damage and recharge. On a touch screen, hold a finger on it.

**Tests:** `npm run test:cvz` (also in `npm test`) compiles `lib/cvz-game.ts` and runs `tests/cvz.mjs`:

- planting rules (seeds, recharge, taken tiles, bare lanes, locked defenders, pausing), the shovel, and unlocks;
- sky seeds, gatherers, collecting and fading;
- shooters only firing ahead and down their own lane, Twin Flickers, armour, and the Frost Fan halving walking and biting;
- a Dust Trap eaten before it's ready and going off once it is, the boulder's 3 × 3, the pogo's jump, and the Brute's smash;
- hay carts clearing only their lane, then losing;
- every night's waves (lanes, pools, flags, plain opening waves, the final zombie), winning, pausing and a deterministic replay.

`npm run bot:cvz` (also in `npm test`) runs `tests/cvz-bot.mjs`, a simple gardener that collects every seed, plants gatherers at the back and shooters where the zombies are, walls in front of pogos and boulders on crowded lanes. It must win all eight nights, and doing nothing must lose.

Browser: `tests/e2e/chinchillas-vs-zombies.mjs` checks the menu card and the locked nights, planting with a packet and a click, a plant refused for seeds and on a bare lane, collecting a pouch by clicking and with Space, planting with the keyboard, reloading mid-night and continuing it, a recharging packet, the shovel, speed, pausing, a won night that shows the new defender and opens the next one, losing, and tap-to-preview on a phone-sized screen. `tests/e2e/older-quality.mjs` checks that a won night is saved in the frame it ends, that a hidden tab pauses the night, and layouts from 320 to 844 pixels wide.

**Docs:** [`docs/chinchillas-vs-zombies.md`](docs/chinchillas-vs-zombies.md).

### 21 · Chinchilla Scribble (`/scribble`)

**Play:** A word puzzler in the style of Super Scribblenauts, drawn in Canvas 2D. Write the name of a thing and it appears next to whichever chinchilla you're steering: a ladder to climb, a bridge to cross, a carrot for a hungry llama. The dictionary knows 177 things (356 words with plurals and synonyms), and 47 adjectives change them. Adjectives stack, so a **giant flying hay bale** is twice the size and can be ridden through the air, and a **frozen campfire** won't burn. Things act on each other: fire spreads to things that burn and burns them away after 10 seconds, water and cold put fires out, cold freezes a river solid enough to walk on, bombs and dynamite go off after 3 seconds and break rockfalls, trampolines bounce you high, and animals wander, eat and scare each other. You can have 14 of your things at once; the oldest vanishes when you make a 15th. Chinchillas can't swim, and big fires push them back. There are 12 levels across three worlds (Meadow, Mountain and Burrow Town), each with a golden wolfberry to reach: a high ledge, a river, a hungry llama in a tunnel, a campfire in a mountain pass, a rockfall, a puma on patrol, a gate that needs something heavy on its plate, Grandpa Pebble shivering in a doorway, a pitch-dark storeroom, the rooftops and a zombie guarding a haystack. Each level has a par of 1 or 2 words. Solving at or under par earns 3 stars, within two more earns 2, and anything else earns 1. Only real summons count, so a word the dictionary doesn't know costs nothing and suggests the closest one it does know. Solving a level again using only words you haven't used there before counts as a bonus solve. Solving a level opens the next, and the sandbox is always open. Stars, bonus solves and a word book of everything you've written are kept in this browser.

**Controls:**

- Type a word, with any adjectives in front of it, and press Enter or **Summon**.
- Click or tap anywhere to walk, climb or fly there. A ride hovering just overhead is hopped onto on the way, and a flying ride sets you down when it arrives over solid ground.
- Drag things with the mouse or a finger. The thing you last made or picked is outlined: Delete or Backspace removes it, and I, J, K and L nudge it.
- ←/→ or A/D walk; ↑, W or Space jumps, climbs up or flies up; ↓ or S climbs down, flies down, or hops off a ride that's on the ground.
- Q swaps between Dora and Enzo (the other one follows). Enter, / or T starts writing, and Escape goes back to steering. H shows a hint, R restarts the level.

**Tests:** `npm run test:scribble` (also in `npm test`) compiles `lib/scribble-game.ts` and runs `tests/scribble.mjs`:

- the parser: adjectives before a noun, plurals, two- and three-word nouns, did-you-mean, reserved words, and that every noun and adjective parses;
- summoning: sizes, stacked adjectives, hovering and falling, the 14-thing limit, and that only real summons count;
- every noun summoning and settling without trouble;
- fire spreading and burning out, water and cold putting fires out, rivers freezing, splashing back to the bank, trampolines, the gate's weight, burns and blasts;
- the follower keeping up and swapping who you steer;
- 24 scripted solutions across all 12 levels (ladders, stairs, trampolines, flying rides, bridges, boats, ice, food, water, rain, tools, cages, scary animals, weights, warmth and light), and that walking alone never wins a level.

Browser: `tests/e2e/scribble.mjs` checks the menu card and the locked levels, did-you-mean, clicking to walk and climb, winning with three stars and saving them, steering with the keyboard, dragging and deleting a thing, swapping to Enzo, riding a flying carpet up the cliff for two stars, the word book, the sandbox, and tap-to-walk on a phone-sized screen.

**Docs:** [`docs/scribble.md`](docs/scribble.md).

### 22 · Burrow Tactics (`/tactics`)

**Play:** Turn-based tactics in the style of Into the Breach, drawn in isometric Canvas 2D on an 8 × 8 meadow. Predators raid the warren, and every one of them shows in red what it will hit when you end the turn. Each turn your chinchillas move once and act once, and almost every action **pushes** something: a fox into the stream (it drowns), a weasel into brambles, one predator into another's line of fire. A telegraphed attack is a direction, not a tile, so pushing a predator moves its attack with it. A burrow that is hit collapses and costs 1 **warren**; at 0 warren, or with every chinchilla knocked out, the battle is lost. Hold out for the set number of turns (3 to 6) and the raid is over; some missions ask for something else: **escort** a kit to its den, **hunt** a marked predator before time runs out, or keep the **nursery** burrow standing. New predators come up through **rustling grass**, which you can block by standing on it. Six chinchillas: Dora's Seed Shot (a line, 1 and a push), Enzo's Tail Whack (2 and a push), Pip's Dust Puff (a cloud nobody can attack from, pushing everything beside it), Grandpa Pebble's Hay Toss (a bale as a wall, or 1 to whoever is there), Mochi's Tug (pulls the first creature in a line up to her) and Biscuit's Pounce (a leap that hits and scatters everyone around the landing). Each also has a **second action** to learn (Piercing Seed, Ground Slam, Switcheroo, Brace, Lullaby and Drop Kick) and belongs to a **class** with a perk that is always on: Scouts (Dora, Pip) may act first and move after, Bruisers (Enzo, Biscuit) make whatever they knock into something take 1 more, and Wardens (Grandpa Pebble, Mochi) take a predator's hit meant for a burrow beside them. Ten predators: fox, snake, owl, weasel, mole (tunnels under everything), skunk (leaves a stink cloud), badger, hawk, the Mountain Cougar and the Great Bear. Besides water and brambles there is **ice** (a pushed creature keeps sliding), **high ground** (hit 1 harder from it) and **fire** (burns whoever stands in it and spreads through brambles and hay). While you aim, the board shows the result before you confirm it, and a forecast line says what ending the turn now would cost. A **Hint** button marks what the game's own planner would do next, and the first mission is **guided** step by step the first time it is played. The **campaign** is eighteen missions with up to three stars each: ten that unlock four of the chinchillas, then **chapter two**, eight more where you choose where the squad starts and each mission brings new ground, a new predator, a new objective or a second action. Winning mission 5 opens **The Long Night**, a seeded run of seven battles on generated boards with three chinchillas of your choice, on **Gentle, Standard or Fierce** (a warren of 6, 5 or 4, and fewer or more predators), ending with the cougar or the bear, with a reward after each battle: an upgrade, a second action, one of six relics, or a warren repair. Stars and the run in progress are saved in the browser. A campaign mission left part-way is kept in this browser: the home screen offers **Continue Mission N**, back on the turn you left.

**Controls:**

- Click or tap a chinchilla to pick it, a blue tile to move, and an orange tile to act. On a touch screen an action needs a second tap to confirm.
- Before a chapter-two or run battle, click a chinchilla and then a green tile to choose where it starts; E or **Start the battle** begins.
- Tab picks the next chinchilla. 1 arms the chinchilla's action, 2 its second action once learned, and G grooms (heal 1). H shows a hint.
- The arrow keys move a cursor over the board and Enter or Space confirms the tile under it.
- U or a right click undoes a move or cancels an aimed action. R resets the turn, once per battle. E ends the turn.
- F changes the animation speed (1×, 2×, 3×). M turns sound on and off. A click, Enter or Space during an animation skips to its end.
- Rest the mouse on an action button or a chinchilla in the squad panel for a note on its aim, reach, damage and class. On a touch screen, hold a finger on it.

**Tests:** `npm run test:tactics` (also in `npm test`) compiles `lib/burrow-tactics-game.ts` and runs `tests/burrow-tactics.mjs`:

- moving, undo and the one-move, one-action rule;
- every action and second action, the three class perks, and pushing into water, rocks, bales, burrows, brambles, other units and the edge of the board;
- ice, high ground and fire;
- every predator attack, alphas, and attacks following a predator that has been pushed;
- the forecast matching what then happens, on every mission;
- rustling grass coming up and being blocked, winning, losing, the boss rule, the escort, hunt and nursery objectives, choosing where to start, the hint, the reset and snapshots;
- the six relics, the eighteen mission maps, generated boards for 30 seeds, difficulty, and the run's rewards and saving.

`npm run bot:tactics` plays the game with the engine's own planner (the one behind the Hint button), which tries each chinchilla's options on copies of the battle. `npm test` needs it to win all eighteen missions with at least 2 stars and at least 6 of 12 seeded Standard runs, and needs an idle player to lose every mission.

Browser: `tests/e2e/burrow-tactics.mjs` checks the menu card and the locked missions, picking, moving and undoing, an aimed action and its forecast, ending a turn, reloading mid-mission and continuing it, winning a mission and its saved stars, the keyboard, starting and resuming a run, and a phone-sized screen.

**Docs:** [`docs/burrow-tactics.md`](docs/burrow-tactics.md).

### 23 · Burrow Barrage (`/barrage`)

**Play:** Turn-based artillery in the style of Gunbound, drawn in Canvas 2D. Two teams of two take turns: walk a little, set the **angle** and the **power**, and fire across ground that every shot digs away. **Wind** (up to 10 either way, drifting each turn) bends every shot. A blast hurts everyone in its reach, your own side included, with full damage on a direct hit falling to 35% at the edge. A chinchilla with no ground left under it falls, and one that falls through the bottom of the map or is shoved off its side is out at once; so is one at 0 health. There are no fixed rounds: every action adds to a chinchilla's **wait**, and whoever has waited least goes next, so a quick shot can earn two turns before a slow one. From turn 49 everyone loses 8 health a turn.

Each chinchilla rides one of four **rides**, each with two shots and a **big shot** that takes three turns to charge. The **Hay Catapult** (125 health) throws bales that hit hard and dig wide. The **Seed Spitter** (110) fires fans of seeds and has the shortest waits. The **Tunnel Digger** (120) fires shots that tunnel through the ground before they burst, and a Sinkhole that digs a crater of 22. The **Dust Cannon** (115) has wide, soft blasts that shove whatever they reach, up to 34 cells. Every chinchilla also carries three items, once a match each: **Double Shot** fires twice, **Dandelion** heals 40 in place of a shot, and **Burrow Hop** moves you to wherever a lobbed marker lands.

**The ladder** is six matches against rival pairs, one on each of the six maps (Clover Meadow, Mossy Valley, The Mound, Rope Bridge, Sky Ledges, Broken Crags), with the rivals' aim rising from Sleepy through Sharp to Deadeye. A win is worth one star, two with both Dora and Enzo still in, three with half their health left as well. **Pass and play** puts two people on one device, on any map with any rides. Stars and Dora's and Enzo's rides are saved in the browser; a match in progress is not.

**Controls:**

- Drag on the board to aim: the direction from your chinchilla is the angle and the distance is the power. The angle and power sliders do the same. Dots show the start of the shot's path.
- **Fire** shoots at the power shown. Or hold Space to charge the power from 0 and let go to fire.
- ← and → walk (or hold the ◀ ▶ buttons); walking the other way turns the chinchilla round. ↑ and ↓ raise and lower the barrel.
- 1, 2 and 3 pick the shot. Q, W and E pick Double Shot, Dandelion and Burrow Hop; pressing again puts the item away.
- **Skip turn** passes with a short wait. F changes the animation speed (1×, 2×, 3×). M turns sound on and off. A click, or Enter, during an animation skips to its end.
- Rest the mouse on a ride, a shot, an item or a chinchilla's panel for a note with its numbers: hurt, blast, crater, shove and wait. On a touch screen, hold a finger on it.
- On a phone-sized screen the camera closes in on whoever's turn it is and follows each shot. Drag with two fingers to look around, and tap **Whole map** (or press Z) to see everything; **Zoom in** goes back.

**Tests:** `npm run test:barrage` (also in `npm test`) compiles `lib/burrow-barrage-game.ts` and runs `tests/burrow-barrage.mjs`:

- every map starting four chinchillas on mirrored ground, and who goes first;
- flight: power, mirrored angles, wind and shots leaving the map;
- craters, damage falling off with distance, hurting yourself and a teammate;
- falling when the ground is dug away, knock-outs, a draw, and shoving along the ground and off a ledge;
- the Tunnel Digger's shot passing through a wall, the big shot's charge, and the three items;
- walking, its limits, the aim limits, skipping, the wait-based turn order and dusk;
- the same seed replaying the same match, and a copy playing on its own;
- the computer's plan hitting, sparing its own side, healing, and digging towards rivals it cannot reach;
- every ride reaching a rival from the start of every map, the stars, and a Deadeye pair winning each ladder match.

`npm run bot:barrage` plays computer against computer for every pairing of rides on every map and reports each ride's win rate, how often going first wins, and the ladder; it fails if any ride wins under 30% or over 70% of its matches. Set `SEEDS` for more matches per pairing.

Browser: `tests/e2e/burrow-barrage.mjs` checks the menu card and the locked ladder, choosing rides, aiming with the sliders and by dragging, walking, firing and the rival's reply, the shots and items, winning a match and its saved stars, pass and play, and a phone-sized screen with its close camera.

**Docs:** [`docs/burrow-barrage.md`](docs/burrow-barrage.md).

### 24 · Summit Shuffle (`/summit`)

**Play:** A deck-building climb in the style of Slay the Spire, drawn in Canvas 2D. Dora or Enzo sets out with 80 health and ten plain cards (five Nips, four Fluff Ups and a Dust Kick) and climbs three stretches of mountain: The Foothills, The Cliffs and The Snowline. Each stretch is a trail map of six rows of stops with a **guardian** at the top, 21 stops in all, and you choose your own route through it. Fights give seeds and a choice of one card from three; **alphas** are harder fights that also give a trinket; **rest burrows** heal 30% of your health or upgrade a card; **treat stalls** sell cards and trinkets and will take a card out of your deck; a **hidden stash** is a free trinket; and **something on the trail** is one of eight chance meetings.

In a fight you draw 5 cards and have 3 energy each turn. Every predator shows what it will do next, with its damage worked out. **Fluff** soaks up damage until your next turn. **Zoomies** add to every hit, **Exposed** creatures take half as much again, **Winded** ones hit a quarter less, and **Burrs** wear a predator down at the start of each of its turns. There are 64 cards to find (24 common, 26 uncommon, 14 rare), each with an upgraded version, and 30 trinkets. 25 cards turn up for either chinchilla, 20 are Dora's own (quick hits, Exposed, playing card after card) and 19 are Enzo's own (Burrs, Bristle, heavy paws, lots of Fluff). They start with the same deck and one trinket each: Dora's **Ruby Bell** gives two more cards and one more energy on the first turn of every fight, and Enzo's **Grey Scarf** heals 5 after every fight.

Reaching the summit opens the next of six **altitudes** for that chinchilla, each adding a rule: tougher predators, harder hits, thinner healing, a Fright in your deck, tougher guardians. A climb is saved after every choice; a climb left in the middle of a fight comes back at the start of that fight. Records, the cards and trinkets you have seen, and the climb in progress are kept in the browser.

**Controls:**

- Tap or click a card to choose it and read its rules as they stand; tap it again to play it. A card aimed at one predator is played on the marked foe, or on whichever predator you tap.
- With no card chosen, tap a predator or your chinchilla to read its health, intent and statuses.
- Rest the mouse on a card, anywhere one is shown, for a big copy of it: the numbers as they stand against the foe it would go at, a note for every word on it that means something (Fluff, Exposed, Burrs and the rest), and what an upgrade would change. On a phone, hold a finger on the card. Predators, your chinchilla, trinkets, health, seeds, energy and the stops on the trail explain themselves the same way.
- **End turn** hands over to the predators. Tap the board, or press Enter, to skip their animations.
- 1 to 9 and 0 choose a card; pressing the number again, or Enter, plays it. ← and → change the foe. E ends the turn. Esc puts a card back.
- **Draw**, **Discard** and **Deck** show the piles. F changes the animation speed (1×, 2×, 3×). M turns sound on and off.
- On the trail, tap an open stop to walk to it.

**Tests:** `npm run test:summit` (also in `npm test`) compiles `lib/summit-shuffle-game.ts` and runs `tests/summit-shuffle.mjs`:

- the data: every card's text matching its numbers, every upgrade changing something, and every predator only ever picking a move it has;
- a seed replaying a climb exactly;
- the trail over 60 seeds: no dead ends, no crossing trails, a burrow before every guardian, and an alpha, a stall and a meeting on every stretch;
- hitting, Fluff, and Exposed, Winded, Zoomies, Thick Fur, Matted and Burrs, with intents that match what then happens;
- some thirty cards one by one, the cards nobody wants, the hand limit and the reshuffle;
- predators: the fox's crouch and pounce, the thieving vizcacha, the dozing owl, the old fox's kits and the cougar's fury;
- twenty-odd trinkets;
- rewards, alphas, guardians, both endings, rest burrows, treat stalls and every option of every meeting;
- saving, including walking back into the same fight, and a copy playing on without touching the original;
- the six altitudes;
- the bot reaching the summit from Base Camp between 50% and 95% of the time with each chinchilla, with Altitude 5 at least 20 points harder.

`npm run bot:summit` climbs every altitude with both chinchillas and reports how often each reaches the summit, where climbs end, and how each card and trinket does. Set `RUNS` and `LEVELS` for more, `FIGHTS=1` for a line per fight, and `TRIAL=1` to measure each card by itself.

Browser: `tests/e2e/summit-shuffle.mjs` checks the menu card, the home screen and its locked altitudes, the trail, choosing and playing cards by tap, on a predator and by keyboard, the piles, the predators' turn, saving in the middle of a fight, the reward, a burrow, a stall, a meeting, a guardian's trinkets, both endings and the saved record, a whole 21-stop climb through the page, and a phone-sized screen.

**Docs:** [`docs/summit-shuffle.md`](docs/summit-shuffle.md).

### 25 · Poof Panic (`/poof`)

**Play:** A versus falling-pair puzzler in the style of Puyo Puyo, drawn in Canvas 2D. Pairs of fluff balls fall into a well 6 columns wide and 12 rows tall. Four or more of one colour that touch pop, whatever sat on top falls, and a pop caused by that fall is the next link of a **chain**. A link scores 10 points a ball times its bonuses, and the chain bonus grows fast: four balls are 40 points, the second link of a chain 320, the third 640. Every 70 points become one **dust clump** for your rival. Your own pops cancel dust waiting above your board before they send any. Dust lands after a pair that popped nothing, 30 clumps at most at a time, and clears when something pops beside it. Emptying your whole board is a **clean sweep**, worth 30 extra clumps on your next pop. A round is lost when the cell marked ✕ at the top of the third column fills. Both boards are dealt the same pairs.

The **rival ladder** is six predators, each match first to two rounds: Mossy the Mole, Pongo the Skunk, Whip the Weasel, Brock the Badger, Professor Hoot the Owl and Sierra the Cougar, from one who pops whatever turns up to one who plans two pairs ahead and builds four-chains. Climbing it with a chinchilla opens the **hard ladder** for that chinchilla. **Free match** replays any rival you have reached. **Endless** has no rival: the pairs fall faster every 12 placed, and from level 4 each new level blows dust in. **Chain lessons** are twelve set boards that teach stairs, sandwiches, digging out dust and the clean sweep, up to a five-chain. Dora and Enzo differ in how the odd clumps of their dust land: Dora's scatter over different columns, Enzo's land side by side in a heap. The climb in progress, records and finished lessons are kept in the browser.

**Controls:**

- ← and → (or A and D) move the pair; hold to keep moving. ↓ (or S) drops it faster. Space drops it to the floor.
- ↑, X or W turn the pair to the right; Z or Q turn it to the left. In a gap one column wide, two quick presses swap the two balls.
- P or Esc pauses. Matches and Endless also pause when the window loses focus or the tab is hidden. G shows or hides the landing guide. M turns sound on and off. Enter presses the main button on a card. R restarts a lesson.
- Touch: drag sideways to move, tap the right half of the board to turn right and the left half to turn left, pull down to drop faster, flick down to drop to the floor.

**Tests:** `npm run test:poof` (also in `npm test`) compiles `lib/poof-panic-game.ts` and runs `tests/poof-panic.mjs`:

- the bag: a seed dealing the same pairs, three colours in the first two pairs;
- the grid: what pops and what does not, the hidden row, dust beside a pop, falling, and the points for chains, colours and group sizes;
- moving a pair: walls, turning off walls and the floor, the swap in a narrow gap, soft drop, the lock delay, and pairs that wait in lessons;
- splitting, a three-chain going off link by link, and the events it reports;
- dust: held until a chain ends, cancelling, 30 at a time, sprinkles and heaps, the clean sweep, cheaper clumps after 96 seconds, and topping out;
- keys: auto-repeat, the newer key winning, and a tap shorter than a tick;
- rivals: each quicker and tidier than the last, a seed replaying a round exactly, and the cougar putting pairs where it planned and building a four-chain;
- endless levels and dust;
- all twelve lessons solved by search and then played through a real board.

`npm run bot:poof` plays three stand-in players against every rival and each rival against the one below it, and fails if a rival does not beat the one below it at least half the time or a round never ends. Set `RUNS` for more rounds, `HARD=1` for the hard ladder and `TRIAL=1` to print without checking.

Browser: `tests/e2e/poof-panic.mjs` checks the menu card, the home screen, moving, turning and dropping by keyboard, pausing, a whole match played on fast forward, losing a match, carrying a climb on, free matches, the top of the ladder and the hard ladder opening, endless and its record, two lessons with a miss and a hint, and dragging, tapping and flicking on a phone-sized screen.

**Docs:** [`docs/poof-panic.md`](docs/poof-panic.md).

### 26 · Burrow Express (`/express`)

**Play:** A transport puzzle starring Dora and Enzo. Draw coloured tunnels between homes (circles), hay markets (squares), dust baths (diamonds) and mountain retreats (triangles). Passengers use the shortest operating route, changing carts at shared stations. Three maps offer eight-day, six-minute shifts with targets of 100, 115 and 130 deliveries, or Endless until a platform overflows. A guided tutorial teaches drawing, destinations, deliveries and upgrades. Start with three lines, three four-seat carts, two rock drills and 62 hay. Each 45-second day brings an upgrade choice; new stations open until there are ten. More than eight passengers waiting for 18 seconds ends the route. Departures cost hay, hay deliveries replenish it, rocky crossings use drills, and occasional cave-ins can be cleared or routed around. Removing stops or freeing a cart preserves its passengers. The route saves as you play and resumes paused; records and tutorial completion stay in this browser. The painted terrain, station and cart sprites, portrait and interface follow the approved mock-up, including Dora's dark ruby eyes. Live waiting groups and exact counts follow each queue, with up to eight figures and a +N overflow badge. Chinchillas breathe, blink, shuffle, board and alight; carts bounce with turning wheels. Painted platforms, lanterns, sleepers, rails and timber crossings bring routes to life. Dust baths contain dry powder. Pause and reduced-motion preferences control decorative animation.

**Controls:**

- Drag between buildings, or tap stations in order. **Stations & route tools** opens the station buttons and extra controls with larger targets.
- 1–5 select a line; arrow keys select a station and Enter connects it while the map has focus. Z removes the last stop, A adds a cart, and L joins or opens a loop.
- P / Escape pauses; F cycles game speed and M toggles sound. The game pauses on focus loss. **Reroute** pauses for planning; **Save & menu** keeps your route; **Continue your route** returns paused.

**Tests:** `npm run test:express` (also in `npm test`) covers routing and transfers, resources, safe edits, passenger conservation, crowding, growth, upgrades, cave-ins, tutorial completion, snapshots, invalid saves, nine seeded shifts and Endless past day eight. `npm run bot:express` checks twelve seeded shifts across all three maps. Browser: `tests/e2e/burrow-express.mjs` plays the tutorial and a full shift through the controls, checks drag cancellation, keyboard, cart assignment, loops, edits, mid-journey saves, focus loss, cave-ins, records, losing and broken saves, and native touch drawing with four phone layouts.

The animation browser suite checks live counts, passenger hops, dry powder, pause, reduced motion and restored queues.

**Docs:** [`docs/burrow-express.md`](docs/burrow-express.md).

### 27 · Moonlight Mischief (`/moonlight`)

**Play:** A painted moonlit village heist starring Dora and Enzo. Recover every treat, open the rescue cage with Enzo, and bring both chinchillas home before dawn. Three nights have five, six and seven treat bundles, two or three owl patrols, and time limits of 180, 165 and 150 seconds. Complete a night to unlock the next; untimed practice opens every night and lets you learn with unlimited catches. Owls see within gold cones, with buildings blocking sight. Suspicion rises while seen and falls out of sight; three catches end a timed heist. Hide in hay, creep over noisy cobblestones, use dry dust to mask scent for 22 seconds, squeeze through fence gaps with Dora, or move a heavy obstacle with Enzo. Dora has a quiet dash with a four-second recharge; Enzo creates a misleading decoy rustle with an eight-second recharge. Rescue the friend, who finds the way home, then return both heroes. Earn a star for finishing, another for no catches, and another for finishing with a quarter of the night left. Heists save during play and resume paused. Dora retains her dark ruby eyes, and dust bowls contain dry powder.

**Controls:** WASD or arrow keys move, Shift creeps, Q switches, Space uses the selected chinchilla's ability, and E interacts with a nearby object. Tap a path to navigate there; the village-object buttons offer the same destinations. Phones have a paw pad, a creep toggle and a zoomable map that follows the selected chinchilla. Action buttons keep keyboard movement ready. Portrait meters warn when either friend is being watched. P / Escape pauses; M toggles sound. Focus loss pauses and clears held movement. Save & menu keeps the heist; Continue restores it paused.

**Tests:** `npm run test:moonlight` (also in `npm test`) covers navigation, corner collision, abilities, rescue, hiding, dry dust, occluded sight, detection, timeout, save validation, deterministic replay and complete heists on all three nights. `npm run bot:moonlight` runs 15 timed heists with different starting patrol phases through legal routes and actions. `tests/e2e/moonlight.mjs` checks controls, path tapping, abilities, pause/focus loss, mid-heist saves, reduced motion, results and unlocking, asset failure recovery and four phone layouts. `tests/e2e/moonlight-polish.mjs` checks action focus, all-night practice, timed unlocks, standstill dashes, the creep toggle, zoom following, zoomed pause and reduced-motion restarts.

**Docs:** [`docs/moonlight-mischief.md`](docs/moonlight-mischief.md).

### 28 · Pawprint Pinball (`/pinball`)

**Play:** The Clockwork Warren is a painted woodland pinball table matching the approved mock-up. Launch a golden wolfberry, use two carved paw flippers, build bumper combos and race the timber ramps. Three-ball arcade runs keep a personal best; practice gives unlimited berries. Light three burrow targets to rescue a neighbour. The left ramp crosses the bridge; the right ramp feeds a dry powder bowl and moonberry lock. Three locks release three balls with double points. Launches have seven seconds of ball save, and multiball begins with twelve. Frequent nudges tilt the table, resting the flippers for three seconds. Real rotating flipper collisions and ball-to-ball rebounds drive the play; scoring and lamp states stay live over authored artwork. Dora retains dark ruby eyes and the dust bowl stays dry. The table saves as you play and resumes paused; arcade records bank when the third ball drains.

**Controls:** ← / A and → / D control the flippers. Hold Space or Launch to charge and release to launch. ↑ / N nudges. Phones support simultaneous two-thumb presses; cancelled launch presses do not fire a ball. P / Escape pauses, M toggles sound and focus loss pauses and releases every held control. Save & menu keeps the table; Continue restores it paused with launch released.

**Tests:** `npm run test:pinball` (also in `npm test`) covers charge/cancel, flipper momentum, ball collisions, targets/rescue, ramps/dust/locks/multiball, ball save, drains, unlimited practice, tilt, deterministic frame subdivision, snapshot replay and 14,400 in-play snapshots across three planner runs. `npm run bot:pinball` checks eight seeded runs using legal launch/flipper controls. `tests/e2e/pinball.mjs` checks actual input, simultaneous touch and cancellation, focus/pause, saved tables, scoring and banked results, asset retry, reduced motion and four phone layouts.

**Docs:** [`docs/pawprint-pinball.md`](docs/pawprint-pinball.md).

## Validation

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e   # optional; needs `npm run dev` running and `npm i -D playwright`
npm run test:e2e:newest  # the recent games and interrupted-input / progress regressions
```

`npm test` compiles the game engines and runs each game's deterministic suite. It also runs `tests/readme.mjs`, which fails if the **Games** table and **Game guides** above drift from the arcade menu in `app/page.tsx`.

Run `npm test` before the browser suites to generate the compiled engines they use. `tests/e2e/newest-quality.mjs` adds checks for cancelled Poof Panic gestures and focus-loss pausing, Barrage controls released between turns and native keyboard slider controls, and Tactics and Barrage progress saved before the final animation finishes. It also checks that a Tactics run reward is banked once when resumed and that Summit Shuffle explains its separate hero card pools. `tests/e2e/older-quality.mjs` does the same for Chinchilla Clash, Hay Maze Defence and Chinchillas vs Zombies: a result saved in the frame the game ends, a cancelled Clash card drag, pausing when the tab is hidden, and portrait and landscape layouts from 320 to 844 pixels wide. `npm run test:e2e:older` runs it with those three games' own suites.

## Adding a game

1. Put the page at `app/<route>/page.tsx` and the rules in a deterministic engine at `lib/<name>-game.ts`.
2. Add the game's card to `GAMES` in `app/page.tsx`. Update the hardcoded game count in `app/page.tsx` (eyebrow, headline, lede), the metadata description in `app/layout.tsx`, the `/Twenty-eight ways/` assertion in `tests/e2e/dust-bath.mjs`, the 28-card assertions in `tests/e2e/arcade-navigation.mjs`, `tests/e2e/classic-pit.mjs`, `tests/e2e/dust-bath.mjs`, `tests/e2e/mountain-retreat.mjs`, `tests/e2e/mountain-retreat-theme.mjs`, `tests/e2e/paw-buster.mjs`, `tests/e2e/fluff-forge.mjs`, `tests/e2e/chinchilla-clash.mjs`, `tests/e2e/hay-maze.mjs`, `tests/e2e/chinchillas-vs-zombies.mjs`, `tests/e2e/scribble.mjs`, `tests/e2e/burrow-tactics.mjs`, `tests/e2e/burrow-barrage.mjs`, `tests/e2e/summit-shuffle.mjs` and `tests/e2e/poof-panic.mjs` and `tests/e2e/burrow-express.mjs`, and the route list in `tests/e2e/panel-contrast.mjs`.
3. Add `tests/<name>.mjs` and wire it into `npm test` in `package.json`.
4. In this README, update the count in the first sentence, add a row to **Games**, and add a `### NN · Title (`/route`)` guide with **Play**, **Controls**, **Tests** and **Docs**. Both the table and the guides follow arcade-menu order. `npm test` fails until they match.

## Deployment

The arcade is live at **https://chinchillas.jason.engineering**. It runs on Cloudflare Workers as a Worker named `dora-enzo-arcade`.

`npm run build` (vinext) produces the Worker in `dist/`: the server code in `dist/server/` and the static assets in `dist/client/`. Every game runs in the browser, so the Worker needs no database, storage or app secrets. GitHub Pages cannot serve this build as-is.

### Automatic deploys

Every push to `main` deploys automatically. The `deploy` job in `.github/workflows/ci.yml` runs after the typecheck, tests and build pass, then rebuilds and runs `npm run deploy`. Pull requests and pushes to other branches are checked but never deployed. Deploys run one at a time, in push order, and each replaces the live version.

The job needs two repository secrets, under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID`: the ID of the Cloudflare account that owns the Worker.
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token. Create it in the Cloudflare dashboard under **My Profile → API Tokens → Create Token** with the **Edit Cloudflare Workers** template, limited to that account and the `jason.engineering` zone. Store it with `gh secret set CLOUDFLARE_API_TOKEN`, which prompts for the value so it stays out of your shell history.

### Manual deploys

Wrangler, Cloudflare's CLI, is already a dev dependency.

1. Install dependencies and build:

   ```sh
   npm ci
   npm run build
   ```

2. Optionally, preview the production build locally at `http://localhost:8787`:

   ```sh
   npm start
   ```

3. Log in to Cloudflare. This opens a browser window, and you only need to do it once per machine:

   ```sh
   npx wrangler login
   ```

4. Deploy:

   ```sh
   npm run deploy
   ```

`npm run deploy` uploads `dist/` to the `dora-enzo-arcade` Worker and attaches `chinchillas.jason.engineering` as its custom domain. On the first deploy, Wrangler creates the DNS record and HTTPS certificate. The domain must be a zone on the same Cloudflare account. To deploy somewhere else, change `--name` and `--domain` in the `deploy` script in `package.json`.

To check the upload without publishing, run `npx wrangler deploy --config dist/server/wrangler.json --dry-run`; it needs no login. The current build uploads about 1.8 MB (about 514 KB gzipped).

### OpenAI Sites

The project was originally hosted on OpenAI Sites, linked by `.openai/hosting.json`. Keep that file if you want to continue that deployment. It does not affect Cloudflare deploys.

## Contributing and CI

GitHub Actions runs `npm ci`, `npm run typecheck`, `npm test` and `npm run build` on every push and pull request (`.github/workflows/ci.yml`). Pushes to `main` that pass are then deployed (see **Automatic deploys** above). The browser suites in `tests/e2e/` need a running dev server and a local Playwright install, so they are run manually rather than in CI.

[`HANDOFF.md`](HANDOFF.md) records where the work stands, engine notes for the newest games and ideas for what to do next. [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md) hold the project guide and house rules for coding agents.

## License

Released under the [MIT License](LICENSE).
