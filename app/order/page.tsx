'use client';
// Turn Order: the page. The queue bar (swap two neighbours, send one to the front with a token, sing one to sleep), the
// board on a canvas with its ghost preview, playing a round step by step, Enzo's pointers, the perk picker, results
// and the save. Rules in lib/order-game.ts, drawing in lib/order-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/order-game';
import type { Actor, Ev, PerkId, Run, Save, Step } from '@/lib/order-game';
import type { OrderScene } from '@/lib/order-scene';
import { OrderSound, type SongId } from './sound';
import './order.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; board: number; boards: number; pars: number; swaps: number; secs: number; best: boolean };

const art = (n: string) => `/art/order/${n}.png`;
const INTRO = [
  'Dora wants to plant the golden acorn in her pot, and the garden critters are all going to help. In their own way.',
  'I can’t move any of them. Every round, each one does its one thing, in the order on the queue: first to last.',
  'All I can do is conduct: swap two neighbours in the queue, once a round. Watch the ghost on the board: it shows what the round will do.',
  'Get the acorn in the pot before the rounds run out. And keep it away from the frogs!',
];
const FAIL: Record<string, string> = {
  eaten: 'Gulp! A frog got the acorn. Let’s try that garden again.',
  boom: 'Kaboom! The acorn went up with the beetle. Again!',
  stolen: 'The Grumble snatched it! Once more from the top.',
  rounds: 'Out of rounds, and no acorn in the pot. Let’s have another go.',
};

export default function TurnOrderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OrderScene | null>(null);
  const soundRef = useRef<OrderSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const runRef = useRef<Run | null>(null);
  const [, setTick] = useState(0);
  const bump = () => setTick((x) => x + 1);
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [intro, setIntro] = useState(-1);
  const introRef = useRef(-1);
  const [sel, setSel] = useState(-1);
  const [gap, setGap] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  /** while a round plays, the board as it was */
  const shown = useRef<G.Board | null>(null);
  const reduced = useRef(false);
  const started = useRef(0);
  const said = useRef(new Set<string>());

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;
  const say = useCallback((text: string, mood: Line['mood'] = '', once?: string) => {
    if (once) { if (said.current.has(once)) return; said.current.add(once); }
    setLine({ text, key: Math.random(), mood }); sfx()?.enzo(text);
  }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new OrderSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/order-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.OrderScene(canvasRef.current); sc.speed = s.settings.fast ? 2.2 : 1; sceneRef.current = sc;
      void sc.load(); setReady(true);
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, []);

  const r = runRef.current;
  useEffect(() => {
    const song: SongId | null = screen === 'play' ? (r && r.tier === 3 ? 'boss' : 'garden') : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song);
  });

  // fit the garden into the space it has, in whole pixels when that's close enough
  useEffect(() => {
    const box = boxRef.current, cv = canvasRef.current; if (!box || !cv) return;
    const fit = () => {
      const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
      // on a narrow screen, zoom in on the board and let the lawn either side (and Enzo and Dora) go off the edges
      const whole = Math.min(w / 384, h / 216), board = Math.min(w / 204, h / 216);
      let s = board > whole * 1.3 ? board : whole; if (s >= 2 && Math.floor(s) / s > 0.88) s = Math.floor(s);
      cv.style.width = `${Math.floor(384 * s)}px`; cv.style.height = `${Math.floor(216 * s)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(box);
    return () => ro.disconnect();
  }, [screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the run
  const meet = useCallback((run: Run) => {
    // Enzo introduces each kind of critter the first time it turns up, ever, then the board's twist
    const fresh = [...new Set(run.board.pieces.map((p) => p.k))].filter((k): k is Actor => G.isActor(k) && !saveRef.current.seen.includes(k));
    if (fresh.length) { persist({ ...saveRef.current, seen: [...saveRef.current.seen, ...fresh] }); say(G.CRITTERS[fresh[0]].line, fresh[0] === 'frog' || fresh[0] === 'grumble' || fresh[0] === 'beetle' ? 'warn' : ''); return; }
    if (run.board.mutator !== 'none') say(`This garden has a twist: ${G.MUTATORS[run.board.mutator].toLowerCase()}`, 'warn');
    else if (run.tier === 3) say('The Grumble King’s own bed! One last acorn, Dora.', 'warn');
  }, [persist, say]);

  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const run = new G.Run((Date.now() & 0xffffff) | 1);
    runRef.current = run; said.current.clear(); started.current = performance.now();
    setResult(null); setLine(null); setSel(-1); setGap(0); setScreen('play');
    if (!saveRef.current.intro) { introRef.current = 0; setIntro(0); sfx()?.enzo(INTRO[0]); }
    else meet(run);
    bump();
  }, [meet, setScreen]);

  const nextIntro = useCallback(() => {
    if (introRef.current < 0) return; sfx()?.button();
    const n = introRef.current + 1;
    if (n >= INTRO.length) { introRef.current = -1; setIntro(-1); persist({ ...saveRef.current, intro: true }); if (runRef.current) meet(runRef.current); return; }
    introRef.current = n; setIntro(n); sfx()?.enzo(INTRO[n]);
  }, [meet, persist]);

  const finish = useCallback(() => {
    const run = runRef.current; if (!run) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = s.best.board; G.bank(s, run); persist(s);
    const won = run.phase === 'won';
    setResult({ won, board: won ? G.BOARDS : run.ix + 1, boards: run.stats.boards, pars: run.stats.pars, swaps: run.stats.swaps, secs: Math.round((performance.now() - started.current) / 1000), best: s.best.board > before });
    sfx()?.stinger(won); setScreen('result');
  }, [persist, setScreen]);

  const onStep = useCallback((s: Step, i: number) => {
    const snd = sfx(); snd?.tock(i);
    switch (s.act.what) {
      case 'push': snd?.push(); break;
      case 'step': snd?.walk(); break;
      case 'turnback': snd?.turnback(); break;
      case 'eat': snd?.eat(); break;
      case 'grow': snd?.grow(); break;
      case 'boom': snd?.boom(); break;
      case 'turn': snd?.turn(); break;
      case 'wake': snd?.wake(); break;
      case 'dig': snd?.dig(); break;
      case 'grab': snd?.grab(); break;
      case 'skip': snd?.snore(); break;
      case 'pot': snd?.pot(); break;
    }
  }, []);

  const afterRound = useCallback((run: Run, evs: Ev[]) => {
    playingRef.current = false; setPlaying(false); shown.current = null; setSel(-1);
    for (const e of evs) {
      if (e.k === 'potted') { sceneRef.current?.celebrate(); say(run.phase === 'won' ? 'The Grumble King’s acorn, in the pot! Dora’s garden is saved!' : 'In the pot! Dora caught it!', 'good'); }
      if (e.k === 'par') say('In the pot, and quick about it! Have a token.', 'good');
      if (e.k === 'fail') { sfx()?.fail(); say(e.why ? FAIL[e.why] : 'Oh dear. Again!', 'warn'); }
      if (e.k === 'retry' && run.hp === 1) say('That’s our last try on this run. Watch the ghost carefully!', 'warn', 'last');
    }
    if (run.over) setTimeout(finish, 1600);
    bump();
  }, [finish, say]);

  const play = useCallback(() => {
    const run = runRef.current, sc = sceneRef.current;
    if (!run || !sc || run.phase !== 'plan' || playingRef.current || introRef.current >= 0) return;
    sfx()?.unlock(); sfx()?.button();
    const from = run.board, order = [...run.order];
    const { steps, events } = run.go();
    shown.current = from; playingRef.current = true; setPlaying(true); setLine(null);
    sc.play(from, order, steps, () => afterRound(run, events), onStep);
    bump();
  }, [afterRound, onStep]);

  // ---------------------------------------------------------------- planning
  const doSwap = useCallback((i: number) => {
    const run = runRef.current; if (!run || playingRef.current || introRef.current >= 0) return;
    sfx()?.unlock();
    if (run.swap(i)) { sfx()?.swap(); bump(); }
    else if (run.swapsLeft <= 0) say('Just one swap a round! Undo it to swap somewhere else.', '', 'one-swap');
  }, [say]);
  const undo = useCallback(() => { const run = runRef.current; if (!run || playingRef.current || run.phase !== 'plan') return; run.plan(); sfx()?.button(); bump(); }, []);
  const front = useCallback((id: number) => { const run = runRef.current; if (run && !playingRef.current && run.front(id)) { sfx()?.token(); bump(); } }, []);
  const nap = useCallback((id: number) => { const run = runRef.current; if (run && !playingRef.current && run.setNap(id)) { sfx()?.snore(); bump(); } }, []);
  const hint = useCallback(() => {
    const run = runRef.current; if (!run || playingRef.current || run.phase !== 'plan' || run.tokens <= 0) return;
    run.plan(); run.tokens--; run.stats.tokens++;
    const sol = G.solve(run.board);
    const first = sol.firsts[0];
    if (first === undefined) say('Hmm, I can’t see a way from here. Start the garden again?', 'warn');
    else if (first < 0) say('My ears say: leave the queue just as it is this round.', 'good');
    else {
      const a = run.board.pieces.find((p) => p.id === run.order[first]), b = run.board.pieces.find((p) => p.id === run.order[first + 1]);
      say(`My ears say: swap number ${first + 1} and number ${first + 2}${a && b ? `, the ${G.CRITTERS[a.k as Actor].name.toLowerCase()} and the ${G.CRITTERS[b.k as Actor].name.toLowerCase()}` : ''}.`, 'good');
      setGap(first);
    }
    sfx()?.token(); bump();
  }, [say]);
  const restart = useCallback(() => {
    const run = runRef.current; if (!run || playingRef.current || run.phase !== 'plan' || run.firstRound) return;
    run.hp--; run.stats.fails++;
    if (run.hp <= 0) { run.phase = 'lost'; finish(); return; }
    run.reset(); sfx()?.fail(); say('From the top, then.', ''); bump();
  }, [finish, say]);
  const pickPerk = useCallback((id?: PerkId) => {
    const run = runRef.current; if (!run || !run.pick(id)) return;
    sfx()?.pick(); setLine(null); setSel(-1); setGap(0); meet(run); bump();
  }, [meet]);

  // ---------------------------------------------------------------- keyboard and the board
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const run = runRef.current; if (!run) return;
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (run.phase === 'pick') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && run.offer[i]) pickPerk(run.offer[i]); return; }
      if (playingRef.current) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); sceneRef.current?.skip(); } return; }
      const n = run.order.length;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); setGap((g) => Math.max(0, g - 1)); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); setGap((g) => Math.min(n - 2, g + 1)); }
      else if (e.code === 'Space' || e.code === 'KeyS') { e.preventDefault(); doSwap(Math.min(gap, n - 2)); }
      else if (e.code === 'Enter' || e.code === 'KeyG') { e.preventDefault(); play(); }
      else if (e.code === 'KeyZ' || e.code === 'Backspace') undo();
      else if (e.code === 'KeyH') hint();
    };
    addEventListener('keydown', down); return () => removeEventListener('keydown', down);
  }, [doSwap, gap, hint, nextIntro, pickPerk, play, undo]);

  const onBoard = (e: React.PointerEvent) => {
    sfx()?.unlock();
    const run = runRef.current, sc = sceneRef.current, cv = canvasRef.current; if (!run || !sc || !cv) return;
    const c = cv.getBoundingClientRect(), t = sc.tileAt(((e.clientX - c.left) / c.width) * 384, ((e.clientY - c.top) / c.height) * 216);
    const p = t && run.board.pieces.find((q) => q.x === t.x && q.y === t.y && G.isActor(q.k));
    setSel(p ? (p.id === sel ? -1 : p.id) : -1);
  };

  // ---------------------------------------------------------------- the canvas loop
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      sfx()?.pump();
      const run = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !run || !sc) return;
      const board = shown.current ?? run.board;
      const pv = !playingRef.current && run.phase === 'plan' && introRef.current < 0 ? run.preview() : null;
      sc.render({ board, order: run.order, preview: pv, nap: run.nap, sel: selRef.current, reduced: reduced.current }, now / 1000, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const selRef = useRef(-1); selRef.current = sel;

  const setSetting = (k: 'sound' | 'music' | 'fast', v: boolean) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s);
    if (k === 'sound') sfx()?.setSound(v); else if (k === 'music') sfx()?.setMusic(v); else if (sceneRef.current) sceneRef.current.speed = v ? 2.2 : 1;
  };
  const giveUp = () => { const run = runRef.current; if (!run || playingRef.current) return; run.hp = 0; run.phase = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __order: () => unknown }).__order = () => {
      const run = runRef.current;
      return {
        screen: screenRef.current, intro: introRef.current, save: saveRef.current, result, line, playing: playingRef.current, sel,
        run: run && screenRef.current === 'play' ? { ix: run.ix, phase: run.phase, hp: run.hp, tokens: run.tokens, swapsLeft: run.swapsLeft, order: [...run.order], queue: [...run.board.queue], rounds: run.board.rounds, par: run.par, perks: { ...run.perks }, offer: [...run.offer], stats: { ...run.stats }, pieces: run.board.pieces.map((p) => ({ ...p })), pot: run.board.pot, mutator: run.board.mutator, potted: run.preview().board.potted } : null,
        debug: {
          // play the solver's choice for this round
          solve: () => { if (!run || run.phase !== 'plan') return; run.plan(); const f = G.solve(run.board).firsts[0]; if (f !== undefined && f >= 0) run.swap(f); bump(); },
          board: (ix: number) => { if (run) { run.enter(ix); bump(); } },
          hp: (v: number) => { if (run) { run.hp = v; bump(); } },
          tokens: (v: number) => { if (run) { run.tokens = v; bump(); } },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save;
  const pv = r && r.phase === 'plan' && !playing ? r.preview() : null;
  const selP = r?.board.pieces.find((p) => p.id === sel);
  const ord = r ? (playing ? [] : r.order) : [];
  const swappedAt = r && !playing ? r.order.findIndex((id, i) => r.board.queue[i] !== id) : -1;
  return <main className={`to-shell to-on-${screen}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <div className="to-play" hidden={screen !== 'play'}>
      {r && <header className="to-top">
        <div className="to-chip to-hearts" aria-label={`${r.hp} tries left`}>{Array.from({ length: r.hpMax }, (_, i) => <i key={i} className={i < r.hp ? 'on' : ''} />)}</div>
        <div className="to-chip to-tokens" title="Tokens: send a critter to the front, or ask Enzo for a hint"><b>{r.tokens}</b><span>tokens</span></div>
        <div className="to-chip to-where"><b>{G.PLACES[r.tier]}</b><span>Garden {r.ix + 1} of {G.BOARDS}</span></div>
        <div className="to-chip to-rounds" aria-label={`${r.board.rounds} rounds left`}><span>Rounds</span>{Array.from({ length: r.start.rounds }, (_, i) => <i key={i} className={i < r.board.rounds ? 'on' : ''} />)}<small>par {r.par}</small></div>
        <button className="to-menu" onClick={giveUp} disabled={playing} aria-label="End this run">✕</button>
      </header>}
      {r && <div className="to-queue" role="list" aria-label="The queue">
        {ord.map((id, i) => {
          const p = r.board.pieces.find((q) => q.id === id); if (!p) return null;
          const k = p.k as Actor;
          return <div key={id} className="to-slotwrap" role="listitem">
            {i > 0 && <button className={`to-swap${swappedAt === i - 1 ? ' done' : ''}${gap === i - 1 ? ' cursor' : ''}`} onClick={() => { setGap(i - 1); swappedAt === i - 1 ? undo() : doSwap(i - 1); }} disabled={r.swapsLeft <= 0 && swappedAt !== i - 1} aria-label={`Swap ${i} and ${i + 1}`}>⇄</button>}
            <button className={`to-slot k-${k}${sel === id ? ' sel' : ''}${r.nap === id ? ' nap' : ''}`} onClick={() => setSel(sel === id ? -1 : id)} aria-label={`${i + 1}: ${G.CRITTERS[k].name}`}>
              <img src={art(`q-${k}`)} alt="" /><b>{i + 1}</b>
            </button>
          </div>;
        })}
        {playing && <p className="to-playing">Playing the round… <button onClick={() => sceneRef.current?.skip()}>Skip ›</button></p>}
      </div>}
      <div className="to-box" ref={boxRef}>
        <canvas ref={canvasRef} className="to-canvas" aria-label="Turn Order: the garden board" onPointerDown={onBoard} />
      </div>
      {r && <footer className="to-bottom">
        {selP && G.isActor(selP.k) && !playing ? <div className="to-info">
          <img src={art(`q-${selP.k}`)} alt="" />
          <p><b>{G.CRITTERS[selP.k].name}</b> · number {r.order.indexOf(selP.id) + 1} · {G.CRITTERS[selP.k].verb}</p>
          {r.order.indexOf(selP.id) > 0 && <button onClick={() => front(selP.id)} disabled={r.tokens <= 0}>To the front · 1 token</button>}
          {r.perks.nap > 0 && <button onClick={() => nap(selP.id)} disabled={r.napUsed}>{r.nap === selP.id ? 'Wake' : 'Lullaby'}</button>}
        </div> : <p className="to-status">{playing ? ' ' : pv?.board.potted ? <>The ghost says: <b className="good">into the pot!</b></> : pv?.board.lost === 'rounds' ? <>The ghost says: <b className="bad">that’s the last round gone</b></> : pv?.board.lost ? <>The ghost says: <b className="bad">the acorn is lost!</b></> : <>{r.swapsLeft > 0 ? `${r.swapsLeft === 2 ? 'Two swaps' : 'One swap'} left this round.` : 'Swap made.'} {r.board.mutator !== 'none' && <em>{G.MUTATORS[r.board.mutator]}</em>}</>}</p>}
        <div className="to-actions">
          <button onClick={undo} disabled={playing || (swappedAt < 0 && !r.spent && r.nap < 0)}>Undo</button>
          <button onClick={hint} disabled={playing || r.tokens <= 0} title="Costs a token">Hint</button>
          <button onClick={restart} disabled={playing || r.firstRound}>Restart</button>
          <button className="to-go" onClick={play} disabled={playing || r.phase !== 'plan'}>Go! ›</button>
        </div>
      </footer>}
      {line && intro < 0 && r?.phase !== 'pick' && <div className={`to-line ${line.mood}`} key={line.key}><img src={art('enzo-portrait')} alt="" /><p><b>Enzo</b>{line.text}</p></div>}
      {intro >= 0 && <div className="to-overlay"><div className="to-card to-introcard" onClick={nextIntro} role="button" tabIndex={0}>
        <img src={art('enzo-portrait')} alt="Enzo" />
        <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · click, tap or Enter ›</small></div>
      </div></div>}
      {r?.phase === 'pick' && !playing && <div className="to-overlay"><div className="to-pick">
        <h2>In the pot!</h2>
        <p>Dora tucks the acorn in. Enzo has a few things in his satchel. Pick one:</p>
        <div className="to-offers">{r.offer.map((id, i) => { const k = G.PERKS.find((x) => x.id === id)!; return <button key={id} className="to-card to-offer" data-perk={id} onClick={() => pickPerk(id)}>
          <kbd>{i + 1}</kbd><b>{k.name}</b><span className="to-pips">{Array.from({ length: k.max }, (_, j) => <i key={j} className={j < r.perks[id] ? 'on' : j === r.perks[id] ? 'next' : ''} />)}</span><span>{k.text}</span>
        </button>; })}</div>
        {r.offer.length === 0 && <button className="to-go" onClick={() => pickPerk()}>On to the next garden ›</button>}
      </div></div>}
    </div>

    {screen === 'title' && <section className="to-title">
      <div className="to-bg"><img src={art('title')} alt="Enzo conducts a parade of garden critters from his podium while Dora catches a golden acorn in her basket" /></div>
      <div className="to-title-col">
        <h1 className="to-logo">Turn Order</h1>
        <p className="to-tag">You can’t move a single critter. You can only choose who goes first.</p>
        <div className="to-menu-col">
          <button className="to-go" onClick={startRun}>{s.stats.runs ? 'New run' : 'Start'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="to-small">Best: garden {Math.min(s.best.board, G.BOARDS)} of {G.BOARDS}{s.stats.wins ? ` · ${s.stats.wins} ${s.stats.wins === 1 ? 'win' : 'wins'}` : ''} · {s.stats.boards} acorns planted</p>}
        <a className="to-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`to-page to-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="to-bg"><img src={art('ending')} alt="Dora, Enzo and all the garden critters sit round a basket of golden acorns" /></div>}
      <div className="to-card to-resultcard">
        <h2>{result.won ? 'Every acorn planted!' : 'Out of tries'}</h2>
        <p>{result.won ? 'The Grumble King sulks off, the critters take a bow, and Dora’s pot of golden acorns is the talk of the garden.' : `Enzo puts his baton away for today. They got to garden ${result.board} of ${G.BOARDS}${result.best ? ', their best yet!' : '.'}`}</p>
        <ul className="to-stats">
          <li><b>{result.board}</b><span>garden</span></li><li><b>{result.boards}</b><span>planted</span></li><li><b>{result.pars}</b><span>under par</span></li><li><b>{result.swaps}</b><span>swaps</span></li><li><b>{Math.floor(result.secs / 60)}:{String(result.secs % 60).padStart(2, '0')}</b><span>time</span></li>
        </ul>
        <div className="to-row"><button className="to-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="to-page">
      <header className="to-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="to-cols">
        <div className="to-card"><h3>Conducting</h3><ul>
          <li>Get the <b>golden acorn</b> into Dora’s <b>pot</b> before the rounds run out.</li>
          <li>Every round, every critter does its one thing, in the order of the <b>queue</b>. Each wears its number on the board.</li>
          <li>You get <b>one swap</b> a round: tap ⇄ between two neighbours (or ← → and Space). Then <b>Go!</b> (or Enter).</li>
          <li>The <b>ghost</b> on the board shows what the round will do: dotted paths, red crosses on what won’t survive, and a gold square when the acorn will land.</li>
        </ul></div>
        <div className="to-card"><h3>Tokens and tries</h3><ul>
          <li>A <b>token</b> sends one critter to the front of the queue, or buys a hint from Enzo. Planting an acorn within par earns one.</li>
          <li>If the acorn is lost or the rounds run out, the garden starts again and you lose a <b>try</b>. Three tries a run.</li>
          <li>Some gardens have a <b>twist</b>: the queue turns back to front, or the first goes to the back, after every round.</li>
          <li>Eleven gardens, a pick from Enzo’s satchel after each one, and the Grumble King’s bed at the end.</li>
        </ul></div>
        <div className="to-card to-foes"><h3>The critters</h3>
          {G.ACTORS.map((k) => <div key={k} className="to-foe"><img src={art(k)} alt="" /><p><b>{G.CRITTERS[k].name}</b>{G.CRITTERS[k].verb}</p></div>)}
          <div className="to-foe"><img src={art('rock')} alt="" /><p><b>Rock</b>Does nothing, but a hedgehog can push it.</p></div>
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="to-page">
      <header className="to-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="to-card to-settings">
        {(['sound', 'music', 'fast'] as const).map((k) => <div key={k} className="to-set"><span>{k === 'fast' ? 'Fast rounds' : k === 'sound' ? 'Sound' : 'Music'}</span><span className="to-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings[k] === v ? 'on' : ''} onClick={() => setSetting(k, v)}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <p className="to-small">{s.stats.runs} runs · {s.stats.wins} wins · {s.stats.boards} acorns planted</p>
        <button className="to-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
