// Jade Street: drawing the chase set pieces, Madame Glint's finale and the business stalls. Every object is a Codex
// painting from atlas-set (the smashed stall, the drum rack and rolling drums, the drawbridge in three positions, the
// crane's container, the yard gate, the neon signs, Glint's float, the decoy riders, the stalls at each level); code
// only adds the telegraphs as light and shadow: red glows where rubble will land, glowing lanes for the drums, the
// container's shadow, the red shadow under a falling sign, the gate's flashing lamps and the flags' glow when it is
// time to leap. The game rules live in lib/jade-setpiece.ts, lib/jade-boss.ts and lib/jade-biz.ts.
import { T } from './jade-city.js';
import { spr } from './jade-scene.js';
import { BIZ, bizPos, bizSprite } from './jade-biz.js';
import { leapSpot, inWindow, LEAP_SPOTS } from './jade-boss.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Actor } from './jade-mission.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
const pulse = (t: number, f = 6) => 0.55 + 0.45 * Math.sin(t * f);

/** telegraphs on the ground, under everything that stands up */
export function setGround(sc: Scene, x: X, w: World) {
  const run = w.run; if (!run) return; const t = sc.t;
  for (const s of run.sets) {
    if (s.def.k === 'stall' && s.ph === 'warn') for (const c of s.rubble) sc.glow(x, c.x, c.y, c.r * 2.2, `rgba(255,50,40,${0.55 * pulse(t, 10)})`);
    if (s.def.k === 'drums' && s.ph === 'warn') for (const d of s.drums) for (let k = 0; k < 6; k++) sc.glow(x, d.x, s.y - T + k * T, 46, `rgba(255,90,40,${0.32 * pulse(t + k * 0.3, 9)})`);
    if (s.def.k === 'crane') { x.fillStyle = 'rgba(0,0,0,.42)'; sc.shadow(x, s.x + s.swing, s.y + 10, 58, 26); sc.glow(x, s.x + s.swing, s.y + 10, 70, 'rgba(255,60,40,.22)'); }
    if (s.def.k === 'gate' && s.ph === 'warn') for (const gx of [s.span[0] * T, (s.span[1] + 1) * T]) sc.glow(x, gx, s.y, 80, `rgba(255,170,40,${Math.floor(t * 6) % 2 ? 0.7 : 0.15})`);
    if (s.def.k === 'bridge' && s.ph === 'warn') sc.glow(x, s.x, s.y, 140, `rgba(255,190,60,${0.4 * pulse(t, 8)})`);
  }
  for (const g of run.signs) {
    if (g.ph === 'wreck') continue;
    const k = g.ph === 'fall' ? 1 : Math.min(1, g.t / g.warn);
    x.fillStyle = `rgba(30,0,10,${0.25 + 0.35 * k})`; sc.shadow(x, g.x, g.y + 8, 22 + 34 * k, 10 + 16 * k);
    sc.glow(x, g.x, g.y + 8, 40 + 50 * k, `rgba(255,30,50,${0.25 + 0.35 * k * pulse(t, 14)})`);
  }
  const f = run.float;
  if (f && !f.done) {
    const win = inWindow(run);
    for (let i = 0; i < LEAP_SPOTS.length; i++) { const [lx, ly] = leapSpot(i); if (w.p.roof || f.moving) sc.glow(x, lx, ly, win === i ? 90 : 50, win === i ? `rgba(120,255,160,${0.7 * pulse(t, 12)})` : 'rgba(255,220,120,.3)'); }
  }
}

/** standing things go into the scene's y-sorted list */
export function setSorted(sc: Scene, x: X, w: World, list: List, vis: (px: number, py: number, m?: number) => boolean) {
  const t = sc.t;
  // the businesses: a painted stall that grows with each upgrade (level 0 is the stall with a for-sale look)
  for (const b of BIZ) {
    if (!w.open.has(b.d)) continue; const [bx, by] = bizPos(b); if (!vis(bx, by, 200)) continue;
    const lvl = w.s.biz[b.id]?.lvl ?? 0;
    list.push([by + 20, () => {
      x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, bx + 6, by + 30, 70, 20);
      spr(x, bizSprite(b.id, lvl), bx, by + 40, { w: 150 });
      if (lvl && (w.s.biz[b.id]?.bank ?? 0) >= 1) spr(x, 'ui-coin', bx + 52, by - 74 + Math.sin(t * 3 + bx) * 4, { w: 24, anchor: 'center' });
    }]);
  }
  const run = w.run; if (!run) return;
  for (const s of run.sets) {
    if (!vis(s.x, s.y, 320)) continue;
    switch (s.def.k) {
      case 'stall':
        list.push([s.y + 20, () => spr(x, s.ph === 'go' || s.ph === 'done' ? 'stall-smash-1' : 'stall-smash-0', s.x, s.y + 40, { w: 150 })]);
        if (s.ph === 'go' || s.ph === 'done') for (const c of s.rubble) if (!c.hit || s.t < 9) list.push([c.y, () => spr(x, c.sprite, c.x, c.y, { w: 38, anchor: 'center', rot: c.rot, alpha: c.hit ? 0.5 : 1 })]);
        break;
      case 'drums':
        if (s.ph === 'wait' || s.ph === 'warn') list.push([s.y - 2 * T, () => spr(x, 'drum-rack', s.x, s.y - 1.4 * T + (s.ph === 'warn' ? Math.sin(t * 40) * 2 : 0), { w: 130 })]);
        if (s.ph === 'go') for (const d of s.drums) if (d.on) list.push([d.y, () => { x.fillStyle = 'rgba(0,0,0,.35)'; sc.shadow(x, d.x + 4, d.y + 14, 26, 10); spr(x, Math.floor(d.y / 30) % 2 ? 'drum-roll-1' : 'drum-roll-0', d.x, d.y, { w: 60, anchor: 'center' }); }]);
        break;
      case 'bridge': {
        const fr = s.down > 0.66 ? 'bridge-down' : s.down > 0.2 ? 'bridge-mid' : 'bridge-up';
        list.push([s.y + 40, () => spr(x, fr, s.x, s.y, { w: 300, anchor: 'center' })]);
        if (s.ph === 'warn' || s.ph === 'go') list.push([s.y - 60, () => spr(x, 'warn-bell', s.x + 2 * T, s.y - T, { w: 50, rot: s.ph === 'warn' ? Math.sin(t * 14) * 0.25 : 0 })]);
        break;
      }
      case 'crane': list.push([s.y + 60, () => spr(x, 'crane-load', s.x + s.swing, s.y - 70, { w: 120, anchor: 'center', rot: -s.swing / (2.4 * T) * 0.18 })]); break;
      case 'gate': {
        const shut = s.ph === 'go';
        list.push([s.y + 20, () => { for (let gx = s.span[0]; gx <= s.span[1]; gx += 2) spr(x, shut ? 'gate-shut' : 'gate-open', gx * T + T, s.y + 26, { w: shut ? 2 * T + 6 : 2 * T, alpha: shut ? 1 : 0.85 }); }]);
        break;
      }
    }
  }
  for (const g of run.signs) {
    if (!vis(g.x, g.y, 200)) continue;
    if (g.ph === 'wreck') list.push([g.y, () => spr(x, 'neon-wreck', g.x, g.y + 20, { w: 140, alpha: Math.min(1, (2.4 - g.t) * 2) })]);
    else if (g.ph === 'fall') list.push([g.y + 30, () => spr(x, 'neon-fall', g.x, g.y - 120 * (1 - g.t / 0.22), { w: 120, anchor: 'center' })]);
    else list.push([g.y + 30, () => spr(x, 'neon-sign', g.x, g.y - 150 - Math.sin(t * 30) * (g.t > g.warn * 0.6 ? 3 : 0), { w: 110, anchor: 'center', alpha: Math.floor(t * 12) % 3 ? 1 : 0.6 })]);
  }
  const f = run.float;
  if (f && vis(f.x, f.y, 300)) list.push([f.y + 40, () => {
    x.fillStyle = 'rgba(0,0,0,.35)'; sc.shadow(x, f.x + 8, f.y + 40, 110, 34);
    spr(x, 'float', f.x, f.y + 70, { w: 230, flip: true });
    spr(x, f.done ? 'glint-dizzy' : f.moving ? (Math.floor(t * 2) % 2 ? 'glint-taunt' : 'glint-wave') : 'glint-taunt', f.x + 10, f.y - 30, { w: 60 });
    if (f.done) sc.stars(x, f.x + 10, f.y - 90);
  }]);
}

/** a decoy rider (they look like Glint; only the real one sparkles) */
export function drawDecoy(sc: Scene, x: X, a: Actor) {
  const b = a.b; x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x + 4, b.y + 6, 30, 14);
  spr(x, Math.floor(a.t * 6) % 2 ? 'decoy-ride-1' : 'decoy-ride-0', b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2, w: 36 });
}
/** the gold sparkle that marks the real Madame Glint in the decoy phase */
export function realGlint(sc: Scene, x: X, w: World, a: Actor) {
  if (w.run?.cur?.t !== 'chase' || !('phase' in w.run.cur) || w.run.cur.phase !== 1) return;
  sc.glow(x, a.b.x, a.b.y, 64, `rgba(255,215,90,${0.45 * pulse(sc.t, 7)})`);
  for (let i = 0; i < 3; i++) { const an = sc.t * 4 + i * 2.1; sc.sparkle(x, a.b.x + Math.cos(an) * 26, a.b.y + Math.sin(an) * 14 - 10); }
}
