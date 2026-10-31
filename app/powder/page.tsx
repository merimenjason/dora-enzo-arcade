'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  PowderGame, DT, SAVE_KEY, CABINS, CABIN_M, SLALOM, GEAR, SLALOM_MEDALS, AIR_MEDALS, CARD_COUNT, readSave, freshSave, recordRun, unlocked, daySeed, runSeed,
  type Save, type Mode, type Medal, type Who, type GearKind, type Input, type Ev, type Trick,
} from '@/lib/powder-game';
import type { PowderScene, Look } from '@/lib/powder-scene';
import { PowderSound, type SongId } from './sound';
import './powder.css';

type Screen = 'menu' | 'slalom' | 'wardrobe' | 'album' | 'play' | 'ending';
type Result = { mode: Mode; reason: 'storm' | 'finish'; dist: number; tricks: number; time: number; missed: number; score: number; crashes: number; best: string; course: number; medal: Medal; newBest: boolean; newCards: number[]; unlocks: string[]; gates: number };
type Hud = { dist: number; tricks: number; speed: number; gap: number; time: number; gatesOk: number; missed: number; gateTotal: number; cards: number };
const sceneModule = () => import('@/lib/powder-scene');
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'];
const NAME: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo' };
const MODE_NAME: Record<Mode, string> = { free: 'Freeride', slalom: 'Slalom', air: 'Big Air', daily: 'Daily Mountain' };
const TIPS: Record<'free' | 'slalom' | 'air', { title: string; text: string }> = {
  free: { title: 'Down Whiskerpeak!', text: 'Straight down is fastest; carving across the slope slows you. A storm is following you down, so keep moving, and land clean tricks off the ramps to blow it back. Wooden signs point to hidden cabins off the edge of the piste: ski onto a porch for its postcard.' },
  slalom: { title: 'Through the gates', text: 'Pass between each pair of flags. A missed gate adds five seconds; miss more than two and there is no medal. Carve early, and snowplough before the tight ones.' },
  air: { title: 'The Big Air park', text: 'Hit every ramp you can. In the air, spin, flip or grab, then let go in time to land straight. A wobbly landing scores half; a crooked one ends in a snowball.' },
};
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const fmtM = (m: number) => `${Math.floor(m).toLocaleString('en-GB')} m`;

/** A painting with a pixel-art stand-in underneath, shown until (or unless) the painting loads. */
function Art({ src, paint, className }: { src: string; paint: 'title' | 'cocoa' | 'ending'; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false), im = useRef<HTMLImageElement>(null);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else if (paint === 'cocoa') m.paintCocoa(c); else m.paintEnding(c); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'pp-art ' + (className ?? '')}>
      <canvas ref={cv} width={960} height={640} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A chinchilla drawn by the pixel-art code at a whole-number scale. */
function Skier({ who, look, pose = 'ride', view = 'front', ski = 0, className }: { who: Who; look: Look; pose?: 'ride' | 'cheer' | 'tuck' | 'air'; view?: 'front' | 'q' | 'side'; ski?: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((m) => { if (!dead && cv.current) m.paintSkier(cv.current, who, look, pose, view, ski); }).catch(() => {}); return () => { dead = true; }; }, [who, look.scarf, look.hat, look.skis, pose, view, ski]);
  return <canvas ref={cv} className={'pp-skier ' + (className ?? '')} width={112} height={124} aria-hidden="true" />;
}
function Postcard({ k, found }: { k: number; found: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((m) => { if (!dead && cv.current) m.paintPostcard(cv.current, k, found); }).catch(() => {}); return () => { dead = true; }; }, [k, found]);
  return <canvas ref={cv} className="pp-card-art" width={192} height={128} aria-hidden="true" />;
}
const lookOf = (s: Save, who: Who): Look => {
  const g = s.gear[who], col = (id: string) => GEAR.find((x) => x.id === id)?.colour || '#e8344a';
  return { scarf: col(g.scarf), hat: g.hat, skis: col(g.skis) };
};
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

export default function PowderPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const scene = useRef<PowderScene | null>(null), sound = useRef<PowderSound | null>(null);
  const save = useRef<Save>(freshSave()), game = useRef<PowderGame | null>(null);
  const screenRef = useRef<Screen>('menu'), acc = useRef(0), course = useRef(0), day = useRef('');
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const ptr = useRef({ on: false, x: 0, y: 0, mouse: false, l: false, r: false, id: -1 });
  const btn = useRef({ tuck: false, brake: false });
  const [screen, setScreenState] = useState<Screen>('menu');
  const [result, setResult] = useState<Result | null>(null), [tip, setTip] = useState<{ title: string; text: string } | null>(null);
  const [paused, setPaused] = useState(false), [toast, setToast] = useState<{ title: string; text: string; card?: number } | null>(null);
  const [trick, setTrick] = useState<{ t: Trick; n: number } | null>(null), [hud, setHud] = useState<Hud | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [note, setNote] = useState<number | null>(null), [, setTick] = useState(0);
  const toastT = useRef(0), trickT = useRef(0), resultT = useRef(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;
  const blocked = useRef(false); blocked.current = !!(result || tip || paused);

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new PowderSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const song = (id: SongId) => sound.current?.music(id);
  const looks = () => { if (scene.current) scene.current.look = { dora: lookOf(save.current, 'dora'), enzo: lookOf(save.current, 'enzo') }; };

  function start(mode: Mode, c = 0) {
    const sc = scene.current; if (!sc) return;
    course.current = c;
    const seed = mode === 'daily' ? daySeed(day.current || todayKey()) : runSeed(S.runs);
    const g = new PowderGame(mode, seed, c); game.current = g;
    looks(); sc.setGame(g, S.who);
    acc.current = 0; keys.current = { left: false, right: false, up: false, down: false }; btn.current = { tuck: false, brake: false };
    window.clearTimeout(resultT.current); setResult(null); setToast(null); setTrick(null); setPaused(false); setScreen('play'); song('ski');
    const tk = mode === 'daily' ? 'free' : mode;
    if (!S.tips.includes(tk)) { S.tips.push(tk); persist(); setTip(TIPS[tk]); } else setTip(null);
    requestAnimationFrame(() => { sc.resize(); canvas.current?.focus(); });
  }
  const leave = (to: Screen) => { window.clearTimeout(resultT.current); game.current = null; scene.current?.setGame(null, S.who); setResult(null); setTip(null); setPaused(false); setScreen(to); song(to === 'ending' ? 'ending' : 'menu'); };

  /** Turns the keys, the pointer and the touch buttons into one input for the engine. */
  function input(): Input {
    const g = game.current!, k = g.sk, K = keys.current, p = ptr.current, sc = scene.current!;
    let turn: -1 | 0 | 1 = ((K.right ? 1 : 0) - (K.left ? 1 : 0)) as -1 | 0 | 1, target: number | null = null;
    const up = K.up || btn.current.tuck || (p.mouse && p.l), down = K.down || btn.current.brake || (p.mouse && p.r);
    if (p.on && turn === 0) {
      const dx = p.x - sc.skierAt.x, dy = p.y - sc.skierAt.y;
      const ang = dy > 10 ? Math.atan2(dx, dy) : Math.abs(dx) > 10 ? Math.sign(dx) * (Math.PI / 2) : null;
      if (k.state === 'air') { if (ang !== null && Math.abs(ang) > 1.1 && Math.abs(dx) > 30 && (p.mouse || p.id >= 0)) turn = Math.sign(dx) as -1 | 1; }
      else if (ang !== null && Math.hypot(dx, dy) > 14) target = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ang));
    }
    return { turn, target, up, down };
  }
  /** Sounds, toasts and the result as the engine reports them. */
  function onEvents(evs: Ev[]) {
    const snd = sound.current, g = game.current; if (!g) return;
    scene.current?.events(evs);
    for (const e of evs) {
      if (e.t === 'jump') snd?.jump(e.big);
      else if (e.t === 'land') {
        snd?.land(e.clean);
        if (e.trick) { setTrick({ t: e.trick, n: Date.now() }); window.clearTimeout(trickT.current); trickT.current = window.setTimeout(() => setTrick(null), 1700); if (e.clean) { snd?.trick(e.trick.pts); window.setTimeout(() => sound.current?.cheer(), 250); } }
      } else if (e.t === 'crash') { snd?.crash(); }
      else if (e.t === 'wipeout') setTrick({ t: { name: 'Wipeout!', pts: 0, clean: false }, n: Date.now() });
      else if (e.t === 'up') snd?.up();
      else if (e.t === 'puff') snd?.puff();
      else if (e.t === 'mogul') snd?.mogul();
      else if (e.t === 'clack') snd?.clack();
      else if (e.t === 'gate') snd?.gate(e.ok);
      else if (e.t === 'bump') snd?.bump();
      else if (e.t === 'postcard') {
        snd?.postcard();
        const first = !save.current.cards.includes(e.k);
        setToast({ title: first ? 'A new postcard!' : 'Postcard (already in the album)', text: CABINS[e.k].name, card: e.k });
        window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 3200);
      } else if (e.t === 'caught') snd?.caught();
    }
    if (g.over) finish(g);
  }
  function finish(g: PowderGame) {
    const o = g.over!; const rec = recordRun(save.current, g, g.mode === 'daily' ? day.current || todayKey() : undefined); persist();
    if (o.reason === 'finish') sound.current?.finish(rec.medal);
    const r: Result = { mode: g.mode, reason: o.reason, dist: o.dist, tricks: o.tricks, time: o.time, missed: o.missed, score: o.score, crashes: o.crashes, best: o.best, course: g.spec.course, medal: rec.medal, newBest: rec.best, newCards: rec.newCards, unlocks: rec.unlocks, gates: g.gateTotal() };
    resultT.current = window.setTimeout(() => { setResult(r); if (r.reason === 'storm') song('cocoa'); }, o.reason === 'storm' ? 900 : 700);
    refresh();
  }

  // ---- mount: the save, the scene, the loop, the hooks for tests
  useEffect(() => {
    let raw: string | null = null; try { raw = localStorage.getItem(SAVE_KEY); } catch { /* none */ }
    save.current = readSave(raw);
    day.current = todayKey();
    setTouch(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const o = () => setOrient(innerHeight > innerWidth * 1.05 ? 'tall' : 'wide'); o(); addEventListener('resize', o);
    setMounted(true);
    let raf = 0, dead = false, last = performance.now(), hudN = 0;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.PowderScene(canvas.current); } catch { setError('This browser cannot draw the mountain.'); return; }
      looks();
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const g = game.current, sc = scene.current;
        if (screenRef.current === 'play' && g && sc) {
          if (!blocked.current && !g.over) {
            acc.current += dt;
            let n = 0;
            while (acc.current >= DT && n++ < 5 && !g.over) { g.step(input()); acc.current -= DT; const ev = g.drain(); if (ev.length) onEventsRef.current(ev); }
            if (acc.current > DT * 5) acc.current = 0;
          }
          sc.frame(blocked.current && !g.over ? 0 : dt);
          const k = g.sk, gap = g.storm.on ? g.sk.y - g.storm.y : 9999;
          sound.current?.bed(blocked.current || g.over ? 0 : k.s, k.state === 'ride', g.surface(k.x, k.y) === 'ice', g.storm.on && !g.over ? Math.max(0, 1 - gap / 700) : 0);
          if (++hudN % 6 === 0) setHud({ dist: g.dist(), tricks: g.tricks, speed: k.s, gap, time: g.time, gatesOk: g.gatesOk, missed: g.missed, gateTotal: g.gateTotal(), cards: g.cards.length });
        }
        sound.current?.tickMusic();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setReady(true);
    }).catch(() => setError('The mountain did not load. Try reloading the page.'));
    const ro = new ResizeObserver(() => scene.current?.resize()); if (stage.current) ro.observe(stage.current); if (canvas.current) ro.observe(canvas.current);
    const hide = () => { if (document.hidden) { sound.current?.suspend(); if (screenRef.current === 'play' && game.current && !game.current.over) setPaused(true); } else sound.current?.resume(); };
    document.addEventListener('visibilitychange', hide);
    const w = window as unknown as Record<string, unknown>;
    w.__powder = () => {
      const g = game.current, sc = scene.current, k = g?.sk;
      return {
        screen: screenRef.current, mode: g?.mode ?? null, state: k?.state ?? null, x: k?.x ?? 0, y: k?.y ?? 0, s: k?.s ?? 0, a: k?.a ?? 0, z: k?.z ?? 0,
        dist: g?.dist() ?? 0, tricks: g?.tricks ?? 0, crashes: g?.crashes ?? 0, gatesOk: g?.gatesOk ?? 0, missed: g?.missed ?? 0, cards: g?.cards ?? [], over: g?.over ?? null,
        gap: g && g.storm.on ? g.sk.y - g.storm.y : null, blocked: blocked.current, steps: g?.steps ?? 0, save: save.current, scale: sc?.k ?? 0,
        skier: sc && g ? sc.skierAt : null,
      };
    };
    /** Puts the skier just above a cabin's porch (for the postcard check). */
    w.__powderCabin = () => {
      const g = game.current; if (!g) return false;
      for (let i = 0; i < 40; i++) { const c = g.chunk(i); const cab = c.obs.find((o) => o.k === 'cabin'); if (cab) { g.sk.x = cab.x; g.sk.y = cab.y - 80; g.sk.a = 0; g.sk.th = 0; g.sk.s = 40; g.storm.y = g.sk.y - 800; return true; } }
      return false;
    };
    /** Brings the storm right up behind the skier. */
    w.__powderStorm = (gap: number) => { const g = game.current; if (!g) return false; g.storm.y = g.sk.y - gap; return true; };
    /** Moves the skier to just above the nearest ramp, lined up. */
    w.__powderRamp = () => { const g = game.current; if (!g) return false; const r = g.near(g.sk.y, g.sk.y + 4000).ramps[0]; if (!r) return false; g.sk.x = r.x; g.sk.y = r.y - 60; g.sk.a = 0; g.sk.th = 0; g.sk.s = 200; return true; };
    w.__powderEnding = () => { game.current = null; screenRef.current = 'ending'; setScreenState('ending'); };
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', o); document.removeEventListener('visibilitychange', hide); window.clearTimeout(resultT.current); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onEventsRef = useRef(onEvents); onEventsRef.current = onEvents;
  useLayoutEffect(() => { scene.current?.resize(); requestAnimationFrame(() => scene.current?.resize()); }, [screen, orient, touch, result]);

  // ---- keyboard: arrows or WASD; down is the snowplough (a grab in the air), up the tuck (a flip in the air)
  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
    const dn = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (tip && (k === 'enter' || k === ' ' || k === 'escape')) { e.preventDefault(); audio().ui(); setTip(null); return; }
      if (screenRef.current !== 'play') return;
      if (result) { if (k === 'enter') { e.preventDefault(); again(); } return; }
      if (map[k]) { e.preventDefault(); audio(); keys.current[map[k]] = true; ptr.current.on = ptr.current.id >= 0 && !ptr.current.mouse; return; }
      if (k === ' ') { e.preventDefault(); keys.current.up = true; return; }
      if (k === 'escape' || k === 'p') { e.preventDefault(); audio().ui(); setPaused((p) => !p); }
      if (k === 'r' && game.current) { audio().ui(); start(game.current.mode, course.current); }
    };
    const upk = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (map[k]) keys.current[map[k]] = false; if (k === ' ') keys.current.up = false; };
    addEventListener('keydown', dn); addEventListener('keyup', upk);
    return () => { removeEventListener('keydown', dn); removeEventListener('keyup', upk); };
  });
  // ---- pointer: the skier steers toward the pointer (mouse) or the finger (touch); point level with the skier in the air to spin
  const local = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function onMove(e: React.PointerEvent) {
    const p = ptr.current, l = local(e);
    if (e.pointerType === 'mouse') { p.mouse = true; p.on = true; p.x = l.x; p.y = l.y; }
    else if (e.pointerId === p.id) { p.x = l.x; p.y = l.y; }
  }
  function onDown(e: React.PointerEvent) {
    audio(); const p = ptr.current, l = local(e);
    if (e.pointerType === 'mouse') { p.mouse = true; p.on = true; p.x = l.x; p.y = l.y; if (e.button === 2) p.r = true; else p.l = true; }
    else { p.mouse = false; p.on = true; p.id = e.pointerId; p.x = l.x; p.y = l.y; try { canvas.current?.setPointerCapture(e.pointerId); } catch { /* fine */ } }
  }
  function onUp(e: React.PointerEvent) {
    const p = ptr.current;
    if (e.pointerType === 'mouse') { if (e.button === 2) p.r = false; else p.l = false; }
    else if (e.pointerId === p.id) { p.on = false; p.id = -1; }
  }
  const hold = (which: 'tuck' | 'brake', on: boolean) => (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); audio(); btn.current[which] = on; };

  function again() { const r = result; if (!r) return; audio().ui(); start(r.mode, r.course); }
  function afterResult(to: 'menu' | 'slalom' | 'ending') { audio().ui(); leave(to); }
  const toggle = (k: 'sound' | 'music') => { S.settings[k] = !S.settings[k]; persist(); const s = audio(); if (k === 'sound') s.setSound(S.settings.sound); else s.setMusic(S.settings.music); refresh(); };
  const Toggles = () => (
    <span className="pp-toggles">
      <button type="button" className={'pp-tog' + (S.settings.sound ? ' is-on' : '')} aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>Sound</button>
      <button type="button" className={'pp-tog' + (S.settings.music ? ' is-on' : '')} aria-pressed={S.settings.music} onClick={() => toggle('music')}>Music</button>
    </span>
  );
  const pick = (who: Who) => { audio().ui(); S.who = who; persist(); looks(); refresh(); };
  const wear = (kind: GearKind, id: string) => { audio().ui(); S.gear[S.who][kind] = id; persist(); looks(); refresh(); };
  const g = game.current, cards = mounted ? S.cards.length : 0, golds = mounted ? S.slalom.filter((x) => x.medal === 3).length : 0;
  const lookNow = mounted ? lookOf(S, S.who) : { scarf: '#e8344a', hat: 'hat-none', skis: '#e8344a' };
  const partner: Who = S.who === 'dora' ? 'enzo' : 'dora';
  const allFound = cards >= CARD_COUNT;
  return (
    <main className="pp-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-orient={orient}>
      {screen === 'menu' && (
        <section className="pp-menu">
          <Art src="/art/powder/title.webp" paint="title" className="pp-menu-art" />
          <div className="pp-menu-card">
            <p className="pp-eyebrow">A PIXEL-ART SKI ADVENTURE</p>
            <h1>Powder Paws</h1>
            <p className="pp-lede">Carve down Whiskerpeak, the mountain that never runs out, one jump ahead of the snowstorm.</p>
            <div className="pp-modes">
              <button type="button" className="pp-primary pp-mode-free" disabled={!ready} onClick={() => { audio().ui(); start('free'); }}>Freeride<small>{mounted && S.best.free ? `Best ${fmtM(S.best.free)}` : 'Race the storm'}</small></button>
              <button type="button" disabled={!ready} onClick={() => { audio().ui(); start('daily'); }}>Daily Mountain<small>{mounted && S.best.daily[day.current] ? `Today ${S.best.daily[day.current].toLocaleString('en-GB')}` : 'Today’s slope'}</small></button>
              <button type="button" disabled={!ready} onClick={() => { audio().ui(); setScreen('slalom'); }}>Slalom<small>{golds}/{SLALOM.length} gold</small></button>
              <button type="button" disabled={!ready} onClick={() => { audio().ui(); start('air'); }}>Big Air<small>{mounted && S.best.air ? `Best ${S.best.air.toLocaleString('en-GB')}` : 'Jump park'}</small></button>
            </div>
            <div className="pp-who" role="group" aria-label="Who skis">
              {(['dora', 'enzo'] as const).map((w) => (
                <button type="button" key={w} className={'pp-who-btn' + (S.who === w ? ' is-on' : '')} aria-pressed={S.who === w} onClick={() => pick(w)}>
                  <Skier who={w} look={mounted ? lookOf(S, w) : lookNow} pose={S.who === w ? 'cheer' : 'ride'} /><span>{NAME[w]}</span>
                </button>
              ))}
              <div className="pp-who-side">
                <button type="button" onClick={() => { audio().ui(); setScreen('wardrobe'); }}>Wardrobe</button>
                <button type="button" onClick={() => { audio().ui(); setNote(null); setScreen('album'); }}>Postcards {cards}/{CARD_COUNT}</button>
              </div>
            </div>
            <div className="pp-menu-foot"><a className="pp-back" href="/">← MAIN ARCADE</a><Toggles /></div>
          </div>
        </section>
      )}
      {screen === 'slalom' && (
        <section className="pp-panel">
          <header className="pp-bar"><button type="button" className="pp-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button><span className="pp-bar-mid">Slalom · {golds}/{SLALOM.length} gold</span><Toggles /></header>
          <div className="pp-courses">
            {SLALOM.map((c, i) => { const r = S.slalom[i]; return (
              <button type="button" key={c.name} className={'pp-course m' + r.medal} onClick={() => { audio().ui(); start('slalom', i); }}>
                <span className="pp-course-no">Course {i + 1}</span><b>{c.name}</b><span className="pp-course-blurb">{c.blurb}</span>
                <span className="pp-course-best">{r.time ? `${fmtTime(r.time)} · ${MEDAL[r.medal] || 'no medal'}` : 'Not raced yet'}</span>
                <span className="pp-course-goal">Gold {SLALOM_MEDALS[i][0]}s · Silver {SLALOM_MEDALS[i][1]}s · Bronze {SLALOM_MEDALS[i][2]}s</span>
              </button>
            ); })}
          </div>
        </section>
      )}
      {screen === 'wardrobe' && (
        <section className="pp-panel">
          <header className="pp-bar"><button type="button" className="pp-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button><span className="pp-bar-mid">Wardrobe · {NAME[S.who]}</span><Toggles /></header>
          <div className="pp-wardrobe">
            <div className="pp-mirror"><Skier who={S.who} look={lookNow} pose="cheer" className="pp-mirror-front" /><Skier who={S.who} look={lookNow} view="side" ski={Math.PI / 2} className="pp-mirror-side" />
              <div className="pp-who-mini">{(['dora', 'enzo'] as const).map((w) => <button type="button" key={w} className={S.who === w ? 'is-on' : ''} onClick={() => pick(w)}>{NAME[w]}</button>)}</div></div>
            <div className="pp-gear">
              {(['scarf', 'hat', 'skis'] as const).map((kind) => (
                <div key={kind} className="pp-gear-row"><h2>{kind === 'scarf' ? 'Scarves' : kind === 'hat' ? 'Hats' : 'Skis'}</h2>
                  <div className="pp-swatches">{GEAR.filter((x) => x.kind === kind).map((x) => { const open = unlocked(S, x.id), on = S.gear[S.who][kind] === x.id; return (
                    <button type="button" key={x.id} className={'pp-swatch' + (on ? ' is-on' : '')} disabled={!open} aria-pressed={on} title={open ? x.name : x.how} onClick={() => wear(kind, x.id)}>
                      <i style={{ background: x.colour || 'transparent' }} /><span>{open ? x.name : '🔒 ' + x.how}</span>
                    </button>); })}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {screen === 'album' && (
        <section className="pp-panel">
          <header className="pp-bar"><button type="button" className="pp-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button><span className="pp-bar-mid">Postcards · {cards}/{CARD_COUNT}</span><Toggles /></header>
          <div className="pp-album">
            {CABINS.map((c, k) => { const found = S.cards.includes(k); return (
              <button type="button" key={c.name} className={'pp-postcard' + (found ? ' is-found' : '') + (note === k ? ' is-open' : '')} disabled={!found} onClick={() => { audio().ui(); setNote(note === k ? null : k); }}>
                <Postcard k={k} found={found} /><b>{found ? c.name : `Cabin ${k + 1}`}</b><small>{found ? (note === k ? c.note : 'Tap to read') : `Somewhere past ${CABIN_M[k].toLocaleString('en-GB')} m`}</small>
              </button>); })}
          </div>
          {allFound && <div className="pp-album-foot"><button type="button" className="pp-primary" onClick={() => { audio().ui(); if (!S.ended) { S.ended = true; persist(); } leave('ending'); }}>To the lodge party!</button></div>}
        </section>
      )}
      <div className={'pp-stage' + (screen === 'play' ? '' : ' is-hidden')} ref={stage}>
        {screen === 'play' && g && hud && (
          <header className="pp-bar pp-hud">
            <button type="button" className="pp-back" onClick={() => { audio().ui(); setPaused(true); }} aria-label="Pause">II</button>
            <span className="pp-bar-mid">
              <span className="pp-mode-name">{g.mode === 'slalom' ? SLALOM[g.spec.course].name : MODE_NAME[g.mode]}</span>
              {g.mode === 'slalom' ? <>
                <span className="pp-stat"><b>{fmtTime(hud.time)}</b><small>time</small></span>
                <span className="pp-stat"><b>{hud.gatesOk + hud.missed}/{hud.gateTotal}</b><small>gates</small></span>
                {hud.missed > 0 && <span className="pp-stat is-bad"><b>+{hud.missed * 5}s</b><small>missed</small></span>}
              </> : g.mode === 'air' ? <>
                <span className="pp-stat"><b>{hud.tricks.toLocaleString('en-GB')}</b><small>points</small></span>
                <span className="pp-stat"><b>{fmtM(Math.max(0, g.end / 10 - hud.dist))}</b><small>to go</small></span>
              </> : <>
                <span className="pp-stat"><b>{fmtM(hud.dist)}</b><small>down</small></span>
                <span className="pp-stat"><b>{hud.tricks.toLocaleString('en-GB')}</b><small>tricks</small></span>
                <span className={'pp-storm' + (hud.gap < 260 ? ' is-near' : '')} title="The storm"><i style={{ width: `${Math.max(4, Math.min(100, (hud.gap / 900) * 100))}%` }} /><small>storm</small></span>
                {hud.cards > 0 && <span className="pp-stat"><b>✉ {hud.cards}</b><small>cards</small></span>}
              </>}
              <span className="pp-stat pp-speed"><b>{Math.round(hud.speed * 0.36)}</b><small>km/h</small></span>
            </span>
            <Toggles />
          </header>
        )}
        <canvas ref={canvas} className="pp-canvas" tabIndex={0} aria-label="The mountain"
          onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={(e) => { if (e.pointerType === 'mouse') ptr.current.l = ptr.current.r = false; }} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && trick && !result && <p key={trick.n} className={'pp-trick' + (trick.t.pts ? '' : ' is-bad') + (trick.t.clean ? '' : ' is-wobbly')} role="status">{trick.t.name}{trick.t.pts ? <b>+{trick.t.pts}</b> : null}{trick.t.pts && !trick.t.clean ? <small>wobbly landing</small> : null}</p>}
        {screen === 'play' && toast && !result && <div className="pp-toast" role="status">{toast.card !== undefined && <Postcard k={toast.card} found />}<p><b>{toast.title}</b>{toast.text}</p></div>}
        {screen === 'play' && touch && !result && !tip && (
          <div className="pp-pads">
            <button type="button" className="pp-pad" onPointerDown={hold('brake', true)} onPointerUp={hold('brake', false)} onPointerCancel={hold('brake', false)} onPointerLeave={hold('brake', false)}>{g?.sk.state === 'air' ? 'Grab' : 'Brake'}</button>
            <button type="button" className="pp-pad" onPointerDown={hold('tuck', true)} onPointerUp={hold('tuck', false)} onPointerCancel={hold('tuck', false)} onPointerLeave={hold('tuck', false)}>{g?.sk.state === 'air' ? 'Flip' : 'Tuck'}</button>
          </div>
        )}
        {screen === 'play' && result && result.reason === 'finish' && (
          <div className="pp-result" role="dialog" aria-label="Run over">
            <div className={'pp-result-card m' + result.medal}>
              <p className="pp-eyebrow">{result.mode === 'slalom' ? `SLALOM · ${SLALOM[result.course].name.toUpperCase()}` : 'BIG AIR'}</p>
              {result.medal > 0 && <p className={'pp-medal m' + result.medal}>{MEDAL[result.medal]}</p>}
              <h2>{result.mode === 'slalom' ? fmtTime(result.time) : `${result.tricks.toLocaleString('en-GB')} points`}</h2>
              <ul className="pp-lines">
                {result.mode === 'slalom' ? <>
                  <li>Gates {result.gates - result.missed}/{result.gates}{result.missed ? ` · +${result.missed * 5}s` : ' · clean run!'}</li>
                  {result.missed > 2 && <li className="bad">More than two gates missed: no medal</li>}
                  <li>Gold {SLALOM_MEDALS[result.course][0]}s · Silver {SLALOM_MEDALS[result.course][1]}s · Bronze {SLALOM_MEDALS[result.course][2]}s</li>
                </> : <>
                  {result.best && <li>Best trick: {result.best}</li>}
                  <li>Gold {AIR_MEDALS[0].toLocaleString('en-GB')} · Silver {AIR_MEDALS[1].toLocaleString('en-GB')} · Bronze {AIR_MEDALS[2].toLocaleString('en-GB')}</li>
                </>}
                {result.newBest && <li className="ok">A new best!</li>}
                {result.unlocks.map((u) => <li key={u} className="ok">Unlocked: {GEAR.find((x) => x.id === u)?.name}</li>)}
              </ul>
              <div className="pp-result-buttons">
                <button type="button" className="pp-primary" autoFocus onClick={again}>Ski again</button>
                {result.mode === 'slalom' && <button type="button" onClick={() => afterResult('slalom')}>Courses</button>}
                <button type="button" onClick={() => afterResult('menu')}>Menu</button>
              </div>
            </div>
          </div>
        )}
        {tip && screen === 'play' && (
          <div className="pp-tip" role="dialog" aria-label={tip.title}>
            <div className="pp-tip-card"><h2>{tip.title}</h2><p>{tip.text}</p>
              {!touch && <p className="pp-keys"><kbd>←</kbd><kbd>→</kbd> carve (or steer with the mouse) · <kbd>↓</kbd> snowplough · <kbd>↑</kbd> tuck<br />In the air: <kbd>←</kbd><kbd>→</kbd> spin · <kbd>↑</kbd> flip · <kbd>↓</kbd> grab · let go to land · <kbd>Esc</kbd> pause</p>}
              {touch && <p className="pp-keys">Hold a finger where you want to ski. Brake and Tuck are at the bottom; in the air they Grab and Flip, and a finger held level with the skier spins.</p>}
              <button type="button" className="pp-primary" autoFocus onClick={() => { audio().ui(); setTip(null); canvas.current?.focus(); }}>Let’s ski!</button></div>
          </div>
        )}
        {paused && screen === 'play' && !result && (
          <div className="pp-tip" role="dialog" aria-label="Paused">
            <div className="pp-tip-card"><h2>Paused</h2>
              <div className="pp-result-buttons">
                <button type="button" className="pp-primary" autoFocus onClick={() => { audio().ui(); setPaused(false); canvas.current?.focus(); }}>Keep skiing</button>
                <button type="button" onClick={() => { audio().ui(); if (g) start(g.mode, course.current); }}>Restart</button>
                <button type="button" onClick={() => { audio().ui(); leave(g?.mode === 'slalom' ? 'slalom' : 'menu'); }}>Quit</button>
              </div></div>
          </div>
        )}
      </div>
      {screen === 'play' && result && result.reason === 'storm' && (
        <section className="pp-cocoa" role="dialog" aria-label="Caught by the storm">
          <Art src="/art/powder/cocoa.webp" paint="cocoa" className="pp-cocoa-art" />
          <div className="pp-cocoa-card">
            <p className="pp-eyebrow">{result.mode === 'daily' ? 'DAILY MOUNTAIN' : 'FREERIDE'} · THE STORM CAUGHT UP</p>
            <h2>Cocoa by the fire</h2>
            <p>The snow swirls in, so {NAME[S.who]} and {NAME[partner]} duck into the nearest cabin to wait it out with a hot cocoa.</p>
            <ul className="pp-lines">
              <li><b>{fmtM(result.dist)}</b> down the mountain{result.newBest ? ' · a new best!' : ''}</li>
              <li><b>{result.tricks.toLocaleString('en-GB')}</b> trick points{result.best ? ` · best: ${result.best}` : ''}</li>
              {result.mode === 'daily' && <li>Today’s score <b>{result.score.toLocaleString('en-GB')}</b></li>}
              {result.newCards.map((k) => <li key={k} className="ok">✉ Postcard from {CABINS[k].name}</li>)}
              {result.unlocks.map((u) => <li key={u} className="ok">Unlocked: {GEAR.find((x) => x.id === u)?.name}</li>)}
            </ul>
            <div className="pp-result-buttons">
              {allFound && !S.ended
                ? <button type="button" className="pp-primary" autoFocus onClick={() => { S.ended = true; persist(); afterResult('ending'); }}>All ten postcards! To the lodge</button>
                : <button type="button" className="pp-primary" autoFocus onClick={again}>Ski again</button>}
              <button type="button" onClick={() => afterResult('menu')}>Menu</button>
            </div>
          </div>
        </section>
      )}
      {screen === 'ending' && (
        <section className="pp-ending">
          <Art src="/art/powder/ending.webp" paint="ending" className="pp-ending-art" />
          <div className="pp-ending-card">
            <p className="pp-eyebrow">ALL TEN POSTCARDS</p>
            <h2>The lodge party</h2>
            <p>At the foot of Whiskerpeak the lodge is full of lanterns. Every cabin keeper has skied down for the party, the ten postcards are pinned above the fire, and Dora and Enzo dance until the storm blows itself out.</p>
            <div className="pp-result-buttons">
              <button type="button" className="pp-primary" onClick={() => { audio().ui(); leave('menu'); }}>Back up the mountain</button>
              <a className="pp-back" href="/">← MAIN ARCADE</a>
            </div>
          </div>
        </section>
      )}
      {error && <p className="pp-error">{error}</p>}
    </main>
  );
}
