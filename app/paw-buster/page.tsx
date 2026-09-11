/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { PawBusterGame, STAGES, WEAPONS, SAVE_KEY, MAVERICKS, NO_INPUT, VIEW_W, VIEW_H, parseProgress, saveProgress, unlocked, weaponsFor, maxHp, freshProgress, type Input, type Progress, type StageId, type BossKind, type HeroId } from '../../lib/paw-buster-game';
import { drawStage, drawBoss, drawHero } from '../../lib/paw-buster-scene';
import './paw-buster.css';

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyK: 'jump', KeyZ: 'jump',
  KeyT: 'fire', KeyJ: 'fire', KeyX: 'fire',
  KeyY: 'dash', KeyL: 'dash', KeyC: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyU: 'swap', KeyV: 'swap', KeyI: 'swap', KeyQ: 'prev', KeyE: 'next',
};
const PAD: { key: keyof Input; label: string; name: string }[] = [
  { key: 'left', label: '◀', name: 'Move left' }, { key: 'right', label: '▶', name: 'Move right' },
  { key: 'swap', label: 'TAG', name: 'Tag partner' }, { key: 'next', label: 'WPN', name: 'Next weapon' },
  { key: 'dash', label: 'DASH', name: 'Dash' }, { key: 'fire', label: 'FIRE', name: 'Fire or slash' }, { key: 'jump', label: 'JUMP', name: 'Jump' },
];
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

function Sprite({ boss, hero, scale = 1.45 }: { boss?: BossKind; hero?: HeroId; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 128, 96);
    c.save();
    c.translate(64, 88);
    c.scale(scale, scale);
    if (boss) drawBoss(c, boss, 0.4);
    if (hero) drawHero(c, hero, { charge: hero === 'dora' ? 1 : 0 });
    c.restore();
  }, [boss, hero, scale]);
  return <canvas ref={ref} width={128} height={96} aria-hidden="true" className="pb-sprite" />;
}

export default function PawBuster() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<PawBusterGame | null>(null);
  const keys = useRef<Input>({ ...NO_INPUT });
  const touch = useRef<Input>({ ...NO_INPUT });
  const latch = useRef<Input>({ ...NO_INPUT });
  const sound = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const [run, setRun] = useState(0);
  const [, setFrame] = useState(0);
  const [audible, setAudible] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState(false);
  const g = game.current;

  // Stage buttons stay disabled until the page is interactive and the save has been read.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { try { setProgress(parseProgress(localStorage.getItem(SAVE_KEY))); } catch {} setLoaded(true); }, []);
  const persist = (p: Progress) => { setProgress({ ...p, cleared: [...p.cleared], tanks: [...p.tanks], best: { ...p.best } }); try { localStorage.setItem(SAVE_KEY, saveProgress(p)); } catch {} };

  function tone(event: string) {
    if (!sound.current) return;
    const cue: Record<string, [number, number, OscillatorType, number]> = {
      shot: [900, 1300, 'square', 0.05], blast: [300, 1200, 'sawtooth', 0.22], slash: [500, 1500, 'triangle', 0.08], deflect: [1600, 2200, 'square', 0.05],
      jump: [420, 620, 'square', 0.06], dash: [200, 90, 'sawtooth', 0.1], hurt: [260, 90, 'sawtooth', 0.18], kill: [700, 120, 'square', 0.14],
      hit: [600, 400, 'square', 0.04], weak: [1200, 300, 'square', 0.16], swap: [520, 1040, 'triangle', 0.14], pickup: [880, 1320, 'sine', 0.1],
      tank: [660, 1760, 'sine', 0.4], warning: [220, 220, 'square', 0.5], 'boss-down': [400, 60, 'sawtooth', 0.8], clear: [523, 1046, 'triangle', 0.6],
      charge1: [300, 500, 'sine', 0.12], charge2: [500, 900, 'sine', 0.14], lost: [300, 80, 'triangle', 0.7], checkpoint: [700, 1050, 'sine', 0.16], weapon: [800, 1000, 'square', 0.05],
    };
    const c = cue[event];
    if (!c) return;
    try {
      audio.current ??= new AudioContext();
      const a = audio.current, o = a.createOscillator(), v = a.createGain(), t = a.currentTime;
      void a.resume();
      o.type = c[2];
      o.frequency.setValueAtTime(c[0], t);
      o.frequency.exponentialRampToValueAtTime(c[1], t + c[3]);
      v.gain.setValueAtTime(0.03, t);
      v.gain.exponentialRampToValueAtTime(0.001, t + c[3] + 0.04);
      o.connect(v); v.connect(a.destination); o.start(); o.stop(t + c[3] + 0.05);
    } catch {}
  }

  function start(id: StageId) {
    game.current = new PawBusterGame(id, progress);
    keys.current = { ...NO_INPUT };
    touch.current = { ...NO_INPUT };
    setConfirmReset(false);
    setAnnounce(`${game.current.stage.name}. Ready.`);
    setRun((n) => n + 1);
  }
  function leave() { game.current = null; setRun((n) => n + 1); }
  function pause() { game.current?.pause(); setFrame((n) => n + 1); canvas.current?.focus(); }
  function retry() { game.current?.retry(); setFrame((n) => n + 1); canvas.current?.focus(); }

  useEffect(() => {
    if (!game.current) return;
    const c = canvas.current?.getContext('2d');
    if (!c) { setError(true); return; }
    canvas.current?.focus();
    let raf = 0, last = 0, acc = 0, ui = 0, banner = '';
    const loop = (now: number) => {
      const gm = game.current;
      if (!gm) return;
      acc += last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      // A tap shorter than a frame still counts: latched presses last until one step has seen them.
      const k = keys.current, t = touch.current, l = latch.current;
      const held = () => Object.fromEntries((Object.keys(NO_INPUT) as (keyof Input)[]).map((key) => [key, k[key] || t[key] || l[key]])) as Input;
      while (acc >= 1 / 120) { gm.step(1 / 120, held()); latch.current = { ...NO_INPUT }; acc -= 1 / 120; }
      for (const e of gm.events.splice(0)) { tone(e); if (e === 'tank' || e === 'clear') persist(gm.progress); }
      if (gm.banner.text !== banner && gm.banner.t > 0) { banner = gm.banner.text; setAnnounce(banner); }
      drawStage(c, gm, now / 1000);
      if (now - ui > 100) { setFrame((n) => n + 1); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const typing = (e: Event) => !!(e.target as HTMLElement).closest('input,textarea,select');
    const down = (e: KeyboardEvent) => {
      const gm = game.current;
      if (!gm || typing(e)) return;
      if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) pause(); return; }
      if (e.code === 'Enter' && gm.state === 'lost' && !(e.target as HTMLElement).closest('button')) { e.preventDefault(); retry(); return; }
      const key = KEYS[e.code];
      if (!key) return;
      if ((e.target as HTMLElement).closest('button,a') && (e.code === 'Space')) return;
      e.preventDefault();
      keys.current[key] = true;
      if (!e.repeat) latch.current[key] = true;
    };
    const up = (e: KeyboardEvent) => { const key = KEYS[e.code]; if (key) keys.current[key] = false; };
    const blur = () => { keys.current = { ...NO_INPUT }; const gm = game.current; if (gm && (gm.state === 'play' || gm.state === 'boss')) { gm.pause(); setFrame((n) => n + 1); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [run]);
  useEffect(() => () => { void audio.current?.close(); audio.current = null; }, []);

  const press = (key: keyof Input, on: boolean) => { touch.current[key] = on; if (on) latch.current[key] = true; };
  const tanks = progress.tanks.length, arsenal = weaponsFor(progress);
  const clearedAll = MAVERICKS.every((s) => progress.cleared.includes(s));
  const stage = g?.stage;

  return (
    <main className="pb-shell">
      <header className="pb-header">
        <a href="/">← MAIN ARCADE <span>PAW BUSTER X</span></a>
        <div className="pb-header-tools">
          {g && <button type="button" onClick={leave}>Stage select</button>}
          <button type="button" aria-pressed={audible} onClick={() => { sound.current = !sound.current; setAudible(sound.current); tone('pickup'); }}>Sound {audible ? 'on' : 'off'}</button>
        </div>
      </header>
      <p className="pb-sr" aria-live="polite">{announce}</p>

      {!g && (
        <section className="pb-select" aria-labelledby="pb-select-title">
          <div className="pb-intro">
            <div className="pb-heroes"><Sprite hero="dora" /><Sprite hero="enzo" /></div>
            <div>
              <p className="pb-eyebrow">A MEGA MAN X-STYLE ACTION PLATFORMER</p>
              <h1 id="pb-select-title">Paw Buster X</h1>
              <p className="pb-lede">Three mavericks have taken the Andes. <b>Dora</b> charges her paw buster, <b>Enzo</b> swings his whisker saber, and the two tag in and out. Beat a maverick to take its weapon, then find the boss it’s weak to.</p>
            </div>
          </div>
          <h2 className="pb-section">Choose a stage</h2>
          <div className="pb-stages">
            {STAGES.map((s) => {
              const open = unlocked(progress, s.id), done = progress.cleared.includes(s.id), best = progress.best[s.id];
              return (
                <button key={s.id} type="button" className={`pb-stage stage-${s.id}${done ? ' done' : ''}`} disabled={!loaded || !open} onClick={() => start(s.id)} data-testid={`stage-${s.id}`}>
                  <Sprite boss={s.boss} />
                  <strong>{s.bossName}</strong>
                  <span>{s.name}</span>
                  <small>{!open ? '🔒 Defeat the three mavericks to open' : s.blurb}</small>
                  <em>
                    {done ? `✓ Cleared${best ? ` · best ${clock(best)}` : ''}` : open ? 'Not yet cleared' : 'Locked'}
                    {progress.tanks.includes(s.id) && ' · ♥ tank'}
                    {done && s.weapon && ` · ${WEAPONS[s.weapon].name}`}
                  </em>
                </button>
              );
            })}
          </div>
          <div className="pb-summary">
            <p data-testid="summary">♥ Heart tanks {tanks}/3 · Max health {maxHp(progress)} · Weapons: {arsenal.map((w) => WEAPONS[w].name).join(', ')}{clearedAll && progress.cleared.includes('citadel') ? ' · The Andes are safe!' : ''}</p>
            <button type="button" className="pb-reset" disabled={!progress.cleared.length && !tanks} onClick={() => { if (confirmReset) { persist(freshProgress()); setConfirmReset(false); } else setConfirmReset(true); }}>{confirmReset ? 'Press again to erase progress' : 'Reset progress'}</button>
          </div>
          <Controls />
        </section>
      )}

      {g && stage && (
        <section className="pb-board" aria-label="Paw Buster X game">
          <div className="pb-canvas-wrap" data-testid="board" data-state={g.state} data-hero={g.hero} data-x={Math.round(g.player.x)} data-weapon={g.weaponId}>
            <canvas ref={canvas} width={VIEW_W} height={VIEW_H} tabIndex={0} aria-label={`${stage.name}. Move with arrows or A and D, jump with Space, K or Z, fire with T, J or X, dash with Y, L, C or Shift, tag with U, V or I.`} />
            {(g.state === 'paused' || g.state === 'lost' || g.state === 'clear' || error) && (
              <div className="pb-overlay">
                <div>
                  {error && <><p className="pb-eyebrow">CANVAS UNAVAILABLE</p><h2>Please try another browser.</h2></>}
                  {g.state === 'paused' && <>
                    <p className="pb-eyebrow">PAUSED · {stage.name.toUpperCase()}</p>
                    <h2>Take a breather.</h2>
                    <ul className="pb-arsenal">
                      {g.weapons.map((w) => <li key={w} className={w === g.weaponId ? 'on' : ''}><b style={{ color: WEAPONS[w].color }}>{WEAPONS[w].name}</b>{w !== 'buster' && <span> · {g.energy[w]}/28</span>}<small>{WEAPONS[w].detail}</small></li>)}
                    </ul>
                    <div className="pb-actions"><button type="button" className="pb-primary" onClick={pause}>Resume</button><button type="button" onClick={leave}>Stage select</button></div>
                  </>}
                  {g.state === 'lost' && <>
                    <p className="pb-eyebrow">BOTH HEROES ARE DOWN</p>
                    <h2>One more try?</h2>
                    <p>You’ll restart {g.checkpoint >= 0 ? 'at the last checkpoint' : 'from the start'} with full health.</p>
                    <div className="pb-actions"><button type="button" className="pb-primary" onClick={retry}>Retry from checkpoint</button><button type="button" onClick={leave}>Stage select</button></div>
                  </>}
                  {g.state === 'clear' && <>
                    <p className="pb-eyebrow">{g.victory ? 'MISSION COMPLETE' : `${stage.bossName.toUpperCase()} DEFEATED`}</p>
                    <h2>{g.victory ? 'The Andes are safe!' : stage.weapon ? `Weapon get: ${WEAPONS[stage.weapon].name}` : 'Stage clear'}</h2>
                    <p>{g.victory ? 'The Cougar Kingpin is beaten. Dora and Enzo head home for a well-earned dust bath.' : stage.weapon ? WEAPONS[stage.weapon].detail + ' Press Q or E to switch weapons.' : ''}</p>
                    <p className="pb-time">Time {clock(g.time)}{g.newBest ? ' · new best!' : ''}</p>
                    <div className="pb-actions"><button type="button" className="pb-primary" onClick={leave}>Stage select</button></div>
                  </>}
                </div>
              </div>
            )}
          </div>
          <p className="pb-status" data-testid="status">{g.status}</p>
          <p className="pb-rotate">Turn your phone sideways for a bigger view.</p>
          <div className="pb-pad">
            {PAD.map((b) => (
              <button key={b.key} type="button" className={`pad-${b.key}`} aria-label={b.name}
                onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); press(b.key, true); }}
                onPointerUp={() => press(b.key, false)} onPointerCancel={() => press(b.key, false)} onLostPointerCapture={() => press(b.key, false)}
                onContextMenu={(e) => e.preventDefault()}>{b.label}</button>
            ))}
          </div>
          <div className="pb-bar">
            <button type="button" onClick={pause} disabled={!['play', 'boss', 'paused'].includes(g.state)}>{g.state === 'paused' ? '▶ Resume' : 'Ⅱ Pause'}</button>
            <span>Weakness hint: every maverick flinches from the weapon of another.</span>
          </div>
          <Controls />
        </section>
      )}
    </main>
  );
}

function Controls() {
  return (
    <dl className="pb-controls">
      <div><dt><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd></dt><dd>Move</dd></div>
      <div><dt><kbd>Space</kbd> / <kbd>K</kbd> / <kbd>Z</kbd></dt><dd>Jump; hold for height. Jump against a wall to wall-jump.</dd></div>
      <div><dt><kbd>T</kbd> / <kbd>J</kbd> / <kbd>X</kbd></dt><dd>Fire. Dora: hold to charge. Enzo: saber slash.</dd></div>
      <div><dt><kbd>Y</kbd> / <kbd>L</kbd> / <kbd>C</kbd> / <kbd>Shift</kbd></dt><dd>Dash; hold while jumping to dash-jump.</dd></div>
      <div><dt><kbd>U</kbd> / <kbd>V</kbd> / <kbd>I</kbd></dt><dd>Tag your partner in (tag strike: ×1.5 damage for 2 s)</dd></div>
      <div><dt><kbd>Q</kbd> / <kbd>E</kbd></dt><dd>Switch weapon</dd></div>
      <div><dt><kbd>P</kbd> / <kbd>Esc</kbd></dt><dd>Pause</dd></div>
    </dl>
  );
}
