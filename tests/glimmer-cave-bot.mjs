// Plays whole Glimmer Cave dives through the real engine with the bot policy (`drive` and `botPick`), on worker
// threads at 15 Hz with fixed seeds, so the numbers are the same on every run. It checks the spec's balance gates:
// first dives from a fresh profile (and a random-card player beside them), upgraded dives at hazards 1 and 3, the
// variety of weapons and overclocks, the Rock Wyrm's fight length, and a 60 Hz step's cost with 300 critters alive.
// `FULL=1` (`npm run bot:cave`) plays 4x the dives. `TUNE='{"RAMP":{"from":15}}'` overrides data numbers for a tuning
// session, and `ONLY=first,up1` plays only those groups; neither is used by `npm test`.
import assert from 'node:assert/strict';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import * as G from '../.checks/glimmer-cave-game.js';

const FULL = process.env.FULL === '1';
const HZ = 15;
/** Dives per group: `first` and `random` share their seeds. */
const SIZES = { first: 80, random: 80, up1: 30, up3: 30 };
const UPGRADED = { upgrades: Object.fromEntries(G.UPGRADE_IDS.map((id) => [id, 3])), unlocked: { weapons: ['bomb', 'moths', 'drum', 'drill'] } };
const GROUPS = {
  first: { hazard: 1, profile: {}, policy: 'bot' },
  random: { hazard: 1, profile: {}, policy: 'random' },
  up1: { hazard: 1, profile: UPGRADED, policy: 'bot' },
  up3: { hazard: 3, profile: UPGRADED, policy: 'bot' },
};

/** Applies a TUNE override: each key names an exported data object, whose fields are replaced. */
function tune(json) {
  if (!json) return;
  for (const [k, v] of Object.entries(JSON.parse(json))) {
    const into = (o, p) => { for (const [a, b] of Object.entries(p)) if (b && typeof b === 'object' && !Array.isArray(b)) into(o[a], b); else o[a] = b; };
    into(G[k], v);
  }
}

/** Plays one dive to its end and returns what the gates need. */
function play(group, seed) {
  const g = GROUPS[group], hero = seed % 2 ? 'dora' : 'enzo';
  const d = new G.Dive({ seed, hero, hazard: g.hazard, profile: g.profile, hz: HZ });
  const r = new G.Rand(G.mix(seed, 7)), choose = g.policy === 'bot' ? G.botPick : G.randomPick;
  const oc = [];
  let wyrmAt = null, wyrmTime = null, rerolled = false;
  for (let guard = 0; d.phase !== 'over'; guard++) {
    if (guard > 200000) throw new Error(`${group} seed ${seed} never ended`);
    if (d.phase === 'pick') {
      // The policy tries one reroll per offer; a reroll leaves the phase at 'pick' with the new offer.
      if (g.policy === 'bot' && !rerolled) { rerolled = true; if (G.botReroll(d)) continue; }
      rerolled = false;
      const i = choose(d, r), c = d.offer[i];
      if (c.k === 'overclock') { const w = d.weapons.find((x) => c.id.startsWith(`${x.id}.`)); oc.push([w.id, w.level + 1, c.id]); }
      d.pick(i);
      continue;
    }
    if (d.phase === 'pod') { d.descend(); continue; }
    const ev = d.step(G.drive(d));
    if (d.wyrm && wyrmAt === null) wyrmAt = d.t;
    if (wyrmTime === null && ev.some((e) => e.k === 'wyrm' && e.what === 'bonked')) wyrmTime = d.t - wyrmAt;
  }
  return { group, seed, hero, layer: d.layer, result: d.result, t: d.t, level: d.level, weapons: d.weapons.map((w) => w.id), oc, wyrm: wyrmAt !== null, wyrmTime };
}

if (!isMainThread) {
  tune(workerData.tune);
  parentPort.postMessage(workerData.jobs.map(([group, seed]) => play(group, seed)));
} else {
  const started = Date.now();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(GROUPS);
  const jobs = [];
  for (const group of only) for (let i = 0; i < SIZES[group] * (FULL ? 4 : 1); i++) jobs.push([group, (group === 'random' ? 1 : 1 + Object.keys(GROUPS).indexOf(group) * 10000) + i]);
  // Long dives first, dealt round-robin, so the threads finish together.
  const n = Math.max(1, Math.min(os.availableParallelism(), jobs.length)), parts = Array.from({ length: n }, () => []);
  [...jobs].sort((a, b) => (a[0].startsWith('up') ? 0 : 1) - (b[0].startsWith('up') ? 0 : 1)).forEach((j, i) => parts[i % n].push(j));
  const runs = (await Promise.all(parts.map((part) => new Promise((done, fail) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { jobs: part, tune: process.env.TUNE } });
    w.once('message', done); w.once('error', fail);
  })))).flat();
  const playSecs = (Date.now() - started) / 1000;
  tune(process.env.TUNE);

  const of = (group) => runs.filter((x) => x.group === group);
  const rate = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : NaN);
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const rows = [];
  for (const group of only) {
    const xs = of(group), layers = [1, 2, 3, 4, 5].map((l) => pct(rate(xs, (x) => x.layer >= l)));
    rows.push(`${group.padEnd(7)} ${String(xs.length).padStart(4)} dives  reach L2-L5 ${layers.slice(1).join(' / ')}  finished ${pct(rate(xs, (x) => x.result === 'complete'))} (Dora ${pct(rate(xs.filter((x) => x.hero === 'dora'), (x) => x.result === 'complete'))}, Enzo ${pct(rate(xs.filter((x) => x.hero === 'enzo'), (x) => x.result === 'complete'))})  mean level ${(xs.reduce((a, x) => a + x.level, 0) / xs.length).toFixed(0)}`);
  }
  console.log(rows.join('\n'));

  // Variety, across the upgraded dives.
  const up = [...of('up1'), ...of('up3')];
  const taken = Object.fromEntries(G.WEAPON_IDS.map((id) => [id, rate(up, (x) => x.weapons.includes(id))]));
  console.log('weapons taken: ' + G.WEAPON_IDS.map((id) => `${id} ${pct(taken[id])}`).join(', '));
  const reached = {}, chosen = {};
  for (const x of up) for (const [w, lv, id] of x.oc) { reached[`${w}${lv}`] = (reached[`${w}${lv}`] ?? 0) + 1; chosen[id] = (chosen[id] ?? 0) + 1; }
  const ocRate = (w, lv, id) => (reached[`${w}${lv}`] ? (chosen[id] ?? 0) / reached[`${w}${lv}`] : NaN);
  console.log('overclocks: ' + G.WEAPON_IDS.map((w) => [5, 10].map((lv) => G.WEAPONS[w][lv === 5 ? 'oc5' : 'oc10'].map((id) => `${id} ${chosen[id] ?? 0}/${reached[`${w}${lv}`] ?? 0}`).join(' ')).join(' ')).join(', '));

  // The wyrm's fights.
  // A fight the hero survives always ends with the wyrm bonked; the gate counts only those.
  const fights = runs.filter((x) => x.group !== 'random' && x.wyrm), won = fights.filter((x) => x.wyrmTime !== null);
  const quick = rate(won, (x) => x.wyrmTime >= 30 && x.wyrmTime <= 150), times = won.map((x) => x.wyrmTime).sort((a, b) => a - b);
  console.log(`wyrm fights ${fights.length}: hero bonked mid-fight ${pct(rate(fights, (x) => x.wyrmTime === null))}; of ${won.length} won, bonked in 30-150 s ${pct(quick)}, median ${times.length ? times[times.length >> 1].toFixed(0) : '-'} s`);

  // A 60 Hz step with 300 critters alive, on this thread.
  const d = new G.Dive({ seed: 99, hero: 'enzo', hazard: 3, profile: UPGRADED });
  d.startLayer(4); d.fluff = 1e9;
  for (const [id, lv] of [['sling', 8], ['lance', 8], ['pulse', 8], ['orbit', 8]]) {
    let w = d.weapons.find((x) => x.id === id);
    if (!w) d.weapons.push(w = G.newWeapon(id));
    w.level = lv; w.count = 3;
  }
  const r = new G.Rand(5), fill = () => {
    for (let i = 0; d.critters.length < G.MAX_ALIVE && i < 2000; i++) {
      const x = Math.floor(d.hx) + r.int(25) - 12, y = Math.floor(d.hy) + r.int(17) - 8;
      if (G.tileAt(d.map, x, y) === 'floor') d.spawn(G.CRITTER_IDS[r.int(3)], x + 0.5, y + 0.5);
    }
  };
  let spent = 0, alive = 0;
  for (let i = 0; i < 660; i++) {
    while (d.phase === 'pick') d.pick(0);
    fill();
    const t0 = performance.now();
    d.step(G.drive(d));
    if (i >= 60) { spent += performance.now() - t0; alive += d.critters.length; }
  }
  const stepMs = spent / 600;
  console.log(`60 Hz step with ~${(alive / 600).toFixed(0)} critters after it: ${stepMs.toFixed(3)} ms`);
  console.log(`${playSecs.toFixed(1)} s playing on ${n} threads, ${((Date.now() - started) / 1000).toFixed(1)} s in all`);

  const first = rate(of('first'), (x) => x.layer >= 2), firstDone = rate(of('first'), (x) => x.result === 'complete');
  const randomDone = rate(of('random'), (x) => x.result === 'complete');
  const up1 = rate(of('up1'), (x) => x.result === 'complete'), up3 = rate(of('up3'), (x) => x.result === 'complete');
  if (only.includes('first')) {
    assert.ok(first >= 0.7, `first dives reach layer 2 in ${pct(first)}`);
    assert.ok(firstDone >= 0.05 && firstDone <= 0.3, `first dives finish in ${pct(firstDone)}`);
    if (only.includes('random')) assert.ok(firstDone - randomDone >= 0.1, `a random player finishes ${pct(randomDone)}`);
  }
  if (only.includes('up1')) assert.ok(up1 >= 0.5 && up1 <= 0.85, `upgraded dives finish hazard 1 in ${pct(up1)}`);
  if (only.includes('up3')) assert.ok(up3 >= 0.15 && up3 <= 0.5, `upgraded dives finish hazard 3 in ${pct(up3)}`);
  if (up.length && only.includes('up1') && only.includes('up3')) {
    for (const id of G.WEAPON_IDS) assert.ok(taken[id] >= 0.03, `${id} taken in ${pct(taken[id])} of upgraded dives`);
    for (const w of G.WEAPON_IDS) for (const lv of [5, 10]) for (const id of G.WEAPONS[w][lv === 5 ? 'oc5' : 'oc10']) {
      // Only stages reached often enough to judge: a 50/50 pick misses 20 times in a row one time in a million.
      if (reached[`${w}${lv}`] >= 20) assert.ok(ocRate(w, lv, id) >= 0.01, `${id} in ${chosen[id] ?? 0} of ${reached[`${w}${lv}`]}`);
    }
  }
  if (won.length) assert.ok(quick >= 0.8, `the wyrm is bonked in 30-150 s in ${pct(quick)} of fights won`);
  assert.ok(stepMs < 2, `a 60 Hz step takes ${stepMs.toFixed(3)} ms`);
  console.log('PASS Glimmer Cave bot');
}
