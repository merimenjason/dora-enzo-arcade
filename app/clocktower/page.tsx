'use client';
// The Clocktower Mystery: the page. The painted rooms with their hotspots, cut-outs and ways out, Dora and Enzo walking
// the floor, the talk box, the satchel, Enzo's notebook of hints, switching between the two, the clock works close-up
// where the wheels go back on, chapter cards, the title, how to play, settings, the ending and the save. The rules are
// in lib/clocktower-game.ts; where things are in each painting is in ./rooms.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/clocktower-game';
import type { Action, Chapter, ItemId, Line, Outcome, RoomId, Save, State, Who } from '@/lib/clocktower-game';
import { FACES, LAYOUT, SPINDLES, type Rect } from './rooms';
import { ClockSound, type SongId } from './sound';
import './clocktower.css';

type Screen = 'title' | 'play' | 'ending' | 'howto' | 'settings';
const art = (n: string) => `/art/clocktower/${n}.webp`;
const NAMES: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', tock: 'Mr Tock', hollis: 'Baker Hollis', nell: 'Nell', twins: 'Hob and Hettie', gubbins: 'Gubbins', rook: 'Captain Rook' };
const SONG: Record<Chapter, SongId> = { 1: 'dusk', 2: 'night', 3: 'dawn', 4: 'ending' };
const OPENING: Line[] = [
  { who: 'dora', text: 'Enzo, look at the clock tower. Quarter past six... and it’s been quarter past six for ages.' },
  { who: 'enzo', text: 'The Winter Fair opens when it strikes eight tomorrow morning. If the clock’s stopped, there’s no fair.' },
  { who: 'dora', text: 'Then we’d better find out why. Mr Tock will be in the tower.' },
];
const centre = (r: Rect) => r[0] + r[2] / 2;
const clampX = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function Face({ who, big }: { who: string; big?: boolean }) {
  const f = FACES[who] ?? FACES.dora;
  return <span className={`ct-face${big ? ' big' : ''}`} aria-hidden="true" style={{ backgroundImage: `url(${art(f.src)})`, backgroundSize: `${f.size}%`, backgroundPosition: `${f.x}% ${f.y}%` }} />;
}

export default function ClocktowerPage() {
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const gameRef = useRef<State>(G.newState());
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  // the talk box: lines still to read, and what happens after the last one
  const [lines, setLines] = useState<Line[]>([]);
  const linesRef = useRef<Line[]>([]);
  const after = useRef<(() => void) | null>(null);
  const [sel, setSel] = useState<ItemId | null>(null);
  const [hover, setHover] = useState<string>('');
  const [card, setCard] = useState<Chapter | null>(null);
  const [works, setWorks] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [touch, setTouch] = useState(false);
  // where Dora and Enzo stand in their rooms (percent across) and which way they face
  const pos = useRef<Record<Who, number>>({ dora: 40, enzo: 52 });
  const face = useRef<Record<Who, 1 | -1>>({ dora: 1, enzo: 1 });
  const [walkMs, setWalkMs] = useState(0);
  const busy = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const sound = useRef<ClockSound | null>(null);
  const reduced = useRef(false);
  const sfx = () => sound.current;

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const saveGame = useCallback(() => { const s = { ...saveRef.current, game: G.clone(gameRef.current) }; persist(s); }, [persist]);
  const say = useCallback((ls: Line[], then?: () => void) => {
    if (!ls.length) { then?.(); return; }
    linesRef.current = ls; setLines(ls); after.current = then ?? null;
  }, []);
  const next = useCallback(() => {
    const rest = linesRef.current.slice(1); linesRef.current = rest; setLines(rest);
    if (!rest.length) { const f = after.current; after.current = null; f?.(); }
    sfx()?.button();
  }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    setTouch(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    sound.current = new ClockSound(s.settings.sound, s.settings.music);
    const vis = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); sound.current?.pump(); }; raf = requestAnimationFrame(loop);
    setReady(true);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); sound.current?.dispose(); };
  }, []);
  useEffect(() => {
    const g = gameRef.current;
    sfx()?.music(screen === 'play' ? SONG[g.ch] : screen === 'ending' ? 'ending' : screen === 'title' ? null : 'menu');
  });

  // ---------------------------------------------------------------- playing
  const placeAll = useCallback(() => {
    const g = gameRef.current, r = G.room(g), L = LAYOUT[r];
    for (const w of ['dora', 'enzo'] as Who[]) if (g.at[w] === r) pos.current[w] = L.start[w];
    if (g.at.dora === r && g.at.enzo === r && g.who === 'enzo') { pos.current.enzo = L.start.dora; pos.current.dora = L.start.enzo; }
  }, []);
  const begin = (fresh: boolean) => {
    sfx()?.unlock(); sfx()?.button();
    const sv = saveRef.current;
    gameRef.current = !fresh && sv.game ? G.clone(sv.game) : G.newState();
    setSel(null); setWorks(false); setMenu(false); setCard(null); linesRef.current = []; setLines([]); busy.current = false;
    placeAll(); setScreen('play');
    if (fresh || !sv.game) { persist({ ...sv, game: G.clone(gameRef.current) }); say(OPENING, () => setCard(1)); }
  };
  /** walk the one you're playing over to x, then carry on */
  const walkTo = (x: number, then: () => void) => {
    const g = gameRef.current, w = g.who, L = LAYOUT[G.room(g)], to = clampX(x, L.lo, L.hi), from = pos.current[w];
    const fast = saveRef.current.settings.fast || reduced.current, ms = fast ? 0 : Math.min(900, Math.max(120, Math.abs(to - from) * 14));
    if (Math.abs(to - from) > 0.5) face.current[w] = to > from ? 1 : -1;
    pos.current[w] = to; setWalkMs(ms); redraw();
    if (ms > 0) sfx()?.step1();
    if (ms === 0) { then(); return; }
    busy.current = true; setTimeout(() => { busy.current = false; then(); }, ms);
  };
  /** do an action and show what happened */
  const run = useCallback((a: Action, at?: number) => {
    const g = gameRef.current;
    const go = () => {
      const o: Outcome = G.act(g, a);
      if (o.sfx) sfx()?.play(o.sfx);
      if (a.k === 'go' && o.ok) placeAll();
      if (o.got) setSel(null);
      if (o.ok) saveGame();
      redraw();
      say(o.lines, () => {
        if (o.open === 'works') setWorks(true);
        if (o.end) { setWorks(false); sfx()?.play('bell'); const sv = { ...saveRef.current }; const best = G.finish(sv, g); sv.game = null; persist(sv); setTimeout(() => setScreen('ending'), reduced.current ? 0 : 900); void best; return; }
        if (o.chapterUp) setCard(o.chapterUp);
      });
    };
    if (at === undefined) go(); else walkTo(at, go);
  }, [persist, placeAll, redraw, saveGame, say, setScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  const clickSpot = (id: string) => {
    if (busy.current || card || menu) return;
    if (linesRef.current.length) { next(); return; }
    sfx()?.unlock();
    const g = gameRef.current, L = LAYOUT[G.room(g)], sp = L.sprites.find((s) => s.spot === id && (!s.when || s.when(g)));
    const r = L.spots[id] ?? (sp ? spriteRect(sp) : null), x = r ? centre(r) : pos.current[g.who];
    if (sel) { const it = sel; setSel(null); run({ k: 'item', item: it, id }, x); } else run({ k: 'spot', id }, x);
  };
  const clickExit = (to: RoomId) => {
    if (busy.current || card || menu) return;
    if (linesRef.current.length) { next(); return; }
    sfx()?.unlock(); setSel(null);
    const r = LAYOUT[G.room(gameRef.current)].exits[to]!.rect;
    run({ k: 'go', to }, centre(r));
  };
  const clickFloor = (e: React.MouseEvent<HTMLDivElement>) => {
    if (busy.current || card || menu) return;
    if (linesRef.current.length) { next(); return; }
    if (sel) { setSel(null); return; }
    const box = e.currentTarget.getBoundingClientRect(); walkTo(((e.clientX - box.left) / box.width) * 100, () => {});
  };
  const swap = () => { if (linesRef.current.length) { next(); return; } if (busy.current || card || menu) return; sfx()?.button(); setSel(null); run({ k: 'swap' }); };
  const notebook = () => {
    if (busy.current || card || menu || linesRef.current.length) return;
    const g = gameRef.current; g.hints++; saveGame(); sfx()?.play('pickup');
    say([{ who: 'enzo', text: `(Enzo’s notebook) ${G.hint(g)}` }]);
  };
  const pickItem = (it: ItemId) => {
    if (linesRef.current.length) { next(); return; }
    sfx()?.button();
    if (sel === it) { say([{ who: gameRef.current.who, text: G.ITEMS[it].look }]); setSel(null); return; }
    setSel(it);
  };
  const fitGear = (slot: number) => {
    if (linesRef.current.length) { next(); return; }
    const g = gameRef.current, it = sel;
    if (!it) { say([{ who: g.who, text: 'Pick a wheel from the satchel first.' }]); return; }
    setSel(null); run({ k: 'fit', item: it, slot });
  };

  // on a narrow screen the painting is wider than the stage: keep the one you're playing in view
  useEffect(() => {
    const st = stageRef.current, sc = st?.firstElementChild as HTMLElement | null;
    if (!st || !sc || sc.offsetWidth <= st.clientWidth + 2) return;
    const x = (works ? 50 : pos.current[gameRef.current.who]) / 100 * sc.offsetWidth - st.clientWidth / 2;
    st.scrollTo({ left: x, behavior: reduced.current || saveRef.current.settings.fast ? 'auto' : 'smooth' });
  });

  // ---------------------------------------------------------------- keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (screenRef.current !== 'play') return;
      sfx()?.unlock();
      if (card) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); setCard(null); } return; }
      if (linesRef.current.length && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); next(); return; }
      if (e.code === 'Escape') { if (sel) setSel(null); else if (works) setWorks(false); else setMenu((m) => !m); return; }
      if (menu) return;
      if (e.code === 'KeyX') swap();
      else if (e.code === 'KeyH') notebook();
      else if (e.code === 'KeyQ' && !e.repeat) { setReveal(true); }
      else if (/^Digit[1-9]$/.test(e.code)) { const it = gameRef.current.inv[+e.code.slice(5) - 1]; if (it) pickItem(it); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'KeyQ') setReveal(false); };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  });

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __clocktower: () => unknown }).__clocktower = () => ({
      screen: screenRef.current, state: G.clone(gameRef.current), lines: linesRef.current.map((l) => l.text), card, works, sel, menu, save: saveRef.current, busy: busy.current,
      debug: {
        /** play the walkthrough until the given chapter starts (or to the end with 4), with no talking */
        skip: (ch: number) => { const g = G.newState(); for (const a of G.WALKTHROUGH) { if (g.ch >= ch) break; G.act(g, a); } gameRef.current = g; linesRef.current = []; setLines([]); setCard(null); setWorks(false); placeAll(); saveGame(); redraw(); },
        /** the walkthrough up to just before step n */
        upto: (n: number) => { const g = G.newState(); G.WALKTHROUGH.slice(0, n).forEach((a) => G.act(g, a)); gameRef.current = g; linesRef.current = []; setLines([]); setCard(null); setWorks(false); placeAll(); saveGame(); redraw(); },
        fast: () => persist({ ...saveRef.current, settings: { ...saveRef.current.settings, fast: true } }),
      },
    });
  });

  // ---------------------------------------------------------------- views
  const g = gameRef.current, here = G.room(g), L = LAYOUT[here], sv = save;
  const speaking = lines[0];
  const status = sel ? `Use the ${G.ITEMS[sel].name.toLowerCase()} on…` : hover || G.ROOMS[here].name;
  const together = g.at.dora === g.at.enzo;
  return <main className={`ct-shell ct-on-${screen}${touch ? ' ct-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    {screen === 'title' && <section className="ct-title">
      <div className="ct-bg"><img src={art('title')} alt="" /></div>
      <div className="ct-title-col">
        <h1 className="ct-logo">The Clocktower <span>Mystery</span></h1>
        <p className="ct-tag">The town clock has stopped the night before the Winter Fair, and four of its wheels are missing. Can Dora and Enzo find them all before eight o’clock?</p>
        <div className="ct-menu">
          {sv.game && <button className="ct-go" onClick={() => begin(false)}>Carry on · {G.CHAPTERS[sv.game.ch]}</button>}
          <button className={sv.game ? '' : 'ct-go'} onClick={() => { if (!sv.game || window.confirm('Start the mystery again from the beginning?')) begin(true); }}>{sv.game ? 'Start again' : 'Begin the mystery'}</button>
          <button onClick={() => { sfx()?.unlock(); setScreen('howto'); }}>How to play</button>
          <button onClick={() => { sfx()?.unlock(); setScreen('settings'); }}>Settings</button>
        </div>
        {sv.done && sv.best && <p className="ct-small">Solved! Best: {sv.best.hints} {sv.best.hints === 1 ? 'hint' : 'hints'}, {sv.best.moves} moves.</p>}
        <a className="ct-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'play' && <section className="ct-play">
      <div className="ct-stage" ref={stageRef}>
        {!works ? <div className={`ct-scene${reveal ? ' reveal' : ''}${sel ? ' using' : ''}`} data-room={here} onClick={clickFloor}>
          <img className="ct-room" src={art(L.img(g))} alt={G.ROOMS[here].name} draggable={false} />
          {L.sprites.filter((s) => !s.when || s.when(g)).map((s) => <img key={s.id} className="ct-sprite" data-sprite={s.id} src={art(s.src)} alt="" draggable={false} style={{ left: `${s.x}%`, bottom: `${100 - s.y}%`, height: `${s.h}%`, transform: `translateX(-50%)${s.flip ? ' scaleX(-1)' : ''}` }} />)}
          {(['dora', 'enzo'] as Who[]).filter((w) => g.at[w] === here).map((w) => <img key={w} className={`ct-hero${g.who === w ? ' on' : ''}${w === 'dora' && g.flags.includes('holding') ? ' up' : ''}`} data-hero={w} src={art(w)} alt={NAMES[w]} draggable={false}
            style={{ left: `${pos.current[w]}%`, bottom: `${100 - L.floor}%`, height: `${L.size}%`, transform: `translateX(-50%) scaleX(${face.current[w]})`, transitionDuration: `${walkMs}ms` }} />)}
          {G.spots(g, here).filter((id) => !(id === 'hatdoor' && g.flags.includes('twinsOpen'))).map((id) => {
            const sp = L.sprites.find((s) => s.spot === id && (!s.when || s.when(g)));
            return { id, r: L.spots[id] ?? (sp ? spriteRect(sp) : null) };
          }).filter((h): h is { id: string; r: Rect } => !!h.r).sort((a, b) => b.r[2] * b.r[3] - a.r[2] * a.r[3]).map(({ id, r }) => {
            // the biggest go underneath, so a little thing on the bench can still be clicked
            return <button key={id} className="ct-spot" data-spot={id} aria-label={G.SPOTS[id].name} style={{ left: `${r[0]}%`, top: `${r[1]}%`, width: `${r[2]}%`, height: `${r[3]}%` }}
              onClick={(e) => { e.stopPropagation(); clickSpot(id); }} onMouseEnter={() => setHover(G.SPOTS[id].name)} onMouseLeave={() => setHover('')} />;
          })}
          {G.exits(here).map((to) => {
            const ex = L.exits[to]; if (!ex || (to === 'hatshop' && !g.flags.includes('twinsOpen'))) return null;
            return <button key={to} className={`ct-exit ct-exit-${ex.dir}`} data-exit={to} aria-label={ex.label} style={{ left: `${ex.rect[0]}%`, top: `${ex.rect[1]}%`, width: `${ex.rect[2]}%`, height: `${ex.rect[3]}%` }}
              onClick={(e) => { e.stopPropagation(); clickExit(to); }} onMouseEnter={() => setHover(ex.label)} onMouseLeave={() => setHover('')}><i aria-hidden="true">{ex.dir === 'left' ? '◀' : ex.dir === 'right' ? '▶' : ex.dir === 'up' ? '▲' : ex.dir === 'down' ? '▼' : '●'}</i></button>;
          })}
          {g.at.dora !== g.at.enzo && <p className="ct-apart">{NAMES[g.who === 'dora' ? 'enzo' : 'dora']} is at {G.ROOMS[g.at[g.who === 'dora' ? 'enzo' : 'dora']].name.replace(/^The /, 'the ')}{g.who === 'enzo' && g.flags.includes('holding') ? ', hanging on the lever' : ''}</p>}
        </div> : <div className="ct-scene ct-works" data-room="works">
          <img className="ct-room" src={art('works')} alt="The back of the clock works with four spindles" draggable={false} />
          {SPINDLES.map((p, k) => <button key={k} className={`ct-spindle${g.fitted[k] ? ' full' : ''}`} data-slot={k} aria-label={`Spindle ${k + 1}${g.fitted[k] ? `: the ${G.ITEMS[g.fitted[k]!].name.toLowerCase()}` : ''}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.d}%` }} onClick={() => fitGear(k)}>
            {g.fitted[k] && <img src={art(`item-${g.fitted[k]}`)} alt="" draggable={false} className={k % 2 ? 'ccw' : 'cw'} />}
          </button>)}
          <button className="ct-back" onClick={() => { setSel(null); setWorks(false); }}>‹ Back</button>
        </div>}
        {card && <div className="ct-card" role="dialog" onClick={() => setCard(null)}>
          <div><small>Chapter {card === 4 ? '' : card}</small><h2>{G.CHAPTERS[card]}</h2>
            <p>{card === 1 ? 'Dusk, the evening before the Winter Fair.' : card === 2 ? 'Night falls. Three wheels to find, somewhere in town.' : 'The small hours. One wheel left, and a secret.'}</p>
            <button className="ct-go" onClick={(e) => { e.stopPropagation(); setCard(null); }}>Go on</button></div>
        </div>}
        {menu && <div className="ct-card ct-pause" role="dialog"><div>
          <h2>Paused</h2>
          <div className="ct-row"><button className="ct-go" onClick={() => setMenu(false)}>Carry on</button></div>
          <div className="ct-row">{(['sound', 'music', 'fast'] as const).map((k) => <button key={k} onClick={() => setSetting(k, !sv.settings[k])}>{k === 'fast' ? 'Quick walking' : k === 'sound' ? 'Sound' : 'Music'}: {sv.settings[k] ? 'on' : 'off'}</button>)}</div>
          <div className="ct-row"><button onClick={() => { setMenu(false); setScreen('title'); }}>Back to the title (it’s saved)</button></div>
        </div></div>}
      </div>
      <div className="ct-bar">
        <div className="ct-who">
          {(['dora', 'enzo'] as Who[]).map((w) => <button key={w} className={g.who === w ? 'on' : ''} data-who={w} aria-pressed={g.who === w} onClick={() => { if (g.who !== w) swap(); }} title={`${NAMES[w]}${!together ? ` · ${G.ROOMS[g.at[w]].name}` : ''}`}>
            <Face who={w} /><span>{NAMES[w]}</span>
          </button>)}
        </div>
        <div className={`ct-talk${speaking ? ' on' : ''}`} onClick={() => speaking && next()} aria-live="polite" role={speaking ? 'button' : undefined} tabIndex={speaking ? 0 : -1}>
          {speaking ? <>
            <Face who={speaking.who} big />
            <div><b>{NAMES[speaking.who]}</b><p>{speaking.text}</p><small>{touch ? 'tap' : 'click or Enter'} ›</small></div>
          </> : <p className="ct-status">{status}</p>}
        </div>
        <div className="ct-bag">
          {g.inv.map((it, i) => <button key={it} className={sel === it ? 'on' : ''} data-item={it} aria-label={`${G.ITEMS[it].name}${sel === it ? ' (picked: click again to look)' : ''}`} title={`${i + 1}: ${G.ITEMS[it].name}`} onClick={() => pickItem(it)}>
            <img src={art(`item-${it}`)} alt="" draggable={false} />
          </button>)}
          {!g.inv.length && <span className="ct-small">The satchel’s empty.</span>}
        </div>
        <div className="ct-tools">
          <button onClick={notebook} title="Enzo’s notebook: a hint (H)">📓 Hint</button>
          <button onPointerDown={() => setReveal(true)} onPointerUp={() => setReveal(false)} onPointerLeave={() => setReveal(false)} title="Show everything you can click (hold Q)">🔍</button>
          <button onClick={() => setMenu(true)} aria-label="Pause">❚❚</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="ct-ending">
      <div className="ct-bg"><img src={art('ending')} alt="Dawn on the morning of the fair: the clock strikes eight, the twins ring the bell, and Dora, Enzo, Mr Tock, Hollis, Nell, Captain Rook and Gubbins cheer" /></div>
      <div className="ct-ending-text">
        <h2>Eight o’clock, and the fair is open!</h2>
        <p>The clock ticks again, the hands creep round to eight, and Hob and Hettie pull the bell rope together while the little star wheel plays its chime over the square. Mr Tock wipes his spectacles, Hollis hands out the first warm buns, and even Captain Rook wakes up in time to see it.</p>
        {sv.best && <p className="ct-small">Solved in {g.moves} moves with {g.hints} {g.hints === 1 ? 'hint' : 'hints'}.{sv.best.moves === g.moves && sv.best.hints === g.hints ? ' Your best yet!' : ''}</p>}
        <div className="ct-row"><button className="ct-go" onClick={() => setScreen('title')}>Back to the title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="ct-page">
      <header className="ct-head"><button onClick={() => setScreen('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="ct-cols">
        <div className="ct-paper"><h3>Looking about</h3><ul><li>Click or tap anything in the painting to look at it, talk to someone or pick something up. Your hero walks over and has a go.</li><li>The arrows lead out to other places.</li><li>Hold <b>Q</b> (or the 🔍 button) to light up everything you can click.</li></ul></div>
        <div className="ct-paper"><h3>The satchel</h3><ul><li>Click a thing in the satchel to pick it up, then click where to use it. Click it again to look at it closely. <b>1</b> to <b>9</b> pick them too.</li><li><b>Esc</b> puts it back.</li></ul></div>
        <div className="ct-paper"><h3>Dora and Enzo</h3><ul><li>Dora climbs: high places and out on ledges. Enzo listens: he hears what others miss and remembers any tune.</li><li>Switch between them with the buttons or <b>X</b>. They walk together unless one of them is busy.</li><li>Stuck? <b>Enzo’s notebook</b> (<b>H</b>) always knows what to try next.</li></ul></div>
      </div>
    </section>}

    {screen === 'settings' && <section className="ct-page">
      <header className="ct-head"><button onClick={() => setScreen('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="ct-paper ct-settings">
        {(['sound', 'music', 'fast'] as const).map((k) => <div className="ct-set" key={k}><span>{k === 'fast' ? 'Quick walking (no walking about)' : k === 'sound' ? 'Sound' : 'Music'}</span><span className="ct-seg">{[true, false].map((v) => <button key={String(v)} className={sv.settings[k] === v ? 'on' : ''} onClick={() => setSetting(k, v)}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <button className="ct-danger" onClick={() => { if (window.confirm('Forget the saved mystery and your best?')) { const n = G.newSave(); n.settings = sv.settings; persist(n); } }}>Forget everything</button>
      </div>
    </section>}
  </main>;

  function setSetting(k: keyof Save['settings'], v: boolean) {
    persist({ ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } });
    if (k === 'sound') sfx()?.setSound(v); else if (k === 'music') sfx()?.setMusic(v);
  }
}
/** a cut-out's clickable box */
function spriteRect(s: { x: number; y: number; h: number }): Rect { const w = s.h * 0.45; return [s.x - w / 2, s.y - s.h, w, s.h]; }
