// Jade Street (eighteenth pass): drawing Kallang's moving parts. The match-night fans streaming across a crowd job's
// lanes (each walks its own way with its own walk cycle; on Assist the spot where you would cross glows green while the
// gap in front of you will last, amber while it won't), the fans round the fan-zone stage (they go up one after another
// when you start the Kallang Wave), and Madam Sutera's black seaplane moored on the Kallang Basin until it flies south at
// the end of chapter eleven. Every object is a Codex painting; code lays them out and adds light. Rules: lib/jade-crowd.ts
// and lib/jade-kallangfest.ts.
import { spr } from './jade-scene.js';
import { crowdOf, fanAt, nextLane, laneAt, laneClear, crossTime, BAND } from './jade-crowd.js';
import { WAVE_S } from './jade-kallangfest.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

const SKIN = ['bear', 'kancil', 'otter'];
/** a fan's frame walking along (vx, vy): toward or away from the camera, or side-on (flipped walking left) */
function walkFrame(skin: string, vx: number, vy: number, t: number): [string, boolean] {
  if (Math.abs(vx) > Math.abs(vy)) return [`folk-fan${skin}-side-${Math.floor(t * 5) % 2}`, vx < 0];
  return [vy > 0 ? `folk-fan${skin}-down` : `folk-fan${skin}-up`, Math.floor(t * 4) % 2 === 1];
}
/** the fan zone's own little crowd round the stage (local offsets in tiles from the wave spot) */
const ZONE: [number, number][] = [[-1.6, -0.6], [-0.8, -1.1], [0, -0.7], [0.9, -1.2], [1.7, -0.6], [-1.2, 0.5], [0.4, 0.6], [1.5, 0.4]];

export function kallangSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const K = w.c.kallang; if (!K || !w.open.has('kallang')) return;
  const run = w.run, c = run && run.cur?.t === 'crowd' ? crowdOf(run) : null;
  // a crowd job: every fan in every lane
  if (c) {
    c.lanes.forEach((L, k) => L.fans.forEach((_, j) => {
      const [fx, fy] = fanAt(c, k, j); if (!vis(fx, fy)) return;
      const vx = c.nx * L.dir, vy = c.ny * L.dir, [fr, flip] = walkFrame(SKIN[L.skin[j]], vx, vy, c.t + j * 0.37);
      list.push([fy, () => { x.fillStyle = 'rgba(0,0,0,.26)'; sc.shadow(x, fx, fy + 2, 26, 10); spr(x, fr, fx, fy + 4, { flip }); }]);
    }));
    // Assist: where you would cross the next lane, green while the gap will last, amber while it won't
    const p = w.p, n = nextLane(c, p.x, p.y);
    if (run!.assist && n >= 0 && laneAt(c, p.x, p.y) < 0) {
      const a = (p.x - c.ox) * c.ux + (p.y - c.oy) * c.uy, s = (p.x - c.ox) * c.nx + (p.y - c.oy) * c.ny, L = c.lanes[n];
      if (L.at - BAND - a < 90 && Math.abs(s) < c.span) {
        const gx = c.ox + c.ux * L.at + c.nx * s, gy = c.oy + c.uy * L.at + c.ny * s, ok = laneClear(c, n, s, crossTime() + 0.25);
        list.push([gy - 40, () => sc.glow(x, gx, gy, 40 + Math.sin(sc.t * 6) * 5, ok ? 'rgba(120,255,150,.45)' : 'rgba(255,180,80,.32)')]);
      }
    }
  } else {
    // the fan zone's fans: idle, cheering now and then, and up in turn while the Kallang Wave runs round them
    const since = w.time - w.kallang.waveT;
    ZONE.forEach(([dx, dy], i) => {
      const fx = K.wave[0] + dx * 64, fy = K.wave[1] + dy * 64; if (!vis(fx, fy)) return;
      const skin = SKIN[i % 3], up = since >= 0 && since < WAVE_S && Math.abs(since - (i / ZONE.length) * (WAVE_S - 0.6)) < 0.5;
      const fr = up || Math.floor(sc.t * 0.7 + i * 1.3) % 6 === 0 ? `folk-fan${skin}-hop` : `folk-fan${skin}-down`;
      list.push([fy, () => { x.fillStyle = 'rgba(0,0,0,.24)'; sc.shadow(x, fx, fy + 2, 26, 10); spr(x, fr, fx, fy + 4 - (up ? 8 : 0), { flip: i % 2 === 1 }); }]);
    });
  }
  // Madam Sutera's black seaplane, moored on the basin from the start of chapter eleven until it flies south
  if (w.s.done.includes('m75') && !w.s.done.includes('m85')) {
    const [x0, y0, x1, y1] = K.basin, sx = x0 + (x1 - x0) * 0.55, sy = y0 + (y1 - y0) * 0.5;
    if (vis(sx, sy, 140)) list.push([sy, () => {
      x.fillStyle = 'rgba(0,0,0,.22)'; sc.shadow(x, sx + 8, sy + 16, 80, 26);
      spr(x, 'kal-seaplane', sx, sy + Math.sin(sc.t * 1.3) * 2, { anchor: 'center', w: 170, rot: -0.35 });
    }]);
  }
}
