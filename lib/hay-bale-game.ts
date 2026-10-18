// Hay Bale Brawl: the rules of an auto-battler run. Deterministic and DOM-free: a run is a seed plus the choices made,
// every random draw comes from a seeded generator, and a fight is worked out in one go into a list of events the page
// replays.
import {
  UNITS, UNIT_IDS, SNACKS, SNACK_IDS, TOKENS, isUnitId, isTokenId, some,
  type Unit, type UnitId, type SnackId, type Status, type TokenId, type Ctx, type Trigger, type Level, type Tier,
} from './hay-bale-units.js';

export * from './hay-bale-units.js';

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


export type Coach = 'dora' | 'enzo';
/** A fight's result from the left side's view. */
export type Result = 'win' | 'loss' | 'draw';
/** What the page replays. `hit` and `buff` carry the unit's new totals; `line` is a side's order after closing up. */
export type FightEvent =
  | { k: 'ability'; uid: number } | { k: 'attack'; uid: number } | { k: 'hit'; uid: number; dmg: number; h: number }
  | { k: 'buff'; uid: number; a: number; h: number } | { k: 'status'; uid: number; status: Status } | { k: 'faint'; uid: number }
  | { k: 'summon'; side: 0 | 1; at: number; unit: Unit } | { k: 'line'; side: 0 | 1; uids: number[] } | { k: 'end'; result: Result };

export const MAX_STAT = 50, MAX_ROUNDS = 200, LINE = 5;

/** A 32-bit hash of two numbers, for every seed derived from another. */
export function mix(a: number, b: number) {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Works out a whole fight. The lines are front first, without holes, and are not changed: the fight plays on copies
 * whose uids match, so the events name the units the page is drawing. A Raisin's `tmpA` counts as attack here.
 */
export function fight(left: Unit[], right: Unit[], seed: number, coach: Coach | null) {
  const lines: Unit[][] = [left, right].map((l) => l.map((u) => ({ ...u, a: clamp(u.a + u.tmpA, 0, MAX_STAT), tmpA: 0 })));
  const sideOf = new Map<number, 0 | 1>();
  lines.forEach((l, s) => l.forEach((u) => sideOf.set(u.uid, s as 0 | 1)));
  const events: FightEvent[] = [], rand = new Rand(seed), fainted = new Set<number>();
  let uid = Math.max(0, ...[...left, ...right].map((u) => u.uid)) + 1, queue: { u: Unit; on: Trigger; other: Unit | null }[] = [], fired = false;
  const side = (u: Unit) => sideOf.get(u.uid)!;
  const living = (s: number) => lines[s].filter((u) => u.h > 0);
  const fire = (u: Unit, on: Trigger, other: Unit | null = null) => { if (UNITS[u.id as keyof typeof UNITS]?.on === on) queue.push({ u, on, other }); };
  const near = (u: Unit, d: 1 | -1) => {
    const l = lines[side(u)];
    for (let i = l.indexOf(u) + d; i >= 0 && i < l.length; i += d) if (l[i].h > 0) return l[i];
    return null;
  };
  const ctx: Ctx = {
    rand,
    friends: (u) => living(side(u)).filter((x) => x !== u),
    enemies: (u) => living(1 - side(u)),
    ahead: (u) => near(u, -1),
    behind: (u) => near(u, 1),
    buff(u, a, h) {
      if (u.h <= 0) return;
      const na = clamp(u.a + a, 0, MAX_STAT), nh = clamp(u.h + h, 1, MAX_STAT);
      if (na === u.a && nh === u.h) return;
      u.a = na; u.h = nh;
      events.push({ k: 'buff', uid: u.uid, a: u.a, h: u.h });
    },
    damage(u, n) {
      if (u.h <= 0 || n <= 0) return;
      let dmg = n;
      if (u.status === 'shell') { dmg = 1; u.status = null; events.push({ k: 'status', uid: u.uid, status: null }); }
      else if (u.status === 'mint') dmg = Math.max(1, n - 1);
      u.h = Math.max(0, u.h - dmg);
      events.push({ k: 'hit', uid: u.uid, dmg, h: u.h });
      if (u.h > 0) fire(u, 'hurt');
    },
    status(u, s) { if (u.h <= 0) return; u.status = s; events.push({ k: 'status', uid: u.uid, status: s }); },
    summon(at, id: TokenId, a, h) {
      const s = side(at), l = lines[s];
      if (living(s).length >= LINE) return;
      const unit: Unit = { uid: uid++, id, a: clamp(a, 0, MAX_STAT), h: clamp(h, 1, MAX_STAT), level: 1, xp: 0, status: null, tmpA: 0 };
      const i = Math.max(0, l.indexOf(at));
      l.splice(i, 0, unit); sideOf.set(unit.uid, s);
      events.push({ k: 'summon', side: s, at: l.slice(0, i).filter((x) => x.h > 0).length, unit: { ...unit } });
      for (const f of living(s)) if (f !== unit) fire(f, 'friendSummoned', unit);
    },
    acorns() {},
    snackDiscount() {},
  };
  /** Runs queued abilities a batch at a time, highest attack first, ties left first then front-most; then faints. */
  const settle = () => {
    for (let pass = 0; pass < 100; pass++) {
      for (const s of [0, 1]) for (const u of lines[s]) {
        if (u.h > 0 || fainted.has(u.uid)) continue;
        fainted.add(u.uid);
        events.push({ k: 'faint', uid: u.uid });
        fire(u, 'faint');
        const back = near(u, 1);
        if (back) fire(back, 'friendAheadFaints', u);
        for (const f of living(s)) fire(f, 'friendFaints', u);
      }
      if (!queue.length) break;
      const batch = queue; queue = [];
      batch.sort((x, y) => y.u.a - x.u.a || side(x.u) - side(y.u) || lines[side(x.u)].indexOf(x.u) - lines[side(y.u)].indexOf(y.u));
      for (const { u, on, other } of batch) {
        if (u.h <= 0 && on !== 'faint') continue;
        fired = true;
        events.push({ k: 'ability', uid: u.uid });
        UNITS[u.id as keyof typeof UNITS].run(ctx, u, u.level, other);
      }
    }
    for (const s of [0, 1] as const) {
      if (lines[s].every((u) => u.h > 0)) continue;
      lines[s] = living(s);
      events.push({ k: 'line', side: s, uids: lines[s].map((u) => u.uid) });
    }
  };

  if (coach === 'dora' && lines[0][0]) ctx.buff(lines[0][0], 0, 2);
  for (const s of [0, 1]) for (const u of lines[s]) fire(u, 'startBattle');
  settle();
  let rounds = 0, stalled = false;
  while (lines[0].length && lines[1].length && rounds < MAX_ROUNDS) {
    rounds++; fired = false;
    fire(lines[0][0], 'beforeAttack'); fire(lines[1][0], 'beforeAttack');
    settle();
    if (!lines[0].length || !lines[1].length) break;
    const [l, r] = [lines[0][0], lines[1][0]];
    if (l.a <= 0 && r.a <= 0 && !fired) { stalled = true; break; }
    const [lBack, rBack] = [lines[0][1], lines[1][1]];
    events.push({ k: 'attack', uid: l.uid }, { k: 'attack', uid: r.uid });
    ctx.damage(r, l.a); ctx.damage(l, r.a);
    if (l.status === 'chilli' && rBack) ctx.damage(rBack, 2);
    if (r.status === 'chilli' && lBack) ctx.damage(lBack, 2);
    if (l.h > 0 && r.h <= 0) fire(l, 'knockOut', r);
    if (r.h > 0 && l.h <= 0) fire(r, 'knockOut', l);
    settle();
  }
  const result: Result = stalled || (!lines[0].length && !lines[1].length) || (lines[0].length && lines[1].length) ? 'draw' : lines[0].length ? 'win' : 'loss';
  events.push({ k: 'end', result });
  return { result, events, rounds };
}

// ── The shop and the run ──────────────────────────────────────────────────────

export const START_ACORNS = 10, UNIT_COST = 3, SNACK_COST = 3, ROLL_COST = 1, HEARTS = 5, BALES = 10, MAX_XP = 5;
export const SAVE_VERSION = 1;
/** The highest tier the shop offers on a turn: tier 1 on turns 1–2, tier 2 on 3–4, and so on up to 5. */
export const shopTier = (turn: number) => Math.min(5, 1 + Math.floor((turn - 1) / 2)) as Tier;
/** How many unit and snack slots the shop has on a turn. */
export const slotCounts = (turn: number): [number, number] => (turn <= 4 ? [3, 1] : turn <= 8 ? [4, 1] : [5, 2]);
export const levelOf = (xp: number): Level => (xp >= 5 ? 3 : xp >= 2 ? 2 : 1);

export type Slot = { kind: 'unit'; unit: Unit; frozen: boolean } | { kind: 'snack'; snack: SnackId; cost: number; frozen: boolean };
export type Phase = 'shop' | 'over' | 'won';
/** A fought turn: the result, the events to replay, the rival, and the line that fought. */
export type Outcome = { result: Result; events: FightEvent[]; rival: { name: string; line: Unit[] }; left: Unit[] };
export type RunOptions = { acorns?: number; fights?: boolean; rival?: (seed: number, turn: number) => Unit[] };

const SUFFIX = ['Bunch', 'Gang', 'Crew', 'Lot'];
const nameOf = (u: Unit) => (isUnitId(u.id) ? UNITS[u.id].name : TOKENS[u.id as TokenId].name);
/** A rival crew's name, after its strongest unit (the front-most on a tie). */
export function crewName(line: Unit[], turn: number) {
  let best: Unit | null = null;
  for (const u of line) if (!best || u.a + u.h > best.a + best.h) best = u;
  if (!best) return 'An empty bale';
  const name = nameOf(best);
  return `${name.startsWith('The ') ? name : `The ${name}`}'s ${SUFFIX[turn % SUFFIX.length]}`;
}


export class Run {
  turn = 0; acorns = 0; hearts = HEARTS; bales = 0; phase: Phase = 'shop';
  line: (Unit | null)[] = [null, null, null, null, null];
  units: (Slot | null)[] = []; snacks: (Slot | null)[] = [];
  freeRoll = false; discount = 0; nextUid = 1; perTurn: number;
  last: Outcome | null = null;
  rand: Rand;
  private fights: boolean;
  private rival: (seed: number, turn: number) => Unit[];
  private ctx: Ctx;

  constructor(public seed: number, public coach: Coach | null, opt: RunOptions = {}) {
    this.rand = new Rand(seed);
    this.perTurn = opt.acorns ?? START_ACORNS;
    this.fights = opt.fights !== false;
    this.rival = opt.rival ?? ghost;
    const run = this, filled = () => run.line.filter((u): u is Unit => u !== null);
    this.ctx = {
      rand: this.rand,
      friends: (u) => filled().filter((x) => x !== u),
      enemies: () => [],
      ahead: (u) => { for (let i = run.line.indexOf(u) - 1; i >= 0; i--) if (run.line[i]) return run.line[i]; return null; },
      behind: (u) => { for (let i = run.line.indexOf(u) + 1; i < LINE; i++) if (run.line[i]) return run.line[i]; return null; },
      buff(u, a, h) { u.a = clamp(u.a + a, 0, MAX_STAT); u.h = clamp(u.h + h, 1, MAX_STAT); },
      damage() {},
      status(u, st) { u.status = st; },
      summon() {},
      acorns(n) { run.acorns += n; },
      snackDiscount(n) { run.discount += n; run.reprice(); },
    };
    this.startTurn();
  }

  /** A fresh unit with its base stats and a uid of this run's. */
  spawn(id: UnitId): Unit {
    const d = UNITS[id];
    return { uid: this.nextUid++, id, a: d.a, h: d.h, level: 1, xp: 0, status: null, tmpA: 0 };
  }
  get tier() { return shopTier(this.turn); }
  get snackCost() { return Math.max(0, SNACK_COST - this.discount); }

  private fire(u: Unit, on: Trigger, other: Unit | null = null) {
    if (isUnitId(u.id) && UNITS[u.id].on === on) UNITS[u.id].run(this.ctx, u, u.level, other);
  }
  private newUnit(tier: number): Slot {
    return { kind: 'unit', unit: this.spawn(this.rand.pick(UNIT_IDS.filter((id) => UNITS[id].tier <= tier))), frozen: false };
  }
  private newSnack(): Slot {
    return { kind: 'snack', snack: this.rand.pick(SNACK_IDS.filter((id) => SNACKS[id].tier <= this.tier)), cost: this.snackCost, frozen: false };
  }
  private reprice() { for (const s of this.snacks) if (s?.kind === 'snack') s.cost = this.snackCost; }
  /** Fills every slot that isn't frozen; bonus slots past the turn's count stay only while frozen. */
  private refill() {
    const [nu, ns] = slotCounts(this.turn);
    const units: (Slot | null)[] = [], snacks: (Slot | null)[] = [];
    for (let i = 0; i < Math.max(nu, this.units.length); i++) {
      const s = this.units[i];
      if (s?.frozen) units.push(s); else if (i < nu) units.push(this.newUnit(this.tier));
    }
    for (let i = 0; i < ns; i++) { const s = this.snacks[i]; snacks.push(s?.frozen ? s : this.newSnack()); }
    this.units = units; this.snacks = snacks;
    this.reprice();
  }
  private startTurn() {
    this.turn++;
    this.acorns = this.perTurn; this.freeRoll = this.coach === 'enzo'; this.discount = 0;
    this.refill();
    for (const u of this.line.slice()) if (u) this.fire(u, 'startTurn');
  }
  /** Merges `other` into `into`: the higher stats +1/+1 and its copies as experience. A new level adds a bonus unit. */
  private merge(into: Unit, other: Unit) {
    into.a = clamp(Math.max(into.a, other.a) + 1, 0, MAX_STAT);
    into.h = clamp(Math.max(into.h, other.h) + 1, 1, MAX_STAT);
    this.gain(into, 1 + other.xp);
  }
  private gain(u: Unit, xp: number) {
    const was = u.level;
    u.xp = Math.min(MAX_XP, u.xp + xp); u.level = levelOf(u.xp);
    if (u.level > was) {
      const tier = Math.min(5, this.tier + 1);
      this.units.push({ kind: 'unit', unit: this.spawn(this.rand.pick(UNIT_IDS.filter((id) => UNITS[id].tier === tier))), frozen: false });
    }
  }

  buy(i: number, to: number) {
    const slot = this.units[i], at = this.line[to];
    if (this.phase !== 'shop' || slot?.kind !== 'unit' || to < 0 || to >= LINE || this.acorns < UNIT_COST) return false;
    if (at && at.id !== slot.unit.id) return false;
    this.acorns -= UNIT_COST; this.units[i] = null;
    if (at) { this.merge(at, slot.unit); this.fire(at, 'buy'); }
    else { this.line[to] = slot.unit; this.fire(slot.unit, 'buy'); }
    return true;
  }
  feed(i: number, to: number) {
    const slot = this.snacks[i], at = this.line[to];
    if (this.phase !== 'shop' || slot?.kind !== 'snack' || !at || this.acorns < slot.cost) return false;
    this.acorns -= slot.cost; this.snacks[i] = null;
    const ate = slot.snack === 'hay' ? some(this.ctx, this.line.filter((u): u is Unit => u !== null), 2) : [at];
    for (const u of ate) {
      switch (slot.snack) {
        case 'apple': case 'hay': this.ctx.buff(u, 1, 1); break;
        case 'cake': this.ctx.buff(u, 3, 3); break;
        case 'raisin': u.tmpA += 3; break;
        case 'honey': u.status = 'shell'; break;
        case 'mint': u.status = 'mint'; break;
        case 'chilli': u.status = 'chilli'; break;
        case 'seed': this.gain(u, 1); break;
      }
      for (const f of this.line.slice()) if (f && f !== u) this.fire(f, 'friendAte', u);
    }
    return true;
  }
  sell(at: number) {
    const u = this.line[at];
    if (this.phase !== 'shop' || !u) return false;
    this.fire(u, 'sell');
    this.line[at] = null; this.acorns += u.level;
    return true;
  }
  move(from: number, to: number) {
    const a = this.line[from];
    if (this.phase !== 'shop' || !a || from === to || to < 0 || to >= LINE) return false;
    const b = this.line[to];
    if (b && b.id === a.id) { this.merge(b, a); this.line[from] = null; }
    else { this.line[to] = a; this.line[from] = b; }
    return true;
  }
  roll() {
    if (this.phase !== 'shop' || (!this.freeRoll && this.acorns < ROLL_COST)) return false;
    if (this.freeRoll) this.freeRoll = false; else this.acorns -= ROLL_COST;
    this.refill();
    return true;
  }
  freeze(kind: 'unit' | 'snack', i: number) {
    const s = (kind === 'unit' ? this.units : this.snacks)[i];
    if (this.phase !== 'shop' || !s) return false;
    s.frozen = !s.frozen;
    return true;
  }
  /** End-of-turn abilities, then (for a player) the fight, hearts and bales, and the next turn's shop. */
  endTurn(): Outcome | null {
    if (this.phase !== 'shop') return null;
    for (const u of this.line.slice()) if (u) this.fire(u, 'endTurn');
    if (!this.fights) { this.startTurn(); return null; }
    const left = this.line.filter((u): u is Unit => u !== null).map((u) => ({ ...u }));
    const rival = this.rival(mix(this.seed, GHOST_SEED), this.turn);
    const { result, events } = fight(left, rival, mix(this.seed, this.turn + 1000), this.coach);
    if (result === 'win') this.bales++; else if (result === 'loss') this.hearts--;
    for (const u of this.line) if (u) u.tmpA = 0;
    this.last = { result, events, rival: { name: crewName(rival, this.turn), line: rival }, left };
    if (this.hearts <= 0) this.phase = 'over';
    else if (this.bales >= BALES) this.phase = 'won';
    else this.startTurn();
    return this.last;
  }

  toJSON() {
    return {
      v: SAVE_VERSION, seed: this.seed, coach: this.coach, turn: this.turn, acorns: this.acorns, hearts: this.hearts, bales: this.bales,
      phase: this.phase, line: this.line, units: this.units, snacks: this.snacks, freeRoll: this.freeRoll, discount: this.discount,
      nextUid: this.nextUid, perTurn: this.perTurn, rand: this.rand.s, last: this.last && { ...this.last, events: [] },
    };
  }
  /** A saved run, or null for anything malformed, from another version or naming a unit that doesn't exist. */
  static load(raw: string | null): Run | null {
    try {
      const d = JSON.parse(raw ?? '');
      const int = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
      if (!d || d.v !== SAVE_VERSION || !int(d.seed, 0, 2 ** 32) || !['dora', 'enzo', null].includes(d.coach)) return null;
      if (!int(d.turn, 1, 99) || !int(d.acorns, 0, 999) || !int(d.hearts, 0, HEARTS) || !int(d.bales, 0, BALES) || !int(d.perTurn, 0, 99)) return null;
      if (!['shop', 'over', 'won'].includes(d.phase) || typeof d.freeRoll !== 'boolean' || !int(d.discount, 0, 99) || !int(d.nextUid, 1, 2 ** 31) || !int(d.rand, 0, 2 ** 32)) return null;
      const unit = (u: any) => u && int(u.uid, 1, 2 ** 31) && (isUnitId(u.id) || isTokenId(u.id)) && int(u.a, 0, MAX_STAT) && int(u.h, 1, MAX_STAT)
        && int(u.level, 1, 3) && int(u.xp, 0, MAX_XP) && ['shell', 'mint', 'chilli', null].includes(u.status) && int(u.tmpA, 0, MAX_STAT);
      const slot = (s: any) => s === null || (s && typeof s.frozen === 'boolean'
        && ((s.kind === 'unit' && unit(s.unit) && isUnitId(s.unit.id)) || (s.kind === 'snack' && SNACK_IDS.includes(s.snack) && int(s.cost, 0, SNACK_COST))));
      const last = d.last ?? null;
      if (last !== null && !(['win', 'loss', 'draw'].includes(last.result) && Array.isArray(last.events) && Array.isArray(last.left) && Array.isArray(last.rival?.line) && typeof last.rival.name === 'string')) return null;
      if (!Array.isArray(d.line) || d.line.length !== LINE || !d.line.every((u: any) => u === null || (unit(u) && isUnitId(u.id)))) return null;
      if (!Array.isArray(d.units) || d.units.length > 12 || !d.units.every(slot) || !Array.isArray(d.snacks) || d.snacks.length > 2 || !d.snacks.every(slot)) return null;
      const run = new Run(d.seed, d.coach, { acorns: d.perTurn });
      Object.assign(run, {
        turn: d.turn, acorns: d.acorns, hearts: d.hearts, bales: d.bales, phase: d.phase, line: d.line, units: d.units, snacks: d.snacks,
        freeRoll: d.freeRoll, discount: d.discount, nextUid: d.nextUid, last,
      });
      run.rand.s = d.rand;
      return run;
    } catch { return null; }
  }
}

// ── The buying policy, ghosts and the profile ─────────────────────────────────

export type Action =
  | { k: 'buy'; i: number; to: number } | { k: 'feed'; i: number; to: number } | { k: 'sell'; at: number }
  | { k: 'move'; from: number; to: number } | { k: 'roll' } | { k: 'freeze'; kind: 'unit' | 'snack'; i: number };

/** What the policy thinks each ability is worth per level, in stat points. It is the policy's taste, not a rule. */
export const WEIGHT = Object.fromEntries(UNIT_IDS.map((id) => [id, 2])) as Record<UnitId, number>;
/** What the policy thinks a snack adds, in stat points. */
const SNACK_WORTH: Record<SnackId, number> = { apple: 2, raisin: 1.5, honey: 3, hay: 4, mint: 4, chilli: 3, seed: 3, cake: 6 };
const unitWorth = (u: Unit) => u.a + u.h + (isUnitId(u.id) ? WEIGHT[u.id] * u.level : 0);
/** The policy's value of a line. */
export const worth = (line: (Unit | null)[]) => line.reduce((s, u) => s + (u ? unitWorth(u) : 0), 0);

/** The next shop action of a plain greedy player, or null to end the shop. Ghosts and the bot both use it. */
export function choose(run: Run): Action | null {
  if (run.phase !== 'shop') return null;
  const line = run.line, empty = line.indexOf(null);
  let best: Action | null = null, gain = 0;
  const offer = (a: Action, g: number) => { if (g > gain) { best = a; gain = g; } };
  if (run.acorns >= UNIT_COST) run.units.forEach((s, i) => {
    if (s?.kind !== 'unit') return;
    if (empty >= 0) offer({ k: 'buy', i, to: empty }, unitWorth(s.unit));
    line.forEach((u, to) => {
      if (u?.id !== s.unit.id) return;
      const xp = Math.min(MAX_XP, u.xp + 1), up = levelOf(xp) - u.level;
      offer({ k: 'buy', i, to }, Math.max(u.a, s.unit.a) + 1 - u.a + Math.max(u.h, s.unit.h) + 1 - u.h + (isUnitId(u.id) ? WEIGHT[u.id] * up : 0) + 0.5);
    });
  });
  run.snacks.forEach((s, i) => {
    if (s?.kind !== 'snack' || s.cost > run.acorns) return;
    const status = s.snack === 'honey' || s.snack === 'mint' || s.snack === 'chilli';
    const to = line.findIndex((u) => u && (!status || !u.status));
    if (to >= 0 && (s.snack !== 'hay' || line.filter(Boolean).length > 1)) offer({ k: 'feed', i, to }, SNACK_WORTH[s.snack]);
  });
  if (best) return best;
  if (empty < 0) {
    let weak = 0;
    line.forEach((u, i) => { if (unitWorth(u!) < unitWorth(line[weak]!)) weak = i; });
    const w = line[weak]!;
    if (run.units.some((s) => s?.kind === 'unit' && s.unit.id !== w.id && unitWorth(s.unit) > unitWorth(w) + 2 && run.acorns + w.level >= UNIT_COST)) return { k: 'sell', at: weak };
  }
  const want = run.units.findIndex((s) => s?.kind === 'unit' && !s.frozen && line.some((u) => u?.id === s.unit.id));
  if (want >= 0 && run.acorns < UNIT_COST) return { k: 'freeze', kind: 'unit', i: want };
  if (run.acorns >= 4 || (run.freeRoll && run.acorns >= 3)) return { k: 'roll' };
  return null;
}

/** Applies an action; false when the run refused it. */
export function act(run: Run, a: Action) {
  switch (a.k) {
    case 'buy': return run.buy(a.i, a.to);
    case 'feed': return run.feed(a.i, a.to);
    case 'sell': return run.sell(a.at);
    case 'move': return run.move(a.from, a.to);
    case 'roll': return run.roll();
    case 'freeze': return run.freeze(a.kind, a.i);
  }
}

/** Shops until the policy is done (at most 40 actions), then puts the strongest units at the front. */
export function playShop(run: Run, pick: (run: Run) => Action | null = choose) {
  for (let n = 0; n < 40; n++) { const a = pick(run); if (!a || !act(run, a)) break; }
  const units = run.line.filter((u): u is Unit => u !== null).sort((x, y) => y.a + y.h - (x.a + x.h));
  run.line = [0, 1, 2, 3, 4].map((i) => units[i] ?? null);
}

/** The acorns a ghost crew gets each turn, and the seed every run derives its rival from. */
export const GHOST_ACORNS = 10, GHOST_SEED = 7, GHOST_UID = 1_000_000;
const ghosts = new Map<number, Run>();
/**
 * A rival crew as it stands after shopping `turn` turns with the policy. One ghost run per seed is kept and played
 * forward, so a run's rival grows turn by turn without being rebuilt; uids are lifted clear of any player's.
 */
export function ghost(seed: number, turn: number): Unit[] {
  let g = ghosts.get(seed);
  if (!g || g.turn > turn + 1) {
    g = new Run(seed, null, { acorns: GHOST_ACORNS, fights: false });
    ghosts.delete(seed); ghosts.set(seed, g);
    if (ghosts.size > 64) ghosts.delete(ghosts.keys().next().value!);
  }
  while (g.turn <= turn) { playShop(g); g.endTurn(); }
  return g.line.filter((u): u is Unit => u !== null).map((u) => ({ ...u, uid: u.uid + GHOST_UID }));
}

export const PROFILE_VERSION = 1;
/** What a player has done across runs. `last` is the seed of the last run recorded, so recording twice is harmless. */
export type Profile = { v: 1; runs: number; wins: number; best: number; won: UnitId[]; last: number };
export const freshProfile = (): Profile => ({ v: 1, runs: 0, wins: 0, best: 0, won: [], last: -1 });
export function loadProfile(raw: string | null): Profile {
  try {
    const d = JSON.parse(raw ?? '');
    const int = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
    if (!d || d.v !== PROFILE_VERSION || !int(d.runs, 0, 1e9) || !int(d.wins, 0, d.runs) || !int(d.best, 0, BALES) || !int(d.last, -1, 2 ** 32) || !Array.isArray(d.won)) return freshProfile();
    return { v: 1, runs: d.runs, wins: d.wins, best: d.best, last: d.last, won: [...new Set(d.won.filter((id: unknown) => typeof id === 'string' && isUnitId(id)))] as UnitId[] };
  } catch { return freshProfile(); }
}
export function record(p: Profile, run: Run): Profile {
  if ((run.phase !== 'over' && run.phase !== 'won') || p.last === run.seed) return p;
  const won = run.phase === 'won';
  const ids = won ? run.line.filter((u): u is Unit => u !== null).map((u) => u.id).filter(isUnitId) : [];
  return { v: 1, runs: p.runs + 1, wins: p.wins + (won ? 1 : 0), best: Math.max(p.best, run.bales), won: [...new Set([...p.won, ...ids])], last: run.seed };
}
