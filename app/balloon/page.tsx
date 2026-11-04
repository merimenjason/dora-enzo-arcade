'use client';
// Cloudberry Balloon: the page. Input, the flight loop, the map of the eight hops, Granny Bramble's welcome, the HUD
// (the heat and fuel gauges, the wind at every height, the cloudberries, parcels and sandbags, the way to the meadow),
// results, the ending and the save. Rules in lib/balloon-game.ts, drawing in lib/balloon-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/balloon-game';
import type { End, Flight, FlightEvent, LevelId, Save } from '@/lib/balloon-game';
import type { BalloonScene } from '@/lib/balloon-scene';
import { BalloonSound, type SongId } from './sound';
import './balloon.css';

type Screen = 'title' | 'map' | 'fly' | 'result' | 'ending' | 'howto' | 'settings';
type Result = ReturnType<G.Flight['result']> & { id: LevelId; why: End; best: boolean; ending: boolean; opened: LevelId | null };
type Btn = 'drop' | 'sand';
/** the flight runs at double time, so a hop takes a couple of minutes */
const SPEED = 2;

const art = (n: string) => `/art/balloon/${n}.webp`;
const WHO = { granny: { name: 'Granny Bramble', art: 'granny' }, dora: { name: 'Dora', art: 'dora' }, enzo: { name: 'Enzo', art: 'enzo' } } as const;
type Who = keyof typeof WHO;
const INTRO: { who: Who; text: string }[] = [
  { who: 'granny', text: 'There you are, my dears! The Lantern Festival is up on the High Meadow tonight, and I promised them my cloudberry jam.' },
  { who: 'granny', text: 'Take the old balloon. Pick every cloudberry you pass, and drop a jar to each village garden on the way. The parachutes do the rest.' },
  { who: 'enzo', text: 'The balloon only goes up and down. The wind does the steering, and it blows a different way at every height. So we pick our height.' },
  { who: 'dora', text: 'And Enzo pedals the little propeller for the fiddly bits. Burner for up, vent for down. To the High Meadow!' },
];
// where each hop sits on the painted map (percent of its width and height)
const PINS: Record<LevelId, [number, number]> = { farm: [12, 64], mill: [22, 50], lake: [16, 34], forest: [44, 38], cliffs: [58, 26], gorge: [76, 52], storm: [74, 32], meadow: [90, 18] };
const SONG: Record<LevelId, SongId> = { farm: 'valley', mill: 'valley', lake: 'valley', forest: 'woods', cliffs: 'high', gorge: 'woods', storm: 'storm', meadow: 'high' };
const WHY: Record<End, string> = { landed: 'Landed!', splash: 'Splash!', crash: 'Too hard!', stranded: 'Out of fuel' };
const WHY_LINE: Record<End, string> = {
  landed: 'Down softly on the meadow.',
  splash: 'Into the lake. Dora says the water was lovely. Enzo does not.',
  crash: 'That landing was a bit quick. Ease off the vent near the ground.',
  stranded: 'The burner’s dry and there’s no village here. Fill up in a village on the way next time.',
};
/** Granny's tips on the first hop: what to do next, from where the balloon is (keyboard words, then touch words) */
function farmTip(f: Flight, touch: boolean): string {
  const fin = f.lv.pads[f.lv.pads.length - 1], to = fin.x - f.x, ag = f.altitude;
  const BURN = touch ? 'BURN' : 'Space', VENT = touch ? 'VENT' : 'S';
  if (f.over) return '';
  if (f.grounded && f.t < 30 && Math.abs(f.x - f.lv.pads[0].x) < 40) return `Hold ${BURN} to light the burner. The balloon takes a moment to warm up.`;
  if (Math.abs(to) < fin.w / 2 + 10) return ag > 3 ? `Over the meadow! ${VENT} lets the heat out. Come down gently.` : 'Easy now: a soft touch scores more.';
  if (to < 0) return `Past the meadow! Sink low, where the air is calm, and pedal back with ${touch ? '◀' : 'A'}.`;
  if (f.lv.bushes.some((b, i) => !f.picked[i] && b - f.x > 0 && b - f.x < 70)) return 'A cloudberry bush ahead: skim just over it to pick the berries.';
  if (ag > 60) return `High enough. Let go of ${BURN} and the balloon drifts on the wind: the arrows on the left show it.`;
  if (to < 160) return `The meadow’s coming up. Ease off and get ready to ${touch ? 'tap VENT' : 'press S'}.`;
  return 'The wind does the steering. Watch the heat gauge: above its line you climb, below it you sink.';
}
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const stars = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

export default function CloudberryBalloonPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BalloonScene | null>(null);
  const soundRef = useRef<BalloonSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const [pick, setPick] = useState<LevelId>('farm');
  const flightRef = useRef<Flight | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [intro, setIntro] = useState(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [touch, setTouch] = useState(false);
  const touchRef = useRef(false);
  const keys = useRef(new Set<string>());
  const taps = useRef(new Set<Btn>());
  const sent = useRef<G.Input>(G.idleInput());
  const tbtn = useRef({ burn: false, vent: false, left: false, right: false, drop: false, sand: false });
  const reduced = useRef(false);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const last = useRef({ heat: -1, fuel: -1, berries: -1, parcels: -1, sand: -1, prog: -1, windT: 0, guideT: 0, guideX: null as number | null, creakT: 0, tipT: 0 });

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(touchRef.current = coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new BalloonSound(s.settings.sound, s.settings.music);
    const open = [...G.LEVELS].reverse().find((l) => G.unlocked(s, l.id) && !s.best[l.id]) ?? G.LEVELS[0];
    setPick(open.id);
    let gone = false;
    void import('@/lib/balloon-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      sceneRef.current = new m.BalloonScene(canvasRef.current);
      setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'fly') setPaused(true); } else soundRef.current?.resume(); };
    const rs = () => sceneRef.current?.resize();
    document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); sceneRef.current?.dispose(); soundRef.current?.dispose(); };
  }, [setPaused]);

  useEffect(() => {
    const f = flightRef.current;
    sfx()?.music(screen === 'fly' && f ? SONG[f.lv.id] : screen === 'ending' ? 'ending' : screen === 'title' ? null : 'menu');
    if (screen !== 'fly') sfx()?.quiet();
    if (screen === 'fly') requestAnimationFrame(() => sceneRef.current?.resize());
  }, [screen]);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- a flight
  const startFlight = useCallback((id: LevelId) => {
    sfx()?.unlock();
    const f = new G.Flight(G.level(id));
    flightRef.current = f; sceneRef.current?.setLevel(f.lv, f.ter);
    setPaused(false); setResult(null); taps.current.clear(); sent.current = G.idleInput();
    last.current = { heat: -1, fuel: -1, berries: -1, parcels: -1, sand: -1, prog: -1, windT: 0, guideT: 0, guideX: null, creakT: 0, tipT: 0 };
    setScreen('fly');
  }, [setPaused, setScreen]);

  const finish = useCallback(() => {
    const f = flightRef.current; if (!f || !f.why) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const i = G.LEVELS.findIndex((l) => l.id === f.lv.id), next = G.LEVELS[i + 1], wasOpen = next ? G.unlocked(s, next.id) : true;
    const r = G.record(s, f); persist(s);
    const opened = next && !wasOpen && G.unlocked(s, next.id) ? next.id : null;
    setResult({ ...r, id: f.lv.id, why: f.why, opened });
    if (opened) setPick(opened);
    sfx()?.quiet(); setScreen('result');
  }, [persist, setScreen]);

  const pop = (text: string, kind: string) => {
    const el = hud.current.pop; if (!el) return;
    el.textContent = text; el.dataset.kind = kind; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  };
  const onEvents = useCallback((f: Flight, evs: FlightEvent[]) => {
    const snd = sfx(), sc = sceneRef.current;
    for (const e of evs) {
      sc?.event(e, f);
      switch (e.k) {
        case 'liftoff': snd?.liftoff(); break;
        case 'berry': snd?.berry(e.n); pop(`+3 cloudberries · ${e.n}`, 'berry'); break;
        case 'drop': snd?.drop(); break;
        case 'parcel': snd?.parcel(e.hit); pop(e.hit === 'perfect' ? `Perfect! A jar for ${e.who}` : e.hit === 'good' ? `A jar for ${e.who}` : 'Missed the garden', e.hit === 'miss' ? 'bad' : 'good'); break;
        case 'sand': snd?.sand(); pop('Sandbag away', 'info'); break;
        case 'bump': snd?.bump(); pop(e.lost ? `Bump! −${e.lost} berr${e.lost === 1 ? 'y' : 'ies'}` : 'Bump!', 'bad'); break;
        case 'touch': snd?.touch(e.soft); if (e.pad && f.lv.pads.find((p) => p.name === e.pad)?.kind === 'village') pop(`Down at ${e.pad}`, 'info'); break;
        case 'refuel': snd?.refuel(); pop('Burner topped up', 'good'); break;
        case 'lowfuel': snd?.lowfuel(); pop('Fuel’s getting low', 'bad'); break;
        case 'flash': snd?.thunder(e.hit); if (e.hit) pop('Lightning! Get out from under the cloud', 'bad'); break;
        case 'end': if (e.why === 'landed') snd?.landed(); else { if (e.why === 'splash') snd?.splash(); snd?.sad(); } break;
      }
    }
  }, []);

  const readInput = useCallback((): G.Input => {
    const k = keys.current, t = tbtn.current;
    const pedal = (k.has('ArrowRight') || k.has('KeyD') || t.right ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') || t.left ? 1 : 0);
    return { burn: k.has('Space') || k.has('KeyW') || k.has('ArrowUp') || t.burn, vent: k.has('KeyS') || k.has('ArrowDown') || t.vent, drop: k.has('KeyE') || t.drop, sand: k.has('KeyQ') || t.sand, pedal };
  }, []);

  useEffect(() => {
    let raf = 0, prev = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      const snd = sfx(); snd?.pump();
      const sc = sceneRef.current, f = flightRef.current;
      if (screenRef.current !== 'fly' || !f || !sc) return;
      const inp = readInput();
      if (!pausedRef.current && !f.over) {
        acc += dt * SPEED; let n = 0;
        while (acc >= G.DT && n < 16) {
          // a latched tap is a press: if the last tick already had that button down, send one tick with it up first
          const ti = { ...inp };
          for (const b of ['drop', 'sand'] as const) if (taps.current.has(b)) { if (inp[b]) taps.current.delete(b); else if (sent.current[b]) ti[b] = false; else { ti[b] = true; taps.current.delete(b); } }
          f.tick(ti); sent.current = ti;
          if (f.events.length) onEvents(f, f.events); acc -= G.DT; n++; if (f.over) break;
        }
        snd?.air(f.wind(f.x, f.y) - f.vx * 0.5, f.burning, inp.vent && !f.grounded);
        if ((last.current.creakT -= dt) < 0) { last.current.creakT = 3 + Math.random() * 5; if (!f.grounded && Math.random() < 0.6) snd?.creak(); }
      } else { acc = 0; snd?.quiet(); }
      if (f.over) { endT += dt; if (endT > 1.8) { endT = 0; finish(); return; } } else endT = 0;
      // the parcel guide: where one would come down (worked out a few times a second; it flies the parachute ahead)
      const L = last.current, wantGuide = saveRef.current.settings.guide && f.parcels > 0 && !f.grounded && !f.over;
      if (wantGuide && (L.guideT -= dt) <= 0) { L.guideT = 0.12; L.guideX = f.predictDrop(); } else if (!wantGuide) L.guideX = null;
      sc.render(f, pausedRef.current ? 0 : dt * SPEED, reduced.current, L.guideX);
      drawHud(f);
      if (f.lv.id === 'farm' && hud.current.tip && (L.tipT -= dt) <= 0) {
        L.tipT = 0.25; const t = farmTip(f, touchRef.current);
        if (hud.current.tip.textContent !== t) { hud.current.tip.textContent = t; hud.current.tip.dataset.on = t ? '1' : '0'; }
      }
    };
    const drawHud = (f: Flight) => {
      const h = hud.current, L = last.current, lv = f.lv;
      const heat = Math.round(f.heat * 200);
      if (h.heat && L.heat !== heat) {
        L.heat = heat; h.heat.style.transform = `scaleY(${Math.min(1, f.heat / 1.2)})`;
        if (h.neutral) h.neutral.style.bottom = `${Math.min(100, (f.neutral() / 1.2) * 100)}%`;
        h.heat.parentElement!.dataset.state = f.heat > f.neutral() + 0.02 ? 'up' : f.heat < f.neutral() - 0.02 ? 'down' : 'level';
      }
      const fuel = Math.ceil(f.fuel);
      if (h.fuel && L.fuel !== fuel) { L.fuel = fuel; h.fuel.style.transform = `scaleY(${f.fuel / lv.fuel})`; h.fuel.parentElement!.dataset.low = f.fuel < lv.fuel * 0.2 ? '1' : '0'; }
      if (h.berries && L.berries !== f.berries) { L.berries = f.berries; h.berries.textContent = `${f.berries}/${lv.berryGoal}`; h.berries.parentElement!.dataset.done = f.berries >= lv.berryGoal ? '1' : '0'; }
      if (h.parcels && L.parcels !== f.parcels) { L.parcels = f.parcels; h.parcels.textContent = `${f.delivered.filter(Boolean).length}/${lv.drops.length}`; if (h.left) h.left.textContent = `${f.parcels} left`; }
      if (h.sand && L.sand !== f.sandbags) { L.sand = f.sandbags; h.sand.textContent = String(f.sandbags); }
      const prog = Math.round((f.x / lv.w) * 400);
      if (h.me && L.prog !== prog) { L.prog = prog; h.me.style.left = `${(f.x / lv.w) * 100}%`; }
      // the wind gauge: arrows at a dozen heights round the balloon, and the balloon on it
      if (h.winds && (L.windT -= 1) <= 0) {
        L.windT = 8; const g = G.groundAt(f.ter, f.x), lo = g, hi = g + 320, rows = h.winds.children;
        for (let i = 0; i < rows.length; i++) {
          const y = hi - ((i + 0.5) / rows.length) * (hi - lo), w = f.wind(f.x, y), el = rows[i] as HTMLElement;
          el.dataset.dir = Math.abs(w) < 0.6 ? 'calm' : w > 0 ? 'e' : 'w'; el.style.setProperty('--k', String(Math.min(1, Math.abs(w) / 9)));
        }
        if (h.alt) h.alt.style.bottom = `${Math.max(0, Math.min(100, ((f.y - lo) / (hi - lo)) * 100))}%`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput]);

  // ---------------------------------------------------------------- keyboard and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      const scr = screenRef.current;
      if (scr === 'fly') {
        if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
        if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
        if (e.code === 'KeyG' && !e.repeat) { setSetting('guide', !saveRef.current.settings.guide); return; }
        keys.current.add(e.code);
        if (e.repeat) return;
        if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && flightRef.current && !flightRef.current.burning) sfx()?.ignite();
        if (e.code === 'KeyE') taps.current.add('drop');
        if (e.code === 'KeyQ') taps.current.add('sand');
      } else if (scr === 'map' && intro >= 0 && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); nextIntro(); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); for (const k of Object.keys(tbtn.current) as (keyof typeof tbtn.current)[]) tbtn.current[k] = false; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  });
  const tb = (k: keyof typeof tbtn.current) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); tbtn.current[k] = true; if (k === 'drop' || k === 'sand') taps.current.add(k); if (k === 'burn') sfx()?.ignite(); sfx()?.unlock(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); },
    onPointerUp: () => { tbtn.current[k] = false; }, onPointerCancel: () => { tbtn.current[k] = false; }, onLostPointerCapture: () => { tbtn.current[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // ---------------------------------------------------------------- menus
  const toMap = () => {
    sfx()?.unlock(); sfx()?.button(); setScreen('map');
    if (!saveRef.current.intro) setIntro(0);
  };
  const nextIntro = () => {
    if (intro < 0) return; sfx()?.button();
    if (intro + 1 >= INTRO.length) { setIntro(-1); persist({ ...saveRef.current, intro: true }); return; }
    setIntro(intro + 1);
  };
  const setSetting = (k: 'sound' | 'music' | 'guide', v: boolean) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s);
    if (k === 'sound') sfx()?.setSound(v); else if (k === 'music') sfx()?.setMusic(v);
  };
  const quit = () => { setPaused(false); flightRef.current = null; sfx()?.quiet(); setScreen('map'); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __balloon: () => unknown }).__balloon = () => {
      const f = flightRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, result, intro, pick,
        flight: f && screenRef.current === 'fly' ? { lv: f.lv.id, x: f.x, y: f.y, alt: f.altitude, vy: f.vy, heat: f.heat, neutral: f.neutral(), fuel: f.fuel, berries: f.berries, parcels: f.parcels, delivered: f.delivered.filter(Boolean).length, sandbags: f.sandbags, grounded: f.grounded, over: f.over, why: f.why, t: f.t, burning: f.burning } : null,
        debug: {
          /** put the balloon at x, `alt` metres up, holding level */
          place: (x: number, alt: number) => { if (!f) return; f.grounded = false; f.pad = null; f.x = x; f.y = G.groundAt(f.ter, x) + alt; f.vx = 0; f.vy = 0; f.heat = f.neutral(); },
          /** put it just over the finish, sinking gently */
          finish: () => { if (!f) return; const p = f.lv.pads[f.lv.pads.length - 1]; f.grounded = false; f.pad = null; f.x = p.x; f.y = G.groundAt(f.ter, p.x) + 0.5; f.vx = 0; f.vy = -0.5; f.heat = f.neutral() - 0.05; },
          fuel: (v: number) => { if (f) f.fuel = v; },
          land: (ids: LevelId[], st = 1) => { const s = JSON.parse(G.serialise(saveRef.current)) as Save; for (const id of ids) s.best[id] = { points: 1000, stars: st }; persist(s); },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, lv = G.level(pick), open = G.unlocked(s, pick), best = s.best[pick];
  return <main className={`bl-shell bl-on-${screen}${touch ? ' bl-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <canvas ref={canvasRef} className="bl-canvas" aria-label="Cloudberry Balloon: the valley" />

    {screen === 'title' && <section className="bl-title">
      <div className="bl-art bl-bg"><img src={art('title')} alt="" /></div>
      <div className="bl-title-col">
        <h1 className="bl-logo">Cloudberry <span>Balloon</span></h1>
        <p className="bl-tag">Up with the burner, down with the vent, and let the winds take you to the Lantern Festival.</p>
        <div className="bl-menu">
          <button className="bl-go" onClick={toMap}>{s.stats.flights ? 'Back to the map' : 'Let’s fly'}</button>
          <button onClick={() => go('howto')}>How to fly</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        <a className="bl-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'map' && <section className="bl-page bl-map">
      <header className="bl-head">
        <button className="bl-back" onClick={() => go('title')}>‹ Title</button>
        <h2>The way to the High Meadow</h2>
        <span className="bl-count">{G.totalStars(s)}/{G.LEVELS.length * 3} ★</span>
      </header>
      {intro >= 0 && <div className="bl-talk" onClick={nextIntro} role="button" tabIndex={0}>
        <div className="bl-face"><img src={art(WHO[INTRO[intro].who].art)} alt={WHO[INTRO[intro].who].name} /></div>
        <div className="bl-talk-text"><b>{WHO[INTRO[intro].who].name}</b><p>{INTRO[intro].text}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
      </div>}
      <div className="bl-mapwrap">
        <div className="bl-art bl-mapart"><img src={art('map')} alt="A painted map of the valley, from the lake to the snowy mountains" /></div>
        {G.LEVELS.map((l) => { const op = G.unlocked(s, l.id), b = s.best[l.id]; return <button key={l.id} className={`bl-pin${pick === l.id ? ' on' : ''}${op ? '' : ' locked'}${b ? ' done' : ''}`} style={{ left: `${PINS[l.id][0]}%`, top: `${PINS[l.id][1]}%` }} onClick={() => { sfx()?.button(); setPick(l.id); }} data-hop={l.id} aria-label={`${l.n}. ${l.name}${op ? '' : ' (locked)'}`}>
          <b>{l.n}</b>{b && <i>{stars(b.stars)}</i>}
        </button>; })}
      </div>
      <div className="bl-hopbox bl-card">
        <div className="bl-hophead"><h3>{lv.n}. {lv.name}</h3><small>{lv.pads[0].name} → {lv.pads[lv.pads.length - 1].name}</small></div>
        <p>{lv.line}</p>
        <ul className="bl-goals">
          <li className={best ? 'done' : ''}><i>{best ? '★' : '☆'}</i>Land on {lv.pads[lv.pads.length - 1].name}</li>
          <li className={best && best.stars >= 2 ? 'done' : ''}><i>{best && best.stars >= 2 ? '★' : '☆'}</i>{lv.drops.length ? `Drop a jar of jam into all ${lv.drops.length} gardens` : 'No parcels on this hop: the star is free'}</li>
          <li className={best && best.stars >= 3 ? 'done' : ''}><i>{best && best.stars >= 3 ? '★' : '☆'}</i>Pick {lv.berryGoal} cloudberries</li>
        </ul>
        <div className="bl-row">
          <button className="bl-go" disabled={!open || intro >= 0 || !ready} onClick={() => startFlight(pick)}>{!ready ? 'Loading…' : open ? 'Fly!' : 'Locked'}</button>
          {best && <span className="bl-small">Best {fmt(best.points)} · {stars(best.stars)}</span>}
        </div>
        {!open && <p className="bl-small">Land the hop before this one to open it.</p>}
      </div>
    </section>}

    {screen === 'fly' && flightRef.current && <section className="bl-hud">
      <div className="bl-gauges">
        <div className="bl-gauge bl-heat" data-state="level" title="Heat (the line is what holds you level)"><i ref={H('heat')} /><em ref={H('neutral')} /><span>Heat</span></div>
        <div className="bl-gauge bl-fuel" data-low="0" title="Fuel"><i ref={H('fuel')} /><span>Fuel</span></div>
        <div className="bl-winds" title="The wind at each height: the balloon marks yours">
          <div className="bl-wrows" ref={H('winds')}>{Array.from({ length: 12 }, (_, i) => <b key={i} data-dir="calm" />)}</div>
          <em ref={H('alt')} />
        </div>
      </div>
      <div className="bl-top">
        <span className="bl-chip bl-berries" data-done="0" title="Cloudberries"><i className="bl-berry" /><b ref={H('berries')}>0</b></span>
        <span className="bl-chip" title="Jars delivered"><i className="bl-jar" /><b ref={H('parcels')}>0</b><small ref={H('left')} /></span>
        <span className="bl-chip" title="Sandbags"><i className="bl-sack" /><b ref={H('sand')}>0</b></span>
        <button onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      </div>
      <div className="bl-prog" aria-hidden="true">
        {flightRef.current.lv.pads.map((p) => <i key={p.name} className={`bl-p-${p.kind}`} style={{ left: `${(p.x / flightRef.current!.lv.w) * 100}%` }} />)}
        {flightRef.current.lv.drops.map((d) => <i key={d.name} className="bl-p-drop" style={{ left: `${(d.x / flightRef.current!.lv.w) * 100}%` }} />)}
        {flightRef.current.lv.bushes.map((b) => <i key={b} className="bl-p-bush" style={{ left: `${(b / flightRef.current!.lv.w) * 100}%` }} />)}
        <b ref={H('me')} />
      </div>
      <div className="bl-pop" ref={H('pop')} />
      {flightRef.current.lv.id === 'farm' && <div className="bl-tip" ref={H('tip')} data-on="0" aria-live="polite" />}
      {!touch && <p className="bl-keys"><b>Space</b> burner · <b>S</b> vent · <b>A D</b> pedal · <b>E</b> drop a jar · <b>Q</b> sandbag · G guide · Esc pause</p>}
      {touch && <div className="bl-touchpad">
        <div className="bl-pedals"><button className="t-left" {...tb('left')} aria-label="Pedal west">◀</button><button className="t-right" {...tb('right')} aria-label="Pedal east">▶</button></div>
        <div className="bl-tbtns">
          <button className="t-drop" {...tb('drop')}>JAR</button><button className="t-sand" {...tb('sand')}>SAND</button>
          <button className="t-vent" {...tb('vent')}>VENT</button><button className="t-burn" {...tb('burn')}>BURN</button>
        </div>
      </div>}
      {paused && <div className="bl-pause"><div className="bl-card bl-pausecard">
        <h2>Paused</h2>
        <button className="bl-go" onClick={() => setPaused(false)}>Keep flying</button>
        <button onClick={() => startFlight(flightRef.current!.lv.id)}>Start the hop again</button>
        <button onClick={() => setSetting('guide', !s.settings.guide)}>Jar guide: {s.settings.guide ? 'on' : 'off'}</button>
        <button onClick={quit}>Back to the map (nothing saved)</button>
      </div></div>}
    </section>}

    {screen === 'result' && result && <section className="bl-page bl-result">
      <div className="bl-card bl-resultcard">
        <h2>{WHY[result.why]}</h2>
        <p className="bl-stars" aria-label={`${result.stars} stars`}>{stars(result.stars)}</p>
        <p>{WHY_LINE[result.why]}</p>
        {result.landed && <table className="bl-tally"><tbody>
          <tr><td>Landed</td><td>300</td></tr>
          <tr><td>Cloudberries ({result.berries})</td><td>{fmt(result.berries * 20)}</td></tr>
          <tr><td>Jars ({result.hits}, {result.perfect} perfect)</td><td>{fmt(result.perfect * 150 + (result.hits - result.perfect) * 75)}</td></tr>
          <tr><td>Soft landing</td><td>{fmt(result.soft)}</td></tr>
          <tr><td>Fuel left</td><td>{fmt(result.fuel * 2)}</td></tr>
          <tr><td>Quick flight</td><td>{fmt(result.time)}</td></tr>
          <tr className="bl-total"><td>Total</td><td>{fmt(result.points)}{result.best && <em> New best!</em>}</td></tr>
        </tbody></table>}
        {result.opened && <p className="bl-open">{G.level(result.opened).name} is open!</p>}
        <div className="bl-row">
          {result.ending ? <button className="bl-go" onClick={() => go('ending')}>The festival ›</button>
            : result.opened ? <button className="bl-go" onClick={() => startFlight(result.opened!)}>Next hop ›</button>
            : <button className="bl-go" onClick={() => startFlight(result.id)}>Fly it again</button>}
          {(result.opened || result.ending) && <button onClick={() => startFlight(result.id)}>Again</button>}
          <button onClick={() => go('map')}>Map</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="bl-ending">
      <div className="bl-art bl-bg"><img src={art('ending')} alt="Dora and Enzo sharing cloudberries and cream in the basket at the Lantern Festival" /></div>
      <div className="bl-ending-text">
        <h2>The Lantern Festival</h2>
        <p>The balloon settles on the High Meadow just as the first lanterns go up. Granny Bramble’s jam goes on everything, the badgers and hedgehogs and rabbits dance until late, and Dora and Enzo share a big bowl of cloudberries and cream in the basket while the burner glows above them.</p>
        <p className="bl-small">{G.totalStars(s) < G.LEVELS.length * 3 ? `${G.totalStars(s)} of ${G.LEVELS.length * 3} stars. There are berries still out there.` : 'Every star on every hop. The best balloonists in the valley.'}</p>
        <div className="bl-row"><button className="bl-go" onClick={() => go('map')}>Back to the map</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="bl-page">
      <header className="bl-head"><button className="bl-back" onClick={() => go('title')}>‹ Title</button><h2>How to fly</h2></header>
      <div className="bl-cols">
        <div className="bl-card"><h3>Up and down</h3><ul><li>Hold <b>Space</b> (or <b>BURN</b>) to heat the balloon. It takes a moment to answer: the heat gauge shows how hot it is, and its line is the heat that holds you level.</li><li>Hold <b>S</b> (or <b>VENT</b>) to let heat out and sink. Higher up the air is thinner and needs more heat.</li><li>Throw a sandbag (<b>Q</b>) to get lighter when the fuel runs low.</li></ul></div>
        <div className="bl-card"><h3>Along</h3><ul><li>You can’t steer: the wind does. It blows a different way at different heights, so climb or sink into the wind that’s going your way. The gauge on the left shows the wind at every height.</li><li>The air is calm near the ground, and Enzo’s pedals (<b>A</b> and <b>D</b>, or <b>◀ ▶</b>) can creep you along there or nudge you over a bush or a garden.</li><li>Thermals over sunny clearings lift you; the gorge pulls you down.</li></ul></div>
        <div className="bl-card"><h3>The hop</h3><ul><li>Skim the cloudberry bushes to pick them. Birds and the thunderhead knock berries out of the basket.</li><li><b>E</b> (or <b>JAR</b>) drops a jar of jam on a parachute. The white ring shows where it would land: get it on the garden.</li><li>Land gently on the meadow at the end. Land in a village to fill up the burner. Not in the lake!</li></ul></div>
      </div>
    </section>}

    {screen === 'settings' && <section className="bl-page">
      <header className="bl-head"><button className="bl-back" onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="bl-card bl-settings">
        {(['sound', 'music', 'guide'] as const).map((k) => <div className="bl-set" key={k}><span>{k === 'guide' ? 'Jar guide' : k === 'sound' ? 'Sound' : 'Music'}</span><span className="bl-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings[k] === v ? 'on' : ''} onClick={() => setSetting(k, v)}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <p className="bl-small">{s.stats.flights} flights · {s.stats.berries} cloudberries · {s.stats.parcels} jars delivered · {s.stats.splashes} splashes</p>
        <button className="bl-danger" onClick={() => { if (window.confirm('Start Cloudberry Balloon again from the beginning?')) { const n = G.newSave(); n.settings = s.settings; persist(n); setPick('farm'); } }}>Start over</button>
      </div>
    </section>}
  </main>;
}
