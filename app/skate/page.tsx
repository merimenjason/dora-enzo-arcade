'use client';
// Pawpark Skate: the page. Input, the session loop, the park and skater picker with each park's goals, the mentors'
// lines, the HUD (score, clock, the combo building up, balance, the star meter), results, the ending and the save.
// Rules in lib/skate-game.ts, drawing in lib/skate-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/skate-game';
import type { CharId, Goal, ParkId, Save, Session, SkateEvent } from '@/lib/skate-game';
import type { CameraMode, SkateScene } from '@/lib/skate-scene';
import { SkateSound, type SongId } from './sound';
import './skate.css';

type Screen = 'title' | 'parks' | 'skate' | 'result' | 'ending' | 'howto' | 'settings';
type Result = { park: ParkId; free: boolean; score: number; best: boolean; bestCombo: number; acorns: number; gaps: string[]; fresh: Goal[]; opened: ParkId[]; ending: boolean };
type Toast = { who: Goal['who']; text: string; key: number };
type Btn = 'jump' | 'flip' | 'grab' | 'grind';

const art = (n: string) => `/art/skate/${n}.webp`;
const MENTORS: Record<Goal['who'], { name: string; art: string; role: string }> = {
  badger: { name: 'Barnaby', art: 'badger', role: 'keeps the parks' },
  raccoon: { name: 'Zip', art: 'raccoon', role: 'knows every trick' },
  otter: { name: 'Coral', art: 'otter', role: 'surfs, skates, naps' },
  enzo: { name: 'Enzo', art: 'enzo-portrait', role: 'hides acorns' },
};
const PARK_ART: Record<ParkId, string> = { plaza: 'park-plaza', hill: 'park-bowl', roofs: 'park-roof' };
const INTRO: { who: Goal['who']; text: string }[] = [
  { who: 'badger', text: 'Welcome to Pawpark! I’m Barnaby. I keep the parks swept, and I blow this whistle when a session’s up.' },
  { who: 'raccoon', text: 'And I’m Zip. String tricks together without touching the ground and they multiply. That’s a combo.' },
  { who: 'enzo', text: 'I hid five golden acorns in every park. Some are up high. Very high. You’ll see.' },
  { who: 'otter', text: 'Finish goals to open Cloverdrop Hill and the Lanternfall Rooftops. Land the trick goal in all three and we party.' },
];
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const goalLine = (g: Goal) => g.text;

export default function PawparkSkatePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SkateScene | null>(null);
  const soundRef = useRef<SkateSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const [pick, setPick] = useState<ParkId>('plaza');
  const sesRef = useRef<Session | null>(null);
  const freeRef = useRef(false);
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toasts = useRef<Toast[]>([]);
  const [intro, setIntro] = useState(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [touch, setTouch] = useState(false);
  const keys = useRef(new Set<string>());
  /** buttons tapped since the last tick, so a press quicker than a frame still counts */
  const taps = useRef(new Set<Btn>());
  const sent = useRef<G.Input>(G.idleInput());
  const stick = useRef({ x: 0, y: 0, id: -1, ox: 0, oy: 0 });
  const tbtn = useRef<Record<Btn, boolean>>({ jump: false, flip: false, grab: false, grind: false });
  const reduced = useRef(false);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const last = useRef({ combo: '', score: -1, left: -1, acorns: -1, bal: -9, special: -1 });

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;
  const showToast = useCallback((t: Omit<Toast, 'key'>) => {
    const n = { ...t, key: Math.random() };
    setToast((cur) => { if (cur) { toasts.current.push(n); return cur; } return n; });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(toasts.current.shift() ?? null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new SkateSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/skate-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      sceneRef.current = new m.SkateScene(canvasRef.current);
      setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'skate') setPaused(true); } else soundRef.current?.resume(); };
    const rs = () => sceneRef.current?.resize();
    document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); sceneRef.current?.dispose(); soundRef.current?.dispose(); };
  }, [setPaused]);

  useEffect(() => {
    const ses = sesRef.current;
    sfx()?.music(screen === 'skate' && ses ? (ses.pk.id as SongId) : screen === 'ending' ? 'ending' : screen === 'title' ? null : 'menu');
    if (screen !== 'skate') sfx()?.quiet();
    if (screen === 'skate') requestAnimationFrame(() => sceneRef.current?.resize());
  }, [screen]);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- a session
  const startSession = useCallback((free: boolean) => {
    sfx()?.unlock();
    const s = saveRef.current, sc = sceneRef.current;
    const ses = new G.Session({ park: pick, char: s.char, free, seed: (Date.now() & 0xffffff) | 1, done: s.goals });
    sesRef.current = ses; freeRef.current = free;
    sc?.setPark(ses.pk, s.char);
    setPaused(false); setResult(null); toasts.current = []; setToast(null); taps.current.clear();
    last.current = { combo: '', score: -1, left: -1, acorns: -1, bal: -9, special: -1 };
    setScreen('skate'); sfx()?.ready();
  }, [pick, setPaused, setScreen]);

  const finish = useCallback(() => {
    const ses = sesRef.current; if (!ses) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = G.PARKS.filter((p) => G.unlocked(s, p.id)).map((p) => p.id);
    // in free skate there's no clock, so the session scores don't count
    if (freeRef.current) for (const g of ses.pk.goals) if ((g.kind === 'score' || g.kind === 'pro') && !s.goals.includes(g.id)) ses.got.delete(g.id);
    const prevBest = s.best[ses.pk.id];
    const { fresh, ending } = G.record(s, ses);
    if (freeRef.current) s.best[ses.pk.id] = prevBest;
    persist(s);
    const opened = G.PARKS.filter((p) => G.unlocked(s, p.id) && !before.includes(p.id)).map((p) => p.id);
    setResult({
      park: ses.pk.id, free: freeRef.current, score: ses.score, best: !freeRef.current && ses.score > prevBest && ses.score > 0, bestCombo: ses.bestCombo,
      acorns: ses.acorns.filter(Boolean).length, gaps: ses.pk.gaps.filter((g) => ses.gapsDone.has(g.id)).map((g) => g.name),
      fresh: G.ALL_GOALS.filter((id) => fresh.includes(id)).map((id) => G.PARKS.flatMap((p) => p.goals).find((g) => g.id === id)!), opened, ending,
    });
    sfx()?.quiet();
    setScreen('result');
  }, [persist, setScreen]);

  const onEvents = useCallback((ses: Session, evs: SkateEvent[]) => {
    const snd = sfx(), sc = sceneRef.current;
    for (const e of evs) {
      sc?.event(e, ses);
      switch (e.k) {
        case 'ollie': snd?.ollie(); break;
        case 'land': snd?.land(false); if (e.clean && e.tricks > 1) snd?.combo(e.combo); if (e.clean && e.combo > 0) pop(`+${fmt(e.combo)}`, 'good'); break;
        case 'bail': snd?.bail(); pop('Bail!', 'bad'); break;
        case 'trick': if (e.kind === 'flip' || e.kind === 'special') snd?.flip(); else if (e.kind === 'grab' || e.kind === 'spin') snd?.whoosh(); break;
        case 'grind': if (e.on) snd?.grindOn(ses.grind?.rail.kind === 'rail' || ses.grind?.rail.kind === 'coping'); break;
        case 'gap': snd?.gap(); pop(e.name, 'gap'); break;
        case 'acorn': snd?.acorn(); pop(`Golden acorn ${ses.acorns.filter(Boolean).length}/5`, 'gold'); break;
        case 'goal': { const g = ses.pk.goals.find((x) => x.id === e.id); if (g) { snd?.goal(); showToast({ who: g.who, text: `Goal! ${goalLine(g)}` }); } break; }
        case 'special': snd?.special(); break;
        case 'end': snd?.whistle(); break;
        case 'manual': case 'push': break;
      }
    }
  }, [showToast]);
  const pop = (text: string, kind: string) => {
    const el = hud.current.pop; if (!el) return;
    el.textContent = text; el.dataset.kind = kind; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  };

  const readInput = useCallback((): G.Input => {
    const k = keys.current, st = stick.current;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (st.id >= 0) { x = Math.abs(st.x) < 0.2 ? 0 : st.x; y = Math.abs(st.y) < 0.25 ? 0 : st.y; }
    const t = tbtn.current;
    return { x, y, jump: k.has('Space') || t.jump, flip: k.has('KeyJ') || k.has('KeyZ') || t.flip, grab: k.has('KeyK') || k.has('KeyX') || t.grab, grind: k.has('KeyL') || k.has('KeyC') || t.grind };
  }, []);

  useEffect(() => {
    let raf = 0, prev = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      const snd = sfx(); snd?.pump();
      const ses = sesRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'skate' || !ses || !sc) return;
      const inp = readInput();
      if (!pausedRef.current && !ses.over) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 8) {
          // a latched tap is a press: if the last tick already had that button down, send one tick with it up first
          const ti = { ...inp };
          for (const b of ['jump', 'flip', 'grab', 'grind'] as const) if (taps.current.has(b)) { if (inp[b]) taps.current.delete(b); else if (sent.current[b]) ti[b] = false; else { ti[b] = true; taps.current.delete(b); } }
          ses.tick(ti); sent.current = ti;
          if (ses.events.length) onEvents(ses, ses.events); acc -= G.DT; n++; if (ses.over) break;
        }
        const gr = ses.grind ? (ses.grind.rail.kind === 'ledge' ? 'stone' : 'metal') : false;
        snd?.board(ses.speed, ses.state === 'ground' || ses.state === 'manual', gr);
      } else { acc = 0; snd?.quiet(); }
      if (ses.over) { endT += dt; if (endT > 1.4) { endT = 0; finish(); return; } } else endT = 0;
      sc.render(ses, pausedRef.current ? 0 : dt, saveRef.current.settings.camera as CameraMode, reduced.current);
      // the HUD, straight to the DOM
      const h = hud.current, L = last.current;
      if (h.score && L.score !== ses.score) { L.score = ses.score; h.score.textContent = fmt(ses.score); }
      const left = freeRef.current ? -2 : Math.ceil(ses.left);
      if (h.clock && L.left !== left) { if (left >= 0 && left <= 10 && L.left > left) snd?.tick(); L.left = left; h.clock.textContent = left === -2 ? 'Free skate' : clock(left); h.clock.dataset.low = left >= 0 && left <= 10 ? '1' : '0'; }
      const got = ses.acorns.filter(Boolean).length;
      if (h.acorns && L.acorns !== got) { L.acorns = got; h.acorns.textContent = `${got}/5`; }
      const names = ses.combo.map((c) => c.name), comboKey = names.join('|') + ses.comboScore;
      if (h.combo && L.combo !== comboKey) {
        L.combo = comboKey;
        const sum = ses.combo.reduce((a, c) => a + c.pts, 0);
        h.combo.dataset.on = names.length ? '1' : '0';
        if (h.tricks) h.tricks.textContent = names.length > 4 ? `… + ${names.slice(-4).join(' + ')}` : names.join(' + ');
        if (h.csum) h.csum.textContent = names.length ? `${fmt(sum)} × ${names.length}` : '';
      }
      const bal = ses.balance;
      if (h.bal) { const b = bal === null ? -9 : Math.round(bal * 50) / 50; if (L.bal !== b) { L.bal = b; h.bal.dataset.on = bal === null ? '0' : '1'; if (h.needle && bal !== null) h.needle.style.left = `${50 + Math.max(-1, Math.min(1, bal)) * 48}%`; } }
      const sp = Math.round(ses.special);
      if (h.special && L.special !== sp) { L.special = sp; h.special.style.transform = `scaleX(${sp / G.SPECIAL_FULL})`; h.special.parentElement!.parentElement!.dataset.full = sp >= G.SPECIAL_FULL ? '1' : '0'; }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput]);

  // ---------------------------------------------------------------- keyboard and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      const scr = screenRef.current;
      if (scr === 'skate') {
        if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
        if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
        if (e.code === 'KeyV' && !e.repeat) { setCamera(saveRef.current.settings.camera === 'near' ? 'far' : 'near'); return; }
        keys.current.add(e.code);
        if (e.repeat) return;
        if (e.code === 'Space') taps.current.add('jump');
        if (e.code === 'KeyJ' || e.code === 'KeyZ') taps.current.add('flip');
        if (e.code === 'KeyK' || e.code === 'KeyX') taps.current.add('grab');
        if (e.code === 'KeyL' || e.code === 'KeyC') taps.current.add('grind');
      } else if (scr === 'parks' && intro >= 0 && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); nextIntro(); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  });
  const stickDown = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); stick.current = { x: 0, y: 0, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); stickMove(e); sfx()?.unlock(); };
  const stickMove = (e: React.PointerEvent) => {
    const st = stick.current; if (st.id !== e.pointerId) return;
    const dx = e.clientX - st.ox, dy = e.clientY - st.oy, R = 46, Ln = Math.hypot(dx, dy), k = Ln > R ? R / Ln : 1;
    st.x = (dx * k) / R; st.y = (dy * k) / R;
    const knob = hud.current.knob; if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const stickUp = (e: React.PointerEvent) => { if (stick.current.id !== e.pointerId) return; stick.current = { x: 0, y: 0, id: -1, ox: 0, oy: 0 }; const knob = hud.current.knob; if (knob) knob.style.transform = ''; };
  const tb = (k: Btn) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); tbtn.current[k] = true; taps.current.add(k); sfx()?.unlock(); },
    onPointerUp: () => { tbtn.current[k] = false; }, onPointerCancel: () => { tbtn.current[k] = false; }, onPointerLeave: () => { tbtn.current[k] = false; },
  });

  // ---------------------------------------------------------------- menus
  const toParks = () => {
    sfx()?.unlock(); sfx()?.button(); setScreen('parks');
    if (!saveRef.current.intro) setIntro(0);
  };
  const nextIntro = () => {
    if (intro < 0) return; sfx()?.button();
    if (intro + 1 >= INTRO.length) { setIntro(-1); persist({ ...saveRef.current, intro: true }); return; }
    setIntro(intro + 1);
  };
  const setChar = (c: CharId) => { sfx()?.button(); persist({ ...saveRef.current, char: c }); };
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };
  const setCamera = (v: 'near' | 'far') => persist({ ...saveRef.current, settings: { ...saveRef.current.settings, camera: v } });
  const quit = () => { setPaused(false); sesRef.current = null; sfx()?.quiet(); setScreen('parks'); };
  const endEarly = () => { const ses = sesRef.current; if (!ses) return; setPaused(false); ses.left = 0; ses.over = true; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __skate: () => unknown }).__skate = () => {
      const ses = sesRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, result, intro, pick, toast,
        ses: ses && screenRef.current === 'skate' ? { park: ses.pk.id, char: ses.char, state: ses.state, x: ses.p.x, y: ses.p.y, z: ses.p.z, yaw: ses.yaw, speed: ses.speed, score: ses.score, left: ses.left, combo: ses.combo.map((c) => c.name), acorns: ses.acorns.filter(Boolean).length, over: ses.over, t: ses.t, goals: [...ses.got] } : null,
        debug: {
          place: (x: number, z: number, yaw: number, speed: number) => ses?.place(x, z, yaw, speed),
          left: (v: number) => { if (ses) ses.left = v; },
          goals: (ids: string[]) => { const s = { ...saveRef.current, goals: G.ALL_GOALS.filter((g) => ids.includes(g) || saveRef.current.goals.includes(g)) }; persist(s); },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, pk = G.park(pick), open = G.unlocked(s, pick);
  return <main className={`sk-shell sk-on-${screen}${touch ? ' sk-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <canvas ref={canvasRef} className="sk-canvas" aria-label="Pawpark Skate: the park" />

    {screen === 'title' && <section className="sk-title">
      <div className="sk-art sk-bg"><img src={art('title')} alt="" /></div>
      <div className="sk-title-col">
        <h1 className="sk-logo">Pawpark <span>Skate</span></h1>
        <p className="sk-tag">Three parks, two chinchillas, one board each. Flip it, grab it, grind it, and land it.</p>
        <div className="sk-menu">
          <button className="sk-go" onClick={toParks}>{s.stats.sessions ? 'Back to the parks' : 'Let’s skate'}</button>
          <button onClick={() => go('howto')}>How to skate</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        <a className="sk-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'parks' && <section className="sk-page sk-parks">
      <header className="sk-head">
        <button className="sk-back" onClick={() => go('title')}>‹ Title</button>
        <h2>Pick a park</h2>
        <span className="sk-count">{s.goals.length}/{G.ALL_GOALS.length} goals</span>
      </header>
      {intro >= 0 && <div className="sk-talk" onClick={nextIntro} role="button" tabIndex={0}>
        <div className="sk-face"><img src={art(MENTORS[INTRO[intro].who].art)} alt={MENTORS[INTRO[intro].who].name} /></div>
        <div className="sk-talk-text"><b>{MENTORS[INTRO[intro].who].name}</b><p>{INTRO[intro].text}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
      </div>}
      <div className="sk-chars">
        {(['dora', 'enzo'] as const).map((c) => <button key={c} className={`sk-char${s.char === c ? ' on' : ''}`} onClick={() => setChar(c)} aria-pressed={s.char === c}>
          <span className="sk-face"><img src={art(`${c}-portrait`)} alt="" /></span>
          <span className="sk-char-text"><b>{G.CHARS[c].name}</b><small>{G.CHARS[c].line} Special: {G.CHARS[c].special}.</small></span>
        </button>)}
      </div>
      <div className="sk-park-grid">
        {G.PARKS.map((p) => { const op = G.unlocked(s, p.id); return <button key={p.id} className={`sk-park${pick === p.id ? ' on' : ''}${op ? '' : ' locked'}`} onClick={() => { sfx()?.button(); setPick(p.id); }} data-park={p.id}>
          <span className="sk-art"><img src={art(PARK_ART[p.id])} alt="" /></span>
          <span className="sk-park-text"><b>{p.name}</b><small>{op ? `${G.goalsIn(s, p.id)}/6 goals · best ${fmt(s.best[p.id])}` : `Finish ${p.unlock} goals to open (${s.goals.length}/${p.unlock})`}</small></span>
        </button>; })}
      </div>
      <div className="sk-goalbox">
        <div className="sk-goalhead"><h3>{pk.name}</h3><small>{pk.place}</small></div>
        <ul className="sk-goals">
          {pk.goals.map((g) => <li key={g.id} className={s.goals.includes(g.id) ? 'done' : ''}>
            <span className="sk-face small"><img src={art(MENTORS[g.who].art)} alt="" /></span>
            <span><b>{goalLine(g)}</b><small>{MENTORS[g.who].name}{g.kind === 'trick' ? ' · needed for the party' : ''}</small></span>
            <i aria-label={s.goals.includes(g.id) ? 'done' : 'not yet'}>{s.goals.includes(g.id) ? '✓' : ''}</i>
          </li>)}
        </ul>
        <div className="sk-row">
          <button className="sk-go" disabled={!open || intro >= 0 || !ready} onClick={() => startSession(false)}>{ready ? 'Skate! · 2:00' : 'Loading…'}</button>
          <button disabled={!open || intro >= 0 || !ready} onClick={() => startSession(true)}>Free skate</button>
        </div>
        {!open && <p className="sk-small">Locked: finish {pk.unlock - s.goals.length} more goal{pk.unlock - s.goals.length === 1 ? '' : 's'} anywhere to open it.</p>}
      </div>
    </section>}

    {screen === 'skate' && <section className="sk-hud">
      <div className="sk-scorebox">
        <b ref={H('score')}>0</b>
        <span className="sk-clock" ref={H('clock')} data-low="0">2:00</span>
      </div>
      <div className="sk-combo" ref={H('combo')} data-on="0"><span className="sk-tricks" ref={H('tricks')} /><b ref={H('csum')} /></div>
      <div className="sk-pop" ref={H('pop')} />
      <div className="sk-bal" ref={H('bal')} data-on="0" aria-hidden="true"><i ref={H('needle')} /></div>
      <div className="sk-meter" data-full="0"><span>★</span><span className="sk-track"><i ref={H('special')} /></span><em>{touch ? 'GRAB + FLIP' : 'Hold K, press J'}</em></div>
      <div className="sk-topbtns">
        <span className="sk-acorns" title="Golden acorns"><i className="sk-acorn" /><b ref={H('acorns')}>0/5</b></span>
        <button onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      </div>
      {toast && <div className="sk-toast" key={toast.key}>
        <div className="sk-face"><img src={art(MENTORS[toast.who].art)} alt="" /></div>
        <p><b>{MENTORS[toast.who].name}</b>{toast.text}</p>
      </div>}
      {!touch && <p className="sk-keys">Arrows steer · <b>↑</b> push · <b>Space</b> ollie · <b>J</b> flip · <b>K</b> grab · <b>L</b> grind or manual · V camera · Esc pause</p>}
      {touch && <div className="sk-touchpad">
        <div className="sk-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
        <div className="sk-tbtns">
          <button className="t-flip" {...tb('flip')}>FLIP</button><button className="t-grab" {...tb('grab')}>GRAB</button>
          <button className="t-grind" {...tb('grind')}>GRIND</button><button className="t-jump" {...tb('jump')}>OLLIE</button>
        </div>
      </div>}
      {paused && <div className="sk-pause"><div className="sk-card sk-pausecard">
        <h2>Paused</h2>
        <button className="sk-go" onClick={() => setPaused(false)}>Keep skating</button>
        <button onClick={endEarly}>End the session now</button>
        <button onClick={() => { setCamera(s.settings.camera === 'near' ? 'far' : 'near'); }}>Camera: {s.settings.camera === 'near' ? 'close' : 'wide'}</button>
        <button onClick={quit}>Back to the parks (nothing saved)</button>
      </div></div>}
    </section>}

    {screen === 'result' && result && <section className="sk-page sk-result">
      <div className="sk-card sk-resultcard">
        <h2>{result.free ? 'Free skate over' : 'Session!'}</h2>
        <p className="sk-big">{fmt(result.score)}{result.best && <em> New best!</em>}</p>
        <p className="sk-small">{G.park(result.park).name} · best combo {fmt(result.bestCombo)} · golden acorns {result.acorns}/5{result.gaps.length ? ` · gaps: ${result.gaps.join(', ')}` : ''}</p>
        {result.fresh.length > 0 && <ul className="sk-goals">{result.fresh.map((g) => <li key={g.id} className="done">
          <span className="sk-face small"><img src={art(MENTORS[g.who].art)} alt="" /></span><span><b>{goalLine(g)}</b><small>{MENTORS[g.who].name}: nice one!</small></span><i>✓</i>
        </li>)}</ul>}
        {result.opened.map((id) => <p key={id} className="sk-open">{G.park(id).name} is open!</p>)}
        <div className="sk-row">
          {result.ending ? <button className="sk-go" onClick={() => go('ending')}>The party ›</button> : <button className="sk-go" onClick={() => startSession(result.free)}>Again</button>}
          <button onClick={() => { if (result.opened.length) setPick(result.opened[0]); go('parks'); }}>Parks</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="sk-ending">
      <div className="sk-art sk-bg"><img src={art('ending')} alt="Dora, Enzo and their friends at the party on the rooftops" /></div>
      <div className="sk-ending-text">
        <h2>Lanterns over Pawpark</h2>
        <p>Every park skated, every trick goal landed. Barnaby hangs up his whistle for the night, Zip brings far too many pretzels, Coral falls asleep on a deck, and fireworks go up over the old town while Dora and Enzo sit on the coping with their boards across their knees.</p>
        <p className="sk-small">{s.goals.length < G.ALL_GOALS.length ? `${s.goals.length} of ${G.ALL_GOALS.length} goals done. There are acorns still out there.` : 'Every goal in every park. Legends of Pawpark.'}</p>
        <div className="sk-row"><button className="sk-go" onClick={() => go('parks')}>Keep skating</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="sk-page">
      <header className="sk-head"><button className="sk-back" onClick={() => go('title')}>‹ Title</button><h2>How to skate</h2></header>
      <div className="sk-cols">
        <div className="sk-card"><h3>Roll</h3><ul><li><b>Left</b> and <b>right</b> steer. Hold <b>up</b> to push on the flat, and to pump in a quarter-pipe’s curve for speed. <b>Down</b> brakes.</li><li><b>Space</b> (or <b>OLLIE</b>) pops an ollie. Ride up a quarter-pipe and you fly straight up out of it and come back down into it.</li><li>On a touch screen, use the stick and the four buttons. <b>V</b> switches the camera.</li></ul></div>
        <div className="sk-card"><h3>Tricks</h3><ul><li><b>J</b> (FLIP) flips the board: with a direction held, a different flip. Two kickflips quickly make a double.</li><li><b>K</b> (GRAB) grabs: hold it to score more, and let go before you land.</li><li>Hold <b>left</b> or <b>right</b> in the air to spin. Land facing the way you’re going (or backwards).</li><li>When the <b>★</b> meter is full, hold <b>K</b> and press <b>J</b> for your special.</li></ul></div>
        <div className="sk-card"><h3>Combos</h3><ul><li><b>L</b> (GRIND) near a rail, ledge or coping in the air grinds it: balance with <b>left</b> and <b>right</b>.</li><li><b>L</b> after a landing starts a manual: balance with <b>up</b> and <b>down</b>. Manuals link tricks into one combo.</li><li>A combo is all its points times the number of tricks. Repeats are worth half. Bail and it’s gone.</li><li>Clear a <b>gap</b> (over the fountain, down the handrail, across the street) for bonus points.</li></ul></div>
      </div>
    </section>}

    {screen === 'settings' && <section className="sk-page">
      <header className="sk-head"><button className="sk-back" onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="sk-card sk-settings">
        <div className="sk-set"><span>Sound</span><span className="sk-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="sk-set"><span>Music</span><span className="sk-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="sk-set"><span>Camera</span><span className="sk-seg">{(['near', 'far'] as const).map((v) => <button key={v} className={s.settings.camera === v ? 'on' : ''} onClick={() => setCamera(v)}>{v === 'near' ? 'Close' : 'Wide'}</button>)}</span></div>
        <p className="sk-small">{s.stats.sessions} sessions · {s.stats.gaps} gaps · {s.stats.acorns} golden acorns</p>
        <button className="sk-danger" onClick={() => { if (window.confirm('Start Pawpark Skate again from the beginning?')) { const n = G.newSave(); n.settings = s.settings; persist(n); setPick('plaza'); } }}>Start over</button>
      </div>
    </section>}
  </main>;
}
