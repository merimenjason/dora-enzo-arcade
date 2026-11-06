// Coin of the Realm engine checks: generated towns (everyone joined up, the mayor in the middle, the right folk for the
// town, thieves' dens in far corners, the same from the same seed), the coin's reach by face (Dora two streets, Enzo next
// door, the Pedlar anywhere, the Juggler both ways up), never through or onto a thief, filling orders (fair, cheery,
// grumpy), Enzo overhearing, the Gossip, the Mayor's extra order, the Miser's plank and lost hours, thieves creeping
// and snatching, waiting, the Lucky toss, dusk and dawn, building a bridge, perks, losing, and the save.
import assert from 'node:assert/strict';
import { makeTown, dist, Run, TOWNS, DAYS, HOURS, ORDERS, SELLS, isTrade, newSave, parseSave, serialise, bank } from '../.checks/coin-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const folkOf = (r, kind) => r.town.folk.find((f) => f.kind === kind);
/** a run in a given town with no thieves about, for testing one rule at a time */
const quiet = (seed = 3, ix = 0) => { const r = new Run(seed); if (ix) r.enter(ix); r.thieves = []; return r; };

// ---- towns
{
  for (const seed of [1, 7, 42, 99, 2026]) for (let ix = 0; ix < TOWNS.length; ix++) {
    const t = makeTown(seed, ix);
    assert.equal(t.folk.length, 11);
    assert.ok(dist(t.adj, 0).every((d) => d < Infinity), `seed ${seed} town ${ix}: every townsfolk can be reached`);
    assert.equal(t.folk[t.mayor].kind, 'mayor'); assert.ok([5, 6].includes(t.folk[t.mayor].slot), 'the mayor lives in the middle');
    for (const k of TOWNS[ix].specials) assert.equal(t.folk.filter((f) => f.kind === k).length, 1, `one ${k}`);
    for (const k of ['baker', 'woodcutter', 'smith', 'weaver', 'fisher', 'potter']) assert.ok(t.folk.some((f) => f.kind === k), `a ${k}`);
    assert.equal(t.dens.length, TOWNS[ix].thieves); assert.equal(t.thief, TOWNS[ix].thief);
    for (const d of t.dens) assert.ok([0, 3, 8, 11].includes(t.folk[d].slot) && dist(t.adj, t.mayor)[d] >= 2, 'thieves live in far corners');
    for (const f of t.folk) assert.ok(f.x > 30 && f.x < 354 && f.y > 20 && f.y < 180, 'everyone on the screen');
    assert.deepEqual(makeTown(seed, ix), t, 'the same town from the same seed');
  }
  assert.deepEqual(TOWNS.filter((d) => d.thieves).map((d) => d.thief), ['gull', 'magpie', 'grumble'], 'each town has its own thieves; Grumbles only in Grumble Hollow');
  ok('towns: eleven townsfolk all joined up, the mayor in the middle, the right folk, far-off thief dens, repeatable; gulls, magpies and Grumbles by town');
}

// ---- reach
{
  const r = quiet();
  assert.equal(r.holder, r.town.mayor); assert.equal(r.face, 'dora'); assert.equal(r.hour, 0); assert.equal(r.orders.length, ORDERS);
  const d = dist(r.town.adj, r.holder);
  assert.deepEqual(r.targets().sort((a, b) => a - b), r.town.folk.filter((f) => f.id !== r.holder && d[f.id] <= 2).map((f) => f.id), 'Dora-side up: two streets');
  r.face = 'enzo';
  assert.deepEqual(r.targets().sort((a, b) => a - b), [...r.town.adj[r.holder]], 'Enzo-side up: next door');
  r.face = 'dora'; const nb = r.town.adj[r.holder][0]; r.thieves = [nb];
  assert.ok(!r.targets().includes(nb), 'never onto a thief');
  const beyond = r.town.adj[nb].filter((x) => x !== r.holder && dist(r.town.adj, r.holder, [nb])[x] > 2);
  for (const x of beyond) assert.ok(!r.targets().includes(x), 'nor through one');
  r.thieves = []; r.anywhere = true; assert.equal(r.targets().length, 10, 'the Pedlar: anywhere');
  ok('reach: Dora two streets, Enzo next door, the Pedlar anywhere, never onto or through a thief');
}

// ---- spending: orders, moods, hearing, faces
{
  const r = quiet(5);
  const good = r.orders[0].good, seller = r.town.folk.find((f) => isTrade(f.kind) && SELLS[f.kind] === good);
  r.anywhere = true; r.moods[seller.id] = 'fair'; r.known[seller.id] = false;
  let ev = r.pass(seller.id);
  assert.equal(r.holder, seller.id); assert.equal(r.face, 'enzo', 'the coin turns over'); assert.equal(r.hour, 1);
  assert.ok(r.orders[0].done); assert.equal(r.planks, 1); assert.ok(ev.some((e) => e.k === 'order' && e.planks === 1));
  assert.ok(ev.some((e) => e.k === 'hear'), 'Enzo-side up, Enzo overhears');
  for (const id of r.hearing(seller.id)) assert.ok(r.known[id], 'everyone within two streets heard');
  // cheery and grumpy
  const c = quiet(5); const s2 = c.town.folk.find((f) => isTrade(f.kind) && SELLS[f.kind] === c.orders[1].good);
  c.anywhere = true; c.moods[s2.id] = 'cheery'; c.pass(s2.id); assert.equal(c.planks, 2, 'a cheery seller gives two planks');
  const g = quiet(5); const s3 = g.town.folk.find((f) => isTrade(f.kind) && SELLS[f.kind] === g.orders[2].good);
  g.anywhere = true; g.moods[s3.id] = 'grumpy'; ev = g.pass(s3.id);
  assert.equal(g.planks, 0); assert.ok(!g.orders[2].done); assert.ok(ev.some((e) => e.k === 'grumpy'), 'a grumpy one won’t sell');
  // a second visit to a filled order gives nothing
  r.anywhere = true; const p0 = r.planks; r.pass(r.town.adj[seller.id][0]); r.anywhere = true; r.pass(seller.id); assert.equal(r.planks, p0);
  assert.equal(r.pass(r.holder).length, 0, 'the coin can’t be spent on whoever holds it');
  ok('spending: an order makes a plank (two when cheery, none when grumpy), the coin turns over, Enzo overhears');
}

// ---- the specials
{
  const r = quiet(9, 2);
  const at = (k) => { r.anywhere = true; return r.pass(folkOf(r, k).id); };
  let ev = at('gossip'); assert.ok(r.known.every(Boolean), 'the Gossip: the whole town heard'); assert.ok(ev.some((e) => e.k === 'gossip'));
  ev = at('pedlar'); assert.equal(r.anywhere, true, 'the Pedlar: anywhere next');
  ev = at('juggler'); assert.equal(r.face, 'both'); assert.equal(r.reachOf(), 2, 'the Juggler: Dora’s reach');
  r.anywhere = false; const t = r.targets(); assert.ok(t.length >= 1);
  r.anywhere = true; const orders = r.orders.length; ev = at('mayor');
  assert.equal(r.orders.length, orders + 1, 'the Mayor pins another order'); assert.ok(ev.some((e) => e.k === 'mayor'));
  at('pedlar'); at('mayor'); assert.equal(r.orders.length, orders + 1, 'but only once a day');
  r.hour = 0; const h = r.hour, p = r.planks; ev = at('miser');
  assert.equal(r.planks, p + 1, 'the Miser gives a plank'); assert.equal(r.hour, h + 3, 'and keeps the coin two hours longer');
  r.hour = 0; at('pedlar'); const h2 = r.hour; at('miser'); assert.equal(r.planks, p + 1, 'once a day'); assert.equal(r.hour, h2 + 1, 'and no hours lost after that');
  ok('specials: the Gossip tells all, the Pedlar goes anywhere, the Juggler lands both ways, the Mayor adds an order, the Miser gives a plank for two hours');
}

// ---- thieves, waiting, flipping, dusk and dawn
{
  const r = new Run(4); r.enter(1);
  const g0 = r.thieves[0], d0 = dist(r.town.adj, r.holder)[g0];
  r.wait(); assert.equal(dist(r.town.adj, r.holder)[r.thieves[0]], d0 - 1, 'a thief creeps one street nearer each hour');
  assert.equal(r.face, 'enzo', 'waiting turns the coin over'); assert.equal(r.hour, 1);
  // put a thief next door: the next hour it snatches the coin and the day is over
  const s = new Run(4); s.enter(1); s.thieves = [s.town.adj[s.holder][0]];
  assert.ok(s.danger(s.holder)); const ev = s.wait();
  assert.ok(ev.some((e) => e.k === 'snatch')); assert.ok(ev.some((e) => e.k === 'dusk') && ev.some((e) => e.k === 'dawn'));
  assert.equal(s.day, 1); assert.equal(s.hour, 0); assert.equal(s.holder, s.town.mayor); assert.equal(s.stats.snatched, 1);
  assert.deepEqual(s.thieves, s.town.dens, 'thieves go home at dawn');
  // a day runs out of hours
  const q = quiet(6); for (let i = 0; i < HOURS; i++) q.wait();
  assert.equal(q.day, 1); assert.equal(q.face, 'dora', 'each morning starts Dora-side up');
  // the lucky toss
  const l = quiet(6); assert.equal(l.flip().length, 0, 'no flipping without the perk');
  l.perks.lucky = 1; assert.equal(l.flip()[0].face, 'enzo'); assert.equal(l.hour, 0, 'a flip costs no time'); assert.equal(l.flip().length, 0, 'once a day');
  ok('thieves creep and snatch (the rest of the day lost), waiting, the lucky toss, and a new morning');
}

// ---- moods follow who was paid
{
  let fed = 0, fedN = 0, left = 0, leftN = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = quiet(seed); const trades = r.town.folk.filter((f) => isTrade(f.kind));
    r.paid = r.town.folk.map((f, i) => (i % 2 ? 1 : 0)); r.hour = r.hours - 1; r.wait();
    for (const f of trades) { if (f.id % 2) { fedN++; if (r.moods[f.id] === 'cheery') fed++; } else { leftN++; if (r.moods[f.id] === 'cheery') left++; } }
    assert.ok(r.known.every((k, i) => k === !isTrade(r.town.folk[i].kind)), 'each morning, sellers’ moods are unheard again');
  }
  assert.ok(fed / fedN > left / leftN + 0.1, `sellers paid yesterday are cheerier (${(fed / fedN).toFixed(2)} vs ${(left / leftN).toFixed(2)})`);
  ok('moods: sellers visited yesterday wake up cheerier, and every morning they’re unheard again');
}

// ---- bridges, perks, losing
{
  const r = quiet(12);
  r.planks = r.goal - 1; const s = r.town.folk.find((f) => isTrade(f.kind) && SELLS[f.kind] === r.orders[0].good);
  r.anywhere = true; r.moods[s.id] = 'fair'; const ev = r.pass(s.id);
  assert.ok(ev.some((e) => e.k === 'bridge')); assert.equal(r.phase, 'pick'); assert.equal(r.offer.length, 3); assert.equal(r.stats.towns, 1);
  assert.equal(r.pick('nope'), false);
  r.offer = ['planks', 'longday', 'rainy']; r.pick('planks');
  assert.equal(r.ix, 1); assert.equal(r.planks, 1, 'spare planks'); assert.equal(r.phase, 'play');
  r.phase = 'pick'; r.offer = ['longday']; r.pick('longday'); assert.equal(r.hours, HOURS + 1);
  r.phase = 'pick'; r.offer = ['rainy']; r.pick('rainy'); assert.equal(r.days, DAYS + 1); assert.equal(r.ix, 3);
  r.perks.wander = 1; r.face = 'dora'; assert.equal(r.reachOf(), 3);
  r.planks = r.goal - 1; r.thieves = []; const s2 = r.town.folk.find((f) => isTrade(f.kind) && SELLS[f.kind] === r.orders[0].good);
  r.anywhere = true; r.moods[s2.id] = 'fair'; r.pass(s2.id); assert.equal(r.phase, 'won', 'the last bridge wins the run');
  const l = quiet(13); l.day = l.days - 1; for (let i = 0; i < HOURS && l.phase === 'play'; i++) l.wait();
  assert.equal(l.phase, 'lost', 'out of days with no bridge: melted down');
  ok('a bridge built moves on to a perk and the next town; perks; the last bridge wins; running out of days loses');
}
{
  // butter paws: thieves move every other hour
  const r = new Run(4); r.enter(1); r.perks.butter = 1; const g = r.thieves[0];
  r.wait(); assert.equal(r.thieves[0], g, 'slipped on the first hour'); r.wait(); assert.notEqual(r.thieves[0], g, 'moved on the second');
  ok('Butter paws: thieves only move every other hour');
}

// ---- the save
{
  const s = newSave();
  assert.deepEqual(parseSave(serialise(s)), s);
  assert.deepEqual(parseSave('{oops'), newSave()); assert.deepEqual(parseSave(JSON.stringify({ v: 2 })), newSave());
  const odd = parseSave(JSON.stringify({ v: 1, best: { towns: 99, planks: -3 }, seen: ['mayor', 'grumble', 'gull', 'magpie', 'dragon'], settings: { fast: true } }));
  assert.equal(odd.best.towns, TOWNS.length); assert.equal(odd.best.planks, 0); assert.deepEqual(odd.seen, ['mayor', 'grumble', 'gull', 'magpie']); assert.equal(odd.settings.fast, true);
  const r = new Run(3); r.stats.towns = 2; r.stats.planks = 15; r.phase = 'lost';
  bank(s, r); assert.deepEqual(s.best, { towns: 2, planks: 15 }); assert.equal(s.stats.runs, 1); assert.equal(s.stats.planks, 15);
  r.phase = 'won'; r.stats.towns = 4; bank(s, r); assert.equal(s.best.towns, 4); assert.equal(s.stats.wins, 1);
  ok('the save: round trip, corrupt and wrong-version saves ignored, odd values cleaned, runs banked');
}

console.log(`\n${n} Coin of the Realm checks passed`);
