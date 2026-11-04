'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/smash-game';
import type { CharId, Match, MatchEvent, OppDef, OppId, Save, SpecialId, VenueId } from '@/lib/smash-game';
import type { FrameView, SmashScene } from '@/lib/smash-scene';
import { SmashSound, type SongId } from './sound';
import './smash.css';

type Screen = 'title' | 'story' | 'talk' | 'pick' | 'vs' | 'match' | 'result' | 'ending' | 'exhibition' | 'howto' | 'settings';
type Setup = { opp: OppDef; team: CharId[]; venue: VenueId; games: number; story: number | null };
type Run = Setup & { match: Match };
type Cutin = { id: SpecialId; side: number; key: number; counter?: boolean };
type Result = { win: boolean; games: [number, number]; story: number | null; stats: Match['stats']; opp: OppDef; team: CharId[] };

const ART = (n: string) => `/art/smash/${n}.webp`;
const CUTIN: Record<SpecialId, string> = { meteor: 'dora-cutin', phantom: 'enzo-cutin', twin: 'duo-cutin', drop: 'bramble-cutin', mirror: 'twins-cutin', squall: 'gale-cutin', fortress: 'tortoises-cutin', phoenix: 'ember-cutin', zero: 'isolde-cutin' };
/** the portrait for anyone who speaks or plays */
const FACE: Record<string, string> = { dora: 'dora-portrait', enzo: 'enzo-portrait', bramble: 'bramble-portrait', sable: 'twins-portrait', sorrel: 'twins-portrait', gale: 'gale-portrait', marlow: 'tortoises-portrait', fern: 'tortoises-portrait', ember: 'ember-portrait', isolde: 'isolde-portrait' };
const OPP_FACE: Record<OppId, string[]> = { bramble: ['bramble-portrait'], twins: ['twins-portrait'], gale: ['gale-portrait'], tortoises: ['tortoises-portrait'], ember: ['ember-portrait'], isolde: ['isolde-portrait'], final: ['ember-portrait', 'isolde-portrait'] };
const NAME = (id: string) => (id === 'narrator' ? '' : G.CHARS[id as CharId]?.name ?? id);
const teamName = (t: CharId[]) => t.map((c) => G.CHARS[c].name).join(' & ');
const SONG = (s: Screen, run: Run | null): SongId => s === 'match' ? (run?.opp.id === 'final' || run?.opp.id === 'isolde' ? 'final' : 'match') : s === 'ending' ? 'ending' : 'menu';
const WHY: Record<G.PointWhy, string> = { ace: 'ACE!', winner: 'WINNER!', out: 'OUT!', net: 'NET!', double: 'DOUBLE FAULT', blown: 'BLOWN AWAY!' };

function Art({ name, className, pos }: { name: string; className?: string; pos?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [name]);
  return <span className={`fs-art ${className ?? ''}`} data-art={name}>{!bad && <img src={ART(name)} alt="" draggable={false} style={pos ? { objectPosition: pos } : undefined} onError={() => setBad(true)} />}</span>;
}

export default function SmashPage() {
  const [screen, setScreenState] = useState<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const [ready, setReady] = useState(false);
  const [touch, setTouch] = useState(false);
  const [paused, setPausedState] = useState(false);
  const [talk, setTalk] = useState<{ step: number; after: boolean; i: number } | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [cutin, setCutin] = useState<Cutin | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number; tone: string } | null>(null);
  const [score, setScore] = useState<{ games: [number, number]; points: [string, string]; server: number; deciding: boolean; second: boolean }>({ games: [0, 0], points: ['0', '0'], server: 0, deciding: false, second: false });
  const [ex, setEx] = useState<{ doubles: boolean; me: CharId; opp: OppId; venue: VenueId | 'home'; games: number }>({ doubles: false, me: 'dora', opp: 'bramble', venue: 'home', games: 3 });
  const [confirmReset, setConfirmReset] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SmashScene | null>(null);
  const soundRef = useRef<SmashSound | null>(null);
  const runRef = useRef<Run | null>(null);
  const saveRef = useRef(save); saveRef.current = save;
  const screenRef = useRef(screen); screenRef.current = screen;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0, id: -1, ox: 0, oy: 0 });
  const tbtn = useRef({ top: false, slice: false, lob: false, special: false });
  const input = useRef<G.Input>(G.idleInput());
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const shake = useRef(0); const celebrate = useRef(0);
  const reduced = useRef(false);
  const quiet = useRef(false);
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const sfx = () => (quiet.current ? null : soundRef.current);

  const setScreen = useCallback((s: Screen) => { setScreenState(s); screenRef.current = s; }, []);
  const setPaused = useCallback((p: boolean) => { setPausedState(p); pausedRef.current = p; }, []);
  const persist = useCallback((s: Save) => { setSave({ ...s }); saveRef.current = s; try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch { /* storage blocked */ } }, []);
  const say = useCallback((text: string, tone = '') => setBanner({ text, key: Math.random(), tone }), []);

  // ---------------------------------------------------------------- mount
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch { /* blocked */ }
    setSave(s); saveRef.current = s;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new SmashSound(s.settings.sound, s.settings.music);
    let disposed = false;
    void import('@/lib/smash-scene').then((m) => {
      if (disposed || !canvasRef.current) return;
      try { sceneRef.current = new m.SmashScene(canvasRef.current); } catch { /* no WebGL: the menus still work */ }
      setReady(true);
    }).catch(() => setReady(true));
    const onResize = () => sceneRef.current?.resize();
    addEventListener('resize', onResize);
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'match') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { disposed = true; removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', vis); sceneRef.current?.dispose(); soundRef.current?.dispose(); };
  }, [setPaused]);

  useEffect(() => { soundRef.current?.music(SONG(screen, runRef.current)); if (screen !== 'match') soundRef.current?.charge(false, 0); }, [screen]);
  useEffect(() => { if (screen === 'match') sceneRef.current?.resize(); }, [screen]);
  useEffect(() => { if (!banner) return; const id = setTimeout(() => setBanner(null), 1400); return () => clearTimeout(id); }, [banner]);
  useEffect(() => { if (!cutin) return; const id = setTimeout(() => setCutin(null), cutin.counter ? 900 : 1250); return () => clearTimeout(id); }, [cutin]);

  // ---------------------------------------------------------------- starting matches
  const readScore = (m: Match) => { const p = m.scoreText(); setScore({ games: [...m.games] as [number, number], points: p, server: m.server, deciding: m.decidingPoint, second: m.secondServe }); };
  const begin = useCallback((st: Setup) => {
    const s = saveRef.current;
    const m = new G.Match({ home: st.team, away: st.opp.chars, venue: st.venue, games: st.games, ai: st.opp.ai, seed: (Date.now() & 0xffffff) | 1, assist: s.settings.footwork === 'assist', difficulty: s.settings.difficulty });
    const run: Run = { ...st, match: m }; runRef.current = run;
    sceneRef.current?.setMatch(st.venue, m.players.map((p) => ({ id: p.char.id, side: p.side })), m.doubles);
    keys.current.clear(); input.current = G.idleInput(); shake.current = 0; celebrate.current = 0;
    setCutin(null); setBanner(null); setPaused(false); readScore(m);
    setScreen('match');
    soundRef.current?.music(SONG('match', run));
    say(`${G.VENUES[st.venue].name}`, 'venue');
  }, [say, setPaused, setScreen]);

  const toVs = useCallback((st: Setup) => { setSetup(st); setScreen('vs'); }, [setScreen]);
  const storySetup = useCallback((i: number, me?: CharId): Setup => {
    const step = G.STORY[i], o = G.opp(step.opp);
    let team = step.team;
    if (step.choose && me) team = [me];
    return { opp: o, team, venue: o.venue, games: o.games, story: i };
  }, []);
  const playStory = useCallback((i: number) => { sfx()?.unlock(); setTalk({ step: i, after: false, i: 0 }); setScreen('talk'); }, [setScreen]);

  const finish = useCallback(() => {
    const run = runRef.current; if (!run) return;
    const m = run.match, s = saveRef.current, win = m.winner === 0;
    G.recordMatch(s, m, run.story); persist(s);
    sfx()?.stinger(win); sfx()?.charge(false, 0);
    setResult({ win, games: [...m.games] as [number, number], story: run.story, stats: m.stats, opp: run.opp, team: run.team });
    setScreen('result');
  }, [persist, setScreen]);

  // ---------------------------------------------------------------- events from the engine
  const onEvents = useCallback((run: Run, evs: MatchEvent[]) => {
    const m = run.match, sc = sceneRef.current, snd = sfx();
    for (const e of evs) {
      switch (e.k) {
        case 'hit': snd?.hit(e.power, e.kind === 'smash'); sc?.hit(m.ball.x, m.ball.y, m.ball.z, m.ball.special, e.power); if (e.kind === 'smash') shake.current = Math.max(shake.current, 0.15); break;
        case 'bounce': snd?.bounce(e.z); sc?.bounce(e.x, e.y, e.special, m.venue.surface === 'clay'); if (e.special) shake.current = Math.max(shake.current, 0.35); if (!e.in) { snd?.call('out'); } break;
        case 'net': snd?.net(); break;
        case 'fault': snd?.call('fault'); say(e.double ? 'DOUBLE FAULT' : 'FAULT', 'bad'); break;
        case 'let': snd?.call('let'); say('LET', ''); break;
        case 'special': {
          const def = G.SPECIALS[e.id];
          setCutin({ id: e.id, side: e.side, key: Math.random() });
          snd?.special(e.id === 'meteor' || e.id === 'phoenix' || e.id === 'twin', e.id === 'zero'); if (e.id === 'squall') snd?.wind();
          shake.current = 0.5; void def; break;
        }
        case 'counter': setCutin({ id: m.ball.special ?? e.against, side: e.side, key: Math.random(), counter: true }); snd?.counter(); sc?.burst(m.ball.x, m.ball.y, m.ball.z, 0xffffff); shake.current = 0.6; break;
        case 'held': say('HELD IT!', e.side === 0 ? 'good' : ''); break;
        case 'blown': snd?.blown(); say('BLOWN AWAY!', e.side === 0 ? 'bad' : 'good'); shake.current = 0.6; break;
        case 'ready': if (e.side === 0) { snd?.ready(); say(touch ? 'SPECIAL READY! Tap ★' : 'SPECIAL READY! Press Space', 'good'); } break;
        case 'point': {
          const mine = e.winner === 0;
          snd?.crowd(e.why === 'ace' || e.why === 'winner' || e.why === 'blown');
          if (e.why !== 'out' || true) say(e.why === 'winner' && !mine ? 'POINT' : e.why === 'ace' && !mine ? 'ACE' : WHY[e.why], mine ? 'good' : 'bad');
          readScore(m); break;
        }
        case 'game': readScore(m); say(`GAME ${e.winner === 0 ? teamName(run.team) : run.opp.name}`, e.winner === 0 ? 'good' : 'bad'); break;
        case 'match': readScore(m); celebrate.current = 1; say(e.winner === 0 ? 'GAME, SET AND MATCH!' : `${run.opp.name.toUpperCase()} WINS`, e.winner === 0 ? 'good' : 'bad'); break;
        case 'toss': if (m.secondServe || m.points[0] + m.points[1] === 0) readScore(m); break;
      }
    }
  }, [say, touch]);

  // ---------------------------------------------------------------- input
  const readInput = useCallback(() => {
    const k = keys.current, st = stick.current, tb = tbtn.current;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    if (st.id >= 0) { x = st.x; y = st.y; }
    const i = input.current;
    i.x = x; i.y = y;
    i.top = k.has('KeyJ') || k.has('KeyZ') || tb.top;
    i.slice = k.has('KeyK') || k.has('KeyX') || tb.slice;
    i.lob = k.has('KeyL') || k.has('KeyC') || tb.lob;
    i.special = k.has('Space') || tb.special;
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (screenRef.current === 'match') {
        if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); e.preventDefault(); return; }
        if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
        keys.current.add(e.code); soundRef.current?.unlock();
      } else if (screenRef.current === 'talk' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); advanceRef.current(); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, [setPaused]);

  // ---------------------------------------------------------------- the loop
  const stepMatch = useCallback((run: Run) => {
    run.match.tick(input.current);
    if (run.match.events.length) onEvents(run, run.match.events);
  }, [onEvents]);
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, overT = 0;
    const view: FrameView = { dt: 0, players: [], ball: { x: 0, y: 0, z: 0, visible: false, special: null, decoys: [], age: 0, flight: 1, by: -1 }, land: null, fortress: -1, cine: null, celebrate: 0, shake: 0, reduced: false };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const raw = (now - last) / 1000, dt = Math.min(0.1, raw); last = now;
      soundRef.current?.pump();
      const run = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'match' || !run) return;
      const m = run.match;
      readInput();
      if (!pausedRef.current && !m.over) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 24) { stepMatch(run); acc -= G.DT; n++; if (m.over) break; }
      } else acc = 0;
      // the pause before the result runs on the clock, not frames, so a slow device isn't kept waiting
      if (m.over && !pausedRef.current) { overT += raw; if (overT > 1.6) { overT = 0; finish(); return; } } else overT = 0;
      // the view
      view.dt = dt; view.players = m.players.map((p) => ({ id: p.char.id, side: p.side, x: p.x, y: p.y, vx: p.vx, vy: p.vy, swing: p.swing, kind: p.swingKind, charging: !!p.ready && !p.ready.special ? true : !!p.ready, jump: p.jump, stun: p.stun, frost: p.frost }));
      const b = m.ball;
      view.ball = { x: b.x, y: b.y, z: b.z, visible: true, special: b.special, decoys: b.decoys, age: b.age, flight: b.flight, by: b.by };
      // the landing marker: where the ball will first bounce on your side
      let land: FrameView['land'] = null;
      if (m.phase === 'rally' && b.by === 1 && b.bounces === 0) { const s = m.path.find((q) => q.bounce >= 1); if (s && s.y < 0) land = { x: s.x, y: s.y }; }
      view.land = land; view.fortress = m.fortress;
      if (m.freeze > 0 && cutinRef.current) { const hitter = m.players.find((p) => p.side === m.ball.by && p.slot === m.ball.slot) ?? m.you; view.cine = { x: hitter.x, y: hitter.y, side: hitter.side, t: 1 - m.freeze / 1.25 }; } else view.cine = null;
      celebrate.current = m.over ? celebrate.current + dt : 0; view.celebrate = celebrate.current;
      shake.current = Math.max(0, shake.current - dt * 1.5); view.shake = shake.current; view.reduced = reduced.current;
      sc?.render(view);
      // the HUD: spirit meters and the charge bar
      const you = m.you, h = hud.current;
      const me0 = m.meter[0] / G.SPECIAL_COST, me1 = m.meter[1] / G.SPECIAL_COST;
      if (h.m0) h.m0.style.transform = `scaleX(${me0})`; if (h.m1) h.m1.style.transform = `scaleX(${me1})`;
      h.spirit0?.classList.toggle('full', me0 >= 1); h.spirit1?.classList.toggle('full', me1 >= 1);
      h.spirit0?.classList.toggle('counter', me0 >= G.COUNTER_COST / G.SPECIAL_COST && !!m.ball.special && m.ball.by === 1 && G.SPECIALS[m.ball.special].heavy);
      const ch = you.ready ? Math.min(1, (m.t - you.ready.t) / 0.9) : 0;
      if (h.charge) { h.charge.style.opacity = you.ready ? '1' : '0'; } if (h.chargeFill) h.chargeFill.style.transform = `scaleX(${ch})`;
      h.charge?.classList.toggle('max', ch >= 0.55);
      soundRef.current?.charge(!!you.ready && !m.over && !pausedRef.current, ch);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [readInput, stepMatch, finish]);
  const cutinRef = useRef<Cutin | null>(null); cutinRef.current = cutin;

  // ---------------------------------------------------------------- story talk
  const advance = useCallback(() => {
    const t = talk; if (!t) return;
    const step = G.STORY[t.step], lines = t.after ? step.after : step.before;
    sfx()?.button();
    if (t.i + 1 < lines.length) { setTalk({ ...t, i: t.i + 1 }); return; }
    if (!t.after) { if (step.choose) setScreen('pick'); else toVs(storySetup(t.step)); return; }
    // after the match
    if (t.step + 1 >= G.STORY.length) { setScreen('ending'); return; }
    setScreen('story');
  }, [talk, setScreen, toVs, storySetup]);
  const advanceRef = useRef(advance); advanceRef.current = advance;
  useEffect(() => { if (screen !== 'talk' || !talk) return; const step = G.STORY[talk.step], line = (talk.after ? step.after : step.before)[talk.i]; if (line) sfx()?.voice(line[0], line[1]); }, [talk, screen]);

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __smash: () => unknown }).__smash = () => {
      const run = runRef.current, m = run?.match;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: saveRef.current, cutin: cutinRef.current, banner, result, talk,
        match: m && screenRef.current === 'match' ? { phase: m.phase, t: m.t, points: m.points, games: m.games, server: m.server, meter: m.meter, winner: m.winner, over: m.over, doubles: m.doubles, venue: m.opts.venue,
          rally: m.stats.rally, ball: { x: m.ball.x, y: m.ball.y, z: m.ball.z, by: m.ball.by, special: m.ball.special }, you: { x: m.you.x, y: m.you.y, id: m.you.char.id, ready: !!m.you.ready }, freeze: m.freeze, stats: m.stats } : null,
        debug: {
          auto: (on: boolean) => m?.setAutopilot(on ? G.BOT : null),
          /** run the match fast, quietly, for this many seconds of play */
          ff: (secs: number) => { if (!run || !m) return; quiet.current = true; try { for (let i = 0; i < secs / G.DT && !m.over; i++) stepMatch(run); } finally { quiet.current = false; } },
          meter: (v: number) => { if (m) m.meter[0] = v; },
        },
      };
    };
  });

  // ---------------------------------------------------------------- touch controls
  const stickDown = (e: React.PointerEvent) => { const st = stick.current; st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY; st.x = st.y = 0; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); soundRef.current?.unlock(); };
  const stickMove = (e: React.PointerEvent) => { const st = stick.current; if (st.id !== e.pointerId) return; const R = 46; st.x = Math.max(-1, Math.min(1, (e.clientX - st.ox) / R)); st.y = Math.max(-1, Math.min(1, -(e.clientY - st.oy) / R)); const k = hud.current.knob; if (k) k.style.transform = `translate(${st.x * R}px, ${-st.y * R}px)`; };
  const stickUp = (e: React.PointerEvent) => { const st = stick.current; if (st.id !== e.pointerId) return; st.id = -1; st.x = st.y = 0; const k = hud.current.knob; if (k) k.style.transform = ''; };
  const tb = (k: keyof typeof tbtn.current) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); tbtn.current[k] = true; soundRef.current?.unlock(); },
    onPointerUp: () => { tbtn.current[k] = false; }, onPointerCancel: () => { tbtn.current[k] = false; }, onPointerLeave: () => { tbtn.current[k] = false; },
  });

  // ---------------------------------------------------------------- render
  const s = save, run = runRef.current;
  const go = (sc: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(sc); };
  const setSetting = <K extends keyof Save['settings']>(k: K, v: Save['settings'][K]) => { const n = { ...s, settings: { ...s.settings, [k]: v } }; persist(n); if (k === 'sound') soundRef.current?.setSound(v as boolean); if (k === 'music') soundRef.current?.setMusic(v as boolean); };
  const singles = G.OPPS.filter((o) => o.chars.length === 1), doubles = G.OPPS.filter((o) => o.chars.length > 1);

  return <main className={`fs-shell fs-on-${screen}${touch ? ' fs-touch' : ''}`} data-screen={screen} data-ready={ready ? 'true' : undefined}>
    <canvas ref={canvasRef} className="fs-canvas" aria-hidden />

    {screen === 'title' && <section className="fs-title">
      <Art name="title" className="fs-bg" pos="50% 60%" />
      <div className="fs-title-col">
        <h1 className="fs-logo">Fluffball Smash!</h1>
        <p className="fs-tag">Over-the-top tennis at the top of the world</p>
        <nav className="fs-menu">
          <button className="fs-big" onClick={() => go('story')}><b>Story</b><small>{s.story >= G.STORY.length ? 'The Cloudtop Cup is yours' : `The Cloudtop Cup · match ${s.story + 1} of ${G.STORY.length}`}</small></button>
          <button onClick={() => go('exhibition')}><b>Exhibition</b><small>Any rival, singles or doubles</small></button>
          <button onClick={() => go('howto')}><b>How to play</b><small>Swings, spirit and specials</small></button>
          <button onClick={() => go('settings')}><b>Settings</b><small>Sound, footwork, difficulty</small></button>
          <a className="fs-home" href="/">‹ Arcade</a>
        </nav>
      </div>
    </section>}

    {screen === 'story' && <section className="fs-page">
      <header className="fs-head"><button className="fs-back" onClick={() => go('title')}>‹ Back</button><h2>The Cloudtop Cup</h2></header>
      <ol className="fs-ladder">
        {G.STORY.map((st, i) => {
          const o = G.opp(st.opp), open = i <= s.story, done = i < s.story;
          return <li key={i}><button className={`fs-rung${done ? ' done' : ''}`} data-step={i} disabled={!open} onClick={() => playStory(i)}>
            <span className="fs-rung-faces">{OPP_FACE[o.id].map((f) => <Art key={f} name={f} pos="50% 30%" />)}</span>
            <span className="fs-rung-body"><small>Match {i + 1} · {st.team.length > 1 ? 'Doubles' : 'Singles'} · {G.VENUES[o.venue].name}</small><b>{open ? o.name : '???'}</b><small>{open ? o.blurb : 'Win the match before to find out.'}</small></span>
            {done ? <span className="fs-tick">✓</span> : !open ? <span className="fs-lock">🔒</span> : <span className="fs-play">▶</span>}
          </button></li>;
        })}
      </ol>
      {s.story >= G.STORY.length && <div className="fs-row"><button className="fs-go" onClick={() => go('ending')}>See the ending again ›</button></div>}
    </section>}

    {screen === 'talk' && talk && (() => {
      const step = G.STORY[talk.step], lines = talk.after ? step.after : step.before, [who, text] = lines[talk.i];
      const o = G.opp(step.opp), ours = who === 'dora' || who === 'enzo';
      return <section className="fs-talk" onClick={advance}>
        <Art name={`${o.art === 'final' ? 'isolde' : o.art}-cutin`} className="fs-bg fs-blur" />
        <div className="fs-talk-stage">
          {who !== 'narrator' && <Art key={who} name={FACE[who]} className={`fs-talk-face ${ours ? 'left' : 'right'}`} pos="50% 30%" />}
        </div>
        <div className={`fs-talkbox ${ours ? 'left' : who === 'narrator' ? 'mid' : 'right'}`}>
          {who !== 'narrator' && <b className="fs-talk-name">{NAME(who)}</b>}
          <p>{text}</p>
          <span className="fs-talk-next">{talk.i + 1}/{lines.length} · {touch ? 'tap' : 'click or Enter'} ›</span>
        </div>
        <button className="fs-skip" onClick={(e) => { e.stopPropagation(); setTalk({ ...talk, i: lines.length - 1 }); }}>Skip ›</button>
      </section>;
    })()}

    {screen === 'pick' && talk && <section className="fs-page">
      <header className="fs-head"><button className="fs-back" onClick={() => go('story')}>‹ Back</button><h2>Who plays?</h2></header>
      <div className="fs-picks">
        {(['dora', 'enzo'] as const).map((c) => <button key={c} className="fs-card fs-pickcard" data-char={c} onClick={() => toVs(storySetup(talk.step, c))}>
          <Art name={FACE[c]} pos="50% 30%" />
          <span><b>{G.CHARS[c].name}</b><small>{G.CHARS[c].blurb}</small><small>Special: {G.SPECIALS[G.CHARS[c].special].name}</small></span>
        </button>)}
      </div>
    </section>}

    {screen === 'vs' && setup && (() => {
      const st = setup, ourSp = st.team.length > 1 ? G.SPECIALS.twin : G.SPECIALS[G.CHARS[st.team[0]].special];
      const theirSp = [...new Set(st.opp.chars.map((c) => G.CHARS[c].special))].map((id) => G.SPECIALS[id]);
      return <section className="fs-vs">
        <div className="fs-vs-side us">{st.team.map((c) => <Art key={c} name={FACE[c]} className="fs-vs-face" pos="50% 30%" />)}<div className="fs-vs-name"><small>{st.team.length > 1 ? 'Doubles' : 'Singles'}</small><b>{teamName(st.team)}</b></div></div>
        <div className="fs-vs-mid">
          <span className="fs-vs-word">VS</span>
          <p className="fs-taunt">“{st.opp.taunt}”</p>
          <div className="fs-rules">
            <b>{G.VENUES[st.venue].name}</b><small>{G.VENUES[st.venue].blurb}</small>
            <ul><li>First to {st.games} games, by two. At deuce, the next point wins.</li>
              <li>Your special: <b>{ourSp.name}</b>. Theirs: <b>{theirSp.map((x) => x.name).join(', ')}</b>.</li>
              {st.team.length > 1 && <li>You control <b>{G.CHARS[st.team[0]].name}</b>; {G.CHARS[st.team[1]].name} plays by themself.</li>}</ul>
            {st.team.length > 1 && <div className="fs-row fs-who">You control: {st.team.map((c, i) => <button key={c} className={i === 0 ? 'on' : ''} onClick={() => setSetup({ ...st, team: i === 0 ? st.team : [...st.team].reverse() })}>{G.CHARS[c].name}</button>)}</div>}
          </div>
          <div className="fs-row"><button className="fs-back" onClick={() => go(st.story !== null ? 'story' : 'exhibition')}>‹ Back</button><button className="fs-go" onClick={() => { sfx()?.unlock(); begin(st); }}>Play! ›</button></div>
        </div>
        <div className="fs-vs-side them">{OPP_FACE[st.opp.id].map((f) => <Art key={f} name={f} className="fs-vs-face" pos="50% 30%" />)}<div className="fs-vs-name"><small>{st.opp.chars.map((c) => G.CHARS[c].animal).join(' & ')}</small><b>{st.opp.name}</b></div></div>
      </section>;
    })()}

    {screen === 'match' && run && <section className="fs-hud" aria-live="polite">
      <div className="fs-score">
        {[0, 1].map((side) => <div key={side} className={`fs-score-row${score.server === side ? ' serving' : ''}`} data-side={side}>
          <span className="fs-serve">{score.server === side ? '●' : ''}</span>
          <b>{side === 0 ? teamName(run.team) : run.opp.name}</b><em>{score.games[side]}</em><strong>{score.points[side]}</strong>
        </div>)}
        <small>{score.deciding ? 'Deciding point' : score.second ? 'Second serve' : `First to ${run.games}`}</small>
      </div>
      <div className="fs-spirit them" ref={H('spirit1')}><small>{run.opp.name}</small><span><i ref={H('m1')} /></span></div>
      <div className="fs-spirit us" ref={H('spirit0')}><small>Spirit</small><span><i ref={H('m0')} /><u /></span><em className="fs-ready">★ SPECIAL READY</em><em className="fs-counterhint">COUNTER! {touch ? '★' : 'Space'}</em></div>
      <div className="fs-charge" ref={H('charge')}><small>POWER</small><span><i ref={H('chargeFill')} /></span></div>
      {!touch && <p className="fs-keys">Move ← → ↑ ↓ · <b>J</b> topspin · <b>K</b> slice (↓ for a drop) · <b>L</b> lob · <b>Space</b> special · Esc pause<br />Press early to charge: the earlier, the harder.</p>}
      {banner && <div key={banner.key} className={`fs-banner ${banner.tone}`}>{banner.text}</div>}
      {cutin && (() => {
        const def = G.SPECIALS[cutin.id];
        const counterer = cutin.counter ? run.match.players.find((p) => p.side === cutin.side) : null;
        const art = counterer ? (counterer.side === 0 ? (counterer.char.id === 'enzo' ? 'enzo-cutin' : 'dora-cutin') : CUTIN[counterer.char.special]) : CUTIN[cutin.id];
        return <div key={cutin.key} className={`fs-cutin${cutin.counter ? ' counter' : ''} s${cutin.side}`}>
          <Art name={art} className="fs-cutin-art" pos="80% 40%" />
          <div className="fs-cutin-text"><small>{cutin.counter ? `${counterer?.char.name ?? ''} answers` : def.who.split('+').map(NAME).join(' & ')}</small><b>{cutin.counter ? 'COUNTER!' : def.name}</b></div>
        </div>;
      })()}
      <button className="fs-pausebtn" aria-label="Pause" onClick={() => setPaused(true)}>Ⅱ</button>
      {touch && <div className="fs-touchpad">
        <div className="fs-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
        <div className="fs-tbtns">
          <button className="t-top" {...tb('top')}>TOP</button><button className="t-slice" {...tb('slice')}>SLICE</button>
          <button className="t-lob" {...tb('lob')}>LOB</button><button className="t-special" {...tb('special')}>★</button>
        </div>
      </div>}
      {paused && <div className="fs-pause"><div className="fs-card fs-pausecard"><h2>Paused</h2>
        <button className="fs-go" onClick={() => setPaused(false)}>Resume</button>
        <button onClick={() => { setPaused(false); begin(run); }}>Restart match</button>
        <button onClick={() => { setPaused(false); runRef.current = null; setScreen(run.story !== null ? 'story' : 'title'); }}>Quit</button>
      </div></div>}
    </section>}

    {screen === 'result' && result && <section className={`fs-result ${result.win ? 'win' : 'lose'}`}>
      <Art name={result.win ? (result.team.length > 1 ? 'duo-cutin' : `${result.team[0]}-cutin`) : CUTIN[G.CHARS[result.opp.chars[0]].special]} className="fs-bg fs-blur" />
      <div className="fs-card fs-resultcard">
        <h2>{result.win ? 'You win!' : `${result.opp.name} wins`}</h2>
        <p className="fs-final">{teamName(result.team)} <b>{result.games[0]} – {result.games[1]}</b> {result.opp.name}</p>
        <ul className="fs-stats">
          <li><b>{result.stats.winners[0]}</b> winners</li><li><b>{result.stats.aces[0]}</b> aces</li>
          <li><b>{result.stats.specials[0]}</b> specials</li><li><b>{result.stats.counters[0]}</b> counters</li><li><b>{result.stats.longest}</b> longest rally</li>
        </ul>
        <div className="fs-row">
          {result.story !== null && result.win && <button className="fs-go" onClick={() => { setTalk({ step: result.story!, after: true, i: 0 }); setScreen('talk'); }}>Continue ›</button>}
          {!(result.story !== null && result.win) && <button className="fs-go" onClick={() => setup && begin(setup)}>{result.win ? 'Play again' : 'Try again'}</button>}
          <button onClick={() => go(result.story !== null ? 'story' : 'exhibition')}>{result.story !== null ? 'Story' : 'Exhibition'}</button>
          <button onClick={() => go('title')}>Title</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="fs-ending">
      <Art name="ending" className="fs-bg" pos="50% 40%" />
      <div className="fs-ending-text">
        <h2>Champions of the Cloudtop Cup</h2>
        <p>Dora and Enzo carried the cup all the way down the mountain, and took turns sleeping in it.</p>
        <div className="fs-row"><button className="fs-go" onClick={() => go('title')}>Back to the title</button><button onClick={() => go('exhibition')}>Exhibition</button></div>
      </div>
    </section>}

    {screen === 'exhibition' && (() => {
      const list = ex.doubles ? doubles : singles, o = list.find((x) => x.id === ex.opp) ?? list[0];
      const team: CharId[] = ex.doubles ? (ex.me === 'dora' ? ['dora', 'enzo'] : ['enzo', 'dora']) : [ex.me];
      return <section className="fs-page">
        <header className="fs-head"><button className="fs-back" onClick={() => go('title')}>‹ Back</button><h2>Exhibition</h2></header>
        <div className="fs-exrow" role="radiogroup" aria-label="Format">
          {[false, true].map((d) => <button key={String(d)} role="radio" aria-checked={ex.doubles === d} className={ex.doubles === d ? 'on' : ''} onClick={() => setEx({ ...ex, doubles: d, opp: (d ? doubles : singles)[0].id })}>{d ? 'Doubles' : 'Singles'}</button>)}
        </div>
        <div className="fs-exrow" role="radiogroup" aria-label={ex.doubles ? 'You control' : 'You play as'}>
          <span>{ex.doubles ? 'You control' : 'You play as'}</span>
          {(['dora', 'enzo'] as const).map((c) => <button key={c} role="radio" aria-checked={ex.me === c} className={ex.me === c ? 'on' : ''} onClick={() => setEx({ ...ex, me: c })}>{G.CHARS[c].name}</button>)}
        </div>
        <div className="fs-cards">
          {list.map((x) => { const open = G.oppUnlocked(s, x.id); return <button key={x.id} className={`fs-card fs-oppcard${o.id === x.id ? ' sel' : ''}`} data-opp={x.id} disabled={!open} onClick={() => setEx({ ...ex, opp: x.id })}>
            <span className="fs-oppfaces">{OPP_FACE[x.id].map((f) => <Art key={f} name={f} pos="50% 30%" />)}</span>
            <span className="fs-card-body"><b>{open ? x.name : '???'}</b><small>{open ? x.blurb : 'Beat them in the story first.'}</small></span>
            {!open && <span className="fs-lock">🔒</span>}
          </button>; })}
        </div>
        <div className="fs-exrow" role="radiogroup" aria-label="Court">
          <span>Court</span>
          <button role="radio" aria-checked={ex.venue === 'home'} className={ex.venue === 'home' ? 'on' : ''} onClick={() => setEx({ ...ex, venue: 'home' })}>Their home</button>
          {(Object.keys(G.VENUES) as VenueId[]).map((v) => <button key={v} role="radio" aria-checked={ex.venue === v} className={ex.venue === v ? 'on' : ''} onClick={() => setEx({ ...ex, venue: v })}>{G.VENUES[v].name}</button>)}
        </div>
        <div className="fs-exrow" role="radiogroup" aria-label="Games">
          <span>First to</span>
          {[1, 2, 3, 4, 6].map((n) => <button key={n} role="radio" aria-checked={ex.games === n} className={ex.games === n ? 'on' : ''} onClick={() => setEx({ ...ex, games: n })}>{n} {n === 1 ? 'game' : 'games'}</button>)}
        </div>
        <div className="fs-row"><button className="fs-go" disabled={!G.oppUnlocked(s, o.id)} onClick={() => toVs({ opp: o, team, venue: ex.venue === 'home' ? o.venue : ex.venue, games: ex.games, story: null })}>Challenge {o.name} ›</button></div>
      </section>;
    })()}

    {screen === 'howto' && <section className="fs-page fs-howto">
      <header className="fs-head"><button className="fs-back" onClick={() => go('title')}>‹ Back</button><h2>How to play</h2></header>
      <div className="fs-cols">
        <div className="fs-card"><h3>Swinging</h3>
          <p>Press a shot button <b>before</b> the ball reaches you. The earlier you get ready, the harder you hit, but you can only shuffle while you wait. Hold a direction as you hit to aim: left and right for the side, up to go deep, down to angle it short.</p>
          <ul><li><b>J</b> or <b>Z</b> · topspin: fast and dipping</li><li><b>K</b> or <b>X</b> · slice: low and skidding. Hold ↓ for a drop shot.</li><li><b>L</b> or <b>C</b> · lob: high over a player at the net</li><li>A high ball becomes a <b>smash</b> by itself.</li></ul>
          <p>To serve, press any shot button to toss and press again near the top. Aim with ← →.</p></div>
        <div className="fs-card"><h3>Spirit and specials</h3>
          <p>Good shots, held specials and lost points fill your spirit. When it is full, press <b>Space</b> before the ball arrives for your special:</p>
          <ul>{(['meteor', 'phantom', 'twin'] as const).map((id) => <li key={id}><b>{G.SPECIALS[id].name}</b> · {G.SPECIALS[id].line}</li>)}</ul>
          <p><b>Heavy specials</b> knock you back unless you met them with a well-charged swing. With half a meter you can <b>counter</b>: press Space as it comes.</p></div>
        <div className="fs-card"><h3>Footwork</h3>
          <p>With <b>assisted footwork</b> (the default) your player runs to the ball by themself and you can still steer; switch to manual in Settings. The ring on the court shows where the ball will bounce.</p>
          <p>On a touch screen: drag the left stick to move and aim, and use the buttons on the right.</p></div>
      </div>
    </section>}

    {screen === 'settings' && <section className="fs-page">
      <header className="fs-head"><button className="fs-back" onClick={() => go('title')}>‹ Back</button><h2>Settings</h2></header>
      <div className="fs-card fs-settings">
        <label className="fs-set"><span>Sound effects</span><button aria-pressed={s.settings.sound} onClick={() => setSetting('sound', !s.settings.sound)}>{s.settings.sound ? 'On' : 'Off'}</button></label>
        <label className="fs-set"><span>Music</span><button aria-pressed={s.settings.music} onClick={() => setSetting('music', !s.settings.music)}>{s.settings.music ? 'On' : 'Off'}</button></label>
        <label className="fs-set"><span>Footwork</span><span className="fs-seg">{(['assist', 'manual'] as const).map((f) => <button key={f} className={s.settings.footwork === f ? 'on' : ''} onClick={() => setSetting('footwork', f)}>{f === 'assist' ? 'Assisted' : 'Manual'}</button>)}</span></label>
        <label className="fs-set"><span>Rivals</span><span className="fs-seg">{['Easy', 'Normal', 'Hard'].map((d, i) => <button key={d} className={s.settings.difficulty === i ? 'on' : ''} onClick={() => setSetting('difficulty', i)}>{d}</button>)}</span></label>
        <p className="fs-statline">{s.stats.wins} wins · {s.stats.losses} losses · {s.stats.specials} specials · {s.stats.counters} counters · {s.stats.aces} aces · longest rally {s.stats.longest}</p>
        {!confirmReset ? <button className="fs-danger" onClick={() => setConfirmReset(true)}>Reset progress…</button>
          : <div className="fs-row"><span>Forget the story and stats?</span><button className="fs-danger" onClick={() => { const n = G.newSave(); n.settings = s.settings; persist(n); setConfirmReset(false); }}>Yes, reset</button><button onClick={() => setConfirmReset(false)}>Keep them</button></div>}
      </div>
    </section>}
  </main>;
}
