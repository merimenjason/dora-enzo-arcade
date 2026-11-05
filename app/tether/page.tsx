'use client';
// Tetherball: the page. Input (mouse aim, keyboard, touch stick and buttons), the fixed-step loop, the HUD, Enzo's
// pointers, picking an upgrade between arenas, results, the ending and the save. Rules in lib/tether-game.ts, drawing in
// lib/tether-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/tether-game';
import type { FoeKind, Run, RunEvent, Save, UpId } from '@/lib/tether-game';
import type { TetherScene } from '@/lib/tether-scene';
import { TetherSound, type SongId } from './sound';
import './tether.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; arena: number; kills: number; combo: number; speed: number; secs: number; best: boolean };

const art = (n: string) => `/art/tether/${n}.png`;
const INTRO = [
  'Dora! The Grumbles have taken over the old castle, and you haven’t got a sword. But you’ve got a rope.',
  'Hook one, hold the button to whirl it round, and let go to throw it. Whatever it hits gets hurt. So does it.',
  'Light ones whirl fast. Heavy ones drag you about. And I’ll be standing in every arena: hook me and swing yourself!',
];
const MEET: Record<FoeKind, string> = {
  slime: 'Slimes! Light and bouncy: perfect for whirling.',
  grumble: 'Grumbles walk straight at you. Whirl one into the rest!',
  spitter: 'A Spitter! Its acorns can’t get through a fast-whirling rope.',
  beetle: 'A Bomb Beetle! Throw it at a crowd and stand well back.',
  shellback: 'A Shellback. Slow hits bounce off it, but it makes a cracking flail.',
  boar: 'A Boar! Too heavy to whirl far. When it paws the ground, dash aside or lead it into a wall.',
  golem: 'That’s the Grumble King’s golem! Only hard hits crack it: whirl the little ones at it.',
};

export default function TetherballPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TetherScene | null>(null);
  const soundRef = useRef<TetherSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const runRef = useRef<Run | null>(null);
  const [phase, setPhase] = useState<G.Phase>('fight');
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
  /** buttons pressed and let go within one frame still count as a press */
  const taps = useRef(new Set<'hook' | 'dash'>());
  const sent = useRef<G.Input>(G.idleInput());
  const mouse = useRef<{ x: number; y: number; at: number; down: boolean; dash: boolean }>({ x: 0, y: 0, at: -1e9, down: false, dash: false });
  const stick = useRef({ x: 0, y: 0, id: -1, ox: 0, oy: 0 });
  const tbtn = useRef({ hook: false, dash: false });
  const reduced = useRef(false);
  const said = useRef(new Set<string>());
  const started = useRef(0);
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

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new TetherSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/tether-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.TetherScene(canvasRef.current); sceneRef.current = sc;
      void sc.load(); setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'play' && runRef.current?.phase === 'fight') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, [setPaused]);

  // the music for each screen
  useEffect(() => {
    const r = runRef.current;
    const song: SongId | null = screen === 'play' ? (r?.boss ? 'boss' : 'fight') : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song); if (screen !== 'play') sfx()?.quiet();
  }, [screen, result, hudTick]);

  // fit the arena to the window, at a whole number of screen pixels per game pixel when that is close enough
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      const pad = touch && innerHeight > innerWidth ? 170 : 0;
      const aw = innerWidth, ah = innerHeight - pad;
      let s = Math.min(aw / G.W, ah / G.H); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      st.style.width = `${Math.floor(G.W * s)}px`; st.style.height = `${Math.floor(G.H * s)}px`;
      // upright on a phone, the arena sits in the middle of the space above the stick and buttons
      st.style.top = pad ? `${Math.max(0, Math.floor((ah - G.H * s) / 2))}px` : '';
    };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [touch, screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the run
  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const r = new G.Run({ seed: (Date.now() & 0xffffff) | 1 });
    runRef.current = r; said.current.clear(); started.current = performance.now();
    setPaused(false); setResult(null); setLine(null); setPhase('fight'); setBanner({ text: `${r.biome.name} · arena 1`, key: Math.random() });
    setScreen('play');
    if (!saveRef.current.intro) { introRef.current = 0; setIntro(0); sfx()?.enzo(INTRO[0]); }
    else say(touch ? 'Hold HOOK to whirl, let go to throw!' : 'Click and hold to whirl, let go to throw!');
  }, [say, setPaused, setScreen, touch]);

  const nextIntro = useCallback(() => {
    if (introRef.current < 0) return; sfx()?.button();
    const n = introRef.current + 1;
    if (n >= INTRO.length) { introRef.current = -1; setIntro(-1); persist({ ...saveRef.current, intro: true }); say(touch ? 'Hold HOOK to whirl, let go to throw!' : 'Click and hold to whirl, let go to throw!'); return; }
    introRef.current = n; setIntro(n); sfx()?.enzo(INTRO[n]);
  }, [persist, say, touch]);

  const finish = useCallback(() => {
    const r = runRef.current; if (!r) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = s.best.arena; G.bank(s, r); persist(s);
    setResult({ won: r.phase === 'won', arena: r.phase === 'won' ? G.ARENAS : r.arena + 1, kills: r.stats.kills, combo: r.stats.bestCombo, speed: G.swingMeter(r.stats.topSpeed), secs: Math.round((performance.now() - started.current) / 1000), best: s.best.arena > before });
    sfx()?.quiet(); sfx()?.stinger(r.phase === 'won');
    setScreen('result');
  }, [persist, setScreen]);

  const onEvents = useCallback((r: Run, evs: RunEvent[]) => {
    const snd = sfx();
    sceneRef.current?.events(r, evs, reduced.current);
    for (const e of evs) {
      switch (e.k) {
        case 'hook': snd?.hook(); break;
        case 'latch':
          snd?.latch(e.kind === 'boar' || e.kind === 'golem');
          if (e.to === 'enzo') say('Oof! Swing round me and bowl them over! Let go to fly.', 'good', 'enzo');
          else if (e.to === 'post') say('A post works too: swing round it and let go.', '', 'post');
          else if (e.kind === 'boar') say('Heavy! It’ll drag you about. Dash against the pull!', 'warn', 'heavy');
          else if (e.kind === 'golem') say('Far too heavy to whirl! Hook the little ones and throw them at it.', 'warn', 'golem-hook');
          break;
        case 'miss': snd?.miss(); break;
        case 'yank': snd?.yank(); say('A quick tap yanks it to you. Hold the button to whirl it instead!', '', 'yank'); break;
        case 'release': snd?.release(e.speed); break;
        case 'hit': snd?.hit(e.dmg); break;
        case 'tink': snd?.tink(); break;
        case 'kill': if (e.how === 'fall') snd?.fall(); else if (e.how !== 'boom') snd?.poof(); break;
        case 'boom': snd?.boom(); break;
        case 'slam': snd?.slam(); break;
        case 'spike': snd?.spike(); break;
        case 'crate': snd?.crate(); break;
        case 'heart': snd?.heart(); break;
        case 'hurt': snd?.hurt(); if (e.hp === 1) say('One heart left! Careful, Dora!', 'warn', 'low'); break;
        case 'dash': snd?.dash(); break;
        case 'telegraph': snd?.warn(e.kind === 'boar' || e.kind === 'golem'); break;
        case 'shot': snd?.shot(e.kind === 'rock'); break;
        case 'quake': snd?.quake(); say('Jump the shockwave: dash through it!', 'warn', 'quake'); break;
        case 'combo': snd?.combo(e.n); setBanner({ text: `Bowled ×${e.n}!`, key: Math.random() }); if (e.n >= 3) say(`Bowled ${e.n}! That’s the way!`, 'good', 'combo'); break;
        case 'wave': if (e.n > 1) { snd?.wave(); setBanner({ text: `Wave ${e.n} of ${e.of}`, key: Math.random() }); } break;
        case 'clear': snd?.clear(); setPhase('pick'); say('Arena clear! Have something from my satchel.', 'good'); break;
        case 'summon': say('It’s calling more little ones. Good: more to throw!', '', 'summon'); break;
        case 'won': case 'lost': break;
      }
    }
  }, [say]);

  const readInput = useCallback((): G.Input => {
    const k = keys.current, st = stick.current, r = runRef.current!;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (st.id >= 0) { x = st.x; y = st.y; }
    // the mouse aims while it's been moved in the last three seconds; otherwise the hook finds what Dora faces
    const m = mouse.current, useMouse = !touch && performance.now() - m.at < 3000;
    return {
      x, y, ax: useMouse ? m.x - r.x : 0, ay: useMouse ? m.y - r.y : 0,
      hook: m.down || k.has('KeyJ') || k.has('KeyZ') || tbtn.current.hook,
      dash: m.dash || k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyK') || k.has('KeyX') || tbtn.current.dash,
    };
  }, [touch]);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const snd = sfx(); snd?.pump();
      const r = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !r || !sc) return;
      const inp = readInput();
      if (!pausedRef.current && introRef.current < 0 && r.phase === 'fight') {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 6) {
          // a latched tap is a press: if the last tick already had it down, send one tick with it up first
          const ti = { ...inp };
          for (const b of ['hook', 'dash'] as const) if (taps.current.has(b)) { if (inp[b]) taps.current.delete(b); else if (sent.current[b]) ti[b] = false; else { ti[b] = true; taps.current.delete(b); } }
          r.tick(ti); sent.current = ti;
          if (r.events.length) onEvents(r, r.events); acc -= G.DT; n++; if (r.phase !== 'fight') break;
        }
        snd?.whirl(r.rope?.to.kind === 'foe' ? r.swing : r.rope ? Math.hypot(r.vx, r.vy) : 0);
      } else { acc = 0; snd?.quiet(); }
      if (r.over) { endT += dt; if (endT > 1.4) { endT = 0; finish(); return; } } else endT = 0;
      const m = mouse.current, useMouse = !touch && now - m.at < 3000;
      sc.render({ run: r, time: now / 1000, dt: pausedRef.current ? 0 : dt, reduced: reduced.current, mouse: useMouse && !r.rope ? { x: m.x, y: m.y } : null, target: !useMouse && !r.rope && !r.hook ? r.autoAim() : null });
      // the HUD, straight to the DOM
      const h = hud.current, sw = G.swingMeter(r.swing);
      if (h.swing) h.swing.style.transform = `scaleX(${Math.min(1, r.swing / 270)})`;
      if (h.swingN) h.swingN.textContent = String(sw);
      if (h.meter) h.meter.dataset.hot = sw >= 9 ? '2' : sw >= 6 ? '1' : '0';
      if (h.dash) h.dash.style.transform = `scaleX(${1 - Math.max(0, r.dashCd) / r.dashCdMax})`;
      if (h.hearts && h.hearts.dataset.v !== `${r.hp}/${r.maxHp}`) { h.hearts.dataset.v = `${r.hp}/${r.maxHp}`; setHudTick((x) => x + 1); }
      const gol = r.foes.find((f) => f.kind === 'golem' && !f.dead);
      if (h.boss) { h.boss.style.display = gol ? '' : 'none'; if (gol && h.bossBar) h.bossBar.style.transform = `scaleX(${gol.hp / gol.maxHp})`; }
      if (h.wave) { const t = r.layout.waves.length ? `Wave ${Math.min(r.waveIx + 1, r.layout.waves.length)}/${r.layout.waves.length}` : ''; if (h.wave.textContent !== t) h.wave.textContent = t; }
      // meet each new kind of enemy once, ever
      for (const f of r.foes) if (f.state !== 'spawn' && !saveRef.current.seen.includes(f.kind)) { persist({ ...saveRef.current, seen: [...saveRef.current.seen, f.kind] }); say(MEET[f.kind], f.kind === 'boar' || f.kind === 'golem' ? 'warn' : ''); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput, persist, say, touch]);

  // ---------------------------------------------------------------- picking an upgrade
  const pickUp = useCallback((id?: UpId) => {
    const r = runRef.current; if (!r || !r.pick(id)) return;
    sfx()?.pick(); setPhase('fight'); setLine(null); setHudTick((x) => x + 1);
    setBanner({ text: r.boss ? 'The Golem' : `${r.biome.name} · arena ${r.arena + 1}`, key: Math.random() });
    if (r.boss) say(MEET.golem, 'warn', 'boss');
    else if (r.arena % G.ARENAS_PER_BIOME === 0) say(`On to the ${r.biome.name}! I healed you up a little.`, 'good');
  }, [say]);

  // ---------------------------------------------------------------- keyboard, mouse and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const r = runRef.current;
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (r?.phase === 'pick') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && r.offer[i]) pickUp(r.offer[i]); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
      keys.current.add(e.code);
      if (!e.repeat && (e.code === 'KeyJ' || e.code === 'KeyZ')) taps.current.add('hook');
      if (!e.repeat && ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX'].includes(e.code)) taps.current.add('dash');
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); mouse.current.down = false; mouse.current.dash = false; };
    const mup = (e: MouseEvent) => { if (e.button === 0) mouse.current.down = false; if (e.button === 2) mouse.current.dash = false; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur); addEventListener('mouseup', mup);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); removeEventListener('mouseup', mup); };
  }, [nextIntro, pickUp, setPaused]);

  const toWorld = (e: React.PointerEvent | React.MouseEvent) => {
    const c = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - c.left) / c.width) * G.W, y: ((e.clientY - c.top) / c.height) * G.H };
  };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') return; const p = toWorld(e); mouse.current.x = p.x; mouse.current.y = p.y; mouse.current.at = performance.now(); };
  const onDown = (e: React.PointerEvent) => {
    sfx()?.unlock(); if (e.pointerType !== 'mouse') return;
    onMove(e);
    if (e.button === 0) { mouse.current.down = true; taps.current.add('hook'); }
    if (e.button === 2) { mouse.current.dash = true; taps.current.add('dash'); }
  };
  const stickDown = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); stick.current = { x: 0, y: 0, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); stickMove(e); sfx()?.unlock(); };
  const stickMove = (e: React.PointerEvent) => {
    const st = stick.current; if (st.id !== e.pointerId) return;
    const dx = e.clientX - st.ox, dy = e.clientY - st.oy, R = 46, L = Math.hypot(dx, dy), k = L > R ? R / L : 1;
    st.x = (dx * k) / R; st.y = (dy * k) / R;
    const knob = hud.current.knob; if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const stickUp = (e: React.PointerEvent) => { if (stick.current.id !== e.pointerId) return; stick.current = { x: 0, y: 0, id: -1, ox: 0, oy: 0 }; const knob = hud.current.knob; if (knob) knob.style.transform = ''; };
  const tb = (k: 'hook' | 'dash') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); tbtn.current[k] = true; taps.current.add(k); sfx()?.unlock(); },
    onPointerUp: () => { tbtn.current[k] = false; }, onPointerCancel: () => { tbtn.current[k] = false; }, onPointerLeave: () => { tbtn.current[k] = false; },
  });
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };
  const giveUp = () => { const r = runRef.current; if (!r) return; setPaused(false); r.hp = 0; r.phase = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __tether: () => unknown }).__tether = () => {
      const r = runRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, intro: introRef.current, save: saveRef.current, result, line,
        run: r && screenRef.current === 'play' ? { arena: r.arena, phase: r.phase, hp: r.hp, maxHp: r.maxHp, x: r.x, y: r.y, rope: r.rope ? r.rope.to.kind : null, hook: !!r.hook, swing: r.swing, offer: [...r.offer], mods: { ...r.mods }, kills: r.stats.kills, foes: r.foes.filter((f) => !f.dead).map((f) => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, hp: f.hp, state: f.state })), waveIx: r.waveIx, biome: r.layout.biome, enzo: r.layout.enzo } : null,
        debug: {
          clear: () => { if (!r) return; r.queue = []; r.waveIx = r.layout.waves.length - 1; for (const f of r.foes) r.hurtFoe(f, 99, 'boom'); },
          hp: (v: number) => { if (r) r.hp = v; },
          tp: (x: number, y: number) => { if (r) { r.x = x; r.y = y; r.vx = r.vy = 0; } },
          arena: (a: number) => { if (r) { r.enter(a); setPhase('fight'); setHudTick((x) => x + 1); } },
          spawn: (kind: FoeKind, x: number, y: number) => { r?.spawn(kind, x, y, true); },
          calm: () => { if (!r) return; r.queue = []; for (const f of r.foes) { f.state = 'stun'; f.t = 999; f.vx = f.vy = 0; } },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, r = runRef.current;
  void hudTick;
  return <main className={`tb-shell tb-on-${screen}${touch ? ' tb-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen} onContextMenu={(e) => e.preventDefault()}>
    <div className="tb-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="tb-canvas" aria-label="Tetherball: the arena" onPointerMove={onMove} onPointerDown={onDown} />
      {screen === 'play' && r && <div className="tb-hud">
        <div className="tb-top">
          <div className="tb-hearts" ref={H('hearts')} aria-label={`${r.hp} of ${r.maxHp} hearts`}>{Array.from({ length: r.maxHp }, (_, i) => <i key={i} className={i < r.hp ? 'on' : ''} />)}</div>
          <div className="tb-where"><b>{r.boss ? 'The Golem' : r.biome.name}</b><span>Arena {r.arena + 1} of {G.ARENAS}</span><span ref={H('wave')} /></div>
          <div className="tb-meter" ref={H('meter')} data-hot="0"><span>Swing</span><span className="tb-track"><i ref={H('swing')} /></span><b ref={H('swingN')}>0</b></div>
          <div className="tb-dash"><span>Dash</span><span className="tb-track small"><i ref={H('dash')} /></span></div>
          <button className="tb-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
        </div>
        <div className="tb-boss" ref={H('boss')} style={{ display: 'none' }}><span>Stone Golem</span><span className="tb-track"><i ref={H('bossBar')} /></span></div>
        {banner && <div className="tb-banner" key={banner.key}>{banner.text}</div>}
        {line && intro < 0 && phase === 'fight' && <div className={`tb-line ${line.mood}`} key={line.key}>
          <img src={art('enzo-portrait')} alt="" /><p><b>Enzo</b>{line.text}</p>
        </div>}
        {!touch && phase === 'fight' && <p className="tb-keys">WASD move · mouse aims · <b>hold click</b> to whirl, let go to throw · <b>Space</b> or right-click dash · Esc pause</p>}
        {intro >= 0 && <div className="tb-overlay"><div className="tb-card tb-introcard" onClick={nextIntro} role="button" tabIndex={0}>
          <img src={art('enzo-portrait')} alt="Enzo" />
          <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
        </div></div>}
        {phase === 'pick' && <div className="tb-overlay"><div className="tb-pick">
          <h2>Arena clear!</h2>
          <p>Enzo rummages in his satchel. Pick one:</p>
          <div className="tb-offers">{r.offer.map((id, i) => { const u = G.UPGRADES.find((x) => x.id === id)!; return <button key={id} className="tb-card tb-offer" data-up={id} onClick={() => pickUp(id)}>
            {!touch && <kbd>{i + 1}</kbd>}<b>{u.name}</b><span className="tb-pips">{Array.from({ length: u.max }, (_, k) => <i key={k} className={k < r.mods[id] ? 'on' : k === r.mods[id] ? 'next' : ''} />)}</span><span>{u.line}</span>
          </button>; })}</div>
          {r.offer.length === 0 && <><p>His satchel is empty: Dora has everything!</p><button className="tb-go" onClick={() => pickUp()}>Onwards ›</button></>}
        </div></div>}
        {paused && <div className="tb-overlay"><div className="tb-card tb-pausecard">
          <h2>Paused</h2>
          <button className="tb-go" onClick={() => setPaused(false)}>Keep swinging</button>
          <button onClick={giveUp}>End this run</button>
        </div></div>}
      </div>}
    </div>

    {screen === 'play' && touch && <div className="tb-touchpad">
      <div className="tb-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
      <div className="tb-tbtns"><button className="t-dash" {...tb('dash')}>DASH</button><button className="t-hook" {...tb('hook')}>HOOK<small>hold</small></button></div>
    </div>}

    {screen === 'title' && <section className="tb-title">
      <div className="tb-bg"><img src={art('title')} alt="Dora whirls a boar on a rope through a crowd of Grumbles while Enzo holds the other end" /></div>
      <div className="tb-title-col">
        <h1 className="tb-logo">Tetherball</h1>
        <p className="tb-tag">No sword, just a rope. Hook a Grumble, whirl it round, and let go.</p>
        <div className="tb-menu">
          <button className="tb-go" onClick={startRun}>{s.stats.runs ? 'New run' : 'Start'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="tb-small">Best: arena {Math.min(s.best.arena, G.ARENAS)} of {G.ARENAS} · combo ×{s.best.combo} · swing {s.best.speed}{s.stats.wins ? ` · ${s.stats.wins} ${s.stats.wins === 1 ? 'win' : 'wins'}` : ''}</p>}
        <a className="tb-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`tb-page tb-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="tb-bg"><img src={art('ending')} alt="Dora and Enzo stand on the toppled golem" /></div>}
      <div className="tb-card tb-resultcard">
        <h2>{result.won ? 'The golem is down!' : 'Dora’s out of hearts'}</h2>
        <p>{result.won ? 'The Grumbles scatter from Grumble Keep, and Enzo coils the rope up with a very satisfied look.' : `Enzo patches her up. She reached arena ${result.arena} of ${G.ARENAS}${result.best ? ', her best yet!' : '.'}`}</p>
        <ul className="tb-stats">
          <li><b>{result.arena}</b><span>arena</span></li><li><b>{result.kills}</b><span>knocked out</span></li><li><b>×{result.combo}</b><span>best combo</span></li><li><b>{result.speed}</b><span>top swing</span></li><li><b>{Math.floor(result.secs / 60)}:{String(result.secs % 60).padStart(2, '0')}</b><span>time</span></li>
        </ul>
        <div className="tb-row"><button className="tb-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="tb-page">
      <header className="tb-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="tb-cols">
        <div className="tb-card"><h3>The rope</h3><ul>
          <li><b>Hook:</b> {touch ? 'hold HOOK' : 'hold the left mouse button (or J)'} to throw the hook at whatever you aim at{touch ? ' (it finds what Dora faces)' : '; without the mouse it finds what Dora faces'}.</li>
          <li><b>Whirl:</b> keep holding and the enemy whirls round you, faster and faster. The meter shows the swing speed.</li>
          <li><b>Throw:</b> let go and it flies off along the dotted line. Whatever it hits takes damage from the speed, and so does it.</li>
          <li><b>Yank:</b> a quick tap pulls an enemy to you instead.</li>
        </ul></div>
        <div className="tb-card"><h3>Moves</h3><ul>
          <li><b>{touch ? 'Stick' : 'WASD or arrows'}</b> to move. <b>{touch ? 'DASH' : 'Space, Shift or right-click'}</b> to dash: straight through enemies, and it cracks the rope like a whip.</li>
          <li><b>Enzo</b> stands in every arena. Hook him to swing yourself round: at speed, Dora is the flail.</li>
          <li>Walls, spikes and pits do damage too. A fast-whirling rope blocks acorns and rocks.</li>
          <li>Thirteen arenas, an upgrade from Enzo after each one, and the Grumble King’s golem at the end.</li>
        </ul></div>
        <div className="tb-card tb-foes"><h3>Who’s who</h3>
          {(Object.keys(G.FOES) as FoeKind[]).map((k) => <div key={k} className="tb-foe"><img src={art(k)} alt="" /><p><b>{G.FOES[k].name}</b>{G.FOES[k].line}</p></div>)}
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="tb-page">
      <header className="tb-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="tb-card tb-settings">
        <div className="tb-set"><span>Sound</span><span className="tb-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="tb-set"><span>Music</span><span className="tb-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <p className="tb-small">{s.stats.runs} runs · {s.stats.wins} wins · {s.stats.kills} Grumbles knocked out</p>
        <button className="tb-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
