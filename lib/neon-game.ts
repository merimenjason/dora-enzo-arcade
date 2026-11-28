// Neon Lane: the rules. A maze chase on a neon signboard: Dora and Enzo run the glass tubes eating sparks while four
// cicaks hunt them. The hook: light is how a cicak sees. Clear every spark on a circuit and it goes dark, and a
// chinchilla on a dark tube cannot be seen. Blow a fuse and the cicaks panic; catch one and it drops its tail.
// Deterministic: a seed replays a game exactly. No DOM; the scene and the page read the state and the events.
import { NIGHTS, W, N, DX, DY, TUBE, FUSE, buildBoard, cx, cy, step, type Board } from './neon-levels.js';

export { NIGHTS, W, H, N } from './neon-levels.js';
export const DT = 1 / 60;
export const SAVE_KEY = 'neon-lane-v1';

export type HeroId = 'dora' | 'enzo';
export type CicakKind = 'chik' | 'chak' | 'tokek' | 'lulu';
/** a direction: 0 none, 1 up, 2 right, 3 down, 4 left */
export type Dir = 0 | 1 | 2 | 3 | 4;
export const OPP: Dir[] = [0, 3, 4, 1, 2];
export const CICAKS: { kind: CicakKind; name: string; colour: string; habit: string }[] = [
  { kind: 'chik', name: 'Chik', colour: '#5dff4a', habit: 'hunts the nearest chinchilla it can see' },
  { kind: 'chak', name: 'Chak', colour: '#ff3dd8', habit: 'cuts you off three tubes ahead' },
  { kind: 'tokek', name: 'Tokek', colour: '#3d8bff', habit: 'guards the brightest circuit' },
  { kind: 'lulu', name: 'Lulu', colour: '#ff5a2a', habit: 'drifts fast along the lit tubes' },
];

// ─────────────────────────────── numbers (docs/neon-lane.md)
export const HERO_SPEED = 6.5;
export const CICAK_SPEED = 5.4, CICAK_PER_NIGHT = 0.2, ASSIST_SPEED = 0.8;
/** how many cicaks come out of the drainpipe each night: Chik and Lulu first, then Chak, then Tokek */
export const CICAKS_OUT = [2, 3, 3, 4, 4, 4];
const JOIN_ORDER: CicakKind[] = ['chik', 'lulu', 'chak', 'tokek'];
const GENTLE_LATE: CicakKind[] = ['chik', 'tokek', 'chak'];
export const DARK_SLOW = 0.6, SCARED_SLOW = 0.55, STUB_FAST = 1.6, LULU_FAST = 1.08;
export const THINK = 0.35, ASSIST_RANDOM = 0.15;
export const RELEASE_GAP = 4, ASSIST_RELEASE = 1.4;
export const FUSE_TIME = 7, FUSE_MIN = 4, FUSE_PER_NIGHT = 0.6, ASSIST_FUSE = 2;
export const CATCH_PTS = [250, 500, 750, 1000];
export const PTS = { spark: 10, fuse: 50, tail: 100, moth: 300, night: 1000 };
export const LIVES = 3, ASSIST_LIVES = 5, LIFE_EVERY = 8000;
/** a fresh tail wriggles too hard to grab for this long, so running straight through misses it: double back for it */
export const TAIL_GRAB = 0.6;
export const TAIL_LIFE = 5, MOTH_LIFE = 10, MOTH_AT = [0.3, 0.7], MOTH_PULL = 7, GULP_TIME = 1.5;
/** how many tubes away each cicak notices a chinchilla on a lit tube, and how far any of them sees straight down a tube */
export const SIGHT: Record<CicakKind, number> = { chik: 6, chak: 4, tokek: 5, lulu: 5 };
export const LOOK = 9, CHAK_AHEAD = 3;
export const ZAP_TIME = 1.6, RESPAWN_TIME = 2, SAFE_TIME = 2, READY_TIME = 1.8, CLEAR_TIME = 2.6, REGROW = 2;
export const TOUCH = 0.55;
/** how far past a junction (in tubes) a late turn is still taken */
export const LATE_TURN = 0.3;

export class Rng {
  s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n: number) { return Math.floor(this.next() * n); }
  pick<T>(a: T[]): T { return a[this.int(a.length)]; }
}

// ─────────────────────────────── state
/** something that runs the tubes: at cell `cell`, `t` of the way to the next cell in direction `dir` */
export interface Mover { cell: number; dir: Dir; t: number; face: Dir }
export interface Hero extends Mover {
  id: HeroId; idx: number; wish: Dir;
  /** 'run' on the tubes, 'zap' being electrocuted, 'gone' waiting to come back (two-player) */
  state: 'run' | 'zap' | 'gone';
  timer: number; safe: number; eatT: number; cheerT: number;
}
export interface Cicak extends Mover {
  id: number; kind: CicakKind;
  /** 'away' means not out on this night */
  mode: 'away' | 'home' | 'out' | 'scared' | 'stub' | 'gulp';
  timer: number; think: number; target: number; lastSeen: number; sees: boolean;
  /** tail regrown? (false while it runs home as a stub and regrows) */
  tail: boolean; chirpT: number;
}
export interface Tail { cell: number; t: number; x: number; y: number }
export interface Moth { cell: number; t: number }
export type Ev =
  | { k: 'spark'; hero: number; cell: number }
  | { k: 'fuse'; hero: number; cell: number }
  | { k: 'dark'; circuit: number }
  | { k: 'low'; circuit: number }
  | { k: 'catch'; hero: number; cicak: number; pts: number; x: number; y: number }
  | { k: 'tail'; hero: number; x: number; y: number }
  | { k: 'moth' } | { k: 'mothEaten'; hero: number; pts: number } | { k: 'gulp'; cicak: number } | { k: 'mothGone' }
  | { k: 'zap'; hero: number } | { k: 'respawn'; hero: number } | { k: 'life' }
  | { k: 'chirp'; cicak: number } | { k: 'release'; cicak: number } | { k: 'calm' }
  | { k: 'ready' } | { k: 'go' } | { k: 'clear'; night: number } | { k: 'win' } | { k: 'lose' };

export interface Stats { score: number; nights: number; reached: number; sparks: number; catches: number; tails: number; moths: number; livesLost: number; time: number; won: boolean }
export interface Opts { seed: number; night?: number; assist?: boolean; twoP?: boolean; lead?: HeroId }

export class NeonGame {
  rng: Rng; assist: boolean; twoP: boolean;
  night = 0; board!: Board;
  heroes: Hero[] = []; cicaks: Cicak[] = [];
  spark = new Uint8Array(N);
  /** sparks left on each circuit */
  left: number[] = [];
  sparksLeft = 0; sparksTotal = 0;
  fuseLeft = new Uint8Array(N);
  tails: Tail[] = []; moth: Moth | null = null; mothsDone = 0;
  fuseT = 0; chain = 0;
  lives: number; score = 0; nextLife = LIFE_EVERY;
  /** 'ready' frozen before the run, 'play', 'dying' (one-player zap), 'clear' (lights out), 'cleared' waiting for the page, 'over' */
  phase: 'ready' | 'play' | 'dying' | 'clear' | 'cleared' | 'over' = 'ready';
  phaseT = READY_TIME; over: 'win' | 'lose' | null = null;
  t = 0; nightT = 0; events: Ev[] = [];
  st = { sparks: 0, catches: 0, tails: 0, moths: 0, livesLost: 0, nights: 0 };
  startNight: number;

  constructor(o: Opts) {
    this.rng = new Rng(o.seed); this.assist = o.assist !== false; this.twoP = !!o.twoP;
    this.lives = this.assist ? ASSIST_LIVES : LIVES;
    const lead = o.lead ?? 'dora';
    const ids: HeroId[] = this.twoP ? [lead, lead === 'dora' ? 'enzo' : 'dora'] : [lead];
    this.heroes = ids.map((id, idx) => ({ id, idx, cell: 0, dir: 0, t: 0, face: 2, wish: 0, state: 'run', timer: 0, safe: 0, eatT: 0, cheerT: 0 }));
    this.cicaks = CICAKS.map((c, id) => ({ id, kind: c.kind, cell: 0, dir: 0, t: 0, face: 2, mode: 'home', timer: 0, think: 0, target: -1, lastSeen: -1, sees: false, tail: true, chirpT: 0 }));
    this.startNight = Math.max(0, Math.min(NIGHTS.length - 1, o.night ?? 0));
    this.load(this.startNight);
  }

  // ─────────────────────────────── nights
  load(n: number) {
    this.night = n; this.board = buildBoard(NIGHTS[n]);
    const b = this.board;
    this.spark.fill(0); this.fuseLeft.fill(0);
    for (const c of b.tubes) if (b.kind[c] === TUBE && c !== b.starts[0] && c !== b.starts[1]) this.spark[c] = 1;
    for (const f of b.fuses) this.fuseLeft[f] = 1;
    this.left = b.circuits.map((k) => k.cells.reduce((s, c) => s + this.spark[c], 0));
    this.sparksTotal = this.sparksLeft = this.left.reduce((a, b2) => a + b2, 0);
    this.tails = []; this.moth = null; this.mothsDone = 0; this.fuseT = 0; this.chain = 0; this.nightT = 0;
    this.resetActors();
    this.phase = 'ready'; this.phaseT = READY_TIME; this.events.push({ k: 'ready' });
  }
  /** the next night, called by the page after the lights-out card */
  advance() {
    if (this.phase !== 'cleared') return;
    if (this.night + 1 >= NIGHTS.length) { this.finish('win'); return; }
    this.load(this.night + 1);
  }
  resetActors() {
    const b = this.board;
    this.heroes.forEach((h, i) => { Object.assign(h, { cell: b.starts[this.twoP ? i : 0], dir: 0, t: 0, face: i ? 4 : 2, wish: 0, state: 'run', timer: 0, safe: 0, eatT: 0 }); });
    if (!this.twoP) this.heroes[0].cell = b.starts[0];
    const gap = RELEASE_GAP * (this.assist ? ASSIST_RELEASE : 1);
    this.cicaks.forEach((c) => {
      // gentle cicaks: never more than three out, and from night 4 Tokek the guard takes Lulu's place
      const join = this.assist && this.night >= 3 ? GENTLE_LATE : JOIN_ORDER;
      const order = join.indexOf(c.kind), out = order >= 0 && order < Math.min(CICAKS_OUT[this.night], this.assist ? 3 : 4);
      Object.assign(c, { cell: b.den, dir: 0, t: 0, face: 2, mode: out ? 'home' : 'away', timer: 0.6 + Math.max(0, order) * gap, think: 0, target: -1, lastSeen: -1, sees: false, tail: true, chirpT: 0 });
    });
    this.fuseT = 0; this.chain = 0;
  }

  // ─────────────────────────────── queries
  lit(c: number) { const k = this.board.circuit[c]; return k >= 0 && this.left[k] > 0; }
  open(c: number, d: Dir) { if (!d) return false; const n = step(c, d); if (n < 0) return false; const k = this.board.kind[n]; return k === TUBE || k === FUSE; }
  d(a: number, b: number) { return this.board.dist[a * N + b]; }
  /** where a mover is, in cells (fractional) */
  pos(m: Mover) { return { x: cx(m.cell) + DX[m.dir] * m.t, y: cy(m.cell) + DY[m.dir] * m.t }; }
  /** the cell a mover is nearest to */
  near(m: Mover) { return m.t > 0.5 ? step(m.cell, m.dir) : m.cell; }
  heroVisible(h: Hero) { return h.state === 'run' && this.lit(this.near(h)); }
  cicakSpeed(c: Cicak) {
    let v = (CICAK_SPEED + CICAK_PER_NIGHT * this.night) * (this.assist ? ASSIST_SPEED : 1);
    if (c.mode === 'stub') return v * STUB_FAST;
    if (c.mode === 'scared') return v * SCARED_SLOW;
    if (c.kind === 'lulu') v *= LULU_FAST;
    if (!this.lit(this.near(c))) v *= DARK_SLOW;
    return v;
  }
  fuseTime() { return Math.max(FUSE_MIN, FUSE_TIME - FUSE_PER_NIGHT * this.night) + (this.assist ? ASSIST_FUSE : 0); }

  // ─────────────────────────────── the step
  /** one fixed step; p1 and p2 are the held directions (0 for none) */
  step(p1: Dir, p2: Dir = 0) {
    this.events = [];
    if (this.over) return;
    this.t += DT;
    if (this.phase === 'ready') { this.phaseT -= DT; if (this.phaseT <= 0) { this.phase = 'play'; this.events.push({ k: 'go' }); } this.input(p1, p2); return; }
    if (this.phase === 'clear') { this.phaseT -= DT; for (const h of this.heroes) h.cheerT = 1; if (this.phaseT <= 0) { this.phase = 'cleared'; } return; }
    if (this.phase === 'cleared') return;
    if (this.phase === 'dying') {
      this.phaseT -= DT;
      if (this.phaseT <= 0) {
        if (this.lives <= 0) { this.finish('lose'); return; }
        this.resetActors(); this.phase = 'ready'; this.phaseT = READY_TIME; this.events.push({ k: 'ready' });
      }
      return;
    }
    this.nightT += DT;
    this.input(p1, p2);
    for (const h of this.heroes) this.heroStep(h);
    if (this.fuseT > 0) {
      this.fuseT -= DT;
      if (this.fuseT <= 0) { this.fuseT = 0; this.chain = 0; for (const c of this.cicaks) if (c.mode === 'scared') c.mode = 'out'; this.events.push({ k: 'calm' }); }
    }
    for (const c of this.cicaks) this.cicakStep(c);
    this.touches();
    for (const tl of this.tails) tl.t -= DT;
    this.tails = this.tails.filter((tl) => tl.t > 0);
    if (this.moth) { this.moth.t -= DT; if (this.moth.t <= 0) { this.moth = null; this.events.push({ k: 'mothGone' }); } }
    if (this.mothsDone < MOTH_AT.length && 1 - this.sparksLeft / this.sparksTotal >= MOTH_AT[this.mothsDone]) { this.mothsDone++; this.spawnMoth(); }
    if (this.sparksLeft <= 0 && this.phase === 'play') {
      this.add(PTS.night * (this.night + 1)); this.st.nights++;
      this.phase = 'clear'; this.phaseT = CLEAR_TIME; this.moth = null; this.tails = []; this.events.push({ k: 'clear', night: this.night });
      if (this.night + 1 >= NIGHTS.length) this.events.push({ k: 'win' });
    }
  }
  /** one-player: Dora and Enzo trade places (the one running hands over to the other) */
  swap() { if (this.twoP) return; const h = this.heroes[0]; h.id = h.id === 'dora' ? 'enzo' : 'dora'; }
  input(p1: Dir, p2: Dir) {
    const h0 = this.heroes[0], h1 = this.heroes[1];
    if (p1) h0.wish = p1;
    if (h1 && p2) h1.wish = p2;
  }
  add(p: number) {
    this.score += p;
    while (this.score >= this.nextLife) { this.nextLife += LIFE_EVERY; this.lives++; this.events.push({ k: 'life' }); }
  }
  finish(r: 'win' | 'lose') { this.over = r; this.phase = 'over'; this.events.push({ k: r }); }

  // ─────────────────────────────── chinchillas
  heroStep(h: Hero) {
    if (h.eatT > 0) h.eatT -= DT;
    if (h.cheerT > 0) h.cheerT -= DT;
    if (h.safe > 0) h.safe -= DT;
    if (h.state === 'zap') { h.timer -= DT; if (h.timer <= 0) { h.state = 'gone'; h.timer = RESPAWN_TIME; } return; }
    if (h.state === 'gone') {
      h.timer -= DT;
      if (h.timer <= 0) { Object.assign(h, { state: 'run', cell: this.board.starts[h.idx], dir: 0, t: 0, wish: 0, safe: SAFE_TIME }); this.events.push({ k: 'respawn', hero: h.idx }); }
      return;
    }
    // reversing is instant, wherever you are along the tube
    if (h.dir && h.wish === OPP[h.dir] && h.t > 0) { h.cell = step(h.cell, h.dir); h.dir = h.wish; h.t = 1 - h.t; h.face = h.dir; }
    // a turn pressed a moment late still counts: just past a junction, snap back onto it and take the turn
    if (h.dir && h.t > 0 && h.t < LATE_TURN && h.wish && h.wish !== h.dir && h.wish !== OPP[h.dir] && this.open(h.cell, h.wish)) { h.t = 0; }
    let dist = HERO_SPEED * DT;
    while (dist > 1e-9) {
      if (h.t === 0) {
        // at a cell's centre: take the wished turn if the tube allows, else carry on, else stop
        if (h.wish && this.open(h.cell, h.wish)) h.dir = h.wish;
        else if (!this.open(h.cell, h.dir)) { h.dir = 0; break; }
        h.face = h.dir;
      }
      const room = 1 - h.t;
      if (dist < room) { h.t += dist; dist = 0; }
      else { dist -= room; h.cell = step(h.cell, h.dir); h.t = 0; this.arrive(h); }
    }
  }
  arrive(h: Hero) {
    const c = h.cell;
    if (this.spark[c]) {
      this.spark[c] = 0; this.sparksLeft--; this.st.sparks++; this.add(PTS.spark); h.eatT = 0.22;
      const k = this.board.circuit[c];
      this.left[k]--;
      this.events.push({ k: 'spark', hero: h.idx, cell: c });
      if (this.left[k] === 0) this.events.push({ k: 'dark', circuit: k });
      else if (this.left[k] === 3) this.events.push({ k: 'low', circuit: k });
    }
    if (this.fuseLeft[c]) {
      this.fuseLeft[c] = 0; this.add(PTS.fuse); this.events.push({ k: 'fuse', hero: h.idx, cell: c });
      this.fuseT = this.fuseTime(); this.chain = 0;
      for (const k of this.cicaks) if (k.mode === 'out' || k.mode === 'gulp') {
        k.mode = 'scared';
        if (k.dir && k.t > 0) { k.cell = step(k.cell, k.dir); k.dir = OPP[k.dir]; k.t = 1 - k.t; }
      }
    }
    if (this.moth && this.moth.cell === c) this.eatMoth(h);
    for (const tl of this.tails) if (tl.cell === c && tl.t > 0 && tl.t <= TAIL_LIFE - TAIL_GRAB) { tl.t = 0; this.add(PTS.tail); this.st.tails++; this.events.push({ k: 'tail', hero: h.idx, x: tl.x, y: tl.y }); }
  }
  eatMoth(h: Hero) {
    const p = PTS.moth * (this.night + 1);
    this.add(p); this.st.moths++; this.moth = null; this.events.push({ k: 'mothEaten', hero: h.idx, pts: p });
  }
  spawnMoth() {
    const b = this.board, live = this.heroes.filter((h) => h.state === 'run');
    let best: number[] = [], bestD = -1;
    for (const c of b.tubes) {
      if (!this.lit(c) || b.kind[c] !== TUBE) continue;
      const dmin = Math.min(...live.map((h) => this.d(c, this.near(h))), 99);
      const score = Math.min(dmin, 10);
      if (score > bestD) { bestD = score; best = [c]; } else if (score === bestD) best.push(c);
    }
    if (!best.length) return;
    this.moth = { cell: this.rng.pick(best), t: MOTH_LIFE };
    this.events.push({ k: 'moth' });
  }

  // ─────────────────────────────── cicaks
  cicakStep(c: Cicak) {
    if (c.mode === 'away') return;
    if (c.chirpT > 0) c.chirpT -= DT;
    const b = this.board;
    if (c.mode === 'home') {
      c.timer -= DT;
      if (c.timer <= 0) {
        c.mode = 'out'; c.tail = true;
        c.cell = b.door; c.t = 0; c.dir = 0; c.think = 0; c.lastSeen = -1; c.target = -1;
        this.events.push({ k: 'release', cicak: c.id });
      }
      return;
    }
    if (c.mode === 'gulp') { c.timer -= DT; if (c.timer <= 0) c.mode = this.fuseT > 0 ? 'scared' : 'out'; return; }
    c.think -= DT;
    if (c.think <= 0 && c.mode === 'out') { c.think = THINK; this.retarget(c); }
    let dist = this.cicakSpeed(c) * DT;
    while (dist > 1e-9) {
      if (c.t === 0) {
        if (c.mode === 'stub' && c.cell === b.door) {
          // home: back into the drainpipe to grow a new tail
          c.mode = 'home'; c.cell = b.den; c.timer = REGROW; c.dir = 0; return;
        }
        if (c.mode === 'out' && this.moth && c.cell === this.moth.cell) {
          this.moth = null; c.mode = 'gulp'; c.timer = GULP_TIME; this.events.push({ k: 'gulp', cicak: c.id }); return;
        }
        if (c.mode === 'out' && c.lastSeen === c.cell) c.lastSeen = -1;
        c.dir = this.choose(c); c.face = c.dir || c.face;
        if (!c.dir) break;
      }
      const room = 1 - c.t;
      if (dist < room) { c.t += dist; dist = 0; }
      else { dist -= room; c.cell = step(c.cell, c.dir); c.t = 0; }
    }
  }
  /** where an out-and-about cicak wants to go, rethought every THINK seconds, never every frame */
  retarget(c: Cicak) {
    const here = this.near(c);
    let prey: Hero | null = null, pd = 1e9;
    for (const h of this.heroes) { if (!this.spots(c, h)) continue; const dd = this.d(here, this.near(h)); if (dd >= 0 && dd < pd) { pd = dd; prey = h; } }
    if (this.moth && this.d(here, this.moth.cell) >= 0 && this.d(here, this.moth.cell) <= MOTH_PULL) { c.target = this.moth.cell; this.see(c, false); return; }
    if (prey) {
      let tgt = this.near(prey);
      if (c.kind === 'chak' && prey.dir) {
        for (let i = 0; i < CHAK_AHEAD && this.open(tgt, prey.dir); i++) tgt = step(tgt, prey.dir);
        if (pd <= 2) tgt = this.near(prey);
      }
      c.target = tgt; c.lastSeen = this.near(prey); this.see(c, true); return;
    }
    this.see(c, false);
    if (c.lastSeen >= 0) { c.target = c.lastSeen; return; }
    if (c.kind === 'tokek') {
      // guard the lit circuit with the most sparks left
      let bk = -1;
      this.left.forEach((n, k) => { if (n > 0 && (bk < 0 || n > this.left[bk])) bk = k; });
      if (bk >= 0) {
        const cells = this.board.circuits[bk].cells;
        if (c.target < 0 || this.board.circuit[c.target] !== bk || c.target === here) c.target = cells[this.rng.int(cells.length)];
        return;
      }
    }
    c.target = -1;
  }
  /**
   * can this cicak see that chinchilla? Only on a lit tube, and only close by (`SIGHT` tubes away along the sign) or
   * straight down a tube with no bend in between (up to `LOOK` cells)
   */
  spots(c: Cicak, h: Hero) {
    if (!this.heroVisible(h)) return false;
    const a = this.near(c), b = this.near(h), dd = this.d(a, b);
    if (dd < 0) return false;
    if (dd <= SIGHT[c.kind]) return true;
    if (dd > LOOK) return false;
    const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
    if (ax !== bx && ay !== by) return false;
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    for (let x = ax, y = ay; x !== bx || y !== by; x += sx, y += sy) if (!this.isTube(y * W + x)) return false;
    return true;
  }
  isTube(c: number) { const k = this.board.kind[c]; return k === TUBE || k === FUSE; }
  see(c: Cicak, now: boolean) {
    if (now && !c.sees) { c.chirpT = 0.6; this.events.push({ k: 'chirp', cicak: c.id }); }
    c.sees = now;
  }
  /** pick an exit at a cell centre: no turning back unless it is a dead stop */
  choose(c: Cicak): Dir {
    const exits: Dir[] = [];
    for (let d = 1 as Dir; d <= 4; d = (d + 1) as Dir) if (this.open(c.cell, d)) exits.push(d);
    if (!exits.length) return 0;
    const fwd = exits.filter((d) => d !== OPP[c.dir]);
    const opts = fwd.length ? fwd : exits;
    if (opts.length === 1) return opts[0];
    if (c.mode === 'scared') {
      // away from the nearest chinchilla
      const live = this.heroes.filter((h) => h.state === 'run');
      let best: Dir[] = [], bd = -1;
      for (const d of opts) {
        const n = step(c.cell, d), dd = Math.min(...live.map((h) => this.d(n, this.near(h))), 99);
        if (dd > bd) { bd = dd; best = [d]; } else if (dd === bd) best.push(d);
      }
      return this.rng.pick(best);
    }
    const tgt = c.mode === 'stub' ? this.board.door : c.target;
    if (c.mode === 'out' && this.assist && this.rng.next() < ASSIST_RANDOM) return this.rng.pick(opts);
    if (tgt < 0) {
      // wander, up to three times as keen on lit tubes (that is where the moths are); as the sign goes dark the moths
      // drift off and the keenness fades, so the cicaks don't all pile onto the last lit tubes
      const share = this.sparksLeft / this.sparksTotal;
      const keen = 1 + 2 * Math.max(0, Math.min(1, (share - 0.15) / 0.35));
      const w = opts.map((d) => (this.lit(step(c.cell, d)) ? keen : 1));
      let r = this.rng.next() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; }
      return opts[opts.length - 1];
    }
    let best: Dir[] = [], bd = 1e9;
    for (const d of opts) {
      const dd = this.d(step(c.cell, d), tgt);
      if (dd < 0) continue;
      if (dd < bd) { bd = dd; best = [d]; } else if (dd === bd) best.push(d);
    }
    return best.length ? this.rng.pick(best) : this.rng.pick(opts);
  }

  // ─────────────────────────────── touching
  touches() {
    for (const h of this.heroes) {
      if (h.state !== 'run') continue;
      const hp = this.pos(h);
      if (this.moth) { const m = this.moth; if (Math.abs(cx(m.cell) - hp.x) + Math.abs(cy(m.cell) - hp.y) < TOUCH) this.eatMoth(h); }
      for (const c of this.cicaks) {
        if (c.mode === 'away' || c.mode === 'home' || c.mode === 'stub') continue;
        const cp = this.pos(c);
        if (Math.abs(cp.x - hp.x) + Math.abs(cp.y - hp.y) >= TOUCH) continue;
        if (c.mode === 'scared') {
          const pts = CATCH_PTS[Math.min(this.chain, CATCH_PTS.length - 1)]; this.chain++;
          this.add(pts); this.st.catches++;
          this.tails.push({ cell: this.near(c), t: TAIL_LIFE, x: cp.x, y: cp.y });
          c.mode = 'stub'; c.tail = false; c.lastSeen = -1;
          // turn for home at once
          if (c.t > 0) { const nx = step(c.cell, c.dir); if (this.d(c.cell, this.board.door) < this.d(nx, this.board.door)) { c.cell = nx; c.dir = OPP[c.dir]; c.t = 1 - c.t; } }
          this.events.push({ k: 'catch', hero: h.idx, cicak: c.id, pts, x: cp.x, y: cp.y });
        } else if (h.safe <= 0) {
          this.zap(h);
          break;
        }
      }
    }
  }
  zap(h: Hero) {
    this.lives--; this.st.livesLost++;
    this.events.push({ k: 'zap', hero: h.idx });
    const others = this.heroes.filter((o) => o !== h && o.state === 'run');
    if (this.twoP && others.length && this.lives > 0) { h.state = 'zap'; h.timer = ZAP_TIME; h.dir = 0; return; }
    // one-player (or the last one standing): the whole board stops for the zap
    h.state = 'zap'; h.timer = ZAP_TIME;
    for (const o of others) { o.state = 'zap'; o.timer = ZAP_TIME; }
    this.phase = 'dying'; this.phaseT = ZAP_TIME + 0.4;
  }

  stats(): Stats {
    return { score: this.score, nights: this.st.nights, reached: Math.min(NIGHTS.length - 1, this.night + (this.phase === 'cleared' || this.phase === 'clear' ? 1 : 0)), sparks: this.st.sparks, catches: this.st.catches, tails: this.st.tails, moths: this.st.moths, livesLost: this.st.livesLost, time: this.t, won: this.over === 'win' };
  }
}

// ─────────────────────────────── bots
/**
 * A bot that plays like a person: it replans every `react` seconds (not every frame), sometimes hesitates, and, unless
 * it is `naive`, steers round cicaks, slips onto dark tubes when chased and goes for fuses and panicked cicaks.
 * The naive bot is a first-timer: it heads for the nearest spark and only dodges a cicak right in front of it.
 */
export class Bot {
  g: NeonGame; idx: number; naive: boolean; react: number; hesitate: number;
  timer = 0; dir: Dir = 0; rng: Rng; goal = -1;
  constructor(g: NeonGame, idx = 0, o: { naive?: boolean; react?: number; hesitate?: number; seed?: number } = {}) {
    this.g = g; this.idx = idx; this.naive = !!o.naive; this.react = o.react ?? (this.naive ? 0.3 : 0.12); this.hesitate = o.hesitate ?? (this.naive ? 0.15 : 0.05);
    this.rng = new Rng(o.seed ?? 7);
  }
  decide(): Dir {
    this.timer -= DT;
    if (this.timer > 0) return this.dir;
    this.timer = this.react;
    if (this.rng.next() < this.hesitate) return this.dir;
    this.dir = this.plan();
    return this.dir;
  }
  plan(): Dir {
    const g = this.g, h = g.heroes[this.idx];
    if (!h || h.state !== 'run') return 0;
    const here = g.near(h);
    const threats = g.cicaks.filter((c) => c.mode === 'out' || c.mode === 'gulp').map((c) => g.near(c));
    const prey = g.cicaks.filter((c) => c.mode === 'scared').map((c) => g.near(c));
    // cost of standing on a cell: how close the nearest threat is
    const danger = (c: number) => {
      let m = 99;
      for (const t of threats) { const dd = g.d(c, t); if (dd >= 0 && dd < m) m = dd; }
      return m;
    };
    // a breadth-first search from here, refusing cells too close to a threat; if that walls every spark off, search
    // again refusing only cells right next to one (a person would squeeze past rather than stand still)
    const search = (keep: number) => {
      const prev = new Int32Array(N).fill(-2), q: number[] = [here], order: number[] = []; prev[here] = -1;
      for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi]; order.push(c);
        for (let d = 1 as Dir; d <= 4; d = (d + 1) as Dir) {
          if (!g.open(c, d)) continue;
          const n = step(c, d);
          if (prev[n] !== -2) continue;
          if (danger(n) <= keep && !(g.fuseT > 1.2 && prey.length)) continue;
          prev[n] = c; q.push(n);
        }
      }
      return { prev, order };
    };
    let { prev, order } = search(this.naive ? 2 : 3);
    if (!order.some((c) => g.spark[c] && c !== here)) ({ prev, order } = search(1));
    /**
     * the key to hold for the route to `goal`, pressed the way a person does: a turn is pressed early, but only once
     * no other junction before it would take the turn first; until then keep running
     */
    const first = (goal: number): Dir => {
      const path: number[] = [];
      for (let c = goal; c !== here && c >= 0; c = prev[c]) path.push(c);
      if (!path.length || prev[path[path.length - 1]] !== here) return 0;
      path.push(here); path.reverse();
      const dirOf = (a: number, b2: number) => { for (let d = 1 as Dir; d <= 4; d = (d + 1) as Dir) if (step(a, d) === b2) return d; return 0 as Dir; };
      const d0 = dirOf(path[0], path[1]);
      if (!h.dir || d0 === OPP[h.dir]) return d0;
      for (let i = 0; i + 1 < path.length; i++) {
        const di = dirOf(path[i], path[i + 1]);
        if (di !== h.dir) {
          // would this turn be taken earlier, at a junction before path[i]?
          for (let j = 1; j < i; j++) if (g.open(path[j], di)) return h.dir;
          return di;
        }
      }
      return h.dir;
    };
    const reach = (c: number) => prev[c] !== -2 && c !== here;
    let goal = -1;
    if (!this.naive) {
      const nearThreat = danger(here);
      // chase a panicked cicak while the fuse has time left
      if (g.fuseT > 1.2) for (const p of prey) if (reach(p) && g.d(here, p) <= 8) { goal = p; break; }
      // chased on a lit tube: run for a fuse, else for the nearest dark tube
      if (goal < 0 && nearThreat <= 3) {
        for (const c of order) if (g.fuseLeft[c] && g.d(here, c) <= 6 && reach(c)) { goal = c; break; }
        if (goal < 0 && g.lit(here)) for (const c of order) if (!g.lit(c) && reach(c)) { goal = c; break; }
      }
      if (goal < 0 && g.moth && reach(g.moth.cell) && g.d(here, g.moth.cell) <= 8) goal = g.moth.cell;
    }
    // stick with the spark it was already heading for while it is still there and reachable, so it doesn't dither
    if (goal < 0 && this.goal >= 0 && g.spark[this.goal] && reach(this.goal)) goal = this.goal;
    if (goal < 0) for (const c of order) if (g.spark[c] && reach(c)) { goal = c; break; }
    this.goal = g.spark[goal] ? goal : -1;
    if (goal < 0) {
      // boxed in: step to the neighbour furthest from any threat
      let bd: Dir = 0, best = -1;
      for (let d = 1 as Dir; d <= 4; d = (d + 1) as Dir) if (g.open(here, d)) { const v = danger(step(here, d)); if (v > best) { best = v; bd = d; } }
      return bd;
    }
    return first(goal);
  }
}

// ─────────────────────────────── the save
export interface SaveData { v: 1; best: number; reached: number; assist: boolean; sound: boolean; music: boolean; lead: HeroId }
export const freshSave = (): SaveData => ({ v: 1, best: 0, reached: 0, assist: true, sound: true, music: true, lead: 'dora' });
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    return {
      v: 1, best: Math.max(0, Math.floor(Number(s.best) || 0)),
      reached: Math.max(0, Math.min(NIGHTS.length - 1, Math.floor(Number(s.reached) || 0))),
      assist: s.assist !== false, sound: s.sound !== false, music: s.music !== false, lead: s.lead === 'enzo' ? 'enzo' : 'dora',
    };
  } catch { return null; }
}
/** fold a finished (or abandoned) run into the save */
export function record(s: SaveData, st: Stats): SaveData {
  const reached = Math.min(NIGHTS.length - 1, Math.max(s.reached, st.won ? NIGHTS.length - 1 : st.reached));
  return { ...s, best: Math.max(s.best, st.score), reached };
}
/** the furthest night a run may start from */
export const canStart = (s: SaveData, n: number) => n >= 0 && n <= s.reached;
