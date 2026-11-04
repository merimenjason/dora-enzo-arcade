// Deepglow's drawing, in Canvas 2D: the sea darkening with depth, rock only where light reaches it (the lamp is cast
// against the rock, so it never shines through a wall), sonar echoes as dots of light on the walls, walls you have
// mapped faintly remembered, glowing creatures, the sub with Dora at the porthole, the boat and the sky above, air bells,
// vents and the whale. The rules are in lib/deep-game.ts.
import { CELL, GW, GH, SUB_R, SONAR_SPEED, sdfAt, spec, type Creature, type Dive, type World, type SpecId } from './deep-game';
import { drawChinchilla } from './chinchilla-art';

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
const rgba = (h: string, a: number) => { const x = hex(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };
/** the water's colour down the column */
const WATER: [number, string][] = [[0, '#3f9fb8'], [40, '#1f6f8f'], [140, '#123f66'], [320, '#0b2244'], [600, '#0a1230'], [900, '#080a1e'], [1100, '#05040f']];
function waterAt(d: number) {
  for (let i = 1; i < WATER.length; i++) if (d < WATER[i][0]) return mix(WATER[i - 1][1], WATER[i][1], (d - WATER[i - 1][0]) / (WATER[i][0] - WATER[i - 1][0]));
  return WATER[WATER.length - 1][1];
}
/** how dark it is with no lamp: daylight near the top, black below 250 m */
const darkAt = (d: number) => clamp(0.18 + (d / 230) * 0.8, 0.18, 0.985);

export type FrameView = { dive: Dive; time: number; dt: number; mapped: Uint8Array; reduced: boolean; lite: boolean;
  /** Enzo's way to air when the tank runs low: a dotted line through the water */ guide?: { x: number; y: number }[] | null };

const TILE_M = 32;

export class DeepScene {
  c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w = 0; h = 0; dpr = 1; scale = 18;
  private dark: HTMLCanvasElement; private dctx: CanvasRenderingContext2D;
  private world: World | null = null; private smooth: Float32Array | null = null;
  private tiles = new Map<string, HTMLCanvasElement>(); private tileOrder: string[] = [];
  private glows = new Map<string, HTMLCanvasElement>();
  private cam = { x: 0, y: 0 }; private snow: { x: number; y: number; z: number; r: number }[] = [];
  private bubbles: { x: number; y: number; vx: number; vy: number; r: number; life: number }[] = [];
  private stars: { x: number; y: number; r: number }[] = [];
  private shake = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.c = canvas; this.ctx = canvas.getContext('2d')!;
    this.dark = document.createElement('canvas'); this.dctx = this.dark.getContext('2d')!;
    let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 140; i++) this.snow.push({ x: r() * 120, y: r() * 80, z: 0.4 + r() * 0.8, r: 0.03 + r() * 0.07 });
    for (let i = 0; i < 70; i++) this.stars.push({ x: r(), y: r(), r: 0.4 + r() * 1.2 });
    this.resize();
  }
  resize() {
    const r = this.c.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, Math.round(r.width * this.dpr)); this.h = Math.max(1, Math.round(r.height * this.dpr));
    this.c.width = this.w; this.c.height = this.h;
    this.dark.width = Math.ceil(this.w / 2); this.dark.height = Math.ceil(this.h / 2);
    // about 36 m from top to bottom (a little more on wide screens), never so close that the lamp fills the screen
    const sc = Math.max(this.h / 36, this.w / 72); if (Math.abs(sc - this.scale) > 0.5) { this.tiles.clear(); this.tileOrder = []; } this.scale = sc;
  }
  setWorld(w: World) {
    if (this.world === w) return;
    this.world = w; this.tiles.clear(); this.tileOrder = [];
    // a softened copy of the distance field for drawing: two box blurs round off the corners of the cave
    let a = Float32Array.from(w.sdf, (v) => clamp(v, -6, 6)), b = new Float32Array(a.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) { sum += a[yy * GW + xx]; n++; } }
        b[y * GW + x] = sum / n;
      }
      [a, b] = [b, a];
    }
    this.smooth = a;
  }
  bump(mag: number) { this.shake = Math.min(1, this.shake + 0.25 + mag * 0.1); }
  snapTo(x: number, y: number) { this.cam.x = x; this.cam.y = y; }
  dispose() { this.tiles.clear(); }

  // ---------------------------------------------------------------- the frame
  render(f: FrameView) {
    const ctx = this.ctx, d = f.dive, S = this.scale, W = this.w, H = this.h, t = f.time;
    // the camera leads the sub a little
    const lx = d.x + d.vx * 0.8, ly = d.y + d.vy * 0.6;
    const k = Math.min(1, f.dt * 3.5); this.cam.x += (lx - this.cam.x) * k; this.cam.y += (ly - this.cam.y) * k;
    this.shake = Math.max(0, this.shake - f.dt * 2.5);
    const sh = f.reduced ? 0 : this.shake * 0.35;
    const cx = this.cam.x + Math.sin(t * 47) * sh, cy = this.cam.y + Math.cos(t * 39) * sh;
    const X = (x: number) => (x - cx) * S + W / 2, Y = (y: number) => (y - cy) * S + H / 2;
    const top = cy - H / 2 / S, bot = cy + H / 2 / S, left = cx - W / 2 / S, right = cx + W / 2 / S;
    const depth = Math.max(0, d.y);

    // ---- the water, darkening downwards; the sky above the surface
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, waterAt(Math.max(0, top))); g.addColorStop(1, waterAt(Math.max(0, bot)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (top < 0) this.sky(ctx, Y(0), W, t);
    // sunbeams in the shallows
    if (top < 90 && !f.lite) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const bx = ((i * 53 + Math.sin(t * 0.13 + i) * 9 - cx * 0.3) % 120 + 120) % 120 - 60, a = 0.05 * clamp(1 - top / 90, 0, 1);
        const x0 = W / 2 + bx * S, y0 = Math.max(Y(0), 0), y1 = Y(90);
        const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(190,240,255,${a})`); gr.addColorStop(1, 'rgba(190,240,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x0 - 2 * S, y0); ctx.lineTo(x0 + 2 * S, y0); ctx.lineTo(x0 + 9 * S, y1); ctx.lineTo(x0 + 3 * S, y1); ctx.fill();
      }
      ctx.restore();
    }
    // marine snow, drifting down past at two depths
    ctx.fillStyle = 'rgba(220,235,255,0.55)';
    for (const p of this.snow) {
      const px = ((p.x - cx * p.z) % 120 + 120) % 120, py = ((p.y + t * 0.35 * p.z - cy * p.z) % 80 + 80) % 80;
      const sx = (px / 120) * W, sy = (py / 80) * H; if (Y(0) > sy) continue;
      ctx.globalAlpha = 0.25 + 0.35 * p.z; ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.6, p.r * S * p.z), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- the rock, from cached tiles
    if (this.world) this.rock(ctx, left, right, top, bot, X, Y, S);
    // ---- the boat above, bells, vents
    this.boat(ctx, X, Y, S, t);
    if (this.world) for (const b of this.world.bells) if (b.y > top - 10 && b.y < bot + 10) this.bell(ctx, X(b.x), Y(b.y), b.r * S, t);
    if (this.world) for (const v of this.world.vents) if (v.y > top - 30 && v.y < bot + 5) this.vent(ctx, X(v.x), Y(v.y), S, t);
    // ---- creatures (their bodies; the darkness hides any not lit or glowing)
    for (const c of d.creatures) {
      if (c.caught || c.x < left - 12 || c.x > right + 12 || c.y < top - 12 || c.y > bot + 12) continue;
      this.creature(ctx, c, X(c.x), Y(c.y), S, t);
    }
    if (this.world && Math.abs(this.world.whale.y - cy) < 80) this.whale(ctx, X, Y, S, t, d);
    // ---- the sub
    this.sub(ctx, d, X(d.x), Y(d.y), S, t);
    // bubbles off the propeller
    this.bubbleStep(d, f.dt, f.lite);
    ctx.fillStyle = 'rgba(210,240,255,0.5)'; ctx.strokeStyle = 'rgba(230,250,255,0.7)'; ctx.lineWidth = 1;
    for (const b of this.bubbles) { if (b.y < 0) continue; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), Math.max(1, b.r * S), 0, TAU); ctx.stroke(); }

    // ---- the darkness, with light cut out of it
    this.lights(f, X, Y, S, depth);
    ctx.drawImage(this.dark, 0, 0, W, H);

    // ---- light on top: glows, echoes, the sonar ring, the lamp's haze
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // far-off plankton twinkling in the dark, drifting slower than the snow
    if (depth > 120) {
      const k2 = clamp((depth - 120) / 200, 0, 1);
      for (let i = 0; i < this.snow.length; i += 2) {
        const p = this.snow[i], px = ((p.y * 1.7 - cx * 0.25 * p.z) % 120 + 120) % 120, py = ((p.x * 0.66 - cy * 0.25 * p.z - t * 0.12) % 80 + 80) % 80;
        const tw = 0.5 + 0.5 * Math.sin(t * (0.8 + p.z) + i); ctx.globalAlpha = k2 * tw * 0.35;
        ctx.fillStyle = i % 6 === 0 ? '#ffd27a' : i % 4 === 0 ? '#c79bff' : '#7ff0ff';
        ctx.beginPath(); ctx.arc((px / 120) * W, (py / 80) * H, (0.8 + p.z) * this.dpr, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (d.lamp && !f.lite) this.haze(ctx, d, X, Y, S, depth);
    for (const c of d.creatures) {
      if (c.caught || c.x < left - 12 || c.x > right + 12 || c.y < top - 12 || c.y > bot + 12) continue;
      const col = glowOf(c), pulse = 0.75 + 0.25 * Math.sin(t * (c.kind === 'veil' ? 3 : 1.6) + c.phase);
      const r = (c.kind === 'grimlure' ? 2.2 : c.kind === 'veil' ? 2.6 : spec(c.kind as SpecId).size * 2.6) * S * pulse;
      const lx2 = c.kind === 'grimlure' ? X(c.x + lureOff(c).x) : X(c.x), ly2 = c.kind === 'grimlure' ? Y(c.y + lureOff(c).y) : Y(c.y);
      ctx.globalAlpha = c.kind === 'veil' ? 0.55 : 0.9; ctx.drawImage(this.glow(col), lx2 - r, ly2 - r, r * 2, r * 2);
      // sonar shows it for a while as a soft ring
      if (c.seen > d.t && c.kind !== 'veil') { ctx.globalAlpha = clamp((c.seen - d.t) / 4, 0, 1) * 0.5; ctx.strokeStyle = c.kind === 'grimlure' ? '#ff6a7a' : '#7ff6ff'; ctx.lineWidth = 1.5 * this.dpr; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), 2.2 * S, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    this.echoes(ctx, d, X, Y, S, f.mapped, left, right, top, bot);
    if (f.guide && f.guide.length) {
      ctx.fillStyle = '#f2fff0';
      for (let i = 0; i < f.guide.length; i += 2) { const p = f.guide[i], a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 5 - i * 0.4)); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), Math.max(1.5, 0.22 * S), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    for (const p of d.pings) {
      const age = d.t - p.t, r = age * SONAR_SPEED; if (r > p.range) continue;
      ctx.globalAlpha = 0.5 * (1 - r / p.range); ctx.strokeStyle = '#8ffcff'; ctx.lineWidth = 2.5 * this.dpr;
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r * S, 0, TAU); ctx.stroke();
      ctx.globalAlpha *= 0.4; ctx.lineWidth = 10 * this.dpr; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), Math.max(0, r - 1.2) * S, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
    // the sub's own little lights stay readable on top of the dark
    this.subLights(ctx, d, X(d.x), Y(d.y), S, t);
  }

  // ---------------------------------------------------------------- the sky, the surface and the boat
  private sky(ctx: CanvasRenderingContext2D, y0: number, W: number, t: number) {
    const g = ctx.createLinearGradient(0, 0, 0, y0); g.addColorStop(0, '#16163a'); g.addColorStop(0.6, '#3a2f63'); g.addColorStop(1, '#e58f73');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, y0);
    ctx.fillStyle = '#fff6dd';
    for (const s of this.stars) { const sy = s.y * y0 * 0.75; if (sy > y0 - 6) continue; ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 1.3 + s.x * 40); ctx.fillRect(s.x * W, sy, s.r * this.dpr, s.r * this.dpr); }
    ctx.globalAlpha = 1;
    // the moon, and its path on the water
    ctx.fillStyle = '#fff3c9'; ctx.beginPath(); ctx.arc(W * 0.78, y0 * 0.35, 18 * this.dpr, 0, TAU); ctx.fill();
    // the waterline
    ctx.strokeStyle = 'rgba(220,250,255,0.85)'; ctx.lineWidth = 2 * this.dpr; ctx.beginPath();
    for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * 0.02 + t * 1.6) * 2 * this.dpr; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
  }
  private boat(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
    if (!this.world) return;
    const bx = X(this.world.spine[0].x + 6), by = Y(0) + Math.sin(t * 1.4) * 0.15 * S;
    if (by < -6 * S || by > this.h + 6 * S) return;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 1.1) * 0.03);
    // hull
    ctx.fillStyle = '#7a3b2e'; ctx.beginPath(); ctx.moveTo(-6 * S, -0.8 * S); ctx.lineTo(6 * S, -0.8 * S); ctx.quadraticCurveTo(5 * S, 1.4 * S, 3 * S, 1.5 * S); ctx.lineTo(-4 * S, 1.5 * S); ctx.quadraticCurveTo(-6 * S, 0.8 * S, -6 * S, -0.8 * S); ctx.fill();
    ctx.fillStyle = '#e9d7b0'; ctx.fillRect(-6 * S, -1.1 * S, 12 * S, 0.35 * S);
    // cabin, mast and the winch
    ctx.fillStyle = '#d9c7a0'; ctx.fillRect(-4.5 * S, -3.6 * S, 3.6 * S, 2.6 * S); ctx.fillStyle = '#ffd98a'; ctx.fillRect(-3.9 * S, -3 * S, 1.1 * S, 0.9 * S);
    ctx.strokeStyle = '#5b3a2a'; ctx.lineWidth = 0.25 * S; ctx.beginPath(); ctx.moveTo(1.5 * S, -1 * S); ctx.lineTo(1.5 * S, -7 * S); ctx.lineTo(4.6 * S, -2.5 * S); ctx.stroke();
    // the lantern
    ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(4.2 * S, -2.2 * S, 0.35 * S, 0, TAU); ctx.fill();
    // Enzo at the rail with his headphones
    drawChinchilla(ctx, 'enzo', -0.5 * S, -1.05 * S, { face: -1, h: 2.6 * S, time: t, decorate: (c) => { c.strokeStyle = '#222'; c.lineWidth = 1.2; c.beginPath(); c.arc(12, 6, 5, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.fillStyle = '#333'; c.fillRect(6, 6, 2.6, 3.4); c.fillRect(15.5, 6, 2.6, 3.4); } });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glow('#ffcf6a'), bx + 4.2 * S - 3 * S, by - 2.2 * S - 3 * S, 6 * S, 6 * S); ctx.restore();
  }

  // ---------------------------------------------------------------- rock tiles
  private rock(ctx: CanvasRenderingContext2D, left: number, right: number, top: number, bot: number, X: (x: number) => number, Y: (y: number) => number, S: number) {
    const tx0 = Math.floor(left / TILE_M), tx1 = Math.floor(right / TILE_M), ty0 = Math.floor(Math.max(0, top) / TILE_M), ty1 = Math.floor(bot / TILE_M);
    const sz = TILE_M * S;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx * TILE_M >= GW * CELL || ty * TILE_M >= GH * CELL) continue;
      ctx.drawImage(this.tile(tx, ty), Math.floor(X(tx * TILE_M)), Math.floor(Y(ty * TILE_M)), Math.ceil(sz) + 1, Math.ceil(sz) + 1);
    }
    // outside the world: solid rock
    ctx.fillStyle = '#0d0b14';
    if (X(0) > 0) ctx.fillRect(0, Math.max(0, Y(0)), X(0), this.h);
    if (X(GW * CELL) < this.w) ctx.fillRect(X(GW * CELL), Math.max(0, Y(0)), this.w, this.h);
  }
  /** A rock tile, shaded per pixel from a smoothed copy of the distance field: darker deeper into the rock so the walls
   * read as rounded, sediment on the ledges that face up, a shadowed lip on the ones facing down, strata and grit. */
  private tile(tx: number, ty: number) {
    const key = `${tx},${ty}`; const hit = this.tiles.get(key); if (hit) return hit;
    const w = this.world!, R = Math.max(64, Math.min(512, Math.round((TILE_M * this.scale) / 2))), pm = R / TILE_M;
    const cv = document.createElement('canvas'); cv.width = cv.height = R;
    const c = cv.getContext('2d')!, x0 = tx * TILE_M, y0 = ty * TILE_M;
    const img = c.createImageData(R, R), px = img.data, aa = 1.6 / pm;
    const t = clamp((y0 + TILE_M / 2) / 700, 0, 1);
    const mx = (a: string, b: string) => { const x = hex(a), y = hex(b); return x.map((v, q) => lerp(v, y[q], t)); };
    const rock = mx('#56707e', '#30264a'), sand = mx('#d8c590', '#8a73b8'), lip = mx('#1c2a33', '#0e0a18');
    for (let j = 0; j < R; j++) {
      const wy = y0 + (j + 0.5) / pm;
      for (let i = 0; i < R; i++) {
        const wx = x0 + (i + 0.5) / pm, v = this.rockAt(wx, wy), o = (j * R + i) * 4;
        if (v >= aa) { px[o + 3] = 0; continue; }
        // the slope of the field points out of the rock, towards the water
        const gx = this.rockAt(wx + 0.3, wy) - v, gy = this.rockAt(wx, wy + 0.3) - v, gl = Math.hypot(gx, gy) || 1, ny = gy / gl;
        const depthIn = clamp(-v / 4.5, 0, 1), near = 1 - clamp(-v / 1.1, 0, 1);
        const n1 = vnoise(wx * 0.45, wy * 0.45), grit = hash2(Math.floor(wx * 6), Math.floor(wy * 6));
        let k = (1 - 0.6 * depthIn * depthIn) * (0.92 + 0.12 * Math.sin(wy * 1.6 + n1 * 5)) * (0.94 + 0.12 * grit);
        let r = rock[0] * k, g = rock[1] * k, b = rock[2] * k;
        const up = near * clamp(-ny, 0, 1), down = near * clamp(ny, 0, 1);
        r += (sand[0] - r) * up * 0.85; g += (sand[1] - g) * up * 0.85; b += (sand[2] - b) * up * 0.85;
        r += (lip[0] - r) * down * 0.7; g += (lip[1] - g) * down * 0.7; b += (lip[2] - b) * down * 0.7;
        px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255 * clamp((aa - v) / (aa * 2), 0, 1);
      }
    }
    c.putImageData(img, 0, 0);
    // weed and coral on the ledges in the upper zones, glowing polyps lower down
    let sd = (tx * 7919 + ty * 104729) | 1; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const depth = y0 + TILE_M / 2;
    for (let k = 0; k < 70; k++) {
      const wx = x0 + r() * TILE_M, wy = y0 + r() * TILE_M, v = this.rockAt(wx, wy);
      if (v < -0.15 || v > 0.05 || this.rockAt(wx, wy - 0.6) < 0.3) continue;
      const x = (wx - x0) * pm, y = (wy - y0) * pm, hgt = (0.6 + r() * 1.6) * pm;
      if (depth < 220) { c.strokeStyle = r() < 0.5 ? 'rgba(80,160,100,0.9)' : 'rgba(120,180,80,0.85)'; c.lineWidth = Math.max(1, 0.12 * pm); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * hgt, y - hgt * 0.6, x + (r() - 0.5) * hgt * 0.6, y - hgt); c.stroke(); }
      else if (depth < 620) { c.fillStyle = r() < 0.5 ? 'rgba(200,110,170,0.8)' : 'rgba(150,120,220,0.8)'; for (let q = 0; q < 3; q++) { c.beginPath(); c.arc(x + (q - 1) * 0.25 * pm, y - (0.2 + r() * 0.4) * pm, (0.1 + r() * 0.12) * pm, 0, TAU); c.fill(); } }
      else { c.fillStyle = 'rgba(255,140,90,0.75)'; c.beginPath(); c.ellipse(x, y - 0.15 * pm, 0.18 * pm, 0.1 * pm, 0, 0, TAU); c.fill(); }
    }
    this.tiles.set(key, cv); this.tileOrder.push(key);
    if (this.tileOrder.length > 48) this.tiles.delete(this.tileOrder.shift()!);
    return cv;
  }
  /** the smoothed distance field (negative in rock), with a little noise so the walls aren't straight */
  private rockAt(x: number, y: number) {
    const f = this.smooth!, fx = x / CELL - 0.5, fy = y / CELL - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
    const at = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= GW || gy >= GH ? -3 : f[gy * GW + gx]);
    const v = (at(ix, iy) * (1 - ax) + at(ix + 1, iy) * ax) * (1 - ay) + (at(ix, iy + 1) * (1 - ax) + at(ix + 1, iy + 1) * ax) * ay;
    return v + (vnoise(x * 0.7, y * 0.7) - 0.5) * 0.45 + (vnoise(x * 2.3, y * 2.3) - 0.5) * 0.15;
  }

  // ---------------------------------------------------------------- light and dark
  private lights(f: FrameView, X: (x: number) => number, Y: (y: number) => number, S: number, depth: number) {
    const c = this.dctx, d = f.dive, k = 0.5, W = this.dark.width, H = this.dark.height, t = f.time;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
    c.fillStyle = `rgba(2,3,10,${darkAt(depth)})`; c.fillRect(0, 0, W, H);
    // above the surface it is never dark
    const yS = Y(0) * k; if (yS > 0) c.clearRect(0, 0, W, Math.min(H, yS + 2));
    c.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a: number) => { if (r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
    const sx = X(d.x) * k, sy = Y(d.y) * k;
    // a small glow round the sub, and the lamp: a cone cast against the rock
    hole(sx, sy, 4.2 * S * k, 0.85);
    if (d.lamp) {
      const L = d.lampDir, base = Math.atan2(L.y, L.x), R = d.st.lamp, rays = 48, spread = 0.62, poly: [number, number][] = [[sx, sy]];
      for (let i = 0; i <= rays; i++) {
        const a = base - spread + (2 * spread * i) / rays, dx = Math.cos(a), dy = Math.sin(a);
        let dist = 0.8; while (dist < R) { const s = sdfAt(d.w, d.x + dx * dist, d.y + dy * dist); if (s < 0) break; dist += Math.max(0.3, s * 0.8); }
        dist = Math.min(R, dist + 0.6); poly.push([X(d.x + dx * dist) * k, Y(d.y + dy * dist) * k]);
      }
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, R * S * k);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); for (const p of poly) c.lineTo(p[0], p[1]); c.closePath(); c.fill();
    }
    // things that glow light their own patch of water
    for (const cr of d.creatures) {
      if (cr.caught) continue; const px = X(cr.x) * k, py = Y(cr.y) * k; if (px < -80 || py < -80 || px > W + 80 || py > H + 80) continue;
      const big = cr.kind === 'grimlure' ? 0.9 : cr.kind === 'veil' ? 1.8 : spec(cr.kind as SpecId).size * 2.3;
      const o = cr.kind === 'grimlure' ? lureOff(cr) : { x: 0, y: 0 };
      hole(X(cr.x + o.x) * k, Y(cr.y + o.y) * k, big * S * k * (0.85 + 0.15 * Math.sin(t * 1.6 + cr.phase)), cr.kind === 'grimlure' ? 0.5 : 0.6);
    }
    if (d.w) {
      for (const b of d.w.bells) hole(X(b.x) * k, Y(b.y) * k, b.r * 2.2 * S * k, 0.7);
      for (const v of d.w.vents) hole(X(v.x) * k, Y(v.y - 1) * k, 6 * S * k, 0.55);
      const wh = d.w.whale; if (Math.abs(wh.y - d.y) < 80) hole(X(wh.x) * k, Y(wh.y) * k, wh.r * 1.4 * S * k, 0.6);
    }
    // a sonar ping briefly lights the water it passes through
    for (const p of d.pings) { const r = (d.t - p.t) * SONAR_SPEED; if (r < p.range) { c.lineWidth = 2.4 * S * k; c.strokeStyle = `rgba(0,0,0,${0.22 * (1 - r / p.range)})`; c.beginPath(); c.arc(X(p.x) * k, Y(p.y) * k, r * S * k, 0, TAU); c.stroke(); } }
    c.globalCompositeOperation = 'source-over';
  }
  private haze(ctx: CanvasRenderingContext2D, d: Dive, X: (x: number) => number, Y: (y: number) => number, S: number, depth: number) {
    const L = d.lampDir, base = Math.atan2(L.y, L.x), R = d.st.lamp, sx = X(d.x + L.x * 1.2), sy = Y(d.y + L.y * 1.2);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * S);
    const a = 0.16 * clamp(depth / 120, 0.3, 1);
    g.addColorStop(0, `rgba(255,236,180,${a})`); g.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, R * S, base - 0.5, base + 0.5); ctx.closePath(); ctx.fill();
  }
  private echoes(ctx: CanvasRenderingContext2D, d: Dive, X: (x: number) => number, Y: (y: number) => number, S: number, mapped: Uint8Array, left: number, right: number, top: number, bot: number) {
    // walls mapped on earlier pings are remembered as a faint stipple
    const w = d.w, gx0 = Math.max(1, Math.floor(left / CELL)), gx1 = Math.min(GW - 2, Math.ceil(right / CELL)), gy0 = Math.max(1, Math.floor(top / CELL)), gy1 = Math.min(GH - 2, Math.ceil(bot / CELL));
    ctx.fillStyle = 'rgba(110,230,255,0.22)'; const r0 = Math.max(1, 0.07 * S);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const i = gy * GW + gx; if (!mapped[i] || !w.solid[i]) continue;
      if (w.solid[i - 1] && w.solid[i + 1] && w.solid[i - GW] && w.solid[i + GW]) continue;
      ctx.beginPath(); ctx.arc(X((gx + 0.5) * CELL), Y((gy + 0.5) * CELL), r0, 0, TAU); ctx.fill();
    }
    // fresh echoes: bright as the ping reaches them, fading over seven seconds
    for (const e of d.echoes) {
      const age = d.t - e.t; if (age < 0 || e.x < left - 2 || e.x > right + 2 || e.y < top - 2 || e.y > bot + 2) continue;
      const a = age < 0.25 ? 1 : Math.max(0, 1 - (age - 0.25) / 6.75);
      ctx.fillStyle = age < 0.4 ? `rgba(230,255,255,${a})` : `rgba(90,230,255,${a * 0.8})`;
      const r = (age < 0.4 ? 0.17 : 0.11) * S; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), Math.max(1, r), 0, TAU); ctx.fill();
    }
  }
  private glow(col: string) {
    const hit = this.glows.get(col); if (hit) return hit;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, rgba(col, 0.9)); g.addColorStop(0.25, rgba(col, 0.45)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); this.glows.set(col, cv); return cv;
  }

  // ---------------------------------------------------------------- the sub
  private sub(ctx: CanvasRenderingContext2D, d: Dive, x: number, y: number, S: number, t: number) {
    const f = d.face, tilt = clamp(d.vy * 0.06, -0.35, 0.35) * f;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(f, 1);
    const L = SUB_R * 1.6 * S, Hh = SUB_R * 1.05 * S;
    // the propeller
    const spin = Math.sin(t * (6 + d.speed * 8)), px = -L * 1.05;
    ctx.fillStyle = '#5b5348'; ctx.fillRect(px - 0.1 * S, -0.15 * S, 0.5 * S, 0.3 * S);
    ctx.fillStyle = '#c9b26a'; ctx.beginPath(); ctx.ellipse(px, 0, 0.18 * S, Math.abs(spin) * 0.75 * S + 0.08 * S, 0, 0, TAU); ctx.fill();
    // tail fins
    ctx.fillStyle = '#e0a425'; ctx.beginPath(); ctx.moveTo(-L * 0.7, -Hh * 0.2); ctx.lineTo(-L * 1.0, -Hh * 0.95); ctx.lineTo(-L * 0.45, -Hh * 0.55); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L * 0.7, Hh * 0.2); ctx.lineTo(-L * 1.0, Hh * 0.95); ctx.lineTo(-L * 0.45, Hh * 0.55); ctx.fill();
    // the hull: a round yellow body, darker below
    const g = ctx.createLinearGradient(0, -Hh, 0, Hh); g.addColorStop(0, '#ffe066'); g.addColorStop(0.55, '#f5b81f'); g.addColorStop(1, '#b8760f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, L, Hh, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b3f0a'; ctx.lineWidth = Math.max(1.5, 0.09 * S); ctx.stroke();
    // a hatch on top, rivets, the lamp housing at the nose
    ctx.fillStyle = '#e6a51c'; ctx.beginPath(); ctx.ellipse(-L * 0.15, -Hh * 0.98, L * 0.26, Hh * 0.22, 0, Math.PI, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9c6512'; for (let i = 0; i < 7; i++) { const a = Math.PI * (0.62 + i * 0.11); ctx.beginPath(); ctx.arc(Math.cos(a) * L * 0.86, Math.sin(a) * Hh * 0.86, 0.06 * S, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#444'; ctx.beginPath(); ctx.ellipse(L * 0.96, Hh * 0.18, 0.22 * S, 0.3 * S, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = d.lamp ? '#fff4c2' : '#5a5a60'; ctx.beginPath(); ctx.ellipse(L * 1.02, Hh * 0.18, 0.12 * S, 0.22 * S, 0, 0, TAU); ctx.fill();
    // the porthole, with Dora behind the glass
    const pr = Hh * 0.62, pxp = L * 0.28;
    ctx.save(); ctx.beginPath(); ctx.arc(pxp, -Hh * 0.08, pr, 0, TAU); ctx.clip();
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(pxp - pr, -Hh - pr, pr * 2, pr * 3);
    ctx.fillStyle = 'rgba(255,190,90,0.55)'; ctx.fillRect(pxp - pr, -Hh - pr, pr * 2, pr * 3);
    drawChinchilla(ctx, 'dora', pxp - pr * 0.15, -Hh * 0.08 + pr * 1.55, { face: 1, h: pr * 2.6, time: t, blink: Math.sin(t * 0.7) > 0.985,
      decorate: (c) => { c.fillStyle = '#7a4a26'; c.beginPath(); c.ellipse(13, 6.5, 6.2, 3.2, 0, Math.PI, TAU); c.fill(); c.fillStyle = '#c9a25a'; c.beginPath(); c.arc(11, 4.6, 1.4, 0, TAU); c.arc(15, 4.6, 1.4, 0, TAU); c.fill(); } });
    // glass sheen
    ctx.fillStyle = 'rgba(200,240,255,0.18)'; ctx.beginPath(); ctx.ellipse(pxp - pr * 0.3, -Hh * 0.08 - pr * 0.4, pr * 0.55, pr * 0.3, -0.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#a8813c'; ctx.lineWidth = Math.max(2, 0.16 * S); ctx.beginPath(); ctx.arc(pxp, -Hh * 0.08, pr, 0, TAU); ctx.stroke();
    // samples in the tray: little glowing jars on the belly
    ctx.restore();
    // damage: a crack and a hiss when the hull is low
    if (d.hull < d.st.hullMax * 0.35) { ctx.strokeStyle = 'rgba(40,20,0,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 0.6 * S, y - 0.3 * S); ctx.lineTo(x - 0.2 * S, y); ctx.lineTo(x - 0.5 * S, y + 0.4 * S); ctx.stroke(); }
  }
  private subLights(ctx: CanvasRenderingContext2D, d: Dive, x: number, y: number, S: number, t: number) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const f = d.face, L = SUB_R * 1.6 * S;
    // porthole glow and a blinking tail light
    ctx.globalAlpha = 0.5; ctx.drawImage(this.glow('#ffb84d'), x + f * L * 0.28 - 1.6 * S, y - 1.7 * S, 3.2 * S, 3.2 * S);
    ctx.globalAlpha = Math.sin(t * 4) > 0.6 ? 0.9 : 0.25; ctx.drawImage(this.glow('#ff4d6a'), x - f * L * 0.95 - 0.7 * S, y - 1.4 * S, 1.4 * S, 1.4 * S);
    if (d.lamp) { ctx.globalAlpha = 0.9; ctx.drawImage(this.glow('#fff1c2'), x + f * L * 1.02 - 1.1 * S, y + 0.25 * S - 1.1 * S, 2.2 * S, 2.2 * S); }
    ctx.restore();
  }
  private bubbleStep(d: Dive, dt: number, lite: boolean) {
    const thrust = d.speed > 0.6;
    if (thrust && !lite && Math.random() < dt * (8 + d.speed * 6)) this.bubbles.push({ x: d.x - d.face * SUB_R * 1.7, y: d.y + (Math.random() - 0.5) * 0.4, vx: -d.face * (0.5 + Math.random()), vy: -0.4, r: 0.06 + Math.random() * 0.12, life: 3 });
    for (const b of this.bubbles) { b.vy -= 0.9 * dt; b.vy *= 0.97; b.vx *= 0.94; b.x += (b.vx + Math.sin(b.life * 9) * 0.3) * dt; b.y += b.vy * dt; b.life -= dt; }
    if (this.bubbles.length) this.bubbles = this.bubbles.filter((b) => b.life > 0 && b.y > 0);
    if (this.bubbles.length > 160) this.bubbles.splice(0, this.bubbles.length - 160);
  }

  // ---------------------------------------------------------------- places
  private bell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
    // a silver pocket of air trapped under the rock, its surface shivering
    const g = ctx.createRadialGradient(x, y - r * 0.4, r * 0.1, x, y, r * 1.2); g.addColorStop(0, 'rgba(235,250,255,0.85)'); g.addColorStop(1, 'rgba(160,210,240,0.15)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - r * 1.1, y + r * 0.2);
    for (let i = 0; i <= 12; i++) { const k = i / 12; ctx.lineTo(x - r * 1.1 + k * r * 2.2, y + r * 0.2 + Math.sin(t * 3 + k * 9) * r * 0.05); }
    ctx.ellipse(x, y + r * 0.2, r * 1.1, r * 1.2, 0, 0, Math.PI, true); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 5; i++) { const by = y + r * (0.8 + ((t * 0.6 + i * 0.37) % 1) * 1.6); ctx.beginPath(); ctx.arc(x + Math.sin(i * 2 + t) * r * 0.6, by, r * 0.06, 0, TAU); ctx.fill(); }
  }
  private vent(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number) {
    ctx.fillStyle = '#231a1a'; ctx.beginPath(); ctx.moveTo(x - 1.4 * S, y + 1 * S); ctx.lineTo(x - 0.5 * S, y - 1.6 * S); ctx.lineTo(x + 0.5 * S, y - 1.6 * S); ctx.lineTo(x + 1.4 * S, y + 1 * S); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.glow('#ff6a2a'), x - 1.5 * S, y - 3 * S, 3 * S, 3 * S);
    for (let i = 0; i < 14; i++) { const k = ((t * 0.5 + i / 14) % 1), py = y - 1.6 * S - k * 20 * S, px = x + Math.sin(t * 2 + i) * (0.3 + k * 1.6) * S; ctx.globalAlpha = (1 - k) * 0.35; ctx.drawImage(this.glow('#ff9a4a'), px - 0.9 * S, py - 0.9 * S, 1.8 * S, 1.8 * S); }
    ctx.restore();
  }
  private whale(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, S: number, t: number, d: Dive) {
    const wh = d.w.whale, cx = wh.x + Math.sin(t * 0.07) * wh.r * 0.35, cy = wh.y + Math.sin(t * 0.11) * 4, L = wh.r * 0.95, dir = Math.cos(t * 0.07) > 0 ? 1 : -1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // a whale outlined in lanterns: the body, the tail, a fin, an eye
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; const body = 0.42 + 0.1 * Math.cos(a); pts.push([Math.cos(a) * L, Math.sin(a) * L * body * (Math.cos(a) > 0 ? 0.95 : 0.7), 1]); }
    for (let i = 0; i < 8; i++) { const k = i / 7; pts.push([-L * (1 + k * 0.35), Math.sin(t * 0.8) * k * 3 + (k - 0.5) * L * 0.35 * (i % 2 ? 1 : -1) * k, 0.8]); }
    for (let i = 0; i < 6; i++) pts.push([L * 0.1 + i * 1.2, L * 0.3 + i * 1.1, 0.7]);
    for (const [px, py, s] of pts) { const x = X(cx + px * dir), y = Y(cy + py); const tw = 0.6 + 0.4 * Math.sin(t * 2 + px); ctx.globalAlpha = tw; ctx.drawImage(this.glow(px > 0 ? '#ffd27a' : '#9fe8ff'), x - s * S, y - s * S, s * 2 * S, s * 2 * S); }
    ctx.globalAlpha = 1; ctx.drawImage(this.glow('#ffffff'), X(cx + L * 0.62 * dir) - 0.9 * S, Y(cy - L * 0.08) - 0.9 * S, 1.8 * S, 1.8 * S);
    ctx.restore();
  }

  // ---------------------------------------------------------------- creatures
  private creature(ctx: CanvasRenderingContext2D, c: Creature, x: number, y: number, S: number, t: number) {
    const k = c.kind, ph = c.phase, face = c.vx < -0.05 ? -1 : 1;
    ctx.save(); ctx.translate(x, y);
    if (k === 'grimlure') {
      ctx.scale(c.vx < 0 ? -1 : 1, 1);
      ctx.fillStyle = '#0d1418'; ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * S, 2 * S, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2.3 * S, 0); ctx.lineTo(-4 * S, -1.2 * S + Math.sin(t * 3) * 0.4 * S); ctx.lineTo(-4 * S, 1.2 * S); ctx.fill();
      ctx.strokeStyle = '#d9e4e0'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(1 * S + i * 0.25 * S, 0.5 * S); ctx.lineTo(1.1 * S + i * 0.25 * S, 0.9 * S); ctx.stroke(); }
      ctx.strokeStyle = '#2a3a3a'; ctx.lineWidth = Math.max(1, 0.12 * S); ctx.beginPath(); ctx.moveTo(0.5 * S, -1.8 * S); ctx.quadraticCurveTo(1.5 * S, -3.6 * S, 2.6 * S, -2.6 * S); ctx.stroke();
      ctx.fillStyle = c.state === 'hunt' ? '#ffdede' : '#cfe8e0'; ctx.beginPath(); ctx.arc(1.4 * S, -0.6 * S, 0.22 * S, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7ffff0'; ctx.beginPath(); ctx.arc(2.6 * S, -2.6 * S, 0.3 * S, 0, TAU); ctx.fill();
    } else if (k === 'veil') {
      ctx.fillStyle = 'rgba(190,120,255,0.35)'; ctx.strokeStyle = 'rgba(230,180,255,0.6)'; ctx.lineWidth = 1;
      const pul = 1 + Math.sin(t * 2 + ph) * 0.08;
      ctx.beginPath(); ctx.ellipse(0, 0, 1.3 * S * pul, 1 * S / pul, 0, Math.PI, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,200,0.45)';
      for (let i = 0; i < 7; i++) { const ox = (i - 3) * 0.35 * S; ctx.beginPath(); ctx.moveTo(ox, 0); for (let j = 1; j <= 6; j++) ctx.lineTo(ox + Math.sin(t * 1.5 + i + j * 0.8) * 0.3 * S, j * 0.65 * S); ctx.stroke(); }
    } else {
      const s = spec(k), col = s.glow, sz = s.size * S;
      ctx.scale(face, 1);
      switch (k) {
        case 'mothjelly': {
          const flap = Math.sin(t * 3 + ph);
          ctx.fillStyle = rgba(col, 0.35); ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1;
          for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * 0.8 * sz, -0.1 * sz, 0.7 * sz, (0.35 + 0.15 * flap) * sz, sgn * 0.5, 0, TAU); ctx.fill(); ctx.stroke(); }
          ctx.beginPath(); ctx.ellipse(0, 0, 0.6 * sz, 0.55 * sz, 0, Math.PI, TAU); ctx.fill(); ctx.stroke();
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo((i - 1.5) * 0.25 * sz, 0); ctx.quadraticCurveTo((i - 1.5) * 0.3 * sz + Math.sin(t * 2 + i) * 0.2 * sz, 0.8 * sz, (i - 1.5) * 0.2 * sz, 1.4 * sz); ctx.stroke(); }
          break;
        }
        case 'ribboneel': case 'hatchet': case 'lanternjaw': {
          if (k === 'ribboneel') {
            ctx.lineCap = 'round'; ctx.strokeStyle = '#c9d6e3'; ctx.lineWidth = 0.32 * sz; ctx.beginPath();
            for (let i = 0; i <= 12; i++) { const px = (0.9 - i * 0.18) * sz * 1.4, py = Math.sin(t * 5 + i * 0.7 + ph) * 0.25 * sz; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
            ctx.strokeStyle = col; ctx.lineWidth = 0.08 * sz; ctx.stroke();
            ctx.fillStyle = '#10202c'; ctx.beginPath(); ctx.arc(1.15 * sz, -0.05 * sz, 0.07 * sz, 0, TAU); ctx.fill();
          } else if (k === 'hatchet') {
            ctx.fillStyle = '#cfd8e8'; ctx.beginPath(); ctx.moveTo(0.6 * sz, -0.1 * sz); ctx.lineTo(-0.2 * sz, -0.55 * sz); ctx.lineTo(-0.6 * sz, -0.1 * sz); ctx.lineTo(-0.9 * sz, -0.3 * sz); ctx.lineTo(-0.9 * sz, 0.2 * sz); ctx.lineTo(-0.5 * sz, 0.1 * sz); ctx.lineTo(0, 0.45 * sz); ctx.closePath(); ctx.fill();
            ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((-0.35 + i * 0.15) * sz, 0.3 * sz - Math.abs(i - 2) * 0.03 * sz, 0.05 * sz, 0, TAU); ctx.fill(); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0.32 * sz, -0.15 * sz, 0.12 * sz, 0, TAU); ctx.fill();
          } else {
            ctx.fillStyle = '#2b2236'; ctx.beginPath(); ctx.arc(0, 0, 0.55 * sz, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-0.45 * sz, 0); ctx.lineTo(-0.95 * sz, -0.35 * sz + Math.sin(t * 4) * 0.1 * sz); ctx.lineTo(-0.95 * sz, 0.35 * sz); ctx.fill();
            ctx.strokeStyle = '#4b3b55'; ctx.lineWidth = 0.06 * sz; ctx.beginPath(); ctx.moveTo(0.2 * sz, -0.5 * sz); ctx.quadraticCurveTo(0.6 * sz, -1.1 * sz, 0.85 * sz, -0.7 * sz); ctx.stroke();
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0.85 * sz, -0.7 * sz, 0.12 * sz, 0, TAU); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0.25 * sz, -0.12 * sz, 0.1 * sz, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'krill': {
          ctx.fillStyle = col;
          for (let i = 0; i < 26; i++) { const a = t * (0.6 + (i % 5) * 0.12) + i * 2.4 + ph, r = (0.3 + ((i * 37) % 10) / 10) * sz; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a * 1.3) * r * 0.6, 0.09 * S, 0.05 * S, a, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = 1; break;
        }
        case 'crownsquid': {
          ctx.fillStyle = '#8a64c9'; ctx.beginPath(); ctx.ellipse(-0.3 * sz, 0, 0.7 * sz, 0.4 * sz, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#a07ad8'; ctx.lineWidth = 0.08 * sz; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.3 * sz, (i - 2) * 0.08 * sz); ctx.quadraticCurveTo(0.8 * sz, (i - 2) * 0.2 * sz + Math.sin(t * 3 + i) * 0.1 * sz, 1.2 * sz, (i - 2) * 0.25 * sz); ctx.stroke(); }
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, on = Math.floor(t * 4) % 8 === i; ctx.fillStyle = on ? '#fff' : col; ctx.beginPath(); ctx.arc(0.25 * sz + Math.cos(a) * 0.12 * sz, Math.sin(a) * 0.38 * sz, (on ? 0.09 : 0.06) * sz, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0.18 * sz, -0.08 * sz, 0.08 * sz, 0, TAU); ctx.fill(); break;
        }
        case 'ghostray': {
          const flap = Math.sin(t * 1.6 + ph) * 0.35;
          ctx.fillStyle = 'rgba(230,245,255,0.35)'; ctx.strokeStyle = 'rgba(240,250,255,0.7)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0.8 * sz, 0); ctx.quadraticCurveTo(0, -(0.9 + flap) * sz, -0.4 * sz, -(1 + flap) * sz); ctx.quadraticCurveTo(-0.2 * sz, 0, -0.4 * sz, (1 + flap) * sz); ctx.quadraticCurveTo(0, (0.9 + flap) * sz, 0.8 * sz, 0); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-0.3 * sz, 0); ctx.lineTo(-1.3 * sz, Math.sin(t * 2) * 0.1 * sz); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.2 * sz - i * 0.12 * sz, 0); ctx.lineTo(-0.2 * sz - i * 0.05 * sz, -(0.8 + flap) * sz * (1 - i * 0.12)); ctx.stroke(); }
          break;
        }
        case 'teacup': {
          const flap = Math.sin(t * 2.4 + ph);
          ctx.fillStyle = '#f2a07c';
          for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * 0.45 * sz, -0.45 * sz, 0.28 * sz, (0.16 + flap * 0.06) * sz, sgn * (0.6 + flap * 0.3), 0, TAU); ctx.fill(); }
          ctx.beginPath(); ctx.arc(0, -0.1 * sz, 0.45 * sz, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-0.45 * sz, 0); for (let i = 0; i <= 8; i++) ctx.lineTo(-0.45 * sz + i * 0.1125 * sz, 0.35 * sz + (i % 2) * 0.15 * sz + Math.sin(t * 3 + i) * 0.03 * sz); ctx.lineTo(0.45 * sz, 0); ctx.fill();
          ctx.fillStyle = '#2a1a1a'; ctx.beginPath(); ctx.arc(0.13 * sz, -0.15 * sz, 0.06 * sz, 0, TAU); ctx.arc(-0.13 * sz, -0.15 * sz, 0.06 * sz, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,130,150,0.5)'; ctx.beginPath(); ctx.arc(0.25 * sz, -0.02 * sz, 0.06 * sz, 0, TAU); ctx.arc(-0.25 * sz, -0.02 * sz, 0.06 * sz, 0, TAU); ctx.fill(); break;
        }
        case 'starseed': {
          ctx.fillStyle = 'rgba(150,100,210,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0.3 * sz, 0.9 * sz, 0.32 * sz, Math.sin(t * 0.5 + ph) * 0.05, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff'; for (let i = 0; i < 12; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.beginPath(); ctx.arc((-0.7 + i * 0.13) * sz, 0.3 * sz + Math.sin(i * 3) * 0.12 * sz, 0.04 * sz, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.85 * sz, 0.2 * sz); ctx.lineTo(1.1 * sz + Math.sin(t * 2 + i) * 0.1 * sz, (i - 2) * 0.12 * sz); ctx.stroke(); }
          break;
        }
        case 'siphon': {
          for (let i = 0; i < 9; i++) {
            const px = (1 - i * 0.28) * sz * 0.9, py = Math.sin(t * 0.8 + i * 0.6 + ph) * 0.35 * sz, hue = ['#ffcf6a', '#ffb07a', '#ff8fb0', '#c79bff', '#8fd8ff', '#7fffd4'][i % 6];
            ctx.fillStyle = rgba(hue, 0.5); ctx.strokeStyle = rgba(hue, 0.85); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px, py, 0.16 * sz, 0.2 * sz, 0, 0, TAU); ctx.fill(); ctx.stroke();
          }
          break;
        }
        case 'isopod': {
          ctx.fillStyle = '#b7a8d8'; ctx.beginPath(); ctx.ellipse(0, 0.35 * sz, 0.8 * sz, 0.42 * sz, 0, Math.PI, TAU); ctx.fill();
          ctx.strokeStyle = '#7d6ea3'; ctx.lineWidth = 1; for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo((-0.8 + i * 0.23) * sz, 0.35 * sz); ctx.lineTo((-0.8 + i * 0.23) * sz, (0.35 - 0.38 * Math.sin((i / 7) * Math.PI)) * sz); ctx.stroke(); }
          ctx.strokeStyle = '#d6c8ff'; ctx.beginPath(); ctx.moveTo(0.75 * sz, 0.2 * sz); ctx.quadraticCurveTo(1.1 * sz, -0.1 * sz, 1.2 * sz + Math.sin(t * 2) * 0.05 * sz, 0.05 * sz); ctx.stroke();
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo((-0.5 + i * 0.2) * sz, 0.35 * sz); ctx.lineTo((-0.55 + i * 0.2) * sz + Math.sin(t * 6 + i) * 0.04 * sz, 0.5 * sz); ctx.stroke(); }
          break;
        }
        case 'ventsnail': {
          ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.ellipse(0.1 * sz, 0.4 * sz, 0.7 * sz, 0.15 * sz, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3a2f33'; ctx.beginPath(); ctx.arc(-0.1 * sz, 0.05 * sz, 0.42 * sz, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#6b5a5f'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i <= 30; i++) { const a = i * 0.45, r = 0.38 * sz * (1 - i / 34); const px = -0.1 * sz + Math.cos(a) * r, py = 0.05 * sz + Math.sin(a) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
          ctx.strokeStyle = '#ff8a5a'; ctx.beginPath(); ctx.moveTo(0.65 * sz, 0.35 * sz); ctx.lineTo(0.85 * sz, 0.05 * sz); ctx.stroke(); break;
        }
      }
    }
    ctx.restore();
  }
}

const hash2 = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** smooth value noise, 0..1 */
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
const glowOf = (c: Creature) => (c.kind === 'grimlure' ? '#7ffff0' : c.kind === 'veil' ? '#c88cff' : spec(c.kind as SpecId).glow);
const lureOff = (c: Creature) => ({ x: (c.vx < 0 ? -1 : 1) * 2.6, y: -2.6 });

/** The sonar map for the map screen: charted water by depth, charted rock dark, the rest unknown. One pixel a cell. */
export function drawMap(c: CanvasRenderingContext2D, w: World, mapped: Uint8Array) {
  const img = c.createImageData(GW, GH), px = img.data;
  for (let i = 0; i < GW * GH; i++) {
    const y = Math.floor(i / GW), o = i * 4;
    if (y < 7 && !w.solid[i]) { px[o] = 70; px[o + 1] = 160; px[o + 2] = 190; px[o + 3] = 255; continue; }
    if (!mapped[i]) { px[o + 3] = 0; continue; }
    if (w.solid[i]) { px[o] = 60; px[o + 1] = 210; px[o + 2] = 235; px[o + 3] = 255; }
    else { const k = y / GH; px[o] = 20 + 10 * (1 - k); px[o + 1] = 60 * (1 - k) + 20; px[o + 2] = 110 * (1 - k) + 50; px[o + 3] = 255; }
  }
  c.putImageData(img, 0, 0);
}
