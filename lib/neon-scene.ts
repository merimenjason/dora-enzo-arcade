// Neon Lane: the renderer. Canvas 2D at a fixed 1536 x 864 design size, scaled to the canvas. Behind everything is
// the night's rainy shophouse wall (a Codex painting); on it hangs the sign, whose glass tubes are drawn from the maze
// so each circuit can glow, pulse when nearly out, flicker and go dark on its own. The eatery's picture glows in the
// middle of the sign. Dora, Enzo, the cicaks and every item are Codex neon sprites. Drawing only: the rules are in
// lib/neon-game.ts.
import { W, H, NIGHTS, CICAKS, type NeonGame, type Ev, type Hero, type Cicak, type Dir } from './neon-game';
import { TUBE, FUSE, CIRCUIT_COLOURS, cx, cy, step, type Board } from './neon-levels';
import { NEON_ATLAS, NEON_IMG, type FrameBox } from './neon-art';

const HINT_FOR = 15;
export const VW = 1536, VH = 864, HUD = 64, CELL = 50, FW = W * CELL, FH = H * CELL;
/** the board's top-left corner on the stage */
export const OX = Math.round((VW - FW) / 2), OY = HUD + Math.round((VH - HUD - FH) / 2) - 6;
const INK = '#fbf3ff', INK2 = '#e2d3f2', PANEL = 'rgba(10, 6, 20, 0.86)';
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const ROT: Record<number, number> = { 1: -Math.PI / 2, 3: Math.PI / 2 };

interface Float { x: number; y: number; text: string; t: number; color: string; size: number }
interface Burst { x: number; y: number; t: number; dur: number; color: string; n: number; seed: number; r: number }
interface Flick { circuit: number; t: number }

const px = (c: number) => OX + cx(c) * CELL + CELL / 2;
const py = (c: number) => OY + cy(c) * CELL + CELL / 2;
const walk = (b: Board, c: number) => c >= 0 && (b.kind[c] === TUBE || b.kind[c] === FUSE);
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export class NeonScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  img: Record<string, HTMLImageElement> = {};
  ready = false; hitStop = 0; time = 0;
  private hintText = ''; private hintAge = 0;
  get hint() { return this.hintText; }
  set hint(v: string) { if (v !== this.hintText) this.hintAge = 0; this.hintText = v; }
  /** the tubes, lit or dark, drawn once per change into an offscreen layer */
  private layer: HTMLCanvasElement; private layerCtx: CanvasRenderingContext2D;
  private layerKey = ''; private board: Board | null = null;
  private paths: Path2D[] = [];
  private floats: Float[] = []; private bursts: Burst[] = []; private flicks: Flick[] = [];
  private banner: { title: string; sub: string; t: number; dur: number } | null = null;
  private shake = 0; private flash = 0; private pounce = [0, 0];
  private gait = new Map<string, { x: number; y: number; d: number }>();

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; this.ctx = cv.getContext('2d')!;
    this.layer = document.createElement('canvas'); this.layerCtx = this.layer.getContext('2d')!;
  }

  async load(): Promise<void> {
    const ids = ['dora', 'enzo', 'cicaks', 'extras', 'items', 'motifs', ...new Set(NIGHTS.map((n) => n.wall))];
    await Promise.all(ids.map((id) => new Promise<void>((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = NEON_IMG(id); this.img[id] = im; })));
    this.ready = true;
  }

  /** a new game: forget the effects */
  reset() {
    this.floats = []; this.bursts = []; this.flicks = []; this.banner = null; this.shake = 0; this.flash = 0; this.hitStop = 0;
    this.pounce = [0, 0]; this.gait.clear(); this.layerKey = ''; this.board = null; this.hintAge = 0;
  }

  say(title: string, sub: string, dur = 2.2) { this.banner = { title, sub, t: 0, dur }; }

  /** turn the step's events into effects */
  ingest(evs: Ev[], g: NeonGame) {
    for (const e of evs) switch (e.k) {
      case 'spark': if ((e.cell & 3) === 0) this.burst(px(e.cell), py(e.cell), '#ffffff', 4, 0.25, 14); break;
      case 'dark': this.flicks.push({ circuit: e.circuit, t: 0 }); break;
      case 'fuse':
        this.flash = 0.35; this.shake = Math.max(this.shake, 0.25);
        this.burst(px(e.cell), py(e.cell), '#ffb030', 22, 0.7, 70);
        this.float(px(e.cell), py(e.cell) - 30, 'FUSE BLOWN!', '#ffd060', 26);
        break;
      case 'catch': {
        const x = OX + (e.x + 0.5) * CELL, y = OY + (e.y + 0.5) * CELL;
        this.pounce[e.hero] = 0.45; this.hitStop = 0.06;
        this.burst(x, y, CICAKS[e.cicak].colour, 16, 0.6, 60);
        this.float(x, y - 34, `+${e.pts}`, CICAKS[e.cicak].colour, 28);
        break;
      }
      case 'tail': this.float(OX + (e.x + 0.5) * CELL, OY + (e.y + 0.5) * CELL - 28, '+100 tail', '#ffd23a', 22); break;
      case 'moth': if (g.moth) this.float(px(g.moth.cell), py(g.moth.cell) - 36, 'a moth!', '#e7c8ff', 22); break;
      case 'mothEaten': { const h = g.heroes[e.hero]; const p = g.pos(h); this.float(OX + (p.x + 0.5) * CELL, OY + (p.y + 0.5) * CELL - 36, `+${e.pts} moth`, '#e7c8ff', 26); break; }
      case 'gulp': { const c = g.cicaks[e.cicak]; const p = g.pos(c); this.float(OX + (p.x + 0.5) * CELL, OY + (p.y + 0.5) * CELL - 30, 'gulp!', CICAKS[c.id].colour, 22); break; }
      case 'zap': {
        const h = g.heroes[e.hero]; const p = g.pos(h); const x = OX + (p.x + 0.5) * CELL, y = OY + (p.y + 0.5) * CELL;
        this.shake = 0.5; this.hitStop = 0.15; this.burst(x, y, '#9fe8ff', 26, 0.8, 80);
        break;
      }
      case 'life': this.float(VW / 2, HUD + 40, 'Extra life!', '#7dff5a', 26); break;
      case 'chirp': { const c = g.cicaks[e.cicak]; const p = g.pos(c); this.float(OX + (p.x + 0.5) * CELL, OY + (p.y + 0.5) * CELL - 30, '!', CICAKS[c.id].colour, 30); break; }
      case 'clear': this.say('Lights out!', `${NIGHTS[e.night].name} is dark · +${1000 * (e.night + 1)}`, 2.4); break;
    }
  }
  private float(x: number, y: number, text: string, color: string, size: number) { this.floats.push({ x, y: Math.max(HUD + 56, y), text, t: 0, color, size }); }
  private burst(x: number, y: number, color: string, n: number, dur: number, r: number) { this.bursts.push({ x, y, t: 0, dur, color, n, seed: (x * 7 + y * 13 + this.time * 1000) | 0, r }); }

  // ─────────────────────────────── the tubes
  /** one Path2D per circuit: half a tube from each cell's centre toward each neighbour it joins */
  private buildPaths(b: Board) {
    this.paths = b.circuits.map(() => new Path2D());
    for (const c of b.tubes) {
      const k = b.circuit[c]; if (k < 0) continue;
      for (let d = 1 as Dir; d <= 4; d = (d + 1) as Dir) {
        const n = step(c, d); if (!walk(b, n)) continue;
        const p = this.paths[k];
        p.moveTo(px(c), py(c)); p.lineTo((px(c) + px(n)) / 2, (py(c) + py(n)) / 2);
      }
    }
    this.board = b;
  }
  /** a circuit's tube, lit: a wide soft halo, the coloured glass and a hot white core */
  private litTube(x: CanvasRenderingContext2D, p: Path2D, colour: string, a = 1) {
    x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const [w, al] of [[30, 0.08], [18, 0.16], [10, 0.4]] as const) { x.strokeStyle = rgba(colour, al * a); x.lineWidth = w; x.stroke(p); }
    x.strokeStyle = rgba(colour, 0.95 * a); x.lineWidth = 6; x.stroke(p);
    x.strokeStyle = `rgba(255,255,255,${0.75 * a})`; x.lineWidth = 2.2; x.stroke(p);
    x.restore();
  }
  /** a dead tube: dark glass with a faint tint of its colour and a glint along the top */
  private deadTube(x: CanvasRenderingContext2D, p: Path2D, colour: string) {
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(8, 6, 14, 0.75)'; x.lineWidth = 11; x.stroke(p);
    x.strokeStyle = rgba(colour, 0.22); x.lineWidth = 6; x.stroke(p);
    x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 1.5; x.stroke(p);
    x.restore();
  }
  private rebuildLayer(g: NeonGame, scale: number) {
    const b = g.board;
    if (this.board !== b) this.buildPaths(b);
    const key = `${scale}|${g.night}|${g.left.map((n) => (n > 0 ? 1 : 0)).join('')}`;
    if (key === this.layerKey) return;
    this.layerKey = key;
    const L = this.layer, x = this.layerCtx;
    L.width = Math.round(VW * scale); L.height = Math.round(VH * scale);
    x.setTransform(scale, 0, 0, scale, 0, 0); x.clearRect(0, 0, VW, VH);
    // the cicaks' drainpipe: a short grey pipe out to the door
    x.save(); x.lineCap = 'round'; x.strokeStyle = 'rgba(60, 64, 76, 0.95)'; x.lineWidth = 16;
    x.beginPath(); x.moveTo(px(b.den), py(b.den)); x.lineTo(px(b.door), py(b.door)); x.stroke(); x.restore();
    for (const k of b.circuits) if (g.left[k.id] <= 0) this.deadTube(x, this.paths[k.id], CIRCUIT_COLOURS[k.colour]);
    for (const k of b.circuits) if (g.left[k.id] > 0) this.litTube(x, this.paths[k.id], CIRCUIT_COLOURS[k.colour]);
  }

  // ─────────────────────────────── sprites
  private frame(sheet: string, name: string): FrameBox { return NEON_ATLAS[sheet].f[name]; }
  /** a frame centred on (x, y), its longer side `size` px, turned and flipped as asked */
  private centred(sheet: string, name: string, x: number, y: number, size: number, rot = 0, flip = false, alpha = 1) {
    const im = this.img[sheet]; const f = this.frame(sheet, name); if (!im?.complete || !f) return;
    const s = size / Math.max(f[2], f[3]); const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, f[0], f[1], f[2], f[3], -f[2] * s / 2, -f[3] * s / 2, f[2] * s, f[3] * s);
    ctx.restore();
  }

  // ─────────────────────────────── the frame
  draw(g: NeonGame, dt: number) {
    this.time += dt; if (this.hint) this.hintAge += dt;
    const ctx = this.ctx, k = this.cv.width / VW;
    this.rebuildLayer(g, Math.min(2, Math.max(1, k)));
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#07040c'; ctx.fillRect(0, 0, VW, VH);
    if (this.shake > 0) { this.shake -= dt; const m = 9 * Math.max(0, this.shake); ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    this.drawWall(g);
    this.drawMotif(g);
    // the sign flickers as a fuse blows
    const blink = this.flash > 0 && Math.random() < 0.5 ? 0.35 : 1;
    ctx.save(); ctx.globalAlpha = blink; ctx.drawImage(this.layer, 0, 0, VW, VH); ctx.restore();
    this.drawFlicks(g, dt);
    this.drawLow(g);
    this.drawSparks(g);
    this.drawItems(g);
    for (const c of g.cicaks) this.drawCicak(g, c);
    for (const h of g.heroes) this.drawHero(g, h, dt);
    this.drawFx(dt);
    if (this.flash > 0) { this.flash -= dt; ctx.fillStyle = `rgba(255, 240, 200, ${Math.max(0, this.flash) * 0.5})`; ctx.fillRect(0, 0, VW, VH); }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.drawHud(g);
    this.drawBanner(dt);
    this.drawHint(g);
  }

  private drawWall(g: NeonGame) {
    const ctx = this.ctx, im = this.img[NIGHTS[g.night].wall];
    if (im?.complete && im.naturalWidth) ctx.drawImage(im, 0, 0, VW, VH);
    // the wet wall at night: dark, so the neon carries the picture
    ctx.fillStyle = 'rgba(6, 3, 12, 0.5)'; ctx.fillRect(0, 0, VW, VH);
    // the sign's backboard: a slightly darker panel the tubes are mounted on
    ctx.fillStyle = 'rgba(4, 2, 10, 0.45)';
    ctx.beginPath(); ctx.roundRect(OX - 12, OY - 12, FW + 24, FH + 24, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(160, 140, 190, 0.18)'; ctx.lineWidth = 2; ctx.stroke();
  }

  private drawMotif(g: NeonGame) {
    const m = g.board.motif, night = NIGHTS[g.night];
    const w = m.w * CELL, h = m.h * CELL, x = OX + m.x * CELL + w / 2, y = OY + m.y * CELL + h / 2;
    const out = g.phase === 'clear' || g.phase === 'cleared' ? 0.25 : 1;
    // the eatery's own sign hums: a slow breath and, now and then, a stutter
    const hum = 0.88 + 0.12 * Math.sin(this.time * 2.1) - (Math.sin(this.time * 13.7) > 0.985 ? 0.4 : 0);
    // fit the picture inside the space the maze leaves for it, overhanging the gap a little like a real sign
    const f = this.frame('motifs', night.motif), fit = Math.min((w + CELL * 0.6) / f[2], (h + CELL * 0.6) / f[3]);
    this.centred('motifs', night.motif, x, y, Math.max(f[2], f[3]) * fit, 0, false, out * hum);
  }

  /** circuits that just went dark: they stutter on and off for a moment before dying */
  private drawFlicks(g: NeonGame, dt: number) {
    if (!this.board) return;
    for (const f of this.flicks) {
      f.t += dt;
      const on = f.t < 0.7 && Math.sin(f.t * 60 + f.circuit) > (f.t / 0.7) * 1.6 - 0.8;
      if (on) this.litTube(this.ctx, this.paths[f.circuit], CIRCUIT_COLOURS[g.board.circuits[f.circuit].colour], 1 - f.t);
    }
    this.flicks = this.flicks.filter((f) => f.t < 0.7);
  }

  /** a circuit down to its last three sparks pulses brighter, so you can see it is nearly out */
  private drawLow(g: NeonGame) {
    if (!this.board) return;
    const a = 0.25 + 0.25 * Math.sin(this.time * 7);
    for (const k of g.board.circuits) if (g.left[k.id] > 0 && g.left[k.id] <= 3) this.litTube(this.ctx, this.paths[k.id], CIRCUIT_COLOURS[k.colour], a);
  }

  private drawSparks(g: NeonGame) {
    const ctx = this.ctx, b = g.board;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const c of b.tubes) {
      if (!g.spark[c]) continue;
      const k = b.circuit[c], low = g.left[k] <= 3;
      const tw = 0.75 + 0.25 * Math.sin(this.time * 5 + c * 1.7);
      const r = (low ? 6 : 4.2) * tw, x = px(c), y = py(c);
      ctx.fillStyle = rgba(CIRCUIT_COLOURS[b.circuits[k].colour], 0.45); ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  private drawItems(g: NeonGame) {
    const b = g.board;
    this.centred('items', 'den', px(b.den), py(b.den), CELL * 1.15);
    // a cicak waiting in the drainpipe shows as eyes in the dark
    const home = g.cicaks.filter((c) => c.mode === 'home');
    home.forEach((c, i) => this.centred('extras', 'eyes', px(b.den) + (i - (home.length - 1) / 2) * 14, py(b.den) - 2 + Math.sin(this.time * 3 + i) * 2, 20, 0, false, Math.sin(this.time * 1.3 + c.id * 2) > -0.7 ? 1 : 0));
    for (const f of b.fuses) {
      const live = g.fuseLeft[f] > 0;
      const pulse = live ? 1 + 0.07 * Math.sin(this.time * 6 + f) : 1;
      // a fuse lies along its tube: turned upright on a vertical one
      const upright = walk(b, step(f, 1)) && walk(b, step(f, 3)) && !(walk(b, step(f, 2)) && walk(b, step(f, 4)));
      this.centred('items', live ? 'fuse' : 'blown', px(f), py(f), CELL * 1.25 * pulse, upright ? Math.PI / 2 : 0, false, live ? 1 : 0.6);
    }
    for (const tl of g.tails) {
      const x = OX + (tl.x + 0.5) * CELL, y = OY + (tl.y + 0.5) * CELL;
      const wig = Math.floor(this.time * 10) % 2 ? 'tailA' : 'tailB';
      this.centred('extras', wig, x, y, CELL * 0.95, 0, false, tl.t < 1.5 ? (Math.floor(this.time * 8) % 2 ? 1 : 0.35) : 1);
    }
    if (g.moth) {
      const m = g.moth, flap = Math.floor(this.time * 8) % 2 ? 'mothA' : 'mothB';
      this.centred('extras', flap, px(m.cell), py(m.cell) + Math.sin(this.time * 4) * 3, CELL * 1.05, 0, false, m.t < 2 ? (Math.floor(this.time * 8) % 2 ? 1 : 0.4) : 1);
    }
  }

  /** a gait clock: tubes travelled so far, so the feet keep pace with the speed (a jump back to the start resets it) */
  private stride(key: string, x: number, y: number) {
    const g = this.gait.get(key) ?? { x, y, d: 0 };
    const m = Math.abs(x - g.x) + Math.abs(y - g.y);
    g.d = m > 2 ? 0 : g.d + m; g.x = x; g.y = y; this.gait.set(key, g);
    return g.d;
  }

  private drawCicak(g: NeonGame, c: Cicak) {
    if (c.mode === 'away' || c.mode === 'home') return;
    const p = g.pos(c), x = OX + (p.x + 0.5) * CELL, y = OY + (p.y + 0.5) * CELL;
    const dir = (c.dir || c.face) as Dir;
    const rot = ROT[dir] ?? 0, flip = dir === 4;
    const gait = this.stride('c' + c.id, p.x, p.y);
    const crawl = Math.floor(gait * 2.2) % 2 ? 'A' : 'B';
    const lit = g.lit(g.near(c));
    if (c.mode === 'out' && !lit) {
      // in the dark a cicak is two glinting eyes, feeling its way
      const ex = x + (dir === 2 ? 10 : dir === 4 ? -10 : 0), ey = y + (dir === 3 ? 10 : dir === 1 ? -10 : 0);
      this.centred('extras', 'eyes', ex, ey, 26, 0, false, 0.85 + 0.15 * Math.sin(this.time * 9 + c.id));
      return;
    }
    const size = CELL * 1.7;
    if (c.mode === 'scared') {
      // panicked: pale and shaking; it flashes its own colour as the fuse wears off
      const warn = g.fuseT < 2 && Math.floor(this.time * 8) % 2 === 0;
      const sx = x + (Math.random() - 0.5) * 2, sy = y + (Math.random() - 0.5) * 2;
      if (warn) this.centred('cicaks', `${c.kind}${crawl}`, sx, sy, size, rot, flip);
      else this.centred('extras', crawl === 'A' ? 'scaredA' : 'scaredB', sx, sy, size, rot, flip);
      return;
    }
    if (c.mode === 'gulp') { this.centred('extras', 'gulp', x, y, size, rot, flip); return; }
    if (c.mode === 'stub') { this.centred('cicaks', `${c.kind}Stub`, x, y, size * 0.85, rot, flip, 0.9); return; }
    const name = c.chirpT > 0 ? `${c.kind}Chirp` : `${c.kind}${crawl}`;
    this.centred('cicaks', name, x, y, size, rot, flip);
  }

  private drawHero(g: NeonGame, h: Hero, dt: number) {
    if (h.state === 'gone') return;
    const p = g.pos(h), x = OX + (p.x + 0.5) * CELL, y = OY + (p.y + 0.5) * CELL;
    this.pounce[h.idx] = Math.max(0, this.pounce[h.idx] - dt);
    const gait = this.stride('h' + h.idx, p.x, p.y);
    let name = 'idle', flip = h.face === 4;
    if (h.state === 'zap') name = Math.floor(this.time * 14) % 2 ? 'zapA' : 'zapB';
    else if (g.over === 'lose') name = 'sad';
    else if (g.phase === 'clear' || g.phase === 'cleared' || g.over === 'win') name = 'cheer';
    else if (this.pounce[h.idx] > 0) name = 'pounce';
    else if (h.dir === 1) name = Math.floor(gait * 2.4) % 2 ? 'climbA' : 'climbB';
    else if (h.dir === 3) name = Math.floor(gait * 2.4) % 2 ? 'downA' : 'downB';
    else if (h.dir === 2 || h.dir === 4) name = h.eatT > 0.16 ? 'eat' : `run${'ABCD'[Math.floor(gait * 4) % 4]}`;
    else name = (this.time % 3.2) < 0.14 ? 'blink' : 'idle';
    if (h.dir === 1 || h.dir === 3 || name === 'cheer' || name === 'sad' || name.startsWith('zap') || name === 'idle' || name === 'blink') flip = false;
    // safe after coming back: blinking; hidden on a dark tube: dimmed, with a faint ring so you know
    const safe = h.safe > 0 && Math.floor(this.time * 10) % 2 === 0;
    const hidden = h.state === 'run' && !g.lit(g.near(h)) && g.phase === 'play';
    const ctx = this.ctx;
    if (hidden) {
      ctx.save(); ctx.strokeStyle = 'rgba(190, 170, 255, 0.45)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, CELL * 0.82, 0, 7); ctx.stroke(); ctx.restore();
    }
    this.centred(h.id, name, x, y - 4, CELL * 1.62, 0, flip, safe ? 0.35 : hidden ? 0.62 : 1);
    if (g.twoP && h.state === 'run') {
      ctx.save(); ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#08040e';
      const label = h.idx === 0 ? 'P1' : 'P2'; ctx.strokeText(label, x, y - CELL * 0.95); ctx.fillStyle = h.id === 'dora' ? '#fff1d6' : '#cfe0ff'; ctx.fillText(label, x, y - CELL * 0.95); ctx.restore();
    }
  }

  private drawFx(dt: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bursts) {
      b.t += dt; const f = b.t / b.dur; let s = b.seed;
      const rnd = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
      ctx.strokeStyle = b.color; ctx.globalAlpha = Math.max(0, 1 - f); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < b.n; i++) {
        const a = rnd() * Math.PI * 2, r1 = b.r * f * (0.5 + rnd() * 0.5), r0 = r1 * 0.6;
        ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0); ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1); ctx.stroke();
      }
    }
    ctx.restore();
    this.bursts = this.bursts.filter((b) => b.t < b.dur);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of this.floats) {
      f.t += dt; const a = Math.min(1, 2.4 - f.t * 2);
      ctx.globalAlpha = Math.max(0, a); ctx.font = `800 ${f.size}px ${FONT}`;
      const y = f.y - f.t * 30, half = ctx.measureText(f.text).width / 2 + 6;
      // kept on screen: a float over an edge fuse would otherwise lose its first letters
      const x = Math.min(VW - half, Math.max(half, f.x));
      ctx.lineWidth = 5; ctx.strokeStyle = '#0a0612'; ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.restore();
    this.floats = this.floats.filter((f) => f.t < 1.2);
  }

  private drawHud(g: NeonGame) {
    const ctx = this.ctx, night = NIGHTS[g.night];
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, VW, HUD);
    ctx.fillStyle = 'rgba(255, 90, 200, 0.5)'; ctx.fillRect(0, HUD - 2, VW, 2);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = INK; ctx.font = `800 21px ${FONT}`; ctx.fillText(`Night ${g.night + 1} · ${night.name}`, 20, 22);
    ctx.fillStyle = INK2; ctx.font = `600 14px ${FONT}`; ctx.fillText(night.place, 20, 46);
    // sparks left, as a bar that drains
    const bx = 620, bw = 300, f = g.sparksTotal ? g.sparksLeft / g.sparksTotal : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(bx, 14, bw, 14, 7); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.roundRect(bx, 14, Math.max(6, bw * f), 14, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.font = `700 14px ${FONT}`; ctx.fillText(`${g.sparksLeft} sparks left`, bx, 46);
    if (g.fuseT > 0) {
      const t = g.fuseT; ctx.fillStyle = t < 2 && Math.floor(this.time * 6) % 2 ? '#ffffff' : '#ffb030';
      ctx.font = `800 16px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`Fuse ${t.toFixed(1)}s`, bx + bw, 46); ctx.textAlign = 'left';
    }
    // lives: a head per life, whoever is running
    const head = g.heroes[0].id === 'dora' ? 'doraHead' : 'enzoHead';
    let lx = 1000;
    for (let i = 0; i < Math.min(g.lives, 7); i++) { this.centred('items', g.twoP ? (i % 2 ? 'enzoHead' : 'doraHead') : head, lx, 32, 40); lx += 40; }
    if (g.lives > 7) { ctx.fillStyle = INK; ctx.font = `800 16px ${FONT}`; ctx.fillText(`+${g.lives - 7}`, lx - 10, 34); }
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `800 24px ${FONT}`; ctx.fillText(String(g.score), VW - 20, 24);
    ctx.fillStyle = INK2; ctx.font = `600 14px ${FONT}`; ctx.fillText('score', VW - 20, 48);
    ctx.textAlign = 'left';
  }

  private drawBanner(dt: number) {
    const b = this.banner; if (!b) return;
    b.t += dt; if (b.t > b.dur) { this.banner = null; return; }
    const ctx = this.ctx, a = Math.min(1, b.t * 5, (b.dur - b.t) * 4);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 40px ${FONT}`; const w1 = ctx.measureText(b.title).width; ctx.font = `600 18px ${FONT}`; const w2 = ctx.measureText(b.sub).width;
    const w = Math.max(w1, w2) + 70, y = VH / 2 - 70;
    ctx.fillStyle = PANEL; ctx.beginPath(); ctx.roundRect(VW / 2 - w / 2, y - 4, w, 100, 16); ctx.fill();
    ctx.strokeStyle = '#ff5ad0'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ff5ad0'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = INK; ctx.font = `800 40px ${FONT}`; ctx.shadowColor = '#ff9ae6'; ctx.shadowBlur = 10; ctx.fillText(b.title, VW / 2, y + 44); ctx.shadowBlur = 0;
    ctx.fillStyle = INK2; ctx.font = `600 18px ${FONT}`; ctx.fillText(b.sub, VW / 2, y + 78);
    ctx.restore();
  }

  private drawHint(g: NeonGame) {
    if (!this.hint || this.hintAge > HINT_FOR || g.phase === 'over') return;
    const ctx = this.ctx, a = Math.min(1, HINT_FOR - this.hintAge);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.font = `600 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(this.hint).width + 28, y = OY + FH + 15;
    ctx.fillStyle = PANEL; ctx.beginPath(); ctx.roundRect(VW / 2 - w / 2, y - 12, w, 24, 8); ctx.fill();
    ctx.fillStyle = INK; ctx.fillText(this.hint, VW / 2, y);
    ctx.restore();
  }
}

