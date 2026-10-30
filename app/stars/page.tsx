'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Stitch, PUZZLES, PUZZLE, NIGHTS, STORY, TUTORIAL, FINALE, SAVE_KEY, BANK_MAX, RULE_NAME,
  readSave, freshSave, puzzleOpen, nightOpen, nightPuzzles, nightSolved, storyDone, medals, solvedCount, nextPuzzle, record, recordDaily, dayBefore,
  type Save, type Puzzle, type Ev, type Refusal, type Result, type Rule,
} from '@/lib/stars-game';
import { hint as findHint, solve, dailySky, shootSky, type Hint } from '@/lib/stars-solver';
import type { StarsScene, Mood } from '@/lib/stars-scene';
import { StarsSound, type SongId } from './sound';
import './stars.css';

type Screen = 'menu' | 'chart' | 'play' | 'journal';
type Mode = 'story' | 'daily' | 'shoot';
type Done = { res: Result | null; medal: boolean; earned: boolean; daily: boolean; streak: number; level: number };
const sceneModule = () => import('@/lib/stars-scene');
const WHY: Record<Refusal, string> = {
  noseam: 'No seam joins those two stars.',
  used: 'That seam is already stitched.',
  oneway: 'The comet flies the other way: that seam only goes in its direction.',
  knot: 'A knot star can only be touched once.',
  full: 'That bright star has been touched as many times as it has rays.',
  moon: 'The thread has to begin at the crescent moon.',
  twinfull: 'Its twin can’t take the needle again.',
};
const STUCK = { nomoves: 'The needle has nowhere left to go, but some seams are still loose. Drag back along the thread to unpick, or ✨ Hint.', moon: 'Every seam is stitched, but the thread must finish at the full moon. Unpick and try another way.', bright: 'Every seam is stitched, but a bright star wasn’t touched the right number of times. Unpick and try another way.' } as const;
const RULE_TIP: Record<Rule, string> = { bright: '✦ rays: touch exactly that many times', knot: '∞ knot: touch only once', double: '═ double seam: stitch twice', oneway: '☄ comet: one way only', cloud: '☁ cloud: move close to see seams', twin: '◌ twins: the needle leaps', moon: '☾ start at the crescent, end at the full moon' };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className }: { src: string; paint: 'title' | 'ending'; w: number; h: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else m.paintEnding(c); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'ss-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A constellation drawn small: faint until it is stitched, then gold with its painted figure. */
function Thumb({ p, solved, size = 120 }: { p: Puzzle; solved: boolean; size?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false, img: HTMLImageElement | null = null;
    const paint = () => sceneModule().then((m) => { if (!dead && cv.current) m.paintConstellation(cv.current, p, solved, img); }).catch(() => {});
    if (solved && p.figure) { img = new Image(); img.onload = () => { void paint(); }; img.src = `/art/stars/fig-${p.figure}.webp`; }
    void paint();
    return () => { dead = true; };
  }, [p, solved]);
  return <canvas ref={cv} className="ss-thumb" width={size * 2} height={size * 1.6} style={{ width: size, height: size * 0.8 }} aria-hidden="true" />;
}

export default function StarsPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), tools = useRef<HTMLDivElement>(null), side = useRef<HTMLDivElement>(null);
  const scene = useRef<StarsScene | null>(null), sound = useRef<StarsSound | null>(null);
  const save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), st = useRef<Stitch | null>(null), mode = useRef<Mode>('story');
  const pointer = useRef<[number, number] | null>(null), hintRef = useRef<Hint | null>(null), freeHint = useRef(true);
  const blaze = useRef(0), doneAt = useRef(-1), clock = useRef(0), moodRef = useRef<{ m: Mood; until: number }>({ m: 'point', until: 0 });
  const focus = useRef(-1), toastTimer = useRef(0), today = useRef(''), panelTimer = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [night, setNight] = useState(1);
  const [done, setDone] = useState<Done | null>(null), [tip, setTip] = useState<{ title: string; text: string } | null>(null), [toast, setToast] = useState('');
  const [ending, setEnding] = useState(false), [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide'), [pairW, setPairW] = useState(300);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new StarsSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3400) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const mood = (m: Mood, sec = 2.4) => { moodRef.current = { m, until: clock.current + sec }; };
  const music = (id: SongId) => sound.current?.music(id);

  // ---------------------------------------------------------------- a sky: open it, stitch it, finish it
  function openPuzzle(p: Puzzle, m: Mode = 'story') {
    if (m === 'story' && !puzzleOpen(save.current, p.id)) return;
    audio().ui();
    mode.current = m; st.current = new Stitch(p); hintRef.current = null; freeHint.current = true; blaze.current = 0; doneAt.current = -1; focus.current = -1;
    window.clearTimeout(panelTimer.current);
    setDone(null); setToast('');
    scene.current?.setPuzzle(p);
    if (p.night >= 1) setNight(p.night);
    setScreen('play'); music('night'); mood('point', 1.5);
    const s = save.current;
    if (p.teach && !s.seen.includes(p.id)) { setTip(p.teach); s.seen.push(p.id); persist(); } else setTip(null);
    requestAnimationFrame(() => { layout(); canvas.current?.focus(); });
    refresh();
  }
  function openDaily() { if (!today.current) return; openPuzzle(dailySky(today.current), 'daily'); }
  function openShoot() { openPuzzle(shootSky(save.current.shoot.level), 'shoot'); }
  /** What the engine just did: sounds, sparkles, moods and words. */
  function drain() {
    const s = st.current; if (!s || !s.events.length) return;
    const evs = s.events.splice(0);
    scene.current?.feed(evs as { k: string }[]);
    const a = sound.current;
    for (const e of evs as Ev[]) {
      if (e.k === 'stitch') { a?.stitch(e.n); hintRef.current = hintRef.current?.k === 'back' ? hintRef.current : null; }
      else if (e.k === 'start') { a?.start(); if (hintRef.current?.k === 'start') hintRef.current = null; }
      else if (e.k === 'jump') a?.jump();
      else if (e.k === 'unpick') { a?.unpick(); if (hintRef.current?.k === 'back' && s.at === hintRef.current.at) hintRef.current = null; }
      else if (e.k === 'refuse') { a?.nope(); scene.current?.refuse(e.at); if (e.why !== 'noseam' || !s.started) showToast(WHY[e.why], 2600); }
      else if (e.k === 'stuck') { a?.stuck(); mood('sleepy', 3); showToast(STUCK[e.why], 4200); }
      else if (e.k === 'done') finish();
    }
    refresh();
  }
  function finish() {
    const s = st.current, sv = save.current; if (!s) return;
    const medal = s.clean; let res: Result | null = null, earned = false, daily = false, level = 0;
    if (mode.current === 'story') { res = record(sv, s); earned = res.earned; }
    else if (mode.current === 'daily') { daily = recordDaily(sv, today.current, dayBefore(today.current)); }
    else { level = sv.shoot.level; sv.shoot.best = Math.max(sv.shoot.best, level); sv.shoot.level = level + 1; if (s.hints === 0 && sv.bank < BANK_MAX) { sv.bank++; earned = true; } }
    persist();
    hintRef.current = null; doneAt.current = clock.current;
    audio().done(medal); mood('gasp', 6);
    window.clearTimeout(panelTimer.current);
    const info: Done = { res, medal, earned, daily, streak: sv.daily.streak, level };
    panelTimer.current = window.setTimeout(() => { setDone(info); refresh(); }, 1500);
    refresh();
  }
  function askHint() {
    const s = st.current, sv = save.current; if (!s || s.done) return;
    if (!freeHint.current && sv.bank <= 0) { audio().nope(); showToast('No hints left: stitch a sky without one to earn another ✨.'); return; }
    const h = findHint(s);
    if (h.k === 'none') return;
    if (freeHint.current) freeHint.current = false; else { sv.bank--; persist(); }
    s.hints++; hintRef.current = h; audio().hint();
    showToast(h.k === 'start' ? 'Begin at the glowing star.' : h.k === 'next' ? 'Stitch along the glowing seam.' : `This way can’t be finished. Unpick back to the pink star (${h.steps} stitch${h.steps === 1 ? '' : 'es'}).`, 4000);
    refresh();
  }
  function undo() { const s = st.current; if (!s || s.done) return; if (s.undo()) drain(); }
  function restart() { const s = st.current; if (!s || s.done || !s.started) return; s.restart(); audio().unpick(); hintRef.current = null; refresh(); }
  function nextAfter() {
    const s = st.current, sv = save.current; if (!s) return;
    if (mode.current === 'shoot') { openShoot(); return; }
    if (mode.current === 'daily') { toMenu(); return; }
    if (s.p.id === FINALE && !sv.ended) { sv.ended = true; persist(); setDone(null); setEnding(true); music('ending'); toChart(); return; }
    const n = nextPuzzle(sv); if (n) openPuzzle(n); else toChart();
  }
  function toChart() { st.current = null; scene.current?.setPuzzle(null); setDone(null); setTip(null); window.clearTimeout(panelTimer.current); setScreen('chart'); music('menu'); refresh(); }
  function toMenu() { st.current = null; scene.current?.setPuzzle(null); setDone(null); setTip(null); window.clearTimeout(panelTimer.current); setScreen('menu'); music('menu'); refresh(); }

  /** The stage's clear area, so the scene can frame the sky between the bars. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setOrient(r.height > r.width * 1.05 ? 'tall' : 'wide');
    if (!sc) return;
    sc.resize();
    const t = tools.current?.getBoundingClientRect(), sd = side.current?.getBoundingClientRect(), tall = r.height > r.width * 1.05;
    sc.inset = { top: tall && sd && sd.height > 0 ? Math.max(0, sd.bottom - r.top) : 0, right: 0, left: 0, bottom: t && t.height > 0 ? Math.max(8, r.bottom - t.top + 4) : 8 };
    sc.layout();
    setPairW(Math.round(sc.metrics().pair[2]));
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    today.current = todayStr();
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse); setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__stars = () => ({ screen: screenRef.current, mode: mode.current, puzzle: st.current?.p.id ?? null, st: st.current, save: save.current, hint: hintRef.current, freeHint: freeHint.current, blaze: blaze.current });
    w.__starsOpen = (id: string) => { const p = PUZZLE[id]; if (p) openPuzzle(p); };
    w.__starsPoint = (i: number) => { const sc = scene.current, cv = canvas.current, s = st.current; if (!sc || !cv || !s) return null; const b = cv.getBoundingClientRect(), q = s.p.stars[i], [x, y] = sc.toScreen(q.x, q.y); return [b.left + x, b.top + y]; };
    w.__starsSky = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(), [sx, sy] = sc.toScreen(x, y); return [b.left + sx, b.top + sy]; };
    w.__starsSolution = () => { const s = st.current; return s ? solve(s.p) : null; };
    w.__starsScene = () => scene.current?.metrics() ?? null;
    let dead = false, raf = 0, last = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.StarsScene(canvas.current); } catch { setError('This browser cannot draw the night sky.'); return; }
      for (let n = 1; n <= 5; n++) scene.current.want('night-' + n);
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        clock.current += dt;
        const s = st.current, sc = scene.current!;
        if (s?.done) blaze.current = Math.min(1, blaze.current + dt / 2.2);
        if (screenRef.current === 'play' && s) {
          const m = moodRef.current.until > clock.current ? moodRef.current.m : s.done ? 'gasp' : 'point';
          sc.draw({ dt, st: s, night: s.p.night >= 1 ? s.p.night : s.p.night === 0 ? 1 : 1 + (s.p.id.length % 5), pointer: pointer.current, mood: m, hint: hintRef.current, blaze: blaze.current, focus: focus.current, touch: false });
        }
        sound.current?.tick(true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The night sky could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), s = st.current, tgt = e.target as HTMLElement;
      if (screenRef.current !== 'play' || !s) return;
      if (k === 'escape') { e.preventDefault(); toChart(); return; }
      if (s.done) { if (k === 'enter' && document.querySelector('.ss-done')) { e.preventDefault(); nextAfter(); } return; }
      if (tgt.closest?.('button, a, input') && (k === 'enter' || k === ' ')) return;
      const list = s.started ? s.options() : s.p.stars.map((_, i) => i).filter((i) => !s.startRefusal(i));
      if (k === 'arrowright' || k === 'arrowdown' || k === 'tab' || k === 'arrowleft' || k === 'arrowup') {
        e.preventDefault(); if (!list.length) return;
        const back = k === 'arrowleft' || k === 'arrowup' || (k === 'tab' && e.shiftKey);
        const sorted = [...list].sort((a, b) => s.p.stars[a].x - s.p.stars[b].x || s.p.stars[a].y - s.p.stars[b].y);
        const i = sorted.indexOf(focus.current);
        focus.current = sorted[(i < 0 ? (back ? sorted.length - 1 : 0) : i + (back ? -1 : 1) + sorted.length) % sorted.length];
        audio().ui(); refresh(); return;
      }
      if (k === 'enter' || k === ' ') { e.preventDefault(); if (focus.current >= 0 && list.includes(focus.current)) { audio(); if (s.started) s.stitch(focus.current); else s.start(focus.current); focus.current = -1; drain(); } return; }
      if (k === 'backspace' || k === 'z' || k === 'u') { e.preventDefault(); audio(); undo(); return; }
      if (k === 'r') { e.preventDefault(); restart(); return; }
      if (k === 'h') { e.preventDefault(); askHint(); return; }
    };
    const blur = () => { st.current?.up(); sound.current?.suspend(); };
    const focusIn = () => { if (!document.hidden) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focusIn(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur); window.addEventListener('focus', focusIn); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect(); window.clearTimeout(toastTimer.current); window.clearTimeout(panelTimer.current);
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focusIn); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, orient, touch, tip, done]);

  // ---------------------------------------------------------------- the pointer: drag the thread from star to star
  const sky = (e: React.PointerEvent): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return scene.current?.toSky(e.clientX - b.left, e.clientY - b.top) ?? [0, 0]; };
  const radius = (e: React.PointerEvent) => scene.current?.hitRadius(e.pointerType !== 'mouse') ?? 6;
  const onDown = (e: React.PointerEvent) => {
    const s = st.current; if (screenRef.current !== 'play' || !s || s.done || tip) return;
    audio();
    if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
    const p = sky(e); pointer.current = p; focus.current = -1;
    s.down(p[0], p[1], radius(e)); drain();
  };
  const onMove = (e: React.PointerEvent) => {
    const s = st.current; if (!s) return;
    const p = sky(e); pointer.current = p;
    if (s.dragging) { s.move(p[0], p[1], radius(e)); if (s.events.length) drain(); }
  };
  const onUp = (e: React.PointerEvent) => { st.current?.up(); if (e.pointerType !== 'mouse') pointer.current = null; };
  const onLeave = (e: React.PointerEvent) => { if (e.pointerType === 'mouse' && !st.current?.dragging) pointer.current = null; };

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="ss-chips">
      <button className="ss-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="ss-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  const s = st.current, p = s?.p ?? null;
  const solvedN = mounted ? solvedCount(S) : 0, medalN = mounted ? medals(S) : 0, bank = mounted ? S.bank : 0;
  const nextUp = mounted ? nextPuzzle(S) : null, story = mounted && storyDone(S);
  const started = mounted && Object.keys(S.solved).length > 0;
  const where = !p ? '' : mode.current === 'daily' ? `DAILY SKY · ${today.current}` : mode.current === 'shoot' ? `SHOOTING STAR · SKY ${S.shoot.level}` : p.night === 0 ? `FIRST LESSONS · ${p.index + 1} OF ${TUTORIAL.length}` : `NIGHT ${p.night} · ${p.index + 1} OF 8`;
  const hintsLeft = (freeHint.current ? 1 : 0) + bank;
  const keys = <><kbd>←</kbd><kbd>→</kbd> choose a star · <kbd>Enter</kbd> stitch · <kbd>Z</kbd> unpick · <kbd>R</kbd> start again · <kbd>H</kbd> hint · <kbd>Esc</kbd> sky chart</>;

  return (
    <main className="ss-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} style={{ ['--pairw' as string]: `${pairW}px` }}>
      {screen === 'play' && p && (
        <header className="ss-bar">
          <button className="ss-back" onClick={() => (mode.current === 'story' ? toChart() : toMenu())}>← {mode.current === 'story' ? 'SKY CHART' : 'MENU'}</button>
          <span className="ss-bar-mid"><small>{where}</small> <b className="ss-name">{p.name}</b></span>
          <span className="ss-pill" title="Hints">✨ <b data-testid="hints">{hintsLeft}</b></span>
        </header>
      )}
      <div className="ss-stage" ref={stage}>
        <canvas ref={canvas} className="ss-canvas" tabIndex={0} data-testid="sky"
          aria-label="The night sky. Press on a star and drag along the seams to stitch the constellation."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onLeave} onContextMenu={(e) => e.preventDefault()} />

        {screen === 'play' && s && p && (<>
          <div className="ss-side" ref={side}>
            <p className="ss-count" data-testid="count"><b>{s.stitched}</b> / {s.total} stitched{s.clean && !s.done ? <span className="ss-clean" title="No unpicking yet: on course for the star medal">★ in one go</span> : null}</p>
            {p.rules.length > 0 && <ul className="ss-rules">{p.rules.map((r) => <li key={r}>{RULE_TIP[r]}</li>)}</ul>}
          </div>
          {!s.done && <p className="ss-hint" role="status">{!s.started ? (p.stars.some((q) => q.moon === 'start') ? 'Begin at the crescent moon: press it and drag along a seam.' : touch ? 'Touch a star and drag along a seam to start stitching.' : 'Press on a star and drag along a seam to start stitching.') : 'Drag on to the next star. Drag back along the thread to unpick.'}</p>}
          <div className="ss-tools" ref={tools} role="toolbar" aria-label="Stitching tools">
            <button className="ss-btn" onClick={() => { audio(); undo(); }} disabled={!s.started || s.done} aria-label="Unpick" title="Unpick the last stitch (Z)">↶<small>Unpick</small></button>
            <button className="ss-btn" onClick={restart} disabled={!s.started || s.done} aria-label="Start again" title="Unpick it all (R)">↺<small>Again</small></button>
            <button className="ss-btn ss-hintbtn" onClick={() => { audio(); askHint(); }} disabled={s.done || hintsLeft <= 0} aria-label="Hint" title="A gentle nudge (H)">✨<small>Hint{freeHint.current ? ' (free)' : ` (${bank})`}</small></button>
          </div>
        </>)}

        {tip && screen === 'play' && (
          <div className="ss-card" role="dialog" aria-label={tip.title}>
            <p className="ss-eyebrow">✦ SOMETHING NEW</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="ss-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
        {toast && screen === 'play' && <p className="ss-toast" role="status">{toast}</p>}

        {screen === 'play' && done && p && (
          <div className="ss-panel ss-done" role="dialog" aria-label="Constellation stitched">
            <p className="ss-eyebrow">{mode.current === 'daily' ? 'TODAY’S SKY, STITCHED' : mode.current === 'shoot' ? `SHOOTING STAR · SKY ${done.level}` : 'CONSTELLATION STITCHED'}</p>
            <h2>{p.name}</h2>
            {p.story[0] && <p className="ss-story">{p.story[0]}<br />{p.story[1]}</p>}
            <p className={'ss-medal' + (done.medal ? ' is-on' : '')}>{done.medal ? '★ Stitched in one go' : '☆ Stitch it without unpicking for the star'}</p>
            {done.earned && <p className="ss-earn">+1 ✨ hint, for stitching it without one</p>}
            {done.daily && <p className="ss-earn">🔥 {done.streak} night{done.streak === 1 ? '' : 's'} in a row</p>}
            {done.res?.nightDone && p.night >= 1 && p.night < 5 && <p className="ss-earn">🌙 Night {p.night} is complete: {NIGHTS[p.night + 1].name} opens.</p>}
            <div className="ss-row">
              <button className="ss-go" autoFocus onClick={nextAfter}>{mode.current === 'daily' ? 'Back to the menu' : mode.current === 'shoot' ? 'Next sky →' : p.id === FINALE && !S.ended ? 'The last page →' : 'Next →'}</button>
              {mode.current === 'story' && <button className="ss-alt" onClick={() => { audio().ui(); setScreen('journal'); setDone(null); st.current = null; }}>📖 Journal</button>}
              <button className="ss-alt" onClick={() => openPuzzle(p, mode.current)}>↺ Again</button>
            </div>
          </div>
        )}
      </div>
      {error && <div className="ss-panel ss-error"><h2>One moment…</h2><p>{error}</p></div>}

      {/* ---------------------------------------------------------------- the menu */}
      {screen === 'menu' && (
        <section className="ss-menu" aria-label="Starstitch">
          <header className="ss-head"><a href="/" className="ss-back">← ARCADE</a>{settings}</header>
          <div className="ss-hero">
            <Art src="/art/stars/title.webp" paint="title" w={1536} h={1024} className="ss-hero-art" />
            <div><p className="ss-eyebrow">A COSY CONSTELLATION PUZZLE</p><h1>Star<em>stitch</em></h1>
              <p className="ss-lede">The old stories say the constellations come loose every autumn. Dora and Enzo lie on the hill above the burrow with Grandmother’s spool of silver thread, and stitch them back into the sky: one thread, along every seam, never twice.</p></div>
          </div>
          <div className="ss-go-row">
            <button className="ss-go" disabled={!ready} onClick={() => { const n = nextPuzzle(save.current); if (n) openPuzzle(n); else { audio().ui(); setScreen('chart'); music('menu'); } }}>
              {!ready ? 'The stars are coming out…' : started ? 'CONTINUE →' : 'BEGIN →'}<small>{mounted ? (nextUp ? `${nextUp.night === 0 ? 'First Lessons' : `Night ${nextUp.night}`} · ${nextUp.name}` : 'every constellation is stitched') : ' '}</small>
            </button>
            <button className="ss-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('chart'); music('menu'); }}>🗺 Sky chart<small>{solvedN}/{STORY.length} · ★ {medalN}</small></button>
            <button className="ss-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('journal'); }}>📖 Night Journal<small>{solvedN} constellations</small></button>
            <button className="ss-alt" disabled={!ready || !story} onClick={openDaily}>🌙 Daily Sky<small>{!story ? 'after the last night' : S.daily.done.includes(today.current) ? `✓ done today · 🔥 ${S.daily.streak}` : 'a new sky every day'}</small></button>
            <button className="ss-alt" disabled={!ready || !story} onClick={openShoot}>☄ Shooting Star<small>{!story ? 'after the last night' : `sky ${S.shoot.level} · best ${S.shoot.best}`}</small></button>
            {mounted && S.ended && <button className="ss-alt" onClick={() => { audio().ui(); setEnding(true); music('ending'); }}>✨ The ending</button>}
          </div>
          <ol className="ss-how" aria-label="How to play">
            <li><b>✦ One thread.</b> Press on a star and drag from star to star along the faint seams. Every seam must be stitched exactly once.</li>
            <li><b>⟲ Odd stars.</b> A star with an odd number of seams is where the thread has to start or end. Leave no loop behind!</li>
            <li><b>↶ Unpick.</b> Drag back along the thread to undo. Stitch it without unpicking for the ★ star medal.</li>
            <li><b>☾ New rules.</b> Bright stars, knots, double seams, comets, clouds, twins and moons arrive one night at a time.</li>
          </ol>
          <p className="ss-keys">{keys}</p>
        </section>
      )}

      {/* ---------------------------------------------------------------- the sky chart */}
      {screen === 'chart' && (
        <section className="ss-menu ss-chart" aria-label="The sky chart">
          <header className="ss-head"><button className="ss-back" onClick={toMenu}>← MENU</button><b className="ss-total">✦ {solvedN}/{STORY.length} · ★ {medalN} · ✨ {bank}</b>{settings}</header>
          <nav className="ss-tabs" aria-label="Nights">
            {NIGHTS.map((n) => {
              const open = mounted && (n.n === 0 || nightOpen(S, n.n));
              return <button key={n.n} className={'ss-tab' + (night === n.n ? ' is-on' : '')} disabled={!open} aria-pressed={night === n.n} onClick={() => { audio().ui(); setNight(n.n); }}>{n.n === 0 ? 'Lessons' : `Night ${n.n}`}<small>{open ? `${n.n === 0 ? TUTORIAL.filter((q) => S.solved[q.id]).length : nightSolved(S, n.n)}/${nightPuzzles(n.n).length}` : '🔒'}</small></button>;
            })}
          </nav>
          <div className="ss-nighthead"><small>{night === 0 ? 'FIRST LESSONS' : `NIGHT ${night} OF 5`}</small><h2>{NIGHTS[night].name}</h2><p>{NIGHTS[night].blurb}</p></div>
          <div className="ss-grid">
            {nightPuzzles(night).map((q) => {
              const open = mounted && puzzleOpen(S, q.id), sol = mounted ? S.solved[q.id] : undefined;
              return (
                <button key={q.id} className={'ss-cell' + (sol ? ' is-done' : '') + (open && !sol ? ' is-next' : '')} disabled={!ready || !open} onClick={() => openPuzzle(q)} aria-label={q.name}>
                  <Thumb p={q} solved={!!sol} size={132} />
                  <b>{open ? q.name : '· · ·'}</b>
                  <small>{sol ? (sol.one ? '★ in one go' : '✓ stitched') : open ? q.rules.map((r) => RULE_NAME[r]).join(' · ') || 'stitch it' : '🔒'}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- the night journal */}
      {screen === 'journal' && (
        <section className="ss-menu ss-journal" aria-label="The Night Journal">
          <header className="ss-head"><button className="ss-back" onClick={toMenu}>← MENU</button><b className="ss-total">📖 {solvedN}/{STORY.length}</b>{settings}</header>
          <div className="ss-nighthead"><small>THE NIGHT JOURNAL</small><h2>Every constellation we stitched</h2><p>{story ? 'All forty, back where they belong.' : `Stitch all ${STORY.length} and they’ll shine together, all at once.`}</p></div>
          {story && <div className="ss-go-row"><button className="ss-go" onClick={() => { audio().ui(); setEnding(true); music('ending'); }}>✨ Read the last page</button></div>}
          {NIGHTS.filter((n) => n.n >= 1).map((n) => (
            <div key={n.n} className="ss-jnight">
              <h3>Night {n.n} · {n.name}</h3>
              <div className="ss-entries">
                {nightPuzzles(n.n).map((q) => {
                  const sol = mounted ? S.solved[q.id] : undefined;
                  return (
                    <article key={q.id} className={'ss-entry' + (sol ? ' is-done' : '')} aria-label={q.name}>
                      <Thumb p={q} solved={!!sol} size={110} />
                      <div><b>{sol ? q.name : '? ? ?'}</b>{sol ? <p>{q.story[0]} {q.story[1]}</p> : <p className="ss-dim">Not yet stitched.</p>}</div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {ending && (
        <div className="ss-ending" role="dialog" aria-label="The last page">
          <Art src="/art/stars/ending.webp" paint="ending" w={1536} h={1024} className="ss-ending-art" />
          <div className="ss-ending-text">
            <p className="ss-eyebrow">THE LAST PAGE OF THE NIGHT JOURNAL</p>
            <h2>All the constellations, shining together</h2>
            <p>One by one the stars stopped wobbling. The Hare, the Fox, the Heron and the Teapot, the little Snail, all of them stitched tight. And right over the burrow, brightest of all, two chinchillas, side by side.</p>
            <p>“Do you think Grandmother can see them?” said Dora. Enzo yawned, and smiled, and pointed. “She’s the one who taught them to shine.”</p>
            <div className="ss-row">
              <button className="ss-go" autoFocus onClick={() => { audio().ui(); setEnding(false); music('menu'); setScreen('menu'); }}>Goodnight ✨<small>the Daily Sky and Shooting Star are open</small></button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
