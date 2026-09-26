/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { Game, DEFENDERS, ZOMBIES, LEVELS, ROWS, COLS, unlockedBy, type DefenderId, type ZombieId, type PlantResult } from '../../lib/cvz-game';
import { drawLawn, drawDefenderIcon, drawZombieIcon, drawShovelIcon, zombie, toTile, seedPx, VIEW_W, VIEW_H, type Ghost } from '../../lib/cvz-scene';
import { COATS, drawChinchilla } from '../../lib/chinchilla-art';
import './cvz.css';

const SAVE_KEY = 'chinchillas-vs-zombies-v1', DT = 1 / 60, SCALE = 2;
const readCleared = () => { try { return Math.max(0, Math.min(LEVELS.length, Number(JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}').cleared) || 0)); } catch { return 0; } };
const writeCleared = (n: number) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cleared: n })); } catch { /* private mode: the game still plays, progress just isn't kept */ } };

const REFUSED: Record<Exclude<PlantResult, 'ok'>, string> = {
  seeds: 'Not enough seeds yet. Click the glowing seed pouches to collect them.',
  recharge: 'That one is still recharging.',
  taken: 'Someone is already standing there. Use the shovel to clear a tile.',
  lane: 'Nothing grows on that bare earth.',
  locked: 'Win more levels to unlock that defender.',
  state: '', bounds: '',
};
type Tool = DefenderId | 'shovel' | null;

function Icon({ draw, w, h }: { draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    draw(c, w, h);
  });
  return <canvas ref={ref} width={w * SCALE} height={h * SCALE} style={{ width: w, height: h }} aria-hidden="true" />;
}
const defIcon = (kind: DefenderId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawDefenderIcon(c, kind, w, h, 0.5);
const zombieIcon = (kind: ZombieId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawZombieIcon(c, kind, w, h);
const heroes = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.clearRect(0, 0, w, h);
  drawChinchilla(c, COATS.enzo, w * 0.5, h * 0.8, { face: 1, h: h * 0.46, time: 1.8 });
  drawChinchilla(c, COATS.dora, w * 0.3, h * 0.97, { face: 1, h: h * 0.46, time: 0.3 });
  c.save(); c.translate(w * 0.84, h * 0.95); c.scale(0.6, 0.6);
  zombie(c, 'cone', 0, 0, { step: 1, armor: 1, maxArmor: 1 });
  c.restore();
};

export default function ChinchillasVsZombies() {
  const [cleared, setCleared] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'play'>('home');
  const [tool, setTool] = useState<Tool>(null);
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState('');
  const [, setTick] = useState(0);
  const game = useRef<Game | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<{ row: number; col: number; shown: boolean }>({ row: 2, col: 3, shown: false });
  const toolRef = useRef<Tool>(null), speedRef = useRef(1);
  const recorded = useRef<Game | null>(null);
  const noteTimer = useRef(0);
  /** A touch tap has previewed a tile and the next tap on it plants. */
  const armed = useRef(false);

  useEffect(() => { setCleared(readCleared()); setLoaded(true); }, []);
  // The browser test reads and fast-forwards the running game through this.
  useEffect(() => { (window as unknown as { __cvz?: () => Game | null }).__cvz = () => game.current; }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (text: string) => { if (!text) return; setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2200); };
  const choose = (t: Tool) => { toolRef.current = t; setTool(t); };
  const setGameSpeed = (s: number) => { speedRef.current = s; setSpeed(s); };

  function begin(level: number) {
    game.current = new Game(level, (Date.now() % 100000) + 1);
    recorded.current = null;
    choose(null); setGameSpeed(1);
    setScreen('play');
    refresh();
  }

  function pick(t: Tool) {
    const g = game.current;
    if (!g || g.state !== 'playing') return;
    choose(toolRef.current === t ? null : t);
    cursor.current.shown = true;
  }
  /** Uses the tool on a tile. */
  function act(row: number, col: number) {
    const g = game.current, t = toolRef.current;
    if (!g || g.state !== 'playing' || !t) return;
    if (t === 'shovel') { if (g.shovel(row, col)) choose(null); refresh(); return; }
    const result = g.plant(t, row, col);
    if (result === 'ok') choose(null); else say(REFUSED[result]);
    refresh();
  }
  /** Collects a seed pouch under the pointer, if there is one. */
  function grab(px: number, py: number) {
    const g = game.current;
    if (!g) return false;
    const s = g.drops.find((d) => { const p = seedPx(d); return Math.hypot(p.x - px, p.y - py) < 30; });
    if (s) { g.collect(s.id); refresh(); return true; }
    return false;
  }

  useEffect(() => {
    if (screen !== 'play') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, acc = 0, ui = 0;
    const loop = (now: number) => {
      const g = game.current;
      if (!g) return;
      acc += last ? Math.min(0.1, (now - last) / 1000) * speedRef.current : 0; last = now;
      while (acc >= DT) { g.update(DT); acc -= DT; }
      g.events.splice(0);
      const t = toolRef.current, at = cursor.current;
      let ghost: Ghost = null;
      if (t && at.shown && at.row >= 0 && at.row < ROWS && at.col >= 0 && at.col < COLS) ghost = { kind: t, row: at.row, col: at.col, ok: t === 'shovel' ? !!g.at(at.row, at.col) : g.canPlant(t, at.row, at.col) === 'ok' };
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawLawn(c, g, now / 1000, ghost);
      if (now - ui > 120) { refresh(); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const blur = () => { if (game.current?.state === 'playing') { game.current.pause(); refresh(); } };
    window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', blur); };
  }, [screen]);

  // Keyboard: 1–7 pick a defender, S the shovel, arrows move, Enter plants, Space collects seeds, F speed, P pause.
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || (e.target as HTMLElement).closest('input,textarea')) return;
      const k = e.key.toLowerCase(), onButton = !!(e.target as HTMLElement).closest('button,a');
      if (k === 'p' || (k === 'escape' && !toolRef.current)) { if (g.state === 'playing' || g.state === 'paused') { g.pause(); refresh(); } return; }
      if (g.state !== 'playing') return;
      if (k === 'escape') { choose(null); return; }
      const n = Number(k);
      if (n >= 1 && n <= g.unlocked.length) { pick(g.unlocked[n - 1]); return; }
      if (k === 's') { pick('shovel'); return; }
      if (k === 'f') { setGameSpeed(speedRef.current === 3 ? 1 : speedRef.current + 1); return; }
      if (k === ' ' && !onButton) { e.preventDefault(); if (g.collectAll()) refresh(); return; }
      const moves: Record<string, [number, number]> = { arrowleft: [0, -1], arrowright: [0, 1], arrowup: [-1, 0], arrowdown: [1, 0] };
      if (moves[k]) { e.preventDefault(); const at = cursor.current; cursor.current = { row: Math.max(0, Math.min(ROWS - 1, at.row + moves[k][0])), col: Math.max(0, Math.min(COLS - 1, at.col + moves[k][1])), shown: true }; return; }
      if (k === 'enter' && !onButton) { e.preventDefault(); act(cursor.current.row, cursor.current.col); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const g = game.current;
  if (g && g.state === 'won' && recorded.current !== g) {
    recorded.current = g;
    const next = Math.max(cleared, g.level + 1);
    setCleared(next); writeCleared(next);
  }

  const header = (
    <header className="cz-header">
      <a className="cz-back" href="/">← MAIN ARCADE</a>
      <span className="cz-brand">CHINCHILLAS VS ZOMBIES</span>
      <span />
    </header>
  );

  if (screen === 'home' || !g) {
    const known = unlockedBy(Math.min(cleared, LEVELS.length - 1));
    return (
      <main className="cz-shell">
        {header}
        <section className="cz-intro">
          <Icon draw={heroes} w={150} h={100} />
          <div>
            <p className="cz-eyebrow">LANE DEFENCE · EIGHT NIGHTS · ONE BURROW</p>
            <h1>Chinchillas vs Zombies</h1>
            <p className="cz-lede">Zombies are shambling up the lawn towards Dora and Enzo’s burrow. Collect <b>sunflower seeds</b>, plant chinchilla defenders on the lawn, and stop every zombie before it reaches the door. A <b>hay cart</b> at the end of each lane clears it once; after that, the lane is up to you.</p>
          </div>
        </section>

        <h2 className="cz-section">Choose a night <small>win one to open the next and meet a new defender</small></h2>
        <div className="cz-levels">
          {LEVELS.map((l, i) => {
            const open = i <= cleared, done = i < cleared;
            return (
              <button key={l.name} className={`cz-level${done ? ' done' : ''}`} data-testid={`level-${i + 1}`} disabled={!open || !loaded} onClick={() => begin(i)}>
                <em>{i + 1}</em>
                <strong>{l.name}</strong>
                <small>{l.rows.length} lanes · {l.waves} waves · {l.pool.map((z) => ZOMBIES[z].name).join(', ')}</small>
                <span>{done ? '✓ Won' : open ? 'Play →' : '🔒'}{l.unlock ? ` · unlocks ${DEFENDERS[l.unlock].name}` : ''}</span>
              </button>
            );
          })}
        </div>

        <h2 className="cz-section">The defenders</h2>
        <div className="cz-roster">
          {(Object.keys(DEFENDERS) as DefenderId[]).map((id) => {
            const d = DEFENDERS[id], have = known.includes(id);
            return (
              <div key={id} className={`cz-card${have ? '' : ' locked'}`}>
                <Icon draw={defIcon(id)} w={56} h={60} />
                <div>
                  <strong>{d.name} <span className="cz-cost">🌻 {d.cost}</span></strong>
                  <small>{have ? `Recharge ${d.recharge}s` : `Unlocked by night ${LEVELS.findIndex((l) => l.unlock === id) + 1}`}</small>
                  <p>{d.blurb}</p>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="cz-section">The zombies</h2>
        <div className="cz-roster zombies">
          {(Object.keys(ZOMBIES) as ZombieId[]).map((id) => (
            <div key={id} className="cz-card">
              <Icon draw={zombieIcon(id)} w={56} h={70} />
              <div><strong>{ZOMBIES[id].name}</strong><p>{ZOMBIES[id].blurb}</p></div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const unlock = g.def.unlock;
  let overlay: React.ReactNode = null;
  if (g.state === 'paused') overlay = <><p className="cz-eyebrow">PAUSED</p><h2>The zombies are waiting too.</h2><button className="cz-go" onClick={() => { g.pause(); refresh(); }}>Back to the lawn →</button><button onClick={() => setScreen('home')}>Choose another night</button></>;
  else if (g.state === 'won') overlay = <>
    <p className="cz-eyebrow">NIGHT {g.level + 1} · {g.kills} ZOMBIES STOPPED</p>
    <h2>{g.level === LEVELS.length - 1 ? 'Morning! The burrow is safe.' : 'You held the lawn!'}</h2>
    {unlock && <div className="cz-unlock"><Icon draw={defIcon(unlock)} w={80} h={86} /><div><strong>New defender: {DEFENDERS[unlock].name}</strong><small>{DEFENDERS[unlock].blurb}</small></div></div>}
    {g.level + 1 < LEVELS.length && <button className="cz-go" data-testid="next-level" onClick={() => begin(g.level + 1)}>{`Night ${g.level + 2}: ${LEVELS[g.level + 1].name} →`}</button>}
    <button onClick={() => setScreen('home')}>Choose a night</button>
  </>;
  else if (g.state === 'lost') overlay = <><p className="cz-eyebrow">NIGHT {g.level + 1}</p><h2>The zombies got into the burrow!</h2><p>Dora and Enzo hid under the hay. Plant more Seed Gatherers early, and stack shooters in every lane.</p><button className="cz-go" onClick={() => begin(g.level)}>Try again →</button><button onClick={() => setScreen('home')}>Choose a night</button></>;

  return (
    <main className="cz-shell cz-play">
      {header}
      <section className="cz-bar" aria-label="Seed packets">
        <div className="cz-seeds" data-testid="seeds" aria-label={`${g.seeds} seeds`}><b>🌻</b><span>{g.seeds}</span></div>
        {g.unlocked.map((id, i) => {
          const d = DEFENDERS[id], wait = g.recharge[id] / d.recharge, poor = g.seeds < d.cost;
          return (
            <button key={id} className={`cz-packet${tool === id ? ' on' : ''}${poor || wait > 0 ? ' dim' : ''}`} data-testid={`packet-${id}`} aria-pressed={tool === id} aria-label={`${i + 1}: ${d.name}, ${d.cost} seeds${wait > 0 ? ', recharging' : ''}`} onClick={() => { pick(id); canvas.current?.focus(); }}>
              <Icon draw={defIcon(id)} w={46} h={48} />
              <b>{d.cost}</b>
              {wait > 0 && <i style={{ height: `${wait * 100}%` }} />}
              <small>{i + 1}</small>
            </button>
          );
        })}
        <button className={`cz-packet cz-shovel${tool === 'shovel' ? ' on' : ''}`} data-testid="shovel" aria-pressed={tool === 'shovel'} aria-label="Shovel (S)" onClick={() => { pick('shovel'); canvas.current?.focus(); }}>
          <Icon draw={drawShovelIcon} w={46} h={48} /><small>S</small>
        </button>
      </section>
      <div className="cz-board">
        <canvas
          ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
          data-testid="lawn" data-state={g.state} data-seeds={g.seeds} data-defenders={g.defenders.length}
          aria-label="The lawn. Pick a defender with 1 to 7, move with the arrow keys and press Enter to plant. Space collects seeds."
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * VIEW_W, py = ((e.clientY - r.top) / r.height) * VIEW_H; cursor.current = { ...toTile(px, py), shown: true }; }}
          onPointerLeave={() => { cursor.current.shown = false; }}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * VIEW_W, py = ((e.clientY - r.top) / r.height) * VIEW_H;
            if (grab(px, py)) return;
            const was = cursor.current, at = toTile(px, py);
            cursor.current = { ...at, shown: true };
            if (e.button === 2) { choose(null); return; }
            if (e.pointerType === 'touch' && toolRef.current && !(armed.current && was.row === at.row && was.col === at.col)) { armed.current = true; say('Tap again to plant here.'); return; }
            armed.current = false;
            act(at.row, at.col);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {note && <output className="cz-note">{note}</output>}
        {overlay && <div className="cz-overlay"><div>{overlay}</div></div>}
      </div>
      <div className="cz-controls">
        <span className="cz-level-name">Night {g.level + 1} · {g.def.name}</span>
        <div className="cz-progress" aria-label={`Level progress ${Math.round(g.progress * 100)}%`}>
          <i style={{ width: `${g.progress * 100}%` }} />
          {g.def.flags.map((f) => <b key={f} style={{ left: `${((f + 0.5) / g.def.waves) * 100}%` }}>⚑</b>)}
        </div>
        <span className="cz-spacer" />
        <button onClick={() => { if (g.collectAll()) refresh(); }}>Collect seeds · Space</button>
        <button onClick={() => setGameSpeed(speed === 3 ? 1 : speed + 1)}>{speed}× · F</button>
        <button onClick={() => { g.pause(); refresh(); }} disabled={g.state === 'won' || g.state === 'lost'}>{g.state === 'paused' ? 'Resume' : 'Pause'} · P</button>
      </div>
      <p className="cz-tip">{tool === 'shovel' ? 'Click a defender to dig it up.' : tool ? `Planting ${DEFENDERS[tool].name}: click a tile on the lawn.` : `Tip: ${g.def.tip}`}</p>
    </main>
  );
}
