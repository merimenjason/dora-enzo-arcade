'use client';
// Little Red Dot: The Straits, the first voyage: the page. The title (pick Dora or Enzo), the sailing view with its
// HUD, the conversation with Captain Bishan, the dock menu, the map, pause and the end of the voyage. Input from keys
// and on-screen buttons on touch screens; the fixed-step loop; the save (`straits-v1`). Rules in lib/straits-game.ts,
// drawing in lib/straits-scene.ts, sound in ./sound.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Game, type HeroId, type SaveData, type Choice, type DockAction, NO_INPUT, DT, SAVE_KEY, SPEED_NAMES, ISLANDS, DOCKS, KELONG, HERO, TALK, BOUND, SHORE_Z,
  newGame, step, choose, dockAction, dockOptions, leaveDock, result, freshSave, parseSave, recordVoyage, forward,
} from '@/lib/straits-game';
import { StraitsScene } from '@/lib/straits-scene';
import { StraitsSound } from './sound';
import './straits.css';

type Screen = 'title' | 'play';
const SOUND_KEY = 'straits-sound-v1';
type Prefs = { sfx: boolean; music: boolean };
function readPrefs(): Prefs { try { const p = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'null'); return { sfx: p?.sfx !== false, music: p?.music !== false }; } catch { return { sfx: true, music: true }; } }
function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window: play on unsaved */ } }
const tm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const FOE_NAME = { raft: 'Otter raft', bishan: 'Captain Bishan', hunter: 'Cat hunter' } as const;
const UBIN = DOCKS.find(d => d.id === 'ubin')!;
const DOCK_ROWS: { id: DockAction; label: string }[] = [
  { id: 'repair', label: 'Patch the hull' }, { id: 'hull', label: 'Add a plank (+25 hull)' }, { id: 'volley', label: 'Bigger peanuts (+4 a hit)' }, { id: 'bounty', label: 'Pay off the cats' },
];

function drawMap(c: HTMLCanvasElement, g: Game) {
  const x = c.getContext('2d'); if (!x) return; const S = c.width, k = S / (BOUND * 2 + 16), X = (v: number) => (v + BOUND + 8) * k, Z = (v: number) => (v + BOUND + 8) * k;
  x.clearRect(0, 0, S, S); x.fillStyle = '#1c8fa0'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#e9dcb4'; x.fillRect(0, 0, S, Z(SHORE_Z)); x.fillStyle = '#0f3540'; x.font = `600 ${S / 34}px 'Barlow Condensed', sans-serif`; x.textAlign = 'center';
  x.fillText('SINGAPORE', S / 2, Z(SHORE_Z) - S / 60);
  for (const i of ISLANDS) {
    const seen = g.found.includes(i.id); x.beginPath(); x.arc(X(i.x), Z(i.z), i.r * k, 0, Math.PI * 2);
    if (seen) { x.fillStyle = i.id === 'ubin' ? '#f6c453' : '#e9dcb4'; x.fill(); x.fillStyle = '#fff8e8'; x.fillText(i.name.toUpperCase(), X(i.x), Z(i.z) + i.r * k + S / 28); }
    else { x.strokeStyle = 'rgba(255,248,232,.35)'; x.setLineDash([4, 5]); x.stroke(); x.setLineDash([]); x.fillStyle = 'rgba(255,248,232,.5)'; x.fillText('?', X(i.x), Z(i.z) + S / 90); }
  }
  x.fillStyle = '#fff8e8'; for (const d of DOCKS) x.fillRect(X(d.x) - 3, Z(d.z) - 3, 6, 6);
  if (g.met) { x.fillStyle = '#58b7e6'; x.fillRect(X(KELONG.x) - 5, Z(KELONG.z) - 5, 10, 10); x.fillStyle = '#fff8e8'; x.fillText('KELONG', X(KELONG.x), Z(KELONG.z) - S / 60); }
  x.fillStyle = '#ff7262'; for (const f of g.foes) if (Math.hypot(f.x - g.x, f.z - g.z) < 40) { x.beginPath(); x.arc(X(f.x), Z(f.z), f.kind === 'raft' ? 4 : 6, 0, Math.PI * 2); x.fill(); }
  const [fx, fz] = forward(g.h); x.save(); x.translate(X(g.x), Z(g.z)); x.rotate(Math.atan2(fx, -fz)); x.fillStyle = '#ffffff'; x.strokeStyle = '#0f3540'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.fill(); x.stroke(); x.restore();
}

export default function Straits() {
  const cvRef = useRef<HTMLCanvasElement>(null), tagsRef = useRef<HTMLDivElement>(null), mapRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<StraitsScene | null>(null), gameRef = useRef<Game | null>(null), soundRef = useRef<StraitsSound | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ sfx: true, music: true });
  const [screen, setScreen] = useState<Screen>('title');
  const [hero, setHero] = useState<HeroId>('dora');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [paused, setPaused] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [toast, setToast] = useState('');
  const [, setTick] = useState(0);
  const S = useRef({ paused: false, map: false, save: freshSave(), toastT: 0 });
  S.current.paused = paused; S.current.map = showMap; S.current.save = save;
  const held = useRef<Record<string, boolean>>({});
  const edge = useRef({ faster: false, slower: false, ram: false, act: false });

  useEffect(() => {
    const s = readSave(); setSave(s); setHero(s.hero);
    const snd = new StraitsSound(), p = readPrefs(); snd.sfxOn = p.sfx; snd.musicOn = p.music; soundRef.current = snd; setPrefs(p);
    const wake = () => snd.start(); window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
    document.querySelector('main')?.setAttribute('data-ready', 'true');
    return () => { window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); snd.stop(); soundRef.current = null; };
  }, []);
  const setSound = useCallback((next: Prefs) => {
    setPrefs(next); const snd = soundRef.current; if (snd) { snd.setSfx(next.sfx); snd.setMusic(next.music); }
    try { localStorage.setItem(SOUND_KEY, JSON.stringify(next)); } catch { /* private window */ }
  }, []);
  const P = useRef(prefs); P.current = prefs;

  const start = useCallback((h: HeroId) => {
    gameRef.current = newGame((Date.now() & 0xffff) || 1, h); held.current = {}; edge.current = { faster: false, slower: false, ram: false, act: false };
    soundRef.current?.start(); setPaused(false); setShowMap(false); setToast(''); setScreen('play');
  }, []);
  const answer = useCallback((c: Choice) => { const g = gameRef.current; if (g && choose(g, c)) { soundRef.current?.ui(); for (const ev of g.events) soundRef.current?.fx(ev); setTick(t => t + 1); } }, []);
  const buy = useCallback((a: DockAction) => { const g = gameRef.current; if (g) { soundRef.current?.ui(dockAction(g, a)); setTick(t => t + 1); } }, []);
  const cast = useCallback(() => { const g = gameRef.current; if (g) { leaveDock(g); soundRef.current?.ui(); setTick(t => t + 1); } }, []);

  // the loop: build the scene for this voyage, step the engine at a fixed rate, draw, and move the markers
  useEffect(() => {
    if (screen !== 'play') return;
    const cv = cvRef.current, g0 = gameRef.current; if (!cv || !g0) return;
    let sc: StraitsScene;
    try { sc = new StraitsScene(cv, g0.hero); } catch { setToast('This browser could not start WebGL, so the game cannot be drawn.'); return; }
    sceneRef.current = sc;
    const fit = () => sc.resize(cv.clientWidth, cv.clientHeight); fit(); const ro = new ResizeObserver(fit); ro.observe(cv);
    const tags = new Map<string, HTMLDivElement>();
    const tag = (key: string, cls: string, html: string, p: { x: number; y: number; on: boolean }) => {
      const host = tagsRef.current; if (!host) return; let el = tags.get(key);
      if (!el) { el = document.createElement('div'); host.appendChild(el); tags.set(key, el); }
      el.className = `st-tag ${cls}`; el.hidden = !p.on; if (el.dataset.h !== html) { el.innerHTML = `<div>${html}<i></i></div>`; el.dataset.h = html; }
      el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`; el.dataset.live = '1';
    };
    let raf = 0, last = performance.now(), acc = 0, time = 0, n = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = gameRef.current; if (!g) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
      if (!S.current.paused && !S.current.map && g.phase === 'sail') {
        acc += dt;
        while (acc >= DT && g.phase === 'sail') {
          acc -= DT; const h = held.current, e = edge.current, gear0 = g.gear, ram0 = g.ramT, snd = soundRef.current;
          step(g, { ...NO_INPUT, turn: (h.R ? 1 : 0) - (h.L ? 1 : 0), faster: e.faster, slower: e.slower, ram: e.ram, act: e.act, fire: !!h.fire, brace: !!h.brace });
          e.faster = e.slower = e.ram = e.act = false;
          sc.handle(g.events);
          if (snd) { if (g.gear !== gear0) snd.gear(g.gear > gear0); if (g.ramT > ram0) snd.ram(); for (const ev of g.events) snd.fx(ev); }
          for (const ev of g.events) {
            if (ev.k === 'say') { setToast(ev.text); S.current.toastT = time + 5; }
            else if (ev.k === 'loot') { setToast(`+${ev.seeds} sunflower seeds`); S.current.toastT = time + 2; }
            else if (ev.k === 'capsize') { setToast('Capsized! Some hay washed away. Back at the last jetty.'); S.current.toastT = time + 5; }
            else if (ev.k === 'found') { setToast(`Sighted ${ISLANDS.find(i => i.id === ev.id)?.name}`); S.current.toastT = time + 3; }
            else if (ev.k === 'won') { const s = recordVoyage(S.current.save, g); writeSave(s); setSave(s); }
          }
        }
      } else acc = 0;
      if (S.current.toastT && time > S.current.toastT) { S.current.toastT = 0; setToast(''); }
      soundRef.current?.update(Math.min(1, g.v / 6.2), g.phase === 'sail' && g.foes.some(f => f.chasing), S.current.paused || S.current.map || g.phase !== 'sail');
      sc.render(g, time, dt);
      for (const el of tags.values()) el.dataset.live = '';
      if (g.phase === 'sail') {
        for (const f of g.foes) {
          const calm = f.kind === 'raft' && g.stance === 'calm', far = Math.hypot(f.x - g.x, f.z - g.z);
          if (far < 45) tag(`f${f.id}`, calm ? 'calm' : 'foe', `<span>${FOE_NAME[f.kind]}</span><div class="st-bar"><u style="width:${Math.max(0, Math.round(f.hp / f.max * 100))}%"></u></div>`, sc.project(f.x, f.kind === 'bishan' ? 2.2 : 1.3, f.z));
        }
        tag('goal', 'goal', `<span>Pulau Ubin · ${Math.round(Math.hypot(UBIN.x - g.x, UBIN.z - g.z))} m</span>`, sc.project(UBIN.x, 6, UBIN.z));
        for (const d of DOCKS) if (d.id !== 'ubin' && Math.hypot(d.x - g.x, d.z - g.z) < 30) tag(`d${d.id}`, '', `<span>${d.name}</span>`, sc.project(d.x, 2.6, d.z));
      }
      for (const [k, el] of tags) if (!el.dataset.live) { el.remove(); tags.delete(k); }
      if (S.current.map && mapRef.current) drawMap(mapRef.current, g);
      if (++n % 6 === 0) setTick(t => t + 1);
    };
    raf = requestAnimationFrame(frame);
    (window as unknown as { __straits: () => Game | null; __straitsSound: () => StraitsSound | null }).__straits = () => gameRef.current;
    (window as unknown as { __straitsSound: () => StraitsSound | null }).__straitsSound = () => soundRef.current;
    return () => { cancelAnimationFrame(raf); ro.disconnect(); for (const el of tags.values()) el.remove(); sc.dispose(); sceneRef.current = null; };
  }, [screen]);

  // keys
  useEffect(() => {
    const HOLD: Record<string, string> = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', Space: 'fire', KeyJ: 'fire', ShiftLeft: 'brace', ShiftRight: 'brace', KeyK: 'brace' };
    const down = (ev: KeyboardEvent) => {
      const g = gameRef.current, c = ev.code;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(c)) ev.preventDefault();
      if (HOLD[c]) held.current[HOLD[c]] = true;
      if (ev.repeat || !g || screen !== 'play') return;
      if (g.phase === 'talk') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(c); if (i >= 0) answer(TALK.choices[i].id); return; }
      if (g.phase === 'dock') { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(c); if (i >= 0) buy(DOCK_ROWS[i].id); else if (c === 'KeyE' || c === 'Enter' || c === 'Escape') cast(); return; }
      if (c === 'KeyW' || c === 'ArrowUp') edge.current.faster = true;
      else if (c === 'KeyS' || c === 'ArrowDown') edge.current.slower = true;
      else if (c === 'KeyR' || c === 'KeyL') edge.current.ram = true;
      else if (c === 'KeyE' || c === 'Enter') edge.current.act = true;
      else if (c === 'KeyM') setShowMap(m => !m);
      else if (c === 'KeyN') { const on = !(P.current.sfx || P.current.music); setSound({ sfx: on, music: on }); }
      else if (c === 'Escape' || c === 'KeyP') { if (S.current.map) setShowMap(false); else setPaused(p => !p); }
    };
    const up = (ev: KeyboardEvent) => { if (HOLD[ev.code]) held.current[HOLD[ev.code]] = false; };
    const blur = () => { held.current = {}; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [screen, answer, buy, cast, setSound]);

  const hold = (k: string) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); held.current[k] = true; }, onPointerUp: () => { held.current[k] = false; }, onPointerLeave: () => { held.current[k] = false; }, onPointerCancel: () => { held.current[k] = false; } });
  const tap = (k: 'faster' | 'slower' | 'ram' | 'act') => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); edge.current[k] = true; } });

  const g = gameRef.current;
  if (screen === 'title' || !g) {
    return (
      <main className="st-shell">
        <div className="st-over" style={{ background: 'linear-gradient(#2f8fd6,#8fd0ee 45%,#1c8fa0 46%,#0f3540)' }}>
          <div className="st-card st-panel">
            <h1>Little Red Dot: The Straits</h1>
            <p>The first voyage. Sail the Chope, a bumboat about a metre long, from the Tiong Bahru jetty to Pulau Ubin with a bale of hay. The Marina otters hold the strait in between.</p>
            <div className="st-heroes">
              <button type="button" className="st-hero st-panel" aria-pressed={hero === 'dora'} onClick={() => setHero('dora')}><b>DORA</b><span>Turns quicker and reloads faster. Hull {HERO.dora.hull}.</span></button>
              <button type="button" className="st-hero st-panel" aria-pressed={hero === 'enzo'} onClick={() => setHero('enzo')}><b>ENZO</b><span>Tougher hull ({HERO.enzo.hull}) and a harder ram. Slower on the tiller.</span></button>
            </div>
            <div className="st-row"><button type="button" className="st-btn gold" id="st-play" onClick={() => start(hero)}>Set sail</button><a className="st-btn" href="/">Arcade</a></div>
            <div className="st-row"><button type="button" className="st-btn" aria-pressed={prefs.sfx} onClick={() => setSound({ ...prefs, sfx: !prefs.sfx })}>Sound: {prefs.sfx ? 'on' : 'off'}</button><button type="button" className="st-btn" aria-pressed={prefs.music} onClick={() => setSound({ ...prefs, music: !prefs.music })}>Music: {prefs.music ? 'on' : 'off'}</button></div>
            <p className="dim st-keys">A / D steer · W / S sail up and down · Space fires peanuts off the side nearest a raft · Shift braces · R rams · E docks at a jetty · M map · N sound · Esc pause</p>
            {save.best && <p className="dim">Best voyage: {save.best} in {tm(save.bestTime ?? 0)} · {save.voyages} landed</p>}
          </div>
        </div>
      </main>
    );
  }

  const [fx, fz] = forward(g.h), point = POINTS[Math.round(((Math.atan2(fx, -fz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
  const opts = dockOptions(g), dock = DOCKS.find(d => d.id === g.dockId), near = DOCKS.find(d => d.id === g.nearDock), res = g.phase === 'won' ? result(g) : null;
  return (
    <main className="st-shell" data-ready="true">
      <canvas ref={cvRef} className="st-canvas" aria-label="The Chope at sea" />
      <div ref={tagsRef} />
      <div className="st-tl">
        <div className="st-stat"><b>{g.hero.toUpperCase()}</b><span>HULL {Math.max(0, Math.ceil(g.hull))} / {g.maxHull}</span><div className={`st-bar hull${g.hull < g.maxHull * 0.3 ? ' low' : ''}`}><u style={{ width: `${Math.max(0, g.hull / g.maxHull * 100)}%` }} /></div></div>
        <div className="st-stat"><b>HAY</b><span>{Math.round(g.hay)}% · {g.seeds} SEEDS</span><div className="st-bar"><u style={{ width: `${g.hay}%` }} /></div></div>
      </div>
      <div className="st-tc"><b>{point}</b><p>SINGAPORE STRAIT · {g.stance === 'calm' ? 'OTTERS AT PEACE' : 'OTTER WATERS'}</p></div>
      <div className="st-tr">
        <div className="st-top-btns"><button type="button" className="st-btn" onClick={() => setShowMap(m => !m)}>Map</button><button type="button" className="st-btn" id="st-mute" aria-label="Sound and music" aria-pressed={prefs.sfx || prefs.music} onClick={() => { const on = !(prefs.sfx || prefs.music); setSound({ sfx: on, music: on }); }}>{prefs.sfx || prefs.music ? '♪ on' : '♪ off'}</button><button type="button" className="st-btn" onClick={() => setPaused(true)}>Pause</button></div>
        <div className="st-power st-panel"><div><span>OTTERS</span><span>{g.power}%</span></div><i><u style={{ width: `${g.power}%` }} /></i></div>
        <div className="st-pips">BOUNTY{[0, 1, 2, 3, 4].map(i => <i key={i} className={i < g.bounty ? 'on' : ''} />)}</div>
        <div className="st-quest"><h3>Hay for Ubin</h3><p className="st-body">{g.met ? 'Land the hay on Pulau Ubin' : 'Sail south-east past the kelong to Pulau Ubin'}</p></div>
      </div>
      {g.phase === 'sail' && (
        <div className="st-bc">
          {toast && <div className="st-toast st-panel st-body">{toast}</div>}
          {near && <div className="st-prompt st-panel st-body"><kbd>E</kbd>{near.id === 'ubin' ? 'Land the hay' : `Dock at ${near.name}`}{g.v >= 3 ? ' (slow down first)' : ''}</div>}
          <div className="st-gears st-panel">{[1, 2, 3].map(i => <span key={i} className={g.gear === i ? 'on' : ''}>{SPEED_NAMES[i]}</span>)}</div>
        </div>
      )}
      {g.phase === 'sail' && (
        <div className="st-touch">
          <div className="l"><button type="button" {...hold('L')}>◀ PORT</button><button type="button" {...hold('R')}>STARB ▶</button><button type="button" {...tap('slower')}>SAIL −</button><button type="button" {...tap('faster')}>SAIL +</button></div>
          <div className="r"><button type="button" {...tap('act')}>DOCK</button><button type="button" {...tap('ram')}>RAM</button><button type="button" {...hold('brace')}>BRACE</button><span /><span /><button type="button" {...hold('fire')}>FIRE</button></div>
        </div>
      )}
      {g.phase === 'talk' && (
        <div className="st-over"><div className="st-card st-panel">
          <h2>{TALK.who}</h2><p>{TALK.line}</p>
          {TALK.choices.map((c, i) => <button key={c.id} type="button" id={`st-say-${c.id}`} className={`st-choice st-panel${c.id === 'fight' ? ' fight' : ''}`} onClick={() => answer(c.id)}><b>{i + 1} · {c.label}</b><span>{c.text}</span></button>)}
        </div></div>
      )}
      {g.phase === 'dock' && dock && (
        <div className="st-over"><div className="st-card st-panel">
          <h2>{dock.name}</h2><p>{g.seeds} sunflower seeds aboard. Hull {Math.ceil(g.hull)} / {g.maxHull}.{ISLANDS.find(i => i.id === dock.id)?.view ? ' From the hilltop you can see every island; the map is filled in.' : ''}</p>
          {DOCK_ROWS.map((r, i) => <button key={r.id} type="button" className="st-choice st-panel" disabled={!opts[r.id].can || g.seeds < opts[r.id].cost} onClick={() => buy(r.id)}><b>{i + 1} · {opts[r.id].cost} seeds</b><span>{r.label}{!opts[r.id].can ? ' (nothing to do)' : ''}</span></button>)}
          <div className="st-row"><button type="button" className="st-btn gold" onClick={cast}>Cast off</button></div>
        </div></div>
      )}
      {showMap && g.phase === 'sail' && (
        <div className="st-over" onClick={() => setShowMap(false)}><div className="st-card st-panel"><h2>The Strait</h2><canvas ref={mapRef} className="st-map" width={720} height={720} /><p className="dim">Not to scale, and not where the real islands are. Viewpoints on Sentosa and St John's fill in the rest.</p></div></div>
      )}
      {paused && g.phase === 'sail' && !showMap && (
        <div className="st-over"><div className="st-card st-panel"><h2>Paused</h2>
          <p className="dim">A / D steer · W / S sail up and down · Space fires peanuts off the side nearest a raft · Shift braces · R rams · E docks · M map · N sound</p>
          <div className="st-row"><button type="button" className="st-btn" aria-pressed={prefs.sfx} onClick={() => setSound({ ...prefs, sfx: !prefs.sfx })}>Sound: {prefs.sfx ? 'on' : 'off'}</button><button type="button" className="st-btn" aria-pressed={prefs.music} onClick={() => setSound({ ...prefs, music: !prefs.music })}>Music: {prefs.music ? 'on' : 'off'}</button></div>
          <div className="st-row"><button type="button" className="st-btn gold" onClick={() => setPaused(false)}>Carry on</button><button type="button" className="st-btn" onClick={() => setScreen('title')}>Give up the voyage</button><a className="st-btn" href="/">Arcade</a></div>
        </div></div>
      )}
      {res && (
        <div className="st-over"><div className="st-card st-panel">
          <h2>Hay landed on Pulau Ubin</h2><p>{res.how}</p>
          <p>{res.medal.toUpperCase()} · {res.hay}% of the bale · {tm(res.time)} · {res.sunk} sunk{res.capsizes ? ` · capsized ${res.capsizes}` : ''}</p>
          <p className="dim">Gold needs the whole bale. Bargaining costs a quarter; a bluff or a fight can keep it all.</p>
          <div className="st-row"><button type="button" className="st-btn gold" onClick={() => setScreen('title')}>Sail again</button><a className="st-btn" href="/">Arcade</a></div>
        </div></div>
      )}
      {g.phase === 'lost' && (
        <div className="st-over"><div className="st-card st-panel"><h2>The hay is gone</h2><p>The last of the bale went over the side. Ubin will have to wait for the next boat.</p>
          <div className="st-row"><button type="button" className="st-btn gold" onClick={() => setScreen('title')}>Try again</button><a className="st-btn" href="/">Arcade</a></div>
        </div></div>
      )}
    </main>
  );
}
