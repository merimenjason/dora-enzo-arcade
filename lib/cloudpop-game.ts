// Cloudpop: the run. A Game holds one run on one map: puffs drifting down the roads, towers and the hero, the coins
// and lives, and the round flow. Everything is deterministic from the seed; the combat itself (targeting, shots,
// damage, popping) is in ./cloudpop-sim.ts. The page and the bots drive it through the same commands.
import { PUFFS, shellHp, layers, type PuffKind } from './cloudpop-puffs.js';
import { TOWER, TOWERS } from './cloudpop-towerdata.js';
import { canBuyTier, crosspathReason, type Stats, type Target, type TowerId, type Ability } from './cloudpop-towers.js';
import { HEROES, heroStats, heroLevelFor, type HeroId } from './cloudpop-heroes.js';
import { MAP, buildRoad, roadAt, distToRoads, isWater, WORLD_W, WORLD_H, ROAD_W, type MapDef, type Road } from './cloudpop-maps.js';
import { roundGroups, roundBonus, bossScale, AUTHORED } from './cloudpop-rounds.js';
import { rng } from './cloudpop-rng.js';
import { simTick, damage } from './cloudpop-sim.js';

export const DT = 1 / 30;
export type Diff = 'easy' | 'medium' | 'hard';
export type Mode = 'standard' | 'reverse' | 'onekind' | 'lean' | 'nightfall' | 'endless' | 'daily';
export const DIFFS: Diff[] = ['easy', 'medium', 'hard'];
export const DIFF_NAME: Record<Diff, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const MODES: Record<Diff, Mode[]> = { easy: ['standard', 'reverse', 'onekind'], medium: ['standard', 'reverse', 'lean'], hard: ['standard', 'reverse', 'nightfall', 'endless'] };
export const MODE_INFO: Record<Mode, { name: string; desc: string }> = {
  standard: { name: 'Standard', desc: 'The festival road as it is.' },
  reverse: { name: 'Uphill', desc: 'The puffs come the other way, from the festival end.' },
  onekind: { name: 'Single Kind', desc: 'Pick one tower kind; only that kind (and your hero) may be built.' },
  lean: { name: 'Lean Harvest', desc: 'No Quinoa Terraces, no income upgrades, half the round bonus.' },
  nightfall: { name: 'Nightfall', desc: 'Every puff comes hidden by night. Bring lanterns.' },
  endless: { name: 'Endless Storm', desc: 'Rounds 6 to 100, 50 lives, no Burrow Lore and no second chance.' },
  daily: { name: 'Daily', desc: 'Today\'s challenge.' },
};
export const START_LIVES: Record<Diff, number> = { easy: 200, medium: 150, hard: 100 };
export const COST_MUL: Record<Diff, number> = { easy: 0.85, medium: 1, hard: 1.08 };
export const LAST_ROUND: Record<Diff, number> = { easy: 40, medium: 60, hard: 80 };

/** run modifiers from Burrow Lore (the meta tree); all neutral by default */
export interface Perks {
  startCash: number; startLives: number; sellBack: number; bonusMul: number; incomeMul: number;
  heroCostMul: number; heroStartLvl: number; heroXpMul: number; cdMul: number; secondWind: number;
  costMul: Partial<Record<TowerId, number>>; rangeMul: Partial<Record<TowerId, number>>; rateMul: Partial<Record<TowerId, number>>;
  pierce: Partial<Record<TowerId, number>>; bossMul: Partial<Record<TowerId, number>>; upgradeMul: Partial<Record<TowerId, number>>;
  freeTier: Partial<Record<TowerId, [number, number]>>;
}
export function noPerks(): Perks {
  return { startCash: 0, startLives: 0, sellBack: 0, bonusMul: 1, incomeMul: 1, heroCostMul: 1, heroStartLvl: 1, heroXpMul: 1, cdMul: 1, secondWind: 0, costMul: {}, rangeMul: {}, rateMul: {}, pierce: {}, bossMul: {}, upgradeMul: {}, freeTier: {} };
}

export interface RunConfig {
  map: string; diff: Diff; mode: Mode; seed: number; assist: boolean;
  hero: HeroId | null; skin?: string;
  perks?: Perks;
  /** highest tier unlocked per tower per path (meta tower XP); default all 5 */
  unlocked?: Partial<Record<TowerId, [number, number, number]>>;
  /** tower kinds that may be built (player level, Single Kind, daily) */
  allowed?: TowerId[];
  /** daily overrides */
  startRound?: number; lastRound?: number; startCash?: number; lives?: number;
  /** the daily challenge's day key */
  daily?: string;
}

export interface Puff {
  id: number; kind: PuffKind; hp: number; road: number; d: number; x: number; y: number;
  night: boolean; fog: boolean; fort: boolean; fogTop: PuffKind;
  lastHit: number; slowMul: number; slowT: number; slowBoss: boolean;
  frozenT: number; stunT: number; burnDps: number; burnT: number; burnBy: number;
  dot: number; dotBoss: boolean; dotBy: number; brittle: number; acc: number; dead: boolean; born: number;
}
export interface Proj {
  id: number; kind: 'shot' | 'lob' | 'shard'; x: number; y: number; vx: number; vy: number; life: number;
  tower: number; atk: number; pierce: number; bounce: number; hits: number[]; target: number;
  tx: number; ty: number; sx: number; sy: number; t: number; T: number; art: string;
}
export interface Tower {
  id: number; def: TowerId | 'hero'; x: number; y: number; tiers: [number, number, number]; target: Target;
  s: Stats; cd: number[]; abilityCd: number[]; pops: number; dmg: number; spent: number;
  frenzyT: number; frenzyMul: number; rallyT: number; rallyMul: number;
  fx: number; fy: number; fa: number; lastAtk: number; lastAtkId: string; aimX: number; aimY: number; placedRound: number;
  buff: { rate: number; pierce: number; dmg: number; range: number; sight: boolean; boss: number };
}
export type Fx =
  | { t: 'pop'; x: number; y: number; kind: PuffKind; big: boolean }
  | { t: 'clink'; x: number; y: number }
  | { t: 'leak'; x: number; y: number; n: number }
  | { t: 'atk'; tower: number; atk: string; x: number; y: number; tx: number; ty: number; kind: string }
  | { t: 'ability'; id: string; x: number; y: number }
  | { t: 'cash'; x: number; y: number; n: number }
  | { t: 'level'; lvl: number }
  | { t: 'round'; n: number };

export interface Spawn { at: number; kind: PuffKind; night: boolean; fog: boolean; fort: boolean; road: number }

export class Game {
  cfg: RunConfig; map: MapDef; roads: Road[]; perks: Perks;
  t = 0; round: number; lastRound: number; cash: number; lives: number; startLives: number;
  puffs: Puff[] = []; projs: Proj[] = []; towers: Tower[] = []; fx: Fx[] = [];
  spawns: Spawn[] = []; roundT = 0; active = false; auto = false;
  over: '' | 'won' | 'lost' = ''; freeplay = false; secondChances: number;
  nextId = 1; r: () => number; heroXp = 0; heroLvl = 1; heroCdBoost = 0;
  floodT = 0; floodMul = 1; floodDot = 0; rallyAllT = 0; rallyAllMul = 1;
  stats = { pops: 0, leaked: 0, livesLost: 0, cashEarned: 0, abilities: 0, placed: {} as Record<string, number>, maxTier: 0, bossPops: 0, roundsWon: 0, towerXp: {} as Record<string, number> };
  quiet = false;

  constructor(cfg: RunConfig) {
    this.cfg = cfg; this.map = MAP[cfg.map]; this.r = rng(cfg.seed);
    const endless = cfg.mode === 'endless';
    this.perks = endless ? noPerks() : cfg.perks ?? noPerks();
    const rev = cfg.mode === 'reverse';
    this.roads = this.map.roads.map(w => buildRoad(w, rev));
    this.round = cfg.startRound ?? (endless ? 6 : 1);
    this.lastRound = cfg.lastRound ?? (endless ? 100 : LAST_ROUND[cfg.diff]);
    const assistLives = cfg.assist && !endless ? 1.5 : 1;
    this.startLives = cfg.lives ?? (endless ? 50 : Math.round((START_LIVES[cfg.diff] + this.perks.startLives) * assistLives));
    this.lives = this.startLives;
    this.cash = cfg.startCash ?? (650 + this.perks.startCash + (endless ? 1200 : 0));
    this.secondChances = endless ? 0 : (cfg.assist ? 1 : 0) + this.perks.secondWind;
    this.heroXp = 0;
    if (cfg.hero) { this.heroLvl = Math.max(1, this.perks.heroStartLvl); this.heroXp = heroXpFor(this.heroLvl); }
  }

  // ── what may be built
  allowed(def: TowerId): boolean {
    const c = this.cfg;
    if (c.allowed && !c.allowed.includes(def)) return false;
    if (c.mode === 'lean' && TOWER[def].income) return false;
    return true;
  }
  tierCap(def: TowerId, path: number): number { return this.cfg.unlocked?.[def]?.[path] ?? 5; }
  discountAt(x: number, y: number): number {
    let d = 0;
    for (const t of this.towers) if (t.s.discount > 0 && Math.hypot(t.x - x, t.y - y) <= t.s.aura) d = Math.max(d, t.s.discount);
    return d;
  }
  price(def: TowerId, x?: number, y?: number): number {
    const base = TOWER[def].cost * COST_MUL[this.cfg.diff] * (this.perks.costMul[def] ?? 1);
    const disc = x === undefined ? 0 : this.discountAt(x, y!);
    return Math.round(base * (1 - disc) / 5) * 5;
  }
  heroPrice(): number { return this.cfg.hero ? Math.round(HEROES[this.cfg.hero].cost * COST_MUL[this.cfg.diff] * this.perks.heroCostMul / 5) * 5 : 0; }
  upgradePrice(t: Tower, path: number): number {
    if (t.def === 'hero') return 0;
    const u = TOWER[t.def].paths[path][t.tiers[path]]; if (!u) return 0;
    const free = this.perks.freeTier[t.def];
    if (free && free[0] === path && t.tiers[path] < free[1]) return 0;
    const disc = this.discountAt(t.x, t.y);
    return Math.round(u.cost * COST_MUL[this.cfg.diff] * (this.perks.upgradeMul[t.def] ?? 1) * (1 - disc) / 5) * 5;
  }
  /** '' when the tower may stand here, else why not */
  placeReason(def: TowerId | 'hero', x: number, y: number): string {
    const r = def === 'hero' ? HEROES[this.cfg.hero!].r : TOWER[def].r;
    const where = def === 'hero' ? 'land' : TOWER[def].place;
    if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return 'Off the map';
    if (distToRoads(this.roads, x, y) < ROAD_W / 2 + r - 6) return 'On the road';
    for (const [cx, cy, cr] of this.map.blockers) if (Math.hypot(x - cx, y - cy) < cr + r * 0.6) return 'Blocked by rocks or trees';
    for (const [cx, cy, cr] of this.map.noBuild) if (Math.hypot(x - cx, y - cy) < cr) return 'Can\'t build here';
    for (const t of this.towers) {
      const tr = t.def === 'hero' ? HEROES[this.cfg.hero!].r : TOWER[t.def].r;
      if (Math.hypot(t.x - x, t.y - y) < tr + r - 4) return 'Too close to another tower';
    }
    const wet = isWater(this.map, x, y);
    if (where === 'water' && !wet) return 'Must float on water';
    if (where === 'land' && wet) return 'Can\'t stand in water';
    return '';
  }
  hero(): Tower | undefined { return this.towers.find(t => t.def === 'hero'); }

  // ── commands
  place(def: TowerId | 'hero', x: number, y: number): Tower | string {
    if (this.over && !this.freeplay) return 'The run is over';
    if (def === 'hero') {
      if (!this.cfg.hero) return 'No hero chosen';
      if (this.hero()) return 'Your hero is already out';
    } else if (!this.allowed(def)) return 'Not allowed in this run';
    const why = this.placeReason(def, x, y); if (why) return why;
    const cost = def === 'hero' ? this.heroPrice() : this.price(def, x, y);
    if (cost > this.cash) return 'Not enough coins';
    this.cash -= cost;
    const t: Tower = {
      id: this.nextId++, def, x, y, tiers: [0, 0, 0], target: 'first', s: null as unknown as Stats, cd: [], abilityCd: [], pops: 0, dmg: 0, spent: cost,
      frenzyT: 0, frenzyMul: 1, rallyT: 0, rallyMul: 1, fx: x, fy: y, fa: 0, lastAtk: -9, lastAtkId: '', aimX: x, aimY: y - 10, placedRound: this.round,
      buff: { rate: 1, pierce: 0, dmg: 0, range: 1, sight: false, boss: 0 },
    };
    if (def !== 'hero') {
      const free = this.perks.freeTier[def];
      if (free) for (let i = 0; i < free[1]; i++) if (canBuyTier(t.tiers, free[0]) && t.tiers[free[0]] < this.tierCap(def, free[0])) t.tiers[free[0]]++;
    }
    this.towers.push(t);
    this.restat(t);
    this.stats.placed[def] = (this.stats.placed[def] ?? 0) + 1;
    this.rebuff();
    return t;
  }
  upgradeReason(t: Tower, path: number): string {
    if (t.def === 'hero') return 'Heroes level up by themselves';
    const why = crosspathReason(t.tiers, path); if (why) return why;
    if (t.tiers[path] >= this.tierCap(t.def, path)) return `Tier ${t.tiers[path] + 1} is locked: earn ${TOWER[t.def].name} XP and unlock it in the Tower Lab`;
    if (this.cfg.mode === 'lean' && incomeUpgrade(t.def, path)) return 'No income upgrades in Lean Harvest';
    if (this.upgradePrice(t, path) > this.cash) return 'Not enough coins';
    return '';
  }
  upgrade(id: number, path: number): string {
    const t = this.towers.find(x => x.id === id); if (!t) return 'No tower';
    const why = this.upgradeReason(t, path); if (why) return why;
    const cost = this.upgradePrice(t, path);
    this.cash -= cost; t.spent += cost; t.tiers[path]++;
    this.stats.maxTier = Math.max(this.stats.maxTier, t.tiers[path]);
    this.restat(t); this.rebuff();
    return '';
  }
  sellValue(t: Tower): number {
    const bonus = Math.min(0.1, this.towers.reduce((a, x) => a + x.s.sellBonus, 0));
    const frac = Math.min(0.95, 0.7 + this.perks.sellBack + bonus);
    return Math.floor(t.spent * frac);
  }
  sell(id: number): number {
    const i = this.towers.findIndex(x => x.id === id); if (i < 0) return 0;
    const v = this.sellValue(this.towers[i]);
    this.cash += v; this.towers.splice(i, 1); this.rebuff();
    return v;
  }
  setTarget(id: number, target: Target) { const t = this.towers.find(x => x.id === id); if (t) t.target = target; }
  /** the abilities a tower can use right now: its own plus the hero's */
  abilities(t: Tower): Ability[] {
    if (t.def === 'hero') return heroStats(this.cfg.hero!, this.heroLvl).h.abilities;
    return t.s.ability ? [t.s.ability] : [];
  }
  useAbility(id: number, i = 0): string {
    const t = this.towers.find(x => x.id === id); if (!t) return 'No tower';
    const ab = this.abilities(t)[i]; if (!ab) return 'No ability';
    if ((t.abilityCd[i] ?? 0) > 0) return 'Still recharging';
    if (!this.active && ab.kind !== 'cash' && ab.kind !== 'lives') return 'Wait for the round to start';
    t.abilityCd[i] = ab.cd * this.perks.cdMul;
    this.stats.abilities++;
    fireAbility(this, t, ab);
    return '';
  }
  startRound(): boolean {
    if (this.active || (this.over && !this.freeplay)) return false;
    this.active = true; this.roundT = 0;
    const groups = roundGroups(this.round, this.cfg.seed);
    const nightfall = this.cfg.mode === 'nightfall';
    this.spawns = [];
    let k = 0;
    for (const g of groups) for (let i = 0; i < g.count; i++) {
      this.spawns.push({ at: g.start + i * g.gap, kind: g.kind, night: g.night || PUFFS[g.kind].night === true || nightfall, fog: g.fog, fort: g.fort, road: (k++) % this.roads.length });
    }
    this.spawns.sort((a, b) => a.at - b.at);
    this.emit({ t: 'round', n: this.round });
    return true;
  }

  // ── time
  step(dt = DT) {
    if (this.over === 'lost') return;
    this.t += dt;
    if (this.active) {
      this.roundT += dt;
      while (this.spawns.length && this.spawns[0].at <= this.roundT) {
        const s = this.spawns.shift()!;
        this.spawnPuff(s.kind, s.road, 0, s.night, s.fog, s.fort, s.kind);
      }
    }
    simTick(this, dt);
    if (this.active && !this.spawns.length && !this.puffs.length) this.endRound();
  }
  spawnPuff(kind: PuffKind, road: number, d: number, night: boolean, fog: boolean, fort: boolean, fogTop: PuffKind): Puff {
    const [x, y] = roadAt(this.roads[road], d);
    const p: Puff = {
      id: this.nextId++, kind, hp: shellHp(kind, fort, bossScale(this.round)), road, d, x, y, night, fog, fort, fogTop,
      lastHit: this.t, slowMul: 1, slowT: 0, slowBoss: false, frozenT: 0, stunT: 0, burnDps: 0, burnT: 0, burnBy: 0,
      dot: 0, dotBoss: false, dotBy: 0, brittle: 0, acc: 0, dead: false, born: this.t,
    };
    this.puffs.push(p);
    return p;
  }
  /** lives a puff costs if it reaches the festival */
  leakCost(p: Puff): number {
    let n = Math.max(1, Math.ceil(p.hp));
    for (const c of PUFFS[p.kind].children) n += layers(c, p.fort && PUFFS[c].hp > 1, bossScale(this.round));
    return n;
  }
  leak(p: Puff) {
    const n = this.leakCost(p);
    this.lives -= n; this.stats.leaked++; this.stats.livesLost += n;
    this.emit({ t: 'leak', x: p.x, y: p.y, n });
    if (this.lives <= 0) {
      if (this.secondChances > 0) {
        this.secondChances--; this.lives = Math.ceil(this.startLives / 2);
        this.puffs = this.puffs.filter(q => PUFFS[q.kind].boss !== true || q === p);
        this.emit({ t: 'ability', id: 'secondwind', x: WORLD_W / 2, y: WORLD_H / 2 });
      } else { this.lives = 0; this.over = 'lost'; this.active = false; }
    }
  }
  endRound() {
    this.active = false;
    const lean = this.cfg.mode === 'lean';
    let bonus = roundBonus(this.round) * this.perks.bonusMul * (lean ? 0.5 : 1) * (this.cfg.assist ? 1.2 : 1);
    let income = 0, interest = 0, lives = 0;
    for (const t of this.towers) { income += t.s.income; interest = Math.max(interest, t.s.interest); lives += t.s.lives; }
    income *= this.perks.incomeMul;
    const int = Math.min(1000, Math.floor(this.cash * interest));
    bonus = Math.round(bonus + income + int);
    this.cash += bonus; this.stats.cashEarned += bonus;
    this.lives += lives;
    if (this.cfg.hero && this.hero()) this.gainHeroXp((40 + 12 * this.round) * this.perks.heroXpMul);
    this.stats.roundsWon++;
    this.emit({ t: 'cash', x: WORLD_W - 120, y: 60, n: bonus });
    for (const t of this.towers) t.abilityCd = t.abilityCd.map(c => Math.max(0, c - 3));
    if (this.round >= this.lastRound && !this.freeplay) { this.over = 'won'; }
    this.round++;
    if (this.auto && !(this.over === 'won' && !this.freeplay)) this.startRound();
  }
  continueFreeplay() { if (this.over === 'won') { this.freeplay = true; this.over = ''; } }
  gainHeroXp(n: number) {
    if (!this.cfg.hero) return;
    this.heroXp += n;
    const l = Math.max(this.heroLvl, heroLevelFor(this.heroXp));
    if (l !== this.heroLvl) {
      this.heroLvl = l; this.emit({ t: 'level', lvl: l });
      const h = this.hero(); if (h) { this.restat(h); this.rebuff(); }
    }
  }

  // ── stats
  restat(t: Tower) {
    let s: Stats;
    if (t.def === 'hero') s = heroStats(this.cfg.hero!, this.heroLvl).s;
    else {
      const d = TOWER[t.def]; s = d.base();
      for (let p = 0; p < 3; p++) for (let i = 0; i < t.tiers[p]; i++) d.paths[p][i].fx(s);
      const P = this.perks, id = t.def;
      for (const a of s.atks) {
        a.range *= P.rangeMul[id] ?? 1; a.rate *= P.rateMul[id] ?? 1; a.pierce += P.pierce[id] ?? 0; a.bossMult *= P.bossMul[id] ?? 1;
      }
      if (s.chill) s.chill = [s.chill[0], s.chill[1] * (P.rangeMul[id] ?? 1)];
    }
    t.s = s;
    while (t.cd.length < s.atks.length) t.cd.push(0);
    const nab = this.abilities(t).length;
    while (t.abilityCd.length < nab) t.abilityCd.push(t.def === 'hero' ? 8 : 10);
  }
  /** support auras: who is in whose glow */
  rebuff() {
    for (const t of this.towers) {
      const b = { rate: 1, pierce: 0, dmg: 0, range: 1, sight: false, boss: 0 };
      for (const o of this.towers) {
        if (o === t || o.s.aura <= 0) continue;
        if (Math.hypot(o.x - t.x, o.y - t.y) > o.s.aura) continue;
        b.rate *= o.s.auraRate; b.pierce += o.s.auraPierce; b.dmg += o.s.auraDmg; b.range = Math.max(b.range, o.s.auraRangeMul);
        b.boss += o.s.auraBoss; if (o.s.auraSight) b.sight = true;
      }
      b.rate = Math.max(0.55, b.rate);
      t.buff = b;
    }
  }
  sees(t: Tower): boolean { return t.s.sight || t.buff.sight; }
  emit(f: Fx) { if (!this.quiet) this.fx.push(f); }
  /** totals for the HUD */
  incomePerRound(): number { return Math.round(this.towers.reduce((a, t) => a + t.s.income, 0) * this.perks.incomeMul); }
  layersLeft(): number { return this.puffs.reduce((a, p) => a + this.leakCost(p), 0) + this.spawns.reduce((a, s) => a + layers(s.kind, s.fort, bossScale(this.round)), 0); }
}

export function heroXpFor(lvl: number): number {
  let x = 0; for (let l = 2; l <= lvl; l++) x += Math.round(180 * Math.pow(l - 1, 1.55));
  return x;
}
export function incomeUpgrade(def: TowerId, path: number): boolean {
  return (def === 'boat' && path === 2) || (def === 'lantern' && path === 2) || def === 'quinoa';
}
export const ALL_TOWERS: TowerId[] = TOWERS.map(t => t.id);
export { AUTHORED };

/** an ability goes off */
export function fireAbility(g: Game, t: Tower, ab: Ability) {
  g.emit({ t: 'ability', id: ab.id, x: t.x, y: t.y });
  const strongest = (n: number) => [...g.puffs].filter(p => !p.dead).sort((a, b) => (PUFFS[b.kind].boss ? 1e6 : 0) + b.hp + b.d * 1e-3 - ((PUFFS[a.kind].boss ? 1e6 : 0) + a.hp + a.d * 1e-3)).slice(0, n);
  const near = (r: number) => g.puffs.filter(p => !p.dead && (r <= 0 || Math.hypot(p.x - t.x, p.y - t.y) <= r));
  switch (ab.kind) {
    case 'frenzy': t.frenzyT = ab.dur; t.frenzyMul = 1 / ab.power; break;
    case 'nova':
      for (const p of near(ab.radius)) {
        if (ab.id === 'moonrise' || ab.id === 'clear') p.night = false;
        if (ab.id === 'clear') p.fog = false;
        damage(g, p, ab.power, 'magic', t, 1, false);
      }
      break;
    case 'strike': {
      if (ab.id === 'swell') { for (const p of strongest(ab.radius)) damage(g, p, ab.power, 'magic', t, 1, false); break; }
      const [top] = strongest(1); if (!top) break;
      const x = top.x, y = top.y;
      damage(g, top, ab.power, 'magic', t, 1, false);
      if (ab.id === 'megabale') for (const p of g.puffs) if (!p.dead && Math.hypot(p.x - x, p.y - y) < ab.radius) damage(g, p, 300, 'magic', t, 1, false);
      if (ab.id === 'rod') for (const p of strongest(ab.radius)) damage(g, p, ab.power / 10, 'magic', t, 1, false);
      g.emit({ t: 'ability', id: ab.id + '-hit', x, y });
      break;
    }
    case 'freeze':
      for (const p of near(ab.radius)) {
        if (PUFFS[p.kind].noChill) continue;
        p.frozenT = Math.max(p.frozenT, PUFFS[p.kind].boss ? ab.dur * 0.4 : ab.dur);
      }
      break;
    case 'blowback':
      for (const p of g.puffs) p.d = Math.max(0, p.d - (PUFFS[p.kind].boss ? 120 : ab.power));
      break;
    case 'cash': {
      const n = ab.power > 0 ? ab.power : -ab.power * g.round;
      g.cash += n; g.stats.cashEarned += n; if (ab.dur) g.lives += ab.dur;
      g.emit({ t: 'cash', x: t.x, y: t.y - 40, n });
      break;
    }
    case 'lives': g.lives += ab.power; break;
    case 'rally':
      if (ab.radius === 1) { for (const o of g.towers) if (Math.hypot(o.x - t.x, o.y - t.y) <= t.s.aura) { o.rallyT = ab.dur; o.rallyMul = ab.power; } }
      else { g.rallyAllT = ab.dur; g.rallyAllMul = ab.power; }
      break;
    case 'reveal':
      for (const p of g.puffs) { p.night = false; p.fog = false; }
      g.rallyAllT = ab.dur; g.rallyAllMul = ab.power;
      break;
    case 'rockslide':
      for (const p of [...g.puffs]) if (!p.dead) damage(g, p, ab.power, 'heavy', t, 1, false);
      break;
    case 'flood':
      g.floodT = ab.dur; g.floodMul = ab.power; g.floodDot = ab.id === 'flood' ? 2 : 0;
      break;
    case 'stampede':
      for (const p of [...g.puffs]) if (!p.dead) { damage(g, p, ab.power, 'heavy', t, 1, false); if (!PUFFS[p.kind].boss) p.d = Math.max(0, p.d - 150); }
      break;
    case 'snatch': break;
  }
}
