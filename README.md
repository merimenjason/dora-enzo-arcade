# Dora & Enzo's Arcade

A collection of twelve original browser games starring Dora (white chinchilla) and Enzo (grey chinchilla). The arcade includes ball-bouncing and survival roguelites, a fighting game, two document-inspection editions, stealth, racing, soccer, flight and an action RPG. Three.js renders the 3D games; standalone deterministic engines handle gameplay.

**Chin x Pit** remains the sub-brand for the pit-diving pair: Classic at `/chin-x-pit` and Night Survivors at `/survival`.

## Chin x Pit · Classic (/chin-x-pit)

The arcade now has twelve games. The original ball-bouncing Chin x Pit is restored separately from Night Survivors at `/survival`. Aim with the mouse, move both chinchillas with WASD/arrows, and catch returning balls for stronger ricochets. Auto-fire is enabled by default, or toggle it off and hold left click. Q/Space triggers Double Trouble, F opens the fusion lab, and P/Escape pauses. Clear twelve waves, defeat the Dustbreaker and descend with your build. Three starting kits, twenty weapons, eight fusions and six passive items are preserved. Use **MAIN ARCADE** to return to the menu.

Restoration provenance and validation: [classic restoration evidence](docs/classic-pit-restoration.md).

## Run

Use Node 22.13 or newer:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` for the main arcade. Individual games are available at:

- `/chin-x-pit`: Chin x Pit Classic, the original ball-bouncing roguelite.
- `/survival`: Chin x Pit · Night Survivors.
- `/fighter`: Paw Fighter II.
- `/checkpoint-remake`: Dust & Documents: Remake.
- `/checkpoint`: original Dust & Documents.
- `/escape`: Spy Escape.
- `/adventure`: Bounce / Burrow.
- `/kart`: Pawprint Grand Prix.
- `/soccer`: Fluffball Cup.
- `/hop`: Border Hop.
- `/dust-bath`: Dust Bath Dash.
- `/mountain-retreat`: Dora & Enzo’s Mountain Retreat.

## Controls

- A / D or left / right arrows: move.
- Space, W or up arrow: jump.
- J: jab. K: kick. L: special (35 power). U: rising attack (20 power, grounded only). O: super (100 power, grounded only). Fireballs also accept down, down-forward, forward + J within a short input window, relative to the opponent. Use S, S+D, D+J when facing right; mirror with A when facing left.
- I, S or down arrow: block while grounded.
- P / Escape: pause. Losing window focus also pauses.
- On-screen buttons support touch; optional sound is enabled with the header toggle.

Training mode gives infinite power, no round timer, a self-healing dummy and a live combo-damage readout. Set the dummy to stand, block, jump or fight back, and press Reset to clear the counters.

Story mode follows a chinchilla leaving the Andes to chase American citizenship: the burrow in Chile, the Antofagasta docks, the Atacama crossing, the Darien Gap, the Rio Grande at midnight, an ICE checkpoint and finally the naturalization podium. Rivals appear in that fixed south-to-north order, with narration before and after each chapter. Arcade mode is the classic ladder. Rising attacks also accept the dragon-punch motion (forward, down, down-forward + J). Supers fire a staggered barrage unique to each fighter.

Choose any fighter from the roster at any time to return to selection and reset the arcade run. The header also provides Character Select. Press Start Arcade to confirm. Beat six rivals in the arcade ladder. Each match is first to two round wins; rounds last 60 seconds. Tied rounds do not award a win. Guarding reduces damage, attacks build power, and special projectiles can be jumped over. A defeated player can rematch or change character. Progress is session-only.

## Dust & Documents (/checkpoint)

A document-inspection game in the spirit of Papers, Please, rendered in 3D. A lit border booth sits in the Andes at night: Dora leans over the paperwork at the window, Enzo works behind her, and each traveler walks up the queue line to be judged. The permit, the traveler card, the seal and the two stamps are physical objects on the sill, and the booth scale stands outside the window.

Approving a traveler slams the green stamp, raises the gate arm and lets them walk through. Denying one slams the red stamp, keeps the gate down, flashes the lamp red, shakes the camera and sends them back down the queue. A missing permit leaves an empty desk and a missing seal removes the gold disc, so violations are visible in the world as well as on the documents.

- Each shift opens with a briefing: the day's rules, the quota and Enzo's commentary.
- Compare the entry permit against the traveler card and the booth scale. Eight kinds of violation appear: expired permits, closed regions, mismatched names, missing permits, missing seals, padded weights, barred species and suspended purposes.
- A: approve, D: deny, X: detain a denied violator, Enter: next in line.
- Correct calls pay 5 credits, citations cost 7, detentions pay 1, and rent climbs every shift (17 on day 1, 35 on day 7). Run out of credits and the booth closes.
- Rules escalate: permits from day 1, closed regions from day 2, the scale from day 3, species bans from day 4, seals from day 5 and suspended transit from day 6.
- Three endings depend on the credits you finish the week with.

## Validation

```sh
npm run typecheck
npm test
npm run test:e2e   # optional: drives both games in a real browser (needs `npm i -D playwright`)
npm run build
```

The deterministic suites cover all game engines. Playwright browser tests exercise the main arcade, Chin x Pit Classic, Dust & Documents and Paw Fighter II. Run `npm run dev` before `npm run test:e2e`.

## Preserved games

- `/escape`: Enzo and Dora Escapes from ICE. Controls and mission details: `docs/escape-game.md`.
- `/soccer`: Fluffball Cup.
- `/kart`: Pawprint Grand Prix.
- `/hop`: Border Hop.
- `/survival`: Night Survivors.
- `/adventure`: original RPG.

This project uses vinext and the existing Sites hosting configuration. GitHub stores the source; running the dynamic app requires a compatible Node/Worker host rather than uploading source files directly to GitHub Pages. Keep `.openai/hosting.json` when continuing the existing Sites deployment.

## Fireball moves

- Dora — Dust Blossom: broad, slow dust fireball.
- Enzo — Thunder Chew: fast, heavy chew bolt.
- Andean Fox — Ember Pounce: fast ember shot.
- Night Owl — Feather Cyclone: three feathers at different heights.
- Viper — Venom Wave: low projectile that can be jumped.
- ICE Agent — Red Tape: a hit briefly slows movement; blocking prevents the slow.
- Donald Trump — Golden Tweet: large, slow, powerful energy wave.

Every special costs 35 power. The selected move is displayed on its roster card, and an on-screen callout confirms activation or insufficient power.

## Dust Bath Dash (`/dust-bath`)

Dora (white) and Enzo (grey) run a gentle dust-bath spa. Select a waiting customer, then an empty bath. Hold **SCRUB** with touch, mouse, Space or Enter and release in the striped sweet spot (about 1.3 seconds) to earn up to 12 coins. Too short needs another try. Too long makes the guest sneeze and splash occupied neighboring baths, reducing their tips. Enzo’s treats restore patience and remove one splash. His refill replenishes six dust scoops and three treats after three seconds.

- **Two-minute shifts:** keep guests happy before their patience runs out, then review your results.
- **Untimed cozy mode:** no timer, no departures. Close the spa whenever you want to shop.
- **Between shifts:** buy cloud towels (30 coins, wider sweet spot and less neighboring mess), a golden scoop (40 coins, one-second refills), and fern decor (25 coins, extra patience). Coins and upgrades carry between shifts during this page visit, not after reload.
- **Accessible controls:** native keyboard buttons, visible focus, labeled pressure/patience meters, text feedback, reduced-motion support, and optional two-tap scrubbing without holding. Pause and the guide stop simulation. Switching tabs or leaving the window automatically pauses and cancels a held scrub.
- **Navigation:** MAIN ARCADE returns to all twelve cabinets. Existing game names are unchanged.
- **Verification:** `npm run test:dust-bath` runs the deterministic engine suite. With the dev server on port 3000 and Playwright available, `node tests/e2e/dust-bath.mjs` checks keyboard/pointer/touch gameplay, splash recovery, supplies, pause, cozy shopping, shift completion and responsive navigation.

## Dora & Enzo’s Mountain Retreat (`/mountain-retreat`)

The twelfth standalone cabinet is a responsive, pixel-styled cutaway of Juniper Lodge. White Dora handles hospitality and grey Enzo supplies, with equally prominent portraits, allocations and animated in-world sprites. Open the kitchen, suite and alpine bath, then improve all four rooms to level 3.

- **5–10 minute visits:** supplies feed automatic guest visits, which earn hearts and tips. Welcome serves every 6 seconds, comfort every 10 seconds for triple hearts. Gathering sustains the lodge; crafting trades supply throughput for 50% higher tips.
- **Shared outings:** a 45-second expedition costs 12 supplies and returns 48 supplies plus 35 tips. A 60-second festival costs 12 hearts and 20 supplies and returns 110 tips plus 24 hearts. Both pause all normal production, including the room-work clock. Remaining elapsed time resumes production after completion.
- **Local journal:** versioned, strictly validated saves use only `dora-enzo-mountain-retreat-v1`. SSR never reads storage. Malformed saves start fresh, blocked storage permits in-memory play, future timestamps earn nothing, and offline simulation is capped at eight hours. No account, network service, purchase or reset of another game’s save. Use one tab, as cross-tab conflict resolution is not implemented.
- **Accessibility:** native keyboard/touch buttons, selected-state announcements, visible focus, activity progress, live event feedback and reduced-motion support. The field guide explains the economy.
- **Tests:** `npm run test:mountain-retreat`, `node tests/e2e/mountain-retreat.mjs` (running server and locally available Playwright), plus the shared engine, typecheck and build suites.

Requirement-level checks and known limitations: [Mountain Retreat validation](docs/mountain-retreat-validation.md).

## Contributing and CI

GitHub Actions runs `npm ci`, `npm run typecheck`, `npm test` and `npm run build` on every push and pull request (`.github/workflows/ci.yml`). The browser suites in `tests/e2e/` need a running dev server and a local Playwright install, so they are run manually rather than in CI.

## License

Released under the [MIT License](LICENSE).
