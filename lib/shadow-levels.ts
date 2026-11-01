// Shadowplay's puppets and its five stories of six scenes. Every shape is a cut-out in units at k = 1, centred on
// its area's middle so it turns about that point. Each scene lists its puppets with where they start and where they
// belong (the authored solution, which is what the target silhouette is drawn from), its lanterns and the tools it
// teaches. Positions are shadow centres with the lanterns at home, written in units here and stored in eighths.
import type { Poly, ShapeDef, SceneDef, StoryDef, V2, PropDef, Pose, LampDef, Tool } from './shadow-game.js';

const DEG = Math.PI / 180;
/** Points round an ellipse from a0 to a1 degrees (y down, so 90° is straight down), both ends included. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): V2[] {
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return o;
}
const ring = (cx: number, cy: number, rx: number, ry: number, n = 28) => arc(cx, cy, rx, ry, 0, 360, n).slice(0, -1);
/** A cubic curve's points after its start. */
function bez(p0: V2, p1: V2, p2: V2, p3: V2, n = 10): V2[] {
  const o: V2[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return o;
}
/** A ribbon round a polyline, its width running from w0 to w1. */
function stroke(line: V2[], w0: number, w1 = w0): V2[] {
  const L: V2[] = [], R: V2[] = [], n = line.length;
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    L.push([line[i][0] - (dy / l) * w, line[i][1] + (dx / l) * w]); R.push([line[i][0] + (dy / l) * w, line[i][1] - (dx / l) * w]);
  }
  return [...L, ...R.reverse()];
}
/** The right half of a symmetric outline, top to bottom, made whole. */
const mirror = (right: V2[]): V2[] => [...right, ...right.slice().reverse().filter(([x]) => x > 1e-6).map(([x, y]) => [-x, y] as V2)];
const area = (p: Poly) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return a / 2; };
/** Centres a shape's pieces on their combined area's middle, all wound the same way, rounded to thousandths. */
function centred(polys: Poly[], holes: Poly[] = []): { polys: Poly[]; holes: Poly[] } {
  let A = 0, cx = 0, cy = 0;
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
      A += f; cx += (p[j][0] + p[i][0]) * f; cy += (p[j][1] + p[i][1]) * f;
    }
  }
  // pieces may wind either way; use the absolute area of each for the middle
  let sa = 0, sx = 0, sy = 0;
  for (const p of polys) {
    let a = 0, x = 0, y = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; a += f; x += (p[j][0] + p[i][0]) * f; y += (p[j][1] + p[i][1]) * f; }
    if (Math.abs(a) < 1e-9) continue;
    sa += Math.abs(a) / 2; sx += (x / (3 * a)) * (Math.abs(a) / 2); sy += (y / (3 * a)) * (Math.abs(a) / 2);
  }
  void A; void cx; void cy;
  const mx = sx / sa, my = sy / sa;
  const fix = (p: Poly): Poly => { const q = p.map(([x, y]) => [Math.round((x - mx) * 1000) / 1000, Math.round((y - my) * 1000) / 1000] as V2); return area(q) < 0 ? q.reverse() : q; };
  return { polys: polys.map(fix), holes: holes.map(fix) };
}
function shape(name: string, blurb: string, polys: Poly[], extra: { gel?: ShapeDef['gel']; turn?: boolean; holes?: Poly[]; round?: boolean; stiff?: number[] } = {}): ShapeDef {
  const c = centred(polys, extra.holes);
  return { name, blurb, polys: c.polys, holes: c.holes, gel: extra.gel, turn: extra.turn, round: extra.round, stiff: extra.stiff };
}

// ---------------------------------------------------------------- the puppets
const pear = mirror([[0, -0.85], [0.17, -0.84], [0.3, -0.76], [0.37, -0.6], [0.38, -0.42], [0.43, -0.24], [0.55, -0.06], [0.64, 0.14], [0.67, 0.36], [0.62, 0.58], [0.47, 0.75], [0.25, 0.84], [0, 0.86]]);
pear.splice(1, 0, [0.05, -0.92], [0.13, -1.12], [0.06, -1.14], [0.0, -0.95]);
const bowl: V2[] = [[-1.62, -0.13], [1.62, -0.13], [1.62, 0.02], ...arc(0, 0.02, 1.5, 1.0, 0, 180, 22), [-1.62, 0.02]];
const bell = mirror([[0, -0.82], [0.06, -0.8], [0.06, -0.56], [0.24, -0.53], [0.4, -0.42], [0.49, -0.22], [0.52, 0.0], [0.55, 0.2], [0.6, 0.4], [0.64, 0.62], [0.47, 0.5], [0.32, 0.44], [0.16, 0.42], [0, 0.44]]);
const cane = stroke([[0, 1.0], [0, 0.4], [0, -0.3], ...arc(0.33, -0.3, 0.33, 0.33, 180, 360, 12), [0.66, -0.12]], 0.18);
const croissant: V2[] = [...arc(0, 0, 0.82, 0.82, 40, 320, 24), ...arc(0.3, 0, 0.61, 0.61, 302, 58, 18).slice(1, -1)];
const sandwich: V2[] = [[0, 0], [0.12, -0.03], [2.3, -0.03], [2.42, 0.06], [2.38, 0.16], [0.16, 2.38], [0.06, 2.42], [-0.03, 2.3], [-0.03, 0.12]];
const matchbox: V2[] = [[-1.0, -0.65], [1.0, -0.65], [1.0, 0.65], [-1.0, 0.65]];
const thimble: V2[] = [[0.3, 0.38], [0.3, 0.48], [-0.3, 0.48], [-0.3, 0.38], [-0.25, 0.36], [-0.21, -0.22], ...arc(0, -0.22, 0.21, 0.2, 180, 360, 10), [0.25, 0.36]];
const setsquare: V2[] = [[0, -1.25], [0.12, -1.1], [1.5, 0.92], [1.48, 1.02], [0, 1.02]];
const bowtie: Poly = mirror([[0, -0.14], [0.14, -0.15], [0.82, -0.44], [0.9, -0.2], [0.92, 0], [0.9, 0.2], [0.82, 0.44], [0.14, 0.15], [0, 0.14]]);
const boomerang = stroke([[-0.95, -0.02], [-0.66, -0.2], [-0.32, -0.16], [0, 0.12], [0.32, -0.16], [0.66, -0.2], [0.95, -0.02]], 0.12, 0.12);
const aubergine: Poly[] = [
  [...arc(0.62, 0, 0.62, 0.56, -90, 90, 14), [0.0, 0.5], [-0.7, 0.36], [-1.2, 0.22], [-1.28, 0.1], [-1.28, -0.12], [-1.2, -0.24], [-0.7, -0.4], [0.0, -0.56]],
  [[-1.16, -0.1], [-1.42, -0.32], [-1.36, -0.08], [-1.62, -0.06], [-1.4, 0.06], [-1.5, 0.28], [-1.18, 0.14]],
];
const ginkgo: V2[] = [[-0.07, 0.3], ...arc(0, 0.3, 1.0, 1.0, 212, 262, 10), [-0.03, -0.42], [0, -0.4], [0.03, -0.42], ...arc(0, 0.3, 1.0, 1.0, 278, 328, 10), [0.07, 0.3], [0.05, 0.9], [-0.05, 0.9]];
const tassel: V2[] = (() => {
  const fringe: V2[] = [];
  for (let i = 0; i <= 8; i++) { const x = 0.5 - i * 0.125; fringe.push([x, i % 2 ? 0.86 : 0.74]); }
  return [...arc(0, -0.62, 0.17, 0.17, 120, 420, 12), [0.12, -0.45], [0.18, -0.36], [0.3, -0.05], [0.46, 0.5], ...fringe, [-0.46, 0.5], [-0.3, -0.05], [-0.18, -0.36], [-0.12, -0.45]];
})();
const piecrust: V2[] = [[2.3, 0.42], [-2.25, 0.42], [-2.05, 0.02], ...[0, 1, 2, 3].flatMap((i): V2[] => { const x = -2.05 + i * 1.025; return [...bez([x, 0.02], [x + 0.25, -0.1], [x + 0.5, -0.5], [x + 0.86, -0.46], 7), [x + 0.95, -0.34], [x + 0.8, -0.3], ...bez([x + 0.8, -0.3], [x + 0.72, -0.22], [x + 0.85, -0.02], [x + 1.025, 0.02], 5)]; }), [2.12, 0.08]];
const comb: V2[] = (() => {
  const teeth: V2[] = [];
  for (let i = 0; i < 12; i++) { const x = 1.32 - i * 0.24; teeth.push([x, 0.0], [x - 0.06, 0.52], [x - 0.12, 0.6], [x - 0.18, 0.52], [x - 0.24, 0.0]); }
  return [[-1.4, -0.18], ...arc(-1.2, -0.18, 0.2, 0.2, 180, 270, 4), ...arc(1.2, -0.18, 0.2, 0.2, 270, 360, 4), [1.4, 0], ...teeth.slice(1), [-1.4, 0]];
})();
const chestnut: V2[] = (() => {
  const o: V2[] = [[0.05, 0.95], [-0.05, 0.95], [-0.05, 0.32]];
  const angs = [-165, -128, -90, -52, -15], lens = [0.95, 1.22, 1.38, 1.22, 0.95];
  for (let k = 0; k < 5; k++) {
    const a = angs[k] * DEG, L = lens[k], ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, W = 0.25 * (L / 1.2);
    const notch = (b: number) => [0.15 * Math.cos(b * DEG), 0.3 + 0.15 * Math.sin(b * DEG)] as V2;
    if (k === 0) o.push(notch(angs[0] - 22));
    const left: V2[] = [], right: V2[] = [];
    for (let i = 1; i <= 8; i++) { const s = 0.12 + (0.88 * i) / 8, w = W * Math.pow(Math.sin(Math.PI * Math.min(0.98, s)), 0.75), px = s * L * ux, py = 0.3 + s * L * uy; left.push([px - nx * w, py - ny * w]); right.push([px + nx * w, py + ny * w]); }
    o.push(...left.slice(0, -1), [0.3 * ux + L * ux * 0.7 + (L * 0.3) * ux, 0.3 + L * uy], ...right.slice(0, -1).reverse());
    o.push(notch(k < 4 ? (angs[k] + angs[k + 1]) / 2 : angs[4] + 22));
  }
  o.push([0.05, 0.32]);
  return o;
})();
const teapot: { body: V2[]; hole: V2[] } = (() => {
  const B = (a: number): V2 => [0.72 * Math.cos(a * DEG), 0.1 + 0.55 * Math.sin(a * DEG)];
  const o: V2[] = [];
  o.push(B(-128), [-0.4, -0.52], ...bez([-0.4, -0.52], [-0.3, -0.7], [0.3, -0.7], [0.4, -0.52], 8).slice(0, 3), [-0.06, -0.66], [-0.1, -0.76], ...arc(0, -0.78, 0.1, 0.1, 180, 360, 6), [0.06, -0.66], ...bez([-0.4, -0.52], [-0.3, -0.7], [0.3, -0.7], [0.4, -0.52], 8).slice(5), B(-52));
  o.push(...arc(0, 0.1, 0.72, 0.55, -52, -28, 3).slice(1));
  o.push(...arc(0.78, 0.1, 0.42, 0.42, -125, 125, 14));
  o.push(...arc(0, 0.1, 0.72, 0.55, 34, 66, 4));
  o.push([0.32, 0.66], [0.36, 0.76], [-0.36, 0.76], [-0.32, 0.66]);
  o.push(...arc(0, 0.1, 0.72, 0.55, 114, 160, 5));
  o.push(...bez(B(160), [-1.0, 0.25], [-1.1, -0.05], [-1.32, -0.4], 8), [-1.4, -0.44], [-1.3, -0.5], ...bez([-1.22, -0.46], [-1.0, -0.2], [-0.95, -0.02], B(196), 8));
  o.push(...arc(0, 0.1, 0.72, 0.55, 196, 232, 4).slice(1));
  return { body: o, hole: ring(0.92, 0.1, 0.17, 0.2, 14) };
})();
const fork = ((): V2[] => {
  const o: V2[] = [[0.08, 1.25], ...arc(0, 1.25, 0.08, 0.08, 0, 180, 4).slice(1), [-0.07, 0.1], [-0.1, -0.12], [-0.26, -0.3], [-0.29, -0.5]];
  const tx = [-0.29, -0.14, 0.01, 0.16];
  tx.forEach((x, i) => { o.push([x, -1.2], [x + 0.025, -1.25], [x + 0.11, -1.25], [x + 0.13, -1.2]); if (i < 3) o.push([x + 0.13, -0.6], [x + 0.15, -0.6]); });
  o.push([0.29, -0.5], [0.26, -0.3], [0.1, -0.12], [0.07, 0.1]);
  return o;
})();
const scissors = (() => {
  const blade = (s: number): V2[] => [[-0.05, 0], [0.4, -0.16 * s], [1.0, -0.42 * s], [1.6, -0.62 * s], [1.62, -0.56 * s], [1.0, -0.26 * s], [0.4, -0.02 * s], [0.0, 0.1 * s]];
  const loopO = (s: number) => ring(-0.62, 0.36 * s, 0.34, 0.28, 18), loopI = (s: number) => ring(-0.62, 0.36 * s, 0.19, 0.14, 12);
  const neck = (s: number): V2[] => [[-0.05, -0.05 * s], [0.06, 0.06 * s], [-0.36, 0.3 * s], [-0.42, 0.18 * s]];
  return { polys: [blade(1), blade(-1), loopO(1), loopO(-1), neck(1), neck(-1), ring(0, 0, 0.1, 0.1, 10)], holes: [loopI(1), loopI(-1)] };
})();
const vase = mirror([[0, -1.25], [0.2, -1.25], [0.2, -1.12], [0.14, -1.05], [0.14, -0.8], ...bez([0.14, -0.8], [0.18, -0.55], [0.42, -0.5], [0.44, -0.2], 6), [0.5, 1.0], [0.56, 1.08], [0.56, 1.18], [0, 1.18]]);
const hat = [...mirror([[0, -0.88], [0.04, -0.86], [0.56, 0.72], [0.62, 0.8], [0, 0.8]])];
const fanPaper: V2[] = [[0.06, 0.95], [-0.06, 0.95], [-0.08, 0.6], ...arc(0, 0.6, 1.5, 1.5, 215, 325, 22), [0.08, 0.6]];
const fanRound: { disc: V2[]; stick: V2[] } = { disc: ring(0, -0.45, 0.8, 0.8, 30), stick: [[-0.08, 0.3], [0.08, 0.3], [0.09, 1.3], [-0.09, 1.3]] };
const pinecone = ((): V2[] => {
  const o: V2[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = -90 + (360 * i) / 28, r = i % 2 ? 1 : 0.9;
    const rx = 0.62 * r, ry = 0.95 * r, t = Math.sin(a * DEG);
    o.push([rx * Math.cos(a * DEG) * (1 - 0.25 * t), ry * t]);
  }
  return o.slice(0, -1);
})();
const twig = (() => {
  const main = stroke([[-1.9, 0.15], [-1.0, 0.05], [0, 0.02], [1.0, -0.06], [1.9, -0.22]], 0.2, 0.08);
  const b1 = stroke([[-0.6, 0.06], [-0.35, -0.3], [-0.1, -0.5]], 0.1, 0.05);
  const b2 = stroke([[0.8, -0.05], [1.05, 0.25], [1.25, 0.38]], 0.09, 0.05);
  const leaf = (x: number, y: number, a: number) => { const c = Math.cos(a * DEG), s = Math.sin(a * DEG); return mirror([[0, -0.2], [0.07, -0.1], [0.08, 0.05], [0.04, 0.16], [0, 0.2]]).map(([u, v]) => [x + u * c - v * s, y + u * s + v * c] as V2); };
  return [main, b1, b2, leaf(-0.06, -0.62, 30), leaf(1.36, 0.5, 130), leaf(-1.4, -0.08, -60)];
})();
const star = ((): V2[] => { const o: V2[] = []; for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * DEG, r = i % 2 ? 0.19 : 0.45; o.push([r * Math.cos(a), r * Math.sin(a)]); } return o; })();
const feather = ((): V2[] => {
  const L: V2[] = [], R: V2[] = [];
  for (let i = 0; i <= 14; i++) {
    const s = i / 14, y = -1.0 + 1.75 * s, bend = 0.12 * Math.sin(s * Math.PI);
    const w = 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.6) * (s < 0.9 ? 1 : 0.5);
    L.push([bend - w, y]); R.push([bend + w, y]);
  }
  return [...L, [0.03, 0.75], [0.03, 1.0], [-0.03, 1.0], [-0.03, 0.75], ...R.reverse()];
})();
const leaf = mirror([[0, -0.62], [0.18, -0.5], [0.3, -0.28], [0.34, 0], [0.3, 0.26], [0.18, 0.46], [0.05, 0.6], [0.04, 0.85], [0, 0.85]]).map(([x, y]) => [x * 1.6, y * 1.6] as V2);
const drop = mirror([[0, -0.62], [0.08, -0.42], [0.22, -0.16], [0.3, 0.06], ...arc(0, 0.12, 0.3, 0.32, 0, 90, 6).slice(1)]).map(([x, y]) => [x * 1.3, y * 1.3] as V2);
const plate = ring(0, 0, 1.0, 1.0, 36);
const umbrella = ((): V2[] => {
  const can: V2[] = [...arc(0, 0, 1.3, 0.95, 180, 360, 18)];
  const sc: V2[] = [];
  for (let i = 0; i < 5; i++) { const x1 = 1.3 - i * 0.52; sc.push(...arc(x1 - 0.26, 0.0, 0.26, 0.16, 0, 180, 5).slice(1)); }
  return [[0, -1.1], [0.03, -0.95], ...can.slice(10), ...sc, ...can.slice(0, 9), [-0.03, -0.95]];
})();
const umbrellaHandle = stroke([[0, 0.1], [0, 0.95], ...arc(-0.2, 0.95, 0.2, 0.2, 0, 140, 6)], 0.09);

export const SHAPES = {
  coin: shape('Button', 'a big round button', [ring(0, 0, 0.55, 0.55, 32)], { round: true }),
  bowl: shape('Rice bowl', 'a little rice bowl', [bowl]),
  sandwich: shape('Sandwich', 'half a sandwich, cut corner to corner', [sandwich]),
  matchbox: shape('Matchbox', 'a matchbox', [matchbox]),
  thimble: shape('Thimble', 'a sewing thimble', [thimble]),
  pear: shape('Pear', 'a ripe pear', [pear]),
  bell: shape('Bellflower', 'a nodding bellflower', [bell]),
  cane: shape('Candy cane', 'a striped candy cane', [cane]),
  croissant: shape('Croissant', 'a buttery croissant', [croissant]),
  setsquare: shape('Set square', 'a drawing set square', [setsquare]),
  bowtie: shape('Bow tie', 'a spotty bow tie', [bowtie]),
  boomerang: shape('Boomerang', 'a little boomerang', [boomerang]),
  aubergine: shape('Aubergine', 'a fat aubergine', aubergine),
  ginkgo: shape('Ginkgo leaf', 'a fan-shaped ginkgo leaf', [ginkgo]),
  tassel: shape('Tassel', 'a curtain tassel', [tassel]),
  piecrust: shape('Pie crust', 'a crimped strip of pie crust', [piecrust]),
  comb: shape('Comb', 'a hair comb', [comb]),
  chestnut: shape('Chestnut leaf', 'a hand-shaped chestnut leaf', [chestnut]),
  teapot: shape('Teapot', 'a little teapot', [teapot.body], { holes: [teapot.hole] }),
  fork: shape('Fork', 'a dinner fork', [fork]),
  scissors: shape('Scissors', 'a pair of open scissors', scissors.polys, { holes: scissors.holes }),
  vase: shape('Vase', 'a tall flower vase', [vase]),
  hat: shape('Party hat', 'a pointy party hat', [hat]),
  fan: shape('Gold fan', 'a folding fan of gold paper', [fanPaper], { gel: 'gold' }),
  roundfan: shape('Round fan', 'a round paper fan on a stick: turn it edge-on', [fanRound.disc, fanRound.stick], { turn: true, stiff: [1] }),
  plate: shape('Plate', 'a paper plate: turn it to squash its shadow', [plate], { turn: true, round: true }),
  pinecone: shape('Pine cone', 'a scaly pine cone', [pinecone]),
  twig: shape('Twig', 'a leafy twig', twig),
  star: shape('Star biscuit', 'a star-shaped biscuit', [star]),
  feather: shape('Feather', 'a long feather', [feather]),
  leaf: shape('Jade leaf', 'a leaf of green glass', [leaf], { gel: 'jade' }),
  goldcoin: shape('Gold glass', 'a round disc of gold glass', [ring(0, 0, 0.55, 0.55, 32)], { gel: 'gold', round: true }),
  rubydrop: shape('Ruby drop', 'a drop of ruby glass', [drop], { gel: 'ruby' }),
  skybowtie: shape('Blue bow', 'a bow of sky-blue glass', [bowtie], { gel: 'sky' }),
  umbrella: shape('Umbrella', 'an open umbrella', [umbrella, umbrellaHandle]),
} satisfies Record<string, ShapeDef>;
export type ShapeId = keyof typeof SHAPES;

// ---------------------------------------------------------------- scenes
const P = (shape: ShapeId, start: Pose, sol: Pose | null, more: Partial<PropDef> = {}): PropDef => ({ shape, start, sol, ...more });
/** A pose written in units: x, y, depth notch, rotation (15° steps), flip, turn. */
const at = (x: number, y: number, d = 0, r = 0, f: 0 | 1 = 0, t = 0, on = true): Pose => ({ x: Math.round(x * 8), y: Math.round(y * 8), d, r: ((r % 24) + 24) % 24, f, t, on });
const fixed = (shape: ShapeId, p: Pose): PropDef => ({ shape, start: p, sol: p, fixed: true });
const WARM: LampDef[] = [{ x: 8, y: 4.5, tone: 'warm' }];
const TWO: LampDef[] = [{ x: 6, y: 4.5, tone: 'gold' }, { x: 10, y: 4.5, tone: 'blue' }];
const SKY: [number, number, number, number] = [2.5, 0.4, 13.5, 4.6];
/** One warm lantern that slides, and where it belongs (in quarter units from home). */
const SLIDE = (sol: number, range: [number, number] = [-20, 20]): LampDef[] => [{ x: 8, y: 4.5, tone: 'warm', move: range, sol }];
/** A prop placed so its shadow lands at x, y once the lantern has slid by dx units. */
const via = (dx: number, x: number, y: number, d: number, r = 0, f: 0 | 1 = 0): Pose => at(x + dx * (([1, 1.2, 1.45, 1.75, 2.1, 2.5, 3][d]) - 1), y, d, r, f);
const T1: Tool[] = ['move'], T2: Tool[] = ['move', 'rot'], T3: Tool[] = ['move', 'rot', 'flip'], T4: Tool[] = ['move', 'rot', 'flip', 'depth'];
const T5: Tool[] = ['move', 'rot', 'flip', 'depth', 'lamp'], T6: Tool[] = ['move', 'rot', 'flip', 'depth', 'turn', 'take', 'lamp'];

type Def = Omit<SceneDef, 'id' | 'story' | 'n'>;
const STORY_DEFS: { name: string; blurb: string; scenes: Def[] }[] = [
  {
    name: 'The Cat Who Wanted the Moon', blurb: 'A rooftop cat, a hill and a moon just out of reach. Drag the puppets; turn and flip them.',
    scenes: [
      {
        name: 'Moonrise', tools: T1, par: 1, amb: 'stars',
        line: 'Once upon a time, behind a round green hill, the moon was getting ready to rise.',
        after: 'Up came the moon, round and bright, and the whole sky woke up to watch.',
        tip: { title: 'Drag a shadow', text: 'The moon is hiding behind the hill. Drag its shadow up to the faint shape in the sky.' },
        props: [fixed('bowl', at(8, 7.75, 4, 12)), P('coin', at(10.6, 7.3, 2), at(10.9, 2.5, 2)), P('star', at(3.1, 7.9, 0), at(3.1, 7.9, 0), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 2, zone: SKY, text: 'Hang the star biscuit in the sky.' },
        alive: [{ prop: 1, kind: 'bob', amp: 0.18, per: 3.2 }, { prop: 2, kind: 'pulse', amp: 0.12, per: 1.6 }],
      },
      {
        name: 'A House on the Hill', tools: T2, par: 2, amb: 'stars',
        line: 'On top of the hill stood a little house, and in the little house lived a cat.',
        after: 'Smoke curled from the chimney, and the house was snug and warm.',
        tip: { title: 'Turn a puppet', text: 'Pick a puppet, then use ⟲ ⟳ (or Q and E, or drag its round handle) to turn it. Half a sandwich makes a fine roof.' },
        props: [fixed('bowl', at(6.4, 7.75, 4, 12)), P('matchbox', at(11.4, 7.2, 2), at(6.4, 5.85, 2)), P('sandwich', at(3.8, 2.4, 1), at(6.4, 4.25, 1, 3)), fixed('thimble', at(7.5, 3.75, 1)), fixed('coin', at(11.8, 2.1, 2))],
        lamps: WARM, flourish: { k: 'perfect', min: 0.97, text: 'A perfect fit: 97% or better.' },
        alive: [{ prop: 4, kind: 'pulse', amp: 0.06, per: 2.6 }],
      },
      {
        name: 'The Cat', tools: T2, par: 2, amb: 'stars',
        line: 'The cat was round and soft, with two pointed ears, and she loved to look at the sky.',
        after: '“Mew,” said the cat, and she washed her whiskers.',
        props: [P('pear', at(4.4, 6.0, 3), at(8, 7.05, 3)), P('bell', at(11.4, 3.2, 2), at(8, 4.6, 2, 12)), P('coin', at(12.6, 7.7, 1), at(12.6, 7.7, 1), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 2, zone: SKY, text: 'Hang the moon (the button) where the cat can see it.' },
        alive: [{ prop: 1, kind: 'sway', amp: 6, per: 2.4 }],
      },
      {
        name: 'A Tail to Tell', tools: T3, par: 2, amb: 'stars',
        line: 'Every cat needs a tail, and a fence to sit beside. This one was missing both.',
        after: 'Her tail curled up like a question mark, and she purred.',
        tip: { title: 'Flip a puppet', text: 'The candy cane faces the wrong way. Pick it and press ⇋ (or F) to flip it over, then turn it.' },
        props: [fixed('pear', at(6.2, 7.05, 3)), fixed('bell', at(6.2, 4.6, 2, 12)), P('cane', at(3.6, 2.6, 2), at(8.3, 8.15, 2, 6, 1)), P('comb', at(11.6, 2.4, 2), at(11.4, 8.45, 2, 12))],
        lamps: WARM, flourish: { k: 'perfect', min: 0.97, text: 'A perfect fit: 97% or better.' },
        alive: [{ prop: 2, kind: 'wag', amp: 10, per: 1.3, px: -0.3, py: 0 }, { prop: 1, kind: 'sway', amp: 4, per: 3 }],
      },
      {
        name: 'Up on the Roof', tools: T3, par: 4, amb: 'stars',
        line: 'One night the cat climbed all the way up to the very top of the roof.',
        after: 'Up on the roof she sat, as tall as she could, and looked at the moon.',
        props: [fixed('matchbox', at(8, 7.95, 2)), P('sandwich', at(3.6, 3.6, 2), at(8, 6.15, 2, 3)), P('pear', at(12.2, 7.3, 0), at(8, 3.85, 0)), P('bell', at(3.2, 7.9, 0), at(8, 2.85, 0, 12)), P('cane', at(12.6, 3.2, 0), at(9.0, 4.35, 0, 6, 1)), fixed('coin', at(12.3, 1.9, 1))],
        lamps: WARM, flourish: { k: 'perfect', min: 0.97, text: 'A perfect fit: 97% or better.' },
        alive: [{ prop: 4, kind: 'wag', amp: 12, per: 1.2, px: -0.3, py: 0 }, { prop: 3, kind: 'sway', amp: 5, per: 2.8 }],
      },
      {
        name: 'The Cat Who Wanted the Moon', tools: T3, par: 4, amb: 'stars',
        line: 'The moon was only a sliver that night, and the cat reached up and up to touch it.',
        after: 'She never quite reached it. But the moon smiled down at her all night long, and that was nearly as good.',
        props: [fixed('matchbox', at(6.2, 7.95, 2)), fixed('sandwich', at(6.2, 6.15, 2, 3)), fixed('thimble', at(4.7, 5.3, 1)), P('pear', at(11.6, 7.4, 0), at(7.6, 5.25, 0)), P('bell', at(3.0, 2.4, 0), at(7.8, 4.2, 0, 14)), P('cane', at(10.4, 4.6, 0), at(8.6, 5.75, 0, 6, 1)), P('croissant', at(9.4, 7.6, 2), at(11.4, 2.3, 2, 22)), P('star', at(13.2, 7.9, 0), at(13.2, 7.9, 0), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 7, zone: SKY, text: 'Hang a star beside the moon.' },
        alive: [{ prop: 6, kind: 'bob', amp: 0.12, per: 3 }, { prop: 4, kind: 'sway', amp: 6, per: 2.2 }, { prop: 7, kind: 'pulse', amp: 0.15, per: 1.4 }],
      },
    ],
  },
  {
    name: 'The Little Ship', blurb: 'A ship, a whale and a lighthouse. Slide puppets towards the lantern to make them bigger.',
    scenes: [
      {
        name: 'Near and Far', tools: T4, par: 1, amb: 'waves',
        line: 'Far away across the sea, the sun was going down to bed.',
        after: 'Down it sank into the waves, huge and gold, and the whole sea shone.',
        tip: { title: 'Near the lantern, bigger', text: 'Slide a puppet towards the lantern and its shadow grows (and softens); towards the screen it shrinks and sharpens. Use ＋ and − (or the mouse wheel), or drag its marker in the beam below the screen.' },
        props: [fixed('piecrust', at(4.3, 8.3, 4)), fixed('piecrust', at(11.7, 8.3, 4)), P('coin', at(8.4, 7.2, 0), at(8.4, 7.0, 6)), P('boomerang', at(12.8, 5.9, 0), at(12.8, 5.9, 0), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 3, zone: SKY, text: 'Send a gull (the boomerang) across the sky.' },
        alive: [{ prop: 2, kind: 'bob', amp: 0.15, per: 4 }, { prop: 0, kind: 'drift', amp: 0.25, per: 3 }, { prop: 1, kind: 'drift', amp: 0.25, per: 3, phase: 0.5 }, { prop: 3, kind: 'flap', amp: 0.35, per: 0.9 }],
      },
      {
        name: 'The Little Ship', tools: T4, par: 2, amb: 'waves',
        line: 'A little ship waited in the harbour, but she had no sail.',
        after: 'The wind filled her sail, and away she went over the sea.',
        props: [fixed('piecrust', at(4.3, 8.3, 4)), fixed('piecrust', at(11.7, 8.3, 4)), P('bowl', at(3.9, 3.2, 1), at(8, 6.75, 3)), P('setsquare', at(12.6, 3.0, 1), at(8.95, 4.35, 3)), P('bowtie', at(3.0, 6.0, 0), at(3.0, 6.0, 0), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 4, zone: [7.2, 0.3, 10.2, 2.6], text: 'Fly a flag (the bow tie) from the top of the mast.' },
        alive: [{ prop: 2, kind: 'sway', amp: 4, per: 3 }, { prop: 3, kind: 'sway', amp: 4, per: 3 }, { prop: 0, kind: 'drift', amp: 0.25, per: 3 }, { prop: 1, kind: 'drift', amp: 0.25, per: 3, phase: 0.5 }, { prop: 4, kind: 'wag', amp: 10, per: 0.8 }],
      },
      {
        name: 'Rolling Waves', tools: T4, par: 2, amb: 'waves',
        line: 'Out on the open sea the waves grew bigger, and bigger, and BIGGER.',
        after: 'Up and down, up and down rolled the little ship, and she didn’t mind a bit.',
        props: [fixed('bowl', at(7.2, 5.75, 2)), fixed('setsquare', at(8.0, 3.45, 3)), P('piecrust', at(4.2, 2.4, 1), at(8, 7.95, 6)), P('piecrust', at(11.6, 2.2, 1), at(4.4, 6.85, 2)), P('boomerang', at(12.6, 5.0, 0), at(12.6, 5.0, 0), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 4, zone: SKY, text: 'Send a gull (the boomerang) across the sky.' },
        alive: [{ prop: 0, kind: 'sway', amp: 6, per: 2.6 }, { prop: 1, kind: 'sway', amp: 6, per: 2.6 }, { prop: 2, kind: 'drift', amp: 0.4, per: 2.6 }, { prop: 3, kind: 'drift', amp: 0.3, per: 2.6, phase: 0.5 }, { prop: 4, kind: 'flap', amp: 0.35, per: 0.9 }],
      },
      {
        name: 'The Whale', tools: T4, par: 3, amb: 'waves',
        line: 'Then something enormous came up from the deep to take a breath.',
        after: 'WHOOSH! went the whale, and she waved her tail hello.',
        props: [fixed('piecrust', at(4.3, 8.3, 4)), fixed('piecrust', at(11.7, 8.3, 4)), P('aubergine', at(10.6, 2.4, 1), at(8.7, 6.1, 4)), P('ginkgo', at(3.6, 2.6, 1), at(5.0, 4.95, 3, 21)), P('tassel', at(13.0, 5.4, 1), at(10.4, 4.15, 1, 12))],
        lamps: WARM, flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 3, kind: 'wag', amp: 12, per: 1.8, px: 0.3, py: 0.4 }, { prop: 4, kind: 'pulse', amp: 0.2, per: 0.7 }, { prop: 2, kind: 'bob', amp: 0.12, per: 3.6 }],
      },
      {
        name: 'The Lighthouse', tools: T4, par: 3, amb: 'waves',
        line: 'Night fell. Far off on a rock, somebody climbed the stairs to light a lamp.',
        after: 'Round swept the golden beam, showing every ship the way home.',
        props: [fixed('bowl', at(5.0, 8.05, 3, 12)), fixed('piecrust', at(11.7, 8.05, 4)), P('vase', at(10.6, 4.4, 1), at(5.0, 4.95, 3)), P('hat', at(13.0, 2.0, 0), at(5.0, 2.25, 1)), P('fan', at(2.9, 2.2, 1), at(7.35, 3.1, 3, 6))],
        lamps: WARM, flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 4, kind: 'sway', amp: 10, per: 3, px: -0.9, py: 0 }, { prop: 1, kind: 'drift', amp: 0.3, per: 3 }],
      },
      {
        name: 'Home Through the Storm', tools: T4, par: 3, amb: 'waves',
        line: 'A storm rolled in, but the lighthouse kept on shining, and the whale swam alongside.',
        after: 'Safe home at last, the little ship tied up in the harbour, and everyone on shore cheered.',
        props: [fixed('bowl', at(3.6, 8.05, 3, 12)), fixed('vase', at(3.6, 4.95, 3)), fixed('hat', at(3.6, 2.25, 1)), P('bowl', at(12.6, 2.0, 1), at(9.3, 5.6, 2)), P('setsquare', at(6.4, 2.2, 1), at(9.9, 3.55, 3)), P('piecrust', at(9.0, 3.2, 1), at(9.4, 7.7, 5)), fixed('ginkgo', at(12.6, 6.3, 2, 21)), P('boomerang', at(6.6, 7.6, 0), at(6.6, 7.6, 0), { extra: true })],
        lamps: WARM, flourish: { k: 'extra', prop: 7, zone: SKY, text: 'Send a gull (the boomerang) across the sky.' },
        alive: [{ prop: 3, kind: 'sway', amp: 7, per: 2.4 }, { prop: 4, kind: 'sway', amp: 7, per: 2.4 }, { prop: 5, kind: 'drift', amp: 0.4, per: 2.4 }, { prop: 6, kind: 'wag', amp: 14, per: 1.6, px: 0.3, py: 0.4 }, { prop: 7, kind: 'flap', amp: 0.35, per: 0.9 }],
      },
    ],
  },
  {
    name: 'The Lantern Walk', blurb: 'A night walk with a lantern that moves. The puppets nearest the lantern slide the furthest.',
    scenes: [
      {
        name: 'Peekaboo Moon', tools: T5, par: 1, amb: 'stars',
        line: 'Dora and Enzo went for a walk with a lantern, and the moon played peekaboo behind a tree.',
        after: 'There it is! The moon came out from behind the leaves and lit the path.',
        tip: { title: 'Move the lantern', text: 'Drag the lantern in the beam below the screen (or use [ and ]). Puppets near the lantern slide a long way; puppets near the screen hardly move.' },
        props: [fixed('chestnut', via(-2.5, 7.0, 4.7, 3)), fixed('coin', via(-2.5, 11.3, 2.7, 5)), fixed('bowl', via(-2.5, 7.6, 8.15, 3, 12))],
        lamps: SLIDE(-10), flourish: { k: 'perfect', min: 0.97, text: 'A perfect fit: 97% or better.' },
        alive: [{ prop: 0, kind: 'sway', amp: 5, per: 3, px: 0, py: 0.9 }, { prop: 1, kind: 'pulse', amp: 0.05, per: 3 }],
      },
      {
        name: 'The Owl’s Branch', tools: ['move', 'rot', 'flip', 'lamp'], par: 3, amb: 'stars',
        line: 'Further on, an owl was looking for her favourite branch, the one that points at the moon.',
        after: '“Hoo!” said the owl, settled on her branch with the moon behind her.',
        props: [fixed('twig', via(2, 8.4, 5.6, 3)), fixed('coin', via(2, 11.6, 3.4, 6)), P('pinecone', at(3.4, 6.9, 0), at(9.3, 4.4, 0)), P('bell', at(12.8, 7.4, 0, 12), at(9.3, 3.1, 0, 12))],
        lamps: SLIDE(8), flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 3, kind: 'sway', amp: 10, per: 2.2 }, { prop: 0, kind: 'sway', amp: 2, per: 3.4 }],
      },
      {
        name: 'The Hare in the Moon', tools: T5, par: 4, amb: 'stars',
        line: 'Some people say a hare lives in the moon. Tonight the moon was made of gold glass.',
        after: 'And there she was: the hare in the moon, looking down at the sleeping wood.',
        tip: { title: 'Coloured glass', text: 'Gold glass lets golden light through. A puppet in front of it casts a dark shadow inside the glow.' },
        props: [fixed('goldcoin', via(-3, 10.6, 3.2, 5)), fixed('bowl', via(-3, 4.6, 8.2, 2, 12)), P('pear', at(3.4, 7.2, 0), at(10.5, 3.65, 0, 23)), P('feather', at(12.4, 7.6, 0), at(10.15, 2.3, 0, 23)), P('feather', at(5.6, 7.8, 0), at(10.65, 2.25, 0, 1))],
        lamps: SLIDE(-12), flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 3, kind: 'sway', amp: 8, per: 1.8, px: 0, py: 0.8 }, { prop: 4, kind: 'sway', amp: 8, per: 1.8, px: 0, py: 0.8, phase: 0.3 }, { prop: 0, kind: 'pulse', amp: 0.04, per: 3 }],
      },
      {
        name: 'The Saucepan Stars', tools: T5, par: 1, amb: 'stars',
        line: 'Seven stars were scattered all over the sky. “They make a picture,” said Enzo, “if you look from the right place.”',
        after: 'A saucepan made of stars! The lantern found the one spot where they line up.',
        tip: { title: 'One right spot', text: 'Each star hangs at a different depth, so each slides a different amount. Only one spot for the lantern lines them all up.' },
        props: [fixed('star', via(-5, 9.4, 5.2, 2)), fixed('star', via(-5, 12.0, 5.6, 4)), fixed('star', via(-5, 12.4, 3.4, 3)), fixed('star', via(-5, 9.8, 3.0, 1)), fixed('star', via(-5, 7.6, 2.3, 0)), fixed('star', via(-5, 5.6, 2.2, 2)), fixed('star', via(-5, 3.6, 1.2, 1)), fixed('bowl', via(-5, 8, 8.4, 0, 12))],
        lamps: SLIDE(-20, [-24, 24]), flourish: { k: 'perfect', min: 0.97, text: 'A perfect fit: 97% or better.' },
        alive: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ prop: i, kind: 'pulse' as const, amp: 0.18, per: 1.2 + i * 0.17 })),
      },
      {
        name: 'Lanterns in the Trees', tools: T5, par: 3, amb: 'fireflies',
        line: 'The wood was hung with paper lanterns, but they had drifted every which way.',
        after: 'Three golden lanterns in a row along the branch, and the owl came to see.',
        props: [fixed('twig', via(2.5, 8, 3.6, 2)), fixed('goldcoin', via(2.5, 5.7, 5.1, 2)), fixed('goldcoin', via(2.5, 8.1, 5.0, 1)), fixed('goldcoin', via(2.5, 10.5, 5.2, 3)), P('pinecone', at(3.4, 7.4, 0), at(6.4, 2.45, 0)), P('bell', at(12.6, 7.6, 0, 12), at(6.4, 1.3, 0, 12)), fixed('bowl', via(2.5, 8, 8.5, 0, 12))],
        lamps: SLIDE(10), flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 1, kind: 'sway', amp: 6, per: 2.4, px: 0, py: -0.6 }, { prop: 2, kind: 'sway', amp: 6, per: 2.1, px: 0, py: -0.6 }, { prop: 3, kind: 'sway', amp: 6, per: 2.7, px: 0, py: -0.6 }, { prop: 5, kind: 'sway', amp: 10, per: 2 }],
      },
      {
        name: 'Home by Lantern Light', tools: T5, par: 4, amb: 'fireflies',
        line: 'At the end of the walk was a little house, a gold moon, and a cat waiting on the roof.',
        after: 'The cat on the roof, the moon in the sky: everyone was home, and the lantern was put out.',
        props: [fixed('matchbox', at(6.4, 7.95, 2)), fixed('sandwich', at(6.4, 6.4, 1, 3)), fixed('goldcoin', via(2, 11.2, 2.5, 5)), fixed('star', via(2, 9.0, 1.6, 4)), fixed('star', via(2, 13.0, 4.6, 3)), P('pear', at(11.6, 7.4, 0), at(6.4, 4.15, 0)), P('bell', at(3.0, 2.4, 0, 12), at(6.4, 3.15, 0, 12)), P('cane', at(12.8, 6.0, 0), at(7.4, 4.65, 0, 6, 1))],
        lamps: SLIDE(8), flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 7, kind: 'wag', amp: 12, per: 1.2, px: -0.3, py: 0 }, { prop: 6, kind: 'sway', amp: 5, per: 2.6 }, { prop: 3, kind: 'pulse', amp: 0.15, per: 1.3 }, { prop: 4, kind: 'pulse', amp: 0.15, per: 1.7 }],
      },
    ],
  },
  {
    name: 'The Two Lanterns', blurb: 'A gold lantern and a blue one. Where one shadow falls, the other colour shines; where both fall, it’s dark.',
    scenes: [
      {
        name: 'Gold and Blue', tools: T4, par: 1, amb: 'stars',
        line: 'Enzo lit a second lantern, a blue one, and something wonderful happened to the moon.',
        after: 'Two moons! A gold one and a blue one, side by side.',
        tip: { title: 'Two lanterns, two shadows', text: 'Each lantern casts its own shadow. Against the screen they line up into one dark shape; slide the puppet towards the lanterns and they part: one gold, one blue.' },
        props: [P('coin', at(8, 3.6, 0), at(8, 3.6, 3)), fixed('bowl', at(8, 8.2, 0, 12)), fixed('bowl', at(4.6, 8.4, 0, 12)), fixed('bowl', at(11.4, 8.4, 0, 12))],
        lamps: TWO, flourish: { k: 'perfect', min: 0.97, text: 'A perfect fit: 97% or better.' },
        alive: [{ prop: 0, kind: 'bob', amp: 0.15, per: 3 }],
      },
      {
        name: 'The Night Village', tools: T4, par: 3, amb: 'stars',
        line: 'Under the two moons stood a little village, as dark and quiet as could be.',
        after: 'Not a window lit: the whole village was fast asleep under its gold and blue moons.',
        tip: { title: 'Dark means close', text: 'For a crisp, dark shadow, slide the puppet right up to the screen, so both shadows fall in the same place.' },
        props: [P('matchbox', at(5.2, 4.6, 3), at(6.4, 7.75, 0)), P('sandwich', at(10.8, 6.2, 3, 3), at(6.4, 6.55, 0, 3)), P('coin', at(11.4, 2.8, 0), at(11.4, 2.8, 2)), fixed('matchbox', at(10.4, 8.0, 0)), fixed('hat', at(10.4, 6.75, 0)), fixed('thimble', at(8.6, 8.15, 0))],
        lamps: TWO, flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 2, kind: 'bob', amp: 0.12, per: 3.4 }],
      },
      {
        name: 'The Owl and the Crescent', tools: T4, par: 3, amb: 'stars',
        line: 'The owl came back to watch the moon, which had grown thin as a fingernail.',
        after: 'A gold crescent and a blue one, curled round a dark middle, and the owl hooted at them both.',
        tip: { title: 'Only a little apart', text: 'Just a little way from the screen, the two shadows only partly overlap: the overlap is dark and the edges glow gold and blue.' },
        props: [fixed('twig', at(6.6, 6.4, 0)), P('pinecone', at(12.2, 7.4, 0), at(6.9, 5.0, 0)), P('bell', at(3.6, 7.6, 0, 12), at(6.9, 3.75, 0, 12)), P('coin', at(10.6, 6.0, 4), at(11.0, 2.6, 1))],
        lamps: TWO, flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 2, kind: 'sway', amp: 10, per: 2.2 }, { prop: 3, kind: 'bob', amp: 0.1, per: 3 }],
      },
      {
        name: 'The Rainbow Fish', tools: T4, par: 4, amb: 'waves',
        line: 'Down in the river swam a fish made all of coloured glass.',
        after: 'Green and gold and blue and ruby: the rainbow fish flicked her tail and blew bubbles.',
        props: [P('leaf', at(4.2, 2.6, 0), at(8.2, 4.6, 1, 6)), P('skybowtie', at(12.4, 2.4, 0), at(6.0, 4.6, 1, 6)), P('rubydrop', at(3.6, 7.0, 0), at(7.6, 3.55, 0, 21)), P('coin', at(12.4, 7.0, 0), at(10.4, 3.2, 1)), fixed('comb', at(5.0, 8.4, 1, 12)), fixed('comb', at(11.0, 8.4, 1, 12))],
        lamps: TWO, flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 1, kind: 'wag', amp: 12, per: 0.9, px: 0.6, py: 0 }, { prop: 0, kind: 'drift', amp: 0.15, per: 2 }, { prop: 3, kind: 'bob', amp: 0.3, per: 2.2 }, { prop: 4, kind: 'sway', amp: 4, per: 3, px: 0, py: 0.4 }, { prop: 5, kind: 'sway', amp: 4, per: 3.4, px: 0, py: 0.4 }],
      },
      {
        name: 'The Peacock', tools: T4, par: 3, amb: 'petals',
        line: 'In the palace garden a peacock was about to show off.',
        after: 'Up went the golden tail, fringed with blue and gold, and everyone said “Ooh!”',
        props: [P('fan', at(4.0, 2.6, 0), at(7.6, 4.3, 2)), P('pear', at(12.4, 3.0, 2), at(7.6, 6.75, 0)), P('feather', at(12.6, 7.2, 2), at(7.85, 5.2, 0, 1)), fixed('comb', at(4.2, 8.55, 0, 12)), fixed('comb', at(11.8, 8.55, 0, 12))],
        lamps: TWO, flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 0, kind: 'pulse', amp: 0.06, per: 1.6 }, { prop: 2, kind: 'sway', amp: 6, per: 1.4, px: 0, py: 0.8 }],
      },
      {
        name: 'The Lantern Festival', tools: T4, par: 4, amb: 'embers',
        line: 'Then came the lantern festival, with fireworks over the rooftops.',
        after: 'BANG! Fireworks in gold and blue over the sleeping village. What a night!',
        props: [fixed('matchbox', at(4.6, 8.0, 0)), fixed('sandwich', at(4.6, 6.75, 0, 3)), fixed('matchbox', at(11.4, 8.0, 0)), fixed('hat', at(11.4, 6.75, 0)), P('chestnut', at(8.0, 7.6, 0), at(5.0, 2.7, 2)), P('chestnut', at(12.8, 3.2, 0), at(11.2, 2.5, 1)), P('goldcoin', at(3.0, 2.0, 2), at(8.0, 5.2, 0)), P('star', at(8.4, 4.4, 3), at(8.2, 1.6, 1))],
        lamps: TWO, flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 4, kind: 'pulse', amp: 0.12, per: 1.1 }, { prop: 5, kind: 'pulse', amp: 0.12, per: 1.3, phase: 0.4 }, { prop: 7, kind: 'spin', amp: 30, per: 4 }, { prop: 6, kind: 'sway', amp: 6, per: 2.4, px: 0, py: -0.6 }],
      },
    ],
  },
  {
    name: 'The Dragon of the Wood', blurb: 'Everything together: turn puppets edge-on, take down what doesn’t belong, and wake the dragon.',
    scenes: [
      {
        name: 'Edge On', tools: T6, par: 2, amb: 'stars',
        line: 'At the edge of the dragon’s wood stood a hill with a flagpole, but somebody had borrowed the pole.',
        after: 'Up went the flag, flapping in the night breeze. The adventure could begin.',
        tip: { title: 'Turn it edge-on', text: 'Some puppets can turn on their rods. Pick the round fan and press ◐ (or T) until it is edge-on: its round shadow thins to a pole.' },
        props: [fixed('bowl', at(8, 8.1, 4, 12)), P('roundfan', at(8, 4.0, 3), at(8, 3.95, 3, 0, 0, 6)), P('setsquare', at(12.6, 6.6, 0), at(8.55, 2.25, 0)), fixed('coin', at(11.6, 2.4, 1))],
        lamps: SLIDE(0), flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 2, kind: 'wag', amp: 9, per: 0.9, px: -0.4, py: 0 }],
      },
      {
        name: 'The Swan Pond', tools: ['move', 'rot', 'flip', 'turn'], par: 3, amb: 'stars',
        line: 'In a clearing lay a still, round pond, and on it a swan was gliding.',
        after: 'The swan glided over the moonlit pond without a ripple.',
        tip: { title: 'Squash a shadow', text: 'A plate turned partly edge-on casts an oval. Turn it, then turn it on its side, and you have a pond.' },
        props: [P('plate', at(8, 3.4, 4), at(8, 7.7, 4, 6, 0, 5)), P('pear', at(3.6, 3.0, 1), at(8.3, 6.6, 1, 18)), P('cane', at(12.6, 3.2, 1), at(7.1, 5.6, 1, 0, 1)), fixed('comb', at(4.4, 8.0, 0, 12)), fixed('coin', at(11.8, 2.2, 1))],
        lamps: SLIDE(0), flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 1, kind: 'drift', amp: 0.3, per: 4 }, { prop: 2, kind: 'drift', amp: 0.3, per: 4 }, { prop: 0, kind: 'pulse', amp: 0.03, per: 3 }],
      },
      {
        name: 'Too Many Puppets', tools: T6, par: 3, amb: 'fireflies',
        line: 'The gate to the dragon’s wood was lost among a clutter of things that didn’t belong there.',
        after: 'With the clutter cleared away, the moonlit gate stood open between the two trees.',
        tip: { title: 'Take puppets down', text: 'Not every puppet belongs in the picture. Pick one and press 🪝 (or X) to lift it off its rods. If you change your mind, its name waits by the toolbar to be hung again.' },
        props: [fixed('chestnut', at(4.6, 4.9, 3)), fixed('chestnut', at(11.4, 4.9, 3)), P('croissant', at(12.9, 7.7, 1), at(8, 5.7, 3, 6)), P('teapot', at(8.0, 2.2, 2), null), P('fork', at(11.6, 1.9, 4, 3), null)],
        lamps: SLIDE(0), flourish: { k: 'perfect', min: 0.96, text: 'A perfect fit: 96% or better.' },
        alive: [{ prop: 0, kind: 'sway', amp: 4, per: 3, px: 0, py: 1.2 }, { prop: 1, kind: 'sway', amp: 4, per: 3.4, px: 0, py: 1.2 }],
      },
      {
        name: 'The Dragon’s Egg', tools: T6, par: 3, amb: 'fireflies',
        line: 'And in a nest of twigs, in the very middle of the wood, lay one enormous egg.',
        after: 'Crack… crack… Something inside was waking up!',
        props: [P('plate', at(4.0, 3.0, 1), at(8, 5.3, 4, 0, 0, 3)), P('twig', at(12.2, 2.6, 0), at(8, 7.4, 2, 1)), P('twig', at(4.0, 7.8, 0), at(8, 7.6, 2, 23, 1)), fixed('goldcoin', at(12.0, 2.2, 3))],
        lamps: SLIDE(0), flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 0, kind: 'sway', amp: 4, per: 0.5, px: 0, py: 1.4 }],
      },
      {
        name: 'The Dragon Wakes', tools: T6, par: 3, amb: 'embers',
        line: 'Out of the egg climbed a dragon. It looked rather like a cat. A cat with a wing… and a fiery temper.',
        after: 'ROAR! said the little dragon, flapping her wing, and out came a puff of ruby fire.',
        props: [fixed('pear', at(7.2, 6.6, 2)), fixed('bell', at(7.2, 4.4, 1, 12)), P('chestnut', at(12.0, 6.8, 0), at(5.8, 4.7, 2, 20)), P('rubydrop', at(3.4, 7.4, 0), at(9.35, 4.45, 1, 6)), P('fork', at(10.6, 3.0, 1, 4), null), fixed('bowl', at(8, 8.55, 3, 12))],
        lamps: SLIDE(0), flourish: { k: 'perfect', min: 0.95, text: 'A perfect fit: 95% or better.' },
        alive: [{ prop: 2, kind: 'flap', amp: 0.25, per: 0.8 }, { prop: 3, kind: 'pulse', amp: 0.25, per: 0.5 }, { prop: 1, kind: 'sway', amp: 5, per: 1.6 }],
      },
      {
        name: 'The Dragon and the Moon', tools: T6, par: 7, amb: 'embers',
        line: 'The dragon grew, and grew, until one night it flew right round the golden moon.',
        after: 'Round the moon it flew, wings wide and fire bright, and the whole wood came out to watch. The end.',
        props: [P('piecrust', at(8, 2.4, 0), at(6.9, 5.7, 3)), P('scissors', at(3.6, 6.8, 0), at(11.0, 4.95, 2)), P('cane', at(12.6, 7.4, 0), at(2.9, 5.15, 2, 18, 1)), P('chestnut', at(12.2, 3.0, 0), at(6.4, 3.15, 2, 21)), P('rubydrop', at(4.4, 2.0, 0), at(13.2, 4.95, 1, 6)), P('goldcoin', at(10.4, 7.6, 0), at(10.2, 2.0, 4)), P('teapot', at(6.0, 4.4, 2), null), fixed('bowl', at(8, 8.6, 4, 12))],
        lamps: SLIDE(0), flourish: { k: 'perfect', min: 0.94, text: 'A perfect fit: 94% or better.' },
        alive: [{ prop: 3, kind: 'flap', amp: 0.25, per: 1.1 }, { prop: 1, kind: 'sway', amp: 6, per: 1.3 }, { prop: 4, kind: 'pulse', amp: 0.25, per: 0.5 }, { prop: 2, kind: 'wag', amp: 10, per: 1.6, px: 0.3, py: 0 }, { prop: 0, kind: 'bob', amp: 0.15, per: 2.2 }],
      },
    ],
  },
];

export const SCENES: Record<string, SceneDef> = {};
export const STORIES: StoryDef[] = STORY_DEFS.map((st, si) => {
  const ids = st.scenes.map((d, i) => { const id = `s${si + 1}-${i + 1}`; SCENES[id] = { ...d, id, story: si, n: i }; return id; });
  return { id: si, name: st.name, blurb: st.blurb, scenes: ids };
});
export const SCENE_IDS: string[] = STORIES.flatMap((s) => s.scenes);
