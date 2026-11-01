'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PUZZLES, PUZZLE_IDS, ROOMS, PARTS, SAVE_KEY, SETTLES, SANDBOX_MAX, PAYOFF, DT, Run, freshSave, readSave, placeProblem, settle, snapTo, trayLeft, starBits, starCount,
  totalStars, done, roomOpen, puzzleOpen, roomCount, freeOpen, freePuzzle, nextPuzzle, recordRun,
  type Save, type Puzzle, type Place, type PartId,
} from '@/lib/clatter-game';
import type { ClatterScene, Pose } from '@/lib/clatter-scene';
import { ClatterSound, type SongId } from './sound';
import './clatter.css';

type Screen = 'menu' | 'rooms' | 'play' | 'show';
type Mode = 'edit' | 'run' | 'over';
type Result = { bits: number; newStars: number; parts: number; first: boolean; finale: boolean };
type Drag =
  | { k: 'move'; i: number; ox: number; oy: number; sx: number; sy: number; moved: boolean }
  | { k: 'new'; p: PartId; sx: number; sy: number; moved: boolean };
const sceneModule = () => import('@/lib/clatter-scene');
const FREE = 'free';
/** Phones on their side: the tray and the result card stand at the right (as in clatter.css), so the board moves left. */
const SIDE = '(max-height:500px) and (min-aspect-ratio:1/1)';
const ROOM_ICON = ['🍳', '🧸', '🪴', '🕯️', '🎪'];
const CAST: [string, string][] = [['Dora', 'chief tinkerer, tape and string'], ['Enzo', 'chief tinkerer, dominoes and very loud clacks'], ['The hedgehog', 'who slept through most of it'], ['The sparrow', 'who ate every acorn'], ['The rabbit, the mouse, the owl and the badger', 'the best audience in the wood']];
const no = (id: string) => { const P = PUZZLES[id]; return `${P.room + 1}-${P.n + 1}`; };
const GOALS: Record<string, string> = { bell: 'ring the bell', hedgehog: 'wake the hedgehog', bowl: 'feed the sparrow', lantern: 'light the lantern', train: 'toot the train' };
const goalText = (P: Puzzle) => [...new Set(P.items.filter((it) => GOALS[it.p]).map((it) => GOALS[it.p]))].join(' · ');

/** A painting with a cardboard stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className }: { src: string; paint: 'title' | 'backdrop' | 'ending'; w: number; h: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (!dead && c) m.paintStandIn(c, paint); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'cb-art ' + (className ?? '')}>
      <canvas ref={cv} width={w / 4} height={h / 4} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {src && !hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A part drawn for the tray. */
function PartIcon({ p }: { p: PartId }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; try { new m.ClatterScene(c).icon(p); } catch { /* no canvas */ } }).catch(() => {});
    return () => { dead = true; };
  }, [p]);
  return <canvas ref={cv} className="cb-icon" aria-hidden="true" />;
}
const Acorns = ({ bits, big = false }: { bits: number; big?: boolean }) => (
  <span className={'cb-stars' + (big ? ' is-big' : '')} aria-label={`${starCount(bits)} of 3 acorns`}>{[1, 2, 4].map((b) => <i key={b} className={bits & b ? 'is-on' : ''} />)}</span>
);

export default function ClatterPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null), trayEl = useRef<HTMLDivElement>(null), lineEl = useRef<HTMLDivElement>(null), resultEl = useRef<HTMLDivElement>(null);
  const scene = useRef<ClatterScene | null>(null), sound = useRef<ClatterSound | null>(null);
  const save = useRef<Save>(freshSave());
  const puz = useRef<Puzzle | null>(null), places = useRef<Place[]>([]), run = useRef<Run | null>(null), mode = useRef<Mode>('edit');
  const sel = useRef(-1), drag = useRef<Drag | null>(null), ptr = useRef<number | null>(null), hover = useRef<{ pl: Place; bad: boolean } | null>(null), armed = useRef<PartId | null>(null);
  const ghost = useRef<number[][] | null>(null), hintPl = useRef<{ pl: Place; until: number } | null>(null), speed = useRef(1), acc = useRef(0);
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), panelRef = useRef(false);
  const now = useRef(0), goalAt = useRef(-9), failAt = useRef(-9), winAt = useRef(-1), showDone = useRef(false), justDragged = useRef(false);
  const toastTimer = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [result, setResult] = useState<Result | null>(null), [toast, setToast] = useState(''), [tip, setTip] = useState<{ title: string; text: string } | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new ClatterSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3400) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const isFree = () => puz.current?.id === FREE;
  const busy = () => screenRef.current !== 'play' || !puz.current || pausedRef.current || panelRef.current;

  // ---------------------------------------------------------------- opening puzzles
  function open(id: string) {
    const s = save.current;
    if (id === FREE) { if (!freeOpen(s)) return; }
    else if (!puzzleOpen(s, id)) return;
    audio().ui();
    const P = id === FREE ? freePuzzle(s) : PUZZLES[id];
    puz.current = P;
    places.current = id === FREE ? s.free.filter((pl) => (P.tray[pl.p] ?? 0) > 0).map((pl) => ({ ...pl })) : [];
    rebuild(); mode.current = 'edit'; sel.current = -1; drag.current = null; hover.current = null; armed.current = null; ghost.current = null; hintPl.current = null;
    pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; setToast(''); winAt.current = -1; showDone.current = false;
    setTip(P.tip && !done(s, id) ? P.tip : null);
    scene.current?.clearFx();
    sound.current?.music(id === FREE ? 'free' : (`room${P.room}` as SongId));
    setScreen('play'); refresh();
    requestAnimationFrame(() => { layout(); canvas.current?.focus(); });
  }
  function toMenu(to: Screen = 'menu') {
    puz.current = null; run.current = null; sel.current = -1; drag.current = null; hover.current = null; armed.current = null;
    pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; setTip(null); setToast(''); setEnding(false);
    setScreen(to); sound.current?.music('menu'); refresh();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || panelRef.current || on === pausedRef.current) return;
    pausedRef.current = on; setPaused(on); drag.current = null; hover.current = null;
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }
  /** The world as placed, standing still, ready for Go. */
  function rebuild() { const P = puz.current; if (P) run.current = new Run(P, places.current); }
  function setPlaces(next: Place[]) {
    places.current = next; rebuild();
    if (isFree()) { save.current.free = next.map((p) => ({ ...p })); persist(); }
    refresh();
  }

  // ---------------------------------------------------------------- placing parts
  /** Where a part would go if let go at (x, y): snapped, settled onto a surface if it stands, and whether it fits. */
  function candidate(p: PartId, x: number, y: number, r: number, f: 0 | 1, skip = -1): { pl: Place; bad: 'zone' | 'bump' | null } {
    const P = puz.current!;
    const [sx, sy] = snapTo(P, x, y);
    let pl: Place = { p, x: sx, y: sy, r, f };
    if (SETTLES.includes(p)) { const s = settle(P, places.current, pl, skip); if (s) pl = s; else return { pl, bad: 'bump' }; }
    return { pl, bad: placeProblem(P, places.current, pl, skip) };
  }
  /** The faint part showing (a hint, or the first puzzle's guide): a part of its kind let go near it lands exactly on it. */
  function hinted(p: PartId, x: number, y: number): Place | null {
    const P = puz.current; if (!P || P.id === FREE) return null;
    const h = hintPl.current?.pl ?? (P.id === '1-1' && !save.current.tutorial && !places.current.length ? P.sol[0] : null);
    return h && h.p === p && Math.hypot(h.x - x, h.y - y) < 0.6 && !placeProblem(P, places.current, h) ? { ...h } : null;
  }
  const why = (bad: 'zone' | 'bump') => bad === 'zone' ? 'Parts go inside the dashed build areas.' : 'That spot is taken. Parts can’t overlap, or sit against a goal or the button.';
  function left(p: PartId) { const P = puz.current; return P ? trayLeft(P, places.current)[p] ?? 0 : 0; }
  /** Makes sure the contraption is standing at its start before a change. */
  function toEdit() { if (mode.current !== 'edit') rewind(true); }
  function addAt(p: PartId, x: number, y: number) {
    toEdit();
    if (left(p) <= 0) { audio().nope(); showToast(`No ${PARTS[p].name.toLowerCase()}s left in the tray.`); return false; }
    const h = hinted(p, x, y), c = h ? { pl: h, bad: null } : candidate(p, x, y, 0, 0);
    if (c.bad) { audio().nope(); showToast(why(c.bad)); return false; }
    setPlaces([...places.current, c.pl]); sel.current = places.current.length - 1; audio().place(); hintPl.current = null;
    return true;
  }
  /** Puts a part from the tray at the first free spot in a build area, nearest its middle (for keys and taps). */
  function addSomewhere(p: PartId) {
    const P = puz.current; if (!P || busy()) return;
    toEdit();
    if (left(p) <= 0) { audio().nope(); showToast(`No ${PARTS[p].name.toLowerCase()}s left in the tray.`); return; }
    for (const [x0, y0, x1, y1] of P.zones) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, spots: [number, number][] = [];
      for (let x = x0 + 0.5; x <= x1 - 0.5; x += 0.25) for (let y = y0 + 0.4; y <= y1 - 0.3; y += 0.25) spots.push([x, y]);
      spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      for (const [x, y] of spots) { const c = candidate(p, x, y, 0, 0); if (!c.bad) { setPlaces([...places.current, c.pl]); sel.current = places.current.length - 1; audio().place(); return; } }
    }
    audio().nope(); showToast('There’s no room left for that part.');
  }
  function change(i: number, to: Partial<Place>) {
    if (busy() || i < 0 || !places.current[i]) return false;
    toEdit();
    const old = places.current[i], c = candidate(old.p, to.x ?? old.x, to.y ?? old.y, to.r ?? old.r, (to.f ?? old.f) as 0 | 1, i);
    if (c.bad) { audio().nope(); showToast(why(c.bad)); return false; }
    const next = places.current.slice(); next[i] = c.pl; setPlaces(next); return true;
  }
  function rotate(d: number) { const i = sel.current, pl = places.current[i]; if (!pl || !PARTS[pl.p].rot) return; let r = pl.r + d; if (r > 12) r -= 24; if (r <= -12) r += 24; if (change(i, { r })) audio().turn(); }
  function flip() { const i = sel.current, pl = places.current[i]; if (!pl || !PARTS[pl.p].flip) return; if (change(i, { f: pl.f ? 0 : 1 })) audio().turn(); }
  function nudge(dx: number, dy: number) { const i = sel.current, pl = places.current[i]; if (!pl) return; change(i, { x: pl.x + dx, y: pl.y + dy }); }
  function remove() {
    const i = sel.current; if (busy() || i < 0 || !places.current[i]) return;
    toEdit(); setPlaces(places.current.filter((_, j) => j !== i)); sel.current = -1; audio().back();
  }
  function clearAll() {
    if (busy() || !places.current.length) return;
    if (isFree() && !window.confirm('Take every part out of the free build?')) return;
    toEdit(); setPlaces([]); sel.current = -1; audio().back();
  }
  function cycle(dir: number) {
    const n = places.current.length; if (!n || busy()) return;
    sel.current = sel.current < 0 ? (dir > 0 ? 0 : n - 1) : (sel.current + dir + n) % n; audio().pick(); refresh();
  }
  function hint() {
    const P = puz.current; if (!P || busy() || isFree()) return;
    toEdit();
    // the first part of the solution not already in place
    const used = new Set<number>();
    const miss = P.sol.find((s) => { const k = places.current.findIndex((pl, j) => !used.has(j) && pl.p === s.p && Math.abs(pl.x - s.x) < 0.3 && Math.abs(pl.y - s.y) < 0.3 && pl.r === s.r && pl.f === s.f); if (k >= 0) { used.add(k); return false; } return true; });
    if (!miss) { showToast('Everything is in place. Press Go!'); return; }
    hintPl.current = { pl: miss, until: now.current + 7 };
    audio().ui();
    const extra = places.current.length >= P.sol.length ? ' Some of your parts may need to move first.' : '';
    showToast(`Try a ${PARTS[miss.p].name.toLowerCase()} where the faint one glows${PARTS[miss.p].rot && miss.r ? ', turned like that' : ''}.${extra}`, 5600);
    refresh();
  }

  // ---------------------------------------------------------------- go, rewind and the payoff
  function go() {
    const P = puz.current; if (!P || busy()) return;
    if (mode.current !== 'edit') { rewind(); return; }
    audio().go();
    run.current = new Run(P, places.current); mode.current = 'run'; acc.current = 0; sel.current = -1; hover.current = null; armed.current = null; winAt.current = -1;
    setTip(null); scene.current?.clearFx(); refresh();
  }
  function rewind(quiet = false) {
    const r = run.current; if (!puz.current) return;
    if (r && r.steps > 0) ghost.current = r.trails.map((t) => t.slice());
    mode.current = 'edit'; winAt.current = -1; rebuild(); scene.current?.clearFx();
    if (!quiet) audio().rewind();
    refresh();
  }
  /** One frame of a running contraption: fixed steps, the events turned to puffs and noises, and the end of the run. */
  function tickRun(dt: number) {
    const r = run.current, P = puz.current; if (!r || !P) return;
    const live = mode.current === 'run' || (winAt.current >= 0 && r.steps < (P.time ?? 16) * 60 + 600);
    if (!live) return;
    acc.current += dt * speed.current;
    let n = 0;
    while (acc.current >= DT && n < 12) { r.step(); acc.current -= DT; n++; }
    if (n >= 12) acc.current = 0;
    const evs = r.take();
    if (evs.length) {
      scene.current?.events(evs); sound.current?.events(evs);
      for (const e of evs) if (e.k === 'goal') {
        goalAt.current = now.current;
        const q = r.goals.reduce((b, g) => (Math.hypot(g.x - e.x, g.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? g : b), r.goals[0]);
        if (q?.p === 'hedgehog') sound.current?.yawn(); else if (q?.p === 'bowl') sound.current?.cheep(); else if (q?.p === 'train') sound.current?.toot(); else if (q?.p === 'lantern') sound.current?.click();
      }
    }
    if (mode.current !== 'run') return;
    if (r.outcome === 'win' && winAt.current < 0) winAt.current = now.current;
    if (winAt.current >= 0 && now.current - winAt.current >= PAYOFF / Math.max(1, speed.current * 0.6)) { mode.current = 'over'; finishWin(); return; }
    if (r.outcome === 'stuck' || r.outcome === 'time') {
      mode.current = 'over'; failAt.current = now.current;
      if (screenRef.current === 'show') return;
      const hit = r.goalHit.filter(Boolean).length;
      showToast(hit ? `So close: ${hit} of ${r.goals.length} goals. Rewind, change something, and Go again.` : r.outcome === 'stuck' ? 'The chain stopped. Rewind, change a part, and Go again.' : 'Time’s up. Rewind, change a part, and Go again.', 4200);
      refresh();
    }
  }
  function finishWin() {
    const P = puz.current, r = run.current; if (!P || !r) return;
    if (screenRef.current === 'show') { showDone.current = true; sound.current?.applause(); window.setTimeout(() => { if (screenRef.current === 'show') { panelRef.current = true; setEnding(true); refresh(); } }, 1600); return; }
    if (P.id === FREE) { showToast('What a contraption! Every goal at once.'); sound.current?.applause(); refresh(); return; }
    const bits = starBits(true, places.current.length, P.par, r.token);
    const rec = recordRun(save.current, P.id, bits, places.current.length, places.current);
    if (P.id === '1-1') save.current.tutorial = true;
    persist();
    panelRef.current = true;
    setResult({ bits, newStars: rec.newStars, parts: places.current.length, first: rec.first, finale: rec.finale });
    sound.current?.stars(starCount(bits));
    if (rec.finale) sound.current?.applause();
    refresh();
  }
  function again() { setResult(null); panelRef.current = false; rewind(); requestAnimationFrame(() => { layout(); canvas.current?.focus(); }); }

  // ---------------------------------------------------------------- the Big Show
  function playShow() {
    audio().ui(); setEnding(false); setResult(null); panelRef.current = false;
    const P = PUZZLES[PUZZLE_IDS[PUZZLE_IDS.length - 1]];
    puz.current = P; places.current = P.sol.map((p) => ({ ...p })); rebuild(); mode.current = 'edit'; ghost.current = null; showDone.current = false; winAt.current = -1; sel.current = -1;
    scene.current?.clearFx();
    sound.current?.music('ending'); setScreen('show'); refresh();
    requestAnimationFrame(() => layout());
    window.setTimeout(() => { if (screenRef.current === 'show' && mode.current === 'edit') { run.current = new Run(P, places.current); mode.current = 'run'; acc.current = 0; audio().go(); } }, 1500);
  }

  /** The play area's clear room, so the box sits between the bar, the tray and any card. */
  function layout() {
    const el = stage.current, sc = scene.current, P = puz.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setOrient(r.width >= r.height ? 'wide' : 'tall');
    if (!sc) return;
    sc.resize();
    if (!P) return;
    const b = lineEl.current?.getBoundingClientRect() ?? bar.current?.getBoundingClientRect(), t = trayEl.current?.getBoundingClientRect();
    const side = !!t && t.width > 0 && t.height > t.width;
    sc.inset = {
      top: b && b.height > 0 ? Math.max(6, b.bottom - r.top + 4) : 10, left: 8,
      right: side && t ? Math.max(8, r.right - t.left + 6) : 8,
      bottom: !side && t && t.height > 0 ? Math.max(8, r.bottom - t.top + 6) : 10,
    };
    // the result card takes the bottom (or, on a phone on its side, the right): the payoff stays in view above it
    const card = resultEl.current, shell = card?.offsetParent?.getBoundingClientRect();
    if (card && shell) {
      const top = shell.top + card.offsetTop, lft = shell.left + card.offsetLeft;
      if (window.matchMedia?.(SIDE).matches) sc.inset.right = Math.max(8, r.right - lft + 6);
      else sc.inset.bottom = Math.max(8, r.bottom - top + 6);
    }
    if (screenRef.current === 'show') sc.inset.bottom = Math.max(sc.inset.bottom, Math.min(r.height * 0.24, 170));
    sc.layout(P);
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse);
    setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__clatter = () => {
      const r = run.current;
      return { screen: screenRef.current, puzzle: puz.current?.id ?? null, places: places.current.map((p) => ({ ...p })), mode: mode.current, selected: sel.current, armed: armed.current, outcome: r?.outcome ?? null, won: !!r?.won, goals: r?.goalHit.slice() ?? [], token: !!r?.token, t: r?.t ?? 0, paused: pausedRef.current, result: !!panelRef.current, save: save.current };
    };
    w.__clatterOpen = (id: string) => open(id);
    /** Places a part directly (for tests): returns why it can't go, or null. */
    w.__clatterPlace = (pl: Place) => { const P = puz.current; if (!P) return 'none'; toEdit(); const bad = placeProblem(P, places.current, pl); if (!bad) setPlaces([...places.current, { ...pl }]); return bad; };
    w.__clatterSolve = () => { const P = puz.current; if (!P) return false; toEdit(); setPlaces(P.sol.map((p) => ({ ...p }))); return true; };
    w.__clatterGo = () => go();
    /** Runs the contraption on, fast, for `secs` seconds (for screenshots). */
    w.__clatterAdvance = (secs: number) => { const r = run.current; if (!r || mode.current !== 'run') return false; const n = Math.round(secs / DT); for (let i = 0; i < n && mode.current === 'run'; i++) tickRun(DT); return true; };
    /** Client coordinates of a board point. */
    w.__clatterPoint = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(); return [b.left + sc.sx(x), b.top + sc.sy(y)]; };
    w.__clatterLayout = () => {
      const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null;
      const b = cv.getBoundingClientRect(), L = sc.lay, s = L.ps;
      const box = (p: [number, number], k: number) => ({ x: b.left + p[0] - s * 0.42 * k, y: b.top + p[1] - s * 0.98 * k, w: s * 0.84 * k, h: s * 0.98 * k });
      return { board: { x: b.left + L.board.x, y: b.top + L.board.y, w: L.board.w, h: L.board.h }, dora: box(L.dora, 1), enzo: box(L.enzo, 1.06), size: s, s: L.s };
    };
    w.__clatterShow = () => playShow();
    let dead = false, raf = 0, last = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.ClatterScene(canvas.current); } catch { setError('This browser cannot draw the box.'); return; }
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const frozen = pausedRef.current;
        if (!frozen) { now.current += dt; tickRun(dt); }
        const sc = scene.current!, P = puz.current, r = run.current;
        if (P && r && (screenRef.current === 'play' || screenRef.current === 'show')) {
          if (hintPl.current && now.current > hintPl.current.until) hintPl.current = null;
          const t = now.current, md = mode.current, won = winAt.current >= 0;
          let dora: Pose = 'idle', enzo: Pose = 'idle', look: [number, number] | null = null;
          if (md === 'run' || won) {
            look = r.hot; dora = 'watch'; enzo = 'watch';
            if (won || t - goalAt.current < 1.6) { dora = 'cheer'; enzo = 'cheer'; }
            else {
              // a near miss: something fast heading close by a goal not yet met, and Enzo can't look
              const b = r.B.world.bodies.find((x) => !x.isStatic && Math.hypot(x.vx, x.vy) > 2.5 && r.goals.some((g, i) => !r.goalHit[i] && Math.hypot(g.x - x.x, g.y + 0.4 - x.y) < 1.5));
              if (b) enzo = 'wince';
            }
          } else if (md === 'over') { dora = t - failAt.current < 3 ? 'think' : 'idle'; enzo = t - failAt.current < 3 ? 'think' : 'idle'; look = r.hot; }
          else if (drag.current || armed.current || hintPl.current) { dora = 'point'; look = hover.current ? [hover.current.pl.x, hover.current.pl.y] : hintPl.current ? [hintPl.current.pl.x, hintPl.current.pl.y] : null; }
          else if (sel.current >= 0 && places.current[sel.current]) { look = [places.current[sel.current].x, places.current[sel.current].y]; }
          if (screenRef.current === 'show' && md === 'edit') { dora = 'wave'; enzo = 'wave'; }
          const first = P.id === '1-1' && !save.current.tutorial && !places.current.length && md === 'edit';
          sc.draw({
            dt: frozen ? 0 : dt, run: r, P, running: md !== 'edit', ghost: md === 'edit' ? ghost.current : null,
            sel: md === 'edit' ? sel.current : -1, bad: -1, hover: md === 'edit' && hover.current ? hover.current.pl : null, hoverBad: !!hover.current?.bad,
            hint: hintPl.current?.pl ?? (first ? P.sol[0] : null), dora, enzo, look, winT: won ? t - winAt.current : -1, zones: md === 'edit' && screenRef.current === 'play', audience: screenRef.current === 'show', guide: null,
          });
        }
        sound.current?.tickMusic(!pausedRef.current);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The box could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tgt = e.target as HTMLElement;
      if (screenRef.current === 'show' && k === 'escape') { e.preventDefault(); panelRef.current = true; setEnding(true); refresh(); return; }
      if (screenRef.current !== 'play' || !puz.current || panelRef.current) return;
      if (k === 'escape' || k === 'p') {
        if (e.repeat) return;
        e.preventDefault();
        if (drag.current || armed.current) { drag.current = null; armed.current = null; hover.current = null; refresh(); return; }
        if (sel.current >= 0 && k === 'escape') { sel.current = -1; refresh(); return; }
        pause(!pausedRef.current); return;
      }
      if (pausedRef.current) return;
      if (tgt.closest?.('button, a') && (k === 'enter' || k === ' ')) return;
      const step = e.shiftKey ? 1 : 0.25;
      const arrow: Record<string, [number, number]> = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, step], arrowdown: [0, -step] };
      if (arrow[k]) { e.preventDefault(); if (sel.current >= 0 && mode.current === 'edit') nudge(...arrow[k]); else cycle(k === 'arrowleft' || k === 'arrowdown' ? -1 : 1); return; }
      if (k === ' ' || k === 'enter' || k === 'g') { e.preventDefault(); go(); }
      else if (k === 'tab') { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); }
      else if (k === 'q') { e.preventDefault(); rotate(1); }
      else if (k === 'e') { e.preventDefault(); rotate(-1); }
      else if (k === 'f') { e.preventDefault(); flip(); }
      else if (k === 'delete' || k === 'backspace' || k === 'x') { e.preventDefault(); remove(); }
      else if (k === 'h') { e.preventDefault(); hint(); }
      else if (k === '.' || k === '>') { e.preventDefault(); speed.current = speed.current > 1 ? 1 : 3; refresh(); }
      else if (/^[1-9]$/.test(k)) {
        const kinds = Object.keys(puz.current.tray) as PartId[], p = kinds[+k - 1];
        if (p) { e.preventDefault(); addSomewhere(p); }
      }
    };
    const blur = () => { pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect(); window.clearTimeout(toastTimer.current);
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    requestAnimationFrame(() => layout());
    // a card that has just appeared settles its size a moment later (fonts, the acorns): fit the box again then
    const t1 = window.setTimeout(layout, 150), t2 = window.setTimeout(layout, 500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, orient, result, touch, tip]);

  // ---------------------------------------------------------------- the pointer: drag parts from the tray, move and pick placed ones
  const local = (e: { clientX: number; clientY: number }): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onDown = (e: React.PointerEvent) => {
    if (busy() || ptr.current !== null) return;
    audio();
    const sc = scene.current, r = run.current; if (!sc || !r) return;
    if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    if (mode.current !== 'edit') { if (mode.current === 'over') rewind(); return; }
    const [x, y] = local(e);
    if (armed.current) {
      if (!sc.inBoard(x, y)) return;
      const [bx, by] = sc.toBoard(x, y), p = armed.current;
      if (addAt(p, bx, by) && left(p) <= 0) armed.current = null;
      hover.current = null; refresh(); return;
    }
    const i = sc.hitPlaced(r, x, y);
    if (i >= 0) {
      sel.current = i; audio().pick();
      const [bx, by] = sc.toBoard(x, y), pl = places.current[i];
      drag.current = { k: 'move', i, ox: pl.x - bx, oy: pl.y - by, sx: x, sy: y, moved: false }; ptr.current = e.pointerId;
      try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
    } else sel.current = -1;
    refresh();
  };
  const onMove = (e: React.PointerEvent) => {
    const sc = scene.current; if (!sc || busy()) return;
    const [x, y] = local(e), d = drag.current;
    if (d && d.k === 'move' && e.pointerId === ptr.current) {
      if (!d.moved && Math.hypot(x - d.sx, y - d.sy) < 5) return;
      d.moved = true;
      const [bx, by] = sc.toBoard(x, y), pl = places.current[d.i];
      const c = candidate(pl.p, bx + d.ox, by + d.oy, pl.r, pl.f, d.i); hover.current = { pl: c.pl, bad: !!c.bad };
    } else if (!d && armed.current && e.pointerType === 'mouse') {
      if (!sc.inBoard(x, y)) { hover.current = null; return; }
      const [bx, by] = sc.toBoard(x, y), c = candidate(armed.current, bx, by, 0, 0); hover.current = { pl: c.pl, bad: !!c.bad };
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== ptr.current) return;
    const d = drag.current; drag.current = null; ptr.current = null;
    if (d?.k === 'move' && d.moved && hover.current) {
      const h = hover.current;
      if (h.bad) { audio().nope(); showToast(why(placeProblem(puz.current!, places.current, h.pl, d.i) ?? 'bump')); }
      else { const next = places.current.slice(); next[d.i] = h.pl; setPlaces(next); audio().place(); }
    }
    hover.current = null; refresh();
  };
  const onWheel = (e: React.WheelEvent) => { if (busy() || sel.current < 0) return; rotate((e.deltaY || e.deltaX) < 0 ? 1 : -1); };
  useEffect(() => {
    // React's wheel listener is passive; this one stops the page from scrolling
    const cv = canvas.current; if (!cv) return;
    const stopIt = (e: WheelEvent) => { if (screenRef.current === 'play') e.preventDefault(); };
    cv.addEventListener('wheel', stopIt, { passive: false });
    return () => cv.removeEventListener('wheel', stopIt);
  }, []);
  // a part dragged out of the tray: the button keeps the pointer, and the ghost follows it over the box
  const trayDown = (p: PartId) => (e: React.PointerEvent) => {
    if (busy() || ptr.current !== null || e.button > 0) return;
    audio(); if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    drag.current = { k: 'new', p, sx: e.clientX, sy: e.clientY, moved: false }; ptr.current = e.pointerId; justDragged.current = false;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
  };
  const trayMove = (e: React.PointerEvent) => {
    const d = drag.current, sc = scene.current; if (!d || d.k !== 'new' || e.pointerId !== ptr.current || !sc) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
    if (!d.moved) { d.moved = true; toEdit(); audio().pick(); }
    const [x, y] = local(e);
    if (!sc.inBoard(x, y)) { hover.current = null; return; }
    // on touch the part rides a little above the finger, so it can be seen
    const [bx, by] = sc.toBoard(x, y - (e.pointerType === 'mouse' ? 0 : 36)), h = hinted(d.p, bx, by), c = h ? { pl: h, bad: null } : candidate(d.p, bx, by, 0, 0); hover.current = { pl: c.pl, bad: !!c.bad };
  };
  const trayUp = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.k !== 'new' || e.pointerId !== ptr.current) return;
    drag.current = null; ptr.current = null;
    if (d.moved) {
      justDragged.current = true;
      const h = hover.current; hover.current = null;
      if (h && !h.bad && left(d.p) > 0) { setPlaces([...places.current, h.pl]); sel.current = places.current.length - 1; audio().place(); hintPl.current = null; }
      else if (h) { audio().nope(); showToast(why(placeProblem(puz.current!, places.current, h.pl) ?? 'bump')); }
    }
    refresh();
  };
  const trayClick = (p: PartId) => (e: React.MouseEvent) => {
    if (justDragged.current) { justDragged.current = false; return; }
    if (busy()) return;
    // from the keyboard: straight into the box; by tap or click: hold it, then touch the box where it goes
    if (e.detail === 0) { addSomewhere(p); return; }
    toEdit();
    if (left(p) <= 0) { audio().nope(); showToast(`No ${PARTS[p].name.toLowerCase()}s left in the tray.`); return; }
    armed.current = armed.current === p ? null : p; sel.current = -1; audio().pick(); refresh();
  };

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="cb-chips">
      <button className="cb-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="cb-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  const P = puz.current, free = P?.id === FREE, md = mode.current, si = sel.current, spl = si >= 0 ? places.current[si] : null;
  const trayKinds = P ? (Object.keys(P.tray) as PartId[]) : [];
  const keysLine = <>drag a part from the tray into a dashed area · drag it to move · <kbd>Q</kbd>/<kbd>E</kbd> or the wheel turn · <kbd>F</kbd> flip · arrows nudge · <kbd>1</kbd>–<kbd>9</kbd> add a part · <kbd>Tab</kbd> next part · <kbd>X</kbd> remove · <kbd>Space</kbd> Go / Rewind · <kbd>.</kbd> fast · <kbd>H</kbd> hint · <kbd>Esc</kbd> pause</>;
  const nextId = mounted ? nextPuzzle(S) : null;
  const startedAny = mounted && PUZZLE_IDS.some((id) => done(S, id));
  const totalMax = PUZZLE_IDS.length * 3;
  const nextAfter = (id: string) => { const i = PUZZLE_IDS.indexOf(id); return i >= 0 && i + 1 < PUZZLE_IDS.length ? PUZZLE_IDS[i + 1] : null; };
  const rec = P && !free ? S.puzzles[P.id] : undefined;

  return (
    <main className="cb-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-result={screen === 'play' && result ? 'true' : undefined} data-mode={md}>
      {screen === 'play' && P && (
        <header className="cb-bar" ref={bar}>
          <button className="cb-back" onClick={() => toMenu(free ? 'menu' : 'rooms')}>← {free ? 'Menu' : 'Rooms'}</button>
          <span className="cb-bar-mid">
            <b className="cb-name"><small>{free ? 'FREE BUILD' : no(P.id)}</small> {P.name}</b>
            {!free && <span className="cb-par" title={`Parts placed. Solving with ${P.par} or fewer earns the second acorn.`} data-testid="parts">🧩 <b>{places.current.length}</b><small> / par {P.par}</small></span>}
            {!free && rec?.done && <Acorns bits={rec.stars} />}
          </span>
          <button className="cb-chip cb-pause" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!!result}>❚❚</button>
        </header>
      )}
      <div className="cb-stage" ref={stage}>
        <canvas ref={canvas} className="cb-canvas" tabIndex={0} data-testid="box"
          aria-label="The contraption box. Drag parts from the tray into the dashed build areas, then press Go."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && P && (
          <div className={'cb-line' + (result ? ' is-after' : '')} ref={lineEl} role="status">
            <span>{result ? `“${P.after}”` : P.line}</span>
            {!result && !free && <small>{goalText(P)}{P.token ? ' · ★ bonus: touch the button' : ''}</small>}
          </div>
        )}
        {screen === 'play' && P && (
          <div className="cb-tray" ref={trayEl} role="toolbar" aria-label="The tray">
            <span className="cb-parts">
              {trayKinds.map((p, i) => {
                const n = left(p);
                return (
                  <button key={p} className={'cb-part' + (armed.current === p ? ' is-on' : '') + (n <= 0 ? ' is-out' : '')} disabled={n <= 0 && armed.current !== p}
                    onPointerDown={trayDown(p)} onPointerMove={trayMove} onPointerUp={trayUp} onPointerCancel={trayUp} onClick={trayClick(p)}
                    title={`${PARTS[p].name}: ${PARTS[p].blurb} (${i + 1})`} aria-label={`${PARTS[p].name}, ${n} left`} data-part={p}>
                    <PartIcon p={p} /><small>{PARTS[p].name}</small><em>{free ? '' : '×' + n}</em>
                  </button>
                );
              })}
            </span>
            <span className="cb-tools">
              <span className="cb-sel">{spl ? <><small>CHOSEN</small><b>{PARTS[spl.p].name}</b></> : <small>{armed.current ? (touch ? 'touch the box to place it' : 'click the box to place it') : md === 'edit' ? (touch ? 'drag a part into the box' : 'drag a part into a dashed area') : md === 'run' ? 'clattering…' : 'rewind to change it'}</small>}</span>
              <button className="cb-btn" onClick={() => rotate(1)} disabled={!spl || !PARTS[spl.p].rot || md !== 'edit'} aria-label="Turn left" title="Turn left (Q)">⟲</button>
              <button className="cb-btn" onClick={() => rotate(-1)} disabled={!spl || !PARTS[spl.p].rot || md !== 'edit'} aria-label="Turn right" title="Turn right (E)">⟳</button>
              <button className="cb-btn" onClick={flip} disabled={!spl || !PARTS[spl.p].flip || md !== 'edit'} aria-label="Flip" title="Flip it round (F)">⇋</button>
              <button className="cb-btn" onClick={remove} disabled={!spl || md !== 'edit'} aria-label="Back to the tray" title="Back to the tray (X)">↩</button>
              {free ? <button className="cb-btn" onClick={clearAll} disabled={!places.current.length} aria-label="Clear the box" title="Clear the box">🗑</button>
                : <button className="cb-btn cb-hint" onClick={hint} aria-label="Hint" title="A hint (H)">💡</button>}
              <button className={'cb-btn' + (speed.current > 1 ? ' is-on' : '')} onClick={() => { speed.current = speed.current > 1 ? 1 : 3; audio().ui(); refresh(); }} aria-pressed={speed.current > 1} aria-label="Fast forward" title="Fast forward (.)">⏩</button>
            </span>
            <button className={'cb-go' + (md !== 'edit' ? ' is-rewind' : '')} onClick={go} data-testid="go" title="Go / Rewind (Space)">{md === 'edit' ? '▶ Go!' : '⟲ Rewind'}</button>
          </div>
        )}
        {toast && <p className="cb-toast" role="status">{toast}</p>}
        {tip && screen === 'play' && !result && (
          <div className="cb-card cb-tip" role="dialog" aria-label={tip.title}>
            <p className="cb-eyebrow">✏️ A NEW PART</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="cb-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
        {screen === 'play' && P?.id === '1-1' && !S.tutorial && !tip && md === 'edit' && !places.current.length && (
          <div className="cb-guide" role="status"><b>The first puzzle</b><span>{touch ? 'Drag the ramp from the tray onto the faint one in the box, then press Go!' : 'Drag the ramp from the tray onto the faint one in the dashed box, then press Go!'}</span></div>
        )}
      </div>
      {error && <div className="cb-panel cb-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="cb-menu" aria-label="Clatterbox">
          <header className="cb-head"><a href="/" className="cb-back">← Arcade</a>{settings}</header>
          <div className="cb-hero">
            <Art src="/art/clatter/title.webp" paint="title" w={1536} h={1024} className="cb-hero-art" />
            <div className="cb-hero-text"><p className="cb-eyebrow">A CHAIN-REACTION CONTRAPTION PUZZLE</p><h1>Clatter<em>box</em></h1>
              <p className="cb-lede">Dora and Enzo’s workshop is a big cardboard box full of odds and ends. Put a few parts in just the right places, press Go, and watch it all go clack, boing, snip and ding.</p></div>
          </div>
          <div className="cb-go-row">
            <button className="cb-go" disabled={!ready} onClick={() => open(nextId ?? PUZZLE_IDS[PUZZLE_IDS.length - 1])}>{!ready ? 'Opening the box…' : startedAny ? 'Continue →' : 'Start building →'}<small>{mounted ? (nextId ? `${no(nextId)} · ${PUZZLES[nextId].name}` : 'every puzzle solved!') : ' '}</small></button>
            <button className="cb-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('rooms'); }}>📦 Puzzles<small>{mounted ? `${totalStars(S)} of ${totalMax} acorns` : ' '}</small></button>
            {mounted && freeOpen(S) ? <button className="cb-alt" disabled={!ready} onClick={() => open(FREE)}>🛠️ Free build<small>any parts, your own contraption</small></button>
              : <button className="cb-alt" disabled>🛠️ Free build<small>after the Kitchen Shelf</small></button>}
            {mounted && S.ended && <button className="cb-alt" disabled={!ready} onClick={playShow}>🎪 The Big Show<small>for the neighbours</small></button>}
          </div>
          <ol className="cb-how" aria-label="How to play">
            <li><b>🧩 Place the parts.</b> Drag parts from the tray into the dashed build areas. Turn ramps, flip fans and cars.</li>
            <li><b>▶ Press Go.</b> Watch the chain reaction. Rewind, change a part and go again: the last run’s path stays as a faint trail.</li>
            <li><b>🔔 Reach every goal.</b> Ring the bell, wake the hedgehog, feed the sparrow, light the lantern, toot the train.</li>
            <li><b>🌰 Three acorns.</b> One for solving, one for using par parts or fewer, one for touching the golden button.</li>
          </ol>
          <p className="cb-keys">{keysLine}</p>
          <p className="cb-keys">On a phone: drag a part from the tray into the box, or tap it and then tap the box. Drag a placed part to move it.</p>
        </section>
      )}

      {screen === 'rooms' && (
        <section className="cb-menu cb-rooms" aria-label="Puzzles">
          <Art src="/art/clatter/backdrop.webp" paint="backdrop" w={1536} h={1024} className="cb-backdrop" />
          <header className="cb-head"><button className="cb-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="cb-total">🌰 {mounted ? totalStars(S) : 0} / {totalMax}</b></header>
          {ROOMS.map((room, ri) => {
            const op = mounted && roomOpen(S, ri), n = mounted ? roomCount(S, ri) : 0;
            return (
              <section key={room.id} className={'cb-room' + (op ? '' : ' is-locked')} aria-label={room.name}>
                <div className="cb-room-head"><span className="cb-room-icon" aria-hidden="true">{ROOM_ICON[ri]}</span>
                  <div><small>ROOM {ri + 1} · {n}/{room.puzzles.length} SOLVED</small><h2>{op ? room.name : '🔒 ' + room.name}</h2><p>{op ? room.blurb : `Opens when “${ROOMS[ri - 1]?.name}” is finished.`}</p></div>
                </div>
                <div className="cb-grid">
                  {room.puzzles.map((id, i) => {
                    const Pz = PUZZLES[id], o = mounted && puzzleOpen(S, id), d = mounted ? S.puzzles[id] : undefined, last = i === room.puzzles.length - 1;
                    return (
                      <button key={id} className={'cb-lv' + (o ? '' : ' is-locked') + (d?.done ? ' is-done' : '') + (last ? ' is-finale' : '')} disabled={!o || !ready} onClick={() => open(id)} aria-label={`${no(id)}: ${Pz.name}${o ? '' : ' (locked)'}`}>
                        <small>{no(id)}{last ? ' · FINALE' : ''}</small>
                        <b>{o ? Pz.name : '🔒 ' + Pz.name}</b>
                        <Acorns bits={d?.stars ?? 0} />
                        <em>{d?.done && d.best !== null ? `best 🧩 ${d.best}` : o ? `par 🧩 ${Pz.par}` : last ? 'solve the room first' : 'solve one before'}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button className={'cb-free' + (mounted && freeOpen(S) ? '' : ' is-locked')} disabled={!mounted || !freeOpen(S) || !ready} onClick={() => open(FREE)} aria-label={`Free build${mounted && freeOpen(S) ? '' : ' (locked)'}`}>
            <b>🛠️ The free build</b><span>A big empty box, up to {SANDBOX_MAX} parts from every room you’ve opened, and a bell, a hedgehog and a sparrow to aim at.</span><em>{mounted && freeOpen(S) ? 'open' : 'opens after the Kitchen Shelf'}</em>
          </button>
          <p className="cb-note">Acorns: 🌰 solve it · 🌰 with par parts or fewer · 🌰 touch the golden button on the way.</p>
        </section>
      )}

      {screen === 'play' && P && (<>
        {result && (
          <div className="cb-panel cb-result" ref={resultEl} role="dialog" aria-label="Solved">
            <div className="cb-result-head">
              <div><p className="cb-eyebrow">{no(P.id)} · SOLVED!</p><h2>{P.name}</h2></div>
              <Acorns bits={result.bits} big />
            </div>
            <ul className="cb-tiers">
              <li className="is-on"><b>🌰</b> solved</li>
              <li className={result.bits & 2 ? 'is-on' : ''}><b>🌰</b> {result.parts} part{result.parts === 1 ? '' : 's'} (par {P.par})</li>
              <li className={result.bits & 4 ? 'is-on' : ''}><b>🌰</b> {P.token ? 'the golden button' : 'no button here'}</li>
            </ul>
            {result.newStars > 0 && !result.first && <p className="cb-note">🌰 {result.newStars} new acorn{result.newStars > 1 ? 's' : ''}!</p>}
            <div className="cb-row">
              {result.finale ? <button className="cb-go" autoFocus onClick={playShow}>The Big Show for the neighbours →</button>
                : (() => { const n = nextAfter(P.id); return n && puzzleOpen(S, n) ? <button className="cb-go" autoFocus onClick={() => open(n)}>Next →<small>{no(n)} · {PUZZLES[n].name}</small></button> : null; })()}
              <button className="cb-alt" onClick={again}>⟲ Again</button>
              <button className="cb-alt" onClick={() => toMenu('rooms')}>📦 Rooms</button>
            </div>
          </div>
        )}
        {paused && (
          <div className="cb-panel cb-pausecard" role="dialog" aria-label="Paused">
            <h2>Tea break</h2><p>The contraption will wait right where it is.</p>
            {settings}
            <p className="cb-keys">{keysLine}</p>
            <div className="cb-row"><button className="cb-go" onClick={() => pause(false)}>Back to the box</button><button className="cb-alt" onClick={() => toMenu(free ? 'menu' : 'rooms')}>{free ? 'Menu' : 'Rooms'}</button><button className="cb-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
        )}
      </>)}
      {screen === 'show' && !ending && (
        <>
          <p className="cb-showtitle">🎪 The Big Show</p>
          <button className="cb-skip cb-chip" onClick={() => { panelRef.current = true; setEnding(true); refresh(); }}>Skip ▸▸</button>
        </>
      )}
      {ending && (
        <div className="cb-ending" role="dialog" aria-label="The Big Show">
          <Art src="/art/clatter/ending.webp" paint="ending" w={1536} h={1024} className="cb-ending-art" />
          <div className="cb-ending-text">
            <p className="cb-eyebrow">FIVE ROOMS · THIRTY PUZZLES</p>
            <h2>The Big Show</h2>
            <p>The neighbours came in their best scarves and sat in a row in front of the box. The marble rolled, the dominoes clacked, the bell rang, the lantern lit and the night train tooted right on time. The hedgehog woke up for all of it. Then Dora and Enzo bowed, and the whole wood clapped until the tape came unstuck.</p>
            <p className="cb-final">🌰 {mounted ? totalStars(S) : 0} of {totalMax} acorns{mounted && totalStars(S) < totalMax ? ' · fewer parts and golden buttons earn the rest' : ' · every acorn!'} · 🛠️ the free build is always open</p>
            <div className="cb-row"><button className="cb-go" onClick={() => { setEnding(false); toMenu('rooms'); }}>📦 Puzzles →</button><button className="cb-alt" onClick={() => { setEnding(false); toMenu(); }}>Menu</button></div>
          </div>
          <div className="cb-credits" aria-label="Cast"><div>
            <p className="cb-eyebrow">THE COMPANY</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="cb-eyebrow">THANK YOU FOR WATCHING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
