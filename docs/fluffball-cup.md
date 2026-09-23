# Dora & Enzo's Arcade · Fluffball Cup

A top-down arcade soccer game with Dora’s Sky Squad (blue, player-controlled) against a computer side. Each team has three outfield chinchillas and an automatic goalkeeper. Matches last 90 seconds of play, with a short kickoff pause after goals.

## Modes

- **The cup:** three knockout rounds against Viscacha United, Degu Dynamo and Enzo’s Ember FC, in that order. Win to go through; lose to replay the round or start again. A cup match level at full time goes to golden goal: play on, and the next goal wins. The page stores cups won and the furthest round reached in `localStorage` (`fluffball-cup-v1`).
- **A friendly:** one match against Ember FC. Friendlies can end level.

Each rival in `RIVALS` (`lib/soccer-game.ts`) sets its chase and carry speed, how far out it shoots and how hard, its keeper’s shuffle and dive speeds, how far ahead its chaser reads your run (`lead`), and whether a second defender covers the line from the ball to goal (`cover`). Viscacha United is the gentlest; Ember FC is the sharpest, and its captain Enzo has the **Ember Dash**: with the ball past his own third he bursts forward at 1.7× speed for 0.8 s, at most every 5 s.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

## Controls

- WASD / arrows: move the selected player.
- Shift: sprint while stamina is available; stamina recovers when not sprinting.
- Mouse: aim shots. The default aim is the opposing goal on the right.
- J: pass to a nearby teammate.
- K / Space: shoot when the selected player possesses the ball.
- L: Cloud Chip, when the Fluff meter is full.
- Tab: switch to the teammate closest to the ball, excluding the current player and goalkeeper.
- P / Escape: pause or resume.
- Touch buttons provide movement, sprint, pass, shoot, chip and switching.

Control automatically switches to a blue outfield teammate receiving or winning the ball. Moving into an opposing ball carrier tackles, with a brief possession protection period. Goalkeepers defend and distribute automatically; when a shot is heading inside the posts they dive for the point where it will cross the line, so long shots are usually saved and the far corner from close in is the way to score. Balls rebound from the boundaries outside the goals for continuous arcade play; there are no fouls, offside or throw-ins. Dora’s side attacks right throughout the match.

The **Fluff meter** fills slowly on its own, by a fifth for every pass that reaches a teammate and by a quarter for every tackle you win. With it full, L plays a **Cloud Chip**: a lofted shot whose lift is chosen to bring it down near the aim point. While the ball is above 1.4 units nobody can take it, keepers included; it only counts under the bar (height 3), and a ball over the bar is a goal kick. Full time shows shots and possession.

## Drawing

`lib/soccer-scene.ts` draws a stand of chinchilla fans in their team’s scarves above the pitch (they bob, and jump on goals), advertising boards below, mown and textured grass drawn once and reused, nets that bulge after a goal, corner flags in team colours, and confetti on goals. The players are the shared side-on Dora and Enzo drawing (`lib/chinchilla-art.ts`) in team vests with numbers, with coats for teammates and rivals (sandy viscachas, brown degus) built from the same drawing. Players face the way they are moving and keepers stretch out when they dive. The ball has a height: its shadow stays on the grass while it rises, and with a full meter the aim guide shows the chip’s arc.

## Earlier games

- `/kart`: Pawprint Grand Prix. See `docs/pawprint-grand-prix.md`.
- `/hop`: Border Hop. See `docs/border-hop.md`.
- `/survival`: Night Survivors. See `docs/night-survivors.md`.
- `/adventure`: original RPG.

## Validation and source

```sh
npm run typecheck
npm test
npm run build
```

`lib/soccer-game.ts` contains movement, possession, AI, shots, the chip, goals, match timing and the cup rules. `lib/soccer-scene.ts` renders the stands, pitch, teams, ball and aim guide. `app/soccer/page.tsx` contains the mode choice, cup progress, UI and controls. `tests/soccer.mjs` exercises sprinting, pause, passing, shooting, scoring at both goals, kickoffs, rebounds, tackling, switching, full matches, the cup draw, the Fluff meter, the Cloud Chip, goal kicks, golden goal, the Ember Dash, stats and a cup final played by a simple bot. `tests/e2e/fluffball-cup.mjs` checks the cup draw, kicking off a cup match and a friendly, the rival scoreboard, that the pitch is drawn, the chip waiting for a full meter, pausing and the phone layout.

The project uses Vinext and a Cloudflare Worker; uploading source to GitHub does not automatically deploy it to GitHub Pages.
