// Jade Street: the running game. Owns the World (lib/jade-game.ts) and the Scene (lib/jade-scene.ts), runs the fixed
// 60 Hz step and the draw on requestAnimationFrame, turns keyboard, touch stick and buttons into the engine's Input,
// plays the world's events through the sound, and tells the React HUD when something it shows has changed (at most
// ten times a second, or at once when a panel, dialogue or failure opens). The world is never re-rendered by React.
// Lines of dialogue type out with each speaker's babble voice (Space, E or a tap shows the whole line, then moves on).
// Hit-stop and slow motion scale the time fed to the fixed step (lib/jade-juice.ts). Test hooks live on window.__jade.
// The duo and the gadgets: Tab switches hero, F is the tag-team key, the mouse aims and the left button fires, 1 and 2
// (or the wheel) pick a gadget, X reloads. Player 1's keys can be remapped (lib/jade-keys.ts) and a gamepad drives
// player 1 (and the panels and mini-games). A second player joins from the pause menu (or a gamepad's Back): they use
// the arrow keys with / dash, . hop, , action, ; fire, ' gadget and Right Shift sneak, or a gamepad.
import { World, DT, NO_INPUT, type Input } from '@/lib/jade-game';
import { Scene, loadArt, artLoaded } from '@/lib/jade-scene';
import { spawn, EVENT_KINDS, type EventKind } from '@/lib/jade-events';
import { nearestFree } from '@/lib/jade-nav';
import { city, T, districtAt } from '@/lib/jade-city';
import { translate, PAD } from '@/lib/jade-keys';
import { startGang, type GangKind } from '@/lib/jade-gangs';
import { dailyEvent, dayKey, openDistricts, chapterOf, type Save } from '@/lib/jade-save';
import { MISSION, MISSIONS, SIDE } from '@/lib/jade-story';
import type { JadeSound } from './sound';
import type { Theme } from './music';
import { BIZ_IDS, BIZ_OF, raidMission, type BizId } from '@/lib/jade-biz';
import { applyTwo } from '@/lib/jade-duo';
import { duoFrame } from '@/lib/jade-duodraw';
import { tagOption } from '@/lib/jade-tag';
import { Notices } from '@/lib/jade-notice';
import { stallPos, giveGadget, buyGadget, buyAmmo, upgradeGadget, carry, carried, GADGET_IDS, type GadgetId } from '@/lib/jade-gear';

export type Toast = { id: number; msg: string; kind: string; t: number };
export class Play {
  w: World; scene: Scene; raf = 0; last = 0; acc = 0; paused = false; alive = true;
  keys = new Set<string>(); stick = { x: 0, y: 0, on: false }; touchSneak = false;
  pend = { dash: false, hop: false, act: false, swap: false, tag: false, fire: false, reload: false, hail: false, slot: undefined as number | undefined };
  /** the second player's presses, the mouse (screen position, held, seen recently) and a fake or real gamepad */
  pend2 = { dash: false, hop: false, act: false, fire: false, slot: undefined as number | undefined, tag: false };
  mouse = { x: 0, y: 0, down: false, seen: -9, held: 0 }; padPrev: boolean[] = []; fakePad: { axes: number[]; buttons: boolean[] } | null = null;
  fps = 60; frames = 0; fpsT = 0; fpsLog: number[] = [];
  /** the pop-ups over the street, one priority queue (lib/jade-notice.ts) */
  notices = new Notices(); get toasts(): Toast[] { return this.notices.shown; } tid = 1; ver = 0; notifyT = 0; lastKey = '';
  saveT = 0; ro: ResizeObserver | null = null; ambT = 0;
  /** the page shows the ending a moment after the last job is done */
  endingT = 0; endingKind = ''; onEnding: (() => void) | null = null;
  /** the typewriter: characters of the current line shown so far, the line it belongs to, and the element it fills */
  typed = 0; typeKey = ''; typeEl: HTMLElement | null = null; reduced = false;
  constructor(public cv: HTMLCanvasElement, public save: Save, public snd: JadeSound | null, public onChange: () => void, public persist: (s: Save) => void) {
    this.w = new World(save);
    this.w.event = dailyEvent(dayKey(new Date()));
    this.scene = new Scene(cv, city());
    this.scene.minimap.on = true;
    if (!artLoaded()) loadArt().then(() => { this.scene.chunks.clear(); this.scene.map = null; }).catch(() => undefined);
    this.resize();
    const host = cv.parentElement;
    if (host && typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); }
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku); window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.vis);
    cv.addEventListener('pointermove', this.pm); cv.addEventListener('pointerdown', this.pd); window.addEventListener('pointerup', this.pu); cv.addEventListener('wheel', this.wh, { passive: false }); cv.addEventListener('contextmenu', this.cm);
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.raf = requestAnimationFrame(this.frame);
    this.hooks();
  }
  destroy() {
    this.alive = false; cancelAnimationFrame(this.raf); this.ro?.disconnect();
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku); window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.vis);
    this.cv.removeEventListener('pointermove', this.pm); this.cv.removeEventListener('pointerdown', this.pd); window.removeEventListener('pointerup', this.pu); this.cv.removeEventListener('wheel', this.wh); this.cv.removeEventListener('contextmenu', this.cm);
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
  blur = () => { this.keys.clear(); this.mouse.down = false; };
  // ── the mouse: aim where it points, the left button fires (held: keeps firing as the gadget allows)
  pm = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; const r = this.cv.getBoundingClientRect(); this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.seen = performance.now(); };
  pd = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; this.pm(e); if (this.w.talk) { this.advance(); return; } this.mouse.down = true; this.mouse.held = 0; this.pend.fire = true; };
  pu = (e: PointerEvent) => { if (e.button === 0) this.mouse.down = false; };
  wh = (e: WheelEvent) => { if (Math.abs(e.deltaY) < 4) return; e.preventDefault(); this.pend.slot = -1; };
  cm = (e: Event) => { e.preventDefault(); };
  /** the mouse in world coordinates (or none when it hasn't moved over the game lately) */
  aimWorld(): [number, number] | null {
    if (performance.now() - this.mouse.seen > 8000) return null;
    const c = this.scene.cam; return [c.x - c.w / 2 + this.mouse.x / c.k, c.y - c.h / 2 + this.mouse.y / c.k];
  }
  vis = () => { if (document.hidden) { this.persist(this.w.s); this.keys.clear(); } };
  /** keys the page handles itself (pause, map) return true */
  onKey: ((k: string) => boolean) | null = null;
  kd = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const raw = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // player 1's remapped keys stand in for the default key of their action (not while a mini-game has the keys)
    const k = this.w.ui?.kind === 'mini' || !e.isTrusted ? raw : translate(this.w.s.settings.keys, raw);
    if (!k) { e.preventDefault(); return; }
    if (this.onKey && this.onKey(k)) { e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (k === 'Tab') e.preventDefault();
    if (e.repeat) return;
    const two = this.w.two;
    const code = e.code === 'ShiftRight' ? 'ShiftRight' : k;
    this.keys.add(code);
    const w = this.w;
    if (w.talk && (k === ' ' || k === 'Enter' || k === 'e')) { this.advance(); return; }
    if (k === ' ') this.pend.dash = true;
    if (k === 'q' || k === 'c') this.pend.hop = true;
    if (k === 'e' || (k === 'Enter' && !two)) this.pend.act = true;
    if (k === 'Tab') this.pend.swap = true;
    if (k === 'f') this.pend.tag = true;
    if (k === 'x') this.pend.reload = true;
    if (k === 'g') this.pend.hail = true;
    if (k === '1' || k === '2') this.pend.slot = +k - 1;
    // the second player's buttons on the right of the keyboard
    if (two) { if (k === '/') this.pend2.dash = true; if (k === '.') this.pend2.hop = true; if (k === ',' || k === 'Enter') this.pend2.act = true; if (k === ';') this.pend2.fire = true; if (k === "'") this.pend2.slot = -1; if (k === 'l') this.pend2.tag = true; }
  };
  ku = (e: KeyboardEvent) => { const raw = e.key.length === 1 ? e.key.toLowerCase() : e.key; const k = translate(this.w.s.settings.keys, raw) || raw; this.keys.delete(raw); this.keys.delete(e.code === 'ShiftRight' ? 'ShiftRight' : k); if (k === 'Shift') this.keys.delete('ShiftRight'); };
  input(): Input {
    const k = this.keys, two = this.w.two; let mx = 0, my = 0;
    // with a second player the arrow keys are theirs
    if (k.has('a') || (!two && k.has('ArrowLeft'))) mx -= 1; if (k.has('d') || (!two && k.has('ArrowRight'))) mx += 1;
    if (k.has('w') || (!two && k.has('ArrowUp'))) my -= 1; if (k.has('s') || (!two && k.has('ArrowDown'))) my += 1;
    const l = Math.hypot(mx, my); if (l > 0) { mx /= l; my /= l; }
    if (this.stick.on) { mx = this.stick.x; my = this.stick.y; }
    let aim = this.aimWorld();
    // player 1's gamepad: the left stick or d-pad moves, the right stick aims (Assist picks the target otherwise)
    const g = this.p1pad; let padSneak = false;
    if (g) {
      const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) { mx = ax; my = ay; }
      const rx = g.axes[2] ?? 0, ry = g.axes[3] ?? 0; const p = this.w.p;
      if (Math.hypot(rx, ry) > 0.35) aim = [p.x + rx * 320, p.y + ry * 320]; else if (this.padUsed) aim = null;
      padSneak = !!g.buttons[PAD.LT];
    }
    // holding the button keeps firing (the gadget's own cooldown paces it)
    const fire = this.pend.fire || (this.mouse.down && this.mouse.held > 0.25);
    return { mx, my, sneak: k.has('Shift') || (!two && k.has('ShiftRight')) || this.touchSneak || padSneak, dash: this.pend.dash, hop: this.pend.hop, act: this.pend.act,
      swap: this.pend.swap, tag: this.pend.tag, reload: this.pend.reload, hail: this.pend.hail, slot: this.pend.slot, fire, ax: aim ? aim[0] : NaN, ay: aim ? aim[1] : NaN };
  }
  /** the second player: arrow keys and the right-hand keys, or the first gamepad (stick, A dash, B hop, X action, RT or
   * Y fire, LB/RB gadget, Start joins and leaves) */
  input2(): Input {
    const k = this.keys; let mx = 0, my = 0;
    if (k.has('ArrowLeft')) mx -= 1; if (k.has('ArrowRight')) mx += 1; if (k.has('ArrowUp')) my -= 1; if (k.has('ArrowDown')) my += 1;
    const l = Math.hypot(mx, my); if (l > 0) { mx /= l; my /= l; }
    const pad = this.p2pad; let sneak = k.has('ShiftRight');
    if (pad) {
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0; if (Math.hypot(ax, ay) > 0.2) { mx = ax; my = ay; }
      const b = pad.buttons, was = this.padPrev; const hit = (i: number) => !!b[i] && !was[i];
      if (hit(0)) this.pend2.dash = true; if (hit(1)) this.pend2.hop = true; if (hit(2)) this.pend2.act = true; if (hit(7) || hit(3)) this.pend2.fire = true; if (hit(4) || hit(5)) this.pend2.slot = -1;
      if (b[6]) sneak = true;
      this.padPrev = b.slice();
    }
    return { mx, my, sneak, dash: this.pend2.dash, hop: this.pend2.hop, act: this.pend2.act, fire: this.pend2.fire, slot: this.pend2.slot, tag: this.pend2.tag, ax: NaN, ay: NaN };
  }
  pads(): { axes: number[]; buttons: boolean[] }[] {
    if (this.fakePad) return [this.fakePad, ...(this.fakePad2 ? [this.fakePad2] : [])];
    const gps = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && g.connected) : [];
    return gps.map(gp => ({ axes: [...gp!.axes], buttons: gp!.buttons.map(b => b.pressed) }));
  }
  pad() { return this.pads()[0] ?? null; }
  /** which pad is whose: alone, the first pad is player 1's; with two players and one pad it is player 2's (the
   * keyboard stays player 1's); with two pads, one each */
  p1pad: { axes: number[]; buttons: boolean[] } | null = null; p2pad: { axes: number[]; buttons: boolean[] } | null = null;
  padUsed = false; p1Prev: boolean[] = []; p1Axis = [0, 0]; menuPrev: boolean[] = []; menuAxis = [0, 0];
  /** Back (Select) brings a second player in or out; Start pauses (Escape); the face buttons drive player 1 or, with
   * a panel or mini-game open, move the focus and press buttons */
  padJoin() {
    const ps = this.pads(); const two = this.w.two;
    this.p1pad = !two ? ps[0] ?? null : ps.length >= 2 ? ps[0] : null;
    this.p2pad = two ? (ps.length >= 2 ? ps[1] : ps[0]) ?? null : null;
    const lead = ps[0]; if (!lead) { this.p1Prev = []; return; }
    const back = !!lead.buttons[PAD.BACK] || (ps.length >= 2 && !!ps[1].buttons[PAD.START]);
    if (back && !this.startPrev) this.setTwo(!this.w.two);
    this.startPrev = back;
    const g = this.p1pad; if (!g) return;
    const b = g.buttons, was = this.p1Prev, hit = (i: number) => !!b[i] && !was[i];
    if (b.some(Boolean) || Math.hypot(g.axes[0] ?? 0, g.axes[1] ?? 0) > 0.3) this.padUsed = true;
    const menu = typeof document !== 'undefined' && !!document.querySelector('.jade-modal-back, .jade-mini, .jade-pmap-back');
    if (hit(PAD.START)) this.synth('Escape');
    if (menu) this.padMenu(g, hit);
    else if (this.w.talk) { if (hit(PAD.A) || hit(PAD.X)) this.advance(); }
    else {
      if (hit(PAD.A)) this.pend.dash = true; if (hit(PAD.B)) this.pend.hop = true; if (hit(PAD.X)) this.pend.act = true; if (hit(PAD.Y)) this.pend.tag = true;
      if (hit(PAD.RB) || hit(PAD.RT)) this.pend.fire = true; if (hit(PAD.LB)) this.pend.slot = 1 - this.w.s.gear.slot[this.w.p.who];
      if (hit(PAD.L3) || hit(PAD.R3) || hit(PAD.RIGHT)) this.pend.swap = true; if (hit(PAD.LEFT)) this.pend.reload = true;
      // the d-pad: up opens the map, down the phone
      if (hit(PAD.UP)) this.synth('m'); if (hit(PAD.DOWN)) this.synth('t');
      // holding RB keeps firing
      if (b[PAD.RB] && was[PAD.RB]) this.pend.fire = this.w.tick % 12 === 0 || this.pend.fire;
    }
    this.p1Prev = b.slice();
  }
  /** a pad in a panel: the d-pad or stick moves the focus between buttons, A presses, B closes; in a mini-game the
   * d-pad and A stand in for the arrow keys and Space */
  padMenu(g: { axes: number[]; buttons: boolean[] }, hit: (i: number) => boolean) {
    const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0;
    const dir = (i: number, a: number, s: number) => hit(i) || (Math.abs(a) > 0.6 && Math.sign(a) === s && Math.abs(this.menuAxis[i < 14 ? 1 : 0]) <= 0.6);
    const up = dir(PAD.UP, ay, -1), down = dir(PAD.DOWN, ay, 1), left = dir(PAD.LEFT, ax, -1), right = dir(PAD.RIGHT, ax, 1);
    this.menuAxis = [ax, ay];
    const mini = document.querySelector('.jade-mini');
    if (mini) {
      for (const [on, key, i] of [[up, 'ArrowUp', PAD.UP], [down, 'ArrowDown', PAD.DOWN], [left, 'ArrowLeft', PAD.LEFT], [right, 'ArrowRight', PAD.RIGHT]] as [boolean, string, number][]) {
        if (on) this.synth(key); if (!g.buttons[i] && this.p1Prev[i]) this.synth(key, 'keyup');
      }
      if (hit(PAD.A)) this.synth(' '); if (!g.buttons[PAD.A] && this.p1Prev[PAD.A]) this.synth(' ', 'keyup');
      if (hit(PAD.X)) this.synth('Enter');
      return;
    }
    const root = [...document.querySelectorAll('.jade-modal-back, .jade-pmap-back')].pop() as HTMLElement | undefined; if (!root) return;
    const btns = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), select, input')].filter(e => e.offsetParent !== null);
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (up || left) btns[(i <= 0 ? btns.length : i) - 1].focus(); else if (down || right) btns[(i + 1) % btns.length].focus();
    if (hit(PAD.A)) { const el = document.activeElement as HTMLElement | null; if (el && btns.includes(el)) el.click(); else btns[0].focus(); }
    if (hit(PAD.B)) this.synth('Escape');
  }
  synth(key: string, type: 'keydown' | 'keyup' = 'keydown') { window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true })); }
  fakePad2: { axes: number[]; buttons: boolean[] } | null = null;
  startPrev = false;
  setTwo(on: boolean) { applyTwo(this.w, on); this.toast(on ? `Player 2 joins as ${this.w.mate.who === 'dora' ? 'Dora' : 'Enzo'}! Arrows to move, / dash, . hop, , action, ; fire, ' gadget.` : 'Player 2 left. The partner follows you again.', 'good'); this.bump(); }
  /** the current line of dialogue: who, the words, the mood */
  line(): [string, string, string] | null { const t = this.w.talk; if (!t) return null; const l = t.lines[t.i]; return l ? [l[0], l[1], l[2] ?? 'calm'] : null; }
  /** Space, E or a tap: show the whole line if it is still typing, otherwise the next line */
  advance() {
    if (!this.w.talk) return;
    const l = this.line(); if (l && this.typed < l[1].length) { this.typed = l[1].length; this.fill(); this.bump(); return; }
    this.w.advanceTalk(); this.snd?.talk(this.w.talk?.i ?? 0); this.bump();
  }
  fill() { const l = this.line(); if (this.typeEl && l) this.typeEl.textContent = l[1].slice(0, Math.floor(this.typed)); }
  /** type out the line, one babble syllable every other letter */
  typeStep(dt: number) {
    const l = this.line(); if (!l) { this.typeKey = ''; return; }
    const key = `${this.w.talk!.i}|${l[1]}`;
    if (key !== this.typeKey) { this.typeKey = key; this.typed = 0; }
    if (this.typed >= l[1].length) return;
    const before = Math.floor(this.typed); this.typed = Math.min(l[1].length, this.typed + dt * (this.reduced ? 90 : 48));
    const now = Math.floor(this.typed);
    for (let i = before; i < now; i++) if (i % 2 === 0 && /[A-Za-z]/.test(l[1][i])) this.snd?.blip(l[0], i + l[1].length, l[2]);
    this.fill();
    if (now >= l[1].length) this.bump();
  }
  press(b: 'dash' | 'hop' | 'act' | 'swap' | 'tag' | 'reload' | 'fire') { if (b === 'act' && this.w.talk) { this.advance(); return; } this.pend[b] = true; }
  bump() { this.ver++; this.onChange(); }

  frame = (now: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : DT; this.last = now;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = this.frames / this.fpsT; this.fpsLog.push(this.fps); if (this.fpsLog.length > 600) this.fpsLog.shift(); this.frames = 0; this.fpsT = 0; }
    const w = this.w;
    const st = w.s.settings; this.scene.juice.opt = { shake: st.shake, calm: st.calm, reduced: this.reduced };
    this.typeStep(dt);
    this.padJoin();
    if (this.mouse.down) this.mouse.held += dt;
    const aim = this.aimWorld(); this.scene.aim = aim && !w.talk && !w.ui && w.s.gear.own.length ? { x: aim[0], y: aim[1], on: true } : null;
    if (!this.paused) {
      this.acc += dt * this.scene.juice.rate();
      let n = 0;
      while (this.acc >= DT && n < 6) {
        const inp = this.input();
        w.step(inp, DT, w.two ? this.input2() : undefined);
        this.pend.dash = this.pend.hop = this.pend.act = this.pend.swap = this.pend.tag = this.pend.fire = this.pend.reload = this.pend.hail = false; this.pend.slot = undefined;
        this.pend2.dash = this.pend2.hop = this.pend2.act = this.pend2.fire = this.pend2.tag = false; this.pend2.slot = undefined;
        this.acc -= DT; n++;
      }
      if (n === 6) this.acc = 0;
    }
    const fx = w.drain();
    if (fx.length) this.events(fx);
    if (artLoaded()) this.scene.draw(w, this.paused ? 0 : dt);
    // HUD refresh: at once on a modal change, else ~10 Hz
    const key = `${!!w.talk}|${w.talk?.i}|${w.ui?.kind}|${!!w.failed}|${w.banner?.text}|${w.near?.label}|${w.run?.i}|${w.run?.label}|${!!w.p.ride}|${w.p.roof}|${w.p.hide}|${w.p.who}|${w.two}`;
    this.notifyT -= dt;
    if (key !== this.lastKey || this.notifyT <= 0) { this.lastKey = key; this.notifyT = 0.1; this.bump(); }
    this.saveT += dt; if (this.saveT > 5) { this.saveT = 0; this.persist(w.s); }
    // music follows the action
    this.snd?.play(this.theme());
    this.snd?.radio(w.p.ride?.kind ?? null);
    this.ambT -= dt; if (this.ambT <= 0) { this.ambT = 1; this.snd?.ambient(districtAt(Math.floor(w.p.x / T), Math.floor(w.p.y / T)), w.rain); }
    if (this.endingT > 0 && !this.paused) { this.endingT -= dt; if (this.endingT <= 0) this.onEnding?.(); }
    this.notices.step(dt); this.w.hush = this.notices.busy || !!this.w.banner;
  };
  events(fx: ReturnType<World['drain']>) {
    this.scene.consume(this.w, fx);
    this.snd?.fx(fx);
    for (const f of fx) {
      if (f.t === 'toast' && f.msg) this.toast(f.msg, f.kind ?? '');
      else if (f.t === 'trophy' && f.name) this.toast(`Trophy: ${f.name}`, 'gold');
      else if (f.t === 'caught') this.toast(f.msg ?? 'Caught! The wardens fined you and sent you to a safe house.', 'bad');
      else if (f.t === 'heat-up' && f.k) this.toast(f.k === 1 ? 'A warden spotted you! Break line of sight, hide, or swap jackets at a safe house.' : `${f.k} lanterns of heat!`, 'bad');
      else if (f.t === 'finale') { this.endingT = 3; this.endingKind = f.kind === 'isle' || f.kind === 'lights' ? f.kind : ''; }
      else if (f.t === 'learned') this.snd?.fx([{ t: 'lesson' }]);
      if (f.t === 'mission-done' && this.w.lastMedal) { const m = this.w.lastMedal; this.snd?.fx([{ t: 'medal', k: m.medal }]); if (m.best && m.medal) this.toast(`New best medal: ${['', 'bronze', 'silver', 'gold'][m.medal]}!`, 'gold'); }
      if (f.t === 'mission-done' || f.t === 'district' || f.t === 'trophy') this.persist(this.w.s);
    }
  }
  /** which music theme fits the moment: Glint's finale, a chase or race, the festival, a market, or the street */
  theme(): Theme {
    const w = this.w, t = w.run?.cur?.t ?? '';
    if ((w.run?.m.id === 'm25' && (t === 'chase' || t === 'float')) || (w.run?.m.id === 'm35' && (t === 'chase' || t === 'bag'))) return 'boss';
    if (w.heat >= 1 || ['chase', 'race', 'escort', 'raid'].includes(t)) return 'chase';
    if (w.festival && !w.run) return 'festival';
    if (w.ui?.kind === 'market' || w.ui?.kind === 'biz') return 'market';
    for (const pl of Object.values(w.c.places)) if (pl.kind === 'market' && Math.hypot(pl.x - w.p.x, pl.y - w.p.y) < 6 * T) return 'market';
    return 'street';
  }
  toast(msg: string, kind = '') { this.notices.push(msg, kind); }

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
      jumpTo: (id: string) => { const i = MISSIONS.findIndex(m => m.id === id); this.w.s.done = MISSIONS.slice(0, Math.max(0, i)).map(m => m.id); this.w.s.story.intro = true; this.w.s.story.ch = chapterOf(this.w.s); this.w.quitJob(); this.w.open = new Set(openDistricts(this.w.s)); this.w.fieldCache.clear(); const pl = this.w.c.places[MISSION[id].at]; this.w.placePlayer(pl.x, pl.y + T * 0.8); this.scene.map = null; },
      step: (n = 60, inp?: Partial<Input>) => { for (let i = 0; i < n; i++) this.w.step({ ...NO_INPUT, ...inp }, DT); },
      heat: (n: number) => { this.w.heat = n; },
      /** the Singapore streets: start a gang's street event here, a festival tonight, a storm flash; a ticket warden
       * strolling beside you */
      gang: (k: GangKind) => { this.w.gangs.ev = null; return !!startGang(this.w, k); },
      fest: (f: 'getai' | 'lion' | 'lantern' | null, clock?: number) => { const sg = this.w.sg; sg.fest = f; sg.kids = f === 'lantern' ? [0, 1, 2, 3].map(i => ({ x: 0, y: 0, i })) : []; sg.once.clear(); if (clock !== undefined) this.w.s.clock = clock; },
      warden: (dx = 120, dy = 0) => { const w = this.w; w.patrols = [{ id: w.nextId++, b: { x: w.p.x + dx, y: w.p.y + dy, h: Math.PI, speed: 0, r: 13, len: 0, cls: 'walk' }, goal: [w.p.x + dx, w.p.y + dy], pace: 0, write: 0, spot: 0 }]; w.fineCd.clear(); },
      /** start any job now (a story job or a Hawker Tales side job), next to its contact */
      job: (id: string) => { const m = MISSION[id]; if (!m) return null; this.w.quitJob(); this.w.talk = null; this.w.ui = null; const pl = this.w.c.places[m.at]; if (pl) this.w.placePlayer(pl.x, pl.y + T * 0.6); this.w.startMission(m); this.w.talk = null; return this.w.run?.cur?.t ?? null; },
      cash: (n: number) => { this.w.s.cash = n; },
      district: (tx: number, ty: number) => districtAt(tx, ty),
      /** street events, rain, the ending and the festival for the browser tests */
      event: (k?: EventKind, here = false) => {
        const w = this.w; w.street = null; w.crowd = null;
        // try where you stand, then beside a parked van or a stall in an open district
        const spots: [number, number][] = [[w.p.x, w.p.y], ...w.rides.filter(r => r.kind === 'van' && r.parked && !r.locked).map(r => [r.b.x, r.b.y + 5 * T] as [number, number]), ...w.c.props.filter(p => p.sprite.startsWith('stall')).map(p => [p.x, p.y + 6 * T] as [number, number])];
        for (const [x, y] of here ? spots.slice(0, 1) : spots) {
          if (!w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)))) continue;
          if (!here) { const [fx, fy] = nearestFree(w.c, 'walk', x, y, w.open, 6); w.placePlayer(fx, fy); }
          for (const kind of k ? [k] : EVENT_KINDS) { const e = spawn(w, kind); if (e) return e.kind; }
        }
        return null;
      },
      street: () => { const e = this.w.street; return e ? { kind: e.kind, phase: e.phase, x: e.x / T, y: e.y / T } : null; },
      rain: (v: number | null) => { this.w.rainForce = v; },
      ending: () => { this.endingT = 0.01; },
      finishAll: () => { this.w.s.done = MISSIONS.map(m => m.id); this.w.open = new Set(openDistricts(this.w.s)); this.w.fieldCache.clear(); this.scene.map = null; },
      medals: () => ({ ...this.w.s.medals }),
      lights: () => this.w.time,
      /** the third pass: set pieces, Glint's phases, the float, businesses, raids, voices and game feel */
      sets: () => this.w.run ? this.w.run.sets.map(s => ({ k: s.def.k, ph: s.ph, down: s.down, swing: s.swing, rubble: s.rubble.length, drums: s.drums.length })) : [],
      fireSets: () => { const r = this.w.run; if (!r) return 0; const s0 = r.sets.find(s => s.ph === 'wait') ?? r.sets[0]; for (const s of r.sets) if (s.ph === 'wait') { const a = r.actors[0]; if (a) { a.wp = Math.max(a.wp, s.def.wp); a.b.x = s.x; a.b.y = s.y + 1.6 * T; a.stun = 3; } } if (s0) { const [x, y] = nearestFree(this.w.c, this.w.p.ride ? 'small' : 'walk', s0.x - 3 * T, s0.y - 2 * T, this.w.open, 6); this.w.placePlayer(x, y); if (this.w.p.ride) { this.w.p.ride.b.x = x; this.w.p.ride.b.y = y; } } return r.sets.length; },
      /** jump to a job and start it, dialogue skipped */
      mission: (id: string) => MISSION[id] ?? null,
      jobs: () => ({ story: MISSIONS.length, side: SIDE.length }),
      start: (id: string) => { (g.__jade as { jumpTo: (id: string) => void }).jumpTo(id); this.w.startMission(MISSION[id]); this.w.talk = null; this.bump(); return this.w.run?.m.id ?? null; },
      stepOf: (t: string, k?: string) => this.w.run ? this.w.run.m.steps.findIndex(st => st.t === t && (!k || (k === 'sets' ? 'sets' in st && !!st.sets : 'phase' in st && String(st.phase) === k))) : -1,
      enterStep: (i: number) => { const r = this.w.run; if (!r) return null; this.w.talk = null; r.snap = r.snapshot(i); r.enter(i); return r.cur?.t ?? null; },
      run: () => { const r = this.w.run; return r ? { id: r.m.id, i: r.i, t: r.cur?.t, phase: r.cur && 'phase' in r.cur ? r.cur.phase ?? 0 : 0, meter: r.meter, meter2: r.meter2, warning: r.warning?.text ?? null, signs: r.signs.length, decoys: r.actors.filter(a => a.kind === 'decoy' && !a.gone).length, float: r.float ? { x: r.float.x / T, moving: r.float.moving, done: r.float.done } : null, actors: r.actors.length, timer: r.timer } : null; },
      biz: () => Object.fromEntries(BIZ_IDS.map(id => [id, { ...this.w.s.biz[id] }])),
      bizLog: () => this.w.s.bizLog.slice(),
      raid: (id: BizId) => { this.w.quitJob(); this.w.startMission(raidMission(this.w, id), { key: 'raid:' + id, reward: 40, d: BIZ_OF[id].d }); this.w.talk = null; return this.w.run?.cur?.t ?? null; },
      typed: () => ({ typed: Math.floor(this.typed), len: this.line()?.[1].length ?? 0, mood: this.line()?.[2] ?? null, who: this.line()?.[0] ?? null }),
      juice: () => { const j = this.scene.juice; return { debris: j.debris.length, pops: j.pops.length, trauma: j.trauma, slow: j.slow, stop: j.stop, opt: { ...j.opt } }; },
      theme: () => this.theme(),
      /** the fourth pass: both heroes, tag-team moves, gadgets and the second player */
      duo: () => { const w = this.w, p = w.p, m = w.mate; return { who: p.who, mate: m.who, two: w.two, px: p.x / T, py: p.y / T, mx: m.x / T, my: m.y / T, mode: m.ai.mode, holding: m.ai.holding, seat: !!m.seat, mroof: m.roof, roof: p.roof, anim: p.anim, manim: m.anim, dist: Math.hypot(p.x - m.x, p.y - m.y) / T, tag: tagOption(w)?.kind ?? null, tagLabel: tagOption(w)?.label ?? null }; },
      press: (what: 'swap' | 'tag' | 'fire' | 'reload' | 'dash' | 'hop' | 'act' | 'hail', n = 1) => { (this.pend as Record<string, unknown>)[what] = true; for (let i = 0; i < n; i++) { const inp = this.input(); this.w.step(inp, DT, this.w.two ? this.input2() : undefined); this.pend.dash = this.pend.hop = this.pend.act = this.pend.swap = this.pend.tag = this.pend.fire = this.pend.reload = this.pend.hail = false; this.pend.slot = undefined; } const fx = this.w.drain(); if (fx.length) this.events(fx); this.bump(); },
      gear: () => { const s = this.w.s; return { own: s.gear.own.slice(), ammo: { ...s.gear.ammo }, clip: { ...s.gear.clip }, lvl: { ...s.gear.lvl }, carry: { dora: s.gear.carry.dora.slice(), enzo: s.gear.carry.enzo.slice() }, slot: { ...s.gear.slot }, hand: carried(s, this.w.p.who), shots: this.w.shots.length, splats: this.w.splats.length, crates: this.w.crates.length }; },
      give: (ids?: GadgetId[]) => { for (const g of ids ?? GADGET_IDS) giveGadget(this.w.s, g); this.bump(); return this.w.s.gear.own.slice(); },
      buy: (what: 'gadget' | 'ammo' | 'up' | 'carry', g: GadgetId) => { const s = this.w.s; const r = what === 'gadget' ? buyGadget(s, g) : what === 'ammo' ? buyAmmo(s, g) : what === 'up' ? upgradeGadget(s, g) : carry(s, this.w.p.who, g); this.bump(); return r; },
      two: (on: boolean) => this.setTwo(on),
      fakePad: (pad: { axes: number[]; buttons: boolean[] } | null, pad2?: { axes: number[]; buttons: boolean[] } | null) => { this.fakePad = pad; this.fakePad2 = pad2 ?? null; },
      aimAt: (tx: number, ty: number) => { const c = this.scene.cam; this.mouse.x = (tx * T - (c.x - c.w / 2)) * c.k; this.mouse.y = (ty * T - (c.y - c.h / 2)) * c.k; this.mouse.seen = performance.now(); },
      wardens: () => this.w.wardens.map(wd => ({ x: wd.b.x / T, y: wd.b.y / T, stun: wd.stun, hit: wd.hitKind ?? null })),
      crowNear: () => { const w = this.w, e = w.street; if (!e?.b) return false; e.b.x = w.mate.x + 140; e.b.y = w.mate.y; e.x = e.b.x; e.y = e.b.y; return true; },
      toStall: () => { const [x, y] = stallPos(this.w); this.w.placePlayer(x, y + T * 0.8); this.bump(); },
      gates: () => this.w.gates.size,
      frame: (mate = false) => duoFrame(mate ? this.w.mate : this.w.p, this.w.time).f,
      screenOf: (tx: number, ty: number) => { const c = this.scene.cam, r = this.cv.getBoundingClientRect(); return [r.left + (tx * T - (c.x - c.w / 2)) * c.k, r.top + (ty * T - (c.y - c.h / 2)) * c.k]; },
      shooter: () => { const w = this.w, m = w.mate; return { act: m.act?.n ?? null, seat: !!m.seat, cd: m.fireCd, rl: m.reloadT, g: carried(w.s, m.who), clip: w.s.gear.clip }; },
      snatch: () => { const w = this.w; w.snatchers.push({ x: w.p.x + 300, y: w.p.y, h: Math.PI, t: 0, out: false, took: 0, wing: 0 }); return w.snatchers.length; },
    };
  }
}
