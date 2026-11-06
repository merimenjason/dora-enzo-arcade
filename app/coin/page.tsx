'use client';
// Coin of the Realm: the page. The town on a canvas, the day's orders and the bridge in the HUD, choosing whose paw the
// coin lands in next (click or tap a glowing townsfolk, or the keyboard), each hand-over played out, Enzo's pointers,
// the perk picker between towns, results and the save. Rules in lib/coin-game.ts, drawing in lib/coin-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/coin-game';
import type { Ev, Kind, PerkId, Run, Save } from '@/lib/coin-game';
import type { CoinScene, Snap } from '@/lib/coin-scene';
import { CoinSound, type SongId } from './sound';
import './coin.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; towns: number; planks: number; orders: number; passes: number; secs: number; best: boolean; town: string };

const art = (n: string) => `/art/coin/${n}.png`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const INTRO = [
  'We’re a coin! Dora’s on one face and I’m on the other. Every hour, whoever holds us spends us, and we get to choose whose paw we land in next.',
  'The town needs a bridge. Each day the board wants three goods: land with someone who sells one, and that order becomes a plank.',
  'Dora-side up, we can roll two streets. Enzo-side up, only next door, but I overhear how everyone near us is feeling. A cheery seller gives two planks; a grumpy one won’t sell.',
  'Build the bridge before the last day ends. And watch out for thieves, from harbour gulls to Grumbles: if one reaches the paw we’re in, we’re snatched till morning!',
];
const MEET: Partial<Record<Kind, string>> = {
  mayor: 'Every morning starts with the Mayor. Pay her once a day and she pins another order on the board.',
  pedlar: 'The Pedlar goes everywhere! From his paw, we can land anywhere in town.',
  gossip: 'The Gossip knows how everyone’s feeling. Land with her and I’ll hear the whole town.',
  miser: 'The Miser! He’ll give a plank from his sock of savings, once a day, but he keeps us two extra hours. Mind the thieves while we wait.',
  juggler: 'The Juggler spins us so we land both ways up: Dora’s reach and my ears at once.',
};

const snap = (r: Run): Snap => ({ holder: r.holder, face: r.face, thieves: [...r.thieves], known: [...r.known], moods: [...r.moods], paid: [...r.paid] });
/** the streets the coin rolls along to get there, avoiding thieves */
function route(r: Run, to: number): number[] {
  if (r.anywhere) return [];
  const prev = r.town.folk.map(() => -1), seen = new Set([r.holder]), q = [r.holder];
  for (let i = 0; i < q.length; i++) for (const n of r.town.adj[q[i]]) if (!seen.has(n) && !r.thieves.includes(n)) { seen.add(n); prev[n] = q[i]; q.push(n); }
  const out = [to]; while (prev[out[0]] >= 0) out.unshift(prev[out[0]]);
  return out[0] === r.holder ? out : [];
}
const dangerOf = (r: Run, id: number) => r.danger(id, r.town.folk[id].kind === 'miser' && !r.miserUsed ? 3 : 1);

export default function CoinOfTheRealmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CoinScene | null>(null);
  const soundRef = useRef<CoinSound | null>(null);
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
  const selRef = useRef(-1); selRef.current = sel;
  const hoverRef = useRef(-1);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
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
    soundRef.current = new CoinSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/coin-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.CoinScene(canvasRef.current); sc.speed = s.settings.fast ? 2.2 : 1; sceneRef.current = sc;
      void sc.load(); setReady(true);
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, []);

  const r = runRef.current;
  useEffect(() => {
    const song: SongId | null = screen === 'play' ? (r && r.ix === G.TOWNS.length - 1 ? 'hollow' : 'market') : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song);
  });

  // fit the town into the space it has; on a narrow screen, zoom in on the townsfolk and let the edges go
  useEffect(() => {
    const box = boxRef.current, cv = canvasRef.current; if (!box || !cv) return;
    const fit = () => {
      const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
      const whole = Math.min(w / 384, h / 216), folk = Math.min(w / 330, h / 200);
      let s = folk > whole * 1.08 ? folk : whole; if (s >= 2 && Math.floor(s) / s > 0.88) s = Math.floor(s);
      cv.style.width = `${Math.floor(384 * s)}px`; cv.style.height = `${Math.floor(216 * s)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(box);
    return () => ro.disconnect();
  }, [screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the run
  const meet = useCallback((run: Run) => {
    // Enzo introduces each special townsfolk the first time they turn up, ever, then each town's thieves
    const fresh = [...new Set(run.town.folk.map((f) => f.kind))].filter((k) => MEET[k] && !saveRef.current.seen.includes(k));
    const thief = run.town.dens.length > 0 && !saveRef.current.seen.includes(run.town.thief) ? run.town.thief : null;
    if (fresh.length || thief) persist({ ...saveRef.current, seen: [...saveRef.current.seen, ...fresh, ...(thief ? [thief] : [])] });
    if (thief) { say(G.THIEVES[thief].meet, 'warn'); return; }
    if (fresh.length) { say(MEET[fresh[0]]!); return; }
    if (run.ix === G.TOWNS.length - 1) say('Grumble Hollow. Two Grumbles, and the last bridge home. Let’s be quick, Dora!', 'warn');
    else say(`${run.town.name}! ${run.goal} planks for the bridge, ${run.days} days to do it.`);
  }, [persist, say]);

  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const run = new G.Run((Date.now() & 0xffffff) | 1);
    runRef.current = run; said.current.clear(); started.current = performance.now();
    sceneRef.current?.setTown(run.town, snap(run));
    setResult(null); setLine(null); setSel(-1); setScreen('play');
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
    const before = s.best.towns; G.bank(s, run); persist(s);
    const won = run.phase === 'won';
    setResult({ won, towns: run.stats.towns, planks: run.stats.planks, orders: run.stats.orders, passes: run.stats.passes, secs: Math.round((performance.now() - started.current) / 1000), best: s.best.towns > before, town: run.town.name });
    sfx()?.stinger(won); setScreen('result');
  }, [persist, setScreen]);

  const onEv = useCallback((e: Ev) => {
    const snd = sfx();
    switch (e.k) {
      case 'pass': { const run = runRef.current; snd?.pass(!!run && G.dist(run.town.adj, e.from)[e.to] > 1); break; }
      case 'wait': snd?.wait(); break;
      case 'flip': snd?.flip(); break;
      case 'order': snd?.order(); break;
      case 'grumpy': snd?.grumpy(); break;
      case 'mayor': snd?.mayor(); break;
      case 'miser': snd?.miser(); break;
      case 'gossip': snd?.gossip(); break;
      case 'pedlar': snd?.pedlar(); break;
      case 'juggler': snd?.juggler(); break;
      case 'hear': if (e.ids.length) snd?.hear(); break;
      case 'thief': snd?.thief(); break;
      case 'snatch': snd?.snatch(); break;
      case 'dusk': snd?.dusk(); break;
      case 'dawn': snd?.dawn(); break;
      case 'bridge': snd?.bridge(); break;
    }
  }, []);

  const after = useCallback((run: Run, evs: Ev[]) => {
    playingRef.current = false; setPlaying(false); setSel(-1);
    for (const e of evs) {
      if (e.k === 'grumpy') say('Grumpy today: no sale. That order’s still open.', 'warn', 'grumpy');
      if (e.k === 'order' && e.planks > 1) say('A cheery seller: two planks for one order!', 'good', 'cheery');
      if (e.k === 'snatch') say(G.THIEVES[run.town.thief].snatch, 'warn');
      if (e.k === 'dawn') say(e.day + 1 === run.days ? `Last day, Dora! ${run.goal - run.planks} more plank${run.goal - run.planks === 1 ? '' : 's'} to go.` : `Morning! Day ${e.day + 1}, and a fresh order board.`, e.day + 1 === run.days ? 'warn' : '');
      if (e.k === 'bridge') { sceneRef.current?.celebrate(); say(run.phase === 'won' ? 'The last bridge! We’re going home, Dora!' : `The ${run.town.name} bridge is built! Over the river we go.`, 'good'); }
      if (e.k === 'lost') say('Out of days, and the bridge isn’t done. Oh no, they’re melting us down for nails!', 'warn');
    }
    if (run.over) setTimeout(finish, 1800);
    bump();
  }, [finish, say]);

  const run_ = useCallback((evs: Ev[]) => {
    const run = runRef.current, sc = sceneRef.current; if (!run || !sc) return;
    if (!evs.length) return;
    playingRef.current = true; setPlaying(true);
    if (!evs.some((e) => e.k === 'bridge' || e.k === 'snatch')) setLine(null);
    sc.play(evs, snap(run), () => after(run, evs), onEv);
    bump();
  }, [after, onEv]);

  const spend = useCallback((id: number) => {
    const run = runRef.current; if (!run || playingRef.current || run.phase !== 'play' || introRef.current >= 0) return;
    sfx()?.unlock(); run_(run.pass(id));
  }, [run_]);
  const wait = useCallback(() => {
    const run = runRef.current; if (!run || playingRef.current || run.phase !== 'play' || introRef.current >= 0) return;
    sfx()?.unlock(); run_(run.wait());
  }, [run_]);
  const flip = useCallback(() => {
    const run = runRef.current; if (!run || playingRef.current || introRef.current >= 0) return;
    sfx()?.unlock(); run_(run.flip());
  }, [run_]);
  const pickPerk = useCallback((id?: PerkId) => {
    const run = runRef.current; if (!run || !run.pick(id)) return;
    sfx()?.pick(); setLine(null); setSel(-1);
    sceneRef.current?.setTown(run.town, snap(run)); meet(run); bump();
  }, [meet]);

  // ---------------------------------------------------------------- keyboard and the town
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const run = runRef.current; if (!run) return;
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (run.phase === 'pick') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && run.offer[i]) pickPerk(run.offer[i]); return; }
      if (playingRef.current) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); sceneRef.current?.skip(); } return; }
      if (run.phase !== 'play') return;
      // ← and → step through whoever can be paid, left to right
      const ts = run.targets().sort((a, b) => run.town.folk[a].x - run.town.folk[b].x || run.town.folk[a].y - run.town.folk[b].y);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault(); if (!ts.length) return;
        const i = ts.indexOf(selRef.current), back = e.code === 'ArrowLeft' || e.code === 'KeyA';
        setSel(ts[i < 0 ? (back ? ts.length - 1 : 0) : (i + (back ? ts.length - 1 : 1)) % ts.length]);
      } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (ts.includes(selRef.current)) spend(selRef.current); }
      else if (e.code === 'KeyW') wait();
      else if (e.code === 'KeyF') flip();
    };
    addEventListener('keydown', down); return () => removeEventListener('keydown', down);
  }, [flip, nextIntro, pickPerk, spend, wait]);

  const canvasPoint = (e: React.PointerEvent) => {
    const cv = canvasRef.current!, c = cv.getBoundingClientRect();
    return sceneRef.current?.folkAt(((e.clientX - c.left) / c.width) * 384, ((e.clientY - c.top) / c.height) * 216) ?? -1;
  };
  const onDown = (e: React.PointerEvent) => {
    sfx()?.unlock();
    const run = runRef.current; if (!run || playingRef.current || introRef.current >= 0) return;
    const id = canvasPoint(e);
    // a mouse spends at once; a finger picks first, then taps again (or Spend) to spend
    if (id >= 0 && run.targets().includes(id) && (e.pointerType === 'mouse' || id === selRef.current)) { spend(id); return; }
    setSel(id === selRef.current ? -1 : id);
  };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') hoverRef.current = canvasPoint(e); };

  // ---------------------------------------------------------------- the canvas loop
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      sfx()?.pump();
      const run = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !run || !sc) return;
      const live = run.phase === 'play' && !playingRef.current && introRef.current < 0;
      const targets = live ? run.targets() : [];
      const focus = targets.includes(hoverRef.current) ? hoverRef.current : selRef.current;
      sc.sync(snap(run));
      sc.render({ targets, danger: targets.filter((id) => dangerOf(run, id)), hover: focus, path: targets.includes(focus) ? route(run, focus) : [], reduced: reduced.current }, now / 1000, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setSetting = (k: 'sound' | 'music' | 'fast', v: boolean) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s);
    if (k === 'sound') sfx()?.setSound(v); else if (k === 'music') sfx()?.setMusic(v); else if (sceneRef.current) sceneRef.current.speed = v ? 2.2 : 1;
  };
  const giveUp = () => { const run = runRef.current; if (!run || playingRef.current) return; run.phase = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __coin: () => unknown }).__coin = () => {
      const run = runRef.current;
      return {
        screen: screenRef.current, intro: introRef.current, save: saveRef.current, result, line, playing: playingRef.current, sel,
        run: run && screenRef.current === 'play' ? {
          ix: run.ix, thief: run.town.thief, phase: run.phase, day: run.day, days: run.days, hour: run.hour, hours: run.hours, holder: run.holder, face: run.face, planks: run.planks, goal: run.goal,
          orders: run.orders.map((o) => ({ ...o })), targets: run.targets(), thieves: [...run.thieves], known: [...run.known], perks: { ...run.perks }, offer: [...run.offer], stats: { ...run.stats },
          folk: run.town.folk.map((f) => ({ id: f.id, kind: f.kind, x: f.x, y: f.y })),
        } : null,
        debug: {
          planks: (n: number) => { if (run) { run.planks = n; bump(); } },
          town: (ix: number) => { if (run) { run.enter(ix); sceneRef.current?.setTown(run.town, snap(run)); bump(); } },
          lastDay: () => { if (run) { run.day = run.days - 1; bump(); } },
          /** a seller on the order board the coin can reach right now, or -1 */
          seller: () => run ? run.targets().find((id) => { const k = run.town.folk[id].kind; return G.isTrade(k) && run.orders.some((o) => !o.done && o.good === G.SELLS[k]) && run.moods[id] !== 'grumpy'; }) ?? -1 : -1,
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save;
  const live = !!r && r.phase === 'play' && !playing;
  const targets = live ? r.targets() : [];
  const selF = r && sel >= 0 ? r.town.folk[sel] : null;
  const faceText = !r ? '' : r.face === 'both' ? 'Both ways up: two streets, and Enzo’s listening' : r.face === 'dora' ? `Dora-side up: rolls ${r.reachOf()} streets` : 'Enzo-side up: next door only, ears open';
  const mood = (id: number) => !r || !G.isTrade(r.town.folk[id].kind) ? '' : r.known[id] ? G.MOODS[r.moods[id]] : 'Mood unheard: land Enzo-side up nearby, or visit the Gossip.';
  return <main className={`cr-shell cr-on-${screen}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <div className="cr-play" hidden={screen !== 'play'}>
      {r && <header className="cr-top">
        <div className="cr-chip cr-day" aria-label={`Day ${r.day + 1} of ${r.days}, hour ${r.hour} of ${r.hours}`}><b>Day {r.day + 1}</b><span>of {r.days}</span>{Array.from({ length: r.hours }, (_, i) => <i key={i} className={i < r.hour ? 'gone' : ''} />)}</div>
        <div className="cr-chip cr-where"><b>{r.town.name}</b><span>Town {r.ix + 1} of {G.TOWNS.length}</span></div>
        <div className="cr-chip cr-bridge" aria-label={`Bridge: ${r.planks} of ${r.goal} planks`}><img src={art('planks')} alt="" /><span className="cr-planks">{Array.from({ length: r.goal }, (_, i) => <i key={i} className={i < r.planks ? 'on' : ''} />)}</span><b>{Math.min(r.planks, r.goal)}/{r.goal}</b></div>
        <button className="cr-menu" onClick={giveUp} disabled={playing} aria-label="End this run">✕</button>
      </header>}
      {r && <div className="cr-orders">
        <div className={`cr-face f-${r.face}`} title={faceText}><img src={art(r.face === 'enzo' ? 'hud-enzo' : 'hud-dora')} alt="" /><span>{faceText}</span></div>
        <div className="cr-board" role="list" aria-label="Today’s orders"><small>Today’s orders</small>
          {r.orders.map((o, i) => <span key={i} role="listitem" className={`cr-order${o.done ? ' done' : ''}`} title={G.GOOD_NAMES[o.good]}><img src={art(`big-${o.good}`)} alt="" /><em>{G.GOOD_NAMES[o.good]}</em></span>)}
        </div>
      </div>}
      <div className="cr-box" ref={boxRef}>
        <canvas ref={canvasRef} className="cr-canvas" aria-label="Coin of the Realm: the town" onPointerDown={onDown} onPointerMove={onMove} onPointerLeave={() => (hoverRef.current = -1)} />
      </div>
      {r && <footer className="cr-bottom">
        {playing ? <p className="cr-status">… <button onClick={() => sceneRef.current?.skip()}>Skip ›</button></p>
          : selF ? <div className="cr-info">
            <img src={art(selF.kind)} alt="" />
            <p><b>{G.FOLK[selF.kind].name}</b> ({G.FOLK[selF.kind].who}) · {G.FOLK[selF.kind].text} {mood(selF.id)}{targets.includes(selF.id) && dangerOf(r, selF.id) && <em className="bad"> {cap(G.THIEVES[r.town.thief].one)} could snatch the coin there!</em>}{!targets.includes(selF.id) && selF.id !== r.holder && <em> Out of reach this hour.</em>}{selF.id === r.holder && <em> The coin is here.</em>}</p>
            {targets.includes(selF.id) && <button className="cr-go" onClick={() => spend(selF.id)}>Spend here ›</button>}
          </div>
          : <p className="cr-status">{r.phase !== 'play' ? ' ' : targets.length ? <>Choose a <b className="good">glowing</b> townsfolk to spend the coin on. <span className="cr-small">Hour {r.hour + 1} of {r.hours}</span></> : <>Nowhere to go: wait an hour.</>}</p>}
        <div className="cr-actions">
          {r.perks.lucky > 0 && <button onClick={flip} disabled={!live || r.flips >= r.flipsMax || r.face === 'both'} title="Lucky toss: turn the coin over">Flip ({r.flipsMax - r.flips})</button>}
          <button onClick={wait} disabled={!live}>Wait an hour</button>
        </div>
      </footer>}
      {line && intro < 0 && r?.phase !== 'pick' && <div className={`cr-line ${line.mood}`} key={line.key}><img src={art('enzo-portrait')} alt="" /><p><b>Enzo</b>{line.text}</p></div>}
      {intro >= 0 && <div className="cr-overlay"><div className="cr-card cr-introcard" onClick={nextIntro} role="button" tabIndex={0}>
        <img src={art('enzo-portrait')} alt="Enzo" />
        <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · click, tap or Enter ›</small></div>
      </div></div>}
      {r?.phase === 'pick' && !playing && <div className="cr-overlay"><div className="cr-pick">
        <h2>Bridge built!</h2>
        <p>The coin rolls over the new bridge to the next town. Dora checks her pockets. Pick one:</p>
        <div className="cr-offers">{r.offer.map((id, i) => { const k = G.PERKS.find((x) => x.id === id)!; return <button key={id} className="cr-card cr-offer" data-perk={id} onClick={() => pickPerk(id)}>
          <kbd>{i + 1}</kbd><b>{k.name}</b><span className="cr-pips">{Array.from({ length: k.max }, (_, j) => <i key={j} className={j < r.perks[id] ? 'on' : j === r.perks[id] ? 'next' : ''} />)}</span><span>{k.text}</span>
        </button>; })}</div>
        {r.offer.length === 0 && <button className="cr-go" onClick={() => pickPerk()}>On to the next town ›</button>}
      </div></div>}
    </div>

    {screen === 'title' && <section className="cr-title">
      <div className="cr-bg"><img src={art('title')} alt="A gold coin spins over a market square while Dora cheers and Enzo listens, with townsfolk all round" /></div>
      <div className="cr-title-col">
        <h1 className="cr-logo">Coin of the Realm</h1>
        <p className="cr-tag">You’re a coin. All you choose is whose paw you land in next.</p>
        <div className="cr-menu-col">
          <button className="cr-go" onClick={startRun}>{s.stats.runs ? 'New run' : 'Start'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="cr-small">Best: {s.best.towns} of {G.TOWNS.length} bridges{s.stats.wins ? ` · ${s.stats.wins} ${s.stats.wins === 1 ? 'win' : 'wins'}` : ''} · {s.stats.planks} planks laid</p>}
        <a className="cr-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`cr-page cr-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="cr-bg"><img src={art('ending')} alt="Dora and Enzo sit on a finished bridge strung with lanterns, holding up the gold coin" /></div>}
      <div className="cr-card cr-resultcard">
        <h2>{result.won ? 'Every bridge built!' : 'Melted down'}</h2>
        <p>{result.won ? 'Four towns, four bridges, one lucky coin. Dora keeps it in her pocket for good, and Enzo says he can still hear it jingle.' : `${result.town} ran out of days before its bridge was done, and the coin went into the smith’s pot for nails. ${result.towns} bridge${result.towns === 1 ? '' : 's'} built${result.best ? ', their best yet!' : '.'}`}</p>
        <ul className="cr-stats">
          <li><b>{result.towns}</b><span>bridges</span></li><li><b>{result.planks}</b><span>planks</span></li><li><b>{result.orders}</b><span>orders</span></li><li><b>{result.passes}</b><span>hand-overs</span></li><li><b>{Math.floor(result.secs / 60)}:{String(result.secs % 60).padStart(2, '0')}</b><span>time</span></li>
        </ul>
        <div className="cr-row"><button className="cr-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="cr-page">
      <header className="cr-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="cr-cols">
        <div className="cr-card"><h3>Being a coin</h3><ul>
          <li>Every hour, whoever holds the coin spends it. You choose who on: click a <b>glowing</b> townsfolk (on a phone, tap them, then tap again or press Spend). Keyboard: ← → to choose, Enter to spend, W to wait an hour.</li>
          <li><b>Dora-side up</b>, the coin can roll two streets. <b>Enzo-side up</b>, only next door, but Enzo overhears the mood of everyone two streets round. The coin turns over every hand-over.</li>
          <li>Each day starts in the <b>Mayor’s</b> paw, Dora-side up, with eight hours.</li>
        </ul></div>
        <div className="cr-card"><h3>The bridge</h3><ul>
          <li>The board wants three <b>goods</b> a day. Land with a seller of one and the order becomes a <b>plank</b>. A <b>cheery</b> seller gives two; a <b>grumpy</b> one won’t sell.</li>
          <li>Sellers you visited yesterday are more likely to be cheery; ones you left out, grumpy.</li>
          <li>Build the bridge before the last day ends, or the coin is melted down for nails. Four towns, a pick from Dora’s pockets after each.</li>
          <li><b>Thieves</b> (herring gulls at the harbour, magpies on Russet Hill, Grumbles in Grumble Hollow) creep one street nearer every hour. If one reaches the coin, it’s snatched till morning. A <b>red ring</b> means a thief would get there next.</li>
        </ul></div>
        <div className="cr-card cr-foes"><h3>The townsfolk</h3>
          {(['mayor', 'pedlar', 'gossip', 'juggler', 'miser', ...G.TRADES] as Kind[]).map((k) => <div key={k} className="cr-foe"><img src={art(k)} alt="" /><p><b>{G.FOLK[k].name}</b>{G.FOLK[k].text}</p></div>)}
          {(Object.keys(G.THIEVES) as G.Thief[]).map((k) => <div key={k} className="cr-foe"><img src={art(k)} alt="" /><p><b>{G.THIEVES[k].name}</b>{G.THIEVES[k].text}</p></div>)}
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="cr-page">
      <header className="cr-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="cr-card cr-settings">
        {(['sound', 'music', 'fast'] as const).map((k) => <div key={k} className="cr-set"><span>{k === 'fast' ? 'Fast hand-overs' : k === 'sound' ? 'Sound' : 'Music'}</span><span className="cr-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings[k] === v ? 'on' : ''} onClick={() => setSetting(k, v)}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <p className="cr-small">{s.stats.runs} runs · {s.stats.wins} wins · {s.stats.planks} planks laid</p>
        <button className="cr-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
