'use client';
// Into Space: the page. The fixed-step loop for the matches (WASD or a thumb stick to run; J held, or the mouse, picks
// the spot for a pass, with Shift, L or right-click to loft it; K shoots or tackles; Space sprints; Q switches runner;
// on a phone the PASS button is a slingshot), the HUD, Enzo's pointers, the changing room between rounds with its
// three picks and the next opponent, results, the ending and the save. Rules in lib/space-game.ts, drawing in
// lib/space-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/space-game';
import type { Ev, PerkId, Run, Save } from '@/lib/space-game';
import type { SpaceScene } from '@/lib/space-scene';
import { SpaceSound, type SongId } from './sound';
import './space.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; rounds: number; goals: number; against: number; perfects: number; best: number; out: string; best_: boolean };

const art = (n: string) => `/art/space/${n}.png`;
const kit = (n: string) => `/art/kickabout/${n}.png`;
const INTRO = [
  'Cup day! I’m Enzo, and here’s the trick that wins it: we never pass to feet. We pass into space.',
  'Pick a spot on the grass and pass it there. The moment it leaves your boot, you’re the runner going to meet it.',
  'See the gold ring? It shrinks as the ball comes down. Arrive just as it closes: too early and you have to stop and settle it, too late and it’s a scramble.',
  'Get it perfect and time slows down. That’s your moment: a first-time pass, or a first-time shot. Ready?',
];
const PITCH_TIP: Record<G.PitchId, string> = {
  dry: 'Summer grass today. It plays true.',
  wet: 'It’s pouring! The ball skids on after it lands, so arrive a touch early to meet it… but not too early.',
  sand: 'The beach! The ball dies where it lands, and we’re all slower in the sand.',
  hard: 'The pitch is baked hard. Lofted balls bounce high and run on: meet them on the drop.',
};
const SHAPE_TIP: Record<G.ShapeId, string> = {
  high: 'They play a high line: there’s loads of space behind them. Lob it over!',
  low: 'They sit deep in their box. Go wide, and be patient.',
  man: 'They mark man to man. Make a run and your marker comes with you.',
};
const mmss = (t: number) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function IntoSpacePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const soundRef = useRef<SpaceSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const runRef = useRef<Run | null>(null);
  const [phase, setPhaseState] = useState<G.Phase>('match');
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [intro, setIntro] = useState(-1);
  const introRef = useRef(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number } | null>(null);
  const [touch, setTouch] = useState(false);
  const [, setTick] = useState(0);
  const keys = useRef(new Set<string>());
  /** the mouse, in game pixels, and when it last moved */
  const mouse = useRef({ x: 0, y: 0, at: -1e9 });
  const click = useRef<{ loft: boolean } | null>(null);
  const stick = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  /** the PASS slingshot: where the drag started and where it is */
  const sling = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null);
  const slingGo = useRef<{ spot: { x: number; y: number } | null; loft: boolean } | null>(null);
  const shootBtn = useRef(false);
  const sprintBtn = useRef(false);
  const swapTap = useRef(false);
  const reduced = useRef(false);
  /** debug only: the browser tests can have the runner time his run onto the spot */
  const autoRun = useRef(false);
  const said = useRef(new Set<string>());
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

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new SpaceSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/space-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.SpaceScene(canvasRef.current); sceneRef.current = sc;
      void sc.load().then(() => { if (!gone) redraw(); }); setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'play' && runRef.current?.phase === 'match') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, [setPaused]);

  // the music
  const [golden, setGolden] = useState(false);
  useEffect(() => {
    const song: SongId | null = screen === 'play' ? (phase === 'pick' ? 'room' : golden ? 'golden' : 'match') : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song);
  }, [screen, result, phase, golden]);

  // fit the pitch to the window, at a whole number of screen pixels per game pixel when that is close enough
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      const pad = touch && innerHeight > innerWidth ? 250 : 0;
      const aw = innerWidth, ah = innerHeight - pad;
      let s = Math.min(aw / G.W, ah / G.H); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      st.style.width = `${Math.floor(G.W * s)}px`; st.style.height = `${Math.floor(G.H * s)}px`;
      st.style.top = pad ? `${Math.max(56, Math.floor((ah - G.H * s) / 2))}px` : '';
    };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [touch, screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the run
  const announce = useCallback((r: Run) => {
    setBanner({ text: G.ROUND_NAMES[r.round], sub: `v ${r.team}`, key: Math.random() });
    if (r.round === 0) say(touch ? 'Drag out from PASS the way you want the ball to go, and let go. Then run onto it with the stick!' : 'Hold J and the target walks out ahead of you (or point with the mouse and click). Let go, then run onto it!', '', 'controls');
    else say(`${PITCH_TIP[r.pitch]} ${SHAPE_TIP[r.shape]}`);
  }, [say, touch]);

  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const r = new G.Run((Date.now() & 0xffffff) | 1);
    runRef.current = r; said.current.clear();
    setPaused(false); setResult(null); setLine(null); setPhase('match'); setGolden(false);
    setScreen('play');
    if (!saveRef.current.intro) { introRef.current = 0; setIntro(0); sfx()?.enzo(INTRO[0]); }
    else announce(r);
  }, [announce, setPaused, setPhase, setScreen]);

  const nextIntro = useCallback(() => {
    if (introRef.current < 0) return; sfx()?.button();
    const n = introRef.current + 1;
    if (n >= INTRO.length) { introRef.current = -1; setIntro(-1); persist({ ...saveRef.current, intro: true }); if (runRef.current) announce(runRef.current); return; }
    introRef.current = n; setIntro(n); sfx()?.enzo(INTRO[n]);
  }, [announce, persist]);

  const finish = useCallback(() => {
    const r = runRef.current; if (!r) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = s.best.round; G.bank(s, r); persist(s);
    const won = r.phase === 'won';
    setResult({ won, rounds: r.stats.rounds, goals: r.stats.goals, against: r.stats.against, perfects: r.stats.perfects, best: r.stats.best, out: `${G.ROUND_NAMES[r.round]}, ${r.score[0]}–${r.score[1]} v ${r.team}`, best_: s.best.round > before });
    sfx()?.stinger(won);
    setScreen('result');
  }, [persist, setScreen]);

  const onEvents = useCallback((r: Run, evs: Ev[]) => {
    const snd = sfx();
    sceneRef.current?.events(r, evs, reduced.current);
    for (const e of evs) {
      switch (e.k) {
        case 'kick': snd?.kick(e.loft); break;
        case 'switch': snd?.switchTo(); break;
        case 'rate':
          if (e.r === 'perfect') {
            snd?.perfect(e.streak);
            if (e.streak === 1) say('PERFECT! Time’s slowed down: play it first time, pass or shoot!', 'good', 'perfect');
            else if (e.streak === 3) say('Three perfect in a row! They can’t live with this!', 'good', 'three');
          } else if (e.r === 'early') { snd?.early(); say('Too early! You had to stop and settle it. Hold your run until the ring closes.', 'warn', 'early'); }
          else { snd?.late(); say('A bit late! Start your run sooner, or pass a little shorter.', 'warn', 'late'); }
          break;
        case 'land': snd?.land(e.hard); break;
        case 'bounce': snd?.bounce(); break;
        case 'shot': snd?.shot(e.first); break;
        case 'save': snd?.save(); break;
        case 'post': snd?.post(); break;
        case 'tackle': snd?.tackle(e.won); break;
        case 'intercept': snd?.intercept(); say('Cut out! Lead the runner away from the Grumbles, or loft it over them.', 'warn', 'intercept'); break;
        case 'wall': snd?.kick(false); break;
        case 'goal':
          snd?.goal(e.side === 0);
          setBanner(e.side === 0 ? { text: r.golden ? 'Golden goal!' : 'GOAL!', sub: G.NAMES[e.who], key: Math.random() } : { text: 'Grumble goal', sub: `${r.score[0]}–${r.score[1]}`, key: Math.random() });
          if (e.side === 0) say(r.golden ? 'GOLDEN GOAL! We’re through!' : `GOAL! ${G.NAMES[e.who]}!`, 'good');
          else say('They’ve scored. Heads up, plenty of time!', 'warn');
          break;
        case 'whistle':
          snd?.whistle(e.what === 'full');
          if (e.what === 'golden') { setGolden(true); setBanner({ text: 'Golden goal', sub: 'next goal wins', key: Math.random() }); say('Level! Golden goal: next one wins. If nobody scores, it goes to whoever played it better.', 'warn'); }
          break;
        case 'end':
          setGolden(false);
          if (r.phase === 'pick') { setPhase('pick'); sfx()?.pick(); }
          break;
      }
    }
  }, [say, setPhase]);

  // ---------------------------------------------------------------- input
  const readInput = useCallback((r: Run): G.Input => {
    const k = keys.current, inp = G.noInput();
    let mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    const s = stick.current;
    if (s) { const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy); if (l > 6) { const m = Math.min(1, l / 40); mx = (dx / l) * m; my = (dy / l) * m; } }
    inp.mx = mx; inp.my = my;
    inp.pass = k.has('KeyJ') || k.has('KeyZ');
    inp.loft = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyL');
    inp.shoot = k.has('KeyK') || k.has('KeyX') || shootBtn.current;
    inp.sprint = k.has('Space') || sprintBtn.current;
    inp.cycle = k.has('KeyQ') || swapTap.current; swapTap.current = false;
    const now = performance.now();
    const mouseOn = !touch && now - mouse.current.at < 2500;
    if (mouseOn) { inp.spot = { x: mouse.current.x, y: mouse.current.y }; inp.aimY = mouse.current.y; }
    if (click.current) { inp.passNow = true; inp.loft = inp.loft || click.current.loft; if (!inp.spot) inp.spot = { x: mouse.current.x, y: mouse.current.y }; click.current = null; }
    // the slingshot: while dragging out from PASS, the spot follows the drag
    const sl = sling.current, car = r.carrier;
    if (sl && car) {
      const dx = sl.x - sl.x0, dy = sl.y - sl.y0, l = Math.hypot(dx, dy);
      if (l > 10) { const k2 = G.MAX_PASS / 120; inp.spot = { x: car.x + dx * k2, y: car.y + dy * k2 }; inp.loft = l > 80; }
    }
    if (slingGo.current) { inp.passNow = true; inp.spot = slingGo.current.spot; inp.loft = slingGo.current.loft; slingGo.current = null; }
    if (autoRun.current && r.pass && r.flight && r.pass.receiver === r.ctrl) {
      const me = r.players[r.ctrl], f = r.flight, d = Math.hypot(f.tx - me.x, f.ty - me.y), left = r.pass.land - r.gt;
      const want = d < G.ARRIVE - 2 ? 0.5 : Math.min(1, (d - G.ARRIVE + 2) / Math.max(0.03, left) / r.speedOf(me));
      inp.mx = ((f.tx - me.x) / (d || 1)) * want; inp.my = ((f.ty - me.y) / (d || 1)) * want;
    }
    return inp;
  }, [touch]);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const snd = sfx(); snd?.pump();
      const r = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !r || !sc) return;
      const going = !pausedRef.current && introRef.current < 0 && r.phase === 'match';
      if (going) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 6) {
          const wasRound = r.round;
          r.tick(readInput(r));
          if (r.events.length) onEvents(r, r.events); acc -= G.DT; n++;
          if (r.round !== wasRound) announce(r);
          if (r.phase !== 'match') break;
        }
      } else acc = 0;
      if (r.phase === 'won' || r.phase === 'lost') { endT += dt; if (endT > 0.4) { endT = 0; finish(); return; } } else endT = 0;
      sc.render({ run: r, time: now / 1000, dt: going ? dt : 0, reduced: reduced.current });
      // the HUD, straight to the DOM
      const h = hud.current;
      const set = (k: string, t: string) => { const el = h[k]; if (el && el.textContent !== t) el.textContent = t; };
      set('us', String(r.score[0])); set('them', String(r.score[1]));
      set('clock', r.golden ? `GG ${mmss(r.clock)}` : mmss(r.clock));
      if (h.clockBox) h.clockBox.dataset.golden = r.golden ? '1' : '0';
      const me = r.players[r.ctrl];
      if (h.stamina) h.stamina.style.transform = `scaleX(${Math.max(0, me.stamina / r.staminaMax)})`;
      set('who', G.NAMES[me.who]);
      set('streak', r.streak > 0 ? `×${r.streak}` : '');
      if (h.streakBox) h.streakBox.dataset.on = r.streak > 0 ? '1' : '0';
      if (h.swap) h.swap.style.visibility = r.pass && r.flight && r.players[r.pass.passer].side === 0 ? 'visible' : 'hidden';
      if (h.shootBtn) { const t = r.carrier && r.carrier.side === 0 ? 'SHOOT' : 'TACKLE'; if (h.shootBtn.textContent !== t) h.shootBtn.textContent = t; }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [announce, finish, onEvents, readInput]);

  const pickPerk = useCallback((id?: PerkId) => {
    const run = runRef.current; if (!run || !run.pick(id)) return;
    sfx()?.pick(); setPhase('match'); redraw(); announce(run);
  }, [announce, setPhase]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const run = runRef.current;
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (run?.phase === 'pick') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && run.offer[i]) pickPerk(run.offer[i]); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
      // keys move the reticle again, not the mouse
      if (/^(Arrow|Key[WASDJ])/.test(e.code)) mouse.current.at = -1e9;
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); shootBtn.current = false; sprintBtn.current = false; sling.current = null; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, [nextIntro, pickPerk, setPaused]);

  const toGame = (e: React.PointerEvent) => { const c = canvasRef.current!.getBoundingClientRect(); return { x: (e.clientX - c.left) * (G.W / c.width), y: (e.clientY - c.top) * (G.H / c.height) }; };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') { const p = toGame(e); mouse.current = { ...p, at: performance.now() }; } };
  const onDown = (e: React.PointerEvent) => {
    sfx()?.unlock();
    if (e.pointerType !== 'mouse') return;
    const p = toGame(e); mouse.current = { ...p, at: performance.now() };
    if (e.button === 0) click.current = { loft: e.shiftKey };
    if (e.button === 2) click.current = { loft: true };
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
  // PASS: drag out from the button the way you want the ball to go (further for further; a long drag lofts it), let go to pass; a tap passes ahead
  const slingDown = (e: React.PointerEvent) => { e.preventDefault(); sfx()?.unlock(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); sling.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; };
  const slingMove = (e: React.PointerEvent) => { const s = sling.current; if (!s || s.id !== e.pointerId) return; s.x = e.clientX; s.y = e.clientY; };
  const slingUp = (e: React.PointerEvent) => {
    const s = sling.current; if (!s || s.id !== e.pointerId) return; sling.current = null;
    const r = runRef.current, car = r?.carrier; if (!r || !car) return;
    const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy), k = G.MAX_PASS / 120;
    slingGo.current = l > 10 ? { spot: { x: car.x + dx * k, y: car.y + dy * k }, loft: l > 80 } : { spot: null, loft: false };
  };
  const hold = (ref: React.MutableRefObject<boolean>) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); ref.current = true; sfx()?.unlock(); },
    onPointerUp: () => { ref.current = false; }, onPointerCancel: () => { ref.current = false; }, onPointerLeave: () => { ref.current = false; },
  });
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };
  const giveUp = () => { const run = runRef.current; if (!run) return; setPaused(false); run.phase = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __space: () => unknown }).__space = () => {
      const run = runRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, intro: introRef.current, save: saveRef.current, result, line,
        run: run && screenRef.current === 'play' ? {
          round: run.round, phase: run.phase, state: run.state, score: [...run.score], clock: run.clock, golden: run.golden, pitch: run.pitch, shape: run.shape, team: run.team,
          ctrl: run.ctrl, who: run.players[run.ctrl].who, streak: run.streak, slow: run.slow, perks: { ...run.perks }, offer: [...run.offer], upcoming: run.upcoming,
          ball: { x: run.ball.x, y: run.ball.y, z: run.ball.z, owner: run.ball.owner }, reticle: run.reticle, rating: run.lastRating,
          pass: run.pass ? { x: run.pass.x, y: run.pass.y, receiver: run.pass.receiver, land: run.pass.land, flying: !!run.flight } : null,
          players: run.players.map((p) => ({ i: p.i, who: p.who, side: p.side, x: p.x, y: p.y })), gt: run.gt, stats: { ...run.stats },
        } : null,
        debug: {
          win: () => { if (run && run.phase === 'match') { run.score = [run.score[0] + 1, run.score[1]]; run.clock = 0.02; } },
          lose: () => { if (run && run.phase === 'match') { run.score = [run.score[0], run.score[0] + 1]; run.clock = 0.02; } },
          clock: (t: number) => { if (run) run.clock = t; },
          place: (i: number, x: number, y: number) => { if (run) Object.assign(run.players[i], { x, y, vx: 0, vy: 0 }); },
          give: (i: number) => { if (run) { run.flight = null; run.pass = null; Object.assign(run.ball, { owner: i, z: 0, vx: 0, vy: 0, vz: 0 }); if (run.players[i].side === 0) run.ctrl = i; } },
          clear: () => { if (run) for (const p of run.players) if (p.side === 1 && !p.gk) Object.assign(p, { x: G.PITCH.x1 - 20, y: G.PITCH.y0 + 10 + p.i * 3 }); },
          auto: (on: boolean) => { autoRun.current = on; },
          round: (n: number) => { if (run && run.phase === 'match') { run.round = n; run.setupRound(); redraw(); } },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, r = runRef.current;
  const up = r?.upcoming;
  return <main className={`is-shell is-on-${screen} is-ph-${phase}${touch ? ' is-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen} data-phase={phase} onContextMenu={(e) => e.preventDefault()}>
    <div className="is-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="is-canvas" aria-label="Into Space: the pitch, with Dora, Enzo, Pip and Bram against the Grumbles" onPointerMove={onMove} onPointerDown={onDown} />
      {screen === 'play' && r && <div className="is-hud">
        <div className="is-top">
          <div className="is-score"><span className="is-us">Us</span><b ref={H('us')}>0</b><i>–</i><b ref={H('them')}>0</b><span className="is-them">{r.team}</span></div>
          <div className="is-clock" ref={H('clockBox')} data-golden="0"><b ref={H('clock')}>2:00</b></div>
          <div className="is-me"><b ref={H('who')}>Dora</b><span className="is-track"><i ref={H('stamina')} /></span><span className="is-streak" ref={H('streakBox')} data-on="0"><b ref={H('streak')} /></span></div>
          <div className="is-where"><b>{G.ROUND_NAMES[r.round]}</b><span>{G.PITCHES[r.pitch].name} · {G.SHAPES[r.shape].name}</span></div>
          <button className="is-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
        </div>
        {banner && phase === 'match' && <div className="is-banner" key={banner.key}><b>{banner.text}</b><span>{banner.sub}</span></div>}
        {line && intro < 0 && phase === 'match' && <div className={`is-line ${line.mood}`} key={line.key}>
          <img src={kit('enzo-big')} alt="" /><p><b>Enzo</b>{line.text}</p>
        </div>}
        {!touch && phase === 'match' && <p className="is-keys"><b>WASD</b> run · <b>J</b>/<b>mouse</b> pass · <b>Shift</b> loft · <b>K</b> shoot · <b>Space</b> sprint · <b>Q</b> switch</p>}
        {phase === 'pick' && <div className="is-overlay"><div className="is-room">
          <h2>{r.round + 1 === G.ROUNDS - 1 ? 'Into the Final!' : 'Through!'}</h2>
          {up && <p className="is-next">{G.ROUND_NAMES[r.round + 1]}: <b>{G.TEAMS[r.round + 1]}</b> · {G.PITCHES[up.pitch].name} · {G.SHAPES[up.shape].name}<small>{G.PITCHES[up.pitch].text} {G.SHAPES[up.shape].text}</small></p>}
          <p>Enzo’s been thinking in the changing room. Pick one:</p>
          <div className="is-offers">{r.offer.map((id, i) => { const p = G.PERKS.find((x) => x.id === id)!; return <button key={id} className="is-card is-offer" data-perk={id} onClick={() => pickPerk(id)}>
            {!touch && <kbd>{i + 1}</kbd>}<small>{p.kind}</small><b>{p.name}</b><span>{p.text}</span>
          </button>; })}</div>
        </div></div>}
        {intro >= 0 && <div className="is-overlay"><div className="is-card is-introcard" onClick={nextIntro} role="button" tabIndex={0}>
          <img src={kit('enzo-big')} alt="Enzo" />
          <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
        </div></div>}
        {paused && <div className="is-overlay"><div className="is-card is-pausecard">
          <h2>Paused</h2>
          {Object.keys(r.perks).length > 0 && <ul className="is-perklist">{G.PERKS.filter((p) => r.perks[p.id]).map((p) => <li key={p.id}><b>{p.name}</b> {p.text}</li>)}</ul>}
          <button className="is-go" onClick={() => setPaused(false)}>Play on</button>
          <button onClick={giveUp}>End this run</button>
        </div></div>}
      </div>}
    </div>

    {screen === 'play' && touch && phase === 'match' && <div className="is-touchpad">
      <div className="is-stickzone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
        {knob ? <div className="is-stick" style={{ left: knob.x, top: knob.y }}><i ref={H('knob')} /></div> : <p>Put your thumb here and slide to run<small className="is-turn">Turn your phone sideways for a bigger pitch</small></p>}
      </div>
      <div className="is-btns">
        <button className="is-swap" ref={H('swap')} onPointerDown={(e) => { e.preventDefault(); swapTap.current = true; }} style={{ visibility: 'hidden' }}>SWITCH</button>
        <button className="is-sprint" {...hold(sprintBtn)}>SPRINT</button>
        <button className="is-shoot" ref={H('shootBtn')} {...hold(shootBtn)}>SHOOT</button>
        <button className="is-pass" onPointerDown={slingDown} onPointerMove={slingMove} onPointerUp={slingUp} onPointerCancel={slingUp}>PASS<small>drag to aim</small></button>
      </div>
    </div>}

    {screen === 'title' && <section className="is-title">
      <div className="is-bg"><img src={art('title')} alt="Dora curls a long pass high into a sunset sky as Enzo sprints towards a gold ring on the grass where it will land, two Grumbles a step behind" /></div>
      <div className="is-title-col">
        <h1 className="is-logo">Into Space</h1>
        <p className="is-tag">Never pass to feet. Pass into space, take over the runner, and arrive just as it lands. A seven-round cup against the Grumbles.</p>
        <div className="is-menu">
          <button className="is-go" onClick={startRun}>{s.stats.runs ? 'New cup run' : 'Kick off'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="is-small">Best: {s.best.round >= G.ROUNDS ? 'won the cup' : `${s.best.round} ${s.best.round === 1 ? 'round' : 'rounds'} won`} · {s.best.flow} perfect in a row{s.stats.cups ? ` · ${s.stats.cups} ${s.stats.cups === 1 ? 'cup' : 'cups'}` : ''}</p>}
        <a className="is-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`is-page is-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="is-bg"><img src={art('ending')} alt="Dora and Enzo hold up the silver cup on a podium under fireworks while their teammates cheer and two Grumbles shake their paws" /></div>}
      <div className="is-card is-resultcard">
        {!result.won && <img className="is-trophy" src={kit('trophy')} alt="" />}
        <h2>{result.won ? 'Cup winners!' : 'Knocked out'}</h2>
        <p>{result.won ? 'Seven rounds, and the Grumble Grand XI beaten in the final. Enzo says it was all in the timing.' : `Out in ${result.out}. ${result.rounds ? `${result.rounds} ${result.rounds === 1 ? 'round' : 'rounds'} won${result.best_ ? ', the best run yet!' : '.'}` : 'Next time, wait for the ring!'}`}</p>
        <ul className="is-stats">
          <li><b>{result.rounds}</b><span>rounds won</span></li><li><b>{result.goals}–{result.against}</b><span>goals</span></li><li><b>{result.perfects}</b><span>perfect arrivals</span></li><li><b>{result.best}</b><span>in a row</span></li>
        </ul>
        <div className="is-row"><button className="is-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="is-page">
      <header className="is-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="is-cols">
        <div className="is-card"><h3>Pass into space</h3><ul>
          <li>Every pass goes to a <b>spot on the grass</b>, not to a player. {touch ? <>Drag out from <b>PASS</b> the way you want it to go: further for a longer pass, a long drag lofts it. A tap plays it a little way ahead.</> : <>Hold <b>J</b> and the target walks out ahead of you; let go to pass. Or point with the <b>mouse</b> and click. <b>Shift</b> or <b>right-click</b> lofts it over the Grumbles.</>}</li>
          <li>The moment it leaves the boot, you <b>take over the runner</b>: the teammate who can get there soonest. {touch ? 'SWITCH' : <><b>Q</b></>} picks another.</li>
          <li>A gold ring on the spot shrinks as the ball comes. <b>Arrive as it closes</b>.</li>
        </ul></div>
        <div className="is-card"><h3>Arriving</h3><ul>
          <li><b>Perfect</b>: time slows down and the next pass or shot is <b>first time</b>: faster, and shots are far more accurate.</li>
          <li><b>Early</b>: you have to stop the ball and settle it, while the Grumbles close in.</li>
          <li><b>Late</b>: the ball runs on without you. Loose ball!</li>
          <li>{touch ? <>Hold <b>SHOOT</b> for power.</> : <>Hold <b>K</b> for power, and aim with the mouse or up and down.</>} On defence it’s a tackle. {touch ? 'SPRINT' : <><b>Space</b></>} sprints for a moment.</li>
        </ul></div>
        <div className="is-card"><h3>The cup</h3><ul>
          <li>Seven rounds of four-a-side, two minutes each. Lose once and you’re out. Level at full time? <b>Golden goal</b>: next goal wins, and if nobody scores, it goes your way only if you made more perfect arrivals than they made interceptions.</li>
          <li>Every round is a different pitch: <b>summer grass</b>, <b>rain</b> (the ball skids), <b>the beach</b> (it stops dead) or a <b>heatwave</b> (it bounces).</li>
          <li>Grumble teams play a <b>high line</b>, a <b>low block</b> or <b>man-to-man</b>.</li>
          <li>After each win, Enzo has three ideas in the changing room. Pick one.</li>
        </ul></div>
        <div className="is-card is-squad"><h3>The squad</h3>
          {(['dora', 'enzo', 'pip', 'bram'] as const).map((w) => <div key={w} className="is-who"><img src={kit(`${w}-big`)} alt="" /><p><b>{G.NAMES[w]}</b>{w === 'dora' ? 'Kicks off and runs the middle.' : w === 'enzo' ? 'Quick feet, always in space.' : w === 'pip' ? 'The fastest of them all.' : 'Big and slow, wins the ball back.'}</p></div>)}
          <div className="is-who"><img src={kit('grumble-big')} alt="" /><p><b>The Grumbles</b>Faster and sharper every round.</p></div>
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="is-page">
      <header className="is-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="is-card is-settings">
        <div className="is-set"><span>Sound</span><span className="is-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="is-set"><span>Music</span><span className="is-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <p className="is-small">{s.stats.runs} cup runs · {s.stats.cups} won · {s.stats.goals} goals · {s.stats.perfects} perfect arrivals</p>
        <button className="is-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
