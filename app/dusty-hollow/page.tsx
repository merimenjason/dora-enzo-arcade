/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Hollow, FISH, BUGS, FOSSILS, FURNITURE, GOALS, BASE_COLORS, TOOL_PRICES, TOOL_NAMES, SEED_PRICE, HOME_ROOM, FRIEND_TITLES, POCKETS, SHOP_OPEN, SHOP_CLOSE, HERO_NAMES,
  type Hero, type Save, type Tool, type Item, type Species,
} from '../../lib/dusty-hollow-game';
import { HollowScene } from '../../lib/dusty-hollow-scene';
import './hollow.css';

const SAVE_KEY = 'dusty-hollow-save-v1';
const TOOL_ORDER: Tool[] = ['hands', 'net', 'rod', 'shovel', 'can'];
const TOOL_ICON: Record<Tool, string> = { hands: '🐾', net: '🥅', rod: '🎣', shovel: '⛏️', can: '🚿' };
const KIND_ICON: Record<Item['kind'], string> = { fish: '🐟', bug: '🐛', fossil: '🦴', fruit: '🍎', flower: '🌸', seed: '🌱', furniture: '🪑' };
const WEATHER_ICON = { clear: '☀️', rain: '🌧️', snow: '❄️' };
const SEASON_ICON = { spring: '🌷', summer: '☀️', autumn: '🍂', winter: '❄️' };

function readSave(): Save | null {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); return s && s.v === 1 ? (s as Save) : null; } catch { return null; }
}

export default function DustyHollow() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Hollow | null>(null);
  const scene = useRef<HollowScene | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const touch = useRef({ dx: 0, dy: 0 });
  const audio = useRef<AudioContext | null>(null);
  const [screen, setScreen] = useState<'title' | 'play'>('title');
  const [hasSave, setHasSave] = useState(false);
  const [sound, setSound] = useState(false);
  const [passport, setPassport] = useState(false);
  const [, setTick] = useState(0);
  const soundRef = useRef(false);
  soundRef.current = sound;

  useEffect(() => { setHasSave(!!readSave()); }, []);

  const beep = (kind: string) => {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current, o = ctx.createOscillator(), gnode = ctx.createGain();
      const tones: Record<string, [number, number, OscillatorType]> = { catch: [660, 0.25, 'triangle'], goal: [880, 0.4, 'triangle'], coin: [1046, 0.12, 'square'], talk: [440, 0.08, 'sine'], dig: [220, 0.12, 'sawtooth'], shake: [330, 0.1, 'triangle'], miss: [180, 0.2, 'sawtooth'], bite: [990, 0.08, 'square'], cast: [520, 0.08, 'sine'], water: [700, 0.1, 'sine'] };
      const [f, d, type] = tones[kind] ?? [440, 0.1, 'sine'];
      o.type = type; o.frequency.value = f;
      gnode.gain.setValueAtTime(0.08, ctx.currentTime);
      gnode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
      o.connect(gnode).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + d);
    } catch { /* no audio */ }
  };

  const persist = () => { const g = game.current; if (g) try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.save())); } catch { /* storage blocked */ } };

  const start = (hero: Hero | null) => {
    const saved = hero ? null : readSave();
    game.current = saved ? Hollow.load(saved) : new Hollow(hero ?? 'dora', 7 + Math.floor(Math.random() * 1000));
    if (!saved) game.current.say(`Welcome to Dusty Hollow, ${game.current.heroName}. ${game.current.friendName} is waiting at Burrow Works.`);
    setScreen('play');
    persist();
    setHasSave(true);
  };
  const quit = () => { persist(); game.current = null; setScreen('title'); setPassport(false); };

  // Game loop.
  useEffect(() => {
    if (screen !== 'play' || !canvas.current) return;
    scene.current = new HollowScene(canvas.current);
    let last = performance.now(), raf = 0, uiAt = 0, saveAt = 0;
    canvas.current.focus();
    const loop = (now: number) => {
      const g = game.current, sc = scene.current;
      if (!g || !sc) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keys.current;
      let dx = touch.current.dx, dy = touch.current.dy;
      if (k.has('ArrowLeft') || k.has('KeyA')) dx -= 1;
      if (k.has('ArrowRight') || k.has('KeyD')) dx += 1;
      if (k.has('ArrowUp') || k.has('KeyW')) dy -= 1;
      if (k.has('ArrowDown') || k.has('KeyS')) dy += 1;
      g.step(dt, { dx, dy, run: k.has('ShiftLeft') || k.has('ShiftRight') });
      if (g.event) { beep(g.event); g.event = ''; }
      sc.draw(g, dt);
      if (now - uiAt > 120) { uiAt = now; setTick((t) => t + 1); }
      if (now - saveAt > 3000) { saveAt = now; persist(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); persist(); };
  }, [screen]);

  const act = () => { const g = game.current; if (!g) return; if (g.screen !== 'world') return; g.interact(); if (g.event) { beep(g.event); g.event = ''; } setTick((t) => t + 1); };
  const bump = () => { const g = game.current; if (g?.event) { beep(g.event); g.event = ''; } setTick((t) => t + 1); };

  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Escape') { e.preventDefault(); if (passport) setPassport(false); else if (g.dialog) g.dialog = null; else if (g.screen !== 'world') g.exit(); bump(); return; }
      if (g.dialog) {
        const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (n >= 0 && g.dialog.options[n]) { g.choose(n); bump(); }
        else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { g.choose(g.dialog.options.length - 1); bump(); }
        e.preventDefault();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      keys.current.add(e.code);
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') act();
      const t = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (t >= 0) { g.setTool(TOOL_ORDER[t]); bump(); }
      if (e.code === 'Tab') { e.preventDefault(); g.cycleTool(); bump(); }
      if (e.code === 'KeyP') { setPassport((p) => !p); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [screen, passport]);

  const g = game.current;
  const night = !!g && g.isNight;

  if (screen === 'title' || !g) {
    return (
      <main className="dh-shell dh-title">
        <header className="dh-header"><a href="/">← MAIN ARCADE <span>DUSTY HOLLOW</span></a></header>
        <section className="dh-hero">
          <p className="dh-eyebrow">A VILLAGE-LIFE GAME · NO GOAL BUT A GOOD DAY</p>
          <h1>Dusty Hollow</h1>
          <p>Move into a little Andean hollow by the sea. Fish the river, chase bugs, dig fossils, shake fruit from the trees and get to know the neighbours. Days pass in six minutes, seasons turn, and the loan on your burrow gets paid whenever you feel like it.</p>
          <div className="dh-choose">
            {hasSave && <button className="dh-primary" onClick={() => start(null)}>Continue</button>}
            <button className="dh-primary dh-dora" onClick={() => start('dora')}>{hasSave ? 'New village as Dora' : 'Play as Dora'}</button>
            <button className="dh-primary dh-enzo" onClick={() => start('enzo')}>{hasSave ? 'New village as Enzo' : 'Play as Enzo'}</button>
          </div>
          <p className="dh-note">Whoever you don’t pick runs Burrow Works next door and keeps a list of things to try. Starting a new village replaces the saved one.</p>
        </section>
      </main>
    );
  }

  const nextGoal = GOALS.find((goal) => !g.goals.includes(goal.id));
  const sel = g.pockets[g.selected];

  return (
    <main className={`dh-shell${night ? ' dh-night' : ''}`}>
      <header className="dh-header">
        <a href="/">← MAIN ARCADE <span>DUSTY HOLLOW</span></a>
        <div>
          <button onClick={() => setSound((s) => !s)}>{sound ? 'Sound on' : 'Sound off'}</button>
          <button onClick={() => setPassport((p) => !p)} aria-pressed={passport}>Passport · P</button>
          <button onClick={quit}>Save &amp; quit</button>
        </div>
      </header>
      <div className="dh-layout">
        <section className="dh-stage" aria-label="Dusty Hollow village">
          <canvas ref={canvas} tabIndex={0} aria-label="The village. Move with WASD or arrows, hold Shift to run, Space to use the selected tool or talk." onPointerDown={() => canvas.current?.focus()} />
          <div className="dh-hud">
            <span>{SEASON_ICON[g.season]} Day {g.day} · {g.season[0].toUpperCase() + g.season.slice(1)}</span>
            <span>{g.clockText} {WEATHER_ICON[g.weather]}</span>
            <span className="dh-raisins">🍇 {g.raisins.toLocaleString()}</span>
          </div>
          {g.message && !g.dialog && <div className="dh-toast">{g.message}</div>}
          {g.dialog && (
            <div className="dh-dialog" aria-label={`${g.dialog.speaker} says`}>
              <strong>{g.dialog.speaker}</strong>
              <p>{g.dialog.text}</p>
              <div>{g.dialog.options.map((o, i) => <button key={o.action + i} onClick={() => { g.choose(i); bump(); }}>{o.label} <kbd>{i + 1}</kbd></button>)}</div>
            </div>
          )}
          {g.screen === 'shop' && (
            <div className="dh-panel" aria-label="Vito’s Emporium">
              <h2>Vito’s Emporium <small>open {SHOP_OPEN}:00–{SHOP_CLOSE}:00</small></h2>
              <div className="dh-panel-grid">
                <section>
                  <h3>For sale</h3>
                  {(Object.keys(TOOL_PRICES) as Tool[]).map((t) => <button key={t} disabled={g.tools.includes(t) || g.raisins < TOOL_PRICES[t]!} onClick={() => { g.buy(t); bump(); }}>{TOOL_ICON[t]} {TOOL_NAMES[t]} <b>{g.tools.includes(t) ? 'owned' : TOOL_PRICES[t]}</b></button>)}
                  {BASE_COLORS.map((c) => <button key={c} disabled={g.raisins < SEED_PRICE || g.full} onClick={() => { g.buy(c); bump(); }}>🌱 {c[0].toUpperCase() + c.slice(1)} seeds <b>{SEED_PRICE}</b></button>)}
                  {g.stock.map((f) => <button key={f.id} disabled={g.raisins < f.price || g.full || g.furniture.includes(f.id)} onClick={() => { g.buy(f.id); bump(); }}>🪑 {f.name} <b>{g.furniture.includes(f.id) ? 'owned' : f.price}</b></button>)}
                </section>
                <section>
                  <h3>Sell from your pockets</h3>
                  {g.pockets.length === 0 && <p className="dh-muted">Nothing to sell yet.</p>}
                  {g.pockets.map((p, i) => <button key={i} onClick={() => { g.sell(i); bump(); }}>{KIND_ICON[p.kind]} {p.name} <b>+{p.price}</b></button>)}
                  <button className="dh-strong" disabled={!g.pockets.some((p) => p.kind !== 'furniture' && p.kind !== 'seed')} onClick={() => { g.sellAll(); bump(); }}>Sell everything but seeds and furniture</button>
                </section>
              </div>
              <button className="dh-leave" onClick={() => { g.exit(); bump(); }}>Leave · Esc</button>
            </div>
          )}
          {g.screen === 'museum' && (
            <div className="dh-panel" aria-label="Hollow Museum">
              <h2>Hollow Museum <small>{g.donated.length} of {g.museumTotal} on display</small></h2>
              <div className="dh-panel-grid">
                <section>
                  <h3>Donate</h3>
                  {g.pockets.filter((p) => ['fish', 'bug', 'fossil'].includes(p.kind)).length === 0 && <p className="dh-muted">Bring fish, bugs or fossils.</p>}
                  {g.pockets.map((p, i) => ['fish', 'bug', 'fossil'].includes(p.kind) ? <button key={i} disabled={g.donated.includes(p.id)} onClick={() => { g.donate(i); bump(); }}>{KIND_ICON[p.kind]} {p.name} <b>{g.donated.includes(p.id) ? 'displayed' : 'donate'}</b></button> : null)}
                </section>
                <section>
                  <h3>Wings</h3>
                  {[['Aquarium', FISH], ['Insect hall', BUGS], ['Fossil gallery', FOSSILS]].map(([name, list]) => <p key={name as string}><b>{name as string}</b> {(list as Species[]).filter((s) => g.donated.includes(s.id)).length}/{(list as Species[]).length}</p>)}
                  <p className="dh-muted">Bubo the curator hoots approvingly at every new arrival.</p>
                </section>
              </div>
              <button className="dh-leave" onClick={() => { g.exit(); bump(); }}>Leave · Esc</button>
            </div>
          )}
          {g.screen === 'home' && (
            <div className="dh-panel" aria-label="Your burrow">
              <h2>{g.heroName}’s {g.homeName} <small>{g.furniture.length}/{HOME_ROOM[g.homeLevel]} pieces placed</small></h2>
              <div className="dh-room" data-level={g.homeLevel}>
                {g.furniture.map((id) => <span key={id} title={FURNITURE.find((f) => f.id === id)?.name}>{FURNITURE.find((f) => f.id === id)?.name}</span>)}
                {g.furniture.length === 0 && <span className="dh-muted">A bare floor. Vito sells furniture.</span>}
              </div>
              <div className="dh-panel-grid">
                <section>
                  <h3>Place furniture</h3>
                  {g.pockets.map((p, i) => p.kind === 'furniture' ? <button key={i} disabled={g.furniture.length >= HOME_ROOM[g.homeLevel]} onClick={() => { g.place(i); bump(); }}>🪑 {p.name}</button> : null)}
                  {!g.pockets.some((p) => p.kind === 'furniture') && <p className="dh-muted">No furniture in your pockets.</p>}
                </section>
                <section>
                  <h3>Rest</h3>
                  <p className="dh-muted">Sleep to skip to 7:00 tomorrow. Fruit regrows, fossils are reburied and the neighbours think of new requests.</p>
                  <button className="dh-strong" onClick={() => { g.sleep(); g.exit(); bump(); }}>Sleep until morning</button>
                  {g.debt > 0 && <p className="dh-muted">Loan: {g.debt.toLocaleString()} raisins, paid at Burrow Works.</p>}
                </section>
              </div>
              <button className="dh-leave" onClick={() => { g.exit(); bump(); }}>Step outside · Esc</button>
            </div>
          )}
          {passport && (
            <div className="dh-panel dh-passport" aria-label="Passport">
              <h2>Passport <small>{g.heroName} · day {g.day} · {g.stats.sold.toLocaleString()} raisins earned</small></h2>
              <div className="dh-panel-grid dh-three">
                {[['Fish', FISH], ['Bugs', BUGS], ['Fossils', FOSSILS]].map(([name, list]) => (
                  <section key={name as string}>
                    <h3>{name as string} <small>{(list as Species[]).filter((s) => g.caught.includes(s.id)).length}/{(list as Species[]).length}</small></h3>
                    <ul>{(list as Species[]).map((s) => <li key={s.id} className={g.caught.includes(s.id) ? 'seen' : ''}>{g.caught.includes(s.id) ? s.name : '???'}{g.donated.includes(s.id) && ' 🏛️'}{g.caught.includes(s.id) && <small> {s.blurb} {s.seasons.length ? `· ${s.seasons.join(', ')}` : ''}{s.time !== 'any' ? ` · ${s.time}` : ''}</small>}</li>)}</ul>
                  </section>
                ))}
              </div>
              <button className="dh-leave" onClick={() => setPassport(false)}>Close · Esc</button>
            </div>
          )}
          <div className="dh-touch" aria-label="Touch controls">
            <div className="dh-pad">
              {[['↑', 0, -1], ['←', -1, 0], ['→', 1, 0], ['↓', 0, 1]].map(([l, dx, dy]) => (
                <button key={l as string} onPointerDown={(e) => { e.preventDefault(); touch.current = { dx: dx as number, dy: dy as number }; }} onPointerUp={() => { touch.current = { dx: 0, dy: 0 }; }} onPointerLeave={() => { touch.current = { dx: 0, dy: 0 }; }} onPointerCancel={() => { touch.current = { dx: 0, dy: 0 }; }} aria-label={`Move ${l}`}>{l as string}</button>
              ))}
            </div>
            <button className="dh-act" onClick={act} aria-label="Use tool or talk">●</button>
          </div>
        </section>
        <aside className="dh-side">
          <div className="dh-card dh-tools">
            <h3>Tool <small>1–5 or Tab</small></h3>
            <div>{TOOL_ORDER.map((t, i) => <button key={t} className={g.tool === t ? 'on' : ''} disabled={!g.tools.includes(t)} onClick={() => { g.setTool(t); bump(); canvas.current?.focus(); }} title={g.tools.includes(t) ? TOOL_NAMES[t] : `${TOOL_NAMES[t]} · buy at Vito’s`} aria-pressed={g.tool === t}>{TOOL_ICON[t]}<small>{i + 1}</small></button>)}</div>
            <p className="dh-muted">{TOOL_NAMES[g.tool]}{sel ? ` · ${sel.name} selected` : ''}</p>
          </div>
          <div className="dh-card dh-pockets">
            <h3>Pockets <small>{g.pockets.length}/{POCKETS}</small></h3>
            <div>
              {Array.from({ length: POCKETS }, (_, i) => {
                const p = g.pockets[i];
                return <button key={i} className={g.selected === i ? 'on' : ''} disabled={!p} onClick={() => { g.select(i); bump(); canvas.current?.focus(); }} title={p ? `${p.name} · ${p.price} raisins` : 'Empty'} aria-label={p ? `${p.name}, ${p.price} raisins` : 'Empty pocket'}>{p ? KIND_ICON[p.kind] : ''}</button>;
              })}
            </div>
            <p className="dh-muted">{sel ? `${sel.name} · ${sel.price} raisins. Select it, then talk to a neighbour to give it, or use the shovel on grass to plant seeds and fruit.` : 'Select something to gift, plant or check its price.'}</p>
          </div>
          <div className="dh-card">
            <h3>{g.friendName}’s list <small>{g.goals.length}/{GOALS.length}</small></h3>
            <p>{nextGoal ? <>{nextGoal.text} <b>+{nextGoal.reward}</b></> : 'Everything ticked off. The hollow is home.'}</p>
            <p className="dh-muted">{g.homeName} · {g.debt > 0 ? `loan ${g.debt.toLocaleString()}` : 'no loan'} · museum {g.donated.length}/{g.museumTotal}</p>
          </div>
          <div className="dh-card dh-friends">
            <h3>Neighbours</h3>
            {g.villagers.map((v) => {
              const req = g.requests.find((r) => r.villager === v.id);
              return <p key={v.id}><i style={{ background: v.color }} /> <b>{v.name}</b> <small>{FRIEND_TITLES[g.friendship[v.id] ?? 0]}{g.friendship[v.id] > 0 && ` · ${'♥'.repeat(Math.min(5, Math.ceil(g.friendship[v.id] / 2)))}`}</small>{req && !req.done && <em> wants a {req.kind}</em>}</p>;
            })}
          </div>
          <p className="dh-help">WASD / arrows move, Shift runs. Space or E uses the tool in front of you, talks, shakes trees or enters doors. Digits pick a reply. Days last six minutes; sleep at home to skip to morning.</p>
        </aside>
      </div>
      <footer className="dh-foot"><span>{HERO_NAMES[g.hero]} in Dusty Hollow · autosaves in this browser</span></footer>
    </main>
  );
}
