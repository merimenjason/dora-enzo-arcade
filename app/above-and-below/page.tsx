'use client';
// Above & Below, Chapter One: the page. The title over the live meadow, the play view with its HUD toggles, pause and
// the end card as HTML over the canvas. Input from keys (solo, or two players on one keyboard), touch (a floating stick
// and three buttons; on a phone held upright they sit under the play view) and gamepads (two pads in 2P), the
// fixed-step loop, the save (`above-and-below-v1`: the room checkpoint, assist, sound and the best time) and the sound.
// Rules in lib/above-game.ts, drawing in lib/above-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AboveGame, Keys, DT, NO_PAD, SAVE_KEY, ROOMS, freshSave, parseSave, type Pad, type SaveData } from '@/lib/above-game';
import { AboveScene, type Labels } from '@/lib/above-scene';
import { AboveSound } from './sound';
import './above.css';

type Screen = 'loading' | 'title' | 'play' | 'win';
const ART = '/art/above-and-below/';
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window: play on unsaved */ } }
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function AboveAndBelow() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AboveGame | null>(null);
  const sceneRef = useRef<AboveScene | null>(null);
  const soundRef = useRef<AboveSound | null>(null);
  const keysRef = useRef(new Keys());
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [paused, setPaused] = useState(false);
  const [twoP, setTwoPState] = useState(false);
  const [win, setWin] = useState<{ time: number; splits: [string, number][]; best: boolean; twoP: boolean } | null>(null);
  const [winReady, setWinReady] = useState(false);
  const [winShow, setWinShow] = useState(false);
  const S = useRef({ screen: 'loading' as Screen, paused: false, save: freshSave(), lab: { mode: 'keys', moveKeys: 'arrows' } as Labels });
  S.current.screen = screen; S.current.paused = paused; S.current.save = save;

  const persist = useCallback((s: SaveData) => { S.current.save = s; setSave(s); writeSave(s); }, []);
  const begin = useCallback((two: boolean, room = 0) => {
    const g = gameRef.current; if (!g) return;
    soundRef.current?.start();
    g.assist = S.current.save.assist;
    g.start(two, room);
    keysRef.current.clear(); keysRef.current.twoP = two; setTwoPState(two);
    setWin(null); setWinShow(false); setWinReady(false); setPaused(false); setScreen('play');
  }, []);
  const toTitle = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    g.reset(0); keysRef.current.clear(); setPaused(false); setWin(null); setScreen('title');
  }, []);
  const setTwo = useCallback((on: boolean) => {
    const g = gameRef.current; if (!g) return;
    g.setTwoP(on); keysRef.current.clear(); keysRef.current.twoP = on; setTwoPState(on);
  }, []);
  const toggle = useCallback((k: 'assist' | 'sound') => {
    const s = { ...S.current.save, [k]: !S.current.save[k] }; persist(s);
    if (gameRef.current) gameRef.current.assist = s.assist;
    if (soundRef.current) soundRef.current.on = s.sound;
  }, [persist]);
  const fns = useRef({ begin, toTitle, toggle, setTwo }); fns.current = { begin, toTitle, toggle, setTwo };

  useEffect(() => {
    const cv = cvRef.current!; const sc = new AboveScene(cv); sceneRef.current = sc;
    const snd = new AboveSound(); soundRef.current = snd;
    const s0 = readSave(); S.current.save = s0; setSave(s0); snd.on = s0.sound;
    const g = new AboveGame({ seed: Math.floor(Math.random() * 1e6) + 1, assist: s0.assist }); gameRef.current = g;
    const keys = keysRef.current;
    let touch = matchMedia('(pointer: coarse)').matches;
    if (touch) S.current.lab.mode = 'touch';
    const fit = () => sc.layout(innerWidth, innerHeight, devicePixelRatio, touch);
    fit(); addEventListener('resize', fit);
    let alive = true;
    sc.load(ART).then(() => { if (!alive) return; setScreen('title'); document.querySelector('main')?.setAttribute('data-ready', 'true'); });

    // touch: a floating stick on the left, jump / act / swap on the right
    const stick = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 };
    const tb = { jump: false, act: false, swap: false, jumpP: false, actP: false, swapP: false };
    const tbIds: Record<number, 'jump' | 'act' | 'swap'> = {};
    // gamepads: A jump, X or B act, Y or a shoulder swaps, Start pauses; stick or d-pad to move
    const padPrev: Record<number, Record<string, boolean>> = {};
    const gp: [Pad, Pad] = [{ ...NO_PAD }, { ...NO_PAD }];
    const pollPads = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[] : [];
      gp[0] = { ...NO_PAD, jumpP: gp[0].jumpP, actP: gp[0].actP, swapP: gp[0].swapP }; gp[1] = { ...NO_PAD, jumpP: gp[1].jumpP, actP: gp[1].actP, swapP: gp[1].swapP };
      pads.forEach((p, i) => {
        const slot = gp[keys.twoP && i === 1 ? 1 : 0], B = (n: number) => !!(p.buttons[n] && p.buttons[n].pressed);
        const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
        const st = { l: ax < -0.4 || B(14), r: ax > 0.4 || B(15), u: ay < -0.5 || B(12), d: ay > 0.5 || B(13), jump: B(0), act: B(2) || B(1), swap: B(3) || B(5) || B(4), start: B(9) };
        const pv = padPrev[p.index] || {};
        if (Object.values(st).some(Boolean)) { if (S.current.lab.mode !== 'pad') S.current.lab.mode = 'pad'; snd.start(); }
        if (st.start && !pv.start && S.current.screen === 'play') setPaused((x) => !x);
        if (S.current.screen === 'title' && st.jump && !pv.jump) fns.current.begin(false);
        slot.l ||= st.l; slot.r ||= st.r; slot.u ||= st.u; slot.d ||= st.d; slot.jump ||= st.jump; slot.act ||= st.act; slot.swap ||= st.swap;
        if (st.jump && !pv.jump) slot.jumpP = true; if (st.act && !pv.act) slot.actP = true; if (st.swap && !pv.swap) slot.swapP = true;
        padPrev[p.index] = st;
      });
    };
    const readInput = (): [Pad, Pad] => {
      const [k1, k2] = keys.take();
      const a = gp[0], b = gp[1];
      const p1: Pad = {
        l: k1.l || a.l || (stick.id >= 0 && stick.dx < -0.35), r: k1.r || a.r || (stick.id >= 0 && stick.dx > 0.35),
        u: k1.u || a.u || (stick.id >= 0 && stick.dy < -0.5), d: k1.d || a.d || (stick.id >= 0 && stick.dy > 0.55),
        jump: k1.jump || a.jump || tb.jump, act: k1.act || a.act || tb.act, swap: k1.swap || a.swap || tb.swap,
        jumpP: k1.jumpP || a.jumpP || tb.jumpP, actP: k1.actP || a.actP || tb.actP, swapP: k1.swapP || a.swapP || tb.swapP,
      };
      const p2: Pad = { l: k2.l || b.l, r: k2.r || b.r, u: k2.u || b.u, d: k2.d || b.d, jump: k2.jump || b.jump, act: k2.act || b.act, swap: false,
        jumpP: k2.jumpP || b.jumpP, actP: k2.actP || b.actP, swapP: false };
      tb.jumpP = tb.actP = tb.swapP = false; a.jumpP = a.actP = a.swapP = false; b.jumpP = b.actP = b.swapP = false;
      return [p1, p2];
    };

    let acc = 0, prev = performance.now(), raf = 0, lastMode = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      pollPads();
      const scr = S.current.screen;
      if (scr !== 'loading' && !(scr === 'play' && S.current.paused)) {
        acc += dt; let n = 0;
        while (acc >= DT && n < 6) {
          const [p1, p2] = readInput();
          g.step(p1, p2);
          if (g.events.length) {
            for (const e of g.events) {
              if (e.k === 'sfx') snd.sfx(e.id, e.a);
              else if (e.k === 'room' && g.mode === 'play') persist({ ...S.current.save, ck: e.i });
              else if (e.k === 'win') {
                const best = S.current.save.best == null || g.clearT < S.current.save.best;
                persist({ ...S.current.save, ck: 0, best: best ? +g.clearT.toFixed(1) : S.current.save.best });
                let p = 0; const splits = g.stats.rooms.map(([id, t]): [string, number] => { const d = t - p; p = t; return [id, d]; });
                setWin({ time: g.clearT, splits, best, twoP: g.twoP });
              }
            }
            sc.take(g.events); g.events.length = 0;
          }
          acc -= DT; n++;
        }
        if (acc > DT * 6) acc = 0;
      } else acc = 0;
      if (g.mode !== lastMode) { lastMode = g.mode; if (g.mode === 'win') setScreen('win'); }
      if (g.mode === 'win') { if (g.winT > 0.8) setWinShow(true); if (g.winT > 1.5) setWinReady(true); }
      sc.held = { jump: tb.jump, act: tb.act, swap: tb.swap };
      sc.knob = { on: stick.id >= 0, dx: stick.dx, dy: stick.dy };
      if (scr !== 'loading') sc.draw(g, dt, S.current.lab);
    };
    raf = requestAnimationFrame(frame);

    const kd = (e: KeyboardEvent) => {
      snd.start();
      if (S.current.lab.mode !== 'keys') { S.current.lab.mode = 'keys'; if (touch) { touch = false; fit(); } }
      const scr = S.current.screen;
      if (scr === 'title') {
        const ck = S.current.save.ck;
        if (e.code === 'Digit2') { e.preventDefault(); fns.current.begin(true); }
        else if (e.code === 'KeyC' && ck > 0) { e.preventDefault(); fns.current.begin(false, ck); }
        else if (['Enter', 'Space', 'KeyE', 'Digit1'].includes(e.code) || MOVE_KEYS.has(e.code)) { e.preventDefault(); fns.current.begin(false); }
        return;
      }
      if (scr === 'win') {
        if (['Enter', 'Space', 'KeyE', 'KeyR'].includes(e.code)) { e.preventDefault(); if (g.winT > 1.5) fns.current.begin(g.twoP, 0); }
        return;
      }
      if (scr !== 'play') return;
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); setPaused((p) => !p); return; }
      if (S.current.paused) return;
      if (e.code === 'KeyR' && e.shiftKey) { e.preventDefault(); fns.current.begin(g.twoP, g.idx); return; }   // restart this room
      if (e.code === 'KeyM') { fns.current.toggle('sound'); return; }
      if (!g.twoP && MOVE_KEYS.has(e.code)) S.current.lab.moveKeys = e.code.startsWith('Arrow') ? 'arrows' : 'wasd';
      if (e.repeat) { if (keys.held.has(e.code)) e.preventDefault(); return; }
      if (keys.down(e.code)) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { keys.up(e.code); };
    const blur = () => { keys.clear(); stick.id = -1; tb.jump = tb.act = tb.swap = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);

    const pd = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      snd.start();
      if (!touch) { touch = true; fit(); }
      S.current.lab.mode = 'touch';
      if (S.current.screen !== 'play' || S.current.paused) return;
      const k = sc.hitPad(e.clientX, e.clientY);
      if (!k) return;
      e.preventDefault();
      if (k === 'stick') { if (stick.id < 0) Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }); return; }
      if (k === 'swap' && g.twoP) return;
      tbIds[e.pointerId] = k; tb[k] = true; tb[`${k}P`] = true;
    };
    const pm = (e: PointerEvent) => {
      if (e.pointerId !== stick.id) return;
      const r = sc.L.pad.stick?.r ?? 50; let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0; const d = Math.hypot(dx, dy);
      if (d > r) { stick.x0 += dx * (1 - r / d); stick.y0 += dy * (1 - r / d); dx = e.clientX - stick.x0; dy = e.clientY - stick.y0; }
      stick.dx = dx / r; stick.dy = dy / r; e.preventDefault();
    };
    const pu = (e: PointerEvent) => {
      if (e.pointerId === stick.id) { stick.id = -1; stick.dx = stick.dy = 0; }
      const k = tbIds[e.pointerId]; if (k) { tb[k] = false; delete tbIds[e.pointerId]; }
    };
    cv.addEventListener('pointerdown', pd); addEventListener('pointermove', pm, { passive: false }); addEventListener('pointerup', pu); addEventListener('pointercancel', pu);

    (window as unknown as { __above: () => unknown }).__above = () => ({
      game: g, scene: sc, screen: S.current.screen, paused: S.current.paused, save: S.current.save, labels: S.current.lab, keys,
      start: (two: boolean, room = 0) => fns.current.begin(two, room),
    });
    return () => {
      alive = false; cancelAnimationFrame(raf); snd.stop();
      removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
      cv.removeEventListener('pointerdown', pd); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); removeEventListener('pointercancel', pu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ck = save.ck;
  const settings = (
    <div className="ab-row">
      <button className="ab-btn ab-small" onClick={() => toggle('assist')} aria-pressed={save.assist}>Assist: {save.assist ? 'on' : 'off'}</button>
      <button className="ab-btn ab-small" onClick={() => toggle('sound')} aria-pressed={save.sound}>Sound: {save.sound ? 'on' : 'off'}</button>
    </div>
  );
  const controls = (
    <ul className="ab-controls">
      <li><b>Move</b> arrows or WASD · the stick · left stick or d-pad</li>
      <li><b>Jump</b> Space · the arrow button · A</li>
      <li><b>Act</b> E or Enter · the star button · X or B (Dora pulls, stamps and holds levers; Enzo digs, heaves, holds and pours)</li>
      <li><b>Hold</b> keep Act held to brace (hold a root up, pull a rope, keep a lever down)</li>
      <li><b>Swap</b> Shift or Q · the face button · Y or a shoulder. Swap while holding and the hero keeps bracing a few seconds alone</li>
      <li><b>Climb, duck, hide</b> up and down</li>
      <li><b>Two players</b> Dora: WASD, Space, E · Enzo: arrows, /, . (or one gamepad each)</li>
      <li><b>Restart the room</b> Shift + R · <b>Sound</b> M · <b>Pause</b> Esc or P · Start</li>
    </ul>
  );
  const g = gameRef.current;
  return (
    <main className="ab-shell" data-screen={screen}>
      <canvas ref={cvRef} className="ab-canvas" aria-label="Above & Below play field" />
      {screen === 'loading' && <div className="ab-loading">✦ ✦ ✦</div>}

      {screen === 'title' && (
        <div className="ab-title">
          <h1>Above &amp; Below</h1>
          <p className="ab-sub">Chapter One · The Valley</p>
          <div className="ab-row ab-start">
            <button className="ab-btn ab-big" onClick={() => begin(false)}>1 Player</button>
            <button className="ab-btn ab-big ab-alt" onClick={() => begin(true)}>2 Players</button>
          </div>
          {ck > 0 && <button className="ab-btn" onClick={() => begin(false, ck)}>Continue · {ROOMS[ck].name}</button>}
          <p className="ab-keys"><kbd>←→</kbd><kbd>Space</kbd><kbd>E</kbd><kbd>Shift</kbd> move · jump · act · swap</p>
          {settings}
          {save.best != null && <p className="ab-dim">Best chapter time {fmt(save.best)}</p>}
          <a className="ab-back" href="/">← Arcade</a>
        </div>
      )}

      {screen === 'play' && (
        <div className="ab-hud">
          <button className="ab-chip" aria-pressed={save.sound} aria-label="Sound" onClick={() => toggle('sound')}>{save.sound ? '♪' : '·'}</button>
          <button className="ab-chip" aria-pressed={save.assist} aria-label="Assist" onClick={() => toggle('assist')}>✦</button>
          <button className="ab-chip ab-wide" aria-pressed={twoP} aria-label="Two players" onClick={() => setTwo(!twoP)}>{twoP ? '2P' : '1P'}</button>
          <button className="ab-chip" aria-label="Pause" onClick={() => setPaused(true)}>II</button>
        </div>
      )}
      {screen === 'play' && paused && g && (
        <div className="ab-overlay">
          <div className="ab-card">
            <h2>Paused · {g.room.name}</h2>
            {settings}
            {controls}
            <div className="ab-row">
              <button className="ab-btn" autoFocus onClick={() => setPaused(false)}>Resume</button>
              <button className="ab-btn ab-small" onClick={() => begin(g.twoP, g.idx)}>Restart room</button>
              <button className="ab-btn ab-small" onClick={toTitle}>Title</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'win' && win && winShow && (
        <div className="ab-overlay ab-clear">
          <div className="ab-card ab-win">
            <h2>Together!</h2>
            <p>Old Grubber is fast asleep</p>
            <p className="ab-time">{fmt(+win.time.toFixed(1))}{win.best && <small> best!</small>}</p>
            <ol className="ab-splits">
              {win.splits.map(([id, t]) => <li key={id}><span>{ROOMS.find((r) => r.id === id)?.name ?? id}</span><b>{fmt(t)}</b></li>)}
            </ol>
            {winReady && (
              <div className="ab-row">
                <button className="ab-btn" onClick={() => begin(win.twoP, 0)}>Play again</button>
                <button className="ab-btn ab-small" onClick={toTitle}>Title</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
