'use client';
// Combo Ball: the page. The fixed-step loop for the matches (WASD or a thumb stick to run, J or PASS to pass, held for
// a lofted ball, K or SHOOT to shoot, held for power, or to slide in when the Grumbles have it, L to switch player; a
// click passes towards the pointer), the HUD (points against the target, the clock, the chain as chips × mult, the
// traits), the chain's pop-ups and a goal's count-up, Enzo's pointers, the transfer shop between matches, results, the
// ending and the save. Rules in lib/combo-game.ts, drawing in lib/combo-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/combo-game';
import type { Ev, Run, Save, TraitId } from '@/lib/combo-game';
import type { ComboScene } from '@/lib/combo-scene';
import { ComboSound, type SongId } from './sound';
import './combo.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; matches: number; goals: number; best: number; longest: number; passes: number; points: number; best0: boolean };
type Pop = { id: number; x: number; y: number; text: string; kind: 'gain' | 'mult' | 'wipe' | 'note' };
type GoalCard = { pts: number; chips: number; mult: number; notes: string[]; key: number };

const art = (n: string) => `/art/kickabout/${n}.png`;
const pic = (n: string) => `/art/combo/${n}.png`;
const INTRO = [
  'Match day! It’s Dora, Pip and me against the Grumbles. But in the Grumble leagues, a goal isn’t worth one point…',
  'It’s worth the passing move that made it! Every pass adds chips. Play it first time, one-touch, and the mult goes up too.',
  'A goal scores (10 + chips) × mult. A lone hoof scores 10. Five quick passes and a first-time finish? Hundreds!',
  'But if a Grumble touches the ball, the whole chain’s wiped. And the longer it runs, the harder they press. One more pass, or shoot now?',
  'Reach the points target before the 90 seconds are up. Win, and the transfer shop has a new trait for us. Let’s go!',
];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function ComboBallPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ComboScene | null>(null);
  const soundRef = useRef<ComboSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const runRef = useRef<Run | null>(null);
  const [phase, setPhaseState] = useState<G.Phase>('play');
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [intro, setIntro] = useState(-1);
  const introRef = useRef(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number } | null>(null);
  const [touch, setTouch] = useState(false);
  const [, setTick] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [goalCard, setGoalCard] = useState<GoalCard | null>(null);
  const goalAnim = useRef<{ pts: number; t0: number; last: number; tick: number } | null>(null);
  const [replacing, setReplacing] = useState<TraitId | null>(null);
  const [defending, setDefending] = useState(false);
  const keys = useRef(new Set<string>());
  const click = useRef<{ x: number; y: number } | null>(null);
  const passBtn = useRef(false);
  const shootBtn = useRef(false);
  const swapTap = useRef(false);
  const stick = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const reduced = useRef(false);
  const said = useRef(new Set<string>());
  const popId = useRef(1);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPhase = useCallback((p: G.Phase) => setPhaseState(p), []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;
  const redraw = () => setTick((x) => x + 1);
  const say = useCallback((text: string, mood: Line['mood'] = '', once?: string) => {
    if (once) { if (said.current.has(once)) return; said.current.add(once); }
    setLine({ text, key: Math.random(), mood }); sfx()?.enzo(text);
  }, []);
  const pop = useCallback((x: number, y: number, text: string, kind: Pop['kind']) => {
    const id = popId.current++;
    setPops((ps) => [...ps.slice(-5), { id, x, y, text, kind }]);
    setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== id)), 1200);
  }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new ComboSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/combo-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.ComboScene(canvasRef.current); sceneRef.current = sc;
      void sc.load().then(() => { if (!gone) redraw(); }); setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'play' && runRef.current?.phase === 'play') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, [setPaused]);

  // the music: the match loop, a faster one for the last twenty seconds, the shop and the ending
  const [late, setLate] = useState(false);
  useEffect(() => {
    const song: SongId | null = screen === 'play' ? (phase === 'shop' ? 'shop' : late ? 'late' : 'match') : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song);
  }, [screen, result, phase, late]);

  // fit the pitch to the window, at a whole number of screen pixels per game pixel when that is close enough
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      // an upright phone: the HUD above the pitch and the thumb pad below; a phone on its side: the pitch on the left
      // and a column on the right for Enzo and the buttons, so nothing sits over the players
      const upright = touch && innerHeight > innerWidth, side = touch && !upright;
      const pad = upright ? 230 : 0, top = upright ? 92 : 0, right = side ? 210 : 0;
      const aw = innerWidth - right - (side ? 8 : 0), ah = innerHeight - pad - top;
      let s = Math.min(aw / G.W, ah / G.H); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      const w = Math.floor(G.W * s), h = Math.floor(G.H * s);
      st.style.width = `${w}px`; st.style.height = `${h}px`;
      st.style.top = top ? `${top}px` : side ? `${Math.floor((innerHeight - h) / 2)}px` : '';
      st.style.left = side ? '8px' : '';
    };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [touch, screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the run
  const matchBanner = useCallback((r: Run) => {
    setBanner({ text: `Match ${r.match + 1} of ${G.MATCHES}`, sub: `${r.foe.name} · target ${r.target}`, key: Math.random() });
    if (r.match % 3 === 0) say(`${r.league.name}! ${r.league.text}`, r.match ? 'warn' : '');
    else if (r.match === 1) say('A goal conceded pushes the target up, so keep an eye on the Grumbles too!', '', 'concede-tip');
  }, [say]);

  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const r = new G.Run((Date.now() & 0xffffff) | 1);
    runRef.current = r; said.current.clear();
    setPaused(false); setResult(null); setLine(null); setPhase('play'); setGoalCard(null); setPops([]); setReplacing(null); setLate(false);
    setScreen('play');
    if (!saveRef.current.intro) { introRef.current = 0; setIntro(0); sfx()?.enzo(INTRO[0]); }
    else matchBanner(r);
  }, [matchBanner, setPaused, setPhase, setScreen]);

  const nextIntro = useCallback(() => {
    if (introRef.current < 0) return; sfx()?.button();
    const n = introRef.current + 1;
    if (n >= INTRO.length) {
      introRef.current = -1; setIntro(-1); persist({ ...saveRef.current, intro: true });
      const r = runRef.current; if (r) { matchBanner(r); }
      return;
    }
    introRef.current = n; setIntro(n); sfx()?.enzo(INTRO[n]);
  }, [matchBanner, persist]);

  const finish = useCallback(() => {
    const r = runRef.current; if (!r) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = s.best.goal; G.bank(s, r); persist(s);
    const won = r.phase === 'won';
    setResult({ won, matches: r.stats.won, goals: r.stats.goals, best: r.stats.best, longest: r.stats.longest, passes: r.stats.passes, points: r.stats.points, best0: r.stats.best > before && r.stats.best > 0 });
    sfx()?.stinger(won);
    setScreen('result');
  }, [persist, setScreen]);

  const onEvents = useCallback((r: Run, evs: Ev[]) => {
    const snd = sfx();
    sceneRef.current?.events(r, evs, reduced.current);
    for (const e of evs) {
      switch (e.k) {
        case 'kick': snd?.kick(!!r.pass?.lofted); break;
        case 'gain': {
          const mult = e.gains.some((g) => g.mult || g.times);
          snd?.gain(r.chain.passes, mult);
          const top = e.gains.filter((g) => g.mult || g.times);
          const text = top.length ? top.map((g) => g.times ? `${g.text} ×${g.times}` : `${g.text} +${g.mult}×`).join(' · ') : e.gains.length ? e.gains.map((g) => g.chips ? `+${g.chips}` : g.text).join(' ') : '';
          if (text) pop(e.x, e.y, text, mult ? 'mult' : e.gains.some((g) => !g.chips && !g.mult) ? 'note' : 'gain');
          if (r.chain.passes === 3) say('Three in a row! Shoot now, or keep it going for more?', 'good', 'three');
          if (e.gains.some((g) => g.text === 'Straight back: no chips')) say('Passing straight back to who gave it to you earns nothing. Find someone new!', 'warn', 'ping');
          break;
        }
        case 'wipe': snd?.wipe(); if (e.chips > 0) pop(e.x, e.y, 'Chain wiped!', 'wipe'); if (e.chips >= 40) say('Gone! A Grumble got a touch. Pass into space, or lift it over them: hold pass for a lofted ball.', 'warn', 'wiped'); break;
        case 'shot': snd?.shot(e.power); break;
        case 'save': snd?.save(); break;
        case 'post': snd?.post(); break;
        case 'wind': snd?.wind(); say('A red mark means that Grumble’s about to lunge for the ball. Pass before he gets there!', 'warn', 'wind'); break;
        case 'slide': snd?.slide(); break;
        case 'tackle': snd?.tackle(); break;
        case 'steal': snd?.steal(); break;
        case 'whistle': snd?.whistle(); break;
        case 'full': snd?.whistle(true); break;
        case 'goal': {
          snd?.goal();
          setGoalCard({ pts: e.pts, chips: e.chips, mult: e.mult, notes: e.notes, key: Math.random() });
          goalAnim.current = { pts: e.pts, t0: performance.now(), last: 0, tick: 0 };
          if (r.goals === 1 && e.pts < 60) say('A goal! But a bigger chain is worth much more. Try passing first time a few times before shooting.', '', 'small-goal');
          break;
        }
        case 'concede': snd?.concede(); say(`They scored. The target goes up to ${r.target}!`, 'warn'); break;
        case 'target': snd?.target(); break;
      }
    }
  }, [pop, say]);

  const readInput = useCallback((): G.Input => {
    const k = keys.current;
    let ax = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let ay = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    const s = stick.current;
    if (s) { const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy); if (l > 6) { const m = Math.min(1, l / 40); ax = (dx / l) * m; ay = (dy / l) * m; } }
    const c = click.current; click.current = null;
    const sw = swapTap.current || k.has('KeyL'); swapTap.current = false;
    return { ax, ay, pass: passBtn.current || k.has('KeyJ') || k.has('Space'), shoot: shootBtn.current || k.has('KeyK') || k.has('ShiftLeft') || k.has('ShiftRight'), swap: sw, click: c };
  }, []);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const snd = sfx(); snd?.pump();
      const r = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !r || !sc) return;
      const going = !pausedRef.current && introRef.current < 0 && r.phase === 'play' && !r.over;
      if (going) {
        acc += r.slow > 0 && !reduced.current ? dt * 0.45 : dt; let n = 0;
        while (acc >= G.DT && n < 6) {
          r.tick(readInput());
          if (r.events.length) onEvents(r, r.events); acc -= G.DT; n++; if (r.over) break;
        }
      } else acc = 0;
      if (r.over) {
        endT += dt;
        if (endT > 1.8) {
          endT = 0;
          if (r.phase === 'shop') { setPhase('shop'); setGoalCard(null); setReplacing(null); say(r.traits.length >= G.SLOTS ? 'Target reached! The shop’s open, but all five slots are full: pick one to swap out, or skip.' : 'Target reached! Welcome to the transfer shop. Pick one trait for the rest of the run.', 'good'); }
          else finish();
        }
      } else endT = 0;
      sc.render({ run: r, time: now / 1000, dt: going || r.over ? dt : 0, reduced: reduced.current });
      // the HUD, straight to the DOM
      const h = hud.current;
      if (h.pts) { const t = `${r.points}`; if (h.pts.textContent !== t) h.pts.textContent = t; }
      if (h.target) { const t = `${r.target}`; if (h.target.textContent !== t) h.target.textContent = t; }
      if (h.bar) h.bar.style.transform = `scaleX(${Math.min(1, r.points / r.target)})`;
      if (h.clock) { const t = fmt(Math.ceil(r.clock)); if (h.clock.textContent !== t) h.clock.textContent = t; h.clock.dataset.low = r.clock <= 20 ? '1' : '0'; }
      if (h.chips) { const t = `${10 + r.chain.chips}`; if (h.chips.textContent !== t) h.chips.textContent = t; }
      if (h.mult) { const t = `${r.chain.mult}`; if (h.mult.textContent !== t) h.mult.textContent = t; }
      if (h.chain) { h.chain.dataset.on = r.chain.passes > 0 && r.poss === 0 ? '1' : '0'; h.chain.dataset.big = r.chain.mult >= 4 ? '1' : '0'; }
      if (h.worth) { const t = `= ${(10 + r.chain.chips) * r.chain.mult}`; if (h.worth.textContent !== t) h.worth.textContent = t; }
      if (h.passes) { const t = `${r.chain.passes} ${r.chain.passes === 1 ? 'pass' : 'passes'}`; if (h.passes.textContent !== t) h.passes.textContent = t; }
      if (h.press) h.press.style.transform = `scaleX(${(r.pressure - 1) / 0.32})`;
      const isLate = r.clock <= 20 && r.phase === 'play'; setLate((v) => (v !== isLate ? isLate : v));
      const def = r.poss === 1; setDefending((v) => (v !== def ? def : v));
      // the goal's count-up
      const ga = goalAnim.current;
      if (ga && h.goalNum) {
        const k = Math.min(1, (now - ga.t0) / 900), shown = Math.round(ga.pts * (1 - Math.pow(1 - k, 3)));
        h.goalNum.textContent = `+${shown}`;
        // the till rattles while the number climbs
        if (shown !== ga.last && now - ga.tick > 55) { ga.tick = now; snd?.till(shown); }
        ga.last = shown;
        if (k >= 1) goalAnim.current = null;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput, say, setPhase]);

  // the goal card clears itself
  useEffect(() => { if (!goalCard) return; const t = setTimeout(() => setGoalCard(null), 2300); return () => clearTimeout(t); }, [goalCard]);

  const pickTrait = useCallback((id?: TraitId, drop?: TraitId) => {
    const r = runRef.current; if (!r || r.phase !== 'shop') return;
    if (id && r.traits.length >= G.SLOTS && !drop) { setReplacing(id); sfx()?.button(); return; }
    if (!r.pick(id, drop)) return;
    sfx()?.pick(); setReplacing(null); setPhase('play'); setLine(null); redraw(); matchBanner(r);
  }, [matchBanner, setPhase]);

  // ---------------------------------------------------------------- keyboard, mouse and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const run = runRef.current;
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (run?.phase === 'shop') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && run.offer[i]) pickTrait(run.offer[i]); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); passBtn.current = false; shootBtn.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, [nextIntro, pickTrait, setPaused]);

  const toGame = (e: React.PointerEvent) => { const c = canvasRef.current!.getBoundingClientRect(); return { x: (e.clientX - c.left) * (G.W / c.width), y: (e.clientY - c.top) * (G.H / c.height) }; };
  const onDown = (e: React.PointerEvent) => {
    sfx()?.unlock();
    if (e.pointerType !== 'mouse') return;
    if (e.button === 0) click.current = toGame(e);
    if (e.button === 2) { shootBtn.current = true; setTimeout(() => { shootBtn.current = false; }, 120); }
  };
  // the thumb stick appears wherever the thumb lands
  const stickDown = (e: React.PointerEvent) => {
    e.preventDefault(); sfx()?.unlock();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    stick.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    setKnob({ x: e.clientX - b.left, y: e.clientY - b.top });
  };
  const stickMove = (e: React.PointerEvent) => { const s = stick.current; if (!s || s.id !== e.pointerId) return; s.x = e.clientX; s.y = e.clientY; const el = hud.current.knob; if (el) { const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy), m = Math.min(l, 40) / (l || 1); el.style.transform = `translate(${dx * m}px,${dy * m}px)`; } };
  const stickUp = (e: React.PointerEvent) => { if (stick.current?.id === e.pointerId) { stick.current = null; setKnob(null); } };
  const hold = (ref: React.MutableRefObject<boolean>) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); ref.current = true; sfx()?.unlock(); },
    onPointerUp: () => { ref.current = false; }, onPointerCancel: () => { ref.current = false; }, onPointerLeave: () => { ref.current = false; },
  });
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };
  const giveUp = () => { const run = runRef.current; if (!run) return; setPaused(false); run.phase = 'lost'; run.over = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __combo: () => unknown }).__combo = () => {
      const run = runRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, intro: introRef.current, save: saveRef.current, result, line, phase,
        run: run && screenRef.current === 'play' ? {
          match: run.match, phase: run.phase, over: run.over, points: run.points, target: run.target, clock: run.clock, goals: run.goals, conceded: run.conceded,
          chain: { chips: run.chain.chips, mult: run.chain.mult, passes: run.chain.passes }, traits: [...run.traits], offer: [...run.offer], poss: run.poss, ctl: run.ctl,
          ball: { x: run.ball.x, y: run.ball.y, z: run.ball.z, owner: run.ball.owner }, players: run.players.map((p) => ({ who: p.who, x: p.x, y: p.y })), stats: { ...run.stats },
        } : null,
        debug: {
          win: () => { if (run && run.phase === 'play') { run.points = run.target; run.pause = 0.05; run.next = 0; } },
          lose: () => { if (run && run.phase === 'play') run.clock = 0.02; },
          clock: (s: number) => { if (run) run.clock = s; },
          traits: (ids: TraitId[]) => { if (run) { run.traits = ids.slice(0, G.SLOTS); redraw(); } },
          match: (m: number) => { if (run) { run.match = m; run.startMatch(); redraw(); } },
          chain: (chips: number, mult: number, passes: number) => { if (run) Object.assign(run.chain, { chips, mult, passes, touches: [{ x: run.ball.x, y: run.ball.y }] }); },
          ball: (x: number, y: number) => { if (run) { const p = run.players[run.ctl]; Object.assign(p, { x, y, hold: 1, stun: 0 }); Object.assign(run.ball, { owner: p.i, x: x + 5, y, z: 0, vx: 0, vy: 0, vz: 0 }); run.poss = 0; run.pass = null; run.shot = null; run.queue = null; run.pause = 0; } },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save;
  const r = runRef.current;
  return <main className={`cb-shell cb-on-${screen} cb-ph-${phase}${touch ? ' cb-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen} data-phase={phase} onContextMenu={(e) => e.preventDefault()}>
    <div className="cb-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="cb-canvas" aria-label="Combo Ball: the pitch, with Dora, Enzo and Pip against the Grumbles" onPointerDown={onDown} />
      {screen === 'play' && r && <div className="cb-hud">
        <div className="cb-top">
          <div className="cb-score"><span className="cb-lab">Points</span><b ref={H('pts')}>0</b><span className="cb-of">/ <span ref={H('target')}>{r.target}</span></span><span className="cb-track"><i ref={H('bar')} /></span></div>
          <div className="cb-chain" ref={H('chain')} data-on="0" data-big="0" aria-label="The chain: chips times mult">
            <span className="cb-lab">Chain</span><b className="cb-chips" ref={H('chips')}>10</b><i>×</i><b className="cb-mult" ref={H('mult')}>1</b><span className="cb-worth" ref={H('worth')}>= 10</span>
            <span className="cb-passes" ref={H('passes')}>0 passes</span>
            {pops.length > 0 && <span key={pops[pops.length - 1].id} className={`cb-pop ${pops[pops.length - 1].kind}`}>{pops[pops.length - 1].text}</span>}
            <span className="cb-press" title="How hard the Grumbles are pressing"><i ref={H('press')} /></span>
          </div>
          <div className="cb-clock"><span className="cb-lab">M{r.match + 1}</span><b ref={H('clock')} data-low="0">1:30</b></div>
          <button className="cb-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
        </div>
        {r.traits.length > 0 && <div className="cb-traits" aria-label="Traits">{r.traits.map((t) => <span key={t} title={G.trait(t).text}>{G.trait(t).name}</span>)}</div>}
        {banner && phase === 'play' && intro < 0 && <div className="cb-banner" key={banner.key}><b>{banner.text}</b><span>{banner.sub}</span></div>}
        {goalCard && <div className="cb-goal" key={goalCard.key}>
          <b className="cb-goalword">GOAL!</b>
          <span className="cb-sum">{goalCard.chips} chips × {goalCard.mult} mult</span>
          <b className="cb-goalnum" ref={H('goalNum')}>+0</b>
          {goalCard.notes.length > 0 && <span className="cb-notes">{goalCard.notes.join(' · ')}</span>}
        </div>}
        {line && intro < 0 && phase === 'play' && <div className={`cb-line ${line.mood}`} key={line.key}>
          <img src={art('enzo-big')} alt="" /><p><b>Enzo</b>{line.text}</p>
        </div>}
        {!touch && phase === 'play' && r.traits.length === 0 && <p className="cb-keys"><b>WASD</b> run · <b>J</b> pass (hold: lofted) · <b>K</b> shoot (hold: power) / slide · <b>L</b> switch · <b>click</b> passes there · Esc pause</p>}
        {phase === 'shop' && <div className="cb-overlay"><div className="cb-shop">
          <h2>The transfer shop</h2>
          <p>{replacing ? `All five slots are full. Which trait makes way for ${G.trait(replacing).name}?` : `Target reached! Next: match ${r.match + 2} of ${G.MATCHES}, ${G.team(r.match + 1).name}, target ${G.TARGETS[r.match + 1]}. Pick one:`}</p>
          {!replacing && <div className="cb-offers">{r.offer.map((id, i) => <button key={id} className="cb-card cb-offer" data-trait={id} onClick={() => pickTrait(id)}>
            {!touch && <kbd>{i + 1}</kbd>}<b>{G.trait(id).name}</b><span>{G.trait(id).text}</span>
          </button>)}</div>}
          {replacing && <div className="cb-offers">{r.traits.map((id) => <button key={id} className="cb-card cb-offer drop" data-drop={id} onClick={() => pickTrait(replacing, id)}>
            <b>Drop {G.trait(id).name}</b><span>{G.trait(id).text}</span>
          </button>)}</div>}
          <div className="cb-row">
            {r.traits.length > 0 && !replacing && <span className="cb-small">Your traits ({r.traits.length}/{G.SLOTS}): {r.traits.map((t) => G.trait(t).name).join(', ')}</span>}
            <button onClick={() => replacing ? setReplacing(null) : pickTrait(undefined)}>{replacing ? 'Back' : 'Skip'}</button>
          </div>
        </div></div>}
        {paused && <div className="cb-overlay"><div className="cb-card cb-pausecard">
          <h2>Paused</h2>
          <button className="cb-go" onClick={() => setPaused(false)}>Keep playing</button>
          <button onClick={giveUp}>End this run</button>
        </div></div>}
        {intro >= 0 && <div className="cb-overlay"><div className="cb-card cb-introcard" onClick={nextIntro} role="button" tabIndex={0}>
          <img src={art('enzo-big')} alt="Enzo" />
          <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
        </div></div>}
      </div>}
    </div>

    {screen === 'play' && touch && phase === 'play' && <div className="cb-touchpad">
      <div className="cb-stickzone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
        {knob ? <div className="cb-stick" style={{ left: knob.x, top: knob.y }}><i ref={H('knob')} /></div> : <p>Put your thumb here and slide to run</p>}
      </div>
      <div className="cb-btns">
        <button className="cb-swap" onPointerDown={(e) => { e.preventDefault(); swapTap.current = true; sfx()?.unlock(); }}>SWITCH</button>
        <button className="cb-shoot" {...hold(shootBtn)}>{defending ? 'TACKLE' : 'SHOOT'}</button>
        <button className="cb-pass" {...hold(passBtn)}>PASS</button>
      </div>
    </div>}

    {screen === 'title' && <section className="cb-title">
      <div className="cb-bg"><img src={pic('title')} alt="Dora volleys a golden ball at goal at the end of a zig-zag of golden passes from Enzo, while two Grumbles tumble over" /></div>
      <div className="cb-title-col">
        <h1 className="cb-logo">Combo Ball</h1>
        <p className="cb-tag">A goal is worth the passing move that made it. Chain one-touch passes for chips and mult, then cash the chain in before a Grumble wipes it.</p>
        <div className="cb-menu">
          <button className="cb-go" onClick={startRun}>{s.stats.runs ? 'New run' : 'Kick off'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="cb-small">Best: {s.best.matches} of {G.MATCHES} matches · biggest goal {s.best.goal} · longest chain {s.best.chain}{s.stats.wins ? ` · ${s.stats.wins} ${s.stats.wins === 1 ? 'title' : 'titles'}` : ''}</p>}
        <a className="cb-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`cb-page cb-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="cb-bg"><img src={pic('ending')} alt="Dora and Enzo lift a golden trophy together at sunset while coins and confetti rain down" /></div>}
      <div className="cb-card cb-resultcard">
        <h2>{result.won ? 'Champions of the Summit League!' : 'Full time'}</h2>
        <p>{result.won ? 'Nine matches, nine targets. The Grumbles shake paws, grudgingly, and Pip wants to know when the next season starts.' : `The target got away this time. Dora, Enzo and Pip won ${result.matches} of ${G.MATCHES} matches${result.best0 ? ', with their biggest goal yet!' : '.'}`}</p>
        <ul className="cb-stats">
          <li><b>{result.matches}</b><span>matches won</span></li><li><b>{result.goals}</b><span>goals</span></li><li><b>{result.best}</b><span>biggest goal</span></li><li><b>{result.longest}</b><span>longest chain</span></li><li><b>{result.passes}</b><span>passes</span></li>
        </ul>
        <div className="cb-row"><button className="cb-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="cb-page">
      <header className="cb-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="cb-cols">
        <div className="cb-card"><h3>The chain</h3><ul>
          <li>Every <b>completed pass</b> adds <b>10 chips</b>; a long ball, a lofted ball or a switch right across the pitch adds more.</li>
          <li>A <b>one-touch</b> pass (played first time) adds <b>+1 mult</b>. Press pass just before the ball reaches you and it goes first time.</li>
          <li>A <b>goal</b> scores <b>(10 + chips) × mult</b>. A first-time finish adds +1 mult more.</li>
          <li>A Grumble touching the ball <b>wipes the chain</b>. Passing straight back to who gave it to you earns nothing.</li>
          <li>The longer the chain, the <b>harder the Grumbles press</b> (the bar under the chain).</li>
          <li>But a long passing move also leaves their <b>keeper</b> chasing shadows: a shot at the end of a chain is far more likely to go in than a lone dribble.</li>
        </ul></div>
        <div className="cb-card"><h3>The controls</h3><ul>
          {touch ? <>
            <li>Slide the <b>thumb stick</b> to run. You always play whoever has the ball.</li>
            <li><b>PASS</b> passes to the team-mate the stick points at. Hold it for a <b>lofted</b> pass over a Grumble.</li>
            <li><b>SHOOT</b> shoots (hold for power; push the stick up or down to pick a corner). When the Grumbles have the ball it’s <b>TACKLE</b>: a slide.</li>
            <li><b>SWITCH</b> changes player when you’re defending.</li>
          </> : <>
            <li><b>WASD</b> or the arrows run. You always play whoever has the ball.</li>
            <li><b>J</b> or <b>Space</b> passes to the team-mate you’re pointing at; <b>hold</b> it for a <b>lofted</b> pass. Or <b>click</b> where you want it to go.</li>
            <li><b>K</b> or <b>Shift</b> shoots (hold for power; up or down picks a corner). When the Grumbles have the ball it slides in for a tackle.</li>
            <li><b>L</b> switches player when you’re defending. <b>Esc</b> pauses.</li>
          </>}
        </ul></div>
        <div className="cb-card"><h3>The run</h3><ul>
          <li>Nine matches in three leagues, <b>90 seconds</b> each. Reach the <b>points target</b> before full time.</li>
          <li>Each goal the Grumbles score pushes the target up.</li>
          <li>After every win the <b>transfer shop</b> offers three traits. You can keep five.</li>
          <li>A red mark over a Grumble means he’s about to lunge for the ball.</li>
        </ul></div>
        <div className="cb-card cb-traitlist"><h3>Traits</h3>
          {G.TRAITS.map((t) => <p key={t.id}><b>{t.name}</b>{t.text}</p>)}
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="cb-page">
      <header className="cb-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="cb-card cb-settings">
        <div className="cb-set"><span>Sound</span><span className="cb-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="cb-set"><span>Music</span><span className="cb-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <p className="cb-small">{s.stats.runs} runs · {s.stats.wins} titles · {s.stats.goals} goals · {s.stats.passes} passes</p>
        <button className="cb-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
