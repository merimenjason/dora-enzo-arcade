'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Match, DRILLS, DT, HOG, TEE, HOUSE_R, STONE_R, BACK, distanceWeight, SAVE_KEY, PLAYER_NOISE, readSave, freshSave, drillStones, drillStars, judgeSweep, scoreEnd, inHouse, speed, weightName,
  type Save, type Shot, type Drill, type IceEvent, type EndResult, type SweepPlan, type TeamId, type Stone,
} from '@/lib/curl-game';
import { TEAMS, CALLER, plan, evaluate, drillSolution, clampAim, teamById, type Team, type Plan } from '@/lib/curl-ai';
import type { CurlScene, Pose, Who } from '@/lib/curl-scene';
import { CurlSound, type SongId } from './sound';
import './curl.css';

type Screen = 'menu' | 'ladder' | 'practice' | 'play' | 'ending';
type Phase = 'intro' | 'aim' | 'think' | 'run' | 'look' | 'endcard' | 'over' | 'drilled';
type Mode = { kind: 'match'; team: Team; seed: number } | { kind: 'drill'; drill: Drill; tries: number };
const sceneModule = () => import('@/lib/curl-scene');
const SPEED = 1.8, SLOW = 0.7;
const NAMES: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo' };
const other = (w: Who): Who => (w === 'dora' ? 'enzo' : 'dora');

/** A painting with a print-style stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, className }: { src: string; paint: 'title' | 'ending'; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else m.paintEnding(c); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'ss-art ' + (className ?? '')}>
      <canvas ref={cv} width={1536} height={1024} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={1536} height={1024} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A captain's portrait, or a print-style badge if the painting is missing. */
function Captain({ team, size = 84 }: { team: Team; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="ss-cap" style={{ width: size, height: size, ['--ink' as string]: team.ink }}>
      {!bad ? <img src={`/art/curl/cap-${team.id}.webp`} alt="" width={size} height={size} onError={() => setBad(true)} /> : <b>{team.captain[0]}</b>}
    </span>
  );
}
const Stars = ({ n }: { n: number }) => <span className="ss-stars" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'is-on' : ''}>★</i>)}</span>;

export default function CurlPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const scene = useRef<CurlScene | null>(null), sound = useRef<CurlSound | null>(null);
  const save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), phaseRef = useRef<Phase>('intro');
  const mode = useRef<Mode | null>(null), match = useRef<Match | null>(null);
  const aim = useRef<Shot>({ angle: 0, weight: 0.5, curl: 1 });
  const call = useRef<Plan | null>(null), opp = useRef<Plan | null>(null), drillShot = useRef<Shot | null>(null);
  const before = useRef(0), acc = useRef(0), sim = useRef(1), brushT = useRef(0), lookT = useRef(0), timers = useRef<number[]>([]);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null), hold = useRef(false), tapUntil = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [phase, setPhaseState] = useState<Phase>('intro');
  const [endInfo, setEndInfo] = useState<{ r: EndResult; close: boolean } | null>(null), [stars, setStars] = useState(0);
  const [bubble, setBubble] = useState<{ who: 'us' | 'them'; text: string } | null>(null), [toast, setToast] = useState('');
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const S = save.current;
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)); };
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new CurlSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const song = (id: SongId) => sound.current?.music(id);
  const showToast = (t: string, ms = 2600) => { setToast(t); later(() => setToast(''), ms); };
  const poses = (d: Pose | null, e: Pose | null) => { const sc = scene.current; if (sc) sc.poses = { dora: d, enzo: e }; };

  // ---- starting things
  function startMatch(team: Team, resume = false) {
    const sc = scene.current; if (!sc) return;
    clearTimers();
    const seed = resume && S.match ? S.match.seed : (Date.now() % 100000) + 1;
    const noise: [typeof PLAYER_NOISE, typeof PLAYER_NOISE] = [PLAYER_NOISE, team.noise];
    match.current = resume && S.match ? Match.restore(S.match.snap, noise) : new Match({ ends: team.ends, seed, hammer: team.hammer ?? 0, noise });
    mode.current = { kind: 'match', team, seed };
    S.match = { team: team.id, seed, snap: match.current.snapshot() }; persist();
    sc.captain = team.id; sc.capInk = team.ink; sc.stones = match.current.stones; sc.current = null; sc.counting = []; sc.measure = null; sc.setAim(null); sc.broom = null; sc.clearTrail();
    sc.view = 'aim'; sc.snapCamera(); poses('sweep', 'sweep');
    setEndInfo(null); setScreen('play'); song(team.id === 'stoat' ? 'final' : 'match');
    if (resume) { setBubble(null); nextTurn(); } else { setPhase('intro'); setBubble({ who: 'them', text: team.hello }); }
    requestAnimationFrame(() => { sc.resize(); sc.snapCamera(); });
  }
  function startDrill(d: Drill) {
    const sc = scene.current; if (!sc) return;
    clearTimers();
    const prev = mode.current, tries = prev && prev.kind === 'drill' && prev.drill.id === d.id ? prev.tries + 1 : 0;
    mode.current = { kind: 'drill', drill: d, tries };
    const m = new Match({ ends: 1, seed: 4242 + tries * 31 + DRILLS.indexOf(d), hammer: 0, noise: [PLAYER_NOISE, PLAYER_NOISE] });
    m.stones = drillStones(d); m.thrown = 7; match.current = m;
    sc.captain = null; sc.stones = m.stones; sc.current = null; sc.counting = []; sc.measure = null; sc.clearTrail(); sc.view = 'aim'; sc.snapCamera();
    drillShot.current ??= null; drillShot.current = drillSolution(d);
    setEndInfo(null); setStars(0); setScreen('play'); song('practice');
    if (!S.tips.includes('drill-' + d.id)) { S.tips.push('drill-' + d.id); persist(); }
    ourTurn();
    requestAnimationFrame(() => { sc.resize(); sc.snapCamera(); });
  }

  /** Whose turn: ours (aim) or theirs (think, then throw). */
  function nextTurn() {
    const m = match.current, sc = scene.current; if (!m || !sc) return;
    sc.stones = m.stones; sc.counting = []; sc.measure = null;
    if (m.turn === 0) ourTurn(); else theirTurn();
  }
  function ourTurn() {
    const m = match.current, sc = scene.current, md = mode.current; if (!m || !sc || !md) return;
    const who = (md.kind === 'drill' ? (md.tries % 2 ? 'enzo' : 'dora') : m.thrower()) as Who, mate = other(who);
    poses('throw', 'throw'); poses(who === 'dora' ? 'throw' : 'sweep', who === 'enzo' ? 'throw' : 'sweep');
    sc.view = 'aim'; sc.current = null; sc.sweeper = null; sc.clearTrail();
    setPhase('think');
    if (md.kind === 'drill') {
      const s = drillShot.current!; call.current = { shot: s, sweep: null, kind: 'draw', call: md.drill.call, target: { x: TEE, y: 0 }, value: 0 };
      aim.current = { ...aim.current, curl: s.curl };
      sc.broom = { ...brm(s), who: mate }; sc.setAim(aim.current); setBubble({ who: 'us', text: `${NAMES[mate]}: “${md.drill.call}.”` });
      setPhase('aim'); refresh(); return;
    }
    // the teammate thinks about the shot (a moment, so the screen can paint first)
    later(() => {
      const p = plan(m, 0, CALLER, PLAYER_NOISE, m.end * 16 + m.thrown + 7);
      call.current = p; aim.current = { ...aim.current, curl: p.shot.curl };
      if (m.thrown < 2 && m.end === 0) aim.current = { ...aim.current, angle: p.shot.angle * 0.6, weight: Math.min(0.62, p.shot.weight) };
      sc.broom = { ...brm(p.shot), who: mate }; sc.setAim(aim.current);
      setBubble({ who: 'us', text: `${NAMES[mate]}: “${p.call}, ${p.shot.curl > 0 ? 'curling left' : 'curling right'}.”` });
      setPhase('aim'); refresh();
    }, 60);
  }
  const brm = (s: Shot) => ({ x: TEE, y: Math.tan(s.angle) * TEE });
  function theirTurn() {
    const m = match.current, sc = scene.current, md = mode.current; if (!m || !sc || !md || md.kind !== 'match') return;
    sc.setAim(null); sc.broom = null; sc.view = 'aim'; sc.current = null; sc.clearTrail(); poses('sweep', 'sweep');
    setPhase('think');
    later(() => {
      const p = plan(m, 1, md.team.brain, md.team.noise, md.seed * 977 + m.end * 16 + m.thrown);
      opp.current = p; sc.capBounce = 0.6;
      setBubble({ who: 'them', text: `${md.team.captain}: “${p.call}.”` });
      later(() => throwNow(p.shot, p.sweep), 1300 / sim.current);
    }, 120);
  }

  /** Delivers the stone (ours from the aim, or theirs from their plan). */
  function throwNow(shot: Shot, oppSweep: SweepPlan = null) {
    const m = match.current, sc = scene.current, md = mode.current; if (!m || !sc || !md) return;
    if (phaseRef.current !== 'aim' && phaseRef.current !== 'think') return;
    const ours = m.turn === 0 || md.kind === 'drill';
    before.current = evaluate(m.stones, 0, 8 - m.thrown, m.hammer);
    const s = m.throwStone(shot);
    if (md.kind === 'drill') { s.thrower = md.tries % 2 ? 'enzo' : 'dora'; }
    opp.current = ours ? null : opp.current; if (!ours) opp.current = { ...(opp.current as Plan), sweep: oppSweep };
    sc.stones = m.stones; sc.current = s; sc.setAim(null); sc.broom = null; sc.clearTrail();
    sc.sweeper = ours ? other(s.thrower as Who) : 'opp';
    sc.slow = md.kind === 'match' && m.lastOfEnd;
    sc.view = 'follow';
    if (ours) { const who = s.thrower as Who; poses(who === 'dora' ? 'throw' : null, who === 'enzo' ? 'throw' : null); }
    acc.current = 0; hold.current = false; tapUntil.current = 0;
    setPhase('run'); setBubble(ours ? { who: 'us', text: touch ? 'Hold or tap fast to sweep!' : 'Hold Space or the mouse to sweep!' } : null);
    audio().tick2();
  }
  function sweepingNow() {
    const m = match.current, md = mode.current; if (!m || !m.current) return false;
    if (m.turn === 1 && md?.kind === 'match') return judgeSweep(m.current, opp.current?.sweep ?? null);
    return hold.current || performance.now() < tapUntil.current;
  }

  /** Everything has stopped: reactions, then the next stone or the end's score. */
  function settleThrow() {
    const m = match.current, sc = scene.current, md = mode.current; if (!m || !sc || !md) return;
    const thrown = m.current!, ours = thrown.team === 0;
    const { ev, end } = m.finishThrow();
    for (const e of ev) if (e.kind === 'out' && e.why === 'hog') showToast(ours ? 'Hogged! It didn’t reach the far hog line.' : 'Their stone was short of the hog line.');
    sc.sweeper = null; sc.slow = false; sound.current?.slide(0);
    if (md.kind === 'drill') {
      const n = drillStars(md.drill, m.stones, thrown);
      if (n > (S.drills[md.drill.id] ?? 0)) { S.drills[md.drill.id] = n; persist(); }
      setStars(n); sc.view = 'house';
      const who = thrown.thrower as Who; n >= 2 ? (poses('cheer', 'cheer'), sound.current?.cheer(n === 3), sc.cheer()) : (poses(who === 'dora' ? 'groan' : 'sweep', who === 'enzo' ? 'groan' : 'sweep'), n === 0 && sound.current?.groan());
      setBubble(null); later(() => setPhase('drilled'), 900); setPhase('look'); return;
    }
    const after = evaluate(m.stones, 0, 8 - m.thrown, m.hammer), gain = after - before.current;
    const good = ours ? gain > 0.05 : gain > -0.05;
    if (good) { poses('cheer', 'cheer'); if (Math.abs(gain) > 0.6 || (ours && gain > 0.35)) { sound.current?.cheer(Math.abs(gain) > 0.9); sc.cheer(); } }
    else { poses('groan', 'groan'); if (ours) sound.current?.groan(); }
    if (!ours) sc.capBounce = good ? 0 : 0.8;
    sc.view = 'house'; setBubble(null);
    if (md.kind === 'match') { if (!m.over) S.match = { team: md.team.id, seed: md.seed, snap: m.snapshot() }; persist(); }
    setPhase('look');
    if (end) {
      const sc2 = scoreEnd(m.stones), close = sc2.best[0] < 9 && sc2.best[1] < 9 && Math.abs(sc2.best[0] - sc2.best[1]) < 0.3;
      sc.counting = sc2.counting;
      if (close) {
        const pick = (t: TeamId) => m.stones.filter((s) => !s.out && s.team === t && inHouse(s)).sort((a, b) => Math.hypot(a.x - TEE, a.y) - Math.hypot(b.x - TEE, b.y))[0];
        const a = pick(0), b = pick(1);
        if (a && b) later(() => { sc.measure = { a: { x: a.x, y: a.y, team: 0 }, b: { x: b.x, y: b.y, team: 1 }, t: 0 }; sound.current?.measure(); }, 700);
      }
      later(() => {
        setEndInfo({ r: end, close }); setPhase(m.over ? 'over' : 'endcard');
        if (end.scorer !== null) { sound.current?.points(end.points, end.scorer === 0); if (end.scorer === 0) { poses('cheer', 'cheer'); sc.cheer(); sound.current?.cheer(end.points >= 2); } else poses('groan', 'groan'); }
        if (m.over) finishMatch();
      }, close ? 2600 : 1300);
    } else later(() => { if (phaseRef.current === 'look') nextTurn(); }, 1400 / sim.current);
  }
  function finishMatch() {
    const m = match.current, md = mode.current; if (!m || !md || md.kind !== 'match') return;
    const won = m.winner === 0, i = TEAMS.indexOf(md.team);
    S.match = null;
    if (won) { S.wins[md.team.id] = (S.wins[md.team.id] ?? 0) + 1; S.best[md.team.id] = Math.max(S.best[md.team.id] ?? -99, m.score[0] - m.score[1]); if (S.beaten === i) S.beaten = i + 1; }
    persist();
    if (won) { sound.current?.fanfare(); scene.current?.cheer(); poses('cheer', 'cheer'); } else poses('groan', 'groan');
  }
  function afterEnd() {
    const m = match.current, sc = scene.current; if (!m || !sc) return; audio().ui();
    if (m.over) return;
    m.nextEnd(); sc.stones = m.stones; sc.counting = []; sc.measure = null; setEndInfo(null);
    if (mode.current?.kind === 'match') { S.match = { team: mode.current.team.id, seed: mode.current.seed, snap: m.snapshot() }; persist(); }
    nextTurn();
  }
  function afterMatch(kind: 'next' | 'again' | 'ladder') {
    const md = mode.current; if (!md || md.kind !== 'match') return; audio().ui();
    const won = match.current?.winner === 0, i = TEAMS.indexOf(md.team);
    if (won && i === TEAMS.length - 1 && !S.ended) { S.ended = true; persist(); setScreen('ending'); song('ending'); sound.current?.fanfare(); return; }
    if (kind === 'again') { startMatch(md.team); return; }
    if (kind === 'next' && won && i + 1 < TEAMS.length) { startMatch(TEAMS[i + 1]); return; }
    setScreen('ladder'); song('menu');
  }

  // ---- mount: the save, the scene, the loop, the hooks for tests
  useEffect(() => {
    let raw: string | null = null; try { raw = localStorage.getItem(SAVE_KEY); } catch { /* none */ }
    save.current = readSave(raw, TEAMS.map((t) => t.id));
    setTouch(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const o = () => setOrient(innerHeight > innerWidth * 1.05 ? 'tall' : 'wide'); o(); addEventListener('resize', o);
    setMounted(true);
    let raf = 0, dead = false, last = performance.now();
    sceneModule().then((mod) => {
      if (dead || !canvas.current) return;
      try { scene.current = new mod.CurlScene(canvas.current); mod.preload(TEAMS.map((t) => t.id)); } catch { setError('This browser cannot draw the ice.'); return; }
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const sc = scene.current, m = match.current;
        if (screenRef.current === 'play' && sc) {
          if (phaseRef.current === 'run' && m && m.current) {
            const slow = sc.slow && m.current.x > HOG - 1 && speed(m.current) < 1.6;
            acc.current += dt * (slow ? SLOW : SPEED) * sim.current;
            const ev: IceEvent[] = []; let sw = false, guard = 0;
            while (acc.current >= DT && guard++ < 4000) { sw = sweepingNow(); m.tick(sw, ev); acc.current -= DT; if (!m.running) break; }
            sc.sweeping = sw;
            for (const e of ev) { if (e.kind === 'hit') { sc.hit(e.x, e.y, e.speed); sound.current?.clack(e.speed); } if (e.kind === 'out' && e.why !== 'hog') sound.current?.thud(); }
            sound.current?.slide(Math.max(0, ...m.stones.filter((s) => !s.out).map(speed)));
            if (sw && now - brushT.current > 150) { brushT.current = now; sound.current?.brush(m.turn === 0 || mode.current?.kind === 'drill'); }
            if (!m.running) { sc.sweeping = false; settleThrow(); }
          }
          sc.frame(dt);
        }
        sound.current?.tick(true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setReady(true);
    }).catch(() => setError('The ice did not load. Try reloading the page.'));
    const ro = new ResizeObserver(() => scene.current?.resize()); if (stage.current) ro.observe(stage.current);
    const hide = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', hide);
    const w = window as unknown as Record<string, unknown>;
    w.__curl = () => {
      const m = match.current, md = mode.current, c = call.current;
      return {
        screen: screenRef.current, phase: phaseRef.current, mode: md?.kind ?? null, team: md?.kind === 'match' ? md.team.id : null, drill: md?.kind === 'drill' ? md.drill.id : null,
        end: m?.end ?? 0, ends: m?.ends ?? 0, thrown: m?.thrown ?? 0, turn: m?.turn ?? null, score: m ? [...m.score] : [0, 0], hammer: m?.hammer ?? null, over: m?.over ?? false, winner: m?.winner ?? null,
        stones: m ? m.stones.map((s: Stone) => ({ id: s.id, team: s.team, x: s.x, y: s.y, out: s.out, moving: s.moving })) : [],
        aim: { ...aim.current }, call: c ? { text: c.call, kind: c.kind, shot: c.shot } : null, sweeping: scene.current?.sweeping ?? false, view: scene.current?.view ?? null, save: save.current,
      };
    };
    /** The scene's layout for the framing checks: the ice band, the house, and where Dora, Enzo and the captain stand. */
    w.__curlScene = () => { const sc = scene.current; if (!sc) return null; const L = sc.layout; return { W: sc.W, H: sc.H, tall: L.tall, band: L.band, crowd: L.crowd, dora: L.dora, enzo: L.enzo, cap: L.cap, captain: sc.captain, poses: sc.poses, house: sc.house(), scale: sc.scale, settled: sc.settled(), stone0: sc.toScreen(0, 0) }; };
    /** Page coordinates of a point on the ice. */
    w.__curlPoint = (x: number, y: number) => { const sc = scene.current, c = canvas.current; if (!sc || !c) return null; const r = c.getBoundingClientRect(), p = sc.toScreen(x, y); return [r.left + p.x, r.top + p.y]; };
    /** Runs the ice faster (for the tests). */
    w.__curlSpeed = (k: number) => { sim.current = Math.max(0.2, Math.min(40, k)); };
    /** Sets the aim directly (as the keys would), and optionally throws. */
    w.__curlAim = (s: Partial<Shot>, go = false) => { aim.current = { ...aim.current, ...s }; scene.current?.setAim(aim.current); refresh(); if (go) throwRef.current?.(); };
    /** Ends the match at once with a winner (for the ending test). */
    w.__curlFinish = (winner: TeamId) => finishRef.current?.(winner);
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', o); document.removeEventListener('visibilitychange', hide); clearTimers(); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => { const sc = scene.current; if (!sc) return; sc.bottomPad = orient === 'tall' ? 92 : 0; sc.resize(); }); }, [screen, orient, touch, phase]);
  const throwRef = useRef<() => void>(null);
  const finishRef = useRef<(w: TeamId) => void>(null);
  finishRef.current = (w: TeamId) => {
    const m = match.current; if (!m || mode.current?.kind !== 'match') return;
    clearTimers(); m.score = w === 0 ? [m.score[1] + 2, m.score[1]] : [m.score[0], m.score[0] + 2]; m.over = true; m.winner = w; m.current = null;
    const r: EndResult = { scorer: w, points: 2, hammer: m.hammer, blank: false, tie: false };
    setEndInfo({ r, close: false }); setPhase('over'); finishMatch();
  };
  throwRef.current = () => { if (phaseRef.current === 'aim') { audio(); throwNow({ ...aim.current }); } };

  const setAim = (s: Partial<Shot>) => { const a = { ...aim.current, ...s }; a.angle = clampAim(a.angle); a.weight = Math.max(0, Math.min(1, a.weight)); aim.current = a; scene.current?.setAim(a); refresh(); };
  const flipCurl = () => { setAim({ curl: aim.current.curl > 0 ? -1 : 1 }); sound.current?.ui(); };

  // ---- keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (screenRef.current !== 'play') { if (e.key === 'Escape' && screenRef.current !== 'menu') { setScreen('menu'); song('menu'); } return; }
      const p = phaseRef.current, k = e.key.toLowerCase(), tall = scene.current?.layout.tall ?? false;
      if (p === 'run') { if (k === ' ' || k === 'enter') { e.preventDefault(); if (!e.repeat) audio(); hold.current = true; } return; }
      if (p === 'intro' && (k === 'enter' || k === ' ')) { e.preventDefault(); audio().ui(); setBubble(null); nextTurn(); return; }
      if (p === 'endcard' && k === 'enter') { e.preventDefault(); afterEnd(); return; }
      if (p === 'drilled' && k === 'enter') { e.preventDefault(); const md = mode.current; if (md?.kind === 'drill') startDrill(md.drill); return; }
      if (k === 'escape') { e.preventDefault(); leave(); return; }
      if (p !== 'aim') return;
      audio();
      const fine = e.shiftKey ? 0.4 : 1, line = (d: number) => setAim({ angle: aim.current.angle + d * 0.0025 * fine }), wt = (d: number) => setAim({ weight: aim.current.weight + d * 0.006 * fine });
      const lineKeys: Record<string, number> = tall ? { arrowleft: 1, arrowright: -1, a: 1, d: -1 } : { arrowup: 1, arrowdown: -1, w: 1, s: -1 };
      const weightKeys: Record<string, number> = tall ? { arrowup: 1, arrowdown: -1, w: 1, s: -1 } : { arrowright: 1, arrowleft: -1, d: 1, a: -1 };
      if (k in lineKeys) { e.preventDefault(); line(lineKeys[k]); }
      else if (k in weightKeys) { e.preventDefault(); wt(weightKeys[k]); }
      else if (k === 'c' || k === 'tab') { e.preventDefault(); flipCurl(); }
      else if (k === ' ' || k === 'enter') { e.preventDefault(); throwRef.current?.(); }
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') hold.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  });

  // ---- pointer: pull back to aim and set the weight, let go to throw; hold (or tap fast) to sweep
  const local = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const pullScale = () => { const sc = scene.current; return sc ? Math.min(300, Math.max(130, Math.min(sc.W, sc.H) * 0.36)) : 220; };
  function onDown(e: React.PointerEvent) {
    if (screenRef.current !== 'play') return;
    audio(); const p = local(e), ph = phaseRef.current;
    if (ph === 'run') { hold.current = true; tapUntil.current = performance.now() + 380; try { canvas.current?.setPointerCapture(e.pointerId); } catch { /* fine */ } return; }
    if (ph !== 'aim') return;
    drag.current = { id: e.pointerId, x: p.x, y: p.y, moved: false };
    try { canvas.current?.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current, sc = scene.current; if (!d || d.id !== e.pointerId || !sc || phaseRef.current !== 'aim') return;
    const p = local(e), dx = p.x - d.x, dy = p.y - d.y, len = Math.hypot(dx, dy);
    if (len < 10) return;
    const v = sc.dragToWorld(-dx, -dy); if (v.x <= 0) return;
    if (!d.moved) sound.current?.tick2();
    d.moved = true;
    setAim({ angle: 0.5 * Math.atan2(v.y, v.x), weight: Math.min(1, len / pullScale()) });
  }
  function onUp(e: React.PointerEvent) {
    hold.current = false;
    const d = drag.current; drag.current = null;
    if (!d || d.id !== e.pointerId || phaseRef.current !== 'aim') return;
    const p = local(e), len = Math.hypot(p.x - d.x, p.y - d.y);
    if (d.moved && len > pullScale() * 0.12) throwRef.current?.();
  }
  function leave() { clearTimers(); sound.current?.slide(0); const md = mode.current; setBubble(null); if (md?.kind === 'drill') { setScreen('practice'); } else { setScreen('ladder'); } song('menu'); }

  const toggle = (k: 'sound' | 'music') => { S.settings[k] = !S.settings[k]; persist(); const s = audio(); if (k === 'sound') s.setSound(S.settings.sound); else s.setMusic(S.settings.music); refresh(); };
  const Toggles = () => (
    <span className="ss-toggles">
      <button type="button" className={'ss-tog' + (S.settings.sound ? ' is-on' : '')} aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>Sound</button>
      <button type="button" className={'ss-tog' + (S.settings.music ? ' is-on' : '')} aria-pressed={S.settings.music} onClick={() => toggle('music')}>Music</button>
    </span>
  );

  const m = match.current, md = mode.current, team = md?.kind === 'match' ? md.team : null;
  const resumeTeam = mounted && S.match ? teamById(S.match.team) : null, nextTeam = TEAMS[Math.min(S.beaten, TEAMS.length - 1)];
  const a = aim.current, wName = weightName(a.weight), sugg = call.current?.shot;
  const drillsDone = DRILLS.reduce((n, d) => n + (S.drills[d.id] ?? 0), 0);
  const ourStonesLeft = m ? 4 - m.stones.filter((s) => s.team === 0).length : 0;
  return (
    <main className="ss-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={phase} data-touch={touch ? orient : undefined} data-orient={orient}>
      {screen === 'menu' && (
        <section className="ss-menu">
          <Art src="/art/curl/title.webp" paint="title" className="ss-menu-art" />
          <div className="ss-menu-card">
            <p className="ss-eyebrow">THE WINTER PEBBLE CUP · A CURLING GAME</p>
            <h1>Sweep <span>&amp;</span> Slide</h1>
            <p className="ss-lede">The millpond has frozen and the woodland teams are on the ice. Slide your polished river stones into the rings, sweep them home, and take the Pebble Cup from the stoat champions.</p>
            <div className="ss-menu-buttons">
              {resumeTeam && <button type="button" className="ss-primary" disabled={!ready} onClick={() => { audio().ui(); startMatch(resumeTeam, true); }}>Carry on · vs {resumeTeam.name.replace('The ', '')}</button>}
              <button type="button" className={resumeTeam ? '' : 'ss-primary'} disabled={!ready} onClick={() => { audio().ui(); setScreen('ladder'); song('menu'); }}>{S.beaten ? 'The Cup ladder' : 'Play the Cup'} · {mounted ? S.beaten : 0}/8</button>
              <button type="button" disabled={!ready} onClick={() => { audio().ui(); setScreen('practice'); song('practice'); }}>Practice Pond · {mounted ? drillsDone : 0}/15 ★</button>
              {mounted && S.ended && <button type="button" onClick={() => { audio().ui(); setScreen('ending'); song('ending'); }}>The Cup night</button>}
            </div>
            <div className="ss-menu-foot"><a className="ss-back" href="/">← MAIN ARCADE</a><Toggles /></div>
          </div>
        </section>
      )}

      {screen === 'ladder' && (
        <section className="ss-list">
          <header className="ss-bar">
            <button type="button" className="ss-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button>
            <span className="ss-bar-mid">The Pebble Cup · {S.beaten} of 8 beaten</span>
            <Toggles />
          </header>
          <p className="ss-blurb">Beat each team to meet the next. Four ends a match, six in the final. You have the hammer (the last stone) in the first end, except against the champions.</p>
          <div className="ss-cards">
            {TEAMS.map((t, i) => {
              const open = i <= S.beaten, won = S.wins[t.id] ?? 0;
              return (
                <button type="button" key={t.id} className={'ss-team' + (won ? ' is-won' : '') + (i === TEAMS.length - 1 ? ' is-final' : '')} disabled={!open} onClick={() => { audio().ui(); startMatch(t); }}>
                  <span className="ss-round">{i === TEAMS.length - 1 ? 'FINAL' : `ROUND ${i + 1}`}</span>
                  {open ? <Captain team={t} size={76} /> : <span className="ss-lock">🔒</span>}
                  <span className="ss-team-name">{t.name}</span>
                  <span className="ss-team-blurb">{open ? t.blurb : 'Beat the team before to meet them.'}</span>
                  <span className="ss-team-foot">{won ? `Won ${won}${S.best[t.id] ? ` · best by ${S.best[t.id]}` : ''}` : open ? `${t.ends} ends · captain ${t.captain}` : ''}</span>
                </button>
              );
            })}
          </div>
          <p className="ss-blurb"><button type="button" className="ss-link" onClick={() => { audio().ui(); setScreen('practice'); song('practice'); }}>New to curling? Try the Practice Pond first →</button></p>
        </section>
      )}

      {screen === 'practice' && (
        <section className="ss-list">
          <header className="ss-bar">
            <button type="button" className="ss-back" onClick={() => { audio().ui(); setScreen('menu'); song('menu'); }}>← MENU</button>
            <span className="ss-bar-mid">Practice Pond · {drillsDone}/15 ★</span>
            <Toggles />
          </header>
          <p className="ss-blurb">A calm corner of the pond to learn each shot. Pull back from the stone to aim and set the weight, choose the curl, let go, then sweep. Three stars for each shot.</p>
          <div className="ss-cards ss-drills">
            {DRILLS.map((d, i) => (
              <button type="button" key={d.id} className="ss-drill" onClick={() => { audio().ui(); mode.current = null; startDrill(d); }}>
                <span className="ss-round">SHOT {i + 1}</span>
                <span className="ss-team-name">{d.name}</span>
                <span className="ss-team-blurb">{d.teach}</span>
                <Stars n={S.drills[d.id] ?? 0} />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={'ss-stage' + (screen === 'play' ? '' : ' is-hidden')} ref={stage}>
        {screen === 'play' && (
          <header className="ss-bar ss-play-bar">
            <button type="button" className="ss-back" onClick={() => { audio().ui(); leave(); }}>← {md?.kind === 'drill' ? 'POND' : 'LADDER'}</button>
            {team && m ? (
              <span className="ss-board" aria-label="Scoreboard">
                <span className="ss-row us"><b>Dora &amp; Enzo</b>{m.hammer === 0 && <i className="ss-hammer" title="Hammer: the last stone">◆</i>}<em>{m.score[0]}</em></span>
                <span className="ss-ends">{Array.from({ length: Math.max(m.ends, m.end + (m.over ? 0 : 1)) }, (_, i) => { const r = m.results[i]; return <span key={i} className={'ss-end' + (i === m.end && !m.over ? ' is-now' : '')}><small>{i < m.ends ? i + 1 : 'X'}</small><u className="us">{r && r.scorer === 0 ? r.points : r ? '·' : ''}</u><u className="them">{r && r.scorer === 1 ? r.points : r ? '·' : ''}</u></span>; })}</span>
                <span className="ss-row them"><b>{team.name.replace('The ', '')}</b>{m.hammer === 1 && <i className="ss-hammer" title="Hammer: the last stone">◆</i>}<em>{m.score[1]}</em></span>
              </span>
            ) : md?.kind === 'drill' ? <span className="ss-bar-mid">Practice · {md.drill.name} <Stars n={S.drills[md.drill.id] ?? 0} /></span> : <span className="ss-bar-mid" />}
            <Toggles />
          </header>
        )}
        {screen === 'play' && m && team && <p className="ss-stones">End {Math.min(m.end + 1, m.ends)}{m.end >= m.ends ? ' (extra)' : ''} of {m.ends} · stone {Math.min(8, m.thrown + 1)} of 8 · {Math.max(0, ourStonesLeft)} of ours left</p>}
        <canvas ref={canvas} className="ss-canvas" tabIndex={0} aria-label="The curling sheet"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; hold.current = false; }} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && bubble && <p className={'ss-bubble ' + bubble.who} role="status">{bubble.text}</p>}
        {screen === 'play' && toast && <p className="ss-toast" role="status">{toast}</p>}
        {screen === 'play' && phase === 'aim' && (
          <div className="ss-controls">
            <div className="ss-curl" role="group" aria-label="Curl">
              <button type="button" className={a.curl > 0 ? 'is-on' : ''} aria-pressed={a.curl > 0} onClick={() => { if (a.curl < 0) flipCurl(); }}>↺ Curl left</button>
              <button type="button" className={a.curl < 0 ? 'is-on' : ''} aria-pressed={a.curl < 0} onClick={() => { if (a.curl > 0) flipCurl(); }}>Curl right ↻</button>
            </div>
            <div className="ss-weight" aria-label={`Weight: ${wName}`}>
              <span className="ss-wbar">
                <i className="z-guard" style={{ left: `${zone(Z_GUARD)}%`, width: `${zone(Z_DRAW) - zone(Z_GUARD)}%` }} />
                <i className="z-draw" style={{ left: `${zone(Z_DRAW)}%`, width: `${zone(Z_HIT) - zone(Z_DRAW)}%` }} />
                <i className="z-hit" style={{ left: `${zone(Z_HIT)}%`, width: `${100 - zone(Z_HIT)}%` }} />
                {sugg && <b className="ss-want" style={{ left: `${sugg.weight * 100}%` }} title="Your teammate’s weight" />}
                <em style={{ left: `${a.weight * 100}%` }} />
              </span>
              <span className="ss-wname"><b>{wName}</b> weight</span>
            </div>
            <button type="button" className="ss-primary ss-throw" onClick={() => throwRef.current?.()}>Throw</button>
            {!touch && <p className="ss-keys">Pull back on the ice to aim · <kbd>{orient === 'tall' ? '←→' : '↑↓'}</kbd> line · <kbd>{orient === 'tall' ? '↑↓' : '←→'}</kbd> weight · <kbd>C</kbd> curl · <kbd>Space</kbd> throw, then hold to sweep</p>}
          </div>
        )}
        {screen === 'play' && phase === 'run' && (m?.turn === 0 || md?.kind === 'drill') && touch && (
          <button type="button" className="ss-sweep" onPointerDown={(e) => { e.preventDefault(); hold.current = true; tapUntil.current = performance.now() + 380; }} onPointerUp={() => { hold.current = false; }} onPointerCancel={() => { hold.current = false; }}>Sweep!</button>
        )}
        {screen === 'play' && phase === 'intro' && team && (
          <div className="ss-modal" role="dialog" aria-label={team.name}>
            <div className="ss-card">
              <Captain team={team} size={120} />
              <p className="ss-eyebrow">{TEAMS.indexOf(team) === TEAMS.length - 1 ? 'THE FINAL' : `ROUND ${TEAMS.indexOf(team) + 1} OF 8`}</p>
              <h2>{team.name}</h2>
              <p>{team.blurb}</p>
              <p className="ss-note">{team.ends} ends · {(team.hammer ?? 0) === 0 ? 'you have the hammer in the first end' : 'they have the hammer in the first end'}</p>
              <button type="button" className="ss-primary" autoFocus onClick={() => { audio().ui(); setBubble(null); nextTurn(); }}>To the ice</button>
            </div>
          </div>
        )}
        {screen === 'play' && (phase === 'endcard' || phase === 'over') && endInfo && m && team && (
          <div className="ss-modal" role="dialog" aria-label="End result">
            <div className={'ss-card' + (phase === 'over' ? ' is-over' : '')}>
              {phase === 'over' ? (
                <>
                  <p className="ss-eyebrow">{m.winner === 0 ? 'MATCH WON' : 'MATCH LOST'}</p>
                  <h2>{m.winner === 0 ? (TEAMS.indexOf(team) === TEAMS.length - 1 ? 'The Pebble Cup is yours!' : `You beat ${team.name.replace('The ', 'the ')}!`) : `${team.name} win`}</h2>
                  <p className="ss-big">{m.score[0]} – {m.score[1]}</p>
                  <p>{team.captain}: “{m.winner === 0 ? team.lose : team.win}”</p>
                </>
              ) : (
                <>
                  <p className="ss-eyebrow">END {m.end}{endInfo.close ? ' · MEASURED' : ''}</p>
                  <h2>{endInfo.r.tie ? 'A measured tie: no score' : endInfo.r.blank ? 'A blank end' : endInfo.r.scorer === 0 ? `Dora & Enzo score ${endInfo.r.points}` : `${team.name.replace('The ', '')} score ${endInfo.r.points}`}</h2>
                  <p className="ss-big">{m.score[0]} – {m.score[1]}</p>
                  <p className="ss-note">{endInfo.r.blank || endInfo.r.tie ? `${m.hammer === 0 ? 'You keep' : 'They keep'} the hammer.` : `${m.hammer === 0 ? 'You have' : 'They have'} the hammer next end.`}{m.end >= m.ends ? ' Level after the last end: an extra end decides it.' : ''}</p>
                </>
              )}
              <div className="ss-buttons">
                {phase === 'over' ? (
                  <>
                    <button type="button" className="ss-primary" autoFocus onClick={() => afterMatch('next')}>{m.winner === 0 ? (TEAMS.indexOf(team) === TEAMS.length - 1 ? (S.ended ? 'The ladder' : 'Lift the Cup') : 'Next team') : 'Try again'}</button>
                    {m.winner === 0 && <button type="button" onClick={() => afterMatch('again')}>Play them again</button>}
                    {m.winner !== 0 ? <button type="button" onClick={() => afterMatch('ladder')}>The ladder</button> : null}
                  </>
                ) : <button type="button" className="ss-primary" autoFocus onClick={afterEnd}>Next end</button>}
              </div>
            </div>
          </div>
        )}
        {screen === 'play' && phase === 'drilled' && md?.kind === 'drill' && (
          <div className="ss-modal ss-modal-low" role="dialog" aria-label="Drill result">
            <div className="ss-card ss-card-small">
              <Stars n={stars} />
              <h2>{stars === 3 ? 'Perfect!' : stars === 2 ? 'Nicely done!' : stars === 1 ? 'Getting there' : 'Not this time'}</h2>
              <p className="ss-note">{md.drill.stars.map((t, i) => `${i < stars ? '★' : '☆'} ${t}`).join(' · ')}</p>
              <div className="ss-buttons">
                <button type="button" className="ss-primary" autoFocus onClick={() => { audio().ui(); startDrill(md.drill); }}>Throw again</button>
                {DRILLS.indexOf(md.drill) < DRILLS.length - 1 && <button type="button" onClick={() => { audio().ui(); mode.current = null; startDrill(DRILLS[DRILLS.indexOf(md.drill) + 1]); }}>Next shot</button>}
                <button type="button" onClick={() => { audio().ui(); leave(); }}>The pond</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {screen === 'ending' && (
        <section className="ss-ending">
          <Art src="/art/curl/ending.webp" paint="ending" className="ss-ending-art" />
          <div className="ss-ending-card">
            <p className="ss-eyebrow">CUP NIGHT ON THE MILLPOND</p>
            <h2>The Pebble Cup</h2>
            <p>Lanterns swing over the ice and the whole wood is on the bank. Dora and Enzo lift the silver cup together, scarves flying, while the stoats clap politely and the hedgehog twins cheer loudest of all.</p>
            <p className="ss-note">{Object.values(S.wins).reduce((n, v) => n + v, 0)} matches won · {drillsDone}/15 practice stars</p>
            <div className="ss-menu-buttons">
              <button type="button" className="ss-primary" onClick={() => { audio().ui(); setScreen('ladder'); song('menu'); }}>The ladder</button>
              <button type="button" onClick={() => { audio().ui(); setScreen('menu'); song('menu'); }}>The menu</button>
            </div>
          </div>
        </section>
      )}
      {error && <p className="ss-error">{error}</p>}
    </main>
  );
}
const zone = (w: number) => Math.max(0, Math.min(100, w * 100));
const Z_GUARD = distanceWeight(HOG + STONE_R), Z_DRAW = distanceWeight(TEE - HOUSE_R - STONE_R), Z_HIT = distanceWeight(BACK + STONE_R);
