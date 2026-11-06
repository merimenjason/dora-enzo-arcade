// Snowball Siege: the rules, deterministic at 60 ticks a second with no DOM. Two voxel snow forts face each other
// across a valley. Every snowball is dug out of your own fort (fast) or scooped from the floor snow (slow), so each
// throw is a trade between cover and ammo; every hit knocks real cubes out of theirs, cubes no longer joined to the
// ground fall, and a side loses when the top of its flag tower is gone. Six hand-made slopes against the neighbours,
// a two-player versus, and the computer players (and the test bots) built from one Brain with human reaction times.
//
// Axes: x runs along the valley (we are on the left, x small), y is up, z is depth (towards the camera is z large).
// A cube (x, y, z) fills [x, x+1] × [y, y+1] × [z, z+1]; the ground is the plane y = 0.

export const TICK = 60;
export const W = 42, H = 14, D = 11;
export const G = 22;                    // gravity, cubes a second squared
export const VMAX = 36;                 // fastest throw
export const POOL = 5;                  // snowballs a side can hold
export const MATCH_TICKS = 120 * TICK;
export const DIG_TICKS = 21, FLOOR_TICKS = 130, PATCH_TICKS = 18, ROLL_TICKS = 300;
export const STUN_TICKS = 90, SPLASH_TICKS = 150, STAND_AFTER = 30, HARD_HOLD = 60;
export const REACH = 3.2;
export const STAND_H = 3.3, DUCK_H = 1.3, BODY_R = 0.55;
export const SAVE_KEY = 'snowball-siege-v1';

export type Side = 0 | 1;
export type Species = 'dora' | 'enzo' | 'vizcacha' | 'pudu' | 'guanaco' | 'fox' | 'flamingo' | 'bear';
export type SlopeId = 'sunny' | 'pond' | 'ridge' | 'pines' | 'lagoon' | 'summit' | 'versus';

export interface Rival { names: [string, string]; species: Species; blurb: string }
export interface AiParams {
  react: number;        // ticks before it notices something
  err: number;          // spread of its throws, as a share of the speed
  gap: number;          // ticks it waits between throws
  wallDig: number;      // chance it digs a wall (fast) rather than floor snow
  careless: number;     // chance a wall dig takes the front wall in front of it (opening a hole) instead of a spare cube
  hunt: number;         // chance it goes for a standing character rather than the tower
  hard: number;         // chance it packs a hard snowball when it has the ammo
  patch: number;        // chance it pats holes in its front wall back in
  switchy: number;      // chance it swaps thrower after a throw
  lob: number;          // chance it throws the high arc
  wind: number;         // how much of the wind it allows for (0 to 1)
}
export interface Slope {
  id: SlopeId; n: number; name: string; blurb: string; rival: Rival;
  ice?: boolean; wind?: boolean; pines?: boolean; lagoon?: boolean; big?: boolean; ai: AiParams;
  tips: string[];
}

const P = (o: Partial<AiParams>): AiParams => ({ react: 14, err: 0.08, gap: 120, wallDig: 0.6, careless: 0.3, hunt: 0.2, hard: 0.1, patch: 0, switchy: 0.1, lob: 0.3, wind: 0.5, ...o });

export const SLOPES: Slope[] = [
  { id: 'sunny', n: 1, name: 'Sunny Slope', blurb: 'A gentle first fight on the slope behind the burrow.',
    rival: { names: ['Vicu', 'Chita'], species: 'vizcacha', blurb: 'The Vizcacha Twins: cheeky cousins who throw slowly and dig their own walls away.' },
    ai: P({ react: 24, err: 0.15, gap: 215, wallDig: 0.95, careless: 0.8, hunt: 0.05, hard: 0, lob: 0.2, wind: 0 }),
    tips: ['Click a cube of your own fort to scoop a snowball out of it. Fast, but it leaves a hole.', 'Drag back from Dora and let go to throw. Knock the top off their flag tower to win.', 'Click the floor snow for a slow snowball that costs no wall. Right-click a gap to pat a snowball back in.'] },
  { id: 'pond', n: 2, name: 'Frozen Pond', blurb: 'The forts stand on the edge of the ice. Snowballs crack it.', ice: true,
    rival: { names: ['Pía', 'Poco'], species: 'pudu', blurb: 'The Pudú Pair: tiny deer whose stray snowballs crack the ice inside your fort.' },
    ai: P({ react: 20, err: 0.125, gap: 185, wallDig: 0.8, careless: 0.55, hunt: 0.15, hard: 0.05, lob: 0.35, wind: 0 }),
    tips: ['Snowballs that land on the ice crack it. Stand on a hole and you fall in.'] },
  { id: 'ridge', n: 3, name: 'Windy Ridge', blurb: 'A high ridge where the wind pushes every snowball.', wind: true,
    rival: { names: ['Gus', 'Guada'], species: 'guanaco', blurb: 'The Guanaco Gang: tall, long throwers who dig slowly.' },
    ai: P({ react: 14, err: 0.045, gap: 104, wallDig: 0.45, careless: 0.4, hunt: 0.2, hard: 0.1, lob: 0.5, wind: 0.55 }),
    tips: ['Watch the windsock: the wind drifts every throw, and it changes every few seconds.'] },
  { id: 'pines', n: 4, name: 'Pine Wood', blurb: 'Snowy pines stand by both forts.', pines: true,
    rival: { names: ['Cula', 'Pepo'], species: 'fox', blurb: 'The Culpeo Foxes: quick and sneaky, and they swap throwers all the time.' },
    ai: P({ react: 13, err: 0.05, gap: 104, wallDig: 0.6, careless: 0.25, hunt: 0.35, hard: 0.15, switchy: 0.6, lob: 0.35, wind: 0 }),
    tips: ['Hit a pine and it drops its snow on whoever is underneath.'] },
  { id: 'lagoon', n: 5, name: 'Salt Lagoon', blurb: 'A pink lagoon between the forts.', lagoon: true,
    rival: { names: ['Rosa', 'Lila'], species: 'flamingo', blurb: 'The Flamingo Sisters: long high lobs that pick off anyone standing up.' },
    ai: P({ react: 12, err: 0.05, gap: 100, wallDig: 0.55, careless: 0.2, hunt: 0.55, hard: 0.1, lob: 0.85, wind: 0 }),
    tips: ['High lobs come down from above: don’t stand up for long.'] },
  { id: 'summit', n: 6, name: 'The Summit', blurb: 'The final, on top of the mountain, against the biggest fort.', big: true,
    rival: { names: ['Oso', 'Osa'], species: 'bear', blurb: 'The Spectacled Bears: hard snowballs, and Osa pats every hole back in.' },
    ai: P({ react: 11, err: 0.043, gap: 100, wallDig: 0.5, careless: 0.1, hunt: 0.3, hard: 0.45, patch: 0.7, lob: 0.4, wind: 0 }),
    tips: ['Hold still on a throw for a second to pack a hard snowball: it costs two and takes out a cross of cubes.'] },
];
export const VERSUS: Slope = { id: 'versus', n: 0, name: 'Versus', blurb: 'Dora’s fort against Enzo’s.', rival: { names: ['Enzo', ''], species: 'enzo', blurb: 'Two players, one keyboard.' }, ai: P({}), tips: [] };
export const slopeOf = (id: SlopeId) => id === 'versus' ? VERSUS : SLOPES.find((s) => s.id === id)!;

// ---------------------------------------------------------------- randomness
export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}

// ---------------------------------------------------------------- state
export interface Char {
  side: Side; i: number; species: Species; name: string;
  x: number; z: number;
  busy: number; doing: '' | 'dig' | 'floor' | 'patch';
  job: { x: number; y: number; z: number } | null;
  stun: number; stand: number; aiming: boolean; aimTicks: number;
  splash: boolean;
}
export interface Ball { side: Side; x: number; y: number; z: number; vx: number; vy: number; hard: boolean; age: number }
export type Ev =
  | { k: 'throw'; side: Side; hard: boolean }
  | { k: 'hit'; x: number; y: number; z: number; hard: boolean; side: Side }
  | { k: 'cube'; x: number; y: number; z: number; vx: number; vy: number; vz: number }
  | { k: 'land'; x: number; z: number; what: 'snow' | 'ice' | 'water' }
  | { k: 'crack'; x: number; z: number; level: number }
  | { k: 'stun'; side: Side; i: number; how: 'hit' | 'splash' | 'pine' }
  | { k: 'dig'; side: Side; floor: boolean }
  | { k: 'patch'; side: Side; x: number; y: number; z: number }
  | { k: 'pine'; i: number }
  | { k: 'flag'; side: Side; fell: boolean }
  | { k: 'wind'; wind: number }
  | { k: 'end'; winner: Side | -1; how: 'flag' | 'time' };

export interface Fort { flag: { x: number; z: number; top: number; y: number; up: boolean }; start: number; towerStart: number }   // flag.y: cubes left in the tower's top three layers
export interface Pine { x: number; z: number; snow: number }

export class Match {
  slope: Slope; seed: number; rng: number;
  grid: Uint8Array;                    // 0 empty, 1 our snow, 2 their snow, 3 rock
  ice: Uint8Array;                     // per (x, z) on the ground: 0 none, 1 whole, 2–3 cracked, 4 hole
  iceT: Uint16Array;                   // ticks until a hole refreezes
  chars: Char[]; balls: Ball[] = [];
  ammo: [number, number] = [2, 2];
  active: [number, number] = [0, 0];
  forts: [Fort, Fort];
  pines: Pine[] = [];
  wind = 0; windNext = 0;
  t = 0; over = false; winner: Side | -1 = -1; how: 'flag' | 'time' | '' = '';
  events: Ev[] = [];
  humans: [boolean, boolean];
  brains: [Brain | null, Brain | null];
  move: [number, number] = [0, 0];     // -1, 0 or 1: the human's walk along the fort
  stats = { thrown: [0, 0], hits: [0, 0], dug: [0, 0], floor: [0, 0], patched: [0, 0], stunned: [0, 0], knocked: [0, 0] };   // knocked[s]: cubes s knocked out of the other fort

  constructor(slopeId: SlopeId, seed: number, opts: { humans?: [boolean, boolean]; bot?: BotKind; rival?: BotKind } = {}) {
    this.slope = slopeOf(slopeId); this.seed = seed; this.rng = seed >>> 0 || 1;
    this.grid = new Uint8Array(W * H * D);
    this.ice = new Uint8Array(W * D); this.iceT = new Uint16Array(W * D);
    this.humans = opts.humans ?? (slopeId === 'versus' ? [true, true] : [true, false]);
    const big = !!this.slope.big;
    this.forts = [buildFort(this, 0, big), buildFort(this, 1, big)];
    for (const s of [0, 1] as Side[]) { this.forts[s].start = this.count(s); this.forts[s].towerStart = this.towerCount(s); }
    if (this.slope.ice) for (let x = 0; x < W; x++) for (let z = 1; z < D - 1; z++) { const lx = x < W / 2 ? x : W - 1 - x; if (lx >= 7 && lx <= 12) this.ice[x * D + z] = 1; }
    if (this.slope.pines) this.pines = [{ x: 14.5, z: 2.5, snow: 1 }, { x: 14.5, z: 8.5, snow: 1 }, { x: W - 14.5, z: 2.5, snow: 1 }, { x: W - 14.5, z: 8.5, snow: 1 }];
    const versus = slopeId === 'versus';
    const ours: [Species, Species] = ['dora', 'enzo'];
    const theirs: [Species, Species] = versus ? ['enzo', 'enzo'] : [this.slope.rival.species, this.slope.rival.species];
    const names: [string, string] = versus ? ['Enzo', ''] : this.slope.rival.names;
    this.chars = [
      mkChar(0, 0, versus ? 'dora' : ours[0], 'Dora', 10.5, 3.5), mkChar(0, 1, ours[1], 'Enzo', 10.5, 7.5),
      mkChar(1, 0, theirs[0], names[0], W - 10.5, 7.5), mkChar(1, 1, theirs[1], names[1] || names[0], W - 10.5, 3.5),
    ];
    if (versus) { this.chars = [this.chars[0], this.chars[2]]; this.chars[1].i = 0; }
    this.brains = [
      !this.humans[0] ? new Brain(this, 0, opts.bot ?? 'pro') : null,
      !this.humans[1] ? new Brain(this, 1, opts.rival ?? 'rival') : null,
    ];
    if (this.slope.wind) this.windNext = 0;
  }

  // ---------------------------------------------------------------- the grid
  idx(x: number, y: number, z: number) { return (x * H + y) * D + z; }
  in(x: number, y: number, z: number) { return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D; }
  at(x: number, y: number, z: number) { return this.in(x, y, z) ? this.grid[this.idx(x, y, z)] : 0; }
  set(x: number, y: number, z: number, v: number) { if (this.in(x, y, z)) this.grid[this.idx(x, y, z)] = v; }
  sideOfX(x: number): Side { return x < W / 2 ? 0 : 1; }
  count(side: Side) { let n = 0; const want = side + 1; for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === want) n++; return n; }
  towerCount(side: Side) { const f = this.forts[side]?.flag; if (!f) return 0; let n = 0; for (let x = f.x - 1; x <= f.x + 1; x++) for (let z = f.z - 1; z <= f.z + 1; z++) for (let y = 0; y < f.top; y++) if (this.at(x, y, z)) n++; return n; }
  /** the share of a fort's snow that's gone, 0 to 1 */
  lost(side: Side) { const f = this.forts[side]; return f.start ? 1 - this.count(side) / f.start : 0; }
  next() { const [v, s] = rngNext(this.rng); this.rng = s; return v; }

  chars_(side: Side) { return this.chars.filter((c) => c.side === side); }
  activeChar(side: Side) { const cs = this.chars_(side); return cs[Math.min(this.active[side], cs.length - 1)]; }
  /** the height a character's head reaches: standing up to throw, or ducked */
  height(c: Char) { return c.stand > 0 || c.aiming ? STAND_H : DUCK_H; }
  ready(c: Char) { return !this.over && c.stun <= 0 && c.busy <= 0; }

  // ---------------------------------------------------------------- actions (the page and the brains call these)
  switchTo(side: Side, i?: number) {
    const cs = this.chars_(side); if (cs.length < 2) return false;
    const cur = this.activeChar(side); if (cur.busy > 0 && cur.doing !== 'floor') return false;
    const to = i ?? (this.active[side] + 1) % cs.length; if (to === this.active[side]) return false;
    if (cur.doing === 'floor') { cur.busy = 0; cur.doing = ''; }
    cur.aiming = false; this.active[side] = to; return true;
  }
  /** can this character scoop this cube: their own fort's snow, within reach */
  canDig(c: Char, x: number, y: number, z: number) {
    if (this.at(x, y, z) !== c.side + 1) return false;
    const f = this.forts[c.side].flag; if (Math.abs(x - f.x) <= 1 && Math.abs(z - f.z) <= 1 && y >= f.top - 1) return false;  // never the flag's own cubes
    return Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) <= REACH && y <= 3;
  }
  dig(side: Side, x: number, y: number, z: number) {
    const c = this.activeChar(side);
    if (!this.ready(c) || this.ammo[side] >= POOL || !this.canDig(c, x, y, z)) return false;
    // the top cube of that column goes, so digging never leaves a floating cube
    let top = y; while (this.at(x, top + 1, z) === side + 1 && top < 3) top++;
    c.busy = DIG_TICKS; c.doing = 'dig'; c.job = { x, y: top, z }; c.aiming = false;
    return true;
  }
  /** the wall cube right in front of the thrower (for the keyboard and the bots) */
  frontCube(side: Side): { x: number; y: number; z: number } | null {
    const c = this.activeChar(side), dir = side === 0 ? 1 : -1, z = Math.floor(c.z);
    for (let k = 0; k <= 3; k++) {
      const x = Math.floor(c.x) + dir * k;
      for (let y = 3; y >= 0; y--) if (this.canDig(c, x, y, z)) return { x, y, z };
    }
    return null;
  }
  scoopFloor(side: Side) {
    const c = this.activeChar(side);
    if (!this.ready(c) || this.ammo[side] >= POOL) return false;
    c.busy = FLOOR_TICKS; c.doing = 'floor'; c.job = null; c.aiming = false; return true;
  }
  canPatch(c: Char, x: number, y: number, z: number) {
    if (!this.in(x, y, z) || this.at(x, y, z) || y > 3 || this.sideOfX(x) !== c.side) return false;
    if (Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) > REACH) return false;
    if (Math.abs(x + 0.5 - c.x) < 0.9 && Math.abs(z + 0.5 - c.z) < 0.9) return false;   // not on top of yourself
    if (this.chars.some((o) => Math.abs(x + 0.5 - o.x) < 0.9 && Math.abs(z + 0.5 - o.z) < 0.9)) return false;
    return y === 0 || !!this.at(x, y - 1, z);
  }
  patch(side: Side, x: number, y: number, z: number) {
    const c = this.activeChar(side);
    if (!this.ready(c) || this.ammo[side] < 1 || !this.canPatch(c, x, y, z)) return false;
    c.busy = PATCH_TICKS; c.doing = 'patch'; c.job = { x, y, z }; c.aiming = false; this.ammo[side]--;
    return true;
  }
  /** start or stop aiming: a character aiming stands up, so it can be hit */
  aim(side: Side, on: boolean) { const c = this.activeChar(side); if (on && !this.ready(c)) return false; if (c.aiming !== on) c.aimTicks = 0; c.aiming = on && this.ammo[side] > 0; return c.aiming; }
  /** where a throw leaves the hand */
  hand(c: Char) { return { x: c.x + (c.side === 0 ? 0.5 : -0.5), y: 2.9, z: c.z }; }
  throw(side: Side, vx: number, vy: number, hard = false) {
    const c = this.activeChar(side);
    if (!this.ready(c) || this.ammo[side] < 1) { c.aiming = false; return false; }
    if (hard && this.ammo[side] < 2) hard = false;
    const sp = Math.hypot(vx, vy); if (sp < 4) { c.aiming = false; return false; }
    if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
    const h = this.hand(c);
    this.balls.push({ side, x: h.x, y: h.y, z: h.z, vx, vy, hard, age: 0 });
    this.ammo[side] -= hard ? 2 : 1;
    c.aiming = false; c.stand = STAND_AFTER; c.aimTicks = 0;
    this.stats.thrown[side]++; this.events.push({ k: 'throw', side, hard });
    return true;
  }
  /** the path a throw would take, for the preview and the brains: points every few ticks until it hits something */
  path(side: Side, vx: number, vy: number, maxTicks = 240, from?: { x: number; y: number; z: number }) {
    const c = this.activeChar(side), h = from ?? this.hand(c);
    const sp = Math.hypot(vx, vy); if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
    const b: Ball = { side, x: h.x, y: h.y, z: h.z, vx, vy, hard: false, age: 0 };
    const pts: { x: number; y: number; z: number }[] = [{ x: b.x, y: b.y, z: b.z }];
    let end: { x: number; y: number; z: number; cube: boolean; char: Char | null } | null = null;
    for (let t = 0; t < maxTicks && !end; t++) {
      end = this.fly(b, false);
      if (t % 3 === 2) pts.push({ x: b.x, y: b.y, z: b.z });
    }
    return { pts, end };
  }

  // ---------------------------------------------------------------- the tick
  step() {
    this.events = [];
    if (this.over) return;
    this.t++;
    // wind on the ridge changes every 15 s
    if (this.slope.wind && this.t >= this.windNext) {
      this.wind = Math.round((this.next() * 2 - 1) * 6 * 10) / 10; if (Math.abs(this.wind) < 1.5) this.wind = this.wind < 0 ? -2 : 2;
      this.windNext = this.t + 15 * TICK; this.events.push({ k: 'wind', wind: this.wind });
    }
    for (const s of [0, 1] as Side[]) this.brains[s]?.tick();
    for (const c of this.chars) this.stepChar(c);
    for (const b of this.balls.slice()) { const end = this.fly(b, true); if (end) this.balls.splice(this.balls.indexOf(b), 1); }
    for (let i = 0; i < this.iceT.length; i++) if (this.iceT[i] > 0 && --this.iceT[i] === 0) this.ice[i] = 1;
    if (this.t >= MATCH_TICKS) this.finish('time');
  }

  private stepChar(c: Char) {
    const side = c.side, active = this.activeChar(side) === c;
    if (c.stun > 0) { c.stun--; c.aiming = false; if (c.stun === 0) c.splash = false; return; }
    if (c.stand > 0) c.stand--;
    if (c.aiming) c.aimTicks++;
    // walking along the fort (only the one you're controlling, and not while busy)
    if (active && c.busy <= 0) {
      const dz = this.move[side];
      if (dz) c.z = Math.max(1, Math.min(D - 1, c.z + dz * 5 / TICK));
    }
    // the one who isn't throwing shuffles out of the thrower's way
    if (!active && c.busy <= 0) {
      const a = this.activeChar(side), gap = c.z - a.z;
      if (Math.abs(gap) < 1.6) {
        let dir = gap === 0 ? (a.z < D / 2 ? 1 : -1) : Math.sign(gap);
        if ((dir > 0 && c.z > D - 2) || (dir < 0 && c.z < 2)) dir = -dir;
        c.z = Math.max(1, Math.min(D - 1, c.z + dir * 4 / TICK));
      }
    }
    // the partner rolls snowballs from the floor snow, slowly
    if (!active && this.humans[side] && this.chars_(side).length > 1 && this.t % ROLL_TICKS === 0 && this.ammo[side] < POOL) { this.ammo[side]++; this.events.push({ k: 'dig', side, floor: true }); this.stats.floor[side]++; }
    if (!active && !this.humans[side] && this.t % ROLL_TICKS === 0 && this.ammo[side] < POOL) { this.ammo[side]++; this.stats.floor[side]++; }
    // standing on a hole in the ice
    if (this.slope.ice) { const k = Math.floor(c.x) * D + Math.floor(c.z); if (this.ice[k] === 4 && c.stun <= 0) { c.stun = SPLASH_TICKS; c.splash = true; c.busy = 0; c.doing = ''; this.stats.stunned[side]++; this.events.push({ k: 'stun', side, i: c.i, how: 'splash' }); this.nudge(c); } }
    if (c.busy > 0 && --c.busy === 0) {
      if (c.doing === 'dig' && c.job) {
        const { x, y, z } = c.job;
        if (this.at(x, y, z) === side + 1) { this.set(x, y, z, 0); this.ammo[side] = Math.min(POOL, this.ammo[side] + 1); this.stats.dug[side]++; this.events.push({ k: 'dig', side, floor: false }); this.support(); this.flagCheck(); }
      } else if (c.doing === 'floor') { this.ammo[side] = Math.min(POOL, this.ammo[side] + 1); this.stats.floor[side]++; this.events.push({ k: 'dig', side, floor: true }); }
      else if (c.doing === 'patch' && c.job) {
        const { x, y, z } = c.job;
        if (!this.at(x, y, z)) { this.set(x, y, z, side + 1); this.stats.patched[side]++; this.events.push({ k: 'patch', side, x, y, z }); } else this.ammo[side]++;
      }
      c.doing = ''; c.job = null;
    }
  }

  /** a character who fell in the ice climbs back out onto solid ground */
  private nudge(c: Char) {
    for (let d = 1; d < 4; d++) for (const dz of [0, -d, d]) { const z = c.z + dz; if (z < 1 || z > D - 1) continue; if (this.ice[Math.floor(c.x) * D + Math.floor(z)] !== 4) { c.z = z; return; } }
  }

  /** one tick of a snowball's flight; returns where it stopped, or null while it flies. Real hits only when apply. */
  fly(b: Ball, apply: boolean): { x: number; y: number; z: number; cube: boolean; char: Char | null } | null {
    const sub = 4, dt = 1 / TICK / sub;
    for (let s = 0; s < sub; s++) {
      b.vy -= G * dt; if (this.slope.wind) b.vx += this.wind * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.age++;
      if (b.x < -4 || b.x > W + 4) return { x: b.x, y: b.y, z: b.z, cube: false, char: null };
      // characters on the other side
      for (const c of this.chars) {
        if (c.side === b.side) continue;
        if (Math.abs(b.x - c.x) < BODY_R + 0.2 && Math.abs(b.z - c.z) < BODY_R + 0.2 && b.y > 0 && b.y < this.height(c)) {
          if (apply) this.hitChar(c, b);
          return { x: b.x, y: b.y, z: b.z, cube: false, char: c };
        }
      }
      // pines
      for (let i = 0; i < this.pines.length; i++) {
        const p = this.pines[i];
        if (Math.abs(b.x - p.x) < 1.1 && Math.abs(b.z - p.z) < 1.4 && b.y > 0.5 && b.y < 6.5) {
          if (apply) this.hitPine(i);
          return { x: b.x, y: b.y, z: b.z, cube: false, char: null };
        }
      }
      const x = Math.floor(b.x), y = Math.floor(b.y), z = Math.floor(b.z);
      if (b.y <= 0) {
        if (apply) this.land(b);
        return { x: b.x, y: 0, z: b.z, cube: false, char: null };
      }
      if (this.at(x, y, z)) {
        if (apply) this.hitCube(x, y, z, b);
        return { x, y, z, cube: true, char: null };
      }
    }
    return null;
  }

  private land(b: Ball) {
    const x = Math.floor(b.x), z = Math.floor(b.z), k = x * D + z;
    if (this.slope.ice && x >= 0 && x < W && this.ice[k] && this.ice[k] < 4) {
      this.ice[k] = Math.min(4, this.ice[k] + (b.hard ? 2 : 1)); if (this.ice[k] === 4) this.iceT[k] = 12 * TICK;
      this.events.push({ k: 'crack', x, z, level: this.ice[k] });
      this.events.push({ k: 'land', x: b.x, z: b.z, what: 'ice' });
      return;
    }
    const lagoon = this.slope.lagoon && b.x > 17 && b.x < W - 17;
    this.events.push({ k: 'land', x: b.x, z: b.z, what: lagoon ? 'water' : 'snow' });
  }

  private hitChar(c: Char, b: Ball) {
    c.stun = STUN_TICKS; c.busy = 0; c.doing = ''; c.job = null; c.aiming = false; c.stand = 0;
    this.stats.hits[b.side]++; this.stats.stunned[c.side]++;
    this.events.push({ k: 'stun', side: c.side, i: c.i, how: 'hit' });
  }

  private hitPine(i: number) {
    const p = this.pines[i];
    this.events.push({ k: 'pine', i });
    if (p.snow <= 0) return;
    p.snow = 0;
    for (const c of this.chars) if (Math.abs(c.x - p.x) < 4 && Math.abs(c.z - p.z) < 2.6) { c.stun = STUN_TICKS; c.busy = 0; c.doing = ''; c.aiming = false; this.stats.stunned[c.side]++; this.events.push({ k: 'stun', side: c.side, i: c.i, how: 'pine' }); }
  }

  private hitCube(x: number, y: number, z: number, b: Ball) {
    this.stats.hits[b.side]++;
    this.events.push({ k: 'hit', x, y, z, hard: b.hard, side: b.side });
    const kill = (cx: number, cy: number, cz: number) => {
      const v = this.at(cx, cy, cz); if (!v || v === 3) return;
      this.set(cx, cy, cz, 0); if (v === 2 - b.side) this.stats.knocked[b.side]++;
      this.events.push({ k: 'cube', x: cx, y: cy, z: cz, vx: Math.sign(b.vx) * (2 + this.next() * 3), vy: 2 + this.next() * 4, vz: (this.next() - 0.5) * 4 });
    };
    kill(x, y, z);
    const around: [number, number, number][] = [[x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
    if (b.hard) for (const [a, c, d] of around) kill(a, c, d);
    else for (const [a, c, d] of around) if (this.next() < 0.22) kill(a, c, d);
    this.support(b.side); this.flagCheck();
  }

  /** cubes no longer joined to the ground (through faces) fall */
  support(by?: Side) {
    const seen = new Uint8Array(this.grid.length), q: number[] = [];
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { const i = this.idx(x, 0, z); if (this.grid[i]) { seen[i] = 1; q.push(i); } }
    while (q.length) {
      const i = q.pop()!, z = i % D, y = Math.floor(i / D) % H, x = Math.floor(i / (D * H));
      const nb: [number, number, number][] = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
      for (const [a, c, d] of nb) { if (!this.in(a, c, d)) continue; const j = this.idx(a, c, d); if (this.grid[j] && !seen[j]) { seen[j] = 1; q.push(j); } }
    }
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] && !seen[i]) {
      const z = i % D, y = Math.floor(i / D) % H, x = Math.floor(i / (D * H));
      if (by !== undefined && this.grid[i] === 2 - by) this.stats.knocked[by]++;
      this.grid[i] = 0; this.events.push({ k: 'cube', x, y, z, vx: (this.next() - 0.5) * 2, vy: 0, vz: (this.next() - 0.5) * 2 });
    }
  }

  /** the flag is planted in the top of its 3 × 3 tower: it stands while any cube of the tower's top three layers is left */
  topLeft(side: Side) { const f = this.forts[side].flag; let n = 0; for (let x = f.x - 1; x <= f.x + 1; x++) for (let z = f.z - 1; z <= f.z + 1; z++) for (let y = f.top - 3; y < f.top; y++) if (this.at(x, y, z)) n++; return n; }
  flagCheck() {
    for (const s of [0, 1] as Side[]) {
      const f = this.forts[s].flag; if (!f.up) continue;
      const n = this.topLeft(s);
      if (n !== f.y) { f.y = n; this.events.push({ k: 'flag', side: s, fell: n === 0 }); }
      if (n === 0) { f.up = false; this.finish('flag', (1 - s) as Side); }
    }
  }

  finish(how: 'flag' | 'time', winner?: Side) {
    if (this.over) return;
    this.over = true; this.how = how;
    // at time-up: the tower with more of its top layer left wins, then the side that knocked more out of the other fort
    if (how === 'time') {
      const a = this.topLeft(0), b = this.topLeft(1), ka = this.stats.knocked[0], kb = this.stats.knocked[1];
      winner = a !== b ? (a > b ? 0 : 1) : ka !== kb ? (ka > kb ? 0 : 1) : undefined;
    }
    this.winner = winner ?? -1;
    this.events.push({ k: 'end', winner: this.winner, how });
  }

  /** stars for a won slope: the win, our flag tower barely touched, and a win inside a minute */
  stars() {
    if (this.winner !== 0) return [false, false, false];
    return [true, this.towerCount(0) >= this.forts[0].towerStart - 2, this.t <= 60 * TICK];
  }
}

function mkChar(side: Side, i: number, species: Species, name: string, x: number, z: number): Char {
  return { side, i, species, name, x, z, busy: 0, doing: '', job: null, stun: 0, stand: 0, aiming: false, aimTicks: 0, splash: false };
}

/** a fort, built for our side and mirrored for theirs: front wall with crenellations, side walls, a flag tower */
function buildFort(m: Match, side: Side, big: boolean): Fort {
  const v = side + 1, X = (x: number) => side === 0 ? x : W - 1 - x;
  const put = (x: number, y: number, z: number) => m.set(X(x), y, z, v);
  const front = 13, thick = big ? 3 : 2, wallH = 2;
  for (let k = 0; k < thick; k++) for (let z = 1; z < D - 1; z++) { for (let y = 0; y < wallH; y++) put(front - k, y, z); if (k === 0 && z % 2 === 1) put(front, wallH, z); }
  // the side walls: the far one two high, the near one (towards the camera) one high, so you can see who's inside
  for (let x = 3; x < front - thick + 1; x++) { for (let y = 0; y < 2; y++) put(x, y, 0); put(x, 0, D - 1); }
  const tx = 3, tz = Math.floor(D / 2), top = big ? 8 : 6;
  for (let x = tx - 1; x <= tx + 1; x++) for (let z = tz - 1; z <= tz + 1; z++) for (let y = 0; y < top; y++) put(x, y, z);
  if (big) for (let z = 2; z < D - 2; z++) for (let y = 0; y < 2; y++) put(6, y, z);     // the summit's inner wall guards the tower
  // the summit's fortress: square turrets at the front corners, four high with a cube on each corner
  if (big) for (const z0 of [0, D - 2]) {
    for (let x = front - 1; x <= front; x++) for (let z = z0; z < z0 + 2; z++) for (let y = 0; y < 4; y++) put(x, y, z);
    for (const [x, z] of [[front - 1, z0], [front, z0 + 1]]) put(x, 4, z);
  }
  return { flag: { x: X(tx), z: tz, top, y: 27, up: true }, start: 0, towerStart: 0 };
}

// ---------------------------------------------------------------- the brains: rivals and test bots
export type BotKind = 'rival' | 'pro' | 'casual' | 'turtle' | 'random';
const BOTS: Record<Exclude<BotKind, 'rival'>, AiParams> = {
  pro: P({ react: 12, err: 0.045, gap: 70, wallDig: 0.75, careless: 0.0, hunt: 0.3, hard: 0.35, patch: 0.15, lob: 0.4, wind: 0.85, switchy: 0.1 }),
  casual: P({ react: 15, err: 0.085, gap: 110, wallDig: 0.6, careless: 0.4, hunt: 0.15, hard: 0.05, lob: 0.3, wind: 0.4, switchy: 0 }),
  turtle: P({ react: 12, err: 0.045, gap: 70, wallDig: 0, careless: 0, hunt: 0.3, hard: 0.35, patch: 0.15, lob: 0.4, wind: 0.85 }),
  random: P({ react: 15, err: 0.6, gap: 60, wallDig: 0.8, careless: 1, hunt: 0, lob: 0.5, wind: 0 }),
};

export class Brain {
  m: Match; side: Side; p: AiParams; kind: BotKind;
  wait = 0; plan: { vx: number; vy: number; z: number; hard: boolean; hold: number } | null = null;
  adj = 0; adjFor = '';    // how far its last throw at this target landed off, so it walks the next one in
  constructor(m: Match, side: Side, kind: BotKind) { this.m = m; this.side = side; this.kind = kind; this.p = kind === 'rival' ? m.slope.ai : BOTS[kind]; this.wait = this.p.react * 3; }
  r() { return this.m.next(); }
  tick() {
    const m = this.m, s = this.side, c = m.activeChar(s), p = this.p;
    m.move[s] = 0;
    if (m.over) return;
    if (c.stun > 0) { if (m.chars_(s).length > 1 && this.r() < 0.05) m.switchTo(s); this.plan = null; return; }
    if (c.busy > 0) return;
    if (this.wait > 0) { this.wait--; return; }
    // aiming: walk to the lane, stand up, hold for the reaction time, throw
    if (this.plan) {
      const dz = this.plan.z - c.z;
      if (Math.abs(dz) > 0.2) { m.move[s] = Math.sign(dz); if (c.aiming) m.aim(s, false); return; }
      if (!c.aiming) { if (!m.aim(s, true)) { this.plan = null; return; } return; }
      if (c.aimTicks < this.plan.hold) return;
      m.throw(s, this.plan.vx, this.plan.vy, this.plan.hard); this.plan = null;
      this.wait = Math.round(p.gap * (0.7 + this.r() * 0.6));
      if (this.r() < p.switchy) m.switchTo(s);
      return;
    }
    // patch a hole in the front wall
    if (p.patch && m.ammo[s] >= 3 && this.r() < p.patch * 0.3) { const h = this.hole(); if (h && m.patch(s, h.x, h.y, h.z)) { this.wait = p.react; return; } }
    // out of snow: dig
    const want = this.kind === 'random' ? 1 : 2;
    if (m.ammo[s] < want || (m.ammo[s] < POOL - 1 && this.r() < 0.15)) { this.digSome(); return; }
    this.plan = this.choose();
    if (!this.plan) { this.digSome(); this.wait = 10; }
  }

  private digSome() {
    const m = this.m, s = this.side, c = m.activeChar(s);
    if (this.r() < this.p.wallDig) {
      const cube = this.r() < this.p.careless ? m.frontCube(s) : this.spare(c);
      if (cube && m.dig(s, cube.x, cube.y, cube.z)) return;
    }
    if (!m.scoopFloor(s)) this.wait = 6;
  }

  /** a cube it can spare: the highest one in reach that isn't covering where it stands */
  private spare(c: Char) {
    const m = this.m; let best: { x: number; y: number; z: number } | null = null, bv = -1e9;
    for (let x = Math.floor(c.x - REACH); x <= Math.ceil(c.x + REACH); x++) for (let z = Math.floor(c.z - REACH); z <= Math.ceil(c.z + REACH); z++) for (let y = 3; y >= 0; y--) {
      if (!m.canDig(c, x, y, z)) continue;
      if (m.at(x, y + 1, z) === c.side + 1) continue;
      const front = c.side === 0 ? x > c.x : x < c.x;
      let v = y * 2 - Math.hypot(x - c.x, z - c.z) * 0.3;
      if (front && Math.abs(z + 0.5 - c.z) < 2.5 && y <= 1) v -= 20;     // the wall it hides behind
      if (front && y >= 2) v += 3;                                          // crenellations are spare
      if (!front) v += 4;                                                   // side walls and odd bits behind
      if (v > bv) { bv = v; best = { x, y, z }; }
    }
    return best;
  }

  private hole() {
    const m = this.m, s = this.side, c = m.activeChar(s);
    for (let x = Math.floor(c.x - REACH); x <= Math.ceil(c.x + REACH); x++) for (let z = 1; z < D - 1; z++) for (let y = 0; y < 2; y++) {
      const front = s === 0 ? x > c.x : x < c.x;
      if (front && m.canPatch(c, x, y, z) && (m.at(x, y + 1, z) || m.at(x, y, z + 1) || m.at(x, y, z - 1))) return { x, y, z };
    }
    return null;
  }

  /** pick something to throw at and solve the throw, with this brain's error */
  private choose(): Brain['plan'] {
    const m = this.m, s = this.side, o = (1 - s) as Side, p = this.p, c = m.activeChar(s);
    if (this.kind === 'random') {
      const a = 0.2 + this.r() * 1.2, sp = 10 + this.r() * 26, dir = s === 0 ? 1 : -1;
      return { vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp, z: 1 + this.r() * (D - 2), hard: false, hold: 4 };
    }
    // a character of theirs who's been standing long enough for us to notice
    const standing = m.chars_(o).filter((e) => e.stun <= 0 && (e.aiming && e.aimTicks > p.react || e.stand > 0));
    let target: { x: number; y: number; z: number } | null = null;
    if (standing.length && this.r() < p.hunt) { const e = standing[Math.floor(this.r() * standing.length)]; target = { x: e.x, y: 2.0, z: e.z }; }
    if (!target) {
      const f = m.forts[o].flag, left: { x: number; z: number }[] = [];
      let ty = f.top - 1;
      for (; ty >= f.top - 3; ty--) { for (let x = f.x - 1; x <= f.x + 1; x++) for (let zz = f.z - 1; zz <= f.z + 1; zz++) if (m.at(x, ty, zz)) left.push({ x, z: zz }); if (left.length) break; }
      const t = left.length ? left[Math.floor(this.r() * left.length)] : { x: f.x, z: f.z };
      target = { x: t.x + 0.5, y: ty + 0.8, z: t.z + 0.5 };
    }
    const z = Math.max(1, Math.min(D - 1, target.z + (this.r() - 0.5) * 0.3));
    const from = { ...m.hand(c), z }, key = target.y > 1.9 && target.y < 2.1 ? 'char' : 'tower';
    if (key !== this.adjFor) { this.adj = 0; this.adjFor = key; }
    const aimAt = { ...target, x: target.x - this.adj * 0.75 };
    const high = this.r() < p.lob;
    const sol = solve(m, s, from, aimAt, high, p.wind);
    if (!sol) return null;
    const e = p.err;
    const k = 1 + (this.r() + this.r() + this.r() - 1.5) * e * 0.5, a = (this.r() + this.r() - 1) * e * 0.6;
    const sp = Math.hypot(sol.vx, sol.vy) * k, ang = Math.atan2(sol.vy, sol.vx) + a;
    const hard = m.ammo[s] >= 2 && this.r() < p.hard;
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
    // it watches where this one lands (the engine's own flight), and corrects the next by part of the miss
    const land = m.path(s, vx, vy, 300, from).end;
    if (land) this.adj = Math.max(-6, Math.min(6, this.adj * 0.4 + ((land.cube ? land.x + 0.5 : land.x) - target.x)));
    return { vx, vy, z, hard, hold: p.react + (hard ? HARD_HOLD : 0) };
  }
}

/** the launch that lands on a target from a hand position, on a high or low arc, allowing for some of the wind */
export function solve(m: Match, side: Side, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, high: boolean, windShare: number) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const tries = high ? [62, 55, 48, 40] : [30, 38, 45, 52];
  for (const deg of tries) {
    const th = (deg * Math.PI) / 180, cos = Math.cos(th), tan = Math.tan(th);
    const den = 2 * cos * cos * (Math.abs(dx) * tan - dy); if (den <= 0) continue;
    let v = Math.sqrt((G * dx * dx) / den); if (!isFinite(v) || v > VMAX) continue;
    let vx = Math.sign(dx) * v * cos, vy = v * Math.sin(th);
    // allow for the wind by shooting a little short or long
    if (m.slope.wind && windShare) { const tFlight = Math.abs(dx) / Math.abs(vx); vx -= m.wind * tFlight * 0.5 * windShare; v = Math.hypot(vx, vy); if (v > VMAX) continue; }
    // check the arc gets there without hitting our own wall first
    const e = m.path(side, vx, vy, 300, from).end;
    const ex = e ? (e.cube ? e.x + 0.5 : e.x) : NaN;
    if (e && (side === 0 ? ex > 15 : ex < W - 15)) return { vx, vy };
  }
  return null;
}

// ---------------------------------------------------------------- the save
export interface Save { won: Record<string, boolean>; stars: Record<string, number>; settings: { sound: boolean; music: boolean; motion: boolean }; tips: boolean }
export const newSave = (): Save => ({ won: {}, stars: {}, settings: { sound: true, music: true, motion: true }, tips: true });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') {
      if (o.won && typeof o.won === 'object') for (const k of Object.keys(o.won)) if (SLOPES.some((x) => x.id === k)) s.won[k] = !!o.won[k];
      if (o.stars && typeof o.stars === 'object') for (const k of Object.keys(o.stars)) { const n = Number(o.stars[k]); if (SLOPES.some((x) => x.id === k) && n >= 0 && n <= 7) s.stars[k] = n | 0; }
      if (o.settings) for (const k of ['sound', 'music', 'motion'] as const) if (typeof o.settings[k] === 'boolean') s.settings[k] = o.settings[k];
      if (typeof o.tips === 'boolean') s.tips = o.tips;
    }
  } catch {}
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** stars are kept as bits: 1 the win, 2 the tower, 4 the quick win */
export function record(s: Save, m: Match): Save {
  if (m.slope.id === 'versus' || m.winner !== 0) return s;
  const st = m.stars(), bits = (st[0] ? 1 : 0) | (st[1] ? 2 : 0) | (st[2] ? 4 : 0);
  return { ...s, won: { ...s.won, [m.slope.id]: true }, stars: { ...s.stars, [m.slope.id]: (s.stars[m.slope.id] ?? 0) | bits } };
}
export const unlocked = (s: Save, n: number) => n <= 1 || !!s.won[SLOPES[n - 2].id];
export const starCount = (bits: number) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
