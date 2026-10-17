// Whisker Ware: the engine core. Deterministic, no DOM; the microgame rules live in whisker-ware-micro.ts.
import { Rand, IDLE, MICROS, MICRO_IDS, HOST_GAMES, HOST_BOSS } from './whisker-ware-micro.js';
import type { Frame, Input, Level, MicroId, Outcome } from './whisker-ware-micro.js';

export { Rand, IDLE, MICROS, MICRO_IDS, HOST_GAMES, HOST_BOSS } from './whisker-ware-micro.js';
export type { Frame, Input, Level, Outcome, InputKind, MicroId, Micro } from './whisker-ware-micro.js';

export const SPEEDS: readonly number[] = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];

// ── Reading the pad ───────────────────────────────────────────────────────────

const SWIPE_UNITS = 40;
const RUB_UNITS = 12;

/** Turns raw frames into taps, swipes and rubs by remembering the previous frame. */
export class Pad {
  private prev: Frame = IDLE;
  private startX = -1;
  private lastX = -1;
  private dir = 0;
  private travel = 0;
  private lastKey: -1 | 0 | 1 = 0;

  read(f: Frame): Input {
    const p = this.prev;
    const pressed = f.down && !p.down;
    const released = !f.down && p.down;
    let swipe: -1 | 0 | 1 = 0;
    let rub = false;

    if (pressed) { this.startX = f.x; this.lastX = f.x; this.dir = 0; this.travel = 0; }
    if (f.down && !pressed && f.x >= 0 && this.lastX >= 0) {
      const dx = f.x - this.lastX;
      if (dx !== 0) {
        const d = dx > 0 ? 1 : -1;
        if (this.dir === 0 || d === this.dir) { this.travel += Math.abs(dx); this.dir = d; }
        else { if (this.travel >= RUB_UNITS) rub = true; this.dir = d; this.travel = Math.abs(dx); }
      }
    }
    if (f.down && f.x >= 0) this.lastX = f.x;
    if (released) {
      const endX = f.x >= 0 ? f.x : this.lastX;
      if (this.startX >= 0 && endX >= 0) {
        const dx = endX - this.startX;
        if (Math.abs(dx) >= SWIPE_UNITS) swipe = dx > 0 ? 1 : -1;
      }
      this.startX = -1; this.lastX = -1;
    }

    const leftEdge = f.left && !p.left;
    const rightEdge = f.right && !p.right;
    if (!swipe) swipe = leftEdge ? -1 : rightEdge ? 1 : 0;
    if (leftEdge) { if (this.lastKey === 1) rub = true; this.lastKey = -1; }
    if (rightEdge) { if (this.lastKey === -1) rub = true; this.lastKey = 1; }

    this.prev = f;
    return { ...f, pressed, released, swipe, rub, steer: ((f.right ? 1 : 0) - (f.left ? 1 : 0)) as -1 | 0 | 1 };
  }
}

/** The same input with every one-shot edge removed: used for each simulation step after the first in a real tick. */
export const calm = (i: Input): Input => ({ ...i, pressed: false, released: false, rub: false, swipe: 0, pick: 0 });

// ── Speed ─────────────────────────────────────────────────────────────────────

/** Runs `speed` simulation steps per real tick. Kept in integer hundredths so 100 ticks at ×1.15 are exactly 115 steps. */
export class Clock {
  private h: number;
  private acc = 0;
  constructor(speed: number) { this.h = Math.round(speed * 100); }
  steps(): number {
    this.acc += this.h;
    const n = Math.floor(this.acc / 100);
    this.acc -= n * 100;
    return n;
  }
}

// ── Replaying a microgame ─────────────────────────────────────────────────────

/** Plays one microgame exactly as `Run` will (Pad, Clock, `calm` after the first step; the 30-tick hold is ignored). `t` handed to `drive` is the real tick. */
export function simulate(id: MicroId, seed: number, level: Level, tier: number, drive: (s: any, t: number) => Frame): { result: 'win' | 'lose'; ticks: number } {
  const micro = MICROS[id];
  if (!micro) throw new Error(`simulate: no microgame registered for id "${id}"`);
  const s = micro.init(new Rand(seed), level);
  const pad = new Pad();
  const clock = new Clock(SPEEDS[tier]);
  let real = 0;
  while (micro.outcome(s) === null && s.t < micro.ticks) {
    const input = pad.read(drive(s, real));
    real++;
    const n = clock.steps();
    for (let k = 0; k < n; k++) {
      micro.tick(s, k === 0 ? input : calm(input));
      if (micro.outcome(s) !== null || s.t >= micro.ticks) break;
    }
  }
  const out = micro.outcome(s);
  return { result: out ?? (micro.survive ? 'win' : 'lose'), ticks: real };
}

// ── Hosts and pacing ──────────────────────────────────────────────────────────

export const HOSTS = [
  { id: 'enzo', name: 'Enzo', stage: "Enzo's Snack Shack" },
  { id: 'dora', name: 'Dora', stage: "Dora's Dust Spa" },
  { id: 'owl', name: 'The Owl', stage: "Owl's Night Watch" },
  { id: 'fox', name: 'The Fox', stage: "Fox's Trick Fair" },
] as const;

/** Each host stage's speed tier for games 1–4 and for games 5–8 plus the boss, and its level. */
export const STAGE_PACE: readonly { tiers: readonly [number, number]; level: Level }[] = [
  { tiers: [0, 1], level: 1 }, { tiers: [1, 2], level: 1 }, { tiers: [2, 3], level: 2 }, { tiers: [3, 4], level: 2 },
];

const STAGE_GAMES = 8, LIVES = 4, BREAK = 90, BREAK_FAST = 60, CARD = 45, HOLD = 30;
const REMIX_POOL = MICRO_IDS.filter(id => !HOST_BOSS.includes(id));

/** A host stage's eight games: each of the host's five at least once, never the same twice in a row. */
export function stageQueue(rand: Rand, host: number): MicroId[] {
  const five = HOST_GAMES[host];
  for (;;) {
    const q = rand.shuffle([...five, rand.pick(five), rand.pick(five), rand.pick(five)]);
    if (q.every((id, k) => k === 0 || id !== q[k - 1])) return q;
  }
}

export type Mode = 'host' | 'remix' | 'practice';
export type Phase = 'break' | 'micro' | 'over' | 'clear';
export type WareEvent = 'command' | 'win' | 'lose' | 'speedup' | 'boss' | 'over' | 'clear';

/**
 * One go at a host stage, Remix or Practice. `step` advances one real tick (60 a second): a break in the host's room,
 * then a microgame run at its speed tier, held 30 ticks once decided so the result shows, then the next break.
 */
export class Run {
  readonly mode: Mode;
  host = 0;
  lives = LIVES;
  /** The current (or next) game's speed tier and level. */
  tier = 0;
  level: Level = 1;
  cleared = 0;
  streak = 0;
  phase: Phase = 'break';
  game: MicroId | null = null;
  state: any = null;
  last: Outcome = null;
  card: 'speedup' | 'boss' | null = null;
  /** Real ticks spent in the current phase. */
  t = 0;
  /** Microgames started so far. */
  played = 0;
  wins: { id: MicroId; tier: number }[] = [];
  events: WareEvent[] = [];
  private rand: Rand;
  // One pad for the whole run, so a key held through a break is not a fresh press when the next game starts.
  private pad = new Pad();
  private clock = new Clock(1);
  private queue: MicroId[] = [];
  private index = 0;
  private result: Outcome = null;
  private hold = 0;
  private breakLen = BREAK;
  private sinceBoss = 0;
  private bosses = 0;

  constructor(mode: Mode, seed: number, opt: { host?: number; game?: MicroId } = {}) {
    this.mode = mode;
    this.rand = new Rand(seed);
    if (mode === 'host') {
      this.host = opt.host ?? 0;
      this.queue = [...stageQueue(this.rand, this.host), HOST_BOSS[this.host]];
      this.stageBreak(0, false);
    } else if (mode === 'remix') {
      this.next(this.rand.pick(REMIX_POOL), 0, 1, false);
    } else {
      if (!opt.game || !MICROS[opt.game]) throw new Error(`Run: practice needs a microgame, got "${opt.game}"`);
      this.lives = 1;
      this.next(opt.game, 0, 1, false);
    }
  }

  /** Plays `id` straight away at the given level and tier (for tests); the run carries on normally afterwards. */
  force(id: MicroId, level: Level, tier: number) {
    this.game = id; this.level = level; this.tier = tier; this.card = null;
    this.start();
  }

  step(f: Frame) {
    const input = this.pad.read(f);
    if (this.phase === 'over' || this.phase === 'clear') return;
    this.t++;
    if (this.phase === 'break') { if (this.t >= this.breakLen) this.start(); return; }
    const micro = MICROS[this.game!]!;
    if (this.result) { if (--this.hold <= 0) this.settle(); return; }
    const n = this.clock.steps();
    for (let k = 0; k < n && micro.outcome(this.state) === null && this.state.t < micro.ticks; k++) micro.tick(this.state, k === 0 ? input : calm(input));
    const out = micro.outcome(this.state);
    if (out !== null || this.state.t >= micro.ticks) {
      this.result = out ?? (micro.survive ? 'win' : 'lose');
      this.hold = HOLD;
      this.events.push(this.result);
    }
  }

  drain(): WareEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private start() {
    const micro = MICROS[this.game!]!;
    this.state = micro.init(this.rand, this.level);
    this.clock = new Clock(SPEEDS[this.tier]);
    this.phase = 'micro'; this.t = 0; this.result = null; this.played++;
    this.events.push('command');
  }

  /** Sets up the break before `id`, with a card when the speed rises or a boss is due. */
  private next(id: MicroId, tier: number, level: Level, faster: boolean) {
    this.game = id; this.tier = tier; this.level = level;
    this.card = MICROS[id]!.boss ? 'boss' : faster ? 'speedup' : null;
    if (this.card) this.events.push(this.card);
    this.breakLen = (tier >= 4 ? BREAK_FAST : BREAK) + (this.card ? CARD : 0);
    this.phase = 'break'; this.t = 0; this.state = null;
  }

  /** The break before host-stage game `index` (0–7, then 8 for the boss). */
  private stageBreak(index: number, faster: boolean) {
    this.index = index;
    const pace = STAGE_PACE[this.host];
    this.next(this.queue[index], pace.tiers[index < 4 ? 0 : 1], pace.level, faster);
  }

  private settle() {
    const id = this.game!, boss = MICROS[id]!.boss, won = this.result === 'win';
    this.last = this.result;
    if (won) { this.cleared++; this.streak++; this.wins.push({ id, tier: this.tier }); }
    else this.lives--;
    if (this.lives <= 0) { this.end('over'); return; }
    if (this.mode === 'host') {
      if (boss && won) { this.end('clear'); return; }
      if (boss) { this.stageBreak(this.index, false); return; }
      const at = Math.min(this.index + 1, STAGE_GAMES);
      this.stageBreak(at, at === 4);
    } else if (this.mode === 'remix') {
      if (boss && !won) { this.next(id, this.tier, this.level, false); return; }
      let level = this.level;
      if (boss) { this.bosses++; this.sinceBoss = 0; level = Math.min(3, level + 1) as Level; } else if (won) this.sinceBoss++;
      const tier = Math.min(5, Math.floor(this.cleared / 5));
      const pick = this.sinceBoss >= 10 ? HOST_BOSS[this.bosses % 4] : this.rand.pick(REMIX_POOL.filter(g => g !== id));
      this.next(pick, tier, level, tier > this.tier);
    } else {
      const tier = Math.min(5, Math.floor(this.streak / 3));
      this.next(id, tier, Math.min(3, 1 + Math.floor(this.streak / 6)) as Level, tier > this.tier);
    }
  }

  private end(phase: 'over' | 'clear') {
    this.phase = phase; this.t = 0; this.state = null;
    this.events.push(phase);
  }
}

// ── The saved profile ─────────────────────────────────────────────────────────

export type Profile = { v: 1; hosts: number; remixBest: number; games: Record<string, { tier: number; streak: number }> };

export const freshProfile = (): Profile => ({ v: 1, hosts: 0, remixBest: 0, games: {} });

const isInt = (n: unknown, lo: number, hi = Infinity): n is number => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;

/** Reads a saved profile; anything malformed gives a fresh one, and unknown microgames are dropped. */
export function loadProfile(raw: string | null): Profile {
  try {
    const p = JSON.parse(raw ?? '');
    if (!p || p.v !== 1 || !isInt(p.hosts, 0, 4) || !isInt(p.remixBest, 0)) return freshProfile();
    if (!p.games || typeof p.games !== 'object' || Array.isArray(p.games)) return freshProfile();
    const games: Profile['games'] = {};
    for (const [id, g] of Object.entries(p.games as Record<string, any>)) {
      if (!(MICRO_IDS as readonly string[]).includes(id)) continue;
      if (!g || !isInt(g.tier, -1, 5) || !isInt(g.streak, 0)) return freshProfile();
      games[id] = { tier: g.tier, streak: g.streak };
    }
    return { v: 1, hosts: p.hosts, remixBest: p.remixBest, games };
  } catch {
    return freshProfile();
  }
}

/** Folds a run into the profile, keeping bests; recording the same run twice changes nothing. */
export function record(p: Profile, run: Run): Profile {
  const games = Object.fromEntries(Object.entries(p.games).map(([id, g]) => [id, { ...g }]));
  for (const w of run.wins) {
    const g = (games[w.id] ??= { tier: -1, streak: 0 });
    g.tier = Math.max(g.tier, w.tier);
  }
  if (run.mode === 'practice' && run.game) {
    const g = (games[run.game] ??= { tier: -1, streak: 0 });
    g.streak = Math.max(g.streak, run.streak);
  }
  return {
    v: 1,
    hosts: run.mode === 'host' && run.phase === 'clear' ? Math.max(p.hosts, run.host + 1) : p.hosts,
    remixBest: run.mode === 'remix' ? Math.max(p.remixBest, run.cleared) : p.remixBest,
    games,
  };
}

/** What a profile has opened: host stages in order, Remix after the Fox, and Practice for every game won. */
export function unlocked(p: Profile): { hosts: boolean[]; remix: boolean; games: MicroId[] } {
  return {
    hosts: [0, 1, 2, 3].map(h => h <= p.hosts),
    remix: p.hosts >= 4,
    games: MICRO_IDS.filter(id => (p.games[id]?.tier ?? -1) >= 0),
  };
}
