# ChinChin · Dustbound

An isometric browser action RPG starring White and Grey, based on the two real chinchillas. Lead one while the other follows and fights automatically. Both are visible in a shared 3D view. Explore endless procedurally generated floors, earn shared party XP, and build separate skill trees for White and Grey. A Great Sweeper guardian appears every third floor.

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
| Skill trees (pauses combat) | K |
| Pause | Escape or P |

White uses ranged seeds; Grey fights in melee. Successful hits build shared bond. Green loot restores shared courage. Each cleared floor offers a boon and a full heal. Levels grant one shared skill point, +12 courage, and +7% base damage. You start with one point. Both heroes share XP, while skill points can be invested across either tree:

- White: Marksmanship (damage → attack speed → extra volley seeds) or Mooncraft (cooldown → freezing seeds → nova).
- Grey: Ravager (damage → cleaving attacks → cyclone) or Guardian (damage reduction → courage → cheaper healing team burst).

Skills have rank caps, parent prerequisites, and level gates. Leveling restores courage. Running out of courage resets the current floor while keeping levels and skill choices; each enemy grants XP only once per floor to prevent retry farming. Progress persists throughout the current adventure, not across page reloads. A new adventure starts a fresh build and random seed.

Each floor generates dividing walls, doorways, cover, names, and enemy placements. The simulation, minimap, and scene share the same generated geometry. Floors are deterministic for a seed and depth; retries preserve the layout. Guardians do not end the descent. The camera widens when the pair separates, and walls fade when they obscure a hero.

Sound, fur detail, shadows, and camera zoom can be adjusted in the interface. This edition is single-player with an AI companion and is separate from the earlier 2D, side-view 3D, and FPS games.

## Validate

```sh
npm run typecheck
npm test
npm run build
```

The deterministic simulation tests cover obstacle navigation, companion combat, attacks and cooldowns, projectile cover, healing, pause/reset, 600 generated-floor connectivity checks, skill prerequisites and combat effects, and three four-floor runs using normal combat commands. They do not test browser rendering or visual UI behavior.

## Source

- `lib/arpg-game.ts`: movement, pathfinding, combat, loot, and progression.
- `lib/dungeon.ts`: seeded procedural floor generation.
- `lib/skills.ts`: skill trees, ranks, descriptions, and prerequisites.
- `lib/arpg-scene.ts`: Three.js isometric dungeon, enemies, effects, and camera.
- `lib/chinchilla.ts`: chinchilla meshes and geometric fur.
- `app/page.tsx`: input, HUD, menus, and audio.
- `app/globals.css`: interface styling.

The Sites deployment uses Vinext and the generated Cloudflare Worker build. `npm run build` produces `dist/`; `.openai/hosting.json` identifies this separate hosted edition.
