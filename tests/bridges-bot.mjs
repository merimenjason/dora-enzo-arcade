// Twig & Twine bot: every crossing is tested with its stored designs (tests/bridges-solutions.json). For each level
// the master design crosses with nothing snapping at or under the master builder's price, a second, different design
// crosses within the thrifty price, the master price is clearly tighter than the thrifty one, and obviously bad designs
// fail: nothing built, and the road alone (the master design's planks with nothing holding them up). Each run must end
// within the time limit, and (without --quick) every design is run again, and once more step by step, to check the
// cart always does the same thing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Sim, LEVELS, LEVEL_IDS, TIME_LIMIT, Builder, decode, designCost, testDesign, mkey } from '../.checks/bridges-game.js';

const quick = process.argv.includes('--quick');
const only = process.argv.find((a) => /^[a-z]\d$/.test(a));
const sols = JSON.parse(readFileSync(new URL('./bridges-solutions.json', import.meta.url), 'utf8'));
const sig = (d) => d.map((m) => mkey(m.ax, m.ay, m.bx, m.by) + m.m).sort().join(';');
/** Tests a design, checking it finishes in time (simulated and real). */
function run(L, d, label) {
  const t0 = Date.now(), r = testDesign(L, d), ms = Date.now() - t0;
  assert.ok(r.t <= TIME_LIMIT + 0.5, `${L.id} ${label}: the run ends within ${TIME_LIMIT} s (${r.t.toFixed(1)})`);
  assert.ok(ms < 5000, `${L.id} ${label}: the test runs quickly (${ms} ms)`);
  return r;
}

let levels = 0, runs = 0;
const t0 = Date.now();
for (const id of LEVEL_IDS) {
  if (only && id !== only) continue;
  const L = LEVELS[id], s = sols[id];
  assert.ok(s?.master && s?.thrifty, `${id}: stored designs`);
  const master = decode(s.master), thrifty = decode(s.thrifty);
  // the stored designs are valid builds here
  for (const [n, d] of [['master', master], ['thrifty', thrifty]]) eq(new Builder(L, d).members.length, d.length, `${id}: every member of the ${n} design can be built`);
  const mc = designCost(master), tc = designCost(thrifty);
  assert.ok(mc <= L.master, `${id}: the master design (${mc}) is within the master price (${L.master})`);
  assert.ok(tc <= L.thrifty, `${id}: the thrifty design (${tc}) is within the thrifty price (${L.thrifty})`);
  assert.ok(tc >= mc && sig(thrifty) !== sig(master), `${id}: the thrifty design is a different one`);
  assert.ok(L.master <= L.thrifty * 0.9 && L.thrifty < L.budget, `${id}: master ${L.master} < thrifty ${L.thrifty} < budget ${L.budget}`);
  const rm = run(L, master, 'master'); runs++;
  assert.equal(rm.outcome, 'cross', `${id}: the master design crosses`);
  assert.equal(rm.broke, 0, `${id}: nothing snaps on the master design`);
  const rt = run(L, thrifty, 'thrifty'); runs++;
  assert.equal(rt.outcome, 'cross', `${id}: the thrifty design crosses`);
  assert.equal(rt.broke, 0, `${id}: nothing snaps on the thrifty design`);
  // obviously bad designs fail
  const none = run(L, [], 'nothing'); runs++;
  assert.notEqual(none.outcome, 'cross', `${id}: nothing built, no crossing`);
  const road = master.filter((m) => m.m === 'plank'), rr = run(L, road, 'road alone'); runs++;
  assert.notEqual(rr.outcome, 'cross', `${id}: the road alone, with nothing holding it up, fails (${rr.outcome})`);
  if (!quick) {
    // the same design always does the same thing
    for (const [n, d, r] of [['master', master, rm], ['thrifty', thrifty, rt], ['road alone', road, rr]]) {
      const again = run(L, d, n); runs++;
      assert.equal(again.fp, r.fp, `${id}: the ${n} design does exactly the same thing twice`);
      const s2 = new Sim(L, d); let n2 = 0; while (!s2.outcome && n2 < (TIME_LIMIT + 1) * 60) { s2.step(); s2.events.length = 0; n2++; } runs++;
      assert.equal(s2.fingerprint(), r.fp, `${id}: step by step, the ${n} design ends the same way`);
    }
  }
  levels++;
  if (!quick) console.log(`  ${id} ${L.name.padEnd(18)} master ${String(mc).padStart(4)} ≤ ${String(L.master).padStart(4)} · thrifty ${String(tc).padStart(4)} ≤ ${String(L.thrifty).padStart(4)} · budget ${String(L.budget).padStart(4)} · road alone: ${rr.outcome}`);
}
function eq(a, b, msg) { assert.equal(a, b, msg); }
console.log(`bridges bot: ${levels} crossing${levels === 1 ? '' : 's'} built for the medals, bad bridges fail${quick ? ' (quick)' : ', and every run repeats exactly'} (${runs} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
