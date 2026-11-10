'use client';
// Cloudsteel: the page. Input (keys, mouse, a touch stick and buttons), the fight loop with its brief slow-motion on
// a deflect, the HUD (Dora's health and guard, the locked foe's health and posture, the hit count, Enzo's tag meter,
// a prompt for what to do next), the fall and retry, results, the ending and the save.
// Rules in lib/cloudsteel-game.ts, drawing in lib/cloudsteel-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/cloudsteel-game';
import type { Fight, FightEvent, Result, Save } from '@/lib/cloudsteel-game';
import type { CloudsteelScene } from '@/lib/cloudsteel-scene';
import { CloudsteelSound } from './sound';
import './cloudsteel.css';

type Screen = 'title' | 'howto' | 'settings' | 'fight' | 'result' | 'ending';
type Tap = 'attack' | 'dodge' | 'tag' | 'swap';
type Done = { result: Result; best: boolean; first: boolean };

const art = (n: string) => `/art/cloudsteel/${n}.webp`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const RANK: Record<Result['rank'], { name: string; line: string }> = {
  gold: { name: 'Gold seal', line: 'Barely touched, and never down.' },
  silver: { name: 'Silver seal', line: 'A clean crossing. Take fewer hits, and never fall, for gold.' },
  bronze: { name: 'Bronze seal', line: 'You made it across. Guard at the gold glint to take less.' },
};
const FACE: Record<G.FoeKind, string> = { fox: 'portrait-atoq', bear: 'portrait-ukhu' };

export default function CloudsteelPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CloudsteelScene | null>(null);
  const soundRef = useRef<CloudsteelSound | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [backend, setBackend] = useState('');
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const fightRef = useRef<Fight | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [fallen, setFallen] = useState(false);
  const [touch, setTouch] = useState(false);
  const [fromFight, setFromFight] = useState(false);
  const keys = useRef(new Set<string>());
  /** presses since the last tick, so a tap quicker than a frame still counts */
  const taps = useRef(new Set<Tap>());
  const sent = useRef<G.Input>(G.idleInput());
  const stick = useRef({ x: 0, y: 0, id: -1, ox: 0, oy: 0 });
  const held = useRef({ guard: false, mouseGuard: false });
  const reduced = useRef(false);
  const slow = useRef(0);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const last = useRef({ hp: -1, post: -1, fhp: -1, fpost: -1, foe: -2, combo: -1, tag: -1, prompt: '', broken: false });

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
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new CloudsteelSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/cloudsteel-scene').then((m) => m.CloudsteelScene.create(canvasRef.current!, s.settings.fx)).then((sc) => {
      if (gone) { sc.dispose(); return; }
      sceneRef.current = sc; setBackend(sc.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'); setReady(true);
    }).catch(() => setFailed(true));
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'fight') setPaused(true); } else soundRef.current?.resume(); };
    const rs = () => sceneRef.current?.resize();
    document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); sceneRef.current?.dispose(); sceneRef.current = null; soundRef.current?.dispose(); };
  }, [setPaused]);

  useEffect(() => {
    const g = fightRef.current;
    sfx()?.music(screen === 'fight' && g ? (g.round === 2 ? 'boss' : 'fight') : screen === 'ending' ? 'ending' : 'menu');
    sfx()?.ambience(screen === 'fight');
    if (screen === 'fight') requestAnimationFrame(() => sceneRef.current?.resize());
  }, [screen]);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- a fight
  const startFight = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const s = saveRef.current;
    if (!s.seenHow) { persist({ ...s, seenHow: true }); setFromFight(true); setScreen('howto'); return; }
    fightRef.current = new G.Fight((Math.random() * 2 ** 31) | 0, s.settings.assist);
    persist({ ...s, fights: s.fights + 1 });
    taps.current.clear(); sent.current = G.idleInput(); slow.current = 0; setFallen(false); setPaused(false); setDone(null);
    last.current = { hp: -1, post: -1, fhp: -1, fpost: -1, foe: -2, combo: -1, tag: -1, prompt: '', broken: false };
    setScreen('fight');
  }, [persist, setPaused, setScreen]);

  const banner = (text: string, kind: string) => {
    const el = hud.current.banner; if (!el) return;
    el.textContent = text; el.dataset.kind = kind; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  };
  const onEvents = useCallback((g: Fight, evs: FightEvent[]) => {
    const snd = sfx(), sc = sceneRef.current;
    for (const e of evs) {
      sc?.event(e, g, reduced.current);
      switch (e.t) {
        case 'round': banner(`Round ${e.n + 1} · ${G.ROUNDS[e.n].title}`, 'round'); snd?.round(); snd?.music(e.n === 2 ? 'boss' : 'fight'); break;
        case 'swing': snd?.swing(e.n); break;
        case 'hit': snd?.hit(e.heavy); break;
        case 'deflect': snd?.deflect(); banner('Deflect', 'gold'); if (!reduced.current) slow.current = 0.16; break;
        case 'block': snd?.block(); break;
        case 'parried': snd?.parried(); banner('Turned aside', 'steel'); break;
        case 'hurt': snd?.hurt(); break;
        case 'dodge': snd?.dodge(); break;
        case 'windup': snd?.tell(e.jade); break;
        case 'broken': snd?.broken(); banner('Posture broken', 'gold'); break;
        case 'guardBroken': snd?.broken(); banner('Guard broken', 'jade'); break;
        case 'finisher': snd?.finisher(); break;
        case 'finisherHit': banner('Cloudsteel', 'gold'); if (!reduced.current) slow.current = 0.22; break;
        case 'tagReady': snd?.tagReady(); break;
        case 'tag': snd?.tag(); banner('Enzo!', 'gold'); break;
        case 'tagHit': snd?.hit(true); break;
        case 'clear': snd?.clear(); banner(e.n + 1 < G.ROUNDS.length ? 'Round cleared' : 'The bridge is yours', 'gold'); break;
        case 'lost': snd?.lost(); setFallen(true); break;
        case 'won': snd?.won(); break;
      }
    }
  }, []);
  const finish = useCallback(() => {
    const g = fightRef.current; if (!g) return;
    const result = g.result(), s = saveRef.current, best = G.better(result, s.best), first = s.wins === 0;
    persist({ ...s, wins: s.wins + 1, best: best ? result : s.best });
    setDone({ result, best, first }); setScreen('result');
  }, [persist, setScreen]);
  const retry = () => { sfx()?.button(); fightRef.current?.retryRound(); setFallen(false); };
  const quit = () => { sfx()?.button(); fightRef.current = null; setPaused(false); setFallen(false); setScreen('title'); };

  const readInput = useCallback((): G.Input => {
    const k = keys.current, st = stick.current, yaw = sceneRef.current?.camYaw ?? Math.PI;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (st.id >= 0) { x = Math.abs(st.x) < 0.18 ? 0 : st.x; y = Math.abs(st.y) < 0.18 ? 0 : st.y; }
    // forward on the stick is away from the camera; right is the camera's right
    const f = -y, wx = Math.sin(yaw) * f - Math.cos(yaw) * x, wz = Math.cos(yaw) * f + Math.sin(yaw) * x;
    return { x: wx, z: wz, attack: false, dodge: false, tag: false, swap: false, guard: k.has('KeyK') || k.has('ShiftLeft') || k.has('ShiftRight') || held.current.guard || held.current.mouseGuard };
  }, []);

  useEffect(() => {
    let raf = 0, prev = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const real = Math.min(0.1, (now - prev) / 1000); prev = now;
      const snd = sfx(); snd?.pump();
      const g = fightRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'fight' || !g || !sc) return;
      // a deflect or a finisher slows time for a moment
      let dt = real; if (slow.current > 0) { slow.current -= real; dt = real * 0.22; }
      if (pausedRef.current) dt = 0;
      if (dt > 0) {
        const inp = readInput(); acc += dt; let n = 0;
        while (acc >= G.DT && n < 8) {
          const ti = { ...inp };
          // a latched tap becomes one tick with the button down, after a tick with it up
          for (const b of ['attack', 'dodge', 'tag', 'swap'] as const) if (taps.current.has(b) && !sent.current[b]) { ti[b] = true; taps.current.delete(b); }
          g.tick(ti); sent.current = ti;
          if (g.events.length) onEvents(g, g.events);
          acc -= G.DT; n++;
        }
      } else acc = 0;
      if (g.phase === 'won') { endT += real; if (endT > 3.2) { endT = 0; finish(); return; } } else endT = 0;
      sc.render(g, dt, reduced.current);
      // the HUD, straight to the DOM
      const h = hud.current, L = last.current, tg = g.targetFoe;
      const hp = Math.round(g.hp); if (h.hp && L.hp !== hp) { L.hp = hp; h.hp.style.transform = `scaleX(${g.hp / g.maxHp})`; h.hp.parentElement!.dataset.low = g.hp < 30 ? '1' : '0'; }
      const post = Math.round(g.posture); if (h.post && L.post !== post) { L.post = post; h.post.style.transform = `scaleX(${g.posture / 100})`; }
      const fid = tg ? tg.id : -1;
      if (h.foe && L.foe !== fid) { L.foe = fid; h.foe.dataset.on = tg ? '1' : '0'; if (tg) { if (h.fname) h.fname.textContent = tg.name; const im = h.fface as HTMLImageElement | null; if (im) im.src = art(FACE[tg.kind]); } L.fhp = -1; L.fpost = -1; }
      if (tg) {
        const fhp = Math.round(tg.hp); if (h.fhp && L.fhp !== fhp) { L.fhp = fhp; h.fhp.style.transform = `scaleX(${tg.hp / tg.maxHp})`; }
        const fp = Math.round(tg.posture), br = tg.state === 'broken';
        if (h.fpost && (L.fpost !== fp || L.broken !== br)) { L.fpost = fp; L.broken = br; h.fpost.style.transform = `scaleX(${br ? 1 : tg.posture / tg.maxPosture})`; h.foe!.dataset.broken = br ? '1' : '0'; }
      }
      if (h.combo && L.combo !== g.combo) { L.combo = g.combo; h.combo.dataset.on = g.combo >= 2 ? '1' : '0'; if (h.cnum) { h.cnum.textContent = `x${g.combo}`; h.cnum.classList.remove('pop'); void h.cnum.offsetWidth; h.cnum.classList.add('pop'); } }
      const tag = Math.round(g.tag); if (h.tag && L.tag !== tag) { L.tag = tag; h.tag.style.transform = `scaleX(${g.tag / G.TAG_FULL})`; h.tagbox!.dataset.full = g.tag >= G.TAG_FULL ? '1' : '0'; }
      // what to do next, when help is on
      let prompt = '';
      if (g.assist && g.phase === 'fight' && g.state !== 'dead') {
        const threat = g.foes.find((f) => f.state === 'windup' && f.atk), open = g.living.find((f) => f.state === 'broken');
        if (threat?.atk) prompt = threat.atk.jade ? 'dodge' : 'guard'; else if (open) prompt = 'finish'; else if (g.tag >= G.TAG_FULL) prompt = 'tag';
      }
      if (h.prompt && L.prompt !== prompt) { L.prompt = prompt; h.prompt.dataset.kind = prompt; h.prompt.dataset.on = prompt ? '1' : '0'; }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput]);

  // ---------------------------------------------------------------- keyboard, mouse and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'fight') return;
      if (/^(Arrow|Space|Tab)/.test(e.code)) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat && fightRef.current?.phase !== 'lost') setPaused(!pausedRef.current); return; }
      keys.current.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyJ') taps.current.add('attack');
      if (e.code === 'Space') taps.current.add('dodge');
      if (e.code === 'KeyE') taps.current.add('tag');
      if (e.code === 'KeyQ' || e.code === 'Tab') taps.current.add('swap');
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); held.current.mouseGuard = false; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, [setPaused]);
  const mouseDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || screenRef.current !== 'fight') return;
    sfx()?.unlock();
    if (e.button === 0) taps.current.add('attack'); else if (e.button === 2) held.current.mouseGuard = true;
  };
  const mouseUp = (e: React.PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 2) held.current.mouseGuard = false; };
  const stickDown = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); stick.current = { x: 0, y: 0, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); stickMove(e); };
  const stickMove = (e: React.PointerEvent) => {
    const st = stick.current; if (st.id !== e.pointerId) return;
    const dx = e.clientX - st.ox, dy = e.clientY - st.oy, R = 46, Ln = Math.hypot(dx, dy), k = Ln > R ? R / Ln : 1;
    st.x = (dx * k) / R; st.y = (dy * k) / R;
    const knob = hud.current.knob; if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const stickUp = (e: React.PointerEvent) => { if (stick.current.id !== e.pointerId) return; stick.current = { x: 0, y: 0, id: -1, ox: 0, oy: 0 }; const knob = hud.current.knob; if (knob) knob.style.transform = ''; };
  const tb = (k: Tap) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); taps.current.add(k); sfx()?.unlock(); } });
  const guardBtn = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); held.current.guard = true; sfx()?.unlock(); }, onPointerUp: () => { held.current.guard = false; }, onPointerCancel: () => { held.current.guard = false; }, onPointerLeave: () => { held.current.guard = false; } };

  // ---------------------------------------------------------------- menus
  const setSetting = (k: 'assist' | 'sound' | 'music' | 'fx', v: boolean) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s);
    if (k === 'sound') sfx()?.setSound(v); if (k === 'music') sfx()?.setMusic(v);
    sfx()?.unlock(); sfx()?.button();
  };
  const leaveHow = () => { if (fromFight) { setFromFight(false); startFight(); } else go('title'); };

  // for the browser tests
  useEffect(() => {
    (window as unknown as { __cloudsteel?: () => unknown }).__cloudsteel = () => {
      const g = fightRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, done, backend,
        fight: g && screenRef.current === 'fight' ? { phase: g.phase, round: g.round, state: g.state, x: g.x, z: g.z, hp: g.hp, posture: g.posture, tag: g.tag, combo: g.combo, target: g.target, face: g.face, stats: { ...g.stats }, enzo: g.enzo.state,
          foes: g.foes.map((f) => ({ id: f.id, kind: f.kind, state: f.state, hp: f.hp, posture: f.posture, x: f.x, z: f.z })) } : null,
        debug: {
          tag: (v: number) => { if (g) g.tag = v; },
          foeHp: (v: number) => { if (g) for (const f of g.living) f.hp = v; },
          foePosture: (v: number) => { if (g) for (const f of g.living) f.posture = v; },
          hp: (v: number) => { if (g) g.hp = v; },
          place: (x: number, z: number) => { if (g) { g.x = x; g.z = z; } },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save;
  return <main className={`cs-shell cs-on-${screen}${touch ? ' cs-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <canvas ref={canvasRef} className="cs-canvas" aria-label="Cloudsteel: the terrace" onPointerDown={mouseDown} onPointerUp={mouseUp} onContextMenu={(e) => e.preventDefault()} />

    {screen === 'title' && <section className="cs-title">
      <div className="cs-bg"><img src={art('title')} alt="Dora and Enzo back to back on a rain-soaked terrace under the moon" /></div>
      <div className="cs-title-col">
        <h1 className="cs-logo">Cloudsteel</h1>
        <p className="cs-tag">One terrace, three rounds, and the bridge beyond. Guard at the last moment and the night is yours.</p>
        <div className="cs-menu">
          <button className="cs-go" disabled={!ready} onClick={startFight}>{failed ? 'This browser cannot draw the terrace' : ready ? (s.fights ? 'Step onto the terrace' : 'Begin') : 'Loading…'}</button>
          <button onClick={() => go('howto')}>How to fight</button>
          <button onClick={() => go('settings')}>Settings</button>
          {s.wins > 0 && <button onClick={() => go('ending')}>The Condor Gate</button>}
        </div>
        {s.best && <p className="cs-best" data-rank={s.best.rank}><i />Best: {RANK[s.best.rank].name} · {clock(s.best.seconds)} · {s.best.deflects} deflects</p>}
        <a className="cs-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'fight' && <section className="cs-hud">
      <div className="cs-foe" ref={H('foe')} data-on="0" data-broken="0">
        <span className="cs-face small"><img ref={H('fface') as (el: HTMLImageElement | null) => void} src={art('portrait-atoq')} alt="" /></span>
        <div className="cs-foe-bars">
          <b ref={H('fname')} />
          <span className="cs-bar foe"><i ref={H('fhp')} /></span>
          <span className="cs-bar posture"><i ref={H('fpost')} /></span>
          <em>Posture broken</em>
        </div>
      </div>
      <div className="cs-banner" ref={H('banner')} />
      <div className="cs-combo" ref={H('combo')} data-on="0"><b ref={H('cnum')}>x0</b><span>Hits</span></div>
      <div className="cs-prompt" ref={H('prompt')} data-on="0" data-kind="">
        <span data-p="guard"><img src={art('icon-guard')} alt="" />Guard now<kbd>{touch ? 'GUARD' : 'K'}</kbd></span>
        <span data-p="dodge"><img src={art('icon-dodge')} alt="" />Dodge away<kbd>{touch ? 'DODGE' : 'Space'}</kbd></span>
        <span data-p="finish"><img src={art('icon-cut')} alt="" />Finish it<kbd>{touch ? 'CUT' : 'J'}</kbd></span>
        <span data-p="tag"><img src={art('icon-tag')} alt="" />Call Enzo<kbd>{touch ? 'ENZO' : 'E'}</kbd></span>
      </div>
      <div className="cs-hero">
        <span className="cs-face"><img src={art('portrait-dora')} alt="" /></span>
        <div className="cs-hero-bars">
          <b>Dora</b>
          <span className="cs-bar hp" data-low="0"><i ref={H('hp')} /></span>
          <span className="cs-bar guard"><i ref={H('post')} /></span>
        </div>
      </div>
      <div className="cs-tagbox" ref={H('tagbox')} data-full="0">
        <span className="cs-face"><img src={art('portrait-enzo')} alt="" /></span>
        <div><b>Enzo</b><span className="cs-bar tag"><i ref={H('tag')} /></span><em>{touch ? 'Tap ENZO' : 'Press E'}</em></div>
      </div>
      <button className="cs-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      {!touch && <p className="cs-keys"><b>WASD</b> move · <b>J</b> or click: cut · hold <b>K</b> or right-click: guard · <b>Space</b> dodge · <b>E</b> Enzo · <b>Q</b> next foe · Esc pause</p>}
      {touch && <div className="cs-touchpad">
        <div className="cs-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
        <div className="cs-tbtns">
          <button className="t-tag" {...tb('tag')}>ENZO</button><button className="t-dodge" {...tb('dodge')}>DODGE</button>
          <button className="t-guard" {...guardBtn}>GUARD</button><button className="t-cut" {...tb('attack')}>CUT</button>
        </div>
      </div>}
      {fallen && <div className="cs-veil"><div className="cs-card">
        <h2>Dora is down</h2>
        <p>Catch your breath. The round starts again on full health, and what you learned stays with you.</p>
        <button className="cs-go" onClick={retry}>Stand up and try the round again</button>
        <button onClick={quit}>Leave the terrace</button>
      </div></div>}
      {paused && !fallen && <div className="cs-veil"><div className="cs-card">
        <h2>Paused</h2>
        <button className="cs-go" onClick={() => setPaused(false)}>Back to the fight</button>
        <button onClick={() => setSetting('assist', !s.settings.assist)}>Help: {s.settings.assist ? 'on (applies from the next fight)' : 'off (applies from the next fight)'}</button>
        <button onClick={quit}>Leave the terrace (nothing saved)</button>
      </div></div>}
    </section>}

    {screen === 'result' && done && <section className="cs-page">
      <div className="cs-card cs-result" data-rank={done.result.rank}>
        <p className="cs-eyebrow">The bridge is yours</p>
        <h2><i className="cs-seal" />{RANK[done.result.rank].name}{done.best && <em> New best</em>}</h2>
        <p>{RANK[done.result.rank].line}</p>
        <dl className="cs-stats">
          <div><dt>Time</dt><dd>{clock(done.result.seconds)}</dd></div>
          <div><dt>Deflects</dt><dd>{done.result.deflects}</dd></div>
          <div><dt>Longest chain</dt><dd>{done.result.bestCombo} hits</dd></div>
          <div><dt>Damage taken</dt><dd>{done.result.damage}</dd></div>
          <div><dt>Falls</dt><dd>{done.result.falls}</dd></div>
          <div><dt>Score</dt><dd>{done.result.score.toLocaleString('en-GB')}</dd></div>
        </dl>
        <div className="cs-row">
          <button className="cs-go" onClick={() => go('ending')}>{done.first ? 'Cross the bridge ›' : 'The Condor Gate ›'}</button>
          <button onClick={startFight}>Fight again</button>
          <button onClick={() => go('title')}>Title</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="cs-ending">
      <div className="cs-bg"><img src={art('ending')} alt="At dawn Ukhu bows Dora and Enzo onto the rope bridge towards the Condor Gate" /></div>
      <div className="cs-ending-text">
        <h2>The Condor Gate</h2>
        <p>Ukhu sets down his glaive. “Three hundred winters I have kept this bridge,” he rumbles, “and nobody has turned my blade twice.” He bows them through. Enzo lifts the lantern, Dora wipes the rain from her sword, and the first light finds the gate across the gorge.</p>
        <p className="cs-small">{s.best ? `Your best crossing: ${RANK[s.best.rank].name}, ${clock(s.best.seconds)}. ` : ''}What’s next: the road beyond the gate is not built yet. Until then, the terrace is open for a cleaner seal.</p>
        <div className="cs-row"><button className="cs-go" onClick={startFight}>Fight again</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="cs-page">
      <header className="cs-head"><button className="cs-back" onClick={leaveHow}>{fromFight ? 'Start the fight ›' : '‹ Title'}</button><h2>How to fight</h2></header>
      <div className="cs-cols">
        <div className="cs-card"><img className="cs-ico" src={art('icon-cut')} alt="" /><h3>Cut</h3><p><b>{touch ? 'CUT' : 'J or click'}</b>. Press again for a chain of three; the third is heavy. Dora steps in to the foe she is locked on to. After three cuts a foe turns the next one aside and answers, so be ready to guard.</p></div>
        <div className="cs-card"><img className="cs-ico" src={art('icon-guard')} alt="" /><h3>Guard and deflect</h3><p>Hold <b>{touch ? 'GUARD' : 'K or right-click'}</b> to block steel. Press it just as a blow lands, at the <b className="cs-gold">gold glint</b>, to <b>deflect</b>: no harm to you, and the foe’s posture bar fills. Blocking late fills your own guard bar instead.</p></div>
        <div className="cs-card"><img className="cs-ico" src={art('icon-dodge')} alt="" /><h3>Dodge</h3><p><b>{touch ? 'DODGE' : 'Space'}</b> rolls the way you are moving. A <b className="cs-jade">jade ring</b> on the ground means the blow cannot be guarded: get out of the ring or roll through it.</p></div>
        <div className="cs-card"><img className="cs-ico" src={art('icon-tag')} alt="" /><h3>Break, finish, call Enzo</h3><p>A full posture bar breaks a foe open: cut then for the finisher. Hits, deflects and dodges fill Enzo’s meter; <b>{touch ? 'ENZO' : 'E'}</b> calls him in with his lantern to stagger everything near. <b>{touch ? 'Foes take turns' : 'Q'}</b>{touch ? ' to attack, and Dora locks on to the nearest.' : ' switches to the next foe.'}</p></div>
      </div>
      <p className="cs-small cs-centre">Help is on: foes wind up more slowly, the deflect moment is wider, and a prompt tells you when to guard, dodge or finish. Turn it off in Settings for the full duel.</p>
    </section>}

    {screen === 'settings' && <section className="cs-page">
      <header className="cs-head"><button className="cs-back" onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="cs-card cs-settings">
        {([['assist', 'Help', 'Slower wind-ups, a wider deflect moment, less damage, prompts'], ['sound', 'Sound', ''], ['music', 'Music', ''], ['fx', 'Effects', 'Wet-floor reflections and lantern glow. Turn off on a slow device (reloads the page)']] as const).map(([k, name, note]) =>
          <div className="cs-set" key={k}><span><b>{name}</b>{note && <small>{note}</small>}</span><span className="cs-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings[k] === v ? 'on' : ''} aria-pressed={s.settings[k] === v} onClick={() => { setSetting(k, v); if (k === 'fx' && v !== s.settings.fx) location.reload(); }}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <p className="cs-small">{s.fights} fights · {s.wins} crossings{backend ? ` · drawn with ${backend}` : ''}</p>
        <button className="cs-danger" onClick={() => { if (window.confirm('Clear your Cloudsteel record and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Clear my record</button>
      </div>
    </section>}
  </main>;
}
