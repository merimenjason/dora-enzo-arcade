// Whisker Saga: the rules of a hero-squad adventure. Deterministic, no DOM.
// A battle is a seed plus the squad, the stage and the moments skills were fired, so it replays exactly.

export const STEP = 1 / 60, SAVE_VERSION = 1;

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── Heroes ──────────────────────────────────────────────────────────────────

export type Faction = 'meadow' | 'burrow' | 'summit';
export type Role = 'guard' | 'striker' | 'archer' | 'mage' | 'healer';
export type SkillKind = 'strike' | 'volley' | 'snipe' | 'freeze' | 'heal' | 'mend' | 'ward' | 'rally';
export type Skill = { name: string; kind: SkillKind; power: number };
export type Hero = { id: string; name: string; faction: Faction; role: Role; rarity: 1 | 2 | 3; from: 'start' | 'story' | 'summon'; chapter?: number; skill: Skill };

export const FACTIONS: Faction[] = ['meadow', 'burrow', 'summit'];
export const FACTION_NAMES: Record<Faction, string> = { meadow: 'Meadow', burrow: 'Burrow', summit: 'Summit' };
export const ROLE_NAMES: Record<Role, string> = { guard: 'Guard', striker: 'Striker', archer: 'Archer', mage: 'Mage', healer: 'Healer' };
export const RARITY_NAMES = ['', 'Rare', 'Epic', 'Legendary'];

/** Base numbers for a rare hero at level 1. Guards are hard to hurt, mages hit hardest and slowest. */
export const ROLES: Record<Role, { hp: number; atk: number; armor: number; interval: number; ranged: boolean }> = {
  guard: { hp: 900, atk: 40, armor: 60, interval: 1.3, ranged: false },
  striker: { hp: 620, atk: 70, armor: 25, interval: 1, ranged: false },
  archer: { hp: 420, atk: 62, armor: 10, interval: 0.9, ranged: true },
  mage: { hp: 400, atk: 85, armor: 5, interval: 1.4, ranged: true },
  healer: { hp: 460, atk: 36, armor: 10, interval: 1.3, ranged: true },
};

const h = (id: string, name: string, faction: Faction, role: Role, rarity: 1 | 2 | 3, from: Hero['from'], skill: string, kind: SkillKind, power: number, chapter?: number): Hero =>
  ({ id, name, faction, role, rarity, from, chapter, skill: { name: skill, kind, power } });

/** Eighteen heroes: two to start, six who join as chapters fall, ten who answer a summons. */
export const HEROES: Hero[] = [
  h('dora', 'Dora', 'meadow', 'striker', 2, 'start', 'Dandelion Dash', 'strike', 3.2),
  h('enzo', 'Enzo', 'burrow', 'guard', 2, 'start', 'Burrow Wall', 'ward', 0.28),
  h('pip', 'Pip', 'meadow', 'healer', 1, 'story', 'Clover Tea', 'heal', 2.4, 0),
  h('bramble', 'Bramble', 'burrow', 'archer', 1, 'story', 'Thorn Rain', 'volley', 1.3, 1),
  h('flint', 'Flint', 'summit', 'mage', 1, 'story', 'Cold Snap', 'freeze', 0.9, 2),
  h('mossy', 'Mossy', 'meadow', 'guard', 2, 'story', 'Acorn Bash', 'strike', 2.6, 3),
  h('cinder', 'Cinder', 'burrow', 'striker', 2, 'story', 'Ember Spin', 'volley', 1.5, 4),
  h('frost', 'Frost', 'summit', 'healer', 2, 'story', 'Snow Blanket', 'mend', 4.5, 5),
  h('clover', 'Clover', 'meadow', 'archer', 1, 'summon', 'Lucky Shot', 'snipe', 3.6),
  h('nutmeg', 'Nutmeg', 'burrow', 'mage', 1, 'summon', 'Spice Cloud', 'volley', 1.6),
  h('pebble', 'Pebble', 'summit', 'guard', 1, 'summon', 'Rock Steady', 'ward', 0.24),
  h('thistle', 'Thistle', 'summit', 'striker', 1, 'summon', 'Prickle Jab', 'strike', 3),
  h('willow', 'Willow', 'meadow', 'mage', 2, 'summon', 'Pollen Burst', 'freeze', 1.1),
  h('ember', 'Ember', 'burrow', 'healer', 2, 'summon', 'Hearth Song', 'rally', 0.35),
  h('gale', 'Gale', 'summit', 'archer', 2, 'summon', 'Split Wind', 'snipe', 4.2),
  h('aurora', 'Aurora', 'meadow', 'archer', 3, 'summon', 'Dawn Volley', 'volley', 2),
  h('onyx', 'Onyx', 'burrow', 'striker', 3, 'summon', 'Night Pounce', 'strike', 4.6),
  h('zephyr', 'Zephyr', 'summit', 'mage', 3, 'summon', 'Blizzard', 'freeze', 1.5),
];
export const heroById = (id: string) => HEROES.find((x) => x.id === id)!;

export const STUN: Record<SkillKind, number> = { strike: 2, volley: 0, snipe: 1.2, freeze: 1.6, heal: 0, mend: 0, ward: 0, rally: 0 };
export const SHIELD_TIME = 6, RALLY_TIME = 6, MEND_SHIELD = 0.5;
export const skillText = (s: Skill): string => {
  const p = Math.round(s.power * 100);
  switch (s.kind) {
    case 'strike': return `Hits the nearest enemy for ${p}% attack and stuns it for ${STUN.strike} seconds.`;
    case 'volley': return `Hits every enemy for ${p}% attack.`;
    case 'snipe': return `Hits an enemy that is winding up, or else the toughest one, for ${p}% attack and stuns it for ${STUN.snipe} seconds.`;
    case 'freeze': return `Hits every enemy for ${p}% attack and stuns them for ${STUN.freeze} seconds.`;
    case 'heal': return `Heals the whole squad for ${p}% attack.`;
    case 'mend': return `Heals the most hurt hero for ${p}% attack and shields them for half as much.`;
    case 'ward': return `Shields the whole squad for ${p}% of this hero's health, for ${SHIELD_TIME} seconds.`;
    case 'rally': return `The whole squad attacks ${p}% faster for ${RALLY_TIME} seconds.`;
  }
};

export const RARITY_MULT = [0, 1, 1.12, 1.26], LEVEL_GROWTH = 1.08, STAR_STEP = 0.12, MAX_STARS = 5;
export const STAR_COST = [0, 10, 20, 40, 80], DUP_SHARDS = 10;
export const GEAR = ['weapon', 'armour', 'charm', 'boots'] as const;
export const GEAR_NAMES = ['Weapon', 'Armour', 'Charm', 'Boots'];
export const GEAR_TEXT = ['attack', 'health', 'skill charge', 'attack speed'];
export const GEAR_STEP = [0.08, 0.08, 0.06, 0.04], MAX_TIER = 5, MERGE = 3;
/** Extra attack and health for fielding three, four or five heroes of one faction. */
export const FACTION_BONUS = [0, 0, 0, 0.1, 0.15, 0.25];
export const LEVEL_COST = 40, LEVEL_COST_GROWTH = 1.09, BASE_CAP = 10;

export type Owned = { level: number; stars: number; shards: number; gear: number[] };
export type Spec = { id: string; name: string; role: Role; skill: Skill; hp: number; atk: number; armor: number; interval: number; charge: number; ranged: boolean };

export const heroSpec = (hero: Hero, o: Owned, bonus = 0): Spec => {
  const base = ROLES[hero.role];
  const m = RARITY_MULT[hero.rarity] * LEVEL_GROWTH ** (o.level - 1) * (1 + STAR_STEP * (o.stars - 1)) * (1 + bonus);
  return {
    id: hero.id, name: hero.name, role: hero.role, skill: hero.skill, armor: base.armor, ranged: base.ranged,
    hp: Math.round(base.hp * m * (1 + GEAR_STEP[1] * o.gear[1])),
    atk: Math.round(base.atk * m * (1 + GEAR_STEP[0] * o.gear[0])),
    charge: 1 + GEAR_STEP[2] * o.gear[2],
    interval: base.interval / (1 + GEAR_STEP[3] * o.gear[3]),
  };
};
export const specPower = (s: Spec) => Math.round((s.hp * 0.12 + s.atk * 1.6 / s.interval) * (0.9 + 0.1 * s.charge));

// ── Enemies and stages ──────────────────────────────────────────────────────

export type EnemyKind = 'grunt' | 'slinger' | 'sneak' | 'brute' | 'hexer' | 'captain' | 'boss';
export type Special = { kind: 'slam' | 'heal'; every: number; wind: number; power: number };
export type Enemy = { name: string; hp: number; atk: number; armor: number; interval: number; speed: number; ranged: boolean; back?: boolean; special?: Special };

/** Numbers at stage 1; every later stage multiplies health and attack by `stageMult`. */
export const ENEMIES: Record<EnemyKind, Enemy> = {
  grunt: { name: 'Scuttler', hp: 440, atk: 105, armor: 10, interval: 1.2, speed: 1.6, ranged: false },
  slinger: { name: 'Spitter', hp: 280, atk: 88, armor: 0, interval: 1.5, speed: 1.6, ranged: true },
  sneak: { name: 'Sneak', hp: 320, atk: 110, armor: 0, interval: 0.9, speed: 2.8, ranged: false, back: true },
  brute: { name: 'Bruiser', hp: 1050, atk: 165, armor: 45, interval: 1.8, speed: 1.2, ranged: false },
  hexer: { name: 'Hexer', hp: 380, atk: 66, armor: 0, interval: 1.7, speed: 1.4, ranged: true, special: { kind: 'heal', every: 6, wind: 1.8, power: 0.5 } },
  captain: { name: 'Captain', hp: 3500, atk: 130, armor: 30, interval: 1.5, speed: 1.4, ranged: false, special: { kind: 'slam', every: 9, wind: 1.8, power: 2.2 } },
  boss: { name: 'Boss', hp: 6000, atk: 115, armor: 40, interval: 1.4, speed: 1.2, ranged: false, special: { kind: 'slam', every: 8, wind: 1.8, power: 2.8 } },
};

export const CHAPTERS = ['Clover Meadow', 'Bramble Wood', 'Mossy Marsh', 'Rattle Ridge', 'Tusk Hollow', 'Frost Pass', 'Cinder Caves', 'Hollow Keep'];
export const BOSSES = ['Thornback', 'Mudmaw', 'Old Croak', 'Rattlewing', 'Grimtusk', 'Frostfang', 'Cinderclaw', 'The Hollow King'];
export const PER_CHAPTER = 10, STAGES = CHAPTERS.length * PER_CHAPTER;
export const STAGE_GROWTH = 1.06, WAVES = 3;
export const stageMult = (n: number) => STAGE_GROWTH ** n;
/** When each kind first turns up, by chapter. */
const FIRST: [EnemyKind, number][] = [['grunt', 0], ['slinger', 0], ['sneak', 1], ['brute', 2], ['hexer', 3]];

export type StageDef = { index: number; chapter: number; number: number; boss: boolean; tower: number; name: string; waves: EnemyKind[][]; mult: number; summons: boolean };

/** Stage `n` from 0. Past the campaign, `n` runs on into the tower: floor 1 is stage 80. */
export const stageDef = (n: number): StageDef => {
  const tower = n >= STAGES ? n - STAGES + 1 : 0;
  const chapter = tower ? CHAPTERS.length - 1 : Math.floor(n / PER_CHAPTER), number = tower || (n % PER_CHAPTER) + 1;
  const boss = tower ? tower % 5 === 0 : number === PER_CHAPTER;
  const r = rng(7919 + n * 131), pool = FIRST.filter(([, c]) => c <= chapter).map(([k]) => k);
  const size = Math.min(5, 2 + Math.floor(n / 4));
  const pick = () => pool[Math.floor(r() * pool.length)];
  const wave = (count: number) => {
    const out: EnemyKind[] = ['grunt'];
    while (out.length < count) out.push(pick());
    return out;
  };
  const waves = [wave(size), wave(size), [boss ? 'boss' : 'captain', ...wave(Math.max(1, size - (boss ? 3 : 2)))] as EnemyKind[]];
  return {
    index: n, chapter, number, boss, tower, waves, mult: stageMult(n), summons: boss && (tower > 0 || chapter % 2 === 1),
    name: tower ? `Tower floor ${tower}` : `${CHAPTERS[chapter]} ${number}`,
  };
};

// ── Battle ──────────────────────────────────────────────────────────────────

export const ENERGY = 100, START_ENERGY = 40, ENERGY_HIT = 14, ENERGY_HURT = 5;
export const MELEE_REACH = 1, RANGED_REACH = 8, ENEMY_MELEE = 0.5, ENEMY_RANGED = 4.5, SPAWN = 7, SPAWN_GAP = 0.7;
export const MARCH = 1.2, ADVANCE = 1.4, LIMIT = 150, PAR = 60, BOSS_STUN = 0.5, HEALER_TOUCH = 0.4, STAGGER = 2.5, EXPOSED = 4, EXPOSED_DAMAGE = 1.5, SUMMON_AT = [0.66, 0.33];

export type Unit = {
  uid: number; hero: boolean; key: string; name: string; slot: number; row: 0 | 1;
  hp: number; max: number; atk: number; armor: number; interval: number; cd: number; ranged: boolean;
  d: number; speed: number; reach: number; back: boolean; boss: boolean;
  energy: number; charge: number; skill: Skill | null; healer: boolean;
  stun: number; shield: number; shieldT: number; haste: number; hasteT: number;
  special: Special | null; specialT: number; wind: number; exposed: number; called: number; dead: boolean;
};
export type BattleEvent =
  | { type: 'wave'; wave: number }
  | { type: 'hit'; from: number; to: number; amount: number; skill: boolean; ranged: boolean }
  | { type: 'heal'; to: number; amount: number }
  | { type: 'shield'; to: number }
  | { type: 'skill'; from: number; kind: SkillKind; name: string }
  | { type: 'windup'; from: number; kind: Special['kind'] }
  | { type: 'interrupt'; from: number }
  | { type: 'slam'; from: number }
  | { type: 'call'; from: number }
  | { type: 'die'; uid: number; hero: boolean }
  | { type: 'won' | 'lost'; reason?: 'fallen' | 'time' };
export type Input = { cast?: number[]; auto?: boolean };

export class Battle {
  phase: 'march' | 'fight' | 'won' | 'lost' = 'march';
  wave = 0; time = 0; marchT = MARCH; fallen = 0;
  heroes: Unit[] = []; enemies: Unit[] = []; events: BattleEvent[] = [];
  private acc = 0; private uid = 0; private rand: () => number;

  constructor(squad: (Spec | null)[], readonly def: StageDef, seed: number) {
    this.rand = rng(seed);
    squad.forEach((s, slot) => {
      if (!s) return;
      this.heroes.push({
        ...this.blank(), uid: this.uid++, hero: true, key: s.id, name: s.name, slot, row: slot < 2 ? 0 : 1,
        hp: s.hp, max: s.hp, atk: s.atk, armor: s.armor, interval: s.interval, cd: 0.3 + slot * 0.1, ranged: s.ranged,
        reach: s.ranged ? RANGED_REACH : MELEE_REACH, energy: START_ENERGY, charge: s.charge, skill: s.skill, healer: s.role === 'healer',
      });
    });
  }

  private blank(): Unit {
    return {
      uid: 0, hero: false, key: '', name: '', slot: 0, row: 0, hp: 1, max: 1, atk: 0, armor: 0, interval: 1, cd: 0, ranged: false,
      d: 0, speed: 0, reach: 0, back: false, boss: false, energy: 0, charge: 1, skill: null, healer: false,
      stun: 0, shield: 0, shieldT: 0, haste: 0, hasteT: 0, special: null, specialT: 0, wind: 0, exposed: 0, called: 0, dead: false,
    };
  }

  private spawn(kind: EnemyKind, d: number) {
    const e = ENEMIES[kind], m = this.def.mult, hp = Math.round(e.hp * m);
    const u: Unit = {
      ...this.blank(), uid: this.uid++, key: kind, name: kind === 'boss' && !this.def.tower ? BOSSES[this.def.chapter] : e.name, slot: this.enemies.length,
      hp, max: hp, atk: Math.round(e.atk * m), armor: e.armor, interval: e.interval, cd: e.interval * (0.4 + 0.6 * this.rand()), ranged: e.ranged,
      d, speed: e.speed, reach: e.ranged ? ENEMY_RANGED : ENEMY_MELEE, back: !!e.back, boss: kind === 'boss',
      special: e.special ?? null, specialT: e.special ? e.special.every * 0.5 : 0,
    };
    this.enemies.push(u);
    return u;
  }

  get alive() { return this.heroes.filter((u) => !u.dead); }
  get foes() { return this.enemies.filter((u) => !u.dead); }
  /** An enemy part-way through a wind-up, if there is one: the cue to stun or shield. */
  get winding() { return this.foes.find((u) => u.wind > 0) ?? null; }
  ready(slot: number) {
    const u = this.heroes.find((x) => x.slot === slot);
    return !!u && !u.dead && u.stun <= 0 && u.energy >= ENERGY && this.phase === 'fight' && this.foes.length > 0;
  }

  update(dt: number, input: Input = {}) {
    this.events.length = 0;
    this.acc += Math.min(dt, 0.25);
    let cast = input.cast ?? [];
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(cast, !!input.auto);
      cast = [];
    }
    return this.events;
  }

  private step(cast: number[], auto: boolean) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    if (this.phase === 'march') {
      this.marchT -= STEP;
      if (this.marchT > 0) return;
      this.def.waves[this.wave].forEach((k, i) => this.spawn(k, SPAWN + i * SPAWN_GAP));
      this.phase = 'fight';
      this.events.push({ type: 'wave', wave: this.wave });
      return;
    }
    this.time += STEP;
    for (const slot of cast) this.cast(slot);
    if (auto) for (const u of this.heroes) if (this.ready(u.slot)) this.cast(u.slot);
    // With nothing left in arm's reach the squad walks forward, which brings the enemy's back line to it.
    if (!this.foes.some((e) => e.d <= MELEE_REACH)) for (const e of this.foes) if (e.d <= e.reach) e.d = Math.max(ENEMY_MELEE, e.d - ADVANCE * STEP);
    for (const u of this.heroes) if (!u.dead) this.heroTurn(u);
    const turn = this.enemies.slice();
    for (const u of turn) if (!u.dead) this.enemyTurn(u);
    if (!this.alive.length) return this.end('lost', 'fallen');
    if (this.time >= LIMIT) return this.end('lost', 'time');
    if (!this.foes.length) {
      if (this.wave + 1 >= this.def.waves.length) return this.end('won');
      this.wave++; this.enemies = []; this.phase = 'march'; this.marchT = MARCH;
    }
  }

  private end(phase: 'won' | 'lost', reason?: 'fallen' | 'time') {
    this.phase = phase;
    this.events.push({ type: phase, reason });
  }

  private tick(u: Unit) {
    if (u.shieldT > 0 && (u.shieldT -= STEP) <= 0) u.shield = 0;
    if (u.hasteT > 0 && (u.hasteT -= STEP) <= 0) u.haste = 0;
    if (u.exposed > 0) u.exposed -= STEP;
    if (u.stun > 0) { u.stun -= STEP; return false; }
    return true;
  }

  private heroTurn(u: Unit) {
    if (!this.tick(u)) return;
    u.cd -= STEP * (1 + u.haste);
    if (u.cd > 0) return;
    const target = this.foes.filter((e) => e.d <= u.reach).sort((a, b) => a.d - b.d || a.uid - b.uid)[0];
    if (!target) return;
    u.cd = u.interval;
    this.damage(u, target, 1, false);
    u.energy = Math.min(ENERGY, u.energy + ENERGY_HIT * u.charge);
    if (u.healer) {
      const hurt = this.alive.filter((a) => a.hp < a.max).sort((a, b) => a.hp / a.max - b.hp / b.max || a.uid - b.uid)[0];
      if (hurt) this.heal(hurt, u.atk * HEALER_TOUCH);
    }
  }

  private enemyTurn(u: Unit) {
    if (!this.tick(u)) return;
    if (u.d > u.reach) { u.d = Math.max(u.reach, u.d - u.speed * STEP); return; }
    const sp = u.special;
    if (u.wind > 0 && sp) {
      if ((u.wind -= STEP) > 0) return;
      u.wind = 0; u.specialT = sp.every;
      if (sp.kind === 'slam') {
        this.events.push({ type: 'slam', from: u.uid });
        for (const t of this.alive) this.damage(u, t, sp.power, true);
      } else for (const t of this.foes) this.heal(t, u.max * sp.power);
      return;
    }
    if (sp && (u.specialT -= STEP) <= 0) {
      u.wind = sp.wind;
      this.events.push({ type: 'windup', from: u.uid, kind: sp.kind });
      return;
    }
    if (u.boss && this.def.summons && u.called < SUMMON_AT.length && u.hp <= u.max * SUMMON_AT[u.called]) {
      u.called++;
      this.events.push({ type: 'call', from: u.uid });
      this.spawn('grunt', SPAWN);
    }
    u.cd -= STEP;
    if (u.cd > 0) return;
    const alive = this.alive, front = alive.filter((x) => x.row === 0), back = alive.filter((x) => x.row === 1);
    let target: Unit | undefined;
    if (u.ranged) target = alive[Math.floor(this.rand() * alive.length)];
    else if (u.back && back.length) target = [...back].sort((a, b) => a.hp - b.hp || a.uid - b.uid)[0];
    else { const line = front.length ? front : back; target = line[u.uid % line.length]; }
    if (!target) return;
    u.cd = u.interval;
    this.damage(u, target, 1, false);
  }

  private damage(from: Unit, to: Unit, mult: number, skill: boolean) {
    let amount = Math.max(1, Math.round(from.atk * mult * (100 / (100 + to.armor)) * (0.9 + 0.2 * this.rand()) * (to.exposed > 0 ? EXPOSED_DAMAGE : 1)));
    this.events.push({ type: 'hit', from: from.uid, to: to.uid, amount, skill, ranged: from.ranged });
    if (to.shield > 0) { const soak = Math.min(to.shield, amount); to.shield -= soak; amount -= soak; }
    to.hp -= amount;
    if (to.hero) to.energy = Math.min(ENERGY, to.energy + ENERGY_HURT * to.charge);
    if (to.hp <= 0) {
      to.hp = 0; to.dead = true; to.wind = 0;
      if (to.hero) this.fallen++;
      this.events.push({ type: 'die', uid: to.uid, hero: to.hero });
    }
  }

  private heal(to: Unit, amount: number) {
    const gain = Math.min(to.max - to.hp, Math.round(amount));
    if (gain <= 0) return;
    to.hp += gain;
    this.events.push({ type: 'heal', to: to.uid, amount: gain });
  }

  private stun(to: Unit, seconds: number) {
    if (to.dead || seconds <= 0) return;
    to.stun = Math.max(to.stun, seconds * (to.boss ? BOSS_STUN : 1));
    if (to.wind > 0 && to.special) {
      // Caught mid-wind-up: the move is lost, and the enemy reels and takes extra damage for a while.
      to.wind = 0; to.specialT = to.special.every; to.stun = Math.max(to.stun, STAGGER); to.exposed = EXPOSED;
      this.events.push({ type: 'interrupt', from: to.uid });
    }
  }

  /** Fire the skill of the hero in `slot`. Does nothing unless it is charged and there is something to use it on. */
  cast(slot: number) {
    if (!this.ready(slot)) return false;
    const u = this.heroes.find((x) => x.slot === slot)!, s = u.skill!, foes = this.foes.sort((a, b) => a.d - b.d || a.uid - b.uid);
    u.energy = 0;
    this.events.push({ type: 'skill', from: u.uid, kind: s.kind, name: s.name });
    const strike = (t: Unit) => { this.damage(u, t, s.power, true); this.stun(t, STUN[s.kind]); };
    switch (s.kind) {
      case 'strike': strike(foes[0]); break;
      case 'snipe': strike(this.winding ?? [...foes].sort((a, b) => b.hp - a.hp || a.uid - b.uid)[0]); break;
      case 'volley': case 'freeze': foes.forEach(strike); break;
      case 'heal': for (const a of this.alive) this.heal(a, u.atk * s.power); break;
      case 'mend': {
        const t = this.alive.sort((a, b) => a.hp / a.max - b.hp / b.max || a.uid - b.uid)[0];
        this.heal(t, u.atk * s.power);
        this.shield(t, u.atk * s.power * MEND_SHIELD);
        break;
      }
      case 'ward': for (const a of this.alive) this.shield(a, u.max * s.power); break;
      case 'rally': for (const a of this.alive) { a.haste = s.power; a.hasteT = RALLY_TIME; } break;
    }
    return true;
  }

  private shield(to: Unit, amount: number) {
    to.shield = Math.max(to.shield, Math.round(amount)); to.shieldT = SHIELD_TIME;
    this.events.push({ type: 'shield', to: to.uid });
  }

  /** One to three stars for a win: cleared, nobody fell, under par. */
  get stars() { return this.phase === 'won' ? 1 + (this.fallen === 0 ? 1 : 0) + (this.time <= PAR ? 1 : 0) : 0; }
}

// ── The saga: roster, loot and progress ─────────────────────────────────────

export const SLOTS = 5, START_SCROLLS = 3, START_GOLD = 120;
export const GOLD = 42, FIRST_CLEAR = 2, GEAR_CHANCE = 0.35;
export const ODDS = [0, 0.7, 0.24, 0.06], PITY = 10;
export const CHEST_STARS = [10, 20, 30], CHEST_SCROLLS = [1, 2, 3];
export const CAMP_HOURS = 4, CAMP_RATE = 4, TOWER_SCROLLS = 2, TOWER_EVERY = 5;
export const goldFor = (n: number) => Math.round(GOLD * STAGE_GROWTH ** n);
export const gearTier = (chapter: number, lucky: boolean) => Math.min(MAX_TIER, 1 + Math.floor(chapter / 2) + (lucky ? 1 : 0));

export type Loot = { gold: number; scrolls: number; gear: { slot: number; tier: number } | null; joined: string | null; stars: number; first: boolean };
export type Summoned = { id: string; fresh: boolean; shards: number };
export type Profile = {
  v: number; seed: number; heroes: Record<string, Owned>; squad: (string | null)[]; gold: number; scrolls: number; bag: number[][];
  stars: number[]; chests: number[]; tower: number; battles: number; summons: number; pity: number; campAt: number;
};

const newOwned = (): Owned => ({ level: 1, stars: 1, shards: 0, gear: [0, 0, 0, 0] });
const int = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

export class Game {
  heroes: Record<string, Owned> = { dora: newOwned(), enzo: newOwned() };
  squad: (string | null)[] = ['enzo', 'dora', null, null, null];
  gold = START_GOLD; scrolls = START_SCROLLS;
  /** `bag[slot][tier]`: spare gear pieces not worn by anyone. */
  bag: number[][] = GEAR.map(() => Array(MAX_TIER + 1).fill(0));
  stars: number[] = Array(STAGES).fill(0); chests: number[] = Array(CHAPTERS.length).fill(0);
  tower = 0; battles = 0; summons = 0; pity = 0;
  battle: Battle | null = null; stage = -1; loot: Loot | null = null;

  constructor(readonly seed: number, public campAt = 0) {}

  // Progress
  /** How many campaign stages are cleared; also the index of the next one. */
  get cleared() { const i = this.stars.indexOf(0); return i < 0 ? STAGES : i; }
  get chapters() { return Math.floor(this.cleared / PER_CHAPTER); }
  get complete() { return this.cleared >= STAGES; }
  get cap() { return BASE_CAP + this.cleared + this.tower; }
  get totalStars() { return this.stars.reduce((a, b) => a + b, 0); }
  chapterStars(c: number) { return this.stars.slice(c * PER_CHAPTER, (c + 1) * PER_CHAPTER).reduce((a, b) => a + b, 0); }
  unlocked(n: number) { return n < STAGES ? n <= this.cleared : this.complete && n === STAGES + this.tower; }
  /** Auto-fire is only offered where the stage has already been beaten. */
  canAuto(n: number) { return n < STAGES && this.stars[n] > 0; }

  // Squad
  get owned() { return HEROES.filter((x) => this.heroes[x.id]); }
  get factionBonus() {
    const count: Record<string, number> = {};
    for (const id of this.squad) if (id) { const f = heroById(id).faction; count[f] = (count[f] ?? 0) + 1; }
    return FACTION_BONUS[Math.max(0, ...Object.values(count))];
  }
  spec(id: string, bonus = this.squad.includes(id) ? this.factionBonus : 0) { return heroSpec(heroById(id), this.heroes[id], bonus); }
  power(id: string) { return specPower(this.spec(id)); }
  get squadPower() { return this.squad.reduce((a, id) => a + (id ? this.power(id) : 0), 0); }

  /** Put a hero in a slot. A hero already fielded swaps places with whoever is there. */
  place(id: string, slot: number) {
    if (!this.heroes[id] || !int(slot, 0, SLOTS - 1) || this.battle) return false;
    const from = this.squad.indexOf(id), there = this.squad[slot];
    if (from === slot) return false;
    if (from >= 0) this.squad[from] = there;
    this.squad[slot] = id;
    return true;
  }
  bench(slot: number) {
    if (this.battle || !this.squad[slot] || this.squad.filter(Boolean).length <= 1) return false;
    this.squad[slot] = null;
    return true;
  }
  /** Fill the squad with the strongest heroes: guards and strikers in front, the rest behind. */
  autoSquad() {
    if (this.battle) return;
    const rank = (id: string) => specPower(this.spec(id, 0));
    const all = this.owned.map((x) => x.id).sort((a, b) => rank(b) - rank(a) || a.localeCompare(b)), best = all.slice(0, SLOTS);
    // A squad wants one guard to stand in front and one healer behind, even if a fifth fighter looks stronger.
    for (const role of ['guard', 'healer'] as Role[]) {
      const has = (id: string) => heroById(id).role === role, pick = all.find(has);
      if (pick && !best.some(has)) best[best.length - 1 - best.slice().reverse().findIndex((id) => !['guard', 'healer'].includes(heroById(id).role))] = pick;
    }
    const melee = best.filter((id) => !ROLES[heroById(id).role].ranged), ranged = best.filter((id) => ROLES[heroById(id).role].ranged);
    const tough = (id: string) => this.spec(id, 0).hp * (1 + ROLES[heroById(id).role].armor / 100);
    const order = [...melee.sort((a, b) => tough(b) - tough(a)), ...ranged.sort((a, b) => tough(b) - tough(a))];
    this.squad = Array.from({ length: SLOTS }, (_, i) => order[i] ?? null);
  }

  // Growth
  levelCost(id: string) { return Math.round(LEVEL_COST * LEVEL_COST_GROWTH ** (this.heroes[id].level - 1)); }
  canLevel(id: string) { const o = this.heroes[id]; return !!o && o.level < this.cap && this.gold >= this.levelCost(id); }
  levelUp(id: string) {
    if (!this.canLevel(id)) return false;
    this.gold -= this.levelCost(id); this.heroes[id].level++;
    return true;
  }
  /** Spend gold on the squad, always raising whoever is lowest. Returns the levels bought. */
  levelSquad() {
    let bought = 0;
    for (;;) {
      const next = this.squad.filter((id): id is string => !!id && this.canLevel(id)).sort((a, b) => this.heroes[a].level - this.heroes[b].level || a.localeCompare(b))[0];
      if (!next) return bought;
      this.levelUp(next); bought++;
    }
  }
  starCost(id: string) { return STAR_COST[this.heroes[id].stars] ?? Infinity; }
  canStar(id: string) { const o = this.heroes[id]; return !!o && o.stars < MAX_STARS && o.shards >= this.starCost(id); }
  starUp(id: string) {
    if (!this.canStar(id)) return false;
    this.heroes[id].shards -= this.starCost(id); this.heroes[id].stars++;
    return true;
  }

  // Gear
  equip(id: string, slot: number, tier: number) {
    const o = this.heroes[id];
    if (!o || !int(slot, 0, GEAR.length - 1) || !int(tier, 1, MAX_TIER) || this.bag[slot][tier] < 1 || o.gear[slot] === tier) return false;
    this.bag[slot][tier]--;
    if (o.gear[slot]) this.bag[slot][o.gear[slot]]++;
    o.gear[slot] = tier;
    return true;
  }
  /** Wear the best spare piece in every slot. Returns how many slots improved. */
  equipBest(id: string) {
    const o = this.heroes[id];
    let changed = 0;
    if (!o) return 0;
    GEAR.forEach((_, slot) => {
      for (let tier = MAX_TIER; tier > o.gear[slot]; tier--) if (this.bag[slot][tier] > 0) { this.equip(id, slot, tier); changed++; break; }
    });
    return changed;
  }
  /** Three spare pieces of one tier forge into one of the next. */
  merge(slot: number, tier: number) {
    if (!int(slot, 0, GEAR.length - 1) || !int(tier, 1, MAX_TIER - 1) || this.bag[slot][tier] < MERGE) return false;
    this.bag[slot][tier] -= MERGE; this.bag[slot][tier + 1]++;
    return true;
  }

  // Summons
  /** Spend a scroll. The rarity is rolled first, then a hero of that rarity; a repeat becomes shards. */
  summon(): Summoned | null {
    if (this.scrolls < 1) return null;
    this.scrolls--;
    const r = rng(this.seed ^ Math.imul(this.summons + 1, 0x9e3779b1)), roll = r();
    this.summons++;
    let rarity = roll < ODDS[3] ? 3 : roll < ODDS[3] + ODDS[2] ? 2 : 1;
    if (++this.pity >= PITY) rarity = 3;
    if (rarity === 3) this.pity = 0;
    // The story heroes can turn up again once they have joined, which is how they earn stars.
    let pool = HEROES.filter((x) => x.rarity === rarity && (x.from === 'summon' || this.heroes[x.id]));
    // Until the squad can be filled, a summons always brings someone new.
    if (this.owned.length < SLOTS) { const fresh = HEROES.filter((x) => x.from === 'summon' && !this.heroes[x.id] && x.rarity === rarity); if (fresh.length) pool = fresh; }
    const hero = pool[Math.floor(r() * pool.length)];
    if (this.heroes[hero.id]) { this.heroes[hero.id].shards += DUP_SHARDS; return { id: hero.id, fresh: false, shards: DUP_SHARDS }; }
    this.join(hero.id);
    return { id: hero.id, fresh: true, shards: 0 };
  }
  private join(id: string) {
    this.heroes[id] = newOwned();
    const free = this.squad.indexOf(null);
    if (free >= 0) this.squad[free] = id;
  }

  // Battles
  start(n: number) {
    if (this.battle || !this.unlocked(n) || !this.squad.some(Boolean)) return false;
    const bonus = this.factionBonus;
    this.stage = n; this.loot = null;
    this.battle = new Battle(this.squad.map((id) => (id ? this.spec(id, bonus) : null)), stageDef(n), this.seed ^ Math.imul(++this.battles, 0x85ebca6b));
    return true;
  }
  /** Step the battle. On the frame it is won the loot is banked, so the page can save at once. */
  update(dt: number, input: Input = {}) {
    const b = this.battle;
    if (!b || b.phase === 'won' || b.phase === 'lost') return [];
    const events = b.update(dt, input);
    if ((b.phase as string) === 'won') this.loot = this.reward(b);
    return events;
  }
  /** Leave the battle screen: after a win or a loss, or as a retreat part-way. */
  leave() { this.battle = null; this.stage = -1; }

  private reward(b: Battle): Loot {
    const n = this.stage, def = b.def, r = rng(this.seed ^ Math.imul(this.battles, 0xc2b2ae35)), stars = b.stars;
    const first = def.tower ? true : this.stars[n] === 0;
    const loot: Loot = { gold: goldFor(n) * (first ? FIRST_CLEAR : 1), scrolls: 0, gear: null, joined: null, stars, first };
    const lucky = r() < 0.15, drop = r() < GEAR_CHANCE, slot = Math.floor(r() * GEAR.length);
    if (first || drop) loot.gear = { slot, tier: gearTier(def.chapter, lucky) };
    if (def.tower) {
      this.tower = def.tower;
      if (def.tower % TOWER_EVERY === 0) loot.scrolls = TOWER_SCROLLS;
    } else {
      if (first && def.number % 2 === 1) loot.scrolls = 1;
      this.stars[n] = Math.max(this.stars[n], stars);
      const story = first && def.boss ? HEROES.find((x) => x.from === 'story' && x.chapter === def.chapter) : undefined;
      if (story && !this.heroes[story.id]) { this.join(story.id); loot.joined = story.id; }
    }
    this.gold += loot.gold; this.scrolls += loot.scrolls;
    if (loot.gear) this.bag[loot.gear.slot][loot.gear.tier]++;
    return loot;
  }

  // Chapter chests and the camp
  chestReady(c: number) { return this.chests[c] < CHEST_STARS.length && this.chapterStars(c) >= CHEST_STARS[this.chests[c]]; }
  claimChest(c: number) {
    if (!int(c, 0, CHAPTERS.length - 1) || !this.chestReady(c)) return 0;
    const scrolls = CHEST_SCROLLS[this.chests[c]++];
    this.scrolls += scrolls;
    return scrolls;
  }
  /** Gold waiting at camp: it fills for up to four hours once the first stage is cleared. */
  camp(now: number) {
    if (!this.cleared) return 0;
    const hours = Math.min(CAMP_HOURS, Math.max(0, now - this.campAt) / 3_600_000);
    return Math.floor(hours * CAMP_RATE * goldFor(this.cleared - 1));
  }
  claimCamp(now: number) {
    const gold = this.camp(now);
    if (gold < 1) return 0;
    this.gold += gold; this.campAt = now;
    return gold;
  }

  // Saving
  save(): Profile {
    return {
      v: SAVE_VERSION, seed: this.seed, heroes: JSON.parse(JSON.stringify(this.heroes)), squad: [...this.squad], gold: this.gold, scrolls: this.scrolls,
      bag: this.bag.map((row) => [...row]), stars: [...this.stars], chests: [...this.chests], tower: this.tower, battles: this.battles,
      summons: this.summons, pity: this.pity, campAt: this.campAt,
    };
  }
  /** Rebuild a saga from a save, or null if anything about it is off. */
  static load(p: unknown): Game | null {
    const s = p as Profile, big = Number.MAX_SAFE_INTEGER;
    if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION || !int(s.seed, 0, 0xffffffff)) return null;
    if (!int(s.gold, 0, big) || !int(s.scrolls, 0, big) || !int(s.tower, 0, big) || !int(s.battles, 0, big) || !int(s.summons, 0, big) || !int(s.pity, 0, PITY - 1)) return null;
    if (typeof s.campAt !== 'number' || !Number.isFinite(s.campAt) || s.campAt < 0) return null;
    if (!Array.isArray(s.stars) || s.stars.length !== STAGES || !s.stars.every((x) => int(x, 0, 3))) return null;
    if (s.stars.some((x, i) => x > 0 && i > 0 && s.stars[i - 1] === 0)) return null;
    if (!Array.isArray(s.chests) || s.chests.length !== CHAPTERS.length || !s.chests.every((x) => int(x, 0, CHEST_STARS.length))) return null;
    if (!Array.isArray(s.bag) || s.bag.length !== GEAR.length || !s.bag.every((row) => Array.isArray(row) && row.length === MAX_TIER + 1 && row.every((x) => int(x, 0, big)))) return null;
    if (!s.heroes || typeof s.heroes !== 'object' || !s.heroes.dora || !s.heroes.enzo) return null;
    for (const [id, o] of Object.entries(s.heroes)) {
      if (!HEROES.some((x) => x.id === id) || !o || !int(o.level, 1, 9999) || !int(o.stars, 1, MAX_STARS) || !int(o.shards, 0, big)) return null;
      if (!Array.isArray(o.gear) || o.gear.length !== GEAR.length || !o.gear.every((x) => int(x, 0, MAX_TIER))) return null;
    }
    if (!Array.isArray(s.squad) || s.squad.length !== SLOTS || !s.squad.some(Boolean)) return null;
    const fielded = s.squad.filter((x): x is string => x !== null);
    if (fielded.some((id) => typeof id !== 'string' || !s.heroes[id]) || new Set(fielded).size !== fielded.length) return null;
    const g = new Game(s.seed, s.campAt);
    g.heroes = JSON.parse(JSON.stringify(s.heroes)); g.squad = [...s.squad]; g.gold = s.gold; g.scrolls = s.scrolls;
    g.bag = s.bag.map((row) => [...row]); g.stars = [...s.stars]; g.chests = [...s.chests];
    g.tower = s.tower; g.battles = s.battles; g.summons = s.summons; g.pity = s.pity;
    return g;
  }
}
