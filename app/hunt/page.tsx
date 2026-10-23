'use client';

import { useEffect, useRef, useState } from 'react';
import { BEAST_IDS, BEASTS, DT, HuntGame, NO_INPUT, SAVE_KEY, type BeastId, type Input, type SpotId } from '@/lib/grumble-hunt-game';
import type { HuntScene } from '@/lib/grumble-hunt-scene';
import { HuntSound } from './sound';
import './hunt.css';

type ActionKey = Exclude<keyof Input, 'x' | 'z'>;
type Panel = 'choose' | 'board' | 'forge' | 'book' | 'help' | 'reset' | null;
const ITEM_NAMES = ['Berry', 'Dizzy dust', 'Pep seed'];
const ITEM_HELP = ['Restore 35 Fluff', 'Makes a nearby beast dizzy', 'Faster paws for 10 seconds'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }

export default function GrumbleHuntPage() {
  const game = useRef<HuntGame | null>(null), scene = useRef<HuntScene | null>(null), sound = useRef<HuntSound | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), dialog = useRef<HTMLElement>(null);
  const keys = useRef(new Set<string>()), touch = useRef({ ...NO_INPUT }), joystick = useRef<{ id: number; x: number; y: number } | null>(null), drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pulses = useRef(new Set<ActionKey>());
  const panelRef = useRef<Panel>(null), pausedBeforePanel = useRef(false), written = useRef('');
  const [ready, setReady] = useState(false), [rendered, setRendered] = useState(false), [panel, setPanel] = useState<Panel>(null), [muted, setMuted] = useState(false), [error, setError] = useState(''), [stick, setStick] = useState({ x: 0, y: 0 });
  const [, setTick] = useState(0), refresh = () => setTick((n) => n + 1);
  panelRef.current = panel;
  const persist = () => { if (!game.current) return; const json = JSON.stringify(game.current.save()); if (json === written.current) return; try { localStorage.setItem(SAVE_KEY, json); written.current = json; } catch { /* Storage may be unavailable; play continues. */ } };
  const release = () => { keys.current.clear(); touch.current = { ...NO_INPUT }; pulses.current.clear(); joystick.current = null; drag.current = null; game.current?.clearInput(); setStick({ x: 0, y: 0 }); };
  const focusWorld = () => canvas.current?.focus({ preventScroll: true });
  const openPanel = (next: Panel) => { release(); const g = game.current; if (g) { if (!panelRef.current) pausedBeforePanel.current = g.paused; g.paused = true; } panelRef.current = next; setPanel(next); sound.current?.unlock(); };
  const closePanel = () => { if (!game.current?.profile.hero && panel === 'choose') return; if (game.current) game.current.paused = pausedBeforePanel.current; const next = game.current?.profile.hero ? null : 'choose'; panelRef.current = next; setPanel(next); release(); if (!next) focusWorld(); };
  const start = (id: BeastId) => { const g = game.current; if (!g?.startHunt(id)) return; release(); panelRef.current = null; setPanel(null); persist(); refresh(); focusWorld(); sound.current?.unlock(); };
  const village = () => { game.current?.returnVillage(); release(); panelRef.current = null; setPanel(null); persist(); refresh(); focusWorld(); };
  const pause = () => { const g = game.current; if (!g || g.mode !== 'hunt') return; g.paused = !g.paused; release(); persist(); refresh(); focusWorld(); };
  const mute = () => { const s = sound.current; if (!s) return; s.unlock(); s.setMuted(!s.muted()); setMuted(s.muted()); if (game.current?.mode === 'hunt' && !panelRef.current) focusWorld(); };

  useEffect(() => {
    let stopped = false, raf = 0, last = 0, acc = 0, ui = 0;
    const g = HuntGame.load(readSave()); game.current = g; sound.current = new HuntSound(); setMuted(sound.current.muted());
    if (!g.profile.hero) { panelRef.current = 'choose'; setPanel('choose'); }
    setReady(true);
    const pauseForFocus = () => { release(); if (game.current?.mode === 'hunt') game.current.paused = true; persist(); refresh(); };
    const visibility = () => { if (document.hidden) pauseForFocus(); last = 0; acc = 0; };
    const saveOnHide = () => persist();
    window.addEventListener('blur', pauseForFocus); window.addEventListener('pagehide', saveOnHide); document.addEventListener('visibilitychange', visibility);
    const lost = (e: Event) => { e.preventDefault(); release(); if (game.current?.mode === 'hunt') game.current.paused = true; refresh(); setError('The meadow renderer paused. Reload the page to return safely to camp; your gathered materials are saved.'); persist(); };
    const restored = () => { if (game.current) game.current.paused = false; last = 0; acc = 0; setError(''); refresh(); if (game.current?.mode === 'hunt' && !panelRef.current) focusWorld(); };
    const surface = canvas.current;
    surface?.addEventListener('webglcontextlost', lost);
    surface?.addEventListener('webglcontextrestored', restored);
    import('@/lib/grumble-hunt-scene').then(({ createHuntScene }) => {
      if (stopped || !canvas.current) return;
      try { scene.current = createHuntScene(canvas.current, () => setRendered(true), setError); }
      catch (cause) { console.error('Grumble Hunt renderer:', cause); setError('This meadow needs WebGL 2. Try a browser with 3D graphics enabled. Your camp progress is safe.'); return; }
      const loop = (now: number) => {
        if (stopped) return;
        const current = game.current!;
        const elapsed = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 0; last = now;
        if (!document.hidden) {
          acc = Math.min(0.12, acc + elapsed);
          const k = keys.current, t = touch.current, yaw = scene.current?.yaw ?? 0;
          const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + t.x;
          const z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + t.z;
          const input: Input = { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: z * Math.cos(yaw) - x * Math.sin(yaw), sprint: k.has('ShiftLeft') || k.has('ShiftRight') || t.sprint, bonk: k.has('KeyJ') || t.bonk, charge: k.has('KeyK') || t.charge, roll: k.has('Space') || t.roll, lock: k.has('Tab') || t.lock, previous: k.has('KeyQ') || t.previous, next: k.has('KeyE') || t.next, use: k.has('KeyF') || t.use };
          // A quick tap between animation frames still reaches one fixed step.
          for (const key of pulses.current) input[key] = true;
          while (acc >= DT) { if (!panelRef.current) { const consumes = current.hitstop <= 0 && !current.paused; current.step(DT, input); if (consumes) pulses.current.clear(); } acc -= DT; }
          for (const e of current.events.splice(0)) { sound.current?.cue(e.kind); if (e.kind === 'interact' && e.spot) openPanel(e.spot); }
          scene.current?.draw(current, Math.max(DT, elapsed));
        }
        // Permanent progress is saved in the very frame it changes, including the last bonk.
        persist();
        if (now - ui > 100) { refresh(); ui = now; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => { if (!stopped) setError('The meadow could not open. Reload to try again; your camp is saved.'); });
    return () => {
      stopped = true; cancelAnimationFrame(raf); persist(); keys.current.clear(); touch.current = { ...NO_INPUT };
      window.removeEventListener('blur', pauseForFocus); window.removeEventListener('pagehide', saveOnHide); document.removeEventListener('visibilitychange', visibility);
      surface?.removeEventListener('webglcontextlost', lost); surface?.removeEventListener('webglcontextrestored', restored); scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
  }, []); // Loop and lifecycle deliberately read refs.

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      sound.current?.unlock();
      if (e.code === 'Escape') { e.preventDefault(); if (panelRef.current) closePanel(); else pause(); return; }
      if (e.code === 'KeyM' && !e.repeat) { mute(); return; }
      if (panelRef.current) return;
      if ((e.target as HTMLElement).closest('button,a') && ['Space', 'Enter', 'Tab'].includes(e.code)) return;
      if (e.code === 'KeyP' && !e.repeat) { pause(); return; }
      if (e.code === 'Tab' && e.shiftKey && game.current?.mode !== 'hunt') return;
      if (game.current?.paused || !['hunt', 'village'].includes(game.current?.mode ?? '')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK', 'Space', 'Tab', 'KeyQ', 'KeyE', 'KeyF'].includes(e.code)) {
        e.preventDefault(); keys.current.add(e.code);
        const pulse: Record<string, ActionKey> = { KeyJ: 'bonk', KeyK: 'charge', Space: 'roll', Tab: 'lock', KeyQ: 'previous', KeyE: 'next', KeyF: 'use' };
        if (!e.repeat && pulse[e.code]) pulses.current.add(pulse[e.code]);
      }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });
  useEffect(() => {
    const api = { game: () => game.current, refresh: () => { persist(); refresh(); }, metrics: () => scene.current?.metrics(), input: () => ({ keys: [...keys.current], touch: { ...touch.current } }) };
    const w = window as unknown as { __hunt?: () => { game: HuntGame | null; refresh: () => void; metrics: () => ReturnType<HuntScene['metrics']> | undefined; input: () => unknown } };
    w.__hunt = () => ({ game: api.game(), refresh: api.refresh, metrics: api.metrics, input: api.input });
    return () => { delete w.__hunt; };
  }, []);
  useEffect(() => { if (panel) dialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [panel]);

  const hold = (key: ActionKey) => ({
    onClick: () => { if (game.current?.mode === 'hunt') focusWorld(); },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); touch.current[key] = true; pulses.current.add(key); sound.current?.unlock(); },
    onPointerUp: () => { touch.current[key] = false; },
    onPointerCancel: () => { touch.current[key] = false; pulses.current.delete(key); game.current?.clearInput(); },
    onLostPointerCapture: () => { touch.current[key] = false; },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); touch.current[key] = true; } },
    onKeyUp: () => { touch.current[key] = false; },
    onBlur: () => { touch.current[key] = false; },
  });
  const g = game.current, b = g?.beast, heroId = g?.heroId ?? 'dora', active = g?.mode === 'hunt', inVillage = g?.mode === 'village';
  const updateStick = (e: React.PointerEvent) => { const j = joystick.current; if (!j || j.id !== e.pointerId) return; const dx = e.clientX - j.x, dz = e.clientY - j.y, len = Math.hypot(dx, dz), s = Math.min(1, 34 / (len || 1)); touch.current.x = dx * s / 34; touch.current.z = dz * s / 34; setStick({ x: dx * s, y: dz * s }); };
  const stopStick = () => { joystick.current = null; touch.current.x = touch.current.z = 0; setStick({ x: 0, y: 0 }); };
  const dismissable = panel !== 'choose' || !!g?.profile.hero;
  const trapFocus = (e: React.KeyboardEvent) => { if (e.key !== 'Tab') return; const nodes = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled),a[href]') ?? [])]; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } };

  return <main className="hunt-shell" data-ready={ready} data-rendered={rendered} data-mode={g?.mode ?? 'loading'}>
    <canvas ref={canvas} className="hunt-canvas" data-testid="hunt-canvas" tabIndex={0} aria-label="Grumble Hunt 3D meadow. Movement and action controls are listed in the field guide."
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => { if (panel || g?.paused) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; focusWorld(); sound.current?.unlock(); }}
      onPointerMove={(e) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; scene.current?.orbit(e.clientX - d.x, e.clientY - d.y); d.x = e.clientX; d.y = e.clientY; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onWheel={(e) => scene.current?.zoom(e.deltaY)} />

    <header className="hunt-header">
      <a href="/" className="hunt-back" aria-label="MAIN ARCADE">← <span>MAIN ARCADE</span></a>
      <div className="hunt-brand"><strong>Grumble Hunt</strong><span>A little adventure. A lovely nap.</span></div>
      <div className="hunt-header-actions"><button onClick={() => openPanel('help')} aria-label="Open field guide" title="Controls and field guide">?</button><button data-testid="mute" onClick={mute} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? 'Sound off' : 'Sound on'}</button>{g?.profile.hero && <button onClick={() => openPanel('reset')}>New game</button>}</div>
    </header>
    {error && <div role="status" className="hunt-error">{error}</div>}
    {!rendered && !error && <div className="hunt-loading" role="status">Opening the meadow…</div>}

    {inVillage && g?.profile.hero && <nav className="hunt-village-nav" aria-label="Clover Camp places">
      <span>CLOVER CAMP</span>{(['board', 'forge', 'book'] as SpotId[]).map((spot) => <button key={spot} data-testid={`open-${spot}`} onClick={() => openPanel(spot)}>{spot === 'board' ? 'Hunt board' : spot === 'forge' ? 'Forge' : 'Beast Book'}</button>)}
      <button onClick={() => openPanel('choose')}>{cap(heroId)} · Switch</button>
    </nav>}

    {b && !inVillage && g?.mode !== 'camp' && <section className="hunt-beast-hud" aria-label={`${BEASTS[b.id].name} Grump`}>
      <div><strong>{BEASTS[b.id].name}</strong><span>{b.state === 'nap' ? 'A sanctuary nap awaits' : b.state === 'dizzy' ? 'Dizzy! Big bonks welcome' : b.state === 'rest' ? 'Resting · your opening' : b.id === 'frostmane' ? `Mood ${b.phase} of 3` : 'Gently calm this grumpy friend'}</span></div>
      <progress aria-label="Grump" data-testid="grump" max={b.maxGrump} value={b.grump} /><small>Grump {Math.ceil(b.grump)} / {b.maxGrump}{g.locked ? ' · Locked on' : ''}</small>
    </section>}

    {g?.profile.hero && !panel && (active || inVillage) && <>
      <section className="hunt-hero-hud" aria-label="Your Fluff">
        <div><strong>{cap(heroId)}</strong><span>{heroId === 'dora' ? 'Acorn Hammer' : 'Seed Bow'} · Lv {g.profile.levels[heroId]}</span></div>
        <progress aria-label="Fluff" data-testid="fluff" max={100} value={g.hero.fluff} /><small>Fluff {Math.ceil(g.hero.fluff)} / 100</small>
        <p>{cap(g.buddyId)} is with you{g.buddy.berry <= 0 ? ' · berry ready' : ' · gathering a berry'}.</p>
        {active && <small data-testid="charge-status">{g.hero.cooldown > 0 ? 'Tool recovering' : g.hero.charge >= 0.35 ? 'Big bonk or shot ready' : g.hero.charge > 0 ? 'Charging…' : 'Hold K to charge'}</small>}
      </section>
      {active && <div className="hunt-items" aria-label="Pouch items"><button aria-label="Previous item" onClick={() => { g.item = (g.item + 2) % 3; refresh(); focusWorld(); }}>‹</button><button data-testid="use-item" onClick={() => { g.useItem(); refresh(); focusWorld(); }} title={ITEM_HELP[g.item]}><strong>{ITEM_NAMES[g.item]} ×{g.items[g.item]}</strong><small>F · use · Q / E to pick</small></button><button aria-label="Next item" onClick={() => { g.item = (g.item + 1) % 3; refresh(); focusWorld(); }}>›</button></div>}
      {active && <button className="hunt-pause" data-testid="pause" onClick={pause}>Ⅱ Pause</button>}
      {inVillage && g.nearestSpot() && <button className="hunt-interact" onClick={() => openPanel(g.nearestSpot()!.id)}>F · Visit {g.nearestSpot()!.name}</button>}
      <div className="hunt-touch" aria-label="Touch controls">
        <div className="hunt-joystick" data-testid="joystick" role="group" aria-label="Movement joystick"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); joystick.current = { id: e.pointerId, x: r.x + r.width / 2, y: r.y + r.height / 2 }; updateStick(e); sound.current?.unlock(); }} onPointerMove={updateStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} /><small>MOVE</small>
        </div>
        <div className="hunt-touch-buttons"><button {...hold('sprint')} aria-label="Hold to sprint">Sprint</button>{active && <button {...hold('lock')} aria-label="Toggle lock on">Lock</button>}<button {...hold('roll')} data-testid="touch-roll">Roll</button>{active && <><button {...hold('charge')} data-testid="touch-charge">Hold · big</button><button className="hunt-bonk" {...hold('bonk')} data-testid="touch-bonk">{heroId === 'dora' ? 'Bonk' : 'Shoot'}</button></>}</div>
      </div>
    </>}

    {g && !panel && <p className="hunt-note" role="status" data-testid="note">{g.note}</p>}
    {!panel && (active || inVillage) && <p className="hunt-shortcuts">WASD move · Shift sprint · J {heroId === 'dora' ? 'bonk' : 'shoot'} · hold K charge · Space roll · Tab lock · Q/E items · F use · drag to look</p>}

    {g?.paused && active && !panel && <div className="hunt-shade"><section ref={dialog} onKeyDown={trapFocus} className="hunt-modal hunt-result" role="dialog" aria-modal="true" aria-label="Paused"><p className="hunt-eyebrow">A QUIET MOMENT</p><h1>Rest your paws.</h1><p>Your gathered materials are safe. Take all the time you need.</p><button className="hunt-primary" data-testid="resume" autoFocus onClick={pause}>Back to the meadow</button><button onClick={village}>Return to camp</button></section></div>}
    {g && ['camp', 'calm', 'victory'].includes(g.mode) && !panel && <div className="hunt-shade"><section className="hunt-modal hunt-result" data-testid="result" aria-label="Hunt result">
      <p className="hunt-eyebrow">{g.mode === 'victory' ? 'THE SANCTUARY IS FULL OF FRIENDS' : g.mode === 'camp' ? 'BACK AT CAMP' : 'ONE LESS GRUMBLE IN THE MEADOW'}</p>
      <h1>{g.mode === 'victory' ? 'A grand, gentle adventure.' : g.mode === 'camp' ? 'A little tuckered out.' : `${BEASTS[g.lastHunt].name} is napping!`}</h1>
      <p>{g.mode === 'victory' ? 'Even mighty Frostmane found a soft place to curl up. Dora and Enzo made new friends, one lovely nap at a time.' : g.mode === 'camp' ? 'Every material you gathered is tucked away safely. A fresh berry pouch and another try are ready whenever you are.' : 'Your new friend is off to the sanctuary. All meadow materials are collected. Visit the Forge for something lovely.'}</p>
      {g.unlockedFinalHunts && g.mode !== 'camp' && <p className="hunt-unlock">Hornclack and Frostmane are now on the hunt board!</p>}
      <button className="hunt-primary" data-testid="return-village" onClick={village}>Return to Clover Camp</button><button data-testid="retry" onClick={() => start(g.lastHunt)}>{g.mode === 'camp' ? 'Try this hunt again' : 'Replay this hunt'}</button>{g.mode === 'victory' && <button onClick={() => openPanel('reset')}>New game</button>}
    </section></div>}

    {panel && <div className={`hunt-shade ${panel === 'choose' ? 'hunt-title-shade' : ''}`}><section ref={dialog} className={`hunt-modal hunt-panel-${panel}`} role="dialog" aria-modal="true" aria-labelledby="hunt-panel-title" onKeyDown={trapFocus} data-testid={`panel-${panel}`}>
      {dismissable && <button className="hunt-close" aria-label="Close panel" onClick={closePanel}>×</button>}
      {panel === 'choose' && <><p className="hunt-eyebrow">WELCOME TO CLOVER CAMP</p><h1 id="hunt-panel-title">Small paws.<br /><em>Big grumbles.</em></h1><p>A storybook meadow, five huffy beasts, and two very good friends. Gently bonk each grump into a lovely nap.</p><h2>Who will lead the way?</h2><div className="hunt-hero-picks">{(['dora', 'enzo'] as const).map((id) => <button key={id} data-testid={`choose-${id}`} disabled={!ready} onClick={() => { g?.chooseHero(id); if (g) g.paused = false; panelRef.current = null; setPanel(null); release(); persist(); refresh(); focusWorld(); sound.current?.unlock(); }}><span className={`hunt-portrait ${id}`} aria-hidden="true"><i /><i /></span><strong>{cap(id)}</strong><small>{id === 'dora' ? 'White chinchilla · Acorn Hammer' : 'Grey chinchilla · Seed Bow'}</small><p>{id === 'dora' ? 'Slow, mighty bonks. Charge a swing to build dizzy.' : 'A nimble archer. Hold a shot for a bigger bonk.'}</p></button>)}</div><p className="hunt-fine">Your other friend comes along to help bonk and toss healing berries. You can switch at camp.</p></>}
      {panel === 'board' && <><p className="hunt-eyebrow">CLOVER CAMP · HUNT BOARD</p><h1 id="hunt-panel-title">A meadow of grumpy friends.</h1><p>Pick a hunt. Calm three different beasts to open the final two. Every hunt can be replayed.</p><div className="hunt-board">{BEAST_IDS.map((id) => <article key={id} style={{ '--beast-color': BEASTS[id].color } as React.CSSProperties}><img src={`/art/hunt/ref-${id}.webp`} alt={`${BEASTS[id].name} modelling reference: side, front and three-quarter views`} /><div><h2>{BEASTS[id].name}</h2><span className="hunt-badge">{g?.profile.naps[id] ? `Napping at the sanctuary · ${g.profile.naps[id]} calm${g.profile.naps[id] === 1 ? '' : 's'}` : g?.unlocked(id) ? 'Ready to meet you' : 'Calm 3 different beasts to unlock'}</span><p>{BEASTS[id].tip}</p><button className="hunt-primary" data-testid={`hunt-${id}`} disabled={!g?.unlocked(id)} onClick={() => start(id)}>{g?.unlocked(id) ? `Visit ${BEASTS[id].name}` : `Locked · ${g?.uniqueNaps ?? 0} / 3`}</button></div></article>)}</div></>}
      {panel === 'forge' && <><p className="hunt-eyebrow">CLOVER CAMP · THE FORGE</p><h1 id="hunt-panel-title">Made with little treasures.</h1><p>The beasts shed lovely materials when bonked, when a part pops off, and when calmed. Gather them, then make both friends’ tools stronger.</p><p className="hunt-wallet" data-testid="material-total">{g?.materialTotal ?? 0} materials in your satchel</p><div className="hunt-forge">{(['dora', 'enzo'] as const).map((id) => { const lv = g?.profile.levels[id] ?? 1, cost = g?.upgradeCost(id) ?? 0; return <article key={id}><span className="hunt-eyebrow">{cap(id)}’S TOOL</span><h2>{id === 'dora' ? 'Acorn Hammer' : 'Seed Bow'}</h2><div className="hunt-levels" aria-label={`Level ${lv} of 3`}>{[1, 2, 3].map((n) => <span key={n} data-filled={n <= lv}>{n}</span>)}</div><p>{id === 'dora' ? 'Larger bonks and stronger charged swings.' : 'Stronger seed shots, including your buddy’s shots.'}</p><button data-testid={`upgrade-${id}`} disabled={lv >= 3 || !g || g.materialTotal < cost} onClick={() => { g?.upgrade(id); persist(); refresh(); sound.current?.cue('part'); }}>{lv >= 3 ? 'Lovely! Fully upgraded' : `Upgrade · ${cost} materials`}</button></article>; })}</div><p className="hunt-fine">Three levels per tool. Upgrades use any beast material and help your buddy too.</p></>}
      {panel === 'book' && <><p className="hunt-eyebrow">CLOVER CAMP · BEAST BOOK</p><h1 id="hunt-panel-title">Every grump has a soft side.</h1><p data-testid="nap-count">{g?.uniqueNaps ?? 0} / 5 friends napping at the sanctuary.</p><div className="hunt-book">{BEAST_IDS.map((id) => <article key={id}><img src={`/art/hunt/ref-${id}.webp`} alt={`${BEASTS[id].name}, a gentle storybook beast`} /><h2>{BEASTS[id].name}</h2><strong className="hunt-badge">{g?.profile.naps[id] ? 'Napping at the sanctuary' : 'Not calmed yet'}</strong><p>{BEASTS[id].tip}</p><p><b>{BEASTS[id].material}:</b> {g?.profile.materials[id] ?? 0} in your satchel.<br />Pop-off part: {BEASTS[id].part}.</p></article>)}</div></>}
      {panel === 'help' && <><p className="hunt-eyebrow">THE FIELD GUIDE</p><h1 id="hunt-panel-title">A gentle kind of hunt.</h1><p>Beasts are never hurt. Bonks lower Grump until they curl up for a nap and go to the sanctuary. An orange lane or circle always warns you before an attack.</p><dl className="hunt-controls"><dt>WASD / arrows</dt><dd>Move · Shift sprints</dd><dt>J</dt><dd>Dora bonks; Enzo shoots</dd><dt>Hold K, release</dt><dd>Charge a big swing or seed shot</dd><dt>Space</dt><dd>Roll, with a brief dodge window</dd><dt>Tab</dt><dd>Lock on while the meadow has focus</dd><dt>Q / E · F</dt><dd>Pick an item · use it</dd><dt>Drag · scroll</dt><dd>Orbit the camera · zoom</dd><dt>P / Escape · M</dt><dd>Pause · toggle sound</dd></dl><p><b>Touch:</b> move with the joystick, drag the meadow to look, tap Bonk or Shoot, hold “Hold · big” to charge, and use Roll, Lock and the item pouch.</p><p><b>Dizzy:</b> two big bonks or big shots; buddy bonks help a little. A crash into a tree or rock also makes an opening. Dizzy beasts take bigger bonks. Your buddy helps and tosses a healing berry when Fluff is low.</p><p><b>Tuckered out?</b> You return to camp with every gathered material safe. Your berries refill for the next hunt. Reloading also returns safely to camp, keeping permanent progress.</p><button className="hunt-primary" onClick={closePanel}>Ready for a little adventure</button></>}
      {panel === 'reset' && <><p className="hunt-eyebrow">A FRESH STORYBOOK</p><h1 id="hunt-panel-title">Start a new adventure?</h1><p>This resets your chosen hero, tool upgrades, beast materials and sanctuary naps in Grumble Hunt.</p><button className="hunt-primary" data-testid="confirm-reset" onClick={() => { game.current = new HuntGame(); written.current = ''; release(); persist(); panelRef.current = 'choose'; setPanel('choose'); refresh(); }}>Start a new game</button><button onClick={closePanel}>Keep this adventure</button></>}
    </section></div>}
  </main>;
}
