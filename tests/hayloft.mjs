// Hayloft Tycoon engine checks: costs and buying, production and milestones, helpers, time away (equal to time online, and
// capped), the Great Migration and Constellations, research, trips, gifts, visitors, the Twig Shower, saving, number
// formatting, determinism and the number range.
import assert from 'node:assert/strict';
import {
  HayloftGame, BUILDINGS, MANAGERS, UPGRADES, VALLEYS, STAR_TREE, MOON_SHOP, RESEARCH, TRIPS, KEEPSAKES, ACHIEVEMENTS, MILESTONES, FESTIVALS, N, GATE, MAX_LEVEL, PACE,
  SAVE_KEY, FLUFF, SHOWER, BERRY, ACORN, TIDE, CONSTELLATION_AT, ACH_BONUS, costOf, maxAfford, milestoneMult, nextMilestone, tideIntegral, tideAt, stardustFor, stardustShine,
  moonstonesFor, fmt, fmtTime, freshState, readSave, rand, TwigShower,
} from '../.checks/hayloft-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const near = (a, b, tol = 1e-9, msg = '') => ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${msg} (${a} vs ${b})`);
const T0 = Date.UTC(2026, 9, 28, 8);
const fresh = (seed = 1) => HayloftGame.fresh(seed, T0);

// ---- content
ok(SAVE_KEY === 'hayloft-tycoon-v1', 'save key');
ok(N === 12 && new Set(BUILDINGS.map((b) => b.id)).size === N, 'twelve buildings with their own ids');
ok(BUILDINGS.every((b, i) => i === 0 || (b.cost > BUILDINGS[i - 1].cost && b.cycle > BUILDINGS[i - 1].cycle)), 'each building costs more and runs slower than the last');
ok(MANAGERS.length === N && UPGRADES.length === N * 3 + 6, 'a helper per building, three upgrades each and six for everything');
ok(UPGRADES.every((u, i) => i === 0 || u.cost >= UPGRADES[i - 1].cost), 'upgrades are listed cheapest first');
ok(VALLEYS.length === 5 && RESEARCH.length === 16 && TRIPS.length === 6 && KEEPSAKES.length === 10, 'valleys, research, trips and keepsakes');
ok(RESEARCH.every((r) => !r.needs || RESEARCH.findIndex((x) => x.id === r.needs) < RESEARCH.indexOf(r)), 'research only needs earlier research');
ok(TRIPS[0].minutes === 15 && TRIPS.at(-1).minutes === 480, 'trips run from 15 minutes to 8 hours');
ok(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length && ACHIEVEMENTS.length >= 50, `${ACHIEVEMENTS.length} achievements with their own ids`);

// ---- costs
ok(costOf(0, 0, 1) === 4 * PACE, 'the second hay meadow costs 4 × PACE');
near(costOf(1, 10, 1), 60 * PACE * 1.15 ** 10, 1e-12, 'level cost grows by the building’s rate');
near(costOf(2, 7, 5), [0, 1, 2, 3, 4].reduce((a, k) => a + costOf(2, 7 + k, 1), 0), 1e-12, 'a bundle costs the sum of its levels');
near(costOf(3, 0, 10, 0.5), costOf(3, 0, 10) / 2, 1e-12, 'discounts scale every price');
for (const [lvl, coins] of [[0, 1e3], [50, 1e9], [300, 1e40], [10, 0]]) {
  const n = maxAfford(4, lvl, coins);
  ok(n === 0 ? coins < costOf(4, lvl, 1) : costOf(4, lvl, n) <= coins && costOf(4, lvl, n + 1) > coins, `max buy is exact at level ${lvl} with ${fmt(coins)}`);
}
ok(maxAfford(0, MAX_LEVEL - 3, 1e300) === 3, 'max buy stops at the level cap');

// ---- buying, milestones, festivals
{
  const g = fresh(); const s = g.s;
  ok(s.levels[0] === 1 && s.managers[0] && s.coins === 0, 'a new game starts with one hay meadow that Dora runs');
  ok(!g.buy(0), 'nothing to buy with no coins'); ok(!g.buy(1), 'the spa needs coins');
  s.coins = 1e6; ok(!g.buy(2), 'a building needs the one before it'); ok(g.buy(1, 1) && s.levels[1] === 1 && g.buy(2, 1), 'buying opens the next building');
  const before = s.coins, c = g.buyCost(0, 9); ok(g.buy(0, 9) && s.levels[0] === 10, 'buy ×9'); near(s.coins, before - c, 1e-12, 'coins spent');
  ok(g.events.some((e) => e.kind === 'milestone' && e.i === 0 && e.level === 10 && e.x === 2), 'reaching 10 is a milestone event');
  ok(milestoneMult(9) === 1 && milestoneMult(10) === 2 && milestoneMult(100) === 2 * 2 * 2 * 3 && nextMilestone(10) === 25 && nextMilestone(1000) === null, 'milestone multipliers stack');
  ok(milestoneMult(1000) === MILESTONES.reduce((a, [, x]) => a * x, 1), 'every milestone counted at 1000');
  g.setBuy(10); ok(g.buyCount(0) === 10, 'buy ×10'); g.setBuy(0); s.coins = 1e4; ok(g.buyCount(0) === maxAfford(0, s.levels[0], 1e4, g.costMult()), 'buy max'); g.setBuy(1);
  const h = fresh(); h.s.coins = 1e300; for (let i = 0; i < N; i++) h.buy(i, 10); h.events.length = 0; const r1 = h.globalMult();
  ok(h.s.levels.every((l) => l === 10 || l === 11), 'every building to 10');
  near(r1, (1 + ACH_BONUS * h.s.achieved.length) * 2, 1e-12, 'a valley festival doubles everything');
  h.buy(0, 15); for (let i = 1; i < N; i++) h.buy(i, 15); ok(h.events.some((e) => e.kind === 'festival' && e.level === 25), 'festival event at 25');
}

// ---- production, helpers and running by paw
{
  const g = fresh(); const s = g.s; s.coins = 1e9;
  g.buy(0, 9); g.buy(1, 5);
  const pay0 = g.cyclePay(0); near(pay0, 10 * 1 * 2 * g.globalMult(), 1e-12, 'meadow pays levels × output × milestone');
  near(g.baseRate(), pay0, 1e-12, 'only buildings with a helper count for the steady rate');
  const c0 = s.coins; g.tick(1); near(s.coins - c0, pay0, 1e-9, 'one second of the meadow');
  ok(g.run(1) && !g.run(1) && s.cycles[1] === 0, 'a building without a helper runs one cycle per tap');
  const c1 = s.coins; for (let k = 0; k < 30; k++) g.tick(0.1); near(s.coins - c1, 3 * pay0 + g.cyclePay(1), 1e-9, 'the spa pays when its 3 s cycle ends');
  ok(s.cycles[1] === -1, 'and then waits for another tap');
  s.coins = 0; ok(!g.hire(1), 'helpers cost coins'); s.coins = 1e9;
  ok(g.hire(1) && s.managers[1] && !g.hire(1), 'hire the spa helper once'); near(g.baseRate(), pay0 + g.cyclePay(1) / 3, 1e-12, 'with a helper the spa counts in the rate');
  ok(!g.hire(5), 'no helper for a building you do not have');
  // perks
  const t1 = g.tapSeconds(); ok(t1 === 0.04, 'Dora’s perk doubles the 0.02 s tap');
  const sp = g.cyclePay(1); s.managers[1] = false; const sp2 = g.cyclePay(1); s.managers[1] = true; near(sp / sp2, 2, 1e-12, 'Enzo doubles the spa');
  s.managers[2] = true; near(g.costMult(), 0.97, 1e-12, 'Pebble trims prices'); s.managers[2] = false;
  // upgrades
  const u = UPGRADES.find((x) => x.target === 0); const m0 = g.cyclePay(0); s.coins = u.cost; ok(g.upgrade(u.id) && !g.upgrade(u.id), 'buy an upgrade once'); near(g.cyclePay(0) / m0, 3, 1e-12, 'an upgrade triples its building');
  const all = UPGRADES.find((x) => x.target === 'all'); s.coins = all.cost; const gm = g.globalMult(); g.upgrade(all.id); near(g.globalMult() / gm, all.x, 1e-12, 'an everything upgrade');
}

// ---- taps, fluff bursts, visitors, boosts
{
  const g = fresh(); const s = g.s;
  ok(g.tap() === 1, 'a tap is worth at least one coin');
  s.coins = 1e9; g.buy(0, 99); const r = g.rate(); near(g.tap(), r * 0.04, 1e-12, 'a tap is 0.04 s of production with Dora');
  for (let k = 0; k < FLUFF.max; k++) g.tap();
  const b = g.boost('fluff'); ok(b && b.mult === FLUFF.mult && Math.abs(b.until - s.t - FLUFF.seconds) < 1e-9 && s.fluff === 0, `${FLUFF.max} taps make a Fluff Burst`);
  near(g.rate(), r * FLUFF.mult, 1e-12, 'a burst multiplies the rate'); g.tap(); ok(s.fluff === 0, 'the meter rests during a burst');
  for (let k = 0; k < 16; k++) g.tick(1); ok(!g.boost('fluff') && s.boosts.length === 0, 'the burst ends');
  // visitors arrive on the seeded schedule and leave after a while
  let seen = 0, kinds = new Set();
  for (let k = 0; k < 4000; k++) { g.tick(1); if (s.visitor && g.events.some((e) => e.kind === 'visitor')) { seen++; kinds.add(s.visitor.kind); } g.events.length = 0; }
  ok(seen >= 20 && seen <= 60 && kinds.size === 5, `visitors every 75–150 s, of every kind (${seen})`);
  for (let k = 0; k < 300 && !s.visitor; k++) g.tick(1);
  const v = s.visitor; ok(v && v.until - v.at === 12, 'a visitor stays 12 s');
  for (let k = 0; k < 13; k++) g.tick(1); ok(s.visitor === null || s.visitor.at !== v.at, 'and then flies on');
  const h = fresh(); h.s.achieved = ACHIEVEMENTS.map((x) => x.id); h.s.coins = 1e9; h.buy(0, 99); const hr = h.rate();
  h.s.visitor = { kind: 'acorn', at: 0, until: 12, y: 0.3, dir: 1 }; ok(/Golden Acorn/.test(h.catchVisitor()), 'catch a golden acorn'); near(h.rate(), hr * ACORN.mult, 1e-12, '×7');
  h.s.visitor = { kind: 'pedlar', at: 0, until: 12, y: 0.3, dir: 1 }; const hc = h.s.coins; h.catchVisitor(); near(h.s.coins - hc, h.baseRate() * 600, 1e-12, 'the pedlar brings 10 minutes of production');
  h.s.visitor = { kind: 'owl', at: 0, until: 12, y: 0.3, dir: 1 }; h.catchVisitor(); ok(h.s.items.bp === 1, 'the owl brings a blueprint');
  h.s.visitor = { kind: 'bat', at: 0, until: 12, y: 0.3, dir: 1 }; h.catchVisitor(); ok(h.s.items.berry === 1 && h.s.stats.visitors === 4, 'the bat brings a sunberry');
  ok(h.catchVisitor() === null, 'nothing to catch when no one is there');
  h.s.boosts = []; ok(h.useBerry() && !h.useBerry(), 'eat a sunberry'); near(h.rate(), hr * BERRY.mult, 1e-12, 'a sunberry triples');
  h.s.items.berry = 1; h.useBerry(); ok(Math.abs(h.boost('berry').until - h.s.t - 2 * BERRY.seconds) < 1e-9, 'a second sunberry adds ten more minutes');
  h.s.items.clock = 1; const cc = h.s.coins; ok(h.useClock(), 'clock acorn'); near(h.s.coins - cc, h.baseRate() * 3600, 1e-12, 'a clock acorn is an hour of production');
}

// ---- time away equals time online
const busy = (seed, valley = 0) => {
  // every achievement already earned: ones unlocked partway through would apply sooner online than away
  const g = fresh(seed); const s = g.s; s.valley = valley; s.coins = 1e40; s.achieved = ACHIEVEMENTS.map((x) => x.id);
  for (let i = 0; i < N; i++) { g.buy(i, 30 + i); if (i < 9) g.hire(i); }
  s.coins = 0; g.run(10); g.run(11); s.boosts.push({ kind: 'acorn', mult: 7, until: s.t + 30 }, { kind: 'berry', mult: 3, until: s.t + 900 });
  s.nextVisit = 1e12; s.nextShower = 1e12; g.events.length = 0;
  return g;
};
for (const valley of [0, 1, 2]) {
  const a = busy(3, valley), b = busy(3, valley);
  for (let k = 0; k < 36000; k++) a.tick(0.1);
  const sum = b.catchUp(T0 + 3600e3);
  near(a.s.coins, b.s.coins, 1e-9, `an hour away pays the same as an hour online in ${VALLEYS[valley].name}`);
  ok(Math.abs(sum.credited - 3600) < 1e-6 && !sum.capped && Math.abs(sum.coins - b.s.coins) < 1e-6 * b.s.coins, 'the away summary');
  ok(a.s.boosts.length === 0 && b.s.boosts.length === 0, 'boosts run out either way');
  near(sum.by.reduce((x, y) => x + y, 0), sum.coins, 1e-9, 'the welcome-back card’s per-building coins add up to the total');
  ok(sum.by.length === N && sum.by.every((c, i) => (i < 9 ? c > 0 : i === 9 ? c === 0 : c >= 0)), 'every helper-run building earned, the idle one did not');
  ok(sum.by[8] > sum.by[0], 'a later building out-earns the first');
}
{
  // the shopping list matches what the shop would actually allow
  const g = fresh(5); g.s.coins = 1e40; for (let i = 0; i < 4; i++) g.buy(i, 20); g.s.coins = g.managerCost(1) + 1;
  const sh = g.shopping();
  ok(sh.levels.length > 0 && sh.levels.every((i) => new HayloftGame(structuredClone(g.s)).buy(i, 1)), 'every listed level can be bought');
  ok(!sh.levels.includes(5), 'a building that is not unlocked yet is not listed');
  ok(sh.hires.includes(1) && sh.hires.every((i) => g.s.levels[i] > 0 && !g.s.managers[i]), 'affordable helpers for owned buildings');
  ok(sh.upgrades.every((id) => new HayloftGame(structuredClone(g.s)).upgrade(id)), 'every listed upgrade can be bought');
  g.s.coins = 0; const none = g.shopping(); ok(!none.levels.length && !none.hires.length && !none.upgrades.length, 'nothing is listed with no coins');
}
{
  const g = busy(4), r = g.baseRate(), paw = g.cyclePay(10) + g.cyclePay(11);
  const sum = g.catchUp(T0 + 30 * 3600e3);
  ok(sum.capped && sum.credited === 8 * 3600 && Math.abs(sum.away - 30 * 3600) < 1e-6, 'away time counts for 8 hours to start with');
  ok(g.s.wall === T0 + 30 * 3600e3, 'the clock still moves to now');
  ok(g.offlineCapHours() === 8, 'the cap'); g.s.tree.naps = 2; g.s.research.push('naps', 'deepnaps'); g.s.moon.dreams = 1; ok(g.offlineCapHours() === 8 + 4 + 2 + 4 + 8, 'Long Naps, research and Long Dreams raise it');
  near(sum.coins, r * (8 * 3600 + 20 * 30 + 2 * 870) + paw, 1e-9, 'capped pay is eight hours of the rate, the boosts while they last, and the two by-paw cycles');
  const h = fresh(); const back = h.catchUp(T0 - 5000); ok(back.away === 0 && h.s.wall === T0, 'a clock that went backwards credits nothing');
}
{
  // tides integrate exactly
  near(tideIntegral(0, TIDE.period), TIDE.period, 1e-12, 'a whole tide averages out');
  let sum = 0; for (let t = 0; t < 100; t += 0.001) sum += tideAt(t + 0.0005) * 0.001; near(sum, tideIntegral(0, 100), 1e-6, 'the tide integral');
  const g = fresh(); g.s.valley = 2; g.s.coins = 1e12; g.buy(1, 1); g.buy(2, 1); g.hire(2); g.s.coins = 0; const base = g.baseRate(); g.s.t = 60;
  near(g.rate(), base * (1 + TIDE.amp), 1e-12, 'high tide at a quarter period');
  g.s.valley = 0; const flat = g.cyclePay(2); g.s.valley = 2; near(g.cyclePay(2) / flat, 5, 1e-12, 'the polishery shines ×5 in Pebble Cove');
}
{
  const g = fresh(); g.s.coins = 1e12; g.buy(1, 1); g.s.valley = 1; ok(g.cycleTime(1) === 6, 'Snowdrift: by-paw buildings take twice as long');
  const p = g.cyclePay(0); g.s.valley = 0; near(p / g.cyclePay(0), 1.5, 1e-12, 'Snowdrift: buildings with a helper make 50% more');
  g.s.valley = 4; ok(g.tapSeconds() === 0.08, 'Cloudreach: taps ×2'); g.s.coins = 1e60; for (let i = 0; i < N; i++) g.buy(i, 1);
  const top = g.cyclePay(11); g.s.valley = 0; near(top / g.cyclePay(11), 3, 1e-12, 'Cloudreach: top buildings ×3');
  g.s.valley = 3; ok(Math.abs(g.visitRate() - 2.5) < 1e-12, 'Glowcap: visitors 2.5× as often'); g.s.spores = 10; const sp = g.globalMult(); g.s.spores = 0; near(sp / g.globalMult(), 1.3, 1e-12, 'Glowcap: spores');
  g.s.valley = 7; ok(g.valleyDef.id === 'cove' && g.year === 2, 'valleys cycle round, year by year');
}

// ---- the Great Migration and the Star Tree
{
  const g = fresh(); const s = g.s;
  ok(!g.canMigrate() && g.migrate() === 0, 'no migration without a skyship');
  s.coins = 1e40; for (let i = 0; i <= GATE; i++) g.buy(i, 1); s.earned = 1e22; s.lifetime = 1e22;
  ok(stardustFor(1e22) === 100 && stardustFor(1e18) === 10 && stardustFor(0) === 0, 'Stardust is 10 × (earned / 1e18)^¼');
  ok(g.pendingStardust() === 100 && g.canMigrate(), 'a skyship opens the migration');
  s.managers[3] = true; s.managers[9] = true; s.upgrades.push('bunting'); s.items.bp = 5; s.research.push('sickles');
  ok(g.migrate() === 100, 'migrate');
  ok(s.stardust === 100 && s.starsEver === 100 && s.valley === 1 && s.stats.migrations === 1 && g.valleyDef.id === 'snowdrift', 'Stardust kept, on to Snowdrift');
  ok(s.coins === 0 && s.earned === 0 && s.levels[0] === 1 && s.levels.slice(1).every((l) => l === 0) && s.upgrades.length === 0, 'a fresh valley');
  ok(s.managers[0] && !s.managers[3] && s.items.bp === 5 && s.research.includes('sickles'), 'helpers go home; items and research stay');
  near(stardustShine(100), 6, 1e-12, 'Stardust shines: 1 + ½√100');
  ok(g.globalMult() > 5.9, 'and the valley feels it');
  ok(g.buyTree('starlit') && s.tree.starlit === 1 && s.stardust === 90, 'Starlit Fields for 10');
  s.stardust = 1; ok(!g.buyTree('nope') && !g.buyTree('pockets') && s.stardust === 1, 'unknown or unaffordable nodes');
  s.stardust = 1e9; for (let k = 0; k < 10; k++) g.buyTree('pockets'); ok(s.tree.pockets === 2 && g.tripSlots() === 4, 'Big Pockets stops at its max');
  g.buyTree('welcome'); g.buyTree('welcome'); g.buyTree('friends'); s.managers = s.managers.map(() => true);
  s.coins = 1e40; for (let i = 0; i <= GATE; i++) g.buy(i, 1); s.earned = 1e18;
  g.migrate(); ok(s.coins === 1e5 && s.managers.slice(0, 4).every(Boolean) && !s.managers[4], 'Warm Welcome coins and Old Friends keep the first four helpers');
  s.tree.moonbeam = 3; s.coins = 1e40; for (let i = 0; i <= GATE; i++) g.buy(i, 1); s.earned = 1e22; ok(g.pendingStardust() === 130, 'Moonbeam adds 10% a level');
}

// ---- Constellations
{
  const g = fresh(); const s = g.s;
  s.starsEver = CONSTELLATION_AT - 1; ok(!g.canConstellate(), 'not before the threshold');
  s.starsEver = 8e5; s.stardust = 5000; s.tree.starlit = 5; s.valley = 13; s.items.clock = 3; s.research.push('trails'); s.keepsakes[2] = 1;
  ok(moonstonesFor(8e5) === 4 && g.canConstellate() && g.constellate() === 4, 'four Moonstones for 800K Stardust');
  ok(s.moonstones === 4 && s.constellations === 1 && s.stardust === 0 && s.starsEver === 0 && !s.tree.starlit && s.valley === 0, 'Stardust and the tree become Moonstones; home to Meadowvale');
  ok(s.items.clock === 3 && s.research.includes('trails') && s.keepsakes[2] === 1, 'items, research and keepsakes stay');
  ok(g.buyMoon('sky') && s.moon.sky === 1 && s.moonstones === 3, 'Night Sky for 1');
  const gm = g.globalMult(); s.moon.sky = 2; near(g.globalMult() / gm, 3, 1e-12, 'Night Sky ×3 a level');
  g.buyMoon('founders'); s.managers = s.managers.map(() => true); s.coins = 1e40; for (let i = 0; i <= GATE; i++) g.buy(i, 1); s.earned = 1e20; g.migrate();
  ok(s.managers.every(Boolean), 'Seasoned Founders keep every helper');
  s.moon.starseed = 1; s.coins = 1e40; for (let i = 0; i <= GATE; i++) g.buy(i, 1); s.earned = 1e20; g.migrate(); ok(s.levels.slice(0, 4).every((l) => l === 25) && s.levels[4] === 0, 'Starseed plants four buildings at 25');
}

// ---- research
{
  const g = fresh(); const s = g.s;
  ok(!g.canResearch('sickles'), 'research needs blueprints'); s.items.bp = 100;
  ok(!g.canResearch('sand'), 'and its earlier research');
  ok(g.study('sickles') && s.items.bp === 99 && !g.study('naps'), 'one study at a time');
  g.catchUp(s.wall + 4 * 60e3); ok(!g.has('sickles'), 'not done after 4 minutes');
  const ev = (g.events.length = 0, g.catchUp(s.wall + 61e3)); ok(g.has('sickles') && !s.studying && ev.research.includes('sickles'), 'done after 5, even while away');
  g.study('naps'); s.items.clock = 1; ok(g.rush('research') && g.has('naps') && !s.studying && s.items.clock === 0, 'a clock acorn brings research an hour closer, finishing a short one');
  ok(!g.rush('research'), 'no acorn, no rush');
  g.catchUp(s.wall + 15 * 60e3); ok(g.has('naps') && g.offlineCapHours() === 10, 'Comfy Naps: +2 h');
  const p = g.cyclePay(0); s.research = s.research.filter((r) => r !== 'sickles'); near(p / g.cyclePay(0), 3, 1e-12, 'Sharper Sickles triples the meadow');
}

// ---- trips
{
  const g = fresh(7); const s = g.s;
  ok(g.tripSlots() === 2 && g.sendTrip('brook') && g.sendTrip('peaks') && !g.sendTrip('woods'), 'two teams to start');
  ok(!g.sendTrip('moon', 2), 'unknown places');
  ok(s.trips[0].ends - s.trips[0].start === 15 * 60e3 && s.trips[1].ends - s.trips[1].start === 480 * 60e3, 'trips take 15 minutes and 8 hours');
  const finds = (L) => L.bp + L.berry + L.clock + L.trailmix + (L.stardust ? 1 : 0);
  ok(finds(s.trips[0].loot) === 1 && finds(s.trips[1].loot) === 14, 'finds are rolled when a team sets off');
  ok(g.claimTrip(0) === null, 'not home yet');
  g.catchUp(s.wall + 16 * 60e3); const sum = g.catchUp(s.wall); ok(sum.tripsReady === 1, 'the away summary counts teams home');
  const bp = s.items.bp + s.items.berry + s.items.clock; const got = g.claimTrip(0);
  ok(got.length >= 1 && s.trips[0] === null && s.stats.trips === 1 && s.items.bp + s.items.berry + s.items.clock >= bp, 'claim a trip');
  s.items.clock = 2; ok(g.rush(1) && s.items.clock === 1, 'rush a trip');
  s.trips[1].loot.keepsake = 4; s.trips[1].ends = s.wall; g.claimTrip(1); ok(s.keepsakes[4] === 1, 'a keepsake for the shelf');
  const gm = g.globalMult(); s.keepsakes[4] = 0; near(gm / g.globalMult(), 1.1, 1e-12, 'each keepsake adds 10%'); s.keepsakes[4] = 1;
  g.sendTrip('brook', 0); s.trips[0].loot.keepsake = 4; s.trips[0].ends = s.wall; const b0 = s.items.bp; g.claimTrip(0); ok(s.keepsakes[4] === 2 && s.items.bp >= b0 + 2, 'a second one trades for blueprints');
  s.tree.maps = 1; s.research.push('trails'); g.sendTrip('ridge', 0); near(s.trips[0].ends - s.trips[0].start, 60 * 60e3 * 0.9 * 0.85, 1e-9, 'Map Makers and Trail Maps shorten trips');
  const x = fresh(7), y = fresh(7); x.sendTrip('lake'); y.sendTrip('lake'); ok(JSON.stringify(x.s.trips[0].loot) === JSON.stringify(y.s.trips[0].loot), 'the same seed finds the same things');
  const z = fresh(7); z.s.managers[5] = true; z.sendTrip('brook'); ok(finds(z.s.trips[0].loot) === 2, 'Biscuit adds a find');
}

// ---- daily gift
{
  const g = fresh(); const s = g.s;
  ok(g.dailyReady(100) && /Day 1/.test(g.claimDaily(100)) && s.items.bp === 2, 'day 1: two blueprints');
  ok(g.claimDaily(100) === null && !g.dailyReady(100), 'once a day');
  g.claimDaily(101); g.claimDaily(102); ok(s.daily.streak === 3 && s.items.berry === 1 && s.items.clock === 1, 'a streak');
  g.claimDaily(105); ok(s.daily.streak === 1 && s.daily.best === 3, 'a missed day starts again');
  for (let d = 106; d < 112; d++) g.claimDaily(d); ok(s.daily.streak === 7 && s.starsEver === 5, 'day 7 brings Stardust');
  ok(s.achieved.includes('daily-1'), 'Week of Gifts');
}

// ---- achievements
{
  const g = fresh(); g.tap(); g.s.coins = 1e40; g.buy(0, 24); ok(g.s.achieved.includes('meadow-25') && g.events.some((e) => e.kind === 'achievement'), 'achievements unlock with an event');
  const gm = g.globalMult(), n = g.s.achieved.length; g.s.achieved.pop(); near(gm / g.globalMult(), (1 + ACH_BONUS * n) / (1 + ACH_BONUS * (n - 1)), 1e-12, 'each adds 3%');
}

// ---- the Twig Shower
{
  const g = fresh(); g.s.achieved = ACHIEVEMENTS.map((x) => x.id); g.s.coins = 1e9; g.buy(0, 50);
  ok(g.startShower() === null, 'no shower until one is offered');
  for (let k = 0; k < 400 && !g.s.shower; k++) g.tick(1); ok(g.s.shower && g.events.some((e) => e.kind === 'shower'), 'a shower is offered after a few minutes');
  for (let k = 0; k < SHOWER.offer + 1; k++) g.tick(1); ok(!g.s.shower, 'the offer passes after 45 s');
  for (let k = 0; k < 700 && !g.s.shower; k++) g.tick(1);
  const seed = g.startShower(); ok(Number.isInteger(seed) && !g.s.shower, 'start it');
  const a = new TwigShower(seed), b = new TwigShower(seed);
  let caught = 0; while (!a.done) { a.tick(1 / 60); b.tick(1 / 60); for (const t of a.twigs) if (!t.caught && !t.gone && a.y(t) > 0.5) { if (a.tap(t.x, a.y(t))) caught++; } }
  ok(a.twigs.length >= 20 && a.twigs.length <= 40, `${a.twigs.length} twigs in ten seconds`);
  ok(caught === a.twigs.length && a.caught >= a.twigs.length, 'every twig can be caught');
  ok(JSON.stringify(b.twigs.map((t) => [t.x, t.born, t.gold])) === JSON.stringify(a.twigs.map((t) => [t.x, t.born, t.gold])), 'the same seed drops the same twigs');
  while (!b.done) b.tick(1 / 60);
  ok(b.done && b.twigs.every((t) => t.gone), 'missed twigs land in the grass');
  ok(a.tap(0.5, 0.5) === null, 'tapping empty air catches nothing');
  const r = g.rate(), res = g.finishShower(20); ok(res.mult === 3 && res.seconds === 120, '20 caught: ×3 for two minutes'); near(g.rate(), r * 3, 1e-12, 'the twig boost');
  ok(g.finishShower(1000).mult === SHOWER.cap, 'capped at ×6');
  ok(g.s.stats.showers === 2 && g.s.stats.bestShower === 200, 'shower stats');
}

// ---- saving
{
  const g = fresh(11); g.s.coins = 1e30; for (let i = 0; i < 6; i++) { g.buy(i, 20); g.hire(i); } g.sendTrip('caves'); g.s.items.bp = 9; g.study('sickles'); g.s.tree.starlit = 2; g.s.moon.sky = 1;
  for (let k = 0; k < 500; k++) g.tick(0.5);
  g.s.visitor = null; g.s.shower = null; // visitors and shower offers are not kept: coming back clears them anyway
  const raw = g.save(), back = readSave(raw, 1, T0);
  ok(back.save() === raw, 'a save reads back exactly');
  ok(readSave(null, 5, T0).save() === JSON.stringify(freshState(5, T0)), 'no save: a fresh valley');
  for (const bad of ['', '{', 'null', '[]', '42', '"x"', JSON.stringify({ v: 2, coins: 5 }), JSON.stringify({ v: 1 })]) {
    const h = readSave(bad, 3, T0); ok(h.s.levels[0] >= 1 && Number.isFinite(h.s.coins) && h.s.managers[0], `a broken save (${bad.slice(0, 12)}) gives a playable valley`);
  }
  const o = JSON.parse(raw);
  Object.assign(o, { coins: 'lots', earned: -5, levels: [1, 2], managers: 'yes', upgrades: ['bunting', 'nope', 3], tree: { starlit: 999, junk: 4 }, research: ['sickles', 'sickles', 'fake'],
    trips: [{ dest: 'mars' }, null, null, null, null], boosts: [{ kind: 'acorn', mult: 1e9, until: 5 }, { kind: 'bad', mult: 2, until: 9 }], items: { bp: NaN, berry: 2.7 }, buy: 7, keepsakes: [1], daily: null, stats: 4 });
  const h = readSave(JSON.stringify(o), 3, T0);
  ok(h.s.coins === 0 && h.s.earned === 0 && h.s.levels.length === N && h.s.managers.length === N && h.s.managers[0], 'bad numbers and arrays fall back');
  ok(h.s.upgrades.join() === 'bunting' && h.s.tree.starlit === 40 && !('junk' in h.s.tree) && h.s.research.join() === 'sickles', 'lists are filtered and clamped');
  ok(h.s.trips.every((x) => x === null) && h.s.boosts.length === 1 && h.s.boosts[0].mult === 100, 'trips and boosts are checked');
  ok(h.s.items.bp === 0 && h.s.items.berry === 2 && h.s.buy === 1 && h.s.keepsakes.length === KEEPSAKES.length && h.s.daily.last === -1 && h.s.stats.taps === 0, 'items, settings and stats');
  h.tick(1); h.catchUp(T0 + 3600e3); ok(Number.isFinite(h.s.coins), 'a repaired save plays on');
}

// ---- determinism: a seed, the timestamps and the actions replay exactly
{
  const playLog = (seed) => {
    const g = fresh(seed);
    for (let k = 0; k < 4000; k++) {
      g.tick(0.25); if (k % 3 === 0) g.tap();
      if (g.s.visitor && k % 7 === 0) g.catchVisitor();
      if (k % 20 === 0) for (let i = 0; i < N; i++) { g.buy(i, 1); g.hire(i); g.run(i); }
      if (g.s.shower) { g.startShower(); g.finishShower(k % 30); }
      if (k === 100) g.sendTrip('brook');
      if (k === 2000) g.catchUp(g.s.wall + 3 * 3600e3);
      if (k === 2001) g.claimTrip(0);
    }
    return g.save();
  };
  ok(playLog(21) === playLog(21), 'the same seed and actions give the same save');
  ok(playLog(21) !== playLog(22), 'another seed plays differently');
  const [v1, s1] = rand(1), [v2] = rand(1); ok(v1 === v2 && v1 >= 0 && v1 < 1 && s1 !== 1, 'the generator');
}

// ---- number formatting
{
  const cases = [[0, '0'], [7, '7'], [7.25, '7.2'], [999, '999'], [1000, '1.00K'], [1234, '1.23K'], [12345, '12.3K'], [999999, '999K'], [999999.9, '999K'], [1e6, '1.00M'], [2.5e9, '2.50B'], [1e12, '1.00T'],
    [1e15, '1.00aa'], [4.56e16, '45.6aa'], [1e18, '1.00ab'], [1e90, '1.00az'], [1e93, '1.00ba'], [1e29, '100ae'], [1e27, '1.00ae'], [Infinity, '∞'], [NaN, '0'], [-1500, '-1.50K']];
  for (const [n, s] of cases) ok(fmt(n) === s, `fmt(${n}) = ${s} (got ${fmt(n)})`);
  ok(fmt(1e300).length <= 7, 'even 1e300 is short');
  for (let e = 3; e < 300; e += 0.37) { const s = fmt(10 ** e); ok(/^\d{1,3}(\.\d{1,2})?[A-Za-z]{1,2}$/.test(s), `fmt(1e${e.toFixed(2)}) = ${s}`); }
  ok(fmtTime(45) === '45s' && fmtTime(125) === '2m 5s' && fmtTime(3600) === '1h' && fmtTime(3 * 3600 + 1200) === '3h 20m' && fmtTime(50 * 3600) === '2d 2h', 'durations');
}

// ---- number range: the most the content can make stays far inside a double
{
  const g = fresh(); const s = g.s;
  s.levels = s.levels.map(() => MAX_LEVEL); s.managers = s.managers.map(() => true); s.upgrades = UPGRADES.map((u) => u.id);
  s.research = RESEARCH.map((r) => r.id); s.achieved = ACHIEVEMENTS.map((a) => a.id); s.keepsakes = s.keepsakes.map(() => 1);
  for (const d of STAR_TREE) s.tree[d.id] = d.max; for (const d of MOON_SHOP) s.moon[d.id] = d.max; s.starsEver = 1e30; s.spores = 1e6;
  let worst = 0;
  for (let v = 0; v < 5; v++) { s.valley = v; s.boosts = [{ kind: 'fluff', mult: 5, until: 1e9 }, { kind: 'acorn', mult: 7, until: 1e9 }, { kind: 'twig', mult: 6, until: 1e9 }, { kind: 'berry', mult: 3, until: 1e9 }]; worst = Math.max(worst, g.rate() * 3600 * 48); }
  const priciest = Math.max(...BUILDINGS.map((_, i) => costOf(i, MAX_LEVEL - 1, 1)), ...UPGRADES.map((u) => u.cost));
  ok(Number.isFinite(worst) && worst < 1e200, `two days of the biggest possible valley: ${worst.toExponential(2)}`);
  ok(priciest < 1e200, `the most expensive thing: ${priciest.toExponential(2)}`);
  ok(stardustFor(1e200) < 1e50 && moonstonesFor(1e50) < 1e24, 'Stardust and Moonstones grow slowly');
}

console.log(`Hayloft Tycoon: ${checks} engine checks passed.`);
