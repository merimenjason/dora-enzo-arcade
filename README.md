# Chin x Pit — Night Survivors

A 3D survival roguelite starring Dora (white) and Enzo (grey), two fluffy chinchillas who move together. Foxes, owls and snakes pursue them from every direction. Survive three minutes, then defeat the Mountain Cougar to reach dawn. Continue into harder nights with the same build.

## Run

Requires Node.js 22.13+ and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

## Controls and progression

- WASD / arrow keys: move both chinchillas. The camera follows them.
- All equipped weapons automatically target nearby predators.
- Q / Space: protective dust blast, costing 50 bond earned from defeats.
- F: pause and open the fusion lab.
- P / Esc: pause or resume.
- Move near green XP gems to attract and collect them. Level-ups pause combat for three choices.

Contact with predators damages shared courage, with a short grace period between hits. Enemy health is hidden. There are no breach lines or ricochet requirements. Weapons include Hayseed Volley, Pumice Pebble, Burrow Claw, Acorn Scatter, Willow Chew and Rosehip Thorn. Dust Bath is an area aura; Moon Dust evolves it into an aura with healing. Other effects include burn, poison, bleeding, slow, chain damage and splitting shots.

Equip up to four weapons, each upgradeable to rank 5. There are twelve base weapons and eight evolved forms. Compatible ingredients at rank 2 can be fused; fusion consumes them and frees one slot. The level-up screen suggests ingredients and lets you perform ready fusions without using your reward choice.

Six passive items stack to rank 3 without using weapon slots: Pebble Locket reduces contact damage; Pocket Sundial extends projectile lifetime; Silk Slippers improve speed; Friendship Ribbon increases bond; Lucky Clover improves XP drops; Healing Hay regenerates courage. Builds carry into harder nights but reset on a new run or reload.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Tests cover predator pursuit, automatic attacks, XP collection, contact grace periods and armor, aura range, all eight evolutions, level-up pause, boss victory, next-night progression and a complete bounded survival simulation. The original RPG at `/adventure` retains its separate procedural-floor and combat tests. `tests/pit.mjs` documents the previous ball-mode rules and is not part of the current suite.

## Source

- `app/page.tsx`: survival interface and controls.
- `lib/pit-game.ts`: survival simulation, weapons, XP, evolution and spawning.
- `lib/pit-scene.ts`: arena, following camera and 3D rendering.
- `lib/pit-predators.ts`: animal miniatures.
- `lib/pit-weapons.ts`: distinct weapon miniatures.
- `lib/pit-passives.ts`: passive item definitions.
- `lib/chinchilla.ts`: fluffy chinchilla meshes.
- `tests/survival.mjs`: simulation checks.

Includes the supplied photograph of Dora and Enzo. This uses Vinext and a Cloudflare Worker; `npm run build` creates `dist/`. GitHub source upload alone does not deploy the game to GitHub Pages.
