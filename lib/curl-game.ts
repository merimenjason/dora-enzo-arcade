// Sweep & Slide: the rules of a cosy curling game on the frozen millpond. Deterministic, no DOM.
//
// The sheet runs along x from the release line (x = 0) to the boards behind the house; y runs across it, positive
// to the thrower's left. A stone slides with constant friction, curls toward the side its spin turns (a stone
// turning anticlockwise, seen from above, drifts left) and curls harder the slower it goes. Sweeping the thrown
// stone lowers the friction and straightens its path. Stones bump each other elastically (with a little loss and
// a little spin passed on through the rub at the contact), and leave play over the back line, against the side
// boards, or short of the far hog line. Fixed time steps, a seeded random generator, no Math.random.

export const STONE_R = 0.18;
export const SHEET_W = 4.4;
export const HALF_W = SHEET_W / 2;
export const HOG = 12;
export const TEE = 18.4;
export const HOUSE_R = 1.83;
export const RINGS = [1.83, 1.22, 0.61, 0.15];
export const BACK = TEE + HOUSE_R;
export const END = BACK + 1.0;
export const HACK = -1.6;

export const DT = 1 / 120;
export const FRICTION = 0.2;
export const SWEEP_FRICTION = 0.84;
export const CURL_K = 0.04;
export const CURL_V0 = 0.22;
export const SWEEP_CURL = 0.5;
export const SPIN = 1.2;
export const RESTITUTION = 0.88;
export const RUB = 0.06;
export const STOP_V = 0.008;

export type TeamId = 0 | 1;
export type Curl = 1 | -1;
export type Thrower = 'dora' | 'enzo' | 'opp';
export type Stone = { id: number; team: TeamId; thrower: Thrower; x: number; y: number; vx: number; vy: number; w: number; out: boolean; touched: boolean; moving: boolean };
/** A throw: the direction (radians from straight down the sheet, positive to the left), the weight (0 … 1) and the curl. */
export type Shot = { angle: number; weight: number; curl: Curl };
export type Why = 'back' | 'side' | 'hog';
export type IceEvent =
  | { kind: 'hit'; a: number; b: number; speed: number; x: number; y: number }
  | { kind: 'out'; id: number; why: Why }
  | { kind: 'stop'; id: number };

// ---- the seeded generator (mulberry32) and a smooth bell curve without logs or cosines
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, gauss: () => (next() + next() + next() + next() - 2) * 1.7320508, state: () => s, set: (v: number) => { s = v >>> 0; } };
}
export type Rng = ReturnType<typeof rng>;

// ---- weight: 0 … 0.7 is the draw range (where the stone would come to rest, from short of the hog line to the
// boards), 0.7 … 1 is hitting weight, up to a peel
export const W_DRAW = 0.7;
export const D_LO = 10.4, D_HI = END + 0.3, V_PEEL = 4.6;
export const speedOf = (d: number) => Math.sqrt(2 * FRICTION * Math.max(0, d));
export function weightToSpeed(w: number) {
  const k = Math.max(0, Math.min(1, w));
  if (k <= W_DRAW) return speedOf(D_LO + (D_HI - D_LO) * (k / W_DRAW));
  const v0 = speedOf(D_HI);
  return v0 + (V_PEEL - v0) * ((k - W_DRAW) / (1 - W_DRAW));
}
export function speedToWeight(v: number) {
  const v0 = speedOf(D_HI);
  if (v >= v0) return Math.min(1, W_DRAW + ((v - v0) / (V_PEEL - v0)) * (1 - W_DRAW));
  const d = (v * v) / (2 * FRICTION);
  return Math.max(0, ((d - D_LO) / (D_HI - D_LO)) * W_DRAW);
}
/** Where a weight would stop going straight down an empty sheet (for the weight bar's labels). */
export const weightDistance = (w: number) => { const v = weightToSpeed(w); return (v * v) / (2 * FRICTION); };
export function weightName(w: number) {
  const d = weightDistance(w);
  if (d < HOG + STONE_R) return 'Short';
  if (d < TEE - HOUSE_R - STONE_R) return 'Guard';
  if (d <= BACK + STONE_R) return 'Draw';
  if (w < 0.82) return 'Tap';
  if (w < 0.93) return 'Hit';
  return 'Peel';
}

export const dist = (s: { x: number; y: number }, x = TEE, y = 0) => Math.sqrt((s.x - x) * (s.x - x) + (s.y - y) * (s.y - y));
export const inHouse = (s: { x: number; y: number }) => dist(s) <= HOUSE_R + STONE_R;
export const speed = (s: Stone) => Math.sqrt(s.vx * s.vx + s.vy * s.vy);
export const inGuardZone = (s: { x: number; y: number }) => s.x - STONE_R > HOG && !inHouse(s) && s.x < TEE;

export function newStone(id: number, team: TeamId, thrower: Thrower, x: number, y: number): Stone {
  return { id, team, thrower, x, y, vx: 0, vy: 0, w: 0, out: false, touched: false, moving: false };
}
export const cloneStones = (st: Stone[]) => st.map((s) => ({ ...s }));

/** Sets a stone off from the release line with a shot (and, if given, an error on the weight and the line). */
export function launch(s: Stone, shot: Shot, dv = 0, da = 0) {
  const v = weightToSpeed(shot.weight) * (1 + dv), a = shot.angle + da;
  s.x = 0; s.y = 0; s.vx = v * Math.cos(a); s.vy = v * Math.sin(a); s.w = SPIN * shot.curl; s.out = false; s.touched = false; s.moving = true;
}

/**
 * One fixed step of the ice: friction and curl on every moving stone (less friction and less curl on the swept one),
 * then the bumps between stones, then the stones that have left play. Returns what happened.
 */
export function step(stones: Stone[], swept: number | null, ev: IceEvent[] = []) {
  for (const s of stones) {
    if (s.out || !s.moving) continue;
    const v = speed(s);
    if (v < STOP_V) { s.vx = 0; s.vy = 0; s.w = 0; s.moving = false; ev.push({ kind: 'stop', id: s.id }); continue; }
    const sw = s.id === swept;
    const ux = s.vx / v, uy = s.vy / v;
    // the curl: sideways toward the spin, growing as the stone slows; a stone with little spin curls little
    const spin = Math.max(-1, Math.min(1, s.w / 1.0));
    const lat = (CURL_K * spin) / (v + CURL_V0) * (sw ? SWEEP_CURL : 1);
    const dec = FRICTION * (sw ? SWEEP_FRICTION : 1);
    const nv = Math.max(0, v - dec * DT);
    let vx = ux * nv - uy * lat * DT, vy = uy * nv + ux * lat * DT;
    const m = Math.sqrt(vx * vx + vy * vy);
    if (m > 0) { vx *= nv / m; vy *= nv / m; }
    s.vx = vx; s.vy = vy;
    s.w *= 1 - 0.02 * DT;
    s.x += s.vx * DT; s.y += s.vy * DT;
  }
  collide(stones, ev);
  for (const s of stones) {
    if (s.out) continue;
    if (Math.abs(s.y) + STONE_R >= HALF_W) { out(s, 'side', ev); continue; }
    if (s.x - STONE_R > BACK || s.x + STONE_R >= END) out(s, 'back', ev);
  }
  return ev;
}
function out(s: Stone, why: Why, ev: IceEvent[]) { s.out = true; s.moving = false; s.vx = 0; s.vy = 0; s.w = 0; ev.push({ kind: 'out', id: s.id, why }); }

/** Equal-mass disc collisions: a restitution impulse along the line of centres and a capped rub across it. */
export function collide(stones: Stone[], ev: IceEvent[] = []) {
  const n = stones.length, D = 2 * STONE_R;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const a = stones[i]; if (a.out) continue;
      for (let j = i + 1; j < n; j++) {
        const b = stones[j]; if (b.out || (!a.moving && !b.moving)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= D * D || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        // push apart
        const push = (D - d) / 2 + 1e-6;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rvx = a.vx - b.vx, rvy = a.vy - b.vy, vn = rvx * nx + rvy * ny;
        if (vn <= 0) continue;
        const J = ((1 + RESTITUTION) / 2) * vn;
        a.vx -= J * nx; a.vy -= J * ny; b.vx += J * nx; b.vy += J * ny;
        // the rub at the contact: a capped friction impulse that passes spin between the two
        const tx = -ny, ty = nx, slip = rvx * tx + rvy * ty + STONE_R * (a.w + b.w);
        const Jt = -Math.sign(slip) * Math.min(RUB * J, Math.abs(slip) / 6);
        a.vx += Jt * tx; a.vy += Jt * ty; b.vx -= Jt * tx; b.vy -= Jt * ty;
        a.w += (2 * Jt) / STONE_R; b.w += (2 * Jt) / STONE_R;
        a.moving = true; b.moving = true; a.touched = true; b.touched = true;
        ev.push({ kind: 'hit', a: a.id, b: b.id, speed: vn, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
}

export const moving = (stones: Stone[]) => stones.some((s) => s.moving && !s.out);

/** The hog line rule, once everything has stopped: the delivered stone must be clean over the far hog line unless it touched another. */
export function hogCheck(stones: Stone[], thrown: Stone, ev: IceEvent[] = []) {
  if (!thrown.out && !thrown.touched && thrown.x - STONE_R < HOG) out(thrown, 'hog', ev);
  return ev;
}

/** Kinetic energy of the moving stones (unit mass), for the tests. */
export const energy = (stones: Stone[]) => stones.reduce((e, s) => e + (s.out ? 0 : 0.5 * (s.vx * s.vx + s.vy * s.vy)), 0);

// ---- a sweep judge: sweeps while the thrown stone, left alone, would stop short of where it is meant to go
export type SweepPlan = { target: number; slack: number } | null;
/** Distance a stone at speed v slides on before stopping, unswept. */
export const slideLeft = (v: number) => (v * v) / (2 * FRICTION);
export function judgeSweep(s: Stone, plan: SweepPlan) {
  if (!plan || s.out || !s.moving || s.touched) return false;
  const along = Math.sqrt(s.x * s.x + s.y * s.y);
  return along + slideLeft(speed(s)) < plan.target - plan.slack;
}

/** Runs the ice until everything stops; `sweep` is asked every step whether to sweep the thrown stone. */
export function settle(stones: Stone[], thrown: Stone | null, sweep: (s: Stone) => boolean = () => false, maxSteps = 120 * 60) {
  const ev: IceEvent[] = [];
  for (let k = 0; k < maxSteps && moving(stones); k++) step(stones, thrown && sweep(thrown) ? thrown.id : null, ev);
  if (thrown) hogCheck(stones, thrown, ev);
  return ev;
}

// ---- the free path of a lone stone, tabled by speed so the throwers can find a line by rotation: the ice is the
// same in every direction, so turning the throw turns the whole path about the release point
type Path = { v: number; rx: number; ry: number; pts: number[] };
const TABLE = new Map<Curl, Path[]>();
const V_MIN = 1.9, V_STEP = 0.01, V_N = Math.round((V_PEEL + 0.3 - V_MIN) / V_STEP) + 1;
function freePath(v: number, curl: Curl): Path {
  const s = newStone(0, 0, 'opp', 0, 0); s.vx = v; s.vy = 0; s.w = SPIN * curl; s.moving = true;
  const pts: number[] = [0, 0], one = [s];
  for (let k = 0; k < 120 * 40 && s.moving; k++) {
    step(one, null);
    if (s.out) { s.out = false; s.moving = true; }
    if (k % 6 === 5) pts.push(s.x, s.y);
    if (s.x > END + 12) break;
  }
  pts.push(s.x, s.y);
  return { v, rx: s.x, ry: s.y, pts };
}
function table(curl: Curl) {
  let t = TABLE.get(curl);
  if (!t) { t = []; for (let i = 0; i < V_N; i++) t.push(freePath(V_MIN + i * V_STEP, curl)); TABLE.set(curl, t); }
  return t;
}
/** The straight-line distance from the release to where a lone stone stops, for a speed and curl. */
export function restOf(v: number, curl: Curl) {
  const t = table(curl), f = Math.max(0, Math.min(V_N - 1.0001, (v - V_MIN) / V_STEP)), i = Math.floor(f), u = f - i;
  const x = t[i].rx + (t[i + 1].rx - t[i].rx) * u, y = t[i].ry + (t[i + 1].ry - t[i].ry) * u;
  return { x, y };
}
/** The throw that comes to rest at (tx, ty) on an empty sheet. */
export function drawTo(tx: number, ty: number, curl: Curl): Shot {
  const want = Math.sqrt(tx * tx + ty * ty);
  let lo = V_MIN, hi = V_MIN + (V_N - 1) * V_STEP;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, r = restOf(m, curl); if (Math.sqrt(r.x * r.x + r.y * r.y) < want) lo = m; else hi = m; }
  const r = restOf((lo + hi) / 2, curl);
  return { angle: Math.atan2(ty, tx) - Math.atan2(r.y, r.x), weight: speedToWeight((lo + hi) / 2), curl };
}
/** The throw with a given weight whose path passes through (tx, ty), for hits; null if it would not get there. */
export function lineThrough(tx: number, ty: number, weight: number, curl: Curl): Shot | null {
  const v = weightToSpeed(weight), t = table(curl), i = Math.max(0, Math.min(V_N - 1, Math.round((v - V_MIN) / V_STEP))), p = t[i].pts;
  const want = Math.sqrt(tx * tx + ty * ty);
  for (let k = 2; k < p.length; k += 2) {
    const d1 = Math.sqrt(p[k] * p[k] + p[k + 1] * p[k + 1]);
    if (d1 >= want) {
      const d0 = Math.sqrt(p[k - 2] * p[k - 2] + p[k - 1] * p[k - 1]), u = d1 > d0 ? (want - d0) / (d1 - d0) : 0;
      const px = p[k - 2] + (p[k] - p[k - 2]) * u, py = p[k - 1] + (p[k + 1] - p[k - 1]) * u;
      return { angle: Math.atan2(ty, tx) - Math.atan2(py, px), weight, curl };
    }
  }
  return null;
}
/** The first few metres of a throw's path on an empty sheet: the dotted ghost while aiming. */
export function ghost(shot: Shot, metres = 4.5) {
  const s = newStone(0, 0, 'opp', 0, 0); launch(s, shot);
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }], one = [s];
  for (let k = 0; k < 120 * 20 && s.moving && !s.out; k++) { step(one, null); if (k % 4 === 3) pts.push({ x: s.x, y: s.y }); if (s.x * s.x + s.y * s.y > metres * metres) break; }
  return pts;
}
/** Where the line of a throw crosses the tee line: where the skip holds the broom. */
export const broomOf = (shot: Shot) => ({ x: TEE, y: Math.tan(shot.angle) * TEE });

// ---- scoring an end
export type EndScore = { team: TeamId | null; points: number; blank: boolean; tie: boolean; best: [number, number]; counting: number[] };
export const TIE_EPS = 1e-4;
/**
 * The team with the stone nearest the button scores one for each of its stones nearer than the other team's best.
 * Only stones touching the house count. A measured tie for shot scores nothing (like a blank end).
 */
export function scoreEnd(stones: Stone[]): EndScore {
  const live = stones.filter((s) => !s.out && inHouse(s)).map((s) => ({ s, d: dist(s) })).sort((a, b) => a.d - b.d || a.s.id - b.s.id);
  const best: [number, number] = [Infinity, Infinity];
  for (const { s, d } of live) if (d < best[s.team]) best[s.team] = d;
  if (!live.length) return { team: null, points: 0, blank: true, tie: false, best, counting: [] };
  if (Math.abs(best[0] - best[1]) < TIE_EPS) return { team: null, points: 0, blank: false, tie: true, best, counting: [] };
  const team = live[0].s.team, other = best[1 - team];
  const counting = live.filter((l) => l.s.team === team && l.d < other - TIE_EPS).map((l) => l.s.id);
  return { team, points: counting.length, blank: false, tie: false, best, counting };
}

// ---- a match
export type MatchOpts = { ends: number; seed: number; hammer?: TeamId; noise: [{ v: number; a: number }, { v: number; a: number }] };
export type EndResult = { scorer: TeamId | null; points: number; hammer: TeamId; blank: boolean; tie: boolean };
export class Match {
  ends: number; end = 0; hammer: TeamId; thrown = 0;
  stones: Stone[] = []; current: Stone | null = null;
  results: EndResult[] = []; score: [number, number] = [0, 0];
  over = false; winner: TeamId | null = null;
  rand: Rng; noise: MatchOpts['noise'];
  constructor(o: MatchOpts) { this.ends = o.ends; this.hammer = o.hammer ?? 0; this.rand = rng(o.seed); this.noise = o.noise; }
  /** Who throws next: the team without the hammer throws first, so the hammer team has the last stone. */
  get turn(): TeamId { return (this.thrown % 2 === 0 ? 1 - this.hammer : this.hammer) as TeamId; }
  /** Which of the team's stones this is, 0 … 3. */
  get turnStone() { return Math.floor(this.thrown / 2); }
  thrower(): Thrower { return this.turn === 1 ? 'opp' : this.turnStone < 2 ? 'dora' : 'enzo'; }
  get extra() { return this.end >= this.ends; }
  get lastOfEnd() { return this.thrown === 7; }
  /** Delivers the next stone. The match's generator adds the thrower's small release error. */
  throwStone(shot: Shot) {
    if (this.over || this.current) throw new Error('not ready to throw');
    const team = this.turn, nz = this.noise[team];
    const s = newStone(this.end * 8 + this.thrown, team, this.thrower(), 0, 0);
    launch(s, shot, this.rand.gauss() * nz.v, this.rand.gauss() * nz.a);
    this.stones.push(s); this.current = s;
    return s;
  }
  /** One step of the ice while the stone runs; sweeping applies to the thrown stone. */
  tick(sweeping: boolean, ev: IceEvent[] = []) {
    const c = this.current; if (!c) return ev;
    step(this.stones, sweeping && c.moving && !c.out ? c.id : null, ev);
    return ev;
  }
  get running() { return !!this.current && moving(this.stones); }
  /** Once everything stops: the hog line rule, then the next stone, or the end's score. */
  finishThrow(): { ev: IceEvent[]; end: EndResult | null } {
    const c = this.current; if (!c) throw new Error('no stone');
    const ev = hogCheck(this.stones, c); this.current = null; this.thrown++;
    if (this.thrown < 8) return { ev, end: null };
    return { ev, end: this.scoreTheEnd() };
  }
  private scoreTheEnd(): EndResult {
    const sc = scoreEnd(this.stones), r: EndResult = { scorer: sc.team, points: sc.points, hammer: this.hammer, blank: sc.blank, tie: sc.tie };
    this.results.push(r);
    if (sc.team !== null) { this.score[sc.team] += sc.points; this.hammer = (1 - sc.team) as TeamId; }
    this.end++;
    if (this.end >= this.ends && this.score[0] !== this.score[1]) { this.over = true; this.winner = this.score[0] > this.score[1] ? 0 : 1; }
    else if (this.end >= this.ends + 8) { this.over = true; this.winner = this.hammer; }
    return r;
  }
  /** Clears the sheet for the next end. */
  nextEnd() { if (!this.over) { this.stones = []; this.thrown = 0; this.current = null; } }
  /** Plays a stone through to rest without drawing (for bots and tests). */
  play(shot: Shot, sweep: (s: Stone) => boolean = () => false) {
    const s = this.throwStone(shot);
    for (let k = 0; k < 120 * 60 && this.running; k++) this.tick(sweep(s));
    return this.finishThrow();
  }
  snapshot(): MatchSnap {
    return { ends: this.ends, end: this.end, hammer: this.hammer, thrown: this.thrown, stones: cloneStones(this.stones.filter((s) => !s.out)), results: this.results.map((r) => ({ ...r })), score: [...this.score] as [number, number], rand: this.rand.state() };
  }
  static restore(m: MatchSnap, noise: MatchOpts['noise']) {
    const x = new Match({ ends: m.ends, seed: 0, hammer: m.hammer, noise });
    x.end = m.end; x.thrown = m.thrown; x.stones = cloneStones(m.stones).map((s) => ({ ...s, moving: false, vx: 0, vy: 0, w: 0 })); x.results = m.results; x.score = m.score; x.rand.set(m.rand);
    return x;
  }
}
export type MatchSnap = { ends: number; end: number; hammer: TeamId; thrown: number; stones: Stone[]; results: EndResult[]; score: [number, number]; rand: number };

/** The player's small release error: enough that a draw wants a sweep now and then. */
export const PLAYER_NOISE = { v: 0.011, a: 0.0022 };

// ---- the Practice Pond
export type DrillId = 'draw' | 'guard' | 'come' | 'hitroll' | 'double';
export type Drill = { id: DrillId; name: string; teach: string; call: string; setup: { team: TeamId; x: number; y: number }[]; stars: string[] };
export const DRILLS: Drill[] = [
  { id: 'draw', name: 'Draw to the button', teach: 'Pull back to set the weight and the line, let go, then hold to sweep if it looks light. Stop it on the button.', call: 'Draw to the button',
    setup: [], stars: ['In the house', 'Inside the red ring', 'On the button'] },
  { id: 'guard', name: 'Centre guard', teach: 'Guard weight stops between the hog line and the house. Park it in front of your stone to hide it.', call: 'Guard our stone',
    setup: [{ team: 0, x: TEE - 0.3, y: 0.2 }], stars: ['In the guard zone', 'In line with our stone', 'A perfect cover'] },
  { id: 'come', name: 'Come around', teach: 'Curl around the guard and come to rest behind it, hidden from a takeout.', call: 'Draw behind the guard',
    setup: [{ team: 1, x: HOG + 3.3, y: 0.35 }], stars: ['In the house', 'Close to the button', 'Behind the guard'] },
  { id: 'hitroll', name: 'Hit and roll', teach: 'Throw takeout weight to knock their stone out, and roll your shooter to stay in the house.', call: 'Take out their stone and stay',
    setup: [{ team: 1, x: TEE + 0.1, y: -0.35 }], stars: ['Their stone out', 'Ours stays in play', 'Ours stays in the house'] },
  { id: 'double', name: 'Double takeout', teach: 'Hit the first stone thin so both it and the second leave the sheet.', call: 'Take out both',
    setup: [{ team: 1, x: TEE - 1.0, y: 0.55 }, { team: 1, x: TEE + 0.5, y: 0.08 }], stars: ['One out', 'Both out', 'Both out, ours stays'] },
];
export function drillStones(d: Drill) { return d.setup.map((p, i) => newStone(100 + i, p.team, p.team ? 'opp' : 'enzo', p.x, p.y)); }
/** Stars for a drill throw, 0 … 3, once the stones are at rest. */
export function drillStars(d: Drill, stones: Stone[], shooter: Stone) {
  const set = stones.filter((s) => s.id >= 100), ours = !shooter.out;
  switch (d.id) {
    case 'draw': { if (!ours || !inHouse(shooter)) return 0; const r = dist(shooter); return r <= 0.3 ? 3 : r <= 0.9 ? 2 : 1; }
    case 'guard': {
      const g = set[0]; if (!ours || !inGuardZone(shooter)) return 0;
      const off = Math.abs(shooter.y - g.y * (shooter.x / g.x));
      return off <= 0.2 && shooter.x > HOG + 2.2 ? 3 : off <= 0.5 ? 2 : 1;
    }
    case 'come': {
      const g = set[0]; if (!ours || !inHouse(shooter)) return 0;
      const hidden = shooter.x > g.x && Math.abs(shooter.y - g.y * (shooter.x / g.x)) < 2 * STONE_R + 0.06;
      return hidden && dist(shooter) <= 1.25 ? 3 : dist(shooter) <= 1.0 || hidden ? 2 : 1;
    }
    case 'hitroll': { if (!set[0].out) return 0; return ours && inHouse(shooter) ? 3 : ours ? 2 : 1; }
    case 'double': { const n = set.filter((s) => s.out).length; return n === 2 ? (ours ? 3 : 2) : n; }
  }
}

// ---- the save
export const SAVE_KEY = 'sweep-slide-v1';
export type Save = {
  v: 1; beaten: number; wins: Record<string, number>; best: Record<string, number>; drills: Record<string, number>;
  ended: boolean; tips: string[]; settings: { sound: boolean; music: boolean }; match: { team: string; seed: number; snap: MatchSnap } | null;
};
export const freshSave = (): Save => ({ v: 1, beaten: 0, wins: {}, best: {}, drills: {}, ended: false, tips: [], settings: { sound: true, music: true }, match: null });
const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
const nums = (o: unknown, max: number) => { const r: Record<string, number> = {}; if (isObj(o)) for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v) && v >= -99 && v <= max && k.length < 20) r[k] = Math.round(v); return r; };
function goodSnap(o: unknown): o is MatchSnap {
  if (!isObj(o)) return false;
  const okN = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  if (!okN(o.ends, 1, 9) || !okN(o.end, 0, 20) || !okN(o.thrown, 0, 7) || !(o.hammer === 0 || o.hammer === 1) || !okN(o.rand, 0, 4294967295)) return false;
  if (!Array.isArray(o.score) || o.score.length !== 2 || !o.score.every((v) => okN(v, 0, 99))) return false;
  if (!Array.isArray(o.results) || o.results.length !== o.end || !o.results.every((r) => isObj(r) && okN(r.points, 0, 8))) return false;
  if (!Array.isArray(o.stones) || o.stones.length > 8) return false;
  return o.stones.every((s) => isObj(s) && okN(s.x, -1, END) && okN(s.y, -HALF_W, HALF_W) && (s.team === 0 || s.team === 1) && okN(s.id, 0, 999) && typeof s.thrower === 'string');
}
export function readSave(raw: string | null, teamIds: string[] = []): Save {
  const s = freshSave();
  if (!raw) return s;
  let o: unknown; try { o = JSON.parse(raw); } catch { return s; }
  if (!isObj(o) || o.v !== 1) return s;
  if (typeof o.beaten === 'number' && Number.isInteger(o.beaten) && o.beaten >= 0 && o.beaten <= 8) s.beaten = o.beaten;
  s.wins = nums(o.wins, 9999); s.best = nums(o.best, 99); s.drills = nums(o.drills, 3);
  s.ended = o.ended === true;
  if (Array.isArray(o.tips)) s.tips = o.tips.filter((t): t is string => typeof t === 'string' && t.length < 40).slice(0, 60);
  if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; }
  const m = o.match;
  if (isObj(m) && typeof m.team === 'string' && (!teamIds.length || teamIds.includes(m.team)) && typeof m.seed === 'number' && goodSnap(m.snap)) s.match = { team: m.team, seed: m.seed, snap: m.snap };
  return s;
}
