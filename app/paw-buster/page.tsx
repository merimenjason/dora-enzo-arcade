/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { PawBusterGame, STAGES, WEAPONS, PARTS, BADGES, CAPSULE_HINTS, TARGETS, MEDALS, SAVE_KEY, MAVERICKS, SUB_STAGES, SUB_CAP, ENERGY, NO_INPUT, VIEW_W, VIEW_H, parseProgress, saveProgress, exportCode, importCode, unlocked, weaponsFor, maxHp, freshProgress, copyProgress, changesFor, badgesFor, weaponDemo, demoInput, inputMask, unmask, encodeRun, decodeRun, type Input, type Progress, type StageId, type BossKind, type HeroId, type PartId, type WeaponId, type BadgeId } from '../../lib/paw-buster-game';
import { drawStage, drawBoss, drawHero, drawEnding, ENDING_LENGTH } from '../../lib/paw-buster-scene';
import './paw-buster.css';

type Action = keyof Input;
const ACTIONS: { key: Action; label: string }[] = [
  { key: 'left', label: 'Move left' }, { key: 'right', label: 'Move right' }, { key: 'jump', label: 'Jump' },
  { key: 'fire', label: 'Fire / slash (hold to charge)' }, { key: 'dash', label: 'Dash' }, { key: 'swap', label: 'Tag partner' },
  { key: 'prev', label: 'Previous weapon' }, { key: 'next', label: 'Next weapon' },
];
const DEFAULT_BINDS: Record<Action, string[]> = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], jump: ['Space', 'KeyK', 'KeyZ'],
  fire: ['KeyT', 'KeyJ', 'KeyX'], dash: ['KeyY', 'KeyL', 'KeyC', 'ShiftLeft', 'ShiftRight'],
  swap: ['KeyU', 'KeyV', 'KeyI'], prev: ['KeyQ'], next: ['KeyE'],
};
/** In co-op, player 2 (Enzo) uses the arrow keys and the keys beside them; player 1 keeps everything else. */
const P2_KEYS: Record<string, Action> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', Period: 'fire', Slash: 'dash', BracketLeft: 'prev', BracketRight: 'next', Numpad0: 'jump', Numpad1: 'fire', Numpad2: 'dash' };
/** Keys the game keeps for itself: pause, retry and page navigation. */
const RESERVED = ['KeyP', 'Escape', 'Enter', 'Tab'];
const PERSIST = ['tank', 'clear', 'sub', 'part', 'found', 'pickup', 'subuse', 'lost', 'badge'];
const PAD: { key: Action; label: string; name: string }[] = [
  { key: 'left', label: '◀', name: 'Move left' }, { key: 'right', label: '▶', name: 'Move right' },
  { key: 'swap', label: 'TAG', name: 'Tag partner' }, { key: 'next', label: 'WPN', name: 'Next weapon' },
  { key: 'dash', label: 'DASH', name: 'Dash' }, { key: 'fire', label: 'FIRE', name: 'Fire or slash' }, { key: 'jump', label: 'JUMP', name: 'Jump' },
];
/** Which weapon opens the wall in front of each hidden capsule. */
const HINT_WEAPON: Record<string, WeaponId> = { helmet: 'bubble', armor: 'quartz', arm: 'volt' };
const MEDAL_ICON = ['', '🥉', '🥈', '🥇'];
const SLOTS = [1, 2, 3];
const slotKey = (n: number) => (n === 1 ? SAVE_KEY : `${SAVE_KEY}-slot${n}`);

type Difficulty = 'easy' | 'normal' | 'hard';
type Settings = { difficulty: Difficulty; coop: boolean; music: boolean; ghost: boolean; shake: boolean; sfx: number; musicVol: number; slot: number; binds: Partial<Record<Action, string[]>> };
type GhostSave = { time: number; difficulty: Difficulty; progress: Progress; run: string };
const SETTINGS_KEY = 'paw-buster-x-settings', GHOST_KEY = 'paw-buster-x-ghosts';
const DEFAULTS: Settings = { difficulty: 'normal', coop: false, music: true, ghost: true, shake: true, sfx: 70, musicVol: 55, slot: 1, binds: {} };
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback);
function readSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return DEFAULTS;
    const binds: Settings['binds'] = {};
    for (const a of ACTIONS) { const b = v.binds?.[a.key]; if (Array.isArray(b) && b.every((k) => typeof k === 'string')) binds[a.key] = b; }
    // Saves from before hard mode stored easy as a checkbox.
    const difficulty: Difficulty = ['easy', 'normal', 'hard'].includes(v.difficulty) ? v.difficulty : v.easy === true ? 'easy' : 'normal';
    return {
      difficulty, coop: v.coop === true, music: v.music !== false, ghost: v.ghost !== false, shake: v.shake !== false,
      sfx: num(v.sfx, DEFAULTS.sfx), musicVol: num(v.musicVol, DEFAULTS.musicVol),
      slot: SLOTS.includes(v.slot) ? v.slot : 1, binds,
    };
  } catch { return DEFAULTS; }
}
function readGhosts(): Partial<Record<StageId, GhostSave>> {
  const out: Partial<Record<StageId, GhostSave>> = {};
  try {
    const v = JSON.parse(localStorage.getItem(GHOST_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return out;
    for (const s of STAGES) {
      const g = v[s.id];
      if (g && typeof g.time === 'number' && typeof g.run === 'string' && decodeRun(g.run).length) {
        const difficulty: Difficulty = ['easy', 'normal', 'hard'].includes(g.difficulty) ? g.difficulty : g.easy === true ? 'easy' : 'normal';
        out[s.id] = { time: g.time, difficulty, progress: parseProgress(saveProgress({ ...freshProgress(), ...g.progress })), run: g.run };
      }
    }
  } catch {}
  return out;
}
const bindsOf = (s: Settings): Record<Action, string[]> => ({ ...DEFAULT_BINDS, ...s.binds });
function keyMap(s: Settings, coop: boolean) {
  const m: Record<string, Action> = {};
  for (const [a, codes] of Object.entries(bindsOf(s))) for (const k of codes) if (!(coop && k in P2_KEYS)) m[k] = a as Action;
  return m;
}
const NAMES: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Period: '.', Slash: '/', Comma: ',', Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '-', Equal: '=', Backslash: '\\' };
const keyName = (code: string) => NAMES[code] ?? (code.replace(/^(Key|Digit)/, '').replace(/(Left|Right)$/, '') || code);
/** Key names to show, once each (left and right Shift both read "Shift"). */
const keyNames = (codes: string[]) => [...new Set(codes.map(keyName))];

/** Standard gamepad layout: d-pad or left stick to move, A jump, X fire, B or RT dash, Y tag, LB/RB weapons, Start pause. */
function padInput(p: Gamepad | undefined): Input {
  if (!p) return { ...NO_INPUT };
  const b = (i: number) => !!p.buttons[i]?.pressed, x = p.axes[0] ?? 0;
  return { left: b(14) || x < -0.4, right: b(15) || x > 0.4, jump: b(0), fire: b(2), dash: b(1) || b(7), swap: b(3), prev: b(4), next: b(5) };
}
const merge = (...xs: Input[]) => Object.fromEntries((Object.keys(NO_INPUT) as Action[]).map((k) => [k, xs.some((x) => x[k])])) as Input;

// A short chiptune loop for each stage and one for boss fights: sixteen sixteenth-note steps of
// semitone offsets from the root (null is a rest), a triangle bass under a square lead.
type Track = { bpm: number; root: number; bass: (number | null)[]; lead: (number | null)[] };
const _ = null;
const TRACKS: Record<StageId | 'boss', Track> = {
  snowcap: { bpm: 140, root: 64, bass: [0, _, 0, _, -5, _, -5, _, -2, _, -2, _, -7, _, -5, _], lead: [12, _, 15, 19, _, 17, 15, _, 12, _, 10, 12, _, 15, _, _] },
  cloud: { bpm: 124, root: 62, bass: [0, _, 7, _, 5, _, 7, _, 3, _, 10, _, 5, _, 7, _], lead: [7, 9, 12, _, 9, 7, 5, _, 7, _, 4, 5, 7, _, _, _] },
  caldera: { bpm: 150, root: 57, bass: [0, 0, _, 0, 3, _, 0, _, -2, -2, _, -2, 1, _, -2, _], lead: [12, _, 13, _, 15, 13, 12, _, 10, _, 12, _, 8, _, 7, _] },
  mines: { bpm: 132, root: 60, bass: [0, _, _, 0, -4, _, _, -4, -5, _, _, -5, -2, _, -1, _], lead: [15, _, 14, _, 12, _, 11, 12, _, 8, _, 7, 8, _, _, _] },
  salt: { bpm: 146, root: 65, bass: [0, _, 12, _, 0, _, 12, _, -3, _, 9, _, -5, _, 7, _], lead: [7, _, 12, 11, 12, _, 7, _, 5, _, 9, 7, 5, 4, _, _] },
  lake: { bpm: 118, root: 60, bass: [0, _, 7, _, 4, _, 7, _, -3, _, 4, _, -5, _, 2, _], lead: [16, _, 14, 12, _, 14, _, 16, 19, _, 16, _, 14, _, 12, _] },
  citadel: { bpm: 156, root: 55, bass: [0, 0, 12, 0, 0, 12, 0, 0, -2, -2, 10, -2, -4, -4, 8, -4], lead: [12, _, 15, _, 17, _, 18, 17, 15, _, 12, _, 10, _, 11, _] },
  boss: { bpm: 170, root: 57, bass: [0, 12, 0, 12, 1, 13, 1, 13, -2, 10, -2, 10, -1, 11, -1, 11], lead: [12, _, _, 12, 13, _, 12, _, 15, _, _, 13, 12, _, 10, _] },
};
function note(a: AudioContext, out: AudioNode, n: number | null, root: number, type: OscillatorType, gain: number, at: number, len: number) {
  if (n === null) return;
  const o = a.createOscillator(), v = a.createGain();
  o.type = type;
  o.frequency.value = 440 * 2 ** ((root + n - 69) / 12);
  v.gain.setValueAtTime(gain, at);
  v.gain.exponentialRampToValueAtTime(0.0005, at + len * 0.95);
  o.connect(v); v.connect(out); o.start(at); o.stop(at + len);
}
/** Each weapon's own sound: a sweep from one pitch to another. */
const WEAPON_CUE: Record<WeaponId, [number, number, OscillatorType]> = {
  buster: [900, 1300, 'square'], frost: [1500, 800, 'sine'], gale: [700, 1700, 'triangle'], ember: [420, 180, 'sawtooth'],
  quartz: [1100, 1900, 'square'], volt: [1900, 600, 'sawtooth'], bubble: [480, 1150, 'sine'],
};
const CUES: Record<string, [number, number, OscillatorType, number]> = {
  shot: [900, 1300, 'square', 0.05], blast: [300, 1200, 'sawtooth', 0.22], giga: [200, 1600, 'sawtooth', 0.5], slash: [500, 1500, 'triangle', 0.08], deflect: [1600, 2200, 'square', 0.05],
  jump: [420, 620, 'square', 0.06], dash: [200, 90, 'sawtooth', 0.1], hurt: [260, 90, 'sawtooth', 0.18], kill: [700, 120, 'square', 0.14],
  hit: [600, 400, 'square', 0.04], weak: [1200, 300, 'square', 0.16], swap: [520, 1040, 'triangle', 0.14], pickup: [880, 1320, 'sine', 0.1],
  tank: [660, 1760, 'sine', 0.4], sub: [660, 1760, 'sine', 0.4], part: [440, 1760, 'triangle', 0.5], subuse: [300, 1200, 'sine', 0.4],
  warning: [220, 220, 'square', 0.5], 'boss-down': [400, 60, 'sawtooth', 0.8], 'guardian-down': [500, 80, 'sawtooth', 0.5], clear: [523, 1046, 'triangle', 0.6], roar: [160, 70, 'sawtooth', 0.5],
  charge1: [300, 500, 'sine', 0.12], charge2: [500, 900, 'sine', 0.14], charge3: [900, 1500, 'sine', 0.2], lost: [300, 80, 'triangle', 0.7],
  checkpoint: [700, 1050, 'sine', 0.16], weapon: [800, 1000, 'square', 0.05], break: [900, 120, 'sawtooth', 0.3], revive: [400, 1400, 'sine', 0.5], badge: [1046, 1568, 'triangle', 0.5],
  stomp: [160, 60, 'square', 0.16], swoop: [900, 300, 'triangle', 0.2], 'enemy-shot': [700, 500, 'square', 0.04], fall: [400, 120, 'triangle', 0.3], down: [300, 100, 'sawtooth', 0.4],
};
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const mins = (t: number) => (t < 3600 ? `${Math.round(t / 60)} min` : `${(t / 3600).toFixed(1)} h`);

function Sprite({ boss, hero, scale = 1.45 }: { boss?: BossKind; hero?: HeroId; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 128, 96);
    c.save();
    c.translate(64, 88);
    c.scale(scale, scale);
    if (boss) drawBoss(c, boss, 0.4);
    if (hero) drawHero(c, hero, { charge: hero === 'dora' ? 1 : 0 });
    c.restore();
  }, [boss, hero, scale]);
  return <canvas ref={ref} width={128} height={96} aria-hidden="true" className="pb-sprite" />;
}

/** The weapon-get screen's little showcase: a looping demo of the weapon you just won. */
function WeaponDemo({ weapon }: { weapon: WeaponId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    const g = weaponDemo(weapon);
    let raf = 0, t = 0;
    const loop = () => {
      for (let i = 0; i < 2; i++) { g.energy[weapon] = ENERGY; g.step(1 / 120, demoInput(t)); t += 1 / 120; }
      g.events.length = 0;
      drawStage(c, g, t, null, { shake: false });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [weapon]);
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} aria-hidden="true" className="pb-demo" />;
}

export default function PawBuster() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<PawBusterGame | null>(null);
  const ghost = useRef<{ game: PawBusterGame; inputs: number[]; i: number } | null>(null);
  const recording = useRef<{ masks: number[]; progress: Progress; difficulty: Difficulty } | null>(null);
  const keys = useRef<Input>({ ...NO_INPUT });
  const keys2 = useRef<Input>({ ...NO_INPUT });
  const touch = useRef<Input>({ ...NO_INPUT });
  const latch = useRef<Input>({ ...NO_INPUT });
  const latch2 = useRef<Input>({ ...NO_INPUT });
  const sound = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const mix = useRef<{ sfx: GainNode; music: GainNode } | null>(null);
  const ending = useRef<number | null>(null);
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [ghosts, setGhosts] = useState<Partial<Record<StageId, GhostSave>>>({});
  const [listening, setListening] = useState<Action | null>(null);
  const [pads, setPads] = useState(0);
  const [run, setRun] = useState(0);
  const [, setFrame] = useState(0);
  const [audible, setAudible] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState(false);
  const [code, setCode] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const g = game.current;

  // Stage buttons stay disabled until the page is interactive and the save has been read.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = readSettings();
      setSettings(s);
      setProgress(parseProgress(localStorage.getItem(slotKey(s.slot))));
      setGhosts(readGhosts());
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { settingsRef.current = settings; if (mix.current) { mix.current.sfx.gain.value = settings.sfx / 100; mix.current.music.gain.value = settings.musicVol / 100; } }, [settings]);
  useEffect(() => {
    const count = () => setPads([...(navigator.getGamepads?.() ?? [])].filter(Boolean).length);
    window.addEventListener('gamepadconnected', count);
    window.addEventListener('gamepaddisconnected', count);
    return () => { window.removeEventListener('gamepadconnected', count); window.removeEventListener('gamepaddisconnected', count); };
  }, []);
  const persist = (p: Progress) => { setProgress(copyProgress(p)); try { localStorage.setItem(slotKey(settingsRef.current.slot), saveProgress(p)); } catch {} };
  const saveSettings = (s: Settings) => { setSettings(s); try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} };
  const option = (k: 'coop' | 'music' | 'ghost' | 'shake') => (e: ChangeEvent<HTMLInputElement>) => saveSettings({ ...settings, [k]: e.target.checked });
  const slider = (k: 'sfx' | 'musicVol') => (e: ChangeEvent<HTMLInputElement>) => saveSettings({ ...settings, [k]: Number(e.target.value) });
  function switchSlot(n: number) {
    saveSettings({ ...settings, slot: n });
    try { setProgress(parseProgress(localStorage.getItem(slotKey(n)))); } catch { setProgress(freshProgress()); }
    setConfirmReset(false);
    setCodeNote('');
  }

  /** The audio graph: every sound goes through a sound-effect or music volume control. */
  function mixer() {
    audio.current ??= new AudioContext();
    const a = audio.current;
    if (!mix.current) {
      const s = settingsRef.current, sfx = a.createGain(), music = a.createGain();
      sfx.gain.value = s.sfx / 100;
      music.gain.value = s.musicVol / 100;
      sfx.connect(a.destination);
      music.connect(a.destination);
      mix.current = { sfx, music };
    }
    return { a, ...mix.current };
  }
  function tone(event: string) {
    if (!sound.current) return;
    // Special weapons have their own sound, louder and longer when charged.
    const weapon = event.startsWith('special-') || event.startsWith('charged-') ? (event.split('-')[1] as WeaponId) : null;
    const cue = weapon ? [...WEAPON_CUE[weapon], event.startsWith('charged-') ? 0.3 : 0.12] as [number, number, OscillatorType, number] : CUES[event];
    if (!cue) return;
    try {
      const { a, sfx } = mixer();
      const o = a.createOscillator(), v = a.createGain(), t = a.currentTime;
      void a.resume();
      o.type = cue[2];
      o.frequency.setValueAtTime(cue[0], t);
      o.frequency.exponentialRampToValueAtTime(cue[1], t + cue[3]);
      v.gain.setValueAtTime(0.03, t);
      v.gain.exponentialRampToValueAtTime(0.001, t + cue[3] + 0.04);
      o.connect(v); v.connect(sfx); o.start(); o.stop(t + cue[3] + 0.05);
    } catch {}
  }

  function start(id: StageId, gallery = false) {
    const s = settings, best = gallery ? undefined : ghosts[id];
    const opts = { easy: s.difficulty === 'easy', hard: s.difficulty === 'hard', coop: s.coop, gallery };
    game.current = new PawBusterGame(id, progress, opts);
    // Race the recorded best run, replayed in a second game from the same save and options.
    ghost.current = !s.coop && best && best.difficulty === s.difficulty ? { game: new PawBusterGame(id, best.progress, { easy: best.difficulty === 'easy', hard: best.difficulty === 'hard' }), inputs: decodeRun(best.run), i: 0 } : null;
    recording.current = s.coop || gallery ? null : { masks: [], progress: copyProgress(progress), difficulty: s.difficulty };
    ending.current = null;
    keys.current = { ...NO_INPUT };
    keys2.current = { ...NO_INPUT };
    touch.current = { ...NO_INPUT };
    setConfirmReset(false);
    setAnnounce(`${game.current.stage.name}. Ready.`);
    setRun((n) => n + 1);
  }
  function leave() { if (game.current) persist(game.current.progress); game.current = null; ghost.current = null; ending.current = null; setRun((n) => n + 1); }
  function pause() { game.current?.pause(); setFrame((n) => n + 1); canvas.current?.focus(); }
  function retry() { game.current?.retry(); setFrame((n) => n + 1); canvas.current?.focus(); }
  /** Keep the recorded run as the stage's ghost when it set a new best without a retry. */
  function keepGhost(gm: PawBusterGame) {
    const rec = recording.current;
    if (!rec || gm.coop || gm.gallery || gm.retries || !gm.newBest) return;
    const id = gm.stage.id, save: GhostSave = { time: gm.time, difficulty: rec.difficulty, progress: rec.progress, run: encodeRun(rec.masks) };
    setGhosts((prev) => {
      const next = { ...prev, [id]: save };
      try { localStorage.setItem(GHOST_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (!game.current) return;
    const c = canvas.current?.getContext('2d');
    if (!c) { setError(true); return; }
    canvas.current?.focus();
    let raf = 0, last = 0, acc = 0, ui = 0, banner = '', startWas = false;
    const loop = (now: number) => {
      const gm = game.current;
      if (!gm) return;
      acc += last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      // Gamepads: in single play every pad drives the hero; in co-op the first pad is player 2 and the second player 1.
      const list = [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p);
      const pad1 = gm.coop ? padInput(list[1]) : merge(NO_INPUT, ...list.map(padInput)), pad2 = gm.coop ? padInput(list[0]) : { ...NO_INPUT };
      const startNow = list.some((p) => p.buttons[9]?.pressed);
      if (startNow && !startWas) { if (gm.state === 'lost') retry(); else pause(); }
      startWas = startNow;
      // A tap shorter than a frame still counts: latched presses last until one step has seen them.
      const k = keys.current, t = touch.current, l = latch.current, k2 = keys2.current, l2 = latch2.current;
      while (acc >= 1 / 120) {
        const p1 = merge(k, t, l, pad1), p2 = merge(k2, l2, pad2), was = gm.state;
        gm.step(1 / 120, p1, p2);
        latch.current = { ...NO_INPUT };
        latch2.current = { ...NO_INPUT };
        if (was !== 'paused') {
          recording.current?.masks.push(inputMask(p1));
          const gh = ghost.current;
          if (gh) { gh.game.step(1 / 120, unmask(gh.inputs[gh.i] ?? 0)); gh.i++; gh.game.events.length = 0; }
        }
        acc -= 1 / 120;
      }
      for (const e of gm.events.splice(0)) {
        tone(e);
        if (PERSIST.includes(e)) persist(gm.progress);
        if (e === 'clear') { keepGhost(gm); if (gm.victory) ending.current = now / 1000; }
      }
      if (gm.banner.text !== banner && gm.banner.t > 0) { banner = gm.banner.text; setAnnounce(banner); }
      if (ending.current !== null) drawEnding(c, now / 1000 - ending.current, STORY, CREDITS);
      else {
        const gh = ghost.current && settingsRef.current.ghost ? ghost.current.game : null;
        drawStage(c, gm, now / 1000, gh ? { hero: gh.hero, body: gh.player, part: gh.part } : null, { shake: settingsRef.current.shake });
      }
      if (now - ui > 100) { setFrame((n) => n + 1); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const typing = (e: Event) => !!(e.target as HTMLElement).closest('input,textarea,select');
    const route = (code: string, coop: boolean): [Action, 1 | 2] | null => {
      if (coop && P2_KEYS[code]) return [P2_KEYS[code], 2];
      const a = keyMap(settingsRef.current, coop)[code];
      return a ? [a, 1] : null;
    };
    const down = (e: KeyboardEvent) => {
      const gm = game.current;
      if (!gm || typing(e)) return;
      if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) pause(); return; }
      if (e.code === 'Enter' && gm.state === 'lost' && !(e.target as HTMLElement).closest('button')) { e.preventDefault(); retry(); return; }
      const hit = route(e.code, gm.coop);
      if (!hit) return;
      if ((e.target as HTMLElement).closest('button,a') && e.code === 'Space') return;
      e.preventDefault();
      const [key, who] = hit;
      (who === 2 ? keys2 : keys).current[key] = true;
      if (!e.repeat) (who === 2 ? latch2 : latch).current[key] = true;
    };
    const up = (e: KeyboardEvent) => { const hit = route(e.code, !!game.current?.coop); if (hit) (hit[1] === 2 ? keys2 : keys).current[hit[0]] = false; };
    const blur = () => { keys.current = { ...NO_INPUT }; keys2.current = { ...NO_INPUT }; const gm = game.current; if (gm && (gm.state === 'play' || gm.state === 'boss')) { gm.pause(); setFrame((n) => n + 1); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [run]);
  useEffect(() => () => { void audio.current?.close(); audio.current = null; mix.current = null; }, []);

  // Music: schedules a little ahead of the audio clock while a stage is running and sound is on.
  useEffect(() => {
    if (!audible || !settings.music) return;
    let step = 0, next = 0, track = '';
    const id = window.setInterval(() => {
      const gm = game.current, a = audio.current, out = mix.current?.music;
      if (!gm || !a || !out || !['ready', 'play', 'boss'].includes(gm.state)) { next = 0; return; }
      const key: StageId | 'boss' = gm.boss ? 'boss' : gm.stage.id;
      if (key !== track) { track = key; step = 0; next = 0; }
      const tr = TRACKS[key], len = 60 / tr.bpm / 4;
      if (next < a.currentTime) next = a.currentTime + 0.05;
      while (next < a.currentTime + 0.15) {
        note(a, out, tr.bass[step % 16], tr.root - 24, 'triangle', 0.05, next, len);
        note(a, out, tr.lead[step % 16], tr.root, 'square', 0.014, next, len);
        step++;
        next += len;
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [audible, settings.music, run]);

  // Key remapping: the next key pressed becomes the only key for the chosen action.
  useEffect(() => {
    if (!listening) return;
    const on = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') { setListening(null); return; }
      if (RESERVED.includes(e.code)) return;
      const binds = bindsOf(settings), next: Settings['binds'] = {};
      for (const a of ACTIONS) next[a.key] = binds[a.key].filter((k) => k !== e.code);
      next[listening] = [e.code];
      saveSettings({ ...settings, binds: next });
      setListening(null);
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [listening, settings]);

  const press = (key: Action, on: boolean) => { touch.current[key] = on; if (on) latch.current[key] = true; };
  const tanks = progress.tanks.length, arsenal = weaponsFor(progress);
  const clearedAll = MAVERICKS.every((s) => progress.cleared.includes(s));
  const beaten = progress.cleared.includes('citadel');
  const stage = g?.stage;
  const binds = bindsOf(settings);
  const parts = Object.keys(PARTS) as PartId[];
  const found = parts.filter((k) => progress.parts.includes(k)).length + tanks + progress.subs.length;
  const total = parts.length + MAVERICKS.length + SUB_STAGES.length;
  // Capsule hints only appear once you hold the weapon that opens the wall.
  const hints = parts.filter((k) => !progress.parts.includes(k) && CAPSULE_HINTS[k] && arsenal.includes(HINT_WEAPON[k]));
  const showEnding = ending.current !== null;

  return (
    <main className="pb-shell">
      <header className="pb-header">
        <a href="/">← MAIN ARCADE <span>PAW BUSTER X</span></a>
        <div className="pb-header-tools">
          {g && <button type="button" onClick={leave}>Stage select</button>}
          <button type="button" aria-pressed={audible} onClick={() => { sound.current = !sound.current; setAudible(sound.current); tone('pickup'); }}>Sound {audible ? 'on' : 'off'}</button>
        </div>
      </header>
      <p className="pb-sr" aria-live="polite">{announce}</p>

      {!g && (
        <section className="pb-select" aria-labelledby="pb-select-title">
          <div className="pb-intro">
            <div className="pb-heroes"><Sprite hero="dora" /><Sprite hero="enzo" /></div>
            <div>
              <p className="pb-eyebrow">A MEGA MAN X-STYLE ACTION PLATFORMER</p>
              <h1 id="pb-select-title">Paw Buster X</h1>
              <p className="pb-lede">Six mavericks have taken the Andes. <b>Dora</b> charges her paw buster, <b>Enzo</b> swings his whisker saber, and the two tag in and out. Beat a maverick to take its weapon, then find the boss it’s weak to — and the walls that weapon opens.</p>
            </div>
          </div>
          <h2 className="pb-section">Choose a stage</h2>
          <div className="pb-stages">
            {STAGES.map((s) => {
              const open = unlocked(progress, s.id), done = progress.cleared.includes(s.id), best = progress.best[s.id];
              const mine = parts.filter((k) => PARTS[k].from === s.id && progress.parts.includes(k));
              const rank = progress.ranks[s.id], medal = progress.medals[s.id] ?? 0;
              return (
                <button key={s.id} type="button" className={`pb-stage stage-${s.id}${done ? ' done' : ''}`} disabled={!loaded || !open} onClick={() => start(s.id)} data-testid={`stage-${s.id}`}>
                  <Sprite boss={s.boss} />
                  <strong>{s.bossName}</strong>
                  <span>{s.name}</span>
                  <small>{!open ? '🔒 Defeat all six mavericks to open' : s.blurb}</small>
                  {open && changesFor(progress, s.id).map((c) => <small key={c.by} className="pb-change">✦ {c.text}</small>)}
                  {open && <small className="pb-target">🥇 {clock(TARGETS[s.id][0])} · 🥈 {clock(TARGETS[s.id][1])} · 🥉 {clock(TARGETS[s.id][2])}</small>}
                  {rank && <small className="pb-rank" data-testid={`rank-${s.id}`}>Rank {rank}{medal ? ` · ${MEDAL_ICON[medal]} ${MEDALS[medal]}` : ''}</small>}
                  {open && <small className="pb-badges">{badgesFor(s.id).map((b) => <span key={b} className={progress.badges.includes(`${s.id}:${b}`) ? 'on' : ''} title={`${BADGES[b].name}: ${BADGES[b].detail}`}>{BADGES[b].icon}</span>)}</small>}
                  <em>
                    {done ? `✓ Cleared${best ? ` · best ${clock(best)}` : ''}` : open ? 'Not yet cleared' : 'Locked'}
                    {progress.tanks.includes(s.id) && ' · ♥ tank'}
                    {progress.subs.includes(s.id) && ' · sub-tank'}
                    {mine.map((k) => ` · ${PARTS[k].name}`)}
                    {done && s.weapon && ` · ${WEAPONS[s.weapon].name}`}
                    {ghosts[s.id] && ' · 👻 ghost'}
                  </em>
                </button>
              );
            })}
          </div>
          <div className="pb-summary">
            <p data-testid="summary">♥ Heart tanks {tanks}/{MAVERICKS.length} · Sub-tanks {progress.subs.length}/{SUB_STAGES.length} · Armour {progress.parts.length}/{parts.length} · Max health {maxHp(progress)} · Weapons: {arsenal.map((w) => WEAPONS[w].name).join(', ')}{progress.parts.length ? ` · Parts: ${progress.parts.map((k) => PARTS[k].name).join(', ')}` : ''}{clearedAll && beaten ? ' · The Andes are safe!' : ''}</p>
            <button type="button" className="pb-reset" disabled={!progress.cleared.length && !tanks && !progress.subs.length && !progress.parts.length} onClick={() => { if (confirmReset) { persist(freshProgress()); setConfirmReset(false); } else setConfirmReset(true); }}>{confirmReset ? 'Press again to erase this slot' : 'Reset progress'}</button>
          </div>
          {hints.length > 0 && (
            <ul className="pb-hints">
              {hints.map((k) => <li key={k}>🔍 <b>{PARTS[k].name}</b> — {CAPSULE_HINTS[k]}</li>)}
            </ul>
          )}
          <fieldset className="pb-options">
            <legend>Options</legend>
            <div className="pb-difficulty" role="radiogroup" aria-label="Difficulty">
              <label><input type="radio" name="pb-difficulty" checked={settings.difficulty === 'easy'} onChange={() => saveSettings({ ...settings, difficulty: 'easy' })} data-testid="opt-easy" /> Easy <small>Half damage, and pits don’t hurt.</small></label>
              <label><input type="radio" name="pb-difficulty" checked={settings.difficulty === 'normal'} onChange={() => saveSettings({ ...settings, difficulty: 'normal' })} data-testid="opt-normal" /> Normal</label>
              <label><input type="radio" name="pb-difficulty" checked={settings.difficulty === 'hard'} disabled={!beaten} onChange={() => saveSettings({ ...settings, difficulty: 'hard' })} data-testid="opt-hard" /> Hard <small>{beaten ? 'Tougher enemies and bosses, with an extra volley after every move.' : 'Unlocks once you beat the Cougar Citadel.'}</small></label>
            </div>
            <label><input type="checkbox" checked={settings.coop} onChange={option('coop')} data-testid="opt-coop" /> Two players <small>Dora and Enzo on screen together. Player 2 uses the arrow keys, ↑ to jump, . to fire, / to dash and [ ] for weapons, or a gamepad.</small></label>
            <label><input type="checkbox" checked={settings.music} onChange={option('music')} /> Music <small>Plays while sound is on.</small></label>
            <label><input type="checkbox" checked={settings.ghost} onChange={option('ghost')} /> Best-time ghost <small>Race a replay of your fastest clean run.</small></label>
            <label><input type="checkbox" checked={settings.shake} onChange={option('shake')} data-testid="opt-shake" /> Screen shake <small>Big hits shake the view.</small></label>
            <div className="pb-sliders">
              <label>Sound effects <input type="range" min={0} max={100} step={5} value={settings.sfx} onChange={slider('sfx')} data-testid="vol-sfx" /> <span>{settings.sfx}%</span></label>
              <label>Music volume <input type="range" min={0} max={100} step={5} value={settings.musicVol} onChange={slider('musicVol')} data-testid="vol-music" /> <span>{settings.musicVol}%</span></label>
            </div>
          </fieldset>

          {progress.cleared.length > 0 && (
            <details className="pb-keys pb-gallery">
              <summary>Boss gallery</summary>
              <p>Refight any boss you’ve beaten, on its own, for a best time.</p>
              <ul>
                {STAGES.filter((s) => progress.cleared.includes(s.id)).map((s) => (
                  <li key={s.id}>
                    <span>{s.bossName}</span>
                    <span>{progress.bossBest[s.id] ? `best ${clock(progress.bossBest[s.id]!)}` : 'no time yet'}</span>
                    <button type="button" onClick={() => start(s.id, true)} data-testid={`gallery-${s.id}`}>Refight</button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="pb-keys">
            <summary>Saves and records</summary>
            <div className="pb-slots">
              {SLOTS.map((n) => <button key={n} type="button" aria-pressed={settings.slot === n} onClick={() => switchSlot(n)} data-testid={`slot-${n}`}>Slot {n}{settings.slot === n ? ' ·  in use' : ''}</button>)}
            </div>
            <p data-testid="stats">Slot {settings.slot} · {progress.cleared.length}/{STAGES.length} stages cleared · {found}/{total} collectibles · {progress.badges.length} challenge badges · {progress.deaths} defeat{progress.deaths === 1 ? '' : 's'} · {mins(progress.playTime)} played</p>
            <p className="pb-code">
              <label htmlFor="pb-code-out">Save code (copy it to another browser)</label>
              <input id="pb-code-out" readOnly value={exportCode(progress)} data-testid="save-code" onFocus={(e) => e.currentTarget.select()} />
            </p>
            <p className="pb-code">
              <label htmlFor="pb-code-in">Load a save code</label>
              <input id="pb-code-in" value={code} placeholder="PBX3-…" onChange={(e) => { setCode(e.target.value); setCodeNote(''); }} data-testid="load-code" />
              <button type="button" onClick={() => { const p = importCode(code); if (p) { persist(p); setCode(''); setCodeNote('Save loaded into this slot.'); } else setCodeNote('That isn’t a Paw Buster X save code.'); }}>Load</button>
            </p>
            {codeNote && <p data-testid="code-note">{codeNote}</p>}
          </details>

          <details className="pb-keys">
            <summary>Customise keys</summary>
            <p>Choose Change, then press the new key. Esc cancels. P, Esc, Enter and Tab are kept for pausing and menus.{pads ? ` 🎮 ${pads} gamepad${pads > 1 ? 's' : ''} connected.` : ''}</p>
            <ul>
              {ACTIONS.map((a) => (
                <li key={a.key}>
                  <span>{a.label}</span>
                  <span data-testid={`keys-${a.key}`}>{binds[a.key].length ? keyNames(binds[a.key]).map((k) => <kbd key={k}>{k}</kbd>) : <i>unbound</i>}</span>
                  <button type="button" onClick={() => setListening(listening === a.key ? null : a.key)} data-testid={`bind-${a.key}`}>{listening === a.key ? 'Press a key…' : 'Change'}</button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => saveSettings({ ...settings, binds: {} })} disabled={!Object.keys(settings.binds).length}>Reset to defaults</button>
          </details>
          <Controls binds={binds} coop={settings.coop} />
        </section>
      )}

      {g && stage && (
        <section className="pb-board" aria-label="Paw Buster X game">
          <div className="pb-canvas-wrap" data-testid="board" data-state={g.state} data-hero={g.hero} data-x={Math.round(g.player.x)} data-weapon={g.weaponId} data-part={g.part} data-ghost={ghost.current ? Math.round(ghost.current.game.player.x) : ''}>
            <canvas ref={canvas} width={VIEW_W} height={VIEW_H} tabIndex={0} aria-label={`${stage.name}. The controls are listed below the game.`} />
            {(g.state === 'paused' || g.state === 'lost' || (g.state === 'clear' && !showEnding) || error) && (
              <div className="pb-overlay">
                <div>
                  {error && <><p className="pb-eyebrow">CANVAS UNAVAILABLE</p><h2>Please try another browser.</h2></>}
                  {g.state === 'paused' && <>
                    <p className="pb-eyebrow">PAUSED · {stage.name.toUpperCase()}</p>
                    <h2>Take a breather.</h2>
                    <ul className="pb-arsenal">
                      {g.weapons.map((w) => {
                        const beats = STAGES.find((s) => s.weakness === w && g.progress.found.includes(s.id));
                        return <li key={w} className={w === g.weaponId ? 'on' : ''}><b style={{ color: WEAPONS[w].color }}>{WEAPONS[w].name}</b>{w !== 'buster' && <span> · {g.energy[w]}/{ENERGY}</span>}{beats && <span> · strong against {beats.bossName}</span>}<small>{WEAPONS[w].detail} Charged: {WEAPONS[w].charged}</small></li>;
                      })}
                      {g.progress.parts.map((k) => <li key={k}><b>{PARTS[k].name}</b><small>{PARTS[k].detail}</small></li>)}
                    </ul>
                    {g.progress.subs.length > 0 && <div className="pb-subs">
                      {g.progress.subs.map((s, i) => { const fill = g.progress.subFill[i] ?? 0; return <button key={s} type="button" disabled={!fill} data-testid={`sub-${i}`} onClick={() => { if (g.useSub(i)) setFrame((n) => n + 1); }}>Sub-tank {i + 1} · {fill}/{SUB_CAP}</button>; })}
                    </div>}
                    <div className="pb-actions"><button type="button" className="pb-primary" onClick={pause}>Resume</button><button type="button" onClick={leave}>Stage select</button></div>
                  </>}
                  {g.state === 'lost' && <>
                    <p className="pb-eyebrow">{g.coop ? 'BOTH PLAYERS ARE DOWN' : 'BOTH HEROES ARE DOWN'}</p>
                    <h2>One more try?</h2>
                    <p>You’ll restart {g.checkpoint >= 0 ? 'at the last checkpoint' : 'from the start of this sector'} with full health. Heart tanks, sub-tanks and armour parts you found are kept.</p>
                    <div className="pb-actions"><button type="button" className="pb-primary" onClick={retry}>Retry from checkpoint</button><button type="button" onClick={leave}>Stage select</button></div>
                  </>}
                  {g.state === 'clear' && <>
                    <p className="pb-eyebrow">{g.gallery ? 'REFIGHT WON' : `${stage.bossName.toUpperCase()} DEFEATED`}</p>
                    <h2>{g.gallery ? `${stage.bossName} down` : stage.weapon ? `Weapon get: ${WEAPONS[stage.weapon].name}` : 'Stage clear'}</h2>
                    {!g.gallery && stage.weapon && <WeaponDemo weapon={stage.weapon} />}
                    <p>{g.gallery ? 'A gallery win counts only for its own best time.' : stage.weapon ? `${WEAPONS[stage.weapon].detail} Hold fire to charge it: ${WEAPONS[stage.weapon].charged.toLowerCase()} Press Q or E to switch weapons.` : ''}</p>
                    <p className="pb-time">Time {clock(g.time)}{g.newBest ? ' · new best!' : ''}{g.newBest && !g.coop && !g.gallery && !g.retries ? ' · saved as your ghost' : ''}</p>
                    {g.rank && <p className="pb-rank-big" data-testid="result-rank">Rank {g.rank}{g.medal ? ` · ${MEDAL_ICON[g.medal]} ${MEDALS[g.medal]} medal` : ''}<small>{g.damage} damage taken · {g.kills}/{g.enemyTotal} enemies</small></p>}
                    {g.earned.length > 0 && <p className="pb-earned">New badges: {g.earned.map((b: BadgeId) => `${BADGES[b].icon} ${BADGES[b].name}`).join(' · ')}</p>}
                    <div className="pb-actions"><button type="button" className="pb-primary" onClick={leave}>Stage select</button></div>
                  </>}
                </div>
              </div>
            )}
            {showEnding && (
              <div className="pb-ending">
                <button type="button" onClick={() => { ending.current = null; leave(); }}>{(performance.now() / 1000 - (ending.current ?? 0)) > ENDING_LENGTH ? 'Stage select' : 'Skip'}</button>
                <p>Total time {mins(progress.playTime)} · {progress.deaths} defeats · {found}/{total} collectibles · {progress.badges.length} badges</p>
              </div>
            )}
          </div>
          <p className="pb-status" data-testid="status">{g.status}{g.easy ? ' · Easy' : ''}{g.hard ? ' · Hard' : ''}</p>
          <p className="pb-rotate">Turn your phone sideways for a bigger view.</p>
          <div className="pb-pad">
            {PAD.map((b) => (
              <button key={b.key} type="button" className={`pad-${b.key}`} aria-label={b.name}
                onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); press(b.key, true); }}
                onPointerUp={() => press(b.key, false)} onPointerCancel={() => press(b.key, false)} onLostPointerCapture={() => press(b.key, false)}
                onContextMenu={(e) => e.preventDefault()}>{b.label}</button>
            ))}
          </div>
          <div className="pb-bar">
            <button type="button" onClick={pause} disabled={!['play', 'boss', 'paused'].includes(g.state)}>{g.state === 'paused' ? '▶ Resume' : 'Ⅱ Pause'}</button>
            <span>Weakness hint: every maverick flinches from the weapon of another.</span>
          </div>
          <Controls binds={binds} coop={g.coop} />
        </section>
      )}
    </main>
  );
}

const STORY = [
  'The mavericks are quiet. The dust settles over the Andes.',
  'Dora packs away her buster. Enzo sheathes his whisker saber.',
  'The long walk home begins, with the Cougar Citadel dark behind them.',
  'Somewhere below, a chinchilla village puts the kettle on.',
  'Next stop: a very long dust bath.',
];
const CREDITS = [
  'PAW BUSTER X', 'Dora & Enzo’s Arcade', '',
  'STARRING', 'Dora, white chinchilla', 'Enzo, grey chinchilla', '',
  'MAVERICKS', 'Frost Fox', 'Storm Owl', 'Magma Snake', 'Quartz Armadillo', 'Volt Vicuña', 'Tide Toad', 'Cougar Kingpin', '',
  'ENGINE', 'A deterministic fixed-step simulation', 'Canvas 2D art, no image assets', '',
  'THANK YOU FOR PLAYING', 'The Andes are safe.',
];

function Controls({ binds, coop }: { binds: Record<Action, string[]>; coop: boolean }) {
  const keysFor = (...as: Action[]) => as.flatMap((a) => binds[a].filter((k) => !(coop && k in P2_KEYS)));
  const show = (codes: string[]) => codes.length ? keyNames(codes).map((k, i) => <span key={k}>{i ? ' / ' : ''}<kbd>{k}</kbd></span>) : <i>unbound</i>;
  return (
    <dl className="pb-controls">
      {coop && <div><dt>Player 1 · Dora</dt><dd>the keys below</dd></div>}
      <div><dt>{show(keysFor('left', 'right'))}</dt><dd>Move</dd></div>
      <div><dt>{show(keysFor('jump'))}</dt><dd>Jump; hold for height. Jump against a wall to wall-jump. In a waterfall, hold jump with Bubble Burst to float up.</dd></div>
      <div><dt>{show(keysFor('fire'))}</dt><dd>Fire. Hold to charge Dora’s buster or any special weapon. Enzo: saber slash.</dd></div>
      <div><dt>{show(keysFor('dash'))}</dt><dd>Dash; hold while jumping to dash-jump. With Dash Boots, dash in mid-air.</dd></div>
      {!coop && <div><dt>{show(keysFor('swap'))}</dt><dd>Tag your partner in (tag strike: ×1.5 damage for 2 s)</dd></div>}
      <div><dt>{show(keysFor('prev', 'next'))}</dt><dd>Switch weapon</dd></div>
      {coop && <div><dt>Player 2 · Enzo</dt><dd><kbd>←</kbd><kbd>→</kbd> move, <kbd>↑</kbd> jump, <kbd>.</kbd> fire, <kbd>/</kbd> dash, <kbd>[</kbd><kbd>]</kbd> weapons, or a gamepad</dd></div>}
      {coop && <div><dt>Revive</dt><dd>Stand by a fallen partner for 2 seconds, or reach the next checkpoint</dd></div>}
      <div><dt><kbd>P</kbd> / <kbd>Esc</kbd></dt><dd>Pause (sub-tanks are on the pause screen)</dd></div>
      <div><dt>🎮 Gamepad</dt><dd>D-pad or stick to move, A jump, X fire, B or RT dash, Y tag, LB / RB weapons, Start pause</dd></div>
    </dl>
  );
}
