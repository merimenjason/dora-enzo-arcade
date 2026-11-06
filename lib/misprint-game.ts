// Misprint: the rules. A page is a two-ink risograph print on a W by H grid of paper. Each ink lives on its own plate:
// pink is Dora's, teal is Enzo's. A plate is a set of inked cells (blocks, ladders, stamp pads, and hidden cells that
// only print while the other plate's stamp is pressed) plus an offset (dx, dy) inside the page frame. Dora is printed
// on the pink plate and Enzo on the teal one, so sliding a plate moves its chinchilla with it.
//
// Solidity: each chinchilla stands on and is blocked by its own ink (purple, where both inks overlap, has both, so it
// holds both), the yellow key plate (fixed to the paper), the page's side and top edges, and each other. The other
// plate's ink alone is a ghost to them. One-way folds are flaps of the paper itself: a chinchilla can't move into a
// fold against its arrow (so an up fold is a floor from above and a hatch from below). Ladders are printed in one ink
// and only that ink's owner climbs them. A pressure stamp on one plate prints the other plate's hidden cells while
// anyone stands on it.
//
// A turn is one move: step left or right (climbing a one-cell ledge on the way), climb up or down a ladder, or shift
// the active chinchilla's plate one cell in any direction. Switching chinchilla is free. Whoever stands on the mover's
// head rides along if they can. Gravity settles after every move. A move is refused (and costs nothing) when it would
// push ink off the paper, push a chinchilla into something solid, or drop a chinchilla off the bottom of the page.
// A page is done when both chinchillas stand on its staple tiles at once. Deterministic, no DOM.
import { PAGES, ZINES, type PageDef } from './misprint-levels.js';
export { PAGES, ZINES, type PageDef };

export const SAVE_KEY = 'misprint-v1';
export type Who = 0 | 1;                     // 0 Dora (pink), 1 Enzo (teal)
export const NAMES = ['Dora', 'Enzo'] as const;
export type Action = 'L' | 'R' | 'U' | 'D' | 'Q' | 'sU' | 'sD' | 'sL' | 'sR';
export const ACTIONS: Action[] = ['L', 'R', 'U', 'D', 'Q', 'sU', 'sD', 'sL', 'sR'];
export type Mechanic = 'walk' | 'switch' | 'shift' | 'ride' | 'yellow' | 'stamp' | 'fold' | 'ladder';
export type Refusal = 'edge' | 'blocked' | 'fall' | 'embed' | 'nothing';

// plate cell kinds
export const K_NONE = 0, K_BLOCK = 1, K_LADDER = 2, K_STAMP = 3, K_HIDDEN = 4, K_MARK = 5; // a mark is a registration cross: ink that must stay on the paper but holds nobody
// fold arrows
export const F_UP = 1, F_RIGHT = 2, F_DOWN = 3, F_LEFT = 4;
const FOLD_V: [number, number][] = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]];

export type Page = {
  def: PageDef; id: string; index: number; zine: number; w: number; h: number;
  plate: [Uint8Array, Uint8Array];          // plate-local kinds, indexed y * w + x (local coords = page coords at offset 0)
  yellow: Uint8Array; fold: Uint8Array; staple: Uint8Array;
  drop: number;                              // page cell index of the ink drop, -1 for none
  start: State;
  range: [[number, number, number, number], [number, number, number, number]]; // per plate: min dx, max dx, min dy, max dy
};
export type State = { pos: [[number, number], [number, number]]; off: [[number, number], [number, number]]; active: Who; drop: boolean };
export type Opts = { noShift?: boolean; noRide?: boolean; noYellow?: boolean; noStamp?: boolean; noFold?: boolean; noLadder?: boolean; only?: Who };
export type Step = { ok: true; state: State; paths: [[number, number][], [number, number][]]; dropNow: boolean; kind: 'walk' | 'climb' | 'shift' | 'switch' }
  | { ok: false; reason: Refusal };

const DIRS: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

// ---------------------------------------------------------------- pages
const cache = new Map<string, Page>();
export function page(id: string | number): Page {
  const def = typeof id === 'number' ? PAGES[id] : PAGES.find((p) => p.id === id);
  if (!def) throw new Error(`no page ${id}`);
  const hit = cache.get(def.id); if (hit) return hit;
  const p = buildPage(def, PAGES.indexOf(def)); cache.set(def.id, p); return p;
}
export function buildPage(def: PageDef, index = -1): Page {
  const h = def.map.length, w = def.map[0].length;
  if (def.map.some((r) => r.length !== w)) throw new Error(`${def.id}: ragged map`);
  const n = w * h;
  const pink = new Uint8Array(n), teal = new Uint8Array(n), yellow = new Uint8Array(n), fold = new Uint8Array(n), staple = new Uint8Array(n);
  let drop = -1; const start: State = { pos: [[-1, -1], [-1, -1]], off: [[0, 0], [0, 0]], active: def.startWith ?? 0, drop: false };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = def.map[y][x], i = y * w + x;
    switch (ch) {
      case '.': break;
      case 'P': pink[i] = K_BLOCK; break;
      case 'T': teal[i] = K_BLOCK; break;
      case 'X': pink[i] = K_BLOCK; teal[i] = K_BLOCK; break;
      case 'Y': yellow[i] = 1; break;
      case 'p': pink[i] = K_LADDER; break;
      case 't': teal[i] = K_LADDER; break;
      case 'k': pink[i] = K_LADDER; teal[i] = K_LADDER; break;
      case '1': pink[i] = K_STAMP; break;
      case '2': teal[i] = K_STAMP; break;
      case '3': pink[i] = K_HIDDEN; break;
      case '4': teal[i] = K_HIDDEN; break;
      case 'm': pink[i] = K_MARK; break;
      case 'n': teal[i] = K_MARK; break;
      case '+': pink[i] = K_MARK; teal[i] = K_MARK; break;
      case '^': fold[i] = F_UP; break;
      case '>': fold[i] = F_RIGHT; break;
      case 'v': fold[i] = F_DOWN; break;
      case '<': fold[i] = F_LEFT; break;
      case 'D': start.pos[0] = [x, y]; break;
      case 'E': start.pos[1] = [x, y]; break;
      case 'd': start.pos[0] = [x, y]; staple[i] = 1; break;
      case 'e': start.pos[1] = [x, y]; staple[i] = 1; break;
      case 'S': staple[i] = 1; break;
      case '*': drop = i; break;
      default: throw new Error(`${def.id}: unknown map char '${ch}'`);
    }
  }
  if (start.pos[0][0] < 0 || start.pos[1][0] < 0) throw new Error(`${def.id}: needs D and E`);
  const range = [pink, teal].map((pl) => {
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let i = 0; i < n; i++) if (pl[i]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return [0, 0, 0, 0];
    return [-x0, w - 1 - x1, -y0, h - 1 - y1];
  }) as Page['range'];
  const pg: Page = { def, id: def.id, index, zine: def.zine, w, h, plate: [pink, teal], yellow, fold, staple, drop, start, range };
  const s = settle(pg, start, {});
  if (!('state' in s)) throw new Error(`${def.id}: the start doesn't settle`);
  pg.start = s.state;
  return pg;
}

// ---------------------------------------------------------------- cells
export function plateAt(pg: Page, p: Who, x: number, y: number, st: State): number {
  const lx = x - st.off[p][0], ly = y - st.off[p][1];
  if (lx < 0 || ly < 0 || lx >= pg.w || ly >= pg.h) return K_NONE;
  return pg.plate[p][ly * pg.w + lx];
}
/** which plates' hidden cells are printed right now: plate p's hidden cells show while the other plate's stamp is pressed */
export function revealed(pg: Page, st: State, o: Opts): [boolean, boolean] {
  if (o.noStamp) return [false, false];
  const pressed: [boolean, boolean] = [false, false];
  for (const c of [0, 1] as Who[]) {
    const [x, y] = st.pos[c];
    for (const p of [0, 1] as Who[]) if (plateAt(pg, p, x, y + 1, st) === K_STAMP) pressed[p] = true;
  }
  return [pressed[1], pressed[0]];
}
/** is (x, y) solid ink for chinchilla c (its own plate, the key plate, the page's edges)? Not counting the other chinchilla. */
function inkSolid(pg: Page, c: Who, x: number, y: number, st: State, rev: [boolean, boolean], o: Opts): boolean {
  if (x < 0 || x >= pg.w || y < 0) return true;
  if (y >= pg.h) return false;
  if (!o.noYellow && pg.yellow[y * pg.w + x]) return true;
  const k = plateAt(pg, c, x, y, st);
  return k === K_BLOCK || k === K_STAMP || (k === K_HIDDEN && rev[c]);
}
export function solidFor(pg: Page, c: Who, x: number, y: number, st: State, o: Opts = {}): boolean {
  const rev = revealed(pg, st, o);
  if (inkSolid(pg, c, x, y, st, rev, o)) return true;
  const q = st.pos[1 - c]; return q[0] === x && q[1] === y;
}
const ladderFor = (pg: Page, c: Who, x: number, y: number, st: State, o: Opts) => !o.noLadder && y >= 0 && y < pg.h && plateAt(pg, c, x, y, st) === K_LADDER;
const foldAt = (pg: Page, x: number, y: number, o: Opts) => o.noFold || x < 0 || y < 0 || x >= pg.w || y >= pg.h ? 0 : pg.fold[y * pg.w + x];

/** can c step from where it is by (vx, vy)? 'void' means off the bottom of the page */
function enter(pg: Page, c: Who, st: State, vx: number, vy: number, rev: [boolean, boolean], o: Opts): boolean | 'void' {
  const x = st.pos[c][0] + vx, y = st.pos[c][1] + vy;
  if (y >= pg.h) return 'void';
  if (inkSolid(pg, c, x, y, st, rev, o)) return false;
  const q = st.pos[1 - c]; if (q[0] === x && q[1] === y) return false;
  const f = foldAt(pg, x, y, o); if (f && FOLD_V[f][0] === -vx && FOLD_V[f][1] === -vy) return false;
  return true;
}
function supported(pg: Page, c: Who, st: State, rev: [boolean, boolean], o: Opts): boolean {
  const [x, y] = st.pos[c];
  if (ladderFor(pg, c, x, y, st, o) || ladderFor(pg, c, x, y + 1, st, o)) return true;
  return enter(pg, c, st, 0, 1, rev, o) === false;
}

export const clone = (s: State): State => ({ pos: [[s.pos[0][0], s.pos[0][1]], [s.pos[1][0], s.pos[1][1]]], off: [[s.off[0][0], s.off[0][1]], [s.off[1][0], s.off[1][1]]], active: s.active, drop: s.drop });

type Track = { paths: [[number, number][], [number, number][]]; drop: boolean };
const mark = (pg: Page, st: State, c: Who, tr: Track) => {
  const [x, y] = st.pos[c]; tr.paths[c].push([x, y]);
  if (pg.drop >= 0 && y * pg.w + x === pg.drop && !st.drop) { st.drop = true; tr.drop = true; }
};

/** gravity and stamps, until nothing changes. Null when a chinchilla would fall off the page or be trapped in ink. */
function settle(pg: Page, st0: State, o: Opts, tr?: Track): { state: State } | { fail: 'fall' | 'embed' } {
  const st = clone(st0); const t: Track = tr ?? { paths: [[], []], drop: false };
  for (let guard = 0; guard < 200; guard++) {
    const rev = revealed(pg, st, o);
    for (const c of [0, 1] as Who[]) if (inkSolid(pg, c, st.pos[c][0], st.pos[c][1], st, rev, o)) return { fail: 'embed' };
    let moved = false;
    const order: Who[] = st.pos[0][1] >= st.pos[1][1] ? [0, 1] : [1, 0];
    for (const c of order) {
      if (supported(pg, c, st, rev, o)) continue;
      if (st.pos[c][1] + 1 >= pg.h) return { fail: 'fall' };
      st.pos[c][1]++; mark(pg, st, c, t); moved = true;
    }
    if (!moved) {
      const r2 = revealed(pg, st, o);
      if (r2[0] === rev[0] && r2[1] === rev[1]) return { state: st };
    }
  }
  return { fail: 'embed' };
}

/** move c along unit steps, with whoever stands on its head riding along. False when c's own move is blocked. */
function travel(pg: Page, st: State, c: Who, steps: [number, number][], o: Opts, tr: Track, rev: [boolean, boolean]): Refusal | null {
  const r: Who = (1 - c) as Who;
  let riding = !o.noRide && st.pos[r][0] === st.pos[c][0] && st.pos[r][1] === st.pos[c][1] - 1;
  for (const [vx, vy] of steps) {
    if (vy < 0 && riding) {           // going up: the rider must go up first
      const e = enter(pg, r, st, vx, vy, rev, o);
      if (e !== true) return 'blocked';
      st.pos[r][0] += vx; st.pos[r][1] += vy; mark(pg, st, r, tr);
      const e2 = enter(pg, c, st, vx, vy, rev, o);
      if (e2 !== true) return e2 === 'void' ? 'fall' : 'blocked';
      st.pos[c][0] += vx; st.pos[c][1] += vy; mark(pg, st, c, tr);
      continue;
    }
    const e = enter(pg, c, st, vx, vy, rev, o);
    if (e !== true) return e === 'void' ? 'fall' : 'blocked';
    st.pos[c][0] += vx; st.pos[c][1] += vy; mark(pg, st, c, tr);
    if (riding) {
      if (enter(pg, r, st, vx, vy, rev, o) === true) { st.pos[r][0] += vx; st.pos[r][1] += vy; mark(pg, st, r, tr); }
      else riding = false;              // the rider is knocked off and stays behind (gravity takes it from here)
    }
  }
  return null;
}

/** one action from a settled state */
export function step(pg: Page, st0: State, a: Action, o: Opts = {}): Step {
  const tr: Track = { paths: [[], []], drop: false };
  if (a === 'Q') {
    if (o.only !== undefined) return { ok: false, reason: 'nothing' };
    const s = clone(st0); s.active = (1 - s.active) as Who;
    return { ok: true, state: s, paths: tr.paths, dropNow: false, kind: 'switch' };
  }
  const c = st0.active; if (o.only !== undefined && o.only !== c) return { ok: false, reason: 'nothing' };
  const st = clone(st0); const rev = revealed(pg, st, o);
  mark(pg, st, 0, tr); mark(pg, st, 1, tr); tr.drop = false;
  let kind: 'walk' | 'climb' | 'shift' = 'walk';
  if (a === 'L' || a === 'R') {
    const s = a === 'L' ? -1 : 1;
    const e = enter(pg, c, st, s, 0, rev, o);
    if (e === true) { const why = travel(pg, st, c, [[s, 0]], o, tr, rev); if (why) return { ok: false, reason: why }; }
    else {
      // a one-cell ledge: only up onto something solid (ink, key plate or the other chinchilla), never over a fold
      const [x, y] = st.pos[c];
      const ledge = inkSolid(pg, c, x + s, y, st, rev, o) || (st.pos[1 - c][0] === x + s && st.pos[1 - c][1] === y);
      if (!ledge || x + s < 0 || x + s >= pg.w) return { ok: false, reason: 'blocked' };
      const why = travel(pg, st, c, [[0, -1], [s, 0]], o, tr, rev); if (why) return { ok: false, reason: why };
      kind = 'climb';
    }
  } else if (a === 'U' || a === 'D') {
    const [x, y] = st.pos[c];
    if (a === 'U' && !ladderFor(pg, c, x, y, st, o)) return { ok: false, reason: 'nothing' };
    if (a === 'D' && !ladderFor(pg, c, x, y + 1, st, o)) return { ok: false, reason: 'nothing' };
    const why = travel(pg, st, c, [[0, a === 'U' ? -1 : 1]], o, tr, rev); if (why) return { ok: false, reason: why };
    kind = 'climb';
  } else {
    if (o.noShift) return { ok: false, reason: 'nothing' };
    const [vx, vy] = DIRS[a[1]];
    const nx = st.off[c][0] + vx, ny = st.off[c][1] + vy, rg = pg.range[c];
    if (nx < rg[0] || nx > rg[1] || ny < rg[2] || ny > rg[3]) return { ok: false, reason: 'edge' };
    // the plate moves; its chinchilla moves with it (entering with the plate already moved, so its own ink stays put)
    const r: Who = (1 - c) as Who;
    const riding = !o.noRide && st.pos[r][0] === st.pos[c][0] && st.pos[r][1] === st.pos[c][1] - 1;
    st.off[c] = [nx, ny];
    const rev2 = revealed(pg, st, o);
    if (vy < 0 && riding) {
      if (enter(pg, r, st, vx, vy, rev2, o) !== true) return { ok: false, reason: 'blocked' };
      st.pos[r][0] += vx; st.pos[r][1] += vy; mark(pg, st, r, tr);
    }
    const e = enter(pg, c, st, vx, vy, rev2, o);
    if (e !== true) return { ok: false, reason: e === 'void' ? 'fall' : 'blocked' };
    st.pos[c][0] += vx; st.pos[c][1] += vy; mark(pg, st, c, tr);
    if (riding && vy >= 0 && enter(pg, r, st, vx, vy, rev2, o) === true) { st.pos[r][0] += vx; st.pos[r][1] += vy; mark(pg, st, r, tr); }
    kind = 'shift';
  }
  const done = settle(pg, st, o, tr);
  if (!('state' in done)) return { ok: false, reason: done.fail };
  return { ok: true, state: done.state, paths: tr.paths, dropNow: tr.drop, kind };
}

export const won = (pg: Page, st: State) => st.pos.every(([x, y]) => y >= 0 && y < pg.h && x >= 0 && x < pg.w && pg.staple[y * pg.w + x] === 1);

// ---------------------------------------------------------------- the solver
/** a state as one number: both positions, both plate offsets, who is active and whether the drop is collected */
export function key(pg: Page, st: State, withDrop = false): number {
  const n = pg.w * pg.h;
  const o = (p: Who) => (st.off[p][0] - pg.range[p][0]) * 32 + (st.off[p][1] - pg.range[p][2]);
  const a = st.pos[0][1] * pg.w + st.pos[0][0], b = st.pos[1][1] * pg.w + st.pos[1][0];
  return ((((a * n + b) * 1024 + o(0)) * 1024 + o(1)) * 2 + st.active) * 2 + (withDrop && st.drop ? 1 : 0);
}
export type Solution = { moves: number; actions: Action[]; switches: number; explored: number } | null;
/**
 * Fewest moves to finish (switches are free; among the shortest, fewest switches). Dijkstra on a bucket queue with
 * a move costing 64 and a switch 1. `needDrop` also requires the ink drop. `limit` caps the states explored.
 */
export function solve(pg: Page, from: State = pg.start, o: Opts = {}, needDrop = false, limit = 3_000_000, maxMoves = 120): Solution {
  const W = 64;
  const start = clone(from); if (o.only !== undefined && start.active !== o.only) start.active = o.only;
  const k0 = key(pg, start, needDrop);
  const dist = new Map<number, number>([[k0, 0]]);
  const prev = new Map<number, [number, Action]>();
  const states = new Map<number, State>([[k0, start]]);
  const buckets: number[][] = [[k0]];
  let explored = 0;
  for (let d = 0; d < buckets.length && d <= maxMoves * W; d++) {
    const b = buckets[d]; if (!b) continue;
    for (let i = 0; i < b.length; i++) {
      const k = b[i]; if (dist.get(k) !== d) continue;
      const st = states.get(k)!;
      if (won(pg, st) && (!needDrop || st.drop)) {
        const actions: Action[] = []; let cur = k;
        while (cur !== k0) { const [pk, a] = prev.get(cur)!; actions.push(a); cur = pk; }
        actions.reverse();
        const switches = actions.filter((a) => a === 'Q').length;
        return { moves: actions.length - switches, actions, switches, explored };
      }
      if (++explored > limit) return null;
      for (const a of ACTIONS) {
        const r = step(pg, st, a, o); if (!r.ok) continue;
        const nk = key(pg, r.state, needDrop), nd = d + (a === 'Q' ? 1 : W);
        const od = dist.get(nk);
        if (od !== undefined && od <= nd) continue;
        dist.set(nk, nd); prev.set(nk, [k, a]); states.set(nk, r.state);
        (buckets[nd] ??= []).push(nk);
      }
    }
    buckets[d] = undefined as unknown as number[];
  }
  return null;
}

// ---------------------------------------------------------------- a game in progress
export type Snap = { st: State; moves: number };
export class Game {
  pg: Page; st: State; moves = 0; hints = 0; history: Snap[] = []; facing: [number, number] = [1, 1]; done = false; dropEver = false;
  constructor(id: string | number) { this.pg = page(id); this.st = clone(this.pg.start); }
  do(a: Action): Step {
    if (this.done) return { ok: false, reason: 'nothing' };
    const r = step(this.pg, this.st, a);
    if (!r.ok) return r;
    this.history.push({ st: this.st, moves: this.moves });
    if (a === 'L' || a === 'R') this.facing[this.st.active] = a === 'L' ? -1 : 1;
    this.st = r.state; if (a !== 'Q') this.moves++;
    if (r.state.drop) this.dropEver = true;
    if (won(this.pg, this.st)) this.done = true;
    return r;
  }
  undo(): boolean {
    const h = this.history.pop(); if (!h) return false;
    this.st = h.st; this.moves = h.moves; this.done = won(this.pg, this.st); return true;
  }
  restart(): boolean {
    if (this.moves === 0 && this.history.length === 0) return false;
    this.history.push({ st: this.st, moves: this.moves }); this.st = clone(this.pg.start); this.moves = 0; this.done = false; return true;
  }
  /** the next move of a shortest finish from here (null when there is none or the page is done) */
  hint(): Action | null {
    if (this.done) return null;
    const s = solve(this.pg, this.st, {}, false, 1_500_000);
    this.hints++;
    return s && s.actions.length ? s.actions[0] : null;
  }
  get won() { return won(this.pg, this.st); }
}

// ---------------------------------------------------------------- stars, the save, unlocking
export type PageRecord = { best: number; drop: boolean; hints: number };
export type Settings = { sound: boolean; music: boolean; peek: boolean; motion: boolean };
export type Save = { v: 1; pages: Record<string, PageRecord>; settings: Settings; seenIntro: boolean; ended: number[] };
export const newSave = (): Save => ({ v: 1, pages: {}, settings: { sound: true, music: true, peek: false, motion: true }, seenIntro: false, ended: [] });
export const serialise = (s: Save) => JSON.stringify(s);
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  let d: unknown; try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return s;
  const o = d as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.pages && typeof o.pages === 'object' && !Array.isArray(o.pages)) for (const [id, r] of Object.entries(o.pages as Record<string, unknown>)) {
    if (!PAGES.some((p) => p.id === id) || !r || typeof r !== 'object') continue;
    const { best, drop, hints } = r as Record<string, unknown>;
    if (typeof best !== 'number' || !Number.isFinite(best) || best < 1 || best > 9999) continue;
    s.pages[id] = { best: Math.floor(best), drop: drop === true, hints: typeof hints === 'number' && Number.isFinite(hints) && hints >= 0 ? Math.min(9999, Math.floor(hints)) : 0 };
  }
  const st = o.settings as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') for (const k of ['sound', 'music', 'peek', 'motion'] as const) if (typeof st[k] === 'boolean') s.settings[k] = st[k] as boolean;
  s.seenIntro = o.seenIntro === true;
  if (Array.isArray(o.ended)) s.ended = [...new Set(o.ended.filter((z): z is number => z === 0 || z === 1 || z === 2))];
  return s;
}
/** stars for a page: one for finishing, one for par or better, one for the ink drop */
export function stars(def: PageDef, r: PageRecord | undefined): [boolean, boolean, boolean] {
  if (!r) return [false, false, false];
  return [true, r.best <= def.par, r.drop];
}
export const starCount = (s: Save, ids?: string[]) => PAGES.filter((p) => !ids || ids.includes(p.id)).reduce((n, p) => n + stars(p, s.pages[p.id]).filter(Boolean).length, 0);
export function record(s: Save, id: string, moves: number, drop: boolean, hints: number): { first: boolean; better: boolean } {
  const had = s.pages[id];
  const r: PageRecord = { best: Math.min(had?.best ?? Infinity, moves), drop: !!had?.drop || drop, hints: Math.min(had?.hints ?? Infinity, hints) };
  s.pages[id] = r;
  return { first: !had, better: !had || r.best < had.best || (r.drop && !had.drop) };
}
export const zinePages = (z: number) => PAGES.filter((p) => p.zine === z);
export const doneIn = (s: Save, z: number) => zinePages(z).filter((p) => s.pages[p.id]).length;
export const UNLOCK_AT = 7;
/** a zine opens when the one before has seven pages done (or with "peek ahead" on) */
export const zineOpen = (s: Save, z: number) => z === 0 || s.settings.peek || doneIn(s, z - 1) >= UNLOCK_AT;
/** inside an open zine, a page opens when it is at most two past the pages done so far (so one stuck page never blocks) */
export function pageOpen(s: Save, id: string): boolean {
  const def = PAGES.find((p) => p.id === id); if (!def) return false;
  if (!zineOpen(s, def.zine)) return false;
  if (s.settings.peek) return true;
  const i = zinePages(def.zine).indexOf(def);
  return i <= doneIn(s, def.zine) + 2 || !!s.pages[id];
}
/** the page after this one, or null at the end of a zine */
export function nextPage(id: string): string | null {
  const i = PAGES.findIndex((p) => p.id === id); const n = PAGES[i + 1];
  return n && n.zine === PAGES[i].zine ? n.id : null;
}
export const zineDone = (s: Save, z: number) => doneIn(s, z) === zinePages(z).length;
