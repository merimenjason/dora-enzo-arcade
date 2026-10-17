// Whisker Ware's microgame contract and table. Pure rules, no DOM; the game file imports this, never the reverse.

// ── Seeded randomness (copied from Acorn Hand) ────────────────────────────────

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

// ── Input ─────────────────────────────────────────────────────────────────────

/** One raw frame per real tick, built by the page from pointer and keys. */
export type Frame = { x: number; y: number; down: boolean; left: boolean; right: boolean; up: boolean; dn: boolean; pick: 0 | 1 | 2 | 3 };
export const IDLE: Frame = { x: -1, y: -1, down: false, left: false, right: false, up: false, dn: false, pick: 0 };

/** A frame plus the edges the Pad derives from the previous one. */
export type Input = Frame & { pressed: boolean; released: boolean; swipe: -1 | 0 | 1; rub: boolean; steer: -1 | 0 | 1 };

// ── The contract ──────────────────────────────────────────────────────────────

export type Level = 1 | 2 | 3;
export type Outcome = 'win' | 'lose' | null;
export type InputKind = 'mash' | 'steer' | 'swipe' | 'pick' | 'timing' | 'rub' | 'hold' | 'drag';

export const MICRO_IDS = [
  'stuff', 'catch', 'sort', 'sniff', 'gnaw', 'raisin',
  'dust', 'balance', 'fluff', 'hop', 'comb', 'shelf',
  'sneak', 'hide', 'hush', 'find', 'dodge', 'moon',
  'pick', 'pop', 'aim', 'stack', 'count', 'ring',
] as const;
export type MicroId = typeof MICRO_IDS[number];

/** `tick` mutates `s`, increments `s.t` and sets `s.result` once decided. States are plain JSON-safe objects. */
export interface Micro<S extends { t: number; result: Outcome } = any> {
  id: MicroId;
  verb: string;
  host: 0 | 1 | 2 | 3;
  boss: boolean;
  input: InputKind;
  ticks: number;
  survive: boolean;
  init(rand: Rand, level: Level): S;
  tick(s: S, i: Input): void;
  outcome(s: S): Outcome;
}

/** Filled host by host as the microgames are written. */
export const MICROS: Partial<Record<MicroId, Micro>> = {};

// ── Helpers shared by the microgames ──────────────────────────────────────────

/** Starts a tick: false once the game is decided; otherwise advances `t`. */
const begin = (s: { t: number; result: Outcome }) => {
  if (s.result) return false;
  s.t++;
  return true;
};
/** Anything undecided at the last tick loses (every game here is not a survive game). */
const lapse = (s: { t: number; result: Outcome }, ticks: number) => {
  if (!s.result && s.t >= ticks) s.result = 'lose';
};
const pickOf = (i: Input, near: (x: number) => number) => {
  if (i.pick) return i.pick - 1;
  return i.pressed && i.x >= 0 ? near(i.x) : -1;
};

// ── Enzo · Snack Shack ────────────────────────────────────────────────────────

const BOWL_Y = 260, BOWL_HALF = 34, BOWL_SPEED = 6, CATCH_Y = 250, FLOOR_Y = 272;
const CHUTES = [120, 240, 360];

/** Moves a bowl like every steering game: held arrows win, else towards the pointer, capped at top speed. */
function steerBowl(b: { x: number }, i: Input) {
  if (i.steer) b.x += i.steer * BOWL_SPEED;
  else if (i.x >= 0) b.x += Math.max(-BOWL_SPEED, Math.min(BOWL_SPEED, i.x - b.x));
  b.x = Math.max(BOWL_HALF, Math.min(480 - BOWL_HALF, b.x));
}

interface StuffState { t: number; result: Outcome; cheeks: number; target: number }
const stuff: Micro<StuffState> = {
  id: 'stuff', verb: 'STUFF!', host: 0, boss: false, input: 'mash', ticks: 300, survive: false,
  init(_r, level) { return { t: 0, result: null, cheeks: 0, target: [14, 18, 22][level - 1] }; },
  tick(s, i) {
    if (!begin(s)) return;
    if (i.pressed) s.cheeks++;
    if (s.cheeks >= s.target) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

interface Faller { kind: 'raisin' | 'pebble'; x: number; y: number; v: number; chute: number }
interface CatchState {
  t: number; result: Outcome; level: Level;
  bowl: { x: number; y: number };
  items: Faller[]; queue: { kind: 'raisin' | 'pebble'; x: number }[]; spawned: number; gap: number;
  raisins: number; need: number;
}
const catchGame: Micro<CatchState> = {
  id: 'catch', verb: 'CATCH!', host: 0, boss: false, input: 'steer', ticks: 300, survive: false,
  init(rand, level) {
    const n = [1, 2, 3][level - 1];
    const kinds = rand.shuffle([...Array(n).fill('raisin'), ...Array(n - 1).fill('pebble')]) as ('raisin' | 'pebble')[];
    const gap = [70, 50, 42][level - 1];
    const queue: CatchState['queue'] = [{ kind: 'pebble', x: 240 }];
    // Track where the bowl could be at each landing, so every layout is clearable: a raisin's x must be reachable
    // in time, a pebble must leave somewhere to stand outside its width.
    const land = (k: number) => k * gap + (CATCH_Y + 20) / (2.4 + 0.3 * k);
    let reach: [number, number][] = [[240, 240]], at = 0;
    const move = (k: number) => {
      const d = (land(k) - at) * BOWL_SPEED * 0.9;
      const grown = reach.map(([a, b]): [number, number] => [Math.max(BOWL_HALF, a - d), Math.min(480 - BOWL_HALF, b + d)]).sort((p, q) => p[0] - q[0]);
      reach = [];
      for (const g of grown) {
        const last = reach[reach.length - 1];
        if (last && g[0] <= last[1]) last[1] = Math.max(last[1], g[1]); else reach.push(g);
      }
      at = land(k);
    };
    const settle = (kind: 'raisin' | 'pebble', x: number) => {
      const next: [number, number][] = [];
      for (const [a, b] of reach) {
        if (kind === 'raisin') { if (Math.max(a, x - 28) <= Math.min(b, x + 28)) next.push([Math.max(a, x - 28), Math.min(b, x + 28)]); }
        else {
          if (a < x - 42) next.push([a, Math.min(b, x - 42)]);
          if (b > x + 42) next.push([Math.max(a, x + 42), b]);
        }
      }
      if (!next.length) return false;
      reach = next;
      return true;
    };
    move(0); settle('pebble', 240);
    for (let k = 0; k < kinds.length; k++) {
      move(k + 1);
      const save = reach;
      let x = 240, ok = false;
      for (let tries = 0; tries < 60 && !ok; tries++) {
        x = 60 + rand.int(361);
        if (Math.abs(x - queue[queue.length - 1].x) < 100) continue;
        reach = save;
        ok = settle(kinds[k], x);
      }
      if (!ok) {
        reach = save;
        x = Math.max(60, Math.min(420, (reach[0][0] + reach[0][1]) / 2));
        if (!settle(kinds[k], x)) reach = save;
      }
      queue.push({ kind: kinds[k], x });
    }
    return { t: 0, result: null, level, bowl: { x: 240, y: BOWL_Y }, items: [], queue, spawned: 0, gap, raisins: 0, need: n };
  },
  tick(s, i) {
    if (!begin(s)) return;
    steerBowl(s.bowl, i);
    if (s.spawned < s.queue.length && s.t - 1 === s.spawned * s.gap) {
      const q = s.queue[s.spawned];
      s.items.push({ kind: q.kind, x: q.x, y: -20, v: 2.4 + 0.3 * s.spawned, chute: 0 });
      s.spawned++;
    }
    for (const m of s.items) {
      m.y += m.v;
      if (m.y < CATCH_Y) continue;
      if (Math.abs(m.x - s.bowl.x) <= BOWL_HALF) {
        m.y = FLOOR_Y + 99;
        if (m.kind === 'pebble') s.result = 'lose'; else s.raisins++;
      } else if (m.y >= FLOOR_Y) {
        m.y = FLOOR_Y + 99;
        if (m.kind === 'raisin') s.result = 'lose';
      }
    }
    s.items = s.items.filter(m => m.y < FLOOR_Y + 50);
    if (!s.result && s.raisins >= s.need) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

interface SortState {
  t: number; result: Outcome;
  order: ('acorn' | 'pebble')[]; done: number; item: { kind: 'acorn' | 'pebble'; x: number; y: number } | null;
  wait: number; last: -1 | 0 | 1;
}
const sort: Micro<SortState> = {
  id: 'sort', verb: 'SORT!', host: 0, boss: false, input: 'swipe', ticks: 300, survive: false,
  init(rand, level) {
    const n = [3, 4, 5][level - 1];
    const order: SortState['order'] = [];
    for (let k = 0; k < n; k++) order.push(rand.next() < 0.5 ? 'acorn' : 'pebble');
    if (!order.includes('acorn')) order[0] = 'acorn';
    if (!order.includes('pebble')) order[n - 1] = 'pebble';
    return { t: 0, result: null, order, done: 0, item: null, wait: 20, last: 0 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    if (s.item) {
      if (i.swipe) {
        const right = s.item.kind === 'acorn';
        if ((i.swipe === 1) !== right) s.result = 'lose';
        else { s.done++; s.last = i.swipe; s.item = null; s.wait = 20; }
      }
    } else if (s.done < s.order.length && --s.wait <= 0) {
      s.item = { kind: s.order[s.done], x: 240, y: 200 };
    }
    if (!s.result && s.done >= s.order.length) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

interface SniffState {
  t: number; result: Outcome; level: Level;
  cups: { x: number; y: number }[]; slot: number[]; raisin: number; open: boolean; show: boolean;
  swaps: [number, number][]; dur: number; mv: [number, number] | null;
}
const SNIFF_START = 40, SNIFF_GAP = 6;
const sniff: Micro<SniffState> = {
  id: 'sniff', verb: 'SNIFF!', host: 0, boss: false, input: 'pick', ticks: 300, survive: false,
  init(rand, level) {
    const n = [3, 5, 7][level - 1];
    const swaps: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = rand.int(3);
      swaps.push([a, (a + 1 + rand.int(2)) % 3]);
    }
    return {
      t: 0, result: null, level,
      cups: CHUTES.map(x => ({ x, y: 200 })), slot: [0, 1, 2], raisin: rand.int(3), open: false, show: true,
      swaps, dur: [24, 18, 14][level - 1], mv: null,
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    const period = s.dur + SNIFF_GAP;
    const at = s.t - 1 - SNIFF_START;
    if (at >= 0) s.show = false;
    if (at >= 0 && at < s.swaps.length * period) {
      const k = Math.floor(at / period), w = at % period;
      if (w < s.dur) {
        const [sa, sb] = s.swaps[k];
        if (w === 0) s.mv = [s.slot.indexOf(sa), s.slot.indexOf(sb)];
        const [ca, cb] = s.mv!;
        const p = (w + 1) / s.dur, lift = Math.sin(p * Math.PI) * 24;
        s.cups[ca].x = CHUTES[sa] + (CHUTES[sb] - CHUTES[sa]) * p; s.cups[ca].y = 200 - lift;
        s.cups[cb].x = CHUTES[sb] + (CHUTES[sa] - CHUTES[sb]) * p; s.cups[cb].y = 200 + lift;
        if (w === s.dur - 1) { s.slot[ca] = sb; s.slot[cb] = sa; s.mv = null; }
      }
    }
    if (at >= s.swaps.length * period) s.open = true;
    if (s.open) {
      const c = pickOf(i, x => {
        const k = s.cups.findIndex(cup => Math.abs(cup.x - x) <= 50);
        return k < 0 ? -1 : s.slot[k];
      });
      if (c >= 0) s.result = s.slot[s.raisin] === c ? 'win' : 'lose';
    }
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

interface GnawState { t: number; result: Outcome; stick: number; notch: number; window: number; tooth: number }
const gnaw: Micro<GnawState> = {
  id: 'gnaw', verb: 'GNAW!', host: 0, boss: false, input: 'timing', ticks: 300, survive: false,
  init(_r, level) { return { t: 0, result: null, stick: 480, notch: 520, window: [28, 20, 14][level - 1], tooth: 180 }; },
  tick(s, i) {
    if (!begin(s)) return;
    if (i.pressed) { s.result = Math.abs(s.notch - s.tooth) <= s.window / 2 ? 'win' : 'lose'; return; }
    s.notch -= 3.2; s.stick -= 3.2;
    if (s.notch < s.tooth - s.window / 2) s.result = 'lose';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

interface RainState {
  t: number; result: Outcome; level: Level;
  bowl: { x: number; y: number }; items: Faller[]; queue: { kind: 'raisin' | 'pebble'; chute: number }[];
  spawned: number; next: number; raisins: number; pebbles: number; missed: number;
}
const raisin: Micro<RainState> = {
  id: 'raisin', verb: 'RAISIN RAIN!', host: 0, boss: true, input: 'steer', ticks: 900, survive: false,
  init(rand, level) {
    const queue: RainState['queue'] = [{ kind: 'pebble', chute: 1 }];
    for (let k = 1; k < 60; k++) {
      const chute = rand.int(3);
      // every fourth item (0, 4, 8) is a pebble down the starting chute, so a bowl that never moves meets 3 of them before it can catch 8 raisins
      if (k % 4 === 0) { queue.push({ kind: 'pebble', chute: 1 }); continue; }
      queue.push({ kind: rand.next() < 0.2 ? 'pebble' : 'raisin', chute });
    }
    return { t: 0, result: null, level, bowl: { x: 240, y: BOWL_Y }, items: [], queue, spawned: 0, next: 0, raisins: 0, pebbles: 0, missed: 0 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    steerBowl(s.bowl, i);
    const ramp = Math.min(1, s.t / 600);
    if (s.t - 1 >= s.next && s.spawned < s.queue.length) {
      const q = s.queue[s.spawned++];
      s.items.push({ kind: q.kind, chute: q.chute, x: CHUTES[q.chute], y: -20, v: (2.6 + 1.6 * ramp) * [1, 1.08, 1.16][s.level - 1] });
      s.next += Math.round(40 - 18 * ramp);
    }
    for (const m of s.items) {
      m.y += m.v;
      if (m.y < CATCH_Y) continue;
      if (Math.abs(m.x - s.bowl.x) <= BOWL_HALF) {
        m.y = FLOOR_Y + 99;
        if (m.kind === 'pebble') s.pebbles++; else s.raisins++;
      } else if (m.y >= FLOOR_Y) {
        m.y = FLOOR_Y + 99;
        if (m.kind === 'raisin') s.missed++;
      }
    }
    s.items = s.items.filter(m => m.y < FLOOR_Y + 50);
    if (s.pebbles >= 3) s.result = 'lose';
    else if (s.raisins >= 8) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

MICROS.stuff = stuff;
MICROS.catch = catchGame;
MICROS.sort = sort;
MICROS.sniff = sniff;
MICROS.gnaw = gnaw;
MICROS.raisin = raisin;

/** Each host's five ordinary microgames, and their boss. */
export const HOST_GAMES: readonly MicroId[][] = [0, 1, 2, 3].map(h => MICRO_IDS.slice(h * 6, h * 6 + 5));
export const HOST_BOSS: readonly MicroId[] = [0, 1, 2, 3].map(h => MICRO_IDS[h * 6 + 5]);
