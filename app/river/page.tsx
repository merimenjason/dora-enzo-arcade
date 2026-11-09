'use client';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DEFAULT_OPTIONS, newRiverSave, readRiverSave, RiverGame, SAVE_KEY, type Difficulty, type RiverInput } from '../../lib/river-game';
import { loadRiverArt, RiverScene } from '../../lib/river-scene';
import { DISTRICTS, REACHES } from '../../lib/river-world';
import { RiverSound } from './sound';
import './river.css';

const KEY_OPTIONS = 'river-remembers-controls-v1';
const DEFAULT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', use: 'KeyE', skill: 'KeyF', jump: 'Space', tag: 'KeyQ', pause: 'Escape' };
const LABELS = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', use: 'Use', skill: 'Brace / pole', jump: 'Hop', tag: 'Tag', pause: 'Pause' };
type Action = keyof typeof DEFAULT_KEYS;
type Settings = { keys: typeof DEFAULT_KEYS; assist: boolean; difficulty: Difficulty; music: boolean; sound: boolean; reduce: boolean };
type Screen = 'title' | 'play' | 'pause' | 'chart' | 'settings' | 'help' | 'clear' | 'fall' | 'ending' | 'spring';
type Toggle = 'assist' | 'music' | 'sound' | 'reduce';
const fresh = (): Settings => ({ keys: { ...DEFAULT_KEYS }, ...DEFAULT_OPTIONS, music: true, sound: true, reduce: false });
const inputZero: RiverInput = { x: 0, y: 0 };
const inputCodes = /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Escape|Space|Enter|Bracket(Left|Right)|Shift(Left|Right))$/;
const display = (code: string) => ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', Space: 'Space' })[code as 'Space'] ?? code.replace(/^Key|^Digit|Left$|Right$/g, '');
function readSettings(): Settings {
  const next = fresh();
  try {
    const data = JSON.parse(localStorage.getItem(KEY_OPTIONS) ?? 'null');
    if (!data) return next;
    for (const k of ['assist', 'music', 'sound', 'reduce'] as const) if (typeof data[k] === 'boolean') next[k] = data[k];
    if (['story', 'standard', 'expert'].includes(data.difficulty)) next.difficulty = data.difficulty;
    const keys = Object.keys(DEFAULT_KEYS) as Action[];
    if (keys.every(k => typeof data.keys?.[k] === 'string' && inputCodes.test(data.keys[k])) &&
      new Set(keys.map(k => data.keys[k])).size === keys.length) next.keys = data.keys;
  } catch { /* a broken preference falls back to the default controls */ }
  return next;
}

export default function RiverPage() {
  const [screen, setScreen] = useState<Screen>('title');
  const [returnScreen, setReturnScreen] = useState<Screen>('title');
  const [settings, setSettings] = useState(fresh);
  const [capture, setCapture] = useState<Action>();
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [artError, setArtError] = useState(false);
  const [loading, setLoading] = useState(0);
  const [hasSave, setHasSave] = useState(false);
  const [control, setControl] = useState<'keys' | 'pad' | 'touch'>('keys');
  const inputMode = useRef<'keys' | 'pad' | 'touch'>('keys');
  function showControls(next: 'keys' | 'pad' | 'touch') {
    if (inputMode.current !== next) { inputMode.current = next; setControl(next); }
  }
  const [, render] = useState(0);
  const game = useRef<RiverGame | null>(null);
  const scene = useRef<RiverScene | null>(null);
  const audio = useRef<RiverSound | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const held = useRef(new Set<string>());
  const taps = useRef(new Set<Action>());
  const aim = useRef({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const runtime = useRef({ screen, settings, capture, returnScreen });
  runtime.current = { screen, settings, capture, returnScreen };

  function saveGame() {
    try {
      if (game.current) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(game.current.save));
        setHasSave(true);
      }
    } catch { setMessage('This browser could not keep your progress.'); }
  }

  useEffect(() => {
    const loaded = readSettings();
    setSettings(loaded);
    let raw: string | null = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { /* the game can be played without storage */ }
    const save = readRiverSave(raw);
    game.current = new RiverGame(save, loaded);
    setHasSave(!!raw);
    audio.current = new RiverSound();
    const mq = matchMedia('(pointer: coarse)');
    const check = () => showControls(mq.matches ? 'touch' : 'keys');
    check();
    mq.addEventListener('change', check);
    return () => { mq.removeEventListener('change', check); audio.current?.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    loadRiverArt().then(
      (art) => { if (active) { scene.current = new RiverScene(art); setReady(true); setArtError(false); } },
      () => { if (active) { setArtError(true); setReady(false); } },
    );
    return () => { active = false; };
  }, [loading]);

  useEffect(() => {
    if (!game.current || !ready) return;
    Object.assign(game.current.options, { assist: settings.assist, difficulty: settings.difficulty });
    game.current.hearts = Math.min(game.current.hearts, game.current.healthMax);
    if (audio.current) { audio.current.effects = settings.sound; audio.current.music = settings.music; }
    try { localStorage.setItem(KEY_OPTIONS, JSON.stringify(settings)); } catch { /* settings still apply for this session */ }
  }, [ready, settings]);

  useEffect(() => {
    const el = field.current;
    const cnv = canvas.current;
    if (!el || !cnv) return;
    const resize = () => {
      const ratio = el.clientWidth / Math.max(el.clientHeight, 1);
      cnv.height = ratio > 1.3 ? 232 : 272;
      cnv.width = Math.min(720, Math.max(204, Math.round(cnv.height * ratio)));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => observer.disconnect();
  }, [screen === 'title']);

  useEffect(() => {
    function down(event: KeyboardEvent) {
      const { screen, settings, capture } = runtime.current;
      const code = event.code;
      if (capture) {
        event.preventDefault();
        if (code === 'Escape') { setCapture(undefined); setMessage('Binding cancelled.'); return; }
        if (!inputCodes.test(code)) { setMessage('Choose an arrow, letter, number or action key.'); return; }
        if ((Object.keys(settings.keys) as Action[]).some(k => k !== capture && settings.keys[k] === code)) {
          setMessage('That key is already assigned.'); return;
        }
        setSettings({ ...settings, keys: { ...settings.keys, [capture]: code } });
        setCapture(undefined);
        setMessage(`${LABELS[capture]} now uses ${display(code)}.`);
        return;
      }
      if (screen !== 'play' && screen !== 'pause') return;
      if (screen === 'pause' && code !== settings.keys.pause) return;
      if (!(Object.values(settings.keys) as string[]).includes(code) && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) return;
      event.preventDefault();
      showControls('keys');
      if (event.repeat) return;
      void audio.current?.ready();
      if (code === settings.keys.pause) {
        held.current.clear();
        setScreen(screen === 'play' ? 'pause' : 'play');
      } else {
        held.current.add(code);
        for (const action of ['use', 'jump', 'skill', 'tag'] as const) if (settings.keys[action] === code) taps.current.add(action);
      }
    }
    const up = (event: KeyboardEvent) => held.current.delete(event.code);
    const blur = () => {
      held.current.clear();
      taps.current.clear();
      aim.current = { x: 0, y: 0 };
      pointer.current = null;
      if (runtime.current.screen === 'play') setScreen('pause');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    let frame = 0, last = 0, carry = 0, displayTick = 0, padButtons: boolean[] = [];
    const draw = (now: number) => {
      const g = game.current;
      const { screen, settings } = runtime.current;
      const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
      const buttons = pad?.buttons.map(b => b.pressed) ?? [];
      if (pad && (buttons.some(Boolean) || pad.axes.some(axis => Math.abs(axis) > .22))) showControls('pad');
      const pressed = (n: number) => !!buttons[n] && !padButtons[n];
      if (pad && screen !== 'play') {
        const section = root.current?.querySelector('[data-panel]');
        const items = Array.from(section?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (items.length && (pressed(12) || pressed(13))) items[(index < 0 ? 0 : (index + (pressed(12) ? -1 : 1) + items.length) % items.length)].focus();
        if (pressed(0) || pressed(9)) (items[index] ?? items[0])?.click();
      }
      if (g && screen === 'play') {
        if (pressed(9)) setScreen('pause');
        const key = (act: Action) => held.current.has(settings.keys[act]);
        const alt = (code: string) => !Object.values(settings.keys).includes(code) && held.current.has(code);
        const x = Number(key('right') || alt('KeyD') || buttons[15]) - Number(key('left') || alt('KeyA') || buttons[14]);
        const y = Number(key('down') || alt('KeyS') || buttons[13]) - Number(key('up') || alt('KeyW') || buttons[12]);
        const axis = (n: number) => Math.abs(n) > .19 ? n : 0;
        carry += last ? Math.min(55, now - last) : 16;
        while (carry >= 1000 / 60) {
          carry -= 1000 / 60;
          g.step({
            x: x || aim.current.x || axis(pad?.axes[0] ?? 0),
            y: y || aim.current.y || axis(pad?.axes[1] ?? 0),
            use: taps.current.has('use') || key('use') || buttons[0],
            jump: taps.current.has('jump') || key('jump') || buttons[1],
            skill: taps.current.has('skill') || key('skill') || buttons[2],
            tag: taps.current.has('tag') || key('tag') || buttons[3] || buttons[4],
          });
          taps.current.clear();
          for (const e of g.events.filter(e => e.tick === g.tick)) {
            audio.current?.play(e.kind);
            if (e.kind === 'clear' || e.kind === 'mark') saveGame();
          }
          if (g.clear || g.fall) {
            setScreen(g.fall ? 'fall' : g.ending ? 'ending' : g.save.spring && g.save.springCleared.length >= 6 ? 'spring' : 'clear');
            carry = 0;
            break;
          }
        }
        audio.current?.score(g.room.district);
        if (now - displayTick > 65) { displayTick = now; render(n => n + 1); }
      } else { carry = 0; }
      if (g && canvas.current && scene.current) scene.current.draw(canvas.current, g, settings.reduce);
      padButtons = buttons;
      last = now;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    Object.assign(window, { __river: () => ({ game: game.current, screen: runtime.current.screen, settings: runtime.current.settings }) });
    return () => { delete (window as unknown as Record<string, unknown>).__river; };
  }, []);

  function start(restart: boolean) {
    if (!ready) return;
    void audio.current?.ready();
    if (restart) game.current = new RiverGame(newRiverSave(), settings);
    else if (game.current?.clear || game.current?.fall) game.current.enter(game.current.save.room);
    held.current.clear();
    taps.current.clear();
    setScreen('play');
    saveGame();
  }
  function change(index: number) {
    if (!game.current?.enter(index)) return;
    void audio.current?.ready();
    held.current.clear();
    taps.current.clear();
    saveGame();
    setScreen('play');
  }
  function open(next: Screen) {
    setReturnScreen(screen);
    setMessage('');
    setCapture(undefined);
    setScreen(next);
  }
  function back() { setCapture(undefined); setMessage(''); setScreen(returnScreen); }
  function moveStick(e: ReactPointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== e.pointerId) return;
    const dx = e.clientX - current.x, dy = e.clientY - current.y;
    const max = Math.max(23, Math.hypot(dx, dy));
    aim.current = { x: dx / max, y: dy / max };
  }
  function releaseStick() { pointer.current = null; aim.current = { x: 0, y: 0 }; }
  const g = game.current;
  const prompt = g?.prompt();
  const controller: Record<Action, string> = { up: 'Stick up', down: 'Stick down', left: 'Stick left', right: 'Stick right', use: 'A', skill: 'X', jump: 'B', tag: 'Y', pause: 'Start' };
  const key = (a: Action) => control === 'touch' ? LABELS[a] : control === 'pad' ? controller[a] : display(settings.keys[a]);
  const marks = g?.save.marks.length ?? 0;
  const cleared = g?.save.cleared.length ?? 0;
  const inField = screen !== 'title';
  const resume = () => { void audio.current?.ready(); setScreen('play'); };
  const openSpring = () => { if (g?.beginSpring()) { saveGame(); resume(); } };
  const next = () => { if (g?.advance()) { saveGame(); resume(); } else setScreen('title'); };

  return <main ref={root} className="river" data-ready={ready ? 'true' : 'false'} data-screen={screen}>
    <header className="rv-head">
      <a href="/">← Arcade</a><span>The River Remembers</span>
      {screen === 'play' ? <button onClick={() => setScreen('pause')} aria-label="Pause">Pause</button> : <span className="rv-small">Dora &amp; Enzo</span>}
    </header>
    {artError && <div className="rv-warning" role="alert">The paintings could not load. <button onClick={() => { setArtError(false); setLoading(n => n + 1); }}>Try artwork again</button></div>}
    {screen === 'title' && <section className="rv-title" data-panel>
      <div className="rv-title-copy">
        <p className="rv-kicker">A watershed adventure</p><h1>The River<br/>Remembers</h1>
        <p>The villages are dry. Dora can turn the gates. Enzo can take the water where it needs to go.</p>
        <div className="rv-buttons">
          <button className="rv-primary" disabled={!ready} onClick={() => start(!hasSave)}>{hasSave ? 'Continue' : 'Begin the river'}</button>
          <button disabled={!ready} onClick={() => open('chart')}>Watershed chart</button>
          <button disabled={!ready} onClick={() => open('settings')}>Settings</button>
          <button disabled={!ready} onClick={() => open('help')}>How to play</button>
        </div>
        {g?.save.cleared.includes('spillback') && <button className="rv-spring-button" onClick={openSpring}>Spring Run</button>}
        {!ready && !artError && <small>Loading painted sheets…</small>}
      </div>
    </section>}
    {inField && g && <section className="rv-game">
      <div className="rv-location">
        <div><p className="rv-kicker">{g.district().name}{g.springHere && ' · Spring Run'}</p><h1>{g.room.title}</h1></div>
        <div className="rv-progress">{marks} water marks · {cleared}/42 reaches</div>
      </div>
      <div className="rv-field" ref={field}>
        <canvas ref={canvas} aria-label={`${g.room.title} game scene`}/>
        {screen === 'play' && <div className="rv-hud">
          <span className="rv-lead" data-hero={g.lead}>{g.lead === 'dora' ? 'Dora' : 'Enzo'}</span>
          <span className="rv-hp" role="meter" aria-label="Health" aria-valuenow={g.hearts} aria-valuemin={0} aria-valuemax={g.healthMax}>
            {Array.from({ length: g.healthMax }, (_, i) => <span key={i} data-empty={i >= g.hearts}>♥</span>)}
          </span>
          <span className="rv-status">{g.arena ? g.arena.phase === 2 ? 'Calmed' : `Phase ${g.arena.phase + 1} / 2` : g.wheel ? 'Wheel turning' : g.boat.aboard ? 'Afloat' : 'On the bank'}</span>
        </div>}
        {screen === 'play' && prompt && <div className="rv-prompt"><kbd>{key(prompt.key)}</kbd><span>{prompt.text}</span></div>}
        {screen === 'play' && g.boss && g.beat === 'tell' && <div className="rv-tell">{g.boss.tell}</div>}
        {screen === 'pause' && <div className="rv-overlay"><section className="rv-panel" data-panel>
          <p className="rv-kicker">Rest by the river</p><h2>Paused</h2>
          <div className="rv-buttons"><button className="rv-primary" onClick={resume}>Resume</button><button onClick={() => change(g.roomIndex)}>Restart reach</button>
            <button onClick={() => open('chart')}>Watershed chart</button><button onClick={() => open('settings')}>Settings</button>
            <button onClick={() => open('help')}>How to play</button><button onClick={() => { saveGame(); setScreen('title'); }}>Title screen</button></div>
        </section></div>}
        {(screen === 'clear' || screen === 'fall' || screen === 'ending' || screen === 'spring') && <div className="rv-overlay"><section className="rv-panel" data-panel>
          <p className="rv-kicker">{screen === 'ending' ? 'The watershed is whole' : screen === 'spring' ? 'Post-game challenge' : g.district().name}</p>
          <h2>{screen === 'fall' ? 'Back to the landing' : screen === 'ending' ? 'The river remembers' : screen === 'spring' ? 'Spring Run complete' : 'Water returns'}</h2>
          <p>{screen === 'fall' ? 'The same water will be waiting when you retry.' : screen === 'ending' ?
            'At dawn, the last mill wheel turns. The children downstream hear the river before they see it.' :
            screen === 'spring' ? 'Six changed reaches. Six wheels turning again.' : `${g.room.title} is open. Take the next reach or check the chart.`}</p>
          <div className="rv-buttons">
            {screen === 'fall' ? <button className="rv-primary" onClick={() => change(g.roomIndex)}>Try again</button> : screen === 'ending' ?
              <button className="rv-primary" onClick={openSpring}>Start Spring Run</button> : screen === 'clear' ?
              <button className="rv-primary" onClick={next}>Next reach</button> : null}
            <button onClick={() => open('chart')}>Watershed chart</button><button onClick={() => setScreen('title')}>Title screen</button>
          </div>
        </section></div>}
      </div>
      {screen === 'play' && <>
        <div className="rv-under"><strong>{g.objective()}</strong><span>{g.room.arrival}</span></div>
        <div className="rv-touch">
          <button className="rv-stick" aria-label="Drag to move" onPointerDown={e => {
            showControls('touch'); e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect();
            pointer.current = { id: e.pointerId, x: r.x + r.width / 2, y: r.y + r.height / 2 }; moveStick(e);
          }} onPointerMove={moveStick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}>Move</button>
          <div className="rv-touch-actions">{(['use', 'jump', 'skill', 'tag'] as const).map(a =>
            <button key={a} onClick={() => { showControls('touch'); taps.current.add(a); }}>{LABELS[a]}</button>)}</div>
        </div>
      </>}
    </section>}
    {(screen === 'chart' || screen === 'settings' || screen === 'help') && <div className="rv-modal"><section className="rv-panel" data-panel>
      <p className="rv-kicker">Field book</p>
      <h2>{screen === 'chart' ? 'Watershed chart' : screen === 'settings' ? 'Settings' : 'How to play'}</h2>
      {screen === 'chart' && <div className="rv-chart">{DISTRICTS.map((district, i) => <section key={district.name}>
        <h3>{district.name}</h3><p>{district.rule}</p>
        <div className="rv-chart-list">{REACHES.map((r, index) => r.district !== i ? null : <button key={r.id} disabled={index > (g?.save.frontier ?? 0)} onClick={() => change(index)}>
          {g?.save.cleared.includes(r.id) ? '✓ ' : ''}{r.title}{g?.save.marks.includes(r.id) ? ' ◇' : ''}</button>)}</div>
      </section>)}</div>}
      {screen === 'settings' && <>
        <div className="rv-buttons">{([['assist','Helping hand'], ['music','Music'], ['sound','Effects'], ['reduce','Reduced motion']] as [Toggle,string][]).map(([k,label]) =>
          <button key={k} aria-pressed={settings[k]} onClick={() => setSettings({ ...settings, [k]: !settings[k] })}>{label}: {settings[k] ? 'On' : 'Off'}</button>)}</div>
        <p>Difficulty</p><div className="rv-buttons">{(['story','standard','expert'] as const).map(d =>
          <button key={d} aria-pressed={settings.difficulty === d} onClick={() => setSettings({ ...settings, difficulty: d })}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div>
        <p>Keyboard bindings</p><div className="rv-buttons">{(Object.keys(LABELS) as Action[]).map(a =>
          <button key={a} onClick={() => { setCapture(a); setMessage(`Press the key for ${LABELS[a]}.`); }}>{LABELS[a]}: {display(settings.keys[a])}</button>)}
          <button onClick={() => { setCapture(undefined); setMessage('Default controls restored.'); setSettings({ ...settings, keys: { ...DEFAULT_KEYS } }); }}>Reset keys</button></div>
        {message && <p role="status">{message}</p>}
      </>}
      {screen === 'help' && <div className="rv-guide">
        <p><strong>Dora</strong> turns copper gates and braces against wildlife. <strong>Enzo</strong> boards at a mooring, poles across water, and ties off on the far bank.</p>
        <p>Use {Object.entries(settings.keys).filter(([a]) => ['up','down','left','right'].includes(a)).map(([,k]) => display(k)).join(' ')} to move. {key('use')} works the nearby object. {key('tag')} switches heroes. {key('skill')} braces or gives the skiff a shove. {key('jump')} hops a low stone.</p>
        <p>On touch, drag the Move pad and tap the action buttons. On a gamepad, use the stick or D-pad, A to use, B to hop, X to brace or pole, Y to tag and Start to pause.</p>
      </div>}
      <button onClick={back}>Back</button>
    </section></div>}
    {message && screen !== 'settings' && <p className="rv-warning" role="status">{message}</p>}
  </main>;
}
