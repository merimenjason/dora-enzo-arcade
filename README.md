# Dora & Enzo's Arcade

A collection of fifteen original browser games starring Dora (a white chinchilla) and Enzo (a grey one). Pick a cabinet from the arcade menu at `/` and play in the browser, with no install and no sign-in. Three.js renders the 3D games and Canvas 2D the flat ones. Every game keeps its rules in a standalone deterministic engine under `lib/`, which the tests drive directly.

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

**Play:** Top-down arcade soccer. You control Dora's Sky Squad (blue) against Enzo's Ember FC (orange, AI). Each team has three outfield chinchillas and an automatic goalkeeper. Matches last 90 seconds of play. Control follows the blue player receiving or winning the ball, and running into the ball carrier tackles. Balls rebound off the boundaries, with no fouls, offside or throw-ins.

**Controls:**

- WASD / arrows: move. Shift: sprint while stamina lasts. Mouse: aim shots.
- J: pass. K / Space: shoot. Tab: switch to the teammate nearest the ball.
- P / Escape: pause. Touch buttons cover movement, sprint, pass, shoot and switching.

**Tests:** `tests/soccer.mjs` (in `npm test`).

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

**Play:** A cozy top-down village-life game on a fixed 32×24 tile seaside hollow, drawn with Canvas 2D. Pick Dora or Enzo; the other runs Burrow Works next door, holds your house loan and keeps a list of eleven things to try, each paying raisins when you first do it. A day lasts 6 minutes of real time, seasons change every 4 days, and roughly one day in four is rainy (snowy in winter). Fruit trees drop 3 apples a day; foreign fruit (pear, peach, cherry, orange) comes from neighbours and sells for 500 instead of 100, and planting a fruit with the shovel grows a new tree in 3 days. Four money rocks pay 25, 50, 75 and 100 raisins for four shovel hits a day. Three fossils are buried each morning. Fishing: cast into the river, pond or sea, wait for the tug, and press again within 0.9 s; the 14 fish depend on the water, the season and day or night, from a 100-raisin pond frog to a 7,000-raisin tuna. The 12 bugs spawn by season, time and habitat (grass, trees, flowers, water), up to six at once; snails only come out in the rain. Flowers can be picked bare-pawed, or watered so that two watered neighbours may breed overnight: red and yellow can make orange, red and white pink, white and yellow purple, and white and white blue, and hybrids sell for 400 instead of 40.

Vito’s Emporium (open 8:00 to 22:00) buys anything and sells the shovel (600) and watering can (400), red, yellow and white seeds (80) and three rotating pieces of furniture a day. The museum takes one of each of the 34 species. Your pockets hold 20 things. Four neighbours (Pia the flamingo, Rodri the fox, Vivi the viscacha and Tato the condor) wander the paths from 7:00 to 22:00, each with a favourite kind of gift and a daily request; the first chat of the day is +1 friendship, a gift +1 or +3 if it is their favourite, a delivered request +3 plus 300 raisins or a foreign fruit. The loan runs 4,800 for the tent, 19,800 for the Cozy Burrow and 49,800 for the Roomy Burrow, paid in any amounts at Burrow Works; each payoff moves you up and makes room for 2, 4, 6 then 8 pieces of furniture. Sleeping at home skips to 7:00 the next morning. The game autosaves in this browser every few seconds.

**Controls:**

- WASD or arrows: move. Shift: run. Space, E or Enter: use the selected tool on the tile in front of you, talk to a neighbour in front of you, shake a tree or enter a door when facing it.
- 1–5 or Tab: choose bare paws, net, rod, shovel or watering can (the last two must be bought). Click a pocket to select an item for gifting or planting.
- In a conversation, 1–3 pick a reply and Space takes the last one. Escape closes conversations, leaves the shop, museum or burrow and closes the passport. P opens the passport of everything caught.
- On-screen arrows and an action button appear on touch screens and narrow windows. Sound can be toggled from the header, and Save & quit returns to the title screen.

**Tests:** `npm run test:dusty-hollow` (also in `npm test`) compiles `lib/dusty-hollow-game.ts` and runs `tests/dusty-hollow.mjs`: 21 checks covering the fixed map and bridge, walking, running and collisions, the clock, seasons and deterministic weather, fruit trees, casting, biting and reeling, fish filtered by habitat, season and time, bug spawning and netting, money rocks, fossils and museum donations, flower watering, breeding and hybrids, planting seeds and saplings, pocket limits, the shop’s hours, prices and daily stock, furniture and sleeping, the loan ladder, neighbour chats, gifts, requests and friendship, wandering and bedtime, goal rewards, save round-trips and deterministic replays.

**Docs:** [`docs/dusty-hollow.md`](docs/dusty-hollow.md).

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
2. Add the game's card to `GAMES` in `app/page.tsx`. Update the hardcoded game count in `app/page.tsx` (eyebrow, headline, lede), the metadata description in `app/layout.tsx`, the `/Fifteen ways/` assertion in `tests/e2e/dust-bath.mjs`, and the 15-card assertions in `tests/e2e/arcade-navigation.mjs`, `tests/e2e/classic-pit.mjs`, `tests/e2e/dust-bath.mjs`, `tests/e2e/mountain-retreat.mjs` and `tests/e2e/paw-buster.mjs`.
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
