// Chinchilla Trek: the rules of a thirty-day trek. Deterministic and DOM-free: a trek is a seed plus the choices
// made, every random draw comes from a seeded generator, and a fight is worked out in one go into a list of events
// the page replays.
import { CHAPTER_SCALE, DAY_SCALE, EVOS, FOES, SKILLS, ZAP_CHANCE, type ChapterNo, type EvoId, type FoeId, type Hero, type Level, type SkillId } from './chinchilla-trek-data.js';

export * from './chinchilla-trek-data.js';

/** A generator whose whole state is one number, so it saves and replays exactly. */
export class Rand {
  constructor(public s: number) { this.s = s >>> 0; }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number) { return Math.floor(this.next() * n); }
  pick<T>(a: readonly T[]) { return a[this.int(a.length)]; }
  shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}

/** A 32-bit hash of two numbers, for every seed derived from another. */
export function mix(a: number, b: number) {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Stats ──────────────────────────────────────────────────────────────────

/** `hp` is max HP; crit and dodge are chances. */
export type Stats = { hp: number; atk: number; crit: number; dodge: number };
/** The trek's skills and buffs. `bonus.atk` and `bonus.hp` are fractions; `bonus.crit` and `bonus.dodge` are amounts. */
export type Kit = { skills: Partial<Record<SkillId, Level>>; evos: EvoId[]; bonus: Stats };
export const BASE: Stats = { hp: 100, atk: 10, crit: 0.05, dodge: 0 };
export const freshKit = (): Kit => ({ skills: {}, evos: [], bonus: { hp: 0, atk: 0, crit: 0, dodge: 0 } });

/** A skill's level, 0 to 3; an evolution keeps both its halves at level 3. */
export function skillLevel(kit: Kit, id: SkillId): number {
  if (kit.evos.some((e) => EVOS[e].from.includes(id))) return 3;
  return kit.skills[id] ?? 0;
}
/** A skill's number at its level, or 0 without it. */
export const skillValue = (kit: Kit, id: SkillId) => { const n = skillLevel(kit, id); return n ? SKILLS[id].v[n - 1] : 0; };

export function heroStats(base: Stats, hero: Hero, kit: Kit): Stats {
  const hp = base.hp * (hero === 'dora' ? 1.1 : 1) * (1 + skillValue(kit, 'fluff')) * (1 + kit.bonus.hp);
  const atk = base.atk * (hero === 'enzo' ? 1.1 : 1) * (1 + skillValue(kit, 'sharp')) * (1 + kit.bonus.atk);
  return {
    hp: Math.max(1, Math.round(hp)), atk: Math.max(1, Math.round(atk)),
    crit: Math.min(0.9, base.crit + skillValue(kit, 'keen') + kit.bonus.crit), dodge: Math.min(0.6, base.dodge + skillValue(kit, 'dust') + kit.bonus.dodge),
  };
}

export function foeStats(id: FoeId, chapter: ChapterNo, day: number) {
  const f = FOES[id], k = CHAPTER_SCALE[chapter - 1] * (1 + DAY_SCALE * day);
  return { hp: Math.round(f.hp * k), atk: Math.round(f.atk * k) };
}

// ── The fight ──────────────────────────────────────────────────────────────

/** Side 0 is the hero, side 1 the foe. */
export type Side = 0 | 1;
/** What the page replays. `hit` and `heal` carry the side's new HP; `shield` the hero's shield; `round` starts a round. */
export type FightEvent =
  | { k: 'round'; n: number } | { k: 'attack'; side: Side }
  | { k: 'hit'; side: Side; dmg: number; hp: number; crit: boolean; src: 'attack' | 'combo' | 'counter' | 'zap' | 'burn' | 'reflect' | 'roll' }
  | { k: 'dodge'; side: Side } | { k: 'shield'; n: number } | { k: 'freeze'; side: Side }
  | { k: 'heal'; side: Side; n: number; hp: number } | { k: 'skill'; id: SkillId | EvoId } | { k: 'wind'; hp: number }
  | { k: 'end'; result: 'win' | 'loss' | 'stall' };
export type FightIn = { stats: Stats; hp: number; kit: Kit; foe: FoeId; chapter: ChapterNo; day: number; seed: number; wind: boolean };
export type FightOut = { result: 'win' | 'loss' | 'stall'; events: FightEvent[]; rounds: number; hp: number; windUsed: boolean; foeHp: number; foeAtk: number };
export const MAX_ROUNDS = 40;
const STING = 0.1, SHELL_TRAIT = 0.5, SWIFT = 0.15, RAGE = 0.5, REGEN = 0.05, BRAMBLE_REFILL = 0.1, BRAMBLE_REFLECT = 0.6, FEAST_STEAL = 0.25, FEAST_HEAL = 0.06, FURY_CRIT = 0.3;

class Done { constructor(public result: 'win' | 'loss') {} }

/**
 * One fight, worked out at once. The hero acts first each round; a knock-out is checked after every hit, so whoever
 * drops first loses, whatever else would have happened later that turn. Pure: the input is never changed.
 */
export function fight(input: FightIn): FightOut {
  const { stats, kit } = input, trait = FOES[input.foe].trait, rand = new Rand(mix(input.seed, 7));
  const fs = foeStats(input.foe, input.chapter, input.day), events: FightEvent[] = [];
  const has = (e: EvoId) => kit.evos.includes(e), v = (id: SkillId) => skillValue(kit, id);
  const max = stats.hp;
  let hp = clamp(input.hp, 1, max), shield = 0, wind = input.wind && v('wind') > 0, windUsed = false, heroFrozen = false, heroBurn = 0;
  let foeHp = fs.hp, foeFrozen = false, foeTurns = 0, foeShell = trait === 'shell', stung = false, stacks = 0, firstAttack = true;
  const shieldCap = Math.round(max * v('shell'));
  const emit = (e: FightEvent) => events.push(e);
  const healHero = (n: number) => { n = Math.min(Math.round(n), max - hp); if (n > 0) { hp += n; emit({ k: 'heal', side: 0, n, hp }); } };

  /** Damage to the foe, then a knock-out check. */
  const hurtFoe = (dmg: number, src: Extract<FightEvent, { k: 'hit' }>['src'], crit = false) => {
    if (foeShell) { dmg *= SHELL_TRAIT; foeShell = false; }
    dmg = Math.max(1, Math.round(dmg));
    foeHp = Math.max(0, foeHp - dmg);
    emit({ k: 'hit', side: 1, dmg, hp: foeHp, crit, src });
    if (foeHp <= 0) throw new Done('win');
    const steal = has('feast') ? FEAST_STEAL : v('snack');
    if (steal && src !== 'burn' && src !== 'reflect') healHero(dmg * steal);
  };
  /** Damage to the hero, through the shield, then a knock-out check (and Second Wind). */
  const hurtHero = (dmg: number, src: Extract<FightEvent, { k: 'hit' }>['src']) => {
    dmg = Math.max(1, Math.round(dmg));
    if (shield > 0 && src !== 'burn') { const soak = Math.min(shield, dmg); shield -= soak; dmg -= soak; emit({ k: 'shield', n: shield }); }
    if (dmg <= 0) return false;
    hp = Math.max(0, hp - dmg);
    emit({ k: 'hit', side: 0, dmg, hp, crit: false, src });
    if (hp <= 0) {
      if (!wind) throw new Done('loss');
      wind = false; windUsed = true; hp = Math.round(max * v('wind'));
      emit({ k: 'skill', id: 'wind' }); emit({ k: 'wind', hp });
    }
    return true;
  };
  /** One hero attack: dodge, damage (pounce, grit, crit), then zap, freeze and pepper. */
  const strike = (src: 'attack' | 'combo' | 'counter') => {
    if (src !== 'counter') emit({ k: 'attack', side: 0 });
    if (trait === 'swift' && rand.next() < SWIFT) { emit({ k: 'dodge', side: 1 }); return; }
    const low = hp < max / 2;
    let dmg = stats.atk * (low ? 1 + v('grit') : 1);
    if (src === 'attack' && firstAttack && v('pounce')) { dmg *= v('pounce'); emit({ k: 'skill', id: 'pounce' }); }
    if (src === 'attack') firstAttack = false;
    const crit = rand.next() < stats.crit + (has('fury') && low ? FURY_CRIT : 0);
    if (crit) dmg *= has('fury') ? 3 : 2;
    hurtFoe(dmg, src, crit);
    if (v('pepper')) stacks = Math.min(5, stacks + 1);
    const storm = has('storm') && src === 'combo';
    if (storm || (v('static') && rand.next() < ZAP_CHANCE)) { emit({ k: 'skill', id: storm ? 'storm' : 'static' }); hurtFoe(stats.atk * (storm ? 1.2 : v('static')), 'zap'); }
    if (v('frost') && !foeFrozen && rand.next() < v('frost')) { foeFrozen = true; emit({ k: 'skill', id: 'frost' }); emit({ k: 'freeze', side: 1 }); }
  };

  let rounds = 0, result: FightOut['result'] = 'stall';
  try {
    // start of the fight: the shield, then a Dust Roll
    if (shieldCap > 0) { shield = shieldCap; emit({ k: 'skill', id: has('bramble') ? 'bramble' : 'shell' }); emit({ k: 'shield', n: shield }); }
    if (v('roll')) { emit({ k: 'skill', id: 'roll' }); hurtFoe(stats.atk * v('roll'), 'roll'); }
    while (rounds < MAX_ROUNDS) {
      rounds++;
      emit({ k: 'round', n: rounds });
      // the hero's turn
      if (heroFrozen) heroFrozen = false;
      else {
        strike('attack');
        for (let extra = 0; extra < (has('storm') ? 2 : 1) && v('combo') && rand.next() < v('combo'); extra++) { emit({ k: 'skill', id: has('storm') ? 'storm' : 'combo' }); strike('combo'); }
      }
      // the foe's turn
      if (foeFrozen) foeFrozen = false;
      else {
        foeTurns++;
        const swings = trait === 'double' && foeTurns % 3 === 0 ? 2 : 1;
        for (let k = 0; k < swings; k++) {
          emit({ k: 'attack', side: 1 });
          if (rand.next() < stats.dodge) { emit({ k: 'dodge', side: 0 }); continue; }
          const dmg = Math.max(1, Math.round(fs.atk * (trait === 'rage' && foeHp < fs.hp / 2 ? 1 + RAGE : 1)));
          const reflect = has('bramble') ? BRAMBLE_REFLECT : v('prickle');
          hurtHero(dmg, 'attack');
          if (trait === 'sting' && !stung) { stung = true; heroBurn = Math.max(1, Math.round(fs.atk * STING)); }
          if (trait === 'chill' && foeTurns % 4 === 0 && k === 0) { heroFrozen = true; emit({ k: 'freeze', side: 0 }); }
          if (reflect) { emit({ k: 'skill', id: has('bramble') ? 'bramble' : 'prickle' }); hurtFoe(Math.max(1, dmg * reflect), 'reflect'); }
          if (v('counter') && rand.next() < v('counter')) { emit({ k: 'skill', id: 'counter' }); strike('counter'); }
        }
      }
      // the end of the round: burns, then healing
      if (stacks) hurtFoe(Math.max(1, stacks * v('pepper') * stats.atk), 'burn');
      if (heroBurn) hurtHero(heroBurn, 'burn');
      const rest = v('nap') + (has('feast') ? FEAST_HEAL : 0);
      if (rest) healHero(max * rest);
      if (has('bramble') && shield < shieldCap) { shield = Math.min(shieldCap, shield + Math.round(max * BRAMBLE_REFILL)); emit({ k: 'shield', n: shield }); }
      if (trait === 'regen') { const n = Math.min(Math.round(fs.hp * REGEN), fs.hp - foeHp); if (n > 0) { foeHp += n; emit({ k: 'heal', side: 1, n, hp: foeHp }); } }
    }
  } catch (e) {
    if (!(e instanceof Done)) throw e;
    result = e.result;
  }
  emit({ k: 'end', result });
  return { result, events, rounds, hp: result === 'loss' ? 0 : hp, windUsed, foeHp: fs.hp, foeAtk: fs.atk };
}
