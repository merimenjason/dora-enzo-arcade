'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Flight, PLACES, PLACE_IDS, CHALLENGES, CHALLENGE, challengesIn, SHAPES, SHAPE_IDS, STENCILS, STENCIL_FROM, COLOURS, COLOUR_NAMES, DT, NO_INPUT,
  SAVE_KEY, readSave, freshSave, recordResult, placeOpen, placeDone, challengeOpen, medalCount, shapesOwned, stencilsOwned, MEDAL_NAMES,
  type Save, type PlaceId, type Challenge, type Input, type Shape, type Stencil, type Paint, type Ev, type Who,
} from '@/lib/kite-game';
import { KiteScene, paintKitePreview, paintWindStrip, type Pose } from '@/lib/kite-scene';
import { KiteSound, type SongId } from './sound';
import './kite.css';

type Screen = 'menu' | 'map' | 'place' | 'workshop' | 'play' | 'ending';
type Result = { won: boolean; medal: number; value: number; best: boolean; newShape: Shape | null; newStencils: Stencil[]; firstEnding: boolean; opened: PlaceId[] };
const ART = '/art/kite/';
const AWARD_FROM: Partial<Record<Shape, string>> = Object.fromEntries(CHALLENGES.filter((c) => c.award).map((c) => [c.award!, c.id]));
const PLACE_ICON: Record<PlaceId, string> = { meadow: '🌼', orchard: '🍎', beach: '🐚', hilltop: '☁️', fete: '🎪', cliffs: '🎏' };

/** A challenge's result, said plainly. */
function says(ch: Challenge, v: number): string {
  switch (ch.goal.kind) {
    case 'tricks': case 'routine': return `${Math.round(v).toLocaleString('en-GB')} points`;
    case 'hold': return `${v.toFixed(1)} s in the circle`;
    case 'duel': return v === 0 ? 'a clean sweep, 3–0' : `won 3–${v}`;
    default: return `${v.toFixed(1)} s`;
  }
}
/** What each medal asks for. */
function marksLine(ch: Challenge): string {
  const [b, s, g] = ch.marks, k = ch.goal.kind;
  if (k === 'duel') return 'Gold: win without a touch against you · Silver: win 3–1 · Bronze: win';
  if (k === 'race') return `Beat the dragonfly (${b.toFixed(1)} s) · Silver under ${s} s · Gold under ${g} s`;
  if (ch.better === 'low') return `Bronze in time · Silver under ${s} s · Gold under ${g} s`;
  if (k === 'hold') return `Bronze ${b} s · Silver ${s} s · Gold ${g} s in the circle`;
  return `Bronze ${b} · Silver ${s} · Gold ${g} points`;
}
const Medal = ({ n, size = 22 }: { n: number; size?: number }) => <i className={`kd-medal m${n}`} style={{ width: size, height: size }} aria-label={n ? MEDAL_NAMES[n] : 'no medal'} role="img" />;

export default function KiteDay() {
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [place, setPlace] = useState<PlaceId>('meadow');
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);
  const [touch, setTouch] = useState(false);
  const [coach, setCoach] = useState(false);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => (t + 1) % 1e6);
  const save = useRef<Save>(freshSave());
  const S = save.current;
  const flight = useRef<Flight | null>(null);
  const scene = useRef<KiteScene | null>(null);
  const sound = useRef<KiteSound | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), strip = useRef<HTMLCanvasElement>(null), preview = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), resultRef = useRef<Result | null>(null), touchRef = useRef(false);
  const keys = useRef(new Set<string>());
  const mouse = useRef<{ x: number; y: number; on: boolean; pull: boolean; ease: boolean }>({ x: 0, y: 0, on: false, pull: false, ease: false });
  const finger = useRef<{ id: number; x: number; y: number } | null>(null);
  const pad = useRef({ pull: false, ease: false, left: false, right: false });
  const lastInput = useRef<'mouse' | 'keys'>('mouse');
  const doneAt = useRef(0);
  const pose = useRef<Pose>('pull');

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* private mode: play on without saving */ } };
  const audio = () => { if (!sound.current) sound.current = new KiteSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const go = (s: Screen) => {
    screenRef.current = s; setScreen(s);
    const song: SongId = s === 'ending' ? 'ending' : s === 'play' ? (flight.current?.P.id === 'cliffs' ? 'festival' : 'fly') : 'menu';
    sound.current?.music(song);
    if (s !== 'play') sound.current?.air(0, 0, false);
  };
  const pause = (on: boolean) => { pausedRef.current = on; setPaused(on); };

  /** Starts a challenge (or free flying when `id` is null). */
  const start = (id: string | null, at?: PlaceId) => {
    const S = save.current, ch = id ? CHALLENGE[id] : null, p = ch?.place ?? at ?? (flight.current?.P.id ?? 'meadow');
    const shape = S.shape, f = new Flight({ place: p, challenge: id, design: { shape, paint: S.designs[shape] }, flyer: S.flyer });
    flight.current = f; scene.current?.setFlight(f);
    resultRef.current = null; setResult(null); doneAt.current = 0; pause(false); setPlace(p);
    setCoach(!!(id === 'm1' || (!id && !S.tutorial)) && !S.tutorial);
    keys.current.clear(); mouse.current.pull = mouse.current.ease = false; pad.current = { pull: false, ease: false, left: false, right: false };
    go('play');
  };
  const finish = (f: Flight) => {
    const r = recordResult(save.current, f); persist();
    const res: Result = { won: f.won, medal: f.medal, value: f.value, best: r.best, newShape: r.newShape, newStencils: r.newStencils, firstEnding: r.firstEnding, opened: r.opened };
    resultRef.current = res; setResult(res); audio().medal(f.won ? f.medal : 0);
  };

  /** What the player is asking for this step. */
  const input = (): Input => {
    const f = flight.current!, k = keys.current, sc = scene.current;
    const steer = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
    if (steer) lastInput.current = 'keys';
    let aim: [number, number] | null = null;
    if (!steer && sc) {
      if (finger.current) aim = sc.toWorld(finger.current.x, finger.current.y);
      else if (mouse.current.on && lastInput.current === 'mouse' && !touchRef.current) aim = sc.toWorld(mouse.current.x, mouse.current.y);
    }
    const pull = k.has(' ') || k.has('arrowup') || k.has('w') || mouse.current.pull || pad.current.pull;
    const ease = !pull && (k.has('arrowdown') || k.has('s') || k.has('shift') || mouse.current.ease || pad.current.ease);
    const walk = (k.has('d') || pad.current.right ? 1 : 0) - (k.has('a') || pad.current.left ? 1 : 0);
    void f;
    return { pull, ease, steer, aim, walk };
  };

  const insets = () => {
    const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    const top = stage.current?.querySelector('.kd-hud')?.getBoundingClientRect().height ?? 60;
    return { top: top + 8, bottom: touchRef.current ? (portrait ? 132 : 92) : 8, left: 0, right: 0 };
  };
  const layout = () => {
    const st = stage.current, sc = scene.current; if (!st || !sc) return;
    const b = st.getBoundingClientRect(); sc.resize(b.width, b.height, Math.min(2, window.devicePixelRatio || 1));
    const sp = strip.current; if (sp) { const r = sp.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); sp.width = Math.max(1, Math.round(r.width * d)); sp.height = Math.max(1, Math.round(r.height * d)); }
  };

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse); touchRef.current = coarse;
    setMounted(true);
    const w = window as unknown as Record<string, unknown>;
    w.__kite = () => flight.current;
    w.__kiteSave = () => JSON.parse(JSON.stringify(save.current));
    w.__kiteStart = (id: string | null, p?: PlaceId) => start(id, p);
    w.__kiteScreen = () => screenRef.current;
    w.__kiteScene = () => (scene.current ? { ...scene.current.last, cam: { ...scene.current.cam }, w: scene.current.w, h: scene.current.h } : null);
    w.__kiteToScreen = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(); return [b.left + sc.sx(x), b.top + sc.sy(y)]; };
    w.__kiteResult = () => resultRef.current;
    let dead = false, raf = 0, last = 0, ui = 0, acc = 0, prev = 0;
    const loop = (ms: number) => {
      if (dead) return;
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
      const f = flight.current, sc = scene.current, playing = screenRef.current === 'play' && !!f && !!sc;
      if (playing && f && sc) {
        const frozen = pausedRef.current || !!resultRef.current;
        if (!frozen) {
          acc += dt; let n = 0;
          const from = f.events.length; const inp = input();
          while (acc >= DT && n < 8) { f.step(inp); acc -= DT; n++; }
          if (n === 8) acc = 0;
          const evs: Ev[] = f.events.slice(from);
          if (evs.length) { sc.events(evs, f); sound.current?.play(evs); if (evs.some((e) => e.k === 'ring' || e.k === 'pop' || e.k === 'deliver')) setCoach(false); }
          if (f.events.length > 600) f.events.splice(0, f.events.length - 200);
          const k = f.me;
          pose.current = k.walking ? 'run' : 'pull';
          sound.current?.air(Math.hypot(k.wind.u, k.wind.w), k.tension, k.state === 'fly');
          if (f.done && !doneAt.current) doneAt.current = ms;
          if (f.done && doneAt.current && ms - doneAt.current > 1100 && !resultRef.current) finish(f);
        } else sound.current?.air(0, 0, false);
        const aimShown = !touchRef.current && mouse.current.on && lastInput.current === 'mouse';
        sc.draw(f, { dt: frozen ? 0 : dt, pose: resultRef.current ? (f.won ? 'cheer' : 'sit') : pose.current, aim: aimShown ? sc.toWorld(mouse.current.x, mouse.current.y) : finger.current ? sc.toWorld(finger.current.x, finger.current.y) : null, insets: insets(), showAim: !frozen, arrow: !frozen });
        if (ms - prev > 100 && strip.current) { prev = ms; paintWindStrip(strip.current, f, Math.min(2, window.devicePixelRatio || 1)); }
      }
      if (screenRef.current === 'workshop' && preview.current) paintKitePreview(preview.current, { shape: save.current.shape, paint: save.current.designs[save.current.shape] }, ms / 1000);
      sound.current?.tick(!pausedRef.current);
      if (ms - ui > 200) { ui = ms; if (playing && !pausedRef.current) refresh(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (screenRef.current !== 'play') { if (k === 'escape' && screenRef.current !== 'menu') { e.preventDefault(); go(screenRef.current === 'place' ? 'map' : 'menu'); } return; }
      if (k === 'escape' || k === 'p') { if (!e.repeat && !resultRef.current) { e.preventDefault(); pause(!pausedRef.current); } return; }
      const tgt = e.target as HTMLElement;
      if (tgt.closest?.('button, a') && (k === ' ' || k === 'enter')) return;
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'shift'].includes(k)) { e.preventDefault(); keys.current.add(k); audio(); }
      if (k === 'arrowleft' || k === 'arrowright') lastInput.current = 'keys';
      if (k === 'r' && resultRef.current && flight.current) start(flight.current.ch?.id ?? null, flight.current.P.id);
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => { keys.current.clear(); mouse.current.pull = mouse.current.ease = false; pad.current = { pull: false, ease: false, left: false, right: false }; finger.current = null; if (screenRef.current === 'play' && !resultRef.current) pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden) sound.current?.resume(); };
    const vis = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', vis);
    window.addEventListener('resize', layout);
    return () => {
      dead = true; cancelAnimationFrame(raf); ro?.disconnect(); sound.current?.dispose(); sound.current = null;
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('resize', layout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the scene lives while the play screen is up
  useEffect(() => {
    if (screen !== 'play') return;
    const cv = canvas.current; if (!cv) return;
    if (!scene.current || scene.current.cv !== cv) { try { scene.current = new KiteScene(cv); } catch { return; } }
    if (flight.current) scene.current.setFlight(flight.current);
    layout();
    const ro = typeof ResizeObserver === 'function' && stage.current ? new ResizeObserver(() => layout()) : null;
    if (ro && stage.current) ro.observe(stage.current);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  useEffect(() => { requestAnimationFrame(() => layout()); }, [touch, result, paused]);
  useEffect(() => {
    // stop the page scrolling when the wheel or a finger moves over the sky
    const cv = canvas.current; if (!cv) return;
    const stop = (e: Event) => e.preventDefault();
    cv.addEventListener('wheel', stop, { passive: false }); cv.addEventListener('touchmove', stop, { passive: false });
    return () => { cv.removeEventListener('wheel', stop); cv.removeEventListener('touchmove', stop); };
  }, [screen]);

  // ---------------------------------------------------------------- the pointer
  const local = (e: React.PointerEvent) => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as const; };
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || resultRef.current) return;
    audio();
    const [x, y] = local(e);
    if (e.pointerType === 'mouse') {
      if (touchRef.current) { touchRef.current = false; setTouch(false); }
      lastInput.current = 'mouse'; mouse.current = { ...mouse.current, x, y, on: true };
      if (e.button === 0) mouse.current.pull = true; else if (e.button === 2) mouse.current.ease = true;
    } else {
      if (!touchRef.current) { touchRef.current = true; setTouch(true); }
      finger.current = { id: e.pointerId, x, y };
    }
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
  };
  const onMove = (e: React.PointerEvent) => {
    const [x, y] = local(e);
    if (e.pointerType === 'mouse') { mouse.current.x = x; mouse.current.y = y; mouse.current.on = true; lastInput.current = 'mouse'; if (touchRef.current) { touchRef.current = false; setTouch(false); } }
    else if (finger.current && finger.current.id === e.pointerId) finger.current = { id: e.pointerId, x, y };
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') { if (e.button === 0) mouse.current.pull = false; if (e.button === 2) mouse.current.ease = false; }
    else if (finger.current?.id === e.pointerId) finger.current = null;
  };
  const padBtn = (k: 'pull' | 'ease' | 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); audio(); pad.current[k] = true; try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* */ } },
    onPointerUp: () => { pad.current[k] = false; }, onPointerCancel: () => { pad.current[k] = false; }, onLostPointerCapture: () => { pad.current[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const toggle = (k: 'sound' | 'music') => {
    const S = save.current; S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="kd-chips">
      <button className="kd-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="kd-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );
  const setFlyer = (w: Who) => { save.current.flyer = w; persist(); audio().ui(); refresh(); };
  const flyerPick = (
    <span className="kd-flyer" role="group" aria-label="Who flies">
      {(['dora', 'enzo'] as Who[]).map((w) => (
        <button key={w} className={'kd-who' + (S.flyer === w ? ' is-on' : '')} aria-pressed={S.flyer === w} onClick={() => setFlyer(w)}>
          <img src={`${ART}${w}-pull.webp`} alt="" width={48} height={48} />{w === 'dora' ? 'Dora' : 'Enzo'}
        </button>
      ))}
    </span>
  );

  // ---------------------------------------------------------------- screens
  const f = flight.current;
  const nextOpen = mounted ? CHALLENGES.find((c) => challengeOpen(S.progress, c.id) && !(S.progress[c.id]?.medal)) ?? null : null;
  const medals = mounted ? medalCount(S.progress) : 0;

  let body: React.ReactNode = null;
  if (screen === 'menu') {
    body = (
      <section className="kd-menu">
        <img className="kd-hero" src={`${ART}title.webp`} alt="" />
        <div className="kd-menu-card kd-paper">
          <h1 className="kd-title">Kite Day</h1>
          <p className="kd-sub">A summer of kites with Dora and Enzo: pull, ease and steer through gusts, thermals and tumbling air, from Clover Meadow to the great Kite Festival on the cliffs.</p>
          <div className="kd-menu-buttons">
            <button className="kd-big" onClick={() => { audio().ui(); go('map'); }}>{medals ? 'The summer map' : 'Start the summer'}</button>
            {nextOpen && <button className="kd-big is-warm" onClick={() => { audio().ui(); start(nextOpen.id); }}>Fly next: {nextOpen.name}</button>}
            <button onClick={() => { audio().ui(); go('workshop'); }}>Kite workshop</button>
            <button onClick={() => { audio().ui(); start(null, 'meadow'); }}>Free fly</button>
            {S.ended && <button onClick={() => { audio().ui(); go('ending'); }}>The festival ending</button>}
          </div>
          <div className="kd-menu-foot">{flyerPick}{settings}</div>
          <p className="kd-medals"><Medal n={3} size={18} /> {medals} of {CHALLENGES.length * 3} medal points</p>
          <a className="kd-back" href="/">← Arcade</a>
        </div>
      </section>
    );
  } else if (screen === 'map') {
    body = (
      <section className="kd-map">
        <header className="kd-bar"><button className="kd-back" onClick={() => go('menu')}>← Kite Day</button><h2>The summer</h2><span className="kd-spacer" />{settings}</header>
        <div className="kd-map-grid">
          <svg className="kd-path" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path d="M30 50 C 90 10, 130 90, 150 50 S 240 10, 270 50 M270 50 C 290 110, 200 120, 270 150 M270 150 C 220 190, 180 120, 150 150 S 60 190, 30 150" /></svg>
          {PLACE_IDS.map((p, i) => {
            const open = placeOpen(S.progress, p), list = challengesIn(p), done = placeDone(S.progress, p);
            const pm = list.reduce((n, c) => n + (S.progress[c.id]?.medal ?? 0), 0);
            return (
              <button key={p} className={'kd-place kd-paper' + (open ? '' : ' is-locked')} disabled={!open} onClick={() => { audio().ui(); setPlace(p); go('place'); }} style={{ order: [0, 1, 2, 5, 4, 3][i] }}>
                <span className="kd-place-pic" style={{ backgroundImage: `url(${ART}bg-${p}.webp)` }} />
                <span className="kd-place-name">{PLACE_ICON[p]} {PLACES[p].name}</span>
                <span className="kd-place-feat">{PLACES[p].feature}</span>
                <span className="kd-place-medals">{open ? <>{list.map((c) => <Medal key={c.id} n={S.progress[c.id]?.medal ?? 0} size={16} />)} <small>{done}/{list.length}</small></> : p === 'cliffs' ? 'Opens when every place is nearly done' : `Opens after ${PLACES[PLACE_IDS[i - 1]].name}`}</span>
                <span className="kd-sr">{pm} medal points</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  } else if (screen === 'place') {
    const P = PLACES[place], list = challengesIn(place), owned = shapesOwned(S.progress);
    body = (
      <section className="kd-placescreen" style={{ backgroundImage: `url(${ART}bg-${place}.webp)` }}>
        <header className="kd-bar"><button className="kd-back" onClick={() => go('map')}>← Map</button><h2>{PLACE_ICON[place]} {P.name}</h2><span className="kd-spacer" />{settings}</header>
        <div className="kd-place-body">
          <div className="kd-paper kd-place-intro">
            <p>{P.blurb}</p>
            <div className="kd-kites" role="group" aria-label="Your kite">
              {owned.map((sh) => <button key={sh} className={'kd-kitebtn' + (S.shape === sh ? ' is-on' : '')} aria-pressed={S.shape === sh} onClick={() => { S.shape = sh; persist(); audio().ui(); refresh(); }}>{SHAPES[sh].name}</button>)}
              <button onClick={() => go('workshop')}>Workshop…</button>
            </div>
            <button onClick={() => start(null, place)}>Free fly here</button>
          </div>
          <ol className="kd-challenges">
            {list.map((c) => {
              const open = challengeOpen(S.progress, c.id), pr = S.progress[c.id];
              return (
                <li key={c.id} className={'kd-paper kd-ch' + (open ? '' : ' is-locked')}>
                  <div className="kd-ch-head"><Medal n={pr?.medal ?? 0} size={30} /><h3>{c.name}</h3>{c.award && !owned.includes(c.award) && <span className="kd-award">wins the {SHAPES[c.award].name} kite</span>}</div>
                  <p>{c.blurb}</p>
                  <p className="kd-marks">{marksLine(c)}{c.suggest && c.suggest !== S.shape && owned.includes(c.suggest) ? ` · try the ${SHAPES[c.suggest].name}` : ''}</p>
                  <div className="kd-ch-foot">{pr && <span className="kd-best">Best: {says(c, pr.best)}</span>}<button className="kd-go" disabled={!open} onClick={() => start(c.id)}>{open ? (pr ? 'Fly again' : 'Fly') : 'Locked'}</button></div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    );
  } else if (screen === 'workshop') {
    const owned = shapesOwned(S.progress), stOwned = stencilsOwned(S.progress), sh = S.shape, pt = S.designs[sh], D = SHAPES[sh];
    const setPaint = (p: Partial<Paint>) => { S.designs[sh] = { ...S.designs[sh], ...p }; persist(); audio().ui(); refresh(); };
    const bars: [string, number][] = [['Speed', 1 - D.cd0 / 0.26], ['Turning', D.turn / 6.4], ['Steadiness', D.stab / 6.2], ['Light winds', (D.area / D.mass) / 7.4], ['Line', D.lmax / 32]];
    const sw = (k: 'sail' | 'ink' | 'tail') => (
      <div className="kd-swatches" role="group" aria-label={k}>
        {COLOURS.map((col, i) => <button key={i} className={'kd-sw' + (pt[k] === i ? ' is-on' : '')} style={{ background: col }} aria-label={COLOUR_NAMES[i]} aria-pressed={pt[k] === i} onClick={() => setPaint({ [k]: i })} />)}
      </div>
    );
    body = (
      <section className="kd-workshop">
        <header className="kd-bar"><button className="kd-back" onClick={() => go(place && screenRef.current === 'workshop' && medals ? 'place' : 'menu')}>← Back</button><h2>The kite workshop</h2><span className="kd-spacer" />{settings}</header>
        <div className="kd-ws-body">
          <div className="kd-paper kd-ws-preview"><canvas ref={preview} width={520} height={520} aria-label={`${D.name} kite`} /><h3>{D.name}</h3><p>{D.blurb}</p>
            <ul className="kd-bars">{bars.map(([n, v]) => <li key={n}><span>{n}</span><i><b style={{ width: `${Math.round(Math.max(0.08, Math.min(1, v)) * 100)}%` }} /></i></li>)}</ul></div>
          <div className="kd-paper kd-ws-tools">
            <h3>Kite</h3>
            <div className="kd-shapes">{SHAPE_IDS.map((x) => { const have = owned.includes(x); return <button key={x} className={'kd-kitebtn' + (sh === x ? ' is-on' : '')} disabled={!have} aria-pressed={sh === x} title={have ? SHAPES[x].blurb : `Win ${CHALLENGE[AWARD_FROM[x]!]?.name}`} onClick={() => { S.shape = x; persist(); audio().ui(); refresh(); }}>{SHAPES[x].name}{!have && <small>{CHALLENGE[AWARD_FROM[x]!]?.name}</small>}</button>; })}</div>
            <h3>Sail</h3>{sw('sail')}
            <h3>Stencil</h3>
            <div className="kd-stencils">{STENCILS.map((x) => { const have = stOwned.includes(x); const from = STENCIL_FROM[x]; return <button key={x} className={'kd-kitebtn' + (pt.stencil === x ? ' is-on' : '')} disabled={!have} aria-pressed={pt.stencil === x} onClick={() => setPaint({ stencil: x })}>{x}{!have && from && <small>{PLACES[from].name}</small>}</button>; })}</div>
            <h3>Stencil paint</h3>{sw('ink')}
            <h3>Tail</h3>{sw('tail')}
            <button className="kd-big" onClick={() => start(null, place)}>Fly it</button>
          </div>
        </div>
      </section>
    );
  } else if (screen === 'ending') {
    body = (
      <section className="kd-ending">
        <img className="kd-hero" src={`${ART}ending.webp`} alt="Dora, Enzo and their neighbours watch the festival kites at sunset" />
        <div className="kd-paper kd-ending-card">
          <h2>The Kite Festival</h2>
          <p>The sun went down gold over the sea. Saffron and Old Burdock clapped, the rabbits cheered, and two kites, one Dora’s and one Enzo’s, flew the last loop of the summer side by side.</p>
          <p>Then everyone sat in the warm grass and watched the sky fill with kites.</p>
          <div className="kd-menu-buttons"><button className="kd-big" onClick={() => go('map')}>Back to the summer</button><button onClick={() => start(null, 'cliffs')}>Fly at sunset</button></div>
        </div>
      </section>
    );
  }

  // the play screen's HUD
  const ch = f?.ch ?? null, goal = ch?.goal;
  let progress = '';
  if (f && goal) {
    switch (goal.kind) {
      case 'rings': progress = `Ring ${Math.min(f.next + 1, goal.rings.length)} of ${goal.rings.length}`; break;
      case 'race': progress = `Gate ${Math.min(f.next + 1, goal.gates.length)} of ${goal.gates.length}`; break;
      case 'pop': progress = `${f.popped.filter(Boolean).length} of ${goal.need} popped`; break;
      case 'deliver': progress = `${f.delivered.filter(Boolean).length} of ${goal.baskets.length} delivered`; break;
      case 'tricks': progress = `${f.tricks[0].score.toLocaleString('en-GB')} points`; break;
      case 'hold': progress = `${f.inZone.toFixed(1)} s in the circle`; break;
      case 'duel': progress = `You ${f.touches[0]} · ${goal.rival.name} ${f.touches[1]}`; break;
      case 'routine': progress = `${f.cueScore.toLocaleString('en-GB')} points`; break;
    }
  } else if (f) progress = f.tricks[0].score ? `${f.tricks[0].score.toLocaleString('en-GB')} trick points` : 'Free fly';
  const k = f?.me, wind = f ? f.P.wind : null;
  const lineFrac = k ? (k.L - 4) / (k.lmax - 4) : 0, pullFrac = k ? Math.min(1, k.tension / 30) : 0;
  const timeLeft = f && ch ? f.timeLeft : 0;

  return (
    <main className="kd-shell" data-ready={mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? 'on' : undefined}>
      {body}
      {screen === 'play' && f && (
        <section className="kd-play" ref={stage}>
          <canvas ref={canvas} className="kd-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={(e) => { if (e.pointerType === 'mouse') mouse.current.on = false; }} onContextMenu={(e) => e.preventDefault()} aria-label="The sky: move the pointer to steer the kite" />
          <header className="kd-hud">
            <button className="kd-back" onClick={() => { pause(false); go(ch ? 'place' : 'menu'); }}>← {ch ? 'Map' : 'Menu'}</button>
            <div className="kd-hud-mid kd-paper">
              <b className="kd-hud-name">{ch ? ch.name : `${PLACES[f.P.id].name}`}</b>
              <span className="kd-hud-prog">{progress}</span>
              {ch && <span className="kd-hud-time">{Math.ceil(timeLeft)} s</span>}
            </div>
            <div className="kd-hud-wind kd-paper" title="The wind coming at you: upwind on the left, now on the right">
              <span className="kd-hud-label">Wind {wind ? `${wind.speed.toFixed(0)} m/s` : ''}</span>
              <canvas ref={strip} className="kd-strip" aria-hidden="true" />
              <span className="kd-gauges"><span title="Line out"><small>Line</small><i><b style={{ width: `${Math.round(lineFrac * 100)}%` }} /></i></span><span title="How hard it pulls"><small>Pull</small><i className="is-pull"><b style={{ width: `${Math.round(pullFrac * 100)}%` }} /></i></span></span>
            </div>
            <span className="kd-hud-right">{settings}<button className="kd-chip" onClick={() => pause(true)} aria-label="Pause">⏸</button></span>
          </header>
          {coach && !result && (
            <div className="kd-coach kd-paper">
              {touch ? <p><b>Drag in the sky</b> to steer the kite. Hold <b>Pull</b> to reel in and climb, <b>Ease</b> to let line out. ◀ ▶ walk.</p>
                : <p><b>Move the mouse</b>: the kite flies toward it. <b>Hold the left button</b> (or Space) to pull in and climb; <b>hold the right button</b> (or Shift) to let line out. <kbd>A</kbd> <kbd>D</kbd> walk, <kbd>←</kbd> <kbd>→</kbd> turn the nose.</p>}
              <button className="kd-chip" onClick={() => { setCoach(false); save.current.tutorial = true; persist(); }}>Got it</button>
            </div>
          )}
          {touch && !result && (
            <div className="kd-pad">
              <span className="kd-pad-walk"><button {...padBtn('left')} aria-label="Walk back">◀</button><button {...padBtn('right')} aria-label="Walk on">▶</button></span>
              <span className="kd-pad-line"><button className="is-ease" {...padBtn('ease')}>Ease</button><button className="is-pull" {...padBtn('pull')}>Pull</button></span>
            </div>
          )}
          {paused && !result && (
            <div className="kd-overlay"><div className="kd-paper kd-panel">
              <h2>Paused</h2>
              {ch && <p>{ch.blurb}</p>}
              <div className="kd-menu-buttons"><button className="kd-big" onClick={() => pause(false)}>Keep flying</button>{ch && <button onClick={() => start(ch.id)}>Start again</button>}<button onClick={() => { pause(false); go(ch ? 'place' : 'menu'); }}>{ch ? 'Back to the map' : 'Menu'}</button></div>
            </div></div>
          )}
          {result && ch && (
            <div className="kd-overlay"><div className="kd-paper kd-panel kd-result">
              <Medal n={result.won ? result.medal : 0} size={88} />
              <h2>{result.won ? (result.medal === 3 ? 'Gold!' : result.medal === 2 ? 'Silver!' : 'Bronze!') : ch.goal.kind === 'duel' ? `${ch.goal.rival.name} wins this one` : 'Not this time'}</h2>
              <p className="kd-res-value">{result.won ? says(ch, result.value) : ch.goal.kind === 'race' && f.next >= ch.goal.gates.length ? 'The dragonfly got there first.' : ch.goal.kind === 'duel' ? `${f.touches[0]}–${f.touches[1]}` : 'The time ran out.'}{result.best && result.won ? ' · a new best!' : ''}</p>
              {result.won && result.medal < 3 && <p className="kd-marks">{marksLine(ch)}</p>}
              {result.newShape && <p className="kd-unlock">New kite: the <b>{SHAPES[result.newShape].name}</b>! {SHAPES[result.newShape].blurb}</p>}
              {result.newStencils.length > 0 && <p className="kd-unlock">New stencil{result.newStencils.length > 1 ? 's' : ''} for the workshop: {result.newStencils.join(', ')}.</p>}
              {result.opened.length > 0 && <p className="kd-unlock">Now open: {result.opened.map((p) => PLACES[p].name).join(', ')}!</p>}
              <div className="kd-menu-buttons">
                {result.firstEnding && <button className="kd-big is-warm" onClick={() => go('ending')}>The festival ending</button>}
                {(() => { const nx = CHALLENGES.find((c) => challengeOpen(S.progress, c.id) && !S.progress[c.id]?.medal); return result.won && nx && !result.firstEnding ? <button className="kd-big" onClick={() => start(nx.id)}>Next: {nx.name}</button> : null; })()}
                <button className={result.won ? '' : 'kd-big'} onClick={() => start(ch.id)}>Try again <kbd>R</kbd></button>
                <button onClick={() => go('place')}>Back to {PLACES[ch.place].name}</button>
              </div>
            </div></div>
          )}
        </section>
      )}
    </main>
  );
}
