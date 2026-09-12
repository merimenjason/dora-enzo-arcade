/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  BurrowTown,
  BUILDINGS,
  BUILDING_ORDER,
  VALLEYS,
  SANDBOX,
  ROAD_COST,
  BRIDGE_MULTIPLIER,
  DAY,
  TICK,
  SPEEDS,
  GRANARY,
  WORKSHOP_RANGE,
  type Advisor,
  type Save,
  type Tool,
} from '../../lib/burrow-town-game';
import type { BurrowTownScene, Overlay } from '../../lib/burrow-town-scene';
import './town.css';

const SLOTS = [1, 2, 3];
const saveKey = (slot: number) => `burrow-town-save-v2-${slot}`;
const progressKey = (slot: number) => `burrow-town-progress-v2-${slot}`;
const SLOT_KEY = 'burrow-town-slot';
const OLD_SAVE_KEY = 'burrow-town-save-v1';
const OLD_PROGRESS_KEY = 'burrow-town-progress-v1';
const BUILDING_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 't'];
const TOOL_KEYS: Record<string, Tool> = { r: 'road', x: 'demolish' };
BUILDING_ORDER.forEach((id, i) => { if (BUILDING_KEYS[i]) TOOL_KEYS[BUILDING_KEYS[i]] = id; });
const KEY_OF = Object.fromEntries(Object.entries(TOOL_KEYS).map(([k, t]) => [t, k.toUpperCase()])) as Record<Tool, string>;
const TERRAIN_NAME = { grass: 'Grass', terrace: 'Terrace', rock: 'Rock', river: 'River' } as const;
const OVERLAY_NAMES: Record<Overlay, string> = { none: 'Plain view', comfort: 'Comfort', links: 'Roads', income: 'Earnings' };
const OVERLAY_ORDER: Overlay[] = ['none', 'comfort', 'links', 'income'];

function readProgress(slot: number): number {
  try {
    const own = localStorage.getItem(progressKey(slot));
    const raw = own ?? (slot === 1 ? localStorage.getItem(OLD_PROGRESS_KEY) : null);
    return Number(JSON.parse(raw ?? '{}').cleared ?? 0) || 0;
  } catch {
    return 0;
  }
}
function readSave(slot: number): Save | null {
  try {
    const own = localStorage.getItem(saveKey(slot));
    // A town saved before slots and stone existed still loads, into slot 1.
    const raw = own ?? (slot === 1 ? localStorage.getItem(OLD_SAVE_KEY) : null);
    const s = JSON.parse(raw ?? 'null');
    return s && (s.v === 1 || s.v === 2) ? ({ ...s, stone: s.stone ?? 0 } as Save) : null;
  } catch {
    return null;
  }
}
function readSlot(): number {
  try {
    return SLOTS.includes(Number(localStorage.getItem(SLOT_KEY))) ? Number(localStorage.getItem(SLOT_KEY)) : 1;
  } catch {
    return 1;
  }
}

/** Tiny WebAudio blips so placing things feels like something. */
function useBlips(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  return (kind: 'place' | 'road' | 'demolish' | 'deny' | 'request' | 'unlock' | 'won' | 'undo' | 'full' | 'dry') => {
    if (!enabled) return;
    try {
      ctx.current ??= new AudioContext();
      const c = ctx.current;
      if (c.state === 'suspended') void c.resume();
      const notes = { place: [523, 659], road: [392], demolish: [330, 262], deny: [196, 185], request: [523, 659, 784], unlock: [659, 784, 1047], won: [523, 659, 784, 1047, 1319], undo: [440, 349], full: [392, 330, 294], dry: [294, 262] }[kind];
      if (!notes) return;
      notes.forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = kind === 'deny' ? 'square' : 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, c.currentTime + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + i * 0.09 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.09 + 0.18);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + i * 0.09);
        o.stop(c.currentTime + i * 0.09 + 0.2);
      });
    } catch {
      /* no audio */
    }
  };
}

function Portrait({ who, size = 46 }: { who: Advisor; size?: number }) {
  const white = who === 'dora';
  const coat = white ? '#ece5d9' : '#5a5860';
  const belly = white ? '#f6f1e8' : '#8f8c95';
  return (
    <svg className="bt-portrait" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="30" cy="30" rx="14" ry="19" fill={coat} stroke="#4a3f38" strokeWidth="2" />
      <ellipse cx="70" cy="30" rx="14" ry="19" fill={coat} stroke="#4a3f38" strokeWidth="2" />
      <ellipse cx="30" cy="31" rx="8" ry="12" fill={white ? '#e2b3a4' : '#8a7073'} />
      <ellipse cx="70" cy="31" rx="8" ry="12" fill={white ? '#e2b3a4' : '#8a7073'} />
      <ellipse cx="50" cy="62" rx="36" ry="32" fill={coat} stroke="#4a3f38" strokeWidth="2" />
      <ellipse cx="50" cy="74" rx="18" ry="13" fill={belly} />
      <circle cx="37" cy="56" r="5" fill="#15110f" />
      <circle cx="63" cy="56" r="5" fill="#15110f" />
      <circle cx="38.5" cy="54.5" r="1.6" fill="#fff" />
      <circle cx="64.5" cy="54.5" r="1.6" fill="#fff" />
      <ellipse cx="50" cy="68" rx="4" ry="3" fill={white ? '#c98a84' : '#3e3238'} />
      <path d="M46 71 Q50 75 54 71" stroke="#4a3f38" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<BurrowTown | null>(null);
  const scene = useRef<BurrowTownScene | null>(null);
  const hover = useRef<[number, number] | null>(null);
  const keys = useRef(new Set<string>());
  const stroke = useRef<{ hay: number; stone: number; tiles: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [screen, setScreen] = useState<'menu' | 'play'>('menu');
  const [error, setError] = useState('');
  const [sound, setSound] = useState(true);
  const [slot, setSlot] = useState(1);
  const [cleared, setCleared] = useState(0);
  const [saves, setSaves] = useState<Record<number, Save | null>>({});
  const [overlay, setOverlay] = useState<Overlay>('none');
  const overlayRef = useRef<Overlay>('none');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeAt = useRef(0);
  const blip = useBlips(sound);
  const soundRef = useRef(blip);
  soundRef.current = blip;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const g = game.current;

  const refreshSlots = (active = slotRef.current) => {
    const all: Record<number, Save | null> = {};
    for (const n of SLOTS) all[n] = readSave(n);
    setSaves(all);
    setCleared(readProgress(active));
  };
  useEffect(() => {
    const n = readSlot();
    setSlot(n);
    slotRef.current = n;
    refreshSlots(n);
  }, []);

  const persist = () => {
    if (!game.current) return;
    try {
      localStorage.setItem(saveKey(slotRef.current), JSON.stringify(game.current.save()));
    } catch {
      /* storage full or blocked */
    }
  };
  const pickSlot = (n: number) => {
    setSlot(n);
    slotRef.current = n;
    try {
      localStorage.setItem(SLOT_KEY, String(n));
    } catch {
      /* storage blocked */
    }
    refreshSlots(n);
  };
  const begin = (index: number) => {
    game.current = new BurrowTown(index);
    setScreen('play');
    setConfirmRestart(false);
    persist();
    canvas.current?.focus();
    setTick((t) => t + 1);
  };
  const resume = () => {
    const s = readSave(slotRef.current);
    if (!s) return;
    game.current = BurrowTown.load(s);
    setScreen('play');
    canvas.current?.focus();
    setTick((t) => t + 1);
  };
  const toMenu = () => {
    persist();
    refreshSlots();
    setScreen('menu');
    setTick((t) => t + 1);
  };
  const say = (text: string) => {
    setNotice(text);
    noticeAt.current = performance.now();
  };
  const applyTool = (tile: [number, number] | null) => {
    const gm = game.current;
    if (!gm || !tile || gm.won) return;
    const hay = gm.hay;
    const stone = gm.stone;
    const why = gm.apply(tile[0], tile[1]);
    if (why) say(why);
    else if (stroke.current) {
      stroke.current.hay += hay - gm.hay;
      stroke.current.stone += stone - gm.stone;
      stroke.current.tiles++;
    }
    setTick((t) => t + 1);
  };
  const undo = () => {
    const gm = game.current;
    if (!gm?.undo()) {
      say('Nothing left to undo.');
      return;
    }
    say('Undone.');
    setTick((t) => t + 1);
  };
  const cycleOverlay = (dir = 1) => {
    const next = OVERLAY_ORDER[(OVERLAY_ORDER.indexOf(overlayRef.current) + dir + OVERLAY_ORDER.length) % OVERLAY_ORDER.length];
    overlayRef.current = next;
    setOverlay(next);
    scene.current?.setOverlay(next);
    say(OVERLAY_NAMES[next]);
  };

  useEffect(() => {
    let dead = false;
    let raf = 0;
    let last = 0;
    let ui = 0;
    let saved = 0;
    const resize = () => scene.current?.resize();
    import('../../lib/burrow-town-scene')
      .then(({ BurrowTownScene }) => {
        if (dead || !canvas.current) return;
        try {
          scene.current = new BurrowTownScene(canvas.current);
          scene.current.setOverlay(overlayRef.current);
          const loop = (now: number) => {
            const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
            last = now;
            const gm = game.current;
            const sc = scene.current!;
            const k = keys.current;
            const pan = 420 * dt;
            if (k.has('a') || k.has('arrowleft')) sc.pan(-pan, 0);
            if (k.has('d') || k.has('arrowright')) sc.pan(pan, 0);
            if (k.has('w') || k.has('arrowup')) sc.pan(0, pan);
            if (k.has('s') || k.has('arrowdown')) sc.pan(0, -pan);
            if (k.has('q')) sc.rotate(-1.6 * dt);
            if (k.has('e')) sc.rotate(1.6 * dt);
            if (k.has('=') || k.has('+')) sc.zoom(-1.2 * dt);
            if (k.has('-')) sc.zoom(1.2 * dt);
            if (gm) {
              gm.step(dt);
              for (const e of gm.events.splice(0)) {
                if (e.startsWith('unlock:')) {
                  soundRef.current('unlock');
                  say(`Unlocked: ${BUILDINGS[e.slice(7) as keyof typeof BUILDINGS].title}`);
                } else if (e === 'won') {
                  soundRef.current('won');
                  const done = Math.max(readProgress(slotRef.current), gm.index + 1);
                  if (gm.index >= 0) {
                    localStorage.setItem(progressKey(slotRef.current), JSON.stringify({ cleared: done }));
                    setCleared(done);
                  }
                } else {
                  if (e === 'full') say('The granary is spilling. Build a silo.');
                  if (e === 'dry') say('A dry day. Farms off the water grow half as much.');
                  soundRef.current(e as 'place');
                }
              }
              const h = hover.current;
              sc.setHover(h, !!h && !gm.blocked(gm.tool, h[0], h[1]));
              sc.render(gm, now / 1000);
              if (now - saved > 5000) {
                persist();
                saved = now;
              }
            } else sc.render(new BurrowTown(-1), now / 1000);
            if (now - ui > 120) {
              setTick((t) => t + 1);
              ui = now;
            }
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
          window.addEventListener('resize', resize);
        } catch {
          setError('Enable WebGL 2 and hardware acceleration, then reload.');
        }
      })
      .catch(() => setError('The valley could not load. Please reload.'));
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('button,a,input')) return;
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      keys.current.add(k);
      if (e.repeat) return;
      const gm = game.current;
      if (!gm) return;
      if (k === 'z') {
        undo();
        return;
      }
      if (k === 'v') {
        cycleOverlay(e.shiftKey ? -1 : 1);
        return;
      }
      if (k === ',' || k === '.') {
        const i = SPEEDS.indexOf(gm.speed as (typeof SPEEDS)[number]);
        gm.setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + (k === '.' ? 1 : -1)))]);
        say(`Speed ×${gm.speed}`);
        setTick((t) => t + 1);
        return;
      }
      if (TOOL_KEYS[k]) {
        gm.setTool(TOOL_KEYS[k]);
        setTick((t) => t + 1);
      }
      if (k === ' ' || k === 'p') {
        gm.pause();
        setTick((t) => t + 1);
      }
      if (k === 'escape') {
        gm.setTool('road');
        setTick((t) => t + 1);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    const hide = () => {
      if (document.hidden) persist();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hide);
      persist();
      scene.current?.dispose();
    };
  }, []);

  // Pointer handling: a tap places, a drag paints with the current tool (or pans), right-drag rotates, wheel zooms, pinch zooms.
  const pointers = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; moved: boolean; button: number }>());
  const pinch = useRef(0);
  const endStroke = () => {
    const gm = game.current;
    if (!stroke.current || !gm) return;
    gm.endStroke();
    if (stroke.current.tiles > 1) say(`${stroke.current.tiles} tiles · ${stroke.current.hay} hay${stroke.current.stone ? ` and ${stroke.current.stone} stone` : ''}`);
    stroke.current = null;
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    canvas.current?.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button });
    if (e.button === 0 && game.current) {
      game.current.beginStroke();
      stroke.current = { hay: 0, stone: 0, tiles: 0 };
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sc = scene.current;
    const gm = game.current;
    const p = pointers.current.get(e.pointerId);
    if (sc && e.pointerType === 'mouse') hover.current = sc.pick(e.clientX, e.clientY);
    if (!p || !sc) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) p.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) sc.zoom((pinch.current - d) / 220);
      pinch.current = d;
      return;
    }
    if (!p.moved) return;
    // Dragging with the left mouse button paints the current tool across tiles; the whole stroke undoes at once.
    const paints = !!gm && p.button === 0 && e.pointerType === 'mouse';
    if (p.button === 2 || p.button === 1) sc.rotate(dx * 0.006);
    else if (paints) {
      const tile = sc.pick(e.clientX, e.clientY);
      if (tile && gm && !gm.blocked(gm.tool, tile[0], tile[1])) applyTool(tile);
    } else sc.pan(-dx, dy);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (!p || !scene.current) {
      endStroke();
      return;
    }
    if (!p.moved && p.button === 0 && pointers.current.size === 0) {
      const tile = scene.current.pick(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') hover.current = tile;
      applyTool(tile);
    }
    endStroke();
  };
  const onWheel = (e: React.WheelEvent) => scene.current?.zoom(Math.sign(e.deltaY) * 0.12);

  const hoverTile = g && hover.current ? g.tile(hover.current[0], hover.current[1]) : null;
  const goal = g?.valley.goal;
  const clock = g ? (6 + Math.floor(((g.time % DAY) / DAY) * 24)) % 24 : 6;
  const isNight = g ? g.daylight >= 0.5 : false;
  const wishes = (who: Advisor) => g?.requests.filter((r) => r.advisor === who) ?? [];
  const mood = (who: Advisor) => {
    if (!g) return '';
    const a = g.approval[who];
    if (who === 'dora') return a >= 75 ? 'Beaming' : a >= 50 ? 'Content' : a >= 25 ? 'Hopeful' : g.stats.happiness > 50 ? 'Curious' : 'Waiting';
    return a >= 75 ? 'Impressed' : a >= 50 ? 'Satisfied' : a >= 25 ? 'Interested' : g.stats.income > g.stats.upkeep ? 'Counting' : 'Sceptical';
  };
  const hayCost = (tool: Tool) => (tool === 'road' ? ROAD_COST : tool === 'demolish' ? 0 : BUILDINGS[tool].cost);
  const showNotice = notice && performance.now() - noticeAt.current < 2600;
  const slotLabel = (n: number) => {
    const s = saves[n];
    return s ? `${s.valley < 0 ? SANDBOX.name : VALLEYS[s.valley]?.name ?? 'Valley'} · day ${Math.floor(s.time / DAY) + 1}` : 'Empty';
  };
  void tick;

  return (
    <main className={`bt-shell${isNight ? ' bt-night' : ''}`}>
      <header className="bt-header">
        <a href="/">← MAIN ARCADE <span>BURROW TOWN</span></a>
        <div>
          <button onClick={() => setSound((s) => !s)}>{sound ? 'Sound on' : 'Sound off'}</button>
          {screen === 'play' && g && (
            <>
              <button onClick={undo} disabled={!g.canUndo} data-testid="undo">Undo · Z</button>
              <button onClick={() => cycleOverlay()} data-testid="overlay">{OVERLAY_NAMES[overlay]} · V</button>
              <span className="bt-speeds" aria-label="Speed">
                {SPEEDS.map((n) => (
                  <button key={n} className={g.speed === n ? 'on' : ''} onClick={() => { g.setSpeed(n); setTick((t) => t + 1); }} aria-pressed={g.speed === n}>×{n}</button>
                ))}
              </span>
              <button onClick={() => { g.pause(); setTick((t) => t + 1); }} disabled={g.won}>{g.paused ? 'Resume' : 'Pause'} · Space</button>
              <button onClick={toMenu}>Valleys</button>
            </>
          )}
        </div>
      </header>
      <div className="bt-layout">
        <section className="bt-stage" aria-label="Burrow Town valley">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label="3D valley. Click a tile to build with the selected tool, drag to paint. Drag to pan, right-drag to rotate, scroll to zoom. Number keys pick buildings, R road, X demolish, Z undo, V overlay."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => { hover.current = null; }}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
          {screen === 'play' && g && (
            <>
              <div className="bt-top">
                <span><small>HAY</small><b>{Math.floor(g.hay)}</b><i className={g.stats.income - g.stats.upkeep >= 0 ? 'up' : 'down'}>{g.stats.income - g.stats.upkeep >= 0 ? '+' : ''}{(g.stats.income - g.stats.upkeep).toFixed(1)}/tick · barn {g.granary}</i></span>
                <span><small>STONE</small><b>{Math.floor(g.stone)}</b><i>{g.stats.stoneIncome ? `+${g.stats.stoneIncome}/tick` : 'quarries dig it'}</i></span>
                <span><small>RESIDENTS</small><b>{g.stats.residents}</b><i>of {g.stats.capacity} beds{goal && Number.isFinite(goal.residents) ? ` · goal ${goal.residents}` : ''}</i></span>
                <span><small>HAPPINESS</small><b>{Math.round(g.stats.happiness)}</b><i>{g.stats.homes} homes · {g.stats.roads} road{g.stats.ruins ? ` · ${g.stats.ruins} ruins` : ''}</i></span>
                <span>
                  <small>{g.valley.name.toUpperCase()}</small>
                  <b>Day {g.day}</b>
                  <i>{String(clock).padStart(2, '0')}:00{g.dry ? ' · dry day' : ''}{isNight ? ' · lamps lit' : ''}{g.paused ? ' · PAUSED' : ''}</i>
                  <div className="bt-tickbar" aria-hidden="true"><em style={{ width: `${Math.min(100, (g.acc / TICK) * 100)}%` }} /></div>
                </span>
              </div>
              {hoverTile && (
                <div className="bt-tile">
                  <b>{hoverTile.b ? `${hoverTile.ruin ? 'Ruined ' : ''}${BUILDINGS[hoverTile.b].title}` : hoverTile.road ? (hoverTile.t === 'river' ? 'Bridge' : 'Road') : TERRAIN_NAME[hoverTile.t]}</b>
                  <span>
                    {hoverTile.b && ['burrow', 'bigburrow'].includes(hoverTile.b) && !hoverTile.ruin ? `${hoverTile.res}/${BUILDINGS[hoverTile.b].houses} residents · ` : ''}
                    {hoverTile.b && hoverTile.yield ? `+${hoverTile.yield.toFixed(hoverTile.yield % 1 ? 1 : 0)} hay a tick · ` : ''}
                    {hoverTile.b && hoverTile.stoneYield ? `+${hoverTile.stoneYield} stone a tick · ` : ''}
                    {hoverTile.b ? g.advice(hoverTile) : ''}
                    {!hoverTile.b && !hoverTile.road ? (hoverTile.t === 'terrace' ? 'Farms grow 4 here.' : hoverTile.t === 'rock' ? 'Quarries and watchtowers only.' : hoverTile.t === 'river' ? `A bridge costs ${ROAD_COST * BRIDGE_MULTIPLIER}.` : 'Open ground.') : ''}
                    {!hoverTile.b && !hoverTile.road && overlay === 'comfort' ? ` Desirability here is ${hoverTile.desire.toFixed(1)}.` : ''}
                    {g.tool !== 'demolish' && !hoverTile.b && !hoverTile.road ? ` ${g.blocked(g.tool, hoverTile.x, hoverTile.y) || `Build ${g.tool === 'road' ? 'a road' : BUILDINGS[g.tool].title.toLowerCase()} for ${g.cost(g.tool, hoverTile.x, hoverTile.y)} hay${g.stoneCost(g.tool, hoverTile.x, hoverTile.y) ? ` and ${g.stoneCost(g.tool, hoverTile.x, hoverTile.y)} stone` : ''}.`}` : ''}
                  </span>
                </div>
              )}
              {showNotice && <div className="bt-notice">{notice}</div>}
              <div className="bt-cam">
                <button onPointerDown={() => keys.current.add('q')} onPointerUp={() => keys.current.delete('q')} onPointerCancel={() => keys.current.delete('q')} aria-label="Rotate left">⟲</button>
                <button onPointerDown={() => keys.current.add('w')} onPointerUp={() => keys.current.delete('w')} onPointerCancel={() => keys.current.delete('w')} aria-label="Pan up">↑</button>
                <button onPointerDown={() => keys.current.add('e')} onPointerUp={() => keys.current.delete('e')} onPointerCancel={() => keys.current.delete('e')} aria-label="Rotate right">⟳</button>
                <button onPointerDown={() => keys.current.add('a')} onPointerUp={() => keys.current.delete('a')} onPointerCancel={() => keys.current.delete('a')} aria-label="Pan left">←</button>
                <button onPointerDown={() => keys.current.add('s')} onPointerUp={() => keys.current.delete('s')} onPointerCancel={() => keys.current.delete('s')} aria-label="Pan down">↓</button>
                <button onPointerDown={() => keys.current.add('d')} onPointerUp={() => keys.current.delete('d')} onPointerCancel={() => keys.current.delete('d')} aria-label="Pan right">→</button>
                <button onPointerDown={() => keys.current.add('-')} onPointerUp={() => keys.current.delete('-')} onPointerCancel={() => keys.current.delete('-')} aria-label="Zoom out">−</button>
                <button onClick={() => { if (scene.current) { scene.current.target.set(0, 0.3, 0); scene.current.yaw = 0.62; scene.current.dist = 19; } }} aria-label="Reset view">⌂</button>
                <button onPointerDown={() => keys.current.add('=')} onPointerUp={() => keys.current.delete('=')} onPointerCancel={() => keys.current.delete('=')} aria-label="Zoom in">+</button>
              </div>
              {overlay !== 'none' && (
                <div className="bt-legend" data-testid="legend">
                  <b>{OVERLAY_NAMES[overlay]}</b>
                  {overlay === 'comfort' && <span><i className="lo" /> bleak<i className="hi" /> lovely · where a burrow would be happy</span>}
                  {overlay === 'links' && <span><i className="ok" /> reaches a plaza<i className="bad" /> cut off</span>}
                  {overlay === 'income' && <span><i className="hay" /> hay<i className="stone" /> stone · brighter earns more</span>}
                </div>
              )}
              {g.paused && !g.won && (
                <div className="bt-overlay">
                  <div>
                    <span className="bt-eyebrow">PAUSED</span>
                    <h2>The valley waits.</h2>
                    <p>Hay stops growing and nobody moves in until you come back. You can still look around, and undo as far as you like.</p>
                    <button className="bt-primary" onClick={() => { g.pause(); setTick((t) => t + 1); }}>Back to town →</button>
                    {confirmRestart ? (
                      <button className="bt-secondary" data-testid="restart-confirm" onClick={() => begin(g.index)}>Yes, start {g.valley.name} again</button>
                    ) : (
                      <button className="bt-secondary" data-testid="restart" onClick={() => setConfirmRestart(true)}>Restart this valley</button>
                    )}
                    <small>Slot {slot} saves on its own every few seconds.</small>
                  </div>
                </div>
              )}
              {g.won && (
                <div className="bt-overlay">
                  <div>
                    <span className="bt-eyebrow">VALLEY COMPLETE</span>
                    <h2>{g.valley.name} is home.</h2>
                    <p>{g.stats.residents} chinchillas live here, Dora is at {g.approval.dora} and Enzo at {g.approval.enzo}. Both of them would stay.</p>
                    {g.index + 1 < VALLEYS.length ? (
                      <button className="bt-primary" onClick={() => begin(g.index + 1)}>Next: {VALLEYS[g.index + 1].name} →</button>
                    ) : (
                      <button className="bt-primary" onClick={() => begin(-1)}>Keep building in the Open Valley →</button>
                    )}
                    <button className="bt-secondary" onClick={() => { g.won = false; g.valley = { ...g.valley, goal: { residents: Infinity, approval: Infinity } }; setTick((t) => t + 1); }}>Stay and keep building</button>
                    <small>Progress is saved in this browser.</small>
                  </div>
                </div>
              )}
            </>
          )}
          {screen === 'menu' && (
            <div className="bt-overlay bt-menu">
              <div>
                <span className="bt-eyebrow">A COZY VALLEY BUILDER</span>
                <h1>Burrow Town</h1>
                <p>Lay roads from the plaza, dig burrows, plant hay and dust baths. Dora wants a soft, happy town. Enzo wants one that pays for itself. Give them both what they ask for and the valley is yours.</p>
                {error && <p className="bt-error">{error}</p>}
                <div className="bt-slots" aria-label="Save slots">
                  {SLOTS.map((n) => (
                    <button key={n} className={slot === n ? 'on' : ''} onClick={() => pickSlot(n)} aria-pressed={slot === n} data-testid={`slot-${n}`}>
                      <small>SLOT {n}</small>
                      <span>{slotLabel(n)}</span>
                    </button>
                  ))}
                </div>
                {saves[slot] && !error && (
                  <button className="bt-primary" onClick={resume}>
                    Continue · {slotLabel(slot)}
                  </button>
                )}
                <div className="bt-valleys">
                  {VALLEYS.map((v, i) => (
                    <button key={v.name} disabled={!!error || i > cleared} onClick={() => begin(i)} className={i < cleared ? 'done' : ''}>
                      <small>VALLEY {i + 1}{i < cleared ? ' · CLEARED' : i > cleared ? ' · LOCKED' : ''}</small>
                      <b>{v.name}</b>
                      <span>{v.blurb}</span>
                      <em>{v.goal.residents} residents · both advisors at {v.goal.approval}</em>
                    </button>
                  ))}
                  <button disabled={!!error} onClick={() => begin(-1)}>
                    <small>SANDBOX</small>
                    <b>{SANDBOX.name}</b>
                    <span>{SANDBOX.blurb}</span>
                    <em>No goal. Just build.</em>
                  </button>
                </div>
                <small>Starting a valley replaces slot {slot}. Click tiles to build · drag to paint · right-drag to rotate · scroll to zoom.</small>
              </div>
            </div>
          )}
        </section>
        <aside className="bt-side">
          {screen === 'play' && g ? (
            <>
              {(['dora', 'enzo'] as Advisor[]).map((who) => (
                <div key={who} className={`bt-advisor bt-${who}`}>
                  <div className="bt-advisor-head">
                    <Portrait who={who} />
                    <div>
                      <b>{who === 'dora' ? 'Dora' : 'Enzo'}</b>
                      <small>{who === 'dora' ? 'Wants comfort, gardens and quiet' : 'Wants hay, stone, roads and workshops'} · {mood(who)}</small>
                      <div className="bt-bar"><i style={{ width: `${g.approval[who]}%` }} />{[25, 50, 75].map((m) => <em key={m} style={{ left: `${m}%` }} />)}</div>
                      <span>{g.approval[who]} approval{goal && Number.isFinite(goal.approval) ? ` · needs ${goal.approval}` : ''}</span>
                    </div>
                  </div>
                  {wishes(who).map((r) => (
                    <div key={r.key} className="bt-wish">
                      <span>{r.text}</span>
                      <div className="bt-progress"><i style={{ width: `${Math.min(100, (r.progress[0] / r.progress[1]) * 100)}%` }} /></div>
                      <small>{Math.min(r.progress[0], r.progress[1])} / {r.progress[1]} · +{r.reward} approval, +{r.reward} hay</small>
                    </div>
                  ))}
                  {!wishes(who).length && <div className="bt-wish"><span>Nothing more to ask. {who === 'dora' ? 'Dora is napping in the plaza.' : 'Enzo is counting hay.'}</span></div>}
                </div>
              ))}
              <div className="bt-log">
                {g.log.slice(0, 4).map((l, i) => (
                  <p key={i} className={l.who}><b>{l.who === 'town' ? 'Town' : l.who === 'dora' ? 'Dora' : 'Enzo'}</b> {l.text}</p>
                ))}
              </div>
            </>
          ) : (
            <div className="bt-intro">
              <h2>How a valley grows</h2>
              <p><b>Roads first.</b> A building only works if it touches a road that leads back to the plaza. Bridges over the river cost {BRIDGE_MULTIPLIER}× a road.</p>
              <p><b>Hay is money, stone is muscle.</b> Farms make hay, quarries dig stone, workshops turn stone into hay. The granary spills over {GRANARY} until you raise silos.</p>
              <p><b>Comfort fills burrows.</b> Dust baths, gardens, plazas and watchtowers make ground desirable, strongest right beside them. Quarries and workshops within two tiles spoil it. A home at comfort 4 fills fast and chips in hay.</p>
              <p><b>Two advisors.</b> Each wish you grant raises that advisor&rsquo;s approval and unlocks their buildings at 25, 50 and 75. The valley is complete when the population goal is met and both are happy enough.</p>
            </div>
          )}
        </aside>
      </div>
      {screen === 'play' && g && (
        <nav className="bt-palette" aria-label="Build tools">
          {(['road', ...BUILDING_ORDER, 'demolish'] as Tool[]).map((tool) => {
            const locked = tool !== 'road' && tool !== 'demolish' && !g.unlocked(tool);
            const b = tool !== 'road' && tool !== 'demolish' ? BUILDINGS[tool] : null;
            return (
              <button
                key={tool}
                className={`${g.tool === tool ? 'on' : ''}${locked ? ' locked' : ''}${b?.advisor ? ` bt-${b.advisor}` : ''}`}
                onClick={() => { g.setTool(tool); setTick((t) => t + 1); canvas.current?.focus(); }}
                title={b ? b.blurb : tool === 'road' ? `Road, ${ROAD_COST} hay. Paint by dragging. Bridges cost ${ROAD_COST * BRIDGE_MULTIPLIER}.` : 'Clear a tile for half its cost back. Paint by dragging.'}
                aria-pressed={g.tool === tool}
              >
                <span className="bt-icon">{b ? b.icon : tool === 'road' ? '🛤️' : '🧹'}</span>
                <b>{b ? b.title : tool === 'road' ? 'Road' : 'Clear'}</b>
                <small>{locked ? `${b!.advisor === 'dora' ? 'Dora' : 'Enzo'} ${b!.unlock}` : tool === 'demolish' ? 'refund ½' : `${hayCost(tool)} hay${b?.stone ? ` · ${b.stone} stone` : ''}`}</small>
                <kbd>{KEY_OF[tool]}</kbd>
              </button>
            );
          })}
        </nav>
      )}
      {screen === 'play' && g && (
        <div className="bt-help">
          <p><b>Build.</b> Pick a tool below (keys 1 to 0 and T, R for road, X to clear) and click a tile, or drag to paint a whole row. Z undoes, and a drag undoes in one go.</p>
          <p><b>Look.</b> Drag or WASD to pan, right-drag or Q/E to rotate, scroll or +/− to zoom. V cycles the comfort, road and earnings overlays. Space pauses, ./, change speed.</p>
          <p><b>Grow.</b> {g.tool !== 'demolish' && g.tool !== 'road' ? BUILDINGS[g.tool].blurb : g.tool === 'road' ? 'Roads link everything to the plaza. Anything with a red marker over it has no road yet.' : 'Clearing refunds half. The last plaza always stays.'} Workshops only run on stone from a quarry within {WORKSHOP_RANGE} tiles.</p>
        </div>
      )}
    </main>
  );
}
