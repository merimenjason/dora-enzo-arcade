'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MeadowGame, VALLEYS, VALLEY_IDS, TUTORIAL, ENDLESS, SAVE_KEY, ANIMAL_NAME, ANIMAL_OF, TERRAIN_NAME, readSave, freshSave, recordRun, valleyOpen, endlessOpen,
  acornCount, dailySeed, rotations, perfectSpots, type Save, type Mode, type ValleyId, type Assessment, type Wish,
} from '@/lib/meadow-game';
import type { MeadowScene, Ghost } from '@/lib/meadow-scene';
import { MeadowSound, type SongId } from './sound';
import './meadow.css';

type Screen = 'menu' | 'valleys' | 'play';
type Result = { best: boolean; acorns: number; newAcorns: number };
const sceneModule = () => import('@/lib/meadow-scene');
const EMOJI = { bee: '🐝', hedgehog: '🦔', rabbit: '🐇', duck: '🦆' } as const;
const CAST: [string, string][] = [['Dora', 'tile-setter, flower-finder'], ['Enzo', 'carrier of the heavy tiles'], ['The hedgehog', 'who loves a big woods'], ['The duck', 'and all her ducklings'], ['The bee', 'and every flower'], ['The rabbit', 'snug in the burrow-hill']];
/** The tutorial's words, one for each tile, and where the first two tiles want to go. */
const GUIDE: { text: string; cell?: [number, number] }[] = [
  { text: 'Turn the tile (R, the mouse wheel, a right-click or ⟳) until its two meadow edges face the meadow, then set it on the glowing spot.', cell: [2, -1] },
  { text: 'See the hole in the middle? Fill it: six matching sides make a Perfect, and every Perfect adds tiles to your stack.', cell: [0, 0] },
  { text: 'This tile carries a wish: the hedgehog wants a woods of at least 3 tiles. Grow the woods out from your first tile.' },
  { text: 'One more woods tile grants the wish. Wishes pay points and tiles.' },
  { text: 'A stream must meet a stream. Set this spring next to the meadow, then bring the next spring round to face it.' },
  { text: 'Join the two springs stream to stream: a stream with every end joined becomes a pond, and the ducks move in.' },
  { text: 'Edges that match score; the ticks and crosses on the ghost show which do. A patch with no open side left is finished.' },
  { text: 'Last tile! The run ends when the stack is empty. Then the real valleys are waiting.' },
];

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className, valley }: { src: string; paint: 'title' | 'ending' | 'valley'; w: number; h: number; className?: string; valley?: ValleyId | 'tutorial' | 'endless' }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current; if (dead || !c) return;
      if (paint === 'title') m.paintTitle(c); else if (paint === 'ending') m.paintEnding(c);
      else m.paintValley(c, valley === 'tutorial' ? TUTORIAL : valley === 'endless' || !valley ? ENDLESS : VALLEYS[valley]);
    }).catch(() => {});
    return () => { dead = true; };
  }, [paint, valley]);
  return (
    <span className={'mm-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {src && !hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A tile drawn in the HUD. */
function TileIcon({ edges, rot, wish, size, spin = 0, onClick, label }: { edges: string; rot: number; wish?: MeadowGame['stack'][number]['wish']; size: number; spin?: number; onClick?: () => void; label: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { if (!dead && cv.current) m.drawTileIcon(cv.current, edges, rot, wish ?? null, spin); }).catch(() => {});
    return () => { dead = true; };
  }, [edges, rot, wish, spin]);
  const inner = <canvas ref={cv} width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
  return onClick ? <button className="mm-tile-btn" onClick={onClick} aria-label={label}>{inner}</button> : <span className="mm-tile-icon" role="img" aria-label={label}>{inner}</span>;
}
const Acorns = ({ n, of = 3, big = false }: { n: number; of?: number; big?: boolean }) => (
  <span className={'mm-acorns' + (big ? ' is-big' : '')} aria-label={`${n} of ${of} acorns`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'is-on' : ''}>🌰</i>)}</span>
);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const wishText = (w: Pick<Wish, 'animal' | 'terrain' | 'size' | 'kind'>) => `${ANIMAL_NAME[w.animal]} wants ${w.terrain === 'stream' ? 'a stream' : `a ${TERRAIN_NAME[w.terrain]}`} of ${w.kind === 'exact' ? 'exactly' : 'at least'} ${w.size} tile${w.size > 1 ? 's' : ''}${w.kind === 'exact' ? ', finished' : ''}`;
const modeName = (m: Mode, date: string) => (m.kind === 'valley' ? VALLEYS[m.valley].name : m.kind === 'tutorial' ? TUTORIAL.name : m.daily ? `Daily Valley · ${date}` : ENDLESS.name);

export default function MeadowPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), side = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null);
  const scene = useRef<MeadowScene | null>(null), sound = useRef<MeadowSound | null>(null);
  const game = useRef<MeadowGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), panelRef = useRef(false), endAt = useRef(0), dateRef = useRef('');
  const rotRef = useRef(0), hover = useRef<[number, number] | null>(null), pending = useRef<[number, number] | null>(null), touchRef = useRef(false);
  const assessMemo = useRef<{ k: string; a: Assessment } | null>(null), spotsMemo = useRef<{ turn: number; tile: number; spots: [number, number][] } | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; type: string; moved: boolean; button: number }>()), pinch = useRef<{ d: number; mx: number; my: number } | null>(null);
  const wheelAcc = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [result, setResult] = useState<Result | null>(null), [peekEnd, setPeekEnd] = useState(false);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new MeadowSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const songFor = (g: MeadowGame): SongId => (g.mode.kind === 'endless' ? 'endless' : 'valley');
  const clearAim = () => { pending.current = null; assessMemo.current = null; };

  /** Starts a run (or picks up a saved one). */
  function begin(g: MeadowGame) {
    game.current = g; rotRef.current = 0; clearAim(); hover.current = null; spotsMemo.current = null;
    pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; endAt.current = 0; setEnding(false);
    scene.current?.setGame(g);
    sound.current?.music(songFor(g));
    setScreen('play'); refresh();
    requestAnimationFrame(() => { layout(); scene.current?.frame(true); canvas.current?.focus(); });
  }
  function start(mode: Mode) {
    if (mode.kind === 'valley' && !valleyOpen(save.current, VALLEY_IDS.indexOf(mode.valley))) return;
    audio().ui();
    const g = new MeadowGame(mode);
    save.current.run = g.snapshot(); persist();
    begin(g);
  }
  const startEndless = (daily: boolean) => start({ kind: 'endless', daily, seed: daily ? dailySeed(dateRef.current || today()) : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) });
  function resume() { const g = save.current.run ? MeadowGame.load(save.current.run) : null; audio().ui(); if (g) begin(g); else { save.current.run = null; persist(); refresh(); } }
  function toMenu(to: Screen = 'menu') {
    persist(); pausedRef.current = false; setPaused(false); game.current = null; setResult(null); panelRef.current = false; setEnding(false);
    scene.current?.setGame(null); setScreen(to); sound.current?.music('menu'); refresh();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || panelRef.current) return;
    if (on === pausedRef.current) return;
    pausedRef.current = on; setPaused(on);
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }
  /** The run is over: the score, the acorns, and after the last valley's first acorn, the ending. */
  function finish(g: MeadowGame) {
    const s = save.current, r = recordRun(s, g, dateRef.current || today());
    s.run = null; persist();
    panelRef.current = true;
    if (r.firstEnding) { setEnding(true); sound.current?.music('ending'); }
    setResult({ best: r.best, acorns: r.acorns, newAcorns: r.newAcorns }); setPeekEnd(false);
    scene.current?.frame();
    refresh();
  }

  // ---------------------------------------------------------------- aiming and placing
  const aimCell = (): [number, number] | null => (touchRef.current ? pending.current : hover.current ?? pending.current);
  function assessAt(g: MeadowGame, q: number, r: number): Assessment {
    const k = `${q},${r},${rotRef.current},${g.turn},${g.current?.id}`;
    if (assessMemo.current?.k !== k) assessMemo.current = { k, a: g.assess(q, r, rotRef.current) };
    return assessMemo.current.a;
  }
  function ghost(): Ghost {
    const g = game.current, at = aimCell(); if (!g || !at || g.done || !g.legal(at[0], at[1])) return null;
    return { q: at[0], r: at[1], rot: rotRef.current, a: assessAt(g, at[0], at[1]), pending: touchRef.current && !!pending.current };
  }
  function spots(g: MeadowGame) {
    const tile = g.current?.id ?? -1;
    if (spotsMemo.current?.turn !== g.turn || spotsMemo.current.tile !== tile) spotsMemo.current = { turn: g.turn, tile, spots: perfectSpots(g) };
    return spotsMemo.current.spots;
  }
  function turn(dir: 1 | -1) {
    const g = game.current; if (!g || g.done || pausedRef.current || panelRef.current) return;
    rotRef.current = (rotRef.current + dir + 6) % 6; audio().turn(); refresh();
  }
  function setRot(rot: number) { if (!game.current || panelRef.current) return; rotRef.current = rot; audio().turn(); refresh(); }
  function placeAt(q: number, r: number) {
    const g = game.current; if (!g || g.done || pausedRef.current || panelRef.current) return false;
    if (!g.place(q, r, rotRef.current)) { audio().nope(); return false; }
    audio();
    const ev = g.events.splice(0);
    scene.current?.feed(ev, g); sound.current?.play(ev);
    rotRef.current = 0; clearAim();
    save.current.run = g.done ? null : g.snapshot(); persist();
    if (g.done) endAt.current = performance.now() + 1700;
    refresh();
    return true;
  }
  function undo() {
    const g = game.current; if (!g || !g.canUndo || panelRef.current || pausedRef.current) return;
    g.undo(); const ev = g.events.splice(0); scene.current?.feed(ev, g); sound.current?.play(ev);
    endAt.current = 0; clearAim(); save.current.run = g.snapshot(); persist(); refresh();
  }
  /** The screen's clear area, so the camera frames the valley round the HUD. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setOrient(r.width >= r.height ? 'wide' : 'tall');
    if (!sc) return;
    sc.resize();
    const p = side.current?.getBoundingClientRect();
    const inset = { top: 8, right: 8, bottom: 8, left: 8 };
    if (p && p.width > 0) {
      // the panel sits along the right edge (wide screens) or the bottom (tall ones)
      if (p.height > r.height * 0.6) inset.right = Math.max(8, r.right - p.left + 6);
      else inset.bottom = Math.max(8, r.bottom - p.top + 6);
    }
    sc.inset = inset;
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    dateRef.current = today();
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse); touchRef.current = coarse;
    setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__meadow = () => game.current;
    w.__meadowStart = (m: Mode) => start(m);
    w.__meadowCell = (q: number, r: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(), [x, y] = sc.cellToScreen(q, r); return [b.left + x, b.top + y]; };
    w.__meadowScene = () => scene.current?.metrics() ?? null;
    w.__meadowRot = () => rotRef.current;
    let dead = false, raf = 0, last = 0, ui = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.MeadowScene(canvas.current); } catch { setError('This browser cannot draw the valley.'); return; }
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      if (game.current) scene.current.setGame(game.current);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, playing = screenRef.current === 'play' && !!g;
        const frozen = pausedRef.current;
        const hints = save.current.settings.hints;
        const gi = playing && g && g.mode.kind === 'tutorial' ? GUIDE[Math.min(GUIDE.length - 1, g.turn)] : null;
        const guide = gi?.cell && g && g.legal(gi.cell[0], gi.cell[1]) ? gi.cell : null;
        sc.draw(playing ? g : null, { dt: frozen ? 0 : dt, ghost: playing && !panelRef.current ? ghost() : null, hints, spots: playing && g && hints && !g.done ? spots(g) : [], guide, showFrontier: playing && !!g && !g.done && !panelRef.current });
        if (playing && g && g.done && endAt.current && performance.now() >= endAt.current && !panelRef.current) finish(g);
        sound.current?.tick(!pausedRef.current);
        if (ms - ui > 250) { ui = ms; if (playing && !frozen && !panelRef.current) refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The valley could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current, tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !g || panelRef.current) return;
      if (k === 'escape' || k === 'p') { if (!e.repeat) { e.preventDefault(); pause(!pausedRef.current); } return; }
      if (pausedRef.current) return;
      if (tgt.closest?.('button, a') && (k === ' ' || k === 'enter')) return;
      const sc = scene.current, step = 60;
      if (k === 'r' || k === 'e') { e.preventDefault(); turn(1); }
      else if (k === 'q') { e.preventDefault(); turn(-1); }
      else if (k === 'z' || k === 'backspace' || k === 'u') { e.preventDefault(); undo(); }
      else if (k === 'f') { e.preventDefault(); sc?.frame(); }
      else if (k === '+' || k === '=') { e.preventDefault(); sc?.zoomAt(1.2); }
      else if (k === '-' || k === '_') { e.preventDefault(); sc?.zoomAt(1 / 1.2); }
      else if (k === 'arrowleft' || k === 'a') { e.preventDefault(); sc?.pan(step, 0); }
      else if (k === 'arrowright' || k === 'd') { e.preventDefault(); sc?.pan(-step, 0); }
      else if (k === 'arrowup' || k === 'w') { e.preventDefault(); sc?.pan(0, step); }
      else if (k === 'arrowdown' || k === 's') { e.preventDefault(); sc?.pan(0, -step); }
      else if (k === 'enter' || k === ' ') { e.preventDefault(); const at = aimCell(); if (at) placeAt(at[0], at[1]); }
    };
    const blur = () => { pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect();
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, orient, result]);

  // ---------------------------------------------------------------- the pointer: hover, click, tap twice, drag, pinch
  const local = (e: React.PointerEvent | React.WheelEvent | React.MouseEvent): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || panelRef.current) return;
    audio();
    const [x, y] = local(e);
    if (e.pointerType !== 'mouse' && !touchRef.current) { touchRef.current = true; setTouch(true); }
    ptrs.current.set(e.pointerId, { x, y, sx: x, sy: y, type: e.pointerType, moved: false, button: e.button });
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; for (const p of ptrs.current.values()) p.moved = true; }
  };
  const onMove = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || !scene.current) return;
    const [x, y] = local(e), p = ptrs.current.get(e.pointerId), sc = scene.current;
    if (!p) { if (e.pointerType === 'mouse') { if (touchRef.current) { touchRef.current = false; setTouch(false); } hover.current = sc.pick(x, y); } return; }
    if (pinch.current && ptrs.current.size >= 2) {
      p.x = x; p.y = y;
      const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      sc.pan(mx - pinch.current.mx, my - pinch.current.my); if (pinch.current.d > 10) sc.zoomAt(d / pinch.current.d, mx, my);
      pinch.current = { d, mx, my }; return;
    }
    const dx = x - p.x, dy = y - p.y;
    if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > (p.type === 'mouse' ? 6 : 12)) p.moved = true;
    if (p.moved) sc.pan(dx, dy);
    p.x = x; p.y = y;
    if (p.type === 'mouse') hover.current = sc.pick(x, y);
  };
  const onUp = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId); ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    const g = game.current, sc = scene.current;
    if (!p || p.moved || !g || !sc || screenRef.current !== 'play' || pausedRef.current || panelRef.current) return;
    const [x, y] = local(e), [q, r] = sc.pick(x, y);
    if (p.type === 'mouse') {
      if (p.button === 2) return;
      if (p.button === 0) placeAt(q, r);
      return;
    }
    // a touch: the first tap shows the ghost, a second tap on the same cell (or ✓) places it
    const at = pending.current;
    if (at && at[0] === q && at[1] === r) placeAt(q, r);
    else if (g.legal(q, r)) { pending.current = [q, r]; assessMemo.current = null; audio().pick(); refresh(); }
    else { pending.current = null; refresh(); }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || panelRef.current) return;
    if (e.ctrlKey || e.shiftKey || e.altKey) { const [x, y] = local(e); scene.current?.zoomAt(Math.exp(-(e.deltaY || e.deltaX) * 0.0025), x, y); return; }
    wheelAcc.current += e.deltaY;
    if (Math.abs(wheelAcc.current) >= 40) { turn(wheelAcc.current > 0 ? 1 : -1); wheelAcc.current = 0; }
  };
  useEffect(() => {
    // React's wheel listener is passive; this one stops the page from scrolling or zooming
    const cv = canvas.current; if (!cv) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    cv.addEventListener('wheel', stop, { passive: false });
    return () => cv.removeEventListener('wheel', stop);
  }, []);

  const toggle = (k: 'sound' | 'music' | 'hints') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); if (k === 'music') a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="mm-chips">
      <button className="mm-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="mm-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
      <button className="mm-chip" aria-pressed={S.settings.hints} onClick={() => toggle('hints')}>{S.settings.hints ? '✨ Hints' : '✨ Off'}</button>
    </span>
  );

  const g = game.current, cur = g?.current ?? null, nxt = g?.peek ?? null;
  const at = g ? aimCell() : null, gh = g && at && g.legal(at[0], at[1]) ? at : null;
  const rotScores = g && gh && cur && S.settings.hints ? rotations(g, gh[0], gh[1], 30).map((x) => x.value) : null;
  const bestRot = rotScores ? Math.max(...rotScores) : 0;
  const acornsNow = g ? g.acorns() : 0, targets = g?.def.acorns ?? [0, 0, 0], scored = targets[0] > 0;
  const nextTarget = scored ? targets.find((t) => (g?.score ?? 0) < t) ?? null : null;
  const keysLine = <><kbd>R</kbd>/<kbd>E</kbd> or the wheel turn · <kbd>Q</kbd> back · click to place · drag, <kbd>WASD</kbd> or arrows to pan · <kbd>Shift</kbd>+wheel or <kbd>+</kbd>/<kbd>−</kbd> zoom · <kbd>F</kbd> frame · <kbd>Z</kbd> undo · <kbd>Esc</kbd> pause</>;
  const guideText = g && g.mode.kind === 'tutorial' && !g.done ? GUIDE[Math.min(GUIDE.length - 1, g.turn)].text : null;
  const runName = g ? modeName(g.mode, dateRef.current) : '';
  const hasRun = mounted && !!S.run;
  const runLabel = hasRun && S.run ? modeName(S.run.mode, dateRef.current) : '';
  const nextValley = mounted ? Math.max(0, VALLEY_IDS.findIndex((id, i) => valleyOpen(S, i) && !(S.valleys[id]?.acorns))) : 0;
  const openWishes = g ? g.wishes.filter((w) => w.state === 'open' || g.turn - w.ended <= 2) : [];

  return (
    <main className="mm-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined}>
      {screen === 'play' && g && (
        <header className="mm-bar" ref={bar}>
          <a href="/" className="mm-back">← ARCADE</a>
          <span className="mm-bar-mid">
            <b className="mm-name">{runName}</b>
            <span className="mm-stat mm-score" data-testid="score" title="Score">{g.score}<small> pts</small></span>
            {scored && <span className="mm-stat" title={`Acorns at ${targets.join(', ')}`}><Acorns n={acornsNow} />{nextTarget !== null && <small className="mm-next"> next at {nextTarget}</small>}</span>}
            <span className="mm-stat mm-left" data-testid="tiles-left" title="Tiles left in the stack">🂠 {g.stack.length}</span>
          </span>
          <button className="mm-chip mm-pause" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!!result}>❚❚</button>
        </header>
      )}
      <div className="mm-stage" ref={stage}>
        <canvas ref={canvas} className="mm-canvas" tabIndex={0} data-testid="valley"
          aria-label="The valley. Move over an empty cell to see the tile there, turn it with R or the wheel, and click to place it."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !ptrs.current.size) hover.current = null; }}
          onWheel={onWheel} onContextMenu={(e) => { e.preventDefault(); if (screenRef.current === 'play') turn(1); }} />
        {screen === 'play' && g && (
          <aside className="mm-side" ref={side} aria-label="Your tiles">
            <div className="mm-tiles">
              <div className="mm-cur">
                <small>THIS TILE</small>
                {cur ? <TileIcon edges={cur.e} rot={rotRef.current} wish={cur.wish} size={touch && orient === 'tall' ? 92 : 112} onClick={() => turn(1)} label="Your tile: click to turn it" /> : <span className="mm-empty">The stack is empty</span>}
                {cur && <span className="mm-rots" role="group" aria-label="Turns">
                  {Array.from({ length: 6 }, (_, i) => <button key={i} className={'mm-rot' + (i === rotRef.current ? ' is-on' : '') + (rotScores && rotScores[i] === bestRot && bestRot > 0 ? ' is-best' : '')} onClick={() => setRot(i)} aria-label={`Turn ${i}${rotScores ? `: ${rotScores[i]} points` : ''}`} title={rotScores ? `${rotScores[i]} points here` : `Turn ${i}`} />)}
                </span>}
              </div>
              <div className="mm-peek">
                <small>NEXT</small>
                {nxt ? <TileIcon edges={nxt.e} rot={0} wish={nxt.wish} size={touch && orient === 'tall' ? 52 : 62} label="The next tile" /> : <span className="mm-empty">—</span>}
              </div>
            </div>
            {cur?.wish && <p className="mm-wish-new">{EMOJI[ANIMAL_OF[cur.wish.terrain]]} This tile carries a wish: {wishText({ animal: ANIMAL_OF[cur.wish.terrain], terrain: cur.wish.terrain, size: cur.wish.size, kind: cur.wish.kind }).replace(/^A /, 'a ')}.</p>}
            <div className="mm-buttons">
              <button className="mm-btn" onClick={() => turn(-1)} aria-label="Turn left" title="Turn left (Q)">⟲</button>
              <button className="mm-btn" onClick={() => turn(1)} aria-label="Turn right" title="Turn right (R)">⟳</button>
              <button className="mm-btn" onClick={undo} disabled={!g.canUndo} aria-label="Undo the last tile" title="Undo (Z)">↶</button>
              <button className="mm-btn" onClick={() => scene.current?.frame()} aria-label="Frame the valley" title="Frame (F)">⌖</button>
              <button className="mm-btn" onClick={() => scene.current?.zoomAt(1.25)} aria-label="Zoom in" title="Zoom in (+)">＋</button>
              <button className="mm-btn" onClick={() => scene.current?.zoomAt(0.8)} aria-label="Zoom out" title="Zoom out (−)">－</button>
              {touch && <button className={`mm-btn mm-place${pending.current && !g.done ? ' mm-ready' : ''}`} onClick={() => { const p = pending.current; if (p) placeAt(p[0], p[1]); }} disabled={!pending.current || !!g.done} aria-label="Place the tile">✓</button>}
            </div>
            <div className="mm-wishes" aria-label="Wishes">
              <small>WISHES</small>
              {openWishes.length === 0 ? <p className="mm-none">{g.stats.wishesDone ? `No open wishes right now. ${g.stats.wishesDone} granted so far!` : 'No wishes yet. Now and then a tile brings one.'}</p> : openWishes.map((w) => (
                <p key={w.id} className={'mm-wish is-' + w.state}>
                  <span className="mm-wish-ico">{EMOJI[w.animal]}</span>
                  <span className="mm-wish-text"><b>{w.terrain === 'stream' ? 'Stream' : TERRAIN_NAME[w.terrain][0].toUpperCase() + TERRAIN_NAME[w.terrain].slice(1)} {w.kind === 'exact' ? `of exactly ${w.size}` : `of ${w.size}+`}</b>
                    <small>{w.state === 'done' ? 'Granted!' : w.state === 'failed' ? 'Spoiled' : `${w.now} of ${w.size}${w.kind === 'exact' ? ', then finish it' : ''}`}</small></span>
                  {w.state === 'open' && <i className="mm-wish-bar"><i style={{ width: `${Math.min(100, (w.now / w.size) * 100)}%` }} /></i>}
                </p>
              ))}
            </div>
            <ul className="mm-legend" aria-label="What scores">
              <li><b>✓ +10</b> each matching edge</li>
              <li><b>★ +60</b> a Perfect, and a tile</li>
              <li><b>💧</b> a pond: every stream end joined</li>
              <li><b>🌿</b> a finished patch: no open side</li>
              <li><b>🌰</b> {scored ? `acorns at ${targets.join(' · ')}` : g.mode.kind === 'tutorial' ? 'acorns wait in the valleys' : 'how far can the tiles go?'}</li>
            </ul>
          </aside>
        )}
        {guideText && !paused && !result && <div className="mm-guide" role="status"><b>{TUTORIAL.name} · {Math.min(GUIDE.length, g!.turn + 1)}/{GUIDE.length}</b><span>{guideText}</span></div>}
        {screen === 'play' && g && touch && !result && !paused && !g.done && g.turn < 2 && g.mode.kind !== 'tutorial' && <p className="mm-tip">Tap a cell to try the tile there · tap again (or ✓) to place</p>}
      </div>
      {error && <div className="mm-panel mm-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="mm-menu" aria-label="Meadowmend">
          <header className="mm-head"><a href="/" className="mm-back">← ARCADE</a>{settings}</header>
          <div className="mm-hero">
            <Art src="/art/meadow/title.webp" paint="title" w={1536} h={1024} className="mm-hero-art" />
            <div><p className="mm-eyebrow">A COSY HEX TILE-LAYING VALLEY BUILDER</p><h1>Meadow<em>mend</em></h1>
              <p className="mm-lede">Winter is over and the valley below the burrow is patchy and bare. Dora and Enzo mend it one hexagon at a time: meadows, woods, burrow-hills and streams, for the bees, the hedgehogs, the rabbits and the ducks.</p></div>
          </div>
          <div className="mm-go-row">
            {hasRun ? <button className="mm-go" disabled={!ready} onClick={resume}>CONTINUE →<small>{runLabel}</small></button>
              : mounted && !S.tutorial ? <button className="mm-go" disabled={!ready} onClick={() => start({ kind: 'tutorial' })}>{!ready ? 'Gathering tiles…' : 'START →'}<small>{TUTORIAL.name}: a guided first valley</small></button>
                : <button className="mm-go" disabled={!ready} onClick={() => start({ kind: 'valley', valley: VALLEY_IDS[nextValley] })}>{!ready ? 'Gathering tiles…' : 'PLAY →'}<small>{mounted ? VALLEYS[VALLEY_IDS[nextValley]].name : ' '}</small></button>}
            <button className="mm-alt" disabled={!ready} onClick={() => { audio().ui(); sound.current?.music('menu'); setScreen('valleys'); }}>🗺 Valleys<small>{mounted ? `${acornCount(S)} of ${VALLEY_IDS.length * 3} acorns` : ' '}</small></button>
            <button className="mm-alt" disabled={!ready} onClick={() => start({ kind: 'tutorial' })}>🌱 {TUTORIAL.name}<small>{mounted && S.tutorial ? 'play it again' : 'learn the edges'}</small></button>
            {mounted && endlessOpen(S) ? (<>
              <button className="mm-alt mm-dusk" disabled={!ready} onClick={() => startEndless(false)}>🌼 Endless Meadow<small>{S.endless.best ? `best ${S.endless.best}` : 'as long as the tiles last'}</small></button>
              <button className="mm-alt mm-dusk" disabled={!ready} onClick={() => startEndless(true)}>📅 Daily Valley<small>{S.daily.date === dateRef.current && S.daily.best ? `today ${S.daily.best}` : 'new today'}</small></button>
            </>) : <button className="mm-alt" disabled><span>🌼 Endless &amp; Daily</span><small>after your first acorn</small></button>}
            {mounted && S.ended && <button className="mm-alt" onClick={() => { audio().ui(); setEnding(true); sound.current?.music('ending'); }}>🌅 The ending</button>}
          </div>
          {hasRun && <p className="mm-note">A run is waiting where you left it. Starting another valley sets it aside for good.</p>}
          <ol className="mm-how" aria-label="How to play">
            <li><b>⬡ Turn and place.</b> Each tile has six edges: meadow, woods, burrow-hill or stream. Set it next to the valley; every edge that matches its neighbour scores.</li>
            <li><b>★ Perfect!</b> A tile whose six sides all match is Perfect and adds tiles to your stack. Rocks and the valley’s edge never spoil one.</li>
            <li><b>💧 Ponds.</b> Streams must meet streams. Join every end of a stream and it becomes a pond, ducklings and all.</li>
            <li><b>🦔 Wishes.</b> The neighbours ask for a woods, meadow, hill or stream of a certain size. Grant them for points and tiles. The run ends when the stack is empty.</li>
          </ol>
          <p className="mm-keys">{keysLine}</p>
          <p className="mm-keys">On a phone: tap a cell to try the tile there, tap it again (or ✓) to place; drag to pan, pinch to zoom, ⟳ to turn.</p>
        </section>
      )}

      {screen === 'valleys' && (
        <section className="mm-menu mm-valleys" aria-label="Valleys">
          <header className="mm-head"><button className="mm-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="mm-total">🌰 {mounted ? acornCount(S) : 0} / {VALLEY_IDS.length * 3} acorns</b></header>
          <div className="mm-grid">
            <button className="mm-card is-tut" disabled={!ready} onClick={() => start({ kind: 'tutorial' })} aria-label={`${TUTORIAL.name}: the tutorial`}>
              <Art src="" paint="valley" valley="tutorial" w={384} h={220} className="mm-card-art" />
              <span className="mm-card-text"><small>TUTORIAL · {TUTORIAL.feature.toUpperCase()}</small><b>🌱 {TUTORIAL.name}</b><span>{TUTORIAL.blurb}</span><em>{mounted && S.tutorial ? '✓ done' : 'start here'}</em></span>
            </button>
            {VALLEY_IDS.map((id, i) => {
              const v = VALLEYS[id], open = mounted && valleyOpen(S, i), d = mounted ? S.valleys[id] : undefined;
              return (
                <button key={id} className={'mm-card' + (open ? '' : ' is-locked') + (d?.acorns ? ' is-done' : '')} disabled={!open || !ready} onClick={() => start({ kind: 'valley', valley: id })} aria-label={`Valley ${i + 1}: ${v.name}${open ? '' : ' (locked)'}`}>
                  <Art src="" paint="valley" valley={id} w={384} h={220} className="mm-card-art" />
                  <span className="mm-card-text">
                    <small>VALLEY {i + 1} · {v.feature.toUpperCase()}</small>
                    <b>{open ? v.name : '🔒 ' + v.name}</b>
                    <span>{v.blurb}</span>
                    <Acorns n={d?.acorns ?? 0} />
                    <em>{d?.best ? `best ${d.best} · ` : ''}{open ? `🌰 ${v.acorns.join(' · ')} · ${v.tiles} tiles` : 'an acorn in the valley before opens it'}</em>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mm-note">Each valley is the same deal of tiles every time, so you can come back and do better. Acorns: one, two or three for reaching each score.</p>
        </section>
      )}

      {screen === 'play' && g && (<>
        {result && peekEnd && <button className="mm-go mm-back-to" onClick={() => setPeekEnd(false)}>Back to the score ↑</button>}
        {result && !peekEnd && (
          <div className="mm-panel mm-result" role="dialog" aria-label="The valley is mended">
            <p className="mm-eyebrow">{g.mode.kind === 'tutorial' ? 'FIRST SPRING · DONE' : g.full ? 'NOT AN EMPTY CELL LEFT' : 'THE STACK IS EMPTY'}</p>
            <h2>{runName}</h2>
            <p className="mm-final-score" data-testid="final-score">{g.score}<small> points</small></p>
            {scored && <Acorns n={result.acorns} big />}
            {scored && <p className="mm-note">{result.newAcorns ? `🌰 ${result.newAcorns} new acorn${result.newAcorns > 1 ? 's' : ''}! ` : ''}{result.best ? 'A new best! ' : ''}Acorns at {targets.join(' · ')}.</p>}
            {g.mode.kind === 'endless' && <p className="mm-note">{result.best ? '★ A new best! ' : ''}{g.mode.daily ? `Today’s best ${S.daily.best}` : `Best ${S.endless.best}`}</p>}
            <ul className="mm-tally">
              <li><b>{g.stats.placed}</b><small>tiles placed</small></li>
              <li><b>{g.stats.matches}</b><small>matching edges</small></li>
              <li><b>{g.stats.perfects}</b><small>Perfects</small></li>
              <li><b>{g.stats.wishesDone}</b><small>wishes granted</small></li>
              <li><b>{g.stats.ponds}</b><small>ponds</small></li>
              <li><b>{g.stats.closes}</b><small>patches finished</small></li>
            </ul>
            <div className="mm-row">
              {g.mode.kind === 'tutorial'
                ? <button className="mm-go" autoFocus onClick={() => start({ kind: 'valley', valley: 'clover' })}>To the valleys →<small>{VALLEYS.clover.name}</small></button>
                : <button className="mm-go" autoFocus onClick={() => start(g.mode.kind === 'endless' && !g.mode.daily ? { ...g.mode, seed: (g.mode.seed * 1103515245 + 12345) >>> 0 } : g.mode)}>⟲ Again<small>{g.mode.kind === 'endless' && !g.mode.daily ? 'a new valley' : 'the same tiles'}</small></button>}
              {g.mode.kind === 'valley' && VALLEY_IDS.indexOf(g.mode.valley) + 1 < VALLEY_IDS.length && valleyOpen(S, VALLEY_IDS.indexOf(g.mode.valley) + 1) && <button className="mm-alt" onClick={() => start({ kind: 'valley', valley: VALLEY_IDS[VALLEY_IDS.indexOf((g.mode as { valley: ValleyId }).valley) + 1] })}>Next valley →</button>}
              <button className="mm-alt" onClick={() => setPeekEnd(true)}>👀 See the valley</button>
              <button className="mm-alt" onClick={() => toMenu('valleys')}>🗺 Valleys</button>
              <button className="mm-alt" onClick={() => toMenu()}>Menu</button>
            </div>
          </div>
        )}
        {paused && (
          <div className="mm-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>The bees will wait.</p>
            {settings}
            <p className="mm-keys">{keysLine}</p>
            <div className="mm-row"><button className="mm-go" onClick={() => pause(false)}>Keep mending</button><button className="mm-alt" onClick={() => { pause(false); start(g.mode); }}>Restart</button><button className="mm-alt" onClick={() => toMenu('valleys')}>Valleys</button><button className="mm-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
        )}
      </>)}
      {ending && (
        <div className="mm-ending" role="dialog" aria-label="The valley is mended">
          <Art src="/art/meadow/ending.webp" paint="ending" w={1536} h={1024} className="mm-ending-art" />
          <div className="mm-ending-text">
            <p className="mm-eyebrow">EVERY VALLEY · MENDED</p>
            <h2>Evening by the pond</h2>
            <p>Seven valleys, a great many tiles, and not a bare patch left. Dora and Enzo sit on the bank of the round pond as the sun goes down, the ducklings paddle past in a line, and somewhere in the woods a hedgehog is very pleased with itself.</p>
            <p className="mm-final">{mounted ? acornCount(S) : 0} of {VALLEY_IDS.length * 3} acorns{mounted && acornCount(S) < VALLEY_IDS.length * 3 ? ' · more acorns wait in the valleys' : ' · every acorn in the valley!'} · 🌼 the Endless Meadow is always open</p>
            <div className="mm-row"><button className="mm-go" onClick={() => { setEnding(false); toMenu('valleys'); }}>🗺 Valleys →</button><button className="mm-alt" onClick={() => { setEnding(false); if (screenRef.current !== 'play') sound.current?.music('menu'); }}>Close</button></div>
          </div>
          <div className="mm-credits" aria-label="Cast"><div>
            <p className="mm-eyebrow">STARRING</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="mm-eyebrow">THANK YOU FOR PLAYING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
