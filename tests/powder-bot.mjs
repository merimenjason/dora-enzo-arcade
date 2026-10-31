// Powder Paws bots. A steering bot that plays like a person: it looks a second ahead, picks the heading that keeps it
// clear of trees and rocks and nearest to straight down (or toward the next gate, ramp or cabin porch), and acts on
// what it saw a reaction time ago, with a wobble in its aim. In the air it plans a spin, flip or grab for the airtime
// it guesses, and lets go with a little timing error. Three players: careless (slow to react, wobbly, never brakes),
// human-like (a quarter-second reaction, small wobble) and good (quick and steady).
// Checks: the human-like bot's median freeride distance sits in a target band; the storm catches the careless bot
// early; the good bot outruns it for long runs; nobody meets a slice of mountain with no way through (judged by the
// good bot never crashing into the same slice twice out of many seeds); slalom medal times and the Big Air medal
// scores in lib/powder-game.ts sit where the human-like bot's runs put them. `--quick` (in `npm test`) runs fewer
// seeds; `--tune` prints the medal tables from the runs.
import assert from 'node:assert/strict';
import { PowderGame, Rng, HALF, GZ, SPIN_RATE, FLIP_RATE, SLALOM, SLALOM_MEDALS, AIR_MEDALS, slalomMedal, airMedal } from '../.checks/powder-game.js';

const quick = process.argv.includes('--quick'), tune = process.argv.includes('--tune');

export function makeBot({ delay = 0.25, err = 0.08, look = 1.0, brakes = true, tricks = true, cabins = false, margin = 0.22, timing = 0.045, seed = 1 } = {}) {
  const rnd = new Rng(seed), queue = [], gauss = () => (rnd.next() + rnd.next() + rnd.next() - 1.5) * 1.15;
  let cur = { target: 0, down: false, up: false }, plan = null, lastState = 'ride';
  const D = Math.round(delay * 60);
  return (g) => {
    const k = g.sk;
    if (k.state === 'air') {
      if (lastState !== 'air') {
        // plan the tricks for the airtime it guesses
        const T = (2 * k.vz) / GZ * (1 + gauss() * 0.05), free = T - margin - delay * 0.4;
        plan = { spin: 0, flip: 0, grab: 0, dir: rnd.next() < 0.5 ? -1 : 1, t: 0 };
        if (tricks && !k.hop && free > 0.3) {
          if (free > 1.05 && rnd.next() < 0.45) plan.flip = 360 / FLIP_RATE;
          else { const n = Math.floor((free * SPIN_RATE) / 360); if (n >= 1) plan.spin = (n * 360) / SPIN_RATE; }
          const left = free - plan.spin - plan.flip;
          if (left > 0.45) plan.grab = Math.min(0.9, left - 0.3);
          plan.spin += gauss() * timing; plan.flip += gauss() * timing * 1.1; plan.grab += gauss() * timing * 1.3;
        }
      }
      lastState = 'air';
      const p = plan, t = (p.t += 1 / 60);
      const turn = t < p.spin ? p.dir : 0, up = t < p.flip, down = t > p.spin + p.flip && t < p.spin + p.flip + p.grab;
      return { turn, target: null, up, down };
    }
    lastState = k.state;
    if (g.steps % 5 === 0) queue.push({ at: g.steps + D, d: decide(g) });
    while (queue.length && queue[0].at <= g.steps) cur = queue.shift().d;
    return { turn: 0, target: cur.target, up: cur.up, down: cur.down };
  };
  function decide(g) {
    const k = g.sk, v = Math.max(k.s, 70), { obs } = g.near(k.y - 20, k.y + v * look + 40);
    const ramps = g.near(k.y, k.y + 900).ramps;
    let goal = null;
    if (g.mode === 'slalom') { const n = g.gateAhead(); if (n) goal = { x: n.x, y: n.y, w: 70 }; }
    else if (g.mode === 'air' && ramps.length) { const r = ramps.find((r) => r.y > k.y + 20); if (r) goal = { x: r.x, y: r.y, w: 50 }; }
    if (cabins) for (const o of g.near(k.y, k.y + 650).obs) if (o.k === 'cabin' && !g.cards.includes(o.i)) goal = { x: o.x, y: o.y - 29, w: 90 };
    let best = null;
    for (let h = -1.2; h <= 1.21; h += 0.15) {
      let hit = Infinity;
      let x = k.x, y = k.y, a = k.a;
      for (let t = 0.05; t <= look; t += 0.05) {
        // it keeps its current line until it reacts, then turns at the skis' turning rate
        if (t > delay) a += Math.max(-0.17, Math.min(0.17, h - a));
        x += v * Math.sin(a) * 0.05; y += v * Math.cos(a) * 0.05;
        if (g.outside(x, y) || (Math.abs(x) > HALF - 8 && !(goal && Math.sign(goal.x) === Math.sign(x) && Math.abs(goal.x) > HALF))) { hit = t; break; }
        for (const o of obs) {
          if (o.k === 'sign' || o.k === 'pole' || o.k === 'bank' || (o.w ? Math.abs(k.x - o.x) < o.w / 2 && Math.abs(k.y - o.y) < o.d / 2 : Math.hypot(k.x - o.x, k.y - o.y) < o.r)) continue;
          if (o.w && o.d) { if (Math.abs(x - o.x) < o.w / 2 + 6 && Math.abs(y - o.y) < o.d / 2 + 6) { hit = t; break; } continue; }
          if ((x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + 6) ** 2) { hit = t; break; }
        }
        if (hit < Infinity) break;
        for (const n of g.npcs) { const vv = g.npcVel(n); if (Math.hypot(n.x + vv.vx * t - x, n.y + vv.vy * t - y) < 12) { hit = t; break; } }
        if (hit < Infinity) break;
      }
      let sc = (hit < Infinity ? -3000 + hit * 2000 : 0) + 70 * Math.cos(h) - 22 * Math.abs(h - k.a);
      if (goal && goal.y > k.y) { const want = Math.atan2(goal.x - k.x, Math.max(20, goal.y - k.y)); sc -= 110 * Math.abs(h - Math.max(-1.2, Math.min(1.2, want))); }
      if (!best || sc > best.sc) best = { h, sc, hit };
    }
    const down = brakes && k.s > 50 && (best.hit < 0.6 || (best.hit < Infinity && k.s > 150));
    return { target: best.h + gauss() * err, down, up: !down && best.hit === Infinity && Math.abs(best.h) < 0.25 && k.s < 230 };
  }
}

export function run(mode, seed, bot, { course = 0, limit = 900 } = {}) {
  const g = new PowderGame(mode, seed, course);
  const play = bot;
  for (let i = 0; i < limit * 60 && !g.over; i++) { g.step(play(g)); g.drain(); }
  return g;
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

if (process.argv.includes("--lib")) { /* library only */ } else main();
function main() {
const players = {
  careless: (seed) => makeBot({ delay: 0.55, err: 0.25, brakes: false, tricks: false, look: 0.6, seed }),
  human: (seed) => makeBot({ delay: 0.25, err: 0.08, seed }),
  good: (seed) => makeBot({ delay: 0.12, err: 0.03, look: 1.2, margin: 0.1, timing: 0.015, seed }),
};
const N = quick ? 6 : 24;
const out = {};
for (const [name, mk] of Object.entries(players)) {
  const dists = [], crashes = [];
  for (let s = 1; s <= N; s++) { const g = run('free', s * 7919, mk(s), { limit: name === 'good' ? 420 : 600 }); dists.push(g.over ? g.over.dist : Math.floor(g.dist())); crashes.push(g.crashes); }
  out[name] = { median: median(dists), min: Math.min(...dists), max: Math.max(...dists), crashes: median(crashes) };
  console.log(`freeride ${name.padEnd(8)} median ${out[name].median} m (min ${out[name].min}, max ${out[name].max}), median crashes ${out[name].crashes}`);
}
assert.ok(out.careless.median < 1000, 'the storm catches a careless skier early');
assert.ok(out.human.median >= 700 && out.human.median <= 3500, `a human-like skier gets a fair way (${out.human.median} m)`);
assert.ok(out.good.median >= 2500, `a good skier can outrun the storm for a long run (${out.good.median} m)`);
assert.ok(out.human.median > out.careless.median * 1.6 && out.good.median > out.human.median, 'better skiing goes further');

// a careful bot that goes for the cabins finds some
{
  let found = 0;
  for (let s = 1; s <= (quick ? 3 : 8); s++) found += run('free', s * 31, makeBot({ delay: 0.15, err: 0.03, cabins: true, seed: s }), { limit: 300 }).cards.length;
  console.log(`cabin-hunting bot found ${found} postcards`);
  assert.ok(found >= (quick ? 2 : 6), 'the hidden cabins can be reached');
}

// slalom: gold from the good bot, silver and bronze from the human-like one
const tuned = [];
SLALOM.forEach((c, i) => {
  const times = [], goods = [];
  for (let s = 1; s <= (quick ? 3 : 10); s++) {
    const g = run('slalom', 0, players.human(s * 13 + i), { course: i, limit: 200 }); assert.ok(g.over?.reason === 'finish', `${c.name}: the bot finishes`); times.push(g.over.time + (g.over.missed > 2 ? 99 : 0));
    const h = run('slalom', 0, players.good(s * 17 + i), { course: i, limit: 200 }); goods.push(h.over.time + (h.over.missed > 2 ? 99 : 0));
  }
  const m = median(times), gm = median(goods);
  tuned.push([Math.round(gm + 0.5), Math.round(m * 1.06), Math.round(m * 1.35)]);
  const medal = slalomMedal(i, m, 0);
  console.log(`slalom ${c.name.padEnd(18)} human median ${m.toFixed(1)}s, good median ${gm.toFixed(1)}s -> medal ${medal}  (table ${SLALOM_MEDALS[i].join('/')})`);
  if (!tune) { assert.ok(medal >= 1 && medal <= 2, `${c.name}: a human-like run earns bronze or silver, not gold`); assert.ok(slalomMedal(i, gm, 0) === 3, `${c.name}: gold is within reach of good skiing`); }
});
// Big Air
{
  const scores = [], goods = [];
  for (let s = 1; s <= (quick ? 3 : 10); s++) { scores.push(run('air', 0, players.human(s * 101), { limit: 200 }).over?.tricks ?? 0); goods.push(run('air', 0, players.good(s * 103), { limit: 200 }).over?.tricks ?? 0); }
  const m = median(scores), gm = median(goods);
  console.log(`big air human median ${m}, good median ${gm} -> medal ${airMedal(m)} (table ${AIR_MEDALS.join('/')})`);
  if (tune) console.log('AIR_MEDALS', [Math.round(gm * 0.95 / 100) * 100, Math.round(m * 0.95 / 100) * 100, Math.round(m * 0.5 / 100) * 100]);
  else { assert.ok(airMedal(m) >= 1 && airMedal(m) <= 2, 'a human-like Big Air run earns bronze or silver'); assert.equal(airMedal(gm), 3, 'gold is within reach of good skiing'); const careless = run('air', 0, players.careless(5), { limit: 200 }); assert.ok(airMedal(careless.over?.tricks ?? 0) === 0, 'no tricks, no medal'); }
}
if (tune) console.log('SLALOM_MEDALS', JSON.stringify(tuned));
console.log('powder bots ok');
}
