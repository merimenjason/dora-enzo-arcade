'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/pass-game';
import type { Duel, PassId, Race, RaceEvent, RivalId, Save, StoryStep } from '@/lib/pass-game';
import { carView, type CarLook, type CarView, type FrameView, type PassScene } from '@/lib/pass-scene';
import { PassSound, type SongId } from './sound';
import './pass.css';

type Screen = 'menu' | 'story' | 'scene' | 'picker' | 'duelpick' | 'garage' | 'settings' | 'intro' | 'race' | 'result' | 'ending';
type Mode = 'delivery' | 'attack' | 'duel' | 'relay';
type Run = { mode: Mode; pass: PassId; rival: RivalId | null; story: number | null; duel: Duel | null; race: Race; ghost: number[] | null };
type RoundCard = { title: string; line: string; win: boolean | null; score: [number, number]; next: string; last: boolean };
type Result = {
  mode: Mode; pass: PassId; rival: RivalId | null; win: boolean; time: number; buns: number; medal: number; coins: number; best: boolean;
  levelFrom: number; levelTo: number; rounds: { role: string; text: string; win: boolean | null }[]; story: number | null; drift: number; hits: number;
};
type Line = [string, string];

const ART = (n: string) => `/art/pass/${n}.webp`;
const RIVAL_IDS = G.RIVALS.map((r) => r.id);
const SCENE_ART: Record<G.SceneId, string> = { bakery: 'story-bakery', carpark: 'story-carpark', fog: 'story-fog', relay: 'story-relay', ending: 'ending' };
const WHO: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', narrator: '', ...Object.fromEntries(G.RIVALS.map((r) => [r.id, r.name])) };
const PORTRAIT: Record<string, string> = { dora: 'dora-grin', enzo: 'enzo-notes', ...Object.fromEntries(G.RIVALS.map((r) => [r.id, `${r.id}-portrait`])) };
const ASSISTS = [{ v: 0, name: 'Off' }, { v: 0.35, name: 'Low' }, { v: 0.6, name: 'Medium' }, { v: 0.85, name: 'High' }];
const LEVEL_WORD = ['Scribbles', 'Rough notes', 'Numbered notes', 'Full notes'];
const LEVEL_HINT = ['Late and vague calls.', 'Directions and how tight.', 'Earlier calls with severity numbers and "into".', 'Earliest calls, plus gutters, crests and passing places.'];
const fmt = (t: number) => { if (!(t > 0)) return '–'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'];
const CAR_LOOK = (id: RivalId): CarLook => { const r = G.rival(id); return { shape: r.shape, body: r.body, trim: r.trim }; };
const BISCUIT: CarLook = { shape: 'hatch', body: 0xf3e7c9, trim: 0x6fb3dc, biscuit: true };

/** A painting with a drawn stand-in behind it, so a missing file never leaves a hole. */
// a missing painting borrows the nearest one that exists
const FALLBACK: Record<string, string[]> = {
  title: ['story-carpark', 'story-bakery', 'dora-grin'], 'story-bakery': ['story-carpark', 'enzo-notes'], 'story-carpark': ['story-bakery', 'stoat-portrait'],
  'story-fog': ['enzo-scared', 'pika-portrait'], 'story-relay': ['fox-portrait', 'ending'], ending: ['story-relay', 'enzo-cheer'],
};
function Paint({ name, className, alt, pos }: { name: string; className?: string; alt?: string; pos?: string }) {
  const chain = [name, ...(FALLBACK[name] ?? [])];
  const [k, setK] = useState(0);
  useEffect(() => setK(0), [name]);
  return <span className={`kp-paint ${className ?? ''}`} data-art={name}>
    {k < chain.length && <img src={ART(chain[k])} alt={alt ?? ''} draggable={false} style={pos ? { objectPosition: pos } : undefined} onError={() => setK((x) => x + 1)} />}
  </span>;
}

function TrackMap({ pass, reversed = false }: { pass: PassId; reversed?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext('2d'); if (!g) return;
    const t = G.getTrack(pass, reversed);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < t.n; i += 4) { x0 = Math.min(x0, t.x[i]); x1 = Math.max(x1, t.x[i]); y0 = Math.min(y0, t.y[i]); y1 = Math.max(y1, t.y[i]); }
    const W = c.width, H = c.height, k = Math.min((W - 24) / (x1 - x0 || 1), (H - 24) / (y1 - y0 || 1));
    const px = (i: number) => 12 + (t.x[i] - x0) * k + ((W - 24) - (x1 - x0) * k) / 2, py = (i: number) => H - 12 - (t.y[i] - y0) * k - ((H - 24) - (y1 - y0) * k) / 2;
    g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, col] of [[9, '#14101f'], [5, '#f6e9cf']] as const) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i < t.n; i += 3) (i ? g.lineTo(px(i), py(i)) : g.moveTo(px(i), py(i))); g.stroke(); }
    g.strokeStyle = '#ff5d73'; g.lineWidth = 5; for (let i = 1; i < t.n; i += 3) if (t.gutter[i]) { g.beginPath(); g.moveTo(px(i - 1), py(i - 1)); g.lineTo(px(i), py(i)); g.stroke(); }
    g.strokeStyle = '#6fd3ff'; for (let i = 1; i < t.n; i += 3) if (t.wide[i]) { g.beginPath(); g.moveTo(px(i - 1), py(i - 1)); g.lineTo(px(i), py(i)); g.stroke(); }
    g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(px(0), py(0), 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#14101f'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px(t.n - 1), py(t.n - 1), 6, 0, Math.PI * 2); g.fill(); g.stroke();
  }, [pass, reversed]);
  return <canvas ref={ref} className="kp-map" width={220} height={150} aria-hidden />;
}

function Pips({ level }: { level: number }) {
  return <span className="kp-pips" aria-label={`Notebook level ${level} of 3`}>{[0, 1, 2].map((i) => <i key={i} className={i < level ? 'on' : ''} />)}</span>;
}

export default function KumoriPass() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [save, setSave] = useState<Save>(() => G.newSave());
  const [pickMode, setPickMode] = useState<'delivery' | 'attack'>('delivery');
  const [pickRival, setPickRival] = useState<RivalId>('stoat');
  const [sceneStep, setSceneStep] = useState<{ art: string; lines: Line[]; i: number; then: () => void } | null>(null);
  const [intro, setIntro] = useState<{ rival: RivalId; relay: boolean; story: number | null; lines: Line[] } | null>(null);
  const [round, setRound] = useState<RoundCard | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);
  const [cutin, setCutin] = useState<{ by: number; rival: RivalId; driver: string } | null>(null);
  const [touch, setTouch] = useState(false);
  const [showcaseIdx, setShowcaseIdx] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linesRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<PassScene | null>(null);
  const soundRef = useRef<PassSound | null>(null);
  const runRef = useRef<Run | null>(null);
  const saveRef = useRef(save); saveRef.current = save;
  const screenRef = useRef(screen); screenRef.current = screen;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const keys = useRef(new Set<string>());
  const touchKeys = useRef(new Set<string>());
  const steer = useRef(0);
  const input = useRef(G.idleInput());
  const cam = useRef(0);
  const slow = useRef({ until: 0, scale: 1 });
  const shake = useRef(0);
  const views = useRef<CarView[]>([carView(), carView()]);
  const ghostView = useRef<CarView>(carView());
  const soloViews = useRef<CarView[]>([views.current[0]]);
  const frame = useRef<FrameView>({ cars: [], ghost: null, cam: 0, dt: 0, dawn: 0, slowmo: 1, shake: 0, focus: 0 });
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const noteTimer = useRef(0); const msgTimer = useRef(0);
  const lastCount = useRef(99);
  const drivers = useRef<{ driver: 'dora' | 'enzo'; caller: 'dora' | 'enzo' }>({ driver: 'dora', caller: 'enzo' });

  const persist = useCallback((s: Save) => { setSave(s); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch { /* storage full or blocked */ } }, []);
  const sfx = () => soundRef.current;
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };

  // ---------------------------------------------------------------- mount: save, scene, sound
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch { /* blocked storage */ }
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let fresh = true; try { fresh = !localStorage.getItem(G.SAVE_KEY); } catch { /* ignore */ }
    if (coarse && fresh) s.settings.assist = 0.85;
    setTouch(coarse || 'ontouchstart' in window);
    setSave(s);
    soundRef.current = new PassSound(s.settings.sound, s.settings.music);
    let disposed = false;
    void import('@/lib/pass-scene').then((m) => {
      if (disposed || !canvasRef.current) return;
      try { const sc = new m.PassScene(canvasRef.current); sc.setLite(s.settings.lite); sceneRef.current = sc; } catch { /* no WebGL: menus still work */ }
      setReady(true);
    });
    const onResize = () => { sceneRef.current?.resize(); };
    addEventListener('resize', onResize);
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'race') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { disposed = true; removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', vis); sceneRef.current?.dispose(); soundRef.current?.dispose(); };
  }, []);

  // music per screen
  useEffect(() => {
    const s = sfx(); if (!s) return;
    const run = runRef.current;
    const song: SongId = screen === 'race' ? (run?.pass === 'fog' ? 'fog' : run?.mode === 'relay' ? 'dawn' : run?.mode === 'duel' ? 'duel' : 'drive')
      : screen === 'garage' ? 'garage' : screen === 'ending' ? 'ending' : screen === 'scene' && sceneStep?.art === 'story-relay' ? 'dawn' : 'menu';
    s.music(song);
    if (screen !== 'race') { s.quietEngine(); }
  }, [screen, sceneStep]);

  // the garage turntable
  useEffect(() => {
    const sc = sceneRef.current; if (!sc) return;
    if (screen === 'garage') sc.setShowcase(true, showcaseIdx === 1 ? [BISCUIT, CAR_LOOK('stoat'), CAR_LOOK('fox')] : [BISCUIT]);
    else if (sc.showcase) sc.setShowcase(false);
  }, [screen, ready, showcaseIdx]);

  // ---------------------------------------------------------------- starting runs
  const lookFor = (mode: Mode, rival: RivalId | null): CarLook[] => (rival ? [BISCUIT, CAR_LOOK(rival)] : [BISCUIT]);

  const beginRace = useCallback((run: Run) => {
    runRef.current = run;
    const sc = sceneRef.current;
    if (sc) {
      sc.setShowcase(false);
      sc.setTrack(run.race.track);
      sc.setCars(lookFor(run.mode, run.rival), run.ghost ? { ...BISCUIT, ghost: true } : null);
    }
    const relayUp = run.mode === 'relay' && run.race.track.reversed;
    drivers.current = relayUp ? { driver: 'enzo', caller: 'dora' } : { driver: 'dora', caller: 'enzo' };
    steer.current = 0; keys.current.clear(); touchKeys.current.clear(); lastCount.current = 99; slow.current = { until: 0, scale: 1 };
    setCutin(null); setRound(null); setPaused(false);
    sfx()?.startEngine();
    setScreen('race');
  }, []);

  const raceOpts = useCallback((pass: PassId, extra: Partial<G.RaceOpts>): G.RaceOpts => {
    const s = saveRef.current;
    return { pass, upgrades: s.upgrades, assist: s.settings.assist, manual: s.settings.manual, noteLevel: G.noteLevel(s.runs[pass]), seed: 1 + s.runs[pass] * 13 + s.coins, ...extra };
  }, []);

  const startSolo = useCallback((mode: 'delivery' | 'attack', pass: PassId, story: number | null) => {
    const s = saveRef.current;
    let ghost: number[] | null = null, ghostCar: G.RaceOpts['ghostCar'] = null;
    if (mode === 'attack' && s.ghosts[pass]) { ghost = G.unpackGhost(s.ghosts[pass]!); ghostCar = s.ghostMeta[pass] ?? null; }
    const race = new G.Race(raceOpts(pass, { buns: mode === 'delivery', ghost, ghostCar }));
    beginRace({ mode, pass, rival: null, story, duel: null, race, ghost });
  }, [beginRace, raceOpts]);

  const startDuel = useCallback((rival: RivalId, relay: boolean, story: number | null) => {
    const s = saveRef.current, r = G.rival(rival), pass = relay ? 'summit' : r.pass;
    const duel = new G.Duel({ rival, relay, upgrades: s.upgrades, assist: s.settings.assist, manual: s.settings.manual, noteLevel: G.noteLevel(s.runs[pass]), seed: 7 + s.runs[pass] * 31 + s.beaten.length * 5 + (s.coins % 97) });
    beginRace({ mode: relay ? 'relay' : 'duel', pass, rival, story, duel, race: duel.race, ghost: null });
  }, [beginRace]);

  // story steps
  const playStory = useCallback((i: number) => {
    const st: StoryStep | undefined = G.STORY[i];
    if (!st) { setScreen('story'); return; }
    sfx()?.unlock();
    if (st.kind === 'scene') {
      setSceneStep({ art: SCENE_ART[st.scene], lines: st.lines, i: 0, then: () => {
        const s = { ...saveRef.current, story: Math.max(saveRef.current.story, i + 1) };
        if (st.scene === 'ending') { s.ended = true; persist(s); setScreen('ending'); return; }
        persist(s); playStory(i + 1);
      } });
      setScreen('scene');
    } else if (st.kind === 'delivery') {
      setSceneStep({ art: st.pass === 'fog' ? 'story-fog' : st.pass === 'tunnel' ? 'enzo-scared' : 'enzo-notes', lines: st.lines, i: 0, then: () => startSolo('delivery', st.pass, i) });
      setScreen('scene');
    } else {
      setIntro({ rival: st.rival, relay: st.kind === 'relay', story: i, lines: st.lines });
      setScreen('intro');
    }
  }, [persist, startSolo]);

  // ---------------------------------------------------------------- finishing
  const finishRun = useCallback(() => {
    const run = runRef.current; if (!run) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const levelFrom = G.noteLevel(s.runs[run.pass]);
    G.recordRun(s, run.pass);
    const levelTo = G.noteLevel(s.runs[run.pass]);
    const race = run.race;
    let res: Result;
    if (run.mode === 'duel' || run.mode === 'relay') {
      const d = run.duel!; const win = d.winner === 0;
      const coins = G.duelCoins(run.rival!, win);
      s.coins += coins;
      if (win && !s.beaten.includes(run.rival!)) s.beaten.push(run.rival!);
      if (win && run.story !== null) s.story = Math.max(s.story, run.story + 1);
      res = { mode: run.mode, pass: run.pass, rival: run.rival, win, time: 0, buns: 0, medal: 0, coins, best: false, levelFrom, levelTo, story: run.story, drift: 0, hits: 0,
        rounds: d.rounds.map((r, i) => ({ role: i === 0 && run.mode === 'relay' ? 'Uphill · lead' : r.role === 'lead' ? 'Lead' : 'Chase', text: roundText(r.result, r.role), win: r.result.winner === -1 ? null : r.result.winner === 0 })) };
    } else {
      const time = race.player.finished, buns = run.mode === 'delivery' ? race.buns : 0;
      const medal = run.mode === 'delivery' ? G.deliveryMedal(run.pass, time, buns) : 0;
      const coins = run.mode === 'delivery' ? G.deliveryCoins(medal, buns) : 5;
      s.coins += coins;
      if (medal > s.medals[run.pass]) s.medals[run.pass] = medal;
      const best = !s.best[run.pass] || time < s.best[run.pass];
      if (best) {
        s.best[run.pass] = Math.round(time * 1000) / 1000;
        if (run.mode === 'attack' || !s.ghosts[run.pass]) { s.ghosts[run.pass] = G.packGhost(race.inputs); s.ghostMeta[run.pass] = { up: s.upgrades.slice(), assist: s.settings.assist, manual: s.settings.manual }; }
      }
      if (run.story !== null) s.story = Math.max(s.story, run.story + 1);
      res = { mode: run.mode, pass: run.pass, rival: null, win: true, time, buns, medal, coins, best, levelFrom, levelTo, rounds: [], story: run.story, drift: Math.round(race.driftScore), hits: race.hits };
    }
    persist(s);
    sfx()?.quietEngine(); sfx()?.stinger(res.win);
    setResult(res); setRound(null); setScreen('result');
  }, [persist]);

  const nextRound = useCallback(() => {
    const run = runRef.current; if (!run || !run.duel) return;
    setRound(null);
    if (run.duel.over) { finishRun(); return; }
    run.duel.startRound(); run.race = run.duel.race;
    beginRace(run);
  }, [beginRace, finishRun]);

  // ---------------------------------------------------------------- the loop
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const sc = sceneRef.current, snd = soundRef.current;
      snd?.pump();
      if (screenRef.current === 'garage') { sc?.render(frame.current); return; }
      const run = runRef.current;
      if (screenRef.current !== 'race' || !run || !sc) return;
      const race = run.race;
      // input
      readInput(dt);
      // slow motion for the overtake cut-in
      const sm = now < slow.current.until ? slow.current.scale : 1;
      if (!pausedRef.current && !round) {
        acc += dt * sm;
        let n = 0;
        while (acc >= G.DT && n < 24) {
          race.tick(input.current); acc -= G.DT; n++;
          if (race.events.length) handleEvents(run, race.events);
          if (race.done) { acc = 0; break; }
        }
      } else acc = 0;
      // the view
      const p = race.player, cars = race.racers;
      for (let i = 0; i < cars.length; i++) fillView(views.current[i], cars[i], race, i === 0 ? input.current.brake > 0 : cars[i].car.lastIn.brake > 0);
      const f = frame.current;
      f.cars = cars.length > 1 ? views.current : soloViews.current;
      if (race.ghost && run.ghost) { fillView(ghostView.current, race.ghost, race, false); f.ghost = ghostView.current; } else f.ghost = null;
      f.cam = cam.current; f.dt = dt; f.slowmo = sm; shake.current = Math.max(0, shake.current - dt * 3); f.shake = shake.current;
      f.dawn = run.mode === 'relay' ? Math.min(1, 0.3 + (run.duel?.round ?? 0) * 0.35 + (race.player.s / race.track.len) * 0.3) : run.pass === 'summit' && run.mode !== 'duel' ? 0.15 : 0;
      f.focus = 0;
      sc.render(f);
      drawSpeedLines(Math.hypot(p.car.u, p.car.v), p.car.boost > 0, sm < 1);
      updateHud(run, race, dt);
      const slide = Math.min(1, Math.abs(G.slipAngleOf(p.car)) * 2.2 + p.car.wheelSpin * 0.5 - 0.15);
      snd?.engine(p.car.rpm, race.t < 0 ? input.current.throttle : p.car.lastIn.throttle, race.t < 0 ? 0 : slide, saveRef.current.upgrades.includes('intake'), sm);
      if (race.done && !round && !pausedRef.current) onRaceDone(run);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function fillView(v: CarView, r: Race['racers'][number], race: Race, brake: boolean) {
    const c = r.car, t = race.track;
    v.x = c.x; v.y = c.y; v.z = t.z[r.idx]; v.h = c.h; v.u = c.u; v.v = c.v; v.delta = c.delta; v.ax = c.ax; v.ay = c.ay; v.wheelRot = c.wheelRot;
    v.spin = r.hold > 0 ? 0 : c.wheelSpin; v.brake = brake; v.boost = c.boost > 0 ? 1 : 0; v.lights = race.t > -2.2 ? 1 : 0; v.pitch = Math.atan(t.grade[r.idx] * Math.cos(c.h - t.h[r.idx])); v.visible = true;
  }

  function readInput(dt: number) {
    const k = keys.current, tk = touchKeys.current, inp = input.current;
    let left = k.has('ArrowLeft') || k.has('KeyA') || tk.has('left');
    let right = k.has('ArrowRight') || k.has('KeyD') || tk.has('right');
    let thr = k.has('ArrowUp') || k.has('KeyW') || tk.has('gas') ? 1 : 0;
    let brk = k.has('ArrowDown') || k.has('KeyS') || tk.has('brake') ? 1 : 0;
    let hand = k.has('Space') || tk.has('hand');
    let up = k.has('ShiftLeft') || k.has('ShiftRight') || tk.has('up'), down = k.has('ControlLeft') || k.has('ControlRight') || tk.has('down');
    let analog: number | null = null;
    // a gamepad, if one is connected
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] ?? 0; if (Math.abs(ax) > 0.12) analog = ax * -1;
      if ((gp.buttons[7]?.value ?? 0) > 0.1) thr = Math.max(thr, gp.buttons[7].value);
      if ((gp.buttons[6]?.value ?? 0) > 0.1) brk = Math.max(brk, gp.buttons[6].value);
      if (gp.buttons[0]?.pressed || gp.buttons[1]?.pressed) hand = true;
      if (gp.buttons[5]?.pressed) up = true; if (gp.buttons[4]?.pressed) down = true;
      if (gp.buttons[14]?.pressed) left = true; if (gp.buttons[15]?.pressed) right = true;
      break;
    }
    const target = analog !== null ? analog : (left ? 1 : 0) - (right ? 1 : 0);
    // digital steering eases in and snaps back, so taps make small corrections
    const s = steer.current;
    const rate = target === 0 ? 7 : Math.sign(target) !== Math.sign(s) && s !== 0 ? 9 : 4.2;
    steer.current = analog !== null ? target : s + Math.max(-rate * dt, Math.min(rate * dt, target - s));
    inp.steer = steer.current; inp.throttle = thr; inp.brake = brk; inp.hand = hand; inp.up = up; inp.down = down;
  }

  function say(text: string, who: 'dora' | 'enzo', urgent = false) {
    const b = hud.current.note, tx = hud.current.noteText, pic = hud.current.notePic as HTMLImageElement | null;
    if (!b || !tx) return;
    tx.textContent = text; b.dataset.on = '1'; b.dataset.who = who; b.dataset.urgent = urgent ? '1' : '0';
    if (pic) { const want = ART(who === 'enzo' ? 'enzo-call' : 'dora-focus'); if (!pic.src.endsWith(want)) pic.src = want; }
    noteTimer.current = 2.6; sfx()?.voice(who, text);
  }
  function flash(text: string, tone = '') {
    const m = hud.current.msg; if (!m) return;
    m.textContent = text; m.dataset.on = '1'; m.dataset.tone = tone; msgTimer.current = 1.3;
  }

  function handleEvents(run: Run, evs: RaceEvent[]) {
    const snd = sfx(), sc = sceneRef.current;
    for (const e of evs) {
      switch (e.k) {
        case 'note': say(e.note.text.join(' · '), drivers.current.caller, e.note.sev <= 1); break;
        case 'wall': if (e.car === 0) { snd?.wall(e.mag); shake.current = Math.min(0.6, 0.1 + e.mag * 0.04); if (e.mag > 7) flash('CRUNCH!', 'bad'); } sc?.spark(e.x, e.y, run.race.track.z[run.race.racers[e.car]?.idx ?? 0], e.mag); break;
        case 'scrape': if (e.car === 0) snd?.scrape(); sc?.spark(e.x, e.y, run.race.track.z[run.race.racers[e.car]?.idx ?? 0], 0.5); break;
        case 'bump': snd?.bump(e.mag); shake.current = 0.3; break;
        case 'shift': if (e.car === 0) snd?.shift(); break;
        case 'hook': if (e.car === 0) { snd?.hook(); flash('GUTTER HOOK!', 'good'); } break;
        case 'hookSpin': if (e.car === 0) { snd?.wall(5); flash('Caught the drain!', 'bad'); say('Too fast for the gutter!', drivers.current.caller, true); } break;
        case 'driftStart': snd?.driftStart(); break;
        case 'driftEnd': if (e.boost) { snd?.boost(); flash(e.meter > 0.8 ? 'BIG DRIFT · BOOST!' : 'DRIFT BOOST!', 'good'); } break;
        case 'driftBroken': flash('Drift broken', 'bad'); break;
        case 'bun': snd?.bun(); flash(e.left > 0 ? `A bun fell! ${e.left} left` : 'No buns left…', 'bad'); if (e.left % 4 === 0 && e.left > 0) say('The buns! Gently!', 'enzo', true); break;
        case 'overtake': {
          if (run.race.racers.length > 1) {
            snd?.whoosh();
            slow.current = { until: performance.now() + 1500, scale: 0.28 };
            setCutin({ by: e.by, rival: run.rival!, driver: drivers.current.driver });
            setTimeout(() => setCutin(null), 1500);
          }
          break;
        }
        case 'reset': if (e.car === 0) { flash('Spun out!', 'bad'); sc?.puff(run.race.player.car.x, run.race.player.car.y, run.race.track.z[run.race.player.idx], 12); } break;
        case 'go': snd?.count(true); flash('GO!', 'go'); break;
        case 'finish': if (e.car === 0) { flash(run.mode === 'delivery' ? 'Delivered!' : 'Finish!', 'good'); } break;
        default: break;
      }
    }
  }

  function onRaceDone(run: Run) {
    const race = run.race;
    if (run.mode === 'delivery' || run.mode === 'attack') { if (!runRef.current || runRef.current.race !== race || (race as unknown as { _shown?: boolean })._shown) return; (race as unknown as { _shown?: boolean })._shown = true; setTimeout(finishRun, 900); return; }
    const d = run.duel!; if ((race as unknown as { _shown?: boolean })._shown) return; (race as unknown as { _shown?: boolean })._shown = true;
    const over = d.finishRound();
    const r = race.result!;
    const role = d.rounds[d.rounds.length - 1].role;
    const name = G.rival(run.rival!).name;
    const win = r.winner === -1 ? null : r.winner === 0;
    const [a, b] = d.score();
    const title = win === null ? 'Held!' : win ? 'Round won!' : 'Round lost';
    const line = roundText(r, role, name);
    const next = over ? (d.winner === 0 ? 'You win the duel!' : `${name} wins the duel.`) : d.rounds.length >= 2 ? `Sudden death: round ${d.rounds.length + 1}, you ${d.roleFor(d.rounds.length) === 'lead' ? 'lead' : 'chase'}.` : `Round 2: you chase ${name}.`;
    setTimeout(() => { sfx()?.stinger(!!win); setRound({ title, line, win, score: [a, b], next, last: over }); }, 700);
  }

  function roundText(r: G.RoundResult, role: 'lead' | 'chase', name = 'the rival') {
    const g = Math.abs(r.gap).toFixed(2);
    switch (r.reason) {
      case 'pulled-away': return r.winner === 0 ? `You pulled away: ${g} s clear at the line.` : `${name} pulled away by ${g} s.`;
      case 'passed': return r.winner === 0 ? 'You got past and finished in front!' : `${name} got past you.`;
      case 'held': return role === 'lead' ? `${name} stayed on your bumper (${g} s). Even.` : `You stayed with ${name} (${g} s). Even.`;
      case 'crash': return r.winner === 0 ? `${name} spun out!` : r.winner === 1 ? 'You spun out.' : 'Both cars spun!';
      case 'dropped': return r.winner === 0 ? `${name} dropped right back.` : `You dropped too far back.`;
      default: return '';
    }
  }

  // speed lines on a 2D overlay, anime style, at the edges only
  function drawSpeedLines(speed: number, boost: boolean, cut: boolean) {
    const c = linesRef.current; if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, w, h);
    const k = Math.max(0, Math.min(1, (speed - 22) / 18)) + (boost ? 0.5 : 0) + (cut ? 0.6 : 0);
    if (k <= 0.02 || saveRef.current.settings.lite) return;
    const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) / 2, t = performance.now() / 1000;
    g.strokeStyle = cut ? 'rgba(255,255,255,0.55)' : 'rgba(235,240,255,0.32)';
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.sin(i * 12.3 + Math.floor(t * 18)) * 0.05;
      const r0 = R * (0.62 + ((i * 37 + Math.floor(t * 24)) % 7) * 0.035), len = R * (0.1 + k * 0.25);
      g.lineWidth = 1 + ((i * 13) % 3) * k;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
    }
  }

  function updateHud(run: Run, race: Race, dt: number) {
    const h = hud.current, p = race.player, c = p.car;
    const sp = Math.round(Math.hypot(c.u, c.v) * 3.6);
    if (h.speed) h.speed.textContent = String(sp);
    if (h.gear) h.gear.textContent = c.u < -0.5 ? 'R' : String(c.gear);
    if (h.rpm) h.rpm.style.setProperty('--v', String(Math.min(1, c.rpm / c.spec.redline)));
    if (h.time) h.time.textContent = fmt(Math.max(0, race.t));
    if (h.drift) { h.drift.style.setProperty('--v', String(race.drift)); h.drift.dataset.on = race.drifting ? '1' : '0'; h.drift.dataset.boost = c.boost > 0 ? '1' : '0'; }
    if (h.buns && run.mode === 'delivery') { h.buns.style.setProperty('--n', String(race.buns)); h.buns.dataset.left = String(race.buns); if (h.wobble) h.wobble.style.setProperty('--v', String(Math.min(1, race.wobble))); }
    if (run.duel && h.gap) {
      const gp = race.gapOf(0);
      h.gap.style.setProperty('--g', String(Math.max(-2, Math.min(2, -gp))));
      if (h.gapText) h.gapText.textContent = gp > 0.05 ? `${gp.toFixed(2)} s behind` : gp < -0.05 ? `${(-gp).toFixed(2)} s ahead` : 'side by side';
    }
    if (run.ghost && race.ghost && h.delta) {
      const gs = race.ghost.s, ps = p.s; const dlt = (gs - ps) / Math.max(8, Math.hypot(c.u, c.v));
      h.delta.textContent = race.t > 0 ? `${dlt > 0 ? '+' : '−'}${Math.abs(dlt).toFixed(2)}` : ''; h.delta.dataset.tone = dlt > 0 ? 'bad' : 'good';
    }
    if (h.progress) h.progress.style.setProperty('--v', String(Math.min(1, p.s / race.finishS)));
    // countdown
    if (race.t < 0) {
      const n = Math.ceil(-race.t);
      if (n !== lastCount.current && n <= 3) { lastCount.current = n; sfx()?.count(false); flash(String(n), 'count'); }
    }
    noteTimer.current -= dt; if (noteTimer.current <= 0 && h.note) h.note.dataset.on = '0';
    msgTimer.current -= dt; if (msgTimer.current <= 0 && h.msg) h.msg.dataset.on = '0';
  }

  // ---------------------------------------------------------------- keyboard and pointer
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      const scr = screenRef.current;
      if (scr === 'race') {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
        if (e.code === 'Escape' || e.code === 'KeyP') { setPaused((p) => !p); return; }
        if (e.code === 'KeyC') { cam.current = (cam.current + 1) % 3; return; }
        if (e.code === 'Enter' && round) { nextRound(); return; }
        keys.current.add(e.code);
      } else if (scr === 'scene' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); advanceScene(); }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    const blur = () => keys.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  });

  const advanceScene = () => {
    setSceneStep((st) => {
      if (!st) return st;
      if (st.i + 1 < st.lines.length) { const nx = { ...st, i: st.i + 1 }; const [who, text] = st.lines[nx.i]; sfx()?.voice(who, text); return nx; }
      setTimeout(st.then, 0); return st;
    });
  };
  useEffect(() => { if (screen === 'scene' && sceneStep && sceneStep.i === 0) { const [who, text] = sceneStep.lines[0]; sfx()?.voice(who, text); } }, [screen, sceneStep]);

  const pad = (name: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); sfx()?.unlock(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); touchKeys.current.add(name); },
    onPointerUp: () => touchKeys.current.delete(name), onPointerCancel: () => touchKeys.current.delete(name), onLostPointerCapture: () => touchKeys.current.delete(name),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // ---------------------------------------------------------------- the hook for tests
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__pass = () => {
      const run = runRef.current, r = run?.race;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, touch,
        race: r ? { t: r.t, s: r.player.s, speed: Math.hypot(r.player.car.u, r.player.car.v), gear: r.player.car.gear, steer: r.player.car.delta, drift: r.drift, drifting: r.drifting, buns: r.buns,
          done: r.done, finished: r.player.finished, resets: r.player.resets, len: r.finishS, gap: r.racers.length > 1 ? r.gapOf(0) : 0, note: r.lastNote?.text.join(' ') ?? null, hits: r.hits, driftScore: r.driftScore,
          beta: G.slipAngleOf(r.player.car), mode: run!.mode, pass: run!.pass, round: run!.duel?.round ?? 0, rival: run!.rival, x: r.player.car.x, y: r.player.car.y } : null,
        round: round, result, cutin: !!cutin,
        debug: {
          /** jump the current race to just before the finish (tests) */
          nearFinish: () => { const rr = runRef.current?.race; if (!rr) return; for (const rc of rr.racers) { const i = Math.max(0, Math.floor(rr.finishS - 25 - (rc === rr.player ? 0 : 6))); rc.car.x = rr.track.x[i]; rc.car.y = rr.track.y[i]; rc.car.h = rr.track.h[i]; rc.idx = i; rc.w.i = i; rc.s = i; rc.car.u = 20; rc.car.v = 0; rc.car.r = 0; for (let k = 0; k * 4 < i; k++) if (rc.marks[k] < 0) rc.marks[k] = Math.max(0, rr.t); } },
          cutin: (by = 0) => { const run2 = runRef.current; setCutin({ by, rival: run2?.rival ?? 'stoat', driver: drivers.current.driver }); slow.current = { until: performance.now() + 1500, scale: 0.28 }; },
          clearCutin: () => setCutin(null),
          coins: (n: number) => persist({ ...saveRef.current, coins: n }),
          story: (n: number) => persist({ ...saveRef.current, story: n }),
          showcase: (i: number) => setShowcaseIdx(i),
          say: (t: string) => say(t, 'enzo'),
          /** let the competent bot drive the player's car (screenshots) */
          auto: (pace: number) => { const rr = runRef.current?.race; if (rr) rr.opts.autopilot = pace; },
          /** turn the car sideways by b radians, keeping its course (screenshots of a drift) */
          slide: (b: number) => { const c = runRef.current?.race.player.car; if (!c) return; const u = c.u, v = c.v, cb = Math.cos(b), sb = Math.sin(b); c.h += b; c.u = u * cb + v * sb; c.v = -u * sb + v * cb; c.r = b * 1.2; },
        },
      };
    };
    return () => { delete w.__pass; };
  });

  // ---------------------------------------------------------------- settings helpers
  const setSetting = <K extends keyof Save['settings']>(k: K, v: Save['settings'][K]) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } };
    persist(s);
    if (k === 'sound') sfx()?.setSound(v as boolean);
    if (k === 'music') sfx()?.setMusic(v as boolean);
    if (k === 'lite') sceneRef.current?.setLite(v as boolean);
  };
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  const quitRace = () => { sfx()?.quietEngine(); sfx()?.stopEngine(); setPaused(false); setRound(null); setCutin(null); runRef.current = null; setScreen('menu'); };
  const retry = () => {
    const run = runRef.current; if (!run) { setScreen('menu'); return; }
    setPaused(false);
    if (run.mode === 'delivery' || run.mode === 'attack') startSolo(run.mode, run.pass, run.story);
    else startDuel(run.rival!, run.mode === 'relay', run.story);
  };

  // ---------------------------------------------------------------- render
  const s = save;
  const run = runRef.current;
  const nextStory = G.STORY[s.story];
  const storyLabel = (st: StoryStep) => st.kind === 'scene' ? ({ bakery: 'The bakery at 4 am', carpark: 'A challenge at the summit', fog: 'Into the fog', relay: 'First light', ending: 'Sunrise at the inn' } as const)[st.scene]
    : st.kind === 'delivery' ? `Delivery · ${G.passDef(st.pass).name}` : st.kind === 'relay' ? 'The dawn relay vs Aurora' : `Duel vs ${G.rival(st.rival).name} · ${G.passDef(G.rival(st.rival).pass).name}`;
  const unlockedPasses = G.PASSES.filter((p) => G.passUnlocked(s, p.id));

  return <main className={`kp-shell kp-on-${screen}${touch ? ' kp-touch' : ''}`} data-screen={screen} data-ready={ready ? 'true' : undefined}>
    <canvas ref={canvasRef} className="kp-canvas" data-on={screen === 'race' || screen === 'garage' ? '1' : '0'} />
    <canvas ref={linesRef} className="kp-lines" data-on={screen === 'race' ? '1' : '0'} />

    {screen === 'menu' && <section className="kp-menu">
      <Paint name="title" className="kp-bg" alt="The Biscuit drifting a hairpin at night" />
      <div className="kp-menu-shade" />
      <a className="kp-home" href="/">‹ Arcade</a>
      <div className="kp-coins" title="Bakery coins">🥐 {s.coins}</div>
      <div className="kp-titleblock">
        <span className="kp-eyebrow">Hillside Bun Bakery · night deliveries</span>
        <h1>Kumori Pass</h1>
        <p className="kp-lede">Dora drives, Enzo reads the corners. Deliver warm buns up the mountain before dawn, and beat every street crew that wants to pass the bun car.</p>
      </div>
      <nav className="kp-modes" aria-label="Modes">
        <button className="kp-mode kp-mode-story" onClick={() => go('story')}><b>Story</b><small>{s.ended ? 'The mountain is yours' : nextStory ? storyLabel(nextStory) : 'Seven rivals, one dawn'}</small></button>
        <button className="kp-mode" onClick={() => { setPickMode('delivery'); go('picker'); }}><b>Delivery Runs</b><small>Buns on the back seat · medals · better notes</small></button>
        <button className="kp-mode" disabled={!s.beaten.length && !s.ended} onClick={() => go('duelpick')}><b>Free Duel</b><small>{s.beaten.length ? 'Any rival you have beaten' : 'Beat a rival in the story first'}</small></button>
        <button className="kp-mode" onClick={() => { setPickMode('attack'); go('picker'); }}><b>Time Attack</b><small>Race the ghost of your best run</small></button>
        <button className="kp-mode" onClick={() => go('garage')}><b>Garage</b><small>Upgrades with Enzo</small></button>
        <button className="kp-mode" onClick={() => go('settings')}><b>Settings</b><small>Assists, gears, Lite, sound</small></button>
      </nav>
    </section>}

    {screen === 'story' && <section className="kp-page kp-story-page">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>The Story</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <ol className="kp-ladder">
        {G.STORY.map((st, i) => {
          const done = i < s.story, cur = i === s.story, locked = i > s.story;
          const art = st.kind === 'duel' || st.kind === 'relay' ? `${st.rival}-portrait` : st.kind === 'scene' ? SCENE_ART[st.scene] : st.pass === 'fog' ? 'story-fog' : 'enzo-notes';
          return <li key={i} className={`kp-step ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${locked ? 'locked' : ''} kp-step-${st.kind}`}>
            <button disabled={locked} onClick={() => playStory(i)} data-step={i}>
              <Paint name={art} className="kp-step-art" pos={st.kind === 'duel' || st.kind === 'relay' ? '50% 22%' : undefined} />
              <span className="kp-step-text"><small>{st.kind === 'scene' ? 'Story' : st.kind === 'delivery' ? 'Delivery' : st.kind === 'relay' ? 'Finale' : `Rival ${G.RIVALS.findIndex((r) => r.id === st.rival) + 1}`}</small><b>{storyLabel(st)}</b>
                {(st.kind === 'duel' || st.kind === 'relay') && <em>{G.rival(st.rival).style}</em>}
                {st.kind === 'delivery' && <em>Notebook: {LEVEL_WORD[G.noteLevel(s.runs[st.pass])]} <Pips level={G.noteLevel(s.runs[st.pass])} /></em>}</span>
              <span className="kp-step-tag">{done ? '✓' : cur ? 'Play' : '🔒'}</span>
            </button>
          </li>;
        })}
      </ol>
    </section>}

    {screen === 'scene' && sceneStep && <section className="kp-scene" onClick={advanceScene}>
      <Paint name={sceneStep.art} className="kp-bg" />
      <div className="kp-scene-shade" />
      {(() => { const [who, text] = sceneStep.lines[sceneStep.i]; return <div className={`kp-dialog ${who === 'narrator' ? 'narr' : ''}`} key={sceneStep.i}>
        {who !== 'narrator' && <Paint name={PORTRAIT[who] ?? 'enzo-notes'} className="kp-dialog-face" pos="50% 30%" />}
        <div className="kp-dialog-box">{WHO[who] && <b>{WHO[who]}</b>}<p>{text}</p><small>{sceneStep.i + 1}/{sceneStep.lines.length} · tap or Enter</small></div>
      </div>; })()}
      <button className="kp-skip" onClick={(e) => { e.stopPropagation(); sceneStep.then(); }}>Skip ›</button>
    </section>}

    {screen === 'picker' && <section className="kp-page">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>{pickMode === 'delivery' ? 'Delivery Runs' : 'Time Attack'}</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <p className="kp-pagelede">{pickMode === 'delivery' ? 'Twelve warm buns on the back seat. Medals need the time and the buns: hit the rails hard and they fly. Every finished run improves Enzo\'s notebook for that pass.' : 'No buns, no rivals: just you and the ghost of your best run on each pass.'}</p>
      <div className="kp-cards">
        {G.PASSES.map((p) => {
          const open = G.passUnlocked(s, p.id), lvl = G.noteLevel(s.runs[p.id]); const [g, sv, b] = G.medalTimes(p.id);
          return <button key={p.id} className={`kp-card kp-pass kp-pass-${p.id}`} disabled={!open} data-pass={p.id} onClick={() => { sfx()?.unlock(); startSolo(pickMode, p.id, null); }}>
            <TrackMap pass={p.id} />
            <span className="kp-card-body"><b>{p.name}</b><small>{p.blurb}</small>
              <span className="kp-notebook">Enzo&rsquo;s notebook: <Pips level={lvl} /> <i>{LEVEL_WORD[lvl]}</i></span>
              {pickMode === 'delivery' ? <span className="kp-medals">{s.medals[p.id] ? <em className={`m${s.medals[p.id]}`}>{MEDAL[s.medals[p.id]]}</em> : null} Gold {fmt(g)} · Silver {fmt(sv)} · Bronze {fmt(b)}</span>
                : <span className="kp-medals">Best {fmt(s.best[p.id])}{s.ghosts[p.id] ? ' · ghost ready' : ''}</span>}
              {(p.fog > 0.5 || p.dark) && <span className="kp-warn">{p.dark ? 'Unlit: notes matter' : 'Thick fog: notes matter'}</span>}
            </span>
            {!open && <span className="kp-lock">🔒 Reach it in the story</span>}
          </button>;
        })}
      </div>
      {unlockedPasses.length < G.PASSES.length && <p className="kp-foot">More passes open as the story goes on.</p>}
    </section>}

    {screen === 'duelpick' && <section className="kp-page">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>Free Duel</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <div className="kp-cards kp-rivals">
        {G.RIVALS.map((r) => { const open = G.rivalUnlocked(s, r.id); return <button key={r.id} className={`kp-card kp-rival ${pickRival === r.id ? 'sel' : ''}`} data-rival={r.id} disabled={!open} onClick={() => { sfx()?.button(); setPickRival(r.id); }}>
          <Paint name={`${r.id}-portrait`} className="kp-rival-art" pos="50% 25%" />
          <span className="kp-card-body"><b>{r.name}</b><small>{r.animal} · {r.car}, {r.carBlurb}</small><small>{r.id === 'fox' ? 'The dawn relay on Summit Dawn' : G.passDef(r.pass).name}</small></span>
          {!open && <span className="kp-lock">🔒</span>}
        </button>; })}
      </div>
      <div className="kp-row"><button className="kp-go" disabled={!G.rivalUnlocked(s, pickRival)} onClick={() => { setIntro({ rival: pickRival, relay: pickRival === 'fox', story: null, lines: [] }); go('intro'); }}>Challenge {G.rival(pickRival).name} ›</button></div>
    </section>}

    {screen === 'garage' && <section className="kp-garage">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>Enzo&rsquo;s Garage</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <div className="kp-garage-grid">
        <div className="kp-garage-car">
          <div className="kp-enzo"><Paint name="enzo-notes" className="kp-enzo-face" pos="50% 30%" /><p>{s.upgrades.length ? `${s.upgrades.length} of ${G.UPGRADES.length} fitted. The Biscuit's never been happier.` : 'The Biscuit is all original! Bakery coins buy parts. Each one changes how she drives.'}</p></div>
          <div className="kp-stats">{(['power', 'grip', 'rotation', 'stability', 'buns'] as const).map((k) => { const v = G.statCard(s.upgrades)[k]; return <div key={k} className="kp-stat"><span>{k === 'buns' ? 'Bun safety' : k[0].toUpperCase() + k.slice(1)}</span><i style={{ ['--v' as string]: v / 10 }} /><b>{v}</b></div>; })}</div>
        </div>
        <div className="kp-parts">
          {G.UPGRADES.map((u) => { const own = s.upgrades.includes(u.id); return <div key={u.id} className={`kp-part ${own ? 'own' : ''}`} data-part={u.id}>
            <b>{u.name}</b><p>{u.effect}</p>
            <span className="kp-part-stats">{Object.entries(u.stats).map(([k, v]) => <em key={k} className={(v as number) > 0 ? 'up' : 'down'}>{(v as number) > 0 ? '+' : ''}{v} {k === 'buns' ? 'bun safety' : k}</em>)}</span>
            <button disabled={own || s.coins < u.cost} onClick={() => { const n: Save = JSON.parse(G.serialise(saveRef.current)); if (G.buyUpgrade(n, u.id)) { persist(n); sfx()?.button(); sfx()?.backfire(); } }}>{own ? 'Fitted ✓' : `Fit · 🥐 ${u.cost}`}</button>
          </div>; })}
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="kp-page kp-settings">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>Settings</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <div className="kp-setlist">
        <div className="kp-set"><b>Counter-steer assist</b><small>Turns the front wheels into a slide for you. Higher is easier to drift; Off is all you.</small>
          <div className="kp-seg">{ASSISTS.map((a) => <button key={a.name} className={Math.abs(s.settings.assist - a.v) < 0.01 ? 'on' : ''} onClick={() => setSetting('assist', a.v)}>{a.name}</button>)}</div></div>
        <div className="kp-set"><b>Gears</b><small>Manual: Shift up, Ctrl down.</small><div className="kp-seg"><button className={!s.settings.manual ? 'on' : ''} onClick={() => setSetting('manual', false)}>Automatic</button><button className={s.settings.manual ? 'on' : ''} onClick={() => setSetting('manual', true)}>Manual</button></div></div>
        <div className="kp-set"><b>Lite graphics</b><small>No shadows, outlines or particles, for slower machines.</small><div className="kp-seg"><button className={!s.settings.lite ? 'on' : ''} onClick={() => setSetting('lite', false)}>Full</button><button className={s.settings.lite ? 'on' : ''} onClick={() => setSetting('lite', true)}>Lite</button></div></div>
        <div className="kp-set"><b>Sound</b><div className="kp-seg"><button className={s.settings.sound ? 'on' : ''} onClick={() => setSetting('sound', true)}>On</button><button className={!s.settings.sound ? 'on' : ''} onClick={() => setSetting('sound', false)}>Off</button></div></div>
        <div className="kp-set"><b>Music</b><div className="kp-seg"><button className={s.settings.music ? 'on' : ''} onClick={() => setSetting('music', true)}>On</button><button className={!s.settings.music ? 'on' : ''} onClick={() => setSetting('music', false)}>Off</button></div></div>
        <div className="kp-set kp-keys"><b>Controls</b><small>Steer ← → or A D · Throttle ↑ or W · Brake ↓ or S · Handbrake Space · Camera C · Pause Esc. Touch: steer pads on the left, GAS, BRAKE and HAND on the right. A gamepad works too.</small></div>
      </div>
    </section>}

    {screen === 'intro' && intro && (() => { const r = G.rival(intro.rival); const pass = intro.relay ? 'summit' : r.pass; const lvl = G.noteLevel(s.runs[pass]); return <section className="kp-intro">
      <Paint name={intro.relay ? 'story-relay' : 'story-carpark'} className="kp-bg kp-blur" />
      <div className="kp-vs">
        <div className="kp-vs-side kp-vs-rival"><Paint name={`${r.id}-portrait`} className="kp-vs-face" pos="50% 25%" /><div className="kp-vs-name"><small>{r.animal} · {r.car}</small><b>{r.name}</b></div></div>
        <div className="kp-vs-mid"><span className="kp-vs-word">VS</span>
          <div className="kp-taunt">“{r.taunt}”</div>
          <div className="kp-rules"><b>{intro.relay ? 'The dawn relay' : `Touge duel · ${G.passDef(pass).name}`}</b>
            {intro.relay ? <ul><li><b>Leg 1, uphill:</b> Enzo drives, Dora reads the notes. You lead: don&rsquo;t be passed, or finish {G.DUEL_GAP.toFixed(1)} s clear.</li><li><b>Leg 2, downhill:</b> Dora drives. You chase: stay within {G.DUEL_GAP.toFixed(1)} s, or pass where the road opens.</li><li>Level after two: sudden death until someone wins a round outright.</li></ul>
              : <ul><li><b>Round 1, you lead:</b> don&rsquo;t get passed; finish more than {G.DUEL_GAP.toFixed(1)} s ahead to take it.</li><li><b>Round 2, you chase:</b> stay within {G.DUEL_GAP.toFixed(1)} s, or overtake where the road opens.</li><li>Level after two: sudden death until someone wins a round outright. Spin out and you lose the round.</li></ul>}
            <p className="kp-note-level">Enzo&rsquo;s notebook here: <Pips level={lvl} /> {LEVEL_WORD[lvl]}{lvl < 2 && (pass === 'fog' || pass === 'tunnel') ? ' · a delivery run or two would help!' : ''}</p>
            <p className="kp-style">{r.style}</p>
          </div>
          {intro.lines.length > 0 && <div className="kp-introline"><b>{WHO[intro.lines[0][0]]}</b> {intro.lines[0][1]}</div>}
          <div className="kp-row"><button className="kp-back" onClick={() => go(intro.story !== null ? 'story' : 'duelpick')}>‹ Back</button><button className="kp-go" onClick={() => { sfx()?.unlock(); startDuel(intro.rival, intro.relay, intro.story); }}>Race! ›</button></div>
        </div>
        <div className="kp-vs-side kp-vs-us"><Paint name={intro.relay ? 'enzo-drive' : 'dora-grin'} className="kp-vs-face" pos="50% 30%" /><div className="kp-vs-name"><small>{intro.relay ? 'Enzo & Dora' : 'Dora & Enzo'} · the Biscuit</small><b>{intro.relay ? 'The Bakery Relay' : 'The Bun Car'}</b></div></div>
      </div>
    </section>; })()}

    {screen === 'race' && run && <section className="kp-race" data-mode={run.mode}>
      <div className="kp-hud kp-hud-tl">
        <div className="kp-speedo"><b ref={H('speed')}>0</b><small>km/h</small><span className="kp-gear" ref={H('gear')}>1</span></div>
        <div className="kp-rpm" ref={H('rpm')}><i /></div>
        <div className="kp-drift" ref={H('drift')}><span>DRIFT</span><i /></div>
      </div>
      <div className="kp-note" ref={H('note')} data-on="0">
        <img ref={H('notePic') as unknown as React.Ref<HTMLImageElement>} src={ART('enzo-call')} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        <p ref={H('noteText')} />
      </div>
      <div className="kp-hud kp-hud-tr">
        <div className="kp-time"><small>{run.mode === 'delivery' ? 'Delivery' : run.mode === 'attack' ? 'Time attack' : run.mode === 'relay' ? (run.race.track.reversed ? 'Relay · uphill' : 'Relay · downhill') : `Round ${(run.duel?.round ?? 0) + 1}`}</small><b ref={H('time')}>0:00.00</b>{run.ghost && <em ref={H('delta')} />}</div>
        {run.duel && <div className="kp-gapbox"><small>{run.race.opts.role === 'lead' ? 'You lead · stay ahead' : 'You chase · stay close'}</small>
          <div className="kp-gap" ref={H('gap')}><i className="kp-gap-mark" /><span className="kp-gap-zone" /></div><b ref={H('gapText')}>side by side</b></div>}
        {run.mode === 'delivery' && <div className="kp-buns" ref={H('buns')} data-left="12"><small>Buns</small><div className="kp-bunrow">{Array.from({ length: G.BUNS }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div><div className="kp-wobble" ref={H('wobble')}><i /></div></div>}
        <div className="kp-progress" ref={H('progress')}><i /></div>
      </div>
      <div className="kp-msg" ref={H('msg')} data-on="0" />
      <button className="kp-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      {touch && <div className="kp-touchpad">
        <div className="kp-tp-left"><button {...pad('left')} aria-label="Steer left">◀</button><button {...pad('right')} aria-label="Steer right">▶</button></div>
        <div className="kp-tp-right"><button className="kp-tp-hand" {...pad('hand')}>HAND</button><button className="kp-tp-brake" {...pad('brake')}>BRAKE</button><button className="kp-tp-gas" {...pad('gas')}>GAS</button></div>
      </div>}
      {cutin && <div className={`kp-cutin ${cutin.by === 0 ? 'us' : 'them'}`}>
        <Paint name={`${cutin.rival}-cutin`} className="kp-cut-l" pos="50% 40%" />
        <Paint name={cutin.driver === 'enzo' ? 'enzo-drive' : cutin.by === 0 ? 'dora-grin' : 'dora-shock'} className="kp-cut-r" pos="50% 40%" />
        <div className="kp-cut-word">{cutin.by === 0 ? 'OVERTAKE!' : 'PASSED!'}</div>
      </div>}
      {round && <div className="kp-roundcard" data-win={round.win === null ? 'even' : round.win ? 'win' : 'lose'}>
        <small>Round {run.duel?.round ?? 0} · {run.duel?.rounds[run.duel.rounds.length - 1]?.role === 'lead' ? 'you led' : 'you chased'}</small>
        <h2>{round.title}</h2><p>{round.line}</p>
        <div className="kp-score"><span>You <b>{round.score[0]}</b></span><span><b>{round.score[1]}</b> {G.rival(run.rival!).name}</span></div>
        <p className="kp-next">{round.next}</p>
        <button className="kp-go" onClick={nextRound}>{round.last ? 'See the result ›' : 'Next round ›'}</button>
      </div>}
      {paused && <div className="kp-pause"><div className="kp-pausecard"><h2>Paused</h2>
        <p className="kp-keyhelp">Steer ← → · Gas ↑ · Brake ↓ · Handbrake Space · Camera C</p>
        <div className="kp-seg">{ASSISTS.map((a) => <button key={a.name} className={Math.abs(s.settings.assist - a.v) < 0.01 ? 'on' : ''} onClick={() => { setSetting('assist', a.v); if (runRef.current) for (const r of runRef.current.race.racers.slice(0, 1)) r.car.assist = a.v; }}>{a.name} assist</button>)}</div>
        <div className="kp-row"><button className="kp-go" onClick={() => setPaused(false)}>Resume</button><button onClick={retry}>Restart</button><button onClick={quitRace}>Quit</button></div></div></div>}
    </section>}

    {screen === 'result' && result && (() => { const r = result; const rv = r.rival ? G.rival(r.rival) : null; return <section className="kp-result" data-win={r.win ? '1' : '0'}>
      <Paint name={r.mode === 'relay' && r.win ? 'ending' : rv ? (r.win ? 'enzo-cheer' : 'enzo-scared') : r.medal >= 2 ? 'enzo-cheer' : 'enzo-notes'} className="kp-bg kp-blur" />
      <div className="kp-resultcard">
        {rv && <Paint name={`${rv.id}-portrait`} className="kp-result-face" pos="50% 25%" />}
        <span className="kp-eyebrow">{r.mode === 'delivery' ? `Delivery · ${G.passDef(r.pass).name}` : r.mode === 'attack' ? `Time attack · ${G.passDef(r.pass).name}` : `${r.mode === 'relay' ? 'The dawn relay' : 'Duel'} · ${rv?.name}`}</span>
        <h2>{rv ? (r.win ? 'You win!' : `${rv.name} wins`) : r.mode === 'delivery' ? (r.medal ? `${MEDAL[r.medal]} delivery!` : 'Delivered') : r.best ? 'New best!' : 'Finished'}</h2>
        {rv && <p className="kp-quote">“{r.win ? rv.lose : rv.win}”</p>}
        {rv ? <ol className="kp-rounds">{r.rounds.map((x, i) => <li key={i} data-win={x.win === null ? 'even' : x.win ? 'win' : 'lose'}><b>{x.role}</b> {x.text}</li>)}</ol>
          : <div className="kp-figures"><div><small>Time</small><b>{fmt(r.time)}</b></div>{r.mode === 'delivery' && <div><small>Buns</small><b>{r.buns}/{G.BUNS}</b></div>}<div><small>Drift points</small><b>{r.drift}</b></div><div><small>Rail hits</small><b>{r.hits}</b></div></div>}
        {r.mode === 'delivery' && <p className="kp-medalline">Gold {fmt(G.medalTimes(r.pass)[0])} with 11+ buns · Silver {fmt(G.medalTimes(r.pass)[1])} with 8+ · Bronze {fmt(G.medalTimes(r.pass)[2])} with 5+</p>}
        <p className="kp-earned">+🥐 {r.coins} bakery coins · total {s.coins}</p>
        {r.levelTo > r.levelFrom && <p className="kp-levelup">Enzo&rsquo;s notebook for {G.passDef(r.pass).name}: <Pips level={r.levelTo} /> <b>{LEVEL_WORD[r.levelTo]}</b>. {LEVEL_HINT[r.levelTo]}</p>}
        <div className="kp-row">
          {r.story !== null && (r.win || r.mode === 'delivery') ? <button className="kp-go" onClick={() => playStory(saveRef.current.story)}>Continue story ›</button> : null}
          <button className={r.story !== null && (r.win || r.mode === 'delivery') ? '' : 'kp-go'} onClick={retry}>{rv ? 'Rematch' : 'Run it again'}</button>
          <button onClick={() => { runRef.current = null; sfx()?.stopEngine(); go(r.story !== null ? 'story' : 'menu'); }}>{r.story !== null ? 'Story' : 'Menu'}</button>
          <button onClick={() => { runRef.current = null; sfx()?.stopEngine(); go('garage'); }}>Garage</button>
        </div>
      </div>
    </section>; })()}

    {screen === 'ending' && <section className="kp-ending">
      <Paint name="ending" className="kp-bg" alt="Sunrise at the summit inn" />
      <div className="kp-ending-card">
        <span className="kp-eyebrow">Sunrise at the summit inn</span>
        <h2>Warm buns at dawn</h2>
        <p>Skitter, Ripple, Bodger, Pippa, Vesper, Old Crag and Aurora sit on the inn steps with Dora and Enzo, passing round the last tray. Down in the valley the bakery&rsquo;s chimney is already smoking for tomorrow.</p>
        <p>Every pass, every rival and Free Duel stay open. Enzo says his notebook still has empty pages.</p>
        <div className="kp-row"><button className="kp-go" onClick={() => go('menu')}>Back to the bakery</button><a className="kp-home2" href="/">Arcade</a></div>
      </div>
    </section>}
  </main>;
}
