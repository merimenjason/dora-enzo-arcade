'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DiscoGame, SONGS, DIFFS, DIFF, DUST_UP, SAVE_KEY, compose, chart, readProfile, record, unlocked, totalStars, type Diff, type Profile, type Song } from '@/lib/disco-game';
import type { DiscoScene } from '@/lib/disco-scene';
import { DiscoSound } from './sound';
import './disco.css';

type Screen = 'menu' | 'play' | 'results' | 'calibrate';
type Result = ReturnType<DiscoGame['result']> & { news: string[]; mean: number; spread: number };
/** How long before the first beat a song starts, so there is a moment to get ready. */
const LEAD = 2.4;
const LANE_KEYS: Record<string, number> = { d: 0, f: 1, j: 2, k: 3, arrowleft: 0, arrowdown: 1, arrowup: 2, arrowright: 3 };
/** Gamepad buttons per lane: d-pad left/down/up/right and X/A/Y/B. */
const PAD_LANES = [[14, 2], [13, 0], [12, 3], [15, 1]];
const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const chorusAt = (s: Song) => compose(s).sections.find((x) => x.name === 'b')?.t ?? 0;
const length = (s: Song) => { const t = Math.round(compose(s).end); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export default function DustDiscoPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<DiscoScene | null>(null), sound = useRef<DiscoSound | null>(null);
  const game = useRef<DiscoGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), down = useRef([false, false, false, false]);
  const live = useRef(false), [tuning, setTuning] = useState(false);
  const previewRef = useRef<{ song: string; started: number } | null>(null), endAt = useRef(0), cal = useRef<{ clicks: number[]; taps: number[] } | null>(null);
  const [screen, setScreenState] = useState<Screen>('menu');
  const [songId, setSongId] = useState(SONGS[0].id), [diff, setDiff] = useState<Diff>('easy');
  const [paused, setPaused] = useState(false), [muted, setMuted] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null), [calText, setCalText] = useState(''), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const P = profile.current, song = SONGS.find((s) => s.id === songId)!;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new DiscoSound(); sound.current.unlock(); return sound.current; };
  /** The song clock right now, or at the moment of an input event, with the player's offset applied. */
  const now = (stamp?: number) => {
    const s = sound.current; if (!s?.ready) return 0;
    const ago = stamp !== undefined ? Math.max(0, Math.min(0.1, (performance.now() - stamp) / 1000)) : 0;
    return s.songTime() - ago - profile.current.offset / 1000;
  };

  function choose(id: string) {
    const i = SONGS.findIndex((s) => s.id === id); if (!unlocked(profile.current, i)) return;
    setSongId(id); profile.current.song = id; save(); scene.current?.venue(SONGS[i].place);
    const s = audio(), at = chorusAt(SONGS[i]); previewRef.current = null;
    void s.play(SONGS[i], 0.05, at, at + 14, 0.5).then((ok) => { if (ok) previewRef.current = { song: id, started: performance.now() }; });
  }
  function pickDiff(d: Diff) { setDiff(d); profile.current.diff = d; save(); audio().ui(); }
  function start(id = songId, d = diff) {
    const s = audio(), i = SONGS.findIndex((x) => x.id === id); if (!unlocked(profile.current, i)) return;
    game.current = new DiscoGame(id, d, { noFail: profile.current.noFail });
    scene.current?.venue(SONGS[i].place);
    down.current = [false, false, false, false]; previewRef.current = null; endAt.current = 0; live.current = false; setTuning(true);
    const mine = game.current;
    void s.play(SONGS[i], LEAD, 0, Infinity, 0.85).then((ok) => { if (ok && game.current === mine) { live.current = true; setTuning(false); } });
    pausedRef.current = false; setPaused(false); setResult(null); setScreen('play');
    canvas.current?.focus();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || !game.current || game.current.state !== 'play') return;
    pausedRef.current = on; setPaused(on);
    if (on) sound.current?.pause(); else { sound.current?.resume(); canvas.current?.focus(); }
    down.current = [false, false, false, false];
  }
  function quit() { sound.current?.resume(); sound.current?.stop(0.2); game.current = null; live.current = false; setTuning(false); pausedRef.current = false; setPaused(false); setScreen('menu'); }
  function finish(g: DiscoGame) {
    const r = g.result(), news = record(profile.current, r); save();
    const o = g.offsets, mean = o.length ? o.reduce((a, b) => a + b, 0) / o.length : 0;
    const spread = o.length ? Math.sqrt(o.reduce((a, b) => a + (b - mean) ** 2, 0) / o.length) : 0;
    setResult({ ...r, news, mean, spread }); setScreen('results');
    const s = sound.current; if (s) { s.fanfare(r.cleared); if (r.cleared) s.cheer(); }
  }
  function press(lane: number, stamp?: number) {
    const g = game.current; if (!g || screenRef.current !== 'play' || pausedRef.current || !live.current || down.current[lane]) return;
    down.current[lane] = true; g.press(lane, now(stamp));
  }
  function release(lane: number, stamp?: number) {
    const g = game.current; if (!down.current[lane]) return;
    down.current[lane] = false; if (g && screenRef.current === 'play' && !pausedRef.current) g.release(lane, now(stamp));
  }
  function dust() { const g = game.current; if (g && live.current && screenRef.current === 'play' && !pausedRef.current && g.dust(now())) sound.current?.dustUp(); }
  // ---- calibration: eight clicks, tap along, and the average gap becomes the offset
  function calibrate() {
    const s = audio(); s.stop(0.1); previewRef.current = null;
    cal.current = { clicks: s.metronome(12, 0.6, 0.8), taps: [] };
    setCalText('Tap Space (or the pad) on each click…'); setScreen('calibrate');
  }
  function calTap() {
    const c = cal.current, s = sound.current; if (!c || !s) return;
    const t = s.heardNow(), near = c.clicks.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), Infinity);
    if (Math.abs(near - t) < 0.3) c.taps.push(t - near);
    const n = c.taps.length;
    if (n >= 8) {
      const sorted = [...c.taps].sort((a, b) => a - b), mid = sorted.slice(2, -2), off = Math.round((mid.reduce((a, b) => a + b, 0) / mid.length) * 1000);
      profile.current.offset = Math.max(-250, Math.min(250, off)); save(); cal.current = null;
      setCalText(`Done! Your offset is ${profile.current.offset > 0 ? '+' : ''}${profile.current.offset} ms.`);
    } else setCalText(`${n} of 8 taps…`);
  }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setSongId(profile.current.song); setDiff(profile.current.diff);
    sound.current = new DiscoSound(); setMuted(sound.current.muted());
    void sound.current.prepare(SONGS.find((s) => s.id === profile.current.song) ?? SONGS[0]).catch(() => {});
    (window as unknown as { __disco: () => DiscoGame | null; __discoStart: (id: string, d: Diff) => void }).__disco = () => game.current;
    (window as unknown as { __discoStart: (id: string, d: Diff) => void }).__discoStart = (id, d) => start(id, d);
    let dead = false, raf = 0, last = 0, ui = 0, padPrev: boolean[] = [];
    const resize = () => scene.current?.resize();
    import('@/lib/disco-scene').then(({ DiscoScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new DiscoScene(canvas.current); } catch { setError('This browser cannot draw the dance floor.'); return; }
      scene.current.venue(profile.current.song ? SONGS.find((s) => s.id === profile.current.song)!.place : 'burrow');
      window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, snd = sound.current, g = game.current, scr = screenRef.current;
        // gamepad: edges of the lane buttons, a shoulder for Dust Up, start to pause
        const pad = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find(Boolean) : null;
        if (pad) {
          const b = (i: number) => !!pad.buttons[i]?.pressed, now2 = PAD_LANES.map((ids) => ids.some(b));
          now2.forEach((on, lane) => { if (on && !padPrev[lane]) { if (screenRef.current === 'calibrate') calTap(); else press(lane); } if (!on && padPrev[lane]) release(lane); });
          if ((b(4) || b(5)) && !padPrev[4]) dust();
          if (b(9) && !padPrev[5]) pause(!pausedRef.current);
          padPrev = [...now2, b(4) || b(5), b(9)];
        }
        if (scr === 'play' && g) {
          const t = live.current ? now() : -LEAD;
          if (!pausedRef.current && live.current) {
            g.tick(t);
            const ev = g.events.splice(0);
            if (ev.length) {
              sc.feed(ev);
              for (const e of ev) {
                if (e.kind === 'judge' && profile.current.hitSounds) snd?.hit(e.judge, e.lane);
                else if (e.kind === 'stray' && profile.current.hitSounds) snd?.stray();
                else if (e.kind === 'fail') { snd?.stop(1.2); endAt.current = ms + 1600; }
                else if (e.kind === 'clear') endAt.current = ms + 1400;
              }
            }
            if (endAt.current && ms >= endAt.current) { endAt.current = 0; finish(g); }
          }
          sc.draw(g.song, t, g, { speed: profile.current.speed, down: down.current, dt: pausedRef.current ? 0 : dt, lanes: true });
        } else {
          // menus: the dancers keep time with the preview (or a gentle idle beat)
          const s = SONGS.find((x) => x.id === (previewRef.current?.song ?? profile.current.song)) ?? SONGS[0];
          const t = previewRef.current && snd?.ready ? snd.songTime() : ms / 1000;
          sc.draw(scr === 'results' && g ? g.song : s, t, scr === 'results' ? g : null, { speed: profile.current.speed, down: [false, false, false, false], dt, lanes: false });
        }
        if (ms - ui > 90) { ui = ms; refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The dance floor could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (screenRef.current === 'calibrate') { if (k === ' ' && !e.repeat) { e.preventDefault(); calTap(); } else if (k === 'escape') setScreen('menu'); return; }
      if (screenRef.current === 'play') {
        if (k in LANE_KEYS) { e.preventDefault(); if (!e.repeat) press(LANE_KEYS[k], e.timeStamp); return; }
        if (k === ' ') { e.preventDefault(); if (!e.repeat) dust(); return; }
        if ((k === 'escape' || k === 'p') && !e.repeat) { pause(!pausedRef.current); return; }
        if (k === 'r' && pausedRef.current) { start(game.current!.song.id, game.current!.diff); return; }
      }
      if (screenRef.current === 'results' && !e.repeat) { if (k === 'r') start(game.current?.song.id, game.current?.diff); else if (k === 'escape') quit(); }
    };
    const keyup = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k in LANE_KEYS) release(LANE_KEYS[k], e.timeStamp); };
    const blur = () => { if (screenRef.current === 'play') pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch and mouse: each pointer holds the lane it went down in
  const pointers = useRef(new Map<number, number>());
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || !scene.current) return;
    e.preventDefault(); const r = canvas.current!.getBoundingClientRect(), lane = scene.current.laneAt(e.clientX - r.left);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, lane); press(lane, e.timeStamp);
  };
  const onUp = (e: React.PointerEvent) => { const lane = pointers.current.get(e.pointerId); if (lane === undefined) return; pointers.current.delete(e.pointerId); if (![...pointers.current.values()].includes(lane)) release(lane, e.timeStamp); };

  const g = game.current, stars = totalStars(P), playing = screen === 'play' && g;
  const intro = playing && live.current && g.time < 0.2 ? Math.ceil(-now() / g.chart.spb) : 0;
  return (
    <main className="disco-shell" data-ready={ready ? 'true' : undefined} data-screen={screen}>
      <canvas ref={canvas} className="disco-canvas" tabIndex={0} aria-label="Dust Disco dance floor. Press D, F, J and K (or the arrow keys) as the dust bunnies reach the pads; Space for Dust Up; P to pause."
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} />
      {error && <div className="disco-panel disco-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="disco-menu" aria-label="Song select">
          <header className="disco-head">
            <Link href="/" className="disco-back">← ARCADE</Link>
            <button className="disco-chip" aria-pressed={!muted} onClick={() => { const s = audio(); s.setMuted(!s.muted()); setMuted(s.muted()); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
          </header>
          <div className="disco-title">
            <img src="/art/disco/title.webp" alt="Dora and Enzo dancing under a pebble disco ball" width={1600} height={1000} />
            <div><p className="disco-eyebrow">A CHINCHILLA RHYTHM GAME</p><h1>Dust <em>Disco</em></h1><p className="disco-stars-total">{stars} / {SONGS.length * 9} ★</p></div>
          </div>
          <ol className="disco-songs">
            {SONGS.map((s, i) => {
              const open = unlocked(P, i), on = s.id === songId;
              return (
                <li key={s.id}>
                  <button className={'disco-song' + (on ? ' is-on' : '')} aria-pressed={on} disabled={!open} style={{ '--song': s.color } as React.CSSProperties} onClick={() => choose(s.id)}>
                    <span className="disco-thumb" style={{ backgroundImage: `url(/art/disco/venue-${s.place}.webp)` }}><b>{i + 1}</b></span>
                    <span className="disco-song-body">
                      <strong>{open ? s.title : '???'}</strong>
                      <small>{open ? `${s.venue} · ${s.bpm} BPM${s.meter === 3 ? ' · 3/4' : ''} · ${length(s)}` : `Clear ${SONGS[i - 1].title} to open`}</small>
                      {open && <span className="disco-bests">{DIFFS.map((d) => { const b = P.best[s.id + ':' + d]; return <i key={d} title={`${DIFF[d].name}${b?.stars ? `: ${b.grade}, ${b.score.toLocaleString()}` : ''}`} className={b?.stars ? 'got' : ''}>{DIFF[d].name[0]} {b?.stars ? STARS(b.stars) : '☆☆☆'}{b?.allPerfect ? ' ✦' : b?.fullCombo ? ' FC' : ''}</i>; })}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="disco-play">
            <p className="disco-blurb">{song.blurb}</p>
            <div className="disco-diffs" role="group" aria-label="Difficulty">
              {DIFFS.map((d) => { const n = chart(song, d).notes.length; return <button key={d} aria-pressed={diff === d} className={diff === d ? 'is-on' : ''} onClick={() => pickDiff(d)}><b>{DIFF[d].name}</b><small>{'●'.repeat(DIFF[d].level)} · {n} steps</small></button>; })}
            </div>
            <button className="disco-go" disabled={!ready} onClick={() => start()}>{ready ? 'DANCE! →' : 'Setting up the lights…'}</button>
          </div>
          <details className="disco-settings">
            <summary>Settings</summary>
            <label>Note speed <input type="range" min={1} max={10} value={P.speed} onChange={(e) => { P.speed = Number(e.target.value); save(); refresh(); }} /> <b>{P.speed}</b></label>
            <label>Timing offset <input type="range" min={-150} max={150} step={5} value={P.offset} onChange={(e) => { P.offset = Number(e.target.value); save(); refresh(); }} /> <b>{P.offset > 0 ? '+' : ''}{P.offset} ms</b></label>
            <button className="disco-chip" onClick={calibrate}>Find my timing</button>
            <label className="disco-check"><input type="checkbox" checked={P.noFail} onChange={(e) => { P.noFail = e.target.checked; save(); refresh(); }} /> Never fail (dance to the end, even if the groove runs out)</label>
            <label className="disco-check"><input type="checkbox" checked={P.hitSounds} onChange={(e) => { P.hitSounds = e.target.checked; save(); refresh(); }} /> Little sounds on each step</label>
          </details>
          <p className="disco-how"><b>D F J K</b> or <b>← ↓ ↑ →</b> as the dust bunnies reach the pads · hold long ones · <b>Space</b> for Dust Up · tap the lanes on a phone · gamepads work too</p>
        </section>
      )}

      {screen === 'calibrate' && (
        <div className="disco-panel disco-cal" role="dialog" aria-label="Find my timing">
          <h2>Find my timing</h2>
          <p>Listen to the clicks and tap <b>Space</b> exactly on each one. Dust Disco learns how late your speakers and fingers are.</p>
          <p className="disco-cal-state" role="status">{calText}</p>
          <div className="disco-row"><button onClick={calibrate}>Again</button><button className="disco-go" onClick={() => setScreen('menu')}>Done</button></div>
        </div>
      )}

      {playing && (
        <>
          <div className="disco-hud">
            <div className="disco-hud-song"><b>{g.song.title}</b><small>{DIFF[g.diff].name} · {g.song.venue}</small></div>
            <div className="disco-score" aria-label="Score"><b>{Math.round(g.score).toLocaleString()}</b><small>{g.accuracy.toFixed(1)}% · ×{g.combo >= 60 ? 4 : g.combo >= 40 ? 3 : g.combo >= 20 ? 2 : 1}{g.dustUp ? ' · ×2 DUST UP' : ''}</small></div>
            <button className="disco-chip" onClick={() => pause(true)}>❚❚ Pause</button>
          </div>
          <div className="disco-meters">
            <div className={'disco-groove' + (g.groove < 25 ? ' is-low' : '')} role="progressbar" aria-label="Groove" aria-valuenow={Math.round(g.groove)} aria-valuemin={0} aria-valuemax={100}><span>GROOVE</span><i style={{ width: g.groove + '%' }} /></div>
            <div className={'disco-sparkle' + (g.sparkle >= DUST_UP.need && !g.dustUp ? ' is-ready' : '') + (g.dustUp ? ' is-on' : '')} role="progressbar" aria-label="Sparkle" aria-valuenow={Math.round(g.sparkle)} aria-valuemin={0} aria-valuemax={100}>
              <span>{g.dustUp ? 'DUST UP!' : g.sparkle >= DUST_UP.need ? 'SPACE · DUST UP!' : 'SPARKLE'}</span><i style={{ width: (g.dustUp ? Math.max(0, (g.dustUntil - g.time) / (DUST_UP.beats * g.chart.spb)) * 100 : g.sparkle) + '%' }} />
            </div>
            <button className="disco-dust-btn" disabled={g.sparkle < DUST_UP.need || g.dustUp} onClick={dust}>✨ Dust Up</button>
          </div>
          {tuning && <div className="disco-count is-tuning" role="status">Tuning up the band…</div>}
          {intro > 0 && !paused && <div className="disco-count" aria-live="polite">{intro > 4 ? 'READY?' : intro}</div>}
          {paused && (
            <div className="disco-panel" role="dialog" aria-label="Paused">
              <h2>Paused</h2><p>Take a breather. The dance floor will wait.</p>
              <div className="disco-row"><button className="disco-go" onClick={() => pause(false)}>Keep dancing</button><button onClick={() => start(g.song.id, g.diff)}>Start over</button><button onClick={quit}>Song list</button></div>
            </div>
          )}
        </>
      )}

      {screen === 'results' && result && (
        <div className="disco-panel disco-results" role="dialog" aria-label="Results">
          <p className="disco-eyebrow">{SONGS.find((s) => s.id === result.song)!.title} · {DIFF[result.diff].name}</p>
          <div className={'disco-grade g-' + result.grade}>{result.cleared ? result.grade : '–'}</div>
          <h2>{result.allPerfect ? 'All perfect! Pure dust magic!' : result.fullCombo ? 'Full combo! Not one step missed!' : result.cleared ? ['', 'You danced it through!', 'What a groove!', 'Dazzling!'][result.stars] : 'The groove ran out this time'}</h2>
          <p className="disco-stars" aria-label={`${result.stars} of 3 stars`}>{STARS(result.stars)}</p>
          {result.news.length > 0 && <p className="disco-news">{result.news.map((n) => <b key={n}>{n}</b>)}</p>}
          <dl className="disco-tally">
            <div><dt>Score</dt><dd>{result.score.toLocaleString()}</dd></div>
            <div><dt>Accuracy</dt><dd>{result.accuracy}%</dd></div>
            <div><dt>Best combo</dt><dd>{result.maxCombo}</dd></div>
            <div className="j-perfect"><dt>Perfect</dt><dd>{result.counts.perfect}</dd></div>
            <div className="j-great"><dt>Great</dt><dd>{result.counts.great}</dd></div>
            <div className="j-good"><dt>Good</dt><dd>{result.counts.good}</dd></div>
            <div className="j-miss"><dt>Miss</dt><dd>{result.counts.miss}</dd></div>
            <div><dt>Holds</dt><dd>{result.counts.hold} kept · {result.counts.drop} dropped</dd></div>
          </dl>
          <p className="disco-timing">{Math.abs(result.mean) < 0.012 ? 'Your timing sits right on the beat.' : `On average you pressed ${Math.round(Math.abs(result.mean) * 1000)} ms ${result.mean < 0 ? 'early' : 'late'}${Math.abs(result.mean) > 0.025 ? '. “Find my timing” in Settings can fix that.' : '.'}`}</p>
          <div className="disco-row">
            <button className="disco-go" onClick={() => start(result.song, result.diff)}>Dance again (R)</button>
            {(() => { const i = SONGS.findIndex((s) => s.id === result.song), next = SONGS[i + 1]; return next && unlocked(P, i + 1) ? <button onClick={() => { setSongId(next.id); P.song = next.id; save(); start(next.id, result.diff); }}>Next: {next.title} →</button> : null; })()}
            <button onClick={quit}>Song list</button>
          </div>
        </div>
      )}
    </main>
  );
}
