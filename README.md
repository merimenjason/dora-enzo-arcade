# ChinChin · Dustbound

An isometric browser action RPG starring White and Grey, based on the two real chinchillas. Lead one while the other follows and fights automatically. Both are visible in a shared 3D view. Clear three chambers, collect treats, choose upgrades, and defeat the Great Sweeper.

## Run locally

Requires Node.js 22.13+ and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open the printed localhost URL and select **Enter the den**. No pointer lock is needed.

## Controls

| Action | Control |
| --- | --- |
| Move / pursue and attack | Left click floor / enemy; hold to steer |
| Move directly | WASD or arrow keys |
| Switch hero | Tab; 1 for White, 2 for Grey |
| Target nearest enemy | R |
| Seed volley / whirling paws | Right click or F |
| Dodge | Space |
| Shared bond burst | Q, costs 50 bond |
| Enter cleared chamber's passage | Approach arch and press E |
| Pause | Escape or P |

White uses ranged seeds; Grey fights in melee. Successful hits build shared bond. Green loot restores shared courage. Each cleared chamber offers a permanent boon and a full heal. Running out of courage resets the current chamber and keeps earlier upgrades. The final chamber ends the adventure.

Sound, fur detail, shadows, and camera zoom can be adjusted in the interface. This edition is single-player with an AI companion and is separate from the earlier 2D, side-view 3D, and FPS games.

## Validate

```sh
npm run typecheck
npm test
npm run build
```

The deterministic simulation tests cover obstacle navigation, companion combat, attacks and cooldowns, projectile cover, healing, pause/reset, and a complete three-chamber run using normal combat commands. They do not test browser rendering or visual UI behavior.

## Source

- `lib/arpg-game.ts`: movement, pathfinding, combat, loot, and progression.
- `lib/arpg-scene.ts`: Three.js isometric dungeon, enemies, effects, and camera.
- `lib/chinchilla.ts`: chinchilla meshes and geometric fur.
- `app/page.tsx`: input, HUD, menus, and audio.
- `app/globals.css`: interface styling.

The Sites deployment uses Vinext and the generated Cloudflare Worker build. `npm run build` produces `dist/`; `.openai/hosting.json` identifies this separate hosted edition.
