// Highburrow engine tests: a turn resolving, production matching the preview, hunger and aid, frost and chuño,
// founding and the summit village, the festival, friendship and trade, llama routes, decisions, a seed replaying
// exactly, saves, the advisor, and short bot runs. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';

let n = 0; const fails = [];
const test = (name, fn) => { try { fn(); n++; } catch (e) { fails.push(name); console.error(`FAIL ${name}\n  ${e.message.split('\n')[0]}`); } };
import { Game, preview, hearts, emptyStore, EAT, FESTIVAL, NEIGHBOURS, MAP, TERRAIN, idx, isSummit, storeCap, findPath } from '../.checks/highburrow-game.js';
import { routeAdvice } from '../.checks/highburrow-advisor.js';
import { advise } from '../.checks/highburrow-advisor.js';
import { play } from './highburrow-bot.mjs';

const fresh = () => new Game(42, true);

test('a turn resolves: turn advances, moves refresh, a report is written', () => {
  const g = fresh(); const d = g.s.units.find(u => u.kind === 'dora');
  assert.ok(g.apply({ k: 'explore', unit: d.id }).ok);
  assert.ok(d.mp < 6);
  assert.ok(g.apply({ k: 'end' }).ok);
  assert.equal(g.s.turn, 2); assert.equal(d.mp, 6); assert.ok(Array.isArray(g.s.report));
});

test('production and upkeep match the preview exactly', () => {
  const g = fresh(); const v = g.s.villages[0];
  const p = preview(g.s, v, true); const before = { ...v.store };
  g.apply({ k: 'end' });
  // quinoa and wool aren't eaten while potatoes last
  assert.equal(v.store.quinoa, before.quinoa + p.goods.quinoa.n);
  assert.equal(v.store.potatoes, before.potatoes + p.goods.potatoes.n - v.settlers.length * EAT);
  assert.equal(p.food.eat, 3 * EAT);
  assert.equal(v.warmth, Math.min(100, before && p.warmth.next));
});

test('food upkeep: a village with no food goes hungry, then friends or kin send aid', () => {
  const g = fresh(); const v = g.s.villages[0];
  v.store.potatoes = 0; v.store.quinoa = 0; v.settlers.forEach(s => (s.job = 'builder'));
  g.apply({ k: 'end' });
  assert.ok(g.s.report.some(r => r.text.includes('went hungry')));
  assert.ok(g.s.report.some(r => r.kind === 'aid'), 'aid arrives');
  assert.ok(v.store.potatoes > 0);
});

test('frost nights cost Warmth and spoil potatoes; chuño stops the spoiling', () => {
  const g = fresh(); const v = g.s.villages[0];
  v.store.potatoes = 40; g.s.frost = true;
  const p = preview(g.s, v, true);
  assert.ok(p.warmth.parts.some(x => x.label === 'Frost night' && x.n < 0));
  assert.ok(p.spoil > 0);
  g.s.skills.push('chuno');
  const p2 = preview(g.s, v, true);
  assert.equal(p2.spoil, 0);
  assert.ok(p2.goods.potatoes.parts.some(x => x.label.startsWith('Chuño')));
});

test('altitude: a village on the snow line is colder than one on the terraces', () => {
  const g = fresh(); const low = g.s.villages[0];
  const high = { ...low, id: 999, q: 12, r: 2, settlers: [], built: [] };
  assert.equal(MAP[idx(12, 2)], 'snow');
  assert.ok(preview(g.s, high).warmth.delta < preview(g.s, low).warmth.delta - 4);
});

test('trade moves goods, grows friendship and can only be done once per offer per turn', () => {
  const g = fresh(); const v = g.s.villages[0];
  g.s.nb.viscachas.met = true;
  v.q = 13; v.r = 9; // put the village beside the warren for the test
  v.store.quinoa = 10;
  const r = g.apply({ k: 'trade', n: 'viscachas', src: { village: v.id }, offer: 0 });
  assert.ok(r.ok, r.msg);
  assert.equal(v.store.quinoa, 6); assert.equal(v.store.potatoes, 16);
  assert.equal(g.s.nb.viscachas.fr, 6);
  assert.equal(g.apply({ k: 'trade', n: 'viscachas', src: { village: v.id }, offer: 0 }).ok, false);
  g.apply({ k: 'end' });
  assert.ok(g.apply({ k: 'trade', n: 'viscachas', src: { village: v.id }, offer: 0 }).ok);
});

test('trade is refused out of reach and before meeting', () => {
  const g = fresh(); const v = g.s.villages[0];
  assert.equal(g.apply({ k: 'trade', n: 'herders', src: { village: v.id }, offer: 0 }).ok, false);
  g.s.nb.herders.met = true;
  assert.match(g.apply({ k: 'trade', n: 'herders', src: { village: v.id }, offer: 0 }).msg, /within 3 tiles/);
});

test('friendship: befriending grows hearts with a cooldown; skills need 3 hearts; sky paths opens the passes', () => {
  const g = fresh(); const d = g.s.units.find(u => u.kind === 'dora');
  const c = NEIGHBOURS.condors; d.q = c.q + 1; d.r = c.r;
  assert.ok(g.apply({ k: 'befriend', unit: d.id }).ok);
  assert.equal(g.s.nb.condors.met, true); assert.equal(hearts(g.s.nb.condors.fr), 0);
  assert.equal(g.apply({ k: 'befriend', unit: d.id }).ok, false, 'cooldown');
  assert.equal(g.apply({ k: 'learn', n: 'condors' }).ok, false, 'not friends yet');
  g.s.nb.condors.fr = 60;
  assert.ok(g.apply({ k: 'learn', n: 'condors' }).ok);
  assert.equal(g.s.passes, true);
  const pass = MAP.findIndex(t => t === 'pass'); assert.equal(g.s.seen[pass], 1);
});

test('favours: visiting the lost pup completes the viscacha quest once met', () => {
  const g = fresh(); const d = g.s.units.find(u => u.kind === 'dora');
  const q = NEIGHBOURS.viscachas.quest; assert.equal(q.kind, 'visit');
  g.s.nb.viscachas.met = true;
  if (q.kind === 'visit') { d.q = q.q; d.r = q.r + 1; d.mp = 6; g.apply({ k: 'move', unit: d.id, q: q.q, r: q.r }); }
  assert.equal(g.s.nb.viscachas.quest, 'done'); assert.ok(g.s.nb.viscachas.fr >= 30);
});

test('founding: Enzo needs a settler and room; the snow line village is Highburrow', () => {
  const g = fresh(); const v = g.s.villages[0]; const e = g.s.units.find(u => u.kind === 'enzo');
  e.q = 12; e.r = 2;
  assert.match(g.apply({ k: 'found', unit: e.id }).msg, /settler/);
  v.settlers.push({ id: 900, fur: 1, job: 'builder' });
  assert.ok(g.apply({ k: 'send', v: v.id }).ok);
  const st = g.s.units.find(u => u.kind === 'settler'); st.q = 12; st.r = 2;
  const r = g.apply({ k: 'found', unit: e.id }); assert.ok(r.ok, r.msg);
  const top = g.s.villages.find(isSummit); assert.equal(top.name, 'Highburrow');
});

test('win: the summit festival needs the population and the goods, then ends the game', () => {
  const g = fresh(); const v = g.s.villages[0];
  v.q = 12; v.r = 2; // pretend the first village is on the snow line
  assert.match(g.festivalProblem(v), /needs \d+ chinchillas|league needs/);
  for (let i = 0; i < g.goal(); i++) v.settlers.push({ id: 1000 + i, fur: 0, job: 'hearth' });
  assert.match(g.festivalProblem(v), /more/);
  for (const [k, n] of Object.entries(FESTIVAL)) (v.store)[k] = n;
  assert.equal(g.festivalProblem(v), '');
  assert.ok(g.apply({ k: 'festival', v: v.id }).ok);
  assert.equal(g.s.over, 'won'); assert.equal(g.s.wonTurn, 1);
});

test('turn 60 passes without a festival: the scenario ends "late", and can carry on', () => {
  const g = fresh(); g.s.turn = 60; g.apply({ k: 'end' });
  assert.equal(g.s.over, 'late');
  g.s.over = ''; g.s.wonTurn = -1; g.apply({ k: 'end' }); assert.equal(g.s.over, '');
});

test('seeded replays: the same seed and commands give the same game; another seed differs', () => {
  const run = (seed) => {
    const g = new Game(seed, true);
    while (g.s.turn <= 30) {
      const skip = new Set();
      for (let i = 0; i < 60; i++) { const a = advise(g, { skip }); if (a.cmd.k === 'end') break; g.apply(a.cmd); skip.add(a.key); }
      g.apply({ k: 'end' });
    }
    return g;
  };
  const a = run(7);
  const b = new Game(7, true); for (const c of a.log) b.apply(c);
  assert.equal(b.save(), a.save());
  const c = run(8);
  assert.notEqual(JSON.stringify(c.s.report) + c.s.rng, JSON.stringify(a.s.report) + a.s.rng);
});

test('save and load round-trip; junk saves are rejected', () => {
  const g = fresh(); g.apply({ k: 'end' });
  const h = Game.load(g.save()); assert.equal(h.save(), g.save());
  h.apply({ k: 'end' }); g.apply({ k: 'end' }); assert.equal(h.save(), g.save(), 'the rng carries on identically');
  assert.equal(Game.load('{"v":2}'), null); assert.equal(Game.load('nope'), null);
});

test('silver comes only from the condors; salt flats make just a little', () => {
  assert.equal(TERRAIN.silver.work, false);
  for (const n of ['herders', 'viscachas']) assert.ok(NEIGHBOURS[n].offers.every(o => o.get[0] !== 'silver'));
  assert.ok(NEIGHBOURS.condors.offers.every(o => o.get[0] === 'silver'));
  assert.ok(NEIGHBOURS.herders.offers.some(o => o.get[0] === 'salt'));
  assert.equal(TERRAIN.salt.n, 1);
  assert.ok(FESTIVAL.silver > 0, 'the festival needs a traded good');
  // at 3 hearts, friends trade with any village
  const g = fresh(); const v = g.s.villages[0]; g.s.nb.condors.met = true; v.store.quinoa = 20;
  assert.equal(g.apply({ k: 'trade', n: 'condors', src: { village: v.id }, offer: 0 }).ok, false);
  g.s.nb.condors.fr = 60;
  assert.ok(g.apply({ k: 'trade', n: 'condors', src: { village: v.id }, offer: 0 }).ok);
  assert.equal(v.store.silver, 1);
});

/** a two-village game with a caravan, for the route tests */
function twoVillages() {
  const g = fresh(); const s = g.s; const A = s.villages[0];
  for (let i = 0; i < 8; i++) for (const n of [[A.q + 1, A.r], [A.q + 2, A.r], [A.q + 3, A.r], [A.q + 4, A.r]]) s.seen[idx(n[0], n[1])] = 1;
  const B = { ...structuredClone(A), id: 999, name: 'Testhill', q: A.q + 3, r: A.r, settlers: [{ id: 998, fur: 1, job: '' }], built: [], queue: [] };
  for (const k in B.store) (B.store)[k] = 0;
  s.villages.push(B);
  const car = s.units.find(u => u.kind === 'caravan'); car.q = A.q; car.r = A.r;
  return { g, s, A, B: s.villages[1], car };
}

test('caravan routes: set once, the llamas shuttle goods every turn until stopped', () => {
  const { g, A, B, car } = twoVillages();
  assert.ok(findPath(g.s, [A.q, A.r], [B.q, B.r]));
  A.store.wool = 20;
  assert.equal(g.apply({ k: 'route', unit: car.id, a: A.id, b: A.id, carry: ['wool'] }).ok, false);
  assert.equal(g.apply({ k: 'route', unit: car.id, a: A.id, b: B.id, carry: [] }).ok, false);
  const r = g.apply({ k: 'route', unit: car.id, a: A.id, b: B.id, carry: ['wool'] });
  assert.ok(r.ok, r.msg);
  assert.ok(car.route && car.cargo.wool > 0, 'it loads at A straight away');
  let delivered = 0;
  for (let t = 0; t < 8; t++) { g.apply({ k: 'end' }); delivered = B.store.wool; }
  assert.ok(delivered >= 12, `wool delivered ${delivered}`);
  assert.ok(g.s.report.some(x => x.kind === 'route') || delivered > 0);
  assert.ok(g.apply({ k: 'unroute', unit: car.id }).ok);
  const at = [car.q, car.r]; g.apply({ k: 'end' }); g.apply({ k: 'end' });
  assert.deepEqual([car.q, car.r], at, 'a stopped caravan stays put');
});

test('surplus: a full storehouse reports waste, and Enzo suggests a route that carries it away', () => {
  const { g, A, car } = twoVillages(); void car;
  A.store.potatoes = storeCap(A, 'potatoes'); A.store.quinoa = 0;
  const p = preview(g.s, A);
  assert.ok((p.waste.potatoes ?? 0) > 0, JSON.stringify(p.waste));
  const a = routeAdvice(g);
  assert.ok(a && a.cmd.k === 'route' && a.cmd.carry.includes('potatoes'), a?.text);
  g.apply({ k: 'end' });
  assert.ok(g.s.report.some(x => x.kind === 'waste'));
  assert.ok(g.apply(a.cmd).ok);
});

test('decisions: a neighbour asks mid-game; the turn waits for an answer; each choice has an effect', () => {
  for (const choice of [0, 1]) {
    const g = fresh(); const s = g.s; s.nb.herders.met = true; s.nb.herders.fr = 40; s.turn = 14;
    s.villages[0].store.quinoa = 20;
    g.apply({ k: 'end' });
    assert.equal(s.decision, 'herd');
    assert.equal(g.apply({ k: 'end' }).ok, false, 'end turn waits for the answer');
    const r = g.apply({ k: 'decide', choice }); assert.ok(r.ok, r.msg);
    assert.equal(s.nb.herders.fr, choice === 0 ? 65 : 30);
    assert.equal(s.decision, null);
    assert.ok(g.apply({ k: 'end' }).ok);
    assert.notEqual(s.decision, 'herd', 'a request comes only once');
  }
  const g = fresh(); g.s.decision = 'alpacas'; g.apply({ k: 'decide', choice: 0 });
  assert.ok(g.s.skills.includes('alpacas'));
});

test('bots: the advisor-following casual player usually wins and nobody gets stuck', () => {
  const rs = Array.from({ length: 6 }, (_, i) => play(2000 + i, {}));
  assert.ok(rs.filter(r => r.won).length >= 5, JSON.stringify(rs.map(r => r.turn)));
  assert.ok(rs.every(r => !r.stuck && r.fails === 0));
  const careless = Array.from({ length: 4 }, (_, i) => play(3000 + i, { ignoreWarmth: true }, false));
  assert.ok(careless.every(r => !r.stuck), 'ignoring Warmth hurts but never locks the game');
});
void emptyStore;

if (fails.length) { console.error(`highburrow: ${fails.length} failed, ${n} passed`); process.exit(1); }
console.log(`highburrow: ${n} engine tests passed`);
