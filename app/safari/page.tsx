'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SafariGame, SPECIES, SPECIES_BY_ID, TRAILS, TIMES, UNLOCKS, FILM, DAY, ZOOM, BERRIES, SAVE_KEY, ALL_SLOTS, MAX_STARS,
  readProfile, journalStars, slotsFilled, isOpen, nextUnlock, toolsFor, develop, paste, comment, hint, slotKey,
  type Profile, type Photo, type TrailId, type TimeId, type Pace, type Developed, type SafariEvent,
} from '@/lib/safari-game';
import { SafariScene, paintPhoto, onArt } from '@/lib/safari-scene';
import { SafariSound } from './sound';
import './safari.css';

type Screen = 'menu' | 'out' | 'develop' | 'journal';
type Toast = { id: number; text: string };
const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
const KEY_PACE: Record<string, Pace> = { '1': 'tiptoe', '2': 'walk', '3': 'run' };
const PACES: { id: Pace; name: string }[] = [{ id: 'tiptoe', name: 'Tiptoe' }, { id: 'walk', name: 'Walk' }, { id: 'run', name: 'Hurry' }];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nameOf = (p: { sp: string; bh: string }) => { const s = SPECIES_BY_ID[p.sp]; return { sp: s?.name ?? p.sp, bh: s?.b.find((b) => b.id === p.bh)?.name ?? p.bh }; };
const TIME_ICON: Record<TimeId, string> = { morning: '🌄', noon: '☀️', dusk: '🌇' };
const TRAIL_ICON: Record<TrailId, string> = { puna: '🌾', forest: '🌿', salar: '🦩', cliffs: '🪨' };

/** A saved photo, re-drawn from its description. */
function Print({ photo, w = 300 }: { photo: Photo; w?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const draw = () => { if (ref.current) paintPhoto(ref.current, photo); }; draw(); return onArt(draw); }, [photo]);
  return <canvas ref={ref} width={w} height={Math.round(w / 1.5)} className="safari-print-img" role="img" aria-label={`${nameOf(photo).sp}: ${nameOf(photo).bh}`} />;
}

export default function SnapshotSafariPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<SafariScene | null>(null), sound = useRef<SafariSound | null>(null);
  const game = useRef<SafariGame | null>(null), demo = useRef<SafariGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), paceRef = useRef<Pace>('walk');
  const keys = useRef(new Set<string>()), hold = useRef<-1 | 0 | 1>(0), pointer = useRef<{ x: number; y: number } | null>(null), aimOff = useRef({ dx: 5, dy: 0.8 });
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [pace, setPaceState] = useState<Pace>('walk'), [toasts, setToasts] = useState<Toast[]>([]), [, setTick] = useState(0);
  const [dev, setDev] = useState<Developed[]>([]), [news, setNews] = useState<string[] | null>(null), [lost, setLost] = useState(0);
  const [page, setPage] = useState(SPECIES[0].id), [trail, setTrail] = useState<TrailId>('puna'), [time, setTime] = useState<TimeId>('morning');
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const P = profile.current;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new SafariSound(); sound.current.muted = !profile.current.sound; sound.current.unlock(); return sound.current; };
  const recent = useRef(new Map<string, number>());
  const toast = (text: string) => {
    const now = Date.now(); if ((recent.current.get(text) ?? 0) > now - 4000) return; recent.current.set(text, now);
    const id = Date.now() + Math.random(); setToasts((t) => [...t.slice(-2), { id, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };
  const setPace = (p: Pace) => { paceRef.current = p; setPaceState(p); };
  const makeDemo = (tr: TrailId, tm: TimeId) => { demo.current = new SafariGame({ trail: tr, time: tm, who: profile.current.who, seed: 11 }); };

  function pick(tr: TrailId | null, tm: TimeId | null) {
    if (tr && !isOpen(profile.current, tr)) return; if (tm && !isOpen(profile.current, tm)) return;
    const a = tr ?? trail, b = tm ?? time;
    setTrail(a); setTime(b); profile.current.trail = a; profile.current.time = b; save(); makeDemo(a, b); audio().tap();
  }
  function start(tr: TrailId = trail, tm: TimeId = time, seed = Math.floor(Math.random() * 1e9)) {
    const p = profile.current; if (!isOpen(p, tr) || !isOpen(p, tm)) return;
    audio();
    game.current = new SafariGame({ trail: tr, time: tm, who: p.who, seed, tools: toolsFor(p), day: p.outings + 1 });
    keys.current.clear(); hold.current = 0; pointer.current = null; aimOff.current = { dx: 5, dy: 0.8 }; setPace('walk');
    pausedRef.current = false; setPaused(false); setToasts([]); setNews(null); setScreen('out');
    toast(`${TRAILS.find((t) => t.id === tr)!.name}, ${TIMES.find((t) => t.id === tm)!.name.toLowerCase()}. ${FILM} frames of film. Have fun!`);
    canvas.current?.focus();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'out' || !game.current || game.current.state !== 'out') return;
    pausedRef.current = on; setPaused(on); keys.current.clear(); hold.current = 0; if (!on) canvas.current?.focus();
  }
  function finish(g: SafariGame) {
    const d = develop(profile.current, g.photos);
    setDev(d); setLost(g.trapLost ? g.trap!.shots.length : 0); setNews(null); setScreen('develop');
    d.forEach((x, i) => setTimeout(() => { if (screenRef.current === 'develop') sound.current?.star(Math.min(5, x.photo.st)); }, 500 + i * 140));
  }
  function keep() {
    const g = game.current; if (!g) return;
    const n = paste(profile.current, g.photos, dev.filter((d) => d.keep).map((d) => d.photo)); save();
    setNews(n); if (n.length) sound.current?.chime(); refresh();
  }
  function snap() {
    const g = game.current; if (!g || screenRef.current !== 'out' || pausedRef.current) return;
    if (g.film <= 0) { toast('Out of film! Head home to develop your photos.'); return; }
    const p = g.snap(); if (p !== undefined) sound.current?.shutter();
  }
  const tool = (k: 'toss' | 'whistle' | 'trap') => {
    const g = game.current; if (!g || pausedRef.current || screenRef.current !== 'out') return;
    if (k === 'toss') { if (g.toss()) sound.current?.toss(); else if (g.berries <= 0) toast('The berry pouch is empty.'); }
    if (k === 'whistle') { if (!g.whistle() && g.tools.whistle) toast('Catch your breath before whistling again.'); }
    if (k === 'trap') { if (g.placeTrap()) toast('Camera trap set! Walk away, then come back for it.'); }
  };
  const crouch = () => { const g = game.current; if (g && !pausedRef.current) g.hide(!g.crouch); };
  const zoom = (by: number) => { const g = game.current; if (g) g.aim(g.view.x, g.view.y, Math.round((g.view.zoom + by) * 2) / 2); };
  function events(ev: SafariEvent[], g: SafariGame) {
    const s = sound.current;
    for (const e of ev) {
      if (e.kind === 'flee') { s?.scurry(); toast(`The ${SPECIES_BY_ID[e.sp].name.toLowerCase()} scampered off. Try tiptoeing, or hiding in the ${TRAILS.find((t) => t.id === g.trail.id)!.cover}.`); }
      else if (e.kind === 'rare' && Math.abs((g.animals.find((a) => a.sp.id === e.sp && a.sp.b[a.beh].id === e.bh)?.x ?? 999) - g.x) < 16) toast(`✦ Something special nearby: ${nameOf(e).bh.toLowerCase()}!`);
      else if (e.kind === 'whistle') s?.whistle();
      else if (e.kind === 'trapShot') s?.trap();
      else if (e.kind === 'trapBack') { toast(e.n ? `Camera trap fetched: ${e.n} photo${e.n > 1 ? 's' : ''} inside!` : 'Camera trap fetched. Nobody came by this time.'); s?.chime(); }
      else if (e.kind === 'late') { toast('The light is changing: 45 seconds left.'); s?.late(); }
    }
  }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const p = profile.current; setTrail(p.trail); setTime(p.time); makeDemo(p.trail, p.time);
    const w = window as unknown as Record<string, unknown>;
    w.__safari = () => game.current;
    w.__safariStart = (tr: TrailId, tm: TimeId, seed?: number) => start(tr, tm, seed);
    w.__safariProfile = () => profile.current;
    let dead = false, raf = 0, last = 0, ui = 0;
    const resize = () => scene.current?.resize();
    try { scene.current = new SafariScene(canvas.current!); } catch { setError('This browser cannot draw the trail.'); return; }
    window.addEventListener('resize', resize);
    setReady(true);
    const loop = (ms: number) => {
      if (dead) return;
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
      const sc = scene.current!, g = game.current, scr = screenRef.current;
      sc.inset = scr === 'out' ? (window.innerWidth < 760 ? 168 : 96) : 0;
      if (scr === 'out' && g) {
        if (!pausedRef.current && g.state === 'out') {
          const k = keys.current, dir = ((k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) || hold.current) as -1 | 0 | 1;
          const want = k.has('shift') ? 'tiptoe' : paceRef.current;
          if (dir !== g.moving || (dir && want !== g.pace)) g.move(dir, want); else if (!dir) g.pace = want;
          // the viewfinder follows the pointer, or stays put beside you when aimed with keys
          if (k.has('i')) aimOff.current.dy += dt * 3; if (k.has('k')) aimOff.current.dy -= dt * 3;
          if (k.has('j')) aimOff.current.dx -= dt * 5; if (k.has('l')) aimOff.current.dx += dt * 5;
          if (pointer.current) { const wpt = sc.toWorld(pointer.current.x, pointer.current.y); g.aim(wpt.x, wpt.y); }
          else { aimOff.current.dx = Math.max(-14, Math.min(14, aimOff.current.dx)); aimOff.current.dy = Math.max(0, Math.min(8, aimOff.current.dy)); g.aim(g.x + aimOff.current.dx, aimOff.current.dy); }
          g.tick(dt);
          const ev = g.events.splice(0);
          if (ev.length) { sc.feed(ev, g); events(ev, g); }
        }
        // the day ran out, or Head home was picked (from the pause menu, the outing ends while paused)
        if (g.state === 'done') { finish(g); raf = requestAnimationFrame(loop); return; }
        const pv = g.state === 'out' ? g.preview() : null, n = pv ? nameOf(pv) : null;
        sc.draw(g, { dt: pausedRef.current ? 0 : dt, label: n ? `${n.sp} · ${n.bh}${pv!.rare ? ' ✦' : ''}` : '', sharp: pv ? pv.sharp : null });
      } else {
        const d = demo.current; if (d) { d.tick(dt); d.events.length = 0; sc.draw(d, { dt, menu: true }); }
      }
      if (ms - ui > 120) { ui = ms; refresh(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (screenRef.current === 'out') {
        if ((k === 'escape' || k === 'p') && !e.repeat) { pause(!pausedRef.current); return; }
        if (pausedRef.current) { if (k === 'h' && !e.repeat) { pausedRef.current = false; setPaused(false); game.current?.home(); } return; }
        if (['a', 'd', 'arrowleft', 'arrowright', 'shift', 'i', 'j', 'k', 'l'].includes(k)) { keys.current.add(k); if (k.startsWith('arrow')) e.preventDefault(); if ('ijkl'.includes(k)) pointer.current = null; return; }
        if (e.repeat) return;
        if (k === ' ' || k === 'enter') { e.preventDefault(); snap(); }
        else if (k in KEY_PACE) setPace(KEY_PACE[k]);
        else if (k === 's' || k === 'arrowdown') { e.preventDefault(); crouch(); }
        else if (k === '+' || k === '=' || k === 'arrowup') { e.preventDefault(); zoom(0.5); }
        else if (k === '-' || k === '_') zoom(-0.5);
        else if (k === 'b') tool('toss');
        else if (k === 'v') tool('whistle');
        else if (k === 'c') tool('trap');
        else if (k === 'h') pause(true);
      } else if (screenRef.current === 'journal' && k === 'escape') setScreen('menu');
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => { keys.current.clear(); hold.current = 0; if (screenRef.current === 'out') pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mouse and touch: the viewfinder follows the pointer; a mouse click snaps, a finger snaps with the button
  const at = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = (e: React.PointerEvent) => { if (screenRef.current === 'out' && (e.pointerType === 'mouse' || e.buttons)) pointer.current = at(e); };
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'out') return;
    pointer.current = at(e); audio();
    if (e.pointerType === 'mouse' && e.button === 0) snap();
  };
  const onWheel = (e: React.WheelEvent) => { if (screenRef.current === 'out') zoom(e.deltaY < 0 ? 0.5 : -0.5); };
  const holdBtn = (dir: -1 | 1) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); hold.current = dir; audio(); },
    onPointerUp: () => { hold.current = 0; }, onPointerCancel: () => { hold.current = 0; }, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const g = game.current, out = screen === 'out' && g, stars = journalStars(P), next = nextUnlock(P), prev = [...UNLOCKS].reverse().find((u) => stars >= u.need)?.need ?? 0;
  const sp = SPECIES_BY_ID[page], spSlots = sp.b.map((b) => P.journal[slotKey(sp.id, b.id)]);
  return (
    <main className="safari-shell" data-ready={ready ? 'true' : undefined} data-screen={screen}>
      <canvas ref={canvas} className="safari-canvas" tabIndex={0} onPointerMove={onMove} onPointerDown={onDown} onWheel={onWheel}
        aria-label="Snapshot Safari trail. A and D (or the arrow keys) walk; 1, 2 and 3 pick tiptoe, walk or hurry; S crouches; the mouse aims and clicking (or Space) takes a photo; P pauses." />
      {error && <div className="safari-panel safari-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="safari-menu" aria-label="Plan an outing">
          <header className="safari-head">
            <a href="/" className="safari-back">← ARCADE</a>
            <button className="safari-chip" aria-pressed={P.sound} onClick={() => { P.sound = !P.sound; save(); audio(); refresh(); }}>{P.sound ? '🔊 Sound on' : '🔇 Sound off'}</button>
          </header>
          <div className="safari-title">
            <img src="/art/safari/title.webp" alt="" width={1600} height={1000} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="safari-eyebrow">A CHINCHILLA PHOTO SAFARI IN THE ANDES</p>
              <h1>Snapshot <em>Safari</em></h1>
              <p className="safari-sub">Tiptoe, hide in the grass, wait for the magic moment, and fill your field journal.</p>
            </div>
          </div>
          <div className="safari-progress">
            <div className="safari-progress-row"><b>{stars} ★</b><span>{slotsFilled(P)} of {ALL_SLOTS.length} journal slots · {P.outings} outing{P.outings === 1 ? '' : 's'}</span></div>
            <div className="safari-bar" role="progressbar" aria-label="Journal stars to the next surprise" aria-valuenow={stars} aria-valuemin={prev} aria-valuemax={next?.need ?? MAX_STARS}><i style={{ width: `${next ? ((stars - prev) / (next.need - prev)) * 100 : 100}%` }} /></div>
            <small>{next ? `${next.need - stars} more journal stars to unlock: ${next.name}` : 'Everything is unlocked. Can you get five stars in every slot?'}</small>
          </div>
          <div className="safari-who" role="group" aria-label="Photographer">
            {(['dora', 'enzo'] as const).map((who) => (
              <button key={who} aria-pressed={P.who === who} className={P.who === who ? 'is-on' : ''} onClick={() => { P.who = who; save(); makeDemo(trail, time); audio().tap(); refresh(); }}>
                <span className={`safari-face safari-face-${who}`} aria-hidden />{who === 'dora' ? 'Dora' : 'Enzo'}
              </button>
            ))}
          </div>
          <ol className="safari-trails" aria-label="Trails">
            {TRAILS.map((tr) => {
              const open = isOpen(P, tr.id), need = UNLOCKS.find((u) => u.id === tr.id)?.need ?? 0;
              const here = SPECIES.filter((s) => s.where[tr.id]), got = here.reduce((n, s) => n + s.b.filter((b) => P.journal[slotKey(s.id, b.id)]).length, 0), all = here.reduce((n, s) => n + s.b.length, 0);
              return (
                <li key={tr.id}>
                  <button className={'safari-trail' + (trail === tr.id ? ' is-on' : '')} aria-pressed={trail === tr.id} disabled={!open} onClick={() => pick(tr.id, null)}>
                    <span className={`safari-thumb t-${tr.id}`} aria-hidden>{TRAIL_ICON[tr.id]}</span>
                    <span className="safari-trail-body"><strong>{tr.name}</strong><small>{open ? tr.blurb : `Opens at ${need} journal stars`}</small>{open && <i>{got} / {all} slots</i>}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="safari-go-box">
            <div className="safari-times" role="group" aria-label="Time of day">
              {TIMES.map((tm) => { const open = isOpen(P, tm.id); return <button key={tm.id} aria-pressed={time === tm.id} className={time === tm.id ? 'is-on' : ''} disabled={!open} onClick={() => pick(null, tm.id)}><b>{TIME_ICON[tm.id]} {tm.name}</b><small>{open ? (tm.id === 'noon' ? 'harsh light, busy animals' : tm.id === 'dusk' ? 'golden light, shy ones out' : 'soft light, early birds') : `at ${UNLOCKS.find((u) => u.id === tm.id)!.need} ★`}</small></button>; })}
            </div>
            <p className="safari-tools">
              {(['berries', 'whistle', 'trap'] as const).map((t) => { const open = isOpen(P, t), u = UNLOCKS.find((x) => x.id === t)!; return <span key={t} className={open ? 'got' : ''}>{t === 'berries' ? '🫐' : t === 'whistle' ? '🎵' : '📷'} {u.name}{open ? '' : ` · ${u.need} ★`}</span>; })}
            </p>
            <button className="safari-go" disabled={!ready} onClick={() => start()}>{ready ? 'SET OFF →' : 'Packing the camera…'}</button>
            <button className="safari-journal-btn" onClick={() => { setScreen('journal'); audio().tap(); }}>📔 Field journal</button>
          </div>
          <p className="safari-how"><b>A D</b> or <b>← →</b> walk · <b>1 2 3</b> tiptoe, walk, hurry (hold <b>Shift</b> to tiptoe) · <b>S</b> crouch and hide · <b>mouse</b> aims, <b>click</b> or <b>Space</b> snaps · <b>wheel</b> or <b>+ −</b> zooms · <b>B V C</b> berries, whistle, trap · <b>P</b> pause</p>
        </section>
      )}

      {out && (
        <>
          <p className="safari-turn" key={g.seed}>📱 Turn your phone sideways for a wider view of the trail</p>
          <div className="safari-hud">
            <button className="safari-chip" onClick={() => pause(true)}>❚❚ Pause</button>
            <div className="safari-day" aria-label={`Daylight left: ${clock(g.dayLeft)}`}>
              <span>{TIME_ICON[g.time]} {TRAILS.find((t) => t.id === g.trail.id)!.name}</span>
              <div className="safari-bar"><i style={{ width: `${(g.dayLeft / DAY) * 100}%` }} /></div>
              <small>{clock(g.dayLeft)} of light left</small>
            </div>
            <div className={'safari-film' + (g.film <= 3 ? ' is-low' : '')} aria-label={`${g.film} frames of film left`}>🎞 <b>{g.film}</b><small>/{FILM}</small></div>
          </div>
          <div className="safari-toasts" aria-live="polite">{toasts.map((t) => <p key={t.id}>{t.text}</p>)}</div>
          <div className="safari-pad">
            <div className="safari-walk">
              <button className="safari-arrow" aria-label="Walk left" {...holdBtn(-1)}>◀</button>
              <div className="safari-paces" role="group" aria-label="Pace">{PACES.map((p) => <button key={p.id} aria-pressed={pace === p.id} className={pace === p.id ? 'is-on' : ''} onClick={() => setPace(p.id)}>{p.name}</button>)}</div>
              <button className="safari-arrow" aria-label="Walk right" {...holdBtn(1)}>▶</button>
              <button className={'safari-hide' + (g.crouch ? ' is-on' : '') + (g.hidden ? ' is-hidden' : '')} aria-pressed={g.crouch} onClick={crouch}>{g.hidden ? '🌾 Hidden' : g.crouch ? 'Crouching' : g.cover() ? '🌾 Hide' : 'Crouch'}</button>
            </div>
            <div className="safari-shoot">
              {g.tools.berries && <button className="safari-tool" disabled={g.berries <= 0 || !!g.berry} onClick={() => tool('toss')} title="Toss berries (B)">🫐<small>{g.berries}/{BERRIES}</small></button>}
              {g.tools.whistle && <button className="safari-tool" disabled={g.t - g.whistleAt < 8} onClick={() => tool('whistle')} title="Soft whistle (V)">🎵<small>whistle</small></button>}
              {g.tools.trap && <button className="safari-tool" disabled={!!g.trap} onClick={() => tool('trap')} title="Set the camera trap (C)">📷<small>{g.trap ? (g.trap.back ? 'home' : `out · ${g.trap.shots.length}`) : 'trap'}</small></button>}
              <div className="safari-zoom"><button aria-label="Zoom out" onClick={() => zoom(-0.5)}>−</button><input type="range" min={ZOOM[0]} max={ZOOM[1]} step={0.5} value={g.view.zoom} aria-label="Zoom" onChange={(e) => { const v = Number(e.target.value); g.aim(g.view.x, g.view.y, v); }} /><button aria-label="Zoom in" onClick={() => zoom(0.5)}>+</button></div>
              <button className="safari-snap" disabled={g.film <= 0} onClick={snap} aria-label="Take a photo">📸</button>
            </div>
          </div>
          {paused && (
            <div className="safari-panel" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <p>The animals will wait. {g.film} frames left, {clock(g.dayLeft)} of light.</p>
              {g.trap && !g.trap.back && <p className="safari-warn">Your camera trap is still out{g.trap.shots.length ? ` with ${g.trap.shots.length} photo${g.trap.shots.length > 1 ? 's' : ''} in it` : ''}. Walk back to fetch it before heading home!</p>}
              <div className="safari-row"><button className="safari-go" onClick={() => pause(false)}>Keep exploring</button><button onClick={() => { pausedRef.current = false; setPaused(false); g.home(); }}>Head home (H)</button></div>
            </div>
          )}
        </>
      )}

      {screen === 'develop' && g && (
        <section className="safari-develop" aria-label="Developing photos">
          <header>
            <p className="safari-eyebrow">{TRAILS.find((t) => t.id === g.trail.id)!.name.toUpperCase()} · {g.time.toUpperCase()}</p>
            <h2>{g.photos.length ? 'Developing your photos…' : 'Home again!'}</h2>
            <p>{g.photos.length ? `${g.photos.length} photo${g.photos.length > 1 ? 's' : ''}. Pick the ones for the field journal: the best of each moment is ticked for you.` : 'No photos this time, but what a lovely walk. Next time, try standing still and waiting.'}</p>
            {lost > 0 && <p className="safari-warn">The camera trap stayed out on the trail with {lost} photo{lost > 1 ? 's' : ''} in it. Next time, walk back to fetch it!</p>}
          </header>
          <ol className="safari-prints">
            {dev.map((d, i) => { const n = nameOf(d.photo), had = P.journal[d.slot]; return (
              <li key={d.photo.id + i} className="safari-print" style={{ animationDelay: `${0.3 + i * 0.14}s` }}>
                <Print photo={d.photo} />
                <div className="safari-print-body">
                  <p className="safari-stars" aria-label={`${d.photo.st} of 5 stars`}>{STARS(d.photo.st)}</p>
                  <strong>{n.sp}</strong><small>{n.bh}{d.photo.rare ? ' · ✦ rare' : ''}{d.photo.trap ? ' · camera trap' : ''}</small>
                  <p className="safari-comment">{comment(d.photo)}</p>
                  {!news && <label className="safari-keep"><input type="checkbox" checked={d.keep} disabled={d.photo.st === 0} onChange={(e) => setDev(dev.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} />
                    {d.isNew ? <b className="tag-new">NEW SLOT</b> : d.better ? <b className="tag-better">BETTER than {had?.st}★</b> : <span>journal has {had?.st}★</span>}</label>}
                </div>
              </li>
            ); })}
          </ol>
          <div className="safari-row safari-dev-actions">
            {!news ? <button className="safari-go" onClick={keep}>{dev.some((d) => d.keep) ? `Paste ${dev.filter((d) => d.keep).length} into the journal` : 'Done'}</button>
              : <>
                <p className="safari-news">{news.length ? news.map((x) => <b key={x}>{x}</b>) : <span>The journal is unchanged this time.</span>}</p>
                <button className="safari-go" onClick={() => start(g.trail.id, g.time)}>Another outing</button>
                <button onClick={() => { const first = dev.find((d) => d.keep); if (first) setPage(first.photo.sp); setScreen('journal'); }}>📔 Journal</button>
                <button onClick={() => { makeDemo(trail, time); setScreen('menu'); }}>Back to camp</button>
              </>}
          </div>
        </section>
      )}

      {screen === 'journal' && (
        <section className="safari-journal" aria-label="Field journal">
          <header className="safari-head">
            <button className="safari-chip" onClick={() => setScreen('menu')}>← Camp</button>
            <h2>📔 Field journal <small>{slotsFilled(P)}/{ALL_SLOTS.length} · {stars} ★</small></h2>
          </header>
          <div className="safari-book">
            <nav className="safari-index" aria-label="Creatures">
              {SPECIES.map((s) => { const n = s.b.filter((b) => P.journal[slotKey(s.id, b.id)]).length; return (
                <button key={s.id} className={(page === s.id ? 'is-on ' : '') + (n === s.b.length ? 'is-full' : '')} aria-pressed={page === s.id} onClick={() => setPage(s.id)}>
                  <span>{P.seen.includes(s.id) || n ? s.name : '???'}</span><i>{n}/{s.b.length}</i>
                </button>
              ); })}
            </nav>
            <article className="safari-page">
              <h3>{P.seen.includes(sp.id) || spSlots.some(Boolean) ? sp.name : 'Not yet spotted'}</h3>
              <p className="safari-fact">{sp.fact}</p>
              <p className="safari-where">Lives on: {Object.entries(sp.where).map(([tr, w]) => `${TRAILS.find((t) => t.id === tr)!.name} (${TIMES.filter((_, i) => w![i] > 0).map((t) => t.name.toLowerCase()).join(', ')})`).join(' · ')}</p>
              <ol className="safari-slots">
                {sp.b.map((b, i) => { const ph = spSlots[i]; return (
                  <li key={b.id} className={'safari-slot' + (ph ? ' has' : '') + (b.rare ? ' rare' : '')}>
                    {ph ? <Print photo={ph} w={360} /> : <div className="safari-empty" aria-hidden>?</div>}
                    <strong>{b.name}{b.rare ? ' ✦' : ''}</strong>
                    {ph ? <><p className="safari-stars">{STARS(ph.st)}</p><small>{comment(ph)}</small><small className="safari-by">{ph.who === 'enzo' ? 'Enzo' : 'Dora'} · outing {ph.day} · {TRAILS.find((t) => t.id === ph.tr)!.name}, {ph.tm}</small></> : <small>{hint(sp, b)}</small>}
                  </li>
                ); })}
              </ol>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
