'use client';
// Pixel Smith: the page. Enzo's easel between rooms (painting the 12 by 12 grid, the paint pots, quick sketches,
// patching Dora's fur), the fixed-step loop for the fights (WASD or a thumb stick to move, the mouse to aim, click
// or SWING to swing, right-click, Space or ROLL to roll), the HUD, Enzo's pointers, the sketchbook between places,
// results, the ending and the save. Rules in lib/smith-game.ts, drawing in lib/smith-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/smith-game';
import type { Ev, Paint, PerkId, Run, Save } from '@/lib/smith-game';
import type { SmithScene } from '@/lib/smith-scene';
import { SmithSound, type SongId } from './sound';
import './smith.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Line = { text: string; key: number; mood: '' | 'warn' | 'good' };
type Result = { won: boolean; rooms: number; kills: number; pixels: number; biggest: number; secs: number; best: boolean };
type Brush = Paint | 'rubber';

const art = (n: string) => `/art/smith/${n}.png`;
const INTRO = [
  'Dora’s off to clear the critters out of the old mine, and I’m making her weapon! Whatever I paint here, she fights with.',
  'Its shape is exactly what it hits: long reaches far, wide sweeps wide. Pixels far from her paw hit hardest.',
  'Colours do things too. Gold cuts, stone shoves, blue freezes, red burns and green grows Dora’s fur back.',
  'Critters burst into loose pixels: that’s my paint for next time. But Dora’s fur is her health, and I patch it with the same paint. A huge weapon leaves less for fur!',
];
/** which room of its place a room is, counting from 1 */
const nth = (room: number) => room - (room >= 6 ? 6 : room >= 3 ? 3 : 0) + 1;
const PLACE: Record<G.FloorId, string> = {
  mine: 'The Pebble Mine. Pebble Beetles plod, Glint Magpies swoop. Draw something with reach!',
  cellar: 'The Frost Cellar. Frost Newts spit ice: a wide weapon held out front blocks it, but loses the pixel it hits.',
  forge: 'The Ember Forge. Get the Moss Tortoises first, they heal the others. And somewhere in here is the Smudge…',
};

export default function PixelSmithPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SmithScene | null>(null);
  const sceneMod = useRef<typeof import('@/lib/smith-scene') | null>(null);
  const soundRef = useRef<SmithSound | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const runRef = useRef<Run | null>(null);
  const [phase, setPhaseState] = useState<G.Phase>('easel');
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [intro, setIntro] = useState(-1);
  const introRef = useRef(-1);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [touch, setTouch] = useState(false);
  const [tick, setTick] = useState(0);
  const [brush, setBrush] = useState<Brush>('gold');
  const keys = useRef(new Set<string>());
  /** where the mouse is, in game pixels */
  const aim = useRef({ x: 192, y: 60 });
  const mouseDown = useRef(false);
  const rollTap = useRef(false);
  const swingBtn = useRef(false);
  const stick = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const painting = useRef<'paint' | 'erase' | null>(null);
  const reduced = useRef(false);
  const said = useRef(new Set<string>());
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPhase = useCallback((p: G.Phase) => setPhaseState(p), []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const sfx = () => soundRef.current;
  const redraw = () => setTick((x) => x + 1);
  const say = useCallback((text: string, mood: Line['mood'] = '', once?: string) => {
    if (once) { if (said.current.has(once)) return; said.current.add(once); }
    setLine({ text, key: Math.random(), mood }); sfx()?.enzo(text);
  }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new SmithSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/smith-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      sceneMod.current = m;
      const sc = new m.SmithScene(canvasRef.current); sceneRef.current = sc;
      void sc.load().then(() => { if (!gone) redraw(); }); setReady(true);
    });
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'play' && runRef.current?.phase === 'fight') setPaused(true); } else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
  }, [setPaused]);

  // the music: one loop for each place, the easel and the Smudge
  useEffect(() => {
    const r = runRef.current;
    const song: SongId | null = screen === 'play' && r ? (phase === 'easel' || phase === 'pick' ? 'easel' : r.boss ? 'boss' : r.floor.id) : screen === 'result' ? (result?.won ? 'ending' : null) : 'title';
    sfx()?.music(song);
  }, [screen, result, phase]);

  // fit the fight to the window, at a whole number of screen pixels per game pixel when that is close enough
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      const pad = touch && innerHeight > innerWidth ? 210 : 0;
      const aw = innerWidth, ah = innerHeight - pad;
      let s = Math.min(aw / G.W, ah / G.H); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      st.style.width = `${Math.floor(G.W * s)}px`; st.style.height = `${Math.floor(G.H * s)}px`;
      st.style.top = pad ? `${Math.max(48, Math.floor((ah - G.H * s) / 2))}px` : '';
    };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [touch, screen]);

  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the run
  const easelHint = useCallback((r: Run) => {
    if (r.room === 0 && !r.stat.pixels) say(touch ? 'Pick a paint, then tap squares next to the handle to grow the weapon. Or tap a sketch to start from one!' : 'Pick a paint, then click squares next to the handle to grow the weapon (drag to paint lots). Or start from a sketch!');
    else if (r.dora.fur < r.furMax * 0.5) say(`Dora’s lost a lot of fur! Patch her up with some paint before you go.`, 'warn');
    else if (r.room === 3 || r.room === 6) say(PLACE[r.floor.id], 'good');
    else say('Fancy changing anything? Tap a pixel again to rub it out: the paint goes back in the pot.');
  }, [say, touch]);

  const startRun = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const r = new G.Run((Date.now() & 0xffffff) | 1);
    runRef.current = r; said.current.clear();
    setPaused(false); setResult(null); setLine(null); setPhase('easel'); setBrush('gold');
    setScreen('play');
    if (!saveRef.current.intro) { introRef.current = 0; setIntro(0); sfx()?.enzo(INTRO[0]); }
    else easelHint(r);
  }, [easelHint, setPaused, setPhase, setScreen]);

  const nextIntro = useCallback(() => {
    if (introRef.current < 0) return; sfx()?.button();
    const n = introRef.current + 1;
    if (n >= INTRO.length) { introRef.current = -1; setIntro(-1); persist({ ...saveRef.current, intro: true }); if (runRef.current) easelHint(runRef.current); return; }
    introRef.current = n; setIntro(n); sfx()?.enzo(INTRO[n]);
  }, [easelHint, persist]);

  const finish = useCallback(() => {
    const r = runRef.current; if (!r) return;
    const s: Save = JSON.parse(G.serialise(saveRef.current));
    const before = s.best.rooms; G.bank(s, r); persist(s);
    const won = r.phase === 'won';
    setResult({ won, rooms: r.stats.rooms, kills: r.stats.kills, pixels: r.stats.pixels, biggest: r.stats.biggest, secs: Math.round(r.stats.time), best: s.best.rooms > before });
    sfx()?.stinger(won);
    setScreen('result');
  }, [persist, setScreen]);

  const fight = useCallback(() => {
    const r = runRef.current; if (!r || r.phase !== 'easel') return;
    if (!r.stat.pixels && !said.current.has('bare')) { said.current.add('bare'); sfx()?.no(); say('Just a handle? Dora can bonk with it, but it’s tiny. Press Fight again if you’re sure!', 'warn'); return; }
    sfx()?.unlock(); sfx()?.button();
    persist({ ...saveRef.current, last: G.cellsCode(r.cells) });
    r.fight(); setPhase('fight'); setLine(null); stick.current = null; setKnob(null);
    const f = r.floor, first = r.room === 0 || r.room === G.PER_FLOOR[0] || r.room === G.PER_FLOOR[0] + G.PER_FLOOR[1];
    setBanner({ text: r.boss ? 'The Smudge!' : `${f.name}${first ? '' : ` · ${nth(r.room)}`}`, key: Math.random() });
    if (r.boss) say('That’s the Smudge! Its rub wipes pixels off the weapon. Stay out of the pink patch!', 'warn');
    else say(touch ? 'Move with the stick, hold SWING. Dora aims at the nearest critter!' : 'WASD to move, the mouse to aim, click (or hold) to swing, Space or right-click to roll!', '', 'controls');
  }, [persist, say, setPhase, touch]);

  const onEvents = useCallback((r: Run, evs: Ev[]) => {
    const snd = sfx();
    sceneRef.current?.events(r, evs, reduced.current);
    for (const e of evs) {
      switch (e.k) {
        case 'swing': snd?.swing(r.sw.len); break;
        case 'hit': snd?.hit(e.c, e.n); break;
        case 'kill': snd?.pop(e.foe === 'smudge'); break;
        case 'pick': snd?.pick(e.c); break;
        case 'roll': snd?.roll(); break;
        case 'hurt':
          snd?.hurt();
          if (r.dora.fur > 0 && r.dora.fur <= r.furMax * 0.3) say('Dora’s nearly out of fur! Roll away, and patch her up at the easel.', 'warn', 'low');
          break;
        case 'shoot': snd?.shoot(); break;
        case 'block': snd?.block(); say('Blocked! But the ice knocked a pixel off. Pick it back up!', 'good', 'block'); break;
        case 'chip': snd?.chip(); break;
        case 'wind': snd?.wind(); break;
        case 'dash': snd?.dash(); break;
        case 'rub': snd?.rub(); say('It rubbed pixels clean off! They’re on the floor: grab them back.', 'warn', 'rub'); break;
        case 'spawn': snd?.spawn(); break;
        case 'freeze': snd?.freeze(); say('Frozen solid! It can’t move or bite until it thaws.', 'good', 'freeze'); break;
        case 'heal': snd?.heal(); break;
        case 'clear':
          snd?.clear();
          if (r.phase === 'pick') { setPhase('pick'); say('That’s a whole place cleared! Let me open my sketchbook…', 'good'); }
          else if (r.phase === 'easel') { setPhase('easel'); easelHint(r); }
          break;
      }
    }
  }, [easelHint, say, setPhase]);

  const nearestFoe = (r: Run) => {
    let best: G.Foe | null = null, bd = 1e9;
    for (const f of r.foes) { if (f.mode === 'spawn') continue; const d = Math.hypot(f.x - r.dora.x, f.y - r.dora.y); if (d < bd) { bd = d; best = f; } }
    return best;
  };
  const readInput = useCallback((r: Run): G.Input => {
    const k = keys.current;
    let mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    const s = stick.current;
    if (s) { const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy); if (l > 6) { const m = Math.min(1, l / 40); mx = (dx / l) * m; my = (dy / l) * m; } }
    let ax = aim.current.x, ay = aim.current.y;
    // a finger can't aim and move at once, so Dora aims at the nearest critter (or the way she's going)
    if (touch) {
      const f = nearestFoe(r);
      if (f) { ax = f.x; ay = f.y - f.r * 0.6; } else if (mx || my) { ax = r.dora.x + mx * 40; ay = r.dora.y - 6 + my * 40; } else { ax = r.dora.x + Math.cos(r.aim) * 40; ay = r.dora.y - 6 + Math.sin(r.aim) * 40; }
    }
    const roll = rollTap.current; rollTap.current = false;
    return { mx, my, ax, ay, swing: mouseDown.current || swingBtn.current || k.has('KeyJ') || k.has('Enter'), roll };
  }, [touch]);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const snd = sfx(); snd?.pump();
      const r = runRef.current, sc = sceneRef.current;
      if (screenRef.current !== 'play' || !r || !sc) return;
      const going = !pausedRef.current && introRef.current < 0 && r.phase === 'fight';
      if (going) {
        acc += dt; let n = 0;
        while (acc >= G.DT && n < 6) {
          r.tick(readInput(r));
          if (r.events.length) onEvents(r, r.events); acc -= G.DT; n++; if (r.phase !== 'fight') break;
        }
      } else acc = 0;
      if (r.over) { endT += dt; if (endT > 1.6) { endT = 0; finish(); return; } } else endT = 0;
      if (r.phase !== 'easel') sc.render({ run: r, time: now / 1000, dt: going ? dt : 0, reduced: reduced.current });
      // the HUD, straight to the DOM
      const h = hud.current;
      if (h.fur) h.fur.style.transform = `scaleX(${Math.max(0, r.dora.fur / r.furMax)})`;
      if (h.furN) { const t = `${Math.ceil(r.dora.fur)}`; if (h.furN.textContent !== t) h.furN.textContent = t; }
      if (h.furBox) h.furBox.dataset.low = r.dora.fur <= r.furMax * 0.3 ? '1' : '0';
      for (const p of G.PAINTS) { const el = h[`pot-${p}`]; if (el) { const t = String(r.paint[p]); if (el.textContent !== t) el.textContent = t; } }
      const boss = r.foes.find((f) => f.k === 'smudge');
      if (h.boss) { h.boss.style.display = boss ? '' : 'none'; if (boss && h.bossBar) h.bossBar.style.transform = `scaleX(${Math.max(0, boss.hp / boss.max)})`; }
      if (h.waves) { const t = `Wave ${Math.min(r.wave, r.waves.length)} of ${r.waves.length}`; if (h.waves.textContent !== t) h.waves.textContent = t; }
      // meet each new kind of critter once, ever
      for (const k of r.seen) if (!saveRef.current.seen.includes(k)) { persist({ ...saveRef.current, seen: [...saveRef.current.seen, k] }); say(`${G.FOES[k].name}! ${G.FOES[k].text}`, k === 'smudge' ? 'warn' : ''); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, onEvents, readInput, persist, say]);

  // ---------------------------------------------------------------- the easel
  const r = runRef.current;
  useEffect(() => {
    // the little preview of Dora holding what Enzo's drawn
    const c = previewRef.current, m = sceneMod.current; if (!c || !r || !m) return;
    const x = c.getContext('2d')!; x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
    const pic = m.weaponPicture(r.cells), dora = new Image(); dora.src = art('dora-stand');
    const draw = () => {
      x.clearRect(0, 0, c.width, c.height);
      // Dora at the bottom left, holding it the way it was drawn
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(16, 61, 8, 2.5, 0, 0, Math.PI * 2); x.fill();
      if (dora.complete && dora.naturalWidth) x.drawImage(dora, 16 - Math.round(dora.naturalWidth / 2), 62 - dora.naturalHeight);
      m.drawWeapon(x, pic, 16 + 2.8, 62 - 6 - 2.8, -Math.PI / 4);
    };
    if (dora.complete) draw(); else dora.onload = draw;
  });

  const paintAt = useCallback((i: number, start: boolean) => {
    const run = runRef.current; if (!run || run.phase !== 'easel' || introRef.current >= 0) return;
    if (start) painting.current = brush === 'rubber' || run.cells[i] === brush ? 'erase' : 'paint';
    const mode = painting.current; if (!mode) return;
    if (mode === 'erase') { if (run.eraseCell(i)) { sfx()?.rubber(); redraw(); } return; }
    if (brush === 'rubber' || i === G.GRIP) return;
    if (run.paintCell(i, brush)) { sfx()?.dab(brush); redraw(); return; }
    if (!start) return;
    sfx()?.no();
    if (run.paint[brush] <= 0) say(`No ${G.PAINT[brush].name.toLowerCase()} paint left! ${brush === 'gold' ? 'Glint Magpies burst into gold.' : brush === 'grey' ? 'Pebble Beetles burst into stone.' : brush === 'blue' ? 'Frost Newts burst into blue.' : brush === 'red' ? 'Ember Salamanders burst into red.' : 'Moss Tortoises burst into green.'}`, 'warn');
    else say('Pixels have to touch the handle, or touch a pixel that does (corners count).', 'warn');
  }, [brush, say]);
  const cellFrom = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const i = el?.dataset.cell; return i === undefined ? -1 : Number(i);
  };
  const sketch = (shape: string) => {
    const run = runRef.current; if (!run) return;
    const pref: Paint[] = brush === 'rubber' ? ['gold', 'grey', 'blue', 'red', 'green'] : [brush, 'gold', 'grey', 'blue', 'red', 'green'];
    run.sketch(shape, pref); sfx()?.dab(brush === 'rubber' ? 'gold' : brush); redraw();
  };
  const again = () => { const run = runRef.current; if (!run || !saveRef.current.last) return; G.redraw(run, saveRef.current.last); sfx()?.dab('gold'); redraw(); };
  const clearAll = () => { runRef.current?.clearWeapon(); sfx()?.rubber(); redraw(); };
  const patch = () => {
    const run = runRef.current; if (!run) return;
    const c: Paint = brush !== 'rubber' && run.paint[brush] > 0 ? brush : G.PAINTS.slice().sort((a, b) => run.paint[b] - run.paint[a])[0];
    if (run.patch(c)) { sfx()?.patch(); redraw(); } else sfx()?.no();
  };

  const pickPerk = useCallback((id?: PerkId) => {
    const run = runRef.current; if (!run || !run.pick(id)) return;
    sfx()?.perk(); setPhase('easel'); redraw(); easelHint(run);
  }, [easelHint, setPhase]);

  // ---------------------------------------------------------------- keyboard, mouse and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      if (screenRef.current !== 'play') return;
      const run = runRef.current;
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
      if (introRef.current >= 0) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextIntro(); } return; }
      if (run?.phase === 'pick') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && run.offer[i]) pickPerk(run.offer[i]); return; }
      if (run?.phase === 'easel') {
        const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code); if (i >= 0) { setBrush(G.PAINTS[i]); sfx()?.button(); }
        if (e.code === 'KeyE' || e.code === 'Digit0') { setBrush('rubber'); sfx()?.button(); }
        if (e.code === 'Enter' && !e.repeat) fight();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!pausedRef.current); return; }
      keys.current.add(e.code);
      if (!e.repeat && (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyK')) rollTap.current = true;
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); mouseDown.current = false; swingBtn.current = false; painting.current = null; };
    const mup = () => { mouseDown.current = false; painting.current = null; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur); addEventListener('pointerup', mup);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); removeEventListener('pointerup', mup); };
  }, [fight, nextIntro, pickPerk, setPaused]);

  const toGame = (e: React.PointerEvent) => { const c = canvasRef.current!.getBoundingClientRect(); return { x: (e.clientX - c.left) * (G.W / c.width), y: (e.clientY - c.top) * (G.H / c.height) }; };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') aim.current = toGame(e); };
  const onDown = (e: React.PointerEvent) => {
    sfx()?.unlock();
    if (e.pointerType !== 'mouse') return;
    aim.current = toGame(e);
    if (e.button === 0) mouseDown.current = true;
    if (e.button === 2) rollTap.current = true;
  };
  // the thumb stick appears wherever the thumb lands
  const stickDown = (e: React.PointerEvent) => {
    e.preventDefault(); sfx()?.unlock();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    stick.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    setKnob({ x: e.clientX - b.left, y: e.clientY - b.top });
  };
  const stickMove = (e: React.PointerEvent) => { const s = stick.current; if (!s || s.id !== e.pointerId) return; s.x = e.clientX; s.y = e.clientY; const el = hud.current.knob; if (el) { const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy), m = Math.min(l, 40) / (l || 1); el.style.transform = `translate(${dx * m}px,${dy * m}px)`; } };
  const stickUp = (e: React.PointerEvent) => { if (stick.current?.id === e.pointerId) { stick.current = null; setKnob(null); } };
  const sb = {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); swingBtn.current = true; sfx()?.unlock(); },
    onPointerUp: () => { swingBtn.current = false; }, onPointerCancel: () => { swingBtn.current = false; }, onPointerLeave: () => { swingBtn.current = false; },
  };
  const setSetting = (k: 'sound' | 'music', v: boolean) => { const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s); if (k === 'sound') sfx()?.setSound(v); else sfx()?.setMusic(v); };
  const giveUp = () => { const run = runRef.current; if (!run) return; setPaused(false); run.dora.fur = 0; run.phase = 'lost'; finish(); };

  // ---------------------------------------------------------------- test hook
  useEffect(() => {
    (window as unknown as { __smith: () => unknown }).__smith = () => {
      const run = runRef.current;
      return {
        screen: screenRef.current, paused: pausedRef.current, intro: introRef.current, save: saveRef.current, result, line, brush,
        run: run && screenRef.current === 'play' ? { room: run.room, phase: run.phase, fur: run.dora.fur, furMax: run.furMax, paint: { ...run.paint }, cells: G.cellsCode(run.cells), stat: run.stat, offer: [...run.offer], perks: { ...run.perks }, floor: run.floor.id, dora: { x: run.dora.x, y: run.dora.y }, aim: run.aim, foes: run.foes.map((f) => ({ k: f.k, x: f.x, y: f.y, hp: f.hp, mode: f.mode })), loose: run.loose.length, swings: run.sw.n, wave: run.wave, waves: run.waves.length, stats: { ...run.stats } } : null,
        debug: {
          win: () => { if (run && run.phase === 'fight') { for (const f of run.foes) f.hp = 0.001; run.foes.forEach((f) => { f.burn = 1; f.mode = 'walk'; }); run.wave = run.waves.length; } },
          fur: (v: number) => { if (run) run.dora.fur = v; },
          paint: (p: Partial<Record<Paint, number>>) => { if (run) { Object.assign(run.paint, p); redraw(); } },
          room: (n: number) => { if (run && run.phase === 'easel') { run.room = n; redraw(); } },
          tp: (x: number, y: number) => { if (run) Object.assign(run.dora, { x, y }); },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save;
  void tick;
  const st = r ? r.stat : null;
  const ok = (i: number) => !!r && !r.cells[i] && i !== G.GRIP && G.around(i).some((n) => n === G.GRIP || !!r.cells[n]);
  const placeName = r ? (r.boss ? 'The Smudge’s lair' : `${r.floor.name}`) : '';
  return <main className={`ps-shell ps-on-${screen} ps-ph-${phase}${touch ? ' ps-touch' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen} data-phase={phase} onContextMenu={(e) => e.preventDefault()}>
    <div className="ps-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="ps-canvas" aria-label="Pixel Smith: the fight, with Dora and her weapon" onPointerMove={onMove} onPointerDown={onDown} />
      {screen === 'play' && r && phase !== 'easel' && <div className="ps-hud">
        <div className="ps-top">
          <div className="ps-fur" ref={H('furBox')} data-low="0"><img src={art('dora-portrait')} alt="" /><span className="ps-track"><i ref={H('fur')} /></span><b ref={H('furN')}>0</b><span className="ps-unit">fur</span></div>
          <div className="ps-pots" aria-label="Paint">{G.PAINTS.map((p) => <span key={p} className="ps-pot" data-paint={p}><i /><b ref={H(`pot-${p}`)}>0</b></span>)}</div>
          <div className="ps-where"><b>{placeName}</b><span ref={H('waves')}>Wave 1</span></div>
          <button className="ps-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
        </div>
        <div className="ps-boss" ref={H('boss')} style={{ display: 'none' }}><b>The Smudge</b><span className="ps-track"><i ref={H('bossBar')} /></span></div>
        {banner && <div className="ps-banner" key={banner.key}>{banner.text}</div>}
        {line && intro < 0 && phase === 'fight' && <div className={`ps-line ${line.mood}`} key={line.key}>
          <img src={art('enzo-portrait')} alt="" /><p><b>Enzo</b>{line.text}</p>
        </div>}
        {!touch && phase === 'fight' && <p className="ps-keys"><b>WASD</b> move · <b>mouse</b> aims · <b>click</b> swings · <b>Space</b> or <b>right-click</b> rolls · Esc pause</p>}
        {phase === 'pick' && <div className="ps-overlay"><div className="ps-pick">
          <h2>Enzo’s sketchbook</h2>
          <p>A whole place cleared! Enzo flips to a new idea. Pick one:</p>
          <div className="ps-offers">{r.offer.map((id, i) => { const p = G.PERKS.find((x) => x.id === id)!; return <button key={id} className="ps-card ps-offer" data-perk={id} onClick={() => pickPerk(id)}>
            {!touch && <kbd>{i + 1}</kbd>}<b>{p.name}</b><span>{p.text}</span>
          </button>; })}</div>
        </div></div>}
        {paused && <div className="ps-overlay"><div className="ps-card ps-pausecard">
          <h2>Paused</h2>
          <button className="ps-go" onClick={() => setPaused(false)}>Keep fighting</button>
          <button onClick={giveUp}>End this run</button>
        </div></div>}
      </div>}
    </div>

    {screen === 'play' && touch && phase === 'fight' && <div className="ps-touchpad">
      <div className="ps-stickzone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
        {knob ? <div className="ps-stick" style={{ left: knob.x, top: knob.y }}><i ref={H('knob')} /></div> : <p>Put your thumb here and slide to move</p>}
      </div>
      <div className="ps-btns">
        <button className="ps-roll" onPointerDown={(e) => { e.preventDefault(); rollTap.current = true; sfx()?.unlock(); }}>ROLL</button>
        <button className="ps-swing" {...sb}>SWING</button>
      </div>
    </div>}

    {screen === 'play' && r && phase === 'easel' && st && <section className="ps-easel">
      <div className="ps-bg"><img src={art('shop')} alt="" /></div>
      <header className="ps-ehead">
        <div><h2>Enzo’s easel</h2><span>Next: {r.boss ? 'the Smudge’s lair' : `${r.floor.name}, room ${nth(r.room)} of 3`} · room {r.room + 1} of {G.ROOMS}</span></div>
        <button className="ps-go ps-fightbtn" onClick={fight}>Fight ›</button>
      </header>
      <div className="ps-ebody">
        <div className="ps-col ps-left">
          <div className="ps-enzo"><img src={art('enzo-paint')} alt="Enzo with his paintbrush" />
            {line && intro < 0 && <p className={`ps-say ${line.mood}`} key={line.key}>{line.text}</p>}
          </div>
          <div className="ps-card ps-dora">
            <img src={art('dora-portrait')} alt="Dora" />
            <div><b>Dora’s fur</b><span className="ps-track big"><i style={{ transform: `scaleX(${r.dora.fur / r.furMax})` }} /></span><span>{Math.ceil(r.dora.fur)} of {r.furMax}</span></div>
            <button onClick={patch} disabled={r.dora.fur >= r.furMax || G.PAINTS.every((p) => r.paint[p] <= 0)}>Patch fur <small>1 paint → {r.perks.patch ? 4 : G.PATCH}</small></button>
          </div>
        </div>
        <div className="ps-col ps-mid">
          <div className="ps-grid" role="grid" aria-label="The weapon, 12 by 12. The handle is at the bottom left."
            onPointerDown={(e) => { const i = cellFrom(e); if (i >= 0) { e.preventDefault(); paintAt(i, true); } }}
            onPointerMove={(e) => { if (painting.current && (e.buttons || e.pointerType !== 'mouse')) { const i = cellFrom(e); if (i >= 0) paintAt(i, false); } }}>
            {r.cells.map((c, i) => <button key={i} data-cell={i} tabIndex={-1} className={`ps-cell${i === G.GRIP ? ' grip' : ''}${ok(i) ? ' ok' : ''}`} data-paint={i === G.GRIP ? 'wood' : c ?? undefined} aria-label={i === G.GRIP ? 'handle' : c ?? 'empty'} />)}
          </div>
        </div>
        <div className="ps-col ps-right">
          <div className="ps-card ps-brushes">
            {G.PAINTS.map((p, k) => <button key={p} className={`ps-brush${brush === p ? ' on' : ''}`} data-paint={p} onClick={() => { setBrush(p); sfx()?.dab(p); }} title={G.PAINT[p].text}>
              <i /><b>{r.paint[p]}</b><span>{G.PAINT[p].name}{!touch && <kbd>{k + 1}</kbd>}</span>
            </button>)}
            <button className={`ps-brush rubber${brush === 'rubber' ? ' on' : ''}`} onClick={() => { setBrush('rubber'); sfx()?.rubber(); }}><i /><span>Rubber{!touch && <kbd>E</kbd>}</span></button>
          </div>
          {brush !== 'rubber' && <p className="ps-tip">{G.PAINT[brush].text}</p>}
          <div className="ps-card ps-wstats">
            <canvas ref={previewRef} width={64} height={64} className="ps-preview" aria-label="Dora holding the weapon" />
            <ul>
              <li><b>{st.pixels}</b> pixels</li>
              <li><b>{st.reach}</b> reach</li>
              <li><b>{st.swing.toFixed(2)}s</b> a swing</li>
              <li><b>{Math.round(st.speed / 78 * 100)}%</b> speed</li>
            </ul>
          </div>
          <div className="ps-sketches">
            {Object.entries(G.SHAPES).map(([k, v]) => <button key={k} onClick={() => sketch(k)}>{v.name}</button>)}
            {s.last && <button onClick={again}>Last one</button>}
            <button onClick={clearAll}>Clear</button>
          </div>
        </div>
      </div>
      {intro >= 0 && <div className="ps-overlay"><div className="ps-card ps-introcard" onClick={nextIntro} role="button" tabIndex={0}>
        <img src={art('enzo-portrait')} alt="Enzo" />
        <div><b>Enzo</b><p>{INTRO[intro]}</p><small>{intro + 1}/{INTRO.length} · {touch ? 'tap' : 'click or Enter'} ›</small></div>
      </div></div>}
    </section>}

    {screen === 'title' && <section className="ps-title">
      <div className="ps-bg"><img src={art('title')} alt="Dora swings a big pixel sword and a stone beetle bursts into pixels, while Enzo paints the sword at his easel" /></div>
      <div className="ps-title-col">
        <h1 className="ps-logo">Pixel Smith</h1>
        <p className="ps-tag">Enzo draws Dora’s weapon pixel by pixel. Its shape is what it hits, its colours are its powers, and every critter bursts into paint for the next one.</p>
        <div className="ps-menu">
          <button className="ps-go" onClick={startRun}>{s.stats.runs ? 'New run' : 'Start'}</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
        </div>
        {s.stats.runs > 0 && <p className="ps-small">Best: {Math.min(s.best.rooms, G.ROOMS)} of {G.ROOMS} rooms · {s.best.kills} critters · biggest weapon {s.best.biggest} pixels{s.stats.wins ? ` · ${s.stats.wins} ${s.stats.wins === 1 ? 'win' : 'wins'}` : ''}</p>}
        <a className="ps-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'result' && result && <section className={`ps-page ps-result ${result.won ? 'won' : 'lost'}`}>
      {result.won && <div className="ps-bg"><img src={art('ending')} alt="Dora holds up her pixel sword in Enzo’s workshop while the Smudge sulks in the corner" /></div>}
      <div className="ps-card ps-resultcard">
        <h2>{result.won ? 'The Smudge is rubbed out!' : 'Dora’s out of fur'}</h2>
        <p>{result.won ? 'The mine, the cellar and the forge are critter-free. Enzo hangs the weapon on the workshop wall, and starts sketching the next one.' : `Enzo wraps her in a blanket and gets out a fresh sheet of paper. She cleared ${result.rooms} of ${G.ROOMS} rooms${result.best ? ', her best yet!' : '.'}`}</p>
        <ul className="ps-stats">
          <li><b>{result.rooms}</b><span>rooms</span></li><li><b>{result.kills}</b><span>critters</span></li><li><b>{result.pixels}</b><span>pixels picked up</span></li><li><b>{result.biggest}</b><span>biggest weapon</span></li><li><b>{Math.floor(result.secs / 60)}:{String(result.secs % 60).padStart(2, '0')}</b><span>fighting</span></li>
        </ul>
        <div className="ps-row"><button className="ps-go" onClick={startRun}>Again ›</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="ps-page">
      <header className="ps-head"><button onClick={() => go('title')}>‹ Title</button><h2>How to play</h2></header>
      <div className="ps-cols">
        <div className="ps-card"><h3>The easel</h3><ul>
          <li>Before every room, Enzo paints Dora’s weapon on a <b>12 by 12</b> grid. The handle is the bottom-left square.</li>
          <li>Pick a paint and {touch ? 'tap' : 'click'} a square next to the handle, or next to a pixel joined to it (corners count). {touch ? 'Slide' : 'Drag'} to paint lots. Tap a pixel again, or use the rubber, to take it off: the paint goes back in the pot.</li>
          <li>The <b>shape is the hitbox</b>: wherever there’s a pixel, it hits. Pixels further from her paw <b>hit harder</b>.</li>
          <li>More pixels means a <b>heavier</b> weapon: slower swings and slower feet.</li>
          <li>Dora’s <b>fur</b> is her health. Bumps knock it off; <b>Patch fur</b> spends paint to grow it back.</li>
        </ul></div>
        <div className="ps-card"><h3>The colours</h3>
          {G.PAINTS.map((p) => <div key={p} className="ps-foe"><i className="ps-swatch" data-paint={p} /><p><b>{G.PAINT[p].name}</b>{G.PAINT[p].text}</p></div>)}
        </div>
        <div className="ps-card"><h3>The fights</h3><ul>
          <li>{touch ? <>Slide the <b>thumb stick</b> to move and hold <b>SWING</b>. Dora aims at the nearest critter by herself. <b>ROLL</b> dodges through anything.</> : <><b>WASD</b> or the arrows move, the <b>mouse</b> aims, <b>click</b> (or hold) swings, and <b>Space</b> or <b>right-click</b> rolls through anything.</>}</li>
          <li>Critters burst into <b>loose pixels</b> of their colour. Walk over them, or clear the room and they fly to Dora.</li>
          <li>Ice and the Smudge’s rub knock pixels <b>off the weapon</b>, and anything left hanging falls too. Pick them back up!</li>
          <li>Three places, ten rooms. After each place, Enzo’s <b>sketchbook</b> has a new idea to pick.</li>
        </ul></div>
        <div className="ps-card ps-foes"><h3>Who’s who</h3>
          {(Object.keys(G.FOES) as G.Kind[]).map((k) => <div key={k} className="ps-foe"><img src={art(`big-${k}`)} alt="" /><p><b>{G.FOES[k].name}</b>{G.FOES[k].text}</p></div>)}
        </div>
      </div>
    </section>}

    {screen === 'settings' && <section className="ps-page">
      <header className="ps-head"><button onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="ps-card ps-settings">
        <div className="ps-set"><span>Sound</span><span className="ps-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.sound === v ? 'on' : ''} onClick={() => setSetting('sound', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <div className="ps-set"><span>Music</span><span className="ps-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings.music === v ? 'on' : ''} onClick={() => setSetting('music', v)}>{v ? 'On' : 'Off'}</button>)}</span></div>
        <p className="ps-small">{s.stats.runs} runs · {s.stats.wins} wins · {s.stats.kills} critters · {s.stats.pixels} pixels picked up</p>
        <button className="ps-danger" onClick={() => { if (window.confirm('Forget every best and start again?')) { const n = G.newSave(); n.settings = s.settings; persist(n); } }}>Reset progress</button>
      </div>
    </section>}
  </main>;
}
