import assert from 'node:assert/strict';
import {
  Hollow, W, H, DAY, POCKETS, LOANS, HOME_GRID, BITE_WINDOW, ROCK_HITS, ROCK_DROPS, FOSSILS_PER_DAY, SHELLS_PER_DAY, SAPLING_DAYS, SHOP_OPEN,
  FISH, BUGS, FOSSILS, FURNITURE, GOALS, BUILDINGS, NEIGHBOURS, BIRTHDAYS, STREET_Y, TOOL_PRICES, FRUIT_PRICE, FLOWER_PRICE, HYBRIDS, WAKE, BEDTIME,
  FESTIVAL_PRIZES, SNOWMAN_PRIZE, SNOWBALLS, WISH_PRIZE, BIRTHDAY_BONUS, makeTerrain,
} from '../.checks/dusty-hollow-game.js';

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const idle = { dx: 0, dy: 0, run: false };
const ticks = (g, seconds, input = idle) => { for (let i = 0, n = Math.round(seconds * 10); i < n; i++) g.step(0.1, input); };
const setHour = (g, h) => { g.clock = (h / 24) * DAY; };
/** Stand the hero on a tile facing a direction. */
const stand = (g, x, y, facing) => { g.x = x + 0.5; g.y = y + 0.5; g.facing = facing; };
const by = (id) => BUILDINGS.find((b) => b.id === id);
const park = (g) => g.villagers.forEach((v) => { v.x = v.tx = -5; v.y = v.ty = -5; });
const fresh = () => { const g = new Hollow('dora', 7); park(g); return g; };
const sleep = (g) => { g.screen = 'home'; g.sleep(); g.screen = 'world'; };
/** Cast, wait for the bite, hook and reel with a gentle rhythm until the fish lands or escapes. */
const fishOnce = (g) => {
  g.interact();
  for (let i = 0; i < 200 && g.fishing && g.fishing.phase !== 'bite'; i++) g.step(0.1);
  if (!g.fishing) return false;
  g.interact();
  for (let i = 0; i < 400 && g.fishing; i++) g.step(0.05, { dx: 0, dy: 0, run: false, hold: g.fishing.tension < 0.6 });
  return true;
};

test('the village map is fixed, walkable and bridged', () => {
  const t = makeTerrain();
  assert.equal(t.length, W * H);
  assert.deepEqual(t, makeTerrain(), 'terrain is deterministic');
  const g = fresh();
  for (let x = 1; x < W - 1; x++) assert.ok(['path', 'bridge'].includes(g.tileAt(x, STREET_Y)), `street continuous at ${x}`);
  assert.equal(g.tileAt(18, STREET_Y), 'bridge');
  assert.equal(g.habitatOf(18, 5), 'river');
  assert.equal(g.habitatOf(7, 3), 'pond');
  assert.equal(g.habitatOf(10, H - 2), 'sea');
  assert.equal(g.habitatOf(2, 2), null);
  for (const b of BUILDINGS) {
    assert.equal(g.tileAt(b.door[0], b.door[1]), 'path', `${b.id} door stands on a path`);
    assert.ok(g.solid(b.x, b.y) && g.solid(b.x + b.w - 1, b.y + b.h - 1), `${b.id} is solid`);
  }
  assert.equal(BUILDINGS.length, 10);
  assert.ok(g.solid(12, 10), 'the notice board blocks the tile');
  assert.ok(g.trees.length >= 18 && g.rocks.length === 4 && g.flowers.length >= 10);
  assert.ok(g.trees.every((tr) => !g.buildingAt(tr.x, tr.y) && g.tileAt(tr.x, tr.y) === 'grass'));
});

test('walking, running and collisions', () => {
  const g = fresh();
  stand(g, 4, 10, 1);
  ticks(g, 1, { dx: 1, dy: 0, run: false });
  assert.ok(Math.abs(g.x - 7.7) < 0.15, `walked ~3.2 tiles, at ${g.x}`);
  stand(g, 4, 10, 1);
  ticks(g, 1, { dx: 1, dy: 0, run: true });
  assert.ok(g.x > 9.5, 'running is faster');
  stand(g, 4, 9, 0);
  ticks(g, 2, { dx: 0, dy: -1, run: true });
  assert.ok(g.y > 9, 'your burrow blocks the way north');
  assert.equal(g.facing, 0);
  stand(g, 2, H - 5, 2);
  ticks(g, 2, { dx: 0, dy: 1, run: true });
  assert.ok(g.y < H - 3, 'the sea is not walkable');
});

test('the clock runs, days roll over and seasons turn', () => {
  const g = fresh();
  assert.equal(g.day, 1);
  assert.equal(g.season, 'spring');
  assert.equal(g.clockText, '08:00');
  setHour(g, 23.99);
  ticks(g, 1);
  assert.equal(g.day, 2);
  assert.ok(g.hour < 1);
  g.day = 5; assert.equal(g.season, 'summer');
  g.day = 13; assert.equal(g.season, 'winter');
  g.day = 17; assert.equal(g.season, 'spring'); assert.equal(g.year, 2); assert.equal(g.dayOfYear, 1);
  setHour(g, 20); assert.ok(g.isNight);
  setHour(g, 12); assert.ok(!g.isNight);
});

test('weather is deterministic per day and snows in winter', () => {
  const a = new Hollow('dora', 7), b = new Hollow('dora', 7);
  for (let d = 1; d <= 40; d++) { a.day = d; b.day = d; assert.equal(a.weather, b.weather); }
  const days = Array.from({ length: 64 }, (_, i) => { a.day = i + 1; return a.weather; });
  assert.ok(days.includes('rain') && days.includes('clear'), 'some rain, some sun');
  assert.ok(days.some((w, i) => w === 'snow' && Math.floor(i / 4) % 4 === 3), 'winter rain falls as snow');
  assert.ok(!days.some((w, i) => w === 'rain' && Math.floor(i / 4) % 4 === 3), 'never rain in winter');
});

test('shaking a tree drops three apples, leaves and a reaction, then waits for tomorrow', () => {
  const g = fresh();
  const tree = g.trees[0];
  stand(g, tree.x, tree.y + 1, 0);
  for (let i = 0; i < 3; i++) assert.match(g.interact(), /Shook loose/);
  assert.equal(g.pockets.length, 3);
  assert.equal(g.pockets[0].kind, 'fruit');
  assert.equal(g.pockets[0].price, FRUIT_PRICE.native);
  assert.ok(g.effects.some((e) => e.kind === 'fruit') && g.effects.some((e) => e.kind === 'leaf'), 'fruit tumbles and leaves shake');
  assert.equal(g.reaction.icon, '♪');
  assert.match(g.interact(), /No fruit today/);
  ticks(g, 1.5);
  assert.equal(g.effects.length, 0, 'effects fade');
  assert.equal(g.reaction, null);
  sleep(g);
  assert.equal(tree.count, 3, 'fruit regrows overnight');
  assert.equal(g.stats.fruit, 3);
});

test('fishing: nibbles, the bite, hooking and reeling', () => {
  const g = fresh();
  g.setTool('rod');
  stand(g, 17, 5, 1);
  assert.match(g.interact(), /Cast/);
  assert.ok(g.fishing && g.fishing.phase === 'wait');
  assert.ok([1, 2, 3].includes(g.fishing.size), 'the shadow has a size');
  assert.match(g.interact(), /Too early/, 'hooking before the bite loses it');
  assert.equal(g.fishing, null);
  // Force nibbles and check they spook when pressed.
  g.interact(); g.fishing.nibbles = 1; g.fishing.timer = 0.05; ticks(g, 0.1);
  assert.equal(g.fishing.phase, 'nibble');
  assert.match(g.interact(), /Just a nibble/);
  // Bite → hook → reel → land.
  g.interact(); g.fishing.nibbles = 0; g.fishing.timer = 0.05; ticks(g, 0.1);
  assert.equal(g.fishing.phase, 'bite');
  assert.match(g.interact(), /Hooked/);
  assert.equal(g.fishing.phase, 'reel');
  for (let i = 0; i < 400 && g.fishing; i++) g.step(0.05, { dx: 0, dy: 0, run: false, hold: g.fishing.tension < 0.6 });
  assert.equal(g.pockets.length, 1);
  assert.equal(g.pockets[0].kind, 'fish');
  assert.equal(FISH.find((f) => f.id === g.pockets[0].id).habitat, 'river');
  assert.equal(g.stats.fish, 1);
  assert.ok(g.caught.includes(g.pockets[0].id));
  assert.ok(g.effects.some((e) => e.kind === 'splash'));
  // Holding the whole time snaps the line on a fighter.
  g.interact(); g.fishing.nibbles = 0; g.fishing.timer = 0.05; ticks(g, 0.1); g.interact();
  g.fishing.fight = 0.9;
  for (let i = 0; i < 400 && g.fishing; i++) g.step(0.05, { dx: 0, dy: 0, run: false, hold: true });
  assert.match(g.message, /Snap|Caught/);
  // Never reeling lets it slip.
  g.interact(); g.fishing.nibbles = 0; g.fishing.timer = 0.05; ticks(g, 0.1); g.interact();
  for (let i = 0; i < 100 && g.fishing; i++) g.step(0.05);
  assert.match(g.message, /slipped/);
  // Missing the bite window loses it; walking away cancels the cast.
  g.interact(); g.fishing.nibbles = 0; g.fishing.timer = 0.05; ticks(g, 0.1);
  ticks(g, BITE_WINDOW + 0.2);
  assert.equal(g.fishing, null);
  assert.match(g.message, /got away/);
  g.interact();
  g.step(0.1, { dx: -1, dy: 0, run: false });
  assert.equal(g.fishing, null);
  stand(g, 17, 5, 1);
  g.setTool('hands');
  g.tools = ['hands', 'net'];
  assert.match(g.interact(), /need a rod/);
});

test('fish respect season, time of day and habitat', () => {
  const g = fresh();
  g.setTool('rod');
  const catchOne = (x, y, facing, hour, day) => {
    g.pockets = []; setHour(g, hour); g.day = day; stand(g, x, y, facing);
    for (let tries = 0; tries < 6 && !g.pockets.length; tries++) fishOnce(g);
    return g.pockets[0];
  };
  for (let i = 0; i < 12; i++) {
    const f = catchOne(10, H - 4, 2, 12, 1);
    const s = FISH.find((s) => s.id === f.id);
    assert.equal(s.habitat, 'sea');
    assert.notEqual(s.time, 'night');
    assert.ok(s.seasons.includes('spring'));
  }
  for (let i = 0; i < 12; i++) {
    const f = catchOne(5, 3, 1, 22, 2);
    const s = FISH.find((s) => s.id === f.id);
    assert.equal(s.habitat, 'pond');
    assert.notEqual(s.time, 'day');
  }
  assert.equal(FISH.length, 15);
  assert.ok(FISH.some((f) => f.seasons.length === 1 && f.seasons[0] === 'autumn' && f.rarity === 1), 'autumn has a rare fish');
});

test('bugs spawn for the season and time, flee from runners, and the net catches them', () => {
  const g = fresh();
  setHour(g, 12);
  ticks(g, 60);
  assert.ok(g.bugs.length > 0, 'bugs appear on a spring afternoon');
  for (const b of g.bugs) {
    const s = BUGS.find((s) => s.id === b.id);
    assert.ok(s.seasons.includes('spring') && s.time !== 'night', `${b.id} belongs to a spring day`);
  }
  const bug = g.bugs[0];
  g.setTool('net');
  stand(g, Math.floor(bug.x), Math.floor(bug.y) + 1, 0);
  const before = g.bugs.length;
  assert.match(g.interact(), /Caught a/);
  assert.equal(g.bugs.length, before - 1);
  assert.equal(g.pockets[0].kind, 'bug');
  assert.equal(g.stats.bugs, 1);
  assert.equal(g.reaction.icon, '!');
  // Running at a bug scares it off.
  g.bugs = [{ id: 'butterfly', x: 20.5, y: 4.5, vx: 0, vy: 0, life: 40, shy: false, fleeing: false }];
  stand(g, 20, 5, 0);
  g.step(0.1, { dx: 0, dy: -1, run: true });
  const scared = g.bugs[0];
  assert.ok(scared.fleeing, 'a runner within a tile scares a bold bug');
  ticks(g, 2);
  assert.ok(!g.bugs.includes(scared), 'a fleeing bug leaves');
  // Walking up slowly to a bold bug is fine; shy bugs flee even from walkers.
  g.bugs = [{ id: 'butterfly', x: 20.5, y: 4.5, vx: 0, vy: 0, life: 40, shy: false, fleeing: false }, { id: 'stag', x: 24.5, y: 4.5, vx: 0, vy: 0, life: 40, shy: true, fleeing: false }];
  stand(g, 20, 5.2, 0);
  g.step(0.1, { dx: 0, dy: -1, run: false });
  assert.ok(!g.bugs[0].fleeing, 'walking does not scare a bold bug');
  stand(g, 24, 4.9, 0);
  g.step(0.1, { dx: 0, dy: -1, run: false });
  assert.ok(g.bugs[1].fleeing, 'a shy bug flees a walker within a tile');
  // Winter has its own bugs.
  assert.ok(BUGS.filter((b) => b.seasons.includes('winter')).length >= 3);
  assert.equal(BUGS.length, 14);
  ticks(g, 200);
  assert.ok(g.bugs.length <= 6);
  sleep(g);
  assert.equal(g.bugs.length, 0);
});

test('rocks pay out four times a day and the shovel is auto-selected', () => {
  const g = fresh();
  const rock = g.rocks[0];
  stand(g, rock.x, rock.y + 1, 0);
  assert.match(g.interact(), /shovel might/);
  g.tools.push('shovel'); g.setTool('hands');
  const start = g.raisins;
  assert.match(g.interact(), /Clang/);
  assert.equal(g.tool, 'shovel', 'owning a shovel is enough; the game swaps to it');
  for (let i = 1; i < ROCK_HITS; i++) g.interact();
  assert.equal(g.raisins - start, ROCK_DROPS.reduce((a, b) => a + b));
  assert.match(g.interact(), /given all/);
  sleep(g);
  assert.equal(rock.hits, 0);
});

test('fossils come up unidentified, Bubo assesses them, then they can be donated once', () => {
  const g = fresh();
  assert.equal(g.fossils.length, FOSSILS_PER_DAY);
  const f = g.fossils[0];
  stand(g, f.x, f.y + 1, 0);
  assert.match(g.interact(), /buried/);
  g.tools.push('shovel');
  assert.match(g.interact(), /Dug up a fossil/);
  assert.equal(g.fossils.length, FOSSILS_PER_DAY - 1);
  assert.equal(g.pockets[0].id, 'unknown');
  assert.equal(g.pockets[0].price, 0);
  assert.equal(g.stats.fossils, 0, 'not counted until assessed');
  g.screen = 'shop';
  assert.match(g.sell(0), /No idea/);
  g.screen = 'museum';
  assert.match(g.donate(0), /assess that first/);
  assert.match(g.assess(), /Fascinating/);
  assert.ok(FOSSILS.some((s) => s.id === g.pockets[0].id));
  assert.equal(g.stats.fossils, 1);
  assert.ok(g.caught.includes(g.pockets[0].id));
  assert.match(g.assess(), /Nothing to assess/);
  g.pockets.push(g.itemFor('fossil', g.pockets[0].id));
  assert.match(g.donate(0), /Displayed with pride/);
  assert.match(g.donate(0), /already have/);
  assert.equal(g.donated.length, 1);
  g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.match(g.donate(g.pockets.length - 1), /only display/);
  sleep(g);
  assert.equal(g.fossils.length, FOSSILS_PER_DAY, 'fresh fossils every morning');
});

test('flowers: pick, water, breed and hybridise', () => {
  const g = fresh();
  g.flowers = [{ x: 3, y: 3, color: 'red', watered: false }, { x: 4, y: 3, color: 'yellow', watered: false }];
  g.trees = g.trees.filter((t) => Math.abs(t.x - 3.5) > 2 || Math.abs(t.y - 3) > 2);
  g.rocks = []; g.fossils = [];
  stand(g, 3, 4, 0);
  assert.match(g.interact(), /Picked/);
  g.pockets = []; g.flowers.unshift({ x: 3, y: 3, color: 'red', watered: false });
  g.tools.push('can'); g.setTool('can');
  assert.match(g.interact(), /Watered/);
  stand(g, 4, 4, 0);
  g.interact();
  assert.ok(g.flowers.every((f) => f.watered));
  let hybrids = 0, total = 0;
  for (let i = 0; i < 40; i++) {
    g.flowers = [{ x: 3, y: 3, color: 'red', watered: true }, { x: 4, y: 3, color: 'yellow', watered: true }];
    sleep(g);
    total += g.flowers.length - 2;
    hybrids += g.flowers.filter((f) => f.color === 'orange').length;
    assert.ok(g.flowers.every((f) => !f.watered), 'watering wears off overnight');
  }
  assert.ok(total > 5, `watered neighbours breed (${total})`);
  assert.ok(hybrids > 0, 'red and yellow can make orange');
  assert.equal(HYBRIDS['red+yellow'], 'orange');
  g.setTool('hands');
  g.flowers = [{ x: 3, y: 3, color: 'orange', watered: false }];
  stand(g, 3, 4, 0);
  g.interact();
  assert.equal(g.pockets[0].price, FLOWER_PRICE.hybrid);
});

test('planting seeds and fruit with the shovel', () => {
  const g = fresh();
  g.tools.push('shovel'); g.setTool('shovel');
  const spot = (() => { for (let y = 2; y < 8; y++) for (let x = 2; x < 6; x++) if (g.freeGrass(x, y) && !g.solid(x, y + 1)) return [x, y]; })();
  stand(g, spot[0], spot[1] + 1, 0);
  assert.match(g.interact(), /Select seeds/);
  g.pockets.push(g.itemFor('seed', 'white'));
  g.select(0);
  assert.match(g.interact(), /Planted white/);
  assert.ok(g.flowerAt(spot[0], spot[1]));
  g.flowers = g.flowers.filter((f) => f.x !== spot[0] || f.y !== spot[1]);
  g.pockets.push(g.itemFor('fruit', 'peach'));
  g.select(0);
  assert.match(g.interact(), /sapling/);
  const tree = g.treeAt(spot[0], spot[1]);
  assert.equal(tree.grown, g.day + SAPLING_DAYS);
  for (let i = 0; i < SAPLING_DAYS; i++) sleep(g);
  assert.equal(tree.grown, 0);
  assert.equal(tree.count, 3);
  g.setTool('hands');
  g.interact();
  assert.equal(g.pockets[0].price, FRUIT_PRICE.foreign, 'peaches are foreign fruit');
});

test('pockets: twenty slots, pins, sorting and the selection following its item', () => {
  const g = fresh();
  for (let i = 0; i < POCKETS; i++) g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.ok(g.full);
  assert.equal(g.addItem(g.itemFor('fruit', 'apple')), false);
  assert.match(g.message, /pockets are full/);
  g.select(3); assert.equal(g.selected, 3);
  g.select(3); assert.equal(g.selected, -1, 'selecting again deselects');
  g.pockets = [g.itemFor('fruit', 'apple'), g.itemFor('fish', 'koi'), g.itemFor('bug', 'moth'), g.itemFor('fish', 'trout')];
  g.select(2);
  g.togglePin(0);
  g.sortPockets();
  assert.deepEqual(g.pockets.map((p) => p.id), ['apple', 'koi', 'trout', 'moth'], 'pinned first, then kind, then value');
  assert.equal(g.pockets[g.selected].id, 'moth', 'selection follows the item');
  g.screen = 'shop';
  g.sellAll();
  assert.deepEqual(g.pockets.map((p) => p.id), ['apple'], 'pinned items are not sold');
});

test('Vito’s Emporium: hours, tools, seeds, stock, selling and the fruit market', () => {
  const g = fresh();
  stand(g, ...by('shop').door, 0);
  setHour(g, 6);
  assert.match(g.interact(), /opens 8:00/);
  assert.equal(g.screen, 'world');
  setHour(g, SHOP_OPEN + 1);
  g.interact();
  assert.equal(g.screen, 'shop');
  assert.match(g.buy('shovel'), /600 raisins/);
  g.raisins = 1000;
  assert.match(g.buy('shovel'), /Bought shovel/);
  assert.equal(g.raisins, 1000 - TOOL_PRICES.shovel);
  assert.match(g.buy('shovel'), /already own/);
  assert.match(g.buy('red'), /Bought red seeds/);
  assert.equal(g.pockets[0].kind, 'seed');
  assert.equal(g.stock.length, 3);
  assert.ok(g.stock.every((f) => f.shop), 'the trophy is never for sale');
  assert.deepEqual(g.stock.map((f) => f.id), new Hollow('dora', 7).stock.map((f) => f.id), 'stock is fixed per day');
  assert.equal(g.buy('trophy'), '');
  const piece = g.stock[0];
  g.raisins = piece.price;
  assert.match(g.buy(piece.id), /Bought/);
  assert.match(g.buy(piece.id), /already have/);
  g.pockets.push(g.itemFor('fish', 'koi'), g.itemFor('bug', 'moth'), g.itemFor('fruit', 'apple'));
  assert.match(g.sell(2), /4000 raisins/);
  assert.equal(g.raisins, 4000);
  const rate = g.fruitRate;
  assert.ok(rate >= 0.7 && rate <= 1.5);
  assert.equal(g.valueOf(g.itemFor('fruit', 'apple')), Math.round(100 * rate));
  g.day += 1;
  assert.ok(Array.from({ length: 30 }, (_, i) => { g.day = i + 1; return g.fruitRate; }).some((r) => r !== rate), 'the market moves day to day');
  g.day = 1;
  assert.match(g.sellAll(), /Sold 2 things for/);
  assert.equal(g.pockets.length, 2, 'seeds and furniture are kept');
  g.exit();
  assert.equal(g.buy('shovel'), '', 'no shopping from outside');
});

test('home: a room grid that grows with the burrow, move and pick up, sleep to morning', () => {
  const g = fresh();
  stand(g, ...by('home').door, 0);
  g.interact();
  assert.equal(g.screen, 'home');
  assert.deepEqual(g.roomSize, HOME_GRID[0]);
  g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.match(g.place(0, 0, 0), /Only furniture/);
  for (const f of FURNITURE.slice(0, 3)) g.pockets.push(g.itemFor('furniture', f.id));
  assert.match(g.place(1, 0, 0), /Placed/);
  assert.match(g.place(1, 0, 0), /already there/);
  assert.match(g.place(1, 5, 5), /outside the room/);
  assert.match(g.place(1, 2, 1), /Placed/);
  assert.equal(g.furniture.length, 2);
  assert.match(g.moveFurniture(g.furniture[0], 1, 1), /Moved/);
  assert.deepEqual([g.furniture[0].x, g.furniture[0].y], [1, 1]);
  assert.match(g.pickUp(g.furniture[1]), /Picked up/);
  assert.equal(g.furniture.length, 1);
  assert.equal(g.pockets.filter((p) => p.kind === 'furniture').length, 2);
  setHour(g, 21);
  const day = g.day;
  assert.ok(g.sleep());
  assert.equal(g.day, day + 1);
  assert.equal(Math.round(g.hour), WAKE);
  g.exit();
  assert.equal(g.sleep(), false, 'you can only sleep at home');
});

test('the loan: pay in parts, level up, next loan, then free and clear', () => {
  const g = fresh();
  assert.equal(g.debt, LOANS[0]);
  stand(g, ...by('friend').door, 0);
  g.interact();
  assert.ok(g.dialog && g.dialog.speaker === 'Enzo');
  g.choose(0);
  assert.match(g.message, /Not a single raisin/);
  g.raisins = 800;
  g.interact(); g.choose(0);
  assert.equal(g.debt, LOANS[0] - 800);
  g.raisins = LOANS[0];
  g.interact(); g.choose(0);
  assert.equal(g.homeLevel, 1);
  assert.equal(g.debt, LOANS[1]);
  assert.deepEqual(g.roomSize, HOME_GRID[1]);
  g.raisins = LOANS[1] + LOANS[2];
  g.interact(); g.choose(0);
  g.interact(); g.choose(0);
  assert.equal(g.homeLevel, 3);
  assert.equal(g.debt, 0);
  g.interact();
  assert.match(g.dialog.text, /all paid for/);
  g.choose(0);
});

test('neighbours: talking, gifts, requests, memory and friendship', () => {
  const g = new Hollow('enzo', 3);
  assert.equal(g.friendName, 'Dora');
  const pia = g.villagers.find((v) => v.id === 'pia');
  setHour(g, 12);
  g.day = 3; // not her birthday
  stand(g, 20, 11, 1);
  park(g);
  pia.x = pia.tx = 21.5; pia.y = pia.ty = 11.5;
  assert.equal(g.villagerNear(), pia);
  g.interact();
  assert.equal(g.dialog.speaker, 'Pia');
  assert.equal(g.friendship.pia, 1, 'the first chat of the day counts');
  g.choose(g.dialog.options.length - 1);
  g.interact(); g.choose(0);
  assert.equal(g.friendship.pia, 1, 'a second chat the same day does not');
  g.requests = g.requests.map((r) => (r.villager === 'pia' ? { ...r, kind: 'fish' } : r));
  g.pockets.push(g.itemFor('fruit', 'apple'), g.itemFor('fruit', 'apple'), g.itemFor('fish', 'trout'));
  g.select(0);
  g.interact();
  assert.equal(g.dialog.options[0].action, 'gift');
  g.choose(0);
  assert.equal(g.friendship.pia, 2, 'a gift she is lukewarm on is +1');
  assert.deepEqual(g.gifts.pia, ['apple']);
  g.select(0);
  g.interact(); g.choose(0);
  assert.equal(g.friendship.pia, 2, 'the same gift again earns nothing');
  assert.match(g.message, /Another apple/);
  g.select(0);
  g.interact();
  assert.match(g.dialog.text, /wanting a fish/);
  assert.equal(g.dialog.options[0].action, 'deliver');
  const raisins = g.raisins;
  g.choose(0);
  assert.equal(g.friendship.pia, 5, 'delivering a request is +3');
  assert.ok(g.raisins === raisins + 300 || g.pockets[0]?.kind === 'fruit', 'rewards are raisins or foreign fruit');
  assert.ok(g.requests.find((r) => r.villager === 'pia').done);
  let mentioned = false;
  for (let i = 0; i < 40 && !mentioned; i++) { g.interact(); mentioned = /Still have that trout/.test(g.dialog.text); g.choose(g.dialog.options.length - 1); }
  assert.ok(mentioned, 'she sometimes remembers the last gift');
  setHour(g, 23);
  assert.equal(g.villagerNear(), null, 'everyone is indoors after bedtime');
  sleep(g);
  assert.equal(g.talked.length, 0);
  assert.ok(g.requests.every((r) => !r.done), 'new requests each day');
});

test('birthdays: the board announces them and a gift is worth much more', () => {
  const g = fresh();
  g.day = BIRTHDAYS.rodri;
  assert.ok(g.isBirthday('rodri'));
  assert.ok(g.notices.some((n) => /Rodri’s birthday today/.test(n)));
  g.day = BIRTHDAYS.rodri - 1;
  assert.ok(g.notices.some((n) => /Rodri’s birthday is in 1 day/.test(n)));
  g.day = BIRTHDAYS.rodri;
  const rodri = g.villagers.find((v) => v.id === 'rodri');
  setHour(g, 12);
  stand(g, 20, 11, 1);
  rodri.x = rodri.tx = 21.5; rodri.y = rodri.ty = 11.5;
  g.pockets.push(g.itemFor('fish', 'trout'));
  g.select(0);
  g.interact();
  assert.match(g.dialog.text, /my birthday/);
  g.choose(0);
  assert.equal(g.friendship.rodri, 1 + 1 + BIRTHDAY_BONUS);
  assert.match(g.message, /remembered my birthday/);
  g.day += 16;
  assert.ok(g.isBirthday('rodri'), 'birthdays repeat every 16-day year');
});

test('late arrivals move in as goals are met', () => {
  const g = fresh();
  assert.equal(g.residents.length, 5);
  assert.ok(!g.requests.some((r) => r.villager === 'lupe'));
  stand(g, ...by('house-lupe').door, 0);
  assert.match(g.interact(), /empty plot/);
  g.goals = ['a', 'b', 'c', 'd'];
  g.step(0.1);
  assert.ok(g.arrived.includes('lupe'));
  assert.equal(g.residents.length, 6);
  assert.ok(g.requests.some((r) => r.villager === 'lupe'));
  assert.match(g.message, /Lupe the llama has moved in/);
  g.goals.push('e', 'f', 'g', 'h');
  g.step(0.1);
  assert.ok(g.arrived.includes('nico'));
  assert.equal(g.residents.length, 7);
  assert.equal(NEIGHBOURS.filter((v) => v.arrives).length, 2);
});

test('villagers wander by day and stay home at night', () => {
  const g = new Hollow('dora', 7);
  setHour(g, 12);
  const start = g.residents.map((v) => [v.x, v.y]);
  ticks(g, 30);
  assert.ok(g.residents.some((v, i) => Math.hypot(v.x - start[i][0], v.y - start[i][1]) > 0.5), 'they move around');
  assert.ok(g.residents.every((v) => !g.solid(Math.floor(v.x), Math.floor(v.y))), 'never into walls or water');
  setHour(g, BEDTIME + 0.5);
  const pos = g.villagers.map((v) => [v.x, v.y]);
  ticks(g, 10);
  assert.deepEqual(g.villagers.map((v) => [v.x, v.y]), pos, 'nobody moves after bedtime');
});

test('the notice board: festival countdown, market, visits and rain', () => {
  const g = fresh();
  stand(g, 12, 11, 0);
  g.interact();
  assert.equal(g.screen, 'board');
  const n = g.notices;
  assert.ok(n.some((s) => /Fishing Tourney in 3 days/.test(s)));
  assert.ok(n.some((s) => /fruit market/.test(s)));
  assert.ok(n.some((s) => /is visiting/.test(s)));
  assert.ok(n.some((s) => /Lupe the llama is thinking of moving in/.test(s)));
  g.exit();
  assert.equal(g.screen, 'world');
});

test('festivals: the tourney scores fish by value and pays out at midnight', () => {
  const g = fresh();
  g.day = 4;
  assert.equal(g.festival, 'tourney');
  setHour(g, 12);
  const board = g.festivalBoard;
  assert.equal(board.length, g.residents.length + 1);
  assert.ok(board.find((r) => r.you).score === 0);
  g.today.fish = 999999;
  assert.equal(g.festivalBoard[0].you, true);
  const raisins = g.raisins;
  setHour(g, 23.99);
  ticks(g, 1);
  assert.equal(g.day, 5);
  assert.equal(g.raisins, raisins + FESTIVAL_PRIZES[0]);
  assert.ok(g.pockets.some((p) => p.id === 'trophy'), 'first place wins the trophy');
  assert.match(g.message, /won the Fishing Tourney/);
  assert.equal(g.stats.festivals, 1);
  assert.deepEqual(g.today, { fish: 0, bugs: 0 });
  // Bug-off on the last day of summer, snowman day in winter.
  g.day = 8; assert.equal(g.festival, 'bugoff');
  g.day = 16; assert.equal(g.festival, 'snowday');
  g.day = 9; assert.equal(g.festival, null);
  // Entering with no catch pays nothing.
  g.day = 4; setHour(g, 23.99); g.pockets = []; const r2 = g.raisins; ticks(g, 1);
  assert.equal(g.raisins, r2);
});

test('snowman day: roll three snowballs by paw', () => {
  const g = fresh();
  g.day = 15; setHour(g, 23.99); ticks(g, 1);
  assert.equal(g.festival, 'snowday');
  assert.equal(g.snowballs.length, SNOWBALLS);
  const s = g.snowballs[0];
  stand(g, s.x, s.y + 1, 0);
  g.tools.push('shovel'); g.setTool('shovel');
  assert.match(g.interact(), /rolled by paw/);
  g.setTool('hands');
  const r = g.raisins;
  assert.match(g.interact(), /fine snowman/);
  assert.equal(g.raisins, r + SNOWMAN_PRIZE);
  assert.ok(g.snowmanAt(s.x, s.y) && g.solid(s.x, s.y));
  assert.equal(g.stats.snowmen, 1);
  sleep(g);
  assert.equal(g.snowmen.length, 0);
  assert.equal(g.snowballs.length, 0);
});

test('shells wash up on the sand every day', () => {
  const g = fresh();
  assert.equal(g.shells.length, SHELLS_PER_DAY);
  assert.ok(g.shells.every((s) => g.tileAt(s.x, s.y) === 'sand'));
  const s = g.shells[0];
  stand(g, s.x, s.y - 1, 2);
  assert.match(g.interact(), /Picked up/);
  assert.equal(g.pockets[0].kind, 'shell');
  assert.ok(g.pockets[0].price >= 90);
  assert.equal(g.shells.length, SHELLS_PER_DAY - 1);
  sleep(g);
  assert.equal(g.shells.length, SHELLS_PER_DAY);
});

test('summer shooting stars grant a wish that pays out next morning', () => {
  const g = fresh();
  g.day = 5;
  for (let d = 5; d <= 8; d++) { g.day = d; if (g.weather === 'clear') break; }
  assert.equal(g.weather, 'clear');
  setHour(g, 21);
  g.trees = []; g.flowers = []; g.rocks = []; g.fossils = [];
  stand(g, 3, 3, 0);
  ticks(g, 40);
  let seen = false;
  for (let i = 0; i < 600 && !seen; i++) { g.step(0.1); seen = g.star > 0; }
  assert.ok(seen, 'a star streaks by within a minute');
  assert.match(g.peek().hint, /wish/);
  assert.match(g.interact(), /wished on the star/);
  assert.ok(g.wished);
  g.star = 3;
  assert.match(g.interact(), /already wished/);
  const r = g.raisins, n = g.pockets.length;
  sleep(g);
  assert.ok(g.raisins === r + WISH_PRIZE || g.pockets.length === n + 1, 'a fruit or raisins by the door');
  assert.equal(g.stats.wishes, 1);
  assert.ok(!g.wished);
  g.day = 1; setHour(g, 21); g.star = 0; g.starTimer = 0;
  ticks(g, 60);
  assert.equal(g.star, 0, 'no stars outside summer');
});

test('peek names what you face and what the button will do', () => {
  const g = fresh();
  const tree = g.trees[0];
  stand(g, tree.x, tree.y + 1, 0);
  assert.deepEqual(g.peek(), { target: 'Apple tree', hint: 'Shake (3 left)' });
  stand(g, 17, 5, 1);
  assert.equal(g.peek().target, 'The river');
  stand(g, ...by('shop').door, 0);
  setHour(g, 5);
  assert.match(g.peek().hint, /Closed until 8/);
  stand(g, 12, 11, 0);
  assert.equal(g.peek().target, 'Notice board');
  const f = g.fossils[0];
  stand(g, f.x, f.y + 1, 0);
  assert.equal(g.peek().hint, 'Needs a shovel');
});

test('live mode follows the real clock and southern seasons', () => {
  const g = fresh();
  const noon = new Date(2026, 0, 15, 12, 30, 0); // January: summer in the Andes
  g.setLive(true, noon);
  assert.ok(g.live);
  assert.equal(g.clockText, '12:30');
  assert.equal(g.season, 'summer');
  ticks(g, 5);
  assert.equal(g.clockText, '12:30', 'the village clock no longer advances on its own');
  const day = g.day;
  g.syncLive(new Date(2026, 6, 16, 8, 0, 0)); // July: winter, a new date
  assert.equal(g.day, day + 1, 'a new calendar date rolls the day');
  assert.equal(g.season, 'winter');
  g.screen = 'home';
  assert.equal(g.sleep(), false, 'no sleeping through a real day');
  g.exit();
  g.setLive(false);
  assert.ok(!g.live);
  assert.equal(g.season, 'spring', 'village seasons return');
});

test('goals pay out as they are met, once each', () => {
  const g = fresh();
  g.stats.fish = 1;
  const done = g.checkGoals();
  assert.equal(done[0].id, 'fish');
  assert.equal(g.raisins, GOALS[0].reward);
  assert.equal(g.reaction.icon, '★');
  assert.equal(g.checkGoals().length, 0);
  g.homeLevel = 1;
  g.step(0.1);
  assert.ok(g.goals.includes('loan'), 'goals are checked every step');
  assert.equal(GOALS.length, 11);
});

test('save and load round-trip, including a v1 save', () => {
  const g = new Hollow('enzo', 11);
  g.raisins = 1234; g.debt = 100; g.homeLevel = 1; g.tools.push('shovel'); g.tool = 'shovel';
  g.pockets.push(g.itemFor('fish', 'koi'), g.unknownFossil('egg')); g.pockets[0].pinned = true;
  g.furniture.push({ id: 'bed', x: 1, y: 0 }); g.donated.push('koi'); g.friendship.pia = 4; g.talked.push('pia'); g.goals.push('fish'); g.gifts.pia = ['koi'];
  g.flowers.push({ x: 2, y: 2, color: 'blue', watered: true }); g.day = 9; g.clock = 100; g.x = 12.2; g.y = 13.7; g.stats.fish = 3; g.caught.push('koi'); g.today.fish = 500; g.wished = true; g.arrived.push('lupe');
  const s = JSON.parse(JSON.stringify(g.save()));
  assert.equal(s.v, 2);
  const h = Hollow.load(s);
  assert.equal(h.friendName, 'Dora');
  assert.deepEqual(h.pockets, g.pockets); assert.deepEqual(h.furniture, [{ id: 'bed', x: 1, y: 0 }]);
  assert.equal(h.friendship.pia, 4); assert.deepEqual(h.gifts, { pia: ['koi'] }); assert.deepEqual(h.arrived, ['lupe']);
  assert.deepEqual(h.flowers, g.flowers); assert.deepEqual(h.shells, g.shells);
  assert.equal(h.day, 9); assert.equal(h.x, 12.2); assert.deepEqual(h.today, { fish: 500, bugs: 0 }); assert.ok(h.wished);
  assert.deepEqual(h.save(), g.save(), 'saving again gives the same data');
  const v1 = { ...s, v: 1, furniture: ['bed', 'rug', 'lamp'], homeLevel: 1, goals: ['a', 'b', 'c', 'd'] };
  delete v1.shells; delete v1.snowballs; delete v1.snowmen; delete v1.gifts; delete v1.today; delete v1.wished; delete v1.live; delete v1.liveKey; delete v1.arrived;
  const old = Hollow.load(v1);
  assert.deepEqual(old.furniture, [{ id: 'bed', x: 0, y: 0 }, { id: 'rug', x: 1, y: 0 }, { id: 'lamp', x: 2, y: 0 }], 'v1 furniture lands on the grid');
  assert.deepEqual(old.arrived, ['lupe'], 'v1 saves with enough goals get their arrivals');
  assert.equal(old.shells.length, 3);
});

test('the same seed and inputs replay identically', () => {
  const play = () => {
    const g = new Hollow('dora', 5);
    setHour(g, 12);
    g.setTool('rod');
    for (let i = 0; i < 4; i++) { stand(g, 17, 5, 1); fishOnce(g); }
    ticks(g, 60, { dx: 1, dy: 0.3, run: true });
    return JSON.stringify([g.save(), g.bugs, g.effects]);
  };
  assert.equal(play(), play());
});

console.log(`Dusty Hollow: ${checks} checks passed.`);
