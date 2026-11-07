'use client';
// The Sunken Bellspire: the page. The title painting, the game canvas (480×270, scaled up by whole numbers where it
// fits) with a slim HTML HUD over its top edge, dialogue with portraits, item and boss banners, and the pause menu
// (Map, Gear, Items, Trials, Guide, Settings). Wayra's shop and the murals open as panels. Keyboard (remappable), a gamepad,
// and on touch screens an on-screen pad. Rules in lib/bellspire-game.ts, drawing in lib/bellspire-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellspireGame, parseSave, heroStats, xpToNext, SAVE_KEY, NGP_SAVE_KEY, TRIALS, RUSH, MEDALS, medalFor, ngpReady, newGamePlusSave, NO_INPUT, ROOMS, AREAS, GEAR, SHOP, FOOD, SPELLS, ABILITIES, ABILITY_ORDER,
  BOSSES, MURALS, NAMES, INFO, COMPLETION, roomAt, rawChar, roomById, MAP_EXITS, VIEW_W, VIEW_H, SHRINE_NAMES, isBelfryRoom,
  RECAST_PERKS, RECAST_PRICE, isFoundryRoom,
  type Input, type Save, type HeroId, type Slot, type FoodId, type GameEvent, type Settings as GameSettings, type Medal,
} from '@/lib/bellspire-game';
import { BellspireScene } from '@/lib/bellspire-scene';
import { GUARDIANS, GUARDIAN_AREA, abilityIcon, type Perk } from '@/lib/bellspire-world';
import { ART } from '@/lib/bellspire-art';
import { dressStrip, lanternPixels, lanternChanged, weaponCoatContrast, stripFor } from '@/lib/bellspire-gear-art';
import { BellspireSound, type Track } from './sound';
import './bellspire.css';

type Screen = 'title' | 'game' | 'ending';
type Tab = 'map' | 'gear' | 'items' | 'trials' | 'guide' | 'settings';
/** The two saves: the first game, and New Game+ (its own key, so the first game's save is never touched). */
type SaveSlot = 'main' | 'ngp';
const SLOT_KEY: Record<SaveSlot, string> = { main: SAVE_KEY, ngp: NGP_SAVE_KEY };
type Action = keyof Input;
type Settings = { sound: boolean; music: boolean; assist: boolean; wisp: boolean; strict: boolean; shake: boolean; calmFlash: boolean; numbers: boolean; minimap: boolean; touch: 'auto' | 'on' | 'off'; keys: Record<Action, string[]> };
const SETTINGS_KEY = 'bellspire-v1-settings';
const ACTIONS: { id: Action; label: string }[] = [
  { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'up', label: 'Up / use' }, { id: 'down', label: 'Down' },
  { id: 'jump', label: 'Jump' }, { id: 'attack', label: 'Attack' }, { id: 'dash', label: 'Dash' }, { id: 'cast', label: 'Spell' }, { id: 'tag', label: 'Tag partner' },
];
const DEFAULT_KEYS: Record<Action, string[]> = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space', 'KeyK'], attack: ['KeyX', 'KeyJ'], dash: ['KeyC', 'KeyL'], cast: ['KeyV', 'KeyI'], tag: ['ShiftLeft', 'ShiftRight', 'Tab'],
};
const DEFAULTS: Settings = { sound: true, music: true, assist: true, wisp: true, strict: false, shake: true, calmFlash: false, numbers: true, minimap: true, touch: 'auto', keys: DEFAULT_KEYS };
const PORTRAIT: Record<string, number> = { dora: 0, enzo: 1, wayra: 2, ukumari: 3, mother: 4, tupa: 6, hollow: 7, founder: 8 };
const SLOTS: Slot[] = ['weapon', 'coat', 'ring', 'relic'];
const SLOT_NAME: Record<Slot, string> = { weapon: 'Weapon', coat: 'Coat', ring: 'Ring', relic: 'Relic' };
const heroName = (h: HeroId) => (h === 'dora' ? 'Dora' : 'Enzo');
const keyName = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('Left', ' L').replace('Right', ' R').replace('Shift L', 'Shift').replace('Shift R', 'Shift');

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null;
    if (!s || typeof s !== 'object') return DEFAULTS;
    const keys = { ...DEFAULT_KEYS };
    if (s.keys) for (const a of ACTIONS) if (Array.isArray(s.keys[a.id]) && s.keys[a.id].every((k) => typeof k === 'string')) keys[a.id] = s.keys[a.id];
    return { ...DEFAULTS, ...s, keys, touch: s.touch === 'on' || s.touch === 'off' ? s.touch : 'auto' };
  } catch { return DEFAULTS; }
}
function readSave(slot: SaveSlot = 'main'): Save | null { try { return parseSave(localStorage.getItem(SLOT_KEY[slot])); } catch { return null; } }
/** A save's one-line summary for the title: levels, how much is found, the play time, and how far the story is. */
function saveLine(s: Save) {
  const c = new BellspireGame(s).completion();
  const where = s.flags.includes('boss:tune') ? 'Bell calm' : s.flags.includes('boss:mother') ? 'Lake Mother calm' : `${['frog', 'hydra', 'puma', 'warden'].filter((b) => s.flags.includes(`boss:${b}`)).length} of 4 seals`;
  return `Dora Lv ${s.heroes.dora.level} · Enzo Lv ${s.heroes.enzo.level} · ${c.pct}% · ${where} · ${formatTime(s.time)}`;
}
const MEDAL_NAME: Record<Medal, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
/** Seconds as m:ss.s */
const clock = (secs: number) => `${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`;
/** Has this save earned the epilogue: seen it, or the Lake Mother calm with everything found. */
function epilogueEarned(s: Save | null) {
  if (!s) return false;
  return s.flags.includes('epilogue') || (s.flags.includes('boss:mother') && new BellspireGame(s).completion().pct >= 100);
}

// (strip sizes come from the art manifest, so a strip that grows never squeezes its frames)
function Icon({ i, size = 2, title }: { i: number; size?: number; title?: string }) {
  const [w, h, n] = ART.icons;
  return <span className="bs-icon" title={title} style={{ width: w * size, height: h * size, backgroundSize: `${n * w * size}px ${h * size}px`, backgroundPosition: `${-i * w * size}px 0` }} />;
}
function Portrait({ who, size = 1.5 }: { who: number; size?: number }) {
  const [w, h, n] = ART.portraits;
  return <span className="bs-portrait" style={{ width: w * size, height: h * size, backgroundSize: `${n * w * size}px ${h * size}px`, backgroundPosition: `${-who * w * size}px 0` }} />;
}
function Bar({ v, max, kind }: { v: number; max: number; kind: 'hp' | 'mp' | 'xp' | 'boss' }) {
  return <span className={`bs-bar bs-bar-${kind}`}><span style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%` }} /></span>;
}

export default function BellspirePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<BellspireGame | null>(null);
  const sceneRef = useRef<BellspireScene | null>(null);
  const soundRef = useRef<BellspireSound | null>(null);
  const held = useRef<Record<Action, boolean>>({ ...NO_INPUT });
  const touchHeld = useRef<Record<Action, boolean>>({ ...NO_INPUT });
  const taps = useRef<Set<Action>>(new Set());
  const pausedRef = useRef(true);
  const [screen, setScreen] = useState<Screen>('title');
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [hasSave, setHasSave] = useState(false);
  /** which save the game in play writes to, and the title's view of both saves */
  const slotRef = useRef<SaveSlot>('main');
  const [saves, setSaves] = useState<{ main: Save | null; ngp: Save | null }>({ main: null, ngp: null });
  const [confirmNgp, setConfirmNgp] = useState(false);
  /** an Echo Trial's result card */
  const [trialResult, setTrialResult] = useState<{ id: string; won: boolean; secs: number; medal: Medal | null; best: number | null; newBest: boolean } | null>(null);
  const [canEpilogue, setCanEpilogue] = useState(false);
  const [canEpilogue2, setCanEpilogue2] = useState(false);
  const [canEpilogue3, setCanEpilogue3] = useState(false);
  const [forge, setForge] = useState(false);
  const [forgeSel, setForgeSel] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [menu, setMenu] = useState<Tab | null>(null);
  const [shop, setShop] = useState(false);
  const [mural, setMural] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ text: string; icon?: number; key: number } | null>(null);
  const [areaBanner, setAreaBanner] = useState<{ text: string; key: number } | null>(null);
  const [ending, setEnding] = useState<{ full: boolean; pct: number; belfry?: boolean; foundry?: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rebind, setRebind] = useState<Action | null>(null);
  const [equipPick, setEquipPick] = useState<{ hero: HeroId; slot: Slot } | null>(null);
  const [view, setView] = useState({ vw: VIEW_W, vh: VIEW_H, css: 2 });
  const scale = view.css;
  const viewRef = useRef(view);
  viewRef.current = view;
  const liftRef = useRef(20);
  const [coarse, setCoarse] = useState(false);
  const [, setFrame] = useState(0);
  /** the map in travel mode (attack at a lit shrine), and a journey under way (ticks since it began) */
  const [travelMode, setTravelMode] = useState(false);
  const travelRef = useRef<{ id: string; t: number } | null>(null);
  const mapNavRef = useRef<((k: 'left' | 'right' | 'ok') => void) | null>(null);
  const padNav = useRef({ left: false, right: false, ok: false });
  /** the item highlighted in the gear list (its preview and comparison), and what was equipped while the menu was open */
  const [gearSel, setGearSel] = useState<string | null>(null);
  const equipped = useRef(new Map<HeroId, string[]>());
  const lastArea = useRef('');

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { if (!menu) { setTravelMode(false); setEquipPick(null); } }, [menu]);
  // gear changed in the menu: when it closes, a shine on the hero in the game and a word about it
  useEffect(() => {
    if (menu || !equipped.current.size) return;
    const g = gameRef.current, sc = sceneRef.current;
    const notes: string[] = [];
    for (const [h, names] of equipped.current) { if (sc) sc.shineT[h] = 45; notes.push(`${heroName(h)} equipped the ${names.join(' and the ')}.`); }
    equipped.current.clear();
    if (g) g.note(notes.join(' '), true);
    soundRef.current?.play('relic');
  }, [menu]);
  useEffect(() => { setGearSel(null); }, [equipPick]);
  const paused = screen !== 'game' || menu !== null || shop || forge || mural !== null || trialResult !== null;
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ─── start-up ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setHasSave(!!readSave()); setCanEpilogue(epilogueEarned(readSave())); setCanEpilogue2(!!readSave()?.flags.includes('epilogue2')); setCanEpilogue3(!!readSave()?.flags.includes('epilogue3'));
    setSaves({ main: readSave('main'), ngp: readSave('ngp') });
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
    soundRef.current = new BellspireSound(s.sound, s.music);
    const scene = new BellspireScene();
    sceneRef.current = scene;
    // ?hitboxes=1 draws every hitbox over the picture
    scene.debug = new URLSearchParams(window.location.search).get('hitboxes') === '1';
    void scene.load().then(() => setReady(true));
    const unlock = () => { soundRef.current?.unlock(); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, []);

  const saveSettings = (s: Settings) => {
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage may be blocked */ }
    soundRef.current?.setSound(s.sound); soundRef.current?.setMusic(s.music);
    const g = gameRef.current;
    if (g) { g.settings.assist = s.assist && !s.strict; g.settings.strict = s.strict; g.settings.wisp = s.wisp; }
    if (sceneRef.current) { sceneRef.current.shakeOn = s.shake; sceneRef.current.reduceFlash = s.calmFlash; sceneRef.current.numbersOn = s.numbers; }
  };
  /** Go to a lit shrine: with the short journey animation, or straight there when motion is reduced. */
  const doTravel = useCallback((id: string) => {
    const g = gameRef.current;
    if (!g) return;
    const why = g.whyNotTravel(id);
    if (why) { setMsg(why); return; }
    setMenu(null); setTravelMode(false); setMsg(null);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      g.travel(id); const ev = g.drainEvents(); sceneRef.current?.handle(ev); onEventsRef.current?.(ev);
    } else travelRef.current = { id, t: 0 };
  }, []);
  const onEventsRef = useRef<((ev: GameEvent[]) => void) | null>(null);
  const writeSave = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    try { localStorage.setItem(SLOT_KEY[slotRef.current], JSON.stringify(g.snapshot())); if (slotRef.current === 'main') setHasSave(true); } catch { /* storage may be blocked */ }
  }, []);

  const startGame = (save: Save | null, slot: SaveSlot = 'main') => {
    const s = settingsRef.current;
    slotRef.current = slot;
    const g = new BellspireGame(save, { assist: s.assist && !s.strict, strict: s.strict, wisp: s.wisp }, (Date.now() % 100000) + 1);
    gameRef.current = g;
    if (sceneRef.current) { sceneRef.current.roomId = ''; sceneRef.current.shakeOn = s.shake; sceneRef.current.reduceFlash = s.calmFlash; sceneRef.current.numbersOn = s.numbers; }
    lastArea.current = '';
    setMenu(null); setShop(false); setForge(false); setMural(null); setEnding(null); setConfirmNew(false); setConfirmNgp(false); setTrialResult(null);
    setScreen('game');
    if (!save || slot === 'ngp') writeSave();
    soundRef.current?.unlock();
  };

  // ─── events from the game ────────────────────────────────────────────────
  const onEvents = useCallback((events: GameEvent[]) => {
    const g = gameRef.current, snd = soundRef.current;
    if (!g) return;
    for (const e of events) {
      if (e.k === 'sfx') snd?.play(e.id);
      else if (e.k === 'save') writeSave();
      else if (e.k === 'shop') setShop(true);
      else if (e.k === 'forge') { setForge(true); setForgeSel(null); setMsg(null); }
      else if (e.k === 'mural') setMural(e.n);
      else if (e.k === 'item') setBanner({ text: e.text, icon: e.icon, key: Date.now() });
      else if (e.k === 'room') writeSave();
      else if (e.k === 'ending') { writeSave(); setEnding({ full: e.full, pct: g.completion().pct, belfry: !!e.belfry, foundry: !!e.foundry }); setScreen('ending'); snd?.setTrack('ending'); }
      else if (e.k === 'down') snd?.play('down');
      else if (e.k === 'travelOpen') { setTravelMode(true); setMsg(null); setMenu('map'); }
      else if (e.k === 'trialStart') { setMenu(null); setTrialResult(null); }
      else if (e.k === 'trialBell') snd?.play('chime');
      else if (e.k === 'trial') setTrialResult({ id: e.id, won: e.won, secs: e.secs, medal: e.medal, best: e.best, newBest: e.newBest });
    }
  }, [writeSave]);
  onEventsRef.current = onEvents;

  // ─── the loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game' || !ready) return;
    let raf = 0, acc = 0, last = performance.now(), frames = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const g = gameRef.current, scene = sceneRef.current, cv = canvasRef.current;
      if (!g || !scene || !cv) return;
      acc += Math.min(100, now - last); last = now;
      const pad = readPad();
      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        // a journey between shrines: the heroes kneel and fade (half a second), arrive, and fade in at the other
        // candle; the game waits (nothing can hurt them) and the controls are locked only for that second
        const tr = travelRef.current;
        if (tr) {
          tr.t++;
          scene.travelFx = tr.t;
          if (tr.t === 30) { g.travel(tr.id); const ev = g.drainEvents(); scene.handle(ev); onEvents(ev); soundRef.current?.play('chime'); }
          if (tr.t >= 60) { travelRef.current = null; scene.travelFx = -1; taps.current.clear(); }
          continue;
        }
        if (pausedRef.current) continue;
        const inp: Input = { ...NO_INPUT };
        for (const a of ACTIONS) inp[a.id] = held.current[a.id] || touchHeld.current[a.id] || pad[a.id] || taps.current.has(a.id);
        taps.current.clear();
        g.step(inp);
        const ev = g.drainEvents();
        scene.handle(ev);
        onEvents(ev);
      }
      scene.resize(viewRef.current.vw, viewRef.current.vh);
      scene.lift = liftRef.current;
      scene.draw(g);
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scene.view, 0, 0);
      // music and the area name
      const area = g.room.area;
      const fighting = g.boss && g.boss.st !== 'wait' && !g.boss.calm;
      soundRef.current?.setTrack((fighting ? 'boss' : area) as Track);
      if (lastArea.current !== area) { if (lastArea.current) setAreaBanner({ text: AREAS[area].name, key: Date.now() }); lastArea.current = area; }
      if (++frames % 6 === 0) setFrame((f) => f + 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, ready, onEvents]);

  useEffect(() => { if (screen === 'title') soundRef.current?.setTrack('title'); }, [screen]);

  // ─── keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (rebind) {
        e.preventDefault();
        if (e.code !== 'Escape') {
          const s = settingsRef.current, keys = { ...s.keys };
          for (const a of ACTIONS) keys[a.id] = keys[a.id].filter((k) => k !== e.code);
          keys[rebind] = [e.code, ...keys[rebind].filter((k) => k !== e.code)].slice(0, 3);
          saveSettings({ ...s, keys });
        }
        setRebind(null);
        return;
      }
      const g = gameRef.current;
      if (screen === 'game' && (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter')) {
        e.preventDefault();
        if (trialResult) setTrialResult(null);
        else if (shop) setShop(false);
        else if (forge) setForge(false);
        else if (mural !== null) setMural(null);
        else if (equipPick) setEquipPick(null);
        else setMenu((m) => (m ? null : 'map'));
        soundRef.current?.play('menu');
        return;
      }
      if (screen === 'game' && (mural !== null || shop) && (e.code === settingsRef.current.keys.jump[0] || e.code === 'Space')) { e.preventDefault(); setMural(null); return; }
      // the map: ← → step through the lit shrines and Z travels to the chosen one
      if (screen === 'game' && menu === 'map' && mapNavRef.current) {
        const k = settingsRef.current.keys;
        if (k.left.includes(e.code)) { e.preventDefault(); mapNavRef.current('left'); return; }
        if (k.right.includes(e.code)) { e.preventDefault(); mapNavRef.current('right'); return; }
        if ((k.jump.includes(e.code) || k.attack.includes(e.code)) && travelMode) { e.preventDefault(); mapNavRef.current('ok'); return; }
      }
      for (const a of ACTIONS) if (settingsRef.current.keys[a.id].includes(e.code)) {
        if (screen === 'game') e.preventDefault();
        if (!held.current[a.id]) taps.current.add(a.id);
        held.current[a.id] = true;
      }
      void g;
    };
    const up = (e: KeyboardEvent) => { for (const a of ACTIONS) if (settingsRef.current.keys[a.id].includes(e.code)) held.current[a.id] = false; };
    const blur = () => { for (const a of ACTIONS) held.current[a.id] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [screen, shop, forge, mural, rebind, equipPick, menu, travelMode, trialResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── gamepad ─────────────────────────────────────────────────────────────
  const padPrev = useRef(false);
  const readPad = () => {
    const out: Record<Action, boolean> = { ...NO_INPUT };
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i: number) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      out.left ||= b(14) || ax < -0.4; out.right ||= b(15) || ax > 0.4; out.up ||= b(12) || ay < -0.5; out.down ||= b(13) || ay > 0.5;
      out.jump ||= b(0); out.attack ||= b(2); out.dash ||= b(1) || b(7); out.cast ||= b(3); out.tag ||= b(4) || b(5);
      // on the map, the d-pad steps through lit shrines and A travels
      const nav = { left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, ok: b(0) || b(2) };
      if (mapNavRef.current) {
        if (nav.left && !padNav.current.left) mapNavRef.current('left');
        if (nav.right && !padNav.current.right) mapNavRef.current('right');
        if (nav.ok && !padNav.current.ok) mapNavRef.current('ok');
      }
      padNav.current = nav;
      const start = b(9);
      if (start && !padPrev.current) setMenu((m) => (m ? null : 'map'));
      padPrev.current = start;
    }
    return out;
  };

  // ─── fitting the canvas ──────────────────────────────────────────────────
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      // about 270 lines tall, as wide as the screen's shape, scaled by a whole number of device pixels where that
      // lands near 270 lines (so pixels stay square and crisp), else by the nearest fit
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      let h = el.clientHeight;
      if (h > w * 0.8) h = Math.round(w * 0.75); // an upright phone: a wide strip on top, the pad below
      const W = w * dpr, H = h * dpr;
      let s = Math.max(1, Math.round(H / 270));
      let vh = H / s, vw = W / s;
      if (vh < 230 || vh > 320 || vw < 320) { s = Math.min(H / 270, W / 320); vh = H / s; vw = W / s; }
      // most rooms are one screen (480) wide: a wider view would only show dark beyond the walls
      if (vw > 520) { s = W / 480; vh = H / s; vw = W / s; }
      vw = Math.max(320, Math.min(520, Math.floor(vw / 2) * 2)); vh = Math.max(200, Math.min(330, Math.floor(vh / 2) * 2));
      setView((v) => (v.vw === vw && v.vh === vh && v.css === s / dpr ? v : { vw, vh, css: s / dpr }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [screen]);

  // ─── debug hook for the browser tests ────────────────────────────────────
  useEffect(() => {
    (window as unknown as { __bellspire: () => unknown }).__bellspire = () => {
      const g = gameRef.current;
      return {
        game: g, scene: sceneRef.current, screen, menu, shop, forge, mural, trialResult, slot: slotRef.current,
        state: g ? { room: g.room.id, area: g.room.area, lead: g.lead, x: g.body.x, y: g.body.y, ground: g.body.ground, swim: g.body.swim, coins: g.save.coins, abilities: [...g.save.abilities], water: { ...g.save.water }, dialog: !!g.dialog, toast: g.toast?.text ?? null, boss: g.boss ? { id: g.boss.id, hp: g.boss.hp, st: g.boss.st } : null, heroes: JSON.parse(JSON.stringify(g.save.heroes)), lantern: g.lanternUp, completion: g.completion(), heat: g.heat, recast: { ...g.save.recast } } : null,
        teleport: (room: string, c: number, r: number) => g?.teleport(room, c, r),
        give: (a: (typeof ABILITY_ORDER)[number]) => g?.giveAbility(a, false),
        setWater: (a: 'halls' | 'docks' | 'throne', l: 0 | 1) => g?.setWater(a, l),
        fightBoss: (id: keyof typeof BOSSES) => g?.fightBoss(id),
        unlockMap: () => g?.unlockMap(),
        setHp: (h: HeroId, hp: number) => g?.setHp(h, hp),
        skipDialog: () => { if (g) g.dialog = null; },
        coins: (n: number) => { if (g) g.save.coins = n; },
        exits: (from?: string) => MAP_EXITS.filter((e) => !from || e.from === from).map((e) => ({ from: e.from, to: e.to, toArea: e.toArea, cross: e.cross, door: e.door?.ch ?? null, dx: e.dx, dy: e.dy })),
        drawnExits: (which: 'mini' | 'map') => DRAWN[which],
        /** what the maps last drew of the belfry guide: silhouette cells, area labels, boats, the route, the arrow */
        mapGuide: () => JSON.parse(JSON.stringify(GUIDE)),
        exitLayer: (on: boolean) => { EXIT_LAYER = on; },
        /** mark every room seen and every chest and mural found (for the epilogue test) */
        /** find everything (or, with `citadel`, everything in the citadel only); returns that completion */
        findAll: (citadel: boolean | 'belfry' = false) => {
          // ('belfry': the citadel and the Windward Belfry, without the Foundry Below)
          if (citadel === 'belfry') {
            const gg = gameRef.current!;
            gg.save.seen = []; for (const r of ROOMS) if (!r.fd) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) gg.save.seen.push(`${r.gx + x},${r.gy + y}`);
            for (const info of INFO.values()) if (!info.room.fd) for (const t of info.things) if (t.ch === 'C') gg.setFlag(`chest:${info.room.id}:${t.i}`);
            MURALS.forEach((_, i) => { if (i < 18) gg.setFlag(`mural:${i}`); });
            for (const a of ABILITY_ORDER.slice(0, 9)) if (!gg.save.abilities.includes(a)) gg.save.abilities.push(a);
            for (const b of ['frog', 'hydra', 'puma', 'warden', 'mother', 'condor', 'clappers', 'tune']) gg.setFlag(`boss:${b}`);
            return gg.completion().belfry.pct;
          }
          const gg = gameRef.current!, keep = (r: { exp?: boolean }) => !citadel || !r.exp;
          gg.save.seen = []; for (const r of ROOMS) if (keep(r)) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) gg.save.seen.push(`${r.gx + x},${r.gy + y}`);
          for (const info of INFO.values()) if (keep(info.room)) for (const t of info.things) if (t.ch === 'C') gg.setFlag(`chest:${info.room.id}:${t.i}`);
          MURALS.forEach((_, i) => { if (!citadel || i < 10) gg.setFlag(`mural:${i}`); });
          for (const a of citadel ? ABILITY_ORDER.slice(0, 7) : ABILITY_ORDER) if (!gg.save.abilities.includes(a)) gg.save.abilities.push(a);
          for (const b of citadel ? ['frog', 'hydra', 'puma', 'warden', 'mother'] : Object.keys(BOSSES)) gg.setFlag(`boss:${b}`);
          return citadel ? gg.completion().base.pct : gg.completion().pct;
        },
        /** for each hero, every weapon they can hold against every coat: how far apart they look (ΔE, ΔL) in the worst frame */
        gearContrast: () => {
          const sc = sceneRef.current!, pixels = (name: string) => { const im = sc.img.get(name)!, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d')!; x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
          const out: Record<string, { dE: number; dL: number; frame: number }> = {};
          for (const [h, ws] of [['dora', ['bronze-sword', 'reed-cutter', 'moonsteel', 'condor-talon', 'obsidian-edge']], ['enzo', ['oak-staff', 'bell-staff', 'star-lamp', 'carillon-staff', 'ladle-staff']]] as const)
            for (const w of ws) for (const c of ['teal-coat', 'rust-coat', 'reed-coat', 'snail-coat', h === 'dora' ? 'windward-jacket' : 'highland-cloak', h === 'dora' ? 'forge-apron' : 'ash-smock']) {
              const parts = `${stripFor(h, c)}-parts`;
              const r = weaponCoatContrast(pixels(sc.dressed(h, w, c)), pixels(parts), sc.img.get(parts)!.width);
              out[`${h}:${w}@${c}`] = { dE: Math.round(r.dE), dL: Math.round(r.dL), frame: r.frame };
            }
          return out;
        },
        /** for every weapon of Enzo's and every coat: pixels a coat swap changed inside the lantern's box in any frame
         *  (the lantern as painted in each frame, its dark bands and frame too, read from the paintings, not the part labels; should all be 0) */
        lanternCheck: () => {
          const sc = sceneRef.current!, pixels = (name: string) => { const im = sc.img.get(name)!, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d')!; x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
          const out: Record<string, number> = {};
          for (const w of ['oak-staff', 'bell-staff', 'star-lamp']) {
            const ref = pixels(sc.dressed('enzo', w, 'rust-coat')), lamp = lanternPixels(pixels('enzo-parts').data);
            for (const c of ['teal-coat', 'reed-coat', 'snail-coat']) out[`${w}@${c}`] = lanternChanged(ref.data, pixels(sc.dressed('enzo', w, c)).data, lamp);
          }
          return out;
        },
        /** the lantern check's control: label the lantern coat in one frame (the leak it must catch) and count what a
         *  coat swap then changes in the lantern (should be well above 0) */
        lanternCheckControl: (frame = 8) => {
          const sc = sceneRef.current!, pixels = (name: string) => { const im = sc.img.get(name)!, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d')!; x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
          const im = pixels('enzo'), pm = pixels('enzo-parts'), lamp = lanternPixels(pm.data), cw = ART.enzo[0];
          for (let i = 0; i < lamp.length; i++) if (lamp[i] && Math.floor((i % pm.width) / cw) === frame) pm.data[i * 4] = 80;
          const a = new Uint8ClampedArray(im.data), b = new Uint8ClampedArray(im.data);
          dressStrip(a, pm.data, im.width, im.height, cw, 'enzo', 'oak-staff', 'rust-coat');
          dressStrip(b, pm.data, im.width, im.height, cw, 'enzo', 'oak-staff', 'teal-coat');
          return lanternChanged(a, b, lamp);
        },
        shrineIcon: (id: string) => { const t = INFO.get(id)!.things.find((x) => x.ch === 'S')!; return { x: 8 + (t.c / 30) * 26, y: 8 + (t.r / 17) * 16 - 4 }; },
        debug: (on: boolean) => { if (sceneRef.current) sceneRef.current.debug = on; },
      };
    };
  }, [screen, menu, shop, mural, trialResult]);

  const g = gameRef.current;
  const touchOn = settings.touch === 'on' || (settings.touch === 'auto' && coarse);
  // with the pad over the picture, the camera sits higher on the lead so the buttons cover floor, not faces
  liftRef.current = touchOn ? 44 : 20;

  // ─── touch pad ───────────────────────────────────────────────────────────
  const padBtn = (a: Action, label: string, cls = '') => (
    <button type="button" className={`bs-pad-btn ${cls}`} aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); touchHeld.current[a] = true; taps.current.add(a); try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ } soundRef.current?.unlock(); }}
      onPointerUp={() => { touchHeld.current[a] = false; }} onPointerCancel={() => { touchHeld.current[a] = false; }} onPointerLeave={() => { touchHeld.current[a] = false; }}>
      {label}
    </button>
  );

  /** Back to the title, with both saves read afresh. */
  function toTitle() {
    setCanEpilogue(epilogueEarned(readSave())); setCanEpilogue2(!!readSave()?.flags.includes('epilogue2')); setCanEpilogue3(!!readSave()?.flags.includes('epilogue3'));
    setHasSave(!!readSave()); setSaves({ main: readSave('main'), ngp: readSave('ngp') }); setTrialResult(null);
    setScreen('title');
  }

  // ─── the screens ─────────────────────────────────────────────────────────
  if (screen === 'title') {
    return (
      <main className="bs-shell bs-title" data-ready={ready ? 'true' : 'false'}>
        <div className="bs-title-art" />
        <div className="bs-title-panel">
          <h1 className="bs-logo"><span>The Sunken</span> Bellspire</h1>
          <p className="bs-tag">A citadel of bells sleeps under a high Andean lake. Dora and Enzo row out with one lantern.</p>
          {(saves.main || saves.ngp) && (
            <ul className="bs-saves" aria-label="Saved games">
              {saves.main && <li><b>Your game</b><small>{saveLine(saves.main)}</small></li>}
              {saves.ngp && <li className="bs-save-ngp"><b>New Game+{saves.ngp.ngp > 1 ? ` ${saves.ngp.ngp}` : ''}</b><small>{saveLine(saves.ngp)}</small></li>}
            </ul>
          )}
          <div className="bs-title-btns">
            {hasSave && <button type="button" className="bs-btn bs-btn-main" onClick={() => startGame(readSave(), 'main')}>Continue</button>}
            {saves.ngp && <button type="button" className={`bs-btn ${hasSave ? '' : 'bs-btn-main'}`} onClick={() => startGame(readSave('ngp'), 'ngp')}>Continue New Game+</button>}
            {(() => {
              // New Game+ starts from the finished first game (or, once New Game+ itself is finished, from that)
              const from = ngpReady(saves.ngp) ? saves.ngp : saves.main;
              if (!saves.main) return null;
              if (!ngpReady(from)) return <span className="bs-locked"><button type="button" className="bs-btn" disabled>New Game+</button><em className="bs-why">Calm the Out-of-Tune Bell to unlock New Game+.</em></span>;
              return <button type="button" className="bs-btn" onClick={() => (saves.ngp ? setConfirmNgp(true) : startGame(newGamePlusSave(from!), 'ngp'))}>{saves.ngp ? `Start New Game+ ${ngpReady(saves.ngp) ? (saves.ngp.ngp + 1) : 'again'}` : 'New Game+'}</button>;
            })()}
            {hasSave && canEpilogue && <button type="button" className="bs-btn" onClick={() => {
              // the ending page again, with the epilogue, from the saved game
              const s = readSave(); if (!s) return;
              slotRef.current = 'main';
              gameRef.current = new BellspireGame(s, { assist: settings.assist && !settings.strict, strict: settings.strict, wisp: settings.wisp });
              setEnding({ full: true, pct: gameRef.current.completion().pct }); setScreen('ending'); soundRef.current?.setTrack('ending');
            }}>See the epilogue</button>}
            {hasSave && canEpilogue2 && <button type="button" className="bs-btn" onClick={() => {
              // the Windward Belfry's ending page, with its epilogue
              const s = readSave(); if (!s) return;
              slotRef.current = 'main';
              gameRef.current = new BellspireGame(s, { assist: settings.assist && !settings.strict, strict: settings.strict, wisp: settings.wisp });
              setEnding({ full: true, pct: gameRef.current.completion().pct, belfry: true }); setScreen('ending'); soundRef.current?.setTrack('ending');
            }}>See the belfry epilogue</button>}
            {hasSave && canEpilogue3 && <button type="button" className="bs-btn" onClick={() => {
              // the Foundry Below's ending page, with its epilogue
              const s = readSave(); if (!s) return;
              slotRef.current = 'main';
              gameRef.current = new BellspireGame(s, { assist: settings.assist && !settings.strict, strict: settings.strict, wisp: settings.wisp });
              setEnding({ full: true, pct: gameRef.current.completion().pct, foundry: true }); setScreen('ending'); soundRef.current?.setTrack('ending');
            }}>See the foundry epilogue</button>}
            <button type="button" className={`bs-btn ${hasSave || saves.ngp ? '' : 'bs-btn-main'}`} onClick={() => (hasSave ? setConfirmNew(true) : startGame(null))}>New game</button>
            <button type="button" className="bs-btn" onClick={() => { setMenu('settings'); }}>Settings</button>
            <a className="bs-btn bs-btn-ghost" href="/">← Arcade</a>
          </div>
          {confirmNew && (
            <div className="bs-confirm" role="dialog">
              <p>Start again from the beginning? Your game’s save will be replaced{saves.ngp ? ' (the New Game+ save is kept)' : ''}.</p>
              <button type="button" className="bs-btn bs-btn-main" onClick={() => startGame(null)}>Yes, start again</button>
              <button type="button" className="bs-btn" onClick={() => setConfirmNew(false)}>Keep my save</button>
            </div>
          )}
          {confirmNgp && (
            <div className="bs-confirm" role="dialog">
              <p>Start New Game+ from the beginning? The New Game+ save will be replaced. Your first game’s save is kept.</p>
              <button type="button" className="bs-btn bs-btn-main" onClick={() => { const from = ngpReady(saves.ngp) ? saves.ngp : saves.main; if (from) startGame(newGamePlusSave(from), 'ngp'); }}>Yes, start New Game+</button>
              <button type="button" className="bs-btn" onClick={() => setConfirmNgp(false)}>Keep it</button>
            </div>
          )}
          <p className="bs-controls-hint">Arrows move · Z jump · X attack · C dash · V spell · Shift tag · ↑ use · Esc menu</p>
        </div>
        {menu === 'settings' && <div className="bs-modal"><div className="bs-sheet">{settingsPanel()}<button type="button" className="bs-btn bs-close" onClick={() => setMenu(null)}>Done</button></div></div>}
      </main>
    );
  }

  if (screen === 'ending' && ending && g) {
    const c = g.completion();
    // the citadel's ending counts the citadel; the Windward Belfry's counts the citadel and belfry; the Foundry
    // Below's counts everything
    const shown = ending.foundry ? { pct: c.pct, chests: c.chests, murals: c.murals, of: COMPLETION }
      : ending.belfry ? { pct: c.belfry.pct, chests: c.belfry.chests, murals: c.belfry.murals, of: COMPLETION.belfry }
      : { pct: c.base.pct, chests: c.base.chests, murals: c.base.murals, of: COMPLETION.base };
    return (
      <main className="bs-shell bs-end" data-ready="true">
        <div className={`bs-end-art ${ending.foundry ? (ending.full ? 'bs-end-full3' : 'bs-end-foundry') : ending.belfry ? (ending.full ? 'bs-end-full2' : 'bs-end-belfry') : ending.full ? 'bs-end-full' : ''}`} />
        <div className="bs-end-panel">
          <h2>{ending.foundry ? 'The Hollow Bell is whole' : ending.belfry ? 'The belfry sings in tune' : 'The bells ring again'}</h2>
          {ending.foundry
            ? <p>Tupa pours the last of the bronze, and the Hollow Bell rings out whole for the first time. Far above, every bell in the Bellspire answers it.</p>
            : ending.belfry
            ? <p>The Out-of-Tune Bell rings true at last, and its note rolls down the Cloudstair to the lake. The wind on the mountain settles into a song.</p>
            : <p>The Lake Mother is calm, the water settles, and every bell in the Bellspire rings at once. Ukumari can rest at last.</p>}
          <p className="bs-end-stats">Explored {shown.pct}% · {shown.chests}/{shown.of.chests} chests · {shown.murals}/{shown.of.murals} murals · Dora level {g.save.heroes.dora.level} · Enzo level {g.save.heroes.enzo.level} · {formatTime(g.save.time)}</p>
          {ending.foundry
            ? (ending.full ? <p className="bs-end-epi">Everything found, citadel, belfry and foundry! Turn the page for the third epilogue: the new bell rung over the lake.</p> : <p>Find everything, the Foundry Below too (100%), and the third epilogue plays the moment you do. Your save is kept, so you can keep exploring.</p>)
            : ending.belfry
            ? (ending.full ? <p className="bs-end-epi">Everything found, citadel and belfry! Turn the page for the second epilogue: the whole mountain ringing at sunset.</p> : <p>Find everything in the citadel and the belfry (100%), and the second epilogue plays the moment you do. Your save is kept, so you can keep exploring.</p>)
            : ending.full ? <p className="bs-end-epi">Everything found! Turn the page for the epilogue: a picnic on the shore with Wayra, Ukumari and the Lake Mother.</p> : <p>Find everything (100%), and the epilogue plays the moment you do. The pause map shows what’s left. Your save is kept, so you can keep exploring.</p>}
          {!ending.belfry && !ending.foundry && <p className="bs-end-next">Wayra’s boat waits at the landing: high above the lake, the Windward Belfry is out of tune.</p>}
          {ending.belfry && <p className="bs-end-next">Under the Pearl Throne, a seal in the floor has cracked: something deep below is ringing out of tune.</p>}
          <div className="bs-title-btns">
            <button type="button" className="bs-btn bs-btn-main" onClick={() => { const s = readSave(slotRef.current); if (s) { s.flags = s.flags.filter((f) => f !== 'ending'); startGame(s, slotRef.current); } }}>Keep exploring</button>
            <button type="button" className="bs-btn" onClick={toTitle}>Title</button>
          </div>
        </div>
      </main>
    );
  }

  const lead = g?.lead ?? 'dora';
  const boss = g?.boss && g.boss.st !== 'wait' ? g.boss : null;
  const dialog = g?.dialog;
  const line = dialog ? dialog.lines[dialog.i] : null;
  const near = g && !dialog ? g.nearby() : null;
  // at a candle shrine: a small prompt over the candle with the player's own keys ("Hit" on the touch pad)
  let shrinePrompt: { text: string; x: number; y: number } | null = null;
  if (g && near && near.ch === 'S' && sceneRef.current) {
    const sc2 = sceneRef.current, lit = g.litShrines().includes(g.room.id);
    const up = touchOn ? '▲' : `${keyName(settings.keys.up[0] ?? 'ArrowUp')}`.replace(/^Up$/, '↑');
    const hit = touchOn ? 'Hit' : keyName(settings.keys.attack[0] ?? 'KeyX');
    const sx = near.c * 16 + 8 - sc2.cam.x;
    // above the candle and above both heroes' heads, so it never sits on a face
    const top = Math.min((near.r + 1) * 16 - 40, g.body.y - 46, g.follower.y - 46) - sc2.cam.y;
    // (once the Echo Trials are open, the menu's Trials page starts them from here)
    const trials = lit && !g.trialsLocked() && !g.trial ? ` · ${touchOn ? '☰' : 'Esc'} Trials` : '';
    shrinePrompt = { text: lit ? `${up} Rest · ${hit} Travel${trials}` : `${up} Rest to light`, x: sx * scale, y: Math.max(26, top) * scale };
  }
  // by an echo bell (the helping hand): how to ring it, over the bell and above both heroes' heads
  const echoT = g && !dialog && !shrinePrompt && sceneRef.current ? g.echoNear() : null, echoAsk = echoT ? g!.echoHint() : null;
  if (g && echoT && echoAsk && sceneRef.current) {
    const sc2 = sceneRef.current;
    const up = touchOn ? '▲' : `${keyName(settings.keys.up[0] ?? 'ArrowUp')}`.replace(/^Up$/, '↑');
    const spell = touchOn ? 'Spell' : keyName(settings.keys.cast[0] ?? 'KeyV');
    const tag = touchOn ? 'Tag' : keyName(settings.keys.tag[0] ?? 'ShiftLeft');
    const top = Math.min(echoT.r * 16 - 30, g.body.y - 46, g.follower.y - 46) - sc2.cam.y;
    shrinePrompt = { text: echoAsk === 'ring' ? `${up} + ${spell} ring` : `${tag}: tag to Enzo to ring`, x: (echoT.c * 16 + 8 - sc2.cam.x) * scale, y: Math.max(26, top) * scale };
  }
  const hint = g && !dialog && !shrinePrompt ? g.nearbyLabel() : null;
  // the minimap fades when the lead walks up under the top-right corner
  const sc = sceneRef.current;
  const heroUnderMap = !!(g && sc && (g.body.x - sc.cam.x) / sc.vw > 0.68 && (g.body.y - 30 - sc.cam.y) / sc.vh < 0.32);
  const heroUnderClock = !!(g && sc && Math.abs((g.body.x - sc.cam.x) / sc.vw - 0.5) < 0.2 && (g.body.y - 34 - sc.cam.y) / sc.vh < 0.24);

  return (
    <main className={`bs-shell bs-game ${touchOn ? 'bs-touch' : ''}`} data-ready={ready && g ? 'true' : 'false'}>
      <div className="bs-stage" ref={stageRef}>
        <div className="bs-frame" style={{ width: view.vw * scale, height: view.vh * scale }}>
          <canvas ref={canvasRef} width={view.vw} height={view.vh} className="bs-canvas" style={{ width: view.vw * scale, height: view.vh * scale }} />
          {g && (
            <div className="bs-hud" style={{ fontSize: Math.max(10, Math.min(16, 7 * scale)) }}>
              {(['dora', 'enzo'] as HeroId[]).map((h) => {
                const s = g.save.heroes[h], st = heroStats(g.save, h);
                return (
                  <div key={h} className={`bs-hero ${h === lead ? 'bs-hero-lead' : ''} ${s.down ? 'bs-hero-down' : ''}`}>
                    <Portrait who={PORTRAIT[h]} size={0.42} />
                    <div className="bs-hero-bars">
                      <b>{heroName(h)} <small>Lv {s.level}</small></b>
                      <Bar v={s.hp} max={st.maxHp} kind="hp" />
                      <Bar v={s.mp} max={st.maxMp} kind="mp" />
                    </div>
                  </div>
                );
              })}
              <div className="bs-coins"><Icon i={20} size={0.7} /> {g.save.coins}</div>
              {isFoundryRoom(g.room.id) && g.heat > 0.5 && (
                <div className={`bs-heat ${g.heat >= 100 ? 'bs-heat-full' : g.heat > 70 ? 'bs-heat-high' : ''}`} role="meter" aria-label="Forge heat" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(g.heat)}>
                  <span>Heat</span><b><i style={{ width: `${Math.round(g.heat)}%` }} /></b>
                </div>
              )}
              {settings.minimap && <MiniMap g={g} faded={heroUnderMap} onOpen={() => { setTravelMode(false); setMenu('map'); }} />}
              <button type="button" className="bs-menu-btn" onClick={() => setMenu('map')} aria-label="Menu">☰</button>
            </div>
          )}
          {g?.trial && (
            <div className={`bs-trial-clock ${heroUnderClock ? 'bs-faded' : ''}`} role="timer">
              <b>{g.trial.def.name}</b>
              <span>{g.trial.def.kind === 'rush' ? `Guardian ${Math.min(g.trial.i + 1, g.rushList().length)} of ${g.rushList().length}` : `Bell ${Math.min(g.trial.i + 1, g.trial.def.goals.length)} of ${g.trial.def.goals.length}`}</span>
              <span className="bs-trial-time">{g.trial.started ? clock(g.trial.t / 60) : 'Move to start'}</span>
            </div>
          )}
          {boss && <div className="bs-boss"><b>{BOSSES[boss.id].name}</b><small>{BOSSES[boss.id].title}</small><Bar v={boss.hp} max={boss.max} kind="boss" /></div>}
          {g?.toast && !dialog && <div className="bs-toast" key={g.toast.text}>{g.toast.text}</div>}
          {hint && !g?.toast && <div className="bs-hint">↑ {hint}</div>}
          {shrinePrompt && <div className="bs-shrine-prompt" style={{ left: shrinePrompt.x, top: shrinePrompt.y }}>{shrinePrompt.text}</div>}
          {areaBanner && <div className="bs-area" key={areaBanner.key} onAnimationEnd={() => setAreaBanner(null)}>{areaBanner.text}</div>}
          {banner && <div className="bs-banner" key={banner.key} onAnimationEnd={() => setBanner(null)}>{banner.icon !== undefined && <Icon i={banner.icon} size={1.5} />}<span>{banner.text}</span></div>}
          {line && (
            <button type="button" className={`bs-dialog ${g && sceneRef.current && g.body.y - sceneRef.current.cam.y > sceneRef.current.vh * 0.55 ? 'bs-dialog-top' : ''}`} onClick={() => taps.current.add('jump')}>
              {line.who !== 'sign' && <Portrait who={PORTRAIT[line.who] ?? 0} size={1.1} />}
              <span className="bs-dialog-text">{line.who !== 'sign' && <b>{NAMES[line.who]}</b>}{line.text}</span>
              <span className="bs-dialog-next">▼</span>
            </button>
          )}
        </div>
      </div>

      {touchOn && (
        <div className="bs-pad">
          <div className="bs-pad-dir">
            {padBtn('up', '▲', 'bs-up')}{padBtn('left', '◀', 'bs-left')}{padBtn('right', '▶', 'bs-right')}{padBtn('down', '▼', 'bs-down')}
          </div>
          <div className="bs-pad-act">
            {padBtn('tag', 'Tag', 'bs-tagb')}{padBtn('cast', 'Spell', 'bs-castb')}{padBtn('dash', 'Dash', 'bs-dashb')}{padBtn('attack', 'Hit', 'bs-atkb')}{padBtn('jump', 'Jump', 'bs-jumpb')}
          </div>
        </div>
      )}

      {menu && g && (
        <div className="bs-modal" onClick={(e) => { if (e.target === e.currentTarget) { setMenu(null); setTravelMode(false); } }}>
          <div className="bs-sheet bs-menu">
            <nav className="bs-tabs" role="tablist">
              {(['map', 'gear', 'items', 'trials', 'guide', 'settings'] as Tab[]).map((t) => (
                <button type="button" key={t} role="tab" aria-selected={menu === t} className={menu === t ? 'on' : ''} onClick={() => { setMenu(t); setEquipPick(null); setMsg(null); soundRef.current?.play('menu'); }}>
                  {{ map: 'Map', gear: 'Gear', items: 'Items', trials: 'Trials', guide: 'Guide', settings: 'Settings' }[t]}
                </button>
              ))}
              <button type="button" className="bs-tab-close" onClick={() => { setMenu(null); setTravelMode(false); }} aria-label="Close menu">✕</button>
            </nav>
            <div className="bs-tab-body">
              {menu === 'map' && mapPanel(g)}
              {menu === 'gear' && gearPanel(g)}
              {menu === 'items' && itemsPanel(g)}
              {menu === 'guide' && guidePanel(g)}
              {menu === 'trials' && trialsPanel(g)}
              {menu === 'settings' && <>{settingsPanel()}<div className="bs-row"><button type="button" className="bs-btn" onClick={() => { writeSave(); setMenu(null); toTitle(); }}>Save and quit to title</button></div></>}
            </div>
            {msg && <p className="bs-msg" role="status">{msg}</p>}
          </div>
        </div>
      )}

      {trialResult && g && (() => {
        const def = TRIALS.find((t) => t.id === trialResult.id)!;
        const why = g.whyNotTrial(def.id);
        return (
          <div className="bs-modal">
            <div className="bs-sheet bs-trial-card" role="dialog" aria-label="Trial result">
              <span className={`bs-medal bs-medal-big bs-medal-${trialResult.medal ?? 'none'}`}>{trialResult.medal ? MEDAL_NAME[trialResult.medal] : trialResult.won ? 'No medal' : 'Over'}</span>
              <h3>{def.name}</h3>
              {trialResult.won
                ? <p className="bs-trial-secs">{clock(trialResult.secs)}{trialResult.newBest && <em className="bs-new-best">New best!</em>}</p>
                : <p>The trial is over. Both heroes are back at the shrine, just as they were.</p>}
              <p className="bs-small-print">Best {trialResult.best !== null ? clock(trialResult.best) : 'none yet'} · Gold {clock(def.medals[0])} · Silver {clock(def.medals[1])} · Bronze {clock(def.medals[2])}</p>
              <div className="bs-row">
                <button type="button" className="bs-btn bs-btn-main" disabled={!!why} onClick={() => { const r = g.startTrial(def.id); const ev = g.drainEvents(); sceneRef.current?.handle(ev); onEvents(ev); if (r) setMsg(r); setTrialResult(null); }}>Try again</button>
                <button type="button" className="bs-btn" onClick={() => setTrialResult(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {shop && g && (
        <div className="bs-modal">
          <div className="bs-sheet bs-shop">
            <div className="bs-shop-head"><Portrait who={2} size={1.2} /><p><b>Wayra</b>Quinoa cakes, muña tea, and odds and ends from the shore. Coins only, please.</p></div>
            <ul className="bs-list">
              {SHOP.map((it) => {
                const gear = GEAR[it.id], food = it.id in FOOD ? FOOD[it.id as FoodId] : null;
                const owned = gear && g.save.gear.includes(it.id);
                const why = owned ? 'You already have one.' : g.save.coins < it.price ? `Needs ${it.price - g.save.coins} more coins.` : null;
                return (
                  <li key={it.id}>
                    <Icon i={gear ? gear.icon : food!.icon} size={1.5} />
                    <span className="bs-li-text"><b>{gear ? gear.name : food!.name}</b><small>{gear ? `${gear.hero ? `${heroName(gear.hero)} · ` : ''}${statLine(gear)} ${gear.text}` : `${food!.text} You have ${g.save.food[it.id as FoodId]}.`}</small></span>
                    <button type="button" className="bs-btn bs-buy" disabled={!!why} title={why ?? ''} onClick={() => { const r = g.buy(it.id); setMsg(r ?? `Bought: ${gear ? gear.name : food!.name}.`); onEvents(g.drainEvents()); setFrame((f) => f + 1); }}>
                      {owned ? 'Owned' : `${it.price} coins`}
                    </button>
                    {why && !owned && <em className="bs-why">{why}</em>}
                  </li>
                );
              })}
            </ul>
            <p className="bs-shop-coins"><Icon i={20} size={1} /> {g.save.coins} coins</p>
            {msg && <p className="bs-msg" role="status">{msg}</p>}
            <button type="button" className="bs-btn bs-close" onClick={() => { setShop(false); setMsg(null); }}>Goodbye</button>
          </div>
        </div>
      )}

      {forge && g && (
        <div className="bs-modal">
          <div className="bs-sheet bs-shop bs-forge">
            <div className="bs-shop-head"><Portrait who={6} size={1.2} /><p><b>Tupa</b>Bring me a piece and I’ll recast it with a little something worked into the bronze. One recast to a piece; a new one melts the old. {RECAST_PRICE} coins.</p></div>
            <ul className="bs-list">
              {g.save.gear.filter((id) => GEAR[id] && GEAR[id].slot !== 'relic').map((id) => {
                const gear = GEAR[id], rc = g.save.recast[id];
                return (
                  <li key={id} className={forgeSel === id ? 'bs-sel' : ''}>
                    <Icon i={gear.icon} size={1.5} />
                    <span className="bs-li-text"><b>{gear.name}{rc && <em className="bs-recast"> · {PERK_TEXT[rc]}</em>}</b><small>{gear.hero ? `${heroName(gear.hero)} · ` : ''}{statLine(gear)}</small></span>
                    <button type="button" className="bs-btn bs-buy" aria-expanded={forgeSel === id} onClick={() => { setForgeSel(forgeSel === id ? null : id); setMsg(null); }}>{forgeSel === id ? 'Close' : 'Recast'}</button>
                    {forgeSel === id && (
                      <div className="bs-perks">
                        {RECAST_PERKS.map((pk) => {
                          const why = g.whyNotRecast(id, pk);
                          return (
                            <span key={pk} className="bs-locked">
                              <button type="button" className="bs-btn" disabled={!!why} title={why ?? ''} onClick={() => { const r = g.recast(id, pk); setMsg(r ?? `Recast: ${gear.name}, ${PERK_TEXT[pk].toLowerCase()}.`); onEvents(g.drainEvents()); setFrame((f) => f + 1); }}>{PERK_TEXT[pk]}</button>
                              {why && <em className="bs-why">{why}</em>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="bs-shop-coins"><Icon i={20} size={1} /> {g.save.coins} coins</p>
            {msg && <p className="bs-msg" role="status">{msg}</p>}
            <button type="button" className="bs-btn bs-close" onClick={() => { setForge(false); setMsg(null); }}>Goodbye</button>
          </div>
        </div>
      )}

      {mural !== null && (
        <div className="bs-modal" onClick={() => setMural(null)}>
          <div className="bs-sheet bs-mural">
            <span className="bs-mural-art" style={{ backgroundSize: `${ART.murals[2] * 100}% 100%`, backgroundPosition: `${(MURALS[mural].panel / (ART.murals[2] - 1)) * 100}% 0` }} />
            <p>{MURALS[mural].text}</p>
            <small>Mural {mural + 1} of {MURALS.length}</small>
            <button type="button" className="bs-btn bs-close" onClick={() => setMural(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );

  // ─── panels ──────────────────────────────────────────────────────────────
  function settingsPanel() {
    const s = settings;
    const toggle = (k: 'sound' | 'music' | 'assist' | 'wisp' | 'strict' | 'shake' | 'calmFlash' | 'numbers' | 'minimap', label: string, help: string, off?: string) => (
      <label className={`bs-toggle ${off ? 'bs-off' : ''}`}><input type="checkbox" disabled={!!off} checked={s[k] && !off} onChange={(e) => saveSettings({ ...s, [k]: e.target.checked, ...(k === 'strict' && e.target.checked ? { assist: false } : {}), ...(k === 'assist' && e.target.checked ? { strict: false } : {}) })} /><span><b>{label}</b><small>{off ?? help}</small></span></label>
    );
    return (
      <div className="bs-settings">
        <h3>Settings</h3>
        {toggle('sound', 'Sound effects', 'Swords, bells, splashes.')}
        {toggle('music', 'Music', 'A tune for every part of the citadel.')}
        {toggle('assist', 'Helping hand', 'On: less damage, slower boss attacks with longer warnings, healing near shrines, and a guiding wisp.')}
        {toggle('wisp', 'Guiding wisp', 'A little light that always floats ahead along the way to the next goal.', s.assist && !s.strict ? undefined : 'Needs the helping hand on.')}
        {toggle('strict', 'Strict mode', 'For experts: full damage, tighter jumps, and travel only from shrines. Turns the helping hand off.')}
        {toggle('shake', 'Screen shake', 'The screen shakes on big hits.')}
        {toggle('calmFlash', 'Calmer flashes', 'No full-screen flashes.')}
        {toggle('numbers', 'Damage numbers', 'Numbers pop off hits, heals, XP and coins.')}
        {toggle('minimap', 'Minimap', 'A small map of the nearby rooms in the corner.')}
        <label className="bs-select">On-screen buttons
          <select value={s.touch} onChange={(e) => saveSettings({ ...s, touch: e.target.value as Settings['touch'] })}>
            <option value="auto">On touch screens</option><option value="on">Always</option><option value="off">Never</option>
          </select>
        </label>
        <h4>Keys <small>(click one, then press the new key)</small></h4>
        <div className="bs-keys">
          {ACTIONS.map((a) => (
            <button type="button" key={a.id} className={`bs-key ${rebind === a.id ? 'on' : ''}`} onClick={() => setRebind(a.id)}>
              <b>{a.label}</b><span>{rebind === a.id ? 'Press a key…' : s.keys[a.id].map(keyName).join(' / ')}</span>
            </button>
          ))}
        </div>
        <button type="button" className="bs-btn bs-small" onClick={() => saveSettings({ ...s, keys: DEFAULT_KEYS })}>Reset keys</button>
        <p className="bs-small-print">Gamepad: A jump · X attack · B dash · Y spell · bumpers tag · Start menu.</p>
      </div>
    );
  }

  function mapPanel(g: BellspireGame) {
    // the citadel's counts until the heroes cross to the Windward Belfry; everything after
    const all = g.completion(), wide = g.flag('belfry:visited') || isBelfryRoom(g.room.id);
    const c = wide ? all : all.base, of = wide ? COMPLETION : COMPLETION.base;
    const shrines = g.litShrines();
    return (
      <div className="bs-map-wrap">
        <MapCanvas g={g} travelMode={travelMode} onTravel={doTravel} navRef={mapNavRef} />
        <div className="bs-map-side">
          <p className="bs-pct">{c.pct}% explored</p>
          <p className="bs-small-print bs-stats-line">Guardians {c.bosses} of {of.bosses} · Rooms {c.cells} of {of.cells} · Chests {c.chests} of {of.chests} · Murals {c.murals} of {of.murals}</p>
          <p className="bs-small-print bs-seals">Throne seals: {g.sealsOpen()} of 4 open</p>
          <ul className="bs-legend" aria-label="Map key">
            <li><i className="lg-stub" />A way into a room not seen yet</li>
            <li><i className="lg-area" style={{ background: `linear-gradient(90deg, ${AREAS.docks.color} 50%, ${AREAS.crypt.color} 50%)` }} />The way into another area, in its colour</li>
            <li><i className="lg-lock" style={{ background: ABILITIES.dash.color }} />A shut door, in the colour of what opens it</li>
            <li><i className="lg-skull" />A guardian still restless</li>
            <li><i className="lg-chest" />A chest not opened yet</li>
            <li><i className="lg-seal" />The throne’s four bell seals</li>
            {g.wispOn() && <li><i className="lg-wisp" />Where the wisp is leading</li>}
            {g.belfryKnown() && <li><i className="lg-boat" />Wayra’s boat (↑ to row across)</li>}
            {g.belfryKnown() && <li><i className="lg-belfry" />The Windward Belfry, not explored yet</li>}
            {g.belfryKnown() && <li><i className="lg-lock" style={{ background: DOOR_COLOR.Z }} />The belfry’s seal door, open once the Hail Condor and Twin Clappers are calm</li>}
            {g.foundryKnown() && <li><i className="lg-belfry lg-foundry" />The Foundry Below, not explored yet</li>}
            {g.foundryKnown() && <li><i className="lg-lock" style={{ background: DOOR_COLOR['9'] }} />The foundry’s seals: the one under the throne, and the deep seal (open once the Molten Founder and the Glass Choir are calm)</li>}
            {g.belfryKnown() && <li><i className="lg-arrow" />On the minimap: the way to the boat or the next area to explore</li>}
          </ul>
          <h4>Travel between shrines</h4>
          <ul className="bs-travel">
            {ROOMS.filter((r) => INFO.get(r.id)!.things.some((t) => t.ch === 'S')).map((r) => {
              const lit = shrines.includes(r.id);
              return (
                <li key={r.id}>
                  <button type="button" className="bs-btn bs-small" disabled={!lit || !!g.whyNotTravel(r.id)} title={lit ? g.whyNotTravel(r.id) ?? '' : ''} onClick={() => doTravel(r.id)}>
                    {lit ? SHRINE_NAMES[r.id] : 'Unlit shrine'}
                  </button>
                  {!lit && <em className="bs-why">Rest at it once to light it.</em>}
                  {lit && r.id === g.room.id && <em className="bs-here">You are here</em>}
                  {lit && r.id !== g.room.id && g.whyNotTravel(r.id) && <em className="bs-why">{g.whyNotTravel(r.id)}</em>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  function gearPanel(g: BellspireGame) {
    return (
      <div className="bs-gear">
        {(['dora', 'enzo'] as HeroId[]).map((h) => {
          const st = heroStats(g.save, h), s = g.save.heroes[h];
          return (
            <section key={h} className="bs-gear-hero">
              <header><Portrait who={PORTRAIT[h]} size={0.9} /><HeroPreview scene={sceneRef.current} hero={h} weapon={g.save.equip[h].weapon ?? ''} coat={g.save.equip[h].coat ?? (h === 'dora' ? 'teal-coat' : 'rust-coat')} /><div><b>{heroName(h)}</b> <small>Level {s.level}</small><Bar v={s.xp} max={xpToNext(s.level)} kind="xp" /><small>{s.xp}/{xpToNext(s.level)} XP</small></div></header>
              <p className="bs-stats">HP {s.hp}/{st.maxHp} · MP {s.mp}/{st.maxMp} · Attack {st.atk} · Defence {st.def} · Magic {st.mag}</p>
              {SLOTS.map((slot) => {
                const id = g.save.equip[h][slot];
                const it = id ? GEAR[id] : null;
                return (
                  <button type="button" key={slot} className={`bs-slot ${equipPick?.hero === h && equipPick.slot === slot ? 'on' : ''}`} onClick={() => setEquipPick({ hero: h, slot })}>
                    <small>{SLOT_NAME[slot]}</small>{it ? <><Icon i={it.icon} size={1} /> {it.name}</> : <em>Empty</em>}
                  </button>
                );
              })}
            </section>
          );
        })}
        {equipPick && (
          <section className="bs-gear-pick">
            <h4>{heroName(equipPick.hero)}’s {SLOT_NAME[equipPick.slot].toLowerCase()}</h4>
            <ul className="bs-list">
              {g.save.gear.filter((id) => GEAR[id].slot === equipPick.slot).map((id) => {
                const it = GEAR[id];
                const wrong = it.hero && it.hero !== equipPick.hero;
                const worn = g.save.equip[equipPick.hero][equipPick.slot] === id;
                const other = g.save.equip[equipPick.hero === 'dora' ? 'enzo' : 'dora'][equipPick.slot] === id;
                const cmp = wrong || worn ? [] : compareGear(g.save, equipPick.hero, equipPick.slot, id);
                const h = equipPick.hero, eq = g.save.equip[h];
                const looks = !wrong && (equipPick.slot === 'weapon' || equipPick.slot === 'coat');
                return (
                  <li key={id} className={gearSel === id ? 'on' : ''} onClick={() => setGearSel(id)} onMouseEnter={() => setGearSel(id)}>
                    {looks && gearSel === id ? <HeroPreview scene={sceneRef.current} hero={h} weapon={equipPick.slot === 'weapon' ? id : eq.weapon ?? ''} coat={equipPick.slot === 'coat' ? id : eq.coat ?? ''} /> : <Icon i={it.icon} size={1.5} />}
                    <span className="bs-li-text"><b>{it.name}</b><small>{statLine(it)} {it.text}{other ? ` (${heroName(equipPick.hero === 'dora' ? 'enzo' : 'dora')} is using it.)` : ''}</small>
                      {cmp.length > 0 && <span className="bs-compare">{cmp.map((c, i) => <em key={i} className={c.up ? 'bs-up' : 'bs-down'}>{c.label === '+' || c.label === '−' ? `${c.label} ${c.text}` : `${c.label} ${c.text}`}</em>)}</span>}
                    </span>
                    <button type="button" className="bs-btn bs-small" disabled={!!wrong || worn} title={wrong ? `Only ${heroName(it.hero!)} can use it.` : ''} onClick={() => { const r = g.equip(equipPick.hero, equipPick.slot, id); setMsg(r ?? `${heroName(equipPick.hero)} equipped the ${it.name}.`); if (!r) equipped.current.set(equipPick.hero, [...(equipped.current.get(equipPick.hero) ?? []).filter((n) => n !== it.name), it.name]); onEvents(g.drainEvents()); setFrame((f) => f + 1); }}>{worn ? 'Worn' : 'Equip'}</button>
                    {wrong && <em className="bs-why">Only {heroName(it.hero!)} can use it.</em>}
                  </li>
                );
              })}
              {equipPick.slot !== 'weapon' && g.save.equip[equipPick.hero][equipPick.slot] && (
                <li><span className="bs-li-text"><b>Take it off</b></span><button type="button" className="bs-btn bs-small" onClick={() => { const r = g.equip(equipPick.hero, equipPick.slot, null); setMsg(r ?? 'Taken off.'); setFrame((f) => f + 1); }}>Remove</button></li>
              )}
            </ul>
            {g.save.gear.filter((id) => GEAR[id].slot === equipPick.slot).length === 0 && <p className="bs-small-print">Nothing for this slot yet. Look in chests, or ask Wayra.</p>}
          </section>
        )}
      </div>
    );
  }

  function itemsPanel(g: BellspireGame) {
    return (
      <div className="bs-items">
        <h4>Food</h4>
        <ul className="bs-list">
          {(Object.keys(FOOD) as FoodId[]).map((f) => (
            <li key={f}>
              <Icon i={FOOD[f].icon} size={1.5} />
              <span className="bs-li-text"><b>{FOOD[f].name} ×{g.save.food[f]}</b><small>{FOOD[f].text}</small></span>
              <button type="button" className="bs-btn bs-small" disabled={g.save.food[f] <= 0} onClick={() => { const r = g.eat(f); setMsg(r ?? `${heroName(g.lead)} enjoyed the ${FOOD[f].name}.`); onEvents(g.drainEvents()); setFrame((x) => x + 1); }}>Use</button>
              {g.save.food[f] <= 0 && <em className="bs-why">None left. Wayra sells more.</em>}
            </li>
          ))}
        </ul>
        <h4>Abilities</h4>
        <ul className="bs-list">
          {ABILITY_ORDER.map((a, i) => (
            <li key={a} className={g.has(a) ? '' : 'bs-locked'}>
              <Icon i={abilityIcon(a)} size={1.5} />
              <span className="bs-li-text"><b>{g.has(a) ? ABILITIES[a].name : '???'}</b><small>{g.has(a) ? ABILITIES[a].how : 'Not found yet. Doors marked with this colour need it.'}</small></span>
              <i className="bs-swatch" style={{ background: ABILITIES[a].color }} />
            </li>
          ))}
        </ul>
        <h4>Spells</h4>
        <ul className="bs-list">
          {(Object.keys(SPELLS) as (keyof typeof SPELLS)[]).map((sp) => (
            <li key={sp} className={g.save.spells.includes(sp) ? '' : 'bs-locked'}>
              <span className="bs-li-text"><b>{g.save.spells.includes(sp) ? `${SPELLS[sp].name} · ${heroName(SPELLS[sp].hero)} · ${SPELLS[sp].mp} MP` : '???'}</b><small>{g.save.spells.includes(sp) ? SPELLS[sp].how : 'Not learned yet.'}</small></span>
            </li>
          ))}
        </ul>
        <p className="bs-small-print">Bell Hearts found: {g.save.hearts} · Moon Drops found: {g.save.drops}</p>
      </div>
    );
  }

  function trialsPanel(g: BellspireGame) {
    const locked = g.trialsLocked(), medals = g.snapshot().medals;
    // the reason every trial shares (not open yet, or not at a shrine) is said once; one trial's own reason by it
    const common = locked ?? (g.trial ? null : g.whyNotTrial('rush'));
    const start = (id: string) => { const r = g.startTrial(id); const ev = g.drainEvents(); sceneRef.current?.handle(ev); onEvents(ev); if (r) setMsg(r); };
    return (
      <div className="bs-trials">
        {g.trial && (
          <div className="bs-trial-now">
            <p>Running: <b>{g.trial.def.name}</b> · {clock(g.trial.t / 60)}</p>
            <button type="button" className="bs-btn" onClick={() => { g.quitTrial(); const ev = g.drainEvents(); sceneRef.current?.handle(ev); onEvents(ev); setMenu(null); }}>Give up the trial</button>
          </div>
        )}
        {common && <p className="bs-why bs-trials-why">{common}</p>}
        {!locked && <p className="bs-small-print">Echo Trials start from any lit candle shrine. Nothing you do in one is kept but your best time. A run’s clock starts when you move.</p>}
        <ul className="bs-list">
          {TRIALS.map((def) => {
            const best = medals[def.id], medal = medalFor(def, best);
            const why = g.trial ? null : g.whyNotTrial(def.id);
            return (
              <li key={def.id} className={locked ? 'bs-trial-locked' : ''}>
                <span className={`bs-medal bs-medal-${medal ?? 'none'}`} title={medal ? `${MEDAL_NAME[medal]} medal` : 'No medal yet'}>{medal ? MEDAL_NAME[medal] : '—'}</span>
                <span className="bs-li-text">
                  <b>{def.name}</b>
                  <small>{def.text} Best {best !== undefined ? clock(best) : 'none yet'} · {MEDALS.map((m, i) => `${MEDAL_NAME[m]} ${clock(def.medals[i])}`).join(' · ')}</small>
                </span>
                {!g.trial && <button type="button" className="bs-btn bs-small" disabled={!!why} title={why ?? ''} onClick={() => start(def.id)}>Start</button>}
                {why && why !== common && <em className="bs-why">{why}</em>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function guidePanel(g: BellspireGame) {
    const k = (a: Action) => settings.keys[a].map(keyName).join(' / ');
    return (
      <div className="bs-guide">
        <h4>Controls</h4>
        <ul className="bs-guide-list">
          <li><b>{k('left')} · {k('right')}</b> move · <b>{k('jump')}</b> jump (hold to jump higher)</li>
          <li><b>{k('attack')}</b> attack: press again for a combo · Dora: ↓ + attack in the air to bounce off enemies</li>
          <li><b>{k('dash')}</b> Dora’s dash (once found) · <b>{k('cast')}</b> spell · <b>{k('tag')}</b> swap Dora and Enzo</li>
          <li><b>{k('up')}</b> rest at shrines, talk, read murals, open chests, climb ladders · <b>{k('down')}</b> + jump drops through ledges</li>
          <li>As Enzo: ↓ + spell raises the lantern · ↑ + spell rings the Bell Chime · hold spell for the Ember Ring</li>
        </ul>
        <h4>Tips</h4>
        <ul className="bs-guide-list">
          <li>Dora is quick with a short sword. Enzo is slower, hits further, and carries the lantern and the magic.</li>
          <li>Bronze water bells raise and lower the water in their area. Hit one to ring it.</li>
          <li>Coloured doors need an ability: blue Reed Dash, green Wind Leap, red Wall Kick, orange lantern, gold Bell Chime.</li>
          <li>Candle shrines heal both heroes and save. If both heroes are knocked out you wake at the last shrine, and your coins wait where you fell.</li>
          <li>Bosses flash and show a ! just before they attack.</li>
        </ul>
        <p className="bs-small-print">Play time {formatTime(g.save.time)} · Seed {g.seed}</p>
      </div>
    );
  }
}

// typed by Perk, so a new perk without words here fails the typecheck instead of showing "+undefined"
const PERK_TEXT: Record<Perk, string> = {
  fast: 'Swings come round faster', reach: 'A longer reach', cheapchime: 'The Bell Chime costs 2 less MP', bright: 'The lantern shines much further',
  sturdy: 'Hits don’t knock back', swim: 'Swims a third faster', lucky: 'A quarter more coins', regen: 'MP slowly comes back',
  crit: 'Some hits land twice as hard', quick: 'Runs a little faster', secrets: 'Cracked walls shine', xp: 'A quarter more XP',
  windward: 'Gusts push half as hard', notes: 'Echo notes last twice as long',
  cool: 'The forge heat builds half as fast', tempered: '+3 DEF', keen: '+3 ATK', focus: '+3 MAG',
};
/** What wearing an item would change for a hero: each stat before and after, and perks gained or lost. */
function compareGear(save: Save, hero: HeroId, slot: Slot, id: string) {
  const now = heroStats(save, hero);
  const then = heroStats({ ...save, equip: { ...save.equip, [hero]: { ...save.equip[hero], [slot]: id } } }, hero);
  const rows: { label: string; text: string; up: boolean }[] = [];
  for (const [k, label] of [['atk', 'ATK'], ['def', 'DEF'], ['mag', 'MAG'], ['maxHp', 'Max HP'], ['maxMp', 'Max MP']] as const)
    if (then[k] !== now[k]) rows.push({ label, text: `${now[k]} → ${then[k]}`, up: then[k] > now[k] });
  for (const pk of then.perks) if (!now.perks.includes(pk)) rows.push({ label: '+', text: PERK_TEXT[pk], up: true });
  for (const pk of now.perks) if (!then.perks.includes(pk)) rows.push({ label: '−', text: PERK_TEXT[pk], up: false });
  return rows;
}

/** A hero standing in the gear they wear (or would wear), drawn from the scene's own dressed sprites. */
function HeroPreview({ scene, hero, weapon, coat }: { scene: BellspireScene | null; hero: HeroId; weapon: string; coat: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !scene) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const name = scene.dressed(hero, weapon, coat), im = scene.img.get(name), [cw, ch] = ART[hero];
    if (im) ctx.drawImage(im, 0, 0, cw, ch, 0, 0, cw, ch);
  }, [scene, hero, weapon, coat]);
  return <canvas ref={ref} className="bs-preview" width={56} height={50} data-weapon={weapon} data-coat={coat} aria-label={`${heroName(hero)} in the ${GEAR[weapon]?.name} and ${GEAR[coat]?.name}`} />;
}

function statLine(it: { atk?: number; def?: number; mag?: number; hp?: number; mp?: number }) {
  const p: string[] = [];
  if (it.atk) p.push(`Atk +${it.atk}`); if (it.def) p.push(`Def +${it.def}`); if (it.mag) p.push(`Mag +${it.mag}`); if (it.hp) p.push(`HP +${it.hp}`); if (it.mp) p.push(`MP +${it.mp}`);
  return p.length ? `${p.join(', ')}.` : '';
}
function formatTime(s: number) { const m = Math.floor(s / 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }

/** The pause map: every room you have seen, coloured by area, with shrines, chests and the heroes. */
// ─── the map: drawn the same way in the pause menu and the HUD minimap ─────
const EXIT_DOORS = new Set(MAP_EXITS.flatMap((e) => (e.door ? [e.door.id] : [])));
/** The doorways: a plain gap between two explored rooms, a bright stub into a room not seen yet, the next area's colour
 *  on a way into another area (even unexplored), and a lock in the ability's colour on a door that is still shut. */
/** What each map last drew at its doorways (for the browser tests). */
type Drawn = { kind: 'lock' | 'area' | 'stub' | 'gap'; from: string; to: string; toArea: string; x: number; y: number };
const DRAWN: Record<'mini' | 'map', Drawn[]> = { mini: [], map: [] };
/** the doorway layer can be hidden from the debug hook, for before-and-after pictures */
let EXIT_LAYER = true;
function drawExits(ctx: CanvasRenderingContext2D, g: BellspireGame, seen: Set<string>, CW: number, CH: number, ox: number, oy: number, line: number, small: boolean) {
  const n = small ? 4 : 7, th = line + 2, drawn: Drawn[] = [];
  DRAWN[small ? 'mini' : 'map'] = drawn;
  if (!EXIT_LAYER) return;
  for (const e of MAP_EXITS) {
    if (!seen.has(`${e.cx},${e.cy}`)) continue;
    const px = ox + e.cx * CW, py = oy + e.cy * CH;
    // the middle of the doorway, on the wall line
    const mx = e.dx ? px + (e.dx > 0 ? CW - line / 2 : line / 2) : px + e.at * CW;
    const my = e.dy ? py + (e.dy > 0 ? CH - line / 2 : line / 2) : py + e.at * CH;
    const rect = (len: number, depth: number, out = 0) => {
      // a bar along the wall (len) and across it (depth), pushed `out` px past the wall
      const w = e.dx ? depth : len, h = e.dx ? len : depth;
      ctx.fillRect(Math.round(mx - w / 2 + e.dx * out), Math.round(my - h / 2 + e.dy * out), w, h);
    };
    const shut = e.door && !g.doorOpen(e.door);
    const known = seen.has(`${e.cx + e.dx},${e.cy + e.dy}`);
    if (mx > -8 && my > -8 && mx < ctx.canvas.width + 8 && my < ctx.canvas.height + 8)
      drawn.push({ kind: shut ? 'lock' : e.cross ? 'area' : !known ? 'stub' : 'gap', from: e.from, to: e.to, toArea: e.toArea, x: Math.round(mx), y: Math.round(my) });
    if (shut) {
      // a little lock in the door's colour
      const k = small ? 5 : 8;
      ctx.fillStyle = '#1a1020'; ctx.fillRect(Math.round(mx - k / 2) - 1, Math.round(my - k / 2) - 1, k + 2, k + 2);
      ctx.fillStyle = DOOR_COLOR[e.door!.ch] ?? '#b85050'; ctx.fillRect(Math.round(mx - k / 2), Math.round(my - k / 2), k, k);
      ctx.fillStyle = '#1a1020'; ctx.fillRect(Math.round(mx) - (small ? 0 : 1), Math.round(my) - 1, small ? 1 : 2, small ? 2 : 3);
    } else if (e.cross) {
      // into another area: a notch in that area's colour, poking out of the wall
      ctx.fillStyle = '#1a1020'; rect(n + 2, th + 2, 1);
      ctx.fillStyle = AREAS[e.toArea].color; rect(n, th, 1);
      if (!known) { ctx.fillStyle = '#fff6d8'; rect(small ? 2 : 3, small ? 1 : 2, small ? 2 : 3); }
    } else if (!known) {
      // into a room not seen yet: a bright stub pointing out
      ctx.fillStyle = '#fff6d8'; rect(n, th, 1);
      rect(Math.max(2, n - 2), 2, small ? 2 : 3);
    } else {
      // between two rooms already seen: a plain gap in the wall
      ctx.fillStyle = AREAS[roomById(e.from).area].color; rect(n, th);
    }
  }
}
/** The throne door's four bell seals: one per guardian in its area's colour, bright once that guardian is calm. */
function sealPips(ctx: CanvasRenderingContext2D, g: BellspireGame, x: number, y: number, small: boolean) {
  const k = small ? 2 : 3, gap = k + 1, x0 = Math.round(x - (GUARDIANS.length * gap) / 2);
  ctx.fillStyle = '#1a1020'; ctx.fillRect(x0 - 1, Math.round(y) - 1, GUARDIANS.length * gap + 1, k + 2);
  GUARDIANS.forEach((b, i) => { ctx.fillStyle = g.flag(`boss:${b}`) ? AREAS[GUARDIAN_AREA[b]].color : '#3a3040'; ctx.fillRect(x0 + i * gap, Math.round(y), k, k); });
}
const SHRINE_ROOMS = ROOMS.filter((r) => INFO.get(r.id)!.things.some((t) => t.ch === 'S'));
/** How many screens wide the map is: the citadel's twelve, or (once the heroes have crossed the water) the Windward
 *  Belfry's too. */
const BASE_SCREENS = Math.max(...ROOMS.filter((r) => !isBelfryRoom(r.id)).map((r) => r.gx + r.w));
const ALL_SCREENS = Math.max(...ROOMS.map((r) => r.gx + r.w));
function mapScreens(g: BellspireGame) { return g.belfryKnown() ? ALL_SCREENS : BASE_SCREENS; }
/** How many screens tall: the citadel and belfry's nine, or with the Foundry Below (once its seal has cracked, or the
 *  heroes have been down there) its four rows under the citadel too. */
const BASE_ROWS = Math.max(...ROOMS.filter((r) => !r.fd).map((r) => r.gy + r.h));
const ALL_ROWS = Math.max(...ROOMS.map((r) => r.gy + r.h));
function mapRows(g: BellspireGame) { return g.foundryKnown() ? ALL_ROWS : BASE_ROWS; }
const DOOR_COLOR: Record<string, string> = { d: ABILITIES.dash.color, j: ABILITIES.double.color, k: ABILITIES.wallkick.color, l: ABILITIES.lantern.color, c: ABILITIES.chime.color, y: ABILITIES.rope.color, n: ABILITIES.echo.color, '8': ABILITIES.hammer.color, '&': ABILITIES.resonance.color, u: '#c9a46a', b: '#b85050', Z: '#9fc4ff', '9': '#e0703a', V: '#e0703a' };
/** The Windward Belfry's cells, by area (for its silhouette before it is explored). */
const BELFRY_CELLS = new Map<string, string>();
for (const r of ROOMS) if (isBelfryRoom(r.id)) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) BELFRY_CELLS.set(`${r.gx + x},${r.gy + y}`, r.area);
/** A world point on a map drawn at cell size CW×CH from (ox, oy). */
const mapPt = (x: number, y: number, CW: number, CH: number, ox: number, oy: number) => ({ x: Math.round(ox + (x / 480) * CW), y: Math.round(oy + ((y - 8) / 272) * CH) });
/** What the maps last drew of the belfry guide (for the browser tests). */
const GUIDE: { map: { silhouette: number; labels: string[]; boats: string[]; route: boolean }; mini: { boats: string[]; arrow: { kind: string; area?: string; x: number; y: number; dx: number; dy: number } | null }; foundry: { silhouette: number; labels: string[] } } = { map: { silhouette: 0, labels: [], boats: [], route: false }, mini: { boats: [], arrow: null }, foundry: { silhouette: 0, labels: [] } };
/** Wayra's boat: a little reed boat with a curled prow, outlined so it reads on any colour. */
function boatIcon(ctx: CanvasRenderingContext2D, x: number, y: number, small: boolean) {
  const k = small ? 1 : 2;
  ctx.fillStyle = '#1a1020';
  ctx.fillRect(x - 5 * k, y - 2 * k, 10 * k + 1, 3 * k + 1); ctx.fillRect(x - 6 * k, y - 4 * k, 2 * k + 1, 3 * k); ctx.fillRect(x + 4 * k, y - 4 * k, 2 * k + 1, 3 * k);
  ctx.fillStyle = '#d9a35a'; ctx.fillRect(x - 4 * k, y - k, 8 * k + 1, k + 1); ctx.fillRect(x - 5 * k, y - 3 * k, k + 1, 2 * k); ctx.fillRect(x + 4 * k, y - 3 * k, k + 1, 2 * k);
  ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 3 * k, y, 6 * k + 1, k);
  if (!small) { ctx.fillStyle = '#fff2c8'; ctx.fillRect(x - 3 * k, y - k, 2, 1); }
}
/** Once the Lake Mother is calm: the Windward Belfry to the east, its rooms not seen yet as a dim hatched silhouette in
 *  each area's colour (no room detail), the area names on the full map, and Wayra's boat on both shores with a dotted
 *  route over the lake. Before she is calm nothing is drawn: the belfry stays a secret. */
/** The Foundry Below's cells, by area. */
const FOUNDRY_CELLS = new Map<string, string>();
for (const r of ROOMS) if (r.fd) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) FOUNDRY_CELLS.set(`${r.gx + x},${r.gy + y}`, r.area);
/** Once its seal has cracked: the Foundry Below under the citadel, its rooms not seen yet as a dim hatched silhouette
 *  in each area's colour, and (on the full map) the names of the areas still to explore. */
function drawFoundryGuide(ctx: CanvasRenderingContext2D, g: BellspireGame, seen: Set<string>, CW: number, CH: number, ox: number, oy: number, small: boolean) {
  const out = { silhouette: 0, labels: [] as string[] };
  if (g.foundryKnown()) {
    for (const [cell, area] of FOUNDRY_CELLS) {
      if (seen.has(cell)) continue;
      out.silhouette++;
      const [cx, cy] = cell.split(',').map(Number), px = ox + cx * CW, py = oy + cy * CH, col = AREAS[area as keyof typeof AREAS].color;
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, CW, CH); ctx.clip();
      ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fillRect(px, py, CW, CH);
      ctx.globalAlpha = 0.4; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
      const step = small ? 3 : 5;
      for (let d = -CH; d < CW; d += step) { ctx.moveTo(px + d + 0.5, py); ctx.lineTo(px + d + CH + 0.5, py + CH); }
      ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 0.85; ctx.fillStyle = col; const w = small ? 1 : 2;
      if (FOUNDRY_CELLS.get(`${cx - 1},${cy}`) !== area) ctx.fillRect(px, py, w, CH);
      if (FOUNDRY_CELLS.get(`${cx + 1},${cy}`) !== area) ctx.fillRect(px + CW - w, py, w, CH);
      if (FOUNDRY_CELLS.get(`${cx},${cy - 1}`) !== area) ctx.fillRect(px, py, CW, w);
      if (FOUNDRY_CELLS.get(`${cx},${cy + 1}`) !== area) ctx.fillRect(px, py + CH - w, CW, w);
      ctx.globalAlpha = 1;
    }
    if (!small) {
      ctx.font = '600 9px "Pixelify Sans", "Silkscreen", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const area of ['cast', 'glass'] as const) {
        const cells = [...FOUNDRY_CELLS].filter(([, ar]) => ar === area).map(([k]) => k.split(',').map(Number));
        if (cells.every(([cx, cy]) => seen.has(`${cx},${cy}`))) continue;
        const mx = cells.reduce((s2, [cx]) => s2 + cx + 0.5, 0) / cells.length, my = cells.reduce((s2, [, cy]) => s2 + cy + 0.5, 0) / cells.length;
        const x = Math.round(ox + mx * CW), y = Math.round(oy + my * CH), name = AREAS[area].name;
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a1020'; ctx.strokeText(name, x, y); ctx.fillStyle = '#fff2dc'; ctx.fillText(name, x, y);
        out.labels.push(name);
      }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }
  if (!small) GUIDE.foundry = out;
}
function drawBelfryGuide(ctx: CanvasRenderingContext2D, g: BellspireGame, seen: Set<string>, CW: number, CH: number, ox: number, oy: number, t: number, small: boolean, under: boolean) {
  if (under) drawFoundryGuide(ctx, g, seen, CW, CH, ox, oy, small);
  if (!g.belfryKnown()) { if (under) { GUIDE[small ? 'mini' : 'map'].boats = []; if (!small) Object.assign(GUIDE.map, { silhouette: 0, labels: [], route: false }); } return; }
  if (under) {
    // the silhouette, under the explored rooms
    let n = 0;
    for (const [cell, area] of BELFRY_CELLS) {
      if (seen.has(cell)) continue;
      n++;
      const [cx, cy] = cell.split(',').map(Number), px = ox + cx * CW, py = oy + cy * CH, col = AREAS[area as keyof typeof AREAS].color;
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, CW, CH); ctx.clip();
      ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fillRect(px, py, CW, CH);
      ctx.globalAlpha = 0.4; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
      const step = small ? 3 : 5;
      for (let d = -CH; d < CW; d += step) { ctx.moveTo(px + d + 0.5, py + CH); ctx.lineTo(px + d + CH + 0.5, py); }
      ctx.stroke(); ctx.restore();
      // the outline: only where the area ends
      ctx.globalAlpha = 0.85; ctx.fillStyle = col; const w = small ? 1 : 2;
      if (BELFRY_CELLS.get(`${cx - 1},${cy}`) !== area) ctx.fillRect(px, py, w, CH);
      if (BELFRY_CELLS.get(`${cx + 1},${cy}`) !== area) ctx.fillRect(px + CW - w, py, w, CH);
      if (BELFRY_CELLS.get(`${cx},${cy - 1}`) !== area) ctx.fillRect(px, py, CW, w);
      if (BELFRY_CELLS.get(`${cx},${cy + 1}`) !== area) ctx.fillRect(px, py + CH - w, CW, w);
      ctx.globalAlpha = 1;
    }
    if (!small) GUIDE.map.silhouette = n;
    return;
  }
  const land = g.boatAt('landing'), cliff = g.boatAt('cliffoot');
  const a = mapPt(land.x, land.y, CW, CH, ox, oy), b = mapPt(cliff.x, cliff.y, CW, CH, ox, oy);
  if (!small) {
    // the boat route: a dotted line bowed down over the lake, the dots marching from the Landing to the cliff
    const c = { x: (a.x + b.x) / 2, y: Math.min(ctx.canvas.height - 6, Math.max(a.y, b.y) + 3 * CH) };
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 200; i++) { const u = i / 200, v = 1 - u; pts.push({ x: v * v * a.x + 2 * u * v * c.x + u * u * b.x, y: v * v * a.y + 2 * u * v * c.y + u * u * b.y }); }
    let run = (t * 0.25) % 8;
    for (let i = 1; i < pts.length; i++) {
      run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (run >= 8) { run -= 8; const p = pts[i]; ctx.fillStyle = '#1a1020'; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4); ctx.fillStyle = '#bfe8ff'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2); }
    }
    GUIDE.map.route = true;
    // the area names, while there is something of the area still to see
    const labels: string[] = [];
    ctx.font = '600 9px "Pixelify Sans", "Silkscreen", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const area of ['cloud', 'loft'] as const) {
      const cells = [...BELFRY_CELLS].filter(([, ar]) => ar === area).map(([k]) => k.split(',').map(Number));
      if (cells.every(([cx, cy]) => seen.has(`${cx},${cy}`))) continue;
      const mx = cells.reduce((s2, [cx]) => s2 + cx + 0.5, 0) / cells.length, my = cells.reduce((s2, [, cy]) => s2 + cy + 0.5, 0) / cells.length;
      const x = Math.round(ox + mx * CW), y = Math.round(oy + my * CH), name = AREAS[area].name;
      ctx.lineWidth = 3; ctx.strokeStyle = '#1a1020'; ctx.strokeText(name, x, y); ctx.fillStyle = '#fff2dc'; ctx.fillText(name, x, y);
      labels.push(name);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    GUIDE.map.labels = labels;
  }
  const boats: string[] = [];
  for (const [p, id] of [[a, 'landing'], [b, 'cliffoot']] as const) {
    if (p.x < -8 || p.y < -8 || p.x > ctx.canvas.width + 8 || p.y > ctx.canvas.height + 8) continue;
    boatIcon(ctx, p.x, p.y, small); boats.push(id);
  }
  GUIDE[small ? 'mini' : 'map'].boats = boats;
}

type MapIcon = { id: string; x: number; y: number; lit: boolean };
/** Draw the explored map at cell size CW×CH from (ox, oy): rooms by area, ways out into unexplored rooms, shrines
 *  (big candles, lit or grey), chests, Wayra, guardians and locked doors, and where the heroes are. Returns the
 *  shrine icons, for tapping. */
function drawMap(ctx: CanvasRenderingContext2D, g: BellspireGame, CW: number, CH: number, ox: number, oy: number, t: number, sel: string | null, small: boolean): MapIcon[] {
  const seen = new Set(g.save.seen), lit = g.litShrines(), icons: MapIcon[] = [];
  const line = small ? 1 : 2;
  drawBelfryGuide(ctx, g, seen, CW, CH, ox, oy, t, small, true);
  for (const r of ROOMS) {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const cx = r.gx + x, cy = r.gy + y;
      if (!seen.has(`${cx},${cy}`)) continue;
      const px = ox + cx * CW, py = oy + cy * CH;
      ctx.fillStyle = AREAS[r.area].color; ctx.globalAlpha = 0.85; ctx.fillRect(px, py, CW, CH); ctx.globalAlpha = 1;
      ctx.fillStyle = '#2a1a1a';
      if (x === 0) ctx.fillRect(px, py, line, CH);
      if (x === r.w - 1) ctx.fillRect(px + CW - line, py, line, CH);
      if (y === 0) ctx.fillRect(px, py, CW, line);
      if (y === r.h - 1) ctx.fillRect(px, py + CH - line, CW, line);
    }
  }
  drawExits(ctx, g, seen, CW, CH, ox, oy, line, small);
  for (const r of ROOMS) {
    const info = INFO.get(r.id)!;
    for (const d of info.doors) {
      const cell = `${Math.floor(d.c / 30)},${Math.floor(d.r / 17)}`;
      if (!seen.has(cell)) continue;
      if (d.ch === 'u') sealPips(ctx, g, ox + ((d.c + d.w / 2) / 30) * CW, oy + (d.r / 17) * CH - (small ? 3 : 5), small);
      if (g.doorOpen(d) || (EXIT_LAYER && EXIT_DOORS.has(d.id))) continue;
      const px = ox + (d.c / 30) * CW, py = oy + (d.r / 17) * CH, w = Math.max(2, (d.w / 30) * CW), h = Math.max(2, (d.h / 17) * CH);
      ctx.fillStyle = '#1a1020'; ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
      ctx.fillStyle = DOOR_COLOR[d.ch] ?? '#b85050'; ctx.fillRect(px, py, w, h);
    }
    for (const th of info.things) {
      const cell = `${Math.floor(th.c / 30)},${Math.floor(th.r / 17)}`;
      if (!seen.has(cell)) continue;
      const px = Math.round(ox + (th.c / 30) * CW), py = Math.round(oy + (th.r / 17) * CH);
      if (th.ch === 'S') {
        const on = lit.includes(r.id), k = small ? 1 : 2, chosen = sel === r.id;
        if (on && !small) { ctx.fillStyle = `rgba(255,200,90,${(0.25 + 0.15 * Math.sin(t * 0.1)).toFixed(2)})`; ctx.beginPath(); ctx.arc(px, py - 2 * k, 7 * k, 0, Math.PI * 2); ctx.fill(); }
        if (chosen) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px - 5 * k, py - 8 * k, 10 * k, 12 * k); }
        ctx.fillStyle = '#1a1020'; ctx.fillRect(px - 2 * k, py - 3 * k, 5 * k, 7 * k);
        ctx.fillStyle = on ? '#f4e6c8' : '#8a8790'; ctx.fillRect(px - k, py - 2 * k, 3 * k, 5 * k);
        ctx.fillStyle = on ? (t % 20 < 10 ? '#ffb43a' : '#ffd86a') : '#5a5860'; ctx.fillRect(px - k + (small ? 0 : 1), py - 5 * k, small ? 3 : 2 * k, 2 * k + 1);
        icons.push({ id: r.id, x: px, y: py - 2 * k, lit: on });
      }
      else if (th.ch === 'C' && !g.flag(`chest:${r.id}:${th.i}`)) {
        // an unopened chest: a little brown box with a gold lid, outlined so it reads on any area colour
        const k = small ? 1 : 2;
        ctx.fillStyle = '#1a1020'; ctx.fillRect(px - 3 * k, py - 3 * k, 6 * k + 1, 5 * k + 1);
        ctx.fillStyle = '#9a5a26'; ctx.fillRect(px - 2 * k, py - 2 * k, 4 * k + 1, 3 * k + 1);
        ctx.fillStyle = '#ffd04a'; ctx.fillRect(px - 2 * k, py - 2 * k, 4 * k + 1, k); ctx.fillRect(px, py - k, k, k);
      }
      else if (th.ch === 'M') { ctx.fillStyle = '#ff9a3c'; ctx.fillRect(px - 1, py - 1, small ? 2 : 3, small ? 2 : 3); }
      else if (th.ch === 'O' && !g.flag(`boss:${r.boss}`)) { ctx.fillStyle = '#1a1020'; ctx.fillRect(px - 3, py - 3, 7, 7); ctx.fillStyle = '#e8484f'; ctx.fillRect(px - 2, py - 2, 5, 5); }
    }
  }
  drawBelfryGuide(ctx, g, seen, CW, CH, ox, oy, t, small, false);
  // the wisp's goal: a small glowing mote where it is leading (Wayra's boat, when the goal is across the water)
  const goal = g.wispOn() ? g.mapGoal() : null;
  if (goal) {
    const gx = Math.round(ox + (goal.x / 480) * CW), gy = Math.round(oy + ((goal.y - 8) / 272) * CH), k = small ? 1 : 2, a = 0.35 + 0.25 * Math.sin(t * 0.15);
    ctx.fillStyle = `rgba(150,240,255,${a.toFixed(2)})`; ctx.fillRect(gx - 2 * k, gy - 2 * k, 4 * k + 1, 4 * k + 1);
    ctx.fillStyle = '#e8fdff'; ctx.fillRect(gx - k, gy - k, 2 * k + 1, 2 * k + 1);
  }
  // you are here: the current room outlined in pulsing gold, and a chinchilla head where the lead really stands
  const room = g.room, pulse = 0.55 + 0.45 * Math.sin(t * 0.12);
  ctx.strokeStyle = '#1a1020'; ctx.lineWidth = small ? 3 : 4;
  ctx.strokeRect(ox + room.gx * CW - 1, oy + room.gy * CH - 1, room.w * CW + 2, room.h * CH + 2);
  ctx.strokeStyle = `rgba(255,214,90,${(0.5 + 0.5 * pulse).toFixed(2)})`; ctx.lineWidth = small ? 1 : 2;
  ctx.strokeRect(ox + room.gx * CW - 1, oy + room.gy * CH - 1, room.w * CW + 2, room.h * CH + 2);
  const b = g.body;
  const hx = Math.round(ox + (b.x / 480) * CW), hy = Math.round(oy + ((b.y - 10) / 272) * CH);
  const fur = t % 40 < 26 ? (g.lead === 'dora' ? '#fff4dc' : '#b4b8c0') : '#ffd65a';
  if (small) {
    ctx.fillStyle = '#1a1020'; ctx.fillRect(hx - 2, hy - 2, 5, 5);
    ctx.fillStyle = fur; ctx.fillRect(hx - 1, hy - 1, 3, 3);
  } else {
    ctx.fillStyle = '#1a1020'; ctx.fillRect(hx - 5, hy - 6, 11, 10); ctx.fillRect(hx - 6, hy - 9, 5, 5); ctx.fillRect(hx + 2, hy - 9, 5, 5);
    ctx.fillStyle = fur; ctx.fillRect(hx - 4, hy - 5, 9, 8); ctx.fillRect(hx - 5, hy - 8, 3, 3); ctx.fillRect(hx + 3, hy - 8, 3, 3);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(hx - 2, hy - 2, 1, 2); ctx.fillRect(hx + 2, hy - 2, 1, 2);
  }
  return icons;
}

/** The pause map. Lit shrines are big candles to tap: a card names the shrine and offers travel. In travel mode
 *  (from the shrine card) the arrow keys or the d-pad step through the lit shrines and Z or A travels. */
function MapCanvas({ g, travelMode, onTravel, navRef }: { g: BellspireGame; travelMode: boolean; onTravel: (id: string) => void; navRef: { current: ((k: 'left' | 'right' | 'ok') => void) | null } }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const icons = useRef<MapIcon[]>([]);
  const lit = g.litShrines();
  const [sel, setSel] = useState<string | null>(travelMode ? (lit.includes(g.room.id) ? g.room.id : lit[0] ?? null) : null);
  const selRef = useRef(sel); selRef.current = sel;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let t = 0, raf = 0;
    const draw = () => { t++; ctx.clearRect(0, 0, cv.width, cv.height); icons.current = drawMap(ctx, g, 26, 16, 8, 8, t, selRef.current, false); raf = requestAnimationFrame(draw); };
    draw();
    // when the map is bigger than its box (phones), scroll it so the heroes sit in the middle
    const box = boxRef.current;
    if (box) {
      const k = cv.clientWidth / cv.width;
      box.scrollLeft = Math.max(0, (8 + (g.body.x / 480) * 26) * k - box.clientWidth / 2);
      box.scrollTop = Math.max(0, (8 + (g.body.y / 272) * 16) * k - box.clientHeight / 2);
    }
    return () => cancelAnimationFrame(raf);
  }, [g]);
  // keys and the d-pad step through the lit shrines; Z or A travels
  useEffect(() => {
    const order = SHRINE_ROOMS.map((r) => r.id).filter((id) => lit.includes(id));
    navRef.current = (k) => {
      if (k === 'ok') { if (selRef.current) onTravel(selRef.current); return; }
      const i = order.indexOf(selRef.current ?? g.room.id), n = order.length;
      if (n) setSel(order[(i + (k === 'right' ? 1 : -1) + n * 2) % n]);
    };
    return () => { navRef.current = null; };
  }, [g, lit.join(), onTravel, navRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current!, r = cv.getBoundingClientRect(), k = cv.width / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    let best: MapIcon | null = null, d = 14;
    for (const ic of icons.current) { const dd = Math.hypot(ic.x - x, ic.y - y); if (dd < d) { d = dd; best = ic; } }
    setSel(best ? best.id : null);
  };
  const room = sel ? ROOMS.find((r) => r.id === sel) : null;
  const why = sel ? g.whyNotTravel(sel) : null;
  return (
    <div className="bs-map-col">
      <div className="bs-map-box" ref={boxRef}><canvas ref={ref} className="bs-map" width={mapScreens(g) * 26 + 16} height={mapRows(g) * 16 + 16} style={{ ['--map-ar' as string]: (mapScreens(g) * 26 + 16) / (mapRows(g) * 16 + 16) }} aria-label="Map of the Bellspire" onClick={tap} /></div>
      {room && (
        <div className="bs-shrine-pick" role="dialog" aria-label={SHRINE_NAMES[room.id]}>
          <b>{lit.includes(room.id) ? SHRINE_NAMES[room.id] : 'Unlit shrine'}</b> <small>{AREAS[room.area].name}</small>
          {room.id === g.room.id ? <em className="bs-here">You are here</em>
            : lit.includes(room.id) ? <button type="button" className="bs-btn bs-small" disabled={!!why} title={why ?? ''} onClick={() => onTravel(room.id)}>Travel here</button>
            : <em className="bs-why">Rest here once to light it.</em>}
          {why && room.id !== g.room.id && lit.includes(room.id) && <em className="bs-why">{why}</em>}
        </div>
      )}
      {travelMode && lit.length < 2 && <p className="bs-why bs-travel-note">Light another shrine to travel.</p>}
      {travelMode && lit.length >= 2 && <p className="bs-small-print">← → choose a lit shrine · Z or X travel · tap a candle · Esc cancels</p>}
    </div>
  );
}

/** On the minimap, once the belfry is known: when Wayra's boat (or, in the belfry, the next area not explored yet, or
 *  the boat back) is past the minimap's edge, a small arrow at that edge points towards it. */
function miniArrow(ctx: CanvasRenderingContext2D, g: BellspireGame, CW: number, CH: number, ox: number, oy: number, t: number) {
  GUIDE.mini.arrow = null;
  const goal = g.mapTarget();
  if (!goal) return;
  const W = ctx.canvas.width, H = ctx.canvas.height, p = mapPt(goal.x, goal.y, CW, CH, ox, oy);
  if (p.x >= 3 && p.y >= 3 && p.x <= W - 3 && p.y <= H - 3) return;
  const dx = p.x - W / 2, dy = p.y - H / 2, s = Math.min(Math.abs(dx) > 0.01 ? (W / 2 - 5) / Math.abs(dx) : 1e9, Math.abs(dy) > 0.01 ? (H / 2 - 5) / Math.abs(dy) : 1e9);
  const x = W / 2 + dx * s, y = H / 2 + dy * s, an = Math.atan2(dy, dx);
  GUIDE.mini.arrow = { kind: goal.kind, area: goal.area, x: Math.round(x), y: Math.round(y), dx: Math.sign(Math.round(dx)), dy: Math.sign(Math.round(dy)) };
  const col = goal.kind === 'boat' ? '#ffcf6a' : AREAS[goal.area as keyof typeof AREAS].color, bob = t % 30 < 15 ? 0 : 1;
  ctx.save(); ctx.translate(x - Math.cos(an) * bob, y - Math.sin(an) * bob); ctx.rotate(an);
  ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(3.5, 0); ctx.lineTo(-2.5, -3.2); ctx.lineTo(-2.5, 3.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/** The HUD minimap: the rooms around the heroes, centred on where they stand. Tap it for the full map. */
function MiniMap({ g, faded, onOpen }: { g: BellspireGame; faded: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let t = 0, raf = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(14,10,22,0.8)'; ctx.fillRect(0, 0, cv.width, cv.height);
      // about 5 by 4 cells, centred on the lead
      const CW = 16, CH = 9, cx = g.body.x / 480, cy = (g.body.y - 10) / 272;
      const ox = Math.round(cv.width / 2 - cx * CW), oy = Math.round(cv.height / 2 - cy * CH);
      drawMap(ctx, g, CW, CH, ox, oy, t, null, true);
      miniArrow(ctx, g, CW, CH, ox, oy, t);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [g]);
  return (
    <button type="button" className={`bs-minimap ${faded ? 'bs-faded' : ''}`} onClick={onOpen} aria-label="Open the map" data-room={g.room.id}>
      <canvas ref={ref} width={84} height={40} />
    </button>
  );
}

export type { GameSettings };
