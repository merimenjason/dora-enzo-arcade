// Glimmer Cave's weapons: each weapon's state, firing and shots. Deterministic and DOM-free. The dive calls
// `runWeapons` once per step for the hero and once for the buddy.

import type { OverclockId, WeaponId } from './glimmer-cave-data.js';
import type { Dive } from './glimmer-cave-game.js';

/** A held weapon. `dmg`, `rate` and `size` are summed card bonuses; `count` is the extra count; `cd` is the time to
 *  the next fire; `n` counts fires, for "every 5th volley" and "every 3rd pulse". */
export type WeaponState = { id: WeaponId; level: number; overclocks: OverclockId[]; dmg: number; rate: number; size: number; count: number; cd: number; n: number };

export function newWeapon(id: WeaponId): WeaponState {
  return { id, level: 1, overclocks: [], dmg: 0, rate: 0, size: 0, count: 0, cd: 0, n: 0 };
}

/** Fires the owner's weapons and advances their shots. Task 4 fills this in. */
export function runWeapons(d: Dive, owner: 'hero' | 'buddy'): void {
  void d; void owner;
}
