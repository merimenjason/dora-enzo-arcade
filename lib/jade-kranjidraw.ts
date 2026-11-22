// Jade Street (twenty-fourth pass): drawing Kranji and Woodlands' moving parts. The estuarine crocodiles basking on the
// Sungei Buloh mudflats (dozing, an eye open, head up and watching, and lunging), the mudskippers hopping about their
// burrows, the water monitor pacing the boardwalk's edge, the whimbrel flocks probing the mud, Hay Dairies' goats and
// the frog farm's bullfrogs; the Causeway's famous jam, four lanes nose to tail inching along all night (drawn only:
// its lanes are closed tiles, and no traffic car ever goes there), with Madam Sutera's long black car stuck in it on
// the Friday of chapter fifteen; one of her owls on the waterfront rail while she is about. On a mud crossing, each
// crocodile's sight shows as a ring once it stirs, and the next marker or flock pulses. Nothing moves inside the
// memorial's hedge. Every object is a Codex painting; code lays them out. Rules: lib/jade-mud.ts and
// lib/jade-kranjifest.ts.
import { spr } from './jade-scene.js';
import { mudOf, crocPhase, MUD } from './jade-mud.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Step } from './jade-story.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;
type Mud = Extract<Step, { t: 'mud' }>;

/** sizes (world units) */
export const CROC_W = 146, CAR_W = 50, LORRY_W = 58, LIMO_W = 54;
/** the jam's cars, in turn down each lane (core traffic paintings, and Kranji's lorry) */
const QUEUE_CARS = ['car-mint', 'kr-lorry', 'car-van', 'car-taxi', 'car-mint', 'car-moto', 'car-van', 'kr-lorry', 'car-taxi'];
/** the gap between cars in the queue, and how far the queue creeps on each lurch (world units) */
const GAP = 92, LURCH = 18;
/** Madam Sutera's car is in the queue from the dam (she said Friday) until Pip's tin is back */
export const limoHere = (w: World) => w.s.done.includes('m120') && !w.s.done.includes('m122');
/** one of her owls watches from the waterfront rail through the end of the chapter */
export const owlHere = (w: World) => w.s.done.includes('m122') && !w.s.done.includes('m125');
const mudOn = (w: World) => !!w.run && w.run.cur?.t === 'mud' && !!mudOf(w.run);

export function kranjiSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const K = w.c.kranji; if (!K || !w.open.has('kranji')) return;
  const cyc = (n: number, fps: number, k = 0) => Math.floor(sc.t * fps + k) % n;
  // the crocodiles: on a crossing, the step's own (their rhythm is the HUD's); otherwise basking, now and then an eye
  const run = w.run, on = mudOn(w);
  const st = on ? run!.cur as Mud : null, mc = on ? mudOf(run!)! : null;
  const ph = on ? crocPhase(run!, st!, mc!.t).ph : null;
  const crocs = on ? st!.crocs.map(s => run!.spot(s)) : K.crocs;
  crocs.forEach(([cx, cy], i) => {
    if (!vis(cx, cy, 120)) return;
    const snap = mc?.snap && mc.snap.at[0] === cx && mc.snap.at[1] === cy && mc.snap.t < 0.8;
    const f = snap ? 'kr-croc-snap' : ph === 'watch' ? 'kr-croc-watch' : ph === 'stir' ? 'kr-croc-peek' : !on && (cyc(9, 0.3, i * 3) === 0) ? 'kr-croc-peek' : 'kr-croc-doze';
    list.push([cy, () => { x.fillStyle = 'rgba(0,0,0,.22)'; sc.shadow(x, cx, cy + 4, CROC_W * 0.42, 14); spr(x, f, cx, cy + 10, { w: CROC_W, flip: i % 2 === 1 }); }]);
  });
  // mudskippers: perched by their burrows, hopping now and then
  K.skippers.forEach(([sx, sy], i) => {
    const hop = cyc(5, 1.3, i * 2) === 0, dy = hop ? -8 : 0;
    if (vis(sx, sy)) list.push([sy, () => spr(x, hop ? 'kr-skipper-1' : 'kr-skipper-0', sx + (hop ? 4 : 0), sy + 4 + dy, { w: 24, flip: i % 2 === 0 })]);
  });
  // the water monitor, pacing the boardwalk's edge and back
  { const pts = K.lizard, n = pts.length - 1, u = (sc.t * 0.05) % 2, s = (u < 1 ? u : 2 - u) * n, k = Math.min(n - 1, Math.floor(s)), f = s - k;
    const lx = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, ly = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
    if (vis(lx, ly)) list.push([ly, () => spr(x, `kr-lizard-${cyc(2, 3)}`, lx, ly + 6, { w: 62, flip: (u < 1) !== (pts[k + 1][0] >= pts[k][0]) })]); }
  // the whimbrel flocks: three to a flock, probing the mud and walking a step
  K.birds.forEach(([bx, by], i) => { for (let j = 0; j < 3; j++) {
    const ox = (j - 1) * 26 + Math.sin(sc.t * 0.4 + i + j) * 6, oy = (j % 2) * 12, px = bx + ox, py = by + oy;
    if (vis(px, py)) list.push([py, () => spr(x, cyc(2, 0.7, i + j * 1.7) ? 'kr-whimbrel-0' : 'kr-whimbrel-1', px, py + 4, { w: 30, flip: (i + j) % 2 === 1 })]);
  } });
  // Hay Dairies' goats, and the frog farm's bullfrogs round their ponds
  K.goats.forEach(([gx, gy], i) => { if (vis(gx, gy)) list.push([gy, () => { x.fillStyle = 'rgba(0,0,0,.2)'; sc.shadow(x, gx, gy + 2, 18, 6); spr(x, cyc(2, 0.4, i) ? 'kr-goat-1' : 'kr-goat-0', gx, gy + 4, { w: 50, flip: i % 2 === 1 }); }]); });
  K.frogs.forEach(([fx, fy], i) => { const leap = cyc(7, 1.1, i * 3) === 0;
    if (vis(fx, fy)) list.push([fy, () => spr(x, leap ? 'kr-frog-1' : 'kr-frog-0', fx + (leap ? 6 : 0), fy + 2 + (leap ? -6 : 0), { w: 20, flip: i % 2 === 1 })]); });
  // the Causeway's jam: four lanes nose to tail, creeping a car's length now and then (south into Singapore on the
  // west lanes, north to Johor on the east)
  K.queue.forEach((q, li) => {
    const span = q.y1 - q.y0, n = Math.ceil(span / GAP) + 1;
    // the lurch: still for a few seconds, then a short creep forward
    const beat = sc.t / 5 + li * 0.37, base = Math.floor(beat), e = Math.min(1, (beat - base) * 4), creep = ((base + e) * LURCH) % GAP;
    for (let k = 0; k < n; k++) {
      const pos = (k * GAP + creep) % span, y = q.dir > 0 ? q.y0 + pos : q.y1 - pos;
      const limo = limoHere(w) && li === 0 && k === 1;
      const name = limo ? 'kr-car-sutera' : QUEUE_CARS[(k * 3 + li * 5) % QUEUE_CARS.length];
      const cw = limo ? LIMO_W : name === 'kr-lorry' ? LORRY_W : name === 'car-moto' ? 24 : CAR_W;
      if (!vis(q.x, y, 120)) continue;
      list.push([y + 20, () => {
        x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, q.x + 4, y + 6, cw * 0.5, cw * 0.9);
        spr(x, name, q.x, y, { anchor: 'center', w: cw, rot: q.dir > 0 ? Math.PI : 0 });
        // brake lights, glowing at the back of every car (the queue's famous red ribbon at night)
        const by = y + (q.dir > 0 ? -1 : 1) * cw * 0.85;
        sc.glow(x, q.x, by, 12, 'rgba(255,60,40,.5)');
      }]);
    }
  });
  // one of Madam Sutera's owls, on the waterfront rail
  if (owlHere(w)) { const [ox, oy] = [K.jetty[0] - 90, K.jetty[1] + 4 * 64]; if (vis(ox, oy)) list.push([oy, () => spr(x, 'kr-owl', ox, oy, { w: 30 })]); }
}

/** on a mud crossing: each crocodile's sight once it stirs, and the next marker or flock (world space, over
 * everything) */
export function kranjiOver(sc: Scene, x: X, w: World, vis: Vis) {
  if (!w.c.kranji || !mudOn(w)) return;
  const run = w.run!, st = run.cur as Mud, c = mudOf(run)!, { ph } = crocPhase(run, st, c.t);
  if (ph !== 'doze') for (const s of st.crocs) {
    const [cx, cy] = run.spot(s); if (!vis(cx, cy, MUD.sight)) continue;
    x.save(); x.strokeStyle = ph === 'watch' ? 'rgba(255,90,70,.75)' : 'rgba(255,200,90,.6)'; x.lineWidth = 3; x.setLineDash([10, 8]);
    x.beginPath(); x.ellipse(cx, cy, MUD.sight, MUD.sight, 0, 0, Math.PI * 2); x.stroke(); x.restore();
    if (ph === 'watch') { x.fillStyle = 'rgba(255,80,60,.07)'; x.beginPath(); x.ellipse(cx, cy, MUD.sight, MUD.sight, 0, 0, Math.PI * 2); x.fill(); }
  }
  const birds = st.birds ?? [];
  const nxt = c.birds < birds.length ? run.spot(birds[c.birds]) : c.k < st.route.length ? run.spot(st.route[c.k]) : null;
  if (nxt && vis(nxt[0], nxt[1], 80)) {
    const [mx, my] = nxt;
    sc.glow(x, mx, my - 6, 44 + Math.sin(sc.t * 4) * 6, 'rgba(255,230,140,.45)');
    x.save(); x.strokeStyle = 'rgba(255,236,160,.95)'; x.lineWidth = 3; x.setLineDash([8, 6]); x.lineDashOffset = -sc.t * 30;
    x.beginPath(); x.ellipse(mx, my, MUD.reach, MUD.reach * 0.55, 0, 0, Math.PI * 2); x.stroke(); x.restore();
  }
}
