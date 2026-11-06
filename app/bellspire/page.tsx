'use client';
// The Sunken Bellspire: the page. The title painting, the game canvas (480×270, scaled up by whole numbers where it
// fits) with a slim HTML HUD over its top edge, dialogue with portraits, item and boss banners, and the pause menu
// (Map, Gear, Items, Guide, Settings). Wayra's shop and the murals open as panels. Keyboard (remappable), a gamepad,
// and on touch screens an on-screen pad. Rules in lib/bellspire-game.ts, drawing in lib/bellspire-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellspireGame, parseSave, heroStats, xpToNext, SAVE_KEY, NO_INPUT, ROOMS, AREAS, GEAR, SHOP, FOOD, SPELLS, ABILITIES, ABILITY_ORDER,
  BOSSES, MURALS, NAMES, INFO, COMPLETION, roomAt, VIEW_W, VIEW_H,
  type Input, type Save, type HeroId, type Slot, type FoodId, type GameEvent, type Settings as GameSettings,
} from '@/lib/bellspire-game';
import { BellspireScene } from '@/lib/bellspire-scene';
import { BellspireSound, type Track } from './sound';
import './bellspire.css';

type Screen = 'title' | 'game' | 'ending';
type Tab = 'map' | 'gear' | 'items' | 'guide' | 'settings';
type Action = keyof Input;
type Settings = { sound: boolean; music: boolean; assist: boolean; strict: boolean; shake: boolean; calmFlash: boolean; touch: 'auto' | 'on' | 'off'; keys: Record<Action, string[]> };
const SETTINGS_KEY = 'bellspire-v1-settings';
const ACTIONS: { id: Action; label: string }[] = [
  { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'up', label: 'Up / use' }, { id: 'down', label: 'Down' },
  { id: 'jump', label: 'Jump' }, { id: 'attack', label: 'Attack' }, { id: 'dash', label: 'Dash' }, { id: 'cast', label: 'Spell' }, { id: 'tag', label: 'Tag partner' },
];
const DEFAULT_KEYS: Record<Action, string[]> = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space', 'KeyK'], attack: ['KeyX', 'KeyJ'], dash: ['KeyC', 'KeyL'], cast: ['KeyV', 'KeyI'], tag: ['ShiftLeft', 'ShiftRight', 'Tab'],
};
const DEFAULTS: Settings = { sound: true, music: true, assist: true, strict: false, shake: true, calmFlash: false, touch: 'auto', keys: DEFAULT_KEYS };
const PORTRAIT: Record<string, number> = { dora: 0, enzo: 1, wayra: 2, ukumari: 3, mother: 4 };
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
function readSave(): Save | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

function Icon({ i, size = 2, title }: { i: number; size?: number; title?: string }) {
  return <span className="bs-icon" title={title} style={{ width: 24 * size, height: 24 * size, backgroundSize: `${32 * 24 * size}px ${24 * size}px`, backgroundPosition: `${-i * 24 * size}px 0` }} />;
}
function Portrait({ who, size = 1.5 }: { who: number; size?: number }) {
  return <span className="bs-portrait" style={{ width: 64 * size, height: 64 * size, backgroundSize: `${6 * 64 * size}px ${64 * size}px`, backgroundPosition: `${-who * 64 * size}px 0` }} />;
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
  const [confirmNew, setConfirmNew] = useState(false);
  const [menu, setMenu] = useState<Tab | null>(null);
  const [shop, setShop] = useState(false);
  const [mural, setMural] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ text: string; icon?: number; key: number } | null>(null);
  const [areaBanner, setAreaBanner] = useState<{ text: string; key: number } | null>(null);
  const [ending, setEnding] = useState<{ full: boolean; pct: number } | null>(null);
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
  const lastArea = useRef('');

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const paused = screen !== 'game' || menu !== null || shop || mural !== null;
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ─── start-up ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setHasSave(!!readSave());
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
    soundRef.current = new BellspireSound(s.sound, s.music);
    const scene = new BellspireScene();
    sceneRef.current = scene;
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
    if (g) { g.settings.assist = s.assist && !s.strict; g.settings.strict = s.strict; }
    if (sceneRef.current) { sceneRef.current.shakeOn = s.shake; sceneRef.current.reduceFlash = s.calmFlash; }
  };
  const writeSave = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.snapshot())); setHasSave(true); } catch { /* storage may be blocked */ }
  }, []);

  const startGame = (save: Save | null) => {
    const s = settingsRef.current;
    const g = new BellspireGame(save, { assist: s.assist && !s.strict, strict: s.strict }, (Date.now() % 100000) + 1);
    gameRef.current = g;
    if (sceneRef.current) { sceneRef.current.roomId = ''; sceneRef.current.shakeOn = s.shake; sceneRef.current.reduceFlash = s.calmFlash; }
    lastArea.current = '';
    setMenu(null); setShop(false); setMural(null); setEnding(null); setConfirmNew(false);
    setScreen('game');
    if (!save) writeSave();
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
      else if (e.k === 'mural') setMural(e.n);
      else if (e.k === 'item') setBanner({ text: e.text, icon: e.icon, key: Date.now() });
      else if (e.k === 'room') writeSave();
      else if (e.k === 'ending') { writeSave(); setEnding({ full: e.full, pct: g.completion().pct }); setScreen('ending'); snd?.setTrack('ending'); }
      else if (e.k === 'down') snd?.play('down');
    }
  }, [writeSave]);

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
        if (shop) setShop(false);
        else if (mural !== null) setMural(null);
        else if (equipPick) setEquipPick(null);
        else setMenu((m) => (m ? null : 'map'));
        soundRef.current?.play('menu');
        return;
      }
      if (screen === 'game' && (mural !== null || shop) && (e.code === settingsRef.current.keys.jump[0] || e.code === 'Space')) { e.preventDefault(); setMural(null); return; }
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
  }, [screen, shop, mural, rebind, equipPick]); // eslint-disable-line react-hooks/exhaustive-deps

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
        game: g, scene: sceneRef.current, screen, menu, shop, mural,
        state: g ? { room: g.room.id, area: g.room.area, lead: g.lead, x: g.body.x, y: g.body.y, ground: g.body.ground, swim: g.body.swim, coins: g.save.coins, abilities: [...g.save.abilities], water: { ...g.save.water }, dialog: !!g.dialog, toast: g.toast?.text ?? null, boss: g.boss ? { id: g.boss.id, hp: g.boss.hp, st: g.boss.st } : null, heroes: JSON.parse(JSON.stringify(g.save.heroes)), lantern: g.lanternUp, completion: g.completion() } : null,
        teleport: (room: string, c: number, r: number) => g?.teleport(room, c, r),
        give: (a: (typeof ABILITY_ORDER)[number]) => g?.giveAbility(a, false),
        setWater: (a: 'halls' | 'docks' | 'throne', l: 0 | 1) => g?.setWater(a, l),
        fightBoss: (id: keyof typeof BOSSES) => g?.fightBoss(id),
        unlockMap: () => g?.unlockMap(),
        setHp: (h: HeroId, hp: number) => g?.setHp(h, hp),
        skipDialog: () => { if (g) g.dialog = null; },
        coins: (n: number) => { if (g) g.save.coins = n; },
      };
    };
  }, [screen, menu, shop, mural]);

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

  // ─── the screens ─────────────────────────────────────────────────────────
  if (screen === 'title') {
    return (
      <main className="bs-shell bs-title" data-ready={ready ? 'true' : 'false'}>
        <div className="bs-title-art" />
        <div className="bs-title-panel">
          <h1 className="bs-logo"><span>The Sunken</span> Bellspire</h1>
          <p className="bs-tag">A citadel of bells sleeps under a high Andean lake. Dora and Enzo row out with one lantern.</p>
          <div className="bs-title-btns">
            {hasSave && <button type="button" className="bs-btn bs-btn-main" onClick={() => startGame(readSave())}>Continue</button>}
            <button type="button" className={`bs-btn ${hasSave ? '' : 'bs-btn-main'}`} onClick={() => (hasSave ? setConfirmNew(true) : startGame(null))}>New game</button>
            <button type="button" className="bs-btn" onClick={() => { setMenu('settings'); }}>Settings</button>
            <a className="bs-btn bs-btn-ghost" href="/">← Arcade</a>
          </div>
          {confirmNew && (
            <div className="bs-confirm" role="dialog">
              <p>Start again from the beginning? The saved game will be replaced.</p>
              <button type="button" className="bs-btn bs-btn-main" onClick={() => startGame(null)}>Yes, start again</button>
              <button type="button" className="bs-btn" onClick={() => setConfirmNew(false)}>Keep my save</button>
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
    return (
      <main className="bs-shell bs-end" data-ready="true">
        <div className={`bs-end-art ${ending.full ? 'bs-end-full' : ''}`} />
        <div className="bs-end-panel">
          <h2>The bells ring again</h2>
          <p>The Lake Mother is calm, the water settles, and every bell in the Bellspire rings at once. Ukumari can rest at last.</p>
          <p className="bs-end-stats">Explored {c.pct}% · {c.chests}/{COMPLETION.chests} chests · {c.murals}/{COMPLETION.murals} murals · Dora level {g.save.heroes.dora.level} · Enzo level {g.save.heroes.enzo.level} · {formatTime(g.save.time)}</p>
          {ending.full ? <p className="bs-end-epi">Everything found! Turn the page for the epilogue: a picnic on the shore with Wayra, Ukumari and the Lake Mother.</p> : <p>Find everything (100%) to see the epilogue. Your save is kept, so you can keep exploring.</p>}
          <div className="bs-title-btns">
            <button type="button" className="bs-btn bs-btn-main" onClick={() => { const s = readSave(); if (s) { s.flags = s.flags.filter((f) => f !== 'ending'); startGame(s); } }}>Keep exploring</button>
            <button type="button" className="bs-btn" onClick={() => setScreen('title')}>Title</button>
          </div>
        </div>
      </main>
    );
  }

  const lead = g?.lead ?? 'dora';
  const boss = g?.boss && g.boss.st !== 'wait' ? g.boss : null;
  const dialog = g?.dialog;
  const line = dialog ? dialog.lines[dialog.i] : null;
  const hint = g && !dialog ? g.nearbyLabel() : null;

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
              <button type="button" className="bs-menu-btn" onClick={() => setMenu('map')} aria-label="Menu">☰</button>
            </div>
          )}
          {boss && <div className="bs-boss"><b>{BOSSES[boss.id].name}</b><small>{BOSSES[boss.id].title}</small><Bar v={boss.hp} max={boss.max} kind="boss" /></div>}
          {g?.toast && !dialog && <div className="bs-toast" key={g.toast.text}>{g.toast.text}</div>}
          {hint && !g?.toast && <div className="bs-hint">↑ {hint}</div>}
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
        <div className="bs-modal" onClick={(e) => { if (e.target === e.currentTarget) setMenu(null); }}>
          <div className="bs-sheet bs-menu">
            <nav className="bs-tabs" role="tablist">
              {(['map', 'gear', 'items', 'guide', 'settings'] as Tab[]).map((t) => (
                <button type="button" key={t} role="tab" aria-selected={menu === t} className={menu === t ? 'on' : ''} onClick={() => { setMenu(t); setEquipPick(null); setMsg(null); soundRef.current?.play('menu'); }}>
                  {{ map: 'Map', gear: 'Gear', items: 'Items', guide: 'Guide', settings: 'Settings' }[t]}
                </button>
              ))}
              <button type="button" className="bs-tab-close" onClick={() => setMenu(null)} aria-label="Close menu">✕</button>
            </nav>
            <div className="bs-tab-body">
              {menu === 'map' && mapPanel(g)}
              {menu === 'gear' && gearPanel(g)}
              {menu === 'items' && itemsPanel(g)}
              {menu === 'guide' && guidePanel(g)}
              {menu === 'settings' && <>{settingsPanel()}<div className="bs-row"><button type="button" className="bs-btn" onClick={() => { writeSave(); setMenu(null); setScreen('title'); }}>Save and quit to title</button></div></>}
            </div>
            {msg && <p className="bs-msg" role="status">{msg}</p>}
          </div>
        </div>
      )}

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

      {mural !== null && (
        <div className="bs-modal" onClick={() => setMural(null)}>
          <div className="bs-sheet bs-mural">
            <span className="bs-mural-art" style={{ backgroundPosition: `${MURALS[mural].panel * 20}% 0` }} />
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
    const toggle = (k: 'sound' | 'music' | 'assist' | 'strict' | 'shake' | 'calmFlash', label: string, help: string) => (
      <label className="bs-toggle"><input type="checkbox" checked={s[k]} onChange={(e) => saveSettings({ ...s, [k]: e.target.checked, ...(k === 'strict' && e.target.checked ? { assist: false } : {}), ...(k === 'assist' && e.target.checked ? { strict: false } : {}) })} /><span><b>{label}</b><small>{help}</small></span></label>
    );
    return (
      <div className="bs-settings">
        <h3>Settings</h3>
        {toggle('sound', 'Sound effects', 'Swords, bells, splashes.')}
        {toggle('music', 'Music', 'A tune for every part of the citadel.')}
        {toggle('assist', 'Helping hand', 'On: less damage, slower boss attacks with longer warnings, healing near shrines, and a little wisp that shows the way if you stop for a while.')}
        {toggle('strict', 'Strict mode', 'For experts: full damage, tighter jumps, and travel only from shrines. Turns the helping hand off.')}
        {toggle('shake', 'Screen shake', 'The screen shakes on big hits.')}
        {toggle('calmFlash', 'Calmer flashes', 'No full-screen flashes.')}
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
    const c = g.completion();
    const shrines = g.litShrines();
    return (
      <div className="bs-map-wrap">
        <MapCanvas g={g} />
        <div className="bs-map-side">
          <p className="bs-pct">{c.pct}% explored</p>
          <p className="bs-small-print">{c.cells}/{COMPLETION.cells} rooms · {c.chests}/{COMPLETION.chests} chests · {c.murals}/{COMPLETION.murals} murals · {c.bosses}/{COMPLETION.bosses} guardians</p>
          <h4>Travel between shrines</h4>
          <ul className="bs-travel">
            {ROOMS.filter((r) => INFO.get(r.id)!.things.some((t) => t.ch === 'S')).map((r) => {
              const lit = shrines.includes(r.id);
              return (
                <li key={r.id}>
                  <button type="button" className="bs-btn bs-small" disabled={!lit || r.id === g.room.id} onClick={() => { const why = g.travel(r.id); if (why) setMsg(why); else { onEvents(g.drainEvents()); setMenu(null); } }}>
                    {lit ? `${AREAS[r.area].name}` : 'Unlit shrine'}
                  </button>
                  {!lit && <em className="bs-why">Rest at it once to light it.</em>}
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
              <header><Portrait who={PORTRAIT[h]} size={0.9} /><div><b>{heroName(h)}</b> <small>Level {s.level}</small><Bar v={s.xp} max={xpToNext(s.level)} kind="xp" /><small>{s.xp}/{xpToNext(s.level)} XP</small></div></header>
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
                return (
                  <li key={id}>
                    <Icon i={it.icon} size={1.5} />
                    <span className="bs-li-text"><b>{it.name}</b><small>{statLine(it)} {it.text}{other ? ` (${heroName(equipPick.hero === 'dora' ? 'enzo' : 'dora')} is using it.)` : ''}</small></span>
                    <button type="button" className="bs-btn bs-small" disabled={!!wrong || worn} title={wrong ? `Only ${heroName(it.hero!)} can use it.` : ''} onClick={() => { const r = g.equip(equipPick.hero, equipPick.slot, id); setMsg(r ?? `${heroName(equipPick.hero)} equipped the ${it.name}.`); onEvents(g.drainEvents()); setFrame((f) => f + 1); }}>{worn ? 'Worn' : 'Equip'}</button>
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
              <Icon i={24 + i} size={1.5} />
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

function statLine(it: { atk?: number; def?: number; mag?: number; hp?: number; mp?: number }) {
  const p: string[] = [];
  if (it.atk) p.push(`Atk +${it.atk}`); if (it.def) p.push(`Def +${it.def}`); if (it.mag) p.push(`Mag +${it.mag}`); if (it.hp) p.push(`HP +${it.hp}`); if (it.mp) p.push(`MP +${it.mp}`);
  return p.length ? `${p.join(', ')}.` : '';
}
function formatTime(s: number) { const m = Math.floor(s / 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }

/** The pause map: every room you have seen, coloured by area, with shrines, chests and the heroes. */
function MapCanvas({ g }: { g: BellspireGame }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const CW = 26, CH = 16, ox = 8, oy = 8;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const seen = new Set(g.save.seen);
    let t = 0;
    let raf = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const r of ROOMS) {
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
          const key = `${r.gx + x},${r.gy + y}`;
          if (!seen.has(key)) continue;
          const px = ox + (r.gx + x) * CW, py = oy + (r.gy + y) * CH;
          ctx.fillStyle = AREAS[r.area].color; ctx.globalAlpha = 0.85; ctx.fillRect(px, py, CW, CH); ctx.globalAlpha = 1;
          // join cells of the same room
          ctx.fillStyle = '#2a1a1a';
          if (x === 0) ctx.fillRect(px, py, 2, CH);
          if (x === r.w - 1) ctx.fillRect(px + CW - 2, py, 2, CH);
          if (y === 0) ctx.fillRect(px, py, CW, 2);
          if (y === r.h - 1) ctx.fillRect(px, py + CH - 2, CW, 2);
        }
        if (!r.rows.length) continue;
        const info = INFO.get(r.id)!;
        if (!seen.has(`${r.gx},${r.gy}`) && !info.things.some((th) => seen.has(`${Math.floor(th.c / 30)},${Math.floor(th.r / 17)}`))) continue;
        for (const th of info.things) {
          const cell = `${Math.floor(th.c / 30)},${Math.floor(th.r / 17)}`;
          if (!seen.has(cell)) continue;
          const px = ox + (th.c / 30) * CW, py = oy + (th.r / 17) * CH;
          if (th.ch === 'S') { ctx.fillStyle = '#ffcf6a'; ctx.fillRect(px - 2, py - 3, 5, 5); ctx.fillStyle = '#7a3a10'; ctx.fillRect(px - 1, py - 2, 3, 3); }
          else if (th.ch === 'C' && !g.flag(`chest:${r.id}:${th.i}`)) { ctx.fillStyle = '#fff2b0'; ctx.fillRect(px - 1, py - 1, 3, 3); }
          else if (th.ch === 'M') { ctx.fillStyle = '#ff9a3c'; ctx.fillRect(px - 1, py - 1, 3, 3); }
          else if (th.ch === 'O' && !g.flag(`boss:${r.boss}`)) { ctx.fillStyle = '#e8484f'; ctx.fillRect(px - 2, py - 2, 5, 5); }
        }
      }
      // you are here: the current room outlined in pulsing gold, and a blinking chinchilla head where the lead stands
      const room = g.room, pulse = 0.55 + 0.45 * Math.sin(t * 0.12);
      ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 4;
      ctx.strokeRect(ox + room.gx * CW - 1, oy + room.gy * CH - 1, room.w * CW + 2, room.h * CH + 2);
      ctx.strokeStyle = `rgba(255,214,90,${(0.5 + 0.5 * pulse).toFixed(2)})`; ctx.lineWidth = 2;
      ctx.strokeRect(ox + room.gx * CW - 1, oy + room.gy * CH - 1, room.w * CW + 2, room.h * CH + 2);
      const b = g.body;
      const hx = Math.round(ox + (b.x / 480) * CW), hy = Math.round(oy + ((b.y - 10) / 272) * CH);
      {
        // it blinks between bright and soft, never off, so it can always be found
        const fur = t % 40 < 26 ? (g.lead === 'dora' ? '#fff4dc' : '#b4b8c0') : '#ffd65a';
        ctx.fillStyle = '#1a1020'; ctx.fillRect(hx - 5, hy - 6, 11, 10); ctx.fillRect(hx - 6, hy - 9, 5, 5); ctx.fillRect(hx + 2, hy - 9, 5, 5);
        ctx.fillStyle = fur; ctx.fillRect(hx - 4, hy - 5, 9, 8); ctx.fillRect(hx - 5, hy - 8, 3, 3); ctx.fillRect(hx + 3, hy - 8, 3, 3);
        ctx.fillStyle = '#1a1020'; ctx.fillRect(hx - 2, hy - 2, 1, 2); ctx.fillRect(hx + 2, hy - 2, 1, 2);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    // when the map is bigger than its box (phones), scroll it so the heroes sit in the middle
    const box = boxRef.current;
    if (box) {
      const k = cv.clientWidth / cv.width;
      box.scrollLeft = Math.max(0, (ox + (g.body.x / 480) * CW) * k - box.clientWidth / 2);
      box.scrollTop = Math.max(0, (oy + (g.body.y / 272) * CH) * k - box.clientHeight / 2);
    }
    return () => cancelAnimationFrame(raf);
  }, [g]);
  void roomAt;
  return <div className="bs-map-box" ref={boxRef}><canvas ref={ref} className="bs-map" width={12 * 26 + 16} height={9 * 16 + 16} aria-label="Map of the Bellspire" /></div>;
}

export type { GameSettings };
