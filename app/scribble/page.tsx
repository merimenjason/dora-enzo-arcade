/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { Game, LEVELS, WORLDS, NOUNS, ADJECTIVES, NOUN, ADJ, starsFor, parse, W, H } from '../../lib/scribble-game';
import { drawWorld, drawHeroes, VIEW_W, VIEW_H } from '../../lib/scribble-scene';
import './scribble.css';

const SAVE_KEY = 'chinchilla-scribble-v1', DT = 1 / 60, SCALE = 2;
type LevelSave = { stars: number; words: string[]; fresh: number };
type Save = { levels: Record<number, LevelSave>; nouns: string[]; adjs: string[] };
const empty = (): Save => ({ levels: {}, nouns: [], adjs: [] });
function readSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!s || typeof s !== 'object') return empty();
    return { levels: s.levels ?? {}, nouns: Array.isArray(s.nouns) ? s.nouns : [], adjs: Array.isArray(s.adjs) ? s.adjs : [] };
  } catch { return empty(); }
}
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, progress just isn't kept */ } };
const opened = (save: Save, i: number) => i === 0 || !!save.levels[i - 1];

function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return <span className="sc-stars" aria-label={`${n} of ${of} stars`}>{Array.from({ length: of }, (_, i) => <svg key={i} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" className={i < n ? 'on' : ''} /></svg>)}</span>;
}
function Heroes() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawHeroes(c, 150, 100, 0.4);
  }, []);
  return <canvas ref={ref} width={150 * SCALE} height={100 * SCALE} style={{ width: 150, height: 100 }} aria-hidden="true" />;
}

type Result = { stars: number; words: string[]; fresh: boolean; best: boolean };

export default function ChinchillaScribble() {
  const [save, setSave] = useState<Save>(empty);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'play'>('home');
  const [text, setText] = useState('');
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [hints, setHints] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [book, setBook] = useState(false);
  const [, setTick] = useState(0);
  const game = useRef<Game | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const keys = useRef(new Set<string>());
  const focusRef = useRef<number | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null);
  const noteTimer = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => { setSave(readSave()); setLoaded(true); }, []);
  // The browser test reads and drives the running game through this.
  useEffect(() => { (window as unknown as { __scribble?: () => Game | null }).__scribble = () => game.current; }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (t: string, bad = false) => { if (!t) return; setNote({ text: t, bad }); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(null), 3600); };
  const pick = (id: number | null) => { focusRef.current = id; setFocus(id); };

  function begin(level: number) {
    game.current = new Game(level, (Date.now() % 100000) + 1);
    keys.current.clear(); drag.current = null;
    pick(null); setHints(0); setResult(null); setText(''); setNote(null);
    setScreen('play');
    refresh();
    window.setTimeout(() => field.current?.focus(), 50);
  }

  function won(g: Game) {
    const s = saveRef.current;
    const words = [...new Set(g.summons.flatMap((label) => { const p = parse(label); return p.ok ? p.words : []; }))];
    const before = s.levels[g.level];
    const fresh = !!before && words.every((w) => !before.words.includes(w));
    const stars = starsFor(g.summons.length, g.def.par);
    const next: Save = { ...s, levels: { ...s.levels, [g.level]: { stars: Math.max(before?.stars ?? 0, stars), words: [...new Set([...(before?.words ?? []), ...words])], fresh: (before?.fresh ?? 0) + (fresh ? 1 : 0) } } };
    setSave(next); writeSave(next);
    setResult({ stars, words: g.summons, fresh, best: !before || stars > before.stars });
  }

  function summon(e: { preventDefault: () => void }) {
    e.preventDefault();
    const g = game.current;
    if (!g || g.state !== 'playing') return;
    const r = g.summon(text);
    if (!r.ok) { say(r.message, true); return; }
    const p = parse(text);
    if (p.ok) {
      const s = saveRef.current;
      const nouns = s.nouns.includes(p.noun.id) ? s.nouns : [...s.nouns, p.noun.id];
      const adjs = [...s.adjs, ...p.adjs.map((a) => a.id).filter((a) => !s.adjs.includes(a))];
      if (nouns !== s.nouns || adjs.length !== s.adjs.length) { const next = { ...s, nouns, adjs }; setSave(next); writeSave(next); }
    }
    pick(r.ent.id);
    setText('');
    // Hand the keys back to the chinchillas; Enter or / brings the pencil back.
    field.current?.blur();
    canvas.current?.focus();
    refresh();
  }

  // The loop: fixed steps, held keys become input, events become notes.
  useEffect(() => {
    if (screen !== 'play') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, acc = 0, ui = 0;
    const loop = (now: number) => {
      const g = game.current;
      if (!g) return;
      const k = keys.current;
      g.input.dir = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) as -1 | 0 | 1;
      g.input.up = k.has('up'); g.input.down = k.has('down');
      acc += last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      while (acc >= DT) { g.update(DT); acc -= DT; }
      for (const ev of g.events.splice(0)) {
        if (ev.kind === 'say') say(ev.text);
        if (ev.kind === 'win') won(g);
      }
      if (focusRef.current !== null && !g.ent(focusRef.current)) pick(null);
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawWorld(c, g, now / 1000, SCALE, focusRef.current);
      if (now - ui > 150) { refresh(); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  // Keyboard: arrows or WASD move, Space or ↑ jumps and climbs, Q swaps, Enter writes, Delete removes.
  useEffect(() => {
    if (screen !== 'play') return;
    const map: Record<string, string> = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', ' ': 'up', arrowdown: 'down', s: 'down' };
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g) return;
      const el = e.target as HTMLElement;
      const k = e.key.toLowerCase();
      if (el.closest('input,textarea')) { if (k === 'escape') { field.current?.blur(); canvas.current?.focus(); } return; }
      if (el.closest('button,a') && (k === 'enter' || k === ' ')) return;
      if (g.state !== 'playing') return;
      if (map[k]) {
        e.preventDefault();
        if (map[k] === 'up' && !e.repeat) g.input.jump = true;
        keys.current.add(map[k]);
        return;
      }
      if (k === 'enter' || k === '/' || k === 't') { e.preventDefault(); field.current?.focus(); return; }
      if (k === 'q') { g.swap(); refresh(); return; }
      if (k === 'h') { setHints((n) => Math.min(g.def.hints.length, n + 1)); return; }
      if (k === 'r' && !e.repeat) { begin(g.level); return; }
      const id = focusRef.current;
      if (id !== null && (k === 'delete' || k === 'backspace')) { e.preventDefault(); g.remove(id); pick(null); return; }
      const nudge: Record<string, [number, number]> = { i: [0, -12], k: [0, 12], j: [-12, 0], l: [12, 0] };
      if (id !== null && nudge[k]) { e.preventDefault(); g.nudge(id, ...nudge[k]); }
    };
    const up = (e: KeyboardEvent) => { const k = map[e.key.toLowerCase()]; if (k) keys.current.delete(k); };
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  });

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };

  const header = (
    <header className="sc-header">
      <a className="sc-back" href="/">← MAIN ARCADE</a>
      <span className="sc-brand">CHINCHILLA SCRIBBLE</span>
      <span />
    </header>
  );

  const g = game.current;
  if (screen === 'home' || !g) {
    const total = Object.values(save.levels).reduce((s, l) => s + l.stars, 0);
    return (
      <main className="sc-shell">
        {header}
        <section className="sc-intro">
          <Heroes />
          <div>
            <p className="sc-eyebrow">WORD PUZZLES · {NOUNS.length} THINGS · {ADJECTIVES.length} ADJECTIVES</p>
            <h1>Chinchilla Scribble</h1>
            <p className="sc-lede">Write a word and it appears. A <b>ladder</b> to climb, a <b>bridge</b> to cross, a <b>carrot</b> for a hungry llama. Stack adjectives for something new: a <b>giant flying hay bale</b>, a <b>frozen campfire</b>, a <b>sleepy bear</b>. Help Dora and Enzo reach the golden wolfberry in every level, using as few words as you can.</p>
          </div>
        </section>

        <h2 className="sc-section">Choose a level <small>{total} of {LEVELS.length * 3} stars</small></h2>
        <div className="sc-worlds">
          {WORLDS.map((world, wi) => (
            <section key={world} className={`sc-world w${wi}`} aria-label={world}>
              <h3>{world}</h3>
              <div className="sc-levels">
                {LEVELS.map((l, i) => l.world !== wi ? null : (
                  <button key={l.name} className={`sc-level${save.levels[i] ? ' done' : ''}`} data-testid={`level-${i + 1}`} disabled={!loaded || !opened(save, i)} onClick={() => begin(i)}>
                    <em>{i + 1}</em>
                    <strong>{l.name}</strong>
                    {save.levels[i] ? <><Stars n={save.levels[i].stars} />{save.levels[i].fresh > 0 && <small>{save.levels[i].fresh}× solved again with new words</small>}</> : <small>{opened(save, i) ? `Par ${l.par} ${l.par === 1 ? 'word' : 'words'}` : 'Locked'}</small>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="sc-row">
          <button className="sc-go" data-testid="sandbox" disabled={!loaded} onClick={() => begin(-1)}>Sandbox: no goal, just words →</button>
          <button onClick={() => setBook((b) => !b)} aria-expanded={book}>Word book · {save.nouns.length} of {NOUNS.length} things found</button>
        </div>
        {book && (
          <section className="sc-book" aria-label="Word book">
            <p>Every thing and adjective you’ve written. There are {NOUNS.length - save.nouns.length} things and {ADJECTIVES.length - save.adjs.length} adjectives still to find.</p>
            <div className="sc-chips">{save.nouns.map((n) => <span key={n} className="sc-chip">{NOUN.get(n)?.words[0] ?? n}</span>)}</div>
            <div className="sc-chips adj">{save.adjs.map((a) => <span key={a} className="sc-chip">{ADJ.get(a)?.words[0] ?? a}</span>)}</div>
          </section>
        )}

        <h2 className="sc-section">How to play</h2>
        <ul className="sc-how">
          <li><b>Write</b> a thing, with any adjectives in front, and press Enter. It appears next to whoever you’re steering.</li>
          <li><b>Drag</b> things with the mouse or a finger. Click or tap anywhere else to walk, climb or fly there.</li>
          <li><b>Keys:</b> ←/→ walk, ↑ or Space jumps and climbs, ↓ climbs down or hops off a ride, Q swaps between Dora and Enzo, Enter writes a new word, Delete removes the thing you picked, I J K L nudge it.</li>
          <li><b>Stars:</b> three for solving at or under par. Solve a level again using only words you haven’t used there before for a bonus.</li>
        </ul>
      </main>
    );
  }

  const record = g.level >= 0 ? save.levels[g.level] : undefined;
  const riding = g.lead.riding !== null;
  return (
    <main className="sc-shell sc-play">
      {header}
      <section className="sc-top" aria-label="Goal">
        <div className="sc-goal">
          <p className="sc-lvl">{g.level < 0 ? 'Sandbox' : `${WORLDS[g.def.world]} · level ${g.level + 1} of ${LEVELS.length}`} · {g.def.name}</p>
          <p className="sc-ask">{g.def.goal}</p>
          {hints > 0 && <p className="sc-hint">Try: {g.def.hints.slice(0, hints).map((h) => `“${h}”`).join(', ')}</p>}
        </div>
        {g.level >= 0 && <div className="sc-par"><Stars n={g.state === 'won' ? g.stars : starsFor(Math.max(g.summons.length, 0), g.def.par)} /><span data-testid="count">{g.summons.length} {g.summons.length === 1 ? 'word' : 'words'} · par {g.def.par}</span></div>}
        <div className="sc-buttons">
          <button className="sc-swap" onClick={() => { g.swap(); refresh(); }} aria-label={`Swap to ${g.leader === 'dora' ? 'Enzo' : 'Dora'} (Q)`}>⇄ {g.leader === 'dora' ? 'Enzo' : 'Dora'}</button>
          {g.level >= 0 && <button onClick={() => setHints((n) => Math.min(g.def.hints.length, n + 1))} disabled={hints >= g.def.hints.length}>Hint · H</button>}
          <button onClick={() => begin(g.level)}>Restart · R</button>
          <button onClick={() => setScreen('home')}>Levels</button>
        </div>
      </section>
      <div className="sc-board">
        <canvas
          ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
          data-testid="world" data-state={g.state} data-leader={g.leader}
          aria-label="The level. Click or tap to walk there, drag things to move them. Arrow keys walk, Space jumps, Enter writes a word."
          onPointerDown={(e) => {
            const p = toWorld(e);
            const hit = g.entAt(p.x, p.y);
            e.currentTarget.setPointerCapture(e.pointerId);
            if (hit && g.grab(hit.id)) { drag.current = { id: hit.id, dx: hit.x - p.x, dy: hit.y - p.y, x: p.x, y: p.y, moved: false }; pick(hit.id); return; }
            pick(null);
            g.goTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = toWorld(e);
            if (Math.hypot(p.x - d.x, p.y - d.y) > 4) d.moved = true;
            g.dragTo(p.x + d.dx, p.y + d.dy);
          }}
          onPointerUp={() => { if (drag.current) { g.release(); drag.current = null; } }}
          onPointerCancel={() => { if (drag.current) { g.release(); drag.current = null; } }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {note && <output className={`sc-note${note.bad ? ' bad' : ''}`} data-testid="note">{note.text}</output>}
        {g.state === 'won' && result && (
          <div className="sc-overlay" data-testid="won">
            <div>
              <p className="sc-eyebrow">GOLDEN WOLFBERRY!</p>
              <h2>{result.stars === 3 ? 'Perfect!' : 'Got it!'}</h2>
              <Stars n={result.stars} />
              <p>{result.words.length === 0 ? 'No words at all?' : `${result.words.length} ${result.words.length === 1 ? 'word' : 'words'}: ${result.words.join(', ')}.`} Par is {g.def.par}.</p>
              {result.fresh && <p className="sc-fresh">Solved again with all-new words! That’s {record?.fresh ?? 1} so far for this level.</p>}
              {!result.fresh && <p className="sc-small">For a bonus, solve it again using only words you haven’t used here yet.</p>}
              <div className="sc-row">
                {g.level + 1 < LEVELS.length && <button className="sc-go" data-testid="next" onClick={() => begin(g.level + 1)}>Next: {LEVELS[g.level + 1].name} →</button>}
                <button onClick={() => begin(g.level)}>Play again</button>
                <button onClick={() => setScreen('home')}>Levels</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <form className="sc-bottom" onSubmit={summon}>
        <label className="sc-field">
          <span>Write a word</span>
          <input ref={field} data-testid="word" value={text} onChange={(e) => setText(e.target.value)} placeholder="ladder, giant flying hay bale…" autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" maxLength={60} />
        </label>
        <button className="sc-go" type="submit" disabled={g.state !== 'playing'}>Summon</button>
        <div className="sc-tools">
          {riding && <button type="button" onClick={() => { g.hopOff(); refresh(); }}>Hop off · ↓</button>}
          {focus !== null && g.ent(focus) && <button type="button" onClick={() => { g.remove(focus); pick(null); }}>Remove {g.ent(focus)?.label} · Del</button>}
        </div>
        <div className="sc-used" aria-label="Words used">{g.summons.slice(-6).map((w, i) => <span key={i} className="sc-chip">{w}</span>)}</div>
      </form>
    </main>
  );
}
