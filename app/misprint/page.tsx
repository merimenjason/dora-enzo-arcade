'use client';
// Misprint: the page. The title poster, the zine shelf (three covers), the contact sheet of a zine's ten pages
// (thumbnails printed from the real page data), a page in play with its caption in the margin and the control pad
// beside it (so no words ever sit over a face), the page-done stamp, and the reward print for a finished zine.
// Input: the keyboard (arrows or A/D walk, W/S or up/down climb ladders, Tab or Q switch, Shift with an arrow or WASD
// shifts the active plate, Z undo, R restart, H hint), the on-screen pad, and a tap on the other chinchilla to switch.
// Rules in lib/misprint-game.ts, drawing in lib/misprint-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/misprint-game';
import type { MisprintScene } from '@/lib/misprint-scene';
import { MisprintSound } from './sound';
import './misprint.css';

type Screen = 'title' | 'howto' | 'shelf' | 'pages' | 'play' | 'reward' | 'settings';
type Done = { moves: number; par: number; drop: boolean; hasDrop: boolean; stars: [boolean, boolean, boolean]; first: boolean; zineNow: boolean; next: string | null };
const ART = '/art/misprint/';
const INKNAME = ['pink', 'teal'] as const;
const ACTION_TEXT: Record<G.Action, string> = { L: 'walk left', R: 'walk right', U: 'climb up', D: 'climb down', Q: 'switch', sU: 'shift the plate up', sD: 'shift the plate down', sL: 'shift the plate left', sR: 'shift the plate right' };

export default function MisprintPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MisprintScene | null>(null);
  const soundRef = useRef<MisprintSound | null>(null);
  const gameRef = useRef<G.Game | null>(null);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const backRef = useRef<Screen>('title');
  const [save, setSave] = useState<G.Save>(G.newSave);
  const saveRef = useRef<G.Save>(save);
  const [ready, setReady] = useState(false);
  const [zine, setZine] = useState(0);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const [hintA, setHintA] = useState<G.Action | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [rewardZine, setRewardZine] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const queue = useRef<G.Action[]>([]);
  const doneAt = useRef(0);

  const sfx = () => soundRef.current;
  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: G.Save) => { saveRef.current = s; setSave({ ...s, pages: { ...s.pages }, settings: { ...s.settings } }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const say = (text: string) => setMsg({ text, key: Math.random() });
  const go = (s: Screen) => {
    sfx()?.unlock(); sfx()?.button();
    if (s === 'settings' || s === 'howto') backRef.current = screenRef.current === 'settings' || screenRef.current === 'howto' ? backRef.current : screenRef.current;
    setScreen(s);
  };

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    soundRef.current = new MisprintSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/misprint-scene').then((mod) => {
      if (gone || !canvasRef.current) return;
      const sc = new mod.MisprintScene(canvasRef.current); sceneRef.current = sc;
      sc.reduced = !s.settings.motion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      fit();
      void sc.load().then(() => {
        if (gone) return;
        const t: Record<string, string> = {};
        for (const p of G.PAGES) t[p.id] = sc.thumb(G.page(p.id), 168);
        setThumbs(t); setReady(true);
      }).catch(() => { if (!gone) setReady(true); });
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); sceneRef.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fit = () => {
    const c = canvasRef.current, sc = sceneRef.current; if (!c || !sc) return;
    const r = c.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    sc.resize(r.width, r.height);
  };
  useEffect(() => {
    const c = canvasRef.current; if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit()); ro.observe(c); return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the draw loop: every frame while something moves, a gentle 30 a second otherwise
  useEffect(() => {
    let raf = 0, last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const sc = sceneRef.current; if (!sc || screenRef.current !== 'play') return;
      if (!sc.busy(now) && now - last < 32) return;
      last = now; sc.frame(now);
      if (!sc.busy(now) && queue.current.length) act(queue.current.shift()!);
      if (doneAt.current && now > doneAt.current) { doneAt.current = 0; finish(); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- pages
  const openPage = useCallback((id: string) => {
    sfx()?.unlock();
    const g = new G.Game(id); gameRef.current = g;
    setZine(g.pg.zine); setDone(null); setHintA(null); setMsg(null); queue.current = []; doneAt.current = 0;
    sceneRef.current?.setPage(g.pg, g.st); sceneRef.current?.setHint(null);
    setScreen('play'); setTick((t) => t + 1);
    requestAnimationFrame(() => { fit(); sceneRef.current?.frame(performance.now()); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setScreen]);

  const refuseText = (r: G.Refusal, a: G.Action, who: G.Who) => {
    const name = G.NAMES[who], ink = INKNAME[who];
    if (r === 'edge') return `The ${ink} plate is at the edge: its ink (registration marks too) can’t leave the paper.`;
    if (r === 'fall') return `${name} would fall off the page. Not that way!`;
    if (r === 'embed') return 'That would print ink right on top of someone.';
    if (r === 'nothing') return a === 'U' || a === 'D' ? `No ${ink} ladder for ${name} to climb here.` : 'Nothing happens.';
    if (a[0] === 's') return `${name} would bump into something solid, so the ${ink} plate won’t move.`;
    return `${name} can’t go that way: it’s solid, or more than one step high.`;
  };

  /** one action from a key or a button */
  const act = (a: G.Action) => {
    const g = gameRef.current, sc = sceneRef.current; if (!g || screenRef.current !== 'play' || g.done) return;
    const now = performance.now();
    if (sc?.busy(now)) { if (queue.current.length < 2) queue.current.push(a); return; }
    sfx()?.unlock();
    const from = g.st, who = from.active;
    const r = g.do(a);
    if (!r.ok) { sfx()?.refuse(); sc?.refuse(who, a, now); say(refuseText(r.reason, a, who)); setTick((t) => t + 1); return; }
    setMsg(null); setHintA(null); sc?.setHint(null);
    sc?.play(from, r, a, now);
    const s = sfx();
    if (r.kind === 'switch') s?.switchTo(r.state.active);
    else if (r.kind === 'shift') s?.slide();
    else if (r.kind === 'climb') s?.climb();
    else s?.stepSound();
    if (r.paths.some((p) => p.length > 2) && r.kind !== 'climb') setTimeout(() => sfx()?.land(), 200);
    if (r.dropNow) setTimeout(() => sfx()?.drop(), 120);
    if (g.done) doneAt.current = now + (sc ? Math.max(350, Math.min(1200, 300 + 120 * Math.max(r.paths[0].length, r.paths[1].length))) : 0);
    setTick((t) => t + 1);
  };

  const finish = () => {
    const g = gameRef.current; if (!g || !g.done) return;
    const s = saveRef.current, z = g.pg.zine, wasDone = G.zineDone(s, z);
    const rec = G.record(s, g.pg.id, g.moves, g.dropEver, g.hints);
    persist(s);
    sceneRef.current?.celebrate(performance.now());
    const zineNow = !wasDone && G.zineDone(s, z) && !s.ended.includes(z);
    if (zineNow) { s.ended.push(z); persist(s); sfx()?.zine(); } else sfx()?.stamp();
    setDone({ moves: g.moves, par: g.pg.def.par, drop: g.dropEver, hasDrop: g.pg.drop >= 0, stars: [true, g.moves <= g.pg.def.par, g.dropEver], first: rec.first, zineNow, next: G.nextPage(g.pg.id) });
  };

  const undo = () => {
    const g = gameRef.current; if (!g || screenRef.current !== 'play') return; sfx()?.unlock();
    queue.current = []; doneAt.current = 0;
    if (!g.undo()) { say('Nothing to undo yet.'); return; }
    sfx()?.undo(); sceneRef.current?.show(g.st); setDone(null); setHintA(null); sceneRef.current?.setHint(null); setMsg(null); setTick((t) => t + 1);
  };
  const restart = () => {
    const g = gameRef.current; if (!g || screenRef.current !== 'play') return; sfx()?.unlock();
    queue.current = []; doneAt.current = 0;
    if (!g.restart()) { say('Already at the start of the page.'); return; }
    sfx()?.undo(); sceneRef.current?.show(g.st); setDone(null); setHintA(null); sceneRef.current?.setHint(null); say('Back to the start. Undo brings your moves back.'); setTick((t) => t + 1);
  };
  const hint = () => {
    const g = gameRef.current; if (!g || screenRef.current !== 'play' || g.done) return; sfx()?.unlock();
    const a = g.hint(); setTick((t) => t + 1);
    if (!a) { say('No way to the staple from here. Try Undo or Restart.'); return; }
    sfx()?.hint(); setHintA(a); sceneRef.current?.setHint(a);
    const who = G.NAMES[g.st.active];
    say(a === 'Q' ? `Hint: switch to ${G.NAMES[1 - g.st.active]}.` : `Hint: ${who}, ${ACTION_TEXT[a]}.`);
  };

  // ---------------------------------------------------------------- the keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (screenRef.current !== 'play') { if (e.key === 'Escape' && (screenRef.current === 'settings' || screenRef.current === 'howto')) setScreen(backRef.current); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = ({ ArrowLeft: 'L', a: 'L', ArrowRight: 'R', d: 'R', ArrowUp: 'U', w: 'U', ArrowDown: 'D', s: 'D' } as Record<string, 'L' | 'R' | 'U' | 'D'>)[k];
      if (dir) { e.preventDefault(); act(e.shiftKey ? (`s${dir}` as G.Action) : dir); return; }
      if (k === 'Tab' || k === 'q') { e.preventDefault(); act('Q'); return; }
      if (k === 'z') { e.preventDefault(); undo(); return; }
      if (k === 'r') { e.preventDefault(); restart(); return; }
      if (k === 'h') { e.preventDefault(); hint(); return; }
      if (k === 'Enter' && gameRef.current?.done && done?.next) { e.preventDefault(); openPage(done.next); return; }
      if (k === 'Escape') { e.preventDefault(); setScreen('pages'); }
    };
    addEventListener('keydown', down); return () => removeEventListener('keydown', down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // a tap on the other chinchilla switches to them
  const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current, sc = sceneRef.current; if (!g || !sc || g.done) return;
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const o = g.st.pos[1 - g.st.active], c = sc.cellRect(o[0], o[1]);
    if (x >= c.x - c.size * 0.2 && x <= c.x + c.size * 1.2 && y >= c.y - c.size * 0.5 && y <= c.y + c.size * 1.1) act('Q');
  };

  // ---------------------------------------------------------------- settings
  const setSetting = (k: keyof G.Settings, v: boolean) => {
    const s = saveRef.current; s.settings[k] = v; persist(s);
    if (k === 'sound') sfx()?.setSound(v);
    if (k === 'music') sfx()?.setMusic(v);
    if (k === 'motion' && sceneRef.current) sceneRef.current.reduced = !v;
    sfx()?.unlock(); sfx()?.button();
  };

  const muted = !save.settings.sound && !save.settings.music;
  const toggleMute = () => {
    const s = saveRef.current, on = !s.settings.sound && !s.settings.music;
    s.settings.sound = on; s.settings.music = on; persist(s); sfx()?.setSound(on); sfx()?.setMusic(on);
    sfx()?.unlock(); if (on) sfx()?.button();
  };

  // ---------------------------------------------------------------- the debug hook for the browser tests
  useEffect(() => {
    (window as unknown as { __misprint: () => unknown }).__misprint = () => {
      const g = gameRef.current;
      return {
        screen: screenRef.current, save: saveRef.current, ready, zine,
        page: g && { id: g.pg.id, zine: g.pg.zine, w: g.pg.w, h: g.pg.h, par: g.pg.def.par, moves: g.moves, hints: g.hints, done: g.done, drop: g.dropEver, history: g.history.length,
          state: { pos: g.st.pos.map((p) => [...p]), off: g.st.off.map((p) => [...p]), active: g.st.active, drop: g.st.drop } },
        busy: !!sceneRef.current?.busy(performance.now()) || queue.current.length > 0 || doneAt.current > 0,
        done, hint: hintA, message: msg?.text ?? '', sound: soundRef.current?.unlocked ?? false,
        debug: {
          open: (id: string) => openPage(id),
          act: (a: G.Action) => act(a),
          solve: () => { const gg = gameRef.current; if (!gg) return null; const s = G.solve(gg.pg, gg.st); return s ? s.actions : null; },
          cell: (x: number, y: number) => sceneRef.current?.cellRect(x, y) ?? null,
          pages: () => G.PAGES.map((p) => p.id),
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const g = gameRef.current;
  const st = g?.st;
  const active: G.Who = st?.active ?? 0;
  const zineStars = (z: number) => G.starCount(save, G.zinePages(z).map((p) => p.id));
  const starRow = (s: [boolean, boolean, boolean], big = false) => (
    <span className={`mp-stars${big ? ' mp-stars-big' : ''}`} aria-label={`${s.filter(Boolean).length} of 3 stars`}>
      {s.map((on, i) => <span key={i} className={`mp-star${on ? ' mp-on' : ''}`} title={['Finished', 'At or under par', 'Ink drop'][i]}>★</span>)}
    </span>
  );
  const face = (who: G.Who, cls = '') => <span className={`mp-face mp-face-${who} ${cls}`} aria-hidden="true" />;
  const hasLadder = !!g && (g.pg.plate[0].includes(G.K_LADDER) || g.pg.plate[1].includes(G.K_LADDER));
  const hinted = (a: G.Action) => (hintA === a ? ' mp-hinted' : '');

  const titleView = (
    <section className="mp-title">
      <div className="mp-poster">
        <img src={`${ART}title.webp`} alt="Dora and Enzo waving in front of a risograph print drum, printed in pink and teal" className="mp-poster-art" />
        <h1 className="mp-logo"><span className="mp-logo-p">Mis</span><span className="mp-logo-t">print</span></h1>
        <p className="mp-tagline">a two-ink puzzle zine</p>
      </div>
      <nav className="mp-menu">
        <button className="mp-btn mp-go" onClick={() => { const s = saveRef.current; if (!s.seenIntro) { s.seenIntro = true; persist(s); go('howto'); backRef.current = 'shelf'; } else go('shelf'); }}>Play</button>
        <button className="mp-btn" onClick={() => go('howto')}>How to play</button>
        <button className="mp-btn" onClick={() => go('settings')}>Settings</button>
        <a className="mp-btn mp-home" href="/">← Arcade</a>
      </nav>
    </section>
  );

  const howtoView = (
    <section className="mp-sheet mp-howto">
      <h2 className="mp-sticker">How to print</h2>
      <ul className="mp-rules">
        <li><b className="mp-ink-p">Pink</b> holds Dora, <b className="mp-ink-t">teal</b> holds Enzo, and <b className="mp-ink-x">purple</b> (where they overlap) holds both. The other ink is a ghost: walk right through it.</li>
        <li>Walk with <kbd>◀</kbd> <kbd>▶</kbd>. One-cell steps climb themselves. Nobody may fall off the page.</li>
        <li><b>Shift</b> slides the active chinchilla’s whole plate one cell: they and all their ink move together. Ink, registration marks <span aria-hidden="true">⊕</span> included, can’t leave the paper.</li>
        <li>Chinchillas are solid to each other. Stand on a head and you ride along when your partner walks or shifts.</li>
        <li>Get both of them onto the <b>staple</b> at the same time. Switching chinchilla is free; every other move counts.</li>
        <li>Stuck? <b>Undo</b> (Z) and <b>Restart</b> (R) are free, and <b>Hint</b> (H) shows the next move of the best solution.</li>
      </ul>
      <p className="mp-keys">Keys: arrows or A/D walk · W/S climb ladders · Tab or Q switch · Shift + arrows or WASD shifts the plate · Z undo · R restart · H hint</p>
      <button className="mp-btn mp-go" onClick={() => go(backRef.current === 'howto' ? 'title' : backRef.current)}>Let’s print</button>
    </section>
  );

  const settingsView = (
    <section className="mp-sheet mp-settings">
      <h2 className="mp-sticker">Settings</h2>
      {([['sound', 'Sound effects'], ['music', 'Music'], ['motion', 'Animation and wobble'], ['peek', 'Peek ahead: open every zine and page']] as [keyof G.Settings, string][]).map(([k, label]) => (
        <label key={k} className="mp-toggle"><input type="checkbox" checked={save.settings[k]} onChange={(e) => setSetting(k, e.target.checked)} /> <span>{label}</span></label>
      ))}
      <div className="mp-row">
        {!confirmReset ? <button className="mp-btn" onClick={() => setConfirmReset(true)}>Reset progress…</button>
          : <><button className="mp-btn mp-warn" onClick={() => { const s = G.newSave(); s.settings = saveRef.current.settings; s.seenIntro = true; persist(s); setConfirmReset(false); say('Progress reset.'); }}>Yes, erase every page</button><button className="mp-btn" onClick={() => setConfirmReset(false)}>Keep it</button></>}
      </div>
      <button className="mp-btn mp-go" onClick={() => { setConfirmReset(false); go(backRef.current === 'settings' ? 'title' : backRef.current); }}>Done</button>
    </section>
  );

  const shelfView = (
    <section className="mp-shelf">
      <header className="mp-head"><button className="mp-btn mp-small" onClick={() => go('title')}>← Title</button><h2 className="mp-sticker">The zine shelf</h2><button className="mp-btn mp-small" onClick={() => go('settings')}>Settings</button></header>
      <div className="mp-zines">
        {G.ZINES.map((z, i) => {
          const open = G.zineOpen(save, i), n = G.doneIn(save, i), need = G.UNLOCK_AT - G.doneIn(save, i - 1);
          return (
            <button key={z.id} className={`mp-zine${open ? '' : ' mp-locked'}`} disabled={!open} onClick={() => { setZine(i); go('pages'); }} aria-label={`${z.name}${open ? '' : ', locked'}`}>
              <span className="mp-cover"><img src={`${ART}cover${i + 1}.webp`} alt="" /><span className="mp-staples" aria-hidden="true" /><span className={`mp-masthead mp-mast-${i}`} aria-hidden="true">{z.name}</span></span>
              <span className="mp-label">{z.name}</span>
              <span className="mp-zine-meta">{n}/10 pages · ★ {zineStars(i)}/30</span>
              {!open && <span className="mp-lock">Opens when {G.ZINES[i - 1].name} has {G.UNLOCK_AT} pages done ({need} to go), or turn on Peek ahead in Settings.</span>}
              {open && <span className="mp-zine-blurb">{z.blurb}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );

  const pagesView = (
    <section className="mp-contact">
      <header className="mp-head"><button className="mp-btn mp-small" onClick={() => go('shelf')}>← Shelf</button><h2 className="mp-sticker">{G.ZINES[zine].name}</h2>
        {G.zineDone(save, zine) ? <button className="mp-btn mp-small" onClick={() => { setRewardZine(zine); go('reward'); }}>Reward print</button> : <span className="mp-head-note">★ {zineStars(zine)}/30</span>}</header>
      <div className="mp-thumbs">
        {G.zinePages(zine).map((p, i) => {
          const open = G.pageOpen(save, p.id), rec = save.pages[p.id];
          const ahead = i - (G.doneIn(save, zine) + 2);
          return (
            <button key={p.id} className={`mp-thumb${open ? '' : ' mp-locked'}${rec ? ' mp-thumb-done' : ''}`} disabled={!open} onClick={() => openPage(p.id)} aria-label={`Page ${i + 1}: ${p.name}${open ? '' : ', locked'}`}>
              <span className="mp-num">{i + 1}</span>
              {thumbs[p.id] ? <img src={thumbs[p.id]} alt="" /> : <span className="mp-thumb-blank" />}
              <span className="mp-thumb-name">{p.name}</span>
              {open ? starRow(G.stars(p, rec)) : <span className="mp-lock">Finish {ahead} more page{ahead === 1 ? '' : 's'} here to open</span>}
              {rec && <span className="mp-best">best {rec.best} · par {p.par}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );

  const rewardView = (
    <section className="mp-reward">
      <img src={`${ART}reward${rewardZine + 1}.webp`} alt={`Dora and Enzo: ${G.ZINES[rewardZine].reward}`} className="mp-reward-art" />
      <div className="mp-reward-note">
        <h2 className="mp-sticker">{G.ZINES[rewardZine].name}: complete!</h2>
        <p>{G.ZINES[rewardZine].reward}</p>
        <div className="mp-row">
          <button className="mp-btn mp-go" onClick={() => go('shelf')}>Back to the shelf</button>
          {rewardZine < 2 && G.zineOpen(save, rewardZine + 1) && <button className="mp-btn" onClick={() => { setZine(rewardZine + 1); go('pages'); }}>Open {G.ZINES[rewardZine + 1].name}</button>}
        </div>
      </div>
    </section>
  );

  const idx = g ? G.zinePages(g.pg.zine).indexOf(g.pg.def) + 1 : 0;
  const other: G.Who = (1 - active) as G.Who;
  return (
    <main className={`mp-shell mp-on-${screen} mp-act-${active}`} data-ready={ready ? 'true' : 'false'} onContextMenu={(e) => e.preventDefault()}>
      <div className="mp-play" aria-hidden={screen !== 'play'}>
        <header className="mp-bar">
          <button className="mp-btn mp-small" onClick={() => go('pages')} aria-label="Back to the contact sheet">← Pages</button>
          <span className="mp-pagetitle"><span className="mp-pagenum">{idx}</span> {g?.pg.def.name}</span>
          <span className="mp-stats">
            <span className="mp-moves" title="Moves (switching is free)">moves <b>{g?.moves ?? 0}</b> / par {g?.pg.def.par}</span>
            {g && g.pg.drop >= 0 && <span className={`mp-dropmark${st?.drop ? ' mp-on' : ''}`} title={st?.drop ? 'Ink drop collected' : 'Ink drop on this page'}>●</span>}
            {!!g?.hints && <span className="mp-hintcount">hints {g.hints}</span>}
          </span>
          <button className="mp-btn mp-small mp-mute" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Sound is off: turn it on' : 'Sound is on: mute'}>{muted ? '♪ off' : '♪ on'}</button>
          <button className="mp-btn mp-small" onClick={() => go('settings')}>Settings</button>
        </header>
        <aside className="mp-margin">
          <p className="mp-caption">{g?.pg.def.caption}</p>
          <p className="mp-msg" aria-live="polite">{msg?.text ?? ''}</p>
        </aside>
        <div className="mp-stage">
          <div className="mp-sheetpage" style={{ '--ar': g ? (g.pg.w + 1) / (g.pg.h + 1) : 1.5 } as React.CSSProperties}>
            <canvas ref={canvasRef} className="mp-canvas" onPointerDown={onCanvas} aria-label="The page: Dora and Enzo on the two-ink print" />
          </div>
        </div>
        {!done ? (<>
          <div className="mp-pad mp-pad-walk">
            <button className={`mp-key mp-walk${hinted('L')}`} onClick={() => act('L')} aria-label="Walk left">◀<small>Walk</small></button>
            <button className={`mp-key mp-switch${hinted('Q')}`} onClick={() => act('Q')} aria-label={`Switch to ${G.NAMES[other]}`}>{face(active)}<small>{G.NAMES[active]} · switch</small></button>
            <button className={`mp-key mp-walk${hinted('R')}`} onClick={() => act('R')} aria-label="Walk right">▶<small>Walk</small></button>
            {hasLadder && <>
              <button className={`mp-key mp-climb${hinted('U')}`} onClick={() => act('U')} aria-label="Climb up">▲<small>Climb</small></button>
              <button className={`mp-key mp-climb${hinted('D')}`} onClick={() => act('D')} aria-label="Climb down">▼<small>Climb</small></button>
            </>}
          </div>
          <div className="mp-pad mp-pad-shift" role="group" aria-label={`Shift the ${INKNAME[active]} plate`}>
            <span className="mp-cross-label">Shift <b>{INKNAME[active]}</b> plate</span>
            <button className={`mp-key mp-sU${hinted('sU')}`} onClick={() => act('sU')} aria-label={`Shift the ${INKNAME[active]} plate up`}>▲</button>
            <button className={`mp-key mp-sL${hinted('sL')}`} onClick={() => act('sL')} aria-label={`Shift the ${INKNAME[active]} plate left`}>◀</button>
            <span className="mp-cross-hub" aria-hidden="true" />
            <button className={`mp-key mp-sR${hinted('sR')}`} onClick={() => act('sR')} aria-label={`Shift the ${INKNAME[active]} plate right`}>▶</button>
            <button className={`mp-key mp-sD${hinted('sD')}`} onClick={() => act('sD')} aria-label={`Shift the ${INKNAME[active]} plate down`}>▼</button>
          </div>
          <div className="mp-pad mp-pad-tools">
            <button className="mp-key mp-tool" onClick={undo} aria-label="Undo">↶<small>Undo</small></button>
            <button className="mp-key mp-tool" onClick={restart} aria-label="Restart">⟲<small>Restart</small></button>
            <button className="mp-key mp-tool mp-hintbtn" onClick={hint} aria-label="Hint">?<small>Hint</small></button>
          </div>
        </>) : (
          <div className="mp-done" role="dialog" aria-label="Page printed">
            <span className="mp-stampmark" aria-hidden="true">Printed!</span>
            {starRow(done.stars, true)}
            <ul className="mp-done-list">
              <li className={done.stars[0] ? 'mp-on' : ''}>★ Finished</li>
              <li className={done.stars[1] ? 'mp-on' : ''}>★ {done.moves} moves, par {done.par}</li>
              <li className={done.stars[2] ? 'mp-on' : ''}>★ {done.hasDrop ? (done.drop ? 'Ink drop collected' : 'Ink drop missed') : 'Ink drop'}</li>
            </ul>
            <div className="mp-row">
              {done.zineNow ? <button className="mp-btn mp-go" onClick={() => { setRewardZine(g!.pg.zine); go('reward'); }}>See the reward print</button>
                : done.next ? <button className="mp-btn mp-go" onClick={() => openPage(done.next!)}>Next page</button> : null}
              <button className="mp-btn" onClick={undo}>Undo last move</button>
              <button className="mp-btn" onClick={() => openPage(g!.pg.id)}>Replay</button>
              <button className="mp-btn" onClick={() => go('pages')}>Contact sheet</button>
            </div>
          </div>
        )}
      </div>
      {screen === 'title' && titleView}
      {screen === 'howto' && howtoView}
      {screen === 'settings' && settingsView}
      {screen === 'shelf' && shelfView}
      {screen === 'pages' && pagesView}
      {screen === 'reward' && rewardView}
      {screen !== 'play' && msg && screen === 'settings' && <p className="mp-toast" aria-live="polite">{msg.text}</p>}
    </main>
  );
}
