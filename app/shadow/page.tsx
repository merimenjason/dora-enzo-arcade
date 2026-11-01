'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SHAPES, SCENES, SCENE_IDS, STORIES, KS, ROT_STEPS, TURN_STEPS, MOVE_SLACK, MAX_SANDBOX, SAVE_KEY, Show, readSave, freshSave, recordScene, starsFor, snapPose,
  canDo, sceneOpen, storyOpen, storyDone, storyCount, sandboxOpen, nextScene, done, totalStars, starCount, lampHome, lampAt, shadowCentre,
  type Save, type SceneDef, type ShapeId, type Pose, type LampDef, type Op,
} from '@/lib/shadow-game';
import type { ShadowScene, Gesture } from '@/lib/shadow-scene';
import { ShadowSound, type SongId } from './sound';
import './shadow.css';

type Screen = 'menu' | 'stories' | 'play' | 'show';
type Result = { stars: [boolean, boolean, boolean]; newStars: number; moves: number; first: boolean; finale: boolean };
type Drag =
  | { k: 'prop'; i: number; du: number; dv: number; moved: boolean; sx: number; sy: number }
  | { k: 'rot'; i: number; a0: number; r0: number; cx: number; cy: number }
  | { k: 'depth'; i: number; moved: boolean; sx: number; sy: number }
  | { k: 'lamp'; i: number; x0: number; o0: number };
const sceneModule = () => import('@/lib/shadow-scene');
const FREE = 'sandbox';
const ALIVE_FOR = 2.6;
/** Phones on their side: the result card stands at the right (as in shadow.css), so the picture moves left of it. */
const SIDE_CARD = '(max-height:500px) and (min-aspect-ratio:1/1)';
const CAST: [string, string][] = [['Dora', 'puppeteer, lantern keeper'], ['Enzo', 'puppeteer, maker of very loud thunder'], ['The cat', 'who wanted the moon'], ['The whale', 'who sang'], ['The owl', 'on her branch'], ['The dragon', 'who was only small'], ['The woodland audience', 'who clapped for everything']];
const STORY_ICON = ['🐈', '⛵', '🏮', '🎨', '🐉'];
const sceneNo = (id: string) => { const S = SCENES[id]; return `${S.story + 1}-${S.n + 1}`; };
const SANDBOX_TOOLS: SceneDef['tools'] = ['move', 'rot', 'flip', 'depth', 'turn', 'take', 'lamp'];

/** A painting with a lantern-lit stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className }: { src: string; paint: 'title' | 'backdrop' | 'ending'; w: number; h: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (!dead && c) m.paintStandIn(c, paint); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'sp-art ' + (className ?? '')}>
      <canvas ref={cv} width={w / 4} height={h / 4} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {src && !hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A puppet drawn in the tray: leather and lace, or coloured glass. */
function PropIcon({ shape }: { shape: ShapeId }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((m) => { if (!dead && cv.current) m.drawPropIcon(cv.current, shape); }).catch(() => {}); return () => { dead = true; }; }, [shape]);
  return <canvas ref={cv} width={96} height={96} aria-hidden="true" />;
}
const Lanterns = ({ stars, big = false }: { stars: [boolean, boolean, boolean] | number; big?: boolean }) => {
  const on = typeof stars === 'number' ? [!!(stars & 1), !!(stars & 2), !!(stars & 4)] : stars;
  return <span className={'sp-stars' + (big ? ' is-big' : '')} aria-label={`${on.filter(Boolean).length} of 3 stars`}>{on.map((x, i) => <i key={i} className={x ? 'is-on' : ''}>★</i>)}</span>;
};

/** The free stage as a scene: whatever puppets are hung, one warm lantern or the gold and blue pair. */
function freeScene(props: { shape: ShapeId; pose: Pose }[], two: boolean): SceneDef {
  const lamps: LampDef[] = two ? [{ x: 6, y: 4.5, tone: 'gold', move: [-16, 16] }, { x: 10, y: 4.5, tone: 'blue', move: [-16, 16] }] : [{ x: 8, y: 4.5, tone: 'warm', move: [-24, 24] }];
  return {
    id: FREE, story: -1, n: 0, name: 'The Free Stage', line: 'Hang any puppets you like and make your own picture.', after: '',
    props: props.map((p) => ({ shape: p.shape, start: p.pose, sol: p.pose })), lamps, tools: SANDBOX_TOOLS, par: 0, flourish: { k: 'perfect', min: 2, text: '' }, alive: [],
  };
}

export default function ShadowPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), tools = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null), lineEl = useRef<HTMLDivElement>(null), resultEl = useRef<HTMLDivElement>(null);
  const scene = useRef<ShadowScene | null>(null), sound = useRef<ShadowSound | null>(null);
  const save = useRef<Save>(freshSave());
  const show = useRef<Show | null>(null), sel = useRef(-1), drag = useRef<Drag | null>(null), ptr = useRef<number | null>(null);
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), panelRef = useRef(false);
  const aliveAt = useRef(-1), now = useRef(0), snapAt = useRef(-1), snapProp = useRef(-1), hintRef = useRef<{ i: number; pose: Pose } | { lamp: number; x: number } | null>(null), hintAt = useRef(-1);
  const startedAt = useRef(0), lastFit = useRef(0), gestures = useRef<{ dora: Gesture; enzo: Gesture; until: number }>({ dora: 'idle', enzo: 'idle', until: 0 });
  const toastTimer = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [result, setResult] = useState<Result | null>(null), [toast, setToast] = useState(''), [tip, setTip] = useState<{ title: string; text: string } | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide'), [tray, setTray] = useState(false);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new ShadowSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3200) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const isFree = () => show.current?.scene.id === FREE;
  const gesture = (dora: Gesture, enzo: Gesture, secs: number) => { gestures.current = { dora, enzo, until: now.current + secs }; };
  const busy = () => screenRef.current !== 'play' || !show.current || pausedRef.current || panelRef.current || aliveAt.current >= 0;

  // ---------------------------------------------------------------- opening scenes
  function open(id: string) {
    const s = save.current;
    if (id === FREE) { if (!sandboxOpen(s)) return; }
    else if (!sceneOpen(s, id)) return;
    audio().ui();
    show.current = id === FREE ? new Show(freeScene(s.sandbox.props, s.sandbox.two), null, s.sandbox.offs.slice(0, s.sandbox.two ? 2 : 1)) : new Show(SCENES[id]);
    sel.current = -1; drag.current = null; aliveAt.current = -1; hintRef.current = null; snapAt.current = -1; lastFit.current = 0;
    pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; setToast(''); setTray(false);
    const Sc = show.current.scene;
    setTip(Sc.tip && !done(s, id) ? Sc.tip : null);
    startedAt.current = now.current; gesture('talk', 'idle', 3.2);
    sound.current?.music(id === FREE ? 'free' : (`story${Sc.story + 1}` as SongId));
    setScreen('play'); refresh();
    requestAnimationFrame(() => { layout(); canvas.current?.focus(); });
  }
  function toMenu(to: Screen = 'menu') {
    keepFree();
    show.current = null; sel.current = -1; drag.current = null; aliveAt.current = -1; pausedRef.current = false; setPaused(false); setResult(null); panelRef.current = false; setTip(null); setToast(''); setTray(false);
    scene.current?.stopReel();
    setScreen(to); sound.current?.music('menu'); refresh();
  }
  function pause(on: boolean) {
    if (screenRef.current !== 'play' || panelRef.current || on === pausedRef.current) return;
    pausedRef.current = on; setPaused(on); drag.current = null;
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }
  /** Keeps the free stage in the save as it is made. */
  function keepFree() {
    const sh = show.current; if (!sh || sh.scene.id !== FREE) return;
    save.current.sandbox = { props: sh.stage.props.map((p) => ({ shape: p.shape, pose: { ...p.pose } })), two: sh.stage.lamps.length > 1, offs: [sh.offs[0] ?? 0, sh.offs[1] ?? 0] };
    persist();
  }

  // ---------------------------------------------------------------- changing the picture
  /** Applies one change and listens for the picture coming together. */
  function act(op: Op, quiet = false) {
    const sh = show.current; if (!sh || aliveAt.current >= 0) return false;
    if (!sh.apply(op)) return false;
    if (!quiet) {
      const a = audio();
      if (op.k === 'on') a.take(op.on); else if (op.k === 'lamp') a.lamp(); else if (op.k === 'move') { /* drags are quiet */ } else a.tick(op.k === 'depth' ? 0.8 : 1.1);
    }
    hintRef.current = null;
    afterChange();
    return true;
  }
  function afterChange() {
    const sh = show.current; if (!sh) return;
    if (isFree()) { keepFree(); refresh(); return; }
    const f = sh.fit();
    if (f.fit > lastFit.current + 0.04 && f.fit >= 0.7 && !f.matched) { sound.current?.near(f.fit); if (f.fit > 0.85) gesture('idle', 'point', 1.5); }
    lastFit.current = f.fit;
    if (f.matched && !drag.current) comeAlive();
    refresh();
  }
  /** The picture is cast: everything glides into place, the scene comes alive, and the stars are counted. */
  function comeAlive() {
    const sh = show.current; if (!sh || aliveAt.current >= 0 || isFree()) return;
    const Sc = sh.scene, stars = starsFor(Sc, sh.stage, sh.moves);
    aliveAt.current = now.current; sel.current = -1; drag.current = null; setTip(null);
    audio().cast();
    const r = recordScene(save.current, Sc.id, stars, sh.moves);
    if (Sc.id === 's1-1') save.current.tutorial = true;
    persist();
    window.setTimeout(() => {
      if (show.current !== sh) return;
      panelRef.current = true;
      setResult({ stars, newStars: r.newStars, moves: sh.moves, first: r.first, finale: r.finale });
      sound.current?.stars(stars.filter(Boolean).length);
      refresh();
    }, ALIVE_FOR * 1000);
    refresh();
  }
  function undo() { const sh = show.current; if (!sh || busy() || !sh.undo()) return; audio().undo(); hintRef.current = null; afterChange(); }
  function reset() {
    const sh = show.current; if (!sh || busy()) return;
    if (isFree()) { if (!sh.stage.props.length || !window.confirm('Take every puppet off the free stage?')) return; show.current = new Show(freeScene([], sh.stage.lamps.length > 1)); sel.current = -1; keepFree(); audio().undo(); refresh(); return; }
    if (!sh.moves) return;
    sh.reset(); sel.current = -1; hintRef.current = null; audio().undo(); lastFit.current = 0; refresh();
  }
  function hint() {
    const sh = show.current; if (!sh || busy() || isFree()) return;
    const h = sh.hint(); if (!h) return;
    audio().hint(); hintAt.current = now.current;
    if (h.k === 'lamp') { hintRef.current = { lamp: h.i, x: h.x }; showToast('Slide the lantern to the glowing mark below the screen.'); }
    else {
      hintRef.current = { i: h.i, pose: h.pose }; sel.current = h.pose.on ? h.i : h.i;
      const P = sh.scene.props[h.i], name = SHAPES[P.shape].name.toLowerCase(), cur = sh.poses[h.i], want = h.pose;
      const bits: string[] = [];
      if (!want.on) bits.push('take it off the rods (🪝)');
      else {
        if (!cur.on) bits.push('put it back on the rods');
        if (want.d !== cur.d) bits.push(want.d > cur.d ? 'slide it nearer the lantern (＋)' : 'slide it nearer the screen (−)');
        if (want.f !== cur.f && !SHAPES[P.shape].round) bits.push('flip it (⇋)');
        if (want.t !== cur.t) bits.push(want.t > cur.t ? 'turn it edge-on (◐)' : 'turn it face-on (◑)');
        if (want.r !== cur.r && !SHAPES[P.shape].round) bits.push('rotate it');
        bits.push('move it into the glowing outline');
      }
      showToast(`The ${name}: ${bits.join(', ')}.`, 5200);
    }
    gesture('point', 'think', 2.4); refresh();
  }
  // tools for the chosen puppet
  const selP = () => { const sh = show.current, i = sel.current; return sh && i >= 0 && sh.stage.props[i]?.pose.on ? sh.stage.props[i].pose : null; };
  const can = (t: SceneDef['tools'][number]) => { const sh = show.current, i = sel.current; return !!sh && i >= 0 && canDo(sh.scene, i, t) && (t === 'take' || !!selP()); };
  function rotate(dir: number) { const p = selP(); if (p && can('rot')) act({ k: 'rot', i: sel.current, r: p.r + dir }); }
  function flip() { if (selP() && can('flip')) act({ k: 'flip', i: sel.current }); }
  function depth(dir: number) { const p = selP(); if (p && can('depth')) { if (!act({ k: 'depth', i: sel.current, d: p.d + dir })) audio().nope(); } }
  function turn(dir: number) { const p = selP(); if (p && can('turn')) { const t = p.t + dir; act({ k: 'turn', i: sel.current, t: t > TURN_STEPS ? 0 : t < 0 ? TURN_STEPS : t }); } }
  function takeDown() {
    const sh = show.current, i = sel.current; if (!sh || i < 0 || busy()) return;
    if (isFree()) { removeFree(i); return; }
    if (!can('take')) return;
    if (act({ k: 'on', i, on: false })) { sel.current = -1; refresh(); }
  }
  function putBack(i: number) { if (act({ k: 'on', i, on: true })) { sel.current = i; refresh(); } }
  function lampBy(dir: number) {
    const sh = show.current; if (!sh || busy()) return;
    const li = sh.scene.lamps.findIndex((L) => L.move); if (li < 0 || !sh.scene.tools.includes('lamp')) return;
    act({ k: 'lamp', i: li, x: sh.offs[li] + dir });
  }
  function cycle(dir: number) {
    const sh = show.current; if (!sh) return;
    const ids = sh.stage.props.map((p, i) => i).filter((i) => sh.stage.props[i].pose.on && !sh.scene.props[i].fixed);
    if (!ids.length) return;
    const k = ids.indexOf(sel.current), next = ids[(k + dir + ids.length * 2) % ids.length] ?? ids[0];
    sel.current = k < 0 ? ids[dir > 0 ? 0 : ids.length - 1] : next; audio().pick(); refresh();
  }
  // the free stage
  function addFree(shape: ShapeId) {
    const sh = show.current; if (!sh || !isFree()) return;
    if (sh.stage.props.length >= MAX_SANDBOX) { showToast(`The free stage holds ${MAX_SANDBOX} puppets.`); return; }
    const n = sh.stage.props.length, pose: Pose = { x: Math.round((4 + (n % 5) * 2) * 8), y: Math.round((3 + (n % 3) * 1.6) * 8), d: 1, r: 0, f: 0, t: 0, on: true };
    const props = [...sh.stage.props.map((p) => ({ shape: p.shape, pose: { ...p.pose } })), { shape, pose }];
    show.current = new Show(freeScene(props, sh.stage.lamps.length > 1), props.map((p) => p.pose), sh.offs);
    sel.current = n; keepFree(); audio().pick(); setTray(false); refresh();
  }
  function removeFree(i: number) {
    const sh = show.current; if (!sh || !isFree()) return;
    const props = sh.stage.props.filter((_, j) => j !== i).map((p) => ({ shape: p.shape, pose: { ...p.pose } }));
    show.current = new Show(freeScene(props, sh.stage.lamps.length > 1), props.map((p) => p.pose), sh.offs);
    sel.current = -1; keepFree(); audio().take(false); refresh();
  }
  function toggleTwo() {
    const sh = show.current; if (!sh || !isFree()) return;
    const props = sh.stage.props.map((p) => ({ shape: p.shape, pose: { ...p.pose } })), two = sh.stage.lamps.length === 1;
    show.current = new Show(freeScene(props, two), props.map((p) => p.pose), [0, 0]);
    keepFree(); audio().lamp(); refresh();
  }

  // ---------------------------------------------------------------- the final performance
  function playShow() {
    audio().ui(); setEnding(false);
    show.current = null; sel.current = -1; setResult(null); panelRef.current = false;
    scene.current?.startReel(STORIES.map((st) => SCENES[st.scenes[st.scenes.length - 1]]));
    sound.current?.music('ending'); setScreen('show'); refresh();
    requestAnimationFrame(() => layout());
  }

  /** The stage's clear area, so the theatre sits between the bar and the toolbar. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setOrient(r.width >= r.height ? 'wide' : 'tall');
    if (!sc) return;
    sc.resize();
    const t = tools.current?.getBoundingClientRect(), b = lineEl.current?.getBoundingClientRect() ?? bar.current?.getBoundingClientRect();
    // the toolbar sits below the theatre, or (on a phone held sideways) stands at its right
    const side = !!t && t.height > t.width;
    sc.inset = {
      top: b && b.height > 0 ? Math.max(6, b.bottom - r.top + 2) : 8, left: 6,
      right: side && t ? Math.max(6, r.right - t.left + 4) : 6,
      bottom: !side && t && t.height > 0 ? Math.max(6, r.bottom - t.top + 6) : 8,
    };
    // while the result card shows, the living picture alone (no board) fills the room beside the card: above it, or (on
    // a phone on its side) to its left. Measured from the card's place, not its rising animation.
    const card = resultEl.current, shell = card?.offsetParent?.getBoundingClientRect();
    sc.picture = !!card && !!shell;
    if (card && shell) {
      const top = shell.top + card.offsetTop, left = shell.left + card.offsetLeft;
      if (window.matchMedia?.(SIDE_CARD).matches) sc.inset.right = Math.max(6, r.right - left + 6);
      else sc.inset.bottom = Math.max(6, r.bottom - top + 6);
    }
    sc.layout();
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse);
    setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__shadow = () => {
      const sh = show.current;
      return { screen: screenRef.current, scene: sh?.scene.id ?? null, moves: sh?.moves ?? 0, fit: sh ? sh.fit() : null, poses: sh?.poses ?? null, offs: sh?.offs ?? null, selected: sel.current, alive: aliveAt.current >= 0, paused: pausedRef.current, save: save.current };
    };
    w.__shadowOpen = (id: string) => open(id);
    /** Client coordinates of a point on the paper (in screen units), or of a depth notch on the board. */
    w.__shadowPoint = (u: number, v: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(); return [b.left + sc.sx(u), b.top + sc.sy(v)]; };
    w.__shadowShadow = (i: number) => {
      const sh = show.current; if (!sh) return null;
      const p = sh.stage.props[i]?.pose; if (!p) return null;
      const home = lampHome(sh.stage), c = shadowCentre(home, lampAt(sh.stage.lamps[0], sh.offs[0] ?? 0), p);
      return (w.__shadowPoint as (u: number, v: number) => number[])(c[0], c[1]);
    };
    w.__shadowHandle = () => { const sc = scene.current, cv = canvas.current, sh = show.current; if (!sc || !cv || !sh) return null; const h = sc.rotHandle(sh.stage, sel.current); if (!h) return null; const b = cv.getBoundingClientRect(); return [b.left + h[0], b.top + h[1]]; };
    w.__shadowLayout = () => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(); const L = sc.lay; return { screen: { x: b.left + L.screen.x, y: b.top + L.screen.y, w: L.screen.w, h: L.screen.h }, board: { x: b.left + L.board.x, y: b.top + L.board.y, w: L.board.w, h: L.board.h }, s: L.s, tall: L.tall }; };
    /** Follows every hint: casts the scene (for tests and screenshots). */
    w.__shadowCast = () => {
      const sh = show.current; if (!sh) return false;
      for (let n = 0; n < 30; n++) {
        const h = sh.hint(); if (!h) break;
        if (h.k === 'lamp') { sh.apply({ k: 'lamp', i: h.i, x: h.x }); continue; }
        const cur = sh.poses[h.i], to = h.pose;
        if (!to.on) { sh.apply({ k: 'on', i: h.i, on: false }); continue; }
        if (!cur.on) sh.apply({ k: 'on', i: h.i, on: true });
        sh.apply({ k: 'depth', i: h.i, d: to.d }); sh.apply({ k: 'rot', i: h.i, r: to.r });
        if (sh.poses[h.i].f !== to.f) sh.apply({ k: 'flip', i: h.i });
        sh.apply({ k: 'turn', i: h.i, t: to.t }); sh.apply({ k: 'move', i: h.i, x: to.x, y: to.y });
      }
      afterChange(); return sh.matched;
    };
    w.__shadowShow = () => playShow();
    let dead = false, raf = 0, last = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.ShadowScene(canvas.current); } catch { setError('This browser cannot light the theatre.'); return; }
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const frozen = pausedRef.current;
        if (!frozen) now.current += dt;
        const sc = scene.current!, sh = show.current, playing = screenRef.current === 'play' && !!sh;
        if (screenRef.current === 'show') {
          sc.tickReel(frozen ? 0 : dt);
          if (sc.reelCall() >= 0 && sc.reelCall() < 0.1) sound.current?.applause();
          if (sc.reelDone() && !panelRef.current) { panelRef.current = true; setEnding(true); refresh(); }
        }
        const g = gestures.current, gNow = now.current < g.until;
        const aliveT = aliveAt.current >= 0 ? now.current - aliveAt.current : -1;
        const f = playing && !isFree() ? sh!.fit().fit : 0;
        const guide = playing && sh!.scene.id === 's1-1' && !save.current.tutorial && sel.current < 0 && sh!.moves === 0 && aliveT < 0 && !pausedRef.current ? (() => {
          const i = sh!.scene.props.findIndex((P) => !P.fixed && !P.extra), P = sh!.scene.props[i];
          return { from: [P.start.x / 8, P.start.y / 8] as [number, number], to: [P.sol!.x / 8, P.sol!.y / 8] as [number, number] };
        })() : null;
        if (hintRef.current && now.current - hintAt.current > 6) hintRef.current = null;
        sc.draw({
          dt: frozen ? 0 : dt, stage: playing ? sh!.stage : null, scene: playing ? sh!.scene : null, selected: sel.current, ghost: playing && !isFree(), hint: hintRef.current,
          fit: f, guide, dora: gNow ? g.dora : 'idle', enzo: gNow ? g.enzo : 'idle', alive: aliveT, snapAt: snapAt.current >= 0 ? now.current - snapAt.current : -1, snapProp: snapProp.current,
          amb: playing ? sh!.scene.amb ?? null : null, board: playing,
        });
        sound.current?.tickMusic(!pausedRef.current);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The theatre could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tgt = e.target as HTMLElement;
      if (screenRef.current === 'show' && k === 'escape') { e.preventDefault(); scene.current?.stopReel(); panelRef.current = true; setEnding(true); refresh(); return; }
      if (screenRef.current !== 'play' || !show.current || panelRef.current) return;
      if (k === 'escape' || k === 'p') {
        if (e.repeat) return;
        e.preventDefault();
        if (drag.current) { drag.current = null; refresh(); return; }
        if (sel.current >= 0 && k === 'escape') { sel.current = -1; refresh(); return; }
        pause(!pausedRef.current); return;
      }
      if (pausedRef.current || aliveAt.current >= 0) return;
      if (tgt.closest?.('button, a') && (k === 'enter' || k === ' ')) return;
      const p = selP(), step = e.shiftKey ? 8 : 1;
      const arrow: Record<string, [number, number]> = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
      if (arrow[k]) {
        e.preventDefault();
        if (p && can('move')) { const [dx, dy] = arrow[k]; act({ k: 'move', i: sel.current, x: p.x + dx, y: p.y + dy }, true); }
        else cycle(k === 'arrowleft' || k === 'arrowup' ? -1 : 1);
        return;
      }
      if (k === 'tab') { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); }
      else if (k === 'q') { e.preventDefault(); rotate(-1); }
      else if (k === 'e') { e.preventDefault(); rotate(1); }
      else if (k === 'f') { e.preventDefault(); flip(); }
      else if (k === 't') { e.preventDefault(); turn(e.shiftKey ? -1 : 1); }
      else if (k === '+' || k === '=' || k === 'w') { e.preventDefault(); depth(1); }
      else if (k === '-' || k === '_' || k === 's') { e.preventDefault(); depth(-1); }
      else if (k === '[') { e.preventDefault(); lampBy(-1); }
      else if (k === ']') { e.preventDefault(); lampBy(1); }
      else if (k === 'delete' || k === 'backspace' || k === 'x') { e.preventDefault(); takeDown(); }
      else if (k === 'z' || k === 'u') { e.preventDefault(); undo(); }
      else if (k === 'r') { e.preventDefault(); reset(); }
      else if (k === 'h') { e.preventDefault(); hint(); }
    };
    const blur = () => { pause(true); sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect(); window.clearTimeout(toastTimer.current);
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, orient, result, touch, tray]);

  /** Lets go of a puppet: it clicks into place when it is close and held the right way. */
  function snapP() {
    const sh = show.current, i = sel.current; if (!sh || i < 0 || isFree()) return false;
    const p = sh.poses[i], to = snapPose(sh.scene, i, p);
    if (!to) return false;
    act({ k: 'move', i, x: to.x, y: to.y }, true);
    snapAt.current = now.current; snapProp.current = i; sound.current?.snap();
    return true;
  }

  // ---------------------------------------------------------------- the pointer: drag shadows, the turning handle, the rods and the lanterns
  const local = (e: React.PointerEvent | React.WheelEvent): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onDown = (e: React.PointerEvent) => {
    if (busy() || ptr.current !== null) return;
    audio();
    const sh = show.current!, sc = scene.current; if (!sc) return;
    if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    const [x, y] = local(e);
    const begin = (d: Drag) => { drag.current = d; ptr.current = e.pointerId; sh.hold(); try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ } };
    // the turning handle of the chosen puppet
    const h = sel.current >= 0 && canDo(sh.scene, sel.current, 'rot') ? sc.rotHandle(sh.stage, sel.current) : null;
    if (h && Math.hypot(x - h[0], y - h[1]) < (e.pointerType === 'mouse' ? 16 : 24)) {
      const p = sh.poses[sel.current], [u, v] = [p.x / 8, p.y / 8], cx = sc.sx(u), cy = sc.sy(v);
      begin({ k: 'rot', i: sel.current, a0: Math.atan2(y - cy, x - cx), r0: p.r, cx, cy }); audio().pick(); refresh(); return;
    }
    // the board below the screen
    const g = sc.hitBoard(sh.stage, sh.scene, x, y, sh.scene.tools.includes('lamp'));
    if (g?.k === 'lamp') { begin({ k: 'lamp', i: g.i, x0: x, o0: sh.offs[g.i] }); audio().lamp(); return; }
    if (g?.k === 'prop') { sel.current = g.i; begin({ k: 'depth', i: g.i, moved: false, sx: x, sy: y }); audio().pick(); refresh(); return; }
    // a shadow on the paper
    if (sc.inScreen(x, y)) {
      const i = sc.hitProp(sh.stage, x, y, sel.current, sh.scene);
      if (i >= 0) {
        sel.current = i;
        const p = sh.poses[i], [u, v] = sc.toUnits(x, y);
        begin({ k: 'prop', i, du: p.x / 8 - u, dv: p.y / 8 - v, moved: false, sx: x, sy: y }); audio().pick(); refresh(); return;
      }
      if (sel.current >= 0) { sel.current = -1; refresh(); }
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, sh = show.current, sc = scene.current;
    if (!d || !sh || !sc || e.pointerId !== ptr.current) return;
    const [x, y] = local(e);
    if (d.k === 'prop') {
      if (!d.moved && Math.hypot(x - d.sx, y - d.sy) < (e.pointerType === 'mouse' ? 3 : 6)) return;
      d.moved = true;
      const [u, v] = sc.toUnits(x, y);
      if (canDo(sh.scene, d.i, 'move')) act({ k: 'move', i: d.i, x: Math.round((u + d.du) * 8), y: Math.round((v + d.dv) * 8) }, true);
    } else if (d.k === 'rot') {
      const a = Math.atan2(y - d.cy, x - d.cx), steps = Math.round(((a - d.a0) / (Math.PI * 2)) * ROT_STEPS);
      const r = (((d.r0 + steps) % ROT_STEPS) + ROT_STEPS) % ROT_STEPS;
      if (r !== sh.poses[d.i].r) act({ k: 'rot', i: d.i, r });
    } else if (d.k === 'depth') {
      if (!d.moved && Math.abs(y - d.sy) < 6) return;
      d.moved = true;
      const n = sc.notchAt(y);
      if (n !== sh.poses[d.i].d && canDo(sh.scene, d.i, 'depth')) act({ k: 'depth', i: d.i, d: n });
    } else if (d.k === 'lamp') {
      const o = d.o0 + Math.round(((x - d.x0) / sc.lay.s) * 4);
      if (o !== sh.offs[d.i]) act({ k: 'lamp', i: d.i, x: o });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== ptr.current) return;
    const d = drag.current, sh = show.current; drag.current = null; ptr.current = null;
    sh?.release();
    if (!d || !sh) return;
    if (d.k === 'prop' && d.moved) { if (!snapP()) audio().drop(); }
    afterChange();
  };
  const onWheel = (e: React.WheelEvent) => {
    if (busy() || sel.current < 0) return;
    depth((e.deltaY || e.deltaX) < 0 ? 1 : -1);
  };
  useEffect(() => {
    // React's wheel listener is passive; this one stops the page from scrolling
    const cv = canvas.current; if (!cv) return;
    const stopIt = (e: WheelEvent) => { if (screenRef.current === 'play') e.preventDefault(); };
    cv.addEventListener('wheel', stopIt, { passive: false });
    return () => cv.removeEventListener('wheel', stopIt);
  }, []);

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="sp-chips">
      <button className="sp-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="sp-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  const sh = show.current, Sc = sh?.scene ?? null, free = Sc?.id === FREE;
  const fit = sh && !free ? sh.fit() : null, sp = selP(), si = sel.current;
  const selName = sh && si >= 0 && sh.stage.props[si] ? SHAPES[sh.stage.props[si].shape].name : '';
  const offRods = sh && Sc && !free ? sh.stage.props.map((p, i) => i).filter((i) => !sh.stage.props[i].pose.on && Sc.props[i].sol && canDo(Sc, i, 'take')) : [];
  const lampMovable = !!Sc && Sc.tools.includes('lamp') && Sc.lamps.some((L) => L.move);
  const keysLine = <>drag a shadow to move it · drag ⟳ to rotate · <kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>F</kbd> flip · <kbd>T</kbd> turn · wheel or <kbd>+</kbd>/<kbd>−</kbd> nearer or further · <kbd>[</kbd> <kbd>]</kbd> lantern · arrows nudge · <kbd>Tab</kbd> next puppet · <kbd>X</kbd> take down · <kbd>Z</kbd> undo · <kbd>R</kbd> reset · <kbd>H</kbd> hint · <kbd>Esc</kbd> pause</>;
  const nextId = mounted ? nextScene(S) : null;
  const startedAny = mounted && SCENE_IDS.some((id) => done(S, id));
  const totalMax = SCENE_IDS.length * 3;
  const nextAfter = (id: string) => { const i = SCENE_IDS.indexOf(id); return i >= 0 && i + 1 < SCENE_IDS.length ? SCENE_IDS[i + 1] : null; };
  const meter = fit ? Math.round(fit.fit * 100) : 0;
  const aliveNow = aliveAt.current >= 0;

  return (
    <main className="sp-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-story={Sc ? Sc.story + 1 : undefined} data-result={screen === 'play' && result ? 'true' : undefined}>
      {screen === 'play' && sh && Sc && (
        <header className="sp-bar" ref={bar}>
          <button className="sp-back" onClick={() => toMenu(free ? 'menu' : 'stories')}>← {free ? 'MENU' : 'STORIES'}</button>
          <span className="sp-bar-mid">
            <b className="sp-name"><small>{free ? 'FREE STAGE' : sceneNo(Sc.id)}</small> {Sc.name}</b>
            {!free && <span className={'sp-moves' + (sh.moves > Sc.par + MOVE_SLACK ? ' is-over' : '')} data-testid="moves" title={`Moves: every time you pick up a different puppet or lantern. Within ${Sc.par + MOVE_SLACK} earns the second star.`}>✋ <b>{sh.moves}</b><small> / {Sc.par + MOVE_SLACK}</small></span>}
            {!free && <span className={'sp-meter' + (fit?.matched ? ' is-full' : '')} title="How well the shadows fit the picture" data-testid="meter"><i style={{ width: `${meter}%` }} /><b>{meter}%</b></span>}
          </span>
          <button className="sp-chip sp-pause" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!!result}>❚❚</button>
        </header>
      )}
      <div className="sp-stage" ref={stage}>
        <canvas ref={canvas} className="sp-canvas" tabIndex={0} data-testid="theatre"
          aria-label="The shadow theatre. Drag a shadow on the paper to move its puppet; drag a rod on the board below to slide it nearer or further from the lantern."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && sh && Sc && (
          <div className={'sp-line' + (aliveNow ? ' is-after' : '')} ref={lineEl} role="status">
            <span><b>{free ? '🎭' : STORY_ICON[Sc.story]}</b> {aliveNow && !free ? Sc.after : Sc.line}</span>
            {!free && Sc.flourish.text && <small>★ {Sc.flourish.text}</small>}
          </div>
        )}
        {screen === 'play' && sh && Sc && (
          <div className="sp-tools" ref={tools} role="toolbar" aria-label="Puppet tools">
            <span className="sp-sel">{sp ? <><small>HOLDING</small><b>{selName}</b></> : <small>{free ? 'tap ＋ to hang a puppet' : touch ? 'touch a shadow to pick it up' : 'click a shadow to pick it up'}</small>}</span>
            <span className="sp-btns">
              {Sc.tools.includes('rot') && <><button className="sp-btn" onClick={() => rotate(-1)} disabled={!can('rot')} aria-label="Rotate left" title="Rotate left (Q)">⟲</button>
                <button className="sp-btn" onClick={() => rotate(1)} disabled={!can('rot')} aria-label="Rotate right" title="Rotate right (E)">⟳</button></>}
              {Sc.tools.includes('flip') && <button className="sp-btn" onClick={flip} disabled={!can('flip')} aria-label="Flip" title="Flip over (F)">⇋</button>}
              {Sc.tools.includes('depth') && <><button className="sp-btn" onClick={() => depth(-1)} disabled={!can('depth') || !sp || sp.d <= 0} aria-label="Nearer the screen" title="Nearer the screen: smaller and sharper (−)">−</button>
                <span className="sp-depth" aria-label="Distance from the screen">{sp && can('depth') ? KS.map((_, d) => <i key={d} className={d === sp.d ? 'is-on' : ''} />) : <small>depth</small>}</span>
                <button className="sp-btn" onClick={() => depth(1)} disabled={!can('depth') || !sp || sp.d >= KS.length - 1} aria-label="Nearer the lantern" title="Nearer the lantern: bigger and softer (+)">＋</button></>}
              {Sc.tools.includes('turn') && <button className="sp-btn" onClick={() => turn(1)} disabled={!can('turn')} aria-label="Turn edge-on" title="Turn it on its stick, towards edge-on (T)">◐</button>}
              {(Sc.tools.includes('take') || free) && <button className="sp-btn" onClick={takeDown} disabled={si < 0 || (!free && !can('take'))} aria-label={free ? 'Remove the puppet' : 'Take the puppet off the rods'} title={free ? 'Remove it (X)' : 'Take it off the rods: not every puppet belongs in the picture (X)'}>🪝</button>}
              {lampMovable && <><button className="sp-btn" onClick={() => lampBy(-1)} aria-label="Lantern left" title="Slide the lantern left ([)">◀🏮</button><button className="sp-btn" onClick={() => lampBy(1)} aria-label="Lantern right" title="Slide the lantern right (])">🏮▶</button></>}
              {free && <><button className={'sp-btn' + (tray ? ' is-on' : '')} onClick={() => { setTray(!tray); audio().ui(); }} aria-label="Add a puppet" aria-pressed={tray} title="Hang a puppet">＋</button>
                <button className={'sp-btn' + (sh.stage.lamps.length > 1 ? ' is-on' : '')} onClick={toggleTwo} aria-pressed={sh.stage.lamps.length > 1} aria-label="Two lanterns" title="One warm lantern, or the gold and blue pair">🎨</button></>}
              <button className="sp-btn" onClick={undo} disabled={!sh.canUndo} aria-label="Undo" title="Undo (Z)">↶</button>
              <button className="sp-btn" onClick={reset} disabled={free ? !sh.stage.props.length : !sh.moves} aria-label={free ? 'Clear the stage' : 'Start the scene again'} title={free ? 'Clear the stage' : 'Start again (R)'}>{free ? '🗑' : '⟲'}</button>
              {!free && <button className="sp-btn sp-hint" onClick={hint} aria-label="Hint" title="A hint (H)">💡</button>}
            </span>
            {offRods.length > 0 && <span className="sp-off">{offRods.map((i) => <button key={i} className="sp-chip" onClick={() => putBack(i)} title="Put it back on the rods">🪝 {SHAPES[sh.stage.props[i].shape].name}</button>)}</span>}
          </div>
        )}
        {tray && free && sh && (
          <div className="sp-tray" role="dialog" aria-label="Hang a puppet">
            <p className="sp-eyebrow">THE PUPPET BOX · {sh.stage.props.length} / {MAX_SANDBOX}</p>
            <div className="sp-tray-grid">
              {(Object.keys(SHAPES) as ShapeId[]).map((id) => <button key={id} className="sp-prop" onClick={() => addFree(id)} title={SHAPES[id].blurb} aria-label={SHAPES[id].name}><PropIcon shape={id} /><small>{SHAPES[id].name}</small></button>)}
            </div>
          </div>
        )}
        {toast && <p className="sp-toast" role="status">{toast}</p>}
        {tip && screen === 'play' && !result && (
          <div className="sp-card" role="dialog" aria-label={tip.title}>
            <p className="sp-eyebrow">💡 A NEW TRICK</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="sp-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
        {screen === 'play' && Sc?.id === 's1-1' && !S.tutorial && !tip && !aliveNow && sh && sh.moves === 0 && (
          <div className="sp-guide" role="status"><b>The first scene</b><span>{touch ? 'Touch the round shadow and drag it up into the glowing outline.' : 'Drag the round shadow up into the glowing dotted outline.'}</span></div>
        )}
      </div>
      {error && <div className="sp-panel sp-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="sp-menu" aria-label="Shadowplay">
          <header className="sp-head"><a href="/" className="sp-back">← ARCADE</a>{settings}</header>
          <div className="sp-hero">
            <Art src="/art/shadow/title.webp" paint="title" w={1536} h={1024} className="sp-hero-art" />
            <div><p className="sp-eyebrow">A SHADOW-PUPPET THEATRE PUZZLE</p><h1>Shadow<em>play</em></h1>
              <p className="sp-lede">Dora and Enzo’s little travelling theatre tells its stories in shadow. Hang the puppets between the lantern and the paper screen, turn them, flip them, slide them near and far, until their shadows make the picture: then the scene comes alive.</p></div>
          </div>
          <div className="sp-go-row">
            <button className="sp-go" disabled={!ready} onClick={() => open(nextId ?? SCENE_IDS[SCENE_IDS.length - 1])}>{!ready ? 'Lighting the lantern…' : startedAny ? 'CONTINUE →' : 'BEGIN THE SHOW →'}<small>{mounted ? (nextId ? `${sceneNo(nextId)} · ${SCENES[nextId].name}` : 'every scene is cast!') : ' '}</small></button>
            <button className="sp-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('stories'); }}>📜 Stories<small>{mounted ? `${totalStars(S)} of ${totalMax} stars` : ' '}</small></button>
            {mounted && sandboxOpen(S) ? <button className="sp-alt sp-dusk" disabled={!ready} onClick={() => open(FREE)}>🎭 Free stage<small>any puppets, your own picture</small></button>
              : <button className="sp-alt" disabled><span>🎭 Free stage</span><small>after the first story</small></button>}
            {mounted && S.ended && <button className="sp-alt" disabled={!ready} onClick={playShow}>🌙 The final performance</button>}
          </div>
          <ol className="sp-how" aria-label="How to play">
            <li><b>🫥 Match the outline.</b> A faint picture glows on the paper. Drag the shadows until they fill it.</li>
            <li><b>🏮 Near and far.</b> A puppet near the lantern casts a big, soft shadow; near the screen, a small, sharp one. Slide it on the board below.</li>
            <li><b>⟳ Turn, flip, take down.</b> Rotate with the handle, flip with ⇋, turn a fan edge-on, and take down puppets that don’t belong.</li>
            <li><b>🎨 Two lanterns.</b> With a gold and a blue lantern, each puppet casts two shadows, and coloured glass glows.</li>
          </ol>
          <p className="sp-keys">{keysLine}</p>
          <p className="sp-keys">On a phone: drag a shadow to move it, drag ⟳ to rotate, drag a rod on the board to slide it near or far.</p>
        </section>
      )}

      {screen === 'stories' && (
        <section className="sp-menu sp-stories" aria-label="Stories">
          <Art src="/art/shadow/backdrop.webp" paint="backdrop" w={1536} h={1024} className="sp-backdrop" />
          <header className="sp-head"><button className="sp-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="sp-total">★ {mounted ? totalStars(S) : 0} / {totalMax} stars</b></header>
          {STORIES.map((st, si2) => {
            const open2 = mounted && storyOpen(S, si2), n = mounted ? storyCount(S, si2) : 0;
            return (
              <section key={st.id} className={'sp-story' + (open2 ? '' : ' is-locked') + (mounted && storyDone(S, si2) ? ' is-done' : '')} aria-label={st.name}>
                <div className="sp-story-head"><span className="sp-story-icon" aria-hidden="true">{STORY_ICON[si2]}</span>
                  <div><small>STORY {si2 + 1} · {n}/{st.scenes.length} SCENES</small><h2>{open2 ? st.name : '🔒 ' + st.name}</h2><p>{open2 ? st.blurb : `Opens when “${STORIES[si2 - 1]?.name}” is performed to the end.`}</p></div>
                </div>
                <div className="sp-grid">
                  {st.scenes.map((id, i) => {
                    const Sv = SCENES[id], op = mounted && sceneOpen(S, id), d = mounted ? S.scenes[id] : undefined, last = i === st.scenes.length - 1;
                    return (
                      <button key={id} className={'sp-lv' + (op ? '' : ' is-locked') + (d?.done ? ' is-done' : '') + (last ? ' is-finale' : '')} disabled={!op || !ready} onClick={() => open(id)} aria-label={`${sceneNo(id)}: ${Sv.name}${op ? '' : ' (locked)'}`}>
                        <small>{sceneNo(id)}{last ? ' · FINALE' : ''}</small>
                        <b>{op ? Sv.name : '🔒 ' + Sv.name}</b>
                        <Lanterns stars={d?.stars ?? 0} />
                        <em>{d?.done && d.best !== null ? `best ✋ ${d.best}` : op ? `par ✋ ${Sv.par}` : last ? 'cast the other five' : 'cast one of the two before'}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button className={'sp-free' + (mounted && sandboxOpen(S) ? '' : ' is-locked')} disabled={!mounted || !sandboxOpen(S) || !ready} onClick={() => open(FREE)} aria-label={`Free stage${mounted && sandboxOpen(S) ? '' : ' (locked)'}`}>
            <b>🎭 The free stage</b><span>Every puppet in the box, one lantern or two, no outline: make your own pictures.</span><em>{mounted && sandboxOpen(S) ? 'open' : 'opens after the first story'}</em>
          </button>
          <p className="sp-note">Stars: ★ cast the scene · ★ within the move budget (par + {MOVE_SLACK}; a move is picking up a different puppet or lantern) · ★ the scene’s flourish.</p>
        </section>
      )}

      {screen === 'play' && sh && Sc && (<>
        {result && (
          <div className="sp-panel sp-result" ref={resultEl} role="dialog" aria-label="The scene comes alive">
            <p className="sp-eyebrow">{sceneNo(Sc.id)} · THE SCENE COMES ALIVE</p>
            <h2>{Sc.name}</h2>
            <p className="sp-after">“{Sc.after}”</p>
            <Lanterns stars={result.stars} big />
            <ul className="sp-tiers">
              <li className="is-on"><b>★</b> cast</li>
              <li className={result.stars[1] ? 'is-on' : ''}><b>★</b> {result.moves} move{result.moves === 1 ? '' : 's'} (budget {Sc.par + MOVE_SLACK})</li>
              <li className={result.stars[2] ? 'is-on' : ''}><b>★</b> {Sc.flourish.text}</li>
            </ul>
            {result.newStars > 0 && !result.first && <p className="sp-note">★ {result.newStars} new star{result.newStars > 1 ? 's' : ''}!</p>}
            <div className="sp-row">
              {result.finale ? <button className="sp-go" autoFocus onClick={playShow}>The final performance →</button>
                : (() => { const n = nextAfter(Sc.id); return n && sceneOpen(S, n) ? <button className="sp-go" autoFocus onClick={() => open(n)}>Next scene →<small>{sceneNo(n)} · {SCENES[n].name}</small></button> : null; })()}
              <button className="sp-alt" onClick={() => open(Sc.id)}>↺ Again</button>
              <button className="sp-alt" onClick={() => toMenu('stories')}>📜 Stories</button>
            </div>
          </div>
        )}
        {paused && (
          <div className="sp-panel" role="dialog" aria-label="Paused">
            <h2>Interval</h2><p>The lantern is turned low; the puppets will wait.</p>
            {settings}
            <p className="sp-keys">{keysLine}</p>
            <div className="sp-row"><button className="sp-go" onClick={() => pause(false)}>Back to the show</button><button className="sp-alt" onClick={() => toMenu(free ? 'menu' : 'stories')}>{free ? 'Menu' : 'Stories'}</button><button className="sp-alt" onClick={() => toMenu()}>Menu</button></div>
          </div>
        )}
      </>)}
      {screen === 'show' && !ending && <button className="sp-skip sp-chip" onClick={() => { scene.current?.stopReel(); panelRef.current = true; setEnding(true); refresh(); }}>Skip ▸▸</button>}
      {ending && (
        <div className="sp-ending" role="dialog" aria-label="The final performance">
          <Art src="/art/shadow/ending.webp" paint="ending" w={1536} h={1024} className="sp-ending-art" />
          <div className="sp-ending-text">
            <p className="sp-eyebrow">FIVE STORIES · THIRTY SCENES</p>
            <h2>The final performance</h2>
            <p>The whole wood came to watch. The cat reached for the moon, the little ship came home through the storm, the lanterns lit the walk, the peacock opened its tail, and the little dragon woke and curled round the moon. Then Dora and Enzo stepped out in front of the screen and bowed, and the audience clapped until the fireflies went to bed.</p>
            <p className="sp-final">★ {mounted ? totalStars(S) : 0} of {totalMax} stars{mounted && totalStars(S) < totalMax ? ' · flourishes and fewer moves earn the rest' : ' · every star!'} · 🎭 the free stage is always open</p>
            <div className="sp-row"><button className="sp-go" onClick={() => { setEnding(false); toMenu('stories'); }}>📜 Stories →</button><button className="sp-alt" onClick={() => { setEnding(false); toMenu(); }}>Menu</button></div>
          </div>
          <div className="sp-credits" aria-label="Cast"><div>
            <p className="sp-eyebrow">THE COMPANY</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="sp-eyebrow">THANK YOU FOR WATCHING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
