// Every Creature: drawing only (Canvas 2D). The painted frames (public/art/every-creature/, sized by sizes.json), the
// camera, heroes, effects, the idle key prompts, the HUD (portraits, the form row, touch stick and buttons, options),
// the title, the screen-card transition and the end card. Per-screen pictures are in lib/creature-scene-screens.ts.
// Ported from the prototype's render.js; the hit areas it lays out (UI) are what the page tests taps against.
import {
  G, LV, SCR, F, FKEY, clamp, lerp, sm, H, O, unlocked, fx, type Hero, type Form, type FxOpts,
} from './creature-game.js';
import { SCREENS, heroSprite, type Checkpoint } from './creature-game.js';
import { SCREEN_DRAW } from './creature-scene-screens.js';

export const FONT = 'Fredoka, "Avenir Next", "Trebuchet MS", system-ui, sans-serif';
/** each sheet's reference frame and the height it is drawn at, so every frame of a sheet shares one scale */
const SHEETREF: Record<string, [string, number]> = {
  'chin-dora-a': ['dora-idle', 138], 'chin-enzo-a': ['enzo-idle', 138], 'chin-dora-b': ['dora-cheer', 150], 'chin-enzo-b': ['enzo-cheer', 150],
  'dora-tort': ['dora-tort-idle', 104], 'enzo-tort': ['enzo-tort-idle', 104], 'dora-frog': ['dora-frog-idle', 90], 'enzo-frog': ['enzo-frog-idle', 90],
  'dora-bird': ['dora-bird-idle', 92], 'enzo-bird': ['enzo-bird-idle', 92], 'dora-beetle': ['dora-beetle-idle', 70], 'enzo-beetle': ['enzo-beetle-idle', 70],
  'dora-fox': ['dora-fox-idle', 84], 'enzo-fox': ['enzo-fox-idle', 84], 'dora-otter': ['dora-otter-idle', 62], 'enzo-otter': ['enzo-otter-idle', 62],
  animals1: ['a-tort-up', 66], animals2: ['a-chick-perch', 52], threats: ['heron-idle', 250], poof: ['poof4', 150], props: ['stone', 150],
  'wild-a': ['kit-peek', 56], 'wild-b': ['hawk-perch', 110], heron2: ['sheron-idle', 660], props2: ['mound', 40],
};
export const TUNE: Record<string, number> = { 'a-beetle': 0.62, 'a-frog': 0.95, pike: 0.8 };
export interface SprOpts { w?: number; h?: number; s?: number; rot?: number; f?: number; sy?: number; a?: number; dy?: number }
interface Circle { x: number; y: number; r: number }
export interface UILayout {
  u: number; stick: Circle; act: Circle; form: Circle; swap: Circle; ic: number; row: { x: number; y: number; step: number };
  portHit: Circle[]; rowHit: { f: Form; x: number; y: number; r: number }[]; optHit: { id: string; x: number; y: number; w: number; h: number }[];
  btns: { id: string; x: number; y: number; w: number; h: number }[];
}
const R = Math.random; // looks-only randomness stays out of the game's seeded stream
const ROW: Form[] = ['chin', 'tort', 'frog', 'bird', 'beetle', 'fox', 'otter'];
const fmt = (s: number) => `${s / 60 | 0}:${String(s % 60 | 0).padStart(2, '0')}`;

export class CreatureScene {
  cv: HTMLCanvasElement; cx: CanvasRenderingContext2D;
  I: Record<string, HTMLImageElement> = {}; SZ: Record<string, [number, number, string]> = {};
  VW = 0; VH = 0; DPR = 1; SC = 1; cam = { x: 960, y: 540 };
  UI: UILayout = { u: 0, stick: { x: 0, y: 0, r: 0 }, act: { x: 0, y: 0, r: 0 }, form: { x: 0, y: 0, r: 0 }, swap: { x: 0, y: 0, r: 0 }, ic: 40, row: { x: 0, y: 0, step: 0 }, portHit: [], rowHit: [], optHit: [], btns: [] };
  /** set by the page: touch in use, the stick's direction and held buttons, mute, the checkpoint on the title */
  touch = { used: false, mx: 0, my: 0, btn: {} as Record<string, boolean> };
  muted = false; cp: Checkpoint | null = null;
  private scale: Record<string, number> = {};
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.cx = cv.getContext('2d')!; }

  async load(base: string) {
    try { this.SZ = await (await fetch(base + 'sizes.json')).json(); } catch { this.SZ = {}; }
    const one = (n: string) => new Promise<void>((res) => { const im = new Image(); im.onload = () => { this.I[n] = im; res(); }; im.onerror = () => res(); im.src = `${base}${n}.webp`; });
    await Promise.all(Object.keys(this.SZ).map(one));
    try { await document.fonts.load(`700 20px ${FONT}`); } catch { /* the fallback font is fine */ }
  }
  portrait() { return this.VH > this.VW; }
  isTouch() { return this.touch.used || (typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches); }
  resize(w: number, h: number, dpr: number) {
    this.DPR = Math.min(2, dpr || 1); this.VW = w; this.VH = h;
    this.cv.width = w * this.DPR | 0; this.cv.height = h * this.DPR | 0;
    this.SC = h > w ? Math.max(w / 1920, h / 1080) : Math.max(w / 1920, h / 640);
    this.layoutUI();
  }
  layoutUI() {
    const { VW, VH, UI } = this, m = Math.min(VW, VH), u = clamp(m / 9, 38, 84);
    UI.u = u;
    UI.stick = { x: u * 1.55 + 8, y: VH - u * 1.55 - 8, r: u * 1.15 };
    UI.act = { x: VW - u * 1.2 - 8, y: VH - u * 1.25 - 8, r: u * .95 };
    UI.form = { x: VW - u * 2.95 - 8, y: VH - u * .85 - 8, r: u * .66 };
    UI.swap = { x: VW - u * 1.1 - 8, y: VH - u * 3.05 - 8, r: u * .62 };
    const port = this.portrait(), tch = this.isTouch();
    const ic = port ? clamp(VW / 9.2, 34, 56) : clamp(Math.min(VW / 16, VH / 9.5), 34, 72);
    UI.ic = ic;
    const rowW = 7 * ic * 1.12;
    UI.row = { x: VW / 2 - rowW / 2 + ic * .56, y: port ? (tch ? 92 + ic * .1 : VH - ic * .75) : (tch ? ic * .72 + 6 : VH - ic * .78), step: ic * 1.12 };
  }

  // ---------------------------------------------------------------- camera
  private camTarget() {
    const a = H(), b = O();
    let tx = a.x, ty = a.y - 80;
    if (G.two || (Math.abs(a.x - b.x) < this.VW / this.SC * .7 && Math.abs(a.y - b.y) < this.VH / this.SC * .6)) { tx = (a.x + b.x) / 2; ty = (a.y + b.y) / 2 - 80; }
    if (G.clear && SCR.camWin) { tx = SCR.camWin.x; ty = SCR.camWin.y; }
    return { tx, ty };
  }
  updCam(dt: number, snap?: boolean) {
    const { tx, ty } = this.camTarget(), vw = this.VW / this.SC, vh = this.VH / this.SC;
    const k = snap ? 1 : 1 - Math.exp(-dt * 4);
    this.cam.x = lerp(this.cam.x, clamp(tx, vw / 2, LV.W - vw / 2), k); this.cam.y = lerp(this.cam.y, clamp(ty, vh / 2, LV.H - vh / 2), k);
  }
  /** a world point on screen */
  toScreen(x: number, y: number) { return { x: (x - this.cam.x) * this.SC + this.VW / 2, y: (y - this.cam.y) * this.SC + this.VH / 2 }; }

  // ---------------------------------------------------------------- sprites
  sheetScale(name: string) {
    const s = this.SZ[name]; if (!s) return 1; const sh = s[2];
    if (this.scale[sh] == null) { const r = SHEETREF[sh]; this.scale[sh] = r && this.SZ[r[0]] ? r[1] / this.SZ[r[0]][1] : 1; }
    return this.scale[sh];
  }
  /** loading fallback: a frame that hasn't arrived uses its sibling hero's frame */
  pick(name: string) {
    if (this.I[name]) return name;
    const n = name.replace(/^(dora|enzo)-/, (_, h) => (h === 'dora' ? 'enzo' : 'dora') + '-'); return this.I[n] ? n : name;
  }
  /** draw a painted frame anchored at its bottom centre */
  spr(name: string, x: number, y: number, o: SprOpts = {}) {
    name = this.pick(name); const im = this.I[name], cx = this.cx; if (!im) return;
    const s = o.w ? o.w / im.width : o.h ? o.h / im.height : this.sheetScale(name) * (o.s || 1);
    const w = im.width * s, h = im.height * s;
    cx.save(); cx.translate(x, y); if (o.rot) cx.rotate(o.rot); if (o.f === -1) cx.scale(-1, 1); if (o.sy) cx.scale(1, o.sy);
    if (o.a != null) cx.globalAlpha *= o.a;
    cx.drawImage(im, -w / 2, -h + (o.dy || 0), w, h); cx.restore();
  }
  /** effects spawned while drawing use looks-only randomness */
  fx(x: number, y: number, n: number, o: FxOpts) { fx(x, y, n, o, R); }
  txt(s: string, x: number, y: number, size: number, col = '#fff3d6', align: CanvasTextAlign = 'center', shadow = true) {
    const cx = this.cx; cx.save(); cx.font = `700 ${size}px ${FONT}`; cx.textAlign = align; cx.textBaseline = 'middle';
    if (shadow) { cx.fillStyle = 'rgba(40,24,8,.6)'; cx.fillText(s, x + 2, y + 2); } cx.fillStyle = col; cx.fillText(s, x, y); cx.restore();
  }
  rr(x: number, y: number, w: number, h: number, r: number) { const cx = this.cx; cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  drawGlint(x: number, y: number, s = 1, ph = 0) {
    const cx = this.cx, k = (Math.sin(G.t * 3 + ph) + 1) / 2; if (k < .35) return;
    const r = 16 * s * (.6 + k * .6);
    cx.save(); cx.translate(x, y); cx.rotate(G.t * .8 + ph); cx.globalAlpha = k;
    cx.fillStyle = '#fffbe0'; cx.shadowColor = '#ffd76a'; cx.shadowBlur = 18;
    cx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .22 : r; const an = i * Math.PI / 4; cx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } cx.fill(); cx.restore();
  }
  drawBolt(x: number, y: number, seed: number, k: number) {
    if (k <= 0) return; const cx = this.cx; let s = seed * 1e5 | 0; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    cx.save(); cx.globalAlpha = k; cx.strokeStyle = '#f4fbff'; cx.shadowColor = '#7fc8ff'; cx.shadowBlur = 24; cx.lineWidth = 7; cx.lineJoin = 'round';
    cx.beginPath(); let px = x + (r() - .5) * 200, py = 0; cx.moveTo(px, py);
    for (let i = 1; i <= 9; i++) { py = y * i / 9; px = lerp(px, x, .35) + (r() - .5) * 70 * (1 - i / 10); cx.lineTo(i === 9 ? x : px, py); }
    cx.stroke(); cx.lineWidth = 3; cx.strokeStyle = '#ffffff'; cx.stroke(); cx.restore();
  }

  // ---------------------------------------------------------------- the frame
  render() {
    const cx = this.cx, { DPR, VW, VH } = this;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.fillStyle = '#0e2b30'; cx.fillRect(0, 0, VW, VH);
    if (G.mode === 'title') { this.drawTitle(); return; }
    this.drawWorld();
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (G.mode === 'play' || G.mode === 'trans') this.drawHUD();
    if (G.mode === 'trans') this.drawTrans();
    if (G.mode === 'end') this.drawEnd();
  }
  private drawHero(h: Hero) {
    if (h.respawn > 0 && h.respawn < .5) return;
    if ((h.under ?? 0) > 0 || h.arriveT > 0) return;
    if (h.ride && (h.ride.under ?? 0) > 0) return;
    const cx = this.cx, name = heroSprite(h); let y = h.y, x = h.x; const o: SprOpts = { f: h.face };
    const f = h.form;
    if (f === 'tort' && h.swim) y += 6;
    if (f === 'frog' && h.swim) y += 4;
    if (f === 'otter' && h.swim && !h.dive) y += 8;
    if (f === 'bird' && h.ground && Math.abs(h.vx) > 10) y -= Math.abs(Math.sin(h.anim * 12)) * 8;
    if ((f === 'frog' || f === 'otter') && h.ground && Math.abs(h.vx) > 10) y -= Math.abs(Math.sin(h.anim * 10)) * 8;
    if (h.climb === 'wall') { o.f = 1; x = h.x + 6; y = h.y + 6; }
    if (h.climb === 'vine') { o.f = 1; x = h.vineR!.x - 4; y = h.y + 8; }
    if (f === 'chin' && h.ride) y += 10;
    if (h.ride && f === 'beetle' && h.ride.form === 'bird') y += 8;
    if (h.poofT > .2) return;
    if (h.hurt > 0 && (h.hurt * 20 | 0) % 2) o.a = .55;
    if (h.denyT > 0) x += Math.sin(h.denyT * 60) * 4;
    if (h.ground && Math.abs(h.vx) < 10 && !h.climb) o.sy = 1 + Math.sin(h.t * 3) * .015;
    this.spr(name, x, y, o);
    if (!G.two && h === H() && !G.clear) { // the active hero's marker
      const p = this.pick(name), top = y - (this.I[p] ? this.I[p].height * this.sheetScale(p) : 100) - 22 + Math.sin(G.t * 4) * 4;
      cx.save(); cx.fillStyle = h.name === 'dora' ? '#ffe9a8' : '#cfe6ff'; cx.globalAlpha = .9; cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 6;
      cx.beginPath(); cx.moveTo(h.x - 11, top); cx.lineTo(h.x + 11, top); cx.lineTo(h.x, top + 13); cx.fill(); cx.restore();
    }
  }
  private drawWater(alpha: number) {
    const cx = this.cx, w = LV.water!; cx.save();
    const g = cx.createLinearGradient(0, w.y, 0, LV.H);
    g.addColorStop(0, `rgba(60,190,200,${alpha})`); g.addColorStop(1, `rgba(20,110,140,${alpha + .2})`);
    cx.fillStyle = g; cx.fillRect(w.x1 - 40, w.y + 4, w.x2 - w.x1 + 40, LV.H - w.y); cx.restore();
  }
  private drawWorld() {
    const cx = this.cx, t = G.t, D = SCREEN_DRAW[SCR.id], { DPR, SC, VW, VH, cam } = this;
    const sh = G.shake > 0 ? G.shake * 18 : 0;
    cx.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (VW / 2 - cam.x * SC + (R() - .5) * sh), DPR * (VH / 2 - cam.y * SC + (R() - .5) * sh));
    const bg = this.I[SCR.bg];
    if (bg) cx.drawImage(bg, 0, 0, LV.W, LV.H);
    D.back(this, t); D.animals(this, t);
    const rk = (h: Hero) => h.ride ? (h.ride.carry === h ? -1 : 1) : 0, order = [...G.heroes].sort((a, b) => rk(a) - rk(b));
    for (const h of order) if (!h.swim && !(h.ride && h.ride.swim)) this.drawHero(h);
    for (const h of order) if (h.swim || (h.ride && h.ride.swim)) this.drawHero(h);
    D.front(this, t);
    if (LV.water) this.drawWater(.32);
    for (const h of G.heroes) if (h.swim && !h.dive) { cx.save(); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(h.x, LV.water!.y + 3, F[h.form].w * .7 + Math.sin(t * 5) * 4, 7, 0, 0, Math.PI * 2); cx.stroke(); cx.restore(); }
    if (G.demo) for (const g of SCR.demoPose(G.demo)) { // the ghost demo of what to do
      if (g.spark) { this.drawGlint(g.x, g.y, 1.6); continue; }
      if (g.bolt) { this.drawBolt(g.x, g.y, .4, .8); continue; }
      const a = Math.min(1, G.demo.t * 2, (G.demo.dur - G.demo.t) * 2) * .7;
      cx.save(); cx.shadowColor = '#fff6c0'; cx.shadowBlur = 16; this.spr(g.img!, g.x, g.y, { h: g.h, a, f: g.f, rot: g.rot }); cx.restore();
      if (R() < .4) this.fx(g.x, g.y - g.h! / 2, 1, { s: 30, g: -30, k: 'star', life: .6, r: 5 });
    }
    if (D.sky) D.sky(this, t);
    if (!G.clear) D.glints(this, t);
    this.drawFx();
    for (const pf of G.poofs) { const fr = Math.min(8, 1 + (pf.t / .045 | 0)); this.spr('poof' + fr, pf.x, pf.y + 75 * pf.s, { s: pf.s }); }
    for (const r of G.rings) { const k = r.t / r.life; cx.save(); cx.globalAlpha = 1 - k; cx.strokeStyle = r.c === 'gold' ? '#ffe08a' : '#ffffff'; cx.lineWidth = 4 * (1 - k) + 1; cx.beginPath(); cx.ellipse(r.x, r.y, r.r * (.3 + k), r.r * (.3 + k) * (r.c ? 1 : .25), 0, 0, Math.PI * 2); cx.stroke(); cx.restore(); }
    this.drawPrompt();
  }
  private drawFx() {
    const cx = this.cx;
    for (const p of G.fx) {
      const k = p.t / p.life; cx.save(); cx.globalAlpha = Math.max(0, 1 - k);
      if (p.k === 'drop') { cx.fillStyle = '#e8fbff'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
      else if (p.k === 'bubble') { cx.strokeStyle = '#e8fbff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.stroke(); }
      else if (p.k === 'mist') { cx.globalAlpha *= .35; cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(p.x, p.y, p.r * (1 + k * 2), 0, 7); cx.fill(); }
      else if (p.k === 'dust') { cx.fillStyle = '#e9dcc0'; cx.beginPath(); cx.arc(p.x, p.y, p.r * (1 + k), 0, 7); cx.fill(); }
      else if (p.k === 'dirt') { cx.fillStyle = '#7a5532'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
      else if (p.k === 'spark') { cx.strokeStyle = '#bfe6ff'; cx.shadowColor = '#7fc8ff'; cx.shadowBlur = 10; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.vx * .05, p.y + p.vy * .05); cx.stroke(); }
      else if (p.k === 'star') { cx.fillStyle = p.c || '#fff1a8'; cx.shadowColor = '#ffd76a'; cx.shadowBlur = 10; cx.translate(p.x, p.y); cx.rotate(p.rot); const r = p.r * (1 - k * .5); cx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .3 : r; cx.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); } cx.fill(); }
      else if (p.k === 'feather') { cx.fillStyle = p.c === 'enzo' ? '#a9adb6' : p.c === 'chick' ? '#9fd4ff' : '#fff6e6'; cx.translate(p.x, p.y); cx.rotate(p.rot); cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * .35, 0, 0, 7); cx.fill(); }
      else if (p.k === 'leaf') { cx.fillStyle = '#8fd06a'; cx.translate(p.x, p.y); cx.rotate(p.rot); cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * .45, 0, 0, 7); cx.fill(); }
      else if (p.k === 'petal') { cx.fillStyle = ['#ffc6dc', '#ffe08a', '#ffffff', '#c9f0a8'][(p.r * 10 | 0) % 4]; cx.translate(p.x, p.y); cx.rotate(p.rot); cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 7); cx.fill(); }
      cx.restore();
    }
  }
  // ---------------------------------------------------------------- key prompts (in the player's own keys, after idling)
  private keyText(k: string, f?: Form) {
    const sc = G.scheme;
    return ({ act: 'Space', swap: 'Shift', call: 'C', form: f ? FKEY[f] : '', up: sc === 'wasd' ? 'W' : '↑', down: sc === 'wasd' ? 'S' : '↓' } as Record<string, string>)[k] ?? '';
  }
  private drawKey(x: number, y: number, label: string, s = 1) {
    const cx = this.cx, w = (label.length > 2 ? 34 + label.length * 13 : 50) * s, h = 50 * s;
    if (this.I.keycap) cx.drawImage(this.I.keycap, x - w / 2, y - h / 2, w, h * 1.08);
    cx.fillStyle = '#5a3a1c'; cx.font = `700 ${(label.length > 2 ? 19 : 25) * s}px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(label, x, y + 1);
  }
  curHint() { return G.clear || G.mode !== 'play' ? null : SCR.hint(); }
  private drawPrompt() {
    if (G.clear || G.idleT < (G.assist ? 6 : 10) || this.isTouch()) return;
    const hnt = this.curHint(); if (!hnt) return;
    const cx = this.cx, a = H(), y = a.y - F[a.form].h - 70 + Math.sin(G.t * 3) * 5;
    cx.save(); cx.globalAlpha = Math.min(1, (G.idleT - 6) * 2);
    if (hnt.k === 'move') { const sc = G.scheme; this.drawKey(a.x + hnt.d! * 10, y, hnt.d! > 0 ? (sc === 'wasd' ? 'D' : '→') : (sc === 'wasd' ? 'A' : '←'), 1); }
    else if (hnt.k === 'form') { this.drawKey(a.x - 34, y, FKEY[hnt.f!]); this.spr('ic-' + hnt.f, a.x + 30, y + 28, { h: 54 }); }
    else this.drawKey(a.x, y, this.keyText(hnt.k, hnt.f));
    cx.restore();
  }
  // ---------------------------------------------------------------- HUD
  private iconFor(f: Form) { return f === 'fox' || f === 'otter' ? (unlocked(f) && this.I['ic-' + f] ? 'ic-' + f : 'lock-' + f) : 'ic-' + f; }
  private pulse(x: number, y: number, r: number) { const cx = this.cx; cx.save(); cx.strokeStyle = '#fff3b0'; cx.lineWidth = 4; cx.globalAlpha = .5 + .5 * Math.sin(G.t * 6); cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.stroke(); cx.restore(); }
  private drawHUD() {
    const cx = this.cx, t = G.t, port = this.portrait(), { VW, VH, UI } = this, tch = this.isTouch();
    const pr = port ? 30 : clamp(VH / 15, 30, 48);
    const hnt = G.idleT > 6 ? this.curHint() : null;
    UI.portHit = [];
    G.heroes.forEach((h, i) => {
      const x = 10 + pr + (port ? i * (pr * 2 + 10) : 0), y = 10 + pr + (port ? 0 : i * (pr * 2 + 14));
      const on = G.two || h === H();
      cx.save(); cx.globalAlpha = on ? 1 : .6;
      if (on && !G.two) { cx.shadowColor = '#ffd76a'; cx.shadowBlur = 16; }
      const shake = h.denyT > 0 ? Math.sin(h.denyT * 60) * 3 : 0;
      this.spr('port-' + h.name, x + shake, y + pr * (on ? 1.08 : 1), { h: pr * 2 * (on ? 1.08 : 1) });
      cx.restore();
      if (h.form !== 'chin') this.spr(this.iconFor(h.form), x + pr * .78, y + pr * 1.1, { h: pr * .9 });
      if (!port) this.txt(h.name.toUpperCase(), x + pr + 10, y, pr * .5, on ? '#fff3cf' : '#e8e0d0', 'left');
      if (!on) { UI.portHit.push({ x, y, r: pr * 1.1 }); if (tch && hnt && hnt.k === 'call') this.pulse(x, y, pr * 1.15); }
    });
    const Rw = UI.row, ic = UI.ic, a = H();
    UI.rowHit = [];
    ROW.forEach((f, i) => {
      const x = Rw.x + i * Rw.step, y = Rw.y, un = unlocked(f), cur = a.form === f, oth = !G.two && O().form === f;
      const img = this.iconFor(f);
      cx.save();
      if (img.startsWith('lock')) { cx.globalAlpha = .9; this.spr(img, x, y + ic / 2, { h: ic * .92 }); cx.restore(); return; }
      if (!un) { cx.filter = 'brightness(.25) saturate(0)'; cx.globalAlpha = .9; }
      if (cur) { cx.shadowColor = '#ffe08a'; cx.shadowBlur = 22; }
      const pop = G.flyIcons.find((q) => q.kind === f), ps = pop ? 1 + Math.max(0, Math.sin(Math.min(1, (pop.t - .6) / .6) * Math.PI)) * .35 * (pop.t > .6 ? 1 : 0) : 1;
      this.spr(img, x, y + ic / 2 * (cur ? 1.14 : 1) * ps, { h: ic * (cur ? 1.14 : 1) * ps });
      cx.restore();
      if (!un) this.spr('padlock', x + ic * .28, y + ic * .5, { h: ic * .38 });
      if (oth) { cx.save(); cx.fillStyle = O().name === 'dora' ? '#fff3dc' : '#b9bec8'; cx.strokeStyle = '#6a4a20'; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y - ic * .62, ic * .1, 0, 7); cx.fill(); cx.stroke(); cx.restore(); }
      if (cur && !G.two) { cx.save(); cx.fillStyle = a.name === 'dora' ? '#fff3dc' : '#b9bec8'; cx.strokeStyle = '#ffd76a'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(x, y + ic * .66, ic * .11, 0, 7); cx.fill(); cx.stroke(); cx.restore(); }
      if (tch && hnt && hnt.k === 'form' && hnt.f === f) this.pulse(x, y + ic / 2, ic * .66);
      if (un) UI.rowHit.push({ f, x, y, r: ic * .55 });
    });
    for (const q of G.flyIcons) { // a new friend's icon flies into the row
      const i = ROW.indexOf(q.kind), tx = Rw.x + i * Rw.step, ty = Rw.y;
      const s = this.toScreen(q.x, q.y), k = clamp(q.t / .6, 0, 1), e = sm(k);
      if (k < 1) { cx.save(); cx.shadowColor = '#ffe08a'; cx.shadowBlur = 24; this.spr('ic-' + q.kind, lerp(s.x, tx, e), lerp(s.y, ty, e) - Math.sin(e * Math.PI) * 80 + ic / 2, { h: ic * (1.6 - .6 * e) }); cx.restore(); }
    }
    this.drawOpts();
    if (tch && !G.clear) {
      const S = UI.stick; this.spr('stick-base', S.x, S.y + S.r, { h: S.r * 2, a: .75 });
      this.spr('stick-knob', S.x + this.touch.mx * S.r * .5, S.y + this.touch.my * S.r * .5 + S.r * .45, { h: S.r * .9 });
      for (const [k, im] of [['act', 'btn-act'], ['form', 'btn-form'], ['swap', 'btn-swap']] as const) {
        if (k === 'swap' && G.two) continue;
        const B = UI[k], down = this.touch.btn[k];
        this.spr(im, B.x, B.y + B.r * (down ? .94 : 1), { h: B.r * 2 * (down ? .94 : 1), a: .92 });
        if (hnt && hnt.k === k) this.pulse(B.x, B.y, B.r * 1.18);
      }
      if (hnt && (hnt.k === 'move' || hnt.k === 'up' || hnt.k === 'down')) {
        cx.save(); cx.globalAlpha = .5 + .5 * Math.sin(t * 6); cx.fillStyle = '#fff3b0'; const d = hnt.k === 'up' ? [0, -1] : hnt.k === 'down' ? [0, 1] : [hnt.d!, 0];
        cx.translate(S.x + d[0] * S.r * 1.25, S.y + d[1] * S.r * 1.25); cx.rotate(Math.atan2(d[1], d[0])); cx.beginPath(); cx.moveTo(14, 0); cx.lineTo(-8, -12); cx.lineTo(-8, 12); cx.fill(); cx.restore();
      }
    }
    // screen pips (top centre): where you are in the chapter
    const n = SCREENS.length, px0 = VW / 2 - (n - 1) * 9;
    if (!port || !tch) for (let i = 0; i < n; i++) { cx.save(); cx.fillStyle = i < G.si ? '#ffd76a' : i === G.si ? '#fff3d6' : 'rgba(255,255,255,.3)'; cx.beginPath(); cx.arc(px0 + i * 18, port ? 14 : 18, i === G.si ? 6 : 4.5, 0, 7); cx.fill(); cx.restore(); }
  }
  private drawOpts() {
    const cx = this.cx, port = this.portrait(), UI = this.UI;
    const opts: [string, string][] = [['assist', G.assist ? 'Assist ✓' : 'Assist'], ['two', G.two ? '2P ✓' : '2P'], ['mute', this.muted ? '♪ ✕' : '♪']];
    UI.optHit = []; let ox = this.VW - 10;
    cx.save(); cx.font = `600 ${port ? 13 : 15}px ${FONT}`; cx.textBaseline = 'middle'; cx.textAlign = 'left';
    for (const [id, lab] of opts.reverse()) {
      const w = cx.measureText(lab).width + 18; ox -= w;
      cx.fillStyle = 'rgba(30,22,12,.45)'; this.rr(ox, 10, w, 26, 13); cx.fill(); cx.fillStyle = '#fff3d6'; cx.fillText(lab, ox + 9, 24);
      UI.optHit.push({ id, x: ox, y: 10, w, h: 26 }); ox -= 6;
    }
    cx.restore();
  }
  private button(id: string, label: string, x: number, y: number, w: number, h: number, primary: boolean) {
    const cx = this.cx;
    cx.save(); cx.fillStyle = primary ? 'rgba(255,215,106,.95)' : 'rgba(40,26,10,.65)'; this.rr(x - w / 2, y - h / 2, w, h, h / 2); cx.fill();
    cx.strokeStyle = '#ffd76a'; cx.lineWidth = 2.5; cx.stroke(); cx.restore();
    this.txt(label, x, y + 1, Math.min(26, h * .45), primary ? '#5a3a1c' : '#fff3d6', 'center', false);
    this.UI.btns.push({ id, x: x - w / 2, y: y - h / 2, w, h });
  }
  // ---------------------------------------------------------------- title / transition / end card
  private drawTitle() {
    const cx = this.cx, { VW, VH, DPR } = this;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const im = this.I.bg; if (im) { const s = Math.max(VW / im.width, VH / im.height); cx.drawImage(im, (VW - im.width * s) / 2, (VH - im.height * s) / 2, im.width * s, im.height * s); }
    cx.fillStyle = 'rgba(14,43,48,.45)'; cx.fillRect(0, 0, VW, VH);
    const port = this.portrait(), m = Math.min(VW, VH), tt = performance.now() / 1000;
    this.txt('Every Creature', VW / 2, VH * .2, clamp(m / 7, 36, 92));
    this.txt('Chapter One · The Valley', VW / 2, VH * .2 + clamp(m / 9, 28, 64), clamp(m / 20, 16, 30), '#ffe9a8');
    const hh = clamp(m / 3.2, 120, 260), y0 = VH * (port ? .58 : .66);
    this.spr('dora-cheer', VW / 2 - hh * .42, y0 + Math.abs(Math.sin(tt * 3)) * -10, { h: hh, f: 1 });
    this.spr('enzo-cheer', VW / 2 + hh * .42, y0 + Math.abs(Math.sin(tt * 3 + 1.5)) * -10, { h: hh, f: -1 });
    this.UI.btns = [];
    const cp = this.cp, bw = clamp(VW * .6, 220, 340), by = VH * (port ? .72 : .82);
    if (cp) { this.button('cont', `Continue · ${SCREENS[cp.si].name}`, VW / 2, by, bw, 52, true); this.button('new', 'New game', VW / 2, by + 64, bw * .7, 42, false); }
    else this.button('new', 'Play', VW / 2, by, bw * .7, 56, true);
    this.drawOpts();
  }
  private drawTrans() {
    const cx = this.cx, { VW, VH, DPR } = this, k = G.transT;
    const a = k < .6 ? k / .6 : k < 1.7 ? 1 : 1 - (k - 1.7) / .5;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.save(); cx.globalAlpha = clamp(a, 0, 1); cx.fillStyle = '#16302a'; cx.fillRect(0, 0, VW, VH);
    if (k > .55 && k < 1.9) {
      const m = Math.min(VW, VH); this.txt(SCREENS[G.si].name, VW / 2, VH / 2, clamp(m / 9, 30, 64));
      for (let i = 0; i < SCREENS.length; i++) { cx.fillStyle = i <= G.si ? '#ffd76a' : 'rgba(255,255,255,.3)'; cx.beginPath(); cx.arc(VW / 2 - (SCREENS.length - 1) * 11 + i * 22, VH / 2 + clamp(m / 12, 30, 52), 6, 0, 7); cx.fill(); }
    }
    cx.restore();
  }
  private drawEnd() {
    const cx = this.cx, { VW, VH, DPR } = this;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const k = clamp(G.endT / .8, 0, 1), port = this.portrait();
    cx.save(); cx.globalAlpha = k * .55; cx.fillStyle = '#10201c'; cx.fillRect(0, 0, VW, VH); cx.restore();
    cx.save(); cx.globalAlpha = k;
    const w = Math.min(VW - 32, 560), h = Math.min(VH - 40, port ? 470 : 380), x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    cx.fillStyle = 'rgba(40,26,10,.82)'; this.rr(x, y, w, h, 26); cx.fill(); cx.strokeStyle = '#ffd76a'; cx.lineWidth = 3; cx.stroke();
    const done = G.si >= SCREENS.length - 1 && G.endFull;
    this.txt(done ? 'The valley is calm' : 'To be continued…', VW / 2, y + 38, 28);
    const short = h < 400, fr = (['tort', 'frog', 'bird', 'beetle', 'fox', 'otter'] as const).filter((f) => G.friends[f]), s = Math.min(short ? 44 : 70, (w - 40) / Math.max(4, fr.length) - 8), lh = short ? 20 : 26;
    fr.forEach((f, i) => this.spr('ic-' + f, VW / 2 + (i - (fr.length - 1) / 2) * (s + 8), y + 70 + s, { h: s }));
    this.txt(`${fr.length} friends · ${fmt(G.total)}`, VW / 2, y + (short ? 88 : 100) + s, short ? 20 : 24, '#ffe9a8');
    const rows = G.stats.scr.filter((r) => r && r.time != null);
    rows.forEach((r, i) => this.txt(`${SCREENS[r!.i].name}  ${fmt(r!.time!)}`, VW / 2, y + (short ? 116 : 140) + s + i * lh, short ? 15 : 18, '#fff3d6', 'center', false));
    this.UI.btns = []; this.button('replay', '↻  Play again', VW / 2, y + h - 40, 220, 46, true);
    cx.restore();
  }
}
