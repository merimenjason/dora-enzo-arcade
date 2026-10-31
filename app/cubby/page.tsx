'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CubbyGame, SAVE_KEY, SLOTS, DAY, MAX_HP, readSave, freshSave, phaseOf, NO_INPUT,
  type Save, type Ev, type Input, type Mode,
} from '@/lib/cubby-game';
import { BLOCKS, BLOCK_BY_KEY } from '@/lib/cubby-world';
import { ITEMS, RECIPES, RECIPE, NEIGHBOURS, NEIGHBOUR, CRITTERS, PALETTE, itemName, type NeighbourId } from '@/lib/cubby-content';
import type { CubbyScene, View } from '@/lib/cubby-scene';
import { CubbySound, type SongId } from './sound';
import './cubby.css';

type Screen = 'menu' | 'play' | 'ending';
type Overlay = null | 'pause' | 'bag' | 'loom' | 'talk' | 'burrow' | 'help' | 'new';
type Thread = { key: string; n: number };
type Hud = {
  hp: number; day: number; clock: string; night: boolean; hot: (string | null)[]; sel: number; counts: Record<string, number>;
  target: string; prompt: string; near: string; quest: { who: NeighbourId; name: string; text: string; progress: string; ready: boolean; burrow: boolean; arrow: number | null } | null;
  progress: number; fly: boolean; danger: boolean; moved: number;
};
const sceneModule = () => import('@/lib/cubby-scene');
const MODE_NAME = (m: Mode, cosy: boolean) => (m === 'creative' ? 'Creative' : cosy ? 'Story · Cosy nights' : 'Story');
const HELP: [string, string][] = [
  ['W A S D', 'walk'], ['Mouse', 'look (click the valley first)'], ['Space', 'jump · swim up · climb'], ['Left click (hold)', 'dig · bonk'],
  ['Right click', 'place the held block'], ['1–9 · wheel', 'pick from the hotbar'], ['F', 'talk · use the workbench · sleep · relight'], ['E', 'open the bag'],
  ['B', 'check the burrow you stand in'], ['V', 'first person / close behind'], ['Tab', 'swap Dora and Enzo'], ['Esc', 'pause'],
];

/** A painting with a plain stand-in underneath (shows until, or unless, the painting loads). */
function Art({ src, className }: { src: string; className?: string }) {
  const [bad, setBad] = useState(false);
  return <span className={'cv-art ' + (className ?? '')}>{!bad && <img src={src} alt="" onError={() => setBad(true)} />}</span>;
}
function Icon({ k, icons, className }: { k: string; icons: Record<string, string>; className?: string }) {
  const src = icons[k];
  return src ? <img className={'cv-ico ' + (className ?? '')} src={src} alt="" draggable={false} /> : <span className={'cv-ico is-missing ' + (className ?? '')}>{(itemName(k) || '?').slice(0, 2)}</span>;
}

export default function CubbyPage() {
  const canvas = useRef<HTMLCanvasElement>(null), padRef = useRef<HTMLDivElement>(null);
  const scene = useRef<CubbyScene | null>(null), sound = useRef<CubbySound | null>(null), game = useRef<CubbyGame | null>(null);
  const save = useRef<Save>(freshSave()), slot = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), screenRef = useRef<Screen>('menu');
  const [overlay, setOverlayState] = useState<Overlay>(null), overlayRef = useRef<Overlay>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<{ id: number; text: string; kind?: string }[]>([]);
  const [mounted, setMounted] = useState(false), [error, setError] = useState(''), [touch, setTouch] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [burrow, setBurrow] = useState<ReturnType<CubbyGame['checkHere']> | null>(null);
  const [welcome, setWelcome] = useState<NeighbourId | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const setOverlay = (o: Overlay) => { overlayRef.current = o; setOverlayState(o); };
  const look = useRef({ yaw: Math.PI, pitch: -0.15 });
  const keys = useRef(new Set<string>());
  const mouse = useRef({ dig: false, suppress: false, place: false, placeT: 0, dragging: false, down: false, sx: 0, sy: 0, moved: 0 });
  const touchSt = useRef({ pad: { id: -1, x: 0, y: 0, dx: 0, dy: 0 }, look: { id: -1, x: 0, y: 0, t: 0, moved: 0, held: false }, dig: false, autoDig: 0, jump: false, down: false });
  const view = useRef<View>({ mode: 'third', dig: -1, aim: null, ghost: null, held: null, swing: 9, orbit: null, menu: true });
  const fairT = useRef(-1), saveT = useRef(0), hudT = useRef(0), lastJump = useRef(0), toastId = useRef(0);
  const seen = useRef(new Set<string>());

  const persist = () => {
    const g = game.current;
    if (g && screenRef.current !== 'menu') save.current.slots[slot.current] = g.toSlot();
    save.current.last = slot.current;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ }
  };
  const audio = () => { sound.current ??= new CubbySound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const toast = (text: string, kind?: string, ms = 3200) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  };
  const once = (key: string, text: string, kind?: string) => { if (seen.current.has(key)) return; seen.current.add(key); toast(text, kind, 5200); };
  const locked = () => typeof document !== 'undefined' && document.pointerLockElement === canvas.current;
  const lock = () => { const c = canvas.current; if (!c || touch || locked()) return; try { const p = c.requestPointerLock?.() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* not available */ } };
  const unlock = () => { if (locked()) document.exitPointerLock?.(); };
  const open = (o: Overlay) => { unlock(); keys.current.clear(); mouse.current.dig = false; touchSt.current.dig = false; setOverlay(o); refresh(); };
  const close = () => { setOverlay(null); refresh(); if (screenRef.current === 'play') lock(); };

  // ---- starting and leaving a valley
  async function startSlot(i: number, fresh?: { mode: Mode; cosy: boolean }) {
    slot.current = i;
    const S = save.current;
    let g: CubbyGame;
    try {
      if (fresh || !S.slots[i]) {
        const seed = ((Date.now() * 2654435761) ^ Math.floor(performance.now() * 1000)) >>> 0;
        g = new CubbyGame(seed, { mode: fresh?.mode ?? 'story', cosy: fresh?.cosy, name: `Valley ${i + 1}` });
      } else g = CubbyGame.fromSlot(S.slots[i]!);
    } catch { toast('That valley couldn’t be opened. Starting a fresh one.'); g = new CubbyGame(1234 + i); }
    game.current = g; look.current = { yaw: g.me.yaw, pitch: -0.12 };
    seen.current = new Set();
    S.slots[i] = g.toSlot(); persist();
    view.current = { ...view.current, mode: S.settings.view, orbit: null, menu: false };
    fairT.current = -1;
    setScreen('play'); setOverlay(null);
    const sc = scene.current;
    if (sc) { sc.setGame(g); sc.resize(); }
    if (!icons.planks && sc) {
      const keys = [...Object.keys(ITEMS), 'leaf', 'bundle', ...NEIGHBOURS.map((n) => 'npc:' + n.id), 'chin:dora', 'chin:enzo'];
      setIcons(sc.icons(keys));
    }
    refresh();
    requestAnimationFrame(() => { scene.current?.resize(); lock(); });
    if (!S.settings.view || !seen.current.has('help')) { /* first-time help is shown by the HUD */ }
  }
  function leave() {
    persist(); unlock();
    game.current = null; setScreen('menu'); setOverlay(null); setHud(null); view.current.menu = true; sound.current?.music('menu');
  }

  // ---- the game's events: sounds, toasts, the scene
  function onEvents(evs: Ev[]) {
    const g = game.current, snd = sound.current; if (!g) return;
    scene.current?.feed(evs);
    for (const e of evs) {
      switch (e.t) {
        case 'dig': snd?.dig(e.b ?? 0); view.current.swing = 0; break;
        case 'chip': snd?.chip(e.b ?? 0); view.current.swing = 0; break;
        case 'place': snd?.place(e.b ?? 0); view.current.swing = 0.1; break;
        case 'step': snd?.footstep(e.b ?? 0); break;
        case 'jump': snd?.jump(); break;
        case 'land': snd?.land(); break;
        case 'pickup': snd?.pickup(); if (e.key) toast(`+${e.n} ${itemName(e.key)}${(e.n ?? 1) > 1 && !itemName(e.key).endsWith('s') ? '' : ''}`, 'small', 1600); break;
        case 'weave': snd?.weave(); break;
        case 'learn': snd?.learn(); toast(`New pattern: ${itemName(RECIPE[e.key!]?.out ?? e.key!)}`, 'learn'); break;
        case 'leaf': toast('A golden recipe leaf!', 'learn'); break;
        case 'quest': snd?.quest(); break;
        case 'arrive': { const n = NEIGHBOUR[e.who as NeighbourId]; snd?.quest(); toast(`${n.name} the ${n.animal} is waiting at the notice stump`, 'big', 5000); break; }
        case 'movein': { const n = NEIGHBOUR[e.who as NeighbourId]; snd?.fanfare(); setWelcome(n.id); window.setTimeout(() => setWelcome(null), 5200); break; }
        case 'fair': snd?.fanfare(); snd?.music('fair'); fairT.current = 0; unlock(); break;
        case 'catch': snd?.catchBunny(); toast('Caught a dust-bunny! +2 fluff', 'small', 1800); break;
        case 'knock': toast(`A dust-bunny knocked over your ${BLOCKS[e.b ?? 0].name.toLowerCase()}. It's on the ground nearby.`, 'small'); break;
        case 'hurt': snd?.hurt(); break;
        case 'ko': snd?.ko(); toast('Bonked out! You wake by your bed. Half of what you carried waits where you fell.', 'big', 6000); break;
        case 'swing': snd?.swing(); view.current.swing = 0; break;
        case 'hit': snd?.bonk(); break;
        case 'defeat': snd?.poof(); if (e.kind) once('def-' + e.kind, `${CRITTERS[e.kind].name} poofed! It dropped ${Object.keys(CRITTERS[e.kind].drops).map(itemName).join(', ').toLowerCase()}.`); break;
        case 'snort': snd?.snort(); once('boar', 'A Bramble Boar snorts: it’s about to charge. Step aside!', 'warn'); break;
        case 'thud': snd?.thud(); break;
        case 'swoop': snd?.flutter(); once('moth', 'A Murk Moth! Bonk it, or get under a roof.', 'warn'); break;
        case 'snuff': snd?.snuff(); once('snuff', 'A moth snuffed a lantern. Press F (or Use) on it to relight it; lanterns under a roof are safe.', 'warn'); break;
        case 'relight': snd?.relight(); break;
        case 'lunge': snd?.growl(); once('gnasher', 'A Gloom Gnasher! Lantern light makes them back off.', 'warn'); break;
        case 'steal': snd?.nibble(); toast(`A Grumblefluff nibbled ${e.n} ${itemName(e.key ?? '').toLowerCase()} from your bag! Bonk it to get it back.`, 'warn'); break;
        case 'fling': snd?.fling(); view.current.swing = 0; break;
        case 'splash': snd?.splash(); break;
        case 'grow': snd?.grow(); toast('A sapling grew into a birch!', 'small'); break;
        case 'sleep': toast('Sweet dreams… Good morning!', 'big'); break;
        case 'dusk': if (g.mode === 'story') once('dusk' + Math.floor(g.time / DAY), g.cosy ? 'Dusk. The dust-bunnies come out to play.' : 'Dusk. Night creatures come out: light lanterns, stay under a roof, or sleep in your bed (F).', 'warn'); break;
        case 'dawn': toast('Morning in the valley', 'small'); break;
      }
    }
  }

  // ---- the HUD, refreshed a few times a second
  function updateHud() {
    const g = game.current; if (!g) return;
    const ph = phaseOf(g.time), hours = (ph * 24 + 6) % 24, h = Math.floor(hours), m = Math.floor((hours - h) * 6) * 10;
    const aim = g.aim();
    const n = g.neighbour, st = g.stepNow;
    let quest: Hud['quest'] = null;
    if (n && st) {
      let progress = '';
      if (st.kind === 'bring') progress = Object.entries(g.needs(st.items)).map(([k, c]) => `${itemName(k)} ${Math.min(c, g.count(k))}/${c}`).join(' · ');
      else if (st.kind === 'count') progress = `${g.quest.count}/${st.n}`;
      const v = g.visiting;
      let arrow: number | null = null;
      if (v && !g.nearVisitor(6)) { const dx = v.body.x - g.me.x, dz = v.body.z - g.me.z; arrow = Math.atan2(-dx, -dz) - g.me.yaw; }
      quest = { who: n.id, name: n.name, text: st.say, progress, ready: g.ready(), burrow: st.kind === 'burrow', arrow: v && (g.ready() || g.quest.step === 0 && g.quest.count === 0) ? arrow : null };
    }
    let prompt = '';
    const nv = g.nearVisitor();
    if (nv) prompt = `Talk to ${NEIGHBOUR[nv.who].name}`;
    else if (aim && BLOCKS[aim.b].key === 'workbench') prompt = 'Use the Burrow Workbench';
    else if (aim && BLOCKS[aim.b].key === 'lantern_out') prompt = 'Relight the lantern';
    else if (aim && BLOCKS[aim.b].key === 'bed' && ph >= 0.6) prompt = 'Sleep till morning';
    else if (g.nearBench() && !g.creative) prompt = 'Use the Burrow Workbench';
    const danger = g.critters.some((c) => CRITTERS[c.kind].hostile && Math.hypot(c.body.x - g.me.x, c.body.z - g.me.z) < 9);
    setHud({
      hp: g.hp, day: Math.floor(g.time / DAY) + 1, clock: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, night: g.night,
      hot: [...g.hot], sel: g.sel, counts: { ...g.inv }, target: aim ? BLOCKS[aim.b].name : '', prompt, near: nv?.who ?? '', quest,
      progress: 1, fly: g.me.fly, danger, moved: g.moved.length,
    });
  }

  // ---- actions
  function useAction() {
    const g = game.current; if (!g) return;
    audio();
    const r = g.use();
    if (r === 'talk') { open('talk'); sound.current?.ui(); }
    else if (r === 'loom') { setThreads([]); open('loom'); sound.current?.ui(); }
    else if (r === 'sleep') { /* the event says good morning */ }
    else if (r === 'nosleep') { toast('You can’t sleep with a night creature this close!', 'warn'); sound.current?.nope(); }
    else if (r === 'notnight') toast('It’s not bedtime yet. Beds are for evenings.', 'small');
    else if (r === null && g.stepNow?.kind === 'burrow') checkBurrow();
  }
  function checkBurrow() {
    const g = game.current; if (!g) return;
    setBurrow(g.checkHere()); open('burrow'); sound.current?.ui();
  }
  function selectSlot(i: number) { const g = game.current; if (!g) return; g.sel = ((i % 9) + 9) % 9; updateHud(); }

  // ---- mount: the save, the scene, input, the loop, the hooks for tests
  useEffect(() => {
    let raw: string | null = null; try { raw = localStorage.getItem(SAVE_KEY); } catch { /* none */ }
    save.current = readSave(raw);
    const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    setTouch(isTouch);
    if (isTouch && !raw) save.current.settings.view = 'third';
    let dead = false, raf = 0, last = performance.now();
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = m.createCubbyScene(canvas.current); scene.current.resize(); }
      catch { setError('Cubby Valley needs WebGL, which this browser has turned off.'); }
      setMounted(true);
    }).catch(() => { setError('The valley couldn’t load. Please refresh the page.'); setMounted(true); });

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const g = game.current, sc = scene.current;
      sound.current?.tickMusic();
      if (!g || !sc || screenRef.current === 'menu') return;
      const paused = overlayRef.current !== null || screenRef.current === 'ending';
      const v = view.current;
      v.swing += dt;
      if (!paused) {
        const k = keys.current, ts = touchSt.current;
        let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        let side = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
        if (ts.pad.id >= 0) { fwd = -ts.pad.dy; side = ts.pad.dx; }
        const inp: Input = { ...NO_INPUT, fwd, side, jump: k.has('Space') || ts.jump, down: k.has('ShiftLeft') || k.has('ShiftRight') || ts.down, yaw: look.current.yaw, pitch: look.current.pitch };
        if (fairT.current >= 0) { inp.fwd = 0; inp.side = 0; }
        g.step(dt, inp);
        // digging and placing
        const ms = mouse.current;
        const digging = ((ms.dig && !ms.suppress) || ts.dig || ts.autoDig > 0) && fairT.current < 0;
        const before = g.digging;
        const p = g.dig(dt, digging);
        if (ts.autoDig > 0) { ts.autoDig -= dt; if (p === 1 || p < 0 || (before && g.digging && (before.x !== g.digging.x || before.y !== g.digging.y || before.z !== g.digging.z))) ts.autoDig = 0; }
        v.dig = p;
        if (ms.place) { ms.placeT -= dt; if (ms.placeT <= 0) { ms.placeT = 0.24; g.place(); } }
        const aim = g.aim(); v.aim = aim ? { x: aim.x, y: aim.y, z: aim.z } : null;
        const gs = g.placeSpot(); v.ghost = gs ? { ...gs, ok: true } : null;
        v.held = g.held;
        onEvents(g.drain());
      } else onEvents(g.drain());
      if (fairT.current >= 0) {
        fairT.current += dt;
        const s = g.valley.stump; v.orbit = { x: s.x + 0.5, y: s.y, z: s.z + 0.5, t: fairT.current };
        if (fairT.current > 9 && screenRef.current === 'play') { setScreen('ending'); g.ended = true; persist(); }
      } else v.orbit = null;
      v.menu = paused;
      sc.frame(dt, v);
      // music follows the time of day and where you are
      const under = g.me.y < 14 && g.world.sky(Math.floor(g.me.x), Math.floor(g.me.y + 0.7), Math.floor(g.me.z)) < 4;
      const songId: SongId = g.fair ? 'fair' : under ? 'cave' : g.night ? 'night' : 'day';
      sound.current?.music(songId);
      hudT.current -= dt; if (hudT.current <= 0) { hudT.current = 0.12; updateHud(); }
      saveT.current += dt; if (saveT.current > 20) { saveT.current = 0; persist(); }
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (screenRef.current !== 'play') return;
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const g = game.current; if (!g) return;
      if (down) audio();
      const ov = overlayRef.current;
      if (down && e.code === 'Escape') { if (ov) close(); else open('pause'); e.preventDefault(); return; }
      if (ov) { if (down && ((e.code === 'KeyE' && (ov === 'bag' || ov === 'loom')) || (e.code === 'KeyB' && ov === 'burrow') || (e.code === 'KeyF' && ov === 'talk'))) { close(); e.preventDefault(); } return; }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (down) keys.current.add(e.code); else keys.current.delete(e.code);
      if (!down) return;
      if (e.code === 'Space' && g.creative) { const now = performance.now(); if (now - lastJump.current < 300) { g.me.fly = !g.me.fly; toast(g.me.fly ? 'Flying (Space up, Shift down)' : 'Walking', 'small', 1400); } lastJump.current = now; }
      if (e.code.startsWith('Digit')) { const d = Number(e.code.slice(5)); if (d >= 1 && d <= 9) selectSlot(d - 1); }
      if (e.code === 'KeyE') open('bag');
      if (e.code === 'KeyF') useAction();
      if (e.code === 'KeyB') checkBurrow();
      if (e.code === 'KeyV') { view.current.mode = view.current.mode === 'first' ? 'third' : 'first'; save.current.settings.view = view.current.mode; persist(); refresh(); }
      if (e.code === 'Tab') { g.who = 1 - g.who; look.current.yaw = g.me.yaw; toast(g.who ? 'Playing as Enzo' : 'Playing as Dora', 'small', 1400); }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    const onMove = (e: MouseEvent) => {
      if (screenRef.current !== 'play' || overlayRef.current) return;
      const s = save.current.settings.sens * 0.0024, ms = mouse.current;
      if (locked()) { look.current.yaw -= e.movementX * s; look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - e.movementY * s * (save.current.settings.invert ? -1 : 1))); }
      else if (ms.down) {
        const dx = e.clientX - ms.sx, dy = e.clientY - ms.sy; ms.sx = e.clientX; ms.sy = e.clientY; ms.moved += Math.abs(dx) + Math.abs(dy);
        if (ms.moved > 6) { ms.dragging = true; look.current.yaw -= dx * s * 1.3; look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - dy * s * 1.3)); }
      }
    };
    const onLockChange = () => { if (!locked() && screenRef.current === 'play' && !overlayRef.current && !touch) { mouse.current.dig = false; mouse.current.place = false; } refresh(); };
    const onVis = () => { if (document.hidden) { persist(); sound.current?.suspend(); } else sound.current?.resume(); };
    const onWheel = (e: WheelEvent) => { const g = game.current; if (!g || screenRef.current !== 'play' || overlayRef.current) return; selectSlot(g.sel + (e.deltaY > 0 ? 1 : -1)); };
    const onResize = () => scene.current?.resize();
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLockChange); document.addEventListener('visibilitychange', onVis);
    window.addEventListener('wheel', onWheel, { passive: true }); window.addEventListener('resize', onResize); window.addEventListener('pagehide', persist);
    const w = window as unknown as Record<string, unknown>;
    w.__cubby = () => {
      const g = game.current;
      return {
        screen: screenRef.current, overlay: overlayRef.current, view: view.current.mode, slot: slot.current, locked: locked(),
        game: g ? {
          mode: g.mode, cosy: g.cosy, pos: { x: g.me.x, y: g.me.y, z: g.me.z }, yaw: g.me.yaw, pitch: g.me.pitch, who: g.who, hp: g.hp, inv: { ...g.inv }, hot: [...g.hot], sel: g.sel,
          time: g.time, phase: phaseOf(g.time), night: g.night, quest: { ...g.quest }, neighbour: g.neighbour?.id ?? null, moved: g.moved.map((m) => m.who), known: [...g.known],
          critters: g.critters.map((c) => ({ id: c.id, kind: c.kind, st: c.st, x: c.body.x, y: c.body.y, z: c.body.z, yaw: c.body.yaw })),
          aim: g.aim(), fair: !!g.fair, ended: g.ended, stats: { ...g.stats }, built: scene.current ? scene.current.preload(0) : 0, fly: g.me.fly,
          start: g.valley.start, stump: g.valley.stump, homeBed: g.valley.homeBed, cave: g.valley.cave, crystals: g.crystals.slice(0, 6),
        } : null,
      };
    };
    w.__cubbyScene = () => scene.current?.boxes() ?? null;
    /** Small helpers for the browser tests: move, look, give, set the clock, spawn, place. */
    w.__cubbyDo = (cmd: string, a: Record<string, unknown> = {}) => {
      const g = game.current; if (!g) return false;
      const num = (k: string, d = 0) => (typeof a[k] === 'number' ? (a[k] as number) : d);
      if (cmd === 'teleport') { const b = g.me; b.x = num('x', b.x); b.y = num('y', b.y); b.z = num('z', b.z); b.vx = b.vy = b.vz = 0; if (typeof a.yaw === 'number') look.current.yaw = a.yaw; if (typeof a.pitch === 'number') look.current.pitch = a.pitch; const f = g.players[1 - g.who]; f.x = b.x + 1; f.y = b.y; f.z = b.z + 0.6; return true; }
      if (cmd === 'look') { g.lookAt(num('x'), num('y'), num('z')); look.current.yaw = g.me.yaw; look.current.pitch = g.me.pitch; return true; }
      if (cmd === 'give') { for (const [k, n] of Object.entries(a)) if (typeof n === 'number') g.give(k, n); return true; }
      if (cmd === 'time') { g.time = Math.floor(g.time / DAY) * DAY + num('phase', 0.1) * DAY; g.wasNight = g.night; return true; }
      if (cmd === 'quest') { g.quest = { i: num('i'), step: num('step'), count: num('count') }; g.npcs = g.npcs.filter((n) => n.st !== 'visit'); if (g.neighbour) g.npcs.push(g.visitor(g.neighbour.id)); return true; }
      if (cmd === 'spawn') { const c = g.spawn(a.kind as never, Math.floor(g.me.x + num('dx')), Math.floor(g.me.y + num('dy')), Math.floor(g.me.z + num('dz'))); c.cd = num('cd', 0); return c.id; }
      if (cmd === 'set') { const b = typeof a.b === 'string' ? BLOCK_BY_KEY[a.b] : num('b'); if (b === undefined) return false; g.world.set(num('x'), num('y'), num('z'), b, num('f')); return true; }
      if (cmd === 'get') return BLOCKS[g.world.get(num('x'), num('y'), num('z'))].key;
      if (cmd === 'learn') { for (const r of RECIPES) g.learn(r.id); return true; }
      if (cmd === 'hp') { g.hp = num('hp', MAX_HP); return true; }
      if (cmd === 'clear') { g.critters = []; return true; }
      if (cmd === 'fair') { g.startFair(); return true; }
      return false;
    };
    return () => {
      dead = true; cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange); document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('wheel', onWheel); window.removeEventListener('resize', onResize); window.removeEventListener('pagehide', persist);
      persist(); scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (mounted && screen === 'menu') sound.current?.music('menu'); }, [mounted, screen]);

  // ---- pointer input on the valley: desktop mouse, and touch look / tap-to-dig / hold-to-place
  const onCanvasDown = (e: React.PointerEvent) => {
    const g = game.current; if (!g || overlayRef.current || screenRef.current !== 'play' || fairT.current >= 0) return;
    audio();
    if (e.pointerType === 'touch') {
      const l = touchSt.current.look; if (l.id >= 0) return;
      l.id = e.pointerId; l.x = e.clientX; l.y = e.clientY; l.t = performance.now(); l.moved = 0; l.held = false;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }
    const ms = mouse.current;
    if (!locked()) { ms.down = true; ms.sx = e.clientX; ms.sy = e.clientY; ms.moved = 0; ms.dragging = false; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
    if (e.button === 0) { ms.dig = true; ms.suppress = g.swing(); }
    if (e.button === 2) { ms.place = true; ms.placeT = 0.24; if (!g.place()) { ms.place = false; useAction(); } }
  };
  const onCanvasMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const l = touchSt.current.look; if (l.id !== e.pointerId) return;
    const dx = e.clientX - l.x, dy = e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; l.moved += Math.abs(dx) + Math.abs(dy);
    const s = save.current.settings.sens * 0.0062;
    look.current.yaw -= dx * s; look.current.pitch = Math.max(-1.45, Math.min(1.45, look.current.pitch - dy * s));
  };
  const onCanvasUp = (e: React.PointerEvent) => {
    const g = game.current;
    if (e.pointerType === 'touch') {
      const l = touchSt.current.look; if (l.id !== e.pointerId) return;
      l.id = -1;
      const dur = performance.now() - l.t;
      if (g && l.moved < 12) {
        if (dur < 380) { if (!g.swing()) touchSt.current.autoDig = 2.5; }
        else if (!g.place()) useAction();
      }
      return;
    }
    const ms = mouse.current;
    const wasClick = !ms.dragging;
    ms.down = false; ms.dragging = false;
    if (e.button === 0) { ms.dig = false; ms.suppress = false; if (wasClick && !locked() && !touch) lock(); }
    if (e.button === 2) ms.place = false;
  };
  // the thumb pad
  const padDown = (e: React.PointerEvent) => {
    const p = touchSt.current.pad; if (p.id >= 0) return; audio();
    const r = padRef.current!.getBoundingClientRect(); p.id = e.pointerId; p.x = r.left + r.width / 2; p.y = r.top + r.height / 2;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId); padMove(e);
  };
  const padMove = (e: React.PointerEvent) => {
    const p = touchSt.current.pad; if (p.id !== e.pointerId) return;
    const r = padRef.current!.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - p.x) / R, dy = (e.clientY - p.y) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    p.dx = Math.abs(dx) < 0.12 ? 0 : dx; p.dy = Math.abs(dy) < 0.12 ? 0 : dy;
    const k = padRef.current!.querySelector('.cv-pad-knob') as HTMLElement | null; if (k) k.style.transform = `translate(${dx * R * 0.55}px, ${dy * R * 0.55}px)`;
  };
  const padUp = (e: React.PointerEvent) => {
    const p = touchSt.current.pad; if (p.id !== e.pointerId) return; p.id = -1; p.dx = p.dy = 0;
    const k = padRef.current!.querySelector('.cv-pad-knob') as HTMLElement | null; if (k) k.style.transform = '';
  };
  const hold = (key: 'dig' | 'jump' | 'down') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); audio(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); const g = game.current; if (key === 'dig' && g && g.swing()) return; touchSt.current[key] = true; if (key === 'jump' && g?.creative) { const now = performance.now(); if (now - lastJump.current < 300) g.me.fly = !g.me.fly; lastJump.current = now; } },
    onPointerUp: () => { touchSt.current[key] = false; }, onPointerCancel: () => { touchSt.current[key] = false; },
  });

  // ---- the loom
  const g = game.current, S = save.current;
  const loomMatch = g ? g.matchLoom(threads) : null;
  const addThread = (k: string) => {
    if (!g) return; sound.current?.ui();
    setThreads((t) => {
      const used = t.find((x) => x.key === k)?.n ?? 0; if (used >= g.count(k)) return t;
      if (t.some((x) => x.key === k)) return t.map((x) => (x.key === k ? { ...x, n: x.n + 1 } : x));
      if (t.length >= 3) return t;
      return [...t, { key: k, n: 1 }];
    });
  };
  const fillPattern = (id: string) => { if (!g) return; const r = RECIPE[id]; sound.current?.ui(); setThreads(Object.entries(g.ins(r)).map(([key, n]) => ({ key, n }))); };
  const weave = () => {
    if (!g || !loomMatch || !loomMatch.known) return;
    if (g.weave(loomMatch.recipe.id, loomMatch.times)) { toast(`Woven: ${loomMatch.recipe.n * loomMatch.times} ${itemName(loomMatch.recipe.out)}`, 'small', 1800); onEvents(g.drain()); setThreads((t) => t.filter((x) => g.count(x.key) >= x.n)); }
    else sound.current?.nope();
    refresh();
  };

  const vmode = view.current.mode;
  const q = hud?.quest;
  const hearts = hud ? Array.from({ length: MAX_HP / 2 }, (_, i) => Math.max(0, Math.min(2, hud.hp - i * 2))) : [];
  const bagItems = g ? (g.creative ? PALETTE : Object.keys(g.inv).filter((k) => g.inv[k] > 0).sort((a, b) => itemName(a).localeCompare(itemName(b)))) : [];
  const knownList = g ? RECIPES.filter((r) => g.known.has(r.id)) : [];
  const unknownCount = g ? RECIPES.length - knownList.length : 0;

  return (
    <main className="cv-shell" data-ready={mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? 'true' : undefined} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvas} className="cv-canvas" data-view={vmode} onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp} onPointerCancel={onCanvasUp} tabIndex={0} aria-label="Cubby Valley" />

      {screen === 'menu' && (
        <section className="cv-menu">
          <Art src="/art/cubby/title.webp" className="cv-menu-art" />
          <div className="cv-menu-card">
            <p className="cv-eyebrow">DORA &amp; ENZO&rsquo;S ARCADE</p>
            <h1>Cubby Valley</h1>
            <p className="cv-lede">Dig, gather and build a green valley of blocks into a home six neighbours want to live in. Weave at the Burrow Workbench, build snug burrows, and keep the night&rsquo;s creatures at bay with lanterns and a trusty bonk-stick.</p>
            <div className="cv-slots">
              {Array.from({ length: SLOTS }, (_, i) => {
                const sl = S.slots[i];
                return (
                  <div className="cv-slot" key={i} data-slot={i}>
                    {sl ? (
                      <>
                        <div className="cv-slot-info"><b>{sl.name}</b><span>{MODE_NAME(sl.mode, sl.cosy)} · Day {Math.floor(sl.time / DAY) + 1}{sl.mode === 'story' ? ` · ${sl.moved.length}/6 neighbours` : ''}{sl.ended ? ' · Fair held!' : ''}</span></div>
                        <button className="cv-primary" disabled={!mounted || !!error} onClick={() => { audio(); void startSlot(i); }}>Play</button>
                        <button className="cv-small" onClick={() => { if (confirm(`Let ${sl.name} go? This can't be undone.`)) { S.slots[i] = null; persist(); refresh(); } }} aria-label={`Delete ${sl.name}`}>✕</button>
                      </>
                    ) : (
                      <>
                        <div className="cv-slot-info"><b>Empty meadow</b><span>Slot {i + 1}</span></div>
                        <button disabled={!mounted || !!error} onClick={() => { audio(); slot.current = i; setOverlay('new'); }}>New valley</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="cv-menu-foot">
              <a className="cv-back" href="/">← Arcade</a>
              <span className="cv-toggles">
                <button className={'cv-tog' + (S.settings.sound ? ' is-on' : '')} onClick={() => { S.settings.sound = !S.settings.sound; sound.current?.setSound(S.settings.sound); persist(); refresh(); }}>Sound</button>
                <button className={'cv-tog' + (S.settings.music ? ' is-on' : '')} onClick={() => { S.settings.music = !S.settings.music; audio().setMusic(S.settings.music); persist(); refresh(); }}>Music</button>
              </span>
            </div>
            {error && <p className="cv-error">{error}</p>}
          </div>
          {overlay === 'new' && (
            <div className="cv-modal" role="dialog" aria-label="A new valley">
              <div className="cv-card cv-new">
                <h2>A new valley</h2>
                <button className="cv-choice cv-primary" data-mode="story" onClick={() => void startSlot(slot.current, { mode: 'story', cosy: false })}><b>Story</b><span>Six neighbours to welcome. Nights bring Bramble Boars, Murk Moths, Gloom Gnashers and Grumblefluffs.</span></button>
                <button className="cv-choice" data-mode="cosy" onClick={() => void startSlot(slot.current, { mode: 'story', cosy: true })}><b>Story · Cosy nights</b><span>The same story with no monsters: only harmless dust-bunnies come out after dark.</span></button>
                <button className="cv-choice" data-mode="creative" onClick={() => void startSlot(slot.current, { mode: 'creative', cosy: true })}><b>Creative</b><span>Every block, endless supplies, fly with a double jump. No creatures, just building.</span></button>
                <button className="cv-small" onClick={() => setOverlay(null)}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      )}

      {screen !== 'menu' && hud && g && (
        <div className={'cv-hud' + (hud.night ? ' is-night' : '')}>
          <div className="cv-top">
            <div className="cv-status">
              {!g.creative && <div className="cv-hearts" aria-label={`${hud.hp / 2} hearts`}>{hearts.map((h, i) => <span key={i} className={'cv-heart h' + h} />)}</div>}
              <div className="cv-clock"><span className={'cv-sun' + (hud.night ? ' is-moon' : '')} /> Day {hud.day} · {hud.clock}</div>
            </div>
            {q && (
              <button className={'cv-quest' + (q.ready ? ' is-ready' : '')} onClick={() => { if (g.nearVisitor()) open('talk'); else if (q.burrow) checkBurrow(); }}>
                <Icon k={'npc:' + q.who} icons={icons} className="cv-quest-face" />
                <span className="cv-quest-text"><b>{q.name}{q.ready ? ' · ready to hand in!' : ''}</b><span>{q.text}</span>{q.progress && <em>{q.progress}</em>}</span>
                {q.arrow !== null && <span className="cv-arrow" style={{ transform: `rotate(${-q.arrow}rad)` }} aria-label="toward the notice stump">▲</span>}
              </button>
            )}
            {g.mode === 'story' && !q && <div className="cv-quest is-done"><span className="cv-quest-text"><b>All six neighbours live in Cubby Valley</b><span>Keep building!</span></span></div>}
            <div className="cv-tools">
              <button className="cv-tool" onClick={() => { view.current.mode = vmode === 'first' ? 'third' : 'first'; S.settings.view = view.current.mode; persist(); refresh(); }} aria-label="Switch view">{vmode === 'first' ? '1st' : '3rd'}</button>
              {!touch && <button className="cv-tool" onClick={() => open('help')} aria-label="Controls">?</button>}
              <button className="cv-tool" onClick={() => open('pause')} aria-label="Pause">❚❚</button>
            </div>
          </div>
          <div className="cv-cross" data-danger={hud.danger ? 'true' : undefined} />
          {hud.target && <div className="cv-target">{hud.target}</div>}
          {hud.prompt && <div className="cv-prompt">{!touch && <kbd>F</kbd>} {hud.prompt}</div>}
          {q?.burrow && !touch && <div className="cv-prompt cv-prompt-b"><kbd>B</kbd> Check the burrow you stand in</div>}
          <div className="cv-toasts">{toasts.map((t) => <div key={t.id} className={'cv-toast ' + (t.kind ?? '')}>{t.text}</div>)}</div>
          {welcome && (
            <div className="cv-welcome"><Icon k={'npc:' + welcome} icons={icons} className="cv-welcome-face" /><div><b>{NEIGHBOUR[welcome].name} moved in!</b><span>{NEIGHBOUR[welcome].thanks}</span><em>{hud.moved}/6 neighbours</em></div></div>
          )}
          <div className="cv-bottom">
            <div className="cv-hotbar">
              {hud.hot.map((k, i) => (
                <button key={i} className={'cv-hot' + (i === hud.sel ? ' is-sel' : '')} onClick={() => selectSlot(i)} aria-label={k ? itemName(k) : `Empty slot ${i + 1}`} title={k ? itemName(k) : ''}>
                  {k && <Icon k={k} icons={icons} />}{k && !g.creative && <span className="cv-n">{hud.counts[k] ?? 0}</span>}{!touch && <i>{i + 1}</i>}
                </button>
              ))}
              <button className="cv-hot cv-bag" onClick={() => open('bag')} aria-label="Bag">{touch ? 'Bag' : <><span>Bag</span><i>E</i></>}</button>
            </div>
          </div>
          {touch && (
            <div className="cv-touch">
              <div className="cv-pad" ref={padRef} onPointerDown={padDown} onPointerMove={padMove} onPointerUp={padUp} onPointerCancel={padUp}><span className="cv-pad-knob" /></div>
              <div className="cv-btns">
                <button className="cv-tb cv-tb-dig" {...hold('dig')}>Dig</button>
                <button className="cv-tb cv-tb-place" onPointerDown={(e) => { e.preventDefault(); audio(); const gg = game.current; if (gg && !gg.place()) useAction(); }}>Place</button>
                <button className="cv-tb cv-tb-jump" {...hold('jump')}>{g.me.fly ? 'Up' : 'Jump'}</button>
                {g.me.fly && <button className="cv-tb cv-tb-down" {...hold('down')}>Down</button>}
                <button className="cv-tb cv-tb-use" onPointerDown={(e) => { e.preventDefault(); useAction(); }}>{hud.prompt ? 'Use' : q?.burrow ? 'Check' : 'Use'}</button>
              </div>
            </div>
          )}
          {!touch && screen === 'play' && !overlay && !locked() && !view.current.orbit && <div className="cv-click">Click the valley to look around · drag also works</div>}
        </div>
      )}

      {screen === 'play' && g && overlay === 'bag' && (
        <div className="cv-modal" role="dialog" aria-label="Bag">
          <div className="cv-card cv-bagcard">
            <header><h2>{g.creative ? 'Every block' : 'Your bag'}</h2><button className="cv-small" onClick={close}>Close</button></header>
            <p className="cv-note">Pick a hotbar slot, then tap something to put it there.</p>
            <div className="cv-hotrow">{g.hot.map((k, i) => <button key={i} className={'cv-hot' + (i === g.sel ? ' is-sel' : '')} onClick={() => { g.sel = i; refresh(); }}>{k && <Icon k={k} icons={icons} />}<i>{i + 1}</i></button>)}</div>
            <div className="cv-grid">
              {bagItems.map((k) => (
                <button key={k} className="cv-item" onClick={() => { const at = g.hot.indexOf(k); if (at >= 0 && at !== g.sel) g.hot[at] = g.hot[g.sel]; g.hot[g.sel] = k; sound.current?.ui(); refresh(); updateHud(); }} title={itemName(k)}>
                  <Icon k={k} icons={icons} /><span>{itemName(k)}</span>{!g.creative && <em>{g.inv[k]}</em>}
                </button>
              ))}
              {!bagItems.length && <p className="cv-note">Nothing yet. Dig something!</p>}
            </div>
          </div>
        </div>
      )}

      {screen === 'play' && g && overlay === 'loom' && (
        <div className="cv-modal" role="dialog" aria-label="Burrow Workbench">
          <div className="cv-card cv-loom">
            <header><h2>The Burrow Workbench</h2><button className="cv-small" onClick={close}>Close</button></header>
            <div className="cv-loom-cols">
              <div className="cv-loom-bag">
                <p className="cv-label">Your bag: tap to lay it on a thread</p>
                <div className="cv-grid small">{bagItems.map((k) => <button key={k} className="cv-item" onClick={() => addThread(k)} title={itemName(k)}><Icon k={k} icons={icons} /><em>{g.creative ? '∞' : g.inv[k]}</em></button>)}</div>
              </div>
              <div className="cv-frame">
                <p className="cv-label">The pattern loom</p>
                {[0, 1, 2].map((i) => {
                  const t = threads[i];
                  return (
                    <div className={'cv-thread t' + i + (t ? ' is-set' : '')} key={i}>
                      {t ? <>
                        <Icon k={t.key} icons={icons} /><span>{itemName(t.key)} × {t.n}</span>
                        <button className="cv-small" onClick={() => setThreads((x) => x.map((y, j) => (j === i ? { ...y, n: y.n - 1 } : y)).filter((y) => y.n > 0))} aria-label="One fewer">−</button>
                        <button className="cv-small" onClick={() => addThread(t.key)} aria-label="One more">+</button>
                      </> : <span className="cv-empty">empty thread</span>}
                    </div>
                  );
                })}
                <div className="cv-result" data-state={loomMatch ? (loomMatch.known ? 'known' : 'unknown') : 'none'}>
                  {loomMatch && loomMatch.known && <><Icon k={loomMatch.recipe.out} icons={icons} className="big" /><b>{loomMatch.recipe.n * loomMatch.times} × {itemName(loomMatch.recipe.out)}</b><button className="cv-primary" onClick={weave}>Weave</button></>}
                  {loomMatch && !loomMatch.known && <><span className="cv-q">?</span><b>A pattern you haven&rsquo;t learned</b><span className="cv-note">{RECIPE[loomMatch.recipe.id].from === 'leaf' ? 'Find its golden recipe leaf somewhere in the valley.' : 'A neighbour will teach you this one.'}</span></>}
                  {!loomMatch && <span className="cv-note">{threads.length ? 'This pattern doesn’t make anything.' : 'Lay things on the threads, or pick a pattern from the book.'}</span>}
                </div>
                {threads.length > 0 && <button className="cv-small" onClick={() => setThreads([])}>Clear the loom</button>}
              </div>
              <div className="cv-book">
                <p className="cv-label">Pattern book · {knownList.length} known{unknownCount ? ` · ${unknownCount} still to find` : ''}</p>
                <div className="cv-patterns">
                  {knownList.map((r) => {
                    const can = g.canWeave(r.id);
                    return (
                      <button key={r.id} className={'cv-pattern' + (can ? ' can' : '')} onClick={() => fillPattern(r.id)} data-recipe={r.id}>
                        <span className="ins">{Object.entries(g.ins(r)).map(([k, n]) => <span key={k} className="ing"><Icon k={k} icons={icons} />{n}</span>)}</span>
                        <span className="arrow">→</span><span className="out"><Icon k={r.out} icons={icons} />{r.n > 1 ? r.n : ''}</span>
                        <span className="name">{itemName(r.out)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'play' && g && overlay === 'talk' && g.neighbour && g.stepNow && (() => {
        const n = g.neighbour, st = g.stepNow, first = g.quest.step === 0 && g.quest.count === 0;
        return (
          <div className="cv-modal" role="dialog" aria-label={`Talking with ${n.name}`}>
            <div className="cv-card cv-talk">
              <Icon k={'npc:' + n.id} icons={icons} className="cv-talk-face" />
              <div className="cv-talk-body">
                <p className="cv-eyebrow">{n.name.toUpperCase()} · THE {n.animal.toUpperCase()} {n.role.toUpperCase()}</p>
                {first && <p className="cv-hello">&ldquo;{n.hello}&rdquo;</p>}
                <p>&ldquo;{st.say}&rdquo;</p>
                {st.kind === 'bring' && <div className="cv-needs">{Object.entries(g.needs(st.items)).map(([k, c]) => <span key={k} className={g.count(k) >= c ? 'ok' : ''}><Icon k={k} icons={icons} />{Math.min(c, g.count(k))}/{c}</span>)}</div>}
                {st.kind === 'count' && <div className="cv-needs"><span className={g.quest.count >= st.n ? 'ok' : ''}>{g.quest.count}/{st.n}</span></div>}
                {st.kind === 'burrow' && <p className="cv-note">Build it anywhere, stand inside, and press <b>{touch ? 'Check' : 'B'}</b>.</p>}
                <div className="cv-row">
                  {st.kind !== 'burrow' && <button className="cv-primary" disabled={!g.ready()} onClick={() => { if (g.handIn()) { onEvents(g.drain()); toast(st.kind === 'bring' ? 'Handed over!' : 'Done!', 'small'); } refresh(); updateHud(); }}>{st.kind === 'bring' ? 'Give' : 'Done!'}</button>}
                  <button onClick={close}>{st.kind === 'burrow' ? 'I’ll build it!' : 'Back to it'}</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {screen === 'play' && g && overlay === 'burrow' && burrow && (
        <div className="cv-modal" role="dialog" aria-label="Burrow check">
          <div className="cv-card cv-burrow">
            <h2>Burrow check</h2>
            <ul className="cv-checks">
              <li className={burrow.report.enclosed ? 'ok' : ''}>Shut in on every side{burrow.report.enclosed ? ` (${burrow.report.size} spaces)` : ''}</li>
              <li className={burrow.report.door ? 'ok' : ''}>A round door in the wall</li>
              <li className={burrow.report.light ? 'ok' : ''}>A lantern (or other light) inside</li>
              <li className={burrow.report.bed ? 'ok' : ''}>A bed</li>
              {burrow.want && <li className={burrow.item ? 'ok' : ''}>{g.neighbour?.name}&rsquo;s {itemName(burrow.want).toLowerCase()}</li>}
              {burrow.report.enclosed && <li className={!burrow.taken ? 'ok' : ''}>Nobody lives here yet</li>}
            </ul>
            <p className="cv-note">{burrow.ok ? `Perfect for ${g.neighbour?.name}!` : burrow.reason}</p>
            <div className="cv-row">
              {burrow.ok && <button className="cv-primary" onClick={() => { if (g.moveIn()) { onEvents(g.drain()); setBurrow(null); close(); } }}>Invite {g.neighbour?.name}</button>}
              <button onClick={close}>Close</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'play' && overlay === 'help' && (
        <div className="cv-modal" role="dialog" aria-label="Controls">
          <div className="cv-card cv-help">
            <header><h2>Controls</h2><button className="cv-small" onClick={close}>Close</button></header>
            <dl>{HELP.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
            <p className="cv-note">Monsters: Bramble Boars snort before they charge (step aside and they bonk the wall), Murk Moths snuff open lanterns, Gloom Gnashers lurk by the cave crystals, Grumblefluffs nibble your bag. Bonk them with the bonk-stick for their drops. Light and walls keep them out.</p>
          </div>
        </div>
      )}

      {screen === 'play' && g && overlay === 'pause' && (
        <div className="cv-modal" role="dialog" aria-label="Paused">
          <div className="cv-card cv-pause">
            <h2>Paused</h2>
            <p className="cv-note">{g.name} · {MODE_NAME(g.mode, g.cosy)} · Day {Math.floor(g.time / DAY) + 1}</p>
            <button className="cv-primary" onClick={close}>Back to the valley</button>
            <div className="cv-row">
              <button className={'cv-tog' + (S.settings.sound ? ' is-on' : '')} onClick={() => { S.settings.sound = !S.settings.sound; sound.current?.setSound(S.settings.sound); persist(); refresh(); }}>Sound</button>
              <button className={'cv-tog' + (S.settings.music ? ' is-on' : '')} onClick={() => { S.settings.music = !S.settings.music; audio().setMusic(S.settings.music); persist(); refresh(); }}>Music</button>
              <button className="cv-tog is-on" onClick={() => { view.current.mode = vmode === 'first' ? 'third' : 'first'; S.settings.view = view.current.mode; persist(); refresh(); }}>{vmode === 'first' ? 'First person' : 'Close behind'}</button>
            </div>
            <label className="cv-sens">Look speed <input type="range" min={0.3} max={3} step={0.1} value={S.settings.sens} onChange={(e) => { S.settings.sens = Number(e.target.value); persist(); refresh(); }} /></label>
            <div className="cv-row">
              {!touch && <button onClick={() => setOverlay('help')}>Controls</button>}
              <button onClick={leave}>Save and leave</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'ending' && g && (
        <section className="cv-ending">
          <Art src="/art/cubby/ending.webp" className="cv-ending-art" />
          <div className="cv-card cv-ending-card">
            <p className="cv-eyebrow">THE SUMMER FAIR</p>
            <h2>Cubby Valley is home</h2>
            <p>Hazel&rsquo;s tarts, Morrow&rsquo;s glowing cart, Ottoline&rsquo;s stories, Juniper&rsquo;s flowers, Fennel&rsquo;s drum and Barnaby&rsquo;s bunting hooks: all six neighbours gather by the notice stump, and Dora and Enzo dance until the fireflies come out.</p>
            <p className="cv-note">Day {Math.floor(g.time / DAY) + 1} · {g.stats.dug} blocks dug · {g.stats.placed} placed · {g.stats.woven} woven · {g.stats.defeated} night creatures bonked</p>
            <div className="cv-row">
              <button className="cv-primary" onClick={() => { fairT.current = -1; setScreen('play'); sound.current?.music('day'); lock(); }}>Keep building</button>
              <button onClick={leave}>To the menu</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
