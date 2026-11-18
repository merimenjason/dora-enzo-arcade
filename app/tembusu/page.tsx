'use client';
// Tembusu: the page. The hill fills the window; the tree grows by itself with the real clock. A small panel at the top
// left says which tree this is, how old it is and the latest happening; a panel at the bottom right appears only when
// there is a decision (a fork's three buds, the seeds to keep, the seed to plant). Buds glow on the branch too: click
// one there or press 1, 2 or 3. J opens Enzo's journal, Esc closes it. Rules in lib/tembusu-game.ts, drawing in
// lib/tembusu-scene.ts. `window.__tembusu` drives time for the tests and bots: `skip(ms)` moves the clock on.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/tembusu-game';
import type { Save, TreeState } from '@/lib/tembusu-game';
import type { TembusuScene } from '@/lib/tembusu-scene';
import { ATLAS } from '@/lib/tembusu-art';
import { TembusuSound } from './sound';
import './tembusu.css';

type Overlay = null | 'journal' | 'settings';
const ATLAS_W = 1024;
const EV_ICON: Partial<Record<G.LogKind, string>> = { storm: 'ic-storm', dry: 'ic-dry', lightning: 'ic-lightning', beetles: 'ic-beetles', fruiting: 'ic-fruiting', migrants: 'ic-migrants' };

/** a sprite from the atlas as a box, scaled up in whole pixels */
function Spr({ n, s = 2, dim = false, title }: { n: string; s?: number; dim?: boolean; title?: string }) {
  const b = ATLAS[n]; if (!b) return null;
  const [x, y, w, h] = b;
  return <i className={`tb-spr${dim ? ' dim' : ''}`} title={title} aria-hidden={!title} style={{ width: w * s, height: h * s, backgroundPosition: `${-x * s}px ${-y * s}px`, backgroundSize: `${ATLAS_W * s}px auto` }} />;
}
const fit = (n: string, box: number) => { const b = ATLAS[n]; return b ? Math.max(1, Math.floor(box / Math.max(b[2], b[3]))) : 1; };

export default function TembusuPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TembusuScene | null>(null);
  const soundRef = useRef<TembusuSound | null>(null);
  const skipRef = useRef(0);
  const saveRef = useRef<Save | null>(null);
  const treeRef = useRef<TreeState | null>(null);
  const [save, setSave] = useState<Save | null>(null);
  const [tree, setTree] = useState<TreeState | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [overlay, setOverlayState] = useState<Overlay>(null);
  const overlayRef = useRef<Overlay>(null);
  const [recapDone, setRecapDone] = useState(false);
  const [chosen, setChosen] = useState<number[]>([]);
  const [hover, setHover] = useState(-1);
  const hoverRef = useRef(-1);
  const [sky, setSky] = useState('#f8b493');
  const reduced = useRef(false);

  const now = () => Date.now() + skipRef.current;
  const tz = () => -new Date().getTimezoneOffset();
  const setOverlay = useCallback((o: Overlay) => { overlayRef.current = o; setOverlayState(o); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave(s); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);

  /** a check-in: re-derive the tree and update the panels when something changed */
  const refresh = useCallback((force = false) => {
    const s = saveRef.current; if (!s) return;
    const { save: next, tree: t } = G.checkIn(s, now());
    const old = treeRef.current;
    treeRef.current = t;
    const changed = force || !old || old.log.length !== t.log.length || old.phase !== t.phase || old.n !== t.n || G.ageWord(old) !== G.ageWord(t) || old.weather !== t.weather;
    if (changed) {
      if (old && t.phase === 'fork' && old.phase !== 'fork') soundRef.current?.fork();
      setTree(t);
      persist(next);
    } else saveRef.current = next;
  }, [persist]);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    const raw = (() => { try { return localStorage.getItem(G.SAVE_KEY); } catch { return null; } })();
    const s = G.parseSave(raw, Date.now(), (Date.now() ^ (Math.random() * 1e9)) >>> 0, tz());
    saveRef.current = s; setSave(s);
    if (s.begun) setStarted(true);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new TembusuSound(s.sound);
    refresh(true);
    let gone = false;
    void import('@/lib/tembusu-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.TembusuScene(canvasRef.current); sceneRef.current = sc;
      void sc.load().then(() => { if (!gone) setReady(true); });
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else { soundRef.current?.resume(); refresh(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, [refresh]);

  // the loop: the scene at a calm 15 frames a second, a check-in every second
  useEffect(() => {
    let raf = 0, lastDraw = 0, lastCheck = 0;
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      if (ms - lastCheck > 1000) { lastCheck = ms; refresh(); }
      if (ms - lastDraw < 66) return;
      lastDraw = ms;
      const sc = sceneRef.current, s = saveRef.current, t = treeRef.current;
      if (!sc || !s || !t) return;
      sc.draw({ save: s, tree: t, time: ms / 1000, now: now(), journalOpen: overlayRef.current === 'journal', hover: hoverRef.current, reduced: reduced.current });
      setSky((old) => (old === sc.skyColor ? old : sc.skyColor));
      const part = G.dayPart(G.hourAt(s.tree, now()));
      soundRef.current?.ambient(part === 'day' || part === 'dawn', t.weather === 'storm', ms / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [refresh]);

  // fit the 3:2 hill to the window, in whole screen pixels per game pixel when that's close enough
  useEffect(() => {
    const fitStage = () => {
      const st = stageRef.current; if (!st) return;
      let s = Math.min(innerWidth / 384, innerHeight / 256);
      if (s >= 2 && Math.floor(s) / s > 0.9) s = Math.floor(s);
      st.style.width = `${Math.floor(384 * s)}px`; st.style.height = `${Math.floor(256 * s)}px`;
    };
    fitStage(); addEventListener('resize', fitStage); return () => removeEventListener('resize', fitStage);
  }, []);

  // ---------------------------------------------------------------- the decisions
  const decision = save && tree ? G.decision(save, tree) : null;
  const pick = useCallback((b: number) => {
    const s = saveRef.current; if (!s) return;
    soundRef.current?.unlock();
    const next = G.pickBud(s, now(), b);
    if (next === s) return;
    soundRef.current?.chime();
    persist(next); refresh(true);
  }, [persist, refresh]);
  const keep = () => {
    const s = saveRef.current; if (!s || !chosen.length) return;
    persist(G.keepSeeds(s, now(), chosen)); refresh(true); soundRef.current?.chime();
  };
  const plantSeed = (from: 'kept' | 'journal', i: number) => {
    const s = saveRef.current; if (!s) return;
    const next = G.plant(s, now(), from, i, tz());
    if (next === s) return;
    persist(next); setChosen([]); setRecapDone(false); refresh(true); soundRef.current?.chime();
  };
  const toggleSeed = (i: number) => setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : c.length >= G.KEEP ? c : [...c, i]));

  // keys: 1/2/3 for buds, J for the journal, Esc to close
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      soundRef.current?.unlock();
      if (e.key === 'Escape') { if (overlayRef.current) { setOverlay(null); e.preventDefault(); } return; }
      if (e.key === 'j' || e.key === 'J') { if (started) { setOverlay(overlayRef.current === 'journal' ? null : 'journal'); soundRef.current?.page(); } return; }
      if (!started || overlayRef.current) return;
      if (['1', '2', '3'].includes(e.key) && treeRef.current?.phase === 'fork') { pick(Number(e.key) - 1); e.preventDefault(); }
    };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [pick, setOverlay, started]);

  // the window hook for tests and bots
  useEffect(() => {
    (window as unknown as { __tembusu: unknown }).__tembusu = {
      skip: (ms: number) => { skipRef.current += ms; refresh(true); },
      engine: G,
      state: () => ({ save: saveRef.current, tree: treeRef.current && { ...treeRef.current, log: treeRef.current.log.length }, decision: saveRef.current && treeRef.current && G.decision(saveRef.current, treeRef.current), scene: sceneRef.current?.last, buds: sceneRef.current?.buds, overlay: overlayRef.current, now: now(), started }),
    };
  }, [refresh, started]);

  // ---------------------------------------------------------------- the canvas
  const toGame = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 384, y: ((e.clientY - r.top) / r.height) * 256 };
  };
  const onMove = (e: React.MouseEvent) => {
    const p = toGame(e); const b = sceneRef.current?.budAt(p.x, p.y) ?? -1;
    if (b !== hoverRef.current) { hoverRef.current = b; setHover(b); }
  };
  const onClick = (e: React.MouseEvent) => {
    soundRef.current?.unlock();
    const p = toGame(e); const b = sceneRef.current?.budAt(p.x, p.y) ?? -1;
    if (b >= 0) pick(b);
  };

  const settings = (patch: Partial<Pick<Save, 'sound' | 'speed'>>) => {
    const s = saveRef.current; if (!s) return;
    const next = { ...s, ...patch }; persist(next);
    if (patch.sound !== undefined) soundRef.current?.set(patch.sound);
  };
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    const s = G.newSave(now(), (Date.now() ^ (Math.random() * 1e9)) >>> 0, tz());
    s.sound = saveRef.current?.sound ?? true; s.begun = true;
    skipRef.current = 0; persist({ ...s, lastNow: Date.now() }); setConfirmReset(false); setOverlay(null); setRecapDone(false); setChosen([]); refresh(true);
  };

  /** the first visit: the first seed goes in when the player plants it, not when the page opened */
  const begin = () => {
    soundRef.current?.unlock();
    const s = saveRef.current;
    if (s && !s.begun) persist({ ...G.newSave(now(), s.tree.seed, tz()), sound: s.sound, speed: s.speed, begun: true });
    setStarted(true); refresh(true);
  };

  // ---------------------------------------------------------------- the panels
  const last = tree ? G.latest(tree) : null;
  const seeds = save && tree && tree.phase === 'fallen' ? G.fallSeeds(save.tree, tree) : [];
  const showRecap = started && tree?.phase === 'fallen' && !save?.kept && !recapDone;

  return (
    <main className="tb-shell" style={{ background: sky }} data-ready={ready && save ? 'true' : 'false'}>
      <div className="tb-stage" ref={stageRef}>
        <canvas ref={canvasRef} className={`tb-canvas${hover >= 0 ? ' on-bud' : ''}`} onMouseMove={onMove} onClick={onClick} aria-label="The hill and the tree" />
        {started && save && tree && (
          <>
            <section className="tb-panel tb-status" aria-live="polite">
              <b>Tree {tree.n}</b> <span className="tb-age">· {G.ageWord(tree)}</span>
              {last && <p data-testid="latest">{G.describe(last)}</p>}
            </section>
            <nav className="tb-panel tb-menu">
              <button onClick={() => { setOverlay(overlay === 'journal' ? null : 'journal'); soundRef.current?.page(); }} aria-label="Enzo’s journal (J)">Journal</button>
              <button onClick={() => setOverlay(overlay === 'settings' ? null : 'settings')} aria-label="Settings">Settings</button>
            </nav>
            {decision?.kind === 'bud' && !overlay && (
              <section className="tb-panel tb-decide" data-testid="buds">
                <h2>A fork. Which bud?</h2>
                {decision.offer.map((b, i) => (
                  <button key={b} className={`tb-bud${hover === i ? ' hot' : ''}`} onClick={() => pick(i)} onMouseEnter={() => { hoverRef.current = i; setHover(i); }} onMouseLeave={() => { hoverRef.current = -1; setHover(-1); }}>
                    <kbd>{i + 1}</kbd><Spr n={`ic-${b}`} s={1} /><span><b>{G.BUD_INFO[b].name}</b><small>{G.BUD_INFO[b].line}</small></span>
                  </button>
                ))}
              </section>
            )}
            {showRecap && !overlay && (
              <section className="tb-panel tb-recap" data-testid="recap" aria-label="The tree’s life">
                <div className="tb-recap-row">
                  {tree.log.filter((e) => e.kind === 'pick' || e.kind === 'assist' || EV_ICON[e.kind]).map((e, i) => (
                    <Spr key={i} n={e.bud ? `ic-${e.bud}` : EV_ICON[e.kind]!} s={1} />
                  ))}
                </div>
                <div className="tb-recap-row">
                  {tree.ever.map((a) => <Spr key={a} n={`${a}-0`} s={fit(`${a}-0`, 40)} title={G.ANIMAL[a].name} />)}
                </div>
                <div className="tb-recap-row"><Spr n="log" s={1} /></div>
                <button className="tb-go" onClick={() => setRecapDone(true)} aria-label="Go on to the seeds">→</button>
              </section>
            )}
            {decision?.kind === 'keep' && !showRecap && !overlay && (
              <section className="tb-panel tb-decide tb-seeds" data-testid="keep">
                <h2>Keep up to three seeds</h2>
                {seeds.map((s, i) => (
                  <button key={s.trait} className={`tb-seed${chosen.includes(i) ? ' on' : ''}`} aria-pressed={chosen.includes(i)} onClick={() => toggleSeed(i)}>
                    <Spr n="seed" s={1} /><span><b>{G.TRAIT[s.trait].name}</b><small>{G.TRAIT[s.trait].line}</small></span>
                  </button>
                ))}
                <button className="tb-go" disabled={!chosen.length} onClick={keep}>Keep {chosen.length || ''}</button>
              </section>
            )}
            {decision?.kind === 'plant' && !overlay && (
              <section className="tb-panel tb-decide tb-seeds" data-testid="plant">
                <h2>Which seed does Enzo plant?</h2>
                {decision.kept.map((s, i) => (
                  <button key={s.trait} className="tb-seed" onClick={() => plantSeed('kept', i)}>
                    <Spr n="seed" s={1} /><span><b>{G.TRAIT[s.trait].name}</b><small>{G.traitsOf(s).slice(1).map((t) => G.TRAIT[t].name).join(', ') || G.TRAIT[s.trait].line}</small></span>
                  </button>
                ))}
                {save.journal.seeds.length > 0 && <p className="tb-note">Or one from the journal ({save.journal.seeds.length}): press J.</p>}
              </section>
            )}
          </>
        )}
        {overlay === 'journal' && save && tree && (
          <div className="tb-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOverlay(null); }}>
            <section className="tb-journal" data-testid="journal" aria-label="Enzo’s journal">
              <div className="tb-page">
                <h2>Animals</h2>
                <div className="tb-animals">
                  {G.ANIMALS.map((a) => {
                    const seen = save.journal.animals.includes(a.id) || tree.seen.includes(a.id);
                    return (
                      <div key={a.id} className={`tb-animal${seen ? '' : ' unseen'}`} title={seen ? `${a.name}: needs ${a.needs}; ${a.effect}.` : 'Not seen yet'}>
                        <span className="tb-pic"><Spr n={`${a.id}-0`} s={1} dim={!seen} /></span>
                        <span><b>{seen ? a.name : '?'}</b>{seen && <small>Needs {a.needs}.</small>}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="tb-page">
                <h2>Seeds</h2>
                {decision?.kind === 'plant' && save.journal.seeds.length > 0 && <p className="tb-note">Tap a seed to plant it.</p>}
                <ul className="tb-held">
                  {save.journal.seeds.length ? save.journal.seeds.map((s, i) => (
                    <li key={i}>
                      {decision?.kind === 'plant'
                        ? <button className="tb-seed" onClick={() => { plantSeed('journal', i); setOverlay(null); }}><Spr n="seed" s={1} /><b>{G.TRAIT[s.trait].name}</b></button>
                        : <><Spr n="seed" s={1} /> <b>{G.TRAIT[s.trait].name}</b></>}
                    </li>
                  )) : <li className="tb-note">No seeds saved yet.</li>}
                </ul>
                <h2>Traits</h2>
                <ul className="tb-traits">
                  {G.TRAITS.map((t) => { const seen = save.journal.traits.includes(t.id); return <li key={t.id} className={seen ? '' : 'unseen'} title={seen ? t.line : ''}>{seen ? t.name : '?'}</li>; })}
                </ul>
                <p className="tb-note">Trees on the hill: {save.journal.trees.length + 1}</p>
              </div>
              <button className="tb-close" onClick={() => setOverlay(null)} aria-label="Close the journal (Esc)">×</button>
            </section>
          </div>
        )}
        {overlay === 'settings' && save && (
          <div className="tb-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOverlay(null); }}>
            <section className="tb-panel tb-settings" data-testid="settings">
              <h2>Settings</h2>
              <button aria-pressed={save.sound} onClick={() => settings({ sound: !save.sound })}>Sound: {save.sound ? 'on' : 'off'}</button>
              <button aria-pressed={save.speed === 'slow'} onClick={() => settings({ speed: save.speed === 'slow' ? 'normal' : 'slow' })}>Grow speed: {save.speed === 'slow' ? 'slow (24 h)' : `normal (${G.TREE_HOURS} h)`}</button>
              <p className="tb-note">Grow speed starts with the next tree.</p>
              <button className="tb-danger" onClick={reset}>{confirmReset ? 'Really start the hill over?' : 'Start the hill over'}</button>
              <a className="tb-home" href="/">Back to the arcade</a>
              <button className="tb-close" onClick={() => { setOverlay(null); setConfirmReset(false); }} aria-label="Close settings (Esc)">×</button>
            </section>
          </div>
        )}
        {!started && (
          <div className="tb-title">
            <section className="tb-panel tb-titlecard">
              <h1>Tembusu</h1>
              <p>One tree on a hill, from seed to fall. It grows by itself, even when you’re away. Now and then a branch reaches a fork and offers three buds: pick one, or the tree picks for itself after an hour.</p>
              <p>Animals move in by the tree’s shape. When it falls, keep its seeds for the next tree.</p>
              <button className="tb-go" onClick={begin}>Plant the first seed</button>
              <a className="tb-home" href="/">Back to the arcade</a>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
