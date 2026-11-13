// Above & Below: the current room's collision grid (built from the room's geometry), the diggable and hidden soil, and
// the water in a basin. Every room is one painting, 1536×1024 world units; the camera scrolls inside it. Pure: no DOM.
export const WW = 1536, WH = 1024, CELL = 8, GW = WW / CELL, GH = WH / CELL;

/** cell values: 0 air, 1 solid, 2 soft soil (Enzo digs it), 3 hidden soft (solid until a stamp above reveals it) */
export type Cell = 0 | 1 | 2 | 3;
export interface Geo {
  ground(x: number): number;
  caves: [number, number, number, number][];
  soft?(x: number, y: number): boolean;
  hidden?(x: number, y: number): boolean;
  solid?(x: number, y: number): boolean;
}
/** what the world needs from the game: randomness, particles and sounds */
export interface Host { rnd(): number; fx(kind: FxKind, x: number, y: number, n?: number): void; sfx(id: string, a?: number): void }
export type FxKind = 'crumb' | 'dust' | 'splash' | 'drop' | 'leaves' | 'stars' | 'confetti' | 'mote' | 'sift';

export class World {
  grid = new Uint8Array(GW * GH);
  revealT = new Float32Array(GW * GH);
  geo: Geo | null = null;
  /** bumped whenever the soil changes, so the scene can redraw its soil layer */
  version = 0;
  timer = 0;
  revealed = 0;
  water = new Water();
  constructor(private host: Host) {}

  build(geo: Geo) {
    this.geo = geo;
    const { grid, revealT } = this;
    for (let b = 0; b < GH; b++) for (let a = 0; a < GW; a++) {
      const x = a * CELL + 4, y = b * CELL + 4;
      let v: Cell = y >= geo.ground(x) ? 1 : 0;
      for (const c of geo.caves) if (x >= c[0] && x < c[2] && y >= c[1] && y < c[3]) v = 0;
      if (v === 0 && geo.soft && geo.soft(x, y)) v = 2;
      if (geo.hidden && geo.hidden(x, y)) v = 3;
      if (geo.solid && geo.solid(x, y)) v = 1;
      grid[b * GW + a] = v; revealT[b * GW + a] = 0;
    }
    this.timer = 0; this.version++;
  }
  groundY(x: number) { return this.geo ? this.geo.ground(x) : 375; }
  cellAt(x: number, y: number): number {
    const a = Math.floor(x / CELL), b = Math.floor(y / CELL);
    if (a < 0 || a >= GW) return 1;
    if (b < 0) return 0;
    if (b >= GH) return 1;
    return this.grid[b * GW + a];
  }
  fillRect(x0: number, y0: number, x1: number, y1: number, v: Cell) {
    for (let y = y0; y < y1; y += CELL) for (let x = x0; x < x1; x += CELL) {
      const a = Math.floor(x / CELL), b = Math.floor(y / CELL);
      if (a >= 0 && a < GW && b >= 0 && b < GH) this.grid[b * GW + a] = v;
    }
    this.version++;
  }
  clearRect(x0: number, y0: number, x1: number, y1: number) { this.fillRect(x0, y0, x1, y1, 0); }

  /** dig a round hole of soft soil; returns how many cells came away */
  dig(px: number, py: number, r: number) {
    let n = 0;
    for (let y = py - r; y <= py + r; y += CELL) for (let x = px - r; x <= px + r; x += CELL) {
      if ((x - px) ** 2 + (y - py) ** 2 > r * r) continue;
      const a = Math.floor(x / CELL), b = Math.floor(y / CELL);
      if (a < 0 || a >= GW || b < 0 || b >= GH) continue;
      const i = b * GW + a;
      if (this.grid[i] === 2) { this.grid[i] = 0; this.revealT[i] = 0; n++; this.host.fx('crumb', a * CELL + 4, b * CELL + 4, 2); }
    }
    if (n) this.version++;
    return n;
  }
  /** a stamp above shakes the hidden seam below into view for a few seconds */
  reveal(x0: number, x1: number, secs: number) {
    let n = 0;
    for (let b = 0; b < GH; b++) for (let a = Math.floor(x0 / CELL); a <= Math.floor(x1 / CELL); a++) {
      if (a < 0 || a >= GW) continue;
      const i = b * GW + a;
      if (this.grid[i] === 3) { this.grid[i] = 2; this.revealT[i] = secs; n++; }
      else if (this.grid[i] === 2 && this.revealT[i] > 0) { this.revealT[i] = secs; n++; }
    }
    if (n) this.version++;
    return n;
  }
  /** loose dirt with air under it tumbles down and crumbles away (it never piles into a new wall) */
  private settle() {
    const { grid, revealT, host } = this;
    let moved = false;
    for (let b = GH - 2; b >= 0; b--) for (let a = 0; a < GW; a++) {
      const i = b * GW + a;
      if (grid[i] !== 2 || grid[i + GW] !== 0 || revealT[i] > 0) continue;
      grid[i] = 0; moved = true;
      if (host.rnd() < 0.6) host.fx('crumb', a * CELL + 4, b * CELL + 8, 1);
    }
    if (moved) { this.version++; if (host.rnd() < 0.3) host.sfx('crumble'); }
  }
  update(dt: number) {
    this.timer += dt;
    while (this.timer > 0.09) { this.timer -= 0.09; this.settle(); }
    const { grid, revealT } = this;
    let n = 0;
    for (let i = 0; i < grid.length; i++) if (revealT[i] > 0) {
      revealT[i] -= dt; n++;
      if (revealT[i] <= 0) { revealT[i] = 0; if (grid[i] === 2) { grid[i] = 3; this.version++; } }
    }
    this.revealed = n;
    this.water.update(dt, this.host);
  }
  count(x0: number, x1: number, y0: number, y1: number, v = 2) {
    let n = 0;
    for (let y = y0; y < y1; y += CELL) for (let x = x0; x < x1; x += CELL) if (this.cellAt(x, y) === v) n++;
    return n;
  }
  /** feet at (x, y): true if any solid or soft cell overlaps the box */
  boxHits(x: number, y: number, w: number, h: number) {
    for (let yy = y - h; yy < y - 1; yy += CELL / 2) for (let xx = x - w / 2; xx <= x + w / 2; xx += CELL / 2) if (this.cellAt(xx, yy)) return true;
    for (let xx = x - w / 2; xx <= x + w / 2; xx += CELL / 2) if (this.cellAt(xx, y - 1)) return true;
    return false;
  }
}

/** a level that rises (and drains) inside one basin of the current room */
export class Water {
  level = 9999; target = 9999; flowing = false; rate = 52; drain = 20;
  rect: [number, number, number, number] | null = null;
  fall: number[] | null = null;
  set(rect: [number, number, number, number] | null, fall: number[] | null = null) {
    this.rect = rect; this.fall = fall; this.level = rect ? rect[3] + 4 : 9999; this.target = this.level; this.flowing = false; this.rate = 52; this.drain = 20;
  }
  update(dt: number, host: Host) {
    if (!this.rect) return;
    if (this.level > this.target) this.level = Math.max(this.target, this.level - this.rate * dt);
    else if (this.level < this.target) this.level = Math.min(this.target, this.level + this.drain * dt);
    if (this.flowing && this.fall && host.rnd() < 0.5) host.fx('splash', this.fall[0] + (host.rnd() - 0.5) * 26, this.level, 1);
  }
  inWater(x: number, y: number) { const r = this.rect; return !!r && x > r[0] && x < r[2] && y > this.level; }
}
