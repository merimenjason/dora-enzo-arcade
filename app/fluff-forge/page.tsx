/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  FluffForgeGame, PARTS, THEMES, TIMES, HEROES, STARTERS, TILE, ROWS, VIEW_W, VIEW_H, MIN_COLS, MAX_COLS, NO_INPUT,
  blankCourse, paint, resize, problems, encodeCourse, decodeCourse, raisinCount, index,
  type Course, type HeroId, type Input, type ThemeId, type Group,
} from '../../lib/fluff-forge-game';
import { drawEditor, drawGame, drawIcon, chinchilla } from '../../lib/fluff-forge-scene';
import './fluff-forge.css';

const SCALE = 2, DT = 1 / 120;
const SAVE_KEY = 'fluff-forge-v1';
type Mine = Course & { id: string; updated: number; cleared: string | null };
type Best = { time: number; raisins: number };
type Save = { courses: Mine[]; best: Record<string, Best>; hero: HeroId; sound: boolean };
/** Where a run came from. A test run started part-way through a course is practice and never counts as a clear. */
type Source = { kind: 'starter' | 'mine' | 'shared' | 'test'; id: string; practice?: boolean };
type Mode = { kind: 'home' } | { kind: 'edit'; id: string } | { kind: 'play'; course: Course; source: Source };

const GROUPS: { id: Group; name: string }[] = [
  { id: 'terrain', name: 'Terrain' }, { id: 'blocks', name: 'Blocks' }, { id: 'items', name: 'Items' }, { id: 'enemies', name: 'Enemies' }, { id: 'markers', name: 'Markers' },
];
type Action = keyof Input | 'pause' | 'restart';
const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyJ: 'run',
  KeyC: 'swap', KeyE: 'swap', KeyP: 'pause', Escape: 'pause', KeyR: 'restart',
};
const PAD: { key: keyof Input; label: string; name: string }[] = [
  { key: 'left', label: '◀', name: 'Move left' }, { key: 'right', label: '▶', name: 'Move right' }, { key: 'down', label: '▼', name: 'Drop through' },
  { key: 'swap', label: 'TAG', name: 'Swap Dora and Enzo' }, { key: 'run', label: 'RUN', name: 'Run' }, { key: 'jump', label: 'JUMP', name: 'Jump' },
];
const CUES: Record<string, [number, number, OscillatorType, number]> = {
  jump: [420, 700, 'square', 0.08], flutter: [700, 1100, 'triangle', 0.1], stomp: [300, 90, 'square', 0.1], kick: [500, 120, 'square', 0.14],
  raisin: [1320, 1760, 'square', 0.07], bump: [180, 120, 'triangle', 0.06], break: [300, 60, 'sawtooth', 0.18], sprout: [400, 900, 'sine', 0.2],
  power: [520, 1560, 'triangle', 0.35], shrink: [900, 250, 'triangle', 0.35], die: [500, 80, 'triangle', 0.8], spring: [200, 900, 'sine', 0.2],
  checkpoint: [660, 990, 'sine', 0.2], clear: [523, 1568, 'triangle', 0.9], swap: [520, 1040, 'triangle', 0.1], hop: [260, 420, 'sine', 0.05],
};
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

function readSave(): Save {
  const fresh: Save = { courses: [], best: {}, hero: 'dora', sound: true };
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return fresh;
    const courses: Mine[] = [];
    for (const m of Array.isArray(v.courses) ? v.courses : []) {
      const course = m && typeof m.id === 'string' ? parseMine(m) : null;
      if (course) courses.push({ ...course, id: m.id, updated: Number(m.updated) || 0, cleared: typeof m.cleared === 'string' ? m.cleared : null });
    }
    const best: Record<string, Best> = {};
    for (const [k, b] of Object.entries(v.best ?? {})) if (b && typeof (b as Best).time === 'number') best[k] = { time: (b as Best).time, raisins: Number((b as Best).raisins) || 0 };
    return { courses, best, hero: v.hero === 'enzo' ? 'enzo' : 'dora', sound: v.sound !== false };
  } catch { return fresh; }
}
/** A saved course that is still being built may have no start or goal yet, so it can't go through decodeCourse. */
function parseMine(m: Partial<Course>): Course | null {
  if (typeof m.tiles !== 'string' || !Number.isInteger(m.cols) || m.tiles.length !== (m.cols as number) * ROWS) return null;
  const base = blankCourse(m.cols as number);
  return { ...base, title: typeof m.title === 'string' ? m.title.slice(0, 40) : base.title, theme: THEMES.some((t) => t.id === m.theme) ? (m.theme as ThemeId) : 'meadow', time: TIMES.includes(m.time as number) ? (m.time as number) : 300, tiles: m.tiles.replace(/[^.#HI=M^B?CFoSbfvxP@G]/g, '.') };
}
function writeSave(s: Save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}

/** A still picture of a course, as the editor would show it at its start. */
function Preview({ course, height = 90 }: { course: Course; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    const at = course.tiles.indexOf('@');
    const cam = at < 0 ? 0 : Math.max(0, Math.min(course.cols * TILE - VIEW_W, Math.floor(at / ROWS) * TILE - 40));
    c.setTransform(1, 0, 0, 1, 0, 0);
    drawEditor(c, course, cam, 0, null, false);
  }, [course]);
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} style={{ height }} className="ff-preview" aria-hidden="true" />;
}
function Icon({ ch, theme }: { ch: string; theme: ThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 16, 16);
    drawIcon(c, ch, theme, 0);
  }, [ch, theme]);
  return <canvas ref={ref} width={32} height={32} aria-hidden="true" />;
}
function Hero({ id }: { id: HeroId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(4, 0, 0, 4, 0, 0);
    chinchilla(c, id, id === 'dora' ? 25 : 19, 30.5, { face: id === 'dora' ? 1 : -1, h: 22, time: 0 });
  }, [id]);
  return <canvas ref={ref} width={176} height={128} aria-hidden="true" className="ff-hero-art" />;
}

export default function FluffForge() {
  const [save, setSave] = useState<Save>({ courses: [], best: {}, hero: 'dora', sound: true });
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'home' });
  const [code, setCode] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const [shareId, setShareId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  useEffect(() => { setSave(readSave()); setLoaded(true); }, []);
  const update = (fn: (s: Save) => Save) => setSave((s) => { const next = fn(s); writeSave(next); return next; });
  const setCourse = (id: string, course: Course) => update((s) => ({ ...s, courses: s.courses.map((m) => (m.id === id ? { ...m, ...course, updated: Date.now() } : m)) }));

  const newCourse = () => {
    const id = newId();
    const n = save.courses.length + 1;
    update((s) => ({ ...s, courses: [{ ...blankCourse(), title: `My course ${n}`, id, updated: Date.now(), cleared: null }, ...s.courses] }));
    setMode({ kind: 'edit', id });
  };
  const loadCode = () => {
    const course = decodeCourse(code);
    if (!course) { setCodeNote('That code didn’t work. Check it was copied in full, starting with FLUFF-.'); return; }
    setCodeNote('');
    setMode({ kind: 'play', course, source: { kind: 'shared', id: 'shared' } });
  };
  const keepCode = () => {
    const course = decodeCourse(code);
    if (!course) { setCodeNote('That code didn’t work. Check it was copied in full, starting with FLUFF-.'); return; }
    update((s) => ({ ...s, courses: [{ ...course, id: newId(), updated: Date.now(), cleared: null }, ...s.courses] }));
    setCode('');
    setCodeNote(`Saved “${course.title}” to your courses. Clear it yourself to share it on.`);
  };

  if (mode.kind === 'edit') {
    const mine = save.courses.find((m) => m.id === mode.id);
    if (mine) return <Editor mine={mine} onChange={(c) => setCourse(mine.id, c)} onTest={(course, practice) => setMode({ kind: 'play', course, source: { kind: 'test', id: mine.id, practice } })} onDone={() => setMode({ kind: 'home' })} />;
  }
  if (mode.kind === 'play') {
    const { course, source } = mode;
    const bestKey = source.kind === 'starter' || source.kind === 'mine' ? source.id : null;
    return <Player
      course={course} source={source} hero={save.hero} sound={save.sound} best={bestKey ? save.best[bestKey] : undefined}
      onSound={(sound) => update((s) => ({ ...s, sound }))}
      onClear={(r) => {
        update((s) => {
          let next = s;
          if (bestKey) { const old = s.best[bestKey]; if (!old || r.time < old.time) next = { ...next, best: { ...next.best, [bestKey]: { time: r.time, raisins: r.raisins } } }; }
          // Clearing your own course from start to goal is the clear check that unlocks its share code.
          if ((source.kind === 'test' && !source.practice) || source.kind === 'mine') next = { ...next, courses: next.courses.map((m) => (m.id === source.id ? { ...m, cleared: encodeCourse(m) } : m)) };
          return next;
        });
      }}
      onExit={() => setMode(source.kind === 'test' ? { kind: 'edit', id: source.id } : { kind: 'home' })}
    />;
  }

  const total = STARTERS.filter((s) => save.best[s.id]).length;
  return <main className="ff-shell">
    <header className="ff-header">
      <a href="/" className="ff-back">← MAIN ARCADE</a>
      <span className="ff-brand">FLUFF FORGE</span>
    </header>
    <section className="ff-intro">
      <div className="ff-heroes"><Hero id="dora" /><Hero id="enzo" /></div>
      <div>
        <p className="ff-eyebrow">BUILD · PLAY · SHARE</p>
        <h1>Fluff Forge</h1>
        <p className="ff-lede">Lay out your own side-scrolling course from ground, bricks, clouds, springs, beetles and bats, then run it as <b>Dora</b> or <b>Enzo</b>. Clear a course yourself to get a code your friends can paste in and play.</p>
      </div>
    </section>

    <fieldset className="ff-pick">
      <legend>Who’s running?</legend>
      {(['dora', 'enzo'] as HeroId[]).map((id) => <label key={id} className={save.hero === id ? 'on' : ''}>
        <input type="radio" name="hero" checked={save.hero === id} onChange={() => update((s) => ({ ...s, hero: id }))} data-testid={`hero-${id}`} />
        <strong>{HEROES[id].name}</strong> <small>{HEROES[id].perk}</small>
      </label>)}
      <p>Press C during a run to tag the other one in.</p>
    </fieldset>

    <h2 className="ff-section">Starter courses <small>{total}/{STARTERS.length} cleared</small></h2>
    <div className="ff-grid">
      {STARTERS.map((s) => <article key={s.id} className="ff-card">
        <Preview course={s} />
        <strong>{s.title}</strong>
        <small>{s.blurb}</small>
        <em>{save.best[s.id] ? `Best ${fmt(save.best[s.id].time)} · ${save.best[s.id].raisins}/${raisinCount(s)} raisins` : `By ${HEROES[s.by].name} · ${raisinCount(s)} raisins`}</em>
        <button className="ff-go" disabled={!loaded} data-testid={`play-${s.id}`} onClick={() => setMode({ kind: 'play', course: s, source: { kind: 'starter', id: s.id } })}>PLAY</button>
      </article>)}
    </div>

    <h2 className="ff-section">Your courses</h2>
    <div className="ff-grid">
      <button className="ff-card ff-new" disabled={!loaded} onClick={newCourse} data-testid="new-course"><span>＋</span><strong>New course</strong><small>Start from flat ground, a start and a goal.</small></button>
      {save.courses.map((m) => {
        const ready = problems(m).length === 0, cleared = m.cleared === encodeCourse(m);
        return <article key={m.id} className="ff-card" data-testid="my-course">
          <Preview course={m} />
          <strong>{m.title}</strong>
          <small>{m.cols} columns · {THEMES.find((t) => t.id === m.theme)?.name} · {m.time} s</small>
          <em className={cleared ? 'ff-ok' : ''}>{cleared ? '✓ Cleared: ready to share' : ready ? 'Clear it once to share it' : problems(m)[0]}</em>
          <div className="ff-row">
            <button className="ff-go" disabled={!ready} onClick={() => setMode({ kind: 'play', course: m, source: { kind: 'mine', id: m.id } })}>PLAY</button>
            <button onClick={() => setMode({ kind: 'edit', id: m.id })}>Edit</button>
            <button disabled={!cleared} onClick={() => setShareId(shareId === m.id ? null : m.id)} aria-expanded={shareId === m.id}>Share</button>
            {confirmDelete === m.id
              ? <button className="ff-danger" onClick={() => { update((s) => ({ ...s, courses: s.courses.filter((x) => x.id !== m.id) })); setConfirmDelete(null); setAnnounce(`Deleted ${m.title}.`); }}>Really delete</button>
              : <button onClick={() => setConfirmDelete(m.id)}>Delete</button>}
          </div>
          {shareId === m.id && cleared && <div className="ff-share">
            <textarea readOnly value={encodeCourse(m)} rows={3} onFocus={(e) => e.currentTarget.select()} data-testid="share-code" />
            <button onClick={() => { navigator.clipboard?.writeText(encodeCourse(m)).then(() => setAnnounce('Course code copied.'), () => {}); }}>Copy code</button>
          </div>}
        </article>;
      })}
    </div>

    <h2 className="ff-section">Play a friend’s course</h2>
    <div className="ff-import">
      <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a course code (it starts with FLUFF-)" rows={2} data-testid="code-input" />
      <div className="ff-row">
        <button className="ff-go" onClick={loadCode} disabled={!code.trim()}>PLAY IT</button>
        <button onClick={keepCode} disabled={!code.trim()}>Save to my courses</button>
      </div>
      {codeNote && <p className="ff-note" aria-live="polite">{codeNote}</p>}
    </div>
    <p className="ff-sr" aria-live="polite">{announce}</p>
    <footer className="ff-foot">Courses and best times are kept in this browser. Share codes carry the whole course, so nothing is uploaded.</footer>
  </main>;
}

// ---------- Editor ----------

function Editor({ mine, onChange, onTest, onDone }: { mine: Mine; onChange: (c: Course) => void; onTest: (c: Course, practice: boolean) => void; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [course, setCourse] = useState<Course>(mine);
  const courseRef = useRef(course);
  const [tool, setTool] = useState('#');
  const [cam, setCam] = useState(0);
  const camRef = useRef(0);
  const cursor = useRef<{ c: number; r: number } | null>(null);
  const painting = useRef<string | null>(null);
  const undo = useRef<Course[]>([]);
  const redo = useRef<Course[]>([]);
  const [, bump] = useState(0);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const maxCam = Math.max(0, course.cols * TILE - VIEW_W);
  courseRef.current = course;
  camRef.current = cam;

  const commit = (next: Course, record = true) => {
    if (next === courseRef.current) return;
    if (record) { undo.current.push(courseRef.current); if (undo.current.length > 200) undo.current.shift(); redo.current = []; }
    courseRef.current = next;
    setCourse(next);
    onChange(next);
  };
  const history = (from: React.RefObject<Course[]>, to: React.RefObject<Course[]>) => {
    const prev = from.current.pop();
    if (!prev) return;
    to.current.push(courseRef.current);
    courseRef.current = prev;
    setCourse(prev); onChange(prev); bump((n) => n + 1);
  };

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const c = canvas.current?.getContext('2d');
      if (c) {
        c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        const at = cursor.current;
        drawEditor(c, courseRef.current, camRef.current, now / 1000, at ? { ...at, ch: painting.current ?? toolRef.current } : null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cell = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VIEW_W + camRef.current, y = ((e.clientY - r.top) / r.height) * VIEW_H;
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  };
  const apply = (at: { c: number; r: number }, ch: string) => commit(paint(courseRef.current, at.c, at.r, ch), false);
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = cell(e);
    const ch = e.button === 2 || e.buttons === 2 ? '.' : tool;
    undo.current.push(courseRef.current); redo.current = [];
    painting.current = ch;
    cursor.current = at;
    apply(at, ch);
    bump((n) => n + 1);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const at = cell(e);
    cursor.current = at;
    // Markers and enemies go down one at a time; terrain paints as you drag.
    if (painting.current !== null && !['@', 'G', 'P', 'M', 'b', 'f', 'v', 'x'].includes(painting.current)) apply(at, painting.current);
  };
  const up = () => {
    painting.current = null;
    if (undo.current.length && undo.current[undo.current.length - 1] === courseRef.current) undo.current.pop();
    bump((n) => n + 1);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) history(redo, undo); else history(undo, redo); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); history(redo, undo); return; }
      const step = e.shiftKey ? TILE * 10 : TILE * 2;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); setCam((c) => Math.min(Math.max(0, courseRef.current.cols * TILE - VIEW_W), c + step)); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); setCam((c) => Math.max(0, c - step)); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const issues = problems(course);
  const cleared = mine.cleared === encodeCourse(course);
  const startCol = Math.floor(course.tiles.indexOf('@') / ROWS);
  const selected = PARTS.find((p) => p.ch === tool);
  return <main className="ff-shell ff-editing">
    <header className="ff-header">
      <a href="/" className="ff-back">← MAIN ARCADE</a>
      <span className="ff-brand">FLUFF FORGE · EDITOR</span>
    </header>
    <div className="ff-toolbar">
      <label>Title <input value={course.title} maxLength={40} onChange={(e) => commit({ ...course, title: e.target.value })} data-testid="title" /></label>
      <label>Theme <select value={course.theme} onChange={(e) => commit({ ...course, theme: e.target.value as ThemeId })} data-testid="theme">
        {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
      <label>Timer <select value={course.time} onChange={(e) => commit({ ...course, time: Number(e.target.value) })}>
        {TIMES.map((t) => <option key={t} value={t}>{t} s</option>)}
      </select></label>
      <label>Width <input type="number" min={MIN_COLS} max={MAX_COLS} step={5} value={course.cols} onChange={(e) => { const next = resize(course, Number(e.target.value) || course.cols); commit(next); setCam((c) => Math.min(c, Math.max(0, next.cols * TILE - VIEW_W))); }} data-testid="width" /></label>
      <div className="ff-row">
        <button onClick={() => history(undo, redo)} disabled={!undo.current.length} title="Ctrl+Z">Undo</button>
        <button onClick={() => history(redo, undo)} disabled={!redo.current.length} title="Ctrl+Shift+Z">Redo</button>
      </div>
    </div>

    <div className="ff-palette" role="toolbar" aria-label="Parts">
      <button className={tool === '.' ? 'on' : ''} onClick={() => setTool('.')} aria-pressed={tool === '.'} title="Eraser (or right-click)" data-testid="tool-erase"><Icon ch="." theme={course.theme} /><span>Eraser</span></button>
      {GROUPS.map((g) => <div key={g.id} className="ff-group">
        <small>{g.name}</small>
        <div>{PARTS.filter((p) => p.group === g.id).map((p) => <button key={p.ch} className={tool === p.ch ? 'on' : ''} aria-pressed={tool === p.ch} onClick={() => setTool(p.ch)} title={`${p.name}: ${p.hint}`} data-testid={`tool-${p.id}`}>
          <Icon ch={p.ch} theme={course.theme} /><span>{p.name}</span>
        </button>)}</div>
      </div>)}
    </div>
    <p className="ff-hint">{selected ? <><b>{selected.name}:</b> {selected.hint}</> : <><b>Eraser:</b> clears a cell.</>} Click or drag to place; right-click erases. Scroll with the slider, ← → or the mouse wheel.</p>

    <div className="ff-stage">
      <canvas
        ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} data-testid="editor"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onPointerLeave={() => { cursor.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => setCam((c) => Math.max(0, Math.min(maxCam, c + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY))))}
      />
    </div>
    <input type="range" className="ff-scroll" min={0} max={maxCam} value={Math.min(cam, maxCam)} onChange={(e) => setCam(Number(e.target.value))} aria-label="Scroll the course" />

    <div className="ff-status">
      <div>
        {issues.length ? <p className="ff-warn">{issues.join(' ')}</p>
          : cleared ? <p className="ff-ok">✓ You’ve cleared this version. Its share code is on the home screen.</p>
            : <p>Test play from the start and reach the goal to unlock this course’s share code.</p>}
        <p className="ff-small">{raisinCount(course)} raisins · {course.cols} columns · saved automatically</p>
      </div>
      <div className="ff-row">
        <button onClick={() => onTest({ ...course, tiles: withStartAt(course, Math.floor(camRef.current / TILE) + 2) }, true)} disabled={issues.length > 0 || Math.floor(camRef.current / TILE) + 2 <= startCol} title="Start from the left edge of the view (doesn't count as a clear)">Test from here</button>
        <button className="ff-go" onClick={() => onTest(course, false)} disabled={issues.length > 0} data-testid="test-play">TEST PLAY</button>
        <button onClick={onDone} data-testid="done">Done</button>
      </div>
    </div>
  </main>;
}

/** The course with its start moved to the first open spot above ground at or after column `col`. */
function withStartAt(course: Course, col: number) {
  for (let c = col; c < course.cols; c++) {
    for (let r = ROWS - 2; r > 0; r--) {
      const here = course.tiles[index(c, r)], below = course.tiles[index(c, r + 1)];
      if (here === '.' && '#HIB?CFU='.includes(below)) return paint(course, c, r, '@').tiles;
    }
  }
  return course.tiles;
}

// ---------- Player ----------

function Player({ course, source, hero, sound, best, onSound, onClear, onExit }: {
  course: Course; source: Source; hero: HeroId; sound: boolean; best?: Best;
  onSound: (on: boolean) => void; onClear: (r: { time: number; raisins: number }) => void; onExit: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef(new FluffForgeGame(course, hero));
  const keys = useRef<Input>({ ...NO_INPUT });
  /** Keys pressed since the last engine step, so a tap shorter than a frame still registers. */
  const latch = useRef<Input>({ ...NO_INPUT });
  const touch = useRef<Input>({ ...NO_INPUT });
  const paused = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [, setFrame] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const reported = useRef(false);
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  const g = game.current;
  const practice = source.kind === 'test' && !!source.practice;

  const restart = () => { game.current = new FluffForgeGame(course, game.current.heroId); reported.current = false; setShowResult(false); setPaused(false); paused.current = false; };
  const pause = (on: boolean) => { paused.current = on; setPaused(on); };

  useEffect(() => {
    const cue = (name: string) => {
      const spec = CUES[name];
      if (!spec || !soundRef.current) return;
      try {
        audio.current ??= new AudioContext();
        const a = audio.current, [f0, f1, type, len] = spec, o = a.createOscillator(), v = a.createGain(), t = a.currentTime;
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
        v.gain.setValueAtTime(0.06, t); v.gain.exponentialRampToValueAtTime(0.0005, t + len);
        o.connect(v); v.connect(a.destination); o.start(t); o.stop(t + len);
      } catch {}
    };
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const gm = game.current;
      acc = Math.min(acc + (now - last) / 1000, 0.25);
      last = now;
      const pad = navigator.getGamepads?.()[0];
      const p: Input = pad ? { left: pad.buttons[14]?.pressed || (pad.axes[0] ?? 0) < -0.4, right: pad.buttons[15]?.pressed || (pad.axes[0] ?? 0) > 0.4, down: pad.buttons[13]?.pressed || (pad.axes[1] ?? 0) > 0.6, jump: !!pad.buttons[0]?.pressed, run: !!(pad.buttons[2]?.pressed || pad.buttons[1]?.pressed), swap: !!pad.buttons[3]?.pressed } : NO_INPUT;
      const input = Object.fromEntries((Object.keys(NO_INPUT) as (keyof Input)[]).map((k) => [k, keys.current[k] || latch.current[k] || touch.current[k] || p[k]])) as Input;
      if (!paused.current) while (acc >= DT) { gm.step(DT, input); acc -= DT; latch.current = { ...NO_INPUT }; }
      else acc = 0;
      for (const e of gm.events) cue(e);
      gm.events.length = 0;
      if (gm.state === 'clear' && gm.result && !reported.current) {
        reported.current = true;
        onClearRef.current(gm.result);
      }
      if (gm.state === 'clear' && gm.stateT > 1.6) setShowResult(true);
      const c = canvas.current?.getContext('2d');
      if (c) { c.setTransform(SCALE, 0, 0, SCALE, 0, 0); drawGame(c, gm, now / 1000); }
      setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const hide = () => { if (document.hidden) pause(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hide); audio.current?.close().catch(() => {}); };
  }, []);
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      if (a === 'pause') { if (on && !e.repeat) pause(!paused.current); return; }
      if (a === 'restart') { if (on && !e.repeat) restart(); return; }
      keys.current[a] = on;
      if (on) latch.current[a] = true;
    };
    const kd = (e: KeyboardEvent) => set(e, true), ku = (e: KeyboardEvent) => set(e, false);
    const blur = () => { keys.current = { ...NO_INPUT }; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  });

  const total = raisinCount(course);
  const r = g.result;
  const isTest = source.kind === 'test';
  const newBest = r && best && r.time < best.time;
  return <main className="ff-shell ff-playing">
    <header className="ff-header">
      <a href="/" className="ff-back">← MAIN ARCADE</a>
      <span className="ff-brand">{course.title}</span>
      <div className="ff-row">
        <button onClick={() => onSound(!sound)} aria-pressed={sound}>{sound ? 'Sound on' : 'Sound off'}</button>
        <button onClick={() => pause(!isPaused)} data-testid="pause">{isPaused ? 'Resume' : 'Pause'}</button>
        <button onClick={onExit} data-testid="exit">{isTest ? 'Back to editor' : 'Quit'}</button>
      </div>
    </header>
    <div className="ff-stage">
      <canvas
        ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0} aria-label={`${course.title}: a Fluff Forge course`}
        data-testid="board" data-state={g.state} data-x={Math.round(g.hero.x)} data-hero={g.heroId} data-power={g.hero.power} data-raisins={g.raisins}
      />
      {isPaused && !showResult && <div className="ff-overlay">
        <strong>Paused</strong>
        <div className="ff-row">
          <button className="ff-go" onClick={() => pause(false)}>Resume</button>
          <button onClick={restart}>Restart</button>
          <button onClick={onExit}>{isTest ? 'Back to editor' : 'Quit'}</button>
        </div>
      </div>}
      {showResult && r && <section className="ff-overlay" aria-label="Course clear" data-testid="result">
        <strong>Course clear!</strong>
        <p>{fmt(r.time)} · {r.raisins}/{total} raisins · {r.deaths ? `${r.deaths + 1} tries` : 'first try'}</p>
        {newBest && <p className="ff-ok">New best time!</p>}
        {isTest && !practice && <p className="ff-ok">Clear check passed. Your share code is ready on the home screen.</p>}
        {isTest && practice && <p>That was a practice run from part-way in. Test from the start to unlock the share code.</p>}
        <div className="ff-row">
          <button className="ff-go" onClick={restart} data-testid="again">Play again</button>
          <button onClick={onExit}>{isTest ? 'Back to editor' : 'Home'}</button>
        </div>
      </section>}
    </div>
    <div className="ff-pad" aria-label="Touch controls">
      {PAD.map((b) => <button key={b.key} aria-label={b.name} className={`ff-pad-${b.key}`}
        onPointerDown={(e) => { e.preventDefault(); touch.current[b.key] = true; }}
        onPointerUp={() => { touch.current[b.key] = false; }} onPointerLeave={() => { touch.current[b.key] = false; }} onPointerCancel={() => { touch.current[b.key] = false; }}
        onContextMenu={(e) => e.preventDefault()}>{b.label}</button>)}
    </div>
    <p className="ff-keys"><b>Keys:</b> ← → or A D move · Space, Z, W or ↑ jump (hold for height) · Shift or X run · ↓ or S drops through clouds · C tags {g.heroId === 'dora' ? 'Enzo' : 'Dora'} in · P pauses · R restarts. A gamepad works too.</p>
  </main>;
}
