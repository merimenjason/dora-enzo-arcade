// Cloudpop: the play controller. Owns one Game and the Scene, runs the fixed-step loop at 1x/2x/3x with pause and
// auto-start, turns pointer and keys into commands (place, select, upgrade, sell, target, abilities), plays sounds
// and reports the run's end. The React HUD re-renders on `changed()` and reads everything from here.
import { Game, DT, type RunConfig } from '@/lib/cloudpop-game';
import { Scene, fitView, toWorld, toScreen, loadArt, type View } from '@/lib/cloudpop-scene';
import { TOWERS, TOWER } from '@/lib/cloudpop-towerdata';
import { TARGETS, type TowerId } from '@/lib/cloudpop-towers';
import { PUFFS } from '@/lib/cloudpop-puffs';
import { HEROES } from '@/lib/cloudpop-heroes';
import type { RunSummary } from '@/lib/cloudpop-meta';
import type { PopSound } from './sound';

export const ART = '/art/cloudpop/';

export class Play {
  g!: Game; scene: Scene; v: View = fitView(0, 0, 100, 100);
  sel: number | null = null; place: TowerId | 'hero' | null = null; px = 0; py = 0; placeOk = false; touchArmed = false;
  speed = 1; paused = false; ended = false; maxCash = 0; ready = false;
  toast = { msg: '', kind: '', n: 0 };
  private acc = 0; private last = 0; private raf = 0; private toastT = 0; private off: (() => void)[] = []; private renderT = 0;
  constructor(public cv: HTMLCanvasElement, private changed: () => void, public snd: PopSound, private onEnd: (r: RunSummary, g: Game) => void) {
    this.scene = new Scene(cv);
    this.input();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  destroy() { cancelAnimationFrame(this.raf); clearTimeout(this.toastT); for (const f of this.off) f(); this.off = []; }
  async start(cfg: RunConfig, opts: { auto: boolean; speed: number }) {
    this.g = new Game(cfg);
    this.g.auto = opts.auto; this.speed = opts.speed; this.paused = false; this.ended = false; this.sel = null; this.place = null; this.maxCash = this.g.cash;
    await loadArt(ART, ['map-' + cfg.map]);
    this.ready = true;
    const w = window as unknown as Record<string, unknown>;
    w.__cloudpop = () => this.state();
    w.__cp = this;
    this.snd.play('valley');
    this.changed();
  }
  state() {
    const g = this.g;
    return { round: g.round, last: g.lastRound, cash: Math.floor(g.cash), lives: g.lives, active: g.active, over: g.over, towers: g.towers.map(t => ({ id: t.id, def: t.def, x: t.x, y: t.y, tiers: [...t.tiers], target: t.target, pops: t.pops })), puffs: g.puffs.length, sel: this.sel, place: this.place, speed: this.speed, paused: this.paused, heroLvl: g.heroLvl, auto: g.auto, view: this.v };
  }
  say(msg: string, kind = '') {
    if (!msg) return;
    this.toast = { msg, kind, n: this.toast.n + 1 }; clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => { this.toast = { ...this.toast, msg: '' }; this.changed(); }, 2400);
    if (kind === 'bad') this.snd.bad();
    this.changed();
  }

  // ── layout: the HUD's space comes off the map's rectangle
  layout() {
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.scene.resize(w, h, dpr);
    const portrait = h > w * 1.15, phoneWide = h < 520 && w > h;
    const top = portrait ? 52 : phoneWide ? 40 : 58;
    const right = portrait ? 0 : phoneWide ? 236 : Math.min(330, Math.max(270, w * 0.24));
    const bottom = portrait ? Math.min(330, h * 0.38) : 0;
    this.v = fitView(4, top, w - right - 8, h - top - bottom - 4);
    this.scene.v = this.v;
  }

  // ── loop
  private frame(now: number) {
    this.raf = requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000); this.last = now;
    if (!this.g || !this.ready) return;
    this.layout();
    const g = this.g;
    if (!this.paused && g.over !== 'lost' && !(g.over === 'won' && !g.freeplay && !g.active)) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= DT && n++ < 12) { g.step(DT); this.acc -= DT; }
      if (this.acc > DT * 4) this.acc = 0;
    }
    this.maxCash = Math.max(this.maxCash, g.cash);
    for (const f of g.fx) {
      if (f.t === 'pop') this.snd.pop(f.kind, PUFFS[f.kind].boss === true);
      else if (f.t === 'clink') this.snd.clink();
      else if (f.t === 'leak') this.snd.leak();
      else if (f.t === 'level') { this.snd.level(); this.say(`${HEROES[g.cfg.hero!].name} reached level ${f.lvl}!`, 'good'); }
      else if (f.t === 'cash') this.snd.coins();
      else if (f.t === 'round') { this.snd.round(); this.snd.play(this.bossRound() ? 'boss' : 'valley'); }
      else if (f.t === 'ability') { if (f.id === 'secondwind') this.say('Second chance! The village rallies: half your lives back.', 'good'); }
    }
    this.scene.consume(g);
    this.scene.draw(g, { sel: this.sel, place: this.place, px: this.px, py: this.py, ok: this.placeOk }, dt);
    if (g.over && !this.ended && (g.over === 'lost' || !g.freeplay)) { this.ended = true; this.finish(); }
    this.renderT += dt;
    if (this.renderT > 0.12) { this.renderT = 0; this.changed(); }
  }
  bossRound() { return this.g.spawns.some(s => PUFFS[s.kind].boss); }
  finish() {
    const g = this.g;
    if (g.over === 'won') { this.snd.win(); this.scene.heroDo('win', 99); } else this.snd.lose();
    this.onEnd(this.summary(), g);
    this.changed();
  }
  summary(): RunSummary {
    const g = this.g;
    return {
      map: g.cfg.map, diff: g.cfg.diff, mode: g.cfg.mode, won: g.over === 'won' || (g.freeplay && g.round > g.lastRound), roundsWon: g.stats.roundsWon, round: g.round,
      livesLost: g.stats.livesLost, pops: g.stats.pops, bossPops: g.stats.bossPops, towerXp: g.stats.towerXp, maxTier: g.stats.maxTier, heroLvl: g.heroLvl,
      placed: Object.keys(g.stats.placed), abilities: g.stats.abilities, daily: g.cfg.daily, maxCash: this.maxCash, freeplayRound: g.freeplay ? g.round : 0,
    };
  }

  // ── commands (the HUD and the keys both call these)
  pick(def: TowerId | 'hero') {
    this.snd.start(); this.snd.click();
    if (this.place === def) { this.place = null; this.changed(); return; }
    const g = this.g;
    if (def === 'hero') { if (g.hero()) return this.say('Your hero is already out', 'bad'); }
    else if (!g.allowed(def)) return this.say('Not allowed in this run', 'bad');
    const cost = def === 'hero' ? g.heroPrice() : g.price(def);
    if (cost > g.cash) return this.say(`Not enough coins: ${def === 'hero' ? HEROES[g.cfg.hero!].name : TOWER[def].name} costs $${cost}`, 'bad');
    this.place = def; this.sel = null; this.touchArmed = false;
    const [cx, cy] = [768, 512]; this.px = cx; this.py = cy; this.placeOk = !g.placeReason(def, cx, cy);
    this.changed();
  }
  cancel() { this.place = null; this.sel = null; this.changed(); }
  tryPlace(x: number, y: number): boolean {
    const g = this.g, def = this.place; if (!def) return false;
    const r = g.place(def, x, y);
    if (typeof r === 'string') { this.say(r, 'bad'); return false; }
    this.snd.place();
    if (def === 'hero') this.scene.heroDo('land', 0.6);
    this.place = null; this.sel = r.id; this.changed();
    return true;
  }
  upgrade(path: number) {
    if (this.sel == null) return;
    const why = this.g.upgrade(this.sel, path);
    if (why) return this.say(why, 'bad');
    this.snd.upgrade();
    const t = this.g.towers.find(x => x.id === this.sel)!;
    const [sx, sy] = toScreen(this.v, t.x, t.y);
    this.scene.parts.push({ x: sx, y: sy - 40 * this.v.k, vx: 0, vy: 0, t: 0, T: 0.8, col: '#fff', s: 140 * this.v.k, kind: 'sprite', name: 'fx-level' });
    this.changed();
  }
  sell() {
    if (this.sel == null) return;
    const v = this.g.sell(this.sel); this.sel = null;
    this.snd.coins(); this.say(`Sold for $${v}`); this.changed();
  }
  cycleTarget(dir = 1) {
    const t = this.g.towers.find(x => x.id === this.sel); if (!t) return;
    const i = TARGETS.indexOf(t.target); this.g.setTarget(t.id, TARGETS[(i + dir + 4) % 4]); this.snd.click(); this.changed();
  }
  ability(id: number, i: number) {
    const why = this.g.useAbility(id, i);
    if (why) return this.say(why, 'bad');
    this.snd.ability(); this.changed();
  }
  go() {
    this.snd.start();
    const g = this.g;
    if (g.active) { this.speed = this.speed >= 3 ? 1 : this.speed + 1; this.changed(); return; }
    if (g.startRound()) this.paused = false;
    this.changed();
  }
  setSpeed(s: number) { this.speed = s; this.changed(); }
  togglePause() { this.paused = !this.paused; this.changed(); }
  toggleAuto() { this.g.auto = !this.g.auto; if (this.g.auto && !this.g.active) this.g.startRound(); this.changed(); }
  continueFreeplay() { this.g.continueFreeplay(); this.ended = false; this.changed(); }

  // ── pointer and keys
  private towerAt(x: number, y: number) {
    let best: number | null = null, bd = 1e9;
    for (const t of this.g.towers) {
      const r = (t.def === 'hero' ? 26 : TOWER[t.def].r) + 14;
      const d = Math.hypot(t.x - x, t.y - y - 18); if (d < r && d < bd) { bd = d; best = t.id; }
      if (t.s.patrol) { const d2 = Math.hypot(t.fx - x, t.fy - y); if (d2 < 40 && d2 < bd) { bd = d2; best = t.id; } }
    }
    return best;
  }
  private input() {
    const cv = this.cv;
    const rect = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return toWorld(this.v, e.clientX - r.left, e.clientY - r.top); };
    const move = (e: PointerEvent) => {
      if (!this.g || !this.place) return;
      if (e.pointerType !== 'mouse' && e.buttons === 0) return;
      const [x, y] = rect(e); this.px = x; this.py = y; this.placeOk = !this.g.placeReason(this.place, x, y); this.touchArmed = false;
    };
    const down = (e: PointerEvent) => {
      if (!this.g) return;
      this.snd.start();
      const [x, y] = rect(e);
      if (this.place) {
        if (e.pointerType === 'mouse') { this.px = x; this.py = y; this.tryPlace(x, y); return; }
        // touch: first tap shows the ghost and its range, a second tap on it builds
        if (this.touchArmed && Math.hypot(x - this.px, y - this.py) < 40) { this.tryPlace(this.px, this.py); this.touchArmed = false; return; }
        this.px = x; this.py = y; this.placeOk = !this.g.placeReason(this.place, x, y); this.touchArmed = true;
        if (!this.placeOk) this.say(this.g.placeReason(this.place, x, y), 'bad'); else this.say('Tap again to build here');
        this.changed(); return;
      }
      const id = this.towerAt(x, y);
      this.sel = id; if (id != null) this.snd.click();
      this.changed();
    };
    const key = (e: KeyboardEvent) => {
      if (!this.g || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); this.go(); }
      else if (k === 'Escape') this.cancel();
      else if (k === 'p' || k === 'P') this.togglePause();
      else if (k === 'h' || k === 'H') this.pick('hero');
      else if (k === 'a' || k === 'A') this.toggleAuto();
      else if (k === 'z' || k === 'Z') this.upgrade(0);
      else if (k === 'x' || k === 'X') this.upgrade(1);
      else if (k === 'c' || k === 'C') this.upgrade(2);
      else if (k === 't' || k === 'T' || k === 'Tab') { e.preventDefault(); this.cycleTarget(e.shiftKey ? -1 : 1); }
      else if (k === 'Backspace' || k === 'Delete') this.sell();
      else if (k === 'q' || k === 'Q') { const t = this.g.towers.find(x => x.id === this.sel); if (t) this.ability(t.id, 0); }
      else if (/^[0-9-]$/.test(k)) { const i = k === '0' ? 9 : k === '-' ? 10 : +k - 1; const t = TOWERS[i]; if (t) this.pick(t.id); }
    };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', down); window.addEventListener('keydown', key);
    this.off.push(() => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); });
  }
}
