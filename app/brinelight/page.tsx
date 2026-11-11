'use client';
// Brinelight: the page. Title, the harbour map, story panels, the stage, pause and results. Input from keys, touch
// (a stick and three buttons; on a phone held upright they sit in a panel under the play view) and gamepads, the
// fixed-step loop, the save (`brinelight-v1`) and the sound. Rules in lib/brinelight-game.ts, drawing in
// lib/brinelight-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrineGame, DT, NO_INPUT, SAVE_KEY, freshSave, parseSave, stageOpen, medalFor, AREAS, STAGES, SCENES, SPECIAL_NAME,
  type Input, type SaveData,
} from '@/lib/brinelight-game';
import { secretIds } from '@/lib/brinelight-levels';
import { BrineScene, type Labels } from '@/lib/brinelight-scene';
import { BrineSound, type Tune } from './sound';
import './brinelight.css';

type Screen = 'loading' | 'title' | 'map' | 'panel' | 'play' | 'results';
const ART = '/art/brinelight/';
const ORDER = Object.keys(STAGES);
/** where each district sits on the painted harbour map, in percent of the painting */
const SPOTS: [number, number][] = [[20, 74], [14, 40], [42, 20], [83, 12], [76, 37], [76, 66]];
const PANELS: Record<string, string> = {
  'panel-intro': 'Festival night in Brinelight, and Pinchwell’s crab gang has snuffed every lantern in the harbour. Dora and Enzo mean to light them all again, one string at a time.',
  'panel-quay': 'Clamps the Dockboss holds the pier from inside his barrel. Enzo can rip the barrel off him; Dora can keep him up in the air once he’s out.',
  'panel-market': 'The Gull Admiral rules the awnings. Dora knocks him out of his dives; Enzo pins him to the boards.',
  'panel-shipyard': 'Old Tanglejaw lurks under the drydock with three holes to strike from. Enzo rolls barrels over two of them; out of the last one, Dora gives him a kicking.',
};
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'];

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window: play on unsaved */ } }
function stageSecrets(id: string) {
  const sc = new Set<string>(); for (const s of STAGES[id].scenes) { sc.add(s); if (SCENES[s].secret) sc.add(SCENES[s].secret!); }
  return secretIds().filter((x) => sc.has(x.split(':')[0]));
}
const KEYNAME: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', KeyA: 'A', KeyD: 'D', KeyW: 'W', KeyS: 'S',
  KeyJ: 'J', KeyX: 'X', KeyK: 'K', KeyZ: 'Z', Space: 'Space', KeyL: 'L', KeyC: 'C', ShiftLeft: 'Shift', ShiftRight: 'Shift',
};
const ACT: Record<string, 'left' | 'right' | 'up' | 'down' | 'atk' | 'jmp' | 'tag' | 'pause'> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'atk', KeyX: 'atk', KeyK: 'jmp', KeyZ: 'jmp', Space: 'jmp', KeyL: 'tag', KeyC: 'tag', ShiftLeft: 'tag', ShiftRight: 'tag',
  Escape: 'pause', KeyP: 'pause',
};

export default function Brinelight() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BrineScene | null>(null);
  const gameRef = useRef<BrineGame | null>(null);
  const soundRef = useRef<BrineSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [area, setArea] = useState<number | null>(null);
  const [panel, setPanel] = useState<{ id: string; then: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ stage: string; score: number; time: number; medal: number; best: number; chains: number; specials: number; specialLanded: number; lanterns: number; found: number; total: number; retries: number } | null>(null);
  const S = useRef({ screen: 'loading' as Screen, paused: false, save: freshSave(), mode: 'keys' as Labels['mode'] });
  S.current.screen = screen; S.current.paused = paused; S.current.save = save;

  // ─────────────────────────────── input state (read by the loop)
  const held = useRef<Record<string, boolean>>({});
  const press = useRef({ atk: false, jmp: false, tag: false });
  const last = useRef<Record<string, string>>({ atk: 'KeyJ', jmp: 'KeyK', tag: 'KeyL', left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' });
  const stick = useRef({ id: -1, dx: 0, dy: 0 });
  const touchBtn = useRef<Record<number, 'atk' | 'jmp' | 'tag'>>({});
  const pad = useRef({ prev: [] as boolean[] });

  const labels = (): Labels => {
    const m = S.current.mode;
    if (m === 'pad') return { atk: 'X', jmp: 'A', tag: 'Y', left: '◀', right: '▶', up: '▲', down: '▼', mode: 'pad' };
    const k = (a: string) => KEYNAME[last.current[a]] ?? last.current[a];
    return { atk: k('atk'), jmp: k('jmp'), tag: k('tag'), left: k('left'), right: k('right'), up: k('up'), down: k('down'), mode: m };
  };

  const persist = useCallback((s: SaveData) => { setSave(s); writeSave(s); }, []);

  const startStage = useCallback((stage: string, seed = Math.floor(Math.random() * 1e6) + 1) => {
    const s = S.current.save;
    gameRef.current = new BrineGame({ stage, seed, assist: s.assist, found: s.found });
    sceneRef.current!.fx = [];
    setPaused(false); setScreen('play');
  }, []);
  const begin = useCallback((stage: string) => {
    const s = S.current.save, p = STAGES[stage].panel ?? (stage === '1-1' ? 'panel-intro' : undefined);
    if (p && !s.seen.includes(p)) { persist({ ...s, seen: [...s.seen, p] }); setPanel({ id: p, then: stage }); setScreen('panel'); return; }
    startStage(stage);
  }, [persist, startStage]);

  const finish = useCallback(() => {
    const g = gameRef.current!; const s = S.current.save;
    const medal = medalFor(g.stats), prev = s.cleared[g.stageId];
    const cleared = { ...s.cleared, [g.stageId]: { score: Math.max(prev?.score ?? 0, g.stats.score), time: prev ? Math.min(prev.time, g.stats.time) : g.stats.time, medal: Math.max(prev?.medal ?? 0, medal) } };
    const found = [...new Set([...s.found, ...g.newFound])];
    const ns = { ...s, cleared, found, lanterns: s.lanterns + g.stats.lanterns };
    persist(ns);
    const all = stageSecrets(g.stageId);
    setResult({ stage: g.stageId, score: g.stats.score, time: g.stats.time, medal, best: g.stats.best, chains: g.stats.tagChains, specials: g.stats.specials, specialLanded: g.stats.specialLanded, lanterns: g.stats.lanterns, found: all.filter((x) => found.includes(x)).length, total: all.length, retries: g.stats.retries });
    setScreen('results');
  }, [persist]);

  // ─────────────────────────────── boot: load the art, then the loop
  useEffect(() => {
    const cv = cvRef.current!; const sc = new BrineScene(cv); sceneRef.current = sc;
    const snd = new BrineSound(); soundRef.current = snd;
    const s = readSave(); setSave(s); S.current.save = s; snd.sfxOn = s.sound; snd.musicOn = s.music;
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch) S.current.mode = 'touch';
    const fit = () => sc.layout(innerWidth, innerHeight, devicePixelRatio, S.current.mode === 'touch');
    fit(); addEventListener('resize', fit);
    let alive = true;
    sc.load(ART).then(() => { if (!alive) return; setScreen('title'); document.querySelector('main')?.setAttribute('data-ready', 'true'); }).catch(() => setScreen('title'));

    let acc = 0, prev = performance.now(), raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      pollPad();
      const g = gameRef.current, scr = S.current.screen;
      if (scr === 'play' && g && !S.current.paused) {
        acc += dt;
        let n = 0;
        while (acc >= DT && n < 5) {
          const inp = readInput();
          g.step(inp);
          if (g.events.length) {
            for (const e of g.events) if (e.k === 'sfx') snd.sfx(e.id);
            sc.take(g.events, g); g.events.length = 0;
          }
          acc -= DT; n++;
        }
        if (g.mode === 'clear' && g.clearT > 2.2) finish();
        snd.play(g.boss && g.boss.st !== 'end' && g.boss.st !== 'gone' ? 'boss' : (AREAS[STAGES[g.stageId].area - 1].mood as Tune));
      } else { acc = 0; if (scr !== 'play') snd.play(scr === 'loading' ? null : 'map'); }
      sc.update(dt);
      if (g && (scr === 'play' || scr === 'results')) sc.draw(g, dt, { labels: labels(), hideHud: scr !== 'play' });
      else { const cx = cv.getContext('2d')!; cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#1d1b4a'; cx.fillRect(0, 0, cv.width, cv.height); }
    };
    raf = requestAnimationFrame(frame);

    // keys
    const kd = (e: KeyboardEvent) => {
      const a = ACT[e.code]; if (!a) return;
      e.preventDefault(); snd.start();
      if (S.current.mode !== 'keys') { S.current.mode = 'keys'; fit(); }
      if (a === 'pause') { if (S.current.screen === 'play') setPaused((p) => !p); return; }
      last.current[a] = e.code;
      if (!e.repeat && (a === 'atk' || a === 'jmp' || a === 'tag')) press.current[a] = true;
      held.current[a] = true; held.current[e.code] = true;
    };
    const ku = (e: KeyboardEvent) => {
      const a = ACT[e.code]; if (!a) return;
      held.current[e.code] = false;
      held.current[a] = Object.keys(ACT).some((c) => ACT[c] === a && held.current[c]);
    };
    const blur = () => { held.current = {}; stick.current = { id: -1, dx: 0, dy: 0 }; if (S.current.screen === 'play') setPaused(true); };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);

    // touch: the stick on the left, three buttons on the right
    const hitBtn = (x: number, y: number): 'atk' | 'jmp' | 'tag' | null => {
      const T = sc.tl; let best: 'atk' | 'jmp' | 'tag' | null = null, bd = 1e9;
      for (const k of ['atk', 'jmp', 'tag'] as const) { const b = T[k], d = Math.hypot(x - b.x, y - b.y); if (d < b.r * 1.3 && d < bd) { bd = d; best = k; } }
      return best;
    };
    const pd = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || S.current.screen !== 'play' || S.current.paused) return;
      snd.start();
      if (S.current.mode !== 'touch') { S.current.mode = 'touch'; fit(); }
      const b = hitBtn(e.clientX, e.clientY);
      if (b) { press.current[b] = true; held.current[b] = true; touchBtn.current[e.pointerId] = b; sc.pressed[b] = 0.12; e.preventDefault(); return; }
      const T = sc.tl;
      if (e.clientX < innerWidth * 0.5 && (sc.portrait ? e.clientY > T.panel : e.clientY > innerHeight * 0.35) && stick.current.id < 0) {
        stick.current = { id: e.pointerId, dx: 0, dy: 0 }; moveStick(e); e.preventDefault();
      }
    };
    const moveStick = (e: PointerEvent) => {
      const T = sc.tl.stick, dx = e.clientX - T.x, dy = e.clientY - T.y, d = Math.hypot(dx, dy), m = Math.min(d, T.r) / Math.max(1, d);
      stick.current.dx = dx / T.r; stick.current.dy = dy / T.r;
      sc.knob = { x: T.x + dx * m, y: T.y + dy * m, on: true };
    };
    const pm = (e: PointerEvent) => { if (e.pointerId === stick.current.id) { moveStick(e); e.preventDefault(); } };
    const pu = (e: PointerEvent) => {
      if (e.pointerId === stick.current.id) { stick.current = { id: -1, dx: 0, dy: 0 }; sc.knob.on = false; }
      const b = touchBtn.current[e.pointerId]; if (b) { held.current[b] = false; delete touchBtn.current[e.pointerId]; }
    };
    cv.addEventListener('pointerdown', pd); addEventListener('pointermove', pm, { passive: false }); addEventListener('pointerup', pu); addEventListener('pointercancel', pu);

    // gamepads: A jump, X attack, Y or a shoulder tags, Start pauses; stick or d-pad to move
    const pollPad = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads).find((p) => p && p.connected); if (!gp) return;
      const b = gp.buttons.map((x) => x.pressed), pv = pad.current.prev;
      const edge = (i: number) => b[i] && !pv[i];
      if (b.some(Boolean) || Math.abs(gp.axes[0] ?? 0) > 0.5 || Math.abs(gp.axes[1] ?? 0) > 0.5) { if (S.current.mode !== 'pad') { S.current.mode = 'pad'; fit(); } snd.start(); }
      if (S.current.mode === 'pad') {
        if (edge(2) || edge(1)) press.current.atk = true;
        if (edge(0)) press.current.jmp = true;
        if (edge(3) || edge(4) || edge(5)) press.current.tag = true;
        if (edge(9) && S.current.screen === 'play') setPaused((p) => !p);
        held.current.padAtk = !!(b[2] || b[1]); held.current.padJmp = !!b[0];
        const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
        held.current.padL = ax < -0.45 || !!b[14]; held.current.padR = ax > 0.45 || !!b[15];
        held.current.padU = ay < -0.45 || !!b[12]; held.current.padD = ay > 0.45 || !!b[13];
      }
      pad.current.prev = b;
    };
    const readInput = (): Input => {
      const h = held.current, st = stick.current;
      let mx = (h.right || h.padR ? 1 : 0) - (h.left || h.padL ? 1 : 0), mz = (h.down || h.padD ? 1 : 0) - (h.up || h.padU ? 1 : 0);
      if (st.id >= 0) { mx = st.dx > 0.38 ? 1 : st.dx < -0.38 ? -1 : 0; mz = st.dy > 0.45 ? 1 : st.dy < -0.45 ? -1 : 0; }
      const i: Input = { ...NO_INPUT, mx, mz, atkP: press.current.atk, jmpP: press.current.jmp, tagP: press.current.tag, atkH: !!(h.atk || h.padAtk), jmpH: !!(h.jmp || h.padJmp) };
      press.current = { atk: false, jmp: false, tag: false };
      return i;
    };

    (window as unknown as { __brinelight: () => unknown }).__brinelight = () => ({
      game: gameRef.current, scene: sceneRef.current, screen: S.current.screen, paused: S.current.paused, save: S.current.save,
      mode: S.current.mode, labels: labels(), start: (stage: string, seed?: number) => startStage(stage, seed),
    });
    return () => {
      alive = false; cancelAnimationFrame(raf); snd.stop();
      removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
      cv.removeEventListener('pointerdown', pd); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); removeEventListener('pointercancel', pu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (k: 'assist' | 'sound' | 'music') => {
    const s = { ...S.current.save, [k]: !S.current.save[k] }; persist(s);
    const snd = soundRef.current!; snd.sfxOn = s.sound; snd.setMusic(s.music);
    if (k === 'assist' && gameRef.current) gameRef.current.assist = s.assist;
  };
  const settings = (
    <div className="bl-settings">
      <button className="bl-btn bl-small" onClick={() => toggle('assist')} aria-pressed={save.assist}>Assist: {save.assist ? 'on' : 'off'}</button>
      <button className="bl-btn bl-small" onClick={() => toggle('sound')} aria-pressed={save.sound}>Sound: {save.sound ? 'on' : 'off'}</button>
      <button className="bl-btn bl-small" onClick={() => toggle('music')} aria-pressed={save.music}>Music: {save.music ? 'on' : 'off'}</button>
    </div>
  );
  const controls = (
    <ul className="bl-controls">
      <li><b>Move</b> arrows or WASD · stick · left stick or d-pad</li>
      <li><b>Attack</b> J or X · ATTACK · X or B</li>
      <li><b>Jump</b> K, Z or Space · JUMP · A</li>
      <li><b>Tag</b> L, C or Shift · TAG · Y or a shoulder</li>
      <li><b>Dash</b> tap left or right twice · flick the stick twice · double-tap the stick or d-pad</li>
      <li><b>Special</b> dash, jump, then attack in the air: Dora’s {SPECIAL_NAME.dora}, Enzo’s {SPECIAL_NAME.enzo}</li>
      <li><b>Double-team</b> Attack and Jump together when the Festival meter is full</li>
      <li><b>Pause</b> Esc or P · Start</li>
    </ul>
  );

  const g = gameRef.current;
  return (
    <main className="bl-shell" data-screen={screen}>
      <canvas ref={cvRef} className="bl-canvas" aria-label="Brinelight play field" />
      {screen === 'loading' && <div className="bl-loading">Lighting the lanterns…</div>}

      {screen === 'title' && (
        <div className="bl-title" style={{ backgroundImage: `url(${ART}title.webp)` }}>
          <h1>Brinelight</h1>
          <p className="bl-sub">Dora and Enzo light the harbour again</p>
          <div className="bl-row">
            <button className="bl-btn bl-big" autoFocus onClick={() => { soundRef.current?.start(); if (!save.cleared['1-1']) begin('1-1'); else setScreen('map'); }}>{save.cleared['1-1'] ? 'Continue' : 'Play'}</button>
            {save.cleared['1-1'] && <button className="bl-btn" onClick={() => { soundRef.current?.start(); setScreen('map'); }}>Harbour map</button>}
          </div>
          {settings}
          <a className="bl-back" href="/">← Arcade</a>
        </div>
      )}

      {screen === 'map' && (
        <div className="bl-map">
          <div className="bl-map-art" style={{ backgroundImage: `url(${ART}map.webp)` }}>
            {AREAS.map((a, i) => (
              <button key={a.id} className={`bl-spot${a.ready ? '' : ' bl-locked'}${area === a.id ? ' bl-on' : ''}`} style={{ left: `${SPOTS[i][0]}%`, top: `${SPOTS[i][1]}%` }}
                onClick={() => setArea(a.id)} aria-label={`${a.id}. ${a.name}${a.ready ? '' : ' (not built yet)'}`}>
                <span className="bl-num">{a.id}</span><span className="bl-spot-name">{a.name}</span>
              </button>
            ))}
          </div>
          <div className="bl-card bl-area">
            {area === null ? (
              <><h2>The harbour</h2><p>Pick a district. Lanterns relit so far: {save.lanterns}.</p></>
            ) : (() => {
              const a = AREAS[area - 1];
              return (
                <>
                  <h2>{a.id}. {a.name}</h2>
                  <p>{a.blurb}</p>
                  {a.ready ? a.stages.map((id) => {
                    const open = stageOpen(save, id), c = save.cleared[id], all = stageSecrets(id), got = all.filter((x) => save.found.includes(x)).length;
                    return (
                      <button key={id} className="bl-stage" disabled={!open} onClick={() => begin(id)}>
                        <b>{id} · {STAGES[id].name}</b>
                        <small>{open ? (c ? `${MEDAL[c.medal]} · best ${c.score}` : 'not cleared yet') : 'locked'}{all.length ? ` · secrets ${got}/${all.length}` : ''}</small>
                      </button>
                    );
                  }) : <p className="bl-dim">Not built yet. Boss: {a.boss}.</p>}
                </>
              );
            })()}
            <div className="bl-row">
              <button className="bl-btn bl-small" onClick={() => setScreen('title')}>Title</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'panel' && panel && (
        <div className="bl-panel" onClick={() => startStage(panel.then)}>
          <img src={`${ART}${panel.id}.webp`} alt="" />
          <p>{PANELS[panel.id]}</p>
          <button className="bl-btn" autoFocus onClick={(e) => { e.stopPropagation(); startStage(panel.then); }}>Go</button>
        </div>
      )}

      {screen === 'play' && (
        <button className="bl-pause-btn" aria-label="Pause" onClick={() => setPaused(true)}>II</button>
      )}
      {screen === 'play' && paused && g && (
        <div className="bl-overlay">
          <div className="bl-card">
            <h2>Paused · {g.stageId} {STAGES[g.stageId].name}</h2>
            {settings}
            {controls}
            <div className="bl-row">
              <button className="bl-btn" autoFocus onClick={() => setPaused(false)}>Resume</button>
              <button className="bl-btn bl-small" onClick={() => startStage(g.stageId)}>Restart</button>
              <button className="bl-btn bl-small" onClick={() => { setPaused(false); setArea(STAGES[g.stageId].area); setScreen('map'); }}>Map</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'results' && result && (
        <div className="bl-overlay">
          <div className="bl-card bl-results">
            <h2>{result.stage} · {STAGES[result.stage].name}: cleared!</h2>
            <img className={`bl-medal bl-m${result.medal}`} src={`${ART}medal.webp`} alt="" />
            <p className="bl-medal-name">{MEDAL[result.medal]} medal</p>
            <dl>
              <dt>Score</dt><dd>{result.score}</dd>
              <dt>Time</dt><dd>{Math.floor(result.time / 60)}:{String(Math.floor(result.time % 60)).padStart(2, '0')}</dd>
              <dt>Best combo</dt><dd>{result.best}</dd>
              <dt>Tag chains</dt><dd>{result.chains}</dd>
              <dt>Specials landed</dt><dd>{result.specialLanded} of {result.specials}</dd>
              <dt>Lanterns relit</dt><dd>{result.lanterns}</dd>
              <dt>Secrets</dt><dd>{result.found}/{result.total}</dd>
              <dt>Retries</dt><dd>{result.retries}</dd>
            </dl>
            <div className="bl-row">
              {ORDER.indexOf(result.stage) < ORDER.length - 1 && <button className="bl-btn" autoFocus onClick={() => begin(ORDER[ORDER.indexOf(result.stage) + 1])}>Next stage</button>}
              <button className="bl-btn bl-small" onClick={() => startStage(result.stage)}>Play again</button>
              <button className="bl-btn bl-small" onClick={() => { setArea(STAGES[result.stage].area); setScreen('map'); }}>Map</button>
            </div>
            {result.stage === '2-3' && <p className="bl-dim">That’s the Fish Market lit. The Ropewalk, the Lighthouse Rocks, the Smugglers’ Caves and Pinchwell’s fort come later.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
