'use client';

import { useEffect, useRef, useState } from 'react';
import { QUESTS, FINISHERS, BEASTS, DT, INTRO_CARD, GATHER_TIME, HuntGame, NO_INPUT, plural, ORDER_NAMES, SAVE_KEY, VILLAGERS, type BeastId, type HeroId, type Input, type MaterialId, type SpotId } from '@/lib/grumble-hunt-game';
import { STORY, storyScene as sceneOf, POST_GAME_WEAPONS, type WeaponType, ITEMS, MATERIALS, SNACKS } from '@/lib/grumble-hunt-content';
import type { HuntScene } from '@/lib/grumble-hunt-scene';
import { HuntSound } from './sound';
import { BoardPanel, BookPanel, BountiesPanel, PantryPanel } from './camp-panels';
import { BeastHud, IntroCard } from './hud';
import { FieldGuide } from './field-guide';
import { ForgePanel, type ForgeTab } from './forge-panel';
import { nextChapterNote, itemText, WeaponIcon, localDay, cap, ChargeMeter, chargeText, MOODS, heroMood, Art, Icon, readSave, seconds } from './ui';
import './hunt.css';

/** Where a story scene leads when it ends. */
type SceneAfter = 'hunt' | 'result' | 'replay' | 'board';
type ActionKey = Exclude<keyof Input, 'x' | 'z'>;
type Panel = 'choose' | 'rack' | 'board' | 'forge' | 'book' | 'pantry' | 'help' | 'reset' | 'story' | 'bounties' | null;

export default function GrumbleHuntPage() {
  const game = useRef<HuntGame | null>(null), scene = useRef<HuntScene | null>(null), sound = useRef<HuntSound | null>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null), dialog = useRef<HTMLElement>(null);
  const keys = useRef(new Set<string>()), touch = useRef({ ...NO_INPUT }), joystick = useRef<{ id: number; x: number; y: number } | null>(null), drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pulses = useRef(new Set<ActionKey>());
  const panelRef = useRef<Panel>(null), pausedBeforePanel = useRef(false), written = useRef('');
  const [ready, setReady] = useState(false), [rendered, setRendered] = useState(false), [panel, setPanel] = useState<Panel>(null), [muted, setMuted] = useState(false), [error, setError] = useState(''), [stick, setStick] = useState({ x: 0, y: 0 });
  const [forgeType, setForgeType] = useState<WeaponType>('hammer'), [forgeTab, setForgeTab] = useState<ForgeTab>('weapons'), [forgeWho, setForgeWho] = useState<HeroId>('dora');
  const [storyScene, setStoryScene] = useState({ id: '0-intro', page: 0, after: 'hunt' as SceneAfter }), [extraGrumpy, setExtraGrumpy] = useState(false);
  const [, setTick] = useState(0), refresh = () => setTick((n) => n + 1), [travels, setTravels] = useState(0);
  panelRef.current = panel;
  const persist = () => { if (!game.current) return; const json = JSON.stringify(game.current.save()); if (json === written.current) return; try { localStorage.setItem(SAVE_KEY, json); written.current = json; } catch { /* Storage may be unavailable; play continues. */ } };
  const release = () => { keys.current.clear(); touch.current = { ...NO_INPUT }; pulses.current.clear(); joystick.current = null; drag.current = null; game.current?.clearInput(); setStick({ x: 0, y: 0 }); };
  const focusWorld = () => canvas.current?.focus({ preventScroll: true });
  const openPanel = (next: Panel) => { release(); const g = game.current;
    // The epilogue plays once, the first time the hunt board opens after a finished story.
    if (next === 'board' && g && g.profile.won && g.chapter >= 6 && !g.story.scenesSeen.includes('epilogue')) { setStoryScene({ id: 'epilogue', page: 0, after: 'board' }); next = 'story'; }
    if (g) { if (next === 'forge') { setForgeTab('weapons'); setForgeWho(g.heroId); setForgeType(g.weapon()); } if (!panelRef.current) pausedBeforePanel.current = g.paused; g.paused = true; } panelRef.current = next; setPanel(next); sound.current?.unlock(); };
  const closePanel = () => { if (!game.current?.profile.hero && panel === 'choose') return; if (game.current) game.current.paused = pausedBeforePanel.current; const next = game.current?.profile.hero ? null : 'choose'; panelRef.current = next; setPanel(next); release(); if (!next) focusWorld(); };
  const beginHunt = (id: BeastId, story = false) => { const g = game.current; if (!g?.startHunt(id, extraGrumpy, story)) return; release(); panelRef.current = null; setPanel(null); persist(); refresh(); focusWorld(); sound.current?.unlock(); };
  const beginQuest = (id: string) => { const g = game.current; if (!g?.startQuest(id)) return; release(); panelRef.current = null; setPanel(null); persist(); refresh(); focusWorld(); sound.current?.unlock(); };
  const showScene = (id: string, after: SceneAfter) => { setStoryScene({ id, page: 0, after }); openPanel('story'); };
  const start = (id: BeastId) => {
    const g = game.current; if (!g) return;
    const current = g.chapter <= 5 && STORY[g.chapter].beast === id;
    if (current && !g.story.scenesSeen.includes(`${g.chapter}-intro`)) { showScene(`${g.chapter}-intro`, 'hunt'); return; }
    beginHunt(id, current);
  };
  const advanceStory = (skip = false) => {
    const g = game.current; if (!g) return;
    const { pages, beast } = sceneOf(storyScene.id);
    if (!skip && storyScene.page + 1 < pages.length) { setStoryScene({ ...storyScene, page: storyScene.page + 1 }); return; }
    g.sceneSeen(storyScene.id); persist();
    if (storyScene.after === 'hunt' && beast) { beginHunt(beast, true); return; }
    if (storyScene.after === 'replay') { openPanel('book'); return; }
    if (storyScene.after === 'board') { openPanel('board'); return; }
    // The ending leads straight into the epilogue.
    if (storyScene.id === '5-outro' && !g.story.scenesSeen.includes('epilogue')) { setStoryScene({ id: 'epilogue', page: 0, after: 'result' }); return; }
    closePanel(); refresh();
  };
  useEffect(() => {
    const g = game.current;
    if (!g || panel || !['calm', 'victory'].includes(g.mode) || g.clearedChapter < 0) return;
    const id = `${g.clearedChapter}-outro`;
    if (!g.story.scenesSeen.includes(id)) showScene(id, 'result');
  });
  const village = () => { game.current?.returnVillage(); release(); panelRef.current = null; setPanel(null); persist(); refresh(); focusWorld(); };
  const pause = () => { const g = game.current; if (!g || g.mode !== 'hunt') return; g.paused = !g.paused; release(); persist(); refresh(); focusWorld(); };
  const mute = () => { const s = sound.current; if (!s) return; s.unlock(); s.setMuted(!s.muted()); setMuted(s.muted()); if (game.current?.mode === 'hunt' && !panelRef.current) focusWorld(); };

  useEffect(() => {
    let stopped = false, raf = 0, last = 0, acc = 0, ui = 0, lastHold = '';
    const g = HuntGame.load(readSave()); game.current = g; g.setBountyDay(localDay()); sound.current = new HuntSound(); setMuted(sound.current.muted());
    if (!g.profile.hero) { panelRef.current = 'choose'; setPanel('choose'); }
    let today = localDay();
    const dayTimer = window.setInterval(() => { const day = localDay(); if (day !== today) { today = day; game.current?.setBountyDay(day); persist(); refresh(); } }, 60000);
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
          const input: Input = { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: z * Math.cos(yaw) - x * Math.sin(yaw), sprint: k.has('ShiftLeft') || k.has('ShiftRight') || t.sprint, bonk: k.has('KeyJ') || t.bonk, charge: k.has('KeyK') || t.charge, roll: k.has('Space') || t.roll, lock: k.has('Tab') || t.lock, previous: k.has('KeyQ') || t.previous, next: k.has('KeyE') || t.next, use: k.has('KeyF') || t.use, grab: k.has('KeyG') || t.grab, sling: k.has('KeyR') || t.sling };
          // A quick tap between animation frames still reaches one fixed step.
          for (const key of pulses.current) input[key] = true;
          while (acc >= DT) { if (!panelRef.current) { const consumes = current.hitstop <= 0 && !current.paused; current.step(DT, input); if (consumes) pulses.current.clear(); } acc -= DT; }
          for (const e of current.events.splice(0)) { sound.current?.cue(e.kind); if (e.kind === 'travel') setTravels((n) => n + 1); if (e.kind === 'interact' && e.spot) openPanel(e.spot); }
          const held = current.hold(), heldKey = `${held.kind}${held.level}`;
          if (heldKey !== lastHold) { if (held.kind === 'charge' && held.level > 0) sound.current?.cue(`charge-${held.level}`); else if (held.kind === 'guard') sound.current?.cue('guard'); lastHold = heldKey; }
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
      stopped = true; clearInterval(dayTimer); cancelAnimationFrame(raf); persist(); keys.current.clear(); touch.current = { ...NO_INPUT };
      window.removeEventListener('blur', pauseForFocus); window.removeEventListener('pagehide', saveOnHide); document.removeEventListener('visibilitychange', visibility);
      surface?.removeEventListener('webglcontextlost', lost); surface?.removeEventListener('webglcontextrestored', restored); scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
  }, []); // Loop and lifecycle deliberately read refs.

  useEffect(() => {
    if ((panel !== 'rack' && panel !== 'forge') || panel === 'forge' && forgeTab !== 'weapons' || !previewCanvas.current) return;
    let stopped = false, raf = 0, last = 0, preview: HuntScene | null = null;
    import('@/lib/grumble-hunt-scene').then(({ createHuntScene }) => {
      if (stopped || !previewCanvas.current) return;
      try { preview = createHuntScene(previewCanvas.current, () => {}, () => {}, panel === 'rack' ? game.current!.heroId : forgeWho); }
      catch { return; }
      const draw = (now: number) => { if (stopped) return; if (now - last >= 30 && game.current) { preview?.draw(game.current, last ? Math.min(0.1, (now - last) / 1000) : 0.03); last = now; } raf = requestAnimationFrame(draw); };
      raf = requestAnimationFrame(draw);
    });
    return () => { stopped = true; cancelAnimationFrame(raf); preview?.dispose(); };
  }, [panel, forgeTab, forgeWho]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      sound.current?.unlock();
      if (panelRef.current === 'story') { if (['Enter', 'KeyJ'].includes(e.code) && !e.repeat) { e.preventDefault(); advanceStory(); } else if (e.code === 'Escape') { e.preventDefault(); advanceStory(true); } return; }
      if (e.code === 'Escape') { e.preventDefault(); if (panelRef.current) closePanel(); else pause(); return; }
      if (e.code === 'KeyM' && !e.repeat) { mute(); return; }
      if (panelRef.current) return;
      if ((e.target as HTMLElement).closest('button,a') && ['Space', 'Enter', 'Tab'].includes(e.code)) return;
      if (e.code === 'KeyP' && !e.repeat) { pause(); return; }
      if (e.code === 'Tab' && e.shiftKey && game.current?.mode !== 'hunt') return;
      if (game.current?.paused || !['hunt', 'village'].includes(game.current?.mode ?? '')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK', 'Space', 'Tab', 'KeyQ', 'KeyE', 'KeyF', 'KeyG', 'KeyR'].includes(e.code)) {
        e.preventDefault(); keys.current.add(e.code);
        const pulse: Record<string, ActionKey> = { KeyJ: 'bonk', KeyK: 'charge', Space: 'roll', Tab: 'lock', KeyQ: 'previous', KeyE: 'next', KeyF: 'use', KeyG: 'grab', KeyR: 'sling' };
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
  const awaitingOutro = !!g && ['calm', 'victory'].includes(g.mode) && g.clearedChapter >= 0 && !g.story.scenesSeen.includes(`${g.clearedChapter}-outro`);
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

    {b && !inVillage && g?.mode !== 'camp' && <BeastHud g={g} b={b} />}
    {b && g.mode === 'hunt' && !panel && g.introAt >= 0 && g.huntTime - g.introAt < INTRO_CARD && <IntroCard g={g} b={b} />}

    {g?.profile.hero && !panel && (active || inVillage) && <>
      <section className="hunt-hero-hud" aria-label="Your Fluff">
        <div><span className="hunt-face" data-testid="hero-mood" data-mood={MOODS[heroMood(g.hero)]}><Art sheet={`portraits-${heroId}`} cell={heroMood(g.hero)} grid={2} size={46} /></span><strong>{cap(heroId)}</strong><span><WeaponIcon type={g.weapon()} tier={g.node().tier} size={22} /><span data-testid="equipped-weapon">{g.node().name} · Tier {g.node().tier}</span></span></div>
        <progress aria-label="Fluff" data-testid="fluff" max={g.hero.maxFluff} value={g.hero.fluff} /><small>Fluff {Math.ceil(g.hero.fluff)} / {g.hero.maxFluff}{active && g.snack ? ` · ${SNACKS[g.snack].name}` : ''}</small>
        <p>{cap(g.buddyId)} is with you{g.buddy.berry <= 0 ? ' · berry ready' : ' · picking a berry'}.</p>
        <button className="hunt-order" data-testid="buddy-order" aria-label={`${cap(g.buddyId)}'s order: ${ORDER_NAMES[g.order]}. Change order`} title="Hold Tab and tap Q or E" onClick={() => { g.commandBuddy(1); refresh(); focusWorld(); }}>{cap(g.buddyId)}: <strong>{ORDER_NAMES[g.order]}</strong> ›</button>
        {active && POST_GAME_WEAPONS.includes(g.weapon()) && <small data-testid="postgame-meter">{g.weapon() === 'feather' ? <>Giggle {Math.floor(g.giggle)}% <progress data-testid="giggle-meter" max={100} value={g.giggle} /></> : g.weapon() === 'puffer' ? `Big Breath ${g.breath > 0 ? `${g.breath.toFixed(1)}s recharge` : 'ready'}` : g.weapon() === 'pogo' ? `High Bounce ${g.bounce > 0 ? 'in the air' : 'ready'} · ${g.ride.used}/2 rides` : `Umbrella ${g.isGuarding ? 'open · half speed' : g.float > 0 ? 'floating' : 'ready'}`}</small>}
        {active && <small data-testid="weapon-meter">{g.weapon() === 'katana' || g.weapon() === 'switchaxe' ? `Focus / Bloom ${Math.floor(g.focus)}%` : g.weapon() === 'claws' ? `Zoomies ${g.zoom.toFixed(1)}s` : g.weapon() === 'chargeblade' ? `Seedpods ${g.pods}` : g.weapon() === 'lightbow' ? `Acorns ${g.loaded} / 6 · roll to reload` : g.weapon() === 'glaive' ? `Glows ${g.glowColors} · ${Math.ceil(g.glow)}s` : g.weapon() === 'horn' ? `Notes ${g.notes % 3} · song ${Math.ceil(g.song)}s` : `Stamina ${Math.ceil(g.stamina)}`}{FINISHERS[g.weapon()] && (() => { const step = g.comboTimer > 0 ? g.combo : 0; return <span className="hunt-combo" data-testid="combo" data-step={step} title={`Three J swings in rhythm: ${FINISHERS[g.weapon()]}`}> · String <span aria-label={`${step} of 3 swings`}>{[0, 1, 2].map((i) => <i key={i} data-on={i < step} data-finisher={i === 2} />)}</span></span>; })()}</small>}
        {active && <small data-testid="charge-status">{chargeText(g)}</small>}
        {active && <small data-testid="vine-status">{g.vine?.phase === 'cling' ? 'Holding on · J tickle · K yank · Space let go' : g.vineCd > 0 ? `Vine coiling · ${Math.ceil(g.vineCd)} s` : 'Vine ready · G'} · {g.pebbles} {g.pebbles === 1 ? 'pebble' : 'pebbles'} · R</small>}
      </section>
      {active && !g.ride.riding && <ChargeMeter g={g} />}
      {active && g.ride.riding && <section className="hunt-ride" data-testid="ride-hud" aria-label="Hop-on">
        <strong>Hop-on!</strong><div className="hunt-ride-pips" data-testid="ride-pips" aria-label={`${g.ride.fullBonks} of 3 full bonks`}>{[0, 1, 2].map((i) => <span key={i} data-full={i < g.ride.fullBonks}>🐾</span>)}</div>
        <progress data-testid="ride-meter" aria-label="Bonk meter" max={5} value={g.ride.meter} />
        {g.ride.phase !== 'quiet' && <strong className="hunt-ride-warning" data-testid="ride-warning">Hold on! (K)</strong>}
        <small>Tap J to bonk · roll to hop off</small>
      </section>}
      {active && (() => { const id = g.ringItem, n = id ? g.profile.pouch[id] : 0, slots = g.ring.length; return <div className="hunt-items" aria-label="Item ring"><button aria-label="Previous item" onClick={() => { g.item = (g.item + slots - 1) % slots; refresh(); focusWorld(); }}>‹</button><button data-testid="use-item" data-empty={n <= 0} onClick={() => { g.useItem(); refresh(); focusWorld(); }} title={id ? itemText(ITEMS[id].effect) : ''}>{id && <Icon id={id} size={38} />}<span><strong>{id ? ITEMS[id].name : 'Empty'} ×{n}</strong><small>F · use · Q / E · {g.item + 1} of {slots}</small></span></button><button aria-label="Next item" onClick={() => { g.item = (g.item + 1) % slots; refresh(); focusWorld(); }}>›</button></div>; })()}
      {active && (() => { const busy = g.gathering ? g.spots.find((s) => s.id === g.gathering!.spot) : null, spot = busy ?? g.nearestGather(); if (!spot) return null; const name = plural(spot.count, MATERIALS[spot.material].name).toLowerCase(); return <button className="hunt-gather" data-testid="gather" onClick={() => { pulses.current.add('use'); focusWorld(); }}><Icon id={spot.material} size={30} /><span>{busy && g.gathering ? <>Gathering {name}… <progress max={GATHER_TIME} value={g.gathering.t} /></> : <>F · Gather {spot.count} {name}</>}</span></button>; })()}
      {active && <button className="hunt-pause" data-testid="pause" onClick={pause}>Ⅱ Pause</button>}
      {travels > 0 && <div key={travels} className="hunt-travel" aria-hidden="true" />}
      {inVillage && g.nearestSpot() && <button className="hunt-interact" onClick={() => openPanel(g.nearestSpot()!.id)}>F · Talk to {VILLAGERS[g.nearestSpot()!.id].name} · {g.nearestSpot()!.name}</button>}
      <div className="hunt-touch" aria-label="Touch controls">
        <div className="hunt-joystick" data-testid="joystick" role="group" aria-label="Movement joystick"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); joystick.current = { id: e.pointerId, x: r.x + r.width / 2, y: r.y + r.height / 2 }; updateStick(e); sound.current?.unlock(); }} onPointerMove={updateStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} /><small>MOVE</small>
        </div>
        <div className="hunt-touch-buttons"><button {...hold('sprint')} aria-label="Hold to sprint">Sprint</button>{active && <button {...hold('lock')} aria-label="Toggle lock on">Lock</button>}<button {...hold('roll')} data-testid="touch-roll">Roll</button>{active && <><button {...hold('grab')} data-testid="touch-grab" aria-label="Throw the grab-on vine">Vine</button><button {...hold('sling')} data-testid="touch-sling" aria-label="Sling a pebble">Sling</button><button {...hold('charge')} data-testid="touch-charge">Hold · big</button><button className="hunt-bonk" {...hold('bonk')} data-testid="touch-bonk">{g?.ride.riding ? 'Bonk' : g?.ranged() ? 'Shoot' : 'Bonk'}</button></>}</div>
      </div>
    </>}

    {g && !panel && <p className="hunt-note" role="status" data-testid="note">{g.note}</p>}
    {!panel && (active || inVillage) && <p className="hunt-shortcuts">WASD move · Shift sprint · J {g?.ranged() ? 'shoot' : 'bonk'} · hold K charge · Space roll · Tab lock · Q/E items · hold Tab + Q/E buddy · F use or gather · G vine · R sling · drag to look</p>}

    {g?.paused && active && !panel && <div className="hunt-shade"><section ref={dialog} onKeyDown={trapFocus} className="hunt-modal hunt-result" role="dialog" aria-modal="true" aria-label="Paused"><p className="hunt-eyebrow">A QUIET MOMENT</p><h1>Rest your paws.</h1><p>Your gathered materials are safe. Take all the time you need.</p><button className="hunt-primary" data-testid="resume" autoFocus onClick={pause}>Back to the meadow</button><button onClick={village}>Return to camp</button></section></div>}
    {g && ['camp', 'calm', 'victory'].includes(g.mode) && !panel && !awaitingOutro && <div className="hunt-shade"><section className="hunt-modal hunt-result" data-testid="result" aria-label="Hunt result">
      <p className="hunt-eyebrow">{g.mode === 'victory' ? 'THE SANCTUARY IS FULL OF FRIENDS' : g.mode === 'camp' ? 'BACK AT CAMP' : 'ONE LESS GRUMBLE IN THE MEADOW'}</p>
      <h1>{g.mode === 'victory' ? 'The End · free hunt is open' : g.mode === 'camp' ? 'A little tuckered out.' : `${BEASTS[g.lastHunt].name} is napping!`}</h1>
      <p>{g.mode === 'victory' ? 'Even mighty Frostmane found a soft place to curl up. Dora and Enzo made new friends, one lovely nap at a time.' : g.mode === 'camp' ? 'Every material you gathered is tucked away safely. Your berries are topped back up and another try is ready whenever you are.' : 'Your new friend is off to the sanctuary. All meadow materials are collected. Visit the Pantry or the Forge for something lovely.'}</p>
      {g.mode !== 'camp' && g.lastTime > 0 && <p className="hunt-time" data-testid="hunt-time">Calmed in {seconds(g.lastTime)}{g.newRecord ? <strong> · New best time!</strong> : g.profile.beastBook[g.lastHunt].best > 0 && !g.variant ? ` · Best ${seconds(g.profile.beastBook[g.lastHunt].best)}` : ''}</p>}
      {g.mode !== 'camp' && g.questResult && (() => { const q = QUESTS.find((x) => x.id === g.questResult!.id)!, r = g.questResult!; return <p className="hunt-quest-result" data-testid="quest-result">{r.success ? <><strong>Quest done: {q.title}!</strong> +{r.stars} {r.stars === 1 ? 'star' : 'stars'} and a bundle from Old Mossback: <span className="hunt-quest-reward">{Object.entries(q.reward).map(([m, n]) => <span key={m} title={MATERIALS[m as MaterialId].name}><Icon id={m as MaterialId} size={26} />×{n}</span>)}</span></> : <>Lovely nap! The quest {q.title} wasn't met this time: {r.why}. Try it again any time.</>}</p>; })()}
      {g.mode !== 'camp' && g.plopNote && <p data-testid="plop-reward-note">{g.plopNote}</p>}
      {g.mode !== 'camp' && g.reward.length > 0 && <div className="hunt-reward" data-testid="reward"><span>You got</span>{[...new Set(g.reward)].map((id) => <span key={id} title={MATERIALS[id].name}><Icon id={id} size={40} />×{g.reward.filter((m) => m === id).length}</span>)}</div>}
      {g.clearedChapter >= 0 && g.clearedChapter < STORY.length - 1 && g.mode !== 'camp' && <p className="hunt-unlock">{nextChapterNote(g.clearedChapter + 1)}</p>}
      <button className="hunt-primary" data-testid="return-village" onClick={village}>Return to Clover Camp</button><button data-testid="retry" onClick={() => g.questResult ? beginQuest(g.questResult.id) : start(g.lastHunt)}>{g.questResult ? 'Try this quest again' : g.mode === 'camp' ? 'Try this hunt again' : 'Replay this hunt'}</button>{g.mode === 'victory' && <button onClick={() => openPanel('reset')}>New game</button>}
    </section></div>}

    {panel && <div className={`hunt-shade ${panel === 'choose' ? 'hunt-title-shade' : ''}`}><section ref={dialog} className={`hunt-modal hunt-panel-${panel}`} role="dialog" aria-modal="true" aria-labelledby="hunt-panel-title" onKeyDown={trapFocus} data-testid={`panel-${panel}`}>
      {dismissable && panel !== 'story' && <button className="hunt-close" aria-label="Close panel" onClick={closePanel}>×</button>}
      {panel === 'choose' && <><p className="hunt-eyebrow">WELCOME TO CLOVER CAMP</p><h1 id="hunt-panel-title">Small paws.<br /><em>Big grumbles.</em></h1><p>A storybook meadow, five huffy beasts, and two very good friends. Gently bonk each grump into a lovely nap.</p><h2>Who will lead the way?</h2><div className="hunt-hero-picks">{(['dora', 'enzo'] as const).map((id) => <button key={id} data-testid={`choose-${id}`} disabled={!ready} onClick={() => { g?.chooseHero(id); if (g) { setForgeType(g.weapon()); setForgeWho(id); } if (g) g.paused = false; panelRef.current = 'rack'; setPanel('rack'); release(); persist(); refresh(); sound.current?.unlock(); }}><span className="hunt-portrait"><Art sheet={`portraits-${id}`} cell={0} grid={2} size={88} /></span><strong>{cap(id)}</strong><small>{id === 'dora' ? 'White chinchilla · Acorn Hammer' : 'Grey chinchilla · Seed Bow'}</small><p>{id === 'dora' ? 'Slow, mighty bonks. Charge a swing to build dizzy.' : 'A nimble archer. Hold a shot for a bigger bonk.'}</p></button>)}</div><p className="hunt-fine">Your other friend comes along to help bonk and toss healing berries. You can switch at camp.</p></>}
      {panel === 'story' && g && (() => {
        const c = sceneOf(storyScene.id), page = c.pages[storyScene.page];
        const villager = ['mossback', 'bramble', 'pip', 'wren'].indexOf(page.speaker);
        return <div className="hunt-story" data-testid="story-scene"><img className="hunt-story-painting" src={`/art/hunt/${page.panel}.webp`} alt={`${c.title}, story painting`} onClick={() => advanceStory()} /><div className="hunt-story-paper" onClick={() => advanceStory()}>{page.speaker !== 'narrator' && <Art sheet={villager >= 0 ? 'portraits-villagers' : `portraits-${page.speaker}`} cell={Math.max(0, villager)} grid={2} size={86} />}<div><small id="hunt-panel-title">{c.title} · {page.speaker === 'mossback' ? 'Old Mossback' : cap(page.speaker)}</small><p data-testid="story-text">{page.text}</p><small>{storyScene.page + 1} / {c.pages.length} · Tap, Enter or J</small></div></div><button data-testid="story-next" onClick={() => advanceStory()}>Next page →</button><button data-testid="story-skip" onClick={() => advanceStory(true)}>Skip</button></div>;
      })()}
      {panel === 'board' && g && <BoardPanel g={g} extraGrumpy={extraGrumpy} setExtraGrumpy={setExtraGrumpy} start={start} beginQuest={beginQuest} />}
      {panel === 'bounties' && g && <BountiesPanel g={g} persist={persist} refresh={refresh} />}
      {(panel === 'forge' || panel === 'rack') && g && <ForgePanel g={g} panel={panel} forgeTab={forgeTab} setForgeTab={setForgeTab} forgeType={forgeType} setForgeType={setForgeType} forgeWho={forgeWho} setForgeWho={setForgeWho} previewCanvas={previewCanvas} closePanel={closePanel} start={start} persist={persist} refresh={refresh} cue={(kind) => sound.current?.cue(kind)} />}
      {panel === 'book' && <BookPanel g={g ?? null} openPanel={openPanel} showScene={showScene} />}
      {panel === 'pantry' && g && <PantryPanel g={g} persist={persist} refresh={refresh} />}
      {panel === 'help' && <FieldGuide closePanel={closePanel} />}
      {panel === 'reset' && <><p className="hunt-eyebrow">A FRESH STORYBOOK</p><h1 id="hunt-panel-title">Start a new adventure?</h1><p>This resets your chosen hero, weapon trees, armour, pouch, Pantry items and sanctuary naps in Grumble Hunt.</p><button className="hunt-primary" data-testid="confirm-reset" onClick={() => { game.current = new HuntGame(); game.current.setBountyDay(localDay()); setExtraGrumpy(false); written.current = ''; release(); persist(); panelRef.current = 'choose'; setPanel('choose'); refresh(); }}>Start a new game</button><button onClick={closePanel}>Keep this adventure</button></>}
    </section></div>}
  </main>;
}
