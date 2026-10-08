import assert from 'node:assert/strict';
import { Game, MAPS, KINDS, CAPACITY, GRACE, DAY } from '../.checks/burrow-express-game.js';
import { play } from './burrow-express-bot.mjs';
const conserve = (g) => {
  const p = [...g.stations.flatMap((s) => s.queue), ...g.carts.flatMap((c) => c.pax)];
  assert.equal(new Set(p.map((p) => p.id)).size, p.length, 'no duplicate passengers');
  assert.equal(p.length + g.delivered, g.spawned, 'every passenger remains queued, riding, or delivered');
};
const route = (g, line, stops) => { for (const id of stops) assert.equal(g.append(line, id), ''); };
const advance = (g, secs) => { for (let i = 0; i < secs * 20 && g.state === 'running'; i++) g.update(0.05); };

// Initial stations, route construction and finite resources.
for (let map = 0; map < 3; map++) {
  const g = Game.start(map, 'challenge', 42);
  assert.equal(g.active.length, 4); assert.deepEqual(g.active.map((s) => s.kind), KINDS);
  assert.equal(g.lines.length, 3); assert.equal(g.available, 3);
  assert.ok(g.append(-1, 0)); assert.ok(g.append(0, 8)); assert.ok(g.loop(0));
  route(g, 0, [0, 1]); assert.equal(g.carts.length, 1); assert.equal(g.available, 2);
  assert.equal(g.append(0, 1), ''); assert.equal(g.lines[0].stops.length, 2);
  assert.ok(g.append(0, 0)); conserve(g);
}
{
  const g = Game.start(0, 'challenge', 1); route(g, 0, [0, 1]);
  assert.equal(g.needsDrill(2, 3), true); g.drills = 0;
  route(g, 1, [2]); assert.ok(g.append(1, 3)); assert.deepEqual(g.lines[1].stops, [2]);
  g.drills = 1; assert.equal(g.append(1, 3), ''); assert.equal(g.drills, 0);
  assert.equal(g.needsDrill(3, 2), false, 'a dug tunnel is shared in both directions');
  assert.equal(g.addCart(0), ''); assert.ok(g.addCart(0));
}
// Shared stations support real transfers, with the shortest passable next hop and no abandoned-line traps.
{
  const g = Game.start(0, 'tutorial', 1); g.stations.forEach((s) => s.queue = []); g.spawned = 0;
  route(g, 0, [0, 1]); route(g, 1, [1, 2]); route(g, 2, [2, 3]);
  assert.deepEqual(g.path(0, 'retreat'), [0, 1, 2, 3]); g.passenger(0, 'retreat');
  advance(g, 100); assert.equal(g.delivered, 1); assert.ok(g.transfers >= 2); conserve(g);
  assert.equal(g.releaseCart(1), ''); assert.equal(g.path(0, 'dust'), null, 'a route with no cart is not advertised');
  assert.equal(g.addCart(1), ''); assert.deepEqual(g.path(0, 'dust'), [0, 1, 2]);
}
// Bouncing at ends, loop operation, delivery, cart seats, hay and safe route edits.
{
  const g = Game.start(0, 'tutorial', 3); route(g, 0, [0, 1, 2, 3]);
  for (let i = 0; i < 150; i++) { g.update(0.05); conserve(g); assert.ok(g.carts.every((c) => c.pax.length <= g.seats)); }
  assert.ok(g.carts.some((c) => c.pax.length > 0)); assert.equal(g.removeLast(0), ''); conserve(g);
  route(g, 0, [3]); assert.equal(g.loop(0), ''); conserve(g); assert.equal(g.loop(0), ''); conserve(g);
  assert.equal(g.releaseCart(0), ''); conserve(g); assert.equal(g.carts.length, 0);
}
{
  const g = Game.start(0, 'tutorial', 5); route(g, 0, [0, 1, 2, 3]);
  while (g.state === 'running') { g.update(0.5); conserve(g); }
  assert.equal(g.delivered, 5); assert.equal(g.state, 'upgrade'); assert.equal(g.tutorial, 3);
  assert.ok(g.upgrade('bogus')); const before = g.fleet; assert.equal(g.upgrade('cart'), ''); assert.equal(g.fleet, before + 1); assert.equal(g.state, 'won');
}
{
  const g = Game.start(0, 'challenge', 4); route(g, 0, [0, 1]); g.hay = 0;
  g.update(2); assert.equal(g.carts[0].to, -1, 'carts wait for fuel');
  g.update(2); g.update(2); g.update(2); assert.ok(g.carts[0].to >= 0, 'slow hay deliveries prevent a permanent fuel lock');
}
// Pausing halts every clock, an empty network loses, and crowding recovers after the queue is cleared.
{
  const g = Game.start(0, 'challenge', 1); g.pause(true); const before = g.save(); g.update(2); assert.equal(g.save(), before);
  g.pause(false); g.passenger(0, 'hay'); for (let i = 0; i < CAPACITY; i++) g.passenger(0, 'hay');
  g.update(2); assert.ok(g.stations[0].crowd > 1); g.stations[0].queue = []; g.spawned = 0; advance(g, 2); assert.equal(g.stations[0].crowd, 0);
  const idle = Game.start(0, 'endless', 1);
  for (let i = 0; i < 500 && idle.state !== 'lost'; i++) { if (idle.state === 'upgrade') idle.upgrade(idle.offers()[0]); idle.update(1); }
  assert.equal(idle.state, 'lost'); assert.match(idle.reason, /overcrowded/);
}
// Day transitions are choices, emerging stations are deterministic, cave-ins can be waited out or repaired.
{
  const g = Game.start(0, 'challenge', 2); route(g, 0, [0, 1, 2, 3]);
  g.time = DAY - 0.05; g.update(0.05); assert.equal(g.day, 2); assert.equal(g.state, 'upgrade'); assert.equal(g.active.length, 5);
  const stopped = g.time; g.update(2); assert.equal(g.time, stopped);
  const lines = g.lines.length; assert.equal(g.upgrade('line'), ''); assert.equal(g.lines.length, lines + 1);
  g.block = { a: 0, b: 1, until: g.time + 20 }; assert.equal(g.path(0, 'hay'), null); const drills = g.drills;
  assert.equal(g.repair(), ''); assert.equal(g.drills, drills - 1); assert.deepEqual(g.path(0, 'hay'), [0, 1]);
  g.block = { a: 0, b: 1, until: g.time + 1 }; advance(g, 2); assert.equal(g.block, null);
}
// Saves round-trip on the move, at upgrades and in every terminal phase, then replay identically.
{
  const g = Game.start(0, 'tutorial', 7); route(g, 0, [0, 1, 2, 3]); advance(g, 3.25);
  const b = Game.load(g.save()); assert.ok(b); g.events = []; assert.equal(b.save(), g.save());
  for (let i = 0; i < 80; i++) { g.update(0.05); b.update(0.05); }
  assert.equal(b.save(), g.save()); conserve(g);
  const raw = JSON.parse(g.save());
  const bad = (mutate) => { const data = structuredClone(raw); mutate(data); assert.equal(Game.load(JSON.stringify(data)), null); };
  assert.equal(Game.load('not json'), null); bad((d) => d.v = 2); bad((d) => d.seed = -1); bad((d) => d.map = 40); bad((d) => d.lines[0].stops.push(999));
  bad((d) => d.carts[0].at = 99); bad((d) => d.carts[0].progress = -1); bad((d) => d.stations[0].x = 0); bad((d) => d.spawned++);
  bad((d) => d.carts[0].pax.push(...d.carts[0].pax)); bad((d) => d.block = { a: 0, b: 100, until: 0 });
  const extra = { ...raw }; Object.defineProperty(extra, '__proto__', { value: { hacked: true }, enumerable: true });
  const proto = Game.load(JSON.stringify(extra)); assert.ok(proto instanceof Game); assert.equal(proto.hacked, undefined);
}
// Late Endless upgrades remain useful, bounded and saveable after reaching the normal fleet limit.
{
  const g = Game.start(0, 'endless', 1); g.fleet = 9; g.seats = 8; g.speed = 235; g.state = 'upgrade';
  assert.equal(g.upgrade('speed'), ''); assert.equal(g.speed, 240);
  g.state = 'upgrade'; g.hay = 100; assert.ok(g.offers().includes('hay')); assert.equal(g.upgrade('hay'), ''); assert.equal(g.hay, 120);
  g.day = 2; g.time = DAY; g.stations.forEach((s) => s.active = s.opens <= g.day); g.state = 'upgrade';
  assert.equal(g.upgrade('line'), ''); assert.equal(g.fleet, 10);
  g.day = 4; g.time = 3 * DAY; g.stations.forEach((s) => s.active = s.opens <= g.day); g.state = 'upgrade';
  assert.equal(g.upgrade('line'), ''); assert.equal(g.fleet, 11); assert.ok(Game.load(g.save()));
  const raw = JSON.parse(g.save()); raw.time = 0; assert.equal(Game.load(JSON.stringify(raw)), null, 'inconsistent day clocks are refused');
}
// Real seeded shifts have a reachable win, and endless keeps going beyond an eight-day shift.
let wins = 0;
for (let map = 0; map < MAPS.length; map++) for (let seed = 1; seed <= 3; seed++) {
  const g = play(map, seed); conserve(g); assert.ok(Game.load(g.save()), `save on ${MAPS[map].name} ${seed}`); wins += g.state === 'won' ? 1 : 0;
  console.log(`${MAPS[map].name} seed ${seed}: ${g.state}, ${g.delivered} delivered by day ${g.day}`);
}
assert.ok(wins >= 6, `at least 6 of 9 seeded shifts must be winnable by the planner (${wins})`);
const endless = play(0, 2, 'endless'); assert.ok(endless.day > 8, 'endless does not stop after day 8');
assert.ok(GRACE > 0);
console.log('Burrow Express: route building, transfers, fuel, crowding, upgrades, cave-ins, conservation, saves and seeded shifts passed.');
