// Highburrow: the controller. Wires the engine to the map scene and the React UI: map gestures (pan, pinch, wheel,
// tap to select, tap twice to move), keyboard shortcuts, saving, turns, and which panel is open. The React page
// re-renders whenever `changed()` fires; every panel reads its state from here. Ported from the prototype's App class.
import { MapScene, hexCenter, WORLD_W, WORLD_H } from '@/lib/highburrow-scene';
import {
  Game, SAVE_KEY, villageAt, campAt, findPath, frostKnown, pathCost, maxMp, storeCap, GOODS, NEIGHBOURS,
  type Cmd, type Result, type ReportItem, type NeighbourId, type Src, type Good,
} from '@/lib/highburrow-game';
import { attention, advise, type Advice } from '@/lib/highburrow-advisor';
import { store, hideTip } from './dom';
import { tileText } from './hud';
import { Tutorial } from './tutorial';

export type Modal = '' | 'title' | 'village' | 'trade' | 'route' | 'summary' | 'decision' | 'end';

export class Highburrow {
  g!: Game; scene: MapScene; tut: Tutorial;
  sel: number | null = null; modal: Modal = 'title'; pending: [number, number] | null = null;
  advice: Advice | null = null; skip = new Set<string>(); askAdvice = false;
  report: ReportItem[] = [];
  toast: { msg: string; kind: string; n: number } = { msg: '', kind: '', n: 0 };
  /** the panels, kept with the same shape as the prototype (`village.open(id)`) so tests and tools can drive them */
  village = { id: -1, picked: null as number | null, open: (id: number) => this.openVillage(id), close: () => this.closeModal() };
  trade = { n: 'herders' as NeighbourId, src: null as Src | null, happyT: 0, open: (n: NeighbourId) => this.openTrade(n), close: () => this.closeModal() };
  route = { unit: 0, a: null as number | null, b: null as number | null, carry: new Set<Good>(), open: (u: number) => this.openRoute(u), close: () => this.closeModal() };
  private last = performance.now(); private nextIdx = 0; private raf = 0; private toastT = 0; private off: (() => void)[] = [];
  constructor(public cv: HTMLCanvasElement, public mini: HTMLCanvasElement, private changed: () => void) {
    this.scene = new MapScene(cv);
    this.tut = new Tutorial(this);
    this.input(); this.keys();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  destroy() { cancelAnimationFrame(this.raf); clearTimeout(this.toastT); for (const f of this.off) f(); this.off = []; }
  start(g: Game) {
    this.g = g; this.sel = null; this.skip.clear();
    const d = g.s.units.find(u => u.kind === 'dora')!;
    this.scene.centerOn(d.q, d.r, innerWidth < 700 ? 0.8 : 1.05);
    this.select(d.id, false);
    this.refresh(); this.tut.check();
    const w = window as unknown as Record<string, unknown>;
    w.__highburrow = () => ({ ...this.g.s, pop: this.g.pop(), goal: this.g.goal(), modal: this.modal, selected: this.sel, tutorial: this.tut.step, advice: this.advice?.text });
    w.__hb = this; w.__hbHex = hexCenter; w.__hbLib = { Game, advise, frostKnown };
  }
  newGame(assist: boolean) {
    store(SAVE_KEY, ''); const seed = (Date.now() % 100000) + 1;
    this.modal = '';
    const g = new Game(seed, assist); this.tut.reset(); this.start(g); this.save();
  }
  save() { store(SAVE_KEY, this.g.save()); }
  say(msg: string, kind = '') {
    if (!msg) return;
    this.toast = { msg, kind, n: this.toast.n + 1 }; clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => { this.toast = { ...this.toast, msg: '' }; this.changed(); }, 2600);
    this.changed();
  }
  /** apply a command, animate what it did, save, refresh */
  act(c: Cmd): Result {
    const before = c.k === 'move' || c.k === 'explore' ? this.g.unit(c.unit) : null;
    const from: [number, number] | null = before ? [before.q, before.r] : null;
    const r = this.g.apply(c);
    if (!r.ok) { this.say(r.msg, 'bad'); this.refresh(); return r; }
    if (from && r.steps && 'unit' in c) this.scene.animate(c.unit, from, r.steps);
    if (c.k === 'explore') this.scene.act(c.unit, 'explore', 0.9 + (r.steps?.length ?? 0) * 0.2);
    if (c.k === 'befriend') { this.scene.act(c.unit, 'befriend', 1.8); const u = this.g.unit(c.unit)!; const p = hexCenter(u.q, u.r); this.scene.fx.push({ x: p.x, y: p.y - 40, t: 0, kind: 'heart' }); this.say(r.msg, 'good'); }
    if (c.k === 'found') { this.scene.act(c.unit, 'found', 2); const u = this.g.unit(c.unit)!; const p = hexCenter(u.q, u.r); this.scene.fx.push({ x: p.x, y: p.y - 30, t: 0, kind: 'spark' }); this.say(r.msg, 'good'); }
    if (c.k === 'trail') { this.scene.act(c.unit, 'build', 1.6); this.say(r.msg); }
    if (c.k === 'trade' && 'caravan' in c.src) this.scene.act(c.src.caravan, 'trade', 1.6);
    if (c.k === 'load') this.scene.act(c.unit, 'trade', 1.2);
    if (c.k === 'learn' || c.k === 'deliver') this.say(r.msg, 'good');
    if (c.k === 'rest') this.selectNextIdle();
    if (c.k === 'join') { this.sel = null; this.say(r.msg, 'good'); }
    if (c.k === 'festival') { this.save(); this.modal = 'end'; this.refresh(); return r; }
    this.skip.clear(); this.pending = null; this.scene.pathPreview = [];
    this.save(); this.refresh(); this.tut.check(c);
    return r;
  }
  doAdvice() {
    const a = this.advice; if (!a) return;
    if (a.cmd.k === 'end') return this.endTurn();
    if ('unit' in a.cmd && a.cmd.unit != null) this.select(a.cmd.unit, false);
    const r = this.act(a.cmd);
    if (!r.ok) { this.skip.add(a.key); this.refresh(); }
  }
  /** a neighbour waiting on an answer gets it asked as soon as nothing else is open */
  ask() { if (this.g.s.decision && !this.modal) { this.modal = 'decision'; this.refresh(); } }
  closeModal() { this.modal = ''; this.village.picked = null; this.refresh(); }
  endTurn() {
    if (this.modal || this.scene.busy()) return;
    if (this.g.s.decision) return this.ask();
    hideTip();
    const s = this.g.s; const paths = new Map(s.units.map(u => [u.id, { from: [u.q, u.r] as [number, number], path: [...u.path] }]));
    const r = this.g.apply({ k: 'end' }); if (!r.ok) return;
    for (const u of s.units) { const p = paths.get(u.id); if (!p || !p.path.length) continue; const n = p.path.findIndex(([q, rr]) => q === u.q && rr === u.r); if (n >= 0) this.scene.animate(u.id, p.from, p.path.slice(0, n + 1)); }
    this.skip.clear(); this.askAdvice = false; this.save();
    if (s.over) { this.modal = 'end'; this.refresh(); return; }
    this.report = s.report; this.modal = 'summary'; this.refresh(); this.tut.check({ k: 'end' });
  }
  /** the summary's red button: answer a request, or jump to the next thing needing attention */
  summaryNext() { this.modal = ''; if (this.g.s.decision) return this.ask(); this.next(); this.refresh(); }
  summaryOk() { this.modal = ''; this.refresh(); this.ask(); }
  /** jump to the next thing needing attention */
  next() {
    const list = attention(this.g);
    if (!list.length) { this.say('Everything has orders. End the turn when ready.'); return; }
    const it = list[this.nextIdx++ % list.length];
    if (it.unit != null) { this.select(it.unit); this.say(it.text); }
    else if (it.v != null) this.openVillage(it.v);
  }
  select(id: number | null, center = true) {
    this.sel = id; this.pending = null; this.scene.pathPreview = []; this.scene.sel = id;
    const u = id != null ? this.g.unit(id) : null;
    if (u && center) { const p = hexCenter(u.q, u.r); const sp = this.scene.toScreen(p.x, p.y); const w = this.cv.clientWidth, h = this.cv.clientHeight; if (sp.x < 60 || sp.y < 80 || sp.x > w - 60 || sp.y > h - 160) this.scene.centerOn(u.q, u.r); }
    this.refresh();
  }
  selectNextIdle() {
    const idle = this.g.s.units.filter(u => u.mp > 0 && !u.rest && !u.path.length);
    this.select(idle[0]?.id ?? null, true);
  }
  refresh() { if (!this.g) return; this.updateAdvice(); this.changed(); }
  /** Enzo's current tip, and the ring it puts on the map */
  private updateAdvice() {
    const sc = this.scene; sc.hint = null;
    if (!this.g.s.assist && !this.askAdvice) { this.advice = null; return; }
    const a = this.advice = advise(this.g, { skip: this.skip });
    const f = a.focus;
    if (f?.unit != null) { const u = this.g.unit(f.unit); if (u) sc.hint = [f.q ?? u.q, f.r ?? u.r]; }
    else if (f?.v != null) { const v = this.g.village(f.v); if (v) sc.hint = [v.q, v.r]; }
    else if (f?.n) sc.hint = [NEIGHBOURS[f.n].q, NEIGHBOURS[f.n].r];
  }

  openVillage(id: number) { if (!this.g.village(id)) return; this.village.id = id; this.village.picked = null; this.modal = 'village'; this.refresh(); }
  openTrade(n: NeighbourId) {
    const srcs = this.g.sources(n);
    // a caravan standing at the camp is what the player brought: trade from it first
    this.trade.n = n; this.trade.src = srcs.find(x => 'caravan' in x) ?? srcs[0] ?? null;
    this.modal = 'trade'; this.refresh();
  }
  openRoute(unit: number) {
    const s = this.g.s, u = this.g.unit(unit); if (!u) return;
    const R = this.route; R.unit = unit;
    if (u.route) { R.a = u.route.a; R.b = u.route.b; R.carry = new Set(u.route.carry); }
    else {
      const here = s.villages.find(v => v.q === u.q && v.r === u.r) ?? s.villages[0];
      R.a = here.id; R.b = s.villages.find(v => v !== here)?.id ?? null;
      R.carry = new Set(GOODS.filter(g => here.store[g] >= storeCap(here, g) - 4).slice(0, 3));
      if (!R.carry.size) R.carry.add('quinoa');
    }
    this.modal = 'route'; this.refresh();
  }

  private frame(t: number) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (this.g) {
      this.scene.draw(this.g.s, dt, this.g.s.frost && frostKnown(this.g.s));
      this.scene.drawMini(this.mini, this.g.s);
      this.tut.place();
    }
    this.raf = requestAnimationFrame(x => this.frame(x));
  }
  miniClick(e: { clientX: number; clientY: number; currentTarget: HTMLElement }) {
    const r = e.currentTarget.getBoundingClientRect(), v = this.scene.view;
    v.x = (e.clientX - r.left) / r.width * WORLD_W - this.cv.clientWidth / 2 / v.z;
    v.y = (e.clientY - r.top) / r.height * WORLD_H - this.cv.clientHeight / 2 / v.z; this.scene.clamp();
  }
  /** a tap on the map: select a unit, open a village or camp, or (with a unit selected) plan then confirm a move */
  tap(sx: number, sy: number, direct = false) {
    if (!this.g || this.modal) return;
    const [q, r] = this.scene.hexAt(sx, sy); const s = this.g.s;
    if (q < 0 || r < 0 || q >= 18 || r >= 14) return;
    const sel = this.sel != null ? this.g.unit(this.sel) : null;
    const here = s.units.filter(u => u.q === q && u.r === r);
    const v = villageAt(s, q, r), camp = campAt(q, r);
    // banner hit: open the village
    if (v) { const p = hexCenter(v.q, v.r), w = this.scene.toWorld(sx, sy); if (w.y < p.y - 22 && Math.abs(w.x - p.x) < 70) return this.openVillage(v.id); }
    if (sel && (sel.q !== q || sel.r !== r) && !(here.length && !this.pending && !direct && !v && !camp)) {
      if (direct || (this.pending && this.pending[0] === q && this.pending[1] === r)) { this.act({ k: 'move', unit: sel.id, q, r }); return; }
      const p = findPath(s, [sel.q, sel.r], [q, r]);
      if (p) { this.pending = [q, r]; this.scene.pathPreview = p; const cost = pathCost(s, p), turns = cost <= sel.mp ? 1 : 1 + Math.ceil((cost - sel.mp) / maxMp(s, sel)); this.say(`Tap again to go (${turns <= 1 ? 'this turn' : `about ${turns} turns`})`); return; }
      if (camp && s.seen[q + r * 18]) return this.openTrade(camp);
      this.say('No way there yet.', 'bad'); return;
    }
    if (here.length) {
      const i = here.findIndex(u => u.id === this.sel);
      if (i >= 0 && i === here.length - 1 && v) { this.select(null, false); return this.openVillage(v.id); }
      this.select(here[(i + 1) % here.length].id, false); return;
    }
    if (v) return this.openVillage(v.id);
    if (camp && s.seen[q + r * 18]) return this.openTrade(camp);
    this.select(null, false);
    this.say(tileText(this, q, r).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  private listen<K extends keyof HTMLElementEventMap>(t: HTMLElement | Window, k: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) {
    t.addEventListener(k, f as EventListener, o); this.off.push(() => t.removeEventListener(k, f as EventListener, o));
  }
  private input() {
    const cv = this.cv; const pts = new Map<number, { x: number; y: number }>();
    let moved = 0, pinch = 0, start = { x: 0, y: 0 };
    this.listen(cv, 'pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; start = { x: e.clientX, y: e.clientY }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    this.listen(cv, 'pointermove', e => {
      const p = pts.get(e.pointerId);
      const rect = cv.getBoundingClientRect();
      if (!p) { if (e.pointerType === 'mouse') this.hover(e.clientX - rect.left, e.clientY - rect.top); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.scene.zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, d / pinch); pinch = d;
        this.scene.view.x -= dx / 2 / this.scene.view.z; this.scene.view.y -= dy / 2 / this.scene.view.z; moved = 99;
      } else {
        moved = Math.max(moved, Math.hypot(e.clientX - start.x, e.clientY - start.y));
        if (moved > 6) { this.scene.view.x -= dx / this.scene.view.z; this.scene.view.y -= dy / this.scene.view.z; this.scene.clamp(); }
      }
    });
    const up = (e: PointerEvent) => {
      const had = pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
      if (had && moved <= 6 && pts.size === 0) { const r = cv.getBoundingClientRect(); this.tap(e.clientX - r.left, e.clientY - r.top, e.button === 2); }
    };
    this.listen(cv, 'pointerup', up); this.listen(cv, 'pointercancel', e => { pts.delete(e.pointerId); pinch = 0; });
    this.listen(cv, 'contextmenu', e => e.preventDefault());
    this.listen(cv, 'wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.scene.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    this.listen(cv, 'pointerleave', () => { this.scene.hover = null; });
    this.listen(window, 'resize', () => this.refresh());
  }
  private hover(sx: number, sy: number) {
    const [q, r] = this.scene.hexAt(sx, sy);
    this.scene.hover = q >= 0 && r >= 0 && q < 18 && r < 14 ? [q, r] : null;
    const sel = this.sel != null ? this.g?.unit(this.sel) : null;
    if (sel && this.scene.hover && !this.pending && (sel.q !== q || sel.r !== r)) this.scene.pathPreview = findPath(this.g.s, [sel.q, sel.r], [q, r]) ?? [];
    else if (!this.pending) this.scene.pathPreview = [];
  }
  private keys() {
    this.listen(window, 'keydown', e => {
      if (!this.g || (e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (this.modal === 'village' || this.modal === 'trade' || this.modal === 'route' || this.modal === 'summary') this.closeModal(); else if (!this.modal) this.select(null, false); return; }
      if (this.modal) { if (this.modal === 'summary' && (k === 'enter' || k === ' ')) { e.preventDefault(); this.summaryNext(); } return; }
      const u = this.sel != null ? this.g.unit(this.sel) : null;
      const pan = 60 / this.scene.view.z, cx = this.cv.clientWidth / 2, cy = this.cv.clientHeight / 2;
      const map: Record<string, () => void> = {
        enter: () => this.endTurn(), ' ': () => this.endTurn(), n: () => this.next(), a: () => this.doAdvice(), h: () => { this.askAdvice = true; this.refresh(); },
        tab: () => { const us = this.g.s.units; const i = us.findIndex(x => x.id === this.sel); this.select(us[(i + 1) % us.length].id); },
        o: () => { if (u?.kind === 'caravan') this.openRoute(u.id); }, x: () => { if (u?.route) this.act({ k: 'unroute', unit: u.id }); },
        e: () => { if (u) this.act({ k: 'explore', unit: u.id }); }, b: () => { if (u) this.act({ k: 'befriend', unit: u.id }); }, r: () => { if (u) this.act({ k: 'rest', unit: u.id }); },
        f: () => { if (u) this.act({ k: 'found', unit: u.id }); }, t: () => { if (u) this.act({ k: 'trail', unit: u.id }); }, j: () => { if (u) this.act({ k: 'join', unit: u.id }); },
        v: () => { const v = u ? villageAt(this.g.s, u.q, u.r) : this.g.s.villages[0]; if (v) this.openVillage(v.id); },
        g: () => { if (!u) return; const n = (Object.keys(NEIGHBOURS) as NeighbourId[]).find(id => Math.abs(NEIGHBOURS[id].q - u.q) <= 1 && Math.abs(NEIGHBOURS[id].r - u.r) <= 1); if (n) this.openTrade(n); },
        arrowleft: () => { this.scene.view.x -= pan; }, arrowright: () => { this.scene.view.x += pan; }, arrowup: () => { this.scene.view.y -= pan; }, arrowdown: () => { this.scene.view.y += pan; },
        w: () => { this.scene.view.y -= pan; }, s: () => { this.scene.view.y += pan; }, d: () => { this.scene.view.x += pan; },
        '+': () => this.scene.zoomAt(cx, cy, 1.15), '=': () => this.scene.zoomAt(cx, cy, 1.15), '-': () => this.scene.zoomAt(cx, cy, 1 / 1.15),
      };
      const f = map[k]; if (f) { e.preventDefault(); f(); this.scene.clamp(); }
    });
  }
}
