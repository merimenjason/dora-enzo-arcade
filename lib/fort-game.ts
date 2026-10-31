// Pillow Fort's rules: the basket of pieces, aiming, turning and dropping, the fort's height and its den (the room
// under a roof where a chinchilla could sit), the hazards (draught, cat, thunder, sleepy Enzo), bedtime (the fort
// must stand for five seconds), stars, and the save. Deterministic: the night's seed drives every choice, the world
// steps at a fixed 1/60 s, and every input is logged with its step so a night replays exactly.
import { World, Body, box, DT, type Shape } from './fort-physics.js';
import { PIECES, NIGHTS, ROOMS, type Kind, type Night, type RoomId } from './fort-levels.js';

export { PIECES, NIGHTS, ROOMS, DT };
export type { Kind, Night, RoomId };

export const SAVE_KEY = 'pillow-fort-v1';
export const RUG = 4.2;
export const HEADROOM = 0.8;
export const CHECK_TICKS = 300;
const DROP_GAP = 24;
const WALL = 11;

/** A small seeded generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export type Piece = { n: number; kind: Kind; bodies: Body[]; rot: number; dropT: number; lost: boolean; goneT: number; landed: boolean };
export type Held = { kind: Kind; x: number; rot: number };
export type Input = { t: number; op: 'aim' | 'rot' | 'drop' | 'bed' | 'pick'; v?: number | string };
export type Ev =
  | { kind: 'drop'; piece: Kind; x: number; y: number }
  | { kind: 'thump'; piece: Kind; x: number; y: number; v: number; soft: number; n: number }
  | { kind: 'lost'; piece: Kind; x: number; n: number }
  | { kind: 'cat'; x: number; dir: number }
  | { kind: 'pounce'; x: number; y: number; dir: number }
  | { kind: 'thunder' }
  | { kind: 'yawn' }
  | { kind: 'flop'; x: number }
  | { kind: 'wake' }
  | { kind: 'check' }
  | { kind: 'done'; result: Result };
export type Result = { stars: number; height: number; den: number; used: number; goals: [boolean, boolean, boolean]; stood: boolean };
export type Den = { area: number; cols: { x: number; h: number }[] };
/** The cat's visit: where it sits and when it pounces (in steps). */
export type Cat = { x: number; dir: number; t0: number; pounceT: number; target: number | null };

export const nightById = (id: string) => NIGHTS.find((x) => x.id === id);

/** The shapes of a piece (fresh copies, so bodies never share them). */
export function pieceShapes(kind: Kind): Shape[] { return PIECES[kind].shapes!(); }
/** Half the width and height of a piece turned by `rot`, for aiming. */
const EXT = new Map<string, { w: number; h: number }>();
export function pieceExtent(kind: Kind, rot: number) {
  const key = kind + rot.toFixed(4), hit = EXT.get(key); if (hit) return hit;
  const e = extentOf(kind, rot); EXT.set(key, e); return e;
}
function extentOf(kind: Kind, rot: number) {
  const d = PIECES[kind];
  if (d.rope) return { w: (d.rope.links - 1) * d.rope.gap / 2 + d.rope.r, h: d.rope.r };
  const c = Math.cos(rot), s = Math.sin(rot); let w = 0, h = 0;
  for (const sh of pieceShapes(kind)) {
    if (sh.kind === 'circle') { const x = c * sh.c.x - s * sh.c.y, y = s * sh.c.x + c * sh.c.y; w = Math.max(w, Math.abs(x) + sh.r); h = Math.max(h, Math.abs(y) + sh.r); }
    else for (const v of sh.v) { w = Math.max(w, Math.abs(c * v.x - s * v.y)); h = Math.max(h, Math.abs(s * v.x + c * v.y)); }
  }
  return { w, h };
}

export class FortGame {
  night: Night | null;
  sandbox: boolean;
  world = new World();
  pieces: Piece[] = [];
  queue: Kind[];
  held: Held | null = null;
  used = 0; lostCount = 0;
  tick = 0; lastDrop = -999;
  phase: 'build' | 'check' | 'over' = 'build';
  checkT = 0;
  result: Result | null = null;
  events: Ev[] = [];
  log: Input[] = [];
  cat: Cat | null = null;
  thunderT = -1;
  enzo: { body: Body | null; yawnT: number; flopT: number; wakeT: number; x: number } | null = null;
  private rs: number;
  private catDrops = 0; private thunderDrops = 0;
  private hitT = new Map<number, number>();
  private aimX = 0;

  constructor(nightId: string | null) {
    this.night = nightId ? nightById(nightId) ?? null : null;
    this.sandbox = !this.night;
    this.rs = hash(nightId ?? 'sandbox');
    this.queue = this.night ? [...this.night.queue] : [];
    const w = this.world;
    w.add([box(60, 2)], { isStatic: true, friction: 0.9 }, 0, -1);
    w.add([box(2, 60)], { isStatic: true, friction: 0.4 }, -WALL - 1, 29);
    w.add([box(2, 60)], { isStatic: true, friction: 0.4 }, WALL + 1, 29);
    this.next(this.sandbox ? 'cushion' : undefined);
  }

  // ---- inputs (each one logged with its step, so a night replays)
  apply(i: Input) {
    if (i.op === 'aim') this.aim(i.v as number);
    else if (i.op === 'rot') this.rotate(i.v as number);
    else if (i.op === 'drop') this.drop();
    else if (i.op === 'bed') this.bedtime();
    else if (i.op === 'pick') this.pick(i.v as Kind);
  }
  private clampX(kind: Kind, rot: number, x: number) { const e = pieceExtent(kind, rot), lim = RUG - Math.min(e.w, RUG * 0.8) + 0.4; return Math.max(-lim, Math.min(lim, x)); }
  aim(x: number) {
    if (!this.held) return;
    const nx = this.clampX(this.held.kind, this.held.rot, x); if (nx === this.held.x) return;
    this.held.x = nx; this.aimX = nx; this.log.push({ t: this.tick, op: 'aim', v: nx });
  }
  rotate(dir = 1) {
    const h = this.held; if (!h || this.phase !== 'build') return;
    const st = PIECES[h.kind].step; if (!st) return;
    h.rot = ((h.rot + dir * st) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (Math.abs(h.rot - Math.PI * 2) < 1e-9) h.rot = 0;
    this.log.push({ t: this.tick, op: 'rot', v: dir });
    h.x = this.clampX(h.kind, h.rot, h.x);
  }
  /** Sandbox only: choose the next piece from the shelf. */
  pick(kind: Kind) {
    if (!this.sandbox || this.phase !== 'build') return;
    this.log.push({ t: this.tick, op: 'pick', v: kind });
    this.held = { kind, x: this.clampX(kind, 0, this.held?.x ?? this.aimX), rot: 0 };
  }
  canDrop() { return !!this.held && this.phase === 'build' && this.tick - this.lastDrop >= DROP_GAP; }
  drop() {
    const h = this.held; if (!h || !this.canDrop()) return false;
    this.log.push({ t: this.tick, op: 'drop' });
    const y = this.hoverY(h.kind, h.rot), d = PIECES[h.kind], n = this.pieces.length, bodies: Body[] = [];
    if (d.rope) {
      const r = d.rope, half = (r.links - 1) * r.gap / 2, group = 100 + n;
      for (let i = 0; i < r.links; i++) {
        const b = this.world.add([{ kind: 'circle', c: { x: 0, y: 0 }, r: r.r }], { density: r.mass / (Math.PI * r.r * r.r), friction: d.friction, restitution: 0, group, linDamp: 2.5, angDamp: 4 }, h.x - half + i * r.gap, y);
        // links don't spin, so a blanket grips what it lies on instead of rolling off like beads
        b.iI = 0; b.I = 0; b.vy = -1.2; bodies.push(b); if (i) this.world.link(bodies[i - 1], b, r.gap, 22, 0.8);
      }
    } else {
      const b = this.world.add(pieceShapes(h.kind), { density: d.density, friction: d.friction, restitution: d.restitution, angDamp: d.angDamp ?? 0.4, linDamp: 0.08 }, h.x, y, h.rot);
      // paws never let go perfectly straight: a little seeded wobble, so nothing balances on a knife edge
      b.vy = -1.5; b.w = (this.rand() - 0.5) * 0.12; bodies.push(b);
    }
    for (const b of bodies) b.tag = n;
    this.pieces.push({ n, kind: h.kind, bodies, rot: h.rot, dropT: this.tick, lost: false, goneT: -1, landed: false });
    this.used++; this.lastDrop = this.tick;
    this.events.push({ kind: 'drop', piece: h.kind, x: h.x, y });
    this.afterDrop();
    this.next(this.sandbox ? h.kind : undefined, h.rot);
    return true;
  }
  private next(kind?: Kind, rot = 0) {
    if (this.sandbox) { const k = kind ?? 'cushion', r = PIECES[k].step ? rot : 0; this.held = { kind: k, x: this.clampX(k, r, this.aimX), rot: r }; return; }
    const k = this.queue.shift();
    this.held = k ? { kind: k, x: this.clampX(k, 0, this.aimX), rot: 0 } : null;
  }
  /** Ends building: the fort has to stand for five seconds. */
  bedtime() {
    if (this.phase !== 'build' || this.sandbox) return false;
    this.log.push({ t: this.tick, op: 'bed' });
    this.phase = 'check'; this.checkT = 0; this.held = null;
    this.events.push({ kind: 'check' });
    const nt = this.night!;
    if (nt.thunder) this.thunderT = this.tick + 70;
    if (nt.cat && !this.cat) this.cat = this.makeCat(this.tick + 20, this.tick + 110);
    return true;
  }

  private afterDrop() {
    const nt = this.night; if (!nt) return;
    if (nt.cat) { this.catDrops++; if (this.catDrops % nt.cat === 0 && !this.cat) this.cat = this.makeCat(this.tick + 70, this.tick + 160); }
    if (nt.thunder) { this.thunderDrops++; if (this.thunderDrops % nt.thunder === 0 && this.thunderT < this.tick) this.thunderT = this.tick + 80; }
    if (nt.enzo && this.used === nt.enzo && !this.enzo) this.enzo = { body: null, yawnT: this.tick + 60, flopT: this.tick + 150, wakeT: this.tick + 150 + 260, x: 0 };
  }
  private rand() { this.rs = (this.rs + 0x6d2b79f5) >>> 0; let t = this.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private makeCat(t0: number, pounceT: number): Cat { const dir = this.rand() < 0.5 ? 1 : -1; return { x: -dir * (RUG + 1.6), dir, t0, pounceT, target: null }; }

  /** Where a held piece hangs: a clear gap above the whole fort. */
  hoverY(kind: Kind, rot: number) { return Math.max(2.4, this.top() + 1.25) + pieceExtent(kind, rot).h; }

  /** The fort's height: the top of every piece that has landed and is still on the rug. */
  top() {
    let t = 0;
    for (const p of this.pieces) { if (p.lost || !p.landed) continue; for (const b of p.bodies) if (b.maxY > t) t = b.maxY; }
    return t;
  }
  /** The den: every column over the rug where the first thing above the floor is at least HEADROOM up, in runs wide enough to sit in. */
  den(): Den {
    const dx = 0.1, cols: { x: number; h: number }[] = []; let area = 0, run: { x: number; h: number }[] = [];
    const skip = (b: Body) => b.tag < 0 || this.pieces[b.tag].lost || !this.pieces[b.tag].landed;
    const flush = () => { if (run.length * dx >= 0.6 - 1e-9) for (const c of run) { cols.push(c); area += c.h * dx; } run = []; };
    for (let x = -RUG + dx / 2; x < RUG; x += dx) {
      const h = this.world.rayUp(x, 0.02, 40, skip);
      if (h !== null && h >= HEADROOM) run.push({ x, h: Math.min(h, 2.5) }); else flush();
    }
    flush();
    return { area, cols };
  }

  /** The top surface of the fort straight down at x. */
  colTop(x: number) { return this.world.topAt(x, (b) => b.tag < 0 || this.pieces[b.tag].lost || !this.pieces[b.tag].landed); }

  /** The tallest, fastest-wobbling piece near the top, for the hold-your-breath slow-down. */
  wobble() {
    const t = this.top(); if (t < 1.5) return 0;
    let m = 0;
    for (const p of this.pieces) if (!p.lost && p.landed) for (const b of p.bodies) if (b.maxY > t - 1.2) m = Math.max(m, Math.abs(b.w) * 0.6 + Math.abs(b.vx));
    return m;
  }

  step() {
    const w = this.world, nt = this.night, t = this.tick;
    // the draught: a gusting push from the window on the left, stronger higher up
    if (nt?.wind) {
      const gust = 0.6 + 0.4 * Math.sin(t * 0.021) * Math.sin(t * 0.0083 + 1);
      for (const p of this.pieces) if (!p.lost) for (const b of p.bodies) {
        const hgt = b.maxY - b.minY, y = (b.maxY + b.minY) / 2;
        b.fx += nt.wind * 2.4 * hgt * gust * Math.max(0.2, Math.min(1, y / 4)) * (PIECES[p.kind].rope ? 0.35 : 1);
      }
    }
    // thunder: the floor shakes for a second
    w.shake = 0;
    if (this.thunderT >= 0 && t >= this.thunderT && t < this.thunderT + 60) {
      if (t === this.thunderT) this.events.push({ kind: 'thunder' });
      const k = (t - this.thunderT) / 60;
      w.shake = 9 * Math.sin(k * Math.PI) * Math.sin((t - this.thunderT) * 2 * Math.PI * 5 / 60);
    }
    // the cat creeps up, then pounces on the top piece
    const cat = this.cat;
    if (cat) {
      if (t === cat.t0) this.events.push({ kind: 'cat', x: cat.x, dir: cat.dir });
      if (t === cat.pounceT) {
        let best: Body | null = null;
        for (const p of this.pieces) if (!p.lost && p.landed) for (const b of p.bodies) if (!best || b.maxY > best.maxY) best = b;
        if (best) {
          const P = Math.min(best.m, 1.4) * 2.6, px = best.x - cat.dir * 0.3, py = best.maxY;
          const jx = cat.dir * P * 0.55, jy = -P;
          best.vx += best.im * jx; best.vy += best.im * jy; best.w += best.iI * ((px - best.x) * jy - (py - best.y) * jx);
          cat.target = best.tag;
          this.events.push({ kind: 'pounce', x: best.x, y: py, dir: cat.dir });
        }
      }
      if (t > cat.pounceT + 60) this.cat = null;
    }
    // sleepy Enzo yawns, flops onto the fort, naps, and gets up again
    const ez = this.enzo;
    if (ez) {
      if (t === ez.yawnT) this.events.push({ kind: 'yawn' });
      if (t === ez.flopT) {
        const c = this.centre(), side = this.rand() < 0.5 ? -1 : 1;
        ez.x = c + side * 0.6;
        ez.body = w.add([box(1.5, 0.78, 0.3)], { density: 0.9, friction: 0.9, restitution: 0.02, angDamp: 1 }, ez.x, Math.max(this.top(), 1) + 1.2, 0);
        ez.body.vx = -side * 0.8; ez.body.vy = -2; ez.body.tag = -2;
        this.events.push({ kind: 'flop', x: ez.x });
      }
      if (t === ez.wakeT && ez.body) { w.remove(ez.body); ez.body = null; this.events.push({ kind: 'wake' }); this.enzo = { ...ez, yawnT: -1, flopT: -1 }; }
    }

    w.step();
    this.tick++;

    // landing, thumps, and pieces rolling off the rug
    for (const p of this.pieces) {
      if (p.lost) continue;
      if (!p.landed) {
        let touch = false;
        for (const c of w.contacts) if ((c.A.tag === p.n) !== (c.B.tag === p.n) && c.pts.some((q) => q.sep < 0.03)) { touch = true; break; }
        if (touch || this.tick - p.dropT > 150) p.landed = true;
      }
      for (const b of p.bodies) if (b.hit > 1.6 && (this.hitT.get(b.id) ?? -99) < this.tick - 12) {
        this.hitT.set(b.id, this.tick);
        this.events.push({ kind: 'thump', piece: p.kind, x: b.x, y: b.minY, v: b.hit, soft: PIECES[p.kind].soft, n: p.n });
        if (PIECES[p.kind].rope) break;
      }
      const off = p.bodies.every((b) => (b.maxX < -RUG || b.minX > RUG) && b.minY < 0.3);
      if (off) { p.lost = true; p.goneT = this.tick; this.lostCount++; this.events.push({ kind: 'lost', piece: p.kind, x: p.bodies[0].x, n: p.n }); }
    }
    for (const p of this.pieces) if (p.lost && p.goneT >= 0 && this.tick - p.goneT === 40) for (const b of p.bodies) w.remove(b);

    if (this.phase === 'check') {
      this.checkT++;
      if (this.checkT >= CHECK_TICKS) this.finish();
    } else if (this.phase === 'build' && !this.sandbox && !this.held && this.tick - this.lastDrop > 150 && w.motion() < 0.05) this.bedtime();
  }

  private centre() {
    let s = 0, m = 0;
    for (const p of this.pieces) if (!p.lost && p.landed) for (const b of p.bodies) { s += b.x * b.m; m += b.m; }
    return m ? s / m : 0;
  }

  private finish() {
    const nt = this.night!, height = this.top(), den = this.den().area;
    const g1 = height >= nt.line;
    const g2 = g1 && (nt.den !== undefined ? den >= nt.den : height >= (nt.high ?? Infinity));
    const g3 = g1 && this.used <= nt.par;
    const result: Result = { stars: g1 ? 1 + (g2 ? 1 : 0) + (g3 ? 1 : 0) : 0, height, den, used: this.used, goals: [g1, g2, g3], stood: g1 };
    this.result = result; this.phase = 'over';
    this.events.push({ kind: 'done', result });
  }

  /** Runs a list of logged inputs from a fresh start, stepping between them; returns the game. */
  static replay(nightId: string | null, inputs: Input[], until: number) {
    const g = new FortGame(nightId); let i = 0;
    while (g.tick < until) {
      while (i < inputs.length && inputs[i].t === g.tick) g.apply(inputs[i++]);
      g.step();
    }
    return g;
  }

  /** A copy that plays on exactly like this one, for the bots to try moves ahead. */
  clone(): FortGame {
    const g = Object.create(FortGame.prototype) as FortGame;
    Object.assign(g, this);
    g.world = this.world.clone();
    const byId = new Map(g.world.bodies.map((b) => [b.id, b]));
    g.pieces = this.pieces.map((p) => ({ ...p, bodies: p.bodies.map((b) => byId.get(b.id) ?? b) }));
    g.queue = [...this.queue]; g.held = this.held ? { ...this.held } : null; g.events = []; g.log = [...this.log];
    g.cat = this.cat ? { ...this.cat } : null;
    g.enzo = this.enzo ? { ...this.enzo, body: this.enzo.body ? byId.get(this.enzo.body.id) ?? null : null } : null;
    g.hitT = new Map(this.hitT);
    return g;
  }

  /** A fingerprint of the whole world, for replay checks. */
  state() { return this.world.bodies.map((b) => `${b.x.toFixed(9)},${b.y.toFixed(9)},${b.a.toFixed(9)}`).join(';'); }
}

// ---- stars, unlocking and the save

export type Best = { stars: number; used: number; height: number; den: number };
export type Save = { v: 1; best: Record<string, Best>; tips: string[]; ended: boolean; settings: { sound: boolean; music: boolean } };
export const freshSave = (): Save => ({ v: 1, best: {}, tips: [], ended: false, settings: { sound: true, music: true } });

export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  let o: unknown; try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object') return s;
  const r = o as Record<string, unknown>;
  if (r.best && typeof r.best === 'object') for (const [id, b] of Object.entries(r.best as Record<string, unknown>)) {
    if (!nightById(id) || !b || typeof b !== 'object') continue;
    const x = b as Record<string, unknown>, st = x.stars, u = x.used, h = x.height, d = x.den;
    if (typeof st !== 'number' || !Number.isInteger(st) || st < 1 || st > 3) continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    s.best[id] = { stars: st, used: Math.floor(num(u)), height: num(h), den: num(d) };
  }
  if (Array.isArray(r.tips)) s.tips = r.tips.filter((t): t is string => typeof t === 'string').slice(0, 100);
  s.ended = r.ended === true;
  if (r.settings && typeof r.settings === 'object') {
    const st = r.settings as Record<string, unknown>;
    if (typeof st.sound === 'boolean') s.settings.sound = st.sound;
    if (typeof st.music === 'boolean') s.settings.music = st.music;
  }
  return s;
}
/** Records a finished night; returns whether it improved the best and whether it was the first pass. */
export function record(s: Save, id: string, r: Result) {
  if (r.stars < 1) return { better: false, first: false };
  const old = s.best[id], first = !old;
  const better = !old || r.stars > old.stars || (r.stars === old.stars && r.used < old.used);
  if (better) s.best[id] = { stars: r.stars, used: r.used, height: +r.height.toFixed(2), den: +r.den.toFixed(2) };
  return { better, first };
}
export const nightOpen = (s: Save, id: string) => { const i = NIGHTS.findIndex((x) => x.id === id); return i === 0 || (i > 0 && !!s.best[NIGHTS[i - 1].id]); };
export const roomNights = (room: RoomId) => NIGHTS.filter((x) => x.room === room);
export const roomOpen = (s: Save, room: RoomId) => nightOpen(s, roomNights(room)[0].id);
export const starCount = (s: Save) => Object.values(s.best).reduce((a, b) => a + b.stars, 0);
export const nextNight = (s: Save) => NIGHTS.find((x) => !s.best[x.id] && nightOpen(s, x.id))?.id ?? null;
export const nightNo = (id: string) => NIGHTS.findIndex((x) => x.id === id) + 1;
