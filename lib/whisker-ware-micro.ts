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

// ── Dora · Dust Spa ───────────────────────────────────────────────────────────

interface DustState { t: number; result: Outcome; dust: number; target: number }
const dust: Micro<DustState> = {
  id: 'dust', verb: 'DUST!', host: 1, boss: false, input: 'rub', ticks: 300, survive: false,
  init(_r, level) { return { t: 0, result: null, dust: 0, target: [12, 16, 20][level - 1] }; },
  tick(s, i) {
    if (!begin(s)) return;
    if (i.rub) s.dust++;
    if (s.dust >= s.target) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const TILT_DRIFT = 0.012, TILT_PUSH = 0.03;
interface BalanceState {
  t: number; result: Outcome; level: Level;
  tilt: number; lean: -1 | 1; gust: number; amp: number; phase: number; dora: { x: number; y: number };
}
const balance: Micro<BalanceState> = {
  id: 'balance', verb: 'BALANCE!', host: 1, boss: false, input: 'steer', ticks: 300, survive: true,
  init(rand, level) {
    const lean = rand.next() < 0.5 ? -1 : 1;
    // Gusts only ever add to the lean, so drift plus gust is at least 0.012 a tick: an untouched Dora starting at 0.08 is past the limit in 77 ticks.
    return { t: 0, result: null, level, tilt: 0.08 * lean, lean, gust: 0, amp: [0.006, 0.01, 0.014][level - 1], phase: rand.next() * Math.PI * 2, dora: { x: 240, y: 270 } };
  },
  tick(s, i) {
    if (!begin(s)) return;
    s.gust = s.amp * (0.5 + 0.5 * Math.sin(s.t * 0.07 + s.phase));
    const away = s.tilt === 0 ? s.lean : s.tilt > 0 ? 1 : -1;
    s.tilt += away * (TILT_DRIFT + s.gust);
    // pushing left reduces the tilt, so the pointer's side of Dora pushes the way a key on that side would
    const push = i.steer || (i.down && i.x >= 0 ? (i.x < 240 ? -1 : 1) : 0);
    s.tilt += push * TILT_PUSH;
    if (Math.abs(s.tilt) > 1) s.result = 'lose';
    else if (s.t >= this.ticks) s.result = 'win';
  },
  outcome: s => s.result,
};

interface FluffState {
  t: number; result: Outcome;
  size: number; held: boolean; centre: number; width: number; lo: number; hi: number;
}
const fluff: Micro<FluffState> = {
  id: 'fluff', verb: 'FLUFF!', host: 1, boss: false, input: 'hold', ticks: 300, survive: false,
  init(rand, level) {
    const centre = 0.55 + rand.next() * 0.25, width = [0.2, 0.14, 0.09][level - 1];
    return { t: 0, result: null, size: 0, held: false, centre, width, lo: centre - width / 2, hi: centre + width / 2 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    if (i.released && s.held) {
      s.held = false;
      s.result = s.size >= s.lo && s.size <= s.hi ? 'win' : 'lose';
      return;
    }
    s.held = i.down;
    if (s.held) s.size += 0.008;
    if (s.size >= 1) s.result = 'lose';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const HOP_X = 120, HOP_GROUND = 270, HOP_SPEED = 3.4, HOP_AIR = 40, HOP_LIFT = 64;
interface HopState {
  t: number; result: Outcome;
  dora: { x: number; y: number }; jump: number; logs: { x: number; y: number }[]; passed: number;
}
const hop: Micro<HopState> = {
  id: 'hop', verb: 'HOP!', host: 1, boss: false, input: 'timing', ticks: 300, survive: false,
  init(rand, level) {
    const logs = [];
    let x = 500 + rand.int(40);
    for (let k = 0; k < level; k++) {
      logs.push({ x, y: HOP_GROUND - 14 });
      // at least 150 apart, so a jump (40 ticks, 136 units of log travel) is over before the next log is 70 away; the last log is past by tick 270
      x += 150 + rand.int(80);
    }
    return { t: 0, result: null, dora: { x: HOP_X, y: HOP_GROUND }, jump: 0, logs, passed: 0 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    if (!s.jump && i.pressed) s.jump = 1;
    else if (s.jump) s.jump = s.jump + 1 >= HOP_AIR ? 0 : s.jump + 1;
    s.dora.y = HOP_GROUND - (s.jump ? HOP_LIFT * Math.sin(Math.PI * s.jump / HOP_AIR) : 0);
    for (const l of s.logs) {
      l.x -= HOP_SPEED;
      // a log clips Dora while she is less than 20 units off the ground and it is within her half-width plus its own
      if (Math.abs(l.x - s.dora.x) < 30 && HOP_GROUND - s.dora.y < 20) s.result = 'lose';
    }
    s.passed = s.logs.filter(l => l.x < s.dora.x - 30).length;
    if (!s.result && s.passed === s.logs.length) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const COMB_SPEED = 7, COMB_REACH = 18;
interface CombState {
  t: number; result: Outcome;
  dora: { x: number; y: number }; comb: { x: number; y: number }; tangles: { x: number; y: number; done: boolean }[];
}
const comb: Micro<CombState> = {
  id: 'comb', verb: 'COMB!', host: 1, boss: false, input: 'drag', ticks: 300, survive: false,
  init(rand, level) {
    const n = [3, 4, 5][level - 1];
    const start = { x: 240, y: 90 };
    const tangles: CombState['tangles'] = [];
    // A 200 x 120 box round Dora, at least 40 from the comb's start (so idle clears none) and 30 from each other.
    // The box is small enough that the farthest-first route is under 110 ticks of comb travel, well inside 300.
    for (let tries = 0; tangles.length < n && tries < 400; tries++) {
      const x = 140 + rand.int(201), y = 130 + rand.int(121);
      if (Math.hypot(x - start.x, y - start.y) < 40) continue;
      if (tangles.some(g => Math.hypot(g.x - x, g.y - y) < 30)) continue;
      tangles.push({ x, y, done: false });
    }
    for (let k = tangles.length; k < n; k++) tangles.push({ x: 150 + k * 40, y: 240, done: false });
    return { t: 0, result: null, dora: { x: 240, y: 190 }, comb: start, tangles };
  },
  tick(s, i) {
    if (!begin(s)) return;
    const c = s.comb;
    if (i.left || i.right || i.up || i.dn) {
      c.x += ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * COMB_SPEED;
      c.y += ((i.dn ? 1 : 0) - (i.up ? 1 : 0)) * COMB_SPEED;
    } else if (i.down && i.x >= 0) {
      const dx = i.x - c.x, dy = i.y - c.y, d = Math.hypot(dx, dy);
      if (d > COMB_SPEED) { c.x += dx / d * COMB_SPEED; c.y += dy / d * COMB_SPEED; } else { c.x = i.x; c.y = i.y; }
    }
    c.x = Math.max(0, Math.min(480, c.x)); c.y = Math.max(0, Math.min(320, c.y));
    for (const g of s.tangles) if (!g.done && Math.hypot(g.x - c.x, g.y - c.y) <= COMB_REACH) g.done = true;
    if (s.tangles.every(g => g.done)) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const SHELVES = 8, SHELF_GAP = 34, SHELF_HALF = 46, SHELF_FLOOR = 296, SHELF_LEFT = 120, SHELF_RIGHT = 360;
interface Shelf { x: number; y: number; v: number; dir: -1 | 1 }
interface ShelfState { t: number; result: Outcome; level: number; dora: { x: number; y: number }; shelves: Shelf[] }
/** The earliest tick each shelf is within 12 units of Dora's x after the last, plus 6 ticks of slack per hop. */
function shelfClimb(shelves: Shelf[], x: number) {
  const sim = shelves.map(h => ({ ...h }));
  let level = 0;
  for (let t = 1; t <= 900; t++) {
    for (const h of sim) { h.x += h.dir * h.v; if (h.x <= SHELF_LEFT || h.x >= SHELF_RIGHT) { h.dir = -h.dir as -1 | 1; h.x = Math.max(SHELF_LEFT, Math.min(SHELF_RIGHT, h.x)); } }
    if (Math.abs(sim[level].x - x) <= 12) { level++; t += 6; if (level === SHELVES) return t; }
  }
  return Infinity;
}
const shelf: Micro<ShelfState> = {
  id: 'shelf', verb: 'CLIMB!', host: 1, boss: true, input: 'timing', ticks: 900, survive: false,
  init(rand, level) {
    const mult = [1, 1.12, 1.25][level - 1];
    let shelves: Shelf[] = [];
    // Shelf motion never depends on the player, so a layout is checked by climbing it: re-roll until a patient climb finishes inside 700 of the 900 ticks.
    for (let tries = 0; tries < 200; tries++) {
      shelves = [];
      for (let k = 0; k < SHELVES; k++) {
        shelves.push({ x: SHELF_LEFT + rand.next() * (SHELF_RIGHT - SHELF_LEFT), y: SHELF_FLOOR - SHELF_GAP * (k + 1), v: (1.6 + (1.0 * k) / (SHELVES - 1)) * mult, dir: rand.next() < 0.5 ? -1 : 1 });
      }
      if (shelfClimb(shelves, 240) <= 700) break;
    }
    return { t: 0, result: null, level: 0, dora: { x: 240, y: SHELF_FLOOR }, shelves };
  },
  tick(s, i) {
    if (!begin(s)) return;
    for (const h of s.shelves) {
      h.x += h.dir * h.v;
      if (h.x <= SHELF_LEFT || h.x >= SHELF_RIGHT) { h.dir = -h.dir as -1 | 1; h.x = Math.max(SHELF_LEFT, Math.min(SHELF_RIGHT, h.x)); }
    }
    if (i.pressed) {
      if (Math.abs(s.shelves[s.level].x - s.dora.x) <= SHELF_HALF) s.level++;
      else s.level = Math.max(0, s.level - 1);
      s.dora.y = s.level ? s.shelves[s.level - 1].y : SHELF_FLOOR;
    }
    if (s.level >= SHELVES) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

MICROS.dust = dust;
MICROS.balance = balance;
MICROS.fluff = fluff;
MICROS.hop = hop;
MICROS.comb = comb;
MICROS.shelf = shelf;

/** Each host's five ordinary microgames, and their boss. */
export const HOST_GAMES: readonly MicroId[][] = [0, 1, 2, 3].map(h => MICRO_IDS.slice(h * 6, h * 6 + 5));
export const HOST_BOSS: readonly MicroId[] = [0, 1, 2, 3].map(h => MICRO_IDS[h * 6 + 5]);
