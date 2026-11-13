// Cloudpop: tower rules. A tower's live stats are its base stats with every bought upgrade applied in order; the
// upgrade panel diffs the stats before and after an upgrade to show exactly what changes. The tower data itself
// (eleven towers, three paths of five tiers each) is in ./cloudpop-towerdata.ts.
import type { DType } from './cloudpop-puffs.js';

export type TowerId = 'pebble' | 'busker' | 'ember' | 'ice' | 'llama' | 'hay' | 'condor' | 'boat' | 'windmill' | 'lantern' | 'quinoa';
export type AtkKind = 'shot' | 'lob' | 'pulse' | 'beam' | 'strike' | 'grab';
export type Target = 'first' | 'last' | 'strong' | 'close';
export const TARGETS: Target[] = ['first', 'last', 'strong', 'close'];

export interface Atk {
  id: string;
  /** player-facing name of this attack */
  label: string;
  kind: AtkKind;
  dmg: number;
  /** puffs one attack can hit */
  pierce: number;
  /** seconds between attacks */
  rate: number;
  range: number;
  dtype: DType;
  /** projectile speed (shot, lob) */
  speed: number;
  count: number;
  /** total fan angle in radians for count > 1 (shot); 6.28 = all round */
  spread: number;
  splash: number;
  /** [speed multiplier, seconds] */
  slow: [number, number] | null;
  /** slows bosses too */
  slowBoss: boolean;
  /** freeze seconds (non-boss, non-frost) */
  freeze: number;
  /** freeze seconds applied to bosses */
  freezeBoss: number;
  stun: number;
  stunBoss: number;
  /** [damage per second, seconds] */
  burn: [number, number] | null;
  /** push back along the path, world units (non-boss) */
  knock: number;
  /** fraction of knock applied to bosses */
  knockBoss: number;
  /** extra damage multiplier against bosses */
  bossMult: number;
  homing: boolean;
  /** jumps to this many further puffs after a hit */
  bounce: number;
  /** light shards thrown out where a lob lands */
  shards: number;
  shardDmg: number;
  /** strips night from what it hits */
  stripNight: boolean;
  /** strips fog (regrowth) from what it hits */
  stripFog: boolean;
  /** extra damage on fogged puffs */
  fogMult: number;
  /** damage over time from spit, per second while slowed */
  dot: number;
  /** dot also hurts bosses */
  dotBoss: boolean;
  /** grab: highest rank it may carry (bosses need grabBoss) */
  grabRank: number;
  grabBoss: boolean;
  /** frozen or stunned puffs take this much extra from every hit */
  brittle: number;
  /** ignores line-of-sight blockers (lobs and fliers do) */
  arc: boolean;
}

export type AbilityKind = 'frenzy' | 'nova' | 'strike' | 'freeze' | 'blowback' | 'cash' | 'rally' | 'reveal' | 'rockslide' | 'flood' | 'stampede' | 'lives' | 'snatch';
export interface Ability {
  id: string;
  name: string;
  kind: AbilityKind;
  /** cooldown, seconds */
  cd: number;
  /** strength: damage, cash, lives, multiplier... */
  power: number;
  /** seconds, for timed effects */
  dur: number;
  /** radius for nova (0 = whole map) */
  radius: number;
  desc: string;
}

export interface Stats {
  atks: Atk[];
  /** sees night (hidden) puffs */
  sight: boolean;
  /** support aura radius (0 = none) */
  aura: number;
  auraSight: boolean;
  /** multiplier on attack rate of towers in the aura (0.85 = 15% faster) */
  auraRate: number;
  auraPierce: number;
  auraDmg: number;
  /** multiplier on range of towers in the aura */
  auraRangeMul: number;
  auraBoss: number;
  /** discount on towers and upgrades bought in the aura, 0..1 */
  discount: number;
  /** slowing field: [multiplier, radius]; frost puffs ignore it unless chillFrost */
  chill: [number, number] | null;
  chillBoss: number;
  chillFrost: boolean;
  /** income each round end */
  income: number;
  lives: number;
  /** fraction of cash paid as interest each round, capped */
  interest: number;
  /** flier patrol radius (condor); 0 = stands still */
  patrol: number;
  /** flier hunts along the road near the front-most puff */
  hunt: boolean;
  /** extra sale value fraction granted to ALL towers while this stands */
  sellBonus: number;
  ability: Ability | null;
  /** how many fliers (condors) */
  fliers: number;
}

export interface Upgrade {
  name: string;
  cost: number;
  /** what it does, in words; the numbers come from the stat diff */
  desc: string;
  /** what the icon shows (for the painting prompt) */
  icon: string;
  fx: (s: Stats) => void;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  /** one-line role */
  role: string;
  blurb: string;
  cost: number;
  /** footprint radius */
  r: number;
  /** where it may stand */
  place: 'land' | 'water' | 'any';
  /** player level that unlocks it */
  level: number;
  base: () => Stats;
  paths: [Upgrade[], Upgrade[], Upgrade[]];
  pathNames: [string, string, string];
  /** income or support tower: excluded in Lean Harvest */
  income?: boolean;
}

export function atk(p: Partial<Atk> & { id: string; label: string; kind: AtkKind }): Atk {
  return {
    dmg: 1, pierce: 1, rate: 1, range: 160, dtype: 'light', speed: 700, count: 1, spread: 0, splash: 0,
    slow: null, slowBoss: false, freeze: 0, freezeBoss: 0, stun: 0, stunBoss: 0, burn: null, knock: 0, knockBoss: 0,
    bossMult: 1, homing: false, bounce: 0, shards: 0, shardDmg: 1, stripNight: false, stripFog: false, fogMult: 1,
    dot: 0, dotBoss: false, grabRank: 0, grabBoss: false, brittle: 0, arc: false, ...p,
  };
}
export function stats(p: Partial<Stats>): Stats {
  return {
    atks: [], sight: false, aura: 0, auraSight: false, auraRate: 1, auraPierce: 0, auraDmg: 0, auraRangeMul: 1, auraBoss: 0,
    discount: 0, chill: null, chillBoss: 1, chillFrost: false, income: 0, lives: 0, interest: 0, patrol: 0, hunt: false,
    sellBonus: 0, ability: null, fliers: 0, ...p,
  };
}
export function ability(p: Partial<Ability> & { id: string; name: string; kind: AbilityKind; cd: number; desc: string }): Ability {
  return { power: 0, dur: 0, radius: 0, ...p };
}

/** crosspath rule: one path may go to tier 5, a second path to tier 2, the third stays at 0 */
export const MAX_TIER = 5, SECOND_MAX = 2;
export function canBuyTier(tiers: readonly number[], path: number): boolean {
  const t = tiers[path] + 1;
  if (t > MAX_TIER) return false;
  const next = tiers.map((v, i) => (i === path ? t : v));
  const used = next.filter(v => v > 0).length;
  if (used > 2) return false;
  const sorted = [...next].sort((a, b) => b - a);
  return sorted[1] <= SECOND_MAX;
}
/** why a tier can't be bought by the crosspath rule ('' if it can) */
export function crosspathReason(tiers: readonly number[], path: number): string {
  if (tiers[path] >= MAX_TIER) return 'Fully upgraded';
  if (canBuyTier(tiers, path)) return '';
  const others = tiers.filter((v, i) => i !== path && v > 0).length;
  if (tiers[path] === 0 && others >= 2) return 'Two paths already chosen';
  return 'Only one path may go past tier 2';
}
