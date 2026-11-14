// Jade Street: the running game. Owns the World (lib/jade-game.ts) and the Scene (lib/jade-scene.ts), runs the fixed
// 60 Hz step and the draw on requestAnimationFrame, turns keyboard, touch stick and buttons into the engine's Input,
// plays the world's events through the sound, and tells the React HUD when something it shows has changed (at most
// ten times a second, or at once when a panel, dialogue or failure opens). The world is never re-rendered by React.
// Test hooks live on window.__jade.
import { World, DT, NO_INPUT, type Input } from '@/lib/jade-game';
import { Scene, loadArt } from '@/lib/jade-scene';
import { city, T, districtAt } from '@/lib/jade-city';
import { dailyEvent, dayKey, openDistricts, type Save } from '@/lib/jade-save';
import { MISSION, MISSIONS } from '@/lib/jade-story';
import type { JadeSound } from './sound';

export type Toast = { id: number; msg: string; kind: string; t: number };
export class Play {
  w: World; scene: Scene; raf = 0; last = 0; acc = 0; paused = false; alive = true;
  keys = new Set<string>(); stick = { x: 0, y: 0, on: false }; touchSneak = false;
  pend = { dash: false, hop: false, act: false };
  fps = 60; frames = 0; fpsT = 0; fpsLog: number[] = [];
  toasts: Toast[] = []; tid = 1; ver = 0; notifyT = 0; lastKey = '';
  saveT = 0; ro: ResizeObserver | null = null;
  constructor(public cv: HTMLCanvasElement, public save: Save, public snd: JadeSound | null, public onChange: () => void, public persist: (s: Save) => void) {
    this.w = new World(save);
    this.w.event = dailyEvent(dayKey(new Date()));
    this.scene = new Scene(cv, city());
    this.scene.minimap.on = true;
    void loadArt().then(() => { this.scene.chunks.clear(); this.scene.map = null; });
    this.resize();
    const host = cv.parentElement;
    if (host && typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); }
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku); window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.vis);
    this.raf = requestAnimationFrame(this.frame);
    this.hooks();
  }
  destroy() {
    this.alive = false; cancelAnimationFrame(this.raf); this.ro?.disconnect();
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku); window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.vis);
    this.persist(this.w.s);
    const g = window as unknown as Record<string, unknown>; delete g.__jade;
  }
  resize() {
    const host = this.cv.parentElement; if (!host) return;
    const r = host.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
    this.scene.resize(w, h, dpr);
    const small = Math.min(w, h) < 520;
    const rad = small ? 46 : 64;
    this.scene.minimap.r = rad; this.scene.minimap.x = w - rad - (small ? 12 : 20); this.scene.minimap.y = rad + (small ? 64 : 76);
  }
  blur = () => { this.keys.clear(); };
  vis = () => { if (document.hidden) { this.persist(this.w.s); this.keys.clear(); } };
  /** keys the page handles itself (pause, map) return true */
  onKey: ((k: string) => boolean) | null = null;
  kd = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (this.onKey && this.onKey(k)) { e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    const w = this.w;
    if (w.talk && (k === ' ' || k === 'Enter' || k === 'e')) { this.advance(); return; }
    if (k === ' ') this.pend.dash = true;
    if (k === 'q' || k === 'c') this.pend.hop = true;
    if (k === 'e' || k === 'Enter') this.pend.act = true;
  };
  ku = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys.delete(k); };
  input(): Input {
    const k = this.keys; let mx = 0, my = 0;
    if (k.has('a') || k.has('ArrowLeft')) mx -= 1; if (k.has('d') || k.has('ArrowRight')) mx += 1;
    if (k.has('w') || k.has('ArrowUp')) my -= 1; if (k.has('s') || k.has('ArrowDown')) my += 1;
    const l = Math.hypot(mx, my); if (l > 0) { mx /= l; my /= l; }
    if (this.stick.on) { mx = this.stick.x; my = this.stick.y; }
    return { mx, my, sneak: k.has('Shift') || this.touchSneak, dash: this.pend.dash, hop: this.pend.hop, act: this.pend.act };
  }
  advance() { if (!this.w.talk) return; this.w.advanceTalk(); this.snd?.talk(this.w.talk?.i ?? 0); this.bump(); }
  press(b: 'dash' | 'hop' | 'act') { if (b === 'act' && this.w.talk) { this.advance(); return; } this.pend[b] = true; }
  bump() { this.ver++; this.onChange(); }

  frame = (now: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : DT; this.last = now;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = this.frames / this.fpsT; this.fpsLog.push(this.fps); if (this.fpsLog.length > 600) this.fpsLog.shift(); this.frames = 0; this.fpsT = 0; }
    const w = this.w;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 6) {
        const inp = this.input();
        w.step(inp, DT);
        this.pend.dash = this.pend.hop = this.pend.act = false;
        this.acc -= DT; n++;
      }
      if (n === 6) this.acc = 0;
    }
    const fx = w.drain();
    if (fx.length) this.events(fx);
    this.scene.draw(w, this.paused ? 0 : dt);
    // HUD refresh: at once on a modal change, else ~10 Hz
    const key = `${!!w.talk}|${w.talk?.i}|${w.ui?.kind}|${!!w.failed}|${w.banner?.text}|${w.near?.label}|${w.run?.i}|${w.run?.label}|${!!w.p.ride}|${w.p.roof}|${w.p.hide}`;
    this.notifyT -= dt;
    if (key !== this.lastKey || this.notifyT <= 0) { this.lastKey = key; this.notifyT = 0.1; this.bump(); }
    this.saveT += dt; if (this.saveT > 5) { this.saveT = 0; this.persist(w.s); }
    // music follows the action
    const chase = w.heat >= 1 || (w.run && ['chase', 'race', 'escort'].includes(w.run.cur?.t ?? ''));
    this.snd?.play(chase ? 'chase' : 'street');
    this.toasts = this.toasts.filter(t => (t.t -= dt) > 0);
  };
  events(fx: ReturnType<World['drain']>) {
    this.scene.consume(this.w, fx);
    this.snd?.fx(fx);
    for (const f of fx) {
      if (f.t === 'toast' && f.msg) this.toast(f.msg, f.kind ?? '');
      else if (f.t === 'trophy' && f.name) this.toast(`Trophy: ${f.name}`, 'gold');
      else if (f.t === 'caught') this.toast(f.msg ?? 'Caught! The wardens fined you and sent you to a safe house.', 'bad');
      else if (f.t === 'heat-up' && f.k) this.toast(f.k === 1 ? 'A warden spotted you! Break line of sight, hide, or swap jackets at a safe house.' : `${f.k} lanterns of heat!`, 'bad');
      if (f.t === 'mission-done' || f.t === 'district' || f.t === 'trophy') this.persist(this.w.s);
    }
  }
  toast(msg: string, kind = '') { this.toasts.push({ id: this.tid++, msg, kind, t: 3.2 }); if (this.toasts.length > 3) this.toasts.shift(); }

  // ── test hooks
  hooks() {
    const g = window as unknown as Record<string, unknown>;
    g.__jade = {
      play: this, world: () => this.w, save: () => this.w.s,
      fps: () => this.fps, fpsLog: () => this.fpsLog.slice(),
      state: () => { const w = this.w; return { x: w.p.x / T, y: w.p.y / T, ride: w.p.ride?.kind ?? null, roof: w.p.roof, hide: w.p.hide, cash: w.s.cash, heat: w.heat, run: w.run ? { id: w.run.m.id, step: w.run.i, t: w.run.cur?.t, label: w.run.label } : null, talk: !!w.talk, ui: w.ui?.kind ?? null, failed: w.failed?.reason ?? null, near: w.near ? { kind: w.near.kind, label: w.near.label } : null, open: [...w.open], done: w.s.done.slice(), anim: w.p.anim, paused: this.paused }; },
      teleport: (tx: number, ty: number) => { this.w.placePlayer(tx * T + T / 2, ty * T + T / 2); if (this.w.p.ride) { this.w.p.ride.b.x = this.w.p.b.x; this.w.p.ride.b.y = this.w.p.b.y; } },
      teleportTo: (place: string) => { const p = this.w.c.places[place]; if (p) this.w.placePlayer(p.x, p.y + T * 0.6); },
      /** mark every job before `id` done and stand next to its contact */
      jumpTo: (id: string) => { const i = MISSIONS.findIndex(m => m.id === id); this.w.s.done = MISSIONS.slice(0, Math.max(0, i)).map(m => m.id); this.w.quitJob(); this.w.open = new Set(openDistricts(this.w.s)); this.w.fieldCache.clear(); const pl = this.w.c.places[MISSION[id].at]; this.w.placePlayer(pl.x, pl.y + T * 0.8); this.scene.map = null; },
      step: (n = 60, inp?: Partial<Input>) => { for (let i = 0; i < n; i++) this.w.step({ ...NO_INPUT, ...inp }, DT); },
      heat: (n: number) => { this.w.heat = n; },
      cash: (n: number) => { this.w.s.cash = n; },
      district: (tx: number, ty: number) => districtAt(tx, ty),
    };
  }
}
