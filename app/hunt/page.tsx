'use client';

import { useEffect, useRef, useState } from 'react';
import { BEAST_IDS, BEAST_MATERIALS, BEASTS, DT, FORGE_MATERIALS, GATHER_TIME, HUNT_AREA, HuntGame, ITEM_IDS, NO_INPUT, plural, ORDER_NAMES, RING_ITEMS, RING_SIZE, SAVE_KEY, SNACK_IDS, V1_SAVE_KEY, type BeastId, type Hero, type HeroId, type Input, type ItemId, type MaterialId, type SpotId } from '@/lib/grumble-hunt-game';
import { ITEMS, MATERIALS, SNACKS, type Cost, type ItemEffect, type SnackEffect } from '@/lib/grumble-hunt-content';
import type { HuntScene } from '@/lib/grumble-hunt-scene';
import { HuntSound } from './sound';
import './hunt.css';

type ActionKey = Exclude<keyof Input, 'x' | 'z'>;
type Panel = 'choose' | 'board' | 'forge' | 'book' | 'pantry' | 'help' | 'reset' | null;
const AREA_NAMES: Record<string, string> = { meadow: 'Clover Meadow', marsh: 'Soggy Marsh', ridge: 'Windy Ridge', hollow: 'Pebble Hollow', peak: 'Frosty Peak' };
const itemText = (e: ItemEffect) => e.kind === 'heal' ? `Restores ${e.fluff} Fluff.` : e.kind === 'drowsy' ? `Toss within 10 steps: the beast moves ${Math.round(e.slow * 100)}% slower for ${e.seconds} s.` : e.kind === 'dizzy' ? `Ring it beside the beast: +${e.amount} Dizzy.` : e.kind === 'trap' ? `A trap: the beast is stuck for ${e.seconds} s. One at a time.` : e.kind === 'hide' ? `Hide in smoke for ${e.seconds} s; the beast loses track and wanders.` : e.kind === 'track' ? `Glowing pawprints lead to the beast for ${e.seconds} s.` : 'A snack ingredient.';
const snackText = (e: SnackEffect) => e.maxFluff ? `+${e.maxFluff} max Fluff` : e.staminaRegen ? `Rolls recover ${Math.round(e.staminaRegen * 100)}% faster` : e.dizzyBonus ? `+${Math.round(e.dizzyBonus * 100)}% Dizzy on every hit` : 'One extra rare-material roll at nap time';
/** The befriended-beast count the Pantry needs for something from a story chapter. */
const opensAfter = (chapter: number) => `Opens after ${chapter - 1} different beast${chapter === 2 ? '' : 's'} nap`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Cells of the painted atlases in public/art/hunt: tool tiers in icons-gear, beast materials in icons-materials. */
const TOOL_ICONS: Record<HeroId, number[]> = { dora: [0, 1, 2], enzo: [6, 7, 8] };
const MOODS = ['happy', 'determined', 'dizzy', 'sleepy'];
/** Portrait cell: dizzy just after a bump, sleepy when Fluff is low, determined while swinging or charging. */
const heroMood = (h: Hero) => h.invincible > 0 ? 2 : h.fluff < 30 ? 3 : h.charge > 0 || h.swing >= 0 ? 1 : 0;
function Art({ sheet, cell, size, grid = 4 }: { sheet: string; cell: number; size: number; grid?: number }) {
  const at = (n: number) => `${(n / (grid - 1)) * 100}%`;
  return <span className="hunt-art" aria-hidden="true" style={{ width: size, height: size, backgroundImage: `url(/art/hunt/${sheet}.webp)`, backgroundSize: `${grid * 100}%`, backgroundPosition: `${at(cell % grid)} ${at(Math.floor(cell / grid))}` }} />;
}
/** A material or item icon, from whichever sheet holds it. */
const Icon = ({ id, size }: { id: MaterialId | ItemId; size: number }) => id in MATERIALS ? <Art sheet="icons-materials" cell={MATERIALS[id as MaterialId].icon} size={size} /> : <Art sheet="icons-items" cell={ITEMS[id as ItemId].icon} size={size} />;
const nameOf = (id: MaterialId | ItemId) => id in MATERIALS ? MATERIALS[id as MaterialId].name : ITEMS[id as ItemId].name;
/** Cost chips: the icon, then what you have of what it needs. */
const Costs = ({ cost, have }: { cost: Cost; have: Record<string, number> }) => <span className="hunt-costs">{Object.entries(cost).map(([id, n]) => <span key={id} title={nameOf(id as MaterialId)} data-short={(have[id] ?? 0) < (n ?? 0)}><Icon id={id as MaterialId} size={22} />{have[id] ?? 0}/{n}</span>)}</span>;
/** The v2 save, or the first build's v1 save when there is no v2 yet. */
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(V1_SAVE_KEY) || 'null'); } catch { return null; } }

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
      <span>CLOVER CAMP</span>{(['board', 'pantry', 'forge', 'book'] as SpotId[]).map((spot) => <button key={spot} data-testid={`open-${spot}`} onClick={() => openPanel(spot)}>{spot === 'board' ? 'Hunt board' : spot === 'pantry' ? 'Pantry' : spot === 'forge' ? 'Forge' : 'Beast Book'}</button>)}
      <button onClick={() => openPanel('choose')}>{cap(heroId)} · Switch</button>
    </nav>}

    {b && !inVillage && g?.mode !== 'camp' && <section className="hunt-beast-hud" aria-label={`${BEASTS[b.id].name} Grump`}>
      <div><strong>{BEASTS[b.id].name}</strong><span>{b.state === 'nap' ? 'A sanctuary nap awaits' : b.state === 'dizzy' ? 'Dizzy! Big bonks welcome' : b.state === 'stuck' ? 'Stuck in sticky sap · bonk away' : g.hero.hidden > 0 ? 'Lost track of you' : b.state === 'rest' ? 'Resting · your opening' : b.grumpy ? 'Extra Grumpy · nearly nap time' : b.drowsy > 0 ? 'Drowsy · 30% slower' : b.id === 'frostmane' ? `Mood ${b.phase} of 3` : 'Gently calm this grumpy friend'}</span></div>
      <progress aria-label="Grump" data-testid="grump" max={b.maxGrump} value={b.grump} /><small>Grump {Math.ceil(b.grump)} / {b.maxGrump}{g.locked ? ' · Locked on' : ''}</small>
    </section>}

    {g?.profile.hero && !panel && (active || inVillage) && <>
      <section className="hunt-hero-hud" aria-label="Your Fluff">
        <div><span className="hunt-face" data-testid="hero-mood" data-mood={MOODS[heroMood(g.hero)]}><Art sheet={`portraits-${heroId}`} cell={heroMood(g.hero)} grid={2} size={46} /></span><strong>{cap(heroId)}</strong><span><Art sheet="icons-gear" cell={TOOL_ICONS[heroId][g.profile.levels[heroId] - 1]} size={22} />{heroId === 'dora' ? 'Acorn Hammer' : 'Seed Bow'} · Lv {g.profile.levels[heroId]}</span></div>
        <progress aria-label="Fluff" data-testid="fluff" max={g.hero.maxFluff} value={g.hero.fluff} /><small>Fluff {Math.ceil(g.hero.fluff)} / {g.hero.maxFluff}{active && g.snack ? ` · ${SNACKS[g.snack].name}` : ''}</small>
        <p>{cap(g.buddyId)} is with you{g.buddy.berry <= 0 ? ' · berry ready' : ' · picking a berry'}.</p>
        <button className="hunt-order" data-testid="buddy-order" aria-label={`${cap(g.buddyId)}'s order: ${ORDER_NAMES[g.order]}. Change order`} title="Hold Tab and tap Q or E" onClick={() => { g.commandBuddy(1); refresh(); focusWorld(); }}>{cap(g.buddyId)}: <strong>{ORDER_NAMES[g.order]}</strong> ›</button>
        {active && <small data-testid="charge-status">{g.hero.cooldown > 0 ? 'Tool recovering' : g.hero.charge >= 0.35 ? 'Big bonk or shot ready' : g.hero.charge > 0 ? 'Charging…' : 'Hold K to charge'}</small>}
      </section>
      {active && (() => { const id = g.ringItem, n = id ? g.profile.pouch[id] : 0, slots = g.ring.length; return <div className="hunt-items" aria-label="Item ring"><button aria-label="Previous item" onClick={() => { g.item = (g.item + slots - 1) % slots; refresh(); focusWorld(); }}>‹</button><button data-testid="use-item" data-empty={n <= 0} onClick={() => { g.useItem(); refresh(); focusWorld(); }} title={id ? itemText(ITEMS[id].effect) : ''}>{id && <Icon id={id} size={38} />}<span><strong>{id ? ITEMS[id].name : 'Empty'} ×{n}</strong><small>F · use · Q / E · {g.item + 1} of {slots}</small></span></button><button aria-label="Next item" onClick={() => { g.item = (g.item + 1) % slots; refresh(); focusWorld(); }}>›</button></div>; })()}
      {active && (() => { const busy = g.gathering ? g.spots.find((s) => s.id === g.gathering!.spot) : null, spot = busy ?? g.nearestGather(); if (!spot) return null; const name = plural(spot.count, MATERIALS[spot.material].name).toLowerCase(); return <button className="hunt-gather" data-testid="gather" onClick={() => { pulses.current.add('use'); focusWorld(); }}><Icon id={spot.material} size={30} /><span>{busy && g.gathering ? <>Gathering {name}… <progress max={GATHER_TIME} value={g.gathering.t} /></> : <>F · Gather {spot.count} {name}</>}</span></button>; })()}
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
    {!panel && (active || inVillage) && <p className="hunt-shortcuts">WASD move · Shift sprint · J {heroId === 'dora' ? 'bonk' : 'shoot'} · hold K charge · Space roll · Tab lock · Q/E items · hold Tab + Q/E buddy · F use or gather · drag to look</p>}

    {g?.paused && active && !panel && <div className="hunt-shade"><section ref={dialog} onKeyDown={trapFocus} className="hunt-modal hunt-result" role="dialog" aria-modal="true" aria-label="Paused"><p className="hunt-eyebrow">A QUIET MOMENT</p><h1>Rest your paws.</h1><p>Your gathered materials are safe. Take all the time you need.</p><button className="hunt-primary" data-testid="resume" autoFocus onClick={pause}>Back to the meadow</button><button onClick={village}>Return to camp</button></section></div>}
    {g && ['camp', 'calm', 'victory'].includes(g.mode) && !panel && <div className="hunt-shade"><section className="hunt-modal hunt-result" data-testid="result" aria-label="Hunt result">
      <p className="hunt-eyebrow">{g.mode === 'victory' ? 'THE SANCTUARY IS FULL OF FRIENDS' : g.mode === 'camp' ? 'BACK AT CAMP' : 'ONE LESS GRUMBLE IN THE MEADOW'}</p>
      <h1>{g.mode === 'victory' ? 'A grand, gentle adventure.' : g.mode === 'camp' ? 'A little tuckered out.' : `${BEASTS[g.lastHunt].name} is napping!`}</h1>
      <p>{g.mode === 'victory' ? 'Even mighty Frostmane found a soft place to curl up. Dora and Enzo made new friends, one lovely nap at a time.' : g.mode === 'camp' ? 'Every material you gathered is tucked away safely. Your berries are topped back up and another try is ready whenever you are.' : 'Your new friend is off to the sanctuary. All meadow materials are collected. Visit the Pantry or the Forge for something lovely.'}</p>
      {g.mode !== 'camp' && g.reward.length > 0 && <div className="hunt-reward" data-testid="reward"><span>You got</span>{[...new Set(g.reward)].map((id) => <span key={id} title={MATERIALS[id].name}><Icon id={id} size={40} />×{g.reward.filter((m) => m === id).length}</span>)}</div>}
      {g.unlockedFinalHunts && g.mode !== 'camp' && <p className="hunt-unlock">Hornclack and Frostmane are now on the hunt board!</p>}
      <button className="hunt-primary" data-testid="return-village" onClick={village}>Return to Clover Camp</button><button data-testid="retry" onClick={() => start(g.lastHunt)}>{g.mode === 'camp' ? 'Try this hunt again' : 'Replay this hunt'}</button>{g.mode === 'victory' && <button onClick={() => openPanel('reset')}>New game</button>}
    </section></div>}

    {panel && <div className={`hunt-shade ${panel === 'choose' ? 'hunt-title-shade' : ''}`}><section ref={dialog} className={`hunt-modal hunt-panel-${panel}`} role="dialog" aria-modal="true" aria-labelledby="hunt-panel-title" onKeyDown={trapFocus} data-testid={`panel-${panel}`}>
      {dismissable && <button className="hunt-close" aria-label="Close panel" onClick={closePanel}>×</button>}
      {panel === 'choose' && <><p className="hunt-eyebrow">WELCOME TO CLOVER CAMP</p><h1 id="hunt-panel-title">Small paws.<br /><em>Big grumbles.</em></h1><p>A storybook meadow, five huffy beasts, and two very good friends. Gently bonk each grump into a lovely nap.</p><h2>Who will lead the way?</h2><div className="hunt-hero-picks">{(['dora', 'enzo'] as const).map((id) => <button key={id} data-testid={`choose-${id}`} disabled={!ready} onClick={() => { g?.chooseHero(id); if (g) g.paused = false; panelRef.current = null; setPanel(null); release(); persist(); refresh(); focusWorld(); sound.current?.unlock(); }}><span className="hunt-portrait"><Art sheet={`portraits-${id}`} cell={0} grid={2} size={88} /></span><strong>{cap(id)}</strong><small>{id === 'dora' ? 'White chinchilla · Acorn Hammer' : 'Grey chinchilla · Seed Bow'}</small><p>{id === 'dora' ? 'Slow, mighty bonks. Charge a swing to build dizzy.' : 'A nimble archer. Hold a shot for a bigger bonk.'}</p></button>)}</div><p className="hunt-fine">Your other friend comes along to help bonk and toss healing berries. You can switch at camp.</p></>}
      {panel === 'board' && <><p className="hunt-eyebrow">CLOVER CAMP · HUNT BOARD</p><h1 id="hunt-panel-title">A meadow of grumpy friends.</h1><p>Pick a hunt. Calm three different beasts to open the final two. Every hunt can be replayed.</p><div className="hunt-board">{BEAST_IDS.map((id) => <article key={id} style={{ '--beast-color': BEASTS[id].color } as React.CSSProperties}><img src={`/art/hunt/ref-${id}.webp`} alt={`${BEASTS[id].name} modelling reference: side, front and three-quarter views`} /><div><h2>{BEASTS[id].name}</h2><span className="hunt-badge">{g?.profile.naps[id] ? `Napping at the sanctuary · ${g.profile.naps[id]} calm${g.profile.naps[id] === 1 ? '' : 's'}` : g?.unlocked(id) ? 'Ready to meet you' : 'Calm 3 different beasts to unlock'}</span><p>{BEASTS[id].tip}</p><button className="hunt-primary" data-testid={`hunt-${id}`} disabled={!g?.unlocked(id)} onClick={() => start(id)}>{g?.unlocked(id) ? `Visit ${BEASTS[id].name}` : `Locked · ${g?.uniqueNaps ?? 0} / 3`}</button></div></article>)}</div></>}
      {panel === 'forge' && <><p className="hunt-eyebrow">CLOVER CAMP · THE FORGE</p><h1 id="hunt-panel-title">Made with little treasures.</h1><p>The beasts shed lovely materials when bonked, when a part pops off, and when calmed. Gather them, then make both friends’ tools stronger.</p><p className="hunt-wallet" data-testid="material-total">{g?.materialTotal ?? 0} beast materials in your satchel</p><ul className="hunt-satchel" aria-label="Beast materials">{FORGE_MATERIALS.filter((id) => (g?.profile.pouch[id] ?? 0) > 0).map((id) => <li key={id} title={MATERIALS[id].name}><Icon id={id} size={34} /><span>{MATERIALS[id].name}</span><strong>{g?.profile.pouch[id]}</strong></li>)}</ul><div className="hunt-forge">{(['dora', 'enzo'] as const).map((id) => { const lv = g?.profile.levels[id] ?? 1, cost = g?.upgradeCost(id) ?? 0; return <article key={id}><span className="hunt-eyebrow">{id.toUpperCase()}’S TOOL</span><h2>{id === 'dora' ? 'Acorn Hammer' : 'Seed Bow'}</h2><div className="hunt-levels" aria-label={`Level ${lv} of 3`}>{[1, 2, 3].map((n) => <span key={n} data-filled={n <= lv} title={`Level ${n}`}><Art sheet="icons-gear" cell={TOOL_ICONS[id][n - 1]} size={44} /></span>)}</div><p>{id === 'dora' ? 'Larger bonks and stronger charged swings.' : 'Stronger seed shots, including your buddy’s shots.'}</p><button data-testid={`upgrade-${id}`} disabled={lv >= 3 || !g || g.materialTotal < cost} onClick={() => { g?.upgrade(id); persist(); refresh(); sound.current?.cue('part'); }}>{lv >= 3 ? 'Lovely! Fully upgraded' : `Upgrade · ${cost} materials`}</button></article>; })}</div><p className="hunt-fine">Three levels per tool. Upgrades use any beast materials, commonest first, and help your buddy too. Berries, marsh reeds and glimmer stones stay in the pouch for the Pantry.</p></>}
      {panel === 'book' && <><p className="hunt-eyebrow">CLOVER CAMP · BEAST BOOK</p><h1 id="hunt-panel-title">Every grump has a soft side.</h1><p data-testid="nap-count">{g?.uniqueNaps ?? 0} / 5 friends napping at the sanctuary.</p><div className="hunt-book">{BEAST_IDS.map((id) => <article key={id}><img src={`/art/hunt/ref-${id}.webp`} alt={`${BEASTS[id].name}, a gentle storybook beast`} /><h2>{BEASTS[id].name}</h2><strong className="hunt-badge">{g?.profile.naps[id] ? 'Napping at the sanctuary' : 'Not calmed yet'}</strong><p>{BEASTS[id].tip}</p><p>Lives in {AREA_NAMES[HUNT_AREA[id]]}. Pop-off part: {BEASTS[id].part}.</p><ul className="hunt-satchel" aria-label={`${BEASTS[id].name} materials`}>{BEAST_MATERIALS[id].map((m) => <li key={m} title={MATERIALS[m].name}><Icon id={m} size={26} /><span>{MATERIALS[m].name}</span><strong>{g?.profile.pouch[m] ?? 0}</strong></li>)}</ul></article>)}</div></>}
      {panel === 'pantry' && g && <><p className="hunt-eyebrow">CLOVER CAMP · THE PANTRY</p><h1 id="hunt-panel-title">Snacks and handy things.</h1><p>Gather berries, marsh reeds and glimmer stones on hunts (press F at a bush, reeds or a sparkle), then make items for your ring and one snack for the next hunt. Camp tops your pouch up to 3 fluffberries before every hunt.</p>
        <p className="hunt-wallet">In your pouch</p><ul className="hunt-satchel" aria-label="Gathered materials">{(['berry', 'marsh-reed', 'glimmer-stone'] as const).map((id) => <li key={id}><Icon id={id} size={34} /><span>{MATERIALS[id].name}</span><strong data-testid={`pouch-${id}`}>{g.profile.pouch[id]}</strong></li>)}</ul>
        <h2>Items <small data-testid="ring-count">{g.ring.length} / {RING_SIZE} in your ring</small></h2>
        <div className="hunt-pantry">{ITEM_IDS.map((id) => { const it = ITEMS[id], open = g.chapter >= it.chapter, ring = g.ring.includes(id), have = g.profile.pouch[id]; return <article key={id} data-open={open} data-testid={`item-${id}`}><Icon id={id} size={56} /><div><h3>{it.name} <small>×{have} / {it.max}</small></h3><p>{itemText(it.effect)}</p>{open ? <Costs cost={it.recipe} have={g.profile.pouch} /> : <p className="hunt-fine">{opensAfter(it.chapter)}.</p>}<div className="hunt-pantry-actions"><button data-testid={`craft-${id}`} disabled={!g.canCraft(id)} onClick={() => { g.craft(id); persist(); refresh(); }}>{have >= it.max ? 'Pouch full' : 'Make one'}</button>{RING_ITEMS.includes(id) && <button data-testid={`ring-${id}`} aria-pressed={ring} disabled={ring ? g.ring.length <= 1 : g.ring.length >= RING_SIZE} onClick={() => { g.toggleRing(id); persist(); refresh(); }}>{ring ? '✓ In ring' : 'Add to ring'}</button>}</div></div></article>; })}</div>
        <h2>Snacks <small>{g.profile.snack ? `${SNACKS[g.profile.snack].name} is packed` : 'One per hunt'}</small></h2>
        <div className="hunt-pantry">{SNACK_IDS.map((id) => { const sn = SNACKS[id], open = g.chapter >= sn.chapter, packed = g.profile.snack === id; return <article key={id} data-open={open} data-testid={`snack-${id}`}><Art sheet="icons-items" cell={9} size={56} /><div><h3>{sn.name}</h3><p>{snackText(sn.effect)}, for the next hunt.</p>{open ? <Costs cost={sn.cost} have={g.profile.pouch} /> : <p className="hunt-fine">{opensAfter(sn.chapter)}.</p>}<div className="hunt-pantry-actions"><button data-testid={`eat-${id}`} disabled={!g.canEat(id)} onClick={() => { g.eatSnack(id); persist(); refresh(); }}>{packed ? '✓ Packed' : 'Pack it'}</button></div></div></article>; })}</div></>}
      {panel === 'help' && <><p className="hunt-eyebrow">THE FIELD GUIDE</p><h1 id="hunt-panel-title">A gentle kind of hunt.</h1><p>Beasts are never hurt. Bonks lower Grump until they curl up for a nap and go to the sanctuary. An orange lane or circle always warns you before an attack.</p><dl className="hunt-controls"><dt>WASD / arrows</dt><dd>Move · Shift sprints</dd><dt>J</dt><dd>Dora bonks; Enzo shoots</dd><dt>Hold K, release</dt><dd>Charge a big swing or seed shot</dd><dt>Space</dt><dd>Roll, with a brief dodge window</dd><dt>Tab</dt><dd>Lock on while the meadow has focus</dd><dt>Hold Tab, tap Q / E</dt><dd>Tell your buddy to stay close, go bonk or gather</dd><dt>Q / E · F</dt><dd>Pick an item in your ring · use it</dd><dt>F at a bush, reeds or sparkle</dt><dd>Gather: stand still for 1.2 seconds</dd><dt>Drag · scroll</dt><dd>Orbit the camera · zoom</dd><dt>P / Escape · M</dt><dd>Pause · toggle sound</dd></dl><p><b>Touch:</b> move with the joystick, drag the meadow to look, tap Bonk or Shoot, hold “Hold · big” to charge, and use Roll, Lock, the item ring and the Gather button.</p><p><b>Dizzy:</b> two big bonks or big shots; buddy bonks help a little. A crash into a tree or rock also makes an opening. Dizzy beasts take bigger bonks. Your buddy helps and tosses a healing berry when Fluff is low.</p><p><b>Extra Grumpy:</b> below 30% Grump a beast puffs steam from its ears and its eyebrows go red. It moves 15% faster and its orange warning comes 0.1 s sooner. Keep going: it is nearly nap time.</p><p><b>Enzo’s sniff:</b> when the beast is far off or behind a tree or rock, Enzo sniffs out a trail of glowing pawprints that leads to it.</p><p><b>Buddy orders:</b> <i>Go bonk</i> helps once you are near the beast, <i>Stay close</i> keeps your buddy by your side and helps from there, and <i>Gather</i> picks up the materials on the ground. Tap the order under your Fluff to change it.</p><p><b>The Pantry:</b> gather on hunts, then make items: fluffberries and big fluffberries heal, a sleepy seed slows the beast, a dizzy bell adds Dizzy, sticky sap sticks it in place for four seconds, a smoke puffball hides you, and a pathfinder acorn lights Enzo’s trail. Pick up to six for your ring. A snack before a hunt adds Fluff, quicker rolls, more Dizzy or a luckier nap reward. New recipes open as more beasts nap.</p><p><b>Tuckered out?</b> You return to camp with every gathered material safe. Camp tops your fluffberries back up to three for the next hunt. Reloading also returns safely to camp, keeping permanent progress.</p><button className="hunt-primary" onClick={closePanel}>Ready for a little adventure</button></>}
      {panel === 'reset' && <><p className="hunt-eyebrow">A FRESH STORYBOOK</p><h1 id="hunt-panel-title">Start a new adventure?</h1><p>This resets your chosen hero, tool upgrades, pouch, Pantry items and sanctuary naps in Grumble Hunt.</p><button className="hunt-primary" data-testid="confirm-reset" onClick={() => { game.current = new HuntGame(); written.current = ''; release(); persist(); panelRef.current = 'choose'; setPanel('choose'); refresh(); }}>Start a new game</button><button onClick={closePanel}>Keep this adventure</button></>}
    </section></div>}
  </main>;
}
