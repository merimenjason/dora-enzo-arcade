'use client';
// Dragon Playground: the page. Title, the race map, race cards, the race with its HUD, pause and results. Keys for one
// player (the helper bot rides) or two on one keyboard (player 2 takes the rider's keys and joins by pressing one), the
// fixed-step loop, the save (`dragon-playground-v1`) and the sound. Rules in lib/dragon-game.ts, drawing in
// lib/dragon-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DragonGame, DT, RACES, SAVE_KEY, METER_MAX, POWER_NAME, POWER_HELP, NO_RIDE, freshSave, parseSave, raceOpen, powersOwned, parTime, type DriveIn, type RideIn, type SaveData, type HeroId, type Power, type Stats } from '@/lib/dragon-game';
import { DragonScene } from '@/lib/dragon-scene';
import { buildCourse } from '@/lib/dragon-levels';
import { DRAGON_ATLAS } from '@/lib/dragon-art';
import { DragonSound, type Tune } from './sound';
import './dragon.css';

type Screen = 'loading' | 'title' | 'map' | 'card' | 'play' | 'results';
type Act = 'left' | 'right' | 'down' | 'jmp' | 'roar' | 'swat' | 'grab' | 'power';
const P1: Record<string, Act> = {
  KeyA: 'left', KeyD: 'right', KeyS: 'down', KeyW: 'jmp', KeyK: 'jmp', Space: 'jmp', KeyI: 'roar',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'jmp',
  KeyJ: 'swat', KeyL: 'grab', KeyO: 'power',
};
const P2: Record<string, Act> = { Comma: 'swat', Numpad1: 'swat', Slash: 'grab', Numpad3: 'grab', Quote: 'power', Numpad0: 'power' };
const ART = '/art/dragon/';
const HINT = '→ run · K, Space or ↑ jump (hold for higher) · ↓ slide · I roar when the toast meter is full · Esc pause';
const HINT_RIDER = 'Rider (the helper bot, or you): J swat crows · L grab swings, poles and bars · O playground power · Q swap seats';

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window */ } }
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const secs = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const TOAST = DRAGON_ATLAS.crows.parts.toast;
const NAME: Record<HeroId, string> = { dora: 'Dora', enzo: 'Enzo' };

interface Hud { place: number; time: number; meter: number; prog: { dragon: number; otters: number[] }; count: number; go: boolean; power: Power | null; cd: number; tier: string | null; rider: 'bot' | 'p2'; driver: HeroId }
interface Result { race: number; place: number; stats: Stats; stars: number; best: boolean; firstWin: boolean }
interface Keys { held: Record<Act, boolean>; press: Record<Act, boolean> }
const freshKeys = (): Keys => ({ held: { left: false, right: false, down: false, jmp: false, roar: false, swat: false, grab: false, power: false }, press: { left: false, right: false, down: false, jmp: false, roar: false, swat: false, grab: false, power: false } });

export default function DragonPlayground() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<DragonGame | null>(null);
  const sceneRef = useRef<DragonScene | null>(null);
  const soundRef = useRef<DragonSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [race, setRace] = useState(0);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [twoP, setTwoP] = useState(false);
  const [driver, setDriver] = useState<HeroId>('dora');
  const [power, setPower] = useState<Power | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const S = useRef({ screen: 'loading' as Screen, paused: false, twoP: false, save: freshSave(), race: 0, sel: 0, power: null as Power | null });
  S.current = { screen, paused, twoP, save, race, sel, power };
  const keys = useRef<{ p1: Keys; p2: Keys }>({ p1: freshKeys(), p2: freshKeys() });

  const persist = useCallback((s: SaveData) => { setSave(s); writeSave(s); }, []);
  const tune = (t: Tune) => soundRef.current?.music(t);

  // ─────────────────────────────── setup
  useEffect(() => {
    const s = readSave(); setSave(s); setPower(s.power && powersOwned(s).includes(s.power) ? s.power : null);
    const first = RACES.findIndex((_, i) => !s.won[RACES[i].id]); setSel(first < 0 ? 0 : first);
    const cv = cvRef.current!; const scene = new DragonScene(cv); sceneRef.current = scene;
    const snd = new DragonSound(); snd.musicOn = s.music; snd.sfxOn = s.sound; soundRef.current = snd;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); };
    fit(); window.addEventListener('resize', fit);
    const title = new Image(); title.src = `${ART}title.webp`;
    let done = false; const ready = () => { if (!done) { done = true; setScreen('title'); } };
    title.onload = ready; title.onerror = ready; void scene.load();
    (window as unknown as { __dragon: () => unknown }).__dragon = () => ({ game: gameRef.current, screen: S.current.screen, paused: S.current.paused, twoP: S.current.twoP, save: S.current.save });
    return () => { window.removeEventListener('resize', fit); snd.stop(); };
  }, []);

  const begin = useCallback(async (ri: number) => {
    const scene = sceneRef.current!;
    await scene.load();
    const g = new DragonGame({ race: ri, seed: (Date.now() & 0xffff) + ri * 977, assist: S.current.save.assist, power: S.current.power, driver });
    gameRef.current = g; scene.reset(g); keys.current = { p1: freshKeys(), p2: freshKeys() };
    setPaused(false); setResult(null); setScreen('play'); S.current.screen = 'play'; tune(RACES[ri].id as Tune);
  }, [driver]);
  const openRace = (ri: number) => { setRace(ri); setScreen('card'); soundRef.current?.play('click'); };
  const toMap = () => { setScreen('map'); S.current.screen = 'map'; setPaused(false); tune('title'); };

  // ─────────────────────────────── keys
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      soundRef.current?.start();
      const scr = S.current.screen, code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote'].includes(code)) e.preventDefault();
      if (e.repeat) return;
      if (scr === 'title') { if (code === 'Enter' || code === 'KeyJ' || code === 'Space' || code === 'KeyK') { toMap(); soundRef.current?.play('click'); } return; }
      if (scr === 'map') {
        const n = RACES.length;
        if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowDown' || code === 'KeyS') setSel((v) => Math.min(n - 1, v + 1));
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp' || code === 'KeyW') setSel((v) => Math.max(0, v - 1));
        if ((code === 'Enter' || code === 'KeyJ' || code === 'Space' || code === 'KeyK') && raceOpen(S.current.save, S.current.sel)) openRace(S.current.sel);
        if (code === 'Escape') setScreen('title');
        return;
      }
      if (scr === 'card') { if (code === 'Enter' || code === 'KeyJ' || code === 'Space' || code === 'KeyK') void begin(S.current.race); if (code === 'Escape') toMap(); return; }
      if (scr === 'results') {
        if (code === 'Enter' || code === 'KeyJ' || code === 'Space' || code === 'KeyK') toMap();
        if (code === 'KeyR') void begin(S.current.race);
        return;
      }
      if (scr !== 'play') return;
      const g = gameRef.current;
      if (code === 'Escape' || code === 'KeyP') { setPaused((p) => !p); return; }
      if (S.current.paused) {
        if (code === 'KeyQ') toMap();
        if (code === 'KeyR') void begin(S.current.race);
        return;
      }
      if (code === 'KeyQ' && g) { g.swap(); setDriver(g.driver); soundRef.current?.play('click'); return; }
      const p2 = P2[code], p1 = P1[code];
      if (p2) {
        if (!S.current.twoP) { setTwoP(true); S.current.twoP = true; }
        const k = keys.current.p2; if (!k.held[p2]) k.press[p2] = true; k.held[p2] = true; return;
      }
      if (p1) { const k = keys.current.p1; if (!k.held[p1]) k.press[p1] = true; k.held[p1] = true; }
    };
    const ku = (e: KeyboardEvent) => {
      if (P2[e.code]) keys.current.p2.held[P2[e.code]] = false;
      if (P1[e.code]) {
        const a = P1[e.code]; keys.current.p1.held[a] = false;
        // the two clusters drive the same dragon: a key released on one doesn't cancel the other
        for (const [c, b] of Object.entries(P1)) if (b === a && c !== e.code && pressedCodes.has(c)) keys.current.p1.held[a] = true;
      }
      pressedCodes.delete(e.code);
    };
    const pressedCodes = new Set<string>();
    const track = (e: KeyboardEvent) => { pressedCodes.add(e.code); };
    const blur = () => { keys.current = { p1: freshKeys(), p2: freshKeys() }; pressedCodes.clear(); if (S.current.screen === 'play') setPaused(true); };
    window.addEventListener('keydown', track); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', track); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, [begin]);

  // ─────────────────────────────── the loop
  useEffect(() => {
    let raf = 0, acc = 0, last = performance.now(), hudT = 0;
    const SND: Record<string, string> = { jump: 'jump', land: 'land', slide: 'slide', spring: 'spring', grab: 'grab', fling: 'fling', splash: 'splash', toast: 'toast', roar: 'roar', stumble: 'stumble', swat: 'swat', steal: 'steal', bonk: 'bonk', count: 'count', go: 'go', flutter: 'flutter', gulp: 'gulp', seed: 'seed', twin: 'twin', otterdive: 'otterdive', otterpop: 'otterpop', win: 'win', lose: 'lose' };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const g = gameRef.current, scene = sceneRef.current, snd = soundRef.current;
      if (!scene || !g || S.current.screen !== 'play') return;
      if (!S.current.paused) {
        acc += dt;
        while (acc >= DT) {
          acc -= DT;
          const k1 = keys.current.p1, k2 = keys.current.p2;
          const drive: DriveIn = { mx: (k1.held.right ? 1 : 0) - (k1.held.left ? 1 : 0), down: k1.held.down, jmp: k1.press.jmp, jmpH: k1.held.jmp, roar: k1.press.roar };
          const solo: RideIn = { swat: k1.press.swat, grab: k1.press.grab || k1.held.grab, power: k1.press.power };
          const ride: RideIn | null = S.current.twoP ? { swat: k2.press.swat, grab: k2.press.grab || k2.held.grab, power: k2.press.power } : null;
          k1.press = freshKeys().press; k2.press = freshKeys().press;
          g.step(drive, ride, S.current.twoP ? NO_RIDE : solo);
          scene.ingest(g.fx, g);
          for (const f of g.fx) { const s = SND[f.k]; if (s) snd?.play(s); if (f.k === 'win') setTimeout(() => snd?.play('wake'), 700); }
          if (g.mode === 'done' && g.endT > 3 && S.current.screen === 'play') { finish(g); break; }
        }
      } else acc = 0;
      scene.draw(g, S.current.paused ? 0 : dt);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.08;
        setHud({ place: g.standing(), time: g.stats.time, meter: g.dragon.meter, prog: g.progress(), count: g.mode === 'count' ? Math.ceil(g.countT) : 0, go: g.mode === 'race' && g.stats.time < 0.8,
          power: g.power, cd: g.rider.powerCd, tier: g.dragon.tier, rider: S.current.twoP ? 'p2' : 'bot', driver: g.driver });
      }
    };
    const finish = (g: DragonGame) => {
      const r = g.race, prev = S.current.save.won[r.id];
      const won = g.place === 1, firstWin = won && !prev;
      const best = won && (!prev || g.stats.time < prev.time);
      let s = S.current.save;
      if (won) s = { ...s, won: { ...s.won, [r.id]: { time: best ? g.stats.time : prev!.time, stars: Math.max(prev?.stars ?? 0, g.stars) } } };
      persist(s); S.current.save = s;
      const ri = RACES.indexOf(r);
      setResult({ race: ri, place: g.place, stats: { ...g.stats }, stars: g.stars, best, firstWin }); setScreen('results'); S.current.screen = 'results';
      tune('title');
      if (won && ri + 1 < RACES.length) setSel(ri + 1);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [persist]);

  const toggle = (k: 'assist' | 'music' | 'sound') => {
    const s = { ...save, [k]: !save[k] }; persist(s);
    if (k === 'music') soundRef.current?.setMusic(s.music);
    if (k === 'sound' && soundRef.current) soundRef.current.sfxOn = s.sound;
    if (k === 'assist' && gameRef.current) gameRef.current.assist = s.assist;
  };
  const choosePower = (p: Power | null) => { setPower(p); persist({ ...save, power: p }); soundRef.current?.play('click'); };
  const owned = powersOwned(save);
  const R = RACES[race];

  return (
    <main className="dp" data-ready={screen !== 'loading' ? 'true' : 'false'} data-screen={screen}>
      <canvas ref={cvRef} className="dp-cv" style={{ visibility: screen === 'play' ? 'visible' : 'hidden' }} />
      {screen === 'loading' && <div className="dp-load">Loading…</div>}
      {screen === 'title' && (
        <div className="dp-title" onClick={() => { soundRef.current?.start(); toMap(); }}>
          <img src={`${ART}title.webp`} alt="Dora and Enzo ride the Toa Payoh mosaic dragon past three otters at dusk" />
          <h1 className="dp-logo">Dragon Playground</h1>
          <div className="dp-press">Press K or Enter</div>
          <p className="dp-sub">One player with a helper riding along, or two on one keyboard · player 2 joins by pressing , / or &apos;</p>
          <a href="/" className="dp-back" onClick={(e) => e.stopPropagation()}>← Arcade</a>
        </div>
      )}
      {screen === 'map' && (
        <div className="dp-map">
          <h1 className="dp-h">Wake the playgrounds</h1>
          <p className="dp-lede">Five races against the Bishan otters, playground to playground. Win one and that playground wakes up and rides with you.</p>
          <div className="dp-races">
            {RACES.map((r, i) => {
              const open = raceOpen(save, i), w = save.won[r.id];
              return (
                <button key={r.id} className={`dp-race${sel === i ? ' sel' : ''}${open ? '' : ' locked'}`} disabled={!open} data-race={i}
                  onClick={() => { soundRef.current?.start(); setSel(i); if (open) openRace(i); }}>
                  <span className="dp-n">{i + 1}</span>
                  <b>{r.name}</b>
                  <span className="dp-route">{r.from} → {r.to}</span>
                  <span className="dp-wake">{open ? (w ? `Woke ${r.wakes}` : `Wakes ${r.wakes}`) : 'Win the race before to open'}</span>
                  {w && <span className="dp-stars" aria-label={`${w.stars} stars`}>{'★'.repeat(w.stars)}{'☆'.repeat(3 - w.stars)}</span>}
                </button>
              );
            })}
          </div>
          <div className="dp-opts">
            <button onClick={() => toggle('assist')}>Easy race: {save.assist ? 'on' : 'off'}</button>
            <button onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
            <button onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
            <button onClick={() => setDriver((h) => h === 'dora' ? 'enzo' : 'dora')}>Driving: {NAME[driver]}</button>
          </div>
          <p className="dp-keys">{HINT}<br />{HINT_RIDER}<br />Player 2 rides: , swat · / grab · &apos; power (or Numpad 1 3 0)</p>
          <a href="/" className="dp-back">← Arcade</a>
        </div>
      )}
      {screen === 'card' && (
        <div className="dp-cardwrap" onClick={() => void begin(race)}>
          <div className="dp-card" onClick={(e) => e.stopPropagation()}>
            <span className="dp-tag">Race {race + 1} · {R.from} → {R.to}</span>
            <h2>{R.name}</h2>
            <p>{R.blurb}</p>
            <p className="dp-tip">{R.tip}</p>
            {owned.length > 0 && (
              <div className="dp-powers">
                <span>Playground power for the rider (O, or &apos; for player 2):</span>
                <div>
                  <button className={power === null ? 'on' : ''} onClick={() => choosePower(null)}>None</button>
                  {owned.map((p) => <button key={p} className={power === p ? 'on' : ''} onClick={() => choosePower(p)} title={POWER_HELP[p]}>{POWER_NAME[p]}</button>)}
                </div>
                {power && <p className="dp-small">{POWER_NAME[power]}: {POWER_HELP[power]}.</p>}
              </div>
            )}
            <p className="dp-small">{NAME[driver]} drives, {NAME[driver === 'dora' ? 'enzo' : 'dora']} rides. Par time {secs(parTime(buildCourse(R)))}{save.won[R.id] ? ` · your best ${secs(save.won[R.id].time)}` : ''}</p>
            <button className="dp-go" onClick={() => void begin(race)}>Race! (K)</button>
          </div>
        </div>
      )}
      {screen === 'play' && hud && (
        <div className="dp-hud" aria-live="off">
          <div className="dp-plaque dp-place"><b>{ord(hud.place)}</b><span>{secs(hud.time)}</span></div>
          <div className="dp-plaque dp-strip" aria-label="race positions">
            <div className="dp-track">
              {hud.prog.otters.map((p, i) => <span key={i} className="dp-otter" style={{ left: `${p * 100}%` }} title="otter" />)}
              <span className="dp-me" style={{ left: `${hud.prog.dragon * 100}%` }} title="you" />
              <span className="dp-flag" />
            </div>
          </div>
          <div className="dp-plaque dp-meter">
            <span className="dp-lbl">Toast</span>
            {Array.from({ length: METER_MAX }, (_, i) => <span key={i} className={`dp-pip${i < hud.meter ? ' on' : ''}`} style={i < hud.meter ? { backgroundPosition: `-${TOAST[0]}px -${TOAST[1]}px`, width: TOAST[2], height: TOAST[3] } : undefined} />)}
            {hud.meter >= METER_MAX && <b className="dp-ready">I: Roar!</b>}
          </div>
          <div className="dp-plaque dp-rider">
            <span>{hud.rider === 'p2' ? `Player 2 rides (${NAME[hud.driver === 'dora' ? 'enzo' : 'dora']})` : `${NAME[hud.driver === 'dora' ? 'enzo' : 'dora']} rides (helper) · player 2: press , to join`}</span>
            {hud.power && <span className="dp-pow">{POWER_NAME[hud.power]}: {hud.cd > 0 ? `${Math.ceil(hud.cd)} s` : 'ready'}</span>}
          </div>
          {hud.count > 0 && <div className="dp-count">{hud.count}</div>}
          {hud.go && <div className="dp-count go">Go!</div>}
        </div>
      )}
      {screen === 'play' && paused && (
        <div className="dp-over"><div className="dp-card">
          <h2>Paused</h2>
          <p>Esc to race on · R to restart · Q to go back to the map</p>
          <div className="dp-opts"><button onClick={() => toggle('assist')}>Easy race: {save.assist ? 'on' : 'off'}</button><button onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button><button onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button></div>
          <p className="dp-small">{HINT}</p>
          <p className="dp-small">{HINT_RIDER}</p>
        </div></div>
      )}
      {screen === 'results' && result && (
        <div className="dp-over dp-results"><div className="dp-card">
          <span className="dp-tag">Race {result.race + 1} · {RACES[result.race].name}</span>
          <h2>{result.place === 1 ? 'You won!' : `${ord(result.place)} place`}</h2>
          {result.place === 1
            ? <p>{result.firstWin ? `${RACES[result.race].wakes[0].toUpperCase()}${RACES[result.race].wakes.slice(1)} wakes up${RACES[result.race].power ? ` and lends the rider a power: ${POWER_NAME[RACES[result.race].power!]}, ${POWER_HELP[RACES[result.race].power!]}` : ''}.` : 'The otters are sulking in the drain again.'}</p>
            : <p>The otters got there first. Try the slides and the swings: every boost counts.</p>}
          {result.place === 1 && <div className="dp-bigstars" aria-label={`${result.stars} stars`}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</div>}
          <table className="dp-table"><tbody>
            <tr><td>Time</td><td>{secs(result.stats.time)}{result.best ? ' · best!' : ''}</td></tr>
            <tr><td>Kaya toast</td><td>{result.stats.toasts}</td></tr>
            <tr><td>Crows swatted</td><td>{result.stats.crows}</td></tr>
            <tr><td>Boosts</td><td>{result.stats.boosts}</td></tr>
            <tr><td>Splashes</td><td>{result.stats.falls}</td></tr>
          </tbody></table>
          <p className="dp-small">Stars: win · beat the par time · eat most of the toast</p>
          <p className="dp-press">K: back to the map · R: race again</p>
        </div></div>
      )}
    </main>
  );
}
