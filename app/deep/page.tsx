'use client';
// Deepglow: the page. Input, the dive loop, the boat (upgrades, the journal, the map), Enzo on the radio, results, the
// ending and the save. Rules in lib/deep-game.ts, drawing in lib/deep-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/deep-game';
import type { Dive, DiveEvent, Save, SpecId, UpgId, World } from '@/lib/deep-game';
import type { DeepScene, FrameView } from '@/lib/deep-scene';
import { DeepSound, type SongId } from './sound';
import './deep.css';

type Screen = 'title' | 'boat' | 'dive' | 'result' | 'journal' | 'map' | 'ending' | 'howto' | 'settings';
type Result = { why: G.DiveEnd; depth: number; tray: SpecId[]; firsts: SpecId[]; earned: number; chart: number; mapShare: number };
type Radio = { text: string; key: number; mood: '' | 'warn' | 'good' };

let WORLD: World | null = null;
const world = () => (WORLD ??= G.makeWorld());
const art = (n: string) => `/art/deep/${n}.webp`;

const INTRO = [
  'Radio check! Can you hear me, Dora? Good. The Thimble is ready below the boat.',
  'Nobody has ever charted this trench. They say something enormous and glowing sings at the bottom.',
  'Bring me specimens and I’ll log them in the journal, and every one pays for upgrades to the sub.',
  'Ping the sonar to see the walls, and mind the lamp: shy creatures run from it, and bigger things come to look.',
];
const ZONE_LINE: Record<G.ZoneId, string> = {
  twilight: 'Back in the Twilight. Sunlight still reaches here, just.',
  midnight: 'That’s the Midnight Zone. No sunlight has ever been down there.',
  abyss: 'The Abyss! The water’s near freezing. Keep the heater on.',
  trench: 'You’re in the Trench. Nobody has ever been this deep. Listen… is that singing?',
};

export default function DeepglowPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DeepScene | null>(null);
  const soundRef = useRef<DeepSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const diveRef = useRef<Dive | null>(null);
  const mappedRef = useRef<Uint8Array>(new Uint8Array(G.GW * G.GH));
  const [result, setResult] = useState<Result | null>(null);
  const [radio, setRadio] = useState<Radio | null>(null);
  const radioRef = useRef<Radio | null>(null);
  const [intro, setIntro] = useState(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [showMap, setShowMapState] = useState(false);
  const showMapRef = useRef(false);
  const [touch, setTouch] = useState(false);
  const [tick, setTick] = useState(0);
  const keys = useRef(new Set<string>());
  /** keys tapped since the last tick, so a press quicker than a frame still counts */
  const taps = useRef(new Set<'ping' | 'lamp'>());
  const sent = useRef<G.Input>(G.idleInput());
  const stick = useRef({ x: 0, y: 0, id: -1, ox: 0, oy: 0 });
  const tbtn = useRef({ ping: false, lamp: false });
  const reduced = useRef(false), lite = useRef(false);
  const guide = useRef<{ x: number; y: number }[] | null>(null);
  const said = useRef(new Set<string>());
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const setShowMap = useCallback((p: boolean) => { showMapRef.current = p; setShowMapState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;
  const say = useCallback((text: string, mood: Radio['mood'] = '', once?: string) => {
    if (once) { if (said.current.has(once)) return; said.current.add(once); }
    const r = { text, key: Math.random(), mood }; radioRef.current = r; setRadio(r); sfx()?.radio(text);
  }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s); mappedRef.current = G.unpackMap(s.map);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    lite.current = coarse && Math.min(window.screen.width, window.screen.height) < 500;
    soundRef.current = new DeepSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/deep-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      sceneRef.current = new m.DeepScene(canvasRef.current); sceneRef.current.setWorld(world());
      setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'dive') setPaused(true); } else soundRef.current?.resume(); };
    const rs = () => sceneRef.current?.resize();
    document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); sceneRef.current?.dispose(); soundRef.current?.dispose(); };
  }, [setPaused]);

  useEffect(() => { sfx()?.music(screen === 'dive' ? 'dive' : screen === 'ending' ? 'ending' : screen === 'title' ? null : ('boat' as SongId)); if (screen !== 'dive') sfx()?.quiet(); }, [screen]);
  useEffect(() => { if (screen === 'dive') requestAnimationFrame(() => sceneRef.current?.resize()); }, [screen]);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the dive
  const startDive = useCallback(() => {
    sfx()?.unlock();
    const s = saveRef.current;
    const d = new G.Dive({ world: world(), levels: s.levels, seed: (Date.now() & 0xffffff) | 1, known: (Object.keys(s.journal) as SpecId[]), mapped: G.unpackMap(s.map) });
    diveRef.current = d; mappedRef.current = d.mapped; guide.current = null; said.current.clear();
    setPaused(false); setShowMap(false); setResult(null); radioRef.current = null; setRadio(null);
    sceneRef.current?.snapTo(d.x, d.y + 6);
    setScreen('dive');
    say(s.stats.dives === 0 ? 'Here we go! Arrows to steer, Space to ping. Drift into a creature gently to scoop it up.' : `Dive ${s.stats.dives + 1}. Hull’s good to ${d.st.rating} m. Have fun down there!`);
  }, [say, setPaused, setScreen, setShowMap]);

  const finish = useCallback(() => {
    const d = diveRef.current; if (!d) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const tray = [...d.tray];
    const { earned, firsts, chart } = G.bank(s, d);
    persist(s); mappedRef.current = G.unpackMap(s.map);
    setResult({ why: d.why!, depth: Math.round(d.deepest), tray, firsts, earned, chart, mapShare: G.mappedShare(mappedRef.current, world()) });
    sfx()?.quiet(); sfx()?.stinger(d.why === 'surfaced' || d.why === 'whale');
    setScreen(d.why === 'whale' ? 'ending' : 'result');
  }, [persist, setScreen]);

  const onEvents = useCallback((d: Dive, evs: DiveEvent[]) => {
    const snd = sfx(), sc = sceneRef.current;
    for (const e of evs) {
      switch (e.k) {
        case 'ping': snd?.ping(d.st.sonar); break;
        case 'bump': snd?.bump(e.mag); if (e.mag > 0) { sc?.bump(e.mag); if (e.mag > 1.5) say('Careful! Bumps like that dent the hull.', 'warn', 'bump'); } break;
        case 'catch': { const sp = G.spec(e.id); snd?.catch(e.first); say(e.first ? `A ${sp.name}! That’s new for the journal!` : `Another ${sp.name}. Lovely sample.`, 'good'); break; }
        case 'trayFull': snd?.full(); say('The tray’s full. Bring them up and I’ll log them!', 'warn'); break;
        case 'sting': snd?.sting(); sc?.bump(0.5); say('Ouch! The purple veils sting. Steer round them.', 'warn', 'sting'); break;
        case 'bite': snd?.bite(); sc?.bump(3); say('GRIMLURE! Lamp off and get away from it!', 'warn'); break;
        case 'lureNear': snd?.lure(); say('Something big is moving near you. A ping carries a long way… go quiet?', 'warn'); break;
        case 'bell': snd?.bell(); say('An air bell! Breathe easy and top up the tank.', 'good', 'bell'); break;
        case 'creak': snd?.creak(); say(`That creak is the hull. It’s only rated to ${d.st.rating} m!`, 'warn', 'creak'); break;
        case 'zone': say(ZONE_LINE[e.id], '', 'zone-' + e.id); break;
        case 'deep': if (e.depth % 200 === 0) say(`${e.depth} metres! The deepest anyone’s been on this boat.`, '', 'deep-' + e.depth); break;
        case 'lowAir': snd?.warn(); say('Air’s getting low. Follow my dots to the nearest air!', 'warn'); break;
        case 'lowHull': snd?.warn(); say('The hull can’t take much more. Maybe come up?', 'warn'); break;
        case 'lamp': snd?.lamp(e.on); if (!e.on) say('Lamp off. Shy ones won’t run now, but watch the walls.', '', 'lamp'); break;
        case 'whale': break;
        case 'end': break;
      }
    }
  }, [say]);

  const readInput = useCallback((): G.Input => {
    const k = keys.current, st = stick.current;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (st.id >= 0) { x = st.x; y = st.y; }
    return { x, y, ping: k.has('Space') || k.has('KeyJ') || tbtn.current.ping, lamp: k.has('KeyL') || k.has('KeyK') || tbtn.current.lamp };
  }, []);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, endT = 0, guideT = 0, bubT = 0;
    const view: FrameView = { dive: null as unknown as Dive, time: 0, dt: 0, mapped: mappedRef.current, reduced: false, lite: false, guide: null };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const snd = sfx(); snd?.pump();
      const d = diveRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'dive' || !d || !sc) return;
      const inp = readInput();
      if (!pausedRef.current && !showMapRef.current && !d.over) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 8) {
          // a latched tap is a press: if the last tick already had that button down, send one tick with it up first
          const ti = { ...inp };
          for (const b of ['ping', 'lamp'] as const) if (taps.current.has(b)) { if (inp[b]) taps.current.delete(b); else if (sent.current[b]) ti[b] = false; else { ti[b] = true; taps.current.delete(b); } }
          d.tick(ti); sent.current = ti;
          if (d.events.length) onEvents(d, d.events); acc -= G.DT; n++; if (d.over) break;
        }
        snd?.thrust(d.speed); snd?.setDepth(d.depth);
        bubT -= dt; if (d.speed > 2.5 && bubT <= 0) { bubT = 1.2 + Math.random(); snd?.bubbles(); }
        // Enzo's dots to air when the tank is low
        guideT -= dt;
        if (guideT <= 0) { guideT = 1; guide.current = d.air < d.st.air * 0.3 && d.depth > 6 ? d.wayToAir() : null; }
      } else { acc = 0; snd?.quiet(); }
      if (d.over) { endT += dt; if (endT > 1.2) { endT = 0; finish(); return; } } else endT = 0;
      view.dive = d; view.time = now / 1000; view.dt = dt; view.mapped = d.mapped; view.reduced = reduced.current; view.lite = lite.current; view.guide = guide.current;
      sc.render(view);
      // the HUD, straight to the DOM
      const h = hud.current;
      if (h.depth) h.depth.textContent = String(Math.round(d.depth));
      if (h.zone) h.zone.textContent = G.zoneAt(d.depth).name;
      if (h.air) { const k = d.air / d.st.air; h.air.style.transform = `scaleX(${k})`; h.air.parentElement!.parentElement!.dataset.low = k < 0.25 ? '1' : '0'; }
      if (h.airT) h.airT.textContent = `${Math.floor(d.air / 60)}:${String(Math.floor(d.air % 60)).padStart(2, '0')}`;
      if (h.hull) { const k = d.hull / d.st.hullMax; h.hull.style.transform = `scaleX(${k})`; h.hull.parentElement!.parentElement!.dataset.low = k < 0.3 ? '1' : '0'; }
      if (h.sonar) { h.sonar.style.transform = `scaleX(${1 - d.pingCd / d.st.sonarCd})`; h.sonar.parentElement!.parentElement!.dataset.ready = d.pingCd <= 0 ? '1' : '0'; }
      if (h.rating) h.rating.dataset.over = d.depth > d.st.rating ? '2' : d.depth > d.st.rating - 40 ? '1' : '0';
      if (h.tray) { const n = d.tray.length; if (h.tray.dataset.n !== String(n)) { h.tray.dataset.n = String(n); setTick((x) => x + 1); } }
      if (h.lampb) h.lampb.dataset.on = d.lamp ? '1' : '0';
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput]);

  // the map screen: drawn when it opens
  useEffect(() => {
    if (!(showMap || screen === 'map') || !mapRef.current) return;
    const c = mapRef.current.getContext('2d'); if (!c) return;
    void import('@/lib/deep-scene').then((m) => m.drawMap(c, world(), diveRef.current && screen === 'dive' ? diveRef.current.mapped : mappedRef.current));
  }, [showMap, screen, save]);

  // ---------------------------------------------------------------- keyboard and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      const scr = screenRef.current;
      if (scr === 'dive') {
        if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
        if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
        if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); setShowMap(!showMapRef.current); return; }
        keys.current.add(e.code);
        if (!e.repeat && (e.code === 'Space' || e.code === 'KeyJ')) taps.current.add('ping'); if (!e.repeat && (e.code === 'KeyL' || e.code === 'KeyK')) taps.current.add('lamp');
      } else if (scr === 'boat' && intro >= 0 && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); nextIntro(); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  });
  const stickDown = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); stick.current = { x: 0, y: 0, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); stickMove(e); sfx()?.unlock(); };
  const stickMove = (e: React.PointerEvent) => {
    const st = stick.current; if (st.id !== e.pointerId) return;
    const dx = e.clientX - st.ox, dy = e.clientY - st.oy, R = 46, L = Math.hypot(dx, dy), k = L > R ? R / L : 1;
    st.x = (dx * k) / R; st.y = (dy * k) / R;
    const knob = hud.current.knob; if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const stickUp = (e: React.PointerEvent) => { if (stick.current.id !== e.pointerId) return; stick.current = { x: 0, y: 0, id: -1, ox: 0, oy: 0 }; const knob = hud.current.knob; if (knob) knob.style.transform = ''; };
  const tb = (k: 'ping' | 'lamp') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); tbtn.current[k] = true; taps.current.add(k); sfx()?.unlock(); },
    onPointerUp: () => { tbtn.current[k] = false; }, onPointerCancel: () => { tbtn.current[k] = false; }, onPointerLeave: () => { tbtn.current[k] = false; },
  });

  // ---------------------------------------------------------------- the boat
  const toBoat = () => {
    sfx()?.unlock(); sfx()?.button(); setScreen('boat');
    if (!saveRef.current.intro) { setIntro(0); sfx()?.radio(INTRO[0]); }
  };
  const nextIntro = () => {
    if (intro < 0) return; sfx()?.button();
    if (intro + 1 >= INTRO.length) { setIntro(-1); const s = { ...saveRef.current, intro: true }; persist(s); return; }
    setIntro(intro + 1); sfx()?.radio(INTRO[intro + 1]);
  };
  const buyUp = (id: UpgId) => { const s: Save = JSON.parse(G.serialise(saveRef.current)); if (G.buy(s, id)) { persist(s); sfx()?.catch(false); } };
  const winchUp = () => { const d = diveRef.current; if (!d || d.over) return; setPaused(false); d.end('air'); onEvents(d, d.events); };
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __deep: () => unknown }).__deep = () => {
      const d = diveRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, map: showMapRef.current, save: saveRef.current, result, radio: radioRef.current, intro,
        dive: d && screenRef.current === 'dive' ? { x: d.x, y: d.y, depth: d.depth, air: d.air, hull: d.hull, lamp: d.lamp, tray: [...d.tray], over: d.over, why: d.why, t: d.t, speed: d.speed, echoes: d.echoes.length, pingCd: d.pingCd, face: d.face } : null,
        debug: {
          tp: (x: number, y: number) => { if (d) { d.x = x; d.y = y; d.vx = d.vy = 0; } },
          air: (v: number) => { if (d) d.air = v; },
          hull: (v: number) => { if (d) d.hull = v; },
          give: (n: number) => { const s = { ...saveRef.current, points: saveRef.current.points + n }; persist(s); },
          whale: () => { if (d) { const w = world().whale; d.x = w.x; d.y = w.y; } },
          specimen: (id: SpecId) => { if (!d) return; const c = d.creatures.find((cc) => cc.kind === id && !cc.caught); if (c) { d.x = c.x + 0.5; d.y = c.y; d.vx = d.vy = 0; } },
          surface: () => { if (d) { d.x = world().spine[0].x; d.y = 2; d.vy = -1; } },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, st = G.stats(s.levels), found = G.journalCount(s);
  const d = diveRef.current;
  void tick;
  return <main className={`dg-shell dg-on-${screen}${touch ? ' dg-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <canvas ref={canvasRef} className="dg-canvas" aria-label="Deepglow: the sea below the boat" />

    {screen === 'title' && <section className="dg-title">
      <div className="dg-art dg-bg"><img src={art('title')} alt="" /></div>
      <div className="dg-title-col">
        <h1 className="dg-logo">Deepglow</h1>
        <p className="dg-tag">Dora dives the dark. Enzo reads the sonar. Something at the bottom is singing.</p>
        <div className="dg-menu">
          <button className="dg-go" onClick={toBoat}>{s.stats.dives ? 'Back to the boat' : 'Start the expedition'}</button>
          <button onClick={() => go('howto')}>How to dive</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        <a className="dg-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'boat' && <section className="dg-page dg-boat">
      <header className="dg-head">
        <button className="dg-back" onClick={() => go('title')}>‹ Title</button>
        <h2>The research boat</h2>
        <span className="dg-points" title="Research points">✦ {s.points} research</span>
      </header>
      {intro >= 0 && <div className="dg-radio-card" onClick={nextIntro} role="button" tabIndex={0}>
        <div className="dg-face"><img src={art('enzo-portrait')} alt="Enzo" /></div>
        <div className="dg-radio-text"><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
      </div>}
      <div className="dg-boat-grid">
        <div className="dg-card dg-dive-card">
          <div className="dg-face big"><img src={art('dora-portrait')} alt="Dora" /></div>
          <div>
            <h3>The Thimble</h3>
            <p>Hull rated to <b>{st.rating} m</b> · air <b>{Math.floor(st.air / 60)}:{String(st.air % 60).padStart(2, '0')}</b> · tray <b>{st.tray}</b></p>
            <p className="dg-small">Deepest so far {s.stats.deepest} m · journal {found}/{G.SPECIES.length} · {Math.round(G.mappedShare(mappedRef.current, world()) * 100)}% charted{s.whale ? ' · the whale found' : ''}</p>
            <div className="dg-row"><button className="dg-go" onClick={startDive} disabled={intro >= 0}>Dive! ›</button><button onClick={() => go('journal')}>Journal ({found})</button><button onClick={() => go('map')}>Chart</button></div>
          </div>
        </div>
        <div className="dg-ups">
          {G.UPGRADES.map((u) => { const lv = s.levels[u.id], cost = G.upgradeCost(s, u.id); return <div key={u.id} className="dg-card dg-up" data-up={u.id}>
            <div className="dg-up-head"><b>{u.name}</b><span className="dg-pips">{u.levels.map((_, i) => <i key={i} className={i <= lv ? 'on' : ''} />)}</span></div>
            <p className="dg-small">{u.line}</p>
            <p>Now <b>{u.levels[lv]}</b>{cost !== null && <> · next <b>{u.levels[lv + 1]}</b></>}</p>
            {cost !== null ? <button disabled={s.points < cost} onClick={() => buyUp(u.id)}>Upgrade · ✦ {cost}</button> : <button disabled>Best there is</button>}
          </div>; })}
        </div>
      </div>
    </section>}

    {screen === 'dive' && <section className="dg-hud">
      <div className="dg-gauge">
        <div className="dg-depth"><b ref={H('depth')}>0</b><small>m</small></div>
        <div className="dg-zone" ref={H('zone')}>The Twilight</div>
        <div className="dg-rating" ref={H('rating')} data-over="0">Hull rated to {d?.st.rating ?? st.rating} m</div>
      </div>
      <div className="dg-bars">
        <label className="dg-bar air"><span>Air <em ref={H('airT')} /></span><span className="dg-track"><i ref={H('air')} /></span></label>
        <label className="dg-bar hull"><span>Hull</span><span className="dg-track"><i ref={H('hull')} /></span></label>
        <label className="dg-bar sonar"><span>Sonar</span><span className="dg-track"><i ref={H('sonar')} /></span></label>
      </div>
      <div className="dg-tray" ref={H('tray')} data-n="0" aria-label="Sample tray">
        {Array.from({ length: d?.st.tray ?? st.tray }, (_, i) => { const id = d?.tray[i]; return <span key={i} className={id ? 'full' : ''} style={id ? { ['--glow' as string]: G.spec(id).glow } : undefined}>{id ? <img src={art(id)} alt={G.spec(id).name} /> : null}</span>; })}
      </div>
      {radio && <div className={`dg-radio ${radio.mood}`} key={radio.key}>
        <div className="dg-face"><img src={art('enzo-portrait')} alt="" /></div>
        <p><b>Enzo</b>{radio.text}</p>
      </div>}
      {!touch && <p className="dg-keys">Arrows or WASD steer · <b>Space</b> sonar · <b>L</b> lamp · <b>M</b> chart · Esc pause</p>}
      <div className="dg-topbtns">
        <button className="dg-lampb" ref={H('lampb')} data-on="1" onClick={() => taps.current.add('lamp')} aria-label="Lamp">💡</button>
        <button onClick={() => setShowMap(!showMap)} aria-label="Chart">🗺</button>
        <button onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      </div>
      {touch && <div className="dg-touchpad">
        <div className="dg-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
        <div className="dg-tbtns"><button className="t-ping" {...tb('ping')}>PING</button><button className="t-lamp" {...tb('lamp')}>LAMP</button></div>
      </div>}
      {showMap && <div className="dg-mapover" onClick={() => setShowMap(false)}>
        <div className="dg-mapbox"><canvas ref={mapRef} width={G.GW} height={G.GH} className="dg-map" />
          {d && <i className="dg-you" style={{ left: `${(d.x / (G.GW * G.CELL)) * 100}%`, top: `${(d.y / (G.GH * G.CELL)) * 100}%` }} />}
          {world().bells.filter((b) => d && d.mapped[Math.floor(b.y / G.CELL) * G.GW + Math.floor(b.x / G.CELL)]).map((b, i) => <i key={i} className="dg-bellmark" style={{ left: `${(b.x / (G.GW * G.CELL)) * 100}%`, top: `${(b.y / (G.GH * G.CELL)) * 100}%` }} />)}
        </div>
        <p className="dg-small">The chart fills in as you ping and light the walls. White dots are air bells. {touch ? 'Tap' : 'M or click'} to close.</p>
      </div>}
      {paused && <div className="dg-pause"><div className="dg-card dg-pausecard">
        <h2>Paused</h2>
        <button className="dg-go" onClick={() => setPaused(false)}>Keep diving</button>
        <button onClick={winchUp}>Winch me up (the tray floats away)</button>
      </div></div>}
    </section>}

    {screen === 'result' && result && <section className={`dg-page dg-result ${result.why === 'surfaced' ? 'good' : 'bad'}`}>
      <div className="dg-card dg-resultcard">
        <h2>{result.why === 'surfaced' ? 'Back aboard!' : result.why === 'air' ? 'Enzo winched you up' : 'Hull breach! Enzo winched you up'}</h2>
        <p>{result.why === 'surfaced' ? `Down to ${result.depth} m and home safe.` : `Down to ${result.depth} m. The samples floated away on the way up, but the chart is safe.`}</p>
        {result.tray.length > 0 && <ul className="dg-haul">{result.tray.map((id, i) => <li key={i} className={result.firsts.includes(id) && result.tray.indexOf(id) === i ? 'new' : ''}><img src={art(id)} alt="" /><span>{G.spec(id).name}</span>{result.firsts.includes(id) && result.tray.indexOf(id) === i && <em>New!</em>}</li>)}</ul>}
        <p className="dg-earned">✦ {result.earned} research{result.chart ? ` (${result.chart} for new chart)` : ''} · {Math.round(result.mapShare * 100)}% of the cave charted</p>
        <div className="dg-row"><button className="dg-go" onClick={() => { sfx()?.button(); setScreen('boat'); }}>To the boat ›</button>{result.firsts.length > 0 && <button onClick={() => go('journal')}>Open the journal</button>}</div>
      </div>
    </section>}

    {screen === 'journal' && <section className="dg-page">
      <header className="dg-head"><button className="dg-back" onClick={() => go('boat')}>‹ Boat</button><h2>Enzo’s journal</h2><span className="dg-points">{found}/{G.SPECIES.length} species</span></header>
      {G.ZONES.map((z) => <div key={z.id} className="dg-zoneblock"><h3>{z.name} <small>{z.from}–{Math.min(z.to, 1090)} m</small></h3>
        <div className="dg-cards">{G.SPECIES.filter((x) => x.zone === z.id).map((x) => { const n = s.journal[x.id] ?? 0; return <div key={x.id} className={`dg-card dg-spec${n ? '' : ' unknown'}`} data-spec={x.id}>
          <div className="dg-art"><img src={art(x.id)} alt={n ? x.name : 'Not found yet'} /></div>
          <div className="dg-spec-body"><b>{n ? x.name : '???'}</b><small>{n ? `${n} banked${x.shy ? ' · shy' : ''}` : x.shy ? 'Shy: try the lamp off' : 'Not found yet'}</small>{n > 0 && <p>{x.note}</p>}</div>
        </div>; })}</div></div>)}
    </section>}

    {screen === 'map' && <section className="dg-page dg-mappage">
      <header className="dg-head"><button className="dg-back" onClick={() => go('boat')}>‹ Boat</button><h2>The chart</h2><span className="dg-points">{Math.round(G.mappedShare(mappedRef.current, world()) * 100)}% charted</span></header>
      <div className="dg-mapbox"><canvas ref={mapRef} width={G.GW} height={G.GH} className="dg-map" />
        {world().bells.filter((b) => mappedRef.current[Math.floor(b.y / G.CELL) * G.GW + Math.floor(b.x / G.CELL)]).map((b, i) => <i key={i} className="dg-bellmark" style={{ left: `${(b.x / (G.GW * G.CELL)) * 100}%`, top: `${(b.y / (G.GH * G.CELL)) * 100}%` }} />)}
      </div>
      <p className="dg-small">Everything your sonar and lamp have touched. Enzo pays research for new chart: one point for every 480 m² of new cave.</p>
    </section>}

    {screen === 'ending' && <section className="dg-ending">
      <div className="dg-art dg-bg"><img src={art('ending')} alt="Dora and Enzo meet the lantern whale" /></div>
      <div className="dg-ending-text">
        <h2>The Lantern Whale</h2>
        <p>At the bottom of the trench, something enormous and made of light turns, slowly, to look at the little yellow sub. Its song fills the water. Enzo, listening on the radio far above, forgets to write anything down at all.</p>
        <p className="dg-small">{G.journalCount(s) < G.SPECIES.length ? `The journal has ${G.journalCount(s)} of ${G.SPECIES.length} species. There’s more to find down there.` : 'Every species in the journal, and the whale too. What a voyage.'}</p>
        <div className="dg-row"><button className="dg-go" onClick={() => go('boat')}>Back to the boat</button><button onClick={() => go('journal')}>The journal</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="dg-page">
      <header className="dg-head"><button className="dg-back" onClick={() => go('title')}>‹ Title</button><h2>How to dive</h2></header>
      <div className="dg-cols">
        <div className="dg-card"><h3>Steer and see</h3><ul><li><b>Arrows</b> or <b>WASD</b> steer the Thimble. On a touch screen, use the stick.</li><li><b>Space</b> (or <b>PING</b>) sends a sonar ping: the walls light up as the echo comes back, and the chart fills in.</li><li><b>L</b> (or <b>LAMP</b>) switches the headlamp on and off. <b>M</b> opens the chart.</li></ul></div>
        <div className="dg-card"><h3>Specimens</h3><ul><li>Drift into a creature <b>gently</b> to scoop it into the tray. Too fast and you miss.</li><li>Shy ones dart away from the lamp. Switch it off and creep up.</li><li>Bring the tray to the surface to bank it: new species are worth the most.</li></ul></div>
        <div className="dg-card"><h3>Stay safe</h3><ul><li>Air runs out: come up, or find an <b>air bell</b> (a silver pocket under the rock).</li><li>Past the hull’s rating it creaks and gives. Upgrade it to go deeper.</li><li>Purple veils sting. The <b>Grimlure</b> hunts pings and lamplight: go dark and back away.</li><li>Run out of air or hull and Enzo winches you up, but the tray floats away.</li></ul></div>
      </div>
    </section>}

    {screen === 'settings' && <section className="dg-page">
      <header className="dg-head"><button className="dg-back" onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="dg-card dg-settings">
        <div className="dg-set"><span>Sound</span><span className="dg-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="dg-set"><span>Music</span><span className="dg-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <p className="dg-small">{s.stats.dives} dives · {s.stats.banked} specimens banked · {s.stats.rescues} rescues · deepest {s.stats.deepest} m</p>
        <button className="dg-danger" onClick={() => { if (window.confirm('Start the expedition again from the beginning?')) { const n = G.newSave(); n.settings = s.settings; persist(n); mappedRef.current = G.unpackMap(''); } }}>Start over</button>
      </div>
    </section>}
  </main>;
}
