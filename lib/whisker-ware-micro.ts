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

/** Each host's five ordinary microgames, and their boss. */
export const HOST_GAMES: readonly MicroId[][] = [0, 1, 2, 3].map(h => MICRO_IDS.slice(h * 6, h * 6 + 5));
export const HOST_BOSS: readonly MicroId[] = [0, 1, 2, 3].map(h => MICRO_IDS[h * 6 + 5]);
