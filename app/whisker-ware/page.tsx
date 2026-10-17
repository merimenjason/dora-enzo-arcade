/* oxlint-disable react/react-compiler -- The run is a mutable engine object stepped by the loop, like the other arcade games. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation back to the menu. */
'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Run, MICROS, MICRO_IDS, HOSTS, SPEEDS, loadProfile, record, unlocked, type Frame, type Mode, type MicroId, type Level, type Profile } from '../../lib/whisker-ware-game';
import { drawStage, drawCard, STAGE } from '../../lib/whisker-ware-scene';
import { paintWareTitle, prefetchWareMenu, prefetchWareHost, prefetchWareGame, subscribeWareArt, wareArtVersion, wareArtServerVersion, wareArtStatus, retryWareArt } from '../../lib/whisker-ware-paint';
import { drawChinchilla } from '../../lib/chinchilla-art';
import { sound } from './sound';
import './whisker-ware.css';

const PROFILE_KEY = 'whisker-ware-v1', TICK = 1000 / 60, MAX_TICKS = 4;
const HOST_KEYS = ['enzo', 'dora', 'owl', 'fox'] as const;
const speed = (tier: number) => `×${SPEEDS[tier].toFixed(Number.isInteger(SPEEDS[tier] * 10) ? 1 : 2)}`;
const readProfile = (): Profile => { try { return loadProfile(localStorage.getItem(PROFILE_KEY)); } catch { return loadProfile(null); } };
const writeProfile = (p: Profile) => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* private window: nothing is kept */ } };

/**
 * What the player is doing right now, read once per real tick. A press or tap shorter than a tick is latched so the
 * game still sees it; a number key is a pick for exactly one tick.
 */
class Controls {
  x = -1; y = -1;
  private keys = new Set<string>();
  private latched = new Set<string>();
  private pointer = false;
  private tapped = false;
  private picked: Frame['pick'] = 0;
  key(code: string, down: boolean) {
    if (down) { this.keys.add(code); this.latched.add(code); } else this.keys.delete(code);
    if (down && (code === 'Digit1' || code === 'Digit2' || code === 'Digit3')) this.picked = Number(code.slice(5)) as 1 | 2 | 3;
  }
  press(x: number, y: number) { this.x = x; this.y = y; this.pointer = true; this.tapped = true; }
  move(x: number, y: number) { this.x = x; this.y = y; }
  release(touch: boolean) { this.pointer = false; if (touch) { this.x = -1; this.y = -1; } }
  clear() { this.keys.clear(); this.latched.clear(); this.pointer = this.tapped = false; this.picked = 0; }
  frame(): Frame {
    const on = (code: string) => this.keys.has(code) || this.latched.has(code);
    const f: Frame = {
      x: this.x, y: this.y, down: this.pointer || this.tapped || on('Space'),
      left: on('ArrowLeft'), right: on('ArrowRight'), up: on('ArrowUp'), dn: on('ArrowDown'), pick: this.picked,
    };
    this.latched.clear(); this.tapped = false; this.picked = 0;
    return f;
  }
}

/** A canvas drawn once per art arrival. */
function Still({ draw, className, testId }: { draw: (c: CanvasRenderingContext2D) => void; className?: string; testId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const version = useSyncExternalStore(subscribeWareArt, wareArtVersion, wareArtServerVersion);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (c) { c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 480, 320); draw(c); } }, [version, draw]);
  return <canvas ref={ref} width={960} height={640} className={className} data-testid={testId} aria-hidden="true" />;
}
const drawTitle = (c: CanvasRenderingContext2D) => {
  if (paintWareTitle(c, { x: 0, y: 0, w: 480, h: 320 })) return;
  const g = c.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#5a3a7a'); g.addColorStop(1, '#241a33'); c.fillStyle = g; c.fillRect(0, 0, 480, 320);
  drawChinchilla(c, 'dora', 150, 280, { face: 1, h: 110, time: 0.4 });
  drawChinchilla(c, 'enzo', 330, 280, { face: -1, h: 110, time: 0.9 });
};

export default function WhiskerWare() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(() => readProfile());
  const [screen, setScreen] = useState<'menu' | 'gallery' | 'play'>('menu');
  const [phase, setPhase] = useState<string>('menu');
  const [muted, setMuted] = useState(false);
  const [, setArtFailed] = useState(0);
  const runRef = useRef<Run | null>(null);
  const profileRef = useRef(profile);
  const mainRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef(new Controls());
  profileRef.current = profile;

  const save = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const next = record(profileRef.current, run);
    profileRef.current = next; setProfile(next); writeProfile(next);
  }, []);

  const start = useCallback((mode: Mode, opt: { host?: number; game?: MicroId } = {}, seed = (Math.random() * 2 ** 31) | 0) => {
    save();
    const run = new Run(mode, seed, opt);
    runRef.current = run;
    if (mode === 'host') prefetchWareHost(HOST_KEYS[opt.host ?? 0]);
    if (run.game) prefetchWareGame(run.game);
    controls.current.clear();
    setScreen('play'); setPhase(run.phase);
  }, [save]);

  const quit = useCallback(() => { save(); runRef.current = null; setScreen('menu'); setPhase('menu'); }, [save]);

  useEffect(() => {
    prefetchWareMenu();
    setMuted(sound.muted());
    setReady(true);
    const keep = () => save();
    window.addEventListener('pagehide', keep);
    return () => { window.removeEventListener('pagehide', keep); save(); };
  }, [save]);
  useEffect(() => subscribeWareArt(() => setArtFailed(wareArtStatus().failed.length)), []);

  useEffect(() => {
    (window as unknown as { __ware?: () => unknown }).__ware = () => ({
      run: runRef.current, profile: profileRef.current, ids: MICRO_IDS, start,
      force: (id: MicroId, level: Level, tier: number) => { runRef.current?.force(id, level, tier); },
      stage: () => { const r = canvasRef.current?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; },
    });
  });

  // The canvas fills the largest 3:2 box below the bar, at the screen's pixel density.
  useEffect(() => {
    if (screen !== 'play') return;
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

  // The loop: real ticks at 60 a second, at most four per animation frame, and none while the tab is hidden.
  useEffect(() => {
    if (screen !== 'play') return;
    let raf = 0, last = performance.now(), acc = 0, quarter = -1, wasDown = false;
    const shown = () => { last = performance.now(); acc = 0; };
    document.addEventListener('visibilitychange', shown);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const run = runRef.current, canvas = canvasRef.current;
      if (!run || !canvas) return;
      if (document.hidden) { last = now; acc = 0; return; }
      acc = Math.min(acc + (now - last), TICK * MAX_TICKS); last = now;
      for (let n = 0; n < MAX_TICKS && acc >= TICK; n++) {
        acc -= TICK;
        const f = controls.current.frame();
        if (run.phase === 'micro' && f.down && !wasDown) sound.cue('blip');
        wasDown = f.down;
        run.step(f);
        for (const e of run.drain()) {
          if (e === 'command') { sound.cue('command'); quarter = -1; }
          else if (e === 'win' || e === 'lose' || e === 'speedup' || e === 'boss') sound.cue(e);
          else { sound.cue(e); save(); }
        }
        if (run.phase === 'break' && run.t === 1 && run.game) prefetchWareGame(run.game);
        if (run.phase === 'micro' && run.state) {
          const q = Math.floor((run.state.t / MICROS[run.game!]!.ticks) * 4);
          if (q !== quarter && q > 0 && q < 4) sound.cue('tick', run.tier);
          quarter = q;
        }
      }
      if (mainRef.current && mainRef.current.dataset.phase !== run.phase) { mainRef.current.dataset.phase = run.phase; setPhase(run.phase); }
      const c = canvas.getContext('2d')!;
      c.setTransform(canvas.width / STAGE.w, 0, 0, canvas.height / STAGE.h, 0, 0);
      drawStage(c, run, now);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', shown); };
  }, [screen, save]);

  // Keys go to the game only while one is running.
  useEffect(() => {
    if (screen !== 'play') return;
    const use = (e: KeyboardEvent) => ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Digit1', 'Digit2', 'Digit3'].includes(e.code);
    const down = (e: KeyboardEvent) => { if (!use(e)) return; e.preventDefault(); if (!e.repeat) controls.current.key(e.code, true); };
    const up = (e: KeyboardEvent) => { if (use(e)) controls.current.key(e.code, false); };
    const blur = () => controls.current.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    // a pointer let go anywhere, even off the canvas, lets go of the game
    const release = (e: PointerEvent) => controls.current.release(e.pointerType !== 'mouse');
    document.addEventListener('pointerup', release); document.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      document.removeEventListener('pointerup', release); document.removeEventListener('pointercancel', release);
    };
  }, [screen]);

  const toStage = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * STAGE.w, ((e.clientY - r.top) / r.height) * STAGE.h] as const;
  };
  const open = unlocked(profile), run = runRef.current;
  const toggleMute = () => { const m = !muted; sound.setMuted(m); setMuted(m); };
  const failed = ready ? wareArtStatus().failed.length : 0;

  return (
    <main ref={mainRef} className="ww-shell" data-ready={ready} data-phase={screen === 'play' ? run?.phase ?? 'menu' : screen === 'gallery' ? 'gallery' : 'menu'}>
      <header className="ww-top">
        <a className="ww-back" href="/">← Arcade</a>
        <h1>Whisker Ware</h1>
        {failed > 0 && <button data-testid="retry-art" onClick={() => retryWareArt()}>Retry art</button>}
        <button data-testid="mute" aria-pressed={muted} onClick={toggleMute}>{muted ? 'Sound off' : 'Sound on'}</button>
        {screen === 'play' && <button data-testid="quit" onClick={quit}>Menu</button>}
      </header>

      {screen === 'menu' && (
        <section className="ww-menu">
          <div className="ww-title"><Still draw={drawTitle} /></div>
          <p className="ww-small">Each microgame lasts a few seconds. Tap, click or use Space, the arrows and 1–3. Four hay cubes; lose them all and it’s over.</p>
          <div className="ww-hosts">
            {HOSTS.map((h, k) => (
              <button key={h.id} className={`ww-host${k === 0 || open.hosts[k] ? ' ww-gold' : ''}`} data-testid={`host-${k}`} disabled={!open.hosts[k]} onClick={() => start('host', { host: k })}>
                <b>{h.stage}</b>
                <span className="ww-small">{profile.hosts > k ? 'Cleared' : open.hosts[k] ? 'Play' : `Clear ${HOSTS[k - 1].name}’s stage first`}</span>
              </button>
            ))}
          </div>
          <div className="ww-row">
            <button data-testid="remix" disabled={!open.remix} onClick={() => start('remix')}>Remix{profile.remixBest ? ` · best ${profile.remixBest}` : ''}</button>
            <button data-testid="gallery" onClick={() => { setScreen('gallery'); setPhase('gallery'); }}>Gallery &amp; practice</button>
          </div>
          {!open.remix && <p className="ww-small">Remix opens once all four stages are cleared.</p>}
        </section>
      )}

      {screen === 'gallery' && (
        <>
          <div className="ww-row" style={{ padding: '10px 16px 0' }}>
            <button data-testid="back" onClick={() => { setScreen('menu'); setPhase('menu'); }}>← Back</button>
            <span className="ww-small">Win a microgame anywhere to practise it here.</span>
          </div>
          <section className="ww-gallery">
            {MICRO_IDS.map(id => {
              const best = profile.games[id], won = best && best.tier >= 0;
              return (
                <div key={id} className="ww-card" data-testid={`card-${id}`}>
                  <Still draw={c => drawCard(c, id, { x: 0, y: 0, w: 480, h: 320 }, won ? best.tier : null)} />
                  <div><span>{won ? MICROS[id]!.verb : '???'}</span><span className="ww-small">{won ? speed(best.tier) : ''}</span></div>
                  {won && best.streak > 0 && <span className="ww-small">Best streak {best.streak}</span>}
                  <button data-testid={`practice-${id}`} disabled={!won} onClick={() => start('practice', { game: id })}>Practice</button>
                </div>
              );
            })}
          </section>
        </>
      )}

      {screen === 'play' && (
        <section className="ww-play">
          <canvas
            ref={canvasRef} className="ww-stage" data-testid="stage" aria-label="Whisker Ware stage"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = toStage(e); controls.current.press(x, y); }}
            onPointerMove={e => { const [x, y] = toStage(e); controls.current.move(x, y); }}
            onPointerLeave={e => { if (e.pointerType !== 'mouse') controls.current.release(true); }}
          />
          {(phase === 'over' || phase === 'clear') && run && (
            <div className="ww-end">
              <button className="ww-gold" data-testid="again" onClick={() => start(run.mode, { host: run.host, game: run.game ?? undefined })}>Again</button>
              {phase === 'clear' && run.host < 3 && <button data-testid="next" onClick={() => start('host', { host: run.host + 1 })}>Next stage</button>}
              <button data-testid="to-menu" onClick={quit}>Menu</button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
