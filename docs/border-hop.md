# Dora & Enzo's Arcade · Border Hop

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
- Each checkpoint awards 100 points. Earn a **Perfect Pair** bonus of 50 points when both characters cross within 30 logical pixels of the gap center.
- A brief collision freeze identifies who clipped the obstacle. After 0.55 seconds, Space or tapping the result screen starts a fresh flight.
- Best points are saved locally in this browser, when storage is available.
- The Sound button enables short synthesized flap, checkpoint, bonus and collision sounds. Sound starts off.

The previous survival game is retained at `/survival`, with its instructions in `docs/night-survivors.md`. The original RPG remains at `/adventure`.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Flappy tests check gravity, shared flaps, front and rear collisions, collision attribution, retry cooldown, pause, two-character center bonuses, scoring, and three complete 20-checkpoint flights. The retained survival and RPG modes also have simulation tests. These checks do not inspect browser rendering.

## Source

- `app/page.tsx`: Border Hop interface and input.
- `lib/flappy-game.ts`: flight physics, collisions, checkpoint generation and scoring.
- `lib/flappy-scene.ts`: canvas desert landscape, checkpoints and chinchilla artwork. Dora and Enzo are the shared side-on drawing from `lib/chinchilla-art.ts` in its mid-air pose, with paper wings and a passport each; Enzo is drawn over Dora's tail so both faces show.
- `app/survival/page.tsx`: retained survival game.
- `app/adventure/page.tsx`: retained RPG.

This uses Vinext and a Cloudflare Worker. `npm run build` creates `dist/`; uploading source to GitHub alone does not deploy it to GitHub Pages.
