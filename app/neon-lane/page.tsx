'use client';
// Neon Lane: the page. Title, the six nights up Geylang Road, the brief, the sign, the lights-out card between
// nights, pause and results. Keys for one or two players on one keyboard, swipes on a touch screen, the fixed-step
// loop, the save (`neon-lane-v1`) and the sound. Rules in lib/neon-game.ts, the renderer in lib/neon-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { NeonGame, Bot, DT, NIGHTS, CICAKS, SAVE_KEY, freshSave, parseSave, record, canStart, type Dir, type HeroId, type SaveData, type Stats } from '@/lib/neon-game';
import { NeonScene } from '@/lib/neon-scene';
import { NEON_IMG } from '@/lib/neon-art';
import { NeonSound } from './sound';
import './neon.css';

type Screen = 'loading' | 'title' | 'nights' | 'brief' | 'play' | 'next' | 'results';
const HINT_SOLO = 'WASD or arrows run · eat every spark on a circuit to put it out · Q swaps · Esc pause';
const NAME: Record<HeroId, string> = { dora: 'Dora', enzo: 'Enzo' };
const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');
const hintDuo = (p1: HeroId) => `${NAME[p1]}: WASD · ${NAME[other(p1)]}: arrows · Esc pause`;

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window */ } }

/** held directions in the order they were pressed; the newest one held wins */
type Pad = Dir[];
const WASD: Record<string, Dir> = { KeyW: 1, KeyD: 2, KeyS: 3, KeyA: 4 };
const ARROWS: Record<string, Dir> = { ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, ArrowLeft: 4 };
const top = (p: Pad): Dir => p[p.length - 1] ?? 0;
/** where each eatery's sign sits in the motifs atlas (3 x 2, in painting order) */
const MOTIF_AT: Record<string, number> = { kopi: 0, frog: 1, satay: 2, turtle: 3, durian: 4, crab: 5 };

export default function NeonLane() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<NeonGame | null>(null);
  const sceneRef = useRef<NeonScene | null>(null);
  const soundRef = useRef<NeonSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [twoP, setTwoP] = useState(false);
  const [cleared, setCleared] = useState(0);
  const [result, setResult] = useState<{ from: number; night: number; stats: Stats; won: boolean; caught: boolean; best: boolean } | null>(null);
  const S = useRef({ screen: 'loading' as Screen, paused: false, twoP: false, save: freshSave(), sel: 0, overT: 0, from: 0 });
  S.current = { ...S.current, screen, paused, twoP, save, sel };
  const pads = useRef<{ p1: Pad; p2: Pad }>({ p1: [], p2: [] });
  const resRef = useRef(result); resRef.current = result;

  const persist = useCallback((s: SaveData) => { setSave(s); writeSave(s); S.current.save = s; }, []);
  const go = useCallback((s: Screen) => { setScreen(s); S.current.screen = s; }, []);

  // ─────────────────────────────── setup
  useEffect(() => {
    const s = readSave(); setSave(s); S.current.save = s;
    const cv = cvRef.current!; const scene = new NeonScene(cv); sceneRef.current = scene;
    const snd = new NeonSound(); snd.musicOn = s.music; snd.sfxOn = s.sound; soundRef.current = snd;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(320, Math.round(r.width * d)); cv.height = Math.round(cv.width * 9 / 16); };
    fit(); window.addEventListener('resize', fit);
    void scene.load().then(() => go('title'));
    (window as unknown as { __neon: () => unknown }).__neon = () => ({ Bot, game: gameRef.current, scene: sceneRef.current, screen: S.current.screen, paused: S.current.paused, twoP: S.current.twoP, save: S.current.save, sel: S.current.sel, pads: pads.current });
    return () => { window.removeEventListener('resize', fit); snd.stop(); };
  }, [go]);

  /** open a night on the scene: its name, and who to watch out for */
  const announce = useCallback((g: NeonGame) => {
    const n = NIGHTS[g.night], out = g.cicaks.filter((c) => c.mode !== 'away').length;
    sceneRef.current!.say(`Night ${g.night + 1} · ${n.name}`, `${out} cicaks in the drainpipe · eat every spark to put the sign out`, 2.6);
    soundRef.current?.music('night'); soundRef.current?.humOn();
  }, []);

  const begin = useCallback((ni: number) => {
    const scene = sceneRef.current!; scene.reset();
    const g = new NeonGame({ night: ni, seed: (Date.now() & 0xffff) + ni * 977, assist: S.current.save.assist, twoP: S.current.twoP, lead: S.current.save.lead });
    gameRef.current = g; S.current.overT = 0; S.current.from = ni;
    scene.hint = S.current.twoP ? hintDuo(S.current.save.lead) : HINT_SOLO;
    announce(g);
    pads.current = { p1: [], p2: [] };
    setPaused(false); go('play');
  }, [announce, go]);
  const toNights = useCallback(() => { setPaused(false); go('nights'); soundRef.current?.humOff(); soundRef.current?.music('title'); }, [go]);
  const brief = useCallback((ni: number) => { if (!canStart(S.current.save, ni)) return; setSel(ni); go('brief'); soundRef.current?.play('click'); }, [go]);

  /** the run is over (won, lost or abandoned): fold it into the save and show the results */
  const finish = useCallback((g: NeonGame) => {
    const st = g.stats(), prev = S.current.save.best;
    persist(record(S.current.save, st));
    setResult({ from: S.current.from, night: g.night, stats: st, won: g.over === 'win', caught: g.over === 'lose', best: st.score > prev });
    S.current.overT = 0; go('results');
    soundRef.current?.humOff(); soundRef.current?.music('title');
  }, [persist, go]);

  /** after the lights-out card: on to the next night, or the run is won */
  const next = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    g.advance(); soundRef.current?.play('click');
    if (g.over) { soundRef.current?.play('win'); finish(g); return; }
    sceneRef.current!.reset(); sceneRef.current!.hint = S.current.twoP ? hintDuo(g.heroes[0].id) : HINT_SOLO;
    pads.current = { p1: [], p2: [] }; announce(g); go('play');
  }, [announce, finish, go]);

  // ─────────────────────────────── keys and swipes
  useEffect(() => {
    const press = (p: Pad, d: Dir) => { const i = p.indexOf(d); if (i >= 0) p.splice(i, 1); p.push(d); };
    const lift = (p: Pad, d: Dir) => { const i = p.indexOf(d); if (i >= 0) p.splice(i, 1); };
    const kd = (e: KeyboardEvent) => {
      soundRef.current?.start();
      const scr = S.current.screen, code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      if (e.repeat) return;
      if (scr === 'title') { if (code === 'Enter' || code === 'Space') { toNights(); soundRef.current?.play('click'); } return; }
      if (scr === 'nights') {
        const n = NIGHTS.length;
        if (code === 'ArrowRight' || code === 'KeyD') setSel((v) => Math.min(n - 1, v + 1));
        if (code === 'ArrowLeft' || code === 'KeyA') setSel((v) => Math.max(0, v - 1));
        if (code === 'ArrowDown' || code === 'KeyS') setSel((v) => Math.min(n - 1, v + 3));
        if (code === 'ArrowUp' || code === 'KeyW') setSel((v) => Math.max(0, v - 3));
        if (code === 'Enter' || code === 'Space') brief(S.current.sel);
        if (code === 'Digit2') setTwoP((v) => !v);
        if (code === 'Escape') go('title');
        return;
      }
      if (scr === 'brief') { if (code === 'Enter' || code === 'Space') begin(S.current.sel); if (code === 'Escape') toNights(); return; }
      if (scr === 'next') { if (code === 'Enter' || code === 'Space') next(); return; }
      if (scr === 'results') {
        const r = resRef.current; if (!r) return;
        if (code === 'Enter' || code === 'Space') toNights();
        if (code === 'KeyR') begin(r.from);
        if (code === 'Escape') toNights();
        return;
      }
      if (scr !== 'play') return;
      const g = gameRef.current;
      if (code === 'Escape' || code === 'KeyP') { if (!g?.over) { setPaused((p) => !p); pads.current = { p1: [], p2: [] }; } return; }
      if (S.current.paused) { if (code === 'KeyQ' && g) finish(g); if (code === 'KeyR' && g) begin(S.current.from); return; }
      if (!g || g.over) return;
      const two = S.current.twoP;
      if (code === 'KeyQ' && !two) { g.swap(); persist({ ...S.current.save, lead: g.heroes[0].id }); soundRef.current?.play('click'); return; }
      if (WASD[code]) press(pads.current.p1, WASD[code]);
      if (ARROWS[code]) press(two ? pads.current.p2 : pads.current.p1, ARROWS[code]);
    };
    const ku = (e: KeyboardEvent) => {
      const two = S.current.twoP;
      if (WASD[e.code]) lift(pads.current.p1, WASD[e.code]);
      if (ARROWS[e.code]) lift(two ? pads.current.p2 : pads.current.p1, ARROWS[e.code]);
    };
    const blur = () => { pads.current = { p1: [], p2: [] }; if (S.current.screen === 'play' && !gameRef.current?.over) setPaused(true); };
    // a swipe sets the way to run; the chinchilla keeps going, so nothing needs holding
    let t0: { x: number; y: number } | null = null;
    const ts = (e: TouchEvent) => { soundRef.current?.start(); const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY }; };
    const tm = (e: TouchEvent) => {
      if (!t0 || S.current.screen !== 'play') return;
      const t = e.touches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
      if (Math.abs(dx) + Math.abs(dy) < 24) return;
      e.preventDefault();
      const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : (dy > 0 ? 3 : 1);
      gameRef.current?.input(d, 0); t0 = { x: t.clientX, y: t.clientY };
    };
    const te = () => { t0 = null; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    window.addEventListener('touchstart', ts, { passive: true }); window.addEventListener('touchmove', tm, { passive: false }); window.addEventListener('touchend', te);
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      window.removeEventListener('touchstart', ts); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', te);
    };
  }, [begin, toNights, persist, brief, next, finish, go]);

  // ─────────────────────────────── the loop
  useEffect(() => {
    let raf = 0, acc = 0, last = performance.now();
    const sounds = (g: NeonGame) => {
      const snd = soundRef.current; if (!snd) return;
      for (const e of g.events) switch (e.k) {
        case 'spark': snd.spark(); break;
        case 'fuse': snd.play('fuse'); snd.music('scared'); break;
        case 'calm': snd.music('night'); break;
        case 'mothEaten': snd.play('mothEaten'); break;
        case 'clear': snd.play('clear'); snd.humOff(); break;
        case 'win': break;
        case 'lose': snd.humOff(); snd.play('lose'); break;
        case 'zap': snd.play('zap'); if (g.phase === 'dying') snd.music('night'); break;
        case 'dark': case 'low': case 'catch': case 'tail': case 'moth': case 'gulp': case 'chirp': case 'life': case 'release': case 'go': snd.play(e.k); break;
      }
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const scene = sceneRef.current; if (!scene || !scene.ready) return;
      const scr = S.current.screen;
      const g = gameRef.current;
      // the menus cover the stage; between nights the dark sign stays behind the card
      if (scr !== 'play') { acc = 0; if (scr === 'next' && g) scene.draw(g, dt); return; }
      if (!g) return;
      if (!S.current.paused) {
        if (scene.hitStop > 0) { scene.hitStop -= dt; acc = 0; }
        else {
          acc += dt;
          while (acc >= DT) {
            acc -= DT;
            g.step(top(pads.current.p1), top(pads.current.p2));
            scene.ingest(g.events, g); sounds(g);
            if (g.over || g.phase === 'cleared') break;
          }
        }
        if (g.phase === 'cleared' && S.current.screen === 'play') {
          persist(record(S.current.save, g.stats()));
          setCleared(g.night); go('next');
        }
        if (g.over) { S.current.overT += dt; if (S.current.overT > 2.8 && S.current.screen === 'play') finish(g); }
      } else acc = 0;
      scene.draw(g, S.current.paused ? 0 : dt);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [persist, finish, go]);

  const toggle = (k: 'assist' | 'music' | 'sound') => {
    const s = { ...save, [k]: !save[k] }; persist(s);
    if (k === 'music') soundRef.current?.setMusic(s.music);
    if (k === 'sound' && soundRef.current) { soundRef.current.sfxOn = s.sound; if (!s.sound) soundRef.current.humOff(); }
  };
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const menu = screen !== 'play' && screen !== 'next';
  const keys = twoP ? hintDuo(save.lead) : HINT_SOLO;
  const lives = save.assist ? 5 : 3;

  return (
    <main className="nl" data-ready={screen !== 'loading' ? 'true' : 'false'} data-screen={screen}>
      <div className="nl-stage">
        <canvas ref={cvRef} className={`nl-cv${menu ? ' dim' : ''}`} />
        {screen === 'loading' && <div className="nl-load"><p>Warming up the tubes…</p></div>}
        {screen === 'title' && (
          <div className="nl-title" onClick={() => { soundRef.current?.start(); toNights(); }}>
            <img src={NEON_IMG('title')} alt="A neon sign reading Neon Lane on a rainy Geylang shophouse wall, with Dora in brass goggles and Enzo in a yellow poncho running along the tubes from a glowing green cicak" />
            <div className="nl-press">Press Enter or Space</div>
            <a href="/" className="nl-back" onClick={(e) => e.stopPropagation()}>← Arcade</a>
          </div>
        )}
        {screen === 'nights' && (
          <div className="nl-menu nl-rain">
            <div className="nl-card nl-wide">
              <h1>Six nights up Geylang Road</h1>
              <p className="lede">Every eatery up the lorongs has a neon sign, and every sign has cicaks living behind it. Run the glass tubes eating sparks. Clear every spark on a circuit and it <b>goes dark</b>, and a cicak can&rsquo;t see you on a dark tube. Put the whole sign out to close up for the night.</p>
              <div className="nl-nights">
                {NIGHTS.map((n, i) => {
                  const open = canStart(save, i);
                  return (
                    <button key={n.id} data-night={i} className={`nl-night${sel === i ? ' sel' : ''}${open ? '' : ' locked'}`}
                      onClick={() => { soundRef.current?.start(); setSel(i); if (open) brief(i); }} aria-disabled={!open}>
                      <span className="frame" style={{ backgroundImage: `url(${NEON_IMG(n.wall)})` }}><span className="sign" style={{ backgroundImage: `url(${NEON_IMG('motifs')})`, backgroundPosition: `${(MOTIF_AT[n.motif] % 3) * 50}% ${Math.floor(MOTIF_AT[n.motif] / 3) * 100}%` }} /></span>
                      <b>{i + 1}. {n.name}</b>
                      <i>{n.place}</i>
                      <em>{open ? (i < save.reached ? 'Reached · start here' : 'Start here') : `Reach it from night ${i}`}</em>
                    </button>
                  );
                })}
              </div>
              <div className="nl-opts">
                <button data-opt="players" onClick={() => setTwoP((v) => !v)}>Players: {twoP ? 'two' : 'one'}</button>
                <button data-opt="lead" onClick={() => persist({ ...save, lead: other(save.lead) })}>Running: {NAME[save.lead]}</button>
                <button data-opt="assist" onClick={() => toggle('assist')}>Gentle cicaks: {save.assist ? 'on' : 'off'}</button>
                <button data-opt="music" onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
                <button data-opt="sound" onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
              </div>
              <p className="keys">Arrows or WASD pick a night · Enter opens it · 2 switches players · Esc goes back{save.best ? ` · best run ${save.best}` : ''}</p>
            </div>
            <a href="/" className="nl-back">← Arcade</a>
          </div>
        )}
        {screen === 'brief' && (
          <div className="nl-menu nl-rain" onClick={() => begin(sel)}>
            <div className="nl-card">
              <span className="tag">Night {sel + 1} of {NIGHTS.length} · {NIGHTS[sel].place}</span>
              <h2>{NIGHTS[sel].name}</h2>
              <p>{NIGHTS[sel].blurb}</p>
              <ul>
                <li>Run the tubes eating <b>sparks</b>. Eat every spark on a circuit and that circuit <b>goes dark</b>; its last three sparks pulse.</li>
                <li>A cicak only sees you on a <b>lit</b> tube. On a dark tube you&rsquo;re hidden, but one can still bump into you.</li>
                <li>Eat a <b>fuse</b> and the cicaks panic: catch one and it drops its tail. Grab the <b>moth</b> before a cicak gulps it.</li>
                <li>{twoP ? 'Two players share' : 'You have'} <b>{lives} lives</b>{save.assist ? ' (gentle cicaks)' : ''}, and one more every 8000 points.</li>
              </ul>
              <div className="nl-gang">
                {CICAKS.map((c) => <span key={c.kind} style={{ borderColor: c.colour }}><b style={{ color: c.colour }}>{c.name}</b> {c.habit}</span>)}
              </div>
              <p className="keys">{keys}</p>
              <div className="nl-press">Press Enter or Space to start</div>
            </div>
          </div>
        )}
        {screen === 'next' && (
          <div className="nl-menu" onClick={next}>
            <div className="nl-card">
              <span className="tag">Night {cleared + 1} of {NIGHTS.length}</span>
              <h2>Lights out at {NIGHTS[cleared].name}</h2>
              <p>The sign is dark and the cicaks have gone back to their drainpipe.{cleared + 1 < NIGHTS.length ? ` Next: ${NIGHTS[cleared + 1].name}, ${NIGHTS[cleared + 1].place}.` : ' That was the last sign on the road.'}</p>
              <p className="nl-score">Score {gameRef.current?.score ?? 0} · lives {gameRef.current?.lives ?? 0}</p>
              <div className="nl-press">{cleared + 1 < NIGHTS.length ? 'Enter: on to the next night' : 'Enter: see the run'}</div>
            </div>
          </div>
        )}
        {screen === 'play' && !paused && (
          <button className="nl-pausebtn" aria-label="Pause" onClick={() => { if (!gameRef.current?.over) { setPaused(true); pads.current = { p1: [], p2: [] }; } }}>II</button>
        )}
        {screen === 'play' && paused && (
          <div className="nl-menu">
            <div className="nl-card">
              <h2>Paused</h2>
              <p>Esc or P to run on · R to start the run again · Q to end the run</p>
              <div className="nl-opts nl-acts">
                <button data-act="resume" onClick={() => setPaused(false)}>Run on</button>
                <button data-act="restart" onClick={() => begin(S.current.from)}>Start again</button>
                <button data-act="end" onClick={() => { const g = gameRef.current; if (g) finish(g); }}>End run</button>
              </div>
              <div className="nl-opts">
                <button data-opt="assist" onClick={() => toggle('assist')}>Gentle cicaks: {save.assist ? 'on' : 'off'} (from the next start)</button>
                <button data-opt="music" onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
                <button data-opt="sound" onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
              </div>
              <p className="keys">{keys}</p>
            </div>
          </div>
        )}
        {screen === 'results' && result && (
          <div className="nl-menu nl-rain">
            <div className="nl-card">
              <span className="tag">From night {result.from + 1} · {NIGHTS[result.from].name}</span>
              <h2>{result.won ? 'Every sign on Geylang Road is dark!' : result.caught ? `Caught at ${NIGHTS[result.night].name}` : `Run ended at ${NIGHTS[result.night].name}`}</h2>
              {result.caught && <p>Clear a whole circuit early: once it&rsquo;s dark, it&rsquo;s somewhere to hide. When a cicak chirps it has seen you, so slip onto a dark tube.</p>}
              <table><tbody>
                <tr><td>Score</td><td>{result.stats.score}{result.best ? ' · best!' : ''}</td></tr>
                <tr><td>Nights put out</td><td>{result.stats.nights}</td></tr>
                <tr><td>Sparks eaten</td><td>{result.stats.sparks}</td></tr>
                <tr><td>Cicaks caught</td><td>{result.stats.catches} ({result.stats.tails} tails grabbed)</td></tr>
                <tr><td>Moths eaten</td><td>{result.stats.moths}</td></tr>
                <tr><td>Time</td><td>{mmss(result.stats.time)}</td></tr>
              </tbody></table>
              <div className="nl-opts nl-acts">
                <button data-act="nights" onClick={toNights}>Back to the nights</button>
                <button data-act="again" onClick={() => begin(result.from)}>Run it again</button>
              </div>
              <p className="nl-press">Enter: back to the nights · R: run it again</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
