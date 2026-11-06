// Out of Frame bots. The looker plays by looking ahead: every so often it tries a handful of frame positions round
// Dora (and a jump or not) on copies of the run, five seconds ahead, and keeps the best. It has to clear every segment on
// its own and win some runs (with --quick, four runs, get well into them). The careless player keeps the frame centred
// on Dora and never jumps, and has to do much worse. Run after `npm test` has compiled the engine into .checks/ (or
// `npm run bot:frame`).
import assert from 'node:assert/strict';
import * as G from '../.checks/frame-game.js';

const quick = process.argv.includes('--quick');
const face = (r) => ({ x: r.dora.x, y: r.dora.y - G.DORA.face });
const OFFS = [[52, -10], [52, -44], [52, 30], [10, -44], [10, 34], [-40, 0], [-40, -44], [-40, 34], [100, -10], [10, -10]];
// Dora frozen at the end of a look-ahead is a stalled run, and frozen in mid-air a doomed one
const progress = (r) => (r.phase === 'won' ? 1e6 : r.phase === 'lost' ? -1e6 : 0) + (r.phase === 'pick' ? 1 : 0) * 5000 + r.screen * 5000 + r.dora.x + r.dora.hp * 900
  + (r.dora.ground ? 4 : 0) - (r.dora.y > 200 ? 3 * (r.dora.y - 200) : 0) - (r.phase === 'play' && !r.dora.live ? (r.dora.ground ? 0 : 1e5) : 0);
/** what the bot does by default: follow Dora; jump gaps it can cross and walls it can climb; and at a gap it can't
 * cross, keep Dora a step back from the edge and watch what's ahead until a way across turns up */
export function reflex(c) {
  const f = face(c);
  if (near(c) && !crossable(c)) { const w = watch(c); if (w) return { ...w, jump: false }; }
  return { tx: f.x + 52, ty: f.y - 10, jump: (edge(c) && crossable(c)) || climb(c) };
}
/** the highest top Dora could land on at x, from a foothold at height y: up to two tiles up or nearly four down, and
 * not the floor under spikes or water */
function topAt(c, x, y) {
  let t = null;
  for (const b of c.solids(x - 1, y - 34, x + 1, y + 60)) {
    // a hazard frozen only because the frame is elsewhere won't hold her once the frame comes back
    const e = b.id >= 0 ? c.ents.find((o) => o.id === b.id) : null;
    if (e && G.isHazard(e.k) && e.s !== 'stuck' && e.s !== 'rest') continue;
    if (b.y >= y - 34 && (t === null || b.y < t) && !c.deadly(x - 1, b.y - 10, 2, 10)) t = b.y;
  }
  return t;
}
/** a step or two from the end of the rock she's on (a half-built bridge doesn't count) */
const near = (c) => c.dora.ground && c.dora.on < 0 && !c.solidTiles(c.dora.x + 15, c.dora.y, c.dora.x + 17, c.dora.y + 3, true).length;
/** at the edge, and moving */
export const edge = (c) => c.dora.live && c.dora.ground && (!c.solids(c.dora.x + 1, c.dora.y, c.dora.x + 3, c.dora.y + 3).length || (c.riding() && !c.solids(c.dora.x + 4, c.dora.y - 16, c.dora.x + 8, c.dora.y + 1).length));
/** footholds no more than two tiles apart all the way across whatever is ahead */
export function crossable(c) {
  const d = c.dora; let last = d.x, y = d.y;
  // a jump that lands lower goes further
  for (let x = d.x + 4; x <= Math.min(d.x + 150, G.W); x += 4) {
    const t = topAt(c, x, y);
    if (t !== null) { if (x - last > 34 + Math.max(0, t - y) * 0.3) return false; last = x; y = t; }
    else if (x - last > 34 + 60 * 0.3) return false;
  }
  return true;
}
/** a wall in the way, with something to stand on within a jump: a peg, a lift, the top of the wall */
function climb(c) {
  const d = c.dora;
  if (!d.live || !d.ground || !c.blocked(d.x + 5, d.y - 15, d.x + 8, d.y - 1)) return false;
  const fixed = (b) => b.id < 0 || ['arrow', 'boulder', 'grumble', 'frog', 'bat', 'rock'].includes(c.ents.find((o) => o.id === b.id)?.k);
  return c.solids(d.x - 8, d.y - 48, d.x + 20, d.y - 18).some((b) => fixed(b) && b.y >= d.y - 48 && b.y <= d.y - 18 && !c.blocked(d.x - 5, b.y - 15, d.x + 5, b.y - 0.5));
}
const HORIZON = 300;
/** a plan, then the reflex until the horizon: every plan is judged at the same moment in the future */
export function simulate(r, plan) {
  const c = r.clone();
  let i = 0;
  for (; i < HORIZON && c.phase === 'play'; i++) {
    const f = face(c);
    if (plan.reflex || i >= plan.hold) c.tick(reflex(c));
    else if (i < plan.hold) c.tick({ tx: f.x + plan.ox, ty: f.y + plan.oy, jump: (plan.jump && i < 6) || (edge(c) && crossable(c)) || climb(c) });
    else c.tick(reflex(c));
    // a plan that leaves Dora hanging frozen in mid-air is a plan for a stuck run
    if (!c.dora.live && !c.dora.ground && c.phase === 'play') return -1e5;
  }
  // sooner is better: a plan that clears the screen early gets the time it saves
  return progress(c) + (c.phase === 'pick' || c.phase === 'won' ? (HORIZON - i) * 3 : 0);
}
/** freeze Dora and watch the nearest machine or hazard ahead, as a player would while a bridge builds or a boulder rolls */
function watch(r) {
  const f = face(r), fr = r.frame;
  const ahead = (e) => e.x + e.w / 2 > f.x - 8 && e.x - f.x < 300;
  const src = r.ents.filter((e) => ['trap', 'chute', 'lift', 'plat'].includes(e.k) && ahead(e)).sort((a, b) => a.x - b.x)[0]
    ?? r.ents.filter((e) => (e.k === 'grumble' || e.k === 'frog' || e.k === 'bat' || e.k === 'boulder') && ahead(e)).sort((a, b) => a.x - b.x)[0];
  if (!src) return null;
  // the frame starts just past Dora's face and takes in the machine and the gap between
  return { tx: f.x + 8 + fr.w / 2, ty: (src.y + src.h / 2 + r.dora.y) / 2 };
}
export const PLANS = [
  ...OFFS.flatMap(([ox, oy]) => [{ ox, oy, jump: false, hold: 30 }, { ox, oy, jump: false, hold: 75 }, { ox, oy, jump: true, hold: 30 }]),
  { reflex: true, ox: 0, oy: 0, jump: false, hold: 30 },
];
export function looker(r, mem) {
  const f = face(r);
  // no headway for three seconds means the bot is stuck in a loop or putting things off: try other plans at random
  // until Dora has gone another two tiles
  if (r.dora.x > (mem.bestX ?? -1) + 4 || r.screen !== mem.screen) { mem.bestX = r.dora.x; mem.since = 0; mem.screen = r.screen; mem.press = 0; }
  else if (++mem.since > 180) { mem.press = r.dora.x + 32; mem.since = 0; mem.left = 0; }
  if (mem.press && r.dora.x >= mem.press) mem.press = 0;
  if (mem.left > 0 && mem.plan) {
    mem.left--; mem.i++; const p = mem.plan;
    if (p.reflex) return reflex(r);
    return { tx: f.x + p.ox, ty: f.y + p.oy, jump: (p.jump && mem.i < 6) || (edge(r) && crossable(r)) || climb(r) };
  }
  let best = null, bestScore = -Infinity;
  if (mem.press) { mem.seed = ((mem.seed ?? 7) * 1103515245 + 12345) >>> 0; best = PLANS[mem.seed % PLANS.length]; bestScore = 0; }
  else for (const plan of PLANS) {
    const same = mem.plan && mem.plan.ox === plan.ox && mem.plan.oy === plan.oy && !plan.jump && !plan.reflex;
    const s = simulate(r, plan) + (same ? 3 : 0);
    if (s > bestScore) { bestScore = s; best = plan; }
  }
  // carry the plan out as it was simulated, then choose again
  mem.plan = best; mem.i = 0; mem.left = best.hold - 1;
  if (best.reflex) return reflex(r);
  return { tx: f.x + best.ox, ty: f.y + best.oy, jump: best.jump || (edge(r) && crossable(r)) || climb(r) };
}
export function careless(r) { const f = face(r); return { tx: f.x, ty: f.y, jump: false }; }
const PICKS = ['wide', 'reel', 'heart', 'tall', 'pan', 'slow', 'spring', 'nutty'];
export function play(seed, bot, limit = 60 * 60 * 8) {
  const r = new G.Run(seed), mem = {};
  for (let t = 0; t < limit && !r.over; t++) {
    if (r.phase === 'pick') { r.pick(PICKS.find((p) => r.offer.includes(p))); mem.plan = null; mem.left = 0; continue; }
    r.tick(bot(r, mem));
  }
  return r;
}
/** one segment on its own, after the start: can the looker get Dora across without running out of hearts? */
export function segmentRun(id, seed, trace) {
  const r = new G.Run(seed); r.plan = [['start', id]]; r.enter(0); r.film = 999;
  const mem = {};
  for (let t = 0; t < 60 * 90 && r.phase === 'play'; t++) {
    r.tick(looker(r, mem));
    if (trace && (t % 30 === 0 || r.events.some((e) => e.k !== 'arrow'))) { const d = r.dora; trace(`${t} dora ${d.x.toFixed(0)},${d.y.toFixed(0)} ${d.live ? 'live' : 'frozen'} hp ${d.hp} frame ${r.frame.x.toFixed(0)},${r.frame.y.toFixed(0)} ${JSON.stringify(mem.plan)} ${r.events.map((e) => e.k).join(',')}`); }
  }
  return r;
}
if (process.argv[1]?.endsWith('frame-bot.mjs')) {

const t0 = Date.now();
const stuck = [];
for (const g of G.SEGMENTS) {
  if (g.id === 'start') continue;
  const r = segmentRun(g.id, 11);
  const ok = r.phase === 'won' || r.phase === 'pick';
  console.log(`segment ${g.id.padEnd(9)} ${ok ? 'cleared' : 'FAILED '} in ${r.stats.time.toFixed(1)}s, ${r.stats.hits} hits, ${r.stats.falls} falls`);
  if (!ok) stuck.push(g.id);
}
assert.deepEqual(stuck, [], 'the looker clears every segment on its own');
// the frog pond and the bat roost are puzzles about the creature: without it, the looker can't get across
for (const [id, k] of [['pond', 'frog'], ['roost', 'bat']]) {
  const r = new G.Run(11); r.plan = [['start', id]]; r.enter(0); r.film = 999; r.ents = r.ents.filter((e) => e.k !== k);
  const mem = {}; for (let t = 0; t < 60 * 40 && r.phase === 'play'; t++) r.tick(looker(r, mem));
  assert.notEqual(r.phase, 'pick', `${id} can't be crossed without its ${k}`);
}
console.log('the pond needs its frog and the roost its bat');

const N = quick ? 4 : 8;
const runs = (bot) => Array.from({ length: N }, (_, i) => play(1000 + i * 7, bot));
const sum = (rs, name) => {
  const won = rs.filter((r) => r.phase === 'won').length, avg = rs.reduce((a, r) => a + (r.phase === 'won' ? G.SCREENS : r.screen), 0) / rs.length;
  const why = rs.filter((r) => r.phase === 'lost').map((r) => (r.film <= 0 ? 'film' : 'hearts'));
  console.log(`${name}: ${won}/${rs.length} won, screen ${avg.toFixed(1)} on average; lost to ${why.filter((w) => w === 'film').length} film, ${why.filter((w) => w === 'hearts').length} hearts; ${(rs.reduce((a, r) => a + r.stats.time, 0) / rs.length / 60).toFixed(1)} min a run`);
  return { won, avg };
};
const L = sum(runs(looker), 'looker'), C = sum(runs(careless), 'careless');
// four runs are too few to count on a win, so the quick check (in npm test) asks only that the looker gets well into
// the run; the full one asks for wins too
if (quick) assert.ok(L.avg >= 5, 'the looker gets well into the run'); else assert.ok(L.won >= 1, 'the looker wins some runs');
assert.ok(C.avg <= L.avg - 2, 'the careless player gets much less far');
console.log(`Out of Frame bots passed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
