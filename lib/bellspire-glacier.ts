import { COLS, ROWS, TILE, type Room } from './bellspire-world.js';
import { glacierFlag, type FallState } from './bellspire-glacier-world.js';

const px = (room: Room, c: number, r: number) => ({ x: (room.gx * COLS + c + 0.5) * TILE, y: (room.gy * ROWS + r) * TILE });
export const glacierPoint = px;
export const GLACIER_TELL = { icicle: 44, vicuna: 62, osjollo: 66, warden: 62 } as const;
export const GLACIER_TIMING = { water: 270, ice: 430, helpWater: 420, helpIce: 680 } as const;

export function savedFall(room: Room, i: number, flag: (name: string) => boolean): FallState {
  const f = room.glacier?.falls?.[i];
  if (!f) return 'plug';
  return !f.timed && !room.boss
    ? flag(glacierFlag(room.id, 'frozen', i)) ? 'frozen' : flag(glacierFlag(room.id, 'water', i)) ? 'water' : f.starts ?? 'plug'
    : f.starts ?? 'plug';
}

export class GlacierTerrain {
  private falls = new Map<number, { state: FallState; until: number }>();
  private mirrors = new Set<number>();
  readonly icicles: { x: number; y: number; top: number; bottom: number; t: number; stage: 'idle' | 'tell' | 'fall' | 'spent' }[];

  constructor(readonly room: Room, private flag: (name: string) => boolean, private set: (name: string, v: boolean) => void) {
    this.icicles = (room.glacier?.icicles ?? []).map(([c, r]) => {
      const point = px(room, c, r);
      let floor = r + 1;
      while (floor < room.rows.length - 1 && !'#-='.includes(room.rows[floor][c])) floor++;
      return { ...point, top: point.y, bottom: px(room, c, floor).y, t: 0, stage: 'idle' };
    });
  }

  state(i: number): FallState { return this.falls.get(i)?.state ?? savedFall(this.room, i, this.flag); }
  left(i: number, tick: number) { const until = this.falls.get(i)?.until; return until === undefined ? Infinity : until - tick; }
  lit(i: number) {
    return this.mirrors.has(i) || (!this.room.boss && this.flag(glacierFlag(this.room.id, 'sun', i)));
  }
  powered(i: number, gateBeam = false) {
    const s = this.room.glacier?.sockets?.[i];
    if (!s) return false;
    if (this.room.boss === 'sun-gate') return gateBeam;
    return s.sun === true || (s.from !== undefined && this.lit(s.from));
  }
  target(i: number) {
    const s = this.room.glacier?.sockets?.[i], end = s?.path.at(-1);
    if (!end) return -1;
    return s?.fall ?? this.room.glacier?.falls?.findIndex(f => end[0] >= f.c && end[0] < f.c + f.w && end[1] >= f.top && end[1] < f.bottom) ?? -1;
  }
  turn(i: number, tick: number, assist: boolean, gateBeam = false) {
    if (!this.powered(i, gateBeam)) return false;
    const f = this.target(i);
    this.mirrors.add(i);
    if (!this.room.boss) this.set(glacierFlag(this.room.id, 'sun', i), true);
    if (f >= 0) this.change(f, 'water', tick, assist);
    return true;
  }
  change(i: number, state: FallState, tick: number, assist: boolean) {
    if (!this.room.glacier?.falls?.[i]) return;
    if (this.room.glacier.falls[i].timed || this.room.boss) {
      const duration = state === 'water' ? (assist ? GLACIER_TIMING.helpWater : GLACIER_TIMING.water)
        : state === 'frozen' ? (assist ? GLACIER_TIMING.helpIce : GLACIER_TIMING.ice) : Infinity;
      this.falls.set(i, { state, until: this.room.boss ? Infinity : tick + duration });
    } else {
      this.set(glacierFlag(this.room.id, 'water', i), state === 'water');
      this.set(glacierFlag(this.room.id, 'frozen', i), state === 'frozen');
    }
  }
  resetArena() { this.mirrors.clear(); this.falls.clear(); }
  update(tick: number, assist: boolean, occupied: (i: number) => boolean, hero: { x: number; y: number }) {
    for (const [i, f] of this.falls) {
      if (tick < f.until) continue;
      if (f.state === 'water') this.change(i, 'frozen', tick, assist);
      else if (f.state === 'frozen' && !occupied(i)) this.change(i, 'plug', tick, assist);
    }
    for (const icicle of this.icicles) {
      icicle.t++;
      if (icicle.stage === 'idle' && Math.abs(icicle.x - hero.x) < 47 && hero.y >= icicle.top + 10) {
        icicle.stage = 'tell'; icicle.t = 0;
      } else if (icicle.stage === 'tell' && icicle.t >= GLACIER_TELL.icicle * (assist ? 1.25 : 1)) {
        icicle.stage = 'fall'; icicle.t = 0;
      } else if (icicle.stage === 'fall') {
        icicle.y = Math.min(icicle.bottom, icicle.top + icicle.t * icicle.t * 0.24);
        if (icicle.y >= icicle.bottom) icicle.stage = 'spent';
      }
    }
  }
}
