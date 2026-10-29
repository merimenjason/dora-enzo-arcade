'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RopeclimbGame, SECTIONS, SECTION_IDS, ACORN_COUNT, TUB_COUNT, TOP_Y, FLOOR_H, DT, SAVE_KEY, MEDALS,
  readSave, freshSave, climbSave, resume, recordFinish, hardOpen, medalFor, clockText, idleInput, idlePad, other,
  type Save, type Ev, type Who, type Pad, type Input, type SectionId,
} from '@/lib/ropeclimb-game';
import type { RopeclimbScene } from '@/lib/ropeclimb-scene';
import { RopeclimbSound } from './sound';
import './ropeclimb.css';

type Screen = 'menu' | 'play';
type Toast = { id: number; text: string; until: number };
const sceneModule = () => import('@/lib/ropeclimb-scene');
const NAME: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo' };
/** Keys we hold down (and keep the page from scrolling with). */
const GAME_KEYS = new Set(['a', 'd', 'w', 's', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'enter', 'shift', 'j', 'k']);
/** A tip for each floor of a first climb. */
const TIPS: string[] = [
  'Hold to charge, aim with ←/→, and let go to leap. Your partner holds on below while you climb.',
  'Straw ledges crumble a moment after you land. Keep moving, and they grow back.',
  'Hay bales slide along the beams: ride on top, but don’t let one shove you off a post.',
  'Missed a leap? The rope catches you. Steer to swing, and grab a post with your claws.',
  'Dust puffs from a knothole mean a gust is coming. Stay gripped while it blows.',
  'Dangling? Swap to your partner and hold ↑ to haul the rope in.',
  'Watch the lanterns swing, and leap when one has passed.',
  'Shh: an owl. Small hops and soft landings are quiet. If she stirs, hold on tight!',
  'Land softly on the bell, or don’t land on it at all. Owls hate the bell.',
  'Louvre gusts and crumbling straw: one climber grips while the other moves.',
  'Out on the roof! The wind is stronger up here.',
  'Nearly there: both of you onto the ridge by the weathervane.',
];
const CAST: [string, string][] = [['Dora', 'leaper of great leaps'], ['Enzo', 'holder of the rope'], ['The barn owls', 'asleep, mostly'], ['The bell', 'very loud'], ['The weathervane', 'pointing east, to the sunrise']];

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className }: { src: string; paint: 'title' | 'ending'; w: number; h: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else m.paintEnding(c); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'rc-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}

export default function RopeclimbPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<RopeclimbScene | null>(null), sound = useRef<RopeclimbSound | null>(null);
  const game = useRef<RopeclimbGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), endingRef = useRef(false);
  const keys = useRef(new Set<string>()), swapQueued = useRef(false), touchPad = useRef<Pad>(idlePad()), letGo = useRef(false), toastId = useRef(0);
  const padSwapHeld = useRef([false, false]), padPauseHeld = useRef([false, false]);
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]), [banner, setBanner] = useState<{ id: number; sec: SectionId } | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState(''), [touch, setTouch] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false), [records, setRecords] = useState<{ fastest: boolean; fewest: boolean } | null>(null), [tip, setTip] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const touchRef = useRef(false); touchRef.current = touch;
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new RopeclimbSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const toast = (text: string, ms = 3200) => { const id = ++toastId.current; setToasts((t) => [...t.slice(-2), { id, text, until: performance.now() + ms }]); };
  const releaseAll = () => { keys.current.clear(); touchPad.current = idlePad(); letGo.current = false; swapQueued.current = false; };

  /** Starts a climb: the saved one at its tub, or a fresh one from the cellar floor. */
  function start(o: { fresh?: boolean; hard?: boolean; seed?: number; tub?: number } = {}) {
    audio().ui();
    const seed = o.seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
    const s = save.current;
    let g: RopeclimbGame;
    if (!o.fresh && !o.hard && s.climb) g = resume(s.climb, seed);
    else g = new RopeclimbGame({ seed, players: s.players, hard: !!o.hard, found: s.acorns, tub: o.tub ?? 0 });
    if (o.fresh && !o.hard) { s.climb = climbSave(g); persist(); }
    game.current = g; pausedRef.current = false; setPaused(false); endingRef.current = false; setEnding(false); setRecords(null);
    releaseAll(); setConfirmNew(false); setToasts([]);
    scene.current?.snap(g);
    setBanner({ id: Date.now(), sec: g.section });
    setTip(s.finished === 0 && !g.hard ? g.tub : null);
    sound.current?.music(g.section);
    setScreen('play'); refresh();
    requestAnimationFrame(() => canvas.current?.focus());
  }
  function toMenu() { persist(); pausedRef.current = false; setPaused(false); game.current = null; endingRef.current = false; setEnding(false); setScreen('menu'); setConfirmNew(false); sound.current?.music(null); refresh(); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || endingRef.current) return;
    pausedRef.current = on; setPaused(on); releaseAll();
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }
  /** Notices what the game did: sounds, juice, toasts, saving and the ending. */
  function handle(events: Ev[], g: RopeclimbGame) {
    scene.current?.feed(events, g); sound.current?.play(events);
    for (const e of events) {
      switch (e.k) {
        case 'acorn': {
          const s = save.current; if (!s.acorns.includes(e.id)) { s.acorns.push(e.id); s.acorns.sort((a, b) => a - b); }
          if (s.climb) s.climb.found = [...g.found].sort((a, b) => a - b);
          persist(); toast(`🌰 An acorn charm! ${s.acorns.length} of ${ACORN_COUNT}`); refresh(); break;
        }
        case 'checkpoint': { const c = climbSave(g); if (c) { save.current.climb = c; persist(); } toast('🛁 A dust bath! The climb is saved here.'); if (save.current.finished === 0 && !g.hard) setTip(e.id); refresh(); break; }
        case 'tub': if (g.hard) toast('🛁 The tubs are dry on Hard Knot: no saving!'); break;
        case 'section': setBanner({ id: Date.now(), sec: e.id }); sound.current?.music(e.id); break;
        case 'stir': toast('🦉 The owl stirs… quiet paws!', 2200); break;
        case 'hoot': toast('🦉 Hoo! Hold on tight!', 2000); break;
        case 'slip': toast(`😣 ${NAME[e.who]}’s claws slipped!`, 2200); break;
        case 'strain': toast(`💪 ${NAME[e.who]} can’t hold on for long: haul ↑ or find a grip!`, 2600); break;
        case 'fall': refresh(); break;
        case 'won': {
          endingRef.current = true; setEnding(true);
          const r = recordFinish(save.current, g); setRecords(r); persist();
          sound.current?.music('rooftop', true); refresh(); break;
        }
        default: break;
      }
    }
  }

  /** This tick's controls, from the keyboard, the touch buttons and any gamepads. */
  function readInput(g: RopeclimbGame): Input {
    const k = keys.current, auto = save.current.settings.autoGrip, inp = idleInput();
    const two = g.players === 2;
    const pick = (left: string[], right: string[], up: string[], down: string[], jump: string[]) => {
      const p = idlePad();
      p.x = (right.some((x) => k.has(x)) ? 1 : 0) - (left.some((x) => k.has(x)) ? 1 : 0);
      p.up = up.some((x) => k.has(x)); p.jump = jump.some((x) => k.has(x));
      const held = (two ? down : [...down, 'shift']).some((x) => k.has(x));
      p.grip = auto ? !held : held;
      return p;
    };
    if (two) {
      inp.dora = pick(['a'], ['d'], ['w'], ['s'], [' ']);
      inp.enzo = pick(['arrowleft'], ['arrowright'], ['arrowup'], ['arrowdown'], ['enter']);
    } else {
      const p = pick(['a', 'arrowleft'], ['d', 'arrowright'], ['w', 'arrowup'], ['s', 'arrowdown'], [' ', 'enter', 'j']);
      // the touch buttons add to the keys
      const t = touchPad.current;
      if (t.x) p.x = t.x; if (t.up) p.up = true; if (t.jump) p.jump = true;
      if (touchRef.current) p.grip = auto ? !letGo.current : t.grip;
      inp[g.active] = p;
    }
    // gamepads: the first steers Dora (or whoever is active in 1 player), the second Enzo
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter((x): x is Gamepad => !!x) : [];
    pads.slice(0, 2).forEach((gp, i) => {
      const who: Who = two ? (i === 0 ? 'dora' : 'enzo') : g.active, b = (n: number) => !!gp.buttons[n]?.pressed;
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      const x = Math.abs(ax) > 0.25 ? ax : (b(15) ? 1 : 0) - (b(14) ? 1 : 0), held = b(1) || b(6) || b(7);
      if (!x && !b(0) && !held && !b(12) && ay > -0.5 && !(Math.abs(ax) > 0.25)) { /* idle pad: leave the keyboard alone */ }
      else {
        const p = inp[who];
        if (x) p.x = x; if (b(0)) p.jump = true; if (b(12) || ay < -0.6) p.up = true;
        if (held) p.grip = !auto;
      }
      const swap = b(3) || b(4) || b(5);
      if (swap && !padSwapHeld.current[i] && !two) swapQueued.current = true;
      padSwapHeld.current[i] = swap;
      const ps = b(9);
      if (ps && !padPauseHeld.current[i]) pause(!pausedRef.current);
      padPauseHeld.current[i] = ps;
    });
    if (swapQueued.current) { inp.swap = true; swapQueued.current = false; }
    return inp;
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setTouch(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    setMounted(true); refresh();
    const w = window as unknown as { __ropeclimb: () => RopeclimbGame | null; __ropeclimbStart: (o?: { seed?: number; fresh?: boolean; hard?: boolean; tub?: number }) => void };
    w.__ropeclimb = () => game.current;
    w.__ropeclimbStart = (o) => start({ fresh: true, ...(o ?? {}) });
    let dead = false, raf = 0, last = 0, acc = 0, ui = 0;
    const resize = () => scene.current?.resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.RopeclimbScene(canvas.current); } catch { setError('This browser cannot draw the barn.'); return; }
      scene.current.setShake(save.current.settings.shake);
      ro?.observe(canvas.current); window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        // a long gap (a hidden tab, a stall) never turns into a jump: at most a tenth of a second is caught up
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, playing = screenRef.current === 'play' && !!g;
        const frozen = !playing || pausedRef.current || endingRef.current;
        let alpha = 1;
        if (playing && !frozen) {
          acc += dt; let n = 0;
          while (acc >= DT && n < 6) {
            acc -= DT; n++;
            g.step(readInput(g));
            const ev = g.events.splice(0); if (ev.length) handle(ev, g);
            if (pausedRef.current || endingRef.current) { acc = 0; break; }
          }
          if (n >= 6) acc = 0;
          alpha = Math.max(0, Math.min(1, acc / DT));
          const me = g.c(g.active); if (me.charging) sound.current?.charge(me.charge);
        } else {
          acc = 0;
          if (g && g.events.length) handle(g.events.splice(0), g);
        }
        sc.draw(playing ? g : null, { dt, alpha, paused: playing && pausedRef.current, showActive: !!g && g.players === 1, aimGuide: !!g && g.players === 1 });
        sound.current?.tick(playing && !pausedRef.current);
        if (ms - ui > 200) {
          ui = ms;
          setToasts((t) => (t.length && t[0].until < performance.now() ? t.filter((x) => x.until > performance.now()) : t));
          if (playing && !frozen) refresh();
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The barn could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current, tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !g || endingRef.current) return;
      const onControl = !!tgt.closest?.('button, a');
      if (k === 'escape' || k === 'p') { if (!e.repeat) { e.preventDefault(); pause(!pausedRef.current); } return; }
      if (pausedRef.current) return;
      if ((k === 'tab' || k === 'q' || k === 'e') && g.players === 1) { e.preventDefault(); if (!e.repeat) swapQueued.current = true; audio(); return; }
      if (GAME_KEYS.has(k)) {
        if ((k === ' ' || k === 'enter') && onControl) return;
        if (!e.repeat) keys.current.add(k);
        if (k.startsWith('arrow') || k === ' ' || k === 'enter') e.preventDefault();
        audio();
      }
    };
    const keyup = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); if (e.key === 'Shift') keys.current.delete('shift'); };
    const blur = () => { releaseAll(); pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the banner and the tip fade on their own
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 2800); return () => clearTimeout(t); }, [banner]);

  // touch: hold buttons; a finger that slides off keeps its button until it lifts
  const capture = (e: React.PointerEvent) => { try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ } };
  const hold = (key: 'left' | 'right' | 'jump' | 'up' | 'grip', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); if (on) { audio(); capture(e); }
    const t = touchPad.current;
    if (key === 'left') t.x = on ? -1 : t.x === -1 ? 0 : t.x; else if (key === 'right') t.x = on ? 1 : t.x === 1 ? 0 : t.x;
    else if (key === 'jump') t.jump = on; else if (key === 'up') t.up = on;
    else if (save.current.settings.autoGrip) letGo.current = on; else t.grip = on;
  };
  const tapSwap = (e: React.PointerEvent) => { e.preventDefault(); audio(); swapQueued.current = true; };

  const toggle = (k: 'sound' | 'music' | 'shake' | 'autoGrip') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); if (k === 'music') a.setMusic(S.settings.music);
    if (k === 'shake') scene.current?.setShake(S.settings.shake);
    a.ui(); refresh();
  };
  const setPlayers = (n: 1 | 2) => { S.players = n; persist(); audio().ui(); refresh(); };
  const settings = (
    <span className="rc-chips">
      <button className="rc-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="rc-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎻 Music' : '🎻 Off'}</button>
      <button className="rc-chip" aria-pressed={S.settings.shake} onClick={() => toggle('shake')}>{S.settings.shake ? '📳 Shake' : '📳 Still'}</button>
      <button className="rc-chip" aria-pressed={S.settings.autoGrip} onClick={() => toggle('autoGrip')} title="Auto claws: you grip whatever you touch, and hold ↓ to let go. Off: hold ↓ (or Shift) to grip.">{S.settings.autoGrip ? '🐾 Auto claws' : '🐾 Hold to grip'}</button>
    </span>
  );

  const g = game.current, climb = mounted ? S.climb : null, phase = g?.phase ?? 'none';
  const progress = g ? Math.max(0, Math.min(1, g.height / TOP_Y)) : 0;
  const gripWord = S.settings.autoGrip ? 'let go' : 'grip';
  const medal = g && ending ? medalFor(g.stats.falls) : null;
  const best = mounted ? S.best.normal : null, fewest = mounted ? S.fewest.normal : null;
  const keysLine = (two: boolean) => two
    ? <><b>Dora:</b> <kbd>A</kbd><kbd>D</kbd> aim · <kbd>Space</kbd> leap · <kbd>S</kbd> {gripWord} · <kbd>W</kbd> haul &nbsp; <b>Enzo:</b> <kbd>←</kbd><kbd>→</kbd> aim · <kbd>Enter</kbd> leap · <kbd>↓</kbd> {gripWord} · <kbd>↑</kbd> haul</>
    : <><kbd>←</kbd><kbd>→</kbd> aim and walk · hold <kbd>Space</kbd> to charge, let go to leap · <kbd>↓</kbd>/<kbd>Shift</kbd> {gripWord} · <kbd>↑</kbd> haul or climb a post · <kbd>Tab</kbd>/<kbd>Q</kbd> swap · <kbd>Esc</kbd> pause</>;

  return (
    <main className="rc-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={phase}>
      {screen === 'play' && g && (
        <header className="rc-bar">
          <a href="/" className="rc-back">← ARCADE</a>
          <span className="rc-bar-mid">
            <b>{SECTIONS[g.section].name}</b>
            <span className="rc-stat" title="Climb time">⏱ {g.clock}</span>
            <span className="rc-stat" title="Falls">🍂 {g.stats.falls}</span>
            <span className="rc-stat" title="Acorn charms found">🌰 {g.found.size}/{ACORN_COUNT}</span>
            {g.hard && <span className="rc-stat rc-hard">🪢 Hard Knot</span>}
          </span>
          <span className="rc-chips">
            <button className="rc-chip" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={ending}>❚❚</button>
            <button className="rc-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')} aria-label="Sound">{S.settings.sound ? '🔊' : '🔇'}</button>
          </span>
        </header>
      )}
      <div className="rc-stage">
        <canvas ref={canvas} className="rc-canvas" tabIndex={0} aria-label="The barn tower. Hold Space to charge a leap and let go to spring, aim with the arrow keys, Down lets go, Up hauls the rope, Tab swaps climbers and Esc pauses." />
        {screen === 'play' && g && (<>
          <div className="rc-tower" aria-hidden="true">
            {SECTION_IDS.map((id) => <i key={id} style={{ bottom: `${SECTIONS[id].y0 / TOP_Y * 100}%`, height: `${(SECTIONS[id].y1 - SECTIONS[id].y0) / TOP_Y * 100}%` }} className={'rc-tw-' + id} />)}
            {Array.from({ length: TUB_COUNT }, (_, i) => <s key={i} style={{ bottom: `${i * FLOOR_H / TOP_Y * 100}%` }} className={i <= g.tub && !g.hard ? 'is-on' : ''} />)}
            <u style={{ bottom: `${progress * 100}%` }} />
          </div>
          {g.players === 1 && <div className={'rc-who is-' + g.active}>{g.active === 'dora' ? '🤍 Dora' : '🩶 Enzo'}<small>{touch ? 'tap ⇄ to swap' : 'Tab to swap'}</small></div>}
          {banner && <div key={banner.id} className="rc-banner"><small>{SECTION_IDS.indexOf(banner.sec) + 1} of 6</small><b>{SECTIONS[banner.sec].name}</b><span>{SECTIONS[banner.sec].hazard}</span></div>}
          {tip !== null && tip < TIPS.length && !paused && !ending && <button className="rc-tip" onClick={() => setTip(null)}>💡 {touch ? TIPS[tip].replace('←/→', '◀ ▶').replace('↑', '▲') : TIPS[tip]} <small>✕</small></button>}
          {touch && g.players === 1 && !paused && !ending && (
            <div className="rc-touch">
              <div className="rc-tl">
                <button className="rc-tb" onPointerDown={hold('left', true)} onPointerUp={hold('left', false)} onPointerCancel={hold('left', false)} onLostPointerCapture={hold('left', false)} aria-label="Left">◀</button>
                <button className="rc-tb" onPointerDown={hold('right', true)} onPointerUp={hold('right', false)} onPointerCancel={hold('right', false)} onLostPointerCapture={hold('right', false)} aria-label="Right">▶</button>
              </div>
              <div className="rc-tr">
                <button className="rc-tb rc-small" onPointerDown={tapSwap} aria-label="Swap">⇄<small>swap</small></button>
                <button className="rc-tb rc-small" onPointerDown={hold('up', true)} onPointerUp={hold('up', false)} onPointerCancel={hold('up', false)} onLostPointerCapture={hold('up', false)} aria-label="Haul">▲<small>haul</small></button>
                <button className="rc-tb rc-small" onPointerDown={hold('grip', true)} onPointerUp={hold('grip', false)} onPointerCancel={hold('grip', false)} onLostPointerCapture={hold('grip', false)} aria-label={S.settings.autoGrip ? 'Let go' : 'Grip'}>🐾<small>{S.settings.autoGrip ? 'let go' : 'grip'}</small></button>
                <button className="rc-tb rc-jump" onPointerDown={hold('jump', true)} onPointerUp={hold('jump', false)} onPointerCancel={hold('jump', false)} onLostPointerCapture={hold('jump', false)} aria-label="Leap">⤴<small>hold · leap</small></button>
              </div>
            </div>
          )}
        </>)}
        <div className="rc-toasts" aria-live="polite">{toasts.map((t) => <p key={t.id} className="rc-toast">{t.text}</p>)}</div>
      </div>
      {error && <div className="rc-panel rc-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="rc-menu" aria-label="Ropeclimb">
          <header className="rc-head"><a href="/" className="rc-back">← ARCADE</a>{settings}</header>
          <div className="rc-hero">
            <Art src="/art/ropeclimb/title.webp" paint="title" w={1536} h={1024} className="rc-hero-art" />
            <div><p className="rc-eyebrow">A SPRINGY CLIMB FOR TWO, TIED TOGETHER</p><h1>Rope<em>climb</em></h1>
              <p className="rc-lede">Dora and Enzo are tied together by a short, stretchy rope, and the weathervane on top of the old barn tower catches the first light of dawn. Leap, grip, swing and haul, one paw at a time, from the cellar to the roof.</p></div>
          </div>
          <div className="rc-mode" role="radiogroup" aria-label="Players">
            <button role="radio" aria-checked={S.players === 1} className={S.players === 1 ? 'is-on' : ''} onClick={() => setPlayers(1)}>🧑 1 player<small>Steer one, swap to the other</small></button>
            <button role="radio" aria-checked={S.players === 2} className={S.players === 2 ? 'is-on' : ''} onClick={() => setPlayers(2)}>🧑‍🤝‍🧑 2 players<small>One keyboard, or two gamepads</small></button>
          </div>
          <div className="rc-go-row">
            {climb ? (<>
              <button className="rc-go" disabled={!ready} onClick={() => start()}>{ready ? 'CONTINUE THE CLIMB →' : 'Coiling the rope…'}<small>{SECTIONS[SECTION_IDS[Math.floor(climb.tub / 2)]].name} · tub {climb.tub + 1} of {TUB_COUNT} · ⏱ {clockText(climb.stats.ticks)} · 🍂 {climb.stats.falls} falls</small></button>
              {!confirmNew ? <button className="rc-alt" disabled={!ready} onClick={() => { audio().ui(); setConfirmNew(true); }}>New climb</button>
                : <button className="rc-alt is-warn" onClick={() => start({ fresh: true })}>Start from the cellar? Your climb will be replaced. Tap again.</button>}
            </>) : <button className="rc-go" disabled={!ready} onClick={() => start({ fresh: true })}>{ready ? 'START CLIMBING →' : 'Coiling the rope…'}</button>}
            {mounted && hardOpen(S) && <button className="rc-alt rc-hardbtn" disabled={!ready} onClick={() => start({ hard: true })}>🪢 Hard Knot<small>Shorter rope, no dust-bath saves, no hay nets</small></button>}
          </div>
          {mounted && (
            <div className="rc-records">
              <span>🌰 <b>{S.acorns.length}</b>/{ACORN_COUNT} acorn charms</span>
              <span>🏁 climbed <b>{S.finished}</b>{S.finished === 1 ? ' time' : ' times'}</span>
              {best && <span>⏱ best <b>{clockText(best.ticks)}</b></span>}
              {fewest !== null && <span>{medalFor(fewest) ? `🏅 ${medalFor(fewest)!.name}` : '🍂'} fewest falls <b>{fewest}</b></span>}
              {S.best.hard && <span>🪢 Hard Knot <b>{clockText(S.best.hard.ticks)}</b></span>}
              {!hardOpen(S) && <span className="rc-lock">🔒 Hard Knot opens after your first climb</span>}
            </div>
          )}
          <ol className="rc-how" aria-label="How to climb">
            <li><b>⤴ Charge and leap.</b> Hold to crouch and charge, aim with left or right, and let go to spring. A full charge leaps eight times your height.</li>
            <li><b>🐾 Grip.</b> Claws catch posts, hay stacks and beams. Whoever isn’t moving holds on, so the rope keeps you both safe.</li>
            <li><b>🪢 Swing and haul.</b> Miss a leap and the rope catches you: steer to swing, grab something, or have your partner haul you up.</li>
            <li><b>🛁 Dust baths.</b> Roll in a tub together on every floor to save. Falls cost height, never lives.</li>
          </ol>
          <p className="rc-keys">{keysLine(S.players === 2)}</p>
          <p className="rc-keys">🎮 Gamepads: stick aims, Ⓐ leaps, Ⓑ or a trigger {gripWord === 'grip' ? 'grips' : 'lets go'}, d-pad ↑ hauls, Ⓨ or a bumper swaps, Start pauses.</p>
        </section>
      )}

      {screen === 'play' && g && (<>
        {ending && (
          <div className="rc-ending" role="dialog" aria-label="The weathervane at dawn">
            <Art src="/art/ropeclimb/ending.webp" paint="ending" w={1536} h={1024} className="rc-ending-art" />
            <div className="rc-ending-text">
              <p className="rc-eyebrow">{g.hard ? 'HARD KNOT · ' : ''}THE WEATHERVANE AT DAWN</p>
              <h2>Top of the barn!</h2>
              <p>The sun peeps over the fields as Dora and Enzo flop down on the ridge, still tied together, with hay in their fur and dust in their whiskers. Below them, the barn yawns awake. Somewhere far down, an owl settles in for a long day’s sleep.</p>
              <p className="rc-final">⏱ {g.clock}{records?.fastest ? ' (best!)' : ''} · 🍂 {g.stats.falls} {g.stats.falls === 1 ? 'fall' : 'falls'}{records?.fewest ? ' (fewest!)' : ''} · ⤴ {g.stats.jumps} leaps · 🪢 {g.stats.catches} catches · 🌰 {g.found.size}/{ACORN_COUNT}</p>
              <p className="rc-medal">{medal ? `🏅 ${medal.name}: ${medal.falls === 0 ? 'not a single fall!' : `${medal.falls} falls or fewer`}` : `Medals: ${MEDALS.map((m) => `${m.name} (≤ ${m.falls})`).join(', ')}`}</p>
              {!g.hard && S.finished === 1 && <p className="rc-unlock">🪢 Hard Knot is open: a shorter rope, no saves and no nets.</p>}
              <div className="rc-row">
                <button className="rc-go" onClick={() => start({ fresh: true })}>Climb again →</button>
                {hardOpen(S) && <button className="rc-alt" onClick={() => start({ hard: true })}>🪢 Hard Knot</button>}
                <button className="rc-alt" onClick={toMenu}>Menu</button>
              </div>
            </div>
            <div className="rc-credits" aria-label="Cast"><div>
              <p className="rc-eyebrow">TIED TOGETHER</p>
              {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
              <p className="rc-eyebrow">THANK YOU FOR CLIMBING</p>
            </div></div>
          </div>
        )}
        {paused && (
          <div className="rc-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>{NAME[g.active]} and {NAME[other(g.active)]} hold on tight and wait for you.</p>
            {settings}
            <p className="rc-keys">{keysLine(g.players === 2)}</p>
            <p className="rc-note">{g.hard ? 'Hard Knot climbs aren’t saved.' : 'Your climb saves at every dust-bath tub.'}</p>
            <div className="rc-row"><button className="rc-go" onClick={() => pause(false)}>Keep climbing</button><button className="rc-alt" onClick={toMenu}>Back to the menu</button></div>
          </div>
        )}
      </>)}
    </main>
  );
}
