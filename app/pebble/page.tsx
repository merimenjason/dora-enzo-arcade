'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  PebbleGame, CHARS, UPGRADES, UP_IDS, SYNERGIES, PLACES, STEPS, LIVES, DT, SPIN, SAVE_KEY, BOSSES,
  readProfile, record, discover, placeOf, type Char, type Profile, type UpId, type MapNode, type NodeKind, type Phase,
} from '@/lib/pebble-game';
import type { PebbleScene } from '@/lib/pebble-scene';
import { PebbleSound } from './sound';
import './pebble.css';

type Screen = 'title' | 'run' | 'end';
type End = { won: boolean; floor: number; score: number; walls: number; blocks: number; bestCombo: number; ups: [UpId, number][]; news: string[]; char: Char };

const NODE: Record<NodeKind, { icon: string; name: string; hint: string }> = {
  wall: { icon: '🧱', name: 'Wall', hint: 'A wall of blocks to pop' },
  elite: { icon: '🐦‍⬛', name: 'Elite wall', hint: 'A tougher wall watched by crows; rarer upgrades' },
  shop: { icon: '🛒', name: 'Acorn shop', hint: 'Spend acorns on upgrades and a heal' },
  rest: { icon: '🛏️', name: 'Rest stop', hint: 'A nap or a snack' },
  boss: { icon: '👑', name: 'Boss', hint: 'A grumpy boss to calm down' },
};
const KEYS_LEFT = new Set(['arrowleft', 'a']), KEYS_RIGHT = new Set(['arrowright', 'd']);
const ROW = 66;

export default function PebblePopPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<PebbleScene | null>(null), sound = useRef<PebbleSound | null>(null);
  const game = useRef<PebbleGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('title'), pausedRef = useRef(false), held = useRef({ left: false, right: false, charge: false, spin: false });
  const mode = useRef<'keys' | 'pointer'>('pointer'), target = useRef<number | null>(null), showAt = useRef(0), mapRef = useRef<HTMLDivElement>(null);
  const [screen, setScreenState] = useState<Screen>('title'), [paused, setPaused] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [char, setChar] = useState<Char>('dora'), [end, setEnd] = useState<End | null>(null), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const P = profile.current;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new PebbleSound(profile.current.settings.sound); sound.current.unlock(); return sound.current; };

  function begin(g: PebbleGame) {
    game.current = g; pausedRef.current = false; setPaused(false); setEnd(null);
    scene.current?.place(g.place); setScreen('run'); refresh();
  }
  function newRun(c: Char, seed?: number) {
    audio().ui(); profile.current.char = c; setChar(c);
    const g = new PebbleGame(seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0), c);
    profile.current.run = g.snapshot(); save(); begin(g);
  }
  function resume() {
    const r = profile.current.run; if (!r) return; audio().ui();
    begin(new PebbleGame(r.seed, r.char, r));
  }
  function toTitle() { pausedRef.current = false; setPaused(false); game.current = null; setScreen('title'); refresh(); }
  function pause(on: boolean) {
    const g = game.current; if (screenRef.current !== 'run' || !g || g.phase !== 'wall') return;
    pausedRef.current = on; setPaused(on); held.current = { left: false, right: false, charge: false, spin: false };
    if (!on) canvas.current?.focus();
  }
  /** Saves the run whenever it is back on the map, and records it when it ends. */
  function phaseChanged(g: PebbleGame, from: Phase | null) {
    discover(profile.current, g);
    if (g.phase === 'map') { profile.current.run = g.snapshot(); save(); setTimeout(() => scrollMap(), 30); }
    if (g.phase === 'wall') { scene.current?.place(g.place); target.current = null; }
    if ((g.phase === 'won' || g.phase === 'lost') && from !== g.phase) {
      const news = record(profile.current, g); save();
      setEnd({ won: g.phase === 'won', floor: g.phase === 'won' ? STEPS : g.step, score: g.score, walls: g.walls, blocks: g.blocks, bestCombo: g.bestCombo, ups: UP_IDS.filter((id) => g.has(id)).map((id) => [id, g.has(id)]), news, char: g.char });
      showAt.current = performance.now() + (g.phase === 'won' ? 1600 : 1300);
      setTimeout(() => { if (game.current === g) { sound.current?.end(g.phase === 'won'); setScreen('end'); } }, g.phase === 'won' ? 1600 : 1300);
    }
    if (g.phase === 'reward') showAt.current = performance.now() + 1000;
    refresh();
  }
  /** Runs a map, reward, shop or rest action; the loop notices any change of phase and saves. */
  function act(fn: (g: PebbleGame) => boolean, sfx: 'ui' | 'buy' = 'ui') {
    const g = game.current; if (!g) return;
    if (fn(g)) { if (sfx === 'buy') audio().buy(); else audio().ui(); discover(profile.current, g); save(); refresh(); }
  }
  function scrollMap() {
    const g = game.current, el = mapRef.current; if (!g || !el) return;
    const step = Math.max(1, g.step + 1), y = (STEPS - step) * ROW - el.clientHeight / 2 + ROW;
    el.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  /** Sends a held pebble off (its launch event plays the sound). */
  function launch() { const g = game.current; if (g && g.phase === 'wall' && !pausedRef.current) g.launch(); }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setChar(profile.current.char); refresh();
    const w = window as unknown as { __pebble: () => PebbleGame | null; __pebbleStart: (c: Char, seed?: number) => void };
    w.__pebble = () => game.current; w.__pebbleStart = (c, seed) => newRun(c, seed);
    let dead = false, raf = 0, last = 0, acc = 0, stop = 0, prev: Phase | null = null, padPrev: boolean[] = [], ui = 0;
    const resize = () => scene.current?.resize();
    import('@/lib/pebble-scene').then(({ PebbleScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new PebbleScene(canvas.current); } catch { setError('This browser cannot draw the playfield.'); return; }
      for (const p of Object.keys(PLACES)) scene.current.place(p as keyof typeof PLACES);
      window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, run = screenRef.current === 'run' && g;
        // gamepad
        const pad = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find(Boolean) : null;
        let padAxis = 0;
        if (pad) {
          const b = (i: number) => !!pad.buttons[i]?.pressed, ax = pad.axes[0] ?? 0;
          padAxis = b(14) ? -1 : b(15) ? 1 : Math.abs(ax) > 0.2 ? ax : 0;
          if (padAxis) mode.current = 'keys';
          if (b(0) && !padPrev[0]) launch();
          if (b(9) && !padPrev[1]) pause(!pausedRef.current);
          padPrev = [b(0), b(9)];
        }
        if (run && g.phase === 'wall' && !pausedRef.current) {
          const h = held.current;
          g.input.axis = padAxis || (h.left ? -1 : 0) + (h.right ? 1 : 0);
          g.input.target = mode.current === 'pointer' ? target.current : null;
          g.input.charge = h.charge || h.spin || !!(pad && pad.buttons[0]?.pressed);
          acc += dt;
          while (acc >= DT) {
            acc -= DT;
            if (stop > 0) { stop -= DT; continue; }
            g.update();
            if (g.events.length) { const ev = g.events.splice(0); stop = Math.max(stop, sc.feed(ev, g)); sound.current?.play(ev); }
            if (g.phase !== 'wall') break;
          }
        } else { acc = 0; if (g?.events.length) { const ev = g.events.splice(0); sc.feed(ev, g); sound.current?.play(ev); } }
        if (g && g.phase !== prev) { const from = prev; prev = g.phase; if (from !== null) phaseChanged(g, from); }
        if (!g) prev = null;
        sc.draw(run && g.wall ? g : null, g ? g.place : 'meadow', { dt, shake: profile.current.settings.shake, paused: pausedRef.current });
        if (ms - ui > 120) { ui = ms; refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The playfield could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current; if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (screenRef.current !== 'run' || !g) return;
      if (g.phase === 'wall') {
        if (KEYS_LEFT.has(k)) { held.current.left = true; mode.current = 'keys'; e.preventDefault(); return; }
        if (KEYS_RIGHT.has(k)) { held.current.right = true; mode.current = 'keys'; e.preventDefault(); return; }
        if (k === ' ') { e.preventDefault(); if (!e.repeat) { audio(); launch(); } held.current.charge = true; return; }
        if ((k === 'p' || k === 'escape') && !e.repeat) { pause(!pausedRef.current); return; }
      }
      // number keys pick on the map and in the reward, shop and rest screens
      const n = Number(k) - 1; if (!(n >= 0 && n <= 4) || e.repeat) return;
      if (g.phase === 'map') { const ch = g.choices()[n]; if (ch) act((x) => x.go(ch.id)); }
      else if (g.phase === 'reward' && performance.now() >= showAt.current) act((x) => x.pick(n));
      else if (g.phase === 'rest') act((x) => x.rest(n === 0 ? 'nap' : 'snack'));
      else if (g.phase === 'shop') act((x) => x.buy(n), 'buy');
    };
    const keyup = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (KEYS_LEFT.has(k)) held.current.left = false; if (KEYS_RIGHT.has(k)) held.current.right = false; if (k === ' ') held.current.charge = false;
    };
    const blur = () => { held.current = { left: false, right: false, charge: false, spin: false }; if (game.current?.phase === 'wall') pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mouse: move to steer, click to launch, hold the button to charge Enzo's spin; touch: drag to steer, tap to launch
  const point = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); target.current = scene.current?.toField(e.clientX - r.left) ?? null; mode.current = 'pointer'; };
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'run' || pausedRef.current) return;
    e.preventDefault(); audio(); point(e); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    launch(); if (e.pointerType === 'mouse') held.current.charge = true;
  };
  const onMove = (e: React.PointerEvent) => { if (screenRef.current === 'run' && (e.pointerType === 'mouse' || e.buttons)) point(e); };
  const onUp = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') held.current.charge = false; };

  const g = game.current, phase = g?.phase, wall = g?.wall, showOverlay = performance.now() >= showAt.current;
  const lives = (n: number, max: number) => <span className="pebble-lives" aria-label={`${n} of ${max} pebbles`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
  const upRow = (x: PebbleGame) => <span className="pebble-ups">{UP_IDS.filter((id) => x.has(id)).map((id) => <i key={id} title={`${UPGRADES[id].name}: ${UPGRADES[id].text}`}>{UPGRADES[id].icon}{x.has(id) > 1 && <b>{x.has(id)}</b>}</i>)}</span>;
  const synergyHint = (x: PebbleGame, id: UpId) => SYNERGIES.find((s) => s.needs.includes(id) && (!s.char || s.char === x.char) && s.needs.every((u) => u === id || x.has(u)) && !x.synergy(s.id));
  const card = (x: PebbleGame, id: UpId, extra?: React.ReactNode) => {
    const u = UPGRADES[id], syn = synergyHint(x, id);
    return (<>
      <span className="pebble-card-icon">{u.icon}</span>
      <strong>{u.name}</strong>
      <small className={'r-' + u.rarity}>{u.rarity}{x.has(id) ? ` · have ${x.has(id)}/${u.max}` : u.max > 1 ? ` · up to ${u.max}` : ''}</small>
      <span className="pebble-card-text">{u.text}</span>
      {syn && <span className="pebble-syn">✦ {syn.name}: {syn.text}</span>}
      {extra}
    </>);
  };

  return (
    <main className="pebble-shell" data-ready={ready ? 'true' : undefined} data-screen={screen} data-phase={phase ?? 'none'}>
      <canvas ref={canvas} className="pebble-canvas" tabIndex={0} aria-label="Pebble Pop playfield. Move the hay bale with the mouse, a finger, A and D or the arrow keys; Space or a click launches the pebble; P pauses."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      {error && <div className="pebble-panel pebble-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'title' && (
        <section className="pebble-title" aria-label="Pebble Pop">
          <header className="pebble-head">
            <Link href="/" className="pebble-back">← ARCADE</Link>
            <span className="pebble-row-tight">
              <button className="pebble-chip" aria-pressed={P.settings.sound} onClick={() => { P.settings.sound = !P.settings.sound; save(); audio().setOn(P.settings.sound); refresh(); }}>{P.settings.sound ? '🔊 Sound on' : '🔇 Sound off'}</button>
              <button className="pebble-chip" aria-pressed={P.settings.shake} onClick={() => { P.settings.shake = !P.settings.shake; save(); refresh(); }}>{P.settings.shake ? '〰️ Shake on' : '➖ Shake off'}</button>
            </span>
          </header>
          <div className="pebble-hero">
            <img src="/art/pebble/title.webp" alt="" width={1600} height={1000} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <div><p className="pebble-eyebrow">A CHINCHILLA BRICK-BREAKER ADVENTURE</p><h1>Pebble <em>Pop</em></h1>
              <p className="pebble-sub">Bounce a pebble off the hay bale, pop fifteen walls from the Meadow to Badger Barn, and calm three grumpy bosses.</p></div>
          </div>
          <div className="pebble-chars" role="radiogroup" aria-label="Who holds the bale?">
            {(['dora', 'enzo'] as Char[]).map((c) => (
              <button key={c} role="radio" aria-checked={char === c} className={'pebble-char' + (char === c ? ' is-on' : '')} onClick={() => { setChar(c); P.char = c; save(); audio().ui(); }}>
                <span className="pebble-portrait" style={{ backgroundImage: `url(/art/pebble/pick-${c}.webp)` }}><b>{c === 'dora' ? '🤍' : '🩶'}</b></span>
                <span><strong>{CHARS[c].name}</strong><small>{CHARS[c].blurb}</small><small className="pebble-wins">{P.wins[c] ? `${P.wins[c]} win${P.wins[c] > 1 ? 's' : ''}` : 'No wins yet'}</small></span>
              </button>
            ))}
          </div>
          <div className="pebble-go-row">
            <button className="pebble-go" disabled={!ready} onClick={() => newRun(char)}>{ready ? `NEW RUN WITH ${CHARS[char].name.toUpperCase()} →` : 'Fluffing the hay…'}</button>
            {P.run && <button className="pebble-go is-alt" disabled={!ready} onClick={resume}>Carry on: step {makeStep(P.run.seed, P.run.at)} with {CHARS[P.run.char].name}</button>}
          </div>
          <dl className="pebble-records">
            <div><dt>Furthest</dt><dd>{P.bestFloor ? `Step ${P.bestFloor}` : '—'}</dd></div>
            <div><dt>Best score</dt><dd>{P.bestScore ? P.bestScore.toLocaleString() : '—'}</dd></div>
            <div><dt>Runs</dt><dd>{P.runs}</dd></div>
            <div><dt>Wins</dt><dd>{P.wins.dora + P.wins.enzo}</dd></div>
          </dl>
          <section className="pebble-found" aria-label="Upgrades found">
            <h2>Upgrades found · {P.discovered.length} / {UP_IDS.length}</h2>
            <ul>{UP_IDS.map((id) => { const f = P.discovered.includes(id); return <li key={id} className={f ? 'got' : ''} title={f ? `${UPGRADES[id].name}: ${UPGRADES[id].text}` : 'Not found yet'}><span>{f ? UPGRADES[id].icon : '?'}</span><small>{f ? UPGRADES[id].name : '???'}</small></li>; })}</ul>
          </section>
          <p className="pebble-how"><b>Mouse</b> or <b>finger</b> to move the bale, <b>A D</b> or <b>← →</b> too · <b>Space</b> or <b>click</b> launches · where the pebble lands on the bale sets its angle · Enzo: <b>hold</b> Space or the mouse button to charge a spin · <b>P</b> pauses · gamepads work too</p>
        </section>
      )}

      {screen === 'run' && g && (
        <>
          {phase === 'wall' || ((phase === 'reward' || phase === 'won' || phase === 'lost') && wall) ? (
            <div className="pebble-hud">
              <button className="pebble-chip" onClick={() => pause(true)} aria-label="Pause">❚❚</button>
              {lives(g.lives, g.maxLives)}
              <span className="pebble-acorns">🌰 {g.acorns}</span>
              <span className="pebble-where"><b>Step {g.step}</b><small>{PLACES[g.place].name}{wall?.kind === 'elite' ? ' · elite' : wall?.boss ? ` · ${wall.boss.name}` : ''}</small></span>
              <span className="pebble-score"><b>{g.score.toLocaleString()}</b><small>{wall && wall.combo > 1 ? `combo ${wall.combo}` : `${g.needed()} to go`}</small></span>
              {upRow(g)}
            </div>
          ) : null}
          {phase === 'wall' && CHARS[g.char].spin && (
            <button className={'pebble-spin' + ((wall?.charge ?? 0) >= SPIN.min ? ' is-ready' : '')} aria-label="Hold to charge spin"
              onPointerDown={(e) => { e.preventDefault(); held.current.spin = true; launch(); }} onPointerUp={() => (held.current.spin = false)} onPointerCancel={() => (held.current.spin = false)} onPointerLeave={() => (held.current.spin = false)}>
              <i style={{ height: `${(wall?.charge ?? 0) * 100}%` }} /> <span>🌀 SPIN</span>
            </button>
          )}

          {phase === 'map' && (
            <section className="pebble-mapview" aria-label="The map">
              <header className="pebble-maphead">
                <button className="pebble-chip" onClick={toTitle}>← Menu</button>
                {lives(g.lives, g.maxLives)}
                <span className="pebble-acorns">🌰 {g.acorns}</span>
                <span className="pebble-score"><b>{g.score.toLocaleString()}</b><small>{CHARS[g.char].name}</small></span>
              </header>
              <div className="pebble-mapups">{upRow(g)}{g.synergies.map((s) => <span key={s.id} className="pebble-syn" title={s.text}>✦ {s.name}</span>)}</div>
              <p className="pebble-maptip">{g.at < 0 ? 'Pick where to start. Paths only step one lane sideways.' : 'Choose the next stop on the trail.'}</p>
              <div className="pebble-map" ref={mapRef}>
                <MapView g={g} onGo={(n) => act((x) => x.go(n.id))} />
              </div>
            </section>
          )}

          {phase === 'reward' && showOverlay && (
            <div className="pebble-panel pebble-reward" role="dialog" aria-label="Pick an upgrade">
              <p className="pebble-eyebrow">{wall?.boss ? `${wall.boss.name} is calm again` : 'Wall cleared'} · 🌰 {g.acorns}</p>
              <h2>Pick one to keep</h2>
              <div className="pebble-cards">{g.offer.map((id, i) => <button key={id} className="pebble-card" onClick={() => act((x) => x.pick(i))}><kbd>{i + 1}</kbd>{card(g, id)}</button>)}</div>
              <button className="pebble-skip" onClick={() => act((x) => x.skip())}>None for me, thanks (+5 🌰)</button>
            </div>
          )}

          {phase === 'shop' && (
            <div className="pebble-panel pebble-shop" role="dialog" aria-label="Acorn shop">
              <p className="pebble-eyebrow">ACORN SHOP · step {g.step}</p>
              <h2>Squirrel’s stall <span className="pebble-acorns">🌰 {g.acorns}</span></h2>
              <div className="pebble-cards">
                {g.shop.map((it, i) => (
                  <button key={i} className={'pebble-card' + (it.sold ? ' is-sold' : '')} disabled={it.sold || g.acorns < it.price || (it.kind === 'heal' && g.lives >= g.maxLives) || (it.kind === 'up' && !g.canTake(it.id))} onClick={() => act((x) => x.buy(i), 'buy')}>
                    <kbd>{i + 1}</kbd>
                    {it.kind === 'up' ? card(g, it.id) : (<><span className="pebble-card-icon">🍓</span><strong>Berry snack</strong><small>heal</small><span className="pebble-card-text">Get one pebble back.</span></>)}
                    <span className="pebble-price">{it.sold ? 'Thank you!' : `🌰 ${it.price}`}</span>
                  </button>
                ))}
              </div>
              <div className="pebble-row">
                <button disabled={g.acorns < g.rerollPrice} onClick={() => act((x) => x.reroll(), 'buy')}>Shake the tree (🌰 {g.rerollPrice})</button>
                <button className="pebble-go" onClick={() => act((x) => x.leave())}>Back to the trail →</button>
              </div>
            </div>
          )}

          {phase === 'rest' && (
            <div className="pebble-panel pebble-rest" role="dialog" aria-label="Rest stop">
              <p className="pebble-eyebrow">REST STOP · step {g.step}</p>
              <h2>A cosy hollow</h2>
              {lives(g.lives, g.maxLives)}
              <div className="pebble-cards">
                <button className="pebble-card" onClick={() => act((x) => x.rest('nap'))}><kbd>1</kbd><span className="pebble-card-icon">😴</span><strong>Nap</strong><span className="pebble-card-text">{g.lives < g.maxLives ? 'Every pebble back.' : 'You are already full, so dream up 10 acorns instead.'}</span></button>
                <button className="pebble-card" disabled={g.maxLives >= LIVES.cap} onClick={() => act((x) => x.rest('snack'))}><kbd>2</kbd><span className="pebble-card-icon">🥕</span><strong>Snack</strong><span className="pebble-card-text">{g.maxLives >= LIVES.cap ? `Already carrying ${LIVES.cap}.` : 'One more pebble to carry, and it comes filled.'}</span></button>
              </div>
            </div>
          )}

          {paused && (
            <div className="pebble-panel" role="dialog" aria-label="Paused">
              <h2>Paused</h2><p>Take a breather. The pebble will wait.</p>
              <div className="pebble-row"><button className="pebble-go" onClick={() => pause(false)}>Keep popping</button><button onClick={toTitle}>Menu (saved at the last map stop)</button></div>
            </div>
          )}
        </>
      )}

      {screen === 'end' && end && (
        <div className="pebble-panel pebble-end" role="dialog" aria-label="Run over">
          <p className="pebble-eyebrow">{CHARS[end.char].name}’s run</p>
          <h2>{end.won ? 'Big Bramble is calm, and Badger Barn is tidy!' : `What a trip! You reached step ${end.floor}.`}</h2>
          <p>{end.won ? 'Every wall popped. Dora and Enzo share an acorn feast with the crows and badgers.' : 'The pebbles rolled off for a rest. Every run teaches the bale a new angle.'}</p>
          {end.news.length > 0 && <p className="pebble-news">{end.news.map((n) => <b key={n}>{n}</b>)}</p>}
          <dl className="pebble-records">
            <div><dt>Score</dt><dd>{end.score.toLocaleString()}</dd></div>
            <div><dt>Walls</dt><dd>{end.walls}</dd></div>
            <div><dt>Blocks</dt><dd>{end.blocks}</dd></div>
            <div><dt>Best combo</dt><dd>{end.bestCombo}</dd></div>
          </dl>
          <p className="pebble-ups pebble-end-ups">{end.ups.map(([id, n]) => <i key={id} title={UPGRADES[id].name}>{UPGRADES[id].icon}{n > 1 && <b>{n}</b>}</i>)}</p>
          <div className="pebble-row">
            <button className="pebble-go" onClick={() => newRun(end.char)}>New run</button>
            <button onClick={toTitle}>Menu</button>
            <Link href="/" className="pebble-linkbtn">Arcade</Link>
          </div>
        </div>
      )}
    </main>
  );
}

/** The step a saved run is standing on, for the menu. */
function makeStep(seed: number, at: number) { return Math.min(STEPS, (new PebbleGame(seed, 'dora').map[at]?.step ?? 0) + 1); }

/** The branching trail, step 15 at the top: nodes you can go to now light up. */
function MapView({ g, onGo }: { g: PebbleGame; onGo: (n: MapNode) => void }) {
  const open = new Set(g.choices().map((n) => n.id)), x = (n: MapNode) => ((n.lane + 0.5) / 3) * 100, y = (n: MapNode) => (STEPS - n.step) * ROW + ROW / 2;
  const visited = new Set<number>(); if (g.at >= 0) visited.add(g.at);
  return (
    <div className="pebble-trail" style={{ height: STEPS * ROW }}>
      {(['barn', 'frosty', 'creek', 'meadow'] as const).map((p) => { const [a, b] = PLACES[p].steps; return <div key={p} className={'pebble-band b-' + p} style={{ top: (STEPS - b) * ROW, height: (b - a + 1) * ROW }}><span>{PLACES[p].name}</span></div>; })}
      <svg className="pebble-lines" viewBox={`0 0 100 ${STEPS * ROW}`} preserveAspectRatio="none" aria-hidden="true">
        {g.map.flatMap((n) => n.next.map((m) => { const t = g.map[m], live = n.id === g.at && open.has(m); return <line key={n.id + '-' + m} x1={x(n)} y1={y(n)} x2={x(t)} y2={y(t)} className={live ? 'live' : ''} vectorEffect="non-scaling-stroke" />; }))}
      </svg>
      {g.map.map((n) => {
        const can = open.has(n.id), here = n.id === g.at, past = n.step < g.step || here, boss = n.kind === 'boss' ? BOSSES[n.step] : null;
        return (
          <button key={n.id} className={`pebble-node k-${n.kind}${can ? ' is-open' : ''}${here ? ' is-here' : ''}${past && !here ? ' is-past' : ''}`} style={{ left: `${x(n)}%`, top: y(n) }}
            disabled={!can} onClick={() => onGo(n)} aria-label={`Step ${n.step}: ${boss ? boss.name : NODE[n.kind].name}${can ? '' : ' (not reachable now)'}`} title={`${boss ? boss.name : NODE[n.kind].name}: ${NODE[n.kind].hint}`}>
            <span>{here ? (g.char === 'dora' ? '🤍' : '🩶') : NODE[n.kind].icon}</span>
            {(can || boss) && <small>{boss ? boss.name : NODE[n.kind].name}</small>}
          </button>
        );
      })}
    </div>
  );
}
