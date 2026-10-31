// Kite Day bots. A careful flier with a human's reaction time (it sees the sky a fifth of a second late, decides
// about six times a second and wobbles its aim a little) plays every challenge of the summer with the suggested
// kite, and must clear every one; its results set the medal marks, which this checks still sit where the bot puts
// them (gold within reach of a good run, silver comfortably below). Two naive fliers must fail most challenges: one
// who never touches anything, and one who holds the pull and points straight at everything.
// `--quick` (in `npm test`) plays one run per challenge; `--calibrate` prints the marks the runs suggest.
import strict from 'node:assert/strict';
import * as K from '../.checks/kite-game.js';

const quick = process.argv.includes('--quick'), calibrate = process.argv.includes('--calibrate');
const assert = { ok: (c, m) => { if (calibrate) { if (!c) console.log('    FAIL ' + m); } else strict.ok(c, m); } };
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

/** Is the straight path from a to b blocked by a tree's leaves or a roof? Returns a waypoint to fly to first: over
 * the top, or, for a point tucked against the leaves, a spot just outside it to come in from. */
function waypoint(P, ax, ay, bx, by, depth = 0) {
  const hits = (cx, cy, r) => {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / L2));
    return Math.hypot(ax + dx * u - cx, ay + dy * u - cy) < r;
  };
  const obs = [
    ...P.trees.map((t) => ({ cx: t.x, cy: K.groundAt(P, t.x) + t.h, r: t.r * 0.86 + 0.9, top: K.groundAt(P, t.x) + t.h + t.r })),
    ...P.buildings.map((b) => { const cx = (b.x0 + b.x1) / 2, g = K.groundAt(P, cx); return { cx, cy: g + (b.h + b.roof) / 2, r: Math.max((b.x1 - b.x0) / 2, (b.h + b.roof) / 2) + 0.6, top: g + b.h + b.roof }; }),
  ];
  let best = null, bestD = Infinity;
  for (const o of obs) {
    if (!hits(o.cx, o.cy, o.r)) continue;
    const d = Math.abs(o.cx - ax); if (d >= bestD) continue;
    const tdist = Math.hypot(bx - o.cx, by - o.cy);
    if (tdist < o.r + 1.6) {
      // the point sits against the obstacle: come at it from just outside, on its own side
      const ux = (bx - o.cx) / (tdist || 1), uy = (by - o.cy) / (tdist || 1);
      const near = [bx + ux * 2.4, by + uy * 2.4 + 0.6];
      if (Math.hypot(ax - near[0], ay - near[1]) < 1.8) continue;
      best = near; bestD = d;
    } else { best = [o.cx + (bx > o.cx ? 0.8 : -0.8), o.top + 2.4]; bestD = d; }
  }
  // the way to the waypoint may itself be blocked: then go over that first
  if (best && depth < 2) { const first = waypoint(P, ax, ay, best[0], best[1], depth + 1); if (first) return first; }
  return best;
}

/** The careful flier. Returns a function that gives the input for each step. */
export function careful(f, seed = 1, opts = {}) {
  const r = K.rng(seed * 7919 + 17), delay = opts.delay ?? 12, every = opts.every ?? 10, wob = opts.wobble ?? 0.6;
  const seen = [];
  let inp = { ...K.NO_INPUT }, trick = 0, trickDir = 1, trickT = 0, noise = [0, 0], loopCue = -1;
  const goal = f.ch?.goal;
  return () => {
    const k = f.me, o = f.other;
    seen.push({ x: k.x, y: k.y, vx: k.vx, vy: k.vy, state: k.state, obj: f.objective(), ox: o?.x, oy: o?.y, tangle: f.tangle, t: f.t });
    if (seen.length > delay + 1) seen.shift();
    const s = seen[0];
    if (f.steps % every !== 0) return inp;
    if (f.steps % (every * 4) === 0) noise = [(r() * 2 - 1) * wob, (r() * 2 - 1) * wob];
    const P = f.P, above = s.y - K.surfaceAt(P, s.x);
    let aim = null, steer = 0, pull = false, ease = false, walk = 0;
    if (goal?.kind === 'tricks' || (goal?.kind === 'routine' && trick > 0)) {
      // loops want height and a fair line: climb first, then turn one way and the other for figure-eights
      if (goal.kind === 'tricks' && (above < 11 || s.state !== 'fly')) { trick = 0; aim = [k.hx + 7, k.hy + 18]; ({ pull, ease } = K.keeper(k, P, aim[0], aim[1])); }
      else {
        if (trick === 0) { trick = 1; trickT = 0; trickDir = r() < 0.5 ? 1 : -1; }
        trickT += every / K.FPS;
        const per = { bird: 1.5, delta: 1.8, diamond: 1.9, dragon: 2.1, box: 2.4, sled: 2.4 }[k.design.shape] ?? 2;
        if (trickT > per) { trickDir = -trickDir; trickT = 0; trick++; }
        steer = trickDir; pull = k.L > 19; ease = k.L < 15;
        if (goal.kind === 'routine' && trick > 2) trick = 0;
        if (above < 6) { trick = 0; steer = 0; aim = [k.x - 3, k.y + 8]; }
      }
    } else if (s.obj) {
      let [tx, ty] = s.obj;
      if (goal?.kind === 'duel' && o) {
        // hunt the streamer from the upwind side; if the lines start to cross, get back on your own side first
        if (s.tangle > 0.05) { tx = s.ox - 6; ty = s.oy + 5; }
        else if (k.x > o.x + 1) { tx = o.x - 4; ty = o.y + 3; }
      }
      aim = [tx + noise[0], ty + noise[1]];
      // over a tree or a roof in the way
      const way = goal?.kind === 'duel' ? null : waypoint(P, s.x, s.y, tx, ty);
      if (way) aim = [way[0] + noise[0] * 0.3, way[1] + noise[1] * 0.3];
      ({ pull, ease } = K.keeper(k, P, aim[0], aim[1]));
      // a careful flier never dives at the grass: low and falling, aim up first
      if (above < 4 && s.vy < -1) aim = [s.x - 2, s.y + 6];
      // walk when the point is out of the line's reach, or behind
      const R = Math.hypot(tx - k.hx, ty - k.hy);
      walk = R > k.lmax - 3 && tx > k.hx ? 1 : tx < k.hx + 3 ? -1 : 0;
      // the finale's loop cues: loop as the beat comes
      if (goal?.kind === 'routine') {
        const i = f.cueNext, c = goal.cues[i];
        if (c && c.loop && loopCue !== i && f.cueHit[i] && Math.abs(f.t - c.t) < 1.2) { loopCue = i; trick = 1; trickT = 0; trickDir = 1; }
      }
    } else { aim = [k.hx + 8, k.hy + 14]; ({ pull, ease } = K.keeper(k, P, aim[0], aim[1])); }
    inp = { pull, ease, steer, aim: steer ? null : aim, walk };
    return inp;
  };
}
/** Never touches a thing. */
export const idle = () => () => K.NO_INPUT;
/** Holds the pull and points straight at everything. */
export const masher = (f) => () => { const o = f.objective(); return { pull: true, steer: 0, aim: o ?? [f.me.hx + 6, f.me.hy + 12], walk: 0 }; };

export function run(id, policy, seed = 1, shape) {
  const ch = K.CHALLENGE[id];
  const sh = shape ?? ch.suggest ?? 'diamond';
  const f = new K.Flight({ place: ch.place, challenge: id, design: { shape: sh, paint: K.DEFAULT_PAINT[sh] }, flyer: seed % 2 ? 'dora' : 'enzo' });
  const p = policy(f, seed);
  const max = (ch.goal.limit + 2) * K.FPS;
  for (let i = 0; i < max && !f.done; i++) { f.step(p()); if (f.events.length > 400) f.events.length = 0; }
  return f;
}

if (process.argv[1]?.endsWith('kite-bot.mjs')) main();
function main() {
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const ids = K.CHALLENGES.map((c) => c.id).filter((id) => !only || only.includes(id));
const seeds = quick ? [1] : [1, 2, 3];
let checks = 0, failsIdle = 0, failsMash = 0;
const t0 = Date.now();
for (const id of ids) {
  const ch = K.CHALLENGE[id];
  const runs = seeds.map((sd) => run(id, careful, sd));
  const won = runs.filter((f) => f.won), vals = won.map((f) => f.value), meds = runs.map((f) => f.medal);
  const line = `${id.padEnd(3)} ${ch.name.padEnd(22)} won ${won.length}/${runs.length}  values ${runs.map((f) => (f.won ? +f.value.toFixed(1) : 'x')).join(' ')}  medals ${meds.join('')}`;
  console.log(line);
  if (calibrate && vals.length) {
    const m = median(vals);
    const marks = ch.better === 'low' ? [ch.goal.limit, Math.ceil(m * 1.6), Math.ceil(m * 1.12)] : [Math.floor(m * 0.3 / 10) * 10, Math.floor(m * 0.6 / 10) * 10, Math.floor(m * 0.92 / 10) * 10];
    console.log(`    suggested marks ${JSON.stringify(marks)} (median ${m.toFixed(1)})`);
  }
  // the bot clears every challenge (in most of its runs), and earns at least bronze each time it wins
  assert.ok(won.length >= Math.ceil(runs.length * 0.6), `${id}: the careful bot clears ${ch.name} (${won.length}/${runs.length})`); checks++;
  for (const f of won) { assert.ok(f.medal >= 1, `${id}: a win earns a medal`); checks++; }
  // gold is within reach of a good run, but not handed out: the bot's best run gets silver or gold, its median not above gold by much
  if (!quick && ch.goal.kind !== 'duel') {
    const best = Math.max(...meds);
    assert.ok(best >= 2, `${id}: the bot's best run reaches silver or gold (${meds.join('')})`); checks++;
  }
  // naive fliers
  const fi = run(id, idle, 1), fm = run(id, masher, 1);
  if (!fi.won) failsIdle++;
  if (!fm.won || fm.medal < 2) failsMash++;
}
console.log(`idle bot failed ${failsIdle}/${ids.length}; masher failed (or no better than bronze) ${failsMash}/${ids.length}`);
if (!only) {
  assert.ok(failsIdle >= ids.length * 0.8, `doing nothing fails most challenges (${failsIdle}/${ids.length})`); checks++;
  assert.ok(failsMash >= ids.length * 0.6, `pulling and pointing straight at things fails most (${failsMash}/${ids.length})`); checks++;
}
console.log(`kite bots: ${checks} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
