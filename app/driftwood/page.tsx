'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DriftwoodGame, ISLAND, STORY, RESIDENTS, BOTTLES, SHELLS, UPGRADES, UP_IDS, DT, MAX_SPEED, SAVE_KEY, WEATHER,
  readSave, freshSave, clockText, dayPart, idleInput,
  type Save, type Ev, type Item, type IslandId, type ResidentId, type UpId,
} from '@/lib/driftwood-game';
import type { DriftwoodScene } from '@/lib/driftwood-scene';
import { DriftwoodSound } from './sound';
import './driftwood.css';

type Screen = 'menu' | 'play';
type ChartTab = 'chart' | 'letters' | 'bottles';
type Toast = { id: number; text: string; until: number };
type Who = ResidentId | 'dora' | 'enzo';
const sceneModule = () => import('@/lib/driftwood-scene');
type SceneModule = Awaited<ReturnType<typeof sceneModule>>;
const STEER_KEYS: Record<string, number> = { a: -1, arrowleft: -1, d: 1, arrowright: 1 };
const HELD = new Set(['a', 'd', 'arrowleft', 'arrowright', 'w', 's', 'arrowup', 'arrowdown', 'e', ' ', 'x', 'shift']);
const CAST: [string, string][] = [
  ['Dora', 'at the tiller'], ['Enzo', 'at the mast, and on patching duty'], ['Granny Tuft', 'who started it all'], ['Old Pip', 'keeper of the light'],
  ['Bun', 'baker of the Lantern Cake'], ['Tamsin', 'builder of ninety boats'], ['Clover and Bramble', 'cloud-spotters, best friends'], ['Mrs Grisel', 'complainer-in-chief'],
  ['Dabble', 'teller of everybody'], ['Professor Quill', 'grinder of lenses'], ['Mossy and the Reedmere Choir', 'singing to the stars'], ['The gulls', 'shouting, as ever'],
];
const portraitArt = (who: Who) => (who === 'duo' ? 'dora' : who === 'dora' || who === 'enzo' ? who : RESIDENTS[who].art);

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className, who, island }: { src: string | null; paint: 'title' | 'ending' | 'portrait' | 'island'; w: number; h: number; className?: string; who?: Who; island?: IslandId }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { setHide(false); setGot(false); }, [src]);
  useEffect(() => {
    // the image may have loaded, or failed, before the page hydrated, when its own events were missed
    const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); }
  }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current; if (dead || !c) return;
      if (paint === 'title') m.paintTitle(c); else if (paint === 'ending') m.paintEnding(c);
      else if (paint === 'portrait') m.paintPortrait(c, who ?? 'duo'); else m.paintIsland(c, island ?? 'home');
    }).catch(() => {});
    return () => { dead = true; };
  }, [paint, who, island]);
  return (
    <span className={'dw-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {src && !hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}

/** The little icons that tell you what an item is: a letter or a parcel, and whether it's heavy, fragile or express. */
function ItemTags({ it, minute }: { it: Item; minute: number | null }) {
  return (
    <span className="dw-tags">
      {it.story > 0 && <span className="dw-tag is-story" title="A story letter">★ story</span>}
      {it.heavy && <span className="dw-tag is-heavy" title="Heavy: the boat sails a little slower">⚖ heavy</span>}
      {it.fragile && <span className={'dw-tag is-fragile' + (it.jostled ? ' is-bad' : '')} title="Fragile: bumps lose the bonus">{it.jostled ? '💔 jostled' : '🥚 fragile'}</span>}
      {it.express > 0 && <span className={'dw-tag is-express' + (minute !== null && it.due && minute > it.due ? ' is-bad' : '')} title="Express: a bonus if it arrives in time">⚡ {it.due ? `by ${clockText(it.due)}` : `${Math.round(it.express / 60 * 10) / 10} h`}</span>}
    </span>
  );
}

export default function DriftwoodPage() {
  const canvas = useRef<HTMLCanvasElement>(null), chartCv = useRef<HTMLCanvasElement>(null), scene = useRef<DriftwoodScene | null>(null), mod = useRef<SceneModule | null>(null), sound = useRef<DriftwoodSound | null>(null);
  const game = useRef<DriftwoodGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), chartRef = useRef(false), bottleRef = useRef<number | null>(null), endingRef = useRef(false);
  const keys = useRef(new Set<string>()), steerVal = useRef(0), touchSteer = useRef<number | null>(null), touchHold = useRef({ anchor: false, dock: false, trim: 0 });
  const prev = useRef<{ x: number; y: number; h: number } | null>(null), dockedAt = useRef(0), toastId = useRef(0), firstCast = useRef(false);
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [chart, setChart] = useState(false), [chartTab, setChartTab] = useState<ChartTab>('chart');
  const [bottle, setBottle] = useState<number | null>(null), [ending, setEnding] = useState(false), [toasts, setToasts] = useState<Toast[]>([]);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState(''), [touch, setTouch] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false), [openItem, setOpenItem] = useState<string | null>(null), [news, setNews] = useState<string[]>([]), [wheel, setWheel] = useState(0);
  const [, setTick] = useState(0);
  const touchRef = useRef(false); touchRef.current = touch;
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => {
    const g = game.current;
    if (g && (g.phase === 'dock' || g.phase === 'ending')) save.current.voyage = g.toVoyage();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ }
  };
  const audio = () => { sound.current ??= new DriftwoodSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const toast = (text: string) => { const id = ++toastId.current; setToasts((t) => [...t.slice(-2), { id, text, until: performance.now() + 3600 }]); };
  const setChartOpen = (on: boolean) => { chartRef.current = on; setChart(on); keys.current.clear(); if (on) setChartTab('chart'); else requestAnimationFrame(() => canvas.current?.focus()); };
  const closeBottle = () => { bottleRef.current = null; setBottle(null); canvas.current?.focus(); };

  /** Starts a voyage: a fresh one, or the saved one tied up where it was left. */
  function start(o: { fresh?: boolean; seed?: number } = {}) {
    audio().ui();
    let g: DriftwoodGame | null = null;
    if (!o.fresh && save.current.voyage) g = DriftwoodGame.fromVoyage(save.current.voyage);
    if (!g) { g = new DriftwoodGame({ seed: o.seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) }); firstCast.current = true; }
    game.current = g; pausedRef.current = false; setPaused(false); setChartOpen(false); closeBottle(); endingRef.current = false; setEnding(false);
    keys.current.clear(); touchSteer.current = null; steerVal.current = 0; prev.current = null; setConfirmNew(false); setNews([]); setToasts([]);
    dockedAt.current = performance.now();
    const first = g.at ? [...g.forHere(), ...g.waiting(g.at)].find((i) => i.story) : null; setOpenItem(first?.id ?? null);
    persist(); setScreen('play'); refresh();
  }
  function toMenu() { persist(); pausedRef.current = false; setPaused(false); setChartOpen(false); closeBottle(); game.current = null; endingRef.current = false; setEnding(false); setScreen('menu'); setConfirmNew(false); refresh(); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || endingRef.current) return;
    pausedRef.current = on; setPaused(on); keys.current.clear(); touchSteer.current = null; touchHold.current = { anchor: false, dock: false, trim: 0 };
    if (!on) canvas.current?.focus();
  }
  /** Notices what the game did: sounds, sparkles, toasts, saving and the overlays. */
  function handle(events: Ev[], g: DriftwoodGame) {
    scene.current?.feed(events, g); sound.current?.play(events);
    for (const e of events) {
      switch (e.k) {
        case 'dock': dockedAt.current = performance.now(); keys.current.clear(); touchHold.current = { anchor: false, dock: false, trim: 0 }; touchSteer.current = null; setNews([]); { const f = [...g.forHere(), ...g.waiting(e.id)].find((i) => i.story) ?? g.forHere()[0]; setOpenItem(f?.id ?? null); } persist(); refresh(); break;
        case 'ending': endingRef.current = true; setEnding(true); save.current.finished++; persist(); refresh(); break;
        case 'shell': toast('🐚 A hidden shell! +5'); refresh(); break;
        case 'bottle': bottleRef.current = e.i; setBottle(e.i); keys.current.clear(); refresh(); break;
        case 'seen': if (ISLAND[e.id].dock) toast(`👀 Land ho! ${ISLAND[e.id].name}`); break;
        case 'unlock': toast(`🗺 ${ISLAND[e.id].name} is on your chart now`); break;
        case 'weather': toast(e.w === 'squall' ? '🌧 A rain squall is blowing in!' : e.w === 'calm' ? '〰 The wind drops to a calm' : e.w === 'gusty' ? '💨 Gusty now: watch for gusts' : '🌬 A steady breeze'); break;
        case 'scuff': toast(`💥 Bump! Scuffs ${e.n}/3${e.jostled.length ? ` · ${e.jostled.join(', ')} jostled` : ''}`); break;
        case 'patch': toast('🔨 Enzo stops to patch the hull…'); refresh(); break;
        case 'patched': toast('✨ All patched up. Off we go!'); refresh(); break;
        case 'late': toast(`⏰ ${e.item.title} is running late`); break;
        case 'pickup': case 'deliver': case 'buy': refresh(); break;
        default: break;
      }
    }
  }
  /** Runs a jetty action (deliver, pick up, buy, cast off) and plays what it set off. */
  function act(fn: (g: DriftwoodGame) => unknown) {
    const g = game.current; if (!g) return;
    const r = fn(g); audio(); if (r === false || r === -1) { sound.current?.ui(); return; }
    const ev = g.events.splice(0);
    const lines: string[] = [];
    for (const e of ev) {
      if (e.k === 'deliver') lines.push(`${e.item.parcel ? '📦' : '✉️'} “${e.item.title}” for ${RESIDENTS[e.item.recipient].name}: 🐚 +${e.pay}${e.onTime ? ' (on time!)' : e.onTime === false ? ' (late, no bonus)' : ''}${e.intact ? ' (not a scratch!)' : e.intact === false ? ' (a bit jostled)' : ''}`);
      if (e.k === 'regatta') lines.push('🏮 Pip’s invitation! Dusk is falling: sail to Lighthouse Rock for the Lantern Regatta.');
      if (e.k === 'buy') lines.push(`${UPGRADES[e.up].icon} ${UPGRADES[e.up].name} fitted!`);
    }
    if (lines.length) setNews((n) => [...n, ...lines].slice(-6));
    handle(ev, g);
    if (g.phase === 'dock' || g.phase === 'ending') persist();
    refresh();
  }
  function castOff() {
    const g = game.current; if (!g || g.phase !== 'dock') return;
    act((x) => x.castOff()); prev.current = null;
    if (firstCast.current) { firstCast.current = false; toast(touchRef.current ? 'Steer with the wheel. Sail across the wind, not into it!' : 'Steer with A/D or ←/→. Sail across the wind, not into it!'); }
    requestAnimationFrame(() => canvas.current?.focus());
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setTouch(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    setMounted(true); refresh();
    const w = window as unknown as { __driftwood: () => DriftwoodGame | null; __driftwoodStart: (o?: { seed?: number; fresh?: boolean }) => void; __driftwoodDock: (id: IslandId) => boolean };
    w.__driftwood = () => game.current;
    w.__driftwoodStart = (o) => start({ fresh: true, ...(o ?? {}) });
    w.__driftwoodDock = (id) => {
      const g = game.current; if (!g || g.phase === 'ending') return false;
      if (g.phase === 'dock') g.castOff();
      g.phase = 'sail'; const ok = g.dockAt(id); handle(g.events.splice(0), g); refresh(); return ok;
    };
    let dead = false, raf = 0, last = 0, acc = 0, ui = 0;
    const inp = idleInput();
    const resize = () => scene.current?.resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      mod.current = m;
      try { scene.current = new m.DriftwoodScene(canvas.current); } catch { setError('This browser cannot draw the lake.'); return; }
      ro?.observe(canvas.current); window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, playing = screenRef.current === 'play' && !!g;
        const frozen = !playing || pausedRef.current || chartRef.current || bottleRef.current !== null || endingRef.current;
        // keyboard steering eases in and out, so a tap is a nudge and a hold is a full turn
        const want = Math.max(-1, Math.min(1, [...keys.current].reduce((s, k) => s + (STEER_KEYS[k] ?? 0), 0)));
        steerVal.current += (want - steerVal.current) * Math.min(1, dt * (want === 0 ? 14 : 7));
        let alpha = 1;
        if (playing && !frozen && (g.phase === 'sail' || g.phase === 'patch')) {
          // fixed 30 Hz steps; a long frame runs at most 5 of them and drops the rest, so it never spirals
          acc += dt; let n = 0;
          while (acc >= DT && n < 5) {
            acc -= DT; n++;
            const h = keys.current, manual = save.current.settings.manualTrim, th = touchHold.current;
            prev.current = { x: g.boat.x, y: g.boat.y, h: g.boat.h };
            inp.steer = touchSteer.current ?? steerVal.current;
            inp.trim = manual ? Math.max(-1, Math.min(1, (h.has('w') || h.has('arrowup') ? -1 : 0) + (h.has('s') || h.has('arrowdown') ? 1 : 0) + th.trim)) : null;
            inp.anchor = h.has('x') || h.has('shift') || th.anchor;
            inp.dock = h.has('e') || h.has(' ') || th.dock;
            g.step(inp);
            const ev = g.events.splice(0); if (ev.length) handle(ev, g);
            if (g.phase !== 'sail' && g.phase !== 'patch') { acc = 0; break; }
          }
          if (n >= 5) acc = 0;
          alpha = Math.max(0, Math.min(1, acc / DT));
        } else {
          acc = 0;
          if (g && g.events.length) handle(g.events.splice(0), g);
        }
        sc.draw(playing ? g : null, { dt, paused: playing && frozen, manual: save.current.settings.manualTrim, touch: touchRef.current, alpha, prev: prev.current });
        if (chartRef.current && g && chartCv.current) m.drawChart(chartCv.current, g, sc.img('chart'), ms / 1000);
        sound.current?.tick(playing && !frozen && g.phase !== 'dock', g ? g.speed / MAX_SPEED : 0, g ? g.windStr : 0, !!g && g.rain, g ? dayPart(g.minute) : 'day');
        if (ms - ui > 250) {
          ui = ms;
          setToasts((t) => (t.length && t[0].until < performance.now() ? t.filter((x) => x.until > performance.now()) : t));
          if (playing && !frozen) refresh();
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The lake could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current, tgt = e.target as HTMLElement;
      if (tgt.tagName === 'INPUT') return;
      if (screenRef.current !== 'play' || !g) return;
      const onControl = !!tgt.closest?.('button, a');
      if (bottleRef.current !== null) { if (!e.repeat && (k === 'escape' || k === 'enter' || k === ' ')) { e.preventDefault(); closeBottle(); } return; }
      if (endingRef.current) return;
      if (chartRef.current) { if (!e.repeat && (k === 'escape' || k === 'm')) { e.preventDefault(); setChartOpen(false); } return; }
      if (k === 'escape' || k === 'p') { if (!e.repeat) { e.preventDefault(); pause(!pausedRef.current); } return; }
      if (pausedRef.current) return;
      if (k === 'm' && !e.repeat) { e.preventDefault(); setChartOpen(true); audio().rustle(); return; }
      if (g.phase === 'dock') {
        // Space or Enter casts off, but not from the key that was held to tie up, nor while a button has focus
        if ((k === ' ' || k === 'enter') && !onControl && !e.repeat && performance.now() - dockedAt.current > 450) { e.preventDefault(); castOff(); }
        return;
      }
      if (HELD.has(k)) { keys.current.add(k); if (k.startsWith('arrow') || k === ' ') e.preventDefault(); audio(); }
    };
    const keyup = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); if (e.key === 'Shift') keys.current.delete('shift'); };
    const blur = () => { keys.current.clear(); touchSteer.current = null; touchHold.current = { anchor: false, dock: false, trim: 0 }; const g = game.current; if (g && g.phase !== 'dock') pause(true); };
    const hide = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch: the wheel on the left steers by how far the finger slides from its middle
  const wheelAt = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.38))); };
  const wheelDown = (e: React.PointerEvent) => { e.preventDefault(); audio(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); const v = wheelAt(e); touchSteer.current = v; setWheel(v); };
  const wheelMove = (e: React.PointerEvent) => { if (touchSteer.current === null) return; const v = wheelAt(e); touchSteer.current = v; setWheel(v); };
  const wheelUp = () => { touchSteer.current = null; setWheel(0); };
  const hold = (key: 'anchor' | 'dock' | 'trimIn' | 'trimOut', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); if (on) audio();
    const h = touchHold.current;
    if (key === 'anchor') h.anchor = on; else if (key === 'dock') h.dock = on; else h.trim = on ? (key === 'trimIn' ? -1 : 1) : 0;
    if (on) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const toggle = (k: 'sound' | 'music' | 'manualTrim') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); if (k === 'music') a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="dw-chips">
      <button className="dw-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="dw-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🪗 Music' : '🪗 Off'}</button>
      <button className="dw-chip" aria-pressed={S.settings.manualTrim} onClick={() => toggle('manualTrim')} title="Trim the sail yourself with W and S for a little extra speed">{S.settings.manualTrim ? '⛵ Manual trim' : '⛵ Auto trim'}</button>
    </span>
  );

  const g = game.current, phase = g?.phase ?? 'none', at = g?.at ?? null;
  const voyage = mounted ? S.voyage : null;
  const goal = g?.goal() ?? null;
  const nearDock = g && phase === 'sail' ? g.nearDock() : null;
  const letterRow = (it: Item, action: React.ReactNode) => {
    const open = openItem === it.id;
    return (
      <li key={it.id} className={'dw-item' + (open ? ' is-open' : '') + (it.story ? ' is-story' : '')}>
        <button className="dw-item-head" aria-expanded={open} onClick={() => { setOpenItem(open ? null : it.id); audio().rustle(); }}>
          <span className="dw-item-icon">{it.parcel ? '📦' : '✉️'}</span>
          <span className="dw-item-text"><strong>{it.title}</strong><small>{RESIDENTS[it.sender].name} → {RESIDENTS[it.recipient].name}, {ISLAND[it.to].name}</small><ItemTags it={it} minute={g?.minute ?? null} /></span>
        </button>
        {action}
        {open && <p className="dw-letter">{it.text}</p>}
      </li>
    );
  };

  return (
    <main className="dw-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={phase}>
      {screen === 'play' && (
        <header className="dw-bar">
          <a href="/" className="dw-back">← ARCADE</a>
          <span className="dw-bar-mid">{g ? (g.regatta === 1 ? '🏮 To Lighthouse Rock for the Lantern Regatta!' : goal ? `${goal.why === 'deliver' ? 'Deliver to' : 'Post waiting at'} ${ISLAND[goal.id].name}` : 'Free sailing: side post and shells') : ''}</span>
          <span className="dw-chips">
            <button className="dw-chip" onClick={() => { setChartOpen(!chart); audio().rustle(); }} aria-label="Chart" disabled={ending}>🗺 Chart</button>
            <button className="dw-chip" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={ending}>❚❚</button>
            <button className="dw-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')} aria-label="Sound">{S.settings.sound ? '🔊' : '🔇'}</button>
          </span>
        </header>
      )}
      <div className="dw-stage">
        <canvas ref={canvas} className="dw-canvas" tabIndex={0} aria-label="Lake Whisker. A and D or the arrow keys steer, W and S trim the sail when manual trim is on, E or Space ties up at a jetty, X or Shift drops the anchor, M opens the chart and Esc pauses." />
        {screen === 'play' && g && (phase === 'sail' || phase === 'patch') && !paused && !chart && (<>
          <div className="dw-bag" aria-label="Your bag">
            <span className="dw-shells" title="Shells">🐚 {g.shells}</span>
            {Array.from({ length: g.capacity }, (_, i) => {
              const it = g.bag[i];
              return <span key={i} className={'dw-slot' + (it ? ' is-full' : '') + (it?.express ? ' is-express' : '') + (it && goal?.id === it.to ? ' is-next' : '')} title={it ? `${it.title} → ${ISLAND[it.to].name}` : 'Empty'}>{it ? (it.parcel ? '📦' : '✉️') : ''}{it?.express ? <i>⚡</i> : null}{it?.fragile ? <b>{it.jostled ? '💔' : '🥚'}</b> : null}</span>;
            })}
          </div>
          {phase === 'patch' && <div className="dw-patch" role="status">🔨 Enzo is patching the hull…</div>}
          {touch && (
            <div className="dw-touch">
              <div className="dw-wheel" onPointerDown={wheelDown} onPointerMove={wheelMove} onPointerUp={wheelUp} onPointerCancel={wheelUp} aria-label="Steering wheel">
                <span style={{ transform: `rotate(${wheel * 100}deg)` }}>☸</span><small>◀ steer ▶</small>
              </div>
              <div className="dw-tbtns">
                {S.settings.manualTrim && (<>
                  <button className="dw-tbtn" onPointerDown={hold('trimIn', true)} onPointerUp={hold('trimIn', false)} onPointerCancel={hold('trimIn', false)}>⤒<small>Haul</small></button>
                  <button className="dw-tbtn" onPointerDown={hold('trimOut', true)} onPointerUp={hold('trimOut', false)} onPointerCancel={hold('trimOut', false)}>⤓<small>Ease</small></button>
                </>)}
                <button className="dw-tbtn" onPointerDown={hold('anchor', true)} onPointerUp={hold('anchor', false)} onPointerCancel={hold('anchor', false)}>🪝<small>Brake</small></button>
                <button className={'dw-tbtn dw-dockbtn' + (nearDock ? ' is-near' : '')} onPointerDown={hold('dock', true)} onPointerUp={hold('dock', false)} onPointerCancel={hold('dock', false)}>⚓<small>Dock</small></button>
              </div>
            </div>
          )}
        </>)}
        <div className="dw-toasts" aria-live="polite">{toasts.map((t) => <p key={t.id} className="dw-toast">{t.text}</p>)}</div>
      </div>
      {error && <div className="dw-panel dw-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="dw-menu" aria-label="Driftwood Post">
          <header className="dw-head"><a href="/" className="dw-back">← ARCADE</a>{settings}</header>
          <div className="dw-hero">
            <Art src="/art/driftwood/title.webp" paint="title" w={1200} h={800} className="dw-hero-art" />
            <div><p className="dw-eyebrow">A COSY SAILING ADVENTURE ON LAKE WHISKER</p><h1>Driftwood <em>Post</em></h1>
              <p className="dw-lede">The post boat has sprung a leak, and the islands have gone quiet. Dora and Enzo patch up an old driftwood dinghy and take over the round: sail by the wind, carry the letters, and get every island talking again.</p></div>
          </div>
          <div className="dw-go-row">
            {voyage ? (<>
              <button className="dw-go" disabled={!ready} onClick={() => start()}>{ready ? `CONTINUE THE VOYAGE →` : 'Rigging the sail…'}<small>Day {Math.floor(voyage.minute / 1440) + 1} · {voyage.done.length} of {STORY.length} story letters · 🐚 {voyage.shells} · at {ISLAND[voyage.at].name}</small></button>
              {!confirmNew ? <button className="dw-alt" disabled={!ready} onClick={() => { audio().ui(); setConfirmNew(true); }}>New voyage</button>
                : <button className="dw-alt is-warn" onClick={() => start({ fresh: true })}>Start over? Your voyage will be replaced. Tap again to begin.</button>}
            </>) : <button className="dw-go" disabled={!ready} onClick={() => start({ fresh: true })}>{ready ? 'SET SAIL →' : 'Rigging the sail…'}</button>}
          </div>
          <ol className="dw-how" aria-label="How to sail">
            <li><b>⛵ The wind drives you.</b> Fastest across the wind, slower running before it. You can’t sail straight into it: the red wedge on the compass is the no-go zone.</li>
            <li><b>↔ Tack upwind.</b> To go where the wind comes from, zig-zag at an angle, turning through the wind each time. Keep your speed up through the turn.</li>
            <li><b>⚓ Tie up gently.</b> Slow down by a jetty and press <kbd>E</kbd> or <kbd>Space</kbd> (or ⚓). Hand over the post, pick up more, read the letters.</li>
            <li><b>🗺 Chart the lake.</b> <kbd>M</kbd> opens your chart. Currents carry you, reeds slow you, rocks scuff you. Shells hide in coves: spend them at Tamsin’s boatyard.</li>
          </ol>
          <p className="dw-keys"><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> steer · <kbd>W</kbd><kbd>S</kbd> trim (manual) · <kbd>E</kbd>/<kbd>Space</kbd> dock · <kbd>X</kbd>/<kbd>Shift</kbd> brake · <kbd>M</kbd> chart · <kbd>Esc</kbd> pause</p>
          {mounted && S.finished > 0 && <p className="dw-note">🏮 You’ve sailed in the Lantern Regatta {S.finished === 1 ? 'once' : `${S.finished} times`}. The lake thanks you.</p>}
        </section>
      )}

      {screen === 'play' && g && (<>
        {phase === 'dock' && at && !paused && !chart && (() => {
          const isl = ISLAND[at], res = isl.resident ?? 'duo', here = g.forHere(), waiting = g.waiting(at), full = g.bag.length >= g.capacity;
          return (
            <div className="dw-dock" role="dialog" aria-label={isl.name}>
              <div className="dw-card">
                <div className="dw-card-top">
                  <Art src={`/art/driftwood/${isl.art}.webp`} paint="island" island={at} w={480} h={320} className="dw-card-art" />
                  <div className="dw-card-who">
                    <Art src={portraitArt(res) ? `/art/driftwood/${portraitArt(res)}.webp` : null} paint="portrait" who={res} w={192} h={192} className="dw-face" />
                    <div><p className="dw-eyebrow">{at === 'home' ? 'HOME · THE POST OFFICE' : `${RESIDENTS[res].name.toUpperCase()} · ${RESIDENTS[res].role.toUpperCase()}`}</p><h2>{isl.name}</h2><p className="dw-blurb">{isl.blurb}</p></div>
                  </div>
                </div>
                {news.length > 0 && <ul className="dw-news">{news.map((n, i) => <li key={i}>{n}</li>)}</ul>}
                {here.length > 0 && (
                  <section className="dw-sec">
                    <h3>For {at === 'home' ? 'Whisker Cove' : RESIDENTS[res].name} <button className="dw-small" onClick={() => act((x) => x.deliverAll())}>Hand over all</button></h3>
                    <ul className="dw-items">{here.map((it) => letterRow(it, <button className="dw-do" onClick={() => act((x) => x.deliver(it.id))}>Hand over</button>))}</ul>
                  </section>
                )}
                <section className="dw-sec">
                  <h3>Post to take {waiting.length > 1 && <button className="dw-small" disabled={full} onClick={() => act((x) => x.pickUpAll())}>Take all</button>}<span className="dw-cap">bag {g.bag.length}/{g.capacity}</span></h3>
                  {waiting.length === 0 ? <p className="dw-note">{g.storyDone === 0 && at !== 'home' ? 'The post office here hasn’t heard from anyone in years. Maybe someone will write soon.' : 'Nothing waiting here just now.'}</p>
                    : <ul className="dw-items">{waiting.map((it) => letterRow(it, <button className="dw-do" disabled={full} onClick={() => act((x) => x.pickUp(it.id))}>{full ? 'Bag full' : 'Pick up'}</button>))}</ul>}
                </section>
                {g.bag.filter((i) => i.to !== at).length > 0 && (
                  <section className="dw-sec dw-carry">
                    <h3>In your bag</h3>
                    <ul className="dw-carrying">{g.bag.filter((i) => i.to !== at).map((it) => <li key={it.id}>{it.parcel ? '📦' : '✉️'} {it.title} <small>→ {ISLAND[it.to].name}</small> <ItemTags it={it} minute={g.minute} /></li>)}</ul>
                  </section>
                )}
                {at === 'boatyard' && (
                  <section className="dw-sec">
                    <h3>Tamsin’s boatyard <span className="dw-cap">🐚 {g.shells}</span></h3>
                    {!g.shopOpen ? <p className="dw-note">The boatyard is shut. A note on the door says “Back when somebody writes to me. — T.”</p> : (
                      <div className="dw-shop">
                        {UP_IDS.map((id: UpId) => {
                          const u = UPGRADES[id], why = g.canBuy(id), lvl = g.ups[id];
                          return (
                            <button key={id} className={'dw-up' + (why === 'max' ? ' is-max' : '')} disabled={why !== 'ok'} onClick={() => act((x) => x.buy(id))}>
                              <span className="dw-up-icon">{u.icon}</span><strong>{u.name}</strong><small>{u.prices.length > 1 ? `level ${lvl}/${u.prices.length}` : lvl ? 'fitted' : 'not fitted'}</small>
                              <span className="dw-up-text">{u.text}</span><span className="dw-price">{why === 'max' ? 'Done' : `🐚 ${g.price(id)}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
                <div className="dw-row">
                  <button className="dw-go" onClick={castOff}>Cast off ⛵ {g.regatta === 1 ? '(to the Regatta!)' : goal && goal.id !== at ? `· next: ${ISLAND[goal.id].name}` : ''}</button>
                  <button className="dw-alt" onClick={() => { setChartOpen(true); audio().rustle(); }}>🗺 Chart</button>
                </div>
                <p className="dw-foot">Day {g.day} · {clockText(g.minute)} · {WEATHER[g.weather].name} · 🐚 {g.shells}{!touch ? ' · Space casts off' : ''}</p>
              </div>
            </div>
          );
        })()}

        {chart && (
          <div className="dw-chart" role="dialog" aria-label="Chart">
            <div className="dw-chart-bar">
              <div className="dw-tabs" role="tablist">
                {(['chart', 'letters', 'bottles'] as ChartTab[]).map((tb) => <button key={tb} role="tab" aria-selected={chartTab === tb} className={chartTab === tb ? 'is-on' : ''} onClick={() => setChartTab(tb)}>{tb === 'chart' ? '🗺 Chart' : tb === 'letters' ? `✉️ Letters ${g.done.size}/${STORY.length}` : `🍾 Bottles ${g.bottlesFound}/${BOTTLES.length}`}</button>)}
              </div>
              <span className="dw-chart-stats">🐚 shells found {g.shellsFound}/{SHELLS.length} · charted {Math.round(g.chartShare * 100)}%</span>
              <button className="dw-chip" onClick={() => setChartOpen(false)}>Close ✕</button>
            </div>
            <canvas ref={chartCv} className="dw-chart-cv" style={chartTab === 'chart' ? undefined : { display: 'none' }} aria-label="The chart of Lake Whisker" />
            {chartTab === 'letters' && (
              <div className="dw-book">
                {g.done.size === 0 ? <p className="dw-note">Delivered story letters are kept here to read again.</p> : STORY.filter((d) => g.done.has(d.n)).map((d) => (
                  <article key={d.n} className="dw-page"><p className="dw-eyebrow">{d.n} · {RESIDENTS[d.sender].name.toUpperCase()} → {RESIDENTS[d.recipient].name.toUpperCase()}</p><h3>{d.title}</h3><p className="dw-letter">{d.text}</p></article>
                ))}
              </div>
            )}
            {chartTab === 'bottles' && (
              <div className="dw-book">
                {g.bottlesFound === 0 ? <p className="dw-note">Message bottles bob about the lake. Sail over one to fish it out.</p> : BOTTLES.map((b, i) => g.bottles[i] ? <article key={i} className="dw-page"><h3>🍾 {b.title}</h3><p className="dw-letter">{b.text}</p></article> : null)}
              </div>
            )}
          </div>
        )}

        {bottle !== null && (
          <div className="dw-panel dw-bottle" role="dialog" aria-label="A message in a bottle">
            <p className="dw-eyebrow">A MESSAGE IN A BOTTLE · 🐚 +3</p>
            <h2>{BOTTLES[bottle].title}</h2>
            <p className="dw-letter">{BOTTLES[bottle].text}</p>
            <button className="dw-go" onClick={closeBottle}>Tuck it in the bag and sail on</button>
          </div>
        )}

        {ending && (
          <div className="dw-ending" role="dialog" aria-label="The Lantern Regatta">
            <Art src="/art/driftwood/ending.webp" paint="ending" w={1200} h={800} className="dw-ending-art" />
            <div className="dw-ending-text">
              <h2>The Lantern Regatta</h2>
              <p>As the sun goes down, every island lights a lantern and sails out to Lighthouse Rock. Pip’s great lens throws its light to the far shore and back. Mossy’s choir sings to the stars, Mrs Grisel complains about the cake (and has three slices), and Clover and Bramble share a boat and a teapot. Every island is back in touch.</p>
              <p className="dw-final">Day {g.day} · {g.stats.delivered} {g.stats.delivered === 1 ? 'delivery' : 'deliveries'} · 🐚 {g.stats.earned} earned · {g.shellsFound}/{SHELLS.length} hidden shells · {g.stats.bumps} {g.stats.bumps === 1 ? 'bump' : 'bumps'}</p>
              <div className="dw-row">
                <button className="dw-go" onClick={() => { endingRef.current = false; setEnding(false); act((x) => x.sailOn()); }}>Sail on: the lake keeps writing →</button>
                <button className="dw-alt" onClick={toMenu}>Menu</button>
              </div>
            </div>
            <div className="dw-credits" aria-label="Cast"><div>
              <p className="dw-eyebrow">WITH LOVE FROM LAKE WHISKER</p>
              {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
              <p className="dw-eyebrow">THANK YOU FOR SAILING</p>
            </div></div>
          </div>
        )}

        {paused && (
          <div className="dw-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>The boat bobs gently, waiting for you.</p>
            {settings}
            <p className="dw-note">Your voyage saves every time you tie up at a jetty.</p>
            <div className="dw-row"><button className="dw-go" onClick={() => pause(false)}>Keep sailing</button><button className="dw-alt" onClick={toMenu}>Back to the menu</button></div>
          </div>
        )}
      </>)}
    </main>
  );
}
