'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MUSICIANS, KEYS, SAVE_KEY, TEMPO_MIN, TEMPO_MAX, MAX_ROWS, SLOTS, cloneSong, setCell, addRow, removeRow, changes, judge, describe, starBits, starCount,
  encode, decode, freshSave, readSave, recordSolve, solvedSong, emptyRow, type Save, type Song, type MusicianId, type Request, type Judgement,
} from '@/lib/band-game';
import { REQUESTS, REQ_IDS, CLEARINGS, reqOpen, clearingOpen, clearingCount, nextRequest, totalStars, jamOpen, jamCast, jamKeys, isFinale, done } from '@/lib/band-levels';
import type { BandScene, Cell } from '@/lib/band-scene';
import { BandSound, stepDur } from './sound';
import './band.css';

type Screen = 'menu' | 'pick' | 'play' | 'fest';
type Result = { bits: number; newStars: number; ch: number; first: boolean; finale: boolean };
type Drag = { m: MusicianId; step: number; x: number; y: number; base: number; mode: 'tap' | 'pitch' | 'paint'; paint: number; pointer: number; touched: Set<number>; snap: boolean };
const sceneModule = () => import('@/lib/band-scene');
const KIND: Record<string, [string, string]> = { echo: ['🎵', 'ECHO'], mood: ['🌈', 'A MOOD'], fix: ['🔧', 'FIX THE BAND'], limit: ['3️⃣', 'ONLY THREE'] };
const LAND_ICON = ['🌿', '🌊', '🍄', '🌳', '🌙'];
const CAST: [string, string][] = [['Dora', 'ukulele, and chief strummer'], ['Enzo', 'glockenspiel, and every sparkle'], ['The hedgehog', 'drums'], ['The woodpecker', 'wood blocks'], ['The frog', 'double bass'], ['The mole', 'tuba'], ['The owl', 'flute'], ['The bird choir', 'three-part harmony'], ['The whole wood', 'the best audience there is']];
const DEMO = () => solvedSong(REQUESTS['1-6']);

function Art({ src, paint, className }: { src: string; paint: 'title' | 'ending'; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => { let dead = false; sceneModule().then((m) => { const c = cv.current; if (!dead && c) m.paintStandIn(c, paint); }).catch(() => {}); return () => { dead = true; }; }, [paint]);
  return (
    <span className={'wb-art ' + (className ?? '')}>
      <canvas ref={cv} width={768} height={512} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={1536} height={1024} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}
function Portrait({ m }: { m: MusicianId }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let dead = false; sceneModule().then((x) => { if (!dead && cv.current) x.portrait(cv.current, m); }).catch(() => {}); return () => { dead = true; }; }, [m]);
  return <canvas ref={cv} className="wb-portrait" aria-hidden="true" />;
}
const Stars = ({ bits, big = false }: { bits: number; big?: boolean }) => (
  <span className={'wb-stars' + (big ? ' is-big' : '')} aria-label={`${starCount(bits)} of 3 stars`}>{[1, 2, 4].map((b) => <i key={b} className={bits & b ? 'is-on' : ''} />)}</span>
);

export default function BandPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null), cardEl = useRef<HTMLDivElement>(null), dockEl = useRef<HTMLDivElement>(null), resultEl = useRef<HTMLDivElement>(null), bannerEl = useRef<HTMLDivElement>(null);
  const scene = useRef<BandScene | null>(null), sound = useRef<BandSound | null>(null);
  const save = useRef<Save>(freshSave());
  const req = useRef<Request | null>(null), song = useRef<Song>(DEMO()), undo = useRef<Song[]>([]), verdict = useRef<Judgement | null>(null);
  const screenRef = useRef<Screen>('menu'), playingRef = useRef(false), pendingWin = useRef(false), panelRef = useRef(false);
  const hits = useRef<Partial<Record<MusicianId, number>>>({}), stepNow = useRef(-1), stepAt = useRef(0), stepLen = useRef(0.1), beatN = useRef(0), loopNow = useRef(0), humNow = useRef(false), humAt = useRef(-9);
  const wonAt = useRef(-1), ghost = useRef<{ m: MusicianId; step: number; p: number } | null>(null), sel = useRef<Cell | null>(null), drag = useRef<Drag | null>(null);
  const fest = useRef<{ list: { name: string; song: Song }[]; i: number; loops: number; startLoop: number }>({ list: [], i: 0, loops: 0, startLoop: 0 });
  const toastTimer = useRef(0), jamTimer = useRef(0), edges = useRef('');
  const [screen, setScreenState] = useState<Screen>('menu'), [result, setResult] = useState<Result | null>(null), [toast, setToast] = useState('');
  const [tip, setTip] = useState<{ title: string; text: string } | null>(null), [picker, setPicker] = useState(false), [slots, setSlots] = useState(false), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState(''), [touch, setTouch] = useState(false);
  const [codeIn, setCodeIn] = useState(''), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new BandSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3600) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const isJam = () => screenRef.current === 'play' && !req.current;
  const busy = () => screenRef.current !== 'play' || panelRef.current || paused;
  const maxRows = () => req.current?.maxRows ?? MAX_ROWS;
  const cast = (): MusicianId[] => req.current ? req.current.cast : jamCast(save.current);

  // ---------------------------------------------------------------- playing
  function play(on: boolean) {
    const a = audio();
    if (on && !playingRef.current) { a.start(() => (screenRef.current === 'fest' ? fest.current.list[fest.current.i]?.song ?? null : song.current), 'band'); playingRef.current = true; stepNow.current = -1; }
    else if (!on && playingRef.current) { a.stop(); playingRef.current = false; stepNow.current = -1; pendingWin.current = false; menuMusic(); }
    refresh();
  }
  function menuMusic() {
    const a = sound.current; if (!a) return;
    if ((screenRef.current === 'menu' || screenRef.current === 'pick') && save.current.settings.music) { if (!a.running || a.busName !== 'music') a.start(() => DEMO(), 'music'); }
    else if (a.busName === 'music') a.stop();
  }
  function hum() {
    const q = req.current; if (!q?.target || busy()) return;
    if (!playingRef.current) play(true);
    audio().hum({ ...song.current, rows: q.target.map((r) => ({ m: r.m, n: r.n.slice() })) });
    showToast('Listen: the audience hums it once round. Then the band plays again.', 3000);
  }

  // ---------------------------------------------------------------- opening
  function open(id: string) {
    const s = save.current;
    if (id === 'jam') { if (!jamOpen(s)) return; req.current = null; song.current = decode(s.jam) ?? { steps: 16, bpm: 104, swing: 0.1, key: 0, rows: [emptyRow('hedgehog', 16), emptyRow('frog', 16), emptyRow('dora', 16)] }; }
    else { if (!reqOpen(s, id)) return; const q = REQUESTS[id]; req.current = q; song.current = cloneSong(q.start); setTip(q.tip && !done(s, id) ? q.tip : null); }
    if (id === 'jam') setTip(null);
    undo.current = []; ghost.current = null; sel.current = null; drag.current = null; wonAt.current = -1; pendingWin.current = false;
    panelRef.current = false; setResult(null); setPicker(false); setSlots(false); setPaused(false); setToast('');
    rejudge(); setScreen('play');
    audio().ui(); sound.current?.stop(); playingRef.current = false; play(true);
    requestAnimationFrame(() => { layout(); canvas.current?.focus(); });
  }
  function toMenu(to: Screen = 'menu') {
    play(false); req.current = null; panelRef.current = false; setResult(null); setTip(null); setPicker(false); setSlots(false); setPaused(false); setEnding(false); setToast('');
    wonAt.current = -1; setScreen(to); menuMusic(); refresh();
  }
  function rejudge() { const q = req.current; verdict.current = q ? judge(song.current, q) : null; }

  // ---------------------------------------------------------------- editing
  function snapshot() { undo.current.push(cloneSong(song.current)); if (undo.current.length > 80) undo.current.shift(); }
  function edited() {
    rejudge(); wonAt.current = -1;
    const v = verdict.current;
    if (v?.solved) { pendingWin.current = true; if (!playingRef.current) play(true); }
    else pendingWin.current = false;
    if (ghost.current) { const g = ghost.current, r = song.current.rows.find((x) => x.m === g.m); if (r && r.n[g.step] === g.p) ghost.current = null; }
    if (isJam()) { save.current.jam = encode(song.current); persist(); }
    refresh();
  }
  function cellSet(m: MusicianId, step: number, p: number, snap = true) {
    if (busy()) return false;
    const before = song.current.rows.find((r) => r.m === m)?.n[step];
    if (before === undefined || before === (p < 0 ? -1 : p)) return false;
    if (snap) snapshot();
    setCell(song.current, m, step, p);
    if (p >= 0) audio().audition(song.current, m, p); else audio().pop();
    edited(); return true;
  }
  function addMusician(m: MusicianId) {
    if (busy()) return;
    if (song.current.rows.length >= maxRows()) { audio().nope(); showToast(req.current?.maxRows ? `Only ${req.current.maxRows} musicians fit here. Take one off first.` : 'The stage is full.'); return; }
    snapshot(); if (!addRow(song.current, m, maxRows())) { undo.current.pop(); return; }
    audio().join(); setPicker(false); edited();
    requestAnimationFrame(() => layout());
  }
  function takeOff(m: MusicianId) {
    if (busy()) return;
    snapshot(); removeRow(song.current, m); audio().pop();
    if (sel.current?.m === m) sel.current = null;
    edited(); requestAnimationFrame(() => layout());
  }
  function back() { const s = undo.current.pop(); if (!s || busy()) return; song.current = s; audio().pop(); edited(); requestAnimationFrame(() => layout()); }
  function restart() {
    if (busy()) return;
    const q = req.current;
    if (!q) { if (!window.confirm('Clear every note in the jam?')) return; snapshot(); for (const r of song.current.rows) r.n.fill(-1); }
    else { snapshot(); song.current = cloneSong(q.start); }
    audio().ui(); edited(); requestAnimationFrame(() => layout());
  }
  function tempo(d: number) {
    const q = req.current, [lo, hi] = q ? (q.tempo ?? [song.current.bpm, song.current.bpm]) : [TEMPO_MIN, TEMPO_MAX];
    const v = Math.max(lo, Math.min(hi, song.current.bpm + d)); if (v === song.current.bpm || busy()) return;
    song.current.bpm = v; audio().ui(); edited();
  }
  function hint() {
    const q = req.current; if (!q || busy()) return;
    const goal = solvedSong(q), cur = song.current;
    const missing = goal.rows.find((r) => !cur.rows.some((x) => x.m === r.m));
    const extra = cur.rows.find((r) => !goal.rows.some((x) => x.m === r.m));
    if (extra && (cur.rows.length >= maxRows() || missing)) { showToast(`Try taking the ${MUSICIANS[extra.m].name.toLowerCase()} off (the ✕ by their name).`, 5200); return; }
    if (missing) { showToast(`Try adding the ${MUSICIANS[missing.m].name.toLowerCase()}: the dashed row at the bottom.`, 5200); return; }
    for (const r of goal.rows) {
      const c = cur.rows.find((x) => x.m === r.m)!;
      const i = r.n.findIndex((v, k) => v !== c.n[k]);
      if (i >= 0) { ghost.current = { m: r.m, step: i, p: r.n[i] }; audio().ui(); showToast(r.n[i] < 0 ? `The glowing ${MUSICIANS[r.m].name.toLowerCase()} note wants taking out.` : `Try the ${MUSICIANS[r.m].name.toLowerCase()} where it glows, at that height.`, 5200); refresh(); return; }
    }
    if (goal.bpm !== cur.bpm && q.tempo) { showToast(`Try the tempo at ${goal.bpm}.`, 4200); return; }
    showToast('That’s it! Listen to the whole loop.');
  }

  // ---------------------------------------------------------------- the win
  function win() {
    const q = req.current, v = verdict.current; if (!q || !v?.solved) return;
    pendingWin.current = false; wonAt.current = audio().now();
    const ch = changes(q.start, song.current), bits = starBits(true, ch, q.par, v.flourish);
    const rec = recordSolve(save.current, q.id, bits, ch, song.current);
    const finale = isFinale(q.id) && !save.current.ended;
    if (isFinale(q.id)) save.current.ended = true;
    persist();
    audio().cheer(); sound.current?.stars(starCount(bits));
    panelRef.current = true; setTip(null); ghost.current = null; sel.current = null;
    setResult({ bits, newStars: rec.newStars, ch, first: rec.first, finale });
    refresh();
  }
  function again() { setResult(null); panelRef.current = false; wonAt.current = -1; const q = req.current; if (q) { snapshot(); song.current = cloneSong(q.start); rejudge(); } refresh(); requestAnimationFrame(() => layout()); }

  // ---------------------------------------------------------------- the festival
  function playFest() {
    const s = save.current, list: { name: string; song: Song }[] = [];
    for (const c of CLEARINGS) { const id = c.requests[c.requests.length - 1], code = s.reqs[id]?.code; list.push({ name: `${REQUESTS[id].name} · ${c.name}`, song: (code && decode(code)) || solvedSong(REQUESTS[id]) }); }
    s.slots.forEach((x) => { const d = x && decode(x.code); if (x && d) list.push({ name: `${x.name} · your song`, song: d }); });
    fest.current = { list, i: 0, loops: 0, startLoop: 0 };
    play(false); req.current = null; song.current = list[0].song; setEnding(false); setResult(null); panelRef.current = false; wonAt.current = -1;
    setScreen('fest'); audio().ui(); play(true);
    requestAnimationFrame(() => layout());
  }
  function festNext() {
    const F = fest.current;
    if (F.i + 1 >= F.list.length) { panelRef.current = true; setEnding(true); refresh(); return; }
    F.i++; F.startLoop = loopNow.current + 1; song.current = F.list[F.i].song; refresh(); requestAnimationFrame(() => layout());
  }

  // ---------------------------------------------------------------- the layout
  function layout() {
    const el = stage.current, sc = scene.current; if (!el || !sc) return;
    sc.resize();
    const r = el.getBoundingClientRect(), b = (cardEl.current ?? bannerEl.current ?? bar.current)?.getBoundingClientRect();
    const d = (resultEl.current ?? dockEl.current)?.getBoundingClientRect();
    sc.inset = { top: b && b.height > 0 ? Math.max(8, b.bottom - r.top + 6) : 8, bottom: d && d.height > 0 ? Math.max(8, r.bottom - d.top + 6) : 8, left: 6, right: 6 };
    const s = screenRef.current === 'fest' ? fest.current.list[fest.current.i]?.song ?? song.current : song.current, canAdd = screenRef.current === 'play' && s.rows.length < maxRows() && cast().some((m) => !s.rows.some((x) => x.m === m));
    sc.layout(s.rows.map((x) => x.m), s.steps, canAdd);
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })(), (id) => id in REQUESTS);
    setTouch(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    setMounted(true); refresh();
    const w = window as unknown as Record<string, unknown>;
    w.__band = () => ({
      screen: screenRef.current, req: req.current?.id ?? null, song: cloneSong(song.current), playing: playingRef.current, step: stepNow.current, loop: loopNow.current,
      solved: !!verdict.current?.solved, close: verdict.current?.close ?? 0, changes: req.current ? changes(req.current.start, song.current) : 0, pending: pendingWin.current,
      won: wonAt.current >= 0, result: !!panelRef.current, humming: humNow.current, ghost: ghost.current, save: save.current, fest: screenRef.current === 'fest' ? fest.current.i : -1,
    });
    w.__bandOpen = (id: string) => open(id);
    w.__bandSolve = () => { const q = req.current; if (!q) return false; snapshot(); song.current = solvedSong(q); edited(); requestAnimationFrame(() => layout()); return true; };
    w.__bandSet = (m: MusicianId, step: number, p: number) => cellSet(m, step, p);
    w.__bandCell = (m: MusicianId, step: number, frac = 0.5) => { const sc = scene.current, cv = canvas.current; const R = sc?.cellRect(m, step); if (!R || !cv) return null; const b = cv.getBoundingClientRect(); return [b.left + R.x + R.w / 2, b.top + R.y + R.h * frac]; };
    w.__bandX = (m: MusicianId) => { const p = scene.current?.xSpot(m), cv = canvas.current; if (!p || !cv) return null; const b = cv.getBoundingClientRect(); return [b.left + p[0], b.top + p[1]]; };
    w.__bandLayout = () => {
      const sc = scene.current, cv = canvas.current, L = sc?.lay; if (!L || !cv) return null;
      const b = cv.getBoundingClientRect(), s = L.ps;
      const box = (p: [number, number], k: number) => ({ x: b.left + p[0] - s * 0.4 * k, y: b.top + p[1] - s * 0.95 * k, w: s * 0.8 * k, h: s * 0.95 * k });
      return { grid: { x: b.left + L.grid.x, y: b.top + L.grid.y, w: L.grid.w, h: L.grid.h }, dora: box(L.dora, 1), enzo: box(L.enzo, 1.04), face: { dora: box([L.dora[0], L.dora[1] - s * 0.45], 0.55), enzo: box([L.enzo[0], L.enzo[1] - s * 0.47], 0.57) }, ps: s, rh: L.rh, cw: L.cw, aud: L.aud };
    };
    w.__bandFest = () => playFest();
    w.__bandSkipFest = () => { panelRef.current = true; setEnding(true); refresh(); };
    let dead = false, raf = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.BandScene(canvas.current); } catch { setError('This browser cannot draw the stage.'); return; }
      if (stage.current) ro?.observe(stage.current);
      window.addEventListener('resize', layout); layout();
      setReady(true);
      const loop = () => {
        const a = sound.current, now = a ? a.now() : performance.now() / 1000;
        // steps that have sounded: bob the musicians who played, and look for the loop coming round
        if (a && playingRef.current) {
          const q = a.queue;
          while (q.length && q[0].at <= now) {
            const e = q.shift()!; if (e.bus !== 'band') continue;
            const s = screenRef.current === 'fest' ? fest.current.list[fest.current.i]?.song : song.current; if (!s) continue;
            if (e.step === 0 && e.loop !== loopNow.current) {
              loopNow.current = e.loop;
              if (pendingWin.current && verdict.current?.solved && !panelRef.current) win();
              if (screenRef.current === 'fest' && !panelRef.current && e.loop - fest.current.startLoop >= (fest.current.list[fest.current.i]?.song.steps === 8 ? 4 : 2)) festNext();
            }
            stepNow.current = e.step; stepAt.current = e.at; stepLen.current = stepDur(s); humNow.current = e.hum;
            if (e.step % (s.steps / 4) === 0) beatN.current++;
            if (e.hum) humAt.current = e.at;
            else for (const r of s.rows) if (r.n[e.step] >= 0) { hits.current[r.m] = e.at; if (r.m !== 'hedgehog' && r.m !== 'woodpecker' && (e.step % 2 === 0)) scene.current?.puff(r.m, e.at); }
          }
          if (!a.running) humNow.current = false;
        }
        const sc = scene.current!, scr = screenRef.current;
        // the card and the dock change size as they fill in (a tick, a font, a new line): keep the stage clear of them
        { const t = (cardEl.current ?? bannerEl.current ?? bar.current)?.getBoundingClientRect().bottom ?? 0, b = (resultEl.current ?? dockEl.current)?.getBoundingClientRect().top ?? 0, k = `${Math.round(t)}:${Math.round(b)}`; if (k !== edges.current) { edges.current = k; layout(); } }
        { const cur = scr === 'fest' ? fest.current.list[fest.current.i]?.song : song.current; if (cur && sc.lay && (sc.lay.rows.join() !== cur.rows.map((r) => r.m).join() || Math.round((sc.lay.grid.w - sc.lay.lw) / sc.lay.cw) !== cur.steps)) layout(); }
        if (scr === 'play' || scr === 'fest') {
          const s = scr === 'fest' ? fest.current.list[fest.current.i]?.song ?? song.current : song.current;
          const per = s.steps / 4, phase = playingRef.current && stepNow.current >= 0 ? Math.max(0, Math.min(1, ((stepNow.current % per) + Math.min(1, (now - stepAt.current) / Math.max(0.03, stepLen.current))) / per)) : 0;
          const q = req.current, dg = drag.current;
          sc.draw({
            t: now, song: s, land: scr === 'fest' ? 4 : q ? q.clearing : Math.max(0, Math.min(4, s.key)), playing: playingRef.current, step: stepNow.current, phase, beat: beatN.current,
            hits: hits.current, humming: humNow.current && playingRef.current, humAt: humAt.current, close: scr === 'fest' ? 1 : q ? (verdict.current?.close ?? 0) : 0.8, won: wonAt.current,
            guide: q?.target ?? null, ghost: ghost.current, sel: sel.current, drag: dg && dg.mode === 'pitch' ? { m: dg.m, step: dg.step, p: s.rows.find((r) => r.m === dg.m)?.n[dg.step] ?? -1 } : null,
            canAdd: sc.lay?.add ?? false, fest: scr === 'fest', addLabel: touch ? '+ a musician' : '+ add a musician', locked: scr === 'fest' || panelRef.current,
          });
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The stage could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tgt = e.target as HTMLElement;
      if (tgt.closest?.('input, textarea')) return;
      if (screenRef.current === 'fest' && k === 'escape') { e.preventDefault(); panelRef.current = true; setEnding(true); refresh(); return; }
      if (screenRef.current !== 'play' || panelRef.current) return;
      if (k === 'escape') { e.preventDefault(); if (sel.current) { sel.current = null; refresh(); return; } setPaused((p) => !p); return; }
      if (tgt.closest?.('button, a') && (k === 'enter' || k === ' ')) return;
      const s = song.current;
      if (k === ' ') { e.preventDefault(); play(!playingRef.current); return; }
      if ((k === 'z' && (e.ctrlKey || e.metaKey)) || k === 'u') { e.preventDefault(); back(); return; }
      if (k === 'h' && req.current?.target) { e.preventDefault(); hum(); return; }
      if (k === '?') { e.preventDefault(); hint(); return; }
      if (k === '[' || k === '-') { e.preventDefault(); tempo(-4); return; }
      if (k === ']' || k === '=' || k === '+') { e.preventDefault(); tempo(4); return; }
      if (k === 'a') { e.preventDefault(); setPicker(true); return; }
      if (!s.rows.length) return;
      const c = sel.current ?? { m: s.rows[0].m, step: 0 }, ri = Math.max(0, s.rows.findIndex((r) => r.m === c.m)), row = s.rows[ri], v = row?.n[c.step] ?? -1;
      if (k.startsWith('arrow')) {
        e.preventDefault();
        if (!sel.current) { sel.current = c; refresh(); return; }
        if (e.shiftKey && (k === 'arrowup' || k === 'arrowdown')) { if (v >= 0) cellSet(c.m, c.step, Math.max(0, Math.min(MUSICIANS[c.m].span - 1, v + (k === 'arrowup' ? 1 : -1)))); return; }
        if (k === 'arrowleft') sel.current = { m: c.m, step: (c.step + s.steps - 1) % s.steps };
        if (k === 'arrowright') sel.current = { m: c.m, step: (c.step + 1) % s.steps };
        if (k === 'arrowup') sel.current = { m: s.rows[(ri + s.rows.length - 1) % s.rows.length].m, step: c.step };
        if (k === 'arrowdown') sel.current = { m: s.rows[(ri + 1) % s.rows.length].m, step: c.step };
        refresh(); return;
      }
      if (k === 'enter' || k === 'x') { e.preventDefault(); sel.current = c; cellSet(c.m, c.step, v >= 0 ? -1 : MUSICIANS[c.m].def); return; }
      if (k === 'w' || k === 's') { e.preventDefault(); sel.current = c; const nv = v < 0 ? MUSICIANS[c.m].def : Math.max(0, Math.min(MUSICIANS[c.m].span - 1, v + (k === 'w' ? 1 : -1))); cellSet(c.m, c.step, nv); return; }
    };
    const blur = () => { sound.current?.suspend(); };
    const focus = () => { if (!document.hidden) sound.current?.resume(); };
    const vis = () => { if (document.hidden) blur(); else focus(); };
    window.addEventListener('keydown', keydown); window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', vis);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); sound.current = null; ro?.disconnect(); window.clearTimeout(toastTimer.current); window.clearTimeout(jamTimer.current);
      window.removeEventListener('resize', layout); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    requestAnimationFrame(() => layout());
    const t1 = window.setTimeout(layout, 150), t2 = window.setTimeout(layout, 500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, result, touch, tip, ending]);

  // ---------------------------------------------------------------- the pointer: tap a cell, drag up and down for pitch, drag along to paint
  const local = (e: { clientX: number; clientY: number }): [number, number] => { const b = canvas.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onDown = (e: React.PointerEvent) => {
    if (busy() || drag.current) return;
    audio(); if (e.pointerType !== 'mouse' && !touch) setTouch(true);
    const sc = scene.current; if (!sc) return;
    const [x, y] = local(e), lab = sc.labelAt(x, y);
    if (lab === 'add') { audio().ui(); setPicker(true); return; }
    if (lab) { if (lab.remove) takeOff(lab.m); else { const r = song.current.rows.find((q) => q.m === lab.m); audio().audition(song.current, lab.m, r?.n.find((v) => v >= 0) ?? MUSICIANS[lab.m].def); hits.current[lab.m] = audio().now(); } return; }
    const cell = sc.cellAt(x, y); if (!cell) { sel.current = null; refresh(); return; }
    const v = song.current.rows.find((r) => r.m === cell.m)?.n[cell.step] ?? -1;
    sel.current = cell;
    drag.current = { m: cell.m, step: cell.step, x, y, base: v, mode: 'tap', paint: v >= 0 ? -1 : MUSICIANS[cell.m].def, pointer: e.pointerId, touched: new Set([cell.step]), snap: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone */ }
    refresh();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, sc = scene.current; if (!d || e.pointerId !== d.pointer || !sc?.lay) return;
    const [x, y] = local(e), dx = x - d.x, dy = d.y - y;
    if (d.mode === 'tap') {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) d.mode = 'pitch';
      else if (Math.abs(dx) > Math.max(12, sc.lay.cw * 0.6)) { d.mode = 'paint'; if (cellSet(d.m, d.step, d.paint)) d.snap = true; }
      else return;
    }
    if (d.mode === 'pitch') {
      const M = MUSICIANS[d.m], per = Math.max(e.pointerType === 'mouse' ? 9 : 13, Math.min(22, sc.lay.rh * 0.5 / Math.max(1, M.span - 1) * 2));
      const base = d.base >= 0 ? d.base : M.def, p = Math.max(0, Math.min(M.span - 1, base + Math.round(dy / per)));
      if (cellSet(d.m, d.step, p, !d.snap)) d.snap = true;
    } else {
      const c = sc.cellAt(x, Math.min(Math.max(y, 0), sc.lay.H)), r = sc.lay.rows.indexOf(d.m);
      const step = c && c.m === d.m ? c.step : Math.floor((x - sc.lay.grid.x - sc.lay.lw) / sc.lay.cw);
      void r;
      if (step >= 0 && step < song.current.steps && !d.touched.has(step)) { d.touched.add(step); if (cellSet(d.m, step, d.paint, !d.snap)) d.snap = true; sel.current = { m: d.m, step }; }
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || e.pointerId !== d.pointer) return;
    drag.current = null;
    if (d.mode === 'tap') cellSet(d.m, d.step, d.base >= 0 ? -1 : MUSICIANS[d.m].def);
    refresh();
  };

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); else { a.setMusic(S.settings.music); menuMusic(); }
    a.ui(); refresh();
  };
  const settings = (
    <span className="wb-chips">
      <button className="wb-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="wb-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
    </span>
  );

  const q = req.current, s = song.current, v = verdict.current, jam = screen === 'play' && !q;
  const ch = q ? changes(q.start, s) : 0;
  const nextId = mounted ? nextRequest(S) : null;
  const totalMax = REQ_IDS.length * 3;
  const nextAfter = (id: string) => { const i = REQ_IDS.indexOf(id); return i >= 0 && i + 1 < REQ_IDS.length ? REQ_IDS[i + 1] : null; };
  const rec = q ? S.reqs[q.id] : undefined;
  const tempoOn = jam || !!q?.tempo;
  const slotSave = (i: number) => { const name = (window.prompt('A name for this song?', S.slots[i]?.name ?? `Song ${i + 1}`) ?? '').trim().slice(0, 24); if (!name) return; S.slots[i] = { name, code: encode(s) }; persist(); audio().join(); showToast(`Saved as “${name}”.`); refresh(); };
  const slotLoad = (i: number) => { const d = S.slots[i] && decode(S.slots[i]!.code); if (!d) return; snapshot(); song.current = d; audio().ui(); setSlots(false); edited(); requestAnimationFrame(() => layout()); };
  const codeLoad = () => { const d = decode(codeIn); if (!d) { audio().nope(); showToast('That code doesn’t look right. Check every letter.'); return; } const ok = d.rows.every((r) => jamCast(S).includes(r.m)); if (!ok) { audio().nope(); showToast('That song needs a musician you haven’t met yet.'); return; } snapshot(); song.current = d; setCodeIn(''); setSlots(false); audio().join(); edited(); requestAnimationFrame(() => layout()); };
  const copyCode = () => { const c = encode(s); try { void navigator.clipboard?.writeText(c); } catch { /* no clipboard */ } showToast('Copied the song code.'); };

  return (
    <main className="wb-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? 'true' : undefined} data-result={result ? 'true' : undefined} data-land={q ? q.clearing : 0}>
      {screen === 'play' && (
        <header className="wb-bar" ref={bar}>
          <button className="wb-back" onClick={() => toMenu(q ? 'pick' : 'menu')}>← {q ? 'Clearings' : 'Menu'}</button>
          <b className="wb-name"><small>{q ? `${q.id} · ${KIND[q.kind][1]}` : 'JAM'}</small> {q ? q.name : 'The Jam Stage'}</b>
          {q && <span className="wb-par" title={`Changes from the start. ${q.par} or fewer earns the second star.`} data-testid="changes">✎ <b>{ch}</b><small> / par {q.par}</small></span>}
          {q && rec?.done && <Stars bits={rec.stars} />}
          <button className="wb-chip wb-pause" onClick={() => setPaused(true)} aria-label="Pause" disabled={!!result}>❚❚</button>
        </header>
      )}
      <div className="wb-stage" ref={stage}>
        <canvas ref={canvas} className="wb-canvas" tabIndex={0} data-testid="stage" aria-label="The stage grid. Tap a cell to play a note there; drag up or down on it to change the note."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && q && !result && (
          <div className="wb-card" ref={cardEl} role="status">
            <p className="wb-ask"><span className="wb-kind">{KIND[q.kind][0]}</span>“{q.ask}”</p>
            <ul className="wb-rules">
              {(q.target ?? []).map((t, i) => <li key={'t' + i} className={v?.parts[i]?.ok ? 'is-ok' : ''}>{v?.parts[i]?.ok ? '✓' : '○'} the hummed {MUSICIANS[t.m].name.toLowerCase()} part{v && !v.parts[i]?.ok ? ` · ${Math.round((v.parts[i]?.score ?? 0) * 100)}%` : ''}</li>)}
              {q.rules.map((r, i) => { const p = v?.parts[(q.target?.length ?? 0) + i]; return <li key={i} className={p?.ok ? 'is-ok' : ''}>{p?.ok ? '✓' : '○'} {describe(r, s.key)}</li>; })}
              {q.maxRows && <li className={v?.limitOk ? 'is-ok' : ''}>{v?.limitOk ? '✓' : '○'} only {q.maxRows} musicians on stage</li>}
              <li className={'is-flourish' + (v?.flourish ? ' is-ok' : '')}>★ {q.flourish.text}</li>
            </ul>
            <span className="wb-meter" aria-label={`The audience: ${Math.round((v?.close ?? 0) * 100)}% happy`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={(v?.close ?? 0) >= (i + 1) / 5 - 0.001 ? 'is-on' : ''} />)}</span>
          </div>
        )}
        {screen === 'play' && !result && (
          <div className="wb-dock" ref={dockEl} role="toolbar" aria-label="The band">
            <button className={'wb-play' + (playingRef.current ? ' is-on' : '')} onClick={() => play(!playingRef.current)} data-testid="play">{playingRef.current ? '■ Stop' : '▶ Play'}</button>
            {q?.target && <button className="wb-btn wb-hum" onClick={hum} title="Hear the tune (H)">🎵 <span>Hear the tune</span></button>}
            {tempoOn && <span className="wb-tempo" aria-label="Tempo"><button className="wb-btn" onClick={() => tempo(-4)} aria-label="Slower" title="Slower ([)">−</button><b data-testid="tempo">{s.bpm}</b><small>tempo</small><button className="wb-btn" onClick={() => tempo(4)} aria-label="Quicker" title="Quicker (])">+</button></span>}
            {jam && <button className="wb-btn" onClick={() => { const ks = jamKeys(S), i = ks.indexOf(s.key); song.current.key = ks[(i + 1) % ks.length]; audio().ui(); edited(); }} title="Change key">🎼 <span>{KEYS[s.key].name}</span></button>}
            {jam && <button className="wb-btn" onClick={() => { song.current.swing = s.swing > 0 ? 0 : 0.16; audio().ui(); edited(); }} aria-pressed={s.swing > 0} title="Swing">〰 <span>{s.swing > 0 ? 'Swing' : 'Straight'}</span></button>}
            <span className="wb-tools">
              <button className="wb-btn" onClick={() => setPicker(true)} disabled={s.rows.length >= maxRows()} aria-label="Add a musician" title="Add a musician (A)">➕</button>
              <button className="wb-btn" onClick={back} disabled={!undo.current.length} aria-label="Undo" title="Undo (U)">↶</button>
              {q && <button className="wb-btn" onClick={hint} aria-label="Hint" title="A hint (?)">💡</button>}
              <button className="wb-btn" onClick={restart} aria-label={q ? 'Start over' : 'Clear'} title={q ? 'Start over' : 'Clear every note'}>{q ? '⟲' : '🗑'}</button>
              {jam && <button className="wb-btn" onClick={() => { audio().ui(); setSlots(true); }} aria-label="Songs and codes" title="Save, load and share">💾</button>}
            </span>
          </div>
        )}
        {toast && <p className="wb-toast" role="status">{toast}</p>}
        {tip && screen === 'play' && !result && (
          <div className="wb-panel wb-tip" role="dialog" aria-label={tip.title}>
            <p className="wb-eyebrow">✦ HOW IT GOES</p><h3>{tip.title}</h3><p>{tip.text}</p>
            <button className="wb-go" autoFocus onClick={() => { setTip(null); audio().ui(); canvas.current?.focus(); }}>Got it</button>
          </div>
        )}
        {screen === 'fest' && !ending && (
          <div className="wb-banner" ref={bannerEl}><p className="wb-eyebrow">✦ THE MOONLIGHT FESTIVAL ✦</p><b>{fest.current.list[fest.current.i]?.name}</b><small>song {fest.current.i + 1} of {fest.current.list.length}</small>
            <button className="wb-chip" onClick={festNext}>Next ▸</button><button className="wb-chip" onClick={() => { panelRef.current = true; setEnding(true); refresh(); }}>Skip ▸▸</button></div>
        )}
      </div>
      {error && <div className="wb-panel wb-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="wb-menu" aria-label="Woodland Band">
          <header className="wb-head"><a href="/" className="wb-back">← Arcade</a>{settings}</header>
          <div className="wb-hero">
            <Art src="/art/band/title.webp" paint="title" className="wb-hero-art" />
            <div className="wb-hero-text">
              <p className="wb-eyebrow">✦ A MUSIC-MAKING TOY AND PUZZLE ✦</p>
              <h1>Woodland<em>Band</em></h1>
              <p className="wb-lede">Dora strums, Enzo sparkles, and the hedgehog, the frog, the owl and friends play along. Paint notes on the stage, and play the clearings of the wood what they ask for.</p>
              <div className="wb-go-row">
                <button className="wb-go" disabled={!ready} onClick={() => open(nextId ?? REQ_IDS[REQ_IDS.length - 1])}>{!ready ? 'Tuning up…' : mounted && REQ_IDS.some((id) => done(S, id)) ? 'Continue ♪' : 'Start playing ♪'}<small>{mounted ? (nextId ? `${nextId} · ${REQUESTS[nextId].name}` : 'every request played!') : ' '}</small></button>
                <button className="wb-alt" disabled={!ready} onClick={() => { audio().ui(); setScreen('pick'); menuMusic(); }}>🌳 Clearings<small>{mounted ? `${totalStars(S)} of ${totalMax} stars` : ' '}</small></button>
                {mounted && jamOpen(S) ? <button className="wb-alt" disabled={!ready} onClick={() => open('jam')}>🎶 Jam<small>your own songs</small></button> : <button className="wb-alt" disabled>🎶 Jam<small>after two requests</small></button>}
                {mounted && S.ended && <button className="wb-alt" disabled={!ready} onClick={playFest}>🌙 Festival<small>for the whole wood</small></button>}
              </div>
            </div>
          </div>
          <ol className="wb-how" aria-label="How to play">
            <li><b>♪ Tap a cell</b> to put a note there. The band plays round and round, so you hear it at once.</li>
            <li><b>↕ Drag up or down</b> on a note to change it. Every note is in key, so nothing sounds wrong.</li>
            <li><b>🎵 Requests</b>: hum a tune back, play a mood, fix a muddled part, or make do with three.</li>
            <li><b>★ Three stars</b>: solve it, with par changes or fewer, and play the flourish too.</li>
          </ol>
          <p className="wb-keys"><kbd>Space</kbd> play / stop · arrows choose a cell · <kbd>Enter</kbd> note on or off · <kbd>W</kbd>/<kbd>S</kbd> higher, lower · <kbd>H</kbd> hear the tune · <kbd>A</kbd> add a musician · <kbd>[</kbd> <kbd>]</kbd> tempo · <kbd>U</kbd> undo · <kbd>?</kbd> hint · <kbd>Esc</kbd> pause</p>
        </section>
      )}

      {screen === 'pick' && (
        <section className="wb-menu wb-pick" aria-label="Clearings">
          <header className="wb-head"><button className="wb-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← Back</button><b className="wb-total">★ {mounted ? totalStars(S) : 0} / {totalMax}</b>{settings}</header>
          {CLEARINGS.map((c, ci) => {
            const op = mounted && clearingOpen(S, ci);
            return (
              <section key={c.id} className={'wb-clearing' + (op ? '' : ' is-locked')} data-land={ci} aria-label={c.name}>
                <div className="wb-clearing-head"><span className="wb-clearing-icon" aria-hidden="true">{LAND_ICON[ci]}</span>
                  <div><small>CLEARING {ci + 1} · {mounted ? clearingCount(S, ci) : 0}/6 PLAYED · {KEYS[c.key].name.toUpperCase()}</small><h2>{op ? c.name : '🔒 ' + c.name}</h2><p>{op ? c.blurb : `Opens after “${CLEARINGS[ci - 1]?.name}”.`}</p></div>
                </div>
                <div className="wb-grid">
                  {c.requests.map((id) => {
                    const Q = REQUESTS[id], o = mounted && reqOpen(S, id), d = mounted ? S.reqs[id] : undefined;
                    return (
                      <button key={id} className={'wb-req' + (o ? '' : ' is-locked') + (d?.done ? ' is-done' : '')} data-kind={Q.kind} disabled={!o || !ready} onClick={() => open(id)} aria-label={`${id}: ${Q.name}${o ? '' : ' (locked)'}`}>
                        <small>{id} · {KIND[Q.kind][0]} {KIND[Q.kind][1]}</small>
                        <b>{o ? Q.name : '🔒 ' + Q.name}</b>
                        <Stars bits={d?.stars ?? 0} />
                        <em>{d?.done && d.best !== null ? `best ✎ ${d.best} · par ${Q.par}` : o ? `par ✎ ${Q.par}` : 'play the one before'}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="wb-note">Stars: ★ solve it · ★ with par changes or fewer · ★ play the flourish.</p>
        </section>
      )}

      {screen === 'play' && result && q && (
        <div className="wb-panel wb-result" ref={resultEl} role="dialog" aria-label="Solved">
          <div className="wb-result-head"><div><p className="wb-eyebrow">{q.id} · THE AUDIENCE LOVES IT!</p><h2>{q.name}</h2><p className="wb-after">“{q.after}”</p></div><Stars bits={result.bits} big /></div>
          <ul className="wb-tiers">
            <li className="is-on"><b>★</b> solved</li>
            <li className={result.bits & 2 ? 'is-on' : ''}><b>★</b> {result.ch} change{result.ch === 1 ? '' : 's'} (par {q.par})</li>
            <li className={result.bits & 4 ? 'is-on' : ''}><b>★</b> {q.flourish.text}</li>
          </ul>
          <div className="wb-row">
            {result.finale ? <button className="wb-go" autoFocus onClick={playFest}>On to the Festival ♪</button>
              : (() => { const n = nextAfter(q.id); return n && reqOpen(S, n) ? <button className="wb-go" autoFocus onClick={() => open(n)}>Next ♪<small>{n} · {REQUESTS[n].name}</small></button> : null; })()}
            <button className="wb-alt" onClick={again}>⟲ Again</button>
            <button className="wb-alt" onClick={() => toMenu('pick')}>🌳 Clearings</button>
          </div>
        </div>
      )}
      {picker && screen === 'play' && (
        <div className="wb-panel wb-picker" role="dialog" aria-label="Add a musician">
          <p className="wb-eyebrow">✦ WHO JOINS THE BAND?</p>
          <div className="wb-cast">
            {cast().map((m) => { const on = s.rows.some((r) => r.m === m), full = s.rows.length >= maxRows(); return (
              <button key={m} className={'wb-who' + (on ? ' is-on' : '')} disabled={on || full} onClick={() => addMusician(m)} data-who={m}>
                <Portrait m={m} /><b>{MUSICIANS[m].name}</b><small>{on ? 'already playing' : MUSICIANS[m].plays}</small>
              </button>); })}
          </div>
          {s.rows.length >= maxRows() && <p className="wb-note">The stage is full: take someone off with the ✕ by their name.</p>}
          <button className="wb-alt" onClick={() => setPicker(false)}>Close</button>
        </div>
      )}
      {slots && jam && (
        <div className="wb-panel wb-slots" role="dialog" aria-label="Songs">
          <p className="wb-eyebrow">✦ YOUR SONGS</p>
          <div className="wb-slot-list">
            {Array.from({ length: SLOTS }, (_, i) => (
              <div key={i} className="wb-slot"><b>{S.slots[i]?.name ?? `Empty slot ${i + 1}`}</b>
                <button className="wb-btn" onClick={() => slotSave(i)}>Save here</button>
                <button className="wb-btn" onClick={() => slotLoad(i)} disabled={!S.slots[i]}>Load</button></div>
            ))}
          </div>
          <p className="wb-note">Saved songs play at the Moonlight Festival.</p>
          <div className="wb-share"><small>THIS SONG’S CODE</small><code data-testid="code">{encode(s)}</code><button className="wb-btn" onClick={copyCode}>Copy</button></div>
          <div className="wb-share"><input value={codeIn} onChange={(e) => setCodeIn(e.target.value)} placeholder="Paste a song code" aria-label="A song code" /><button className="wb-btn" onClick={codeLoad} disabled={!codeIn.trim()}>Load code</button></div>
          <button className="wb-alt" onClick={() => setSlots(false)}>Close</button>
        </div>
      )}
      {paused && screen === 'play' && (
        <div className="wb-panel wb-pausecard" role="dialog" aria-label="Paused">
          <h2>Interval</h2><p>The band is having a sip of dew.</p>{settings}
          <div className="wb-row"><button className="wb-go" onClick={() => setPaused(false)}>Back on stage</button><button className="wb-alt" onClick={() => toMenu(q ? 'pick' : 'menu')}>{q ? 'Clearings' : 'Menu'}</button><button className="wb-alt" onClick={() => toMenu()}>Menu</button></div>
        </div>
      )}
      {ending && (
        <div className="wb-ending" role="dialog" aria-label="The Moonlight Festival">
          <Art src="/art/band/ending.webp" paint="ending" className="wb-ending-art" />
          <div className="wb-ending-text">
            <p className="wb-eyebrow">✦ FIVE CLEARINGS · THIRTY REQUESTS ✦</p>
            <h2>The Moonlight Festival</h2>
            <p>The lanterns came on one by one, the fireflies found their places, and the whole wood sat down in the moss to listen. Dora strummed, Enzo sparkled, the hedgehog kept the time and the owl played the old moon song. Then every song you made was played, one after another, until the moon was high and the rabbits had danced their feet sore.</p>
            <p className="wb-final">★ {mounted ? totalStars(S) : 0} of {totalMax} stars{mounted && totalStars(S) < totalMax ? ' · fewer changes and flourishes earn the rest' : ' · every star!'} · 🎶 the jam stage is always open</p>
            <div className="wb-row"><button className="wb-go" onClick={() => { setEnding(false); toMenu('pick'); }}>🌳 Clearings</button><button className="wb-alt" onClick={() => { setEnding(false); open('jam'); }}>🎶 Jam</button><button className="wb-alt" onClick={() => { setEnding(false); toMenu(); }}>Menu</button></div>
          </div>
          <div className="wb-credits" aria-label="The band"><div><p className="wb-eyebrow">THE WOODLAND BAND</p>{CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}<p className="wb-eyebrow">THANK YOU FOR LISTENING</p></div></div>
        </div>
      )}
    </main>
  );
}

