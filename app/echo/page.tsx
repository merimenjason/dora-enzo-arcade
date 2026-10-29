'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EchoGame, ROOMS, ROOM_COUNT, CHAPTERS, DT, TPS, SAVE_KEY, readSave, freshSave, recordClear, unlocked, cleared, starCount, totalStars,
  chapterRooms, idleInput, type Save, type Ev, type Input, type Who,
} from '@/lib/echo-game';
import type { EchoScene } from '@/lib/echo-scene';
import { EchoSound } from './sound';
import './echo.css';

type Screen = 'menu' | 'rooms' | 'play';
type Toast = { id: number; text: string; until: number };
type ClearInfo = { stars: [boolean, boolean, boolean]; fresh: { first: boolean; seed: boolean; par: boolean }; loops: number };
const sceneModule = () => import('@/lib/echo-scene');
const NAME: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo' };
/** Keys we hold down (and keep the page from scrolling with). */
const MOVE_KEYS = new Set(['a', 'd', 'w', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 's']);
const CAST: [string, string][] = [['Dora', 'small, springy, fits anywhere'], ['Enzo', 'heavy, steady, pushes crates'], ['Their echoes', 'always on time'], ['The candle', 'never quite long enough'], ['The burrow', 'home at last']];

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
    <span className={'eb-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A room's little map for the room list. */
function RoomMap({ index }: { index: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((m) => { if (!dead && cv.current) m.paintRoomMap(cv.current, index); }).catch(() => {}); return () => { dead = true; }; }, [index]);
  return <canvas ref={cv} width={192} height={104} className="eb-map" aria-hidden="true" />;
}
const Stars = ({ on }: { on: [boolean, boolean, boolean] | boolean[] }) => <span className="eb-stars" aria-label={`${on.filter(Boolean).length} of 3 stars`}>{on.map((s, i) => <i key={i} className={s ? 'is-on' : ''}>★</i>)}</span>;

export default function EchoPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), scene = useRef<EchoScene | null>(null), sound = useRef<EchoSound | null>(null);
  const game = useRef<EchoGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), panelRef = useRef(false), endingRef = useRef(false);
  const keys = useRef(new Set<string>()), touchPad = useRef<Input>(idleInput()), toastId = useRef(0), pads = useRef<boolean[]>([]);
  const orientRef = useRef<'wide' | 'tall'>('wide');
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [clear, setClear] = useState<ClearInfo | null>(null), [intro, setIntro] = useState<{ id: number; i: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]), [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide'), [hint, setHint] = useState(false);
  const [, setTick] = useState(0);
  const touchRef = useRef(false); touchRef.current = touch;
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new EchoSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const toast = (text: string, ms = 2800) => { const id = ++toastId.current; setToasts((t) => [...t.slice(-2), { id, text, until: performance.now() + ms }]); };
  const releaseAll = () => { keys.current.clear(); touchPad.current = idleInput(); };
  const setPanel = (on: boolean) => { panelRef.current = on; };

  /** Opens a room, recording from the start. */
  function start(i: number) {
    if (i < 0 || i >= ROOM_COUNT) return;
    audio().ui();
    const g = new EchoGame(i);
    game.current = g; save.current.last = i; persist();
    pausedRef.current = false; setPaused(false); endingRef.current = false; setEnding(false); setClear(null); setPanel(false); setHint(false);
    releaseAll(); setToasts([]);
    scene.current?.feed(g.events.splice(0), g);
    setIntro({ id: Date.now(), i });
    sound.current?.music(ROOMS[i].chapter);
    sound.current?.windOn(g.room.winds.length > 0 && g.fanOn);
    setScreen('play'); refresh();
    requestAnimationFrame(() => canvas.current?.focus());
  }
  function toMenu(to: Screen = 'menu') { persist(); pausedRef.current = false; setPaused(false); game.current = null; endingRef.current = false; setEnding(false); setClear(null); setPanel(false); setScreen(to); sound.current?.music(null); sound.current?.windOn(false); refresh(); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || endingRef.current || panelRef.current) return;
    pausedRef.current = on; setPaused(on); releaseAll();
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }
  /** R: stop recording, or try the live loop again. Shift+R: record again. */
  function rewind(re: boolean) {
    const g = game.current; if (!g || pausedRef.current || panelRef.current) return;
    if (g.phase === 'rewind' || g.phase === 'clear') return;
    audio();
    if (re) g.rerecord(); else g.rewind();
    setHint(false);
  }
  /** Notices what the game did: sounds, juice and toasts. */
  function handle(events: Ev[], g: EchoGame) {
    scene.current?.feed(events, g); sound.current?.play(events);
    for (const e of events) {
      switch (e.k) {
        case 'live': toast(`${NAME[g.who]}’s turn, beside ${NAME[g.echoWho]}’s echo`); break;
        case 'record': if (g.loops > 1) toast(`${NAME[g.who]} records again`); break;
        case 'seed': toast(e.by === 'echo' ? `🌾 ${NAME[g.echoWho]}’s echo found the golden seed!` : '🌾 The golden seed!'); break;
        case 'fan': sound.current?.windOn(e.on); break;
        default: break;
      }
    }
  }
  /** After a short cheer at the burrow door: the stars, the save, and (after the last room) the ending. */
  function finish(g: EchoGame) {
    const s = save.current, fresh = recordClear(s, g), i = g.room.index;
    const firstEnd = i === ROOM_COUNT - 1 && !s.ended;
    if (i + 1 < ROOM_COUNT) s.last = i + 1;
    if (firstEnd) s.ended = true;
    persist();
    setPanel(true); releaseAll();
    if (firstEnd) { endingRef.current = true; setEnding(true); sound.current?.music('ending'); }
    else setClear({ stars: g.stars(), fresh, loops: g.loops });
    refresh();
  }

  /** This tick's controls, from the keyboard, the touch buttons and any gamepads. */
  function readInput(): Input {
    const k = keys.current, t = touchPad.current;
    const left = k.has('a') || k.has('arrowleft') || t.x < 0, right = k.has('d') || k.has('arrowright') || t.x > 0;
    const inp: Input = { x: left === right ? 0 : left ? -1 : 1, jump: k.has(' ') || k.has('w') || k.has('arrowup') || t.jump };
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter((x): x is Gamepad => !!x) : [];
    list.forEach((gp, n) => {
      const b = (i: number) => !!gp.buttons[i]?.pressed, ax = gp.axes[0] ?? 0;
      const x = Math.abs(ax) > 0.3 ? Math.sign(ax) : (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
      if (x) inp.x = x as -1 | 1;
      if (b(0) || b(12)) inp.jump = true;
      // edges: X retries, Y records again, Start pauses
      const was = pads.current[n * 3] ?? false, was2 = pads.current[n * 3 + 1] ?? false, was3 = pads.current[n * 3 + 2] ?? false;
      if (b(2) && !was) rewind(false);
      if (b(3) && !was2) rewind(true);
      if (b(9) && !was3) pause(!pausedRef.current);
      pads.current[n * 3] = b(2); pads.current[n * 3 + 1] = b(3); pads.current[n * 3 + 2] = b(9);
    });
    return inp;
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setTouch(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    setMounted(true); refresh();
    const w = window as unknown as { __echo: () => EchoGame | null; __echoStart: (i?: number) => void; __echoRoomRect: () => { x: number; y: number; w: number; h: number; scale: number } | null };
    w.__echo = () => game.current;
    w.__echoStart = (i = 0) => start(i);
    w.__echoRoomRect = () => scene.current?.roomRect() ?? null;
    let dead = false, raf = 0, last = 0, acc = 0, ui = 0;
    const layout = () => {
      const el = stage.current; if (!el) return;
      const r = el.getBoundingClientRect(), o = r.width >= r.height ? 'wide' : 'tall';
      if (o !== orientRef.current) { orientRef.current = o; setOrient(o); }
      scene.current?.resize();
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.EchoScene(canvas.current); } catch { setError('This browser cannot draw the burrow.'); return; }
      scene.current.setShake(save.current.settings.shake);
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
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
            g.step(panelRef.current ? idleInput() : readInput());
            const ev = g.events.splice(0); if (ev.length) handle(ev, g);
            if (g.phase === 'clear' && g.clearT === 75 && !panelRef.current) finish(g);
            if (pausedRef.current || endingRef.current) { acc = 0; break; }
          }
          if (n >= 6) acc = 0;
          alpha = Math.max(0, Math.min(1, acc / DT));
        } else {
          acc = 0;
          if (playing && !pausedRef.current) readInput();
        }
        // touch buttons sit below the room on a tall screen and beside it on a wide one
        const t = touchRef.current && playing, el = stage.current;
        const sw = el ? el.clientWidth : 0, sh = el ? el.clientHeight : 0;
        sc.inset = !t ? { top: 0, right: 0, bottom: 0, left: 0 }
          : orientRef.current === 'tall' ? { top: 0, right: 0, bottom: Math.min(210, Math.max(150, sh * 0.26)), left: 0 }
          : { top: 0, right: Math.min(150, Math.max(116, sw * 0.15)), bottom: 0, left: Math.min(150, Math.max(116, sw * 0.15)) };
        sc.draw(playing ? g : null, { dt, alpha, paused: playing && (pausedRef.current || endingRef.current) });
        sound.current?.tick(playing && !pausedRef.current);
        if (ms - ui > 120) {
          ui = ms;
          setToasts((tt) => (tt.length && tt[0].until < performance.now() ? tt.filter((x) => x.until > performance.now()) : tt));
          if (playing && !frozen) refresh();
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The burrow could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current, tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !g || endingRef.current) return;
      const onControl = !!tgt.closest?.('button, a');
      if (k === 'escape' || k === 'p') { if (!e.repeat) { e.preventDefault(); pause(!pausedRef.current); } return; }
      if (pausedRef.current || panelRef.current) return;
      if (k === 'r') { e.preventDefault(); if (!e.repeat) rewind(e.shiftKey); return; }
      if (k === 'h') { if (!e.repeat) { setHint((v) => !v); audio().ui(); } return; }
      if (MOVE_KEYS.has(k)) {
        if (k === ' ' && onControl) return;
        if (!e.repeat) keys.current.add(k);
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
        audio();
      }
    };
    const keyup = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const blur = () => { releaseAll(); pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect();
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the room's title card fades on its own
  useEffect(() => { if (!intro) return; const t = setTimeout(() => setIntro(null), 3600); return () => clearTimeout(t); }, [intro]);
  // Enter or R on the stars panel
  useEffect(() => {
    if (!clear) return;
    const k = (e: KeyboardEvent) => {
      const g = game.current; if (!g || e.repeat) return;
      if (e.key === 'Enter' && !(e.target as HTMLElement).closest?.('button, a')) { e.preventDefault(); if (g.room.index + 1 < ROOM_COUNT) start(g.room.index + 1); else toMenu('rooms'); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); start(g.room.index); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clear]);

  // touch: hold buttons; a finger that slides off keeps its button until it lifts
  const capture = (e: React.PointerEvent) => { try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ } };
  const hold = (key: 'left' | 'right' | 'jump', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); if (on) { audio(); capture(e); }
    const t = touchPad.current;
    if (key === 'left') t.x = on ? -1 : t.x === -1 ? 0 : t.x; else if (key === 'right') t.x = on ? 1 : t.x === 1 ? 0 : t.x;
    else t.jump = on;
  };
  const tap = (re: boolean) => (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); rewind(re); };

  const toggle = (k: 'sound' | 'music' | 'shake') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); if (k === 'music') a.setMusic(S.settings.music);
    if (k === 'shake') scene.current?.setShake(S.settings.shake);
    a.ui(); refresh();
  };
  const settings = (
    <span className="eb-chips">
      <button className="eb-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="eb-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
      <button className="eb-chip" aria-pressed={S.settings.shake} onClick={() => toggle('shake')}>{S.settings.shake ? '📳 Shake' : '📳 Still'}</button>
    </span>
  );

  const g = game.current, phase = g?.phase ?? 'none';
  const R = g?.room;
  const keysLine = <><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd> move · <kbd>Space</kbd>/<kbd>↑</kbd> jump (hold for higher) · <kbd>R</kbd> stop the recording, or try again · <kbd>Shift</kbd>+<kbd>R</kbd> record again · <kbd>H</kbd> hint · <kbd>Esc</kbd> pause</>;
  const total = mounted ? totalStars(S) : 0;
  const nextOpen = mounted ? Math.max(0, ROOMS.findIndex((_, i) => unlocked(S, i) && !cleared(S, i))) : 0;
  const resumeAt = mounted ? (unlocked(S, S.last) ? S.last : nextOpen) : 0;
  const anyCleared = mounted && Object.keys(S.rooms).length > 0;
  let line = '';
  if (g && R) {
    if (phase === 'record') line = `🕯 ${NAME[g.who]} records${touch ? '' : ' · R stops'}`;
    else if (phase === 'rewind') line = '⟲ Rewinding…';
    else if (phase === 'live') line = `${NAME[g.who]} + ${NAME[g.echoWho]}’s echo${touch ? '' : ' · R retry · ⇧R re-record'}`;
    else line = '🏡 Through the burrow door!';
  }
  const candle = g && R ? (phase === 'record' ? g.candleLeft / R.candle : phase === 'live' ? (g.frameCount ? Math.max(0, g.frameCount - g.t) / g.frameCount : 0) : phase === 'rewind' ? 1 - g.rewindT / Math.max(1, g.rewindLen) : 0) : 0;
  const secs = g && R ? Math.ceil((phase === 'record' ? g.candleLeft : Math.max(0, g.frameCount - g.t)) / TPS) : 0;

  return (
    <main className="eb-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={phase} data-touch={touch ? orient : undefined}>
      {screen === 'play' && g && R && (
        <header className="eb-bar">
          <a href="/" className="eb-back">← ARCADE</a>
          <span className="eb-bar-mid">
            <b className="eb-room-name"><small>{R.index + 1}</small> {R.name}</b>
            <span className={'eb-candle is-' + phase + (phase === 'record' && secs <= 3 ? ' is-low' : '')} title={phase === 'record' ? 'Candle: how long the recording can last' : 'How long the echo still moves'}>
              <i style={{ transform: `scaleY(${Math.max(0, Math.min(1, candle))})` }} /><em>{phase === 'record' || phase === 'live' ? `${secs}s` : ''}</em>
            </span>
            <span className="eb-line">{line}</span>
            <span className="eb-stat" title={`Loops (par ${R.par})`}>⟲ {g.loops}<small>/{R.par}</small></span>
            <span className={'eb-stat eb-seed' + (g.seed ? ' is-got' : '')} title="Golden seed">🌾</span>
          </span>
          <span className="eb-chips">
            <button className="eb-chip" onClick={() => { audio().ui(); setHint((v) => !v); }} aria-pressed={hint} aria-label="Hint">💡</button>
            <button className="eb-chip" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!!clear || ending}>❚❚</button>
          </span>
        </header>
      )}
      <div className="eb-stage" ref={stage}>
        <canvas ref={canvas} className="eb-canvas" tabIndex={0} aria-label="A burrow room. Move with the arrow keys, jump with Space, R rewinds and Shift+R records again." />
        {screen === 'play' && g && R && (<>
          <p className="eb-tall-note"><b>{R.name}</b><small>Turn your phone sideways for a bigger burrow</small></p>
          {intro && intro.i === R.index && (
            <div key={intro.id} className="eb-intro">
              <small>{CHAPTERS.find((c) => c.id === R.chapter)!.name} · room {R.index + 1} of {ROOM_COUNT}</small>
              <b>{R.name}</b>
              <span>{NAME[R.first]} records first. Then {NAME[R.second]} plays beside the echo.</span>
              {R.def.teach && <em>✨ {R.def.teach}</em>}
            </div>
          )}
          {hint && !paused && !clear && <button className="eb-hint" onClick={() => setHint(false)}>💡 {R.def.hint} <small>✕</small></button>}
          {R.index === 0 && g.loops === 1 && phase === 'record' && !intro && !hint && <p className="eb-tip">{touch ? '◀ ▶ move · ⤴ jump · ⟲ when Dora is in place' : '← → move · Space jump · press R once Dora is in place'}</p>}
          {touch && !paused && !clear && !ending && (
            <div className={'eb-touch is-' + orient}>
              <div className="eb-tl">
                <button className="eb-tb" onPointerDown={hold('left', true)} onPointerUp={hold('left', false)} onPointerCancel={hold('left', false)} onLostPointerCapture={hold('left', false)} aria-label="Left">◀</button>
                <button className="eb-tb" onPointerDown={hold('right', true)} onPointerUp={hold('right', false)} onPointerCancel={hold('right', false)} onLostPointerCapture={hold('right', false)} aria-label="Right">▶</button>
              </div>
              <div className="eb-tr">
                <button className="eb-tb eb-small" onPointerDown={tap(true)} aria-label="Record again">⟲⟲<small>re-record</small></button>
                <button className="eb-tb eb-small" onPointerDown={tap(false)} aria-label={phase === 'record' ? 'Stop recording' : 'Try again'}>⟲<small>{phase === 'record' ? 'stop' : 'retry'}</small></button>
                <button className="eb-tb eb-jump" onPointerDown={hold('jump', true)} onPointerUp={hold('jump', false)} onPointerCancel={hold('jump', false)} onLostPointerCapture={hold('jump', false)} aria-label="Jump">⤴</button>
              </div>
            </div>
          )}
        </>)}
        <div className="eb-toasts" aria-live="polite">{toasts.map((t) => <p key={t.id} className="eb-toast">{t.text}</p>)}</div>
      </div>
      {error && <div className="eb-panel eb-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="eb-menu" aria-label="Echo Burrow">
          <header className="eb-head"><a href="/" className="eb-back">← ARCADE</a>{settings}</header>
          <div className="eb-hero">
            <Art src="/art/echo/title.webp" paint="title" w={1536} h={1024} className="eb-hero-art" />
            <div><p className="eb-eyebrow">A TIME-LOOP PUZZLE FOR TWO CHINCHILLAS</p><h1>Echo <em>Burrow</em></h1>
              <p className="eb-lede">The way home runs through thirty tricky burrow rooms. One of them goes first while a candle burns, and then time winds back: the other plays beside a shimmering echo that does everything again, exactly on time.</p></div>
          </div>
          <div className="eb-go-row">
            <button className="eb-go" disabled={!ready} onClick={() => start(resumeAt)}>{!ready ? 'Lighting the candle…' : anyCleared ? `CONTINUE →` : 'START →'}<small>{mounted ? `Room ${resumeAt + 1}: ${ROOMS[resumeAt].name}` : ' '}</small></button>
            <button className="eb-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('rooms'); }}>🗺 Rooms<small>★ {total} of {ROOM_COUNT * 3}</small></button>
            {mounted && S.ended && <button className="eb-alt" onClick={() => { audio().ui(); setScreen('play'); endingRef.current = true; setEnding(true); setPanel(true); sound.current?.music('ending'); }}>🏡 The ending</button>}
          </div>
          <ol className="eb-how" aria-label="How to play">
            <li><b>🕯 Record.</b> The first chinchilla plays while the candle burns: press plates, push crates, stand where a friend will need a step. Press R when you’re done.</li>
            <li><b>⟲ Rewind.</b> Time winds back to the start of the room, and the other chinchilla steps out beside a teal echo.</li>
            <li><b>🐾 Together.</b> The echo replays every move: it holds plates, lights glow-moss and makes a fine step. Reach the burrow door to clear the room.</li>
            <li><b>★ Stars.</b> One for the clear, one for the golden seed and one for clearing within par loops. R retries with the same echo; Shift+R records again.</li>
          </ol>
          <p className="eb-keys">{keysLine}</p>
          <p className="eb-keys">🐭 <b>Dora</b> is light and springy and fits kit tunnels, but can’t hold heavy plates. 🐀 <b>Enzo</b> pushes crates, holds heavy plates and flips seesaws. 🎮 Gamepads: stick moves, Ⓐ jumps, Ⓧ retries, Ⓨ records again, Start pauses.</p>
        </section>
      )}

      {screen === 'rooms' && (
        <section className="eb-menu eb-rooms" aria-label="Rooms">
          <header className="eb-head"><button className="eb-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="eb-total">★ {total} / {ROOM_COUNT * 3}</b></header>
          {CHAPTERS.map((ch, n) => (
            <div key={ch.id} className={'eb-chapter is-' + ch.id}>
              <div className="eb-ch-head"><img src={`/art/echo/bg-${ch.id}.webp`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><p><small>CHAPTER {n + 1}</small><b>{ch.name}</b><span>{ch.blurb}</span></p></div>
              <div className="eb-grid">
                {chapterRooms(ch.id).map((i) => {
                  const open = mounted && unlocked(S, i), r = mounted ? S.rooms[ROOMS[i].id] : undefined;
                  return (
                    <button key={i} className={'eb-room' + (open ? '' : ' is-locked') + (r?.clear ? ' is-done' : '')} disabled={!open || !ready} onClick={() => start(i)} aria-label={`Room ${i + 1}: ${ROOMS[i].name}${open ? '' : ' (locked)'}`}>
                      <RoomMap index={i} />
                      <span className="eb-room-num">{i + 1}</span>
                      <span className="eb-room-name">{open ? ROOMS[i].name : '🔒'}</span>
                      <Stars on={[!!r?.clear, !!r?.seed, !!r?.par]} />
                      <small>{ROOMS[i].first === 'dora' ? 'Dora first' : 'Enzo first'} · par {ROOMS[i].par}{r?.best ? ` · best ${r.best}` : ''}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="eb-note">Clearing a room opens the next two, so one stubborn room never blocks the way.</p>
        </section>
      )}

      {screen === 'play' && g && R && (<>
        {clear && (
          <div className="eb-panel eb-clear" role="dialog" aria-label="Room cleared">
            <p className="eb-eyebrow">ROOM {R.index + 1} CLEARED</p>
            <h2>{R.name}</h2>
            <div className="eb-bigstars">
              {(['Through the door', 'Golden seed', `Within ${R.par} loops`] as const).map((label, i) => (
                <span key={label} className={(clear.stars[i] ? 'is-on' : '') + ((i === 0 && clear.fresh.first) || (i === 1 && clear.fresh.seed) || (i === 2 && clear.fresh.par) ? ' is-new' : '')}><i>★</i><small>{label}</small></span>
              ))}
            </div>
            <p className="eb-note">{clear.loops} loop{clear.loops === 1 ? '' : 's'}{!clear.stars[1] ? ' · the golden seed is still out there' : ''}{!clear.stars[2] ? ` · par is ${R.par}` : ''}</p>
            <div className="eb-row">
              {R.index + 1 < ROOM_COUNT ? <button className="eb-go" autoFocus onClick={() => start(R.index + 1)}>Next room →<small>{ROOMS[R.index + 1].name}</small></button> : <button className="eb-go" autoFocus onClick={() => toMenu('rooms')}>All rooms →</button>}
              <button className="eb-alt" onClick={() => start(R.index)}>⟲ Again</button>
              <button className="eb-alt" onClick={() => toMenu('rooms')}>🗺 Rooms</button>
            </div>
          </div>
        )}
        {paused && (
          <div className="eb-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>The candle waits for you.</p>
            {settings}
            <p className="eb-keys">{keysLine}</p>
            <div className="eb-row"><button className="eb-go" onClick={() => pause(false)}>Keep going</button><button className="eb-alt" onClick={() => { pause(false); start(R.index); }}>Restart room</button><button className="eb-alt" onClick={() => toMenu('rooms')}>Rooms</button><button className="eb-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
        )}
      </>)}
      {ending && (
        <div className="eb-ending" role="dialog" aria-label="Home at last">
          <Art src="/art/echo/ending.webp" paint="ending" w={1536} h={1024} className="eb-ending-art" />
          <div className="eb-ending-text">
            <p className="eb-eyebrow">HOME BURROW</p>
            <h2>Home at last!</h2>
            <p>Thirty rooms, a great many candles, and more echoes than anyone could count. Dora and Enzo tumble through the round front door, shake the dust from their fur and curl up by the warm stove, side by side, with nobody to wait for and nowhere else to be.</p>
            <p className="eb-final">★ {totalStars(S)} of {ROOM_COUNT * 3} stars{totalStars(S) < ROOM_COUNT * 3 ? ' · golden seeds and par stars are still waiting in the rooms' : ' · every star in the burrow!'}</p>
            <div className="eb-row"><button className="eb-go" onClick={() => toMenu('rooms')}>🗺 Rooms →</button><button className="eb-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
          <div className="eb-credits" aria-label="Cast"><div>
            <p className="eb-eyebrow">STARRING</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="eb-eyebrow">THANK YOU FOR PLAYING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
