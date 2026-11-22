// Jade Street (twenty-second pass): drawing Bukit Timah's moving parts. The Bukit Bunch's macaques at their haunts
// (munching, gloating, waving your snack bag at you once they have it, gone up a tree once shooed: the twelfth pass's
// painted macaques), Big Kow lounging in his safari vest by Hindhede quarry, the white swans gliding round Swan Lake, and
// on a summit climb the next trail marker and the rest shelters' benches glowing. Every object is a Codex painting; code
// lays them out and adds light. Rules: lib/jade-summit.ts and lib/jade-bukitfest.ts.
import { spr } from './jade-scene.js';
import { summitOf } from './jade-summit.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

export function bukitSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const B = w.c.bukit; if (!B || !w.open.has('bukit')) return;
  const cyc = (n: number, fps: number, k = 0) => Math.floor(sc.t * fps + k) % n, k = w.bukit;
  // the macaques at their haunts (not during a job: the jobs bring their own)
  if (!w.run) B.haunts.forEach(([hx, hy], i) => {
    if (!vis(hx, hy)) return;
    const mine = k.snatched === i, gone = k.done.has(i) && !mine;
    if (gone) return;
    const fr = mine ? (cyc(2, 2, i) ? 'mac-taunt' : 'mac-gloat') : (i + cyc(3, 0.4, i)) % 3 === 0 ? 'mac-peer' : 'mac-munch';
    list.push([hy, () => { x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, hx, hy + 2, 18, 7); spr(x, fr, hx, hy + 4, { w: 40, flip: i % 2 === 1 });
      if (mine) spr(x, 'bkt-snack', hx + 16, hy - 26 + Math.sin(sc.t * 6) * 3, { w: 18 }); }]);
  });
  // Big Kow, lounging by the quarry in his safari vest (until chapter fourteen is over, and after, on his own hill)
  { const [qx, qy] = B.quarry, kx = qx + 2.6 * 64, ky = qy + 3.4 * 64;
    if (vis(kx, ky)) list.push([ky, () => { x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, kx, ky + 2, 24, 9); spr(x, `npc-kow22-${cyc(2, 0.6) ? 'idle-1' : 'idle-0'}`, kx, ky + 4, { w: 52 }); }]); }
  // the swans of Swan Lake, gliding slowly round their beats
  B.swans.forEach(([sx, sy], i) => {
    const a = sc.t * 0.18 + i * 2.1, bx = sx + Math.cos(a) * 34, by = sy + Math.sin(a) * 16;
    if (vis(bx, by)) list.push([by - 30, () => spr(x, 'bkt-swan', bx, by + Math.sin(sc.t * 1.3 + i) * 1.5, { w: 46, flip: Math.sin(a) > 0 })]);
  });
}
/** on a summit climb: the rest shelters' benches glow (stand still there to get your breath back) */
export function bukitOver(sc: Scene, x: X, w: World, vis: Vis) {
  const B = w.c.bukit; if (!B || !w.run || w.run.cur?.t !== 'summit' || !summitOf(w.run)) return;
  for (const [sx, sy] of B.shelters) if (vis(sx, sy)) sc.glow(x, sx, sy, 60 + Math.sin(sc.t * 3) * 6, 'rgba(150,230,160,.28)');
}
