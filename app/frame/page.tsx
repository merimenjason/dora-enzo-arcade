'use client';
// Out of Frame: the page. Input (the mouse aims the frame, keys nudge it, a finger drags it), the fixed-step loop, the
// HUD, Enzo's pointers, picking a lens between screens, results, the ending and the save. Rules in lib/frame-game.ts,
// drawing in lib/frame-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/frame-game';
import type { Ev, Kind, LensId, Run, Save } from '@/lib/frame-game';
import type { FrameScene } from '@/lib/frame-scene';
import { FrameSound, type SongId } from './sound';
import './frame.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; screen: number; acorns: number; stomps: number; hits: number; secs: number; best: boolean; film: boolean };

const art = (n: string) => `/art/frame/${n}.png`;
const INTRO = [
  'Dora’s off to find the old temple, and I’m filming the whole thing! Only… my camera’s a bit strange.',
  'Whatever’s inside my viewfinder moves. Everything outside it stops dead: Grumbles, boulders, arrows, Dora too.',
  'So point the frame at Dora to keep her walking, and leave the danger out of the picture. A frozen thing is just a step!',
  'Mind the film, though. It runs down all the time, and if it runs out, that’s the end of the show.',
];
const DORA_AIM = { x: 40, y: -20 };

export default function OutOfFramePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FrameScene | null>(null);
  const soundRef = useRef<FrameSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const runRef = useRef<Run | null>(null);
  const [phase, setPhase] = useState<G.Phase>('play');
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [intro, setIntro] = useState(-1);
  const introRef = useRef(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [touch, setTouch] = useState(false);
  const [hudTick, setHudTick] = useState(0);
  const keys = useRef(new Set<string>());
  /** where the frame's centre is heading, in game pixels */
  const aim = useRef({ x: 0, y: 0 });
  const jumpTap = useRef(false);
  const jumpBtn = useRef(false);
  const mouseDown = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const reduced = useRef(false);
  const said = useRef(new Set<string>());
  const started = useRef(0);
  const lowTick = useRef(0);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;
  const say = useCallback((text: string, mood: Line['mood'] = '', once?: string) => {
    if (once) { if (said.current.has(once)) return; said.current.add(once); }
    setLine({ text, key: Math.random(), mood }); sfx()?.enzo(text);
  }, []);
  const aimAtDora = () => { const r = runRef.current; if (r) aim.current = { x: r.dora.x + DORA_AIM.x, y: r.dora.y - G.DORA.face + DORA_AIM.y }; };

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new FrameSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/frame-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.FrameScene(canvasRef.current); sceneRef.current = sc;
      void sc.load(); setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'play' && runRef.current?.phase === 'play') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, [setPaused]);

  // the music for each screen: one loop for each place
  useEffect(() => {
    const r = runRef.current;
    const song: SongId | null = screen === 'play' && r ? r.biome.id : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song);
  }, [screen, result, hudTick]);

  // fit the screen to the window, at a whole number of screen pixels per game pixel when that is close enough
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      const pad = touch && innerHeight > innerWidth ? 150 : 0;
      const aw = innerWidth, ah = innerHeight - pad;
      let s = Math.min(aw / G.W, ah / G.H); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      st.style.width = `${Math.floor(G.W * s)}px`; st.style.height = `${Math.floor(G.H * s)}px`;
      st.style.top = pad ? `${Math.max(0, Math.floor((ah - G.H * s) / 2))}px` : '';
    };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [touch, screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };
  const hint = useCallback(() => (touch ? 'Drag to move my viewfinder. Tap JUMP to hop gaps!' : 'Move the mouse to point my viewfinder. Click or Space to jump!'), [touch]);

  // ---------------------------------------------------------------- the run
  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const r = new G.Run((Date.now() & 0xffffff) | 1);
    runRef.current = r; said.current.clear(); started.current = performance.now(); aimAtDora();
    setPaused(false); setResult(null); setLine(null); setPhase('play'); setBanner({ text: `${r.biome.name} · 1`, key: Math.random() });
    setScreen('play');
    if (!saveRef.current.intro) { introRef.current = 0; setIntro(0); sfx()?.enzo(INTRO[0]); }
    else say(hint());
  }, [hint, say, setPaused, setScreen]);

  const nextIntro = useCallback(() => {
    if (introRef.current < 0) return; sfx()?.button();
    const n = introRef.current + 1;
    if (n >= INTRO.length) { introRef.current = -1; setIntro(-1); persist({ ...saveRef.current, intro: true }); say(hint()); return; }
    introRef.current = n; setIntro(n); sfx()?.enzo(INTRO[n]);
  }, [hint, persist, say]);

  const finish = useCallback(() => {
    const r = runRef.current; if (!r) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = s.best.screen; G.bank(s, r); persist(s);
    const won = r.phase === 'won';
    setResult({ won, screen: won ? G.SCREENS : r.screen + 1, acorns: r.stats.acorns, stomps: r.stats.stomps, hits: r.stats.hits + r.stats.falls, secs: Math.round(r.stats.time), best: s.best.screen > before, film: !won && r.film <= 0 });
    sfx()?.stinger(won);
    setScreen('result');
  }, [persist, setScreen]);

  const onEvents = useCallback((r: Run, evs: Ev[]) => {
    const snd = sfx();
    sceneRef.current?.events(r, evs, reduced.current);
    for (const e of evs) {
      switch (e.k) {
        case 'jump': snd?.jump(); break;
        case 'hop': snd?.hop(); break;
        case 'land': snd?.land(); break;
        case 'stomp': snd?.stomp(); say('Boing! Right on its head.', 'good', 'stomp'); break;
        case 'hurt': snd?.hurt(); if (r.dora.hp === 1) say('One heart left! Careful, Dora!', 'warn', 'low'); break;
        case 'fall': snd?.splash(); say('Splash! Keep her on solid ground, or freeze the gap shut with something.', 'warn', 'fall'); break;
        case 'acorn': snd?.acorn(); break;
        case 'film': snd?.film(); say('A fresh roll of film! That’s ten more seconds.', 'good', 'film'); break;
        case 'heart': snd?.heart(); break;
        case 'arrow': if (r.inFrame(e.x, e.y)) snd?.arrow(); break;
        case 'stick': snd?.stick(); say('That arrow’s stuck fast. Something to stand on!', '', 'stick'); break;
        case 'tink': snd?.tink(); break;
        case 'boulder': snd?.boulder(); break;
        case 'drop': snd?.drop(); break;
        case 'break': snd?.crash(); break;
        case 'crumble': snd?.crumble(); break;
        case 'freeze': if (r.phase === 'play') { snd?.freeze(); say('Dora’s out of the picture, so she’s frozen. Bring her back in!', '', 'frozen'); } break;
        case 'thaw': break;
        case 'clear':
          snd?.clear();
          if (r.phase === 'pick') { setPhase('pick'); say((r.screen + 1) % G.PER_BIOME === 0 ? 'That’s a wrap on this place! Have a heart back, and pick a lens.' : 'Cut! Lovely shot. Pick a lens for my camera.', 'good'); }
          break;
      }
    }
  }, [say]);

  const readInput = useCallback((dt: number): G.Input => {
    const k = keys.current, a = aim.current;
    const x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (x || y) { a.x += x * 300 * dt; a.y += y * 300 * dt; }
    a.x = Math.max(0, Math.min(G.W, a.x)); a.y = Math.max(0, Math.min(G.H, a.y));
    return { tx: a.x, ty: a.y, jump: k.has('Space') || k.has('KeyJ') || k.has('KeyZ') || mouseDown.current || jumpBtn.current };
  }, []);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const snd = sfx(); snd?.pump();
      const r = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !r || !sc) return;
      const going = !pausedRef.current && introRef.current < 0 && r.phase === 'play';
      const inp = readInput(going ? dt : 0);
      if (going) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 6) {
          // a jump pressed and let go within one frame still counts
          const ti = { ...inp };
          if (jumpTap.current) { if (inp.jump) jumpTap.current = false; else if (r.dora.held) ti.jump = false; else { ti.jump = true; jumpTap.current = false; } }
          r.tick(ti);
          if (r.events.length) onEvents(r, r.events); acc -= G.DT; n++; if (r.phase !== 'play') break;
        }
        if (r.film < 10 && Math.floor(r.film) !== lowTick.current) { lowTick.current = Math.floor(r.film); snd?.low(); say('The film’s nearly out! Hurry to the right!', 'warn', 'lowfilm'); }
      } else acc = 0;
      if (r.over) { endT += dt; if (endT > 1.4) { endT = 0; finish(); return; } } else endT = 0;
      sc.render({ run: r, time: now / 1000, dt: going || r.over ? dt : 0, reduced: reduced.current });
      // the HUD, straight to the DOM
      const h = hud.current;
      if (h.film) h.film.style.transform = `scaleX(${Math.max(0, r.film / r.filmMax)})`;
      if (h.filmN) { const t = String(Math.ceil(r.film)); if (h.filmN.textContent !== t) h.filmN.textContent = t; }
      if (h.reel) h.reel.dataset.low = r.film < 10 ? '1' : '0';
      if (h.acorns) { const t = String(r.stats.acorns); if (h.acorns.textContent !== t) h.acorns.textContent = t; }
      if (h.hearts && h.hearts.dataset.v !== `${r.dora.hp}/${r.hpMax}`) { h.hearts.dataset.v = `${r.dora.hp}/${r.hpMax}`; setHudTick((x) => x + 1); }
      // meet each new kind of hazard once, ever
      for (const k of r.seen) if (!saveRef.current.seen.includes(k)) { persist({ ...saveRef.current, seen: [...saveRef.current.seen, k] }); say(G.HAZARD[k]!.line, k === 'boulder' || k === 'rock' ? 'warn' : ''); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput, persist, say]);

  // ---------------------------------------------------------------- picking a lens
  const pickLens = useCallback((id?: LensId) => {
    const r = runRef.current; if (!r || !r.pick(id)) return;
    sfx()?.pick(); setPhase('play'); setLine(null); setHudTick((x) => x + 1); aimAtDora();
    setBanner({ text: `${r.biome.name} · ${r.screen % G.PER_BIOME + 1}`, key: Math.random() });
    if (r.screen % G.PER_BIOME === 0) say(r.biome.id === 'cave' ? 'The Crystal Cave! Watch for rocks hanging from the roof.' : 'The Sunken Temple! Nearly there, Dora.', 'good');
  }, [say]);

  // ---------------------------------------------------------------- keyboard, mouse and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const r = runRef.current;
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (r?.phase === 'pick') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && r.offer[i]) pickLens(r.offer[i]); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
      if (e.code === 'KeyC' && r) { aimAtDora(); return; }
      keys.current.add(e.code);
      if (!e.repeat && ['Space', 'KeyJ', 'KeyZ'].includes(e.code)) jumpTap.current = true;
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); mouseDown.current = false; jumpBtn.current = false; };
    const mup = () => { mouseDown.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur); addEventListener('mouseup', mup);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); removeEventListener('mouseup', mup); };
  }, [nextIntro, pickLens, setPaused]);

  const scale = () => { const c = canvasRef.current!.getBoundingClientRect(); return { c, k: G.W / c.width }; };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') { const { c, k } = scale(); aim.current = { x: (e.clientX - c.left) * k, y: (e.clientY - c.top) * k }; return; }
    // a finger drags the frame, so it never has to cover what it's pointing at
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const { k } = scale(); aim.current.x += (e.clientX - d.x) * k * 1.2; aim.current.y += (e.clientY - d.y) * k * 1.2; d.x = e.clientX; d.y = e.clientY;
  };
  const onDown = (e: React.PointerEvent) => {
    sfx()?.unlock();
    if (e.pointerType === 'mouse') { onMove(e); if (e.button === 0) { mouseDown.current = true; jumpTap.current = true; } return; }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onUp = (e: React.PointerEvent) => { if (drag.current?.id === e.pointerId) drag.current = null; };
  const jb = {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); jumpBtn.current = true; jumpTap.current = true; sfx()?.unlock(); },
    onPointerUp: () => { jumpBtn.current = false; }, onPointerCancel: () => { jumpBtn.current = false; }, onPointerLeave: () => { jumpBtn.current = false; },
  };
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };
  const giveUp = () => { const r = runRef.current; if (!r) return; setPaused(false); r.dora.hp = 0; r.phase = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __frame: () => unknown }).__frame = () => {
      const r = runRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, intro: introRef.current, save: saveRef.current, result, line, aim: { ...aim.current },
        run: r && screenRef.current === 'play' ? { screen: r.screen, phase: r.phase, hp: r.dora.hp, hpMax: r.hpMax, film: r.film, dora: { x: r.dora.x, y: r.dora.y, live: r.dora.live, ground: r.dora.ground }, frame: { ...r.frame }, offer: [...r.offer], lenses: { ...r.lenses }, acorns: r.stats.acorns, biome: r.biome.id, ents: r.ents.map((e) => ({ id: e.id, k: e.k, x: e.x, y: e.y, live: e.live, s: e.s })) } : null,
        debug: {
          clear: () => { if (r && r.phase === 'play') { r.dora.x = G.W - 6; r.tick({ tx: aim.current.x, ty: aim.current.y, jump: false }); onEvents(r, r.events); } },
          film: (v: number) => { if (r) r.film = v; },
          hp: (v: number) => { if (r) r.dora.hp = v; },
          screen: (n: number) => { if (r) { r.enter(n); aimAtDora(); setPhase('play'); setHudTick((x) => x + 1); } },
          tp: (x: number, y: number) => { if (r) Object.assign(r.dora, { x, y, vx: 0, vy: 0 }); },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, r = runRef.current;
  void hudTick;
  const kinds = Object.keys(G.HAZARD) as Kind[];
  return <main className={`of-shell of-on-${screen}${touch ? ' of-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen} onContextMenu={(e) => e.preventDefault()}>
    <div className="of-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="of-canvas" aria-label="Out of Frame: the level, with Enzo’s viewfinder" onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} />
      {screen === 'play' && r && <div className="of-hud">
        <div className="of-top">
          <div className="of-hearts" ref={H('hearts')} aria-label={`${r.dora.hp} of ${r.hpMax} hearts`}>{Array.from({ length: r.hpMax }, (_, i) => <i key={i} className={i < r.dora.hp ? 'on' : ''} />)}</div>
          <div className="of-reel" ref={H('reel')} data-low="0"><span className="of-can" aria-hidden /><span className="of-track"><i ref={H('film')} /></span><b ref={H('filmN')}>0</b></div>
          <div className="of-where"><b>{r.biome.name}</b><span>Screen {r.screen + 1} of {G.SCREENS}</span></div>
          <div className="of-acorns"><img src={art('acorn')} alt="" /><b ref={H('acorns')}>0</b></div>
          <button className="of-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
        </div>
        {banner && <div className="of-banner" key={banner.key}>{banner.text}</div>}
        {line && intro < 0 && phase === 'play' && <div className={`of-line ${line.mood}`} key={line.key}>
          <img src={art('enzo-portrait')} alt="" /><p><b>Enzo</b>{line.text}</p>
        </div>}
        {!touch && phase === 'play' && <p className="of-keys"><b>Mouse</b> or <b>WASD</b> moves the frame · <b>click</b> or <b>Space</b> jumps · C centres · Esc pause</p>}
        {intro >= 0 && <div className="of-overlay"><div className="of-card of-introcard" onClick={nextIntro} role="button" tabIndex={0}>
          <img src={art('enzo-portrait')} alt="Enzo" />
          <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
        </div></div>}
        {phase === 'pick' && <div className="of-overlay"><div className="of-pick">
          <h2>Cut!</h2>
          <p>Enzo swaps something on his camera. Pick one:</p>
          <div className="of-offers">{r.offer.map((id, i) => { const l = G.LENSES.find((x) => x.id === id)!; return <button key={id} className="of-card of-offer" data-lens={id} onClick={() => pickLens(id)}>
            {!touch && <kbd>{i + 1}</kbd>}<b>{l.name}</b><span className="of-pips">{Array.from({ length: l.max }, (_, k) => <i key={k} className={k < r.lenses[id] ? 'on' : k === r.lenses[id] ? 'next' : ''} />)}</span><span>{l.text}</span>
          </button>; })}</div>
          {r.offer.length === 0 && <><p>Enzo’s camera can’t get any better!</p><button className="of-go" onClick={() => pickLens()}>Roll on ›</button></>}
        </div></div>}
        {paused && <div className="of-overlay"><div className="of-card of-pausecard">
          <h2>Paused</h2>
          <button className="of-go" onClick={() => setPaused(false)}>Keep filming</button>
          <button onClick={giveUp}>End this run</button>
        </div></div>}
      </div>}
    </div>

    {screen === 'play' && touch && <div className="of-touchpad">
      <div className="of-pad" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}><p>Drag on the picture or here to move the frame</p></div>
      <button className="of-jump" {...jb}>JUMP</button>
    </div>}

    {screen === 'title' && <section className="of-title">
      <div className="of-bg"><img src={art('title')} alt="Dora runs through sepia ruins; inside Enzo’s viewfinder the world is in full colour" /></div>
      <div className="of-title-col">
        <h1 className="of-logo">Out of Frame</h1>
        <p className="of-tag">Only what’s in Enzo’s viewfinder moves. Keep Dora in the picture, and the danger out of it.</p>
        <div className="of-menu">
          <button className="of-go" onClick={startRun}>{s.stats.runs ? 'New run' : 'Start'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="of-small">Best: screen {Math.min(s.best.screen, G.SCREENS)} of {G.SCREENS} · {s.best.acorns} acorns{s.stats.wins ? ` · ${s.stats.wins} ${s.stats.wins === 1 ? 'win' : 'wins'} · fastest ${Math.floor(s.best.time / 60)}:${String(s.best.time % 60).padStart(2, '0')}` : ''}</p>}
        <a className="of-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`of-page of-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="of-bg"><img src={art('ending')} alt="Dora and Enzo at the temple door, watching the film back" /></div>}
      <div className="of-card of-resultcard">
        <h2>{result.won ? 'That’s a wrap!' : result.film ? 'The film ran out' : 'Dora’s out of hearts'}</h2>
        <p>{result.won ? 'Dora reaches the temple, and Enzo has every step of it on film. They watch it back three times.' : `Enzo rewinds the reel. She reached screen ${result.screen} of ${G.SCREENS}${result.best ? ', her best yet!' : '.'}`}</p>
        <ul className="of-stats">
          <li><b>{result.screen}</b><span>screen</span></li><li><b>{result.acorns}</b><span>acorns</span></li><li><b>{result.stomps}</b><span>stomps</span></li><li><b>{result.hits}</b><span>bumps</span></li><li><b>{Math.floor(result.secs / 60)}:{String(result.secs % 60).padStart(2, '0')}</b><span>time</span></li>
        </ul>
        <div className="of-row"><button className="of-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="of-page">
      <header className="of-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="of-cols">
        <div className="of-card"><h3>The viewfinder</h3><ul>
          <li>Only what’s <b>inside the frame</b> moves. Everything outside is frozen in sepia, Dora included.</li>
          <li>{touch ? <><b>Drag</b> anywhere on the picture to move the frame.</> : <><b>Move the mouse</b> to point the frame, or nudge it with <b>WASD</b> or the arrows. <b>C</b> centres it on Dora.</>}</li>
          <li>Dora walks right on her own. {touch ? 'Tap JUMP' : 'Click, or press Space'} to jump; she hops little steps by herself.</li>
          <li>Reach the right edge to finish a screen. Nine screens across three places.</li>
        </ul></div>
        <div className="of-card"><h3>Freezing things</h3><ul>
          <li>A frozen Grumble, boulder or rock is <b>solid</b>: a step to climb or a lid on a pit.</li>
          <li>A frozen arrow is a <b>plank</b>. Arrows that hit rock stick there for good, and arrows that hit those stick to them: let a trap build a bridge.</li>
          <li>Crumbling floor only crumbles while it’s in the picture. Rafts and lifts only move in it.</li>
          <li>Frozen Dora is safe: things that bump into her turn back or break.</li>
        </ul></div>
        <div className="of-card"><h3>Film and hearts</h3><ul>
          <li>The <b>film</b> runs down all the time. Finishing a screen and each film can add more; if it runs out, the run is over.</li>
          <li>Dora has four hearts. Spikes, water, falls and anything moving that touches her cost one.</li>
          <li>After each screen, pick one of three <b>lenses</b> for Enzo’s camera.</li>
        </ul></div>
        <div className="of-card of-foes"><h3>Who’s who</h3>
          {kinds.map((k) => <div key={k} className="of-foe"><img src={art(k)} alt="" /><p><b>{G.HAZARD[k]!.name}</b>{G.HAZARD[k]!.line}</p></div>)}
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="of-page">
      <header className="of-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="of-card of-settings">
        <div className="of-set"><span>Sound</span><span className="of-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="of-set"><span>Music</span><span className="of-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <p className="of-small">{s.stats.runs} runs · {s.stats.wins} wins · {s.stats.acorns} acorns</p>
        <button className="of-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
