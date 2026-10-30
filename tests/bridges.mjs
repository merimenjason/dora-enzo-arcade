// Twig & Twine engine checks: the materials (twine goes slack when pushed and holds when pulled, a plank alone over a
// long gap snaps, a simple truss holds), the same bridge always doing the same thing, costs, budgets and medals, the
// builder (snapping, reach, where joints may go, the boat's lane, undo and redo, mirror building, removing), the
// twenty-four levels and their prices, and saving, corrupt saves included.
import assert from 'node:assert/strict';
import {
  Builder, Sim, LEVELS, LEVEL_IDS, REGIONS, SANDBOX, MAT, MATS, DT, TIME_LIMIT, SETTLE, compLimit, memberCost, designCost, medalsFor, testDesign,
  encode, decode, mkey, SAVE_KEY, freshSave, readSave, recordCross, levelOpen, crossed, medalCount, regionLevels, regionCleared, sandboxOpen, savedDesign,
} from '../.checks/bridges-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const P = (ax, ay, bx, by, m = 'plank') => ({ ax, ay, bx, by, m });
const deck = (x0, x1, y = 0) => { const o = []; for (let x = x0; x < x1; x += 2) o.push(P(x, y, x + 2, y)); return o; };
const stepFor = (s, sec) => { for (let i = 0; i < sec / DT; i++) s.step(); };

// ---- the levels
{
  eq(LEVEL_IDS.length, 24, 'twenty-four crossings');
  eq(REGIONS.length, 4, 'four regions');
  for (const R of REGIONS) eq(regionLevels(R.id).length, 6, `six crossings in ${R.name}`);
  eq(new Set(LEVEL_IDS.map((id) => LEVELS[id].name)).size, 24, 'names are unique');
  for (const R of REGIONS) ok(LEVELS[regionLevels(R.id)[0]].tip, `${R.name} opens with a tip`);
  for (const id of LEVEL_IDS) {
    const L = LEVELS[id];
    ok(L.master > 0 && L.master < L.thrifty && L.thrifty < L.budget, `${id}: master < thrifty < budget (${L.master}, ${L.thrifty}, ${L.budget})`);
    ok(L.master <= L.thrifty * 0.9, `${id}: the master builder's price is clearly tighter than the thrifty one`);
    ok(L.anchors.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)), `${id}: anchors sit on the grid`);
    ok(Number.isInteger(L.mirror * 2), `${id}: the mirror line maps grid points to grid points`);
    ok(L.mats.includes('plank') && L.mats.includes('twig'), `${id}: planks and twigs`);
    ok(L.finish > Math.max(...L.anchors.map((a) => a[0])), `${id}: the finish is past the gap`);
    ok(new Builder(L).nodes().size === L.anchors.length, `${id}: the anchors are the starting nodes`);
  }
  ok(regionLevels('brook').every((id) => !LEVELS[id].mats.includes('twine') && !LEVELS[id].mats.includes('bamboo')), 'Willow Brook is twigs and planks only');
  ok(LEVELS.r1.mats.includes('twine') && !LEVELS.r1.mats.includes('bamboo') && LEVELS.r4.mats.includes('bamboo'), 'twine in the ravine, bamboo from Bamboo Grove');
  ok(LEVEL_IDS.some((id) => LEVELS[id].boat) && LEVEL_IDS.some((id) => LEVELS[id].wind) && LEVEL_IDS.some((id) => LEVELS[id].vehicles.includes('wagon')), 'the boat, the wind and the wagon all turn up');
  ok(LEVELS.m4.anchors.some(([x, y]) => x === 12 && y === 3) && LEVELS.c3.anchors.some(([x, y]) => x === 0 && y === 3), 'a climb and a descent');
  ok(LEVELS.m5.grounds.some((g) => g.kind === 'island'), 'two crossings in one');
  const fin = LEVELS[LEVEL_IDS[23]];
  ok(fin.name === 'The Great Canyon' && fin.wind && fin.vehicles.includes('wagon'), 'the finale: the great canyon, the wind and the wagon');
  eq(SANDBOX.budget, 99999, 'the sandbox has no real budget');
  eq(SANDBOX.mats, MATS, 'every material in the sandbox');
}

// ---- costs and medals
{
  eq(memberCost('twig', 2), 20, 'twig: 10 a unit');
  eq(memberCost('plank', 2), 36, 'plank: 18 a unit');
  eq(memberCost('twine', 8), 40, 'twine: 5 a unit');
  eq(memberCost('bamboo', 4), 104, 'bamboo: 26 a unit');
  eq(memberCost('twig', Math.hypot(2, 2)), 28, 'a diagonal is rounded once');
  eq(designCost([P(0, 0, 2, 0), P(0, -2, 2, 0, 'twig')]), 36 + 28, 'a design costs the sum of its members');
  const L = LEVELS.b1;
  eq(medalsFor(L, L.master), 3, 'at the master price, three acorns');
  eq(medalsFor(L, L.master + 1), 2, 'just over, two');
  eq(medalsFor(L, L.thrifty), 2, 'at the thrifty price, two');
  eq(medalsFor(L, L.budget), 1, 'within the budget, one');
  eq(medalsFor(L, L.budget + 1), 0, 'over the budget, none');
  ok(compLimit('twig', 2) === MAT.twig.comp && compLimit('twig', 3) < compLimit('twig', 2), 'long members buckle sooner');
  eq(compLimit('twine', 3), 0, 'twine takes no push at all');
  ok(MAT.twine.tens > MAT.twig.tens && MAT.bamboo.tens > MAT.plank.tens && MAT.bamboo.cost > MAT.twig.cost, 'twine pulls hard; bamboo is strongest and dearest');
  ok(MATS.every((m) => MAT[m].key === String(MATS.indexOf(m) + 1)), 'keys 1 to 4 pick the materials');
}

// ---- the builder
{
  const L = LEVELS.b1, b = new Builder(L);
  ok(!b.check(2, 0, 4, 0, 'plank').ok, 'a member has to start at a joint or an anchor');
  eq(b.place(0, 0, 2, 0, 'plank'), 1, 'a plank from an anchor');
  ok(b.hasNode(2, 0), 'its far end is a new joint');
  eq(b.place(0, 0, 2, 0, 'plank'), 0, 'not twice');
  eq(b.place(2, 0, 0, 0, 'twig'), 0, 'nor the same pair the other way round');
  eq(b.target(0, 0, 9, 0, 'plank').x, 2, 'a drag past a plank’s reach stops at 2.5, on the grid');
  eq(b.target(0, 0, 9, 0, 'twig').x, 3, 'twigs reach 3');
  eq(b.target(0, 0, 1.2, 0.9, 'twig'), { x: 1, y: 1, check: { ok: true } }, 'snapped to the nearest grid point');
  eq(b.target(0, 0, 0, -1.2, 'twig').check.ok, false, 'no joints in the ground');
  ok(b.check(2, 0, 4, -2, 'twig').ok, 'an anchor in the bank is fine');
  eq(b.check(2, 0, 4, 0, 'twine').ok, false, 'no twine in Willow Brook');
  eq(b.check(0, 0, 0.5, 0, 'plank').ok, false, 'off the grid');
  ok(new Builder(LEVELS.m3).check(0, 1, 2, 1, 'plank').ok, 'the road over the boat lane is fine');
  eq(new Builder(LEVELS.m3).check(0, 0, 2, -2, 'twig').ok, true, 'next to the lane is fine');
  eq(new Builder(LEVELS.m3).check(0, 1, 5, -1, 'twine').why, 'Keep the boat’s way clear', 'nothing in the boat lane');
  eq(b.cost, 36, 'the cost follows the design');
  // undo and redo
  b.place(2, 0, 4, 0, 'plank'); b.place(0, -2, 2, 0, 'twig');
  eq(b.members.length, 3, 'three members');
  ok(b.undo() && b.undo(), 'two undos');
  eq(b.members.length, 1, 'back to one');
  ok(b.redo(), 'redo');
  eq(b.members.length, 2, 'two again');
  ok(b.canRedo, 'one more redo waiting');
  b.place(4, -2, 2, 0, 'twig');
  ok(!b.canRedo, 'a new member clears the redo stack');
  eq(b.members.map((m) => mkey(m.ax, m.ay, m.bx, m.by)), ['0,0|2,0', '2,0|4,0', '2,0|4,-2'], 'the right members');
  ok(b.clear() && b.members.length === 0, 'clear');
  ok(b.undo() && b.members.length === 3, 'undo brings it back');
  // removing
  eq(b.removeAt(b.pick(3, 0)), 1, 'pick and remove the plank under a point');
  ok(!b.hasNode(4, 0) || b.level.anchors.some(([x, y]) => x === 4 && y === 0), 'anchors stay');
  eq(b.removeNode(2, 0), 2, 'removing a joint removes its members');
  eq(b.members.length, 0, 'nothing left');
  eq(b.removeNode(0, 0), 0, 'an anchor with nothing on it');
  ok(b.undo() && b.members.length === 2, 'undo a joint removal');
}

// ---- mirror building
{
  const L = LEVELS.b2, b = new Builder(L); b.mirror = true;
  eq(L.mirror, 3, 'Puddle Hop mirrors about x = 3');
  eq(b.place(0, 0, 2, 0, 'plank'), 2, 'a plank and its twin');
  ok(b.index(6, 0, 4, 0) > 0, 'the twin on the far side');
  eq(b.place(2, 0, 4, 0, 'plank'), 1, 'a member across the middle is its own twin');
  eq(b.place(0, -2, 2, 0, 'twig'), 2, 'struts in pairs');
  ok(b.undo() && b.members.length === 3, 'one undo takes back both twins');
  eq(b.removeAt(b.members.findIndex((m) => m.ax === 0 && m.bx === 2)), 2, 'removing takes the twin too');
  b.mirror = false;
  eq(b.place(0, 0, 2, 0, 'plank'), 1, 'mirror off: one at a time');
}

// ---- the materials under load
{
  // twine pushed goes slack and the joint drops; a twig in the same place holds it up
  const L = SANDBOX;
  const tw = new Sim(L, [P(0, 0, 2, 0), P(0, -2, 2, 0, 'twine')]); stepFor(tw, 0.6);
  const j = tw.members[0].b;
  ok(tw.members[1].slack && tw.members[1].force === 0, 'twine pushed goes slack and takes nothing');
  ok(tw.y[j] < -0.3, 'so the joint it was meant to hold drops');
  const tg = new Sim(L, [P(0, 0, 2, 0), P(0, -2, 2, 0, 'twig')]); stepFor(tg, 0.6);
  ok(tg.members[1].force < -0.5 && Math.abs(tg.y[tg.members[0].b]) < 0.05, 'a twig in the same place is pushed, and holds');
  // twine pulled holds: the same joint hung from the post
  const th = new Sim(L, [P(0, 0, 2, 0), P(-1, 6, 2, 0, 'twine')]); stepFor(th, 0.6);
  ok(!th.members[1].slack && th.members[1].force > 0.5 && th.y[th.members[0].b] > -0.1, 'twine pulled holds the joint up');
  // a flat plank-only span over a long gap snaps; a plank-only deck sags and snaps even over the first brook
  for (const id of ['b1', 'b3', 'b6']) {
    const w = LEVELS[id].anchors.filter((a) => a[1] === 0).map((a) => a[0]).sort((a, b) => b - a)[0];
    const r = testDesign(LEVELS[id], deck(0, w));
    ok(r.outcome === 'splash' && r.broke > 0, `${id}: planks alone snap and the cart goes in (${r.outcome}, ${r.broke} broken)`);
  }
  // a simple truss holds
  const warren = [...deck(0, 6), P(0, 0, 1, -1, 'twig'), P(1, -1, 2, 0, 'twig'), P(2, 0, 3, -1, 'twig'), P(3, -1, 4, 0, 'twig'), P(4, 0, 5, -1, 'twig'), P(5, -1, 6, 0, 'twig'), P(1, -1, 3, -1, 'twig'), P(3, -1, 5, -1, 'twig')];
  const r = testDesign(LEVELS.b2, warren);
  ok(r.outcome === 'cross' && r.broke === 0 && r.peak < 1, `a simple truss holds (${r.outcome}, peak ${r.peak.toFixed(2)})`);
  // one triangle is enough on the first brook
  ok(testDesign(LEVELS.b1, [...deck(0, 4), P(0, -2, 2, 0, 'twig')]).outcome === 'cross', 'two planks and one twig cross the first brook');
  // nothing built: straight in
  eq(testDesign(LEVELS.b1, []).outcome, 'splash', 'with nothing built the cart rolls straight in');
  // the stress view: the ratio is the force over the limit
  const s = new Sim(LEVELS.b2, warren); stepFor(s, 3);
  for (let i = 0; i < s.members.length; i++) { const m = s.members[i]; if (m.alive && !m.slack) near(m.ratio, Math.abs(m.force) / s.limit(i), 1e-9, 'ratio = |force| / limit'); }
  ok(s.strain > 0 && s.strain < 1, 'the strain is the worst ratio');
}
function near(a, b, eps, msg) { ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`); }

// ---- determinism
{
  const L = LEVELS.r2, d = [...deck(0, 10), P(-1, 5, 2, 0, 'twine'), P(-1, 5, 4, 0, 'twine'), P(11, 5, 6, 0, 'twine'), P(11, 5, 8, 0, 'twine')];
  const a = testDesign(L, d), b = testDesign(L, d);
  eq(a.fp, b.fp, 'the same bridge twice: exactly the same end');
  eq(a.outcome, 'cross', 'and it crosses');
  const s = new Sim(L, d); let n = 0; while (!s.outcome && n < 4000) { s.step(); n++; }
  eq(s.fingerprint(), a.fp, 'stepping by hand matches a run');
  ok(a.t < TIME_LIMIT && a.t > SETTLE, 'it ends within the time limit');
  const c = testDesign(L, d.slice().reverse());
  eq(c.outcome, a.outcome, 'the order the members were built in does not change the outcome');
  const w = testDesign(LEVELS.c1, [...deck(0, 14)]), w2 = testDesign(LEVELS.c1, [...deck(0, 14)]);
  eq(w.fp, w2.fp, 'the wind is the same every time');
}

// ---- the vehicles
{
  const L = LEVELS.c2, s = new Sim(L, []);
  eq(s.vehicles.map((v) => v.kind), ['cart', 'wagon'], 'the cart leads, the wagon follows');
  ok(s.vehicles[1].x[1] < s.vehicles[0].x[0], 'the wagon starts behind the cart');
  stepFor(s, SETTLE - DT);
  ok(Math.abs(s.vehicles[0].x[0] - L.start) < 0.05, 'nothing moves while the bridge settles');
  s.run();
  eq(s.outcome, 'splash', 'with no bridge they go in');
  const ev = new Sim(LEVELS.b1, [...deck(0, 4), P(0, -2, 2, 0, 'twig')]); const kinds = [];
  while (!ev.outcome) { ev.step(); kinds.push(...ev.events.splice(0).map((e) => e.k)); }
  ok(kinds.includes('go') && kinds.includes('deck') && kinds.at(-1) === 'cross', 'go, onto the deck, across');
}

// ---- saves
{
  eq(SAVE_KEY, 'twig-twine-v1', 'the save key');
  const f = freshSave();
  eq(readSave(null), f, 'no save: a fresh one');
  for (const bad of ['{', 'null', '[]', '"x"', '{"v":2}', '{"v":1,"levels":7}', '{"v":1,"levels":{"b1":{"best":"x","medals":9,"design":[[0,0,2,0,99],"z",[0.5,0,2,0,1]],"crossed":true}}}']) {
    const s = readSave(bad);
    ok(s.v === 1 && typeof s.levels === 'object', `a corrupt save is read safely: ${bad}`);
  }
  const odd = readSave('{"v":1,"levels":{"b1":{"best":"x","medals":9,"design":[[0,0,2,0,1],[0,0,2,0,1],[0,0,9,0,1],[2,0,4,0,2]],"crossed":true},"zz":{"best":1}},"settings":{"sound":false,"mirror":true}}');
  eq(odd.levels.b1.design, [[0, 0, 2, 0, 1]], 'only valid, unique members survive (no twine in Willow Brook, nothing too long)');
  eq(odd.levels.b1.best, null, 'a best that isn’t a number is dropped');
  eq(odd.levels.b1.crossed, false, 'and with no best it isn’t counted as crossed');
  ok(!('zz' in odd.levels), 'unknown levels are ignored');
  ok(odd.settings.sound === false && odd.settings.mirror === true && odd.settings.music === true, 'settings read with defaults');
  eq(decode([[0, 0, 2, 0, 1], [0, 0, 2, 0], 'x', [0, 0, 2, 0, 7], [1e9, 0, 0, 0, 0]]), [P(0, 0, 2, 0)], 'decode keeps only good rows');
  // crossing records the best and the medals, which only ever go up
  const s = freshSave(), L = LEVELS.b1;
  const cheap = [...deck(0, 4), P(0, -2, 2, 0, 'twig')], dear = [...deck(0, 4), P(0, -2, 2, 0, 'twig'), P(4, -2, 2, 0, 'twig')];
  ok(!levelOpen(s, 'b2'), 'Puddle Hop waits for the first crossing');
  let r = recordCross(s, 'b1', dear);
  ok(r.first && r.medals === medalsFor(L, designCost(dear)), 'a first crossing');
  ok(crossed(s, 'b1') && levelOpen(s, 'b2'), 'crossing opens the next');
  r = recordCross(s, 'b1', cheap);
  ok(r.best && s.levels.b1.best === designCost(cheap), 'a cheaper bridge is a new best');
  eq(s.levels.b1.medals, medalsFor(L, designCost(cheap)), 'with its medals');
  recordCross(s, 'b1', dear);
  eq(s.levels.b1.best, designCost(cheap), 'a dearer one doesn’t lower the best');
  eq(s.levels.b1.medals, medalsFor(L, designCost(cheap)), 'nor the medals');
  eq(s.levels.b1.design, encode(dear), 'but the latest design is kept');
  eq(savedDesign(s, 'b1'), dear, 'and comes back');
  const back = readSave(JSON.stringify(s));
  eq(back.levels.b1, s.levels.b1, 'a save survives the round trip');
  eq(medalCount(back), s.levels.b1.medals, 'acorns counted');
  // regions open after four crossings of the one before; the sandbox after the whole first region
  const t = freshSave();
  for (const id of regionLevels('brook').slice(0, 3)) t.levels[id] = { best: 1, medals: 3, design: [], crossed: true };
  ok(!levelOpen(t, 'r1'), 'three crossings: the ravine waits');
  t.levels.b4 = { best: 1, medals: 1, design: [], crossed: true };
  ok(levelOpen(t, 'r1') && !levelOpen(t, 'r2') && levelOpen(t, 'b5'), 'four: the ravine opens');
  eq(regionCleared(t, 'brook'), 4, 'four crossed');
  ok(!sandboxOpen(t), 'the sandbox waits for all of Willow Brook');
  for (const id of regionLevels('brook')) t.levels[id] = { best: 1, medals: 1, design: [], crossed: true };
  ok(sandboxOpen(t), 'and then opens');
  // crossing the finale ends the story, once
  const e = freshSave(), fin = LEVEL_IDS[23], some = deck(0, 4);
  ok(recordCross(e, fin, some).finale && e.ended, 'the finale crossed: the ending');
  ok(!recordCross(e, fin, some).finale, 'only the first time');
  const over = freshSave(), big = Array.from({ length: 12 }, (_, i) => P(2 * i, 0, 2 * i + 2, 0)).concat(Array.from({ length: 30 }, (_, i) => P(i % 24, -4, (i % 24) + 1, -1, 'bamboo')));
  ok(designCost(big) > LEVELS[fin].budget, 'a very dear bridge');
  const ro = recordCross(over, fin, big);
  ok(ro.medals === 0 && !ro.finale && !crossed(over, fin) && !over.ended, 'crossing over budget earns no acorn and no ending');
}

console.log(`bridges: ${checks} checks passed`);
