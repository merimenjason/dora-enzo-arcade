import type { Battle } from './saga-game';
/** Match the engine's actual skill targets before recommending an interrupt. Reads only. */
export function readyToInterrupt(battle: Battle, slot: number): boolean {
  const winding = battle.winding;
  if (!winding || !battle.ready(slot)) return false;
  const hero = battle.heroes.find((u) => u.slot === slot);
  if (hero?.skill?.kind === 'snipe' || hero?.skill?.kind === 'freeze')
    return true;
  if (hero?.skill?.kind !== 'strike') return false;
  const nearest = battle.foes.reduce(
    (first, foe) =>
      !first || foe.d < first.d || (foe.d === first.d && foe.uid < first.uid)
        ? foe
        : first,
    null as (typeof battle.foes)[number] | null,
  );
  return nearest?.uid === winding.uid;
}
