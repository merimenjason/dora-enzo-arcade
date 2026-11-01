'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/rally-game';
import type { CourtId, Input, Match, RallyEvent, Save, Side, ToyId, Who } from '@/lib/rally-game';
import { burst, drawScene, layoutFor, snapOf, stepFx, stepLooks, toScreen, type Layout, type Pose, type Snap, type Sprites, type View } from '@/lib/rally-scene';
import { RallySound, type SongId } from './sound';
import './rally.css';

type Screen = 'menu' | 'ladder' | 'doubles' | 'intro' | 'play' | 'result' | 'ending';
type Hud = {
  score: [number, number]; games: [number, number]; best: number; server: Side; phase: G.Phase;
  springs: { who: Who; side: Side; spring: number; winding: boolean; ranOut: boolean; human: boolean }[];
};
type Result = { win: boolean; log: [number, number][]; medals: G.Medals; got: G.Medals; court: CourtId | null; doubles: boolean; ending: boolean; longest: number; smashes: number; sweet: number };

const POSES: Pose[] = ['ready', 'run', 'smash', 'lunge', 'wind', 'cheer', 'topple'];
const SPRITES = ['backdrop', ...['dora', 'enzo'].flatMap((w) => POSES.map((p) => `${w}-${p}`)), ...G.TOY_IDS.flatMap((t) => [`${t}-ready`, `${t}-swing`])];
const art = (n: string) => `/art/rally/${n}.webp`;
const NAME: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', ...Object.fromEntries(G.TOYS.map((t) => [t.id, t.name])) };
const STYLE_NOTE: Record<ToyId, string> = {
  robot: 'Only ever drives, flat and straight. Never hops. Slow off the mark.',
  frog: 'Hops for a smash at anything up high. Keep it low and short.',
  duck: 'Lives at the net and drops everything short. Push it deep.',
  top: 'Quick on its spin, and never plays the same shot twice.',
  knight: 'A heavy smash and a long reach, but slow to turn. Make him run.',
  penguin: 'Returns everything, deep and patient. Mind your key in the long rallies.',
  bear: 'The champion. Smart, calm and sees your gaps. Best of three games.',
};
const SHOT_WORD: Partial<Record<G.ShotType, string>> = { smash: 'SMASH!', tumble: 'Tumble!', drop: 'Drop', net: 'Net shot', clear: 'Clear', lift: 'Lift', drive: 'Drive' };
const WHY: Record<string, string> = { winner: 'Winner', out: 'Out', net: 'Into the net', fault: 'Service fault', down: 'Didn’t cross' };
const TUT = [
  { key: 'move', keys: 'Run with ← → (or A / D).', touch: 'Run with the ◀ ▶ pads.' },
  { key: 'serve', keys: 'Serve: press Swing (F or Space). Hold ← as you serve for a high serve.', touch: 'Serve: tap SWING. Hold ◀ as you tap for a high serve.' },
  { key: 'hit', keys: 'Swing just as the shuttle reaches you. A bright “ting” and a spark means the sweet spot.', touch: 'Tap SWING just as the shuttle reaches you. A bright “ting” and a spark means the sweet spot.' },
  { key: 'smash', keys: 'When it’s high, hop (W or ↑) and swing at the top: SMASH!', touch: 'When it’s high, tap HOP then SWING at the top: SMASH!' },
  { key: 'aim', keys: 'Hold → (toward the net) as you swing to play short, ← to play deep.', touch: 'Hold ▶ (toward the net) as you swing to play short, ◀ to play deep.' },
  { key: 'wind', keys: 'Your key is unwinding! Stand still and hold Wind (S or ↓) to wind it back up.', touch: 'Your key is unwinding! Stand still and hold WIND to wind it back up.' },
];

/** A tin flip-card digit pair. */
function Flip({ value }: { value: number }) {
  const s = String(value).padStart(2, '0');
  return <span className="wr-flip" aria-label={String(value)}>{[...s].map((d, i) => <span className="wr-card" key={i + d}><span>{d}</span></span>)}</span>;
}
/** The key gauge: a brass key turning on the toy's back, slowing as the spring runs down. */
function KeyGauge({ spring, winding, ranOut, small }: { spring: number; winding: boolean; ranOut: boolean; small?: boolean }) {
  const segs = 10, lit = Math.ceil(spring * segs - 0.001);
  const dur = winding ? 0.35 : spring <= 0 ? 0 : 0.6 + (1 - spring) * 3.4;
  return (
    <span className={'wr-gauge' + (small ? ' small' : '') + (spring < G.SPRING.sluggish ? ' low' : '') + (winding ? ' winding' : '')} title={`Key ${Math.round(spring * 100)}%`}>
      <svg className="wr-key" viewBox="-12 -12 24 24" style={{ animationDuration: dur ? `${dur}s` : '0s', animationDirection: winding ? 'reverse' : 'normal', animationPlayState: dur ? 'running' : 'paused' }} aria-hidden="true">
        <path d="M-2 -1h11v2h-11z" fill="#8a5f22" /><circle cx="-6" cy="-3.5" r="4.2" fill="#e8b84f" stroke="#6b4a1a" strokeWidth="1.2" /><circle cx="-6" cy="3.5" r="4.2" fill="#e8b84f" stroke="#6b4a1a" strokeWidth="1.2" /><circle cx="-6" cy="-3.5" r="1.4" fill="#6b4a1a" /><circle cx="-6" cy="3.5" r="1.4" fill="#6b4a1a" /><rect x="7" y="-3" width="3" height="6" fill="#c99a3a" />
      </svg>
      <span className="wr-segs">{Array.from({ length: segs }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}</span>
      {ranOut ? <span className="wr-ran" title="This key has run out once this match">!</span> : null}
    </span>
  );
}
function Portrait({ who, pose = 'ready', big }: { who: Who; pose?: string; big?: boolean }) {
  const name = G.TOY_IDS.includes(who as ToyId) ? `${who}-ready` : `${who}-${pose}`;
  return <span className={'wr-portrait' + (big ? ' big' : '')} data-who={who}><img src={art(name)} alt="" /></span>;
}
function Medals({ m, size = 'm' }: { m?: G.Medals; size?: 's' | 'm' }) {
  return (
    <span className={'wr-medals ' + size} aria-label={`${m?.win ? 'won' : 'not won yet'}${m?.key ? ', key never ran out' : ''}${m?.margin ? ', won by five or more' : ''}`}>
      <i className={m?.win ? 'on cup' : 'cup'} title="Win the match" />
      <i className={m?.key ? 'on key' : 'key'} title="Win without letting your key run out" />
      <i className={m?.margin ? 'on five' : 'five'} title="Win by five points or more">+5</i>
    </span>
  );
}

export default function RallyPage() {
  const [screen, setScreenState] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const save = useRef<Save>(G.blankSave());
  const match = useRef<Match | null>(null);
  const setupRef = useRef<G.MatchSetup | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [call, setCall] = useState<{ text: string; tone: 'me' | 'them' | 'info'; id: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [settings, setSettings] = useState({ sound: true, music: true });
  const [touch, setTouch] = useState(false);
  const [orient, setOrient] = useState<'wide' | 'tall'>('wide');
  const [tut, setTutState] = useState<number>(-1);
  const tutRef = useRef(-1);
  const setTut = (n: number) => { tutRef.current = n; setTutState(n); };
  const tutCount = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const padsRef = useRef<HTMLDivElement>(null);
  const sprites = useRef<Sprites>({});
  const sound = useRef<RallySound | null>(null);
  const lay = useRef<Layout | null>(null);
  const speed = useRef(1);
  const auto = useRef(false);
  const keys = useRef(new Set<string>());
  const pressed = useRef({ hop0: false, swing0: false, hop1: false, swing1: false });
  const pads = useRef({ left: false, right: false, wind: false });
  const replay = useRef<{ frames: G.Frame[]; i: number; t: number } | null>(null);
  const after = useRef(-1); // seconds until the result card, after the match
  const view = useRef<View>({ t: 0, shake: 0, fx: [], trail: [], court: 'shop', crowd: [], cheer: null, cheerT: 0, looks: [], net: 0, replay: false, smashGlow: 0, portrait: false });
  const callId = useRef(0);
  const hudT = useRef(0);

  const snd = () => sound.current;
  const unlock = () => snd()?.unlock();
  const persist = useCallback(() => { try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } }, []);
  const music = (id: SongId | null) => snd()?.music(id);
  const say = (text: string, tone: 'me' | 'them' | 'info' = 'info') => { callId.current++; setCall({ text, tone, id: callId.current }); };

  // ---- starting matches
  const crowdFor = (setup: G.MatchSetup): Who[] => {
    const playing = new Set<Who>(setup.mode === 'doubles' ? (G.PAIRS.find((p) => p.id === setup.pair)?.toys ?? []) : setup.foe ? [setup.foe] : []);
    return G.TOY_IDS.filter((t) => !playing.has(t)).slice(0, 6);
  };
  const begin = (setup: G.MatchSetup) => {
    setupRef.current = setup;
    match.current = G.newMatch(setup);
    const v = view.current;
    v.fx = []; v.trail = []; v.looks = []; v.court = save.current.court; v.crowd = crowdFor(setup); v.replay = false; v.cheerT = 0;
    v.cheer = setup.mode === 'ladder' ? (setup.who === 'dora' ? 'enzo' : 'dora') : null;
    replay.current = null; after.current = -1;
    setResult(null); setCall(null); setPaused(false); pausedRef.current = false;
    keys.current.clear(); pads.current = { left: false, right: false, wind: false };
    refreshHud();
    if (setup.tutorial) { setTut(0); tutCount.current = 0; } else setTut(-1);
  };
  const intro = (setup: G.MatchSetup) => {
    unlock(); snd()?.button();
    begin(setup);
    setScreen('intro');
    music(setup.mode === 'versus' ? 'versus' : setup.mode === 'doubles' ? 'knight' : (setup.foe ?? 'robot') as SongId);
  };
  const play = () => {
    unlock(); snd()?.button();
    if (!match.current && setupRef.current) begin(setupRef.current);
    setScreen('play');
    const s = setupRef.current;
    if (s) say(s.mode === 'versus' ? `${NAME[s.who]} serves first` : 'You serve first', 'info');
  };
  const ladderMatch = (foe: ToyId, seed?: number) => intro({ mode: 'ladder', foe, who: save.current.who, seed: seed ?? nextSeed(), tutorial: foe === 'robot' && !save.current.tutorial });
  const seedN = useRef(1);
  const nextSeed = () => { seedN.current = (seedN.current * 1103515245 + 12345) >>> 0; return (seedN.current % 1000000) + 1; };

  // ---- the HUD follows the match
  const refreshHud = () => {
    const m = match.current; if (!m) { setHud(null); return; }
    setHud({
      score: [m.score[0], m.score[1]], games: [m.games[0], m.games[1]], best: m.best, server: m.server, phase: m.phase,
      springs: m.players.map((p) => ({ who: p.who, side: p.side, spring: p.spring, winding: p.winding, ranOut: p.ranOut, human: p.human })),
    });
  };

  // ---- events from the engine: sound, effects, callouts, the tutorial
  const onEvent = (m: Match, e: RallyEvent) => {
    const v = view.current, me = (i: number) => m.players[i]?.human && m.players[i].side === 0;
    switch (e.e) {
      case 'hit': {
        snd()?.hit(e.sweet, e.shot === 'smash');
        burst(v, e.sweet ? 'sweet' : 'hit', e.x, e.y);
        if (e.shot === 'smash') { burst(v, 'smash', e.x, e.y); snd()?.crowd(false); }
        const w = SHOT_WORD[e.shot];
        if (w && (e.shot === 'smash' || e.shot === 'tumble' || (e.sweet && e.shot !== 'drive'))) v.fx.push({ kind: 'word', x: e.x + (e.side === 0 ? 0.3 : -0.3), y: Math.max(2.5, Math.min(e.y + 0.9, 3.4)), vx: 0, vy: 0.5, t: 0, life: 0.8, c: e.shot === 'smash' ? '#ffb36b' : '#fff3c4', r: 1, rot: 0, txt: w });
        if (me(e.who) && tutRef.current >= 0) {
          tutCount.current++;
          const t = tutRef.current;
          if (t === 2 && tutCount.current >= 3) setTut(3);
          else if (t === 3 && (e.shot === 'smash' || tutCount.current >= 9)) { setTut(4); tutCount.current = 0; }
          else if (t === 4 && tutCount.current >= 3) setTut(-2); // done with the moves; the key lesson comes when the key runs down
        }
        break;
      }
      case 'serve': if (me(e.who) && tutRef.current === 1) setTut(2); break;
      case 'whiff': snd()?.swing(); break;
      case 'hop': snd()?.hop(); break;
      case 'net': snd()?.net(); burst(v, 'net', 0, 0.6); break;
      case 'cord': snd()?.cord(); burst(v, 'cord', 0, 1.0); break;
      case 'land': snd()?.land(); burst(v, 'land', e.x, 0, { inside: e.inside }); break;
      case 'point': {
        const mineSide = e.side === 0;
        snd()?.point(m.setup.mode === 'versus' ? true : mineSide); snd()?.crowd(false); v.cheerT = mineSide ? 1 : 0;
        const who = m.players.find((p) => p.side === e.side && (p.human || m.setup.mode !== 'doubles'))!.who;
        const name = m.setup.mode === 'doubles' ? (e.side === 0 ? 'Dora & Enzo' : G.PAIRS.find((p) => p.id === m.setup.pair)?.name ?? '') : NAME[who];
        const gp = G.gamePoint(m);
        const tail = m.phase === 'point' && gp !== null ? (m.games[gp] === m.best - 1 ? ' · Match point' : ' · Game point') : '';
        say(`${WHY[e.why]} · Point ${name}${tail}`, m.setup.mode === 'versus' ? 'info' : mineSide ? 'me' : 'them');
        refreshHud();
        break;
      }
      case 'game': if (m.phase !== 'over') { say(`Game ${e.side === 0 ? (m.setup.mode === 'versus' ? NAME[m.players[0].who] : 'to you') : NAME[m.players.find((p) => p.side === 1)!.who]} · ${e.games[0]}–${e.games[1]} in games`, e.side === 0 ? 'me' : 'them'); snd()?.crowd(true); } break;
      case 'match': {
        // the match point again, slowly
        replay.current = { frames: m.frames.slice(), i: 0, t: 0 };
        v.replay = true; v.trail = [];
        say('Match point · the replay', 'info');
        snd()?.setRate(0.6);
        break;
      }
      case 'runout': {
        if (me(e.who)) { snd()?.runout(); say('Your key ran out! Hold Wind when you have a moment.', 'them'); if (tutRef.current !== -1) setTut(5); }
        break;
      }
      case 'wound': if (m.players[e.who].human) { snd()?.wound(); const p = m.players[e.who]; burst(v, 'wound', p.x, 0.7); if (tutRef.current === 5) finishTutorial(); } break;
    }
  };
  const finishTutorial = () => { setTut(-1); if (!save.current.tutorial) { save.current.tutorial = true; persist(); } };

  const endMatch = () => {
    const m = match.current; if (!m) return;
    const before = { ...(m.setup.foe ? save.current.ladder[m.setup.foe] ?? { win: false, key: false, margin: false } : { win: false, key: false, margin: false }) };
    const got = G.recordMatch(save.current, m);
    if (m.setup.tutorial) save.current.tutorial = true;
    persist();
    const win = m.winner === 0;
    setResult({
      win, log: m.gameLog.slice(), medals: m.setup.foe ? save.current.ladder[m.setup.foe] ?? before : G.medalsFor(m), got: got.medals, court: got.court, doubles: got.doubles, ending: got.ending,
      longest: m.stats.longest, smashes: m.stats.smashes[0], sweet: m.stats.sweet[0],
    });
    setTut(-1);
    setScreen('result');
    music(win || m.setup.mode === 'versus' ? 'ending' : 'menu');
  };

  // ---- input
  const inputFor = (m: Match, i: number): Input => {
    const p = m.players[i], k = keys.current, versus = m.setup.mode === 'versus';
    if (auto.current && i === 0) return G.aiInput(m, i);
    const P = pressed.current;
    if (i === 0 || !versus) {
      const left = k.has('a') || (!versus && k.has('arrowleft')) || pads.current.left;
      const right = k.has('d') || (!versus && k.has('arrowright')) || pads.current.right;
      const inp: Input = { move: left === right ? 0 : left ? -1 : 1, hop: P.hop0, swing: P.swing0, wind: k.has('s') || (!versus && k.has('arrowdown')) || pads.current.wind };
      P.hop0 = false; P.swing0 = false;
      return inp;
    }
    void p;
    const left = k.has('arrowleft'), right = k.has('arrowright');
    const inp: Input = { move: left === right ? 0 : left ? -1 : 1, hop: P.hop1, swing: P.swing1, wind: k.has('arrowdown') };
    P.hop1 = false; P.swing1 = false;
    return inp;
  };
  useEffect(() => {
    const versus = () => match.current?.setup.mode === 'versus';
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      unlock();
      const k = e.key.toLowerCase();
      if (screenRef.current === 'intro' && (k === 'enter' || k === ' ')) { e.preventDefault(); play(); return; }
      if (screenRef.current !== 'play') return;
      if (k === 'escape' || k === 'p') { e.preventDefault(); togglePause(); return; }
      if (replay.current && (k === 'enter' || k === ' ' || k === 'escape')) { e.preventDefault(); skipReplay(); return; }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', '/'].includes(k)) e.preventDefault();
      if (e.repeat) { keys.current.add(k); return; }
      keys.current.add(k);
      const P = pressed.current;
      if (versus()) {
        if (k === 'w') P.hop0 = true; if (k === 'f') P.swing0 = true;
        if (k === 'arrowup') P.hop1 = true; if (k === '/' || k === 'enter' || k === 'l') P.swing1 = true;
      } else {
        if (k === 'w' || k === 'arrowup') P.hop0 = true;
        if (k === 'f' || k === ' ' || k === 'j' || k === 'k' || k === '/' || k === 'enter') P.swing0 = true;
      }
      if (tutRef.current === 0 && ['a', 'd', 'arrowleft', 'arrowright'].includes(k)) tutCount.current++;
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const blur = () => { keys.current.clear(); pads.current = { left: false, right: false, wind: false }; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  });
  const togglePause = () => { const p = !pausedRef.current; pausedRef.current = p; setPaused(p); snd()?.button(); };
  const skipReplay = () => { if (!replay.current) return; replay.current = null; view.current.replay = false; snd()?.setRate(1); afterReplay(); };
  const afterReplay = () => {
    const m = match.current; if (!m) return;
    after.current = 3.2;
    const v = view.current, wx = m.winner === 0 ? -2 : 2;
    burst(v, 'win', wx, 0); snd()?.fanfare(m.setup.mode === 'versus' || m.winner === 0); snd()?.crowd(true); snd()?.clank();
    const winName = m.setup.mode === 'doubles' ? (m.winner === 0 ? 'Dora & Enzo' : G.PAIRS.find((p) => p.id === m.setup.pair)?.name) : NAME[m.players.find((p) => p.side === m.winner)!.who];
    say(`${winName} ${m.setup.mode === 'doubles' && m.winner === 0 ? 'win' : 'wins'} the match!`, m.winner === 0 || m.setup.mode === 'versus' ? 'me' : 'them');
    if (m.setup.mode === 'ladder' && m.winner === 1) { const t = G.toyById(m.setup.foe!); v.fx.push({ kind: 'word', x: 2, y: 2.2, vx: 0, vy: 0.2, t: 0, life: 2.4, c: '#fff3c4', r: 1, rot: 0, txt: `“${t.brag}”` }); }
  };
  const padProps = (which: 'left' | 'right' | 'wind' | 'hop' | 'swing') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault(); unlock();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      if (which === 'hop') pressed.current.hop0 = true;
      else if (which === 'swing') { if (replay.current) skipReplay(); else pressed.current.swing0 = true; }
      else { pads.current[which] = true; if (tutRef.current === 0 && which !== 'wind') tutCount.current++; }
      (e.currentTarget as HTMLElement).classList.add('down');
    },
    onPointerUp: (e: React.PointerEvent) => { if (which === 'left' || which === 'right' || which === 'wind') pads.current[which] = false; (e.currentTarget as HTMLElement).classList.remove('down'); },
    onPointerCancel: (e: React.PointerEvent) => { if (which === 'left' || which === 'right' || which === 'wind') pads.current[which] = false; (e.currentTarget as HTMLElement).classList.remove('down'); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // ---- the loop
  useEffect(() => {
    if (!mounted) return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const real = Math.min(0.1, (now - last) / 1000); last = now;
      const dt = real * speed.current;
      const v = view.current, m = match.current, scr = screenRef.current;
      v.t += real; v.shake = Math.max(0, v.shake - real * 3); v.net = Math.max(0, v.net - real * 2.5); v.smashGlow = Math.max(0, v.smashGlow - real * 2.2); v.cheerT = Math.max(0, v.cheerT - real * 0.8);
      const live = m && (scr === 'play' || scr === 'result') && !pausedRef.current;
      let snap: Snap | null = m ? snapOf(m) : null;
      if (live && m) {
        if (replay.current) {
          // the match point, slowly
          const r = replay.current;
          r.t += dt * 0.35 * 60;
          r.i = Math.floor(r.t);
          if (r.i >= r.frames.length) { replay.current = null; v.replay = false; snd()?.setRate(1); afterReplay(); }
          else {
            const f = r.frames[r.i];
            snap = { sx: f.sx, sy: f.sy, sa: f.sa, held: false, down: false, toys: m.players.map((p, i) => ({ who: p.who, side: p.side, x: f.p[i][0], y: f.p[i][1], pose: f.p[i][2] as Pose, spring: p.spring, winding: false, swingT: -1, key: 0, human: p.human })) };
          }
          stepFx(v.fx, dt * 0.35);
        } else {
          acc += dt;
          let n = 0;
          while (acc >= G.DT && n < 60) {
            const ins = m.players.map((p, i) => (p.human ? inputFor(m, i) : null));
            G.step(m, ins);
            for (const e of m.events) onEvent(m, e);
            m.events.length = 0;
            acc -= G.DT; n++;
          }
          if (n >= 60) acc = 0;
          stepFx(v.fx, dt);
          snap = snapOf(m);
          if (m.phase === 'over') {
            snap.toys.forEach((t) => { if (t.side === m.winner) t.winding = true; });
            if (after.current > 0) { after.current -= dt; if (after.current <= 0 && screenRef.current === 'play') endMatch(); }
          }
          // ratchet clicks while a key winds
          if (m.players.some((p) => p.winding)) snd()?.ratchet(m.players.findIndex((p) => p.winding) % 2);
          // tutorial: first steps and the key lesson
          if (tutRef.current === 0 && tutCount.current >= 2) setTut(1);
          const me = m.players[0];
          if (tutRef.current === -2 && me.spring < 0.55) setTut(5);
          if (tutRef.current === 5 && me.spring > 0.92) finishTutorial();
        }
        hudT.current -= real;
        if (hudT.current <= 0) { hudT.current = 0.09; refreshHud(); }
        // the shuttle's trail
        const cur = snap ?? snapOf(m); snap = cur;
        if (cur.held || cur.down) v.trail = [];
        else { v.trail.push({ x: cur.sx, y: cur.sy, a: cur.sa }); if (v.trail.length > 14) v.trail.shift(); }
        stepLooks(v, cur, dt, m.phase === 'over' && !replay.current, m.winner);
      }
      snd()?.pump();
      const cv = canvas.current, g = cv?.getContext('2d');
      if (cv && g && snap && (scr === 'play' || scr === 'result')) {
        const d = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
        g.setTransform(d, 0, 0, d, 0, 0);
        const tall = h > w * 1.05;
        v.portrait = tall;
        const top = hudRef.current ? hudRef.current.offsetHeight + 4 : 60;
        const bottom = padsRef.current && padsRef.current.offsetParent ? (tall ? h - padsRef.current.getBoundingClientRect().top + cv.getBoundingClientRect().top + 4 : padsRef.current.offsetHeight) : Math.max(28, h * 0.06);
        if (w > 0 && h > 0) { const L = layoutFor(w, h, top, bottom, tall, d); drawScene(g, L, snap, v, sprites.current); lay.current = L; }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ---- mount: the save, art, sound, the browser-test hooks
  useEffect(() => {
    save.current = G.readSave((() => { try { return localStorage.getItem(G.SAVE_KEY); } catch { return null; } })());
    setSettings({ ...save.current.settings });
    sound.current = new RallySound(save.current.settings.sound, save.current.settings.music);
    seedN.current = (save.current.played * 2654435761 + 977) >>> 0;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse);
    const onResize = () => setOrient(window.innerHeight > window.innerWidth * 1.05 ? 'tall' : 'wide');
    onResize(); window.addEventListener('resize', onResize);
    // each painting is decoded once into its own canvas, so drawing never decodes again (headless Chrome can crash
    // re-decoding scaled paintings frame after frame)
    const load = (n: string, tries: number) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { createImageBitmap(im).then((b) => { sprites.current[n] = b; }).catch(() => {}); };
      im.onerror = () => { if (tries < 3) setTimeout(() => load(n, tries + 1), 800 * (tries + 1)); };
      im.src = art(n);
    };
    for (const n of SPRITES) load(n, 0);
    const w = window as unknown as Record<string, unknown>;
    w.__rally = () => {
      const m = match.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, save: save.current, tutorial: tutRef.current, replay: !!replay.current,
        match: m ? {
          mode: m.setup.mode, foe: m.setup.foe ?? null, phase: m.phase, score: m.score, games: m.games, best: m.best, server: m.server, winner: m.winner, t: m.t, rallies: m.rallies.length,
          shuttle: { x: m.shuttle.x, y: m.shuttle.y, vx: m.shuttle.vx, vy: m.shuttle.vy, held: m.shuttle.held, down: m.shuttle.down, last: m.shuttle.last, hits: m.shuttle.hits, shot: m.shuttle.shot },
          players: m.players.map((p) => ({ who: p.who, side: p.side, human: p.human, x: p.x, y: p.y, pose: p.pose, spring: p.spring, winding: p.winding, ranOut: p.ranOut, swingT: p.swingT })),
        } : null,
      };
    };
    w.__rallyStart = (o: { mode?: G.Mode; foe?: ToyId; pair?: string; seed?: number; who?: 'dora' | 'enzo'; tutorial?: boolean } = {}) => {
      const setup: G.MatchSetup = { mode: o.mode ?? 'ladder', foe: o.foe ?? (o.mode === 'ladder' || !o.mode ? 'robot' : undefined), pair: o.pair, seed: o.seed ?? 1, who: o.who ?? save.current.who, tutorial: o.tutorial ?? false };
      begin(setup); setScreen('play'); music(setup.mode === 'versus' ? 'versus' : (setup.foe ?? 'knight') as SongId);
      return true;
    };
    w.__rallySpeed = (n: number) => { speed.current = Math.max(0.05, Math.min(60, n)); return speed.current; };
    w.__rallyAuto = (on: boolean) => { auto.current = !!on; return auto.current; };
    w.__rallyLayout = () => {
      const L = lay.current, cv = canvas.current, m = match.current; if (!L || !cv) return null;
      const b = cv.getBoundingClientRect(), off = (r?: { x: number; y: number; w: number; h: number }) => (r ? { x: r.x + b.left, y: r.y + b.top, w: r.w, h: r.h } : null);
      const sh = m ? toScreen(L, m.shuttle.x, m.shuttle.y) : null;
      return {
        canvas: { x: b.left, y: b.top, w: b.width, h: b.height }, u: L.u, floor: L.floor + b.top, top: L.top + b.top,
        court: { x: L.ox - G.HALF * L.u + b.left, y: L.floor - 4.15 * L.u + b.top, w: 2 * G.HALF * L.u, h: 4.15 * L.u + L.depth },
        toys: L.toys.map(off), faces: L.faces.map(off), shuttle: sh ? { x: sh.x + b.left, y: sh.y + b.top } : null,
      };
    };
    const onVis = () => { if (document.hidden) { sound.current?.suspend(); if (screenRef.current === 'play' && !pausedRef.current) { pausedRef.current = true; setPaused(true); } } else sound.current?.resume(); };
    document.addEventListener('visibilitychange', onVis);
    setMounted(true);
    sound.current.music('menu');
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', onResize); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (k: 'sound' | 'music') => {
    unlock();
    const v = !settings[k]; const n = { ...settings, [k]: v }; setSettings(n); save.current.settings = n; persist();
    if (k === 'sound') snd()?.setSound(v); else snd()?.setMusic(v);
  };
  const choose = (who: 'dora' | 'enzo') => { unlock(); snd()?.click(); save.current.who = who; persist(); bump(); };
  const pickCourt = (c: CourtId) => { if (!G.courtOpen(save.current, c)) return; unlock(); snd()?.click(); save.current.court = c; persist(); bump(); };
  const toMenu = () => { unlock(); snd()?.button(); match.current = null; replay.current = null; setResult(null); setPaused(false); pausedRef.current = false; setScreen('menu'); music('menu'); };
  const toLadder = () => { unlock(); snd()?.button(); match.current = null; replay.current = null; setResult(null); setPaused(false); pausedRef.current = false; setScreen('ladder'); music('menu'); };

  const S = save.current;
  const m = match.current;
  const setup = setupRef.current;
  const toggles = (
    <span className="wr-toggles">
      <button className={'wr-chip' + (settings.sound ? ' on' : '')} onClick={() => toggle('sound')} aria-pressed={settings.sound}>Sound</button>
      <button className={'wr-chip' + (settings.music ? ' on' : '')} onClick={() => toggle('music')} aria-pressed={settings.music}>Music</button>
    </span>
  );
  const wins = G.ladderWins(S);

  // ---- the menu
  const menu = (
    <section className="wr-menu">
      <div className="wr-hero blur"><img src={art('title')} alt="" width={1536} height={1024} /></div>
      <div className="wr-corner"><a className="wr-home" href="/">← Arcade</a>{toggles}</div>
      <div className="wr-menu-in">
        <div className="wr-frame"><img src={art('title')} alt="Dora and Enzo, tin wind-up chinchillas, mid-rally on a toyshop shelf at night" width={1536} height={1024} /></div>
        <div className="wr-titleblock">
          <span className="wr-eyebrow">Dora &amp; Enzo’s Arcade · the Clockwork Cup</span>
          <h1>Wind-Up Rally</h1>
          <p className="wr-sub">After closing time, the toyshop shelf plays badminton. Wind your key, hop, swing and smash past seven tin toys.</p>
        </div>
        <div className="wr-modes">
          <button className="wr-mode wr-mode-cup" onClick={() => { unlock(); snd()?.button(); setScreen('ladder'); }}>
            <span className="wr-mode-k">Play</span><b>The Clockwork Cup</b><small>{wins >= 7 ? 'Cup won! Go for every medal.' : `Seven tin toys · ${wins} beaten · ${G.medalCount(S)}/21 medals`}</small>
          </button>
          <button className="wr-mode" disabled={!G.doublesOpen(S)} onClick={() => { unlock(); snd()?.button(); setScreen('doubles'); }}>
            <span className="wr-mode-k">{G.doublesOpen(S) ? 'Doubles' : 'Locked'}</span><b>Dora &amp; Enzo, together</b><small>{G.doublesOpen(S) ? 'Team up against pairs of toys.' : `Beat ${G.DOUBLES_AT} toys on the ladder to open doubles.`}</small>
          </button>
          <button className="wr-mode" onClick={() => intro({ mode: 'versus', who: 'dora', seed: nextSeed() })}>
            <span className="wr-mode-k">2 players</span><b>Dora vs Enzo</b><small>One keyboard: A D W F S against ← → ↑ / ↓</small>
          </button>
        </div>
        <div className="wr-picks">
          <div className="wr-pick">
            <span className="wr-label">Play as</span>
            {(['dora', 'enzo'] as const).map((w) => (
              <button key={w} className={'wr-who' + (S.who === w ? ' on' : '')} onClick={() => choose(w)} aria-pressed={S.who === w}><Portrait who={w} /> {NAME[w]}</button>
            ))}
          </div>
          <div className="wr-pick">
            <span className="wr-label">Court</span>
            {G.COURTS.map((c) => {
              const open = G.courtOpen(S, c.id);
              return <button key={c.id} className={'wr-court' + (S.court === c.id ? ' on' : '')} data-court={c.id} disabled={!open} title={open ? c.name : c.note} onClick={() => pickCourt(c.id)} aria-pressed={S.court === c.id}><i />{open ? c.name.replace(' court', '') : c.note}</button>;
            })}
          </div>
        </div>
        <p className="wr-controls">{touch ? 'Touch: ◀ ▶ run · HOP · SWING · hold WIND to wind your key.' : 'Keys: ← → or A D run · W or ↑ hop · F or Space swing · hold S or ↓ to wind your key · Esc pauses.'}</p>
      </div>
    </section>
  );

  // ---- the ladder
  const ladder = (
    <section className="wr-list">
      <div className="wr-corner"><button className="wr-chip" onClick={toMenu}>← Menu</button>{toggles}</div>
      <div className="wr-list-in">
        <header className="wr-list-head"><span className="wr-eyebrow">The Clockwork Cup</span><h2>Seven tin toys stand between you and the cup</h2><p className="wr-note">Each win opens the next toy. Earn three medals a toy: win, win without letting your key run out, and win by five or more.</p></header>
        <div className="wr-ladder">
          {G.TOYS.map((t, i) => {
            const open = G.toyOpen(S, t.id), md = S.ladder[t.id];
            return (
              <button key={t.id} className={'wr-toy' + (open ? '' : ' locked') + (md?.win ? ' won' : '') + (t.id === 'bear' ? ' champ' : '')} disabled={!open} onClick={() => ladderMatch(t.id)} data-toy={t.id}>
                <span className="wr-rung">{i + 1}</span>
                <span className="wr-toyart"><img src={art(`${t.id}-ready`)} alt="" /></span>
                <b>{open ? t.name : '???'}</b><small>{open ? t.title : 'Beat the toy before'}</small>
                {t.best > 1 ? <span className="wr-bo3">Best of 3 · the final</span> : null}
                <Medals m={md} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
  const doubles = (
    <section className="wr-list">
      <div className="wr-corner"><button className="wr-chip" onClick={toMenu}>← Menu</button>{toggles}</div>
      <div className="wr-list-in">
        <header className="wr-list-head"><span className="wr-eyebrow">Doubles</span><h2>Dora and Enzo, side by side</h2><p className="wr-note">You play {NAME[S.who]}; {NAME[S.who === 'dora' ? 'enzo' : 'dora']} covers the half of the court you leave.</p></header>
        <div className="wr-ladder wr-pairs">
          {G.PAIRS.map((p) => (
            <button key={p.id} className={'wr-toy wr-pair' + (S.doubles[p.id] ? ' won' : '')} onClick={() => intro({ mode: 'doubles', pair: p.id, who: S.who, seed: nextSeed() })} data-pair={p.id}>
              <span className="wr-toyart two"><img src={art(`${p.toys[0]}-ready`)} alt="" /><img src={art(`${p.toys[1]}-ready`)} alt="" /></span>
              <b>{p.name}</b><small>{S.doubles[p.id] ? 'Beaten!' : 'Not beaten yet'}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  // ---- the intro card
  const foe = setup?.foe ? G.toyById(setup.foe) : null;
  const introCard = setup ? (
    <section className="wr-intro">
      <div className="wr-hero dim"><img src={art('backdrop')} alt="" /></div>
      <div className="wr-corner"><button className="wr-chip" onClick={setup.mode === 'doubles' ? () => { setScreen('doubles'); music('menu'); } : setup.mode === 'ladder' ? toLadder : toMenu}>← Back</button>{toggles}</div>
      <div className="wr-intro-in">
        <div className="wr-vs-art left"><img src={art(`${setup.who}-ready`)} alt="" />{setup.mode === 'doubles' ? <img className="mate" src={art(`${setup.who === 'dora' ? 'enzo' : 'dora'}-ready`)} alt="" /> : null}</div>
        <div className="wr-intro-card">
          {setup.mode === 'versus' ? (<>
            <span className="wr-eyebrow">Two players · one keyboard</span>
            <h2>Dora vs Enzo</h2>
            <div className="wr-keys2"><p><b>Dora</b> (left): A D run · W hop · F swing · hold S to wind</p><p><b>Enzo</b> (right): ← → run · ↑ hop · / swing · hold ↓ to wind</p></div>
            <p className="wr-note">Rally-point to 11. The winner of each rally serves.</p>
          </>) : setup.mode === 'doubles' ? (<>
            <span className="wr-eyebrow">Doubles</span>
            <h2>{G.PAIRS.find((p) => p.id === setup.pair)?.name}</h2>
            <p className="wr-line">“Two toys, one net. Shall we?”</p>
            <p className="wr-note">Rally-point to 11. Your partner covers the half you leave.</p>
          </>) : foe ? (<>
            <span className="wr-eyebrow">Rung {G.TOY_IDS.indexOf(foe.id) + 1} of 7{foe.best > 1 ? ' · the final' : ''}</span>
            <h2>{foe.name}, {foe.title}</h2>
            <p className="wr-line">“{foe.line}”</p>
            <p className="wr-note">{STYLE_NOTE[foe.id]} {foe.best > 1 ? 'Best of three games to 11.' : 'One game, rally-point to 11.'}</p>
          </>) : null}
          <button className="wr-go" onClick={play} autoFocus>Wind up &amp; play!</button>
        </div>
        <div className="wr-vs-art right">{setup.mode === 'versus' ? <img className="mirror" src={art('enzo-ready')} alt="" /> : setup.mode === 'doubles' ? G.PAIRS.find((p) => p.id === setup.pair)?.toys.map((t) => <img key={t} src={art(`${t}-ready`)} alt="" />) : foe ? <img src={art(`${foe.id}-ready`)} alt="" /> : null}</div>
      </div>
    </section>
  ) : null;

  // ---- the HUD and the court
  const sideName = (side: Side) => {
    if (!m) return '';
    if (m.setup.mode === 'doubles') return side === 0 ? 'Dora & Enzo' : G.PAIRS.find((p) => p.id === m.setup.pair)?.name ?? '';
    return NAME[m.players.find((p) => p.side === side)!.who];
  };
  const plaque = (side: Side) => hud ? (
    <div className={'wr-plaque ' + (side === 0 ? 'left' : 'right')}>
      <Portrait who={hud.springs.find((p) => p.side === side && (p.human || side === 1))?.who ?? 'dora'} />
      <div className="wr-plaque-in">
        <b>{sideName(side)}</b>
        {hud.springs.filter((p) => p.side === side).map((p, i) => <KeyGauge key={i} spring={p.spring} winding={p.winding} ranOut={p.ranOut} small={hud.springs.filter((q) => q.side === side).length > 1} />)}
      </div>
    </div>
  ) : null;
  const tip = tut >= 0 && tut < TUT.length ? (touch ? TUT[tut].touch : TUT[tut].keys) : null;
  const playView = (
    <section className="wr-play">
      <canvas ref={canvas} className="wr-canvas" aria-label="The tin badminton court" />
      <header ref={hudRef} className="wr-hud">
        {plaque(0)}
        <div className="wr-board" aria-live="polite">
          <div className="wr-board-row">
            <span className={'wr-serve' + (hud?.server === 0 ? ' on' : '')} title="Serving">●</span>
            <Flip value={hud?.score[0] ?? 0} />
            <span className="wr-colon">:</span>
            <Flip value={hud?.score[1] ?? 0} />
            <span className={'wr-serve' + (hud?.server === 1 ? ' on' : '')} title="Serving">●</span>
          </div>
          {hud && hud.best > 1 ? <div className="wr-games">{[0, 1].map((s) => <span key={s} className="wr-pips">{Array.from({ length: hud.best }, (_, i) => <i key={i} className={i < hud.games[s] ? 'on' : ''} />)}</span>)}</div> : null}
          {call ? <div key={call.id} className={'wr-call ' + call.tone}>{call.text}</div> : <div className={'wr-call info' + (hud?.phase === 'serve' ? '' : ' blank')}>{hud?.phase === 'serve' ? `${sideName(hud.server)} to serve` : '·'}</div>}
        </div>
        {plaque(1)}
        <div className="wr-tools"><button className="wr-chip" onClick={togglePause} aria-label="Pause">❚❚</button></div>
      </header>
      {touch && m && m.setup.mode !== 'versus' ? (
        <div ref={padsRef} className="wr-pads">
          <div className="wr-pad-l">
            <button className="wr-pad" {...padProps('left')} aria-label="Run left">◀</button>
            <button className="wr-pad" {...padProps('right')} aria-label="Run right">▶</button>
            <button className="wr-pad wind" {...padProps('wind')} aria-label="Wind your key">WIND</button>
          </div>
          {tip ? <div className="wr-tip pad-tip">{tip}</div> : <div className="wr-tip pad-tip quiet">{orient === 'tall' ? 'Hold WIND while you stand still to wind your key.' : ''}</div>}
          <div className="wr-pad-r">
            <button className="wr-pad hop" {...padProps('hop')} aria-label="Hop">HOP</button>
            <button className="wr-pad swing" {...padProps('swing')} aria-label="Swing">SWING</button>
          </div>
        </div>
      ) : tip ? <div className="wr-tip">{tip}</div> : null}
      {paused ? (
        <div className="wr-pause">
          <div className="wr-panel">
            <h2>Paused</h2>
            <p className="wr-note">{touch ? 'Run ◀ ▶ · HOP · SWING · hold WIND.' : 'Run ← → / A D · hop W / ↑ · swing F / Space · hold S / ↓ to wind.'}</p>
            <div className="wr-row">{toggles}</div>
            <div className="wr-row"><button className="wr-go" onClick={togglePause}>Keep playing</button><button className="wr-chip" onClick={setup?.mode === 'ladder' ? toLadder : toMenu}>Leave the match</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );

  // ---- the result
  const nextFoe = setup?.foe ? G.TOYS[G.TOY_IDS.indexOf(setup.foe) + 1] : undefined;
  const resultCard = result && setup ? (
    <div className="wr-result">
      <div className="wr-panel">
        <span className="wr-eyebrow">{setup.mode === 'ladder' && foe ? `${foe.name}, ${foe.title}` : setup.mode === 'doubles' ? 'Doubles' : 'Versus'}</span>
        <h2>{setup.mode === 'versus' ? `${NAME[m?.players.find((p) => p.side === m.winner)?.who ?? 'dora']} wins!` : result.win ? 'You won!' : 'So close!'}</h2>
        <p className="wr-scores">{result.log.map((g, i) => <span key={i}>{g[0]}–{g[1]}</span>)}</p>
        {setup.mode === 'ladder' && foe ? (<>
          <p className="wr-line">“{result.win ? foe.lose : foe.brag}”</p>
          <div className="wr-medalrow"><Medals m={result.medals} /><span className="wr-note">{[result.got.win && 'Win medal!', result.got.key && 'Key medal: your key never ran out!', result.got.margin && 'Five-point medal!'].filter(Boolean).join(' ') || (result.win ? 'No new medals this time.' : 'Wind up and try again: watch your key.')}</span></div>
        </>) : null}
        <p className="wr-note">Longest rally {result.longest} hits · {result.smashes} smashes · {result.sweet} sweet-spot tings</p>
        {result.court ? <p className="wr-unlock">New court: {G.COURTS.find((c) => c.id === result.court)?.name}!</p> : null}
        {result.doubles ? <p className="wr-unlock">Doubles is open: play alongside {NAME[S.who === 'dora' ? 'enzo' : 'dora']}!</p> : null}
        <div className="wr-row">
          {result.ending ? <button className="wr-go" onClick={() => { unlock(); snd()?.button(); setScreen('ending'); music('ending'); }}>See the dawn</button> : null}
          {setup.mode === 'ladder' && result.win && nextFoe && !result.ending ? <button className="wr-go" onClick={() => ladderMatch(nextFoe.id)}>Next: {nextFoe.name}</button> : null}
          <button className={result.win ? 'wr-chip' : 'wr-go'} onClick={() => intro({ ...setup, seed: nextSeed(), tutorial: false })}>{result.win ? 'Play again' : 'Rematch'}</button>
          <button className="wr-chip" onClick={setup.mode === 'ladder' ? toLadder : setup.mode === 'doubles' ? () => { setScreen('doubles'); music('menu'); } : toMenu}>{setup.mode === 'ladder' ? 'The ladder' : setup.mode === 'doubles' ? 'Pairs' : 'Menu'}</button>
        </div>
      </div>
    </div>
  ) : null;

  const ending = (
    <section className="wr-ending">
      <div className="wr-hero"><img src={art('ending')} alt="" /></div>
      <div className="wr-rays" aria-hidden="true" />
      <div className="wr-ending-card">
        <span className="wr-eyebrow">Dawn on the shelf</span>
        <h2>The Clockwork Cup is yours</h2>
        <p>The shop owner’s lights flick on, and every tin toy on the shelf freezes in a victory pose, just as they were. Nobody will ever know. Except Dora and Enzo, and a very happy music-box bear.</p>
        <div className="wr-row"><button className="wr-go" onClick={toLadder}>Back to the shelf</button><button className="wr-chip" onClick={toMenu}>Menu</button></div>
      </div>
    </section>
  );

  return (
    <main className="wr-shell" data-ready={mounted ? 'true' : undefined} data-screen={screen} data-touch={touch ? 'true' : undefined} data-orient={orient} data-court={S.court}>
      {screen === 'menu' ? menu : null}
      {screen === 'ladder' ? ladder : null}
      {screen === 'doubles' ? doubles : null}
      {screen === 'intro' ? introCard : null}
      {screen === 'play' || screen === 'result' ? playView : null}
      {screen === 'result' ? resultCard : null}
      {screen === 'ending' ? ending : null}
    </main>
  );
}
