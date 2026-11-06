// Misprint: the drawing. Canvas 2D, a real two-ink risograph look: each plate (pink, teal, and the yellow key plate) is
// drawn in flat ink from the Codex-painted tile masks into its own offscreen canvas, given riso grain (paper specks
// knocked out of the ink, a halftone dot shadow under every block, uneven density), and composited onto the painted
// paper with `multiply`, so pink over teal genuinely darkens; a final screen pass warms that overlap into the deep riso
// purple. The two plates sit a few pixels out of register, and a shift slides a plate with a little ink-smear wobble.
// Chinchillas are the painted one-ink sprites, printed into their own plate's layer (so Dora walking through teal
// prints purple, like everything else pink). Drawing only: the rules are in misprint-game.ts.
import { type Page, type State, type Who, type Action, type Step, plateAt, revealed, K_BLOCK, K_LADDER, K_STAMP, K_HIDDEN, K_MARK, F_UP, F_RIGHT, F_DOWN, F_LEFT } from './misprint-game';

export const INK = { pink: '#ff48b0', teal: '#00838a', yellow: '#ffe14a', purple: '#5b1f78', paper: '#f6eedf' } as const;
const PLATE_INK = [INK.pink, INK.teal];
const ART = '/art/misprint/';
const SPRITE = 200, TILE = 160;
const T_BLOCKS = [0, 1, 2], T_LADDER = 3, T_STAPLE = 4, T_DROP = 5, T_STAMP = 6, T_FOLD = 7;
const F_IDLE = 0, F_WALK = [1, 2], F_FALL = 3, F_CHEER = 4, F_PUSH = 5;

type Img = HTMLImageElement | HTMLCanvasElement;
type Anim = {
  t0: number; dur: number;
  paths: [[number, number][], [number, number][]];
  offFrom: [[number, number], [number, number]]; offTo: [[number, number], [number, number]];
  shift: Who | null; segT: number[]; kind: Step extends { kind: infer K } ? K : string;
};
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ease = (t: number) => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error(`missing ${src}`)); i.src = src; });
}
function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
/** one mask frame from a strip, tinted with an ink */
function tint(src: Img, frame: number, size: number, color: string): HTMLCanvasElement {
  const c = canvas(size, size), g = c.getContext('2d')!;
  g.drawImage(src, frame * size, 0, size, size, 0, 0, size, size);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, size, size);
  return c;
}

export class MisprintScene {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private w = 1; private h = 1; private dpr = 1;
  private paper: HTMLImageElement | null = null;
  private sprites: [HTMLCanvasElement[], HTMLCanvasElement[]] = [[], []];
  private tiles: Record<string, HTMLCanvasElement[]> = {};
  private pg: Page | null = null; private st: State | null = null;
  private plates: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
  private hidden: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
  private yellowC: HTMLCanvasElement | null = null; private foldC: HTMLCanvasElement | null = null;
  private layer: [HTMLCanvasElement, HTMLCanvasElement] | null = null; private over: HTMLCanvasElement | null = null;
  private cell = 40; private ox = 0; private oy = 0;
  private anim: Anim | null = null;
  private wobble: { who: Who; t0: number; dx: number; dy: number } | null = null;
  private revealT: [number, number] = [0, 0];
  private facing: [number, number] = [1, 1];
  private cheer = 0; private hintA: Action | null = null; private dropGone = 0;
  reduced = false; loaded = false;

  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.g = cv.getContext('2d')!; }

  async load() {
    const [paper, dora, enzo, tiles] = await Promise.all([loadImg(`${ART}paper.webp`), loadImg(`${ART}dora.webp`), loadImg(`${ART}enzo.webp`), loadImg(`${ART}tiles.webp`)]);
    this.paper = paper;
    this.sprites = [0, 1].map((c) => Array.from({ length: 6 }, (_, f) => tint(c ? enzo : dora, f, SPRITE, PLATE_INK[c]))) as [HTMLCanvasElement[], HTMLCanvasElement[]];
    for (const [k, col] of Object.entries({ pink: INK.pink, teal: INK.teal, yellow: INK.yellow, metal: '#4b4660', purple: INK.purple, fold: '#b9a98f' }))
      this.tiles[k] = Array.from({ length: 8 }, (_, f) => tint(tiles, f, TILE, col));
    this.loaded = true;
    if (this.pg) this.build();
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    this.w = w; this.h = h;
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    if (this.pg) this.build();
  }

  /** a new page: lay out the grid in the canvas and print the plates */
  setPage(pg: Page, st: State) {
    this.pg = pg; this.st = st; this.anim = null; this.wobble = null; this.cheer = 0; this.hintA = null; this.facing = [1, 1]; this.dropGone = 0;
    const rv = revealed(pg, st, {}); this.revealT = [rv[0] ? 1 : 0, rv[1] ? 1 : 0];
    this.build();
  }
  private layout() {
    const pg = this.pg!; const m = 0.5;
    this.cell = Math.max(8, Math.floor(Math.min(this.w / (pg.w + m * 2), this.h / (pg.h + m * 2))));
    this.ox = Math.round((this.w - pg.w * this.cell) / 2); this.oy = Math.round((this.h - pg.h * this.cell) / 2);
  }
  private build() {
    if (!this.pg || !this.loaded) return;
    this.layout();
    const pg = this.pg, s = this.cell * this.dpr, W = Math.ceil(pg.w * s), H = Math.ceil(pg.h * s);
    this.plates = [this.printPlate(0, s, false), this.printPlate(1, s, false)];
    this.hidden = [this.printPlate(0, s, true), this.printPlate(1, s, true)];
    // the key plate and the folds are printed on the paper itself
    const y = canvas(W, H), yg = y.getContext('2d')!;
    const f = canvas(W, H), fg = f.getContext('2d')!;
    for (let cy = 0; cy < pg.h; cy++) for (let cx = 0; cx < pg.w; cx++) {
      const i = cy * pg.w + cx;
      if (pg.yellow[i]) this.block(yg, this.tiles.yellow, cx, cy, s, 7);
      if (pg.fold[i]) {
        const rot = { [F_DOWN]: 0, [F_LEFT]: Math.PI / 2, [F_UP]: Math.PI, [F_RIGHT]: -Math.PI / 2 }[pg.fold[i]] ?? 0;
        fg.save(); fg.translate((cx + 0.5) * s, (cy + 0.5) * s); fg.rotate(rot); fg.globalAlpha = 0.95;
        fg.drawImage(this.tiles.fold[T_FOLD], -s * 0.48, -s * 0.48, s * 0.96, s * 0.96); fg.restore();
      }
    }
    this.grain(yg, W, H, 11);
    this.yellowC = y; this.foldC = f;
    const full = () => canvas(this.w * this.dpr, this.h * this.dpr);
    this.layer = [full(), full()]; this.over = full();
  }
  private block(g: CanvasRenderingContext2D, set: HTMLCanvasElement[], x: number, y: number, s: number, seed: number) {
    const v = T_BLOCKS[Math.floor(hash(x, y, seed) * 3)], k = 1.08 + hash(x, y, seed + 1) * 0.05;
    const flip = hash(x, y, seed + 2) < 0.5;
    g.save(); g.translate((x + 0.5) * s, (y + 0.5) * s); if (flip) g.scale(-1, 1); if (hash(x, y, seed + 3) < 0.5) g.rotate(Math.PI);
    g.drawImage(set[v], -s * k / 2, -s * k / 2, s * k, s * k); g.restore();
  }
  /** riso grain: specks of paper knocked out of the ink, and uneven density in soft blotches */
  private grain(g: CanvasRenderingContext2D, W: number, H: number, seed: number) {
    g.save(); g.globalCompositeOperation = 'destination-out';
    const n = Math.floor(W * H / 260);
    for (let i = 0; i < n; i++) { const r = hash(i, seed, 1); const x = hash(i, seed, 2) * W, y = hash(i, seed, 3) * H; g.globalAlpha = 0.25 + r * 0.6; g.fillRect(x, y, 1 + r * 1.6 * this.dpr, 1 + hash(i, seed, 4) * 1.4 * this.dpr); }
    for (let i = 0; i < 9; i++) {
      const x = hash(i, seed, 5) * W, y = hash(i, seed, 6) * H, r = (0.15 + hash(i, seed, 7) * 0.3) * Math.max(W, H);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }
  /** one plate at plate-local coordinates (the page's own cells at offset 0), in its flat ink */
  private printPlate(p: Who, s: number, hiddenOnly: boolean): HTMLCanvasElement {
    const pg = this.pg!, W = Math.ceil(pg.w * s), H = Math.ceil(pg.h * s);
    const c = canvas(W, H), g = c.getContext('2d')!; const set = this.tiles[p ? 'teal' : 'pink'];
    const ink = PLATE_INK[p];
    // a halftone dot shadow under the blocks, in the same ink
    if (!hiddenOnly) {
      const sh = canvas(W, H), sg = sh.getContext('2d')!;
      for (let y = 0; y < pg.h; y++) for (let x = 0; x < pg.w; x++) { const k = pg.plate[p][y * pg.w + x]; if (k === K_BLOCK || k === K_STAMP) sg.fillRect((x + 0.16) * s, (y + 0.2) * s, s, s); }
      sg.globalCompositeOperation = 'source-in';
      const dot = canvas(8 * this.dpr, 8 * this.dpr), dg = dot.getContext('2d')!; dg.fillStyle = ink; dg.beginPath(); dg.arc(2 * this.dpr, 2 * this.dpr, 1.35 * this.dpr, 0, Math.PI * 2); dg.arc(6 * this.dpr, 6 * this.dpr, 1.35 * this.dpr, 0, Math.PI * 2); dg.fill();
      sg.fillStyle = sg.createPattern(dot, 'repeat')!; sg.fillRect(0, 0, W, H);
      g.globalAlpha = 0.55; g.drawImage(sh, 0, 0); g.globalAlpha = 1;
    }
    for (let y = 0; y < pg.h; y++) for (let x = 0; x < pg.w; x++) {
      const k = pg.plate[p][y * pg.w + x];
      if (hiddenOnly) { if (k === K_HIDDEN) this.block(g, set, x, y, s, 3 + p); continue; }
      if (k === K_BLOCK) this.block(g, set, x, y, s, 1 + p);
      else if (k === K_STAMP) {
        this.block(g, set, x, y, s, 1 + p);
        g.save(); g.globalCompositeOperation = 'destination-out'; g.drawImage(set[T_STAMP], (x + 0.12) * s, (y - 0.02) * s, s * 0.76, s * 0.46); g.restore();
        g.drawImage(set[T_STAMP], (x + 0.12) * s, (y - 0.3) * s, s * 0.76, s * 0.5);
      } else if (k === K_LADDER) g.drawImage(set[T_LADDER], (x + 0.08) * s, (y - 0.02) * s, s * 0.84, s * 1.04);
      else if (k === K_MARK) {
        g.save(); g.strokeStyle = ink; g.lineWidth = Math.max(1.5, s * 0.05); const cx = (x + 0.5) * s, cy = (y + 0.5) * s;
        g.beginPath(); g.arc(cx, cy, s * 0.2, 0, Math.PI * 2); g.moveTo(cx - s * 0.36, cy); g.lineTo(cx + s * 0.36, cy); g.moveTo(cx, cy - s * 0.36); g.lineTo(cx, cy + s * 0.36); g.stroke(); g.restore();
      } else if (k === K_HIDDEN) {
        // not printed yet: a dotted outline of where the stamp will print
        g.save(); g.strokeStyle = ink; g.globalAlpha = 0.75; g.lineWidth = Math.max(1.5, s * 0.045); g.setLineDash([s * 0.08, s * 0.08]);
        g.strokeRect((x + 0.1) * s, (y + 0.1) * s, s * 0.8, s * 0.8); g.restore();
      }
    }
    this.grain(g, W, H, 5 + p * 17);
    return c;
  }

  // ---------------------------------------------------------------- state changes
  /** jump straight to a state (undo, restart) */
  show(st: State) { this.st = st; this.anim = null; const rv = this.pg ? revealed(this.pg, st, {}) : [false, false]; this.revealT = [rv[0] ? 1 : 0, rv[1] ? 1 : 0]; }
  /** animate a step from `from` */
  play(from: State, r: Extract<Step, { ok: true }>, action: Action, now: number) {
    if (action === 'L' || action === 'R') this.facing[from.active] = action === 'L' ? -1 : 1;
    this.st = r.state;
    if (r.kind === 'switch') { this.anim = null; return; }
    const paths: [[number, number][], [number, number][]] = [r.paths[0].length ? r.paths[0] : [from.pos[0]], r.paths[1].length ? r.paths[1] : [from.pos[1]]];
    // per path segment: a walk or shift step takes longer than one cell of falling
    const segT = [0, 1].map((c) => paths[c].slice(1).reduce((t, p, i) => t + (p[1] > paths[c][i][1] && p[0] === paths[c][i][0] && i > 0 ? 55 : 120), 0));
    const dur = this.reduced ? 1 : Math.max(140, ...segT);
    this.anim = { t0: now, dur, paths, offFrom: from.off, offTo: r.state.off, shift: r.kind === 'shift' ? from.active : null, segT, kind: r.kind };
    if (r.dropNow) this.dropGone = now;
  }
  refuse(who: Who, action: Action, now: number) {
    const v = action === 'sL' || action === 'L' ? [-1, 0] : action === 'sR' || action === 'R' ? [1, 0] : action === 'sU' || action === 'U' ? [0, -1] : [0, 1];
    this.wobble = { who, t0: now, dx: v[0], dy: v[1] };
  }
  celebrate(now: number) { this.cheer = now; }
  setHint(a: Action | null) { this.hintA = a; }
  busy(now: number) { return !!this.anim && now - this.anim.t0 < this.anim.dur; }

  // ---------------------------------------------------------------- drawing
  /** where a chinchilla is drawn (in cells) and the plate offsets (in cells) at time `now` */
  private pose(now: number) {
    const st = this.st!; const a = this.anim;
    const pos: [number, number][] = [[st.pos[0][0], st.pos[0][1]], [st.pos[1][0], st.pos[1][1]]];
    const off: [number, number][] = [[st.off[0][0], st.off[0][1]], [st.off[1][0], st.off[1][1]]];
    const moving: [boolean, boolean] = [false, false], falling: [boolean, boolean] = [false, false];
    if (a) {
      const el = now - a.t0;
      if (el < a.dur) {
        for (const c of [0, 1] as Who[]) {
          const path = a.paths[c]; if (path.length < 2) continue;
          let t = el, i = 0;
          for (; i < path.length - 1; i++) {
            const fall = i > 0 && path[i + 1][1] > path[i][1] && path[i + 1][0] === path[i][0];
            const d = fall ? 55 : 120;
            if (t < d) { const k = fall ? (t / d) : ease(t / d); pos[c] = [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; moving[c] = true; falling[c] = fall; break; }
            t -= d;
          }
        }
        for (const p of [0, 1] as Who[]) {
          const k = ease(Math.min(1, el / 120));
          off[p] = [a.offFrom[p][0] + (a.offTo[p][0] - a.offFrom[p][0]) * k, a.offFrom[p][1] + (a.offTo[p][1] - a.offFrom[p][1]) * k];
        }
      } else this.anim = null;
    }
    return { pos, off, moving, falling };
  }

  frame(now: number) {
    const g = this.g, d = this.dpr; g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.pg || !this.st || !this.plates || !this.layer || !this.over || !this.loaded) return;
    const pg = this.pg, st = this.st, s = this.cell * d, X0 = this.ox * d, Y0 = this.oy * d;
    const { pos, off, moving, falling } = this.pose(now);
    // paper
    if (this.paper) { g.fillStyle = g.createPattern(this.paper, 'repeat')!; g.save(); g.scale(d * 0.75, d * 0.75); g.fillRect(0, 0, this.cv.width / d / 0.75, this.cv.height / d / 0.75); g.restore(); }
    else { g.fillStyle = INK.paper; g.fillRect(0, 0, this.cv.width, this.cv.height); }
    // the print area: faint trim marks at its corners
    g.save(); g.strokeStyle = 'rgba(80,60,70,0.35)'; g.lineWidth = Math.max(1, d);
    const W = pg.w * s, H = pg.h * s, L = s * 0.3;
    for (const [x, y, sx, sy] of [[X0, Y0, -1, -1], [X0 + W, Y0, 1, -1], [X0, Y0 + H, -1, 1], [X0 + W, Y0 + H, 1, 1]]) {
      g.beginPath(); g.moveTo(x + sx * 4 * d, y); g.lineTo(x + sx * (4 * d + L), y); g.moveTo(x, y + sy * 4 * d); g.lineTo(x, y + sy * (4 * d + L)); g.stroke();
    }
    g.restore();
    // the staple: drawn into the paper, across its tiles
    this.drawStaple(g, X0, Y0, s, now);
    // misregistration: each plate sits a couple of pixels off, and a refused shift wobbles its plate
    const mis: [number, number][] = [[1.6 * d, -1.1 * d], [-1.2 * d, 1.5 * d]];
    if (this.wobble) {
      const t = (now - this.wobble.t0) / 320;
      if (t >= 1) this.wobble = null;
      else { const k = Math.sin(t * Math.PI * 5) * (1 - t) * s * 0.09; mis[this.wobble.who][0] += this.wobble.dx * k; mis[this.wobble.who][1] += this.wobble.dy * k; }
    }
    // the ink smear while a plate slides
    const smear = this.anim && this.anim.shift !== null && now - this.anim.t0 < 140 ? this.anim.shift : null;
    // the stamps fade the hidden cells in and out
    const rv = revealed(pg, st, {});
    for (const p of [0, 1] as const) { const want = rv[p] ? 1 : 0; this.revealT[p] += Math.sign(want - this.revealT[p]) * Math.min(Math.abs(want - this.revealT[p]), 0.12); }
    // the active chinchilla's glow, printed under everything
    const act = st.active;
    {
      const [cx, cy] = pos[act]; const x = X0 + (cx + 0.5) * s, y = Y0 + (cy + 0.45) * s, r = s * 1.05;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, act ? 'rgba(0,131,138,0.22)' : 'rgba(255,72,176,0.24)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // the key plate and the folds
    g.globalCompositeOperation = 'multiply';
    if (this.yellowC) g.drawImage(this.yellowC, X0, Y0);
    if (this.foldC) g.drawImage(this.foldC, X0, Y0);
    // each ink plate (with its chinchilla) into its own layer
    for (const p of [0, 1] as Who[]) {
      const lc = this.layer[p], lg = lc.getContext('2d')!;
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.clearRect(0, 0, lc.width, lc.height);
      const px = X0 + off[p][0] * s + mis[p][0], py = Y0 + off[p][1] * s + mis[p][1];
      lg.globalAlpha = p === act ? 1 : 0.9;
      if (smear === p) { lg.globalAlpha *= 0.35; const a = this.anim!; const dx = (a.offTo[p][0] - a.offFrom[p][0]) * s * 0.12, dy = (a.offTo[p][1] - a.offFrom[p][1]) * s * 0.12; lg.drawImage(this.plates[p], px - dx, py - dy); lg.globalAlpha = p === act ? 1 : 0.9; }
      lg.drawImage(this.plates[p], px, py);
      if (this.revealT[p] > 0.01 && this.hidden) { lg.globalAlpha = this.revealT[p] * (p === act ? 1 : 0.9); lg.drawImage(this.hidden![p], px, py); lg.globalAlpha = 1; }
      this.drawChinchilla(lg, p, pos[p], X0 + mis[p][0], Y0 + mis[p][1], s, now, moving[p], falling[p], p === act);
    }
    g.drawImage(this.layer[0], 0, 0); g.drawImage(this.layer[1], 0, 0);
    // where the inks overlap, warm the multiply into the riso purple
    const og = this.over.getContext('2d')!;
    og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, this.over.width, this.over.height);
    og.drawImage(this.layer[0], 0, 0); og.globalCompositeOperation = 'destination-in'; og.drawImage(this.layer[1], 0, 0);
    og.globalCompositeOperation = 'source-in'; og.fillStyle = '#7a1e5a'; og.fillRect(0, 0, this.over.width, this.over.height);
    g.globalCompositeOperation = 'screen'; g.drawImage(this.over, 0, 0);
    g.globalCompositeOperation = 'source-over';
    // the ink drop and the active marker
    this.drawDrop(g, X0, Y0, s, now);
    this.drawMarker(g, pos[act], X0, Y0, s, now, act);
  }

  private drawStaple(g: CanvasRenderingContext2D, X0: number, Y0: number, s: number, now: number) {
    const pg = this.pg!;
    for (let y = 0; y < pg.h; y++) for (let x = 0; x < pg.w; x++) {
      if (!pg.staple[y * pg.w + x] || (x > 0 && pg.staple[y * pg.w + x - 1])) continue;
      let n = 1; while (x + n < pg.w && pg.staple[y * pg.w + x + n]) n++;
      const cx = X0 + x * s, cy = Y0 + y * s;
      // the binding staple across the tiles, and a dashed outline of where the two of them must stand
      g.save(); g.strokeStyle = 'rgba(91,31,120,0.55)'; g.lineWidth = Math.max(1.5, s * 0.04); g.setLineDash([s * 0.1, s * 0.08]);
      g.lineDashOffset = this.reduced ? 0 : -now / 60;
      g.strokeRect(cx + s * 0.06, cy + s * 0.06, n * s - s * 0.12, s * 0.88);
      g.globalCompositeOperation = 'multiply';
      g.drawImage(this.tiles.metal[T_STAPLE], cx - s * 0.04, cy + s * 0.5, n * s + s * 0.08, s * 0.62); g.restore();
    }
  }
  private drawDrop(g: CanvasRenderingContext2D, X0: number, Y0: number, s: number, now: number) {
    const pg = this.pg!; if (pg.drop < 0) return;
    const gone = this.st!.drop; const x = pg.drop % pg.w, y = Math.floor(pg.drop / pg.w);
    let a = 1, lift = 0;
    if (gone) { const t = (now - this.dropGone) / 500; if (t >= 1) return; a = 1 - t; lift = t * s * 0.8; }
    const bob = this.reduced ? 0 : Math.sin(now / 420) * s * 0.05;
    g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'multiply';
    g.drawImage(this.tiles.purple[T_DROP], X0 + (x + 0.24) * s, Y0 + (y + 0.14) * s + bob - lift, s * 0.52, s * 0.66); g.restore();
  }
  private drawMarker(g: CanvasRenderingContext2D, p: [number, number], X0: number, Y0: number, s: number, now: number, who: Who) {
    const bob = this.reduced ? 0 : Math.sin(now / 260) * s * 0.06;
    const x = X0 + (p[0] + 0.5) * s, y = Y0 + (p[1] - 0.52) * s + bob;
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = PLATE_INK[who];
    g.beginPath(); g.moveTo(x - s * 0.13, y - s * 0.12); g.lineTo(x + s * 0.13, y - s * 0.12); g.lineTo(x, y + s * 0.04); g.closePath(); g.fill(); g.restore();
  }
  private drawChinchilla(g: CanvasRenderingContext2D, c: Who, p: [number, number], X0: number, Y0: number, s: number, now: number, moving: boolean, falling: boolean, active: boolean) {
    const won = this.cheer && now - this.cheer < 100000;
    let f = F_IDLE;
    if (won) f = F_CHEER;
    else if (falling) f = F_FALL;
    else if (moving && this.anim?.shift === c) f = F_PUSH;
    else if (moving) f = F_WALK[Math.floor(now / 110) % 2];
    const img = this.sprites[c][f]; if (!img) return;
    const size = s * 1.5, x = X0 + (p[0] + 0.5) * s, foot = Y0 + (p[1] + 1) * s + s * 0.02;
    const breathe = this.reduced || moving ? 1 : 1 + Math.sin(now / 520 + c * 2) * 0.012;
    const hop = won && !this.reduced ? Math.abs(Math.sin((now - this.cheer) / 180)) * s * 0.18 : 0;
    g.save(); g.translate(x, foot - hop); g.scale(this.facing[c] * 1, breathe);
        g.drawImage(img, -size / 2, -size, size, size); g.restore();
  }

  /** a small flat print of a page, for the contact sheet */
  thumb(pg: Page, w: number): string {
    // a real print of the page at its start, made by a second scene that shares this one's inks and paper
    const h = Math.round(w * (pg.h + 1) / (pg.w + 1)), c = canvas(w * 2, h * 2);
    const sub = new MisprintScene(c);
    sub.paper = this.paper; sub.sprites = this.sprites; sub.tiles = this.tiles; sub.loaded = this.loaded; sub.reduced = true;
    sub.w = w; sub.h = h; sub.dpr = 2;
    sub.setPage(pg, pg.start); sub.frame(0);
    return c.toDataURL('image/webp', 0.85);
  }
  /** the page-space rectangle of a cell, in CSS pixels (for the browser tests) */
  cellRect(x: number, y: number) { return { x: this.ox + x * this.cell, y: this.oy + y * this.cell, size: this.cell }; }
  dispose() { this.plates = null; this.layer = null; this.over = null; }
}
