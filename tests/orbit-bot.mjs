// Moonhop's bots. The search bot (tests/orbit-solve.mjs) plays every stage with the real inputs (point at a spot,
// hold to a charge, let go, maybe one puff) and proves each can be finished with every firefly and the golden one
// within its leap par, using only leaps a person could repeat (a little off in aim or power still lands the same
// way); the pars and the Starlight times were set from these routes with a little headroom. Two naive players show the
// stars are not free: one that only ever leaps straight up at full power, and one that leaps at random. The Moon
// Garden's grown fields are checked to always come with a working route. `--quick` (used by `npm test`) replays the
// saved routes in tests/orbit-solutions.json instead of searching; `--write` saves fresh ones and prints the pars.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGES, gardenField, rng } from '../.checks/orbit-levels.js';
import { Hop, play } from '../.checks/orbit-game.js';
import { solve, check, verify, window, TOL } from './orbit-solve.mjs';

const quick = process.argv.includes('--quick'), write = process.argv.includes('--write');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SOL = new URL('./orbit-solutions.json', import.meta.url);
const saved = fs.existsSync(SOL) ? JSON.parse(fs.readFileSync(SOL, 'utf8')) : {};
/** The par a route earns: one leap of headroom, two on long stages. */
export const parFor = (leaps) => leaps + (leaps >= 6 ? 2 : 1);
export const timeFor = (t) => Math.ceil(t * 1.25 + 4);

// ---------------------------------------------------------------- every stage, three stars and the Starlight medal
const found = {}, windows = {};
let n = 0;
for (const s of STAGES) {
  if (only.length && !only.includes(s.id)) continue;
  let route = saved[s.id];
  if (!quick) {
    const t0 = Date.now();
    // What the full run proves for each stage: a way home with every firefly and the golden one, within the par,
    // made only of leaps a person could repeat; and no such way at all in par - 3 leaps or fewer, so the par is never
    // more than two leaps of headroom. A saved route that still checks out leap by leap proves the first; a search to
    // par - 3 leaps proves the second (with the puff too when the route needs one), without the slow last layer of a
    // search for the very fewest. Without a saved route that still works, or with --write, it searches in full.
    const v = !write && route ? verify(s, route) : null;
    let r = null, how = 'searched';
    if (v && v.leaps <= s.par) {
      const stats = {}, puff = route.some((a) => a.puff), depth = s.par - 3;
      const shorter = depth >= 1 ? solve(s, { gold: true, maxLeaps: depth, maxNodes: 300, robust: true, puff, stats }) : null;
      assert.ok(!stats.capped, `${s.id}: the search to ${depth} leaps finished`);
      assert.ok(!shorter, `${s.id}: no way home in ${depth} leaps or fewer (found ${shorter?.leaps}), so the par of ${s.par} is close`);
      r = { route, leaps: v.leaps, time: v.time }; how = `saved route re-checked, none in ${Math.max(0, depth)}`;
    } else {
      // the saved route goes first in each layer: when it still works the search finds it straight away, and when it
      // doesn't (or a shorter one exists) the search carries on exactly as it would without it
      r = solve(s, { gold: true, maxNodes: 300, robust: true, hint: route });
      // no way home without puffs, or only a long way round: search again with them, keeping the shorter route
      if (!r || r.leaps > s.par) { const p = solve(s, { gold: true, maxNodes: 300, robust: true, puff: true, hint: route }); if (p && (!r || p.leaps < r.leaps)) r = p; }
      assert.ok(r, `${s.id} ${s.name}: the bot finds a way home with every firefly and the golden one`);
    }
    route = r.route; found[s.id] = { route, leaps: r.leaps, time: r.time };
    console.log(`${s.id} ${s.name.padEnd(18)} ${r.leaps} leaps (par ${s.par}, bot par ${parFor(r.leaps)}) ${r.time.toFixed(1)}s (Starlight ${s.parTime}s)  [${how}, ${((Date.now() - t0) / 1000).toFixed(1)}s]`);
    if (!write) {
      assert.ok(r.leaps <= s.par, `${s.id}: the bot is within the par`);
      assert.ok(s.par <= r.leaps + 2, `${s.id}: the par is close to the bot's route (${s.par} vs ${r.leaps})`);
    }
  }
  assert.ok(route, `${s.id}: a saved route (run npm run bot:orbit -- --write)`);
  const h = check(s, route);
  assert.ok(h.done, `${s.id}: the route reaches home`);
  assert.ok(h.goldGot(), `${s.id}: with the golden firefly`);
  if (!write) {
    const res = h.result();
    assert.ok(res.par, `${s.id}: within the par (${h.leaps} of ${s.par})`);
    assert.ok(res.time <= s.parTime, `${s.id}: within the Starlight time (${res.time.toFixed(1)} of ${s.parTime})`);
  }
  // how far off each leap may be and still land the same way: never narrower than the bot's tolerance
  const win = window(s, route);
  windows[s.id] = win;
  assert.ok(win.aim >= TOL[0] - 1e-9 && win.power >= TOL[1] - 1e-9, `${s.id}: every leap still works ${TOL[0]} rad off in aim and ${TOL[1]} off in power (narrowest ${win.aim.toFixed(3)} / ${win.power.toFixed(3)})`);
  n++;
}
// Skid and Leap (3-7) once had a leap that only an exact hand could repeat: its narrowest leap must be at least as
// forgiving as its neighbours'
if (windows['3-7'] && windows['3-6'] && windows['3-8']) {
  const w = windows['3-7'], lo = (k) => Math.min(windows['3-6'][k], windows['3-8'][k]);
  assert.ok(w.aim >= lo('aim') - 1e-9, `3-7's aim window (${w.aim.toFixed(3)}) is as wide as its neighbours' (${lo('aim').toFixed(3)})`);
  assert.ok(w.power >= lo('power') - 1e-9, `3-7's power window (${w.power.toFixed(3)}) is as wide as its neighbours' (${lo('power').toFixed(3)})`);
}
const narrow = Object.entries(windows).sort((a, b) => a[1].aim - b[1].aim).slice(0, 3).map(([id, w]) => `${id} ${w.aim.toFixed(3)}`).join(', ');
console.log(`PASS every leap of every route still works ${TOL[0]} rad off in aim and ${TOL[1]} off in power (narrowest aim: ${narrow})`);
console.log(`PASS ${n} stages home with every firefly and the golden one, within the leap par and the Starlight time${quick ? ' (saved routes)' : ''}`);

if (write) {
  const all = { ...saved };
  for (const [id, f] of Object.entries(found)) all[id] = f.route.map((a) => ('walk' in a ? { walk: a.walk } : { at: a.at, charge: a.charge, ...(a.wait ? { wait: a.wait } : {}), ...(a.puff ? { puff: a.puff } : {}) }));
  fs.writeFileSync(SOL, JSON.stringify(all, null, 0).replace(/\],"/g, '],\n"') + '\n');
  console.log('PARS', JSON.stringify(Object.fromEntries(Object.entries(found).map(([id, f]) => [id, [parFor(f.leaps), timeFor(f.time)]]))));
  // the saved routes must still work
  for (const id of Object.keys(found)) { const s = STAGES.find((x) => x.id === id), h = check(s, all[id]); assert.ok(h.done && h.goldGot(), `${id}: the saved route replays`); }
}

// ---------------------------------------------------------------- naive play doesn't win the stars
if (!only.length) {
  // straight up at full power, wherever they stand
  let upWins = 0;
  for (const s of STAGES) {
    const h = new Hop(s);
    for (let k = 0; k < 12 && !h.done; k++) play(h, { at: h.at, charge: 1 });
    if (h.done && h.goldGot() && h.leaps <= s.par) upWins++;
  }
  assert.equal(upWins, 0, 'leaping straight up never earns three stars');
  // at random: a few goes of par-many random leaps at each stage
  const r = rng(60), tries = quick ? 2 : 4;
  let three = 0, home = 0;
  for (const s of STAGES) {
    let best = 0;
    for (let g = 0; g < tries && best < 3; g++) {
      const h = new Hop(s);
      for (let k = 0; k < s.par && !h.done; k++) play(h, { at: h.at + (r() - 0.5) * Math.PI, charge: r() });
      if (h.done) best = Math.max(best, 1 + (h.goldGot() ? 1 : 0) + (h.leaps <= s.par ? 1 : 0));
    }
    if (best >= 1) home++; if (best === 3) three++;
  }
  console.log(`naive: straight up 0/${STAGES.length} three-star; random leaps reached home on ${home} and three-starred ${three} of ${STAGES.length}`);
  assert.ok(three <= STAGES.length * 0.1, `random leaping rarely earns three stars (${three})`);
  console.log('PASS naive play does not win the stars');
}

// ---------------------------------------------------------------- the Moon Garden
{
  const count = quick ? 12 : 60;
  let moons = 0;
  for (let level = 1; level <= count; level++) {
    const { stage, route } = gardenField(level);
    assert.ok(stage.moons.length >= 3, `field ${level} was grown`);
    const h = new Hop(stage); for (const a of route) play(h, a);
    assert.ok(h.done && h.got.every(Boolean), `field ${level} comes with a route that works`);
    moons += stage.moons.length;
  }
  console.log(`PASS ${count} Moon Garden fields grown (${(moons / count).toFixed(1)} moons each on average), every one finished by its route`);
}
