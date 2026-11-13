// The Arcade After Dark: drawing only, Canvas 2D. The layout (the world view is 720 units tall; a phone held upright puts
// the controls in a panel under the view, a phone on its side puts them in gutters left and right), the camera, the HUD
// (portraits, the abilities, pearls, hearts with assist off, the giant's hearts), the idle key prompts in the player's
// own keys, the touch stick and buttons, the end card, and the dive's zoom into a cabinet screen. The worlds themselves
// are painted by afterdark-paint. Reads the engine, never changes it. Ported from the prototype's ui.js and game.js.
import { ATLASES, IMAGES } from './afterdark-art.js';
import { FR } from './afterdark-worlds.js';
import { type Game, W0, lead, clamp, lerp, pearlsTotal } from './afterdark-core.js';
import { cabScreen } from './afterdark-flow.js';
import { P, renderWorld, drawFrameRect, lightPool, roundRect, snapshot, ease } from './afterdark-paint.js';

export type Scheme = 'arrows' | 'wasd' | 'touch' | 'pad';
export interface Btn { x: number; y: number; r: number }
export interface TouchLayout { u: number; base: Btn; jump: Btn; act: Btn; swap: Btn; gust?: Btn }
export type TouchBtn = 'jump' | 'act' | 'swap' | 'gust';
const FONT = (px: number, wt = 700) => `${wt} ${Math.round(px)}px Fredoka, "Trebuchet MS", sans-serif`;

export class AfterDarkScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  atl: Record<string, HTMLImageElement> = {}; img: Record<string, HTMLImageElement> = {};
  L = { gutter: 0, cw: 1280, ch: 800, dpr: 1, scale: 1, view: { x: 0, y: 0, w: 1280, h: 800 }, Vw: 1280, Vh: 720, portrait: false, u: 1 };
  cam = { x: 640, y: 360 }; camWorld = '';
  scheme: Scheme = 'arrows';
  /** the touch stick while a thumb is on it (screen px), and the buttons held */
  stick: { x0: number; y0: number; x: number; y: number } | null = null;
  held: Partial<Record<TouchBtn, boolean>> = {};
  touchPulse: string | null = null;
  gustOn = false;

  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.ctx = cv.getContext('2d')!; }

  load(base: string) {
    const one = (src: string) => new Promise<HTMLImageElement | null>((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    const ps: Promise<unknown>[] = [];
    for (const a of ATLASES) ps.push(one(`${base}atlas-${a}.webp`).then((im) => { if (im) this.atl[a] = im; }));
    for (const n in IMAGES) ps.push(one(`${base}${n}.webp`).then((im) => { if (im) this.img[n] = im; }));
    return Promise.all(ps);
  }

  layout(cw: number, ch: number, dpr: number) {
    const L = this.L; dpr = Math.min(2, dpr || 1);
    L.cw = cw; L.ch = ch; L.dpr = dpr;
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    L.portrait = ch > cw * 1.15; L.gutter = 0;
    if (L.portrait) {
      let s = cw / 620, gh = 720 * s;
      if (gh > ch * 0.62) { s = ch * 0.62 / 720; gh = 720 * s; }
      L.scale = s; L.view = { x: 0, y: Math.round(ch * 0.03), w: cw, h: gh };
    } else {
      const gut = this.scheme === 'touch' && ch < 600 ? Math.round(clamp(ch * 0.4, 130, 190)) : 0;
      L.gutter = gut;
      const vw = cw - gut * 2;
      let s = Math.max(ch / 720, vw / 1280); s = Math.min(s, ch / 540);
      L.scale = s; L.view = { x: gut, y: 0, w: vw, h: ch };
    }
    L.Vw = L.view.w / L.scale; L.Vh = L.view.h / L.scale;
    L.u = clamp(Math.min(L.view.h / 600, L.cw / 700), 0.55, 1.25);
  }

  /** where the stick and the buttons sit, in screen px (the gust button appears once the gust is earned) */
  touchLayout(): TouchLayout {
    const L = this.L, u = clamp(Math.min(L.cw, L.ch) / 390, 0.8, 1.6), R = L.cw;
    if (!L.portrait && L.gutter) {   // phone on its side: stick in the left gutter, buttons stacked in the right one
      const g = L.gutter, cx = R - g / 2, H = L.ch;
      const T: TouchLayout = { u, base: { x: g / 2, y: H * 0.74, r: g * 0.36 }, jump: { x: cx, y: H * 0.8, r: g * 0.27 }, act: { x: cx, y: H * 0.56, r: g * 0.22 }, swap: { x: cx, y: H * 0.13, r: g * 0.16 } };
      if (this.gustOn) T.gust = { x: cx, y: H * 0.345, r: g * 0.18 };
      return T;
    }
    let bottom: number;
    if (L.portrait) { const top = L.view.y + L.view.h; bottom = top + (L.ch - top) * 0.45; }
    else bottom = L.ch - 86 * u;
    const T: TouchLayout = { u, base: { x: 96 * u, y: bottom, r: 62 * u }, jump: { x: R - 74 * u, y: bottom + 10 * u, r: 44 * u }, act: { x: R - 170 * u, y: bottom + 30 * u, r: 38 * u }, swap: { x: R - 140 * u, y: bottom - 70 * u, r: 31 * u } };
    if (this.gustOn) T.gust = { x: R - 58 * u, y: bottom - 84 * u, r: 31 * u };
    return T;
  }
  hitBtn(x: number, y: number): TouchBtn | null {
    const T = this.touchLayout();
    let best: TouchBtn | null = null, bd = 1e9;
    for (const b of ['jump', 'act', 'gust', 'swap'] as const) { const B = T[b]; if (!B) continue; const d = Math.hypot(x - B.x, y - B.y) / B.r; if (d < 1.35 && d < bd) { bd = d; best = b; } }
    return best;
  }

  // ───────────── camera: follows across, and up and down when the view is shorter than the world
  private camTarget(g: Game) {
    const w = W0(g), h = lead(g), L = this.L;
    const fx = g.boss && w.id === 'hub' ? (h.x + 1000) / 2 : h.x + h.face * 50;
    const cx = w.W <= L.Vw ? w.W / 2 : clamp(fx, L.Vw / 2, w.W - L.Vw / 2);
    let cy = 360;
    if (L.Vh < 720) {
      const lo = L.Vh / 2, hi = 720 - L.Vh / 2;
      if (w.kind === 'swim') cy = clamp(h.y, lo, hi);
      else if (w.id === 'hub' || w.id === 'room') cy = hi;
      else cy = clamp(h.y - 110, lo, hi);
    }
    return { cx, cy };
  }
  camUpdate(g: Game, dt: number, snap = false) {
    const t = this.camTarget(g);
    if (snap || this.camWorld !== g.world) { this.cam.x = t.cx; this.cam.y = t.cy; this.camWorld = g.world; }
    else { const k = 1 - Math.exp(-7 * dt), ky = 1 - Math.exp(-4 * dt); this.cam.x = lerp(this.cam.x, t.cx, k); this.cam.y = lerp(this.cam.y, t.cy, ky); }
  }

  // ───────────── the frame
  draw(g: Game, dt: number, opt: { title?: boolean } = {}) {
    P.g = g; P.atl = this.atl; P.img = this.img;
    this.gustOn = g.abil.gust;
    const T = g.trans;
    // the cabinet screen's still: the world being dived into, or the one just left (at the camera it was seen from)
    if (T && T.snapWorld && !P.snaps.has(T)) P.snaps.set(T, snapshot(T.snapWorld, !!T.snapAtSpawn, this.cam.x));
    this.camUpdate(g, dt);
    const c = this.ctx, L = this.L, d = L.dpr, v = L.view, s = L.scale;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0d0818'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    let cx = this.cam.x, cy = this.cam.y, z = 1, scan = 0;
    if (T && T.kind !== 'fade' && T.cab) {
      const sc = cabScreen(T.cab), zs = Math.max(L.Vw / sc.w, L.Vh / sc.h) * 1.03;
      const q = T.kind === 'dive' ? ease(clamp((T.t - 0.3) / (T.dur - 0.3), 0, 1)) : 1 - ease(clamp(T.t / 1, 0, 1));
      z = Math.exp(Math.log(zs) * q);
      cx = lerp(this.cam.x, sc.x + sc.w / 2, q); cy = lerp(this.cam.y, sc.y + sc.h / 2, q);
      scan = q > 0.6 ? (q - 0.6) / 0.4 : 0;
    }
    if (g.shake > 0) { cx += (Math.random() - 0.5) * 14 * g.shake; cy += (Math.random() - 0.5) * 10 * g.shake; }
    c.save();
    c.beginPath(); c.rect(v.x * d, v.y * d, v.w * d, v.h * d); c.clip();
    const k = d * s * z;
    c.setTransform(k, 0, 0, k, d * (v.x + v.w / 2) - cx * k, d * (v.y + v.h / 2) - cy * k);
    renderWorld(c, g.world, { cx, cy, Vw: L.Vw / z, Vh: L.Vh / z });
    c.restore();
    c.setTransform(d, 0, 0, d, 0, 0);
    if (scan > 0) {
      c.fillStyle = `rgba(10,6,30,${0.35 * scan})`; for (let y = v.y; y < v.y + v.h; y += 4) c.fillRect(v.x, y, v.w, 2);
      c.fillStyle = `rgba(255,250,235,${0.5 * scan * scan})`; c.fillRect(v.x, v.y, v.w, v.h);
    }
    if (g.flash > 0) { c.fillStyle = `rgba(235,250,255,${Math.min(0.8, g.flash * 1.4)})`; c.fillRect(v.x, v.y, v.w, v.h); }
    if (T && T.kind === 'fade') { c.fillStyle = `rgba(6,4,14,${1 - Math.abs(T.t / T.dur * 2 - 1)})`; c.fillRect(v.x, v.y, v.w, v.h); }
    if (opt.title) { c.fillStyle = 'rgba(12,6,28,.55)'; c.fillRect(0, 0, L.cw, L.ch); }
    else { this.drawHUD(g); if (g.mode === 'end') this.drawEnd(g); }
    if (!opt.title) this.drawTouch(g);
  }

  // ───────────── HUD
  private pill(x: number, y: number, txt: string, px: number, bg = 'rgba(32,16,48,.82)', fg = '#fff4dc', align: 'center' | 'left' | 'right' = 'center') {
    const c = this.ctx;
    c.font = FONT(px); const w = c.measureText(txt).width + px * 1.2, h = px * 1.55;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    roundRect(c, x0, y - h / 2, w, h, h / 2); c.fillStyle = bg; c.fill();
    c.lineWidth = Math.max(1.5, px * 0.1); c.strokeStyle = 'rgba(240,200,120,.85)'; c.stroke();
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x0 + w / 2, y + px * 0.05);
  }
  /** a frame drawn in screen space at a given height */
  private uiFrame(n: string, x: number, y: number, h: number, alpha = 1) {
    const f = FR(n); if (!f) return;
    const w = h * f[3] / f[4];
    drawFrameRect(this.ctx, n, x - w / 2, y - h / 2, w, h, alpha);
  }
  private keycap(x: number, y: number, label: string, u: number, a: number) {
    const c = this.ctx;
    c.save(); c.globalAlpha = a;
    c.font = FONT(20 * u); const tw = c.measureText(label).width;
    const h = 46 * u, w = Math.max(h, tw + 26 * u);
    drawFrameRect(c, 'keycap', x - w / 2, y - h / 2, w, h);
    c.fillStyle = '#fff4dc'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + 1.5 * u);
    c.restore();
  }
  keyLabel(k: string) {
    if (this.scheme === 'pad') return ({ R: '▶', L: '◀', E: 'B', J: 'X', K: 'Y', swap: 'LB', jump: 'A' } as Record<string, string>)[k];
    const wasd = this.scheme === 'wasd';
    return ({ R: wasd ? 'D' : '→', L: wasd ? 'A' : '←', E: 'E', J: 'J', K: 'K', swap: 'Shift', jump: 'Space' } as Record<string, string>)[k];
  }
  toScreen(x: number, y: number) {
    const L = this.L, s = L.scale, v = L.view;
    return [v.x + v.w / 2 + (x - this.cam.x) * s, v.y + v.h / 2 + (y - this.cam.y) * s];
  }
  private drawHUD(g: Game) {
    const c = this.ctx, L = this.L, u = L.u, v = L.view;
    // portraits: top-left, the active hero bigger and lit
    const Pz = 70 * u;
    (['dora', 'enzo'] as const).forEach((n, i) => {
      const act = g.lead === n, s = act ? 1 : 0.8, x = v.x + 16 * u + Pz / 2 + i * (Pz + 18 * u), y = v.y + 12 * u + Pz / 2;
      if (act) lightPool(c, x, y, Pz * 0.85, 'rgba(255,220,140,.7)', 0.55);
      this.uiFrame('face-' + n, x, y, Pz * s, act ? 1 : 0.7);
      this.pill(x, y + Pz * 0.5 * s + 4 * u, n.toUpperCase(), 13 * u * (act ? 1 : 0.85), act ? 'rgba(40,18,52,.9)' : 'rgba(40,18,52,.6)');
    });
    if (!g.assist) for (let i = 0; i < 3; i++) {   // hearts only matter with assist off
      const x = v.x + 26 * u + i * 26 * u, y = v.y + Pz + 58 * u;
      c.fillStyle = i < g.hearts ? '#ff7a8a' : 'rgba(255,255,255,.2)';
      c.beginPath(); c.moveTo(x, y + 7 * u); c.bezierCurveTo(x - 14 * u, y - 4 * u, x - 6 * u, y - 14 * u, x, y - 5 * u); c.bezierCurveTo(x + 6 * u, y - 14 * u, x + 14 * u, y - 4 * u, x, y + 7 * u); c.fill();
    }
    // the active hero's ability, bottom centre; the gust beside it once earned
    const h = lead(g), ab = h.name === 'enzo' ? 'ping' : 'sweep', has = g.abil[ab];
    const ay = v.y + v.h - 58 * u, A = 76 * u;
    const fresh = (k: string) => g.cut && g.cut.kind === k && g.cut.got;
    const slots: [string, boolean, string][] = [];
    if (has || g.abil.ping || g.abil.sweep) slots.push([ab, has, ab === 'ping' ? 'rgba(110,240,230,.6)' : 'rgba(255,200,100,.6)']);
    if (g.abil.gust) slots.push(['gust', true, 'rgba(200,235,255,.6)']);
    slots.forEach(([k, on, col], i) => {
      const ax = v.x + v.w / 2 + (i - (slots.length - 1) / 2) * A * 1.5;
      const pulse = fresh(k) ? 1 + 0.12 * Math.sin(g.time * 12) : 1;
      if (on) lightPool(c, ax, ay, A, col, 0.5 + 0.2 * Math.sin(g.time * 3));
      this.uiFrame('ico-' + k, ax, ay, A * pulse, on ? 1 : 0.35);
      const key = this.scheme === 'touch' ? '' : '  ' + this.keyLabel(k === 'gust' ? 'K' : 'J');
      this.pill(ax, ay + A * 0.5 + 2 * u, k.toUpperCase() + key, 14 * u, on ? 'rgba(20,40,52,.9)' : 'rgba(30,20,40,.55)', on ? '#fff4dc' : 'rgba(255,244,220,.5)');
    });
    // pearls found
    if (g.stats.pearls > 0 || g.world !== 'hub') {
      const px = v.x + 36 * u, py = v.y + Pz + 52 * u + (g.assist ? 0 : 30 * u);
      this.uiFrame('ico-pearl', px, py, 34 * u);
      c.font = FONT(17 * u); c.fillStyle = '#fff4dc'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(`${g.stats.pearls}/${pearlsTotal(g)}`, px + 24 * u, py + 1);
    }
    // the giant's hearts left, top centre
    if (g.boss) for (let i = 0; i < 3; i++) {
      const sz = 34 * u, x = v.x + v.w / 2 + (i - 1) * sz * 1.2, y = v.y + 30 * u;
      const f = FR('g-core')!, w = sz * f[3] / f[4];
      drawFrameRect(c, 'g-core', x - w / 2, y - sz / 2, w, sz, i < g.boss.hp ? 1 : 0.2);
    }
    // idle hint: the player's own key, or a pulse on the touch button
    this.touchPulse = null;
    if (g.hint) {
      const a = clamp((g.time - g.lastAct - g.hintIdle) * 2, 0, 1) * (0.75 + 0.25 * Math.sin(g.time * 5));
      if (this.scheme === 'touch') this.touchPulse = ({ R: 'stickR', L: 'stickL', E: 'act', J: 'act', K: g.abil.gust ? 'gust' : 'act', swap: 'swap', jump: 'jump' } as Record<string, string>)[g.hint.key];
      else { const [sx, sy] = this.toScreen(g.hint.x, g.hint.y); this.keycap(sx, sy - 6 * u * Math.abs(Math.sin(g.time * 4)), this.keyLabel(g.hint.key), u, a); }
    }
  }

  private drawTouch(g: Game) {
    if (this.scheme !== 'touch') return;
    const c = this.ctx, L = this.L, T = this.touchLayout(), u = T.u, t = g.time;
    if (L.portrait) {
      const top = L.view.y + L.view.h;
      const gr = c.createLinearGradient(0, top, 0, L.ch); gr.addColorStop(0, '#2a1440'); gr.addColorStop(1, '#170b26');
      c.fillStyle = gr; c.fillRect(0, top, L.cw, L.ch - top);
      c.fillStyle = 'rgba(240,200,120,.5)'; c.fillRect(0, top, L.cw, 2);
    }
    if (L.gutter) {
      c.fillStyle = 'rgba(20,10,34,.9)'; c.fillRect(0, 0, L.gutter, L.ch); c.fillRect(L.cw - L.gutter, 0, L.gutter, L.ch);
      c.fillStyle = 'rgba(240,200,120,.45)'; c.fillRect(L.gutter - 2, 0, 2, L.ch); c.fillRect(L.cw - L.gutter, 0, 2, L.ch);
    }
    const s = this.stick, b = T.base;
    const bx = s ? s.x0 : b.x, by = s ? s.y0 : b.y;
    const pulse = this.touchPulse;
    if (pulse === 'stickR' || pulse === 'stickL') {
      const dir = pulse === 'stickR' ? 1 : -1, k = (t * 1.5) % 1;
      c.save(); c.globalAlpha = 0.8 * (1 - k); c.fillStyle = '#ffe6a8';
      const ax = bx + dir * (b.r * 0.3 + k * b.r * 0.9);
      c.beginPath(); c.moveTo(ax + dir * 16 * u, by); c.lineTo(ax - dir * 6 * u, by - 14 * u); c.lineTo(ax - dir * 6 * u, by + 14 * u); c.fill(); c.restore();
    }
    this.uiFrame('stick-base', bx, by, b.r * 2, 0.75);
    const kx = s ? bx + clamp(s.x - s.x0, -b.r, b.r) : bx, ky = s ? by + clamp(s.y - s.y0, -b.r, b.r) : by;
    this.uiFrame('stick-knob', kx, ky, b.r * 0.9, 0.95);
    for (const [k, n] of [['jump', 'btn-jump'], ['act', 'btn-act'], ['gust', 'btn-gust'], ['swap', 'btn-swap']] as const) {
      const B = T[k]; if (!B) continue; const held = !!this.held[k];
      if (pulse === k) lightPool(c, B.x, B.y, B.r * 1.8, 'rgba(255,220,140,.8)', 0.5 + 0.4 * Math.sin(t * 6));
      this.uiFrame(n, B.x, B.y, B.r * 2 * (held ? 0.92 : 1), held ? 1 : 0.85);
    }
  }

  private drawEnd(g: Game) {
    const c = this.ctx, L = this.L, u = L.u, v = L.view, a = clamp(g.endT / 1.2, 0, 1), S = g.stats;
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(12,6,28,.55)'; c.fillRect(0, 0, L.cw, L.ch);
    const cx = v.x + v.w / 2, cy = v.y + v.h * 0.24;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 20 * u;
    c.font = FONT(Math.min(46 * u, v.w / 13)); c.fillStyle = '#fff1d6'; c.fillText('The arcade is awake', cx, cy);
    c.shadowBlur = 0;
    const tm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    // the two numbers that matter, with their icons
    const row = cy + 70 * u, I = 46 * u;
    this.uiFrame('ico-pearl', cx - 120 * u, row, I); this.uiFrame('ico-clock', cx + 70 * u, row, I);
    c.font = FONT(26 * u); c.fillStyle = '#fff1d6'; c.textAlign = 'left';
    c.fillText(`${S.pearls}/${pearlsTotal(g)}`, cx - 90 * u, row + 2); c.fillText(tm(S.tHeal), cx + 100 * u, row + 2);
    // the chapter, beat by beat
    c.textAlign = 'center'; c.font = FONT(14 * u, 500); c.fillStyle = 'rgba(255,236,200,.85)';
    const beats = ([['ping', S.tPing], ['sweep', S.tCrest], ['gust', S.tGust], ['giant', S.tBoss]] as [string, number][]).filter((b) => b[1] > 0).map(([n, t]) => `${n} ${tm(t)}`).join('   ·   ');
    c.fillText(beats, cx, row + 50 * u);
    // the heroes, cheering
    const hy = row + 60 * u + Math.min(150 * u, v.h * 0.3);
    for (const [n, dx] of [['dora', -60], ['enzo', 60]] as const) { const f = FR(`${n}-hub-win`); if (f) { const hh = Math.min(140 * u, v.h * 0.28), ww = hh * f[3] / f[4]; drawFrameRect(c, `${n}-hub-win`, cx + dx * u - ww / 2, hy - hh + Math.abs(Math.sin(g.time * 4 + dx)) * -8 * u, ww, hh); } }
    if (g.endT > 2.5) { c.globalAlpha = a * (0.6 + 0.4 * Math.sin(g.time * 4)); c.font = FONT(17 * u, 500); c.fillStyle = '#fff1d6'; c.fillText('▶  again', cx, hy + 26 * u); }
    c.restore();
  }
}
