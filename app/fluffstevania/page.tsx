/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  FluffstevaniaGame, VIEW_W, VIEW_H, NO_INPUT, GEAR, FOOD, RELICS, parseSave, xpToNext,
  type Input, type Save, type HeroId, type Slot,
} from '../../lib/fluffstevania-game';
import { drawGame, drawMap, gearIcon } from '../../lib/fluffstevania-scene';
import { ChinchillaPortrait } from '../../components/chinchilla-portrait';
import './fluffstevania.css';

const SCALE = 3, DT = 1 / 120;
const SAVE_KEY = 'fluffstevania-v1';
type Action = keyof Input | 'menu';
const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'attack', KeyJ: 'attack',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash', KeyC: 'tag', KeyE: 'tag',
  Escape: 'menu', Enter: 'menu', KeyM: 'menu', KeyP: 'menu', Tab: 'menu',
};
const PAD: { key: keyof Input; label: string; name: string }[] = [
  { key: 'left', label: '◀', name: 'Move left' }, { key: 'right', label: '▶', name: 'Move right' },
  { key: 'up', label: '▲', name: 'Up: read signs, and with attack throw a seed' }, { key: 'down', label: '▼', name: 'Down: drop through ledges with jump' },
  { key: 'tag', label: 'TAG', name: 'Tag your partner in' }, { key: 'dash', label: 'DASH', name: 'Dust Dash' },
  { key: 'attack', label: 'HIT', name: 'Attack' }, { key: 'jump', label: 'JUMP', name: 'Jump' },
];
const CUES: Record<string, [number, number, OscillatorType, number]> = {
  jump: [380, 620, 'square', 0.07], dash: [220, 90, 'sawtooth', 0.14], whip: [900, 300, 'triangle', 0.1], swipe: [1200, 500, 'triangle', 0.06],
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

function readSave(): Save | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
function writeSave(s: Save) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {} }
function readSound() { try { return localStorage.getItem(`${SAVE_KEY}-sound`) !== 'off'; } catch { return true; } }

export default function Fluffstevania() {
  const [mode, setMode] = useState<{ kind: 'title' } | { kind: 'play'; save: Save | null; key: number }>({ kind: 'title' });
  const [save, setSave] = useState<Save | null>(null);
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSave(readSave()); setSound(readSound()); setReady(true); }, []);
  const toggleSound = (on: boolean) => { setSound(on); try { localStorage.setItem(`${SAVE_KEY}-sound`, on ? 'on' : 'off'); } catch {} };
  if (mode.kind === 'play') return <Play key={mode.key} start={mode.save} sound={sound} onSound={toggleSound}
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
        Dora&rsquo;s long ribbon whip and Enzo&rsquo;s quick claws. The one tagging in tumbles through anything in the way.
      </p>
      <div className="fv-row fv-start">
        {save && <button className="fv-go" onClick={() => setMode({ kind: 'play', save, key: Date.now() })} data-testid="continue">
          Continue <small>Lv {save.level} · {fmt(save.time)}</small>
        </button>}
        <button className={save ? '' : 'fv-go'} onClick={() => setMode({ kind: 'play', save: null, key: Date.now() })} data-testid="new-game">
          {save ? 'New game' : 'Begin →'}
        </button>
      </div>
      {save && <p className="fv-note">A new game only replaces your save once you rest at a dust-bath shrine.</p>}
    </section>
    <section className="fv-howto" aria-label="How to play">
      <div><h2>Move</h2><p><b>← →</b> or <b>A D</b> walk · <b>Space</b>, <b>Z</b> or <b>K</b> jump (hold for height) · <b>↓ + jump</b> drops through ledges</p></div>
      <div><h2>Fight</h2><p><b>X</b> or <b>J</b> attack · <b>↑ + attack</b> throws a sunflower seed · <b>C</b> or <b>E</b> tags your partner in with a tumble attack</p></div>
      <div><h2>Explore</h2><p><b>↑</b> reads signs · <b>Shift</b> or <b>L</b> Dust Dash, once you find it · <b>Esc</b>, <b>Enter</b> or <b>M</b> opens the menu and map</p></div>
      <div><h2>Rest</h2><p>Walk into a golden <b>dust-bath shrine</b> to heal both heroes and save. Candles hide seeds and raisins; cracked walls hide secrets.</p></div>
    </section>
    <p className="fv-foot">Chapter I of the castle is open: the Moonlit Approach, Entrance Hall, Hay Cellar and Owl Belfry. More of Fluffstevania is on the way.</p>
  </main>;
}

type Tab = 'status' | 'equip' | 'items' | 'map';

function Play({ start, sound, onSound, onSaved, onContinue, onTitle }: {
  start: Save | null; sound: boolean; onSound: (on: boolean) => void; onSaved: (s: Save) => void; onContinue: () => void; onTitle: () => void;
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
  const savedRef = useRef<Save | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const [, setFrame] = useState(0);
  const g = game.current;

  const openMenu = (on: boolean) => {
    const gm = game.current;
    if (on && (gm.state !== 'play' || gm.dialog)) return;
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
      } : { ...NO_INPUT };
      const input = Object.fromEntries((Object.keys(NO_INPUT) as (keyof Input)[]).map((k) => [k, keys.current[k] || latch.current[k] || touch.current[k] || p[k]])) as Input;
      if (!menuRef.current) while (acc >= DT) { gm.step(DT, input); acc -= DT; latch.current = { ...NO_INPUT }; }
      else acc = 0;
      for (const e of gm.events) cue(e);
      gm.events.length = 0;
      if (gm.saved && gm.saved !== savedRef.current) { savedRef.current = gm.saved; onSavedRef.current(gm.saved); }
      const c = canvas.current?.getContext('2d');
      if (c) { c.setTransform(SCALE, 0, 0, SCALE, 0, 0); drawGame(c, gm, now / 1000); }
      setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const hide = () => { if (document.hidden && !menuRef.current) openMenu(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hide); audio.current?.close().catch(() => {}); };
  }, []);
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const a = KEYS[e.code];
      if (!a) return;
      const target = e.target as HTMLElement | null;
      if (menuRef.current && a !== 'menu') return;
      if (target?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter') && (menuRef.current || game.current.state !== 'play')) return;
      e.preventDefault();
      if (a === 'menu') { if (on && !e.repeat) openMenu(!menuRef.current); return; }
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
        <button onClick={() => openMenu(!menu)} data-testid="menu-button">{menu ? 'Resume' : 'Menu'}</button>
      </div>
    </header>
    <div className="fv-stage">
      <canvas ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0} aria-label="Fluffstevania: Dora and Enzo explore the castle"
        data-testid="board" data-room={g.room.id} data-leader={g.leader} data-state={g.state} data-x={Math.round(g.body.x)} data-level={g.level} />
      {line && <div className={`fv-dialog fv-who-${line.who}`} data-testid="dialog">
        <div className="fv-face" aria-hidden="true">
          {line.who === 'dora' || line.who === 'enzo' ? <ChinchillaPortrait id={line.who} className="fv-face-art" /> : <span>{line.who === 'owl' ? '🦉' : '📜'}</span>}
        </div>
        <div>
          <strong>{line.who === 'owl' ? 'Duke Hootsworth' : line.who === 'sign' ? '' : NAMES[line.who]}</strong>
          <p>{line.text}</p>
          <small>Jump or attack to continue</small>
        </div>
      </div>}
      {menu && <Menu g={g} tab={menu} onTab={setMenu} onClose={() => openMenu(false)} onTitle={onTitle} />}
      {g.state === 'dead' && <section className="fv-overlay" data-testid="game-over">
        <strong>Worn out</strong>
        <p>Dora and Enzo curl up in a fluffy heap. They wake at the last dust-bath shrine.</p>
        <div className="fv-row">
          <button className="fv-go" onClick={onContinue}>Continue</button>
          <button onClick={onTitle}>Title</button>
        </div>
      </section>}
      {g.state === 'chapter' && <section className="fv-overlay" data-testid="chapter">
        <p className="fv-eyebrow">CHAPTER I CLEARED</p>
        <strong>The Owl Belfry falls quiet</strong>
        <p>Level {g.level} · {g.completion}% of the castle explored · {g.raisins} raisins · {fmt(g.time)}</p>
        <p>The Pantry Catacombs, and the rest of Fluffstevania, are still being dug out. Your save will carry on into the next chapter.</p>
        <div className="fv-row">
          <button className="fv-go" onClick={() => g.resume()}>Keep exploring</button>
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
    <p className="fv-keys"><b>Keys:</b> ← → move · Space/Z jump · X attack · ↑+X seed · C tag · Shift dash · ↓+jump drop · ↑ read · Esc menu. A gamepad works too.</p>
  </main>;
}

function Menu({ g, tab, onTab, onClose, onTitle }: { g: FluffstevaniaGame; tab: Tab; onTab: (t: Tab) => void; onClose: () => void; onTitle: () => void }) {
  const [, bump] = useState(0);
  const [who, setWho] = useState<HeroId>(g.leader);
  const map = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (tab !== 'map') return;
    let raf = 0;
    const draw = (now: number) => { const c = map.current?.getContext('2d'); if (c) drawMap(c, g, 640, 300, now / 1000); raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tab, g]);
  const tabs: [Tab, string][] = [['status', 'Status'], ['equip', 'Equip'], ['items', 'Items'], ['map', 'Map']];
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
            <p className="fv-small">{GEAR[g.equipped[h].weapon ?? '']?.name ?? '—'} · {w.style === 'whip' ? 'long reach' : w.style === 'claws' ? 'quick swipes' : 'heavy swings'}</p>
          </div>
        </article>;
      })}
      <div className="fv-facts">
        <p><b>Level {g.level}</b> · XP {g.xp} / {xpToNext(g.level)}</p>
        <p>{g.completion}% explored · {g.raisins} raisins · {g.seeds} seeds · {fmt(g.time)}</p>
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
    {tab === 'items' && <div className="fv-items">
      {bag.length === 0 && <p>The bag is empty. Candles and defeated foes drop things.</p>}
      {bag.map(([id, n]) => <div key={id} className="fv-gear">
        {GEAR[id] ? <GearIcon id={id} /> : <span className="fv-food" aria-hidden="true">{id === 'cake' ? '🍰' : '🍒'}</span>}
        <span><b>{GEAR[id]?.name ?? FOOD[id]?.name} ×{n}</b><small>{GEAR[id]?.text ?? FOOD[id]?.text}</small></span>
        {FOOD[id] && (['dora', 'enzo'] as HeroId[]).map((h) => <button key={h} disabled={g.hp[h] >= g.stats(h).maxHp} onClick={() => { g.eat(id, h); bump((k) => k + 1); }}>Feed {NAMES[h]}</button>)}
      </div>)}
    </div>}
    {tab === 'map' && <div className="fv-map">
      <canvas ref={map} width={640} height={300} aria-label={`Castle map, ${g.completion}% explored`} />
      <p className="fv-small">{g.completion}% explored · red rooms are dust-bath shrines · gold rooms hold a guardian · you are the blinking dot</p>
    </div>}
  </section>;
}
const gearLine = (id: string) => { const g = GEAR[id]; return [g.atk && `ATK +${g.atk}`, g.def && `DEF +${g.def}`, g.lck && `LCK +${g.lck}`, g.hero && `${NAMES[g.hero]} only`].filter(Boolean).join(' · '); };
function GearIcon({ id }: { id: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.clearRect(0, 0, 40, 40); if (id) gearIcon(c, id, 20, 20, 2.6); }, [id]);
  return <canvas ref={ref} width={40} height={40} className="fv-icon" aria-hidden="true" />;
}
