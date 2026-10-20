/* oxlint-disable react/react-compiler -- The dive is a mutable engine object stepped by the loop and changed by the buttons, like the other arcade games. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation back to the menu. */
'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Dive, CARD, JOBS, OVERCLOCKS, PASSIVES, POWERUPS, RARITY, UNLOCK, UPGRADES, UPGRADE_IDS, WEAPONS, buy, freshProfile, loadProfile, newWeapon, record, upgradeCost, xpNeed,
  type Card, type CaveEvent, type UpgradeId, type Hazard, type Hero, type LayerNo, type Profile, type WeaponId, type WeaponState,
} from '../../lib/glimmer-cave-game';
import { POWER_ICON, addEvents, animate, drawDive, drawMinimap, drawStick, drawTitle, heroPainted, makeView, newAnimState, newFx, viewTiles, type AnimState, type Fx } from '../../lib/glimmer-cave-scene';
import { CAVE_FRAMES, CAVE_SHEETS, CAVE_SIZES, ICONS, caveArtServerVersion, caveArtUrl, type CaveIcon, caveArtStatus, caveArtVersion, requestCaveArt, retryCaveArt, subscribeCaveArt } from '../../lib/glimmer-cave-paint';
import { makeSound } from '../../lib/cue-sound';
import './cave.css';

const RUN_KEY = 'glimmer-cave-run-v1', PROFILE_KEY = 'glimmer-cave-v1';
type Screen = 'title' | 'camp' | 'dive' | 'pick' | 'pod' | 'over';
const HZ = 60, STEP = 1 / HZ, STICK = 60;
const HERO_NAME: Record<Hero, string> = { dora: 'Dora', enzo: 'Enzo' };
const HERO_TEXT: Record<Hero, string> = { dora: 'the digger · Pickaxe Bonk · digs 2× as fast, +15% Fluff', enzo: 'the scout · Acorn Sling · faster, a wider lamp' };
const SHORT: Record<WeaponId, string> = {
  sling: 'Sling', pickaxe: 'Pickaxe', popper: 'Popper', pulse: 'Pulse', lance: 'Lance', puffer: 'Puffer', boomerang: 'Boomerang', orbit: 'Orbit', bomb: 'Bomb', moths: 'Moths', drum: 'Drum', drill: 'Drill',
};
const UNLOCK_TEXT: Record<keyof typeof UNLOCK, string> = { bomb: 'reach layer 3', moths: 'finish a dive', drum: 'finish hazard 2', drill: 'bonk 5,000 critters' };
const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => `${Math.round(n * 10) / 10}`;
/** A passive card's text for the value it adds, which its rarity multiplies (PASSIVES[id].text is the Common card's). */
const PASSIVE_TEXT: Record<keyof typeof PASSIVES, (v: number) => string> = {
  fluff: (v) => `+${num(v)} max Fluff, and heals ${num(v)}.`, paws: (v) => `+${pct(v)} move speed.`, magnet: (v) => `+${pct(v)} pickup radius.`,
  claws: (v) => `+${pct(v)} all damage.`, busy: (v) => `-${pct(v)} weapon cooldowns.`, arms: (v) => `+${pct(v)} dig speed.`, lucky: (v) => `+${pct(v)} crit chance.`,
  coat: (v) => `+${num(v)} armour: takes ${num(v)} off each bump, to a minimum of 1.`,
};
/** The heroes' sheets are asked for at camp; the rest when a dive starts (the pose sheet only if a frame needs it). */
const HERO_SHEETS = ['dora', 'enzo'] as const, DIVE_SHEETS = CAVE_SHEETS.filter((s) => s !== 'sprites');
const useArtVersion = () => useSyncExternalStore(subscribeCaveArt, caveArtVersion, caveArtServerVersion);
const clock = (s: number) => { const n = Math.ceil(s); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: nothing is kept */ } },
  drop: (k: string) => { try { localStorage.removeItem(k); } catch { /* nothing to remove */ } },
};
const parse = (raw: string | null): unknown => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };

// Short synthesised blips, no files.
const sound = makeSound('glimmer-cave-sound-v1', {
  sling: [{ f: 700, to: 420, d: 0.06, type: 'triangle', v: 0.025 }],
  bonk: [{ f: 320, to: 160, d: 0.07, type: 'square', v: 0.02 }],
  poof: [{ f: 900, d: 0.12, noise: true, v: 0.03 }],
  crystal: [{ f: 1568, d: 0.05, type: 'triangle', v: 0.02 }],
  level: [{ f: 523, d: 0.1, v: 0.05 }, { f: 659, d: 0.1, at: 0.09, v: 0.05 }, { f: 1046, d: 0.2, at: 0.18, v: 0.05 }],
  dig: [{ f: 400, d: 0.08, noise: true, v: 0.04 }, { f: 140, to: 90, d: 0.08, type: 'square', v: 0.02 }],
  gold: [{ f: 1046, d: 0.06, type: 'triangle', v: 0.035 }, { f: 1397, d: 0.1, at: 0.05, type: 'triangle', v: 0.035 }],
  hurt: [{ f: 260, to: 130, d: 0.14, type: 'triangle', v: 0.05 }],
  podIncoming: [{ f: 392, d: 0.15, type: 'square', v: 0.03 }, { f: 523, d: 0.15, at: 0.18, type: 'square', v: 0.03 }, { f: 392, d: 0.15, at: 0.36, type: 'square', v: 0.03 }],
  podReached: [{ f: 523, d: 0.1, v: 0.05 }, { f: 784, d: 0.1, at: 0.1, v: 0.05 }, { f: 1046, d: 0.25, at: 0.2, v: 0.05 }],
  rumble: [{ f: 120, d: 0.5, noise: true, v: 0.08 }, { f: 60, to: 40, d: 0.5, type: 'sawtooth', v: 0.03 }],
  complete: [{ f: 659, d: 0.12, v: 0.05 }, { f: 880, d: 0.12, at: 0.12, v: 0.05 }, { f: 1319, d: 0.35, at: 0.24, v: 0.05 }],
});

/** Plays a step's events. The crystal tick is held to 12 a second. */
function hear(events: CaveEvent[], hero: Hero) {
  for (const e of events) {
    if (e.k === 'fire') { if (e.w === 'sling') sound.cue('sling', 0, hero === 'enzo' ? 1 : 0.5); }
    else if (e.k === 'bonk') sound.cue(e.elite ? 'poof' : 'bonk', 0, 1, 0.06);
    else if (e.k === 'crystal') sound.cue('crystal', 0, 1, 1 / 12);
    else if (e.k === 'level') sound.cue('level');
    else if (e.k === 'power') sound.cue(e.id === 'sneeze' ? 'poof' : e.id === 'pouch' ? 'gold' : 'level');
    else if (e.k === 'dig' && e.progress >= 1) sound.cue('dig');
    else if (e.k === 'gold') sound.cue('gold');
    else if (e.k === 'hurt') sound.cue('hurt', 0, 1, 0.2);
    else if (e.k === 'pod') sound.cue('podIncoming');
    else if (e.k === 'podReached') sound.cue('podReached');
    else if (e.k === 'wyrm' && (e.what === 'rumble' || e.what === 'surface')) sound.cue('rumble');
    else if (e.k === 'wyrm' && e.what === 'bonked') sound.cue('poof');
    else if (e.k === 'over' && e.result === 'complete') sound.cue('complete');
  }
}

/** A weapon's top level, and the levels whose card is one of its overclocks (the engine offers them at 4 and 9). */
const WEAPON_TOP = 12, OC_LEVELS = [5, 10];

/** The camp upgrades show the icon of the passive they match; the other three have their own. */
const UPGRADE_ICON: Record<UpgradeId, CaveIcon> = {
  fluffier: 'fluff', sharper: 'claws', quicker: 'paws', diggier: 'arms', magnetic: 'magnet', prospector: 'prospector', rerolls: 'rerolls', headstart: 'headstart',
};

/** A painted icon from the icons sheet, fitted into a `size` px square; an overclock wears a spark badge. Until the
 *  sheet arrives the box is empty and the card's words carry it. */
function Icon({ id, size, badge = false }: { id: CaveIcon; size: number; badge?: boolean }) {
  const [x, y, w, h] = CAVE_FRAMES[ICONS[id]].rect, k = size / Math.max(w, h), sheet = CAVE_SIZES.icons;
  return (
    <span className="gc-ico" style={{ width: size, height: size }} aria-hidden="true" data-icon={id}>
      <span className="gc-ico-art" style={{ width: w * k, height: h * k, backgroundImage: `url(${caveArtUrl('icons')})`, backgroundSize: `${sheet.w * k}px ${sheet.h * k}px`, backgroundPosition: `${-x * k}px ${-y * k}px` }} />
      {badge && <span className="gc-oc">⚡</span>}
    </span>
  );
}

/** A card's name, what it does with its rarity's bonus worked in, and its icon. */
function describe(c: Card, d: Dive): { name: string; text: string; tag: string; icon: CaveIcon } {
  if (c.k === 'snack') return { name: 'Snack', text: 'Nothing left to learn: heal 20 Fluff.', tag: '', icon: 'snack' };
  if (c.k === 'overclock') return { name: OVERCLOCKS[c.id].name, text: OVERCLOCKS[c.id].text, tag: 'Overclock', icon: c.id.split('.')[0] as WeaponId };
  const m = RARITY.mult[c.rarity], tag = RARITY.names[c.rarity];
  if (c.k === 'passive') {
    const p = PASSIVES[c.id];
    return { name: p.name, text: PASSIVE_TEXT[c.id](p.per * m), tag, icon: c.id };
  }
  const w = d.weapons.find((x) => x.id === c.id), def = WEAPONS[c.id];
  if (!w) return { name: def.name, text: `New weapon. ${def.text}`, tag: 'New', icon: c.id };
  const step = def.steps[w.level - 1];
  const more = step === 'count' ? '+1 projectile' : step === 'rate' ? `+${pct(CARD.rate * m)} fire rate` : `+${pct(CARD.size * m)} size`;
  return { name: `${def.name} ${w.level + 1}`, text: `+${pct(CARD.damage * m)} damage, ${more}.`, tag, icon: c.id };
}

type Summary = { layer: LayerNo; banked: number; job: string | null; jobDone: boolean; bonked: number };
type Ending = { result: string; layer: number; gold: number; unlocked: WeaponId[]; hazard: Hazard | null };

export default function GlimmerCave() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('title');
  const [profile, setProfile] = useState<Profile>(() => freshProfile());
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hero, setHero] = useState<Hero>('dora');
  const [hazard, setHazard] = useState<Hazard>(1);
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [, setTick] = useState(0);
  const diveRef = useRef<Dive | null>(null);
  const animRef = useRef<AnimState>(newAnimState());
  const fxRef = useRef<Fx>(newFx());
  const profileRef = useRef(profile);
  const screenRef = useRef<Screen>('title');
  const pausedRef = useRef(false);
  const calmRef = useRef(false);
  const keysRef = useRef(new Set<string>());
  const stickRef = useRef<{ id: number; ox: number; oy: number; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const layerBonkRef = useRef(0); // critters bonked before this layer, for the pod summary
  profileRef.current = profile; screenRef.current = screen; pausedRef.current = paused;
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const saveProfile = useCallback((p: Profile) => { profileRef.current = p; setProfile(p); store.set(PROFILE_KEY, JSON.stringify(p)); }, []);
  /** The run as it stands at a layer's start: only ever called at dive start and right after `descend()`. */
  const saveRun = useCallback((d: Dive) => { store.set(RUN_KEY, JSON.stringify(d.toSave())); setSaved(true); layerBonkRef.current = d.bonked; }, []);
  /** A dive left in the save is ended as bonked at its layer's start and banked, before a new one begins. */
  const settleOld = useCallback(() => {
    const old = Dive.fromSave(parse(store.get(RUN_KEY)), profileRef.current);
    if (old) { const p = structuredClone(profileRef.current); old.abandon(); record(p, old); saveProfile(p); }
    store.drop(RUN_KEY); setSaved(false);
  }, [saveProfile]);

  const go = useCallback((s: Screen) => { screenRef.current = s; setPaused(false); setScreen(s); }, []);
  /** Shows the screen the dive's phase calls for. */
  const sync = useCallback((d: Dive) => {
    if (d.phase === 'pick') go('pick');
    else if (d.phase === 'play') go('dive');
  }, [go]);
  const begin = useCallback((d: Dive) => {
    diveRef.current = d; animRef.current = newAnimState(); fxRef.current = newFx(); keysRef.current.clear(); stickRef.current = null;
    setSummary(null); setEnding(null);
    sync(d);
  }, [sync]);
  const start = useCallback((h: Hero, hz: Hazard = 1, seed = (Math.random() * 2 ** 31) | 0) => {
    settleOld();
    const d = new Dive({ seed, hero: h, hazard: hz, profile: profileRef.current });
    saveRun(d); begin(d);
  }, [settleOld, saveRun, begin]);
  const resume = useCallback(() => {
    const d = Dive.fromSave(parse(store.get(RUN_KEY)), profileRef.current);
    if (!d) { store.drop(RUN_KEY); setSaved(false); return; }
    layerBonkRef.current = d.bonked; begin(d);
  }, [begin]);

  /** After a step leaves play: the pod (summary, descend, save) or the end of the dive (banked into the profile). */
  const settle = useCallback((d: Dive) => {
    if (d.phase === 'pick') { go('pick'); return; }
    if (d.phase === 'pod') {
      const job = d.job;
      setSummary({ layer: d.layer, banked: d.gold.banked, job: job ? JOBS[job.id].name : null, jobDone: !!job?.done, bonked: d.bonked - layerBonkRef.current });
      d.descend(); saveRun(d);
      go('pod');
      return;
    }
    if (d.phase === 'over') {
      store.drop(RUN_KEY); setSaved(false);
      const p = structuredClone(profileRef.current), out = record(p, d);
      saveProfile(p);
      setEnding({ result: d.result ?? 'bonked', layer: d.layer, gold: out.gold, unlocked: out.unlocked, hazard: out.hazard });
      go('over');
    }
  }, [go, saveRun, saveProfile]);

  const pick = useCallback((i: number) => { const d = diveRef.current; if (d?.pick(i)) { sync(d); refresh(); } }, [sync, refresh]);
  const reroll = useCallback(() => { const d = diveRef.current; if (d?.reroll()) refresh(); }, [refresh]);
  const descend = useCallback(() => { const d = diveRef.current; if (d) { setSummary(null); sync(d); } }, [sync]);

  useEffect(() => {
    const p = loadProfile(parse(store.get(PROFILE_KEY)));
    profileRef.current = p; setProfile(p);
    setSaved(!!Dive.fromSave(parse(store.get(RUN_KEY)), p));
    setMuted(sound.muted());
    setReady(true);
  }, []);

  // Reduced motion: no shake, smaller poofs. The walk and attack frames still play.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)'), on = () => { calmRef.current = q.matches; };
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    (window as unknown as { __cave?: () => unknown }).__cave = () => ({
      get dive() { return diveRef.current; }, get profile() { return profileRef.current; }, start, xpNeed,
      art: caveArtStatus, heroPainted: () => heroPainted,
      set: (patch: { level?: number; xp?: number; fluff?: number; timer?: number; layer?: LayerNo; weapons?: (Partial<WeaponState> & { id: WeaponId })[] }) => {
        const d = diveRef.current;
        if (!d) return;
        if (patch.layer !== undefined) { d.startLayer(patch.layer); layerBonkRef.current = d.bonked; }
        if (patch.weapons) d.weapons = patch.weapons.map((w) => ({ ...newWeapon(w.id), ...w, overclocks: [...(w.overclocks ?? [])] }));
        if (patch.level !== undefined) d.level = patch.level;
        if (patch.fluff !== undefined) d.fluff = patch.fluff;
        if (patch.timer !== undefined) d.timer = patch.timer;
        d.st = d.stats();
        // Experience levels up as a crystal's would: the pick opens at the end of the next step.
        if (patch.xp !== undefined) { d.xp = patch.xp; d.collect(0); }
        refresh();
      },
      setProfile: (p: Profile) => { saveProfile(p); refresh(); },
    });
  });

  // The canvas fills the stage at the screen's pixel density.
  useEffect(() => {
    if (screen !== 'dive' && screen !== 'pick' && screen !== 'pod') return;
    const fit = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener('resize', fit);
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit); };
  }, [screen]);

  // The loop: fixed 60 Hz steps from the frame time (capped at 0.1 s), paused while hidden, paused, or on a card.
  useEffect(() => {
    if (screen !== 'dive' && screen !== 'pick' && screen !== 'pod') return;
    let raf = 0, last = performance.now(), acc = 0, hud = 0;
    const input = () => {
      const k = keysRef.current, s = stickRef.current;
      if (s) { const dx = (s.x - s.ox) / STICK, dy = (s.y - s.oy) / STICK, l = Math.hypot(dx, dy); return l > 1 ? { x: dx / l, y: dy / l } : l < 0.15 ? { x: 0, y: 0 } : { x: dx, y: dy }; }
      return {
        x: (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0),
        y: (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0),
      };
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const d = diveRef.current, canvas = canvasRef.current;
      if (!d || !canvas || document.hidden) return;
      const calm = calmRef.current, dpr = canvas.width / Math.max(1, canvas.clientWidth), w = canvas.width / dpr, h = canvas.height / dpr;
      const view = makeView(w, h, d.hx, d.hy), tiles = viewTiles(view);
      // The spawn window is the stage's shape in tiles (11 across the short side), so spawns stay off screen.
      if (d.view.w !== tiles.w || d.view.h !== tiles.h) d.view = tiles;
      if (screenRef.current === 'dive' && !pausedRef.current && d.phase === 'play') {
        acc += dt;
        while (acc >= STEP) {
          acc -= STEP;
          const ev = d.step(input());
          animate(d, animRef.current, ev, STEP); addEvents(fxRef.current, ev, calm); hear(ev, d.hero);
          if (d.phase !== 'play') { acc = 0; settle(d); break; }
        }
      } else acc = 0;
      const c = canvas.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.cx = d.hx; view.cy = d.hy;
      animRef.current.hero.cheer = screenRef.current === 'pod';
      drawDive(c, d, view, fxRef.current, now, calm, animRef.current);
      const mc = miniRef.current, mx = mc?.getContext('2d');
      if (mc && mx) {
        const mr = mc.getBoundingClientRect();
        if (mc.width !== Math.round(mr.width * dpr)) { mc.width = Math.round(mr.width * dpr); mc.height = Math.round(mr.height * dpr); }
        mx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawMinimap(mx, d, mr.width, mr.height, now, calm);
      }
      const s = stickRef.current;
      if (s && screenRef.current === 'dive') {
        const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), k = l > STICK ? STICK / l : 1;
        drawStick(c, s.ox, s.oy, s.ox + dx * k, s.oy + dy * k, STICK);
      }
      hud += dt;
      if (hud > 0.1) { hud = 0; refresh(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [screen, settle, refresh]);

  // The title picture, redrawn slowly so the crystals bob.
  useEffect(() => {
    if (screen !== 'title') return;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const canvas = titleRef.current, c = canvas?.getContext('2d');
      if (!canvas || !c) return;
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTitle(c, r.width, r.height, calmRef.current ? 0 : now);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  // Keys: WASD and arrows move; P or Escape pauses; 1-3 pick a card and R rerolls.
  useEffect(() => {
    const MOVE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = screenRef.current;
      if (MOVE.includes(e.code)) { keysRef.current.add(e.code); if (s === 'dive' || s === 'pick') e.preventDefault(); return; }
      if (e.repeat) return;
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (s === 'dive' && (e.code === 'KeyP' || e.code === 'Escape')) setPaused((p) => !p);
      else if (s === 'pick' && n >= 0) pick(n);
      else if (s === 'pick' && e.code === 'KeyR') reroll();
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
    const blur = () => { keysRef.current.clear(); stickRef.current = null; };
    // Coming back to a hidden tab shows the pause screen rather than dropping the hero back into the swarm.
    const hide = () => { if (document.hidden && screenRef.current === 'dive') setPaused(true); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [pick, reroll]);

  // The floating joystick: a thumb down anywhere on the stage, then drag.
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'dive' || paused || stickRef.current) return;
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    stickRef.current = { id: e.pointerId, ox: x, oy: y, x, y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stickRef.current;
    if (!s || s.id !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    s.x = e.clientX - r.left; s.y = e.clientY - r.top;
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => { if (stickRef.current?.id === e.pointerId) stickRef.current = null; };

  const toggleMute = () => { const m = !muted; sound.setMuted(m); setMuted(m); };
  const d = diveRef.current;
  const playing = screen === 'dive' || screen === 'pick' || screen === 'pod';
  // The heroes' sheets at camp, everything else as a dive starts.
  useEffect(() => { if (screen === 'camp' || screen === 'title') requestCaveArt(HERO_SHEETS); else if (playing) requestCaveArt(DIVE_SHEETS); }, [screen, playing]);
  useArtVersion();
  const artFailed = caveArtStatus().failed.length > 0;
  const mute = <>
    {artFailed && <button data-testid="retry-art" className="gc-icon" onClick={retryCaveArt}>Retry artwork</button>}
    <button data-testid="mute" className="gc-icon" aria-pressed={muted} onClick={toggleMute}>{muted ? 'Sound off' : 'Sound on'}</button>
  </>;

  return (
    <main className="gc-shell" data-ready={ready} data-screen={screen}>
      {!playing && (
        <header className="gc-top">
          <a className="gc-back" href="/">← Arcade</a>
          <h1>Glimmer Cave</h1>
          {mute}
        </header>
      )}

      {screen === 'title' && (
        <section className="gc-menu">
          <div className="gc-title"><canvas ref={titleRef} aria-hidden="true" /></div>
          <p className="gc-small">Dig down five layers with Dora and Enzo. Steer; the weapons fire by themselves. Bonk the critters into dust, grab the crystals, finish the jobs, and reach the drop pod when the clock runs out.</p>
          <div className="gc-row">
            {saved && <button className="gc-gold" data-testid="continue" onClick={resume}>Continue</button>}
            <button className={saved ? '' : 'gc-gold'} data-testid="camp" onClick={() => go('camp')}>Camp</button>
          </div>
        </section>
      )}

      {screen === 'camp' && (
        <section className="gc-camp">
          <div className="gc-row gc-left"><button data-testid="back" onClick={() => go('title')}>← Back</button><span className="gc-purse">Gold {profile.gold}</span></div>
          <div className="gc-panel">
            <h2>Who digs?</h2>
            <div className="gc-row">
              {(['dora', 'enzo'] as Hero[]).map((h) => (
                <button key={h} data-testid={`hero-${h}`} aria-pressed={hero === h} onClick={() => setHero(h)}>{HERO_NAME[h]}, {HERO_TEXT[h]}</button>
              ))}
            </div>
            <h2>Hazard</h2>
            <div className="gc-row">
              {([1, 2, 3, 4, 5] as Hazard[]).map((n) => (
                <button key={n} data-testid={`hazard-${n}`} aria-pressed={hazard === n} disabled={n > profile.unlocked.hazard} onClick={() => setHazard(n)}>{n}</button>
              ))}
            </div>
            <div className="gc-row">
              {saved && <button data-testid="continue" onClick={resume}>Continue</button>}
              <button className="gc-gold gc-wide" data-testid="dive" onClick={() => start(hero, Math.min(hazard, profile.unlocked.hazard) as Hazard)}>Dive</button>
            </div>
            {saved && <p className="gc-small">A new dive ends the saved one, keeping its banked gold.</p>}
          </div>
          <div className="gc-panel">
            <h2>Upgrades</h2>
            <div className="gc-grid">
              {UPGRADE_IDS.map((id) => {
                const u = UPGRADES[id], lv = profile.upgrades[id], cost = upgradeCost(id, lv + 1), max = lv >= u.max;
                return (
                  <button key={id} data-testid={`buy-${id}`} className="gc-up" disabled={max || profile.gold < cost}
                    onClick={() => { const p = structuredClone(profileRef.current); if (buy(p, id)) { saveProfile(p); sound.cue('gold'); } }}>
                    <Icon id={UPGRADE_ICON[id]} size={40} /><b>{u.name} · Lv {lv}/{u.max}</b><span>{u.text}</span><span>{max ? 'Maxed' : `${cost} gold`}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="gc-panel">
            <h2>Unlocks</h2>
            <ul className="gc-list">
              {(Object.keys(UNLOCK) as (keyof typeof UNLOCK)[]).map((id) => (
                <li key={id} data-unlocked={profile.unlocked.weapons.includes(id)}><b>{WEAPONS[id].name}</b> · {profile.unlocked.weapons.includes(id) ? 'unlocked' : UNLOCK_TEXT[id]}</li>
              ))}
            </ul>
            <p className="gc-small">Dives {profile.stats.dives} · deepest layer {profile.stats.bestLayer} · critters bonked {profile.stats.bonked} · finished {profile.stats.finished}</p>
          </div>
        </section>
      )}

      {playing && d && (
        <section className="gc-play">
          <canvas ref={canvasRef} className="gc-stage" data-testid="stage" aria-label="Glimmer Cave stage"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          {screen !== 'pod' && <Hud d={d} paused={paused} onPause={() => setPaused((p) => !p)} mute={mute} mini={miniRef} />}
          {paused && screen === 'dive' && (
            <div className="gc-over">
              <div className="gc-card-panel">
                <h2>Paused</h2>
                <p className="gc-small">P or Escape carries on. Leaving keeps the save from this layer&apos;s start.</p>
                <div className="gc-row">
                  <button className="gc-gold" onClick={() => setPaused(false)}>Carry on</button>
                  <button data-testid="home" onClick={() => go('camp')}>Back to camp</button>
                </div>
              </div>
            </div>
          )}
          {screen === 'pick' && d.phase === 'pick' && (
            <div className="gc-over">
              <div className="gc-cards">
                <p>{d.offer[0]?.k === 'overclock' ? 'Overclock! Pick a twist' : d.picks > 1 ? `Level up! Pick a card (${d.picks} to go)` : 'Level up! Pick a card'}</p>
                <div className="gc-cardrow">
                  {d.offer.map((c, i) => {
                    const x = describe(c, d);
                    return (
                      <button key={i} className={`gc-card gc-r${c.k === 'weapon' || c.k === 'passive' ? c.rarity : c.k === 'overclock' ? 'o' : 's'}`} data-testid={`card-${i}`} onClick={() => pick(i)}>
                        <i>{i + 1}</i><Icon id={x.icon} size={56} badge={c.k === 'overclock'} />{x.tag && <em>{x.tag}</em>}<b>{x.name}</b><span>{x.text}</span>
                      </button>
                    );
                  })}
                </div>
                <button data-testid="reroll" disabled={d.rerolls <= 0 || d.offer[0]?.k === 'overclock' || d.offer[0]?.k === 'snack'} onClick={reroll}>Reroll (R) · {d.rerolls} left</button>
              </div>
            </div>
          )}
          {screen === 'pod' && summary && (
            <div className="gc-over">
              <div className="gc-card-panel" data-testid="summary">
                <h2>Layer {summary.layer} done!</h2>
                <p>Gold banked: {summary.banked}</p>
                <p>{summary.job ? `${summary.job}: ${summary.jobDone ? 'done' : 'not done'}` : 'No job this layer'}</p>
                <p>Critters bonked: {summary.bonked}</p>
                <p className="gc-small">Saved. Continue from here any time.</p>
                <button className="gc-gold gc-wide" data-testid="descend" onClick={descend}>Descend to layer {summary.layer + 1}</button>
              </div>
            </div>
          )}
        </section>
      )}

      {screen === 'over' && ending && (
        <section className="gc-menu">
          <h2 className="gc-end">{ending.result === 'complete' ? 'Dive complete!' : ending.result === 'missed' ? `The pod left without ${d ? HERO_NAME[d.hero] : 'you'}` : `Bonked on layer ${ending.layer}`}</h2>
          <p>{ending.result === 'complete' ? 'The Rock Wyrm tumbled into a heap of boulders, and the pod carried everyone home.' : `Reached layer ${ending.layer}, then home to camp for a nap. Half this layer's gold came along.`}</p>
          <p>Gold banked: {ending.gold}</p>
          {ending.unlocked.length > 0 && <p>Unlocked: {ending.unlocked.map((id) => WEAPONS[id].name).join(', ')}</p>}
          {ending.hazard && <p>Hazard {ending.hazard} unlocked!</p>}
          <button className="gc-gold" data-testid="home" onClick={() => go('camp')}>Back to camp</button>
        </section>
      )}
    </main>
  );
}

/** The HUD over the stage: experience along the top, Fluff, layer and clock (or the wyrm's bar), job, gold, pause and
 *  mute, and the four weapon slots. */
function Hud({ d, paused, onPause, mute, mini }: { d: Dive; paused: boolean; onPause: () => void; mute: React.ReactNode; mini: React.RefObject<HTMLCanvasElement | null> }) {
  const st = d.stats(), need = xpNeed(d.level), w = d.wyrm, job = d.job;
  const fight = d.layer === 5 && w && !w.bonked && !d.pod;
  return (
    <div className="gc-hud">
      <div className="gc-xp"><i style={{ width: `${Math.min(100, (100 * d.xp) / need)}%` }} /></div>
      <div className="gc-bar">
        <span data-testid="fluff" className="gc-meter"><i style={{ width: `${(100 * d.fluff) / st.maxFluff}%`, background: d.fluff < st.maxFluff * 0.3 ? '#ff6a5a' : '#7ad06a' }} /><em>Fluff {Math.ceil(d.fluff)}/{Math.round(st.maxFluff)}</em></span>
        <span data-testid="timer" className={`gc-pill ${d.pod && !d.pod.reached ? 'gc-hot' : ''}`}>
          {fight ? <span className="gc-meter gc-wyrm"><i style={{ width: `${(100 * w.fluff) / w.max}%` }} /><em>Rock Wyrm {Math.ceil((100 * w.fluff) / w.max)}%</em></span>
            : <>Layer {d.layer} · {d.pod && !d.pod.reached ? `Pod ${clock(d.timer)}` : clock(d.timer)}</>}
        </span>
        <span className="gc-pill">Lv {d.level}</span>
        <span data-testid="gold" className="gc-pill">Gold {d.gold.banked}{d.gold.layer ? ` +${d.gold.layer}` : ''}</span>
        <button data-testid="pause" className="gc-icon" aria-pressed={paused} onClick={onPause}>{paused ? 'Play' : 'Pause'}</button>
        {mute}
      </div>
      <div className="gc-bar gc-sub">
        <div className="gc-left">
          <span data-testid="job" className="gc-pill">
            {job ? `${JOBS[job.id].name} ${job.done ? '✓' : `${job.n}/${job.goal}`}` : d.layer === 5 ? (w?.bonked ? 'The wyrm is bonked! To the pod' : w ? 'Bonk the Rock Wyrm' : 'Something rumbles below…') : ''}
          </span>
          {/* the timed power-ups running, each with its seconds left */}
          {(['storm', 'hourglass', 'zoomies'] as const).filter((k) => d.boost[k] > 0).map((k) => (
            <span key={k} data-testid={`boost-${k}`} className="gc-pill gc-boost" title={POWERUPS[k].name}>
              <Icon id={POWER_ICON[k]} size={22} />{Math.ceil(d.boost[k])} s
            </span>
          ))}
        </div>
        <canvas ref={mini} data-testid="minimap" className="gc-mini" aria-label="Mini-map" />
      </div>
      <div className="gc-slots">
        {[0, 1, 2, 3].map((i) => {
          const s = d.weapons[i];
          if (!s) return <span key={i} data-testid={`slot-${i}`} className="gc-slot gc-empty" title="Empty slot">·</span>;
          const oc = s.overclocks.map((o) => OVERCLOCKS[o].name).join(', ');
          return (
            <span key={i} data-testid={`slot-${i}`} className="gc-slot" title={`${WEAPONS[s.id].name}, level ${s.level} of ${WEAPON_TOP}. Overclocks at levels 5 and 10${oc ? `: ${oc}` : ''}.`}>
              <span className="gc-slot-top"><Icon id={s.id} size={26} /><b>{SHORT[s.id]}</b><em>{s.level}</em></span>
              {/* one step per level; levels 5 and 10 are the overclock picks */}
              <span className="gc-lv" data-testid={`slot-bar-${i}`}>
                {Array.from({ length: WEAPON_TOP }, (_, j) => <i key={j} className={`${j + 1 <= s.level ? 'on' : ''} ${OC_LEVELS.includes(j + 1) ? 'oc' : ''}`} />)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
