'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SeedstormGame, PILOTS, DIFFS, DIFF_IDS, UPGRADES, UP_IDS, STAGES, STAGE_COUNT, BOSSES, DT, SAVE_KEY, HEART_CAP,
  readSave, freshSave, recordScore, noteReached, practiceUpTo, speakerName, idleInput,
  type Pilot, type Diff, type Save, type UpId, type Ev, type Phase, type BossId,
} from '@/lib/seedstorm-game';
import type { SeedstormScene } from '@/lib/seedstorm-scene';
import { SeedstormSound } from './sound';
import './seedstorm.css';

type Screen = 'menu' | 'play';
type Panel = 'main' | 'practice' | 'scores';
type Fresh = { diff: Diff; rank: number } | null;
const sceneModule = () => import('@/lib/seedstorm-scene');
const KEY_DIR: Record<string, [number, number]> = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
const BLOOM_KEYS = new Set(['x', ' ', 'k']);
const CAST: [string, string][] = [
  ['Dora', 'pilot, petal expert'], ['Enzo', 'pilot, pebble thrower'], ['Gale the Magpie', 'button collector'], ['Crabapple Crow', 'hat enthusiast'],
  ['Rumble', 'thundercloud, aspiring singer'], ['Madame Hoot', 'a very tired owl'], ['The Grumble Storm', 'just wanted to play'],
  ['Big Bumble, Kite Captain, Sprout Chief, Moth Matron and the Wisp Warden', 'the mid-boss gang'], ['Bumbles, kites, beetles, sprouts, moths and wisps', 'puffed into fluff, every one home safe'],
];

/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, w, h, className, who }: { src: string; paint: 'title' | 'ending' | 'portrait' | 'glider'; w: number; h: number; className?: string; who?: Pilot | BossId }) {
  const cv = useRef<HTMLCanvasElement>(null), im = useRef<HTMLImageElement>(null), [hide, setHide] = useState(false), [got, setGot] = useState(false);
  useEffect(() => {
    // the image may have loaded, or failed, before the page hydrated, when its own events were missed
    const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); }
  }, [src]);
  useEffect(() => {
    let dead = false;
    sceneModule().then((m) => {
      const c = cv.current; if (dead || !c) return;
      if (paint === 'title') m.paintTitle(c); else if (paint === 'ending') m.paintEnding(c);
      else if (paint === 'portrait') m.paintPortrait(c, who ?? 'dora');
      else { const q = c.getContext('2d')!; q.clearRect(0, 0, c.width, c.height); q.save(); q.translate(c.width / 2, c.height * 0.62); q.scale(c.width / 50, c.width / 50); m.paintGlider(q, (who as Pilot) ?? 'dora', 0.4, 1.2); q.restore(); }
    }).catch(() => {});
    return () => { dead = true; };
  }, [paint, who]);
  return (
    <span className={'ss-art ' + (className ?? '')}>
      <canvas ref={cv} width={w} height={h} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" width={w} height={h} onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}

export default function SeedstormPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<SeedstormScene | null>(null), sound = useRef<SeedstormSound | null>(null);
  const game = useRef<SeedstormGame | null>(null), save = useRef<Save>(freshSave());
  const screenRef = useRef<Screen>('menu'), pausedRef = useRef(false), slow = useRef(0);
  const keys = useRef(new Set<string>()), bloomQ = useRef(false), focusLock = useRef(false);
  const drag = useRef<{ id: number; fx: number; fy: number; px: number; py: number } | null>(null), target = useRef<{ x: number; y: number } | null>(null);
  const [screen, setScreenState] = useState<Screen>('menu'), [panel, setPanel] = useState<Panel>('main'), [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false), [mounted, setMounted] = useState(false), [error, setError] = useState('');
  const [pilot, setPilot] = useState<Pilot>('dora'), [diff, setDiff] = useState<Diff>('gusty'), [scoreTab, setScoreTab] = useState<Diff>('gusty');
  const [fresh, setFresh] = useState<Fresh>(null), [ending, setEnding] = useState(false), [recorded, setRecorded] = useState<number | null>(null), [focusOn, setFocusOn] = useState(false);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const S = save.current;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new SeedstormSound(save.current.settings.sound, save.current.settings.music); sound.current.unlock(); return sound.current; };

  function start(o: { stage?: number; practice?: boolean; seed?: number; pilot?: Pilot; diff?: Diff } = {}) {
    audio().ui();
    const p = o.pilot ?? save.current.pilot, d = o.diff ?? save.current.diff;
    const g = new SeedstormGame({ seed: o.seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0), pilot: p, diff: d, stage: o.stage, practice: o.practice });
    game.current = g; pausedRef.current = false; slow.current = 0; focusLock.current = false; setFocusOn(false); setPaused(false); setEnding(false); setRecorded(null); setFresh(null);
    keys.current.clear(); bloomQ.current = false; drag.current = null; target.current = null;
    noteReached(save.current, g); persist();
    scene.current?.stage(g.stage); sound.current?.music(g.stage, false);
    setScreen('play'); refresh();
    requestAnimationFrame(() => canvas.current?.focus());
  }
  function toMenu(p: Panel = 'main') {
    pausedRef.current = false; setPaused(false); game.current = null; setEnding(false); setScreen('menu'); setPanel(p); sound.current?.music(-1, false); refresh();
  }
  function pause(on: boolean) {
    const g = game.current; if (screenRef.current !== 'play' || !g || g.phase !== 'play') return;
    pausedRef.current = on; setPaused(on); keys.current.clear(); drag.current = null; target.current = null;
    if (!on) canvas.current?.focus();
  }
  /** Ends the run for good: its score goes on the table. */
  function finish(g: SeedstormGame, already?: number | null) {
    if (g.practice) { toMenu('practice'); return; }
    let rank = already ?? null;
    if (rank === null) { rank = recordScore(save.current, g, Date.now()); persist(); }
    setFresh(rank >= 0 ? { diff: g.diffId, rank } : null); setScoreTab(g.diffId); toMenu('scores');
  }
  /** Notices what the game did, for saving and the overlays. */
  function handle(events: Ev[], g: SeedstormGame) {
    for (const e of events) {
      if (e.k === 'stage') { noteReached(save.current, g); persist(); sound.current?.music(e.stage, false); }
      else if (e.k === 'bossIn' && !e.mid) sound.current?.music(g.stage, true);
      else if (e.k === 'clear') sound.current?.music(-1, false);
      else if (e.k === 'over') { if (!g.practice) { const rank = recordScore(save.current, g, Date.now()); persist(); setRecorded(rank); } }
      else if (e.k === 'won') { if (g.practice) continue; const rank = recordScore(save.current, g, Date.now()); persist(); setRecorded(rank); setEnding(true); }
      else if (e.k === 'continue') setRecorded(null);
    }
  }
  /** Runs a chat, shop or continue action and plays whatever it set off. */
  function act(fn: (g: SeedstormGame) => unknown, sfx: 'ui' | 'buy' | 'page' = 'ui') {
    const g = game.current; if (!g) return;
    const r = fn(g); if (r === false) return;
    const a = audio(); if (sfx === 'buy') a.buy(); else if (sfx === 'page') a.page(); else a.ui();
    const ev = g.events.splice(0); scene.current?.feed(ev, g); a.play(ev); handle(ev, g);
    if (g.phase === 'play') canvas.current?.focus();
    refresh();
  }

  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setPilot(save.current.pilot); setDiff(save.current.diff); setScoreTab(save.current.diff); setMounted(true); refresh();
    const w = window as unknown as { __seedstorm: () => SeedstormGame | null; __seedstormSkip: (stage: number) => void; __seedstormStart: (o?: { pilot?: Pilot; diff?: Diff; seed?: number; stage?: number; practice?: boolean }) => void };
    w.__seedstorm = () => game.current;
    w.__seedstormStart = (o) => start(o ?? {});
    w.__seedstormSkip = (stage) => { if (!game.current) start({}); const g = game.current!; g.warp(stage); g.player.invuln = 120; const ev = g.events.splice(0); scene.current?.feed(ev, g); handle(ev, g); refresh(); };
    let dead = false, raf = 0, last = 0, acc = 0, prev: Phase | null = null, prevBlooms = -1, ui = 0;
    const inp = idleInput();
    const resize = () => scene.current?.resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    sceneModule().then(({ SeedstormScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new SeedstormScene(canvas.current); } catch { setError('This browser cannot draw the sky.'); return; }
      scene.current.stage(1); ro?.observe(canvas.current); window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, playing = screenRef.current === 'play' && !!g;
        if (playing && g.phase === 'play' && !pausedRef.current) {
          // fixed 60 Hz steps; a long frame runs at most 8 of them and drops the rest, so it never spirals
          const k = slow.current > 0 ? 0.35 : 1; slow.current = Math.max(0, slow.current - dt); acc += dt * k;
          let n = 0;
          while (acc >= DT && n < 8) {
            acc -= DT; n++;
            const h = keys.current; let dx = 0, dy = 0;
            for (const key of h) { const d = KEY_DIR[key]; if (d) { dx += d[0]; dy += d[1]; } }
            inp.dx = Math.max(-1, Math.min(1, dx)); inp.dy = Math.max(-1, Math.min(1, dy));
            inp.focus = h.has('shift') || focusLock.current; inp.bloom = bloomQ.current; bloomQ.current = false;
            const t = target.current; inp.tx = t ? t.x : null; inp.ty = t ? t.y : null;
            g.step(inp);
            const ev = g.events.splice(0);
            if (ev.length) { slow.current = Math.max(slow.current, sc.feed(ev, g)); sound.current?.play(ev); handle(ev, g); }
            if (g.phase !== 'play') break;
          }
          if (n >= 8) acc = 0;
        } else {
          acc = 0;
          if (g && g.events.length) { const ev = g.events.splice(0); sc.feed(ev, g); sound.current?.play(ev); handle(ev, g); }
        }
        if (g && (g.phase !== prev || g.blooms !== prevBlooms)) { prev = g.phase; prevBlooms = g.blooms; refresh(); }
        if (!g) prev = null;
        sc.draw(playing ? g : null, g ? g.stage : 1, { dt, shake: save.current.settings.shake, paused: pausedRef.current || (!!g && g.phase === 'chat'), hi: save.current.scores[g ? g.diffId : 'gusty'][0]?.score ?? 0 });
        sound.current?.tick(playing && !pausedRef.current && g.phase !== 'over' && g.phase !== 'won');
        if (ms - ui > 250) { ui = ms; if (playing && (g.phase === 'shop' || g.phase === 'chat')) refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The sky could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current; if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (screenRef.current !== 'play' || !g) return;
      if (g.phase === 'chat') {
        if (e.repeat) return;
        if (k === 'escape') { e.preventDefault(); act((x) => x.skipChat()); }
        else if (k === 'z' || k === 'enter' || k === ' ') { e.preventDefault(); act((x) => x.advanceChat(), 'page'); }
        return;
      }
      if (g.phase === 'shop') {
        const n = Number(k) - 1;
        if (n >= 0 && n < UP_IDS.length && !e.repeat) act((x) => x.buy(UP_IDS[n]), 'buy');
        else if (k === 'enter' && !e.repeat && !(e.target as HTMLElement | null)?.closest?.('button')) act((x) => x.leaveShop());
        return;
      }
      if (g.phase !== 'play') return;
      if ((k === 'p' || k === 'escape') && !e.repeat) { e.preventDefault(); pause(!pausedRef.current); return; }
      if (pausedRef.current) return;
      if (k in KEY_DIR || k === 'shift') { keys.current.add(k); target.current = null; e.preventDefault(); return; }
      if (BLOOM_KEYS.has(k)) { e.preventDefault(); audio(); if (!e.repeat) bloomQ.current = true; }
    };
    const keyup = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); if (e.key === 'Shift') keys.current.delete('shift'); };
    const blur = () => { keys.current.clear(); drag.current = null; target.current = null; pause(true); };
    const hide = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hide);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose(); ro?.disconnect();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch and mouse: drag anywhere to fly (the pilot keeps its offset from the finger); a second finger Blooms
  const fieldAt = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return scene.current?.toField(e.clientX - r.left, e.clientY - r.top) ?? { x: 0, y: 0 }; };
  const onDown = (e: React.PointerEvent) => {
    const g = game.current; if (screenRef.current !== 'play' || !g || pausedRef.current) return;
    e.preventDefault(); audio();
    if (g.phase === 'chat') { act((x) => x.advanceChat(), 'page'); return; }
    if (g.phase !== 'play') return;
    if (drag.current && drag.current.id !== e.pointerId) { bloomQ.current = true; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const f = fieldAt(e); drag.current = { id: e.pointerId, fx: f.x, fy: f.y, px: g.player.x, py: g.player.y }; target.current = { x: g.player.x, y: g.player.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const f = fieldAt(e); target.current = { x: d.px + (f.x - d.fx), y: d.py + (f.y - d.fy) };
  };
  const onUp = (e: React.PointerEvent) => { if (drag.current?.id === e.pointerId) { drag.current = null; target.current = null; } };

  const g = game.current, phase = g?.phase, chat = g?.chat, P = PILOTS[pilot];
  const toggle = (k: 'sound' | 'music' | 'shake') => {
    S.settings[k] = !S.settings[k]; persist();
    const a = audio(); if (k === 'sound') a.setSound(S.settings.sound); if (k === 'music') a.setMusic(S.settings.music);
    a.ui(); refresh();
  };
  const settings = (
    <span className="ss-chips">
      <button className="ss-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')}>{S.settings.sound ? '🔊 Sound' : '🔇 Sound'}</button>
      <button className="ss-chip" aria-pressed={S.settings.music} onClick={() => toggle('music')}>{S.settings.music ? '🎵 Music' : '🎵 Off'}</button>
      <button className="ss-chip" aria-pressed={S.settings.shake} onClick={() => toggle('shake')}>{S.settings.shake ? '〰️ Shake' : '➖ Still'}</button>
    </span>
  );
  const upTo = practiceUpTo(S);
  const date = (ms: number) => (mounted && ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  return (
    <main className="ss-shell" data-ready={ready && mounted ? 'true' : undefined} data-screen={screen} data-phase={phase ?? 'none'}>
      {screen === 'play' && (
        <header className="ss-bar">
          <a href="/" className="ss-back">← ARCADE</a>
          <span className="ss-bar-mid">{g ? `${PILOTS[g.pilot].name} · ${DIFFS[g.diffId].name}${g.practice ? ' · practice' : ''}${g.continues ? ` · continues ${g.continues}` : ''}` : ''}</span>
          <span className="ss-chips">
            <button className="ss-chip" onClick={() => pause(!pausedRef.current)} aria-label="Pause" disabled={phase !== 'play'}>❚❚ Pause</button>
            <button className="ss-chip" aria-pressed={S.settings.sound} onClick={() => toggle('sound')} aria-label="Sound">{S.settings.sound ? '🔊' : '🔇'}</button>
          </span>
        </header>
      )}
      <div className="ss-stage">
        <canvas ref={canvas} className="ss-canvas" tabIndex={0} aria-label="Seedstorm playfield. Arrow keys or WASD fly, Shift focuses, X, Space or K Blooms, Esc or P pauses. On a touch screen, drag anywhere to fly and tap with a second finger to Bloom."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {screen === 'play' && g && (
          // stays mounted through chats, the shop and pauses so the field never jumps; the buttons just hide
          <div className={'ss-touch' + (phase === 'play' && !paused ? '' : ' is-idle')}>
            <button className={'ss-tbtn ss-focus' + (focusOn ? ' is-on' : '')} aria-pressed={focusOn} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); focusLock.current = !focusLock.current; setFocusOn(focusLock.current); }}>🎯<small>Focus</small></button>
            <button className="ss-tbtn ss-bloom" disabled={g.blooms <= 0} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); audio(); bloomQ.current = true; }}>🌸<small>Bloom ×{g.blooms}</small></button>
          </div>
        )}
      </div>
      {error && <div className="ss-panel ss-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'menu' && (
        <section className="ss-menu" aria-label="Seedstorm">
          <header className="ss-head"><a href="/" className="ss-back">← ARCADE</a>{settings}</header>
          {panel === 'main' && (<>
            <div className="ss-hero">
              <Art src="/art/seedstorm/title.webp" paint="title" w={1200} h={800} className="ss-hero-art" />
              <div><p className="ss-eyebrow">A COSY SHOOT-’EM-UP IN FIVE SKIES</p><h1>Seed<em>storm</em></h1>
                <p className="ss-lede">The Grumble Storm is blowing everyone’s washing away! Dora and Enzo hop on dandelion-seed gliders, dodge clouds of petals and raindrops, and fly all the way up to calm it down.</p></div>
            </div>
            <div className="ss-pick" role="radiogroup" aria-label="Who flies?">
              {(['dora', 'enzo'] as Pilot[]).map((p) => (
                <button key={p} role="radio" aria-checked={pilot === p} className={'ss-pilot' + (pilot === p ? ' is-on' : '')} onClick={() => { setPilot(p); S.pilot = p; persist(); audio().ui(); }}>
                  <Art src={`/art/seedstorm/${p}-glider.webp`} paint="glider" who={p} w={160} h={160} className="ss-pilot-art" />
                  <span><strong>{PILOTS[p].name}</strong><em>{PILOTS[p].shot}</em><small>{PILOTS[p].blurb}</small><small className="ss-wing">{PILOTS[PILOTS[p].wing].name} flies along as wingmate.</small></span>
                </button>
              ))}
            </div>
            <div className="ss-diffs" role="radiogroup" aria-label="How stormy?">
              {DIFF_IDS.map((d) => (
                <button key={d} role="radio" aria-checked={diff === d} className={'ss-diff d-' + d + (diff === d ? ' is-on' : '')} onClick={() => { setDiff(d); S.diff = d; persist(); audio().ui(); }}>
                  <strong>{DIFFS[d].name}</strong><small>{DIFFS[d].blurb}</small>
                  <small className="ss-best">{S.cleared[d] ? '★ Cleared' : S.reached[d] ? `Reached stage ${S.reached[d]}` : 'Not flown yet'}{S.scores[d][0] ? ` · best ${S.scores[d][0].score.toLocaleString()}` : ''}</small>
                </button>
              ))}
            </div>
            <div className="ss-go-row">
              <button className="ss-go" disabled={!ready} onClick={() => start({ pilot, diff })}>{ready ? `FLY WITH ${P.name.toUpperCase()} · ${DIFFS[diff].name.toUpperCase()} →` : 'Fluffing the seeds…'}</button>
              <button className="ss-alt" disabled={!ready || upTo < 1} onClick={() => { audio().ui(); setPanel('practice'); }}>Practice{upTo < 1 ? ' (reach a stage first)' : ''}</button>
              <button className="ss-alt" onClick={() => { audio().ui(); setFresh(null); setPanel('scores'); }}>High scores</button>
            </div>
            <ol className="ss-how">
              <li><b>Fly</b> with the arrow keys or WASD, or drag anywhere on a touch screen. Shots fire by themselves.</li>
              <li><b>Shift</b> (or 🎯) focuses: slower, tighter shots, and your tiny hitbox shows. Only that dot can be hit!</li>
              <li><b>Graze</b> close past bullets to fill the Bloom meter. <b>X</b>, <b>Space</b> or <b>K</b> (or 🌸) Blooms every bullet into seeds.</li>
              <li>Just hit? Bloom <b>straight away</b> to cancel it. Fly high to call every seed to you.</li>
            </ol>
          </>)}

          {panel === 'practice' && (
            <div className="ss-sub">
              <h2>Practice a stage</h2>
              <p className="ss-note">Any stage you have reached, alone, with fresh hearts and starting upgrades. Practice scores don’t go on the table. Flying as {P.name} on {DIFFS[diff].name}.</p>
              <ul className="ss-stages">
                {STAGES.map((s) => (
                  <li key={s.n}><button disabled={s.n > upTo || !ready} onClick={() => start({ stage: s.n, practice: true, pilot, diff })}>
                    <b>{s.n}</b><span><strong>{s.name}</strong><small>{s.n > upTo ? 'Not reached yet' : `${BOSSES[s.mid].name}, then ${BOSSES[s.boss].name}`}</small></span>
                  </button></li>
                ))}
              </ul>
              <button className="ss-alt" onClick={() => setPanel('main')}>← Back</button>
            </div>
          )}

          {panel === 'scores' && (
            <div className="ss-sub" aria-label="High scores">
              <h2>High scores</h2>
              {fresh && <p className="ss-news">New high score! #{fresh.rank + 1} on {DIFFS[fresh.diff].name}</p>}
              <div className="ss-tabs" role="tablist">{DIFF_IDS.map((d) => <button key={d} role="tab" aria-selected={scoreTab === d} className={scoreTab === d ? 'is-on' : ''} onClick={() => setScoreTab(d)}>{DIFFS[d].name}</button>)}</div>
              <table className="ss-table">
                <thead><tr><th>#</th><th>Pilot</th><th>Score</th><th>Reached</th><th>Date</th></tr></thead>
                <tbody>
                  {S.scores[scoreTab].length === 0 && <tr><td colSpan={5} className="ss-empty">No scores yet. Off you fly!</td></tr>}
                  {S.scores[scoreTab].map((e, i) => (
                    <tr key={i} className={fresh && fresh.diff === scoreTab && fresh.rank === i ? 'is-new' : ''}>
                      <td>{i + 1}</td><td>{e.pilot === 'dora' ? '🤍 Dora' : '🩶 Enzo'}</td><td>{e.score.toLocaleString()}</td>
                      <td>{e.cleared ? '★ All clear' : `Stage ${e.stage}`}{e.continues ? ` · ${e.continues} cont.` : ''}</td><td>{date(e.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ss-row"><button className="ss-go" disabled={!ready} onClick={() => start({ pilot, diff })}>Fly again</button><button className="ss-alt" onClick={() => setPanel('main')}>← Menu</button></div>
            </div>
          )}
        </section>
      )}

      {screen === 'play' && g && (<>
        {phase === 'chat' && chat && (
          <div className={'ss-chat' + (chat.after ? ' is-after' : '')} role="dialog" aria-label="Chat" onPointerDown={(e) => { e.preventDefault(); act((x) => x.advanceChat(), 'page'); }}>
            {(() => {
              const line = chat.lines[chat.i], who = line.who === 'boss' ? chat.boss : line.who === 'pilot' ? g.pilot : g.wingmate, isBoss = line.who === 'boss';
              const src = isBoss ? `/art/seedstorm/${BOSSES[chat.boss].art}.webp` : `/art/seedstorm/${who}-talk.webp`;
              return (
                <div className={'ss-line' + (isBoss ? ' is-boss' : '')} key={chat.i}>
                  <Art src={src} paint="portrait" who={who as Pilot | BossId} w={256} h={256} className="ss-face" />
                  <div><b>{speakerName(g, line.who, chat.boss)}</b><p>{line.text}</p><small>{chat.i + 1} / {chat.lines.length} · tap or Z to go on · Esc skips</small></div>
                </div>
              );
            })()}
          </div>
        )}

        {phase === 'shop' && g.results && (
          <div className="ss-panel ss-shop" role="dialog" aria-label="Seed shop">
            <p className="ss-eyebrow">STAGE {g.results.stage} CLEAR · {STAGES[g.results.stage - 1].name.toUpperCase()}</p>
            <dl className="ss-results">
              <div><dt>Stage score</dt><dd>{g.results.stageScore.toLocaleString()}</dd></div>
              <div><dt>Grazes</dt><dd>{g.results.grazes}</dd></div>
              <div><dt>Clear Sky</dt><dd>{g.results.clearSky} / {BOSSES[STAGES[g.results.stage - 1].mid].phases.length + BOSSES[STAGES[g.results.stage - 1].boss].phases.length}</dd></div>
              <div><dt>Seeds</dt><dd>{g.results.seeds}</dd></div>
              <div><dt>No-hit bonus</dt><dd>{g.results.noHit ? `+${g.results.noHitBonus.toLocaleString()}` : '—'}</dd></div>
              <div><dt>Bloom bonus</dt><dd>+{g.results.bloomBonus.toLocaleString()}</dd></div>
            </dl>
            <h2>Seed shop <span className="ss-purse">🌱 {g.purse}</span></h2>
            <div className="ss-cards">
              {UP_IDS.map((id, i) => {
                const u = UPGRADES[id], why = g.canBuy(id), lvl = g.level(id), max = id === 'heart' ? HEART_CAP : u.max;
                return (
                  <button key={id} className={'ss-card' + (why === 'max' ? ' is-max' : '')} disabled={why !== 'ok'} onClick={() => act((x) => x.buy(id), 'buy')}>
                    <kbd>{i + 1}</kbd><span className="ss-card-icon">{u.icon}</span><strong>{u.name}</strong>
                    <small>{id === 'heart' ? `${lvl} hearts` : `level ${lvl} / ${max}`}</small>
                    <span className="ss-card-text">{u.text}</span>
                    <span className="ss-price">{why === 'max' ? 'All full' : why === 'once' ? 'Bought' : `🌱 ${g.price(id)}`}</span>
                  </button>
                );
              })}
            </div>
            <button className="ss-go" onClick={() => act((x) => x.leaveShop())}>Fly on to stage {g.stage + 1}: {STAGES[g.stage].name} →</button>
          </div>
        )}

        {phase === 'over' && (
          <div className="ss-panel ss-over" role="dialog" aria-label="Out of hearts">
            <p className="ss-eyebrow">STAGE {g.stage} · {STAGES[g.stage - 1].name.toUpperCase()}</p>
            <h2>The breeze blew you home</h2>
            <p>{PILOTS[g.pilot].name} and {PILOTS[g.wingmate].name} float down for a cuddle and a snack. Score: <b>{g.score.toLocaleString()}</b>{recorded !== null && recorded >= 0 ? ` · new high score #${recorded + 1}!` : ''}</p>
            {g.canContinue ? <p className="ss-note">Continue from right here with full hearts. Your score starts again from zero.</p> : <p className="ss-note">{g.practice ? 'Practice runs can try again any time.' : 'Stormy has no continues. What a flight, though!'}</p>}
            <div className="ss-row">
              {g.canContinue && <button className="ss-go" onClick={() => act((x) => x.continueRun())}>Continue{g.continues ? ` (${g.continues + 1})` : ''}</button>}
              {g.practice && <button className="ss-go" onClick={() => start({ stage: g.stage, practice: true, pilot: g.pilot, diff: g.diffId })}>Try again</button>}
              <button className="ss-alt" onClick={() => finish(g, recorded ?? -1)}>End run</button>
            </div>
          </div>
        )}

        {phase === 'won' && g.practice && g.results && (
          <div className="ss-panel" role="dialog" aria-label="Practice clear">
            <p className="ss-eyebrow">PRACTICE · STAGE {g.results.stage}</p>
            <h2>{STAGES[g.results.stage - 1].name}: clear!</h2>
            <dl className="ss-results">
              <div><dt>Score</dt><dd>{g.score.toLocaleString()}</dd></div><div><dt>Grazes</dt><dd>{g.results.grazes}</dd></div><div><dt>Clear Sky</dt><dd>{g.results.clearSky}</dd></div><div><dt>Hearts lost</dt><dd>{g.results.hits}</dd></div>
            </dl>
            <div className="ss-row"><button className="ss-go" onClick={() => start({ stage: g.stage, practice: true, pilot: g.pilot, diff: g.diffId })}>Again</button><button className="ss-alt" onClick={() => toMenu('practice')}>Practice menu</button></div>
          </div>
        )}

        {phase === 'won' && !g.practice && ending && (
          <div className="ss-ending" role="dialog" aria-label="The end">
            <Art src="/art/seedstorm/ending.webp" paint="ending" w={1200} h={800} className="ss-ending-art" />
            <div className="ss-ending-text">
              <h2>The sky is calm</h2>
              <p>The Grumble Storm turned into a small, shy, happy cloud. The washing is back on the line, Gale has his buttons, and there’s apple pie for everyone.</p>
              <p className="ss-final">Final score <b>{g.score.toLocaleString()}</b>{recorded !== null && recorded >= 0 ? ` · #${recorded + 1} on ${DIFFS[g.diffId].name}` : ''}</p>
            </div>
            <div className="ss-credits" aria-label="Cast"><div>
              <p className="ss-eyebrow">STARRING</p>
              {CAST.map(([n, r]) => <p key={n}><b>{n}</b><small>{r}</small></p>)}
              <p className="ss-eyebrow">THANK YOU FOR FLYING</p>
            </div></div>
            <button className="ss-go" onClick={() => finish(g, recorded ?? -1)}>See the high scores →</button>
          </div>
        )}

        {paused && (
          <div className="ss-panel" role="dialog" aria-label="Paused">
            <h2>Paused</h2><p>The seeds hang in the air, waiting for you.</p>
            {settings}
            <div className="ss-row"><button className="ss-go" onClick={() => pause(false)}>Keep flying</button><button className="ss-alt" onClick={() => { const x = game.current; if (x && !x.practice && x.score > 0) finish(x); else toMenu(x?.practice ? 'practice' : 'main'); }}>Land (end the run)</button></div>
          </div>
        )}
      </>)}
    </main>
  );
}
