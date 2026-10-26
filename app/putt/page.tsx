'use client';

import { useEffect, useRef, useState } from 'react';
import { PuttGame, DT, SAVE_KEY, RUN_KEY, readProfile, ALL_HOLES, courseOf, HEROES, type CourseId, type HeroId, type Profile, type PuttEvent } from '@/lib/putt-game';
import type { PuttScene } from '@/lib/putt-scene';
import { PuttSound } from './sound';
import { Menu, Hud, Scorecard, Finale, type Players } from './ui';
import './putt.css';

type Banner = { text: string; sub?: string; big: boolean; id: number } | null;
const rosterOf = (p: Players): HeroId[] => (p === 'both' ? ['dora', 'enzo'] : [p]);

export default function PutteringPawsPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<PuttScene | null>(null), sound = useRef<PuttSound | null>(null);
  const game = useRef<PuttGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<'menu' | 'play'>('menu'), pausedRef = useRef(false), overviewRef = useRef(false);
  const keys = useRef(new Set<string>()), drag = useRef<{ id: number; x: number; z: number } | null>(null), savedRun = useRef('');
  const [screen, setScreen] = useState<'menu' | 'play'>('menu');
  const [players, setPlayers] = useState<Players>('dora');
  const [paused, setPaused] = useState(false), [overview, setOverview] = useState(false), [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false), [rendered, setRendered] = useState(false), [error, setError] = useState('');
  const [hasRun, setHasRun] = useState(false), [banner, setBanner] = useState<Banner>(null), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  function persistProfile() {
    const g = game.current; if (!g?.profileChanged) return;
    g.profileChanged = false; try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ }
  }
  function persistRun() {
    const g = game.current; if (!g || g.practice) return;
    if (g.mode === 'done') { if (savedRun.current !== 'done') { savedRun.current = 'done'; try { localStorage.removeItem(RUN_KEY); } catch { /* optional */ } setHasRun(false); } return; }
    const s = g.save(); if (!s || s === savedRun.current) return;
    savedRun.current = s; try { localStorage.setItem(RUN_KEY, s); } catch { /* optional */ }
  }
  const bannerId = useRef(0);
  function show(text: string, big: boolean, sub?: string) { const id = ++bannerId.current; setBanner({ text, sub, big, id }); setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), big ? 2300 : 1600); }
  function onEvent(e: PuttEvent, g: PuttGame) {
    sound.current?.cue(e);
    const name = e.who ? HEROES[e.who].name : '';
    if (e.kind === 'cup') show(e.label ?? 'In!', true, `${name} · ${e.strokes} ${e.strokes === 1 ? 'putt' : 'putts'}`);
    else if (e.kind === 'pickup') show('Picked up', false, 'Six putts is plenty. On to the next one!');
    else if (e.kind === 'splash') show('Splash!', false, 'One stroke added. Back to where you putted from.');
    else if (e.kind === 'acorn') show('Golden acorn!', false, `${profile.current.acorns.length} of ${ALL_HOLES.length} found`);
    else if (e.kind === 'lip') show('So close!', false);
    else if (e.kind === 'turn') show(`${name}'s turn`, false);
    void g;
  }

  // the renderer, the loop and the keyboard live for the whole visit; the menu just sits on top
  useEffect(() => {
    profile.current = (() => { try { return readProfile(localStorage.getItem(SAVE_KEY)); } catch { return readProfile(null); } })();
    try { setHasRun(!!PuttGame.load(localStorage.getItem(RUN_KEY), profile.current)); } catch { /* optional */ }
    sound.current = new PuttSound(); setMuted(sound.current.muted()); setReady(true);
    let stopped = false, raf = 0, last = 0, acc = 0, ui = 0;
    const surface = canvas.current;
    const lost = (e: Event) => { e.preventDefault(); setError('The course paused while the graphics reset. Reload to carry on; your round is saved.'); };
    surface?.addEventListener('webglcontextlost', lost);
    const down = (e: KeyboardEvent) => {
      if (screenRef.current !== 'play') return;
      const g = game.current; if (!g) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') { togglePause(); return; }
      if (pausedRef.current) return;
      keys.current.add(e.code); sound.current?.unlock();
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') { if (g.mode === 'card') next(); else if (g.mode === 'intro') g.skipIntro(); else if (g.mode === 'aim') g.putt(); }
      if (e.code === 'KeyV') { overviewRef.current = !overviewRef.current; setOverview(overviewRef.current); }
      if (e.code === 'KeyM') toggleSound();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); drag.current = null; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    const hide = () => { persistRun(); persistProfile(); };
    window.addEventListener('pagehide', hide);
    import('@/lib/putt-scene').then(({ createPuttScene }) => {
      if (stopped || !canvas.current) return;
      try { scene.current = createPuttScene(canvas.current, () => setRendered(true), setError); }
      catch (cause) { console.error('Puttering Paws renderer:', cause); setError('This course needs WebGL 2. Try a browser with 3D graphics turned on.'); return; }
      const loop = (now: number) => {
        if (stopped) return;
        const elapsed = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 0; last = now;
        const g = game.current;
        if (g && screenRef.current === 'play' && !document.hidden) {
          if (!pausedRef.current) {
            const k = keys.current;
            if (g.mode === 'aim' && !drag.current) {
              const fine = k.has('ShiftLeft') || k.has('ShiftRight') ? 0.25 : 1;
              const turn = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
              const push = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
              if (turn || push) g.setAim(g.aim.angle + turn * 1.3 * fine * elapsed, g.aim.power + push * 0.55 * fine * elapsed);
            }
            acc = Math.min(0.15, acc + elapsed);
            while (acc >= DT) { g.step(DT); acc -= DT; }
            const events = g.events.splice(0); for (const e of events) onEvent(e, g); scene.current?.feed(events);
            persistProfile(); persistRun();
          }
          scene.current?.draw(g, pausedRef.current ? 0 : Math.max(DT, elapsed), { overview: overviewRef.current, dragging: !!drag.current });
        }
        if (now - ui > 100) { refresh(); ui = now; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => { if (!stopped) setError('The course could not open. Reload to try again.'); });
    return () => {
      stopped = true; cancelAnimationFrame(raf); hide();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', hide);
      surface?.removeEventListener('webglcontextlost', lost); scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
  }, []);

  // test hook for the browser suite
  useEffect(() => {
    const w = window as unknown as { __putt?: () => unknown };
    w.__putt = () => ({ game: game.current, profile: profile.current, metrics: scene.current?.metrics(), screenPoint: (x: number, z: number) => scene.current?.screenPoint(x, z), refresh });
    return () => { delete w.__putt; };
  }, []);

  function begin(g: PuttGame) {
    game.current = g; savedRun.current = ''; overviewRef.current = false; setOverview(false); pausedRef.current = false; setPaused(false);
    screenRef.current = 'play'; setScreen('play'); sound.current?.unlock(); setBanner(null); refresh();
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }));
  }
  function startCourse(course: CourseId) { try { localStorage.removeItem(RUN_KEY); } catch { /* optional */ } setHasRun(false); begin(new PuttGame({ course, players: rosterOf(players), profile: profile.current })); }
  function resume() { let g: PuttGame | null = null; try { g = PuttGame.load(localStorage.getItem(RUN_KEY), profile.current); } catch { /* optional */ } if (g) begin(g); else setHasRun(false); }
  function practise(hole: string) { begin(new PuttGame({ hole, players: rosterOf(players), profile: profile.current })); }
  function next() { const g = game.current; if (!g) return; g.next(); refresh(); }
  function toMenu() { persistRun(); persistProfile(); const g = game.current; setHasRun(!!g && !g.practice && g.mode !== 'done'); game.current = null; screenRef.current = 'menu'; setScreen('menu'); pausedRef.current = false; setPaused(false); drag.current = null; }
  function togglePause() { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); keys.current.clear(); drag.current = null; }
  function toggleSound() { const s = sound.current; if (!s) return; s.setMuted(!s.muted()); setMuted(s.muted()); if (!s.muted()) s.unlock(); }
  function toggleOverview() { overviewRef.current = !overviewRef.current; setOverview(overviewRef.current); canvas.current?.focus({ preventScroll: true }); }

  // drag back from anywhere: the pull sets the aim (the opposite way) and the power
  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = game.current, s = scene.current; if (!g || !s || pausedRef.current) return;
    sound.current?.unlock();
    if (g.mode === 'intro') { g.skipIntro(); return; }
    if (g.mode !== 'aim' || drag.current) return;
    const p = s.groundPoint(e.clientX, e.clientY); if (!p) return;
    drag.current = { id: e.pointerId, x: p.x, z: p.z }; e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = game.current, s = scene.current, d = drag.current; if (!g || !s || !d || d.id !== e.pointerId) return;
    const p = s.groundPoint(e.clientX, e.clientY); if (!p) return;
    const dx = d.x - p.x, dz = d.z - p.z, len = Math.hypot(dx, dz);
    if (len > 0.12) g.setAim(Math.atan2(dz, dx), Math.min(1, (len - 0.12) / 3));
    else g.setAim(g.aim.angle, 0);
  }
  function pointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = game.current, d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (g && g.mode === 'aim' && g.aim.power >= 0.03) g.putt(); else if (g) g.setAim(g.aim.angle, Math.max(g.aim.power, 0.3));
  }

  const g = game.current;
  return <main className="putt-shell" data-ready={ready} data-rendered={rendered} data-screen={screen} data-mode={g?.mode ?? 'menu'}>
    <canvas ref={canvas} className="putt-canvas" tabIndex={0} aria-label="Mini-golf course. Drag back from the ball to aim, then let go to putt. Arrow keys aim and set power, Space putts."
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }} />
    {screen === 'play' && g && <Hud game={g} dragging={!!drag.current} overview={overview} muted={muted} onOverview={toggleOverview} onSound={toggleSound} onPause={togglePause} />}
    {screen === 'play' && g && banner && <div key={banner.id} className={`putt-banner${banner.big ? ' is-big' : ''}`} role="status"><strong>{banner.text}</strong>{banner.sub && <span>{banner.sub}</span>}</div>}
    {screen === 'play' && g && g.mode === 'card' && !paused && <Scorecard game={g} onNext={next} onMenu={toMenu} onAgain={() => practise(g.holeIds[0])} onPractise={practise} />}
    {screen === 'play' && g && g.mode === 'done' && !paused && <Finale game={g} profile={profile.current} onMenu={toMenu} onAgain={() => (g.practice ? practise(g.holeIds[0]) : startCourse(g.course!))} onLantern={() => startCourse('lantern')} />}
    {screen === 'play' && paused && <div className="putt-shade"><section className="putt-panel putt-pause" role="dialog" aria-label="Paused">
      <h2>Paused</h2><p>{g?.practice ? 'Practice hole' : 'Your round is saved whenever the ball is still.'}</p>
      <div className="putt-row"><button className="putt-primary" onClick={togglePause} autoFocus>Keep putting</button><button onClick={toMenu}>Clubhouse</button></div>
    </section></div>}
    {screen === 'menu' && <Menu profile={profile.current} players={players} setPlayers={setPlayers} hasRun={hasRun} muted={muted} onSound={toggleSound} onCourse={startCourse} onResume={resume} onPractise={practise} courseOf={courseOf} />}
    {error && <div className="putt-error" role="alert">{error}</div>}
  </main>;
}
