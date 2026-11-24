// Jade Street (twenty-sixth pass): drawing Bishan and Ang Mo Kio's moving parts. The Bishan Ten (the park's family of
// smooth-coated otters: bounding along the riverbanks, a pup at the back, one sat up on the bank by the holt, now and
// then one rolling), a white-throated kingfisher on a reed at the bend, two of Ah Wei's Koel Boys loafing under their rain
// tree while the chapter's business is unfinished; on a stepping-stones job the river's surges (a white rush of water
// down the bend and over every low stone while it is under, its ripples gathering while it rises), the stone you stand
// on and the next one ringed. Every object is a Codex painting; code lays them out. Rules: lib/jade-stones.ts and
// lib/jade-bishanfest.ts.
import { spr } from './jade-scene.js';
import { stonesOf, surgeAt, isLow } from './jade-stones.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Step } from './jade-story.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;
type Stones = Extract<Step, { t: 'stones' }>;

/** sizes (world units) */
export const OTTER_W = 44, PUP_W = 26, KOEL_W = 46;
/** two Koel Boys loaf under the rain tree from the stepping stones until the stone is read */
export const koelsHere = (w: World) => w.s.done.includes('m136') && !w.s.done.includes('m145');
const stonesOn = (w: World) => !!w.run && w.run.cur?.t === 'stones' && !!stonesOf(w.run);

export function bishanSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const B = w.c.bishan; if (!B || !w.open.has('bishan')) return;
  const cyc = (n: number, fps: number, k = 0) => Math.floor(sc.t * fps + k) % n;
  // the Bishan Ten along the banks: three bounding there and back on each run, the pup last, one rolling now and then
  B.otters.forEach((pts, r) => {
    const n = pts.length - 1; if (n < 1) return;
    for (let j = 0; j < 3; j++) {
      const u = (sc.t * 0.025 + r * 0.37 + j * 0.05) % 2, s = (u < 1 ? u : 2 - u) * n, k = Math.min(n - 1, Math.floor(s)), fr = s - k;
      const ox = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * fr - j * 26, oy = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * fr + j * 6;
      if (!vis(ox, oy)) continue;
      const pup = j === 2, roll = !pup && cyc(14, 0.7, r * 3 + j * 5) === 0;
      const f = pup ? `bs-pup-${cyc(2, 3, j)}` : roll ? 'bs-otter-roll' : `bs-otter-${cyc(2, 2.5, j)}`;
      list.push([oy, () => spr(x, f, ox, oy + 4, { w: pup ? PUP_W : OTTER_W, flip: (u < 1) !== (pts[k + 1][0] >= pts[k][0]) })]);
    }
  });
  { const [hx, hy] = B.holt; if (vis(hx, hy)) list.push([hy, () => spr(x, cyc(6, 0.4) === 0 ? 'bs-otter-roll' : 'bs-otter-sit', hx, hy + 4, { w: OTTER_W })]); }
  // the kingfisher on a reed at the west end of the bend
  { const [bx, by, , ey] = B.bend, kx = bx - 30, ky = (by + ey) / 2 - 40; if (vis(kx, ky)) list.push([ky + 30, () => spr(x, 'bs-kingfisher', kx, ky, { w: 22, flip: cyc(2, 0.2) === 1 })]); }
  // Koel Boys under their rain tree
  if (koelsHere(w) && !(w.run && w.run.cur?.t === 'case')) {
    const k = w.c.places['bs-koel'];
    if (k && vis(k.x, k.y)) for (let i = 0; i < 2; i++) {
      const kx = k.x + (i ? 50 : -36), ky = k.y + (i ? 10 : -4), f = cyc(9, 0.5, i * 4) === 0 ? 'koel-sing' : i ? 'koel-munch' : 'koel-walk-down-0';
      list.push([ky, () => spr(x, f, kx, ky + 4, { w: KOEL_W, flip: i === 1 })]);
    }
  }
  // on a stepping-stones job: the surge over each low stone (drawn just under anyone standing there) and the rings
  if (stonesOn(w)) {
    const run = w.run!, st = run.cur as Stones, c = stonesOf(run)!, sg = surgeAt(run, st, c.t);
    const pts = st.stones.map(s => run.spot(s));
    pts.forEach(([px, py], i) => {
      if (!vis(px, py, 80)) return;
      const low = isLow(st, i), cur = i === c.k, next = i === c.k + 1;
      list.push([py - 30, () => {
        if (low && sg.ph !== 'calm') {
          // rising: ripples gather round it; under: white water over it
          const a = sg.ph === 'surge' ? 0.75 : 0.25 + 0.2 * Math.sin(sc.t * 10);
          x.save(); x.fillStyle = `rgba(225,245,255,${a})`; x.beginPath(); x.ellipse(px, py + 6, 36, 18, 0, 0, Math.PI * 2); x.fill(); x.restore();
        }
        if (cur || next) {
          x.save(); x.lineWidth = 3; x.setLineDash([8, 6]); x.lineDashOffset = -sc.t * 30;
          x.strokeStyle = next ? (low && sg.ph !== 'calm' ? 'rgba(255,110,90,.9)' : 'rgba(255,236,160,.95)') : 'rgba(160,255,190,.7)';
          x.beginPath(); x.ellipse(px, py + 6, 38, 20, 0, 0, Math.PI * 2); x.stroke(); x.restore();
        }
      }]);
    });
  }
}

/** on a stepping-stones job: the surge's rush down the bend (white streaks across the water, world space, over the
 * ground but drawn first so the heroes stay on top) */
export function bishanGround(sc: Scene, x: X, w: World, vis: Vis) {
  const B = w.c.bishan; if (!B || !stonesOn(w)) return;
  const run = w.run!, st = run.cur as Stones, c = stonesOf(run)!, sg = surgeAt(run, st, c.t);
  if (sg.ph === 'calm') return;
  const [x0, y0, x1, y1] = B.bend; if (!vis((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2)) return;
  x.save(); x.strokeStyle = sg.ph === 'surge' ? 'rgba(235,250,255,.55)' : 'rgba(210,235,255,.28)'; x.lineWidth = sg.ph === 'surge' ? 5 : 3;
  for (let i = 0; i < 18; i++) {
    const yy = y0 + ((i * 37) % (y1 - y0)), off = ((sc.t * (sg.ph === 'surge' ? 260 : 90) + i * 97) % (x1 - x0 + 120)) - 60;
    x.beginPath(); x.moveTo(x0 + off, yy); x.lineTo(x0 + off + 50, yy + 4); x.stroke();
  }
  x.restore();
}
