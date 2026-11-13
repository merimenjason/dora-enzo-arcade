'use client';
// The Arcade After Dark, Chapter One: the page. The title (Play, or Continue from the hub with what was earned), the
// play field, pause and the settings. Input from keys, touch (a floating stick on the left, Jump / Act / Swap and later
// Gust on the right; on a phone held upright they sit in a panel under the play view, on its side in gutters left and
// right) and gamepads; the fixed-step loop; the save (`after-dark-v1`) and the sound. Rules in lib/afterdark-game.ts,
// drawing in lib/afterdark-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Game, type Input, type SaveData, NO_INPUT, DT, newGame, step, resume, warp, progressOf, freshSave, parseSave, SAVE_KEY, pearlsTotal,
} from '@/lib/afterdark-game';
import { AfterDarkScene, type Scheme, type TouchBtn } from '@/lib/afterdark-scene';
import { AfterDarkSound } from './sound';
import './after-dark.css';

type Screen = 'loading' | 'title' | 'play';
const ART = '/art/after-dark/';
type Act = 'L' | 'R' | 'U' | 'D' | 'jump' | 'e' | 'j' | 'k' | 'swap' | 'start' | 'pause' | 'mute';
const KEYMAP: Record<string, Act> = {
  ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
  Space: 'jump', KeyE: 'e', KeyJ: 'j', KeyK: 'k', ShiftLeft: 'swap', ShiftRight: 'swap', Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
};

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window: play on unsaved */ } }
const tm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function AfterDark() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<AfterDarkScene | null>(null);
  const gameRef = useRef<Game | null>(null);
  const soundRef = useRef<AfterDarkSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const S = useRef({ screen: 'loading' as Screen, paused: false, save: freshSave(), lastProgress: '' });
  S.current.screen = screen; S.current.paused = paused; S.current.save = save;

  const held = useRef<Record<string, boolean>>({});
  const press = useRef<Partial<Record<Act | 'act' | 'tjump' | 'tswap' | 'tgust', boolean>>>({});
  const pad = useRef({ prev: [] as boolean[] });

  const persist = useCallback((s: SaveData) => { S.current.save = s; setSave(s); writeSave(s); }, []);

  const start = useCallback((from: 'new' | 'continue', seed = Math.floor(Math.random() * 1e6) + 1) => {
    const s = S.current.save;
    const g = from === 'continue' && s.progress ? resume(s.progress, { seed, assist: s.assist }) : newGame({ seed, assist: s.assist });
    gameRef.current = g; S.current.lastProgress = '';
    if (from === 'new' && s.progress) persist({ ...s, progress: null });
    sceneRef.current!.camUpdate(g, 0, true);
    soundRef.current?.start(); setPaused(false); setScreen('play');
  }, [persist]);

  // ─────────────────────────────── boot: load the art, then the loop
  useEffect(() => {
    const cv = cvRef.current!, sc = new AfterDarkScene(cv); sceneRef.current = sc;
    const snd = new AfterDarkSound(); soundRef.current = snd;
    const s = readSave(); S.current.save = s; setSave(s); snd.sfxOn = s.sound; snd.musicOn = s.music;
    if (matchMedia('(pointer: coarse)').matches) sc.scheme = 'touch';
    const fit = () => { sc.layout(innerWidth, innerHeight, devicePixelRatio); setTick((n) => n + 1); };
    fit(); addEventListener('resize', fit);
    const setScheme = (m: Scheme) => { if (sc.scheme === m) return; const was = sc.scheme; sc.scheme = m; if ((was === 'touch') !== (m === 'touch')) fit(); setTick((n) => n + 1); };
    // the title shows the hub behind it
    gameRef.current = newGame({ assist: s.assist }); sc.camUpdate(gameRef.current, 0, true);
    let alive = true;
    sc.load(ART).then(() => { if (!alive) return; setScreen('title'); document.querySelector('main')?.setAttribute('data-ready', 'true'); });

    let acc = 0, prev = performance.now(), raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      pollPad();
      const g = gameRef.current, scr = S.current.screen;
      if (scr === 'play' && g && !S.current.paused) {
        acc += dt; let n = 0;
        while (acc >= DT && n < 6) {
          const inp = readInput();
          if (g.mode === 'end' && g.endT > 2.5 && (inp.startP || inp.jumpP || inp.eP || inp.actP)) { start('new'); return; }
          const wasEnd = g.mode === 'end';
          step(g, inp);
          for (const e of g.events) snd.sfx(e.id, e.v);
          g.events.length = 0;
          if (g.mode === 'end' && !wasEnd) finishRun(g);
          acc -= DT; n++;
        }
        if (n === 6) acc = 0;
        snd.play(g.tune);
        // the chapter so far is saved whenever the heroes stand in the hub between cabinets
        const p = progressOf(g);
        if (p) { const k = JSON.stringify({ ...p, playT: 0 }); if (k !== S.current.lastProgress) { S.current.lastProgress = k; persist({ ...S.current.save, progress: p }); } }
      } else {
        acc = 0;
        if (scr === 'title' && g) { g.time += dt; }
        snd.play(scr === 'title' ? 'hub' : scr === 'play' ? g?.tune ?? null : null);
      }
      if (g && scr !== 'loading') sc.draw(g, scr === 'play' && !S.current.paused ? dt : 0, { title: scr === 'title' });
      else { const cx = cv.getContext('2d')!; cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#0d0818'; cx.fillRect(0, 0, cv.width, cv.height); }
    };
    raf = requestAnimationFrame(frame);
    /** the end card: keep the best run, clear the chapter's checkpoint */
    const finishRun = (g: Game) => {
      const sv = S.current.save, t = g.stats.tHeal, pearls = g.stats.pearls;
      const best = !sv.best ? { time: t, pearls } : { time: Math.min(sv.best.time, t), pearls: Math.max(sv.best.pearls, pearls) };
      persist({ ...sv, best, progress: null, runs: sv.runs + 1 });
    };

    // keys
    const kd = (e: KeyboardEvent) => {
      const a = KEYMAP[e.code]; if (!a) return;
      e.preventDefault(); snd.start();
      if (a === 'mute') { toggle('sound'); return; }
      if (a === 'pause') { if (S.current.screen === 'play') setPaused((p) => !p); return; }
      if (e.code.startsWith('Arrow')) setScheme('arrows');
      else if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) setScheme('wasd');
      else if (sc.scheme === 'touch' || sc.scheme === 'pad') setScheme('arrows');
      if (S.current.screen === 'title' && (a === 'start' || a === 'jump' || a === 'e')) { start(S.current.save.progress ? 'continue' : 'new'); return; }
      if (!e.repeat && !held.current[e.code]) press.current[a] = true;
      held.current[e.code] = true; held.current[a] = true;
    };
    const ku = (e: KeyboardEvent) => {
      const a = KEYMAP[e.code]; if (!a) return;
      held.current[e.code] = false;
      held.current[a] = Object.keys(KEYMAP).some((c) => KEYMAP[c] === a && held.current[c]);
    };
    const blur = () => { held.current = {}; sc.stick = null; sc.held = {}; if (S.current.screen === 'play') setPaused(true); };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);

    // touch: a floating stick on the left half, the buttons on the right
    const ptr: Record<number, TouchBtn | 'stick'> = {};
    let stickId = -1;
    const pd = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || S.current.screen !== 'play' || S.current.paused) return;
      snd.start(); setScheme('touch');
      const x = e.clientX, y = e.clientY, b = sc.hitBtn(x, y);
      press.current.start = true;
      if (b) { ptr[e.pointerId] = b; sc.held[b] = true; press.current[b === 'jump' ? 'tjump' : b === 'act' ? 'act' : b === 'swap' ? 'tswap' : 'tgust'] = true; }
      else if (x < innerWidth * 0.5 && stickId < 0) { stickId = e.pointerId; ptr[e.pointerId] = 'stick'; sc.stick = { x0: x, y0: y, x, y }; }
      try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
      e.preventDefault();
    };
    const pm = (e: PointerEvent) => { if (e.pointerId === stickId && sc.stick) { sc.stick.x = e.clientX; sc.stick.y = e.clientY; e.preventDefault(); } };
    const pu = (e: PointerEvent) => {
      const w = ptr[e.pointerId]; delete ptr[e.pointerId];
      if (w === 'stick') { stickId = -1; sc.stick = null; } else if (w) sc.held[w] = false;
    };
    cv.addEventListener('pointerdown', pd); addEventListener('pointermove', pm, { passive: false }); addEventListener('pointerup', pu); addEventListener('pointercancel', pu);

    // gamepads: A jump, B interact, X ability, Y gust, a shoulder swaps, Start pauses; stick or d-pad to move (up jumps)
    const pollPad = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads).find((p) => p && p.connected); if (!gp) return;
      const b = gp.buttons.map((x) => x.pressed), pv = pad.current.prev, edge = (i: number) => b[i] && !pv[i];
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      if (b.some(Boolean) || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5) { setScheme('pad'); snd.start(); }
      if (sc.scheme === 'pad') {
        if (S.current.screen === 'title' && (edge(0) || edge(9))) start(S.current.save.progress ? 'continue' : 'new');
        if (edge(9) && S.current.screen === 'play') setPaused((p) => !p);
        if (edge(0)) press.current.jump = true;
        if (edge(1)) press.current.e = true;
        if (edge(2)) press.current.j = true;
        if (edge(3)) press.current.k = true;
        if (edge(4) || edge(5)) press.current.swap = true;
        const h = held.current;
        h.padL = ax < -0.45 || !!b[14]; h.padR = ax > 0.45 || !!b[15]; h.padD = ay > 0.45 || !!b[13];
        const up = ay < -0.45 || !!b[12]; if (up && !h.padU) press.current.U = true; h.padU = up; h.padJump = !!b[0];
      }
      pad.current.prev = b;
    };
    const readInput = (): Input => {
      const h = held.current, p = press.current;
      const I: Input = { ...NO_INPUT };
      I.mx = (h.R || h.padR ? 1 : 0) - (h.L || h.padL ? 1 : 0); I.my = (h.D || h.padD ? 1 : 0) - (h.U || h.padU ? 1 : 0);
      I.jumpH = !!(h.jump || h.U || h.padU || h.padJump || sc.held.jump); I.jumpP = !!(p.jump || p.U || p.tjump);
      I.eP = !!p.e; I.jP = !!p.j; I.kP = !!(p.k || p.tgust); I.swapP = !!(p.swap || p.tswap); I.actP = !!p.act;
      I.startP = !!(p.start || p.jump || p.e || p.tjump || p.act);
      const s = sc.stick;
      if (s) {
        const dx = s.x - s.x0, dy = s.y - s.y0, dead = 14 * sc.touchLayout().u;
        if (Math.abs(dx) > dead) I.mx = Math.sign(dx);
        if (Math.abs(dy) > dead * 1.3) I.my = Math.sign(dy);
      }
      press.current = {};
      return I;
    };

    (window as unknown as { __afterdark: () => unknown }).__afterdark = () => ({
      game: gameRef.current, scene: sc, screen: S.current.screen, paused: S.current.paused, save: S.current.save, scheme: sc.scheme,
      start: (from: 'new' | 'continue' = 'new', seed?: number) => start(from, seed), sound: snd,
      warp: (wid: Parameters<typeof warp>[1], x?: number, y?: number) => { const g = gameRef.current!; warp(g, wid, x, y); sc.camUpdate(g, 0, true); },
    });
    return () => {
      alive = false; cancelAnimationFrame(raf); snd.stop();
      removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
      cv.removeEventListener('pointerdown', pd); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); removeEventListener('pointercancel', pu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (k: 'assist' | 'sound' | 'music') => {
    const s = { ...S.current.save, [k]: !S.current.save[k] }; persist(s);
    const snd = soundRef.current!; snd.sfxOn = s.sound; snd.setMusic(s.music);
    if (k === 'assist' && gameRef.current) { gameRef.current.assist = s.assist; gameRef.current.hearts = 3; }
  };
  const settings = (
    <div className="ad-settings">
      <button className="ad-btn ad-small" onClick={() => toggle('assist')} aria-pressed={save.assist}>Assist: {save.assist ? 'on' : 'off'}</button>
      <button className="ad-btn ad-small" onClick={() => toggle('sound')} aria-pressed={save.sound}>Sound: {save.sound ? 'on' : 'off'}</button>
      <button className="ad-btn ad-small" onClick={() => toggle('music')} aria-pressed={save.music}>Music: {save.music ? 'on' : 'off'}</button>
    </div>
  );
  const controls = (
    <ul className="ad-controls">
      <li><b>Move</b> arrows or WASD · the stick · left stick or d-pad</li>
      <li><b>Jump</b> Space or ↑ · JUMP · A (hold to glide in the clouds; swim up underwater)</li>
      <li><b>Use</b> E: a cabinet, a door, a shrine · ACT · B</li>
      <li><b>Ability</b> J: Enzo’s ping, Dora’s sweep · ACT · X</li>
      <li><b>Gust</b> K, once earned · GUST · Y</li>
      <li><b>Swap</b> Shift · SWAP · a shoulder</li>
      <li><b>Pause</b> Esc or P · the pause button · Start · <b>Sound</b> M</li>
    </ul>
  );
  const g = gameRef.current;
  return (
    <main className="ad-shell" data-screen={screen}>
      <canvas ref={cvRef} className="ad-canvas" aria-label="The Arcade After Dark play field" />
      {screen === 'loading' && <div className="ad-loading">✦ ✦ ✦</div>}

      {screen === 'title' && (
        <div className="ad-title">
          <h1>The Arcade After Dark</h1>
          <p className="ad-sub">Chapter One · Dora &amp; Enzo hop into the cabinets</p>
          <div className="ad-row">
            {save.progress ? (
              <>
                <button className="ad-btn ad-big" autoFocus onClick={() => start('continue')}>Continue</button>
                <button className="ad-btn" onClick={() => start('new')}>New game</button>
              </>
            ) : <button className="ad-btn ad-big" autoFocus onClick={() => start('new')} aria-label="Play">▶ Play</button>}
          </div>
          {save.progress && <p className="ad-dim">Saved in the hub: {[save.progress.abil.ping && 'ping', save.progress.abil.sweep && 'sweep', save.progress.abil.gust && 'gust'].filter(Boolean).join(', ') || 'no abilities yet'} · {save.progress.pearls.length} pearls</p>}
          {save.best && <p className="ad-dim">Best: {tm(save.best.time)} · most pearls {save.best.pearls}/22</p>}
          {settings}
          {controls}
          <a className="ad-back" href="/">← Arcade</a>
        </div>
      )}

      {screen === 'play' && (
        <div className="ad-top" style={{ right: (sceneRef.current?.L.gutter ?? 0) + 12 }}>
          <button className="ad-pill" onClick={() => toggle('assist')} aria-pressed={save.assist}>{save.assist ? 'Assist on' : 'Assist off'}</button>
          <button className="ad-pill" onClick={() => toggle('sound')} aria-label="Sound" aria-pressed={save.sound}>{save.sound ? '♪ on' : '♪ off'}</button>
          <button className="ad-pill" aria-label="Pause" onClick={() => setPaused(true)}>II</button>
        </div>
      )}
      {screen === 'play' && paused && g && (
        <div className="ad-overlay">
          <div className="ad-card">
            <h2>Paused · {g.stats.pearls}/{pearlsTotal(g)} pearls · {tm(g.playT)}</h2>
            {settings}
            {controls}
            <div className="ad-row">
              <button className="ad-btn" autoFocus onClick={() => setPaused(false)}>Resume</button>
              <button className="ad-btn ad-small" onClick={() => start('new')}>Start over</button>
              <button className="ad-btn ad-small" onClick={() => { setPaused(false); setScreen('title'); }}>Title</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
