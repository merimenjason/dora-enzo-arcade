'use client';
// Paperwing Post: the page. Input (the keyboard, a touch stick and Enzo's POST button, which a second player can take
// on Enter), the flight loop, the town map of the six flights, Enzo's workshop for folding new gliders, the welcome,
// the HUD (height, speed, the letters and pages, the knocks the glider can take, an arrow to the next window and
// Enzo's tips), results, the ending and the save. Rules in lib/glider-game.ts, drawing in lib/glider-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/glider-game';
import type { End, Flight, FlightEvent, FlightId, GliderId, Save } from '@/lib/glider-game';
import type { GliderScene } from '@/lib/glider-scene';
import { GliderSound, type SongId } from './sound';
import './glider.css';

type Screen = 'title' | 'map' | 'workshop' | 'fly' | 'result' | 'ending' | 'howto' | 'settings';
type Result = ReturnType<G.Flight['result']> & { id: FlightId; why: End; best: boolean; ending: boolean; opened: FlightId | null };

const art = (n: string) => `/art/glider/${n}.webp`;
const WHO = { dora: { name: 'Dora', art: 'dora' }, enzo: { name: 'Enzo', art: 'enzo' }, granny: { name: 'Granny Juniper', art: 'granny' } } as const;
type Who = keyof typeof WHO;
const INTRO: { who: Who; text: string }[] = [
  { who: 'enzo', text: 'Dora! The post office bicycle has a flat tyre, and it’s Granny Juniper’s birthday on Saturday. Half the town’s cards are stuck in the sorting room.' },
  { who: 'dora', text: 'Then we’ll take them by air. I folded the biggest paper glider in the world. You hold the satchel, I’ll fly.' },
  { who: 'enzo', text: 'A glider only comes down, though. The smoke from the chimneys is warm air: circle round in it and we’ll go back up. I’ll grab any loose pages too, to fold new gliders.' },
  { who: 'dora', text: 'And when the satchel’s empty, we glide home through the attic window. Hold on to your headphones!' },
];
// where each flight sits on the painted map (percent of its width and height)
const PINS: Record<FlightId, [number, number]> = { morning: [14, 40], market: [40, 47], river: [70, 63], tower: [32, 30], washing: [17, 66], birthday: [85, 12] };
const SONG: Record<FlightId, SongId> = { morning: 'morning', market: 'town', river: 'river', tower: 'town', washing: 'river', birthday: 'sunset' };
const WHY: Record<End, string> = { home: 'Home!', landed: 'Touched down', splash: 'Splash!', crumpled: 'Crumpled!' };
const WHY_LINE: Record<End, string> = {
  home: 'Back in through the attic window, light as a feather.',
  landed: 'Down in the street. Enzo walks the glider home.',
  splash: 'Into the river. The glider is soggy but the letters stayed dry in the satchel.',
  crumpled: 'One knock too many and the glider folded up like a fan.',
};
const STAT = (g: G.Glider) => ({ Speed: 1 - (g.drag - 0.0028) / 0.003, Float: 1 - (g.sink - 0.18) / 0.32, Turn: (g.turn - 1.3) / 1.4, Sturdy: (g.sturdy - 2.5) / 2.6 });
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const stars = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

/** Enzo's tip: what to do now, from where the glider is (keyboard words, then touch words) */
function tip(f: Flight, touch: boolean, first: boolean): string {
  const POST = touch ? 'POST' : 'Space', UP = touch ? 'pull the stick down' : 'press ↑';
  if (f.over) return '';
  if (f.nextTargetNear() >= 0) return `In reach! ${POST} and I’ll post it!`;
  if (f.speed < 7.5) return `Too slow, we’ll stall! Nose down to pick up speed.`;
  if (f.left === 0) return 'Satchel’s empty! Glide home through the blue ring at our attic window.';
  if (f.lift(f.x, f.y, f.z) > 0.8) return 'Warm air! Circle round in it to climb.';
  if (f.altitude < 7) return 'Getting low! Find some chimney smoke and circle in it.';
  if (first && f.t < 10) return `Steer with ${touch ? 'the stick' : '◀ ▶'} and follow the arrow to the gold ring.`;
  if (first && f.t < 20) return `${touch ? 'Push the stick up' : 'Press ↓'} to dive and go faster; ${UP} to climb, but it slows you down.`;
  return '';
}

export default function PaperwingPostPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GliderScene | null>(null);
  const soundRef = useRef<GliderSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const [pick, setPick] = useState<FlightId>('morning');
  const flightRef = useRef<Flight | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [intro, setIntro] = useState(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [touch, setTouch] = useState(false);
  const touchRef = useRef(false);
  const keys = useRef(new Set<string>());
  const postTap = useRef(false);
  const stick = useRef({ id: -1, x0: 0, y0: 0, sx: 0, sy: 0 });
  const reduced = useRef(false);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const last = useRef({ alt: -1, speed: -1, letters: -1, pages: -1, knocks: -1, arrowT: 0, tipT: 0 });

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
    soundRef.current = new GliderSound(s.settings.sound, s.settings.music);
    const open = [...G.LEVELS].reverse().find((l) => G.unlocked(s, l.id) && !s.best[l.id]?.stars) ?? G.LEVELS[0];
    setPick(open.id);
    let gone = false;
    void import('@/lib/glider-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      sceneRef.current = new m.GliderScene(canvasRef.current);
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
  const startFlight = useCallback((id: FlightId) => {
    sfx()?.unlock();
    const f = new G.Flight(G.level(id), saveRef.current.glider);
    flightRef.current = f; sceneRef.current?.setLevel(f);
    setPaused(false); setResult(null); postTap.current = false; stick.current = { id: -1, x0: 0, y0: 0, sx: 0, sy: 0 };
    last.current = { alt: -1, speed: -1, letters: -1, pages: -1, knocks: -1, arrowT: 0, tipT: 0 };
    sfx()?.launch(); setScreen('fly');
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
        case 'post': snd?.post(e.hit === 'perfect'); pop(e.hit === 'perfect' ? `Perfect! A letter for ${e.name}` : `Posted to ${e.name}`, 'good'); break;
        case 'nopost': snd?.nopost(); break;
        case 'page': snd?.page(e.n); pop(`A page! · ${e.n}`, 'page'); break;
        case 'lift': snd?.lift(); break;
        case 'stall': snd?.stall(); pop('Stall!', 'bad'); break;
        case 'bump': snd?.bump(); pop(e.left > 0 ? `Bump! ${e.left} more and it crumples` : 'Crumple!', 'bad'); break;
        case 'end': if (e.why === 'home') snd?.home(); else if (e.why === 'landed') snd?.landed(); else { if (e.why === 'splash') snd?.splash(); snd?.sad(); } break;
      }
    }
  }, []);

  const readInput = useCallback((): G.Input => {
    const k = keys.current, st = stick.current, inv = saveRef.current.settings.invert ? -1 : 1;
    const steer = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0) + st.sx;
    // up climbs and down dives (flipped in settings for flight-sim style); on the stick, pulling back climbs
    const pitch = ((k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0)) * inv - st.sy * inv;
    return { steer: Math.max(-1, Math.min(1, steer)), pitch: Math.max(-1, Math.min(1, pitch)), post: false };
  }, []);

  useEffect(() => {
    let raf = 0, prev = performance.now(), acc = 0, endT = 0, lastPost = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      const snd = sfx(); snd?.pump();
      const sc = sceneRef.current, f = flightRef.current;
      if (screenRef.current !== 'fly' || !f || !sc) return;
      const inp = readInput();
      if (!pausedRef.current && !f.over) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 8) {
          // a press is latched until a tick sees it, then let go for a tick
          const ti = { ...inp, post: false };
          if (postTap.current && !lastPost) { ti.post = true; postTap.current = false; }
          f.tick(ti); lastPost = ti.post;
          if (f.events.length) onEvents(f, f.events); acc -= G.DT; n++; if (f.over) break;
        }
        snd?.air(f.speed, f.bank);
      } else { acc = 0; snd?.quiet(); }
      if (f.over) { endT += dt; if (endT > 1.8) { endT = 0; finish(); return; } } else endT = 0;
      sc.render(f, pausedRef.current ? 0 : dt, reduced.current);
      drawHud(f, dt);
    };
    const drawHud = (f: Flight, dt: number) => {
      const h = hud.current, L = last.current;
      const alt = Math.max(0, Math.round(f.altitude));
      if (h.alt && L.alt !== alt) { L.alt = alt; h.alt.textContent = String(alt); if (h.altbar) h.altbar.style.transform = `scaleY(${Math.min(1, alt / 60)})`; }
      if (h.altbox) h.altbox.dataset.state = f.lift(f.x, f.y, f.z) > 0.8 ? 'up' : f.altitude < 7 ? 'low' : 'ok';
      const sp = Math.round(f.speed);
      if (h.speed && L.speed !== sp) { L.speed = sp; h.speed.textContent = String(sp); h.speed.parentElement!.dataset.slow = f.speed < 7.5 ? '1' : '0'; }
      const posted = f.delivered.length - f.left;
      if (h.letters && L.letters !== posted) { L.letters = posted; h.letters.textContent = `${posted}/${f.delivered.length}`; h.letters.parentElement!.dataset.done = f.left === 0 ? '1' : '0'; }
      if (h.pages && L.pages !== f.pages) { L.pages = f.pages; h.pages.textContent = `${f.pages}/${f.lv.pageGoal}`; h.pages.parentElement!.dataset.done = f.pages >= f.lv.pageGoal ? '1' : '0'; }
      const knocks = f.gl.sturdy - f.bumps;
      if (h.knocks && L.knocks !== knocks) { L.knocks = knocks; h.knocks.textContent = '✦'.repeat(Math.max(0, knocks)); }
      // the arrow to the next window (or home), turned to where it is from the way you're heading
      if (h.arrow && (L.arrowT -= dt) <= 0) {
        L.arrowT = 0.05; const i = f.nextTarget(), t = i >= 0 ? f.c.targets[i] : f.c.home;
        const a = Math.atan2(t.x - f.x, t.z - f.z) - f.yaw, dy = t.y - f.y;
        h.arrow.style.transform = `rotate(${(-a * 180) / Math.PI}deg)`;
        if (h.where) h.where.textContent = `${i >= 0 ? t.name : 'Home'} · ${Math.round(Math.hypot(t.x - f.x, t.z - f.z))} m${dy > 8 ? ' · above you' : dy < -16 ? ' · below' : ''}`;
        if (h.compass) h.compass.dataset.home = i < 0 ? '1' : '0';
      }
      if (h.tip && (L.tipT -= dt) <= 0) {
        L.tipT = 0.25; const t = saveRef.current.settings.tips ? tip(f, touchRef.current, f.lv.id === 'morning') : '';
        if (h.tip.textContent !== t) { h.tip.textContent = t; h.tip.dataset.on = t ? '1' : '0'; }
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
        if (/^(Arrow|Space|Enter|Numpad)/.test(e.code)) e.preventDefault();
        if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
        keys.current.add(e.code);
        // Enzo's button: Space or E, or Enter for a second player
        if (!e.repeat && (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Numpad0')) postTap.current = true;
      } else if (scr === 'map' && intro >= 0 && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); nextIntro(); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); stick.current = { id: -1, x0: 0, y0: 0, sx: 0, sy: 0 }; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  });
  // the touch stick: wherever a thumb goes down in the left part of the screen, dragged from there
  const stickEl = useRef<HTMLDivElement>(null);
  const stickMove = (x: number, y: number) => {
    const st = stick.current, R = 56, dx = Math.max(-R, Math.min(R, x - st.x0)), dy = Math.max(-R, Math.min(R, y - st.y0));
    st.sx = dx / R; st.sy = dy / R;
    const knob = stickEl.current?.querySelector('i') as HTMLElement | null; if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const stickHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault(); sfx()?.unlock(); const st = stick.current; if (st.id >= 0) return;
      st.id = e.pointerId; st.x0 = e.clientX; st.y0 = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const el = stickEl.current; if (el) { el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px`; el.dataset.on = '1'; }
      stickMove(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => { if (e.pointerId === stick.current.id) stickMove(e.clientX, e.clientY); },
    onPointerUp: (e: React.PointerEvent) => { if (e.pointerId !== stick.current.id) return; stick.current = { id: -1, x0: 0, y0: 0, sx: 0, sy: 0 }; if (stickEl.current) stickEl.current.dataset.on = '0'; },
    onPointerCancel: () => { stick.current = { id: -1, x0: 0, y0: 0, sx: 0, sy: 0 }; if (stickEl.current) stickEl.current.dataset.on = '0'; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

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
  const setSetting = (k: keyof Save['settings'], v: boolean) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s);
    if (k === 'sound') sfx()?.setSound(v); else if (k === 'music') sfx()?.setMusic(v);
  };
  const fold = (id: GliderId) => {
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    if (s.owned.includes(id)) { s.glider = id; sfx()?.button(); persist(s); return; }
    if (G.buy(s, id)) { sfx()?.fold(); persist(s); }
  };
  const quit = () => { setPaused(false); flightRef.current = null; sfx()?.quiet(); setScreen('map'); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __glider: () => unknown }).__glider = () => {
      const f = flightRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, result, intro, pick,
        flight: f && screenRef.current === 'fly' ? { lv: f.lv.id, x: f.x, y: f.y, z: f.z, yaw: f.yaw, alt: f.altitude, speed: f.speed, pitch: f.pitch, bank: f.bank, posted: f.delivered.filter(Boolean).length, letters: f.delivered.length, pages: f.pages, bumps: f.bumps, over: f.over, why: f.why, t: f.t, glider: f.gl.id } : null,
        debug: {
          /** put the glider next to window `i` (or home with -1), facing it, at its height */
          window: (i: number) => { if (!f) return; const t = i >= 0 ? f.c.targets[i] : f.c.home; f.x = t.x + t.nx * 12; f.z = t.z + t.nz * 12; f.y = t.y + 1; f.yaw = Math.atan2(-t.nx, -t.nz); f.speed = 11; f.pitch = 0; },
          /** post every letter */
          postAll: () => { if (!f) return; f.delivered = f.delivered.map(() => true); },
          place: (x: number, y: number, z: number, yaw: number) => { if (!f) return; f.x = x; f.y = y; f.z = z; f.yaw = yaw; },
          paper: (n: number) => { const s = { ...saveRef.current, paper: n }; persist(s); },
          finish: (ids: FlightId[], st = 1) => { const s = JSON.parse(G.serialise(saveRef.current)) as Save; for (const id of ids) s.best[id] = { points: 1000, stars: st }; persist(s); },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, lv = G.level(pick), open = G.unlocked(s, pick), best = s.best[pick], gl = G.glider(s.glider);
  return <main className={`pw-shell pw-on-${screen}${touch ? ' pw-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <canvas ref={canvasRef} className="pw-canvas" aria-label="Paperwing Post: the town from the glider" />

    {screen === 'title' && <section className="pw-title">
      <div className="pw-art pw-bg"><img src={art('title')} alt="" /></div>
      <div className="pw-title-col">
        <h1 className="pw-logo">Paperwing <span>Post</span></h1>
        <p className="pw-tag">Dora flies, Enzo posts. Ride the warm air over the chimneys and deliver the whole town’s letters by paper glider.</p>
        <div className="pw-menu">
          <button className="pw-go" onClick={toMap}>{s.stats.flights ? 'Back to the map' : 'Let’s fly'}</button>
          <button onClick={() => go('howto')}>How to fly</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        <a className="pw-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'map' && <section className="pw-page pw-map">
      <header className="pw-head">
        <button className="pw-back" onClick={() => go('title')}>‹ Title</button>
        <h2>The town’s post</h2>
        <button onClick={() => go('workshop')}>Workshop · {s.paper} pages</button>
        <span className="pw-count">{G.totalStars(s)}/{G.LEVELS.length * 3} ★</span>
      </header>
      {intro >= 0 && <div className="pw-talk" onClick={nextIntro} role="button" tabIndex={0}>
        <div className="pw-face"><img src={art(WHO[INTRO[intro].who].art)} alt={WHO[INTRO[intro].who].name} /></div>
        <div className="pw-talk-text"><b>{WHO[INTRO[intro].who].name}</b><p>{INTRO[intro].text}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
      </div>}
      <div className="pw-mapwrap">
        <div className="pw-art pw-mapart"><img src={art('map')} alt="A painted map of the town, from the river and the clock tower to the cottage on the far hill" /></div>
        {G.LEVELS.map((l) => { const op = G.unlocked(s, l.id), b = s.best[l.id]; return <button key={l.id} className={`pw-pin${pick === l.id ? ' on' : ''}${op ? '' : ' locked'}${b?.stars ? ' done' : ''}`} style={{ left: `${PINS[l.id][0]}%`, top: `${PINS[l.id][1]}%` }} onClick={() => { sfx()?.button(); setPick(l.id); }} data-flight={l.id} aria-label={`${l.n}. ${l.name}${op ? '' : ' (locked)'}`}>
          <b>{l.n}</b>{b && <i>{stars(b.stars)}</i>}
        </button>; })}
      </div>
      <div className="pw-flightbox pw-card">
        <div className="pw-flighthead">{pick === 'birthday' && <div className="pw-face"><img src={art('granny')} alt="Granny Juniper" /></div>}<div><h3>{lv.n}. {lv.name}</h3><small>{lv.letters.length + (lv.tower ? 1 : 0)} letters · {gl.name}</small></div></div>
        <p>{lv.line}</p>
        <ul className="pw-goals">
          <li className={best?.stars ? 'done' : ''}><i>{best?.stars ? '★' : '☆'}</i>Post every letter</li>
          <li className={best && best.stars >= 2 ? 'done' : ''}><i>{best && best.stars >= 2 ? '★' : '☆'}</i>And catch {lv.pageGoal} loose pages</li>
          <li className={best && best.stars >= 3 ? 'done' : ''}><i>{best && best.stars >= 3 ? '★' : '☆'}</i>And glide home through the attic window</li>
        </ul>
        <div className="pw-row">
          <button className="pw-go" disabled={!open || intro >= 0 || !ready} onClick={() => startFlight(pick)}>{!ready ? 'Loading…' : open ? 'Fly!' : 'Locked'}</button>
          {best && <span className="pw-small">Best {fmt(best.points)} · {stars(best.stars)}</span>}
        </div>
        {!open && <p className="pw-small">Post every letter on the flight before this one to open it.</p>}
      </div>
    </section>}

    {screen === 'workshop' && <section className="pw-page pw-workshop">
      <div className="pw-art pw-bg"><img src={art('workshop')} alt="" /></div>
      <header className="pw-head">
        <button className="pw-back" onClick={() => go('map')}>‹ Map</button>
        <h2>Enzo’s workshop</h2>
        <span className="pw-count">{s.paper} pages</span>
      </header>
      <p className="pw-note pw-card">Every page you catch comes home to the workshop. Enzo folds them into new gliders.</p>
      <div className="pw-gliders">
        {G.GLIDERS.map((g) => { const own = s.owned.includes(g.id), on = s.glider === g.id, st = STAT(g); return <div key={g.id} className={`pw-card pw-glider${on ? ' on' : ''}`} data-glider={g.id}>
          <img src={art(`glider-${g.id}`)} alt="" />
          <h3>{g.name}</h3><p>{g.line}</p>
          <dl>{Object.entries(st).map(([k, v]) => <div key={k}><dt>{k}</dt><dd><i style={{ width: `${Math.round(20 + Math.max(0, Math.min(1, v)) * 80)}%` }} /></dd></div>)}</dl>
          <button className={on ? '' : 'pw-go'} disabled={on || (!own && s.paper < g.cost)} onClick={() => fold(g.id)}>{on ? 'Flying this one' : own ? 'Fly this one' : `Fold it · ${g.cost} pages`}</button>
        </div>; })}
      </div>
    </section>}

    {screen === 'fly' && flightRef.current && <section className="pw-hud">
      <div className="pw-alt" ref={H('altbox')} data-state="ok" title="Height over what's below">
        <div className="pw-altbar"><i ref={H('altbar')} /></div>
        <div><b ref={H('alt')}>0</b><small>m up</small><span className="pw-speed" data-slow="0"><b ref={H('speed')}>0</b><small>m/s</small></span></div>
      </div>
      <div className="pw-compass" ref={H('compass')} data-home="0"><i ref={H('arrow')} /><span ref={H('where')} /></div>
      <div className="pw-top">
        <span className="pw-chip" data-done="0" title="Letters posted"><i className="pw-env" /><b ref={H('letters')}>0</b></span>
        <span className="pw-chip" data-done="0" title="Pages caught"><i className="pw-pg" /><b ref={H('pages')}>0</b></span>
        <span className="pw-chip pw-knocks" title="Knocks the glider can take"><b ref={H('knocks')} /></span>
        <button onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      </div>
      <div className="pw-pop" ref={H('pop')} />
      <div className="pw-tip" ref={H('tip')} data-on="0" aria-live="polite" />
      {!touch && <p className="pw-keys"><b>◀ ▶</b> steer · <b>↑</b> climb · <b>↓</b> dive · <b>Space</b> post · Enter: Enzo for player 2 · Esc pause</p>}
      {touch && <div className="pw-touchpad">
        <div className="pw-stickzone" {...stickHandlers} aria-label="Steering stick: drag to steer, down to climb, up to dive" />
        <div className="pw-stick" ref={stickEl} data-on="0" aria-hidden="true"><i /></div>
        <button className="t-post" onPointerDown={(e) => { e.preventDefault(); sfx()?.unlock(); postTap.current = true; }} onContextMenu={(e) => e.preventDefault()}>POST</button>
      </div>}
      {paused && <div className="pw-pause"><div className="pw-card pw-pausecard">
        <h2>Paused</h2>
        <button className="pw-go" onClick={() => setPaused(false)}>Keep flying</button>
        <button onClick={() => startFlight(flightRef.current!.lv.id)}>Start the flight again</button>
        <button onClick={() => setSetting('tips', !s.settings.tips)}>Enzo’s tips: {s.settings.tips ? 'on' : 'off'}</button>
        <button onClick={quit}>Back to the map (nothing saved)</button>
      </div></div>}
    </section>}

    {screen === 'result' && result && <section className="pw-page pw-result">
      <div className="pw-card pw-resultcard">
        <h2>{result.all && result.why !== 'home' ? 'Every letter posted!' : WHY[result.why]}</h2>
        <p className="pw-stars" aria-label={`${result.stars} stars`}>{stars(result.stars)}</p>
        <p>{WHY_LINE[result.why]}</p>
        <table className="pw-tally"><tbody>
          <tr><td>Letters ({result.posted}, {result.perfect} perfect)</td><td>{fmt(result.posted * 200 + result.perfect * 100)}</td></tr>
          <tr><td>Pages ({result.pages})</td><td>{fmt(result.pages * 25)}</td></tr>
          <tr><td>{result.home ? 'Home through the window' : 'Soft landing'}</td><td>{fmt(result.landing)}</td></tr>
          <tr className="pw-total"><td>Total</td><td>{fmt(result.points)}{result.best && <em> New best!</em>}</td></tr>
        </tbody></table>
        {!result.all && <p className="pw-small">{result.posted === 0 ? 'No letters posted this time.' : 'Some letters are still in the satchel.'} Post them all for the first star.</p>}
        {result.opened && <p className="pw-open">{G.level(result.opened).name} is open!</p>}
        <div className="pw-row">
          {result.ending ? <button className="pw-go" onClick={() => go('ending')}>Granny’s window ›</button>
            : result.opened ? <button className="pw-go" onClick={() => startFlight(result.opened!)}>Next flight ›</button>
            : <button className="pw-go" onClick={() => startFlight(result.id)}>Fly it again</button>}
          {(result.opened || result.ending) && <button onClick={() => startFlight(result.id)}>Again</button>}
          <button onClick={() => go('map')}>Map</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="pw-ending">
      <div className="pw-art pw-bg"><img src={art('ending')} alt="Dora and Enzo on their paper glider at Granny Juniper's round window at sunset, as she holds up a bundle of cards" /></div>
      <div className="pw-ending-text">
        <h2>Happy birthday, Granny Juniper</h2>
        <p>The last card sails in through the round window just as the sun goes down. Granny Juniper laughs, gathers up the whole town’s cards in her shawl, and declares it the best birthday post she has ever had. Then she puts the kettle on, and Dora and Enzo stay for cake.</p>
        <p className="pw-small">{G.totalStars(s) < G.LEVELS.length * 3 ? `${G.totalStars(s)} of ${G.LEVELS.length * 3} stars. There are pages still blowing about town.` : 'Every star on every flight. The finest post in town.'}</p>
        <div className="pw-row"><button className="pw-go" onClick={() => go('map')}>Back to the map</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="pw-page">
      <header className="pw-head"><button className="pw-back" onClick={() => go('title')}>‹ Title</button><h2>How to fly</h2></header>
      <div className="pw-cols">
        <div className="pw-card"><h3>Flying</h3><ul><li>Steer with <b>◀ ▶</b> (or <b>A D</b>). On a phone, drag the stick anywhere on the left.</li><li><b>↓</b> dives: you go faster but lose height. <b>↑</b> climbs, but only while you have speed. Too slow and the glider stalls and drops its nose.</li><li>Prefer flight-sim controls? Flip up and down in Settings.</li></ul></div>
        <div className="pw-card"><h3>Warm air</h3><ul><li>A glider always sinks. Smoke from a chimney shows warm air rising: circle round in it to climb. The bakery’s is the warmest.</li><li>Sunny squares lift you too, in a wide gentle column.</li><li>Knocks on walls and roofs crumple the glider a little. Too many and it folds up.</li></ul></div>
        <div className="pw-card"><h3>The post</h3><ul><li>Follow the arrow to a gold ring at a window. When it’s in reach, press <b>Space</b> (or <b>POST</b>) and Enzo throws the letter in. Close and level is perfect.</li><li>A second player can be Enzo and post with <b>Enter</b>.</li><li>Catch loose pages by flying through them: they fold new gliders in the workshop. Glide home through the blue ring at the attic window for the last star.</li></ul></div>
      </div>
    </section>}

    {screen === 'settings' && <section className="pw-page">
      <header className="pw-head"><button className="pw-back" onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="pw-card pw-settings">
        {(['sound', 'music', 'tips', 'invert'] as const).map((k) => <div className="pw-set" key={k}><span>{k === 'tips' ? 'Enzo’s tips' : k === 'invert' ? 'Flip up and down (↓ climbs)' : k === 'sound' ? 'Sound' : 'Music'}</span><span className="pw-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings[k] === v ? 'on' : ''} onClick={() => setSetting(k, v)}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <p className="pw-small">{s.stats.flights} flights · {s.stats.letters} letters posted · {s.stats.pages} pages caught · {s.stats.home} times home</p>
        <button className="pw-danger" onClick={() => { if (window.confirm('Start Paperwing Post again from the beginning?')) { const n = G.newSave(); n.settings = s.settings; persist(n); setPick('morning'); } }}>Start over</button>
      </div>
    </section>}
  </main>;
}
