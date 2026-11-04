'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/pass-game';
import type { Duel, PassId, Race, RaceEvent, RivalId, Save, StoryStep } from '@/lib/pass-game';
import { carView, type CarLook, type CarView, type FrameView, type PassScene } from '@/lib/pass-scene';
import { PassSound, type SongId } from './sound';
import './pass.css';

type Screen = 'menu' | 'story' | 'scene' | 'picker' | 'duelpick' | 'garage' | 'settings' | 'intro' | 'race' | 'result' | 'ending';
type Mode = 'delivery' | 'attack' | 'duel' | 'relay' | 'demo' | 'job' | 'trial';
type Run = { mode: Mode; pass: PassId; rival: RivalId | null; story: number | null; duel: Duel | null; race: Race; ghost: number[] | null;
  /** Time Attack against Enzo's line: his time */
  enzo?: number;
  job?: G.JobId;
  /** a delivery in rain or snow */
  weather?: G.WeatherId;
  /** a rematch after the story */
  rematch?: boolean };
type RoundCard = { title: string; line: string; win: boolean | null; score: [number, number]; next: string; last: boolean };
type Result = {
  mode: Mode; pass: PassId; rival: RivalId | null; win: boolean; time: number; buns: number; medal: number; coins: number; best: boolean;
  levelFrom: number; levelTo: number; rounds: { role: string; text: string; win: boolean | null }[]; story: number | null; drift: number; hits: number;
  enzo?: number;
  /** a side job: did it work, was it the first time, and Granny's mood */
  job?: G.JobId; jobOk?: boolean; first?: boolean; mood?: number;
  /** a Drift Trial's score */
  score?: number;
  weather?: G.WeatherId;
  rematch?: boolean;
};
type Line = [string, string];

const ART = (n: string) => `/art/pass/${n}.webp`;
/** Cars with a painted portrait in public/art/pass (car-<id>.webp); the rest show their paint. */
const CAR_ART = new Set<string>(['biscuit', 'shortbread', 'meringue', 'pumpernickel', 'crumpet', 'brioche', 'stollen', 'pavlova']);
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const RIVAL_IDS = G.RIVALS.map((r) => r.id);
const SCENE_ART: Record<G.SceneId, string> = { bakery: 'story-bakery', carpark: 'story-carpark', fog: 'story-fog', relay: 'story-relay', ending: 'ending', owl: 'story-owl' };
const WHO: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', narrator: '', ...Object.fromEntries(G.RIVALS.map((r) => [r.id, r.name])) };
const PORTRAIT: Record<string, string> = { dora: 'dora-grin', enzo: 'enzo-notes', granny: 'granny-bramble', ...Object.fromEntries(G.RIVALS.map((r) => [r.id, `${r.id}-portrait`])) };
const ASSISTS = [{ v: G.ASSIST.strong, name: 'Strong' }, { v: G.ASSIST.light, name: 'Light' }, { v: G.ASSIST.off, name: 'Off' }];
const LEVEL_WORD = ['Scribbles', 'Rough notes', 'Numbered notes', 'Full notes'];
const LEVEL_HINT = ['Late and vague calls.', 'Directions and how tight.', 'Earlier calls with severity numbers and "into".', 'Earliest calls, plus gutters, crests and passing places.'];
const fmt = (t: number) => { if (!(t > 0)) return '–'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'];
/** Granny Bramble on the back seat: what she says, by her mood (happy at JOB.rider.happy or more) and what just happened. */
const RIDER_LINES: Record<'happy' | 'cross', Record<'drift' | 'big' | 'hit' | 'slow', string[]>> = {
  happy: {
    drift: ['Wheee! Again!', 'Now that\'s a corner, dear.', 'Sideways! Just like my courting days.'],
    big: ['WHEEEE! Oh, my knitting!', 'Ha! Did you see that, Enzo?', 'Lovely! My teeth nearly came out!'],
    hit: ['Ooh! Mind the paintwork, dear.', 'That rail came out of nowhere.'],
    slow: ['Are we stopping for tea?', 'The sun won\'t wait for us, dear.'],
  },
  cross: {
    drift: ['Hm. That was a bit better.', 'Oh! Do that again.', 'Now we\'re getting somewhere.'],
    big: ['Oh my! Now THAT is driving!', 'Ha! Finally!'],
    hit: ['Ow! My hip!', 'I felt that in my spines.', 'Is this a bakery car or a bumper car?'],
    slow: ['My grandson drives faster than this.', 'I\'ll miss the sunrise at this rate.', 'Is the handbrake on, dear?'],
  },
};
const pickLine = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];
const JOB_TITLE: Record<G.JobId, [string, string]> = {
  cake: ['The cake didn\'t make it', 'The cake arrived perfect!'],
  doctor: ['Too late this time', 'Dr Wren made it!'],
  rider: ['Granny is not impressed', 'Granny loved it!'],
};
const CAR_LOOK = (id: RivalId): CarLook => { const r = G.rival(id); return { shape: r.shape, body: r.body, trim: r.trim }; };
const BISCUIT: CarLook = { shape: 'hatch', body: 0xf3e7c9, trim: 0x6fb3dc, biscuit: true };
/** The player's car as the scene draws it: the Biscuit keeps its bun decal. */
const carLook = (id: G.CarId | undefined): CarLook => { const c = G.carDef(id); return c.id === 'biscuit' ? BISCUIT : { shape: c.shape, body: c.body, trim: c.trim }; };

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

const MINI_ROAD = [[13, '#14101f'], [6, '#f6e9cf']] as const;
/** A car on the minimap, in world units under the map's transform: an inked arrowhead pointing where it heads. */
function miniCar(g: CanvasRenderingContext2D, x: number, y: number, h: number, col: string, r: number, ink: number) {
  g.fillStyle = col; g.strokeStyle = '#14101f'; g.lineWidth = ink;
  g.beginPath(); g.moveTo(x + Math.cos(h) * r * 1.8, y + Math.sin(h) * r * 1.8); g.lineTo(x + Math.cos(h + 2.4) * r, y + Math.sin(h + 2.4) * r); g.lineTo(x + Math.cos(h - 2.4) * r, y + Math.sin(h - 2.4) * r); g.closePath(); g.stroke(); g.fill();
}

function Pips({ level }: { level: number }) {
  return <span className="kp-pips" aria-label={`Notebook level ${level} of 3`}>{[0, 1, 2].map((i) => <i key={i} className={i < level ? 'on' : ''} />)}</span>;
}

export default function KumoriPass() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [save, setSave] = useState<Save>(() => G.newSave());
  const [pickMode, setPickMode] = useState<'delivery' | 'attack' | 'job' | 'trial'>('delivery');
  const [weather, setWeather] = useState<G.WeatherId>('clear');
  const [pickRival, setPickRival] = useState<RivalId>('stoat');
  const [sceneStep, setSceneStep] = useState<{ art: string; lines: Line[]; i: number; then: () => void } | null>(null);
  const [intro, setIntro] = useState<{ rival: RivalId; relay: boolean; story: number | null; lines: Line[]; rematch?: boolean } | null>(null);
  const [round, setRound] = useState<RoundCard | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);
  const [cutin, setCutin] = useState<{ by: number; rival: RivalId; driver: string } | null>(null);
  const [touch, setTouch] = useState(false);
  const [showcaseIdx, setShowcaseIdx] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linesRef = useRef<HTMLCanvasElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const miniRef = useRef<HTMLCanvasElement | null>(null);
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
  const noteTimer = useRef(0); const msgTimer = useRef(0); const riderQuiet = useRef(0);
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
    if (screen === 'garage') sc.setShowcase(true, showcaseIdx === 1 ? [carLook(save.car), CAR_LOOK('stoat'), CAR_LOOK('fox')] : [carLook(save.car)]);
    else if (sc.showcase) sc.setShowcase(false);
  }, [screen, ready, showcaseIdx, save.car]);

  // ---------------------------------------------------------------- starting runs
  const lookFor = (race: Race, rival: RivalId | null): CarLook[] => (rival ? [carLook(race.opts.car), CAR_LOOK(rival)] : [carLook(race.opts.car)]);

  const beginRace = useCallback((run: Run) => {
    runRef.current = run;
    const sc = sceneRef.current;
    if (sc) {
      sc.setShowcase(false);
      sc.setTrack(run.race.track); sc.setWeather(run.race.opts.weather ?? 'clear');
      sc.setLine(saveRef.current.settings.line && run.mode !== 'demo' ? G.playerLine(run.race) : null);
      sc.setCars(lookFor(run.race, run.rival), run.ghost ? { ...carLook(run.race.opts.ghostCar?.car), ghost: true } : null);
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
    return { pass, upgrades: s.upgrades, assist: s.settings.assist, sharp: s.settings.sharp, manual: s.settings.manual, noteLevel: G.noteLevel(s.runs[pass]), seed: 1 + s.runs[pass] * 13 + s.coins, ...extra };
  }, []);

  const startSolo = useCallback((mode: 'delivery' | 'attack', pass: PassId, story: number | null, w: G.WeatherId = 'clear') => {
    const s = saveRef.current, wx = mode === 'delivery' && story === null && w !== 'clear' ? w : undefined;
    let ghost: number[] | null = null, ghostCar: G.RaceOpts['ghostCar'] = null;
    if (mode === 'attack' && s.ghosts[pass]) { ghost = G.unpackGhost(s.ghosts[pass]!); ghostCar = s.ghostMeta[pass] ?? null; }
    const race = new G.Race(raceOpts(pass, { buns: mode === 'delivery', ghost, ghostCar, car: story === null ? s.car : 'biscuit', weather: wx }));
    beginRace({ mode, pass, rival: null, story, duel: null, race, ghost, weather: wx });
  }, [beginRace, raceOpts]);

  /** A Drift Trial on a pass, in the garage pick. */
  const startTrial = useCallback((pass: PassId) => {
    const race = new G.Race(raceOpts(pass, { buns: false, trial: true, car: saveRef.current.car }));
    beginRace({ mode: 'trial', pass, rival: null, story: null, duel: null, race, ghost: null });
  }, [beginRace, raceOpts]);

  /** A side job on a pass, in the garage pick. */
  const startJob = useCallback((job: G.JobId, pass: PassId) => {
    const race = new G.Race(raceOpts(pass, { buns: job === 'cake', job, car: saveRef.current.car }));
    beginRace({ mode: 'job', pass, rival: null, story: null, duel: null, race, ghost: null, job });
  }, [beginRace, raceOpts]);

  /** Time Attack against Enzo's line: his demo run replayed as the ghost, in whatever car the player picked. */
  const startEnzo = useCallback((pass: PassId) => {
    const s = saveRef.current, e = G.enzoGhost(pass);
    const race = new G.Race(raceOpts(pass, { buns: false, ghost: e.inputs, ghostCar: G.ENZO_CAR, car: s.car }));
    beginRace({ mode: 'attack', pass, rival: null, story: null, duel: null, race, ghost: e.inputs, enzo: e.time });
  }, [beginRace, raceOpts]);

  /** Enzo's line: the stock Biscuit drives the racing line cleanly by itself, with every note called. Nothing is saved. */
  const startDemo = useCallback((pass: PassId) => {
    const race = new G.Race({ pass, buns: true, autopilot: G.DEMO.pass[pass].pace, demo: true, noteLevel: 3, seed: 3 });
    beginRace({ mode: 'demo', pass, rival: null, story: null, duel: null, race, ghost: null });
  }, [beginRace]);

  const startDuel = useCallback((rival: RivalId, relay: boolean, story: number | null, rematch = false) => {
    const s = saveRef.current, r = G.rival(rival), pass = relay ? 'summit' : rematch ? G.weakestPass(s) : r.pass;
    const duel = new G.Duel({ rival, relay, ...(rematch ? { rematch, pass } : {}), car: story === null ? s.car : 'biscuit', upgrades: s.upgrades, assist: s.settings.assist, sharp: s.settings.sharp, manual: s.settings.manual, noteLevel: G.noteLevel(s.runs[pass]), seed: 7 + s.runs[pass] * 31 + s.beaten.length * 5 + (s.coins % 97) });
    beginRace({ mode: relay ? 'relay' : 'duel', pass, rival, story, duel, race: duel.race, ghost: null, rematch });
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
    if (run.mode === 'demo') {
      const race = run.race, time = race.player.finished;
      setResult({ mode: 'demo', pass: run.pass, rival: null, win: true, time, buns: race.buns, medal: G.deliveryMedal(run.pass, time, race.buns), coins: 0, best: false,
        levelFrom: 0, levelTo: 0, rounds: [], story: null, drift: Math.round(race.driftScore), hits: race.hits });
      sfx()?.quietEngine(); setRound(null); setScreen('result'); return;
    }
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const levelFrom = G.noteLevel(s.runs[run.pass]);
    G.recordRun(s, run.pass);
    const levelTo = G.noteLevel(s.runs[run.pass]);
    const race = run.race;
    let res: Result;
    if (run.mode === 'trial') {
      const time = race.player.finished, score = Math.round(race.trialScore), medal = G.trialMedal(run.pass, score);
      const best = score > (s.trials[run.pass] ?? 0), coins = G.TRIAL.pay[medal] + 3;
      s.coins += coins; if (best) s.trials[run.pass] = score;
      res = { mode: 'trial', pass: run.pass, rival: null, win: medal > 0, time, buns: 0, medal, coins, best, levelFrom, levelTo, rounds: [], story: null,
        drift: Math.round(race.driftScore), hits: race.hits, score };
    } else if (run.mode === 'job') {
      const time = race.player.finished, key = G.jobKey(run.job!, run.pass), jr = G.jobResult(run.job!, run.pass, { time, buns: race.buns, mood: race.mood });
      const first = jr.ok && !s.jobs.includes(key), coins = jr.coins + (first ? G.JOB.firstBonus : 0);
      s.coins += coins; if (first) s.jobs.push(key);
      res = { mode: 'job', pass: run.pass, rival: null, win: jr.ok, time, buns: race.buns, medal: 0, coins, best: false, levelFrom, levelTo, rounds: [], story: null,
        drift: Math.round(race.driftScore), hits: race.hits, job: run.job, jobOk: jr.ok, first, mood: Math.round(race.mood) };
    } else if (run.mode === 'duel' || run.mode === 'relay') {
      const d = run.duel!; const win = d.winner === 0;
      const coins = Math.round(G.duelCoins(run.rival!, win) * (run.rematch ? G.REMATCH.pay : 1));
      s.coins += coins;
      if (win && !s.beaten.includes(run.rival!)) s.beaten.push(run.rival!);
      if (win && run.rematch && !s.rematched.includes(run.rival!)) s.rematched.push(run.rival!);
      if (win && run.story !== null) s.story = Math.max(s.story, run.story + 1);
      res = { mode: run.mode, pass: run.pass, rival: run.rival, win, time: 0, buns: 0, medal: 0, coins, best: false, levelFrom, levelTo, story: run.story, drift: 0, hits: 0, rematch: run.rematch,
        rounds: d.rounds.map((r, i) => ({ role: i === 0 && run.mode === 'relay' ? 'Uphill · lead' : r.role === 'lead' ? 'Lead' : 'Chase', text: roundText(r.result, r.role), win: r.result.winner === -1 ? null : r.result.winner === 0 })) };
    } else {
      const time = race.player.finished, buns = run.mode === 'delivery' ? race.buns : 0;
      const w = run.weather ?? 'clear', wet = w !== 'clear';
      const medal = run.mode === 'delivery' ? G.deliveryMedal(run.pass, time, buns, w) : 0;
      const coins = run.mode === 'delivery' ? Math.round(G.deliveryCoins(medal, buns) * G.WEATHER[w].pay) : 5;
      s.coins += coins;
      if (wet) { if (medal > (s.wmedals[w][run.pass] ?? 0)) s.wmedals[w][run.pass] = medal; }
      else if (medal > s.medals[run.pass]) s.medals[run.pass] = medal;
      // best times and ghosts are clear nights only: a ghost replays its inputs on a dry road
      const best = !wet && (!s.best[run.pass] || time < s.best[run.pass]);
      if (best) {
        s.best[run.pass] = Math.round(time * 1000) / 1000;
        if (run.mode === 'attack' || !s.ghosts[run.pass]) { s.ghosts[run.pass] = G.packGhost(race.inputs); s.ghostMeta[run.pass] = { up: s.upgrades.slice(), assist: s.settings.assist, manual: s.settings.manual, sharp: s.settings.sharp, hv: G.GHOST_VERSION, car: race.opts.car ?? 'biscuit' }; }
      }
      if (run.story !== null) s.story = Math.max(s.story, run.story + 1);
      res = { mode: run.mode, pass: run.pass, rival: null, win: true, time, buns, medal, coins, best, levelFrom, levelTo, rounds: [], story: run.story, drift: Math.round(race.driftScore), hits: race.hits, enzo: run.enzo, weather: run.weather };
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

  // ---------------------------------------------------------------- the rear-view mirror (duels)
  useEffect(() => {
    const sc = sceneRef.current, el = mirrorRef.current, cv = canvasRef.current;
    if (!sc) return;
    if (!el || !cv || screen !== 'race') { sc.setMirror(null); return; }
    const place = () => { const a = el.getBoundingClientRect(), b = cv.getBoundingClientRect(), i = 3; sc.setMirror({ x: a.left - b.left + i, y: a.top - b.top + i, w: a.width - i * 2, h: a.height - i * 2 }); };
    place();
    const ro = new ResizeObserver(place); ro.observe(el); ro.observe(cv);
    return () => { ro.disconnect(); sc.setMirror(null); };
  }, [screen, !!runRef.current?.duel]);

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
      f.dawn = run.mode === 'relay' ? Math.min(1, 0.3 + (run.duel?.round ?? 0) * 0.35 + (race.player.s / race.track.len) * 0.3) : run.pass === 'summit' ? 0.32 : 0;
      f.focus = 0;
      f.line = race.t >= 0 && p.finished < 0 ? { i: p.idx, u: p.car.u } : null;
      sc.render(f);
      drawSpeedLines(Math.hypot(p.car.u, p.car.v), p.car.boost > 0, sm < 1);
      updateHud(run, race, dt);
      drawMinimap(race);
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
    v.spin = r.hold > 0 ? 0 : c.wheelSpin; v.brake = brake; v.boost = c.boost > 0 ? 1 : 0; v.lights = race.t > -2.2 ? 1 : 0; v.pitch = Math.atan(t.grade[r.idx] * Math.cos(c.h - t.h[r.idx])); v.visible = true; v.i = r.idx;
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
    // keys, touch pads and sticks all go to the car raw: the car's steering filter (Smooth or Sharp) eases them in
    steer.current = analog !== null ? analog : (left ? 1 : 0) - (right ? 1 : 0); void dt;
    inp.steer = steer.current; inp.throttle = thr; inp.brake = brk; inp.hand = hand; inp.up = up; inp.down = down;
  }

  function say(text: string, who: 'dora' | 'enzo' | 'granny', urgent = false) {
    const b = hud.current.note, tx = hud.current.noteText, pic = hud.current.notePic as HTMLImageElement | null;
    if (!b || !tx) return;
    tx.textContent = text; b.dataset.on = '1'; b.dataset.who = who; b.dataset.urgent = urgent ? '1' : '0';
    if (pic) { const want = ART(who === 'enzo' ? 'enzo-call' : who === 'granny' ? 'granny-bramble' : 'dora-focus'); if (!pic.src.endsWith(want)) { pic.style.visibility = ''; pic.src = want; } }
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
        case 'bun': if (run.job === 'cake') { snd?.wall(4); flash('The cake! It\'s ruined…', 'bad'); say('Oh no. The cake…', 'enzo', true); break; }
          snd?.bun(); flash(e.left > 0 ? `A bun fell! ${e.left} left` : 'No buns left…', 'bad'); if (e.left % 4 === 0 && e.left > 0) say('The buns! Gently!', 'enzo', true); break;
        case 'rider': {
          const now = performance.now(); if (now < riderQuiet.current && e.why !== 'big' && e.why !== 'hit') break;
          riderQuiet.current = now + 4000; say(pickLine(RIDER_LINES[e.mood >= G.JOB.rider.happy ? 'happy' : 'cross'][e.why]), 'granny', e.why === 'hit'); break;
        }
        case 'chain': snd?.boost(); flash(`+${e.banked}${e.mult > 1 ? ` · chain ×${e.mult}` : ''}`, 'good'); break;
        case 'chainLost': flash('Chain lost', 'bad'); break;
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
        case 'finish': if (e.car === 0) { flash(run.mode === 'delivery' || run.mode === 'demo' || run.job === 'cake' ? 'Delivered!' : run.job === 'doctor' ? (e.time <= G.jobDeadline(run.pass) ? 'Just in time!' : 'Too late…') : run.job === 'rider' ? 'The summit!' : 'Finish!', run.job === 'doctor' && e.time > G.jobDeadline(run.pass) ? 'bad' : 'good'); } break;
        default: break;
      }
    }
  }

  function onRaceDone(run: Run) {
    const race = run.race;
    if (run.mode === 'delivery' || run.mode === 'attack' || run.mode === 'demo' || run.mode === 'job' || run.mode === 'trial') { if (!runRef.current || runRef.current.race !== race || (race as unknown as { _shown?: boolean })._shown) return; (race as unknown as { _shown?: boolean })._shown = true; setTimeout(finishRun, 900); return; }
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
    const k = Math.max(0, Math.min(1, (speed - 24) / 18)) * 0.8 + (boost ? 0.4 : 0) + (cut ? 0.6 : 0);
    if (k <= 0.02 || saveRef.current.settings.lite) return;
    const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) / 2, t = performance.now() / 1000;
    g.strokeStyle = cut ? 'rgba(255,255,255,0.55)' : 'rgba(235,240,255,0.2)';
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.sin(i * 12.3 + Math.floor(t * 18)) * 0.05;
      const r0 = R * (0.62 + ((i * 37 + Math.floor(t * 24)) % 7) * 0.035), len = R * (0.1 + k * 0.25);
      g.lineWidth = 1 + ((i * 13) % 3) * k;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
    }
  }

  /** The minimap: the road around the car, turned so the car points up, with the rivals and the ghost on it. In the
   * fog and the dark tunnel it shows only the road behind and a few metres ahead, so Enzo's notes still tell you what
   * is coming. */
  function drawMinimap(race: Race) {
    const c = miniRef.current, g = c?.getContext('2d'); if (!c || !g) return;
    const t = race.track, me = race.player, W = c.width, H = c.height, k = H / 330, reveal = t.def.dark || t.def.fog > 0.5;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    // world (x, y north) → the car at 68% down the map, heading up
    g.setTransform(k, 0, 0, -k, W / 2, H * 0.68); g.rotate(Math.PI / 2 - me.car.h); g.translate(-me.car.x, -me.car.y);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const from = Math.max(0, me.idx - 140), to = Math.min(t.n - 1, me.idx + (reveal ? 35 : 280));
    for (let q = 0; q < MINI_ROAD.length; q++) {
      g.strokeStyle = MINI_ROAD[q][1]; g.lineWidth = MINI_ROAD[q][0] / k; g.beginPath(); g.moveTo(t.x[from], t.y[from]);
      for (let i = from + 3; i < to; i += 3) g.lineTo(t.x[i], t.y[i]);
      g.lineTo(t.x[to], t.y[to]); g.stroke();
    }
    if (to === t.n - 1) { g.fillStyle = '#fff'; g.strokeStyle = '#14101f'; g.lineWidth = 3 / k; g.beginPath(); g.arc(t.x[to], t.y[to], 9 / k, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (race.ghost) { g.globalAlpha = 0.55; miniCar(g, race.ghost.car.x, race.ghost.car.y, race.ghost.car.h, '#dfe8ff', 9 / k, 3 / k); g.globalAlpha = 1; }
    const cars = race.racers;
    for (let i = cars.length - 1; i >= 0; i--) miniCar(g, cars[i].car.x, cars[i].car.y, cars[i].car.h, i === 0 ? '#ffd25a' : '#ff5d73', (i === 0 ? 12 : 11) / k, 3 / k);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function updateHud(run: Run, race: Race, dt: number) {
    const h = hud.current, p = race.player, c = p.car;
    const sp = Math.round(Math.hypot(c.u, c.v) * 3.6);
    if (h.speed) h.speed.textContent = String(sp);
    if (h.gear) h.gear.textContent = c.u < -0.5 ? 'R' : String(c.gear);
    if (h.rpm) h.rpm.style.setProperty('--v', String(Math.min(1, c.rpm / c.spec.redline)));
    if (h.time) h.time.textContent = fmt(Math.max(0, race.t));
    if (h.drift) { h.drift.style.setProperty('--v', String(race.drift)); h.drift.dataset.on = race.drifting ? '1' : '0'; h.drift.dataset.boost = c.boost > 0 ? '1' : '0'; }
    if (h.mood) h.mood.style.setProperty('--v', String(race.mood / 100));
    if (h.tscore) { h.tscore.textContent = String(Math.round(race.trialScore)); if (h.tlive) h.tlive.textContent = race.trialCur > 0 ? `+${Math.round(race.trialCur)} ×${G.trialMult(race.chain)}` : race.chain > 0 ? `chain ×${G.trialMult(race.chain)}` : ''; }
    if (h.due) { const left = G.jobDeadline(run.pass) - Math.max(0, race.player.finished >= 0 ? race.player.finished : race.t); h.due.textContent = left >= 0 ? `${left.toFixed(1)} s left` : 'Late!'; h.due.dataset.late = left < 10 ? '1' : '0'; }
    if (h.buns && (run.mode === 'delivery' || run.mode === 'demo' || run.job === 'cake')) { h.buns.style.setProperty('--n', String(race.buns)); h.buns.dataset.left = String(race.buns); if (h.wobble) h.wobble.style.setProperty('--v', String(Math.min(1, race.wobble))); }
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
          beta: G.slipAngleOf(r.player.car), mode: run!.mode, pass: run!.pass, round: run!.duel?.round ?? 0, rival: run!.rival, car: r.opts.car ?? 'biscuit', enzo: !!run!.enzo, job: run!.job ?? null, mood: r.mood, trial: r.trialScore, chain: r.chain, weather: r.opts.weather ?? 'clear', rematch: !!run!.rematch, x: r.player.car.x, y: r.player.car.y } : null,
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
          /** put every car at a distance along the road, rolling at u m/s (screenshots) */
          place: (sAt: number, u = 16) => { const rr = runRef.current?.race; if (!rr) return; for (const rc of rr.racers) { const i = Math.max(0, Math.floor(sAt + (rc === rr.player ? 0 : 9))); rc.car.x = rr.track.x[i]; rc.car.y = rr.track.y[i]; rc.car.h = rr.track.h[i]; rc.idx = i; rc.w.i = i; rc.w.d = 0; rc.s = i; rc.car.u = u; rc.car.v = 0; rc.car.r = 0; for (let k = 0; k * 4 < i; k++) if (rc.marks[k] < 0) rc.marks[k] = Math.max(0, rr.t); } },
          /** the last frame's draw calls and triangles (performance checks) */
          draws: () => { const i = sceneRef.current?.renderer.info.render; return i ? { calls: i.calls, triangles: i.triangles } : null; },
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
    if (run.mode === 'demo') startDemo(run.pass);
    else if (run.enzo) startEnzo(run.pass);
    else if (run.mode === 'job') startJob(run.job!, run.pass);
    else if (run.mode === 'trial') startTrial(run.pass);
    else if (run.mode === 'delivery' || run.mode === 'attack') startSolo(run.mode, run.pass, run.story, run.weather);
    else startDuel(run.rival!, run.mode === 'relay', run.story, run.rematch);
  };

  // ---------------------------------------------------------------- render
  const s = save;
  const run = runRef.current;
  const nextStory = G.STORY[s.story];
  const storyLabel = (st: StoryStep) => st.kind === 'scene' ? ({ bakery: 'The bakery at 4 am', carpark: 'A challenge at the summit', fog: 'Into the fog', relay: 'First light', ending: 'Sunrise at the inn', owl: 'A stranger at the bakery' } as const)[st.scene]
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
        <button className="kp-mode kp-mode-story" onClick={() => go('story')}><b>Story</b><small>{nextStory && s.story > 0 ? storyLabel(nextStory) : s.ended ? 'The mountain is yours' : 'Seven rivals, one dawn'}</small></button>
        <button className="kp-mode" onClick={() => { setPickMode('delivery'); go('picker'); }}><b>Delivery Runs</b><small>Buns on the back seat · medals · better notes</small></button>
        <button className="kp-mode" disabled={!s.beaten.length && !s.ended} onClick={() => go('duelpick')}><b>Free Duel</b><small>{s.beaten.length ? 'Any rival you have beaten' : 'Beat a rival in the story first'}</small></button>
        <button className="kp-mode" onClick={() => { setPickMode('attack'); go('picker'); }}><b>Time Attack</b><small>Race the ghost of your best run</small></button>
        <button className="kp-mode" onClick={() => { setPickMode('trial'); go('picker'); }}><b>Drift Trials</b><small>Chain drifts for points · beat Enzo&rsquo;s score</small></button>
        <button className="kp-mode" onClick={() => { setPickMode('job'); go('picker'); }}><b>Side Jobs</b><small>{s.jobs.length ? `${s.jobs.length} of ${G.JOBS.length * G.PASSES.length} done` : 'A cake, a doctor and Granny Bramble'}</small></button>
        <button className="kp-mode" onClick={() => go('garage')}><b>Garage</b><small>Upgrades with Enzo</small></button>
        <button className="kp-mode" onClick={() => go('settings')}><b>Settings</b><small>Assists, gears, Lite, sound</small></button>
      </nav>
    </section>}

    {screen === 'story' && <section className="kp-page kp-story-page">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>The Story</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <ol className="kp-ladder">
        {G.STORY.map((st, i) => {
          if (i > G.STORY_END && !s.ended) return null;
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
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>{pickMode === 'delivery' ? 'Delivery Runs' : pickMode === 'job' ? 'Side Jobs' : pickMode === 'trial' ? 'Drift Trials' : 'Time Attack'}</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <p className="kp-pagelede">{pickMode === 'delivery' ? 'Twelve warm buns on the back seat. Medals need the time and the buns: hit the rails hard and they fly. Every finished run improves Enzo\'s notebook for that pass.' : pickMode === 'trial' ? `Every clean drift banks its points. Start the next one within ${G.TRIAL.link} seconds to chain it, up to ×${G.TRIAL.max}; touch a rail and you lose the drift and the chain. Gold is Enzo\'s own score on his line.` : pickMode === 'job' ? 'Odd jobs for the bakery car, in whichever car you pick in the garage. Each pays coins, and the first time on each pass pays a bonus.' : 'No buns, no rivals: just you and the ghost of your best run on each pass, or race Enzo\'s line.'}</p>
      {pickMode === 'delivery' && <div className="kp-weather" role="radiogroup" aria-label="Weather">{(['clear', 'rain', 'snow'] as const).map((w) => <button key={w} role="radio" aria-checked={weather === w} data-weather={w} className={weather === w ? 'on' : ''} onClick={() => setWeather(w)}>{G.WEATHER[w].icon} {G.WEATHER[w].name}{w !== 'clear' ? <small>less grip · ×{G.WEATHER[w].pay} coins</small> : <small>the usual night</small>}</button>)}</div>}
      <div className="kp-cards">
        {G.PASSES.map((p) => {
          const open = G.passUnlocked(s, p.id), lvl = G.noteLevel(s.runs[p.id]); const [g, sv, b] = G.medalTimes(p.id, weather); const wm = weather === 'clear' ? s.medals[p.id] : s.wmedals[weather][p.id] ?? 0;
          if (pickMode === 'job') return <div key={p.id} className="kp-passwrap"><div className={`kp-card kp-pass kp-pass-${p.id}`} data-pass={p.id} aria-disabled={!open}>
            <TrackMap pass={p.id} />
            <span className="kp-card-body"><b>{p.name}</b><small>{p.blurb}</small><span className="kp-medals">Doctor&rsquo;s deadline {fmt(G.jobDeadline(p.id))}</span></span>
            {!open && <span className="kp-lock">🔒 Reach it in the story</span>}
          </div>
            {open && <div className="kp-jobs">{G.JOBS.map((j) => { const done = s.jobs.includes(G.jobKey(j.id, p.id));
              return <button key={j.id} className={`kp-watch kp-job${done ? ' done' : ''}`} data-job={j.id} data-pass={p.id} title={j.blurb} onClick={() => { sfx()?.unlock(); startJob(j.id, p.id); }}>{j.icon} {j.name}{done ? ' ✓' : ''}</button>; })}</div>}
          </div>;
          return <div key={p.id} className="kp-passwrap"><button className={`kp-card kp-pass kp-pass-${p.id}`} disabled={!open} data-pass={p.id} onClick={() => { sfx()?.unlock(); if (pickMode === 'trial') startTrial(p.id); else startSolo(pickMode as 'delivery' | 'attack', p.id, null, pickMode === 'delivery' ? weather : 'clear'); }}>
            <TrackMap pass={p.id} />
            <span className="kp-card-body"><b>{p.name}</b><small>{p.blurb}</small>
              <span className="kp-notebook">Enzo&rsquo;s notebook: <Pips level={lvl} /> <i>{LEVEL_WORD[lvl]}</i></span>
              {pickMode === 'trial' ? <span className="kp-medals">{s.trials[p.id] ? <em className={`m${G.trialMedal(p.id, s.trials[p.id]!)}`}>{MEDAL[G.trialMedal(p.id, s.trials[p.id]!)] || 'Best'}</em> : null} {s.trials[p.id] ? `Best ${s.trials[p.id]} · ` : ''}Gold {G.trialTargets(p.id)[0]} · Silver {G.trialTargets(p.id)[1]} · Bronze {G.trialTargets(p.id)[2]}</span>
                : pickMode === 'delivery' ? <span className="kp-medals">{wm ? <em className={`m${wm}`}>{MEDAL[wm]}</em> : null} Gold {fmt(g)} · Silver {fmt(sv)} · Bronze {fmt(b)}</span>
                : <span className="kp-medals">Best {fmt(s.best[p.id])}{s.ghosts[p.id] ? ' · ghost ready' : ''}</span>}
              {(p.fog > 0.5 || p.dark) && <span className="kp-warn">{p.dark ? 'Unlit: notes matter' : 'Thick fog: notes matter'}</span>}
            </span>
            {!open && <span className="kp-lock">🔒 Reach it in the story</span>}
          </button>
            {open && pickMode === 'delivery' && <button className="kp-watch" data-pass={p.id} onClick={() => { sfx()?.unlock(); startDemo(p.id); }}>▶ Watch Enzo&rsquo;s line</button>}
            {open && pickMode === 'attack' && <button className="kp-watch kp-race-enzo" data-pass={p.id} onClick={() => { sfx()?.unlock(); startEnzo(p.id); }}>👻 Race Enzo&rsquo;s line</button>}
          </div>;
        })}
      </div>
      {unlockedPasses.length < G.PASSES.length && <p className="kp-foot">More passes open as the story goes on.</p>}
    </section>}

    {screen === 'duelpick' && <section className="kp-page">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>Free Duel</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <div className="kp-cards kp-rivals">
        {G.RIVALS.map((r) => { const open = G.rivalUnlocked(s, r.id); return <button key={r.id} className={`kp-card kp-rival ${pickRival === r.id ? 'sel' : ''}`} data-rival={r.id} disabled={!open} onClick={() => { sfx()?.button(); setPickRival(r.id); }}>
          <Paint name={`${r.id}-portrait`} className="kp-rival-art" pos="50% 25%" />
          <span className="kp-card-body"><b>{r.name}</b><small>{r.animal} · {r.car}, {r.carBlurb}</small><small>{r.id === 'fox' ? 'The dawn relay on Summit Dawn' : G.passDef(r.pass).name}</small>{s.rematched.includes(r.id) && <small className="kp-rematched">Rematch won ✓</small>}</span>
          {!open && <span className="kp-lock">🔒</span>}
        </button>; })}
      </div>
      <div className="kp-row"><button className="kp-go" disabled={!G.rivalUnlocked(s, pickRival)} onClick={() => { setIntro({ rival: pickRival, relay: pickRival === 'fox', story: null, lines: [] }); go('intro'); }}>Challenge {G.rival(pickRival).name} ›</button>
        {G.rematchUnlocked(s, pickRival) && <button className="kp-rematch" onClick={() => { setIntro({ rival: pickRival, relay: false, story: null, lines: [], rematch: true }); go('intro'); }}>Rematch · {G.passDef(G.weakestPass(s)).name} ›</button>}</div>
      {s.ended && <p className="kp-foot">Rematches: after the story, a rival you have beaten comes back with every part fitted and races you on your weakest pass (the lowest delivery medal), for {G.REMATCH.pay}× the coins.</p>}
    </section>}

    {screen === 'garage' && <section className="kp-garage">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>Enzo&rsquo;s Garage</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <div className="kp-garage-grid">
        <div className="kp-garage-car">
          <div className="kp-enzo"><Paint name="enzo-notes" className="kp-enzo-face" pos="50% 30%" /><p>{s.upgrades.length ? `${s.upgrades.length} of ${G.UPGRADES.length} fitted, and every part fits every car. The ${G.carDef(s.car).name}'s never been happier.` : `The ${G.carDef(s.car).name} is all original! Bakery coins buy parts. Each one changes how she drives.`}</p></div>
          <div className="kp-stats">{(['power', 'grip', 'rotation', 'stability', 'buns'] as const).map((k) => { const v = G.statCard(s.upgrades, G.carDef(s.car).stats)[k]; return <div key={k} className="kp-stat"><span>{k === 'buns' ? 'Bun safety' : k[0].toUpperCase() + k.slice(1)}</span><i style={{ ['--v' as string]: v / 10 }} /><b>{v}</b></div>; })}</div>
        </div>
        <div className="kp-garage-side">
        <h3 className="kp-garage-h">Cars <small>Free play only: the story is always the Biscuit</small></h3>
        <div className="kp-cars">
          {G.CARS.map((c) => { const open = G.carUnlocked(s, c.id), on = s.car === c.id; return <div key={c.id} className={`kp-carcard${on ? ' on' : ''}${open ? '' : ' locked'}`} data-car={c.id}>
            {CAR_ART.has(c.id) ? <Paint name={`car-${c.id}`} className="kp-carcard-art" alt={`The ${c.name}`} pos="50% 62%" /> : <span className="kp-carcard-art kp-carcard-swatch" style={{ ['--body' as string]: hex(c.body), ['--trim' as string]: hex(c.trim) }} />}
            <b>{c.name}</b><p>{c.blurb}</p>
            <button disabled={!open || on} onClick={() => { const n: Save = { ...saveRef.current, car: c.id }; persist(n); sfx()?.button(); }}>{on ? 'Driving ✓' : open ? 'Drive' : `🔒 Beat ${G.rival(c.rival!).name}`}</button>
          </div>; })}
        </div>
        <h3 className="kp-garage-h">Parts</h3>
        <div className="kp-parts">
          {G.UPGRADES.map((u) => { const own = s.upgrades.includes(u.id); return <div key={u.id} className={`kp-part ${own ? 'own' : ''}`} data-part={u.id}>
            <b>{u.name}</b><p>{u.effect}</p>
            <span className="kp-part-stats">{Object.entries(u.stats).map(([k, v]) => <em key={k} className={(v as number) > 0 ? 'up' : 'down'}>{(v as number) > 0 ? '+' : ''}{v} {k === 'buns' ? 'bun safety' : k}</em>)}</span>
            <button disabled={own || s.coins < u.cost} onClick={() => { const n: Save = JSON.parse(G.serialise(saveRef.current)); if (G.buyUpgrade(n, u.id)) { persist(n); sfx()?.button(); sfx()?.backfire(); } }}>{own ? 'Fitted ✓' : `Fit · 🥐 ${u.cost}`}</button>
          </div>; })}
        </div>
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="kp-page kp-settings">
      <header className="kp-pagehead"><button className="kp-back" onClick={() => go('menu')}>‹ Back</button><h2>Settings</h2><div className="kp-coins">🥐 {s.coins}</div></header>
      <div className="kp-setlist">
        <div className="kp-set"><b>Steering</b><small>Smooth eases the keys in, so a tap is a small correction. Sharp is quicker.</small>
          <div className="kp-seg"><button className={!s.settings.sharp ? 'on' : ''} onClick={() => setSetting('sharp', false)}>Smooth</button><button className={s.settings.sharp ? 'on' : ''} onClick={() => setSetting('sharp', true)}>Sharp</button></div></div>
        <div className="kp-set"><b>Assist</b><small>Catches slides and holds a drift at the angle you steer. Strong can&apos;t spin from a normal corner; Off is all you.</small>
          <div className="kp-seg">{ASSISTS.map((a) => <button key={a.name} className={Math.abs(s.settings.assist - a.v) < 0.01 ? 'on' : ''} onClick={() => setSetting('assist', a.v)}>{a.name}</button>)}</div></div>
        <div className="kp-set"><b>Gears</b><small>Manual: Shift up, Ctrl down.</small><div className="kp-seg"><button className={!s.settings.manual ? 'on' : ''} onClick={() => setSetting('manual', false)}>Automatic</button><button className={s.settings.manual ? 'on' : ''} onClick={() => setSetting('manual', true)}>Manual</button></div></div>
        <div className="kp-set"><b>Racing line</b><small>A line on the road ahead: green, you can go faster; yellow, about right; red, too fast for here, so brake.</small><div className="kp-seg"><button className={!s.settings.line ? 'on' : ''} onClick={() => setSetting('line', false)}>Off</button><button className={s.settings.line ? 'on' : ''} onClick={() => setSetting('line', true)}>On</button></div></div>
        <div className="kp-set"><b>Lite graphics</b><small>No shadows, outlines or particles, for slower machines.</small><div className="kp-seg"><button className={!s.settings.lite ? 'on' : ''} onClick={() => setSetting('lite', false)}>Full</button><button className={s.settings.lite ? 'on' : ''} onClick={() => setSetting('lite', true)}>Lite</button></div></div>
        <div className="kp-set"><b>Sound</b><div className="kp-seg"><button className={s.settings.sound ? 'on' : ''} onClick={() => setSetting('sound', true)}>On</button><button className={!s.settings.sound ? 'on' : ''} onClick={() => setSetting('sound', false)}>Off</button></div></div>
        <div className="kp-set"><b>Music</b><div className="kp-seg"><button className={s.settings.music ? 'on' : ''} onClick={() => setSetting('music', true)}>On</button><button className={!s.settings.music ? 'on' : ''} onClick={() => setSetting('music', false)}>Off</button></div></div>
        <div className="kp-set kp-keys"><b>Controls</b><small>Steer ← → or A D · Throttle ↑ or W · Brake ↓ or S · Handbrake Space · Camera C · Pause Esc. Touch: steer pads on the left, GAS, BRAKE and HAND on the right. A gamepad works too.</small></div>
      </div>
    </section>}

    {screen === 'intro' && intro && (() => { const r = G.rival(intro.rival); const pass = intro.relay ? 'summit' : intro.rematch ? G.weakestPass(s) : r.pass; const lvl = G.noteLevel(s.runs[pass]); return <section className="kp-intro">
      <Paint name={intro.relay ? 'story-relay' : 'story-carpark'} className="kp-bg kp-blur" />
      <div className="kp-vs">
        <div className="kp-vs-side kp-vs-rival"><Paint name={`${r.id}-portrait`} className="kp-vs-face" pos="50% 25%" /><div className="kp-vs-name"><small>{r.animal} · {r.car}</small><b>{r.name}</b></div></div>
        <div className="kp-vs-mid"><span className="kp-vs-word">VS</span>
          <div className="kp-taunt">“{intro.rematch ? G.REMATCH_TAUNT[r.id] ?? r.taunt : r.taunt}”</div>
          <div className="kp-rules"><b>{intro.relay ? 'The dawn relay' : `${intro.rematch ? 'Rematch' : 'Touge duel'} · ${G.passDef(pass).name}`}</b>
            {intro.relay ? <ul><li><b>Leg 1, uphill:</b> Enzo drives, Dora reads the notes. You lead: don&rsquo;t be passed, or finish {G.DUEL_GAP.toFixed(1)} s clear.</li><li><b>Leg 2, downhill:</b> Dora drives. You chase: stay within {G.DUEL_GAP.toFixed(1)} s, or pass where the road opens.</li><li>Level after two: sudden death until someone wins a round outright.</li></ul>
              : <ul><li><b>Round 1, you lead:</b> don&rsquo;t get passed; finish more than {G.DUEL_GAP.toFixed(1)} s ahead to take it.</li><li><b>Round 2, you chase:</b> stay within {G.DUEL_GAP.toFixed(1)} s, or overtake where the road opens.</li><li>Level after two: sudden death until someone wins a round outright. Spin out and you lose the round.</li></ul>}
            <p className="kp-note-level">Enzo&rsquo;s notebook here: <Pips level={lvl} /> {LEVEL_WORD[lvl]}{lvl < 2 && (pass === 'fog' || pass === 'tunnel') ? ' · a delivery run or two would help!' : ''}</p>
            <p className="kp-style">{intro.rematch ? `Every part fitted, and they picked your weakest pass. ${r.style}` : r.style}</p>
          </div>
          {intro.lines.length > 0 && <div className="kp-introline"><b>{WHO[intro.lines[0][0]]}</b> {intro.lines[0][1]}</div>}
          <div className="kp-row"><button className="kp-back" onClick={() => go(intro.story !== null ? 'story' : 'duelpick')}>‹ Back</button><button className="kp-go" onClick={() => { sfx()?.unlock(); startDuel(intro.rival, intro.relay, intro.story, !!intro.rematch); }}>Race! ›</button></div>
        </div>
        <div className="kp-vs-side kp-vs-us"><Paint name={intro.relay ? 'enzo-drive' : 'dora-grin'} className="kp-vs-face" pos="50% 30%" /><div className="kp-vs-name"><small>{intro.relay ? 'Enzo & Dora' : 'Dora & Enzo'} · the Biscuit</small><b>{intro.relay ? 'The Bakery Relay' : 'The Bun Car'}</b></div></div>
      </div>
    </section>; })()}

    {screen === 'race' && run && <section className="kp-race" data-mode={run.mode} data-mirror={run.duel ? '1' : '0'}>
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
        <div className="kp-time"><small>{run.mode === 'demo' ? 'Enzo\'s line · demo' : run.mode === 'delivery' ? (run.weather ? `Delivery · ${G.WEATHER[run.weather].icon} ${G.WEATHER[run.weather].name}` : 'Delivery') : run.mode === 'attack' ? (run.enzo ? 'vs Enzo\'s line' : 'Time attack') : run.job ? `${G.jobDef(run.job).icon} ${G.jobDef(run.job).name}` : run.mode === 'trial' ? 'Drift Trial' : run.mode === 'relay' ? (run.race.track.reversed ? 'Relay · uphill' : 'Relay · downhill') : `Round ${(run.duel?.round ?? 0) + 1}`}</small><b ref={H('time')}>0:00.00</b>{run.ghost && <em ref={H('delta')} />}</div>
        {run.duel && <div className="kp-gapbox"><small>{run.race.opts.role === 'lead' ? 'You lead · stay ahead' : 'You chase · stay close'}</small>
          <div className="kp-gap" ref={H('gap')}><i className="kp-gap-mark" /><span className="kp-gap-zone" /></div><b ref={H('gapText')}>side by side</b></div>}
        {run.mode === 'trial' && <div className="kp-due kp-trialbox"><small>Score · gold {G.TRIAL_GOLD[run.pass]}</small><b ref={H('tscore')}>0</b><em ref={H('tlive')} /></div>}
        {run.job === 'doctor' && <div className="kp-due"><small>Due at the inn {fmt(G.jobDeadline(run.pass))}</small><b ref={H('due')} data-late="0" /></div>}
        {run.job === 'rider' && <div className="kp-mood" ref={H('mood')}><small>Granny&rsquo;s mood</small><i /></div>}
        {(run.mode === 'delivery' || run.mode === 'demo' || run.job === 'cake') && <div className="kp-buns" ref={H('buns')} data-left={run.job === 'cake' ? 1 : 12} data-cake={run.job === 'cake' ? '1' : undefined}><small>{run.job === 'cake' ? 'Cake' : 'Buns'}</small><div className="kp-bunrow">{Array.from({ length: run.job === 'cake' ? 1 : G.BUNS }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div><div className="kp-wobble" ref={H('wobble')}><i /></div></div>}
        <div className="kp-progress" ref={H('progress')}><i /></div>
        <canvas className="kp-minimap" ref={miniRef} width={280} height={196} aria-hidden />
      </div>
      {run.duel && <div className="kp-mirror" ref={mirrorRef} aria-hidden />}
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
        <span className="kp-eyebrow">{r.mode === 'demo' ? `Enzo's line · ${G.passDef(r.pass).name}` : r.mode === 'delivery' ? `Delivery · ${G.passDef(r.pass).name}${r.weather ? ` · ${G.WEATHER[r.weather].name}` : ''}` : r.mode === 'attack' ? `${r.enzo ? 'Enzo\'s line' : 'Time attack'} · ${G.passDef(r.pass).name}` : r.job ? `${G.jobDef(r.job).name} · ${G.passDef(r.pass).name}` : r.mode === 'trial' ? `Drift Trial · ${G.passDef(r.pass).name}` : `${r.mode === 'relay' ? 'The dawn relay' : r.rematch ? 'Rematch' : 'Duel'} · ${rv?.name}`}</span>
        <h2>{rv ? (r.win ? 'You win!' : `${rv.name} wins`) : r.mode === 'demo' ? 'That\'s the line!' : r.job ? JOB_TITLE[r.job][r.jobOk ? 1 : 0] : r.mode === 'trial' ? (r.medal ? `${MEDAL[r.medal]} trial!` : 'No medal this time') : r.enzo ? (r.time < r.enzo ? 'You beat Enzo\'s line!' : 'Enzo\'s line holds') : r.mode === 'delivery' ? (r.medal ? `${MEDAL[r.medal]} delivery!` : 'Delivered') : r.best ? 'New best!' : 'Finished'}</h2>
        {rv && <p className="kp-quote">“{r.win ? rv.lose : rv.win}”</p>}
        {rv ? <ol className="kp-rounds">{r.rounds.map((x, i) => <li key={i} data-win={x.win === null ? 'even' : x.win ? 'win' : 'lose'}><b>{x.role}</b> {x.text}</li>)}</ol>
          : <div className="kp-figures"><div><small>Time</small><b>{fmt(r.time)}</b></div>{(r.mode === 'delivery' || r.mode === 'demo') && <div><small>Buns</small><b>{r.buns}/{G.BUNS}</b></div>}{r.job === 'rider' && <div><small>Granny&rsquo;s mood</small><b>{r.mood}</b></div>}{r.mode === 'trial' && <div><small>Score</small><b>{r.score}</b></div>}<div><small>Drift points</small><b>{r.drift}</b></div><div><small>Rail hits</small><b>{r.hits}</b></div></div>}
        {r.enzo !== undefined && <p className="kp-medalline">Enzo&rsquo;s line {fmt(r.enzo)} · you {r.time < r.enzo ? `${(r.enzo - r.time).toFixed(2)} s quicker` : `${(r.time - r.enzo).toFixed(2)} s behind`}{r.best ? ' · a new best' : ''}</p>}
        {r.mode === 'trial' && <p className="kp-medalline">Gold {G.trialTargets(r.pass)[0]} (Enzo&rsquo;s line) · Silver {G.trialTargets(r.pass)[1]} · Bronze {G.trialTargets(r.pass)[2]}{r.best ? ' · a new best' : ''}</p>}
        {r.job && <p className="kp-medalline">{r.job === 'cake' ? (r.jobOk ? 'Not a crumb out of place.' : 'A careful run gets it there: ease off before the hard corners and stay off the rails.') : r.job === 'doctor' ? `Due at ${fmt(G.jobDeadline(r.pass))} · you ${r.time <= G.jobDeadline(r.pass) ? `${(G.jobDeadline(r.pass) - r.time).toFixed(1)} s early` : `${(r.time - G.jobDeadline(r.pass)).toFixed(1)} s late`}` : `She needs ${G.JOB.rider.happy} to be happy: drifts cheer her up, rails and crawling don't.`}{r.first ? ` · first time on this pass: +${G.JOB.firstBonus} bonus` : ''}</p>}
        {r.mode === 'demo' && <p className="kp-medalline">A clean run on the racing line: brake early, turn in late, no rails. Gold is {fmt(G.medalTimes(r.pass)[0])} with 11+ buns.</p>}
        {r.mode === 'delivery' && <p className="kp-medalline">{r.weather ? `${G.WEATHER[r.weather].name}: ` : ''}Gold {fmt(G.medalTimes(r.pass, r.weather)[0])} with 11+ buns · Silver {fmt(G.medalTimes(r.pass, r.weather)[1])} with 8+ · Bronze {fmt(G.medalTimes(r.pass, r.weather)[2])} with 5+{r.weather ? ` · ×${G.WEATHER[r.weather].pay} coins` : ''}</p>}
        {r.mode !== 'demo' && <p className="kp-earned">+🥐 {r.coins} bakery coins · total {s.coins}</p>}
        {r.levelTo > r.levelFrom && <p className="kp-levelup">Enzo&rsquo;s notebook for {G.passDef(r.pass).name}: <Pips level={r.levelTo} /> <b>{LEVEL_WORD[r.levelTo]}</b>. {LEVEL_HINT[r.levelTo]}</p>}
        <div className="kp-row">
          {r.story !== null && (r.win || r.mode === 'delivery') ? <button className="kp-go" onClick={() => playStory(saveRef.current.story)}>Continue story ›</button> : null}
          {r.mode === 'demo' && <button className="kp-go" onClick={() => startSolo('delivery', r.pass, null)}>Drive it yourself ›</button>}
          <button className={r.story !== null && (r.win || r.mode === 'delivery') || r.mode === 'demo' ? '' : 'kp-go'} onClick={retry}>{rv ? 'Rematch' : r.mode === 'demo' ? 'Watch again' : 'Run it again'}</button>
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
        <p>On the way home, a pearl-grey car passes the other way with its lights off.</p>
        <div className="kp-row"><button className="kp-go" onClick={() => playStory(G.STORY_END + 1)}>Follow it ›</button><button onClick={() => go('menu')}>Back to the bakery</button><a className="kp-home2" href="/">Arcade</a></div>
      </div>
    </section>}
  </main>;
}
