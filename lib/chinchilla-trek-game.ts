// Chinchilla Trek: the rules of a thirty-day trek. Deterministic and DOM-free: a trek is a seed plus the choices
// made, every random draw comes from a seeded generator, and a fight is worked out in one go into a list of events
// the page replays.
import {
  CHAPTERS, CHAPTER_SCALE, DAYS, DAY_SCALE, DAY_WEIGHTS, EVOS, EVO_IDS, FIGHT_ACORNS, FIGHT_XP, FIXED_DAYS, FOES, GEAR_SLOTS, GEAR_STAT, PEDLAR_PRICE, SCENES, SKILLS, SKILL_IDS,
  TRAIN_STEP, ZAP_CHANCE, trainCost, xpNeed, type GearSlot, type Rarity,
  type ChapterNo, type Effect, type EvoId, type FoeId, type Hero, type Level, type Rank, type SkillId,
} from './chinchilla-trek-data.js';

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

// ── The trek ───────────────────────────────────────────────────────────────

export type Ware = { k: 'snack' } | { k: 'card' } | { k: 'charm'; stat: 'atk' | 'hp' | 'crit' };
export const price = (w: Ware, chapter: ChapterNo) => PEDLAR_PRICE[w.k] * chapter;
const CHARM: Record<'atk' | 'hp' | 'crit', number> = { atk: 0.08, hp: 0.1, crit: 0.05 };
export type DayEvent =
  | { k: 'fight'; foe: FoeId; rank: Rank } | { k: 'story'; scene: string } | { k: 'cache' }
  | { k: 'find'; what: 'acorns' | 'snack' | 'chest'; n: number } | { k: 'rest' } | { k: 'wheel'; prize?: number }
  | { k: 'pedlar'; stock: Ware[]; sold: boolean[] } | { k: 'crossroads' } | { k: 'visit'; who: 'owl' | 'fox' };
export type Card = { k: 'skill'; id: SkillId; level: Level } | { k: 'evo'; id: EvoId } | { k: 'rest' };
export type Phase = 'walk' | 'event' | 'pick' | 'over' | 'cleared';
/** The wheel's eight equal slices, in order. */
export const WHEEL = ['small acorns', 'small acorns', 'small acorns', 'big acorns', 'a snack', 'a skill', 'sharper teeth', 'a bump'] as const;
const CHOOSY = new Set<DayEvent['k']>(['story', 'wheel', 'pedlar', 'crossroads', 'visit']);
const isFixed = (day: number) => day in FIXED_DAYS;
const sceneOf = (id: string) => SCENES.find((s) => s.id === id);
const HEROES: Hero[] = ['dora', 'enzo'];
const OTHER: Record<Hero, string> = { dora: 'Enzo', enzo: 'Dora' };

/** What a day brings: a due follow-up, the fixed day, or a draw from the weights (never the same kind twice running). */
export function rollDay(t: Trek): DayEvent {
  const ch = CHAPTERS[t.chapter - 1], r = t.rand;
  const due = t.later.findIndex((l) => l.day === t.day);
  if (due >= 0) { const [l] = t.later.splice(due, 1); return { k: 'story', scene: l.scene }; }
  const fixed = FIXED_DAYS[t.day as keyof typeof FIXED_DAYS];
  if (fixed === 'elite') return { k: 'fight', foe: ch.elite, rank: 'elite' };
  if (fixed === 'boss') return { k: 'fight', foe: ch.boss, rank: 'boss' };
  if (fixed === 'crossroads') return { k: 'crossroads' };
  if (fixed === 'pedlar') return pedlar(r);
  if (t.day === 1) return { k: 'fight', foe: r.pick(ch.foes), rank: 'foe' };
  const total = Object.values(DAY_WEIGHTS).reduce((a, b) => a + b, 0);
  let kind: keyof typeof DAY_WEIGHTS = 'fight';
  for (let tries = 0; tries < 20; tries++) {
    let x = r.next() * total;
    for (const [k, w] of Object.entries(DAY_WEIGHTS) as [keyof typeof DAY_WEIGHTS, number][]) { if (x < w) { kind = k; break; } x -= w; }
    if (kind !== t.prev) break;
  }
  if (kind === 'fight') return { k: 'fight', foe: r.pick(ch.foes), rank: 'foe' };
  if (kind === 'story') {
    const all = SCENES.filter((s) => !s.followUp && (s.chapter === 0 || s.chapter === t.chapter)), fresh = all.filter((s) => !t.told.includes(s.id));
    return { k: 'story', scene: r.pick(fresh.length ? fresh : all).id };
  }
  if (kind === 'find') { const x = r.next(); return x < 0.6 ? { k: 'find', what: 'acorns', n: 5 * t.chapter } : x < 0.85 ? { k: 'find', what: 'snack', n: 0 } : { k: 'find', what: 'chest', n: 15 * t.chapter }; }
  if (kind === 'pedlar') return pedlar(r);
  if (kind === 'wheel') return { k: 'wheel' };
  return { k: kind };
}
const pedlar = (r: Rand): DayEvent => ({ k: 'pedlar', stock: [{ k: 'snack' }, { k: 'card' }, { k: 'charm', stat: r.pick(['atk', 'hp', 'crit'] as const) }], sold: [false, false, false] });

/**
 * A trek: thirty days, one event a day. `next()` walks to the next day and resolves what it can at once (fights,
 * finds, rests); the rest wait in `event` for `choose`/`buy`, and level-ups wait in `pick` for `pickSkill`.
 * Every method returns false (or null) and changes nothing when it isn't allowed.
 */
export class Trek {
  day = 0; hp: number; level = 1; xp = 0; kit: Kit = freshKit(); acorns = 0; windUsed = false; rerolled = false;
  phase: Phase = 'walk'; today: DayEvent | null = null; offer: Card[] | null = null; picks = 0; after: DayEvent | null = null;
  last: { foe: FoeId; day: number; out: FightOut } | null = null; note = '';
  later: { day: number; scene: string }[] = []; seen: { skills: string[]; foes: FoeId[] } = { skills: [], foes: [] };
  told: string[] = []; prev: DayEvent['k'] | null = null; rand: Rand;

  constructor(public seed: number, public hero: Hero, public chapter: ChapterNo, public base: Stats) {
    this.rand = new Rand(mix(seed, 1));
    const start: SkillId = hero === 'dora' ? 'shell' : 'combo';
    this.kit.skills[start] = 1; this.seen.skills.push(start);
    this.hp = this.stats().hp;
  }

  stats() { return heroStats(this.base, this.hero, this.kit); }
  private get done() { return this.phase === 'over' || this.phase === 'cleared'; }
  private heal(pct: number) { const max = this.stats().hp; this.hp = Math.min(max, this.hp + Math.round(max * pct)); }
  private hurt(pct: number) { this.hp = Math.max(1, this.hp - Math.round(this.stats().hp * pct)); }
  private gain(n: number) { const got = Math.round(n * (1 + skillValue(this.kit, 'lucky'))); this.acorns += got; return got; }
  /** Changes something that may move max HP: a raise lifts current HP with it, a drop clamps it (never below 1). */
  private reshape(fn: () => void) {
    const before = this.stats().hp; fn(); const after = this.stats().hp;
    if (after > before) this.hp += after - before;
    this.hp = clamp(this.hp, 1, after);
  }
  private learn(id: SkillId, level: Level) {
    this.reshape(() => { this.kit.skills[id] = level; });
    if (!this.seen.skills.includes(id)) this.seen.skills.push(id);
  }
  private openPick(n: number, back: DayEvent | null) { this.picks += n; if (back) this.after = back; this.offer = this.deal(); this.phase = 'pick'; }
  /** After an event or a pick: the next pick, a waiting visit, or the path. */
  private settle() {
    if (this.picks > 0) { this.offer = this.deal(); this.phase = 'pick'; return; }
    this.offer = null;
    if (this.after) { this.today = this.after; this.after = null; this.phase = 'event'; return; }
    this.phase = 'walk';
  }

  /** Up to three distinct cards: skills below level 3 and ready evolutions, or a single Rest when there are none. */
  deal(): Card[] {
    const pool: Card[] = [];
    for (const id of SKILL_IDS) { const n = skillLevel(this.kit, id); if (n < 3) pool.push({ k: 'skill', id, level: (n + 1) as Level }); }
    for (const id of EVO_IDS) if (!this.kit.evos.includes(id) && EVOS[id].from.every((s) => this.kit.skills[s] === 3)) pool.push({ k: 'evo', id });
    return pool.length ? this.rand.shuffle(pool).slice(0, 3) : [{ k: 'rest' }];
  }

  next(): DayEvent | null {
    if (this.phase !== 'walk' || this.day >= DAYS) return null;
    this.day++; this.note = '';
    const e = rollDay(this);
    this.today = e; this.prev = e.k;
    if (e.k === 'story' && !this.told.includes(e.scene)) this.told.push(e.scene);
    if (e.k === 'fight') this.battle(e);
    else if (e.k === 'find') {
      if (e.what === 'snack') { const was = this.hp; this.heal(0.2); e.n = this.hp - was; this.note = 'A tasty snack by the path.'; }
      else this.note = `You find ${this.gain(e.n)} acorns${e.what === 'chest' ? ' in a little chest' : ''}.`;
    } else if (e.k === 'rest') { this.heal(0.3); this.note = 'A cosy rest. You heal 30%.'; }
    else if (e.k === 'cache') this.openPick(1, null);
    else this.phase = 'event';
    return e;
  }

  private battle(e: Extract<DayEvent, { k: 'fight' }>) {
    const out = fight({ stats: this.stats(), hp: this.hp, kit: this.kit, foe: e.foe, chapter: this.chapter, day: this.day, seed: mix(this.seed, this.day), wind: !this.windUsed });
    this.hp = out.hp; this.windUsed ||= out.windUsed; this.last = { foe: e.foe, day: this.day, out };
    if (!this.seen.foes.includes(e.foe)) this.seen.foes.push(e.foe);
    // a boss that won't go down ends the trek, since there is no day after it
    if (out.result === 'loss' || (out.result === 'stall' && e.rank === 'boss')) { this.phase = 'over'; return; }
    if (out.result === 'stall') { this.note = `The ${FOES[e.foe].name} gives up and wanders off.`; this.phase = 'walk'; return; }
    this.gain(FIGHT_ACORNS[e.rank] * this.chapter);
    if (e.rank === 'boss') { this.phase = 'cleared'; return; }
    this.xp += FIGHT_XP[e.rank];
    while (this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.level++; this.picks++; this.heal(0.2); }
    if (e.rank === 'elite') {
      this.note = `The ${FOES[e.foe].name} leaves a sure chest behind: ${this.gain(15 * this.chapter)} acorns.`;
      this.after = { k: 'visit', who: this.rand.next() < 0.5 ? 'owl' : 'fox' };
    }
    this.settle();
  }

  pickSkill(i: number): boolean {
    const c = this.phase === 'pick' ? this.offer?.[i] : undefined;
    if (!c) return false;
    if (c.k === 'skill') this.learn(c.id, c.level);
    else if (c.k === 'evo') {
      this.reshape(() => { for (const s of EVOS[c.id].from) delete this.kit.skills[s]; this.kit.evos.push(c.id); });
      this.seen.skills.push(c.id);
    } else this.heal(0.3);
    this.picks--;
    this.settle();
    return true;
  }

  reroll(): boolean {
    if (this.phase !== 'pick' || this.rerolled) return false;
    this.rerolled = true; this.offer = this.deal();
    return true;
  }

  choose(i: number): boolean {
    const e = this.today;
    if (this.phase !== 'event' || !e) return false;
    if (i === -1) { if (e.k === 'story') return false; this.note = ''; this.settle(); return true; }
    if (e.k === 'story') {
      const c = sceneOf(e.scene)?.choices[i];
      if (!c) return false;
      const won = c.odds === undefined || this.rand.next() < c.odds;
      this.note = (won ? c.winText : c.loseText ?? '').replaceAll('{other}', OTHER[this.hero]);
      this.phase = 'walk';
      for (const fx of won ? c.win : c.lose ?? []) this.apply(fx);
      if (this.phase === 'walk') this.settle();
      return true;
    }
    if (e.k === 'wheel') {
      if (i !== 0 || e.prize !== undefined) return false;
      const prize = this.rand.int(8), lucky = skillValue(this.kit, 'lucky') > 0;
      e.prize = prize; this.phase = 'walk';
      if (prize <= 2) this.note = `${this.gain(3 * this.chapter)} acorns!`;
      else if (prize === 3 || (prize === 7 && lucky)) this.note = `${this.gain(12 * this.chapter)} acorns!`;
      else if (prize === 4) { this.heal(0.25); this.note = 'A snack! You heal 25%.'; }
      else if (prize === 5) { this.note = 'A new trick!'; this.openPick(1, null); return true; }
      else if (prize === 6) { this.reshape(() => { this.kit.bonus.atk += 0.05; }); this.note = '+5% attack.'; }
      else { this.hurt(0.1); this.note = 'Bump! You lose 10% HP.'; }
      this.settle();
      return true;
    }
    if (e.k === 'crossroads') {
      if (i === 0) this.hp = this.stats().hp;
      else if (i === 1) {
        const held = (Object.keys(this.kit.skills) as SkillId[]).filter((s) => (this.kit.skills[s] ?? 3) < 3);
        if (!held.length) return false;
        const s = this.rand.pick(held); this.learn(s, (this.kit.skills[s]! + 1) as Level);
      } else if (i === 2) { if (!this.bargain(2, 0.2)) return false; }
      else return false;
      this.settle();
      return true;
    }
    if (e.k === 'visit') {
      if (i !== 0) return false;
      if (e.who === 'owl') this.heal(0.5);
      else if (!this.bargain(1, 0.1)) return false;
      this.settle();
      return true;
    }
    return false;
  }

  /** The Fox's deal: `n` skills you don't have, at level 2, for `cost` of max HP. */
  private bargain(n: number, cost: number) {
    const fresh = SKILL_IDS.filter((s) => skillLevel(this.kit, s) === 0);
    if (!fresh.length) return false;
    for (const s of this.rand.shuffle(fresh).slice(0, n)) this.learn(s, 2);
    this.reshape(() => { this.kit.bonus.hp -= cost; });
    return true;
  }

  private apply(fx: Effect) {
    if (fx.k === 'heal') this.heal(fx.pct);
    else if (fx.k === 'hurt') this.hurt(fx.pct);
    else if (fx.k === 'acorns') this.gain(fx.n * this.chapter);
    else if (fx.k === 'stat') this.reshape(() => { this.kit.bonus[fx.stat] += fx.v; });
    else if (fx.k === 'cache') this.openPick(1, null);
    else if (fx.k === 'later') { let d = this.day + fx.days; while (isFixed(d) || this.later.some((l) => l.day === d)) d++; if (d <= DAYS) this.later.push({ day: d, scene: fx.scene }); }
  }

  buy(i: number): boolean {
    const e = this.today;
    if (this.phase !== 'event' || e?.k !== 'pedlar') return false;
    const w = e.stock[i];
    if (!w || e.sold[i] || this.acorns < price(w, this.chapter)) return false;
    this.acorns -= price(w, this.chapter); e.sold[i] = true;
    if (w.k === 'snack') this.heal(0.4);
    else if (w.k === 'charm') this.reshape(() => { this.kit.bonus[w.stat] += CHARM[w.stat]; });
    else this.openPick(1, e);
    return true;
  }

  toJSON() {
    const { rand, last, ...rest } = this;
    return { v: 1, ...rest, rand: rand.s, last: last && { ...last, out: { ...last.out, events: [] } } };
  }

  static load(raw: string | null): Trek | null {
    try {
      const d = raw ? JSON.parse(raw) : null;
      if (!d || d.v !== 1 || !HEROES.includes(d.hero) || ![1, 2, 3, 4, 5].includes(d.chapter)) return null;
      const t = new Trek(d.seed >>> 0, d.hero, d.chapter, d.base);
      const nums = (o: unknown, keys: string[]) => !!o && keys.every((k) => Number.isFinite((o as Record<string, number>)[k]));
      if (!nums(d.base, ['hp', 'atk', 'crit', 'dodge']) || !nums(d.kit?.bonus, ['hp', 'atk', 'crit', 'dodge'])) return null;
      const skills = d.kit.skills ?? {};
      if (typeof skills !== 'object' || !Object.entries(skills).every(([k, n]) => k in SKILLS && [1, 2, 3].includes(n as number))) return null;
      if (!Array.isArray(d.kit.evos) || !d.kit.evos.every((e: string) => e in EVOS)) return null;
      const int = (n: unknown, lo: number, hi = Infinity) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
      if (!int(d.day, 0, DAYS) || !int(d.level, 1) || !int(d.xp, 0) || !int(d.acorns, 0) || !int(d.picks, 0) || !int(d.hp, 0) || !Number.isFinite(d.rand)) return null;
      Object.assign(t, {
        day: d.day, level: d.level, xp: d.xp, acorns: d.acorns, picks: d.picks, windUsed: !!d.windUsed, rerolled: !!d.rerolled, note: String(d.note ?? ''),
        kit: { skills: { ...skills }, evos: [...d.kit.evos], bonus: { ...d.kit.bonus } }, base: { ...d.base },
        phase: d.phase, today: d.today ?? null, offer: d.offer ?? null, after: d.after ?? null, last: d.last ?? null, prev: d.prev ?? null,
        later: d.later ?? [], seen: { skills: [...(d.seen?.skills ?? [])], foes: [...(d.seen?.foes ?? [])] }, told: [...(d.told ?? [])], rand: new Rand(d.rand),
      });
      t.hp = d.hp;
      const ok = (e: DayEvent | null) => !e || (e.k === 'fight' ? e.foe in FOES : e.k === 'story' ? !!sceneOf(e.scene) : ['cache', 'find', 'rest', 'wheel', 'pedlar', 'crossroads', 'visit'].includes(e.k));
      const card = (c: Card) => c?.k === 'rest' || (c?.k === 'skill' && c.id in SKILLS && [1, 2, 3].includes(c.level)) || (c?.k === 'evo' && c.id in EVOS);
      if (!['walk', 'event', 'pick', 'over', 'cleared'].includes(t.phase) || t.hp > t.stats().hp || (t.hp === 0 && t.phase !== 'over')) return null;
      if (!ok(t.today) || !ok(t.after) || !Array.isArray(t.later) || !t.later.every((l) => int(l.day, 1, DAYS) && !!sceneOf(l.scene))) return null;
      if (t.phase === 'pick' && !(Array.isArray(t.offer) && t.offer.length && t.offer.every(card) && t.picks > 0)) return null;
      if (t.phase !== 'pick' && t.offer !== null) return null;
      if (t.phase === 'event' && !(t.today && CHOOSY.has(t.today.k))) return null;
      if (t.last && !(t.last.foe in FOES)) return null;
      return t;
    } catch { return null; }
  }
}

// ── Camp and the profile ───────────────────────────────────────────────────

export type Piece = { uid: number; slot: GearSlot; r: Rarity };
/** `best` is the best day reached per chapter, 31 for a clear; `next` the next gear uid; `last` the last trek's seed. */
export type Profile = {
  v: 1; acorns: number; training: { atk: number; hp: number }; gear: Piece[]; worn: Partial<Record<GearSlot, number>>;
  unlocked: ChapterNo; best: [number, number, number, number, number]; seen: { skills: string[]; foes: FoeId[] }; next: number; last: number;
  /** The page's settings: fights at ×2, and days that walk on by themselves. */
  ui: { fast: boolean; auto: boolean };
};
export type Chest = { acorns: number; pieces: Piece[] };

export const freshProfile = (): Profile => ({ v: 1, acorns: 0, training: { atk: 0, hp: 0 }, gear: [], worn: {}, unlocked: 1, best: [0, 0, 0, 0, 0], seen: { skills: [], foes: [] }, next: 1, last: 0, ui: { fast: false, auto: true } });
const copy = (p: Profile): Profile => ({ ...p, training: { ...p.training }, gear: p.gear.map((x) => ({ ...x })), worn: { ...p.worn }, best: [...p.best], seen: { skills: [...p.seen.skills], foes: [...p.seen.foes] }, ui: { ...p.ui } });

/** A saved profile, or a fresh one when it can't be trusted; unknown pieces, worn uids and ids are dropped. */
export function loadProfile(raw: string | null): Profile {
  try {
    const d = raw ? JSON.parse(raw) : null;
    const int = (n: unknown, lo = 0) => Number.isInteger(n) && (n as number) >= lo;
    if (!d || d.v !== 1 || !int(d.acorns) || !int(d.training?.atk) || !int(d.training?.hp) || ![1, 2, 3, 4, 5].includes(d.unlocked) || !int(d.next, 1)) return freshProfile();
    if (!Array.isArray(d.best) || d.best.length !== 5 || !d.best.every((n: unknown) => int(n) && (n as number) <= DAYS + 1) || !Array.isArray(d.gear)) return freshProfile();
    const gear: Piece[] = d.gear.filter((x: Piece) => int(x?.uid, 1) && x.uid < d.next && GEAR_SLOTS.includes(x.slot) && [0, 1, 2, 3, 4].includes(x.r)).map((x: Piece) => ({ uid: x.uid, slot: x.slot, r: x.r }));
    const worn: Profile['worn'] = {};
    for (const s of GEAR_SLOTS) { const uid = d.worn?.[s]; if (gear.some((x) => x.uid === uid && x.slot === s)) worn[s] = uid; }
    const seen = { skills: (d.seen?.skills ?? []).filter((s: string) => s in SKILLS || s in EVOS), foes: (d.seen?.foes ?? []).filter((f: string) => f in FOES) };
    return { v: 1, acorns: d.acorns, training: { atk: d.training.atk, hp: d.training.hp }, gear, worn, unlocked: d.unlocked, best: [...d.best] as Profile['best'], seen, next: d.next, last: Number.isFinite(d.last) ? d.last : 0,
      ui: typeof d.ui?.fast === 'boolean' && typeof d.ui?.auto === 'boolean' ? { fast: d.ui.fast, auto: d.ui.auto } : { fast: false, auto: true } };
  } catch { return freshProfile(); }
}

const wornPiece = (p: Profile, s: GearSlot) => p.gear.find((x) => x.uid === p.worn[s]);
export function campStats(p: Profile): Stats {
  const g = (s: GearSlot) => { const x = wornPiece(p, s); return x ? GEAR_STAT[s][x.r] : 0; };
  return { hp: BASE.hp + p.training.hp * TRAIN_STEP.hp + g('hat'), atk: BASE.atk + p.training.atk * TRAIN_STEP.atk + g('scarf'), crit: BASE.crit + g('charm'), dodge: BASE.dodge + g('boots') };
}

export function train(p: Profile, which: 'atk' | 'hp'): Profile | null {
  const cost = trainCost(p.training[which]);
  if (p.acorns < cost) return null;
  const q = copy(p); q.acorns -= cost; q.training[which]++;
  return q;
}

/** Adds a piece to `q` (already a copy), worn when it beats what's worn. */
function gain(q: Profile, slot: GearSlot, r: Rarity): Piece {
  const x: Piece = { uid: q.next++, slot, r };
  q.gear.push(x);
  if ((wornPiece(q, slot)?.r ?? -1) < r) q.worn[slot] = x.uid;
  return x;
}

export function merge(p: Profile, slot: GearSlot, r: Rarity): Profile | null {
  const three = p.gear.filter((x) => x.slot === slot && x.r === r).slice(0, 3);
  if (r >= 4 || three.length < 3) return null;
  const q = copy(p), gone = new Set(three.map((x) => x.uid));
  q.gear = q.gear.filter((x) => !gone.has(x.uid));
  if (gone.has(q.worn[slot] ?? -1)) delete q.worn[slot];
  gain(q, slot, (r + 1) as Rarity);
  return q;
}

export function wear(p: Profile, uid: number): Profile | null {
  const x = p.gear.find((g) => g.uid === uid);
  if (!x) return null;
  const q = copy(p); q.worn[x.slot] = uid;
  return q;
}

/** `n` chest rarities: weights 60/30/9/1/0, each chapter above 1 and each 10 days moving 8 points up from the lowest; Legend from chapter 4. */
export function chestRarities(chapter: ChapterNo, day: number, r: Rand, n: number): Rarity[] {
  const w = [60, 30, 9, 1, 0];
  for (let k = 0; k < chapter - 1 + Math.floor(day / 10); k++) {
    const lo = w.findIndex((x) => x > 0), top = chapter >= 4 ? 4 : 3;
    if (lo >= top) break;
    const m = Math.min(8, w[lo]); w[lo] -= m; w[lo + 1] += m;
  }
  if (chapter >= 4) { const lo = w.findIndex((x) => x > 0); w[lo] -= chapter - 3; w[4] += chapter - 3; }
  else { w[3] += w[4]; w[4] = 0; }
  const total = w.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, () => { let x = r.next() * total, i = 0; while (x >= w[i]) x -= w[i++]; return i as Rarity; });
}

/** Banks a finished trek once: its acorns and a chest, a chapter unlocked on a clear, and the best day and sightings. */
export function record(p: Profile, t: Trek): { profile: Profile; chest: Chest | null } {
  if ((t.phase !== 'over' && t.phase !== 'cleared') || p.last === t.seed) return { profile: p, chest: null };
  const q = copy(p), cleared = t.phase === 'cleared', ch = t.chapter, r = new Rand(mix(t.seed, 999));
  const rs = chestRarities(ch, t.day, r, cleared ? 2 : 1);
  if (cleared && p.best[ch - 1] <= DAYS && rs[0] < 2) rs[0] = 2;
  const chest: Chest = { acorns: 2 * ch * t.day, pieces: rs.map((rar) => gain(q, r.pick(GEAR_SLOTS), rar)) };
  q.acorns += t.acorns + chest.acorns;
  if (cleared && ch < 5 && q.unlocked === ch) q.unlocked = (ch + 1) as ChapterNo;
  q.best[ch - 1] = Math.max(q.best[ch - 1], cleared ? DAYS + 1 : t.day);
  for (const s of t.seen.skills) if (!q.seen.skills.includes(s)) q.seen.skills.push(s);
  for (const f of t.seen.foes) if (!q.seen.foes.includes(f)) q.seen.foes.push(f);
  q.last = t.seed;
  return { profile: q, chest };
}

// ── The bot's policy ───────────────────────────────────────────────────────

/** How much the bot wants each skill, from how often favouring it clears chapter 1. */
export const SKILL_WEIGHT: Record<SkillId, number> = {
  wind: 50, fluff: 50, frost: 45, combo: 45, snack: 45, sharp: 40, static: 40, prickle: 40, nap: 40,
  pepper: 35, dust: 35, shell: 35, keen: 40, counter: 35, grit: 40, pounce: 35, roll: 35, lucky: 35,
};
/** The other half of `id`'s evolution, if it has one. */
const partner = (id: SkillId) => { const e = EVO_IDS.find((x) => EVOS[x].from.includes(id)); return e ? EVOS[e].from.find((s) => s !== id)! : null; };
export type Action = { k: 'next' } | { k: 'choose'; i: number } | { k: 'pick'; i: number } | { k: 'reroll' } | { k: 'buy'; i: number };
const HALVES = new Set(EVO_IDS.flatMap((e) => EVOS[e].from));

export function decide(t: Trek): Action {
  const low = (pct: number) => t.hp < t.stats().hp * pct;
  if (t.phase === 'pick') {
    const pair = (id: SkillId) => { const o = partner(id); return o && t.kit.skills[o] ? 25 : 0; };
    const score = (c: Card) => c.k === 'evo' ? 100 : c.k === 'rest' ? 0 : SKILL_WEIGHT[c.id] + (c.level === 3 && HALVES.has(c.id) ? 50 : 0) + pair(c.id);
    const scores = t.offer!.map(score), best = Math.max(...scores);
    if (best < 20 && !t.rerolled) return { k: 'reroll' };
    return { k: 'pick', i: scores.indexOf(best) };
  }
  const e = t.today;
  if (t.phase !== 'event' || !e) return { k: 'next' };
  const fresh = SKILL_IDS.some((s) => skillLevel(t.kit, s) === 0);
  if (e.k === 'story') {
    const cs = sceneOf(e.scene)!.choices, safe = low(0.4);
    return { k: 'choose', i: Math.max(0, cs.findIndex((c) => (c.odds === undefined) === safe)) };
  }
  if (e.k === 'crossroads') {
    if (low(0.5)) return { k: 'choose', i: 0 };
    if (fresh) return { k: 'choose', i: 2 };
    return { k: 'choose', i: Object.values(t.kit.skills).some((n) => n! < 3) ? 1 : 0 };
  }
  if (e.k === 'visit') return { k: 'choose', i: e.who === 'owl' || fresh ? 0 : -1 };
  if (e.k === 'wheel') return { k: 'choose', i: 0 };
  if (e.k === 'pedlar') {
    const can = (i: number) => !e.sold[i] && t.acorns >= price(e.stock[i], t.chapter);
    for (const i of low(0.5) ? [0] : [2, 1]) if (can(i)) return { k: 'buy', i };
    return { k: 'choose', i: -1 };
  }
  return { k: 'next' };
}

const act = (t: Trek, a: Action) => a.k === 'next' ? t.next() !== null : a.k === 'choose' ? t.choose(a.i) : a.k === 'pick' ? t.pickSkill(a.i) : a.k === 'reroll' ? t.reroll() : t.buy(a.i);

/** Plays `t` to its end with `policy`, at most 500 steps. */
export function playTrek(t: Trek, policy: (t: Trek) => Action = decide): Trek {
  for (let i = 0; i < 500 && t.phase !== 'over' && t.phase !== 'cleared'; i++) if (!act(t, policy(t))) break;
  return t;
}

/** The bot's camp: every merge it can make, then training the cheaper of attack and HP until nothing is affordable. */
export function campStep(p: Profile): Profile {
  let q = p;
  for (let again = true; again;) {
    again = false;
    for (const s of GEAR_SLOTS) for (const r of [0, 1, 2, 3] as Rarity[]) { const m = merge(q, s, r); if (m) { q = m; again = true; } }
  }
  for (;;) { const t = train(q, q.training.atk <= q.training.hp ? 'atk' : 'hp'); if (!t) return q; q = t; }
}
