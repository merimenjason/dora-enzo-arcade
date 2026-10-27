'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  PawhavenGame, BUILDINGS, HOME_LEVELS, MEADOWS, ROUTES, GOODS, GOOD_NAMES, SAVE_KEY, SEASONS, TAX, YEAR, MAX_TOWNS, ROAD, PUDDLE,
  readProfile, recordWin, saveTown, meadowById, type Kind, type Good, type GameEvent, type Profile, type TradeMode, type Building, type Meadow,
} from '@/lib/pawhaven-game';
import type { PawhavenScene, View, Overlay, Ghost } from '@/lib/pawhaven-scene';
import { HavenSound } from './sound';
import './pawhaven.css';

type Tool = Kind | 'clear' | null;
type Modal = { kind: 'brief' } | { kind: 'won'; stars: number; years: number } | { kind: 'trade' } | { kind: 'goals' } | null;
type Note = { text: string; id: number; x?: number; y?: number };

/** The build palette, grouped as the town grows. */
const GROUPS: { name: string; icon: string; kinds: Kind[] }[] = [
  { name: 'Roads', icon: '🛤️', kinds: ['road', 'fence'] },
  { name: 'Homes', icon: '🏡', kinds: ['home'] },
  { name: 'Water', icon: '💧', kinds: ['well', 'tower'] },
  { name: 'Food', icon: '🫐', kinds: ['berry', 'hayFarm', 'oatFarm', 'granary', 'market'] },
  { name: 'Makers', icon: '🪵', kinds: ['woodcutter', 'clayPit', 'sandPit', 'dustMill', 'potter', 'toymaker', 'weaver', 'storehouse'] },
  { name: 'Helpers', icon: '🌿', kinds: ['bathhouse', 'herb', 'story', 'music', 'fireWatch', 'foxWatch'] },
  { name: 'Pretty', icon: '🌷', kinds: ['garden', 'pond', 'plaza', 'statue'] },
  { name: 'Town', icon: '🏛️', kinds: ['hall', 'tradingPost'] },
];
/** One line on what each building is for, shown on the palette. */
const ABOUT: Partial<Record<Kind, string>> = {
  road: 'Drag to lay a road. Helpers only walk on roads.', fence: 'Keeps foxes out. On a road it becomes a gate.',
  home: 'Drag to lay plots. Newcomers move in and the home grows as its needs are met.',
  well: 'Water for homes within 12 tiles.', tower: 'A water helper walks the streets. Needs a lake within 3 tiles.',
  berry: 'Berries all year round.', hayFarm: 'Hay, on dark fertile meadow.', oatFarm: 'Oats, on dark fertile meadow.',
  granary: 'Keeps food for the market.', market: 'A seller hands food and wares to the homes she passes.',
  woodcutter: 'Wood, right beside trees.', clayPit: 'Clay, within 2 tiles of water.', sandPit: 'Sand, on sandy ground.',
  dustMill: 'Mills sand into bath dust.', potter: 'Clay into pottery.', toymaker: 'Wood into toys.', weaver: 'Hay into soft bedding.',
  storehouse: 'Keeps wood, clay, sand, dust and wares.', bathhouse: 'A dust bath helper visits homes. Needs dust.',
  herb: 'A healer checks on every home she passes.', story: 'A storyteller visits homes.', music: 'A musician plays down the street.',
  fireWatch: 'Its watcher keeps streets safe from fire.', foxWatch: 'Shoos foxes within 6 tiles back home.',
  garden: 'Makes the street prettier.', pond: 'Prettier still.', plaza: 'Paved and pretty. Helpers can walk over it.', statue: 'The prettiest thing of all.',
  hall: 'Collects acorns from every home each month.', tradingPost: 'Caravans from open routes stop here.',
};
const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: 'none', label: 'Town' }, { id: 'water', label: 'Water' }, { id: 'food', label: 'Food' }, { id: 'dust', label: 'Dust baths' }, { id: 'pretty', label: 'Pretty' }, { id: 'fire', label: 'Fire risk' },
];
const SPEED_LABELS: Record<number, string> = { 0: '❚❚', 1: '▶', 2: '▶▶', 4: '▶▶▶' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ZOOM = [0.45, 2.2];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** A goal in a few words, without starting a game. */
const goalLabel = (goal: Meadow['goals'][number]) => goal.kind === 'pop' ? `${goal.n} chinchillas` : goal.kind === 'level' ? `${goal.n} ${HOME_LEVELS[goal.level - 1].name}s` : goal.kind === 'cosy' ? `cosiness ${goal.n}` : `${goal.n} acorns in the purse`;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
/** Tools that paint along a dragged line, and tools that fill a dragged box. */
const LINE: Tool[] = ['road', 'fence'], BOX: Tool[] = ['home', 'garden', 'clear'];

/** Splits a brief into Dora's and Enzo's lines. */
function lines(brief: string) {
  return brief.split(/(?=(?:Dora|Enzo): )/).map((s) => s.trim()).filter(Boolean).map((s) => { const m = /^(Dora|Enzo): (.*)$/.exec(s); return m ? { who: m[1], text: m[2] } : { who: '', text: s }; });
}
/** The tiles of an L-shaped path from a to b: along x first, then y. */
function path(a: { x: number; y: number }, b: { x: number; y: number }) {
  const out: { x: number; y: number }[] = [], sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
  for (let x = a.x; ; x += sx) { out.push({ x, y: a.y }); if (x === b.x) break; }
  for (let y = a.y + sy; sy && y !== b.y + sy; y += sy) out.push({ x: b.x, y });
  return out;
}
function box(a: { x: number; y: number }, b: { x: number; y: number }) {
  const out: { x: number; y: number }[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
  return out;
}

export default function PawhavenPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<PawhavenScene | null>(null), sound = useRef<HavenSound | null>(null);
  const game = useRef<PawhavenGame | null>(null), profile = useRef<Profile>(readProfile(null)), slot = useRef(0);
  const view = useRef<View>({ x: 0, y: 0, zoom: 1 }), hover = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef<Tool>(null), selRef = useRef(0), overlayRef = useRef<Overlay>('none'), modalRef = useRef<Modal>(null), screenRef = useRef<'menu' | 'play'>('menu');
  const drag = useRef<{ id: number; mode: 'pan' | 'paint'; sx: number; sy: number; vx: number; vy: number; from: { x: number; y: number }; moved: boolean } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>()), pinch = useRef<{ d: number; zoom: number } | null>(null);
  const keys = useRef(new Set<string>()), lastSpeed = useRef(1);
  const [screen, setScreen] = useState<'menu' | 'play'>('menu');
  const [tool, setToolState] = useState<Tool>(null), [selected, setSelected] = useState(0), [overlay, setOverlayState] = useState<Overlay>('none');
  const [group, setGroup] = useState<number | null>(null), [modal, setModalState] = useState<Modal>(null);
  const [ready, setReady] = useState(false), [rendered, setRendered] = useState(false), [muted, setMuted] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]), [toast, setToast] = useState<Note | null>(null), [replace, setReplace] = useState<string | null>(null), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const setTool = (t: Tool) => { toolRef.current = t; setToolState(t); if (t) { selRef.current = 0; setSelected(0); } };
  const select = (id: number) => { selRef.current = id; setSelected(id); };
  const setOverlay = (o: Overlay) => { overlayRef.current = o; setOverlayState(o); };
  const setModal = (m: Modal) => { modalRef.current = m; setModalState(m); };

  const noteId = useRef(0);
  function say(text: string) { const id = ++noteId.current; setToast({ text, id }); setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2600); }
  function persist() {
    const g = game.current;
    if (g && screenRef.current === 'play') profile.current = saveTown(profile.current, slot.current, g, Date.now());
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ }
  }

  function onEvent(e: GameEvent, g: PawhavenGame) {
    sound.current?.cue(e);
    if (e.kind === 'month') { persist(); return; }
    if (e.kind === 'won') {
      profile.current = recordWin(profile.current, g); persist();
      setModal({ kind: 'won', stars: g.stars, years: Math.round(((g.won ?? g.tick) / YEAR) * 10) / 10 });
    }
    if (e.msg && e.kind !== 'won') {
      const id = ++noteId.current;
      setNotes((n) => [{ text: e.msg as string, id, x: e.x, y: e.y }, ...n].slice(0, 4));
      setTimeout(() => setNotes((n) => n.filter((m) => m.id !== id)), 9000);
    }
  }

  /** Points the camera at a tile. */
  function look(x: number, y: number) { const s = scene.current; if (!s) return; const p = s.iso(x, y); view.current.x = p.sx; view.current.y = p.sy; }
  function clampView() {
    const g = game.current, v = view.current; if (!g) return;
    const half = g.size * 32;
    v.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], v.zoom)); v.x = Math.max(-half, Math.min(half, v.x)); v.y = Math.max(0, Math.min(g.size * 32, v.y));
  }
  function zoomAt(k: number, px?: number, py?: number) {
    const s = scene.current, v = view.current; if (!s) return;
    const { w, h } = s.size(), cx = px ?? w / 2, cy = py ?? h / 2;
    const wx = (cx - w / 2) / v.zoom + v.x, wy = (cy - h / 2) / v.zoom + v.y;
    v.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], v.zoom * k));
    v.x = wx - (cx - w / 2) / v.zoom; v.y = wy - (cy - h / 2) / v.zoom; clampView();
  }

  function begin(g: PawhavenGame, into: number, fresh: boolean) {
    game.current = g; slot.current = into; g.drain();
    lastSpeed.current = g.speed || 1;
    setTool(null); select(0); setOverlay('none'); setGroup(null); setNotes([]);
    screenRef.current = 'play'; setScreen('play');
    const s = scene.current;
    if (s) { const c = s.centre(g); view.current = { x: c.sx, y: c.sy, zoom: s.size().w < 700 ? 0.7 : 1 }; const e = g.entry; look(e % g.size + 0.5, Math.floor(e / g.size) + 0.5); }
    if (fresh) { persist(); setModal({ kind: 'brief' }); } else setModal(null);
    sound.current?.unlock(); refresh();
  }
  function start(id: string, into?: number) {
    const towns = profile.current.towns, free = towns.findIndex((t) => !t);
    if (into === undefined && free < 0) { if (screenRef.current === 'play') toMenu(); setReplace(id); return; }
    setReplace(null);
    begin(new PawhavenGame({ meadow: id }), into ?? free, true);
  }
  function resume(i: number) {
    const t = profile.current.towns[i]; if (!t) return;
    try { begin(PawhavenGame.fromJSON(t.state), i, false); } catch { say('That town could not be opened.'); }
  }
  function forget(i: number) { profile.current.towns[i] = null; try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* optional */ } refresh(); }
  function toMenu() { persist(); game.current = null; screenRef.current = 'menu'; setScreen('menu'); setModal(null); setTool(null); select(0); refresh(); }

  function speed(s: number) { const g = game.current; if (!g) return; g.setSpeed(s); if (s) lastSpeed.current = s; sound.current?.play('click'); refresh(); }
  function togglePause() { const g = game.current; if (!g) return; speed(g.speed ? 0 : lastSpeed.current || 1); }
  function toggleSound() { const s = sound.current; if (!s) return; s.setMuted(!s.muted()); setMuted(s.muted()); }

  /** The tiles a tool would touch, from the drag's start (or the hover) to the hover. */
  function ghostFor(g: PawhavenGame): Ghost {
    const t = toolRef.current, h = hover.current; if (!t || !h) return null;
    const at = { x: Math.floor(h.x), y: Math.floor(h.y) }, d = drag.current;
    if (t === 'clear' || LINE.includes(t) || BOX.includes(t)) {
      const from = d?.mode === 'paint' ? d.from : at, tiles = (LINE.includes(t) ? path(from, at) : box(from, at)).filter((p) => g.inside(p.x, p.y));
      let spend = 0;
      return { kind: t, size: 1, tiles: tiles.map((p) => {
        if (t === 'clear') return { ...p, ok: true };
        if (t === 'road' && g.road[p.y * g.size + p.x] === ROAD) return { ...p, ok: true };
        const ok = g.canBuild(t, p.x, p.y).ok && g.purse - spend >= BUILDINGS[t].cost; if (ok) spend += BUILDINGS[t].cost; return { ...p, ok };
      }) };
    }
    const n = BUILDINGS[t].size, x = Math.round(h.x - n / 2), y = Math.round(h.y - n / 2), ok = g.canBuild(t, x, y).ok, tiles = [];
    for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) tiles.push({ x: x + k, y: y + j, ok });
    return { kind: t, size: n, tiles };
  }
  /** Does what the tool says over the ghost's tiles; says why when nothing could be done. */
  function apply() {
    const g = game.current, t = toolRef.current; if (!g || !t) return;
    const gh = ghostFor(g); if (!gh?.tiles.length) return;
    let done = 0, why = '';
    if (t === 'clear') {
      for (const p of gh.tiles) { const r = g.clear(p.x, p.y); if (r.ok) done++; else why ||= r.reason ?? ''; }
      if (done) sound.current?.play('clear'); else { if (gh.tiles.length === 1) say(why); sound.current?.play('nope'); }
    } else if (LINE.includes(t) || BOX.includes(t)) {
      for (const p of gh.tiles) { if (t === 'road' && g.road[p.y * g.size + p.x] === ROAD) continue; const r = g.build(t, p.x, p.y); if (r.ok) done++; else why ||= r.reason ?? ''; }
      if (done) sound.current?.play(t === 'road' || t === 'fence' ? 'road' : 'build'); else if (why) { say(why); sound.current?.play('nope'); }
    } else {
      const p = gh.tiles[0], r = g.build(t, p.x, p.y);
      if (r.ok) { sound.current?.play('build'); if (r.id) { select(r.id); setTool(null); } } else { say(r.reason ?? 'Not here.'); sound.current?.play('nope'); }
    }
    refresh();
  }
  /** A tap with no tool: sweep a puddle, or look at what's there. */
  function tap(px: number, py: number) {
    const g = game.current, s = scene.current; if (!g || !s) return;
    const p = s.pick(view.current, px, py), x = Math.floor(p.x), y = Math.floor(p.y);
    if (!g.inside(x, y)) { select(0); return; }
    if (g.road[y * g.size + x] === PUDDLE) { g.clear(x, y); sound.current?.play('clear'); refresh(); return; }
    const b = g.buildingAt(x, y); select(b?.id ?? 0); if (b) sound.current?.play('click');
  }

  useEffect(() => {
    profile.current = (() => { try { return readProfile(localStorage.getItem(SAVE_KEY)); } catch { return readProfile(null); } })();
    sound.current = new HavenSound(); setMuted(sound.current.muted());
    let stopped = false, raf = 0, last = 0, ui = 0;
    const surface = canvas.current!;

    const local = (e: { clientX: number; clientY: number }) => { const r = surface.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const pointerDown = (e: PointerEvent) => {
      if (screenRef.current !== 'play' || modalRef.current) return;
      sound.current?.unlock(); surface.focus({ preventScroll: true });
      const p = local(e); touches.current.set(e.pointerId, p);
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.current.zoom };
        drag.current = { id: e.pointerId, mode: 'pan', sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2, vx: view.current.x, vy: view.current.y, from: { x: 0, y: 0 }, moved: true };
        return;
      }
      const s = scene.current; if (!s) return;
      const at = s.pick(view.current, p.x, p.y); hover.current = at;
      const paint = !!toolRef.current && e.button === 0;
      drag.current = { id: e.pointerId, mode: paint ? 'paint' : 'pan', sx: p.x, sy: p.y, vx: view.current.x, vy: view.current.y, from: { x: Math.floor(at.x), y: Math.floor(at.y) }, moved: false };
      surface.setPointerCapture(e.pointerId);
    };
    const pointerMove = (e: PointerEvent) => {
      const s = scene.current; if (!s || screenRef.current !== 'play') return;
      const p = local(e);
      if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, p);
      if (pinch.current && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y), dr = drag.current!;
        view.current.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], pinch.current.zoom * (d / Math.max(1, pinch.current.d))));
        view.current.x = dr.vx - ((a.x + b.x) / 2 - dr.sx) / view.current.zoom; view.current.y = dr.vy - ((a.y + b.y) / 2 - dr.sy) / view.current.zoom; clampView();
        return;
      }
      hover.current = s.pick(view.current, p.x, p.y);
      const d = drag.current; if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(p.x - d.sx, p.y - d.sy) > 6) d.moved = true;
      if (d.mode === 'pan' && d.moved) { view.current.x = d.vx - (p.x - d.sx) / view.current.zoom; view.current.y = d.vy - (p.y - d.sy) / view.current.zoom; clampView(); }
    };
    const pointerUp = (e: PointerEvent) => {
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinch.current = null;
      const d = drag.current; if (!d || d.id !== e.pointerId) { if (!touches.current.size) drag.current = null; return; }
      drag.current = null;
      if (e.type === 'pointercancel') return;
      const p = local(e);
      if (d.mode === 'paint') { hover.current = scene.current?.pick(view.current, p.x, p.y) ?? hover.current; drag.current = d; apply(); drag.current = null; }
      else if (!d.moved) tap(p.x, p.y);
      if (e.pointerType !== 'mouse') hover.current = null;
    };
    const leave = (e: PointerEvent) => { if (e.pointerType === 'mouse' && !drag.current) hover.current = null; };
    const wheel = (e: WheelEvent) => { if (screenRef.current !== 'play') return; e.preventDefault(); const p = local(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y); };
    const menu = (e: Event) => e.preventDefault();
    surface.addEventListener('pointerdown', pointerDown); surface.addEventListener('pointermove', pointerMove);
    surface.addEventListener('pointerup', pointerUp); surface.addEventListener('pointercancel', pointerUp); surface.addEventListener('pointerleave', leave);
    surface.addEventListener('wheel', wheel, { passive: false }); surface.addEventListener('contextmenu', menu);

    const down = (e: KeyboardEvent) => {
      if (screenRef.current !== 'play') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Escape') { if (modalRef.current && modalRef.current.kind !== 'won') setModal(null); else if (toolRef.current) setTool(null); else select(0); return; }
      if (modalRef.current) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      keys.current.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') togglePause();
      else if (e.code === 'Digit1') speed(1); else if (e.code === 'Digit2') speed(2); else if (e.code === 'Digit3') speed(4);
      else if (e.code === 'KeyR') setTool(toolRef.current === 'road' ? null : 'road');
      else if (e.code === 'KeyX') setTool(toolRef.current === 'clear' ? null : 'clear');
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomAt(1.2); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomAt(1 / 1.2);
      else if (e.code === 'KeyM') toggleSound();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); window.addEventListener('pagehide', persist);
    const hide = () => { if (document.hidden) persist(); };
    document.addEventListener('visibilitychange', hide);

    (window as unknown as { __haven: () => unknown }).__haven = () => ({
      game: game.current, view: view.current, tool: toolRef.current, selected: selRef.current, profile: profile.current, slot: slot.current,
      metrics: game.current && scene.current ? scene.current.metrics(game.current) : null,
      start, resume, setTool, select, look, toScreen: (x: number, y: number) => { const s = scene.current!, p = s.iso(x, y); return s.toScreen(view.current, p.sx, p.sy); },
    });

    import('@/lib/pawhaven-scene').then(({ createPawhavenScene }) => {
      if (stopped || !canvas.current) return;
      scene.current = createPawhavenScene(canvas.current);
      setReady(true);
      let first = true;
      const loop = (now: number) => {
        if (stopped) return;
        const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 0; last = now;
        const g = game.current, s = scene.current!;
        if (g && screenRef.current === 'play') {
          if (!modalRef.current && !document.hidden) g.update(dt);
          for (const e of g.drain()) onEvent(e, g);
          const k = keys.current, pan = 520 * dt / view.current.zoom;
          if (k.has('ArrowLeft') || k.has('KeyA')) view.current.x -= pan; if (k.has('ArrowRight') || k.has('KeyD')) view.current.x += pan;
          if (k.has('ArrowUp') || k.has('KeyW')) view.current.y -= pan; if (k.has('ArrowDown') || k.has('KeyS')) view.current.y += pan;
          if (k.size) clampView();
          if (selRef.current && !g.buildings.has(selRef.current)) select(0);
          s.draw(g, view.current, dt, { ghost: ghostFor(g), selected: selRef.current || undefined, overlay: overlayRef.current, hover: hover.current });
          if (first) { first = false; setRendered(true); }
          ui += dt; if (ui > 0.25) { ui = 0; refresh(); }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    return () => {
      stopped = true; cancelAnimationFrame(raf); persist();
      surface.removeEventListener('pointerdown', pointerDown); surface.removeEventListener('pointermove', pointerMove);
      surface.removeEventListener('pointerup', pointerUp); surface.removeEventListener('pointercancel', pointerUp); surface.removeEventListener('pointerleave', leave);
      surface.removeEventListener('wheel', wheel); surface.removeEventListener('contextmenu', menu);
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', hide);
      scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
    // the handlers read refs, so they are wired once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = game.current, p = profile.current;
  return (
    <main className="haven-shell" data-ready={ready ? 'true' : undefined} data-rendered={rendered ? 'true' : undefined} data-screen={screen}>
      <canvas ref={canvas} className={`haven-canvas${tool ? ' is-building' : ''}`} tabIndex={0} aria-label="The town" />
      {screen === 'menu' && <Menu profile={p} replace={replace} onStart={start} onResume={resume} onForget={forget} onCancel={() => setReplace(null)} />}
      {screen === 'play' && g && <>
        <Hud g={g} muted={muted} overlay={overlay} onSpeed={speed} onTax={(t) => { g.setTax(t); refresh(); }} onOverlay={setOverlay}
          onGoals={() => setModal({ kind: 'goals' })} onTrade={() => setModal({ kind: 'trade' })} onMenu={toMenu} onSound={toggleSound} />
        <Palette g={g} tool={tool} group={group} onGroup={setGroup} onTool={(t) => { setTool(t); sound.current?.play('click'); }} />
        {selected > 0 && g.buildings.get(selected) && <Info g={g} b={g.buildings.get(selected)!} onClose={() => select(0)}
          onClear={(b) => { g.clear(b.x, b.y); select(0); sound.current?.play('clear'); refresh(); }} />}
        <div className="haven-ticker" aria-live="polite">
          {notes.map((n) => <button key={n.id} type="button" onClick={() => { if (n.x !== undefined && n.y !== undefined) look(n.x + 0.5, n.y + 0.5); }}>{n.text}</button>)}
        </div>
        {toast && <div className="haven-toast" key={toast.id} role="status">{toast.text}</div>}
        {modal?.kind === 'brief' && <Brief m={g.meadow} onGo={() => { setModal(null); sound.current?.unlock(); }} />}
        {modal?.kind === 'goals' && <Goals g={g} onClose={() => setModal(null)} />}
        {modal?.kind === 'trade' && <Trade g={g} onClose={() => setModal(null)} onChange={refresh} />}
        {modal?.kind === 'won' && <Won g={g} stars={modal.stars} years={modal.years} profile={p} onStay={() => setModal(null)} onMenu={toMenu}
          onNext={(id) => { persist(); start(id); }} />}
      </>}
    </main>
  );
}

function Menu({ profile, replace, onStart, onResume, onForget, onCancel }: {
  profile: Profile; replace: string | null; onStart: (id: string, into?: number) => void; onResume: (i: number) => void; onForget: (i: number) => void; onCancel: () => void;
}) {
  const towns = profile.towns, campaign = MEADOWS.filter((m) => m.goals.length);
  return (
    <section className="haven-menu">
      <div className="haven-menu-top"><Link href="/" className="haven-back">← ARCADE</Link></div>
      <div className="haven-menu-panel">
        <p className="haven-eyebrow">A CHINCHILLA TOWN</p>
        <h1>Paw<em>haven</em></h1>
        <p className="haven-lede">Lay roads, send helpers down the streets, and grow hay nests into grand burrows. Seven meadows, each a little bigger and busier than the last.</p>
        {towns.some(Boolean) && <>
          <h2>Your towns</h2>
          <ul className="haven-slots">
            {towns.map((t, i) => t && (
              <li key={i}>
                <div><h3>{meadowById(t.meadow)?.name}</h3><p>Year {Math.floor(t.state.tick / YEAR) + 1} · {t.state.pop ?? 0} chinchillas{t.state.won !== null ? ' · finished' : ''}</p></div>
                <button type="button" className="haven-primary" onClick={() => onResume(i)}>Carry on</button>
                <button type="button" className="haven-quiet" onClick={() => onForget(i)}>Let go</button>
              </li>
            ))}
          </ul>
        </>}
        {replace && <div className="haven-replace" role="dialog" aria-label="Choose a slot">
          <p>All {MAX_TOWNS} town slots are full. Which town should make room for {meadowById(replace)?.name}?</p>
          <div>{towns.map((t, i) => t && <button key={i} type="button" onClick={() => onStart(replace, i)}>{meadowById(t.meadow)?.name} · year {Math.floor(t.state.tick / YEAR) + 1}</button>)}
            <button type="button" className="haven-quiet" onClick={onCancel}>Never mind</button></div>
        </div>}
        <h2>Meadows</h2>
        <ul className="haven-meadows">
          {MEADOWS.map((m) => {
            const locked = m.goals.length > 0 && m.n > profile.open, got = profile.stars[m.id] ?? 0;
            return (
              <li key={m.id} className={locked ? 'is-locked' : undefined}>
                <span className="haven-n">{m.goals.length ? m.n : '∞'}</span>
                <div>
                  <h3>{m.name}</h3>
                  <p>{m.goals.length ? m.goals.map(goalLabel).join(' · ') : 'No goals, no hurry: build whatever you dream up.'}</p>
                  {m.goals.length > 0 && <p className="haven-stars" aria-label={`${got} of 3 stars`}>{stars(got)}{profile.best[m.id] ? <small> best {profile.best[m.id]} years</small> : null}</p>}
                </div>
                <button type="button" className="haven-primary" disabled={locked} onClick={() => onStart(m.id)}>{locked ? `Finish ${campaign[m.n - 2]?.name}` : 'Start'}</button>
              </li>
            );
          })}
        </ul>
        <p className="haven-help">Drag to look around, scroll or pinch to zoom. Pick something from the bar at the bottom and tap the meadow to build; drag to lay roads and rows of homes. Space pauses, 1 2 3 set the speed, R picks the road and X the clearing tool.</p>
      </div>
    </section>
  );
}

function Hud({ g, muted, overlay, onSpeed, onTax, onOverlay, onGoals, onTrade, onMenu, onSound }: {
  g: PawhavenGame; muted: boolean; overlay: Overlay; onSpeed: (s: number) => void; onTax: (t: number) => void; onOverlay: (o: Overlay) => void;
  onGoals: () => void; onTrade: () => void; onMenu: () => void; onSound: () => void;
}) {
  const goals = g.goalStatus(), met = goals.filter((x) => x.done).length;
  return (
    <header className="haven-hud">
      <div className="haven-stats">
        <span title="Acorns in the purse"><b>🌰 {Math.floor(g.purse)}</b><small>{g.income - g.wages >= 0 ? '+' : ''}{Math.round(g.income - g.wages)} last month</small></span>
        <span title="Chinchillas living here"><b>🐭 {g.pop}</b><small>{g.employed}/{g.jobs} jobs filled{g.unemployed ? ` · ${g.unemployed} free` : ''}</small></span>
        <span title="Cosiness: food, visits and fair taxes keep it up"><b>💛 {g.cosiness}</b><small>cosiness</small></span>
        <span><b>{cap(SEASONS[Math.floor(g.month / 3)])}</b><small>{MONTHS[g.month]} · year {g.year}{g.dry ? ' · dry spell' : ''}</small></span>
      </div>
      <div className="haven-controls">
        <div className="haven-seg" role="group" aria-label="Speed">
          {[0, 1, 2, 4].map((s) => <button key={s} type="button" aria-pressed={g.speed === s} aria-label={s ? `Speed ${s}` : 'Pause'} onClick={() => onSpeed(s)}>{SPEED_LABELS[s]}</button>)}
        </div>
        <label className="haven-pick">Tax<select value={g.tax} onChange={(e) => onTax(Number(e.target.value))}>{TAX.map((t, i) => <option key={t.name} value={i}>{cap(t.name)}</option>)}</select></label>
        <label className="haven-pick">Map<select value={overlay} onChange={(e) => onOverlay(e.target.value as Overlay)}>{OVERLAYS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        {g.meadow.goals.length > 0 && <button type="button" onClick={onGoals}>Goals {met}/{goals.length}</button>}
        {g.meadow.routes.length > 0 && <button type="button" onClick={onTrade}>Trade</button>}
        <button type="button" aria-label={muted ? 'Sound on' : 'Sound off'} onClick={onSound}>{muted ? '🔇' : '🔊'}</button>
        <button type="button" onClick={onMenu}>Meadows</button>
      </div>
    </header>
  );
}

function Palette({ g, tool, group, onGroup, onTool }: { g: PawhavenGame; tool: Tool; group: number | null; onGroup: (i: number | null) => void; onTool: (t: Tool) => void }) {
  const groups = GROUPS.map((gr) => ({ ...gr, kinds: gr.kinds.filter((k) => g.open.has(k)) })).filter((gr) => gr.kinds.length);
  const open = group !== null ? groups.find((gr) => gr.name === GROUPS[group].name) : undefined;
  return (
    <nav className="haven-palette" aria-label="Build">
      {open && <div className="haven-drawer">
        {open.kinds.map((k) => { const s = BUILDINGS[k], short = g.purse < s.cost; return (
          <button key={k} type="button" aria-pressed={tool === k} className={short ? 'is-short' : undefined} onClick={() => onTool(tool === k ? null : k)}>
            <b>{s.name}</b><span>🌰 {s.cost}{s.jobs ? ` · ${s.jobs} jobs` : ''}{s.size > 1 ? ` · ${s.size}×${s.size}` : ''}</span><small>{ABOUT[k]}</small>
          </button>
        ); })}
      </div>}
      <div className="haven-tabs">
        <button type="button" aria-pressed={tool === null && group === null} onClick={() => { onTool(null); onGroup(null); }}>👆<span>Look</span></button>
        {groups.map((gr) => { const i = GROUPS.findIndex((x) => x.name === gr.name); return (
          <button key={gr.name} type="button" aria-pressed={group === i} aria-expanded={group === i} onClick={() => onGroup(group === i ? null : i)}>{gr.icon}<span>{gr.name}</span></button>
        ); })}
        <button type="button" aria-pressed={tool === 'clear'} onClick={() => { onGroup(null); onTool(tool === 'clear' ? null : 'clear'); }}>🧹<span>Clear</span></button>
      </div>
    </nav>
  );
}

function Info({ g, b, onClose, onClear }: { g: PawhavenGame; b: Building; onClose: () => void; onClear: (b: Building) => void }) {
  const s = BUILDINGS[b.kind], access = g.hasAccess(b), goods = (Object.entries(b.store) as [Good, number][]).filter(([, n]) => n > 0);
  let line = '';
  if (b.kind === 'home') line = b.pop ? `${b.pop} of ${g.holds(b)} living here.` : 'Waiting for newcomers.';
  else if (b.kind === 'rubble') line = 'Clear it away for free and build again.';
  else if (s.jobs) line = `${b.workers} of ${s.jobs} helpers at work.`;
  const growing = b.kind === 'home' && b.level < 7 ? g.nextNeed(b) : '';
  return (
    <aside className="haven-info" aria-label={g.nameOf(b)}>
      <button type="button" className="haven-x" aria-label="Close" onClick={onClose}>×</button>
      <h3>{g.nameOf(b)}</h3>
      {b.burning > 0 && <p className="haven-warm">On fire! A fire watcher walking by will put it out.</p>}
      {!access && b.kind !== 'rubble' && s.size && b.kind !== 'garden' && b.kind !== 'pond' && b.kind !== 'statue' && b.kind !== 'plaza' && <p className="haven-warm">It needs a road beside it.</p>}
      {line && <p>{line}</p>}
      {b.kind === 'home' && <p>{growing ? `To grow into a ${HOME_LEVELS[b.level].name} it would love ${growing}.` : 'The grandest burrow there is!'}</p>}
      {b.kind === 'home' && b.away > 0 && <p>{b.away} are staying with friends until the fox has gone.</p>}
      {ABOUT[b.kind] && b.kind !== 'home' && <p className="haven-soft">{ABOUT[b.kind]}</p>}
      {goods.length > 0 && <ul className="haven-goods">{goods.map(([k, n]) => <li key={k}>{GOOD_NAMES[k]} <b>{Math.floor(n)}</b></li>)}</ul>}
      {b.kind !== 'rubble' && <p className="haven-soft">Pretty here: {g.desirAt(b.x, b.y)}</p>}
      <button type="button" className="haven-quiet" onClick={() => onClear(b)}>{b.kind === 'rubble' ? 'Clear the rubble' : 'Take it down'}</button>
    </aside>
  );
}

function Brief({ m, onGo }: { m: Meadow; onGo: () => void }) {
  const goals = m.goals.map(goalLabel);
  return (
    <div className="haven-modal" role="dialog" aria-label={m.name}>
      <div className="haven-card">
        <p className="haven-eyebrow">{m.goals.length ? `MEADOW ${m.n}` : 'FREE MEADOW'}</p>
        <h2>{m.name}</h2>
        {lines(m.brief).map((l, i) => <p key={i} className={`haven-say${l.who ? ` is-${l.who.toLowerCase()}` : ''}`}>{l.who && <b>{l.who}</b>}{l.text}</p>)}
        {goals.length > 0 && <><h3>Goals</h3><ul className="haven-goal-list">{goals.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="haven-soft">Finish within {m.years} years for a second star, and with cosiness 80 or more for a third.</p></>}
        <button type="button" className="haven-primary" onClick={onGo}>Let&apos;s build!</button>
      </div>
    </div>
  );
}

function Goals({ g, onClose }: { g: PawhavenGame; onClose: () => void }) {
  return (
    <div className="haven-modal" role="dialog" aria-label="Goals" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="haven-card">
        <h2>{g.meadow.name}</h2>
        <ul className="haven-goal-list">{g.goalStatus().map((x) => (
          <li key={x.label} className={x.done ? 'is-done' : undefined}><span>{x.done ? '✓ ' : ''}{x.label}</span><b>{Math.floor(x.now)} / {x.need}</b>
            <i style={{ width: `${Math.min(100, (100 * x.now) / x.need)}%` }} /></li>
        ))}</ul>
        <p className="haven-soft">Every goal has to hold at the same time. Year {g.year} of {g.meadow.years} for a second star; cosiness 80 for a third.</p>
        <h3>Homes</h3>
        <ul className="haven-levels">{HOME_LEVELS.map((l) => <li key={l.level}><b>{l.name}</b> {g.homes().filter((h) => h.level === l.level).length}<small>{l.level > 1 ? ` · needs ${l.needs}` : ''}</small></li>)}</ul>
        <button type="button" className="haven-primary" onClick={onClose}>Back to town</button>
      </div>
    </div>
  );
}

function Trade({ g, onClose, onChange }: { g: PawhavenGame; onClose: () => void; onChange: () => void }) {
  const routes = g.meadow.routes.map((id) => ROUTES[id]), open = routes.filter((r) => g.routes.includes(r.id));
  const post = [...g.buildings.values()].some((b) => b.kind === 'tradingPost');
  const tradable = GOODS.filter((k) => open.some((r) => r.buys[k] || r.sells[k]));
  return (
    <div className="haven-modal" role="dialog" aria-label="Trade" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="haven-card is-wide">
        <h2>Trade</h2>
        {!post && <p className="haven-warm">Build a trading post so caravans have somewhere to stop.</p>}
        <ul className="haven-routes">{routes.map((r) => {
          const has = g.routes.includes(r.id);
          return (
            <li key={r.id}>
              <div><h3>{r.name}</h3>
                <p>Buys {Object.entries(r.buys).map(([k, v]) => `${k} (${v})`).join(', ')}</p>
                <p>Sells {Object.entries(r.sells).map(([k, v]) => `${k} (${v})`).join(', ')}</p></div>
              {has ? <span className="haven-open">Open</span> : <button type="button" disabled={g.purse < r.cost} onClick={() => { const res = g.openRoute(r.id); if (res.ok) onChange(); }}>Open road · 🌰 {r.cost}</button>}
            </li>
          );
        })}</ul>
        {tradable.length > 0 && <>
          <h3>What to trade</h3>
          <table className="haven-trade"><tbody>{tradable.map((k) => {
            const t = g.trade[k] ?? { mode: 'keep' as TradeMode, n: 0 };
            return (
              <tr key={k}><th>{GOOD_NAMES[k]}<small> · {g.stock(k)} in store</small></th>
                <td><select aria-label={`${GOOD_NAMES[k]} trade`} value={t.mode} onChange={(e) => { g.setTrade(k, e.target.value as TradeMode, t.n || 20); onChange(); }}>
                  <option value="keep">Keep</option>{open.some((r) => r.buys[k]) && <option value="export">Sell above</option>}{open.some((r) => r.sells[k]) && <option value="import">Buy up to</option>}
                </select></td>
                <td>{t.mode !== 'keep' && <input type="number" min={0} max={9999} step={10} aria-label={`${GOOD_NAMES[k]} amount`} value={t.n} onChange={(e) => { g.setTrade(k, t.mode, Number(e.target.value)); onChange(); }} />}</td>
              </tr>
            );
          })}</tbody></table>
          <p className="haven-soft">A caravan comes every two months, sells what is above your line and buys up to your line.</p>
        </>}
        <button type="button" className="haven-primary" onClick={onClose}>Back to town</button>
      </div>
    </div>
  );
}

function Won({ g, stars: got, years, profile, onStay, onMenu, onNext }: {
  g: PawhavenGame; stars: number; years: number; profile: Profile; onStay: () => void; onMenu: () => void; onNext: (id: string) => void;
}) {
  const next = MEADOWS.find((m) => m.n === g.meadow.n + 1 && m.goals.length && m.n <= profile.open);
  return (
    <div className="haven-modal" role="dialog" aria-label="Meadow finished">
      <div className="haven-card is-won">
        <p className="haven-eyebrow">MEADOW FINISHED</p>
        <h2>{g.meadow.name}</h2>
        <p className="haven-big-stars" aria-label={`${got} of 3 stars`}>{stars(got)}</p>
        <p>Finished in {years} years with cosiness {g.cosiness}. {g.meadow.n === 7 ? 'Pawhaven is the cosiest town there ever was!' : 'Dora and Enzo are so proud of this town.'}</p>
        <div className="haven-row">
          {next && <button type="button" className="haven-primary" onClick={() => onNext(next.id)}>On to {next.name}</button>}
          <button type="button" onClick={onStay}>Keep building</button>
          <button type="button" onClick={onMenu}>Meadows</button>
        </div>
      </div>
    </div>
  );
}
