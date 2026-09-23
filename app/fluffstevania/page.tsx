/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  FluffstevaniaGame, VIEW_W, VIEW_H, NO_INPUT, GEAR, FOOD, RELICS, SHOP, SUBS, SPELLS, PALS, LORE, FOES, BOSSES, BOSS_KILLS, AREAS, ROOMS, DIFFICULTY, DUO_MAX,
  parseSave, freshSave, xpToNext, itemName, palXpToNext,
  type Input, type Save, type HeroId, type Slot, type Line, type Difficulty, type PalId, type BossId, type SubId, type SpellId,
} from '../../lib/fluffstevania-game';
import { drawGame, drawMap, mapLayout, gearIcon, subIcon, drawPal, drawFoeIcon, mapIcon, MAP_LEGEND, type MapMark } from '../../lib/fluffstevania-scene';
import { Music } from '../../lib/fluffstevania-music';
import { ChinchillaPortrait } from '../../components/chinchilla-portrait';
import './fluffstevania.css';

const SCALE = 3, DT = 1 / 120;
const SAVE_KEY = 'fluffstevania-v1';
type Action = keyof Input | 'menu';
const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'attack', KeyJ: 'attack',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash', KeyC: 'tag', KeyE: 'tag', KeyF: 'spell', KeyV: 'duo', KeyQ: 'duo',
  Escape: 'menu', Enter: 'menu', KeyM: 'menu', KeyP: 'menu', Tab: 'menu',
};
const PAD: { key: keyof Input; label: string; name: string }[] = [
  { key: 'left', label: '◀', name: 'Move left' }, { key: 'right', label: '▶', name: 'Move right' },
  { key: 'up', label: '▲', name: 'Up: read signs, and with attack throw a seed' }, { key: 'down', label: '▼', name: 'Down: drop through ledges with jump' },
  { key: 'tag', label: 'TAG', name: 'Tag your partner in' }, { key: 'dash', label: 'DASH', name: 'Dust Dash' },
  { key: 'spell', label: 'SPELL', name: 'Cast the lead’s spell' }, { key: 'duo', label: 'DUO', name: 'Duo Strike, when the meter is full' },
  { key: 'attack', label: 'HIT', name: 'Attack' }, { key: 'jump', label: 'JUMP', name: 'Jump' },
];
const CUES: Record<string, [number, number, OscillatorType, number]> = {
  jump: [380, 620, 'square', 0.07], dash: [220, 90, 'sawtooth', 0.14], thrust: [1500, 600, 'triangle', 0.08], swipe: [1200, 500, 'triangle', 0.06],
  hop: [600, 1100, 'sine', 0.1], squeak: [1800, 2400, 'square', 0.06], roar: [160, 70, 'sawtooth', 0.6], drop: [900, 300, 'sine', 0.12],
  buy: [880, 1760, 'square', 0.12], shop: [660, 990, 'triangle', 0.15], orb: [1500, 2300, 'sine', 0.05],
  mist: [900, 300, 'sine', 0.3], snap: [700, 1400, 'square', 0.06], squish: [260, 120, 'sine', 0.15], fire: [500, 180, 'sawtooth', 0.22], laugh: [300, 520, 'triangle', 0.4],
  fan: [1100, 700, 'triangle', 0.08], finisher: [700, 1500, 'square', 0.14], spin: [400, 1200, 'triangle', 0.3], spell: [300, 1200, 'sine', 0.4],
  fizzle: [300, 150, 'square', 0.15], burst: [220, 80, 'sawtooth', 0.3], duo: [300, 1800, 'square', 0.6], duoready: [880, 1320, 'triangle', 0.3],
  nip: [1600, 1200, 'square', 0.05], bonk: [500, 300, 'square', 0.1], secret: [1320, 1760, 'sine', 0.5], dust: [1000, 1500, 'sine', 0.12], warp: [200, 1600, 'sine', 0.6],
  club: [240, 110, 'square', 0.12], hit: [300, 120, 'square', 0.08], crit: [700, 1400, 'square', 0.12], clink: [1800, 1500, 'triangle', 0.1],
  kill: [500, 80, 'triangle', 0.25], hurt: [240, 70, 'sawtooth', 0.22], candle: [1000, 1400, 'sine', 0.08], raisin: [1300, 1700, 'square', 0.05],
  seedpick: [900, 1200, 'square', 0.05], item: [520, 1040, 'triangle', 0.3], leaf: [440, 1320, 'triangle', 0.5], relic: [330, 1320, 'sine', 0.9],
  level: [523, 1568, 'triangle', 0.6], save: [392, 784, 'sine', 0.6], tag: [520, 1040, 'triangle', 0.15], seed: [700, 400, 'square', 0.06],
  break: [200, 50, 'sawtooth', 0.3], door: [160, 120, 'sine', 0.08], talk: [600, 620, 'square', 0.03], hoot: [320, 260, 'sine', 0.5],
  screech: [1400, 500, 'sawtooth', 0.4], feathers: [900, 600, 'triangle', 0.12], quake: [90, 40, 'sawtooth', 0.4], bossdie: [400, 50, 'sawtooth', 1.4],
  victory: [523, 1046, 'triangle', 1], down: [400, 100, 'triangle', 0.6], dead: [300, 60, 'triangle', 1.2], gate: [120, 80, 'square', 0.4],
  throw: [500, 700, 'triangle', 0.06], lunge: [200, 400, 'sawtooth', 0.15], flap: [300, 500, 'sine', 0.05], eat: [600, 900, 'sine', 0.2],
};
const fmt = (t: number) => `${Math.floor(t / 3600)}:${String(Math.floor((t / 60) % 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const NAMES: Record<HeroId, string> = { dora: 'Dora', enzo: 'Enzo' };
const SPEAKERS: Record<Line['who'], { name: string; face?: string }> = {
  dora: { name: 'Dora' }, enzo: { name: 'Enzo' }, owl: { name: 'Duke Hootsworth', face: '🦉' },
  rat: { name: 'Gnawdrick the Rat King', face: '🐀' }, fox: { name: 'Count Culpeo', face: '🦊' }, pip: { name: 'Pip', face: '🐹' }, sign: { name: '', face: '📜' },
  zippy: { name: 'Zippy' }, pudding: { name: 'Pudding' }, mochi: { name: 'Mochi' },
};
const STYLE_NOTE = { fan: 'wide sweeps and gusts; hold attack to spin', claws: 'lunging swipes', club: 'heavy lunging swings' };
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const shrineName = (id: string) => { const r = ROOMS.find((x) => x.id === id); return r ? `${AREAS[r.area].name} shrine` : id; };
const CHAPTERS: Record<number, { title: string; text: string; last: boolean }> = {
  1: { title: 'The Owl Belfry falls quiet', text: 'The sealed door beyond the belfry stands open. Below it wait the Pantry Catacombs.', last: false },
  2: { title: 'The Rat King is dethroned', text: 'The key to Count Culpeo’s Library was under the cheese throne all along. The library door beyond the chimney stands open.', last: false },
  3: { title: 'Count Culpeo flees', text: 'The Count has fled to his Clock Tower with the Golden Wolfberry. The rest of Fluffstevania is still being written; your save will carry on into the next chapter.', last: true },
};

function readSave(): Save | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
function writeSave(s: Save) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {} }
function readSound() { try { return localStorage.getItem(`${SAVE_KEY}-sound`) !== 'off'; } catch { return true; } }
function readMusic() { try { return localStorage.getItem(`${SAVE_KEY}-music`) !== 'off'; } catch { return true; } }

export default function Fluffstevania() {
  const [mode, setMode] = useState<{ kind: 'title' } | { kind: 'play'; save: Save | null; key: number }>({ kind: 'title' });
  const [save, setSave] = useState<Save | null>(null);
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSave(readSave()); setSound(readSound()); setMusic(readMusic()); setReady(true);
    // The canvas draws its gothic lettering once these arrive.
    document.fonts?.load('700 12px Cinzel').catch(() => {});
    document.fonts?.load('700 12px "Cormorant Garamond"').catch(() => {});
  }, []);
  const toggleSound = (on: boolean) => { setSound(on); try { localStorage.setItem(`${SAVE_KEY}-sound`, on ? 'on' : 'off'); } catch {} };
  const toggleMusic = (on: boolean) => { setMusic(on); try { localStorage.setItem(`${SAVE_KEY}-music`, on ? 'on' : 'off'); } catch {} };
  if (mode.kind === 'play') return <Play key={mode.key} start={mode.save} sound={sound} onSound={toggleSound} music={music} onMusic={toggleMusic}
    onSaved={(s) => { writeSave(s); setSave(s); }}
    onContinue={() => { const s = readSave(); setMode({ kind: 'play', save: s, key: Date.now() }); }}
    onTitle={() => { setSave(readSave()); setMode({ kind: 'title' }); }} />;
  return <main className="fv-shell fv-title" data-ready={ready}>
    <header className="fv-header"><a href="/" className="fv-back">← MAIN ARCADE</a></header>
    <section className="fv-hero">
      <div className="fv-duo" aria-hidden="true">
        <ChinchillaPortrait id="enzo" className="fv-duo-art" />
        <ChinchillaPortrait id="dora" face={-1} className="fv-duo-art" />
      </div>
      <p className="fv-eyebrow">A CASTLE-EXPLORING ACTION RPG</p>
      <h1>Fluffstevania<span>Symphony of the Dust</span></h1>
      <p className="fv-lede">
        Grandpa Pebble swears the <b>Golden Wolfberry</b> grows at the top of the castle on the mountain: one berry that never runs out of snacks.
        Dora and Enzo head in together. Explore a castle that opens up as you find relics, level up, collect gear, and <b>tag</b> between
        Dora&rsquo;s sweeping Dust Fan and Enzo&rsquo;s lunging claws. The one tagging in tumbles through anything in the way. Chain combos, cast spells,
        throw sub-weapons, unleash a Duo Strike together, and befriend a sugar glider, a guinea pig and a capybara along the way.
      </p>
      <div className="fv-row fv-start">
        {save && <button className="fv-go" onClick={() => setMode({ kind: 'play', save, key: Date.now() })} data-testid="continue">
          Continue <small>Lv {save.level} · {DIFFICULTY[save.difficulty].name} · {fmt(save.time)}</small>
        </button>}
        <button className={save ? '' : 'fv-go'} onClick={() => setMode({ kind: 'play', save: freshSave(diff), key: Date.now() })} data-testid="new-game">
          {save ? 'New game' : 'Begin →'}
        </button>
      </div>
      <fieldset className="fv-diff">
        <legend>Difficulty for a new game</legend>
        {DIFFS.map((d) => <button key={d} aria-pressed={diff === d} className={diff === d ? 'on' : ''} onClick={() => setDiff(d)} data-testid={`diff-${d}`}>{DIFFICULTY[d].name}</button>)}
        <p>{DIFFICULTY[diff].text}</p>
      </fieldset>
      {save && <p className="fv-note">A new game only replaces your save once you rest at a dust-bath shrine.</p>}
    </section>
    <section className="fv-howto" aria-label="How to play">
      <div><h2>Move</h2><p><b>← →</b> or <b>A D</b> walk · <b>Space</b>, <b>Z</b> or <b>K</b> jump (hold for height) · <b>↓ + jump</b> drops through ledges</p></div>
      <div><h2>Fight</h2><p><b>X</b> or <b>J</b> attack, three in a row for a combo · Dora: <b>hold X</b> and let go to spin · <b>↑ + attack</b> throws your sub-weapon · <b>C</b> or <b>E</b> tags your partner in · <b>C + X</b> or <b>V</b> Duo Strike when the meter is full</p></div>
      <div><h2>Magic</h2><p>Dora learns <b>Whirlwind</b> (<b>↓ ↘ → + X</b>) and Enzo <b>Burrow Quake</b> (<b>→ ↓ ↘ + X</b>); <b>F</b> casts without the motion. Spells use Dust, which trickles back and drops from candles.</p></div>
      <div><h2>Explore</h2><p><b>↑</b> reads signs and shops · <b>Shift</b> or <b>L</b> Dust Dash, and <b>jump in mid-air</b> for the Cloud Hop, once you find them · <b>Esc</b>, <b>Enter</b> or <b>M</b> opens the menu and map</p></div>
      <div><h2>Rest</h2><p>Walk into a golden <b>dust-bath shrine</b> to heal both heroes and save. Candles hide seeds and raisins; cracked walls hide secrets. Pip the hamster sells supplies for raisins.</p></div>
    </section>
    <p className="fv-foot">Chapters I and II of the castle are open: the Moonlit Approach, Entrance Hall, Hay Cellar, Owl Belfry and the Pantry Catacombs. More of Fluffstevania is on the way.</p>
  </main>;
}

type Tab = 'status' | 'equip' | 'magic' | 'items' | 'pals' | 'bestiary' | 'map';

function Play({ start, sound, onSound, music, onMusic, onSaved, onContinue, onTitle }: {
  start: Save | null; sound: boolean; onSound: (on: boolean) => void; music: boolean; onMusic: (on: boolean) => void;
  onSaved: (s: Save) => void; onContinue: () => void; onTitle: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<FluffstevaniaGame>(null as unknown as FluffstevaniaGame);
  if (!game.current) game.current = new FluffstevaniaGame(start ?? undefined);
  const keys = useRef<Input>({ ...NO_INPUT });
  const latch = useRef<Input>({ ...NO_INPUT });
  const touch = useRef<Input>({ ...NO_INPUT });
  const [menu, setMenu] = useState<Tab | null>(null);
  const menuRef = useRef<Tab | null>(null);
  menuRef.current = menu;
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const musicRef = useRef(music);
  musicRef.current = music;
  const band = useRef<Music | null>(null);
  const savedRef = useRef<Save | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const [, setFrame] = useState(0);
  const g = game.current;

  const openMenu = (on: boolean) => {
    const gm = game.current;
    if (on && (gm.state !== 'play' || gm.dialog || gm.shop || gm.warp)) return;
    setMenu(on ? 'status' : null);
    keys.current = { ...NO_INPUT };
  };

  useEffect(() => {
    const cue = (name: string) => {
      const spec = CUES[name];
      if (!spec || !soundRef.current) return;
      try {
        audio.current ??= new AudioContext();
        const a = audio.current, [f0, f1, type, len] = spec, o = a.createOscillator(), v = a.createGain(), t = a.currentTime;
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
        v.gain.setValueAtTime(0.05, t); v.gain.exponentialRampToValueAtTime(0.0005, t + len);
        o.connect(v); v.connect(a.destination); o.start(t); o.stop(t + len);
      } catch {}
    };
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const gm = game.current;
      acc = Math.min(acc + (now - last) / 1000, 0.25);
      last = now;
      const pad = navigator.getGamepads?.()[0];
      const p: Input = pad ? {
        left: pad.buttons[14]?.pressed || (pad.axes[0] ?? 0) < -0.4, right: pad.buttons[15]?.pressed || (pad.axes[0] ?? 0) > 0.4,
        up: pad.buttons[12]?.pressed || (pad.axes[1] ?? 0) < -0.6, down: pad.buttons[13]?.pressed || (pad.axes[1] ?? 0) > 0.6,
        jump: !!pad.buttons[0]?.pressed, attack: !!pad.buttons[2]?.pressed, dash: !!(pad.buttons[1]?.pressed || pad.buttons[5]?.pressed), tag: !!(pad.buttons[3]?.pressed || pad.buttons[4]?.pressed),
        spell: !!pad.buttons[7]?.pressed, duo: !!pad.buttons[6]?.pressed,
      } : { ...NO_INPUT };
      const input = Object.fromEntries((Object.keys(NO_INPUT) as (keyof Input)[]).map((k) => [k, keys.current[k] || latch.current[k] || touch.current[k] || p[k]])) as Input;
      if (!menuRef.current) while (acc >= DT) { gm.step(DT, input); acc -= DT; latch.current = { ...NO_INPUT }; }
      else acc = 0;
      for (const e of gm.events) cue(e);
      gm.events.length = 0;
      // Music follows the room, or the boss.
      if (musicRef.current) {
        try { audio.current ??= new AudioContext(); band.current ??= new Music(audio.current); } catch {}
        if (audio.current?.state === 'suspended') audio.current.resume().catch(() => {});
        band.current?.play(gm.state === 'dead' ? null : gm.boss ? 'boss' : gm.room.area);
      } else band.current?.play(null);
      if (gm.saved && gm.saved !== savedRef.current) { savedRef.current = gm.saved; onSavedRef.current(gm.saved); }
      const c = canvas.current?.getContext('2d');
      if (c) { c.setTransform(SCALE, 0, 0, SCALE, 0, 0); drawGame(c, gm, now / 1000); }
      setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const hide = () => { if (document.hidden && !menuRef.current) openMenu(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hide); band.current?.stop(); audio.current?.close().catch(() => {}); };
  }, []);
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const a = KEYS[e.code];
      if (!a) return;
      const target = e.target as HTMLElement | null;
      if (menuRef.current && a !== 'menu') return;
      const gm = game.current;
      if (target?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter') && (menuRef.current || gm.shop || gm.warp || gm.state !== 'play')) return;
      e.preventDefault();
      if (a === 'menu') {
        if (on && !e.repeat) {
          if (gm.shop) gm.closeShop(); else if (gm.warp) gm.closeWarp(); else openMenu(!menuRef.current);
          keys.current = { ...NO_INPUT };
        }
        return;
      }
      keys.current[a] = on;
      if (on) latch.current[a] = true;
    };
    const kd = (e: KeyboardEvent) => set(e, true), ku = (e: KeyboardEvent) => set(e, false);
    const blur = () => { keys.current = { ...NO_INPUT }; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  });

  const line = g.dialog ? g.dialog.lines[g.dialog.i] : null;
  return <main className="fv-shell fv-playing">
    <header className="fv-header">
      <a href="/" className="fv-back">← MAIN ARCADE</a>
      <span className="fv-brand">FLUFFSTEVANIA</span>
      <div className="fv-row">
        <button onClick={() => onSound(!sound)} aria-pressed={sound}>{sound ? 'Sound on' : 'Sound off'}</button>
        <button onClick={() => onMusic(!music)} aria-pressed={music} data-testid="music">{music ? 'Music on' : 'Music off'}</button>
        <button onClick={() => openMenu(!menu)} data-testid="menu-button">{menu ? 'Resume' : 'Menu'}</button>
      </div>
    </header>
    <div className="fv-stage">
      <canvas ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0} aria-label="Fluffstevania: Dora and Enzo explore the castle"
        data-testid="board" data-room={g.room.id} data-leader={g.leader} data-state={g.state} data-x={Math.round(g.body.x)} data-level={g.level} />
      {line && <div className={`fv-dialog fv-who-${line.who}`} data-testid="dialog">
        <div className="fv-face" aria-hidden="true">
          {line.who === 'dora' || line.who === 'enzo' ? <ChinchillaPortrait id={line.who} className="fv-face-art" />
            : line.who in PALS ? <PalFace id={line.who as PalId} /> : <span>{SPEAKERS[line.who].face}</span>}
        </div>
        <div>
          <strong>{SPEAKERS[line.who].name}</strong>
          <p>{line.text}</p>
          <small>Jump or attack to continue</small>
        </div>
      </div>}
      {menu && <Menu g={g} tab={menu} onTab={setMenu} onClose={() => openMenu(false)} onTitle={onTitle} />}
      {g.shop && <Shop g={g} onClose={() => { g.closeShop(); keys.current = { ...NO_INPUT }; }} />}
      {g.warp && <section className="fv-menu fv-warp" aria-label="Warp to a shrine" data-testid="warp">
        <header className="fv-shop-head"><div><h3>Dust-bath shrines</h3><p>Step into one bath and out of another.</p></div>
          <button className="fv-close" onClick={() => { g.closeWarp(); keys.current = { ...NO_INPUT }; }}>Stay</button></header>
        <div className="fv-items">
          {g.shrines().map((id) => <button key={id} className="fv-warp-to" disabled={id === g.room.id} onClick={() => { g.warpTo(id); keys.current = { ...NO_INPUT }; }} data-testid={`warp-${id}`}>
            {shrineName(id)}{id === g.room.id ? ' · you are here' : ''}</button>)}
        </div>
      </section>}
      {g.state === 'dead' && <section className="fv-overlay" data-testid="game-over">
        <strong>Worn out</strong>
        <p>Dora and Enzo curl up in a fluffy heap. They wake at the last dust-bath shrine.</p>
        <div className="fv-row">
          <button className="fv-go" onClick={onContinue}>Continue</button>
          <button onClick={onTitle}>Title</button>
        </div>
      </section>}
      {g.state === 'chapter' && <section className="fv-overlay" data-testid="chapter">
        <p className="fv-eyebrow">CHAPTER {g.chapter === 1 ? 'I' : 'II'} CLEARED</p>
        <strong>{CHAPTERS[g.chapter]?.title}</strong>
        <p>Level {g.level} · {g.completion}% of the castle explored · {g.raisins} raisins · {fmt(g.time)}</p>
        <p>{CHAPTERS[g.chapter]?.text}</p>
        <div className="fv-row">
          <button className="fv-go" onClick={() => g.resume()}>{CHAPTERS[g.chapter]?.last ? 'Keep exploring' : `Onward to Chapter ${['', 'I', 'II', 'III', 'IV'][g.chapter + 1] ?? g.chapter + 1}`}</button>
          <button onClick={onTitle}>Title</button>
        </div>
      </section>}
    </div>
    <div className="fv-pad" aria-label="Touch controls">
      {PAD.map((b) => <button key={b.key} aria-label={b.name} className={`fv-pad-${b.key}`}
        onPointerDown={(e) => { e.preventDefault(); touch.current[b.key] = true; latch.current[b.key] = true; }}
        onPointerUp={() => { touch.current[b.key] = false; }} onPointerLeave={() => { touch.current[b.key] = false; }} onPointerCancel={() => { touch.current[b.key] = false; }}
        onContextMenu={(e) => e.preventDefault()}>{b.label}</button>)}
      <button className="fv-pad-menu" aria-label="Open the menu" onClick={() => openMenu(!menu)}>MENU</button>
    </div>
    <p className="fv-keys"><b>Keys:</b> ← → move · Space/Z jump (again in mid-air to hop) · X attack (hold to spin as Dora) · ↑+X sub-weapon · F spell · C tag · C+X or V Duo Strike · Shift dash · ↓+jump drop · ↑ read, talk, shop or warp · Esc menu. A gamepad works too.</p>
  </main>;
}

function Menu({ g, tab, onTab, onClose, onTitle }: { g: FluffstevaniaGame; tab: Tab; onTab: (t: Tab) => void; onClose: () => void; onTitle: () => void }) {
  const [, bump] = useState(0);
  const [who, setWho] = useState<HeroId>(g.leader);
  const map = useRef<HTMLCanvasElement>(null);
  const layout = mapLayout(g);
  useEffect(() => {
    if (tab !== 'map') return;
    // The map is wider than the menu: start it scrolled to where the heroes are.
    const box = map.current?.parentElement;
    if (box) box.scrollLeft = layout.focus * box.scrollWidth - box.clientWidth / 2;
    let raf = 0;
    const draw = (now: number) => {
      const c = map.current?.getContext('2d');
      if (c) { c.setTransform(2, 0, 0, 2, 0, 0); drawMap(c, g, layout.w, layout.h, now / 1000); }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tab, g, layout.w, layout.h, layout.focus]);
  const tabs: [Tab, string][] = [['status', 'Status'], ['equip', 'Equip'], ['magic', 'Magic'], ['items', 'Items'], ['pals', 'Familiars'], ['bestiary', 'Bestiary'], ['map', 'Map']];
  const bag = Object.entries(g.bag);
  return <section className="fv-menu" aria-label="Menu" data-testid="menu">
    <div className="fv-tabs" role="tablist">
      {tabs.map(([id, name]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>{name}</button>)}
      <button className="fv-close" onClick={onClose}>Resume</button>
    </div>
    {tab === 'status' && <div className="fv-status">
      {(['dora', 'enzo'] as HeroId[]).map((h) => {
        const s = g.stats(h), w = g.weaponOf(h);
        return <article key={h} className={`fv-card ${g.leader === h ? 'lead' : ''}`}>
          <ChinchillaPortrait id={h} className="fv-card-art" />
          <div>
            <h3>{NAMES[h]} {g.leader === h && <small>leading</small>}</h3>
            <p className={g.hp[h] <= 0 ? 'fv-warn' : ''}>HP {g.hp[h]} / {s.maxHp}{g.hp[h] <= 0 ? ' · resting' : ''}</p>
            <dl><dt>ATK</dt><dd>{s.atk}</dd><dt>DEF</dt><dd>{s.def}</dd><dt>LCK</dt><dd>{s.lck}</dd></dl>
            <p className="fv-small">{GEAR[g.equipped[h].weapon ?? '']?.name ?? '—'} · {STYLE_NOTE[w.style]}</p>
          </div>
        </article>;
      })}
      <div className="fv-facts">
        <p><b>Level {g.level}</b> · XP {g.xp} / {xpToNext(g.level)}</p>
        <p>{g.completion}% explored · {g.raisins} raisins · {g.seeds} seeds · Dust {g.mp} / {g.maxMp} · {DIFFICULTY[g.difficulty].name} · {fmt(g.time)}</p>
        <p>Relics: {g.relics.size ? [...g.relics].map((r) => RELICS[r].name).join(', ') : 'none yet'}</p>
        {[...g.relics].map((r) => <p key={r} className="fv-small">{RELICS[r].name}: {RELICS[r].text}</p>)}
        <p className="fv-small">Your game saves at dust-bath shrines. <button className="fv-link" onClick={onTitle}>Quit to title</button></p>
      </div>
    </div>}
    {tab === 'equip' && <div className="fv-equip">
      <div className="fv-row" aria-label="Whose gear">
        {(['dora', 'enzo'] as HeroId[]).map((h) => <button key={h} aria-pressed={who === h} className={who === h ? 'on' : ''} onClick={() => setWho(h)}>{NAMES[h]}</button>)}
      </div>
      {(['weapon', 'armor', 'acc'] as Slot[]).map((slot) => {
        const on = g.equipped[who][slot];
        const options = Object.keys(g.bag).filter((id) => GEAR[id]?.slot === slot && g.canEquip(who, id));
        return <div key={slot} className="fv-slot">
          <h4>{slot === 'weapon' ? 'Weapon' : slot === 'armor' ? 'Armour' : 'Accessory'}</h4>
          <div className="fv-gear on"><GearIcon id={on} /><span><b>{on ? GEAR[on].name : 'Nothing'}</b><small>{on ? gearLine(on) : ''}</small></span>
            {on && slot !== 'weapon' && <button onClick={() => { g.equip(who, slot, null); bump((n) => n + 1); }}>Remove</button>}</div>
          {options.map((id) => <div key={id} className="fv-gear"><GearIcon id={id} /><span><b>{GEAR[id].name}</b><small>{gearLine(id)} · {GEAR[id].text}</small></span>
            <button onClick={() => { g.equip(who, slot, id); bump((n) => n + 1); }} data-testid={`equip-${id}`}>Equip</button></div>)}
        </div>;
      })}
    </div>}
    {tab === 'magic' && <div className="fv-items">
      <h4 className="fv-subhead">Sub-weapons <small>thrown with ↑ + attack, paid for in seeds ({g.seeds})</small></h4>
      {(Object.keys(SUBS) as SubId[]).filter((id) => g.subs.has(id)).map((id) => <div key={id} className={`fv-gear ${g.sub === id ? 'on' : ''}`}>
        <SubIcon id={id} /><span><b>{SUBS[id].name}</b><small>{SUBS[id].cost} seed{SUBS[id].cost > 1 ? 's' : ''} · {SUBS[id].text}</small></span>
        <button disabled={g.sub === id} onClick={() => { g.setSub(id); bump((n) => n + 1); }} data-testid={`sub-${id}`}>{g.sub === id ? 'Ready' : 'Ready it'}</button>
      </div>)}
      <h4 className="fv-subhead">Spells <small>Dust {g.mp} / {g.maxMp}; F casts the lead’s spell</small></h4>
      {(Object.keys(SPELLS) as SpellId[]).map((id) => { const sp = SPELLS[id], known = g.level >= sp.level; return <div key={id} className="fv-gear">
        <span className="fv-food" aria-hidden="true">{id === 'whirlwind' ? '🌪️' : '🪨'}</span>
        <span><b>{known ? sp.name : '???'} <small>· {NAMES[sp.hero]}</small></b><small>{known ? `${sp.keys} · ${sp.cost} Dust · ${sp.text}` : `${NAMES[sp.hero]} learns this at level ${sp.level}.`}</small></span>
      </div>; })}
      <h4 className="fv-subhead">Duo Strike <small>{Math.round((g.duo / DUO_MAX) * 100)}% charged</small></h4>
      <p className="fv-small">Landing hits fills the meter. When it’s full, press tag and attack together (or V) and both heroes streak across the screen, striking every foe in view.</p>
    </div>}
    {tab === 'pals' && <div className="fv-items">
      {(Object.keys(PALS) as PalId[]).map((id) => { const pal = g.pals[id], info = PALS[id]; return <div key={id} className={`fv-gear ${g.pal === id ? 'on' : ''}`}>
        {pal ? <PalFace id={id} small /> : <span className="fv-food" aria-hidden="true">?</span>}
        <span>{pal ? <><b>{info.name} <small>· {info.kind} · Lv {pal.level}{pal.level < 10 ? ` · ${pal.xp} / ${palXpToNext(pal.level)} XP` : ''}</small></b><small>{info.role}</small></>
          : <><b>??? <small>· {info.kind}</small></b><small>{info.where}</small></>}</span>
        {pal && <button onClick={() => { g.setPal(g.pal === id ? null : id); bump((n) => n + 1); }} data-testid={`pal-${id}`}>{g.pal === id ? 'Leave behind' : 'Bring along'}</button>}
      </div>; })}
      <p className="fv-small">One familiar comes along at a time. They grow as you win fights together.</p>
    </div>}
    {tab === 'bestiary' && <div className="fv-bestiary">
      {Object.keys(LORE).map((k) => { const n = g.kills[k] ?? 0, bossId = (Object.keys(BOSS_KILLS) as BossId[]).find((b) => BOSS_KILLS[b] === k), st = bossId ? BOSSES[bossId] : FOES[k as keyof typeof FOES];
        return <article key={k} className={`fv-beast ${n ? '' : 'unknown'}`} data-testid={`beast-${k}`}>
          <FoeIcon kind={k} known={n > 0} />
          <div><b>{n ? st.name : '???'}</b>
            {n ? <><small>HP {st.hp} · ATK {st.atk} · DEF {st.def} · {st.xp} XP · defeated {n}</small><small><i>Weak to:</i> {LORE[k].weak}</small><small>{LORE[k].line}</small></> : <small>Not yet defeated.</small>}</div>
        </article>; })}
    </div>}
    {tab === 'items' && <div className="fv-items">
      {bag.length === 0 && <p>The bag is empty. Candles and defeated foes drop things.</p>}
      {bag.map(([id, n]) => <div key={id} className="fv-gear">
        <GearIcon id={id} />
        <span><b>{GEAR[id]?.name ?? FOOD[id]?.name} ×{n}</b><small>{GEAR[id]?.text ?? FOOD[id]?.text}</small></span>
        {FOOD[id] && (['dora', 'enzo'] as HeroId[]).map((h) => <button key={h} disabled={g.hp[h] >= g.stats(h).maxHp} onClick={() => { g.eat(id, h); bump((k) => k + 1); }}>Feed {NAMES[h]}</button>)}
      </div>)}
    </div>}
    {tab === 'map' && <div className="fv-map">
      <div className="fv-map-scroll" data-testid="map-scroll">
        <canvas ref={map} width={layout.w * 2} height={layout.h * 2} style={{ width: layout.w, height: layout.h }} aria-label={`Castle map, ${g.completion}% explored`} />
      </div>
      <p className="fv-small">{g.completion}% explored · rooms are coloured by area</p>
      <ul className="fv-legend" data-testid="map-legend">
        {MAP_LEGEND.map(([kind, label]) => <li key={kind}><MapIcon kind={kind} />{label}</li>)}
      </ul>
    </div>}
  </section>;
}
function Shop({ g, onClose }: { g: FluffstevaniaGame; onClose: () => void }) {
  const [, bump] = useState(0);
  const [said, setSaid] = useState('Snacks, shinies and seeds. Raisins only, no credit!');
  const buy = (id: string, price: number) => {
    if (g.buy(id)) setSaid(`Pleasure doing business! That’s ${price} raisins.`);
    else setSaid(g.raisins < price ? 'Not enough raisins, friend. Come back richer!' : 'You can’t carry any more of those.');
    bump((n) => n + 1);
  };
  return <section className="fv-menu fv-shop" aria-label="Pip's shop" data-testid="shop">
    <header className="fv-shop-head">
      <span className="fv-shop-face" aria-hidden="true">🐹</span>
      <div><h3>Pip&rsquo;s Stall</h3><p>{said}</p></div>
      <p className="fv-purse"><b>{g.raisins}</b> raisins</p>
      <button className="fv-close" onClick={onClose} data-testid="shop-close">Leave</button>
    </header>
    <div className="fv-items">
      {SHOP.map(({ id, price }) => <div key={id} className="fv-gear">
        {id === 'seeds' ? <span className="fv-food" aria-hidden="true">🌻</span> : <GearIcon id={id} />}
        <span><b>{itemName(id)}</b><small>{id === 'seeds' ? `Ten more seeds to throw with ↑ + attack. You carry ${g.seeds}.` : GEAR[id] ? `${gearLine(id)} · ${GEAR[id].text}` : FOOD[id].text}{g.bag[id] ? ` · ${g.bag[id]} in the bag` : ''}</small></span>
        <button onClick={() => buy(id, price)} disabled={g.raisins < price} data-testid={`buy-${id}`}>{price} ◆</button>
      </div>)}
    </div>
  </section>;
}
const gearLine = (id: string) => { const g = GEAR[id]; return [g.atk && `ATK +${g.atk}`, g.def && `DEF +${g.def}`, g.lck && `LCK +${g.lck}`, g.hero && `${NAMES[g.hero]} only`].filter(Boolean).join(' · '); };
function MapIcon({ kind }: { kind: MapMark }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.clearRect(0, 0, 36, 36); mapIcon(c, kind, 18, 18, 2.6, 0.3); }, [kind]);
  return <canvas ref={ref} width={36} height={36} className="fv-legend-icon" aria-hidden="true" />;
}
function SubIcon({ id }: { id: SubId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.clearRect(0, 0, 40, 40); subIcon(c, id, 20, 20, 2.6); }, [id]);
  return <canvas ref={ref} width={40} height={40} className="fv-icon" aria-hidden="true" />;
}
/** A familiar's portrait, drawn on a small canvas and gently animated. */
function PalFace({ id, small }: { id: PalId; small?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      const c = ref.current?.getContext('2d');
      if (c) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 84, 68); c.setTransform(3.4, 0, 0, 3.4, 0, 0); drawPal(c, id, 12.5, id === 'zippy' ? 12 : 17, 1, now / 1000, 0, false, 1); }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} width={84} height={68} className={small ? 'fv-icon fv-pal-small' : 'fv-face-art'} aria-hidden="true" />;
}
function FoeIcon({ kind, known }: { kind: string; known: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    drawFoeIcon(c, kind, 72, 60, 1);
    if (!known) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#140a1c'; c.fillRect(0, 0, 72, 60); c.globalCompositeOperation = 'source-over'; }
  }, [kind, known]);
  return <canvas ref={ref} width={72} height={60} className="fv-beast-art" aria-hidden="true" />;
}
function GearIcon({ id }: { id: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.clearRect(0, 0, 40, 40); if (id) gearIcon(c, id, 20, 20, 2.6); }, [id]);
  return <canvas ref={ref} width={40} height={40} className="fv-icon" aria-hidden="true" />;
}
