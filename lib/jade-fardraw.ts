// Jade Street (twelfth pass): drawing Orchard Road, Katong and Changi's moving parts. The Christmas light-up's strings
// of lights twinkling along Orchard Road (while it is on), the baubles you hang on its trees, the Rain Vortex's light
// show at Jewel on the half hour of game time, and a plane coming in over the sea to Changi. Every object is a Codex
// painting; code lays them out and adds light. The rules live in lib/jade-farfest.ts.
import { spr } from './jade-scene.js';
import { lightUp, planeNow } from './jade-farfest.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

const LIGHT = ['rgba(255,90,90,.5)', 'rgba(255,215,90,.5)', 'rgba(120,230,160,.45)', 'rgba(140,200,255,.45)'];
/** is the Rain Vortex putting on its light show (a few game minutes in every half hour of the night clock) */
export const vortexShow = (w: World) => w.s.clock % 60 < 12;
export function farSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const F = w.c.far; if (!F) return;
  if (w.open.has('orchard')) {
    // the baubles hung tonight, on their trees
    F.trees.forEach(([tx, ty], i) => { if (w.far.baubles.has(i) && vis(tx, ty)) list.push([ty + 1, () => {
      for (let k = 0; k < 3; k++) spr(x, 'bauble', tx - 18 + k * 18, ty - 50 + (k % 2) * 22, { w: 18 });
      sc.glow(x, tx, ty - 40, 46, 'rgba(255,220,120,.35)');
    }]); });
  }
  if (w.open.has('changi') && vis(F.vortex[0], F.vortex[1], 260) && vortexShow(w)) list.push([F.vortex[1] + 21, () => {
    spr(x, 'vortex-show', F.vortex[0], F.vortex[1] + 20, { w: 448, alpha: 0.5 + 0.5 * Math.abs(Math.sin(sc.t * 0.8)) });
  }]);
}
export function farOver(sc: Scene, x: X, w: World, vis: Vis) {
  const F = w.c.far; if (!F) return;
  if (w.open.has('orchard') && lightUp(w)) {
    F.lights.forEach(([lx, ly], i) => { if (vis(lx, ly)) sc.glow(x, lx, ly - 30, 16 + ((Math.floor(sc.t * 2) + i) % 3) * 3, LIGHT[(i + Math.floor(sc.t)) % 4]); });
    for (const [ax, ay] of F.arches) if (vis(ax, ay, 300)) sc.glow(x, ax, ay - 40, 120 + Math.sin(sc.t * 2) * 10, 'rgba(255,230,150,.22)');
  }
  const p = w.open.has('changi') ? planeNow(w) : null;
  if (p && vis(p.x, p.y, 300)) {
    x.fillStyle = 'rgba(0,0,0,.16)'; sc.shadow(x, p.x + 90 * (1 - p.k), p.y + 160 * (1 - p.k) + 40, 60, 24);
    spr(x, 'plane-fly', p.x, p.y, { anchor: 'center', rot: p.h + Math.PI / 2, w: 220 });
    if (Math.floor(sc.t * 3) % 2) sc.glow(x, p.x, p.y, 20, 'rgba(255,80,80,.7)');
  }
}
