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
| Move / pursue and attack | Left click floor / enemy; hold to keep attacking whatever is under the cursor |
| Stand still and attack towards the cursor | Shift + hold left click |
| Move directly | WASD or arrow keys |
| Switch hero | Tab; 1 for White, 2 for Grey |
| Target nearest enemy | R |
| Seed volley / whirling paws | Right click or F |
| Dodge | Space |
| Shared bond burst | Q, costs 50 bond |
| Enter cleared chamber's passage | Approach arch and press E |
| Courage potion | H |
| Gear (pauses combat) | I |
| Skill trees (pauses combat) | K |
| Pause | Escape or P |

White uses ranged seeds; Grey fights in melee. Successful hits build shared bond. Green loot restores shared courage. Each cleared floor offers a boon and a full heal. Levels grant one shared skill point, +12 courage, and +7% base damage. You start with one point. Both heroes share XP, while skill points can be invested across either tree:

- White: Stillness (immobilizing seeds → damage against sealed enemies → an area seal) or Dustcraft (taunting dust decoy → longer life and more courage → explosion on expiration or destruction).
- Grey: Paw Stances (Boulder Paw → Reed Fang → Rooted Tail) or Spirit Form (Stonefur transformation → improved protection → healing when the form ends).

Equip one learned stance in the skill tree. Boulder Paw hits harder but slower; Reed Fang extends melee reach; Rooted Tail cleaves and protects the party while Grey leads. White’s learned seals and decoy trigger through the existing volley (right click / F). Grey’s learned Stonefur form triggers through whirling paws (right click / F). The decoy has a 10-second recharge; Stonefur has a 12-second recharge, separate from the basic special-ability cooldown. No extra combat keys or combo mechanics are required.

The dust decoy has its own courage, attracts visible enemies within seven steps, absorbs projectiles, and disappears when its courage or duration runs out. Guardians resist half of seal duration. Stonefur visibly enlarges Grey and empowers his melee; its damage reduction applies while Grey leads. Temporary forms and decoys reset between floors.

Skills have rank caps, parent prerequisites, and level gates. Leveling restores courage. Running out of courage resets the current floor while keeping levels and skill choices; each enemy grants XP only once per floor to prevent retry farming. A new adventure starts a fresh build and random seed.

**Reading the fight.** Every attack is drawn where it happens. Grey lunges into each blow behind a white sweeping arc; White rocks back from a flash at her muzzle, and her seeds are long bright streaks that spark where they land. The enemy being attacked stands in a pulsing red ring with its health bar outlined. Damage numbers pop in large and fade; critical hits are bigger, orange and marked with `!`. Hit machines flinch away from the blow, and heavy hits (specials, the bond burst, criticals, a falling elite, taking damage) shake the view briefly. All of this is cosmetic: damage lands at the same moment it always did.

**Hotbar.** Attack, the special, Dodge, Potion and Together! sit in one row under the view. A dark sweep drains off each slot as it recharges; the Together! slot fills as bond builds.

**Elites.** From floor 2, one machine per floor is an elite (two from floor 4, three from floor 7). Elites are tinted, larger, have 2.2 times the health, give 2.5 times the XP and carry one trait: **Swift** (moves 60% faster and attacks 30% sooner), **Armoured** (takes 40% less damage) or **Volatile** (bursts into a ring of eight sparks when it falls). An elite always drops one piece of gear and a potion. Which machines are elite, and their traits, are fixed by the seed and floor.

**Gear.** There are three slots: Seed Collar (White's seed damage), Stone Claws (Grey's paw damage) and Dust Charm (courage). Items come in three rarities: Worn (one bonus), Fine (two) and Ancient (three); the extra bonuses can be seed damage, paw damage, courage, attack speed (capped at 40%) or critical chance (capped at 50%, critical hits deal double). Ordinary machines drop gear 14% of the time, elites always, and guardians always drop Ancient gear. A find is worn at once if its slot is empty; otherwise it goes to a bag of 12, where **I** shows whether it is better or weaker than what is worn and lets you equip or salvage it for treats (2, 6 or 15 by rarity). Gear left on the floor is collected when you take the passage. The three boons after each floor are unchanged.

**Potions.** You start with 3 and can hold 5. **H** restores 40% of maximum courage, with 8 seconds between sips, and does nothing at full courage. Each new floor adds one, and each elite drops one.

**Saving.** The adventure is saved in the browser (`localStorage` key `dustbound-v1`) every few seconds: seed, floor, level, XP, skills, stance, boons, gear, bag, potions and treats as they stood at the start of the floor. **Continue** on the title screen brings the party back at the start of that floor, as running out of courage does. Machines already beaten on that floor give no XP again, and a floor gives its boon only once.

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
