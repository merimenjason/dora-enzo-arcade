'use client';
// Snowball Siege: the page. The title, the six slopes (and Versus), the match with the score bar above the valley
// and Enzo's tips and the buttons below it (so no words ever sit over a face), the result, the how-to and the
// settings. Input: the mouse (click your snow to scoop, drag back to throw, right-click to patch), the keyboard (A/D,
// W/S, F, G; the second player on the arrows, `.` and `,`) and touch (tap, drag, long-press). The engine runs at a
// fixed 60 ticks a second; the scene draws whatever it's told. Rules in lib/snowball-game.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/snowball-game';
import type { SnowballScene } from '@/lib/snowball-scene';
import { SnowballSound, type SongId } from './sound';
import './snowball.css';

type Screen = 'title' | 'slopes' | 'play' | 'result' | 'howto' | 'settings';
type Hud = { t: number; ammo: [number, number]; flag: [number, number]; active: [number, number]; stun: [boolean, boolean]; wind: number; hard: boolean; busy: string };
type Drag = { id: number; x0: number; y0: number; x: number; y: number; t0: number; aiming: boolean; long: number | null; patch: boolean; button: number };
type Keys = { angle: [number, number]; charge: [number, number]; held: [boolean, boolean] };

const ART = '/art/snowball/';
const SPECIES_NAME: Record<G.Species, string> = { dora: 'Dora', enzo: 'Enzo', vizcacha: 'vizcacha', pudu: 'pudú', guanaco: 'guanaco', fox: 'culpeo fox', flamingo: 'flamingo', bear: 'spectacled bear' };

export default function SnowballPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SnowballScene | null>(null);
  const soundRef = useRef<SnowballSound | null>(null);
  const matchRef = useRef<G.Match | null>(null);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const backRef = useRef<Screen>('title');
  const [save, setSave] = useState<G.Save>(G.newSave);
  const saveRef = useRef<G.Save>(save);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [tip, setTip] = useState('');
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [upright, setUpright] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const walkRef = useRef<number | null>(null);      // a z the character walks to after a tap out of reach
  const keysRef = useRef<Keys>({ angle: [45, 45], charge: [0, 0], held: [false, false] });
  const downRef = useRef(new Set<string>());
  const endAt = useRef(0);
  const tipAt = useRef(0);
  const fps = useRef({ frames: 0 });
  const seedRef = useRef(1);

  const sfx = () => soundRef.current;
  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: G.Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); if (s === 'howto' || s === 'settings') backRef.current = screenRef.current === 'play' ? 'play' : screenRef.current === 'slopes' ? 'slopes' : 'title'; setScreen(s); };
  const shout = (text: string) => setBanner({ text, key: Math.random() });

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    soundRef.current = new SnowballSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/snowball-scene').then((mod) => {
      if (gone || !canvasRef.current) return;
      const sc = new mod.SnowballScene(canvasRef.current); sceneRef.current = sc;
      sc.reduced = !s.settings.motion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      fit();
      void sc.load().then(() => {
        if (gone) return;
        const t: Record<string, string> = {};
        for (const n of ['vizcacha', 'pudu', 'guanaco', 'fox', 'flamingo', 'bear', 'dora', 'enzo']) t[n] = sc.thumb(n, 0.5);
        setThumbs(t); setReady(true);
      });
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); sceneRef.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fit = () => {
    const c = canvasRef.current, sc = sceneRef.current; if (!c || !sc) return;
    const r = c.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    sc.resize(r.width, r.height);
  };
  useEffect(() => {
    const c = canvasRef.current; if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit()); ro.observe(c); return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const on = () => { const up = innerHeight > innerWidth * 1.1; setUpright(up); sceneRef.current?.setUpright(up); requestAnimationFrame(fit); };
    on(); addEventListener('resize', on); return () => removeEventListener('resize', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ready]);

  // ---------------------------------------------------------------- a match
  const start = useCallback((id: G.SlopeId, seed?: number) => {
    sfx()?.unlock();
    seedRef.current = seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const m = new G.Match(id, seedRef.current);
    matchRef.current = m; sceneRef.current?.setMatch(m);
    keysRef.current = { angle: [45, 45], charge: [0, 0], held: [false, false] }; dragRef.current = null; walkRef.current = null;
    endAt.current = 0; tipAt.current = 0; pausedRef.current = false; setPaused(false);
    setTip(id === 'versus' ? 'Player 1: A/D walk, W/S angle, hold F to throw, G to scoop. Player 2: arrows, hold . to throw, , to scoop.' : m.slope.tips[0] ?? '');
    shout(id === 'versus' ? 'Versus!' : `${m.slope.name}: ${m.slope.rival.names[0]} & ${m.slope.rival.names[1]}`);
    setScreen('play'); requestAnimationFrame(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setScreen]);

  const finish = () => {
    const m = matchRef.current; if (!m) return;
    const s = G.record(saveRef.current, m); persist(s);
    setScreen('result');
  };

  // the event feed: sounds, shouts and the scene's effects
  const onEvents = (m: G.Match) => {
    const sd = sfx();
    for (const e of m.events) {
      if (e.k === 'throw') sd?.whoosh(e.hard);
      else if (e.k === 'hit') { sd?.thud(e.hard); if (e.hard) sd?.powder(); }
      else if (e.k === 'dig') { if (m.humans[e.side]) sd?.scoop(e.floor); }
      else if (e.k === 'patch') sd?.pat();
      else if (e.k === 'land') { if (e.what === 'water') sd?.splash(); else sd?.powder(); }
      else if (e.k === 'crack') sd?.crack();
      else if (e.k === 'stun') { if (e.how === 'splash') sd?.splash(); sd?.stun(); const c = m.chars.find((x) => x.side === e.side && x.i === e.i); if (c) shout(e.side === 0 ? `${c.name} is seeing stars!` : `Got ${c.name}!`); }
      else if (e.k === 'pine') sd?.powder();
      else if (e.k === 'wind') sd?.wind();
      else if (e.k === 'flag' && e.fell) { sd?.flagFall(); shout(e.side === 1 ? 'Their flag is down!' : 'Our flag fell!'); }
      else if (e.k === 'end') {
        const versus = m.slope.id === 'versus';
        if (e.winner === 0 || versus) sd?.cheer(); else sd?.groan();
        if (e.how === 'time') shout('Time!');
        endAt.current = performance.now() + 1800;
      }
    }
    sceneRef.current?.feed(m.events);
  };

  // ---------------------------------------------------------------- the throw from a drag or the keys
  const span = () => Math.min(innerWidth, innerHeight) * 0.4;
  const dragVel = (d: Drag) => {
    const k = G.VMAX / span(), dx = d.x - d.x0, dy = d.y - d.y0;
    let vx = -dx * k, vy = dy * k; const sp = Math.hypot(vx, vy); if (sp > G.VMAX) { vx *= G.VMAX / sp; vy *= G.VMAX / sp; }
    return { vx, vy };
  };
  const keyVel = (side: G.Side) => {
    const k = keysRef.current, a = k.angle[side] * Math.PI / 180, ch = k.charge[side], p = 0.35 + 0.65 * (ch <= 1 ? ch : Math.max(0, 2 - ch));
    const sp = G.VMAX * p; return { vx: Math.cos(a) * sp * (side === 0 ? 1 : -1), vy: Math.sin(a) * sp };
  };
  const hardNow = (m: G.Match, side: G.Side) => { const c = m.activeChar(side); return c.aiming && c.aimTicks >= G.HARD_HOLD && m.ammo[side] >= 2; };

  // ---------------------------------------------------------------- the loop
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, hudN = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); fps.current.frames++;
      sfx()?.pump();
      const sc = sceneRef.current, m = matchRef.current;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!sc || !m || (screenRef.current !== 'play' && screenRef.current !== 'result')) return;
      if (screenRef.current === 'play' && !pausedRef.current) {
        acc += dt;
        while (acc >= 1 / G.TICK) {
          acc -= 1 / G.TICK;
          // walking: the keys, or a tap out of reach
          const dn = downRef.current;
          if (m.humans[0]) {
            let mv = (dn.has('a') ? -1 : 0) + (dn.has('d') ? 1 : 0);
            if (!m.humans[1] && !mv) mv = (dn.has('ArrowLeft') ? -1 : 0) + (dn.has('ArrowRight') ? 1 : 0);
            if (!mv && walkRef.current !== null) { const c = m.activeChar(0), gap = walkRef.current - c.z; if (Math.abs(gap) < 0.1 || c.busy > 0) walkRef.current = null; else mv = Math.sign(gap); }
            m.move[0] = mv;
          }
          if (m.humans[1]) m.move[1] = (dn.has('ArrowLeft') ? -1 : 0) + (dn.has('ArrowRight') ? 1 : 0);
          const k = keysRef.current;
          for (const s of [0, 1] as G.Side[]) {
            if (!m.humans[s]) continue;
            const up = s === 0 ? dn.has('w') || (!m.humans[1] && dn.has('ArrowUp')) : dn.has('ArrowUp');
            const down = s === 0 ? dn.has('s') || (!m.humans[1] && dn.has('ArrowDown')) : dn.has('ArrowDown');
            k.angle[s] = Math.max(10, Math.min(80, k.angle[s] + ((up ? 1 : 0) - (down ? 1 : 0)) * 0.9));
            if (k.held[s]) { k.charge[s] = (k.charge[s] + 1 / 54) % 2; if (!m.activeChar(s).aiming) m.aim(s, true); }
          }
          m.step(); onEvents(m);
          if (m.over) break;
        }
      }
      // what to draw over the valley: the first third of the throw being aimed, and the cube under the pointer
      let preview: { x: number; y: number; z: number }[] | undefined, hard = false, pick: { x: number; y: number; z: number; patch: boolean } | null = null;
      if (!m.over && screenRef.current === 'play') {
        const d = dragRef.current;
        const aimSide: G.Side | -1 = d?.aiming ? 0 : keysRef.current.held[0] ? 0 : keysRef.current.held[1] && m.humans[1] ? 1 : -1;
        if (aimSide >= 0) {
          const v = d?.aiming && aimSide === 0 ? dragVel(d) : keyVel(aimSide as G.Side);
          const pts = m.path(aimSide as G.Side, v.vx, v.vy, 240).pts;
          preview = pts.slice(0, Math.max(2, Math.ceil(pts.length / 3)));
          hard = hardNow(m, aimSide as G.Side);
        } else if (d && d.patch) pick = null;
      }
      sc.frame(dt, { preview, hard, pick });
      if (++hudN % 6 === 0 || m.over) {
        const ours = m.activeChar(0);
        setHud({ t: m.t, ammo: [m.ammo[0], m.ammo[1]], flag: [m.topLeft(0), m.topLeft(1)], active: [m.active[0], m.active[1]], stun: [ours.stun > 0, m.activeChar(1).stun > 0], wind: m.wind, hard, busy: ours.doing });
        // Enzo's tips come round every few seconds on the tutorial slopes
        if (saveRef.current.tips && m.slope.tips.length > 1 && now > tipAt.current) { tipAt.current = now + 7000; setTip(m.slope.tips[Math.floor(m.t / (7 * G.TICK)) % m.slope.tips.length]); }
      }
      if (m.over && endAt.current && now > endAt.current && screenRef.current === 'play') { endAt.current = 0; finish(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the music
  useEffect(() => {
    const m = matchRef.current;
    const song: SongId | null = screen === 'play' ? (m?.slope.id === 'summit' ? 'final' : 'match') : screen === 'result' ? (m?.winner === 0 && m.slope.id === 'summit' ? 'ending' : null) : 'title';
    sfx()?.music(song);
  }, [screen]);

  // ---------------------------------------------------------------- the pointer
  const near = (m: G.Match, c: G.Char, x: number, y: number) => { const sc = sceneRef.current!; const p = sc.screenOf(c.x, 1.2, c.z); return Math.hypot(p.x - x, p.y - y) < Math.max(28, sc.pxPerUnit(c.x, 1, c.z) * 1.1); };
  const tapAt = (x: number, y: number) => {
    const m = matchRef.current, sc = sceneRef.current; if (!m || !sc || m.over) return;
    const other = m.chars_(0).find((c) => c !== m.activeChar(0));
    if (other && near(m, other, x, y)) { if (m.switchTo(0)) sfx()?.button(); return; }
    const p = sc.pickAt(x, y), c = m.activeChar(0);
    if (p.cube) {
      if (m.canDig(c, p.cube.x, p.cube.y, p.cube.z)) { if (m.ammo[0] >= G.POOL) { shout('Your arms are full!'); sfx()?.no(); } else if (m.dig(0, p.cube.x, p.cube.y, p.cube.z)) sc.poke(p.cube.x, p.cube.y, p.cube.z); return; }
      if (m.at(p.cube.x, p.cube.y, p.cube.z) === 1) { walkRef.current = Math.max(1, Math.min(G.D - 1, p.cube.z + 0.5)); return; }
    }
    if (p.ground && m.sideOfX(p.ground.x) === 0) {
      if (Math.abs(p.ground.z - c.z) > 1.2) walkRef.current = Math.max(1, Math.min(G.D - 1, p.ground.z));
      else if (m.ammo[0] < G.POOL) m.scoopFloor(0);
      return;
    }
    sfx()?.no();
  };
  const patchAt = (x: number, y: number) => {
    const m = matchRef.current, sc = sceneRef.current; if (!m || !sc || m.over) return;
    const p = sc.pickAt(x, y), c = m.activeChar(0), f = p.front;
    if (f && m.canPatch(c, f.x, f.y, f.z)) { if (!m.patch(0, f.x, f.y, f.z)) { shout('No snowball to pat in.'); sfx()?.no(); } }
    else sfx()?.no();
  };
  const onDown = (e: React.PointerEvent) => {
    const m = matchRef.current; if (!m || !m.humans[0] || screenRef.current !== 'play' || pausedRef.current) return;
    sfx()?.unlock();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const d: Drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), aiming: false, long: null, patch: false, button: e.button };
    if (e.button === 2) { patchAt(e.clientX, e.clientY); return; }
    if (e.pointerType !== 'mouse') d.long = window.setTimeout(() => { if (dragRef.current === d && !d.aiming) { d.patch = true; patchAt(d.x, d.y); } }, 480);
    dragRef.current = d;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current, m = matchRef.current; if (!d || d.id !== e.pointerId || !m) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.aiming && !d.patch && Math.hypot(d.x - d.x0, d.y - d.y0) > 12) {
      if (d.long) clearTimeout(d.long);
      if (m.ammo[0] < 1) { shout('No snowballs! Scoop some snow.'); sfx()?.no(); dragRef.current = null; return; }
      d.aiming = m.aim(0, true);
      if (!d.aiming) dragRef.current = null;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current, m = matchRef.current; if (!d || d.id !== e.pointerId || !m) return;
    if (d.long) clearTimeout(d.long);
    dragRef.current = null;
    if (d.patch) return;
    if (d.aiming) { const v = dragVel(d); if (!m.throw(0, v.vx, v.vy, hardNow(m, 0))) m.aim(0, false); return; }
    tapAt(e.clientX, e.clientY);
  };

  // ---------------------------------------------------------------- the keys
  useEffect(() => {
    const scoop = (m: G.Match, s: G.Side) => { const f = m.frontCube(s); if (m.ammo[s] >= G.POOL) return; if (!(f && m.dig(s, f.x, f.y, f.z))) m.scoopFloor(s); };
    const release = (m: G.Match, s: G.Side) => {
      const k = keysRef.current; if (!k.held[s]) return; k.held[s] = false;
      const v = keyVel(s); if (!m.throw(s, v.vx, v.vy, hardNow(m, s))) m.aim(s, false); k.charge[s] = 0;
    };
    const down = (e: KeyboardEvent) => {
      const m = matchRef.current, key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (screenRef.current !== 'play' || !m) { if (e.key === 'Escape' && screenRef.current !== 'title') setScreen(screenRef.current === 'howto' || screenRef.current === 'settings' ? backRef.current : 'title'); return; }
      if (key === 'Escape' || key === 'p') { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); return; }
      if (pausedRef.current || m.over) return;
      sfx()?.unlock();
      if (key === 'Tab' || key === 'q') { e.preventDefault(); if (m.humans[0] && m.switchTo(0)) sfx()?.button(); return; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) e.preventDefault();
      if (e.repeat) return;
      downRef.current.add(key);
      const p2 = m.humans[1];
      if (key === 'f' || (!p2 && key === ' ')) { if (m.ammo[0] > 0 && m.aim(0, true)) { keysRef.current.held[0] = true; keysRef.current.charge[0] = 0; } else sfx()?.no(); }
      if (key === 'g') scoop(m, 0);
      if (p2 && key === '.') { if (m.ammo[1] > 0 && m.aim(1, true)) { keysRef.current.held[1] = true; keysRef.current.charge[1] = 0; } else sfx()?.no(); }
      if (p2 && key === ',') scoop(m, 1);
    };
    const up = (e: KeyboardEvent) => {
      const m = matchRef.current, key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      downRef.current.delete(key);
      if (!m || screenRef.current !== 'play') return;
      if (key === 'f' || (!m.humans[1] && key === ' ')) release(m, 0);
      if (m.humans[1] && key === '.') release(m, 1);
    };
    const blur = () => downRef.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- the debug hook for the browser tests
  useEffect(() => {
    (window as unknown as { __snowball: () => unknown }).__snowball = () => {
      const m = matchRef.current;
      return {
        screen: screenRef.current, save: saveRef.current, ready, paused: pausedRef.current, frames: fps.current.frames,
        match: m && { slope: m.slope.id, seed: m.seed, t: m.t, over: m.over, winner: m.winner, how: m.how, ammo: [...m.ammo], active: [...m.active], flag: [m.topLeft(0), m.topLeft(1)], wind: m.wind,
          ours: m.count(0), theirs: m.count(1), balls: m.balls.length, debris: sceneRef.current?.debris.length ?? 0, stats: m.stats,
          chars: m.chars.map((c) => ({ side: c.side, i: c.i, name: c.name, species: c.species, x: c.x, z: c.z, stun: c.stun, aiming: c.aiming, busy: c.busy, doing: c.doing })) },
        debug: {
          start: (id: G.SlopeId, seed = 1) => start(id, seed),
          /** let the pro bot play our side too (for screenshots and the perf probe) */
          auto: () => { const mm = matchRef.current; if (!mm) return false; mm.humans = [false, mm.humans[1]]; mm.brains[0] = new G.Brain(mm, 0, 'pro'); return true; },
          step: (n = 1) => { const mm = matchRef.current; if (!mm) return; for (let i = 0; i < n && !mm.over; i++) { mm.step(); onEvents(mm); } },
          front: () => matchRef.current?.frontCube(0) ?? null,
          dig: (x: number, y: number, z: number) => matchRef.current?.dig(0, x, y, z) ?? false,
          throwAt: (vx: number, vy: number, hard = false) => matchRef.current?.throw(0, vx, vy, hard) ?? false,
          /** a throw that the engine's own solver lands on their flag tower */
          throwTower: () => { const mm = matchRef.current; if (!mm) return false; const c = mm.activeChar(0), f = mm.forts[1].flag; const s = G.solve(mm, 0, mm.hand(c), { x: f.x + 0.5, y: f.top - 0.2, z: f.z + 0.5 }, false, 0); return s ? mm.throw(0, s.vx, s.vy) : false; },
          win: () => { const mm = matchRef.current; if (!mm) return; mm.finish('flag', 0); onEvents(mm); },
          lose: () => { const mm = matchRef.current; if (!mm) return; mm.finish('flag', 1); onEvents(mm); },
          screenOf: (x: number, y: number, z: number) => sceneRef.current?.screenOf(x, y, z) ?? null,
          charAt: (side: G.Side, i: number) => { const mm = matchRef.current, c = mm?.chars.find((q) => q.side === side && q.i === i); return c && sceneRef.current ? sceneRef.current.screenOf(c.x, 1.2, c.z) : null; },
          pickAt: (x: number, y: number) => sceneRef.current?.pickAt(x, y) ?? null,
          thumb: (name: string, angle = 0) => sceneRef.current?.thumb(name, angle, 200) ?? '',
          scene: () => sceneRef.current,
          /** a point on the screen where a click would scoop (or, with patch, pat a snowball in), for the browser tests */
          point: (patch = false) => {
            const mm = matchRef.current, sc = sceneRef.current, cv = canvasRef.current; if (!mm || !sc || !cv) return null;
            const c = mm.activeChar(0), r = cv.getBoundingClientRect(), at = sc.screenOf(c.x, 1, c.z);
            for (let d = 0; d < 260; d += 4) for (let a = 0; a < 16; a++) {
              const x = at.x + Math.cos(a / 16 * Math.PI * 2) * d, y = at.y + Math.sin(a / 16 * Math.PI * 2) * d;
              if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
              const p = sc.pickAt(x, y);
              if (!patch && p.cube && mm.canDig(c, p.cube.x, p.cube.y, p.cube.z)) return { x, y, cube: p.cube };
              if (patch && p.front && mm.canPatch(c, p.front.x, p.front.y, p.front.z) && p.front.y > 0) return { x, y, cube: p.front };
            }
            return null;
          },
        },
      };
    };
  });

  // ---------------------------------------------------------------- the screens
  const m = matchRef.current;
  const versus = m?.slope.id === 'versus';
  const time = hud ? Math.max(0, Math.ceil((G.MATCH_TICKS - hud.t) / G.TICK)) : 120;
  const balls = (n: number, side: G.Side) => <span className={`sb-ammo sb-side${side}`} aria-label={`${n} snowballs`}>{Array.from({ length: G.POOL }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
  const flagBar = (n: number, side: G.Side) => <span className={`sb-flag sb-side${side}`} title="What is left of the flag tower’s top"><b style={{ width: `${(n / 27) * 100}%` }} /></span>;
  const ourName = m ? m.activeChar(0).name : 'Dora';
  const theirNames = m ? (versus ? 'Enzo' : `${m.slope.rival.names[0]} & ${m.slope.rival.names[1]}`) : '';
  const result = () => {
    if (!m) return null;
    const won = m.winner === 0, st = m.stars(), ending = won && m.slope.id === 'summit';
    const next = G.SLOPES[m.slope.n];
    const line = versus ? (m.winner === 0 ? 'Dora’s fort wins!' : m.winner === 1 ? 'Enzo’s fort wins!' : 'A draw!') : won ? (m.how === 'flag' ? 'Their flag is down. You win!' : 'Time! You knocked more off. You win!') : m.winner === 1 ? (m.how === 'flag' ? 'Our flag fell…' : 'Time! They knocked more off.') : 'A draw!';
    return (
      <section className={`sb-result${ending ? ' sb-ending' : ''}`}>
        {ending && <img className="sb-end-art" src={ART + 'ending.webp'} alt="Dora, Enzo and all their new friends round the sled with cocoa under the aurora" />}
        <div className="sb-panel">
          {!ending && thumbs.dora && (
            <div className="sb-faces" aria-hidden="true">
              <img src={thumbs.dora} alt="" /><img src={thumbs.enzo} alt="" /><span className="sb-vs">vs</span>
              <img src={thumbs[versus ? 'enzo' : m.slope.rival.species]} alt="" />
            </div>
          )}
          <h2>{ending ? 'Champions of the Summit!' : line}</h2>
          {ending && <p>Every slope is won. The Vizcacha Twins, the Pudú Pair, the Guanaco Gang, the Culpeo Foxes, the Flamingo Sisters and the Spectacled Bears all come round for cocoa.</p>}
          {!versus && (
            <ul className="sb-stars">
              <li className={st[0] ? 'on' : ''}>★ Win</li>
              <li className={st[1] ? 'on' : ''}>★ Our tower kept</li>
              <li className={st[2] ? 'on' : ''}>★ Under a minute</li>
            </ul>
          )}
          <p className="sb-dim">{Math.round(m.t / G.TICK)} s · {m.stats.thrown[0]} thrown · {m.stats.knocked[0]} cubes knocked out · {m.stats.dug[0]} dug from the walls</p>
          <div className="sb-row">
            <button onClick={() => { sfx()?.button(); start(m.slope.id); }}>Again</button>
            {!versus && won && next && <button className="sb-go" onClick={() => { sfx()?.button(); start(next.id); }}>Next: {next.name}</button>}
            <button onClick={() => go(versus ? 'title' : 'slopes')}>{versus ? 'Title' : 'Slopes'}</button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className={`sb-shell sb-on-${screen}${upright ? ' sb-upright' : ''}`} data-ready={ready ? 'true' : 'false'} onContextMenu={(e) => e.preventDefault()}>
      <div className="sb-game">
        <header className="sb-top">
          {m && hud && (<>
            <span className="sb-team sb-side0">
              <span className="sb-who">{versus ? 'Player 1' : ourName}{hud.stun[0] ? ' ✦' : ''}</span>
              {balls(hud.ammo[0], 0)}{flagBar(hud.flag[0], 0)}
            </span>
            <span className="sb-clock">
              <b>{Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}</b>
              {m.slope.wind && <span className="sb-wind">wind {hud.wind > 0 ? '→' : '←'} {Math.abs(hud.wind).toFixed(0)}</span>}
            </span>
            <span className="sb-team sb-side1">
              {flagBar(hud.flag[1], 1)}{balls(hud.ammo[1], 1)}
              <span className="sb-who">{versus ? 'Player 2' : theirNames}</span>
            </span>
          </>)}
        </header>
        <div className="sb-stage">
          <canvas ref={canvasRef} className="sb-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { dragRef.current = null; matchRef.current?.aim(0, false); }} aria-label="The valley between the two forts" />
          {banner && <span key={banner.key} className="sb-banner" onAnimationEnd={() => setBanner(null)}>{banner.text}</span>}
        </div>
        <footer className="sb-bottom">
          <p className="sb-tip" aria-live="polite">
            {upright ? 'Turn your phone sideways to see the whole valley.' : hud?.hard ? 'Hard snowball packed: it takes out a cross of cubes!' : hud?.busy === 'dig' ? 'Scooping…' : hud?.busy === 'floor' ? 'Rolling a snowball from the floor snow…' : tip ? <>{!versus && <b>Enzo: </b>}{tip}</> : ''}
          </p>
          <div className="sb-buttons">
            {!versus && <button onClick={() => { const mm = matchRef.current; if (mm && mm.switchTo(0)) sfx()?.button(); }} title="Switch (Tab or Q)">Switch</button>}
            <button onClick={() => { const mm = matchRef.current; if (mm && !mm.over && mm.ammo[0] < G.POOL && mm.scoopFloor(0)) sfx()?.button(); else sfx()?.no(); }} title="Roll a snowball from the floor snow">Floor snow</button>
            <button onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }} title="Pause (Esc)">{paused ? 'Play' : 'Pause'}</button>
          </div>
        </footer>
        {screen === 'play' && paused && (
          <div className="sb-pause">
            <div className="sb-panel">
              <h2>Paused</h2>
              <div className="sb-row">
                <button className="sb-go" onClick={() => { pausedRef.current = false; setPaused(false); }}>Play on</button>
                <button onClick={() => go('howto')}>How to play</button>
                <button onClick={() => { pausedRef.current = false; setPaused(false); go(versus ? 'title' : 'slopes'); }}>Leave the match</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {screen === 'title' && (
        <section className="sb-title">
          <img className="sb-title-art" src={ART + 'title.webp'} alt="Dora and Enzo behind their snow fort, snowballs ready" />
          <div className="sb-title-menu">
            <h1>Snowball<br />Siege</h1>
            <p>Dig your snowballs out of your own walls. Knock the top off their flag tower.</p>
            <button className="sb-go" onClick={() => go(save.won.sunny || save.tips === false ? 'slopes' : 'howto')}>Play</button>
            <button onClick={() => { sfx()?.button(); start('versus'); }}>Versus (2 players)</button>
            <button onClick={() => go('howto')}>How to play</button>
            <button onClick={() => go('settings')}>Settings</button>
            <a className="sb-home" href="/">← Arcade</a>
          </div>
        </section>
      )}

      {screen === 'slopes' && (
        <section className="sb-slopes">
          <div className="sb-head"><h2>Pick a slope</h2><button onClick={() => go('title')}>Back</button></div>
          <div className="sb-grid">
            {G.SLOPES.map((sl) => {
              const open = G.unlocked(save, sl.n), bits = save.stars[sl.id] ?? 0;
              return (
                <button key={sl.id} className={`sb-card${open ? '' : ' sb-locked'}`} disabled={!open} onClick={() => { sfx()?.button(); start(sl.id); }}>
                  <span className="sb-pic">{thumbs[sl.rival.species] ? <img src={thumbs[sl.rival.species]} alt={`A ${SPECIES_NAME[sl.rival.species]}`} /> : null}</span>
                  <span className="sb-card-words">
                    <b>{sl.n}. {sl.name}</b>
                    <span>{open ? sl.rival.blurb : 'Win the slope before to open this one.'}</span>
                    <span className="sb-stars-mini">{[1, 2, 4].map((k) => <i key={k} className={bits & k ? 'on' : ''}>★</i>)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {screen === 'result' && result()}

      {screen === 'howto' && (
        <section className="sb-sheet">
          <div className="sb-panel sb-wide">
            <h2>How to play</h2>
            <p>Two snow forts, one valley. <b>Knock the top three layers off their flag tower</b> and their flag falls. At two minutes, the tower with more of its top left wins.</p>
            <p><b>Snowballs come out of your own walls.</b> Click (or tap) a cube of your fort near you to scoop it: fast, but it leaves a hole. The floor snow is slow but costs no wall. You carry five.</p>
            <p><b>Throw:</b> drag back from the valley and let go, like a slingshot. You only see the start of the arc. Hold still for a second to pack a <b>hard snowball</b>: it costs two and takes out a cross of five cubes.</p>
            <p><b>Patch:</b> right-click (or long-press) a gap in your wall to pat a snowball back in.</p>
            <p><b>Duck:</b> anyone standing to throw can be hit and sees stars for a moment. Switch to your other chinchilla with Tab, Q or a tap; the one waiting stays down and rolls snowballs from the floor.</p>
            <p className="sb-dim">Keys: A/D walk, W/S angle, hold F to throw, G to scoop. Versus: player 2 on the arrows, hold . to throw, , to scoop.</p>
            <div className="sb-row"><button className="sb-go" autoFocus onClick={() => { if (backRef.current === 'title' && !save.won.sunny) { sfx()?.button(); setScreen('slopes'); } else setScreen(backRef.current); }}>{backRef.current === 'title' && !save.won.sunny ? 'Let’s go' : 'Back'}</button></div>
          </div>
        </section>
      )}

      {screen === 'settings' && (
        <section className="sb-sheet">
          <div className="sb-panel">
            <h2>Settings</h2>
            <label className="sb-toggle"><input type="checkbox" checked={save.settings.sound} onChange={(e) => { const s = saveRef.current; s.settings.sound = e.target.checked; sfx()?.setSound(e.target.checked); persist(s); }} /> Sound</label>
            <label className="sb-toggle"><input type="checkbox" checked={save.settings.music} onChange={(e) => { const s = saveRef.current; s.settings.music = e.target.checked; sfx()?.setMusic(e.target.checked); persist(s); }} /> Music</label>
            <label className="sb-toggle"><input type="checkbox" checked={save.settings.motion} onChange={(e) => { const s = saveRef.current; s.settings.motion = e.target.checked; if (sceneRef.current) sceneRef.current.reduced = !e.target.checked; persist(s); }} /> Camera shake and sway</label>
            <label className="sb-toggle"><input type="checkbox" checked={save.tips} onChange={(e) => { const s = saveRef.current; s.tips = e.target.checked; persist(s); }} /> Enzo’s tips</label>
            <div className="sb-row"><button className="sb-go" onClick={() => setScreen(backRef.current)}>Back</button></div>
          </div>
        </section>
      )}
    </main>
  );
}
