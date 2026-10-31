'use client';

import { useEffect, useRef, useState } from 'react';
import { Hop, DT, type Stage, type Ev, type Input } from '@/lib/orbit-game';
import {
  STAGES, STAGE, SKIES, SAVE_KEY, FINALE, STARLIGHT_SKY, skyStages, readSave, freshSave, stageOpen, skyOpen, skyStars, starlightOpen, gardenOpen,
  starsOf, totalStars, medals, homeCount, nextStage, record, gardenField, type Save, type Outcome,
} from '@/lib/orbit-levels';
import type { OrbitScene } from '@/lib/orbit-scene';
import { OrbitSound, type SongId } from './sound';
import './orbit.css';

type Screen = 'menu' | 'map' | 'play';
type Mode = 'story' | 'starlight' | 'garden';
type Done = { out: Outcome | null; leaps: number; time: number; gold: boolean; garden: number };
const sceneModule = () => import('@/lib/orbit-scene');
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

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
    <span className={'mh-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A stage's little island of moons, for the sky map. */
function Thumb({ st, done }: { st: Stage; done: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false, tries = 0, timer = 0;
    const paint = () => sceneModule().then((m) => { if (!dead && cv.current) m.paintThumb(cv.current, st, done); }).catch(() => {});
    // paint now, and again as the moon paintings arrive
    const again = () => { void paint(); if (++tries < 4) timer = window.setTimeout(again, 700); };
    again();
    return () => { dead = true; window.clearTimeout(timer); };
  }, [st, done]);
  return <canvas ref={cv} className="mh-thumb" width={300} height={190} aria-hidden="true" />;
}
const Stars = ({ s, big }: { s: [boolean, boolean, boolean]; big?: boolean }) => (
  <span className={'mh-stars' + (big ? ' is-big' : '')} aria-label={`${s.filter(Boolean).length} of 3 stars`}>{s.map((on, i) => <i key={i} className={on ? 'is-on' : ''}>{on ? '★' : '☆'}</i>)}</span>
);

export default function OrbitPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), tools = useRef<HTMLDivElement>(null);
  const scene = useRef<OrbitScene | null>(null), sound = useRef<OrbitSound | null>(null);
  const save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), hop = useRef<Hop | null>(null), mode = useRef<Mode>('story'), gardenLevel = useRef(1);
  const keys = useRef({ left: false, right: false, up: false, down: false, jump: false });
  const ptr = useRef<{ down: boolean; x: number; y: number; over: boolean }>({ down: false, x: 0, y: 0, over: false });
  // a press in mid-air that was let go again before the next step still puffs: 'key' for Space, 'ptr' for a click or tap
  const tap = useRef<'' | 'key' | 'ptr'>('');
  const acc = useRef(0), paused = useRef(false), lookRef = useRef(false), toastTimer = useRef(0), panelTimer = useRef(0), lastCharge = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [sky, setSky] = useState(1), [starMode, setStarMode] = useState(false);
  const [done, setDone] = useState<Done | null>(null), [tip, setTip] = useState<{ title: string; text: string } | null>(null), [toast, setToast] = useState('');
  const [ending, setEnding] = useState(false), [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouchState] = useState(false), [look, setLook] = useState(false), touchRef = useRef(false);
  const setTouch = (on: boolean) => { touchRef.current = on; setTouchState(on); };
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new OrbitSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3200) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const music = (id: SongId) => sound.current?.music(id);
  const setLookOn = (on: boolean) => { lookRef.current = on; setLook(on); };

  // ---------------------------------------------------------------- a stage: open it, play it, finish it
  function openStage(st: Stage, m: Mode = 'story') {
    if (m !== 'garden' && !stageOpen(save.current, st.id)) return;
    if (m === 'starlight' && !starlightOpen(save.current)) return;
    audio().ui();
    mode.current = m; hop.current = new Hop(st); acc.current = 0; lastCharge.current = 0;
    keys.current = { left: false, right: false, up: false, down: false, jump: false }; ptr.current.down = false;
    window.clearTimeout(panelTimer.current);
    setDone(null); setToast(''); setLookOn(false);
    scene.current?.setStage(st, st.sky >= 1 ? st.sky : 1 + (gardenLevel.current % 5));
    if (st.sky >= 1) setSky(st.sky);
    setScreen('play'); music('sky');
    if (sound.current) sound.current.layers = 0;
    const s = save.current;
    if (m === 'story' && st.teach && !s.seen.includes(st.id)) { setTip(st.teach); s.seen.push(st.id); persist(); } else setTip(null);
    requestAnimationFrame(() => { layout(); canvas.current?.focus(); });
    refresh();
  }
  function openGarden(level = save.current.garden.level) { gardenLevel.current = level; openStage(gardenField(level).stage, 'garden'); }
  function restart() { const h = hop.current; if (!h || h.done) return; openStage(h.s, mode.current); }
  /** What the game just did: sounds, sparkles and words. */
  function drain(evs: Ev[]) {
    const h = hop.current; if (!h || !evs.length) return;
    scene.current?.feed(evs, h);
    const a = sound.current;
    for (const e of evs) {
      if (e.k === 'leap') a?.leap(e.power);
      else if (e.k === 'land') a?.land(e.kind, e.speed);
      else if (e.k === 'bounce') a?.bounce(h.s.moons[e.moon].kind === 'bean');
      else if (e.k === 'puff') a?.puff();
      else if (e.k === 'fly') { a?.firefly(h.total() - e.left - 1, e.gold); if (a) a.layers = Math.min(4, Math.ceil(((h.total() - e.left) / Math.max(1, h.total())) * 4)); if (e.gold) showToast('✨ The golden firefly!', 2200); }
      else if (e.k === 'open') { a?.open(); showToast('🏮 Every firefly found: the home lantern is open!', 3000); }
      else if (e.k === 'locked') { a?.locked(); showToast(`The lantern needs every firefly first: ${e.left} still out there.`, 2600); }
      else if (e.k === 'lost') { a?.lost(); }
      else if (e.k === 'back') { a?.back(); showToast('Boing! The lantern string pulled them back.', 1800); }
      else if (e.k === 'hole') a?.hole();
      else if (e.k === 'home') finish();
    }
    refresh();
  }
  function finish() {
    const h = hop.current, sv = save.current; if (!h) return;
    const r = h.result(); let out: Outcome | null = null, garden = 0;
    if (mode.current === 'garden') { garden = gardenLevel.current; sv.garden.best = Math.max(sv.garden.best, garden); sv.garden.level = garden + 1; }
    else out = record(sv, h.s, r, mode.current === 'starlight');
    persist();
    audio().home(out ? out.stars.filter(Boolean).length : 3);
    window.clearTimeout(panelTimer.current);
    const info: Done = { out, leaps: r.leaps, time: r.time, gold: h.goldGot(), garden };
    panelTimer.current = window.setTimeout(() => { setDone(info); refresh(); }, 1700);
    layout();
  }
  function nextAfter() {
    const h = hop.current, sv = save.current; if (!h) return;
    if (mode.current === 'garden') { openGarden(sv.garden.level); return; }
    if (h.s.id === FINALE && !sv.ended && mode.current === 'story') { sv.ended = true; persist(); setDone(null); setEnding(true); music('ending'); toMap(); return; }
    const i = STAGES.findIndex((x) => x.id === h.s.id), n = STAGES[i + 1];
    if (n && stageOpen(sv, n.id) && (mode.current !== 'starlight' || n.sky <= 5)) openStage(n, mode.current); else toMap();
  }
  function toMap() { hop.current = null; scene.current?.setStage(null, sky); setDone(null); setTip(null); window.clearTimeout(panelTimer.current); setScreen('map'); music('menu'); refresh(); }
  function toMenu() { hop.current = null; scene.current?.setStage(null, sky); setDone(null); setTip(null); window.clearTimeout(panelTimer.current); setScreen('menu'); music('menu'); refresh(); }

  /** The stage's clear area, so the scene frames the moons above the tools. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el || !sc) return;
    sc.resize();
    const r = el.getBoundingClientRect(), t = tools.current?.getBoundingClientRect(), tall = r.height > r.width * 1.05;
    // on wide screens the done card comes in at the side (see .mh-done in orbit.css): from the moment they are home,
    // frame the cheering pair in the sky beside it
    // (and on phones held upright it comes up from the bottom: frame them above it)
    const home = !!hop.current?.done, side = home && window.matchMedia?.('(min-aspect-ratio: 21/20)').matches;
    const card = home && tall ? el.querySelector('.mh-done')?.getBoundingClientRect() : null;
    // the edge markers keep clear of the hint (as wide as its longest line can be, centred) and the tools
    const cv = canvas.current?.getBoundingClientRect(), hint = el.querySelector('.mh-hint')?.getBoundingClientRect();
    const avoid: [number, number, number, number][] = [];
    if (cv && hint && hint.height > 0) { const w = Math.min(540, cv.width); avoid.push([(cv.width - w) / 2, hint.top - cv.top, w, hint.height]); }
    if (cv && t && t.height > 0) avoid.push([t.left - cv.left, t.top - cv.top, t.width, t.height]);
    sc.avoid = avoid;
    sc.inset = { top: 0, left: 0, right: side ? (window.innerHeight > 520 ? Math.min(400, r.width * 0.4) + 30 : Math.min(380, r.width * 0.44) + 18) : 0, bottom: card && card.height > 0 ? card.height + 16 : tall && t && t.height > 0 ? Math.max(0, r.bottom - t.top + 6) : 0 };
  }
  /** What the player is holding right now, as the game's input. */
  function input(): Input {
    const k = keys.current, p = ptr.current, sc = scene.current, cv = canvas.current;
    const tapped = hop.current?.mode === 'fly' ? tap.current : '';
    tap.current = '';
    let point: [number, number] | null = null;
    if ((p.down || tapped === 'ptr') && sc && cv) { const b = cv.getBoundingClientRect(); point = sc.toWorld(p.x - b.left, p.y - b.top); }
    return { left: k.left, right: k.right, up: k.up, down: k.down, jump: k.jump || p.down || !!tapped, point };
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse); setMounted(true);
    const n = nextStage(save.current); setSky(n ? n.sky : 5);
    refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__orbit = () => ({ screen: screenRef.current, mode: mode.current, stage: hop.current?.s.id ?? null, h: hop.current, save: save.current, look: lookRef.current, paused: paused.current, garden: gardenLevel.current });
    w.__orbitOpen = (id: string, m: Mode = 'story') => { const st = STAGE[id]; if (st) openStage(st, m); };
    w.__orbitGarden = (level: number) => openGarden(level);
    w.__orbitPoint = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(), [sx, sy] = sc.toScreen(x, y); return [b.left + sx, b.top + sy]; };
    w.__orbitScene = () => scene.current?.metrics() ?? null;
    let dead = false, raf = 0, last = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.OrbitScene(canvas.current); } catch { setError('This browser cannot draw the sky.'); return; }
      for (let i = 1; i <= 5; i++) m.want('sky-' + i);
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const h = hop.current, sc = scene.current!;
        if (screenRef.current === 'play' && h) {
          const hold = !!document.querySelector('.mh-card');
          paused.current = hold;
          if (!hold) {
            acc.current += dt;
            let n = 0; const evs: Ev[] = [];
            while (acc.current >= DT && n++ < 14) { acc.current -= DT; h.tick(input()); if (h.events.length) evs.push(...h.events.splice(0)); }
            if (evs.length) drain(evs);
            // the charging hum
            if (h.mode === 'stand' && h.charge > 0) { if (h.charge >= 1 && lastCharge.current < 1) sound.current?.full(); else if (h.charge > lastCharge.current) sound.current?.charge(h.charge); }
            lastCharge.current = h.charge;
          }
          const showPath = mode.current !== 'starlight' && h.mode === 'stand' && h.charge > 0;
          let aim: number | null = null;
          const pp = ptr.current, cv = canvas.current;
          if (pp.over && !pp.down && !touchRef.current && h.mode === 'stand' && cv) { const b = cv.getBoundingClientRect(), [wx, wy] = sc.toWorld(pp.x - b.left, pp.y - b.top); aim = Math.atan2(wy - h.my[h.moon], wx - h.mx[h.moon]); }
          sc.draw({ dt, h, preview: showPath ? h.preview(h.s.preview) : null, look: lookRef.current, aim, starlight: mode.current === 'starlight' });
          if (mode.current === 'starlight' && !h.done && Math.floor(h.t * 10) !== Math.floor((h.t - dt) * 10)) refresh();
        }
        sound.current?.tick(true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The sky could not load. Please refresh.'));

    const setKey = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase(), K = keys.current;
      if (k === 'arrowleft' || k === 'a') K.left = on;
      else if (k === 'arrowright' || k === 'd') K.right = on;
      else if (k === 'arrowup' || k === 'w') K.up = on;
      else if (k === 'arrowdown' || k === 's') K.down = on;
      else if (k === ' ' || k === 'spacebar' || k === 'j') K.jump = on;
      else return false;
      return true;
    };
    const keydown = (e: KeyboardEvent) => {
      if (screenRef.current !== 'play' || !hop.current) return;
      const k = e.key.toLowerCase(), tgt = e.target as HTMLElement, h = hop.current;
      if (k === 'escape') { e.preventDefault(); if (mode.current === 'garden') toMenu(); else toMap(); return; }
      if (document.querySelector('.mh-card')) return;
      if (h.done) { if (k === 'enter' && document.querySelector('.mh-done')) { e.preventDefault(); nextAfter(); } return; }
      if (tgt.closest?.('button, a, input') && (k === 'enter' || k === ' ')) return;
      if (k === 'r') { e.preventDefault(); restart(); return; }
      if (k === 'l' || k === 'shift') { e.preventDefault(); if (!e.repeat) setLookOn(k === 'shift' ? true : !lookRef.current); return; }
      if (setKey(e, true)) { e.preventDefault(); audio(); if (keys.current.jump && !e.repeat) tap.current = 'key'; }
    };
    const keyup = (e: KeyboardEvent) => { if (e.key === 'Shift') setLookOn(false); if (setKey(e, false)) e.preventDefault(); };
    const blur = () => { keys.current = { left: false, right: false, up: false, down: false, jump: false }; ptr.current.down = false; sound.current?.suspend(); };
    const focusIn = () => { if (!document.hidden) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focusIn(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur); window.addEventListener('focus', focusIn); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect(); window.clearTimeout(toastTimer.current); window.clearTimeout(panelTimer.current);
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focusIn); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, touch, tip, done]);

  // ---------------------------------------------------------------- the pointer: hold where you want to leap, let go
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || !hop.current || tip) return;
    audio();
    if (e.pointerType !== 'mouse' && !touchRef.current) setTouch(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
    ptr.current = { down: true, x: e.clientX, y: e.clientY, over: true }; tap.current = 'ptr';
  };
  const onMove = (e: React.PointerEvent) => { ptr.current.x = e.clientX; ptr.current.y = e.clientY; ptr.current.over = true; };
  const onUp = () => { ptr.current.down = false; };

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="mh-chips">
      <button className="mh-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="mh-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  const h = hop.current, st = h?.s ?? null;
  const starsN = mounted ? totalStars(S) : 0, homeN = mounted ? homeCount(S) : 0, medalN = mounted ? medals(S) : 0;
  const nextUp = mounted ? nextStage(S) : null, started = mounted && homeN > 0;
  const slOpen = mounted && starlightOpen(S), gOpen = mounted && gardenOpen(S);
  const where = !st ? '' : mode.current === 'garden' ? `MOON GARDEN · FIELD ${gardenLevel.current}` : `${mode.current === 'starlight' ? '✦ STARLIGHT · ' : ''}${SKIES[st.sky - 1].name.toUpperCase()} · ${st.index + 1} OF 8`;
  const flyN = h ? h.total() - h.needed() : 0;
  const keyHelp = <><kbd>←</kbd><kbd>→</kbd> walk · hold <kbd>Space</kbd>, let go to leap · <kbd>Space</kbd> in the air to puff (aim with arrows) · <kbd>L</kbd> look · <kbd>R</kbd> restart · <kbd>Esc</kbd> map</>;

  return (
    <main className="mh-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? 'true' : undefined} data-sky={st ? Math.max(1, st.sky) : sky}>
      {screen === 'play' && st && h && (
        <header className="mh-bar">
          <button className="mh-back" onClick={() => (mode.current === 'garden' ? toMenu() : toMap())}>← {mode.current === 'garden' ? 'MENU' : 'SKY MAP'}</button>
          <span className="mh-bar-mid"><small>{where}</small> <b className="mh-name">{st.name}</b></span>
          <span className="mh-pills">
            <span className="mh-pill" title="Fireflies gathered" data-testid="flies">✦ <b>{flyN}</b>/{h.total()}{h.hasGold() ? <i className={'mh-gold' + (h.goldGot() ? ' is-on' : '')} title="The golden firefly">●</i> : null}</span>
            {mode.current === 'starlight' ? <span className="mh-pill" data-testid="time">⏱ <b>{fmt(h.t)}</b><small> / {fmt(st.parTime)}</small></span>
              : mode.current === 'story' ? <span className="mh-pill" title="Leaps (and the par for the third star)" data-testid="leaps">🌙 <b>{h.leaps}</b><small>/{st.par}</small></span> : null}
          </span>
        </header>
      )}
      <div className="mh-stage" ref={stage}>
        <canvas ref={canvas} className="mh-canvas" tabIndex={0} data-testid="sky"
          aria-label="The sky of little moons. Point and hold where you want to leap from, then let go. Click in the air to puff."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !ptr.current.down) ptr.current.over = false; }} onContextMenu={(e) => e.preventDefault()} />

        {screen === 'play' && h && st && !done && (<>
          {!h.done && <p className="mh-hint" role="status">{h.mode === 'fly' ? (h.puffs > 0 ? (touch ? 'Tap the way to puff.' : 'Click the way to puff (or Space).') : 'Puff used: it comes back when you land.') : h.charge > 0 ? (h.charge >= 1 ? 'Full power! Let go to leap.' : 'Let go to leap.') : touch ? 'Hold where you want to leap from, then let go.' : 'Point and hold where you want to leap from, then let go.'}</p>}
          <div className="mh-tools" ref={tools} role="toolbar" aria-label="Tools">
            <button className={'mh-btn' + (look ? ' is-on' : '')} aria-pressed={look} onClick={() => { audio().ui(); setLookOn(!lookRef.current); canvas.current?.focus(); }} title="See the whole sky (L)">👁<small>Look</small></button>
            <button className="mh-btn" onClick={() => { audio().ui(); restart(); canvas.current?.focus(); }} disabled={h.done} aria-label="Restart" title="Start the stage again (R)">↺<small>Again</small></button>
          </div>
        </>)}

        {tip && screen === 'play' && (
          <div className="mh-card" role="dialog" aria-label={tip.title}>
            <p className="mh-eyebrow">✦ SOMETHING NEW</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="mh-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
        {toast && screen === 'play' && <p className="mh-toast" role="status">{toast}</p>}

        {screen === 'play' && done && st && (
          <div className="mh-panel mh-done" role="dialog" aria-label="Home">
            <p className="mh-eyebrow">{mode.current === 'garden' ? `MOON GARDEN · FIELD ${done.garden}` : mode.current === 'starlight' ? '✦ STARLIGHT' : 'HOME BY LANTERN-LIGHT'}</p>
            <h2>{st.name}</h2>
            {st.story && mode.current === 'story' && <p className="mh-story">{st.story}</p>}
            {done.out && <>
              <Stars s={done.out.stars} big />
              <ul className="mh-checks">
                <li className="is-on">★ Home, with every firefly</li>
                <li className={done.out.stars[1] ? 'is-on' : ''}>{done.out.stars[1] ? '★' : '☆'} The golden firefly</li>
                <li className={done.out.stars[2] ? 'is-on' : ''}>{done.out.stars[2] ? '★' : '☆'} Home in {st.par} leaps or fewer <small>({done.leaps} this time)</small></li>
              </ul>
              {mode.current === 'starlight' && <p className={'mh-medal' + (done.out.medal ? ' is-on' : '')}>{done.out.medal ? `🏅 Starlight medal: ${fmt(done.time)}` : `⏱ ${fmt(done.time)}: home within ${fmt(st.parTime)} for the medal`}</p>}
              {done.out.newStars > 0 && done.out.stars.filter(Boolean).length > 0 && starsOf(S, st.id) < 3 && mode.current === 'story' && <p className="mh-earn">Come back for the {starsOf(S, st.id) === 1 ? 'other stars' : 'last star'} any time.</p>}
              {done.out.skyDone && st.sky < 5 && <p className="mh-earn">🌙 {SKIES[st.sky - 1].name} is done: {SKIES[st.sky].name} opens.</p>}
              {done.out.skyDone && st.sky === 1 && <p className="mh-earn">🌱 The Moon Garden is open on the menu.</p>}
              {done.out.skyDone && st.sky === STARLIGHT_SKY && <p className="mh-earn">✦ Starlight mode is open: no dotted path, and a medal for speed.</p>}
            </>}
            {mode.current === 'garden' && <p className="mh-earn">🌱 Field {done.garden} grown and gathered · best {S.garden.best}</p>}
            <div className="mh-row">
              <button className="mh-go" autoFocus onClick={nextAfter}>{mode.current === 'garden' ? 'Next field →' : st.id === FINALE && !S.ended && mode.current === 'story' ? 'Bring the lantern home →' : 'Next →'}</button>
              <button className="mh-alt" onClick={() => openStage(st, mode.current)}>↺ Again</button>
              {mode.current !== 'garden' && <button className="mh-alt" onClick={() => { audio().ui(); toMap(); }}>🗺 Map</button>}
            </div>
          </div>
        )}
      </div>
      {error && <div className="mh-panel mh-error"><h2>One moment…</h2><p>{error}</p></div>}

      {/* ---------------------------------------------------------------- the menu */}
      {screen === 'menu' && (
        <section className="mh-menu" aria-label="Moonhop">
          <header className="mh-head"><a href="/" className="mh-back">← ARCADE</a>{settings}</header>
          <div className="mh-hero">
            <Art src="/art/orbit/title.webp" paint="title" w={1536} h={1024} className="mh-hero-art" />
            <div><p className="mh-eyebrow">A COSY GRAVITY-SLINGSHOT GAME</p><h1>Moon<em>hop</em></h1>
              <p className="mh-lede">Dora and Enzo’s paper-lantern balloon has drifted up past the clouds into a sky of tiny moons, and the fireflies that light it home have wandered off. Hop from moon to moon, holding paws, and gather them. Every moon pulls: leaps curve, slingshot and swing round.</p></div>
          </div>
          <div className="mh-go-row">
            <button className="mh-go" disabled={!ready} onClick={() => { const n = nextStage(save.current); if (n) openStage(n); else { audio().ui(); setScreen('map'); music('menu'); } }}>
              {!ready ? 'The moons are rising…' : started ? 'CONTINUE →' : 'BEGIN →'}<small>{mounted ? (nextUp ? `${SKIES[nextUp.sky - 1].name} · ${nextUp.name}` : 'every stage is home') : ' '}</small>
            </button>
            <button className="mh-alt" disabled={!ready} onClick={() => { audio().ui(); setStarMode(false); setScreen('map'); music('menu'); }}>🗺 Sky map<small>★ {starsN}/{STAGES.length * 3}</small></button>
            <button className="mh-alt" disabled={!ready || !slOpen} onClick={() => { audio().ui(); setStarMode(true); setScreen('map'); music('menu'); }}>✦ Starlight<small>{slOpen ? `🏅 ${medalN}/${STAGES.length} · no dotted path` : `after ${SKIES[STARLIGHT_SKY - 1].name}`}</small></button>
            <button className="mh-alt" disabled={!ready || !gOpen} onClick={() => openGarden()}>🌱 Moon Garden<small>{gOpen ? `field ${S.garden.level} · best ${S.garden.best}` : `after ${SKIES[0].name}`}</small></button>
            {mounted && S.ended && <button className="mh-alt" onClick={() => { audio().ui(); setEnding(true); music('ending'); }}>🏮 The ending</button>}
          </div>
          <ol className="mh-how" aria-label="How to play">
            <li><b>🐾 Walk and leap.</b> Point and hold on the side of the moon you want to leap from: they walk there, crouch, and the ring fills. Let go to leap straight off the surface.</li>
            <li><b>🌙 Every moon pulls.</b> Leaps curve round moons, big ones most of all. Watch the dotted path while you hold.</li>
            <li><b>☁ One puff.</b> In the air, click or tap the way you want to go for a little nudge. Landing refills it.</li>
            <li><b>✦ Fireflies.</b> Gather every one to open the home lantern, then land on its moon. ★ for home, ★ for the golden firefly, ★ for home within the leap par.</li>
          </ol>
          {!touch && <p className="mh-keys">{keyHelp}</p>}
        </section>
      )}

      {/* ---------------------------------------------------------------- the sky map */}
      {screen === 'map' && (
        <section className="mh-menu mh-map" aria-label="The sky map">
          <header className="mh-head"><button className="mh-back" onClick={toMenu}>← MENU</button><b className="mh-total">★ {starsN}/{STAGES.length * 3}{slOpen ? ` · 🏅 ${medalN}` : ''}</b>{settings}</header>
          <nav className="mh-tabs" aria-label="Skies">
            {SKIES.map((k) => {
              const open = mounted && skyOpen(S, k.n);
              return <button key={k.n} className={'mh-tab' + (sky === k.n ? ' is-on' : '')} disabled={!open} aria-pressed={sky === k.n} onClick={() => { audio().ui(); setSky(k.n); }}>{k.name}<small>{open ? `★ ${skyStars(S, k.n)}/24` : '🔒'}</small></button>;
            })}
          </nav>
          {slOpen && <div className="mh-modes" role="radiogroup" aria-label="Mode">
            <button className={'mh-chip' + (!starMode ? ' is-on' : '')} role="radio" aria-checked={!starMode} onClick={() => { audio().ui(); setStarMode(false); }}>🌙 Story</button>
            <button className={'mh-chip' + (starMode ? ' is-on' : '')} role="radio" aria-checked={starMode} onClick={() => { audio().ui(); setStarMode(true); }}>✦ Starlight: no dotted path, a medal for speed</button>
          </div>}
          <div className="mh-skyhead" style={{ ['--sky' as string]: `url(/art/orbit/sky-${sky}.webp)` }}><small>SKY {sky} OF 5</small><h2>{SKIES[sky - 1].name}</h2><p>{SKIES[sky - 1].blurb}</p></div>
          <div className="mh-grid">
            {skyStages(sky).map((q) => {
              const open = mounted && stageOpen(S, q.id), rec = mounted ? S.stages[q.id] : undefined;
              return (
                <button key={q.id} className={'mh-cell' + (rec ? ' is-done' : '') + (open && !rec ? ' is-next' : '')} disabled={!ready || !open} onClick={() => openStage(q, starMode ? 'starlight' : 'story')} aria-label={q.name}>
                  <Thumb st={q} done={!!rec} />
                  <b>{q.index + 1} · {open ? q.name : '· · ·'}</b>
                  <small>{rec ? <><Stars s={rec.s} />{starMode ? (rec.medal ? ` 🏅 ${fmt(rec.time)}` : rec.time ? ` ⏱ ${fmt(rec.time)}` : ' ⏱ —') : ` · best ${rec.best} leaps`}</> : open ? 'not home yet' : '🔒'}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {ending && (
        <div className="mh-ending" role="dialog" aria-label="Home at last">
          <Art src="/art/orbit/ending.webp" paint="ending" w={1536} h={1024} className="mh-ending-art" />
          <div className="mh-ending-text">
            <p className="mh-eyebrow">HOME AT LAST</p>
            <h2>The lantern brings them home</h2>
            <p>With every firefly tucked inside, the paper lantern glowed like a little sun, and drifted down through the clouds, past the mushroom moons and the frost moons and the comets, all the way to the round door in the hill.</p>
            <p>“Same time tomorrow?” said Enzo. Dora squeezed his paw. “The moons will be waiting.”</p>
            <div className="mh-row">
              <button className="mh-go" autoFocus onClick={() => { audio().ui(); setEnding(false); music('menu'); setScreen('menu'); }}>Goodnight 🏮<small>Starlight and the Moon Garden are open</small></button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
