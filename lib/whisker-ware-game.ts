// Whisker Ware: the engine core. Deterministic, no DOM; the microgame rules live in whisker-ware-micro.ts.
import { Rand, IDLE, MICROS } from './whisker-ware-micro.js';
import type { Frame, Input, Level, MicroId } from './whisker-ware-micro.js';

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
