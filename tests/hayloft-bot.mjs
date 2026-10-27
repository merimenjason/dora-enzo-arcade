// Hayloft Tycoon bots: three kinds of player run the real engine for a simulated day. An active tapper plays eight hours
// straight, a commuter opens the game for two minutes every twenty minutes, and an idle player looks in every three hours.
// Asserts the pacing: the first Great Migration lands 45–90 minutes into active play, there is always something to buy within
// a few minutes, every migration earns more than the last, and nothing overflows. Prints the pacing table.
import assert from 'node:assert/strict';
import { HayloftGame, BUILDINGS, MANAGERS, UPGRADES, RESEARCH, TRIPS, STAR_TREE, MOON_SHOP, N, GATE, milestoneMult, nextMilestone, costOf, fmt, rand } from '../.checks/hayloft-game.js';

const H = 3600, START = Date.UTC(2026, 9, 27, 7, 0, 0);
const day = (g) => Math.floor(g.s.wall / 86400000);

/** Rough payback time (s) of everything buyable now, best first. */
function options(g) {
  const s = g.s, global = g.globalMult(), cm = g.costMult(), out = [];
  for (let i = 0; i < N; i++) {
    if (!g.unlocked(i) || s.levels[i] >= 1000) continue;
    const lv = s.levels[i], per = (BUILDINGS[i].out / BUILDINGS[i].cycle) * (g.buildingMult(i, global) / milestoneMult(lv));
    // buy to the next milestone as one bundle, or one level when the milestone is far
    for (const n of [1, Math.max(1, (nextMilestone(lv) ?? lv + 1) - lv)]) {
      if (lv + n > 1000) continue;
      const gain = ((lv + n) * milestoneMult(lv + n) - lv * milestoneMult(lv)) * per, cost = costOf(i, lv, n, cm);
      const w = s.managers[i] ? 1 : 0.6; // buildings without a helper only pay while tapped along
      out.push({ kind: 'b', i, n, cost, pay: cost / Math.max(1e-300, gain * w) });
    }
    if (!s.managers[i] && lv > 0) out.push({ kind: 'm', i, cost: g.managerCost(i), pay: g.managerCost(i) / Math.max(1e-300, (g.cyclePay(i, global) / BUILDINGS[i].cycle) * 0.6) / 4 });
  }
  const rate = Math.max(1, g.baseRate());
  for (const u of UPGRADES) if (!s.upgrades.includes(u.id) && (u.target === 'all' || s.levels[u.target] > 0)) {
    const gain = u.target === 'all' ? rate * (u.x - 1) : (g.cyclePay(u.target, global) / BUILDINGS[u.target].cycle) * (u.x - 1);
    out.push({ kind: 'u', id: u.id, cost: u.cost, pay: u.cost / Math.max(1e-300, gain) });
  }
  return out.sort((a, b) => a.pay - b.pay);
}
/** Buys like a sensible player: the best deal if affordable, otherwise anything affordable that pays back nearly as fast. Returns purchases made. */
function shop(g) {
  let bought = 0;
  for (let k = 0; k < 400; k++) {
    const o = options(g); if (!o.length) break;
    const best = o[0], rate = Math.max(1e-9, g.rate()), wait = Math.max(0, (best.cost - g.s.coins) / rate);
    const pick = best.cost <= g.s.coins ? best : o.find((x) => x.cost <= g.s.coins && x.pay < best.pay + wait);
    if (!pick) break;
    const ok = pick.kind === 'b' ? g.buy(pick.i, pick.n) : pick.kind === 'm' ? g.hire(pick.i) : g.upgrade(pick.id);
    if (!ok) break; bought++;
  }
  return bought;
}
/** The calm jobs: gifts, trips, research, items, the Star Tree and migrating. */
function chores(g, p, log) {
  const s = g.s;
  g.claimDaily(day(g));
  for (let k = 0; k < 5; k++) if (s.trips[k] && s.wall >= s.trips[k].ends) g.claimTrip(k);
  for (let k = 0; k < g.tripSlots(); k++) if (!s.trips[k]) g.sendTrip(p.trip(k, g), k);
  for (const r of RESEARCH) if (g.canResearch(r.id)) { g.study(r.id); break; }
  while (s.items.clock > 0 && g.baseRate() > 0) { if (s.studying && s.studying.ends - s.wall > H * 1000) g.rush('research'); else g.useClock(); }
  if (p.berries && s.items.berry > 0 && !g.boost('berry')) g.useBerry();
  if (g.canConstellate() && g.pendingMoonstones() >= 2) { const m = g.constellate(); log.const ??= s.stats.played; log.moons += m; }
  // migrate on doubling-ish, or sooner when the valley has stopped offering anything to buy
  const stalled = s.stats.played - (log.lastBuy ?? 0) > 150;
  if (g.canMigrate() && g.pendingStardust() >= Math.max(10, s.starsEver * (stalled ? 0.02 : 0.5))) {
    log.migr.push({ at: (s.wall - START) / 1000, gain: g.pendingStardust(), earned: s.earned, sky: s.constellations });
    g.migrate(); act(log, s.stats.played);
  }
  for (let k = 0; k < 50; k++) {
    const opts = [...MOON_SHOP.map((d) => ['m', d]), ...STAR_TREE.map((d) => ['t', d])]
      .filter(([w, d]) => (w === 'm' ? g.moon(d.id) : g.tree(d.id)) < d.max)
      .map(([w, d]) => [w, d, d.cost(w === 'm' ? g.moon(d.id) : g.tree(d.id))])
      .filter(([w, , c]) => c <= (w === 'm' ? s.moonstones : s.stardust)).sort((a, b) => a[2] - b[2]);
    if (!opts.length) break; const [w, d] = opts[0]; w === 'm' ? g.buyMoon(d.id) : g.buyTree(d.id);
  }
}
/** Plays for `sec` seconds: taps, runs buildings by paw, catches visitors, plays Twig Showers and shops. */
function play(g, sec, p, log, rng) {
  const dt = 0.5;
  for (let t = 0; t < sec; t += dt) {
    g.tick(dt);
    const s = g.s;
    for (let k = 0; k < p.taps * dt; k++) g.tap();
    for (let i = 0; i < N; i++) if (!s.managers[i] && s.levels[i] > 0 && s.cycles[i] < 0) g.run(i);
    if (s.visitor && s.t - s.visitor.at > 1.5) g.catchVisitor();
    if (s.shower && p.showers) { g.startShower(); g.finishShower(14 + Math.floor(rng() * 12)); }
    if (t % 2 === 0) {
      const n = shop(g), now = s.stats.played;
      if (n > 0) act(log, now);
      chores(g, p, log);
    }
    g.events.length = 0;
    for (const x of [s.coins, s.lifetime, g.rate()]) assert.ok(Number.isFinite(x) && x >= 0 && x < 1e200, `numbers stay finite (${x})`);
  }
}
/** Something worth doing happened (a purchase or a migration): the gap since the last one counts towards the longest wait. */
function act(log, now) { log.gap = Math.max(log.gap, now - (log.lastBuy ?? 0)); log.lastBuy = now; }
function away(g, sec) { g.catchUp(g.s.wall + sec * 1000); g.events.length = 0; }

const PLAYERS = {
  active: { taps: 4, showers: true, berries: true, trip: (k) => (k === 0 ? 'ridge' : 'woods') },
  commuter: { taps: 2, showers: true, berries: true, trip: (k) => (k === 0 ? 'lake' : 'woods') },
  idle: { taps: 0, showers: false, berries: false, trip: () => 'lake' },
};
function run(kind, seed) {
  const g = HayloftGame.fresh(seed, START), p = PLAYERS[kind], log = { migr: [], gap: 0, moons: 0, marks: {} };
  let r = seed; const rng = () => { const [v, n] = rand(r); r = n; return v; };
  const mark = (h) => { log.marks[h] = { migr: g.s.stats.migrations, life: g.s.stats.earned, stars: g.s.starsEver, rate: g.baseRate(), research: g.s.research.length, ach: g.s.achieved.length }; };
  const marks = [1, 2, 4, 8, 16, 24];
  for (const h of marks) {
    const until = START + h * H * 1000;
    while (g.s.wall < until - 1) {
      const left = (until - g.s.wall) / 1000;
      if (kind === 'active') { if (g.s.wall - START < 8 * H * 1000) play(g, Math.min(left, 600), p, log, rng); else { away(g, Math.min(left, 3 * H)); play(g, 1, p, log, rng); } }
      else if (kind === 'commuter') {
        const hour = ((g.s.wall - START) / 1000 / H) % 24;
        if (hour >= 16) { away(g, Math.min(left, (24 - hour) * H)); continue; }
        play(g, Math.min(left, 120), p, log, rng); if (left > 120) away(g, Math.min(left - 120, 18 * 60));
      } else { play(g, Math.min(left, 10), p, log, rng); if (left > 10) away(g, Math.min(left - 10, 3 * H)); }
    }
    mark(h);
  }
  return { g, log };
}

const table = [], firsts = [];
for (const kind of Object.keys(PLAYERS)) for (const seed of kind === 'active' ? [1, 2, 3] : [1]) {
  const { g, log } = run(kind, seed), first = log.migr[0]?.at, M = log.marks;
  if (kind === 'active') firsts.push(first);
  // steady growth: every mark earns more than the one before, and runs within one constellation pay more as they go
  const hours = Object.keys(M).map(Number);
  for (let k = 1; k < hours.length; k++) assert.ok(M[hours[k]].life > M[hours[k - 1]].life, `${kind}: still growing at ${hours[k]} h`);
  const runs = log.migr.filter((m) => m.sky === 0), third = Math.floor(runs.length / 3);
  if (third >= 2) {
    const avg = (xs) => xs.reduce((a, m) => a + m.gain, 0) / xs.length;
    assert.ok(avg(runs.slice(-third)) > avg(runs.slice(0, third)) * 2, `${kind}: later migrations give much more Stardust than early ones`);
  }
  if (kind !== 'idle') assert.ok(log.gap <= 300, `${kind}: never more than five minutes of play without something to buy or a migration (${Math.round(log.gap)} s)`);
  if (kind === 'active') {
    assert.ok(first >= 45 * 60 && first <= 90 * 60, `active #${seed}: first migration in 45–90 minutes (${(first / 60).toFixed(0)})`);
    assert.ok(M[8].migr >= 10 && log.const > 3 * H, `active #${seed}: plenty of migrations by 8 h, and the Constellation comes later on`);
  }
  if (kind === 'commuter') { assert.ok(M[8].migr >= 1 && M[24].migr >= 8, 'the commuter migrates on the first day'); assert.ok(!log.const, 'the commuter still has Constellations ahead after a day'); }
  if (kind === 'idle') assert.ok(M[24].migr >= 1, 'even looking in every three hours reaches a migration within a day');
  assert.ok(g.s.research.length >= 8, `${kind}: research keeps moving`);
  const row = { player: kind + (kind === 'active' ? ` #${seed}` : ''), 'first migration': first ? `${(first / 60).toFixed(0)} min` : '—' };
  for (const h of [1, 2, 4, 8, 24]) { const m = M[h]; row[`${h}h`] = `${m.migr}× ${fmt(m.life)} ✦${fmt(m.stars)}`; }
  row['longest wait'] = `${Math.round(log.gap)} s`; row.research = M[24].research; row.trophies = M[24].ach;
  row.constellation = log.const ? `${(log.const / H).toFixed(1)} h played` : '—';
  table.push(row);
  if (process.env.HAYLOFT_VERBOSE) console.log(kind, seed, log.migr.map((m) => `${(m.at / 60).toFixed(0)}m:+${m.gain}`).join(' '));
}
// a seeded commute replays exactly
const replay = () => { const g = HayloftGame.fresh(9, START), log = { migr: [], gap: 0, moons: 0, marks: {} }; let r = 9; const rng = () => { const [v, n] = rand(r); r = n; return v; }; for (let k = 0; k < 6; k++) { play(g, 120, PLAYERS.commuter, log, rng); away(g, 18 * 60); } return g.save(); };
assert.equal(replay(), replay(), 'a seeded run replays exactly');
console.log('Pacing (migrations × coins earned ✦ Stardust earned, at each mark of wall-clock time):');
console.table(table);
console.log(`Hayloft Tycoon bot: first migration at ${firsts.map((f) => (f / 60).toFixed(0) + ' min').join(', ')} of active play; no wait over five minutes; three player styles keep growing for a day.`);
