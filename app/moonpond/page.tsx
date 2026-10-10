/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Game, SPECIES, byId, requestText, UPGRADES, UPGRADE_IDS, LURES, LURE_COST, LURE_NAMES, WEATHERS, WEATHER_NAMES, TIME_NAMES, ZONE_NAMES, PHASE_NAMES,
  type Lure, type Species, type UpgradeId, type Weather,
} from '../../lib/moonpond-game';
import { Pond, portrait } from '../../lib/moonpond-scene';
import { loadPondArt, prop } from '../../lib/moonpond-art';
import './moonpond.css';
import { sound } from './sound';

const SAVE_KEY = 'moonpond-v1', NIGHT_KEY = 'moonpond-night-v1';
const read = (): Game | null => {
  try {
    const profile = localStorage.getItem(SAVE_KEY), night = localStorage.getItem(NIGHT_KEY);
    return profile ? Game.load(JSON.parse(profile), night ? JSON.parse(night) : null) : null;
  } catch { return null; }
};
const write = (g: Game) => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.profile())); localStorage.setItem(NIGHT_KEY, JSON.stringify(g.progress())); } catch { /* private mode: the journal just isn't kept */ }
};

type Panel = 'journal' | 'shop' | 'board' | null;
const WEATHER_ICON: Record<Weather, string> = { clear: '✦', mist: '≋', rain: '☂', fireflies: '❋' };
const LOST = { early: 'Too soon. It was only a nibble, and it has gone.', missed: 'Too late. The bobber came back up empty.', snapped: 'The line snapped. Ease off when the gauge runs red.', slipped: 'It slipped the hook. Keep the line from going slack.' };
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
/** When and where an entry is found, once it has been sketched. */
const habits = (sp: Species) => [
  `In ${ZONE_NAMES[sp.zone]}`,
  sp.time ? `at ${sp.time.map((t) => TIME_NAMES[t]).join(' or ')}` : '',
  sp.weather ? `on ${sp.weather.map((w) => WEATHER_NAMES[w]).join(' or ')}` : '',
  sp.lure ? `with the ${sp.lure.map((l) => LURE_NAMES[l].toLowerCase()).join(' or ')}` : '',
  sp.phase ? `under a ${sp.phase.map((p) => PHASE_NAMES[p].toLowerCase()).join(' or ')}` : '',
].filter(Boolean).join(', ') + (sp.rarity === 1 && (sp.time || sp.weather || sp.lure) ? ' most often.' : '.');

function Thumb({ id, known, size = 64 }: { id: string; known: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.setTransform(2, 0, 0, 2, 0, 0); portrait(c, id, size, size, known); }, [id, known, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
function Shell() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 18, 18); prop(c, 'shell', 9, 9, 16); }, []);
  return <canvas ref={ref} className="mp-shell-icon" width={36} height={36} aria-hidden="true" />;
}

export default function MoonpondPage() {
  const canvas = useRef<HTMLCanvasElement>(null), game = useRef<Game | null>(null), pond = useRef(new Pond());
  const keys = useRef({ hold: false, left: false, right: false }), pointer = useRef<number | null>(null), paused = useRef(false), panelOpen = useRef(false);
  // Presses and releases wait in a queue and reach the game one per frame, so a quick tap, or two in a row, is never
  // swallowed between frames.
  const edges = useRef<boolean[]>([]);
  const hold = useCallback(() => { if (!(edges.current.at(-1) ?? keys.current.hold)) edges.current.push(true); }, []);
  const release = useCallback(() => { if (edges.current.at(-1) ?? keys.current.hold) edges.current.push(false); }, []);
  const drop = useCallback(() => { edges.current.length = 0; keys.current.hold = false; }, []);
  const [loaded, setLoaded] = useState(false), [kept, setKept] = useState<Game | null>(null), [playing, setPlaying] = useState(false);
  const [, setFrame] = useState(0), [panel, setPanel] = useState<Panel>(null), [page, setPage] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false), [muted, setMuted] = useState(false), [sure, setSure] = useState(false), [choice, setChoice] = useState<Weather | ''>('');
  const redraw = useCallback(() => setFrame((n) => n + 1), []);
  useEffect(() => { panelOpen.current = panel !== null; if (panel) drop(); }, [panel, drop]);

  useEffect(() => { void loadPondArt().catch(() => {}).then(() => { setKept(read()); setMuted(sound.muted()); setLoaded(true); }); }, []);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'), sync = () => { pond.current.motion = !media.matches; }; sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync); }, []);

  const store = useCallback(() => { if (game.current) write(game.current); }, []);
  const pause = useCallback((on: boolean) => { paused.current = on; setIsPaused(on); drop(); pointer.current = null; if (on) game.current?.cancel(); }, [drop]);
  const begin = (g: Game) => { game.current = g; pond.current = Object.assign(new Pond(), { motion: pond.current.motion }); setPlaying(true); setPanel(null); pause(false); write(g); sound.cue('night'); };
  const leave = () => { store(); setKept(read()); setPlaying(false); setSure(false); pause(false); };
  const mute = () => { const m = !sound.muted(); sound.setMuted(m); setMuted(m); };
  const open = (p: Panel) => { sound.cue('click'); setPage(null); setPanel((was) => (was === p ? null : p)); };

  // The loop: step the pond, bank anything that happened on the frame it happened, draw.
  useEffect(() => {
    if (!playing) return;
    (window as unknown as { __moonpond?: () => { game: Game | null; pond: Pond; paused: boolean } }).__moonpond = () => ({ game: game.current, pond: pond.current, paused: paused.current });
    let raf = 0, last = performance.now(), shown = '';
    const loop = (now: number) => {
      const g = game.current, cv = canvas.current, dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (g && cv) {
        const blocked = paused.current || panelOpen.current;
        if (edges.current.length) keys.current.hold = edges.current.shift()!;
        if (!blocked) g.update(dt, keys.current);
        const events = g.events.splice(0);
        if (events.length) {
          pond.current.take(events, g);
          for (const e of events) sound.cue(e.t as Parameters<typeof sound.cue>[0]);
          if (events.some((e) => ['land', 'first', 'early', 'missed', 'snapped', 'slipped', 'dawn', 'night', 'buy', 'complete'].includes(e.t))) write(g);
        }
        const box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(box.width), h = Math.round(box.height);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c && w > 0 && h > 0) pond.current.draw(c, w, h, dpr, g, blocked ? 0 : dt);
        // The HUD only re-renders when something it shows has changed.
        const key = `${g.state}|${g.cast}|${g.shells}|${g.lure}|${g.angler}|${g.night}|${g.found}|${g.biting}|${g.fight ? Math.round(g.fight.p * 20) : ''}`;
        if (key !== shown) { shown = key; redraw(); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const away = () => { const g = game.current; if (g && ['charging', 'flying', 'waiting', 'hooked'].includes(g.state)) pause(true); else { drop(); pointer.current = null; } store(); };
    const hide = () => { if (document.hidden) away(); };
    window.addEventListener('blur', away); window.addEventListener('pagehide', store); document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', away); window.removeEventListener('pagehide', store); document.removeEventListener('visibilitychange', hide); store(); };
  }, [playing, pause, redraw, store, drop]);

  // Keys.
  useEffect(() => {
    if (!playing) return;
    const down = (e: KeyboardEvent) => {
      if (!game.current) return;
      if (e.repeat) { if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); return; }
      const typing = e.target instanceof HTMLElement && e.target.closest('button, a, select');
      if (e.code === 'Space') { if (typing) return; e.preventDefault(); if (!paused.current) hold(); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.current.left = true; }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.current.right = true; }
      else if (e.code === 'KeyJ') open('journal');
      else if (e.code === 'KeyB') open('shop');
      else if (e.code === 'KeyR') open('board');
      else if (e.code === 'KeyP') pause(!paused.current);
      else if (e.code === 'Escape') { if (panelOpen.current) setPanel(null); else pause(!paused.current); }
      else if (e.code === 'KeyM') mute();
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') release(); else if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.current.left = false; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.current.right = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [playing, pause, hold, release]);

  // Pointer: where you touch is where you aim; holding charges, hooks and reels.
  const aimAt = (e: React.PointerEvent) => { const g = game.current, cv = canvas.current; if (!g || !cv || (g.state !== 'ready' && g.state !== 'charging')) return; const box = cv.getBoundingClientRect(); g.aim = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width - 0.5) / 0.37)); };
  const press = (e: React.PointerEvent, aim: boolean) => { if (paused.current || e.button > 0) return; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone: the release will still arrive */ }
    pointer.current = e.pointerId; if (aim) aimAt(e); hold(); };
  const lift = (e: React.PointerEvent, cancelled = false) => { if (pointer.current !== e.pointerId) return; pointer.current = null; if (cancelled) { drop(); game.current?.cancel(); } else release(); };

  if (!loaded) return <main className="mp-shell"><p className="mp-loading">Lighting the lantern…</p></main>;

  if (!playing) {
    return (
      <main className="mp-shell mp-title">
        <a className="mp-back" href="/">← MAIN ARCADE</a>
        <section className="mp-title-card">
          <p className="mp-eyebrow">A night-fishing journal</p>
          <h1>Moonpond</h1>
          <p className="mp-lede">Cast from the dock, wait for the bobber, work the reel. Sketch what you catch, then let it go. Forty pages to fill, each with its own hour, weather, lure and moon.</p>
          <div className="mp-title-row" aria-hidden="true">{['moon-koi', 'lily-hopper', 'star-sturgeon', 'lantern-snail', 'old-mossback'].map((id) => <Thumb key={id} id={id} known size={72} />)}</div>
          {kept && <button className="mp-gold" data-testid="continue" onClick={() => begin(kept)}>Back to the dock · night {kept.night}, {kept.found}/{SPECIES.length} sketched</button>}
          {!kept && <button className="mp-gold" data-testid="start" onClick={() => begin(new Game((Date.now() >>> 0) || 1))}>Walk down to the pond</button>}
          {kept && !sure && <button data-testid="new" onClick={() => setSure(true)}>Start a new journal</button>}
          {kept && sure && <div className="mp-sure"><p>This replaces your journal of {kept.found} sketches. It cannot be undone.</p><button data-testid="new-sure" onClick={() => begin(new Game((Date.now() >>> 0) || 1))}>Yes, start again</button><button onClick={() => setSure(false)}>Keep my journal</button></div>}
          <p className="mp-keys">Hold <kbd>Space</kbd> or the water to cast, press to hook, hold to reel. <kbd>←</kbd> <kbd>→</kbd> aim. <kbd>J</kbd> journal, <kbd>B</kbd> bait shop, <kbd>R</kbd> requests, <kbd>P</kbd> pause, <kbd>M</kbd> sound.</p>
        </section>
      </main>
    );
  }

  const g = game.current!, caught = g.caught ? byId.get(g.caught.id)! : null, fresh = g.state === 'ready' && g.cast === 0;
  const hint = isPaused ? 'Paused.' : g.state === 'ready' ? (fresh ? 'Choose who fishes and which lure, then hold to cast.' : 'Hold to charge a cast. Let go to throw.')
    : g.state === 'charging' ? 'Let go when the ring is where you want it.' : g.state === 'flying' ? '…' : g.state === 'waiting' ? (g.biting ? 'Now!' : 'Wait for the bobber to go right under. Leave the nibbles alone.')
      : g.state === 'hooked' ? 'Hold to reel, let go to ease. Keep the marker in the pale band, and let go for every leap.' : g.state === 'landed' ? 'Press to let it go.' : g.state === 'lost' ? 'Press to cast again.' : 'First light. The night is over.';
  const act = g.state === 'ready' || g.state === 'charging' ? 'Hold to cast' : g.state === 'waiting' ? 'Hook!' : g.state === 'hooked' ? 'Hold to reel' : g.state === 'landed' ? 'Let it go' : g.state === 'lost' ? 'Cast again' : '…';
  const buy = (id: UpgradeId) => { if (g.buy(id)) { store(); redraw(); } else sound.cue('nope'); };
  const buyLure = (l: Lure) => { if (g.buyLure(l)) { store(); redraw(); } else sound.cue('nope'); };
  const shown = page ? byId.get(page)! : null;

  return (
    <main className="mp-shell mp-play" data-state={g.state} data-biting={g.biting} data-paused={isPaused}>
      <header className="mp-header">
        <a className="mp-back" href="/" onClick={store}>← ARCADE</a>
        <div className="mp-sky" data-testid="sky">
          <strong>Night {g.night}</strong>
          <span>{PHASE_NAMES[g.phase]}</span>
          <span><i aria-hidden="true">{WEATHER_ICON[g.weather]}</i> {WEATHER_NAMES[g.weather].replace(/^a /, '')}</span>
          <span>{TIME_NAMES[g.hour]}</span>
        </div>
        <div className="mp-top-buttons">
          <button data-testid="mute" aria-pressed={muted} onClick={mute}>{muted ? 'Sound off' : 'Sound on'}</button>
          <button data-testid="pause" aria-pressed={isPaused} onClick={() => pause(!isPaused)}>{isPaused ? 'Resume' : 'Pause'}</button>
          <button data-testid="menu" onClick={leave}>Save &amp; menu</button>
        </div>
      </header>

      <div className="mp-layout">
        <section className="mp-stage" aria-label="The pond">
          <canvas ref={canvas} data-testid="pond" tabIndex={0} aria-label="Moonpond. Hold Space to cast, press to hook a bite, hold to reel. Arrow keys aim."
            onPointerDown={(e) => press(e, true)} onPointerMove={aimAt} onPointerUp={(e) => lift(e)} onPointerCancel={(e) => lift(e, true)} onLostPointerCapture={(e) => lift(e)} onContextMenu={(e) => e.preventDefault()} />
          <div className="mp-oil" data-testid="oil" aria-label={`${g.left} of ${g.casts} casts left tonight`}>{Array.from({ length: g.casts }, (_, i) => <i key={i} data-spent={i < g.cast} />)}</div>

          {g.state === 'landed' && caught && g.caught && (
            <output className="mp-card" data-testid="catch">
              <Thumb id={caught.id} known size={120} />
              <div>
                {g.caught.first && <p className="mp-new">New sketch · page {SPECIES.indexOf(caught) + 1}</p>}
                {g.caught.record && <p className="mp-new">Your biggest yet</p>}
                <h2>{caught.name}</h2>
                <p>{caught.size ? <>{g.caught.size} cm · <span className="mp-stars" aria-label={`${g.caught.stars} of 3 stars`}>{stars(g.caught.stars)}</span></> : 'A curiosity for the shelf.'}</p>
                <p className="mp-earned"><Shell /> +{g.caught.shells} moon shells{g.caught.requests ? ` · ${g.caught.requests} request${g.caught.requests > 1 ? 's' : ''} answered` : ''}</p>
              </div>
            </output>
          )}
          {g.state === 'lost' && g.loss && <output className="mp-card mp-lost" data-testid="lost"><p>{LOST[g.loss]}</p></output>}

          {g.state === 'dawn' && (
            <div className="mp-overlay"><dialog open className="mp-dawn" data-testid="dawn" aria-label="The night is over">
              <h2>{g.complete ? 'The journal is full' : 'First light'}</h2>
              <p>{g.tonight.catches.length ? `${g.tonight.catches.length} sketched and let go, ${g.tonight.lost} got away. ${g.tonight.shells} moon shells.` : 'Nothing came to the dock tonight. The pond will be here tomorrow.'}</p>
              {g.tonight.catches.length > 0 && <div className="mp-night-row">{g.tonight.catches.map((c, i) => <Thumb key={i} id={c.id} known size={44} />)}</div>}
              {g.complete && <><p>Every page is sketched, from the Reed Skipper to the Moon Koi. The pond is yours on any night you like.</p>
                <label className="mp-pick">Tomorrow&apos;s weather <select data-testid="weather" value={choice} onChange={(e) => setChoice(e.target.value as Weather | '')}><option value="">As it comes</option>{WEATHERS.map((w) => <option key={w} value={w}>{WEATHER_NAMES[w]}</option>)}</select></label></>}
              <button className="mp-gold" data-testid="next-night" onClick={() => { g.nextNight(choice || undefined); store(); redraw(); }}>Come back tomorrow night</button>
              <button data-testid="dawn-shop" onClick={() => open('shop')}>Visit the bait shop first</button>
            </dialog></div>
          )}
          {isPaused && g.state !== 'dawn' && <div className="mp-overlay"><dialog open className="mp-dawn" aria-label="Paused"><h2>A quiet moment</h2><p>The pond will wait. Your journal is saved.</p><button className="mp-gold" data-testid="resume" onClick={() => pause(false)}>Back to the water</button><button onClick={leave}>Save &amp; menu</button></dialog></div>}
        </section>

        <aside className="mp-side">
          <div className="mp-stat" data-testid="shells"><Shell /><strong key={g.shells}>{g.shells}</strong><span>moon shells</span></div>
          <fieldset className="mp-choose" aria-label="Who fishes tonight">
            {(['dora', 'enzo'] as const).map((who) => <button key={who} data-testid={`angler-${who}`} aria-pressed={g.angler === who} disabled={!fresh} onClick={() => { g.setAngler(who); store(); redraw(); }}><b>{who === 'dora' ? 'Dora' : 'Enzo'}</b><small>{who === 'dora' ? 'casts further' : 'longer to hook'}</small></button>)}
          </fieldset>
          <fieldset className="mp-choose" aria-label="Lure">
            {LURES.map((l) => <button key={l} data-testid={`lure-${l}`} aria-pressed={g.lure === l} disabled={!g.lures.includes(l) || g.state !== 'ready'} onClick={() => { g.setLure(l); store(); redraw(); }}><b>{LURE_NAMES[l]}</b><small>{g.lures.includes(l) ? (g.lure === l ? 'on the line' : 'in the box') : 'bait shop'}</small></button>)}
          </fieldset>
          <div className="mp-menu">
            <button data-testid="journal" aria-expanded={panel === 'journal'} onClick={() => open('journal')}>Journal <b>{g.found}/{SPECIES.length}</b></button>
            <button data-testid="shop" aria-expanded={panel === 'shop'} onClick={() => open('shop')}>Bait shop</button>
            <button data-testid="board" aria-expanded={panel === 'board'} onClick={() => open('board')}>Requests <b>{g.requests.length}</b></button>
          </div>
        </aside>

        <div className="mp-controls">
          <p className="mp-hint" data-testid="hint" aria-live="polite"><span key={hint}>{hint}</span></p>
          <button className="mp-act" data-testid="act" disabled={isPaused || g.state === 'dawn' || g.state === 'flying'} onPointerDown={(e) => press(e, false)} onPointerUp={(e) => lift(e)} onPointerCancel={(e) => lift(e, true)} onLostPointerCapture={(e) => lift(e)} onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); hold(); } }} onKeyUp={(e) => { if (e.code === 'Space' || e.code === 'Enter') release(); }} onBlur={release}>{act}</button>
        </div>
      </div>

      {panel === 'journal' && (
        <dialog open className="mp-panel" aria-label="Journal" data-testid="journal-panel">
          <header><h2>Pond journal</h2><p>{g.found} of {SPECIES.length} pages sketched</p><button data-testid="close" onClick={() => setPanel(null)}>Close</button></header>
          <div className="mp-pages">
            {SPECIES.map((sp, i) => { const e = g.journal[sp.id]; return (
              <button key={sp.id} className="mp-page" data-testid={`page-${sp.id}`} data-known={!!e} data-kind={sp.kind} aria-pressed={page === sp.id} style={{ '--i': i } as React.CSSProperties} onClick={() => setPage(sp.id)}>
                <Thumb id={sp.id} known={!!e} size={56} /><span>{e ? sp.name : `Page ${i + 1}`}</span>{e && sp.size && <small>{stars(e.stars)}</small>}
              </button>); })}
          </div>
          {shown && (() => { const e = g.journal[shown.id]; return (
            <div className="mp-entry" data-testid="entry" key={shown.id}>
              <Thumb id={shown.id} known={!!e} size={104} />
              <div>
                <h3>{e ? shown.name : '???'} <small>{shown.kind === 'legend' ? 'Legend' : shown.kind === 'curio' ? 'Curiosity' : ['', 'Common', 'Uncommon', 'Rare'][shown.rarity]}</small></h3>
                <p>{shown.clue}</p>
                {e && <p>{habits(shown)}</p>}
                {e && <p>{shown.size ? `Biggest ${e.best} cm (${stars(e.stars)}), they run ${shown.size[0]} to ${shown.size[1]} cm. ` : ''}Sketched {e.n} time{e.n > 1 ? 's' : ''}.</p>}
              </div>
            </div>); })()}
        </dialog>
      )}
      {panel === 'shop' && (
        <dialog open className="mp-panel" aria-label="Bait shop" data-testid="shop-panel">
          <header><h2>Bait shop</h2><p><Shell /> {g.shells} moon shells</p><button data-testid="close" onClick={() => setPanel(null)}>Close</button></header>
          {g.state !== 'ready' && g.state !== 'dawn' && <p className="mp-note">The shop opens again when the line is back in.</p>}
          <ul className="mp-goods">
            {UPGRADE_IDS.map((id) => { const cost = g.cost(id), level = g.up[id]; return (
              <li key={id}><div><b>{UPGRADES[id].name}</b> <small>{level}/{UPGRADES[id].costs.length}</small><p>{cost === null ? 'As good as it gets.' : UPGRADES[id].blurb[level]}</p></div>
                <button data-testid={`buy-${id}`} disabled={cost === null || g.shells < cost || (g.state !== 'ready' && g.state !== 'dawn')} onClick={() => buy(id)}>{cost === null ? 'Owned' : `${cost} shells`}</button></li>); })}
            {LURES.filter((l) => l !== 'glow').map((l) => (
              <li key={l}><div><b>{LURE_NAMES[l]}</b><p>{l === 'clover' ? 'A knot of fresh clover. Grazers and slow old things come for it.' : 'A pinch of bathing dust. It clouds the water and stirs the bottom-dwellers.'}</p></div>
                <button data-testid={`buy-${l}`} disabled={g.lures.includes(l) || g.shells < LURE_COST[l] || (g.state !== 'ready' && g.state !== 'dawn')} onClick={() => buyLure(l)}>{g.lures.includes(l) ? 'Owned' : `${LURE_COST[l]} shells`}</button></li>))}
          </ul>
        </dialog>
      )}
      {panel === 'board' && (
        <dialog open className="mp-panel" aria-label="Requests" data-testid="board-panel">
          <header><h2>Requests from the neighbours</h2><p>Answered by sketching the right catch</p><button data-testid="close" onClick={() => setPanel(null)}>Close</button></header>
          <ul className="mp-goods">{g.requests.map((r, i) => <li key={i}><div><p>{requestText(r)}</p></div><span className="mp-reward"><Shell /> {r.reward}</span></li>)}</ul>
        </dialog>
      )}
    </main>
  );
}
