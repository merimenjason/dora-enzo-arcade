/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  MazeGame, MAPS, TOWERS, TOWER_IDS, ENEMIES, WAVES, TOTAL_WAVES, COLS, ROWS, START_RAISINS,
  type TowerId, type Tower, type EnemyId, type BuildResult,
} from '../../lib/hay-maze-game';
import { drawMaze, drawTowerIcon, drawCritterIcon, toGrid, lookOf, VIEW_W, VIEW_H, type Ghost } from '../../lib/hay-maze-scene';
import { COATS, drawChinchilla } from '../../lib/chinchilla-art';
import './hay-maze.css';

const SAVE_KEY = 'hay-maze-v1', DT = 1 / 60, SCALE = 2;
type Save = { cleared: number; best: Record<string, number> };
const readSave = (): Save => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '');
    const best: Record<string, number> = {};
    for (const m of MAPS) if (Number.isFinite(s?.best?.[m.id])) best[m.id] = Math.max(0, Math.min(START_RAISINS, Number(s.best[m.id])));
    return { cleared: Math.max(0, Math.min(MAPS.length, Number(s.cleared) || 0)), best };
  } catch { return { cleared: 0, best: {} }; }
};
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, progress just isn't kept */ } };

const REFUSED: Record<Exclude<BuildResult, 'ok'>, string> = {
  hay: 'Not enough hay yet.',
  taken: 'Something is already there.',
  blocked: 'That would shut them out completely. Leave them a way through.',
  occupied: 'A predator is standing there.',
  state: '', bounds: '',
};
const KEYS: TowerId[] = ['hay', 'flicker', 'puffer', 'roller', 'bell', 'glider'];
const HITS = { none: 'Blocks the way', ground: 'Ground only', air: 'Flyers only', both: 'Ground and flyers' };

function Icon({ draw, w, h }: { draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    draw(c, w, h);
  }, [draw, w, h]);
  return <canvas ref={ref} width={w * SCALE} height={h * SCALE} style={{ width: w, height: h }} aria-hidden="true" />;
}
const towerIcon = (kind: TowerId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawTowerIcon(c, kind, w, h, 0.5);
const critterIcon = (kind: EnemyId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawCritterIcon(c, kind, w, h);
const heroes = (c: CanvasRenderingContext2D, w: number, h: number) => {
  drawTowerIcon(c, 'hay', w, h);
  drawChinchilla(c, COATS.dora, w * 0.34, h * 0.9, { face: 1, h: h * 0.46, time: 0.3 });
  drawChinchilla(c, COATS.enzo, w * 0.74, h * 0.9, { face: -1, h: h * 0.54, time: 1.8 });
};

/** The enemies of wave `n` (1-based), totalled by kind. */
const lineup = (n: number) => {
  const out = new Map<EnemyId, number>();
  for (const [kind, count] of WAVES[n - 1] ?? []) out.set(kind, (out.get(kind) ?? 0) + count);
  return [...out];
};

export default function HayMaze() {
  const [save, setSave] = useState<Save>({ cleared: 0, best: {} });
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'play'>('home');
  const [build, setBuild] = useState<TowerId | null>(null);
  const [, setPicked] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState('');
  const [, setTick] = useState(0);
  const game = useRef<MazeGame | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<{ c: number; r: number; shown: boolean }>({ c: 8, r: 5, shown: false });
  const buildRef = useRef<TowerId | null>(null), pickedRef = useRef<number | null>(null), speedRef = useRef(1);
  const ghostCache = useRef<{ key: string; d?: Int32Array; ok: boolean } | null>(null);
  const recorded = useRef<MazeGame | null>(null);
  const noteTimer = useRef(0);
  /** A touch tap has previewed a tile and the next tap on it builds. */
  const armed = useRef(false);

  useEffect(() => { setSave(readSave()); setLoaded(true); }, []);
  // The browser test reads and fast-forwards the running game through this.
  useEffect(() => { (window as unknown as { __maze?: () => MazeGame | null }).__maze = () => game.current; }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (text: string) => { if (!text) return; setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2000); };
  const chooseBuild = (kind: TowerId | null) => { buildRef.current = kind; setBuild(kind); if (kind) { pickedRef.current = null; setPicked(null); } };
  const choosePicked = (id: number | null) => { pickedRef.current = id; setPicked(id); if (id !== null) { buildRef.current = null; setBuild(null); } };
  const setGameSpeed = (s: number) => { speedRef.current = s; setSpeed(s); };

  function begin(round: number) {
    game.current = new MazeGame(round);
    recorded.current = null;
    chooseBuild(null); choosePicked(null); setGameSpeed(1);
    cursor.current = { c: 8, r: 5, shown: false };
    setScreen('play');
    refresh();
  }

  /** Builds or selects on tile (c, r), as a click or Enter would. */
  function act(c: number, r: number) {
    const g = game.current;
    if (!g || !g.inGrid(c, r) || g.state === 'won' || g.state === 'lost') return;
    const kind = buildRef.current, there = g.towerAt(c, r);
    if (kind && !there) {
      const result = g.build(kind, c, r);
      ghostCache.current = null;
      if (result !== 'ok') say(REFUSED[result]);
      refresh();
      return;
    }
    choosePicked(there ? there.id : null);
    refresh();
  }

  const selectedTower = (): Tower | null => game.current?.towers.find((t) => t.id === pickedRef.current) ?? null;
  function upgrade() { const g = game.current, t = selectedTower(); if (!g || !t) return; if (!g.upgrade(t)) say(g.upgradeCost(t) === null ? 'Already at the top level.' : 'Not enough hay yet.'); refresh(); }
  function sell() { const g = game.current, t = selectedTower(); if (!g || !t) return; g.sell(t); ghostCache.current = null; choosePicked(null); refresh(); }
  function sendWave() { const g = game.current; if (g?.sendWave()) refresh(); }

  // The loop: fixed steps (more of them at 2× and 3×), a draw every frame, and a HUD refresh a few times a second.
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
      let ghost: Ghost = null;
      const kind = buildRef.current, at = cursor.current;
      if (kind && at.shown && g.inGrid(at.c, at.r)) {
        const key = `${kind}:${at.c}:${at.r}:${g.towers.length}:${Math.floor(g.hay)}:${g.enemies.length}`;
        if (ghostCache.current?.key !== key) {
          const ok = g.canBuild(kind, at.c, at.r) === 'ok';
          ghostCache.current = { key, ok, d: ok ? g.field(at.r * COLS + at.c) : undefined };
        }
        ghost = { kind, c: at.c, r: at.r, ok: ghostCache.current.ok, d: ghostCache.current.d };
      }
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawMaze(c, g, now / 1000, ghost, g.towers.find((t) => t.id === pickedRef.current) ?? null);
      if (now - ui > 120) { refresh(); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const blur = () => { if (game.current?.state === 'playing') { game.current.pause(); refresh(); } };
    window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', blur); };
  }, [screen]);

  // Keyboard: 1–6 pick a tower, arrows move the cursor, Enter builds or selects, U upgrades, Delete sells,
  // N or Space sends the next wave, F changes speed, P pauses, Escape cancels.
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || (e.target as HTMLElement).closest('input,textarea')) return;
      const k = e.key.toLowerCase(), onButton = !!(e.target as HTMLElement).closest('button,a');
      if (k === 'p') { g.pause(); refresh(); return; }
      if (k === 'escape') { if (buildRef.current || pickedRef.current !== null) { chooseBuild(null); choosePicked(null); } else { g.pause(); } refresh(); return; }
      if (g.state !== 'playing') return;
      const n = Number(k);
      if (n >= 1 && n <= KEYS.length) { const kind = KEYS[n - 1]; chooseBuild(buildRef.current === kind ? null : kind); cursor.current.shown = true; return; }
      const moves: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (moves[k]) { e.preventDefault(); const at = cursor.current; cursor.current = { c: Math.max(0, Math.min(COLS - 1, at.c + moves[k][0])), r: Math.max(0, Math.min(ROWS - 1, at.r + moves[k][1])), shown: true }; return; }
      if (k === 'enter' && !onButton) { e.preventDefault(); act(cursor.current.c, cursor.current.r); return; }
      if ((k === 'n' || (k === ' ' && !onButton))) { e.preventDefault(); sendWave(); return; }
      if (k === 'f') { setGameSpeed(speedRef.current === 3 ? 1 : speedRef.current + 1); return; }
      if (k === 'u') { upgrade(); return; }
      if (k === 'delete' || k === 'backspace') { sell(); return; }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const g = game.current;
  // Record a win once.
  if (g && g.state === 'won' && recorded.current !== g) {
    recorded.current = g;
    const next = { cleared: Math.max(save.cleared, g.round + 1), best: { ...save.best, [g.map.id]: Math.max(save.best[g.map.id] ?? 0, g.raisins) } };
    setSave(next); writeSave(next);
  }

  const header = (
    <header className="hm-header">
      <a className="hm-back" href="/">← MAIN ARCADE</a>
      <span className="hm-brand">HAY MAZE DEFENCE</span>
      <span />
    </header>
  );

  if (screen === 'home' || !g) {
    return (
      <main className="hm-shell">
        {header}
        <section className="hm-intro">
          <Icon draw={heroes} w={150} h={96} />
          <div>
            <p className="hm-eyebrow">TOWER DEFENCE · BUILD THE MAZE</p>
            <h1>Hay Maze Defence</h1>
            <p className="hm-lede">Weasels, foxes, snakes, badgers, hawks and a lynx are after Dora and Enzo’s <b>raisin stash</b>. They always take the shortest way to the burrow, so every tower you build is also a wall. Stack hay bales and towers into a long, winding maze, slow them in Dora’s dust and send them to sleep with the Snooze Bell.</p>
          </div>
        </section>

        <h2 className="hm-section">Pick a meadow <small>hold off twenty waves to win; each win opens the next</small></h2>
        <div className="hm-maps">
          {MAPS.map((m, i) => {
            const open = i <= save.cleared, best = save.best[m.id];
            return (
              <article key={m.id} className={`hm-map${open ? '' : ' locked'}`} style={{ '--map-sky': lookOf(m.id).sky } as React.CSSProperties}>
                <MapPreview index={i} />
                <div>
                  <p className="hm-eyebrow">MAP {i + 1}{m.tough !== 1 ? ` · ${m.tough > 1 ? 'TOUGHER' : 'GENTLER'} PREDATORS` : ''}</p>
                  <strong>{m.name}</strong>
                  <small>{m.blurb}</small>
                  <em>{best !== undefined ? `✓ Won with ${best} raisin${best === 1 ? '' : 's'} left` : open ? 'Open' : `🔒 Win ${MAPS[i - 1].name} to open`}</em>
                </div>
                <button className="hm-go" data-testid={`play-${m.id}`} disabled={!open || !loaded} onClick={() => begin(i)}>{best !== undefined ? 'PLAY AGAIN' : 'PLAY'}</button>
              </article>
            );
          })}
        </div>

        <h2 className="hm-section">The crew</h2>
        <div className="hm-roster">
          {TOWER_IDS.map((id, i) => {
            const t = TOWERS[id], lv = t.levels[0];
            return (
              <div key={id} className="hm-card">
                <Icon draw={towerIcon(id)} w={56} h={48} />
                <div>
                  <strong>{i + 1} · {t.name} <span className="hm-cost">{t.cost} hay</span></strong>
                  <small>{HITS[t.hits]}{lv.slow ? ` · slows ${lv.slow * 100}%` : ''}{lv.stun ? ` · naps ${lv.stun}s` : ''}{lv.splash ? ' · splash' : ''}</small>
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
                  <small>{e.air ? 'Flies over the maze' : e.speed > 1.4 ? 'Fast' : e.speed < 0.8 ? 'Slow' : 'Steady'}{e.armor ? ` · armour ${e.armor}` : ''}{e.slowResist ? ' · shrugs off dust' : ''}{e.steal > 1 ? ` · steals ${e.steal} raisins` : ''}</small>
                </div>
              </div>
            );
          })}
        </div>

        <section className="hm-help">
          <p><b>Build the maze.</b> Predators always take the shortest open way, shown by the dotted line. Towers and bales block their tile, so the line bends round them. You can never close the way completely.</p>
          <p><b>Slow them down.</b> Dora’s dust slows everything walking through it, and the Snooze Bell stops them where they stand. Hawks fly straight over, so keep Glider Nests near the burrow.</p>
          <p><b>Earn hay.</b> Every predator caught pays hay, and each wave pays a bonus. Send a wave early for a hay per second saved. Sell a tower for 70% back.</p>
        </section>
      </main>
    );
  }

  const tower = selectedTower(), def = tower ? TOWERS[tower.kind] : null, lv = tower && def ? def.levels[tower.level] : null;
  const upCost = tower ? g.upgradeCost(tower) : null, nextLv = tower && def && upCost !== null ? def.levels[tower.level + 1] : null;
  const waveReady = g.state === 'playing' && !g.queue.length && g.wave < TOTAL_WAVES;
  const upcoming = g.wave < TOTAL_WAVES ? lineup(g.wave + 1) : [];
  let overlay: React.ReactNode = null;
  if (g.state === 'paused') overlay = <><p className="hm-eyebrow">PAUSED</p><h2>A quiet moment in the meadow.</h2><button className="hm-go" onClick={() => { g.pause(); refresh(); }}>Back to the maze →</button><button onClick={() => setScreen('home')}>Leave for the map</button></>;
  else if (g.state === 'won') {
    const next = g.round + 1 < MAPS.length;
    overlay = <><p className="hm-eyebrow">ALL {TOTAL_WAVES} WAVES HELD</p><h2>The stash is safe!</h2><p>Dora and Enzo kept {g.raisins} of {START_RAISINS} raisins. {g.kills} predators turned back.</p>{next && <button className="hm-go" data-testid="next-map" onClick={() => begin(g.round + 1)}>{`On to ${MAPS[g.round + 1].name} →`}</button>}<button className={next ? '' : 'hm-go'} onClick={() => begin(g.round)}>Play again</button><button onClick={() => setScreen('home')}>Map select</button></>;
  } else if (g.state === 'lost') overlay = <><p className="hm-eyebrow">WAVE {g.wave} · THE STASH IS GONE</p><h2>Not a raisin left.</h2><p>{g.kills} predators turned back. A longer maze buys more time.</p><button className="hm-go" onClick={() => begin(g.round)}>Try again →</button><button onClick={() => setScreen('home')}>Map select</button></>;

  return (
    <main className="hm-shell hm-play">
      {header}
      <div className="hm-hud">
        <span><small>MAP</small><b>{g.map.name}</b></span>
        <span data-testid="wave"><small>WAVE</small><b>{g.wave}/{TOTAL_WAVES}</b></span>
        <span data-testid="raisins" className={g.raisins <= 5 ? 'low' : ''}><small>RAISINS</small><b>🍇 {g.raisins}</b></span>
        <span data-testid="hay"><small>HAY</small><b>🌾 {g.hay}</b></span>
        <span><small>THEIR WALK</small><b>{g.walk} tiles</b></span>
      </div>
      <div className="hm-board">
        <canvas
          ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
          data-testid="board" data-state={g.state} data-walk={g.walk} data-towers={g.towers.length}
          aria-label="The meadow. Pick a tower with 1 to 6, move with the arrow keys and press Enter to build, or click a tile."
          onPointerMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(), at = toGrid(((e.clientX - rect.left) / rect.width) * VIEW_W, ((e.clientY - rect.top) / rect.height) * VIEW_H); cursor.current = { ...at, shown: true }; }}
          onPointerLeave={() => { cursor.current.shown = false; }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect(), at = toGrid(((e.clientX - rect.left) / rect.width) * VIEW_W, ((e.clientY - rect.top) / rect.height) * VIEW_H);
            const was = cursor.current;
            cursor.current = { ...at, shown: true };
            if (e.button === 2) { chooseBuild(null); choosePicked(null); return; }
            // Tiles are small on a touch screen, so the first tap shows the tower and its new route; a second tap builds.
            const g = game.current;
            if (e.pointerType === 'touch' && buildRef.current && g && !g.towerAt(at.c, at.r) && !(armed.current && was.c === at.c && was.r === at.r)) {
              armed.current = true; say('Tap again to build here.'); return;
            }
            armed.current = false;
            act(at.c, at.r);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {note && <output className="hm-note">{note}</output>}
        {overlay && <div className="hm-overlay"><div>{overlay}</div></div>}
      </div>
      <div className="hm-controls">
        <button className="hm-go" data-testid="send-wave" disabled={!waveReady} onClick={sendWave}>
          {g.wave === 0 ? 'Start wave 1 →' : g.wave >= TOTAL_WAVES ? 'Final wave' : g.queue.length ? `Wave ${g.wave} arriving…` : `Send wave ${g.wave + 1} now${g.countdown ? ` · +${Math.floor(g.countdown)} hay` : ''}`}
        </button>
        {upcoming.length > 0 && <span className="hm-next" aria-label={`Next wave: ${upcoming.map(([k, n]) => `${n} ${ENEMIES[k].name}`).join(', ')}`}>
          <small>{g.countdown !== null && !g.queue.length ? `NEXT IN ${Math.ceil(g.countdown)}s` : 'NEXT'}</small>
          {upcoming.map(([k, n]) => <span key={k} className={ENEMIES[k].air ? 'air' : ''}><Icon draw={critterIcon(k)} w={30} h={22} />×{n}</span>)}
        </span>}
        <span className="hm-spacer" />
        <button onClick={() => setGameSpeed(speed === 3 ? 1 : speed + 1)} aria-label={`Speed ${speed}×`}>{speed}× · F</button>
        <button onClick={() => { g.pause(); refresh(); }} disabled={g.state === 'won' || g.state === 'lost'}>{g.state === 'paused' ? 'Resume' : 'Pause'} · P</button>
      </div>
      <section className="hm-palette" aria-label="Build">
        {KEYS.map((id, i) => {
          const t = TOWERS[id];
          return (
            <button key={id} data-testid={`build-${id}`} className={`hm-tool${build === id ? ' on' : ''}${g.hay < t.cost ? ' poor' : ''}`} aria-pressed={build === id} onClick={() => { chooseBuild(build === id ? null : id); canvas.current?.focus(); }}>
              <Icon draw={towerIcon(id)} w={44} h={38} />
              <span>{i + 1} · {t.name.replace(/^(Dora|Enzo)’s /, '')}</span>
              <b>🌾 {t.cost}</b>
            </button>
          );
        })}
      </section>
      {tower && def && lv ? (
        <section className="hm-inspect" aria-label="Selected tower">
          <strong>{def.name} <small>level {tower.level + 1}</small></strong>
          <span>{HITS[def.hits]}{lv.range ? ` · range ${lv.range}` : ''}{lv.dmg ? ` · ${lv.dmg} damage` : ''}{lv.slow ? ` · slows ${Math.round(lv.slow * 100)}%` : ''}{lv.stun ? ` · naps ${lv.stun}s` : ''}</span>
          {nextLv && <span className="hm-up">Next: {nextLv.dmg} damage{nextLv.range ? `, range ${nextLv.range}` : ''}{nextLv.slow ? `, slows ${Math.round(nextLv.slow * 100)}%` : ''}{nextLv.stun ? `, naps ${nextLv.stun}s` : ''}</span>}
          <span className="hm-spacer" />
          {upCost !== null && <button className="hm-go" data-testid="upgrade" disabled={g.hay < upCost} onClick={upgrade}>Upgrade · 🌾 {upCost} · U</button>}
          <button data-testid="sell" onClick={sell}>Sell · +{g.refund(tower)} · Del</button>
        </section>
      ) : (
        <p className="hm-keys">{build ? `Building ${TOWERS[build].name}: click tiles to place, right-click or Escape to stop.` : 'Pick something to build, or click a tower to upgrade or sell it.'} 1–6 pick · arrows + Enter build · N next wave · F speed · P pause</p>
      )}
    </main>
  );
}

/** A tiny drawing of a map for the map select: rocks, entrances and the burrow. */
function MapPreview({ index }: { index: number }) {
  const draw = (c: CanvasRenderingContext2D, w: number, h: number) => {
    const g = new MazeGame(index), look = lookOf(g.map.id), s = w / (COLS + 1);
    c.fillStyle = look.a; c.fillRect(0, 0, w, h);
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if (g.rock(col, r)) { c.fillStyle = look.rock; c.fillRect(col * s + 1, r * s + 1, s - 1, s - 1); }
    c.strokeStyle = look.route; c.lineWidth = 1.5; c.setLineDash([1.5, 3]);
    for (let e = 0; e < g.entrances.length; e++) { c.beginPath(); g.route(e).forEach(([pc, pr], i) => { if (i) c.lineTo(pc * s + s / 2, pr * s + s / 2); else c.moveTo(pc * s + s / 2, pr * s + s / 2); }); c.stroke(); }
    c.setLineDash([]);
    for (const [ec, er] of g.entrances) { c.fillStyle = '#e8483c'; c.fillRect(ec * s, er * s, s, s); }
    for (const [, er] of g.exits) { c.fillStyle = '#6b4e30'; c.fillRect(COLS * s, er * s, s, s); }
  };
  return <Icon draw={draw} w={126} h={Math.round((126 / (COLS + 1)) * ROWS)} />;
}
