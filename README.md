# ChinChin · Bounce / Burrow

A browser ball-bouncing roguelite starring White and Grey, the two chinchillas. Aim volleys into advancing dust enemies, ricochet off the pit walls, collect upgrades, and fuse elemental balls. Both fluffy 3D chinchillas are visible at the bottom of the arena.

The earlier isometric RPG, including procedural floors and mystic skill trees, remains at `/adventure`. Its instructions are in [docs/dustbound-rpg.md](docs/dustbound-rpg.md).

## Play locally

Requires Node.js 22.13+ and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open the printed localhost URL. Choose a starting pair, then select **Into the burrow**. Auto-fire starts enabled.

- Classic pair: Seedshot + Riverstone.
- Burrow breakers: Burrow Drill + Split Acorn.
- Moon gardeners: Vampire Spore + Gustball.

| Action | Control |
| --- | --- |
| Aim | Mouse |
| Move the pair | WASD or arrow keys |
| Fire with auto-fire disabled | Hold left click |
| Double Trouble burst | Q or Space; costs 50 bond |
| Fusion lab | F or the on-screen button |
| Pause | Esc or P |

Both chinchillas cycle through up to four equipped ball types. Balls rebound from enemies and walls. Intercept a returning ball with either chinchilla to send it back with 8% more damage, up to three returns. Balls expire, and missed returns drop out of the pit.

Defeats award XP and bond. Leveling pauses the action for a choice of three upgrades. Each ball can reach level 5. Enemies that breach the red line cost 12 courage; a boss breach ends the run. Survive 12 waves and defeat the Dustbreaker, then descend with the same build into a harder pit. Losing or starting a fresh run resets the build; progress is not saved across reloads.

## Ball fusion

Both ingredients must be at least level 2. Fusion consumes the two ingredients, creates a level 1 evolved ball, and frees one collection slot.

| Ingredients | Result | Effect |
| --- | --- | --- |
| Seedshot + Riverstone | Acorn Meteor | Heavy hits and area explosions |
| Snowpea + Embernut | Steam Bloom | Slows and burns groups |
| Static Puff + Sporeball | Spore Tempest | Poisoned lightning jumps through three nearby enemies |
| Burrow Drill + Split Acorn | Quillstorm | Four penetrations and four drilling fragments |
| Vampire Spore + Gustball | Moonwhirl | Life-steal and area knockback |

The fusion lab pauses combat. Ten base weapon types, five evolved types, damage/fire-rate/multiball upgrades, and courage upgrades offer different builds.

## Expanded arsenal

Use **Browse all 15 weapons** to inspect base weapons, evolved forms, equipped ranks, and fusion recipes.

- Burrow Drill passes through two enemies before bouncing. Each enemy can be hit once per drill projectile.
- Split Acorn splits into two half-damage fragments on its first hit. Fragments never split recursively.
- Vampire Spore restores 12% of actual direct damage as courage, capped at maximum courage.
- Gustball pushes enemies back; guardians resist most knockback.
- Quillstorm combines piercing with four smaller drilling fragments.
- Moonwhirl restores 18% of direct damage and knocks back/damages nearby enemies.

Projectiles and fragments share a 180-ball cap. Base weapons appear as level-up rewards; fused forms require their recipe. Starting pairs provide immediate access to the new mechanics.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Tests exercise wall and enemy collisions, paw rebounds, elemental effects, fusion requirements, upgrade gating, pause, breach loss, boss victory, and a complete pit run using normal firing and upgrade commands. The retained RPG also has its original tests. Tests do not inspect browser rendering.

## Source

- `app/page.tsx`: ball-mode interface, menus, controls, and sound.
- `lib/pit-game.ts`: deterministic simulation, projectiles, waves, upgrades, and fusion.
- `lib/pit-scene.ts`: Three.js pit, chinchillas, enemies, and effects.
- `lib/chinchilla.ts`: chinchilla meshes and geometric fur.
- `app/adventure/page.tsx`: retained Dustbound RPG.
- `app/globals.css`: shared and mode-specific styles.

The artwork includes the supplied photo of the original chinchillas. The game uses original chinchilla names and mechanics inspired by the bouncing-ball roguelite format. The current Sites deployment uses Vinext and a generated Cloudflare Worker; `npm run build` creates `dist/`.
