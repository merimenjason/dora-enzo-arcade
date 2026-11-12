// Brinelight: drawing only. Every character, prop, floor, sky and HUD frame is a Codex painting packed by
// scripts/brinelight-art.py; this file draws effects (sparks, dust, splashes, rings, glows, shadows, the night wash)
// and typeset HUD text on top. It reads the engine and never changes it.
import {
  BrineGame, FLOOR, DEPTH, VIEW_W, HC, COL, LANE_Z, BOSS_NAME, inHole, perched, timeOfDay, type GameEvent, type Hero, type Foe, type Boss, type HeroId,
  type Prop, type Item, type Goal,
} from './brinelight-game';
import { PX, ATLASES, FRAMES, IMAGES } from './brinelight-art';
import type { FestGame } from './brinelight-fest';

const BAND = 540;                       // world units from the top of the sky to the bottom of the deck
const STRIP_TOP = 272, STRIP_H = BAND - STRIP_TOP + 4;
const STR_W = 520, STR_Y = 128, LANX = [0.157, 0.294, 0.43, 0.57, 0.71, 0.845];
const PORTRAIT_VIEW = 440;              // world units across on a portrait phone: zoomed in, the camera follows the hero
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const DECOR: Record<string, string> = {
  b: 'barrel', p: 'lobsterpot', o: 'bollard', c: 'crate', f: 'fishcrate', r: 'rope', S: 'stall-ice', L: 'stall-lobster',
  A: 'awning', X: 'fishboxes', W: 'basket', R: 'brine', D: 'driedfish', T: 'truck', M: 'mussels', N: 'netcoil',
  Z: 'brazier', B: 'bell', O: 'bobbin', K: 'tarbarrel', P: 'scaffold', C: 'ropecoil', H: 'planks', Y: 'pulley', G: 'anchor',
  V: 'sawhorse', Q: 'paints', F: 'figurehead', J: 'winch', U: 'lamppost',
  '@': 'npc-mabel', '&': 'npc-twins', $: 'npc-barnaby', '%': 'npc-hal',
};
const NPC_OF: Record<string, string> = { '@': 'mabel', '&': 'twins', $: 'barnaby', '%': 'hal' };
/** frames whose painting includes the hole the eel (or Tanglejaw) is stretched out of, at the tail end */
const STRETCHED = new Set(['eel-lunge', 'eel-reach', 'eel-tired', 'tanglejaw-lunge', 'tanglejaw-strike', 'tanglejaw-stuck']);

export interface Btn { x: number; y: number; r: number }
export interface TouchLayout { stick: Btn; atk: Btn; jmp: Btn; tag: Btn; panel: number }
export interface Labels { atk: string; jmp: string; tag: string; left: string; right: string; up: string; down: string; mode: 'keys' | 'touch' | 'pad' }

interface Fx {
  k: string; x: number; z: number; h: number; t: number; life: number; vx: number; vh: number; vz: number;
  col: string; size: number; back?: boolean; rot?: number; spin?: number; text?: string; pose?: string; flip?: boolean;
  si?: number; slot?: number; want?: HeroId; grav?: number;
}

export class BrineScene {
  cv: HTMLCanvasElement; cx: CanvasRenderingContext2D;
  light: HTMLCanvasElement; lx: CanvasRenderingContext2D;
  atlas: HTMLImageElement[] = []; img: Record<string, HTMLImageElement> = {};
  W = 0; H = 0; dpr = 1; s = 1; oy = 0; u = 1; vw = VIEW_W; viewL = 0; portrait = false; touch = false;
  playBottom = 0;
  tl: TouchLayout = { stick: { x: 0, y: 0, r: 0 }, atk: { x: 0, y: 0, r: 0 }, jmp: { x: 0, y: 0, r: 0 }, tag: { x: 0, y: 0, r: 0 }, panel: 0 };
  knob = { x: 0, y: 0, on: false };
  pressed: Record<string, number> = {};
  fx: Fx[] = []; rt = 0; flash = 0; ready = false; area3 = false;
  private white: Record<string, HTMLCanvasElement> = {};
  private camX = -1; private stageKey = ''; private zoomVw = PORTRAIT_VIEW;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; this.cx = cv.getContext('2d')!;
    this.light = document.createElement('canvas'); this.lx = this.light.getContext('2d')!;
  }

  async load(base = '/art/brinelight/') {
    const one = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error(src)); im.src = src; });
    this.atlas = await Promise.all(ATLASES.map((a) => one(`${base}atlas-${a}.webp`)));
    const names = Object.keys(IMAGES).filter((n) => n.startsWith('floor-') || n.startsWith('far-') || n.startsWith('dusk-') || n.startsWith('fest-') || n === 'fireworks');
    const ims = await Promise.all(names.map((n) => one(`${base}${n}.webp`)));
    names.forEach((n, i) => { this.img[n] = ims[i]; });
    this.ready = true;
  }

  // ─────────────────────────────────────────── layout
  layout(W: number, H: number, dpr: number, touch: boolean) {
    this.W = W; this.H = H; this.dpr = Math.min(dpr || 1, 2); this.touch = touch;
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.light.width = Math.max(1, Math.round(W / 2)); this.light.height = Math.max(1, Math.round(H / 2));
    this.u = clamp(Math.min(W, H) / 760, 0.62, 1.25);
    this.portrait = H > W * 1.15;
    if (this.portrait) {
      // a phone held upright: a zoomed play view at the top, the controls in their own panel under it
      // the controls take about a quarter of the screen; the play view takes the rest, its deck edge at the panel
      this.s = W / PORTRAIT_VIEW; this.vw = PORTRAIT_VIEW;
      this.playBottom = Math.round(H - clamp(H * 0.27, 190, 300));
      this.oy = this.playBottom - 660 * this.s;           // the HUD sits over the sky
    } else {
      this.s = Math.min(H / 500, W / 860); this.vw = W / this.s;
      const extra = H - BAND * this.s;
      this.oy = extra > 0 ? extra * 0.55 : extra;          // a short screen crops sky, never deck
      this.playBottom = H;
    }
    const u = this.u, m = Math.max(14, 20 * u);
    if (this.portrait) {
      // a compact diamond: ATTACK on the right, TAG above-left of it, JUMP below-left; every button at least 56 px across
      const top = this.playBottom, ph = H - top, r = clamp(Math.min(W * 0.125, ph * 0.22), 40, 58);
      const cy = top + ph * 0.5;
      this.tl = {
        panel: top,
        stick: { x: m + r * 1.45, y: cy, r: r * 1.35 },
        atk: { x: W - m - r - 4, y: cy, r },
        jmp: { x: W - m - r * 2.9, y: cy + r * 0.95, r: Math.max(28, r * 0.8) },
        tag: { x: W - m - r * 2.6, y: cy - r * 1.05, r: Math.max(28, r * 0.7) },
      };
    } else {
      const r = clamp(Math.min(W, H) * 0.085, 34, 58);
      this.tl = {
        panel: H,
        stick: { x: m + r * 1.3 + 8, y: H - m - r * 1.3 - 8, r: r * 1.3 },
        atk: { x: W - m - r - 6, y: H - m - r - 6, r },
        jmp: { x: W - m - r * 3.05 - 6, y: H - m - r * 0.75 - 6, r: r * 0.78 },
        tag: { x: W - m - r * 1.35 - 6, y: H - m - r * 3 - 6, r: r * 0.74 },
      };
    }
    if (!this.knob.on) { this.knob.x = this.tl.stick.x; this.knob.y = this.tl.stick.y; }
  }
  private SX = (x: number) => (x - this.viewL) * this.s;
  private SY = (y: number) => y * this.s + this.oy;

  // ─────────────────────────────────────────── frames
  private fr(n: string) { return FRAMES[n]; }
  has(n: string) { return !!FRAMES[n]; }
  /** draw a frame with its feet at world (x, z) and height h; o.flip mirrors it around its anchor */
  spr(n: string, x: number, z: number, h: number, o: { flip?: boolean; alpha?: number; sc?: number; rot?: number; flash?: number; flashMax?: number; ox?: number; sy?: number; tint?: string } = {}) {
    const f = this.fr(n); if (!f) return;
    const [ai, fx, fy, fw, fh, ax] = f, im = this.atlas[ai]; if (!im) return;
    const k = (this.s / PX) * (o.sc ?? 1), w = fw * k, hh = fh * k, cx = this.cx;
    const sx = this.SX(x) + (o.ox ?? 0) * this.s, sy = this.SY(FLOOR + z - h);
    cx.save(); cx.translate(sx, sy);
    if (o.rot) { cx.translate(0, -hh / 2); cx.rotate(o.rot); cx.translate(0, hh / 2); }
    if (o.flip) cx.scale(-1, 1);
    if (o.sy) cx.scale(1 / o.sy, o.sy);
    if (o.alpha !== undefined) cx.globalAlpha = o.alpha;
    cx.drawImage(im, fx, fy, fw, fh, -ax * k, -hh, w, hh);
    if (o.flash && o.flash > 0) { cx.globalAlpha = Math.min(1, o.flash * 9) * (o.flashMax ?? 0.6); cx.drawImage(this.whiteOf(n), 0, 0, fw, fh, -ax * k, -hh, w, hh); }
    cx.restore();
  }
  /** a frame drawn in screen space, centred on (x, y), w wide */
  ui(n: string, x: number, y: number, w: number, a = 1, h?: number) {
    const f = this.fr(n); if (!f) return 0;
    const [ai, fx, fy, fw, fh] = f; const hh = h ?? (w * fh) / fw;
    this.cx.globalAlpha = a; this.cx.drawImage(this.atlas[ai], fx, fy, fw, fh, x - w / 2, y - hh / 2, w, hh); this.cx.globalAlpha = 1;
    return hh;
  }
  private whiteOf(n: string) {
    if (this.white[n]) return this.white[n];
    const [ai, fx, fy, fw, fh] = FRAMES[n]; const c = document.createElement('canvas'); c.width = fw; c.height = fh;
    const x = c.getContext('2d')!; x.drawImage(this.atlas[ai], fx, fy, fw, fh, 0, 0, fw, fh);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, fw, fh);
    return (this.white[n] = c);
  }

  // ─────────────────────────────────────────── events into effects
  take(evs: GameEvent[], g: BrineGame) {
    const R = Math.random;
    for (const e of evs) {
      switch (e.k) {
        case 'sparks':
          this.add({ k: 'burst', x: e.x, z: e.z, h: e.h, life: 0.2, col: e.col, size: e.big, rot: R() * 6 });
          for (let i = 0; i < e.n; i++) { const a = R() * 6.28, v = 120 + R() * 260 * e.big; this.add({ k: 'p', x: e.x, z: e.z, h: e.h, vx: Math.cos(a) * v, vh: Math.sin(a) * v + 80, life: 0.3 + R() * 0.25, col: e.col, size: 2 + R() * 2.5, grav: 900 }); }
          break;
        case 'dust': for (let i = 0; i < e.n; i++) this.add({ k: 'dust', x: e.x + (R() - 0.5) * 40, z: e.z, h: 4, vx: (R() - 0.5) * 120, vh: 30 + R() * 40, life: 0.45, col: '#e9d7b8', size: (10 + R() * 8) * e.size }); break;
        case 'splash':
          for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 1.4; this.add({ k: 'p', x: e.x + (R() - 0.5) * 50, z: -14, h: -30, vx: Math.cos(a) * 160, vh: -Math.sin(a) * (260 + R() * 240), life: 0.8, col: R() < 0.5 ? '#9fd8ff' : '#e8f6ff', size: 2.5 + R() * 3, grav: 1200, back: true }); }
          this.add({ k: 'ring', x: e.x, z: -14, h: 0, life: 0.6, col: '#bfe6ff', size: 90, back: true });
          break;
        case 'ring': this.add({ k: 'ring', x: e.x, z: e.z, h: 0, life: e.life, col: e.col, size: e.size }); break;
        case 'shock':
          this.add({ k: 'ring', x: e.x, z: e.z, h: 0, life: 0.5, col: '#fff0c8', size: e.size * 2 });
          this.add({ k: 'ring', x: e.x, z: e.z, h: 0, life: 0.35, col: '#ffd27a', size: e.size * 1.3 });
          for (let i = 0; i < 14; i++) this.add({ k: 'dust', x: e.x + (R() - 0.5) * e.size * 1.4, z: e.z + (R() - 0.5) * 60, h: 4, vx: (R() - 0.5) * 300, vh: 60 + R() * 80, life: 0.6, col: '#e9d7b8', size: 14 + R() * 10 });
          break;
        case 'swipe': this.add({ k: 'swipe', x: e.x, z: e.z, h: e.h, life: 0.16, col: e.col, size: e.big, flip: e.face < 0 }); break;
        case 'tink':
          this.add({ k: 'burst', x: e.x, z: e.z, h: e.h, life: 0.18, col: '#dfe6ef', size: 0.6, rot: R() * 6 });
          this.add({ k: 'tink', x: e.x, z: e.z, h: e.h + 50, life: 1.1, col: '#fff', size: 1, want: e.want });
          break;
        case 'fest': for (let i = 0; i < Math.min(6, Math.ceil(e.amt / 3)); i++) this.add({ k: 'fest', x: e.x, z: e.z, h: e.h, life: 0.6 + i * 0.05, col: '#ffd27a', size: 4, vx: (R() - 0.5) * 200, vh: 200 + R() * 150 }); break;
        case 'word': this.add({ k: 'word', x: e.x, z: e.z, h: e.h, life: 1.0, col: e.col, size: 1, text: e.text }); break;
        case 'debris': {
          const pose = e.kind === 'ice' ? 'ice' : 'debris';
          for (let i = 0; i < 5; i++) this.add({ k: 'chunk', x: e.x, z: e.z, h: 20, vx: (R() - 0.5) * 420, vh: 300 + R() * 300, life: 0.8, col: '', size: e.kind === 'ice' ? 0.3 : 0.7, pose, spin: (R() - 0.5) * 20, grav: 1500 });
          break;
        }
        case 'zap': for (let i = 0; i < 4; i++) this.add({ k: 'zap', x: e.x, z: e.z, h: e.h, life: 0.25, col: '#e8f0ff', size: 60 + R() * 40, rot: R() * 6.28 }); break;
        case 'trail': { const p = g[e.who]; this.add({ k: 'ghost', x: p.x, z: p.z, h: p.h, life: 0.16, col: '', size: 1, pose: this.heroPose(p, g), flip: p.face < 0 }); break; }
        case 'lantern': this.add({ k: 'fly', x: e.x, z: e.z, h: e.h, life: 0.9, col: '', size: 1, si: e.si, slot: e.slot }); break;
        case 'flash': this.flash = Math.max(this.flash, e.a); break;
      }
    }
  }
  private add(o: Partial<Fx> & { k: string; x: number; z: number; h: number; life: number }) {
    this.fx.push({ t: 0, vx: 0, vh: 0, vz: 0, col: '#fff', size: 1, ...o });
    if (this.fx.length > 500) this.fx.splice(0, this.fx.length - 500);
  }
  update(dt: number) {
    this.rt += dt; this.flash = Math.max(0, this.flash - dt * 3);
    for (const e of this.fx) {
      e.t += dt; e.x += e.vx * dt; e.z += e.vz * dt; e.h += e.vh * dt;
      if (e.grav) e.vh -= e.grav * dt;
      if (e.k === 'dust') { e.vx *= 0.9; e.vh *= 0.9; }
      if (e.k === 'fest') { e.vx *= 0.92; e.vh *= 0.92; }
      if (e.k === 'chunk' && e.h < 0) { e.h = 0; e.vh = -e.vh * 0.3; e.vx *= 0.6; }
    }
    this.fx = this.fx.filter((e) => e.t < e.life);
    for (const k in this.pressed) this.pressed[k] = Math.max(0, this.pressed[k] - dt);
  }

  // ─────────────────────────────────────────── poses
  heroPose(p: Hero, g: BrineGame): string {
    const n = p.name, t = p.t, cyc = (fps: number, k: number) => Math.floor(p.anim * fps) % k;
    switch (p.st) {
      case 'win': return `${n}-${cyc(2.5, 2) ? 'win2' : 'win'}`;
      case 'hurt': return `${n}-${t < 0.16 ? 'hurt' : 'hurt2'}`;
      case 'down': return `${n}-down`;
      case 'getup': return `${n}-getup`;
      case 'tagin': return n === 'dora' ? (t < 0.12 ? 'dora-tagleap' : 'dora-tag') : 'enzo-tag';
      case 'flopland': return `${n}-land`;
      case 'dbl': return `${n}-tag`;
      case 'dash': return `${n}-dash`;
      case 'land': return `${n}-land`;
      case 'specland': return `${n}-sp3`;
      case 'special':
        if (n === 'dora') return t < 0.06 ? 'dora-sp0' : cyc(14, 2) ? 'dora-sp2' : 'dora-sp1';
        return t < 0.1 ? 'enzo-sp0' : p.vh > 0 ? 'enzo-sp1' : 'enzo-sp2';
      case 'airatk':
        if (p.airKind === 'rise') return 'dora-rise';
        if (p.airKind === 'hammer') return 'enzo-hammer';
        return 'dora-dive';
      case 'air': return p.vh > 60 || n === 'enzo' ? `${n}-jump` : 'dora-fall';
      case 'grab': return n === 'enzo' ? 'enzo-reach' : 'dora-pick';
      case 'hold': return n === 'enzo' ? 'enzo-hold' : 'dora-idle';
      case 'throw': return n === 'enzo' ? (t < 0.1 ? 'enzo-throww' : 'enzo-throw') : 'dora-k2';
      case 'heave': return 'enzo-heave';
      case 'pick': return n === 'dora' ? 'dora-pick' : 'enzo-reach';
      case 'atk': {
        const mk = p.mk, hitAt = { k1: 0.05, k2: 0.06, k3: 0.05, k4: 0.1, p1: 0.09, p2: 0.09, p3: 0.18, knee: 0.04, barge: 0.05 }[mk] ?? 0.05;
        const wind = t < hitAt;
        switch (mk) {
          case 'k1': return wind ? 'dora-k1w' : 'dora-k1';
          case 'k2': return wind ? 'dora-k2w' : 'dora-k2';
          case 'k3': return wind ? 'dora-k2w' : 'dora-k1';
          case 'k4': return wind ? 'dora-k4w' : t < hitAt + 0.12 ? 'dora-k4' : 'dora-k4f';
          case 'p1': return wind ? 'enzo-p1w' : 'enzo-p1';
          case 'p2': return wind ? 'enzo-p1w' : 'enzo-p2';
          case 'p3': return wind ? 'enzo-p3w' : 'enzo-p3';
          case 'knee': return 'dora-knee';
          case 'barge': return 'enzo-barge';
        }
        return `${n}-idle`;
      }
      case 'walk': return `${n}-${['walk1', 'walk3', 'walk2', 'walk4'][cyc(n === 'dora' ? 11 : 8, 4)]}`;
      default:
        if (p.h > 0) return `${n}-jump`;
        return `${n}-${cyc(1.6, 2) ? 'idle2' : 'idle'}`;
    }
    void g;
  }
  foePose(f: Foe): string {
    const k = f.kind, a = f.anim, cyc = (fps: number, n: number) => Math.floor(a * fps) % n;
    if (k === 'eel') {
      if (inHole(f)) {
        if (f.st === 'duck') return 'eel-duck';
        if (f.st === 'wind') return cyc(9, 2) ? 'eel-duck' : 'eel-peek';
        if (f.st === 'atk') return f.t < 0.08 ? 'eel-lunge' : 'eel-reach';
        if (f.st === 'rec') return 'eel-tired';
        if (f.st === 'ko') return 'eel-thrown';
        return 'eel-peek';
      }
      const m: Record<string, string> = { held: 'held', thrown: 'thrown', ko: 'thrown', hurt: 'hurt', down: 'down', up: 'down', daze: 'down', tangled: 'down', wind: 'walk2', atk: 'hurt', rec: 'walk1' };
      return 'eel-' + (m[f.st] ?? (cyc(6, 2) ? 'walk1' : 'walk2'));
    }
    if (k === 'octo') {
      if (perched(f) && f.st !== 'enter' && f.st !== 'ko') return f.st === 'wind' ? 'octo-puff' : f.st === 'squirt' ? 'octo-squirt' : 'octo-perch';
      const m: Record<string, string> = { enter: 'fall', held: 'hurt', thrown: 'fall', ko: 'fall', hurt: 'hurt', up: 'down', daze: 'down', tangled: 'down', wind: 'slap', atk: 'slap', rec: 'idle', idle: 'idle' };
      if (f.st === 'down') return f.h > 5 ? 'octo-fall' : 'octo-down';
      return 'octo-' + (m[f.st] ?? (cyc(6, 2) ? 'walk1' : 'walk2'));
    }
    if (k === 'cormorant') {
      const m: Record<string, string> = { wind: 'aim', dive: 'dive', crash: 'stuck', hurt: 'hurt', held: 'hurt', thrown: 'hurt', ko: 'hurt', down: 'down', up: 'down', daze: 'down', tangled: 'down' };
      if (m[f.st]) return 'cormorant-' + m[f.st];
      return f.h > 20 ? (cyc(6, 2) ? 'cormorant-fly1' : 'cormorant-fly2') : 'cormorant-waddle';
    }
    const pick = (...names: string[]) => names.find((x) => FRAMES[`${k}-${x}`]) ?? 'idle';
    let p = 'idle';
    if (k === 'hermit' && !f.shell) return 'hermit-soft';
    if (k === 'urchin' && f.flipped && f.st !== 'ko') return 'urchin-down';
    switch (f.st) {
      case 'held': case 'lift': p = pick('daze', 'down'); break;
      case 'thrown': case 'ko': p = k === 'crab' ? 'tumble' : k === 'gull' ? 'airhurt' : pick('hurt'); break;
      case 'hurt': p = k === 'gull' && f.h > 30 ? 'airhurt' : 'hurt'; break;
      case 'down': p = k === 'gull' ? 'crash' : k === 'crab' && f.h > 10 ? 'tumble' : 'down'; break;
      case 'up': p = pick('getup', 'down'); break;
      case 'daze': case 'crash': case 'tangled': p = pick(k === 'gull' ? 'crash' : 'daze', 'hurt'); break;
      case 'wind': case 'charge': p = k === 'jelly' ? (f.st === 'charge' ? 'charge' : 'pulse') : k === 'gull' ? 'wind' : cyc(8, 2) && FRAMES[`${k}-wind2`] ? 'wind2' : 'wind'; break;
      case 'atk': p = k === 'gull' ? 'dive' : 'atk'; break;
      case 'dive': p = 'dive'; break;
      case 'rec': p = pick('rec', 'idle'); break;
      case 'block': p = 'block'; break;
      case 'puffed': p = 'puffed'; break;
      case 'roll': p = k === 'hermit' ? 'roll' : cyc(10, 2) ? 'roll1' : 'roll2'; break;
      case 'whistle': p = cyc(6, 2) ? 'whistle1' : 'whistle2'; break;
      case 'zap': p = 'zap'; break;
      case 'flee': p = k === 'shrimp' ? (cyc(10, 2) ? 'run1' : 'run2') : 'walk'; break;
      case 'hover':
        p = f.lantern ? 'carry' : cyc(7, 2) ? 'flap' : 'flap2'; break;
      case 'walk': case 'enter':
        if (k === 'gull') p = f.h > 20 ? (f.lantern ? 'carry' : cyc(7, 2) ? 'flap' : 'flap2') : 'waddle';
        else if (k === 'crab') p = ['idle', 'walk', 'walk2', 'walk'][cyc(10, 4)];
        else if (k === 'hermit') p = cyc(5, 2) ? 'walk' : 'walk2';
        else if (k === 'jelly') p = cyc(3, 2) ? 'drift' : 'idle';
        else if (k === 'shrimp') p = cyc(10, 2) ? 'run1' : 'run2';
        else if (k === 'urchin') p = cyc(8, 2) ? 'roll1' : 'idle';
        else p = cyc(6, 2) ? 'walk1' : 'walk2';
        break;
      default:
        if (k === 'gull') p = f.h > 20 ? (f.lantern ? 'carry' : cyc(7, 2) ? 'flap' : 'flap2') : 'idle';
        else if (k === 'jelly') p = cyc(2, 2) ? 'pulse' : 'idle';
        else if (k === 'crab' && f.dazedOnce && cyc(1, 5) === 0) p = 'taunt';
        else p = 'idle';
    }
    return FRAMES[`${k}-${p}`] ? `${k}-${p}` : `${k}-idle`;
  }
  bossPose(b: Boss): string {
    const st = b.st, cyc = (fps: number, n: number) => Math.floor(b.t * fps) % n;
    if (b.kind === 'brute') {
      const bare = b.armour <= 0;
      if (st === 'end' || st === 'down') return 'brute-down';
      if (b.hurtT > 0) return bare ? 'brute-bhurt' : 'brute-hurt';
      if (st === 'guard' || st === 'crouch') return bare ? 'brute-bwind' : 'brute-block';
      if (st === 'tell' || st === 'wind') return bare ? 'brute-bwind' : 'brute-wind';
      if (st === 'swipe' || st === 'stomp') return bare ? 'brute-batk' : 'brute-atk';
      if (st === 'dizzy') return bare ? 'brute-bhurt' : 'brute-hurt';
      if (st === 'walk' || Math.abs(b.tx - b.x) > 20) return bare ? (cyc(4, 2) ? 'brute-bwalk' : 'brute-bidle') : cyc(4, 2) ? 'brute-walk' : 'brute-idle';
      return bare ? 'brute-bidle' : 'brute-idle';
    }
    if (b.kind === 'clamps') {
      if (st === 'end' || st === 'down') return 'clamps-down';
      if (st === 'bare' || st === 'juggle' || st === 'swipe' || st === 'wind' || st === 'thrown') {
        if (st === 'juggle' || st === 'thrown') return 'clamps-juggle';
        if (st === 'wind') return 'clamps-bwind';
        if (st === 'swipe') return 'clamps-bswipe';
        return b.hurtT > 0 ? 'clamps-juggle' : 'clamps-bare';
      }
      if (st === 'dizzy' || st === 'ripping') return b.layers > 0 || st === 'ripping' ? 'clamps-dizzy' : 'clamps-bdizzy';
      if (st === 'rock' || st === 'tell') return cyc(8, 2) ? 'clamps-rock1' : 'clamps-rock2';
      if (st === 'roll') return 'clamps-roll';
      return 'clamps-idle';
    }
    if (b.kind === 'knuckles') {
      const m: Record<string, string> = { tell: 'tell', punch: cyc(12, 2) ? 'punch' : 'flurry', guard: 'guard', crouch: 'guard', hop: 'hop', dizzy: 'dizzy', down: 'down', end: 'down', thrown: 'hurt' };
      if (b.hurtT > 0 && st !== 'dizzy' && st !== 'down' && st !== 'end') return 'knuckles-hurt';
      if (m[st]) return 'knuckles-' + m[st];
      if (Math.abs(b.tx - b.x) > 20) return cyc(6, 2) ? 'knuckles-step1' : 'knuckles-step2';
      return cyc(0.5, 4) === 3 ? 'knuckles-taunt' : 'knuckles-idle';
    }
    if (b.kind === 'longshanks') {
      const m: Record<string, string> = { end: 'down', stomptell: 'raise', stomp: 'stomp', heave: 'stomp', sweepw: 'crouch', sweep: 'sweep', wobble: 'crouch', getup: 'climb' };
      if (st === 'toppled') return b.hurtT > 0 ? 'longshanks-thurt' : b.t < 0.35 ? 'longshanks-toppled' : 'longshanks-tdizzy';
      if (m[st]) return 'longshanks-' + m[st];
      if (Math.abs(b.tx - b.x) > 20 || st === 'intro') return cyc(5, 2) ? 'longshanks-walk1' : 'longshanks-walk2';
      return 'longshanks-idle';
    }
    if (b.kind === 'tanglejaw') {
      const m: Record<string, string> = { end: 'down', intro: 'roar', roar: 'roar', bonk: 'hurt', sink: 'sink', whipw: 'tell', whip: 'whip', stretched: 'stuck' };
      if (st === 'strike') return b.ext < 200 ? 'tanglejaw-lunge' : 'tanglejaw-strike';
      if (st === 'bubble') { const T = b.t / 1.1; return T < 0.45 ? '' : T < 0.8 ? 'tanglejaw-sink' : 'tanglejaw-peek'; }
      if (st === 'under') return '';
      return 'tanglejaw-' + (m[st] ?? 'peek');
    }
    // the Gull Admiral
    const m: Record<string, string> = { shriek: 'shriek', dive: 'dive', redive: 'dive', swoop: 'swoop', tumble: 'tumble', skid: 'tumble', grounded: 'grounded', pinned: 'pinned', wingtell: 'wingw', end: 'down', rise: 'hover', hover: 'hover' };
    if (b.hurtT > 0 && st !== 'grounded' && st !== 'pinned' && st !== 'end') return 'admiral-hurt';
    if (m[st]) return 'admiral-' + m[st];
    return b.h > 20 ? 'admiral-hover' : 'admiral-stand';
  }

  // ─────────────────────────────────────────── the camera
  private camera(g: BrineGame, dt: number) {
    const key = g.stageId + ':' + g.scene.id;
    if (this.portrait) {
      const p = g.hero();
      let tx = p.x - this.vw / 2 + p.face * this.vw * 0.08;
      const lo = g.lock !== null ? g.camL : 0, hi = g.lock !== null ? g.camR - this.vw : g.len - this.vw;
      // in a fight, frame the hero and the nearest threat together, keeping the hero well inside the view
      let near: { x: number } | null = g.boss && g.boss.st !== 'gone' && g.boss.st !== 'end' ? g.boss : null, nd = near ? Math.abs(near.x - p.x) : 1e9;
      for (const f of g.foes) { if (f.st === 'ko' || f.st === 'held') continue; const d = Math.abs(f.x - p.x); if (d < nd) { nd = d; near = f; } }
      // in a chase, the thief is the one to keep in view
      const G = g.goal, chase = !!G && G.kind === 'chase' && !G.done && !G.won;
      if (chase) { near = G!; nd = Math.abs(G!.x - p.x); }
      const fight = g.lock !== null || chase;
      // and pull back (up to 700 units across) when the threat is too far off to share the close view
      const want = near && fight ? clamp(nd + 300, PORTRAIT_VIEW, 700) : PORTRAIT_VIEW;
      this.zoomVw += (want - this.zoomVw) * Math.min(1, dt * 2.5);
      this.vw = this.zoomVw; this.s = this.W / this.vw; this.oy = this.playBottom - 660 * this.s;
      tx = p.x - this.vw / 2 + p.face * this.vw * 0.08;
      if (near && fight) tx = clamp((p.x + near.x) / 2 - this.vw / 2, p.x - this.vw * 0.85, p.x - this.vw * 0.15);
      tx = clamp(tx, Math.min(lo, hi), Math.max(lo, hi));
      if (key !== this.stageKey || this.camX < -900) this.camX = tx;
      this.camX += (tx - this.camX) * Math.min(1, dt * 6);
      this.viewL = this.camX;
    } else {
      this.viewL = g.cam - this.vw / 2;
      if (g.len > this.vw) this.viewL = clamp(this.viewL, Math.min(0, g.camL), Math.max(g.len - this.vw, g.camL));
    }
    this.stageKey = key;
  }

  // ─────────────────────────────────────────── the world
  draw(g: BrineGame, dt: number, o: { labels: Labels; paused?: boolean; hideHud?: boolean; touchDrawn?: boolean }) {
    if (!this.ready) return;
    const cx = this.cx;
    this.area3 = g.area() >= 3;
    this.camera(g, dt);
    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.fillStyle = '#1d1b4a'; cx.fillRect(0, 0, this.W, this.H);
    cx.save();
    if (g.shake > 0.2) cx.translate((Math.random() - 0.5) * g.shake * this.s * 1.4, (Math.random() - 0.5) * g.shake * this.s * 1.4);
    if (this.portrait) { cx.beginPath(); cx.rect(0, 0, this.W, this.playBottom); cx.clip(); }
    this.drawFar(g); this.drawFireworks(g); this.drawStrings(g);
    for (const f of g.foes) if (f.st === 'ko' && f.z < -8) this.drawFoe(f, g);
    this.drawFx(g, true);
    this.drawFloor(g); this.drawBack(g); this.drawDoor(g); this.drawWater(g); this.drawTelegraphs(g); this.drawFoeTells(g);
    const list: { z: number; d: () => void }[] = [];
    const p = g.hero(), q = g.partner();
    list.push({ z: p.z + 0.1, d: () => this.drawHero(p, g, false) });
    if (q.st !== 'out') list.push({ z: q.z, d: () => this.drawHero(q, g, false) });
    for (const f of g.foes) if (!(f.st === 'ko' && f.z < -8)) list.push({ z: f.st === 'held' ? p.z + 1 : f.z, d: () => this.drawFoe(f, g) });
    for (const it of g.items) if (!it.dead) list.push({ z: it.held ? p.z + 1 : it.z, d: () => this.drawItem(it, g) });
    for (const pr of g.props) if (pr.alive) list.push({ z: pr.kind === 'net' && !pr.down ? 999 : pr.z - 0.5, d: () => this.drawProp(pr) });
    for (const c of g.rolls) {
      if (c.t < c.tell) continue;
      const z = LANE_Z[c.lane];
      if (c.kind === 'cart') list.push({ z, d: () => { this.shadow(c.x, z, 70, 0); this.spr('cart', c.x, z, 0, { flip: true }); } });
      else list.push({ z, d: () => { this.shadow(c.x, z, 36, 0); this.spr('tarbarrel', c.x, z, 4, { rot: -c.t * 9 }); } });
    }
    // Tanglejaw's drain holes, plugged or open (not the one he is showing out of)
    const b0 = g.boss, showing = b0 && b0.kind === 'tanglejaw' && !['under', 'gone'].includes(b0.st) && !(b0.st === 'bubble' && b0.t < 0.5) ? b0.hole : -1;
    g.holes.forEach((h, i) => { if (i !== showing || h.plug) list.push({ z: h.z - 2, d: () => this.drawHole(g, i) }); });
    // eel holes and inker posts left behind once their owner is out
    for (const f of g.foes) {
      if (f.st === 'ko') continue;
      if (f.kind === 'eel' && f.loose) list.push({ z: f.tz - 1, d: () => this.spr('eel-hole', f.tx, f.tz, 0) });
      if (f.kind === 'octo' && (f.loose || f.st === 'enter')) list.push({ z: f.tz - 1, d: () => { this.shadow(f.tx, f.tz, 26, 0); this.spr('octo-post', f.tx, f.tz, 0); } });
    }
    if (g.boss && g.boss.st !== 'gone') { const b = g.boss; list.push({ z: b.z - 20, d: () => this.drawBoss(b, g) }); }
    const G = g.goal;
    if (G && G.kind === 'chase' && !(G.done && G.stT > 1.5)) list.push({ z: G.z + 0.2, d: () => this.drawThief(G) });
    if (G && G.kind === 'defend') list.push({ z: G.z - 1, d: () => this.drawStall(G, g) });
    list.sort((a, b) => a.z - b.z).forEach((x) => x.d());
    this.drawFx(g, false); this.drawFlies(g); this.drawTide(g);
    if (q.st === 'out' && g.mode !== 'clear') this.drawHero(q, g, true);
    this.drawFront(g);
    this.drawNight(g);
    if (this.portrait) this.drawEdgeArrows(g);
    this.drawInk(g);
    cx.restore();
    if (this.flash > 0) { cx.fillStyle = `rgba(255,248,230,${this.flash * 0.5})`; cx.fillRect(0, 0, this.W, this.playBottom); }
    if (!o.hideHud) { this.drawHud(g, o.labels); this.drawBossHint(g, o.labels); this.drawPrompt(g, o.labels); this.drawTalk(g); }
    if (this.portrait) this.drawPanel(g, o.labels);
    if (this.touch || this.portrait) this.drawTouch(g, o.labels);
  }

  /** the hour: the first stage of a district is painted at sunset; the boss stage gets fireworks */
  tod(g: BrineGame) { return g.inSecret ? 'night' : timeOfDay(g.stageId); }
  private drawFar(g: BrineGame) {
    if (g.scene.ride === 'lift') { this.drawLiftFar(g); return; }
    const im = (this.tod(g) === 'dusk' && this.img['dusk-' + g.scene.far]) || this.img['far-' + g.scene.far]; if (!im) return;
    const cx = this.cx, topWorld = -this.oy / this.s, waterY = 300, par = 0.05;
    const fh = Math.max((waterY - topWorld) / 0.72, ((this.vw + g.len * par) / 1.5) * 1.03);
    const fw = fh * 1.5, y0 = waterY - fh * 0.72;
    // on a barge or a raft the harbour slides past behind you
    const x0 = -(this.viewL * par + g.rideX * 0.5) % (fw * 2) - fw * 0.02;
    for (let i = -1; i < 3; i++) {
      const xx = x0 + i * fw; if (xx > this.vw || xx + fw < 0) continue;
      cx.save(); cx.translate(xx * this.s, this.SY(y0));
      if ((((i % 2) + 2) % 2 === 1) !== !!g.scene.farFlip) { cx.translate(fw * this.s, 0); cx.scale(-1, 1); }
      cx.drawImage(im, 0, 0, fw * this.s, fh * this.s); cx.restore();
    }
    const lit = this.litFrac(g), y1 = this.SY(y0 + fh * 0.25), y2 = this.SY(waterY);
    const gr = cx.createLinearGradient(0, y1, 0, y2);
    gr.addColorStop(0, 'rgba(255,170,80,0)'); gr.addColorStop(1, `rgba(255,170,90,${0.1 + 0.22 * lit})`);
    cx.globalCompositeOperation = 'lighter'; cx.fillStyle = gr; cx.fillRect(0, y1, this.W, y2 - y1); cx.globalCompositeOperation = 'source-over';
  }
  /** the cargo lift: the market wall slides down past you as you rise; alternate tiles are mirrored so they join */
  private drawLiftFar(g: BrineGame) {
    const im = this.img['far-lift']; if (!im) return;
    const cx = this.cx, topWorld = -this.oy / this.s;
    const fw = this.vw * 1.08, fh = fw * 1.5, x = -fw * 0.04 - (this.viewL % 40) * 0.05;
    const off = (g.rideX * 0.9) % (fh * 2);
    for (let i = -2; i < 2; i++) {
      const y = topWorld + off + i * fh; if (y > 320 || y + fh < topWorld) continue;
      cx.save(); cx.translate(x * this.s, this.SY(y));
      if (((i % 2) + 2) % 2 === 1) { cx.translate(0, fh * this.s); cx.scale(1, -1); }
      cx.drawImage(im, 0, 0, fw * this.s, fh * this.s); cx.restore();
    }
  }
  /** fireworks over the boss stage: bursts on a loop, drawn additively; each burst brightens the sky a little */
  skyFlash = 0;
  private drawFireworks(g: BrineGame) {
    this.skyFlash = 0;
    const im = this.img['fireworks']; if (!im || this.tod(g) !== 'fireworks') return;
    const cx = this.cx, topWorld = -this.oy / this.s, cw = im.width / 4, ch = im.height / 3;
    cx.save(); cx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const P = 2.7 + i * 0.41, t0 = this.rt + i * 1.37, n = Math.floor(t0 / P), t = t0 - n * P;
      const hsh = Math.sin((n + 1) * 12.9898 + i * 78.233) * 43758.5453, r = hsh - Math.floor(hsh);
      const x = this.viewL + this.vw * (0.08 + 0.84 * ((r + i * 0.21) % 1)), y = topWorld + 40 + r * Math.max(40, 230 - topWorld - 40);
      const col = (i + n) % 3, sz = 230 + r * 80;
      let fr = -1, a = 1, yy = y;
      if (t < 0.4) { fr = 0; yy = y + (0.4 - t) * 260; }
      else if (t < 0.6) fr = 1;
      else if (t < 1.4) { fr = 2; this.skyFlash = Math.max(this.skyFlash, 1 - (t - 0.6) / 0.6); }
      else if (t < 2.2) { fr = 3; a = 1 - (t - 1.4) / 0.8; }
      if (fr < 0) continue;
      cx.globalAlpha = a;
      cx.drawImage(im, fr * cw, col * ch, cw, ch, this.SX(x - sz / 2), this.SY(yy - sz * 0.45), sz * this.s, sz * 0.89 * this.s);
    }
    cx.restore();
  }
  private litFrac(g: BrineGame) { let a = 0, b = 0; for (const s of g.strings) { a += s.glow * s.need; b += s.need; } return b ? a / b : 1; }
  private drawFloor(g: BrineGame) {
    const im = this.img['floor-' + g.scene.floor]; if (!im) return;
    const cx = this.cx, k = STRIP_H / im.height, tw = im.width * k;
    const i0 = Math.floor(this.viewL / tw), i1 = Math.floor((this.viewL + this.vw) / tw);
    const bottom = this.portrait ? this.playBottom : this.H;
    for (let i = i0; i <= i1; i++) {
      const x = i * tw, sx = Math.floor(this.SX(x)), w = Math.ceil(tw * this.s) + 1;
      cx.drawImage(im, sx, this.SY(STRIP_TOP), w, im.height * k * this.s);
      let y = STRIP_TOP + STRIP_H - 2;
      while (this.SY(y) < bottom) {
        const src = im.height * 0.45;
        cx.drawImage(im, 0, im.height - src, im.width, src, sx, this.SY(y), w, src * k * this.s);
        y += src * k - 2;
      }
    }
  }
  private strX(g: BrineGame, i: number) { return g.scene.strings[i].col * COL + COL / 2; }
  private drawStrings(g: BrineGame) {
    const f = FRAMES['string-dark']; if (!f) return;
    const hgt = (f[4] * STR_W) / f[3];
    g.strings.forEach((s, i) => {
      const x = this.strX(g, i); if (x < this.viewL - 400 || x > this.viewL + this.vw + 400) return;
      this.spr('string-dark', x, 0, FLOOR - STR_Y - hgt, { sc: (STR_W * PX) / f[3] });
      if (s.glow > 0.01) this.spr('string-lit', x, 0, FLOOR - STR_Y - hgt, { sc: (STR_W * PX) / f[3], alpha: Math.min(1, s.glow) });
    });
  }
  private lanternTarget(g: BrineGame, si: number, slot: number): [number, number] {
    const f = FRAMES['string-dark'], hgt = (f[4] * STR_W) / f[3];
    return [this.strX(g, si) - STR_W / 2 + LANX[slot % 6] * STR_W, STR_Y + hgt * 0.56];
  }
  private drawBack(g: BrineGame) {
    const row = g.scene.back;
    for (let c = 0; c < row.length; c++) {
      const n = DECOR[row[c]]; if (!n) continue;
      const x = c * COL + COL / 2; if (x < this.viewL - 160 || x > this.viewL + this.vw + 160) continue;
      const npc = NPC_OF[row[c]];
      if (npc) { const talking = g.talk?.who === npc; this.spr(n + (talking && FRAMES[n + '-talk'] ? '-talk' : '') + (npc === 'twins' && talking ? '-cheer' : ''), x, -6, talking ? Math.abs(Math.sin(this.rt * 8)) * 4 : 0); continue; }
      this.spr(n, x, -4, 0);
    }
  }
  private drawFront(g: BrineGame) {
    const row = g.scene.front;
    for (let c = 0; c < row.length; c++) {
      const n = DECOR[row[c]]; if (!n) continue;
      const x = c * COL + COL / 2; if (x < this.viewL - 160 || x > this.viewL + this.vw + 160) continue;
      this.spr(n, x, DEPTH + 56, 0, { sc: 1.25 });
    }
  }
  private drawDoor(g: BrineGame) {
    const c = g.scene.lanes[0].indexOf('a'); if (c < 0 || !g.scene.secret) return;
    const x = c * COL + COL / 2, open = g.secretDoor() !== null;
    this.spr(open ? 'hatch-open' : 'hatch', x, 2, 0);
    if (open) this.glow(x, 6, 30, 70, `rgba(255,210,120,${0.35 + 0.2 * Math.sin(this.rt * 5)})`);
  }
  private shadow(x: number, z: number, r: number, h: number) {
    const cx = this.cx, a = 0.34 * Math.max(0.25, 1 - h / 300);
    cx.fillStyle = `rgba(20,14,40,${a})`;
    cx.beginPath(); cx.ellipse(this.SX(x), this.SY(FLOOR + z), r * this.s * (1 - Math.min(0.5, h / 600)), r * 0.32 * this.s, 0, 0, 7); cx.fill();
  }
  glow(x: number, z: number, h: number, r: number, col: string) {
    const sx = this.SX(x), sy = this.SY(FLOOR + z - h), R = r * this.s, cx = this.cx;
    const gr = cx.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = gr; cx.fillRect(sx - R, sy - R, R * 2, R * 2); cx.restore();
  }
  private glint(x: number, z: number, h: number, col: string, t: number) {
    const a = Math.sin(t * 3) * 0.5 + 0.5; if (a < 0.55) return;
    const sx = this.SX(x), sy = this.SY(FLOOR + z - h), r = (6 + 8 * (a - 0.55) * 2) * this.s, cx = this.cx;
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = col; cx.globalAlpha = (a - 0.55) * 2; cx.lineWidth = 2 * this.s;
    cx.beginPath(); cx.moveTo(sx - r, sy); cx.lineTo(sx + r, sy); cx.moveTo(sx, sy - r); cx.lineTo(sx, sy + r); cx.stroke(); cx.restore();
  }
  private stars(x: number, z: number, h: number) {
    const cx = this.cx;
    for (let i = 0; i < 3; i++) {
      const a = this.rt * 5 + i * 2.09, sx = this.SX(x + Math.cos(a) * 26), sy = this.SY(FLOOR + z - h + Math.sin(a) * 7), r = 6 * this.s;
      cx.fillStyle = '#ffe58a'; cx.beginPath();
      for (let j = 0; j < 8; j++) { const rr = j % 2 ? r * 0.4 : r, aa = (j * Math.PI) / 4 + this.rt * 3; cx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
      cx.fill();
    }
  }

  private edge() { return { x: this.viewL + (this.portrait ? 26 : 30), z: this.portrait ? DEPTH - 6 : DEPTH + 14 }; }
  private drawHero(p: Hero, g: BrineGame, waiting: boolean) {
    let pose = this.heroPose(p, g), x = p.x, z = p.z, h = p.h;
    const o: Parameters<BrineScene['spr']>[4] = { flip: p.face < 0, flash: p.flash };
    if (waiting) {
      const pr = g.prompt && g.prompt.who === 'partner', e = this.edge();
      pose = p.hp <= 0 || !p.ready ? `${p.name}-hurt2` : pr ? `${p.name}-win` : `${p.name}-idle`;
      x = e.x; z = e.z; h = p.edgeH + (pr ? Math.abs(Math.sin(this.rt * 6)) * 14 : 0); o.flip = false; o.alpha = 0.97; o.sc = 0.8;
      if (pr) { const c = g.prompt!.tint === 'grey' ? 'rgba(220,228,240,' : 'rgba(255,240,200,'; this.glow(x, z, 70, 110, c + (0.35 + 0.25 * Math.sin(this.rt * 8)) + ')'); }
    }
    if (p.st === 'idle' && !waiting) o.sy = 1 + Math.sin(p.anim * 4) * 0.012;
    if (p.st === 'land' || p.st === 'specland') o.sy = 1 - Math.max(0, 0.08 - p.t * 0.5);
    if (p.inv > 0 && p.st !== 'hurt' && p.st !== 'getup' && Math.floor(this.rt * 20) % 2 && !waiting) o.alpha = 0.55;
    if (p.st === 'special' && p.name === 'dora') this.glow(x, z, h + 70, 120, `rgba(255,236,190,${0.35 + 0.2 * Math.sin(this.rt * 30)})`);
    if (p.st === 'special' && p.name === 'enzo') this.glow(x, z, h + 60, 110, 'rgba(220,230,245,.35)');
    this.shadow(waiting ? x : p.x, waiting ? z : p.z, HC[p.name].rad * 1.3, h);
    this.spr(pose, x, z, h, o);
  }
  private drawFoe(f: Foe, g: BrineGame) {
    const pose = this.foePose(f), o: Parameters<BrineScene['spr']>[4] = { flip: f.face > 0, flash: f.flash };
    if (inHole(f) && f.st !== 'ko') {
      // an eel in its hole: the painting includes the hole; a stretched frame is placed so its tail end sits in it
      let x = f.tx;
      if (STRETCHED.has(pose)) { const w = FRAMES[pose][3] / PX; x = f.tx + f.face * (w / 2 - 28); }
      if (f.st === 'wind') { o.ox = Math.sin(f.t * 50) * 2; this.glow(f.tx, f.tz, 20, 50, `rgba(160,230,255,${0.3 + 0.25 * Math.sin(f.t * 30)})`); this.bubbles(f.tx, f.tz, f.t); }
      this.spr(pose, x, f.tz, 0, o);
      if (f.st === 'idle' || f.st === 'wind') this.glint(f.tx + f.face * 10, f.tz, 60, '#dfe6ef', f.anim);
      if (f.st === 'rec') this.stars(f.x, f.z, 50);
      return;
    }
    if (perched(f) && f.st !== 'enter' && f.st !== 'ko') {
      // an inker on its post: the painting includes the post, standing on the boards
      if (f.st === 'wind') { o.ox = -f.face * Math.sin(f.t * 50) * 2.5; this.glow(f.tx, f.tz, f.h + 40, 60, `rgba(255,120,80,${0.25 + 0.2 * Math.sin(f.t * 30)})`); }
      this.shadow(f.tx, f.tz, 30, 0);
      this.spr(pose, f.tx, f.tz, 0, o);
      this.glint(f.tx, f.tz, f.h + 60, '#fff0c8', f.anim);
      if (f.lantern >= 0) this.spr('lantern-lit', f.tx + f.face * 6, f.tz + 0.2, f.h + 60, { sc: 0.9 });
      return;
    }
    const h = f.h;
    if (f.st === 'ko' || f.st === 'thrown') o.rot = f.t * f.spin;
    if (f.st === 'wind' || f.st === 'charge') o.ox = -f.face * Math.sin(f.t * 50) * 2.5;
    if (f.st === 'puffed') o.sc = 1 + Math.sin(this.rt * 9) * 0.03;
    if (f.st !== 'ko' || f.z > -10) this.shadow(f.x, Math.max(0, f.z), f.rad, Math.max(0, h));
    // the cream/grey glint: shells and armour read grey (Enzo's), wings and air read cream (Dora's)
    if (f.st !== 'ko' && f.st !== 'held') {
      if ((f.kind === 'hermit' && f.shell) || f.kind === 'lobster' || (f.kind === 'urchin' && !f.flipped)) this.glint(f.x - f.face * 14, f.z, h + f.ht * 0.7, '#dfe6ef', f.anim);
      if (((f.kind === 'gull' || f.kind === 'cormorant') && f.h > 40) || f.kind === 'jelly' || f.st === 'puffed') this.glint(f.x, f.z, h + f.ht * 0.7, '#fff0c8', f.anim);
    }
    if (f.st === 'wind' || f.st === 'charge') this.glow(f.x, f.z, h + 30, 60, `rgba(255,120,80,${0.25 + 0.2 * Math.sin(f.t * 30)})`);
    if (f.kind === 'jelly' && f.st !== 'ko') this.glow(f.x, f.z, h + 50, 70, `rgba(200,220,255,${0.18 + 0.1 * Math.sin(f.anim * 4)})`);
    this.spr(pose, f.x, f.z, h, o);
    if (f.lantern >= 0 && f.st !== 'ko' && pose !== 'gull-carry') this.spr('lantern-lit', f.x + f.face * 6, f.z + 0.2, h + (f.kind === 'gull' ? -26 : f.ht * 0.8), { sc: 0.9 });
    if ((f.daze > 0 && f.st !== 'held') || f.st === 'crash') this.stars(f.x, f.z, h + f.ht + 10);
    if (f.kind === 'shrimp' && f.st === 'whistle') this.glow(f.x - f.face * 30, f.z, h + 70, 50, `rgba(255,240,180,${0.3 + 0.3 * Math.sin(this.rt * 20)})`);
    void g;
  }
  private drawItem(it: Item, g: BrineGame) {
    const n = { shell: 'hermit-shell', barrel: it.sid || g.area() >= 3 ? 'tarbarrel' : 'barrel', snack: 'snack', bun: 'bun', charm: 'charm', scroll: 'scroll' }[it.kind];
    let h = it.h, z = it.z, x = it.x;
    if (it.held) { const p = g.hero(); x = p.x; z = p.z; h = p.h + (p.name === 'enzo' ? 150 : 90); }
    const bob = it.kind === 'charm' || it.kind === 'scroll' ? 10 + Math.sin(this.rt * 3 + it.id) * 6 : 0;
    this.shadow(x, z, it.kind === 'barrel' ? 34 : 24, h + bob);
    if (it.kind === 'charm' || it.kind === 'scroll') this.glow(x, z, h + bob + 20, 60, `rgba(255,210,120,${0.35 + 0.15 * Math.sin(this.rt * 4)})`);
    const spin = it.h > 0 || it.slide ? it.t * (it.kind === 'shell' ? 14 : 8) * (it.vx < 0 ? -1 : 1) : 0;
    this.spr(n, x, z, h + bob, { rot: spin, alpha: it.kind === 'shell' && it.t > 5 ? Math.max(0, (6 - it.t) * 2) : 1 });
    if (it.kind === 'barrel' && it.sid) this.glint(x, z, h + 50, '#ffd27a', this.rt + it.id);
  }
  private drawProp(pr: Prop) {
    const flash = pr.flash;
    switch (pr.kind) {
      case 'barrel':
        this.shadow(pr.x, pr.z, 34, 0); this.spr(pr.content === 'charm' || this.area3 ? 'tarbarrel' : 'barrel', pr.x, pr.z, 0, { flash });
        if (pr.content === 'charm') this.glint(pr.x, pr.z, 50, '#ffd27a', this.rt + pr.id);
        break;
      case 'crate': this.shadow(pr.x, pr.z, 36, 0); this.spr(pr.hp < 2 ? 'crate-cracked' : 'crate', pr.x, pr.z, 0, { flash }); if (pr.content === 'charm') this.glint(pr.x, pr.z, 40, '#ffd27a', this.rt + pr.id); break;
      case 'fishcrate': this.shadow(pr.x, pr.z, 34, 0); this.spr('fishcrate', pr.x, pr.z, 0, { flash }); break;
      case 'ice': this.shadow(pr.x, pr.z, 40, 0); this.spr('ice', pr.x, pr.z, 0, { flash }); this.glint(pr.x + 10, pr.z, 44, '#dfe6ef', this.rt * 0.7 + pr.id); break;
      case 'net':
        if (pr.down) { this.spr('net-down', pr.x, pr.z, 0); break; }
        { const k = pr.fall > 0 ? Math.min(1, pr.fall / 0.35) : 0, h = 170 * (1 - k * k);
          this.shadow(pr.x, pr.z, 50 * (0.4 + 0.6 * k), 0);
          this.spr('net-hang', pr.x, pr.z, h, { flash });
          if (!k) this.glint(pr.x, pr.z, h + 60, '#fff0c8', this.rt + pr.id); }
        break;
    }
  }
  private drawBoss(b: Boss, g: BrineGame) {
    const pose = this.bossPose(b), o: Parameters<BrineScene['spr']>[4] = { flip: b.face > 0, flash: b.flash, flashMax: 0.32 };
    if (b.st === 'tell' || b.st === 'wingtell' || b.st === 'rock') o.ox = Math.sin(b.t * 40) * 1.5;
    if (b.st === 'ripping' || b.st === 'pinned') o.ox = Math.sin(b.t * 70) * 3;
    if (b.st === 'intro') o.alpha = Math.min(1, b.t * 2);
    const hole = b.kind === 'tanglejaw' ? g.holes[b.hole] : null;
    // Longshanks' painting stands on its own stilts, so it's drawn on the boards whatever his body height
    const dh = b.kind === 'longshanks' || b.kind === 'tanglejaw' ? 0 : b.h;
    let bx = b.x;
    if (hole) { bx = hole.x; if (STRETCHED.has(pose)) bx = hole.x + b.dir * (FRAMES[pose][3] / PX / 2 - 50); }
    if (b.st === 'heave') o.ox = Math.sin(b.t * 70) * 3;
    if (b.kind !== 'tanglejaw') this.shadow(b.x, b.z, b.kind === 'brute' || b.kind === 'clamps' || b.kind === 'longshanks' ? 120 : 80, dh);
    const vulnerable = (b.kind === 'clamps' && (b.st === 'dizzy' || b.st === 'bare' || b.st === 'juggle')) || (b.kind === 'admiral' && (b.st === 'grounded' || b.st === 'pinned')) || (b.kind === 'knuckles' && (b.st === 'dizzy' || b.st === 'hop')) || (b.kind === 'brute' && b.st === 'dizzy')
      || (b.kind === 'longshanks' && b.st === 'toppled') || (b.kind === 'tanglejaw' && b.st === 'stretched' && g.plugs() >= 2);
    if (vulnerable) this.glow(b.x, b.z, dh + 90, 140, `rgba(255,200,90,${0.2 + 0.2 * Math.sin(this.rt * 10)})`);
    if (b.kind === 'tanglejaw' && b.st === 'bubble' && hole) { this.glow(hole.x, hole.z, 20, 90, `rgba(255,214,110,${0.35 + 0.3 * Math.sin(this.rt * 22)})`); this.bubbles(hole.x, hole.z, b.t); }
    if (b.kind === 'tanglejaw' && hole && pose && !STRETCHED.has(pose) && b.st !== 'end') this.drawHole(g, b.hole, true);
    if (pose) this.spr(pose, bx, b.z, dh, o);
    // whose job it is right now: a grey glint for Enzo, a cream glint for Dora
    if (b.st !== 'end' && b.st !== 'intro') {
      const need = this.bossNeeds(b, g);
      if (need) this.glint(b.x, b.z, dh + 150, need === 'enzo' ? '#dfe6ef' : '#fff0c8', this.rt * 2);
    }
    if (b.st === 'dizzy') this.stars(b.x, b.z, b.h + 190);
    if (b.kind === 'longshanks' && b.st === 'toppled' && b.t > 0.35) this.stars(b.x, b.z, 130);
    if (b.kind === 'tanglejaw' && b.st === 'stretched' && g.plugs() >= 2) this.stars(b.x, b.z, 100);
  }
  /** one of Tanglejaw's drain holes: open (and glowing while he's bubbling in it) or jammed with a barrel */
  private drawHole(g: BrineGame, i: number, under = false) {
    const h = g.holes[i]; if (!h) return;
    if (h.plug) { this.spr('tanglejaw-plug', h.x, h.z, 0); this.glint(h.x, h.z, 80, '#dfe6ef', this.rt + i); return; }
    if (!under) this.spr('tanglejaw-hole', h.x, h.z, 0);
  }
  /** a few bubbles rising out of a hole, the tell before a lunge */
  private bubbles(x: number, z: number, t: number) {
    const cx = this.cx;
    cx.save(); cx.strokeStyle = 'rgba(220,245,255,.85)'; cx.lineWidth = 2 * this.s;
    for (let i = 0; i < 5; i++) {
      const k = (t * 1.6 + i / 5) % 1, bx = x + Math.sin(i * 2.3 + t * 3) * 22, bh = 10 + k * 70;
      cx.globalAlpha = 1 - k; cx.beginPath(); cx.arc(this.SX(bx), this.SY(FLOOR + z - bh), (3 + i % 3 * 2) * this.s, 0, 7); cx.stroke();
    }
    cx.restore();
  }
  /** octopus ink over part of the screen, fading in fast and out slowly */
  private drawInk(g: BrineGame) {
    if (!g.ink.length) return;
    const bottom = this.portrait ? this.playBottom : this.H, size = Math.min(this.W, bottom) * 0.62;
    for (const k of g.ink) {
      const a = Math.min(1, k.t / 0.15) * Math.min(1, (k.life - k.t) / 0.8) * 0.9;
      this.ui('octo-ink', k.x * this.W, k.y * bottom, size * k.r, Math.max(0, a));
    }
  }
  /** a hint for the glint only; the engine decides the damage */
  private bossNeeds(b: Boss, g: BrineGame): HeroId | null {
    if (b.kind === 'longshanks') return b.st === 'stomp' ? 'enzo' : 'dora';
    if (b.kind === 'tanglejaw') return g.plugs() < 2 ? 'enzo' : b.st === 'stretched' ? 'dora' : null;
    if (b.kind === 'brute') return b.armour > 0 ? 'enzo' : 'dora';
    if (b.kind === 'clamps') return b.st === 'dizzy' && b.layers > 0 ? 'enzo' : b.st === 'bare' || b.st === 'juggle' ? 'dora' : null;
    if (b.kind === 'knuckles') return b.st === 'guard' ? 'enzo' : b.st === 'hop' || b.st === 'tell' ? 'dora' : null;
    if (b.kind === 'admiral') return b.h > 40 ? 'dora' : b.st === 'grounded' ? 'enzo' : null;
    return null;
  }
  private drawTelegraphs(g: BrineGame) {
    const b = g.boss, cx = this.cx; if (!b || b.st === 'gone') return;
    const p = g.hero(), warm = '#ffc94a', hot = '#ff9a5a';
    cx.save(); cx.globalCompositeOperation = 'lighter';
    // every dangerous boss move marks the boards first: a dashed ring where it lands, or arrows along the lane it sweeps
    if (b.kind === 'admiral' && (b.st === 'shriek' || b.st === 'redive')) this.ringMark(b.tx || b.x, b.tz || b.z, 100, 40, warm);
    if (b.kind === 'brute' && b.st === 'tell') { this.ringMark(b.tx, b.tz, 115, 50, hot); this.glow(b.x, b.z, 120, 110, `rgba(255,120,80,${0.25 + 0.2 * Math.sin(this.rt * 25)})`); }
    if (b.kind === 'clamps' && b.st === 'wind') this.ringMark(b.x + b.face * 90, b.z, 90, 40, hot);
    if (b.kind === 'clamps' && b.st === 'rock') this.laneMark(b.x, b.z, p.x < b.x ? -1 : 1, warm);
    if (b.kind === 'knuckles' && b.st === 'tell') { this.ringMark(b.x + b.face * 80, b.z, 90, 34, hot); this.glow(b.x, b.z, 110, 90, `rgba(255,236,190,${0.35 + 0.3 * Math.sin(this.rt * 30)})`); }
    if (b.kind === 'knuckles' && b.st === 'crouch') this.ringMark(p.x, p.z, 100, 45, warm);
    if (b.kind === 'knuckles' && b.st === 'hop') this.ringMark(b.tx, b.tz, 100, 45, warm);
    if (b.kind === 'admiral' && b.st === 'wingtell') this.laneMark(b.x, b.tz, p.x < b.x ? -1 : 1, warm);
    for (const pr of g.props) if (pr.alive && pr.kind === 'net' && !pr.down && pr.fall !== 0) this.ringMark(pr.x, pr.z, 60, 26, warm);
    if (b.kind === 'longshanks' && b.st === 'stomptell') this.ringMark(b.tx, b.tz, 80, 34, hot);
    if (b.kind === 'longshanks' && b.st === 'sweepw') this.ringMark(b.x + b.dir * 135, b.z, 210, 75, warm);
    if (b.kind === 'tanglejaw') {
      const h = g.holes[b.hole];
      if (h && b.st === 'bubble') this.laneMark(h.x - b.dir * 40, h.z, b.dir, hot, 4);
      if (h && b.st === 'whipw') this.ringMark(h.x, h.z, 240, 80, warm);
    }
    cx.restore();
  }
  /** the foes' and the belt's tells, which don't need a boss: a barrel's lane, an eel's lunge, a cormorant's ring */
  private drawFoeTells(g: BrineGame) {
    const cx = this.cx, warm = '#ffc94a', hot = '#ff9a5a';
    cx.save(); cx.globalCompositeOperation = 'lighter';
    for (const c of g.rolls) if (c.t < c.tell) this.laneMark(g.camR + 40, LANE_Z[c.lane], -1, c.kind === 'cart' ? hot : warm, 10);
    for (const f of g.foes) {
      if (f.kind === 'eel' && inHole(f) && f.st === 'wind') this.laneMark(f.tx - f.face * 40, f.tz, f.face, hot, 2);
      if (f.kind === 'cormorant' && (f.st === 'wind' || f.st === 'dive')) this.ringMark(f.tx, f.tz, 62, 26, warm);
    }
    cx.restore();
  }
  /** a dashed ground ring, marching, where a hit will land */
  private ringMark(x: number, z: number, rx: number, rz: number, col: string) {
    const cx = this.cx, sx = this.SX(x), sy = this.SY(FLOOR + z);
    cx.setLineDash([14 * this.s, 10 * this.s]); cx.lineDashOffset = -this.rt * 60; cx.lineWidth = 3.5 * this.s; cx.strokeStyle = col;
    cx.globalAlpha = 0.75 + 0.25 * Math.sin(this.rt * 12);
    cx.beginPath(); cx.ellipse(sx, sy, rx * this.s, rz * this.s, 0, 0, 7); cx.stroke();
    cx.setLineDash([]); cx.globalAlpha = 1;
  }
  /** chevrons running along a lane from the boss toward the far wall, for a roll or a swoop */
  private laneMark(x: number, z: number, dir: number, col: string, n = 9) {
    const cx = this.cx, sy = this.SY(FLOOR + z), s = this.s, run = (this.rt * 1.6) % 1;
    cx.lineWidth = 5.5 * s; cx.strokeStyle = col; cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (let k = 0; k < n; k++) {
      const wx = x + dir * (70 + (k + run) * 90), sx = this.SX(wx);
      if (sx < -40 || sx > this.W + 40) continue;
      cx.globalAlpha = 0.85 * (1 - k / (n + 1));
      cx.beginPath(); cx.moveTo(sx - dir * 16 * s, sy - 16 * s); cx.lineTo(sx + dir * 10 * s, sy); cx.lineTo(sx - dir * 16 * s, sy + 16 * s); cx.stroke();
    }
    cx.globalAlpha = 1;
  }
  private drawFx(g: BrineGame, back: boolean) {
    const cx = this.cx;
    for (const e of this.fx) {
      if (!!e.back !== back) continue;
      const k = e.t / e.life, sx = this.SX(e.x), sy = this.SY(FLOOR + e.z - e.h);
      switch (e.k) {
        case 'p': cx.globalAlpha = 1 - k * k; cx.fillStyle = e.col; cx.beginPath(); cx.arc(sx, sy, e.size * this.s, 0, 7); cx.fill(); break;
        case 'dust': cx.globalAlpha = (1 - k) * 0.5; cx.fillStyle = e.col; cx.beginPath(); cx.arc(sx, sy, e.size * (0.6 + k) * this.s, 0, 7); cx.fill(); break;
        case 'burst': {
          cx.save(); cx.globalCompositeOperation = 'lighter'; cx.translate(sx, sy); cx.rotate(e.rot ?? 0);
          const R = (26 + 40 * k) * e.size * this.s; cx.globalAlpha = 1 - k; cx.fillStyle = e.col;
          cx.beginPath(); for (let j = 0; j < 16; j++) { const r = j % 2 ? R * 0.32 : R * (j % 4 ? 0.8 : 1.15), a = (j * Math.PI) / 8; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.fill();
          cx.globalAlpha = (1 - k) * 0.9; cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(0, 0, R * 0.3, 0, 7); cx.fill(); cx.restore();
          break;
        }
        case 'ring':
          cx.globalAlpha = (1 - k) * 0.8; cx.strokeStyle = e.col; cx.lineWidth = (5 - 4 * k) * this.s;
          cx.beginPath(); cx.ellipse(sx, this.SY(FLOOR + e.z), e.size * (0.3 + k) * this.s, e.size * (0.3 + k) * 0.3 * this.s, 0, 0, 7); cx.stroke(); break;
        case 'swipe': {
          cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = (1 - k) * 0.75; cx.strokeStyle = e.col; cx.lineCap = 'round';
          cx.lineWidth = (10 - 7 * k) * e.size * this.s; const R = 48 * e.size * this.s;
          cx.beginPath(); if (!e.flip) cx.arc(sx - R * 0.6, sy, R, -1.1 + k * 0.5, 0.9 + k * 0.3); else cx.arc(sx + R * 0.6, sy, R, Math.PI - 0.9 - k * 0.3, Math.PI + 1.1 - k * 0.5);
          cx.stroke(); cx.restore(); break;
        }
        case 'zap': {
          cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 1 - k; cx.strokeStyle = e.col; cx.lineWidth = 2.5 * this.s;
          cx.beginPath(); let x = sx, y = sy; cx.moveTo(x, y);
          for (let j = 0; j < 5; j++) { x += Math.cos(e.rot!) * e.size * 0.2 * this.s + (Math.random() - 0.5) * 14 * this.s; y += Math.sin(e.rot!) * e.size * 0.2 * this.s + (Math.random() - 0.5) * 14 * this.s; cx.lineTo(x, y); }
          cx.stroke(); cx.restore(); break;
        }
        case 'ghost': if (e.pose) this.spr(e.pose, e.x, e.z, e.h, { flip: e.flip, alpha: (1 - k) * 0.35 }); break;
        case 'chunk': if (e.pose) this.spr(e.pose, e.x, e.z, e.h, { sc: e.size, rot: e.t * (e.spin ?? 0), alpha: 1 - k * k }); break;
        case 'fest': cx.globalAlpha = 1 - k; cx.fillStyle = e.col; cx.beginPath(); cx.arc(sx, sy, e.size * this.s * (1 + Math.sin(e.t * 30) * 0.3), 0, 7); cx.fill(); break;
        case 'word': {
          const px = Math.round(24 * this.u * (k < 0.15 ? 0.7 + k * 2 : 1));
          cx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          this.text(e.text ?? '', sx, sy - k * 40 * this.s, px, e.col);
          break;
        }
        case 'tink': {
          // the wrong hero: a tink, and the right hero's face asks to be tagged in
          const a = k < 0.1 ? k * 10 : k > 0.75 ? (1 - k) / 0.25 : 1, r = 22 * this.u, yy = sy - k * 14 * this.s;
          cx.globalAlpha = a;
          this.face(e.want!, sx, yy, r, true, e.want === 'enzo' ? 'grey' : 'cream');
          this.text('TINK!', sx, yy - r * 1.6, Math.round(16 * this.u), '#dfe6ef');
          break;
        }
      }
      cx.globalAlpha = 1;
    }
    void g;
  }
  private drawFlies(g: BrineGame) {
    const cx = this.cx;
    for (const f of this.fx) {
      if (f.k !== 'fly') continue;
      const k = Math.min(1, f.t / f.life), e = k * k * (3 - 2 * k);
      const [tx, ty] = this.lanternTarget(g, f.si!, f.slot!);
      const x0 = f.x, y0 = FLOOR + f.z - f.h;
      const x = x0 + (tx - x0) * e, y = y0 + (ty - y0) * e - Math.sin(Math.PI * k) * 120;
      this.glow(x, 0, FLOOR - y - 10, 60, 'rgba(255,200,110,.55)');
      this.spr('lantern-lit', x, 0, FLOOR - y - 18);
      cx.globalAlpha = 1;
    }
  }
  private drawNight(g: BrineGame) {
    const lx = this.lx, w = this.light.width, h = this.light.height, k = w / this.W;
    lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, w, h);
    // sunset is lighter; under the fireworks every burst lifts the dark a little. The hero always gets a pool of light.
    const tod = this.tod(g), hour = tod === 'dusk' ? 0.45 : tod === 'fireworks' ? 1 - 0.3 * this.skyFlash : 1;
    const dark = (0.42 - 0.14 * this.litFrac(g) - (g.inSecret ? -0.06 : 0)) * hour;
    lx.fillStyle = `rgba(16,18,58,${dark})`; lx.fillRect(0, 0, w, h);
    lx.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a: number) => { const gr = lx.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = gr; lx.fillRect((x - r) * k, (y - r) * k, r * 2 * k, r * 2 * k); };
    g.strings.forEach((s, i) => { if (s.glow > 0.02) hole(this.SX(this.strX(g, i)), this.SY(250), 360 * this.s, Math.min(1, s.glow) * (0.85 + 0.15 * s.pulse)); });
    const p = g.hero(); hole(this.SX(p.x), this.SY(FLOOR + p.z - 80), 170 * this.s, 0.55);
    for (const f of this.fx) if (f.k === 'fly') hole(this.SX(f.x), this.SY(FLOOR + f.z - f.h), 120 * this.s, 0.5);
    this.cx.drawImage(this.light, 0, 0, this.W, this.portrait ? this.H : this.H);
    const cx = this.cx;
    cx.save(); cx.globalCompositeOperation = 'lighter';
    g.strings.forEach((s, i) => {
      if (s.glow <= 0.02) return;
      const sx = this.SX(this.strX(g, i)), sy = this.SY(205), R = 280 * this.s;
      const gr = cx.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, `rgba(255,170,80,${0.22 * s.glow + 0.25 * s.pulse})`); gr.addColorStop(1, 'rgba(255,140,60,0)');
      cx.fillStyle = gr; cx.fillRect(sx - R, sy - R, R * 2, R * 2);
    });
    cx.restore();
  }
  // ─────────────────────────────────────────── scene goals
  private drawThief(G: Goal) {
    if (G.x < this.viewL - 200 || G.x > this.viewL + this.vw + 200) return;
    const st = G.st, toward = st === 'swoopw' || st === 'swoop';
    const n = st === 'swoop' ? 'thief-swoop' : st === 'hit' ? 'thief-hit' : st === 'flee' ? 'thief-flee' : st === 'escape' && G.stT < 0.8 ? 'thief-taunt'
      : st === 'flee' || st === 'escape' ? 'thief-fly1' : Math.floor(this.rt * 7) % 2 ? 'thief-fly1' : 'thief-fly2';
    this.shadow(G.x, G.z, 34, G.h);
    if (!G.won) this.glow(G.x + (toward ? -20 : 20), G.z, G.h + 20, 70, 'rgba(255,190,90,.35)');
    this.spr(n, G.x, G.z, G.h, { flip: !toward && st !== 'hit', rot: st === 'hit' ? Math.sin(G.stT * 18) * 0.3 : 0 });
  }
  private drawStall(G: Goal, g: BrineGame) {
    const what = G.def.what === 'cart' ? 'fishcart' : 'stall';
    const k = G.hp <= 0 ? 3 : G.hp > 66 ? 0 : G.hp > 33 ? 1 : 2;
    this.shadow(G.x, G.z, 90, 0);
    this.spr(`${what}-${k}`, G.x, G.z, 0, { flash: G.flash, flashMax: 0.5 });
    if (k < 3 && !G.done) this.glow(G.x, G.z, 110, 120, 'rgba(255,190,90,.22)');
    // its health over it, and how long until help comes: a ring that empties
    if (G.done) return;
    const u = this.u, w = 110 * u, x = this.SX(G.x) - w / 2, y = this.SY(FLOOR + G.z - 175);
    this.bar(x, y, w, G.hp / G.max, G.hp > 35 ? ['#ffe08a', '#e8a23c'] : ['#ffb26a', '#e0603c']);
    const left = Math.max(0, 1 - G.t / (G.def.time ?? 45)), cx = this.cx, r = 11 * u, rx = x + w + r + 6 * u, ry = y + 9 * u;
    cx.fillStyle = 'rgba(42,26,54,.75)'; cx.beginPath(); cx.arc(rx, ry, r + 2 * u, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#ffe2a8'; cx.beginPath(); cx.moveTo(rx, ry); cx.arc(rx, ry, r, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); cx.closePath(); cx.fill();
    void g;
  }
  /** the tide: open water up to its edge, then the curling front, drawn over anything standing in it */
  private drawWater(g: BrineGame) {
    const G = g.goal; if (!G || G.kind !== 'tide' || G.front < this.viewL) return;
    const f = FRAMES['tide-water']; if (!f) return;
    const [ai, fx, fy, fw, fh] = f, im = this.atlas[ai], cx = this.cx;
    const x0 = this.viewL - 20, x1 = G.front - 30, top = FLOOR - 26, tile = 260, bottom = this.portrait ? this.playBottom : this.H;
    cx.save(); cx.globalAlpha = 0.92;
    for (let x = Math.floor(x0 / tile) * tile; x < x1; x += tile) {
      const w = Math.min(tile, x1 - x);
      cx.drawImage(im, fx, fy, fw * (w / tile), fh, this.SX(x), this.SY(top), w * this.s + 1, bottom - this.SY(top));
    }
    cx.restore();
    const n = ['tide-2', 'tide-3', 'tide-1', 'tide-3'][Math.floor(this.rt * 6) % 4], fr = FRAMES[n];
    if (fr) { const sc = 0.85, ww = (fr[3] / PX) * sc, ax = (fr[5] / PX) * sc; this.spr(n, G.front - ww + ax - 20, 4, 0, { sc, alpha: 0.9 }); }
  }
  private drawTide(g: BrineGame) {
    const G = g.goal; if (!G || G.kind !== 'tide' || G.front < this.viewL - 120) return;
    const n = ['tide-1', 'tide-2', 'tide-3', 'tide-2'][Math.floor(this.rt * 6) % 4], f = FRAMES[n]; if (!f) return;
    const sc = 1.25, w = (f[3] / PX) * sc, ax = (f[5] / PX) * sc;
    this.spr(n, G.front - w + ax + 10, DEPTH + 40, 0, { sc });
  }

  /** on a portrait phone the arena is wider than the view: an arrow at the edge for each foe out of sight */
  private drawEdgeArrows(g: BrineGame) {
    const cx = this.cx, u = this.u;
    const off = [...g.foes.filter((f) => f.st !== 'ko' && f.st !== 'held' && f.st !== 'enter').map((f) => ({ x: f.x, z: f.z, h: f.h, boss: false })), ...(g.boss && g.boss.st !== 'gone' && g.boss.st !== 'end' ? [{ x: g.boss.x, z: g.boss.z, h: g.boss.h, boss: true }] : [])];
    for (const f of off) {
      const sx = this.SX(f.x); if (sx > -10 && sx < this.W + 10) continue;
      const left = sx < 0, x = left ? 16 * u : this.W - 16 * u, y = clamp(this.SY(FLOOR + f.z - f.h - 40), 90 * u, this.playBottom - 20 * u);
      const r = (f.boss ? 14 : 10) * u * (1 + 0.12 * Math.sin(this.rt * 8));
      cx.fillStyle = f.boss ? '#ffb48a' : '#ffe2a8'; cx.strokeStyle = '#2a1a36'; cx.lineWidth = 3;
      cx.beginPath(); const d = left ? -1 : 1;
      cx.moveTo(x + d * r, y); cx.lineTo(x - d * r * 0.6, y - r); cx.lineTo(x - d * r * 0.6, y + r); cx.closePath(); cx.stroke(); cx.fill();
    }
  }

  // ─────────────────────────────────────────── HUD
  text(t: string, x: number, y: number, px: number, col = '#fff4dc', align: CanvasTextAlign = 'center', stroke = '#2a1a36') {
    const cx = this.cx;
    cx.font = `700 ${Math.round(px)}px Fredoka, "Trebuchet MS", system-ui, sans-serif`; cx.textAlign = align; cx.textBaseline = 'middle';
    cx.lineWidth = Math.max(3, px * 0.18); cx.strokeStyle = stroke; cx.lineJoin = 'round'; cx.strokeText(t, x, y);
    cx.fillStyle = col; cx.fillText(t, x, y);
  }
  face(who: string, x: number, y: number, r: number, active: boolean, pulse?: 'grey' | 'cream' | null) {
    const cx = this.cx, n = FRAMES[`${who}-face`] ? `${who}-face` : `face-${who}`, f = FRAMES[n]; if (!f) return;
    cx.save();
    if (pulse) { const c = pulse === 'grey' ? '220,230,245' : '255,236,190'; const gr = cx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.9); gr.addColorStop(0, `rgba(${c},${0.5 + 0.4 * Math.sin(this.rt * 9)})`); gr.addColorStop(1, `rgba(${c},0)`); cx.fillStyle = gr; cx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4); }
    cx.beginPath(); cx.arc(x, y, r * 0.83, 0, 7); cx.closePath(); cx.save(); cx.clip();
    cx.fillStyle = '#3b2f78'; cx.fillRect(x - r, y - r, r * 2, r * 2);
    const [ai, fx, fy, fw, fh] = f, w = r * 2.1, h = (w * fh) / fw;
    if (!active) cx.filter = 'saturate(.55) brightness(.8)';
    cx.drawImage(this.atlas[ai], fx, fy, fw, fh, x - w / 2, y - h * 0.42, w, h); cx.filter = 'none'; cx.restore();
    this.ui('ring', x, y, r * 2.5);
    cx.restore();
  }
  private bar(x: number, y: number, w: number, frac: number, col: [string, string], n: 'bar' | 'bossbar' = 'bar', ghost?: number) {
    const f = FRAMES[n]; if (!f) return 0;
    const IN = { bar: [0.075, 0.4, 0.85, 0.28], bossbar: [0.105, 0.38, 0.79, 0.19] }[n];
    const h = (w * f[4]) / f[3]; this.ui(n, x + w / 2, y + h / 2, w);
    const ix = x + w * IN[0], iw = w * IN[2], iy = y + h * IN[1], ih = h * IN[3], cx = this.cx;
    if (ghost !== undefined && ghost > frac) { cx.fillStyle = 'rgba(255,240,200,.75)'; cx.fillRect(ix, iy, iw * clamp(ghost, 0, 1), ih); }
    const gr = cx.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    cx.fillStyle = gr; cx.fillRect(ix, iy, iw * clamp(frac, 0, 1), ih);
    cx.fillStyle = 'rgba(255,255,255,.28)'; cx.fillRect(ix, iy + ih * 0.1, iw * clamp(frac, 0, 1), ih * 0.25);
    return h;
  }
  private drawHud(g: BrineGame, L: Labels) {
    const u = this.u, m = 12 * u, cx = this.cx;
    const p = g.hero(), pr = g.prompt;
    const R = 28 * u, top = m + R * 1.05, bw = (this.W < 520 ? 92 : 140) * u;
    // the two heroes: the one on the boards big, the partner small, each with a health bar
    const heroes: Hero[] = [g.dora, g.enzo];
    let x = m + R * 1.1, hpY = 0, hpH = 0;
    for (const h of heroes) {
      const act = h === p, r = act ? R : R * 0.78;
      const pulse = !act && pr?.who === 'partner' ? pr.tint ?? null : null;
      this.face(h.name, x, top, r, act, pulse);
      const hb = this.bar(x + r * 1.05, top - r * 0.62, act ? bw : bw * 0.8, h.hp / 100, h.hp > 35 ? ['#9be37a', '#4fae4a'] : ['#ffb26a', '#e0603c']);
      if (act) { hpY = top - r * 0.62; hpH = hb; }
      if (!act) {
        const ready = h.ready && h.hp > 0 && g.tagCD <= 0;
        this.text(ready ? `TAG ${L.mode === 'touch' ? '' : L.tag}`.trim() : '…', x + r * 1.05 + bw * 0.4, top - r * 0.62 + hb + 9 * u, Math.round(12 * u), ready ? '#fff0c8' : '#9a8fb5');
      }
      x += r * 1.05 + (act ? bw : bw * 0.8) + 22 * u + R;
    }
    // the Festival meter: fills with hits and tags; full, Attack + Jump together calls the double-team
    const fx0 = m + R * 2.15, fy = hpY + hpH * 0.6, fw = bw;
    const full = g.fest >= 100;
    const hb = this.bar(fx0, fy, fw, g.fest / 100, full ? ['#fff0a0', '#ffb347'] : ['#ffd27a', '#e58a3a']);
    cx.save(); if (full) cx.globalAlpha = 0.6 + 0.4 * Math.sin(this.rt * 8);
    this.text(full ? (L.mode === 'touch' ? 'FESTIVAL! ATTACK + JUMP' : `FESTIVAL! ${L.atk} + ${L.jmp}`) : 'FESTIVAL', fx0 + fw * 0.08, fy + hb * 0.95 + 4 * u, Math.round(11 * u), full ? '#fff0a0' : '#ffe2a8', 'left');
    cx.restore();
    // lanterns home in this scene, and the score
    let need = 0, got = 0; for (const s of g.strings) { need += s.need; got += s.got; }
    const rx = this.W - m - 30 * u - 50;
    this.ui('icon-lantern', rx, m + 22 * u, 22 * u);
    this.text(`${got}/${need}`, rx - 18 * u, m + 22 * u, Math.round(18 * u), '#ffe2a8', 'right');
    this.text(String(g.stats.score), rx + 12 * u, m + 52 * u, Math.round(15 * u), '#fff4dc', 'right');
    // combo and tag chain
    if (g.combo.n >= 3 && g.combo.t > 0) {
      const cy = (this.portrait ? 120 : 130) * u;
      this.text(`${g.combo.n} HITS`, this.W - m, cy, Math.round(22 * u), '#fff4dc', 'right');
      if (g.combo.chain > 0) this.text(`TAG CHAIN ×${g.combo.chain + 1}`, this.W - m, cy + 24 * u, Math.round(15 * u), '#ffd27a', 'right');
    }
    // the boss bar
    const b = g.boss;
    if (b && b.st !== 'gone') {
      const w = Math.min(this.W * 0.7, 520 * u), bx = (this.W - w) / 2, by = (this.portrait ? this.playBottom - 46 * u : this.H - 70 * u - (this.touch ? 0 : 0));
      const byy = this.touch && !this.portrait ? 74 * u + m : by;
      this.text(BOSS_NAME[b.kind], this.W / 2, byy - 6 * u, Math.round(16 * u), '#ffd9c0');
      this.bar(bx, byy, w, b.hp / b.max, ['#ff9a6a', '#d0482e'], 'bossbar', b.ghost / b.max);
    }
    this.drawGoalHud(g);
    if (g.lock === null && g.go > 0 && Math.floor(this.rt * 3) % 2 === 0) {
      const gx = this.W - 70 * u, gy = (this.portrait ? this.playBottom * 0.55 : this.H * 0.42);
      this.ui('go', gx, gy, 90 * u);
    }
  }
  /** a wordless track for the scene goal, where the boss bar would be: the thief getting away, the tide behind you,
   *  or the boarders still to come */
  private drawGoalHud(g: BrineGame) {
    const G = g.goal; if (!G || G.done || G.kind === 'defend') return;
    const u = this.u, m = 12 * u, top = this.touch && !this.portrait, w = top ? Math.min(this.W * 0.34, 280 * u) : Math.min(this.W * 0.6, 420 * u), bx = (this.W - w) / 2;
    const bh = w * 0.38, by = this.touch && !this.portrait ? 74 * u + m - bh * 0.3 : (this.portrait ? this.playBottom : this.H) - bh * 0.62 - 6 * u;
    const cx = this.cx;
    if (G.kind === 'chase') {
      const start = Math.max(this.vw / 2, 430), end = Math.max(start + 1, g.len - VIEW_W / 2);
      const left = G.won ? 1 : 1 - clamp((g.cam - start) / (end - start), 0, 1);
      const h = this.bar(bx, by, w, left, G.won ? ['#fff0a0', '#ffb347'] : ['#bfe8ff', '#5aa0d8'], 'bossbar');
      this.ui(G.won ? 'icon-lantern' : 'thief-fly1', bx - 10 * u, by + h / 2, (G.won ? 26 : 46) * u);
    } else if (G.kind === 'tide') {
      const p = g.hero(), h = this.bar(bx, by, w, clamp(G.front / g.len, 0, 1), ['#9fd8ff', '#2f7fb8'], 'bossbar');
      const ix = bx + w * 0.105 + w * 0.79 * clamp(p.x / g.len, 0, 1);
      this.face(p.name, ix, by + h * 0.45, 13 * u, true, null);
      this.ui('icon-lantern', bx + w + 14 * u, by + h / 2, 24 * u);
    } else if (G.kind === 'ride') {
      const total = G.def.groups.length, left = total - G.group + g.foes.filter((f) => f.st !== 'ko').length / 3;
      const h = this.bar(bx, by, w, clamp(left / total, 0, 1), ['#ffb26a', '#d0603c'], 'bossbar');
      this.ui('icon-lantern', bx + w + 14 * u, by + h / 2, 24 * u);
    }
    void cx;
  }
  private keyLabel(act: string, L: Labels): string {
    const t = L.mode === 'touch';
    switch (act) {
      case 'atk': return t ? 'ATTACK' : L.atk;
      case 'jmp': return t ? 'JUMP' : L.jmp;
      case 'tag': return t ? 'TAG' : L.tag;
      case 'dbl': return t ? 'ATTACK + JUMP' : `${L.atk} + ${L.jmp}`;
      default: return '';
    }
  }
  private drawPrompt(g: BrineGame, L: Labels) {
    const pr = g.prompt; if (!pr) return;
    const u = this.u, cx = this.cx, p = g.hero();
    const bob = Math.sin(this.rt * 6) * 5 * u;
    let wx = p.x, wz = p.z, wh = p.h + HC[p.name].H + 34;
    if (pr.who === 'foe' || pr.who === 'boss') { wx = pr.x ?? wx; wz = pr.z ?? wz; wh = pr.h ?? wh; }
    let x = clamp(this.SX(wx), 70 * u, this.W - 70 * u), y = Math.max(this.SY(FLOOR + wz - wh) + bob, 100 * u);
    if (pr.who === 'partner') { x = this.W / 2; y = (this.portrait ? 120 : 110) * u; }
    let label = this.keyLabel(pr.act, L), sub = '';
    if (pr.act === 'move') {
      const d = pr.dir ?? 1;
      label = L.mode === 'touch' ? 'MOVE' : Math.abs(d) === 2 ? (d > 0 ? L.down : L.up) : `${L.left} ${L.right}`;
      sub = Math.abs(d) === 2 ? 'line up with them' : '';
    }
    if (pr.act === 'grab') {
      const d = pr.dir ?? 1;
      label = L.mode === 'touch' ? (d > 0 ? '→' : '←') : d > 0 ? L.right : L.left;
      sub = 'walk in to grab';
    }
    if (pr.act === 'plug') {
      const d = pr.dir ?? 1;
      label = L.mode === 'touch' ? (d > 0 ? '→' : '←') : d > 0 ? L.right : L.left;
      sub = 'carry it onto the hole';
    }
    if (pr.act === 'tag') {
      const bk = g.boss && g.boss.st !== 'end' && g.boss.st !== 'gone' ? g.boss.kind : '';
      sub = pr.tint === 'grey'
        ? bk === 'tanglejaw' ? 'Enzo’s job: barrels into the holes' : bk === 'longshanks' ? 'Enzo’s job: heave the stuck leg' : g.scene.belt ? 'Enzo’s job: shells, eels, barrels' : 'Enzo’s job: shells, armour, pinning'
        : bk === 'tanglejaw' ? 'Dora’s job: kick him while he’s stuck' : bk === 'longshanks' ? 'Dora’s job: kick him while he’s down' : 'Dora’s job: wings and the air';
    }
    if (pr.act === 'dbl') sub = 'Festival full: double-team!';
    if (pr.act === 'special') {
      const d = (pr.dir ?? 1) > 0 ? L.right : L.left;
      label = L.mode === 'touch' ? `flick ${d}${d}, JUMP, ATTACK` : L.mode === 'pad' ? `${d}${d} then ${L.jmp} then ${L.atk}` : `${d}${d} then ${L.jmp} then ${L.atk}`;
      sub = 'dash, jump, attack in the air';
      x = clamp(this.SX(p.x), 140 * u, this.W - 140 * u);
    }
    if (pr.act === 'go') { label = '→'; }
    if (!label) return;
    const px = Math.round(18 * u);
    cx.font = `700 ${px}px Fredoka, "Trebuchet MS", system-ui, sans-serif`;
    const tw = cx.measureText(label).width, w = Math.max(48 * u, tw + 30 * u), h = 44 * u;
    this.ui('keycap', x, y, w, 0.98, h);
    this.text(label, x, y - 2 * u, px, '#2a1a36', 'center', '#fff4dc');
    if (sub) this.text(sub, x, y + h * 0.75, Math.round(13 * u), '#fff0c8');
  }
  /** at the start of each boss phase, once: the face of the hero whose job it is, and the key to press (Tag if they're out) */
  private drawBossHint(g: BrineGame, L: Labels) {
    const h = g.bossHint, b = g.boss; if (!h || !b) return;
    const u = this.u, cx = this.cx, active = g.hero().name === h.who;
    const k = Math.min(1, (3.6 - h.t) / 0.25, h.t / 0.4), pop = 1 + 0.25 * Math.max(0, 1 - (3.6 - h.t) / 0.25);
    const bx = this.SX(b.x), by = this.SY(FLOOR + b.z - Math.max(b.h, 0) - 250);
    const x = clamp(bx, 90 * u, this.W - 90 * u), y = clamp(by, 120 * u, (this.portrait ? this.playBottom : this.H) - 150 * u);
    const key = active ? (h.act === 'carry' ? 'barrels → holes' : h.act === 'atk' ? this.keyLabel('atk', L) : this.keyLabel('jmp', L)) : this.keyLabel('tag', L);
    cx.save(); cx.globalAlpha = Math.max(0, k);
    const r = 30 * u * pop;
    this.face(h.who, x - 30 * u, y, r, true, h.who === 'enzo' ? 'grey' : 'cream');
    cx.font = `700 ${Math.round(16 * u)}px Fredoka, "Trebuchet MS", system-ui, sans-serif`;
    const w = Math.max(44 * u, cx.measureText(key).width + 26 * u);
    this.ui('keycap', x + 14 * u + w / 2, y + 4 * u, w, 0.98, 40 * u);
    this.text(key, x + 14 * u + w / 2, y + 2 * u, Math.round(16 * u), '#2a1a36', 'center', '#fff4dc');
    // a small pointer down at the boss
    cx.fillStyle = '#ffd27a'; cx.beginPath(); cx.moveTo(x - 8 * u, y + 34 * u); cx.lineTo(x + 8 * u, y + 34 * u); cx.lineTo(x, y + 46 * u); cx.fill();
    cx.restore();
  }
  private drawTalk(g: BrineGame) {
    const t = g.talk; if (!t) return;
    const u = this.u, cx = this.cx, w = Math.min(this.W - 24 * u, 560 * u), x = (this.W - w) / 2;
    const y = this.portrait ? 74 * u : 86 * u, h = 64 * u;
    cx.fillStyle = 'rgba(42,26,54,.82)'; cx.strokeStyle = '#ffd27a'; cx.lineWidth = 2;
    cx.beginPath(); cx.roundRect(x, y, w, h, 14 * u); cx.fill(); cx.stroke();
    this.face(t.who, x + 34 * u, y + h / 2, 26 * u, true);
    cx.font = `600 ${Math.round(15 * u)}px Fredoka, "Trebuchet MS", system-ui, sans-serif`; cx.fillStyle = '#fff4dc'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    const words = t.line.split(' '), lines: string[] = []; let cur = '';
    const maxW = w - 80 * u;
    for (const wd of words) { const tryL = cur ? cur + ' ' + wd : wd; if (cx.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = tryL; }
    if (cur) lines.push(cur);
    lines.slice(0, 3).forEach((l, i, a) => cx.fillText(l, x + 68 * u, y + h / 2 + (i - (a.length - 1) / 2) * 17 * u));
  }
  private drawPanel(g: BrineGame, L: Labels) {
    // the control panel under the play view on a portrait phone: a dark painted plank colour, no stand-in art
    const cx = this.cx, top = this.playBottom;
    const gr = cx.createLinearGradient(0, top, 0, this.H); gr.addColorStop(0, '#2a1a36'); gr.addColorStop(1, '#1d1b4a');
    cx.fillStyle = gr; cx.fillRect(0, top, this.W, this.H - top);
    cx.fillStyle = 'rgba(255,210,122,.35)'; cx.fillRect(0, top, this.W, 2);
    void g; void L;
  }
  // ─────────────────────────────────────────── the festival breathers (screen space, no world)
  festPops: { x: number; y: number; text: string; col: string; t: number }[] = [];
  /** where the whack pots stand on screen, left to right (Attack, Jump, Tag), for drawing and for tapping */
  festPots(): { x: number; y: number; w: number }[] {
    const ph = this.portrait ? this.playBottom : this.H, w = Math.min(this.W * 0.24, 210 * this.u);
    return [0.22, 0.5, 0.78].map((k) => ({ x: this.W * k, y: Math.min(ph * 0.8, ph - 78 * this.u), w }));
  }
  /** a tap on a pot presses that pot's button */
  festHit(x: number, y: number): 'atk' | 'jmp' | 'tag' | null {
    const keys = ['atk', 'jmp', 'tag'] as const;
    let out: 'atk' | 'jmp' | 'tag' | null = null;
    this.festPots().forEach((p, i) => { if (Math.abs(x - p.x) < p.w * 0.6 && y > p.y - p.w * 1.1 && y < p.y + p.w * 0.5) out = keys[i]; });
    return out;
  }
  private uiAt(n: string, x: number, bottom: number, h: number, o: { flip?: boolean; alpha?: number; rot?: number } = {}) {
    const f = this.fr(n); if (!f) return 0;
    const [ai, fx, fy, fw, fh] = f, w = (h * fw) / fh, cx = this.cx;
    cx.save(); cx.translate(x, bottom); if (o.rot) { cx.translate(0, -h / 2); cx.rotate(o.rot); cx.translate(0, h / 2); }
    if (o.flip) cx.scale(-1, 1); if (o.alpha !== undefined) cx.globalAlpha = o.alpha;
    cx.drawImage(this.atlas[ai], fx, fy, fw, fh, -w / 2, -h, w, h); cx.restore();
    return w;
  }
  drawFest(F: FestGame, dt: number, L: Labels) {
    if (!this.ready) return;
    const cx = this.cx, u = this.u, W = this.W, ph = this.portrait ? this.playBottom : this.H;
    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.fillStyle = '#1d1b4a'; cx.fillRect(0, 0, W, this.H);
    // the painting: covers the play area, but never crops more than a sliver off the sides
    const im = this.img['fest-' + F.kind];
    let r = { x: 0, y: 0, w: W, h: ph };
    if (im) {
      // (an upright phone crops the sides instead: the pots, hook and shelf are placed on the screen, not the painting)
      const cover = Math.max(W / im.width, ph / im.height), k = this.portrait ? cover : Math.min(cover, W / (im.width * 0.86)), w = im.width * k, h = im.height * k;
      r = { x: (W - w) / 2, y: Math.min(0, (ph - h) / 2) + Math.max(0, ph - h), w, h };
      if (h < ph) r.y = ph - h;
      cx.drawImage(im, r.x, r.y, w, h);
    }
    const t = F.t;
    if (F.kind === 'whack') {
      const pots = this.festPots(), keys = [L.atk, L.jmp, L.tag], btn = ['btn-atk', 'btn-jump', 'btn-tag'];
      pots.forEach((p, i) => {
        const P = F.pots[i], potH = p.w * 0.62, top = p.y - potH * 0.82;
        // the crab rises out of the pot's mouth, behind its rim
        if (P.st !== 'down') {
          const n = P.st === 'bonk' ? (P.gold ? 'gcrab-bonk' : 'fcrab-bonk') : P.st === 'peek' ? 'fcrab-peek' : P.gold ? 'gcrab-up' : 'fcrab-up';
          const k = P.st === 'peek' ? Math.min(1, P.t / 0.22) * 0.6 : P.st === 'hide' ? 1 - P.t / 0.15 : P.st === 'bonk' ? 1 - Math.max(0, P.t - 0.2) / 0.25 : 1;
          const ch = p.w * (P.st === 'peek' ? 0.42 : P.st === 'bonk' ? 0.5 : 0.78);
          this.uiAt(n, p.x, top + ch * (0.55 - 0.5 * k) + potH * 0.15, ch);
          if (P.gold && P.st === 'up') this.glowAt(p.x, top - ch * 0.3, p.w * 0.7, 'rgba(255,220,90,.35)');
        }
        this.uiAt('fest-pot', p.x, p.y, potH);
        // the pot's button under it
        const pr = F.dora.pot === i && F.dora.t < 0.15;
        this.ui(btn[i], p.x, p.y + 30 * u + (pr ? 3 : 0), 46 * u * (pr ? 0.92 : 1));
        if (L.mode !== 'touch') this.text(keys[i], p.x, p.y + 62 * u, Math.round(15 * u), '#fff0c8');
      });
      // Dora hops to the pot she's bonking and kicks down into it
      const D = F.dora, p = pots[D.pot], hop = D.t < 0.25 ? Math.sin((D.t / 0.25) * Math.PI) * 30 * u : 0;
      const n = D.t < 0.22 ? (D.ok ? 'dora-k4' : 'dora-k1') : D.t < 0.5 ? 'dora-land' : 'dora-idle';
      this.uiAt(n, p.x - p.w * 0.55, p.y - hop, 150 * u * (this.portrait ? 0.75 : 1), { flip: true });
    } else if (F.kind === 'lanterns') {
      // the hook hangs from the rope in the middle of the painting
      const hx = r.x + r.w * 0.5, hy = r.y + r.h * 0.37, fl = F.flight();
      // the beat: a ring at the hook closes in as the next lantern arrives
      const next = F.lanterns.filter((l) => l.st === 'fly').sort((a, b) => a.arrive - b.arrive)[0];
      if (next) { const k = clamp((next.arrive - t) / fl, 0, 1); cx.strokeStyle = `rgba(255,226,140,${0.9 - k * 0.5})`; cx.lineWidth = 4 * u; cx.beginPath(); cx.arc(hx, hy + 34 * u, (26 + 70 * k) * u, 0, Math.PI * 2); cx.stroke(); }
      const lh = 64 * u;
      let hungN = 0;
      for (const l of F.lanterns) {
        if (l.st === 'fly') { const k = 1 - (l.arrive - t) / fl, x = -lh + (hx + lh) * k; this.uiAt('flantern-dark', x, hy + lh + 6 * u + Math.sin(k * 9) * 4 * u, lh); }
        else if (l.st === 'drop') { const x = hx + l.t * 60 * u; this.uiAt('flantern-dark', x, hy + lh + l.t * l.t * 500 * u, lh, { alpha: 1 - l.t, rot: l.t * 3 }); }
        else if (l.st === 'hung') {
          // hung lanterns walk off along the rope to the right, lit
          const x = hx + Math.min(l.t, 0.6) / 0.6 * (60 + (hungN % 6) * 0) * u + l.t * 90 * u; hungN++;
          if (x < W + lh) { this.glowAt(x, hy + lh * 0.6, lh * 1.3, `rgba(255,190,90,${l.grade === 2 ? 0.45 : 0.3})`); this.uiAt('flantern-lit', x, hy + lh + 6 * u, lh); }
        }
      }
      const P = F.pair, pn = P.st === 'hang' ? 'pair-hang' : P.st === 'cheer' ? 'pair-cheer' : P.st === 'oops' ? 'pair-oops' : 'pair-reach';
      // the pair stand under the hook, Dora's paws up at it
      this.uiAt(pn, hx - 34 * u, ph - 4 * u, Math.max(160 * u, ph - 4 * u - hy - 14 * u));
    } else {
      // the shelf runs across the painting at about half its height; the stacks stand on it
      const sy = r.y + r.h * 0.545, sx0 = Math.max(r.x + r.w * 0.2, W * 0.12), sw = Math.min(r.w * 0.6, W * 0.76), bh = Math.min(r.h * 0.17, 110 * u);
      for (const s of F.stacks) {
        const x = sx0 + s.x * sw;
        if (s.st === 'up') this.uiAt('bottles', x, sy, bh);
        else if (s.st === 'tumble') this.uiAt('bottles-tumble', x + s.t * 30 * u, sy - Math.sin(s.t * 6) * 10 * u, bh * 1.1, { rot: s.t });
        else this.uiAt('bottles-down', x, sy, bh * 0.5);
      }
      // the marker swings over the shelf
      const mx = sx0 + F.aim * sw;
      this.ui('ring', mx, sy - bh * 0.5, 70 * u, 0.8 + 0.2 * Math.sin(t * 10));
      // Enzo at the counter, bottom left, and his balls in flight
      const E = F.enzo, ex = W * (this.portrait ? 0.24 : 0.2), eh = Math.min(ph * 0.42, 260 * u);
      const en = E.st === 'windup' ? 'fenzo-windup' : E.st === 'toss' ? 'fenzo-toss' : E.st === 'cheer' ? 'fenzo-cheer' : 'fenzo-windup';
      this.uiAt(en, ex, ph + eh * 0.12, eh, { rot: E.st === 'idle' ? Math.sin(t * 3) * 0.02 : 0 });
      for (const b of F.balls) {
        const k = Math.min(1, b.t / 0.42), x0 = ex + eh * 0.25, y0 = ph - eh * 0.75, x1 = sx0 + b.x * sw, y1 = sy - bh * 0.5;
        const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 120 * u + (b.hit ? (b.t - 0.42) ** 2 * 1400 * u : 0);
        this.ui('fball', x, y, 26 * u * (1 - k * 0.4));
      }
    }
    // the time left, and the lanterns earned so far (one for playing, up to three)
    const bw = Math.min(W * 0.42, 220 * u), by = 8 * u;
    const bh = this.bar((W - bw) / 2, by, bw, 1 - t / F.dur, ['#ffe08a', '#e8a23c']);
    const rw = F.reward(), iy = by + bh * 0.82 + 14 * u;
    for (let i = 0; i < 3; i++) this.ui('icon-lantern', W / 2 - 30 * u + i * 30 * u, iy, 24 * u, i < rw ? 1 : 0.3);
    this.text(String(F.score), W / 2, iy + 28 * u, Math.round(18 * u), '#fff4dc');
    // the bonus pops
    for (const p of this.festPops) { p.t += dt; this.text(p.text, p.x, p.y - p.t * 60 * u, Math.round(24 * u), p.col); }
    this.festPops = this.festPops.filter((p) => p.t < 0.8);
    if (this.portrait) this.drawPanel(null as unknown as BrineGame, L);
    if (this.touch || this.portrait) this.drawTouch(null as unknown as BrineGame, L, true);
  }
  /** a festival bonus floating up from where it was won */
  festPop(F: FestGame, x: number, text: string, col: string) {
    const ph = this.portrait ? this.playBottom : this.H;
    let px = this.W / 2, py = ph * 0.5;
    if (F.kind === 'whack') { const p = this.festPots()[x]; px = p.x; py = p.y - p.w; }
    else if (F.kind === 'lanterns') { px = this.W * 0.5 + 60 * this.u; py = ph * 0.2; }
    else { px = this.W * (0.2 + 0.6 * x); py = ph * 0.4; }
    this.festPops.push({ x: px, y: py, text, col, t: 0 });
  }
  private glowAt(x: number, y: number, r: number, col: string) {
    const cx = this.cx, gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = gr; cx.fillRect(x - r, y - r, r * 2, r * 2); cx.restore();
  }
  private drawTouch(g: BrineGame, L: Labels, fest = false) {
    if (!this.touch && !this.portrait) return;
    if (!this.touch) {
      // an upright window played with keys or a pad: a key card in the panel instead of touch buttons
      const u = this.u, x = this.W / 2, y0 = this.playBottom + Math.min((this.H - this.playBottom) * 0.22, 70 * u), dy = 26 * u, f = Math.round(14 * u);
      const rows = fest ? [`${L.atk}    ${L.jmp}    ${L.tag}`] : [
        `Move  ${L.left} ${L.right} ${L.up} ${L.down}`, `Attack  ${L.atk}    Jump  ${L.jmp}    Tag  ${L.tag}`,
        `Dash  ${L.right}${L.right}    Special  ${L.right}${L.right} then ${L.jmp} then ${L.atk}`, `Double-team  ${L.atk} + ${L.jmp} with the Festival full`,
      ];
      rows.forEach((r, i) => this.text(r, x, y0 + i * dy, f, i < 2 ? '#fff0c8' : '#b9a9d8'));
      return;
    }
    const T = this.tl, a = this.portrait ? 0.95 : 0.7;
    if (!fest) this.ui('stick-base', T.stick.x, T.stick.y, T.stick.r * 2, a * 0.85);
    if (!fest) this.ui('stick-knob', this.knob.on ? this.knob.x : T.stick.x, this.knob.on ? this.knob.y : T.stick.y, T.stick.r * 0.95, a);
    const btn = (n: string, b: Btn, key: string) => { const pr = (this.pressed[key] ?? 0) > 0; this.ui(n, b.x, b.y + (pr ? 3 : 0), b.r * 2 * (pr ? 0.94 : 1), a); };
    btn('btn-atk', T.atk, 'atk'); btn('btn-jump', T.jmp, 'jmp'); btn('btn-tag', T.tag, 'tag');
    const u = this.u;
    this.text('ATTACK', T.atk.x, T.atk.y + T.atk.r + 10 * u, Math.round(11 * u), '#fff0c8');
    this.text('JUMP', T.jmp.x, T.jmp.y + T.jmp.r + 10 * u, Math.round(11 * u), '#fff0c8');
    this.text('TAG', T.tag.x, T.tag.y - T.tag.r - 9 * u, Math.round(11 * u), '#fff0c8');
    if (this.portrait && !fest) this.text('flick twice to dash', T.stick.x, T.stick.y + T.stick.r + 14 * u, Math.round(11 * u), '#b9a9d8');
    void g; void L;
  }
}
