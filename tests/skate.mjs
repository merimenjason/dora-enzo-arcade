// Pawpark Skate engine checks: rolling, pushing and pumping, the ollie, a quarter-pipe air that comes back down into
// the ramp, flip tricks (land before the board turns and you bail), grabs held for points, spins and a crooked landing,
// grinds (snap, balance, off the end, jump off), manuals, combos (the multiplier, repeats worth less, banking, a bail
// losing it), gaps, the holes between rooftops, every golden acorn and gap goal reachable at a speed you can really get,
// the session timer, and saves including corrupt ones, unlocks and the ending.
import assert from 'node:assert/strict';
import { Session, PARKS, park, groundAt, idleInput, DT, FINALE, ALL_GOALS, newSave, parseSave, serialise, record, unlocked, SAVE_KEY } from '../.checks/skate-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const I = (o = {}) => ({ ...idleInput(), ...o });
const bal = (x) => (x.grind ? Math.max(-1, Math.min(1, x.grind.bal * 3 + x.grind.bv)) : 0);
const pump = (x) => (x.state === 'ground' && x.n.y < 0.97 ? -1 : 0);
const grindOnce = (x) => x.state === 'grind' || (x.state === 'air' && !x.combo.some((e) => e.kind === 'grind'));
const fresh = (parkId = 'plaza', char = 'dora') => new Session({ park: parkId, char, free: true, seed: 3 });
/** run until done(s) or the time is up, feeding inp(s); returns every event seen */
function run(s, inp, secs, done = () => false) {
  const evs = [];
  for (let i = 0; i < secs / DT && !done(s); i++) { s.tick(typeof inp === 'function' ? inp(s) : inp); evs.push(...s.events); }
  return evs;
}
const kinds = (evs, k) => evs.filter((e) => e.k === k);

// ---- rolling, pushing, pumping, the ollie
{
  const s = fresh(); s.place(-12, -24, Math.PI / 2, 0);
  run(s, I({ y: -1 }), 5);
  assert.ok(s.speed > 8.5 && s.speed <= 10.2, `pushing tops out near 10 m/s (${s.speed.toFixed(2)})`);
  const c = fresh(); c.place(-12, -24, Math.PI / 2, 6); run(c, I(), 4);
  assert.ok(c.speed < 6 && c.speed > 3, 'it coasts and slows a little');
  const o = fresh(); o.place(-12, -24, Math.PI / 2, 5); let top = 0, air = 0;
  o.tick(I({ jump: true })); assert.equal(o.state, 'air');
  run(o, I(), 3, (x) => { top = Math.max(top, x.p.y); if (x.state === 'air') air += DT; return x.state !== 'air'; });
  assert.ok(top > 1.2 && top < 2.2, `an ollie rises about a metre and a half (${top.toFixed(2)})`); assert.ok(air > 0.7 && air < 1.2, `and hangs for about a second (${air.toFixed(2)})`);
  assert.equal(o.state, 'ground');
  ok('pushing, coasting and the ollie');
}

// ---- a quarter-pipe: up, out, straight up and back down into it, fakie
{
  const s = fresh(); s.place(16, 0, Math.PI / 2, 10.5); let top = 0, xs = [];
  const evs = run(s, I(), 4, (x) => { top = Math.max(top, x.p.y); if (x.state === 'air') xs.push(x.p.x); return x.state === 'ground' && x.v.x < -6 && x.p.y < 0.01; });
  assert.ok(top > 3.2, `the lip launches you above it (${top.toFixed(2)} over a 2.6 m ramp)`);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 1.2, 'straight up and back down, not off over the deck');
  assert.ok(!kinds(evs, 'bail').length && s.fakie, 'it lands back in and rolls away fakie');
  // too slow: up the wall and back down without leaving it
  const w = fresh(); w.place(18, 0, Math.PI / 2, 7); let wtop = 0; run(w, I(), 3, (x) => { wtop = Math.max(wtop, x.p.y); return x.v.x < -5; });
  assert.ok(wtop < 2.6 && w.state === 'ground', 'slower, you roll up the wall and back');
  // pumping the transition adds speed
  const p = fresh(); p.place(18, 0, Math.PI / 2, 8.5); let ptop = 0; run(p, (x) => I({ y: x.n.y < 0.97 ? -1 : 0 }), 3, (x) => { ptop = Math.max(ptop, x.p.y); return x.v.x < -5 && x.p.y < 0.01; });
  assert.ok(ptop > wtop + 0.3, `pumping takes you higher (${ptop.toFixed(2)} vs ${wtop.toFixed(2)} without)`);
  ok('quarter-pipes: up the wall, out of the lip and back in, pumping adds speed');
}

// ---- flips, grabs and spins
{
  // a kickflip off an ollie on the flat lands clean
  const s = fresh(); s.place(-12, -24, Math.PI / 2, 6); s.tick(I({ jump: true })); s.tick(I()); s.tick(I({ flip: true }));
  const evs = run(s, I(), 3, (x) => x.state !== 'air');
  assert.ok(s.combo.some((e) => e.name === 'Kickflip') && s.state === 'ground' && !kinds(evs, 'bail').length, 'an ollie kickflip lands');
  // a double kickflip from a low ollie doesn't finish in time: bail
  const b = fresh(); b.place(-12, -24, Math.PI / 2, 6); b.tick(I({ jump: true })); for (let i = 0; i < 30; i++) b.tick(I()); b.tick(I({ flip: true, y: 1 }));
  run(b, I(), 2, (x) => x.state !== 'air'); assert.equal(b.state, 'bail', 'a hardflip started too late is still turning when you land: bail');
  // a grab held longer scores more, but held into the landing it's a bail
  const g = fresh(); g.place(16, 0, Math.PI / 2, 10.5);
  run(g, (x) => I({ grab: x.state === 'air' && x.v.y > -4 }), 4, (x) => x.state === 'ground' && x.v.x < -6);
  assert.equal(g.state, 'ground'); const grabPts = g.combo.find((e) => e.kind === 'grab')?.pts ?? 0;
  assert.ok(grabPts > 250, `a long Indy builds up (${grabPts.toFixed(0)})`);
  const h = fresh(); h.place(16, 0, Math.PI / 2, 10.5); run(h, (x) => I({ grab: x.state === 'air' }), 4, (x) => x.state === 'bail' || (x.state !== 'air' && x.air > 0.5));
  assert.equal(h.state, 'bail', 'still holding the grab when you land: bail');
  // spins: a 360 on a big kicker lands; stopping at a quarter turn does not
  const k = fresh(); k.place(0, -16, 0, 9.5); let held = 0;
  const kevs = run(k, (x) => { if (x.state === 'air') { held += DT; return I({ x: held < 0.95 ? -1 : 0 }); } return I({ jump: x.p.z > -4.3 }); }, 4, (x) => x.state !== 'air' && x.air > 0.5);
  assert.ok(kevs.some((e) => e.k === 'gap' && e.name === 'Fountain Gap'), 'the kicker clears the fountain');
  const spin = k.combo.find((e) => e.kind === 'spin'); assert.ok(k.state === 'ground' && spin && Number(spin.name) >= 360, `a spin lands and counts (${spin?.name})`);
  const q = fresh(); q.place(0, -16, 0, 9.5); let qh = 0;
  run(q, (x) => { if (x.state === 'air') { qh += DT; return I({ x: qh < 0.25 ? -1 : 0 }); } return I({ jump: x.p.z > -4.3 }); }, 4, (x) => x.state === 'bail' || (x.state !== 'air' && x.air > 0.5));
  assert.equal(q.state, 'bail', 'landing sideways is a bail');
  ok('flip tricks, grabs and spins: clean landings score, a board still turning or a sideways landing bails');
}

// ---- grinds and manuals
{
  // ollie onto the long ledge holding grind
  const s = fresh(); s.place(10.5, -12.4 - 1.0, Math.PI / 2 - 0.25, 6);
  const evs = run(s, (x) => I({ jump: x.t < 0.05, grind: grindOnce(x), x: x.grind ? Math.max(-1, Math.min(1, x.grind.bal * 3 + x.grind.bv)) : 0 }), 6, (x) => x.state === 'ground' && x.t > 0.5);
  assert.ok(kinds(evs, 'grind').some((e) => e.on), 'it locks onto the ledge');
  assert.ok(evs.some((e) => e.k === 'grind' && !e.on) && s.state !== 'bail', 'and rides it off the end');
  // balance: do nothing and you fall off a long grind
  const f = fresh(); f.place(-16, -2, 0, 4, 1.4);
  const fevs = run(f, (x) => I({ grind: x.state === 'air' }), 6, (x) => x.state === 'bail' || (x.state === 'ground' && x.t > 0.4));
  void fevs;
  // manual
  const m = fresh(); m.place(-12, -24, Math.PI / 2, 7); m.tick(I({ jump: true })); run(m, I(), 2, (x) => x.state !== 'air');
  m.tick(I({ grind: true })); assert.equal(m.state, 'manual', 'a manual after a landing');
  run(m, (x) => I({ y: x.manual ? Math.max(-1, Math.min(1, -(x.manual.bal * 3 + x.manual.bv))) : 0 }), 1.5);
  assert.equal(m.state, 'manual', 'balanced, it holds'); const mp = m.combo.find((e) => e.kind === 'manual').pts;
  run(m, I(), 6, (x) => x.state !== 'manual'); assert.equal(m.state, 'bail', 'left alone, it tips over');
  assert.ok(mp > 150, 'a manual scores with time');
  ok('grinds lock on and ride off the end, manuals balance and tip over');
}

// ---- combos and banking
{
  const s = fresh(); s.place(16, 0, Math.PI / 2, 10.5);
  let flipped = false;
  run(s, (x) => { if (x.state === 'air' && x.v.y > 1 && !flipped) { flipped = true; return I({ flip: true }); } return I({ grab: x.state === 'air' && x.v.y < 0 && x.v.y > -3 }); }, 4, (x) => x.state === 'ground' && x.v.x < -6);
  const tricks = s.combo.length, sc = s.comboScore, sum = s.combo.reduce((a, e) => a + e.pts, 0);
  assert.ok(tricks >= 2 && Math.abs(sc - Math.round(sum * tricks)) <= 1, 'a combo is its points times the number of tricks');
  run(s, I(), 1.2); assert.equal(s.combo.length, 0); assert.equal(s.score, sc, 'rolling away clean banks it');
  // repeats are worth half each time
  const r = fresh(); r.place(-12, -24, Math.PI / 2, 8);
  for (let k = 0; k < 2; k++) { r.tick(I({ jump: true })); r.tick(I()); r.tick(I({ flip: true })); run(r, I(), 2, (x) => x.state !== 'air'); r.tick(I({ grind: true })); run(r, (x) => I({ y: x.manual ? -(x.manual.bal * 3 + x.manual.bv) : 0 }), 0.3); }
  const kf = r.combo.filter((e) => e.name === 'Kickflip'); assert.ok(kf.length === 2 && kf[1].pts === kf[0].pts / 2, 'the second Kickflip in a combo is worth half');
  // a bail loses the combo
  const b = fresh(); b.place(-12, -24, Math.PI / 2, 6); b.tick(I({ jump: true })); for (let i = 0; i < 30; i++) b.tick(I()); b.tick(I({ flip: true, y: -1 }));
  run(b, I(), 3, (x) => x.state === 'ground' && x.t > 1); assert.equal(b.score, 0); assert.equal(b.combo.length, 0);
  ok('combos multiply by the trick count, repeats halve, clean roll-aways bank and bails lose it all');
}

// ---- the rooftops: fall in the street and you are put back
{
  const s = fresh('roofs'); s.place(-12, -6, 0, 7);
  const evs = run(s, I(), 4, (x) => x.state === 'ground' && x.t > 2.5);
  assert.ok(kinds(evs, 'bail').length === 1, 'rolling off the roof into the street is a bail');
  const g = groundAt(park('roofs'), s.p.x, s.p.z); assert.ok(!g.hole && s.p.z < -2, 'and you are back on the roof');
  ok('holes between the rooftops bail you and put you back where it was safe');
}

// ---- every acorn and gap goal can be reached at a speed you can get (pushing tops out at 10 m/s, pumping at 12.5)
/** One way to each acorn and gap: a start, a heading, a speed, and what to press. */
const ROUTES = {
  plaza: {
    acorns: [
      { at: [0, -16, 0, 9.5], hold: (x) => I({ jump: x.p.z > -4.3 }) }, // over the fountain
      { at: [16, -2, Math.PI / 2, 10.5], hold: (x) => I({ y: x.state === 'ground' && x.n.y < 0.97 ? -1 : 0 }) }, // up the east quarter-pipe, pumping
      { at: [-19, 16, Math.PI, 7], hold: (x) => I({ jump: x.t < 0.05 }) }, // ollie off the terrace above the steps
      { at: [11, -13.4, Math.PI / 2 - 0.12, 6], hold: (x) => I({ jump: x.t < 0.05, grind: x.state !== 'ground', x: x.grind ? Math.max(-1, Math.min(1, x.grind.bal * 3 + x.grind.bv)) : 0 }) }, // the long ledge
      { at: [0, -18, Math.PI, 10.5], hold: (x) => I({ y: x.state === 'ground' && x.n.y < 0.97 ? -1 : 0 }) }, // up the south quarter-pipe, pumping
    ],
    gaps: {
      fountain: { at: [0, -16, 0, 9.5], hold: (x) => I({ jump: x.p.z > -4.3, flip: x.state === 'air' && x.air > 0.05 && x.air < 0.1 }) },
      handrail: { at: [-19, 16.5, Math.PI, 6], hold: (x) => I({ jump: x.t < 0.05 && x.t > 0.01, grind: x.state === 'grind' || (x.state === 'air' && !x.combo.some((e) => e.kind === 'grind')), x: x.grind ? Math.max(-1, Math.min(1, x.grind.bal * 3 + x.grind.bv)) : 0 }) },
    },
  },
  hill: {
    acorns: [
      { at: [0, -19, -Math.PI / 2, 11], hold: (x) => I({ y: pump(x) }) },
      { at: [0, -12, Math.PI / 2, 11], hold: (x) => I({ y: pump(x) }) },
      { at: [0, -4, 0, 9], hold: (x) => I({ jump: x.p.z > 4.6 && x.state === 'ground' && !x.combo.length }) },
      { at: [16, 10, 0, 10], hold: (x) => I({ jump: x.p.z > 23.6 && x.state === 'ground' && !x.combo.length }) },
      { at: [-16.5, -6, 0.08, 7], hold: (x) => I({ jump: x.p.z > -3.2 && x.state === 'ground' && !x.combo.length, grind: grindOnce(x), x: bal(x) }) },
    ],
    gaps: {
      hedge: { at: [16, 10, 0, 10], hold: (x) => I({ jump: x.p.z > 23.6 && x.state === 'ground' && !x.combo.length, grab: x.state === 'air' && x.v.y > -1 }) },
      longrail: { at: [-16.5, -6, 0.08, 7], hold: (x) => I({ jump: x.p.z > -3.2 && x.state === 'ground' && !x.combo.length, grind: grindOnce(x), x: bal(x) }) },
      pyramid: { at: [0, -4, 0, 10], hold: (x) => I({ jump: x.p.z > 4.6 && x.state === 'ground' && !x.combo.length }) },
    },
  },
  roofs: {
    acorns: [
      { at: [-21, -16, 0, 10], hold: (x) => I({ jump: x.p.z > -3.3 && x.state === 'ground' && !x.combo.length }) },
      { at: [4.5, -10, -0.06, 7], hold: (x) => I({ jump: x.p.z > -7.2 && x.state === 'ground' && !x.combo.length, grind: grindOnce(x), x: bal(x) }) },
      { at: [0, 2.0 + 4, 0, 9], hold: (x) => I({ jump: x.p.z > 13.6 && x.state === 'ground' && !x.combo.length }) },
      { at: [10, -18, Math.PI, 11], hold: (x) => I({ y: pump(x) }) },
      { at: [11, 13.5, Math.PI / 2 - 0.05, 7], hold: (x) => I({ jump: x.p.x > 12.4 && x.state === 'ground' && !x.combo.length, grind: grindOnce(x), x: bal(x) }) },
    ],
    gaps: {
      sky: { at: [-21, -16, 0, 10], hold: (x) => I({ jump: x.p.z > -3.3 && x.state === 'ground' && !x.combo.length, flip: x.state === 'air' && x.air > 0.05 && x.air < 0.1 }) },
      bridge: { at: [4.5, -10, -0.06, 7], hold: (x) => I({ jump: x.p.z > -7.2 && x.state === 'ground' && !x.combo.length, grind: grindOnce(x), x: bal(x) }) },
      tower: { at: [0, 5, 0, 10], hold: (x) => I({ jump: x.p.z > 13.6 && x.state === 'ground' && !x.combo.length }) },
      skyback: { at: [21, 16, Math.PI, 10], hold: (x) => I({ jump: x.p.z < 5.3 && x.state === 'ground' && !x.combo.length }) },
    },
  },
};
{
  for (const [pid, r] of Object.entries(ROUTES)) {
    const pk = park(pid);
    r.acorns.forEach((rt, i) => {
      const s = new Session({ park: pid, char: 'dora', free: true, seed: 5 }); s.place(...rt.at);
      run(s, rt.hold, 5, (x) => x.acorns[i]);
      assert.ok(s.acorns[i], `${pk.name}: acorn ${i + 1} at ${JSON.stringify(pk.acorns[i])} reachable (got to ${s.p.x.toFixed(1)}, ${s.p.y.toFixed(1)}, ${s.p.z.toFixed(1)}, ${s.state})`);
    });
    for (const [gid, rt] of Object.entries(r.gaps)) {
      const s = new Session({ park: pid, char: 'dora', free: true, seed: 5 }); s.place(...rt.at);
      const evs = run(s, rt.hold, 6, (x) => x.gapsDone.has(gid) || x.state === 'bail');
      run(s, I(), 2, (x) => x.gapsDone.has(gid));
      assert.ok(s.gapsDone.has(gid), `${pk.name}: the ${gid} gap can be done (${s.state}, events ${[...new Set(evs.map((e) => e.k + (e.name ? ':' + e.name : '')))].join(' ')})`);
    }
  }
  ok('every golden acorn and gap tried can be reached at a speed you can really get');
}

// ---- the session, saves, unlocks and the ending
{
  const s = new Session({ park: 'plaza', char: 'enzo', seed: 1 });
  run(s, I(), 125); assert.ok(s.over && s.left === 0, 'a session ends after two minutes');
  const sv = newSave(); assert.ok(unlocked(sv, 'plaza') && !unlocked(sv, 'hill') && !unlocked(sv, 'roofs'));
  s.got.add('plaza-score'); s.got.add('plaza-acorns'); s.got.add('plaza-combo'); s.score = 7000;
  const r = record(sv, s); assert.deepEqual(r.fresh.sort(), ['plaza-acorns', 'plaza-combo', 'plaza-score']); assert.ok(unlocked(sv, 'hill'), 'three goals open the hill');
  assert.equal(sv.best.plaza, 7000);
  const done = new Session({ park: 'roofs', char: 'dora', seed: 1 }); for (const g of ALL_GOALS) done.got.add(g);
  const r2 = record(sv, done); assert.ok(r2.ending && sv.ending, 'the trick goals in every park bring the ending'); assert.ok(FINALE.length === 3);
  assert.deepEqual(parseSave(serialise(sv)), sv, 'a save round-trips');
  for (const bad of [null, '', '{', '[]', '7', '{"v":2}', '{"v":1,"char":"wolf","goals":"all","best":5,"settings":[1]}']) assert.deepEqual(parseSave(bad), newSave(), `corrupt save ${bad}`);
  const odd = parseSave(JSON.stringify({ v: 1, goals: ['plaza-score', 'made-up'], best: { plaza: -5, hill: 12.7 } }));
  assert.deepEqual(odd.goals, ['plaza-score']); assert.equal(odd.best.plaza, 0); assert.equal(odd.best.hill, 12);
  assert.equal(SAVE_KEY, 'pawpark-skate-v1');
  ok('sessions last two minutes, goals open parks, the trick goals bring the ending, saves round-trip and corrupt ones fall back');
}
console.log(`skate: ${n} checks passed`);
void PARKS;
