'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PrismGame, LEVELS, CHAPTERS, TRAY, TRAY_INFO, SAVE_KEY, readProfile, record, unlocked, totalStars, allSolved, nextUnsolved, colourName, solveFresh,
  type Profile, type TrayKind, type StarReport, type Hint,
} from '@/lib/prism-paws-game';
import type { PrismScene, Ghost } from '@/lib/prism-paws-scene';
import { PrismSound } from './sound';
import './prism.css';

type Screen = 'menu' | 'play' | 'festival';
type Win = StarReport & { news: string[]; index: number };
type Drag = { id: number; kind: TrayKind | null; code: number; from: { x: number; y: number } | null; sx: number; sy: number; x0: number; y0: number; moved: boolean };
const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const DIRS: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

/** The painting can fail to load before the page hydrates, when onError is not listening yet, so check once on mount too. */
const hideIfBroken = (el: HTMLImageElement | null) => { if (el && el.complete && !el.naturalWidth) el.style.display = 'none'; };
const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };

export default function PrismPawsPage() {
  const canvas = useRef<HTMLCanvasElement>(null), headRef = useRef<HTMLDivElement>(null), trayRef = useRef<HTMLDivElement>(null);
  const scene = useRef<PrismScene | null>(null), sound = useRef<PrismSound | null>(null);
  const game = useRef<PrismGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('menu'), armedRef = useRef<TrayKind | null>(null), cursorRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null), hintRef = useRef<Ghost | null>(null), dragRef = useRef<Drag | null>(null);
  const winRef = useRef<Win | null>(null);
  const [screen, setScreenState] = useState<Screen>('menu');
  const [chapter, setChapter] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [soundOn, setSoundOn] = useState(true), [armed, setArmedState] = useState<TrayKind | null>(null);
  const [win, setWinState] = useState<Win | null>(null), [note, setNote] = useState(''), [stuck, setStuck] = useState(false), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const setArmed = (k: TrayKind | null) => { armedRef.current = k; setArmedState(k); };
  const setWin = (w: Win | null) => { winRef.current = w; setWinState(w); };
  const P = profile.current;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const snd = () => { sound.current ??= new PrismSound(); sound.current.unlock(); return sound.current; };
  const toggleSound = () => { const s = snd(); s.setOn(!s.on); P.sound = s.on; setSoundOn(s.on); save(); s.play('tap'); };

  /** Hands the game's news to the scene and the speakers, and records a win. */
  function flush() {
    const g = game.current, sc = scene.current; if (!g) return;
    const ev = g.events.splice(0); if (!ev.length) return;
    sc?.feed(ev, g);
    let lit = 0;
    for (const e of ev) {
      if (e.kind === 'lit') sound.current?.play('lit', e.c, 0.08 * lit++);
      else if (e.kind === 'place' || e.kind === 'turn' || e.kind === 'lift' || e.kind === 'wake' || e.kind === 'firefly' || e.kind === 'nope') sound.current?.play(e.kind);
    }
    if (ev.some((e) => e.kind !== 'nope' && e.kind !== 'lit' && e.kind !== 'dim')) { hintRef.current = null; setStuck(false); setNote(''); }
    if (ev.some((e) => e.kind === 'win')) {
      sound.current?.play('win');
      const s = g.stars(), news = record(profile.current, g.index, s); save();
      const w = { ...s, news, index: g.index };
      setTimeout(() => { if (game.current === g && g.won && screenRef.current === 'play') setWin(w); }, 1400);
    }
    if (!g.won && winRef.current) setWin(null);
    refresh();
  }

  function start(i: number) {
    if (!unlocked(profile.current, i)) return;
    game.current = new PrismGame(i); profile.current.level = i; save();
    hintRef.current = null; cursorRef.current = null; dragRef.current = null; setStuck(false); setNote('');
    setChapter(LEVELS[i].chapter); setWin(null); setScreen('play');
    const first = TRAY.find((k) => game.current!.left[TRAY.indexOf(k)] > 0) ?? null; setArmed(first);
    scene.current?.layout(game.current);
    // work out the level's hint solution while the player looks at the board, so the first hint answers at once
    window.setTimeout(() => { if (game.current?.index === i) solveFresh(i); }, 700);
    snd(); requestAnimationFrame(() => { syncInsets(); canvas.current?.focus(); });
  }
  function toMenu() { setScreen('menu'); setWin(null); dragRef.current = null; setChapter(LEVELS[profile.current.level].chapter); }

  function undo() { const g = game.current; if (g?.undo()) flush(); }
  function reset() { const g = game.current; if (g?.reset()) flush(); }
  function hint() {
    const g = game.current; if (!g) return;
    snd().play('hint');
    const h: Hint = g.hint();
    if (h.kind === 'place') { hintRef.current = { x: h.x, y: h.y, code: h.code, kind: 'place' }; setNote(`Try a ${TRAY_INFO[TRAY.find((k) => TRAY_INFO[k].codes.includes(h.code))!].name.toLowerCase()} on the glowing tile.`); setStuck(false); }
    else if (h.kind === 'turn') { hintRef.current = { x: h.x, y: h.y, code: h.code, kind: 'turn' }; setNote('Try turning the glowing piece.'); setStuck(false); }
    else if (h.kind === 'stuck') { hintRef.current = null; setNote('This board can’t be finished from here. Try picking a piece back up.'); setStuck(true); }
    refresh();
  }
  /** Clears the board (undo brings it back) and shows the first piece of a fewest-pieces solution. */
  function hintFromClear() {
    const g = game.current; if (!g) return;
    g.reset(); flush();
    const s = solveFresh(g.index), first = s?.turn[0] ? { ...s.turn[0], kind: 'turn' as const } : s?.place[0] ? { ...s.place[0], kind: 'place' as const } : null;
    hintRef.current = first; setStuck(false); setNote(first ? 'From a clear board: start with the glowing tile.' : ''); refresh();
  }

  const kindIndex = (k: TrayKind) => TRAY.indexOf(k);
  function pickTray(k: TrayKind) {
    const g = game.current; if (!g || g.won || winRef.current || g.left[kindIndex(k)] <= 0) return;
    setArmed(k); snd().play('tap');
  }
  /** A tap on a tile: place the chosen tray piece, or turn the piece already there. */
  function tapCell(x: number, y: number) {
    const g = game.current; if (!g || g.won) return;
    const k = armedRef.current;
    if (g.canTurn(x, y)) { g.rotate(x, y); flush(); return; }
    if (k && g.canPlace(x, y)) {
      // the hint's orientation, if the hint points here
      const h = hintRef.current, code = h && h.kind === 'place' && h.x === x && h.y === y && TRAY_INFO[k].codes.includes(h.code) ? h.code : TRAY_INFO[k].codes[0];
      g.place(x, y, k, code);
      if (g.left[kindIndex(k)] === 0) setArmed(TRAY.find((t) => g.left[kindIndex(t)] > 0) ?? null);
      flush(); return;
    }
    if (g.pieces[g.at(x, y)]) { sound.current?.play('nope'); setNote(g.placed[g.at(x, y)] ? '' : 'That piece is fixed in place.'); }
  }

  // ---- pointer: drags from the tray or off the board, taps to place or turn
  const local = (cx: number, cy: number) => { const r = canvas.current!.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; };
  const onBoardDown = (e: React.PointerEvent) => {
    const g = game.current, sc = scene.current; if (!g || !sc || screenRef.current !== 'play' || winRef.current) return;
    snd();
    const p = local(e.clientX, e.clientY), cell = sc.cellAt(p.x, p.y); if (!cell) return;
    const from = g.canLift(cell.x, cell.y) ? cell : null;
    dragRef.current = { id: e.pointerId, kind: null, code: from ? g.pieces[g.at(cell.x, cell.y)] : 0, from, sx: p.x, sy: p.y, x0: p.x, y0: p.y, moved: false };
    cursorRef.current = null;
  };
  const onTrayDown = (e: React.PointerEvent, k: TrayKind) => {
    const g = game.current; if (!g || g.won || winRef.current || g.left[kindIndex(k)] <= 0) return;
    snd(); e.preventDefault();
    const p = local(e.clientX, e.clientY);
    dragRef.current = { id: e.pointerId, kind: k, code: TRAY_INFO[k].codes[0], from: null, sx: p.x, sy: p.y, x0: p.x, y0: p.y, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const sc = scene.current; if (!sc || !canvas.current) return;
      const p = local(e.clientX, e.clientY), d = dragRef.current;
      if (d && d.id === e.pointerId) {
        d.sx = p.x; d.sy = p.y;
        if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) > 10 && (d.kind || d.from)) d.moved = true;
      }
      hoverRef.current = e.pointerType === 'mouse' && screenRef.current === 'play' ? sc.cellAt(p.x, p.y) : null;
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current, g = game.current, sc = scene.current; if (!d || d.id !== e.pointerId || !g || !sc) return;
      dragRef.current = null;
      const p = local(e.clientX, e.clientY), cell = sc.cellAt(p.x, p.y);
      if (!d.moved) {
        if (d.kind) pickTray(d.kind);
        else { const c0 = sc.cellAt(d.x0, d.y0); if (c0) tapCell(c0.x, c0.y); }
        return;
      }
      if (d.kind) { if (cell && g.place(cell.x, cell.y, d.kind, d.code)) { if (g.left[kindIndex(d.kind)] === 0 && armedRef.current === d.kind) setArmed(TRAY.find((t) => g.left[kindIndex(t)] > 0) ?? null); } }
      else if (d.from) {
        if (!cell) g.lift(d.from.x, d.from.y);
        else if (cell.x !== d.from.x || cell.y !== d.from.y) { if (g.canPlace(cell.x, cell.y)) g.move(d.from.x, d.from.y, cell.x, cell.y); else g.events.push({ kind: 'nope' }); }
      }
      flush();
    };
    const cancel = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keeps the board clear of the header, the status line and the tray. */
  function syncInsets() {
    const sc = scene.current, cv = canvas.current; if (!sc || !cv) return;
    const r = cv.getBoundingClientRect(), head = headRef.current?.getBoundingClientRect(), tray = trayRef.current?.getBoundingClientRect();
    const top = head ? head.bottom - r.top : 64;
    if (tray && tray.left > r.left + r.width * 0.4) sc.setInsets({ top, bottom: 8, right: r.right - tray.left, left: 0 });
    else sc.setInsets({ top, bottom: tray ? r.bottom - tray.top : 110, right: 0, left: 0 });
  }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const p = profile.current; setChapter(LEVELS[p.level].chapter); setSoundOn(p.sound);
    sound.current = new PrismSound(); sound.current.setOn(p.sound);
    const W = window as unknown as { __prism: () => PrismGame | null; __prismScene: () => PrismScene | null; __prismStart: (i: number) => void; __prismFlush: () => void };
    W.__prism = () => game.current;
    W.__prismScene = () => scene.current;
    W.__prismStart = (i) => start(i);
    // browser tests that drive the engine directly hand its news to the page with this
    W.__prismFlush = () => flush();
    let dead = false, raf = 0, last = 0, ui = 0;
    const resize = () => { scene.current?.resize(); syncInsets(); };
    import('@/lib/prism-paws-scene').then(({ PrismScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new PrismScene(canvas.current); } catch { setError('This browser cannot draw the lanterns.'); return; }
      window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, scr = screenRef.current, d = dragRef.current;
        sc.draw(scr === 'play' ? g : null, dt, {
          chapter: scr === 'play' && g ? g.level.chapter : chapterRef.current,
          cursor: cursorRef.current, hover: hoverRef.current, hint: hintRef.current,
          armed: armedRef.current ? TRAY_INFO[armedRef.current].codes[0] : null,
          drag: d && d.moved ? { sx: d.sx, sy: d.sy, code: d.code, from: d.from } : null,
        });
        if (ms - ui > 500) { ui = ms; refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The lanterns could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current;
      if (screenRef.current !== 'play' || !g) return;
      // Enter and Space on a focused button press that button, not the board
      if ((k === 'enter' || k === ' ') && (e.target as HTMLElement | null)?.closest?.('button, a')) return;
      if (winRef.current) {
        if (k === 'enter') { e.preventDefault(); const i = winRef.current.index; if (i + 1 < LEVELS.length) start(i + 1); else { setWin(null); setScreen('festival'); } }
        else if (k === 'r') { setWin(null); g.reset(); flush(); }
        else if (k === 'escape') toMenu();
        return;
      }
      snd();
      if (DIRS[k]) {
        e.preventDefault();
        const c = cursorRef.current ?? { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) };
        cursorRef.current = cursorRef.current ? { x: Math.max(0, Math.min(g.w - 1, c.x + DIRS[k][0])), y: Math.max(0, Math.min(g.h - 1, c.y + DIRS[k][1])) } : c;
        return;
      }
      if (/^[1-9]$/.test(k)) {
        const kinds = TRAY.filter((t) => (g.level.tray[t] ?? 0) > 0), t = kinds[Number(k) - 1];
        if (t) pickTray(t);
        return;
      }
      if ((k === 'enter' || k === ' ') && !e.repeat) {
        e.preventDefault();
        const c = cursorRef.current ?? { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) }; cursorRef.current = c;
        tapCell(c.x, c.y); return;
      }
      if ((k === 'backspace' || k === 'delete') && cursorRef.current) { e.preventDefault(); if (g.lift(cursorRef.current.x, cursorRef.current.y)) flush(); return; }
      if (k === 'z' && !e.repeat) { undo(); return; }
      if (k === 'r' && !e.repeat && !e.ctrlKey && !e.metaKey) { reset(); return; }
      if (k === 'h' && !e.repeat) { hint(); return; }
      if (k === 'escape') { if (armedRef.current) setArmed(null); else toMenu(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chapterRef = useRef(0); chapterRef.current = chapter;
  // the header, status line and tray change size with the level and the screen, so measure after every render
  useEffect(() => { syncInsets(); });
  // the tray buttons show each piece the way the board draws it
  useEffect(() => {
    if (screen !== 'play' || !scene.current) return;
    trayRef.current?.querySelectorAll<HTMLCanvasElement>('canvas[data-code]').forEach((cv) => scene.current!.icon(cv, Number(cv.dataset.code)));
  });

  const g = game.current, L = g?.level, stars = totalStars(P), max = LEVELS.length * 3;
  const lit = g ? g.traced.lit.filter(Boolean).length : 0, woke = g ? g.traced.woke.filter(Boolean).length : 0;
  const wrong = g ? g.board.lanterns.map((ln, k) => ({ ln, got: g.traced.recv[k] })).filter(({ ln, got }) => got && got !== ln.c) : [];
  const chapterStars = (c: number) => LEVELS.reduce((a, l) => a + (l.chapter === c ? P.stars[l.id] ?? 0 : 0), 0);
  const trayKinds = L ? TRAY.filter((t) => (L.tray[t] ?? 0) > 0) : [];
  return (
    <main className="prism-shell" data-ready={ready ? 'true' : undefined} data-screen={screen} data-chapter={CHAPTERS[chapter].id}>
      <canvas ref={canvas} className="prism-canvas" tabIndex={0} aria-label="Prism Paws board. Drag pieces from the tray onto the grass, or pick one with keys 1 to 9 and press Enter. Tap a piece to turn it."
        onPointerDown={onBoardDown} onPointerLeave={() => { hoverRef.current = null; }} />
      {error && <div className="prism-panel prism-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="prism-menu" aria-label="Level select">
          <header className="prism-head">
            <a href="/" className="prism-back">← ARCADE</a>
            <button className="prism-chip" aria-pressed={soundOn} onClick={toggleSound}>{soundOn ? '🔊 Sound on' : '🔇 Sound off'}</button>
          </header>
          <div className="prism-title">
            <div className="prism-title-art"><img src="/art/prism/title.webp" alt="" width={1200} height={800} ref={hideIfBroken} onError={hide} /></div>
            <div className="prism-title-text">
              <p className="prism-eyebrow">A LIGHT-BEAM PUZZLE OF THE LANTERN FESTIVAL</p>
              <h1>Prism <em>Paws</em></h1>
              <p className="prism-sub">The valley’s lanterns have gone dark. Help Dora and Enzo steer moonlight with mirrors, candy glass and crystals to light them all again, without waking the sleeping kits.</p>
            </div>
            <p className="prism-stars-total" aria-label={`${stars} of ${max} stars`}>{stars} / {max} ★</p>
          </div>
          <div className="prism-actions">
            <button className="prism-go" onClick={() => start(nextUnsolved(P))}>{Object.keys(P.solved).length ? 'Continue' : 'Start'} · {LEVELS[nextUnsolved(P)].name} →</button>
            {allSolved(P) && <button className="prism-festival-btn" onClick={() => setScreen('festival')}>🏮 The Festival</button>}
          </div>
          <ol className="prism-how" aria-label="How to play">
            <li><b>Steer the light</b><span>Drag mirrors from the tray onto the grass. Tap one to turn it.</span></li>
            <li><b>Mix colours</b><span>Rose and leaf make honey, rose and sky plum, leaf and sky mint, and all three moonwhite.</span></li>
            <li><b>Shh, kits!</b><span>Light on a sleeping kit wakes it. Keep every kit dreaming.</span></li>
            <li><b>Three stars</b><span>Light every lantern, catch the firefly, and use no more pieces than par.</span></li>
          </ol>
          {CHAPTERS.map((ch, c) => (
            <section key={ch.id} className="prism-chapter" style={{ '--chap': ch.color } as React.CSSProperties}>
              <header><h2><span>{c + 1}</span>{ch.name}</h2><small>{chapterStars(c)} / 24 ★</small></header>
              <p>{ch.blurb}</p>
              <ol className="prism-levels">
                {LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.chapter === c).map(({ l, i }) => {
                  const open = unlocked(P, i), s = P.stars[l.id] ?? 0;
                  return (
                    <li key={l.id}>
                      <button className={'prism-level' + (P.solved[l.id] ? ' is-done' : '') + (i === P.level ? ' is-last' : '')} disabled={!open} onClick={() => start(i)}
                        aria-label={open ? `Level ${i + 1}, ${l.name}, ${s} stars` : `Level ${i + 1}, locked`}>
                        <span className="prism-num">{open ? i + 1 : '🔒'}</span>
                        <span className="prism-level-name">{open ? l.name : 'Locked'}</span>
                        <span className={'prism-best' + (s ? ' got' : '')}>{STARS(s)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <p className="prism-keys">Drag or tap pieces · <b>arrows</b> move · <b>1–9</b> pick a piece · <b>Enter</b> place or turn · <b>Backspace</b> pick up · <b>Z</b> undo · <b>R</b> reset · <b>H</b> hint</p>
        </section>
      )}

      {screen === 'festival' && (
        <section className="prism-festival" aria-label="The Festival">
          <img src="/art/prism/finale.webp" alt="" width={1600} height={1000} ref={hideIfBroken} onError={hide} />
          <div className="prism-panel prism-festival-card">
            <p className="prism-eyebrow">THE LANTERN FESTIVAL</p>
            <h2>The whole valley glows!</h2>
            <p>Every lantern is lit, in every colour there is. The kits woke up on their own just in time to see it, and Dora and Enzo share the biggest hug of the night. Thank you for bringing the light back.</p>
            <p className="prism-stars-line">{stars} / {max} ★</p>
            <div className="prism-row"><button className="prism-go" onClick={toMenu}>Back to the lanterns</button><a className="prism-link" href="/">Arcade</a></div>
          </div>
        </section>
      )}

      {screen === 'play' && g && L && (
        <>
          <div className="prism-hud" ref={headRef}>
            <div className="prism-bar">
              <a href="/" className="prism-back" aria-label="Back to the arcade">←</a>
              <div className="prism-hud-level"><b>{L.name}</b><small>Level {g.index + 1} · {CHAPTERS[L.chapter].name}</small></div>
              <div className="prism-hud-buttons">
                <button className="prism-chip" onClick={undo} disabled={!g.canUndo} title="Undo (Z)">↶<span> Undo</span></button>
                <button className="prism-chip" onClick={reset} title="Reset (R)">↺<span> Reset</span></button>
                <button className="prism-chip prism-hint-btn" onClick={hint} title="Hint (H)">💡<span> Hint</span></button>
                <button className="prism-chip" aria-pressed={soundOn} onClick={toggleSound} aria-label={soundOn ? 'Sound on' : 'Sound off'}>{soundOn ? '🔊' : '🔇'}</button>
                <button className="prism-chip" onClick={toMenu}>☰<span> Levels</span></button>
              </div>
            </div>
            <p className="prism-status" role="status">
              <span className={lit === g.board.lanterns.length ? 'is-met' : ''}>🏮 {lit} of {g.board.lanterns.length} lantern{g.board.lanterns.length === 1 ? '' : 's'} lit</span>
              <span className={g.traced.firefly ? 'is-met' : ''}>{g.traced.firefly ? '✨ Firefly caught' : '✨ Firefly free'}</span>
              <span>🧩 {g.used} used · par {g.par}</span>
              {woke > 0 && <span className="is-bad">😿 {woke === 1 ? 'A kit is' : `${woke} kits are`} awake!</span>}
              {wrong.length > 0 && woke === 0 && <span className="is-warn">{(wrong[0].got & ~wrong[0].ln.c) ? `${colourName(wrong[0].ln.c)} lantern is too bright` : `${colourName(wrong[0].ln.c)} lantern needs more colour`}</span>}
            </p>
            {(note || L.tip) && !win && (
              <p className={'prism-note' + (note ? ' is-hint' : '')}>
                {note || L.tip}
                {stuck && <button className="prism-chip" onClick={hintFromClear}>Show me from a clear board</button>}
              </p>
            )}
          </div>
          <div className="prism-tray" ref={trayRef} role="toolbar" aria-label="Pieces">
            {trayKinds.map((t, n) => {
              const left = g.left[kindIndex(t)], code = TRAY_INFO[t].codes[0];
              return (
                <button key={t} className={'prism-piece' + (armed === t ? ' is-on' : '')} disabled={left <= 0} aria-pressed={armed === t}
                  onPointerDown={(e) => onTrayDown(e, t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pickTray(t); } }}
                  title={`${TRAY_INFO[t].name}: ${TRAY_INFO[t].tip} (key ${n + 1})`}>
                  <canvas data-code={code} aria-hidden="true" />
                  <b>×{left}</b><small>{TRAY_INFO[t].name}</small><kbd>{n + 1}</kbd>
                </button>
              );
            })}
            {trayKinds.length === 0 && <p className="prism-notray">No pieces this time. Tap the mirrors with a gold arrow to turn them.</p>}
          </div>
        </>
      )}

      {screen === 'play' && win && g && (
        <div className="prism-panel prism-win" role="dialog" aria-label="Lanterns lit">
          <p className="prism-eyebrow">{CHAPTERS[LEVELS[win.index].chapter].name} · Level {win.index + 1}</p>
          <p className="prism-stars" aria-label={`${win.stars} of 3 stars`}>{STARS(win.stars)}</p>
          <h2>{['', 'Lanterns lit!', 'Glowing beautifully!', 'A perfect festival night!'][win.stars]}</h2>
          {win.news.length > 0 && <p className="prism-news">{win.news.map((n) => <b key={n}>{n}</b>)}</p>}
          <ul className="prism-tally">
            <li className="is-met"><span>★</span> Every lantern lit</li>
            <li className={win.firefly ? 'is-met' : ''}><span>{win.firefly ? '★' : '☆'}</span> {win.firefly ? 'Firefly caught' : 'Catch the firefly'}</li>
            <li className={win.thrifty ? 'is-met' : ''}><span>{win.thrifty ? '★' : '☆'}</span> {win.thrifty ? `Par ${win.par}: you used ${win.used}` : `Par is ${win.par} piece${win.par === 1 ? '' : 's'} (you used ${win.used})`}</li>
          </ul>
          <div className="prism-row">
            {win.index + 1 < LEVELS.length && <button className="prism-go" onClick={() => start(win.index + 1)}>Next level →</button>}
            {win.index + 1 >= LEVELS.length && <button className="prism-go" onClick={() => setScreen('festival')}>🏮 See the festival</button>}
            <button onClick={() => { setWin(null); g.reset(); flush(); }}>Replay</button>
            <button onClick={toMenu}>Levels</button>
          </div>
        </div>
      )}
    </main>
  );
}
