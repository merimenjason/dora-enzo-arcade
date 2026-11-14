// Jade Street: breaking up the grid. Runs once on the built city (lib/jade-city.ts) before the shophouses are dressed:
// it merges blocks of four shophouses into big landmarks (a food hall and an opera house in the Night Market, a bell
// tower on Temple Hill, a clock tower by the canal, a cinema on the Strip), opens others into plazas with fountains,
// banyan trees, koi ponds, bamboo, benches and a statue, sets food-court tables by the stalls, puts a lighthouse on
// the harbour, lays curving painted footpaths through the park and plazas, and plans the festival dressing (arches,
// giant lanterns, the stage and the sky-lantern poles) that appears once the story is won. Every change only opens
// ground or swaps a picture, so every road and place stays reachable (tests/jade.mjs proves it).
import { T, W, H, S, G, districtAt, type City, type District, type Prop } from './jade-city.js';

export type Path = { pts: [number, number][]; w: number; tex: string };
export type FestivalSpot = { x: number; y: number; kind: 'stage' | 'lantern' | 'arch' | 'giant'; sprite: string; rot?: number; w?: number };

const LANDMARKS: [District, string][] = [['market', 'lm2-hall'], ['market', 'lm2-opera'], ['temple', 'lm2-bell'], ['canal', 'lm2-clock'], ['arcade', 'lm2-cinema'], ['docks', 'lm2-hall']];
const PLAZAS: District[] = ['market', 'market', 'temple', 'canal', 'canal', 'arcade', 'arcade', 'docks'];

export function remodel(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const plain = c.buildings.filter(b => !b.sprite && b.w === 3 && b.h === 3);
  const byXY = new Map(plain.map(b => [b.x + ',' + b.y, b]));
  const busy = (x0: number, y0: number, w: number, h: number) => {
    const inn = (px: number, py: number) => px >= (x0 - 1) * T && px < (x0 + w + 1) * T && py >= (y0 - 1) * T && py < (y0 + h + 1) * T;
    return Object.values(c.places).some(p => inn(p.x, p.y)) || c.murals.some(m => inn(m.x, m.y)) || c.cats.some(m => inn(m.x, m.y)) || c.hides.some(m => inn(m.x, m.y))
      || c.ladders.some(l => inn(l.x * T, l.y * T)) || c.parking.some(p => inn(p.x, p.y));
  };
  // groups of four plain shophouses forming a 6×6 square, spread out
  const groups: { x: number; y: number; d: District; parts: City['buildings'] }[] = [];
  for (const b of plain) {
    const parts = [b, byXY.get(b.x + 3 + ',' + b.y), byXY.get(b.x + ',' + (b.y + 3)), byXY.get(b.x + 3 + ',' + (b.y + 3))];
    if (parts.some(p => !p) || busy(b.x, b.y, 6, 6)) continue;
    if (groups.some(g => Math.abs(g.x - b.x) < 12 && Math.abs(g.y - b.y) < 12)) continue;
    groups.push({ x: b.x, y: b.y, d: districtAt(b.x + 3, b.y + 3), parts: parts as City['buildings'] });
  }
  const used: { x: number; y: number }[] = [];
  // a 6×6 group where the district has one, else a single 3×3 shophouse block (a smaller landmark or pocket plaza)
  const take = (d: District) => {
    const i = groups.findIndex(g => g.d === d);
    if (i >= 0) { const g = groups.splice(i, 1)[0]; used.push(g); return { ...g, n: 6 }; }
    const b = plain.find(b => c.buildings.includes(b) && districtAt(b.x + 1, b.y + 1) === d && !busy(b.x, b.y, 3, 3) && !groups.some(g => b.x >= g.x - 3 && b.x < g.x + 9 && b.y >= g.y - 3 && b.y < g.y + 9) && !used.some(u => Math.abs(u.x - b.x) < 9 && Math.abs(u.y - b.y) < 9));
    if (!b) return null; used.push(b); return { x: b.x, y: b.y, d, parts: [b], n: 3 };
  };
  const drop = (parts: City['buildings']) => { for (const p of parts) c.buildings.splice(c.buildings.indexOf(p), 1); };
  for (const [d, sprite] of LANDMARKS) {
    const g = take(d); if (!g) continue;
    drop(g.parts); c.buildings.push({ x: g.x, y: g.y, w: g.n, h: g.n, sprite, front: true });
  }
  const tables: Prop[] = [];
  const prop = (x: number, y: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number) => {
    // the grid knows about it too, so paths, sight lines and the townsfolk go around (bumping one at speed spills it)
    c.solid[at(Math.floor(x / T), Math.floor(y / T))] = solid === 'low' ? S.LOW : solid === 'tall' ? S.TALL : c.solid[at(Math.floor(x / T), Math.floor(y / T))];
    const p: Prop = { x, y, sprite, r, solid, layer, w }; c.props.push(p); return p;
  };
  const PG: Record<District, number> = { market: G.PLAZA, temple: G.TEMPLE, canal: G.COBBLE, docks: G.DOCK, arcade: G.NEON };
  let k = 0;
  for (const d of PLAZAS) {
    const g = take(d); if (!g) continue;
    drop(g.parts);
    for (let y = g.y; y < g.y + g.n; y++) for (let x = g.x; x < g.x + g.n; x++) { const i = at(x, y); c.ground[i] = PG[d]; c.solid[i] = S.OPEN; c.flags[i] = 0; }
    const cx = (g.x + g.n / 2) * T, cy = (g.y + g.n / 2) * T;
    const style = k++ % 4;
    if (g.n === 3) { // a pocket plaza: one centrepiece and a bench
      prop(cx, cy, ['fountain', 'banyan', 'koi-pond', 'crane-statue'][style], [40, 34, 44, 18][style], 'tall');
      prop(cx - T, cy + T, 'plaza-bench', 0, 'low', 'ground'); continue;
    }
    if (style === 0) { prop(cx, cy, 'fountain', 40, 'tall'); for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) prop(cx + dx * T, cy + dy * T, 'plaza-bench', 0, 'low', 'ground'); }
    else if (style === 1) { prop(cx, cy, 'banyan', 34, 'tall'); prop(cx - 2 * T, cy + 2 * T, 'plaza-bench', 0, 'low', 'ground'); prop(cx + 2 * T, cy - 2 * T, 'bamboo', 22, 'tall'); }
    else if (style === 2) { prop(cx, cy, 'koi-pond', 44, 'tall'); prop(cx - 2 * T, cy - 2 * T, 'bamboo', 22, 'tall'); prop(cx + 2 * T, cy + 2 * T, 'crane-statue', 18, 'tall'); }
    else { prop(cx, cy, 'crane-statue', 18, 'tall'); for (const [dx, dy] of [[-2, 0], [2, 0]]) tables.push(prop(cx + dx * T + T / 2, cy + dy * T + T / 2, 'table', 18, 'tall')); prop(cx, cy - 2 * T, 'banyan', 34, 'tall'); }
    c.paths.push({ pts: [[g.x * T + 10, cy + 20], [cx - T, cy + T * 1.2], [cx + T, cy - T * 1.2], [(g.x + g.n) * T - 10, cy - 20]], w: 54, tex: d === 'temple' ? 'path' : 'cobble' });
  }
  // food-court tables beside the market stalls
  for (const pl of Object.values(c.places)) if (pl.kind === 'market' || pl.name === 'Chef Mo') {
    const ptx = Math.floor(pl.x / T), pty = Math.floor(pl.y / T); let n = 0;
    for (let r = 2; r < 6 && n < 2; r++) for (let dy = -r; dy <= r && n < 2; dy++) for (let dx = -r; dx <= r && n < 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ptx + dx, y = pty + dy;
      if (x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
      const ok = [-1, 0, 1].every(o => c.solid[at(x + o, y)] === S.OPEN && c.ground[at(x + o, y)] !== G.ROAD && c.ground[at(x + o, y)] !== G.BRIDGE)
        && c.solid[at(x, y - 1)] === S.OPEN && c.solid[at(x, y + 1)] === S.OPEN
        && !Object.values(c.places).some(q => Math.abs(q.x / T - 0.5 - x) < 2 && Math.abs(q.y / T - 0.5 - y) < 2)
        && !c.props.some(p => Math.abs(p.x / T - 0.5 - x) < 2 && Math.abs(p.y / T - 0.5 - y) < 2)
        && !c.parking.some(p => Math.abs(p.x / T - 0.5 - x) < 2 && Math.abs(p.y / T - 0.5 - y) < 2);
      if (!ok) continue;
      tables.push(prop(x * T + T / 2, y * T + T / 2, 'table', 18, 'tall')); n++;
    }
  }
  c.tables = tables;
  // the lighthouse on the harbour breakwater
  for (let y = 84; y < 87; y++) for (let x = 114; x < 117; x++) { const i = at(x, y); c.ground[i] = G.BLD; c.solid[i] = S.BUILDING; c.flags[i] = 0; }
  c.buildings.push({ x: 114, y: 84, w: 3, h: 3, sprite: 'lm2-lighthouse', front: true });
  // curving footpaths through the temple park
  c.paths.push({ pts: [[2 * T, 10 * T], [6 * T, 8.5 * T], [12 * T, 9.2 * T], [16 * T, 7.6 * T]], w: 60, tex: 'path' });
  c.paths.push({ pts: [[23 * T, 8 * T], [26 * T, 5 * T], [29 * T, 6.2 * T], [33 * T, 6 * T], [38 * T, 8 * T], [41 * T, 9.6 * T]], w: 56, tex: 'path' });
  // the festival, shown once the story is won
  const f = c.festival;
  for (const r of c.roads) if (r.axis === 'h') for (let s = r.from + 9; s <= r.to - 9; s += 18) if (s < 63 || s > 71) f.push({ x: s * T + T / 2, y: (r.at + 2) * T, kind: 'arch', sprite: 'fest-arch', rot: 0, w: 4.2 * T });
  const mk = c.places['mk-market'];
  f.push({ x: mk.x, y: mk.y + 3.2 * T, kind: 'stage', sprite: 'fest-stage', w: 150 });
  for (const id of ['mk-market', 'mk-temple', 'mk-canal', 'mk-docks', 'mk-arcade', 'safe-market', 'kee', 'heron', 'kiri', 'gizmo']) {
    const pl = c.places[id]; if (!pl) continue;
    const tx = Math.floor(pl.x / T), ty = Math.floor(pl.y / T);
    for (const [dx, dy] of [[2, 1], [-2, 1], [2, -1], [-2, -1], [3, 0], [-3, 0]]) {
      const x = tx + dx, y = ty + dy; if (c.solid[at(x, y)] !== S.OPEN || c.ground[at(x, y)] === G.ROAD || f.some(q => Math.abs(q.x - (x * T + T / 2)) < 2 * T && Math.abs(q.y - (y * T + T / 2)) < 2 * T)) continue;
      f.push({ x: x * T + T / 2, y: y * T + T / 2, kind: 'lantern', sprite: 'fest-pole' }); break;
    }
  }
  for (const [id, sp] of [['pagoda', 'fest-rabbit'], ['jetty', 'fest-carp'], ['ferry', 'fest-float']] as const) { const pl = c.places[id]; if (pl) f.push({ x: pl.x + T * 1.6, y: pl.y + T * 0.5, kind: 'giant', sprite: sp }); }
  void H;
}
