// Tambak: the rules. An area-capture game about Singapore's land reclamation. The field is a grid of sea with a rim of
// land. Dora and Enzo walk the land; stepping into the sea pours a trail of sand behind them, and stepping back onto
// land turns the trail into land and fills every pocket of sea that no sea creature is swimming in. Creatures that
// touch a trail wash it away and cost a sand bucket. Claim the target share of the sea before the tide clock runs
// out. Deterministic: a seed replays a game exactly. No DOM; the scene and the page read the state and the events.

export const DT = 1 / 60;
/** the field, in cells: 96 x 50, drawn at 16 px a cell under a 64 px HUD */
export const W = 96, H = 50, N = W * H;
export const SEA = 0, LAND = 1;
/** a trail cell holds 2 + the index of the hero who poured it */
export const TRAIL0 = 2;
export const RIM = 2;
export const SAVE_KEY = 'tambak-v1';

export type HeroId = 'dora' | 'enzo';
export type FoeKind = 'jelly' | 'croc' | 'puffer' | 'crab' | 'boss';
export type PickKind = 'kopi' | 'net' | 'bucket';
/** a direction: 0 none, 1 up, 2 right, 3 down, 4 left */
export type Dir = 0 | 1 | 2 | 3 | 4;
export const DX = [0, 0, 1, 0, -1], DY = [0, -1, 0, 1, 0];

export interface Site {
  id: string; name: string; place: string; blurb: string; pic: string;
  foes: FoeKind[]; tide: number; par: number; target: number; crab: boolean;
}
/** six real reclamation sites, in the order Singapore might show them to a visitor */
export const SITES: Site[] = [
  { id: 'ecp', name: 'East Coast Park', place: 'East Coast, 1970s', pic: 'ecp', foes: ['jelly', 'jelly'], tide: 180, par: 110, target: 75, crab: false,
    blurb: 'The whole park, from the lagoon hawker centre to the barbecue pits, sits on sand poured into the sea in the 1970s. Two moon jellyfish drift in the bay. Pour the beach back.' },
  { id: 'marina', name: 'Gardens by the Bay', place: 'Marina South', pic: 'marina', foes: ['jelly', 'jelly', 'puffer'], tide: 190, par: 120, target: 75, crab: false,
    blurb: 'Marina Bay used to be open sea. Fill it in and the Supertrees and the domes come up out of the sand. Mind the pufferfish: it puffs up to three times its size.' },
  { id: 'changi', name: 'Changi Airport', place: 'Changi, Tanah Merah', pic: 'changi', foes: ['jelly', 'puffer', 'croc'], tide: 200, par: 130, target: 75, crab: false,
    blurb: 'The runways run out over reclaimed land. An estuarine crocodile has followed the fishing boats in, and it swims twice as fast as the jellyfish.' },
  { id: 'jurong', name: 'Jurong Island', place: 'Southern islands, Jurong', pic: 'jurong', foes: ['jelly', 'puffer', 'croc', 'croc'], tide: 230, par: 150, target: 75, crab: true,
    blurb: 'Seven little islands were joined into one. Once a quarter of the sea is filled, a horseshoe crab climbs out and wanders your new land: keep out of its way.' },
  { id: 'semakau', name: 'Pulau Semakau', place: 'Offshore, south of Singapore', pic: 'semakau', foes: ['jelly', 'puffer', 'puffer', 'croc', 'croc'], tide: 250, par: 170, target: 75, crab: true,
    blurb: 'The landfill island that turned into a nature park, with mangroves and a lagoon. Two crocodiles, two pufferfish, and a crab once the land gets big.' },
  { id: 'tuas', name: 'Tuas Port', place: 'Tuas, the far west', pic: 'tuas', foes: ['boss', 'croc', 'puffer'], tide: 260, par: 180, target: 75, crab: true,
    blurb: 'The biggest port in the world, still being built. Old Captain Bakau, the huge saltwater croc of the Tuas sea, smells fresh sand and swims straight for your trail.' },
];

export interface FoeSpec { r: number; speed: number; sea: boolean }
export const FOES: Record<FoeKind, FoeSpec> = {
  jelly: { r: 0.7, speed: 6, sea: true },
  croc: { r: 0.9, speed: 10, sea: true },
  puffer: { r: 0.6, speed: 5, sea: true },
  crab: { r: 0.8, speed: 5, sea: false },
  boss: { r: 1.5, speed: 5.5, sea: true },
};
export const HERO_SPEED = 12, KOPI_SPEED = 16;
export const START_BUCKETS = 3;
export const BLINK = 1.6;
export const ASSIST_FOE = 0.8, ASSIST_TARGET = 70, ASSIST_TIDE = 1.25;
export const CRAB_AT = 25;
export const POWER_TIME = 8;

export class Rng {
  s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(n: number) { return Math.floor(this.next() * n); }
}

// ─────────────────────────────── state
export interface Hero {
  id: HeroId; ctrl: 'p1' | 'p2'; idx: number;
  x: number; y: number; px: number; py: number; mv: number; face: Dir; dir: Dir; moving: boolean;
  trail: number[]; start: number; blink: number; hurtT: number; cheerT: number; flagT: number;
}
export interface Foe {
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number; r: number; t: number;
  /** pufferfish: 0 deflated to 1 fully puffed; boss: lunge 0..1 */
  puff: number; snap: number; dizzy: number;
}
export interface Pick { id: number; kind: PickKind; cell: number; t: number }
export type Ev =
  | { k: 'pour'; hero: number; cell: number }
  | { k: 'claim'; hero: number; cells: number[]; trail: number; picks: PickKind[] }
  | { k: 'hurt'; hero: number; x: number; y: number; foe: FoeKind; cells: number[] }
  | { k: 'pick'; kind: PickKind; cell: number }
  | { k: 'spawn'; kind: PickKind; cell: number }
  | { k: 'expire'; cell: number }
  | { k: 'crab'; x: number; y: number }
  | { k: 'puff' } | { k: 'snap'; x: number; y: number }
  | { k: 'bump'; hero: number }
  | { k: 'tide'; left: number }
  | { k: 'join'; hero: number } | { k: 'swap' }
  | { k: 'win' } | { k: 'lose'; why: 'buckets' | 'tide' };

export interface Stats { score: number; time: number; claimed: number; bucketsLost: number; biggest: number; picks: number; stars: number; won: boolean }
export interface Opts { site: number; seed: number; assist?: boolean; twoP?: boolean; lead?: HeroId }

const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');

export class TambakGame {
  site: number; cfg: Site; rng: Rng; assist: boolean;
  grid = new Uint8Array(N);
  heroes: Hero[] = [];
  foes: Foe[] = [];
  picks: Pick[] = [];
  events: Ev[] = [];
  t = 0; tide: number; buckets = START_BUCKETS; score = 0; over: 'win' | 'lose' | null = null; why: 'buckets' | 'tide' | null = null;
  seaTotal = 0; land = 0; bucketsLost = 0; biggest = 0; pickCount = 0;
  kopiT = 0; netT = 0; pickT = 10; crabbed = false; nextId = 1; warned = new Set<number>();

  constructor(o: Opts) {
    this.site = o.site; this.cfg = SITES[o.site]; this.rng = new Rng(o.seed); this.assist = o.assist ?? true;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.grid[y * W + x] = x < RIM || y < RIM || x >= W - RIM || y >= H - RIM ? LAND : SEA;
    for (let i = 0; i < N; i++) if (this.grid[i] === SEA) this.seaTotal++;
    this.tide = this.cfg.tide * (this.assist ? ASSIST_TIDE : 1);
    this.addHero(o.lead ?? 'dora', 'p1');
    if (o.twoP) this.addHero(other(o.lead ?? 'dora'), 'p2');
    for (const k of this.cfg.foes) this.addFoe(k);
  }

  // ─────────────────────────────── helpers
  get target() { return this.assist ? ASSIST_TARGET : this.cfg.target; }
  /** the share of the original sea that is land now, 0 to 100 */
  get pct() { return (100 * this.land) / this.seaTotal; }
  speedMul() { return (this.assist ? ASSIST_FOE : 1) * (this.netT > 0 ? 0.5 : 1); }
  cellAt(x: number, y: number) { const cx = Math.floor(x), cy = Math.floor(y); return cx < 0 || cy < 0 || cx >= W || cy >= H ? LAND : this.grid[cy * W + cx]; }
  /** the spawn cell for player n: the middle of the bottom rim for p1, the top rim for p2 */
  private spawnCell(ctrl: 'p1' | 'p2') { return ctrl === 'p1' ? (H - 1) * W + (W >> 1) : W >> 1; }

  private addHero(id: HeroId, ctrl: 'p1' | 'p2') {
    const c = this.spawnCell(ctrl), x = c % W, y = (c / W) | 0;
    this.heroes.push({ id, ctrl, idx: this.heroes.length, x, y, px: x, py: y, mv: 0, face: ctrl === 'p1' ? 1 : 3, dir: 0, moving: false, trail: [], start: c, blink: BLINK, hurtT: 0, cheerT: 0, flagT: 0 });
  }
  private addFoe(kind: FoeKind) {
    const sp = FOES[kind];
    let x = 0, y = 0;
    if (kind === 'crab') {
      // on land, as far from every hero as the land allows
      let best = -1;
      for (let k = 0; k < 400; k++) {
        const c = this.rng.int(N); if (this.grid[c] !== LAND) continue;
        const cx = c % W, cy = (c / W) | 0;
        if (cx < 1 || cy < 1 || cx >= W - 1 || cy >= H - 1) continue;
        const d = Math.min(...this.heroes.map((h) => Math.abs(h.x - cx) + Math.abs(h.y - cy)));
        if (d > best) { best = d; x = cx + 0.5; y = cy + 0.5; }
      }
    } else {
      // in open sea, away from the rim and from the heroes
      for (let k = 0; k < 400; k++) {
        x = this.rng.range(RIM + 6, W - RIM - 6); y = this.rng.range(RIM + 5, H - RIM - 8);
        if (this.cellAt(x, y) !== SEA) continue;
        if (this.heroes.some((h) => Math.hypot(h.x - x, h.y - y) < 12)) continue;
        if (this.foes.some((f) => Math.hypot(f.x - x, f.y - y) < 5)) continue;
        break;
      }
    }
    const a = (this.rng.int(4) * 2 + 1) * Math.PI / 4 + this.rng.range(-0.25, 0.25);
    this.foes.push({ id: this.nextId++, kind, x, y, vx: Math.cos(a) * sp.speed, vy: Math.sin(a) * sp.speed, r: sp.r, t: this.rng.range(0, 3), puff: 0, snap: 0, dizzy: 0 });
  }

  /** player two joins mid-game on the top rim (or the bottom if player one stands there) */
  join() {
    if (this.heroes.length > 1 || this.over) return;
    const lead = this.heroes[0];
    this.addHero(other(lead.id), 'p2');
    this.events.push({ k: 'join', hero: 1 });
  }
  /** one player: trade places, so the other chinchilla takes the bucket where it stands */
  swap() { if (this.heroes.length === 1 && !this.over) { this.heroes[0].id = other(this.heroes[0].id); this.events.push({ k: 'swap' }); } }

  // ─────────────────────────────── the step
  step(d1: Dir = 0, d2: Dir = 0) {
    this.events = [];
    if (this.over) { for (const h of this.heroes) { h.cheerT += DT; } this.t += DT; return; }
    this.t += DT; this.tide -= DT;
    if (this.kopiT > 0) this.kopiT -= DT;
    if (this.netT > 0) this.netT -= DT;
    for (const s of [30, 10]) if (this.tide <= s && !this.warned.has(s)) { this.warned.add(s); this.events.push({ k: 'tide', left: s }); }
    this.moveFoes();
    this.hits();
    const dirs = [d1, d2];
    for (const h of this.heroes) this.moveHero(h, dirs[h.ctrl === 'p1' ? 0 : 1]);
    this.picksTick();
    if (this.cfg.crab && !this.crabbed && this.pct >= CRAB_AT) { this.crabbed = true; this.addFoe('crab'); const c = this.foes[this.foes.length - 1]; this.events.push({ k: 'crab', x: c.x, y: c.y }); }
    if (this.pct >= this.target) {
      this.over = 'win'; this.score += Math.round(Math.max(0, this.tide) * 20) + this.buckets * 500;
      this.events.push({ k: 'win' });
      for (const h of this.heroes) { h.trail = []; h.cheerT = 0.01; }
    } else if (this.tide <= 0) { this.lose('tide'); }
  }
  private lose(why: 'buckets' | 'tide') { this.over = 'lose'; this.why = why; this.events.push({ k: 'lose', why }); }

  private moveHero(h: Hero, d: Dir) {
    if (h.blink > 0) h.blink -= DT;
    if (h.hurtT > 0) h.hurtT -= DT;
    if (h.flagT > 0) h.flagT -= DT;
    h.dir = d;
    if (h.hurtT > 0.9) { h.moving = false; return; } // knocked back a moment
    if (!d) { h.moving = false; h.mv = 0; h.px = h.x; h.py = h.y; return; }
    h.face = d; h.moving = true;
    h.mv += (this.kopiT > 0 ? KOPI_SPEED : HERO_SPEED) * DT;
    while (h.mv >= 1) {
      h.mv -= 1;
      const nx = h.x + DX[d], ny = h.y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { h.mv = 0; break; }
      const c = ny * W + nx, v = this.grid[c];
      // a trail is a wall: your own (so you never undo it by turning back) and your partner's
      if (v >= TRAIL0) { h.mv = 0; this.events.push({ k: 'bump', hero: h.idx }); break; }
      h.px = h.x; h.py = h.y; h.x = nx; h.y = ny;
      if (v === SEA) {
        if (!h.trail.length) h.start = h.py * W + h.px;
        this.grid[c] = TRAIL0 + h.idx; h.trail.push(c);
        this.events.push({ k: 'pour', hero: h.idx, cell: c });
      } else if (h.trail.length) this.claim(h);
    }
  }

  /** the trail turns to land, then every pocket of sea with no creature in it fills in */
  private claim(h: Hero) {
    const trail = h.trail.length;
    const cells: number[] = [...h.trail];
    for (const c of h.trail) this.grid[c] = LAND;
    h.trail = [];
    const live = new Uint8Array(N), stack: number[] = [];
    const seed = (c: number) => { if (c >= 0 && c < N && this.grid[c] === SEA && !live[c]) { live[c] = 1; stack.push(c); } };
    for (const f of this.foes) {
      if (!FOES[f.kind].sea) continue;
      const fx = Math.floor(f.x), fy = Math.floor(f.y), R = Math.ceil(f.r);
      // the creature's own cell, or the sea right around it if it is brushing a wall
      seed(fy * W + fx);
      if (!stack.length || this.grid[fy * W + fx] !== SEA) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const x = fx + dx, y = fy + dy; if (x >= 0 && y >= 0 && x < W && y < H) seed(y * W + x); }
      while (stack.length) {
        const c = stack.pop()!, x = c % W;
        if (x > 0) seed(c - 1); if (x < W - 1) seed(c + 1); seed(c - W); seed(c + W);
      }
    }
    for (let i = 0; i < N; i++) if (this.grid[i] === SEA && !live[i]) { this.grid[i] = LAND; cells.push(i); }
    this.land += cells.length;
    this.biggest = Math.max(this.biggest, cells.length);
    // a big fill pays more than a handful of little ones
    this.score += cells.length * 10 + (cells.length > 150 ? (cells.length - 150) * 5 : 0);
    const got: PickKind[] = [];
    this.picks = this.picks.filter((p) => { if (this.grid[p.cell] !== LAND) return true; this.collect(p); got.push(p.kind); return false; });
    h.flagT = 0.6;
    this.events.push({ k: 'claim', hero: h.idx, cells, trail, picks: got });
  }

  private collect(p: Pick) {
    this.pickCount++; this.score += 250;
    if (p.kind === 'kopi') this.kopiT = POWER_TIME;
    if (p.kind === 'net') this.netT = POWER_TIME;
    if (p.kind === 'bucket') this.buckets = Math.min(5, this.buckets + 1);
    this.events.push({ k: 'pick', kind: p.kind, cell: p.cell });
  }

  private picksTick() {
    for (const p of this.picks) p.t -= DT;
    this.picks = this.picks.filter((p) => { if (p.t > 0) return true; this.events.push({ k: 'expire', cell: p.cell }); return false; });
    this.pickT -= DT;
    if (this.pickT > 0 || this.picks.length) return;
    this.pickT = this.rng.range(12, 18);
    for (let k = 0; k < 200; k++) {
      const c = this.rng.int(N); if (this.grid[c] !== SEA) continue;
      const x = c % W + 0.5, y = ((c / W) | 0) + 0.5;
      if (this.foes.some((f) => Math.hypot(f.x - x, f.y - y) < 6)) continue;
      const kinds: PickKind[] = this.buckets < START_BUCKETS ? ['bucket', 'kopi', 'net'] : ['kopi', 'net', 'kopi', 'net', 'bucket'];
      const kind = kinds[this.rng.int(kinds.length)];
      this.picks.push({ id: this.nextId++, kind, cell: c, t: 15 });
      this.events.push({ k: 'spawn', kind, cell: c });
      return;
    }
  }

  private moveFoes() {
    const mul = this.speedMul();
    for (const f of this.foes) {
      f.t += DT;
      if (f.snap > 0) f.snap -= DT;
      if (f.dizzy > 0) f.dizzy -= DT;
      const sp = FOES[f.kind];
      if (f.kind === 'puffer') {
        // deflated 3 s, puffs up over 0.6 s, stays big 1.6 s, lets go over 0.6 s
        const c = f.t % 5.8, was = f.puff;
        f.puff = c < 3 ? 0 : c < 3.6 ? (c - 3) / 0.6 : c < 5.2 ? 1 : 1 - (c - 5.2) / 0.6;
        if (was === 0 && f.puff > 0) this.events.push({ k: 'puff' });
        f.r = sp.r + 0.9 * f.puff;
      }
      let speed = sp.speed * mul * (f.kind === 'puffer' ? 1 - 0.5 * f.puff : 1);
      if (f.kind === 'boss') {
        // Captain Bakau smells sand: every half second she turns toward the nearest trail cell
        let best = Infinity, tx = 0, ty = 0;
        for (const h of this.heroes) for (const c of h.trail) { const x = c % W + 0.5, y = ((c / W) | 0) + 0.5, d = Math.hypot(x - f.x, y - f.y); if (d < best) { best = d; tx = x; ty = y; } }
        if (best < Infinity) {
          const want = Math.atan2(ty - f.y, tx - f.x), now = Math.atan2(f.vy, f.vx);
          let dA = want - now; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
          const a = now + Math.max(-1.6 * DT, Math.min(1.6 * DT, dA));
          const m = Math.hypot(f.vx, f.vy); f.vx = Math.cos(a) * m; f.vy = Math.sin(a) * m;
          f.puff = Math.min(1, f.puff + DT * 2);
        } else f.puff = Math.max(0, f.puff - DT);
        speed *= 1 + 0.3 * f.puff;
      }
      const m = Math.hypot(f.vx, f.vy) || 1;
      const vx = (f.vx / m) * speed, vy = (f.vy / m) * speed;
      // sub-steps of at most a quarter cell, so nothing fast skips over a one-cell trail
      const steps = Math.max(1, Math.ceil((speed * DT) / 0.25));
      for (let s = 0; s < steps; s++) {
        const sx = (vx * DT) / steps, sy = (vy * DT) / steps;
        if (this.blocked(f, f.x + sx + Math.sign(sx) * f.r, f.y)) f.vx = -f.vx; else f.x += sx;
        if (this.blocked(f, f.x, f.y + sy + Math.sign(sy) * f.r)) f.vy = -f.vy; else f.y += sy;
        if (Math.sign(f.vx) !== Math.sign(vx) || Math.sign(f.vy) !== Math.sign(vy)) break;
      }
      // never let a puffed-up or brushing creature sink into a wall: nudge it back toward open water
      if (sp.sea && this.cellAt(f.x, f.y) === LAND) this.unstick(f);
    }
  }
  /** sea creatures turn at land, the crab turns at the water's edge (trails count as water for it) */
  private blocked(f: Foe, x: number, y: number) {
    const v = this.cellAt(x, y);
    return FOES[f.kind].sea ? v === LAND : v !== LAND;
  }
  private unstick(f: Foe) {
    const fx = Math.floor(f.x), fy = Math.floor(f.y);
    for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (this.cellAt(fx + dx + 0.5, fy + dy + 0.5) === LAND) continue;
      f.x = fx + dx + 0.5; f.y = fy + dy + 0.5; return;
    }
  }

  private hits() {
    for (const h of this.heroes) {
      if (h.blink > 0) continue;
      for (const f of this.foes) {
        let hit = false;
        if (FOES[f.kind].sea) {
          if (!h.trail.length) continue;
          const R = Math.ceil(f.r + 0.5), fx = Math.floor(f.x), fy = Math.floor(f.y), mine = TRAIL0 + h.idx;
          for (let dy = -R; dy <= R && !hit; dy++) for (let dx = -R; dx <= R && !hit; dx++) {
            const x = fx + dx, y = fy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
            if (this.grid[y * W + x] === mine && Math.hypot(x + 0.5 - f.x, y + 0.5 - f.y) < f.r + 0.4) hit = true;
          }
        } else hit = Math.hypot(h.x + 0.5 - f.x, h.y + 0.5 - f.y) < f.r + 0.4;
        if (hit) { this.hurt(h, f); break; }
      }
    }
  }
  private hurt(h: Hero, f: Foe) {
    const cells = [...h.trail];
    for (const c of h.trail) this.grid[c] = SEA;
    h.trail = [];
    const x = h.x, y = h.y;
    h.x = h.start % W; h.y = (h.start / W) | 0; h.px = h.x; h.py = h.y; h.mv = 0;
    h.blink = BLINK; h.hurtT = 1.1;
    if (f.kind === 'croc' || f.kind === 'boss') { f.snap = 0.5; this.events.push({ k: 'snap', x: f.x, y: f.y }); }
    this.buckets--; this.bucketsLost++;
    this.events.push({ k: 'hurt', hero: h.idx, x, y, foe: f.kind, cells });
    if (this.buckets <= 0) this.lose('buckets');
  }

  stats(): Stats {
    const won = this.over === 'win';
    const stars = won ? 1 + (this.bucketsLost === 0 ? 1 : 0) + (this.t <= this.cfg.par ? 1 : 0) : 0;
    return { score: this.score, time: this.t, claimed: Math.round(this.pct), bucketsLost: this.bucketsLost, biggest: this.biggest, picks: this.pickCount, stars, won };
  }
}

// ─────────────────────────────── the save
export interface SaveData { v: 1; stars: number[]; best: number[]; assist: boolean; sound: boolean; music: boolean; lead: HeroId }
export const freshSave = (): SaveData => ({ v: 1, stars: SITES.map(() => 0), best: SITES.map(() => 0), assist: true, sound: true, music: true, lead: 'dora' });
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
      assist: s.assist !== false, sound: s.sound !== false, music: s.music !== false, lead: s.lead === 'enzo' ? 'enzo' : 'dora',
    };
  } catch { return null; }
}
export const siteOpen = (s: SaveData, i: number) => i === 0 || s.stars[i - 1] > 0;
export function record(s: SaveData, site: number, st: Stats): SaveData {
  const n = { ...s, stars: [...s.stars], best: [...s.best] };
  n.stars[site] = Math.max(n.stars[site], st.stars); if (st.stars > 0) n.best[site] = Math.max(n.best[site], st.score);
  return n;
}

// ─────────────────────────────── a human-paced bot, for the tests and the attract mode
type Trip = { walk: number[]; sea: number[] };
const nbrs = (c: number) => { const x = c % W; return [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c < N - W ? c + W : -1]; };

/** Plays like a careful person. It looks again only every 200 to 300 ms. On land it chooses a trip: a launch point on
 *  the shore and a shape to pour from it, either a straight line across to the far shore or a box out and back,
 *  picking the one that claims the most land per second and that it judges no creature can reach in time (it reads
 *  their bounces off the shore the way a player does). In the sea it runs for the nearest land when a creature gets
 *  close to its trail. `careless` turns every safety check off, which loses. */
export class Bot {
  rng: Rng; skill: number; careless: boolean;
  plan: number[] = []; think = 0; mode: 'walk' | 'out' | 'home' = 'walk'; sea: number[] = [];
  constructor(seed: number, skill = 0.8, careless = false) { this.rng = new Rng(seed ^ 0x5eed); this.skill = skill; this.careless = careless; }

  input(g: TambakGame, h: Hero): Dir {
    if (g.over) return 0;
    if (h.hurtT > 0) { this.plan = []; this.sea = []; this.mode = 'walk'; return 0; }
    const at = h.y * W + h.x;
    this.think -= DT;
    const look = this.think <= 0;
    if (look) {
      this.think = this.rng.range(0.2, 0.3) / Math.max(0.5, this.skill);
      if (h.trail.length && !this.careless && this.mode !== 'home' && this.danger(g, h)) { this.plan = this.toLand(g, h); this.sea = []; this.mode = 'home'; }
      if (!h.trail.length && this.mode !== 'walk') { this.mode = 'walk'; this.plan = []; this.sea = []; }
      if (!h.trail.length && g.foes.some((f) => f.kind === 'crab' && Math.hypot(f.x - h.x - 0.5, f.y - h.y - 0.5) < 5)) { this.plan = []; this.sea = []; }
    }
    while (this.plan.length && this.plan[0] === at) this.plan.shift();
    if (!this.plan.length) {
      if (this.mode === 'walk') {
        if (this.sea.length) {
          // one more look at the water from the shore; if the trip is no longer safe, wait and choose again
          if (!this.careless && !this.safe(g, this.sea, 0)) { this.sea = []; this.think = Math.max(this.think, 0.25); return 0; }
          this.plan = this.sea; this.sea = []; this.mode = 'out';
        } else if (look || !this.careless) {
          const t = this.choose(g, h);
          if (!t) return 0;
          this.plan = t.walk; this.sea = t.sea;
          if (!this.plan.length) return 0;
        }
      } else if (h.trail.length) { this.plan = this.toLand(g, h); this.mode = 'home'; }
    }
    const nx = this.plan[0];
    if (nx === undefined) return 0;
    const tx = nx % W, ty = (nx / W) | 0;
    if (Math.abs(tx - h.x) + Math.abs(ty - h.y) !== 1 || g.grid[nx] >= TRAIL0) {
      this.plan = h.trail.length ? this.toLand(g, h) : []; this.sea = [];
      if (h.trail.length) this.mode = 'home';
      return 0;
    }
    return tx > h.x ? 2 : tx < h.x ? 4 : ty > h.y ? 3 : 1;
  }

  /** a creature that could reach the trail before the hero can get back to land, plus a reaction margin */
  private danger(g: TambakGame, h: Hero) {
    const home = this.toLand(g, h).length / HERO_SPEED + 0.35 + (1 - this.skill) * 0.3;
    const mul = g.speedMul();
    for (const f of g.foes) {
      if (!FOES[f.kind].sea) continue;
      const sp = FOES[f.kind].speed * mul * (f.kind === 'boss' ? 1.3 : 1);
      let near = Infinity;
      for (const c of [...h.trail, h.y * W + h.x]) near = Math.min(near, Math.hypot(c % W + 0.5 - f.x, ((c / W) | 0) + 0.5 - f.y));
      const gap = near - f.r - 0.5 - (f.kind === 'puffer' ? 0.9 : 0);
      if (gap / sp < home + 0.25) return true;
    }
    return false;
  }

  /** follows every sea creature forward, bouncing off the land, for as long as the trip takes, and checks none of them
   *  comes near a cell after it has been poured. Captain Bakau is assumed to swim straight for the trail. */
  private safe(g: TambakGame, sea: number[], t0: number) {
    const spd = HERO_SPEED, T = t0 + sea.length / spd + 0.5, mul = g.speedMul(), step = 0.06;
    const xs = sea.map((c) => c % W + 0.5), ys = sea.map((c) => ((c / W) | 0) + 0.5);
    for (const f of g.foes) {
      if (!FOES[f.kind].sea) continue;
      const sp = FOES[f.kind].speed * mul * (f.kind === 'boss' ? 1.3 : 1);
      // a less skilled eye leaves less room and misjudges the heading a little
      const R = f.r + 0.4 + 0.9 * this.skill + (f.kind === 'puffer' ? 0.9 : 0) + (f.kind === 'boss' ? 1.5 : 0);
      const a = Math.atan2(f.vy, f.vx) + this.rng.range(-1, 1) * (1 - this.skill) * 0.6;
      let x = f.x, y = f.y, vx = Math.cos(a), vy = Math.sin(a);
      for (let t = 0; t <= T; t += step) {
        if (f.kind === 'boss' && t > t0) {
          // she homes on the nearest poured cell
          const k = Math.min(sea.length - 1, Math.floor((t - t0) * spd)); let bd = Infinity, bx = 0, by = 0;
          for (let i = 0; i <= k; i++) { const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2; if (d < bd) { bd = d; bx = xs[i]; by = ys[i]; } }
          const dd = Math.sqrt(bd) || 1; vx = (bx - x) / dd; vy = (by - y) / dd;
        }
        const nx = x + vx * sp * step, ny = y + vy * sp * step;
        if (g.cellAt(nx + Math.sign(vx) * f.r, y) === LAND) vx = -vx; else x = nx;
        if (g.cellAt(x, ny + Math.sign(vy) * f.r) === LAND) vy = -vy; else y = ny;
        const k = Math.min(sea.length - 1, Math.floor(Math.max(0, t - t0) * spd));
        if (t < t0) continue;
        for (let i = 0; i <= k; i++) if (Math.abs(xs[i] - x) < R && Math.abs(ys[i] - y) < R && Math.hypot(xs[i] - x, ys[i] - y) < R) return false;
      }
    }
    return true;
  }

  /** shortest way to land through open sea */
  private toLand(g: TambakGame, h: Hero): number[] {
    const from = h.y * W + h.x, prev = new Int32Array(N).fill(-1), q = [from]; prev[from] = from;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      if (c !== from && g.grid[c] === LAND) { const p: number[] = []; for (let k = c; k !== from; k = prev[k]) p.push(k); return p.reverse(); }
      for (const n of nbrs(c)) { if (n < 0 || prev[n] >= 0 || g.grid[n] >= TRAIL0) continue; prev[n] = c; q.push(n); }
    }
    return [];
  }

  /** how many cells a trip would turn into land: its own cells plus every creature-free pocket it closes */
  private value(g: TambakGame, sea: number[]) {
    const grid = g.grid.slice(); for (const c of sea) grid[c] = LAND;
    const live = new Uint8Array(N), st: number[] = [];
    for (const f of g.foes) {
      if (!FOES[f.kind].sea) continue;
      const c0 = Math.floor(f.y) * W + Math.floor(f.x);
      if (grid[c0] === SEA && !live[c0]) { live[c0] = 1; st.push(c0); }
      while (st.length) { const c = st.pop()!; for (const n of nbrs(c)) if (n >= 0 && grid[n] === SEA && !live[n]) { live[n] = 1; st.push(n); } }
    }
    let v = sea.length; for (let i = 0; i < N; i++) if (grid[i] === SEA && !live[i]) v++;
    return v;
  }

  /** walk the shore to a launch point, then pour a line across or a box out and back */
  private choose(g: TambakGame, h: Hero): Trip | null {
    const from = h.y * W + h.x, dist = new Int32Array(N).fill(-1), prev = new Int32Array(N).fill(-1), q = [from]; dist[from] = 0;
    const crabs = g.foes.filter((f) => f.kind === 'crab');
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      for (const n of nbrs(c)) {
        if (n < 0 || dist[n] >= 0 || g.grid[n] !== LAND) continue;
        if (crabs.some((f) => Math.hypot(f.x - (n % W) - 0.5, f.y - ((n / W) | 0) - 0.5) < 3)) continue;
        dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
      }
    }
    const shore = q.filter((c) => nbrs(c).some((n) => n >= 0 && g.grid[n] === SEA));
    if (!shore.length) return null;
    let best: { score: number; c: number; sea: number[] } | null = null;
    const tries = this.careless ? 24 : 40;
    for (let k = 0; k < tries; k++) {
      const c = shore[this.rng.int(shore.length)], x = c % W, y = (c / W) | 0;
      for (const d of [1, 2, 3, 4] as Dir[]) {
        const s0x = x + DX[d], s0y = y + DY[d];
        if (s0x < 0 || s0y < 0 || s0x >= W || s0y >= H || g.grid[s0y * W + s0x] !== SEA) continue;
        let run = 0, px = s0x, py = s0y;
        while (px >= 0 && py >= 0 && px < W && py < H && g.grid[py * W + px] === SEA) { run++; px += DX[d]; py += DY[d]; }
        const lands = px >= 0 && py >= 0 && px < W && py < H && g.grid[py * W + px] === LAND;
        const shapes: number[][] = [];
        // a straight line to the far shore
        if (lands && run <= (this.careless ? 60 : 34)) { const s: number[] = []; for (let i = 1; i <= run; i++) s.push((y + DY[d] * i) * W + x + DX[d] * i); shapes.push(s); }
        // a box: out, across, back to land
        const depth = Math.min(run - 1, Math.round(this.rng.range(3, this.careless ? 16 : 10)));
        if (depth >= 2) {
          const side: Dir = this.rng.next() < 0.5 ? ((d % 4) + 1) as Dir : (((d + 2) % 4) + 1) as Dir;
          const width = Math.round(this.rng.range(3, this.careless ? 24 : 14));
          const s: number[] = []; let cx = x, cy = y, ok = true;
          const go = (dd: Dir, n: number, untilLand: boolean) => {
            for (let i = 0; i < n && ok; i++) {
              cx += DX[dd]; cy += DY[dd];
              if (cx < 0 || cy < 0 || cx >= W || cy >= H) { ok = false; return; }
              const v = g.grid[cy * W + cx];
              if (v === LAND) { if (untilLand) return; ok = false; return; }
              if (v !== SEA) { ok = false; return; }
              s.push(cy * W + cx);
            }
            if (untilLand) ok = false;
          };
          go(d, depth, false); go(side, width, false); go(((d + 1) % 4 + 1) as Dir, depth + 3, true);
          if (ok && s.length) shapes.push(s);
        }
        for (const s of shapes) {
          const v = this.value(g, s);
          const score = v / (dist[c] + s.length * 1.2 + 10) * this.rng.range(0.85, 1.15);
          if (best && score <= best.score) continue;
          if (!this.careless && !this.safe(g, s, dist[c] / HERO_SPEED)) continue;
          best = { score, c, sea: s };
        }
      }
    }
    if (!best) {
      // nowhere safe right now: stroll a few steps along the shore and look again
      const c = shore[this.rng.int(shore.length)];
      const path: number[] = []; for (let k = c; k !== from && k >= 0; k = prev[k]) path.push(k);
      return { walk: path.reverse().slice(0, 5), sea: [] };
    }
    const path: number[] = []; for (let k = best.c; k !== from && k >= 0; k = prev[k]) path.push(k);
    return { walk: path.reverse(), sea: best.sea };
  }
}
