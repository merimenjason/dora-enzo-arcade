# Dora & Enzo's Arcade

A collection of seventeen original browser games starring Dora (a white chinchilla) and Enzo (a grey one). Pick a cabinet from the arcade menu at `/` and play in the browser, with no install and no sign-in. Three.js renders the 3D games and Canvas 2D the flat ones. Every game keeps its rules in a standalone deterministic engine under `lib/`, which the tests drive directly.

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

**Play:** An isometric action RPG, titled *Dustbound* in game, set across endless procedurally generated floors. Lead Dora (ranged seeds) or Enzo (melee) while the other follows and fights automatically. Shared XP levels the party. Each level gives one skill point to spend in either hero's two branching skill trees. A Great Sweeper guardian appears every third floor. Running out of courage resets the floor but keeps levels and skills. Progress lasts for the current adventure, not across reloads.

**Controls:**

- Left click floor / enemy: move, or pursue and attack. Hold to steer. WASD / arrows also move.
- Tab: switch hero (1 for Dora, 2 for Enzo). R: target the nearest enemy.
- Right click or F: special (Dora's seed fan, Enzo's whirling paws). Space: dodge. Q: bond burst (costs 50 bond).
- E at a cleared chamber's arch: next floor. K: skill trees (pauses combat). Escape or P: pause.

**Tests:** `tests/arpg.mjs` (in `npm test`).

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

**Play:** A Symphony of the Night-style castle explorer, drawn in Canvas 2D with the same Dora and Enzo as Fluff Forge. Grandpa Pebble says the Golden Wolfberry, a berry that never runs out of snacks, grows at the top of the castle on the mountain, and the two go in together. The castle is one connected map of rooms, each one or more screens of 24×14 tiles; walking off an edge takes you into the next room, and a minimap and a full map in the menu fill in as you explore. Two chapters are open: chapter I is the Moonlit Approach, Entrance Hall, Hay Cellar and Owl Belfry, and chapter II is the Pantry Catacombs behind the belfry's sealed door, 21 rooms over 39 map screens. Every area has three layers of parallax scenery (moonlit graveyards, stained-glass windows, barrel vaults, clockwork, shelves of glowing jars), candlelight that cuts through the dark, and afterimages when a hero dashes or lunges.

You control one hero while the other follows a step behind. Press C to **tag**: the partner tumbles from behind to the front in a spinning ball that hurts anything on its path (1.6× their attack plus 4, and it gets past an armadillo’s shield), then carries on as the lead. Tags have a one-second cooldown. Dora sweeps a **Dust Fan** (34-pixel reach, 140 px/s walk): every sweep blows a small gust of dust ahead, and holding attack then letting go spins her in a whirlwind that hits both sides for double damage. Enzo **lunges** into quick 28-pixel claw swipes (124 px/s walk, more HP and defence): each swipe carries him forward, stops when it connects, and won’t take him off a ledge. Pressing attack again as a swing ends chains a **three-hit combo**, and the third hit does 1.5× damage: Dora’s blows a big gust that goes through foes, Enzo’s claws uppercut foes into the air, and a club slams out little quakes. Each hero has their own HP; when the lead is worn out the partner takes over automatically and the worn-out one can’t tag back in until a rest. Both worn out sends you back to the last save.

Landing hits fills a **Duo meter**. When it’s full, tag and attack together (or V) set off a **Duo Strike**: both heroes streak across the screen and strike every foe in view. Spells run on **Dust**, which trickles back over time and drops from candles. Dora learns **Whirlwind** at level 3 (↓ ↘ → + attack), a drifting tornado that hits again and again. Enzo learns **Burrow Quake** at level 4 (→ ↓ ↘ + attack), quakes both ways that throw foes up. F casts either without the motion. Up + attack throws the readied **sub-weapon**, paid for in seeds:

- a sunflower seed;
- the **Seed Spread**, three seeds at once, found in the cellar;
- the **Boomerang Acorn**, which flies out and back through foes, high on the belfry stair;
- the **Pumpkin Flask**, which bursts into a row of flames, in the larder.

Choose between them and read up on spells in the menu’s Magic tab. A difficulty is picked for each new game: Easy softens foes and heals a little at every doorway, and Hard makes foes 1.5× tougher and has bosses fight all-out from the start.

Chapter I has cave bats that wake and chase, dust moths that drift after you, shell beetles, bone mice that lob bones, and armadillo guards whose shield blocks hits from the front until a lunge leaves them open. The catacombs add pantry rats that bristle and charge, jar ghosts that fade out of reach, and cellar spiders that drop on their threads. Every hit freezes the frame for an instant and shows its damage; your luck gives a chance of a 1.5× critical, and defeated foes crumble into dust. Foes give XP (one shared level for both, with more HP, attack and defence each level) and drop raisins and sometimes gear or food. Candles hide seeds, raisins and wolfberries. Gear goes in three slots per hero (weapon, armour, accessory): the Moonlit Fan and Wolfberry Fan for Dora; the Acorn Cudgel, Rolling Pin and Iron Claws for Enzo; the Wool Scarf, Moth Cape, Thimble Helm, Silver Bell, Beetle Shell and Raisin Ring. Hay Cakes heal 40, wolfberries 20 and Timothy Tea 80 from the Items menu. Wolfberry Leaves raise both heroes’ max HP by 10. Pip the hamster keeps a stall in the catacombs that sells food, seeds, the Thimble Helm, Raisin Ring and Iron Claws for raisins. Defeated foes stay down until you rest at a shrine or move to another area, and the **Bestiary** tab records each kind you’ve beaten with its stats, weakness and a line of lore.

Three **familiars** can be befriended, and one comes along at a time, levelling up as you win fights:

- **Pudding the guinea pig** is lost and hungry in the Hay Cellar. Bring her a Hay Cake and she’ll heal the lead when they’re badly hurt.
- **Zippy the sugar glider** is locked in a cage on the belfry stair. Break it and he glides at nearby foes and nips them.
- **Mochi the capybara** soaks by the catacomb shrine, too worried about the rats to relax. Once the Rat King falls she joins, bonking away shots aimed at the lead and sniffing out cracked walls.

The **Dust Dash** relic in the cellar lets you burst forward, once in mid-air, and dashing into a jump carries you far; it is the only way across the broken gallery in the Entrance Hall. The **Cloud Hop** relic in the catacombs is a second jump in mid-air, and it reaches the chimney up to the Rat King and two high treasures. Cracked walls crumble when hit and hide a Wolfberry Leaf and a secret room. Golden **dust-bath shrines** heal and revive both heroes and save the game in this browser, and once you’ve found two, pressing up at one warps you to another. Bosses are saved the moment they fall, so they never come back. Each area has its own synthesised music, and bosses have a theme of their own. At the top of the belfry stair waits **Duke Hootsworth**, a great horned owl (260 HP) who throws feather volleys and swoops low across the room; at half health he summons two bats and adds a dive that sends shockwaves along the floor. Beating him ends chapter I and opens the sealed door. At the top of the catacomb chimney sits **Gnawdrick the Rat King** (560 HP) on his cheese throne. He charges wall to wall, stunning himself and shaking rocks from the ceiling; he leaps at you and lands with shockwaves; and he bowls wheels of cheese. At half health he calls two rats and bowls a bouncing wheel too. Beating him ends chapter II; you can keep exploring afterwards.

**Controls:**

- ← → or A D: walk. Space, Z or K: jump (hold for height; again in mid-air with the Cloud Hop). ↓ + jump: drop through a ledge.
- X or J: attack (tap again for a combo; as Dora, hold and let go to spin). ↑ + attack: throw the sub-weapon. F: cast the lead’s spell (or use its motion + attack). C or E: tag. C + X, V or Q: Duo Strike. Shift or L: Dust Dash.
- ↑: read a sign, talk, shop at Pip’s stall, or warp at a shrine. Escape, Enter, M, P or Tab: open or close the menu (Status, Equip, Magic, Items, Familiars, Bestiary, Map), or leave the shop or warp list.
- The title screen picks Easy, Normal or Hard for a new game. Sound and Music each have their own toggle.
- Gamepad: d-pad or left stick to move, A jump, X attack, B or RB dash, Y or LB tag, RT spell, LT Duo Strike.
- On touch screens and narrow windows an on-screen pad has move, up, down, spell, Duo, tag, dash, attack, jump and menu.

**Tests:** `npm run test:fluffstevania` (also in `npm test`) compiles `lib/fluffstevania-game.ts` and runs `tests/fluffstevania.mjs`: 40 checks. They cover:

- the room grid, and that every doorway leads somewhere;
- a reachability search over the whole map proving the belfry needs the Dust Dash, the catacombs need the owl beaten, and the Rat King and the high treasures need the Cloud Hop, and that every spot can get back to the start;
- real physics for the broken gallery, the Cloud Hop’s height, and the shrine ledge only the hop reaches;
- the opening story, walking, jumping and the follower, attacks, damage numbers, XP and levels;
- Enzo’s lunge and how it stops at a hit and at a ledge;
- tagging and the tag tumble, the Dust Dash, getting hurt and the worn-out swap;
- shrines, saves, loading, and older saves swapping the old whips and swords for fans;
- cracked walls and the Wolfberry Leaf, candles and seeds, the armadillo’s shield, gear and food;
- Pip’s shop, rats, ghosts and spiders;
- both boss fights from gates to defeat and the chapter endings;
- difficulty scaling, doorway healing on Easy and fierce bosses on Hard;
- foes staying down until a rest or a change of area, and bosses saved as they fall;
- combos and finishers, the fan’s gusts and spin, the Duo Strike;
- Dust, both spells and their motions, and all four sub-weapons;
- shrine warps, all three familiar quests and what each familiar does, the Bestiary count, and the Silver Bell’s chime;
- deterministic replays.

Browser: `tests/e2e/fluffstevania.mjs`:

- picks Hard and starts a new game, reads the opening story, walks and attacks, and tags;
- opens every menu tab;
- continues from an older save and equips a fan;
- buys from Pip, warps between shrines and toggles the music;
- checks a phone-sized screen.

**Docs:** [`docs/fluffstevania.md`](docs/fluffstevania.md).

## Validation

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e   # optional; needs `npm run dev` running and `npm i -D playwright`
```

`npm test` compiles the game engines and runs each game's deterministic suite. It also runs `tests/readme.mjs`, which fails if the **Games** table and **Game guides** above drift from the arcade menu in `app/page.tsx`.

## Adding a game

1. Put the page at `app/<route>/page.tsx` and the rules in a deterministic engine at `lib/<name>-game.ts`.
2. Add the game's card to `GAMES` in `app/page.tsx`. Update the hardcoded game count in `app/page.tsx` (eyebrow, headline, lede), the metadata description in `app/layout.tsx`, the `/Seventeen ways/` assertion in `tests/e2e/dust-bath.mjs`, the 17-card assertions in `tests/e2e/arcade-navigation.mjs`, `tests/e2e/classic-pit.mjs`, `tests/e2e/dust-bath.mjs`, `tests/e2e/mountain-retreat.mjs`, `tests/e2e/paw-buster.mjs` and `tests/e2e/fluff-forge.mjs`, and the route list in `tests/e2e/panel-contrast.mjs`.
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

## License

Released under the [MIT License](LICENSE).
