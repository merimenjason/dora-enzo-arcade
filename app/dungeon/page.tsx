'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  DungeonGame, AREAS, BESTIARY, CHARS, FLOORS, KINDS, PERKS, TOOLS, TOOL_INFO, DUST_CALM, SAVE_KEY, W, DX, DY,
  dailySeed, keepRun, readProfile, record, replay, type Char, type Dir, type Enemy, type Mode, type Profile,
} from '@/lib/dungeon-game';
import type { DungeonScene } from '@/lib/dungeon-scene';
import { DungeonSound } from './sound';
import './dungeon.css';

type Screen = 'title' | 'play' | 'end';
type Result = ReturnType<DungeonGame['result']> & { news: string[]; hurt: number; tools: number };
const KEY_DIRS: Record<string, Dir> = { arrowup: 0, w: 0, '8': 0, arrowright: 1, d: 1, '6': 1, arrowdown: 2, s: 2, '2': 2, arrowleft: 3, a: 3, '4': 3 };
const TOOL_EMOJI: Record<string, string> = { duster: '🪶', sling: '🪨', soap: '🫧', lantern: '🏮', acorn: '🌰' };
const KIND_EMOJI: Record<string, string> = { fluff: '☁️', hopper: '🐇', roller: '🌀', puffer: '💨', sneezer: '🤧', mimic: '🌾', burrower: '⛏️', bigbun: '🐰', foreman: '🦫', king: '👑' };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ddmm = (day: string) => day.split('-').reverse().join('-');
/** What an enemy means to do, in words, for the inspector. */
function plan(e: Enemy) {
  if (e.hidden) return e.known ? 'a Bale Mimic, pretending to be hay' : 'a hay bale… probably';
  if (!e.awake) return 'is snoozing';
  if (e.under) return e.intent.kind === 'emerge' ? 'will pop up on the marked tile!' : 'is tunnelling closer';
  if (e.dizzy) return 'is dizzy and will miss a turn';
  return ({
    none: 'is getting its bearings', move: 'will step closer', hit: 'will bop the marked tile!', sweep: 'will swing across the three marked tiles!',
    jump: 'will jump and thump the marked tiles!', roll: 'will roll along the marked line!', puff: 'will puff a dust cloud on the marked tile!',
    sneeze: 'will sneeze down the marked line and push you!', emerge: 'will pop up on the marked tile!', tunnel: 'is tunnelling closer', dig: 'will dig down',
    rest: 'is catching its breath: bop it now!', summon: 'will call for help',
  } as Record<string, string>)[e.intent.kind] ?? '';
}

export default function DustBunnyDungeonPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<DungeonScene | null>(null), sound = useRef<DungeonSound | null>(null);
  const game = useRef<DungeonGame | null>(null), profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('title'), pausedRef = useRef(false), aimRef = useRef<number | null>(null), warnRef = useRef<{ tile: number; a: string } | null>(null);
  const hoverRef = useRef(-1), endAt = useRef(0), lastKey = useRef(0), savedFloorRef = useRef<{ run: Profile['run']; floor: number }>({ run: null, floor: 0 });
  const [screen, setScreenState] = useState<Screen>('title'), [paused, setPaused] = useState(false), [ready, setReady] = useState(false);
  const [char, setChar] = useState<Char>('dora'), [muted, setMuted] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null), [note, setNote] = useState(''), [phone, setPhone] = useState(false), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const P = profile.current;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new DungeonSound(); sound.current.unlock(); return sound.current; };

  function start(c: Char, mode: Mode, seed?: number) {
    audio();
    const day = mode === 'daily' ? today() : '';
    const s = seed ?? (mode === 'daily' ? dailySeed(day) : Math.floor(Math.random() * 2 ** 31));
    const g = new DungeonGame(s, c, mode, day);
    game.current = g; profile.current.char = c; keepRun(profile.current, g); save();
    aimRef.current = null; warnRef.current = null; endAt.current = 0; pausedRef.current = false; setPaused(false); setResult(null); setNote('');
    setScreen('play'); canvas.current?.focus(); refresh();
  }
  function resume() {
    const run = profile.current.run; if (!run) return;
    const g = replay(run);
    if (!g) { profile.current.run = null; save(); setNote('That saved run had worn out, sorry! Start a fresh one.'); refresh(); return; }
    game.current = g; setChar(g.char); aimRef.current = null; warnRef.current = null; endAt.current = 0;
    pausedRef.current = false; setPaused(false); setResult(null); setScreen('play'); audio(); canvas.current?.focus(); refresh();
  }
  function finish() {
    const g = game.current; if (!g) return;
    const news = record(profile.current, g); save();
    setResult({ ...g.result(), news, hurt: g.stats.hurt, tools: g.stats.toolsUsed });
    sound.current?.fanfare(g.state === 'won'); setScreen('end');
  }
  function giveUp() {
    const g = game.current; if (!g) return;
    g.state = 'lost'; pausedRef.current = false; setPaused(false); finish();
  }
  function toMenu() { pausedRef.current = false; setPaused(false); aimRef.current = null; setScreen('title'); refresh(); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play') return;
    pausedRef.current = on; setPaused(on); if (!on) canvas.current?.focus();
  }
  /** Plays one action through the engine, with the careful-steps check, sounds and saving. */
  function act(a: string, force = false) {
    const g = game.current; if (!g || screenRef.current !== 'play' || pausedRef.current || endAt.current) return false;
    if (g.state === 'play' && profile.current.settings.careful && !force && (/^[URDLW]$/.test(a))) {
      const d = 'URDL'.indexOf(a), tx = g.px + (d >= 0 ? DX[d] : 0), ty = g.py + (d >= 0 ? DY[d] : 0), t = ty * W + tx;
      if (g.danger().has(t) && !g.enemyAt(t) && (warnRef.current?.tile !== t || warnRef.current.a !== a)) {
        warnRef.current = { tile: t, a }; setNote(a === 'W' ? 'You are standing on a marked tile! Wait again to stay anyway.' : 'That tile is marked: something will bop it. Press again to step there anyway.'); sound.current?.nope(); refresh(); return false;
      }
    }
    warnRef.current = null;
    const ok = g.act(a);
    if (!ok) { sound.current?.nope(); setNote(g.msgs.at(-1) && /Locked/.test(g.msgs.at(-1)!) ? g.msgs.at(-1)! : ''); refresh(); return false; }
    setNote('');
    keepRun(profile.current, g); save();
    if (g.state === 'won' || g.state === 'lost') endAt.current = performance.now() + 1300;
    refresh();
    return true;
  }
  function useTool(k: number) {
    const g = game.current; if (!g || g.state !== 'play') return;
    const t = TOOLS[k]; if (!g.tools[t]) { setNote(`No ${TOOL_INFO[t].name.toLowerCase()} in your pockets yet.`); sound.current?.nope(); refresh(); return; }
    if (TOOL_INFO[t].aim) { aimRef.current = aimRef.current === k ? null : k; refresh(); return; }
    aimRef.current = null; act(`T${k + 1}`, true);
  }
  function dashAim() { const g = game.current; if (!g || g.dashes <= 0) return; aimRef.current = aimRef.current === 9 ? null : 9; refresh(); }
  function direction(d: Dir) {
    const aim = aimRef.current;
    if (aim !== null) { aimRef.current = null; act(aim === 9 ? `X${'URDL'[d]}` : `T${aim + 1}${'URDL'[d]}`, true); return; }
    act('URDL'[d]);
  }
  /** Tiles a tool (or the dash) would touch if aimed this way, for the preview. */
  function aimTiles(g: DungeonGame, aim: number, d: Dir) {
    const out: number[] = [], f = (x: number, y: number) => out.push(y * W + x);
    if (aim === 9) { for (let k = 1; k <= 3; k++) f(g.px + DX[d] * k, g.py + DY[d] * k); return out; }
    const t = TOOLS[aim];
    if (t === 'duster') { const s = (d + 1) % 4; for (const k of [0, 1, -1]) f(g.px + DX[d] + DX[s] * k, g.py + DY[d] + DY[s] * k); }
    else for (let k = 1; k <= (t === 'sling' ? 7 : 5); k++) { const x = g.px + DX[d] * k, y = g.py + DY[d] * k; if (g.tile(x, y) === 0) break; f(x, y); }
    return out;
  }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    setChar(profile.current.char);
    sound.current = new DungeonSound(); setMuted(sound.current.muted());
    const narrow = () => setPhone(window.matchMedia('(max-width: 760px), (pointer: coarse)').matches);
    narrow();
    const w = window as unknown as Record<string, unknown>;
    w.__dungeon = () => game.current;
    w.__dungeonStart = (c: Char, mode: Mode = 'run', seed?: number) => start(c, mode, seed);
    w.__dungeonAct = (a: string) => act(a, true);
    let dead = false, raf = 0, last = 0, ui = 0;
    const resize = () => { scene.current?.resize(); narrow(); };
    import('@/lib/dungeon-scene').then(({ DungeonScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new DungeonScene(canvas.current); } catch { setError('This browser cannot draw the cellars.'); return; }
      window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, g = game.current, snd = sound.current;
        if (g && screenRef.current !== 'title') {
          const ev = g.events.splice(0);
          if (ev.length) {
            sc.feed(g, ev);
            let heard = '';
            for (const e of ev) {
              const k = e.k;
              if (k === 'hurt') heard = 'hurt';
              else if (!heard && (k === 'poof' || k === 'win')) heard = 'poof';
              else if (!heard && k === 'stairs') heard = 'stairs';
              else if (!heard && (k === 'hit' && (e.text === 'wall' || e.text === 'bump'))) heard = 'bonk';
              else if (!heard && k === 'hit') heard = 'bop';
              else if (!heard && (k === 'pick' || k === 'chest' || k === 'unlock' || k === 'perk')) heard = 'pick';
              else if (!heard && k === 'heal') heard = 'heal';
              else if (!heard && (k === 'surprise' || k === 'dusty')) heard = 'surprise';
              else if (!heard && (k === 'spikes')) heard = 'clunk';
              else if (!heard && (k === 'soap' || k === 'shot' || k === 'duster' || k === 'dash' || k === 'gust' || k === 'sneeze')) heard = 'whoosh';
              else if (!heard && k === 'move') heard = 'step';
            }
            if (heard && snd) (snd as unknown as Record<string, () => void>)[heard]?.();
          }
          if (endAt.current && ms >= endAt.current) { endAt.current = 0; finish(); }
          const aim = aimRef.current, hv = hoverRef.current;
          let aimView: { tiles: number[]; ok: boolean } | null = null;
          if (aim !== null && hv >= 0) {
            const hx = hv % W - g.px, hy = Math.floor(hv / W) - g.py;
            if ((hx === 0) !== (hy === 0)) aimView = { tiles: aimTiles(g, aim, (hx === 0 ? (hy < 0 ? 0 : 2) : hx > 0 ? 1 : 3) as Dir), ok: true };
          }
          const narrowNow = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
          sc.draw(g, { dt: pausedRef.current ? 0 : dt, hover: hv, aim: aimView, warn: warnRef.current?.tile ?? -1, grid: profile.current.settings.grid, padBottom: narrowNow ? 230 : 96, char: g.char });
        } else sc.draw(null, { dt, hover: -1, aim: null, warn: -1, grid: false, padBottom: 0, char: 'dora' });
        if (ms - ui > 120) { ui = ms; refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The cellars could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (screenRef.current !== 'play') { if (screenRef.current === 'end' && k === 'enter') { e.preventDefault(); toMenu(); } return; }
      const g = game.current; if (!g) return;
      if (k === 'escape' || k === 'p') {
        e.preventDefault();
        if (k === 'escape' && aimRef.current !== null) { aimRef.current = null; refresh(); return; }
        if (!e.repeat) pause(!pausedRef.current); return;
      }
      if (pausedRef.current) return;
      if (g.state === 'perk') { if (['1', '2', '3'].includes(k)) { e.preventDefault(); act(`P${+k - 1}`); } return; }
      const now = performance.now();
      if (k in KEY_DIRS || k === ' ' || k === '5' || k === '.' || k === 'q') {
        e.preventDefault();
        if (e.repeat && now - lastKey.current < (profile.current.settings.fast ? 80 : 140)) return;
        lastKey.current = now;
      }
      if (k in KEY_DIRS && !(/^[0-9]$/.test(k) && e.location !== 3)) {
        const d = KEY_DIRS[k];
        if (e.shiftKey && g.dashes > 0) { act(`X${'URDL'[d]}`, true); return; }
        direction(d); return;
      }
      if (k === ' ' || k === '.' || (k === '5' && e.location === 3)) { aimRef.current = null; act('W'); return; }
      if (/^[1-5]$/.test(k)) { e.preventDefault(); useTool(+k - 1); return; }
      if (k === 'q' || k === 'e') { dashAim(); return; }
    };
    const blur = () => { if (screenRef.current === 'play' && game.current?.state === 'play') pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('blur', blur);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mouse and touch: a tile next to you moves (or bops); in line while aiming uses the tool; anything else is looked at
  const tileOf = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); const t = scene.current?.tileAt(e.clientX - r.left, e.clientY - r.top); return t ? t.y * W + t.x : -1; };
  const onPointerDown = (e: React.PointerEvent) => {
    const g = game.current; if (!g || screenRef.current !== 'play' || pausedRef.current) return;
    audio();
    const i = tileOf(e); if (i < 0) return;
    hoverRef.current = i;
    const dx = i % W - g.px, dy = Math.floor(i / W) - g.py;
    if (dx === 0 && dy === 0) { if (aimRef.current === null) act('W'); return; }
    const inLine = (dx === 0) !== (dy === 0), d = (dx === 0 ? (dy < 0 ? 0 : 2) : dx > 0 ? 1 : 3) as Dir;
    if (aimRef.current !== null && inLine) { direction(d); return; }
    if (Math.abs(dx) + Math.abs(dy) === 1) { direction(d); return; }
    refresh();
  };
  const onPointerMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') hoverRef.current = tileOf(e); };

  const g = game.current, playing = screen === 'play' && g;
  const looked = g && hoverRef.current >= 0 && g.seen[hoverRef.current] ? g.enemies.find((e) => e.y * W + e.x === hoverRef.current) : undefined;
  const aimName = aimRef.current === null ? '' : aimRef.current === 9 ? 'Dash' : TOOL_INFO[TOOLS[aimRef.current]].name;
  const day = today(), daily = P.daily[day];
  const seenKinds = BESTIARY.filter((k) => P.bestiary[k]).length;
  const savedRun = P.run;
  // the floor a saved run reached comes from replaying it, once per saved run (perks only come every other floor)
  if (screen === 'title' && savedFloorRef.current.run !== savedRun) savedFloorRef.current = { run: savedRun, floor: savedRun ? replay(savedRun)?.floor ?? 1 : 0 };
  const savedFloor = savedFloorRef.current.floor;

  return (
    <main className="dungeon-shell" data-ready={ready ? 'true' : undefined} data-screen={screen}>
      <canvas ref={canvas} className="dungeon-canvas" tabIndex={0} aria-label="Dust Bunny Dungeon. Arrow keys or WASD to move and bop, Space to wait, 1 to 5 for tools, P to pause."
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => { hoverRef.current = -1; }} />
      {error && <div className="dungeon-panel dungeon-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'title' && (
        <section className="dungeon-menu" aria-label="Dust Bunny Dungeon menu">
          <header className="dungeon-head">
            <Link href="/" className="dungeon-back">← ARCADE</Link>
            <button className="dungeon-chip" aria-pressed={!muted} onClick={() => { const s = audio(); s.setMuted(!s.muted()); setMuted(s.muted()); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
          </header>
          <div className="dungeon-title">
            <div className="dungeon-title-art" style={{ backgroundImage: 'url(/art/dungeon/title.webp)' }} />
            <div className="dungeon-title-text">
              <p className="dungeon-eyebrow">A CHINCHILLA ROGUELIKE</p>
              <h1>Dust Bunny <em>Dungeon</em></h1>
              <p>Mischievous dust bunnies have taken over the old burrow cellars. Tidy twelve floors, one step at a time: every bunny shows what it will do next, so think ahead!</p>
            </div>
          </div>
          <div className="dungeon-chars" role="radiogroup" aria-label="Who tidies today?">
            {(['dora', 'enzo'] as Char[]).map((c) => (
              <button key={c} role="radio" aria-checked={char === c} className={'dungeon-char' + (char === c ? ' is-on' : '')} onClick={() => { setChar(c); profile.current.char = c; save(); }}>
                <span className="dungeon-portrait" style={{ backgroundImage: `url(/art/dungeon/player-${c}.webp)` }} />
                <span><b>{CHARS[c].name}</b> <small>{'♥'.repeat(CHARS[c].hp)}{CHARS[c].dash ? ' · 💨 dash' : ''}</small><small className="dungeon-char-blurb">{CHARS[c].blurb}</small><small>Wins: {P.wins[c]}</small></span>
              </button>
            ))}
          </div>
          <div className="dungeon-go-row">
            {savedRun && <button className="dungeon-go" disabled={!ready} onClick={resume}>Continue {CHARS[savedRun.char].name}’s {savedRun.mode === 'daily' ? 'daily ' : ''}run · floor {savedFloor} →</button>}
            <button className={savedRun ? 'dungeon-go is-quiet' : 'dungeon-go'} disabled={!ready} onClick={() => start(char, 'run')}>{ready ? (savedRun ? 'New run' : 'Start tidying →') : 'Lighting the lanterns…'}</button>
            <button className="dungeon-daily" disabled={!ready} onClick={() => start(char, 'daily')}>📅 Daily dust-up · {ddmm(day)}<small>{daily ? (daily.won ? `Won with ${CHARS[daily.char].name} in ${daily.turns} turns` : `Best: floor ${daily.floor}`) : 'Same cellars for everyone today'}</small></button>
          </div>
          {note && <p className="dungeon-note" role="status">{note}</p>}
          <dl className="dungeon-records">
            <div><dt>Deepest floor</dt><dd>{P.best || '–'}{P.best === FLOORS ? ' ★' : ''}</dd></div>
            <div><dt>Runs</dt><dd>{P.runs}</dd></div>
            <div><dt>Wins</dt><dd>{P.wins.dora + P.wins.enzo}</dd></div>
            <div><dt>Bestiary</dt><dd>{seenKinds}/{BESTIARY.length}</dd></div>
          </dl>
          <details className="dungeon-box">
            <summary>Bestiary</summary>
            <ul className="dungeon-bestiary">
              {BESTIARY.map((k) => (
                <li key={k} className={P.bestiary[k] ? '' : 'is-unknown'}>
                  <span className="dungeon-best-icon" style={P.bestiary[k] ? { backgroundImage: `url(/art/dungeon/enemy-${k}.webp)` } : undefined}>{KIND_EMOJI[k]}</span>
                  <span><b>{P.bestiary[k] ? KINDS[k].name : '???'}</b>{P.bestiary[k] ? <small>{KINDS[k].blurb} {KINDS[k].hp} {KINDS[k].hp === 1 ? 'heart' : 'hearts'}. Tidied {P.bestiary[k]}.</small> : <small>Not tidied yet.</small>}</span>
                </li>
              ))}
            </ul>
          </details>
          <details className="dungeon-box">
            <summary>How to play</summary>
            <ul className="dungeon-how">
              <li>Every step is one turn, and the dust bunnies move after you. <b>Coral marks</b> show every tile something will bop next turn. You can only be bopped on a marked tile.</li>
              <li>Walk into an enemy to <b>bop</b> it with your broom: it takes a bop and is knocked back a tile. Knock it into a wall, a crate or a friend for an extra bonk (that makes it dizzy), or into a pit or raised prickles to poof it at once.</li>
              <li>Crates slide when pushed and fill pits. Switches raise and lower every prickle trap. Bellows plates puff everything around them away.</li>
              <li>Tools: <b>1</b> feather duster, <b>2</b> pebble sling, <b>3</b> bubble soap (pick a direction), <b>4</b> lantern, <b>5</b> acorn snack. Enzo dashes with <b>Q</b> or <b>Shift</b>+arrow.</li>
              <li>Linger more than {DUST_CALM} turns on a floor and the dust gets thick: new dust bunnies tumble out. Find the stairs!</li>
            </ul>
          </details>
          <details className="dungeon-box">
            <summary>Settings</summary>
            <label className="dungeon-check"><input type="checkbox" checked={P.settings.careful} onChange={(e) => { P.settings.careful = e.target.checked; save(); refresh(); }} /> Careful steps: ask before stepping onto a marked tile</label>
            <label className="dungeon-check"><input type="checkbox" checked={P.settings.grid} onChange={(e) => { P.settings.grid = e.target.checked; save(); refresh(); }} /> Show the tile grid</label>
            <label className="dungeon-check"><input type="checkbox" checked={P.settings.fast} onChange={(e) => { P.settings.fast = e.target.checked; save(); refresh(); }} /> Quick steps when holding a key</label>
          </details>
          <p className="dungeon-keys"><b>←↑→↓</b> / <b>WASD</b> / numpad move and bop · <b>Space</b> wait · <b>1–5</b> tools · <b>Q</b> dash · <b>P</b> pause · tap a tile next to you on a phone</p>
        </section>
      )}

      {playing && (
        <>
          <div className="dungeon-hud">
            <button className="dungeon-chip" onClick={() => pause(true)} aria-label="Pause">❚❚</button>
            <div className="dungeon-hud-main">
              <div className="dungeon-hearts" aria-label={`${g.hp} of ${g.max} hearts`}>{Array.from({ length: g.max }, (_, k) => <i key={k} className={k < g.hp ? 'on' : ''}>♥</i>)}</div>
              <div className="dungeon-floor"><b>Floor {g.floor}</b> · {AREAS[g.area].name}{g.mode === 'daily' ? ' · Daily' : ''}</div>
              <div className="dungeon-meta">
                {g.bossFloor ? <span className="dungeon-boss">Boss floor</span> : <span className={'dungeon-dust' + (g.dustLeft() === 0 ? ' is-thick' : g.dustLeft() < 30 ? ' is-low' : '')} title="Turns before the dust gets thick">{g.dustLeft() === 0 ? '💨 dust is thick!' : `💨 ${g.dustLeft()}`}</span>}
                {g.keys > 0 && <span>🗝️ {g.keys}</span>}
                {CHARS[g.char].dash + (g.perks.includes('dash') ? 1 : 0) > 0 && <span className={g.dashes ? '' : 'is-used'}>💨 dash {g.dashes}</span>}
                {g.perks.map((p, k) => <span key={p + k} title={`${PERKS[p].name}: ${PERKS[p].blurb}`}>{PERKS[p].icon}</span>)}
              </div>
            </div>
          </div>
          {looked && (
            <div className="dungeon-inspect" role="status">
              <b>{looked.hidden && !looked.known ? 'Hay bale' : KINDS[looked.kind].name}</b>
              {!looked.hidden && <span className="dungeon-inspect-hp">{'♥'.repeat(Math.max(0, looked.hp))}</span>}
              <small>{plan(looked)}</small>
            </div>
          )}
          <ol className={'dungeon-log' + (phone ? ' is-phone' : '')} aria-live="polite">{(note ? [note] : g.msgs.slice(-2)).map((m, k) => <li key={k + m}>{m}</li>)}</ol>
          {aimName && <div className="dungeon-aim" role="status">{aimName}: pick a direction (arrows, or tap a tile in line) · Esc to cancel</div>}
          <div className={'dungeon-controls' + (phone ? ' is-phone' : '')}>
            <div className="dungeon-tools" role="toolbar" aria-label="Tools">
              {TOOLS.map((t, k) => (
                <button key={t} className={'dungeon-tool' + (aimRef.current === k ? ' is-aim' : '')} disabled={!g.tools[t] || g.state !== 'play'} onClick={() => useTool(k)} title={`${TOOL_INFO[t].name}: ${TOOL_INFO[t].blurb}`} aria-label={`${TOOL_INFO[t].name}, ${g.tools[t]} left`}>
                  <span className="dungeon-tool-icon" style={{ backgroundImage: `url(/art/dungeon/tool-${t}.webp)` }}>{TOOL_EMOJI[t]}</span><b>{g.tools[t]}</b><kbd>{k + 1}</kbd>
                </button>
              ))}
              {(g.dashes > 0 || g.char === 'enzo') && <button className={'dungeon-tool' + (aimRef.current === 9 ? ' is-aim' : '')} disabled={!g.dashes || g.state !== 'play'} onClick={dashAim} aria-label={`Dash, ${g.dashes} left`}><span className="dungeon-tool-icon">💨</span><b>{g.dashes}</b><kbd>Q</kbd></button>}
            </div>
            {phone && (
              <div className="dungeon-pad" aria-label="Move pad">
                <button className="up" onClick={() => direction(0)} aria-label="Up">▲</button>
                <button className="left" onClick={() => direction(3)} aria-label="Left">◀</button>
                <button className="wait" onClick={() => { aimRef.current = null; act('W'); }} aria-label="Wait">⏳</button>
                <button className="right" onClick={() => direction(1)} aria-label="Right">▶</button>
                <button className="down" onClick={() => direction(2)} aria-label="Down">▼</button>
              </div>
            )}
          </div>
          {g.state === 'perk' && (
            <div className="dungeon-panel dungeon-perks" role="dialog" aria-label="Pick a perk">
              <p className="dungeon-eyebrow">{g.floor === 4 || g.floor === 8 ? `ON TO THE ${AREAS[g.area + 1]?.name.toUpperCase() ?? ''}` : `FLOOR ${g.floor} TIDIED`}</p>
              <h2>Pick a perk</h2>
              <div className="dungeon-perk-row">
                {g.perkChoices.map((p, k) => (
                  <button key={p} className="dungeon-perk" onClick={() => act(`P${k}`)}>
                    <span className="dungeon-perk-icon">{PERKS[p].icon}</span><b>{PERKS[p].name}</b><small>{PERKS[p].blurb}</small><kbd>{k + 1}</kbd>
                  </button>
                ))}
              </div>
            </div>
          )}
          {paused && (
            <div className="dungeon-panel" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <p>Floor {g.floor} · {g.stats.tidied} dust bunnies tidied · {g.turn} turns. Your run is saved as you go.</p>
              <div className="dungeon-row">
                <button className="dungeon-go" onClick={() => pause(false)}>Keep tidying</button>
                <button onClick={toMenu}>Main menu</button>
                <button onClick={giveUp}>End this run</button>
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'end' && result && (
        <div className="dungeon-panel dungeon-end" role="dialog" aria-label="Results">
          <p className="dungeon-eyebrow">{CHARS[result.char].name.toUpperCase()}{result.mode === 'daily' ? ` · DAILY ${ddmm(result.day)}` : ''}</p>
          <h2>{result.won ? 'The cellars are spotless!' : `A cosy nap on floor ${result.floor}`}</h2>
          <p>{result.won ? 'The Dust King is tidied away, and every corner of the old burrow sparkles. What a team!' : 'Too dusty to go on this time. Every run teaches the bunnies’ tricks: try again!'}</p>
          {result.news.length > 0 && <p className="dungeon-news">{result.news.map((n) => <b key={n}>{n}</b>)}</p>}
          <dl className="dungeon-tally">
            <div><dt>Floor</dt><dd>{result.floor}</dd></div>
            <div><dt>Tidied</dt><dd>{result.tidied}</dd></div>
            <div><dt>Turns</dt><dd>{result.turns}</dd></div>
            <div><dt>Bops taken</dt><dd>{result.hurt}</dd></div>
          </dl>
          <div className="dungeon-row">
            <button className="dungeon-go" onClick={() => start(result.char, result.mode === 'daily' ? 'daily' : 'run')}>{result.mode === 'daily' ? 'Try the daily again' : 'New run'}</button>
            <button onClick={toMenu}>Main menu</button>
          </div>
        </div>
      )}
    </main>
  );
}
