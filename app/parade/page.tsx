'use client';

import { useEffect, useRef, useState } from 'react';
import { ParadeGame, LEVELS, WORLDS, JOBS, JOB_INFO, TPS, SAVE_KEY, readProfile, record, unlocked, totalStars, type Job, type Profile, type Result } from '@/lib/parade-game';
import type { ParadeScene } from '@/lib/parade-scene';
import { ParadeSound } from './sound';
import './parade.css';

type Screen = 'menu' | 'brief' | 'play' | 'results';
const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const JOB_KEYS: Record<string, Job> = Object.fromEntries(JOBS.map((j) => [JOB_INFO[j].key, j]));

/** The painting can fail to load before the page hydrates, when onError is not listening yet, so check once on mount too. */
const hideIfBroken = (el: HTMLImageElement | null) => { if (el && el.complete && !el.naturalWidth) el.style.display = 'none'; };

export default function KitParadePage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<ParadeScene | null>(null), sound = useRef<ParadeSound | null>(null);
  const game = useRef<ParadeGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), fastRef = useRef(false), jobRef = useRef<Job | null>(null), hoverRef = useRef(-1);
  const [screen, setScreenState] = useState<Screen>('menu');
  const [world, setWorld] = useState(0), [levelIdx, setLevelIdx] = useState(0);
  const [paused, setPaused] = useState(false), [fast, setFast] = useState(false), [job, setJobState] = useState<Job | null>(null);
  const [muted, setMuted] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [result, setResultState] = useState<(Result & { news: string[] }) | null>(null), [, setTick] = useState(0);
  const resultRef = useRef<(Result & { news: string[] }) | null>(null);
  const setResult = (r: (Result & { news: string[] }) | null) => { resultRef.current = r; setResultState(r); };
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const setJob = (j: Job | null) => { jobRef.current = j; setJobState(j); };
  const P = profile.current;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const snd = () => { sound.current ??= new ParadeSound(); sound.current.unlock(); return sound.current; };

  /** Opens a level behind its little briefing card, so the player can look it over first. */
  function brief(i: number) {
    if (!unlocked(profile.current, i)) return;
    setLevelIdx(i); setWorld(LEVELS[i].world); profile.current.level = i; save();
    game.current = new ParadeGame(i); scene.current?.fit(game.current);
    pausedRef.current = true; setPaused(false); setResult(null); setScreen('brief'); snd().play('select');
  }
  // the key handler keeps the first render's levelIdx, so the briefed game is the source of truth
  function start(i = game.current?.index ?? levelIdx) {
    if (!unlocked(profile.current, i)) return;
    setLevelIdx(i); setWorld(LEVELS[i].world);
    const fresh = !game.current || game.current.index !== i || game.current.tick > 0;
    if (fresh) { game.current = new ParadeGame(i); scene.current?.fit(game.current); }
    const first = JOBS.find((j) => (LEVELS[i].jobs[j] ?? 0) > 0) ?? null;
    setJob(first); pausedRef.current = false; setPaused(false); setResult(null); setScreen('play');
    snd(); canvas.current?.focus();
  }
  /** "Call them all home": Mum gathers everyone up and the parade starts again. */
  function restart() { const i = game.current?.index ?? levelIdx; game.current = null; start(i); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || game.current.state !== 'play') return;
    pausedRef.current = on; setPaused(on);
    if (!on) canvas.current?.focus();
  }
  function toggleFast() { fastRef.current = !fastRef.current; setFast(fastRef.current); snd().play('tap'); }
  function finish(g: ParadeGame) {
    const r = g.result(), news = record(profile.current, r); save();
    setResult({ ...r, news }); setScreen('results');
    sound.current?.play(r.cleared ? 'win' : 'short');
  }
  function pickJob(j: Job) {
    const g = game.current; if (!g || (g.left[j] ?? 0) <= 0) return;
    setJob(j); snd().play('select');
  }
  /** Gives the chosen job to the kit under a point on the screen (CSS pixels on the canvas). */
  function tapAt(sx: number, sy: number, touch: boolean) {
    const g = game.current, sc = scene.current, j = jobRef.current; if (!g || !sc || screenRef.current !== 'play' || !j) return;
    const w = sc.toWorld(sx, sy), r = Math.max(12, (touch ? 34 : 22) / sc.scale);
    const k = g.kitAt(w.x, w.y, j, r);
    if (k >= 0 && g.assign(k, j)) { if (g.left[j] === 0) { const next = JOBS.find((x) => g.left[x] > 0); if (next && next !== j) setJob(next); } refresh(); }
    else sound.current?.play('shrug');
  }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const p = profile.current; setLevelIdx(p.level); setWorld(LEVELS[p.level].world); setMuted(p.muted);
    sound.current = new ParadeSound(); sound.current.setMuted(p.muted);
    const W = window as unknown as { __parade: () => ParadeGame | null; __paradeStart: (i: number) => void; __paradeScene: () => ParadeScene | null };
    W.__parade = () => game.current;
    W.__paradeScene = () => scene.current;
    W.__paradeStart = (i) => { brief(i); start(i); };
    let dead = false, raf = 0, last = 0, ui = 0, acc = 0;
    const resize = () => { scene.current?.resize(); if (game.current) scene.current?.fit(game.current, false); };
    import('@/lib/parade-scene').then(({ ParadeScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new ParadeScene(canvas.current); } catch { setError('This browser cannot draw the parade.'); return; }
      window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, scr = screenRef.current;
        let alpha = 1;
        if (g && scr === 'play' && !pausedRef.current && g.state === 'play') {
          acc += dt * (fastRef.current ? 3 : 1);
          let n = 0;
          while (acc >= 1 / TPS && n < 12 && g.state === 'play') {
            g.step(); acc -= 1 / TPS; n++;
            const ev = g.events.splice(0);
            if (ev.length) { sc.feed(ev, g); for (const e of ev) if (e.kind !== 'turn' && e.kind !== 'land') sound.current?.play(e.kind); }
          }
          if (g.state !== 'play') { acc = 0; const done = g; setTimeout(() => { if (game.current === done && screenRef.current === 'play') finish(done); }, 1200); }
          alpha = Math.min(1, acc * TPS);
        } else acc = 0;
        // keep the hovered kit fresh as kits walk under a still mouse
        sc.draw(scr === 'menu' ? null : g, alpha, dt, { hover: scr === 'play' ? hoverRef.current : -1, job: jobRef.current, canHover: true });
        if (ms - ui > 120) { ui = ms; refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The parade could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), scr = screenRef.current, g = game.current;
      if (scr === 'play' && g) {
        if (JOB_KEYS[k]) { pickJob(JOB_KEYS[k]); return; }
        if ((k === ' ' || k === 'p' || k === 'escape') && !e.repeat) { e.preventDefault(); pause(!pausedRef.current); return; }
        if (k === 'f' && !e.repeat) { toggleFast(); return; }
        if (k === 'r' && pausedRef.current) { restart(); return; }
        const pan = { arrowleft: [24, 0], a: [24, 0], arrowright: [-24, 0], d: [-24, 0], arrowup: [0, 24], w: [0, 24], arrowdown: [0, -24], s: [0, -24] }[k];
        if (pan && scene.current) { e.preventDefault(); scene.current.pan(g, pan[0], pan[1]); }
        return;
      }
      if (scr === 'brief' && (k === 'enter' || k === ' ')) { e.preventDefault(); start(); }
      else if (scr === 'brief' && k === 'escape') setScreen('menu');
      else if (scr === 'results' && !e.repeat) { if (k === 'r') restart(); else if (k === 'escape') setScreen('menu'); else if (k === 'enter') next(); }
    };
    const blur = () => { if (screenRef.current === 'play') pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('blur', blur);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function next() {
    const r = resultRef.current; if (!r) return;
    const i = LEVELS.findIndex((l) => l.id === r.level);
    if (r.cleared && i + 1 < LEVELS.length && unlocked(profile.current, i + 1)) brief(i + 1); else brief(i);
  }

  // pointer: a tap gives a job, a drag pans a big level, and a mouse hovering shows who would get it
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const local = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play') return;
    const p = local(e); drag.current = { id: e.pointerId, x: p.x, y: p.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = game.current, sc = scene.current; if (!g || !sc || screenRef.current !== 'play') return;
    const p = local(e), d = drag.current;
    if (d && d.id === e.pointerId) {
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 8 && sc.pannable(g)) d.moved = true;
      if (d.moved) { sc.pan(g, p.x - d.x, p.y - d.y); d.x = p.x; d.y = p.y; }
    }
    if (e.pointerType === 'mouse') { const w = sc.toWorld(p.x, p.y); hoverRef.current = g.kitAt(w.x, w.y, jobRef.current ?? undefined, Math.max(12, 22 / sc.scale)); }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return; drag.current = null;
    if (!d.moved) { const p = local(e); tapAt(p.x, p.y, e.pointerType !== 'mouse'); }
  };

  const g = game.current, L = LEVELS[levelIdx], stars = totalStars(P), playing = (screen === 'play' || screen === 'brief') && g;
  const out = g ? g.kits.filter((k) => k.state !== 'home' && k.state !== 'carried').length : 0;
  const timeLeft = g ? Math.max(0, g.level.time - g.tick / TPS) : 0;
  const worldStars = (w: number) => LEVELS.reduce((a, l) => a + (l.world === w ? P.best[l.id]?.stars ?? 0 : 0), 0);
  return (
    <main className="parade-shell" data-ready={ready ? 'true' : undefined} data-screen={screen} data-world={WORLDS[world].id}>
      <canvas ref={canvas} className="parade-canvas" tabIndex={0} aria-label="Kit Parade level. Pick a job with the buttons or keys 1 to 8, then click or tap a kit to give it the job. Drag or use the arrow keys to look around; Space to pause; F to go faster."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => { hoverRef.current = -1; }} />
      {error && <div className="parade-panel parade-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="parade-menu" aria-label="Level select">
          <header className="parade-head">
            <a href="/" className="parade-back">← ARCADE</a>
            <button className="parade-chip" aria-pressed={!muted} onClick={() => { const s = snd(); s.setMuted(!s.muted); P.muted = s.muted; setMuted(s.muted); save(); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
          </header>
          <div className="parade-title">
            <img src="/art/parade/title.webp" alt="" width={1600} height={1000} ref={hideIfBroken} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="parade-eyebrow">A PUZZLE PARADE OF BABY CHINCHILLAS</p>
              <h1>Kit <em>Parade</em></h1>
              <p className="parade-sub">The kits march on and on. Hand out jobs so everyone gets home to Dora and Enzo.</p>
            </div>
            <p className="parade-stars-total" aria-label={`${stars} of ${LEVELS.length * 3} stars`}>{stars} / {LEVELS.length * 3} ★</p>
          </div>
          <nav className="parade-worlds" aria-label="Worlds">
            {WORLDS.map((wd, w) => (
              <button key={wd.id} className={'parade-world' + (w === world ? ' is-on' : '')} aria-pressed={w === world} style={{ '--world': wd.color } as React.CSSProperties} onClick={() => { setWorld(w); snd().play('select'); }}>
                <b>{wd.name}</b><small>{worldStars(w)} / {LEVELS.filter((l) => l.world === w).length * 3} ★</small>
              </button>
            ))}
          </nav>
          <p className="parade-world-blurb">{WORLDS[world].blurb}</p>
          <ol className="parade-levels">
            {LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.world === world).map(({ l, i }) => {
              const open = unlocked(P, i), b = P.best[l.id];
              return (
                <li key={l.id}>
                  <button className={'parade-level' + (i === levelIdx ? ' is-on' : '')} disabled={!open} onClick={() => brief(i)} style={{ '--world': WORLDS[l.world].color } as React.CSSProperties}>
                    <span className="parade-num">{i + 1}</span>
                    <span className="parade-level-body"><strong>{open ? l.name : 'Locked'}</strong><small>{open ? `${l.need} of ${l.kits} kits home` : `Clear level ${i} to open`}</small></span>
                    <span className={'parade-best' + (b?.stars ? ' got' : '')} aria-label={`${b?.stars ?? 0} stars`}>{open ? STARS(b?.stars ?? 0) : '🔒'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="parade-how">Pick a job (keys <b>1–8</b>), then click a kit · <b>Space</b> pauses · <b>F</b> goes faster · drag or arrow keys to look around · on a phone, tap near a kit</p>
        </section>
      )}

      {screen === 'brief' && g && (
        <div className="parade-panel parade-brief" role="dialog" aria-label={L.name}>
          <p className="parade-eyebrow">{WORLDS[L.world].name} · Level {levelIdx + 1}</p>
          <h2>{L.name}</h2>
          <p className="parade-hint">{L.hint}</p>
          <p className="parade-goal">Bring home <b>{L.need}</b> of <b>{L.kits}</b> kits</p>
          <ul className="parade-jobs-list">
            {JOBS.filter((j) => L.jobs[j]).map((j) => <li key={j} title={JOB_INFO[j].tip}><span>{JOB_INFO[j].icon}</span> {JOB_INFO[j].name} ×{L.jobs[j]}</li>)}
            {!JOBS.some((j) => L.jobs[j]) && <li>No jobs needed. Just watch!</li>}
          </ul>
          <p className="parade-par">For ★★★: use {L.par.jobs === 0 ? 'no jobs' : `at most ${L.par.jobs} job${L.par.jobs === 1 ? '' : 's'}`} and have everyone home by {clock(L.par.time)}.</p>
          <div className="parade-row"><button className="parade-go" onClick={() => start()}>Let’s go! →</button><button onClick={() => setScreen('menu')}>Levels</button></div>
        </div>
      )}

      {screen === 'play' && playing && (
        <>
          <div className="parade-hud">
            <div className="parade-hud-level"><b>{g.level.name}</b><small>Level {g.index + 1} · {WORLDS[g.level.world].name}</small></div>
            <div className="parade-counts" aria-label="Kits">
              <span title="Kits out on the parade">🐾 <b>{out}</b><small>out</small></span>
              <span title="Kits home" className={g.saved >= g.level.need ? 'is-met' : ''}>🏡 <b>{g.saved}/{g.level.need}</b><small>home</small></span>
              <span title="Time left" className={timeLeft < 20 ? 'is-low' : ''}>⏱ <b>{clock(timeLeft)}</b><small>left</small></span>
            </div>
            <div className="parade-hud-buttons">
              <button className="parade-chip" onClick={() => pause(true)} aria-label="Pause">❚❚</button>
              <button className={'parade-chip' + (fast ? ' is-on' : '')} aria-pressed={fast} onClick={toggleFast} aria-label="Fast forward">{fast ? '▶▶ 3×' : '▶▶'}</button>
              <button className="parade-chip" onClick={restart} title="Call them all home and start again" aria-label="Call them all home">↺</button>
              <button className="parade-chip" aria-pressed={!muted} onClick={() => { const s = snd(); s.setMuted(!s.muted); P.muted = s.muted; setMuted(s.muted); save(); }} aria-label={muted ? 'Sound off' : 'Sound on'}>{muted ? '🔇' : '🔊'}</button>
            </div>
          </div>
          <p className="parade-turn" key={g.level.id}>📱 Turn your phone sideways to see more of the parade</p>
          <div className="parade-jobs" role="toolbar" aria-label="Jobs">
            {JOBS.filter((j) => L.jobs[j]).map((j) => (
              <button key={j} className={'parade-job' + (job === j ? ' is-on' : '')} aria-pressed={job === j} disabled={g.left[j] <= 0} onClick={() => pickJob(j)} title={`${JOB_INFO[j].name}: ${JOB_INFO[j].tip} (key ${JOB_INFO[j].key})`}>
                <span className="parade-job-icon" style={{ backgroundImage: `url(/art/parade/job-${j}.webp)` }}><i>{JOB_INFO[j].icon}</i></span>
                <b>{g.left[j]}</b><small>{JOB_INFO[j].name}</small><kbd>{JOB_INFO[j].key}</kbd>
              </button>
            ))}
            {!JOBS.some((j) => L.jobs[j]) && <p className="parade-nojobs">No jobs this time. Just watch them go!</p>}
          </div>
          {paused && (
            <div className="parade-panel" role="dialog" aria-label="Paused">
              <h2>Paused</h2><p>The kits are waiting patiently.</p>
              <div className="parade-row">
                <button className="parade-go" onClick={() => pause(false)}>Keep going</button>
                <button onClick={restart}>Call them all home (R)</button>
                <button onClick={() => { g.finish('finish'); finish(g); }}>Finish here</button>
                <button onClick={() => setScreen('menu')}>Levels</button>
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'results' && result && (
        <div className="parade-panel parade-results" role="dialog" aria-label="Results">
          <p className="parade-eyebrow">{LEVELS.find((l) => l.id === result.level)!.name}</p>
          <p className="parade-stars" aria-label={`${result.stars} of 3 stars`}>{STARS(result.stars)}</p>
          <h2>{result.cleared ? (result.saved === result.kits ? 'Every single kit is home!' : ['', 'Home safe and sound!', 'What a lovely parade!', 'A perfect parade!'][result.stars]) : 'Not quite this time'}</h2>
          <p>{result.cleared ? 'Dora and Enzo count every little nose and tuck them all in.' : `${result.saved} kit${result.saved === 1 ? '' : 's'} made it home, and ${result.need} were needed. Mum has carried everyone else home for a cuddle. Have another go?`}</p>
          {result.news.length > 0 && <p className="parade-news">{result.news.map((n) => <b key={n}>{n}</b>)}</p>}
          <dl className="parade-tally">
            <div className={result.cleared ? 'is-met' : ''}><dt>Kits home</dt><dd>{result.saved} / {result.kits} <small>need {result.need}</small></dd></div>
            <div className={result.thrifty ? 'is-met' : ''}><dt>Jobs used</dt><dd>{result.used} <small>par {LEVELS.find((l) => l.id === result.level)!.par.jobs}</small></dd></div>
            <div className={result.speedy ? 'is-met' : ''}><dt>All home by</dt><dd>{clock(result.time / TPS)} <small>par {clock(LEVELS.find((l) => l.id === result.level)!.par.time)}</small></dd></div>
          </dl>
          <div className="parade-row">
            {result.cleared && LEVELS.findIndex((l) => l.id === result.level) + 1 < LEVELS.length && <button className="parade-go" onClick={next}>Next level →</button>}
            {!result.cleared && <button className="parade-go" onClick={restart}>Try again (R)</button>}
            {result.cleared && <button onClick={restart}>Play again (R)</button>}
            <button onClick={() => setScreen('menu')}>Levels</button>
          </div>
          {result.cleared && LEVELS.findIndex((l) => l.id === result.level) === LEVELS.length - 1 && <p className="parade-finale">That was the very last parade. Every kit in every world, home again. Thank you for looking after them!</p>}
        </div>
      )}
    </main>
  );
}
