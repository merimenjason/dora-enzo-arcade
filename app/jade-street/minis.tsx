'use client';
// Jade Street mini-games on a canvas over their painted backdrops: lock picking, jump-starting a scooter, the wok and
// dumpling folding. The rules are in lib/jade-mini.ts; this file draws them and maps mouse, touch and keys onto the
// same few actions (pick a pin and hold / release, pick a wire then a socket, slide and toss, press on the beat).
import { useEffect, useRef, useState } from 'react';
import { makeMini, LockGame, WireGame, WokGame, DumplingGame, WIRE_COLS, FOODS, type AnyMini } from '@/lib/jade-mini';
import { spr, loadArt } from '@/lib/jade-scene';
import type { JadeSound } from './sound';
import { ART, Sprite } from './ui';

const BG: Record<string, string> = { lock: 'bg-mg-lock', wires: 'bg-mg-wire', wok: 'bg-mg-wok', dumpling: 'bg-mg-board' };
// the part of each backdrop that must stay on screen (image pixels, 1280×853)
const FOCUS: Record<string, [number, number, number, number]> = { lock: [300, 170, 1000, 720], wires: [300, 200, 1000, 700], wok: [150, 120, 1130, 853], dumpling: [180, 60, 1100, 760] };
const TITLE: Record<string, [string, string, string]> = {
  lock: ['Pick the lock', 'Hold a pin to lift it. Let go while it glows gold.', 'Tap and hold a pin · or ← → and hold Space'],
  wires: ['Jump-start it', 'Join each wire to the socket of the same colour, then turn the key.', 'Tap a wire, then its socket · or keys 1-4 then 1-4, Enter for the key'],
  wok: ['Work the wok', 'Catch what the order needs. Skip the chillies. Toss before it scorches.', 'Slide to move the wok · or ← →, Space to toss'],
  dumpling: ['Fold dumplings', 'Drop the filling in the middle, then pinch three pleats on the gold marks.', 'Tap anywhere · or Space'],
};
const SX = [455, 595, 735, 872];
const WY = [277, 385, 495, 605];
const pinTop = (h: number) => 520 - h * 200;
const FOOD_SPR: Record<string, string> = { noodles: 'mg-noodles', prawn: 'mg-prawn', bokchoy: 'mg-bokchoy', egg: 'mg-egg', chilli: 'mg-chilli' };
const FOOD_NAME: Record<string, string> = { noodles: 'Noodles', prawn: 'Prawn', bokchoy: 'Bok choy', egg: 'Egg', chilli: 'Chilli' };

export function MiniGame({ kind, level, assist, seed, snd, onDone }: { kind: string; level: number; assist: boolean; seed: number; snd: JadeSound | null; onDone: (ok: boolean) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const game = useRef<AnyMini>(makeMini(kind, { level, assist, seed }));
  const [, setTick] = useState(0);
  const [end, setEnd] = useState<null | boolean>(null);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const view = useRef({ s: 1, ox: 0, oy: 0 });
  const pointer = useRef({ x: 640, y: 400, down: false });

  useEffect(() => {
    const c = cv.current!; const x = c.getContext('2d')!;
    const bg = new Image(); bg.src = `${ART}${BG[kind]}.webp`;
    void loadArt();
    let raf = 0, last = 0, hud = 0, ended = false, endT = 0;
    const fit = () => {
      const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      const [fx, fy, fx2, fy2] = FOCUS[kind]; const fw = fx2 - fx, fh = fy2 - fy;
      const s = Math.min(r.width / fw, r.height / fh);
      view.current = { s: s * dpr, ox: (r.width - fw * s) / 2 * dpr - fx * s * dpr, oy: (r.height - fh * s) / 2 * dpr - fy * s * dpr };
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(c);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      const g = game.current;
      g.step(dt);
      for (const e of g.ev.splice(0)) snd?.mini(e.t);
      if ((g.done || g.failed) && !ended) { ended = true; endT = 0; setEnd(g.done); }
      if (ended) { endT += dt; if (endT > 1.1) { cancelAnimationFrame(raf); doneRef.current(g.done); return; } }
      draw(x, c, g, bg, view.current, pointer.current, now / 1000);
      hud += dt; if (hud > 0.1) { hud = 0; setTick(t => t + 1); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [kind, snd]);

  // for the browser tests: the running mini-game, and where a point of the painted board sits on screen
  useEffect(() => {
    const hook = window as unknown as Record<string, unknown>;
    hook.__jadeMini = { g: () => game.current, at: (ix: number, iy: number) => { const r = cv.current!.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); const v = view.current; return [r.left + (ix * v.s + v.ox) / dpr, r.top + (iy * v.s + v.oy) / dpr]; } };
    return () => { delete hook.__jadeMini; };
  }, []);

  // input
  useEffect(() => {
    const g = game.current;
    const kd = (e: KeyboardEvent) => {
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
      if (g instanceof LockGame) { if (e.repeat) return; if (k === 'ArrowLeft' || k === 'a') g.move(-1); if (k === 'ArrowRight' || k === 'd') g.move(1); if (k === ' ' || k === 'Enter') g.hold(true); }
      else if (g instanceof WireGame) { if (/^[1-4]$/.test(k)) { const i = +k - 1; if (g.picked === null) g.pick(i); else g.connect(i); } if (k === 'Enter' || k === ' ') g.turnKey(); }
      else if (g instanceof WokGame) { if (k === ' ' || k === 'ArrowUp' || k === 'w') g.toss(); }
      else if (g instanceof DumplingGame) { if (!e.repeat && (k === ' ' || k === 'Enter')) g.press(); }
    };
    const ku = (e: KeyboardEvent) => { if (g instanceof LockGame && (e.key === ' ' || e.key === 'Enter')) g.hold(false); };
    let held: number | null = null;
    const tick = () => { if (g instanceof WokGame) { const k = keys; if (k.has('ArrowLeft') || k.has('a')) g.nudge(-1, 1 / 60); if (k.has('ArrowRight') || k.has('d')) g.nudge(1, 1 / 60); } held = requestAnimationFrame(tick); };
    const keys = new Set<string>();
    const kd2 = (e: KeyboardEvent) => keys.add(e.key), ku2 = (e: KeyboardEvent) => keys.delete(e.key);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('keydown', kd2); window.addEventListener('keyup', ku2);
    held = requestAnimationFrame(tick);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('keydown', kd2); window.removeEventListener('keyup', ku2); if (held) cancelAnimationFrame(held); };
  }, []);

  const toImg = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); const v = view.current; return [((e.clientX - r.left) * dpr - v.ox) / v.s, ((e.clientY - r.top) * dpr - v.oy) / v.s]; };
  const down = (e: React.PointerEvent) => {
    e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const [ix, iy] = toImg(e); pointer.current = { x: ix, y: iy, down: true };
    const g = game.current;
    if (g instanceof LockGame) { let best = -1, bd = 1e9; for (let i = 0; i < g.pins.length; i++) { const d = Math.abs(ix - SX[i]); if (d < bd) { bd = d; best = i; } } if (bd < 90) { g.select(best); g.hold(true); } }
    else if (g instanceof WireGame) {
      if (Math.hypot(ix - 640, iy - 690) < 90) { g.turnKey(); return; }
      const li = WY.findIndex(y => Math.abs(iy - y) < 52 && Math.abs(ix - 410) < 110);
      const ri = WY.findIndex(y => Math.abs(iy - y) < 52 && Math.abs(ix - 882) < 110);
      if (li >= 0) g.pick(li); else if (ri >= 0) g.connect(ri);
    } else if (g instanceof WokGame) { g.moveTo((ix - 200) / 880); if (iy < 520) g.toss(); }
    else if (g instanceof DumplingGame) g.press();
  };
  const move = (e: React.PointerEvent) => { const [ix, iy] = toImg(e); pointer.current.x = ix; pointer.current.y = iy; const g = game.current; if (g instanceof WokGame && (pointer.current.down || e.pointerType === 'mouse')) g.moveTo((ix - 200) / 880); };
  const up = (e: React.PointerEvent) => {
    const [ix, iy] = toImg(e); pointer.current.down = false; const g = game.current;
    if (g instanceof LockGame) g.hold(false);
    else if (g instanceof WireGame && g.picked !== null) { const ri = WY.findIndex(y => Math.abs(iy - y) < 52 && Math.abs(ix - 882) < 110); if (ri >= 0) g.connect(ri); }
  };

  const g = game.current;
  const [title, how, keysTxt] = TITLE[kind];
  const time = 'time' in g && (g instanceof LockGame || g instanceof WireGame) ? Math.ceil(g.time) : null;
  return (
    <div className="jade-mini" data-testid={`mini-${kind}`} data-done={end === null ? undefined : String(end)}>
      <div className="jade-mini-head">
        <b>{title}</b><span>{how}</span>
        {time !== null && <span className={'jade-timer' + (time < 10 ? ' low' : '')}>{time}s</span>}
      </div>
      <canvas ref={cv} className="jade-mini-cv" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="mini-canvas" />
      <div className="jade-mini-foot">
        {g instanceof WokGame && <div className="jade-order" data-testid="wok-order">{FOODS.filter(f => (g.need[f] ?? 0) > 0).map(f => <span key={f} className={(g.got[f] ?? 0) >= (g.need[f] ?? 0) ? 'got' : ''}><Sprite name={FOOD_SPR[f]} h={28} w={28} />{FOOD_NAME[f]} {g.got[f] ?? 0}/{g.need[f]}</span>)}<span className="strikes">Oops {g.strikes}/3</span></div>}
        {g instanceof DumplingGame && <div className="jade-order">Dumpling {Math.min(g.n, g.i + 1)}/{g.n} · {g.phase === 'fill' ? 'drop the filling' : g.phase === 'pleat' ? `pleat ${g.pleats + 1}/3` : 'into the steamer'}</div>}
        {g instanceof LockGame && <div className="jade-order">Pins set {g.pins.filter(p => p.set).length}/{g.pins.length}</div>}
        {g instanceof WireGame && <div className="jade-order">{g.wired ? 'All wired: turn the key!' : `Wires joined ${g.links.filter(l => l !== null).length}/4`}</div>}
        <span className="jade-mini-keys">{keysTxt}</span>
        {g instanceof WokGame && <button type="button" className="jade-btn red" data-testid="wok-toss" onPointerDown={e => { e.preventDefault(); g.toss(); }}>Toss!</button>}
        {g instanceof WireGame && <button type="button" className="jade-btn gold" data-testid="wire-key" disabled={!g.wired} onClick={() => g.turnKey()}>Turn the key</button>}
        {g instanceof DumplingGame && <button type="button" className="jade-btn jade" data-testid="fold" onPointerDown={e => { e.preventDefault(); g.press(); }}>Pinch!</button>}
        <button type="button" className="jade-btn plain" data-testid="mini-quit" onClick={() => { g.failed = true; g.ev.push({ t: 'fail' }); }}>Give up</button>
      </div>
      {end !== null && <div className={'jade-mini-end ' + (end ? 'ok' : 'bad')}>{end ? (kind === 'lock' ? 'Click! It’s open.' : kind === 'wires' ? 'Vroom! It starts.' : kind === 'wok' ? 'Order up!' : 'Into the steamer!') : 'Oh no!'}</div>}
    </div>
  );
}

function draw(x: CanvasRenderingContext2D, c: HTMLCanvasElement, g: AnyMini, bg: HTMLImageElement, v: { s: number; ox: number; oy: number }, ptr: { x: number; y: number; down: boolean }, t: number) {
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#140f24'; x.fillRect(0, 0, c.width, c.height);
  x.setTransform(v.s, 0, 0, v.s, v.ox, v.oy);
  if (bg.complete && bg.naturalWidth) x.drawImage(bg, 0, 0, 1280, 853);
  const glow = (px: number, py: number, r: number, col: string) => { x.save(); x.globalCompositeOperation = 'lighter'; const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2); x.restore(); };
  if (g instanceof LockGame) {
    for (let i = 0; i < 4; i++) {
      const sx = SX[i]; const p = g.pins[i];
      x.save(); x.beginPath(); x.rect(sx - 50, 290, 100, 320); x.clip();
      if (!p) { spr(x, 'mg-pin-glow', sx, pinTop(0.62) + 210, { h: 210, alpha: 0.85 }); x.restore(); continue; }
      // the gold band where the pin's top has to sit
      if (!p.set) { x.fillStyle = 'rgba(255,214,90,0.22)'; x.fillRect(sx - 46, pinTop(p.hi), 92, pinTop(p.lo) - pinTop(p.hi)); x.strokeStyle = 'rgba(255,230,140,0.75)'; x.lineWidth = 3; x.setLineDash([10, 8]); x.strokeRect(sx - 46, pinTop(p.hi), 92, pinTop(p.lo) - pinTop(p.hi)); x.setLineDash([]); }
      const lit = p.set || g.glowing(i);
      spr(x, lit ? 'mg-pin-glow' : 'mg-pin', sx, pinTop(p.h) + 210, { h: 210 });
      x.restore();
      if (lit) glow(sx, pinTop(p.h) + 30, 70, p.set ? 'rgba(255,220,110,0.35)' : 'rgba(255,240,150,0.55)');
      if (i === g.sel && !p.set) { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; x.strokeRect(sx - 52, 286, 104, 328); }
    }
    const sel = g.pins[g.sel]; const sx = SX[g.sel];
    // the hairpin slides in under the chosen pin and tilts up as you lift
    spr(x, 'mg-pick', sx - 150, 640 - (sel && g.holding ? sel.h * 30 : 0), { w: 340, anchor: 'center', rot: -0.08 - (sel && g.holding ? sel.h * 0.12 : 0) });
    // time bar
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(340, 120, 600, 14); x.fillStyle = g.time < 10 ? '#ff6a5a' : '#ffd25a'; x.fillRect(340, 120, 600 * Math.max(0, g.time) / ((g.o.assist ? 75 : 50) + (g.pins.length - 3) * 10), 14);
  } else if (g instanceof WireGame) {
    const cols: Record<string, string> = { red: '#e8423a', blue: '#3a86ff', yellow: '#ffd23a', green: '#2ec27e' };
    // socket colour hints on the right
    for (let j = 0; j < 4; j++) { const col = WIRE_COLS[g.right[j]]; spr(x, `mg-plug-${col}`, 882 + 92, WY[j], { h: 60, anchor: 'center', alpha: 0.9, rot: Math.PI / 2 }); }
    const cable = (x0: number, y0: number, x1: number, y1: number, col: string) => { x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 20; x.beginPath(); x.moveTo(x0, y0 + 4); x.bezierCurveTo(x0 + 200, y0 + 80, x1 - 200, y1 + 80, x1, y1 + 4); x.stroke(); x.strokeStyle = col; x.lineWidth = 14; x.beginPath(); x.moveTo(x0, y0); x.bezierCurveTo(x0 + 200, y0 + 70, x1 - 200, y1 + 70, x1, y1); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 4; x.stroke(); };
    for (let i = 0; i < 4; i++) {
      const col = WIRE_COLS[i]; const l = g.links[i];
      if (l !== null) { cable(440, WY[i], 852, WY[l], cols[col]); spr(x, `mg-plug-${col}`, 852, WY[l], { h: 64, anchor: 'center', rot: Math.PI / 2 }); glow(882, WY[l], 50, 'rgba(255,240,160,.3)'); }
      else if (g.picked === i) { cable(440, WY[i], ptr.x, ptr.y, cols[col]); spr(x, `mg-plug-${col}`, ptr.x, ptr.y, { h: 64, anchor: 'center', rot: Math.PI / 2 }); }
      spr(x, `mg-plug-${col}`, 410, WY[i], { h: 70, anchor: 'center', rot: -Math.PI / 2, alpha: l !== null || g.picked === i ? 0.45 : 1 });
      if (g.picked === i) glow(410, WY[i], 70, 'rgba(255,255,200,.45)');
    }
    if (g.buzz > 0) { spr(x, 'mg-spark', 640 + Math.sin(t * 50) * 30, 440, { h: 120, anchor: 'center' }); }
    spr(x, 'mg-key', 640, 690, { h: 120, anchor: 'center', rot: g.started ? Math.PI / 2 : 0 });
    if (g.wired) glow(640, 690, 110, `rgba(255,220,100,${0.35 + 0.2 * Math.sin(t * 6)})`);
  } else if (g instanceof WokGame) {
    const wx = 200 + g.x * 880, wy = 700;
    for (const it of g.items) { if (it.y > 1.05) continue; spr(x, FOOD_SPR[it.f], 200 + it.x * 880, it.y * 853, { h: 78, anchor: 'center', rot: t * 2 + it.id }); }
    // heat under the wok, redder as it scorches
    glow(wx, wy + 40, 160, `rgba(255,${Math.round(160 - g.burn * 120)},60,${0.25 + g.burn * 0.4})`);
    const lift = g.tossT > 0 ? Math.sin((1 - g.tossT / 0.45) * Math.PI) * 60 : 0;
    spr(x, 'mg-wok', wx, wy - lift, { h: 180, anchor: 'center', rot: g.tossT > 0 ? Math.sin((1 - g.tossT / 0.45) * Math.PI) * -0.25 : 0 });
    if (g.tossT > 0) for (let k = 0; k < Math.min(5, g.inWok); k++) spr(x, FOOD_SPR[(['noodles', 'prawn', 'bokchoy', 'egg'] as const)[k % 4]], wx - 50 + k * 25, wy - 60 - lift * 2 - k * 10, { h: 44, anchor: 'center', rot: t * 6 + k });
    // scorch meter
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(wx - 90, wy + 82, 180, 14); x.fillStyle = g.burn > 0.7 ? '#ff5a3a' : g.burn > 0.4 ? '#ffb23a' : '#7ad06a'; x.fillRect(wx - 90, wy + 82, 180 * g.burn, 14);
  } else if (g instanceof DumplingGame) {
    const cx = 640, cy = 430;
    if (g.phase === 'fill') {
      spr(x, 'mg-wrapper', cx, cy, { h: 300, anchor: 'center' });
      // the spoon swings across a bar: drop it in the middle
      const bx0 = 340, bx1 = 940, by = 150;
      x.fillStyle = 'rgba(30,20,10,.65)'; x.fillRect(bx0, by - 16, bx1 - bx0, 32);
      x.fillStyle = 'rgba(120,230,140,.75)'; const zw = g.zone * (bx1 - bx0); x.fillRect((bx0 + bx1) / 2 - zw, by - 16, zw * 2, 32);
      const sxp = bx0 + g.spoon() * (bx1 - bx0);
      spr(x, 'mg-filled', sxp, by + 4, { h: 90, anchor: 'center', alpha: 0.95 });
      x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.moveTo(sxp, by - 26); x.lineTo(sxp, by + 26); x.stroke();
    } else {
      spr(x, g.phase === 'next' ? (g.results[g.results.length - 1] === 'messy' ? 'mg-messy' : 'mg-dumpling') : g.pleats > 0 ? 'mg-half' : 'mg-filled', cx, cy, { h: 300, anchor: 'center' });
      if (g.phase === 'pleat') {
        const R = 200;
        x.lineWidth = 26; x.strokeStyle = 'rgba(30,20,10,.45)'; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
        x.strokeStyle = 'rgba(255,214,90,.9)'; x.beginPath(); x.arc(cx, cy, R, g.target - g.arc / 2, g.target + g.arc / 2); x.stroke();
        const mx = cx + Math.cos(g.ring) * R, my = cy + Math.sin(g.ring) * R;
        x.fillStyle = '#fff'; x.beginPath(); x.arc(mx, my, 18, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#3a2410'; x.lineWidth = 4; x.stroke();
      }
    }
    // the steamer fills up
    spr(x, 'mg-steamer', 1030, 250, { h: 200, anchor: 'center' });
    g.results.forEach((r, i) => spr(x, r === 'messy' ? 'mg-messy' : 'mg-dumpling', 990 + (i % 2) * 80, 220 + Math.floor(i / 2) * 60, { h: 70, anchor: 'center' }));
  }
}
