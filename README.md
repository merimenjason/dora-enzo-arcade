# Paw Fighter II

An original side-view arcade fighting game starring Dora (white chinchilla) and Enzo (grey chinchilla). Seven playable fighters include an Andean fox, owl, viper, ICE agent and a playful Donald Trump caricature. Three.js renders the arena and characters; a standalone deterministic game engine handles combat.

## Run

Use Node 22.13 or newer:

```sh
npm ci
npm run dev
```

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

## Validation

```sh
npm run typecheck
npm test
npm run build
```

`tests/fighter.mjs` covers hit timing, blocking, special costs/projectiles, jumps, pause, round resets, draws, AI matchups for all seven fighters and full ladder progression. No browser rendering tests are included.

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
