// The Sunken Bellspire: a route planner for the bots and the map checks. It moves a body with the game's own physics
// (`stepBody`) through short input "macros" (walk a tile, a jump with a given hold and steer, a dash, a wall kick, a
// swim stroke...) and records where each one comes to rest. Those resting places are the graph's nodes, so any edge
// it finds is a move a player can make, and the bots replay exactly these inputs.
import { ROOMS, COLS, ROWS, TILE, WATER_AREAS, type Ability, type WaterArea, type Room, type HeroId } from './bellspire-world.js';
import { newBody, stepBody, boxClear, support, HERO_W, HERO_H, RUN, type Body, type BodyInput, type Caps, type Env } from './bellspire-physics.js';

const GW = 12 * COLS, GH = 9 * ROWS;
const GRID = new Uint8Array(GW * GH).fill(35); // '#'
const ROOM_AT = new Int16Array(GW * GH).fill(-1);
for (let i = 0; i < ROOMS.length; i++) {
  const r = ROOMS[i];
  for (let y = 0; y < r.rows.length; y++) for (let x = 0; x < r.rows[y].length; x++) {
    const c = r.gx * COLS + x, rr = r.gy * ROWS + y;
    const ch = r.rows[y][x];
    GRID[rr * GW + c] = ('#=Hgx^f' + 'djlkcub').includes(ch) ? ch.charCodeAt(0) : 46;
    ROOM_AT[rr * GW + c] = i;
  }
}
const at = (c: number, r: number) => (c < 0 || r < 0 || c >= GW || r >= GH ? 35 : GRID[r * GW + c]);
export const roomIndexAt = (x: number, y: number) => {
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  return c < 0 || r < 0 || c >= GW || r >= GH ? -1 : ROOM_AT[r * GW + c];
};
const CH = (s: string) => s.charCodeAt(0);
const HASH = CH('#'), EQ = CH('='), LAD = CH('H'), GLASS = CH('g'), BRK = CH('x'), SPIKE = CH('^');
const DOORS: Record<number, string> = {};
for (const ch of 'djlkcub') DOORS[CH(ch)] = ch;

/** What the planner assumes about the world: abilities, the water in each area, and a few story flags. */
export type NavState = { abilities: Ability[]; water: Record<WaterArea, 0 | 1>; keeper: boolean; broken?: Set<string> };
export const stateKey = (s: NavState) => `${[...s.abilities].sort().join('+')}|${WATER_AREAS.map((a) => s.water[a]).join('')}|${s.keeper ? 1 : 0}`;

export function navEnv(s: NavState): Env {
  const has = (a: Ability) => s.abilities.includes(a);
  const doorOpen = (ch: string) => ch === 'b' || (ch === 'd' && has('dash')) || (ch === 'j' && has('double')) || (ch === 'k' && has('wallkick')) || (ch === 'l' && has('lantern')) || (ch === 'c' && has('chime')) || (ch === 'u' && s.keeper);
  const solid = (c: number, r: number) => {
    const t = at(c, r);
    if (t === HASH || t === SPIKE) return true;
    if (t === BRK) return !s.broken?.has(`${c},${r}`);
    if (t === GLASS) return has('lantern');
    const d = DOORS[t];
    if (d) return !doorOpen(d);
    return false;
  };
  const ladder = (c: number, r: number) => {
    const t = at(c, r);
    if (t === LAD) return true;
    const d = DOORS[t];
    return !!d && doorOpen(d) && (at(c, r - 1) === LAD || at(c, r + 1) === LAD) && at(c - 1, r) !== LAD;
  };
  const floats: { x0: number; x1: number; y: number }[] = [];
  const surf = new Map<number, number | null>();
  ROOMS.forEach((room, i) => {
    const row = waterRow(room, s.water);
    surf.set(i, row === null ? null : (room.gy * ROWS + row) * TILE + 8);
    for (let y = 0; y < room.rows.length; y++) {
      const line = room.rows[y];
      for (let x = 0; x < line.length; x++) if (line[x] === 'f' && (x === 0 || line[x - 1] !== 'f')) {
        let e = x; while (line[e + 1] === 'f') e++;
        const rest = (room.gy * ROWS + y) * TILE + 10, sy = surf.get(i);
        floats.push({ x0: (room.gx * COLS + x) * TILE, x1: (room.gx * COLS + e + 1) * TILE, y: sy == null ? rest : Math.min(rest, sy - 3) });
      }
    }
  });
  return {
    solid, ladder,
    oneway: (c, r) => at(c, r) === EQ || (ladder(c, r) && !ladder(c, r - 1) && !solid(c, r - 1)),
    hazard: (c, r) => at(c, r) === SPIKE,
    surface: (x, y) => { const i = roomIndexAt(x, y); return i < 0 ? null : surf.get(i) ?? null; },
    deep: (x, y) => { const i = roomIndexAt(x, y); const room = ROOMS[i]; return i >= 0 && room.deep !== undefined ? (room.gy * ROWS + room.deep) * TILE : null; },
    floats: () => floats,
  };
}

export function waterRow(room: Room, water: Record<WaterArea, 0 | 1>) {
  if (!room.water) return null;
  return room.water[(WATER_AREAS as string[]).includes(room.area) ? water[room.area as WaterArea] : 0];
}

export function capsFor(s: NavState, hero: HeroId, assist = false): Caps {
  const has = (a: Ability) => s.abilities.includes(a);
  return {
    speed: RUN[hero], dash: hero === 'dora' && has('dash'), double: hero === 'dora' && has('double'), wallkick: hero === 'dora' && has('wallkick'),
    glide: hero === 'enzo' && has('glide'), deep: has('deep'), swimMul: 1, coyote: assist ? 9 : 6, buffer: assist ? 9 : 6,
  };
}

// ─── macros ────────────────────────────────────────────────────────────────

export type Mode = 'ground' | 'swim' | 'wall' | 'climb';
export type Macro = {
  name: string; hero: HeroId;
  /** the input on tick t, given the body (macros are closed-loop, so a replay adapts to small differences) */
  input: (t: number, b: Body, from: { x: number; y: number }) => BodyInput;
  max: number;
};
const I = (dir: -1 | 0 | 1, o: Partial<BodyInput> = {}): BodyInput => ({ dir, up: false, down: false, jumpP: false, jumpH: false, dashP: false, ...o });

function groundMacros(s: NavState): Macro[] {
  const has = (a: Ability) => s.abilities.includes(a);
  const out: Macro[] = [];
  for (const d of [-1, 1] as const) {
    out.push({ name: `walk${d}`, hero: 'dora', max: 120, input: (t, b, f) => I(Math.abs(b.x - f.x) < 15 ? d : 0) });
    for (const hold of [5, 11, 99]) for (const steer of [99, 16, 8]) {
      out.push({ name: `jump${d}h${hold}s${steer}`, hero: 'dora', max: 150, input: (t) => I(t < steer ? d : 0, { jumpP: t === 0, jumpH: t < hold }) });
    }
    // a running jump: run a tile first, then jump from full speed
    out.push({ name: `run${d}`, hero: 'dora', max: 150, input: (t, b, f) => I(d, { jumpP: Math.abs(b.x - f.x) >= 10 && Math.abs(b.x - f.x) < 12.5 && b.ground, jumpH: t < 60 }) });
    if (has('dash')) {
      out.push({ name: `dash${d}`, hero: 'dora', max: 120, input: (t) => I(t < 14 ? d : 0, { dashP: t === 0 }) });
      for (const at of [6, 12]) out.push({ name: `jdash${d}@${at}`, hero: 'dora', max: 150, input: (t) => I(d, { jumpP: t === 0, jumpH: t < 99, dashP: t === at }) });
    }
    if (has('double')) {
      for (const at of [10, 18]) out.push({ name: `dj${d}@${at}`, hero: 'dora', max: 160, input: (t) => I(d, { jumpP: t === 0 || t === at, jumpH: t !== at - 1 }) });
      if (has('dash')) out.push({ name: `djdash${d}`, hero: 'dora', max: 160, input: (t) => I(d, { jumpP: t === 0 || t === 14, jumpH: t !== 13, dashP: t === 22 }) });
    }
    if (has('glide')) {
      out.push({ name: `glide${d}`, hero: 'enzo', max: 400, input: (t) => I(d, { jumpP: t === 0, jumpH: true }) });
      out.push({ name: `glidedrop${d}`, hero: 'enzo', max: 400, input: (t, b, f) => I(d, { jumpH: !b.ground || Math.abs(b.x - f.x) > 30 }) });
    }
  }
  out.push({ name: 'jumpUp', hero: 'dora', max: 150, input: (t) => I(0, { jumpP: t === 0, jumpH: true }) });
  if (has('double')) out.push({ name: 'djUp', hero: 'dora', max: 160, input: (t) => I(0, { jumpP: t === 0 || t === 14, jumpH: t !== 13 }) });
  out.push(...CLIMB_STEPS.filter((m) => m.name === 'cUp' || m.name === 'cDown'));
  out.push({ name: 'dropThrough', hero: 'dora', max: 150, input: (t) => I(0, { down: t < 3, jumpP: t === 1 }) });
  return out;
}

/** One tile up or down a ladder (then let go of the stick and hang there), or off it to either side. */
const CLIMB_STEPS: Macro[] = [
  { name: 'cUp', hero: 'dora', max: 40, input: (t, b, f) => I(0, { up: b.y > (Math.ceil(f.y / TILE - 0.1) - 1) * TILE + 0.8 }) },
  { name: 'cDown', hero: 'dora', max: 40, input: (t, b, f) => I(0, { down: b.y < (Math.floor(f.y / TILE + 0.1) + 1) * TILE - 0.8 }) },
  ...([-1, 1] as const).flatMap((d) => [
    { name: `cOff${d}`, hero: 'dora' as HeroId, max: 60, input: () => I(d) },
    { name: `cJump${d}`, hero: 'dora' as HeroId, max: 120, input: (t: number) => I(d, { jumpP: t === 0, jumpH: t < 40 }) },
  ]),
];

function swimMacros(): Macro[] {
  const out: Macro[] = [];
  for (const d of [-1, 0, 1] as const) {
    out.push({ name: `rise${d}`, hero: 'dora', max: 30, input: (t) => I(d, { up: true, jumpP: t % 12 === 0, jumpH: true }) });
    out.push({ name: `drift${d}`, hero: 'dora', max: 30, input: () => I(d) });
    out.push({ name: `sink${d}`, hero: 'dora', max: 30, input: () => I(d, { down: true }) });
  }
  out.push(...CLIMB_STEPS.filter((m) => m.name === 'cUp'));
  return out;
}

function wallMacros(): Macro[] {
  const out: Macro[] = [];
  for (const d of [-1, 1] as const) {
    // kick off and drift across (to the far wall), or kick and steer back to climb the same wall
    out.push({ name: `kick${d}`, hero: 'dora', max: 120, input: (t) => I(d, { jumpP: t === 0, jumpH: true }) });
    out.push({ name: `kickBack${d}`, hero: 'dora', max: 120, input: (t) => I(t < 10 ? d : (-d as -1 | 1), { jumpP: t === 0, jumpH: true }) });
    out.push({ name: `letgo${d}`, hero: 'dora', max: 200, input: () => I(d) });
  }
  out.push({ name: 'slide', hero: 'dora', max: 200, input: (t, b) => I((b.wall || 0) as -1 | 0 | 1) });
  return out;
}

// ─── the graph ─────────────────────────────────────────────────────────────

export type Node = { key: number; c: number; r: number; mode: Mode; x: number; y: number; wall: -1 | 0 | 1 };
export type Edge = { to: number; macro: Macro; ticks: number };

const nodeKey = (c: number, r: number, mode: Mode, wall: number) => ((c * 200 + r) * 4 + (mode === 'ground' ? 0 : mode === 'swim' ? 1 : mode === 'wall' ? 2 : 3)) * 3 + (wall + 1);

/** Where a moving body has come to rest, as a node; null while still moving. */
function restNode(b: Body, t: number, m: Macro, s: NavState): Node | null {
  if (b.climb) {
    // hanging still on a ladder, on a whole tile
    if (b.vy !== 0 || t < 2) return null;
    const c = Math.floor(b.x / TILE), r = Math.round(b.y / TILE);
    return { key: nodeKey(c, r, 'climb', 0), c, r, mode: 'climb', x: c * TILE + 8, y: r * TILE, wall: 0 };
  }
  if (b.swim && !b.ground) {
    if (t < m.max && !m.name.startsWith('climb')) return null;
    const cx = b.x, cy = b.y - HERO_H / 2;
    const c = Math.floor(cx / TILE), r = Math.floor(cy / TILE);
    return swimNode(c, r, b.x, b.y);
  }
  if (b.ground && Math.abs(b.vx) < 0.01 && b.dashT <= 0) {
    const c = Math.floor(b.x / TILE), r = Math.round(b.y / TILE);
    return groundNode(c, r, b.x, b.y);
  }
  if (b.wall !== 0 && b.vy > 0.5 && s.abilities.includes('wallkick') && !b.ground && t > 3) {
    const c = Math.floor(b.x / TILE), r = Math.floor(b.y / TILE);
    return { key: nodeKey(c, r, 'wall', b.wall), c, r, mode: 'wall', x: b.x, y: b.y, wall: b.wall };
  }
  return null;
}

let ENV_FOR_SWIM: Env | null = null;
/** A swim node's resting body sits in the middle of its tile, nudged so it never overlaps a wall. */
function swimNode(c: number, r: number, fx: number, fy: number): Node {
  let x = c * TILE + 8, y = r * TILE + 8 + HERO_H / 2;
  const env = ENV_FOR_SWIM;
  if (env) {
    const clear = (px: number, py: number) => boxClear(env, px - HERO_W / 2, py - HERO_H, px + HERO_W / 2, py);
    if (!clear(x, y)) {
      let ok = false;
      for (let d = 1; d <= 12 && !ok; d++) for (const [dx, dy] of [[0, -d], [0, d], [-d, 0], [d, 0]]) if (clear(x + dx, y + dy)) { x += dx; y += dy; ok = true; break; }
      if (!ok) { x = fx; y = fy; }
    }
  }
  return { key: nodeKey(c, r, 'swim', 0), c, r, mode: 'swim', x, y, wall: 0 };
}

/** A ground node stands in the middle of its tile when it can (so the graph doesn't depend on search order). */
function groundNode(c: number, r: number, fx: number, fy: number): Node {
  let x = fx;
  const env = ENV_FOR_SWIM;
  if (env) {
    const cx = c * TILE + 8, t = newBody(cx, fy);
    if (boxClear(env, cx - HERO_W / 2, fy - HERO_H, cx + HERO_W / 2, fy) && support(env, t)) x = cx;
  }
  return { key: nodeKey(c, r, 'ground', 0), c, r, mode: 'ground', x, y: fy, wall: 0 };
}

export function bodyAt(n: Node, s: NavState): Body {
  const b = newBody(n.x, n.y);
  if (n.mode === 'ground') { b.ground = true; b.airJumps = s.abilities.includes('double') ? 1 : 0; }
  if (n.mode === 'wall') { b.wall = n.wall; b.vy = 1.4; b.face = n.wall as 1 | -1; }
  if (n.mode === 'climb') { b.climb = true; b.airJumps = s.abilities.includes('double') ? 1 : 0; }
  return b;
}

/** Simulate one macro from a node; returns the node it comes to rest at, or null if it hits a hazard or never settles. */
export function simulate(env: Env, s: NavState, from: Node, m: Macro, trace?: Body[]): { node: Node; ticks: number } | null {
  ENV_FOR_SWIM = env;
  const b = bodyAt(from, s);
  const caps = capsFor(s, m.hero);
  const f = { x: from.x, y: from.y };
  // a walk ends once the next tile is reached and the body has stopped
  let air = false, landed = false;
  for (let t = 0; t < m.max + 60; t++) {
    let inp = t < m.max && !landed ? m.input(t, b, f) : I(0);
    if (landed && m.name.startsWith('walk')) inp = I(0);
    stepBody(b, inp, env, caps);
    if (!b.ground) air = true; else if (air && !b.swim) landed = true;
    if (trace) trace.push({ ...b });
    if (b.hazard) return null;
    if (roomIndexAt(b.x, b.y - 4) < 0) return null;
    if (t >= 1) {
      const n = restNode(b, t, m, s);
      if (n && !(n.mode === 'ground' && n.key === from.key && m.name.startsWith('walk') && t < 30)) {
        if (n.mode === 'ground' && inp.dir !== 0) continue;
        return { node: n, ticks: t + 1 };
      }
    }
  }
  return null;
}

export class Graph {
  env: Env;
  nodes = new Map<number, Node>();
  edges = new Map<number, Edge[]>();
  constructor(public s: NavState) { this.env = navEnv(s); }
  private gm: Macro[] | null = null;
  macrosFor(n: Node): Macro[] {
    if (n.mode === 'ground') return (this.gm ??= groundMacros(this.s));
    if (n.mode === 'swim') return SWIM;
    if (n.mode === 'climb') return CLIMB_STEPS;
    return WALL;
  }
  expand(n: Node): Edge[] {
    const have = this.edges.get(n.key);
    if (have) return have;
    const out: Edge[] = [];
    const seen = new Set<number>();
    for (const m of this.macrosFor(n)) {
      const res = simulate(this.env, this.s, n, m);
      if (!res || res.node.key === n.key || seen.has(res.node.key)) continue;
      seen.add(res.node.key);
      if (!this.nodes.has(res.node.key)) this.nodes.set(res.node.key, res.node);
      out.push({ to: res.node.key, macro: m, ticks: res.ticks });
    }
    this.edges.set(n.key, out);
    return out;
  }
  /** Settle a body standing or swimming at (x, y) into a node. */
  nodeAt(x: number, y: number, swim = false, climb = false): Node {
    const c = Math.floor(x / TILE);
    if (climb) { const r = Math.round(y / TILE); const n: Node = { key: nodeKey(c, r, 'climb', 0), c, r, mode: 'climb', x: c * TILE + 8, y: r * TILE, wall: 0 }; return this.nodes.get(n.key) ?? (this.nodes.set(n.key, n), n); }
    if (swim) { ENV_FOR_SWIM = this.env; const r = Math.floor((y - HERO_H / 2) / TILE); const n = swimNode(c, r, x, y); return this.nodes.get(n.key) ?? (this.nodes.set(n.key, n), n); }
    ENV_FOR_SWIM = this.env;
    const r = Math.round(y / TILE);
    const n = groundNode(c, r, x, y);
    return this.nodes.get(n.key) ?? (this.nodes.set(n.key, n), n);
  }
  /** Breadth-first search (by ticks, Dijkstra) to the first node that satisfies `goal`. Returns the edge path. */
  path(from: Node, goal: (n: Node) => boolean, limit = 6000): Edge[] | null {
    if (!this.nodes.has(from.key)) this.nodes.set(from.key, from);
    const dist = new Map<number, number>([[from.key, 0]]);
    const back = new Map<number, { prev: number; e: Edge }>();
    const open: number[] = [from.key];
    let expanded = 0;
    while (open.length) {
      // a small binary heap would be faster; the open set stays short enough for a scan
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i])! < dist.get(open[bi])!) bi = i;
      const k = open.splice(bi, 1)[0];
      const n = this.nodes.get(k)!;
      if (goal(n)) {
        const out: Edge[] = [];
        let cur = k;
        while (cur !== from.key) { const st = back.get(cur)!; out.unshift(st.e); cur = st.prev; }
        return out;
      }
      if (++expanded > limit) return null;
      for (const e of this.expand(n)) {
        const nd = dist.get(k)! + e.ticks + 4;
        if (nd < (dist.get(e.to) ?? Infinity)) {
          if (!dist.has(e.to)) open.push(e.to);
          dist.set(e.to, nd); back.set(e.to, { prev: k, e });
        }
      }
    }
    return null;
  }
  /** Every node reachable from `from` (expanding as it goes). */
  reach(from: Node[], limit = 200000): Set<number> {
    const seen = new Set<number>();
    const q: Node[] = [];
    for (const f of from) { if (!this.nodes.has(f.key)) this.nodes.set(f.key, f); if (!seen.has(f.key)) { seen.add(f.key); q.push(f); } }
    while (q.length && seen.size < limit) {
      const n = q.shift()!;
      for (const e of this.expand(n)) if (!seen.has(e.to)) { seen.add(e.to); q.push(this.nodes.get(e.to)!); }
    }
    return seen;
  }
}
const SWIM = swimMacros(), WALL = wallMacros();

export const nodeRoom = (n: Node) => ROOMS[roomIndexAt(n.x, n.y - 4)] ?? null;
