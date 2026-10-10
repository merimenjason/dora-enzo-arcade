import assert from 'node:assert/strict';
import {
  Game, MAPS, BUILDINGS, HEROES, DENS, EVENTS, HOME, W, H, DAY, NIGHT, CYCLE, RAID_AT, STAMINA_MAX, STAMINA_EVERY, START_SURVIVORS,
  EAT, STARVE, ATTACK_COST, HURT_TIME, HQ_COST, HQ_MAX, ARRIVAL_HAY, LANTERN_BOOST, LANTERN_BURN, SAVE_VERSION,
  makeMap, heroPower, trainCost, hqHousing, hqMaxHp,
} from '../.checks/frontier-game.js';
import { play } from './frontier-bot.mjs';

const step = (g, seconds) => { for (let i = 0; i < seconds * 60 && g.state === 'playing'; i++) g.update(1 / 60); };
const rich = (g) => { g.stock = { hay: 5000, wood: 5000, stone: 5000 }; return g; };
/** A tile you hold with nothing on it, of the given ground, made if need be. */
const open = (g, t = 'meadow') => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const tile = g.tile(x, y); if (tile.seen && !tile.f && tile.t === t && !g.buildingAt(x, y)) return { x, y }; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const tile = g.tile(x, y); if (tile.seen && !tile.f && !g.buildingAt(x, y) && g.held(x, y)) { tile.t = t; return { x, y }; } }
  throw new Error('no open tile');
};
/** Uncovers a whole square around home for free (for setting up tests). */
const clear = (g, r) => { for (let y = HOME.y - r; y <= HOME.y + r; y++) for (let x = HOME.x - r; x <= HOME.x + r; x++) { const t = g.tile(x, y); if (t && !t.seen) { t.seen = true; if (t.f === 'rumour' || t.f === 'cache' || t.f === 'ruin' || t.f === 'stray') t.f = null; } } };
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`);

// ---------- Maps ----------
for (let m = 0; m < MAPS.length; m++) for (const seed of [1, 2, 3, 7]) {
  const { tiles, summit } = makeMap(m, seed), at = (x, y) => tiles[y * W + x];
  assert.equal(tiles.length, W * H);
  assert.equal(at(HOME.x, HOME.y).f, 'home');
  assert.equal(tiles.filter((t) => t.seen).length, 9, 'only the first ring round the burrow is uncovered');
  assert.equal(at(summit.x, summit.y).f, 'lair'); assert.equal(at(summit.x, summit.y).den, 'cougar');
  assert.ok(Math.max(Math.abs(summit.x - HOME.x), Math.abs(summit.y - HOME.y)) >= 5, 'the summit is far from home');
  assert.deepEqual(tiles.filter((t) => t.f === 'den').map((t) => t.den).sort((a, b) => a.localeCompare(b)), [...MAPS[m].dens].sort((a, b) => a.localeCompare(b)), 'every den of the map is placed');
  assert.deepEqual(tiles.filter((t) => t.f === 'ruin').map((t) => t.hero).sort((a, b) => a.localeCompare(b)), [...MAPS[m].heroes].sort((a, b) => a.localeCompare(b)), 'one ruin per hero to find');
  assert.equal(tiles.filter((t) => t.f === 'stray').length, 5);
  assert.equal(tiles.filter((t) => t.f === 'rumour').length, 5);
  // The summit can be walked to round the crags.
  const seen = new Set([HOME.y * W + HOME.x]), q = [HOME];
  while (q.length) { const p = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = p.x + dx, y = p.y + dy; if (x >= 0 && y >= 0 && x < W && y < H && !seen.has(y * W + x) && at(x, y).t !== 'crag') { seen.add(y * W + x); q.push({ x, y }); } } }
  assert.ok(seen.has(summit.y * W + summit.x), `${MAPS[m].name} seed ${seed}: the summit is reachable`);
}
assert.deepEqual(makeMap(1, 5), makeMap(1, 5), 'a seed makes the same map');
assert.notDeepEqual(makeMap(1, 5).tiles, makeMap(1, 6).tiles);

// ---------- Starting out ----------
{
  const g = new Game(0, 3);
  assert.equal(g.survivors, START_SURVIVORS);
  assert.deepEqual(g.heroes.map((h) => h.id), ['dora', 'enzo']);
  assert.deepEqual(g.buildings.map((b) => b.kind).sort((a, b) => a.localeCompare(b)), ['farm', 'lodge'], 'a farm and a lodge are up from the start');
  assert.equal(g.idle, 0, 'and all four chinchillas are at work in them');
  assert.equal(g.housing, hqHousing(1));
  assert.equal(g.day, 1); assert.equal(g.night, false);
  assert.ok(g.income().hay > 0, 'the first farm feeds the band');
}

// ---------- Exploring ----------
{
  const g = new Game(0, 3);
  // A cloud tile next to the first ring.
  const x = HOME.x + 2, y = HOME.y;
  assert.equal(g.canExplore(x + 1, y), 'far', 'only next to land you hold');
  assert.equal(g.canExplore(HOME.x, HOME.y), 'taken');
  g.tile(x, y).t = 'meadow'; g.tile(x, y).f = null;
  const s0 = g.stamina;
  assert.equal(g.explore(x, y), 'ok');
  assert.equal(g.stamina, s0 - 1);
  assert.ok(g.tile(x, y).seen);
  assert.equal(g.canExplore(x + 1, y), g.stamina >= g.staminaCost(x + 1, y) ? 'ok' : 'stamina', 'and the frontier moves out');
  // Snow costs two, one while Dora is fit.
  g.tile(x + 1, y).t = 'snow'; g.tile(x + 1, y).f = null;
  assert.equal(g.staminaCost(x + 1, y), 1);
  g.hero('dora').hurt = 5;
  assert.equal(g.staminaCost(x + 1, y), 2);
  g.stamina = 1;
  assert.equal(g.canExplore(x + 1, y), 'stamina');
  // Stamina comes back a point every few seconds, up to the cap.
  g.stamina = 0;
  step(g, STAMINA_EVERY * 2 + 0.1);
  assert.equal(g.stamina, 2);
  step(g, STAMINA_EVERY * 20);
  assert.equal(g.stamina, STAMINA_MAX);
  // A crag can be seen but leads nowhere; an uncleared den blocks the way too.
  const h = new Game(0, 3);
  h.tile(HOME.x + 2, HOME.y).t = 'crag'; h.tile(HOME.x + 2, HOME.y).f = null;
  h.explore(HOME.x + 2, HOME.y);
  assert.equal(h.canExplore(HOME.x + 3, HOME.y), 'far');
  h.tile(HOME.x, HOME.y + 2).f = 'den'; h.tile(HOME.x, HOME.y + 2).den = 'fox';
  h.stamina = 10; h.explore(HOME.x, HOME.y + 2);
  assert.equal(h.canExplore(HOME.x, HOME.y + 3), 'far');
}

// ---------- What the cloud hides ----------
{
  const g = new Game(0, 3), x = HOME.x + 2, y = HOME.y;
  const t = g.tile(x, y); t.t = 'meadow';
  t.f = 'cache'; t.cache = { hay: 0, wood: 30, stone: 15 };
  const w0 = g.stock.wood, s0 = g.stock.stone;
  g.explore(x, y);
  assert.equal(g.stock.wood, w0 + 30); assert.equal(g.stock.stone, s0 + 15);
  assert.equal(t.f, null, 'a cache is taken');
  // A ruin holds a hero.
  const r = g.tile(x, y - 1); r.t = 'meadow'; r.f = 'ruin'; r.hero = 'luna'; g.stamina = 10;
  g.explore(x, y - 1);
  assert.ok(g.hero('luna'), 'Luna joins');
  assert.equal(g.reach(), 3, 'and lanterns light one tile further');
  // A lost chinchilla moves in if there's room, or waits.
  const s = g.tile(x, y + 1); s.t = 'meadow'; s.f = 'stray';
  g.explore(x, y + 1);
  assert.equal(g.survivors, START_SURVIVORS, 'no room yet');
  assert.equal(s.f, 'stray', 'so it waits');
  rich(g); g.build('nest', ...Object.values(open(g)));
  assert.equal(g.survivors, START_SURVIVORS + 1, 'a new nest takes it in');
  assert.equal(s.f, null);
}

// ---------- Rumours ----------
{
  const g = new Game(0, 3), x = HOME.x + 2, y = HOME.y, t = g.tile(x, y);
  t.t = 'meadow'; t.f = 'rumour'; t.event = 'sled';
  g.explore(x, y);
  assert.equal(g.state, 'event');
  assert.equal(g.pending.event, 'sled');
  const time = g.time; step(g, 5); g.update(1);
  assert.equal(g.time, time, 'time stands still while you decide');
  g.stamina = 2;
  assert.equal(g.choose(0), false, 'digging the sled out needs 3 stamina');
  g.stamina = 5;
  const w0 = g.stock.wood;
  assert.ok(g.choose(0));
  assert.equal(g.stock.wood, w0 + 60); assert.equal(g.stamina, 2);
  assert.equal(g.state, 'playing');
  // Every rumour's choices do what they say.
  const each = (id, i) => { const h = rich(new Game(0, 3)); const tt = h.tile(x, y); tt.t = 'meadow'; tt.f = 'rumour'; tt.event = id; h.stamina = 10; h.explore(x, y); assert.ok(h.choose(i), `${id} choice ${i + 1}`); return h; };
  assert.equal(each('storm', 0).tonight, -10); assert.equal(each('storm', 1).tonight, 5);
  assert.equal(each('kit', 0).tonight, 6);
  assert.equal(each('owl', 0).stock.stone, 5035);
  const herd = each('herd', 1); assert.ok(herd.tiles.filter((q) => q.seen).length >= 13, 'marking the trail uncovers three tiles');
  const spring = (() => { const h = new Game(0, 3); h.hero('enzo').hurt = 20; const tt = h.tile(x, y); tt.t = 'meadow'; tt.f = 'rumour'; tt.event = 'spring'; h.explore(x, y); h.choose(0); return h; })();
  assert.equal(spring.hero('enzo').hurt, 0, 'the warm spring heals the heroes');
  for (const id of Object.keys(EVENTS)) assert.equal(EVENTS[id].choices.length, 2);
}

// ---------- Building ----------
{
  const g = new Game(0, 3);
  const meadow = open(g), grove = open(g, 'grove'), rocks = open(g, 'rocks');
  g.stock = { hay: 0, wood: 0, stone: 0 };
  assert.equal(g.canBuild('farm', meadow.x, meadow.y), 'cost');
  rich(g);
  assert.equal(g.canBuild('farm', grove.x, grove.y), 'terrain', 'farms go on meadows');
  assert.equal(g.canBuild('lodge', meadow.x, meadow.y), 'terrain', 'lodges go on groves');
  assert.equal(g.canBuild('quarry', rocks.x, rocks.y), 'hq', 'quarries wait for burrow level 2');
  assert.equal(g.canBuild('farm', HOME.x, HOME.y), 'taken');
  assert.equal(g.canBuild('beacon', meadow.x, meadow.y), 'terrain', 'the beacon goes only on the summit');
  assert.equal(g.canBuild('farm', HOME.x + 5, HOME.y + 5), 'fog');
  const w0 = g.stock.wood;
  assert.equal(g.build('farm', meadow.x, meadow.y), 'ok');
  assert.equal(g.stock.wood, w0 - BUILDINGS.farm.cost.wood);
  assert.equal(g.canBuild('nest', meadow.x, meadow.y), 'taken');
  assert.equal(g.upgrade(), 'ok');
  assert.equal(g.hqLevel, 2);
  assert.equal(g.housing, hqHousing(2));
  assert.equal(g.hqHp, hqMaxHp(2));
  assert.equal(g.build('quarry', rocks.x, rocks.y), 'ok');
  while (g.hqLevel < HQ_MAX) g.upgrade();
  assert.equal(g.upgrade(), 'max');
  assert.deepEqual(HQ_COST.length, HQ_MAX);
}

// ---------- Work, food and lanterns ----------
{
  const g = rich(new Game(0, 3));
  g.upgrade(); g.upgrade();
  const farm = g.buildings.find((b) => b.kind === 'farm');
  assert.equal(farm.workers, 2);
  near(g.output(farm), BUILDINGS.farm.rate, 'two workers, full rate');
  assert.ok(g.assign(farm.id, -1));
  near(g.output(farm), BUILDINGS.farm.rate / 2, 'one worker, half rate');
  assert.equal(g.idle, 1);
  assert.ok(g.assign(farm.id, 1));
  assert.equal(g.assign(farm.id, 1), false, 'no more than the job needs');
  // A lantern within reach makes it work half as fast again, burning wood.
  const spot = (() => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.canBuild('lantern', x, y) === 'ok' && Math.max(Math.abs(x - farm.x), Math.abs(y - farm.y)) <= 2) return { x, y }; clear(g, 2); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.canBuild('lantern', x, y) === 'ok' && Math.max(Math.abs(x - farm.x), Math.abs(y - farm.y)) <= 2) return { x, y }; })();
  g.build('lantern', spot.x, spot.y);
  assert.ok(g.lit(farm.x, farm.y));
  near(g.output(farm), BUILDINGS.farm.rate * LANTERN_BOOST, 'lit');
  const burn = g.income().wood - g.buildings.filter((b) => b.kind === 'lodge').reduce((s, b) => s + g.output(b), 0);
  near(burn, -LANTERN_BURN, 'the lantern burns wood');
  g.stock.wood = 0;
  assert.equal(g.lit(farm.x, farm.y), false, 'no wood, no light');
  // Kiki's green paw.
  g.stock.wood = 100; g.heroes.push({ id: 'kiki', level: 1, hurt: 0 });
  near(g.output(farm), BUILDINGS.farm.rate * LANTERN_BOOST * 1.3, 'Kiki makes farms 30% better');
  // Everyone eats; with no hay for long enough, someone leaves.
  const h = new Game(0, 3);
  for (const b of h.buildings) b.workers = 0;
  h.stock.hay = 1;
  near(h.income().hay, -START_SURVIVORS * EAT, 'four mouths');
  step(h, 1 / (START_SURVIVORS * EAT) + STARVE + 0.5);
  assert.equal(h.survivors, START_SURVIVORS - 1, 'a hungry chinchilla leaves');
  assert.ok(h.events.some((e) => e.type === 'leave'));
  // Jobs fill oldest first, but while the hay is running down, new hands go to the farms first.
  const k = rich(new Game(0, 3)); k.upgrade();
  k.buildings = k.buildings.filter((b) => b.kind !== 'farm');
  k.buildings[0].workers = 0; k.survivors = 2;
  k.build('lodge', ...Object.values(open(k, 'grove')));
  assert.deepEqual(k.buildings.map((b) => [b.kind, b.workers]), [['lodge', 2], ['lodge', 0]], 'the oldest job fills first');
  for (const b of k.buildings) b.workers = 0;
  k.stock.hay = 0;
  k.build('farm', ...Object.values(open(k)));
  assert.deepEqual(k.buildings.map((b) => [b.kind, b.workers]), [['lodge', 0], ['lodge', 0], ['farm', 2]], 'with no hay, the new farm fills first');
}

// ---------- Day and night ----------
{
  const g = new Game(0, 3);
  assert.equal(DAY + NIGHT, CYCLE);
  step(g, DAY - 0.5);
  assert.equal(g.night, false);
  const forecast = g.raidStrength();
  step(g, 1);
  assert.equal(g.night, true);
  assert.ok(g.raid && !g.raid.done);
  assert.equal(g.raid.strength, forecast, 'the raid is as strong as forecast');
  assert.ok(g.raid.from.length >= 2, 'raiders set out from somewhere');
  step(g, RAID_AT);
  assert.ok(g.raid.done);
  assert.equal(g.raid.held, true, 'the first raid is no match for Dora and Enzo');
  assert.equal(g.raidsHeld, 1);
  step(g, NIGHT);
  assert.equal(g.day, 2); assert.equal(g.raid, null);
  // Raids grow with the days and with the dens left standing.
  assert.ok(g.raidStrength(10) > g.raidStrength(2));
  const before = g.raidStrength(), den = g.tiles.find((t) => t.f === 'den'), kind = den.den;
  den.f = null; delete den.den;
  assert.equal(g.raidStrength(), before - DENS[kind].raid, 'a cleared den stops feeding the raids');
}

// ---------- Raids that break in ----------
{
  const g = rich(new Game(0, 3));
  g.def = { ...g.def, raidBase: g.defence() + 2 };
  const hp = g.hqHp;
  step(g, DAY + RAID_AT + 0.1);
  const r = g.raid, gap = r.strength - r.defence;
  assert.equal(r.held, false);
  assert.ok(r.loss.hay === gap * 2 && r.loss.wood === gap * 2 && r.loss.stone === gap, 'twice the gap in hay and wood, the gap in stone');
  assert.ok(g.hqHp < hp, 'and batters the burrow');
  assert.ok(g.buildings.some((b) => b.damaged), 'a big raid damages a building');
  const b = g.buildings.find((q) => q.damaged);
  assert.equal(g.output(b), 0, 'a damaged building does nothing');
  assert.ok(g.repair(b.id));
  assert.equal(b.damaged, false);
  assert.ok(gap >= 8 && g.state === 'playing');
  // Enough of that and the burrow falls.
  g.def = { ...g.def, raidBase: 400 };
  for (let i = 0; i < 20 && g.state === 'playing'; i++) step(g, CYCLE);
  assert.equal(g.state, 'lost');
  const t = g.time; g.update(1); assert.equal(g.time, t, 'nothing moves once lost');
}

// ---------- Defence ----------
{
  const g = rich(new Game(0, 3));
  const base = g.defence();
  assert.equal(base, Math.round(8 + heroPower(g.hero('dora')) * 0.5 + heroPower(g.hero('enzo')) * 0.5 + 8), 'burrow, half the squad’s power, and Enzo’s guard');
  g.upgrade();
  const spot = open(g);
  g.build('tower', spot.x, spot.y);
  const tower = g.buildingAt(spot.x, spot.y);
  if (!tower.workers) { const lodge = g.buildings.find((b) => b.workers); g.assign(lodge.id, -1); g.assign(tower.id, 1); }
  assert.equal(g.defence(), base + 8 + BUILDINGS.tower.defence, 'a manned watchtower');
  g.assign(tower.id, -1);
  assert.equal(g.defence(), base + 8, 'an empty one does nothing');
  g.hero('enzo').hurt = 10;
  assert.ok(g.defence() < base, 'hurt heroes don’t defend');
}

// ---------- Heroes and dens ----------
{
  const g = rich(new Game(0, 3)), x = HOME.x + 2, y = HOME.y, t = g.tile(x, y);
  t.seen = true; t.t = 'meadow'; t.f = 'den'; t.den = 'fox';
  assert.equal(g.squadPower, 24);
  assert.equal(g.canAttack(HOME.x, HOME.y), 'none');
  const s0 = g.stamina, w0 = g.stock.wood;
  assert.equal(g.attack(x, y), 'ok');
  assert.equal(g.stamina, s0 - ATTACK_COST);
  assert.equal(t.f, null, 'a squad of 24 beats a fox den of 24');
  assert.equal(g.stock.wood, w0 + DENS.fox.loot.wood);
  assert.equal(g.denCleared, 1);
  // Too strong: the heroes come home hurt and the den stays.
  t.f = 'den'; t.den = 'owl'; g.stamina = 10;
  g.attack(x, y);
  assert.equal(t.f, 'den');
  assert.ok(g.heroes.every((h) => h.hurt === HURT_TIME));
  assert.equal(g.canAttack(x, y), 'squad');
  step(g, HURT_TIME + 0.1);
  assert.equal(g.squad.length, 2, 'they recover');
  // Training: costs grow, and the burrow caps it.
  const enzo = g.hero('enzo');
  assert.deepEqual(trainCost(enzo), { hay: 10, wood: 30, stone: 20 });
  assert.equal(g.train('enzo'), 'ok');
  assert.equal(enzo.level, 2);
  assert.equal(heroPower(enzo), Math.round(HEROES.enzo.power * 1.4));
  assert.equal(g.train('enzo'), 'hq', 'heroes train one level above the burrow');
  g.upgrade(); g.upgrade(); g.upgrade();
  while (enzo.level < 5) g.train('enzo');
  assert.equal(g.train('enzo'), 'max');
  assert.equal(g.train('kiki'), 'none');
}

// ---------- Winning ----------
{
  const g = rich(new Game(0, 3)), s = g.summit, lair = g.tile(s.x, s.y);
  lair.seen = true;
  assert.equal(g.canBuild('beacon', s.x, s.y), 'terrain', 'not while the cougar is there');
  for (const h of g.heroes) h.level = 5;
  g.heroes.push({ id: 'luna', level: 5, hurt: 0 });
  assert.ok(g.squadPower >= DENS.cougar.power);
  g.stamina = 10;
  g.attack(s.x, s.y);
  assert.equal(lair.f, 'beacon');
  assert.equal(g.canBuild('beacon', s.x, s.y), 'hq');
  while (g.hqLevel < HQ_MAX) g.upgrade();
  assert.equal(g.build('beacon', s.x, s.y), 'ok');
  assert.equal(g.state, 'won');
  assert.equal(g.stars(), 3);
  assert.ok(g.events.some((e) => e.type === 'won'));
  g.time = (MAPS[0].par + 2) * CYCLE; assert.equal(g.stars(), 2);
  g.time = (MAPS[0].par + 9) * CYCLE; assert.equal(g.stars(), 1);
}

// ---------- Travellers ----------
{
  const g = rich(new Game(0, 3));
  g.upgrade();
  step(g, CYCLE + 0.1);
  assert.equal(g.survivors, START_SURVIVORS + 1, 'a traveller settles at dawn when there’s room and hay');
  const h = new Game(0, 3);
  h.stock.hay = ARRIVAL_HAY - 10; for (const b of h.buildings) b.workers = 0;
  step(h, CYCLE + 0.1);
  assert.equal(h.survivors, START_SURVIVORS, 'not without room or hay');
}

// ---------- Pause ----------
{
  const g = new Game(0, 3);
  g.pause();
  assert.equal(g.state, 'paused');
  g.update(5);
  assert.equal(g.time, 0);
  assert.equal(g.canExplore(HOME.x + 2, HOME.y), 'state');
  g.pause();
  g.update(1);
  assert.equal(g.time, 1);
}

// ---------- Saving ----------
{
  // Part-way through a bot's run, a save carries on exactly as the original.
  const a = new Game(1, 4);
  const { tend } = await import('./frontier-bot.mjs');
  for (let i = 0; i < 60 * 300; i++) { if (i % 20 === 0) tend(a); a.update(1 / 60); }
  const snap = JSON.parse(JSON.stringify(a.snapshot()));
  assert.equal(snap.v, SAVE_VERSION);
  const b = Game.load(snap);
  assert.ok(b, 'the save loads');
  for (let i = 0; i < 60 * 200; i++) { if (i % 20 === 0) { tend(a); tend(b); } a.update(1 / 60); b.update(1 / 60); }
  assert.deepEqual(JSON.parse(JSON.stringify(b.snapshot())), JSON.parse(JSON.stringify(a.snapshot())), 'and carries on identically');
  // A rumour waiting for an answer is kept.
  const e = new Game(0, 3), t = e.tile(HOME.x + 2, HOME.y); t.t = 'meadow'; t.f = 'rumour'; t.event = 'owl'; e.explore(HOME.x + 2, HOME.y);
  const le = Game.load(JSON.parse(JSON.stringify(e.snapshot())));
  assert.equal(le.state, 'event'); assert.equal(le.pending.event, 'owl');
  // Broken, other-version or impossible saves are refused.
  const bad = (f) => { const s = JSON.parse(JSON.stringify(a.snapshot())); f(s); return Game.load(s); };
  assert.equal(Game.load(null), null);
  assert.equal(Game.load('nonsense'), null);
  assert.equal(bad((s) => { s.v = 99; }), null, 'another version');
  assert.equal(bad((s) => { s.tiles.pop(); }), null, 'a torn map');
  assert.equal(bad((s) => { s.stock.hay = -5; }), null, 'negative hay');
  assert.equal(bad((s) => { s.hqLevel = 9; }), null, 'a burrow too big');
  assert.equal(bad((s) => { const b = s.buildings[0]; b.workers = 9; }), null, 'too many workers');
  assert.equal(bad((s) => { const b = s.buildings[0]; s.buildings.push({ ...b, id: 999 }); }), null, 'two buildings on a tile');
  assert.equal(bad((s) => { const b = s.buildings.find((q) => q.kind === 'farm'); s.tiles[b.y * W + b.x].t = 'crag'; }), null, 'a farm on a crag');
  assert.equal(bad((s) => { s.heroes.push({ ...s.heroes[0] }); }), null, 'the same hero twice');
  assert.equal(bad((s) => { s.survivors = 999; }), null, 'more chinchillas than homes');
  assert.equal(bad((s) => { s.state = 'won'; }), null, 'a finished run');
}

// ---------- Whole runs ----------
for (let m = 0; m < MAPS.length; m++) {
  const g = play(m, 1);
  assert.equal(g.state, 'won', `${MAPS[m].name} is won by the settler`);
  assert.ok(g.stars() >= 1);
}
{
  // A seed replays a whole run exactly.
  const x = play(2, 9), y = play(2, 9);
  assert.equal(x.time, y.time); assert.deepEqual(x.stock, y.stock); assert.deepEqual(x.buildings, y.buildings);
}

console.log('Passed: maps, exploring, caches, ruins, strays, rumours, building, work and food, lanterns, day and night, raids, defence, heroes and dens, winning, travellers, pause, saving and replay.');
