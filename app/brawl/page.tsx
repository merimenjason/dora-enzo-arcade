/* oxlint-disable react/react-compiler -- The run is a mutable engine object changed by the shop and drawn by the loop, like the other arcade games. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation back to the menu. */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Run, UNITS, UNIT_IDS, SNACKS, SNACK_IDS, LINE, loadProfile, record, type Coach, type Profile, type Unit, type Slot } from '../../lib/hay-bale-game';
import { drawShop, drawFight, drawTitle, drawCritter, drawSnack, stepReplay, inBox, LAYOUT, STAGE, type Held, type ShopUi, type Replay } from '../../lib/hay-bale-scene';
import { sound } from './sound';
import './brawl.css';

const RUN_KEY = 'hay-bale-run-v1', PROFILE_KEY = 'hay-bale-v1';
type Screen = 'title' | 'shop' | 'fight' | 'over' | 'almanac';
type Target = { kind: 'line'; i: number } | { kind: 'sell' };
type Spot = Held | Target | null;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: nothing is kept */ } },
  drop: (k: string) => { try { localStorage.removeItem(k); } catch { /* nothing to remove */ } },
};

/** What is under a stage point in the shop: an item to pick up, a place to put one, or nothing. */
function spotAt(run: Run, x: number, y: number): Spot {
  for (let i = 0; i < LINE; i++) if (inBox(LAYOUT.line[i], x, y)) return run.line[i] ? { from: 'line', i } : { kind: 'line', i };
  if (inBox(LAYOUT.sell, x, y)) return { kind: 'sell' };
  for (let i = 0; i < run.units.length && i < LAYOUT.units.length; i++) if (run.units[i] && inBox(LAYOUT.units[i], x, y)) return { from: 'unit', i };
  for (let i = 0; i < run.snacks.length; i++) if (run.snacks[i] && inBox(LAYOUT.snacks[i], x, y)) return { from: 'snack', i };
  return null;
}
const isHeld = (s: Spot): s is Held => !!s && 'from' in s;
/** A line unit under the point is also a place to put things (a merge, a swap or a snack). */
const asTarget = (s: Spot): Target | null => (!s ? null : 'kind' in s ? s : s.from === 'line' ? { kind: 'line', i: s.i } : null);
const same = (a: Held | null, b: Held | null) => !!a && !!b && a.from === b.from && a.i === b.i;

/** A canvas drawn once. */
function Still({ draw, className }: { draw: (c: CanvasRenderingContext2D) => void; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (c) { c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 480, 320); draw(c); } }, [draw]);
  return <canvas ref={ref} width={960} height={640} className={className} aria-hidden="true" />;
}

export default function HayBaleBrawl() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('title');
  const [profile, setProfile] = useState<Profile>(() => loadProfile(null));
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(false);
  const [, setTick] = useState(0);
  const runRef = useRef<Run | null>(null);
  const replayRef = useRef<Replay | null>(null);
  const speedRef = useRef<1 | 2>(1);
  const profileRef = useRef(profile);
  const uiRef = useRef<ShopUi>({ held: null, dragging: false, x: 0, y: 0, card: null });
  const pressRef = useRef<{ held: Held | null; x0: number; y0: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<Screen>('title');
  profileRef.current = profile; screenRef.current = screen;
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  /** Saves the run after every change; a finished run goes into the profile and its save is removed. */
  const persist = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    if (run.phase === 'shop') { store.set(RUN_KEY, JSON.stringify(run)); setSaved(true); return; }
    const next = record(profileRef.current, run);
    profileRef.current = next; setProfile(next); store.set(PROFILE_KEY, JSON.stringify(next));
    store.drop(RUN_KEY); setSaved(false);
  }, []);

  const go = useCallback((s: Screen) => { uiRef.current = { held: null, dragging: false, x: 0, y: 0, card: null }; pressRef.current = null; setScreen(s); }, []);
  const start = useCallback((coach: Coach, seed = (Math.random() * 2 ** 31) | 0) => {
    runRef.current = new Run(seed, coach); replayRef.current = null;
    persist(); go('shop');
  }, [persist, go]);
  const resume = useCallback(() => {
    const run = Run.load(store.get(RUN_KEY));
    if (!run || run.phase !== 'shop') { store.drop(RUN_KEY); setSaved(false); return; }
    runRef.current = run; go('shop');
  }, [go]);

  /** Puts a held item somewhere. */
  const apply = useCallback((held: Held, to: Target) => {
    const run = runRef.current;
    if (!run) return false;
    const at = to.kind === 'line' ? run.line[to.i] : null, level = at?.level ?? 0;
    let ok = false;
    if (held.from === 'unit' && to.kind === 'line') ok = run.buy(held.i, to.i);
    else if (held.from === 'snack' && to.kind === 'line') ok = run.feed(held.i, to.i);
    else if (held.from === 'line' && to.kind === 'line') ok = run.move(held.i, to.i);
    else if (held.from === 'line' && to.kind === 'sell') ok = run.sell(held.i);
    if (ok) {
      const now = to.kind === 'line' ? run.line[to.i] : null;
      sound.cue(held.from === 'line' && to.kind === 'sell' ? 'sell' : now && level && now.level > level ? 'level' : at && now === at && held.from !== 'snack' ? 'merge' : 'buy');
      persist();
    }
    return ok;
  }, [persist]);

  const roll = useCallback(() => { const run = runRef.current; if (run?.roll()) { sound.cue('roll'); persist(); refresh(); } }, [persist, refresh]);
  const freeze = useCallback(() => {
    const run = runRef.current, h = uiRef.current.held;
    if (run && h && h.from !== 'line' && run.freeze(h.from, h.i)) { uiRef.current.held = null; persist(); refresh(); }
  }, [persist, refresh]);
  const endTurn = useCallback(() => {
    const run = runRef.current;
    const out = run?.endTurn();
    if (!run || !out) return;
    persist();
    replayRef.current = { outcome: out, i: 0, t: 0, speed: speedRef.current };
    go('fight');
  }, [persist, go]);
  const skip = useCallback(() => { const r = replayRef.current; if (r) { r.i = r.outcome.events.length; r.t = 0; refresh(); } }, [refresh]);
  const next = useCallback(() => { const run = runRef.current; replayRef.current = null; go(run && run.phase === 'shop' ? 'shop' : 'over'); }, [go]);

  useEffect(() => {
    const p = loadProfile(store.get(PROFILE_KEY));
    profileRef.current = p; setProfile(p);
    setSaved(!!Run.load(store.get(RUN_KEY)));
    setMuted(sound.muted());
    setReady(true);
  }, []);

  useEffect(() => {
    (window as unknown as { __brawl?: () => unknown }).__brawl = () => ({
      run: runRef.current, profile: profileRef.current, replay: replayRef.current, ui: () => uiRef.current, layout: LAYOUT, start,
      set: (p: { line?: (Unit | null)[]; units?: (Slot | null)[]; snacks?: (Slot | null)[]; acorns?: number }) => {
        const run = runRef.current;
        if (!run) return;
        if (p.line) run.line = [0, 1, 2, 3, 4].map((i) => p.line![i] ?? null);
        if (p.units) run.units = p.units;
        if (p.snacks) run.snacks = p.snacks;
        if (p.acorns !== undefined && p.acorns !== null) run.acorns = p.acorns;
        persist(); refresh();
      },
      stage: () => { const r = canvasRef.current?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; },
    });
  });

  // The canvas fills the largest 3:2 box between the bar at the top and the buttons, at the screen's pixel density.
  useEffect(() => {
    if (screen !== 'shop' && screen !== 'fight') return;
    const fit = () => {
      const canvas = canvasRef.current, holder = canvas?.parentElement;
      if (!canvas || !holder) return;
      const room = holder.getBoundingClientRect(), w = Math.max(120, Math.min(room.width - 16, ((room.height - 16) * 3) / 2)), h = (w * 2) / 3, dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [screen]);

  // The loop draws the shop or plays the fight back; it rests while the tab is hidden.
  useEffect(() => {
    if (screen !== 'shop' && screen !== 'fight') return;
    let raf = 0, last = performance.now(), heard = 0, done = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const run = runRef.current, canvas = canvasRef.current;
      if (!run || !canvas || document.hidden) return;
      const c = canvas.getContext('2d')!;
      c.setTransform(canvas.width / STAGE.w, 0, 0, canvas.height / STAGE.h, 0, 0);
      const r = replayRef.current;
      if (screen === 'fight' && r) {
        stepReplay(r, dt);
        for (; heard < r.i; heard++) {
          const e = r.outcome.events[heard];
          if (r.i - heard > 3) continue;
          if (e.k === 'hit' || e.k === 'faint' || e.k === 'ability') sound.cue(e.k);
          if (e.k === 'end') sound.cue(e.result === 'win' ? 'win' : e.result === 'loss' ? 'loss' : 'draw');
        }
        if (!done && r.i >= r.outcome.events.length) { done = true; refresh(); }
        drawFight(c, r, now);
      } else drawShop(c, run, uiRef.current, now);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [screen, refresh]);

  // Pointer: drag an item to a place, or tap it and then tap the place. Let go anywhere, even off the canvas, to end it.
  const toStage = useCallback((cx: number, cy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return null;
    const x = ((cx - r.left) / r.width) * STAGE.w, y = ((cy - r.top) / r.height) * STAGE.h;
    return x < 0 || y < 0 || x > STAGE.w || y > STAGE.h ? null : { x, y };
  }, []);
  useEffect(() => {
    if (screen !== 'shop') return;
    const up = (e: PointerEvent) => {
      const press = pressRef.current, run = runRef.current, ui = uiRef.current;
      pressRef.current = null;
      if (!press || !run) return;
      const p = toStage(e.clientX, e.clientY), spot = p ? spotAt(run, p.x, p.y) : null, target = asTarget(spot);
      if (ui.dragging) {
        if (ui.held && target) apply(ui.held, target);
        ui.held = null; ui.dragging = false;
      } else if (ui.held) {
        if (isHeld(spot) && same(spot, ui.held)) ui.held = null;
        else if (target && apply(ui.held, target)) ui.held = null;
        else ui.held = isHeld(spot) ? spot : null;
      } else ui.held = press.held;
      refresh();
    };
    const cancel = () => { pressRef.current = null; if (uiRef.current.dragging) { uiRef.current.dragging = false; uiRef.current.held = null; } refresh(); };
    document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
    return () => { document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); };
  }, [screen, apply, refresh, toStage]);

  // Keys: R rolls, F freezes the chosen shop slot, Space ends the turn, skips the fight or moves on.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = screenRef.current;
      if (s === 'shop' && e.code === 'KeyR') roll();
      else if (s === 'shop' && e.code === 'KeyF') freeze();
      else if (s === 'shop' && e.code === 'Space') { e.preventDefault(); endTurn(); }
      else if (s === 'fight' && e.code === 'Space') {
        e.preventDefault();
        const r = replayRef.current;
        if (r && r.i < r.outcome.events.length) skip(); else next();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [roll, freeze, endTurn, skip, next]);

  const run = runRef.current, replay = replayRef.current, held = uiRef.current.held;
  const done = !!replay && replay.i >= replay.outcome.events.length;
  const toggleMute = () => { const m = !muted; sound.setMuted(m); setMuted(m); };
  const shown = screen === 'fight' && !replay ? 'shop' : screen;

  return (
    <main className="hb-shell" data-ready={ready} data-screen={shown}>
      <header className="hb-top">
        <a className="hb-back" href="/">← Arcade</a>
        <h1>Hay Bale Brawl</h1>
        <button data-testid="mute" aria-pressed={muted} onClick={toggleMute}>{muted ? 'Sound off' : 'Sound on'}</button>
        {(screen === 'shop' || screen === 'fight') && <button data-testid="menu" onClick={() => go('title')}>Menu</button>}
      </header>

      {screen === 'title' && (
        <section className="hb-menu">
          <div className="hb-title"><Still draw={drawTitle} /></div>
          <p className="hb-small">Buy critters, line them up and watch them brawl. Win ten fights before you lose five hearts. Pick a coach to start.</p>
          <div className="hb-row">
            <button className="hb-gold" data-testid="start-dora" onClick={() => start('dora')}>Dora coaches · front friend +0/+2</button>
            <button className="hb-gold" data-testid="start-enzo" onClick={() => start('enzo')}>Enzo coaches · first roll free</button>
          </div>
          <div className="hb-row">
            {saved && <button data-testid="continue" onClick={resume}>Continue</button>}
            <button data-testid="almanac" onClick={() => go('almanac')}>Almanac</button>
          </div>
          {profile.runs > 0 && <p className="hb-small">Runs {profile.runs} · won {profile.wins} · best {profile.best} bales</p>}
        </section>
      )}

      {screen === 'almanac' && (
        <>
          <div className="hb-row" style={{ padding: '10px 16px 0', justifyContent: 'flex-start' }}>
            <button data-testid="back" onClick={() => go('title')}>← Back</button>
            <span className="hb-small">A star marks critters that were in a winning crew.</span>
          </div>
          <section className="hb-almanac">
            {UNIT_IDS.map((id) => (
              <div key={id} className="hb-card" data-testid={`almanac-unit-${id}`}>
                <Still draw={(c) => drawCritter(c, id, { x: 110, y: 20, w: 260, h: 280 }, 1)} />
                <b><span>{UNITS[id].name}</span><span className="hb-small">tier {UNITS[id].tier} · {UNITS[id].a}/{UNITS[id].h}</span></b>
                <span className="hb-small">{UNITS[id].text[0]}</span>
                {profile.won.includes(id) && <span className="hb-won">★ won a run</span>}
              </div>
            ))}
            {SNACK_IDS.map((id) => (
              <div key={id} className="hb-card" data-testid={`almanac-snack-${id}`}>
                <Still draw={(c) => drawSnack(c, id, { x: 140, y: 60, w: 200, h: 220 })} />
                <b><span>{SNACKS[id].name}</span><span className="hb-small">tier {SNACKS[id].tier}</span></b>
                <span className="hb-small">{SNACKS[id].text}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {(screen === 'shop' || screen === 'fight') && run && (
        <>
          <section className="hb-play">
            <canvas
              ref={canvasRef} className="hb-stage" data-testid="stage" aria-label="Hay Bale Brawl stage"
              onPointerDown={(e) => {
                if (screen !== 'shop') return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const p = toStage(e.clientX, e.clientY);
                if (!p) return;
                const spot = spotAt(run, p.x, p.y);
                pressRef.current = { held: isHeld(spot) ? spot : null, x0: p.x, y0: p.y };
                Object.assign(uiRef.current, { x: p.x, y: p.y, card: null });
              }}
              onPointerMove={(e) => {
                if (screen !== 'shop') return;
                const p = toStage(e.clientX, e.clientY), press = pressRef.current, ui = uiRef.current;
                if (!p) return;
                ui.x = p.x; ui.y = p.y;
                if (press?.held && !ui.dragging && Math.hypot(p.x - press.x0, p.y - press.y0) > 8) { ui.dragging = true; ui.held = press.held; }
                if (!press && e.pointerType === 'mouse') { const s = spotAt(run, p.x, p.y); ui.card = isHeld(s) ? s : null; }
              }}
              onPointerLeave={() => { uiRef.current.card = null; }}
            />
          </section>
          {screen === 'shop' && (
            <div className="hb-bar">
              <button data-testid="roll" onClick={roll} disabled={!run.freeRoll && run.acorns < 1}>Roll · {run.freeRoll ? 'free' : '1'}</button>
              <button data-testid="freeze" onClick={freeze} disabled={!held || held.from === 'line'}>Freeze</button>
              <button className="hb-gold" data-testid="end-turn" onClick={endTurn}>End turn</button>
            </div>
          )}
          {screen === 'fight' && (
            <div className="hb-bar">
              <button data-testid="speed" aria-pressed={speedRef.current === 2} onClick={() => { speedRef.current = speedRef.current === 1 ? 2 : 1; if (replayRef.current) replayRef.current.speed = speedRef.current; refresh(); }}>×{speedRef.current === 1 ? 2 : 1} speed</button>
              <button data-testid="skip" onClick={skip} disabled={done}>Skip</button>
              <button className="hb-gold" data-testid="next" onClick={next} disabled={!done}>{run.phase === 'shop' ? 'Next turn' : 'See the result'}</button>
            </div>
          )}
        </>
      )}

      {screen === 'over' && run && (
        <section className="hb-end">
          <h2>{run.phase === 'won' ? 'Ten bales!' : 'Out of hearts'}</h2>
          <p>{run.phase === 'won' ? `Your crew won the run on turn ${run.turn} with ${run.hearts} ${run.hearts === 1 ? 'heart' : 'hearts'} to spare.` : `Your crew won ${run.bales} ${run.bales === 1 ? 'bale' : 'bales'} before the hearts ran out.`}</p>
          <div className="hb-row">
            <button className="hb-gold" data-testid="again" onClick={() => start(run.coach ?? 'dora')}>Again</button>
            <button data-testid="title" onClick={() => go('title')}>Title</button>
          </div>
        </section>
      )}
    </main>
  );
}
