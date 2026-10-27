'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { RollGame, DT, SAVE_KEY, LEVELS, KINDS, HURRY, GOLDEN_TIME, readProfile, sizeLabel, sticksAt, type Profile, type RollEvent } from '@/lib/roll-game';
import type { RollScene } from '@/lib/roll-scene';
import { RollSound } from './sound';
import './roll.css';

type Banner = { text: string; sub?: string; big: boolean; id: number } | null;
const STICK = 70;
const clock = (left: number) => { const s = Math.ceil(left); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const a = (name: string) => (/^[aeiou]/i.test(name) ? `An ${name}` : `A ${name}`);

export default function FluffRollPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<RollScene | null>(null), sound = useRef<RollSound | null>(null);
  const game = useRef<RollGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<'menu' | 'play'>('menu'), pausedRef = useRef(false);
  const keys = useRef(new Set<string>()), pad = useRef<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const [screen, setScreen] = useState<'menu' | 'play'>('menu');
  const [paused, setPaused] = useState(false), [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false), [rendered, setRendered] = useState(false), [error, setError] = useState('');
  const [banner, setBanner] = useState<Banner>(null), [caught, setCaught] = useState(''), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  function persist() {
    const g = game.current; if (!g?.profileChanged) return;
    g.profileChanged = false; try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ }
  }
  const bannerId = useRef(0);
  function show(text: string, big: boolean, sub?: string) { const id = ++bannerId.current; setBanner({ text, sub, big, id }); setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), big ? 2400 : 1500); }
  const lastHint = useRef({ id: -1, at: -9 });
  function onEvent(e: RollEvent, g: RollGame) {
    let share = 0.2;
    if (e.kind === 'stick') { const t = g.things[e.id]; share = t.r / Math.max(e.at, 1e-4); setCaught(`${a(KINDS[t.kind].name)}!${e.streak >= 3 ? ` ×${e.streak}` : ''}`); }
    else if (e.kind === 'bump') {
      // say what was in the way and how big the ball has to be for it, once in a while
      const t = g.things[e.id], h = lastHint.current;
      if (h.id !== e.id || g.clock - h.at > 3) { lastHint.current = { id: e.id, at: g.clock }; setCaught(`Too big for now! ${a(KINDS[t.kind].name)} sticks at ${sizeLabel(sticksAt(t.r))}`); }
    }
    sound.current?.cue(e, share);
    if (e.kind === 'goal') show('Goal size!', true, `${sizeLabel(g.spec.goal)} of fluff. Keep rolling for stars!`);
    else if (e.kind === 'golden') show('A golden acorn!', true, `+${GOLDEN_TIME} seconds · ${e.found} of ${g.goldenTotal} found`);
    else if (e.kind === 'ready') { const names = e.kinds.map((k) => KINDS[k].plural); show(`Now you can roll up ${names.length > 2 ? `${names.slice(0, 2).join(', ')} and more` : names.join(' and ')}!`, false); }
    else if (e.kind === 'grow' && !g.reached) show(e.size, false);
    else if (e.kind === 'knock') show('Bonk!', false, 'A few things fell off. Roll them up again!');
    else if (e.kind === 'end') show(e.reached ? 'Time! What a fluffball!' : 'Time!', true);
  }

  useEffect(() => {
    profile.current = (() => { try { return readProfile(localStorage.getItem(SAVE_KEY)); } catch { return readProfile(null); } })();
    sound.current = new RollSound(); setMuted(sound.current.muted()); setReady(true);
    let stopped = false, raf = 0, last = 0, acc = 0, ui = 0;
    const surface = canvas.current;
    const lost = (e: Event) => { e.preventDefault(); setError('The meadow paused while the graphics reset. Reload to carry on.'); };
    surface?.addEventListener('webglcontextlost', lost);
    const down = (e: KeyboardEvent) => {
      if (screenRef.current !== 'play') return;
      const g = game.current; if (!g) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') { togglePause(); return; }
      if (pausedRef.current) return;
      keys.current.add(e.code); sound.current?.unlock();
      if (e.repeat) return;
      if ((e.code === 'Space' || e.code === 'Enter') && g.mode === 'intro') g.skipIntro();
      if (e.code === 'KeyM') toggleSound();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); pad.current = null; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    window.addEventListener('pagehide', persist);
    import('@/lib/roll-scene').then(({ createRollScene }) => {
      if (stopped || !canvas.current) return;
      try { scene.current = createRollScene(canvas.current, () => setRendered(true)); }
      catch (cause) { console.error('Fluff Roll renderer:', cause); setError('Fluff Roll needs WebGL 2. Try a browser with 3D graphics turned on.'); return; }
      const loop = (now: number) => {
        if (stopped) return;
        const elapsed = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 0; last = now;
        const g = game.current;
        if (g && screenRef.current === 'play' && !document.hidden) {
          if (!pausedRef.current) {
            acc = Math.min(0.15, acc + elapsed);
            while (acc >= DT) {
              const k = keys.current, p = pad.current;
              let turn = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
              let push = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
              if (p) { turn = Math.max(-1, Math.min(1, p.dx / STICK)); push = Math.max(-1, Math.min(1, -p.dy / STICK)); }
              g.steer(turn, push, DT); g.step(DT); acc -= DT;
            }
            const events = g.events.splice(0); for (const e of events) onEvent(e, g); scene.current?.feed(g, events);
            persist();
          }
          scene.current?.draw(g, pausedRef.current ? 0 : Math.max(DT, elapsed));
        }
        if (now - ui > 100) { refresh(); ui = now; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => { if (!stopped) setError('The meadow could not open. Reload to try again.'); });
    return () => {
      stopped = true; cancelAnimationFrame(raf); persist();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', persist);
      surface?.removeEventListener('webglcontextlost', lost); scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
  }, []);

  // test hook for the browser suite
  useEffect(() => {
    const w = window as unknown as { __roll?: () => unknown };
    w.__roll = () => ({ game: game.current, profile: profile.current, metrics: scene.current?.metrics(), refresh });
    return () => { delete w.__roll; };
  }, []);

  function start(level: string) {
    game.current = new RollGame({ level, profile: profile.current }); pausedRef.current = false; setPaused(false);
    screenRef.current = 'play'; setScreen('play'); sound.current?.unlock(); setBanner(null); setCaught(''); refresh();
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }));
  }
  function toMenu() { persist(); game.current = null; screenRef.current = 'menu'; setScreen('menu'); pausedRef.current = false; setPaused(false); pad.current = null; }
  function togglePause() { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); keys.current.clear(); pad.current = null; }
  function toggleSound() { const s = sound.current; if (!s) return; s.setMuted(!s.muted()); setMuted(s.muted()); if (!s.muted()) s.unlock(); }

  // a stick wherever the thumb lands: up rolls forward, sideways turns
  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = game.current; if (!g || pausedRef.current) return;
    sound.current?.unlock();
    if (g.mode === 'intro') g.skipIntro();
    if (pad.current) return;
    pad.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = pad.current; if (!p || p.id !== e.pointerId) return;
    let dx = e.clientX - p.x, dy = e.clientY - p.y; const len = Math.hypot(dx, dy);
    // past the rim, the stick's centre follows the thumb, so turning back is instant
    if (len > STICK) { p.x += (dx / len) * (len - STICK); p.y += (dy / len) * (len - STICK); dx = e.clientX - p.x; dy = e.clientY - p.y; }
    p.dx = dx; p.dy = dy;
  }
  function pointerUp(e: React.PointerEvent<HTMLCanvasElement>) { if (pad.current?.id === e.pointerId) pad.current = null; }

  const g = game.current, p = pad.current, nextUp = g?.nextUp();
  const level = g ? LEVELS.findIndex((l) => l.id === g.spec.id) : -1, next = level >= 0 ? LEVELS[level + 1] : undefined;
  return <main className="roll-shell" data-ready={ready} data-rendered={rendered} data-screen={screen} data-mode={g?.mode ?? 'menu'}>
    <canvas ref={canvas} className="roll-canvas" tabIndex={0} aria-label="The meadow. Drag anywhere like a joystick, or use the arrow keys: up rolls forward, left and right turn."
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pad.current = null; }} />
    {screen === 'play' && g && <>
      <div className="roll-hud">
        <div className="roll-card">
          <span className="roll-small">Fluffball</span>
          <strong className="roll-size">{sizeLabel(g.ball.r)}</strong>
          <span className="roll-small">goal {sizeLabel(g.spec.goal)}</span>
          <div className="roll-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (g.ball.r / g.spec.goal) * 100)}%` }} className={g.reached ? 'is-done' : ''} /></div>
          {nextUp && <span className="roll-next">Next up: {KINDS[nextUp.kind].plural} at {sizeLabel(nextUp.at)}</span>}
        </div>
        <div className={`roll-card roll-time${g.left <= HURRY && g.mode === 'roll' ? ' is-hurry' : ''}`}><span className="roll-small">Time</span><strong>{clock(g.left)}</strong></div>
        {g.goldenTotal > 0 && <div className="roll-card roll-gold" aria-label={`${g.goldens} of ${g.goldenTotal} golden acorns`}><span className="roll-small">Golden</span><strong>{g.goldens}/{g.goldenTotal}</strong></div>}
        <div className="roll-tools"><button onClick={toggleSound} aria-label={muted ? 'Sound off' : 'Sound on'}>{muted ? '🔇' : '🔊'}</button><button onClick={togglePause}>Pause</button></div>
      </div>
      {caught && g.mode === 'roll' && <div className="roll-caught" key={caught + g.stuck.length}>{caught}</div>}
      {g.mode === 'intro' && <div className="roll-intro"><h2>{g.spec.name}</h2><p>Make a fluffball <strong>{sizeLabel(g.spec.goal)}</strong> across in {Math.round(g.spec.time / 60)} minutes!</p><span>Tap or press Space</span></div>}
      {p && <div className="roll-pad" style={{ left: p.x, top: p.y }} aria-hidden="true"><i style={{ transform: `translate(${p.dx}px, ${p.dy}px)` }} /></div>}
    </>}
    {screen === 'play' && g && banner && <div key={banner.id} className={`roll-banner${banner.big ? ' is-big' : ''}`} role="status"><strong>{banner.text}</strong>{banner.sub && <span>{banner.sub}</span>}</div>}
    {screen === 'play' && g && g.mode === 'done' && !paused && <div className="roll-shade"><section className="roll-panel" aria-label="Level result">
      <h2>{g.reached ? 'What a fluffball!' : 'So close!'}</h2>
      <p className="roll-final">{sizeLabel(g.ball.r)}</p>
      <p className="roll-stars" aria-label={`${g.stars} of 3 stars`}>{[0, 1, 2].map((i) => <span key={i} className={i < g.stars ? 'is-on' : ''}>★</span>)}</p>
      <p>{g.stuck.length} things rolled up{g.reached ? '.' : `. The goal was ${sizeLabel(g.spec.goal)}; have another go!`}</p>
      <p className="roll-facts">Longest streak ×{g.bestStreak} · Golden acorns {g.goldens} of {g.goldenTotal}</p>
      {g.reached && next && <p className="roll-unlock">{next.name} is open!</p>}
      <div className="roll-row">
        {g.reached && next && <button className="roll-primary" onClick={() => start(next.id)} autoFocus>Next: {next.name}</button>}
        <button className={g.reached && next ? '' : 'roll-primary'} onClick={() => start(g.spec.id)} autoFocus={!(g.reached && next)}>Roll again</button>
        <button onClick={toMenu}>Levels</button>
      </div>
    </section></div>}
    {screen === 'play' && paused && <div className="roll-shade"><section className="roll-panel" role="dialog" aria-label="Paused">
      <h2>Paused</h2>
      <div className="roll-row"><button className="roll-primary" onClick={togglePause} autoFocus>Keep rolling</button><button onClick={toMenu}>Levels</button></div>
    </section></div>}
    {screen === 'menu' && <Menu profile={profile.current} muted={muted} onSound={toggleSound} onStart={start} />}
    {error && <div className="roll-error" role="alert">{error}</div>}
  </main>;
}

function Menu({ profile, muted, onSound, onStart }: { profile: Profile; muted: boolean; onSound: () => void; onStart: (id: string) => void }) {
  const kinds = Object.keys(KINDS).length;
  return <div className="roll-menu">
    <div className="roll-menu-top"><Link href="/" className="roll-back">← MAIN ARCADE</Link><button className="roll-chip" onClick={onSound}>{muted ? 'Sound off' : 'Sound on'}</button></div>
    <div className="roll-menu-panel">
      <span className="roll-eyebrow">DORA & ENZO</span>
      <h1>Fluff <em>Roll</em></h1>
      <p className="roll-lede">Dora’s dust bath has gone rolly-polly. Push the fluffball round the meadow: anything smaller than it sticks, and the bigger it gets, the bigger the things it can pick up. Enzo rides on top and calls out every catch.</p>
      <ol className="roll-levels">
        {LEVELS.map((l, i) => {
          const open = profile.unlocked.includes(l.id), stars = profile.stars[l.id] ?? 0, best = profile.best[l.id];
          return <li key={l.id} className={open ? '' : 'is-locked'}>
            <div><span className="roll-n">{i + 1}</span><h3>{l.name}</h3><p>{open ? l.blurb : `Reach the goal in ${LEVELS[i - 1]?.name} to open this one.`}</p></div>
            <dl><div><dt>Goal</dt><dd>{sizeLabel(l.goal)}</dd></div><div><dt>Time</dt><dd>{Math.round(l.time / 60)} min</dd></div><div><dt>Best</dt><dd>{best ? sizeLabel(best) : '–'}</dd></div><div><dt>Golden</dt><dd>{profile.golden[l.id] ?? 0}/{l.spawns.filter((s) => s.kind === 'golden').reduce((n, s) => n + s.n, 0)}</dd></div><div><dt>Stars</dt><dd className="roll-stars">{[0, 1, 2].map((s) => <span key={s} className={s < stars ? 'is-on' : ''}>★</span>)}</dd></div></dl>
            <button className="roll-primary" disabled={!open} onClick={() => onStart(l.id)} aria-label={open ? `Roll in ${l.name}` : 'Locked'}>{open ? 'Roll!' : 'Locked'}</button>
          </li>;
        })}
      </ol>
      <p className="roll-book">Fluffbook: <strong>{profile.found.length}</strong> of {kinds} kinds of things rolled up · {profile.rolled} things in all</p>
      <p className="roll-help">Drag anywhere like a joystick: up rolls forward, sideways turns. Or use the arrow keys (or WASD). A coral ring on the ground means too big for now: grow first, or a hard bump knocks a few things off. Critters scurry away, so chase them! Each golden acorn adds {GOLDEN_TIME} seconds. Esc pauses, M turns the sound off.</p>
    </div>
  </div>;
}
