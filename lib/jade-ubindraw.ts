// Jade Street (seventeenth pass): drawing Pulau Ubin's moving parts. Pak Ubin's bumboat on its timetable across the
// strait (or carrying you), the Tusker Boys rooting at their digs, pawing, charging, dizzy and bolting, and a boar
// trail's hoof prints in a tracking job (lib/jade-track.ts decides which show). Every object is a Codex painting; code
// lays them out and adds light. Rules: lib/jade-ubinfest.ts and lib/jade-track.ts.
import { spr } from './jade-scene.js';
import { linkAt, ferryAt } from './jade-cable.js';
import { visible } from './jade-track.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

/** the bumboat's size (world units) and its timetable offset from the island ferry's */
export const BUMBOAT_W = 86;
export function ubinSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const U = w.c.ubin; if (!U) return;
  const cyc = (n: number, fps: number, k = 0) => Math.floor(sc.t * fps + k) % n;
  // the bumboat: on its timetable, or carrying you
  if (w.open.has('pulau')) {
    const L = U.boat, mine = w.ferry?.l === 'bumboat';
    const f = mine ? (() => { const [fx, fy, h] = linkAt(L, w.ferry!.s); return { x: fx, y: fy, h: w.ferry!.dir > 0 ? h : h + Math.PI }; })() : ferryAt(L, w.time + 11);
    if (vis(f.x, f.y, 160)) list.push([f.y, () => {
      x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, f.x + 6, f.y + 10, 56, 24);
      spr(x, 'sampan', f.x, f.y, { anchor: 'center', rot: f.h + Math.PI / 2, w: BUMBOAT_W });
      if (mine) for (const [k, h] of [[-1, w.p.who], [1, w.mate.who]] as const) spr(x, `${h}-seat`, f.x + Math.cos(f.h) * k * 14, f.y + Math.sin(f.h) * k * 14 - 6, { w: 28 });
      sc.glow(x, f.x, f.y - 10, 40, 'rgba(255,210,140,.25)');
    }]);
  }
  // the Tusker Boys out of a job
  w.ubin.boars.forEach((b, i) => {
    if (b.st === 'gone' || !vis(b.x, b.y)) return;
    const fr = b.st === 'root' ? `boar-root-${cyc(2, 2.2, i)}` : b.st === 'paw' ? `boar-taunt` : b.st === 'charge' ? `boar-charge-${cyc(2, 8)}` : b.st === 'dizzy' ? 'boar-dizzy' : `boar-run-${cyc(2, 7)}`;
    const flip = b.st === 'charge' || b.st === 'flee' ? b.vx < 0 : b.st === 'paw' ? Math.cos(b.h) < 0 : i % 2 === 1;
    list.push([b.y, () => {
      x.fillStyle = 'rgba(0,0,0,.28)'; sc.shadow(x, b.x, b.y + 2, 34, 12);
      if (b.st === 'paw') sc.glow(x, b.x, b.y, 30 + Math.sin(sc.t * 20) * 6, 'rgba(200,110,60,.45)');
      spr(x, fr, b.x, b.y + 4, { flip });
    }]);
  });
  // a tracking job's hoof prints: the next fresh set glints; read ones fade; old ones look crusted
  const run = w.run, st = run?.cur;
  if (run && st?.t === 'track') run.items.forEach((it, i) => {
    if (!visible(run, i) || !vis(it.x, it.y)) return;
    list.push([it.y - 30, () => {
      if (!it.got && !it.marks) sc.glow(x, it.x, it.y, 34 + Math.sin(sc.t * 4) * 5, 'rgba(255,220,140,.4)');
      spr(x, 'hoof-prints', it.x, it.y + 10, { w: 30, alpha: it.got ? 0.45 : it.marks ? 0.7 : 1 });
    }]);
  });
}
