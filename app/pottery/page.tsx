'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Wheel, Firing, DT, SHAPES, ORDERS, ORDER, DAYS, DAY_COUNT, CUSTOMERS, GLAZES, GLAZE_IDS, UPGRADES, UPGRADE_IDS, HANDLES, HANDLE_IDS, SAVE_KEY, FIRE_TIME, FIRE_WARM,
  clayFor, scoreThrow, scoreGlaze, freshGlaze, dip, paintBand, glazeAt, packProfile, partsStars, readSave, freshSave, dayOrders, dayDone, orderOpen, nextDay, deliver,
  buy, has, kilnSize, freeOpen, glazeOpen, upgradeOpen, keepInGallery, starCount, hashSeed, shapeMaxR, finalStars,
  type Save, type Order, type Shape, type Glaze, type GlazeId, type HandleId, type PartThrow, type Piece, type Wish, type FireResult, type UpgradeId, type GalleryPot, type Mode,
} from '@/lib/pottery-game';
import type { PotteryScene, PieceArt, Mood } from '@/lib/pottery-scene';
import { PotterySound, type SongId } from './sound';
import './pottery.css';

type Screen = 'menu' | 'board' | 'work' | 'gallery';
type Phase = 'throw' | 'scored' | 'handle' | 'glaze' | 'rack' | 'fire' | 'fired' | 'deliver';
type Job = { order: Order | null; part: number; parts: PartThrow[]; handle: HandleId | null; glaze: Glaze; history: Glaze[] };
type Scored = { stars: number; match: number; notes: string[]; line: string };
type Delivered = { piece: Piece; free: boolean; stars: number; pay: number; wishes: Wish[]; first: boolean; finale: boolean; kept: boolean };
const sceneModule = () => import('@/lib/pottery-scene');
const PART_NAME = { body: 'the body', lid: 'the lid', spout: 'the spout' } as const;
const SPEED_NAME = ['Stopped', 'Slow', 'Medium', 'Fast'];
const FINISH_NAME = { shine: '✨ A shining glaze', good: 'A good firing', dull: 'A little dull' } as const;
const CAST: [string, string][] = [['Dora', 'potter, glazer, chief of the kiln'], ['Enzo', 'thrower of pots and maker of handles'], ['Mrs Prickle', 'blackberries and puddings'], ['Mother Duck', 'and the ducklings'], ['Bramble', 'the badger baker'], ['Professor Heron', 'tall vases'], ['Hazel', 'acorns, honey and teapots'], ['Clover', 'flowers and carrot juice'], ['Old Mr Hoot', 'quills and teacups']];
const clone = (g: Glaze): Glaze => ({ ...g, bands: g.bands.map((b) => ({ ...b })) });

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
    <span className={'kc-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {src && !hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
/** A neighbour's portrait, or a round stand-in. */
function Portrait({ who, size = 64 }: { who: Order['who']; size?: number }) {
  const [bad, setBad] = useState(false), C = CUSTOMERS[who];
  return (
    <span className="kc-face" style={{ width: size, height: size, background: bad ? C.fur : undefined }}>
      {!bad && <img src={`/art/pottery/cust-${who}.webp`} alt="" width={size} height={size} onError={() => setBad(true)} />}
      {bad && <b>{C.name[0]}</b>}
    </span>
  );
}
/** The outline a customer asked for, drawn small. */
function Outline({ shape, size = 88 }: { shape: Shape; size?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((m) => { if (!dead && cv.current) m.paintOutline(cv.current, shape); }).catch(() => {}); return () => { dead = true; }; }, [shape]);
  return <canvas ref={cv} className="kc-outline" width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
/** A finished pot, drawn small. */
function PotThumb({ pot, size = 120 }: { pot: GalleryPot; size?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current, x = c?.getContext('2d'); if (dead || !c || !x) return;
      x.clearRect(0, 0, c.width, c.height);
      const b = pot.parts[0].prof, R = Math.max(...b.r), hh = b.h + (pot.parts.some((q) => q.id === 'lid') ? 1.6 : 0);
      const s = Math.min((c.height * 0.8) / (hh + R * 0.4), (c.width * 0.7) / (R * 2 + (pot.handle ? 2.4 : 0) + (pot.parts.some((q) => q.id === 'spout') ? 3 : 0)));
      m.drawPiece(x, { parts: pot.parts, handle: pot.handle, glaze: pot.glaze, fired: true, finish: pot.finish, cracked: pot.cracked, lip: pot.lip }, c.width / 2, c.height * 0.9, s);
    }).catch(() => {});
    return () => { dead = true; };
  }, [pot]);
  return <canvas ref={cv} className="kc-thumb" width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
const Stars = ({ n, of = 3, big = false }: { n: number; of?: number; big?: boolean }) => (
  <span className={'kc-stars' + (big ? ' is-big' : '')} aria-label={`${n} of ${of} stars`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'is-on' : ''}>★</i>)}</span>
);
const askChips = (o: Order) => scoreGlaze(freshGlaze(), o.glaze).wishes.map((w) => w.text);

export default function PotteryPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), tools = useRef<HTMLDivElement>(null), side = useRef<HTMLDivElement>(null);
  const scene = useRef<PotteryScene | null>(null), sound = useRef<PotterySound | null>(null);
  const save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), phaseRef = useRef<Phase>('throw'), pausedRef = useRef(false);
  const job = useRef<Job | null>(null), wheel = useRef<Wheel | null>(null), firing = useRef<Firing | null>(null), firePieces = useRef<Piece[]>([]), queue = useRef<Piece[]>([]);
  const acc = useRef(0), bellows = useRef(false), keyBellows = useRef(false), hover = useRef<{ x: number; y: number; mode: Mode | null } | null>(null);
  const trimTool = useRef(false), speedPref = useRef(2), selGlaze = useRef<GlazeId>('honey'), band = useRef<{ u0: number; u1: number; g: GlazeId } | null>(null);
  const moodRef = useRef<{ m: Mood; until: number }>({ m: 'focus', until: 0 }), clock = useRef(0), endingAfter = useRef(false);
  const toastTimer = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [phase, setPhaseState] = useState<Phase>('throw'), [paused, setPaused] = useState(false);
  const [scored, setScored] = useState<Scored | null>(null), [fired, setFired] = useState<FireResult | null>(null), [delivered, setDelivered] = useState<Delivered | null>(null);
  const [tip, setTip] = useState<{ title: string; text: string } | null>(null), [toast, setToast] = useState(''), [ending, setEnding] = useState(false), [dayNews, setDayNews] = useState<{ day: number; tips: number } | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [shop, setShop] = useState(false), [cardOpen, setCardOpen] = useState(true);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new PotterySound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3200) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const mood = (m: Mood, sec = 2.2) => { moodRef.current = { m, until: clock.current + sec }; };
  const music = (id: SongId) => sound.current?.music(id);
  const shapeNow = (): Shape | null => { const j = job.current; if (!j) return null; return j.order ? j.order.parts[j.part]?.shape ?? null : SHAPES.freeThrow; };
  const opts = () => ({ quiet: has(save.current, 'quiet'), sponge: has(save.current, 'sponge') });

  // ---------------------------------------------------------------- the flow of a job: throw (each part), handle, glaze, the kiln, delivery
  function openOrder(id: string | null) {
    const s = save.current;
    if (id && !orderOpen(s, id)) return;
    if (!id && !freeOpen(s)) return;
    audio().ui();
    job.current = { order: id ? ORDER[id] : null, part: 0, parts: [], handle: null, glaze: freshGlaze(), history: [] };
    setDelivered(null); setFired(null); setScored(null); setShop(false); setCardOpen(true);
    setScreen('work'); startThrow(); music('shop');
  }
  function teach(at: 'throw' | 'handle' | 'glaze') {
    const o = job.current?.order, s = save.current;
    if (o?.teach && o.teach.at === at && !s.seen.includes(o.id)) { setTip({ title: o.teach.title, text: o.teach.text }); s.seen.push(o.id); persist(); }
  }
  function startThrow() {
    const shape = shapeNow(); if (!shape) return;
    const j = job.current!;
    const w = new Wheel(j.order ? clayFor(shape) : 70, { ...opts(), solid: !shape.hollow });
    w.setSpeed(speedPref.current); wheel.current = w;
    trimTool.current = false; acc.current = 0; hover.current = null;
    setScored(null); setPhase('throw'); pausedRef.current = false; setPaused(false);
    requestAnimationFrame(() => { layout(); scene.current?.snap({ h: Math.max(shape.h, w.top), r: Math.max(shapeMaxR(shape), w.maxR) }); canvas.current?.focus(); });
    teach('throw'); refresh();
  }
  /** ✓ Done on the wheel: the customer has a look. */
  function finishThrow() {
    const w = wheel.current, j = job.current, shape = shapeNow(); if (!w || !j || !shape || w.slump >= 0 || phaseRef.current !== 'throw') return;
    w.release();
    if (!j.order) {
      if (!w.opened && !w.solid) { audio().nope(); showToast('Open it first: press down into the middle of the clay.'); return; }
      keepPart(3); return;
    }
    const sc = scoreThrow(w, shape), C = CUSTOMERS[j.order.who];
    const line = sc.stars === 0 ? (w.opened || !shape.hollow ? `${C.name} tilts their head. “Hmm… not quite what I had in mind. Could you try again?”` : `${C.name} peers into the lump. “It’s a lovely lump… but where does it all go?”`)
      : `${C.name}: “${j.order.thanks[3 - sc.stars]}”`;
    setScored({ stars: sc.stars, match: sc.match, notes: sc.notes, line });
    setPhase('scored');
    const a = audio(); if (sc.stars >= 1) { a.stars(sc.stars); mood('cheer'); } else { a.oh(); mood('oops'); }
  }
  function keepPart(stars: number) {
    const j = job.current, w = wheel.current; if (!j || !w) return;
    const id = j.order ? j.order.parts[j.part].id : 'body';
    j.parts.push({ id, prof: packProfile(w.profile()), stars }); persist();
    j.part++;
    if (j.order && j.part < j.order.parts.length) { audio().ui(); startThrow(); showToast(`Now ${PART_NAME[j.order.parts[j.part].id]}: a fresh lump of clay.`); return; }
    wheel.current = null;
    if (!j.order || j.order.handle) { j.handle = j.order ? 'loop' : null; setPhase('handle'); teach('handle'); scene.current?.snap(needOf(j)); refresh(); return; }
    startGlaze();
  }
  const needOf = (j: Job) => { const b = j.parts[0]?.prof; return { h: (b?.h ?? 4) + (j.parts.some((q) => q.id === 'lid') ? 1.5 : 0), r: (b ? Math.max(...b.r) : 3) + (j.handle || j.order?.handle ? 2.2 : 0) + (j.parts.some((q) => q.id === 'spout') ? 3 : 0) }; };
  function pickHandle(h: HandleId | null) { const j = job.current; if (!j) return; j.handle = h; audio().handle(); refresh(); }
  function startGlaze() {
    const j = job.current; if (!j) return;
    const s = save.current;
    if (!glazeOpen(s, selGlaze.current)) selGlaze.current = GLAZE_IDS.find((g) => glazeOpen(s, g)) ?? 'honey';
    if (j.order?.glaze.all) { const g = GLAZE_IDS.find((x) => GLAZES[x].fam === j.order!.glaze.all && glazeOpen(s, x)); if (g) selGlaze.current = g; }
    setPhase('glaze'); band.current = null; scene.current?.snap(needOf(j), 'glaze'); teach('glaze'); refresh();
  }
  function glazeEdit(fn: (g: Glaze) => void) { const j = job.current; if (!j || phaseRef.current !== 'glaze') return; j.history.push(clone(j.glaze)); if (j.history.length > 40) j.history.shift(); fn(j.glaze); refresh(); }
  const doDip = () => glazeEdit((g) => { dip(g, selGlaze.current); audio().dip(); });
  const doSpeckle = () => glazeEdit((g) => { g.speckle = !g.speckle; audio().speckle(); });
  const doDrip = () => glazeEdit((g) => { g.drip = g.drip === selGlaze.current ? null : selGlaze.current; audio().drip(); });
  const undoGlaze = () => { const j = job.current; if (!j || !j.history.length) return; j.glaze = j.history.pop()!; audio().ui(); refresh(); };
  const clearGlaze = () => glazeEdit((g) => { g.base = null; g.bands = []; g.speckle = false; g.drip = null; audio().ui(); });
  function finishGlaze() {
    const j = job.current, s = save.current; if (!j || phaseRef.current !== 'glaze') return;
    const piece: Piece = { order: j.order?.id ?? null, parts: j.parts, handle: j.handle, glaze: clone(j.glaze), throwStars: j.order ? Math.max(1, partsStars(j.parts)) : 3, fire: null };
    s.rack.push(piece); persist(); audio().ui();
    const waiting = ORDERS.some((o) => orderOpen(s, o.id) && !s.done[o.id] && o.id !== piece.order && !s.rack.some((p) => p.order === o.id));
    if (kilnSize(s) === 2 && s.rack.length < 2 && waiting) { setPhase('rack'); refresh(); return; }
    startFire();
  }
  function startFire() {
    const s = save.current; if (!s.rack.length) { toBoard(); return; }
    firePieces.current = s.rack.slice(0, kilnSize(s));
    firing.current = new Firing(hashSeed((firePieces.current[0].order ?? 'free') + ':' + s.pots + ':' + s.flumps), has(s, 'kiln'));
    bellows.current = false; keyBellows.current = false; acc.current = 0;
    setScreen('work'); setPhase('fire'); setFired(null); setDelivered(null); music('kiln');
    requestAnimationFrame(() => layout()); refresh();
  }
  function fireDone() {
    const k = firing.current, s = save.current; if (!k) return;
    const r = k.result();
    for (const p of firePieces.current) { p.fire = r; const i = s.rack.indexOf(p); if (i >= 0) s.rack.splice(i, 1); }
    queue.current = [...firePieces.current]; firePieces.current = [];
    persist(); setFired(r); setPhase('fired');
    const a = audio(); if (r.cracked) a.crack(); if (r.finish === 'shine') { a.shine(); scene.current?.celebrate(); }
    bellows.current = false; refresh();
  }
  function nextDelivery() {
    const s = save.current, p = queue.current.shift();
    if (!p) { toBoard(); return; }
    setFired(null);
    if (p.order) {
      const o = ORDER[p.order], r = deliver(s, p), wishes = scoreGlaze(p.glaze, o.glaze).wishes;
      if (!s.tutorial) s.tutorial = true;
      persist();
      setDelivered({ piece: p, free: false, stars: r.stars, pay: r.pay, wishes, first: r.first, finale: r.finale, kept: false });
      const a = audio(); a.happy(); a.stars(r.stars); a.coins(r.pay); mood('cheer', 4);
      if (r.finale) endingAfter.current = true;
    } else {
      s.pots++; persist();
      setDelivered({ piece: p, free: true, stars: 0, pay: 0, wishes: [], first: false, finale: false, kept: false });
      audio().happy(); mood('cheer', 3);
    }
    setPhase('deliver'); music('shop'); scene.current?.celebrate(); refresh();
  }
  function keepDelivered() {
    const d = delivered, s = save.current; if (!d || d.kept) return;
    const name = d.piece.order ? `${ORDER[d.piece.order].title}` : `Free throw ${s.pots}`;
    keepInGallery(s, d.piece, name); persist(); setDelivered({ ...d, kept: true }); audio().ui();
  }
  function afterDelivery() {
    if (queue.current.length) { nextDelivery(); return; }
    if (endingAfter.current) { endingAfter.current = false; toBoard(); setEnding(true); music('ending'); return; }
    toBoard();
  }
  function toBoard() {
    job.current = null; wheel.current = null; firing.current = null; band.current = null; trimTool.current = false;
    setScored(null); setFired(null); setDelivered(null); setTip(null); setPaused(false); pausedRef.current = false;
    setScreen('board'); music('menu'); refresh();
  }
  function endDay() {
    const s = save.current, r = nextDay(s); if (!r.ok) return;
    persist(); audio().happy(); if (r.tips) audio().coins(r.tips);
    setDayNews({ day: s.day, tips: r.tips }); refresh();
  }
  function buyUp(u: UpgradeId) { const s = save.current; if (!buy(s, u)) { audio().nope(); return; } persist(); audio().coins(4); showToast(`${UPGRADES[u].icon} ${UPGRADES[u].name}: ${UPGRADES[u].blurb}`); refresh(); }
  function pause(on: boolean) {
    if (screenRef.current !== 'work' || on === pausedRef.current) return;
    if (on && (phaseRef.current !== 'throw' && phaseRef.current !== 'glaze' && phaseRef.current !== 'fire')) return;
    pausedRef.current = on; setPaused(on); wheel.current?.release(); bellows.current = false;
    if (on) sound.current?.suspend(); else { sound.current?.resume(); canvas.current?.focus(); }
  }
  // the wheel's own controls
  function setSpeed(v: number) { const w = wheel.current; speedPref.current = Math.max(1, Math.min(3, v)); if (w) w.setSpeed(speedPref.current); audio().ui(); refresh(); }
  function water() { const w = wheel.current; if (!w || phaseRef.current !== 'throw') return; w.water(); refresh(); }
  function toggleGhost() { save.current.settings.ghost = !save.current.settings.ghost; persist(); audio().ui(); refresh(); }
  function restart() { if (phaseRef.current !== 'throw') return; audio().ui(); startThrow(); }

  /** The stage's clear area, so the scene can frame the wheel between the bars. */
  function layout() {
    const el = stage.current, sc = scene.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setOrient(r.width >= r.height ? 'wide' : 'tall');
    if (!sc) return;
    sc.resize();
    const t = tools.current?.getBoundingClientRect(), sd = side.current?.getBoundingClientRect();
    const tallNow = r.height > r.width * 1.05;
    sc.inset = { top: tallNow && sd && sd.height > 0 ? Math.max(0, sd.bottom - r.top) : 0, right: 0, left: 0, bottom: t && t.height > 0 ? Math.max(8, r.bottom - t.top + 4) : 8 };
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse); setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__pottery = () => ({ screen: screenRef.current, phase: phaseRef.current, wheel: wheel.current, order: job.current?.order?.id ?? null, part: job.current?.part ?? 0, job: job.current, firing: firing.current, save: save.current, glaze: selGlaze.current, trim: trimTool.current, paused: pausedRef.current });
    w.__potteryOpen = (id: string | null) => openOrder(id);
    w.__potteryPoint = (x: number, y: number) => { const sc = scene.current, cv = canvas.current; if (!sc || !cv) return null; const b = cv.getBoundingClientRect(), [sx, sy] = sc.toScreen(x, y); return [b.left + sx, b.top + sy]; };
    w.__potteryScene = () => scene.current?.metrics() ?? null;
    let dead = false, raf = 0, last = 0, ui = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.PotteryScene(canvas.current); } catch { setError('This browser cannot draw the workshop.'); return; }
      for (const c of Object.keys(CUSTOMERS)) scene.current.want('cust-' + c);
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, working = screenRef.current === 'work', ph = phaseRef.current, frozen = pausedRef.current;
        if (!frozen) clock.current += dt;
        const w = wheel.current, k = firing.current;
        if (working && !frozen) {
          if (ph === 'throw' && w) {
            acc.current += dt; let n = 0;
            while (acc.current >= DT && n < 8) {
              w.step(); acc.current -= DT; n++;
              if (w.events.length) {
                const evs = w.events.splice(0);
                sc.feed(evs, w); sound.current?.wheel(evs);
                for (const e of evs) {
                  if (e.k === 'flump') { mood('oops', 2.6); save.current.flumps++; persist(); showToast('Flump! The wall gave way and the clay slumped back into a lump. Thicker walls, or a slower wheel, and try again.', 4200); }
                  else if (e.k === 'centred') { mood('cheer', 1.6); }
                  else if (e.k === 'opened') { mood('cheer', 1.6); }
                  else if (e.k === 'dry') showToast('The clay is drying out: tap 💧 Water.', 2600);
                }
              }
            }
            if (acc.current > DT) acc.current = 0;
          } else if (ph === 'fire' && k && !k.done) {
            k.heat = bellows.current || keyBellows.current;
            acc.current += dt; let n = 0;
            while (acc.current >= DT && n < 8 && !k.done) { k.step(); acc.current -= DT; n++; }
            const evs = k.events.splice(0); if (evs.length) sound.current?.kiln(evs);
            if (k.heat) sound.current?.bellows();
            if (k.done) fireDone();
          }
        }
        const j = job.current, body = j?.parts[0]?.prof;
        const piece: PieceArt | null = j && body && (ph === 'handle' || ph === 'glaze' || ph === 'rack') ? { parts: j.parts, handle: j.handle, glaze: ph === 'handle' ? null : j.glaze, fired: false, lip: !!j.order?.parts[0].shape.lip } : null;
        const d = deliveredRef.current;
        const m = moodRef.current.until > clock.current ? moodRef.current.m : w && w.strain > 0.85 ? 'oops' : 'focus';
        if (working) {
          const view = ph === 'throw' || ph === 'scored' ? 'throw' : ph === 'fire' || ph === 'fired' ? 'fire' : ph === 'deliver' ? 'deliver' : 'glaze';
          sc.draw({
            dt: frozen ? 0 : dt, view, wheel: view === 'throw' ? w : null, piece: view === 'deliver' && d ? artOf(d.piece) : piece, target: view === 'throw' ? shapeNow() : null,
            ghost: save.current.settings.ghost && !!j?.order, mood: m, hover: hover.current, band: band.current, speed: w?.speed ?? 2, paused: frozen,
            kiln: (ph === 'fire' ? firePieces.current : ph === 'fired' ? queue.current : []).map(artOf), firing: k, customer: d && d.piece.order ? ORDER[d.piece.order].who : null,
          });
        }
        sound.current?.steady({ spin: working && ph === 'throw' && w ? w.speed : working && ph === 'glaze' ? 1 : 0, touch: !!w?.finger?.mode, wet: w?.wet ?? 0.5, heat: working && ph === 'fire' && k ? k.T : 0, bellows: !!k?.heat });
        sound.current?.tick(!pausedRef.current);
        if (ms - ui > 150) { ui = ms; if (working && !frozen && (ph === 'throw' || ph === 'fire')) refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The workshop could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tgt = e.target as HTMLElement;
      if (screenRef.current !== 'work') return;
      if (k === 'escape' || k === 'p') { if (e.repeat) return; e.preventDefault(); if (trimTool.current) { trimTool.current = false; refresh(); return; } pause(!pausedRef.current); return; }
      if (pausedRef.current) return;
      const ph = phaseRef.current;
      if (ph === 'fire') { if (k === ' ' || k === 'arrowup' || k === 'b') { e.preventDefault(); keyBellows.current = true; } return; }
      if (tgt.closest?.('button, a, input') && (k === 'enter' || k === ' ')) return;
      if (ph === 'throw') {
        if (k === '1' || k === '2' || k === '3') { e.preventDefault(); setSpeed(+k); }
        else if (k === 'w') { e.preventDefault(); water(); }
        else if (k === 'g') { e.preventDefault(); toggleGhost(); }
        else if (k === 't') { e.preventDefault(); trimTool.current = !trimTool.current; audio().ui(); refresh(); }
        else if (k === 'r') { e.preventDefault(); restart(); }
        else if (k === 'enter') { e.preventDefault(); finishThrow(); }
      } else if (ph === 'glaze') {
        const open = GLAZE_IDS.filter((g) => glazeOpen(save.current, g)), i = '123456789'.indexOf(k);
        if (i >= 0 && i < open.length) { e.preventDefault(); selGlaze.current = open[i]; audio().ui(); refresh(); }
        else if (k === 'd') { e.preventDefault(); doDip(); }
        else if (k === 's') { e.preventDefault(); doSpeckle(); }
        else if (k === 'r') { e.preventDefault(); doDrip(); }
        else if (k === 'z' || k === 'u') { e.preventDefault(); undoGlaze(); }
        else if (k === 'enter') { e.preventDefault(); finishGlaze(); }
      }
    };
    const keyup = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === ' ' || k === 'arrowup' || k === 'b') keyBellows.current = false; };
    const blur = () => { pause(true); keyBellows.current = false; bellows.current = false; sound.current?.suspend(); };
    const focus = () => { if (!document.hidden && !pausedRef.current) sound.current?.resume(); };
    const hide = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect(); window.clearTimeout(toastTimer.current);
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const deliveredRef = useRef<Delivered | null>(null); deliveredRef.current = delivered;
  useEffect(() => { requestAnimationFrame(() => layout()); }, [screen, phase, orient, touch, cardOpen, scored, tip]);
  const artOf = (p: Piece): PieceArt => ({ parts: p.parts, handle: p.handle, glaze: p.glaze, fired: !!p.fire, finish: p.fire?.finish, cracked: p.fire?.cracked, lip: p.order ? !!ORDER[p.order].parts[0].shape.lip : false });

  // ---------------------------------------------------------------- the pointer: shape the clay, paint the glaze, work the bellows
  const local = (e: React.PointerEvent): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const potAt = (e: React.PointerEvent) => scene.current?.toPot(...local(e)) ?? [0, 0];
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'work' || pausedRef.current) return;
    audio();
    if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone already */ }
    const ph = phaseRef.current, [x, y] = potAt(e), w = wheel.current;
    if (ph === 'throw' && w && e.button === 0) {
      if (trimTool.current) {
        if (w.trim(y)) { sound.current?.wheel([{ k: 'trim' }]); trimTool.current = false; showToast('Snip! The rim is trimmed level.', 1800); }
        else { audio().nope(); showToast(w.opened || w.solid ? 'Tap the pot at the height to trim it to (above the floor).' : 'Open the clay before trimming.', 2200); }
        refresh(); return;
      }
      w.press(x, y); hover.current = null; if (scene.current) scene.current.hold = true;
    } else if (ph === 'glaze' && e.button === 0) {
      const b = job.current?.parts[0]?.prof; if (!b) return;
      const u = y / b.h, R = Math.max(...b.r);
      if (u < -0.08 || u > 1.08 || Math.abs(x) > R + 1.2) return;
      band.current = { u0: Math.max(0, Math.min(1, u)), u1: Math.max(0, Math.min(1, u)), g: selGlaze.current }; audio().brush();
    } else if (ph === 'fire') bellows.current = true;
  };
  const onMove = (e: React.PointerEvent) => {
    if (screenRef.current !== 'work') return;
    const [x, y] = potAt(e), w = wheel.current, ph = phaseRef.current;
    if (ph === 'throw' && w) {
      if (w.finger) w.move(x, y);
      else if (e.pointerType === 'mouse') hover.current = trimTool.current ? null : { x, y, mode: w.modeAt(x, y) };
    } else if (ph === 'glaze' && band.current) {
      const b = job.current?.parts[0]?.prof; if (b) { band.current.u1 = Math.max(0, Math.min(1, y / b.h)); if (Math.abs(band.current.u1 - band.current.u0) > 0.05) sound.current?.brush(); }
    }
  };
  const onUp = () => {
    const w = wheel.current, ph = phaseRef.current;
    if (w) w.release();
    if (scene.current) scene.current.hold = false;
    if (ph === 'glaze' && band.current) { const bd = band.current; band.current = null; glazeEdit((g) => { paintBand(g, bd.g, bd.u0, bd.u1); }); }
    bellows.current = false;
  };
  const onLeave = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') hover.current = null; };

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="kc-chips">
      <button className="kc-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="kc-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  // ---------------------------------------------------------------- what to do next on the wheel, step by step
  function hint(): string {
    const w = wheel.current, shape = shapeNow(), j = job.current; if (!w || !shape || !j) return '';
    if (w.slump >= 0) return 'Flump! The clay is slumping back into a lump…';
    if (trimTool.current) return '✂ Tap the pot at the height to trim the rim down to.';
    if (w.speed === 0) return 'The wheel is stopped: pick a speed.';
    if (w.centred < 1) return touch ? 'Hold your finger on the clay to centre it.' : 'Hold the mouse button down on the clay to centre it.';
    if (!shape.hollow) {
      if (w.maxR < shapeMaxR(shape) * 0.95) return 'A lid: press down on the middle of the top to squash it low and wide.';
      return 'Push in from the side near the top to raise a knob. Match the dotted outline, then ✓ Done.';
    }
    if (!w.opened) return 'Press down into the middle of the top and drag down to open it.';
    if (w.top < shape.h * 0.92) return 'Raise the walls: press just outside the wall near the bottom and slide up.';
    const sc = scoreThrow(w, shape);
    if (sc.stars < 3) return 'Shape it: press outside and drag in to narrow; press inside and drag out to widen. Too tall? ✂ Trim.';
    return 'That’s looking just right! Press ✓ Done.';
  }

  const j = job.current, w = wheel.current, order = j?.order ?? null, shape = shapeNow();
  const live = screen === 'work' && phase === 'throw' && w && shape && order ? scoreThrow(w, shape) : null;
  const openG = mounted ? GLAZE_IDS.filter((g) => glazeOpen(S, g)) : [];
  const gWish = j && order && (phase === 'glaze') ? scoreGlaze(j.glaze, order.glaze) : null;
  const k = firing.current;
  const tut = screen === 'work' && phase === 'throw' && order?.id === 'o1' && !S.tutorial;
  const today = mounted ? S.day : 1;
  const totalStars = ORDERS.length * 3;
  const nextUp = mounted ? ORDERS.find((o) => orderOpen(S, o.id) && !S.done[o.id]) ?? null : null;
  const started = mounted && (starCount(S) > 0 || S.rack.length > 0);
  const keysThrow = <><kbd>1</kbd>–<kbd>3</kbd> wheel speed · <kbd>W</kbd> water · <kbd>G</kbd> outline · <kbd>T</kbd> trim · <kbd>R</kbd> start again · <kbd>Enter</kbd> done · <kbd>Esc</kbd> pause</>;
  const keysGlaze = <><kbd>1</kbd>–<kbd>9</kbd> glazes · drag on the pot to paint a band · <kbd>D</kbd> dip · <kbd>S</kbd> speckle · <kbd>R</kbd> drip · <kbd>Z</kbd> undo · <kbd>Enter</kbd> done</>;
  const strainCol = (v: number) => (v > 0.85 ? '#e5483a' : v > 0.65 ? '#f2b33a' : '#60c468');

  return (
    <main className="kc-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={screen === 'work' ? phase : undefined} data-touch={touch ? orient : undefined}>
      {screen === 'work' && (
        <header className="kc-bar">
          <button className="kc-back" onClick={() => { if (phase === 'throw' || phase === 'glaze' || phase === 'handle' || phase === 'scored') { if (!window.confirm('Leave this pot and go back to the board?')) return; } if (phase === 'fire') return; toBoard(); }} disabled={phase === 'fire'}>← BOARD</button>
          <span className="kc-bar-mid">
            {order ? <b className="kc-name"><small>{CUSTOMERS[order.who].name}</small> {order.title}</b> : <b className="kc-name">🎡 Free throw</b>}
            {phase === 'throw' && order && order.parts.length > 1 && <span className="kc-part">{(j?.part ?? 0) + 1}/{order.parts.length} · {PART_NAME[order.parts[j?.part ?? 0].id]}</span>}
            <span className="kc-acorns" title="Acorns">🌰 <b>{mounted ? S.acorns : 0}</b></span>
          </span>
          <button className="kc-chip kc-pause" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={!(phase === 'throw' || phase === 'glaze' || phase === 'fire')}>❚❚</button>
        </header>
      )}
      <div className="kc-stage" ref={stage}>
        <canvas ref={canvas} className={'kc-canvas' + (trimTool.current ? ' is-trim' : '')} tabIndex={0} data-testid="wheel"
          aria-label="The potter’s wheel. Press and drag on the clay to shape it."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onLeave} onContextMenu={(e) => e.preventDefault()} />

        {screen === 'work' && phase === 'throw' && w && (<>
          <div className={'kc-side' + (cardOpen ? '' : ' is-shut')} ref={side}>
            {order ? (<>
              <button className="kc-side-head" onClick={() => { setCardOpen(!cardOpen); audio().ui(); }} aria-expanded={cardOpen}>
                <Portrait who={order.who} size={40} /><span><b>{CUSTOMERS[order.who].name}</b><small>{shape?.name}{order.parts.length > 1 ? ` · part ${(j?.part ?? 0) + 1} of ${order.parts.length}` : ''}</small></span><i>{cardOpen ? '▴' : '▾'}</i>
              </button>
              {cardOpen && <p className="kc-ask">“{order.ask}”</p>}
            </>) : <p className="kc-ask"><b>🎡 Free throw</b> No order, no outline: make anything you like, then glaze it and fire it for your gallery.</p>}
            <div className="kc-meters">
              <span className="kc-meter" title="How wet the clay is"><small>💧 Wet</small><i><b style={{ width: `${Math.round(w.wet * 100)}%`, background: w.wet < 0.3 ? '#e0a040' : w.wet > 0.85 ? '#6a8ad8' : '#5aa0d8' }} /></i></span>
              <span className="kc-meter" title="How close the walls are to giving way"><small>〰 Wobble</small><i><b style={{ width: `${Math.round(Math.min(1, w.strain) * 100)}%`, background: strainCol(w.strain) }} /></i></span>
              {w.centred < 1 && <span className="kc-meter" title="Centring"><small>◎ Centred</small><i><b style={{ width: `${Math.round(w.centred * 100)}%`, background: '#f2c84a' }} /></i></span>}
              {live && <span className="kc-live" data-testid="live" title="How close it is to the outline">Shape <b>{Math.round(live.match * 100)}%</b> <Stars n={live.stars} /></span>}
            </div>
          </div>
          {(tut || !touch || orient === 'wide') && <p className={'kc-hint' + (tut ? ' is-tut' : '')} role="status">{tut && <b>FIRST POT</b>}{hint()}</p>}
          <div className="kc-tools" ref={tools} role="toolbar" aria-label="Wheel tools">
            <span className="kc-speeds" role="group" aria-label="Wheel speed">
              {[1, 2, 3].map((v) => <button key={v} className={'kc-speed' + (w.speed === v ? ' is-on' : '')} onClick={() => setSpeed(v)} aria-pressed={w.speed === v} aria-label={`${SPEED_NAME[v]} wheel`} title={`${SPEED_NAME[v]} wheel (${v})`}>{v === 1 ? '🐢' : v === 2 ? '◎' : '🐇'}</button>)}
            </span>
            <button className="kc-btn" onClick={water} aria-label="Water" title="A dab of water keeps the clay workable (W)">💧</button>
            {order && <button className={'kc-btn' + (S.settings.ghost ? ' is-on' : '')} onClick={toggleGhost} aria-pressed={S.settings.ghost} aria-label="Outline" title="Show the outline asked for (G)">👻</button>}
            <button className={'kc-btn' + (trimTool.current ? ' is-on' : '')} onClick={() => { trimTool.current = !trimTool.current; audio().ui(); refresh(); }} aria-pressed={trimTool.current} aria-label="Trim" title="Trim the rim level: then tap the pot at the height (T)">✂</button>
            <button className="kc-btn" onClick={restart} aria-label="Start again" title="A fresh lump (R)">↺</button>
            <button className="kc-done" onClick={finishThrow} disabled={w.slump >= 0} aria-label="Done" title="Show it to the customer (Enter)">✓ Done</button>
          </div>
        </>)}

        {screen === 'work' && phase === 'glaze' && j && (<>
          <div className="kc-side" ref={side}>
            {order ? (<>
              <div className="kc-side-head is-static"><Portrait who={order.who} size={40} /><span><b>{CUSTOMERS[order.who].name}</b><small>wants…</small></span></div>
              <ul className="kc-wishes">{gWish?.wishes.map((x) => <li key={x.text} className={x.got >= 1 ? 'is-on' : x.got > 0 ? 'is-half' : ''}><i>{x.got >= 1 ? '✓' : x.got > 0 ? '½' : '○'}</i>{x.text}</li>)}</ul>
            </>) : <p className="kc-ask"><b>🎨 Glaze it</b> Any colours you like.</p>}
          </div>
          <p className="kc-hint" role="status">{touch ? 'Pick a glaze: 🪣 Dip coats it all; drag up or down the pot to paint a band.' : 'Pick a glaze: 🪣 Dip coats it all; drag up or down the spinning pot to paint a band.'}</p>
          <div className="kc-tools kc-glaze-tools" ref={tools} role="toolbar" aria-label="Glazes">
            <span className="kc-swatches" role="group" aria-label="Glaze colours">
              {openG.map((g, i) => <button key={g} className={'kc-swatch' + (selGlaze.current === g ? ' is-on' : '')} style={{ ['--g' as string]: GLAZES[g].hex }} onClick={() => { selGlaze.current = g; audio().ui(); refresh(); }} aria-pressed={selGlaze.current === g} aria-label={GLAZES[g].name} title={`${GLAZES[g].name} (${i + 1})`}><i /><small>{GLAZES[g].name}</small></button>)}
            </span>
            <span className="kc-btns">
              <button className="kc-btn kc-wide" onClick={doDip} aria-label="Dip" title="Dip the whole pot (D)">🪣<small>Dip</small></button>
              <button className={'kc-btn kc-wide' + (j.glaze.speckle ? ' is-on' : '')} onClick={doSpeckle} aria-pressed={j.glaze.speckle} aria-label="Speckle" title="Iron speckles (S)">✨<small>Speckle</small></button>
              <button className={'kc-btn kc-wide' + (j.glaze.drip ? ' is-on' : '')} onClick={doDrip} aria-pressed={!!j.glaze.drip} aria-label="Drip" title="Drips from the rim in this glaze (R)">💧<small>Drip</small></button>
              <button className="kc-btn" onClick={undoGlaze} disabled={!j.history.length} aria-label="Undo" title="Undo (Z)">↶</button>
              <button className="kc-btn" onClick={clearGlaze} aria-label="Clear the glaze" title="Bare clay again">🗑</button>
            </span>
            <button className="kc-done" onClick={finishGlaze} disabled={!j.glaze.base && !j.glaze.bands.length} aria-label="To the kiln" title="To the kiln (Enter)">🔥 Kiln</button>
          </div>
        </>)}

        {screen === 'work' && phase === 'handle' && j && (
          <div className="kc-panel kc-handle" role="dialog" aria-label="Pick a handle">
            <p className="kc-eyebrow">{order ? 'A HANDLE' : 'A HANDLE?'}</p>
            <h2>{order ? 'Pick a handle' : 'Add a handle?'}</h2>
            <div className="kc-handles">
              {!order && <button className={'kc-hbtn' + (j.handle === null ? ' is-on' : '')} onClick={() => pickHandle(null)} aria-pressed={j.handle === null}>No handle</button>}
              {HANDLE_IDS.map((h) => <button key={h} className={'kc-hbtn' + (j.handle === h ? ' is-on' : '')} onClick={() => pickHandle(h)} aria-pressed={j.handle === h}>{HANDLES[h].name}</button>)}
            </div>
            <div className="kc-row"><button className="kc-go" autoFocus onClick={() => { audio().handle(); startGlaze(); }}>On to the glaze →</button></div>
          </div>
        )}

        {screen === 'work' && phase === 'fire' && k && (<>
          <p className="kc-hint kc-fire-hint" role="status">{k.t < FIRE_WARM ? 'The kiln is warming up… get ready.' : touch ? 'Hold 🔥 to pump the bellows; let go to cool. Keep the needle in the green!' : 'Hold Space (or 🔥) to pump the bellows; let go to cool. Keep the needle in the green!'}</p>
          <div className="kc-tools kc-fire-tools" ref={tools}>
            <span className="kc-clock" data-testid="clock">{Math.max(0, Math.ceil(FIRE_TIME - k.t))}s</span>
            <button className={'kc-bellows' + (k.heat ? ' is-on' : '')} aria-label="Bellows" onPointerDown={(e) => { e.preventDefault(); audio(); bellows.current = true; }} onPointerUp={() => { bellows.current = false; }} onPointerLeave={() => { bellows.current = false; }} onPointerCancel={() => { bellows.current = false; }}>🔥 Bellows</button>
            <span className="kc-inband">{k.T >= k.lo && k.T <= k.hi ? '✓ Just right' : k.T > k.hi ? '🔥 Too hot!' : '❄ Too cool'}</span>
          </div>
        </>)}

        {tip && screen === 'work' && (phase === 'throw' || phase === 'glaze' || phase === 'handle') && (
          <div className="kc-card" role="dialog" aria-label={tip.title}>
            <p className="kc-eyebrow">💡 SOMETHING NEW</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="kc-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
        {toast && <p className="kc-toast" role="status">{toast}</p>}
      </div>
      {error && <div className="kc-panel kc-error"><h2>One moment…</h2><p>{error}</p></div>}

      {/* ---------------------------------------------------------------- panels over the work */}
      {screen === 'work' && phase === 'scored' && scored && order && (
        <div className="kc-panel kc-result" role="dialog" aria-label="The customer has a look">
          <p className="kc-eyebrow">{scored.stars ? `${(PART_NAME[order.parts[j?.part ?? 0].id]).toUpperCase()} · THROWN` : 'NOT QUITE'}</p>
          <Stars n={scored.stars} big />
          <p className="kc-match">Shape <b>{Math.round(scored.match * 100)}%</b> like the outline</p>
          <p className="kc-line">{scored.line}</p>
          {scored.notes.length > 0 && <ul className="kc-notes">{scored.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          <div className="kc-row">
            {scored.stars > 0 && <button className="kc-go" autoFocus onClick={() => keepPart(scored.stars)}>Keep it →<small>{order.parts.length > (j?.part ?? 0) + 1 ? `next: ${PART_NAME[order.parts[(j?.part ?? 0) + 1].id]}` : order.handle ? 'next: a handle' : 'next: the glaze'}</small></button>}
            <button className={scored.stars > 0 ? 'kc-alt' : 'kc-go'} autoFocus={scored.stars === 0} onClick={() => { audio().ui(); if (scored.stars === 0) startThrow(); else { setScored(null); setPhase('throw'); } }}>{scored.stars === 0 ? '↺ Try again' : '✋ Keep shaping'}</button>
            {scored.stars > 0 && <button className="kc-alt" onClick={() => { audio().ui(); startThrow(); }}>↺ A fresh lump</button>}
          </div>
        </div>
      )}
      {screen === 'work' && phase === 'rack' && (
        <div className="kc-panel" role="dialog" aria-label="Fire now or wait">
          <p className="kc-eyebrow">🔥 THE BIG KILN</p>
          <h2>Two pots fit in the kiln</h2>
          <p>Fire this one now, or leave it on the rack and throw another order first, then fire them together.</p>
          <div className="kc-row"><button className="kc-go" autoFocus onClick={startFire}>🔥 Fire it now</button><button className="kc-alt" onClick={() => { audio().ui(); toBoard(); showToast('On the rack: it’ll go in with the next pot.'); }}>🧺 Wait on the rack</button></div>
        </div>
      )}
      {screen === 'work' && phase === 'fired' && fired && (
        <div className="kc-panel kc-result" role="dialog" aria-label="Out of the kiln">
          <p className="kc-eyebrow">OUT OF THE KILN</p>
          <h2>{FINISH_NAME[fired.finish]}</h2>
          <p className="kc-match">In the sweet band <b>{Math.round(fired.quality * 100)}%</b> of the firing</p>
          {fired.cracked && <p className="kc-line">A hairline crack from the heat: still lovely, but a star off.</p>}
          {fired.finish === 'dull' && <p className="kc-line">Under-fired and a bit chalky: a star off. Keep the needle in the green next time.</p>}
          {fired.finish === 'shine' && <p className="kc-line">Glossy and bright: a shine earns a tip!</p>}
          <div className="kc-row"><button className="kc-go" autoFocus onClick={nextDelivery}>{queue.current.some((p) => p.order) ? 'Deliver it →' : 'Take a look →'}</button></div>
        </div>
      )}
      {screen === 'work' && phase === 'deliver' && delivered && (
        <div className={'kc-panel kc-result kc-deliver'} role="dialog" aria-label={delivered.free ? 'Your pot' : 'Delivered'}>
          {delivered.free ? (<>
            <p className="kc-eyebrow">YOUR OWN POT</p><h2>Out of the kiln and all yours</h2>
            <p className="kc-line">Dora and Enzo admire it from every side.</p>
          </>) : (() => {
            const o = ORDER[delivered.piece.order!];
            return (<>
              <p className="kc-eyebrow">DELIVERED TO {CUSTOMERS[o.who].name.toUpperCase()}</p>
              <Stars n={delivered.stars} big />
              <p className="kc-line">“{o.thanks[3 - delivered.stars]}”</p>
              <ul className="kc-wishes is-row">{delivered.wishes.map((x) => <li key={x.text} className={x.got >= 1 ? 'is-on' : x.got > 0 ? 'is-half' : ''}><i>{x.got >= 1 ? '✓' : x.got > 0 ? '½' : '○'}</i>{x.text}</li>)}</ul>
              <p className="kc-pay" data-testid="pay">+🌰 {delivered.pay}<small>{delivered.first ? '' : ' a thank-you for making it again'}{delivered.piece.fire?.finish === 'shine' && delivered.first ? ' with a tip for the shine' : ''}</small></p>
            </>);
          })()}
          <div className="kc-row">
            <button className="kc-go" autoFocus onClick={afterDelivery}>{queue.current.length ? 'Next pot →' : delivered.finale ? 'To the picnic →' : 'Back to the board →'}</button>
            <button className="kc-alt" onClick={keepDelivered} disabled={delivered.kept}>{delivered.kept ? '♥ In the gallery' : '♥ Keep one for the gallery'}</button>
          </div>
        </div>
      )}
      {paused && (
        <div className="kc-panel" role="dialog" aria-label="Paused">
          <h2>Paused</h2><p>The wheel will wait.</p>
          {settings}
          <p className="kc-keys">{phase === 'glaze' ? keysGlaze : keysThrow}</p>
          <div className="kc-row"><button className="kc-go" onClick={() => pause(false)}>Back to work</button><button className="kc-alt" onClick={() => { if (phase === 'fire') return; pause(false); toBoard(); }} disabled={phase === 'fire'}>To the board</button></div>
        </div>
      )}

      {/* ---------------------------------------------------------------- the menu */}
      {screen === 'menu' && (
        <section className="kc-menu" aria-label="Kiln & Clay">
          <header className="kc-head"><a href="/" className="kc-back">← ARCADE</a>{settings}</header>
          <div className="kc-hero">
            <Art src="/art/pottery/title.webp" paint="title" w={1536} h={1024} className="kc-hero-art" />
            <div><p className="kc-eyebrow">A COSY POTTERY WORKSHOP</p><h1>Kiln <em>&amp;</em> Clay</h1>
              <p className="kc-lede">Dora and Enzo run a little pottery on the hill. The valley’s neighbours leave orders on the board: throw the pots on the wheel, glaze them, fire the kiln and deliver them, all the way to a tea set for the whole valley’s picnic.</p></div>
          </div>
          <div className="kc-go-row">
            <button className="kc-go" disabled={!ready} onClick={() => { audio().ui(); setScreen('board'); music('menu'); }}>{!ready ? 'Warming the kiln…' : started ? 'CONTINUE →' : 'OPEN THE WORKSHOP →'}<small>{mounted ? `Day ${today} · ${DAYS[today - 1].name}${nextUp ? ` · ${CUSTOMERS[nextUp.who].name} is waiting` : ''}` : ' '}</small></button>
            {mounted && freeOpen(S) ? <button className="kc-alt kc-dusk" disabled={!ready} onClick={() => openOrder(null)}>🎡 Free throw<small>anything you like</small></button>
              : <button className="kc-alt" disabled><span>🎡 Free throw</span><small>after your first order</small></button>}
            <button className="kc-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('gallery'); }}>🖼 Gallery<small>{mounted ? `${S.gallery.length} pot${S.gallery.length === 1 ? '' : 's'}` : ' '}</small></button>
            {mounted && S.ended && <button className="kc-alt" onClick={() => { audio().ui(); setEnding(true); music('ending'); }}>🧺 The picnic</button>}
          </div>
          <ol className="kc-how" aria-label="How to play">
            <li><b>◎ Centre and open.</b> Hold a finger on the spinning clay until it runs true, then press down into the middle to open it.</li>
            <li><b>⇡ Raise the walls.</b> Press just outside the wall at the bottom and slide up: the walls grow taller and thinner. Too thin and they flump!</li>
            <li><b>⇆ Shape it.</b> Press outside and drag in to narrow; press inside and drag out to widen. Match the dotted outline, trim the rim, then ✓ Done.</li>
            <li><b>🎨🔥 Glaze and fire.</b> Dip and paint bands, then keep the kiln’s needle in the green. Deliver it for acorns and stars.</li>
          </ol>
          <p className="kc-keys">{keysThrow}</p>
          <p className="kc-keys">On a phone: hold and drag on the clay with one finger; the tools are along the bottom.</p>
        </section>
      )}

      {/* ---------------------------------------------------------------- the order board */}
      {screen === 'board' && (
        <section className="kc-menu kc-board" aria-label="The order board">
          <header className="kc-head"><a href="/" className="kc-back">← ARCADE</a><b className="kc-total">🌰 <span data-testid="acorns">{mounted ? S.acorns : 0}</span> · ★ {mounted ? starCount(S) : 0}/{totalStars}</b>{settings}</header>
          <div className="kc-dayhead">
            <div><small>DAY {today} OF {DAY_COUNT}</small><h2>{DAYS[today - 1].name}</h2><p>{DAYS[today - 1].blurb}</p></div>
            <span className="kc-pair" aria-hidden="true"><img src="/art/pottery/dora-cheer.webp" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><img src="/art/pottery/enzo-cheer.webp" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></span>
          </div>
          {mounted && S.rack.length > 0 && (
            <div className="kc-rack">
              <span>🧺 On the rack: {S.rack.map((p) => (p.order ? ORDER[p.order].title : 'your own pot')).join(' and ')}</span>
              <button className="kc-go" onClick={() => { audio().ui(); startFire(); }}>🔥 Fire the kiln{S.rack.length > 1 ? ' (both)' : ''}</button>
            </div>
          )}
          <div className="kc-orders">
            {dayOrders(today).map((o) => {
              const done = mounted ? S.done[o.id] : 0, racked = mounted && S.rack.some((p) => p.order === o.id);
              return (
                <article key={o.id} className={'kc-order' + (done ? ' is-done' : '')} aria-label={o.title}>
                  <div className="kc-order-top"><Portrait who={o.who} size={72} /><div><small>{CUSTOMERS[o.who].name}, {CUSTOMERS[o.who].who}</small><h3>{o.title}</h3>{done ? <Stars n={done} /> : null}</div><Outline shape={o.parts[0].shape} size={72} /></div>
                  <p className="kc-ask">“{o.ask}”</p>
                  <p className="kc-tags">{o.parts.length > 1 && <span>🧩 {o.parts.map((p) => p.id).join(' + ')}</span>}{o.handle && <span>☕ handle</span>}{askChips(o).map((t) => <span key={t}>🎨 {t}</span>)}</p>
                  <button className={done ? 'kc-alt' : 'kc-go'} disabled={!ready || racked} onClick={() => openOrder(o.id)}>{racked ? '🧺 On the rack' : done ? '↺ Make it again' : 'Make it →'}</button>
                </article>
              );
            })}
          </div>
          <div className="kc-go-row">
            {mounted && dayDone(S, today) && today < DAY_COUNT && <button className="kc-go kc-night" onClick={endDay}>🌙 Close up for the day<small>on to day {today + 1}: {DAYS[today].name}</small></button>}
            {mounted && dayDone(S, today) && today === DAY_COUNT && S.ended && <button className="kc-go" onClick={() => { setEnding(true); music('ending'); }}>🧺 The picnic</button>}
            <button className="kc-alt" disabled={!ready || !mounted || !freeOpen(S)} onClick={() => openOrder(null)}>🎡 Free throw<small>{mounted && freeOpen(S) ? 'anything you like' : 'after your first order'}</small></button>
            <button className="kc-alt" onClick={() => { audio().ui(); setScreen('gallery'); }}>🖼 Gallery<small>{mounted ? `${S.gallery.length} of 12` : ' '}</small></button>
            <button className={'kc-alt' + (shop ? ' is-on' : '')} onClick={() => { audio().ui(); setShop(!shop); }} aria-expanded={shop}>🛒 Workshop shop<small>{UPGRADE_IDS.filter((u) => mounted && has(S, u)).length} of {UPGRADE_IDS.length} bought</small></button>
          </div>
          {shop && (
            <div className="kc-shop" aria-label="Workshop shop">
              {UPGRADE_IDS.map((u) => {
                const U = UPGRADES[u], got = mounted && has(S, u), open = mounted && upgradeOpen(S, u);
                return (
                  <div key={u} className={'kc-up' + (got ? ' is-got' : '')}>
                    <b>{U.icon} {U.name}</b><span>{U.blurb}</span>
                    <button className={got ? 'kc-alt' : 'kc-go'} disabled={got || !open || (mounted && S.acorns < U.cost)} onClick={() => buyUp(u)}>{got ? '✓ In the workshop' : !open ? `from day ${U.day}` : `🌰 ${U.cost}`}</button>
                  </div>
                );
              })}
            </div>
          )}
          {today > 1 && (
            <details className="kc-earlier">
              <summary>Earlier days: make an order again for a better score</summary>
              <div className="kc-orders is-small">
                {ORDERS.filter((o) => o.day < today).map((o) => (
                  <button key={o.id} className="kc-mini" disabled={!ready} onClick={() => openOrder(o.id)}><Portrait who={o.who} size={34} /><span><small>Day {o.day}</small><b>{o.title}</b></span><Stars n={mounted ? S.done[o.id] ?? 0 : 0} /></button>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------------- the gallery */}
      {screen === 'gallery' && (
        <section className="kc-menu kc-gallery" aria-label="Gallery">
          <header className="kc-head"><button className="kc-back" onClick={() => { audio().ui(); setScreen(started ? 'board' : 'menu'); }}>← Back</button><b className="kc-total">🖼 {mounted ? S.gallery.length : 0} / 12 pots</b></header>
          <h2 className="kc-title">The gallery shelves</h2>
          {mounted && S.gallery.length === 0 && <p className="kc-note">Nothing on the shelves yet. After a delivery, tap “♥ Keep one for the gallery” to keep a copy of the pot here.{has(S, 'shelf') ? '' : ' With the Display Shelf, passers-by tip an acorn for each pot every day.'}</p>}
          <div className="kc-shelves">
            {mounted && S.gallery.map((p, i) => (
              <figure key={i + p.name} className="kc-shelfpot">
                <PotThumb pot={p} size={130} />
                <figcaption><b>{p.name}</b><small>{p.finish === 'shine' ? '✨ shining' : p.finish === 'dull' ? 'matt' : 'glazed'}{p.cracked ? ' · a little crack' : ''}</small></figcaption>
                <button className="kc-x" aria-label={`Take ${p.name} off the shelf`} onClick={() => { if (!window.confirm(`Take “${p.name}” off the shelf?`)) return; S.gallery.splice(i, 1); persist(); audio().ui(); refresh(); }}>×</button>
              </figure>
            ))}
          </div>
        </section>
      )}

      {dayNews && (
        <div className="kc-panel kc-result" role="dialog" aria-label="A new day">
          <p className="kc-eyebrow">🌅 A NEW DAY · DAY {dayNews.day}</p>
          <h2>{DAYS[dayNews.day - 1].name}</h2>
          <p>{DAYS[dayNews.day - 1].blurb}</p>
          {dayNews.tips > 0 && <p className="kc-pay">+🌰 {dayNews.tips}<small> tipped by passers-by admiring the window shelf</small></p>}
          {UPGRADE_IDS.some((u) => UPGRADES[u].day === dayNews.day) && <p className="kc-note">New in the shop: {UPGRADE_IDS.filter((u) => UPGRADES[u].day === dayNews.day).map((u) => UPGRADES[u].name).join(', ')}.</p>}
          {GLAZE_IDS.some((g) => GLAZES[g].day === dayNews.day) && <p className="kc-note">A new glaze: {GLAZE_IDS.filter((g) => GLAZES[g].day === dayNews.day).map((g) => GLAZES[g].name).join(', ')}.</p>}
          <div className="kc-row"><button className="kc-go" autoFocus onClick={() => { setDayNews(null); audio().ui(); }}>Open the workshop →</button></div>
        </div>
      )}
      {ending && (
        <div className="kc-ending" role="dialog" aria-label="The valley picnic">
          <Art src="/art/pottery/ending.webp" paint="ending" w={1536} h={1024} className="kc-ending-art" />
          <div className="kc-ending-text">
            <p className="kc-eyebrow">THE TEA SET · DELIVERED</p>
            <h2>The valley picnic</h2>
            <p>The whole valley spreads out on the hill: Mrs Prickle’s blackberries in their bowl, Bramble’s pie in its dish, the ducklings’ cups and, in the middle, the great teapot. Dora pours, Enzo passes the cups, and every pot on the blanket was thrown on their wheel.</p>
            <p className="kc-final">{mounted ? starCount(S) : 0} of {totalStars} stars{mounted && starCount(S) < totalStars ? ' · make an order again for more' : ' · every star!'} · 🎡 the wheel is always free for a free throw</p>
            <div className="kc-row"><button className="kc-go" onClick={() => { setEnding(false); toBoard(); }}>Back to the workshop →</button></div>
          </div>
          <div className="kc-credits" aria-label="Cast"><div>
            <p className="kc-eyebrow">STARRING</p>
            {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
            <p className="kc-eyebrow">THANK YOU FOR PLAYING</p>
          </div></div>
        </div>
      )}
    </main>
  );
}
