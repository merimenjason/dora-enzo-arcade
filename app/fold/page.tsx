'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FoldGame, PUZZLES, CHAPTERS, SAVE_KEY, SEAL_NAMES, readSave, freshSave, record, chapterOpen, puzzleOpen, nextPuzzle, doneIn, sealCount,
  chapterPuzzles, puzzle, foldText, paperKey, sameFold, type Save, type Seal, type Fold, type ChapterId,
} from '@/lib/fold-game';
import type { FoldScene, Mood } from '@/lib/fold-scene';
import { FoldSound, type SongId } from './sound';
import './fold.css';

type Screen = 'menu' | 'book' | 'play' | 'festival' | 'ending';
type Result = { seal: Seal; folds: number; par: number; better: boolean; first: boolean; id: string };
const sceneModule = () => import('@/lib/fold-scene');
const SEAL_ICON = ['', '◎', '✦', '★'];
const CHEERS: Record<number, string[]> = {
  3: ['Perfect folding!', 'Crisp as a cracker!', 'Exactly in par!'],
  2: ['Lovely! A few extra folds.', 'Nearly perfect!'],
  1: ['Folded! Try again for gold?', 'There it is!'],
};

/** A painting with a cut-paper stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className }: { src: string; paint: 'title' | 'ending'; w: number; h: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => { const c = cv.current; if (dead || !c) return; if (paint === 'title') m.paintTitle(c); else m.paintEnding(c); }).catch(() => {});
    return () => { dead = true; };
  }, [paint]);
  return (
    <span className={'pf-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}

/** A tiny drawing of a page's target, for the page list and the result card. */
function Thumb({ id, size = 64, piece = false }: { id: string; size?: number; piece?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current?.getContext('2d'); if (dead || !c) return;
      const p = puzzle(id), d = Math.min(2, window.devicePixelRatio || 1);
      c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, size, size);
      if (piece) { m.drawPiece(c, p.piece, p.front, p.back, size / 2, size / 2, size * 0.62, 0.5, 0); return; }
      const t = p.target, s = Math.min((size - 10) / t.w, (size - 10) / t.h);
      m.drawPicture(c, t, (size - t.w * s) / 2, (size - t.h * s) / 2, s);
    }).catch(() => {});
    return () => { dead = true; };
  }, [id, size, piece]);
  return <canvas ref={cv} className="pf-thumb" width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}

const pageNo = (id: string) => { const p = PUZZLES.find((x) => x.id === id)!, ci = CHAPTERS.findIndex((c) => c.id === p.chapter); return `${ci + 1}-${chapterPuzzles(p.chapter).indexOf(p) + 1}`; };

export default function FoldPage() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const scene = useRef<FoldScene | null>(null), sound = useRef<FoldSound | null>(null);
  const save = useRef<Save>(freshSave()), game = useRef<FoldGame | null>(null);
  const screenRef = useRef<Screen>('menu'), resetsRef = useRef(0), kbd = useRef<{ x: number; y: number; axis: 'x' | 'y' } | null>(null);
  const press = useRef<{ id: number; x: number; y: number; type: string } | null>(null), pending = useRef<Fold | null>(null), endTimer = useRef(0), toastTimer = useRef(0);
  const [screen, setScreenState] = useState<Screen>('menu'), [chapter, setChapter] = useState<ChapterId>('lanterns');
  const [result, setResult] = useState<Result | null>(null), [toast, setToast] = useState(''), [tip, setTip] = useState<{ title: string; text: string } | null>(null);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [touch, setTouch] = useState(false), [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new FoldSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };
  const showToast = (t: string, ms = 3400) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), ms); };
  const song = (id: SongId) => sound.current?.music(id);
  const mood = (dora: Mood, enzo: Mood) => { const sc = scene.current; if (sc) sc.mood = { dora, enzo }; };

  function startPuzzle(id: string) {
    const sc = scene.current; if (!sc) return;
    window.clearTimeout(endTimer.current);
    const g = new FoldGame(id); game.current = g; resetsRef.current = 0; kbd.current = null; pending.current = null;
    sc.festival = null; sc.setPuzzle(id, g.sheet, g.paper, g.p.target); mood('curious', 'curious');
    setResult(null); setScreen('play'); song(g.p.chapter);
    const ch = CHAPTERS.find((c) => c.id === g.p.chapter)!;
    if (!S.tips.includes(ch.id)) { S.tips.push(ch.id); persist(); setTip(ch.tip); }
    if (g.p.tip && !S.tips.includes(id)) { S.tips.push(id); persist(); showToast(g.p.tip, 7000); } else setToast('');
    requestAnimationFrame(() => { sc.resize(); canvas.current?.focus(); });
  }
  function openFestival(fresh?: string) {
    const sc = scene.current; if (!sc) return;
    sc.festival = { done: PUZZLES.filter((p) => S.done[p.id]).map((p) => p.id), fresh, freshT: fresh ? 0 : 1, lit: S.ended ? 1 : 0 };
    setResult(null); setScreen('festival'); song('festival');
    if (fresh) sound.current?.float();
    requestAnimationFrame(() => sc.resize());
  }

  /** Makes a fold, with its sound, the reactions, and the finish when the picture matches. */
  function doFold(f: Fold) {
    const g = game.current, sc = scene.current; if (!g || !sc || sc.busy || g.solved) return;
    const ev = g.fold(f);
    for (const e of ev) {
      if (e.kind === 'blocked') { sc.shake(f); sound.current?.nope(); showToast(e.why, 2600); mood('thinking', 'curious'); }
      if (e.kind === 'fold') {
        sc.playFold(e.fold, e.under, e.before, e.after); sound.current?.fold(e.under, Math.max(...[...e.after.stacks.values()].map((s) => s.length)));
        mood(g.folds % 2 ? 'thinking' : 'curious', g.folds % 2 ? 'curious' : 'thinking');
        if (g.folds >= g.p.par + 2 && !g.solved) mood('thinking', 'thinking');
      }
      if (e.kind === 'solved') {
        const r = record(S, g.p.id, g.folds); persist();
        const id = g.p.id, folds = g.folds, par = g.p.par;
        endTimer.current = window.setTimeout(() => {
          sc.celebrate(); sound.current?.snap(r.seal); mood('delighted', 'delighted');
          endTimer.current = window.setTimeout(() => { setResult({ seal: r.seal, folds, par, better: r.better, first: r.first, id }); }, 1100);
        }, 480);
      }
    }
    refresh();
  }
  function undo() { const g = game.current, sc = scene.current; if (!g || !sc || sc.busy) return; if (g.undo()) { sc.setPaper(g.paper); sound.current?.undo(); refresh(); } }
  function reset() { const g = game.current, sc = scene.current; if (!g || !sc || sc.busy) return; if (g.history.length || g.folds) { g.reset(); resetsRef.current++; sc.setPaper(g.paper); sound.current?.reset(); mood('curious', 'curious'); refresh(); } }
  function hint() {
    const g = game.current, sc = scene.current; if (!g || !sc || sc.busy) return;
    const h = g.hint();
    if (!h) { showToast('This one has gone astray. Undo a fold or two, or reset.', 3200); return; }
    sc.hint = h; sound.current?.hint(); mood('curious', 'thinking'); refresh();
  }
  const hintReady = () => { const g = game.current; return !!g && !g.solved && (resetsRef.current >= 1 || g.folds >= g.p.par + 1); };
  function afterResult(kind: 'next' | 'again' | 'book' | 'festival') {
    const r = result; if (!r) return; audio().ui();
    const last = PUZZLES[PUZZLES.length - 1].id, chapterEnd = chapterPuzzles(puzzle(r.id).chapter).slice(-1)[0].id === r.id;
    if (kind === 'again') { startPuzzle(r.id); return; }
    if (kind === 'book') { setResult(null); setChapter(puzzle(r.id).chapter); setScreen('book'); song('menu'); return; }
    if (r.id === last && !S.ended) { S.ended = true; persist(); setResult(null); setScreen('ending'); song('ending'); sound.current?.light(); return; }
    if (kind === 'festival' || (chapterEnd && r.first)) { openFestival(r.first ? r.id : undefined); return; }
    const n = nextPuzzle(S); if (n) startPuzzle(n); else { setResult(null); setScreen('book'); song('menu'); }
  }

  // ---- mount: the save, the scene, the loop, the hooks for tests
  useEffect(() => {
    let raw: string | null = null; try { raw = localStorage.getItem(SAVE_KEY); } catch { /* none */ }
    save.current = readSave(raw);
    setTouch(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const o = () => setOrient(innerHeight > innerWidth ? 'tall' : 'wide'); o(); addEventListener('resize', o);
    setMounted(true);
    let raf = 0, dead = false, last = performance.now();
    sceneModule().then((m) => {
      if (dead || !canvas.current) return;
      try { scene.current = new m.FoldScene(canvas.current); } catch { setError('This browser cannot draw the folding table.'); return; }
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const s = screenRef.current;
        if (s === 'play' || s === 'festival') scene.current?.frame(dt);
        sound.current?.tick(true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setReady(true);
    }).catch(() => setError('The folding table did not load. Try reloading the page.'));
    const ro = new ResizeObserver(() => scene.current?.resize()); if (stage.current) ro.observe(stage.current);
    const hide = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', hide);
    const w = window as unknown as Record<string, unknown>;
    w.__fold = () => {
      const g = game.current;
      return { screen: screenRef.current, id: g?.p.id ?? null, folds: g?.folds ?? 0, par: g?.p.par ?? 0, solved: g?.solved ?? false, layers: g ? Math.max(...[...g.paper.stacks.values()].map((s) => s.length)) : 0,
        paper: g ? paperKey(g.paper) : '', matches: g?.matches() ?? false, history: g?.history.length ?? 0, solution: g?.p.solution.map(foldText) ?? [], busy: scene.current?.busy ?? false,
        hint: scene.current?.hint ? foldText(scene.current.hint) : null, save: save.current };
    };
    /** Page coordinates of a grid point of the paper as it lies now. */
    w.__foldPoint = (gx: number, gy: number) => { const sc = scene.current, c = canvas.current; if (!sc || !c) return null; const r = c.getBoundingClientRect(), p = sc.point(gx, gy); return [r.left + p.x, r.top + p.y]; };
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', o); document.removeEventListener('visibilitychange', hide); window.clearTimeout(endTimer.current); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { requestAnimationFrame(() => scene.current?.resize()); }, [screen, orient, touch]);

  // ---- keyboard
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = screenRef.current, g = game.current, sc = scene.current;
      if (tip && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); setTip(null); return; }
      if (s !== 'play' || !g || !sc) { if (e.key === 'Escape' && s !== 'menu') { setScreen(s === 'festival' || s === 'ending' ? 'menu' : 'menu'); song('menu'); } return; }
      if (result) { if (e.key === 'Enter') { e.preventDefault(); afterResult('next'); } return; }
      audio();
      const k = e.key.toLowerCase(), p = g.paper;
      // arrows pick a crease line; WASD fold across it
      if (k.startsWith('arrow')) {
        e.preventDefault();
        const cur = kbd.current ?? { x: Math.max(1, Math.floor(p.w / 2)), y: Math.max(1, Math.floor(p.h / 2)), axis: 'x' as const };
        if (k === 'arrowleft' || k === 'arrowright') { cur.axis = 'x'; if (kbd.current) cur.x += k === 'arrowleft' ? -1 : 1; }
        else { cur.axis = 'y'; if (kbd.current) cur.y += k === 'arrowup' ? -1 : 1; }
        cur.x = Math.max(1, Math.min(p.w - 1, cur.x)); cur.y = Math.max(1, Math.min(p.h - 1, cur.y));
        kbd.current = cur;
        const at = cur.axis === 'x' ? cur.x : cur.y, n = cur.axis === 'x' ? p.w : p.h;
        if (n < 2) return;
        const f: Fold = { axis: cur.axis, at, low: true }; sc.preview = { fold: f, ok: g.check(f).ok }; sound.current?.hover();
        return;
      }
      const dir: Record<string, ['x' | 'y', boolean]> = { d: ['x', true], a: ['x', false], s: ['y', true], w: ['y', false] };
      if (dir[k]) {
        e.preventDefault();
        const [axis, low] = dir[k], n = axis === 'x' ? p.w : p.h; if (n < 2) { showToast(axis === 'x' ? 'No line to fold that way.' : 'No line to fold that way.', 1800); return; }
        const at = Math.max(1, Math.min(n - 1, kbd.current && kbd.current.axis === axis ? (axis === 'x' ? kbd.current.x : kbd.current.y) : Math.floor(n / 2)));
        sc.preview = null; doFold({ axis, at, low }); kbd.current = null; return;
      }
      if (k === 'z' || k === 'backspace' || k === 'u') { e.preventDefault(); undo(); }
      else if (k === 'r') reset();
      else if (k === 'h' && hintReady()) hint();
      else if (k === 'escape') { setScreen('book'); song('menu'); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });

  // ---- pointer: hover previews a fold, a click or tap makes it, a drag folds the part you grab across the line
  const local = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function onMove(e: React.PointerEvent) {
    const sc = scene.current, g = game.current; if (!sc || !g || screenRef.current !== 'play' || result) return;
    const p = local(e), pr = press.current;
    let f: Fold | null;
    if (pr && pr.id === e.pointerId) f = sc.foldFromDrag(pr.x, pr.y, p.x, p.y) ?? sc.foldAt(pr.x, pr.y);
    else if (e.pointerType === 'mouse') f = sc.foldAt(p.x, p.y);
    else return;
    const prev = sc.preview?.fold;
    sc.preview = f ? { fold: f, ok: g.check(f).ok } : null;
    if (f && (!prev || !sameFold(prev, f))) sound.current?.hover();
  }
  function onDown(e: React.PointerEvent) {
    if (screenRef.current !== 'play' || result) return;
    audio(); const p = local(e); press.current = { id: e.pointerId, x: p.x, y: p.y, type: e.pointerType };
    try { canvas.current?.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (e.pointerType !== 'mouse') onMove(e);
  }
  function onUp(e: React.PointerEvent) {
    const sc = scene.current, g = game.current, pr = press.current; press.current = null;
    if (!sc || !g || !pr || pr.id !== e.pointerId || screenRef.current !== 'play' || result) return;
    const p = local(e), drag = sc.foldFromDrag(pr.x, pr.y, p.x, p.y);
    if (drag) { pending.current = null; doFold(drag); return; }
    const f = sc.foldAt(p.x, p.y); if (!f) { pending.current = null; sc.preview = null; return; }
    // a mouse click folds at once; a tap shows the fold first, and a second tap on it folds
    if (pr.type === 'mouse' || (pending.current && sameFold(pending.current, f))) { pending.current = null; doFold(f); if (pr.type !== 'mouse') sc.preview = null; return; }
    pending.current = f; sc.preview = { fold: f, ok: g.check(f).ok };
    showToast('Tap again to fold, or drag the paper across the line.', 2200);
  }
  function onLeave() { if (!press.current && scene.current && !touch) scene.current.preview = null; }

  const toggle = (k: 'sound' | 'music') => {
    S.settings[k] = !S.settings[k]; persist();
    const s = audio(); if (k === 'sound') s.setSound(S.settings.sound); else s.setMusic(S.settings.music);
    if (k === 'music' && S.settings.music) song(screenRef.current === 'play' && game.current ? game.current.p.chapter : 'menu');
    refresh();
  };
  const Toggles = () => (
    <span className="pf-toggles">
      <button type="button" className={'pf-tog' + (S.settings.sound ? ' is-on' : '')} aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>Sound</button>
      <button type="button" className={'pf-tog' + (S.settings.music ? ' is-on' : '')} aria-pressed={S.settings.music} onClick={() => toggle('music')}>Music</button>
    </span>
  );

  const g = game.current, total = PUZZLES.length, folded = Object.keys(S.done).length, nxt = mounted ? nextPuzzle(S) : null;
  const ch = CHAPTERS.find((c) => c.id === chapter)!;
  return (
    <main className="pf-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? orient : undefined} data-orient={orient}>
      {screen === 'menu' && (
        <section className="pf-menu">
          <Art src="/art/fold/title.webp" paint="title" w={1536} h={1024} className="pf-menu-art" />
          <div className="pf-menu-card">
            <p className="pf-eyebrow">GAME 62 · AN ORIGAMI PUZZLE</p>
            <h1>Paperfold</h1>
            <p className="pf-lede">A gust has scattered the pages of the valley’s lantern festival book. Fold each coloured sheet to match its picture, and fill the festival with lanterns, boats, cranes and stars.</p>
            <div className="pf-menu-buttons">
              <button type="button" className="pf-primary" disabled={!ready} onClick={() => { audio().ui(); const n = nextPuzzle(S); if (n) startPuzzle(n); else { setScreen('book'); } }}>
                {folded ? (nxt ? `Continue · ${pageNo(nxt)} ${puzzle(nxt).name}` : 'Fold again') : 'Start folding'}
              </button>
              <button type="button" onClick={() => { audio().ui(); setScreen('book'); song('menu'); }}>The book · {folded}/{total}</button>
              <button type="button" disabled={!ready} onClick={() => { audio().ui(); openFestival(); }}>The festival</button>
            </div>
            <p className="pf-note">{mounted ? `${sealCount(S)} gold seals of ${total}` : ' '}</p>
            <div className="pf-menu-foot"><a className="pf-back" href="/">← MAIN ARCADE</a><Toggles /></div>
          </div>
        </section>
      )}

      {screen === 'book' && (
        <section className="pf-book">
          <header className="pf-bar">
            <button type="button" className="pf-back" onClick={() => { audio().ui(); setScreen('menu'); }}>← MENU</button>
            <span className="pf-bar-mid">The festival book · {folded}/{total} folded</span>
            <Toggles />
          </header>
          <nav className="pf-tabs" aria-label="Chapters">
            {CHAPTERS.map((c, i) => (
              <button type="button" key={c.id} className={'pf-tab' + (c.id === chapter ? ' is-on' : '')} disabled={!chapterOpen(S, c.id)} onClick={() => { audio().ui(); setChapter(c.id); }}>
                <b>{i + 1}</b> {c.name} <small>{doneIn(S, c.id)}/8</small>
              </button>
            ))}
          </nav>
          <p className="pf-chapter-blurb">{ch.blurb}</p>
          <div className="pf-pages">
            {chapterPuzzles(chapter).map((p, i) => {
              const open = puzzleOpen(S, p.id), d = S.done[p.id];
              return (
                <button type="button" key={p.id} className={'pf-page' + (d ? ' is-done' : '') + (i === 7 ? ' is-show' : '')} disabled={!open} onClick={() => { audio().ui(); startPuzzle(p.id); }}>
                  <span className="pf-page-no">{pageNo(p.id)}</span>
                  {open ? <Thumb id={p.id} size={70} piece={!!d} /> : <span className="pf-lock">🔒</span>}
                  <span className="pf-page-name">{p.name}</span>
                  <span className={'pf-seal s' + (d?.seal ?? 0)}>{d ? `${SEAL_ICON[d.seal]} ${d.best} / par ${puzzle(p.id).par}` : open ? `par ${puzzle(p.id).par}` : i === 7 ? 'showpiece' : 'locked'}</span>
                </button>
              );
            })}
          </div>
          {!chapterOpen(S, CHAPTERS[Math.min(CHAPTERS.length - 1, CHAPTERS.findIndex((c) => c.id === chapter) + 1)].id) && <p className="pf-note pf-book-note">Fold six pages of a chapter to open the next one.</p>}
        </section>
      )}

      <div className={'pf-stage' + (screen === 'play' || screen === 'festival' ? '' : ' is-hidden')} ref={stage}>
        {screen === 'play' && g && (
          <header className="pf-bar">
            <button type="button" className="pf-back" onClick={() => { audio().ui(); window.clearTimeout(endTimer.current); setResult(null); setChapter(g.p.chapter); setScreen('book'); song('menu'); }}>← BOOK</button>
            <span className="pf-bar-mid"><span className="pf-name"><small>{pageNo(g.p.id)}</small> {g.p.name}</span>
              <span className={'pf-count' + (g.folds > g.p.par ? ' is-over' : '')}>Folds <b>{g.folds}</b> <small>par {g.p.par}</small></span></span>
            <Toggles />
          </header>
        )}
        {screen === 'festival' && (
          <header className="pf-bar">
            <button type="button" className="pf-back" onClick={() => { audio().ui(); setScreen('menu'); song('menu'); }}>← MENU</button>
            <span className="pf-bar-mid">The festival · {folded} of {total} pieces</span>
            <button type="button" className="pf-primary pf-small" onClick={() => { audio().ui(); const n = nextPuzzle(S); if (n) startPuzzle(n); else setScreen('book'); }}>{nxt ? 'Keep folding' : 'The book'}</button>
          </header>
        )}
        <canvas ref={canvas} className="pf-canvas" tabIndex={0} aria-label="The folding table"
          onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { press.current = null; }} onPointerLeave={onLeave} onContextMenu={(e) => e.preventDefault()} />
        {screen === 'play' && g && !result && (
          <div className="pf-tools">
            <button type="button" onClick={() => { audio(); undo(); }} disabled={!g.history.length || g.solved}>↶ Undo</button>
            <button type="button" onClick={() => { audio(); reset(); }} disabled={!g.folds || g.solved}>⟲ Reset</button>
            {hintReady() && <button type="button" className="pf-hint" onClick={() => { audio(); hint(); }}>✦ Hint</button>}
          </div>
        )}
        {screen === 'play' && toast && !result && <p className="pf-toast" role="status">{toast}</p>}
        {screen === 'play' && result && (
          <div className="pf-result" role="dialog" aria-label="Page folded">
            <div className={'pf-result-card s' + result.seal}>
              <Thumb id={result.id} size={110} piece />
              <p className="pf-eyebrow">{puzzle(result.id).name.toUpperCase()}</p>
              <h2>{CHEERS[result.seal][(result.folds + result.par) % CHEERS[result.seal].length]}</h2>
              <p className={'pf-stamp s' + result.seal}><span>{SEAL_ICON[result.seal]}</span> {SEAL_NAMES[result.seal]}</p>
              <p className="pf-note">Folded in {result.folds} {result.folds === 1 ? 'fold' : 'folds'} · par {result.par}{result.seal < 3 ? ' · fold again in par for gold' : ''}</p>
              <div className="pf-result-buttons">
                <button type="button" className="pf-primary" autoFocus onClick={() => afterResult('next')}>{result.id === PUZZLES[PUZZLES.length - 1].id && !S.ended ? 'Light the lanterns' : 'Next page'}</button>
                <button type="button" onClick={() => afterResult('again')}>Fold again</button>
                <button type="button" onClick={() => afterResult('festival')}>Festival</button>
              </div>
            </div>
          </div>
        )}
        {tip && screen === 'play' && (
          <div className="pf-tip" role="dialog" aria-label={tip.title}>
            <div className="pf-tip-card"><h2>{tip.title}</h2><p>{tip.text}</p>
              {!touch && <p className="pf-keys"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> pick a line · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fold · <kbd>Z</kbd> undo · <kbd>R</kbd> reset</p>}
              <button type="button" className="pf-primary" autoFocus onClick={() => { audio().ui(); setTip(null); }}>Got it</button></div>
          </div>
        )}
      </div>

      {screen === 'ending' && (
        <section className="pf-ending">
          <Art src="/art/fold/ending.webp" paint="ending" w={1536} h={1024} className="pf-ending-art" />
          <div className="pf-ending-card">
            <p className="pf-eyebrow">FESTIVAL NIGHT</p>
            <h2>The lanterns are lit</h2>
            <p>Every page of the festival book is folded. Lanterns glow on their strings, the boats carry candles across the pond, the cranes ride the breeze and the stars are back in the sky. Dora and Enzo sit on the little bridge and watch it all, paper-cut paws a little sore.</p>
            <p className="pf-note">{folded} of {total} pages folded · {sealCount(S)} gold seals</p>
            <div className="pf-menu-buttons">
              <button type="button" className="pf-primary" onClick={() => { audio().ui(); openFestival(); }}>See the festival</button>
              <button type="button" onClick={() => { audio().ui(); setScreen('book'); song('menu'); }}>The book</button>
            </div>
          </div>
        </section>
      )}
      {error && <p className="pf-error">{error}</p>}
    </main>
  );
}
