// Hay Bale Brawl: the rules of an auto-battler run. Deterministic and DOM-free: a run is a seed plus the choices made,
// every random draw comes from a seeded generator, and a fight is worked out in one go into a list of events the page
// replays.
import { UNITS, type Unit, type Status, type TokenId, type Ctx, type Trigger } from './hay-bale-units.js';

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
