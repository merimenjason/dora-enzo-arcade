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
import { solve, check } from './orbit-solve.mjs';

const quick = process.argv.includes('--quick'), write = process.argv.includes('--write');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SOL = new URL('./orbit-solutions.json', import.meta.url);
const saved = fs.existsSync(SOL) ? JSON.parse(fs.readFileSync(SOL, 'utf8')) : {};
/** The par a route earns: one leap of headroom, two on long stages. */
export const parFor = (leaps) => leaps + (leaps >= 6 ? 2 : 1);
export const timeFor = (t) => Math.ceil(t * 1.25 + 4);

// ---------------------------------------------------------------- every stage, three stars and the Starlight medal
const found = {};
let n = 0;
for (const s of STAGES) {
  if (only.length && !only.includes(s.id)) continue;
  let route = saved[s.id];
  if (!quick) {
    const t0 = Date.now();
    let r = solve(s, { gold: true, maxNodes: 300, robust: true });
    if (!r) r = solve(s, { gold: true, maxNodes: 300, robust: true, puff: true });
    assert.ok(r, `${s.id} ${s.name}: the bot finds a way home with every firefly and the golden one`);
    route = r.route; found[s.id] = { route, leaps: r.leaps, time: r.time };
    console.log(`${s.id} ${s.name.padEnd(18)} ${r.leaps} leaps (par ${s.par}, bot par ${parFor(r.leaps)}) ${r.time.toFixed(1)}s (Starlight ${s.parTime}s)  [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
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
  n++;
}
console.log(`PASS ${n} stages home with every firefly and the golden one, within the leap par and the Starlight time${quick ? ' (saved routes)' : ''}`);

if (write) {
  const all = { ...saved };
  for (const [id, f] of Object.entries(found)) all[id] = f.route.map((a) => ('walk' in a ? { walk: +a.walk.toFixed(6) } : { at: +a.at.toFixed(6), charge: a.charge, ...(a.wait ? { wait: a.wait } : {}), ...(a.puff ? { puff: a.puff } : {}) }));
  fs.writeFileSync(SOL, JSON.stringify(all, null, 0).replace(/\],"/g, '],\n"') + '\n');
  console.log('PARS', JSON.stringify(Object.fromEntries(Object.entries(found).map(([id, f]) => [id, [parFor(f.leaps), timeFor(f.time)]]))));
  // the saved (rounded) routes must still work
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
