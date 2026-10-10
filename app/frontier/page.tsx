/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Game, MAPS, BUILDINGS, HEROES, DENS, EVENTS, HOME, W, H, HQ_COST, HQ_MAX, STAMINA_MAX, ATTACK_COST, RES_IDS,
  hqMaxHp, heroPower, trainCost, type BuildingId, type HeroId, type Refusal, type Res, type Terrain,
} from '../../lib/frontier-game';
import { drawWorld, drawBuildingIcon, drawHeroIcon, drawDenIcon, drawTitle, tileAt, camFor, VIEW, type Fx, type Cam } from '../../lib/frontier-scene';
import { loadFrontierArt, frontierArtReady } from '../../lib/frontier-art';
import { drawBurrowIcon, drawResourceIcon } from '../../lib/frontier-scene';
import './frontier.css';
import { sound } from './sound';

const SAVE_KEY = 'frostpaw-frontier-v1', RUN_KEY = 'frostpaw-frontier-run-v1', DT = 1 / 60, SCALE = 2;
type Progress = { stars: number[] };
const readProgress = (): Progress => {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}'); return { stars: MAPS.map((_, i) => Math.max(0, Math.min(3, Number(o?.stars?.[i]) || 0))) }; } catch { return { stars: MAPS.map(() => 0) }; }
};
const writeProgress = (p: Progress) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { /* private mode: progress just isn't kept */ } };
/** The run in progress. It is kept while it's being played and dropped as soon as it is won or lost. */
const readRun = (): Game | null => { try { const raw = localStorage.getItem(RUN_KEY); return raw ? Game.load(JSON.parse(raw)) : null; } catch { return null; } };
const writeRun = (g: Game | null) => {
  try { if (g && (g.state === 'playing' || g.state === 'paused' || g.state === 'event')) localStorage.setItem(RUN_KEY, JSON.stringify(g.snapshot())); else localStorage.removeItem(RUN_KEY); } catch { /* see writeProgress */ }
};

/** The buildings in seed-bar order; 1–7 pick them. */
const TOOLS: BuildingId[] = ['farm', 'lodge', 'nest', 'quarry', 'lantern', 'tower', 'beacon'];
const RES_ICON: Record<string, string> = { hay: '🌾', wood: '🪵', stone: '🪨' };
const TERRAIN: Record<Terrain, [string, string]> = {
  meadow: ['Meadow', 'Open grass. Farms, nests, lanterns and watchtowers go here.'],
  grove: ['Grove', 'Mountain trees. Build a Twig Lodge here for wood.'],
  rocks: ['Rocky ground', 'Loose stone. A Pebble Quarry here makes stone; lanterns and towers fit too.'],
  snow: ['Snowfield', 'Deep snow. Slow to cross (2 stamina, 1 with Dora). Only a watchtower stands in it.'],
  crag: ['Crag', 'Sheer rock. Nothing can be built, and the cloud can’t be cleared beyond it from here.'],
};
const REFUSED: Partial<Record<Refusal, string>> = {
  far: 'You can only explore next to land you already hold.',
  stamina: 'Not enough stamina. It comes back one point every 5 seconds.',
  terrain: 'That can’t be built on this ground.',
  taken: 'Something is already here.',
  hq: 'Raise the burrow first.',
  cost: 'Not enough supplies yet.',
  squad: 'Every hero is hurt. Wait for them to recover.',
  max: 'Already as high as it goes.',
  fog: 'That tile is still under the cloud.',
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const costText = (c: Partial<Res>) => RES_IDS.filter((k) => c[k]).map((k) => `${RES_ICON[k]} ${c[k]}`).join('  ') || 'free';

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

export default function FrostpawFrontier() {
  const [progress, setProgress] = useState<Progress>({ stars: MAPS.map(() => 0) });
  const [kept, setKept] = useState<Game | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'play'>('home');
  const [sel, setSel] = useState<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<BuildingId | null>(null);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState('');
  const [artStatus, setArtStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  function loadArtwork() { setArtStatus('loading'); void loadFrontierArt().then(() => { setArtStatus('ready'); setTick(t => t + 1); }).catch(() => setArtStatus('error')); }
  useEffect(() => { loadArtwork(); }, []);
  const [log, setLog] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const game = useRef<Game | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const selRef = useRef(sel), toolRef = useRef(tool), speedRef = useRef(1), progressRef = useRef(progress);
  const fx = useRef<Fx[]>([]);
  const cam = useRef<Cam | null>(null);
  const banked = useRef<Game | null>(null);
  const noteTimer = useRef(0);
  const motion = useRef(true);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'), sync = () => { motion.current = !media.matches; }; sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync); }, []);
  const hover = useRef<{ x: number; y: number } | null>(null);
  /** A touch tap has previewed this tile; the next tap on it acts. */
  const armed = useRef<string>('');

  useEffect(() => {
    const p = readProgress();
    progressRef.current = p; setProgress(p); setKept(readRun()); setMuted(sound.muted()); setLoaded(true);
    (window as unknown as { __frontier?: () => Game | null }).__frontier = () => game.current;
  }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (text: string) => { if (!text) return; setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2600); };
  const remember = (text: string) => setLog((l) => [text, ...l].slice(0, 6));
  const select = (s: { x: number; y: number } | null) => { selRef.current = s; setSel(s); };
  const pickTool = (t: BuildingId | null) => { toolRef.current = t; setTool(t); };
  const setGameSpeed = (s: number) => { speedRef.current = s; setSpeed(s); };
  const mute = () => { const m = !sound.muted(); sound.setMuted(m); setMuted(m); };

  function begin(map: number, g = new Game(map, (Date.now() % 100000) + 1)) {
    game.current = g; banked.current = null; fx.current = []; cam.current = camFor(g);
    pickTool(null); select({ ...HOME }); setGameSpeed(1); setLog([]);
    writeRun(g);
    setScreen('play');
    refresh();
  }
  function resume() {
    const g = readRun();
    if (!g) { setKept(null); return; }
    if (g.state === 'playing') g.state = 'paused';
    begin(g.map, g);
  }
  const toHome = () => { writeRun(game.current); setKept(readRun()); setScreen('home'); };
  /** Bank a finished run the moment it ends: its stars, if won, and the saved run is dropped. */
  function bank(g: Game) {
    if ((g.state !== 'won' && g.state !== 'lost') || banked.current === g) return;
    banked.current = g;
    writeRun(g); // drops the saved run
    if (g.state === 'lost') return;
    const stars = [...progressRef.current.stars];
    stars[g.map] = Math.max(stars[g.map], g.stars());
    const p = { stars };
    progressRef.current = p; setProgress(p); writeProgress(p);
  }

  /** The main thing to do on a tile: explore it, or attack the den on it. */
  function primary(x: number, y: number) {
    const g = game.current;
    if (!g || g.state !== 'playing') return;
    const t = g.tile(x, y);
    if (!t) return;
    if (!t.seen) { const r = g.explore(x, y); if (r !== 'ok') { say(REFUSED[r] ?? ''); sound.cue('nope'); } }
    else if (t.den && (t.f === 'den' || t.f === 'lair')) { const r = g.attack(x, y); if (r !== 'ok') { say(REFUSED[r] ?? ''); sound.cue('nope'); } }
    refresh();
  }
  function place(kind: BuildingId, x: number, y: number) {
    const g = game.current;
    if (!g) return;
    const r = g.build(kind, x, y);
    if (r === 'ok') pickTool(null); else { say(REFUSED[r] ?? ''); sound.cue('nope'); }
    refresh();
  }

  // The loop: step the engine, turn its events into sounds and floating words, draw, and save now and then.
  useEffect(() => {
    if (screen !== 'play') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, acc = 0, ui = 0, saved = 0;
    const loop = (now: number) => {
      const g = game.current;
      if (!g) return;
      const step = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      acc += step * speedRef.current;
      while (acc >= DT) { g.update(DT); acc -= DT; }
      bank(g);
      for (const e of g.events.splice(0)) {
        const at = (kind: Fx['kind'], text?: string, color?: string) => { if (e.x !== undefined && e.y !== undefined) fx.current.push({ kind, x: e.x, y: e.y, t: 0, text, color }); };
        if (e.type === 'reveal') { at('puff'); sound.cue('reveal', 0, 1, 0.05); continue; }
        sound.cue(e.type as Parameters<typeof sound.cue>[0]);
        if (e.type === 'cache') { at('text', e.text, '#ffe28a'); remember(`Found a cache: ${e.text}.`); }
        else if (e.type === 'join') { at('text', '+1 chinchilla', '#bff08a'); remember('A chinchilla joined the burrow.'); }
        else if (e.type === 'hero') { at('burst', undefined, '#c9b6ff'); say(`${e.text} joins your heroes!`); remember(`${e.text} joined your heroes.`); }
        else if (e.type === 'build') at('text', e.text);
        else if (e.type === 'win-fight') { at('burst'); say(`The ${e.text} is cleared!`); remember(`Cleared the ${e.text}.`); }
        else if (e.type === 'lose-fight') { at('text', 'Beaten back!', '#ff8a6a'); say(`The ${e.text} was too strong. Your heroes need ${30} seconds to recover.`); remember(`Beaten back from the ${e.text}.`); }
        else if (e.type === 'night') remember(`Night ${e.value} falls. A raid is coming.`);
        else if (e.type === 'raid-held') remember(`The raid (${e.value}) was held off.`);
        else if (e.type === 'raid-hit') remember(`The raid broke in by ${e.value} and stole supplies.`);
        else if (e.type === 'damaged') { at('text', 'Damaged!', '#ff8a6a'); remember(`The ${e.text} was damaged. Repair it from its panel.`); }
        else if (e.type === 'leave') { say('Someone left: there was no hay!'); remember('A hungry chinchilla left the burrow.'); }
        else if (e.type === 'upgrade') remember(`The burrow is now level ${e.value}.`);
        else if (e.type === 'train') remember(`${e.text} trained to level ${e.value}.`);
      }
      for (const f of fx.current) f.t += step;
      fx.current = fx.current.filter((f) => f.t < 1.6);
      const t = toolRef.current, hv = hover.current ?? selRef.current;
      const ghost = t && hv ? { kind: t, x: hv.x, y: hv.y, ok: g.canBuild(t, hv.x, hv.y) === 'ok' } : null;
      // The camera eases out as the land grows.
      const want = camFor(g), cm = cam.current ?? want, ease = motion.current ? Math.min(1, step * 3) : 1;
      cam.current = { x: cm.x + (want.x - cm.x) * ease, y: cm.y + (want.y - cm.y) * ease, size: cm.size + (want.size - cm.size) * ease };
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawWorld(c, g, motion.current ? g.time : 0, { sel: selRef.current, ghost, fx: motion.current ? fx.current : fx.current.filter(f => f.kind === 'text'), cam: cam.current });
      if (now - ui > 150) { refresh(); ui = now; }
      if (now - saved > 2000) { writeRun(g); saved = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const blur = () => { if (game.current?.state === 'playing') { game.current.pause(); refresh(); } };
    const keep = () => writeRun(game.current);
    const hide = () => { if (document.hidden) { blur(); keep(); } };
    window.addEventListener('blur', blur); window.addEventListener('pagehide', keep); document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', keep); document.removeEventListener('visibilitychange', hide); keep(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the loop reads refs
  }, [screen]);

  // Keyboard: arrows move, Enter explores or attacks (or builds with a building picked), 1–7 pick a building,
  // U raises the burrow, H jumps home, F speed, P pause, M sound, Escape cancels.
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || (e.target as HTMLElement).closest('input,textarea')) return;
      const k = e.key.toLowerCase(), onButton = !!(e.target as HTMLElement).closest('button,a');
      if (k === 'm') { mute(); return; }
      if (g.state === 'event') { if (k === '1' || k === '2') { g.choose(k === '1' ? 0 : 1); refresh(); } return; }
      if (k === 'p' || (k === 'escape' && !toolRef.current)) { if (g.state === 'playing' || g.state === 'paused') { g.pause(); refresh(); } return; }
      if (g.state !== 'playing') return;
      if (k === 'escape') { pickTool(null); return; }
      if (k === 'f') { setGameSpeed(speedRef.current === 3 ? 1 : speedRef.current + 1); return; }
      if (k === 'h') { select({ ...HOME }); return; }
      if (k === 'u') { const r = g.upgrade(); if (r !== 'ok') say(REFUSED[r] ?? ''); refresh(); return; }
      const n = Number(k);
      if (n >= 1 && n <= TOOLS.length) { pickTool(toolRef.current === TOOLS[n - 1] ? null : TOOLS[n - 1]); return; }
      const moves: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (moves[k]) {
        e.preventDefault();
        const s = selRef.current ?? HOME;
        hover.current = null;
        select({ x: Math.max(0, Math.min(W - 1, s.x + moves[k][0])), y: Math.max(0, Math.min(H - 1, s.y + moves[k][1])) });
        return;
      }
      if (k === 'enter' && !onButton) {
        e.preventDefault();
        const s = selRef.current;
        if (!s) return;
        if (toolRef.current) place(toolRef.current, s.x, s.y); else primary(s.x, s.y);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const g = game.current;
  const header = (
    <header className="ff-header">
      <a className="ff-back" href="/">← MAIN ARCADE</a>
      <span className="ff-brand">❄ Frostpaw Frontier</span>
      <button className="ff-mute" onClick={mute} aria-pressed={muted} aria-label={muted ? 'Sound off (M)' : 'Sound on (M)'}>{muted ? '🔇' : '🔊'}</button>
    </header>
  );

  if (screen === 'home' || !g) {
    return (
      <main className="ff-shell" data-art-ready={frontierArtReady()}>
        {header}
        {artStatus === 'error' && <output className="ff-art-status">Painted artwork could not load. <button onClick={loadArtwork}>Retry artwork</button></output>}
        <section className="ff-intro">
          <Icon draw={(c, w, h) => drawTitle(c, w, h, 1)} w={220} h={140} />
          <div>
            <p className="ff-eyebrow">SURVIVAL BUILDER · TILE BY TILE · THREE MOUNTAINS</p>
            <h1>Frostpaw Frontier</h1>
            <p className="ff-lede">Winter is coming to the Andes. Lead Dora, Enzo and a band of chinchillas out of the burrow, <b>uncover the mountain tile by tile</b>, put everyone to work, and hold the burrow against the predators that raid <b>every night</b>. Clear the cougar from the summit and light the <b>Summit Beacon</b> to call the herd home.</p>
          </div>
        </section>
        {kept && <button className="ff-go ff-continue" data-testid="continue" onClick={resume}>Continue your run: {MAPS[kept.map].name}, day {kept.day} →</button>}
        <h2 className="ff-section">Choose a mountain <small>light the beacon to open the next</small></h2>
        <div className="ff-maps">
          {MAPS.map((m, i) => {
            const open = i === 0 || progress.stars[i - 1] > 0, s = progress.stars[i];
            return (
              <button key={m.name} className={`ff-map${s ? ' done' : ''}`} data-testid={`map-${i + 1}`} disabled={!open || !loaded} onClick={() => begin(i)}>
                <em>{i + 1}</em>
                <strong>{m.name}</strong>
                <small>{open ? m.blurb : `Light the beacon on ${MAPS[i - 1].name} to open.`}</small>
                <span aria-label={`${s} of 3 stars`}>{'★'.repeat(s)}{'☆'.repeat(3 - s)} <i>3★ by day {m.par}</i></span>
              </button>
            );
          })}
        </div>
        <h2 className="ff-section">How it works</h2>
        <ul className="ff-how">
          <li><b>Explore.</b> Click a cloudy tile next to your land to uncover it. It costs stamina, which refills a point every 5 seconds. You may find supplies, lost chinchillas, heroes, rumours or predator dens.</li>
          <li><b>Build and work.</b> Hay Farms on meadows, Twig Lodges on groves, Pebble Quarries on rocks. Survivors take jobs on their own; move them with − and +. Everyone eats hay.</li>
          <li><b>Power up.</b> A Glow Lantern burns wood to light the tiles around it, and lit workshops work half as fast again.</li>
          <li><b>Survive the night.</b> Each night a raid comes. Your burrow, watchtowers and heroes add up to your defence. If the raid is stronger, it steals supplies and damages buildings.</li>
          <li><b>Heroes.</b> Your heroes clear dens when their combined power is high enough. Find more in old ruins and train them at the burrow.</li>
        </ul>
        <h2 className="ff-section">Heroes</h2>
        <div className="ff-roster">
          {(Object.keys(HEROES) as HeroId[]).map((id) => (
            <div key={id} className="ff-card">
              <Icon draw={(c, w, h) => drawHeroIcon(c, id, w, h)} w={52} h={46} />
              <div><strong>{HEROES[id].name} <span>power {HEROES[id].power}</span></strong><p>{HEROES[id].blurb}</p><small>{HEROES[id].perk}</small></div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ---------- Playing ----------
  const inc = g.income(), raidNext = g.raidStrength(g.night ? g.day + 1 : g.day), def = g.defence();
  const s = sel, t = s ? g.tile(s.x, s.y) : null, b = s ? g.buildingAt(s.x, s.y) : null;
  const perMin = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 60)}/min`;

  let panel: React.ReactNode = <p className="ff-muted">Select a tile on the map.</p>;
  if (s && t) {
    if (!t.seen) {
      const r = g.canExplore(s.x, s.y);
      panel = <>
        <h3>Under the cloud</h3>
        <p className="ff-muted">Who knows what’s here? Supplies, a lost chinchilla, an old ruin, or a predator’s den.</p>
        <button className="ff-go" data-testid="explore" disabled={r !== 'ok'} onClick={() => primary(s.x, s.y)}>Explore · {g.staminaCost(s.x, s.y)} stamina</button>
        {r !== 'ok' && <p className="ff-warn">{REFUSED[r]}</p>}
      </>;
    } else if (t.f === 'home') {
      const next = g.hqLevel < HQ_MAX ? HQ_COST[g.hqLevel] : null;
      panel = <>
        <h3>The Burrow · level {g.hqLevel}</h3>
        <div className="ff-burrow-picture"><Icon draw={drawBurrowIcon} w={260} h={145} /></div>
        <div className="ff-stats">
          <span>Walls <b>{Math.ceil(g.hqHp)}/{hqMaxHp(g.hqLevel)}</b></span>
          <span>Homes <b>{g.survivors}/{g.housing}</b></span>
          <span>Defence <b>{def}</b></span>
        </div>
        {next ? <button className="ff-go" data-testid="upgrade" disabled={g.canUpgrade() !== 'ok'} onClick={() => { g.upgrade(); refresh(); }}>Raise to level {g.hqLevel + 1} (U) · {costText(next)}</button>
          : <p className="ff-muted">The burrow is as big as it gets. Light the beacon on the summit!</p>}
        <p className="ff-muted small">Each level adds 2 homes, 8 defence and 40 wall strength, unlocks more buildings and lets heroes train one level higher.</p>
        <h3>Heroes <small>squad power {g.squadPower}</small></h3>
        <ul className="ff-heroes">
          {g.heroes.map((h) => (
            <li key={h.id}>
              <Icon draw={(c, w, hh) => drawHeroIcon(c, h.id, w, hh, h.hurt > 0)} w={72} h={70} />
              <div><strong>{HEROES[h.id].name} · lv {h.level}</strong><small>power {heroPower(h)}{h.hurt > 0 ? ` · hurt ${Math.ceil(h.hurt)}s` : ''}</small><small className="ff-perk">{HEROES[h.id].perk}</small></div>
              <button data-testid={`train-${h.id}`} disabled={g.canTrain(h.id) !== 'ok'} onClick={() => { g.train(h.id); refresh(); }} title={g.canTrain(h.id) === 'hq' ? 'Raise the burrow to train higher' : ''}>Train · {costText(trainCost(h))}</button>
            </li>
          ))}
        </ul>
      </>;
    } else if (t.den && (t.f === 'den' || t.f === 'lair')) {
      const d = DENS[t.den], r = g.canAttack(s.x, s.y), win = g.squadPower >= d.power;
      panel = <>
        <div className="ff-titled"><Icon draw={(c, w, h) => drawDenIcon(c, t.den!, w, h)} w={56} h={44} /><h3>{d.name}</h3></div>
        <div className="ff-stats"><span>Den power <b>{d.power}</b></span><span>Your squad <b className={win ? 'ok' : 'bad'}>{g.squadPower}</b></span><span>Adds to raids <b>+{d.raid}</b></span></div>
        <p className="ff-muted">{t.f === 'lair' ? 'The cougar guards the summit. Beat it and the beacon can be built here.' : 'Clearing it opens the land beyond, makes the raids weaker and pays out supplies.'} If your heroes’ power falls short they come home hurt for 30 seconds.</p>
        <button className={win ? 'ff-go' : ''} data-testid="attack" disabled={r !== 'ok'} onClick={() => primary(s.x, s.y)}>Attack · {ATTACK_COST} stamina{win ? '' : ' (too strong!)'}</button>
        {r !== 'ok' && <p className="ff-warn">{REFUSED[r]}</p>}
      </>;
    } else if (b) {
      const d = BUILDINGS[b.kind], out = g.output(b);
      panel = <>
        <div className="ff-titled"><Icon draw={(c, w, h) => drawBuildingIcon(c, b.kind, w, h)} w={44} h={44} /><h3>{d.name}{b.damaged ? ' · damaged' : ''}</h3></div>
        <p className="ff-muted">{d.blurb}</p>
        {d.workers > 0 && <div className="ff-workers">
          <span>Workers <b data-testid="workers">{b.workers}/{d.workers}</b></span>
          <button aria-label="Fewer workers" data-testid="worker-minus" onClick={() => { g.assign(b.id, -1); refresh(); }} disabled={b.workers <= 0}>−</button>
          <button aria-label="More workers" data-testid="worker-plus" onClick={() => { g.assign(b.id, 1); refresh(); }} disabled={b.workers >= d.workers || g.idle <= 0}>+</button>
          <small>{g.idle} idle</small>
        </div>}
        {d.make && <p>Makes {RES_ICON[d.make]} <b>{perMin(out)}</b>{g.lit(b.x, b.y) ? ' · lit ✨' : ''}</p>}
        {b.kind === 'lantern' && <p>Lights every tile within {g.reach()} · burns {RES_ICON.wood} 5/min{g.stock.wood <= 0 ? ' · out of wood!' : ''}</p>}
        {b.kind === 'tower' && <p>Adds <b>{b.workers && !b.damaged ? d.defence : 0}</b> to the night defence.</p>}
        {b.kind === 'nest' && <p>Homes for {d.housing} chinchillas.</p>}
        {b.damaged && <button className="ff-go" data-testid="repair" disabled={!g.afford(g.repairCost(b))} onClick={() => { g.repair(b.id); refresh(); }}>Repair · {costText(g.repairCost(b))}</button>}
        {b.kind !== 'beacon' && g.state === 'playing' && <button className="ff-quiet" data-testid="demolish" onClick={() => { if (g.demolish(b.id)) { select({ ...s }); refresh(); } else say('Someone still lives there. Build another nest first.'); }}>Pull down (half back)</button>}
      </>;
    } else {
      const [name, blurb] = TERRAIN[t.t];
      const fits = TOOLS.filter((k) => BUILDINGS[k].on.includes(t.t) && (k !== 'beacon' || t.f === 'beacon'));
      panel = <>
        <h3>{t.f === 'stray' ? 'A lost chinchilla' : t.f === 'beacon' ? 'The summit' : name}</h3>
        <p className="ff-muted">{t.f === 'stray' ? 'Waiting in the snow for a home. Build a Snug Nest or raise the burrow and they’ll move in.' : t.f === 'beacon' ? 'The cougar is gone. Build the Summit Beacon here to call the herd home and win.' : blurb}</p>
        {!t.f || t.f === 'beacon' ? <div className="ff-build">
          {fits.map((k) => {
            const r = g.canBuild(k, s.x, s.y);
            return (
              <button key={k} data-testid={`build-${k}`} className={r === 'ok' ? '' : 'dim'} onClick={() => place(k, s.x, s.y)} title={REFUSED[r] ?? ''}>
                <Icon draw={(c, w, h) => drawBuildingIcon(c, k, w, h)} w={36} h={36} />
                <span><b>{BUILDINGS[k].name}</b><small>{costText(BUILDINGS[k].cost)}{r === 'hq' ? ` · burrow ${BUILDINGS[k].hq}` : ''}</small></span>
              </button>
            );
          })}
          {!fits.length && <p className="ff-muted">Nothing can be built here.</p>}
        </div> : null}
      </>;
    }
  }

  let overlay: React.ReactNode = null;
  if (g.state === 'paused') overlay = <><p className="ff-eyebrow">PAUSED · DAY {g.day}</p><h2>The mountain waits.</h2><button className="ff-go" onClick={() => { g.pause(); refresh(); }}>Back to the frontier →</button><button onClick={toHome}>Save and leave</button></>;
  else if (g.state === 'event' && g.pending) {
    const e = EVENTS[g.pending.event];
    overlay = <><p className="ff-eyebrow">RUMOUR</p><h2>{e.title}</h2><p>{e.text}</p>
      {e.choices.map((ch, i) => {
        const c = ch.cost ?? {}, ok = g.afford(c) && g.stamina >= (c.stamina ?? 0);
        return <button key={i} className={i === 0 ? 'ff-go' : ''} data-testid={`choice-${i + 1}`} disabled={!ok} onClick={() => { g.choose(i as 0 | 1); refresh(); }}>{i + 1}. {ch.label}</button>;
      })}</>;
  } else if (g.state === 'won') overlay = <>
    <p className="ff-eyebrow">{MAPS[g.map].name.toUpperCase()} · DAY {g.day}</p>
    <h2>The beacon is lit!</h2>
    <p className="ff-stars" aria-label={`${g.stars()} of 3 stars`}>{'★'.repeat(g.stars())}{'☆'.repeat(3 - g.stars())}</p>
    <p>The herd sees the light and comes home over the snow. {plural(g.survivors, 'chinchilla')}, {plural(g.denCleared, 'den')} cleared, {plural(g.raidsHeld, 'raid')} held off.</p>
    {g.map + 1 < MAPS.length && <button className="ff-go" data-testid="next-map" onClick={() => begin(g.map + 1)}>{MAPS[g.map + 1].name} →</button>}
    <button onClick={() => { setKept(null); setScreen('home'); }}>Choose a mountain</button>
  </>;
  else if (g.state === 'lost') overlay = <><p className="ff-eyebrow">DAY {g.day}</p><h2>{g.survivors <= 0 ? 'Everyone has left the burrow.' : 'The raiders broke the burrow.'}</h2><p>Keep the hay coming, put survivors in watchtowers, and clear the dens that feed the raids.</p><button className="ff-go" onClick={() => begin(g.map)}>Try again →</button><button onClick={() => { setKept(null); setScreen('home'); }}>Choose a mountain</button></>;

  const dayLeft = g.clock;
  return (
    <main className="ff-shell ff-play" data-art-ready={frontierArtReady()}>
      {header}
      {artStatus === 'error' && <output className="ff-art-status">Painted artwork could not load. You can keep playing with the simple artwork. <button onClick={loadArtwork}>Retry artwork</button></output>}
      {artStatus === 'loading' && <output className="ff-art-status">Loading mountain artwork…</output>}
      <section className="ff-hud" aria-label="Supplies">
        <div className={`ff-day${g.night ? ' night' : ''}`}><b>{g.night ? '🌙' : '☀️'} Day {g.day}</b><small>{g.night ? `dawn in ${Math.ceil(dayLeft)}s` : `night in ${Math.ceil(dayLeft)}s`}</small></div>
        {RES_IDS.map((k) => <div key={k} className="ff-res" data-testid={`res-${k}`}><b><Icon draw={(c,w,h) => drawResourceIcon(c,k,w,h)} w={28} h={25}/><span>{k[0].toUpperCase()+k.slice(1)} {Math.floor(g.stock[k])}</span></b><small className={inc[k] < 0 ? 'bad' : ''}>{perMin(inc[k])}</small></div>)}
        <div className="ff-res" data-testid="stamina"><b>⚡ {g.stamina}/{STAMINA_MAX}</b><small>stamina</small></div>
        <div className="ff-res"><b>🐭 {g.survivors}/{g.housing}</b><small>{g.idle} idle</small></div>
        <div className="ff-res"><b>🛡️ {def}</b><small className={raidNext > def ? 'bad' : 'ok'}>raid {g.night && g.raid ? g.raid.strength : raidNext}</small></div>
        <div className="ff-res wall"><b>🏠 {Math.ceil(g.hqHp)}</b><i style={{ width: `${(g.hqHp / hqMaxHp(g.hqLevel)) * 100}%` }} /></div>
      </section>
      <div className="ff-layout">
        <div className="ff-map-column"><div className="ff-board">
          <canvas
            ref={canvas} width={VIEW * SCALE} height={VIEW * SCALE} tabIndex={0}
            data-testid="map" data-state={g.state} data-day={g.day} data-stamina={g.stamina}
            aria-label="The mountain. Arrow keys move, Enter explores or attacks, 1 to 7 pick a building and Enter builds it."
            onPointerMove={(e) => { if (e.pointerType === 'touch') return; const r = e.currentTarget.getBoundingClientRect(); const at = tileAt(((e.clientX - r.left) / r.width) * VIEW, ((e.clientY - r.top) / r.height) * VIEW, cam.current ?? undefined); hover.current = at.x >= 0 && at.y >= 0 && at.x < W && at.y < H ? at : null; }}
            onPointerLeave={() => { hover.current = null; }}
            onPointerDown={(e) => {
              const gg = game.current;
              if (!gg || gg.state !== 'playing') return;
              const r = e.currentTarget.getBoundingClientRect(), at = tileAt(((e.clientX - r.left) / r.width) * VIEW, ((e.clientY - r.top) / r.height) * VIEW, cam.current ?? undefined);
              if (at.x < 0 || at.y < 0 || at.x >= W || at.y >= H) return;
              if (e.button === 2) { pickTool(null); return; }
              const key = `${at.x},${at.y}`, again = armed.current === key;
              select(at);
              sound.cue('click');
              const tt = gg.tile(at.x, at.y)!;
              // Mouse: one click builds or explores. Touch: the first tap previews, the second acts.
              if (e.pointerType === 'touch' && !again) { armed.current = key; if (toolRef.current || (!tt.seen && gg.canExplore(at.x, at.y) === 'ok')) say('Tap again to confirm.'); return; }
              armed.current = '';
              if (toolRef.current) place(toolRef.current, at.x, at.y);
              else if (!tt.seen) primary(at.x, at.y);
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {note && <output className="ff-note">{note}</output>}
          {overlay && <div className="ff-overlay" data-testid="overlay"><div>{overlay}</div></div>}
        </div>
          <div className="ff-toolbar" aria-label="Buildings">
            {TOOLS.map((k, i) => (
              <button key={k} className={tool === k ? 'on' : ''} data-testid={`tool-${k}`} aria-pressed={tool === k} aria-label={`${i + 1}: ${BUILDINGS[k].name}`}
                onClick={() => { pickTool(tool === k ? null : k); canvas.current?.focus(); }} disabled={g.hqLevel < BUILDINGS[k].hq}>
                <Icon draw={(c, w, h) => drawBuildingIcon(c, k, w, h)} w={64} h={56} /><small>{i + 1}</small><span>{BUILDINGS[k].name}</span>
              </button>
            ))}
          </div>
        </div>
        <aside className="ff-side">
          <div className="ff-panel" data-testid="panel">{panel}</div>
          <section className="ff-objective"><h3>Light the Summit Beacon</h3><Icon draw={(c,w,h) => drawBuildingIcon(c,'beacon',w,h)} w={90} h={95}/><p>Explore the mountain and rescue the herd.</p><ol><li className={g.tile(g.summit.x, g.summit.y)?.f === 'beacon' ? "complete" : ""}>{g.tile(g.summit.x, g.summit.y)?.f === 'beacon' ? "✓ " : ""}Clear the cougar lair</li><li className={g.hqLevel === 4 ? "complete" : ""}>{g.hqLevel === 4 ? "✓ " : ""}Raise the burrow to level 4</li><li>Build the beacon on the summit</li></ol></section>
          <ol className="ff-log" aria-label="What happened">{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
        </aside>
      </div>
      <div className="ff-controls">
        <span className="ff-mapname">{MAPS[g.map].name}</span>
        <span className="ff-spacer" />
        <button onClick={() => select({ ...HOME })}>Burrow · H</button>
        <button onClick={() => setGameSpeed(speed === 3 ? 1 : speed + 1)}>{speed}× · F</button>
        <button onClick={() => { g.pause(); refresh(); }} disabled={g.state !== 'playing' && g.state !== 'paused'}>{g.state === 'paused' ? 'Resume' : 'Pause'} · P</button>
      </div>
      <p className="ff-tip">{tool ? `Building a ${BUILDINGS[tool].name}: click a tile (${BUILDINGS[tool].on.join(', ')}). Esc cancels.` : 'Click the cloud next to your land to explore. Click your land to build. Watch the raid number before night falls.'}</p>
    </main>
  );
}
