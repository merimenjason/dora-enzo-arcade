'use client';

import { useEffect, useRef, useState } from 'react';
import { FINISHERS, FINISHER_KIND, ZONE_NAMES, BEAST_IDS, BEAST_MATERIALS, BEASTS, DT, INTRO_CARD, FORGE_MATERIALS, GATHER_TIME, HUNT_AREA, HuntGame, ITEM_IDS, NO_INPUT, plural, ORDER_NAMES, RING_ITEMS, RING_SIZE, SAVE_KEY, SNACK_IDS, V1_SAVE_KEY, V2_SAVE_KEY, V3_SAVE_KEY, V4_SAVE_KEY, VARIANT_COLORS, VILLAGERS, type BeastId, type Hero, type HeroId, type Input, type ItemId, type MaterialId, type SpotId } from '@/lib/grumble-hunt-game';
import { STORY, POST_GAME_WEAPONS, WEAPON_TYPES, WEAPON_TREE, BASIC_WEAPONS, FIRST_PICKS, MH_EQUIVALENT, ARMOUR_SETS, SLOTS, armourCost, type WeaponType, type WeaponNode, type ArmourPieceId, ITEMS, MATERIALS, SNACKS, type Cost, type ItemEffect, type SnackEffect } from '@/lib/grumble-hunt-content';
import type { HuntScene } from '@/lib/grumble-hunt-scene';
import { HuntSound } from './sound';
import './hunt.css';

type ActionKey = Exclude<keyof Input, 'x' | 'z'>;
type Panel = 'choose' | 'rack' | 'board' | 'forge' | 'book' | 'pantry' | 'help' | 'reset' | 'story' | 'bounties' | null;
const AREA_NAMES: Record<string, string> = { meadow: 'Clover Meadow', marsh: 'Soggy Marsh', ridge: 'Windy Ridge', hollow: 'Pebble Hollow', peak: 'Frosty Peak' };
const WEATHER_NAMES: Record<string, string> = { rain: 'Rain shower', mist: 'Mist', dust: 'Dust storm', blizzard: 'Blizzard' };
const itemText = (e: ItemEffect) => e.kind === 'heal' ? `Restores ${e.fluff} Fluff.` : e.kind === 'drowsy' ? `Toss within 10 steps: the beast moves ${Math.round(e.slow * 100)}% slower for ${e.seconds} s.` : e.kind === 'dizzy' ? `Ring it beside the beast: +${e.amount} Dizzy.` : e.kind === 'trap' ? `A trap: the beast is stuck for ${e.seconds} s. One at a time.` : e.kind === 'hide' ? `Hide in smoke for ${e.seconds} s; the beast loses track and wanders.` : e.kind === 'track' ? `Glowing pawprints lead to the beast for ${e.seconds} s.` : 'A snack ingredient.';
const snackText = (e: SnackEffect) => e.maxFluff ? `+${e.maxFluff} max Fluff` : e.staminaRegen ? `Rolls recover ${Math.round(e.staminaRegen * 100)}% faster` : e.dizzyBonus ? `+${Math.round(e.dizzyBonus * 100)}% Dizzy on every hit` : 'One extra rare-material roll at nap time';
/** The befriended-beast count the Pantry needs for something from a story chapter. */
const opensAfter = (chapter: number) => `Opens in chapter ${chapter}`;
/** The result card's note after a story chapter: the next chapter, and any weapon it opens at the rack. */
function nextChapterNote(id: number) {
  const next = STORY[id], opened = (next.unlocks.weapons ?? []).filter((t) => !BASIC_WEAPONS.includes(t)).map((t) => WEAPON_TYPES[t].name);
  return `Chapter ${id}, ${next.title}, is ready at the hunt board${opened.length ? `, and the ${opened.join(' and ')} is ready at the rack` : ''}!`;
}
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Cells of the painted atlases in public/art/hunt: tool tiers in icons-gear, beast materials in icons-materials. */
const WEAPON_ICONS: Record<WeaponType, [number, number, number, number]> = {
  feather: [5, 8, 10, 11], puffer: [5, 12, 14, 15], pogo: [6, 0, 2, 3], umbrella: [6, 4, 6, 7],
  hammer: [1, 0, 2, 9], claws: [1, 3, 5, 11], bow: [1, 6, 8, 10], lance: [2, 0, 2, 12],
  wand: [2, 3, 5, 13], yoyo: [2, 6, 8, 14], greatsword: [3, 0, 2, 15], katana: [3, 3, 5, 15],
  sword: [3, 6, 8, 0], horn: [3, 9, 11, 1], gunlance: [3, 12, 14, 2], switchaxe: [4, 0, 2, 3],
  chargeblade: [4, 3, 5, 4], glaive: [4, 6, 8, 5], lightbow: [4, 9, 11, 6], heavybow: [4, 12, 14, 7],
};
function WeaponIcon({ type, tier = 1, size = 44 }: { type: WeaponType; tier?: number; size?: number }) {
  const [sheet, base, final, glimmer] = WEAPON_ICONS[type];
  const lastSheet = POST_GAME_WEAPONS.includes(type) ? sheet : sheet === 1 ? 2 : type === 'katana' ? 4 : sheet >= 3 && type !== 'greatsword' ? 5 : sheet;
  return <Art sheet={sheet === 1 && tier !== 5 ? 'icons-gear' : `icons-weapons-${tier === 5 ? lastSheet : sheet}`} cell={tier === 5 ? glimmer : tier >= 3 ? final : base + tier - 1} size={size} />;
}
// What a held K does with each tool, in the words the HUD uses.
const RELEASE_NAMES: Partial<Record<WeaponType, string>> = { horn: 'play a song', glaive: 'send the firefly', lightbow: 'swap acorns', chargeblade: 'switch', switchaxe: 'switch', lance: 'counter-thrust', heavybow: 'acorn flurry', feather: 'double-tickle' };
const BIG_NAMES: Partial<Record<WeaponType, string[]>> = { hammer: ['Big bonk', 'Mega bonk'], bow: ['Two-seed shot', 'Three-seed shot'], wand: ['Big bubble'], yoyo: ['Loop-the-Loop'], puffer: ['Big Breath'], pogo: ['High Bounce'] };
function chargeText(g: HuntGame) {
  const h = g.hold(), type = g.weapon(), big = BIG_NAMES[type] ?? ['Big bonk'];
  if (g.hero.cooldown > 0) return 'Tool recovering';
  if (h.kind === 'guard') return `Guarding · stamina ${Math.ceil(g.stamina)}%${type === 'umbrella' ? ' · tap J to spin' : ''}`;
  if (type === 'puffer' && g.breath > 0) return `Big Breath back in ${Math.ceil(g.breath)}s`;
  if (h.kind === 'release') return `Let go of K to ${RELEASE_NAMES[type] ?? 'use it'}`;
  if (h.kind === 'charge') return h.level ? `${big[h.level - 1]} ready${h.level < h.levels ? ' · keep holding' : '!'}` : 'Charging…';
  return g.guardTool() ? 'Hold K to guard' : h.levels ? 'Hold K to charge' : `Hold K to ${RELEASE_NAMES[type] ?? 'use it'}`;
}
/** The charge bar under the hero: its fill reaches each notch as a level is ready. */
function ChargeMeter({ g }: { g: HuntGame }) {
  const h = g.hold(); if (h.kind !== 'charge' && h.kind !== 'guard') return null;
  const full = h.levels === 2 ? 1 : 0.35, fill = h.kind === 'guard' ? g.stamina / 100 : Math.min(1, h.amount / full);
  return <div className="hunt-charge" data-testid="charge-meter" data-kind={h.kind} data-level={h.level} data-full={h.kind === 'charge' && h.level === h.levels}>
    <span className="hunt-charge-bar"><span style={{ width: `${fill * 100}%` }} />{h.levels === 2 && <i style={{ left: '35%' }} />}</span>
    <strong>{chargeText(g)}</strong>
  </div>;
}
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
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(V4_SAVE_KEY) || localStorage.getItem(V3_SAVE_KEY) || localStorage.getItem(V2_SAVE_KEY) || localStorage.getItem(V1_SAVE_KEY) || 'null'); } catch { return null; } }

/** A time in tenths of a second, as minutes and seconds. */
const seconds = (tenths: number) => tenths >= 600 ? `${Math.floor(tenths / 600)} min ${(tenths % 600 / 10).toFixed(1)} s` : `${(tenths / 10).toFixed(1)} s`;

export default function GrumbleHuntPage() {
  const game = useRef<HuntGame | null>(null), scene = useRef<HuntScene | null>(null), sound = useRef<HuntSound | null>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null), dialog = useRef<HTMLElement>(null);
  const keys = useRef(new Set<string>()), touch = useRef({ ...NO_INPUT }), joystick = useRef<{ id: number; x: number; y: number } | null>(null), drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pulses = useRef(new Set<ActionKey>());
  const panelRef = useRef<Panel>(null), pausedBeforePanel = useRef(false), written = useRef('');
  const [ready, setReady] = useState(false), [rendered, setRendered] = useState(false), [panel, setPanel] = useState<Panel>(null), [muted, setMuted] = useState(false), [error, setError] = useState(''), [stick, setStick] = useState({ x: 0, y: 0 });
  const [forgeType, setForgeType] = useState<WeaponType>('hammer'), [forgeTab, setForgeTab] = useState<'weapons' | 'armour'>('weapons'), [forgeWho, setForgeWho] = useState<HeroId>('dora'), [forging, setForging] = useState(false);
  const [storyScene, setStoryScene] = useState({ id: '0-intro', page: 0, after: 'hunt' as 'hunt' | 'result' | 'replay' }), [extraGrumpy, setExtraGrumpy] = useState(false);
  const [, setTick] = useState(0), refresh = () => setTick((n) => n + 1), [travels, setTravels] = useState(0);
  panelRef.current = panel;
  const persist = () => { if (!game.current) return; const json = JSON.stringify(game.current.save()); if (json === written.current) return; try { localStorage.setItem(SAVE_KEY, json); written.current = json; } catch { /* Storage may be unavailable; play continues. */ } };
  const release = () => { keys.current.clear(); touch.current = { ...NO_INPUT }; pulses.current.clear(); joystick.current = null; drag.current = null; game.current?.clearInput(); setStick({ x: 0, y: 0 }); };
  const focusWorld = () => canvas.current?.focus({ preventScroll: true });
  const openPanel = (next: Panel) => { release(); const g = game.current; if (g) { if (next === 'forge') { setForgeTab('weapons'); setForgeWho(g.heroId); setForgeType(g.weapon()); } if (!panelRef.current) pausedBeforePanel.current = g.paused; g.paused = true; } panelRef.current = next; setPanel(next); sound.current?.unlock(); };
  const closePanel = () => { if (!game.current?.profile.hero && panel === 'choose') return; if (game.current) game.current.paused = pausedBeforePanel.current; const next = game.current?.profile.hero ? null : 'choose'; panelRef.current = next; setPanel(next); release(); if (!next) focusWorld(); };
  const beginHunt = (id: BeastId, story = false) => { const g = game.current; if (!g?.startHunt(id, extraGrumpy, story)) return; release(); panelRef.current = null; setPanel(null); persist(); refresh(); focusWorld(); sound.current?.unlock(); };
  const showScene = (id: string, after: 'hunt' | 'result' | 'replay') => { setStoryScene({ id, page: 0, after }); openPanel('story'); };
  const start = (id: BeastId) => {
    const g = game.current; if (!g) return;
    const current = g.chapter <= 5 && STORY[g.chapter].beast === id;
    if (current && !g.story.scenesSeen.includes(`${g.chapter}-intro`)) { showScene(`${g.chapter}-intro`, 'hunt'); return; }
    beginHunt(id, current);
  };
  const advanceStory = (skip = false) => {
    const g = game.current; if (!g) return;
    const [chapter, kind] = storyScene.id.split('-'), c = STORY[Number(chapter)], pages = kind === 'intro' ? c.intro : c.outro;
    if (!skip && storyScene.page + 1 < pages.length) { setStoryScene({ ...storyScene, page: storyScene.page + 1 }); return; }
    g.sceneSeen(storyScene.id); persist();
    if (storyScene.after === 'hunt') { beginHunt(c.beast, true); return; }
    if (storyScene.after === 'replay') { openPanel('book'); return; }
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

    {b && !inVillage && g?.mode !== 'camp' && <section className="hunt-beast-hud" aria-label={`${BEASTS[b.id].name} Grump`}>
      <div><strong>{BEASTS[b.id].name}</strong><span>{b.away ? `Gone to Zone ${b.zone + 1} · follow the path` : b.state === 'wander' ? 'Wandering off to the next zone' : b.state === 'nap' ? 'A sanctuary nap awaits' : b.state === 'roar' ? 'Roaring! Roll or guard' : b.state === 'turf' ? 'Squaring off · step out of the circle' : b.state === 'grabbed' ? 'Held by your vine' : b.state === 'yanked' ? 'Stumbling!' : b.state === 'trudge' ? 'Tired · trudging home to its nest' : b.state === 'snooze' ? 'Snoozing · a wake-up bonk is worth double' : b.state === 'dizzy' ? 'Dizzy! Big bonks welcome' : b.state === 'stuck' ? 'Stuck in sticky sap · bonk away' : g.hero.hidden > 0 ? 'Lost track of you' : b.state === 'rest' ? 'Resting · your opening' : b.grumpy ? 'Extra Grumpy · nearly nap time' : b.drowsy > 0 ? 'Drowsy · 30% slower' : b.id === 'frostmane' ? `Mood ${b.phase} of 3` : 'Gently calm this grumpy friend'}</span></div>
      <progress aria-label="Grump" data-testid="grump" max={b.maxGrump} value={b.grump} /><small>Grump {Math.ceil(b.grump)} / {b.maxGrump}{g.locked ? ' · Locked on' : ''}{g.stormy ? ` · ${WEATHER_NAMES[g.weather.kind]}` : ''}{b.soft > 0 ? ' · Softened' : ''}</small>
      {g.zones > 1 && <ol className="hunt-zones" data-testid="zones" aria-label={`Zone ${g.zone + 1} of ${g.zones}: ${g.zoneName}`}>{ZONE_NAMES[g.area].map((name, i) => <li key={name} className={`${i === g.zone ? 'here' : ''} ${i === b.zone ? 'beast' : ''}`} title={name}><span>{i + 1}</span>{i === g.zone && <em>{name}</em>}</li>)}</ol>}
    </section>}
    {b && g.mode === 'hunt' && !panel && g.introAt >= 0 && g.huntTime - g.introAt < INTRO_CARD && <div className="hunt-intro-card" data-testid="intro-card" role="status" style={{ '--beast-color': g.variant ? VARIANT_COLORS[b.id] : BEASTS[b.id].color, opacity: Math.min(1, (INTRO_CARD - (g.huntTime - g.introAt)) / 0.5) } as React.CSSProperties}>
      <img src={`/art/hunt/ref-${b.id}.webp`} alt="" /><div><small>{g.variant ? 'An Extra Grumpy friend appears' : 'A grumpy friend appears'}</small><strong>{BEASTS[b.id].name}</strong><em>{BEASTS[b.id].title}</em></div>
    </div>}

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
      {g.mode !== 'camp' && g.plopNote && <p data-testid="plop-reward-note">{g.plopNote}</p>}
      {g.mode !== 'camp' && g.reward.length > 0 && <div className="hunt-reward" data-testid="reward"><span>You got</span>{[...new Set(g.reward)].map((id) => <span key={id} title={MATERIALS[id].name}><Icon id={id} size={40} />×{g.reward.filter((m) => m === id).length}</span>)}</div>}
      {g.clearedChapter >= 0 && g.clearedChapter < STORY.length - 1 && g.mode !== 'camp' && <p className="hunt-unlock">{nextChapterNote(g.clearedChapter + 1)}</p>}
      <button className="hunt-primary" data-testid="return-village" onClick={village}>Return to Clover Camp</button><button data-testid="retry" onClick={() => start(g.lastHunt)}>{g.mode === 'camp' ? 'Try this hunt again' : 'Replay this hunt'}</button>{g.mode === 'victory' && <button onClick={() => openPanel('reset')}>New game</button>}
    </section></div>}

    {panel && <div className={`hunt-shade ${panel === 'choose' ? 'hunt-title-shade' : ''}`}><section ref={dialog} className={`hunt-modal hunt-panel-${panel}`} role="dialog" aria-modal="true" aria-labelledby="hunt-panel-title" onKeyDown={trapFocus} data-testid={`panel-${panel}`}>
      {dismissable && panel !== 'story' && <button className="hunt-close" aria-label="Close panel" onClick={closePanel}>×</button>}
      {panel === 'choose' && <><p className="hunt-eyebrow">WELCOME TO CLOVER CAMP</p><h1 id="hunt-panel-title">Small paws.<br /><em>Big grumbles.</em></h1><p>A storybook meadow, five huffy beasts, and two very good friends. Gently bonk each grump into a lovely nap.</p><h2>Who will lead the way?</h2><div className="hunt-hero-picks">{(['dora', 'enzo'] as const).map((id) => <button key={id} data-testid={`choose-${id}`} disabled={!ready} onClick={() => { g?.chooseHero(id); if (g) { setForgeType(g.weapon()); setForgeWho(id); } if (g) g.paused = false; panelRef.current = 'rack'; setPanel('rack'); release(); persist(); refresh(); sound.current?.unlock(); }}><span className="hunt-portrait"><Art sheet={`portraits-${id}`} cell={0} grid={2} size={88} /></span><strong>{cap(id)}</strong><small>{id === 'dora' ? 'White chinchilla · Acorn Hammer' : 'Grey chinchilla · Seed Bow'}</small><p>{id === 'dora' ? 'Slow, mighty bonks. Charge a swing to build dizzy.' : 'A nimble archer. Hold a shot for a bigger bonk.'}</p></button>)}</div><p className="hunt-fine">Your other friend comes along to help bonk and toss healing berries. You can switch at camp.</p></>}
      {panel === 'story' && g && (() => {
        const [chapter, kind] = storyScene.id.split('-'), c = STORY[Number(chapter)], pages = kind === 'intro' ? c.intro : c.outro, page = pages[storyScene.page];
        const villager = ['mossback', 'bramble', 'pip', 'wren'].indexOf(page.speaker);
        return <div className="hunt-story" data-testid="story-scene"><img className="hunt-story-painting" src={`/art/hunt/${page.panel}.webp`} alt={`${c.title}, story painting`} onClick={() => advanceStory()} /><div className="hunt-story-paper" onClick={() => advanceStory()}>{page.speaker !== 'narrator' && <Art sheet={villager >= 0 ? 'portraits-villagers' : `portraits-${page.speaker}`} cell={Math.max(0, villager)} grid={2} size={86} />}<div><small id="hunt-panel-title">{c.title} · {page.speaker === 'mossback' ? 'Old Mossback' : cap(page.speaker)}</small><p data-testid="story-text">{page.text}</p><small>{storyScene.page + 1} / {pages.length} · Tap, Enter or J</small></div></div><button data-testid="story-next" onClick={() => advanceStory()}>Next page →</button><button data-testid="story-skip" onClick={() => advanceStory(true)}>Skip</button></div>;
      })()}
      {panel === 'board' && g && <><p className="hunt-eyebrow">OLD MOSSBACK · THE GRUMBLE WIND</p><h1 id="hunt-panel-title">A story of warm winds.</h1><div className="hunt-story-chapters">{STORY.map((c) => <button key={c.id} data-testid={`chapter-${c.id}`} disabled={g.chapter !== c.id} onClick={() => start(c.beast)}><strong>{c.id} · {c.title}</strong><small>{g.chapter > c.id ? '✓ A lovely nap' : g.chapter === c.id ? AREA_NAMES[c.area] ?? 'Village paddock' : opensAfter(c.id)}</small></button>)}</div>
      {g.profile.extraGrumpyUnlocked && <label><input data-testid="extra-grumpy-toggle" type="checkbox" checked={extraGrumpy} onChange={(e) => setExtraGrumpy(e.target.checked)} /> Extra Grumpy · +60% Grump · twice the rare chance</label>}
      <h2>Free hunts · friends you have met</h2><div className="hunt-board">{BEAST_IDS.map((id) => <article key={id} style={{ '--beast-color': extraGrumpy ? VARIANT_COLORS[id] : BEASTS[id].color } as React.CSSProperties}><img src={`/art/hunt/ref-${id}.webp`} alt={BEASTS[id].name} /><div><h2>{BEASTS[id].name}{extraGrumpy && <span className="hunt-swatch" style={{ background: VARIANT_COLORS[id] }} />}</h2><p>{BEASTS[id].tip}</p><button className="hunt-primary" data-testid={`hunt-${id}`} disabled={!g.profile.beastBook[id].met} onClick={() => start(id)}>{g.profile.beastBook[id].met ? 'Visit' : `Opens in chapter ${BEAST_IDS.indexOf(id) + 1}`}</button></div></article>)}</div></>}
      {panel === 'bounties' && g && <><p className="hunt-eyebrow">WREN · {g.profile.bounties.day}</p><h1 id="hunt-panel-title">Little favours for friends.</h1>{!g.profile.extraGrumpyUnlocked ? <p>Opens after chapter 5.</p> : <div className="hunt-pantry">{g.dailyBounties.map((task) => { const done = g.profile.bounties.done.includes(task.id), ready = g.profile.bounties.ready.includes(task.id); return <article key={task.id} data-testid="bounty-card"><Icon id="berry" size={44} /><div><h2>{task.title}</h2><p>{done ? 'Claimed' : ready ? '1 / 1 · Ready!' : '0 / 1 · Complete on a hunt'}</p><p>Bundle: 3 berries, 2 bristle tufts, 2 wart pebbles</p><button disabled={!ready || done} onClick={() => { g.claimBounty(task.id); persist(); refresh(); }}>Claim</button></div></article>; })}</div>}</>}
      {(panel === 'forge' || panel === 'rack') && g && <><p className="hunt-eyebrow">CLOVER CAMP · {panel === 'rack' ? 'WEAPON RACK' : 'THE FORGE'}</p><h1 id="hunt-panel-title">{panel === 'rack' ? 'Pick a playful tool.' : 'Made with little treasures.'}</h1><p>Every basic tool is free to swap. Your buddy keeps the tool you give them.</p>
        {panel === 'forge' && <div className="hunt-pantry-actions hunt-forge-tabs"><button data-testid="forge-weapons" aria-pressed={forgeTab === 'weapons'} onClick={() => setForgeTab('weapons')}>Weapons</button><button data-testid="forge-armour" aria-pressed={forgeTab === 'armour'} onClick={() => setForgeTab('armour')}>Armour</button><label>Equip for <select data-testid="forge-who" value={forgeWho} onChange={(e) => { const who = e.target.value as HeroId; setForgeWho(who); setForgeType(g.profile.equipped[who]); }}><option value="dora">Dora</option><option value="enzo">Enzo</option></select></label></div>}
        {(panel === 'rack' || forgeTab === 'weapons') && <><div className="hunt-rack" data-testid="weapon-rack">{([...BASIC_WEAPONS, 'wand', 'yoyo', ...POST_GAME_WEAPONS] as WeaponType[]).map((type) => { const w = WEAPON_TYPES[type], open = g.weaponOpen(type), goal = g.weaponGoal(type); return <button key={type} data-testid={`rack-${type}`} aria-pressed={forgeType === type} data-locked={!open} disabled={!open} onClick={() => { setForgeType(type); g.equip(type, panel === 'rack' ? g.heroId : forgeWho); persist(); refresh(); }}><WeaponIcon type={type} /><strong>{w.name}</strong><small>{open ? MH_EQUIVALENT[type] ? `Plays like ${MH_EQUIVALENT[type]}` : 'Grumble Hunt original' : goal ? `${g.chapter < 6 ? 'After chapter 5 · ' : ''}${goal.goal} · ${Math.min(goal.count, goal.total)}/${goal.total}` : opensAfter(w.chapter)}</small>{FIRST_PICKS.includes(type) && <span className="hunt-badge">Good first pick</span>}</button>; })}</div><div className="hunt-rack-preview"><canvas key={`${panel}-${forgeTab}-${forgeWho}`} ref={previewCanvas} data-testid="weapon-preview" data-weapon={g.weapon(panel === 'rack' ? g.heroId : forgeWho)} aria-label={`${cap(panel === 'rack' ? g.heroId : forgeWho)} holding their equipped weapon`} /></div><p data-testid="weapon-signature">{WEAPON_TYPES[forgeType].signature}</p>{FINISHERS[forgeType] && <p className="hunt-fine" data-testid="weapon-finisher">Three J swings in rhythm end in the {FINISHERS[forgeType]}: half again as strong, and {FINISHER_KIND[WEAPON_TYPES[forgeType].speed]}.</p>}
        {panel === 'rack' ? <button className="hunt-primary" data-testid="rack-ready" onClick={() => { closePanel(); if (g.chapter === 0) start('bristleback'); }}>Ready for the meadow</button> : <div className="hunt-tree" data-testid="forge-tree">{WEAPON_TREE.filter((n) => n.type === forgeType).map((n: WeaponNode) => <article key={n.id} data-tier={n.tier} data-branch={n.branch ?? 'base'} data-owned={g.node(n.type).id === n.id}><WeaponIcon type={n.type} tier={n.tier} /><h3>{n.name}</h3><small>Tier {n.tier}{n.branch ? ` · Branch ${n.branch}` : ''}</small><Costs cost={n.cost} have={g.profile.pouch} />{n.perks.map((p) => <p key={p.id}>{p.text}</p>)}<button data-testid={`forge-${n.id}`} disabled={forging || !g.canForge(n.id)} onClick={() => { if (g.forge(n.id)) { setForging(true); setTimeout(() => setForging(false), 1000); } persist(); refresh(); sound.current?.cue('part'); }}>{g.node(n.type).id === n.id ? '✓ Crafted' : n.tier === 1 ? 'Free at the rack' : 'Craft'}</button></article>)}</div>}</>}
        {forging && <p className="hunt-forge-cheer" data-testid="forge-cheer">⚒ Bramble cheers! Bonk, bonk… lovely!</p>}
        {panel === 'forge' && forgeTab === 'armour' && <><p data-testid="armour-skills">+{g.armour.fluff} Fluff · {g.armour.skills.map((s) => s.name).join(' · ') || 'Wear two matching pieces for a skill.'}</p><div className="hunt-pantry">{BEAST_IDS.flatMap((beast) => SLOTS.map((slot, i) => { const piece = `${beast}-${slot}` as ArmourPieceId, set = ARMOUR_SETS[beast], owned = g.profile.armour.owned.includes(piece), worn = g.profile.armour.worn[slot] === piece; return <article key={piece}><Art sheet="icons-gear" cell={(beast === 'puffwart' ? 12 : 9) + i} size={44} /><div><h3>{set.name} {slot}</h3><p>+{set.fluff} Fluff · 2: {set.two.name} · 3: {set.three.name}</p>{g.armourOpen(beast) || owned ? <Costs cost={armourCost(piece)} have={g.profile.pouch} /> : <p className="hunt-fine">{opensAfter(Math.max(2, BEAST_IDS.indexOf(beast) + 1))}.</p>}<button data-testid={`armour-${piece}`} disabled={!owned && !g.canMakeArmour(piece)} onClick={() => { if (!owned) g.makeArmour(piece); g.wear(piece); persist(); refresh(); }}>{worn ? 'Take off' : owned ? 'Wear' : 'Craft and wear'}</button></div></article>; }))}</div></>}
      </>}
      {panel === 'book' && <><p className="hunt-eyebrow">CLOVER CAMP · BEAST BOOK</p><h1 id="hunt-panel-title">Every grump has a soft side.</h1><button data-testid="open-bounties" onClick={() => openPanel('bounties')}>🐦 Wren’s bounty board</button><h2>Story</h2><div className="hunt-story-chapters">{g?.story.scenesSeen.map((id) => <button key={id} onClick={() => showScene(id, 'replay')}>{STORY[Number(id.split('-')[0])].title} · {id.endsWith('intro') ? 'Before the hunt' : 'A lovely nap'}</button>)}</div><p data-testid="nap-count">{g?.uniqueNaps ?? 0} / 5 friends napping at the sanctuary.</p><div className="hunt-book">{BEAST_IDS.map((id) => <article key={id}><img src={`/art/hunt/ref-${id}.webp`} alt={`${BEASTS[id].name}, a gentle storybook beast`} /><h2>{BEASTS[id].name}</h2><em className="hunt-book-title">{BEASTS[id].title}</em><strong className="hunt-badge">{g?.profile.naps[id] ? 'Napping at the sanctuary' : 'Not calmed yet'}</strong><p>{BEASTS[id].tip}</p><p>Lives in {AREA_NAMES[HUNT_AREA[id]]}. Pop-off part: {BEASTS[id].part}.{g && g.profile.beastBook[id].best > 0 && <> Best time: <strong data-testid={`best-${id}`}>{seconds(g.profile.beastBook[id].best)}</strong>.</>}</p><ul className="hunt-satchel" aria-label={`${BEASTS[id].name} materials`}>{BEAST_MATERIALS[id].map((m) => <li key={m} title={MATERIALS[m].name}><Icon id={m} size={26} /><span>{MATERIALS[m].name}</span><strong>{g?.profile.pouch[m] ?? 0}</strong></li>)}</ul></article>)}</div></>}
      {panel === 'pantry' && g && <><p className="hunt-eyebrow">CLOVER CAMP · THE PANTRY</p><h1 id="hunt-panel-title">Snacks and handy things.</h1><p>Gather berries, marsh reeds and glimmer stones on hunts (press F at a bush, reeds or a sparkle), then make items for your ring and one snack for the next hunt. Camp tops your pouch up to 3 fluffberries before every hunt.</p>
        <p className="hunt-wallet">In your pouch</p><ul className="hunt-satchel" aria-label="Gathered materials">{(['berry', 'marsh-reed', 'glimmer-stone'] as const).map((id) => <li key={id}><Icon id={id} size={34} /><span>{MATERIALS[id].name}</span><strong data-testid={`pouch-${id}`}>{g.profile.pouch[id]}</strong></li>)}</ul>
        <h2>Items <small data-testid="ring-count">{g.ring.length} / {RING_SIZE} in your ring</small></h2>
        <div className="hunt-pantry">{ITEM_IDS.map((id) => { const it = ITEMS[id], open = g.feature('pantry') && g.chapter >= it.chapter, ring = g.ring.includes(id), have = g.profile.pouch[id]; return <article key={id} data-open={open} data-testid={`item-${id}`}><Icon id={id} size={56} /><div><h3>{it.name} <small>×{have} / {it.max}</small></h3><p>{itemText(it.effect)}</p>{open ? <Costs cost={it.recipe} have={g.profile.pouch} /> : <p className="hunt-fine">{opensAfter(Math.max(2, it.chapter))}.</p>}<div className="hunt-pantry-actions"><button data-testid={`craft-${id}`} disabled={!g.canCraft(id)} onClick={() => { g.craft(id); persist(); refresh(); }}>{have >= it.max ? 'Pouch full' : 'Make one'}</button>{RING_ITEMS.includes(id) && <button data-testid={`ring-${id}`} aria-pressed={ring} disabled={ring ? g.ring.length <= 1 : g.ring.length >= RING_SIZE} onClick={() => { g.toggleRing(id); persist(); refresh(); }}>{ring ? '✓ In ring' : 'Add to ring'}</button>}</div></div></article>; })}</div>
        <h2>Snacks <small>{g.profile.snack ? `${SNACKS[g.profile.snack].name} is packed` : 'One per hunt'}</small></h2>
        <div className="hunt-pantry">{SNACK_IDS.map((id) => { const sn = SNACKS[id], open = g.feature('snacks') && g.chapter >= sn.chapter, packed = g.profile.snack === id; return <article key={id} data-open={open} data-testid={`snack-${id}`}><Art sheet="icons-items" cell={9} size={56} /><div><h3>{sn.name}</h3><p>{snackText(sn.effect)}, for the next hunt.</p>{open ? <Costs cost={sn.cost} have={g.profile.pouch} /> : <p className="hunt-fine">{opensAfter(sn.chapter)}.</p>}<div className="hunt-pantry-actions"><button data-testid={`eat-${id}`} disabled={!g.canEat(id)} onClick={() => { g.eatSnack(id); persist(); refresh(); }}>{packed ? '✓ Packed' : 'Pack it'}</button></div></div></article>; })}</div></>}
      {panel === 'help' && <><p className="hunt-eyebrow">THE FIELD GUIDE</p><h1 id="hunt-panel-title">A gentle kind of hunt.</h1><p>Beasts are never hurt. Bonks lower Grump until they curl up for a nap and go to the sanctuary. An orange lane or circle always warns you before an attack.</p><p>When a beast first spots you, and again when it turns Extra Grumpy, it rears up and roars. Friends inside the big orange circle cover their ears for a moment; step out, roll or guard to keep going.</p><p>Weather comes and goes on a hunt: rain in the meadow and marsh, mist on the ridge, dust in the hollow and a blizzard on the Peak. It makes it harder to see far, so Enzo sniffs out the trail sooner.</p><p>Now and then another beast wanders through. If it meets the beast you are hunting, the two square off inside an orange circle and give each other a turf bonk: a big chunk of Grump off your beast, and a dizzy opening for you.</p><p>Press G (or Vine) within 9 steps to throw the grab-on vine and hold on to the beast's head. Tap J twice to tickle it soft, so bonks take 20% more Grump and pop parts sooner for 12 seconds. Press K to yank it the way you point: into a tree, rock or the edge, it is a wall bonk and a dizzy opening. The vine takes 20 seconds to coil back up.</p><p>Every wild area is three zones joined by paths through the trees. Below 70% of its Grump the beast wanders off down the path at the far edge to the next zone, and below 35% on to its den in the third zone. It doesn't attack on the way, so bonk it as it goes. Then follow the glowing path, or Enzo's pawprints, to catch up. The zone map under the beast's name shows where you are and where it went.</p><p>Press R (or Sling) to flick a pebble at the beast you are locked on to, or straight ahead. Pebbles take a little Grump and add to dizzy, three bring a flying Skreel down to rest on the ground, and a pebble at a tree knocks out a berry (three a hunt). You start with 5; gathering adds 3 and every dizzy shakes 1 loose, up to 12.</p><p>Melee tools chain J swings into a string. Start each swing within 0.6 seconds of the last one recovering, and the third is the tool's finisher: half again as strong, with a slower recovery. Slow tools add 20 Dizzy, medium tools loosen parts twice as fast and fast tools bonk twice. A roll, a bump or a pause starts the string again; the bows, the Bubble Wand and the Dandelion Puffer don't chain. The three pips under your Fluff show the string.</p><p>Every bonk shows how much Grump it took. Orange numbers mark a weak spot: a beast's face, or Hornclack's sides between its shell plates. Weak-spot bonks take 15% more.</p><p>Every zone of a wild area hides one hazard: an acorn bough in the meadow, a bubble spring in the marsh, a rock pile on the ridge, sticky vines in the hollow and icicles on the peak. Hit it with a pebble, or press F beside it, and an orange circle warns for 0.8 seconds before it drops. A beast inside loses 8% of its Grump and is dizzy for 3 seconds; friends inside get a bump. Each one works once, so lead the beast in first.</p><p>Three fluff finches hop about every zone of a wild area. Walk up to one and it flutters off, leaving you 5 more Fluff and 5 more most Fluff for the rest of the hunt.</p><p>A very tired beast trudges home to its nest for a snooze. Follow it: the first bonk on a snoozing beast is a wake-up bonk worth double.</p><dl className="hunt-controls"><dt>WASD / arrows</dt><dd>Move · Shift sprints</dd><dt>J</dt><dd>Bonk or shoot with your equipped weapon; hold J for 0.35 seconds with the Staff to vault</dd><dt>Hold K, release</dt><dd>Hold for a big move; tap K (under 0.2 seconds) for a special action. Guard tools hold K to guard: releasing only ends the guard. Hold J + K, then release K for Big Finish, Big Poof or a Lance Counter Boop.</dd><dt>Space</dt><dd>Roll, with a brief dodge window</dd><dt>Tab</dt><dd>Lock on while the meadow has focus</dd><dt>Hold Tab, tap Q / E</dt><dd>Tell your buddy to stay close, go bonk or gather</dd><dt>Q / E · F</dt><dd>Pick an item in your ring · use it</dd><dt>F at a bush, reeds or sparkle</dt><dd>Gather: stand still for 1.2 seconds</dd><dt>Drag · scroll</dt><dd>Orbit the camera · zoom</dd><dt>P / Escape · M</dt><dd>Pause · toggle sound</dd></dl><p><b>Touch:</b> move with the joystick, drag the meadow to look, tap Bonk or Shoot, hold “Hold · big” to charge, hold Bonk together with “Hold · big” for guard-tool signatures, and use Roll, Lock, the item ring and the Gather button.</p><p><b>Dizzy:</b> two big bonks or big shots; buddy bonks help a little. A crash into a tree or rock also makes an opening. Dizzy beasts take bigger bonks. Your buddy helps and tosses a healing berry when Fluff is low.</p><p><b>Extra Grumpy:</b> below 30% Grump a beast puffs steam from its ears and its eyebrows go red. It moves 15% faster and its orange warning comes 0.1 s sooner. Keep going: it is nearly nap time.</p><p><b>Enzo’s sniff:</b> when the beast is far off or behind a tree or rock, Enzo sniffs out a trail of glowing pawprints that leads to it.</p><p><b>Buddy orders:</b> <i>Go bonk</i> helps once you are near the beast, <i>Stay close</i> keeps your buddy by your side and helps from there, and <i>Gather</i> picks up the materials on the ground. Tap the order under your Fluff to change it.</p><p><b>Story:</b> Visit Old Mossback at the hunt board for chapters 0–5. Tap, Enter or J turns a story page; Skip skips that scene. Wren keeps seen scenes in the Beast Book. The ending opens Extra Grumpy colours and three daily bounties.</p><p><b>The Pantry:</b> gather on hunts, then make items: fluffberries and big fluffberries heal, a sleepy seed slows the beast, a dizzy bell adds Dizzy, sticky sap sticks it in place for four seconds, a smoke puffball hides you, and a pathfinder acorn lights Enzo’s trail. Pick up to six for your ring. A snack before a hunt adds Fluff, quicker rolls, more Dizzy or a luckier nap reward. New recipes open by story chapter.</p><p><b>Tuckered out?</b> You return to camp with every gathered material safe. Camp tops your fluffberries back up to three for the next hunt. Reloading also returns safely to camp, keeping permanent progress.</p><p>Hop-on: Loop-the-Loop onto a dizzy or sap-stuck beast with the Yo-yo, or roll / Staff vault away from a rock edge towards it. Tap J (Bonk) five times per full bonk; three make a plop. Hold K (Hold · big) through “Hold on!” and the buck. Roll hops off. Two rides per hunt.</p><button className="hunt-primary" onClick={closePanel}>Ready for a little adventure</button></>}
      {panel === 'reset' && <><p className="hunt-eyebrow">A FRESH STORYBOOK</p><h1 id="hunt-panel-title">Start a new adventure?</h1><p>This resets your chosen hero, weapon trees, armour, pouch, Pantry items and sanctuary naps in Grumble Hunt.</p><button className="hunt-primary" data-testid="confirm-reset" onClick={() => { game.current = new HuntGame(); game.current.setBountyDay(localDay()); setExtraGrumpy(false); written.current = ''; release(); persist(); panelRef.current = 'choose'; setPanel('choose'); refresh(); }}>Start a new game</button><button onClick={closePanel}>Keep this adventure</button></>}
    </section></div>}
  </main>;
}
