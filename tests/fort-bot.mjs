// Pillow Fort bots. A search bot plays every night: for each piece it tries drop spots and turns on a copy of the
// world, lets each one settle (hazards included), scores the fort it leaves (height, den, pillars for the roof
// still to come, nothing lost, nothing wobbling) and plays the best; after every piece it tries bedtime on a copy
// and goes to bed as soon as that would earn the most stars it can. It proves every night can be passed, that the
// second star (den or high line) is reachable, and that the third-star par is set from its real play (par is at
// least what the bot used). A naive bot that drops everything in the middle, unturned, must fail the later nights.
// `--quick` plays the first night of each room only; `--night <id>` plays one; `--verbose` prints every move.
import assert from 'node:assert/strict';
import { FortGame, NIGHTS, PIECES, RUG, pieceExtent } from '../.checks/fort-game.js';

const args = process.argv.slice(2);
const AHEAD = Number(process.env.AHEAD ?? 0);
const PILLAR = 1.55;
const quick = args.includes('--quick'), verbose = args.includes('--verbose');
const only = args.includes('--night') ? args[args.indexOf('--night') + 1] : null;

const settle = (g, max = 160) => { for (let i = 0; i < max; i++) { g.step(); if (i > 25 && g.world.motion() < 0.06 && g.pieces.every((p) => p.landed)) break; } };
/** Height of the fort straight up from the floor at x (the top surface), ignoring pieces in the air. */
const colTop = (g, x) => g.colTop(x);

function rotations(kind) {
  const st = PIECES[kind].step; if (!st) return [0];
  const n = Math.round(Math.PI / st), out = [];
  for (let i = 0; i < (kind === 'duck' || kind === 'teacup' || kind === 'teapot' || kind === 'stool' ? 2 * n : n); i++) out.push(i);
  return out;
}

/** How much of the fort a nudge knocks off: shakes a copy like a small thunder and lets it settle. */
function fragility(g) {
  const c = g.clone(), h0 = c.top(), l0 = c.lostCount;
  for (let i = 0; i < 40; i++) { c.world.shake = (g.night?.thunder ? 4 : 2) * Math.sin(i * 0.52) * Math.sin((i / 40) * Math.PI); c.step(); }
  settle(c, 60);
  return Math.max(0, h0 - c.top()) + (c.lostCount - l0) * 2;
}

/** The highest flat place a piece could still go: the best 1.0-wide stretch of the fort's top. */
function platform(g) {
  const t = []; for (let x = -RUG; x <= RUG; x += 0.1) t.push(colTop(g, x));
  let best = 0; for (let i = 0; i + 10 <= t.length; i++) { let m = Infinity; for (let k = i; k < i + 10; k++) m = Math.min(m, t[k]); if (m > best) best = m; }
  return best;
}

function pillars(g) {
  const t = []; for (let x = -RUG; x <= RUG; x += 0.2) t.push(g.colTop(x));
  let best = 0;
  for (let i = 0; i < t.length; i++) for (let j = i + 11; j <= i + 18 && j < t.length; j++) {
    if (Math.abs(-RUG + (i + j) * 0.1) > 1.6) continue;
    let mid = 0; for (let k = i + 3; k <= j - 3; k++) mid = Math.max(mid, t[k]);
    const v = Math.min(t[i], t[j], 1.8) - 1.5 * mid - 0.8 * Math.abs(Math.min(t[i], 2.4) - Math.min(t[j], 2.4)); if (v > best) best = v;
  }
  return best;
}

/** Building a pillar for the blanket: a flat top about 1.6 to 2.2 up, the same height as the other pillar. */
function pillarScore(g, near, base) {
  let flat = Infinity; for (let d = -0.35; d <= 0.351; d += 0.07) flat = Math.min(flat, g.colTop(near + d));
  const other = g.colTop(-near), h = Math.min(flat, 2.2);
  return h * 4 - Math.max(0, flat - 2.3) * 3 - (other > 1 ? Math.abs(flat - other) * 1.5 : 0) - (g.lostCount - base.lost) * 50 - g.world.motion() * 2 - Math.max(colMid(g), 0) * 3;
}
const colMid = (g) => Math.max(g.colTop(-0.3), g.colTop(0), g.colTop(0.3));

function score(g, night, base) {
  const h = g.top(), den = g.den().area, lost = g.lostCount - base.lost;
  let s = -lost * 50 - g.world.motion() * 2;
  const cap = night.high + 0.3;
  s += Math.min(h, cap) * 1 + Math.min(platform(g), cap) * 4;
  if (night.den !== undefined) {
    s += Math.min(den, night.den + 1.5) * 5;
    const roofLeft = g.held?.kind === 'blanket' || g.queue.includes('blanket');
    if (roofLeft) {
      // pillars for a blanket still to come: two tops of about the same height, 2.2 to 3.6 apart, nothing tall between
      s += pillars(g) * 6;
    }
  }
  return s;
}

/** Tries bedtime on a copy: the stars it would get. */
function tryBed(g) { const c = g.clone(); c.bedtime(); for (let i = 0; i < 330 && !c.result; i++) c.step(); return c.result; }

/** Every drop spot and turn for a piece, each played out on a copy and scored. */
function tries(g, kind, step, night, base, near = null, centre = null) {
  const out = [];
  for (const r of rotations(kind)) {
    const ext = pieceExtent(kind, r * PIECES[kind].step), lim = RUG - Math.min(ext.w, RUG * 0.8) + 0.4;
    const xs = [];
    if (near !== null) for (const d of [-0.3, -0.15, 0, 0.15, 0.3]) xs.push(near + d);
    else if (centre !== null) for (const d of [-0.6, -0.3, -0.15, 0, 0.15, 0.3, 0.6]) xs.push(Math.max(-lim, Math.min(lim, centre + d)));
    else for (let x = -lim; x <= lim + 1e-9; x += step) xs.push(x);
    for (const x of xs) {
      const c = g.clone();
      for (let k = 0; k < r; k++) c.rotate(1);
      c.aim(x);
      while (!c.canDrop()) c.step();
      c.drop(); settle(c);
      out.push({ s: near !== null ? pillarScore(c, near, base) : score(c, night, base), r, x, c });
    }
  }
  // the few best are shaken a little: a spot that a nudge would topple is worth less
  out.sort((p, q) => q.s - p.s);
  const top = out.slice(0, 8);
  for (const t of top) t.s -= fragility(t.c) * 5;
  return top.sort((p, q) => q.s - p.s);
}
/** Where the tallest part of the fort is, for the plan that keeps building one tower. */
function towerX(g) { let bx = 0, bt = -1; for (let x = -RUG + 0.5; x <= RUG - 0.5; x += 0.25) { const t = g.colTop(x); if (t > bt + 0.05 || (Math.abs(t - bt) <= 0.05 && Math.abs(x) < Math.abs(bx))) { bt = Math.max(bt, t); bx = x; } } return bt < 0.1 ? 0 : bx; }

export function playSearch(id, opts = {}) {
  const night = NIGHTS.find((n) => n.id === id), g = new FortGame(id), step = opts.step ?? 0.3;
  const maxStars = 3;
  let best = null;
  while (g.phase === 'build') {
    if (!g.held) break;
    const kind = g.held.kind, base = { lost: g.lostCount };
    // den nights: build two pillars either side of the middle first, then roof them with the blanket
    let near = null;
    if (night.den !== undefined && kind !== 'blanket' && g.queue.includes('blanket')) {
      const L = g.colTop(-PILLAR), R = g.colTop(PILLAR);
      if (Math.min(L, R) < 1.6) near = L <= R ? -PILLAR : PILLAR;
    }
    const centre = opts.plan === 'centre' && night.den === undefined ? towerX(g) : null;
    const first = tries(g, kind, step, night, base, near, centre).sort((p, q) => q.s - p.s);
    let top = first[0];
    // look one piece ahead from the few best spots: a pillar is worth more once something can sit across it
    const nextKind = g.queue[0];
    if (nextKind && (opts.ahead ?? AHEAD) > 0) {
      for (const cand of first.slice(0, opts.ahead ?? AHEAD)) {
        const after = tries(cand.c, nextKind, step * 2, night, base).reduce((m, t) => Math.max(m, t.s), -Infinity);
        cand.s2 = Math.max(cand.s, after);
      }
      top = first.slice(0, opts.ahead ?? AHEAD).reduce((m, t) => (t.s2 > m.s2 ? t : m));
    }
    for (let k = 0; k < top.r; k++) g.rotate(1);
    g.aim(top.x);
    while (!g.canDrop()) g.step();
    g.drop(); settle(g);
    if (verbose) console.log(`  ${id} #${g.used} ${kind} r${top.r} x${top.x.toFixed(2)} → top ${g.top().toFixed(2)} den ${g.den().area.toFixed(2)} lost ${g.lostCount}`);
    const r = tryBed(g);
    if (r && r.stars > 0 && (!best || r.stars > best.stars)) best = { ...r };
    const can2 = r && r.goals[0] && r.goals[1];
    if (can2 || (r && r.stars >= maxStars)) break;
  }
  if (g.phase === 'build') g.bedtime();
  for (let i = 0; i < 400 && !g.result; i++) g.step();
  return { id, result: g.result, log: g.log, ticks: g.tick };
}

export function playNaive(id) {
  const g = new FortGame(id);
  while (g.phase === 'build' && g.held) { g.aim(0); while (!g.canDrop()) g.step(); g.drop(); settle(g, 90); }
  if (g.phase === 'build') g.bedtime();
  for (let i = 0; i < 600 && !g.result; i++) g.step();
  return g.result;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const list = only ? NIGHTS.filter((n) => n.id === only) : quick ? NIGHTS.filter((n, i) => i % 6 === 0) : NIGHTS;
  const t0 = Date.now(), rows = [];
  for (const n of list) {
    // two plans, each a full search: spread out over the rug, or keep building on the tallest tower; the better counts
    const plans = ['spread', 'centre'].map((plan) => playSearch(n.id, { step: quick ? 0.5 : 0.35, plan }));
    const better = (a, b) => (b.result.stars > a.result.stars || (b.result.stars === a.result.stars && b.result.used < a.result.used) ? b : a);
    const r = plans.reduce(better);
    const nv = playNaive(n.id);
    rows.push({ id: n.id, ...r.result, naive: nv?.stars ?? 0 });
    console.log(`${n.id.padEnd(3)} ${n.name.padEnd(24)} stars ${r.result.stars} [${r.result.goals.map((x) => (x ? 'y' : '-')).join('')}] used ${r.result.used}/${n.par} height ${r.result.height.toFixed(2)}/${n.line}${n.high ? '|' + n.high : ''} den ${r.result.den.toFixed(2)}${n.den !== undefined ? '/' + n.den : ''}  naive ${nv?.stars ?? 0} (${nv?.height.toFixed(2)})`);
  }
  for (const r of rows) {
    const n = NIGHTS.find((x) => x.id === r.id);
    assert.ok(r.stars >= 1, `${r.id}: the search bot passes`);
    assert.ok(r.goals[1], `${r.id}: the second star is reachable`);
    assert.ok(r.used <= n.par, `${r.id}: par ${n.par} is at least what the bot used (${r.used})`);
  }
  if (!quick && !only) {
    const late = rows.filter((r) => NIGHTS.findIndex((n) => n.id === r.id) >= 6);
    const fails = late.filter((r) => r.naive === 0).length;
    assert.ok(fails >= late.length * 0.75, `the naive bot fails most later nights (${fails}/${late.length})`);
  }
  console.log(`fort bots: ${rows.length} nights, ok in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
