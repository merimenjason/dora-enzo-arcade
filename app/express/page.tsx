/* oxlint-disable next/no-img-element -- Local authored game artwork is shared unchanged by the UI and Canvas. */
/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on animation frames. */
/* oxlint-disable next/no-html-link-for-pages -- Hard navigation tears down the game's loop, as in the other arcade games. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { Game, MAPS, WIDTH, HEIGHT, COLORS, LINE_NAMES, TYPES, KINDS, UPGRADES, DAY, LAST_DAY, CAPACITY, GRACE, type Mode, type Upgrade } from '../../lib/burrow-express-game';
import { Stage, loadArt, graphic, type Graphic } from '../../lib/burrow-express-scene';
import { sound } from './sound';
import './express.css';

const KEY = 'burrow-express-v1', RUN_KEY = 'burrow-express-run-v1';
type Record1 = { delivered: number; day: number; wins: number };
type Save = { tutorial: boolean; records: Record1[] };
const blank = (): Save => ({ tutorial: false, records: MAPS.map(() => ({ delivered: 0, day: 0, wins: 0 })) });
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const read = (): Save => { try { const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { tutorial: raw.tutorial === true, records: MAPS.map((_, i) => ({ delivered: number(raw.records?.[i]?.delivered), day: number(raw.records?.[i]?.day), wins: number(raw.records?.[i]?.wins) })) }; } catch { return blank(); } };
const readRun = () => { try { const raw = localStorage.getItem(RUN_KEY), g = raw ? Game.load(raw) : null; return g && (g.state === 'running' || g.state === 'upgrade') ? g : null; } catch { return null; } };
const writeRun = (g: Game | null) => { try { if (g && (g.state === 'running' || g.state === 'upgrade')) localStorage.setItem(RUN_KEY, g.save()); else localStorage.removeItem(RUN_KEY); } catch { /* Private mode: the game keeps playing. */ } };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const STEPS = [
  ['Your first tunnel', 'Drag from Home Burrow to Hay Market, or tap the two buildings in order. Your first cart is assigned automatically.'],
  ['Connect the warren', 'Add Dust Baths and Mountain Retreat to your line. For this lesson the clock waits until all four stations are connected.'],
  ['Watch the passengers', 'The shapes under a station show where passengers want to go. Carts stop, pick them up and deliver them. Carry five passengers to their destinations.'],
  ['Your first upgrade', 'Choose an upgrade. Extra carts help busy lines; bigger carts hold more passengers; drills let you cross rocky ground.'],
];
function Duo() {
  return <img src="/art/express/duo.png" width={600} height={400} className="be-duo" alt="Dora, a white chinchilla with dark ruby eyes, and Enzo, a grey chinchilla" />;
}
function ArtIcon({ id, size = 72 }: { id: Graphic; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let live = true; void loadArt().then(() => { if (!live) return; const c = ref.current?.getContext('2d'); if (c) { c.setTransform(2, 0, 0, 2, 0, 0); graphic(c, id, size, size); } }).catch(() => {}); return () => { live = false; }; }, [id, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
export default function BurrowExpress() {
  const [save, setSave] = useState<Save>(blank), [loaded, setLoaded] = useState(false), [screen, setScreen] = useState<'home' | 'play'>('home');
  const [map, setMap] = useState(0), [mode, setMode] = useState<Mode>('challenge'), [line, setLine] = useState(0), [cursor, setCursor] = useState<number | null>(null);
  const [muted, setMuted] = useState(false), [rate, setRate] = useState(1), [hasRun, setHasRun] = useState(false), [note, setNote] = useState('');
  const [artReady, setArtReady] = useState(false), [artError, setArtError] = useState(false), [editor, setEditor] = useState(false);
  const [, setTick] = useState(0);
  const game = useRef<Game | null>(null), stage = useRef(new Stage()), canvas = useRef<HTMLCanvasElement>(null), saveRef = useRef(save), lineRef = useRef(0), cursorRef = useRef<number | null>(null), hover = useRef<number | null>(null);
  const drag = useRef<{ pointer: number; from: number; x: number; y: number; moved: boolean } | null>(null), recorded = useRef<Game | null>(null), rateRef = useRef(1), fast = useRef(1), timer = useRef(0);
  saveRef.current = save;
  const refresh = () => setTick((n) => n + 1);
  const say = (s: string) => { setNote(s); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setNote(''), 3500); };
  const pickLine = (n: number) => { if (!game.current?.lines[n]) return; lineRef.current = n; setLine(n); drag.current = null; };
  const pickCursor = (n: number | null) => { cursorRef.current = n; setCursor(n); };
  const store = (next: Save) => { saveRef.current = next; setSave(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* see writeRun */ } };
  function commit() {
    const g = game.current;
    if (!g) return;
    const events = g.events.splice(0); stage.current.feed(events, g);
    for (const e of events) if (e.t !== 'board' && e.t !== 'alight') sound.cue(e.t, 0, 1, e.t === 'deliver' ? 0.25 : 0.08);
    if ((g.state === 'won' || g.state === 'lost') && recorded.current !== g) {
      recorded.current = g;
      const s = saveRef.current;
      if (g.mode === 'tutorial') store({ ...s, tutorial: s.tutorial || g.state === 'won' });
      else store({ ...s, records: s.records.map((r, i) => i === g.map ? { delivered: Math.max(r.delivered, g.delivered), day: Math.max(r.day, g.day), wins: r.wins + (g.state === 'won' ? 1 : 0) } : r) });
    }
    writeRun(g); refresh();
  }
  function enter(g: Game, resume = false) {
    game.current = g; if (resume) g.pause(true);
    recorded.current = null; stage.current = new Stage(); hover.current = null; drag.current = null; pickCursor(null); lineRef.current = 0; setLine(0); setNote(''); setEditor(window.matchMedia('(max-width: 760px)').matches); setScreen('play'); commit();
  }
  const start = (m: Mode = mode) => enter(Game.start(m === 'tutorial' ? 0 : map, m, Date.now() % 1000000 + 1));
  const resume = () => { const g = readRun(); if (g) enter(g, true); else { setHasRun(false); say('That saved route could not be resumed.'); } };
  const home = () => { game.current?.pause(true); drag.current = null; writeRun(game.current); setHasRun(!!readRun()); setScreen('home'); };
  const togglePause = () => { const g = game.current; if (!g || g.state !== 'running') return; g.pause(!g.paused); drag.current = null; commit(); };
  const toggleSound = () => { const m = !sound.muted(); sound.setMuted(m); setMuted(m); };
  const cycleRate = () => { rateRef.current = rateRef.current % 3 + 1; setRate(rateRef.current); };
  const act = (fn: (g: Game) => string) => { const g = game.current; if (!g) return; const why = fn(g); if (why) say(why); else { setNote(''); commit(); } };
  const connect = (id: number) => { pickCursor(id); act((g) => g.append(lineRef.current, id)); };

  useEffect(() => { const s = read(); saveRef.current = s; setSave(s); setHasRun(!!readRun()); setMuted(sound.muted()); setLoaded(true); let live = true; void loadArt().then(() => { if (live) setArtReady(true); }).catch(() => { if (live) setArtError(true); }); return () => { live = false; }; }, []);
  useEffect(() => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'), apply = () => { stage.current.motion = !m.matches; }; apply(); m.addEventListener('change', apply); return () => m.removeEventListener('change', apply); }, []);
  // Single-player browser tests can inspect state and advance the same deterministic rules.
  useEffect(() => {
    (window as unknown as { __express?: () => unknown }).__express = () => ({ game: game.current, stage: stage.current, fast: (n: number) => { fast.current = Math.max(1, Math.min(120, Math.floor(n))); }, advance: (dt: number) => { game.current?.update(dt); commit(); } });
    return () => { delete (window as unknown as { __express?: () => unknown }).__express; window.clearTimeout(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- stable refs hold all running state
  useEffect(() => {
    if (screen !== 'play' || !artReady) return;
    const cv = canvas.current, c = cv?.getContext('2d'); if (!cv || !c) return;
    let raf = 0, last = performance.now(), ui = 0, stored = 0;
    const frame = (now: number) => {
      const g = game.current; if (!g) return;
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
      for (let i = 0; i < fast.current; i++) g.update(dt * rateRef.current);
      if (g.events.length) commit();
      stage.current.update(dt, g);
      if (now - stored > 3000) { writeRun(g); stored = now; }
      if (now - ui > 200) { refresh(); ui = now; }
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      stage.current.draw(c, w, h, dpr, g, now / 1000, { line: lineRef.current, hover: hover.current, cursor: cursorRef.current, drag: drag.current?.moved ? drag.current : null });
      raf = requestAnimationFrame(frame);
    };
    const away = () => { game.current?.pause(true); drag.current = null; hover.current = null; commit(); };
    const hidden = () => { if (document.hidden) away(); };
    raf = requestAnimationFrame(frame); window.addEventListener('blur', away); document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', away); document.removeEventListener('visibilitychange', hidden); };
  }, [screen, artReady]); // eslint-disable-line react-hooks/exhaustive-deps -- animation reads refs
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current; if (!g || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { toggleSound(); return; }
      if (k === 'f') { cycleRate(); return; }
      if (k === 'p' || k === 'escape') { e.preventDefault(); togglePause(); return; }
      if (g.state !== 'running') return;
      if (/^[1-5]$/.test(k)) { pickLine(Number(k) - 1); return; }
      if (k === 'z') { act((x) => x.removeLast(lineRef.current)); return; }
      if (k === 'a') { act((x) => x.addCart(lineRef.current)); return; }
      if (k === 'l') { act((x) => x.loop(lineRef.current)); return; }
      if (k.startsWith('arrow')) {
        e.preventDefault(); const from = g.stations[cursorRef.current ?? g.active[0].id], dx = k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, dy = k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0;
        const next = g.active.filter((s) => (s.x - from.x) * dx + (s.y - from.y) * dy > 0).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
        pickCursor(next?.id ?? from.id); return;
      }
      if (k === 'enter' && cursorRef.current !== null && !(e.target instanceof HTMLElement && e.target.closest('button,a,summary'))) { e.preventDefault(); connect(cursorRef.current); }
    };
    window.addEventListener('keydown', down); return () => window.removeEventListener('keydown', down);
  });

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => { const q = e.currentTarget.getBoundingClientRect(); return { x: (e.clientX - q.left) / q.width * WIDTH, y: (e.clientY - q.top) / q.height * HEIGHT }; };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current; if (!g || g.state !== 'running' || e.button !== 0 || drag.current) return;
    const p = at(e), from = stage.current.pick(g, p.x, p.y, e.currentTarget.clientWidth);
    if (from === null) return;
    e.currentTarget.setPointerCapture(e.pointerId); drag.current = { pointer: e.pointerId, from, ...p, moved: false }; pickCursor(from);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current; if (!g) return; const p = at(e); hover.current = stage.current.pick(g, p.x, p.y, e.currentTarget.clientWidth);
    const d = drag.current;
    if (d && d.pointer === e.pointerId) { if (Math.hypot(p.x - d.x, p.y - d.y) > 12) d.moved = true; d.x = p.x; d.y = p.y; }
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current, d = drag.current;
    if (!g || !d || d.pointer !== e.pointerId || g.state !== 'running') return;
    drag.current = null;
    const p = at(e), to = stage.current.pick(g, p.x, p.y, e.currentTarget.clientWidth), l = g.lines[lineRef.current];
    if (d.moved) {
      if (to === null || to === d.from) return;
      if (!l.stops.length) { const why = g.append(l.id, d.from); if (why) { say(why); return; } }
      if (l.stops.at(-1) !== d.from) { say('Drag from the last stop on your selected line, or pick a new line.'); commit(); return; }
      connect(to);
    } else connect(d.from);
  };
  const cancel = (e: React.PointerEvent<HTMLCanvasElement>) => { if (drag.current?.pointer === e.pointerId) drag.current = null; };
  const g = game.current, playing = screen === 'play' && g;
  const header = <header className="be-header"><a href="/">← MAIN ARCADE</a><strong>BURROW EXPRESS</strong><div>{playing && <><button data-testid="pause" onClick={togglePause} disabled={g.state !== 'running'} aria-label={g.paused ? 'Resume the game' : 'Pause the game'}>{g.paused ? '▶' : 'Ⅱ'}</button><button onClick={cycleRate} aria-label="Change game speed">{rate}×</button><button data-testid="menu" onClick={home}>Save &amp; menu</button></>}<button onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? 'Sound off' : 'Sound on'}</button></div></header>;
  if (!playing) return <main className="be-shell">
    {header}
    <section className="be-intro"><div><p className="be-eyebrow">SMALL CARTS · BIG CONNECTIONS</p><h1>Keep the warren<br/><em>moving.</em></h1><p>Draw tunnels between burrows, hay markets and dust baths. Send little carts full of chinchillas across the valley, and keep a growing warren connected.</p><div className="be-home-go"><button className="be-gold" data-testid="tutorial" disabled={!loaded || !artReady} onClick={() => start('tutorial')}>{save.tutorial ? 'Play the tutorial again' : 'Learn with Dora & Enzo'}</button>{hasRun && <button data-testid="resume" disabled={!artReady} onClick={resume}>Continue your route →</button>}</div></div><Duo /></section>
    {!artReady && <output className="be-art-loading">{artError ? <>The warren artwork could not load. <button onClick={() => window.location.reload()}>Try again</button></> : 'Opening the warren…'}</output>}
    {note && <output className="be-notice">{note}</output>}
    <div className="be-maps" aria-label="Choose a landscape">{MAPS.map((m, i) => <button key={m.name} data-testid={`map-${i}`} aria-pressed={map === i} className={map === i ? 'on' : ''} onClick={() => setMap(i)}><span>{['☘', '≈', '✧'][i]}</span><strong>{m.name}</strong><small>{m.text}</small><em>{m.goal} deliveries in {LAST_DAY} days{save.records[i].wins ? ` · ${plural(save.records[i].wins, 'shift')} won` : ''}</em><i>{save.records[i].day ? `Best: ${save.records[i].delivered} delivered · day ${save.records[i].day}` : 'A fresh route awaits'}</i></button>)}</div>
    <div className="be-start"><div className="be-modes" aria-label="Choose a mode"><button data-testid="challenge" aria-pressed={mode === 'challenge'} onClick={() => setMode('challenge')}>Eight-day shift<small>Meet the delivery target by sunset.</small></button><button data-testid="endless" aria-pressed={mode === 'endless'} onClick={() => setMode('endless')}>Endless<small>Keep growing until a platform overflows.</small></button></div><button className="be-gold" data-testid="start" disabled={!loaded || !artReady} onClick={() => start()}>Start in {MAPS[map].name} →</button></div>
    {hasRun && <p className="be-subtle">Starting a new route replaces the saved one.</p>}
    <ol className="be-how"><li><b>Draw a line.</b> Drag between stations, or tap them in order. A cart starts when the second stop is connected.</li><li><b>Read the shapes.</b> Circle: home. Square: hay. Diamond: dust bath. Triangle: retreat. Passengers change carts at shared stations.</li><li><b>Make room.</b> More than {CAPACITY} waiting passengers starts an {GRACE}-second crowding clock. Pause to plan, then add carts or reroute.</li><li><b>Choose an upgrade.</b> Every {DAY}-second day brings a choice. Hay deliveries fuel carts. A cave-in lasts 20 seconds, or a drill clears it immediately.</li></ol>
    <details className="be-help"><summary>Keyboard &amp; touch controls</summary><p>1–5 select a line. Arrow keys select a station; Enter adds it. Z removes the last stop, A adds a cart, L joins a loop. P or Escape pauses. F changes speed; M toggles sound. On a phone, drag between buildings or use the station buttons below the map. The game pauses on focus loss. Your route saves as you play and returns paused.</p></details>
  </main>;
  const l = g.lines[line], crowded = [...g.active].sort((a, b) => b.queue.length - a.queue.length)[0], editable = g.state === 'running', end = g.state === 'won' || g.state === 'lost';
  const tips = g.mode === 'tutorial' && g.tutorial < 4 ? STEPS[g.tutorial] : null;
  return <main className="be-shell be-play" data-paused={String(g.paused || g.state !== 'running')}>
    {header}
    <div className="be-status" data-testid="status" data-state={g.state} data-paused={String(g.paused)}><span>☀ <b>DAY {g.day}</b><small>{g.mode === 'tutorial' ? 'PRACTICE' : g.mode === 'endless' ? 'ENDLESS' : `OF ${LAST_DAY}`}</small></span><span>♧ <b data-testid="delivered">{g.delivered}</b> delivered<small>{g.mode === 'challenge' ? `TARGET ${g.goal}` : 'HAPPY JOURNEYS'}</small></span><span>✦ <b>{Math.floor(g.hay)}</b> hay<small>FUELS YOUR CARTS</small></span><span>▰ <b>{g.carts.length} / {g.fleet}</b><small>{g.seats} SEATS EACH</small></span><span>⚒ <b>{g.drills}</b><small>ROCK DRILLS</small></span></div>
    <div className="be-workspace"><section className="be-network" aria-label="Transport network">
      {tips && <div className="be-coach" data-testid="coach"><b>{tips[0]}</b><p>{tips[1]}</p></div>}
      <div className="be-map"><canvas ref={canvas} tabIndex={0} data-testid="board" aria-label="Warren map. Drag from the last station on your selected line to another station. Arrow keys select a station; Enter connects it." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={cancel} onLostPointerCapture={cancel} onPointerLeave={() => { hover.current = null; }} />{g.paused && !end && g.state !== 'upgrade' && <button className="be-paused" data-testid="carry-on" onClick={togglePause}>Paused · Carry on ▶</button>}
      {g.state === 'upgrade' && <div className="be-overlay"><section aria-label="Choose an upgrade"><small>{g.mode === 'tutorial' ? 'YOUR FIRST UPGRADE' : `DAY ${g.day} · A NEW MORNING`}</small><h2>Grow your little network.</h2><p>{g.active.length} stations · {g.delivered} happy journeys</p><div className="be-upgrades" style={{ gridTemplateColumns: `repeat(${g.offers().length}, minmax(0, 1fr))` }}>{g.offers().map((id: Upgrade) => <button key={id} data-testid={`upgrade-${id}`} onClick={() => act((x) => x.upgrade(id))}><span>{['cart', 'line'].includes(id) ? <ArtIcon id="duo" size={60} /> : id === 'drill' ? <ArtIcon id="drill" size={60} /> : UPGRADES[id].icon}</span><b>{UPGRADES[id].name}</b><small>{UPGRADES[id].text}</small></button>)}</div></section></div>}
      {end && <div className="be-overlay" data-testid="result"><section><small>{g.mode === 'tutorial' ? 'LESSON COMPLETE' : MAPS[g.map].name.toUpperCase()}</small><h2>{g.state === 'won' ? g.mode === 'tutorial' ? 'You’re ready to roll!' : 'The warren is moving!' : 'Time for a fresh route.'}</h2><p>{g.mode === 'tutorial' ? 'Try an eight-day shift, or build an endless network. Short lines and shared transfer stations help everyone get home.' : g.reason}</p><strong className="be-result-number">{g.delivered}<small>DELIVERED · DAY {g.day}</small></strong><button className="be-gold" data-testid="again" onClick={() => enter(Game.start(g.map, g.mode === 'tutorial' ? 'challenge' : g.mode, Date.now() % 1000000 + 1))}>{g.mode === 'tutorial' ? 'Start a real shift →' : 'Try a new route →'}</button><button onClick={home}>Choose a map</button></section></div>}
      </div>
      <div className="be-lines" aria-label="Tunnel lines"><strong className="be-lines-label">TUNNEL LINES</strong>{g.lines.map((x) => <button key={x.id} data-testid={`line-${x.id}`} aria-pressed={line === x.id} onClick={() => pickLine(x.id)} style={{ '--route': COLORS[x.id] } as React.CSSProperties}><i /><span>{LINE_NAMES[x.id]}<small>{plural(x.stops.length, 'stop')} · {plural(g.carts.filter((c) => c.line === x.id).length, 'cart')}{x.loop ? ' · loop' : ''}</small></span></button>)}<button className="be-reroute" data-testid="reroute" disabled={!editable} onClick={() => { g.pause(true); drag.current = null; setEditor(true); say('Route paused. Remove stops from the end, then connect new ones. Carry on when you’re ready.'); commit(); }}>⇄ Reroute</button></div>
      <output className="be-instruction">{note || 'Drag between stations to draw a tunnel.'}</output>
      <details className="be-editor" data-testid="editor" open={editor}>
      <summary onClick={(e) => { e.preventDefault(); setEditor(!editor); }}>Stations &amp; route tools <span>{editor ? '−' : '+'}</span></summary>
      <div className="be-route-actions"><button data-testid="remove-stop" disabled={!editable || !l.stops.length} onClick={() => act((x) => x.removeLast(line))}>Remove last stop · Z</button><button data-testid="loop" disabled={!editable || l.stops.length < 3} aria-pressed={l.loop} onClick={() => act((x) => x.loop(line))}>{l.loop ? 'Open loop' : 'Join a loop'} · L</button><button data-testid="release-cart" disabled={!editable || !g.carts.some((c) => c.line === line)} onClick={() => act((x) => x.releaseCart(line))}>Free a cart</button></div>

      <div className="be-stations" aria-label="Connect a station">{g.active.map((s) => <button key={s.id} data-testid={`station-${s.id}`} disabled={!editable} aria-pressed={cursor === s.id} onClick={() => connect(s.id)}><span style={{ color: TYPES[s.kind].color }}>{TYPES[s.kind].icon}</span><b>{s.name}</b><small>{s.queue.length} waiting{s.crowd > 0 ? ` · ${Math.ceil(GRACE - s.crowd)}s left` : ''}</small></button>)}</div>
      </details>
    </section><aside className="be-sidebar"><h2>KEEP THE WARREN MOVING</h2><Duo />
      {g.block && <div className="be-warning" data-testid="cave-in"><b>Cave-in on the line</b><p>{g.stations[g.block.a].name} ↔ {g.stations[g.block.b].name}</p><small>Clears in {Math.ceil(g.block.until - g.time)}s, or use one drill.</small><button disabled={!editable || !g.drills} onClick={() => act((x) => x.repair())}>Clear cave-in ⚒</button></div>}
      <div className={`be-queue ${crowded.queue.length >= CAPACITY ? 'busy' : ''}`}><span className="be-warning-icon">{crowded.queue.length >= CAPACITY ? '⚠' : '♧'}</span><div><b>{crowded.queue.length >= CAPACITY ? `${crowded.name} getting crowded` : crowded.name}</b><strong>{crowded.queue.length} / {CAPACITY}<small>waiting</small></strong></div><div className="be-meter"><i style={{ width: `${Math.min(100, crowded.queue.length / CAPACITY * 100)}%` }} /></div>{crowded.crowd > 0 && <p>{Math.ceil(GRACE - crowded.crowd)} seconds to ease the crowd.</p>}</div>
      <section className="be-next-upgrades"><h3>UPGRADE</h3><div><ArtIcon id="duo" /><strong>Extra cart<small>More room for little passengers</small></strong></div><div><ArtIcon id="drill" /><strong>Rock drill<small>New tunnels through rocky ground</small></strong></div></section>
      <div className="be-fleet"><button className="be-gold" data-testid="add-cart" disabled={!editable || g.available < 1 || l.stops.length < 2} onClick={() => act((x) => x.addCart(line))}>Add cart</button><small>{g.available} spare {g.available === 1 ? 'cart' : 'carts'} · {LINE_NAMES[line]}</small></div>
      <details className="be-legend"><summary>Where are they going?</summary>{KINDS.map((id) => <span key={id}><i style={{ color: TYPES[id].color }}>{TYPES[id].icon}</i>{TYPES[id].name}</span>)}</details>
      {g.mode !== 'tutorial' && <div className="be-day"><span>Next morning in <b>{Math.ceil(g.dayLeft)}s</b></span><div className="be-meter"><i style={{ width: `${100 * (1 - g.dayLeft / DAY)}%` }} /></div><small>Choose an upgrade at dawn. New stations appear as the warren grows.</small></div>}
    </aside></div>
  </main>;
}
