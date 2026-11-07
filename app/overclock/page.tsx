'use client';
// Overclock: the page. The title, the rooftop hub (stage select, Pip's shop, the capsule map, training, settings), the
// game canvas (384×216, scaled up by whole pixels where it fits) with a slim HTML HUD, the pause menu (tanks, powers,
// retreat), the core-get screen and the ending. Keyboard (remappable), a gamepad, and an on-screen pad on touch
// screens. Rules in lib/overclock-game.ts, drawing in lib/overclock-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  OverclockGame, parseSave, freshSave, SAVE_KEY, NO_INPUT, VIEW_W, VIEW_H, NAME, POWERS, POWER, CHIPS, CHIP_SLOTS, ITEM_NAME, ITEM_TEXT,
  STAGES, BOSS_STAGES, CORE_BOSSES, BOSS_NAME, MINI_NAME, CHANGES, stageOpen, lockedWhy, weakHint, buyChip, toggleChip, completion, itemMap,
  heartCount, tankCount, maxHp, cores, powersOf, hasArmour, bossBox,
  type Input, type Save, type GameEvent, type HeroId, type ChipId, type PowerId,
} from '@/lib/overclock-game';
import type { StageId, CoreBoss, BossId } from '@/lib/overclock-world';
import { OverclockScene, AREA_GLOW } from '@/lib/overclock-scene';
import { HAVE } from '@/lib/overclock-art';
import { OverclockSound, type Track } from './sound';
import './overclock.css';

type Screen = 'title' | 'hub' | 'game' | 'core' | 'ending';
type HubTab = 'stages' | 'shop' | 'map' | 'settings';
type Action = keyof Input;
type Settings = { sound: boolean; music: boolean; assist: boolean; shake: boolean; hitboxes: boolean; touch: 'auto' | 'on' | 'off'; keys: Record<Action, string[]> };
const SETTINGS_KEY = 'overclock-v1-settings';
const ACTIONS: { id: Action; label: string }[] = [
  { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'up', label: 'Up / climb' }, { id: 'down', label: 'Down' },
  { id: 'jump', label: 'Jump' }, { id: 'shoot', label: 'Shoot (hold to charge)' }, { id: 'dash', label: 'Dash' }, { id: 'tag', label: 'Tag partner' },
  { id: 'shield', label: 'Shield (Enzo)' }, { id: 'prev', label: 'Power back' }, { id: 'next', label: 'Power on' },
];
const DEFAULT_KEYS: Record<Action, string[]> = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space', 'KeyK'], shoot: ['KeyX', 'KeyJ'], dash: ['KeyC', 'KeyL'], tag: ['ShiftLeft', 'ShiftRight', 'Tab'],
  shield: ['KeyV', 'KeyI'], prev: ['KeyQ'], next: ['KeyE'],
};
const DEFAULTS: Settings = { sound: true, music: true, assist: true, shake: true, hitboxes: false, touch: 'auto', keys: DEFAULT_KEYS };
// the stage select's frames (the strip public/art/overclock/select.webp): eight bosses round the heroes
const GRID: (CoreBoss | 'heroes')[] = ['crab', 'chameleon', 'mole', 'peacock', 'heroes', 'heron', 'rhino', 'owl', 'firefly'];
const STAGE_OF_BOSS: Record<CoreBoss, StageId> = { crab: 'port', chameleon: 'signs', mole: 'depot', peacock: 'arcade', heron: 'highway', rhino: 'scrap', owl: 'observatory', firefly: 'plant' };
const PORTRAIT = { doraSmile: 0, doraSet: 1, enzoSmile: 2, enzoSet: 3, pip: 4, pipLaugh: 5, lumenShy: 6, lumenHappy: 7 };
/** a painting, or a stand-in while it's still being painted */
const paint = (name: string, alt: string) => ({ backgroundImage: `url(/art/overclock/${HAVE.includes(name) ? name : alt}.webp)` });
const keyName = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Shift').replace('Space', 'Space');

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null;
    if (!s || typeof s !== 'object') return DEFAULTS;
    const keys = { ...DEFAULT_KEYS };
    if (s.keys) for (const a of ACTIONS) if (Array.isArray(s.keys[a.id]) && s.keys[a.id].every((k) => typeof k === 'string') && s.keys[a.id].length) keys[a.id] = s.keys[a.id];
    return { ...DEFAULTS, ...s, keys, touch: s.touch === 'on' || s.touch === 'off' ? s.touch : 'auto' };
  } catch { return DEFAULTS; }
}
function readSave(): Save | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

function Portrait({ who, size = 64, flip = false }: { who: number; size?: number; flip?: boolean }) {
  return <span className="oc-portrait" style={{ width: size, height: size, backgroundSize: `${8 * size}px ${size}px`, backgroundPosition: `${-who * size}px 0`, transform: flip ? 'scaleX(-1)' : undefined }} />;
}
function Icon({ strip, i, size = 24 }: { strip: 'icons' | 'parts' | 'cores'; i: number; size?: number }) {
  return <span className="oc-icon" style={{ width: size, height: size, backgroundImage: `url(/art/overclock/${strip}.webp)`, backgroundSize: `${8 * size}px ${size}px`, backgroundPosition: `${-i * size}px 0` }} />;
}
function Bar({ v, max, kind }: { v: number; max: number; kind: 'hp' | 'en' | 'boss' }) {
  return <span className={`oc-bar oc-bar-${kind}`}><span style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%` }} /></span>;
}
const itemIcon = (kind: string): ['icons' | 'parts', number] => kind === 'heart' ? ['icons', 4] : kind === 'tank' ? ['icons', 5] : ['parts', ['helmet', 'legs', 'body', 'arm'].indexOf(kind)];

export default function OverclockPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<OverclockGame | null>(null);
  const sceneRef = useRef<OverclockScene | null>(null);
  const soundRef = useRef<OverclockSound | null>(null);
  const held = useRef<Record<Action, boolean>>({ ...NO_INPUT });
  const touchHeld = useRef<Record<Action, boolean>>({ ...NO_INPUT });
  const taps = useRef<Set<Action>>(new Set());
  const [screen, setScreen] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [save, setSave] = useState<Save>(freshSave());
  const saveRef = useRef(save);
  const [hasSave, setHasSave] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [tab, setTab] = useState<HubTab>('stages');
  const [pick, setPick] = useState<StageId | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number } | null>(null);
  const [coreGot, setCoreGot] = useState<CoreBoss | null>(null);
  const [hudTick, setHudTick] = useState(0);
  const [rebind, setRebind] = useState<Action | null>(null);
  const [view, setView] = useState({ css: 2, portrait: false });
  const [touchOn, setTouchOn] = useState(false);
  const [pipLine, setPipLine] = useState<string | null>(null);
  const toastId = useRef(1);

  useEffect(() => { settingsRef.current = settings; if (sceneRef.current) { sceneRef.current.shakeOn = settings.shake; sceneRef.current.debug = settings.hitboxes; } }, [settings]);
  useEffect(() => { saveRef.current = save; }, [save]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // ─── start-up ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    const sv = readSave();
    if (sv) { setSave(sv); setHasSave(true); }
    soundRef.current = new OverclockSound(s.sound, s.music);
    const scene = new OverclockScene();
    sceneRef.current = scene;
    scene.shakeOn = s.shake; scene.debug = s.hitboxes;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    setTouchOn(s.touch === 'on' || (s.touch === 'auto' && coarse));
    void scene.load().then(() => setReady(true));
    const unlock = () => soundRef.current?.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, []);
  useEffect(() => { const s = settings; setTouchOn(s.touch === 'on' || (s.touch === 'auto' && (window.matchMedia?.('(pointer: coarse)').matches ?? false))); }, [settings]);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
    soundRef.current?.setSound(s.sound); soundRef.current?.setMusic(s.music);
  }, []);
  const writeSave = useCallback((s: Save) => {
    const copy = JSON.parse(JSON.stringify(s)) as Save;
    setSave(copy); saveRef.current = copy; setHasSave(true);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(copy)); } catch { /* private mode */ }
  }, []);
  const toast = useCallback((text: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  // ─── starting and leaving a stage ────────────────────────────────────────
  const startStage = useCallback((id: StageId) => {
    const s = saveRef.current;
    // on assist the energy tanks refill whenever the heroes set out
    const sv: Save = { ...s, tanks: s.tanks };
    if (settingsRef.current.assist) sv.tanks = tankCount(s);
    const g = new OverclockGame(sv, id, { assist: settingsRef.current.assist }, (Date.now() % 100000) + 1);
    gameRef.current = g;
    held.current = { ...NO_INPUT }; taps.current.clear();
    setPaused(false); setToasts([]); setCoreGot(null);
    const st = STAGES[id];
    setBanner({ text: st.name, sub: st.boss && id !== 'training' ? `Boss: ${BOSS_NAME[st.boss]}` : id === 'training' ? 'Practise anything. Leave from the pause menu.' : '', key: Date.now() });
    setScreen('game');
    soundRef.current?.play('teleport');
  }, []);
  const toHub = useCallback(() => { gameRef.current = null; setPaused(false); setScreen('hub'); setTab('stages'); }, []);

  const onEvents = useCallback((ev: GameEvent[]) => {
    const g = gameRef.current;
    for (const e of ev) {
      if (e.k === 'sfx') soundRef.current?.play(e.id);
      else if (e.k === 'toast') toast(e.text);
      else if (e.k === 'item') { toast(`${ITEM_NAME[e.kind] ?? 'Capsule'}! ${ITEM_TEXT[e.kind] ?? ''}`); if (g) writeSave(g.save); soundRef.current?.play('capsule'); }
      else if (e.k === 'save' && g) writeSave(g.save);
      else if (e.k === 'boss') setBanner({ text: BOSS_NAME[e.id], sub: weakText(saveRef.current, e.id), key: Date.now() });
      else if (e.k === 'miniOn') setBanner({ text: MINI_NAME[e.kind] ?? 'Mini-boss', sub: 'Mini-boss', key: Date.now() });
      else if (e.k === 'tag') { /* the HUD shows it */ }
      else if (e.k === 'done' && g) {
        writeSave(g.save);
        const b = g.stage.boss;
        if (g.save.ending && b === 'lumen') { gameRef.current = null; setScreen('ending'); }
        else if (b && (CORE_BOSSES as string[]).includes(b)) { gameRef.current = null; setCoreGot(b as CoreBoss); setScreen('core'); }
        else if (g.stage.id === 'intro') { gameRef.current = null; setPipLine('Nice landing, you two! I’m Pip. Eight of the city’s robots have gone haywire: pick one, reboot it, and its core powers you both up. Bring me bolts and I’ll fit mod chips.'); toHub(); }
        else toHub();
      }
    }
  }, [toast, writeSave, toHub]);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  // ─── no text over faces: a banner or toast that a hero or the boss moves behind fades right down ─────
  const clearFaces = (g: OverclockGame, scene: OverclockScene, cv: HTMLCanvasElement) => {
    const r = cv.getBoundingClientRect(), k = r.width / VIEW_W, cx = Math.round(scene.camX), cy = Math.round(scene.camY);
    const b = g.body, f2 = g.follower(), faces = [{ x: b.x - 52, y: b.y - 64, w: 104, h: 64 }];
    if (f2) faces.push({ x: f2.x - 28, y: f2.y - 64, w: 56, h: 64 });
    if (g.boss && !g.boss.hidden) faces.push(bossBox(g.boss, g.tick));
    const onScreen = faces.map((f) => ({ l: r.left + (f.x - cx) * k, t: r.top + (f.y - cy) * k, r: r.left + (f.x + f.w - cx) * k, b: r.top + (f.y + f.h - cy) * k }));
    for (const el of document.querySelectorAll<HTMLElement>('.oc-banner, .oc-toast')) {
      const e = el.getBoundingClientRect();
      el.classList.toggle('oc-over-face', onScreen.some((f) => f.l < e.right && f.r > e.left && f.t < e.bottom && f.b > e.top));
    }
  };

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
        onEventsRef.current(ev);
        if (gameRef.current !== g) return;
      }
      const k = settingsRef.current.keys;
      scene.keys = { move: `${keyName(k.left[0])} ${keyName(k.right[0])}`, jump: keyName(k.jump[0]), shoot: keyName(k.shoot[0]), dash: keyName(k.dash[0]), climb: keyName(k.up[0]), tag: keyName(k.tag[0]), charge: `hold ${keyName(k.shoot[0])}` };
      scene.touch = touchOn;
      scene.draw(g);
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scene.view, 0, 0);
      const fighting = g.boss && g.boss.st !== 'calm';
      soundRef.current?.setTrack((fighting ? (g.boss!.id === 'lumen' ? 'lumen' : 'boss') : g.stage.area) as Track);
      if (++frames % 5 === 0) { setHudTick((f) => f + 1); clearFaces(g, scene, cv); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, ready, touchOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen === 'title') soundRef.current?.setTrack('title');
    else if (screen === 'hub' || screen === 'core') soundRef.current?.setTrack('hub');
    else if (screen === 'ending') soundRef.current?.setTrack('ending');
  }, [screen]);

  // ─── keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (rebind) {
        e.preventDefault();
        if (e.code !== 'Escape') {
          const s = settingsRef.current, keys = { ...s.keys };
          for (const a of ACTIONS) keys[a.id] = keys[a.id].filter((k) => k !== e.code);
          keys[rebind] = [e.code, ...keys[rebind].filter((k) => k !== e.code)].slice(0, 3);
          for (const a of ACTIONS) if (!keys[a.id].length) keys[a.id] = DEFAULT_KEYS[a.id];
          saveSettings({ ...s, keys });
        }
        setRebind(null);
        return;
      }
      if (screenRef.current === 'game' && (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter')) {
        e.preventDefault(); setPaused((p) => !p); soundRef.current?.play('menu'); return;
      }
      for (const a of ACTIONS) if (settingsRef.current.keys[a.id].includes(e.code)) {
        if (screenRef.current === 'game') e.preventDefault();
        if (!held.current[a.id]) taps.current.add(a.id);
        held.current[a.id] = true;
      }
    };
    const up = (e: KeyboardEvent) => { for (const a of ACTIONS) if (settingsRef.current.keys[a.id].includes(e.code)) held.current[a.id] = false; };
    const blur = () => { for (const a of ACTIONS) held.current[a.id] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [rebind, saveSettings]);

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
      out.jump ||= b(0); out.shoot ||= b(2); out.dash ||= b(1) || b(7); out.shield ||= b(3); out.tag ||= b(6);
      out.prev ||= b(4); out.next ||= b(5);
      const start = b(9);
      if (start && !padPrev.current) setPaused((x) => !x);
      padPrev.current = start;
    }
    return out;
  };

  // ─── fitting the canvas: whole-number scales where they fit ─────────────
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const dpr = window.devicePixelRatio || 1;
      const portrait = window.innerHeight > window.innerWidth * 1.1;
      // upright: the picture fills the screen's width (the pad sits right under it)
      if (portrait) { const css = window.innerWidth / VIEW_W; setView((v) => (v.css === css && v.portrait ? v : { css, portrait: true })); return; }
      const w = el.clientWidth, h = el.clientHeight;
      const W = w * dpr, H = h * dpr;
      let s = Math.floor(Math.min(W / VIEW_W, H / VIEW_H));
      if (s < 2) s = Math.min(W / VIEW_W, H / VIEW_H);
      setView((v) => (v.css === s / dpr && v.portrait === portrait ? v : { css: s / dpr, portrait }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [screen]);

  // ─── debug hook for the browser tests ────────────────────────────────────
  useEffect(() => {
    (window as unknown as { __overclock: () => unknown }).__overclock = () => {
      const g = gameRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, raw: g,
        game: g ? { stage: g.stage.id, mode: g.mode, x: g.body.x, y: g.body.y, pose: g.pose.st, lead: g.lead, hud: g.hud(), foes: g.foes.filter((e) => e.alive).length, shots: g.shots.length, tick: g.tick, ground: g.body.ground, cling: g.body.cling, riding: g.riding } : null,
        start: (id: StageId) => startStage(id),
        hub: () => toHub(),
        teleport: (x: number, y: number) => gameRef.current?.teleport(x, y),
        toCheckpoint: (i: number) => gameRef.current?.toCheckpoint(i),
        fight: () => gameRef.current?.fightBoss(),
        invuln: (on: boolean) => { if (gameRef.current) gameRef.current.invuln = on; },
        setHp: (n: number) => { const g2 = gameRef.current; if (g2) g2.heroes[g2.lead].hp = n; },
        bossHp: (n: number) => { const g2 = gameRef.current; if (g2?.boss) g2.boss.hp = n; },
        give: (what: string) => {
          const s = JSON.parse(JSON.stringify(saveRef.current)) as Save;
          s.intro = true;
          if (what === 'cores') { for (const b of CORE_BOSSES) if (!s.beaten.includes(b)) s.beaten.push(b); }
          else if ((CORE_BOSSES as string[]).includes(what) || what === 'spider' || what === 'serpent') { if (!s.beaten.includes(what as BossId)) s.beaten.push(what as BossId); }
          else if (what === 'bolts') s.bolts += 500;
          else if (what === 'all') { for (const id of BOSS_STAGES) for (const it of STAGES[id].items) if (!s.items.includes(it.id)) s.items.push(it.id); s.tanks = tankCount(s); }
          writeSave(s);
          if (gameRef.current) gameRef.current.save = { ...gameRef.current.save, beaten: s.beaten, items: s.items, bolts: s.bolts, tanks: s.tanks };
        },
        state: () => (gameRef.current ? { x: gameRef.current.body.x, y: gameRef.current.body.y, mode: gameRef.current.mode } : null),
      };
    };
  }, [startStage, toHub, writeSave]);

  // ─── screens ─────────────────────────────────────────────────────────────
  const newGame = () => { const s = freshSave(); writeSave(s); setConfirmNew(false); startStage('intro'); };
  const cont = () => { if (!saveRef.current.intro) startStage('intro'); else setScreen('hub'); };

  if (screen === 'title') {
    return (
      <main className="oc-shell oc-title" data-ready={ready ? 'true' : 'false'}>
        <div className="oc-title-art" aria-hidden="true" style={paint('title', 'bg-roof')} />
        <div className="oc-title-panel">
          <h1 className="oc-logo">OVERCLOCK<span>Dora &amp; Enzo in the neon city</span></h1>
          <p className="oc-tag">Run, jump, dash and blast across eight stages of a city whose robots have gone haywire. Reboot each boss to earn its core: every core gives Dora one power and Enzo another.</p>
          <div className="oc-title-btns">
            {hasSave ? <button className="oc-btn oc-btn-main" onClick={cont} autoFocus>Continue</button> : <button className="oc-btn oc-btn-main" onClick={newGame} autoFocus>New game</button>}
            {hasSave && <button className="oc-btn" onClick={() => setConfirmNew(true)}>New game</button>}
            <a className="oc-btn oc-btn-ghost" href="/">Arcade</a>
          </div>
          {confirmNew && (
            <div className="oc-confirm"><p>Start over? This save will be replaced.</p>
              <button className="oc-btn oc-small" onClick={newGame}>Yes, start over</button>
              <button className="oc-btn oc-small oc-btn-ghost" onClick={() => setConfirmNew(false)}>Keep my save</button></div>
          )}
          <p className="oc-controls-hint">Arrows move · {keyName(settings.keys.jump[0])} jump · {keyName(settings.keys.shoot[0])} shoot (hold to charge) · {keyName(settings.keys.dash[0])} dash · {keyName(settings.keys.tag[0])} tag · Esc pause. Assist mode is on: change it in the hub’s settings.</p>
        </div>
      </main>
    );
  }

  if (screen === 'core' && coreGot) {
    const d = POWERS.find((p) => p.core === coreGot && p.hero === 'dora')!, e = POWERS.find((p) => p.core === coreGot && p.hero === 'enzo')!;
    return (
      <main className="oc-shell oc-core" data-ready="true">
        <div className="oc-core-panel">
          <div className="oc-core-head"><Icon strip="cores" i={CORE_BOSSES.indexOf(coreGot)} size={48} /><div><h2>{BOSS_NAME[coreGot]} rebooted!</h2><p>Its core powers up both heroes.</p></div></div>
          <div className="oc-core-heroes">
            {([['dora', d, PORTRAIT.doraSmile], ['enzo', e, PORTRAIT.enzoSmile]] as const).map(([h, p, por]) => (
              <div className="oc-core-hero" key={h}>
                <Portrait who={por} size={96} />
                <div><b style={{ color: p.color }}>{NAME[h]}: {p.name}</b><p>{p.text}</p><p className="oc-dim">Costs {p.cost} energy. Switch powers with {keyName(settings.keys.prev[0])} / {keyName(settings.keys.next[0])}.</p></div>
              </div>
            ))}
          </div>
          {CHANGES[coreGot].map((c) => <p className="oc-change" key={c.text}>The city changes: {c.text}</p>)}
          <button className="oc-btn oc-btn-main" autoFocus onClick={() => { setCoreGot(null); setScreen('hub'); }}>Back to the rooftop</button>
        </div>
      </main>
    );
  }

  if (screen === 'ending') {
    const c = completion(save);
    return (
      <main className="oc-shell oc-end" data-ready="true">
        <div className="oc-end-art" aria-hidden="true" style={paint('ending', 'bg-arcade')} />
        <div className="oc-end-panel">
          <div className="oc-end-row"><Portrait who={PORTRAIT.lumenHappy} size={80} /><div>
            <h2>The city’s lights come back on</h2>
            <p>Lumen wasn’t angry at all: its core had been overclocked until it couldn’t think straight. With its screens calm again, the little robot helps Dora and Enzo switch the city back to normal, then moves in with Pip to learn how to fix things.</p>
          </div></div>
          <p className="oc-end-stats">Capsules {c.items}/{c.itemsOf} · Bosses {c.bosses}/{c.bossesOf} · {c.pct}% · {Math.floor(save.time / 60)} min</p>
          <div className="oc-title-btns"><button className="oc-btn oc-btn-main" autoFocus onClick={() => setScreen('hub')}>Back to the rooftop</button><a className="oc-btn oc-btn-ghost" href="/">Arcade</a></div>
        </div>
      </main>
    );
  }

  if (screen === 'hub') {
    const c = completion(save);
    const fort: StageId[] = ['tower1', 'tower2', 'tower3'];
    const sel = pick;
    return (
      <main className="oc-shell oc-hub" data-ready={ready ? 'true' : 'false'}>
        <div className="oc-hub-art" aria-hidden="true" style={paint('hub', 'bg-signs')} />
        <div className="oc-hub-wrap">
          <header className="oc-hub-top">
            <h1>Rooftop hub</h1>
            <span className="oc-chip-stat"><Icon strip="icons" i={3} size={20} /> {save.bolts} bolts</span>
            <span className="oc-chip-stat"><Icon strip="icons" i={4} size={20} /> {heartCount(save)}/8</span>
            <span className="oc-chip-stat"><Icon strip="icons" i={5} size={20} /> {tankCount(save)}</span>
            <span className="oc-chip-stat">{c.pct}%</span>
            <nav className="oc-tabs" role="tablist">
              {(['stages', 'shop', 'map', 'settings'] as HubTab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`oc-tab ${tab === t ? 'oc-tab-on' : ''}`} onClick={() => { setTab(t); soundRef.current?.play('menu'); }}>{t === 'stages' ? 'Stage select' : t === 'shop' ? 'Pip’s shop' : t === 'map' ? 'Capsule map' : 'Settings'}</button>)}
              <button className="oc-tab" onClick={() => startStage('training')}>Training</button>
              <a className="oc-tab" href="/">Arcade</a>
            </nav>
          </header>
          {pipLine && (
            <div className="oc-pip"><Portrait who={PORTRAIT.pip} size={72} /><div><b>Pip</b><p>{pipLine}</p><button className="oc-btn oc-small" onClick={() => setPipLine(null)}>Got it</button></div></div>
          )}
          {tab === 'stages' && (
            <section className="oc-select">
              <div className="oc-grid">
                {GRID.map((b, i) => {
                  if (b === 'heroes') return (
                    <div key="h" className="oc-cell oc-cell-heroes"><span className="oc-sel-img" style={{ backgroundPositionX: '50%' }} />
                      <div className="oc-cell-text"><b>{cores(save).length} of 8 cores</b><span>{fortressOpen8(save) ? 'Lumen’s tower is open!' : 'Pick a stage'}</span></div></div>
                  );
                  const id = STAGE_OF_BOSS[b], done = save.beaten.includes(b), open = stageOpen(save, id);
                  const items = STAGES[id].items, got = items.filter((it) => save.items.includes(it.id)).length;
                  return (
                    <button key={b} className={`oc-cell ${done ? 'oc-cell-done' : ''} ${sel === id ? 'oc-cell-sel' : ''}`} disabled={!open} onClick={() => { setPick(id); soundRef.current?.play('select'); }} onDoubleClick={() => startStage(id)}>
                      <span className="oc-sel-img" style={{ backgroundPositionX: `${(i / 8) * 100}%` }} />
                      <span className="oc-cell-text"><b>{BOSS_NAME[b]}</b><span>{STAGES[id].name}</span><span className="oc-cell-meta">{done ? '✓ rebooted · ' : ''}capsules {got}/{items.length}</span></span>
                    </button>
                  );
                })}
              </div>
              <aside className="oc-detail">
                {sel ? (() => {
                  const st = STAGES[sel], b = st.boss as CoreBoss, why = lockedWhy(save, sel), hint = weakHint(save, b);
                  return (
                    <>
                      <h2>{st.name}</h2>
                      <p>Boss: <b>{BOSS_NAME[b]}</b>{save.beaten.includes(b) ? ' (rebooted: replay for capsules and bolts)' : ''}</p>
                      {hint ? <p className="oc-hint">{hint}</p> : <p className="oc-dim">Its weakness is another boss’s core.</p>}
                      {st.gate && <p className="oc-dim">{save.beaten.includes(st.gate) ? `Changed by the ${BOSS_NAME[st.gate]}: new ways are open.` : 'Something here changes when another boss is rebooted.'}</p>}
                      <ul className="oc-caps">{st.items.map((it) => { const [s, i] = itemIcon(it.kind); const f = save.items.includes(it.id); return <li key={it.id} className={f ? 'oc-found' : ''}><Icon strip={s} i={i} size={20} /> {f ? ITEM_NAME[it.kind] : hasArmour(save, 'helmet') ? it.hint : '???'}</li>; })}</ul>
                      {why ? <p className="oc-locked">{why}</p> : <button className="oc-btn oc-btn-main" autoFocus onClick={() => startStage(sel)}>Go!</button>}
                    </>
                  );
                })() : <p className="oc-dim">Pick a boss. Every core you earn makes another boss easier, and changes the city.</p>}
                <div className="oc-fort">
                  <h3>Lumen’s tower</h3>
                  {fort.map((id) => { const why = lockedWhy(save, id); return <button key={id} className="oc-btn oc-small" disabled={!!why} title={why} onClick={() => startStage(id)}>{STAGES[id].name}{why ? ' 🔒' : ''}</button>; })}
                  {fortressOpen8(save) ? null : <p className="oc-dim">{lockedWhy(save, 'tower1')}</p>}
                  <button className="oc-btn oc-small oc-btn-ghost" onClick={() => startStage('intro')}>Replay the rooftop run</button>
                </div>
              </aside>
            </section>
          )}
          {tab === 'shop' && <Shop save={save} onChange={(s) => { writeSave(s); soundRef.current?.play('buy'); }} msg={msg} setMsg={setMsg} />}
          {tab === 'map' && <MapTab save={save} />}
          {tab === 'settings' && <SettingsTab settings={settings} saveSettings={saveSettings} rebind={rebind} setRebind={setRebind} />}
        </div>
      </main>
    );
  }

  // ─── the game ───
  const g = gameRef.current;
  const hud = g?.hud();
  void hudTick;
  const scale = view.css;
  const glow = g ? AREA_GLOW[g.stage.area] : '#40e8ff';
  return (
    <main className={`oc-shell oc-game ${touchOn ? 'oc-touch' : ''} ${view.portrait ? 'oc-portrait-mode' : ''}`} data-ready={ready && g ? 'true' : 'false'} style={{ ['--glow' as string]: glow }}>
      <div className="oc-stage" ref={stageRef}>
        <div className="oc-frame" style={{ width: VIEW_W * scale, height: VIEW_H * scale }}>
          <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="oc-canvas" style={{ width: VIEW_W * scale, height: VIEW_H * scale }} />
          {hud && (
            <div className="oc-hud" style={{ fontSize: Math.max(10, Math.min(15, 5.2 * scale)) }}>
              {(['dora', 'enzo'] as HeroId[]).map((h) => (
                <div key={h} className={`oc-hero ${hud.lead === h ? 'oc-hero-lead' : ''} ${hud[h].down ? 'oc-hero-down' : ''}`}>
                  <b>{NAME[h]}</b>
                  <span className="oc-hero-bars"><Bar v={hud[h].hp} max={hud.max} kind="hp" /><Bar v={hud[h].en} max={hud.maxEn} kind="en" /></span>
                  {hud[h].down && <span className="oc-rest">{Math.ceil(hud[h].rest / 60)}s</span>}
                </div>
              ))}
              <div className="oc-power" style={{ color: POWER[hud.power].color }}>{hud.powerName}{hud.charge > 0 ? ' ' + '▮'.repeat(hud.charge) : ''}</div>
              <div className="oc-hud-right"><span><Icon strip="icons" i={3} size={14} /> {hud.bolts}</span><span><Icon strip="icons" i={5} size={14} /> {hud.tanks}</span></div>
              {hud.boss && hud.boss.st !== 'intro' && <div className="oc-boss"><span>{hud.boss.name}</span><Bar v={hud.boss.hp} max={hud.boss.max} kind="boss" /></div>}
            </div>
          )}
          {banner && <div key={banner.key} className="oc-banner" onAnimationEnd={() => setBanner(null)}><b>{banner.text}</b>{banner.sub && <span>{banner.sub}</span>}</div>}
          <div className="oc-toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="oc-toast">{t.text}</div>)}</div>
          {g && g.mode === 'fail' && <div className="oc-fail">Both heroes are worn out: back to the checkpoint!</div>}
          {paused && g && <PauseMenu g={g} settings={settings} saveSettings={saveSettings} onResume={() => setPaused(false)} onLeave={() => { writeSave({ ...saveRef.current, bolts: g.save.bolts, items: g.save.items, time: g.save.time }); toHub(); }} toast={toast} />}
        </div>
      </div>
      {touchOn && <TouchPad touch={touchHeld} taps={taps} onPause={() => setPaused((p) => !p)} />}
      {touchOn && view.portrait && <p className="oc-turn-hint"><span aria-hidden="true">⟲</span> Turn your phone sideways for the best view</p>}
      {!touchOn && <button className="oc-pause-btn" onClick={() => setPaused((p) => !p)} aria-label="Pause">❚❚</button>}
    </main>
  );
}

const fortressOpen8 = (s: Save) => cores(s).length >= 8;
function weakText(s: Save, id: BossId) {
  if (!(CORE_BOSSES as string[]).includes(id)) return '';
  return weakHint(s, id as CoreBoss);
}

// ─── the pause menu ───
function PauseMenu({ g, settings, saveSettings, onResume, onLeave, toast }: { g: OverclockGame; settings: Settings; saveSettings: (s: Settings) => void; onResume: () => void; onLeave: () => void; toast: (t: string) => void }) {
  const [, force] = useState(0);
  const ps = powersOf(g.save, g.lead);
  const pick = (p: PowerId) => { const i = ps.indexOf(p); if (i >= 0) { g.heroes[g.lead].power = i; g.chargeT = 0; force((x) => x + 1); } };
  return (
    <div className="oc-pause" role="dialog" aria-label="Paused">
      <div className="oc-pause-panel">
        <h2>Paused</h2>
        <div className="oc-pause-row">
          <button className="oc-btn oc-btn-main" autoFocus onClick={onResume}>Resume</button>
          <button className="oc-btn" onClick={() => { const r = g.useTank(); toast(r.ok ? `${NAME[g.lead]} is fully healed.` : r.why); force((x) => x + 1); }}>Use tank ({g.save.tanks})</button>
          <button className="oc-btn oc-btn-ghost" onClick={onLeave}>Back to the rooftop</button>
        </div>
        <h3>{NAME[g.lead]}’s powers</h3>
        <div className="oc-powers">
          {ps.map((p) => <button key={p} className={`oc-pow ${g.power() === p ? 'oc-pow-on' : ''}`} style={{ borderColor: POWER[p].color }} onClick={() => pick(p)}><b style={{ color: POWER[p].color }}>{POWER[p].name}</b><span>{POWER[p].text}</span></button>)}
        </div>
        <div className="oc-pause-row">
          <label><input type="checkbox" checked={settings.assist} onChange={(e) => { saveSettings({ ...settings, assist: e.target.checked }); g.settings.assist = e.target.checked; }} /> Assist</label>
          <label><input type="checkbox" checked={settings.shake} onChange={(e) => saveSettings({ ...settings, shake: e.target.checked })} /> Screen shake</label>
          <label><input type="checkbox" checked={settings.sound} onChange={(e) => saveSettings({ ...settings, sound: e.target.checked })} /> Sound</label>
          <label><input type="checkbox" checked={settings.music} onChange={(e) => saveSettings({ ...settings, music: e.target.checked })} /> Music</label>
          <label><input type="checkbox" checked={settings.hitboxes} onChange={(e) => saveSettings({ ...settings, hitboxes: e.target.checked })} /> Show hitboxes</label>
        </div>
        <p className="oc-dim">Health {g.heroes.dora.hp}/{maxHp(g.save)} (Dora) · {g.heroes.enzo.hp}/{maxHp(g.save)} (Enzo). Assist: less damage, slower bosses, pits put you back on the ledge.</p>
      </div>
    </div>
  );
}

// ─── Pip's shop ───
function Shop({ save, onChange, msg, setMsg }: { save: Save; onChange: (s: Save) => void; msg: string | null; setMsg: (m: string | null) => void }) {
  const act = (f: (s: Save, id: ChipId) => { ok: boolean; why: string }, id: ChipId) => {
    const s = JSON.parse(JSON.stringify(save)) as Save;
    const r = f(s, id);
    if (r.ok) { onChange(s); setMsg(null); } else setMsg(r.why);
  };
  return (
    <section className="oc-shop">
      <div className="oc-pip"><Portrait who={PORTRAIT.pipLaugh} size={72} /><div><b>Pip</b><p>Bolts in, chips out! You can slot {CHIP_SLOTS} at once. You have {save.bolts} bolts.</p>{msg && <p className="oc-locked">{msg}</p>}</div></div>
      <ul className="oc-chips">
        {CHIPS.map((c) => {
          const own = save.chips.includes(c.id), on = save.equipped.includes(c.id);
          return (
            <li key={c.id} className={`oc-chiprow ${on ? 'oc-chip-on' : ''}`}>
              <Icon strip="icons" i={6} size={24} />
              <div><b>{c.name}</b><span>{c.text}</span></div>
              {own ? <button className="oc-btn oc-small" onClick={() => act(toggleChip, c.id)}>{on ? 'Unslot' : 'Slot'}</button>
                : <button className="oc-btn oc-small" disabled={save.bolts < c.price} onClick={() => act(buyChip, c.id)}>Buy · {c.price}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── the capsule map ───
function MapTab({ save }: { save: Save }) {
  const sensor = hasArmour(save, 'helmet');
  return (
    <section className="oc-map">
      <p className="oc-dim">{sensor ? 'The Sensor Band shows every capsule’s hiding place.' : 'Find the Sensor Band to see where the capsules hide.'} Heart cells {heartCount(save)}/8 · tanks {tankCount(save)}/8.</p>
      <div className="oc-map-grid">
        {itemMap(save).map((st) => (
          <div key={st.stage} className="oc-map-stage">
            <b>{st.name}</b>
            <ul>{st.items.map((it) => { const [s, i] = itemIcon(it.kind); return <li key={it.id} className={it.found ? 'oc-found' : it.open ? '' : 'oc-shut'}><Icon strip={s} i={i} size={18} /> {it.found ? ITEM_NAME[it.kind] : sensor ? it.hint : it.open ? 'Somewhere here…' : 'Not reachable yet'}</li>; })}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── settings ───
function SettingsTab({ settings, saveSettings, rebind, setRebind }: { settings: Settings; saveSettings: (s: Settings) => void; rebind: Action | null; setRebind: (a: Action | null) => void }) {
  const tog = (k: 'assist' | 'shake' | 'sound' | 'music' | 'hitboxes', label: string, text: string) => (
    <label className="oc-set"><input type="checkbox" checked={settings[k]} onChange={(e) => saveSettings({ ...settings, [k]: e.target.checked })} /><b>{label}</b><span>{text}</span></label>
  );
  return (
    <section className="oc-settings">
      {tog('assist', 'Assist mode', 'On: 40% less damage, bosses 15% slower with longer warnings, pits put you back on the last ledge, extra checkpoints, and tanks refill. Off: strict.')}
      {tog('shake', 'Screen shake', 'The camera shakes on big hits.')}
      {tog('sound', 'Sound effects', '')}
      {tog('music', 'Music', '')}
      {tog('hitboxes', 'Show hitboxes', 'Outlines every hitbox (a debug view).')}
      <label className="oc-set"><b>On-screen pad</b><select value={settings.touch} onChange={(e) => saveSettings({ ...settings, touch: e.target.value as Settings['touch'] })}><option value="auto">On touch screens</option><option value="on">Always</option><option value="off">Never</option></select></label>
      <h3>Keys</h3>
      <ul className="oc-keys">
        {ACTIONS.map((a) => <li key={a.id}><span>{a.label}</span><button className="oc-btn oc-small" onClick={() => setRebind(a.id)}>{rebind === a.id ? 'Press a key…' : settings.keys[a.id].map(keyName).join(' / ')}</button></li>)}
      </ul>
      <button className="oc-btn oc-small oc-btn-ghost" onClick={() => saveSettings({ ...settings, keys: DEFAULT_KEYS })}>Reset keys</button>
    </section>
  );
}

// ─── the on-screen pad ───
function TouchPad({ touch, taps, onPause }: { touch: React.MutableRefObject<Record<Action, boolean>>; taps: React.MutableRefObject<Set<Action>>; onPause: () => void }) {
  const btn = (a: Action, label: string, cls = '') => (
    <button className={`oc-pad-btn ${cls}`} aria-label={a}
      onPointerDown={(e) => { e.preventDefault(); try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* a pointer the browser no longer tracks */ } if (!touch.current[a]) taps.current.add(a); touch.current[a] = true; }}
      onPointerUp={() => { touch.current[a] = false; }} onPointerCancel={() => { touch.current[a] = false; }} onPointerLeave={() => { touch.current[a] = false; }}>{label}</button>
  );
  return (
    <div className="oc-pad">
      <div className="oc-pad-l">{btn('up', '▲', 'oc-pad-up')}{btn('left', '◀', 'oc-pad-left')}{btn('right', '▶', 'oc-pad-right')}{btn('down', '▼', 'oc-pad-down')}</div>
      <div className="oc-pad-m"><button className="oc-pad-btn oc-pad-small" onClick={onPause} aria-label="pause">❚❚</button>{btn('prev', '◁P')}{btn('next', 'P▷')}</div>
      <div className="oc-pad-r">{btn('tag', '⇄', 'oc-pad-small')}{btn('shield', '⬡', 'oc-pad-small')}{btn('dash', 'Dash')}{btn('shoot', 'B')}{btn('jump', 'A', 'oc-pad-big')}</div>
    </div>
  );
}
