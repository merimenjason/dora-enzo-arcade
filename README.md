# Chin x Pit · Border Hop

A Flappy Bird-style browser game starring Dora and Enzo, a white and a grey chinchilla flying together on paper wings. Cross a stylized desert landscape, pass 20 striped checkpoint gaps, and arrive at the Welcome to the USA gate.

## Run locally

Requires Node.js 22.13+ and a browser supporting Canvas 2D.

```sh
npm ci
npm run dev
```

## Play

- Click **Let’s flap** to begin.
- Space, Up, W, or tap/click the game canvas lifts both chinchillas.
- Release to descend. Both chinchillas must clear the checkpoint columns.
- Hitting a column, the ground, or the ceiling ends the flight.
- A point is awarded only after both friends fully clear a checkpoint.
- P, Escape, or the pause button pauses/resumes. Switching away pauses the game.
- Clear 20 checkpoints to win. **Fly again** generates another flight.
- Session best lasts until the page is refreshed.

The previous survival game is retained at `/survival`, with its instructions in `docs/night-survivors.md`. The original RPG remains at `/adventure`.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Flappy tests check gravity, shared flaps, front and rear collisions, pause, scoring, and three complete 20-checkpoint flights. The retained survival and RPG modes also have simulation tests. These checks do not inspect browser rendering.

## Source

- `app/page.tsx`: Border Hop interface and input.
- `lib/flappy-game.ts`: flight physics, collisions, checkpoint generation and scoring.
- `lib/flappy-scene.ts`: canvas desert landscape, checkpoints and chinchilla artwork.
- `app/survival/page.tsx`: retained survival game.
- `app/adventure/page.tsx`: retained RPG.

This uses Vinext and a Cloudflare Worker. `npm run build` creates `dist/`; uploading source to GitHub alone does not deploy it to GitHub Pages.
