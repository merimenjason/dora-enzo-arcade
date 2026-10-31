'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FortGame, NIGHTS, ROOMS, PIECES, DT, SAVE_KEY, readSave, freshSave, record, nightOpen, roomNights, roomOpen, starCount, nextNight, nightNo, nightById,
  type Save, type Result, type Kind, type RoomId, type Ev,
} from '@/lib/fort-game';
import { SANDBOX_KINDS } from '@/lib/fort-levels';
import type { FortScene, Mood } from '@/lib/fort-scene';
import { FortSound, type SongId } from './sound';
import './fort.css';

type Screen = 'menu' | 'nights' | 'play' | 'ending';
const sceneModule = () => import('@/lib/fort-scene');
const STEP_X = 0.25;
const TITLES: Record<number, string[]> = {
  3: ['What a fort!', 'The grandest fort yet!', 'Fort of the year!'],
  2: ['Snug as a bug!', 'A proper fort!'],
  1: ['It stood!', 'Cosy enough!'],
  0: ['Flump!', 'Oh no, it toppled!', 'Down it came!'],
};

/** A painting with a felt stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className }: { src: string; paint: 'title' | 'ending'; w: number; h: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else m.paintEnding(c); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'pw-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}

/** A little drawing of a piece, for the basket and the sandbox shelf. */
function Icon({ kind, size = 44, n = 0 }: { kind: Kind; size?: number; n?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current?.getContext('2d'); if (dead || !c) return;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, size * 2, size * 2);
      const d = PIECES[kind];
      if (d.rope) {
        c.lineCap = 'round'; c.lineWidth = size * 0.16;
        const cols = kind === 'blanket' ? ['#c9576b', '#e8b04c', '#5f93b8', '#8db36a'] : ['#3c4a3a'];
        for (let i = 0; i < 6; i++) { c.strokeStyle = cols[i % cols.length]; c.beginPath(); const x0 = size * 0.2 + i * size * 0.27, x1 = x0 + size * 0.27; c.moveTo(x0, size * (0.8 + Math.sin(i * 0.9) * 0.18)); c.lineTo(x1, size * (0.8 + Math.sin((i + 1) * 0.9) * 0.18)); c.stroke(); }
        if (kind === 'lights') for (let i = 0; i < 5; i++) { c.fillStyle = ['#ffd36b', '#ff9a8a', '#a8e0ff', '#c8f59a'][i % 4]; c.beginPath(); c.arc(size * 0.32 + i * size * 0.34, size * (0.95 + Math.sin(i * 1.2) * 0.12), size * 0.09, 0, Math.PI * 2); c.fill(); }
        return;
      }
      const sc = (size * 2 * 0.8) / 2.6;
      c.setTransform(sc, 0, 0, -sc, size, size); m.drawKind(c, kind, n, 0, () => {});
    }).catch(() => {});
    return () => { dead = true; };
  }, [kind, size, n]);
  return <canvas ref={cv} className="pw-icon" width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}

const hazardIcons = (id: string) => { const n = nightById(id)!; return [n.wind ? '🌬' : '', n.cat ? '🐈' : '', n.thunder ? '⚡' : '', n.enzo ? '💤' : ''].filter(Boolean).join(' '); };
const roomOf = (id: string) => nightById(id)!.room;
const nightLabel = (id: string) => { const r = ROOMS.findIndex((x) => x.id === roomOf(id)); return `${r + 1}-${roomNights(roomOf(id)).findIndex((n) => n.id === id) + 1}`; };

export default function FortPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const scene = useRef<FortScene | null>(null), sound = useRef<FortSound | null>(null);
  const save = useRef<Save>(freshSave()), game = useRef<FortGame | null>(null);
  const screenRef = useRef<Screen>('menu'), acc = useRef(0), scale = useRef(1), moodT = useRef({ worry: 0, cheer: 0 }), resultT = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [room, setRoom] = useState<RoomId>('living');
  const [result, setResult] = useState<(Result & { better: boolean; first: boolean; id: string }) | null>(null);
  const [toast, setToast] = useState(''), [tip, setTip] = useState<{ title: string; text: string } | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const toastTimer = useRef(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new FortSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const song = (id: SongId) => sound.current?.music(id);
  const showToast = (t: string, ms = 3200) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };

  function start(id: string | null) {
    const sc = scene.current; if (!sc) return;
    const g = new FortGame(id); game.current = g; acc.current = 0; scale.current = 1; moodT.current = { worry: 0, cheer: 0 };
    const r = id ? roomOf(id) : 'living';
    sc.setGame(g, r); sc.mood = { dora: 'watch', enzo: 'watch' };
    setResult(null); setScreen('play'); song(id ? r : 'sandbox'); sound.current?.rain(true);
    const n = id ? nightById(id)! : null;
    if (n?.tip && !S.tips.includes(id!)) { S.tips.push(id!); persist(); setTip(n.tip); }
    else if (!id && !S.tips.includes('sandbox')) { S.tips.push('sandbox'); persist(); setTip({ title: 'Free build', text: 'No goals and no hurry: pick any piece from the shelf and build whatever you like. Clear the rug to start again.' }); }
    else setTip(null);
    setToast('');
    requestAnimationFrame(() => { sc.resize(); canvas.current?.focus(); });
  }
  const leave = (to: Screen) => { game.current = null; scene.current?.setGame(null, room); setResult(null); setTip(null); setScreen(to); song(to === 'ending' ? 'ending' : 'menu'); sound.current?.rain(false); };

  /** Reacts to what happened in the world this frame: sounds, the two of them, the result. */
  function handle(e: Ev) {
    const sc = scene.current, snd = sound.current, g = game.current; sc?.onEvent(e);
    if (e.kind === 'drop') snd?.release();
    if (e.kind === 'thump') snd?.thump(e.piece, e.v);
    if (e.kind === 'lost') { snd?.lost(); snd?.gasp(); moodT.current.worry = 1.6; }
    if (e.kind === 'cat') { snd?.meow(); moodT.current.worry = 2.2; if (g && g.phase === 'build') showToast('The cat is creeping up…', 2000); }
    if (e.kind === 'pounce') { snd?.pounce(); moodT.current.worry = 1.4; }
    if (e.kind === 'thunder') { snd?.thunder(); moodT.current.worry = 1.6; }
    if (e.kind === 'yawn') { snd?.yawn(); if (g?.phase === 'build') showToast('Enzo is getting very sleepy…', 2200); }
    if (e.kind === 'flop') { snd?.flop(); moodT.current.worry = 1.4; }
    if (e.kind === 'check') snd?.tick();
    if (e.kind === 'done' && g?.night) {
      const r = e.result, rec = record(save.current, g.night.id, r); persist();
      if (r.stars > 0) { snd?.win(r.stars); moodT.current.cheer = 99; } else { snd?.flop2(); moodT.current.worry = 99; }
      const id = g.night.id;
      resultT.current = window.setTimeout(() => { setResult({ ...r, ...rec, id }); refresh(); }, r.stars > 0 ? 900 : 1300);
    }
  }

  // ---- mount: the save, the scene, the loop, the hooks for tests
  useEffect(() => {
    let raw: string | null = null; try { raw = localStorage.getItem(SAVE_KEY); } catch { /* none */ }
    save.current = readSave(raw);
    setTouch(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const o = () => setOrient(innerHeight > innerWidth ? 'tall' : 'wide'); o(); addEventListener('resize', o);
    setMounted(true);
    let raf = 0, dead = false, last = performance.now(), lastBeat = 0;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.FortScene(canvas.current); } catch { setError('This browser cannot draw the fort.'); return; }
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const g = game.current, sc = scene.current;
        if (screenRef.current === 'play' && g && sc) {
          // hold your breath: time slows while the top of the fort wobbles
          const w = g.wobble(), shaky = (g.phase === 'check' && w > 0.25) || (g.phase === 'build' && w > 0.7 && g.top() > 2.2);
          scale.current += ((shaky ? 0.4 : 1) - scale.current) * Math.min(1, dt * 6);
          sc.slow = Math.max(0, (1 - scale.current) / 0.6);
          if (shaky && now - lastBeat > 700) { lastBeat = now; sound.current?.heart(); }
          if (!tipOpen.current) {
            acc.current += dt * scale.current;
            let n = 0; while (acc.current >= DT && n < 4) { g.step(); acc.current -= DT; n++; }
            if (n === 4) acc.current = 0;
          }
          if (g.events.length) { const evs = g.events.splice(0); for (const e of evs) handle(e); refresh(); }
          const mt = moodT.current; mt.worry = Math.max(0, mt.worry - dt); mt.cheer = Math.max(0, mt.cheer - dt);
          const worried = mt.worry > 0 || shaky, cheer = mt.cheer > 0 || (g.night && g.phase === 'build' && g.top() >= g.night.line && w < 0.2 && g.used > 0 && mt.worry <= 0);
          const md: Mood = cheer && !worried ? 'cheer' : worried ? 'worry' : 'watch';
          sc.mood = { dora: md, enzo: md === 'cheer' ? 'cheer' : worried && w < 0.3 && mt.worry < 0.6 ? 'watch' : md };
          sc.frame(dt);
          if (g.phase === 'check' && g.checkT % 60 === 1) refresh();
        }
        sound.current?.tickMusic(true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setReady(true);
    }).catch(() => setError('The fort did not load. Try reloading the page.'));
    const ro = new ResizeObserver(() => scene.current?.resize()); if (stage.current) ro.observe(stage.current);
    const hide = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', hide);
    const w = window as unknown as Record<string, unknown>;
    w.__fort = () => {
      const g = game.current;
      return { screen: screenRef.current, night: g?.night?.id ?? null, sandbox: g?.sandbox ?? false, phase: g?.phase ?? null, tick: g?.tick ?? 0,
        held: g?.held ? { ...g.held } : null, canDrop: g?.canDrop() ?? false, queue: g ? [...g.queue] : [], used: g?.used ?? 0, pieces: g?.pieces.length ?? 0, lost: g?.lostCount ?? 0,
        top: g?.top() ?? 0, den: g?.den().area ?? 0, result: g?.result ?? null, save: save.current };
    };
    /** Page coordinates of a world x at the height the held piece hangs, for real mouse aiming. */
    w.__fortPoint = (x: number) => { const sc = scene.current, c = canvas.current, g = game.current; if (!sc || !c || !g) return null; const r = c.getBoundingClientRect(), p = sc.screen(x, g.held ? g.hoverY(g.held.kind, g.held.rot) : 3); return [r.left + p.x, r.top + p.y]; };
    /** Where things sit on screen, for the framing checks. */
    w.__fortScene = () => scene.current?.boxes() ?? null;
    /** Straight to the ending, for the browser suite. */
    w.__fortEnding = () => { game.current = null; screenRef.current = 'ending'; setScreenState('ending'); };
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', o); document.removeEventListener('visibilitychange', hide); window.clearTimeout(resultT.current); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tipOpen = useRef(false); tipOpen.current = !!tip;
  useEffect(() => { requestAnimationFrame(() => scene.current?.resize()); }, [screen, orient, touch, result]);

  // ---- actions
  const aimAt = (x: number) => { const g = game.current; if (!g?.held) return; const before = g.held.x; g.aim(x); if (g.held.x !== before) sound.current?.aim(); };
  const turn = (d = 1) => { const g = game.current; if (!g?.held || g.phase !== 'build') return; if (!PIECES[g.held.kind].step) { showToast('A ' + PIECES[g.held.kind].name.toLowerCase() + ' only goes flat.', 1600); return; } g.rotate(d); audio().turn(); refresh(); };
  const drop = () => { const g = game.current; if (!g || tipOpen.current) return; audio(); if (g.drop()) refresh(); };
  const bed = () => { const g = game.current; if (!g || g.sandbox) return; audio(); if (g.bedtime()) { setToast(''); refresh(); } };
  const restart = () => { const g = game.current; if (!g) return; audio().ui(); window.clearTimeout(resultT.current); start(g.night?.id ?? null); };
  function afterResult(kind: 'next' | 'again' | 'nights') {
    const r = result; if (!r) return; audio().ui();
    if (kind === 'again') { start(r.id); return; }
    if (kind === 'nights') { setRoom(roomOf(r.id)); leave('nights'); return; }
    const last = NIGHTS[NIGHTS.length - 1].id;
    if (r.id === last && r.stars > 0 && !S.ended) { S.ended = true; persist(); leave('ending'); return; }
    const i = NIGHTS.findIndex((n) => n.id === r.id), nx = NIGHTS[i + 1];
    if (r.stars > 0 && nx && nightOpen(S, nx.id)) start(nx.id); else start(r.id);
  }

  // ---- keyboard
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = screenRef.current, g = game.current;
      if (tip && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); audio(); setTip(null); return; }
      if (s !== 'play' || !g) return;
      if (result) { if (e.key === 'Enter') { e.preventDefault(); afterResult(result.stars > 0 ? 'next' : 'again'); } return; }
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { e.preventDefault(); audio(); if (g.held) aimAt(g.held.x - STEP_X); }
      else if (k === 'arrowright' || k === 'd') { e.preventDefault(); audio(); if (g.held) aimAt(g.held.x + STEP_X); }
      else if (k === 'arrowup' || k === 'w' || k === 'e') { e.preventDefault(); audio(); turn(1); }
      else if (k === 'q') { e.preventDefault(); audio(); turn(-1); }
      else if (k === ' ' || k === 'arrowdown' || k === 's' || k === 'enter') { e.preventDefault(); drop(); }
      else if (k === 'b') bed();
      else if (k === 'r') restart();
      else if (k === 'escape') { audio().ui(); setRoom(g.night ? roomOf(g.night.id) : room); leave(g.sandbox ? 'menu' : 'nights'); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });

  // ---- pointer: the mouse aims and clicks to drop; a finger drags to aim, and the Drop button lets go
  const localX = (e: React.PointerEvent) => e.clientX - canvas.current!.getBoundingClientRect().left;
  const press = useRef<{ id: number; type: string; x: number; y: number } | null>(null);
  function onMove(e: React.PointerEvent) {
    const sc = scene.current; if (!sc || screenRef.current !== 'play' || result || tip) return;
    if (e.pointerType === 'mouse' || (press.current && press.current.id === e.pointerId)) aimAt(sc.worldX(localX(e)));
  }
  function onDown(e: React.PointerEvent) {
    if (screenRef.current !== 'play' || result || tip) return;
    audio(); press.current = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY };
    try { canvas.current?.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (e.pointerType === 'mouse' && e.button === 2) { turn(1); press.current = null; return; }
    if (e.pointerType !== 'mouse') onMove(e);
  }
  function onUp(e: React.PointerEvent) {
    const pr = press.current; press.current = null;
    if (!pr || pr.id !== e.pointerId || screenRef.current !== 'play' || result || tip) return;
    if (pr.type === 'mouse' && e.button === 0) drop();
  }
  function onWheel(e: React.WheelEvent) { if (screenRef.current !== 'play' || result || tip || Math.abs(e.deltaY) < 4) return; audio(); turn(e.deltaY > 0 ? 1 : -1); }

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const s = audio(); if (k === 'sound') s.setSound(S.settings.sound); else s.setMusic(S.settings.music);
    refresh();
  };
  const Toggles = () => (
    <span className="pw-toggles">
      <button type="button" className={'pw-tog' + (S.settings.sound ? ' is-on' : '')} aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>Sound</button>
      <button type="button" className={'pw-tog' + (S.settings.music ? ' is-on' : '')} aria-pressed={S.settings.music} onClick={() => toggle('music')}>Music</button>
    </span>
  );

  const g = game.current, total = NIGHTS.length * 3, stars = mounted ? starCount(S) : 0, nxt = mounted ? nextNight(S) : null, rm = ROOMS.find((r) => r.id === room)!;
  const nt = g?.night ?? null, top = g ? g.top() : 0, den = g && nt?.den !== undefined ? g.den().area : 0;
  const checkLeft = g && g.phase === 'check' ? Math.max(1, Math.ceil((300 - g.checkT) / 60)) : 0;
  return (
    <main className="pw-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-orient={orient}>
      {screen === 'menu' && (
        <section className="pw-menu">
          <Art src="/art/fort/title.webp" paint="title" w={1536} h={1024} className="pw-menu-art" />
          <div className="pw-menu-card">
            <p className="pw-eyebrow">GAME 63 · A PILLOW-FORT PHYSICS GAME</p>
            <h1>Pillow Fort</h1>
            <p className="pw-lede">A storm rattles the windows, and Dora and Enzo are building the greatest pillow fort the burrow has ever seen. Stack it tall, roof it with a blanket, and make it stand till bedtime.</p>
            <div className="pw-menu-buttons">
              <button type="button" className="pw-primary" disabled={!ready} onClick={() => { audio().ui(); start(nxt ?? NIGHTS[0].id); }}>
                {mounted && Object.keys(S.best).length ? (nxt ? `Continue · Night ${nightNo(nxt)} ${nightById(nxt)!.name}` : 'Build again') : 'Start building'}
              </button>
              <button type="button" onClick={() => { audio().ui(); setRoom(nxt ? roomOf(nxt) : 'living'); setScreen('nights'); song('menu'); }}>The nights · {stars}/{total} ★</button>
              <button type="button" disabled={!ready} onClick={() => { audio().ui(); start(null); }}>Free build</button>
            </div>
            <p className="pw-note">{mounted ? `${Object.keys(S.best).length} of ${NIGHTS.length} nights built` : ' '}</p>
            <div className="pw-menu-foot"><a className="pw-back" href="/">← MAIN ARCADE</a><Toggles /></div>
          </div>
        </section>
      )}

      {screen === 'nights' && (
        <section className="pw-nights">
          <header className="pw-bar">
            <button type="button" className="pw-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button>
            <span className="pw-bar-mid">The nights · {stars}/{total} ★</span>
            <Toggles />
          </header>
          <nav className="pw-tabs" aria-label="Rooms">
            {ROOMS.map((r, i) => (
              <button type="button" key={r.id} className={'pw-tab' + (r.id === room ? ' is-on' : '')} disabled={!roomOpen(S, r.id)} onClick={() => { audio().ui(); setRoom(r.id); }}>
                <b>{i + 1}</b> {r.name} <small>{roomNights(r.id).reduce((a, n) => a + (S.best[n.id]?.stars ?? 0), 0)}/18</small>
              </button>
            ))}
          </nav>
          <p className="pw-room-blurb">{rm.blurb}</p>
          <div className="pw-cards">
            {roomNights(room).map((n) => {
              const open = nightOpen(S, n.id), b = S.best[n.id];
              return (
                <button type="button" key={n.id} className={'pw-card' + (b ? ' is-done' : '')} disabled={!open} onClick={() => { audio().ui(); start(n.id); }}>
                  <span className="pw-card-no">Night {nightNo(n.id)}</span>
                  <span className="pw-card-name">{n.name}</span>
                  <span className="pw-card-stars" aria-label={`${b?.stars ?? 0} stars`}>{[1, 2, 3].map((k) => <i key={k} className={(b?.stars ?? 0) >= k ? 'on' : ''}>★</i>)}</span>
                  <span className="pw-card-goal">{open ? `line ${n.line}${n.den !== undefined ? ` · den ${n.den}` : ''} · par ${n.par}` : '🔒 locked'}</span>
                  <span className="pw-card-haz">{open ? hazardIcons(n.id) || 'calm' : ''}</span>
                </button>
              );
            })}
          </div>
          {!roomOpen(S, ROOMS[Math.min(3, ROOMS.findIndex((r) => r.id === room) + 1)].id) && <p className="pw-note pw-nights-note">Build every night in a room to open the next one.</p>}
        </section>
      )}

      <div className={'pw-stage' + (screen === 'play' ? '' : ' is-hidden')} ref={stage}>
        {screen === 'play' && g && (
          <header className="pw-bar">
            <button type="button" className="pw-back" onClick={() => { audio().ui(); window.clearTimeout(resultT.current); if (nt) setRoom(nt.room); leave(g.sandbox ? 'menu' : 'nights'); }}>{g.sandbox ? '← MENU' : '← NIGHTS'}</button>
            <span className="pw-bar-mid">
              {nt ? <>
                <span className="pw-name"><small>{nightLabel(nt.id)}</small> {nt.name}</span>
                <span className={'pw-goal' + (top >= nt.line ? ' is-met' : '')} title="Reach the line">▲ <b>{top.toFixed(1)}</b><small>/{nt.line}</small></span>
                {nt.den !== undefined && <span className={'pw-goal pw-goal-den' + (den >= nt.den ? ' is-met' : '')} title="Den under a roof">⌂ <b>{den.toFixed(1)}</b><small>/{nt.den}</small></span>}
                <span className={'pw-goal' + (g.used > nt.par ? ' is-over' : '')} title="Pieces used, and par">◼ <b>{g.used}</b><small>/{nt.par}</small></span>
              </> : <span className="pw-name">Free build · height <b>{top.toFixed(1)}</b>{g.den().area > 0 ? ` · den ${g.den().area.toFixed(1)}` : ''}</span>}
            </span>
            <Toggles />
          </header>
        )}
        <canvas ref={canvas} className="pw-canvas" tabIndex={0} aria-label="The pillow fort"
          onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { press.current = null; }} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && g && !g.sandbox && g.phase === 'build' && (
          <div className="pw-basket" aria-label="Coming next">
            <span>{g.held ? 'Next' : 'Basket empty'}</span>
            {g.queue.slice(0, 2).map((k, i) => <Icon key={i + k + g.used} kind={k} n={g.pieces.length + 1 + i} size={orient === 'tall' ? 34 : 42} />)}
            {g.queue.length > 2 && <small>+{g.queue.length - 2}</small>}
          </div>
        )}
        {screen === 'play' && g && g.phase === 'check' && <p className="pw-check" role="status">Hold still… <b>{checkLeft}</b></p>}
        {screen === 'play' && g && !result && g.phase === 'build' && (
          <div className="pw-tools">
            <button type="button" onClick={() => { audio(); turn(1); }} disabled={!g.held || !PIECES[g.held.kind].step}>↻ Turn</button>
            <button type="button" className="pw-drop" onClick={drop} disabled={!g.held}>⤓ Drop</button>
            {!g.sandbox && <button type="button" className="pw-bed" onClick={bed} disabled={!g.used}>☾ Bedtime</button>}
            <button type="button" onClick={restart} disabled={!g.used}>{g.sandbox ? '⟲ Clear' : '⟲ Restart'}</button>
          </div>
        )}
        {screen === 'play' && g?.sandbox && g.phase === 'build' && (
          <div className="pw-shelf" aria-label="Pieces">
            {SANDBOX_KINDS.map((k) => (
              <button type="button" key={k} className={'pw-shelf-item' + (g.held?.kind === k ? ' is-on' : '')} title={PIECES[k].name} aria-label={PIECES[k].name} onClick={() => { audio().ui(); g.pick(k); refresh(); }}>
                <Icon kind={k} size={30} />
              </button>
            ))}
          </div>
        )}
        {screen === 'play' && toast && !result && <p className="pw-toast" role="status">{toast}</p>}
        {screen === 'play' && result && (
          <div className="pw-result" role="dialog" aria-label="Bedtime">
            <div className={'pw-result-card s' + result.stars}>
              <p className="pw-eyebrow">NIGHT {nightNo(result.id)} · {nightById(result.id)!.name.toUpperCase()}</p>
              <p className="pw-stars" aria-label={`${result.stars} stars`}>{[1, 2, 3].map((k) => <i key={k} className={result.stars >= k ? 'on' : ''}>★</i>)}</p>
              <h2>{TITLES[result.stars][(result.used + Math.round(result.height * 10)) % TITLES[result.stars].length]}</h2>
              <ul className="pw-goals">
                <li className={result.goals[0] ? 'ok' : ''}>{result.goals[0] ? '✓' : '✗'} Stood past the line{nightById(result.id)!.den !== undefined ? ' with a den' : ''} <small>{result.height.toFixed(1)} / {nightById(result.id)!.line}{nightById(result.id)!.den !== undefined ? ` · den ${result.den.toFixed(1)} / ${nightById(result.id)!.den}` : ''}</small></li>
                <li className={result.goals[1] ? 'ok' : ''}>{result.goals[1] ? '✓' : '✗'} Up to the star line <small>{result.height.toFixed(1)} / {nightById(result.id)!.high}</small></li>
                <li className={result.goals[2] ? 'ok' : ''}>{result.goals[2] ? '✓' : '✗'} In par <small>{result.used} / {nightById(result.id)!.par} pieces</small></li>
              </ul>
              {result.stars === 0 && <p className="pw-note">{result.goals[0] ? '' : nightById(result.id)!.den !== undefined && result.height >= nightById(result.id)!.line ? 'Tall enough, but the den needs a roof over it.' : 'The fort has to stand past the line for five seconds.'}</p>}
              <div className="pw-result-buttons">
                {result.stars > 0
                  ? <button type="button" className="pw-primary" autoFocus onClick={() => afterResult('next')}>{result.id === NIGHTS[NIGHTS.length - 1].id && !S.ended ? 'Lights out' : 'Next night'}</button>
                  : <button type="button" className="pw-primary" autoFocus onClick={() => afterResult('again')}>Try again</button>}
                {result.stars > 0 && <button type="button" onClick={() => afterResult('again')}>Build again</button>}
                <button type="button" onClick={() => afterResult('nights')}>Nights</button>
              </div>
            </div>
          </div>
        )}
        {tip && screen === 'play' && (
          <div className="pw-tip" role="dialog" aria-label={tip.title}>
            <div className="pw-tip-card"><h2>{tip.title}</h2><p>{tip.text}</p>
              {!touch && <p className="pw-keys"><kbd>←</kbd><kbd>→</kbd> or the mouse move · <kbd>↑</kbd> or right-click turns · <kbd>Space</kbd> or click drops · <kbd>B</kbd> bedtime · <kbd>R</kbd> restart</p>}
              {touch && <p className="pw-keys">Drag to move the piece · ↻ Turn · ⤓ Drop · ☾ Bedtime when it’s done</p>}
              <button type="button" className="pw-primary" autoFocus onClick={() => { audio().ui(); setTip(null); }}>Let’s build</button></div>
          </div>
        )}
      </div>

      {screen === 'ending' && (
        <section className="pw-ending">
          <Art src="/art/fort/ending.webp" paint="ending" w={1536} h={1024} className="pw-ending-art" />
          <div className="pw-ending-card">
            <p className="pw-eyebrow">LIGHTS OUT</p>
            <h2>The grandest fort of all</h2>
            <p>The storm grumbles away over the hills and the moon comes out. Inside the grand fort, under the blanket roof and the fairy lights, Dora and Enzo curl up with a book and read until their eyes close. Not one cushion falls.</p>
            <p className="pw-note">{Object.keys(S.best).length} of {NIGHTS.length} nights · {stars} of {total} stars</p>
            <div className="pw-menu-buttons">
              <button type="button" className="pw-primary" onClick={() => { audio().ui(); start(null); }}>Free build</button>
              <button type="button" onClick={() => { audio().ui(); setScreen('nights'); song('menu'); }}>The nights</button>
            </div>
          </div>
        </section>
      )}
      {error && <p className="pw-error">{error}</p>}
    </main>
  );
}
