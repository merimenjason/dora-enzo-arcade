# Chin x Pit · Fluffball Cup

A top-down arcade soccer game with Dora’s Sky Squad (blue, player-controlled) against Enzo’s Ember FC (orange, AI). Each team has three outfield chinchillas and an automatic goalkeeper. Matches last 90 seconds of play, with a short kickoff pause after goals.

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
- Tab: switch to the teammate closest to the ball, excluding the current player and goalkeeper.
- P / Escape: pause or resume.
- Touch buttons provide movement, sprint, pass, shoot and switching.

Control automatically switches to a blue outfield teammate receiving or winning the ball. Moving into an opposing ball carrier tackles, with a brief possession protection period. Goalkeepers defend and distribute automatically. Balls rebound from the boundaries outside the goals for continuous arcade play; there are no fouls, offside or throw-ins. Dora’s side attacks right throughout the match. Full time shows the winner or a draw.

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

`lib/soccer-game.ts` contains movement, possession, AI, shots, goals and match timing. `lib/soccer-scene.ts` renders the pitch, teams, ball and aim guide. `app/page.tsx` contains UI and controls. Tests exercise sprinting, pause, passing, shooting, scoring at both goals, kickoffs, rebounds, tackling, switching and a full match; earlier modes retain their simulation tests. No browser rendering tests are included.

The project uses Vinext and a Cloudflare Worker; uploading source to GitHub does not automatically deploy it to GitHub Pages.
