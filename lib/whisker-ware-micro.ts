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

// CATCH_REACT: ticks a player needs to see where the next item is going before the bowl can set off.
const BOWL_Y = 260, BOWL_HALF = 34, BOWL_SPEED = 6, CATCH_Y = 250, FLOOR_Y = 272, CATCH_REACT = 30;
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
    const gap = [70, 60, 44][level - 1];
    const queue: CatchState['queue'] = [{ kind: 'pebble', x: 240 }];
    // Track where the bowl could be at each landing, so every layout is clearable: a raisin's x must be reachable
    // in time, a pebble must leave somewhere to stand outside its width.
    const land = (k: number) => k * gap + (CATCH_Y + 20) / (2.4 + 0.3 * k);
    let reach: [number, number][] = [[240, 240]], at = 0;
    const move = (k: number) => {
      const d = Math.max(0, land(k) - at - CATCH_REACT) * BOWL_SPEED * 0.9;
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
/**
 * Plays tick `at` (0-based) of a shuffle: each swap glides two items between slot positions on CHUTES for `dur` ticks, one
 * lifted over the other, then rests SNIFF_GAP ticks. `slot[item]` is the slot an item sits in. True once every swap is done.
 */
function shuffleStep(items: { x: number; y: number }[], st: { slot: number[]; mv: [number, number] | null }, swaps: [number, number][], dur: number, at: number, y: number) {
  const period = dur + SNIFF_GAP;
  if (at >= swaps.length * period) return true;
  const k = Math.floor(at / period), w = at % period;
  if (w < dur) {
    const [sa, sb] = swaps[k];
    if (w === 0) st.mv = [st.slot.indexOf(sa), st.slot.indexOf(sb)];
    const [ca, cb] = st.mv!;
    const p = (w + 1) / dur, lift = Math.sin(p * Math.PI) * 24;
    items[ca].x = CHUTES[sa] + (CHUTES[sb] - CHUTES[sa]) * p; items[ca].y = y - lift;
    items[cb].x = CHUTES[sb] + (CHUTES[sa] - CHUTES[sb]) * p; items[cb].y = y + lift;
    if (w === dur - 1) { st.slot[ca] = sb; st.slot[cb] = sa; st.mv = null; }
  }
  return false;
}
/** `n` random swaps of two of the three slots. */
function makeSwaps(rand: Rand, n: number) {
  const swaps: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = rand.int(3);
    swaps.push([a, (a + 1 + rand.int(2)) % 3]);
  }
  return swaps;
}
const sniff: Micro<SniffState> = {
  id: 'sniff', verb: 'SNIFF!', host: 0, boss: false, input: 'pick', ticks: 300, survive: false,
  init(rand, level) {
    const swaps = makeSwaps(rand, [3, 5, 7][level - 1]);
    return {
      t: 0, result: null, level,
      cups: CHUTES.map(x => ({ x, y: 200 })), slot: [0, 1, 2], raisin: rand.int(3), open: false, show: true,
      swaps, dur: [24, 18, 14][level - 1], mv: null,
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    const at = s.t - 1 - SNIFF_START;
    if (at >= 0) s.show = false;
    if (at >= 0 && shuffleStep(s.cups, s, s.swaps, s.dur, at, 200)) s.open = true;
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

// The notch takes window / GNAW_SPEED ticks to cross the bite: 24, 18 and 14 ticks by level.
const GNAW_SPEED = 2;
interface GnawState { t: number; result: Outcome; stick: number; notch: number; window: number; tooth: number }
const gnaw: Micro<GnawState> = {
  id: 'gnaw', verb: 'GNAW!', host: 0, boss: false, input: 'timing', ticks: 300, survive: false,
  init(_r, level) { return { t: 0, result: null, stick: 480, notch: 520, window: [48, 36, 28][level - 1], tooth: 180 }; },
  tick(s, i) {
    if (!begin(s)) return;
    if (i.pressed) { s.result = Math.abs(s.notch - s.tooth) <= s.window / 2 ? 'win' : 'lose'; return; }
    s.notch -= GNAW_SPEED; s.stick -= GNAW_SPEED;
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

// Slow enough that a player reacting a quarter of a second late can still catch the lean at full speed.
const TILT_DRIFT = 0.007, TILT_PUSH = 0.027;
interface BalanceState {
  t: number; result: Outcome; level: Level;
  tilt: number; lean: -1 | 1; gust: number; amp: number; phase: number; dora: { x: number; y: number };
}
const balance: Micro<BalanceState> = {
  id: 'balance', verb: 'BALANCE!', host: 1, boss: false, input: 'steer', ticks: 300, survive: true,
  init(rand, level) {
    const lean = rand.next() < 0.5 ? -1 : 1;
    // Gusts only ever add to the lean, so drift plus gust is at least 0.007 a tick: an untouched Dora starting at 0.08 is past the limit in 132 ticks.
    return { t: 0, result: null, level, tilt: 0.08 * lean, lean, gust: 0, amp: [0.004, 0.006, 0.008][level - 1], phase: rand.next() * Math.PI * 2, dora: { x: 240, y: 270 } };
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

const FLUFF_GROW = 0.006;
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
    if (s.held) s.size += FLUFF_GROW;
    if (s.size >= 1) s.result = 'lose';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const HOP_X = 120, HOP_GROUND = 270, HOP_SPEED = 3.4, HOP_AIR = 50, HOP_LIFT = 72, HOP_HIT = 26;
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
      // at least 180 apart, so a jump (50 ticks, 170 units of log travel) is over before the next log is 70 away; the last log is past by tick 280
      x += 180 + rand.int(70);
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
      // a log clips Dora while she is less than 20 units off the ground and it is within 26 units (her half-width plus its own)
      if (Math.abs(l.x - s.dora.x) < HOP_HIT && HOP_GROUND - s.dora.y < 20) s.result = 'lose';
    }
    s.passed = s.logs.filter(l => l.x < s.dora.x - HOP_HIT).length;
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

// ── The Owl · Night Watch ─────────────────────────────────────────────────────

/** Steering for the Owl's actors: held arrows win, else towards the pointer's x, capped at `speed`; kept between `lo` and `hi`. */
function steerActor(a: { x: number }, i: Input, speed: number, lo: number, hi: number) {
  if (i.steer) a.x += i.steer * speed;
  else if (i.x >= 0) a.x += Math.max(-speed, Math.min(speed, i.x - a.x));
  a.x = Math.max(lo, Math.min(hi, a.x));
}

// SNEAK_RESUME: how long a careful player waits to be sure the Owl has turned away before walking again.
const SNEAK_FROM = 40, SNEAK_TO = 420, SNEAK_SPEED = 2.2, SNEAK_WATCH = 60, SNEAK_RESUME = 9;
interface SneakState {
  t: number; result: Outcome; level: Level;
  dora: { x: number; y: number }; acorn: { x: number; y: number }; held: boolean;
  owl: 'back' | 'tell' | 'watching'; phase: number; len: number; cycle: number; backs: number[]; tell: number;
}
const sneak: Micro<SneakState> = {
  id: 'sneak', verb: 'SNEAK!', host: 2, boss: false, input: 'hold', ticks: 300, survive: false,
  init(rand, level) {
    const tell = [24, 18, 12][level - 1];
    // Dora needs 173 ticks of walking and only walks while the Owl's back is turned (from SNEAK_RESUME ticks after she turns
    // until the tell), so a layout is re-rolled until a careful walk is home by tick 255.
    const finish = (backs: number[]) => {
      let left = Math.ceil((SNEAK_TO - SNEAK_FROM) / SNEAK_SPEED), t = 0;
      for (const b of backs) {
        const walk = b - SNEAK_RESUME;
        if (left <= walk) return t + SNEAK_RESUME + left;
        left -= walk; t += b + tell + SNEAK_WATCH;
      }
      return Infinity;
    };
    let backs: number[] = [];
    for (let tries = 0; tries < 40; tries++) {
      backs = Array.from({ length: 6 }, () => 72 + rand.int(61));
      if (finish(backs) <= 255) break;
      backs = [132, 132, 132, 132, 132, 132];
    }
    return {
      t: 0, result: null, level, dora: { x: SNEAK_FROM, y: 270 }, acorn: { x: SNEAK_TO, y: 270 }, held: false,
      owl: 'back', phase: 0, len: backs[0], cycle: 0, backs, tell,
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    s.held = i.down;
    if (++s.phase > s.len) {
      s.phase = 1;
      if (s.owl === 'back') { s.owl = 'tell'; s.len = s.tell; }
      else if (s.owl === 'tell') { s.owl = 'watching'; s.len = SNEAK_WATCH; }
      else { s.owl = 'back'; s.len = s.backs[++s.cycle % s.backs.length]; }
    }
    if (s.owl === 'watching' && s.held) { s.result = 'lose'; return; }
    if (s.held) s.dora.x = Math.min(SNEAK_TO, s.dora.x + SNEAK_SPEED);
    if (s.dora.x >= SNEAK_TO) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const HIDE_SPEED = 5, HIDE_BEAM = 1.6;
interface HideState {
  t: number; result: Outcome;
  enzo: { x: number; y: number }; shadow: { x: number; w: number }; beam: { x: number; dir: -1 | 1 };
}
const hide: Micro<HideState> = {
  id: 'hide', verb: 'HIDE!', host: 2, boss: false, input: 'steer', ticks: 300, survive: true,
  init(rand, level) {
    const w = [110, 80, 56][level - 1];
    const dir = rand.next() < 0.5 ? -1 : 1;
    const beamAt = (t: number) => (dir > 0 ? HIDE_BEAM * t : 480 - HIDE_BEAM * t);
    // Enzo starts at least 30 units outside the shadow. A walk to the shadow at 4 a tick (80% of top speed) must be inside it before the beam reaches him.
    const safe = (ex: number, sx: number) => {
      let x = ex;
      for (let t = 1; t <= 400 && Math.abs(x - sx) > w / 2; t++) {
        x += Math.max(-4, Math.min(4, sx - x));
        const a = beamAt(t - 1), b = beamAt(t);
        if (x >= Math.min(a, b) && x <= Math.max(a, b) && Math.abs(x - sx) > w / 2) return false;
      }
      return true;
    };
    let sx = 240, ex = 100;
    for (let tries = 0; tries < 200; tries++) {
      sx = 120 + rand.int(241); ex = 100 + rand.int(281);
      if (Math.abs(ex - sx) > w / 2 + 30 && safe(ex, sx)) break;
      if (tries === 199) { sx = dir > 0 ? 380 : 100; ex = dir > 0 ? 440 : 40; }
    }
    return { t: 0, result: null, enzo: { x: ex, y: 270 }, shadow: { x: sx, w }, beam: { x: beamAt(0), dir } };
  },
  tick(s, i) {
    if (!begin(s)) return;
    steerActor(s.enzo, i, HIDE_SPEED, 20, 460);
    const was = s.beam.x;
    s.beam.x = s.beam.dir > 0 ? HIDE_BEAM * s.t : 480 - HIDE_BEAM * s.t;
    if (s.enzo.x >= Math.min(was, s.beam.x) && s.enzo.x <= Math.max(was, s.beam.x) && Math.abs(s.enzo.x - s.shadow.x) > s.shadow.w / 2) s.result = 'lose';
    else if (s.t >= this.ticks) s.result = 'win';
  },
  outcome: s => s.result,
};

const HUSH_SPOTS = [120, 240, 360], HUSH_FIRST = 20, HUSH_EVERY = 45, HUSH_LIMIT = 72;
interface Toy { spot: number; x: number; y: number; at: number; age: number; state: 'wait' | 'squeak' | 'hushed' }
interface HushState { t: number; result: Outcome; toys: Toy[]; hushed: number }
const hush: Micro<HushState> = {
  id: 'hush', verb: 'HUSH!', host: 2, boss: false, input: 'pick', ticks: 300, survive: false,
  init(rand, level) {
    const toys: Toy[] = [];
    let spot = rand.int(3);
    for (let k = 0; k < [3, 4, 5][level - 1]; k++) {
      // a different spot from the toy before, so a spot never holds two; toys older than that have already woken the Owl
      if (k) spot = (spot + 1 + rand.int(2)) % 3;
      toys.push({ spot, x: HUSH_SPOTS[spot], y: 200, at: HUSH_FIRST + k * HUSH_EVERY, age: 0, state: 'wait' });
    }
    return { t: 0, result: null, toys, hushed: 0 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    for (const g of s.toys) if (g.state === 'wait' && s.t >= g.at) g.state = 'squeak';
    const c = pickOf(i, x => HUSH_SPOTS.findIndex(sx => Math.abs(sx - x) <= 50));
    const hit = c >= 0 ? s.toys.find(g => g.state === 'squeak' && g.spot === c) : undefined;
    if (hit) { hit.state = 'hushed'; s.hushed++; }
    for (const g of s.toys) if (g.state === 'squeak' && ++g.age >= HUSH_LIMIT) s.result = 'lose';
    if (!s.result && s.hushed >= s.toys.length) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const FIND_SPEED = 6, FIND_REACH = 22;
interface FindState {
  t: number; result: Outcome;
  lantern: { x: number; y: number }; acorn: { x: number; y: number }; decoys: { x: number; y: number }[];
}
const find: Micro<FindState> = {
  id: 'find', verb: 'FIND!', host: 2, boss: false, input: 'steer', ticks: 300, survive: false,
  init(rand, level) {
    const spot = () => ({ x: 40 + rand.int(401), y: 50 + rand.int(221) });
    let acorn = spot();
    while (Math.hypot(acorn.x - 240, acorn.y - 160) < 60) acorn = spot();
    const decoys: { x: number; y: number }[] = [];
    while (decoys.length < level - 1) {
      const d = spot();
      if (Math.hypot(d.x - acorn.x, d.y - acorn.y) >= 60 && decoys.every(o => Math.hypot(d.x - o.x, d.y - o.y) >= 40)) decoys.push(d);
    }
    return { t: 0, result: null, lantern: { x: 240, y: 160 }, acorn, decoys };
  },
  tick(s, i) {
    if (!begin(s)) return;
    const l = s.lantern;
    if (i.left || i.right || i.up || i.dn) {
      l.x += ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * FIND_SPEED;
      l.y += ((i.dn ? 1 : 0) - (i.up ? 1 : 0)) * FIND_SPEED;
    } else if (i.x >= 0 && i.y >= 0) {
      const dx = i.x - l.x, dy = i.y - l.y, d = Math.hypot(dx, dy);
      if (d > FIND_SPEED) { l.x += dx / d * FIND_SPEED; l.y += dy / d * FIND_SPEED; } else { l.x = i.x; l.y = i.y; }
    }
    l.x = Math.max(0, Math.min(480, l.x)); l.y = Math.max(0, Math.min(320, l.y));
    if (i.pressed) {
      if (Math.hypot(s.acorn.x - l.x, s.acorn.y - l.y) <= FIND_REACH) s.result = 'win';
      else if (s.decoys.some(d => Math.hypot(d.x - l.x, d.y - l.y) <= FIND_REACH)) s.result = 'lose';
    }
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const DODGE_SPEED = 5, DODGE_HIT = 20, DODGE_SWAY = 1.2 / 0.07, DODGE_LAST = 270;
interface Feather { x: number; y: number; x0: number; ph: number; age: number; v: number }
interface DodgeState {
  t: number; result: Outcome; level: Level;
  dora: { x: number; y: number }; feathers: Feather[]; spawned: number; v: number; gap: number; plan: { x: number; ph: number }[];
}
const dodge: Micro<DodgeState> = {
  id: 'dodge', verb: 'DODGE!', host: 2, boss: false, input: 'steer', ticks: 300, survive: true,
  init(rand, level) {
    const v = [2.0, 2.4, 2.8][level - 1], gap = [30, 26, 22][level - 1];
    // Every third feather (the first included) is aimed: it spawns over Dora's x, with 103+ ticks of fall to move out of the way. The first has no sway, so it lands within 20 units of Dora's start and an idle Dora is hit.
    // The rest land where `plan` says (x is where the feather is when it reaches Dora's height), at least 70 from the last two planned landings, so they never wall Dora in.
    const fall = (270 + 20) / v, plan: { x: number; ph: number }[] = [];
    const lands: number[] = [];
    for (let k = 0; k < 24; k++) {
      const ph = k ? rand.next() * Math.PI * 2 : 0;
      let x = 240;
      if (k % 3) {
        for (let tries = 0; tries < 50; tries++) {
          x = 40 + rand.int(401);
          if (lands.slice(-2).every(o => Math.abs(o - x) >= 70)) break;
        }
        lands.push(x);
      }
      plan.push({ x: x - DODGE_SWAY * Math.sin(ph + 0.07 * fall), ph });
    }
    return { t: 0, result: null, level, dora: { x: 240, y: 270 }, feathers: [], spawned: 0, v, gap, plan };
  },
  tick(s, i) {
    if (!begin(s)) return;
    steerActor(s.dora, i, DODGE_SPEED, 24, 456);
    // Feathers sway sideways at 1.2 units a tick at most (a 17-unit swing).
    if (s.t - 1 <= DODGE_LAST && (s.t - 1) % s.gap === 0) {
      const p = s.plan[s.spawned], x0 = s.spawned % 3 === 0 ? s.dora.x - DODGE_SWAY * Math.sin(p.ph) : p.x;
      s.feathers.push({ x: x0 + DODGE_SWAY * Math.sin(p.ph), y: -20, x0, ph: p.ph, age: 0, v: s.v });
      s.spawned++;
    }
    for (const f of s.feathers) {
      f.age++; f.y += f.v;
      f.x = f.x0 + DODGE_SWAY * Math.sin(f.ph + 0.07 * f.age);
      if (f.y >= 244 && f.y <= 296 && Math.abs(f.x - s.dora.x) < DODGE_HIT) s.result = 'lose';
    }
    s.feathers = s.feathers.filter(f => f.y < 310);
    if (!s.result && s.t >= this.ticks) s.result = 'win';
  },
  outcome: s => s.result,
};

const MOON_SPEED = 3, MOON_AIR = 44, MOON_LIFT = 70, MOON_FLAG = 2640, MOON_FOOT = 8;
interface MoonHazard { kind: 'gap' | 'swoop'; x: number; y: number; w: number }
interface MoonState {
  t: number; result: Outcome;
  dora: { x: number; y: number }; jump: number; hazards: MoonHazard[]; flag: number; cam: number;
}
const moon: Micro<MoonState> = {
  id: 'moon', verb: 'DASH!', host: 2, boss: true, input: 'timing', ticks: 900, survive: false,
  init(rand, level) {
    const n = [5, 8, 11][level - 1], min = [300, 230, 190][level - 1];
    // Each hazard starts at least `min` units after the last, so the jump over one (126 units of flight) is over before the next needs one; the last is 80 clear of the flag.
    const spread = Math.max(0, Math.floor(2070 / (n - 1)) - min);
    const hazards: MoonHazard[] = [];
    let x = 420;
    for (let k = 0; k < n; k++) {
      const gap = rand.next() < 0.5;
      hazards.push(gap ? { kind: 'gap', x, y: 270, w: 50 + rand.int(21) } : { kind: 'swoop', x, y: 246, w: 60 });
      x += min + rand.int(spread + 1);
    }
    return { t: 0, result: null, dora: { x: 0, y: 270 }, jump: 0, hazards, flag: MOON_FLAG, cam: -120 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    s.dora.x += MOON_SPEED;
    if (!s.jump && i.pressed) s.jump = 1;
    else if (s.jump) s.jump = s.jump + 1 >= MOON_AIR ? 0 : s.jump + 1;
    s.dora.y = 270 - (s.jump ? MOON_LIFT * Math.sin(Math.PI * s.jump / MOON_AIR) : 0);
    s.cam = s.dora.x - 120;
    // A grounded Dora is lost once her centre is 8 units inside a gap or an owl's span: that foot room gives every press a window of 142 minus the span's width, in units (24 ticks at worst).
    if (!s.jump && s.hazards.some(h => s.dora.x > h.x + MOON_FOOT && s.dora.x < h.x + h.w - MOON_FOOT)) s.result = 'lose';
    else if (s.dora.x >= s.flag) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

MICROS.sneak = sneak;
MICROS.hide = hide;
MICROS.hush = hush;
MICROS.find = find;
MICROS.dodge = dodge;
MICROS.moon = moon;

// ── The Fox · Trick Fair ──────────────────────────────────────────────────────

/** A tap within 50 units of one of the three CHUTES positions, as its index, or -1. */
const nearChute = (x: number) => CHUTES.findIndex(cx => Math.abs(cx - x) <= 50);

// The face-up look and the count's flash start after the command word (48 ticks) has cleared the stage.
const PICK_UP = 40, PICK_FLIP = 100, PICK_SWAP = 20;
interface PickState {
  t: number; result: Outcome;
  target: number; cards: { x: number; y: number; suit: number }[]; up: boolean; slot: number[]; open: boolean;
  swaps: [number, number][]; mv: [number, number] | null;
}
const pick: Micro<PickState> = {
  id: 'pick', verb: 'PICK!', host: 3, boss: false, input: 'pick', ticks: 300, survive: false,
  init(rand, level) {
    const suits = rand.shuffle([0, 1, 2, 3]).slice(0, 3);
    return {
      t: 0, result: null, target: rand.pick(suits), cards: CHUTES.map((x, k) => ({ x, y: 190, suit: suits[k] })), up: false,
      slot: [0, 1, 2], open: false, swaps: makeSwaps(rand, level - 1), mv: null,
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    s.up = s.t > PICK_UP && s.t <= PICK_FLIP;
    if (s.t > PICK_FLIP && shuffleStep(s.cards, s, s.swaps, PICK_SWAP, s.t - 1 - PICK_FLIP, 190)) s.open = true;
    if (s.open) {
      const c = pickOf(i, x => {
        const k = s.cards.findIndex(card => Math.abs(card.x - x) <= 50);
        return k < 0 ? -1 : s.slot[k];
      });
      if (c >= 0) s.result = s.slot[s.cards.findIndex(card => card.suit === s.target)] === c ? 'win' : 'lose';
    }
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const POP_FROM = 340, POP_GONE = -30, POP_EVERY = 30;
interface Balloon { lane: number; x: number; y: number; v: number; colour: number; at: number; state: 'wait' | 'up' | 'popped' }
interface PopState { t: number; result: Outcome; balloons: Balloon[]; popped: number }
const pop: Micro<PopState> = {
  id: 'pop', verb: 'POP!', host: 3, boss: false, input: 'pick', ticks: 300, survive: false,
  init(rand, level) {
    const balloons: Balloon[] = [];
    for (let k = 0; k < [4, 5, 6][level - 1]; k++) {
      const lane = rand.int(3);
      balloons.push({ lane, x: CHUTES[lane], y: POP_FROM, v: 1.4 + rand.next() * 0.8, colour: rand.int(4), at: 1 + k * POP_EVERY, state: 'wait' });
    }
    return { t: 0, result: null, balloons, popped: 0 };
  },
  tick(s, i) {
    if (!begin(s)) return;
    for (const b of s.balloons) {
      if (b.state === 'wait' && s.t >= b.at) b.state = 'up';
      else if (b.state === 'up') { b.y -= b.v; if (b.y < POP_GONE) s.result = 'lose'; }
    }
    // a lane pops its lowest balloon that has come into view
    const c = pickOf(i, nearChute);
    let low: Balloon | undefined;
    if (c >= 0) for (const b of s.balloons) if (b.state === 'up' && b.lane === c && b.y <= 320 && (!low || b.y > low.y)) low = b;
    if (low) { low.state = 'popped'; s.popped++; }
    if (!s.result && s.popped >= s.balloons.length) s.result = 'win';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

// Held Space swings the power 0 → 1 in AIM_SWING ticks and back down; a pointer drag that starts on the slingshot sets it by distance.
const AIM_SLING = { x: 90, y: 230 }, AIM_GRAB = 60, AIM_PULL = 120, AIM_SWING = 90, AIM_FLY = 24;
interface AimState {
  t: number; result: Outcome; level: Level;
  sling: { x: number; y: number }; target: { x: number; y: number }; pull: { x: number; y: number } | null;
  mode: 'idle' | 'pull' | 'swing'; power: number; rising: boolean; base: number; centre: number; width: number; phase: number;
  shot: { x: number; y: number; t: number; power: number; hit: boolean } | null;
}
const aim: Micro<AimState> = {
  id: 'aim', verb: 'AIM!', host: 3, boss: false, input: 'hold', ticks: 300, survive: false,
  init(rand, level) {
    const base = 0.45 + rand.next() * 0.35;
    return {
      t: 0, result: null, level, sling: { ...AIM_SLING }, target: { x: 400, y: 150 }, pull: null,
      mode: 'idle', power: 0, rising: true, base, centre: base, width: [0.24, 0.18, 0.13][level - 1], phase: rand.next() * Math.PI * 2, shot: null,
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    if (s.level === 3) {
      // at level 3 the target bobs, and the power that reaches it moves with it
      const bob = Math.sin(s.t * 0.05 + s.phase);
      s.target.y = 150 + 40 * bob; s.centre = s.base - 0.08 * bob;
    }
    if (s.shot) {
      const sh = s.shot, p = ++sh.t / AIM_FLY, reach = s.target.x + (sh.hit ? 0 : (sh.power - s.centre) * 300);
      sh.x = s.sling.x + (reach - s.sling.x) * p; sh.y = s.sling.y + (s.target.y - s.sling.y) * p - Math.sin(p * Math.PI) * 60;
      if (sh.t >= AIM_FLY) s.result = sh.hit ? 'win' : 'lose';
      return;
    }
    if (i.pressed) {
      const grab = i.x >= 0 && Math.hypot(i.x - s.sling.x, i.y - s.sling.y) <= AIM_GRAB;
      s.mode = grab ? 'pull' : 'swing'; s.power = 0; s.rising = true;
    }
    if (s.mode === 'pull' && i.down && i.x >= 0) {
      s.power = Math.min(1, Math.hypot(i.x - s.sling.x, i.y - s.sling.y) / AIM_PULL); s.pull = { x: i.x, y: i.y };
    } else if (s.mode === 'swing' && i.down) {
      s.power += (s.rising ? 1 : -1) / AIM_SWING;
      if (s.power >= 1) { s.power = 1; s.rising = false; } else if (s.power <= 0) { s.power = 0; s.rising = true; }
    }
    if (i.released && s.mode !== 'idle') {
      s.shot = { x: s.sling.x, y: s.sling.y, t: 0, power: s.power, hit: Math.abs(s.power - s.centre) <= s.width / 2 };
      s.mode = 'idle'; s.pull = null;
    }
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

// The crane swings at constant speed round the top of the stack, so the stack can never drift out of its reach.
const STACK_BASE = { x: 240, y: 290, w: 80 }, CRATE_W = 60, CRATE_H = 30, CRATE_HOOK = 60, CRATE_FALL = 14, CRATE_WAIT = 6;
interface StackState {
  t: number; result: Outcome;
  need: number; amp: number; v: number; crane: { x: number; dir: -1 | 1 };
  placed: { x: number; y: number }[]; top: { x: number; y: number; w: number }; crate: { x: number; y: number; falling: boolean } | null; wait: number;
}
const stack: Micro<StackState> = {
  id: 'stack', verb: 'STACK!', host: 3, boss: false, input: 'timing', ticks: 300, survive: false,
  init(rand, level) {
    const amp = [100, 80, 60][level - 1];
    return {
      t: 0, result: null, need: [2, 3, 4][level - 1], amp, v: [2.2, 2.4, 2.6][level - 1],
      crane: { x: STACK_BASE.x - amp + rand.next() * 2 * amp, dir: rand.next() < 0.5 ? -1 : 1 },
      placed: [], top: { ...STACK_BASE }, crate: null, wait: 20,
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    const cr = s.crane;
    cr.x += cr.dir * s.v;
    if (cr.x > s.top.x + s.amp) { cr.x = s.top.x + s.amp; cr.dir = -1; } else if (cr.x < s.top.x - s.amp) { cr.x = s.top.x - s.amp; cr.dir = 1; }
    if (!s.crate && --s.wait <= 0) s.crate = { x: cr.x, y: CRATE_HOOK, falling: false };
    const c = s.crate;
    if (c && !c.falling) { c.x = cr.x; if (i.pressed) c.falling = true; }
    if (c && c.falling) {
      c.y += CRATE_FALL;
      if (c.y + CRATE_H / 2 >= s.top.y) {
        const overlap = Math.min(c.x + CRATE_W / 2, s.top.x + s.top.w / 2) - Math.max(c.x - CRATE_W / 2, s.top.x - s.top.w / 2);
        // 60% of the crate must land on the stack, or it topples off
        if (overlap >= 0.6 * CRATE_W) {
          s.placed.push({ x: c.x, y: s.top.y - CRATE_H / 2 });
          s.top = { x: c.x, y: s.top.y - CRATE_H, w: CRATE_W };
          s.crate = null; s.wait = CRATE_WAIT;
          if (s.placed.length >= s.need) s.result = 'win';
        } else s.result = 'lose';
      }
    }
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

const COUNT_SHOW = 40, COUNT_HIDE = 88;
interface CountState {
  t: number; result: Outcome;
  acorns: { x: number; y: number }[]; show: boolean; answers: number[]; right: number; open: boolean;
}
const count: Micro<CountState> = {
  id: 'count', verb: 'COUNT!', host: 3, boss: false, input: 'pick', ticks: 300, survive: false,
  init(rand, level) {
    const [lo, hi] = [[3, 5], [5, 8], [7, 11]][level - 1], n = lo + rand.int(hi - lo + 1);
    const acorns: { x: number; y: number }[] = [];
    // in a 300 × 140 box, at least 34 apart so none overlap
    while (acorns.length < n) {
      const a = { x: 90 + rand.int(301), y: 90 + rand.int(141) };
      if (acorns.every(o => Math.hypot(o.x - a.x, o.y - a.y) >= 34)) acorns.push(a);
    }
    const others = rand.shuffle([n - 2, n - 1, n + 1, n + 2].filter(m => m > 0)).slice(0, 2);
    const answers = rand.shuffle([n, ...others]);
    return { t: 0, result: null, acorns, show: false, answers, right: answers.indexOf(n), open: false };
  },
  tick(s, i) {
    if (!begin(s)) return;
    s.show = s.t > COUNT_SHOW && s.t <= COUNT_HIDE;
    s.open = s.t > COUNT_HIDE;
    if (s.open) {
      const c = pickOf(i, nearChute);
      if (c >= 0) s.result = c === s.right ? 'win' : 'lose';
    }
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

// Pegs slide right and wrap round the 480-unit stage; a ring thrown from x 240 lands RING_FLY ticks later.
const RING_X = 240, RING_Y = 230, RING_FLY = 30, RING_REACH = 20, RINGS = 8, RING_NEED = 5;
interface RingState {
  t: number; result: Outcome;
  pegs: { x: number; y: number }[]; v: number; mult: number; left: number; hits: number;
  flying: { t: number; x: number; y: number } | null; landed: { x: number; y: number; on: boolean }[];
}
const ring: Micro<RingState> = {
  id: 'ring', verb: 'TOSS!', host: 3, boss: true, input: 'timing', ticks: 900, survive: false,
  init(rand, level) {
    const off = rand.next() * 160;
    return {
      t: 0, result: null, pegs: [0, 1, 2].map(k => ({ x: (off + k * 160) % 480, y: RING_Y })), v: 1.8, mult: [1, 1.15, 1.3][level - 1],
      left: RINGS, hits: 0, flying: null, landed: [],
    };
  },
  tick(s, i) {
    if (!begin(s)) return;
    s.v = (1.8 + 0.8 * Math.min(1, s.t / this.ticks)) * s.mult;
    for (const p of s.pegs) p.x = (p.x + s.v) % 480;
    if (i.pressed && !s.flying && s.left > 0) { s.flying = { t: 0, x: RING_X, y: 300 }; s.left--; }
    const f = s.flying;
    if (f) {
      const p = ++f.t / RING_FLY;
      f.y = 300 + (RING_Y - 300) * p - Math.sin(p * Math.PI) * 50;
      if (f.t >= RING_FLY) {
        const on = s.pegs.some(peg => Math.abs(peg.x - RING_X) <= RING_REACH);
        if (on) s.hits++;
        s.landed.push({ x: RING_X, y: RING_Y, on }); s.flying = null;
      }
    }
    if (s.hits >= RING_NEED) s.result = 'win';
    else if (!s.flying && s.hits + s.left < RING_NEED) s.result = 'lose';
    lapse(s, this.ticks);
  },
  outcome: s => s.result,
};

MICROS.pick = pick;
MICROS.pop = pop;
MICROS.aim = aim;
MICROS.stack = stack;
MICROS.count = count;
MICROS.ring = ring;

/** Each host's five ordinary microgames, and their boss. */
export const HOST_GAMES: readonly MicroId[][] = [0, 1, 2, 3].map(h => MICRO_IDS.slice(h * 6, h * 6 + 5));
export const HOST_BOSS: readonly MicroId[] = [0, 1, 2, 3].map(h => MICRO_IDS[h * 6 + 5]);
