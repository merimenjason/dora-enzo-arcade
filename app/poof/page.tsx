/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation frame. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Match, Endless, Drill, Brain, Pad, RIVALS, RIVAL, HEROES, LESSONS, TPS, MARGIN, harder, goalText,
  type Board, type Ev, type HeroId, type Rival, type Lesson,
} from '../../lib/poof-panic-game';
import { Stage, drawPoof, drawRival, drawHero, type View } from '../../lib/poof-panic-scene';
import { cue, setMuted } from './sound';
import './poof.css';

const SAVE_KEY = 'poof-panic-v1';
type Climb = { hero: HeroId; hard: boolean; rung: number; score: number; losses: number; secs: number };
type Save = {
  muted: boolean; ghost: boolean; hero: HeroId;
  /** Per chinchilla: 0 for nothing yet, 1 once the ladder is climbed, 2 once the hard ladder is. */
  cleared: Record<HeroId, number>;
  /** The highest rung reached on either ladder, which is how many rivals a free match offers. */
  far: number; chain: number;
  endless: { score: number; chain: number; level: number };
  lessons: string[]; climb: Climb | null;
};
const blank = (): Save => ({ muted: false, ghost: true, hero: 'dora', cleared: { dora: 0, enzo: 0 }, far: 0, chain: 0, endless: { score: 0, chain: 0, level: 0 }, lessons: [], climb: null });
const int = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
function readSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}'), k = raw.climb;
    return {
      muted: !!raw.muted, ghost: raw.ghost !== false, hero: raw.hero === 'enzo' ? 'enzo' : 'dora',
      cleared: { dora: int(raw.cleared?.dora, 0, 2), enzo: int(raw.cleared?.enzo, 0, 2) }, far: int(raw.far, 0, RIVALS.length - 1), chain: int(raw.chain, 0, 99),
      endless: { score: int(raw.endless?.score, 0, 1e9), chain: int(raw.endless?.chain, 0, 99), level: int(raw.endless?.level, 0, 999) },
      lessons: Array.isArray(raw.lessons) ? LESSONS.map((l) => l.id).filter((id) => raw.lessons.includes(id)) : [],
      climb: k && typeof k === 'object' ? { hero: k.hero === 'enzo' ? 'enzo' : 'dora', hard: !!k.hard, rung: int(k.rung, 0, RIVALS.length - 1), score: int(k.score, 0, 1e9), losses: int(k.losses, 0, 9999), secs: int(k.secs, 0, 1e7) } : null,
    };
  } catch { return blank(); }
}
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, progress just isn't kept */ } };
const newSeed = () => (Date.now() % 1000000) + 1;
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

type Mode = 'ladder' | 'free' | 'endless' | 'lesson';
type Card = 'none' | 'intro' | 'paused' | 'round' | 'match' | 'done' | 'over' | 'solved' | 'missed';
type Game = {
  mode: Mode; match: Match | null; endless: Endless | null; drill: Drill | null;
  rival: Rival | null; hard: boolean; rung: number; lesson: number; wins: [number, number];
  /** Ticks of "Ready" left, ticks since the round ended, and what each board says once it has. */
  count: number; ended: number; result: [string, string] | null; warned: boolean;
};
const idle = (): Game => ({ mode: 'ladder', match: null, endless: null, drill: null, rival: null, hard: false, rung: 0, lesson: 0, wins: [0, 0], count: 0, ended: 0, result: null, warned: false });

function Poof({ colour, size = 28 }: { colour: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, size, size); drawPoof(c, colour, size); }, [colour, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
function Face({ who, size, hard }: { who: string; size: number; hard?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null), w = who === 'dora' || who === 'enzo' ? size : Math.round(size * 1.35);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(2, 0, 0, 2, 0, 0);
    if (who === 'dora' || who === 'enzo') drawHero(c, who, w, size); else drawRival(c, who, w, size, hard);
  }, [who, size, w, hard]);
  return <canvas ref={ref} width={w * 2} height={size * 2} style={{ width: w, height: size }} aria-hidden="true" />;
}

export default function PoofPanic() {
  const [save, setSave] = useState<Save>(blank);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'rivals' | 'lessons' | 'play'>('home');
  const [card, setCard] = useState<Card>('none');
  const [freeHard, setFreeHard] = useState(false);
  const [hint, setHint] = useState(false);
  const [touch, setTouch] = useState(false);
  const [, setTick] = useState(0);
  const game = useRef<Game>(idle()), stage = useRef<Stage | null>(null), pad = useRef(new Pad()), canvas = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; lastX: number; moved: boolean; soft: boolean } | null>(null);
  const saveRef = useRef(save), cardRef = useRef<Card>('none'), auto = useRef<Brain | null>(null), fast = useRef(1), climbRef = useRef<Climb | null>(null);
  saveRef.current = save;

  useEffect(() => { const s = readSave(); setSave(s); setMuted(s.muted); setTouch(window.matchMedia('(pointer: coarse)').matches); setLoaded(true); }, []);
  // The browser test reads and drives the running game through this.
  useEffect(() => {
    (window as unknown as { __poof?: () => unknown }).__poof = () => ({
      game: game.current, stage: stage.current, pad: pad.current, card: cardRef.current,
      auto: (id: string | null) => { auto.current = id ? new Brain(RIVAL[id], 9) : null; }, fast: (n: number) => { fast.current = Math.max(1, n); },
    });
  }, []);

  const refresh = () => setTick((t) => t + 1);
  const store = (next: Save) => { saveRef.current = next; setSave(next); writeSave(next); };
  const clearInput = () => { drag.current = null; pad.current.clear(); };
  const show = (c: Card) => { cardRef.current = c; setCard(c); clearInput(); };
  const hero = save.hero;

  function openMatch(mode: 'ladder' | 'free', rung: number, hard: boolean) {
    const g = game.current;
    Object.assign(g, idle(), { mode, rung, hard, rival: hard ? harder(RIVALS[rung]) : RIVALS[rung] });
    stage.current?.reset();
    if (rung > saveRef.current.far) store({ ...saveRef.current, far: rung });
    setScreen('play'); show('intro');
  }
  function startRound() {
    const g = game.current;
    if (!g.rival) return;
    g.match = new Match({ seed: newSeed(), rival: g.rival, hero: saveRef.current.hero });
    g.count = 70; g.ended = 0; g.result = null; g.warned = false;
    stage.current?.reset(); cue('count'); show('none');
  }
  function startLadder(hard: boolean, resume = false) {
    const s = saveRef.current, k: Climb = resume && s.climb ? s.climb : { hero: s.hero, hard, rung: 0, score: 0, losses: 0, secs: 0 };
    climbRef.current = k;
    store({ ...s, hero: k.hero, climb: k });
    openMatch('ladder', k.rung, k.hard);
  }
  function startEndless() {
    const g = game.current;
    Object.assign(g, idle(), { mode: 'endless', endless: new Endless(newSeed()), count: 70 });
    stage.current?.reset(); cue('count'); setScreen('play'); show('none');
  }
  function startLesson(i: number) {
    const g = game.current;
    Object.assign(g, idle(), { mode: 'lesson', lesson: i, drill: new Drill(LESSONS[i]) });
    stage.current?.reset(); setHint(false); setScreen('play'); show('none');
  }
  function leave() { game.current = idle(); auto.current = null; show('none'); setScreen('home'); }
  function togglePause() {
    const g = game.current;
    if (cardRef.current === 'paused') { show('none'); return; }
    if (cardRef.current !== 'none' || g.result || g.mode === 'lesson') return;
    show('paused');
  }

  /** A match has been decided: bank it, and work out what comes next. */
  function settleMatch() {
    const g = game.current, m = g.match, s = saveRef.current;
    if (!m) return;
    const won = g.wins[0] >= 2, chain = Math.max(s.chain, m.a.best);
    if (g.mode !== 'ladder' || !climbRef.current) { store({ ...s, chain }); show('match'); return; }
    const k = climbRef.current;
    if (!won) { climbRef.current = { ...k, losses: k.losses + 1 }; store({ ...s, chain, climb: climbRef.current }); show('match'); return; }
    if (k.rung < RIVALS.length - 1) { climbRef.current = { ...k, rung: k.rung + 1 }; store({ ...s, chain, far: Math.max(s.far, k.rung + 1), climb: climbRef.current }); show('match'); return; }
    store({ ...s, chain, climb: null, cleared: { ...s.cleared, [k.hero]: Math.max(s.cleared[k.hero], k.hard ? 2 : 1) } });
    cue('sweep'); show('done');
  }

  // The loop: sixty engine ticks a second however fast the screen redraws, then one drawing.
  useEffect(() => {
    if (screen !== 'play') return;
    const cv = canvas.current, holder = box.current;
    if (!cv || !holder) return;
    const c = cv.getContext('2d');
    if (!c) return;
    const st = (stage.current ??= new Stage());
    let raf = 0, last = performance.now(), acc = 0, w = 0, h = 0, dpr = 1;
    const size = () => { const r = holder.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); w = Math.max(200, r.width); h = Math.max(200, r.height); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); };
    size();
    const ro = new ResizeObserver(size); ro.observe(holder);

    const drain = (side: number, b: Board) => {
      const evs: Ev[] = b.events.splice(0);
      if (!evs.length) return;
      st.feed(side, evs);
      for (const e of evs) {
        if (e.t === 'pop') cue('pop', e.chain - 1, side ? 0.45 : 1);
        else if (e.t === 'dust') cue('dust', 0, side ? 0.4 : 1);
        else if (e.t === 'sweep') cue('sweep', 0, side ? 0.4 : 1);
        else if (side) continue;
        else if (e.t === 'move') cue('move'); else if (e.t === 'turn') cue('turn'); else if (e.t === 'lock') cue('lock');
        else if (e.t === 'send') cue('send'); else if (e.t === 'offset') cue('block');
      }
    };
    const tick = () => {
      const g = game.current;
      if (cardRef.current !== 'none') return;
      if (g.count > 0) { g.count--; if (g.count === 0) cue('go'); else if (g.count === 35) cue('count'); pad.current.poll(); return; }
      const board = g.match?.a ?? g.endless?.board ?? g.drill?.board;
      if (!board) return;
      const input = auto.current ? auto.current.step(board) : pad.current.poll();
      if (g.match) {
        const m = g.match;
        if (m.winner < 0) {
          m.step(input); drain(0, m.a); drain(1, m.b);
          if (!g.warned && m.a.pending >= 12) { g.warned = true; cue('warn'); } else if (m.a.pending < 6) g.warned = false;
          if (m.winner >= 0) {
            if (m.winner === 0) g.wins = [g.wins[0] + 1, g.wins[1]]; else if (m.winner === 1) g.wins = [g.wins[0], g.wins[1] + 1];
            g.result = m.winner === 0 ? ['Win!', 'Buried!'] : m.winner === 1 ? ['Buried!', 'Win!'] : ['Draw', 'Draw'];
            cue(m.winner === 0 ? 'win' : 'lose');
            if (climbRef.current && g.mode === 'ladder') climbRef.current = { ...climbRef.current, score: climbRef.current.score + m.a.score, secs: climbRef.current.secs + Math.round(m.tick / TPS) };
          }
        } else if (++g.ended === 110) { if (g.wins[0] >= 2 || g.wins[1] >= 2) settleMatch(); else show('round'); }
      } else if (g.endless) {
        const e = g.endless;
        if (!e.over) { e.step(input); drain(0, e.board); if (e.over) { g.result = ['Buried!', '']; cue('lose'); } }
        else if (++g.ended === 100) {
          const s = saveRef.current, b = e.board;
          store({ ...s, chain: Math.max(s.chain, b.best), endless: { score: Math.max(s.endless.score, b.score), chain: Math.max(s.endless.chain, b.best), level: Math.max(s.endless.level, e.level) } });
          show('over');
        }
      } else if (g.drill) {
        const d = g.drill, was = d.pairsLeft;
        d.step(input); drain(0, d.board);
        if (d.pairsLeft !== was) refresh();
        const still = d.board.phase === 'fall' || d.board.phase === 'over';
        if (d.done && still && ++g.ended === 45) {
          const s = saveRef.current, id = d.lesson.id;
          if (!s.lessons.includes(id)) store({ ...s, lessons: [...s.lessons, id] });
          cue('win'); show('solved');
        } else if (d.failed && ++g.ended === 40) { cue('lose'); show('missed'); }
      }
    };
    const view = (): View | null => {
      const g = game.current, s = saveRef.current, ghost = s.ghost;
      if (g.match) return { a: g.match.a, b: g.match.b, hero: s.hero, rival: g.rival, hard: g.hard, wins: g.wins, ghost, result: g.result, banner: g.count > 0 ? 'Ready' : g.match.tick < 36 ? 'Go!' : undefined };
      if (g.endless) { const b = g.endless.board; return { a: b, hero: s.hero, ghost, result: g.result, banner: g.count > 0 ? 'Ready' : b.tick < 36 ? 'Go!' : undefined, stats: [['SCORE', `${b.score}`], ['LEVEL', `${g.endless.level}`], ['BEST CHAIN', `${b.best}`]] }; }
      if (g.drill) return { a: g.drill.board, hero: s.hero, ghost, stats: [['PAIRS LEFT', `${g.drill.pairsLeft}`], ['BEST CHAIN', `${g.drill.board.best}`]] };
      return null;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; acc += dt;
      let todo = Math.min(4, Math.floor(acc * TPS));
      acc -= todo / TPS;
      if (fast.current > 1) todo = fast.current;
      for (let i = 0; i < todo; i++) tick();
      if (cardRef.current !== 'paused') st.update(dt);
      const v = view();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (v) st.draw(c, w, h, dpr, v, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    const hide = () => { if (document.hidden) { const g = game.current; if (cardRef.current === 'none' && !g.result && g.mode !== 'lesson') show('paused'); } };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', hide); };
    // The loop reads everything else through refs, so it only restarts when the screen changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Keys.
  useEffect(() => {
    const HOLD: Record<string, 'left' | 'right' | 'down'> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down' };
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'm') { const s = saveRef.current; setMuted(!s.muted); store({ ...s, muted: !s.muted }); return; }
      if (screen !== 'play') return;
      if (k === 'g') { const s = saveRef.current; store({ ...s, ghost: !s.ghost }); return; }
      if (k === 'p' || k === 'Escape') { e.preventDefault(); togglePause(); return; }
      if (k === 'r' && game.current.mode === 'lesson') { startLesson(game.current.lesson); return; }
      if (cardRef.current !== 'none') {
        // Enter presses a card's main button, unless a button already has the focus and will take the key itself.
        if (k === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) document.querySelector<HTMLButtonElement>('.pp-card .pp-go')?.click();
        return;
      }
      if (HOLD[k]) { e.preventDefault(); if (!e.repeat) pad.current.hold(HOLD[k], true); }
      else if (k === 'ArrowUp' || k === 'x' || k === 'w') { e.preventDefault(); if (!e.repeat) pad.current.tap('cw'); }
      else if (k === 'z' || k === 'q') { if (!e.repeat) pad.current.tap('ccw'); }
      else if (k === ' ') { e.preventDefault(); if (!e.repeat) pad.current.tap('plunge'); }
    };
    const up = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (HOLD[k]) pad.current.hold(HOLD[k], false); };
    const blur = () => { clearInput(); if (screen === 'play' && cardRef.current === 'none') { const g = game.current; if (!g.result && g.mode !== 'lesson') show('paused'); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Touch and mouse: drag sideways to move, tap to turn, pull down to drop.
  const cellPx = () => Math.max(18, (stage.current?.lay.a.cell ?? 30) * 0.85);
  const onDown = (e: React.PointerEvent) => { if (cardRef.current !== 'none') return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX, moved: false, soft: false }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const step = cellPx(), dy = e.clientY - d.y;
    while (e.clientX - d.lastX >= step) { pad.current.tap('right'); d.lastX += step; d.moved = true; }
    while (e.clientX - d.lastX <= -step) { pad.current.tap('left'); d.lastX -= step; d.moved = true; }
    if (!d.soft && dy > step * 1.3 && dy > Math.abs(e.clientX - d.x) * 1.2) { d.soft = true; d.moved = true; pad.current.hold('down', true); }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    pad.current.hold('down', false);
    const quick = performance.now() - d.t < 260, dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.soft && quick) pad.current.tap('plunge');
    else if (!d.moved && Math.hypot(dx, dy) < 12) { const r = e.currentTarget.getBoundingClientRect(); pad.current.tap(e.clientX - r.left < r.width / 2 ? 'ccw' : 'cw'); }
  };

  if (!loaded) return <main className="pp-shell"><p className="pp-loading">Fluffing up…</p></main>;

  const g = game.current, climb = save.climb, cleared = save.cleared[hero], lessonsDone = save.lessons.length;
  const go = (fn: () => void) => () => { cue('select'); fn(); };
  const pick = (h: HeroId) => { cue('select'); store({ ...save, hero: h }); };

  if (screen !== 'play') {
    return (
      <main className="pp-shell">
        <header className="pp-top"><a href="/">← Arcade</a><span>POOF PANIC</span><button className="pp-icon" onClick={() => { setMuted(!save.muted); store({ ...save, muted: !save.muted }); }} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>{save.muted ? '🔇' : '🔊'}</button></header>
        {screen === 'home' && (
          <section className="pp-home">
            <div className="pp-logo" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <Poof key={n} colour={n} size={46} />)}</div>
            <h1>Poof Panic</h1>
            <p className="pp-lede">Drop pairs of fluff balls. Four of a colour pop, and what falls into place next is a chain. Chains bury your rival in dust.</p>
            <div className="pp-heroes">
              {(['dora', 'enzo'] as HeroId[]).map((h) => (
                <button key={h} aria-pressed={hero === h} className={hero === h ? 'on' : ''} onClick={() => pick(h)} data-testid={`hero-${h}`}>
                  <Face who={h} size={64} />
                  <span><strong>{HEROES[h].name}</strong><small>{HEROES[h].text}</small><em>{save.cleared[h] === 2 ? '★★ Hard ladder climbed' : save.cleared[h] === 1 ? '★ Ladder climbed' : 'Ladder not climbed yet'}</em></span>
                </button>
              ))}
            </div>
            <div className="pp-modes">
              {climb && <button className="pp-go" data-testid="continue" onClick={go(() => startLadder(climb.hard, true))}><strong>Continue the {climb.hard ? 'hard ' : ''}ladder</strong><small>{HEROES[climb.hero].name} · rival {climb.rung + 1} of {RIVALS.length}: {RIVALS[climb.rung].name} {RIVALS[climb.rung].title}</small></button>}
              <button className={climb ? '' : 'pp-go'} data-testid="ladder" onClick={go(() => startLadder(false))}><strong>Rival ladder</strong><small>Six rivals, first to two rounds each.{climb ? ' Starts again from the bottom.' : ''}</small></button>
              <button data-testid="hard" disabled={cleared < 1} onClick={go(() => startLadder(true))}><strong>Hard ladder</strong><small>{cleared < 1 ? `Climb the ladder with ${HEROES[hero].name} to open this.` : 'The same six, quicker and greedier for chains.'}</small></button>
              <button data-testid="free" onClick={go(() => setScreen('rivals'))}><strong>Free match</strong><small>Any rival you have met, as often as you like.</small></button>
              <button data-testid="endless" onClick={go(startEndless)}><strong>Endless</strong><small>{save.endless.score ? `Best ${save.endless.score} · level ${save.endless.level} · ${save.endless.chain}-chain` : 'No rival. It only gets faster.'}</small></button>
              <button data-testid="lessons" onClick={go(() => setScreen('lessons'))}><strong>Chain lessons</strong><small>{lessonsDone} of {LESSONS.length} done. Learn stairs, sandwiches and the clean sweep.</small></button>
            </div>
            <details className="pp-how">
              <summary>How to play</summary>
              <ul>
                <li><b>Keys:</b> ← → move, ↓ drop faster, ↑ or X turn right, Z turn left, Space drop to the floor. P pauses, G hides the landing guide, M mutes.</li>
                <li><b>Touch:</b> drag sideways to move, tap the right or left half to turn, pull down to drop faster, flick down to drop to the floor.</li>
                <li>Four or more of one colour touching pop. A pop that lets others fall into a new group is a chain, and each link is worth far more than the last.</li>
                <li>Points become dust clumps for your rival: one for every 70. Your own pops cancel dust that is waiting above your board before they send any.</li>
                <li>Dust lands after a pair that popped nothing, thirty clumps at most at a time. It clears when something pops right beside it.</li>
                <li>Empty your whole board for a clean sweep: your next pop sends thirty extra clumps.</li>
                <li>The round is lost when the cell marked ✕ at the top of the third column fills.</li>
              </ul>
              {save.chain > 0 && <p>Your longest chain so far: <b>{save.chain}</b>.</p>}
            </details>
          </section>
        )}
        {screen === 'rivals' && (
          <section className="pp-list">
            <h2>Free match</h2>
            <p>Pick a rival. You meet new ones by climbing the ladder.</p>
            {(save.cleared.dora > 0 || save.cleared.enzo > 0) && <label className="pp-check"><input type="checkbox" checked={freeHard} onChange={(e) => setFreeHard(e.target.checked)} /> Hard-ladder strength</label>}
            <div className="pp-rivals">
              {RIVALS.map((r, i) => (
                <button key={r.id} disabled={i > save.far} data-testid={`rival-${r.id}`} onClick={go(() => { climbRef.current = null; openMatch('free', i, freeHard); })}>
                  <Face who={i > save.far ? 'mole' : r.kind} size={54} hard={freeHard} />
                  <span><strong>{i > save.far ? '???' : `${r.name} ${r.title}`}</strong><small>{i > save.far ? `Rival ${i + 1} on the ladder` : r.blurb}</small></span>
                </button>
              ))}
            </div>
            <button className="pp-back" onClick={go(() => setScreen('home'))}>Back</button>
          </section>
        )}
        {screen === 'lessons' && (
          <section className="pp-list">
            <h2>Chain lessons</h2>
            <p>Each lesson is a set board and a few set pairs. Pairs wait at the top until you drop them, so take your time.</p>
            <ol className="pp-lessons">
              {LESSONS.map((l, i) => (
                <li key={l.id}><button data-testid={`lesson-${l.id}`} onClick={go(() => startLesson(i))}><b>{save.lessons.includes(l.id) ? '✓' : i + 1}</b><span><strong>{l.title}</strong><small>{goalText(l.goal)}</small></span></button></li>
              ))}
            </ol>
            <button className="pp-back" onClick={go(() => setScreen('home'))}>Back</button>
          </section>
        )}
      </main>
    );
  }

  const m = g.match, lesson: Lesson | null = g.drill?.lesson ?? null, rival = g.rival, youWon = g.wins[0] >= 2;
  const label = g.mode === 'ladder' ? `${g.hard ? 'Hard ladder' : 'Ladder'} · rival ${g.rung + 1} of ${RIVALS.length}` : g.mode === 'free' ? `Free match${g.hard ? ' · hard' : ''}` : g.mode === 'endless' ? 'Endless' : `Lesson ${g.lesson + 1} of ${LESSONS.length}`;
  return (
    <main className="pp-shell pp-play">
      <header className="pp-top">
        <button className="pp-quit" data-testid="quit" onClick={go(leave)}>← Menu</button>
        <span data-testid="label">{label}</span>
        <span className="pp-tools">
          {g.mode !== 'lesson' && <button className="pp-icon" data-testid="pause" onClick={togglePause} aria-label="Pause">⏸</button>}
          <button className="pp-icon" onClick={() => store({ ...save, ghost: !save.ghost })} aria-label={save.ghost ? 'Hide the landing guide' : 'Show the landing guide'} aria-pressed={save.ghost}>◌</button>
          <button className="pp-icon" onClick={() => { setMuted(!save.muted); store({ ...save, muted: !save.muted }); }} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>{save.muted ? '🔇' : '🔊'}</button>
        </span>
      </header>
      {lesson && (
        <div className="pp-lesson" data-testid="lesson-bar">
          <div><strong>{lesson.title}</strong><span>{lesson.idea}</span>{hint && <em>{lesson.hint}</em>}</div>
          <div className="pp-lesson-goal"><b>{goalText(lesson.goal)}</b><span><button onClick={() => setHint(true)} disabled={hint}>Hint</button><button data-testid="retry" onClick={() => startLesson(g.lesson)}>Retry <kbd>R</kbd></button></span></div>
        </div>
      )}
      <div className="pp-stage" ref={box}>
        <canvas ref={canvas} data-testid="board" aria-label="Poof Panic board" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={clearInput} onLostPointerCapture={() => { if (drag.current) clearInput(); }} />
        {card !== 'none' && (
          <section className="pp-card" aria-live="polite" data-testid={`card-${card}`}>
            {card === 'intro' && rival && (<>
              <small>{label}</small>
              <Face who={rival.kind} size={96} hard={g.hard} />
              <h2>{rival.name} {rival.title}</h2>
              <p>{rival.blurb}</p>
              <p className="pp-fine">First to two rounds. {HEROES[hero].name} throws dust in a {HEROES[hero].style === 'pile' ? 'heap' : 'sprinkle'}; {rival.name} in a {rival.style === 'pile' ? 'heap' : 'sprinkle'}.</p>
              <button className="pp-go" data-testid="start" onClick={go(startRound)}>Start</button>
            </>)}
            {card === 'paused' && (<>
              <h2>Paused</h2>
              <button className="pp-go" data-testid="resume" onClick={() => show('none')}>Carry on</button>
              <button onClick={go(leave)}>Leave for the menu</button>
            </>)}
            {card === 'round' && m && rival && (<>
              <h2>{m.winner === 2 ? 'Both buried: play it again' : m.winner === 0 ? `Round to ${HEROES[hero].name}!` : `Round to ${rival.name}`}</h2>
              <p className="pp-score"><b>{g.wins[0]}</b> – <b>{g.wins[1]}</b></p>
              <p className="pp-fine">Your longest chain: {m.a.best}. Dust sent: {m.a.sent}. Time: {clock(m.tick / TPS)}.</p>
              <button className="pp-go" data-testid="next-round" onClick={go(startRound)}>Next round</button>
            </>)}
            {card === 'match' && m && rival && (<>
              <Face who={youWon ? hero : rival.kind} size={90} hard={g.hard} />
              <h2>{youWon ? `${rival.name} is buried!` : `${rival.name} wins the match`}</h2>
              <p className="pp-score"><b>{g.wins[0]}</b> – <b>{g.wins[1]}</b></p>
              <p className="pp-fine">Your longest chain: {m.a.best}. Dust sent: {m.a.sent}.{m.tick / TPS >= MARGIN ? ' That one went long enough for dust to get cheaper.' : ''}</p>
              {g.mode === 'ladder' && youWon && <button className="pp-go" data-testid="next-rival" onClick={go(() => openMatch('ladder', climbRef.current?.rung ?? 0, g.hard))}>Next rival</button>}
              {(g.mode === 'free' || !youWon) && <button className="pp-go" data-testid="again" onClick={go(() => openMatch(g.mode === 'free' ? 'free' : 'ladder', g.rung, g.hard))}>{youWon ? 'Rematch' : 'Try again'}</button>}
              <button onClick={go(leave)}>Back to the menu</button>
            </>)}
            {card === 'done' && (<>
              <Face who={hero} size={96} />
              <h2>{g.hard ? 'The hard ladder is yours!' : 'Top of the ladder!'}</h2>
              <p>{HEROES[hero].name} has buried all six rivals{g.hard ? ' at their best' : ''}.</p>
              <p className="pp-fine">Score {climbRef.current?.score ?? 0} · time {clock(climbRef.current?.secs ?? 0)} · matches lost {climbRef.current?.losses ?? 0}</p>
              {!g.hard && <p className="pp-fine">The hard ladder is now open for {HEROES[hero].name}.</p>}
              <button className="pp-go" data-testid="finish" onClick={go(leave)}>Back to the menu</button>
            </>)}
            {card === 'over' && g.endless && (<>
              <h2>Buried at level {g.endless.level}</h2>
              <p className="pp-score"><b>{g.endless.board.score}</b></p>
              <p className="pp-fine">Longest chain {g.endless.board.best} · pairs placed {g.endless.board.placed} · clean sweeps {g.endless.board.sweeps}</p>
              <p className="pp-fine">Best so far: {save.endless.score} · level {save.endless.level} · {save.endless.chain}-chain</p>
              <button className="pp-go" data-testid="again" onClick={go(startEndless)}>Go again</button>
              <button onClick={go(leave)}>Back to the menu</button>
            </>)}
            {card === 'solved' && lesson && (<>
              <h2>Lesson done!</h2>
              <p>{lesson.idea}</p>
              {g.lesson < LESSONS.length - 1
                ? <button className="pp-go" data-testid="next-lesson" onClick={go(() => startLesson(g.lesson + 1))}>Next lesson</button>
                : <p className="pp-fine">That was the last one. Go and try it on a rival.</p>}
              <button onClick={go(() => { leave(); setScreen('lessons'); })}>All lessons</button>
            </>)}
            {card === 'missed' && lesson && (<>
              <h2>Out of pairs</h2>
              <p>{lesson.hint}</p>
              <button className="pp-go" data-testid="retry-card" onClick={go(() => startLesson(g.lesson))}>Try again</button>
              <button onClick={go(() => { leave(); setScreen('lessons'); })}>All lessons</button>
            </>)}
          </section>
        )}
      </div>
      <footer className="pp-foot">{touch ? 'Drag to move · tap to turn · pull down to drop' : '← → move · ↓ drop · ↑ / X / Z turn · Space drop to the floor · P pause'}</footer>
    </main>
  );
}
