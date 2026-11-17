// Jade Street (fourteenth pass): drawing Tiong Bahru, Clarke Quay and Jurong's moving parts. The canopy over Clarke
// Quay's lanes breathing through its colours, the Slingshot's capsule going up with whoever is in it, the lanterns of
// Lights by the Lake glowing on the shore and drifting on Jurong Lake (while they are lit), and the songbird corner's
// little notes. Every object is a Codex painting; code lays them out and adds light. Rules: lib/jade-southfest.ts.
import { spr } from './jade-scene.js';
import { lakeLights, SLING_S } from './jade-southfest.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

const CANOPY = ['rgba(255,120,190,.2)', 'rgba(120,190,255,.2)', 'rgba(190,140,255,.2)'];
/** how high the Slingshot's capsule is (world units) `t` seconds into a ride: up fast, a hang, back down */
export const slingLift = (t: number) => { const k = Math.max(0, Math.min(1, t / SLING_S)); return Math.sin(k * Math.PI) ** 0.6 * 300; };
export function southSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const S = w.c.south; if (!S) return;
  // the Slingshot's capsule: waiting at the foot of the towers, or up in the air with the rider
  if (w.open.has('quay') && vis(S.sling[0], S.sling[1], 400)) {
    const rider = [w.p, w.mate].find(p => p.act?.n === 'sling');
    const lift = rider?.act ? slingLift(rider.act.t) : 0;
    list.push([S.sling[1] + 60, () => {
      if (lift > 4) { x.strokeStyle = 'rgba(230,230,240,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(S.sling[0] - 60, S.sling[1] - 120); x.lineTo(S.sling[0], S.sling[1] + 44 - lift); x.lineTo(S.sling[0] + 60, S.sling[1] - 120); x.stroke(); }
      spr(x, 'sling-capsule', S.sling[0], S.sling[1] + 56 - lift, { w: 64 });
    }]);
  }
  if (w.open.has('jurong') && lakeLights(w)) {
    S.lotus.forEach(([lx, ly], i) => { const bx = lx + Math.sin(sc.t * 0.4 + i * 1.7) * 14, by = ly + Math.cos(sc.t * 0.3 + i) * 8; if (vis(bx, by)) list.push([by, () => { spr(x, 'lotus-lantern', bx, by + 8, { w: 30 }); sc.glow(x, bx, by - 4, 30, 'rgba(255,170,190,.4)'); }]); });
  }
}
export function southOver(sc: Scene, x: X, w: World, vis: Vis) {
  const S = w.c.south; if (!S) return;
  if (w.open.has('quay')) S.canopy.forEach(([cx, cy], i) => { if (vis(cx, cy, 200)) sc.glow(x, cx, cy, 120 + Math.sin(sc.t * 0.9 + i) * 8, CANOPY[(i + Math.floor(sc.t / 3)) % 3]); });
  if (w.open.has('jurong') && lakeLights(w)) for (const [lx, ly] of S.lanterns) if (vis(lx, ly, 120)) sc.glow(x, lx, ly - 30, 70 + Math.sin(sc.t * 1.6 + lx) * 5, 'rgba(255,225,150,.3)');
  if (w.open.has('tiong') && vis(S.birds[0], S.birds[1], 120) && Math.floor(sc.t * 2) % 3 === 0) sc.glow(x, S.birds[0] + Math.sin(sc.t * 3) * 40 + 32, S.birds[1] - 90, 10, 'rgba(255,240,170,.6)');
}
