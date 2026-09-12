/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Hollow, FISH, BUGS, FOSSILS, FURNITURE, GOALS, BASE_COLORS, TOOL_PRICES, TOOL_NAMES, SEED_PRICE, FRIEND_TITLES, POCKETS, SHOP_OPEN, SHOP_CLOSE, HERO_NAMES, H, BIRTHDAYS, HOME_GRID, WINGS, SETS,
  type Hero, type Save, type SaveV1, type Tool, type Item, type Species, type Placed,
} from '../../lib/dusty-hollow-game';
import { HollowScene } from '../../lib/dusty-hollow-scene';
import { HollowSound } from './sound';
import './hollow.css';

const SAVE_KEY = 'dusty-hollow-save-v1';
const SETTINGS_KEY = 'dusty-hollow-settings';
const TOOL_ORDER: Tool[] = ['hands', 'net', 'rod', 'shovel', 'can'];
const TOOL_ICON: Record<Tool, string> = { hands: '🐾', net: '🥅', rod: '🎣', shovel: '⛏️', can: '🚿' };
const KIND_ICON: Record<Item['kind'], string> = { fish: '🐟', bug: '🐛', fossil: '🦴', fruit: '🍎', flower: '🌸', seed: '🌱', furniture: '🪑', shell: '🐚' };
const WEATHER_ICON = { clear: '☀️', rain: '🌧️', snow: '❄️' };
const SEASON_ICON = { spring: '🌷', summer: '☀️', autumn: '🍂', winter: '❄️' };
const FURN_ICON: Record<string, string> = { bed: '🛏️', tub: '🛁', table: '🪑', rug: '🧶', shelf: '📚', lamp: '🏮', stove: '🔥', cactus: '🌵', hammock: '🪢', chart: '🗺️', poncho: '🧣', quena: '🎶', trophy: '🏆', 'plaque-fish': '🏅', 'plaque-bug': '🏅', 'plaque-fossil': '🏅', 'photo-pia': '🖼️', 'photo-rodri': '🖼️', 'photo-vivi': '🖼️', 'photo-tato': '🖼️', 'photo-lupe': '🖼️', 'photo-nico': '🖼️' };

function readSave(): Save | SaveV1 | null {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); return s && (s.v === 1 || s.v === 2 || s.v === 3) ? s : null; } catch { return null; }
}
function readSettings(): { music: number; effects: number } {
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); return { music: Number(s.music ?? 0.5), effects: Number(s.effects ?? 0.7) }; } catch { return { music: 0.5, effects: 0.7 }; }
}

export default function DustyHollow() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Hollow | null>(null);
  const scene = useRef<HollowScene | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const touch = useRef({ dx: 0, dy: 0, hold: false, sneak: false });
  const sound = useRef<HollowSound | null>(null);
  const [screen, setScreen] = useState<'title' | 'play'>('title');
  const [hasSave, setHasSave] = useState(false);
  const [audible, setAudible] = useState(false);
  const [levels, setLevels] = useState({ music: 0.5, effects: 0.7 });
  const [passport, setPassport] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [picked, setPicked] = useState<{ pocket?: number; placed?: Placed } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => { setHasSave(!!readSave()); setLevels(readSettings()); }, []);

  const cue = (kind: string) => sound.current?.cue(kind);
  const persist = () => { const g = game.current; if (g) try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.save())); } catch { /* storage blocked */ } };
  const toggleSound = () => {
    if (audible) { sound.current?.stop(); setAudible(false); return; }
    sound.current ??= new HollowSound();
    sound.current.start();
    sound.current.setLevels(levels.music, levels.effects);
    setAudible(true);
  };
  const setLevel = (key: 'music' | 'effects', value: number) => {
    const next = { ...levels, [key]: value };
    setLevels(next);
    sound.current?.setLevels(next.music, next.effects);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  const start = (hero: Hero | null) => {
    const saved = hero ? null : readSave();
    game.current = saved ? Hollow.load(saved) : new Hollow(hero ?? 'dora', 7 + Math.floor(Math.random() * 1000));
    if (!saved) game.current.say(`Welcome to Dusty Hollow, ${game.current.heroName}. ${game.current.friendName} is waiting at Burrow Works, and the notice board is by the street.`);
    if (game.current.live) game.current.syncLive(new Date());
    setScreen('play');
    persist();
    setHasSave(true);
  };
  const quit = () => { persist(); game.current = null; setScreen('title'); setPassport(false); setPhoto(false); setPicked(null); };
  /** Save the current frame as a PNG in the browser's downloads. */
  const snapshot = () => {
    const g = game.current, cv = canvas.current;
    if (!g || !cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `dusty-hollow-day-${g.day}-${g.clockText.replace(':', '')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

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
      const hold = touch.current.hold || k.has('Space') || k.has('KeyE') || k.has('Enter');
      const sneak = touch.current.sneak || k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC');
      if (g.live) g.syncLive(new Date());
      g.step(dt, { dx, dy, run: k.has('ShiftLeft') || k.has('ShiftRight'), hold, sneak });
      if (g.event) { cue(g.event); g.event = ''; }
      sc.draw(g, dt);
      sound.current?.update(dt, g.hour, g.weather, g.y > H - 8, g.season);
      if (now - uiAt > 120) { uiAt = now; setTick((t) => t + 1); }
      if (now - saveAt > 3000) { saveAt = now; persist(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); persist(); };
  }, [screen]);

  const bump = () => { const g = game.current; if (g?.event) { cue(g.event); g.event = ''; } setTick((t) => t + 1); };
  const act = () => { const g = game.current; if (!g || g.screen !== 'world') return; g.interact(); bump(); };

  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Escape') { e.preventDefault(); if (photo) setPhoto(false); else if (passport) setPassport(false); else if (g.summary) g.summary = null; else if (g.dialog) g.dialog = null; else if (g.screen !== 'world') { g.exit(); setPicked(null); } bump(); return; }
      if (g.summary && !g.dialog && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { e.preventDefault(); g.summary = null; bump(); return; }
      if (g.dialog) {
        const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (n >= 0 && g.dialog.options[n]) { g.choose(n); bump(); }
        else if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !e.repeat) { g.choose(g.dialog.options.length - 1); bump(); }
        e.preventDefault();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      keys.current.add(e.code);
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !e.repeat) act();
      const t = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (t >= 0) { g.setTool(TOOL_ORDER[t]); bump(); }
      if (e.code === 'Tab') { e.preventDefault(); g.cycleTool(); bump(); }
      if (e.code === 'KeyP') setPassport((p) => !p);
      if (e.code === 'KeyO') { g.sortPockets(); bump(); }
      if (e.code === 'KeyF' && !e.repeat) setPhoto((p) => !p);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [screen, passport, photo]);

  const g = game.current;
  const night = !!g && g.isNight;

  if (screen === 'title' || !g) {
    return (
      <main className="dh-shell dh-title">
        <header className="dh-header"><a href="/">← MAIN ARCADE <span>DUSTY HOLLOW</span></a></header>
        <section className="dh-hero">
          <p className="dh-eyebrow">A VILLAGE-LIFE GAME · NO GOAL BUT A GOOD DAY</p>
          <h1>Dusty Hollow</h1>
          <p>Move into a little Andean hollow by the sea. Fish the river, chase bugs, dig fossils, shake fruit from the trees and get to know the neighbours. Days pass in six minutes, seasons turn, festivals come round, and the loan on your burrow gets paid whenever you feel like it.</p>
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
  const peek = g.peek();
  const [cols, rows] = g.roomSize;
  const pickedPocket = picked?.pocket !== undefined ? g.pockets[picked.pocket] : undefined;
  const clickRoom = (x: number, y: number) => {
    const here = g.furnitureAt(x, y);
    if (picked?.placed) { if (here === picked.placed) { g.pickUp(here); setPicked(null); } else { g.moveFurniture(picked.placed, x, y); setPicked(null); } }
    else if (picked?.pocket !== undefined) { g.place(picked.pocket, x, y); setPicked(null); }
    else if (here) setPicked({ placed: here });
    bump();
  };

  return (
    <main className={`dh-shell${night ? ' dh-night' : ''}${photo ? ' dh-photo' : ''}`}>
      <header className="dh-header">
        <a href="/">← MAIN ARCADE <span>DUSTY HOLLOW</span></a>
        <div>
          <button onClick={toggleSound} aria-pressed={audible}>{audible ? 'Sound on' : 'Sound off'}</button>
          <button onClick={() => setPassport((p) => !p)} aria-pressed={passport}>Passport · P</button>
          <button onClick={() => setPhoto((p) => !p)} aria-pressed={photo}>Photo · F</button>
          <button onClick={quit}>Save &amp; quit</button>
        </div>
      </header>
      <div className="dh-layout">
        <section className="dh-stage" aria-label="Dusty Hollow village">
          <canvas ref={canvas} tabIndex={0} aria-label="The village. Move with WASD or arrows, hold Shift to run, Space to use the selected tool or talk." onPointerDown={() => canvas.current?.focus()} />
          <div className="dh-hud">
            <span>{SEASON_ICON[g.season]} Day {g.day} · {g.season[0].toUpperCase() + g.season.slice(1)}{g.live ? ' · live' : ''}</span>
            <span>{g.clockText} {WEATHER_ICON[g.weather]}{g.isSale ? ' · SALE' : ''}</span>
            <span className={`dh-pocketcount${g.pocketWarning ? ' warn' : ''}`}>👜 {g.pockets.length}/{POCKETS}</span>
            <span className="dh-raisins">🍇 {g.raisins.toLocaleString()}</span>
          </div>
          {photo && (
            <div className="dh-photobar">
              <button onClick={snapshot}>Save photo (PNG)</button>
              <button onClick={() => setPhoto(false)}>Leave photo mode · F</button>
            </div>
          )}
          {g.festival && g.festival !== 'snowday' && g.screen === 'world' && (() => { const board = g.festivalBoard; const you = board.findIndex((r) => r.you); return (
            <div className="dh-festival"><b>{g.festival === 'tourney' ? 'Fishing Tourney' : 'Bug-Off'} today</b>You are {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][you]} with {board[you].score.toLocaleString()} · leader {board[0].name} {board[0].score.toLocaleString()}</div>
          ); })()}
          {g.festival === 'snowday' && g.screen === 'world' && <div className="dh-festival"><b>Snowman Day</b>{g.snowballs.length} snowball{g.snowballs.length === 1 ? '' : 's'} left to roll</div>}
          {g.message && !g.dialog && <div className="dh-toast">{g.message}</div>}
          {g.summary && g.screen === 'world' && !g.dialog && (
            <div className="dh-summary" aria-label="Day summary">
              <strong>Day {g.summary.day} in Dusty Hollow</strong>
              <ul>{g.summary.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              <button onClick={() => { g.summary = null; bump(); }}>Good night · Space</button>
            </div>
          )}
          {g.dialog && (
            <div className="dh-dialog" aria-label={`${g.dialog.speaker} says`}>
              <strong>{g.dialog.speaker}</strong>
              <p>{g.dialog.text}</p>
              <div>{g.dialog.options.map((o, i) => <button key={o.action + i} onClick={() => { g.choose(i); bump(); }}>{o.label} <kbd>{i + 1}</kbd></button>)}</div>
            </div>
          )}
          {g.screen === 'shop' && (
            <div className="dh-panel" aria-label="Vito’s Emporium">
              <h2>Vito’s Emporium <small>open {SHOP_OPEN}:00–{SHOP_CLOSE}:00 · fruit paying {Math.round(g.fruitRate * 100)}% today{g.isSale ? ' · SALE DAY' : ''}</small></h2>
              {g.isSale && <p className="dh-sale">Sale day! Fruit pays 150% and the {g.saleItem?.name.toLowerCase()} is half price.</p>}
              <div className="dh-panel-grid">
                <section>
                  <h3>For sale</h3>
                  {(Object.keys(TOOL_PRICES) as Tool[]).map((t) => <button key={t} disabled={g.tools.includes(t) || g.raisins < TOOL_PRICES[t]!} onClick={() => { g.buy(t); bump(); }}>{TOOL_ICON[t]} {TOOL_NAMES[t]} <b>{g.tools.includes(t) ? 'owned' : TOOL_PRICES[t]}</b></button>)}
                  {BASE_COLORS.map((c) => <button key={c} disabled={g.raisins < SEED_PRICE || g.full} onClick={() => { g.buy(c); bump(); }}>🌱 {c[0].toUpperCase() + c.slice(1)} seeds <b>{SEED_PRICE}</b></button>)}
                  {g.stock.map((f) => { const owned = g.furniture.some((p) => p.id === f.id) || g.pockets.some((p) => p.kind === 'furniture' && p.id === f.id); const price = g.priceOf(f); return <button key={f.id} disabled={g.raisins < price || g.full || owned} onClick={() => { g.buy(f.id); bump(); }}>{FURN_ICON[f.id]} {f.name} <small>{f.set} set</small> <b>{owned ? 'owned' : price < f.price ? `${price} (was ${f.price})` : price}</b></button>; })}
                </section>
                <section>
                  <h3>Sell from your pockets</h3>
                  {g.pockets.length === 0 && <p className="dh-muted">Nothing to sell yet.</p>}
                  {g.pockets.map((p, i) => <button key={i} disabled={p.id === 'unknown'} onClick={() => { g.sell(i); bump(); }}>{KIND_ICON[p.kind]} {p.name}{p.pinned ? ' 📌' : ''} <b>{p.id === 'unknown' ? 'assess first' : `+${g.valueOf(p)}`}</b></button>)}
                  <button className="dh-strong" disabled={!g.pockets.some((p) => p.kind !== 'furniture' && p.kind !== 'seed' && !p.pinned && p.id !== 'unknown')} onClick={() => { g.sellAll(); bump(); }}>Sell everything except pins, seeds and furniture</button>
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
                  <h3>Assess and donate</h3>
                  {g.unassessed > 0 && <button className="dh-strong" onClick={() => { g.assess(); bump(); }}>Ask Bubo to assess the next fossil ({g.unassessed} waiting)</button>}
                  {!g.pockets.some((p) => ['fish', 'bug', 'fossil'].includes(p.kind)) && <p className="dh-muted">Bring fish, bugs or fossils.</p>}
                  {g.pockets.map((p, i) => ['fish', 'bug', 'fossil'].includes(p.kind) && p.id !== 'unknown' ? <button key={i} disabled={g.donated.includes(p.id)} onClick={() => { g.donate(i); bump(); }}>{KIND_ICON[p.kind]} {p.name} <b>{g.donated.includes(p.id) ? 'displayed' : 'donate'}</b></button> : null)}
                </section>
                <section>
                  <h3>Wings</h3>
                  {WINGS.map((w) => { const have = w.list.filter((s) => g.donated.includes(s.id)).length; return (
                    <div key={w.id} className="dh-wing">
                      <p><b>{w.name}</b> {have}/{w.list.length}{g.wingsDone.includes(w.id) && ' · plaque awarded'}</p>
                      <div className="dh-bar"><i style={{ width: `${(have / w.list.length) * 100}%` }} /></div>
                      <div className="dh-wall">{w.list.map((s) => <span key={s.id} className={g.donated.includes(s.id) ? 'on' : ''} title={g.donated.includes(s.id) ? s.name : 'Not yet displayed'}>{g.donated.includes(s.id) ? KIND_ICON[w.id] : '?'}</span>)}</div>
                    </div>
                  ); })}
                  <p className="dh-muted">Complete a wing and Bubo hands over 3,000 raisins and a plaque for your burrow.</p>
                </section>
              </div>
              <button className="dh-leave" onClick={() => { g.exit(); bump(); }}>Leave · Esc</button>
            </div>
          )}
          {g.screen === 'board' && (
            <div className="dh-panel" aria-label="Notice board">
              <h2>Notice board <small>day {g.day} · {g.season}, day {g.dayOfSeason + 1} of 4</small></h2>
              <div className="dh-panel-grid">
                <section>
                  <h3>Today</h3>
                  <ul className="dh-notices">{g.notices.map((n) => <li key={n}>{n}</li>)}</ul>
                </section>
                <section>
                  <h3>{g.festival && g.festival !== 'snowday' ? 'Standings' : 'Birthdays'}</h3>
                  {g.festival && g.festival !== 'snowday'
                    ? <ol className="dh-standings">{g.festivalBoard.map((r) => <li key={r.name} className={r.you ? 'you' : ''}><span>{r.name}</span><span>{r.score.toLocaleString()}</span></li>)}</ol>
                    : <ol className="dh-standings">{g.residents.map((v) => <li key={v.id}><span>{v.name}</span><span>day {BIRTHDAYS[v.id]} of the year</span></li>)}</ol>}
                  <p className="dh-muted">Festivals fall on the last day of every season: fishing tourneys in spring and autumn, the Bug-Off in summer and Snowman Day in winter.</p>
                </section>
              </div>
              <button className="dh-leave" onClick={() => { g.exit(); bump(); }}>Walk on · Esc</button>
            </div>
          )}
          {g.screen === 'home' && (
            <div className="dh-panel" aria-label="Your burrow">
              <h2>{g.heroName}’s {g.homeName} <small>{g.furniture.length} of {cols * rows} tiles furnished · Vito rates it “{g.homeRating}” ({g.roomScore.toLocaleString()} pts)</small></h2>
              {g.visitor && <p className="dh-visitor"><b>{g.visitor.name}</b> followed you in: “{g.visitor.line}”</p>}
              <div className="dh-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from({ length: cols * rows }, (_, i) => {
                  const x = i % cols, y = Math.floor(i / cols), here = g.furnitureAt(x, y);
                  const name = here ? FURNITURE.find((f) => f.id === here.id)!.name : '';
                  return <button key={i} className={`${here ? 'filled' : ''}${picked?.placed === here && here ? ' picked' : ''}`} onClick={() => clickRoom(x, y)} title={here ? `${name}: click to pick up, or click another tile to move it` : pickedPocket ? `Place the ${pickedPocket.name.toLowerCase()} here` : 'Empty floor'}>{here ? <>{FURN_ICON[here.id]}<br />{name}</> : pickedPocket || picked?.placed ? '·' : ''}</button>;
                })}
              </div>
              <div className="dh-panel-grid">
                <section>
                  <h3>Furniture in your pockets</h3>
                  {g.pockets.map((p, i) => p.kind === 'furniture' ? <button key={i} className={picked?.pocket === i ? 'dh-strong' : ''} onClick={() => { setPicked(picked?.pocket === i ? null : { pocket: i }); }}>{FURN_ICON[p.id]} {p.name} <b>{picked?.pocket === i ? 'click a tile' : 'place'}</b></button> : null)}
                  {!g.pockets.some((p) => p.kind === 'furniture') && <p className="dh-muted">No furniture in your pockets. Vito sells three pieces a day.</p>}
                  <p className="dh-muted">Sets: {SETS.map((set) => `${set} ${g.setCount(set)}/${FURNITURE.filter((f) => f.set === set).length}`).join(' · ')}. Three matching pieces earn a 1,000-raisin bonus and a better rating.</p>
                  {picked?.placed && <p className="dh-muted">Click an empty tile to move the {FURNITURE.find((f) => f.id === picked.placed!.id)!.name.toLowerCase()}, or click it again to pick it up.</p>}
                </section>
                <section>
                  <h3>Rest</h3>
                  <p className="dh-muted">{g.live ? 'In live mode the hollow keeps your real clock, so there is no skipping the night.' : 'Sleep to skip to 7:00 tomorrow. Fruit regrows, fossils are reburied and the neighbours think of new requests.'}</p>
                  {!g.live && <button className="dh-strong" onClick={() => { g.sleep(); g.exit(); setPicked(null); bump(); }}>Sleep until morning</button>}
                  {g.debt > 0 && <p className="dh-muted">Loan: {g.debt.toLocaleString()} raisins, paid at Burrow Works. The next burrow has a {HOME_GRID[Math.min(3, g.homeLevel + 1)].join('×')} room.</p>}
                </section>
              </div>
              <button className="dh-leave" onClick={() => { g.exit(); setPicked(null); bump(); }}>Step outside · Esc</button>
            </div>
          )}
          {passport && (
            <div className="dh-panel dh-passport" aria-label="Passport">
              <h2>Passport <small>{g.heroName} · day {g.day} · {g.stats.sold.toLocaleString()} raisins earned · {g.stats.festivals} festival{g.stats.festivals === 1 ? '' : 's'} placed · {g.stats.balloons} balloon{g.stats.balloons === 1 ? '' : 's'} · {g.stats.visits} visit{g.stats.visits === 1 ? '' : 's'} · {g.keepsakes.length} keepsake{g.keepsakes.length === 1 ? '' : 's'}</small></h2>
              <div className="dh-panel-grid dh-three">
                {[['Fish', FISH], ['Bugs', BUGS], ['Fossils', FOSSILS]].map(([name, list]) => (
                  <section key={name as string}>
                    <h3>{name as string} <small>{(list as Species[]).filter((s) => g.caught.includes(s.id)).length}/{(list as Species[]).length}</small></h3>
                    <ul>{(list as Species[]).map((s) => <li key={s.id} className={g.caught.includes(s.id) ? 'seen' : ''}>{g.caught.includes(s.id) ? s.name : '???'}{g.donated.includes(s.id) && ' 🏛️'}{g.caught.includes(s.id) && <small> {s.blurb} {s.seasons.length ? `· ${s.seasons.join(', ')}` : ''}{s.time !== 'any' ? ` · ${s.time}` : ''}{s.rain ? ' · rain' : ''}</small>}</li>)}</ul>
                  </section>
                ))}
              </div>
              <button className="dh-leave" onClick={() => setPassport(false)}>Close · Esc</button>
            </div>
          )}
          <div className="dh-touch" aria-label="Touch controls">
            <div className="dh-pad">
              {[['↑', 0, -1], ['←', -1, 0], ['→', 1, 0], ['↓', 0, 1]].map(([l, dx, dy]) => (
                <button key={l as string} onPointerDown={(e) => { e.preventDefault(); touch.current.dx = dx as number; touch.current.dy = dy as number; }} onPointerUp={() => { touch.current.dx = 0; touch.current.dy = 0; }} onPointerLeave={() => { touch.current.dx = 0; touch.current.dy = 0; }} onPointerCancel={() => { touch.current.dx = 0; touch.current.dy = 0; }} aria-label={`Move ${l}`}>{l as string}</button>
              ))}
            </div>
            <div className="dh-actions">
              <button className={`dh-sneak${touch.current.sneak ? ' on' : ''}`} onPointerDown={(e) => { e.preventDefault(); touch.current.sneak = !touch.current.sneak; bump(); }} aria-pressed={touch.current.sneak} aria-label="Toggle sneaking">🤫</button>
              <button className="dh-act" onPointerDown={(e) => { e.preventDefault(); touch.current.hold = true; act(); }} onPointerUp={() => { touch.current.hold = false; }} onPointerLeave={() => { touch.current.hold = false; }} onPointerCancel={() => { touch.current.hold = false; }} aria-label="Use tool or talk; hold to reel">●</button>
            </div>
          </div>
          <div className="dh-peek"><span><b>{peek.target}</b>{peek.hint ? ` · ${peek.hint}` : ''}{g.sneaking ? ' · sneaking' : ''}</span><span>{g.pocketWarning && <em>{g.pocketWarning} · </em>}{TOOL_ICON[g.tool]} {TOOL_NAMES[g.tool]}</span></div>
        </section>
        <aside className="dh-side">
          <div className="dh-card dh-tools">
            <h3>Tool <small>1–5 or Tab · auto-swaps when needed</small></h3>
            <div>{TOOL_ORDER.map((t, i) => <button key={t} className={g.tool === t ? 'on' : ''} disabled={!g.tools.includes(t)} onClick={() => { g.setTool(t); bump(); canvas.current?.focus(); }} title={g.tools.includes(t) ? TOOL_NAMES[t] : `${TOOL_NAMES[t]} · buy at Vito’s`} aria-pressed={g.tool === t}>{TOOL_ICON[t]}<small>{i + 1}</small></button>)}</div>
            <p className="dh-muted">{TOOL_NAMES[g.tool]}{sel ? ` · ${sel.name} selected` : ''}</p>
          </div>
          <div className="dh-card dh-pockets">
            <h3>Pockets <small>{g.pockets.length}/{POCKETS}</small></h3>
            <div>
              {Array.from({ length: POCKETS }, (_, i) => {
                const p = g.pockets[i];
                return <button key={i} className={`${g.selected === i ? 'on' : ''}${p?.pinned ? ' pinned' : ''}`} disabled={!p} onClick={() => { g.select(i); bump(); canvas.current?.focus(); }} title={p ? `${p.name} · ${p.id === 'unknown' ? 'assess at the museum' : `${g.valueOf(p)} raisins`}${p.pinned ? ' · pinned' : ''}` : 'Empty'} aria-label={p ? `${p.name}, ${g.valueOf(p)} raisins` : 'Empty pocket'}>{p ? KIND_ICON[p.kind] : ''}</button>;
              })}
            </div>
            <p className="dh-muted">{sel ? `${sel.name} · ${sel.id === 'unknown' ? 'unassessed' : `${g.valueOf(sel)} raisins`}. Talk to a neighbour to give it, or use the shovel on grass to plant seeds and fruit.` : 'Select something to gift, plant, pin or check its price.'}</p>
            <div className="dh-pocket-actions">
              <button disabled={!sel} onClick={() => { g.togglePin(g.selected); bump(); }}>{sel?.pinned ? 'Unpin' : 'Pin'} (keep when selling all)</button>
              <button disabled={g.pockets.length < 2} onClick={() => { g.sortPockets(); bump(); }}>Sort · O</button>
            </div>
          </div>
          <div className="dh-card">
            <h3>{g.friendName}’s list <small>{g.goals.length}/{GOALS.length}</small></h3>
            <p>{nextGoal ? <>{nextGoal.text} <b>+{nextGoal.reward}</b></> : 'Everything ticked off. The hollow is home.'}</p>
            <p className="dh-muted">{g.homeName} · {g.debt > 0 ? `loan ${g.debt.toLocaleString()}` : 'no loan'} · museum {g.donated.length}/{g.museumTotal}</p>
          </div>
          <div className="dh-card dh-friends">
            <h3>Neighbours <small>{g.residents.length} in town</small></h3>
            {g.residents.map((v) => {
              const req = g.requests.find((r) => r.villager === v.id);
              return <p key={v.id}><i style={{ background: v.color }} /> <b>{v.name}</b>{g.isBirthday(v.id) && ' 🎂'} <small>{FRIEND_TITLES[g.friendship[v.id] ?? 0]}{g.friendship[v.id] > 0 && ` · ${'♥'.repeat(Math.min(5, Math.ceil(g.friendship[v.id] / 2)))}`} · {g.villagersOut ? g.whereabouts(v.id) : 'asleep'}</small>{g.keepsakes.includes(v.id) && ' 🖼️'}{req && !req.done && <em> wants a {req.kind}</em>}</p>;
            })}
          </div>
          <div className="dh-card">
            <h3>Settings</h3>
            <label className="dh-live"><input type="checkbox" checked={g.live} onChange={(e) => { g.setLive(e.target.checked); persist(); bump(); }} /> Live clock: the hollow follows your real time and calendar (Andean seasons)</label>
            <div className="dh-sliders">
              <span>Music</span><input type="range" min={0} max={1} step={0.05} value={levels.music} onChange={(e) => setLevel('music', Number(e.target.value))} aria-label="Music volume" />
              <span>Effects</span><input type="range" min={0} max={1} step={0.05} value={levels.effects} onChange={(e) => setLevel('effects', Number(e.target.value))} aria-label="Effects volume" />
            </div>
          </div>
          <p className="dh-help">WASD / arrows move, Shift runs (bugs notice runners), C or Ctrl sneaks up on shy bugs. Space or E uses the tool in front of you, talks, shakes trees, reads the board, enters doors or throws a fruit at a passing balloon; hold it to reel a hooked fish. Digits pick a reply. O sorts pockets, F is photo mode. Days last six minutes; sleep at home to skip to morning.</p>
        </aside>
      </div>
      <footer className="dh-foot"><span>{HERO_NAMES[g.hero]} in Dusty Hollow · autosaves in this browser</span></footer>
    </main>
  );
}
