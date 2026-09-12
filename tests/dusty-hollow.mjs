import assert from 'node:assert/strict';
import {
  Hollow, W, H, DAY, POCKETS, LOANS, HOME_GRID, BITE_WINDOW, ROCK_HITS, ROCK_DROPS, FOSSILS_PER_DAY, SHELLS_PER_DAY, SAPLING_DAYS, SHOP_OPEN,
  FISH, BUGS, FOSSILS, FURNITURE, GOALS, BUILDINGS, NEIGHBOURS, BIRTHDAYS, STREET_Y, TOOL_PRICES, FRUIT_PRICE, FLOWER_PRICE, HYBRIDS, WAKE, BEDTIME,
  FESTIVAL_PRIZES, SNOWMAN_PRIZE, SNOWBALLS, WISH_PRIZE, BIRTHDAY_BONUS, makeTerrain,
  SNEAK, WING_REWARD, SET_BONUS, BALLOON_PRIZE, GOLDEN_FRUIT, VISIT_FRIENDSHIP, HAUNTS, WINGS, SETS, DAYS_PER_SEASON, JACKPOTS, FRIEND_MAX, SEASONS, CEREMONY_LINES, TOOL_NAMES,
} from '../.checks/dusty-hollow-game.js';

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const idle = { dx: 0, dy: 0, run: false };
const ticks = (g, seconds, input = idle) => { for (let i = 0, n = Math.round(seconds * 10); i < n; i++) g.step(0.1, input); };
const setHour = (g, h) => { g.clock = (h / 24) * DAY; };
/** Stand the hero on a tile facing a direction. */
const stand = (g, x, y, facing) => { g.x = x + 0.5; g.y = y + 0.5; g.facing = facing; };
const by = (id) => BUILDINGS.find((b) => b.id === id);
const park = (g) => { g.escort = false; g.villagers.forEach((v) => { v.x = v.tx = -5; v.y = v.ty = -5; }); };
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
    for (let tries = 0; tries < 6 && !g.pockets.some((p) => p.kind === 'fish'); tries++) fishOnce(g);
    return g.pockets.find((p) => p.kind === 'fish');
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
  assert.equal(FISH.length, 18);
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
  assert.equal(BUGS.length, 15);
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
  assert.match(g.assess(), /aha!/);
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
  g.raisins = g.priceOf(piece);
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
  g.escort = false;
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
  const r = g.raisins, n = g.pockets.length, hearts = g.log.hearts;
  sleep(g);
  assert.ok(g.raisins === r + WISH_PRIZE || g.pockets.length === n + 1 || g.sunny > 0 || g.message.includes('cheerful'), 'raisins, a fruit, furniture, a cheerful hollow or a clear sky by the door');
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
  assert.equal(s.v, 3);
  const h = Hollow.load(s);
  assert.equal(h.friendName, 'Dora');
  assert.deepEqual(h.pockets, g.pockets); assert.deepEqual(h.furniture, [{ id: 'bed', x: 1, y: 0 }]);
  assert.equal(h.friendship.pia, 4); assert.deepEqual(h.gifts, { pia: ['koi'] }); assert.deepEqual(h.arrived, ['lupe']);
  assert.deepEqual(h.flowers, g.flowers); assert.deepEqual(h.shells, g.shells);
  assert.equal(h.day, 9); assert.equal(h.x, 12.2); assert.deepEqual(h.today, { fish: 500, bugs: 0 }); assert.ok(h.wished);
  assert.deepEqual(h.save(), g.save(), 'saving again gives the same data');
  const v1 = { ...s, v: 1, furniture: ['bed', 'rug', 'lamp'], homeLevel: 1, goals: ['a', 'b', 'c', 'd'] };
  delete v1.shells; delete v1.snowballs; delete v1.snowmen; delete v1.gifts; delete v1.today; delete v1.wished; delete v1.live; delete v1.liveKey; delete v1.arrived;
  delete v1.wingsDone; delete v1.setsDone; delete v1.sunny; delete v1.balloonDone; delete v1.visits; delete v1.log; delete v1.keepsakes; delete v1.jackpotTaken;
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

test('villagers keep a schedule and head for their haunts', () => {
  const g = new Hollow('dora', 7);
  g.escort = false;
  assert.equal(g.haunt('pia', 'afternoon').name, 'by the sea');
  assert.equal(g.whereabouts('tato', 'afternoon'), 'on the north cliff path');
  for (const v of g.villagers) assert.ok(HAUNTS[v.id], `${v.id} has a schedule`);
  setHour(g, 9); assert.equal(g.period, 'morning');
  setHour(g, 13); assert.equal(g.period, 'afternoon');
  setHour(g, 18); assert.equal(g.period, 'evening');
  setHour(g, 13);
  stand(g, 2, 21, 0);
  const pia = g.villagers.find((v) => v.id === 'pia'), h = g.haunt('pia');
  const before = Math.hypot(pia.x - h.x - 0.5, pia.y - h.y - 0.5);
  ticks(g, 90);
  const after = Math.hypot(pia.x - h.x - 0.5, pia.y - h.y - 0.5);
  assert.ok(after < before - 4, `Pia walks toward the sea in the afternoon (${before.toFixed(1)} → ${after.toFixed(1)})`);
  assert.ok(g.notices.some((n) => /This afternoon: .*Pia by the sea/.test(n)), 'the board says where everyone will be');
  assert.ok(g.residents.every((v) => !g.solid(Math.floor(v.x), Math.floor(v.y))));
});

test('the friend chips in from the bank on big fish and repeated snaps', () => {
  const g = fresh();
  setHour(g, 12);
  g.setTool('rod');
  stand(g, 17, 5, 1);
  g.interact();
  for (let i = 0; i < 200 && g.fishing.phase !== 'bite'; i++) g.step(0.1);
  g.interact();
  g.fishing.size = 3; g.fishing.species = 'koi'; g.fishing.progress = 0.99;
  assert.match(g.step(0.05, { dx: 0, dy: 0, run: false, hold: true }) ?? g.message, /monster/);
  assert.equal(g.snaps, 0);
  for (let n = 1; n <= 3; n++) {
    g.interact();
    for (let i = 0; i < 200 && g.fishing && g.fishing.phase !== 'bite'; i++) g.step(0.1);
    g.interact();
    g.fishing.tension = 0.99;
    g.step(0.05, { dx: 0, dy: 0, run: false, hold: true });
    assert.equal(g.snaps, n);
  }
  assert.match(g.message, /Snap! Enzo.*Ease off/);
});

test('good friends follow you home once a day and admire the room', () => {
  const g = fresh();
  setHour(g, 12);
  g.friendship.pia = VISIT_FRIENDSHIP;
  g.furniture.push({ id: 'lamp', x: 0, y: 0 });
  let msg = '';
  for (let i = 0; i < 40 && !g.visits.includes('pia'); i++) { stand(g, ...by('home').door, 0); msg = g.interact(); if (g.visitor) assert.deepEqual(g.visitor, { id: 'pia', name: 'Pia', line: 'I love the paper lamp. Where did you find it?' }); g.exit(); }
  assert.ok(g.visits.includes('pia'), 'Pia eventually drops in');
  assert.match(msg, /Pia followed you in: “I love the paper lamp/);
  assert.equal(g.friendship.pia, VISIT_FRIENDSHIP + 1);
  assert.equal(g.stats.visits, 1);
  assert.equal(g.visitor, null, 'the guest leaves when you step outside');
  for (let i = 0; i < 40; i++) { stand(g, ...by('home').door, 0); g.interact(); g.exit(); }
  assert.equal(g.visits.length, 1, 'one visit per neighbour per day');
  setHour(g, 23);
  for (let i = 0; i < 10; i++) { stand(g, ...by('home').door, 0); g.interact(); g.exit(); }
  assert.equal(g.stats.visits, 1, 'nobody visits after bedtime');
  sleep(g);
  assert.deepEqual(g.visits, []);
});

test('the board forecasts tomorrow and wishes can clear the sky', () => {
  const g = fresh();
  assert.equal(g.forecast, g.weatherOn(g.day + 1));
  g.day = 1;
  const rainy = Array.from({ length: 40 }, (_, i) => i + 1).find((d) => g.weatherOn(d) !== 'clear');
  g.day = rainy - 1;
  assert.ok(g.notices.some((n) => /^Tomorrow: (rain|snow)/.test(n)), 'the forecast names tomorrow’s weather');
  g.sunny = rainy;
  assert.equal(g.forecast, 'clear');
  g.day = rainy;
  assert.equal(g.weather, 'clear');
  g.sunny = 0;
  assert.notEqual(g.weather, 'clear');
});

test('completing a museum wing earns raisins and a plaque', () => {
  const g = fresh();
  g.screen = 'museum';
  const wing = WINGS.find((w) => w.id === 'fossil');
  for (const f of FOSSILS.slice(0, -1)) { g.pockets.push(g.itemFor('fossil', f.id)); g.donate(g.pockets.length - 1); }
  assert.ok(!g.wingDone(wing));
  assert.deepEqual(g.wingsDone, []);
  const last = FOSSILS[FOSSILS.length - 1];
  g.donated.push(last.id);
  assert.ok(g.wingDone(wing));
  for (let i = 0; i < POCKETS; i++) g.pockets.push(g.itemFor('fruit', 'apple'));
  const r = g.raisins;
  assert.match(g.claimWings(), /complete! Free a pocket/);
  assert.equal(g.raisins, r, 'the reward waits for a free pocket');
  assert.deepEqual(g.wingsDone, []);
  g.pockets.pop();
  assert.match(g.claimWings(), /Hoo-hoo/);
  assert.equal(g.raisins, r + WING_REWARD);
  assert.deepEqual(g.wingsDone, ['fossil']);
  assert.equal(g.pockets[g.pockets.length - 1].id, 'plaque-fossil');
  assert.equal(g.claimWings(), null, 'each wing pays once');
  g.exit();
  stand(g, ...by('museum').door, 0);
  assert.match(g.interact(), /Donations gratefully/);
});

test('furniture sets: three matching pieces pay a bonus and lift Vito’s rating', () => {
  const g = fresh();
  g.homeLevel = 3;
  g.screen = 'home';
  assert.equal(g.homeRating, 'Bare but honest');
  const cabin = FURNITURE.filter((f) => f.set === 'Cabin');
  assert.equal(cabin.length, 4);
  for (const set of SETS) assert.ok(FURNITURE.filter((f) => f.set === set).length >= 3, `${set} has enough pieces`);
  assert.ok(FURNITURE.filter((f) => f.shop).length === 12 && FURNITURE.filter((f) => f.shop).every((f) => f.set), 'every shop piece belongs to a set');
  for (let i = 0; i < 3; i++) g.pockets.push(g.itemFor('furniture', cabin[i].id));
  const r = g.raisins;
  g.place(0, 0, 0); g.place(0, 1, 0);
  assert.equal(g.setCount('Cabin'), 2);
  assert.deepEqual(g.setsDone, []);
  assert.match(g.place(0, 2, 0), /completes the Cabin set/);
  assert.equal(g.raisins, r + SET_BONUS);
  assert.deepEqual(g.completeSets, ['Cabin']);
  assert.equal(g.roomScore, Math.round((900 + 600 + 1500) / 4) + 1000);
  assert.equal(g.homeRating, 'Rather nice');
  assert.ok(g.notices.some((n) => /Home Rating: 1,750 points, “Rather nice.” Sets: Cabin/.test(n)));
  g.pickUp(g.furniture[0]);
  g.place(g.pockets.length - 1, 0, 1);
  assert.equal(g.raisins, r + SET_BONUS, 'a set pays once');
});

test('golden trees grow from foreign fruit now and then', () => {
  const g = fresh();
  g.tools.push('shovel'); g.setTool('shovel');
  let golden = null;
  for (let y = 1; y < H - 5 && !golden; y++) for (let x = 1; x < W - 1 && !golden; x++) {
    if (!g.freeGrass(x, y) || g.trees.length > 200) continue;
    g.pockets.push(g.itemFor('fruit', 'pear')); g.select(g.pockets.length - 1);
    stand(g, x, y + 1, 0);
    if (!/Planted a pear sapling/.test(g.interact())) continue;
    golden = g.trees.find((t) => t.golden) ?? null;
  }
  assert.ok(golden, 'a golden sapling turned up among the plantings');
  assert.ok(g.trees.some((t) => t.grown && !t.golden), 'most saplings are ordinary');
  g.trees = [golden];
  g.pockets = [];
  for (let i = 0; i < SAPLING_DAYS; i++) sleep(g);
  assert.equal(golden.grown, 0);
  assert.match(g.message, /shine gold/);
  stand(g, golden.x, golden.y + 1, 0);
  assert.equal(g.peek().target, 'Golden tree');
  assert.match(g.interact(), /golden pear fell/);
  assert.equal(g.pockets[0].id, GOLDEN_FRUIT);
  assert.equal(g.pockets[0].price, FRUIT_PRICE.golden);
  g.select(0); g.setTool('shovel');
  const spot = [golden.x + 2, golden.y];
  if (g.freeGrass(...spot)) { stand(g, spot[0], spot[1] + 1, 0); assert.match(g.interact(), /too precious/); }
});

test('Vito holds one sale a season, never on the festival day', () => {
  const g = fresh();
  for (let season = 0; season < 8; season++) {
    const days = Array.from({ length: DAYS_PER_SEASON }, (_, i) => season * DAYS_PER_SEASON + i + 1).filter((d) => g.saleDayOf(d));
    assert.equal(days.length, 1, `one sale in season ${season}`);
    assert.notEqual((days[0] - 1) % DAYS_PER_SEASON, DAYS_PER_SEASON - 1, 'not on festival day');
  }
  const sale = Array.from({ length: 8 }, (_, i) => i + 1).find((d) => g.saleDayOf(d));
  g.day = sale - 1;
  assert.ok(!g.isSale);
  assert.ok(g.notices.some((n) => /sale is tomorrow/.test(n)));
  g.day = sale;
  assert.ok(g.isSale);
  assert.equal(g.fruitRate, 1.5);
  const item = g.saleItem;
  assert.ok(g.stock.includes(item));
  assert.equal(g.priceOf(item), Math.floor(item.price / 2));
  assert.ok(g.stock.filter((f) => f !== item).every((f) => g.priceOf(f) === f.price));
  assert.ok(g.notices.some((n) => new RegExp(`SALE at Vito’s today!.*${item.name.toLowerCase()} is half price`).test(n)));
  g.screen = 'shop'; g.raisins = g.priceOf(item);
  assert.match(g.buy(item.id), new RegExp(`for ${g.priceOf(item)}`));
  assert.equal(g.raisins, 0);
});

test('sneaking is slow and lets you creep up on shy bugs', () => {
  const g = fresh();
  stand(g, 4, 10, 1);
  ticks(g, 1, { dx: 1, dy: 0, run: true, sneak: true });
  assert.ok(Math.abs(g.x - 4.5 - SNEAK) < 0.15, `sneaking overrides running, at ${g.x}`);
  assert.ok(g.sneaking && !g.running);
  g.bugs = [{ id: 'stag', x: 6.5, y: 10.5, vx: 0, vy: 0, life: 60, shy: true, fleeing: false }];
  stand(g, 5.4, 10, 1);
  g.step(0.1, { dx: 1, dy: 0, run: false, sneak: true });
  assert.ok(!g.bugs[0].fleeing, 'a sneaking hero 0.9 tiles away does not spook a shy bug');
  assert.match(g.peek().hint, /Net it/);
  g.setTool('net');
  assert.match(g.interact(), /Caught a Stag Beetle/);
  g.bugs = [{ id: 'stag', x: 6.5, y: 10.5, vx: 0, vy: 0, life: 60, shy: true, fleeing: false }];
  stand(g, 5.4, 10, 1);
  g.step(0.05);
  assert.ok(!g.sneaking);
  assert.match(g.peek().hint, /sneak up on it/);
  g.step(0.1, { dx: 1, dy: 0, run: false });
  assert.ok(g.bugs[0].fleeing, 'walking that close spooks it');
});

test('Bubo assesses one fossil at a time and says when the museum has one already', () => {
  const g = fresh();
  g.screen = 'museum';
  g.donated.push('egg');
  g.pockets.push(g.unknownFossil('egg'), g.unknownFossil('fern'));
  assert.equal(g.unassessed, 2);
  assert.match(g.assess(), /A dinosaur egg, worth 5,000\. We already display one.*1 more to look at/);
  assert.equal(g.unassessed, 1);
  assert.equal(g.event, 'reveal');
  assert.match(g.assess(), /A fern fossil, worth 1,000\. New to the museum/);
  assert.equal(g.stats.fossils, 2);
  assert.match(g.assess(), /Nothing to assess/);
});

test('wishes come true in several ways', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const g = new Hollow('dora', seed); park(g);
    g.friendship.pia = 2;
    g.wished = true;
    sleep(g);
    const m = g.message;
    kinds.add(/raisins by the door/.test(m) ? 'raisins' : /inside\.$/.test(m) ? 'fruit' : /somehow/.test(m) ? 'furniture' : /cheerful/.test(m) ? 'hearts' : /clouds away/.test(m) ? 'sky' : m);
    if (/cheerful/.test(m)) assert.equal(g.friendship.pia, 3);
    if (/clouds away/.test(m)) assert.ok(g.sunny === g.day || g.sunny === g.day + 1);
    assert.equal(g.stats.wishes, 1);
  }
  assert.ok(kinds.size >= 4, `wishes vary: ${[...kinds].join(', ')}`);
  assert.ok(!['raisins', 'fruit', 'furniture', 'hearts', 'sky'].some((k) => ![...kinds].every((x) => ['raisins', 'fruit', 'furniture', 'hearts', 'sky'].includes(x))));
});

test('a balloon drifts over on clear afternoons and a thrown fruit pops it', () => {
  const g = fresh();
  const day = Array.from({ length: 30 }, (_, i) => i + 1).find((d) => { g.day = d; return g.balloonDay && g.weather === 'clear'; });
  assert.ok(day, 'a balloon day comes round');
  g.day = day;
  assert.ok(g.notices.some((n) => /A balloon is expected from the west around 1[34]:00/.test(n)));
  setHour(g, 12.5);
  ticks(g, 5);
  assert.equal(g.balloon, null, 'not before its hour');
  setHour(g, g.balloonHour + 0.01);
  g.step(0.1);
  assert.ok(g.balloon, 'the balloon appears at the west edge');
  assert.ok(g.balloon.x < 0);
  const x0 = g.balloon.x;
  ticks(g, 10);
  assert.ok(g.balloon.x > x0 + 5, 'it drifts east');
  g.trees = []; g.rocks = []; g.flowers = []; g.fossils = [];
  g.x = g.balloon.x; g.y = g.balloon.y + 0.5; g.facing = 2;
  assert.ok(g.balloonInReach);
  assert.match(g.peek().hint, /Select a fruit or shell/);
  g.pockets.push(g.itemFor('fruit', 'apple')); g.select(0);
  assert.equal(g.peek().hint, 'Throw the apple');
  const r = g.raisins;
  assert.match(g.interact(), /Pop! The present floated down/);
  assert.equal(g.pockets.filter((p) => p.id === 'apple').length, 0, 'the apple is thrown');
  assert.ok(g.raisins === r + BALLOON_PRIZE || g.pockets.some((p) => p.kind === 'furniture'));
  assert.equal(g.balloon, null);
  assert.ok(g.balloonDone && g.stats.balloons === 1);
  ticks(g, 5);
  assert.equal(g.balloon, null, 'one balloon a day');
  assert.ok(g.notices.some((n) => /drifted over this afternoon/.test(n)));
  sleep(g);
  assert.ok(!g.balloonDone);
});

test('sleeping shows a summary of the day', () => {
  const g = fresh();
  assert.equal(g.summary, null);
  const tree = g.trees[0];
  stand(g, tree.x, tree.y + 1, 0);
  g.interact(); g.interact();
  g.step(0.05);
  assert.ok(g.goals.includes('shake'));
  g.screen = 'shop'; g.sellAll(); g.screen = 'world';
  g.friendship.pia = 0;
  g.befriend('pia', 2);
  sleep(g);
  assert.equal(g.summary.day, 1);
  const apple = Math.round(100 * new Hollow('dora', 7).fruitRate);
  assert.deepEqual(g.summary.lines, ['Gathered 2 fruit.', `Best find: an Apple, worth ${apple}.`, `Earned ${apple * 2 + 100} raisins.`, 'Friendship grew by 2 hearts.']);
  assert.deepEqual(g.log, { fish: 0, bugs: 0, fruit: 0, fossils: 0, shells: 0, earned: 0, hearts: 0, best: null }, 'the tally resets');
  sleep(g);
  assert.deepEqual(g.summary.lines, ['A quiet day. Those count too.']);
});

test('the pocket warning and the season title card', () => {
  const g = fresh();
  assert.equal(g.pocketWarning, '');
  for (let i = 0; i < POCKETS - 3; i++) g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.equal(g.pocketWarning, 'Pockets nearly full (3 free)');
  for (let i = 0; i < 3; i++) g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.equal(g.pocketWarning, 'Pockets full');
  g.day = 4;
  sleep(g);
  assert.deepEqual(g.splash, { text: 'Summer in Dusty Hollow', age: 4 });
  assert.equal(g.event, 'season');
  ticks(g, 5);
  assert.equal(g.splash, null);
  sleep(g);
  assert.equal(g.splash, null, 'only on the first day of a season');
});

test('each season hides a jackpot species that only surfaces on festival day', () => {
  const g = fresh();
  assert.deepEqual(SEASONS.map((s) => JACKPOTS[s].id), ['dorado', 'hercules', 'zungaro', 'titicaca']);
  for (const s of SEASONS) {
    const j = JACKPOTS[s];
    assert.ok(j.festival && j.rarity === 1 && j.seasons.length === 1 && j.seasons[0] === s, `${j.name} is a one-season festival rarity`);
    assert.ok(j.price >= 9000, `${j.name} is worth more than anything else`);
    assert.ok(FISH.includes(j) || BUGS.includes(j));
  }
  // The spring dorado is in the river, but only on tourney day.
  g.setTool('rod');
  g.day = 1;
  assert.equal(g.festival, null);
  for (let i = 0; i < 40; i++) { g.pockets = []; setHour(g, 12); stand(g, 17, 5, 1); fishOnce(g); assert.notEqual(g.pockets[0]?.id, 'dorado'); }
  g.day = 4;
  assert.equal(g.festival, 'tourney');
  let caught = false;
  for (let i = 0; i < 200 && !caught; i++) { g.pockets = []; setHour(g, 12); stand(g, 17, 5, 1); fishOnce(g); caught = g.pockets[0]?.id === 'dorado'; }
  assert.ok(caught, 'the dorado turns up on tourney day');
  assert.equal(g.pockets[0].price, 9000);
  assert.ok(g.today.fish >= 9000, 'it counts toward the tourney');
  assert.ok(g.jackpotTaken);
  assert.ok(g.notices.some((n) => /Golden Dorado has been landed/.test(n)), 'the board says it is gone');
  for (let i = 0; i < 60; i++) { g.pockets = []; setHour(g, 12); stand(g, 17, 5, 1); fishOnce(g); assert.notEqual(g.pockets[0]?.id, 'dorado', 'only one a year'); }
  sleep(g);
  assert.ok(!g.jackpotTaken, 'the next festival brings a new one');
  // The summer beetle waits for the Bug-Off. Reset the day each sweep, since the clock keeps running.
  const sweep = (day) => { g.day = day; setHour(g, 12); g.bugs = []; g.bugTimer = 0; ticks(g, 12); return g.bugs.some((b) => b.id === 'hercules'); };
  for (let i = 0; i < 60; i++) assert.ok(!sweep(5), 'no beetle on an ordinary summer day');
  g.day = 8;
  assert.equal(g.festival, 'bugoff');
  let seen = false;
  for (let i = 0; i < 400 && !seen; i++) seen = sweep(8);
  assert.ok(seen, 'the Hercules Beetle shows up on Bug-Off day');
});

test('a Best friend hands over a keepsake photo and their story, once', () => {
  const g = fresh();
  setHour(g, 12);
  const pia = g.villagers.find((v) => v.id === 'pia');
  pia.x = 5.5; pia.y = 11.5;
  stand(g, 4.5, 11, 1);
  g.friendship.pia = 4;
  g.interact();
  assert.match(g.dialog.text, /sea|leg|Pink/, 'an ordinary line below Best friend');
  g.choose(g.dialog.options.length - 1);
  assert.equal(g.friendship.pia, 5, 'the first chat of the day tops her up');
  assert.deepEqual(g.keepsakes, []);
  // At Best friend with full pockets, she holds the keepsake back.
  g.friendship.pia = FRIEND_MAX;
  for (let i = 0; i < POCKETS; i++) g.pockets.push(g.itemFor('fruit', 'apple'));
  g.interact();
  assert.match(g.dialog.text, /no room in those pockets/);
  assert.deepEqual(g.keepsakes, []);
  g.choose(0);
  g.pockets = [];
  g.interact();
  assert.match(g.dialog.text, /salt lake that dried up/, 'her story');
  assert.deepEqual(g.dialog.options, [{ label: 'Thank you', action: 'close' }]);
  assert.deepEqual(g.keepsakes, ['pia']);
  assert.equal(g.stats.keepsakes, 1);
  assert.equal(g.pockets[0].id, 'photo-pia');
  assert.equal(g.pockets[0].kind, 'furniture');
  assert.equal(g.event, 'goal');
  g.choose(0);
  g.interact();
  assert.doesNotMatch(g.dialog.text, /salt lake/, 'she only tells it once');
  assert.equal(g.pockets.length, 1);
  for (const v of NEIGHBOURS) assert.ok(v.story && v.story.length > 200, `${v.name} has a story`);
  assert.ok(!g.villagers.find((v) => v.id === 'friend').story, 'the friend chinchilla has no keepsake');
  assert.ok(NEIGHBOURS.every((v) => FURNITURE.some((f) => f.id === `photo-${v.id}` && !f.shop)), 'a photo exists for each');
  g.homeLevel = 3; g.screen = 'home';
  assert.match(g.place(0, 0, 0), /Placed the photo of pia/);
});

test('the day summary names the best find', () => {
  const g = fresh();
  g.pockets.push(g.itemFor('fish', 'trout'));
  g.log.fish = 1;
  const tree = g.trees[0];
  stand(g, tree.x, tree.y + 1, 0);
  g.interact();
  g.screen = 'museum';
  g.pockets.push(g.unknownFossil('egg'));
  g.assess();
  sleep(g);
  assert.ok(g.summary.lines.some((l) => l === 'Best find: a Dinosaur Egg, worth 5,000.'), g.summary.lines.join(' | '));
});

test('Dora and Enzo move in together, one following and either playable', () => {
  const g = new Hollow('dora', 7);
  assert.equal(g.hero, 'dora');
  assert.equal(g.heroName, 'Dora');
  const c = g.companion;
  assert.equal(c.id, 'friend');
  assert.equal(c.name, 'Enzo');
  assert.equal(c.species, 'enzo');
  assert.ok(Math.hypot(c.x - g.x, c.y - g.y) < 1.5, 'they start side by side, not at Burrow Works');
  assert.ok(g.escort, 'the companion walks with you by default');
  // Walking away pulls them along, and they settle behind you rather than in your way.
  stand(g, 8, 12, 1);
  ticks(g, 8);
  assert.ok(Math.hypot(c.x - g.x, c.y - g.y) < 2.2, `the companion keeps up (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
  const [fx, fy] = [Math.floor(g.x + 0.9), Math.floor(g.y)];
  assert.ok(Math.floor(c.x) !== fx || Math.floor(c.y) !== fy, 'and never stands on the tile you face');
  // Swapping trades places and names.
  const [hx, hy, cx, cy] = [g.x, g.y, c.x, c.y];
  assert.match(g.swap(), /Enzo takes the lead/);
  assert.equal(g.hero, 'enzo');
  assert.equal(g.heroName, 'Enzo');
  assert.equal(g.friendName, 'Dora');
  assert.equal(g.companion.name, 'Dora');
  assert.equal(g.companion.species, 'dora');
  assert.ok(Math.abs(g.x - cx) < 0.001 && Math.abs(g.y - cy) < 0.001, 'you step into their shoes');
  assert.ok(Math.abs(g.companion.x - hx) < 0.001 && Math.abs(g.companion.y - hy) < 0.001);
  assert.equal(g.event, 'swap');
  g.swap();
  assert.equal(g.hero, 'dora');
  // They are around at night, when the neighbours are not.
  setHour(g, 23);
  assert.ok(!g.villagersOut);
  g.companion.x = g.x + 0.8; g.companion.y = g.y;
  g.facing = 1;
  assert.equal(g.villagerNear()?.id, 'friend', 'you can still talk to your companion after dark');
  assert.ok(g.out(g.companion) && !g.out(g.villagers.find((v) => v.id === 'pia')));
  // Turning the escort off puts them back on neighbour hours.
  g.escort = false;
  assert.equal(g.villagerNear(), null);
  const away = { x: g.companion.x, y: g.companion.y };
  ticks(g, 5);
  assert.deepEqual({ x: g.companion.x, y: g.companion.y }, away, 'off-escort and after bedtime, they stay put');
  const h = Hollow.load(JSON.parse(JSON.stringify(g.save())));
  assert.equal(h.escort, false);
  assert.equal(h.hero, 'dora');
  assert.equal(h.companion.name, 'Enzo');
});

test('the trowel paves the hollow, and only your own paving lifts again', () => {
  const g = fresh();
  assert.equal(TOOL_NAMES.trowel, 'Trowel');
  assert.equal(g.tools.includes('trowel'), false, 'it has to be bought');
  g.screen = 'shop'; g.raisins = TOOL_PRICES.trowel;
  assert.match(g.buy('trowel'), /Bought trowel/);
  g.exit();
  g.setTool('trowel');
  // Find a clear patch of grass away from everything.
  let spot = null;
  for (let y = 2; y < H - 6 && !spot; y++) for (let x = 2; x < W - 2 && !spot; x++) if (g.pavable(x, y) && g.pavable(x, y + 1)) spot = [x, y];
  assert.ok(spot, 'there is grass to pave');
  const [px, py] = spot;
  stand(g, px, py + 1, 0);
  assert.equal(g.peek().hint, 'Lay paving');
  assert.match(g.interact(), /Laid a path stone/);
  assert.equal(g.tileAt(px, py), 'path');
  assert.equal(g.originalAt(px, py), 'grass', 'the map underneath is untouched');
  assert.ok(g.paved(px, py));
  assert.equal(g.stats.paved, 1);
  assert.ok(!g.pavable(px, py), 'no paving the same tile twice');
  assert.equal(g.peek().hint, 'Lift it back to grass');
  assert.match(g.interact(), /Lifted the stone/);
  assert.equal(g.tileAt(px, py), 'grass');
  assert.ok(!g.paved(px, py));
  // The village's own street is not yours to lift.
  stand(g, 12, STREET_Y + 1, 0);
  assert.equal(g.tileAt(12, STREET_Y), 'path');
  assert.ok(!g.paved(12, STREET_Y), 'the street was always there');
  // Paving is walkable and survives a save.
  g.interact();
  stand(g, px, py + 1, 0);
  g.interact();
  const h = Hollow.load(JSON.parse(JSON.stringify(g.save())));
  assert.equal(h.tileAt(px, py), 'path');
  assert.deepEqual(h.edits, g.edits);
  assert.ok(!h.solid(px, py), 'you can walk on your own path');
});

test('the trowel digs a tree up to move it, but never a golden one', () => {
  const g = fresh();
  g.tools.push('trowel');
  g.setTool('trowel');
  const tree = g.trees.find((t) => !t.grown);
  const was = g.trees.length;
  stand(g, tree.x, tree.y + 1, 0);
  assert.match(g.peek().hint, /Dig it up to replant/);
  assert.match(g.interact(), /Dug up the apple tree/);
  assert.equal(g.trees.length, was - 1);
  assert.equal(g.pockets[0].id, 'apple');
  assert.ok(!g.solid(tree.x, tree.y), 'the ground is free again');
  // Replant it somewhere else with the shovel; it costs the sapling days.
  g.tools.push('shovel'); g.setTool('shovel'); g.select(0);
  let spot = null;
  for (let y = 2; y < H - 6 && !spot; y++) for (let x = 2; x < W - 2 && !spot; x++) if (g.freeGrass(x, y) && !g.solid(x, y + 1)) spot = [x, y];
  stand(g, spot[0], spot[1] + 1, 0);
  assert.match(g.interact(), /Planted an apple sapling/);
  assert.equal(g.trees.length, was);
  assert.ok(g.treeAt(spot[0], spot[1]).grown > 0);
  const golden = { x: 1, y: 1, fruit: 'pear', count: 3, grown: 0, golden: true };
  g.trees.push(golden);
  g.setTool('trowel');
  stand(g, 1, 2, 0);
  assert.match(g.peek().hint, /Too precious/);
  assert.match(g.interact(), /Far too precious to move/);
  assert.ok(g.trees.includes(golden));
});

test('furniture can stand out in the hollow, and comes back when you lift it', () => {
  const g = fresh();
  g.tools.push('trowel');
  g.setTool('trowel');
  g.pockets.push(g.itemFor('furniture', 'lamp'));
  g.select(0);
  let spot = null;
  for (let y = 2; y < H - 6 && !spot; y++) for (let x = 2; x < W - 2 && !spot; x++) if (g.freeGrass(x, y) && !g.solid(x, y + 1)) spot = [x, y];
  const [px, py] = spot;
  stand(g, px, py + 1, 0);
  assert.match(g.peek().hint, /Stand the paper lamp here/);
  assert.match(g.interact(), /Stood the paper lamp out in the hollow/);
  assert.deepEqual(g.outdoor, [{ id: 'lamp', x: px, y: py }]);
  assert.equal(g.pockets.length, 0);
  assert.ok(g.solid(px, py), 'you cannot walk through it');
  assert.equal(g.peek().target, 'Paper Lamp');
  assert.ok(g.roomScore > 0, 'it counts toward Vito’s rating');
  assert.match(g.interact(), /Took the paper lamp back/);
  assert.deepEqual(g.outdoor, []);
  assert.equal(g.pockets[0].id, 'lamp');
  assert.ok(!g.solid(px, py));
  g.select(0);
  g.interact();
  const h = Hollow.load(JSON.parse(JSON.stringify(g.save())));
  assert.deepEqual(h.outdoor, [{ id: 'lamp', x: px, y: py }]);
});

test('the hollow gets an ending once the list, the museum and the neighbours are done', () => {
  const g = fresh();
  setHour(g, 19);
  assert.ok(!g.finaleReady);
  for (const goal of GOALS) if (!g.goals.includes(goal.id)) g.goals.push(goal.id);
  g.checkGoals();
  assert.ok(g.arrived.includes('lupe') && g.arrived.includes('nico'), 'the late arrivals count too');
  assert.ok(!g.finaleReady, 'the museum still has gaps');
  for (const sp of [...FISH, ...BUGS, ...FOSSILS]) g.donated.push(sp.id);
  assert.ok(!g.finaleReady, 'and not everyone is a Best friend yet');
  for (const v of g.residents) g.friendship[v.id] = FRIEND_MAX;
  assert.ok(g.finaleReady);
  // Too early in the day for lanterns.
  setHour(g, 12);
  ticks(g, 1);
  assert.equal(g.ceremony, null);
  setHour(g, 19);
  g.step(0.1);
  assert.deepEqual(g.ceremony, { t: 0, line: 0 }, 'the ceremony starts on the step that notices');
  assert.equal(g.message, CEREMONY_LINES[0]);
  // The village gathers round rather than wandering off.
  const far = g.residents.map((v) => Math.hypot(v.x - g.x, v.y - g.y));
  ticks(g, 4);
  assert.ok(g.residents.every((v, i) => Math.hypot(v.x - g.x, v.y - g.y) <= Math.max(2.6, far[i])), 'everyone closes in');
  // Step in small beats so the closing line can be caught before it fades.
  const spoken = new Set();
  let closing = '';
  for (let i = 0; i < 1500 && !g.ended; i++) {
    if (g.ceremony) spoken.add(g.ceremony.line);
    g.step(0.1);
    if (g.ended && !closing) closing = g.message;
  }
  assert.equal(g.ceremony, null);
  assert.ok(g.ended);
  assert.equal(spoken.size, CEREMONY_LINES.length, 'every line of the script is spoken');
  assert.equal(g.stats.ending, g.day);
  assert.match(closing, /The hollow is home/);
  // It happens once, and it survives a save.
  ticks(g, 30);
  assert.equal(g.ceremony, null);
  assert.ok(Hollow.load(JSON.parse(JSON.stringify(g.save()))).ended);
});

console.log(`Dusty Hollow: ${checks} checks passed.`);
