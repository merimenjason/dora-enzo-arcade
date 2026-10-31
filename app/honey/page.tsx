'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  HoneyGame, CHAMBERS, AREAS, SAVE_KEY, readSave, freshSave, record, chamberOpen, areaOpen, areaChambers, starCount, nextChamber, chamberById, chamberNo, seedFor,
  type Save, type Step, type AreaId, type GoalKey,
} from '@/lib/honey-game';
import { STORY, type Who } from '@/lib/honey-levels';
import type { HoneyScene, Mood } from '@/lib/honey-scene';
import { HoneySound, type SongId } from './sound';
import './honey.css';

type Screen = 'menu' | 'map' | 'play' | 'ending';
type Result = { id: string; won: boolean; stars: number; score: number; left: number; better: boolean; first: boolean; goals: { key: GoalKey; left: number }[] };
type Story = { key: string; i: number; then: () => void };
const sceneModule = () => import('@/lib/honey-scene');
const GOAL: Record<GoalKey, { icon: string; name: string }> = {
  honey: { icon: '🍯', name: 'cells to fill' }, bees: { icon: '🐝', name: 'bees to free' }, acorns: { icon: '🌰', name: 'acorns to bring down' },
  moss: { icon: '🌿', name: 'moss to scrub' }, dew: { icon: '💧', name: 'dew drops to catch' },
};
const WIN = [['Sweet as honey!', 'Golden!'], ['Sweet as honey!', 'Filled to the brim!'], ['Buzzing!', 'What a comb!'], ['Royal honey!', 'The queen would be proud!']];
const LOSE = ['Out of turns', 'So close!', 'The comb needs more'];
const NAMES: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo', pip: 'Pip', rosa: 'Rosa', bumble: 'Bumble', heath: 'Old Heath', queen: 'The Queen' };

/** A painting with a stained-glass stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className, area }: { src: string; paint: 'title' | 'ending' | 'back'; w: number; h: number; className?: string; area?: AreaId }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { setHide(false); setGot(false); const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else if (paint === 'ending') m.paintEnding(c); else m.paintBack(c, area ?? 'clover'); }).catch(() => {});
    return () => { dead = true; };
  }, [paint, area]);
  return (
    <span className={'hh-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** An area window drawn so its ornate border frames the whole box at any shape (the drawn stand-in until it loads). */
function FramedWindow({ area, className }: { area: AreaId; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false, mod: typeof import('@/lib/honey-scene') | null = null;
    const im = new Image(); im.decoding = 'async'; im.src = `/art/honey/area-${area}.webp`;
    const draw = () => {
      const c = cv.current; if (dead || !c || !mod) return;
      const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(1, r.width), H = Math.max(1, r.height);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      if (im.complete && im.naturalWidth > 0) { const x = c.getContext('2d'); if (!x) return; x.setTransform(dpr, 0, 0, dpr, 0, 0); mod.paintFramedWindow(x, im, W, H); }
      else mod.paintBack(c, area);
    };
    sceneModule().then((m) => { mod = m; draw(); }).catch(() => {});
    im.onload = draw;
    const ro = new ResizeObserver(draw); if (cv.current) ro.observe(cv.current);
    return () => { dead = true; ro.disconnect(); im.onload = null; };
  }, [area]);
  return <span className={'hh-art ' + (className ?? '')}><canvas ref={cv} aria-hidden="true" /></span>;
}
/** A cut-out, or nothing if it hasn't been painted. */
function Cut({ name, className }: { name: string; className?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [name]);
  return bad ? <span className={'hh-cut is-missing ' + (className ?? '')} /> : <img className={'hh-cut ' + (className ?? '')} src={`/art/honey/${name}.webp`} alt="" onError={() => setBad(true)} />;
}

const areaOf = (id: string) => chamberById(id)!.area;
const label = (id: string) => { const a = AREAS.findIndex((x) => x.id === areaOf(id)); return `${a + 1}-${areaChambers(areaOf(id)).findIndex((c) => c.id === id) + 1}`; };

export default function HoneyPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), resultCard = useRef<HTMLDivElement>(null);
  const scene = useRef<HoneyScene | null>(null), sound = useRef<HoneySound | null>(null);
  const save = useRef<Save>(freshSave()), game = useRef<HoneyGame | null>(null);
  const screenRef = useRef<Screen>('menu'), moodT = useRef({ happy: 0, wow: 0 }), idle = useRef(0), resultT = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [area, setArea] = useState<AreaId>('clover');
  const [result, setResult] = useState<Result | null>(null), [story, setStory] = useState<Story | null>(null);
  const [tip, setTip] = useState<{ title: string; text: string } | null>(null), [toast, setToast] = useState('');
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const toastTimer = useRef(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;
  const blocked = useRef(false); blocked.current = !!(result || tip || story);

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new HoneySound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const song = (id: SongId) => sound.current?.music(id);
  const showToast = (t: string, ms = 2400) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const tell = (key: string, then: () => void) => {
    if (!STORY[key] || S.story.includes(key)) { then(); return; }
    S.story.push(key); persist(); setStory({ key, i: 0, then });
  };

  function start(id: string) {
    const sc = scene.current, ch = chamberById(id); if (!sc || !ch) return;
    const tries = S.tries[id] ?? 0; S.tries[id] = tries + 1; persist();
    const g = new HoneyGame(ch, seedFor(id, tries)); game.current = g;
    sc.setGame(g, ch.area); sc.mood = { dora: 'think', enzo: 'think' }; moodT.current = { happy: 0, wow: 0 }; idle.current = 0;
    window.clearTimeout(resultT.current); setResult(null); setToast(''); setScreen('play'); song(ch.area); setArea(ch.area);
    const showTip = () => { if (ch.tip && !S.tips.includes(id)) { S.tips.push(id); persist(); setTip(ch.tip); } else setTip(null); };
    if (areaChambers(ch.area)[0].id === id) tell(ch.area + '-in', showTip); else showTip();
    requestAnimationFrame(() => { sc.resize(); canvas.current?.focus(); });
  }
  const leave = (to: Screen) => { window.clearTimeout(resultT.current); game.current = null; scene.current?.setGame(null, area); setResult(null); setTip(null); setScreen(to); song(to === 'ending' ? 'ending' : 'menu'); };

  /** Sounds, moods and the result, as each step starts to play. */
  function onStep(s: Step) {
    const snd = sound.current, g = game.current; refresh();
    const mt = moodT.current;
    if (s.t === 'bounce') snd?.bounce();
    if (s.t === 'turn') snd?.turn();
    if (s.t === 'clear') {
      snd?.pop(s.chain, s.gone.length);
      for (const f of s.fired) { if (f.combo) snd?.combo(); else if (f.sp === 1) snd?.buzz(); else if (f.sp === 2) snd?.blossom(); else snd?.jelly(); }
      if (s.made.length) snd?.made();
      if (s.freed.length) { snd?.freed(); mt.happy = Math.max(mt.happy, 1.4); }
      if (s.gone.some((x) => x.p.k === 'wax')) snd?.wax();
      if (s.gone.some((x) => x.p.k === 'wasp')) snd?.shoo();
      if (s.gone.some((x) => x.p.k === 'dew')) snd?.dew();
      if (s.chain >= 2 || s.made.length || s.waggle >= 2) mt.happy = Math.max(mt.happy, 1.4);
      if (s.fired.some((f) => f.combo || f.sp === 3) || s.chain >= 4 || s.fired.length >= 2 || s.waggle === 3) mt.wow = Math.max(mt.wow, 1.8);
    }
    if (s.t === 'acorn') { snd?.acorn(); mt.happy = Math.max(mt.happy, 1.2); }
    if (s.t === 'hop' && s.who === 'wasp') snd?.wasp();
    if (s.t === 'moss') snd?.moss();
    if (s.t === 'shuffle') snd?.shuffle();
    if (s.t === 'end' && g) {
      const id = g.ch.id, rec = record(save.current, id, s.stars, s.score); persist();
      if (s.won) { snd?.win(s.stars); mt.wow = 3; } else snd?.lose();
      const goals = g.goals().map((x) => ({ key: x.key, left: x.left }));
      resultT.current = window.setTimeout(() => { setResult({ id, won: s.won, stars: s.stars, score: s.score, left: g.over?.left ?? 0, ...rec, goals }); }, s.won ? 500 : 700);
    }
  }

  // ---- mount: the save, the scene, the loop, the hooks for tests
  useEffect(() => {
    let raw: string | null = null; try { raw = localStorage.getItem(SAVE_KEY); } catch { /* none */ }
    save.current = readSave(raw);
    setTouch(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const o = () => setOrient(innerHeight > innerWidth * 1.05 ? 'tall' : 'wide'); o(); addEventListener('resize', o);
    setMounted(true);
    let raf = 0, dead = false, last = performance.now();
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.HoneyScene(canvas.current); } catch { setError('This browser cannot draw the comb.'); return; }
      scene.current.onStep = onStepRef.current;
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const g = game.current, sc = scene.current;
        if (screenRef.current === 'play' && g && sc) {
          const mt = moodT.current; mt.happy = Math.max(0, mt.happy - dt); mt.wow = Math.max(0, mt.wow - dt);
          const md: Mood = mt.wow > 0 ? 'wow' : mt.happy > 0 ? 'happy' : 'think';
          // Enzo is easier to impress than Dora
          sc.mood = { dora: md, enzo: md === 'think' && mt.wow + mt.happy === 0 && g.turns > 0 && (now / 1000) % 9 < 2 ? 'happy' : md };
          if (!sc.busy() && !g.over && !blocked.current) { idle.current += dt; if (idle.current > 8 && sc.cursor < 0 && sc.hover < 0) { const mv = g.findMove(); if (mv) sc.cursor = mv.t; } } else idle.current = 0;
          sc.frame(dt);
        }
        sound.current?.tickMusic();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setReady(true);
    }).catch(() => setError('The comb did not load. Try reloading the page.'));
    // watch the canvas itself: the bar appearing over it changes its size without changing the stage's
    const ro = new ResizeObserver(() => scene.current?.resize()); if (stage.current) ro.observe(stage.current); if (canvas.current) ro.observe(canvas.current);
    const hide = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', hide);
    const w = window as unknown as Record<string, unknown>;
    w.__honey = () => {
      const g = game.current, sc = scene.current;
      return { screen: screenRef.current, chamber: g?.ch.id ?? null, moves: g?.moves ?? 0, turns: g?.turns ?? 0, score: g?.score ?? 0, goals: g?.goals() ?? [], over: g?.over ?? null,
        busy: sc?.busy() ?? false, blocked: blocked.current, made: g?.made ?? 0, hover: sc?.hover ?? -1, cursor: sc?.cursor ?? -1, save: save.current };
    };
    /** Page coordinates of a trio's corner, for real mouse and touch play. */
    w.__honeyTrio = (t: number) => { const sc = scene.current, c = canvas.current; if (!sc || !c || !game.current) return null; const r = c.getBoundingClientRect(), p = sc.trioPoint(t); return [r.left + p.x, r.top + p.y]; };
    /** A turn that works right now. */
    w.__honeyMove = () => game.current?.findMove() ?? null;
    /** Every turn that works right now. */
    w.__honeyMoves = () => game.current?.allMoves() ?? [];
    /** The working turn that fills the most honey right now, for playing a chamber through in the browser suite. */
    w.__honeyBest = () => {
      const g = game.current; if (!g) return null;
      let best = null, bv = -Infinity;
      for (const m of g.allMoves()) { const c = g.clone(); c.turn(m.t, m.dir); const v = c.over?.won ? 1e6 : -c.goals().reduce((n, x) => n + x.left, 0); if (v > bv) { bv = v; best = m; } }
      return best;
    };
    /** A trio that turns but matches nothing (it springs back). */
    w.__honeyDud = () => { const g = game.current; if (!g) return -1; return g.comb.trios.findIndex((_, t) => g.canTurn(t) && !g.works(t, 1) && !g.works(t, -1)); };
    w.__honeyCursor = (t: number) => { if (scene.current) { scene.current.cursor = t; scene.current.hover = -1; } };
    w.__honeyScene = () => scene.current?.boxes() ?? null;
    w.__honeyEnding = () => { game.current = null; screenRef.current = 'ending'; setScreenState('ending'); };
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', o); document.removeEventListener('visibilitychange', hide); window.clearTimeout(resultT.current); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onStepRef = useRef(onStep); onStepRef.current = onStep;
  useEffect(() => { if (scene.current) scene.current.onStep = (s) => onStepRef.current(s); });
  // resize as soon as the bar is in the page (before the next paint or anything measures the comb), and again next frame
  useLayoutEffect(() => { scene.current?.resize(); requestAnimationFrame(() => scene.current?.resize()); }, [screen, orient, touch, result]);
  // the result card stands beside the comb (wide) or above it (upright): the scene makes room
  useEffect(() => {
    const sc = scene.current, card = resultCard.current, cv = canvas.current; if (!sc) return;
    if (!result || !card || !cv) { sc.reserve = { right: 0, top: 0 }; sc.resize(); return; }
    const box = card.offsetParent as HTMLElement | null;
    const tall = innerHeight > innerWidth * 1.05;
    sc.reserve = tall ? { right: 0, top: Math.max(0, card.offsetTop + card.offsetHeight - cv.offsetTop + 6) } : { right: Math.max(0, (box?.offsetWidth ?? 0) - card.offsetLeft + 10), top: 0 };
    sc.resize();
  }, [result, orient]);

  // ---- actions
  function turnTrio(t: number, dir: 1 | -1) {
    const g = game.current, sc = scene.current; if (!g || !sc || blocked.current || g.over) return;
    audio(); idle.current = 0; sc.cursor = sc.cursor === t ? t : -1;
    if (sc.busy()) { sc.hurry(); return; }
    const st = g.turn(t, dir);
    if (!st) { sound.current?.bounce(); showToast(g.comb.trios[t].cells.some((i) => g.cells[i].sticky) ? 'That drop is stuck in sticky honey.' : 'Wax and wasps won’t turn.', 1500); return; }
    sc.play(st); refresh();
  }
  const restart = () => { const g = game.current; if (!g) return; audio().ui(); start(g.ch.id); };
  function afterResult(kind: 'next' | 'again' | 'map') {
    const r = result; if (!r) return; audio().ui();
    if (kind === 'again') { start(r.id); return; }
    const ch = chamberById(r.id)!, i = CHAMBERS.findIndex((c) => c.id === r.id), nx = CHAMBERS[i + 1];
    const go = () => {
      if (kind === 'map') { setArea(nx && r.won && ch.set && chamberOpen(S, nx.id) ? nx.area : ch.area); leave('map'); return; }
      if (!nx && r.won) { if (!S.ended) { S.ended = true; persist(); } leave('ending'); return; }
      if (r.won && nx && chamberOpen(S, nx.id)) start(nx.id); else start(r.id);
    };
    if (r.won && ch.set) { setResult(null); tell(ch.area + '-out', go); } else go();
  }

  // ---- keyboard: arrows walk a cursor between corners; Space, Enter or X turns clockwise, Z anticlockwise
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (story && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); nextPage(); return; }
      if (tip && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); audio(); setTip(null); return; }
      const g = game.current, sc = scene.current;
      if (screenRef.current !== 'play' || !g || !sc) return;
      if (result) { if (e.key === 'Enter') { e.preventDefault(); afterResult(result.won ? 'next' : 'again'); } return; }
      const k = e.key.toLowerCase(), dirs: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
      if (dirs[k]) {
        e.preventDefault(); audio();
        const tr = g.comb.trios, cur = sc.cursor >= 0 ? sc.cursor : sc.hover >= 0 ? sc.hover : Math.floor(tr.length / 2), [dx, dy] = dirs[k];
        let best = cur, bd = Infinity;
        tr.forEach((t, j) => { const vx = t.x - tr[cur].x, vy = t.y - tr[cur].y, along = vx * dx + vy * dy, d = Math.hypot(vx, vy); if (j !== cur && along > 0.3 && along / d > 0.6 && d < bd) { bd = d; best = j; } });
        sc.cursor = best; sc.hover = -1; sound.current?.hover(); idle.current = 0;
      } else if ((k === ' ' || k === 'enter' || k === 'x' || k === 'e') && sc.cursor >= 0) { e.preventDefault(); turnTrio(sc.cursor, 1); }
      else if ((k === 'z' || k === 'q') && sc.cursor >= 0) { e.preventDefault(); turnTrio(sc.cursor, -1); }
      else if (k === 'r') restart();
      else if (k === 'escape') { audio().ui(); setArea(g.ch.area); leave('map'); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });

  // ---- pointer: click a corner to turn clockwise (right-click anticlockwise); a finger taps, or drags round the corner
  const local = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const press = useRef<{ id: number; type: string; x: number; y: number; t: number; button: number } | null>(null);
  function onMove(e: React.PointerEvent) {
    const sc = scene.current; if (!sc || screenRef.current !== 'play') return;
    if (e.pointerType === 'mouse' && !press.current) { const p = local(e), t = sc.pick(p.x, p.y); if (t !== sc.hover) { sc.hover = t; if (t >= 0) { sc.cursor = -1; sound.current?.hover(); } } }
  }
  function onDown(e: React.PointerEvent) {
    const sc = scene.current; if (!sc || screenRef.current !== 'play' || blocked.current) return;
    audio(); const p = local(e), t = sc.pick(p.x, p.y);
    press.current = { id: e.pointerId, type: e.pointerType, x: p.x, y: p.y, t, button: e.button };
    if (e.pointerType !== 'mouse' && t >= 0) { sc.cursor = t; sc.hover = -1; }
    try { canvas.current?.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }
  function onUp(e: React.PointerEvent) {
    const pr = press.current, sc = scene.current; press.current = null;
    if (!pr || !sc || pr.id !== e.pointerId || screenRef.current !== 'play' || blocked.current || pr.t < 0) return;
    const p = local(e), dx = p.x - pr.x, dy = p.y - pr.y;
    let dir: 1 | -1 = pr.type === 'mouse' && pr.button === 2 ? -1 : 1;
    if (Math.hypot(dx, dy) > 14) {
      // dragged: which way round the corner?
      const c = sc.trioPoint(pr.t), cross = (pr.x - c.x) * dy - (pr.y - c.y) * dx;
      dir = cross >= 0 ? 1 : -1;
    }
    if (pr.type !== 'mouse') sc.cursor = -1;
    turnTrio(pr.t, dir);
  }
  function onWheel(e: React.WheelEvent) { const sc = scene.current; if (!sc || sc.hover < 0 || Math.abs(e.deltaY) < 4) return; turnTrio(sc.hover, e.deltaY > 0 ? 1 : -1); }

  function nextPage() {
    const s = story; if (!s) return; audio().ui();
    if (s.i + 1 < STORY[s.key].length) setStory({ ...s, i: s.i + 1 }); else { setStory(null); s.then(); }
  }

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const s = audio(); if (k === 'sound') s.setSound(S.settings.sound); else s.setMusic(S.settings.music);
    refresh();
  };
  const Toggles = () => (
    <span className="hh-toggles">
      <button type="button" className={'hh-tog' + (S.settings.sound ? ' is-on' : '')} aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>Sound</button>
      <button type="button" className={'hh-tog' + (S.settings.music ? ' is-on' : '')} aria-pressed={S.settings.music} onClick={() => toggle('music')}>Music</button>
    </span>
  );

  const g = game.current, total = CHAMBERS.length * 3, stars = mounted ? starCount(S) : 0, nxt = mounted ? nextChamber(S) : null, ar = AREAS.find((a) => a.id === area)!;
  // the goals as the comb shows them (honey and moss follow the animation; the rest follow the engine)
  const shown = scene.current?.shown, goals = g ? g.goals().map((x) => {
    if (x.key === 'honey' && shown?.length === g.comb.n) return { ...x, left: Math.max(0, x.need - shown.filter((c) => c.honey).length) };
    if (x.key === 'moss' && shown?.length === g.comb.n) return { ...x, left: shown.filter((c) => c.moss).length };
    return x;
  }) : [];
  const page = story ? STORY[story.key][story.i] : null, storyArea = story ? (story.key.split('-')[0] as AreaId) : area;
  return (
    <main className="hh-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-orient={orient}>
      {screen === 'menu' && (
        <section className="hh-menu">
          <Art src="/art/honey/title.webp" paint="title" w={1536} h={1024} className="hh-menu-art" />
          <div className="hh-menu-card">
            <p className="hh-eyebrow">A HEX MATCH-3 PUZZLE ADVENTURE</p>
            <h1>Honeycomb Hollow</h1>
            <p className="hh-lede">The bees of the hollow oak have lost the queen’s honey map. Turn the nectar drops three at a time, line up their colours, and fill the comb with honey, chamber by chamber.</p>
            <div className="hh-menu-buttons">
              <button type="button" className="hh-primary" disabled={!ready} onClick={() => { audio().ui(); start(nxt ?? CHAMBERS[0].id); }}>
                {mounted && Object.keys(S.best).length ? (nxt ? `Continue · Chamber ${chamberNo(nxt)} ${chamberById(nxt)!.name}` : 'Play again') : 'Start filling'}
              </button>
              <button type="button" onClick={() => { audio().ui(); setArea(nxt ? areaOf(nxt) : 'clover'); setScreen('map'); song('menu'); }}>The chambers · {stars}/{total} ★</button>
            </div>
            <p className="hh-note">{mounted ? `${Object.keys(S.best).length} of ${CHAMBERS.length} chambers filled` : ' '}</p>
            <div className="hh-menu-foot"><a className="hh-back" href="/">← MAIN ARCADE</a><Toggles /></div>
          </div>
        </section>
      )}

      {screen === 'map' && (
        <section className="hh-map">
          <FramedWindow area={area} className="hh-map-art" />
          <header className="hh-bar">
            <button type="button" className="hh-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button>
            <span className="hh-bar-mid">The chambers · {stars}/{total} ★</span>
            <Toggles />
          </header>
          <nav className="hh-tabs" aria-label="Areas">
            {AREAS.map((a, i) => (
              <button type="button" key={a.id} className={'hh-tab' + (a.id === area ? ' is-on' : '')} disabled={!areaOpen(S, a.id)} onClick={() => { audio().ui(); setArea(a.id); }}>
                <b>{i + 1}</b> {a.name} <small>{areaChambers(a.id).reduce((n, c) => n + (S.best[c.id]?.stars ?? 0), 0)}/36</small>
              </button>
            ))}
          </nav>
          <div className="hh-map-body">
            <div className="hh-friend"><Cut name={`bee-${ar.friend}`} /><p><b>{ar.friendName}</b> {ar.blurb}</p></div>
            <div className="hh-cards">
              {areaChambers(area).map((ch) => {
                const open = chamberOpen(S, ch.id), b = S.best[ch.id];
                return (
                  <button type="button" key={ch.id} className={'hh-card' + (b ? ' is-done' : '') + (ch.set ? ' is-set' : '')} disabled={!open} onClick={() => { audio().ui(); start(ch.id); }}>
                    <span className="hh-card-no">Chamber {chamberNo(ch.id)}</span>
                    <span className="hh-card-name">{ch.name}</span>
                    <span className="hh-card-stars" aria-label={`${b?.stars ?? 0} stars`}>{[1, 2, 3].map((k) => <i key={k} className={(b?.stars ?? 0) >= k ? 'on' : ''}>★</i>)}</span>
                    <span className="hh-card-goal">{open ? `${ch.moves} turns · ${goalIcons(ch.id)}` : '🔒 locked'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className={'hh-stage' + (screen === 'play' ? '' : ' is-hidden')} ref={stage}>
        {screen === 'play' && g && (
          <header className="hh-bar">
            <button type="button" className="hh-back" onClick={() => { audio().ui(); setArea(g.ch.area); leave('map'); }}>← MAP</button>
            <span className="hh-bar-mid">
              <span className="hh-name"><small>{label(g.ch.id)}</small> {g.ch.name}</span>
              {goals.map((x) => <span key={x.key} className={'hh-goal' + (x.left <= 0 ? ' is-met' : '')} title={GOAL[x.key].name}>{GOAL[x.key].icon} <b>{x.left <= 0 ? '✓' : x.left}</b></span>)}
              <span className={'hh-moves' + (g.moves <= 3 && !g.over ? ' is-low' : '')} title="Turns left"><b>{g.moves}</b><small>turns</small></span>
            </span>
            <button type="button" className="hh-back hh-restart" onClick={restart} disabled={!g.turns || !!result} title="Restart (R)" aria-label="Restart">⟲</button>
            <Toggles />
          </header>
        )}
        <canvas ref={canvas} className="hh-canvas" tabIndex={0} aria-label="The honeycomb"
          onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { press.current = null; }} onPointerLeave={() => { if (scene.current) scene.current.hover = -1; }} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && toast && !result && <p className="hh-toast" role="status">{toast}</p>}
        {screen === 'play' && result && (
          <div className="hh-result" role="dialog" aria-label={result.won ? 'Chamber filled' : 'Out of turns'}>
            <div className={'hh-result-card s' + result.stars} ref={resultCard}>
              <p className="hh-eyebrow">CHAMBER {chamberNo(result.id)} · {chamberById(result.id)!.name.toUpperCase()}</p>
              {result.won && <p className="hh-stars" aria-label={`${result.stars} stars`}>{[1, 2, 3].map((k) => <i key={k} className={result.stars >= k ? 'on' : ''}>★</i>)}</p>}
              <h2>{result.won ? WIN[result.stars][result.score % WIN[result.stars].length] : LOSE[result.score % LOSE.length]}</h2>
              <ul className="hh-goals">
                {result.won ? <>
                  <li className="ok">Turns to spare <small>{result.left}</small></li>
                  <li className="ok">Honey score <small>{result.score.toLocaleString('en-GB')}{result.better && !result.first ? ' · best!' : ''}</small></li>
                  <li>★★ with {chamberById(result.id)!.stars[0]} spare · ★★★ with {chamberById(result.id)!.stars[1]}</li>
                </> : result.goals.filter((x) => x.left > 0).map((x) => <li key={x.key}>{GOAL[x.key].icon} {x.left} {GOAL[x.key].name}</li>)}
              </ul>
              <div className="hh-result-buttons">
                {result.won
                  ? <button type="button" className="hh-primary" autoFocus onClick={() => afterResult('next')}>{CHAMBERS.at(-1)!.id === result.id ? 'The map is whole' : 'Next chamber'}</button>
                  : <button type="button" className="hh-primary" autoFocus onClick={() => afterResult('again')}>Try again</button>}
                {result.won && <button type="button" onClick={() => afterResult('again')}>Play again</button>}
                <button type="button" onClick={() => afterResult('map')}>Map</button>
              </div>
            </div>
          </div>
        )}
        {tip && screen === 'play' && !story && (
          <div className="hh-tip" role="dialog" aria-label={tip.title}>
            <div className="hh-tip-card"><h2>{tip.title}</h2><p>{tip.text}</p>
              {!touch && <p className="hh-keys">Click a corner to turn clockwise · right-click or the wheel turns back · or <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> to pick a corner, <kbd>X</kbd> / <kbd>Z</kbd> to turn · <kbd>R</kbd> restarts</p>}
              {touch && <p className="hh-keys">Tap a corner to turn it clockwise, or drag round the corner to turn it the way you drag.</p>}
              <button type="button" className="hh-primary" autoFocus onClick={() => { audio().ui(); setTip(null); }}>Let’s make honey</button></div>
          </div>
        )}
      </div>

      {story && page && (
        <section className="hh-story" role="dialog" aria-label="Story" onClick={nextPage}>
          <FramedWindow area={storyArea} className="hh-story-art" />
          <div className="hh-story-cast">
            <span className={'hh-story-pair' + (page.who === 'dora' || page.who === 'enzo' ? ' is-talking' : '')}>
              <Cut name={page.who === 'dora' ? 'dora-happy' : 'dora-think'} className={'hh-story-dora' + (page.who === 'dora' ? ' is-on' : '')} />
              <Cut name={page.who === 'enzo' ? 'enzo-happy' : 'enzo-think'} className={'hh-story-enzo' + (page.who === 'enzo' ? ' is-on' : '')} />
            </span>
            <Cut name={`bee-${AREAS.find((a) => a.id === storyArea)!.friend}`} className={'hh-story-bee' + (page.who !== 'dora' && page.who !== 'enzo' ? ' is-on' : '')} />
          </div>
          <div className="hh-bubble">
            <p className="hh-bubble-who">{NAMES[page.who]}</p>
            <p>{page.text}</p>
            <button type="button" className="hh-primary" autoFocus onClick={(e) => { e.stopPropagation(); nextPage(); }}>{story.i + 1 < STORY[story.key].length ? 'Next' : 'On we go'}</button>
          </div>
        </section>
      )}

      {screen === 'ending' && (
        <section className="hh-ending">
          <Art src="/art/honey/ending.webp" paint="ending" w={1536} h={1024} className="hh-ending-art" />
          <div className="hh-ending-card">
            <p className="hh-eyebrow">THE MAP IS WHOLE</p>
            <h2>The oak glows gold</h2>
            <p>The last cell fills, and the queen’s honey map shines out of the wax. Light runs up the trunk from the Clover Hall to the Queen’s Chamber until the whole hollow oak glows gold, and every bee in the colony comes out to dance for Dora and Enzo.</p>
            <p className="hh-note">{Object.keys(S.best).length} of {CHAMBERS.length} chambers · {stars} of {total} stars</p>
            <div className="hh-menu-buttons">
              <button type="button" className="hh-primary" onClick={() => { audio().ui(); setArea('clover'); setScreen('map'); song('menu'); }}>The chambers</button>
              <a className="hh-back" href="/">← MAIN ARCADE</a>
            </div>
          </div>
        </section>
      )}
      {error && <p className="hh-error">{error}</p>}
    </main>
  );
}

function goalIcons(id: string) {
  const ch = chamberById(id)!, m = ch.map.join('');
  return ['🍯', m.includes('b') ? '🐝' : '', ch.goals.acorns || m.includes('a') ? '🌰' : '', ch.goals.moss ? '🌿' : '', m.includes('o') ? '💧' : '', m.includes('x') ? '⚠️' : ''].filter(Boolean).join(' ');
}
