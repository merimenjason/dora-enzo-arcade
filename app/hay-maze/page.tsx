/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Run, TOWERS, TOWER_IDS, ENEMIES, RELICS, ITEMS, LEVELS, WAVES_PER_LEVEL, COLS, ROWS, START_TOWERS, SHATTER, FLARE,
  isPiece, cardName, regionOf, bossLevel,
  type TowerId, type Tower, type EnemyId, type PlaceResult, type CardId, type Reward,
} from '../../lib/hay-maze-game';
import { drawMaze, drawTowerIcon, drawCritterIcon, drawCardIcon, toGrid, ELEMENT_COLOR, VIEW_W, VIEW_H, type Ghost } from '../../lib/hay-maze-scene';
import { COATS, drawChinchilla } from '../../lib/chinchilla-art';
import './hay-maze.css';

const SAVE_KEY = 'hay-maze-v2', RUN_KEY = 'hay-maze-run-v1', DT = 1 / 60, SCALE = 2;
type Save = { runs: number; wins: number; best: number };
const readSave = (): Save => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '');
    return { runs: Math.max(0, Number(s.runs) || 0), wins: Math.max(0, Number(s.wins) || 0), best: Math.max(0, Math.min(LEVELS, Number(s.best) || 0)) };
  } catch { return { runs: 0, wins: 0, best: 0 }; }
};
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, it just isn't remembered */ } };
/** The run in progress, if one was saved and still loads. */
const readRun = (): Run | null => { try { const raw = localStorage.getItem(RUN_KEY); return raw ? Run.load(JSON.parse(raw)) : null; } catch { return null; } };
const writeRun = (json: string | null) => { try { if (json) localStorage.setItem(RUN_KEY, json); else localStorage.removeItem(RUN_KEY); } catch { /* private mode */ } };
type Resume = { level: number; wave: number; flame: number; maxFlame: number; reward: boolean };
const resumeOf = (r: Run | null): Resume | null => (r ? { level: r.level, wave: r.battle.wave, flame: r.flame, maxFlame: r.maxFlame, reward: r.state === 'reward' } : null);

const REFUSED: Record<Exclude<PlaceResult, 'ok'>, string> = {
  phase: 'Bales go down between waves. Towers can go up any time.',
  taken: 'Something is already there.',
  blocked: 'That would shut them out completely. Leave them a way through.',
  bounds: 'That doesn’t fit on the meadow.',
  card: '', state: '',
  hay: 'Not enough hay yet.',
  locked: 'Win that tower as a reward first.',
  foundation: 'Towers stand on hay bales or rocks.',
};
const TOWER_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ','];
const HITS = { ground: 'Ground', air: 'Flyers only', both: 'Ground and flyers' };
const ELEMENT_NAME = { plain: 'Pellet', ice: 'Ice', fire: 'Fire', spark: 'Spark', arcane: 'Arcane', earth: 'Earth', sleep: 'Sleep', air: 'Air' };
type Tool = { kind: 'card'; slot: number } | { kind: 'tower'; tower: TowerId } | null;

function Icon({ draw, w, h, label }: { draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    draw(c, w, h);
  });
  return <canvas ref={ref} width={w * SCALE} height={h * SCALE} style={{ width: w, height: h }} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />;
}
const towerIcon = (kind: TowerId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawTowerIcon(c, kind, w, h, 0.5);
const critterIcon = (kind: EnemyId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawCritterIcon(c, kind, w, h);
const cardIcon = (id: CardId, rot = 0) => (c: CanvasRenderingContext2D, w: number, h: number) => drawCardIcon(c, id, w, h, rot);
const heroes = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.clearRect(0, 0, w, h);
  const g = c.createRadialGradient(w / 2, h * 0.6, 2, w / 2, h * 0.6, w / 2);
  g.addColorStop(0, 'rgba(255, 170, 70, 0.55)'); g.addColorStop(1, 'rgba(255, 170, 70, 0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#6b6560'; c.beginPath(); c.moveTo(w / 2 - 10, h * 0.7); c.lineTo(w / 2 + 10, h * 0.7); c.lineTo(w / 2 + 6, h * 0.84); c.lineTo(w / 2 - 6, h * 0.84); c.closePath(); c.fill();
  for (const [k, col] of [[1, '#ff7a2a'], [0.66, '#ffb347'], [0.36, '#fff2b0']] as [number, string][]) { c.fillStyle = col; c.beginPath(); c.moveTo(w / 2 - 8 * k, h * 0.7); c.quadraticCurveTo(w / 2 - 6 * k, h * 0.7 - 26 * k, w / 2, h * 0.7 - 34 * k); c.quadraticCurveTo(w / 2 + 6 * k, h * 0.7 - 26 * k, w / 2 + 8 * k, h * 0.7); c.fill(); }
  drawChinchilla(c, COATS.dora, w * 0.24, h * 0.92, { face: 1, h: h * 0.42, time: 0.3 });
  drawChinchilla(c, COATS.enzo, w * 0.78, h * 0.92, { face: -1, h: h * 0.46, time: 1.8 });
};

export default function HayMaze() {
  const [save, setSave] = useState<Save>({ runs: 0, wins: 0, best: 0 });
  const [loaded, setLoaded] = useState(false);
  const [resume, setResume] = useState<Resume | null>(null);
  const [screen, setScreen] = useState<'home' | 'play'>('home');
  const [tool, setTool] = useState<Tool>(null);
  const [rot, setRot] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState('');
  const [, setTick] = useState(0);
  const run = useRef<Run | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<{ c: number; r: number; shown: boolean }>({ c: 8, r: 5, shown: false });
  const toolRef = useRef<Tool>(null), rotRef = useRef(0), pickedRef = useRef<number | null>(null), speedRef = useRef(1);
  const ghostCache = useRef<{ key: string; ghost: Ghost } | null>(null);
  const recorded = useRef<Run | null>(null);
  const noteTimer = useRef(0);
  /** A touch tap has previewed a tile and the next tap on it places. */
  const armed = useRef(false);

  useEffect(() => { setSave(readSave()); setResume(resumeOf(readRun())); setLoaded(true); }, []);
  /** The last run JSON written, so the loop only writes when something changed. */
  const lastWritten = useRef<string | null>(null);
  const keep = () => { const r = run.current; if (!r) return; const snap = r.snapshot(), json = snap ? JSON.stringify(snap) : null; if (json !== lastWritten.current) { lastWritten.current = json; writeRun(json); } };
  // The browser test reads and fast-forwards the running game through this.
  useEffect(() => { (window as unknown as { __maze?: () => Run | null }).__maze = () => run.current; }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (text: string) => { if (!text) return; setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2200); };
  const chooseTool = (next: Tool) => { toolRef.current = next; setTool(next); ghostCache.current = null; if (next) { pickedRef.current = null; setPicked(null); } };
  const choosePicked = (id: number | null) => { pickedRef.current = id; setPicked(id); if (id !== null) { toolRef.current = null; setTool(null); } };
  const rotate = (by = 1) => { rotRef.current = (rotRef.current + by + 4) % 4; setRot(rotRef.current); ghostCache.current = null; };
  const setGameSpeed = (s: number) => { speedRef.current = s; setSpeed(s); };

  function start(next: Run) {
    run.current = next;
    recorded.current = null;
    chooseTool(null); choosePicked(null); setGameSpeed(1); rotRef.current = 0; setRot(0);
    cursor.current = { c: 8, r: 5, shown: false };
    lastWritten.current = null;
    setScreen('play');
    refresh();
  }
  function begin() {
    start(new Run((Date.now() % 1_000_000) + 1));
    keep();
    const next = { ...save, runs: save.runs + 1 }; setSave(next); writeSave(next);
  }
  /** Carries on the saved run: between waves, at the reward screen, or from the start of the wave it was left in. */
  function carryOn() {
    const saved = readRun();
    if (!saved) { setResume(null); writeRun(null); return; }
    start(saved);
  }
  /** Saves and goes back to the start screen. */
  function leave() { keep(); setResume(resumeOf(readRun())); setScreen('home'); }

  /** Picks hand card `slot`. Hay bundles and cocoa play at once; bales and the shovel wait for a tile. */
  function pickCard(slot: number) {
    const b = run.current?.battle, id = b?.hand[slot];
    if (!b || !id) return;
    if (!isPiece(id) && id !== 'shovel') { b.play(slot); say(id === 'bundle' ? '+25 hay.' : 'The Hearthlight burns brighter.'); chooseTool(null); refresh(); return; }
    const same = toolRef.current?.kind === 'card' && toolRef.current.slot === slot;
    chooseTool(same ? null : { kind: 'card', slot });
    cursor.current.shown = true;
  }
  function pickTower(kind: TowerId) {
    const r = run.current;
    if (!r || !r.unlocked.includes(kind)) return;
    const same = toolRef.current?.kind === 'tower' && toolRef.current.tower === kind;
    chooseTool(same ? null : { kind: 'tower', tower: kind });
    cursor.current.shown = true;
  }

  /** Uses the current tool on tile (c, r), or selects the tower there. */
  function act(c: number, r: number) {
    const b = run.current?.battle, t = toolRef.current;
    if (!b || !b.inGrid(c, r) || run.current?.state !== 'battle') return;
    if (t?.kind === 'card') {
      const result = b.play(t.slot, c, r, rotRef.current);
      if (result === 'ok') chooseTool(null); else say(REFUSED[result]);
    } else if (t?.kind === 'tower' && !b.towerAt(c, r)) {
      const result = b.build(t.tower, c, r);
      if (result !== 'ok') say(REFUSED[result]);
    } else choosePicked(b.towerAt(c, r)?.id ?? null);
    ghostCache.current = null;
    refresh();
  }

  const selectedTower = (): Tower | null => run.current?.battle.towers.find((t) => t.id === pickedRef.current) ?? null;
  function upgrade() { const b = run.current?.battle, t = selectedTower(); if (!b || !t) return; if (!b.upgrade(t)) say(b.upgradeCost(t) === null ? 'Already at the top level.' : 'Not enough hay yet.'); refresh(); }
  function sell() { const b = run.current?.battle, t = selectedTower(); if (!b || !t) return; b.sell(t); choosePicked(null); refresh(); }
  function sendWave() { const b = run.current?.battle; if (b?.sendWave()) { if (toolRef.current?.kind === 'card') chooseTool(null); refresh(); } }
  function choose(i: number) { const r = run.current; if (r?.choose(i)) { chooseTool(null); choosePicked(null); rotRef.current = 0; setRot(0); refresh(); } }

  // The loop: fixed steps (more of them at 2× and 3×), a draw every frame, and a HUD refresh a few times a second.
  useEffect(() => {
    if (screen !== 'play') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, acc = 0, ui = 0;
    const loop = (now: number) => {
      const r = run.current;
      if (!r) return;
      const b = r.battle;
      acc += last ? Math.min(0.1, (now - last) / 1000) * speedRef.current : 0; last = now;
      while (acc >= DT) { b.update(DT); acc -= DT; }
      b.events.splice(0);
      const t = toolRef.current, at = cursor.current;
      let ghost: Ghost = null;
      if (t && at.shown && b.inGrid(at.c, at.r)) {
        const id = t.kind === 'card' ? b.hand[t.slot] : null;
        const key = `${JSON.stringify(t)}:${id}:${rotRef.current}:${at.c}:${at.r}:${b.towers.length}:${b.hay}:${b.hand.length}:${b.phase}`;
        if (ghostCache.current?.key !== key) {
          let g: Ghost = null;
          if (t.kind === 'tower') g = { kind: 'tower', tower: t.tower, c: at.c, r: at.r, ok: b.canBuild(t.tower, at.c, at.r) === 'ok', range: b.stats(t.tower).range };
          else if (id && isPiece(id)) { const ok = b.canPlace(id, rotRef.current, at.c, at.r) === 'ok'; g = { kind: 'piece', piece: id, rot: rotRef.current, c: at.c, r: at.r, ok, d: ok ? b.preview(id, rotRef.current, at.c, at.r) : undefined }; }
          else if (id === 'shovel') g = { kind: 'shovel', c: at.c, r: at.r, ok: b.phase === 'build' && b.block(at.c, at.r) && !b.towerAt(at.c, at.r) };
          ghostCache.current = { key, ghost: g };
        }
        ghost = ghostCache.current.ghost;
      }
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawMaze(c, b, now / 1000, ghost, b.towers.find((x) => x.id === pickedRef.current) ?? null);
      if (now - ui > 120) { refresh(); keep(); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const blur = () => { const b = run.current?.battle; if (b && b.phase === 'wave' && !b.paused) { b.pause(); refresh(); } keep(); };
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', keep);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', keep); keep(); };
  }, [screen]);

  // Keyboard: 1–8 pick a card, Z X C V B N M , pick a tower, R rotates, arrows move the cursor, Enter places or
  // selects, Space starts the wave, U upgrades, Delete sells, F changes speed, P pauses, Escape cancels.
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const r = run.current, b = r?.battle;
      if (!r || !b || (e.target as HTMLElement).closest('input,textarea')) return;
      const k = e.key.toLowerCase(), onButton = !!(e.target as HTMLElement).closest('button,a');
      if (r.state === 'reward' && ['1', '2', '3'].includes(k)) { choose(Number(k) - 1); return; }
      if (r.state !== 'battle') return;
      if (k === 'p') { b.pause(); refresh(); return; }
      if (k === 'escape') { if (toolRef.current || pickedRef.current !== null) { chooseTool(null); choosePicked(null); } else b.pause(); refresh(); return; }
      if (b.paused) return;
      const n = Number(k);
      if (n >= 1 && n <= 8) { pickCard(n - 1); return; }
      const ti = TOWER_KEYS.indexOf(k);
      if (ti >= 0) { pickTower(TOWER_IDS[ti]); return; }
      if (k === 'r') { rotate(e.shiftKey ? -1 : 1); return; }
      const moves: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (moves[k]) { e.preventDefault(); const at = cursor.current; cursor.current = { c: Math.max(0, Math.min(COLS - 1, at.c + moves[k][0])), r: Math.max(0, Math.min(ROWS - 1, at.r + moves[k][1])), shown: true }; return; }
      if (k === 'enter' && !onButton) { e.preventDefault(); act(cursor.current.c, cursor.current.r); return; }
      if (k === ' ' && !onButton) { e.preventDefault(); sendWave(); return; }
      if (k === 'f') { setGameSpeed(speedRef.current === 3 ? 1 : speedRef.current + 1); return; }
      if (k === 'u') { upgrade(); return; }
      if (k === 'delete' || k === 'backspace') { sell(); return; }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const r = run.current;
  // Record how far the run got, once.
  if (r && (r.state === 'won' || r.state === 'lost') && recorded.current !== r) {
    recorded.current = r;
    const next = { ...save, wins: save.wins + (r.state === 'won' ? 1 : 0), best: Math.max(save.best, r.level + (r.state === 'won' ? 1 : 0)) };
    setSave(next); writeSave(next);
  }

  const header = (
    <header className="hm-header">
      <a className="hm-back" href="/">← MAIN ARCADE</a>
      <span className="hm-brand">HAY MAZE DEFENCE</span>
      <span />
    </header>
  );

  if (screen === 'home' || !r) {
    return (
      <main className="hm-shell">
        {header}
        <section className="hm-intro">
          <Icon draw={heroes} w={150} h={110} />
          <div>
            <p className="hm-eyebrow">ROGUELITE TOWER DEFENCE · BUILD THE MAZE · GUARD THE FLAME</p>
            <h1>Hay Maze Defence</h1>
            <p className="hm-lede">Night falls on the mountain and the predators come for the <b>Hearthlight</b>, the lantern that keeps Dora and Enzo’s burrow warm. They always take the shortest way to it. Draw hay-bale blocks as cards, turn them and lay them into a winding maze, then stand towers on the bales: ice, fire, sparks and moonlight that work best together. Six levels, a new meadow each time, and a reward after every one.</p>
            {resume && <div className="hm-resume">
              <button className="hm-go hm-big" data-testid="continue" onClick={carryOn}>Continue your run →</button>
              <span>Level {resume.level + 1} of {LEVELS} · {regionOf(resume.level).name} · {resume.reward ? 'choosing a reward' : `wave ${resume.wave + 1} of ${WAVES_PER_LEVEL} next`} · 🔥 {resume.flame}/{resume.maxFlame}</span>
            </div>}
            <div className="hm-row">
              <button className={resume ? 'hm-big' : 'hm-go hm-big'} data-testid="begin" disabled={!loaded} onClick={begin}>{resume ? 'Begin a new run' : 'Begin a run →'}</button>
              {resume && <span className="hm-stats">This replaces your saved run.</span>}
              <span className="hm-stats">{save.runs ? `${save.runs} run${save.runs === 1 ? '' : 's'} · ${save.wins} won · best: ${save.best >= LEVELS ? 'all six levels' : `level ${Math.max(1, save.best)}`}` : 'Your first night on the mountain.'}</span>
            </div>
          </div>
        </section>

        <section className="hm-help">
          <p><b>1 · Lay the maze.</b> Before each wave you hold a hand of bale cards. Pick one, turn it with R or right-click, and lay it. The glowing line shows the way they’ll walk, and bends as you build. You can never close it completely.</p>
          <p><b>2 · Stand towers on bales.</b> Towers go on top of your bales or the meadow’s rocks, and cost hay. Upgrade them twice. Predators pay hay when caught, and every wave pays a bonus.</p>
          <p><b>3 · Mix the elements.</b> Chilled foes <b>shatter</b> for {SHATTER}× damage when a Spark Wheel zaps them. Burning foes <b>flare</b> when moonlight hits, scorching neighbours for {FLARE * 100}%. Hawks fly straight over the maze.</p>
          <p><b>4 · Keep the flame lit.</b> Each predator that reaches the Hearthlight dims it. Clear five waves to finish a level, then pick a new tower, a relic or more cards. Every second level ends with a lynx.</p>
        </section>

        <h2 className="hm-section">The crew <small>you start with three; the rest are rewards</small></h2>
        <div className="hm-roster">
          {TOWER_IDS.map((id) => {
            const t = TOWERS[id], lv = t.levels[0];
            return (
              <div key={id} className="hm-card">
                <Icon draw={towerIcon(id)} w={52} h={50} />
                <div>
                  <strong>{t.name} <span className="hm-cost">{t.cost} hay</span></strong>
                  <small><i className="hm-dot" style={{ background: ELEMENT_COLOR[t.element] }} />{ELEMENT_NAME[t.element]} · {HITS[t.hits]}{lv.slow ? ` · chills ${Math.round(lv.slow * 100)}%` : ''}{lv.stun ? ` · naps ${lv.stun}s` : ''}{lv.burn ? ' · burns' : ''}{lv.chains ? ` · chains ${lv.chains}` : ''}{lv.splash ? ' · splash' : ''}{START_TOWERS.includes(id) ? ' · starter' : ''}</small>
                  <p>{t.blurb}</p>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="hm-section">The raiders</h2>
        <div className="hm-roster raiders">
          {(Object.keys(ENEMIES) as EnemyId[]).map((id) => {
            const e = ENEMIES[id];
            return (
              <div key={id} className="hm-card">
                <Icon draw={critterIcon(id)} w={56} h={40} />
                <div>
                  <strong>{e.name}</strong>
                  <small>{e.air ? 'Flies over the maze' : e.speed > 1.4 ? 'Fast' : e.speed < 0.8 ? 'Slow' : 'Steady'}{e.armor ? ` · armour ${e.armor}` : ''}{e.slowResist ? ' · shrugs off chill' : ''}{e.steal > 1 ? ` · dims the flame by ${e.steal}` : ''}{id === 'lynx' ? ' · the guardian' : ''}</small>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  const b = r.battle;
  const tower = selectedTower(), def = tower ? TOWERS[tower.kind] : null, lv = tower ? b.stats(tower) : null;
  const upCost = tower ? b.upgradeCost(tower) : null;
  const upcoming = b.phase === 'build' ? b.plan[b.wave] : b.phase === 'wave' ? b.plan[b.wave - 1] : undefined;
  const flameFrac = r.flame / r.maxFlame;
  let overlay: React.ReactNode = null;
  if (r.state === 'reward') {
    overlay = <>
      <p className="hm-eyebrow">LEVEL {r.level + 1} CLEARED · {b.kills} CAUGHT</p>
      <h2>Pick a reward</h2>
      <div className="hm-rewards">{r.rewards.map((w, i) => <RewardCard key={i} reward={w} index={i} onPick={() => choose(i)} />)}</div>
      <p className="hm-small">Next: level {r.level + 2}, {regionOf(r.level + 1).name}{bossLevel(r.level + 1) ? ', guarded by a lynx' : ''}. Your run is saved.</p>
      <button className="hm-link" data-testid="leave" onClick={leave}>Save and leave</button>
    </>;
  } else if (r.state === 'won') overlay = <><p className="hm-eyebrow">ALL {LEVELS} LEVELS</p><h2>The Hearthlight burns till morning!</h2><p>Dora and Enzo kept it alight with {r.flame} of {r.maxFlame} left. {r.kills} predators turned back.</p><button className="hm-go" onClick={begin}>Another run →</button><button onClick={leave}>Back to the start</button></>;
  else if (r.state === 'lost') overlay = <><p className="hm-eyebrow">LEVEL {r.level + 1} · WAVE {b.wave}</p><h2>The Hearthlight went out.</h2><p>{r.kills} predators turned back. A longer maze, and elements that work together, buy more time.</p><button className="hm-go" onClick={begin}>Try another run →</button><button onClick={leave}>Back to the start</button></>;
  else if (b.paused) overlay = <><p className="hm-eyebrow">PAUSED</p><h2>A quiet moment by the fire.</h2><p>{b.phase === 'wave' ? `Your run is saved from the start of wave ${b.wave}.` : 'Your run is saved.'}</p><button className="hm-go" onClick={() => { b.pause(); refresh(); }}>Back to the maze →</button><button data-testid="leave" onClick={leave}>Save and leave</button></>;
  const hint = b.phase === 'build'
    ? tool?.kind === 'card' ? (isPiece(b.hand[tool.slot]) ? `Laying ${cardName(b.hand[tool.slot])}: click a spot, R or right-click turns it.` : 'Dig up a bale with no tower on it.') : tool?.kind === 'tower' ? `Building ${TOWERS[tool.tower].name}: click a bale or rock.` : 'Lay bales from your hand, stand towers on them, then start the wave.'
    : tool?.kind === 'tower' ? `Building ${TOWERS[tool.tower].name}: click a bale or rock.` : 'Towers can go up during the wave; bales wait until it’s over.';

  return (
    <main className="hm-shell hm-play">
      {header}
      <div className="hm-hud">
        <span><small>LEVEL</small><b>{r.level + 1}/{LEVELS} · {b.region.name}</b></span>
        <span data-testid="wave"><small>WAVE</small><b>{b.wave}/{WAVES_PER_LEVEL}</b></span>
        <span data-testid="flame" className={`hm-flame${flameFrac <= 0.3 ? ' low' : ''}`}><small>HEARTHLIGHT</small><b>🔥 {r.flame}/{r.maxFlame}</b><i><em style={{ width: `${flameFrac * 100}%` }} /></i></span>
        <span data-testid="hay"><small>HAY</small><b>🌾 {b.hay}</b></span>
        <span><small>THEIR WALK</small><b>{b.walk} tiles</b></span>
        {r.relics.length > 0 && <span className="hm-relics"><small>RELICS</small><b>{r.relics.map((x) => <abbr key={x} title={`${RELICS[x].name}: ${RELICS[x].blurb}`}>{RELICS[x].icon}</abbr>)}</b></span>}
      </div>
      <div className="hm-board">
        <canvas
          ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
          data-testid="board" data-state={r.state} data-phase={b.phase} data-paused={b.paused} data-walk={b.walk} data-towers={b.towers.length} data-level={r.level + 1}
          aria-label="The meadow. Pick a card with 1 to 8 or a tower with Z to comma, move with the arrow keys and press Enter to place, R to turn a bale."
          onPointerMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(), at = toGrid(((e.clientX - rect.left) / rect.width) * VIEW_W, ((e.clientY - rect.top) / rect.height) * VIEW_H); cursor.current = { ...at, shown: true }; }}
          onPointerLeave={() => { cursor.current.shown = false; }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect(), at = toGrid(((e.clientX - rect.left) / rect.width) * VIEW_W, ((e.clientY - rect.top) / rect.height) * VIEW_H);
            const was = cursor.current;
            cursor.current = { ...at, shown: true };
            if (e.button === 2) { if (toolRef.current?.kind === 'card') rotate(); else { chooseTool(null); choosePicked(null); } refresh(); return; }
            // Tiles are small on a touch screen, so the first tap previews; a second tap on the same tile places.
            if (e.pointerType === 'touch' && toolRef.current && !(armed.current && was.c === at.c && was.r === at.r)) { armed.current = true; say('Tap again to place here.'); return; }
            armed.current = false;
            act(at.c, at.r);
          }}
          onWheel={(e) => { if (toolRef.current?.kind === 'card') { e.preventDefault(); rotate(e.deltaY > 0 ? 1 : -1); } }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {note && <output className="hm-note">{note}</output>}
        {overlay && <div className="hm-overlay"><div>{overlay}</div></div>}
      </div>
      <div className="hm-controls">
        <button className="hm-go" data-testid="send-wave" disabled={b.phase !== 'build' || r.state !== 'battle'} onClick={sendWave}>
          {b.phase === 'build' ? `Start wave ${b.wave + 1} · Space` : b.phase === 'wave' ? `Wave ${b.wave} under way…` : 'Level cleared'}
        </button>
        {upcoming && <span className="hm-next" aria-label={`${b.phase === 'build' ? 'Coming' : 'Now'}: ${upcoming.map(([k, n]) => `${n} ${ENEMIES[k].name}`).join(', ')}`}>
          <small>{b.phase === 'build' ? 'COMING' : 'NOW'}</small>
          {upcoming.map(([k, n], i) => <span key={i} className={ENEMIES[k].air ? 'air' : k === 'lynx' ? 'boss' : ''}><Icon draw={critterIcon(k)} w={30} h={22} />×{n}</span>)}
        </span>}
        <span className="hm-spacer" />
        <span className="hm-deck" title="Cards left to draw, and played cards waiting to be shuffled back in">🂠 {b.drawPile.length} · ♻ {b.discard.length}</span>
        <button onClick={() => setGameSpeed(speed === 3 ? 1 : speed + 1)} aria-label={`Speed ${speed}×`}>{speed}× · F</button>
        <button onClick={() => { b.pause(); refresh(); }} disabled={r.state !== 'battle'}>{b.paused ? 'Resume' : 'Pause'} · P</button>
      </div>
      <section className="hm-hand" aria-label="Your hand">
        {b.hand.length === 0 && <p className="hm-empty">No cards in hand. You draw {3 + (r.has('map') ? 1 : 0)} after each wave.</p>}
        {b.hand.map((id, slot) => {
          const on = tool?.kind === 'card' && tool.slot === slot;
          return (
            <button key={`${slot}-${id}`} data-testid={`card-${slot}`} data-card={id} className={`hm-cardbtn${on ? ' on' : ''}${isPiece(id) ? '' : ' item'}`} aria-pressed={on} disabled={isPiece(id) && b.phase !== 'build'} onClick={() => pickCard(slot)}>
              <Icon draw={cardIcon(id, on ? rot : 0)} w={52} h={44} />
              <span>{slot + 1} · {cardName(id)}</span>
            </button>
          );
        })}
        {tool?.kind === 'card' && isPiece(b.hand[tool.slot]) && <button className="hm-rotate" data-testid="rotate" onClick={() => rotate()}>↻ Turn · R</button>}
      </section>
      <section className="hm-palette" aria-label="Towers">
        {TOWER_IDS.map((id, i) => {
          const t = TOWERS[id], open = r.unlocked.includes(id);
          if (!open) return null;
          const on = tool?.kind === 'tower' && tool.tower === id;
          return (
            <button key={id} data-testid={`build-${id}`} className={`hm-tool${on ? ' on' : ''}${b.hay < t.cost ? ' poor' : ''}`} aria-pressed={on} onClick={() => { pickTower(id); canvas.current?.focus(); }}>
              <Icon draw={towerIcon(id)} w={44} h={42} />
              <span><i className="hm-dot" style={{ background: ELEMENT_COLOR[t.element] }} />{t.name.replace(/^(Dora|Enzo)’s /, '')}</span>
              <b>🌾 {t.cost} · {TOWER_KEYS[i].toUpperCase()}</b>
            </button>
          );
        })}
      </section>
      {tower && def && lv ? (
        <section className="hm-inspect" aria-label="Selected tower">
          <strong><i className="hm-dot" style={{ background: ELEMENT_COLOR[def.element] }} />{def.name} <small>level {tower.level + 1}</small></strong>
          <span>{HITS[def.hits]} · range {lv.range.toFixed(1)}{lv.dmg ? ` · ${Math.round(lv.dmg)} damage` : ''}{lv.slow ? ` · chills ${Math.round(lv.slow * 100)}%` : ''}{lv.burn ? ` · burns ${Math.round(lv.burn)}/s` : ''}{lv.chains ? ` · chains ${lv.chains}` : ''}{lv.stun ? ` · naps ${lv.stun.toFixed(1)}s` : ''}</span>
          <span className="hm-spacer" />
          {upCost !== null && <button className="hm-go" data-testid="upgrade" disabled={b.hay < upCost} onClick={upgrade}>Upgrade · 🌾 {upCost} · U</button>}
          <button data-testid="sell" onClick={sell}>Sell · +{b.refund(tower)} · Del</button>
        </section>
      ) : <p className="hm-keys">{hint} 1–8 cards · Z–, towers · R turn · arrows + Enter place · Space wave · F speed · P pause</p>}
      <span className="hm-sr" aria-live="polite">{picked === null ? '' : 'Tower selected.'}</span>
    </main>
  );
}

function RewardCard({ reward, index, onPick }: { reward: Reward; index: number; onPick: () => void }) {
  let art: React.ReactNode, title: string, text: string;
  if (reward.kind === 'tower') { const t = TOWERS[reward.tower]; art = <Icon draw={towerIcon(reward.tower)} w={64} h={60} />; title = `New tower: ${t.name}`; text = t.blurb; }
  else if (reward.kind === 'relic') { const x = RELICS[reward.relic]; art = <span className="hm-relic-art">{x.icon}</span>; title = `Relic: ${x.name}`; text = x.blurb; }
  else if (reward.kind === 'cards') { art = <span className="hm-cards-art">{reward.cards.map((id, i) => <Icon key={i} draw={cardIcon(id)} w={40} h={34} />)}</span>; title = 'More cards'; text = `Add ${reward.cards.map(cardName).join(', ')} to your deck.${reward.cards.some((c) => !isPiece(c)) ? ` ${reward.cards.filter((c) => !isPiece(c)).map((c) => ITEMS[c as keyof typeof ITEMS].blurb).join(' ')}` : ''}`; }
  else { art = <span className="hm-relic-art">🔥</span>; title = 'Tend the flame'; text = `The Hearthlight grows ${reward.amount} brighter.`; }
  return (
    <button className="hm-reward" data-testid={`reward-${index}`} data-kind={reward.kind} onClick={onPick}>
      {art}
      <strong>{title}</strong>
      <small>{text}</small>
      <em>{index + 1}</em>
    </button>
  );
}
