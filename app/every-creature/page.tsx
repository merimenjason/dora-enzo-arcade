'use client';
// Every Creature, Chapter One: the page. A full-screen canvas (the title, play, the screen cards and the end card are
// all drawn by lib/creature-scene.ts), input from keys (solo, or two players on one keyboard), touch (a stick, three
// buttons, the form row and the partner's portrait) and gamepads, the fixed 60 Hz loop, the checkpoint save
// (`every-creature-cp1`) and the sound. Rules in lib/creature-game.ts.
import { useEffect, useRef, useState } from 'react';
import {
  G, SCR, FORMS, FKEY, NOINP, DT, SAVE_KEY, newGame, step, tickModes, tickFx, startGame, parseSave, checkpoint, snapshot, setForm, swap, callPartner,
  type Input, type Form, type Checkpoint,
} from '@/lib/creature-game';
import { CreatureScene } from '@/lib/creature-scene';
import { CreatureSound } from './sound';
import './every-creature.css';

const ART = '/art/every-creature/';
function readCP(): Checkpoint | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
function writeCP(c: Checkpoint) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* private window: play on unsaved */ } }
function clearCP() { try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing saved */ } }
const P1 = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'] };
const PREVENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];

export default function EveryCreature() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<string>('title');

  useEffect(() => {
    const cv = cvRef.current!; const sc = new CreatureScene(cv); const snd = new CreatureSound();
    newGame({ mode: 'title' });
    sc.cp = readCP();
    const fit = () => { sc.resize(innerWidth, innerHeight, devicePixelRatio); sc.updCam(0, true); };
    fit(); addEventListener('resize', fit);
    let alive = true, loaded = false;
    void sc.load(ART).then(() => { if (!alive) return; loaded = true; fit(); setReady(true); document.querySelector('main')?.setAttribute('data-ready', 'true'); });

    // ─────────────────────────────── input state
    const keys: Record<string, boolean> = {}, edge: Record<string, boolean> = {};
    const tch = { edge: {} as Record<string, unknown>, btn: {} as Record<string, boolean>, mx: 0, my: 0, stick: -1 };
    const pad = { prev: [[], []] as boolean[][], inp: [null, null] as (Input | null)[] };
    const opts = { assist: true, two: false };
    const kd = (c: string) => !!keys[c], ke = (c: string) => !!edge[c];
    const noteInput = () => { if (G.mode === 'play' || G.mode === 'trans') { G.idleT = 0; G.stats.inputs++; } };
    const begin = (cont: boolean) => {
      const cp = cont ? readCP() : null;
      if (!cp) clearCP();
      startGame(cp, { ...opts, seed: (Math.random() * 1e6 | 0) + 1 });
      if (G.si > 0) writeCP(checkpoint()!);
      sc.updCam(0, true); snd.start();
    };
    const toggle = (id: string) => {
      if (id === 'assist') { opts.assist = !opts.assist; G.assist = opts.assist; }
      else if (id === 'two') { opts.two = !opts.two; G.two = opts.two; }
      else { snd.setMute(!snd.muted); sc.muted = snd.muted; }
    };
    const readKeys = (set: 'solo' | 'p1' | 'p2'): Input => {
      const any = (a: string[]) => a.some(kd);
      let inp: Input;
      if (set === 'solo') {
        inp = { mx: (any(P1.right) ? 1 : 0) - (any(P1.left) ? 1 : 0), my: (any(P1.down) ? 1 : 0) - (any(P1.up) ? 1 : 0), actP: ke('Space') || ke('Enter'), actH: kd('Space') || kd('Enter'), upP: ke('ArrowUp') || ke('KeyW'),
          formP: (ke('KeyE') ? 1 : 0) - (ke('KeyQ') ? 1 : 0), formSet: null, swapP: ke('ShiftLeft') || ke('ShiftRight') || ke('Tab'), callP: ke('KeyC') };
        for (const f of FORMS) if (ke('Digit' + FKEY[f]) || ke('Numpad' + FKEY[f])) inp.formSet = f;
        return inp;
      }
      if (set === 'p1') {
        inp = { mx: (kd('KeyD') ? 1 : 0) - (kd('KeyA') ? 1 : 0), my: (kd('KeyS') ? 1 : 0) - (kd('KeyW') ? 1 : 0), actP: ke('Space'), actH: kd('Space'), upP: ke('KeyW'), formP: (ke('KeyE') ? 1 : 0) - (ke('KeyQ') ? 1 : 0), formSet: null, swapP: false, callP: false };
        for (const f of FORMS) if (ke('Digit' + FKEY[f])) inp.formSet = f;
        return inp;
      }
      return { mx: (kd('ArrowRight') ? 1 : 0) - (kd('ArrowLeft') ? 1 : 0), my: (kd('ArrowDown') ? 1 : 0) - (kd('ArrowUp') ? 1 : 0), actP: ke('Enter') || ke('Slash') || ke('ShiftRight'), actH: kd('Enter') || kd('Slash') || kd('ShiftRight'), upP: ke('ArrowUp'),
        formP: (ke('Period') ? 1 : 0) - (ke('Comma') ? 1 : 0), formSet: null, swapP: false, callP: false };
    };
    const touchInput = (): Input => {
      const e = tch.edge, b = tch.btn;
      const inp: Input = { mx: tch.mx, my: tch.my, actP: !!e.act, actH: !!b.act, upP: !!e.up, formP: e.form ? 1 : 0, formSet: (e.formSet as Form) || null, swapP: !!e.swap, callP: !!e.call };
      tch.edge = {};
      return inp;
    };
    const merge = (...xs: (Input | null)[]): Input => {
      const o = { ...NOINP } as Record<string, unknown>;
      for (const x of xs) if (x) for (const k of Object.keys(NOINP) as (keyof Input)[]) o[k] = o[k] || x[k];
      return o as unknown as Input;
    };
    const frameInput = () => G.two ? { a: merge(readKeys('p1'), touchInput(), pad.inp[0]), b: merge(readKeys('p2'), pad.inp[1]) } : { a: merge(readKeys('solo'), touchInput(), pad.inp[0], pad.inp[1]) };

    // ─────────────────────────────── keys
    const onKeyDown = (e: KeyboardEvent) => {
      snd.start();
      if (PREVENT.includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      keys[e.code] = true; edge[e.code] = true;
      noteInput(); if (/^Key[WASD]$/.test(e.code)) G.scheme = 'wasd'; else if (e.code.startsWith('Arrow')) G.scheme = 'arrows';
      sc.touch.used = false;
      if (e.code === 'KeyP') toggle('two'); if (e.code === 'KeyM') toggle('mute');
      if (G.mode === 'title' && loaded) { if (e.code === 'Space' || e.code === 'Enter') begin(!!readCP()); if (e.code === 'KeyN') begin(false); }
      else if (G.mode === 'end' && G.endT > 1 && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR')) begin(false);
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    const onBlur = () => { for (const k in keys) keys[k] = false; tch.mx = tch.my = 0; tch.btn = {}; };
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);

    // ─────────────────────────────── touch and mouse
    const ptrs = new Map<number, string>();
    const hitBtn = (x: number, y: number) => { for (const k of ['act', 'form', 'swap'] as const) { const B = sc.UI[k]; if (k === 'swap' && G.two) continue; if (B && Math.hypot(x - B.x, y - B.y) < B.r * 1.15) return k; } return null; };
    const uiTap = (x: number, y: number) => {
      for (const o of sc.UI.optHit) if (x >= o.x && x <= o.x + o.w && y >= o.y - 4 && y <= o.y + o.h + 4) { toggle(o.id); return true; }
      if (G.mode === 'title' || G.mode === 'end') {
        if (!loaded || (G.mode === 'end' && G.endT < .5)) return true;
        for (const b of sc.UI.btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { begin(b.id === 'cont'); return true; }
        return true;
      }
      if (G.mode !== 'play') return false;
      for (const p of sc.UI.portHit) if (Math.hypot(x - p.x, y - p.y) < p.r) { tch.edge.call = true; return true; }
      for (const r of sc.UI.rowHit) if (Math.hypot(x - r.x, y - (r.y + sc.UI.ic / 2)) < r.r) { tch.edge.formSet = r.f; return true; }
      return false;
    };
    const stickMove = (x: number, y: number) => {
      const S = sc.UI.stick; let dx = (x - S.x) / S.r, dy = (y - S.y) / S.r;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      const prevUp = tch.my < 0;
      tch.mx = Math.abs(dx) > .3 ? Math.sign(dx) : 0; tch.my = Math.abs(dy) > .45 ? Math.sign(dy) : 0;
      if (tch.my < 0 && !prevUp) tch.edge.up = true;
    };
    const onDown = (e: PointerEvent) => {
      snd.start(); e.preventDefault(); noteInput();
      if (e.pointerType !== 'mouse' && !sc.touch.used) { sc.touch.used = true; sc.layoutUI(); }
      const x = e.clientX, y = e.clientY;
      if (uiTap(x, y)) { ptrs.set(e.pointerId, 'ui'); return; }
      if (!sc.isTouch() && e.pointerType === 'mouse') return;
      const b = hitBtn(x, y);
      if (b) { tch.btn[b] = true; tch.edge[b] = true; ptrs.set(e.pointerId, b); return; }
      if (x < sc.VW * .55 && tch.stick < 0) { tch.stick = e.pointerId; ptrs.set(e.pointerId, 'stick'); stickMove(x, y); }
    };
    const onMove = (e: PointerEvent) => { if (ptrs.get(e.pointerId) === 'stick') { stickMove(e.clientX, e.clientY); noteInput(); } };
    const onUp = (e: PointerEvent) => {
      const k = ptrs.get(e.pointerId); if (!k) return;
      if (k === 'stick') { tch.mx = tch.my = 0; tch.stick = -1; } else if (k !== 'ui') tch.btn[k] = false;
      ptrs.delete(e.pointerId);
    };
    cv.addEventListener('pointerdown', onDown, { passive: false }); addEventListener('pointermove', onMove, { passive: false });
    addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);

    // ─────────────────────────────── gamepads: stick or d-pad to move, A action (hold to dig, shell or dive),
    // B call the partner, Y swap heroes, X or a shoulder change form, Start to begin
    const pollPads = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p && p.connected) : [];
      for (let i = 0; i < 2; i++) {
        const gp = pads[i]; if (!gp) { pad.inp[i] = null; continue; }
        const b = gp.buttons.map((x) => x.pressed), pv = pad.prev[i], edg = (n: number) => !!b[n] && !pv[n];
        const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
        const mx = (ax > .45 || b[15] ? 1 : 0) - (ax < -.45 || b[14] ? 1 : 0), my = (ay > .45 || b[13] ? 1 : 0) - (ay < -.45 || b[12] ? 1 : 0);
        const prevUp = (pad.inp[i]?.my ?? 0) < 0;
        if (b.some(Boolean) || mx || my) { snd.start(); noteInput(); sc.touch.used = false; }
        if (G.mode === 'title' && loaded && (edg(0) || edg(9))) begin(!!readCP());
        else if (G.mode === 'end' && G.endT > 1 && (edg(0) || edg(9))) begin(false);
        const old = pad.inp[i];
        pad.inp[i] = { mx, my, actP: edg(0) || !!old?.actP, actH: !!b[0], upP: (my < 0 && !prevUp) || !!old?.upP, formP: (edg(2) || edg(5) ? 1 : 0) - (edg(4) ? 1 : 0) || old?.formP || 0, formSet: null, swapP: edg(3) || !!old?.swapP, callP: edg(1) || !!old?.callP };
        pad.prev[i] = b;
      }
    };
    const clearPadEdges = () => { for (const p of pad.inp) if (p) { p.actP = false; p.upP = false; p.formP = 0; p.swapP = false; p.callP = false; } };

    // ─────────────────────────────── loop
    let acc = 0, prev = performance.now(), raf = 0, lastMode = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - prev) / 1000); prev = now;
      pollPads();
      acc += dt; let n = 0;
      while (acc >= DT && n < 4) {
        const wasSi = G.si;
        step(frameInput());
        for (const k in edge) edge[k] = false; clearPadEdges();
        if (G.si !== wasSi) sc.updCam(0, true);
        acc -= DT; n++;
      }
      if (n >= 4) acc = 0;
      if (tickModes(dt)) { sc.updCam(0, true); const c = checkpoint(); if (c) writeCP(c); }
      if (G.mode === 'end' && G.endFull && readCP()) clearCP();
      if (G.mode !== 'play') { for (const k in edge) edge[k] = false; clearPadEdges(); tch.edge = {}; }
      for (const s of G.sfx) snd.sfx(s.id, s.n, s.delay); G.sfx.length = 0;
      snd.music(G.mode === 'title' ? 'title' : G.tune);
      tickFx(dt); sc.touch.mx = tch.mx; sc.touch.my = tch.my; sc.touch.btn = tch.btn;
      if (G.mode === 'title') sc.cp = readCP();
      if (G.mode !== 'title') sc.updCam(dt);
      sc.render();
      if (G.mode !== lastMode) { lastMode = G.mode; setMode(G.mode); }
    };
    raf = requestAnimationFrame(frame);

    (window as unknown as { __creature: () => unknown }).__creature = () => ({
      G, SCR, scene: sc, sound: snd, snap: snapshot(), loaded, mode: G.mode, opts, begin, toggle, setForm, swap, callPartner,
    });
    return () => {
      alive = false; cancelAnimationFrame(raf); snd.stop();
      removeEventListener('resize', fit); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
      cv.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <main className="ec-shell" data-mode={mode}>
      <canvas ref={cvRef} className="ec-canvas" aria-label="Every Creature play field" />
      {!ready && <div className="ec-loading">…</div>}
      {(mode === 'title' || mode === 'end') && <a className="ec-back" href="/">← Arcade</a>}
    </main>
  );
}
