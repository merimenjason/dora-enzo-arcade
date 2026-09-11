# Dora & Enzo's Arcade

A collection of twelve original browser games starring Dora (a white chinchilla) and Enzo (a grey one). Pick a cabinet from the arcade menu at `/` and play in the browser, with no install and no sign-in. Three.js renders the 3D games and Canvas 2D the flat ones. Every game keeps its rules in a standalone deterministic engine under `lib/`, which the tests drive directly.

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

Every visit has a featured guest with a wish: a room, sometimes an oat cake or herbal soap, and sometimes Extra comfort. A guest book shows who is coming next. Granted wishes earn bonus tips, hearts and reputation. Unmet wishes cost 1 reputation, and guests turned away for lack of supplies cost 3. Every 20 reputation adds a star (up to 5), which unlocks new guest types and bigger tips. At level 3 each room picks one of two specialties. Regulars Pip, Mochi and Luna return every fifth visit and send postcards at friendship 3, 6 and 10, and every featured guest fills a coat album. Seasons change every 6 minutes of lodge time and night falls every 2 minutes, each with its own bonus. Stargazers only come at night, and winter closes the summit. A ? beside tips, hearts, supplies and the rating breaks each number down. A countdown ring shows the next guest arriving, and a season strip shows the time until the next season and until nightfall. Each visit shows its rewards floating over the room and marks coats that are new to the album. After time away, a summary lists what happened. Soft synthesized sound is available and off by default.

All outings pause normal production:

- Glass lake: 25 seconds. Costs 5 supplies and returns 18 supplies, 12 tips, an oat cake and a herbal soap.
- Juniper trail: 45 seconds. Costs 12 supplies and returns 48 supplies plus 35 tips.
- Condor summit (2 stars, not in winter): 90 seconds. Costs 30 supplies and returns 60 supplies, 90 tips, 10 hearts and a lodge decoration worth +1 tip per visit.
- Festival: 60 seconds. Costs 12 hearts and 20 supplies and returns 110 tips, 24 hearts and 5 reputation, or half as much again in summer.

Progress is saved locally under `dora-enzo-mountain-retreat-v1` (save format version 2; older journals upgrade automatically), with offline progress capped at eight hours. Malformed saves start fresh. The light/dark theme choice is stored separately under `mountain-retreat-theme`. There is no account and no network service. Play in one tab, because cross-tab conflicts are not resolved.

**Controls:**

- Native keyboard and touch buttons with visible focus and selected-state announcements.
- Keys 1–4 set the hosts' duties: 1 Welcome, 2 Extra comfort, 3 Gather, 4 Craft with care. They are ignored while a form control has focus.
- The field guide explains the economy, and each ? opens a breakdown that works with touch, keyboard and screen readers. Reduced motion is respected.

**Tests:** `npm run test:mountain-retreat` (also in `npm test`). Browser: `tests/e2e/mountain-retreat.mjs`, `tests/e2e/mountain-retreat-theme.mjs`, `tests/e2e/mountain-retreat-scene.mjs`, `tests/e2e/mountain-retreat-depth.mjs` and `tests/e2e/mountain-retreat-ux.mjs`.

**Docs:** [Mountain Retreat validation and known limitations](docs/mountain-retreat-validation.md).

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
2. Add the game's card to `GAMES` in `app/page.tsx`. Update the hardcoded game count in `app/page.tsx` (eyebrow, headline, lede), the metadata description in `app/layout.tsx`, and the `/Twelve ways/` assertion in `tests/e2e/dust-bath.mjs`.
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
