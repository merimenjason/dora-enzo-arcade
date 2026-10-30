'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Builder, Sim, LEVELS, LEVEL_IDS, REGIONS, SANDBOX, MAT, MATS, DT, SAVE_KEY, readSave, freshSave, recordCross, levelOpen, crossed, medalCount, medalsFor,
  regionLevels, regionCleared, sandboxOpen, savedDesign, encode, memberCost, type Save, type LevelDef, type Mat, type Ev, type Outcome, type RegionId,
} from '@/lib/bridges-game';
import type { BridgeScene, Drag } from '@/lib/bridges-scene';
import { BridgeSound, type SongId } from './sound';
import './bridges.css';

type Screen = 'menu' | 'levels' | 'play';
type Result = { medals: number; newMedals: number; best: boolean; cost: number; over: boolean };
type Tool = 'build' | 'delete';
const sceneModule = () => import('@/lib/bridges-scene');
const ICON: Record<Mat, string> = { twig: '🌿', plank: '🪵', twine: '🧶', bamboo: '🎋' };
const REGION_ICON: Record<RegionId, string> = { brook: '🌊', ravine: '🌿', marsh: '🪷', canyon: '🌄' };
const CAST: [string, string][] = [['Dora', 'chief engineer, cart driver'], ['Enzo', 'carrier of planks and twine'], ['The heron', 'bridge inspector'], ['The duck', 'ferry captain'], ['The hay wagon', 'heavier than it looks']];
const FAIL: Record<Exclude<Outcome, 'cross'>, (L: LevelDef) => string> = {
  splash: (L) => (L.floor === 'canyon' ? 'Poof! Down into the dust. Dora and Enzo dust themselves off: try again.' : L.floor === 'ravine' ? 'Plop! Into the stream at the bottom. A soggy climb back up: try again.' : 'Splash! Into the water they go. Soggy, but smiling: try again.'),
  stuck: () => 'The cart couldn’t get across: too steep, or a gap in the road. Try again.',
  boat: () => 'Bonk! The bridge got in the boat’s way. Keep the striped lane clear.',
};

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className, region }: { src: string; paint: 'title' | 'ending' | 'region'; w: number; h: number; className?: string; region?: RegionId }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current; if (dead || !c) return;
      if (paint === 'title') m.paintTitle(c); else if (paint === 'ending') m.paintEnding(c); else m.paintRegion(c, region ?? 'brook');
    }).catch(() => {});
    return () => { dead = true; };
  }, [paint, region]);
  return (
    <span className={'bt-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {src && !hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
const Acorns = ({ n, of = 3, big = false }: { n: number; of?: number; big?: boolean }) => (
  <span className={'bt-acorns' + (big ? ' is-big' : '')} aria-label={`${n} of ${of} acorns`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'is-on' : ''}>🌰</i>)}</span>
);
const levelNo = (id: string) => { const L = LEVELS[id], r = REGIONS.findIndex((x) => x.id === L.region); return `${r + 1}-${regionLevels(L.region).indexOf(id) + 1}`; };

export default function BridgesPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), tools = useRef<HTMLDivElement>(null);
  const scene = useRef<BridgeScene | null>(null), sound = useRef<BridgeSound | null>(null);
  const save = useRef<Save>(freshSave());
  const level = useRef<LevelDef | null>(null), builder = useRef<Builder | null>(null), sim = useRef<Sim | null>(null);
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), panelRef = useRef(false);
  const matRef = useRef<Mat>('plank'), toolRef = useRef<Tool>('build'), speedRef = useRef(1), acc = useRef(0), endAt = useRef(0), triedRef = useRef(false), wagonRef = useRef(false);
  const drag = useRef<Drag | null>(null), dragFrom = useRef<[number, number] | null>(null), hoverMember = useRef(-1), hoverNode = useRef<[number, number] | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; type: string; moved: boolean; button: number; mode: 'build' | 'pan' | 'erase' }>()), pinch = useRef<{ d: number; mx: number; my: number } | null>(null);
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
  const audio = () => { sound.current ??= new BridgeSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3600) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const isSandbox = () => level.current?.id === SANDBOX.id;
  /** The sandbox's level with or without the wagon. */
  const sandboxLevel = (): LevelDef => ({ ...SANDBOX, vehicles: wagonRef.current ? ['cart', 'wagon'] : ['cart'] });

  /** Keeps the design in the save as it is built, so leaving and coming back finds it again. */
  function keepDesign() {
    const L = level.current, b = builder.current; if (!L || !b) return;
    if (L.id === SANDBOX.id) save.current.sandbox = encode(b.members);
    else { const d = save.current.levels[L.id] ?? { best: null, medals: 0, design: [], crossed: false }; d.design = encode(b.members); save.current.levels[L.id] = d; }
    persist();
  }
  /** Opens a level (or the sandbox) in build mode with its saved design. */
  function open(id: string) {
    const s = save.current;
    if (id !== SANDBOX.id && !levelOpen(s, id)) return;
    if (id === SANDBOX.id && !sandboxOpen(s)) return;
    audio().ui();
    wagonRef.current = s.sandboxWagon;
    const L = id === SANDBOX.id ? sandboxLevel() : LEVELS[id];
    level.current = L; sim.current = null; triedRef.current = false;
    const b = new Builder(L, savedDesign(s, id)); b.mirror = s.settings.mirror; builder.current = b;
    matRef.current = L.mats.includes('plank') ? 'plank' : L.mats[0]; toolRef.current = 'build';
    drag.current = null; dragFrom.current = null; hoverMember.current = -1; hoverNode.current = null;
    pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; setToast('');
    setTip(L.tip && !crossed(s, L.id) && !(L.id === 'b1' && !s.tutorial) ? L.tip : null);
    scene.current?.setLevel(L);
    sound.current?.music(L.region as SongId);
    setScreen('play'); refresh();
    requestAnimationFrame(() => { layout(); scene.current?.frame(true); canvas.current?.focus(); });
  }
  function toMenu(to: Screen = 'menu') {
    keepDesign();
    sim.current = null; level.current = null; builder.current = null; pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; setTip(null); setToast('');
    scene.current?.setLevel(null); setScreen(to); sound.current?.music('menu'); refresh();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || panelRef.current || on === pausedRef.current) return;
    pausedRef.current = on; setPaused(on);
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }

  // ---------------------------------------------------------------- building
  const building = () => screenRef.current === 'play' && !!builder.current && !sim.current && !pausedRef.current && !panelRef.current;
  function pickMat(m: Mat) { const L = level.current; if (!L || !L.mats.includes(m) || sim.current) return; matRef.current = m; toolRef.current = 'build'; audio().pick(); refresh(); }
  function setTool(t: Tool) { if (sim.current) return; toolRef.current = t; audio().ui(); refresh(); }
  function toggleMirror() { const b = builder.current; if (!b) return; b.mirror = !b.mirror; save.current.settings.mirror = b.mirror; persist(); audio().ui(); refresh(); }
  function toggleStress() { save.current.settings.stress = !save.current.settings.stress; persist(); audio().ui(); refresh(); }
  function place(ax: number, ay: number, bx: number, by: number) {
    const b = builder.current; if (!b) return false;
    const n = b.place(ax, ay, bx, by, matRef.current);
    if (!n) { audio().nope(); return false; }
    audio().place(matRef.current); keepDesign(); refresh(); return true;
  }
  /** Removes whatever is under a point: a joint and its members, or a member. */
  function eraseAt(wx: number, wy: number) {
    const b = builder.current, sc = scene.current; if (!b || !sc) return false;
    const reach = Math.max(0.3, 14 / sc.scale);
    const nd = nodeAt(wx, wy, reach);
    let n = 0;
    if (nd && !nd.anchor) n = b.removeNode(nd.x, nd.y);
    if (!n) { const i = b.pick(wx, wy, reach); if (i >= 0) n = b.removeAt(i); }
    if (n) { audio().remove(); keepDesign(); hoverMember.current = -1; refresh(); return true; }
    return false;
  }
  function undo() { const b = builder.current; if (!b || sim.current || !b.undo()) return; audio().undo(); keepDesign(); refresh(); }
  function redo() { const b = builder.current; if (!b || sim.current || !b.redo()) return; audio().undo(); keepDesign(); refresh(); }
  function clearAll() { const b = builder.current; if (!b || sim.current || !b.members.length) return; if (!window.confirm('Clear the whole bridge? (Undo can bring it back.)')) return; b.clear(); audio().remove(); keepDesign(); refresh(); }
  /** The joint or anchor nearest a world point, within reach. */
  function nodeAt(wx: number, wy: number, reach: number) {
    const b = builder.current; if (!b) return null;
    let best: { x: number; y: number; anchor: boolean } | null = null, bd = reach;
    for (const n of b.nodes().values()) { const d = Math.hypot(n.x - wx, n.y - wy); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  // ---------------------------------------------------------------- testing
  function test() {
    const L = level.current, b = builder.current; if (!L || !b || panelRef.current || pausedRef.current) return;
    if (sim.current) { stop(); return; }
    drag.current = null; dragFrom.current = null;
    sim.current = new Sim(L, b.members); acc.current = 0; endAt.current = 0; triedRef.current = true;
    audio().go(); setToast(''); refresh();
  }
  /** Back to building, with the bridge just as it was. */
  function stop() { sim.current = null; endAt.current = 0; audio().ui(); refresh(); }
  function finishRun(s: Sim) {
    const L = level.current!, b = builder.current!;
    if (s.outcome === 'cross') {
      const cost = b.cost;
      if (L.id === SANDBOX.id) { sim.current = null; showToast(`Across! That bridge cost 🌰 ${cost}.`); refresh(); return; }
      const r = recordCross(save.current, L.id, b.members);
      if (L.id === 'b1') save.current.tutorial = true;
      persist();
      panelRef.current = true;
      setResult({ medals: r.medals, newMedals: r.newMedals, best: r.best, cost, over: r.medals === 0 });
      if (r.finale) { setEnding(true); sound.current?.music('ending'); }
      refresh();
    } else {
      sim.current = null;
      showToast(FAIL[s.outcome as Exclude<Outcome, 'cross'>](L), 4200); refresh();
    }
  }

  /** The screen's clear area, so the camera frames the gap round the toolbar. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setOrient(r.width >= r.height ? 'wide' : 'tall');
    if (!sc) return;
    sc.resize();
    const t = tools.current?.getBoundingClientRect();
    sc.inset = { top: 8, right: 8, left: 8, bottom: t && t.height > 0 ? Math.max(8, r.bottom - t.top + 6) : 8 };
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse);
    setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__bridges = () => ({ level: level.current, builder: builder.current, sim: sim.current, mat: matRef.current, tool: toolRef.current, screen: screenRef.current });
    w.__bridgesOpen = (id: string) => open(id);
    w.__bridgesPoint = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(), [sx, sy] = sc.toScreen(x, y); return [b.left + sx, b.top + sy]; };
    w.__bridgesScene = () => scene.current?.metrics() ?? null;
    w.__bridgesSpeed = (n: number) => { speedRef.current = n; };
    let dead = false, raf = 0, last = 0, ui = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.BridgeScene(canvas.current); } catch { setError('This browser cannot draw the valley.'); return; }
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      if (level.current) scene.current.setLevel(level.current);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, playing = screenRef.current === 'play' && !!level.current;
        const frozen = pausedRef.current;
        const s = sim.current;
        let evs: Ev[] = [];
        if (playing && s && !frozen) {
          acc.current += dt * speedRef.current;
          let n = 0;
          while (acc.current >= DT && n < 10 * speedRef.current) { s.step(); acc.current -= DT; n++; }
          if (acc.current > DT) acc.current = 0;
          evs = s.events.splice(0);
          if (evs.length) { sc.feed(evs); sound.current?.play(evs, level.current!.region); }
          if (!s.outcome) sound.current?.creak(s.strain);
          if (s.outcome && !endAt.current) endAt.current = performance.now() + (s.outcome === 'cross' ? 1900 : 1800);
          if (endAt.current && performance.now() >= endAt.current && !panelRef.current && sim.current === s) { endAt.current = 0; finishRun(s); }
        }
        const b = builder.current;
        const guide = playing && b && !s ? tutorialStep()?.hand ?? null : null;
        sc.draw({
          dt: frozen ? 0 : dt, builder: playing ? b : null, sim: playing ? sim.current : null, drag: drag.current, hover: hoverMember.current, hoverNode: hoverNode.current,
          stress: save.current.settings.stress, tool: toolRef.current, mirror: !!b?.mirror && !sim.current, guide, celebrate: !!sim.current && sim.current.outcome === 'cross',
        });
        sound.current?.tick(!pausedRef.current);
        if (ms - ui > 200) { ui = ms; if (playing && !frozen && sim.current) refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The valley could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !level.current || panelRef.current) return;
      if (k === 'escape' || k === 'p') {
        if (e.repeat) return;
        e.preventDefault();
        if (drag.current) { drag.current = null; dragFrom.current = null; refresh(); return; }
        if (sim.current && k === 'escape') { stop(); return; }
        pause(!pausedRef.current); return;
      }
      if (pausedRef.current) return;
      // Space always tests, even just after clicking a toolbar button; Enter still presses a focused button
      if (tgt.closest?.('button, a') && (k === 'enter' || (k === ' ' && !tgt.closest('.bt-tools')))) return;
      const sc = scene.current, step = 60;
      const mi = ['1', '2', '3', '4'].indexOf(k);
      if (mi >= 0) { e.preventDefault(); pickMat(MATS[mi]); }
      else if (k === ' ' || k === 'enter' || k === 't') { e.preventDefault(); test(); }
      else if ((k === 'z' && (e.shiftKey)) || k === 'y') { e.preventDefault(); redo(); }
      else if (k === 'z' || k === 'u') { e.preventDefault(); undo(); }
      else if (k === 'delete' || k === 'backspace' || k === 'x') {
        e.preventDefault();
        const hn = hoverNode.current, b = builder.current;
        if (building() && b && hoverMember.current >= 0 && toolRef.current === 'delete') { b.removeAt(hoverMember.current); audio().remove(); keepDesign(); hoverMember.current = -1; refresh(); }
        else if (building() && b && hn && !b.level.anchors.some(([x, y]) => x === hn[0] && y === hn[1]) && b.removeNode(hn[0], hn[1])) { audio().remove(); keepDesign(); hoverNode.current = null; refresh(); }
        else setTool(toolRef.current === 'delete' ? 'build' : 'delete');
      }
      else if (k === 'm') { e.preventDefault(); toggleMirror(); }
      else if (k === 'v') { e.preventDefault(); toggleStress(); }
      else if (k === 'f') { e.preventDefault(); sc?.frame(); }
      else if (k === '+' || k === '=') { e.preventDefault(); sc?.zoomAt(1.2); }
      else if (k === '-' || k === '_') { e.preventDefault(); sc?.zoomAt(1 / 1.2); }
      else if (k === 'arrowleft' || k === 'a') { e.preventDefault(); sc?.pan(step, 0); }
      else if (k === 'arrowright' || k === 'd') { e.preventDefault(); sc?.pan(-step, 0); }
      else if (k === 'arrowup' || k === 'w') { e.preventDefault(); sc?.pan(0, step); }
      else if (k === 'arrowdown' || k === 's') { e.preventDefault(); sc?.pan(0, -step); }
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
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, orient, result, touch]);

  // ---------------------------------------------------------------- the pointer: drag to build, right-click or ✂ to remove, drag or pinch to look around
  const local = (e: React.PointerEvent | React.WheelEvent | React.MouseEvent): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const reachPx = (type: string) => (type === 'mouse' ? 16 : 28);
  function updateDrag(sx: number, sy: number) {
    const b = builder.current, sc = scene.current, from = dragFrom.current; if (!b || !sc || !from) return;
    const [wx, wy] = sc.toWorld(sx, sy);
    const t = b.target(from[0], from[1], wx, wy, matRef.current);
    const len = Math.hypot(t.x - from[0], t.y - from[1]);
    drag.current = { ax: from[0], ay: from[1], bx: t.x, by: t.y, m: matRef.current, ok: t.check.ok, why: t.check.ok ? undefined : t.check.why, cost: memberCost(matRef.current, len) };
  }
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || panelRef.current) return;
    audio();
    const [x, y] = local(e), sc = scene.current;
    if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
    let mode: 'build' | 'pan' | 'erase' = 'pan';
    if (sc && building()) {
      const [wx, wy] = sc.toWorld(x, y);
      if (e.button === 2 || (toolRef.current === 'delete' && e.button === 0)) mode = 'erase';
      else if (e.button === 0) { const nd = nodeAt(wx, wy, reachPx(e.pointerType) / sc.scale); if (nd) { mode = 'build'; dragFrom.current = [nd.x, nd.y]; drag.current = null; } }
    }
    ptrs.current.set(e.pointerId, { x, y, sx: x, sy: y, type: e.pointerType, moved: false, button: e.button, mode });
    if (ptrs.current.size === 2) {
      // two fingers: look around instead
      drag.current = null; dragFrom.current = null;
      const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      for (const p of ptrs.current.values()) { p.moved = true; p.mode = 'pan'; }
    }
    refresh();
  };
  const onMove = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || !scene.current) return;
    const [x, y] = local(e), p = ptrs.current.get(e.pointerId), sc = scene.current;
    if (!p) {
      // hovering with the mouse: show the joint or member under it
      if (e.pointerType === 'mouse' && building()) {
        const [wx, wy] = sc.toWorld(x, y), nd = nodeAt(wx, wy, 16 / sc.scale);
        hoverNode.current = nd ? [nd.x, nd.y] : null;
        hoverMember.current = toolRef.current === 'delete' && !nd ? builder.current!.pick(wx, wy, Math.max(0.25, 10 / sc.scale)) : -1;
      }
      return;
    }
    if (pinch.current && ptrs.current.size >= 2) {
      p.x = x; p.y = y;
      const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      sc.pan(mx - pinch.current.mx, my - pinch.current.my); if (pinch.current.d > 10) sc.zoomAt(d / pinch.current.d, mx, my);
      pinch.current = { d, mx, my }; return;
    }
    const dx = x - p.x, dy = y - p.y;
    if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > (p.type === 'mouse' ? 4 : 8)) p.moved = true;
    if (p.mode === 'build' && dragFrom.current) { if (p.moved) { updateDrag(x, y); refresh(); } }
    else if (p.mode === 'pan' && p.moved) sc.pan(dx, dy);
    p.x = x; p.y = y;
  };
  const onUp = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId); ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (!p) return;
    const d = drag.current;
    drag.current = null;
    const from = dragFrom.current; dragFrom.current = null;
    if (p.mode === 'build' && from && d && p.moved) { if (d.ok) place(d.ax, d.ay, d.bx, d.by); else { audio().nope(); if (d.why) showToast(d.why, 1800); } }
    else if (p.mode === 'erase' && !p.moved && scene.current) { const [x, y] = local(e), [wx, wy] = scene.current.toWorld(x, y); if (!eraseAt(wx, wy) && p.button === 0) audio().nope(); }
    refresh();
  };
  const onWheel = (e: React.WheelEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || panelRef.current) return;
    const [x, y] = local(e); scene.current?.zoomAt(Math.exp(-(e.deltaY || e.deltaX) * 0.0018), x, y);
  };
  useEffect(() => {
    // React's wheel listener is passive; this one stops the page from scrolling or zooming
    const cv = canvas.current; if (!cv) return;
    const stopIt = (e: WheelEvent) => e.preventDefault();
    cv.addEventListener('wheel', stopIt, { passive: false });
    return () => cv.removeEventListener('wheel', stopIt);
  }, []);

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="bt-chips">
      <button className="bt-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="bt-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  // ---------------------------------------------------------------- the tutorial on the first crossing
  function tutorialStep(): { text: string; hand: { from: [number, number]; to: [number, number] } | null } | null {
    const L = level.current, b = builder.current;
    if (!L || !b || L.id !== 'b1' || save.current.tutorial) return null;
    const has = (ax: number, ay: number, bx: number, by: number) => b.index(ax, ay, bx, by) > 0;
    if (!has(0, 0, 2, 0)) return { text: matRef.current === 'plank' ? 'Drag from the glowing anchor to the glowing spot to lay a plank: the road the cart rolls on.' : 'Pick Plank (2), then drag from the glowing anchor to the glowing spot.', hand: { from: [0, 0], to: [2, 0] } };
    if (!has(2, 0, 4, 0)) return { text: 'Now drag from your new joint to the far anchor to finish the road.', hand: { from: [2, 0], to: [4, 0] } };
    const strut = b.members.some((m) => m.m === 'twig');
    if (!triedRef.current && !strut) return { text: 'A road across! Press ▶ Test (or Space) and see whether it holds.', hand: null };
    if (!strut) return { text: matRef.current === 'twig' ? 'Planks alone sag and snap. Prop the middle joint from a low anchor: a triangle can’t squash.' : 'Planks alone sag and snap. Pick Twig (1) and prop up the middle joint from a low anchor.', hand: { from: [0, -2], to: [2, 0] } };
    return { text: 'A triangle! Press ▶ Test again. Fewer acorns spent earns more medals.', hand: null };
  }

  const L = level.current, b = builder.current, s = sim.current;
  const cost = b?.cost ?? 0, sandbox = L?.id === SANDBOX.id;
  const over = !!L && !sandbox && cost > L.budget;
  const medalsNow = L && !sandbox ? medalsFor(L, cost) : 0;
  const tut = screen === 'play' ? tutorialStep() : null;
  const keysLine = <><kbd>1</kbd>–<kbd>4</kbd> materials · drag from a joint to build · right-click or <kbd>X</kbd> remove · <kbd>Space</kbd> test · <kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>M</kbd> mirror · <kbd>V</kbd> stress · wheel zoom · drag to pan · <kbd>F</kbd> frame · <kbd>Esc</kbd> pause</>;
  const nextId = mounted ? LEVEL_IDS.find((id) => levelOpen(S, id) && !crossed(S, id)) ?? null : null;
  const startedAny = mounted && LEVEL_IDS.some((id) => (S.levels[id]?.design?.length ?? 0) > 0 || crossed(S, id));
  const total = LEVEL_IDS.length * 3;
  const nextAfter = (id: string) => { const i = LEVEL_IDS.indexOf(id); return i >= 0 && i + 1 < LEVEL_IDS.length ? LEVEL_IDS[i + 1] : null; };

  return (
    <main className="bt-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-mode={s ? 'test' : 'build'} data-touch={touch ? orient : undefined} data-region={L?.region}>
      {screen === 'play' && L && b && (
        <header className="bt-bar">
          <a href="/" className="bt-back">← ARCADE</a>
          <span className="bt-bar-mid">
            <b className="bt-name"><small>{sandbox ? 'SANDBOX' : levelNo(L.id)}</small> {L.name}</b>
            <span className={'bt-budget' + (over ? ' is-over' : '')} data-testid="budget" title="Acorns spent / the budget">🌰 <b>{cost}</b>{!sandbox && <small> / {L.budget}</small>}</span>
            {!sandbox && <span className="bt-prices" title={`One acorn within ${L.budget}, two within ${L.thrifty}, three within ${L.master}`}>
              <span className={medalsNow >= 2 ? 'is-on' : ''}>🌰🌰 ≤{L.thrifty}</span>
              <span className={medalsNow >= 3 ? 'is-on' : ''}>🌰🌰🌰 ≤{L.master}</span>
            </span>}
          </span>
          <button className="bt-chip bt-pause" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!!result}>❚❚</button>
        </header>
      )}
      <div className="bt-stage" ref={stage}>
        <canvas ref={canvas} className={'bt-canvas' + (toolRef.current === 'delete' && !s ? ' is-erase' : '')} tabIndex={0} data-testid="valley"
          aria-label="The crossing. Drag from a joint or anchor to build a member; right-click a member to remove it."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !ptrs.current.size) { hoverNode.current = null; hoverMember.current = -1; } }}
          onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && L && b && (
          <div className="bt-tools" ref={tools} role="toolbar" aria-label="Building tools">
            {!s ? (<>
              <span className="bt-mats" role="group" aria-label="Materials">
                {MATS.filter((m) => L.mats.includes(m)).map((m) => (
                  <button key={m} className={'bt-mat is-' + m + (matRef.current === m && toolRef.current === 'build' ? ' is-on' : '')} onClick={() => pickMat(m)} aria-pressed={matRef.current === m && toolRef.current === 'build'} aria-label={MAT[m].name} title={`${MAT[m].name} (${MAT[m].key}): ${MAT[m].blurb} Up to ${MAT[m].max} long, 🌰 ${MAT[m].cost} a unit.`}>
                    <i>{ICON[m]}</i><b>{MAT[m].name}</b><small>🌰{MAT[m].cost}</small>
                  </button>
                ))}
              </span>
              <span className="bt-btns">
                <button className={'bt-btn' + (toolRef.current === 'delete' ? ' is-on' : '')} onClick={() => setTool(toolRef.current === 'delete' ? 'build' : 'delete')} aria-pressed={toolRef.current === 'delete'} aria-label="Remove tool" title="Remove: tap a member or joint (X, or right-click)">✂</button>
                <button className={'bt-btn' + (b.mirror ? ' is-on' : '')} onClick={toggleMirror} aria-pressed={b.mirror} aria-label="Mirror building" title="Mirror: build one half, the other half follows (M)">⇋</button>
                <button className="bt-btn" onClick={undo} disabled={!b.canUndo} aria-label="Undo" title="Undo (Z)">↶</button>
                <button className="bt-btn" onClick={redo} disabled={!b.canRedo} aria-label="Redo" title="Redo (Y)">↷</button>
                <button className="bt-btn" onClick={clearAll} disabled={!b.members.length} aria-label="Clear the bridge" title="Clear everything">🗑</button>
                <button className={'bt-btn' + (S.settings.stress ? ' is-on' : '')} onClick={toggleStress} aria-pressed={S.settings.stress} aria-label="Stress view" title="Stress colours while testing (V)">📊</button>
                {sandbox && <button className={'bt-btn' + (wagonRef.current ? ' is-on' : '')} onClick={() => { wagonRef.current = !wagonRef.current; save.current.sandboxWagon = wagonRef.current; persist(); const nl = sandboxLevel(); level.current = nl; const nb = new Builder(nl, b.members); nb.mirror = b.mirror; builder.current = nb; scene.current?.setLevel(nl); refresh(); }} aria-pressed={wagonRef.current} aria-label="Hay wagon" title="Bring the hay wagon too">🌾</button>}
              </span>
            </>) : (
              <span className="bt-btns bt-testing">
                <span className="bt-strain" aria-label="Strain"><i style={{ width: `${Math.min(100, s.strain * 100)}%`, background: s.strain > 0.85 ? '#e5483a' : s.strain > 0.6 ? '#f2b33a' : '#60c468' }} /></span>
                <button className={'bt-btn' + (speedRef.current > 1 ? ' is-on' : '')} onClick={() => { speedRef.current = speedRef.current > 1 ? 1 : 2; audio().ui(); refresh(); }} aria-label="Fast forward" aria-pressed={speedRef.current > 1} title="Twice as fast">⏩</button>
                <button className={'bt-btn' + (S.settings.stress ? ' is-on' : '')} onClick={toggleStress} aria-pressed={S.settings.stress} aria-label="Stress view" title="Stress colours (V)">📊</button>
              </span>
            )}
            <button className={'bt-test' + (s ? ' is-stop' : '')} onClick={test} disabled={!!result} aria-label={s ? 'Stop the test' : 'Test the bridge'} title={s ? 'Back to building (Space)' : 'Send the cart across (Space)'}>{s ? '■ Build' : '▶ Test'}</button>
          </div>
        )}
        {tut && !paused && !result && !s && <div className="bt-guide" role="status"><b>First crossing</b><span>{tut.text}</span></div>}
        {screen === 'play' && L && !s && !tut && !tip && !paused && !result && b && b.members.length === 0 && <p className="bt-tip">{touch ? 'Drag from an anchor to build · two fingers to look around' : 'Drag from an anchor to build · right-click to remove · wheel to zoom'}</p>}
        {toast && <p className="bt-toast" role="status">{toast}</p>}
        {tip && screen === 'play' && !result && (
          <div className="bt-card" role="dialog" aria-label={tip.title}>
            <p className="bt-eyebrow">💡 A TIP</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="bt-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
      </div>
      {error && <div className="bt-panel bt-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="bt-menu" aria-label="Twig & Twine">
          <header className="bt-head"><a href="/" className="bt-back">← ARCADE</a>{settings}</header>
          <div className="bt-hero">
            <Art src="/art/bridges/title.webp" paint="title" w={1536} h={1024} className="bt-hero-art" />
            <div><p className="bt-eyebrow">A COSY BRIDGE-BUILDING PUZZLE</p><h1>Twig <em>&amp;</em> Twine</h1>
              <p className="bt-lede">The spring floods washed the valley’s little bridges away. Dora and Enzo build them again from twigs, planks, twine and bamboo, then ride across in their acorn cart. Will it hold?</p></div>
          </div>
          <div className="bt-go-row">
            <button className="bt-go" disabled={!ready} onClick={() => open(nextId ?? LEVEL_IDS[LEVEL_IDS.length - 1])}>{!ready ? 'Gathering twigs…' : startedAny ? 'CONTINUE →' : 'START →'}<small>{mounted ? (nextId ? `${levelNo(nextId)} · ${LEVELS[nextId].name}` : 'every crossing is built!') : ' '}</small></button>
            <button className="bt-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('levels'); }}>🗺 Crossings<small>{mounted ? `${medalCount(S)} of ${total} acorns` : ' '}</small></button>
            {mounted && sandboxOpen(S) ? <button className="bt-alt bt-dusk" disabled={!ready} onClick={() => open(SANDBOX.id)}>🧰 Sandbox<small>no budget, every material</small></button>
              : <button className="bt-alt" disabled><span>🧰 Sandbox</span><small>after Willow Brook</small></button>}
            {mounted && S.ended && <button className="bt-alt" onClick={() => { audio().ui(); setEnding(true); sound.current?.music('ending'); }}>🌅 The ending</button>}
          </div>
          <ol className="bt-how" aria-label="How to play">
            <li><b>🪵 Lay the road.</b> Drag from an anchor to build. Planks are the road: the cart only rolls on planks.</li>
            <li><b>🔺 Make triangles.</b> A plank alone sags and snaps. Twigs in triangles hold it up; twine hangs it; bamboo is strongest.</li>
            <li><b>▶ Test it.</b> Dora and Enzo ride across. Green is calm, red is about to snap. A splash just sends you back to building.</li>
            <li><b>🌰 Spend less.</b> Cross within the budget for an acorn, cheaper for two, and like a master builder for three.</li>
          </ol>
          <p className="bt-keys">{keysLine}</p>
          <p className="bt-keys">On a phone: drag from an anchor or joint to build, ✂ to remove, two fingers to pan and zoom.</p>
        </section>
      )}

      {screen === 'levels' && (
        <section className="bt-menu bt-levels" aria-label="Crossings">
          <header className="bt-head"><button className="bt-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="bt-total">🌰 {mounted ? medalCount(S) : 0} / {total} acorns</b></header>
          {REGIONS.map((R, ri) => {
            const ids = regionLevels(R.id), done = mounted ? regionCleared(S, R.id) : 0;
            return (
              <section key={R.id} className={'bt-region is-' + R.id} aria-label={R.name}>
                <div className="bt-region-head">
                  <Art src={`/art/bridges/bg-${R.id}.webp`} paint="region" region={R.id} w={768} h={512} className="bt-region-art" />
                  <div><small>REGION {ri + 1} · {done}/{ids.length} CROSSED</small><h2>{REGION_ICON[R.id]} {R.name}</h2><p>{R.blurb}</p></div>
                </div>
                <div className="bt-grid">
                  {ids.map((id, i) => {
                    const Lv = LEVELS[id], op = mounted && levelOpen(S, id), d = mounted ? S.levels[id] : undefined;
                    return (
                      <button key={id} className={'bt-lv' + (op ? '' : ' is-locked') + (d?.crossed ? ' is-done' : '')} disabled={!op || !ready} onClick={() => open(id)} aria-label={`${ri + 1}-${i + 1}: ${Lv.name}${op ? '' : ' (locked)'}`}>
                        <small>{ri + 1}-{i + 1}</small>
                        <b>{op ? Lv.name : '🔒 ' + Lv.name}</b>
                        <Acorns n={d?.medals ?? 0} />
                        <em>{d?.crossed && d.best !== null ? `best 🌰 ${d.best}` : op ? `budget 🌰 ${Lv.budget}` : ri > 0 && i === 0 ? `4 crossings in ${REGIONS[ri - 1].name}` : 'cross the one before'}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button className={'bt-sandbox' + (mounted && sandboxOpen(S) ? '' : ' is-locked')} disabled={!mounted || !sandboxOpen(S) || !ready} onClick={() => open(SANDBOX.id)} aria-label={`Sandbox${mounted && sandboxOpen(S) ? '' : ' (locked)'}`}>
            <b>🧰 Sandbox</b><span>{SANDBOX.blurb}</span><em>{mounted && sandboxOpen(S) ? 'open' : 'opens when every Willow Brook crossing is built'}</em>
          </button>
          <p className="bt-note">Your bridge for each crossing is kept, so you can come back and build it cheaper. Medals: one acorn within the budget, two within the thrifty price, three within the master builder’s.</p>
        </section>
      )}

      {screen === 'play' && L && b && (<>
        {result && (
          <div className="bt-panel bt-result" role="dialog" aria-label="Across!">
            <p className="bt-eyebrow">{result.over ? 'ACROSS, BUT OVER BUDGET' : 'ACROSS!'}</p>
            <h2>{L.name}</h2>
            <Acorns n={result.medals} big />
            <p className="bt-spent" data-testid="spent">🌰 {result.cost}<small> spent</small></p>
            <ul className="bt-tiers">
              <li className={result.medals >= 1 ? 'is-on' : ''}><b>🌰</b> within {L.budget}</li>
              <li className={result.medals >= 2 ? 'is-on' : ''}><b>🌰🌰</b> thrifty: {L.thrifty}</li>
              <li className={result.medals >= 3 ? 'is-on' : ''}><b>🌰🌰🌰</b> master builder: {L.master}</li>
            </ul>
            <p className="bt-note">{result.over ? `Build it for ${L.budget} or less to earn an acorn.` : result.newMedals ? `🌰 ${result.newMedals} new acorn${result.newMedals > 1 ? 's' : ''}! ` : ''}{result.best ? 'A new cheapest bridge! ' : ''}{!result.over && result.medals < 3 ? `Can you build it for ${result.medals < 2 ? L.thrifty : L.master}?` : ''}</p>
            <div className="bt-row">
              {(() => { const n = nextAfter(L.id); return n && levelOpen(S, n) ? <button className="bt-go" autoFocus onClick={() => open(n)}>Next →<small>{levelNo(n)} · {LEVELS[n].name}</small></button> : null; })()}
              <button className="bt-alt" onClick={() => { panelRef.current = false; setResult(null); sim.current = null; refresh(); }}>🔨 Improve it</button>
              <button className="bt-alt" onClick={() => toMenu('levels')}>🗺 Crossings</button>
              <button className="bt-alt" onClick={() => toMenu()}>Menu</button>
            </div>
          </div>
        )}
        {paused && (
          <div className="bt-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>The cart will wait.</p>
            {settings}
            <p className="bt-keys">{keysLine}</p>
            <div className="bt-row"><button className="bt-go" onClick={() => pause(false)}>Keep building</button><button className="bt-alt" onClick={() => toMenu('levels')}>Crossings</button><button className="bt-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
        )}
      </>)}
      {ending && (
        <div className="bt-ending" role="dialog" aria-label="The great canyon is crossed">
          <Art src="/art/bridges/ending.webp" paint="ending" w={1536} h={1024} className="bt-ending-art" />
          <div className="bt-ending-text">
            <p className="bt-eyebrow">EVERY CROSSING · BUILT</p>
            <h2>Sunset over the great canyon</h2>
            <p>Twenty-four crossings, a great many twigs and a very long bit of twine. The valley’s paths are whole again, and Dora and Enzo watch the sun go down from the far rim of the great canyon, with the acorn cart parked beside them and seeds for two.</p>
            <p className="bt-final">{mounted ? medalCount(S) : 0} of {total} acorns{mounted && medalCount(S) < total ? ' · cheaper bridges earn the rest' : ' · every acorn!'} · 🧰 the sandbox is always open</p>
            <div className="bt-row"><button className="bt-go" onClick={() => { setEnding(false); toMenu('levels'); }}>🗺 Crossings →</button><button className="bt-alt" onClick={() => { setEnding(false); if (screenRef.current !== 'play') sound.current?.music('menu'); }}>Close</button></div>
          </div>
          <div className="bt-credits" aria-label="Cast"><div>
            <p className="bt-eyebrow">STARRING</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="bt-eyebrow">THANK YOU FOR PLAYING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
