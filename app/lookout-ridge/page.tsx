'use client';
// Lookout Ridge: the page. One 1536 x 864 canvas, letterboxed; the title, HUD and banners are drawn on it. Keyboard
// play: arrows walk and aim, 1 2 3 or Tab pick the shot, G toggles the aim guide, hold Space to charge and let go to
// fire. Space, Enter or a click starts; after the end, Space, Enter, R or a click plays again. The engine runs at a
// fixed 60 Hz step. Rules in lib/lookout-ridge-game.ts, drawing in lib/lookout-ridge-scene.ts.
// `window.__lr` is the running engine (the same hooks as the prototype) and `window.__lookout()` returns
// { game, scene } for the browser tests; `main[data-ready="true"]` marks the art loaded and the loop running.
import { useEffect, useRef, useState } from 'react';
import { createGame, type LookoutGame, type Input } from '@/lib/lookout-ridge-game';
import { LookoutScene } from '@/lib/lookout-ridge-scene';
import './lookout-ridge.css';

const STEP = 1000 / 60;
const freshSeed = () => (7 + Math.floor(Math.random() * 1e6)) >>> 0;

export default function LookoutRidgePage() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cv = cvRef.current!;
    const g: LookoutGame = createGame(7);
    const scene = new LookoutScene(cv);
    const held: Record<string, boolean> = {};
    const start = () => g.newGame(freshSeed());

    const kd = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
      if (k === 'Tab' && g.state !== 'title' && g.state !== 'over') e.preventDefault();
      if (e.repeat && k === ' ') return;
      held[k] = true;
      if (g.state === 'title' && (k === ' ' || k === 'Enter')) { e.preventDefault(); return start(); }
      if (g.state === 'over' && g.canRestart() && (k === ' ' || k === 'Enter' || k === 'r' || k === 'R')) { e.preventDefault(); return start(); }
      if (k === 'g' || k === 'G') g.toggleGuide();
      if (k === '1' || k === '2' || k === '3') g.pickShot(+k - 1);
      if (k === 'Tab') g.cycleShot();
      if (k === ' ') g.chargeStart();
    };
    const ku = (e: KeyboardEvent) => {
      held[e.key] = false;
      if (e.key === ' ') g.chargeRelease();
    };
    const blur = () => { for (const k in held) held[k] = false; };
    const pd = () => { if (g.canRestart()) start(); };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
    cv.addEventListener('pointerdown', pd);

    const w = window as unknown as { __lr: LookoutGame; __lookout: () => { game: LookoutGame; scene: LookoutScene } };
    w.__lr = g;
    w.__lookout = () => ({ game: g, scene });

    let alive = true, raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      acc += Math.min(100, now - last); last = now;
      const input: Input = { left: !!held.ArrowLeft, right: !!held.ArrowRight, up: !!held.ArrowUp, down: !!held.ArrowDown };
      while (acc >= STEP) { g.update(input); acc -= STEP; }
      scene.draw(g);
    };
    void scene.load().then(() => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      setReady(true);
    });
    return () => {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
      cv.removeEventListener('pointerdown', pd);
    };
  }, []);

  return (
    <main className="lr-shell" data-ready={ready ? 'true' : 'false'}>
      <canvas ref={cvRef} className="lr-canvas" width={1536} height={864} aria-label="Lookout Ridge: woven ridge, play with the keyboard" />
      {!ready && <div className="lr-loading">Weaving the ridge…</div>}
      <a className="lr-back" href="/">← Arcade</a>
    </main>
  );
}
