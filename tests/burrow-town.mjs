import assert from 'node:assert/strict';
import {
  BurrowTown,
  BUILDINGS,
  BUILDING_ORDER,
  VALLEYS,
  SANDBOX,
  REQUESTS,
  W,
  H,
  TICK,
  START_HAY,
  ROAD_COST,
  BRIDGE_MULTIPLIER,
  makeTerrain,
} from '../.checks/burrow-town-game.js';

let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
const cx = W >> 1;
const cy = H >> 1;
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.step(TICK);
};
/** A fresh valley with a road running east from the plaza. */
const town = (index = 0, roadLen = 4) => {
  const g = new BurrowTown(index);
  g.hay = 10000;
  for (let i = 1; i <= roadLen && !g.blocked('road', cx + i, cy); i++) assert.equal(g.apply(cx + i, cy, 'road'), '');
  return g;
};
const findTerrain = (g, kind, skip = () => false) => g.tiles.find((t) => t.t === kind && !t.b && !t.road && !skip(t));

test('every valley has a clear plaza square and reachable land', () => {
  for (const v of [...VALLEYS, SANDBOX]) {
    const t = makeTerrain(v);
    assert.equal(t.length, W * H);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) assert.equal(t[(cy + dy) * W + cx + dx], 'grass', `${v.name} centre must be grass`);
    if (v.river) assert(t.includes('river'), `${v.name} should have a river`);
    assert(t.includes('rock'), `${v.name} should have rock`);
    assert(t.filter((k) => k === 'grass' || k === 'terrace').length > 100, `${v.name} needs building room`);
    assert.deepEqual(makeTerrain(v), t, 'terrain is deterministic');
  }
});

test('the town starts with one plaza, three wishes and the starting hay', () => {
  const g = new BurrowTown(0);
  assert.equal(g.hay, START_HAY);
  assert.equal(g.count((t) => t.b === 'plaza'), 1);
  assert.equal(g.tile(cx, cy).b, 'plaza');
  assert.equal(g.requests.length, 3);
  assert(g.requests.some((r) => r.advisor === 'dora') && g.requests.some((r) => r.advisor === 'enzo'), 'both advisors ask for something');
  assert.equal(g.valley.name, VALLEYS[0].name);
  assert.equal(new BurrowTown(-1).valley.name, SANDBOX.name);
});

test('roads must be paid for, cannot cross rock and cost triple over water', () => {
  const g = new BurrowTown(1);
  assert.equal(g.apply(cx + 1, cy, 'road'), '');
  assert.equal(g.hay, START_HAY - ROAD_COST);
  const rock = findTerrain(g, 'rock');
  assert.match(g.apply(rock.x, rock.y, 'road'), /rock/i);
  const river = findTerrain(g, 'river');
  const before = g.hay;
  assert.equal(g.apply(river.x, river.y, 'road'), '');
  assert.equal(before - g.hay, ROAD_COST * BRIDGE_MULTIPLIER);
  g.hay = 1;
  assert.match(g.apply(cx + 2, cy, 'road'), /hay/i);
  assert.equal(g.events.filter((e) => e === 'deny').length, 2);
});

test('buildings respect terrain', () => {
  const g = town(1);
  const river = findTerrain(g, 'river');
  assert.match(g.apply(river.x, river.y, 'burrow'), /water/i);
  const rock = findTerrain(g, 'rock');
  assert.match(g.apply(rock.x, rock.y, 'burrow'), /rock/i);
  assert.equal(g.apply(rock.x, rock.y, 'quarry'), '');
  const grass = findTerrain(g, 'grass');
  assert.match(g.apply(grass.x, grass.y, 'quarry'), /rock/i);
  assert.match(g.apply(cx + 1, cy, 'burrow'), /road/i);
  assert.match(g.apply(cx, cy, 'burrow'), /built/i);
});

test('only buildings touching a plaza road are connected', () => {
  const g = town(0, 3);
  assert.equal(g.apply(cx + 1, cy + 1, 'burrow'), '');
  assert.equal(g.apply(cx + 6, cy + 1, 'burrow'), '');
  assert(g.tile(cx + 1, cy + 1).linked, 'burrow beside the plaza road is linked');
  assert(!g.tile(cx + 6, cy + 1).linked, 'burrow far from the road is not linked');
  assert.equal(g.apply(cx + 4, cy, 'road'), '');
  assert.equal(g.apply(cx + 5, cy, 'road'), '');
  assert(g.tile(cx + 6, cy + 1).linked === false, 'diagonal does not count');
  assert.equal(g.apply(cx + 6, cy, 'road'), '');
  assert(g.tile(cx + 6, cy + 1).linked, 'linked once the road reaches it');
  assert.equal(g.apply(cx + 2, cy, 'demolish'), '');
  assert(!g.tile(cx + 6, cy + 1).linked, 'cutting the road disconnects the far burrow');
  assert(g.tile(cx + 1, cy + 1).linked, 'the near burrow keeps its link');
});

test('a building next to the plaza itself is connected without a road', () => {
  const g = new BurrowTown(0);
  assert.equal(g.apply(cx, cy + 1, 'hayfarm'), '');
  assert(g.tile(cx, cy + 1).linked);
});

test('hay farms earn each tick and residents eat', () => {
  const g = town();
  g.hay = 100;
  assert.equal(g.apply(cx + 1, cy + 1, 'hayfarm'), '');
  assert.equal(g.hay, 75);
  assert.equal(g.stats.income, 3);
  ticks(g, 1);
  assert.equal(g.hay, 78);
  assert.equal(g.apply(cx + 2, cy + 1, 'burrow'), '');
  ticks(g, 1);
  assert.equal(g.tile(cx + 2, cy + 1).res, 1, 'one resident moves in per tick');
  const hay = g.hay;
  ticks(g, 1);
  assert.equal(g.tile(cx + 2, cy + 1).res, 2);
  assert(g.hay < hay + 3, 'residents cost hay');
  assert.equal(g.stats.residents, 2);
});

test('comfort caps occupancy and amenities raise it', () => {
  const g = town();
  assert.equal(g.apply(cx + 1, cy + 1, 'burrow'), '');
  ticks(g, 12);
  const home = g.tile(cx + 1, cy + 1);
  assert.equal(home.comfort, 1, 'plaza within 4 tiles gives one comfort');
  assert.equal(home.res, Math.round(4 * 0.6));
  assert.equal(g.apply(cx + 2, cy + 1, 'dustbath'), '');
  assert.equal(home.comfort, 2);
  ticks(g, 6);
  assert.equal(home.res, Math.round(4 * 0.8));
  assert.equal(g.stats.happiness, Math.min(100, (2 / 3) * 100));
  const rock = findTerrain(g, 'rock', (t) => Math.abs(t.x - home.x) + Math.abs(t.y - home.y) > 2);
  if (rock) {
    assert.equal(g.apply(rock.x, rock.y, 'quarry'), '');
    assert.equal(home.comfort, 1, 'a quarry within 2 tiles is a nuisance');
  }
});

test('a disconnected burrow empties out', () => {
  const g = town(0, 3);
  assert.equal(g.apply(cx + 3, cy + 1, 'burrow'), '');
  ticks(g, 6);
  assert(g.tile(cx + 3, cy + 1).res > 0);
  assert.equal(g.apply(cx + 2, cy, 'demolish'), '');
  ticks(g, 4);
  assert.equal(g.tile(cx + 3, cy + 1).res, 0);
});

test('terrace and riverside farms earn more', () => {
  const g = new BurrowTown(1);
  g.hay = 10000;
  const terrace = g.tiles.find((t) => t.t === 'terrace');
  terrace.b = 'hayfarm';
  terrace.linked = true;
  const river = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.tile(terrace.x + dx, terrace.y + dy)?.t === 'river');
  assert.equal(g.yieldOf(terrace), 4 + (river ? 1 : 0));
});

test('workshops need a connected quarry; markets scale with nearby residents', () => {
  const g = town(3);
  g.approval.enzo = 100;
  assert.equal(g.apply(cx + 1, cy + 1, 'workshop'), '');
  assert.equal(g.yieldOf(g.tile(cx + 1, cy + 1)), 1);
  const rock = findTerrain(g, 'rock');
  rock.b = 'quarry';
  rock.linked = true;
  assert.equal(g.yieldOf(g.tile(cx + 1, cy + 1)), 4);
  assert.equal(g.apply(cx + 2, cy + 1, 'market'), '');
  assert.equal(g.yieldOf(g.tile(cx + 2, cy + 1)), 0);
  g.tile(cx + 3, cy + 1).b = 'bigburrow';
  g.tile(cx + 3, cy + 1).res = 9;
  assert.equal(g.yieldOf(g.tile(cx + 2, cy + 1)), 3);
  g.tile(cx + 3, cy + 1).res = 30;
  assert.equal(g.yieldOf(g.tile(cx + 2, cy + 1)), 8);
});

test('advisor approval unlocks buildings', () => {
  const g = town();
  for (const id of BUILDING_ORDER) {
    const b = BUILDINGS[id];
    assert.equal(g.unlocked(id), !b.advisor, `${id} at start`);
  }
  assert.match(g.apply(cx + 1, cy + 1, 'garden'), /Dora/);
  assert.match(g.apply(cx + 1, cy + 1, 'market'), /Enzo/);
  g.approval.dora = 25;
  assert.equal(g.apply(cx + 1, cy + 1, 'garden'), '');
  assert(!g.unlocked('bigburrow'));
  g.approval.enzo = 75;
  assert(g.unlocked('market') && g.unlocked('workshop') && g.unlocked('watchtower'));
});

test('completing a wish pays approval and hay, replaces the wish and announces unlocks', () => {
  const g = town();
  g.requests = [];
  g.done = [];
  const def = REQUESTS.find((d) => d.key === 'gardens');
  g.approval.dora = 24;
  g.requests.push({ key: 'gardens', advisor: 'dora', text: 'x', reward: 20, progress: [0, 3], done: false });
  for (let i = 0; i < 3; i++) g.tile(cx + 1 + i, cy + 1).b = 'garden';
  g.recompute();
  const hay = g.hay;
  ticks(g, 1);
  assert.equal(g.approval.dora, 44);
  assert.equal(g.hay - hay, 20);
  assert(g.done.includes('gardens'));
  assert(!g.requests.some((r) => r.key === 'gardens'));
  assert.equal(g.requests.length, 3);
  assert(g.events.includes('request'));
  assert(g.events.includes('unlock:garden'));
  assert(g.log[0].text.length > 0 && g.log[0].who === 'dora');
  assert.equal(def.check(g)[0], 3);
});

test('wish progress reads live and text shows its target', () => {
  const g = town(1);
  for (const r of g.requests) {
    assert.equal(r.progress.length, 2);
    assert(r.progress[1] > 0);
    assert(!r.text.includes('{n}'));
  }
  const homes = g.requests.find((r) => r.key === 'homes');
  if (homes) {
    g.apply(cx + 1, cy + 1, 'burrow');
    ticks(g, 1);
    assert.equal(g.requests.find((r) => r.key === 'homes').progress[0], 1);
  }
});

test('demolition refunds half and the last plaza cannot be cleared', () => {
  const g = town();
  g.apply(cx + 1, cy + 1, 'dustbath');
  const hay = g.hay;
  assert.equal(g.apply(cx + 1, cy + 1, 'demolish'), '');
  assert.equal(g.hay - hay, 15);
  assert.equal(g.tile(cx + 1, cy + 1).b, null);
  assert.match(g.apply(cx, cy, 'demolish'), /plaza/i);
  assert.match(g.apply(cx + 5, cy + 5, 'demolish'), /Nothing/);
  g.approval.dora = 100;
  assert.equal(g.apply(cx + 5, cy + 3, 'plaza'), '');
  assert.equal(g.apply(cx, cy, 'demolish'), '', 'with two plazas the first can go');
});

test('a second plaza roots its own road network', () => {
  const g = town(0, 0);
  g.approval.dora = 100;
  assert.equal(g.apply(cx + 5, cy + 3, 'plaza'), '');
  assert.equal(g.apply(cx + 6, cy + 3, 'road'), '');
  assert.equal(g.apply(cx + 6, cy + 4, 'burrow'), '');
  assert(g.tile(cx + 6, cy + 4).linked);
});

test('pause stops time and the clock rolls through days', () => {
  const g = town();
  g.pause();
  ticks(g, 5);
  assert.equal(g.time, 0);
  g.pause();
  g.step(130);
  assert.equal(g.day, 2);
  assert(g.daylight >= 0 && g.daylight < 1);
});

test('reaching the valley goal wins once', () => {
  const g = town();
  g.approval = { dora: 25, enzo: 25 };
  g.valley = { ...g.valley, goal: { residents: 8, approval: 25 } };
  for (let i = 0; i < 4; i++) g.apply(cx + 1 + i, cy + 1, 'burrow');
  ticks(g, 1);
  assert(!g.won, 'four residents is not enough after one tick');
  ticks(g, 1);
  assert.equal(g.stats.residents, 8);
  assert(g.goalMet);
  assert(g.won, 'the tick that meets the goal wins');
  assert(g.events.includes('won'));
  const t = g.time;
  ticks(g, 3);
  assert.equal(g.time, t, 'a won town stops its clock');
});

test('the sandbox never wins', () => {
  const g = new BurrowTown(-1);
  g.approval = { dora: 100, enzo: 100 };
  g.stats.residents = 10000;
  assert(!g.goalMet);
  assert.equal(g.level, 3);
});

test('save and load round-trip the town', () => {
  const g = town(2);
  g.approval.dora = 30;
  g.apply(cx + 1, cy + 1, 'burrow');
  g.apply(cx + 2, cy + 1, 'garden');
  const rock = findTerrain(g, 'rock');
  g.apply(rock.x, rock.y, 'quarry');
  ticks(g, 5);
  const s = g.save();
  assert.equal(s.tiles.length, W * H * 2);
  const back = BurrowTown.load(JSON.parse(JSON.stringify(s)));
  assert.equal(back.hay, g.hay);
  assert.equal(back.time, g.time);
  assert.deepEqual(back.approval, g.approval);
  assert.equal(back.valley.name, g.valley.name);
  assert.deepEqual(back.tiles.map((t) => [t.t, t.b, t.road, t.res, t.linked]), g.tiles.map((t) => [t.t, t.b, t.road, t.res, t.linked]));
  assert.deepEqual(back.requests.map((r) => r.key), g.requests.map((r) => r.key));
  assert.deepEqual(back.stats, g.stats);
});

test('a hands-off town neither crashes nor runs away over a long day', () => {
  const g = town();
  g.hay = START_HAY;
  g.apply(cx + 1, cy + 1, 'hayfarm');
  g.apply(cx + 2, cy + 1, 'burrow');
  g.apply(cx + 1, cy - 1, 'burrow');
  ticks(g, 600);
  assert(Number.isFinite(g.hay) && g.hay >= 0);
  assert(g.stats.residents > 0 && g.stats.residents <= g.stats.capacity);
  assert.equal(g.requests.length, 3);
});

console.log(`Burrow Town: ${checks} checks passed.`);
