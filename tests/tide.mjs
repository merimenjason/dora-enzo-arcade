// Tidepool's engine: every creature's rules (anemones catch food, mussels filter it, limpets and periwinkles graze
// the rocks' algae, shrimp nibble and flee into the weed, the blenny hunts shrimp, starfish eat mussels, hermit crabs
// scavenge and swap into bigger shells, seaweed grows in the light), the food web, the tide clock, warmth, light and
// oxygen through a tide, the plank and the bucket, gulls and shooing, population bounds (no runaway booms or sudden
// collapses), the journal's sketches and pages, seasons and the spring tide, saves (corrupt ones included) and exact
// replay from a seed.
// Needs the engine compiled to .checks/ (npm run test:tide does that).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TideGame, TIDE, POOL, PAGES, INFO, SPECIES, KINDS, LINKS, SEASONS, ENERGY_MAX, BUCKET_COST, PLANK, TO_TURN,
  levelAt, waterY, floorY, weatherFor, readSave, freshSave, SAVE_KEY, linkKey,
} from '../.checks/tide-game.js';
import { caretaker, playOut } from './tide-bot-policy.mjs';

let n = 0;
const ok = (name) => { n++; console.log('PASS', name); };
const run = (g, steps, each) => { for (let i = 0; i < steps; i++) { if (each) each(g, i); g.step(); } return g; };
const evs = (g) => g.events.splice(0);
const toLow = (g) => { while (g.connected) g.step(); };
const toHigh = (g) => { while (!g.connected) g.step(); };
const nextLow = (g) => { toHigh(g); toLow(g); };
const only = (g, keep) => { g.agents = g.agents.filter(keep); };

// ---- the rules stay deterministic and clock-free
{
  const src = readFileSync(new URL('../lib/tide-game.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date\.now|performance\.now|new Date/.test(src), 'no Math.random or wall clock in the engine');
  assert.equal(SAVE_KEY, 'tidepool-v1');
  assert.equal(PAGES.length, 24); assert.deepEqual([0, 1, 2, 3].map((s) => PAGES.filter((p) => p.season === s).length), [6, 6, 6, 6]);
  assert.ok(PAGES.every((p, i) => p.id === i + 1));
  ok('the engine has no Math.random or clock, and 24 pages, six a season');
}

// ---- the tide clock
{
  const lv = Array.from({ length: TIDE }, (_, i) => levelAt(i));
  assert.ok(Math.abs(levelAt(0) - levelAt(TIDE)) < 1e-9, 'the tide repeats every tide');
  assert.ok(Math.max(...lv) > 0.99 && Math.min(...lv) < 0.01, 'from high water to low water');
  const high = lv.filter((v) => v > 0.5).length; assert.ok(Math.abs(high - TIDE / 2) <= 2, 'the sea covers the pool half of each tide');
  assert.equal(waterY(0), POOL.low); assert.equal(waterY(1), POOL.high);
  const g = new TideGame();
  assert.ok(!g.connected && g.level > 0.2, 'a new pool starts with the tide just out, so the sea is back within the first half-minute');
  const seen = []; run(g, TIDE * 2, () => { for (const e of g.events) if (e.k === 'tide' || e.k === 'peak') seen.push(e.k === 'tide' ? (e.high ? 'flood' : 'ebb') : 'peak'); g.events.length = 0; });
  assert.deepEqual(seen, ['flood', 'peak', 'ebb', 'flood', 'peak', 'ebb']);
  assert.equal(g.tideNo, 2, 'two high waters in two tides');
  ok('the tide clock: in and out, half the time over the rim, a new tide at each high water');
}

// ---- warmth, light and the air in the water
{
  const g = new TideGame({ kind: 'free', season: 1 }, 3);
  toLow(g); const t0 = g.temp, o0 = g.o2;
  run(g, 250);
  assert.ok(g.temp > t0 + 3, `the cut-off pool warms in the summer sun (${t0.toFixed(1)} → ${g.temp.toFixed(1)})`);
  assert.ok(g.o2 < o0 - 5, `and its air runs down (${o0.toFixed(0)} → ${g.o2.toFixed(0)})`);
  toHigh(g); run(g, 120);
  assert.ok(g.temp < SEASONS[1].sea + 2.5 && g.o2 > 90, 'the high tide brings cool water and fresh air back');
  // shade: the plank keeps a hot pool cooler; the bucket cools it and gives air back
  const a = new TideGame({ kind: 'free', season: 1 }, 4), b = new TideGame({ kind: 'free', season: 1 }, 4);
  toLow(a); toLow(b); assert.ok(b.act({ t: 'plank' }), 'the plank goes down at low tide');
  run(a, 250); run(b, 250);
  assert.ok(b.temp < a.temp - 1.5, `the plank shades the pool (${a.temp.toFixed(1)} vs ${b.temp.toFixed(1)})`);
  a.o2 = 40; const before = a.o2, warm = a.temp, e0 = a.energy;
  assert.ok(a.act({ t: 'bucket' }));
  assert.ok(a.o2 > before + 20 && a.temp < warm - 1 && a.energy === e0 - BUCKET_COST, 'a bucket of seawater: air back, cooler, costs energy');
  a.energy = 0; assert.ok(!a.act({ t: 'bucket' }) && /energy/.test(a.why), 'no energy, no bucket');
  toHigh(b); assert.ok(!b.plank, 'the rising tide lifts the plank away');
  assert.ok(!b.act({ t: 'plank' }) && /low tide/.test(b.why), 'and it cannot go down at high tide');
  assert.ok(!b.act({ t: 'bucket' }), 'no bucket while the sea fills the pool');
  ok('low tide warms the pool and uses up its air; the plank shades; the bucket refreshes; high tide resets');
}

// ---- seaweed grows in light, and makes air
{
  const lit = new TideGame({ kind: 'free', season: 1 }, 5), dim = new TideGame({ kind: 'free', season: 3 }, 5);
  for (const g of [lit, dim]) { g.weeds = [{ id: 900, x: 60, size: 0.2, planted: true }]; }
  run(lit, 600); run(dim, 600);
  assert.ok(lit.weeds[0].size > dim.weeds[0].size + 0.1, `more light, faster growth (${lit.weeds[0].size.toFixed(2)} vs ${dim.weeds[0].size.toFixed(2)})`);
  const bare = new TideGame({ kind: 'free', season: 1 }, 6), lush = new TideGame({ kind: 'free', season: 1 }, 6);
  bare.weeds = []; lush.weeds = [40, 52, 64, 88, 100, 112].map((x, i) => ({ id: 800 + i, x, size: 1, planted: true }));
  toLow(bare); toLow(lush); bare.o2 = lush.o2 = 55; run(bare, 280); run(lush, 280);
  assert.ok(lush.o2 > bare.o2 + 8, `seaweed keeps the air up at low tide (${bare.o2.toFixed(0)} vs ${lush.o2.toFixed(0)})`);
  ok('seaweed grows faster in brighter seasons and breathes out air');
}

// ---- each creature's rules
{
  // anemones catch drifting food, more at high tide
  const g = new TideGame({ kind: 'free', season: 0 }, 7); only(g, (a) => a.sp === 'anemone');
  for (const a of g.agents) a.e = 0.3;
  run(g, 900);
  assert.ok(g.ss.catchesHigh > 0 && g.links.includes(linkKey('anemone', 'plankton')), 'anemones catch plankton at high tide');
  const avg = g.agents.reduce((t, a) => t + a.e, 0) / g.agents.length; assert.ok(avg > 0.3, `and are fed by it (${avg.toFixed(2)})`);
}
{
  // mussels filter the water
  const a = new TideGame({ kind: 'free', season: 2 }, 8), b = new TideGame({ kind: 'free', season: 2 }, 8);
  only(a, () => false); only(b, (x) => x.sp === 'mussel');
  for (let i = 0; i < 6; i++) b.act({ t: 'bring', sp: 'mussel', x: 50 + i * 10, y: 70 }) || (b.basket.mussel = 1, b.act({ t: 'bring', sp: 'mussel', x: 50 + i * 10, y: 70 }));
  toLow(a); toLow(b); run(a, 200); run(b, 200);
  assert.ok(b.food < a.food - 1, `a mussel bed clears the water (${a.food.toFixed(1)} vs ${b.food.toFixed(1)})`);
}
{
  // limpets graze the algae off their rock and move on when it is bare
  const g = new TideGame({ kind: 'free', season: 0 }, 9); only(g, (a) => a.sp === 'limpet');
  const L = g.agents[0], rock = g.rocks.find((r) => r.id === L.rock);
  rock.a = 0.5; g.agents = [L]; for (let i = 0; i < 3; i++) { g.basket.limpet = 1; g.act({ t: 'bring', sp: 'limpet', x: rock.x, y: rock.y }); }
  const a0 = rock.a; let moved = false;
  run(g, 1600, () => { if (g.agents.some((a) => a.st === 'walk')) moved = true; });
  assert.ok(rock.a < a0 || moved, 'limpets graze the rock');
  assert.ok(moved, 'and wander off to a greener rock when theirs is bare');
}
{
  // a periwinkle leaves its shell behind
  const g = new TideGame({ kind: 'free', season: 0 }, 10);
  const p = g.agents.find((a) => a.sp === 'periwinkle'); p.hp = 0.0001; p.e = 0;
  const shells = g.shells.length; run(g, 3);
  assert.ok(g.shells.length === shells + 1 && g.shells.at(-1).size < 0.6, 'a dead periwinkle leaves a small shell');
  ok('anemones catch food, mussels filter, grazers graze and move on, periwinkles leave shells');
}
{
  // the blenny hunts exposed shrimp; shrimp near seaweed dart into it and escape
  const open = new TideGame({ kind: 'free', season: 0 }, 11);
  open.weeds = []; only(open, (a) => a.sp === 'shrimp');
  open.act({ t: 'bring', sp: 'blenny', x: 80, y: 70 }); const bl = open.agents.find((a) => a.sp === 'blenny'); bl.e = 0.3;
  const s0 = open.count('shrimp'); run(open, 1500);
  assert.ok(open.links.includes(linkKey('blenny', 'shrimp')) && open.stats.eaten > 0, 'with nowhere to hide, the blenny catches shrimp'); void s0;
  const weedy = new TideGame({ kind: 'free', season: 0 }, 11);
  weedy.weeds = [36, 48, 60, 72, 84, 96, 108, 120].map((x, i) => ({ id: 700 + i, x, size: 1, planted: true })); only(weedy, (a) => a.sp === 'shrimp');
  weedy.act({ t: 'bring', sp: 'blenny', x: 80, y: 70 }); weedy.agents.find((a) => a.sp === 'blenny').e = 0.3;
  let hid = 0; run(weedy, 1500, () => { for (const e of weedy.events) if (e.k === 'hide') hid++; weedy.events.length = 0; });
  assert.ok(hid > 0 && weedy.ss.escapes > 0, 'shrimp escape into the seaweed');
  assert.ok(weedy.count('shrimp') >= open.count('shrimp'), `a weed bed keeps more shrimp alive (${open.count('shrimp')} vs ${weedy.count('shrimp')})`);
  ok('the blenny hunts shrimp; shrimp hide in the seaweed and escape');
}
{
  // starfish eat mussels, slowly
  const g = new TideGame({ kind: 'free', season: 2 }, 12); only(g, (a) => a.sp === 'mussel');
  g.act({ t: 'bring', sp: 'starfish', x: 100, y: 75 }); g.agents.find((a) => a.sp === 'starfish').e = 0.3;
  const m0 = g.count('mussel'); let ate = false;
  run(g, 2400, () => { for (const e of g.events) if (e.k === 'eat' && e.who === 'starfish') ate = true; g.events.length = 0; });
  assert.ok(ate && g.count('mussel') < m0, 'a hungry starfish eats a mussel');
  ok('starfish eat mussels');
}
{
  // hermit crabs scavenge, grow, get cramped and swap into a bigger shell
  const g = new TideGame({ kind: 'story' }, 13);
  assert.ok(g.act({ t: 'bring', sp: 'hermit', x: 80, y: 75 }));
  const h = g.agents.find((a) => a.sp === 'hermit'); h.size = h.shell; h.e = 0.9;
  run(g, 30);
  assert.ok(h.size > h.shell - 0.02, 'it has outgrown its shell');
  assert.equal(g.basket.shell, 1, 'bringing it in finished a page, which gives a spare shell'); g.basket.shell = 0;
  assert.ok(!g.act({ t: 'shell', x: h.x + 3 }) && /No shells/.test(g.why), 'no shell in the basket');
  g.basket.shell = 1; assert.ok(g.act({ t: 'shell', x: h.x + 3 }));
  const old = h.shell; let swapped = false;
  run(g, 400, () => { for (const e of g.events) if (e.k === 'swap' && e.bigger) swapped = true; });
  assert.ok(swapped && h.shell > old, 'it swaps into the bigger shell');
  assert.ok(g.shells.some((s) => Math.abs(s.size - old) < 1e-9), 'and leaves the old one behind');
  assert.ok(g.done[2] && g.done[2].shells === 3, 'the page for bringing it in is done');
  const s = new TideGame({ kind: 'story' }, 14); s.agents = []; s.act({ t: 'bring', sp: 'hermit', x: 80, y: 75 });
  s.scraps = [{ id: 999, x: 90, y: floorY(90) - 0.5, amt: 0.6 }]; const hc = s.agents.find((a) => a.sp === 'hermit'); hc.e = 0.3;
  run(s, 600); assert.ok(hc.e > 0.3 && s.links.includes(linkKey('hermit', 'scraps')), 'hermit crabs eat scraps');
  ok('hermit crabs scavenge, outgrow their shells and swap');
}

// ---- gulls at low tide; shooing; hiding under the plank
{
  const g = new TideGame({ kind: 'free', season: 1 }, 15);
  nextLow(g); run(g, 3);
  assert.ok(g.gulls.length === SEASONS[1].gulls, 'gulls come at low tide');
  run(g, 120, () => { for (const q of g.gulls) if (q.st === 'eye') g.act({ t: 'shoo', x: q.x, y: q.y }); });
  assert.ok(g.stats.shoos >= 1 && g.count('shrimp') > 0, 'shooing sends them off');
  const h = new TideGame({ kind: 'free', season: 1 }, 15); only(h, (a) => a.sp === 'shrimp'); h.weeds = [];
  let grabs = 0; nextLow(h); run(h, 300, () => { for (const e of h.events) if (e.k === 'gull' && e.st === 'grab') grabs++; h.events.length = 0; });
  assert.ok(grabs > 0, 'a gull left alone takes a shrimp');
  const p = new TideGame({ kind: 'free', season: 1 }, 15); only(p, (a) => a.sp === 'shrimp'); p.weeds = [];
  nextLow(p); p.act({ t: 'plank' });
  for (const a of p.agents) { a.x = 80; a.tx = 80; }
  let grabbed = 0; run(p, 300, () => { for (const a of p.agents) { a.x = Math.max(PLANK.x0 + 4, Math.min(PLANK.x1 - 4, a.x)); } for (const e of p.events) if (e.k === 'gull' && e.st === 'grab') grabbed++; p.events.length = 0; });
  assert.equal(grabbed, 0, 'creatures under the plank are hidden from gulls');
  ok('gulls come at low tide, take what they can see, and are shooed; the plank hides creatures');
}

// ---- the player's nudges are checked
{
  const g = new TideGame({ kind: 'story' }, 16);
  assert.ok(g.act({ t: 'rock', x: 90 }) && g.rocks.at(-1).placed, 'a rock from the basket');
  assert.ok(!g.act({ t: 'rock', x: 90 }), 'the basket is out of rocks');
  g.basket.rock = 5; assert.ok(!g.act({ t: 'rock', x: 92 }) && /close/.test(g.why), 'rocks need room');
  assert.ok(g.act({ t: 'plant', x: 40 }), 'plant a seedling'); assert.ok(!g.act({ t: 'plant', x: 42 }) && /close/.test(g.why), 'seaweed needs room');
  const w = g.weeds.find((q) => q.size > 0.5); const s0 = w.size;
  assert.ok(g.act({ t: 'trim', x: w.x, y: floorY(w.x) - 5 }) && w.size < s0, 'trim a seaweed');
  assert.ok(!g.act({ t: 'trim', x: 130, y: 50 }), 'nothing to trim there');
  assert.ok(!g.act({ t: 'plank' }) && /no plank/.test(g.why), 'the plank comes in summer');
  assert.ok(!g.act({ t: 'bring', sp: 'starfish', x: 80, y: 70 }), 'only what is in the basket');
  g.basket.shrimp = 9; let k = 0; while (g.act({ t: 'bring', sp: 'shrimp', x: 60, y: 60 })) k++;
  assert.equal(g.count('shrimp'), INFO.shrimp.cap, 'never more than the pool holds');
  ok('rocks, planting, trimming, the basket and the limits are all checked');
}

// ---- looking and sketching
{
  const g = new TideGame({ kind: 'story' }, 17);
  const an = g.agents.filter((a) => a.sp === 'anemone');
  assert.ok(g.act({ t: 'look', x: an[0].x, y: an[0].y })); assert.equal(g.sketch.anemone, 1);
  g.act({ t: 'look', x: an[0].x, y: an[0].y }); assert.equal(g.sketch.anemone, 1, 'the same one straight away adds nothing');
  g.act({ t: 'look', x: an[1].x, y: an[1].y }); assert.equal(g.sketch.anemone, 2, 'another one does');
  run(g, 30); g.act({ t: 'look', x: an[0].x, y: an[0].y }); assert.equal(g.sketch.anemone, 3, 'or the same one a moment later');
  assert.ok(!g.act({ t: 'look', x: 150, y: 10 }), 'nothing to look at in the sky');
  const sh = g.agents.find((a) => a.sp === 'shrimp'), li = g.agents.find((a) => a.sp === 'limpet');
  g.act({ t: 'look', x: sh.x, y: sh.y }); g.act({ t: 'look', x: li.x, y: li.y }); run(g, 5);
  assert.ok(g.done[1], 'three kinds looked at: the first page');
  ok('looking fills in sketches; the first page');
}

// ---- weather and the seasons
{
  assert.equal(weatherFor(1, 2), 'heat'); assert.equal(weatherFor(1, 3), 'heat'); assert.equal(weatherFor(1, 8), 'heat');
  assert.equal(weatherFor(2, 1), 'bloom'); assert.equal(weatherFor(3, 3), 'storm'); assert.equal(weatherFor(0, 3), 'calm');
  const g = new TideGame({ kind: 'story' }, 18);
  assert.ok(!g.act({ t: 'season' }) && !g.canTurn(), `a season turns after ${TO_TURN} pages`);
  for (const id of [1, 2, 3, 4]) g.finishPage(id);
  assert.ok(g.act({ t: 'season' }) && g.season === 1 && g.tools.includes('plank') && g.tools.includes('bucket'), 'summer brings the plank and bucket');
  for (const id of [7, 8, 9, 10]) g.finishPage(id); g.act({ t: 'season' });
  assert.ok(g.season === 2 && g.basket.starfish === 1, 'late summer brings the starfish');
  for (const id of [13, 14, 15, 16]) g.finishPage(id); g.act({ t: 'season' });
  assert.equal(g.season, 3); assert.ok(!g.canTurn(), 'autumn is the last season');
  assert.ok(!g.act({ t: 'release' }));
  for (const id of [19, 20, 21, 22]) g.finishPage(id);
  assert.ok(g.canRelease() && g.act({ t: 'release' }));
  assert.ok(!g.act({ t: 'rock', x: 60 }), 'no nudging while the spring tide carries everyone out');
  let end = false; run(g, 900, () => { for (const e of g.events) if (e.k === 'ending') end = true; g.events.length = 0; });
  assert.ok(end && g.ended && g.agents.length === 0 && g.done[24], 'the spring tide releases everyone and ends the story');
  ok('weather comes round each season; seasons turn after four pages; the spring tide ends it');
}
{
  // a storm surge sweeps away the unsheltered
  const g = new TideGame({ kind: 'free', season: 3 }, 19); g.weeds = []; g.rocks = g.rocks.filter((r) => r.r < 7);
  for (let i = 0; i < 6; i++) { g.basket.shrimp = 1; g.act({ t: 'bring', sp: 'shrimp', x: 40 + i * 12, y: 55 }); }
  const before = g.count('shrimp'); let storm = false;
  run(g, TIDE * 5, () => { for (const e of g.events) if (e.k === 'storm') storm = true; g.events.length = 0; });
  assert.ok(storm, 'the autumn storm comes'); assert.ok(g.stats.deaths > 0, 'and sweeps some away');
  void before;
  ok('the storm surge');
}

// ---- population bounds: no runaway booms, no sudden collapses in a calm, cared-for pool
{
  for (const season of [0, 1, 2]) {
    const g = new TideGame({ kind: 'free', season }, 30 + season);
    let prev = null;
    playOut(g, caretaker, 16, (q) => {
      for (const sp of SPECIES) assert.ok(q.count(sp) <= INFO[sp].cap, `${sp} never above its cap`);
      const now = Object.fromEntries(SPECIES.map((sp) => [sp, q.count(sp)]));
      if (prev && q.weather !== 'storm') for (const sp of SPECIES) assert.ok(!(prev[sp] >= 3 && now[sp] === 0), `${sp} does not vanish from ${prev[sp]} in one tide (${SEASONS[season].name})`);
      prev = now;
      assert.ok(q.o2 >= 0 && q.o2 <= 100 && q.food >= 0 && q.food <= 100 && Number.isFinite(q.temp));
    });
  }
  ok('populations stay within their caps and never crash to nothing in a single calm tide');
}

// ---- determinism and saves
{
  const a = new TideGame({ kind: 'story' }, 42), b = new TideGame({ kind: 'story' }, 42);
  playOut(a, caretaker, 6); playOut(b, caretaker, 6);
  assert.deepEqual(a.snapshot(), b.snapshot(), 'the same seed and the same nudges replay exactly');
  const c = new TideGame({ kind: 'story' }, 43); playOut(c, caretaker, 6);
  assert.notDeepEqual(c.snapshot().agents, a.snapshot().agents, 'a different seed is a different pool');
  // a save picks up exactly where it left off
  const snap = JSON.parse(JSON.stringify(a.snapshot())), d = TideGame.load(snap);
  assert.ok(d); run(a, 900); run(d, 900);
  assert.deepEqual(d.snapshot(), a.snapshot(), 'a loaded pool carries on exactly the same');
  ok('exact replay from a seed; saves resume exactly');
}
{
  assert.deepEqual(readSave(null), freshSave());
  for (const bad of ['', 'nope', '{', '[]', '7', 'null', '{"v":2}', JSON.stringify({ v: 1, run: { v: 1 } }), JSON.stringify({ v: 1, settings: 'x', run: 5, best: 'lots', ended: 'yes' })]) {
    const s = readSave(bad);
    assert.equal(s.run, null); assert.equal(s.ended, false); assert.equal(s.best, 0); assert.deepEqual(s.settings, freshSave().settings);
  }
  const g = new TideGame(); run(g, 50);
  const good = { v: 1, settings: { sound: false, music: true, hints: true }, run: g.snapshot(), free: null, ended: true, best: 40 };
  const s = readSave(JSON.stringify(good));
  assert.ok(s.run && s.ended && s.best === 40 && s.settings.sound === false, 'a good save reads back');
  const broken = (f) => { const o = JSON.parse(JSON.stringify(good)); f(o.run); return readSave(JSON.stringify(o)).run; };
  assert.equal(broken((r) => { r.agents[0].sp = 'kraken'; }), null, 'an unknown creature');
  assert.equal(broken((r) => { r.temp = 'hot'; }), null, 'a temperature that is not a number');
  assert.equal(broken((r) => { r.rocks = []; }), null, 'no rocks');
  assert.equal(broken((r) => { r.season = 9; }), null, 'a season that does not exist');
  assert.equal(broken((r) => { r.basket.shell = -2; }), null, 'a negative basket');
  assert.equal(broken((r) => { r.mode = { kind: 'free', season: 'x' }; }), null, 'a broken mode');
  assert.equal(TideGame.load(null), null); assert.equal(TideGame.load('x'), null);
  ok('corrupt saves are ignored, never misread; good ones read back');
}

// ---- the journal knows every kind and the web is complete
{
  assert.equal(KINDS.length, 11); for (const k of KINDS) assert.ok(INFO[k] && INFO[k].name && INFO[k].note);
  for (const [a, b] of LINKS) assert.ok(KINDS.includes(a) && (KINDS.includes(b) || ['plankton', 'algae', 'scraps'].includes(b)));
  const g = playOut(new TideGame({ kind: 'story' }, 5), caretaker, 30);
  assert.ok(g.links.length >= 9, `a cared-for pool shows most of the food web (${g.links.length} of ${LINKS.length})`);
  assert.ok(g.energy <= ENERGY_MAX);
  ok('the field guide and the food web');
}
console.log(`\n${n} groups passed`);
