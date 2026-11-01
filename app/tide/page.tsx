'use client';

import { useEffect, useRef, useState } from 'react';
import {
  TideGame, SAVE_KEY, TICK, TIDE, SEASONS, PAGES, INFO, KINDS, LINKS, SPECIES, BUCKET_COST, ENERGY_MAX, TO_TURN, linkKey, readSave, freshSave,
  type Save, type Mode, type Sp, type Tool, type Kind, type Ev, type Item,
} from '@/lib/tide-game';
import type { TideScene, Pose, Aim } from '@/lib/tide-scene';
import { TideSound, type SongId } from './sound';
import './tide.css';

type Screen = 'menu' | 'play' | 'free';
type ToolSel = Tool | `bring:${Sp}`;
type Tab = 'pages' | 'guide' | 'web';
const sceneModule = () => import('@/lib/tide-scene');
const SONG: SongId[] = ['spring', 'summer', 'late', 'autumn'];
const SEASON_ICON = ['🌱', '☀️', '🌾', '🍂'];
const ICON: Record<Kind, string> = { anemone: '🌺', limpet: '⛰️', periwinkle: '🐌', mussel: '🦪', seaweed: '🌿', shrimp: '🦐', hermit: '🦀', blenny: '🐟', starfish: '⭐', gull: '🕊️', jelly: '🪼' };
const TOOL_INFO: Record<Tool, { icon: string; name: string; tip: string }> = {
  look: { icon: '🔍', name: 'Look', tip: 'Click a creature to look closely and sketch it' },
  rock: { icon: '🪨', name: 'Rock', tip: 'Set a rock on the sand: more algae, more room on top' },
  shell: { icon: '🐚', name: 'Shell', tip: 'Drop a roomy shell for a hermit crab' },
  plant: { icon: '🌱', name: 'Plant', tip: 'Plant a seaweed seedling on the sand' },
  trim: { icon: '✂️', name: 'Trim', tip: 'Trim a seaweed back' },
  plank: { icon: '🪵', name: 'Plank', tip: 'Shade the pool at low tide' },
  bucket: { icon: '🪣', name: 'Bucket', tip: `Fresh seawater: cool, air and food (${BUCKET_COST} energy)` },
};
const WEATHER_NAME = { calm: '', heat: '🔥 Heatwave', bloom: '🟢 Plankton bloom', storm: '⛈ Storm' } as const;
const CAST: [string, string][] = [['Dora', 'keeper of the journal'], ['Enzo', 'carrier of buckets'], ['The anemones', 'who never let go'], ['The hermit crab', 'and all its shells'], ['The blenny', 'grumpy, kind'], ['The starfish', 'slowly, slowly'], ['The gulls', 'who were shooed']];
const GUIDE_TIPS = [
  'The tide is going out. Click any creature to look closely: that starts your journal.',
  'Your basket has a hermit crab. Choose it in the tray and click the sand to bring it in.',
  'At low tide the pool is cut off: it warms up and the air runs short. High tide brings fresh water and food.',
];

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
    <span className={'tp-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A journal sketch of one kind. */
function Sketch({ kind, level, size }: { kind: Kind; level: number; size: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((m) => { if (!dead && cv.current) m.drawSketch(cv.current, kind, level); }).catch(() => {}); return () => { dead = true; }; }, [kind, level]);
  return <canvas ref={cv} width={size * 2} height={size * 1.5} style={{ width: size, height: size * 0.75 }} className="tp-sketch" aria-hidden="true" />;
}
const Shells = ({ n, of = 3, big = false }: { n: number; of?: number; big?: boolean }) => (
  <span className={'tp-shells' + (big ? ' is-big' : '')} aria-label={`${n} of ${of} shells`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'is-on' : ''}>🐚</i>)}</span>
);
/** The tide clock: a dial with high water at the top and low water at the bottom, the hand moving round. */
function TideClock({ phase, size, connected }: { phase: number; size: number; connected: boolean }) {
  const a = phase * Math.PI * 2 - Math.PI / 2, r = size / 2 - 4;
  return (
    <svg className="tp-clock" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={connected ? 'Tide clock: high water' : 'Tide clock: low water'}>
      <defs><linearGradient id="tpc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ec4d4" /><stop offset="1" stopColor="#f0d8a0" /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="url(#tpc)" stroke="#5a3e2e" strokeWidth="2.5" />
      <path d={`M ${size / 2 - r} ${size / 2} A ${r} ${r} 0 0 1 ${size / 2 + r} ${size / 2}`} fill="rgba(40,130,160,0.35)" />
      <text x={size / 2} y={size * 0.3} textAnchor="middle" fontSize={size * 0.18} fontWeight="800" fill="#18505e">H</text>
      <text x={size / 2} y={size * 0.86} textAnchor="middle" fontSize={size * 0.18} fontWeight="800" fill="#7a5a2a">L</text>
      <line x1={size / 2} y1={size / 2} x2={size / 2 + Math.cos(a) * r * 0.8} y2={size / 2 + Math.sin(a) * r * 0.8} stroke="#e0583a" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={3.5} fill="#5a3e2e" />
    </svg>
  );
}
/** The food web: who eats whom, solid where you have seen it happen. */
function FoodWeb({ links, sketch }: { links: string[]; sketch: Partial<Record<Kind, number>> }) {
  const P: Record<string, [number, number]> = {
    gull: [290, 40], periwinkle: [-10, 140], blenny: [140, 140], starfish: [440, 140], hermit: [590, 140],
    limpet: [-10, 245], shrimp: [140, 245], anemone: [290, 245], mussel: [440, 245], jelly: [590, 245],
    algae: [65, 350], plankton: [365, 350], scraps: [590, 350],
  };
  const label = (k: string) => (k === 'algae' ? '🟩 algae' : k === 'plankton' ? '✨ plankton' : k === 'scraps' ? '🍂 scraps' : (sketch[k as Kind] ?? 0) > 0 ? `${ICON[k as Kind]} ${INFO[k as Kind].name.replace('Beadlet ', '').replace('Herring ', '').replace('Rock ', '')}` : '❔ ?');
  return (
    <svg className="tp-web" viewBox="-80 0 740 390" role="img" aria-label="The food web">
      <defs><marker id="tpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5a3e2e" /></marker></defs>
      {LINKS.map(([a, b]) => {
        const seen = links.includes(linkKey(a, b)), [x1, y1] = P[b], [x2, y2] = P[a];
        return <line key={a + b} x1={x1} y1={y1 - 14} x2={x2} y2={y2 + 16} stroke={seen ? '#5a3e2e' : '#b8a890'} strokeWidth={seen ? 3 : 2} strokeDasharray={seen ? undefined : '6 6'} markerEnd="url(#tpa)" opacity={seen ? 0.9 : 0.6} />;
      })}
      {Object.entries(P).map(([k, [x, y]]) => (
        <g key={k} transform={`translate(${x},${y})`}>
          <rect x={-62} y={-17} width={124} height={34} rx={17} fill={k === 'algae' || k === 'plankton' || k === 'scraps' ? '#e8f0d8' : '#fff6e4'} stroke="#5a3e2e" strokeWidth="2" />
          <text textAnchor="middle" y={6} fontSize="16" fontWeight="700" fill="#3a2e28">{label(k)}</text>
        </g>
      ))}
    </svg>
  );
}

export default function TidePage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), side = useRef<HTMLElement>(null), tray = useRef<HTMLElement>(null);
  const scene = useRef<TideScene | null>(null), sound = useRef<TideSound | null>(null);
  const game = useRef<TideGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), holdRef = useRef(false), speedRef = useRef(1), toolRef = useRef<ToolSel>('look');
  const hover = useRef<[number, number] | null>(null), acc = useRef(0), lastSave = useRef(0);
  const poses = useRef<{ dora: [Pose, number]; enzo: [Pose, number] }>({ dora: ['peer', 0], enzo: ['peer', 0] });
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [speed, setSpeedState] = useState(1);
  const [tool, setToolState] = useState<ToolSel>('look'), [journal, setJournal] = useState<Tab | null>(null), [seasonCard, setSeasonCard] = useState<number | null>(null);
  const [ending, setEnding] = useState(false), [note, setNote] = useState<{ kind: Kind; id: number; level: number; up: boolean } | null>(null);
  const [toast, setToast] = useState<{ text: string; shells: number; id: number } | null>(null), [msg, setMsg] = useState('');
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const setSpeed = (v: number) => { speedRef.current = v; setSpeedState(v); };
  const setTool = (t: ToolSel) => { toolRef.current = t; setToolState(t); };
  const S = save.current;
  const hold = () => holdRef.current;
  const flags = useRef({ paused: false, journal: false, season: false, ending: false }), noteRef = useRef<{ kind: Kind; id: number } | null>(null);

  const persist = () => {
    const g = game.current;
    if (g) { if (g.mode.kind === 'story') save.current.run = g.ended ? null : g.snapshot(); else save.current.free = g.snapshot(); }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ }
  };
  const audio = () => { sound.current ??= new TideSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const syncHold = (o: Partial<Record<'paused' | 'journal' | 'season' | 'ending', boolean>>) => {
    Object.assign(flags.current, o);
    const f = flags.current; holdRef.current = f.paused || f.journal || f.season || f.ending;
  };
  const pose = (who: 'dora' | 'enzo', p: Pose, secs: number) => { poses.current[who] = [p, performance.now() + secs * 1000]; };

  function begin(g: TideGame) {
    game.current = g; acc.current = 0; setTool('look'); setNote(null); setToast(null); setMsg('');
    syncHold({ paused: false, journal: false, season: false, ending: false }); setPaused(false); setJournal(null); setSeasonCard(null); setEnding(false); noteRef.current = null;
    scene.current?.setGame(g); sound.current?.music(SONG[g.season]);
    setScreen('play'); refresh();
    requestAnimationFrame(() => { layout(); canvas.current?.focus(); });
  }
  function startStory(fresh: boolean) {
    audio().ui();
    const g = !fresh && save.current.run ? TideGame.load(save.current.run) : null;
    const game2 = g ?? new TideGame({ kind: 'story' }, 20261101);
    save.current.run = game2.snapshot(); persist();
    begin(game2);
  }
  function startFree(season: number) {
    audio().ui();
    const old = save.current.free ? TideGame.load(save.current.free) : null;
    const g = old && old.mode.kind === 'free' && old.mode.season === season ? old : new TideGame({ kind: 'free', season } as Mode, 1000 + season);
    begin(g);
  }
  function toMenu() {
    persist(); game.current = null; syncHold({ paused: false, journal: false, season: false, ending: false }); setPaused(false); setJournal(null); setSeasonCard(null); setEnding(false); setNote(null); setToast(null);
    scene.current?.setGame(null); setScreen('menu'); sound.current?.music('menu'); refresh();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current) return;
    setPaused(on); syncHold({ paused: on });
    if (on) persist(); else canvas.current?.focus();
  }
  function openJournal(t: Tab | null) { audio().ui(); setJournal(t); syncHold({ journal: !!t }); }

  /** What the game's events mean for the page: poses, toasts, the season card and the ending. */
  function react(ev: Ev[], g: TideGame) {
    for (const e of ev) {
      if (e.k === 'page') { const p = PAGES[e.id - 1]; setToast({ text: p.title, shells: e.shells, id: e.id }); pose('dora', 'cheer', 3); pose('enzo', 'cheer', 3); persist(); }
      else if (e.k === 'look') { noteRef.current = g.lookedAt; setNote({ kind: e.kind, id: g.lookedAt?.id ?? -1, level: e.level, up: e.up }); if (e.up) pose('dora', 'write', 2.5); }
      else if (e.k === 'act' && e.t === 'bucket') pose('enzo', 'bucket', 3);
      else if (e.k === 'act' && (e.t === 'bring' || e.t === 'plant' || e.t === 'rock' || e.t === 'shell')) pose(e.x < 80 ? 'dora' : 'enzo', 'bucket', 1.6);
      else if (e.k === 'gull' && e.st === 'shoo') pose(e.x < 80 ? 'dora' : 'enzo', 'cheer', 1.2);
      else if (e.k === 'season') { setSeasonCard(e.season); syncHold({ season: true }); sound.current?.music(SONG[e.season]); persist(); }
      else if (e.k === 'ending') { save.current.ended = true; save.current.best = Math.max(save.current.best, g.shellCount()); save.current.run = null; persist(); setTimeout(() => { setEnding(true); syncHold({ ending: true }); sound.current?.music('ending'); }, 900); }
    }
  }
  function act(a: Parameters<TideGame['act']>[0]) {
    const g = game.current; if (!g) return false;
    const ok = g.act(a);
    if (!ok) { if (a.t !== 'look') { setMsg(g.why); audio().nope(); } return false; }
    const ev = g.events.splice(0);
    scene.current?.feed(ev); sound.current?.play(ev); react(ev, g);
    setMsg('');
    if (a.t === 'bring' && g.basket[a.sp] <= 0) setTool('look');
    if ((a.t === 'rock' || a.t === 'shell' || a.t === 'plant') && g.basket[a.t === 'plant' ? 'seedling' : a.t] <= 0) setTool('look');
    refresh();
    return true;
  }
  /** A click or tap on the pool: shoo a gull if there is one, otherwise use the tool. */
  function useAt(x: number, y: number) {
    const g = game.current; if (!g || hold()) return;
    audio();
    if (g.gullAt(x, y)) { act({ t: 'shoo', x, y }); return; }
    const t = toolRef.current;
    if (t === 'look') { act({ t: 'look', x, y }); return; }
    if (t === 'rock' || t === 'shell' || t === 'plant') { act({ t, x }); return; }
    if (t === 'trim') { act({ t: 'trim', x, y }); return; }
    if (t.startsWith('bring:')) { act({ t: 'bring', sp: t.slice(6) as Sp, x, y }); return; }
  }
  function choose(t: ToolSel) {
    const g = game.current; if (!g || hold()) return;
    audio();
    if (t === 'plank' || t === 'bucket') { act({ t }); return; }
    sound.current?.tool(); setTool(toolRef.current === t ? 'look' : t); setMsg(''); refresh();
  }
  function aim(): Aim {
    const g = game.current, h = hover.current; if (!g || !h || touch) return null;
    const t = toolRef.current;
    if (g.gullAt(h[0], h[1])) return { tool: 'look', x: h[0], y: h[1], ok: true };
    const inPool = h[0] > 24 && h[0] < 136 && h[1] > 30;
    return { tool: t, x: h[0], y: h[1], ok: inPool };
  }
  /** The screen's clear area, so the pool is framed round the HUD. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const tall = r.width < r.height * 0.9;
    setOrient(tall ? 'tall' : 'wide');
    if (!sc) return;
    sc.resize();
    const inset = { top: 6, right: 6, bottom: 6, left: 6 };
    const p = side.current?.getBoundingClientRect(), t = tray.current?.getBoundingClientRect();
    if (p && p.width > 0) { if (p.height > r.height * 0.6) inset.right = Math.max(6, r.right - p.left + 6); else inset.bottom = Math.max(inset.bottom, r.bottom - p.top + 6); }
    if (t && t.width > 0) inset.bottom = Math.max(inset.bottom, r.bottom - t.top + 6);
    sc.inset = inset; sc.compact = tall;
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse);
    setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__tide = () => game.current;
    w.__tideScene = () => scene.current?.metrics() ?? null;
    w.__tideAt = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(), [px, py] = sc.toScreen(x, y); return [b.left + px, b.top + py]; };
    w.__tideRun = (n: number) => { const g = game.current; if (!g) return; for (let i = 0; i < n && !g.ended; i++) { g.step(); const ev = g.events.splice(0); scene.current?.feed(ev); react(ev, g); } persist(); refresh(); };
    w.__tideSave = () => persist();
    let dead = false, raf = 0, last = 0, ui = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.TideScene(canvas.current); } catch { setError('This browser cannot draw the pool.'); return; }
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      if (game.current) scene.current.setGame(game.current);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, playing = screenRef.current === 'play' && !!g;
        const frozen = hold() || speedRef.current === 0;
        if (playing && g && !frozen) {
          acc.current += dt * speedRef.current;
          let n = 0;
          while (acc.current >= TICK && n < 60) {
            acc.current -= TICK; n++;
            g.step();
            if (g.events.length) { const ev = g.events.splice(0); sc.feed(ev); sound.current?.play(ev); react(ev, g); }
          }
          if (ms - lastSave.current > 4000) { lastSave.current = ms; persist(); }
        }
        const now = performance.now(), P = poses.current;
        const pz = { dora: now < P.dora[1] ? P.dora[0] : 'peer' as Pose, enzo: now < P.enzo[1] ? P.enzo[0] : 'peer' as Pose };
        if (playing && g && g.release > 0) { pz.dora = 'cheer'; pz.enzo = 'cheer'; }
        sc.draw(playing ? g : null, { dt: frozen && playing ? dt * 0.25 : dt, alpha: Math.min(1, acc.current / TICK), aim: playing && !frozen ? aim() : null, poses: pz, look: playing ? noteRef.current : null });
        sound.current?.waves(g ? g.level : 0.3, !hold(), ms / 1000);
        sound.current?.tick(!holdRef.current || !!game.current?.ended);
        if (ms - ui > 200) { ui = ms; if (playing) refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The pool could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current, tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !g) return;
      if (k === 'escape' || k === 'p') { if (!e.repeat) { e.preventDefault(); pause(!holdRef.current); } return; }
      if (holdRef.current) return;
      if (tgt.closest?.('button, a') && (k === ' ' || k === 'enter')) return;
      const order: ToolSel[] = ['look', 'rock', 'shell', 'plant', 'trim', 'plank', 'bucket'];
      if (k >= '1' && k <= '7') { e.preventDefault(); choose(order[+k - 1]); }
      else if (k === ' ') { e.preventDefault(); setSpeed(speedRef.current === 0 ? 1 : 0); }
      else if (k === 'f' || k === '.') { e.preventDefault(); setSpeed(speedRef.current >= 4 ? 1 : speedRef.current === 0 ? 1 : speedRef.current * 2); }
      else if (k === 'j') { e.preventDefault(); openJournal('pages'); }
      else if (k === 'b') { e.preventDefault(); choose('bucket'); }
      else if (k === 'k') { e.preventDefault(); choose('plank'); }
    };
    const blur = () => { pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden) sound.current?.resume(); };
    const vis = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', vis);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect();
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, orient, touch]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 3200); return () => clearTimeout(t); }, [msg]);

  // ---------------------------------------------------------------- the pointer
  const world = (e: React.PointerEvent): [number, number] | null => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(); return sc.toWorld(e.clientX - b.left, e.clientY - b.top); };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') { if (touch) setTouch(false); hover.current = world(e); } };
  const onUp = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || hold()) return;
    if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = world(e); if (p) useAt(p[0], p[1]);
  };

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="tp-chips">
      <button className="tp-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="tp-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  const g = game.current;
  const story = g?.mode.kind === 'story';
  const savedRun = mounted && S.run ? TideGame.load(S.run) : null;
  const jg = g ?? savedRun;
  const basketSp = g ? SPECIES.filter((sp) => g.basket[sp] > 0) : [];
  const count = (it: Item) => g?.basket[it] ?? 0;
  const keysLine = <><kbd>1</kbd>–<kbd>7</kbd> tools · click the pool to use one · click a gull to shoo it · <kbd>Space</kbd> pause the tide · <kbd>F</kbd> faster · <kbd>J</kbd> journal · <kbd>B</kbd> bucket · <kbd>K</kbd> plank · <kbd>Esc</kbd> menu</>;
  const tips = g && story && g.tideNo < 2 && g.season === 0 ? GUIDE_TIPS[Math.min(2, g.tideNo === 0 ? (g.stats.brought.hermit ? 2 : Object.keys(g.sketch).length ? 1 : 0) : 2)] : null;
  const pagesNow = g && story ? PAGES.filter((p) => p.season === g.season && p.id !== 24) : [];
  const tideLeft = g ? (g.connected ? (g.phase < 0.25 ? 0.25 - g.phase : 1.25 - g.phase) : 0.75 - g.phase) : 0;
  const tideTimeLeft = Math.max(0, Math.round((tideLeft * TIDE * TICK) / Math.max(1, speed)));
  const lookInfo = note ? INFO[note.kind] : null;

  const pageCard = (p: (typeof PAGES)[number], gm: TideGame, big = false) => {
    const d = gm.done[p.id], [now, need] = gm.progress(p.id), current = gm.season === p.season;
    return (
      <li key={p.id} className={'tp-page' + (d ? ' is-done' : '') + (big ? ' is-big' : '') + (toast?.id === p.id ? ' is-new' : '')} data-page={p.id}>
        <b>{d ? '✓ ' : ''}{p.title}</b>
        <small>{p.goal}</small>
        {d ? <Shells n={d.shells} /> : current && p.id !== 24 ? <i className="tp-bar-mini"><i style={{ width: `${Math.min(100, (now / need) * 100)}%` }} /></i> : null}
        {!d && p.rewardText && <em>Reward: {p.rewardText}</em>}
      </li>
    );
  };

  return (
    <main className="tp-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-orient={orient}>
      {screen === 'play' && g && (
        <header className="tp-top">
          <a href="/" className="tp-back">← ARCADE</a>
          <span className="tp-top-mid">
            <TideClock phase={g.phase} size={orient === 'tall' ? 34 : 44} connected={g.connected} />
            <span className="tp-tideword"><b>{g.release > 0 ? 'The spring tide!' : g.connected ? 'High tide' : 'Low tide'}</b><small>{g.release > 0 ? 'everyone out to sea' : `${g.connected ? 'ebbs' : 'floods'} in ${tideTimeLeft}s`}</small></span>
            <span className="tp-season">{SEASON_ICON[g.season]} {SEASONS[g.season].name}<small>tide {g.seasonTide + 1}{g.weather !== 'calm' ? ` · ${WEATHER_NAME[g.weather]}` : ''}</small></span>
            {story && <span className="tp-stat" title="Shells earned">🐚 {g.shellCount()}</span>}
            <span className="tp-stat tp-energy" title="Energy (for buckets)">⚡ {g.energy}<small>/{ENERGY_MAX}</small></span>
          </span>
          <span className="tp-speeds" role="group" aria-label="Speed">
            {[0, 1, 2, 4].map((v) => <button key={v} className={'tp-speed' + (speed === v ? ' is-on' : '')} aria-pressed={speed === v} onClick={() => { audio().ui(); setSpeed(v); }} aria-label={v === 0 ? 'Pause the tide' : `Speed ${v}×`}>{v === 0 ? '❚❚' : `${v}×`}</button>)}
          </span>
          <button className="tp-chip tp-jbtn" onClick={() => openJournal('pages')} aria-label="Open the journal">📖<span> Journal</span></button>
          <button className="tp-chip tp-menu-btn" onClick={() => pause(true)} aria-label="Menu">☰</button>
        </header>
      )}
      <div className="tp-stage" ref={stage}>
        <canvas ref={canvas} className="tp-canvas" tabIndex={0} data-testid="pool"
          aria-label="The rock pool. Choose a tool, then click the pool to use it; click a gull to shoo it."
          onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { hover.current = null; }} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && g && (<>
          <aside className="tp-side" ref={side} aria-label="The pool and this season's pages">
            <div className="tp-meters">
              <span className={'tp-meter' + (g.temp > 24 ? ' is-warn' : '')} title="Water temperature"><i>🌡</i><b>{g.temp.toFixed(1)}°</b><small>warmth</small></span>
              <span className={'tp-meter' + (g.o2 < 45 ? ' is-warn' : '')} title="Air in the water"><i>🫧</i><b>{Math.round(g.o2)}%</b><small>air</small><u><u style={{ width: `${g.o2}%` }} /></u></span>
              <span className="tp-meter" title="Drifting food"><i>✨</i><b>{Math.round(g.food)}</b><small>food</small></span>
              <span className="tp-meter" title="Kinds living here"><i>🐾</i><b>{g.kinds().length}</b><small>kinds</small></span>
            </div>
            {note && lookInfo ? (
              <div className="tp-note" role="status" aria-live="polite">
                <Sketch kind={note.kind} level={note.level} size={orient === 'tall' && touch ? 64 : 88} />
                <div><b>{lookInfo.name}</b>
                  <small>{note.up ? `✏️ sketch ${note.level} of 3` : note.level >= 3 ? '📖 sketch finished' : 'look again in a moment, or at another'}</small>
                  {note.level >= 2 && <p>Eats {lookInfo.eats}.</p>}
                  {note.level >= 3 && <p>Eaten by {lookInfo.eatenBy}.</p>}
                  {note.level < 2 && <p>{lookInfo.note.split('.')[0]}.</p>}
                </div>
                <button className="tp-x" onClick={() => { setNote(null); noteRef.current = null; }} aria-label="Close the note">×</button>
              </div>
            ) : tips ? <p className="tp-tip">{tips}</p> : null}
            {story ? (
              <>
                <p className="tp-eyebrow">{SEASON_ICON[g.season]} {SEASONS[g.season].name.toUpperCase()} · {g.pagesDone(g.season)} OF {pagesNow.length} PAGES</p>
                <ul className="tp-pages">{pagesNow.map((p) => pageCard(p, g))}</ul>
                {g.canTurn() && <button className="tp-go tp-turn" onClick={() => act({ t: 'season' })}>{SEASON_ICON[g.season + 1]} On to {SEASONS[g.season + 1].name} →</button>}
                {g.canRelease() && <button className="tp-go tp-turn" onClick={() => act({ t: 'release' })}>🌊 The spring tide: release everyone →</button>}
                {!g.canTurn() && !g.canRelease() && g.release === 0 && <p className="tp-small">{TO_TURN} pages turn the season{g.season === 3 ? ' to the spring tide' : ''}.</p>}
              </>
            ) : <p className="tp-small">🏖 Free pool · {SEASONS[g.season].name}. No pages, just the pool: the basket refills each low tide.</p>}
          </aside>
          <nav className="tp-tray" ref={tray} aria-label="Tools and basket">
            {(['look', 'rock', 'shell', 'plant', 'trim', 'plank', 'bucket'] as Tool[]).filter((t) => g.tools.includes(t)).map((t, i) => {
              const n = t === 'rock' ? count('rock') : t === 'shell' ? count('shell') : t === 'plant' ? count('seedling') : -1;
              const on = t === 'plank' ? g.plank : tool === t;
              const off = n === 0 || (t === 'bucket' && (g.energy < BUCKET_COST || g.connected)) || (t === 'plank' && !g.plank && g.connected);
              return (
                <button key={t} className={'tp-tool' + (on ? ' is-on' : '')} aria-pressed={on} disabled={off} onClick={() => choose(t)} title={`${TOOL_INFO[t].tip} (${i + 1})`} aria-label={TOOL_INFO[t].name}>
                  <i>{TOOL_INFO[t].icon}</i><span>{TOOL_INFO[t].name}</span>{n >= 0 && <b>{n}</b>}{t === 'bucket' && <b>⚡{BUCKET_COST}</b>}
                </button>
              );
            })}
            {basketSp.length > 0 && <span className="tp-sep" aria-hidden="true" />}
            {basketSp.map((sp) => (
              <button key={sp} className={'tp-tool tp-bring' + (tool === `bring:${sp}` ? ' is-on' : '')} aria-pressed={tool === `bring:${sp}`} onClick={() => choose(`bring:${sp}`)} title={`Bring the ${INFO[sp].name.toLowerCase()} in from the basket: then click the pool`} aria-label={`Bring in: ${INFO[sp].name}`}>
                <i>{ICON[sp]}</i><span>{INFO[sp].name.replace('Beadlet ', '').replace('Rock ', '')}</span><b>{g.basket[sp]}</b>
              </button>
            ))}
          </nav>
          {msg && <p className="tp-msg" role="status">{msg}</p>}
          {toast && <div className="tp-toast" role="status"><small>📖 JOURNAL PAGE DONE</small><b>{toast.text}</b><Shells n={toast.shells} /></div>}
        </>)}
      </div>
      {error && <div className="tp-panel tp-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="tp-menu" aria-label="Tidepool">
          <header className="tp-head"><a href="/" className="tp-back">← ARCADE</a>{settings}</header>
          <div className="tp-hero">
            <Art src="/art/tide/title.webp" paint="title" w={1536} h={1024} className="tp-hero-art" />
            <div className="tp-hero-text"><p className="tp-eyebrow">A COSY ROCK-POOL ECOSYSTEM</p><h1>Tide<em>pool</em></h1>
              <p className="tp-lede">Below the summer cottage there is a rock pool. Dora and Enzo look after it through the tides and the seasons: anemones and limpets, a grumpy blenny, a hermit crab forever outgrowing its shell, and gulls to shoo. Nudge, watch, and fill in the journal.</p></div>
          </div>
          <div className="tp-go-row">
            {mounted && savedRun ? <button className="tp-go" disabled={!ready} onClick={() => startStory(false)}>CONTINUE →<small>{SEASON_ICON[savedRun.season]} {SEASONS[savedRun.season].name} · {savedRun.pagesDone()} of 24 pages</small></button>
              : <button className="tp-go" disabled={!ready} onClick={() => startStory(true)}>{!ready ? 'Filling the pool…' : 'START →'}<small>{mounted && S.ended ? 'a new summer at the pool' : 'Spring at the rock pool'}</small></button>}
            {mounted && savedRun && <button className="tp-alt" disabled={!ready} onClick={() => startStory(true)}>🌱 New pool<small>starts the journal again</small></button>}
            <button className="tp-alt" disabled={!ready || !jg} onClick={() => openJournal('pages')}>📖 Journal<small>{jg ? `${jg.pagesDone()} pages · 🐚 ${jg.shellCount()}` : 'starts with your first look'}</small></button>
            {mounted && S.ended ? <button className="tp-alt tp-sea" disabled={!ready} onClick={() => { audio().ui(); setScreen('free'); }}>🏖 Free pool<small>any season, every creature</small></button>
              : <button className="tp-alt" disabled><span>🏖 Free pool</span><small>after the spring tide</small></button>}
            {mounted && S.ended && <button className="tp-alt" onClick={() => { audio().ui(); setEnding(true); sound.current?.music('ending'); }}>🌅 The ending<small>best 🐚 {S.best}</small></button>}
          </div>
          {mounted && savedRun && <p className="tp-note-line">Your pool is waiting where you left it. A new pool starts the journal again.</p>}
          <ol className="tp-how" aria-label="How to play">
            <li><b>🌊 The tide clock.</b> High tide brings cool water, food and new arrivals. At low tide the pool is on its own: it warms, the air runs short and the gulls come.</li>
            <li><b>🪨 Gentle nudges.</b> Place rocks and shells, plant and trim seaweed, shade the pool with the plank, fetch a bucket of seawater, bring creatures in from your basket, and shoo the gulls.</li>
            <li><b>🦀 Who eats whom.</b> Anemones catch food, limpets graze the rocks, shrimp hide from the blenny, starfish eat mussels. Every nudge ripples through the food web.</li>
            <li><b>📖 The journal.</b> 24 pages over four seasons, each worth up to three shells. Look closely to sketch every creature. In autumn comes the great spring tide.</li>
          </ol>
          <p className="tp-keys">{keysLine}</p>
        </section>
      )}

      {screen === 'free' && (
        <section className="tp-menu tp-free" aria-label="Free pool">
          <header className="tp-head"><button className="tp-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="tp-total">🏖 Free pool</b></header>
          <h2 className="tp-free-title">Which season?</h2>
          <p className="tp-lede tp-center">Every creature and tool, a basket that refills, no pages: just the pool.</p>
          <div className="tp-grid">
            {SEASONS.map((s, i) => (
              <button key={s.name} className={`tp-card tp-s${i}`} disabled={!ready} onClick={() => startFree(i)} aria-label={`Free pool in ${s.name}`}>
                <span className="tp-card-ico">{SEASON_ICON[i]}</span>
                <b>{s.name}</b>
                <span>{s.blurb}</span>
                <em>sea {s.sea}° · air {s.air}° · {Math.round(s.light * 100)}% light</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {journal && jg && (
        <div className="tp-journal" role="dialog" aria-label="The journal">
          <div className="tp-book">
            <header className="tp-book-head">
              <b>📖 Dora &amp; Enzo’s rock-pool journal</b>
              <span className="tp-tabs" role="tablist">
                {(['pages', 'guide', 'web'] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={journal === t} className={'tp-tab' + (journal === t ? ' is-on' : '')} onClick={() => { audio().ui(); setJournal(t); }}>{t === 'pages' ? '📜 Pages' : t === 'guide' ? '✏️ Field guide' : '🕸 Food web'}</button>)}
              </span>
              <button className="tp-x" onClick={() => openJournal(null)} aria-label="Close the journal">×</button>
            </header>
            {journal === 'pages' && (
              <div className="tp-seasons">
                {SEASONS.map((s, i) => (
                  <section key={s.name} className={'tp-season-col' + (jg.season === i ? ' is-now' : '') + (jg.season < i ? ' is-later' : '')}>
                    <h3>{SEASON_ICON[i]} {s.name} <small>{jg.pagesDone(i)}/{jg.pagesIn(i).length}</small></h3>
                    <ul className="tp-pages">{jg.pagesIn(i).map((p) => (jg.season >= i || jg.done[p.id] ? pageCard(p, jg, true) : <li key={p.id} className="tp-page is-big is-locked"><b>🔒 {p.title}</b><small>a page for {s.name.toLowerCase()}</small></li>))}</ul>
                  </section>
                ))}
              </div>
            )}
            {journal === 'guide' && (
              <ul className="tp-guide">
                {KINDS.map((k) => {
                  const lv = jg.sketch[k] ?? 0, I = INFO[k];
                  return (
                    <li key={k} className={'tp-entry' + (lv >= 3 ? ' is-done' : '')}>
                      <Sketch kind={k} level={lv} size={120} />
                      <b>{lv > 0 ? I.name : '???'}</b>
                      <small>{'✏️'.repeat(lv)}{'·'.repeat(3 - lv)} sketch {lv}/3</small>
                      {lv >= 2 && <p><i>Eats:</i> {I.eats}</p>}
                      {lv >= 3 && <p><i>Eaten by:</i> {I.eatenBy}</p>}
                      {lv >= 3 && <p className="tp-entry-note">{I.note}</p>}
                      {lv === 0 && <p className="tp-entry-note">Not seen yet. Look closely at one in the pool.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {journal === 'web' && (
              <div className="tp-webwrap">
                <FoodWeb links={jg.links} sketch={jg.sketch} />
                <p className="tp-small">Solid arrows: seen in your pool ({jg.links.length} of {LINKS.length}). Dashed: still to see. The arrow points from the food to who eats it.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {seasonCard !== null && g && (
        <div className="tp-panel tp-seasoncard" role="dialog" aria-label={`${SEASONS[seasonCard].name} begins`}>
          <p className="tp-eyebrow">A NEW SEASON AT THE POOL</p>
          <h2>{SEASON_ICON[seasonCard]} {SEASONS[seasonCard].name}</h2>
          <p>{SEASONS[seasonCard].blurb}</p>
          {seasonCard === 1 && <p className="tp-gift">🪵 The driftwood plank and 🪣 the bucket are in the tray now.</p>}
          {seasonCard === 2 && <p className="tp-gift">⭐ A starfish is waiting in your basket.</p>}
          {seasonCard === 3 && <p className="tp-gift">🪨 Two rocks and a seedling for the storms ahead.</p>}
          <button className="tp-go" autoFocus onClick={() => { setSeasonCard(null); syncHold({ season: false }); canvas.current?.focus(); }}>To the pool →</button>
        </div>
      )}

      {paused && g && (
        <div className="tp-panel" role="dialog" aria-label="Paused">
          <h2>Paused</h2><p>The tide will wait.</p>
          {settings}
          <p className="tp-keys">{keysLine}</p>
          <div className="tp-row"><button className="tp-go" autoFocus onClick={() => pause(false)}>Back to the pool</button><button className="tp-alt" onClick={() => { pause(false); openJournal('pages'); }}>📖 Journal</button><button className="tp-alt" onClick={() => toMenu()}>Menu</button></div>
        </div>
      )}

      {ending && (
        <div className="tp-ending" role="dialog" aria-label="The spring tide">
          <Art src="/art/tide/ending.webp" paint="ending" w={1536} h={1024} className="tp-ending-art" />
          <div className="tp-ending-text">
            <p className="tp-eyebrow">THE AUTUMN SPRING TIDE</p>
            <h2>Out to sea</h2>
            <p>The biggest tide of the year came over the rim at sunset and carried everyone out: the anemones’ young, the shrimp, the hermit crab in its roomy shell, the blenny and the starfish. Dora closed the journal. Enzo waved until the last shell was gone. Next summer, the pool will fill again.</p>
            <p className="tp-final">📖 {jg?.pagesDone() ?? 24} of 24 pages · 🐚 {jg?.shellCount() ?? S.best} shells{jg ? ` · ${jg.releasedKinds} kinds released` : ''}</p>
            <div className="tp-row">
              <button className="tp-go" onClick={() => { setEnding(false); syncHold({ ending: false }); toMenu(); setScreen('free'); }}>🏖 Free pool →</button>
              <button className="tp-alt" onClick={() => { setEnding(false); syncHold({ ending: false }); toMenu(); }}>Menu</button>
            </div>
          </div>
          <div className="tp-credits" aria-label="Cast"><div>
            <p className="tp-eyebrow">STARRING</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="tp-eyebrow">THANK YOU FOR PLAYING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
