/** Puttering Paws rules: storybook mini golf for Dora and Enzo. One tile is one world unit, +x is east and +z is south;
 *  clocks are seconds. Deterministic (no randomness at all), no DOM or Three.js. The page steps it at DT. */
import { COURSES, COURSE_IDS, type CourseId, type Dir, type HoleSpec, type MoverSpec, type WindmillSpec } from './putt-courses.js';
export * from './putt-courses.js';

export type HeroId = 'dora' | 'enzo';
export const HEROES: Record<HeroId, { name: string; ball: string }> = { dora: { name: 'Dora', ball: '#f6a9b8' }, enzo: { name: 'Enzo', ball: '#9fb7d9' } };
export const DT = 1 / 60, SUBSTEPS = 3;
export const BALL_R = 0.14, CUP_R = 0.3, MAX_SPEED = 8.5, STEP_H = 0.25, G = 9.8;
/** A ball slower than this over the cup drops in; a faster one rattles over the lip. */
export const CUP_SPEED = 2.5;
/** Rolling drag: a + b × speed, in tiles per second². `hold` is the steepest pull the surface can hold a still ball against. */
export const FELT = { a: 1.4, b: 0.14, hold: 1.6 }, SAND = { a: 7.5, b: 1.4, hold: 4.5 };
const REST_SPEED = 0.06, WALL_E = 0.75, BUMPER_E = 1.1, BUMPER_KICK = 0.8, MOVER_E = 0.5, GATE_E = 0.45;
export const BUMPER_R = 0.3, MOUTH_R = 0.3, ACORN_R = 0.34;
/** Close to the cup the felt dips: a ball this near the rim is pulled in at CUP_PULL tiles per second². */
const CUP_PULL_R = CUP_R + 0.22, CUP_PULL = 2.6;
/** Six putts is plenty: a ball still out after six is picked up and scores seven. */
export const MAX_STROKES = 6, PICKUP = MAX_STROKES + 1;
export const INTRO = 2.6, TURN_INTRO = 1.2, SUNK_TIME = 2.4, PICKUP_TIME = 1.8, SPLASH_TIME = 1.3, TUNNEL_TIME = 0.75, ROLL_LIMIT = 30;
/** A windmill sail blocks the door while it is within this angle (radians) of straight down; four sails block 46% of the time. */
export const BLADE_HALF = 0.36;
/** The aiming line shows this many tiles of the putt's direction (more only to show a bounce). */
export const GUIDE_REACH = 3;
export const SAVE_KEY = 'puttering-paws-v1', RUN_KEY = 'puttering-paws-run-v1';

export type Kind = 'felt' | 'sand' | 'water' | 'block' | 'void';
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export type Tile = { c: number; r: number; kind: Kind; level: number; ramp: Dir | null; corner: Corner | null; ch: string };
export type Vec = { x: number; z: number };
/** A wall. With a normal (nx, nz) it is a one-way ledge that only stops a ball on the normal's side moving against it. */
export type Seg = { ax: number; az: number; bx: number; bz: number; nx?: number; nz?: number };
/** One tile edge that is not open felt, for drawing: `top` and `low` are the heights of the two sides at a and at b. */
export type Edge = Seg & { topA: number; topB: number; lowA: number; lowB: number; drop: boolean; diagonal: boolean };
export type Tunnel = { from: Vec; to: Vec; dir: Vec };
/** `front` is +1 when the sails face +z (south, or east for an east-west lane) toward the tee, else -1; the sail board that
 *  blocks the door turns in the front face of the house, half a tile out from the door's middle. */
export type Windmill = WindmillSpec & { gate: Seg; centre: Vec; front: 1 | -1 };
export type Hole = {
  spec: HoleSpec; id: string; w: number; d: number; tiles: Tile[][]; walls: Seg[]; edges: Edge[]; bumpers: Vec[];
  tee: Vec; cup: Vec; acorn: Vec | null; tunnels: Tunnel[]; windmills: Windmill[]; movers: MoverSpec[]; flow: number[][];
};

const RAMPS: Record<string, Dir> = { '>': 'e', '<': 'w', '^': 'n', v: 's' };
const CORNERS: Record<string, Corner> = { '[': 'nw', ']': 'ne', '{': 'sw', '}': 'se' };
const DIRS: Record<Dir, Vec> = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
export const playable = (t: Tile | null): t is Tile => !!t && (t.kind === 'felt' || t.kind === 'sand' || t.kind === 'water');
export const centre = (c: number, r: number): Vec => ({ x: c + 0.5, z: r + 0.5 });
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** Height of a tile's own surface at a point on or inside it (ramps included, mounds not). */
export function tileHeight(t: Tile, x: number, z: number) {
  const base = t.level * STEP_H; if (!t.ramp) return base;
  const fx = x - t.c, fz = z - t.r;
  return base + STEP_H * (t.ramp === 'e' ? fx : t.ramp === 'w' ? 1 - fx : t.ramp === 'n' ? 1 - fz : fz);
}

function parseHole(spec: HoleSpec): Hole {
  const d = spec.map.length, w = Math.max(...spec.map.map((row) => row.length));
  const tiles: Tile[][] = [];
  let tee: Vec | null = null, cup: Vec | null = null, acorn: Vec | null = null; const bumpers: Vec[] = [];
  for (let r = 0; r < d; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < w; c++) {
      const ch = spec.map[r][c] ?? ' ', level = Number(spec.levels?.[r]?.[c]?.trim() || 0);
      const kind: Kind = ch === ' ' ? 'void' : ch === '#' ? 'block' : ch === 's' ? 'sand' : ch === 'w' ? 'water' : 'felt';
      row.push({ c, r, kind, level, ramp: RAMPS[ch] ?? null, corner: CORNERS[ch] ?? null, ch });
      if (ch === 'T') tee = centre(c, r); else if (ch === 'C') cup = centre(c, r); else if (ch === 'a') acorn = centre(c, r); else if (ch === 'm') bumpers.push(centre(c, r));
    }
    tiles.push(row);
  }
  if (!tee || !cup) throw new Error(`${spec.id} needs a tee and a cup`);
  const at = (c: number, r: number) => tiles[r]?.[c] ?? null;
  // Every tile edge that is not open felt becomes a wall, a one-way drop, or (between two blocked tiles) nothing.
  const edges: Edge[] = [], seen = new Set<string>();
  const sides: [Dir, number, number, number, number, number, number][] = [
    ['n', 0, -1, 0, 0, 1, 0], ['s', 0, 1, 0, 1, 1, 1], ['w', -1, 0, 0, 0, 0, 1], ['e', 1, 0, 1, 0, 1, 1],
  ];
  const opposite: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };
  const blocksSide = (t: Tile, side: Dir) => !!t.corner && t.corner.includes(side);
  for (const row of tiles) for (const t of row) {
    if (!playable(t)) continue;
    for (const [side, dc, dr, x0, z0, x1, z1] of sides) {
      const ax = t.c + x0, az = t.r + z0, bx = t.c + x1, bz = t.r + z1, key = `${ax},${az},${bx},${bz}`;
      if (seen.has(key)) continue;
      const o = at(t.c + dc, t.r + dr), hA = tileHeight(t, ax, az), hB = tileHeight(t, bx, bz);
      if (playable(o)) {
        const oA = tileHeight(o, ax, az), oB = tileHeight(o, bx, bz);
        const cornered = blocksSide(t, side) || blocksSide(o, opposite[side]);
        if (!cornered && Math.abs(hA - oA) < 1e-6 && Math.abs(hB - oB) < 1e-6) continue;
        seen.add(key);
        const tHigher = hA > oA + 1e-6 && hB > oB + 1e-6, oHigher = oA > hA + 1e-6 && oB > hB + 1e-6;
        const drop = !!spec.drops && !cornered && t.ramp === null && o.ramp === null && (tHigher || oHigher);
        const edge: Edge = { ax, az, bx, bz, topA: Math.max(hA, oA), topB: Math.max(hB, oB), lowA: Math.min(hA, oA), lowB: Math.min(hB, oB), drop, diagonal: false };
        // A drop only stops a ball on the low side: its normal points from the ledge into the low tile.
        if (drop) { const n = DIRS[side], k = tHigher ? 1 : -1; edge.nx = n.x * k; edge.nz = n.z * k; }
        edges.push(edge);
      } else {
        seen.add(key);
        edges.push({ ax, az, bx, bz, topA: hA, topB: hB, lowA: -1, lowB: -1, drop: false, diagonal: false });
      }
    }
    if (t.corner) {
      const h = t.level * STEP_H, c = t.c, r = t.r;
      const [ax, az, bx, bz] = t.corner === 'nw' || t.corner === 'se' ? [c + 1, r, c, r + 1] : [c, r, c + 1, r + 1];
      edges.push({ ax, az, bx, bz, topA: h, topB: h, lowA: -1, lowB: -1, drop: false, diagonal: true });
    }
  }
  const walls = mergeWalls(edges);
  const tunnels: Tunnel[] = (spec.tunnels ?? []).map((s) => ({ from: centre(...s.from), to: centre(...s.to), dir: DIRS[s.dir] }));
  const hole: Hole = { spec, id: spec.id, w, d, tiles, walls, edges, bumpers, tee, cup, acorn, tunnels, windmills: [], movers: spec.movers ?? [], flow: [] };
  hole.flow = flowField(hole);
  hole.windmills = (spec.windmills ?? []).map((s) => {
    const [c, r] = s.at, f = (dc: number, dr: number) => hole.flow[r + dr]?.[c + dc] ?? Infinity;
    // the front is the side further from the cup
    const front: 1 | -1 = s.axis === 'ns' ? (f(0, 1) >= f(0, -1) ? 1 : -1) : (f(1, 0) >= f(-1, 0) ? 1 : -1);
    const z = r + 0.5 + front * 0.5, x = c + 0.5 + front * 0.5;
    const gate: Seg = s.axis === 'ns' ? { ax: c, az: z, bx: c + 1, bz: z } : { ax: x, az: r, bx: x, bz: r + 1 };
    return { ...s, gate, centre: centre(c, r), front };
  });
  return hole;
}

/** Joins wall pieces that line up end to end, so a long rail is one wall. One-way ledges and diagonals stay as they are. */
function mergeWalls(edges: Edge[]): Seg[] {
  const out: Seg[] = [], rows = new Map<string, [number, number][]>();
  for (const e of edges) {
    if (e.nx !== undefined || e.diagonal) { out.push({ ax: e.ax, az: e.az, bx: e.bx, bz: e.bz, nx: e.nx, nz: e.nz }); continue; }
    const flat = e.az === e.bz, key = flat ? `z${e.az}` : `x${e.ax}`, span: [number, number] = flat ? [Math.min(e.ax, e.bx), Math.max(e.ax, e.bx)] : [Math.min(e.az, e.bz), Math.max(e.az, e.bz)];
    (rows.get(key) ?? rows.set(key, []).get(key)!).push(span);
  }
  for (const [key, spans] of rows) {
    spans.sort((p, q) => p[0] - q[0]);
    const k = Number(key.slice(1)), flat = key[0] === 'z';
    let [s, e] = spans[0];
    const push = () => out.push(flat ? { ax: s, az: k, bx: e, bz: k } : { ax: k, az: s, bx: k, bz: e });
    for (const [a, b] of spans.slice(1)) { if (a <= e + 1e-9) e = Math.max(e, b); else { push(); s = a; e = b; } }
    push();
  }
  return out;
}

/** Tiles from each tile to the cup, walking open edges, ledges (downward only) and burrows. Ponds and walls are impassable; dust counts double. */
function flowField(hole: Hole): number[][] {
  const { tiles } = hole, flow = tiles.map((row) => row.map(() => Infinity));
  const cupC = Math.floor(hole.cup.x), cupR = Math.floor(hole.cup.z);
  flow[cupR][cupC] = 0;
  // Reverse search from the cup: a step from p to q is allowed when a ball can roll from p into q.
  const open = (p: Tile, q: Tile) => {
    const from = centre(p.c, p.r);
    // A ledge's normal points into its low tile, and a ball there cannot climb it.
    const between = (ax: number, az: number, bx: number, bz: number) => !hole.walls.some((s) => onSeg(s, ax, az, bx, bz) && (s.nx === undefined || (from.x - s.ax) * s.nx + (from.z - s.az) * s.nz! > 0));
    if (q.c === p.c + 1) return between(q.c, q.r, q.c, q.r + 1);
    if (q.c === p.c - 1) return between(p.c, p.r, p.c, p.r + 1);
    if (q.r === p.r + 1) return between(q.c, q.r, q.c + 1, q.r);
    return between(p.c, p.r, p.c + 1, p.r);
  };
  const queue: [number, number][] = [[cupC, cupR]];
  while (queue.length) {
    queue.sort((a, b) => flow[a[1]][a[0]] - flow[b[1]][b[0]]);
    const [c, r] = queue.shift()!, q = tiles[r][c];
    const sources: [Tile, number][] = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = tiles[r + dr]?.[c + dc]; if (playable(p) && p.kind !== 'water' && open(p, q)) sources.push([p, p.kind === 'sand' ? 2 : 1]); }
    for (const t of hole.tunnels) if (Math.floor(t.to.x) === c && Math.floor(t.to.z) === r) sources.push([tiles[Math.floor(t.from.z)][Math.floor(t.from.x)], 1]);
    for (const [p, cost] of sources) {
      const v = flow[r][c] + cost;
      if (v < flow[p.r][p.c]) { flow[p.r][p.c] = v; queue.push([p.c, p.r]); }
    }
  }
  return flow;
}
// Is the unit edge (ax,az)-(bx,bz) part of the axis-aligned wall s?
function onSeg(s: Seg, ax: number, az: number, bx: number, bz: number) {
  if (s.ax === s.bx && ax === bx && ax === s.ax) return Math.min(az, bz) >= Math.min(s.az, s.bz) - 1e-9 && Math.max(az, bz) <= Math.max(s.az, s.bz) + 1e-9;
  if (s.az === s.bz && az === bz && az === s.az) return Math.min(ax, bx) >= Math.min(s.ax, s.bx) - 1e-9 && Math.max(ax, bx) <= Math.max(s.ax, s.bx) + 1e-9;
  return false;
}

const HOLE_CACHE = new Map<string, Hole>();
export const ALL_HOLES: readonly HoleSpec[] = COURSE_IDS.flatMap((id) => COURSES[id].holes);
export function getHole(id: string): Hole {
  let h = HOLE_CACHE.get(id);
  if (!h) { const spec = ALL_HOLES.find((s) => s.id === id); if (!spec) throw new Error(`No hole ${id}`); h = parseHole(spec); HOLE_CACHE.set(id, h); }
  return h;
}
export const courseOf = (holeId: string): CourseId => (COURSE_IDS.find((c) => COURSES[c].holes.some((h) => h.id === holeId)) ?? 'clover');
export const coursePar = (course: CourseId) => COURSES[course].holes.reduce((s, h) => s + h.par, 0);

export function tileAt(hole: Hole, x: number, z: number): Tile | null { return hole.tiles[Math.floor(z)]?.[Math.floor(x)] ?? null; }
/** Surface height at a point: the tile (ramps included) plus every mound. Off the course it is the meadow, a step below 0. */
export function heightAt(hole: Hole, x: number, z: number) {
  const t = tileAt(hole, x, z); let h = t && playable(t) ? tileHeight(t, x, z) : 0;
  for (const m of hole.spec.mounds ?? []) h += m.h * Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (m.r * m.r));
  return h;
}
/** Downhill pull is -G × this gradient. */
export function gradient(hole: Hole, x: number, z: number): [number, number] {
  const t = tileAt(hole, x, z); let gx = 0, gz = 0;
  if (t?.ramp) { const k = STEP_H; if (t.ramp === 'e') gx = k; else if (t.ramp === 'w') gx = -k; else if (t.ramp === 'n') gz = -k; else gz = k; }
  for (const m of hole.spec.mounds ?? []) {
    const dx = x - m.x, dz = z - m.z, e = m.h * Math.exp(-(dx * dx + dz * dz) / (m.r * m.r)) * (-2 / (m.r * m.r));
    gx += e * dx; gz += e * dz;
  }
  return [gx, gz];
}
export function moverAt(m: MoverSpec, clock: number): { x: number; z: number; vx: number; vz: number } {
  const w = (2 * Math.PI) / m.period, p = w * clock + (m.phase ?? 0) * 2 * Math.PI, s = (1 - Math.cos(p)) / 2, ds = (w * Math.sin(p)) / 2;
  const dx = m.b[0] - m.a[0], dz = m.b[1] - m.a[1];
  return { x: m.a[0] + dx * s, z: m.a[1] + dz * s, vx: dx * ds, vz: dz * ds };
}
/** The sails' turn in radians (0 has a sail straight down), and whether one is down across the door. */
export function windmillAngle(m: WindmillSpec, clock: number) { return ((clock / m.period + (m.phase ?? 0)) * 2 * Math.PI) % (2 * Math.PI); }
export function gateShut(m: WindmillSpec, clock: number) {
  const q = Math.PI / 2, u = ((windmillAngle(m, clock) % q) + q) % q;
  return u < BLADE_HALF || u > q - BLADE_HALF;
}
/** Ball speed for a putt of this power (0-1): the square root makes the roll length grow about evenly with power. */
export const puttSpeed = (power: number) => MAX_SPEED * Math.sqrt(Math.max(0, Math.min(1, power)));

function closest(s: Seg, x: number, z: number): [number, number] {
  const dx = s.bx - s.ax, dz = s.bz - s.az, l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l)) : 0;
  return [s.ax + dx * t, s.az + dz * t];
}

export type Ball = Vec & { vx: number; vz: number };
export type Mode = 'intro' | 'aim' | 'roll' | 'tunnel' | 'splash' | 'sunk' | 'card' | 'done';
export type EventKind = 'putt' | 'wall' | 'bumper' | 'lip' | 'cup' | 'splash' | 'sand' | 'tunnel-in' | 'tunnel-out' | 'acorn' | 'mover' | 'gate' | 'pickup' | 'hole' | 'turn' | 'rest' | 'round' | 'drop';
export type PuttEvent = { kind: EventKind; speed?: number; label?: string; who?: HeroId; strokes?: number; x?: number; z?: number };
export type Profile = {
  holeBest: Record<string, number>; aces: string[]; acorns: string[];
  courseBest: Partial<Record<CourseId, number>>; finished: CourseId[]; rounds: number;
};
export const freshProfile = (): Profile => ({ holeBest: {}, aces: [], acorns: [], courseBest: {}, finished: [], rounds: 0 });
export function readProfile(raw: string | null): Profile {
  const p = freshProfile();
  try {
    const s = JSON.parse(raw ?? 'null'); if (!s || typeof s !== 'object') return p;
    const ids = new Set(ALL_HOLES.map((h) => h.id)), count = (n: unknown, max: number) => Number.isSafeInteger(n) && (n as number) >= 1 && (n as number) <= max;
    for (const [id, n] of Object.entries(s.holeBest ?? {})) if (ids.has(id) && count(n, PICKUP)) p.holeBest[id] = n as number;
    for (const key of ['aces', 'acorns'] as const) if (Array.isArray(s[key])) p[key] = [...new Set((s[key] as unknown[]).filter((id): id is string => typeof id === 'string' && ids.has(id)))];
    for (const c of COURSE_IDS) if (count(s.courseBest?.[c], PICKUP * COURSES[c].holes.length)) p.courseBest[c] = s.courseBest[c];
    if (Array.isArray(s.finished)) p.finished = COURSE_IDS.filter((c) => s.finished.includes(c));
    if (Number.isSafeInteger(s.rounds) && s.rounds >= 0) p.rounds = s.rounds;
  } catch { /* a broken save starts fresh */ }
  return p;
}
export const lanternOpen = (p: Profile) => p.finished.includes('clover');

export function scoreLabel(strokes: number, par: number) {
  if (strokes >= PICKUP) return 'Picked up';
  if (strokes === 1) return 'Hole in one!';
  const d = strokes - par;
  return d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par!' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : 'Holed out';
}

type RoundSave = {
  v: 1; course: CourseId | null; holes: string[]; players: HeroId[]; scores: (number | null)[][]; hole: number; order: number[]; turn: number;
  mode: 'intro' | 'aim' | 'card'; strokes: number; x: number; z: number; clock: number; acorns: string[];
};
export type GameOptions = { course?: CourseId; hole?: string; players: HeroId[]; profile?: Profile };

export class PuttGame {
  readonly course: CourseId | null; readonly holeIds: string[]; readonly players: HeroId[];
  scores: (number | null)[][]; holeIndex = 0; order: number[]; turn = 0;
  mode: Mode = 'intro'; timer = INTRO; clock = 0;
  ball: Ball = { x: 0, z: 0, vx: 0, vz: 0 }; origin: Vec = { x: 0, z: 0 }; strokes = 0;
  aim = { angle: -Math.PI / 2, power: 0.4 };
  events: PuttEvent[] = []; label = ''; profile: Profile; profileChanged = false;
  /** Acorns picked up this round, so each one counts once. */
  acorns: string[] = [];
  /** Point the aim somewhere sensible after every putt. The solver turns this off: it aims for itself. */
  autoAim = true;
  rollTime = 0; private inSand = false; private lipped = false; private tunnel: Tunnel | null = null; private carry = 0;

  constructor(o: GameOptions) {
    this.course = o.hole ? null : (o.course ?? 'clover');
    this.holeIds = o.hole ? [o.hole] : COURSES[this.course!].holes.map((h) => h.id);
    this.players = o.players.length ? o.players.slice(0, 2) : ['dora'];
    this.scores = this.players.map(() => this.holeIds.map(() => null));
    this.order = this.players.map((_, i) => i);
    this.profile = o.profile ?? freshProfile();
    this.beginTurn(INTRO);
  }
  get practice() { return this.course === null; }
  get hole() { return getHole(this.holeIds[this.holeIndex]); }
  get player() { return this.order[this.turn]; }
  get hero(): HeroId { return this.players[this.player]; }
  total(p: number) { return this.scores[p].reduce<number>((s, n) => s + (n ?? 0), 0); }
  /** Par for the holes this player has finished, so a running score can say "two under". */
  parSoFar(p: number) { return this.scores[p].reduce<number>((s, n, i) => s + (n === null ? 0 : getHole(this.holeIds[i]).spec.par), 0); }

  private beginTurn(intro: number) {
    const h = this.hole;
    this.ball = { x: h.tee.x, z: h.tee.z, vx: 0, vz: 0 }; this.origin = { ...h.tee }; this.strokes = 0; this.label = '';
    this.mode = 'intro'; this.timer = intro; this.tunnel = null; this.inSand = false; this.lipped = false;
    this.aim.angle = this.suggestAim();
    this.events.push({ kind: this.turn === 0 ? 'hole' : 'turn', who: this.hero });
  }
  skipIntro() { if (this.mode === 'intro') { this.mode = 'aim'; this.timer = 0; } }
  setAim(angle: number, power: number) {
    if (Number.isFinite(angle)) this.aim.angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Number.isFinite(power)) this.aim.power = Math.max(0, Math.min(1, power));
  }
  /** Putts at the current aim. Returns false when the ball is not ready or the putt is too gentle to count. */
  putt(): boolean {
    if (this.mode === 'intro') this.skipIntro();
    if (this.mode !== 'aim' || this.aim.power < 0.02) return false;
    const s = puttSpeed(this.aim.power);
    this.strokes++; this.ball.vx = Math.cos(this.aim.angle) * s; this.ball.vz = Math.sin(this.aim.angle) * s;
    this.origin = { x: this.ball.x, z: this.ball.z }; this.mode = 'roll'; this.rollTime = 0; this.lipped = false;
    this.events.push({ kind: 'putt', speed: s, who: this.hero, strokes: this.strokes });
    return true;
  }
  /** After the scorecard: on to the next hole, or the end of the round. */
  next() {
    if (this.mode !== 'card') return;
    if (this.holeIndex + 1 >= this.holeIds.length) { this.finishRound(); return; }
    // Honour: whoever scored lower on the last hole putts first; ties keep the order.
    const last = this.holeIndex;
    this.order = [...this.order].sort((a, b) => (this.scores[a][last] ?? 0) - (this.scores[b][last] ?? 0));
    this.holeIndex++; this.turn = 0; this.clock = 0; this.beginTurn(INTRO);
  }
  private finishRound() {
    this.mode = 'done'; this.events.push({ kind: 'round' });
    if (this.practice || !this.course) return;
    const p = this.profile; p.rounds++;
    if (!p.finished.includes(this.course)) p.finished.push(this.course);
    for (let i = 0; i < this.players.length; i++) { const t = this.total(i); if (!(p.courseBest[this.course]! <= t)) p.courseBest[this.course] = t; }
    this.profileChanged = true;
  }

  step(dt = DT) {
    if (this.mode === 'card' || this.mode === 'done') return;
    this.clock += dt;
    if (this.mode === 'intro') { this.timer -= dt; if (this.timer <= 0) this.skipIntro(); return; }
    if (this.mode === 'aim') return;
    if (this.mode === 'splash') {
      this.timer -= dt;
      if (this.timer <= 0) { this.ball = { ...this.origin, vx: 0, vz: 0 }; this.settle(); }
      return;
    }
    if (this.mode === 'sunk') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.turn + 1 < this.players.length) { this.turn++; this.clock = 0; this.beginTurn(TURN_INTRO); } else this.mode = 'card';
      }
      return;
    }
    if (this.mode === 'tunnel') {
      this.timer -= dt;
      if (this.timer <= 0 && this.tunnel) {
        const t = this.tunnel, s = Math.max(2.2, Math.min(6, this.carry * 0.9));
        this.ball = { x: t.to.x + t.dir.x * 0.2, z: t.to.z + t.dir.z * 0.2, vx: t.dir.x * s, vz: t.dir.z * s };
        this.tunnel = null; this.mode = 'roll'; this.events.push({ kind: 'tunnel-out', x: this.ball.x, z: this.ball.z });
      }
      return;
    }
    this.rollTime += dt;
    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS && this.mode === 'roll'; i++) this.physics(h);
    if (this.mode === 'roll' && this.rollTime > ROLL_LIMIT) { this.ball.vx = this.ball.vz = 0; this.settle(); }
  }

  private physics(h: number) {
    const b = this.ball, hole = this.hole, t = tileAt(hole, b.x, b.z);
    if (!playable(t) || t.kind === 'water') { this.splash(); return; }
    const sand = t.kind === 'sand', surf = sand ? SAND : FELT;
    if (sand && !this.inSand) this.events.push({ kind: 'sand', speed: Math.hypot(b.vx, b.vz) });
    this.inSand = sand;
    const [gx, gz] = gradient(hole, b.x, b.z);
    let px = -G * gx, pz = -G * gz;
    const toCup = dist(b, hole.cup);
    if (toCup < CUP_PULL_R && toCup > 1e-6) { px += ((hole.cup.x - b.x) / toCup) * CUP_PULL; pz += ((hole.cup.z - b.z) / toCup) * CUP_PULL; }
    b.vx += px * h; b.vz += pz * h;
    let sp = Math.hypot(b.vx, b.vz);
    if (sp > 0) { const ns = Math.min(MAX_SPEED, Math.max(0, sp - (surf.a + surf.b * sp) * h)); b.vx *= ns / sp; b.vz *= ns / sp; sp = ns; }
    b.x += b.vx * h; b.z += b.vz * h;
    this.collide();
    sp = Math.hypot(b.vx, b.vz);
    // Burrows swallow the ball whatever its speed and send it out of the paired burrow.
    for (const tn of hole.tunnels) if (dist(b, tn.from) < MOUTH_R) {
      this.tunnel = tn; this.carry = sp; this.mode = 'tunnel'; this.timer = TUNNEL_TIME; this.ball = { ...tn.from, vx: 0, vz: 0 };
      this.events.push({ kind: 'tunnel-in', x: tn.from.x, z: tn.from.z }); return;
    }
    if (hole.acorn && !this.acorns.includes(hole.id) && dist(b, hole.acorn) < ACORN_R) {
      this.acorns.push(hole.id); this.events.push({ kind: 'acorn', who: this.hero });
      if (!this.profile.acorns.includes(hole.id)) { this.profile.acorns.push(hole.id); this.profileChanged = true; }
    }
    const d = dist(b, hole.cup);
    if (d < CUP_R) {
      if (sp < CUP_SPEED) { this.sink(); return; }
      if (!this.lipped) {
        // Too fast: it rattles over the rim, losing a fifth of its speed and turning a little away from the middle.
        this.lipped = true; const side = Math.sign(b.vx * (b.z - hole.cup.z) - b.vz * (b.x - hole.cup.x)) || 1, a = 0.22 * side, c = Math.cos(a), s = Math.sin(a);
        const vx = (b.vx * c - b.vz * s) * 0.8, vz = (b.vx * s + b.vz * c) * 0.8; b.vx = vx; b.vz = vz;
        this.events.push({ kind: 'lip', speed: sp });
      }
    } else if (d > CUP_R + BALL_R) this.lipped = false;
    if (sp < REST_SPEED) {
      const pull = Math.hypot(px, pz);
      if (pull < surf.hold) { b.vx = b.vz = 0; this.settle(); }
    }
  }

  private collide() {
    const b = this.ball, hole = this.hole;
    for (const s of hole.walls) {
      const [cx, cz] = closest(s, b.x, b.z), dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz);
      if (d >= BALL_R || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
      if (s.nx !== undefined) { if ((b.x - s.ax) * s.nx + (b.z - s.az) * s.nz! <= 0 || vn > 0) continue; }
      b.x = cx + nx * BALL_R; b.z = cz + nz * BALL_R;
      if (vn < 0) {
        b.vx -= (1 + WALL_E) * vn * nx; b.vz -= (1 + WALL_E) * vn * nz;
        if (-vn > 0.35) this.events.push({ kind: 'wall', speed: -vn, x: cx, z: cz });
      }
    }
    for (const m of hole.windmills) {
      if (!gateShut(m, this.clock)) continue;
      const s = m.gate, [cx, cz] = closest(s, b.x, b.z), dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz);
      if (d >= BALL_R) continue;
      // The sail is a flat board across the door: push the ball back out on its own side.
      const nx = s.ax === s.bx ? Math.sign(dx) || -Math.sign(b.vx) || 1 : 0, nz = s.az === s.bz ? Math.sign(dz) || -Math.sign(b.vz) || 1 : 0;
      b.x = nx ? cx + nx * BALL_R : b.x; b.z = nz ? cz + nz * BALL_R : b.z;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= (1 + GATE_E) * vn * nx; b.vz -= (1 + GATE_E) * vn * nz; this.events.push({ kind: 'gate', speed: -vn }); }
    }
    for (const c of hole.bumpers) {
      const dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz), min = BUMPER_R + BALL_R;
      if (d >= min || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
      b.x = c.x + nx * min; b.z = c.z + nz * min;
      if (vn < 0) { b.vx += -(1 + BUMPER_E) * vn * nx + nx * BUMPER_KICK; b.vz += -(1 + BUMPER_E) * vn * nz + nz * BUMPER_KICK; this.events.push({ kind: 'bumper', speed: -vn, x: c.x, z: c.z }); }
    }
    for (const spec of hole.movers) {
      const m = moverAt(spec, this.clock), dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz), min = spec.r + BALL_R;
      if (d >= min || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d, rel = (b.vx - m.vx) * nx + (b.vz - m.vz) * nz;
      b.x = m.x + nx * min; b.z = m.z + nz * min;
      if (rel < 0) { b.vx -= (1 + MOVER_E) * rel * nx; b.vz -= (1 + MOVER_E) * rel * nz; if (-rel > 0.3) this.events.push({ kind: 'mover', speed: -rel }); }
    }
    const sp = Math.hypot(b.vx, b.vz); if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vz *= MAX_SPEED / sp; }
  }

  private splash() {
    this.mode = 'splash'; this.timer = SPLASH_TIME; this.strokes++;
    this.events.push({ kind: 'splash', x: this.ball.x, z: this.ball.z }); this.ball.vx = this.ball.vz = 0;
  }
  private settle() {
    if (this.strokes >= MAX_STROKES) { this.holeOut(PICKUP); return; }
    this.mode = 'aim'; this.origin = { x: this.ball.x, z: this.ball.z };
    if (this.autoAim) this.aim.angle = this.suggestAim();
    this.events.push({ kind: 'rest' });
  }
  private sink() {
    this.ball = { ...this.hole.cup, vx: 0, vz: 0 };
    this.holeOut(this.strokes);
  }
  private holeOut(score: number) {
    const p = this.player, id = this.hole.id;
    this.scores[p][this.holeIndex] = score; this.label = scoreLabel(score, this.hole.spec.par);
    this.mode = 'sunk'; this.timer = score >= PICKUP ? PICKUP_TIME : SUNK_TIME;
    this.events.push({ kind: score >= PICKUP ? 'pickup' : 'cup', label: this.label, strokes: score, who: this.hero });
    const prof = this.profile;
    if (score < PICKUP && !(prof.holeBest[id] <= score)) { prof.holeBest[id] = score; this.profileChanged = true; }
    if (score === 1 && !prof.aces.includes(id)) { prof.aces.push(id); this.profileChanged = true; }
  }

  /** Is the straight roll from a to b clear of walls, bumpers and water? */
  clearLine(a: Vec, b: Vec) {
    const hole = this.hole, n = Math.ceil(dist(a, b) / 0.1);
    for (let i = 1; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n, t = tileAt(hole, x, z);
      if (!playable(t) || t.kind === 'water') return false;
      for (const s of hole.walls) { if (s.nx !== undefined) continue; const [cx, cz] = closest(s, x, z); if (Math.hypot(x - cx, z - cz) < BALL_R * 0.95) return false; }
      for (const c of hole.bumpers) if (Math.hypot(x - c.x, z - c.z) < BUMPER_R + BALL_R) return false;
    }
    return true;
  }
  /** A friendly starting aim: straight at the cup when the way is clear, otherwise at the furthest-along tile in plain view. */
  suggestAim() {
    const hole = this.hole, b = this.ball;
    if (this.clearLine(b, hole.cup)) return Math.atan2(hole.cup.z - b.z, hole.cup.x - b.x);
    let best: Vec | null = null, score = Infinity;
    for (const row of hole.tiles) for (const t of row) {
      const f = hole.flow[t.r][t.c]; if (!Number.isFinite(f) || t.kind !== 'felt') continue;
      const c = centre(t.c, t.r), s = f + dist(b, c) * 0.01;
      if (s < score && dist(b, c) > 0.6 && this.clearLine(b, c)) { score = s; best = c; }
    }
    return best ? Math.atan2(best.z - b.z, best.x - b.x) : this.aim.angle;
  }
  /** Which way a putt would go on flat felt: the start, the first bounce (if the putt is firm enough to reach a rail), and the
   *  end. It shows direction, not distance: the line stops GUIDE_REACH tiles out, or a tile and a bit past the first bounce. */
  guide(angle = this.aim.angle, power = this.aim.power): Vec[] {
    const hole = this.hole, s = puttSpeed(power), pts: Vec[] = [{ x: this.ball.x, z: this.ball.z }];
    let x = this.ball.x, z = this.ball.z, vx = Math.cos(angle) * s, vz = Math.sin(angle) * s, after = -1, travelled = 0;
    const h = DT / SUBSTEPS;
    for (let i = 0; i < 4000; i++) {
      let sp = Math.hypot(vx, vz); if (sp < REST_SPEED) break;
      const ns = Math.max(0, sp - (FELT.a + FELT.b * sp) * h); vx *= ns / sp; vz *= ns / sp; sp = ns;
      const ox = x, oz = z; x += vx * h; z += vz * h;
      travelled += Math.hypot(x - ox, z - oz);
      if (after >= 0) { after += Math.hypot(x - ox, z - oz); if (after > 1.2) break; } else if (travelled > GUIDE_REACH) break;
      let hit = false;
      for (const w of hole.walls) {
        const [cx, cz] = closest(w, x, z), dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
        if (d >= BALL_R || d < 1e-9) continue;
        const nx = dx / d, nz = dz / d, vn = vx * nx + vz * nz;
        if (w.nx !== undefined && ((x - w.ax) * w.nx + (z - w.az) * w.nz! <= 0 || vn > 0)) continue;
        x = cx + nx * BALL_R; z = cz + nz * BALL_R; if (vn < 0) { vx -= (1 + WALL_E) * vn * nx; vz -= (1 + WALL_E) * vn * nz; hit = true; }
      }
      for (const c of hole.bumpers) {
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = BUMPER_R + BALL_R;
        if (d >= min || d < 1e-9) continue;
        const nx = dx / d, nz = dz / d, vn = vx * nx + vz * nz; x = c.x + nx * min; z = c.z + nz * min;
        if (vn < 0) { vx += -(1 + BUMPER_E) * vn * nx + nx * BUMPER_KICK; vz += -(1 + BUMPER_E) * vn * nz + nz * BUMPER_KICK; hit = true; }
      }
      if (hit) { pts.push({ x, z }); if (after < 0) after = 0; }
    }
    pts.push({ x, z });
    return pts;
  }

  /** The round so far, saved whenever the ball is still. Practice holes are not saved. */
  save(): string | null {
    if (this.practice || !['intro', 'aim', 'card'].includes(this.mode)) return null;
    const r: RoundSave = {
      v: 1, course: this.course, holes: this.holeIds, players: this.players, scores: this.scores, hole: this.holeIndex, order: this.order, turn: this.turn,
      mode: this.mode as RoundSave['mode'], strokes: this.strokes, x: this.ball.x, z: this.ball.z, clock: this.clock, acorns: this.acorns,
    };
    return JSON.stringify(r);
  }
  static load(raw: string | null, profile?: Profile): PuttGame | null {
    try {
      const s = JSON.parse(raw ?? 'null') as RoundSave;
      if (!s || s.v !== 1 || !s.course || !COURSE_IDS.includes(s.course)) return null;
      const ids = COURSES[s.course].holes.map((h) => h.id);
      if (JSON.stringify(s.holes) !== JSON.stringify(ids)) return null;
      if (!Array.isArray(s.players) || !s.players.length || s.players.length > 2 || !s.players.every((p) => p === 'dora' || p === 'enzo')) return null;
      const g = new PuttGame({ course: s.course, players: s.players, profile });
      if (!Number.isSafeInteger(s.hole) || s.hole < 0 || s.hole >= ids.length) return null;
      if (!Array.isArray(s.scores) || s.scores.length !== s.players.length || !s.scores.every((row) => Array.isArray(row) && row.length === ids.length && row.every((n) => n === null || (Number.isSafeInteger(n) && n >= 1 && n <= PICKUP)))) return null;
      if (!Array.isArray(s.order) || [...s.order].sort().join() !== s.players.map((_, i) => i).join()) return null;
      if (!Number.isSafeInteger(s.turn) || s.turn < 0 || s.turn >= s.players.length) return null;
      if (!Number.isSafeInteger(s.strokes) || s.strokes < 0 || s.strokes >= MAX_STROKES) return null;
      g.scores = s.scores; g.holeIndex = s.hole; g.order = s.order; g.turn = s.turn; g.events = [];
      g.acorns = Array.isArray(s.acorns) ? s.acorns.filter((id) => ids.includes(id)) : [];
      g.clock = Number.isFinite(s.clock) && s.clock >= 0 ? s.clock : 0;
      if (s.mode === 'card') { g.mode = 'card'; return g; }
      g.beginTurn(INTRO); g.events = [];
      const t = tileAt(g.hole, s.x, s.z);
      if (s.strokes > 0 && Number.isFinite(s.x) && Number.isFinite(s.z) && playable(t) && t.kind !== 'water') {
        g.ball = { x: s.x, z: s.z, vx: 0, vz: 0 }; g.origin = { x: s.x, z: s.z }; g.strokes = s.strokes; g.aim.angle = g.suggestAim();
      }
      return g;
    } catch { return null; }
  }
  /** Test and bot helper: put the ball at rest on (x, z) with the hole clock at `clock`. */
  restAt(x: number, z: number, clock: number, strokes = this.strokes) {
    this.ball = { x, z, vx: 0, vz: 0 }; this.origin = { x, z }; this.clock = clock; this.strokes = strokes; this.mode = 'aim'; this.events = [];
  }
}
