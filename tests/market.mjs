// Night Market's engine: the price and demand model, rumours, the customer generator, tells that follow the hidden
// top price, how every kind of customer haggles, reputation and the regulars, the moon calendar's events, the
// weekly lanterns, saves and corrupt saves, and determinism. Runs against the compiled engine in .checks/.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../.checks/market-game.js';
import { play, stockUp } from './market-bot-policy.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; };
const at = (night, mode = 'moon', seed = 7) => { const s = G.newGame(seed, mode); while (s.night < night) { G.openStall(s); while (G.nextCustomer(s)) G.letGo(s); G.closeStall(s); G.nextDusk(s); } return s; };
const cust = (s, persona, res, value = 10, want = 'cup') => {
  if (!s.stock.some((u) => u.item === want)) s.stock.push({ item: want, paid: 3, front: true, bought: s.night });
  s.phase = 'night';
  const c = { uid: 99, persona, species: G.PERSONAS[persona].species, name: 'Test', want, value, res, tells: G.makeTells(s, persona, res / value, false), round: 0, offer: null, lastAsk: null, regular: persona === 'regular' ? 0 : -1, returning: false };
  s.customer = c; return c;
};

test('the source has no Math.random and no wall clock', () => {
  const src = readFileSync(new URL('../lib/market-game.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(src));
});

test('a new month: purse, stall, calendar and an opening market', () => {
  const s = G.newGame(42);
  assert.equal(s.night, 1); assert.equal(s.nights, 28); assert.equal(s.phase, 'dusk');
  assert.equal(s.purse, G.START_PURSE); assert.equal(s.rep, G.START_REP); assert.equal(s.cart, 8);
  assert.ok(s.market.open.length >= 3 && s.market.open.length <= 4, 'three or four suppliers open');
  assert.ok(s.market.story && s.market.rumour.length > 10);
  assert.equal(G.newGame(5, 'free').nights, 7);
});

test('prices: wholesale under the going rate, shifting with the season', () => {
  let lanternW1 = 0, lanternW4 = 0, teaCostW1 = 0, teaCostW3 = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = G.newGame(seed);
    for (const id of G.ITEM_IDS) { assert.ok(s.market.cost[id] >= 1 && s.market.cost[id] < G.goingRate(s, id) + 1, `${id} costs less than it sells for`); }
    lanternW1 += s.market.demand.lantern; teaCostW1 += s.market.cost.tea;
    const t = at(22, 'moon', seed); lanternW4 += t.market.demand.lantern;
    const u = at(15, 'moon', seed); teaCostW3 += u.market.cost.tea;
  }
  assert.ok(lanternW4 > lanternW1 * 1.25, 'paper lanterns sell better as the festival nears');
  assert.ok(teaCostW1 < teaCostW3, 'new tea is cheaper in harvest week');
});

test('rumours: a tip that a ware will sell raises its demand; a glut lowers its price', () => {
  let sells = 0, gluts = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = G.newGame(seed); const { item, kind } = s.market.tip;
    assert.ok(s.market.rumour.includes(G.ITEMS[item].plural), 'the rumour names the ware');
    if (kind === 'sell') { sells++; assert.ok(s.market.demand[item] >= 1.2, 'a hot tip is real'); assert.ok(s.market.hot.includes(item)); }
    else { gluts++; assert.ok(s.market.cost[item] <= Math.round(G.ITEMS[item].base * 0.62 * 0.8 * 1.1) + 1, 'a glut is cheap'); }
  }
  assert.ok(sells > 20 && gluts > 10, `both kinds of rumour turn up (${sells}/${gluts})`);
});

test('buying, putting back, the cart and the front of the stall', () => {
  const s = G.newGame(3); s.purse = 500;
  const open = s.market.open.flatMap((sp) => G.SUPPLIERS[sp].items);
  const shut = G.ITEM_IDS.find((id) => !open.includes(id));
  if (shut) assert.equal(G.buy(s, shut), false, 'a shut supplier sells nothing');
  const id = open[0], cost = s.market.cost[id];
  assert.ok(G.buy(s, id)); assert.equal(s.purse, 500 - cost); assert.equal(s.stock.length, 1); assert.ok(s.stock[0].front);
  assert.ok(G.unbuy(s, id)); assert.equal(s.purse, 500); assert.equal(s.stock.length, 0);
  while (G.buy(s, open[s.stock.length % open.length])) { /* fill the cart */ }
  assert.equal(s.stock.length, s.cart, 'the cart holds no more than its size');
  assert.ok(G.frontItems(s).length <= G.FRONT_SLOTS);
  const back = [...new Set(s.stock.map((u) => u.item))].find((x) => !G.frontItems(s).includes(x));
  if (back && G.frontItems(s).length === 3) assert.equal(G.setFront(s, back, true), false, 'only three wares at the front');
  G.setFront(s, G.frontItems(s)[0], false); if (back) assert.ok(G.setFront(s, back, true));
  assert.ok(G.setLanterns(s, 9)); assert.equal(s.lanterns, 3);
});

test('the crowd grows with lanterns and reputation, and lanterns burn oil', () => {
  const s = G.newGame(11); const base = G.crowd(s);
  G.setLanterns(s, 2); assert.equal(G.crowd(s), base + 2);
  s.rep = 90; assert.ok(G.crowd(s) > base + 2);
  const purse = s.purse; G.openStall(s); assert.equal(s.purse, purse - 2 * G.OIL); assert.equal(s.tonight.oil, 2 * G.OIL);
});

test('the customer generator: kinds, wants from the stall, and misses for wares not stocked', () => {
  const kinds = new Set(); let customers = 0, misses = 0, settles = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = G.newGame(seed); s.purse = 200; stockUp(G, s); G.setLanterns(s, 3); G.openStall(s);
    for (let c = G.nextCustomer(s); c; c = G.nextCustomer(s)) {
      customers++; kinds.add(c.persona);
      assert.equal(c.species, G.PERSONAS[c.persona].species);
      assert.ok(s.stock.some((u) => u.item === c.want), 'they want something on the stall');
      assert.equal(c.value, G.goingRate(s, c.want));
      assert.ok(c.res > 0.5 * c.value && c.res < 2.6 * c.value);
      if (c.persona === 'regular') assert.equal(c.name, G.REGULARS[c.regular]);
      G.letGo(s);
    }
    misses += s.tonight.missed; settles += 0;
  }
  for (const k of ['thrifty', 'impulsive', 'collector', 'hurry', 'regular']) assert.ok(kinds.has(k), `${k} customers come`);
  assert.ok(customers > 150 && misses > 0, `customers come (${customers}) and some miss what they wanted (${misses})`);
});

test('tells follow the hidden top price, and reading them beats guessing', () => {
  const s = G.newGame(9); let errRead = 0, errFlat = 0, n2 = 0;
  const xs = [], ys = [];
  for (let i = 0; i < 3000; i++) {
    const persona = G.PERSONA_IDS[i % G.PERSONA_IDS.length];
    const ratio = 0.65 + ((i * 7919) % 1000) / 1000;
    const t = G.makeTells(s, persona, ratio, false);
    const est = G.readTells(t, persona);
    xs.push(est); ys.push(ratio);
    errRead += Math.abs(est - ratio); errFlat += Math.abs(1 - ratio); n2++;
  }
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const mx = mean(xs), my = mean(ys);
  const cov = xs.reduce((p, x, i) => p + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((p, x) => p + (x - mx) ** 2, 0), vy = ys.reduce((p, y) => p + (y - my) ** 2, 0);
  const r = cov / Math.sqrt(vx * vy);
  assert.ok(r > 0.6, `the tells correlate with the hidden price (r=${r.toFixed(2)})`);
  assert.ok(errRead < errFlat * 0.75, 'reading the tells beats assuming the going rate');
  // the kinds skew their tells in learnable ways
  let leanBackThrifty = 0, leanBackImp = 0, flickHurry = 0, gazeHurry = 0;
  for (let i = 0; i < 400; i++) {
    if (G.makeTells(s, 'thrifty', 1.1, false).posture === 'lean-back') leanBackThrifty++;
    if (G.makeTells(s, 'impulsive', 1.1, false).posture === 'lean-back') leanBackImp++;
    const h = G.makeTells(s, 'hurry', 0.9, false); if (h.tail === 'flick') flickHurry++; if (h.gaze === 1) gazeHurry++;
  }
  assert.ok(leanBackThrifty > leanBackImp * 3, 'badgers hide their interest');
  assert.equal(flickHurry, 400, 'a rabbit in a hurry always flicks its tail'); assert.equal(gazeHurry, 400, 'and never looks long');
  const ret = G.makeTells(s, 'collector', 1.2, true); assert.equal(ret.returning, true);
  assert.ok(G.readTells({ ...ret, returning: true }, 'collector') > G.readTells({ ...ret, returning: false }, 'collector'), 'coming back is a tell');
});

test('haggling: the impulsive tanuki pays a little over at once, but waits for one counter only', () => {
  let s = G.newGame(1); cust(s, 'impulsive', 10.5);
  let r = G.ask(s, 11); assert.equal(r.kind, 'sold', 'a touch over the top price, at once'); assert.equal(r.price, 11);
  s = G.newGame(1); cust(s, 'impulsive', 10);
  r = G.ask(s, 12); assert.equal(r.kind, 'counter'); assert.ok(r.offer < 10);
  r = G.ask(s, 12); assert.equal(r.kind, 'walk');
  s = G.newGame(1); cust(s, 'impulsive', 10); assert.equal(G.ask(s, 14).kind, 'walk', 'too greedy and they walk at once');
});

test('haggling: the thrifty badger always haggles once, then pays a fair price', () => {
  const s = G.newGame(1); cust(s, 'thrifty', 10);
  let r = G.ask(s, 9); assert.equal(r.kind, 'counter', 'even a fair price gets a counter'); assert.equal(r.offer, 8);
  r = G.ask(s, 9); assert.equal(r.kind, 'sold'); assert.equal(r.price, 9);
  const t = G.newGame(1); cust(t, 'thrifty', 10);
  assert.equal(G.ask(t, 7).kind, 'sold', 'a low price sells at once');
  const u = G.newGame(1); cust(u, 'thrifty', 10);
  const offers = []; for (let i = 0; i < 3; i++) { const q = G.ask(u, 13); offers.push(q.offer); }
  assert.ok(offers[0] < offers[1] && offers[1] < offers[2], 'badger counters creep up'); assert.equal(G.ask(u, 13).kind, 'walk', 'three counters, then gone');
});

test('haggling: the collector crane, the hurried rabbit, the regular otter and the poet', () => {
  let s = G.newGame(1); cust(s, 'collector', 30, 26, 'pearl');
  let r = G.ask(s, 34); assert.equal(r.kind, 'counter'); assert.ok(G.takeOffer(s).kind === 'sold');
  s = G.newGame(1); cust(s, 'collector', 30, 26, 'pearl'); G.ask(s, 34); G.ask(s, 34); assert.equal(G.ask(s, 34).kind, 'walk', 'two counters');
  s = G.newGame(1); cust(s, 'hurry', 10); r = G.ask(s, 11); assert.equal(r.kind, 'counter'); assert.equal(G.ask(s, 11).kind, 'walk', 'one counter, then off');
  s = G.newGame(1); cust(s, 'hurry', 10); assert.equal(G.ask(s, 13).kind, 'walk', 'no patience for a big ask');
  s = G.newGame(1); cust(s, 'regular', 10); for (let i = 0; i < 3; i++) assert.equal(G.ask(s, 12).kind, 'counter', 'regulars are patient');
  s = G.newGame(1); cust(s, 'poet', 10); s.purse = 0; r = G.ask(s, 9);
  assert.equal(r.kind, 'sold'); assert.ok(r.verse); assert.equal(r.coins, 6); assert.equal(r.tip, 4); assert.equal(s.purse, 10, 'part in verses, plus a tip for a fair price');
  s = G.newGame(1); cust(s, 'poet', 10); r = G.ask(s, 10); assert.equal(r.tip, 0, 'no tip when pushed');
  for (const p of G.PERSONA_IDS) { const t = G.newGame(2); cust(t, p, 10); const q = G.ask(t, 100); assert.equal(q.kind, 'walk', `${p} walks from an outrageous ask`); }
});

test('reputation: fair deals build it, walk-outs cost it; regulars remember', () => {
  let s = G.newGame(1); cust(s, 'impulsive', 10); let rep = s.rep; G.ask(s, 8); assert.equal(s.rep, rep + 1, 'a fair deal');
  s = G.newGame(1); cust(s, 'hurry', 10); rep = s.rep; G.ask(s, 30); assert.equal(s.rep, rep - 2, 'a walk-out');
  s = G.newGame(1); cust(s, 'regular', 10); rep = s.rep; G.ask(s, 8); assert.equal(s.rep, rep + 2); assert.equal(s.friends[0], 1, 'a regular warms to you');
  s = G.newGame(1); cust(s, 'regular', 10); rep = s.rep; G.ask(s, 10); assert.equal(s.rep, rep - 2, 'squeezing a regular sours them'); assert.equal(s.friends[0], -1);
  // a warmer regular comes keener
  let warm = 0, cold = 0;
  for (let seed = 1; seed <= 200; seed++) for (const f of [5, -3]) {
    const t = G.newGame(seed); t.stock.push({ item: 'cup', paid: 3, front: true, bought: 1 }); t.friends = [f, f, f]; G.openStall(t); t.queue = 30;
    for (let c = G.nextCustomer(t); c; c = G.nextCustomer(t)) { if (c.persona === 'regular') { if (f > 0) warm += c.res / c.value; else cold += c.res / c.value; break; } G.letGo(t); }
  }
  assert.ok(warm > cold * 1.2, 'friends pay more');
});

test('a matching set at the front sells together', () => {
  const s = G.newGame(1); s.stock = [{ item: 'teapot', paid: 9, front: true, bought: 1 }, { item: 'cup', paid: 4, front: true, bought: 1 }];
  s.phase = 'night'; const c = cust(s, 'collector', 20, 16, 'teapot');
  const r = G.ask(s, 15); assert.equal(r.kind, 'sold'); assert.ok(r.set && r.set.item === 'cup', 'the cup goes with the teapot'); void c;
  assert.equal(s.stock.length, 0); assert.equal(s.week.sets, 1);
  const t = G.newGame(1); t.stock = [{ item: 'teapot', paid: 9, front: true, bought: 1 }, { item: 'cup', paid: 4, front: false, bought: 1 }];
  cust(t, 'collector', 20, 16, 'teapot'); assert.equal(G.ask(t, 15).set, null, 'only from the front');
});

test('walking away and coming back, keener', () => {
  let back = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = G.newGame(seed); s.stock = [{ item: 'cup', paid: 3, front: true, bought: 1 }]; G.openStall(s); s.queue = 4;
    const c = G.nextCustomer(s); if (!c || c.persona === 'hurry' || c.res < c.value) continue;
    const res = c.res; const r = G.ask(s, 200); assert.equal(r.kind, 'walk');
    if (!r.back) continue;
    for (let d = G.nextCustomer(s); d; d = G.nextCustomer(s)) { if (d.uid === c.uid) { back++; assert.ok(d.returning && d.tells.returning); assert.ok(d.res > res); break; } G.letGo(s); }
  }
  assert.ok(back > 5, `customers come back (${back})`);
});

test('the moon calendar: rain, poets, the tax heron, the rival fox and the festival', () => {
  const rain = at(5); assert.equal(rain.market.event, 'rain'); assert.ok(rain.market.demand.scarf > 1.3);
  const dry = at(4); rain.rep = 70; rain.lanterns = 3; assert.ok(G.crowd(rain) < G.crowd({ ...dry, rep: 70, wordOfMouth: rain.wordOfMouth, lanterns: 3 }), 'rain keeps folk at home');
  const poets = at(12); assert.equal(poets.market.event, 'poets'); poets.purse = 300; stockUp(G, poets); G.setLanterns(poets, 3); G.openStall(poets);
  let p = 0; for (let c = G.nextCustomer(poets); c; c = G.nextCustomer(poets)) { if (c.persona === 'poet') p++; G.letGo(poets); } assert.ok(p > 0, 'poets come on poets’ night');
  const tax = at(19); tax.purse = 200; tax.rep = 30; G.openStall(tax); assert.equal(tax.tonight.tax, 20);
  const tax2 = at(19); tax2.purse = 200; tax2.rep = 70; G.openStall(tax2); assert.equal(tax2.tonight.tax, 10, 'halved for good standing');
  assert.equal(at(7).market.rival, null); assert.ok(at(8).market.rival); assert.ok(at(21).market.rival); assert.equal(at(22).market.rival, null);
  assert.equal(at(8).cart, 10); assert.equal(at(22).cart, 12);
  const fest = at(28); assert.equal(fest.market.event, 'festival'); assert.ok(fest.market.demand.lantern > 1.8);
  for (const nt of [1, 8, 19, 22, 28]) assert.ok(at(nt).market.story, `a story beat on night ${nt}`);
});

test('weeks: lanterns for profit and the request; the month ends at the festival', () => {
  const s = play(G, 4242, 'reader');
  assert.equal(s.phase, 'end'); assert.equal(s.night, 28); assert.equal(s.weeks.length, 4);
  for (const w of s.weeks) assert.ok(w.lanterns >= 0 && w.lanterns <= 3);
  const w0 = s.weeks[0]; const [a, b] = G.WEEK_GOALS[0];
  assert.equal(w0.lanterns, (w0.profit >= a ? 1 : 0) + (w0.profit >= b ? 1 : 0) + (w0.request ? 1 : 0));
  assert.equal(s.boat, s.purse >= G.BOAT);
  const f = play(G, 77, 'reader', 'free'); assert.equal(f.phase, 'end'); assert.equal(f.weeks.length, 1); assert.equal(f.boat, false);
});

test('saves: a month in progress survives a round trip; corrupt saves are ignored, never misread', () => {
  const s = G.newGame(8); stockUp(G, s); G.openStall(s); G.nextCustomer(s);
  const save = G.blankSave(); save.run = s; save.best.lanterns = 7; save.settings.music = false;
  const back = G.readSave(JSON.stringify(save));
  assert.deepEqual(back.run, JSON.parse(JSON.stringify(s))); assert.equal(back.best.lanterns, 7); assert.equal(back.settings.music, false);
  for (const raw of [null, '', '{', 'null', '[]', '42', '{"v":2}', JSON.stringify({ v: 1, run: 'x', best: 'y', settings: 3 })]) {
    const r = G.readSave(raw); assert.equal(r.run, null); assert.equal(r.best.lanterns, 0); assert.equal(r.settings.sound, true);
  }
  const bad = (f) => { const o = JSON.parse(JSON.stringify(save)); f(o.run); return G.readSave(JSON.stringify(o)); };
  for (const f of [(r) => { r.night = 99; }, (r) => { r.purse = 'lots'; }, (r) => { r.stock.push({ item: 'gold' }); }, (r) => { r.market.cost.cup = -1; }, (r) => { r.customer.tells.ears = 'huge'; }, (r) => { r.friends = [1]; }, (r) => { r.phase = 'party'; }, (r) => { r.rep = 1e9; }]) {
    const r = bad(f); assert.equal(r.run, null, 'a damaged month is dropped'); assert.equal(r.best.lanterns, 7, 'but the best results are kept');
  }
  const ended = play(G, 5, 'reader'); const sv = G.blankSave(); G.recordEnd(sv, ended);
  assert.equal(sv.best.lanterns, G.totalLanterns(ended)); assert.equal(sv.best.months, 1);
});

test('determinism: a seed replays a month exactly', () => {
  const a = JSON.stringify(play(G, 1234, 'reader')), b = JSON.stringify(play(G, 1234, 'reader'));
  assert.equal(a, b);
  assert.notEqual(a, JSON.stringify(play(G, 1235, 'reader')));
  assert.equal(JSON.stringify(play(G, 99, 'reader', 'free')), JSON.stringify(play(G, 99, 'reader', 'free')));
});

console.log(`market: ${n} tests passed`);
