'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SnowGame, VALLEYS, VALLEY_IDS, UPGRADES, UPGRADE_IDS, MAX_LEVEL, DT, TPS, SAVE_KEY, readSave, freshSave, recordRun, recordDaily, buy,
  dayOpen, dayDone, endlessOpen, medalCount, dailySeed, fmtTime, type Save, type Ev, type ValleyId, type Mode,
} from '@/lib/snowdrift-game';
import type { SnowScene } from '@/lib/snowdrift-scene';
import { SnowSound, type SongId } from './sound';
import './snowdrift.css';

type Screen = 'menu' | 'days' | 'shop' | 'play';
type Result = { kind: 'finish' | 'caught'; fresh: { first: boolean; cocoa: boolean; dusk: boolean; best: boolean }; daily: boolean };
const sceneModule = () => import('@/lib/snowdrift-scene');
/** Keys that work the button (and that we keep from scrolling the page). */
const HOLD_KEYS = new Set([' ', 'arrowdown', 'arrowup', 's', 'w', 'enter']);
const CAST: [string, string][] = [['Dora', 'in front, holding the curl'], ['Enzo', 'behind, scarf streaming'], ['The sled', 'small, wooden, very fast'], ['The sunset', 'always one hill behind'], ['The cocoa', 'worth every hill']];
const MEDALS = ['Reach the lodge', 'Every cocoa', 'Daylight to spare'];

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className, valley }: { src: string; paint: 'title' | 'ending' | 'lodge' | 'valley'; w: number; h: number; className?: string; valley?: ValleyId }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current; if (dead || !c) return;
      if (paint === 'title') m.paintTitle(c); else if (paint === 'ending') m.paintEnding(c); else if (paint === 'lodge') m.paintLodge(c); else m.paintValley(c, valley ?? 'meadow');
    }).catch(() => {});
    return () => { dead = true; };
  }, [paint, valley]);
  return (
    <span className={'sd-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
const Medals = ({ on, labels = false }: { on: boolean[]; labels?: boolean }) => (
  <span className={'sd-medals' + (labels ? ' has-labels' : '')} aria-label={`${on.filter(Boolean).length} of 3 medals`}>
    {on.map((m, i) => <i key={i} className={(m ? 'is-on ' : '') + 'm' + i} title={MEDALS[i]}>{['🏠', '☕', '☀'][i]}{labels && <small>{MEDALS[i]}</small>}</i>)}
  </span>
);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function SnowdriftPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), scene = useRef<SnowScene | null>(null), sound = useRef<SnowSound | null>(null);
  const game = useRef<SnowGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), panelRef = useRef(false), endingRef = useRef(false), resumeRef = useRef(false);
  const keys = useRef(new Set<string>()), pointers = useRef(new Set<number>()), pads = useRef<boolean[]>([]), endAt = useRef(0), dateRef = useRef('');
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [result, setResult] = useState<Result | null>(null), [shopFrom, setShopFrom] = useState<'menu' | 'day'>('menu');
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new SnowSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const releaseAll = () => { keys.current.clear(); pointers.current.clear(); };
  const songFor = (g: SnowGame): SongId => (g.mode.kind === 'endless' ? 'endless' : g.mode.valley);

  /** Opens a day (or the endless hills), waiting at the top for the first press. */
  function start(mode: Mode) {
    if (mode.kind === 'day' && !dayOpen(save.current, VALLEY_IDS.indexOf(mode.valley))) return;
    audio().ui();
    const g = new SnowGame(mode, save.current.levels);
    game.current = g;
    if (mode.kind === 'day') { save.current.last = VALLEY_IDS.indexOf(mode.valley); persist(); }
    pausedRef.current = false; setPaused(false); endingRef.current = false; setEnding(false); setResult(null); panelRef.current = false; endAt.current = 0;
    releaseAll();
    scene.current?.want(mode.kind === 'day' ? mode.valley : 'meadow');
    sound.current?.music(songFor(g));
    setScreen('play'); refresh();
    requestAnimationFrame(() => canvas.current?.focus());
  }
  const startDay = (i: number) => start({ kind: 'day', valley: VALLEY_IDS[i] });
  const startEndless = (daily: boolean) => {
    const seed = daily ? dailySeed(dateRef.current || today()) : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
    start({ kind: 'endless', seed, daily });
  };
  function toMenu(to: Screen = 'menu') {
    persist(); pausedRef.current = false; setPaused(false); game.current = null; endingRef.current = false; setEnding(false); setResult(null); panelRef.current = false;
    setScreen(to); sound.current?.music(to === 'shop' ? 'lodge' : null); sound.current?.ride({ on: false, air: false, speed: 0, ice: false }); refresh();
  }
  function openShop(from: 'menu' | 'day') { setShopFrom(from); toMenu('shop'); audio().music('lodge'); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || endingRef.current || panelRef.current) return;
    if (on === pausedRef.current) return;
    pausedRef.current = on; setPaused(on); releaseAll();
    if (on) sound.current?.suspend(); else { resumeRef.current = true; sound.current?.resume(); canvas.current?.focus(); }
  }
  /** Notices what the game did: sounds and juice. */
  function handle(events: Ev[], g: SnowGame) {
    scene.current?.feed(events, g); sound.current?.play(events);
    for (const e of events) if (e.k === 'finish' || e.k === 'caught') endAt.current = performance.now() + (e.k === 'finish' ? 1800 : 1300);
  }
  /** After a moment at the lodge (or in the dark): the medals, the save, and after the summit the ending. */
  function finish(g: SnowGame) {
    const s = save.current, fresh = recordRun(s, g);
    let daily = false;
    if (g.mode.kind === 'endless' && g.mode.daily) daily = recordDaily(s, dateRef.current || today(), g.distance);
    const firstEnd = g.mode.kind === 'day' && g.mode.valley === 'summit' && g.phase === 'finish' && !s.ended;
    if (g.mode.kind === 'day' && g.phase === 'finish') { const i = VALLEY_IDS.indexOf(g.mode.valley); if (i + 1 < VALLEY_IDS.length) s.last = i + 1; }
    if (firstEnd) s.ended = true;
    persist();
    panelRef.current = true; releaseAll();
    if (firstEnd) { endingRef.current = true; setEnding(true); sound.current?.music('ending'); }
    else setResult({ kind: g.phase === 'finish' ? 'finish' : 'caught', fresh, daily });
    refresh();
  }

  /** The one button: any held key, a finger or mouse button on the snow, or a gamepad's A. */
  function held(): boolean {
    let on = keys.current.size > 0 || pointers.current.size > 0;
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter((x): x is Gamepad => !!x) : [];
    list.forEach((gp, n) => {
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      if (b(0) || b(1) || b(7)) on = true;
      const was = pads.current[n] ?? false;
      if (b(9) && !was) pause(!pausedRef.current);
      pads.current[n] = b(9);
    });
    return on;
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    dateRef.current = today();
    setTouch(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    setMounted(true); refresh();
    const w = window as unknown as { __snowdrift: () => SnowGame | null; __snowdriftStart: (d?: number | 'endless' | 'daily') => void; __snowdriftSled: () => ReturnType<SnowScene['sledRect']> | null };
    w.__snowdrift = () => game.current;
    w.__snowdriftStart = (d = 0) => (d === 'endless' ? startEndless(false) : d === 'daily' ? startEndless(true) : startDay(d));
    w.__snowdriftSled = () => scene.current?.sledRect() ?? null;
    let dead = false, raf = 0, last = 0, acc = 0, ui = 0;
    const layout = () => {
      const el = stage.current; if (!el) return;
      const r = el.getBoundingClientRect(), o = r.width >= r.height ? 'wide' : 'tall';
      setOrient(o);
      scene.current?.resize();
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.SnowScene(canvas.current); } catch { setError('This browser cannot draw the snow.'); return; }
      scene.current.setShake(save.current.settings.shake);
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = (ms: number) => {
        // a long gap (a hidden tab, a stall, a pause) never turns into a jump
        if (resumeRef.current) { resumeRef.current = false; last = ms; }
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, playing = screenRef.current === 'play' && !!g;
        const frozen = !playing || pausedRef.current || endingRef.current;
        if (playing && !frozen) {
          acc += dt; let n = 0;
          while (acc >= DT && n < 6) {
            acc -= DT; n++;
            g.step(panelRef.current ? false : held());
            const ev = g.events.splice(0); if (ev.length) handle(ev, g);
            if (pausedRef.current || endingRef.current) { acc = 0; break; }
          }
          if (n >= 6) acc = 0;
          if (g.done && !endAt.current) endAt.current = performance.now() + 1500;
          if (g.done && performance.now() >= endAt.current && !panelRef.current) finish(g);
        } else {
          acc = 0;
          if (playing && !pausedRef.current) held();
        }
        sc.draw(playing ? g : null, { dt: frozen ? 0 : dt, paused: playing && (pausedRef.current || endingRef.current) });
        sound.current?.ride({ on: playing && !frozen && !!g && g.phase === 'ride', air: !!g?.air, speed: g?.speed ?? 0, ice: !!g?.onIce });
        sound.current?.tick(!pausedRef.current && (playing || screenRef.current === 'shop'));
        if (ms - ui > 120) { ui = ms; if (playing && !frozen) refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The snow could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current, tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !g || endingRef.current) return;
      if (k === 'escape' || k === 'p') { if (!e.repeat) { e.preventDefault(); pause(!pausedRef.current); } return; }
      if (pausedRef.current || panelRef.current) return;
      if (HOLD_KEYS.has(k)) {
        if ((k === ' ' || k === 'enter') && tgt.closest?.('button, a')) return;
        e.preventDefault();
        if (!e.repeat) keys.current.add(k);
        audio();
      }
    };
    const keyup = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const up = (e: PointerEvent) => { pointers.current.delete(e.pointerId); };
    const blur = () => { releaseAll(); pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect();
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enter or R on the end-of-day panel
  useEffect(() => {
    if (!result) return;
    const k = (e: KeyboardEvent) => {
      const g = game.current; if (!g || e.repeat || (e.target as HTMLElement).closest?.('button, a')) return;
      const key = e.key.toLowerCase();
      if (key === 'r' || (key === 'enter' && result.kind === 'caught')) { e.preventDefault(); start(g.mode.kind === 'endless' ? { ...g.mode, seed: g.mode.daily ? g.mode.seed : (g.mode.seed * 1103515245 + 12345) >>> 0 } : g.mode); }
      else if (key === 'enter' && result.kind === 'finish' && g.mode.kind === 'day') { e.preventDefault(); const i = VALLEY_IDS.indexOf(g.mode.valley); if (i + 1 < VALLEY_IDS.length) startDay(i + 1); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  /** Touch or click anywhere on the snow is the button. */
  const down = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || panelRef.current) return;
    if ((e.target as HTMLElement).closest?.('button, a')) return;
    e.preventDefault(); audio();
    pointers.current.add(e.pointerId);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
  };

  const toggle = (k: 'sound' | 'music' | 'shake') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); if (k === 'music') a.setMusic(S.settings.music);
    if (k === 'shake') scene.current?.setShake(S.settings.shake);
    a.ui(); refresh();
  };
  const settings = (
    <span className="sd-chips">
      <button className="sd-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="sd-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
      <button className="sd-chip" aria-pressed={S.settings.shake} onClick={() => toggle('shake')}>{S.settings.shake ? '📳 Shake' : '📳 Still'}</button>
    </span>
  );
  const purchase = (id: (typeof UPGRADE_IDS)[number]) => { if (buy(save.current, id)) { persist(); audio().buy(); } else audio().ui(); refresh(); };

  const g = game.current, phase = g?.phase ?? 'none', V = g?.valley ?? null, endless = g?.mode.kind === 'endless';
  const dayIndex = V ? VALLEY_IDS.indexOf(V.id) : -1;
  const keysLine = <><kbd>Space</kbd> (or <kbd>↓</kbd>, a click, a tap anywhere, gamepad Ⓐ) is the one button · hold to tuck, let go to fly · hold in the air to flip · <kbd>Esc</kbd> pause</>;
  const nextOpen = mounted ? VALLEY_IDS.findIndex((_, i) => dayOpen(S, i) && !dayDone(S, i)) : 0;
  const resumeAt = mounted ? (dayOpen(S, S.last) ? S.last : Math.max(0, nextOpen)) : 0;
  const anyDone = mounted && Object.keys(S.days).length > 0;
  const daylight = g ? g.daylight : 0;
  const lowLight = !!g && phase === 'ride' && daylight < 5;

  return (
    <main className="sd-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={phase} data-touch={touch ? orient : undefined}>
      {screen === 'play' && g && (
        <header className="sd-bar">
          <a href="/" className="sd-back">← ARCADE</a>
          <span className="sd-bar-mid">
            {V ? <b className="sd-day"><small>{dayIndex + 1}</small><span>{V.name}</span></b> : <b className="sd-day"><small>☾</small><span>{g.mode.kind === 'endless' && g.mode.daily ? 'Daily Hill' : 'Moonlit Hills'}</span></b>}
            {V ? (
              <span className="sd-track" title="The way to the lodge" aria-label={`${Math.round(g.progress * 100)}% of the way to the lodge`}>
                <i className="sd-track-dusk" style={{ width: `${Math.max(0, Math.min(100, (g.duskX / g.lodge) * 100))}%` }} />
                <i className="sd-track-sled" style={{ left: `${g.progress * 100}%` }} />
                <i className="sd-track-flag">⛳</i>
              </span>
            ) : (
              <span className="sd-stat sd-dist" title="Distance">{g.distance} m{mounted && S.endless.best > 0 ? <small> · best {g.mode.kind === 'endless' && g.mode.daily && S.endless.daily.date === dateRef.current ? S.endless.daily.best : S.endless.best}</small> : null}</span>
            )}
            <span className={'sd-stat sd-sun' + (lowLight ? ' is-low' : '')} title="Daylight left before the dusk catches you">☀ {Math.min(99, Math.floor(daylight))}s</span>
            {!endless && <span className="sd-stat" title="Cocoa">☕ {g.cocoa}<small>/{g.cocoaTotal}</small></span>}
            <span className="sd-stat" title="Snowflakes this run">❄ {g.flakes}</span>
            {g.flurry && <span className="sd-flurry">Snow Flurry!</span>}
          </span>
          <button className="sd-chip sd-pause" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!!result || ending}>❚❚</button>
        </header>
      )}
      <div className="sd-stage" ref={stage} onPointerDown={down}>
        <canvas ref={canvas} className="sd-canvas" tabIndex={0} aria-label="The snowy hills. Hold Space, a mouse button or a finger anywhere to tuck; let go to fly." />
        {screen === 'play' && g && phase === 'ready' && !paused && (
          <div className="sd-intro" aria-live="polite">
            <small>{V ? `Day ${dayIndex + 1} of 7 · ${V.feature}` : g.mode.kind === 'endless' && g.mode.daily ? `The Daily Hill · ${dateRef.current}` : 'The Moonlit Hills'}</small>
            <b>{V ? V.name : 'How far before the night?'}</b>
            {V && <em>✨ {V.teach}</em>}
            <span className="sd-go-hint">{touch ? 'Touch and hold anywhere to push off' : 'Hold Space (or click) to push off'}</span>
          </div>
        )}
        {screen === 'play' && g && dayIndex === 0 && phase === 'ride' && g.t < TPS * 9 && !paused && (
          <p className="sd-tip">{touch ? 'Hold on the way down · let go at the top to fly' : 'Hold Space on the way down · let go at the top to fly'}</p>
        )}
      </div>
      {error && <div className="sd-panel sd-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="sd-menu" aria-label="Snowdrift">
          <header className="sd-head"><a href="/" className="sd-back">← ARCADE</a>{settings}</header>
          <div className="sd-hero">
            <Art src="/art/snowdrift/title.webp" paint="title" w={1536} h={1024} className="sd-hero-art" />
            <div><p className="sd-eyebrow">A ONE-BUTTON SLEDDING RACE AGAINST THE SUNSET</p><h1>Snow<em>drift</em></h1>
              <p className="sd-lede">Winter in the high Andes. Dora and Enzo share one little wooden sled and race the sunset across seven snowy valleys to each evening’s lodge, where cocoa and a crackling fire are waiting.</p></div>
          </div>
          <div className="sd-go-row">
            <button className="sd-go" disabled={!ready} onClick={() => startDay(resumeAt)}>{!ready ? 'Waxing the sled…' : anyDone ? 'CONTINUE →' : 'START →'}<small>{mounted ? `Day ${resumeAt + 1}: ${VALLEYS[VALLEY_IDS[resumeAt]].name}` : ' '}</small></button>
            <button className="sd-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('days'); }}>🗺 Days<small>{mounted ? `${medalCount(S)} of 21 medals` : ' '}</small></button>
            <button className="sd-alt" disabled={!ready} onClick={() => openShop('menu')}>🏠 Lodge shop<small>❄ {mounted ? S.flakes : 0}</small></button>
            {mounted && endlessOpen(S) ? (<>
              <button className="sd-alt sd-moon" disabled={!ready} onClick={() => startEndless(false)}>☾ Moonlit Hills<small>best {S.endless.best} m</small></button>
              <button className="sd-alt sd-moon" disabled={!ready} onClick={() => startEndless(true)}>📅 Daily Hill<small>{S.endless.daily.date === dateRef.current && S.endless.daily.best ? `today ${S.endless.daily.best} m` : 'new today'}</small></button>
            </>) : <button className="sd-alt" disabled><span>☾ Moonlit Hills</span><small>after day 3</small></button>}
            {mounted && S.ended && <button className="sd-alt" onClick={() => { audio().ui(); setScreen('play'); game.current = null; endingRef.current = true; setEnding(true); panelRef.current = true; sound.current?.music('ending'); }}>🎆 The ending</button>}
          </div>
          <ol className="sd-how" aria-label="How to play">
            <li><b>⬇ Hold to tuck.</b> Holding makes the pair heavy: they shoot down the slopes. Holding up a slope slows them a little.</li>
            <li><b>🕊 Let go to fly.</b> Light again, they leap off the crests. Land along a downslope for a <i>Smooth landing</i>; three in a row start a <i>Snow Flurry</i>.</li>
            <li><b>🔄 Flip!</b> Hold in the air to backflip. A full flip landed upright is a big boost; land badly and they tumble.</li>
            <li><b>🌅 Race the dusk.</b> Night creeps up from behind. Cocoa pushes it back; snowflakes buy upgrades at the lodge.</li>
          </ol>
          <p className="sd-keys">{keysLine}</p>
        </section>
      )}

      {screen === 'days' && (
        <section className="sd-menu sd-days" aria-label="Days">
          <header className="sd-head"><button className="sd-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="sd-total">{mounted ? medalCount(S) : 0} / 21 medals · ❄ {mounted ? S.flakes : 0}</b></header>
          <div className="sd-grid">
            {VALLEY_IDS.map((id, i) => {
              const v = VALLEYS[id], open = mounted && dayOpen(S, i), d = mounted ? S.days[id] : undefined;
              return (
                <button key={id} className={'sd-daycard' + (open ? '' : ' is-locked') + (d?.done ? ' is-done' : '')} disabled={!open || !ready} onClick={() => startDay(i)} aria-label={`Day ${i + 1}: ${v.name}${open ? '' : ' (locked)'}`}>
                  <Art src={`/art/snowdrift/bg-${id}.webp`} paint="valley" valley={id} w={384} h={256} className="sd-daycard-art" />
                  <span className="sd-daycard-text">
                    <small>DAY {i + 1} · {v.feature.toUpperCase()}</small>
                    <b>{open ? v.name : '🔒 ' + v.name}</b>
                    <span>{v.blurb}</span>
                    <Medals on={[!!d?.done, !!d?.cocoa, !!d?.dusk]} />
                    <em>{d?.best ? `best ${fmtTime(d.best)} · ${d.spare.toFixed(1)}s spare` : open ? `medal: ${v.spare}s of daylight to spare` : 'reach the lodge before to open'}</em>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="sd-note">Medals: 🏠 reach the lodge · ☕ collect every cocoa · ☀ reach the lodge with the daylight to spare that the day asks for.</p>
        </section>
      )}

      {screen === 'shop' && (
        <section className="sd-menu sd-shop" aria-label="The lodge shop">
          <Art src="/art/snowdrift/lodge.webp" paint="lodge" w={1536} h={1024} className="sd-shop-art" />
          <header className="sd-head"><button className="sd-back" onClick={() => { audio().ui(); if (shopFrom === 'day') setScreen('days'); else toMenu(); }}>← {shopFrom === 'day' ? 'Days' : 'Back'}</button><b className="sd-flakes">❄ {mounted ? S.flakes : 0} snowflakes</b></header>
          <div className="sd-shop-card">
            <p className="sd-eyebrow">THE LODGE</p>
            <h2>Warm paws, fresh wax</h2>
            <p className="sd-note">Spend snowflakes on a few small things for the sled. They help a little; the rhythm does the rest.</p>
            <div className="sd-ups">
              {UPGRADE_IDS.map((id) => {
                const u = UPGRADES[id], lv = mounted ? S.levels[id] : 0, max = lv >= MAX_LEVEL, cost = max ? 0 : u.cost[lv];
                return (
                  <div key={id} className="sd-up">
                    <span className="sd-up-icon" aria-hidden="true">{u.icon}</span>
                    <span className="sd-up-text"><b>{u.name}</b><small>{u.blurb}</small>
                      <span className="sd-pips" aria-label={`level ${lv} of ${MAX_LEVEL}`}>{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < lv ? 'is-on' : ''} />)}</span>
                      <em>{u.values[lv]}{u.unit}{!max ? ` → ${u.values[lv + 1]}${u.unit}` : ''}</em>
                    </span>
                    <button className="sd-buy" disabled={max || !mounted || S.flakes < cost} onClick={() => purchase(id)} aria-label={max ? `${u.name}: all done` : `Buy ${u.name} for ${cost} snowflakes`}>{max ? '✓ Done' : `❄ ${cost}`}</button>
                  </div>
                );
              })}
            </div>
            <div className="sd-row">
              {shopFrom === 'day' && mounted && nextOpen >= 0 && <button className="sd-go" onClick={() => startDay(Math.max(0, nextOpen))}>Next day →<small>{VALLEYS[VALLEY_IDS[Math.max(0, nextOpen)]].name}</small></button>}
              <button className="sd-alt" onClick={() => { audio().ui(); setScreen('days'); }}>🗺 Days</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'play' && g && (<>
        {result && (
          <div className={'sd-panel sd-result is-' + result.kind} role="dialog" aria-label={result.kind === 'finish' ? 'The lodge' : 'Night fell'}>
            {endless ? (<>
              <p className="sd-eyebrow">{g.mode.kind === 'endless' && g.mode.daily ? `DAILY HILL · ${dateRef.current}` : 'THE MOONLIT HILLS'}</p>
              <h2>{g.distance} m</h2>
              <p className="sd-note">{result.fresh.best || result.daily ? '★ A new best! ' : ''}{g.smooths} smooth landings · {g.flips} flips · ❄ {g.flakes} snowflakes banked</p>
              <p className="sd-note">Best {S.endless.best} m{g.mode.kind === 'endless' && g.mode.daily ? ` · today ${S.endless.daily.best} m` : ''}</p>
              <div className="sd-row">
                <button className="sd-go" autoFocus onClick={() => start(g.mode.kind === 'endless' && !g.mode.daily ? { ...g.mode, seed: (g.mode.seed * 1103515245 + 12345) >>> 0 } : g.mode)}>⟲ Again<small>{g.mode.kind === 'endless' && g.mode.daily ? 'the same hill' : 'new hills'}</small></button>
                <button className="sd-alt" onClick={() => openShop('day')}>🏠 Lodge shop</button>
                <button className="sd-alt" onClick={() => toMenu()}>Menu</button>
              </div>
            </>) : result.kind === 'finish' && V ? (<>
              <p className="sd-eyebrow">DAY {dayIndex + 1} · THE LODGE</p>
              <h2>{V.name}</h2>
              <div className="sd-bigmedals">
                {g.medals().map((m, i) => (
                  <span key={i} className={(m ? 'is-on' : '') + ((i === 0 && result.fresh.first) || (i === 1 && result.fresh.cocoa) || (i === 2 && result.fresh.dusk) ? ' is-new' : '')}><i>{['🏠', '☕', '☀'][i]}</i><small>{MEDALS[i]}</small></span>
                ))}
              </div>
              <p className="sd-note">{fmtTime(g.finishT)}{result.fresh.best ? ' · a new best time!' : ''} · ☀ {g.spare.toFixed(1)}s of daylight to spare (the medal asks {V.spare}s) · ☕ {g.cocoa}/{g.cocoaTotal} · ❄ {g.flakes} banked</p>
              <div className="sd-row">
                <button className="sd-go" autoFocus onClick={() => openShop('day')}>🏠 To the lodge →<small>❄ {S.flakes} to spend</small></button>
                {dayIndex + 1 < VALLEY_IDS.length && <button className="sd-alt" onClick={() => startDay(dayIndex + 1)}>Next day →<small>{VALLEYS[VALLEY_IDS[dayIndex + 1]].name}</small></button>}
                <button className="sd-alt" onClick={() => start(g.mode)}>⟲ Again</button>
              </div>
            </>) : V && (<>
              <p className="sd-eyebrow">DAY {dayIndex + 1} · NIGHT FELL</p>
              <h2>So close!</h2>
              <p className="sd-dist-line"><b>{g.distance} m</b> of <b>{Math.round(g.lodge)} m</b> to the lodge</p>
              <span className="sd-meter"><i style={{ width: `${Math.round(g.progress * 100)}%` }} /></span>
              <p className="sd-note">❄ {g.flakes} snowflakes banked · try holding all the way down each slope, and letting go just before the top.</p>
              <div className="sd-row">
                <button className="sd-go" autoFocus onClick={() => start(g.mode)}>⟲ Try again<small>Enter or R</small></button>
                <button className="sd-alt" onClick={() => openShop('day')}>🏠 Lodge shop</button>
                <button className="sd-alt" onClick={() => toMenu('days')}>🗺 Days</button>
              </div>
            </>)}
          </div>
        )}
        {paused && (
          <div className="sd-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>The sun waits for you.</p>
            {settings}
            <p className="sd-keys">{keysLine}</p>
            <div className="sd-row"><button className="sd-go" onClick={() => pause(false)}>Keep going</button><button className="sd-alt" onClick={() => { pause(false); start(g.mode); }}>Restart</button><button className="sd-alt" onClick={() => toMenu('days')}>Days</button><button className="sd-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
        )}
      </>)}
      {ending && (
        <div className="sd-ending" role="dialog" aria-label="The grand lodge">
          <Art src="/art/snowdrift/ending.webp" paint="ending" w={1536} h={1024} className="sd-ending-art" />
          <div className="sd-ending-text">
            <p className="sd-eyebrow">THE SUMMIT · THE GRAND LODGE</p>
            <h2>Cocoa by the fire</h2>
            <p>Seven valleys, a great many hills, and one sunset that never quite caught them. Dora and Enzo lean the little sled by the door of the grand lodge, shake the snow from their scarves and curl up by the fire with two mugs of cocoa, while fireworks bloom over the peaks.</p>
            <p className="sd-final">{mounted ? medalCount(S) : 0} of 21 medals{mounted && medalCount(S) < 21 ? ' · more medals wait in the valleys' : ' · every medal in the Andes!'} · ☾ the Moonlit Hills are open</p>
            <div className="sd-row"><button className="sd-go" onClick={() => toMenu('days')}>🗺 Days →</button><button className="sd-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
          <div className="sd-credits" aria-label="Cast"><div>
            <p className="sd-eyebrow">STARRING</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="sd-eyebrow">THANK YOU FOR PLAYING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
