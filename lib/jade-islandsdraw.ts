// Jade Street (twenty-first pass): drawing the Southern Islands' moving parts. The island ferry on its timetable between
// Marina South Pier and St John's jetty (or carrying you), Kusu's tortoises basking and plodding round their pond,
// Madam Sutera's black junk lying off Pulau Satumu once she is there (from the keeper's job to the end of chapter
// thirteen), Raffles Lighthouse's beam sweeping round over the water; and on a tide crossing, the water itself coming in
// over the reef flats (a wash of blue that rises and falls with the HUD's Tide meter), the coral heads glowing as it
// turns, and the next marker or rock pool. Every object is a Codex painting; code lays them out and adds light. Rules:
// lib/jade-tide.ts and lib/jade-islandsfest.ts.
import { spr } from './jade-scene.js';
import { linkAt, ferryAt } from './jade-cable.js';
import { T, W, G } from './jade-city.js';
import { tideOf, phaseOf, TIDE } from './jade-tide.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Step } from './jade-story.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

/** what lives in each rock pool */
const POOL_LIFE = ['isl-seastar', 'isl-clam', 'isl-anemone', 'isl-octopus', 'isl-seahorse', 'isl-nudibranch'];
/** the island ferry's size (world units) */
export const LAUNCH_W = 96;
const tideOn = (w: World) => !!w.run && w.run.cur?.t === 'tide' && !!tideOf(w.run);
/** the junk lies off Satumu from the keeper's job until the end of the chapter */
export const junkHere = (w: World) => w.s.done.includes('m99') && !w.s.done.includes('m105');

export function islandsSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const I = w.c.islands; if (!I || !w.open.has('islands')) return;
  const cyc = (n: number, fps: number, k = 0) => Math.floor(sc.t * fps + k) % n;
  // the island ferry: on its timetable, or carrying you
  const L = I.ferry, mine = w.ferry?.l === 'launch';
  const f = mine ? (() => { const [fx, fy, h] = linkAt(L, w.ferry!.s); return { x: fx, y: fy, h: w.ferry!.dir > 0 ? h : h + Math.PI }; })() : ferryAt(L, w.time + 5);
  if (vis(f.x, f.y, 160)) list.push([f.y, () => {
    x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, f.x + 6, f.y + 10, 60, 26);
    spr(x, 'isl-ferry', f.x, f.y, { anchor: 'center', rot: f.h + Math.PI / 2, w: LAUNCH_W });
    if (mine) for (const [k, h] of [[-1, w.p.who], [1, w.mate.who]] as const) spr(x, `${h}-seat`, f.x + Math.cos(f.h) * k * 14, f.y + Math.sin(f.h) * k * 14 - 6, { w: 28 });
    sc.glow(x, f.x, f.y - 10, 40, 'rgba(255,220,150,.25)');
  }]);
  // Kusu's tortoises: basking, munching, now and then plodding a little way and back
  I.tortoises.forEach(([tx, ty], i) => {
    const ph = (sc.t * 0.12 + i * 0.37) % 1, walk = ph > 0.7, dx = walk ? Math.sin((ph - 0.7) / 0.3 * Math.PI) * 18 : 0;
    const fr = walk ? 'isl-tortoise-walk' : (i + cyc(2, 0.25, i)) % 2 ? 'isl-tortoise-munch' : 'isl-tortoise-rest';
    if (vis(tx, ty)) list.push([ty, () => { x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, tx + dx, ty + 2, 22, 8); spr(x, fr, tx + dx, ty + 4, { w: 44, flip: i % 2 === 1 }); }]);
  });
  // the rock pools' life (each pool keeps its own creature), a turtle hatchling scuttling down the lagoon beach to the sea
  // and a stingray gliding over the shoal off St John's: the reef is alive
  I.pools.forEach(([px, py], i) => { if (vis(px, py)) list.push([py - 6, () => spr(x, POOL_LIFE[i % POOL_LIFE.length], px + Math.sin(sc.t * 0.6 + i) * 4, py - 2, { w: 20 })]); });
  { const [lx, ly] = I.lagoon, k = (sc.t * 0.08) % 1, hx = lx - 40 + k * 30, hy = ly + 40 + k * 120;
    if (vis(hx, hy)) list.push([hy, () => spr(x, 'isl-hatchling', hx, hy, { w: 20, rot: Math.PI / 2 })]); }
  { const [sx, sy] = I.rocks[1], a = sc.t * 0.25, rx = sx + Math.cos(a) * 110, ry = sy + 70 + Math.sin(a) * 40;
    if (vis(rx, ry)) list.push([ry - 40, () => { x.globalAlpha = 0.75; spr(x, 'isl-stingray', rx, ry, { anchor: 'center', w: 40, rot: a + Math.PI }); x.globalAlpha = 1; }]); }
  // Madam Sutera's black junk, at anchor off Satumu
  if (junkHere(w)) {
    const [jx, jy] = I.junk;
    if (vis(jx, jy, 160)) list.push([jy, () => {
      x.fillStyle = 'rgba(0,0,0,.22)'; sc.shadow(x, jx + 8, jy + 18, 80, 26);
      spr(x, 'isl-junk', jx, jy + Math.sin(sc.t * 1.1) * 2, { anchor: 'center', w: 150, rot: 0.15 });
      sc.glow(x, jx - 20, jy - 30, 18, 'rgba(255,200,120,.45)');
    }]);
  }
}

/** the lighthouse beam, and on a tide crossing the water over the reef, the coral heads and the next marker (world
 * space, over everything) */
export function islandsOver(sc: Scene, x: X, w: World, vis: Vis, ox: number, oy: number, cw: number, ch: number) {
  const I = w.c.islands; if (!I || !w.open.has('islands')) return;
  // Raffles Lighthouse's beam, sweeping round (a long soft wedge of light)
  const [bx, by] = I.beam;
  if (vis(bx, by, 900)) {
    const a = sc.t * 0.7;
    x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(bx, by, 10, bx, by, 760);
    g.addColorStop(0, 'rgba(255,240,190,.32)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(bx, by); x.arc(bx, by, 760, a - 0.09, a + 0.09); x.closePath(); x.fill();
    x.restore();
    sc.glow(x, bx, by, 30 + Math.sin(sc.t * 3) * 3, 'rgba(255,240,180,.7)');
  }
  const run = w.run; if (!run || !tideOn(w)) return;
  const st = run.cur as Extract<Step, { t: 'tide' }>, c = tideOf(run)!, { ph, v } = phaseOf(run, st, c.t);
  // the water over the flats
  if (v > 0) {
    x.fillStyle = `rgba(70,170,215,${0.12 + v * 0.42})`;
    const tx0 = Math.max(0, Math.floor(ox / T)), ty0 = Math.max(0, Math.floor(oy / T)), tx1 = Math.floor((ox + cw) / T) + 1, ty1 = Math.floor((oy + ch) / T) + 1;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1 && tx < W; tx++) if (w.c.ground[ty * W + tx] === G.REEF) x.fillRect(tx * T, ty * T, T, T);
    // foam lines rolling in
    x.strokeStyle = `rgba(235,250,255,${0.25 + v * 0.35})`; x.lineWidth = 3;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1 && tx < W; tx++) if (w.c.ground[ty * W + tx] === G.REEF && (tx + ty) % 3 === 0) {
      const off = ((sc.t * 30 + tx * 13) % T); x.beginPath(); x.moveTo(tx * T + 6, ty * T + off); x.quadraticCurveTo(tx * T + T / 2, ty * T + off - 6, tx * T + T - 6, ty * T + off); x.stroke();
    }
  }
  // the coral heads: safe ground; they glow as the tide turns and while it is in
  for (const [rx, ry] of I.rocks) if (vis(rx, ry, 60)) {
    if (ph !== 'out') sc.glow(x, rx, ry, TIDE.rock * (0.8 + Math.sin(sc.t * 5) * 0.08), ph === 'in' ? 'rgba(255,220,120,.4)' : 'rgba(255,200,90,.32)');
    x.save(); x.strokeStyle = ph === 'out' ? 'rgba(255,255,255,.25)' : 'rgba(255,214,90,.85)'; x.lineWidth = 2; x.setLineDash([6, 6]);
    x.beginPath(); x.ellipse(rx, ry, TIDE.rock, TIDE.rock * 0.6, 0, 0, Math.PI * 2); x.stroke(); x.restore();
  }
  // the next marker or pool: a pulsing ring
  const pools = st.pools ?? [];
  const nxt = c.pools < pools.length ? run.spot(pools[c.pools]) : c.k < st.route.length ? run.spot(st.route[c.k]) : null;
  if (nxt && vis(nxt[0], nxt[1], 80)) {
    const [mx, my] = nxt;
    sc.glow(x, mx, my - 6, 44 + Math.sin(sc.t * 4) * 6, 'rgba(120,230,255,.45)');
    x.save(); x.strokeStyle = 'rgba(160,240,255,.95)'; x.lineWidth = 3; x.setLineDash([8, 6]); x.lineDashOffset = -sc.t * 30;
    x.beginPath(); x.ellipse(mx, my, TIDE.reach, TIDE.reach * 0.55, 0, 0, Math.PI * 2); x.stroke(); x.restore();
  }
}
