// Jade Street (twenty-fifth pass): drawing Punggol and Coney Island's moving parts. Coney Island's Brahman cattle grazing
// under the casuarinas (now and then a few steps, now and then a look round) and a calf at its mother's side, the
// smooth-coated otters swimming the Waterway, the oriental pied hornbills in the casuarinas; on a herding job the cow (or
// calf) itself, walking on, watching you, backing off, grazing or bolting, with the HUD's comfortable band drawn round
// her (the inner ring is "too close") and the next gate pulsing; one of Madam Sutera's owls on the old gauge house while
// the Pucong Boys are about, and her black junk at anchor off Punggol Point late in chapter sixteen. Every object is a
// Codex painting; code lays them out. Rules: lib/jade-herd.ts and lib/jade-punggolfest.ts.
import { spr } from './jade-scene.js';
import { herdOf, bandOf, nextGate } from './jade-herd.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Step } from './jade-story.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;
type Herd = Extract<Step, { t: 'herd' }>;

/** sizes (world units) */
export const COW_W = 110, CALF_W = 70, OTTER_W = 40, BILL_W = 40, JUNK_W = 200;
/** one of Madam Sutera's owls sits on the gauge house from the heron camp until the king tide */
export const owlHere = (w: World) => w.s.done.includes('m128') && !w.s.done.includes('m135');
/** her junk lies at anchor off Punggol Point from the sea wall until it weighs anchor at the end of the chapter */
export const junkHere = (w: World) => w.s.done.includes('m131') && !w.s.done.includes('m135');
const herdOn = (w: World) => !!w.run && w.run.cur?.t === 'herd' && !!herdOf(w.run);

export function punggolSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const K = w.c.punggol; if (!K || !w.open.has('punggol')) return;
  const cyc = (n: number, fps: number, k = 0) => Math.floor(sc.t * fps + k) % n;
  // the pasture's cattle: grazing, with a slow step now and then and a look round
  K.cattle.forEach(([cx, cy], i) => {
    if (!vis(cx, cy, 120)) return;
    const beat = cyc(12, 0.5, i * 5), f = beat === 0 ? 'pg-cow-look' : beat < 3 ? `pg-cow-walk-${cyc(2, 2)}` : 'pg-cow-graze';
    list.push([cy, () => { x.fillStyle = 'rgba(0,0,0,.22)'; sc.shadow(x, cx, cy + 4, COW_W * 0.36, 12); spr(x, f, cx, cy + 8, { w: COW_W, flip: i % 2 === 1 }); }]);
  });
  { const [kx, ky] = K.calf; if (vis(kx, ky)) list.push([ky, () => { x.fillStyle = 'rgba(0,0,0,.2)'; sc.shadow(x, kx, ky + 3, CALF_W * 0.34, 9); spr(x, `pg-calf-${cyc(2, 0.6)}`, kx, ky + 6, { w: CALF_W }); }]); }
  // the cow (or calf) on a herding job: her mode is the HUD's
  if (herdOn(w)) {
    const run = w.run!, st = run.cur as Herd, c = herdOf(run)!;
    if (vis(c.x, c.y, 140)) {
      const calf = !!st.calf, cw = calf ? CALF_W : COW_W;
      const f = calf ? (c.mode === 'graze' || c.mode === 'look' ? 'pg-calf-0' : `pg-calf-${cyc(2, c.mode === 'bolt' ? 8 : 3)}`)
        : c.mode === 'bolt' ? 'pg-cow-bolt' : c.mode === 'look' ? 'pg-cow-look' : c.mode === 'graze' ? 'pg-cow-graze' : `pg-cow-walk-${cyc(2, c.mode === 'back' ? 1.5 : 2.5)}`;
      // (she faces her way along the trail; backing off or bolting, the other way)
      const away = c.mode === 'back' || c.mode === 'bolt', flip = (c.hx < 0) !== away;
      list.push([c.y, () => { x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, c.x, c.y + 4, cw * 0.38, 12); spr(x, f, c.x, c.y + 8, { w: cw, flip }); }]);
    }
  }
  // otters along the Waterway, there and back
  { const pts = K.otters, n = pts.length - 1;
    if (n > 0) for (let j = 0; j < 2; j++) {
      const u = (sc.t * 0.03 + j * 0.6) % 2, s = (u < 1 ? u : 2 - u) * n, k = Math.min(n - 1, Math.floor(s)), fr = s - k;
      const ox = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * fr + j * 30, oy = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * fr + j * 10;
      if (vis(ox, oy)) list.push([oy, () => spr(x, `pg-otter-${cyc(2, 2, j)}`, ox, oy + 4, { w: OTTER_W, flip: (u < 1) !== (pts[k + 1][0] >= pts[k][0]) })]);
    } }
  // hornbills in the casuarinas
  K.hornbills.forEach(([hx, hy], i) => { if (vis(hx, hy)) list.push([hy + 40, () => spr(x, cyc(2, 0.25, i * 1.3) ? 'pg-hornbill-1' : 'pg-hornbill-0', hx, hy, { w: BILL_W, flip: i % 2 === 0 })]); });
  // one of Madam Sutera's owls on the gauge house, and her junk off the point
  if (owlHere(w)) { const g = w.c.places['pg-gauge']; if (g && vis(g.x, g.y - 80)) list.push([g.y + 40, () => spr(x, 'pg-owl', g.x + 30, g.y - 70, { w: 30 })]); }
  if (junkHere(w)) { const [jx, jy] = K.junk; if (vis(jx, jy, 220)) list.push([jy, () => { spr(x, 'pg-junk', jx, jy + 20, { w: JUNK_W, flip: Math.sin(sc.t * 0.2) > 0.95 }); }]); }
}

/** on a herding job: the comfortable band round the cow (the inner ring is too close, the outer is too far to move her)
 * and the next gate (world space, over everything) */
export function punggolOver(sc: Scene, x: X, w: World, vis: Vis) {
  if (!w.c.punggol || !herdOn(w)) return;
  const run = w.run!, st = run.cur as Herd, c = herdOf(run)!, [near, far] = bandOf(run, st);
  if (vis(c.x, c.y, far)) {
    x.save(); x.lineWidth = 3; x.setLineDash([10, 8]);
    x.strokeStyle = c.calm < 0.5 || c.mode === 'bolt' ? 'rgba(255,90,70,.8)' : 'rgba(255,200,90,.65)';
    x.beginPath(); x.ellipse(c.x, c.y, near, near, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(200,230,255,.35)'; x.setLineDash([4, 10]);
    x.beginPath(); x.ellipse(c.x, c.y, far, far, 0, 0, Math.PI * 2); x.stroke();
    // where to stand: an arc behind her, between the rings
    if (c.mode !== 'bolt') {
      const a = Math.atan2(-c.hy, -c.hx), r = (near + far) / 2;
      // (kept on the scene, as drawn, for the browser tests' first-timer: the arc they steer for)
      (sc as unknown as { herdArc?: number[] }).herdArc = [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.x, c.y, near, far, c.hx, c.hy];
      x.strokeStyle = 'rgba(160,255,190,.7)'; x.lineWidth = 6; x.setLineDash([]);
      x.beginPath(); x.ellipse(c.x, c.y, r, r, 0, a - 0.55, a + 0.55); x.stroke();
    }
    x.restore();
  }
  const g = nextGate(run);
  if (g && vis(g[0], g[1], 80)) {
    const [gx, gy] = g;
    sc.glow(x, gx, gy - 6, 44 + Math.sin(sc.t * 4) * 6, 'rgba(255,230,140,.45)');
    x.save(); x.strokeStyle = 'rgba(255,236,160,.95)'; x.lineWidth = 3; x.setLineDash([8, 6]); x.lineDashOffset = -sc.t * 30;
    x.beginPath(); x.ellipse(gx, gy, 44, 24, 0, 0, Math.PI * 2); x.stroke(); x.restore();
  }
}
