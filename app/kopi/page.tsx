'use client';
// Kopi Peng Brawl: the page. Title, stage select, story panels, the fight, pause, continue and results. Keys for one
// or two players on one keyboard (player 2 joins by pressing one of their keys), the fixed-step loop, the save
// (`kopi-peng-v1`) and the sound. Rules in lib/kopi-game.ts, drawing in lib/kopi-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { KopiGame, DT, NO_INPUT, SAVE_KEY, STAGES, RANKS, freshSave, parseSave, stageOpen, rankFor, type Input, type SaveData, type HeroId, type Stats } from '@/lib/kopi-game';
import { KopiScene } from '@/lib/kopi-scene';
import { KopiSound, type Tune } from './sound';
import './kopi.css';

type Screen = 'loading' | 'title' | 'select' | 'panel' | 'play' | 'results';
type Act = 'left' | 'right' | 'up' | 'down' | 'atk' | 'jmp' | 'grab' | 'spc';
// solo: either cluster drives player 1; with a second player WASD is player 1 and the arrows are player 2
const P1: Record<string, Act> = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyJ: 'atk', KeyK: 'jmp', Space: 'jmp', KeyL: 'grab', KeyI: 'spc' };
const ARROWS: Record<string, Act> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const P2: Record<string, Act> = { Comma: 'atk', Numpad1: 'atk', Period: 'jmp', Numpad2: 'jmp', Slash: 'grab', Numpad3: 'grab', Quote: 'spc', Numpad0: 'spc' };
const ART = '/art/kopi/';
const HINT = 'J attack · K jump · L grab & throw · I (or J+K) special · double-tap to run · Q swap hero · Esc pause';

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window */ } }

interface Pad { held: Record<Act, boolean>; press: Record<'atk' | 'jmp' | 'grab' | 'spc', boolean>; at: { atk: number; jmp: number } }
const freshPad = (): Pad => ({ held: { left: false, right: false, up: false, down: false, atk: false, jmp: false, grab: false, spc: false }, press: { atk: false, jmp: false, grab: false, spc: false }, at: { atk: -1e9, jmp: -1e9 } });

export default function KopiPengBrawl() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<KopiGame | null>(null);
  const sceneRef = useRef<KopiScene | null>(null);
  const soundRef = useRef<KopiSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [stage, setStage] = useState(0);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [down, setDown] = useState(false);
  const [twoP, setTwoP] = useState(false);
  const [p1, setP1] = useState<HeroId>('dora');
  const [result, setResult] = useState<{ stage: number; stats: Stats; rank: number; best: boolean } | null>(null);
  const S = useRef({ screen: 'loading' as Screen, paused: false, down: false, twoP: false, save: freshSave(), stage: 0, sel: 0 });
  S.current = { screen, paused, down, twoP, save, stage, sel };
  const pads = useRef<{ p1: Pad; p2: Pad }>({ p1: freshPad(), p2: freshPad() });

  const persist = useCallback((s: SaveData) => { setSave(s); writeSave(s); }, []);
  const tune = (t: Tune) => soundRef.current?.music(t);

  // ─────────────────────────────── setup
  useEffect(() => {
    const s = readSave(); setSave(s);
    const cv = cvRef.current!; const scene = new KopiScene(cv); scene.hint = HINT; sceneRef.current = scene;
    const snd = new KopiSound(); snd.musicOn = s.music; snd.sfxOn = s.sound; soundRef.current = snd;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); };
    fit(); window.addEventListener('resize', fit);
    const title = new Image(); title.src = `${ART}title.webp`;
    const done = () => setScreen('title');
    title.onload = done; title.onerror = done;
    (window as unknown as { __kopi: () => unknown }).__kopi = () => ({ game: gameRef.current, screen: S.current.screen, paused: S.current.paused, down: S.current.down, twoP: S.current.twoP, save: S.current.save });
    return () => { window.removeEventListener('resize', fit); snd.stop(); };
  }, []);

  const begin = useCallback(async (si: number) => {
    const scene = sceneRef.current!; scene.reset();
    await scene.loadStage(si);
    const g = new KopiGame({ stage: si, seed: (Date.now() & 0xffff) + si * 977, assist: S.current.save.assist, p1, p2: S.current.twoP });
    gameRef.current = g; setDown(false); setPaused(false); setScreen('play'); tune(`s${si + 1}` as Tune);
  }, [p1]);
  const openStage = (si: number) => { setStage(si); setScreen('panel'); soundRef.current?.play('click'); };

  // ─────────────────────────────── keys
  useEffect(() => {
    const route = (code: string): { pad: 'p1' | 'p2'; act: Act } | null => {
      const two = S.current.twoP;
      if (P1[code]) return { pad: 'p1', act: P1[code] };
      if (ARROWS[code]) return { pad: two ? 'p2' : 'p1', act: ARROWS[code] };
      if (P2[code]) return { pad: 'p2', act: P2[code] };
      return null;
    };
    const kd = (e: KeyboardEvent) => {
      soundRef.current?.start();
      const scr = S.current.screen, code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote'].includes(code)) e.preventDefault();
      if (scr === 'title') { if (code === 'Enter' || code === 'KeyJ' || code === 'Space') { setScreen('select'); tune('title'); soundRef.current?.play('click'); } return; }
      if (scr === 'select') {
        const n = STAGES.length;
        if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowDown' || code === 'KeyS') setSel((v) => Math.min(n - 1, v + 1));
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp' || code === 'KeyW') setSel((v) => Math.max(0, v - 1));
        if ((code === 'Enter' || code === 'KeyJ') && stageOpen(S.current.save, S.current.sel)) openStage(S.current.sel);
        if (code === 'Escape') setScreen('title');
        return;
      }
      if (scr === 'panel') { if (code === 'Enter' || code === 'KeyJ' || code === 'Space') void begin(S.current.stage); if (code === 'Escape') setScreen('select'); return; }
      if (scr === 'results') { if (code === 'Enter' || code === 'KeyJ') { setScreen('select'); tune('title'); } return; }
      if (scr !== 'play') return;
      const g = gameRef.current;
      if (code === 'Escape' || code === 'KeyP') { if (!S.current.down) setPaused((p) => !p); return; }
      if (S.current.paused) { if (code === 'KeyQ') { setPaused(false); setScreen('select'); tune('title'); } return; }
      if (S.current.down) {
        if (code === 'Enter' || code === 'KeyJ') { g?.retry(); setDown(false); }
        if (code === 'Escape' || code === 'KeyQ') { setDown(false); setScreen('select'); tune('title'); }
        return;
      }
      if (code === 'KeyQ' && !S.current.twoP && g) { g.swap(); setP1(g.heroes.find((h) => h.ctrl === 'p1')!.id); return; }
      const r = route(code); if (!r) return;
      // a second player joins by pressing one of their action keys
      if (r.pad === 'p2' && !S.current.twoP && P2[code] && g) {
        setTwoP(true); S.current.twoP = true;
        const other = g.heroes.find((h) => h.ctrl === 'bot'); if (other) other.ctrl = 'p2';
        sceneRef.current?.ingest([{ k: 'banner', text: 'Player 2 joins!', sub: 'WASD for player 1, arrows for player 2', t: 2.4 }], g);
      }
      const pad = pads.current[r.pad];
      if (!pad.held[r.act] && (r.act === 'atk' || r.act === 'jmp' || r.act === 'grab' || r.act === 'spc')) { pad.press[r.act] = true; if (r.act === 'atk' || r.act === 'jmp') pad.at[r.act] = performance.now(); }
      pad.held[r.act] = true;
    };
    const ku = (e: KeyboardEvent) => { const r = route(e.code); if (r) pads.current[r.pad].held[r.act] = false; };
    const blur = () => { pads.current = { p1: freshPad(), p2: freshPad() }; if (S.current.screen === 'play' && !S.current.down) setPaused(true); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, [begin]);

  // ─────────────────────────────── the loop
  useEffect(() => {
    let raf = 0, acc = 0, last = performance.now();
    const read = (p: Pad): Input => {
      // Attack + Jump is the special only when both go down together (within 90 ms), so holding Jump and kicking in the air stays a kick
      const spc = p.press.spc || ((p.press.atk || p.press.jmp) && Math.abs(p.at.atk - p.at.jmp) < 90);
      const inp: Input = { mx: (p.held.right ? 1 : 0) - (p.held.left ? 1 : 0), mz: (p.held.down ? 1 : 0) - (p.held.up ? 1 : 0),
        atk: spc || p.press.atk, jmp: spc || p.press.jmp, grab: !spc && p.press.grab, atkH: p.held.atk, jmpH: p.held.jmp };
      p.press = { atk: false, jmp: false, grab: false, spc: false };
      if (spc) p.at = { atk: -1e9, jmp: -1e9 };
      return inp;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const g = gameRef.current, scene = sceneRef.current, snd = soundRef.current;
      if (!scene) return;
      if (S.current.screen !== 'play' || !g) { if (S.current.screen !== 'play') return; }
      if (!g) return;
      if (!S.current.paused && !S.current.down) {
        acc += dt;
        while (acc >= DT) {
          acc -= DT;
          const ins: Partial<Record<HeroId, Input>> = {};
          for (const h of g.heroes) if (h.ctrl === 'p1') ins[h.id] = read(pads.current.p1); else if (h.ctrl === 'p2') ins[h.id] = read(pads.current.p2);
          g.step(ins);
          scene.ingest(g.fx, g);
          for (const f of g.fx) { if (f.k === 'snd') snd?.play(f.s); else if (f.k === 'hit') snd?.play(f.sfx ?? 'hit'); else if (f.k === 'ko') snd?.play('KO'); }
          if (g.boss && !g.boss.dead) snd?.music('boss');
          if (g.mode === 'down' && !S.current.down) { setDown(true); S.current.down = true; }
          if (g.mode === 'clear' && g.clearT > 3.2 && S.current.screen === 'play') { finish(g); break; }
        }
      } else { acc = 0; void NO_INPUT; }
      scene.draw(g, S.current.paused || S.current.down ? 0 : dt);
    };
    const finish = (g: KopiGame) => {
      const st = STAGES[g.stageIdx], rank = rankFor(g.stats, g.stageIdx), prev = S.current.save.cleared[st.id];
      const best = !prev || g.stats.score > prev.score;
      const s: SaveData = { ...S.current.save, cleared: { ...S.current.save.cleared, [st.id]: { score: Math.max(prev?.score ?? 0, g.stats.score), rank: Math.max(prev?.rank ?? -1, rank) } } };
      persist(s); S.current.save = s;
      setResult({ stage: g.stageIdx, stats: { ...g.stats }, rank, best }); setScreen('results'); S.current.screen = 'results';
      soundRef.current?.play('clear'); tune('title');
      if (g.stageIdx + 1 < STAGES.length) setSel(g.stageIdx + 1);
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
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return (
    <main className="kopi" data-ready={screen !== 'loading' ? 'true' : 'false'} data-screen={screen}>
      <canvas ref={cvRef} className="kopi-cv" style={{ visibility: screen === 'play' ? 'visible' : 'hidden' }} />
      {screen === 'loading' && <div className="kopi-load">Loading…</div>}
      {screen === 'title' && (
        <div className="kopi-title" onClick={() => { soundRef.current?.start(); setScreen('select'); tune('title'); }}>
          <img src={`${ART}title.webp`} alt="Kopi Peng Brawl: Dora and Enzo back to back at Lau Pa Sat" />
          <div className="kopi-press">Press J or Enter</div>
          <div className="kopi-sub">One player, or two on one keyboard · a second player joins any time by pressing , . or /</div>
          <a href="/" className="kopi-back" onClick={(e) => e.stopPropagation()}>← Arcade</a>
        </div>
      )}
      {screen === 'select' && (
        <div className="kopi-select">
          <h1>One long night</h1>
          <div className="kopi-stages">
            {STAGES.map((st, i) => {
              const open = stageOpen(save, i), c = save.cleared[st.id];
              return (
                <button key={st.id} className={`kopi-stage${sel === i ? ' sel' : ''}${open ? '' : ' locked'}`} disabled={!open}
                  onClick={() => { soundRef.current?.start(); setSel(i); if (open) openStage(i); }} data-stage={i}>
                  <img src={`${ART}${st.scenes[0].bg}.webp`} alt="" />
                  <span className="n">{i + 1}</span>
                  <b>{st.name}</b><i>{st.place}</i>
                  <em>{open ? st.twistName : 'Locked'}</em>
                  {c && <span className="rank">{RANKS[c.rank]}</span>}
                </button>
              );
            })}
          </div>
          <div className="kopi-opts">
            <button onClick={() => toggle('assist')}>Easy hits: {save.assist ? 'on' : 'off'}</button>
            <button onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
            <button onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
            <button onClick={() => setP1((h) => h === 'dora' ? 'enzo' : 'dora')}>Play as: {p1 === 'dora' ? 'Dora' : 'Enzo'}</button>
          </div>
          <div className="kopi-keys">{HINT}<br />Player 2: arrows move · , attack · . jump · / grab · ' special (or Numpad 1 2 3 0)</div>
          <a href="/" className="kopi-back">← Arcade</a>
        </div>
      )}
      {screen === 'panel' && (
        <div className="kopi-panel" onClick={() => void begin(stage)}>
          <img src={`${ART}${STAGES[stage].scenes[0].bg}.webp`} alt="" />
          <div className="box">
            <span className="tag">Stage {stage + 1} · {STAGES[stage].place}</span>
            <h2>{STAGES[stage].name}</h2>
            <p>{STAGES[stage].intro}</p>
            <p className="twist"><b>{STAGES[stage].twistName}.</b> {STAGES[stage].twistHelp}</p>
            <div className="kopi-press">Press J to fight</div>
          </div>
        </div>
      )}
      {screen === 'play' && paused && (
        <div className="kopi-over"><div className="box"><h2>Paused</h2><p>Esc to play on · Q to quit to the stage list</p>
          <div className="kopi-opts"><button onClick={() => toggle('assist')}>Easy hits: {save.assist ? 'on' : 'off'}</button><button onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button></div>
          <p className="small">{HINT}</p></div></div>
      )}
      {screen === 'play' && down && (
        <div className="kopi-over"><div className="box"><h2>Both down!</h2><p>J or Enter to get back up and retry this scene · Esc to give up</p></div></div>
      )}
      {screen === 'results' && result && (
        <div className="kopi-results">
          <div className="box">
            <span className="tag">Stage {result.stage + 1} clear</span>
            <h2>{STAGES[result.stage].name}</h2>
            <div className="big-rank">{RANKS[result.rank]}</div>
            <table><tbody>
              <tr><td>Score</td><td>{result.stats.score}{result.best ? ' · best!' : ''}</td></tr>
              <tr><td>Time</td><td>{mmss(result.stats.time)}</td></tr>
              <tr><td>Best combo</td><td>{result.stats.bestCombo} hits</td></tr>
              <tr><td>Knock-outs</td><td>{result.stats.kos}</td></tr>
              <tr><td>Specials · team-ups</td><td>{result.stats.specials} · {result.stats.teamups}</td></tr>
              <tr><td>Retries</td><td>{result.stats.retries}</td></tr>
            </tbody></table>
            <p>{result.stage + 1 < STAGES.length ? `Next: ${STAGES[result.stage + 1].name}, ${STAGES[result.stage + 1].place}.` : 'The Macaque King is beaten and the satay is safe. Kopi peng all round.'}</p>
            <div className="kopi-press">Press J to go on</div>
          </div>
        </div>
      )}
    </main>
  );
}
