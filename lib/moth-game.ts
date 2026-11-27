// Moth Hoop: the rules. A fixed-screen thread shooter on a cross-stitch kit. Ah Ma left six kits half-done in her
// Tiong Bahru sewing room and the clothes moths found them. Dora and Enzo ride cotton reels along the bottom of the
// hoop and throw needles straight up their column: a needle that meets a moth pins it, and a needle that meets the
// kit's printed picture stitches it, a few crosses at a time, from the bottom up. The moths land on finished stitches
// and chew them into holes; a hole must be darned (one needle) before it can be stitched again. Finish every stitch of
// the picture to win the hoop; lose all three spools to diving moths, or let the cloth tear, and the hoop is lost.
//
// Deterministic: one seeded generator, a fixed 60 Hz step, no DOM. Units are stitch cells: the field is 128 x 72
// cells, x to the right and y down. lib/moth-scene.ts draws it; app/moth-hoop/page.tsx wires keys, saves and sound.
import { MOTH_PATTERNS, type Pattern } from './moth-patterns.js';

export const W = 128, H = 72;
export const DT = 1 / 60;
export const RAIL_Y = 66;        // the reels' axle row
export const HAND_Y = 56;        // where a thrown needle starts
export const X_MIN = 14, X_MAX = 114;
export const SAVE_KEY = 'moth-hoop-v1';

export type FoeKind = 'moth' | 'gold' | 'larva' | 'silk' | 'queen' | 'cocoon';
export type Power = 'lavender' | 'triple' | 'gold' | 'thimble';
export const POWERS: Power[] = ['lavender', 'triple', 'gold', 'thimble'];
export const POWER_NAME: Record<Power, string> = { lavender: 'Lavender sachet', triple: 'Three needles', gold: 'Golden thread', thimble: 'Thimble' };
export const POWER_TIME: Record<Power, number> = { lavender: 7, triple: 9, gold: 9, thimble: 0 };

export interface HoopDef {
  id: string; name: string; place: string; blurb: string;
  pattern: string;                                    // key into MOTH_PATTERNS
  spawnEvery: number; cap: number;                    // seconds between arrivals, most foes at once
  kinds: Partial<Record<'moth' | 'gold' | 'silk', number>>; // arrival weights
  larva: number;                                      // chance a moth lays a larva after a chew
  chew: number;                                       // seconds to chew one stitch
  tear: number;                                       // fraction of the picture that may be holes before it tears
  par: number;                                        // seconds for the third star
  run: number;                                        // stitches one needle sews
  queen?: boolean;
}

export const HOOPS: HoopDef[] = [
  { id: 'kopi', name: 'Kopi & Kaya', place: 'A kopitiam breakfast', blurb: 'Ah Ma\'s easiest kit. Throw needles up into the printed picture to stitch it, and pin the moths before they chew.', pattern: 'kopi', spawnEvery: 3.2, cap: 3, kinds: { moth: 1 }, larva: 0, chew: 3.6, tear: 0.2, par: 75, run: 5 },
  { id: 'flats', name: 'Tiong Bahru Flats', place: 'The art-deco flats on Seng Poh Road', blurb: 'A silk moth carries Ah Ma\'s lost buttons. Pin it three times and catch the button it drops. Larvae crawl along the rows.', pattern: 'flats', spawnEvery: 2.8, cap: 4, kinds: { moth: 5, silk: 1 }, larva: 0.2, chew: 3.3, tear: 0.18, par: 150, run: 12 },
  { id: 'merlion', name: 'The Merlion', place: 'Merlion Park at Marina Bay', blurb: 'Gold moths hover, shiver, then dive at your reel. Step aside when one shivers.', pattern: 'merlion', spawnEvery: 2.6, cap: 5, kinds: { moth: 5, gold: 2, silk: 1 }, larva: 0.22, chew: 3.1, tear: 0.18, par: 175, run: 12 },
  { id: 'tiles', name: 'Peranakan Tiles', place: 'A shophouse front on Koon Seng Road', blurb: 'More moths, hungrier larvae. A larva that eats four stitches spins a cocoon, and the cocoon hatches a moth.', pattern: 'tiles', spawnEvery: 2.3, cap: 6, kinds: { moth: 6, gold: 2, silk: 1 }, larva: 0.3, chew: 2.9, tear: 0.17, par: 175, run: 12 },
  { id: 'supertrees', name: 'Supertree Grove', place: 'Gardens by the Bay at night', blurb: 'The whole swarm at once. Keep the darning up.', pattern: 'supertrees', spawnEvery: 2.0, cap: 7, kinds: { moth: 6, gold: 3, silk: 1 }, larva: 0.3, chew: 2.7, tear: 0.16, par: 195, run: 12 },
  { id: 'ndp', name: 'National Day', place: 'Fireworks over Marina Bay', blurb: 'The Atlas Moth, queen of the wardrobe, lays eggs across Ah Ma\'s finest kit. Pin her and finish the fireworks.', pattern: 'ndp', spawnEvery: 2.4, cap: 6, kinds: { moth: 5, gold: 3, silk: 1 }, larva: 0.25, chew: 2.8, tear: 0.17, par: 190, run: 12, queen: true },
];

// ─────────────────────────────── random
export class Rng {
  s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(n: number) { return Math.floor(this.next() * n); }
}

// ─────────────────────────────── state
export const TODO = 1, DONE = 2, HOLE = 3;
export type HeroId = 'dora' | 'enzo';
export interface Input { left: boolean; right: boolean; fire: boolean }
export const NO_INPUT: Input = { left: false, right: false, fire: false };

export interface Hero {
  id: HeroId; ctrl: 'p1' | 'p2' | 'ride';
  x: number; dir: -1 | 0 | 1; cool: number; throwT: number; hurtT: number; idleT: number;
}
export interface Needle { id: number; x: number; y: number; by: HeroId; gold: boolean; trail: number }
export interface Foe {
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number;
  state: 'enter' | 'fly' | 'land' | 'chew' | 'hover' | 'shiver' | 'dive' | 'flee' | 'crawl' | 'spin' | 'lay';
  t: number; hp: number; tx: number; ty: number; cell: number; ate: number; dir: number; hitT: number; phase: number;
}
export interface Drop { id: number; power: Power; x: number; y: number }
export type Ev =
  | { k: 'stitch'; cells: number[]; by: HeroId }
  | { k: 'darn'; cell: number }
  | { k: 'chew'; cell: number }
  | { k: 'hole'; cell: number }
  | { k: 'pin'; foe: FoeKind; x: number; y: number; score: number; dead: boolean }
  | { k: 'miss'; x: number }
  | { k: 'throw'; by: HeroId; x: number }
  | { k: 'shiver'; x: number }
  | { k: 'dive'; x: number }
  | { k: 'hurt'; by: HeroId; blocked: boolean }
  | { k: 'drop'; power: Power; x: number; y: number }
  | { k: 'power'; power: Power; by: HeroId }
  | { k: 'row'; row: number }
  | { k: 'arrive'; foe: FoeKind }
  | { k: 'hatch'; x: number; y: number }
  | { k: 'egg'; x: number; y: number }
  | { k: 'queen'; hp: number }
  | { k: 'spool'; spools: number }
  | { k: 'win' } | { k: 'lose'; why: 'spools' | 'tear' };

export interface Stats { time: number; score: number; pinned: number; stitched: number; darned: number; holes: number; spoolsLost: number; stars: number }

export const FOE_BOX: Record<FoeKind, [number, number]> = { moth: [4.2, 3], gold: [4, 3], larva: [2.2, 1.4], silk: [7, 4.5], queen: [12, 7], cocoon: [1.6, 2] };
export const FOE_HP: Record<FoeKind, number> = { moth: 1, gold: 1, larva: 1, silk: 3, queen: 36, cocoon: 1 };
export const FOE_SCORE: Record<FoeKind, number> = { moth: 100, gold: 150, larva: 50, silk: 500, queen: 5000, cocoon: 80 };

export interface GameOpts { hoop: number; seed: number; assist?: boolean; twoP?: boolean; sewer?: HeroId; pattern?: Pattern }

export class MothGame {
  hoop: number; def: HoopDef; pat: Pattern; rng: Rng; assist: boolean;
  /** per pattern cell: 0 not part of the picture, TODO, DONE or HOLE */
  cloth: Uint8Array; total = 0; done = 0; holes = 0; tearAt: number;
  heroes: Hero[] = []; needles: Needle[] = []; foes: Foe[] = []; drops: Drop[] = [];
  powers: Record<Power, number> = { lavender: 0, triple: 0, gold: 0, thimble: 0 };
  spools = 3; score = 0; time = 0; tick = 0; spawnT = 2; nextId = 1;
  pinned = 0; stitched = 0; darned = 0; spoolsLost = 0; queenSpawned = false; queenDown = false;
  over: null | 'win' | 'lose' = null; why: 'spools' | 'tear' | null = null;
  events: Ev[] = [];
  rowsDone: Set<number> = new Set();
  spares = 0;                      // spare spools handed back at a third and two thirds done

  constructor(o: GameOpts) {
    this.hoop = o.hoop; this.def = HOOPS[o.hoop]; this.rng = new Rng(o.seed); this.assist = o.assist ?? true;
    this.pat = o.pattern ?? MOTH_PATTERNS[this.def.pattern];
    this.cloth = new Uint8Array(W * H);
    const p = this.pat;
    for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) if (p.cells[r * p.w + c]) { this.cloth[(p.y0 + r) * W + p.x0 + c] = TODO; this.total++; }
    this.tearAt = Math.max(10, Math.round(this.total * this.def.tear));
    const sewer = o.sewer ?? 'dora', other: HeroId = sewer === 'dora' ? 'enzo' : 'dora';
    this.heroes.push({ id: sewer, ctrl: 'p1', x: o.twoP ? 44 : 64, dir: 0, cool: 0, throwT: 0, hurtT: 0, idleT: 0 });
    this.heroes.push({ id: other, ctrl: o.twoP ? 'p2' : 'ride', x: o.twoP ? 84 : 64, dir: 0, cool: 0, throwT: 0, hurtT: 0, idleT: 0 });
  }

  get twoP() { return this.heroes.some((h) => h.ctrl === 'p2'); }
  get progress() { return this.total ? this.done / this.total : 1; }
  /** colour index (1-based into pat.palette) of a field cell, 0 if not in the picture */
  colourAt(cell: number) { const p = this.pat, x = cell % W - p.x0, y = Math.floor(cell / W) - p.y0; return x < 0 || y < 0 || x >= p.w || y >= p.h ? 0 : p.cells[y * p.w + x]; }
  /** the heroes that throw needles: both in two-player, the sewer alone otherwise */
  throwers() { return this.heroes.filter((h) => h.ctrl !== 'ride'); }
  reelOf(h: Hero) { return h.ctrl === 'ride' ? this.heroes.find((o) => o.ctrl === 'p1')! : h; }

  /** a second player takes the rider's reel */
  join() { const r = this.heroes.find((h) => h.ctrl === 'ride'); if (!r) return; const p = this.heroes.find((h) => h.ctrl === 'p1')!; r.ctrl = 'p2'; r.x = Math.min(X_MAX, p.x + 16); }
  /** solo: the rider takes over sewing */
  swap() { if (this.twoP) return; for (const h of this.heroes) h.ctrl = h.ctrl === 'p1' ? 'ride' : 'p1'; const p = this.heroes.find((h) => h.ctrl === 'p1')!, r = this.heroes.find((h) => h.ctrl === 'ride')!; p.x = r.x; }

  stats(): Stats {
    const stars = this.over !== 'win' ? 0 : 1 + (this.spoolsLost === 0 ? 1 : 0) + (this.time <= this.def.par ? 1 : 0);
    return { time: this.time, score: this.score, pinned: this.pinned, stitched: this.stitched, darned: this.darned, holes: this.holes, spoolsLost: this.spoolsLost, stars };
  }

  // ─────────────────────────────── step
  step(p1: Input, p2: Input = NO_INPUT) {
    this.events = [];
    if (this.over) return;
    this.tick++; this.time += DT;
    for (const k of POWERS) if (k !== 'thimble' && this.powers[k] > 0) this.powers[k] = Math.max(0, this.powers[k] - DT);
    for (const h of this.heroes) this.moveHero(h, h.ctrl === 'p1' ? p1 : h.ctrl === 'p2' ? p2 : NO_INPUT);
    this.moveNeedles();
    this.spawn();
    for (const f of [...this.foes]) this.moveFoe(f);
    this.foes = this.foes.filter((f) => f.hp > 0 && f.y < H + 12 && f.y > -30 && f.x > -30 && f.x < W + 30);
    this.moveDrops();
    this.checkEnd();
  }

  private moveHero(h: Hero, inp: Input) {
    h.hurtT = Math.max(0, h.hurtT - DT); h.throwT = Math.max(0, h.throwT - DT); h.cool = Math.max(0, h.cool - DT);
    if (h.ctrl === 'ride') { const d = this.heroes.find((o) => o.ctrl === 'p1')!; h.x = d.x; h.dir = d.dir; return; }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0) as -1 | 0 | 1;
    h.dir = dir; h.x = Math.max(X_MIN, Math.min(X_MAX, h.x + dir * 44 * DT));
    h.idleT = dir || inp.fire ? 0 : h.idleT + DT;
    if (inp.fire && h.cool <= 0) this.throwNeedle(h);
  }

  private throwNeedle(h: Hero) {
    h.cool = this.assist ? 0.15 : 0.18; h.throwT = 0.16;
    const c = Math.round(h.x), gold = this.powers.gold > 0;
    const cols = this.powers.triple > 0 ? [c - 3, c, c + 3] : [c];
    for (const x of cols) if (x >= 0 && x < W) this.needles.push({ id: this.nextId++, x, y: HAND_Y, by: h.id, gold, trail: HAND_Y });
    this.events.push({ k: 'throw', by: h.id, x: c });
  }

  private moveNeedles() {
    const speed = 84 * DT;
    for (const n of this.needles) {
      const y0 = n.y, y1 = n.y - speed;
      // the lowest thing the needle meets on this step wins: a foe, or a picture cell that isn't stitched
      let foe: Foe | null = null, fy = -1e9;
      for (const f of this.foes) {
        if (f.hp <= 0 || f.state === 'flee' && f.kind !== 'queen') continue;
        const [bw, bh] = FOE_BOX[f.kind];
        if (Math.abs(f.x - n.x) > bw) continue;
        const top = f.y - bh, bot = f.y + bh;
        if (bot < y1 || top > y0) continue;
        const hitY = Math.min(bot, y0);
        if (hitY > fy) { fy = hitY; foe = f; }
      }
      let cellY = -1;
      for (let y = Math.floor(y0); y >= Math.ceil(y1) - 1 && y >= 0; y--) {
        if (y > y0) continue;
        const s = this.cloth[y * W + n.x];
        if (s === TODO || s === HOLE) { cellY = y; break; }
      }
      if (foe && fy >= cellY) { this.hitFoe(foe, n); n.y = -99; continue; }
      if (cellY >= 0) { this.sew(n, cellY); n.y = -99; continue; }
      n.y = y1;
      if (n.y < 1) { this.events.push({ k: 'miss', x: n.x }); n.y = -99; }
    }
    this.needles = this.needles.filter((n) => n.y > -50);
  }

  private sew(n: Needle, y: number) {
    const i0 = y * W + n.x;
    if (this.cloth[i0] === HOLE) {
      this.cloth[i0] = TODO; this.holes--; this.darned++; this.score += 20;
      this.events.push({ k: 'darn', cell: i0 });
      if (!n.gold) return;
    }
    // stitch upward: a run of unstitched cells, stopping at a hole or the end of the run
    const max = this.def.run * (n.gold ? 2 : 1), cells: number[] = [];
    for (let yy = y; yy >= 0 && cells.length < max; yy--) {
      const i = yy * W + n.x, s = this.cloth[i];
      if (s === DONE) { if (cells.length) break; continue; }
      if (s !== TODO) break;
      // a landed moth or larva in the way stops the run below it
      if (this.foes.some((f) => f.hp > 0 && f.cell === i && (f.state === 'chew' || f.state === 'land' || f.state === 'crawl' || f.state === 'spin'))) break;
      this.cloth[i] = DONE; cells.push(i);
    }
    if (!cells.length) return;
    this.done += cells.length; this.stitched += cells.length; this.score += cells.length * 5;
    this.events.push({ k: 'stitch', cells, by: n.by });
    for (const i of cells) this.checkRow(Math.floor(i / W));
    // Ah Ma's spare spools: one back (if any were lost) as the picture passes a third and two thirds
    const due = this.progress >= 2 / 3 ? 2 : this.progress >= 1 / 3 ? 1 : 0;
    while (this.spares < due) { this.spares++; if (this.spools < 3) { this.spools++; this.events.push({ k: 'spool', spools: this.spools }); } }
  }

  private checkRow(row: number) {
    if (this.rowsDone.has(row)) return;
    for (let x = 0; x < W; x++) { const s = this.cloth[row * W + x]; if (s === TODO || s === HOLE) return; }
    let any = false; for (let x = 0; x < W; x++) if (this.cloth[row * W + x]) { any = true; break; }
    if (!any) return;
    this.rowsDone.add(row); this.score += 150; this.events.push({ k: 'row', row });
  }

  private hitFoe(f: Foe, n: Needle) {
    f.hp -= 1; f.hitT = 0.18;
    const dead = f.hp <= 0, score = dead ? FOE_SCORE[f.kind] : 10;
    this.score += score;
    if (dead) {
      this.pinned++;
      if (f.kind === 'silk') { const power = this.pickPower(); this.drops.push({ id: this.nextId++, power, x: f.x, y: f.y }); this.events.push({ k: 'drop', power, x: f.x, y: f.y }); }
      if (f.kind === 'queen') { this.queenDown = true; for (const o of this.foes) if (o !== f && o.kind !== 'larva' && o.kind !== 'cocoon') { o.state = 'flee'; o.t = 0; } }
    }
    if (f.kind === 'queen') this.events.push({ k: 'queen', hp: Math.max(0, f.hp) });
    this.events.push({ k: 'pin', foe: f.kind, x: f.x, y: f.y, score, dead });
    if (!dead && f.kind === 'moth' && (f.state === 'chew' || f.state === 'land')) { f.state = 'fly'; f.cell = -1; this.retarget(f); }
  }

  private pickPower(): Power {
    const owned = POWERS.filter((p) => p === 'thimble' ? this.powers.thimble <= 0 : true);
    return owned[this.rng.int(owned.length)];
  }

  private moveDrops() {
    for (const d of this.drops) {
      d.y += 14 * DT;
      for (const h of this.heroes) {
        if (h.ctrl === 'ride') continue;
        if (Math.abs(h.x - d.x) < 6 && d.y > RAIL_Y - 9 && d.y < RAIL_Y + 2) { this.grant(d.power, h.id); d.y = 999; break; }
      }
    }
    this.drops = this.drops.filter((d) => d.y < H + 4);
  }

  grant(p: Power, by: HeroId) {
    if (p === 'thimble') this.powers.thimble = 1; else this.powers[p] = POWER_TIME[p];
    if (p === 'lavender') for (const f of this.foes) if (f.kind !== 'queen' && f.kind !== 'larva' && f.kind !== 'cocoon') { if (f.cell >= 0) f.cell = -1; f.state = 'flee'; f.t = 0; }
    this.score += 50; this.events.push({ k: 'power', power: p, by });
  }

  // ─────────────────────────────── arrivals
  private spawn() {
    const d = this.def;
    if (d.queen && !this.queenSpawned && this.progress >= 0.25) { this.queenSpawned = true; this.addFoe('queen', W / 2, -10); }
    if (this.powers.lavender > 0) return;
    this.spawnT -= DT;
    if (this.spawnT > 0) return;
    const ease = this.assist ? 1.15 : 1;
    // the swarm thickens as the picture fills, then thins for the last stitches so the finish is never a chase
    const p = this.progress, ramp = p < 0.85 ? 1 - p * 0.35 : 1.25;
    this.spawnT = d.spawnEvery * ease * ramp * this.rng.range(0.8, 1.2);
    const flying = this.foes.filter((f) => f.kind !== 'larva' && f.kind !== 'cocoon' && f.kind !== 'queen').length;
    if (flying >= d.cap) return;
    const w = Object.entries(d.kinds) as ['moth' | 'gold' | 'silk', number][];
    let sum = 0; for (const [, v] of w) sum += v;
    let r = this.rng.next() * sum, kind: 'moth' | 'gold' | 'silk' = 'moth';
    for (const [k, v] of w) { r -= v; if (r <= 0) { kind = k; break; } }
    if (kind === 'silk' && this.foes.some((f) => f.kind === 'silk')) kind = 'moth';
    if (kind === 'gold' && this.foes.filter((f) => f.kind === 'gold').length >= 2) kind = 'moth';
    if (kind === 'silk') { const left = this.rng.next() < 0.5; this.addFoe('silk', left ? -8 : W + 8, this.rng.range(8, 12)).vx = left ? 9 : -9; }
    else this.addFoe(kind, this.rng.range(16, W - 16), -4);
  }

  addFoe(kind: FoeKind, x: number, y: number): Foe {
    const f: Foe = { id: this.nextId++, kind, x, y, vx: 0, vy: 0, state: 'enter', t: 0, hp: FOE_HP[kind], tx: x, ty: 12, cell: -1, ate: 0, dir: this.rng.next() < 0.5 ? -1 : 1, hitT: 0, phase: this.rng.next() * 6.28 };
    if (kind === 'larva' || kind === 'cocoon') f.state = kind === 'larva' ? 'crawl' : 'spin';
    if (kind === 'queen') { f.ty = 9; }
    this.foes.push(f);
    this.events.push({ k: 'arrive', foe: kind });
    if (kind === 'moth') this.retarget(f);
    if (kind === 'gold') { f.tx = x; f.ty = this.rng.range(9, 18); }
    return f;
  }

  /** a moth picks a finished stitch to chew, the lowest-hanging fruit first; with nothing stitched yet it wanders */
  private retarget(f: Foe) {
    const cands: number[] = [];
    for (let i = 0; i < this.cloth.length; i++) if (this.cloth[i] === DONE && !this.foes.some((o) => o !== f && o.cell === i)) cands.push(i);
    if (!cands.length) { f.cell = -1; f.tx = this.rng.range(16, W - 16); f.ty = this.rng.range(6, 30); return; }
    // pick among a few random candidates the one nearest the moth, so it reads as hunting rather than teleporting
    let best = cands[this.rng.int(cands.length)], bd = 1e9;
    for (let k = 0; k < 4; k++) { const i = cands[this.rng.int(cands.length)], dx = i % W - f.x, dy = Math.floor(i / W) - f.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = i; } }
    f.cell = best; f.tx = best % W; f.ty = Math.floor(best / W);
  }

  private moveFoe(f: Foe) {
    f.t += DT; f.hitT = Math.max(0, f.hitT - DT);
    const slow = this.assist ? 0.85 : 1;
    switch (f.kind) {
      case 'moth': return this.moveMoth(f, slow);
      case 'gold': return this.moveGold(f, slow);
      case 'silk': return this.moveSilk(f);
      case 'larva': return this.moveLarva(f);
      case 'cocoon': return this.moveCocoon(f);
      case 'queen': return this.moveQueen(f);
    }
  }

  private flyTo(f: Foe, speed: number, wobble: number) {
    const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy) || 1;
    const s = Math.min(d, speed * DT);
    f.vx = dx / d * speed; f.vy = dy / d * speed;
    f.x += dx / d * s + Math.sin(f.t * 7 + f.phase) * wobble * DT;
    f.y += dy / d * s + Math.cos(f.t * 5.3 + f.phase) * wobble * 0.6 * DT;
    return d;
  }

  private moveMoth(f: Foe, slow: number) {
    if (f.state === 'flee') { f.y -= 30 * DT; f.x += Math.sin(f.t * 8 + f.phase) * 20 * DT; if (f.y < -8) { if (this.powers.lavender > 0 || this.queenDown) f.hp = 0; else { f.state = 'enter'; f.y = -4; this.retarget(f); } } return; }
    if (f.state === 'land') { if (f.t > 0.35) { f.state = 'chew'; f.t = 0; this.events.push({ k: 'chew', cell: f.cell }); } return; }
    if (f.state === 'chew') {
      if (this.cloth[f.cell] !== DONE) { f.state = 'fly'; this.retarget(f); return; }
      if (f.t >= this.def.chew / slow) {
        this.cloth[f.cell] = HOLE; this.done--; this.holes++; this.rowsDone.delete(Math.floor(f.cell / W));
        this.events.push({ k: 'hole', cell: f.cell });
        const cell = f.cell;
        if (this.def.larva && this.rng.next() < this.def.larva && this.foes.filter((o) => o.kind === 'larva').length < 3) {
          const l = this.addFoe('larva', cell % W, Math.floor(cell / W)); l.cell = cell;
        }
        // hop to a neighbouring stitch, or take off for another part of the picture
        const nb = [cell - 1, cell + 1, cell - W, cell + W, cell - W - 1, cell - W + 1].filter((i) => this.cloth[i] === DONE && !this.foes.some((o) => o !== f && o.cell === i));
        if (nb.length && this.rng.next() < 0.55) { f.cell = nb[this.rng.int(nb.length)]; f.tx = f.cell % W; f.ty = Math.floor(f.cell / W); f.state = 'fly'; }
        else { f.state = 'fly'; this.retarget(f); }
        f.t = 0;
      }
      return;
    }
    // enter / fly
    if (f.cell >= 0 && this.cloth[f.cell] !== DONE) this.retarget(f);
    if (f.cell < 0 && f.t > 1.2) { this.retarget(f); f.t = 0; }
    const d = this.flyTo(f, (f.state === 'enter' ? 16 : 12) * slow, 14);
    if (f.state === 'enter' && f.y > 3) f.state = 'fly';
    if (f.cell >= 0 && d < 0.6) { f.x = f.tx; f.y = f.ty; f.state = 'land'; f.t = 0; }
  }

  private moveGold(f: Foe, slow: number) {
    if (f.state === 'flee') { f.y -= 34 * DT; if (f.y < -8) { if (this.powers.lavender > 0 || this.queenDown) f.hp = 0; else { f.state = 'enter'; f.y = -4; } } return; }
    if (f.state === 'enter' || f.state === 'hover') {
      if (f.state === 'enter' && f.y > 4) { f.state = 'hover'; f.t = 0; }
      if (f.state === 'hover' && Math.abs(f.tx - f.x) < 1) f.tx = Math.max(14, Math.min(W - 14, f.x + this.rng.range(-20, 20)));
      this.flyTo(f, 14, 10);
      if (f.state === 'hover' && f.t > this.rng.range(1.6, 2.4) + (this.assist ? 0.6 : 0)) {
        f.state = 'shiver'; f.t = 0;
        // aim at the nearest reel
        let best = this.heroes[0], bd = 1e9; for (const h of this.heroes) { const r = this.reelOf(h), dd = Math.abs(r.x - f.x); if (dd < bd) { bd = dd; best = r; } }
        f.tx = best.x; this.events.push({ k: 'shiver', x: f.x });
      }
      return;
    }
    if (f.state === 'shiver') {
      f.x += Math.sin(f.t * 60) * 0.25;
      if (f.t > (this.assist ? 0.95 : 0.7)) { f.state = 'dive'; f.t = 0; const dx = f.tx - f.x, dy = RAIL_Y - f.y, d = Math.hypot(dx, dy); f.vx = dx / d * 40 * slow; f.vy = dy / d * 40 * slow; this.events.push({ k: 'dive', x: f.x }); }
      return;
    }
    if (f.state === 'dive') {
      f.x += f.vx * DT; f.y += f.vy * DT;
      if (f.y > RAIL_Y - 7 && f.y < RAIL_Y + 2 && f.hitT >= 0) {
        for (const h of this.heroes) {
          if (h.ctrl === 'ride' || h.hurtT > 0) continue;
          if (Math.abs(h.x - f.x) < 5.2) { this.hurt(h); f.hitT = -1; break; }
        }
      }
      if (f.y > H + 6) { f.state = 'enter'; f.y = -6; f.x = this.rng.range(16, W - 16); f.hitT = 0; f.t = 0; }
    }
  }

  private hurt(h: Hero) {
    if (this.powers.thimble > 0) { this.powers.thimble = 0; h.hurtT = 1; this.events.push({ k: 'hurt', by: h.id, blocked: true }); return; }
    this.spools--; this.spoolsLost++; h.hurtT = 1.6;
    for (const o of this.heroes) if (o.ctrl === 'ride') o.hurtT = 1.6;
    this.events.push({ k: 'hurt', by: h.id, blocked: false });
  }

  private moveSilk(f: Foe) {
    f.x += f.vx * DT; f.y = 10 + Math.sin(f.t * 1.7 + f.phase) * 2.5;
    if (f.state === 'flee') f.y -= f.t * 20;
  }

  private moveLarva(f: Foe) {
    // crawl along the picture row, eating finished stitches; four stitches and it spins a cocoon
    const here = this.cloth[f.cell];
    if (f.state === 'crawl') {
      if (here === DONE) { f.state = 'chew'; f.t = 0; this.events.push({ k: 'chew', cell: f.cell }); return; }
      if (f.t < 0.55) return;
      f.t = 0;
      const next = f.cell + f.dir;
      if (this.colourAt(next) && !this.foes.some((o) => o !== f && o.cell === next)) { f.cell = next; f.x = next % W; }
      else { f.dir = -f.dir; const back = f.cell + f.dir; if (this.colourAt(back)) { f.cell = back; f.x = back % W; } else f.y += 0; }
      return;
    }
    if (f.state === 'chew') {
      if (here !== DONE) { f.state = 'crawl'; return; }
      if (f.t >= this.def.chew * 0.55) {
        this.cloth[f.cell] = HOLE; this.done--; this.holes++; this.rowsDone.delete(Math.floor(f.cell / W)); this.events.push({ k: 'hole', cell: f.cell });
        f.ate++; f.state = 'crawl'; f.t = 0;
        if (f.ate >= 4) { f.hp = 0; const c = this.addFoe('cocoon', f.x, f.y); c.cell = f.cell; }
      }
    }
  }

  private moveCocoon(f: Foe) {
    if (f.t > 5) { f.hp = 0; this.events.push({ k: 'hatch', x: f.x, y: f.y }); const m = this.addFoe('moth', f.x, f.y); m.state = 'fly'; }
  }

  private moveQueen(f: Foe) {
    if (f.state === 'enter') { f.y += 8 * DT; if (f.y >= f.ty) { f.state = 'hover'; f.t = 0; f.tx = 30; } return; }
    f.x += Math.sign(f.tx - f.x) * 10 * DT; f.y = f.ty + Math.sin(f.t * 1.3) * 1.5;
    if (Math.abs(f.tx - f.x) < 0.5) f.tx = f.tx < W / 2 ? W - 30 : 30;
    // lay an egg on a finished stitch every few seconds; it hatches a larva where it lands
    f.dir -= DT;
    if (f.dir <= 0) {
      f.dir = this.assist ? 6 : 4.5;
      const below: number[] = [];
      for (let y = 0; y < H; y++) for (let dx = -3; dx <= 3; dx++) { const i = y * W + Math.round(f.x) + dx; if (this.cloth[i] === DONE) below.push(i); }
      if (below.length && this.foes.filter((o) => o.kind === 'larva').length < 4) {
        const i = below[this.rng.int(below.length)];
        const l = this.addFoe('larva', i % W, Math.floor(i / W)); l.cell = i; l.t = -1;
        this.events.push({ k: 'egg', x: i % W, y: Math.floor(i / W) });
      }
    }
  }

  private checkEnd() {
    if (this.over) return;
    if (this.spools <= 0) { this.over = 'lose'; this.why = 'spools'; this.events.push({ k: 'lose', why: 'spools' }); return; }
    if (this.holes >= this.tearAt) { this.over = 'lose'; this.why = 'tear'; this.events.push({ k: 'lose', why: 'tear' }); return; }
    if (this.done >= this.total && (!this.def.queen || this.queenDown)) {
      this.over = 'win'; this.score += 1000 + this.spools * 300;
      for (const f of this.foes) if (f.kind !== 'queen') { f.state = 'flee'; f.t = 0; }
      this.events.push({ k: 'win' });
    }
  }

  /** the columns that still need stitching or darning, for the rail markers */
  openColumns(): number[] {
    const out: number[] = [];
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const s = this.cloth[y * W + x]; if (s === TODO || s === HOLE) { out.push(x); break; } }
    return out;
  }
}

// ─────────────────────────────── saves
export interface SaveData { v: 1; stars: number[]; best: number[]; assist: boolean; sound: boolean; music: boolean; sewer: HeroId }
export const freshSave = (): SaveData => ({ v: 1, stars: HOOPS.map(() => 0), best: HOOPS.map(() => 0), assist: true, sound: true, music: true, sewer: 'dora' });
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !Array.isArray(s.stars) || !Array.isArray(s.best)) return null;
    const f = freshSave();
    return {
      v: 1,
      stars: f.stars.map((_, i) => Math.max(0, Math.min(3, Math.floor(Number(s.stars[i]) || 0)))),
      best: f.best.map((_, i) => Math.max(0, Math.floor(Number(s.best[i]) || 0))),
      assist: s.assist !== false, sound: s.sound !== false, music: s.music !== false, sewer: s.sewer === 'enzo' ? 'enzo' : 'dora',
    };
  } catch { return null; }
}
/** hoop 1 is open; each later hoop opens when the one before it is won */
export const hoopOpen = (s: SaveData, i: number) => i === 0 || s.stars[i - 1] > 0;
export function record(s: SaveData, hoop: number, st: Stats): SaveData {
  const n = { ...s, stars: [...s.stars], best: [...s.best] };
  n.stars[hoop] = Math.max(n.stars[hoop], st.stars); if (st.stars > 0) n.best[hoop] = Math.max(n.best[hoop], st.score);
  return n;
}

// ─────────────────────────────── a human-paced bot, for the tests and the attract mode
/** Plays like a person: it sees the field 200 to 300 ms late, aims a little off, and fixes one goal at a time:
 *  dodge a shivering or diving gold moth, pin a moth that is chewing, pin a silk moth, catch a button, else sew the
 *  open column nearest its reel. `skill` 0..1 scales the reaction delay and the aim. */
export class Bot {
  rng: Rng; delay: number; seen: { t: number; goal: number; dodge: number }[] = []; goal = 64; dodge = 0; noise = 0;
  constructor(seed: number, public skill = 0.6) { this.rng = new Rng(seed ^ 0x5eed); this.delay = Math.round(12 + (1 - skill) * 6); }
  plan(g: MothGame, h: Hero): { goal: number; dodge: number } {
    const p = this.plan0(g, h);
    // keep out of every dotted dive line, like a player watching the warnings
    for (const f of g.foes) if (f.kind === 'gold' && (f.state === 'shiver' || f.state === 'dive') && Math.abs(f.tx - p.goal) < 8) {
      const left = f.tx - 9, right = f.tx + 9;
      p.goal = left < X_MIN ? right : right > X_MAX ? left : Math.abs(h.x - left) < Math.abs(h.x - right) ? left : right; p.dodge = 1;
    }
    return p;
  }
  private plan0(g: MothGame, h: Hero): { goal: number; dodge: number } {
    const rx = h.x;
    const d = g.drops.find((d) => d.y > 30); if (d) return { goal: d.x, dodge: 0 };
    let tgt: Foe | null = null, bd = 1e9;
    for (const f of g.foes) {
      if (f.hp <= 0 || f.state === 'flee' || f.kind === 'gold' && f.state !== 'hover') continue;
      const pri = f.kind === 'queen' ? 30 : f.state === 'chew' || f.kind === 'larva' ? 0 : f.kind === 'silk' ? 8 : f.state === 'land' ? 4 : 40;
      const dd = Math.abs(f.x - rx) + pri;
      if (dd < bd) { bd = dd; tgt = f; }
    }
    if (tgt && bd < 60) return { goal: tgt.x + (tgt.kind === 'silk' ? tgt.vx * 0.35 : 0), dodge: 0 };
    const cols = g.openColumns(); if (!cols.length) return { goal: rx, dodge: 0 };
    let c = cols[0]; for (const x of cols) if (Math.abs(x - rx) < Math.abs(c - rx)) c = x;
    return { goal: c, dodge: 0 };
  }
  input(g: MothGame, h: Hero): Input {
    const now = this.plan(g, h);
    this.seen.push({ t: g.tick, ...now });
    while (this.seen.length > 1 && this.seen[1].t <= g.tick - this.delay) this.seen.shift();
    const old = this.seen[0];
    if (g.tick % 20 === 0) this.noise = this.rng.range(-1, 1) * (1 - this.skill) * 1.6;
    const goal = old.goal + (old.dodge ? 0 : this.noise), dx = goal - h.x;
    return { left: dx < -0.6, right: dx > 0.6, fire: !old.dodge && Math.abs(dx) < 2.5 };
  }
}
