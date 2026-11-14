// The Straits engine tests: steering and gears, the wind and the points of sail, port and starboard volleys, a raft
// sinking and what follows (otter power, bounty, loot, the cat hunter), each answer to Captain Bishan, Auntie Kera and
// Tok Tiong and how they bear on each other, docks, capsizing, a seed replaying exactly, the save, and an autopilot
// that lands the hay on Pulau Ubin. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { newGame, step, choose, talkOf, dockAction, dockOptions, leaveDock, result, parseSave, freshSave, recordVoyage, sailFactor, pointOfSail, offWind, NO_INPUT, DT, SPEEDS, HERO, KELONG, DOCKS, ISLANDS, ENCOUNTERS, forward, starboard } from '../.checks/straits-game.js';

let n = 0; const fails = [];
const test = (name, fn) => { try { fn(); n++; } catch (e) { fails.push(name); console.error(`FAIL ${name}\n  ${e.message.split('\n')[0]}`); } };
const run = (g, inp, secs) => { for (let i = 0; i < Math.round(secs / DT) && g.phase === 'sail'; i++) step(g, { ...NO_INPUT, ...inp }); };
const tap = (g, inp) => step(g, { ...NO_INPUT, ...inp });
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/** Sail to each waypoint in turn; answers Captain Bishan with `answer` and stops when the phase leaves 'sail'. */
function autopilot(g, pts, answer = 'bargain', limit = 400) {
  let i = 0;
  for (let k = 0; k < limit / DT && i < pts.length; k++) {
    if (g.phase === 'talk') { choose(g, answer); continue; }
    if (g.phase !== 'sail') break;
    const [tx, tz] = pts[i], d = Math.hypot(tx - g.x, tz - g.z), last = i === pts.length - 1;
    if (d < (last ? 2.5 : 3)) { i++; continue; }
    const diff = wrap(Math.atan2(tx - g.x, tz - g.z) - g.h), wantGear = last && d < 9 ? 1 : 3;
    step(g, { ...NO_INPUT, turn: Math.max(-1, Math.min(1, -diff * 3)), faster: g.gear < wantGear, slower: g.gear > wantGear });
  }
}
const ROUTE = [[12, -46], [25, -37], [36, -20], [50, -2], [57, 22], [54, 40], [55.5, 48.5]];
/** Hold the wind dead astern of the starting heading, so speeds are the plain gear speeds. */
const fair = g => { g.windHeld = true; g.wind = g.windTo = g.h; return g; };
const quiet = hero => { const g = fair(newGame(7, hero ?? 'dora')); g.foes.length = 0; return g; };
const at = (g, id) => { const e = ENCOUNTERS.find(k => k.id === id); g.x = e.x; g.z = e.z + (id === 'bishan' ? 11 : 5); step(g, { ...NO_INPUT }); return g; };

test('gears set the speed, and the boat takes a moment to reach it', () => {
  const g = quiet(); tap(g, { faster: true }); tap(g, { faster: true }); assert.equal(g.gear, 2);
  run(g, {}, 0.2); assert.ok(g.v > 0 && g.v < SPEEDS[2]);
  run(g, {}, 4); assert.ok(Math.abs(g.v - SPEEDS[2]) < 0.01);
  for (let i = 0; i < 5; i++) tap(g, { faster: true }); assert.equal(g.gear, 3);
  for (let i = 0; i < 5; i++) tap(g, { slower: true }); assert.equal(g.gear, 0);
});
test('right rudder turns the bow to starboard, and Dora turns faster than Enzo', () => {
  const d = quiet('dora'), e = quiet('enzo');
  for (const g of [d, e]) { tap(g, { faster: true }); tap(g, { faster: true }); run(g, {}, 3); }
  const [sx, sz] = starboard(d.h), x0 = d.x, z0 = d.z; run(d, { turn: 1 }, 1.5); run(e, { turn: 1 }, 1.5);
  assert.ok((d.x - x0) * sx + (d.z - z0) * sz > 0, 'moved to starboard');
  assert.ok(Math.abs(d.h) > Math.abs(e.h));
});
test('the mainland, the islands and the edge of the sea stop the boat', () => {
  const g = quiet(); g.h = Math.PI; tap(g, { faster: true }); tap(g, { faster: true }); tap(g, { faster: true }); run(g, {}, 10);
  assert.ok(g.z >= -80);
  const s = ISLANDS[0]; g.x = s.x + s.r + 6; g.z = s.z; g.h = -Math.PI / 2; run(g, {}, 6);
  assert.ok(Math.hypot(g.x - s.x, g.z - s.z) >= s.r + 0.89);
});
test('a volley goes off the side facing the foe, and three volleys sink a raft', () => {
  const g = newGame(3, 'dora'); const f = g.foes[0]; for (const o of g.foes.slice(1)) o.alive = false;
  const [sx, sz] = starboard(g.h); f.x = g.x - sx * 5; f.z = g.z - sz * 5; f.path = [];
  tap(g, { fire: true }); assert.equal(g.shots.filter(s => s.mine).length, 3);
  assert.ok(g.shots[0].vx * -sx + g.shots[0].vz * -sz > 0, 'fired to port, where the raft is');
  for (let i = 0; i < 6 && g.foes.includes(f) && f.alive; i++) { run(g, {}, HERO.dora.reload + 0.05); f.x = g.x - sx * 5; f.z = g.z - sz * 5; tap(g, { fire: true }); }
  run(g, {}, 1);
  assert.ok(!g.foes.includes(f)); assert.equal(g.sunk, 1); assert.equal(g.power, 85); assert.equal(g.bounty, 1); assert.equal(g.crates.length, 1);
  g.x = g.crates[0].x; g.z = g.crates[0].z; tap(g, {}); assert.ok(g.seeds >= 4); assert.equal(g.crates.length, 0);
});
test('a second raft sunk brings a cat hunter, and paying the bounty calls it off', () => {
  const g = newGame(3, 'dora'); g.foes[0].hp = 1; g.foes[1].hp = 1;
  for (const f of g.foes.slice(0, 2)) { f.x = g.x + 3; f.z = g.z; f.path = []; g.shots.push({ x: f.x, z: f.z, vx: 0, vz: 0, ttl: 1, mine: true, dmg: 5 }); }
  tap(g, {}); assert.equal(g.bounty, 2); assert.ok(g.foes.some(f => f.kind === 'hunter'));
  g.phase = 'dock'; g.seeds = 8; assert.equal(dockOptions(g).bounty.cost, 8); assert.ok(dockAction(g, 'bounty'));
  assert.equal(g.bounty, 0); assert.equal(g.seeds, 0); leaveDock(g); tap(g, {}); assert.ok(!g.foes.some(f => f.kind === 'hunter'));
});
test('otter power at 40 brings Captain Bishan out; sinking him opens the strait', () => {
  const g = newGame(5, 'enzo'); g.power = 55; const f = g.foes[0]; f.hp = 1; f.x = g.x + 3; f.path = [];
  g.shots.push({ x: f.x, z: f.z, vx: 0, vz: 0, ttl: 1, mine: true, dmg: 5 }); tap(g, {});
  const b = g.foes.find(k => k.kind === 'bishan'); assert.ok(b, 'Bishan cast off'); assert.equal(g.stance, 'hostile');
  b.hp = 1; g.shots.push({ x: b.x, z: b.z, vx: 0, vz: 0, ttl: 1, mine: true, dmg: 5 }); tap(g, {});
  assert.ok(g.bishanDown); assert.equal(g.power, 0); assert.equal(g.stance, 'calm');
});
test('sailing near the kelong opens the conversation once', () => {
  const g = quiet(); g.x = KELONG.x; g.z = KELONG.z + 11; tap(g, {}); assert.equal(g.phase, 'talk');
  assert.equal(choose(g, 'bargain'), true); assert.equal(g.phase, 'sail'); tap(g, {}); assert.equal(g.phase, 'sail');
  assert.equal(choose(g, 'fight'), false);
});
test('bargain costs a quarter of the hay and calms the rafts', () => {
  const g = newGame(9, 'dora'); g.x = KELONG.x; g.z = KELONG.z + 11; tap(g, {}); choose(g, 'bargain');
  assert.equal(g.hay, 75); assert.equal(g.stance, 'calm');
  const f = g.foes[0]; f.x = g.x + 5; f.z = g.z; f.path = []; const hull = g.hull; run(g, {}, 6);
  assert.equal(g.hull, hull); assert.equal(f.chasing, false);
});
test('fight brings Bishan out at once; a bluff either works or does the same', () => {
  const g = quiet(); g.x = KELONG.x; g.z = KELONG.z + 11; tap(g, {}); choose(g, 'fight');
  assert.ok(g.foes.some(f => f.kind === 'bishan')); assert.equal(g.hay, 100);
  let won = 0, lost = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const b = newGame(seed, 'dora'); b.foes.length = 0; b.x = KELONG.x; b.z = KELONG.z + 11; tap(b, {}); choose(b, 'bluff');
    assert.equal(b.hay, 100);
    if (b.bluffed) { won++; assert.equal(b.stance, 'calm'); assert.ok(!b.foes.some(f => f.kind === 'bishan')); } else { lost++; assert.ok(b.foes.some(f => f.kind === 'bishan')); }
  }
  assert.ok(won > 12 && lost > 4, `bluff is a real gamble (${won} worked, ${lost} failed)`);
});
test('a dock repairs and upgrades for seeds, and a viewpoint island reveals the map', () => {
  const g = quiet(); const d = DOCKS.find(k => k.id === 'sentosa'); g.x = d.x; g.z = d.z - 1; g.hull = 40; g.seeds = 30;
  tap(g, {}); assert.equal(g.talkId, 'kera'); assert.ok(choose(g, 'decline'));
  tap(g, { act: true }); assert.equal(g.phase, 'dock'); assert.equal(g.lastDock, 'sentosa'); assert.equal(g.found.length, ISLANDS.length + 1);
  assert.equal(dockOptions(g).repair.cost, 6); assert.ok(dockAction(g, 'repair')); assert.equal(g.hull, 100); assert.equal(g.seeds, 24);
  assert.ok(dockAction(g, 'hull')); assert.equal(g.maxHull, 125); assert.ok(dockAction(g, 'volley')); assert.equal(g.volley, 16); assert.equal(g.seeds, 4);
  assert.equal(dockAction(g, 'hull'), false, 'cannot afford a second plank');
  leaveDock(g); assert.equal(g.phase, 'sail');
});
test('capsizing costs hay and half the seeds and puts you back at the last dock; no hay left ends the voyage', () => {
  const g = quiet(); g.x = 40; g.z = 40; g.seeds = 9; g.hull = 1; g.shots.push({ x: g.x, z: g.z, vx: 0, vz: 0, ttl: 1, mine: false, dmg: 5 }); tap(g, {});
  assert.equal(g.capsizes, 1); assert.equal(g.hay, 85); assert.equal(g.seeds, 4); assert.ok(Math.hypot(g.x, g.z + 75) < 6); assert.equal(g.hull, 60);
  g.hay = 10; g.hull = 1; g.shots.push({ x: g.x, z: g.z, vx: 0, vz: 0, ttl: 1, mine: false, dmg: 5 }); tap(g, {});
  assert.equal(g.phase, 'lost'); assert.equal(g.hay, 0);
});
test('bracing takes most of the sting out of a hit', () => {
  const a = quiet(), b = quiet();
  for (const [g, brace] of [[a, false], [b, true]]) { g.shots.push({ x: g.x, z: g.z, vx: 0, vz: 0, ttl: 1, mine: false, dmg: 10 }); tap(g, { brace }); }
  assert.equal(a.hull, 90); assert.equal(b.hull, 96);
});
test('ramming a raft at speed hurts it far more than it hurts you', () => {
  const g = fair(newGame(2, 'enzo')); const f = g.foes[0]; for (const o of g.foes.slice(1)) o.alive = false; f.path = [];
  tap(g, { faster: true }); tap(g, { faster: true }); run(g, {}, 2); const [fx, fz] = forward(g.h); f.x = g.x + fx * 4; f.z = g.z + fz * 4;
  tap(g, { ram: true }); run(g, {}, 1.2);
  assert.ok(!g.foes.includes(f) || f.hp <= 0, 'Enzo sinks a raft with one ram'); assert.ok(g.hull >= HERO.enzo.hull - 20);
});
test('the sail likes the wind across it, makes little of it close-hauled and almost nothing head on; rowing ignores it', () => {
  assert.equal(sailFactor(0, 0, 3), 1); assert.ok(Math.abs(sailFactor(1.2, 0, 3) - 1.15) < 1e-9); assert.ok(sailFactor(2.4, 0, 3) < 0.71); assert.ok(sailFactor(Math.PI, 0, 3) <= 0.31);
  assert.equal(sailFactor(Math.PI, 0, 1), 1); assert.equal(sailFactor(-1.2, 0, 2), sailFactor(1.2, 0, 2));
  assert.deepEqual([0, 1.5, 2.3, 3].map(a => pointOfSail(a, 0)), ['RUNNING', 'REACHING', 'BEATING', 'IN IRONS']); assert.ok(Math.abs(offWind(0.2, -0.2) - 0.4) < 1e-9);
  const speed = wind => { const g = quiet(); g.x = -80; g.z = -60; g.wind = g.windTo = wind; for (let i = 0; i < 3; i++) tap(g, { faster: true }); run(g, {}, 6); return g.v; };
  const runV = speed(0), reach = speed(1.3), irons = speed(Math.PI);
  assert.ok(reach > runV && runV > irons * 2.5, `reach ${reach.toFixed(2)} > run ${runV.toFixed(2)} > in irons ${irons.toFixed(2)}`);
  const row = (() => { const g = quiet(); g.x = -80; g.z = -60; g.wind = g.windTo = Math.PI; tap(g, { faster: true }); run(g, {}, 4); return g.v; })(); assert.ok(row > irons, 'into the wind, rowing beats full sail');
});
test('the wind veers on its own until Tok Tiong holds it', () => {
  const g = newGame(21, 'dora'); g.foes.length = 0; const w0 = g.wind; run(g, {}, 60); assert.notEqual(g.wind, w0);
  const h = quiet(); const w1 = h.wind; run(h, {}, 60); assert.equal(h.wind, w1);
});
test('port and starboard reload on their own, and each fires its own way', () => {
  const g = quiet(); const [sx, sz] = starboard(g.h); tap(g, { firePort: true, fireStar: true });
  assert.equal(g.shots.length, 6); assert.ok(g.reloadP > 0 && g.reloadS > 0);
  assert.ok(g.shots.slice(0, 3).every(s => s.vx * sx + s.vz * sz < 0), 'the first three go to port'); assert.ok(g.shots.slice(3).every(s => s.vx * sx + s.vz * sz > 0), 'the next three to starboard');
  tap(g, { firePort: true }); assert.equal(g.shots.length, 6, 'port is still reloading');
  run(g, {}, HERO.dora.reload + 0.05); tap(g, { fireStar: true }); assert.equal(g.shots.filter(s => s.ttl > 0.7).length, 3); assert.equal(g.reloadP, 0);
});
test('each conversation opens once, and Bishan does not hail once he has cast off', () => {
  const g = quiet(); at(g, 'kera'); assert.equal(g.phase, 'talk'); assert.equal(talkOf(g).who, 'Auntie Kera'); choose(g, 'decline'); tap(g, {}); assert.equal(g.phase, 'sail');
  at(g, 'tiong'); assert.equal(talkOf(g).who, 'Tok Tiong'); assert.equal(choose(g, 'bargain'), false, 'not an answer he takes'); choose(g, 'shoo');
  const b = quiet(); b.power = 55; b.foes.push({ id: 99, kind: 'raft', x: b.x + 3, z: b.z, h: 0, hp: 1, max: 40, cool: 9, bump: 0, path: [], leg: 0, chasing: false, alive: true });
  b.shots.push({ x: b.x + 3, z: b.z, vx: 0, vz: 0, ttl: 1, mine: true, dmg: 5 }); tap(b, {}); assert.ok(b.foes.some(f => f.kind === 'bishan'));
  at(b, 'bishan'); assert.equal(b.phase, 'sail', 'no toll talk with his raft already out');
});
test('allying with the macaques arms the boat, sharpens the otters and rules out a bargain', () => {
  const g = newGame(4, 'dora'); fair(g); const f = g.foes[0]; g.foes.length = 1; f.path = []; at(g, 'kera'); assert.ok(choose(g, 'ally'));
  assert.equal(g.volley, 18); assert.ok(g.ally);
  f.x = g.x + 22; f.z = g.z; tap(g, {}); assert.ok(f.chasing, 'a raft 22 m off now sees you (17 m before)');
  g.foes.length = 0; at(g, 'bishan'); const t = talkOf(g); assert.ok(t.choices.find(c => c.id === 'bargain').no); assert.equal(choose(g, 'bargain'), false); assert.equal(g.phase, 'talk');
  assert.ok(choose(g, 'fight')); assert.match(result(g).how, /macaques/);
  const h = quiet(); at(h, 'bishan'); choose(h, 'bargain'); assert.equal(h.stance, 'calm'); at(h, 'kera'); choose(h, 'ally'); assert.equal(h.stance, 'hostile', 'the truce does not survive the mortar');
});
test('Auntie Kera buys a tenth of the bale, but not the last of it', () => {
  const g = quiet(); at(g, 'kera'); assert.ok(choose(g, 'trade')); assert.equal(g.hay, 90); assert.equal(g.seeds, 15);
  const h = quiet(); h.hay = 10; at(h, 'kera'); assert.equal(choose(h, 'trade'), false); assert.ok(talkOf(h).choices.find(c => c.id === 'trade').no);
});
test('Tok Tiong sells a wind that holds for Ubin, and calls the cats off for hay', () => {
  const g = quiet(); g.windHeld = false; at(g, 'tiong'); assert.equal(choose(g, 'wind'), false, 'no seeds'); g.seeds = 9; assert.ok(choose(g, 'wind'));
  const u = ISLANDS.find(i => i.id === 'ubin').dock; assert.equal(g.seeds, 3); assert.ok(g.windHeld); assert.ok(Math.abs(g.wind - Math.atan2(u[0] - g.x, u[1] - g.z)) < 1e-9);
  g.h = g.wind; assert.equal(pointOfSail(g.h, g.wind), 'RUNNING');
  const h = quiet(); at(h, 'tiong'); assert.equal(choose(h, 'cats'), false, 'no bounty to lose');
  h.bounty = 3; h.foes.push({ id: 98, kind: 'hunter', x: 0, z: 0, h: 0, hp: 90, max: 90, cool: 1, bump: 0, path: [], leg: 0, chasing: false, alive: true });
  assert.ok(choose(h, 'cats')); assert.equal(h.bounty, 0); assert.equal(h.hay, 90); assert.ok(!h.foes.some(f => f.kind === 'hunter'));
});
test('the same seed and inputs replay exactly', () => {
  const play = () => { const g = newGame(1234, 'dora'); autopilot(g, ROUTE.slice(0, 4), 'fight', 60); return JSON.stringify(g); };
  assert.equal(play(), play());
});
test('the autopilot bargains its way to Pulau Ubin and lands the hay', () => {
  for (const hero of ['dora', 'enzo']) {
    const g = newGame(11, hero); autopilot(g, ROUTE, 'bargain');
    for (let i = 0; i < 300 && g.phase === 'sail'; i++) step(g, { ...NO_INPUT, act: true, slower: true });
    assert.equal(g.phase, 'won', `${hero} reached Ubin (ended at ${g.x.toFixed(1)}, ${g.z.toFixed(1)}, phase ${g.phase})`);
    const r = result(g); assert.equal(r.medal, 'silver'); assert.ok(r.time < 200); assert.ok(g.found.includes('ubin'));
  }
});
test('the save keeps the best medal and time and rejects anything else', () => {
  assert.equal(parseSave(null), null); assert.equal(parseSave('{"v":2}'), null); assert.equal(parseSave('nope'), null);
  const g = quiet(); g.hay = 100; g.t = 90; let s = recordVoyage(freshSave(), g); assert.equal(s.best, 'gold'); assert.equal(s.bestTime, 90); assert.equal(s.voyages, 1);
  g.hay = 75; g.t = 50; s = recordVoyage(s, g); assert.equal(s.best, 'gold'); assert.equal(s.bestTime, 90); assert.equal(s.voyages, 2);
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
});

if (fails.length) { console.error(`\n${fails.length} of ${n + fails.length} Straits tests failed`); process.exit(1); }
console.log(`PASS straits: ${n} engine tests`);
