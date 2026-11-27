// Moth Hoop: the stitch renderer. Everything on screen is cross stitch: the scene tints Codex-painted macro photos of
// single white cotton crosses (public/art/moth/stitches.webp, 32 variants) to each colour and lays them, one per art
// pixel, on Codex aida cloth. The kit picture is stitched into the cloth itself (12 px crosses on the 128 x 72 field);
// the heroes, moths and props are Codex pixel art (lib/moth-art.ts) stitched as finer appliqué patches that float
// above the cloth with a soft shadow; even the HUD letters are stitched. Rules live in lib/moth-game.ts.
import { W, H, RAIL_Y, HAND_Y, TODO, DONE, HOLE, POWER_NAME, type MothGame, type Ev, type Foe, type Hero, type Power } from './moth-game';
import { SPRITES, SPRITE_PALETTE, SPRITE_CHARS, MOTH_IMG } from './moth-art';
import type { Pattern } from './moth-patterns';

export const VW = 1536, VH = 864;
export const CELL = 12;            // one cloth stitch, in view px
export const SPR = 7;              // one sprite stitch
const NV = 32;                     // stitch variants in the atlas
const INK = '#3a2216';             // HUD thread: dark walnut on cream aida (about 12:1)

// a 5 x 7 stitch font for the HUD (rows top to bottom, '#' is a stitch)
const FONT: Record<string, string> = {
  "A": '.###.#...##...#######...##...##...#', "B": '####.#...#####.#...##...##...#####.', "C": '.###.#...##....#....#....#...#.###.', "D": '####.#...##...##...##...##...#####.',
  "E": '######....####.#....#....#....#####', "F": '######....####.#....#....#....#....', "G": '.###.#...##....#.####...##...#.####', "H": '#...##...#######...##...##...##...#',
  "I": '.###...#....#....#....#....#...###.', "J": '..###...#....#....#....#.#..#..##..', "K": '#...##..#.#.#..##...#.#..#..#.#...#', "L": '#....#....#....#....#....#....#####',
  "M": '#...###.###.#.##...##...##...##...#', "N": '#...###..##.#.##..###...##...##...#', "O": '.###.#...##...##...##...##...#.###.', "P": '####.#...##...#####.#....#....#....',
  "Q": '.###.#...##...##...##.#.##..#..##.#', "R": '####.#...##...#####.#.#..#..#.#...#', "S": '.#####....#.....###.....#....#####.', "T": '#####..#....#....#....#....#....#..',
  "U": '#...##...##...##...##...##...#.###.', "V": '#...##...##...##...#.#.#..#.#...#..', "W": '#...##...##...##.#.##.#.###.###...#', "X": '#...##...#.#.#...#...#.#.#...##...#',
  "Y": '#...##...#.#.#...#....#....#....#..', "Z": '#####....#...#...#...#...#....#####', "0": '.###.#...##..###.#.###..##...#.###.', "1": '..#...##....#....#....#....#...###.',
  "2": '.###.#...#....#...#...#...#...#####', "3": '####.....#....#.###.....#....#####.', "4": '...#...##..#.#.#..#.#####...#....#.', "5": '######....####.....#....##...#.###.',
  "6": '..##..#...#....####.#...##...#.###.', "7": '#####....#...#...#...#....#....#...', "8": '.###.#...##...#.###.#...##...#.###.', "9": '.###.#...##...#.####....#...#..##..',
  " ": '...................................', "%": '##..###..#...#...#...#...#..###..##', ":": '......##...##........##...##.......', "-": '................###................',
  "!": '..#....#....#....#....#.........#..', "/": '....#...#....#...#...#....#...#....', ".": '..........................##...##..', "'": '..#....#...........................',
  "&": '.##..#..#.#.#...#...#.#.##..#..##.#', "+": '.......#....#..#####..#....#.......', ",": '.....................##....#...#...', "?": '.###.#...#....#...#...#.........#..',
  "(": '...#...#...#....#....#.....#.....#.', ")": '.#.....#.....#....#....#...#...#...',
};

type Pop = { cell: number; t: number; col: string };
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; col: string; v: number; s: number; spin: number };
type Float = { x: number; y: number; t: number; text: string; col: string };

export class MothScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  img: Record<string, HTMLImageElement> = {};
  ready = false;
  private tint = new Map<string, HTMLCanvasElement>();   // `${colour}@${px}` -> strip of NV tinted stitches
  private spr = new Map<string, { cv: HTMLCanvasElement; sh: HTMLCanvasElement; w: number; h: number }>();
  private cloth: HTMLCanvasElement | null = null; private bare: HTMLCanvasElement | null = null;
  private clothFor: MothGame | null = null; private clothScale = 0;
  private pops: Pop[] = []; private bits: Bit[] = []; private floats: Float[] = [];
  private shake = 0; private flash = 0; private banner: { text: string; sub: string; t: number } | null = null;
  private hurtT = 0; hitStop = 0; time = 0;
  private pins: { x: number; y: number; t: number; key: string }[] = [];
  hint = '';

  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.ctx = cv.getContext('2d')!; }

  async load(): Promise<void> {
    const ids = ['stitches', 'holes', 'aida', 'frame', 'rail'];
    await Promise.all(ids.map((id) => new Promise<void>((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = MOTH_IMG(id); this.img[id] = im; })));
    this.ready = true;
  }

  // ─────────────────────────────── stitch atlas
  /** a strip of NV crosses tinted to `col`, each `px` device pixels square */
  stitches(col: string, px: number): HTMLCanvasElement {
    const k = `${col}@${px}`; let c = this.tint.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = NV * px; c.height = px;
    const x = c.getContext('2d')!, src = this.img.stitches;
    if (src?.naturalWidth) {
      for (let i = 0; i < NV; i++) x.drawImage(src, (i % 8) * 48, Math.floor(i / 8) * 48, 48, 48, i * px, 0, px, px);
      // multiply the white floss by the thread colour, then a touch of the colour back on top so dark threads keep sheen
      x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, c.width, px);
      x.globalCompositeOperation = 'destination-in';
      for (let i = 0; i < NV; i++) x.drawImage(src, (i % 8) * 48, Math.floor(i / 8) * 48, 48, 48, i * px, 0, px, px);
      x.globalCompositeOperation = 'source-over';
    } else { x.fillStyle = col; for (let i = 0; i < NV; i++) x.fillRect(i * px + px * 0.15, px * 0.15, px * 0.7, px * 0.7); }
    this.tint.set(k, c); return c;
  }

  /** a stitched sprite (and its shadow) at the current device scale */
  sprite(name: string): { cv: HTMLCanvasElement; sh: HTMLCanvasElement; w: number; h: number } | null {
    const px = Math.max(3, Math.round(SPR * this.scale()));
    const k = `${name}@${px}`; let s = this.spr.get(k); if (s) return s;
    const rows = SPRITES[name]; if (!rows) return null;
    const h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas'); cv.width = w * px + px; cv.height = h * px + px;
    const x = cv.getContext('2d')!;
    let seed = 0; for (const ch of name) seed = seed * 31 + ch.charCodeAt(0) >>> 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const ch = rows[r][c]; if (ch === '.') continue;
      const col = SPRITE_PALETTE[SPRITE_CHARS.indexOf(ch)] ?? '#000';
      const v = (seed + r * 7 + c * 13 + r * c) % NV;
      // one cross per art pixel, overlapping a hair so the patch reads as solid embroidery
      x.drawImage(this.stitches(col, px), v * px, 0, px, px, c * px - px * 0.08, r * px - px * 0.08, px * 1.16, px * 1.16);
    }
    const sh = document.createElement('canvas'); sh.width = cv.width; sh.height = cv.height;
    const y = sh.getContext('2d')!; y.drawImage(cv, 0, 0); y.globalCompositeOperation = 'source-in'; y.fillStyle = 'rgba(40,22,10,0.38)'; y.fillRect(0, 0, sh.width, sh.height);
    s = { cv, sh, w: cv.width, h: cv.height }; this.spr.set(k, s); return s;
  }

  scale() { return this.cv.width / VW; }

  // ─────────────────────────────── the cloth
  private buildCloth(g: MothGame) {
    const s = this.scale(), cw = Math.round(VW * s), ch = Math.round(VH * s);
    const bare = document.createElement('canvas'); bare.width = cw; bare.height = ch;
    const b = bare.getContext('2d')!;
    const aida = this.img.aida;
    if (aida?.naturalWidth) {
      // 32 weave squares per tile, one per stitch cell
      const t = 32 * CELL * s;
      for (let y = 0; y < ch; y += t) for (let x = 0; x < cw; x += t) b.drawImage(aida, x, y, t, t);
    } else { b.fillStyle = '#efe4cf'; b.fillRect(0, 0, cw, ch); }
    // warm lamp light from the top left, a little shade towards the far edge
    const gr = b.createRadialGradient(cw * 0.3, ch * 0.15, 0, cw * 0.45, ch * 0.4, cw * 0.75);
    gr.addColorStop(0, 'rgba(255,236,190,0.18)'); gr.addColorStop(1, 'rgba(70,40,20,0.22)');
    b.fillStyle = gr; b.fillRect(0, 0, cw, ch);
    this.bare = bare;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; this.cloth = c;
    c.getContext('2d')!.drawImage(bare, 0, 0);
    for (let i = 0; i < W * H; i++) if (g.cloth[i]) this.paintCell(g, i);
    this.clothFor = g; this.clothScale = s;
  }

  /** redraw one field cell of the cloth: bare aida, then the printed kit colour or the stitch */
  paintCell(g: MothGame, i: number) {
    if (!this.cloth || !this.bare) return;
    const s = this.scale(), x = (i % W) * CELL * s, y = Math.floor(i / W) * CELL * s, c = CELL * s;
    const k = this.cloth.getContext('2d')!;
    k.drawImage(this.bare, x, y, c, c, x, y, c, c);
    const st = g.cloth[i], ci = g.colourAt(i); if (!ci) return;
    const col = g.pat.palette[ci - 1];
    if (st === TODO || st === HOLE) {
      // a printed kit: the picture is screen-printed faintly onto the cloth
      k.globalAlpha = 0.34; k.fillStyle = col; k.fillRect(x + c * 0.12, y + c * 0.12, c * 0.76, c * 0.76); k.globalAlpha = 1;
    } else if (st === DONE) {
      const px = Math.round(c), v = (i * 2654435761 >>> 0) % NV;
      k.drawImage(this.stitches(col, px), v * px, 0, px, px, x - c * 0.06, y - c * 0.06, c * 1.12, c * 1.12);
    }
  }

  /** the finished (or current) kit picture as a small stitched image, for cards */
  thumb(p: Pattern, done: boolean, size = 4): HTMLCanvasElement {
    const cv = document.createElement('canvas'); cv.width = p.w * size; cv.height = p.h * size;
    const x = cv.getContext('2d')!;
    x.fillStyle = '#efe4cf'; x.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) {
      const ci = p.cells[r * p.w + c]; if (!ci) continue;
      const col = p.palette[ci - 1];
      if (done) x.drawImage(this.stitches(col, size), ((r * 7 + c * 13) % NV) * size, 0, size, size, c * size, r * size, size, size);
      else { x.globalAlpha = 0.34; x.fillStyle = col; x.fillRect(c * size, r * size, size, size); x.globalAlpha = 1; }
    }
    return cv;
  }

  reset() { this.pops = []; this.bits = []; this.floats = []; this.pins = []; this.banner = null; this.shake = 0; this.flash = 0; this.clothFor = null; this.hitStop = 0; }

  // ─────────────────────────────── events
  ingest(evs: Ev[], g: MothGame) {
    for (const e of evs) {
      switch (e.k) {
        case 'stitch': for (const [n, i] of e.cells.entries()) { this.paintCell(g, i); this.pops.push({ cell: i, t: -n * 0.03, col: g.pat.palette[g.colourAt(i) - 1] }); } break;
        case 'darn': this.paintCell(g, e.cell); this.burst((e.cell % W) + 0.5, Math.floor(e.cell / W) + 0.5, ['#efe4cf', '#d9c9a8'], 5, 0.8); break;
        case 'hole': this.paintCell(g, e.cell); this.burst((e.cell % W) + 0.5, Math.floor(e.cell / W) + 0.5, [g.pat.palette[g.colourAt(e.cell) - 1], '#efe4cf'], 7, 1); break;
        case 'pin': {
          const cols = e.foe === 'gold' ? ['#d79a2b', '#f2c552', '#7a4a1c'] : e.foe === 'silk' ? ['#f3ead2', '#d8c7a0', '#8a6a44'] : e.foe === 'queen' ? ['#b5432a', '#e1a142', '#f6efe0'] : ['#8a5a32', '#c2925a', '#4a2c18'];
          this.burst(e.x, e.y, cols, e.dead ? (e.foe === 'queen' ? 60 : e.foe === 'silk' ? 30 : 16) : 5, e.dead ? 2.2 : 1);
          if (e.dead) { this.floats.push({ x: e.x, y: e.y - 3, t: 0, text: String(e.score), col: INK }); this.pins.push({ x: e.x, y: e.y, t: 0, key: e.foe }); }
          if (e.dead && (e.foe === 'silk' || e.foe === 'queen')) { this.hitStop = e.foe === 'queen' ? 0.25 : 0.08; this.shake = Math.max(this.shake, e.foe === 'queen' ? 14 : 5); }
          break;
        }
        case 'hurt': this.shake = Math.max(this.shake, e.blocked ? 6 : 12); this.flash = e.blocked ? 0 : 0.35; this.hurtT = 0.5; if (e.blocked) this.say('The thimble took it!', '', 1.4); break;
        case 'row': this.floats.push({ x: W / 2, y: e.row, t: 0, text: 'ROW +150', col: INK }); break;
        case 'power': this.say(POWER_NAME[e.power] + '!', powerSub(e.power), 1.8); break;
        case 'win': this.say('Hoop finished!', 'Every stitch is in.', 3); break;
        case 'lose': this.say(e.why === 'tear' ? 'The cloth tore' : 'Out of spools', e.why === 'tear' ? 'Too many moth holes.' : 'The gold moths knocked the reels over.', 3); break;
        case 'hatch': this.burst(e.x, e.y, ['#f3ead2', '#c9b98f'], 8, 1); break;
        case 'egg': this.burst(e.x, e.y, ['#f6efe0'], 4, 0.6); break;
      }
    }
  }
  say(text: string, sub: string, t: number) { this.banner = { text, sub, t }; }

  private burst(x: number, y: number, cols: string[], n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (6 + Math.random() * 18) * power;
      this.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 8, t: 0, life: 0.6 + Math.random() * 0.6, col: cols[i % cols.length], v: (Math.random() * NV) | 0, s: 0.5 + Math.random() * 0.6, spin: (Math.random() - 0.5) * 12 });
    }
  }

  // ─────────────────────────────── draw
  draw(g: MothGame | null, dt: number) {
    const ctx = this.ctx, s = this.scale();
    this.time += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    if (!g) return;
    if (!this.cloth || this.clothFor !== g || this.clothScale !== s) this.buildCloth(g);
    this.shake = Math.max(0, this.shake - dt * 30); this.flash = Math.max(0, this.flash - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    const sx = (Math.random() - 0.5) * this.shake * s, sy = (Math.random() - 0.5) * this.shake * s;
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.drawImage(this.cloth!, 0, 0);
    const c = CELL * s;
    // holes: the dark under the cloth shows through frayed aida
    const holes = this.img.holes;
    for (let i = 0; i < W * H; i++) if (g.cloth[i] === HOLE) {
      const x = (i % W) * c, y = Math.floor(i / W) * c, v = (i * 7) % 8;
      if (holes?.naturalWidth) ctx.drawImage(holes, v * 64, 0, 64, 64, x - c * 0.55, y - c * 0.55, c * 2.1, c * 2.1);
      else { ctx.fillStyle = '#22160f'; ctx.fillRect(x + 2, y + 2, c - 4, c - 4); }
    }
    // new stitches pull tight: a bright, slightly large cross that settles
    for (const p of this.pops) {
      p.t += dt; if (p.t < 0 || p.t > 0.3) continue;
      const k = 1 - p.t / 0.3, x = (p.cell % W) * c, y = Math.floor(p.cell / W) * c, px = Math.round(c);
      const z = c * (1 + 0.5 * k);
      ctx.globalAlpha = 0.9 * k; ctx.drawImage(this.stitches('#fff6dc', px), ((p.cell * 5) % NV) * px, 0, px, px, x + c / 2 - z / 2, y + c / 2 - z / 2, z, z); ctx.globalAlpha = 1;
    }
    this.pops = this.pops.filter((p) => p.t <= 0.3);

    // the guide: a faint running stitch up each sewer's column to the first thing it would meet
    if (g.assist && !g.over) for (const h of g.throwers()) this.guide(g, h);

    // needles in flight, trailing thread
    for (const n of g.needles) {
      const x = (n.x + 0.5) * c, y = n.y * c, col = n.gold ? '#e8b730' : n.by === 'dora' ? '#c0392b' : '#1f7a80';
      ctx.strokeStyle = col; ctx.lineWidth = 2.2 * s; ctx.setLineDash([7 * s, 5 * s]); ctx.lineDashOffset = -this.time * 80 * s;
      ctx.beginPath(); ctx.moveTo(x, (HAND_Y + 1) * c); ctx.lineTo(x, y + 6 * s); ctx.stroke(); ctx.setLineDash([]);
      this.drawSprite('props.needle', n.x + 0.5, n.y + 1.6, 1, 0, false);
    }

    // foes
    for (const f of g.foes) this.drawFoe(g, f);
    // pinned moths: a quick freeze with a pin through, then they burst
    for (const p of this.pins) { p.t += dt; const k = p.t / 0.35; if (k < 1) { ctx.globalAlpha = 1 - k; this.drawSprite('props.needle', p.x, p.y, 1, 0, false); ctx.globalAlpha = 1; } }
    this.pins = this.pins.filter((p) => p.t < 0.35);

    // buttons falling
    for (const d of g.drops) {
      const key = d.power === 'lavender' ? 'props.buttonLav' : d.power === 'triple' ? 'props.buttonTriple' : d.power === 'gold' ? 'props.buttonGold' : 'props.buttonThimble';
      const glow = 0.5 + 0.5 * Math.sin(this.time * 8);
      ctx.globalAlpha = 0.25 + 0.25 * glow; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(d.x * c, d.y * c, 9 * c / 12 * (1 + glow * 0.2) * 1.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      this.drawSprite(key, d.x, d.y, 1, Math.sin(this.time * 3) * 0.2, true);
    }

    // the tape-measure rail and the reels
    const rail = this.img.rail;
    if (rail?.naturalWidth) { const rh = 5.2 * c, rw = rh * rail.naturalWidth / rail.naturalHeight; for (let x = -rw * 0.1; x < VW * s; x += rw * 0.98) ctx.drawImage(rail, x, (RAIL_Y + 0.4) * c, rw, rh); }
    for (const h of g.heroes) if (h.ctrl !== 'ride') this.drawReel(g, h);
    if (!g.twoP) { const rider = g.heroes.find((h) => h.ctrl === 'ride'); if (rider) this.drawHero(g, rider, true); }
    for (const h of g.heroes) if (h.ctrl !== 'ride') this.drawHero(g, h, false);

    // flying stitch bits
    for (const b of this.bits) {
      b.t += dt; b.vy += 40 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.97;
      const k = 1 - b.t / b.life; if (k <= 0) continue;
      const px = Math.max(2, Math.round(c * b.s));
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5); ctx.translate(b.x * c, b.y * c); ctx.rotate(b.t * b.spin);
      ctx.drawImage(this.stitches(b.col, px), b.v * px, 0, px, px, -px / 2, -px / 2, px, px); ctx.restore();
    }
    this.bits = this.bits.filter((b) => b.t < b.life);

    // the hoop and table over everything on the cloth
    ctx.setTransform(1, 0, 0, 1, sx * 0.4, sy * 0.4);
    const fr = this.img.frame; if (fr?.naturalWidth) ctx.drawImage(fr, 0, 0, VW * s, VH * s);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // lavender haze
    if (g.powers.lavender > 0) { ctx.fillStyle = `rgba(180,150,220,${0.10 + 0.04 * Math.sin(this.time * 4)})`; ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
    if (this.flash > 0) { ctx.fillStyle = `rgba(200,40,30,${this.flash * 0.5})`; ctx.fillRect(0, 0, this.cv.width, this.cv.height); }

    for (const f of this.floats) { f.t += dt; const k = f.t / 1.1; if (k > 1) continue; ctx.globalAlpha = 1 - k * k; this.stitchText(f.text, f.x * c, (f.y - k * 4) * c, 3.2 * s, f.col, 'center', true); ctx.globalAlpha = 1; }
    this.floats = this.floats.filter((f) => f.t < 1.1);
    this.hud(g);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t > 0) this.plaque(this.banner.text, this.banner.sub, VW / 2, 300);
      else this.banner = null;
    }
  }

  private guide(g: MothGame, h: Hero) {
    const ctx = this.ctx, s = this.scale(), c = CELL * s, x = Math.round(h.x);
    let top = 1;
    for (let y = HAND_Y; y >= 1; y--) {
      const st = g.cloth[y * W + x]; if (st === TODO || st === HOLE) { top = y; break; }
      if (g.foes.some((f) => f.hp > 0 && Math.abs(f.x - x) < 3 && Math.abs(f.y - y) < 2)) { top = y; break; }
    }
    ctx.strokeStyle = h.id === 'dora' ? 'rgba(192,57,43,0.35)' : 'rgba(31,122,128,0.35)'; ctx.lineWidth = 2 * s; ctx.setLineDash([4 * s, 8 * s]);
    ctx.beginPath(); ctx.moveTo((x + 0.5) * c, HAND_Y * c); ctx.lineTo((x + 0.5) * c, (top + 1) * c); ctx.stroke(); ctx.setLineDash([]);
  }

  /** draw a stitched sprite centred at field (x, y); `lift` adds the appliqué shadow */
  drawSprite(name: string, x: number, y: number, sc: number, rot: number, lift: boolean, flip = false) {
    const sp = this.sprite(name); if (!sp) return;
    const ctx = this.ctx, s = this.scale(), c = CELL * s;
    ctx.save(); ctx.translate(x * c, y * c); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
    const w = sp.w * sc, h = sp.h * sc;
    if (lift) ctx.drawImage(sp.sh, -w / 2 + 6 * s, -h / 2 + 9 * s, w, h);
    ctx.drawImage(sp.cv, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawFoe(g: MothGame, f: Foe) {
    const t = this.time + f.phase, flap = Math.sin(t * (f.kind === 'silk' || f.kind === 'queen' ? 9 : 16)) > 0;
    let key = 'moths.mothUp', rot = 0, sc = 1, lift = true;
    switch (f.kind) {
      case 'moth':
        key = f.hitT > 0 ? 'moths2.mothHit' : f.state === 'chew' ? (Math.sin(t * 14) > 0 ? 'moths.mothChew' : 'moths.mothLand') : f.state === 'land' ? 'moths.mothLand' : flap ? 'moths.mothUp' : 'moths.mothDown';
        if (f.state === 'chew' || f.state === 'land') { lift = false; }
        else rot = Math.max(-0.4, Math.min(0.4, f.vx * 0.02));
        break;
      case 'gold':
        key = f.hitT > 0 ? 'moths2.mothHit' : f.state === 'dive' ? 'moths.goldDive' : f.state === 'shiver' ? 'moths2.goldShiver' : flap ? 'moths.goldUp' : 'moths.goldDown';
        if (f.state === 'dive') rot = Math.atan2(f.vx, f.vy) * -1;
        break;
      case 'silk': key = f.hitT > 0 ? 'moths2.silkHit' : flap ? 'moths2.silkUp' : 'moths2.silkDown'; break;
      case 'larva': key = f.state === 'chew' ? 'moths2.larvaChew' : Math.sin(t * 6) > 0 ? 'moths.larva' : 'moths2.larva2'; lift = false; sc = 0.9; break;
      case 'cocoon': key = 'moths2.cocoon'; lift = false; rot = Math.sin(this.time * 5) * 0.08 * Math.min(1, f.t); break;
      case 'queen': key = f.hitT > 0 ? 'queen.queenHit' : f.dir > (g.assist ? 5.2 : 3.8) ? 'queen.queenLay' : flap ? 'queen.queenUp' : 'queen.queenDown'; break;
    }
    if (f.state === 'flee') rot += Math.sin(t * 20) * 0.2;
    this.drawSprite(key, f.x + 0.5, f.y + 0.5, sc, rot, lift, f.kind === 'larva' && f.dir < 0);
    // a chewing moth shows its progress: a ring of loose thread ends around the stitch
    if ((f.kind === 'moth' || f.kind === 'larva') && f.state === 'chew') {
      const ctx = this.ctx, s = this.scale(), c = CELL * s, k = Math.min(1, f.t / (g.def.chew * (f.kind === 'larva' ? 0.55 : 1) / (g.assist ? 0.85 : 1)));
      ctx.strokeStyle = 'rgba(200,40,30,0.85)'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.arc((f.x + 0.5) * c, (f.y + 0.5) * c + (f.kind === 'moth' ? 4.2 * c : 1.4 * c), 1.1 * c, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    if (f.kind === 'gold' && f.state === 'shiver') {
      // a warning stitch line down to where it will hit
      const ctx = this.ctx, s = this.scale(), c = CELL * s;
      ctx.strokeStyle = `rgba(214,140,30,${0.35 + 0.3 * Math.sin(this.time * 30)})`; ctx.lineWidth = 3 * s; ctx.setLineDash([3 * s, 7 * s]);
      ctx.beginPath(); ctx.moveTo((f.x + 0.5) * c, (f.y + 3) * c); ctx.lineTo((f.tx + 0.5) * c, (RAIL_Y - 3) * c); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  private drawReel(g: MothGame, h: Hero) {
    const spin = Math.abs(h.dir) > 0 && Math.sin(this.time * 24) > 0;
    this.drawSprite(spin ? 'props.reelSpin' : 'props.reel', h.x + 0.5, RAIL_Y + 2.2, 1, 0, true, h.dir < 0);
  }

  private drawHero(g: MothGame, h: Hero, rider: boolean) {
    const ctx = this.ctx;
    const reel = g.reelOf(h);
    let f = 'idle';
    if (g.over === 'win') f = Math.sin(this.time * 6 + (h.id === 'enzo' ? 1 : 0)) > 0 ? 'cheer' : 'wave';
    else if (g.over === 'lose') f = g.why === 'spools' ? 'ko' : 'sad';
    else if (h.hurtT > 1.0) f = 'hurt';
    else if (h.hurtT > 0 && Math.sin(this.time * 30) > 0) f = 'hurt';
    else if (rider) f = reel.throwT > 0 ? 'cheer' : reel.dir < 0 ? 'leanL' : reel.dir > 0 ? 'leanR' : (this.time % 3.4 < 0.15 ? 'blink' : 'idle');
    else if (h.throwT > 0.08) f = 'raise';
    else if (h.throwT > 0) f = 'throw';
    else if (h.dir < 0) f = 'leanL';
    else if (h.dir > 0) f = 'leanR';
    else if (g.powers.lavender > 0 || g.powers.triple > 0 || g.powers.gold > 0) f = 'hold';
    else if (h.idleT > 5 && (h.idleT % 4) < 1.2) f = 'wave';
    else f = (this.time + (h.id === 'enzo' ? 1.7 : 0)) % 3.4 < 0.15 ? 'blink' : 'idle';
    const bob = f === 'idle' || f === 'blink' ? Math.sin(this.time * 3 + (h.id === 'enzo' ? 1 : 0)) * 0.12 : 0;
    const dx = rider ? (h.id === 'enzo' ? 3.6 : -3.6) : 0;
    const sp = this.sprite(`${h.id}.${f}`);
    const hgt = sp ? sp.h / (CELL * this.scale()) : 12;
    ctx.save();
    if (h.hurtT > 0 && Math.sin(this.time * 40) > 0.3) ctx.globalAlpha = 0.55;
    this.drawSprite(`${h.id}.${f}`, reel.x + 0.5 + dx, RAIL_Y + 0.4 - hgt / 2 + bob, 1, 0, true);
    ctx.restore();
  }

  // ─────────────────────────────── HUD, all stitched
  stitchText(text: string, x: number, y: number, px: number, col: string, align: 'left' | 'center' | 'right' = 'left', outline = false) {
    const ctx = this.ctx, t = text.toUpperCase(), cw = px * 6, total = t.length * cw - px;
    let x0 = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
    const ip = Math.max(2, Math.round(px));
    const strip = this.stitches(col, ip), back = outline ? this.stitches('#f6efe0', ip + 2) : null;
    for (const ch of t) {
      const g = FONT[ch] ?? FONT[' '];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '#') {
        const v = (r * 5 + c + ch.charCodeAt(0)) % NV;
        if (back) ctx.drawImage(back, v * (ip + 2), 0, ip + 2, ip + 2, x0 + c * px - 1, y + r * px - 1, px + 2, px + 2);
        ctx.drawImage(strip, v * ip, 0, ip, ip, x0 + c * px, y + r * px, px, px);
      }
      x0 += cw;
    }
  }

  /** a cream aida label with a stitched border, for HUD numbers and banners */
  patch(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx, s = this.scale();
    ctx.save();
    ctx.shadowColor = 'rgba(30,15,5,0.45)'; ctx.shadowBlur = 8 * s; ctx.shadowOffsetY = 3 * s;
    ctx.fillStyle = '#f2e8d2';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8 * s); ctx.fill();
    ctx.restore();
    const aida = this.img.aida;
    if (aida?.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8 * s); ctx.clip(); ctx.globalAlpha = 0.55; const t = 32 * 6 * s; for (let yy = y; yy < y + h; yy += t) for (let xx = x; xx < x + w; xx += t) ctx.drawImage(aida, xx, yy, t, t); ctx.restore(); }
    ctx.strokeStyle = '#8a3b2a'; ctx.lineWidth = 2 * s; ctx.setLineDash([6 * s, 4 * s]);
    ctx.beginPath(); ctx.roundRect(x + 5 * s, y + 5 * s, w - 10 * s, h - 10 * s, 5 * s); ctx.stroke(); ctx.setLineDash([]);
  }

  private hud(g: MothGame) {
    const s = this.scale(), px = 3.4 * s;
    // score, top left
    this.patch(70 * s, 14 * s, 300 * s, 54 * s);
    this.stitchText('SCORE ' + String(g.score).padStart(6, '0'), 92 * s, 29 * s, px, INK);
    // the kit's progress, top centre: a bar that fills with stitches
    const bw = 420 * s, bx = VW * s / 2 - bw / 2;
    this.patch(bx - 16 * s, 14 * s, bw + 32 * s, 54 * s);
    this.stitchText('KIT', bx, 29 * s, px, INK);
    const cells = 26, cp = Math.round(10 * s), x0 = bx + 70 * s, filled = Math.round(g.progress * cells);
    for (let i = 0; i < cells; i++) {
      const col = i < filled ? '#2f7d4f' : '#d8ccb2';
      this.ctx.drawImage(this.stitches(col, cp), (i * 3 % NV) * cp, 0, cp, cp, x0 + i * 11.5 * s, 29 * s, 11 * s, 22 * s);
    }
    this.stitchText(Math.floor(g.progress * 100) + '%', bx + bw, 29 * s, px, INK, 'right');
    // tear meter and spools, top right
    const rx = VW * s - 70 * s - 330 * s;
    this.patch(rx, 14 * s, 330 * s, 54 * s);
    this.stitchText('TEAR', rx + 22 * s, 29 * s, px, INK);
    const tcells = 10, tf = Math.min(tcells, Math.round(g.holes / g.tearAt * tcells));
    for (let i = 0; i < tcells; i++) this.ctx.drawImage(this.stitches(i < tf ? '#b8322a' : '#d8ccb2', cp), (i * 5 % NV) * cp, 0, cp, cp, rx + 104 * s + i * 13 * s, 30 * s, 12 * s, 20 * s);
    for (let i = 0; i < 3; i++) {
      this.ctx.globalAlpha = i < g.spools ? 1 : 0.25;
      this.drawSpool(rx + 252 * s + i * 24 * s, 40 * s, s);
      this.ctx.globalAlpha = 1;
    }
    // power timers, under the kit bar
    const act = (['lavender', 'triple', 'gold'] as Power[]).filter((p) => g.powers[p] > 0);
    if (g.powers.thimble > 0) act.push('thimble');
    act.forEach((p, i) => {
      const y = (78 + i * 40) * s; this.patch(bx + 60 * s, y, bw - 120 * s, 34 * s);
      this.stitchText(POWER_NAME[p] + (p === 'thimble' ? '' : ' ' + Math.ceil(g.powers[p])), VW * s / 2, y + 9 * s, 2.4 * s, INK, 'center');
    });
    if (this.hint) { this.patch(VW * s / 2 - 400 * s, VH * s - 40 * s, 800 * s, 34 * s); this.stitchText(this.hint, VW * s / 2, VH * s - 31 * s, 2.3 * s, INK, 'center'); }
  }

  private drawSpool(x: number, y: number, s: number) {
    const sp = this.sprite('props.reel'); if (!sp) return;
    const w = 22 * s, h = w * sp.h / sp.w; this.ctx.drawImage(sp.cv, x - w / 2, y - h / 2, w, h);
  }

  plaque(text: string, sub: string, cx: number, cy: number) {
    const s = this.scale(), px = 6 * s, w = Math.max(text.length * px * 6, sub.length * 2.6 * s * 6) + 80 * s, h = (sub ? 118 : 84) * s;
    this.patch(cx * s - w / 2, cy * s - h / 2, w, h);
    this.stitchText(text, cx * s, cy * s - h / 2 + 22 * s, px, '#8a2a1e', 'center');
    if (sub) this.stitchText(sub, cx * s, cy * s + h / 2 - 38 * s, 2.6 * s, INK, 'center');
  }
}

function powerSub(p: Power) {
  return p === 'lavender' ? 'Moths hate it. They flee for a while.' : p === 'triple' ? 'Three needles at a time.' : p === 'gold' ? 'Each needle sews twice as far.' : 'Blocks the next dive.';
}
