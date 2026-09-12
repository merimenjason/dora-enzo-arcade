import assert from 'node:assert/strict';
import {
  Hollow, W, H, DAY, POCKETS, LOANS, HOME_ROOM, BITE_WINDOW, ROCK_HITS, ROCK_DROPS, FOSSILS_PER_DAY, SAPLING_DAYS, SHOP_OPEN,
  FISH, BUGS, FOSSILS, FURNITURE, GOALS, BUILDINGS, STREET_Y, TOOL_PRICES, SEED_PRICE, FRUIT_PRICE, FLOWER_PRICE, HYBRIDS, WAKE, BEDTIME, makeTerrain,
} from '../.checks/dusty-hollow-game.js';

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const idle = { dx: 0, dy: 0, run: false };
const ticks = (g, seconds, input = idle) => { for (let i = 0, n = Math.round(seconds * 10); i < n; i++) g.step(0.1, input); };
const setHour = (g, h) => { g.clock = (h / 24) * DAY; };
/** Stand the hero on a tile facing a direction. */
const stand = (g, x, y, facing) => { g.x = x + 0.5; g.y = y + 0.5; g.facing = facing; };
const by = (id) => BUILDINGS.find((b) => b.id === id);
const fresh = () => { const g = new Hollow('dora', 7); g.villagers.forEach((v) => { v.x = v.tx = -5; v.y = v.ty = -5; }); return g; };

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
  g.day = 5;
  assert.equal(g.season, 'summer');
  g.day = 13;
  assert.equal(g.season, 'winter');
  g.day = 17;
  assert.equal(g.season, 'spring');
  assert.equal(g.year, 2);
  setHour(g, 20);
  assert.ok(g.isNight);
  setHour(g, 12);
  assert.ok(!g.isNight);
});

test('weather is deterministic per day and snows in winter', () => {
  const a = new Hollow('dora', 7), b = new Hollow('dora', 7);
  for (let d = 1; d <= 40; d++) { a.day = d; b.day = d; assert.equal(a.weather, b.weather); }
  const days = Array.from({ length: 64 }, (_, i) => { a.day = i + 1; return a.weather; });
  assert.ok(days.includes('rain') && days.includes('clear'), 'some rain, some sun');
  assert.ok(days.some((w, i) => w === 'snow' && a.season !== undefined && Math.floor(i / 4) % 4 === 3), 'winter rain falls as snow');
  assert.ok(!days.some((w, i) => w === 'rain' && Math.floor(i / 4) % 4 === 3), 'never rain in winter');
});

test('shaking a tree drops three apples then waits for tomorrow', () => {
  const g = fresh();
  const tree = g.trees[0];
  stand(g, tree.x, tree.y + 1, 0);
  for (let i = 0; i < 3; i++) assert.match(g.interact(), /Shook loose/);
  assert.equal(g.pockets.length, 3);
  assert.equal(g.pockets[0].kind, 'fruit');
  assert.equal(g.pockets[0].price, FRUIT_PRICE.native);
  assert.match(g.interact(), /No fruit today/);
  g.screen = 'home';
  g.sleep();
  g.screen = 'world';
  assert.equal(tree.count, 3, 'fruit regrows overnight');
  assert.equal(g.stats.fruit, 3);
});

test('fishing: cast, wait for the bite, reel in the right habitat', () => {
  const g = fresh();
  g.setTool('rod');
  stand(g, 17, 5, 1);
  assert.match(g.interact(), /Cast/);
  assert.ok(g.fishing);
  assert.match(g.interact(), /Too early/, 'reeling before the bite loses it');
  assert.equal(g.fishing, null);
  g.interact();
  for (let i = 0; i < 100 && g.fishing.bite <= 0; i++) g.step(0.1);
  assert.ok(g.fishing.bite > 0, 'a bite arrives within the wait');
  g.interact();
  assert.equal(g.pockets.length, 1);
  assert.equal(g.pockets[0].kind, 'fish');
  const species = FISH.find((f) => f.id === g.pockets[0].id);
  assert.equal(species.habitat, 'river');
  assert.equal(g.stats.fish, 1);
  assert.ok(g.caught.includes(species.id));
  // Miss the window and the fish escapes.
  g.interact();
  g.fishing.wait = 0.05;
  ticks(g, 0.2);
  assert.ok(g.fishing.bite > 0);
  ticks(g, BITE_WINDOW + 0.2);
  assert.equal(g.fishing, null);
  assert.match(g.message, /got away/);
  // Walking away cancels the cast.
  g.interact();
  g.step(0.1, { dx: -1, dy: 0, run: false });
  assert.equal(g.fishing, null);
  // Rods are needed.
  stand(g, 17, 5, 1);
  g.setTool('hands');
  assert.match(g.interact(), /need a rod/);
});

test('fish respect season, time of day and habitat', () => {
  const g = fresh();
  g.setTool('rod');
  const catchOne = (x, y, facing, hour, day) => {
    g.pockets = []; setHour(g, hour); g.day = day; stand(g, x, y, facing);
    g.interact(); g.fishing.wait = 0; ticks(g, 0.15); g.interact();
    return g.pockets[0];
  };
  for (let i = 0; i < 20; i++) {
    const f = catchOne(10, H - 4, 2, 12, 1);
    const s = FISH.find((s) => s.id === f.id);
    assert.equal(s.habitat, 'sea');
    assert.notEqual(s.time, 'night');
    assert.ok(s.seasons.includes('spring'));
    assert.notEqual(s.id, 'tuna', 'tuna is not a spring fish');
  }
  for (let i = 0; i < 20; i++) {
    const f = catchOne(5, 3, 1, 22, 2);
    const s = FISH.find((s) => s.id === f.id);
    assert.equal(s.habitat, 'pond');
    assert.notEqual(s.time, 'day');
  }
});

test('bugs spawn for the season and time, and the net catches them', () => {
  const g = fresh();
  setHour(g, 12);
  ticks(g, 60);
  assert.ok(g.bugs.length > 0, 'bugs appear on a spring afternoon');
  for (const b of g.bugs) {
    const s = BUGS.find((s) => s.id === b.id);
    assert.ok(s.seasons.includes('spring') && s.time !== 'night', `${b.id} belongs to a spring day`);
  }
  const bug = g.bugs[0];
  stand(g, Math.floor(bug.x), Math.floor(bug.y) + 1, 0);
  g.setTool('hands');
  assert.match(g.interact(), /Swap to the net|Nothing here|flower|rock|glitters|buried/);
  g.setTool('net');
  stand(g, Math.floor(bug.x), Math.floor(bug.y) + 1, 0);
  const before = g.bugs.length;
  assert.match(g.interact(), /Caught a/);
  assert.equal(g.bugs.length, before - 1);
  assert.equal(g.pockets[0].kind, 'bug');
  assert.equal(g.stats.bugs, 1);
  // Bugs never pile past the cap and are cleared by a new day.
  ticks(g, 200);
  assert.ok(g.bugs.length <= 6);
  g.screen = 'home'; g.sleep();
  assert.equal(g.bugs.length, 0);
});

test('rocks pay out four times a day', () => {
  const g = fresh();
  const rock = g.rocks[0];
  stand(g, rock.x, rock.y + 1, 0);
  assert.match(g.interact(), /shovel might/);
  g.tools.push('shovel'); g.setTool('shovel');
  const start = g.raisins;
  for (let i = 0; i < ROCK_HITS; i++) g.interact();
  assert.equal(g.raisins - start, ROCK_DROPS.reduce((a, b) => a + b));
  assert.match(g.interact(), /given all/);
  g.screen = 'home'; g.sleep();
  assert.equal(rock.hits, 0);
});

test('fossils: three a day, need a shovel, go to the museum once each', () => {
  const g = fresh();
  assert.equal(g.fossils.length, FOSSILS_PER_DAY);
  const f = g.fossils[0];
  stand(g, f.x, f.y + 1, 0);
  assert.match(g.interact(), /buried/);
  g.tools.push('shovel'); g.setTool('shovel');
  assert.match(g.interact(), /Dug up/);
  assert.equal(g.fossils.length, FOSSILS_PER_DAY - 1);
  assert.equal(g.pockets[0].kind, 'fossil');
  assert.ok(FOSSILS.some((s) => s.id === g.pockets[0].id));
  g.pockets.push(g.itemFor('fossil', g.pockets[0].id));
  g.screen = 'museum';
  assert.match(g.donate(0), /Displayed with pride/);
  assert.match(g.donate(0), /already have/);
  assert.equal(g.donated.length, 1);
  g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.match(g.donate(g.pockets.length - 1), /only display/);
  g.screen = 'home'; g.sleep();
  assert.equal(g.fossils.length, FOSSILS_PER_DAY, 'fresh fossils every morning');
});

test('flowers: pick, water, breed and hybridise', () => {
  const g = fresh();
  g.flowers = [{ x: 3, y: 3, color: 'red', watered: false }, { x: 4, y: 3, color: 'yellow', watered: false }];
  g.trees = g.trees.filter((t) => Math.abs(t.x - 3.5) > 2 || Math.abs(t.y - 3) > 2);
  g.rocks = []; g.fossils = [];
  stand(g, 3, 4, 0);
  assert.match(g.interact(), /Pick it|Picked/);
  g.pockets = []; g.flowers[0] = { x: 3, y: 3, color: 'red', watered: false };
  g.tools.push('can'); g.setTool('can');
  assert.match(g.interact(), /Watered/);
  stand(g, 4, 4, 0);
  g.interact();
  assert.ok(g.flowers.every((f) => f.watered));
  let hybrids = 0, total = 0;
  for (let i = 0; i < 40; i++) {
    g.flowers = [{ x: 3, y: 3, color: 'red', watered: true }, { x: 4, y: 3, color: 'yellow', watered: true }];
    g.screen = 'home'; g.sleep(); g.screen = 'world';
    total += g.flowers.length - 2;
    hybrids += g.flowers.filter((f) => f.color === 'orange').length;
    assert.ok(g.flowers.every((f) => !f.watered), 'watering wears off overnight');
  }
  assert.ok(total > 5, `watered neighbours breed (${total})`);
  assert.ok(hybrids > 0, 'red and yellow can make orange');
  assert.equal(HYBRIDS['red+yellow'], 'orange');
  assert.ok(g.stats.hybrids >= hybrids);
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
  assert.equal(g.pockets.length, 0);
  g.flowers = g.flowers.filter((f) => f.x !== spot[0] || f.y !== spot[1]);
  g.pockets.push(g.itemFor('fruit', 'peach'));
  g.select(0);
  assert.match(g.interact(), /sapling/);
  const tree = g.treeAt(spot[0], spot[1]);
  assert.equal(tree.grown, g.day + SAPLING_DAYS);
  assert.match(g.interact(), /sapling/);
  for (let i = 0; i < SAPLING_DAYS; i++) { g.screen = 'home'; g.sleep(); g.screen = 'world'; }
  assert.equal(tree.grown, 0);
  assert.equal(tree.count, 3);
  g.setTool('hands');
  g.interact();
  assert.equal(g.pockets[0].price, FRUIT_PRICE.foreign, 'peaches are foreign fruit');
});

test('pockets hold twenty things', () => {
  const g = fresh();
  for (let i = 0; i < POCKETS; i++) g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.ok(g.full);
  assert.equal(g.addItem(g.itemFor('fruit', 'apple')), false);
  assert.match(g.message, /pockets are full/);
  g.select(3); assert.equal(g.selected, 3);
  g.select(3); assert.equal(g.selected, -1, 'selecting again deselects');
});

test('Vito’s Emporium: hours, buying tools, seeds and furniture, selling', () => {
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
  assert.ok(g.tools.includes('shovel'));
  assert.match(g.buy('shovel'), /already own/);
  assert.match(g.buy('red'), /Bought red seeds/);
  assert.equal(g.pockets[0].kind, 'seed');
  assert.equal(g.raisins, 1000 - TOOL_PRICES.shovel - SEED_PRICE);
  assert.equal(g.stock.length, 3);
  assert.deepEqual(g.stock.map((f) => f.id), new Hollow('dora', 7).stock.map((f) => f.id), 'stock is fixed per day');
  const piece = g.stock[0];
  g.raisins = piece.price;
  assert.match(g.buy(piece.id), /Bought/);
  assert.equal(g.pockets[1].kind, 'furniture');
  g.pockets.push(g.itemFor('fish', 'koi'), g.itemFor('bug', 'moth'));
  assert.match(g.sell(2), /4000 raisins/);
  assert.equal(g.raisins, 4000);
  assert.match(g.sellAll(), /Sold 1 things for 130/);
  assert.equal(g.pockets.length, 2, 'seeds and furniture are kept');
  g.exit();
  assert.equal(g.screen, 'world');
  assert.equal(g.buy('shovel'), '', 'no shopping from outside');
});

test('home: place furniture up to the room size, sleep to the next morning', () => {
  const g = fresh();
  stand(g, ...by('home').door, 0);
  g.interact();
  assert.equal(g.screen, 'home');
  g.pockets.push(g.itemFor('fruit', 'apple'));
  assert.match(g.place(0), /Only furniture/);
  for (const f of FURNITURE.slice(0, 3)) g.pockets.push(g.itemFor('furniture', f.id));
  assert.match(g.place(1), /Placed/);
  assert.match(g.place(1), /Placed/);
  assert.match(g.place(1), /No room left in the tent/);
  assert.equal(g.furniture.length, HOME_ROOM[0]);
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
  assert.match(g.dialog.text, /4800 raisins/);
  g.choose(0);
  assert.match(g.message, /Not a single raisin/);
  g.raisins = 800;
  g.interact(); g.choose(0);
  assert.equal(g.debt, LOANS[0] - 800);
  assert.equal(g.raisins, 0);
  g.raisins = LOANS[0];
  g.interact(); g.choose(0);
  assert.equal(g.homeLevel, 1);
  assert.equal(g.debt, LOANS[1]);
  assert.equal(g.homeName, 'Cozy Burrow');
  g.raisins = LOANS[1] + LOANS[2];
  g.interact(); g.choose(0);
  g.interact(); g.choose(0);
  assert.equal(g.homeLevel, 3);
  assert.equal(g.debt, 0);
  assert.equal(g.raisins, 0);
  g.interact();
  assert.match(g.dialog.text, /all paid for/);
  g.choose(0);
  assert.equal(g.dialog, null);
});

test('neighbours: talking, gifts, requests and friendship', () => {
  const g = new Hollow('enzo', 3);
  assert.equal(g.friendName, 'Dora');
  assert.equal(g.villagers[0].name, 'Dora');
  const pia = g.villagers.find((v) => v.id === 'pia');
  setHour(g, 12);
  stand(g, 20, 11, 1);
  pia.x = pia.tx = 21.5; pia.y = pia.ty = 11.5;
  g.villagers.filter((v) => v !== pia).forEach((v) => { v.x = v.tx = -5; v.y = v.ty = -5; });
  assert.equal(g.villagerNear(), pia);
  g.interact();
  assert.equal(g.dialog.speaker, 'Pia');
  assert.equal(g.friendship.pia, 1, 'the first chat of the day counts');
  assert.equal(g.dialog.options.at(-1).action, 'close');
  g.choose(g.dialog.options.length - 1);
  g.interact();
  g.choose(0);
  assert.equal(g.friendship.pia, 1, 'a second chat the same day does not');
  g.requests = g.requests.map((r) => (r.villager === 'pia' ? { ...r, kind: 'fish' } : r));
  g.pockets.push(g.itemFor('fruit', 'apple'), g.itemFor('fish', 'trout'));
  g.select(0);
  g.interact();
  assert.equal(g.dialog.options[0].action, 'gift');
  g.choose(0);
  assert.equal(g.friendship.pia, 2, 'a gift she is lukewarm on is +1');
  assert.equal(g.pockets.length, 1);
  g.select(0);
  g.interact();
  assert.match(g.dialog.text, /wanting a fish/);
  assert.equal(g.dialog.options[0].action, 'deliver');
  const raisins = g.raisins;
  g.choose(0);
  assert.equal(g.friendship.pia, 5, 'delivering a request is +3');
  assert.ok(g.raisins === raisins + 300 || g.pockets[0]?.kind === 'fruit', 'rewards are raisins or foreign fruit');
  assert.ok(g.requests.find((r) => r.villager === 'pia').done);
  g.interact();
  assert.doesNotMatch(g.dialog.text, /wanting/);
  g.choose(0);
  setHour(g, 23);
  assert.equal(g.villagerNear(), null, 'everyone is indoors after bedtime');
  g.screen = 'home'; g.sleep(); g.screen = 'world';
  assert.equal(g.talked.length, 0);
  assert.ok(g.requests.every((r) => !r.done), 'new requests each day');
});

test('villagers wander by day and stay home at night', () => {
  const g = new Hollow('dora', 7);
  setHour(g, 12);
  const start = g.villagers.map((v) => [v.x, v.y]);
  ticks(g, 30);
  assert.ok(g.villagers.some((v, i) => Math.hypot(v.x - start[i][0], v.y - start[i][1]) > 0.5), 'they move around');
  assert.ok(g.villagers.every((v) => !g.solid(Math.floor(v.x), Math.floor(v.y))), 'never into walls or water');
  assert.ok(g.villagersOut);
  setHour(g, BEDTIME + 0.5);
  const pos = g.villagers.map((v) => [v.x, v.y]);
  ticks(g, 10);
  assert.deepEqual(g.villagers.map((v) => [v.x, v.y]), pos, 'nobody moves after bedtime');
  assert.ok(!g.villagersOut);
});

test('goals pay out as they are met, once each', () => {
  const g = fresh();
  assert.equal(g.goals.length, 0);
  g.stats.fish = 1;
  const done = g.checkGoals();
  assert.equal(done.length, 1);
  assert.equal(done[0].id, 'fish');
  assert.equal(g.raisins, GOALS[0].reward);
  assert.equal(g.checkGoals().length, 0);
  g.homeLevel = 1;
  g.step(0.1);
  assert.ok(g.goals.includes('loan'), 'goals are checked every step');
  assert.equal(GOALS.length, 11);
});

test('save and load round-trip', () => {
  const g = new Hollow('enzo', 11);
  g.raisins = 1234; g.debt = 100; g.homeLevel = 1; g.tools.push('shovel'); g.tool = 'shovel';
  g.pockets.push(g.itemFor('fish', 'koi')); g.furniture.push('bed'); g.donated.push('koi'); g.friendship.pia = 4; g.talked.push('pia'); g.goals.push('fish');
  g.flowers.push({ x: 2, y: 2, color: 'blue', watered: true }); g.day = 9; g.clock = 100; g.x = 12.2; g.y = 13.7; g.stats.fish = 3; g.caught.push('koi');
  const s = JSON.parse(JSON.stringify(g.save()));
  const h = Hollow.load(s);
  assert.equal(h.hero, 'enzo');
  assert.equal(h.friendName, 'Dora');
  assert.equal(h.raisins, 1234); assert.equal(h.debt, 100); assert.equal(h.homeLevel, 1); assert.equal(h.tool, 'shovel');
  assert.deepEqual(h.pockets, g.pockets); assert.deepEqual(h.furniture, ['bed']); assert.deepEqual(h.donated, ['koi']);
  assert.equal(h.friendship.pia, 4); assert.deepEqual(h.talked, ['pia']); assert.deepEqual(h.goals, ['fish']);
  assert.deepEqual(h.flowers, g.flowers); assert.deepEqual(h.trees, g.trees); assert.deepEqual(h.fossils, g.fossils);
  assert.equal(h.day, 9); assert.equal(h.clock, 100); assert.equal(h.x, 12.2); assert.equal(h.stats.fish, 3); assert.deepEqual(h.caught, ['koi']);
  assert.equal(h.screen, 'world');
  assert.equal(h.season, g.season);
  assert.deepEqual(h.save(), g.save(), 'saving again gives the same data');
});

test('the same seed and inputs replay identically', () => {
  const play = () => {
    const g = new Hollow('dora', 5);
    setHour(g, 12);
    g.setTool('rod');
    for (let i = 0; i < 6; i++) { stand(g, 17, 5, 1); g.interact(); for (let k = 0; k < 100 && g.fishing && g.fishing.bite <= 0; k++) g.step(0.1); if (g.fishing) g.interact(); }
    ticks(g, 60, { dx: 1, dy: 0.3, run: true });
    return JSON.stringify([g.save(), g.bugs]);
  };
  assert.equal(play(), play());
});

console.log(`Dusty Hollow: ${checks} checks passed.`);
