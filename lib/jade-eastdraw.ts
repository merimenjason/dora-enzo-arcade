// Jade Street: drawing Little India, Kampong Glam and Sentosa's moving parts. The kolams and the Deepavali oil lamps
// (lit one by one), the Hari Raya bazaar's stalls and pelita lamps, the sandcastles you build, the ferry on the
// harbour (with you aboard when you ride it), and overhead the cable car's wires and cabins. Every object is a Codex
// painting; code only lays them out and adds light. The rules live in lib/jade-cable.ts and lib/jade-eastfest.ts.
import { spr, frameSize } from './jade-scene.js';
import { cabins, ferryAt, linkAt } from './jade-cable.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

/** on the ground: the kolams on Deepavali nights */
export function eastGround(sc: Scene, x: X, w: World, vis: Vis) {
  const E = w.c.east; if (!E || !w.open.has('india') || w.east.fest !== 'deepavali') return;
  E.kolams.forEach(([kx, ky], i) => { if (vis(kx, ky)) spr(x, 'kolam', kx, ky, { w: 64 + (i % 3) * 8, anchor: 'center', rot: i * 0.7, alpha: 0.95 }); });
  void sc;
}
export function eastSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const E = w.c.east; if (!E) return;
  const e = w.east;
  if (w.open.has('india') && e.fest === 'deepavali') E.lamps.forEach(([lx, ly], i) => { if (!vis(lx, ly)) return; const lit = e.lit.has(i); list.push([ly, () => {
    spr(x, lit ? 'diya-lit' : 'diya', lx, ly + 6, { w: 30 });
    if (lit) sc.glow(x, lx, ly - 4, 34 + Math.sin(sc.t * 9 + i) * 3, 'rgba(255,190,80,.55)');
  }]); });
  if (w.open.has('glam')) {
    const on = e.fest === 'bazaar';
    for (const [bx, by] of E.bazaar) if (vis(bx, by)) list.push([by + 20, () => { x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, bx, by + 22, 40, 12); spr(x, on ? 'bazaar-stall' : 'bazaar-shut', bx, by + 26, { w: 112 }); }]);
    if (on) for (const [qx, qy] of E.pelita) if (vis(qx, qy)) list.push([qy, () => { spr(x, 'pelita', qx, qy + 4, { w: 18 }); sc.glow(x, qx, qy - 14, 22, 'rgba(255,200,90,.5)'); }]);
  }
  for (const id of e.once) if (id.startsWith('castle:')) { const [cx, cy] = id.slice(7).split(',').map(Number); if (vis(cx, cy)) list.push([cy - 2, () => spr(x, 'sandcastle', cx, cy + 10, { w: 54 })]); }
  // the ferry: on its timetable, or carrying you
  const F = E.ferry;
  if (w.open.has('resort')) {
    const f = w.ferry ? (() => { const [fx, fy, h] = linkAt(F, w.ferry!.s); return { x: fx, y: fy, h: w.ferry!.dir > 0 ? h : h + Math.PI }; })() : ferryAt(F, w.time);
    if (vis(f.x, f.y, 200)) list.push([f.y, () => {
      x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, f.x + 6, f.y + 10, 70, 30);
      spr(x, 'ferry-boat', f.x, f.y, { anchor: 'center', rot: f.h + Math.PI / 2, w: 96 });
      if (w.ferry) for (const [k, h] of [[-1, w.p.who], [1, w.mate.who]] as const) spr(x, `${h}-seat`, f.x + Math.cos(f.h) * k * 16, f.y + Math.sin(f.h) * k * 16 - 6, { w: 30 });
      sc.glow(x, f.x, f.y, 70, 'rgba(255,240,180,.2)');
    }]);
  }
}
/** overhead: the cable car's wires between its stations and towers, and the cabins going round */
export function eastOver(sc: Scene, x: X, w: World, vis: Vis) {
  const E = w.c.east; if (!E) return;
  // the light-up over Serangoon Road glows on Deepavali nights
  if (w.open.has('india') && w.east.fest === 'deepavali' && vis(E.arch[0], E.arch[1], 300)) for (let k = -2; k <= 2; k++) sc.glow(x, E.arch[0] + k * 60, E.arch[1] - 20, 70 + Math.sin(sc.t * 3 + k) * 8, ['rgba(255,120,200,.32)', 'rgba(255,210,90,.32)', 'rgba(120,220,255,.3)'][(k + 3) % 3]);
  if (!w.open.has('docks')) return;
  const L = E.cable, [ww] = frameSize('cable-wire');
  for (const off of [16, -16]) for (let i = 1; i < L.path.length; i++) {
    const [x0, y0] = L.path[i - 1], [x1, y1] = L.path[i], l = Math.hypot(x1 - x0, y1 - y0), h = Math.atan2(y1 - y0, x1 - x0);
    const n = Math.ceil(l / 160), nx = -Math.sin(h) * off, ny = Math.cos(h) * off;
    for (let k = 0; k < n; k++) {
      const qx = x0 + (x1 - x0) * (k + 0.5) / n + nx, qy = y0 + (y1 - y0) * (k + 0.5) / n + ny;
      if (vis(qx, qy, 200)) spr(x, 'cable-wire', qx, qy, { anchor: 'center', rot: h, w: ww ? l / n + 2 : 162 });
    }
  }
  for (const c of cabins(L, w.time)) if (vis(c.x, c.y, 120)) {
    x.fillStyle = 'rgba(0,0,0,.18)'; sc.shadow(x, c.x + 40, c.y + 90, 22, 12);
    spr(x, 'cable-cabin', c.x, c.y + 18, { w: 46 });
  }
}
