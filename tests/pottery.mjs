// Kiln & Clay engine checks: the clay (never made or lost, centring first, opening, pushing in and out, raising the
// walls, the wheel's speed, drying and water, trimming), collapses (walls pulled too thin, too tall, flared too far,
// a fast wheel under a wide pot) and the lump that comes back, replays, scoring a throw, glazing (dips, bands,
// stripes, rims, feet, speckles and drips, and the wishes), the kiln, stars and pay, the week (days, upgrades,
// glazes, tips) and saving, corrupt saves included.
import assert from 'node:assert/strict';
import {
  Wheel, SHAPES, ORDERS, ORDER, ORDER_IDS, DAYS, DAY_COUNT, FINALE, CUSTOMERS, CUSTOMER_IDS, GLAZES, GLAZE_IDS, UPGRADES, UPGRADE_IDS, HANDLE_IDS,
  DT, MIN_FLOOR, SPEEDS, PROFILE_N, shapeR, shapeClay, clayFor, scoreProfile, scoreThrow, replay, freshGlaze, dip, paintBand, glazeAt, scoreGlaze,
  Firing, FIRE_TIME, rng, hashSeed, finalStars, payFor, partsStars, SAVE_KEY, freshSave, readSave, readProfile, packProfile, dayOrders, dayDone,
  orderOpen, nextDay, deliver, buy, has, kilnSize, freeOpen, glazeOpen, upgradeOpen, keepInGallery, starCount, GALLERY_MAX, MAX_BANDS,
} from '../.checks/pottery-game.js';
import { throwShape, glazeFor, fire, steady } from './pottery-bot.mjs';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, tol, msg) => { assert.ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`); checks++; };
const steps = (w, n) => { for (let i = 0; i < n; i++) w.step(); };
/** A centred lump of a given amount of clay. */
const centred = (clay = 60, opts = {}) => { const w = new Wheel(clay, opts); w.press(w.maxR + 0.3, 1); while (w.centred < 1) w.step(); w.release(); w.step(); w.events.length = 0; return w; };
/** A centred lump, opened down to the floor. */
const opened = (clay = 60, opts = {}) => { const w = centred(clay, opts); w.press(0, w.top + 0.3); for (let i = 1; i <= 40; i++) { w.move(0.8, w.top + 0.3 - (w.top - 0.45) * (i / 40)); w.step(); } steps(w, 30); w.release(); w.step(); w.events.length = 0; return w; };

// ---- the content
{
  eq(DAYS.length, 7, 'seven days');
  eq(DAY_COUNT, 7, 'the day count');
  for (let d = 1; d <= 7; d++) ok(dayOrders(d).length >= 3 && dayOrders(d).length <= 4, `three or four orders on day ${d}`);
  eq(ORDERS.length, 21, 'twenty-one orders');
  eq(new Set(ORDER_IDS).size, ORDERS.length, 'order ids are unique');
  eq(ORDERS[ORDERS.length - 1].id, FINALE, 'the teapot is the last order');
  eq(ORDER[FINALE].parts.map((p) => p.id).sort(), ['body', 'lid', 'spout'], 'the teapot is a body, a spout and a lid');
  ok(ORDER[FINALE].handle, 'and a handle');
  eq(CUSTOMER_IDS.length, 7, 'seven neighbours');
  for (const c of CUSTOMER_IDS) ok(ORDERS.some((o) => o.who === c), `${CUSTOMERS[c].name} orders something`);
  for (const o of ORDERS) {
    eq(o.thanks.length, 3, `${o.id}: thanks for three, two and one stars`);
    ok(o.parts[0].id === 'body', `${o.id}: the body comes first`);
    for (const p of o.parts) ok(p.shape.h > 0 && p.shape.pts.length >= 2 && p.shape.pts[0][0] === 0 && p.shape.pts[p.shape.pts.length - 1][0] === 1, `${o.id}: ${p.id} outline spans its height`);
    // every wished-for glaze family can be painted with the glazes open on that day (no shop glazes needed)
    const fams = [o.glaze.all, o.glaze.rim, o.glaze.foot, o.glaze.drip, o.glaze.stripes?.fam].filter(Boolean);
    for (const f of fams) ok(GLAZE_IDS.some((g) => GLAZES[g].fam === f && !GLAZES[g].shop && GLAZES[g].day <= o.day), `${o.id}: a ${f} glaze is open on day ${o.day}`);
  }
  ok(ORDERS.some((o) => o.parts.some((p) => p.id === 'lid')) && ORDERS.some((o) => o.handle) && ORDERS.some((o) => o.glaze.drip) && ORDERS.some((o) => o.glaze.speckle), 'lids, handles, drips and speckles all turn up');
  eq(HANDLE_IDS.length, 4, 'four handles to pick from');
  eq(UPGRADE_IDS.length, 5, 'five upgrades');
  ok(GLAZE_IDS.length >= 6 && GLAZE_IDS.length <= 10, 'six to ten glazes');
}

// ---- the lump and centring
{
  const w = new Wheel(60);
  near(w.clayLeft, 60, 1e-9, 'a lump holds the clay it was given');
  eq(w.centred, 0, 'a fresh lump is off-centre');
  const before = w.fingerprint();
  w.press(w.maxR - 0.5, 1.5); steps(w, 20);
  eq(w.rings.map((r) => r.R.toFixed(6)), new Wheel(60).rings.map((r) => r.R.toFixed(6)), 'pressing an off-centre lump only centres it');
  ok(w.centred > 0 && w.centred < 1, 'centring takes a moment');
  steps(w, 200);
  eq(w.centred, 1, 'held long enough, it runs true');
  ok(before !== w.fingerprint(), 'centring shows in the fingerprint');
  const stopped = new Wheel(60); stopped.setSpeed(0); stopped.press(stopped.maxR, 1); steps(stopped, 120);
  eq(stopped.centred, 0, 'a stopped wheel does nothing');
}

// ---- opening, pushing in, pulling out, raising
{
  const w = opened();
  ok(w.opened, 'pressing down into the middle opens the lump');
  ok(w.floor >= MIN_FLOOR - 1e-9 && w.floor < 1.2, `the floor is left at a sensible thickness (${w.floor.toFixed(2)})`);
  near(w.clayLeft, 60, 1e-6, 'opening moves clay, it doesn’t make or lose any');
  // pull out from inside
  const y2 = w.top * 0.5, a = w.at(y2);
  ok(a.Ri > 0.3, 'the middle is hollow');
  w.setSpeed(2); w.press(a.Ri - 0.2, y2); w.move(a.Ri + 2.5, y2); steps(w, 30); w.release(); w.step();
  ok(w.radiusAt(y2) > a.R + 0.5, 'a finger inside pushes the wall out');
  const b = w.at(y2); ok(b.R - b.Ri < a.R - a.Ri, 'and the wall gets thinner as it swells');
  // push in from outside near the top: narrower there, not far below
  const y = w.top * 0.85, R0 = w.radiusAt(y), foot0 = w.radiusAt(0.1);
  w.press(R0 + 0.5, y); w.move(R0 - 1, y); steps(w, 30); w.release(); w.step();
  ok(w.radiusAt(w.top * 0.85) < R0 - 0.5, 'a finger outside pushes the wall in');
  near(w.radiusAt(0.1), foot0, 0.05, 'the foot, well below the finger, is untouched');
  near(w.clayLeft, 60, 1e-6, 'pushing moves clay, it doesn’t make or lose any');
  // raise: a finger sliding up the outside of the wall
  const top0 = w.top, t0 = Math.max(...w.walls());
  let fy = w.floor + 0.2; w.press(w.radiusAt(fy) + 0.05, fy);
  while (fy < w.top) { fy += 5 * DT; w.move(w.radiusAt(Math.min(fy, w.top)) - 0.02, fy); w.step(); }
  w.release(); w.step();
  ok(w.top > top0 + 0.3, `sliding up the wall raises it (${top0.toFixed(2)} to ${w.top.toFixed(2)})`);
  ok(Math.max(...w.walls()) < t0, 'and thins it');
  near(w.clayLeft, 60, 1e-6, 'raising moves clay, it doesn’t make or lose any');
  // speed: the same touch does more on a faster wheel
  const pushAt = (speed) => { const v = opened(); v.setSpeed(speed); const yy = v.top * 0.6, r = v.radiusAt(yy); v.press(r + 0.5, yy); v.move(r - 1.5, yy); steps(v, 6); return r - v.radiusAt(yy); };
  ok(pushAt(3) > pushAt(1) * 1.3, 'a fast wheel shapes quicker than a slow one');
  eq(SPEEDS[0], 0, 'speed 0 stops the wheel');
}

// ---- water and drying
{
  const w = opened(); const wet0 = w.wet;
  const y = w.top * 0.5, r = w.radiusAt(y); w.press(r + 0.3, y); w.move(r, y); steps(w, 600); w.release();
  ok(w.wet < wet0 - 0.1, 'the clay dries while you work it');
  const dry = w.wet; w.water(); near(w.wet, dry + 0.2, 1e-9, 'a dab of water wets it again');
  for (let i = 0; i < 10; i++) w.water();
  eq(w.wet, 1, 'never wetter than soaking');
  const s0 = opened(); s0.step(); const before = s0.measure(); s0.wet = 0.95; ok(s0.measure() > before * 1.2, 'over-wet clay is floppier');
  const sp = opened(60, { sponge: true }), pl = opened(60);
  for (const v of [sp, pl]) { const yy = v.top * 0.5, rr = v.radiusAt(yy); v.press(rr + 0.3, yy); v.move(rr, yy); steps(v, 600); }
  ok(sp.wet > pl.wet, 'the big sponge keeps the clay wet longer');
}

// ---- trimming
{
  const w = opened(), h0 = w.top, c0 = w.clayLeft;
  ok(!w.trim(w.floor + 0.2), 'can’t trim into the floor');
  ok(w.trim(h0 - 0.8), 'trims the rim level');
  near(w.top, h0 - 0.8, 1e-6, 'at the height asked');
  ok(w.clayLeft < c0, 'the trimmed clay is lifted away');
  const lump = centred(); ok(!lump.trim(1), 'an unopened lump can’t be trimmed');
}

// ---- collapses
{
  // walls pulled too thin: pull a cup's rim far out from inside
  const w = opened(40); w.setSpeed(3);
  let fl = false;
  for (let k = 0; k < 6 && !fl; k++) {
    const y = w.top - 0.3, a = w.at(y);
    w.press(a.Ri - 0.2, y); w.move(9, y);
    for (let i = 0; i < 90 && !fl; i++) { w.step(); fl = w.events.some((e) => e.k === 'flump'); }
    w.release(); w.step();
  }
  ok(fl, 'walls pulled too thin collapse');
  eq(w.flumps, 1, 'one flump counted');
  ok(w.slump >= 0 && !w.finger, 'the finger lets go as it slumps');
  ok(w.slumped && w.slumped.h > 0, 'the collapsed shape is kept for the slump');
  const c = w.clayLeft;
  steps(w, 70);
  eq(w.slump, -1, 'a moment later the clay is a lump again');
  near(w.clayLeft, c, 1e-6, 'with all its clay');
  ok(!w.opened && w.centred < 1, 'off-centre and unopened: start again');
  // too tall for its walls: keep raising a narrow pot
  const t = opened(70); t.setSpeed(2); let tall = false;
  for (let k = 0; k < 40 && !tall; k++) {
    let fy = t.floor + 0.15; t.press(t.radiusAt(fy) + 0.05, fy);
    while (fy < t.top + 0.2 && !tall) { fy += 5 * DT; t.move(t.radiusAt(Math.min(fy, t.top)) - 0.02, fy); t.step(); tall = t.flumps > 0; }
    t.release(); t.step();
  }
  ok(tall, 'a pot raised too tall and thin collapses');
  // a fast wheel under a wide pot strains it more than a slow one
  const wide = throwShape(SHAPES.pieDish).w; wide.setSpeed(1); const slow = wide.measure(); wide.setSpeed(3); const fast = wide.measure();
  ok(fast > slow * 1.25, `a fast wheel flings a wide dish (${slow.toFixed(2)} slow, ${fast.toFixed(2)} fast)`);
  const quiet = throwShape(SHAPES.pieDish); ok(quiet.w.strain < 1, 'the dish stands');
  const qw = new Wheel(60, { quiet: true }); ok(qw.sigma < new Wheel(60).sigma, 'the quiet wheel’s touch is finer');
}

// ---- replays
{
  const r = throwShape(SHAPES.honeyPot), last = r.h.inputs[r.h.inputs.length - 1].f;
  const a = replay(clayFor(SHAPES.honeyPot), r.h.inputs, {}, r.h.f - 1 - last), b = replay(clayFor(SHAPES.honeyPot), r.h.inputs, {}, r.h.f - 1 - last);
  eq(a.fingerprint(), r.w.fingerprint(), 'replaying the samples throws the same pot');
  eq(a.fingerprint(), b.fingerprint(), 'every time');
  const moved = r.h.inputs.map((e) => (e.k === 'move' ? { ...e, x: e.x + 0.3 } : e));
  ok(replay(clayFor(SHAPES.honeyPot), moved, {}, r.h.f - 1 - last).fingerprint() !== a.fingerprint(), 'different samples, a different pot');
}

// ---- scoring a throw
{
  const s = SHAPES.mug;
  const perfect = { h: s.h, r: [], ri: [], floor: 0.7 };
  for (let k = 0; k < PROFILE_N; k++) { const y = (k / (PROFILE_N - 1)) * s.h * 0.99999, R = shapeR(s, y); perfect.r.push(R); perfect.ri.push(y > 0.7 ? R - 0.45 : 0); }
  const p = scoreProfile(perfect, s, true);
  eq(p.stars, 3, 'the outline itself scores three stars'); ok(p.err < 0.02 && p.match > 0.98, 'with almost no error');
  eq(scoreProfile(perfect, s, false).stars, 0, 'but not if it was never opened');
  const thick = { ...perfect, ri: perfect.ri.map((r, i) => (r > 0 ? perfect.r[i] - 1.8 : 0)) };
  eq(scoreProfile(thick, s, true).stars, 2, 'heavy walls lose a star');
  const deep = { ...perfect, floor: 2.4 }; eq(scoreProfile(deep, s, true).stars, 2, 'a thick floor loses a star');
  const short = { ...perfect, h: s.h * 0.6 }; ok(scoreProfile(short, s, true).stars < 3, 'too short loses stars');
  ok(scoreProfile(short, s, true).notes.some((n) => /shorter/.test(n)), 'and says so');
  const lump = new Wheel(clayFor(s)); eq(scoreThrow(lump, s).stars, 0, 'a lump of clay is not a mug');
  ok(clayFor(s) > shapeClay(s), 'the lump has clay to spare');
  near(shapeR(s, s.h / 2), 3.2, 0.01, 'outlines are read between their points');
  eq(shapeR(s, s.h + 1), 0, 'and are nothing above the top');
  eq(partsStars([{ stars: 3 }, { stars: 3 }, { stars: 2 }]), 2, 'a set of parts scores its average, rounded down');
}

// ---- glazing
{
  const gl = freshGlaze();
  eq(glazeAt(gl, 0.5), null, 'bare clay to start');
  dip(gl, 'cream'); eq(glazeAt(gl, 0.5), 'cream', 'a dip coats it all');
  paintBand(gl, 'sky', 0.9, 1); eq(glazeAt(gl, 0.97), 'sky', 'a band paints over the coat');
  const thin = paintBand(gl, 'moss', 0.5, 0.505); ok(thin.u1 - thin.u0 >= 0.04, 'a tap makes a thin stripe, not nothing');
  dip(gl, 'honey'); eq(gl.bands.length, 0, 'dipping again covers the bands');
  for (let i = 0; i < MAX_BANDS + 5; i++) paintBand(gl, 'rose', 0.1, 0.2);
  eq(gl.bands.length, MAX_BANDS, 'bands are capped');
  const o = ORDER.o3, good = glazeFor(o);
  eq(scoreGlaze(good, o.glaze).score, 1, 'cream with a blue rim meets the dough bowl’s wishes');
  const noRim = freshGlaze(); dip(noRim, 'cream'); eq(scoreGlaze(noRim, o.glaze).score, 0.5, 'without the rim, half');
  const s2 = freshGlaze(); dip(s2, 'cream'); paintBand(s2, 'moss', 0.3, 0.36);
  eq(scoreGlaze(s2, ORDER.o2.glaze).wishes[1].got, 0.5, 'one stripe of two is half a wish');
  paintBand(s2, 'moss', 0.6, 0.66); eq(scoreGlaze(s2, ORDER.o2.glaze).score, 1, 'two green stripes on cream');
  paintBand(s2, 'moss', 0.62, 0.7); eq(scoreGlaze(s2, ORDER.o2.glaze).score, 1, 'overlapping bands count as one stripe');
  const any = freshGlaze(); dip(any, 'cobalt'); eq(scoreGlaze(any, { all: 'blue' }).score, 1, 'any glaze of the family will do');
  const sp = freshGlaze(); dip(sp, 'cream'); eq(scoreGlaze(sp, ORDER.o8.glaze).score, 0.5, 'speckles are a wish of their own'); sp.speckle = true; eq(scoreGlaze(sp, ORDER.o8.glaze).score, 1, 'speckled');
  const dr = freshGlaze(); dip(dr, 'sky'); dr.drip = 'honey'; eq(scoreGlaze(dr, ORDER.o11.glaze).wishes[1].got, 0.5, 'drips of the wrong colour, half'); dr.drip = 'cream'; eq(scoreGlaze(dr, ORDER.o11.glaze).score, 1, 'cream drips on blue');
  const ft = freshGlaze(); dip(ft, 'moss'); paintBand(ft, 'honey', 0, 0.08); eq(scoreGlaze(ft, ORDER.o9.glaze).score, 1, 'a honey foot');
  for (const ord of ORDERS) eq(scoreGlaze(glazeFor(ord), ord.glaze).score, 1, `${ord.id}: its wishes can all be met`);
}

// ---- the kiln
{
  const a = fire(7, steady), b = fire(7, steady);
  eq(a, b, 'the same seed and the same hand fire the same');
  eq(a.finish, 'shine', 'a steady hand shines');
  eq(fire(7, () => false).finish, 'dull', 'a cold kiln fires dull');
  ok(fire(7, () => true).cracked, 'an overheated kiln cracks the pot');
  const k = new Firing(3); let t = 0; while (!k.done) { k.step(); t += DT; }
  near(t, FIRE_TIME, DT * 1.5, 'a firing lasts its time');
  const big = new Firing(3, true), small = new Firing(3); ok(big.hi - big.lo > small.hi - small.lo, 'the big kiln’s sweet band is wider');
  const r1 = rng(5), r2 = rng(5); eq([r1(), r1(), r1()], [r2(), r2(), r2()], 'seeded flicker');
  ok(hashSeed('o1') !== hashSeed('o2'), 'each order its own flicker');
}

// ---- stars and pay
{
  eq(finalStars(3, 1, { quality: 1, finish: 'shine', cracked: false }), 3, 'a good throw, glaze and firing: three stars');
  eq(finalStars(3, 0.4, { quality: 1, finish: 'shine', cracked: false }), 2, 'glaze wishes mostly missed: a star off');
  eq(finalStars(3, 1, { quality: 0.7, finish: 'good', cracked: true }), 2, 'a crack: a star off, still sellable');
  eq(finalStars(3, 0, { quality: 0, finish: 'dull', cracked: true }), 1, 'never more than two off');
  eq(finalStars(1, 0, { quality: 0, finish: 'dull', cracked: true }), 1, 'and never below one');
  ok(payFor(3, 'shine') > payFor(3, 'good') && payFor(3, 'good') > payFor(1, 'good'), 'more stars and a shine pay more');
  ok(payFor(3, 'shine', true) < payFor(1, 'dull'), 'a repeat order pays a thank-you');
}

// ---- the week
{
  const s = freshSave();
  eq(s.day, 1, 'day one');
  ok(orderOpen(s, 'o1') && !orderOpen(s, 'o4'), 'only today’s orders are open');
  ok(!freeOpen(s), 'the free throw waits for the first delivery');
  ok(glazeOpen(s, 'honey') && !glazeOpen(s, 'rose') && !glazeOpen(s, 'plum'), 'glazes open with the days and the shop');
  eq(nextDay(s).ok, false, 'the day doesn’t end with orders waiting');
  const piece = (id, stars = 3, fin = 'shine') => ({ order: id, parts: ORDER[id].parts.map((p) => ({ id: p.id, prof: throwShape(p.shape).w.profile(), stars })), handle: ORDER[id].handle ? 'ear' : null, glaze: glazeFor(ORDER[id]), throwStars: stars, fire: { quality: 1, finish: fin, cracked: false } });
  const d1 = deliver(s, piece('o1'));
  eq(d1.stars, 3, 'delivered at three stars'); ok(d1.first && d1.pay === payFor(3, 'shine'), 'paid in full');
  eq(s.acorns, d1.pay, 'acorns in the jar');
  ok(freeOpen(s), 'the free throw opens');
  const again = deliver(s, piece('o1', 2, 'good'));
  eq(s.done.o1, 3, 'a worse repeat doesn’t lower the best');
  eq(again.pay, payFor(2, 'good', true), 'a repeat pays a thank-you');
  deliver(s, piece('o2')); deliver(s, piece('o3'));
  ok(dayDone(s, 1), 'day one done');
  ok(!buy(s, 'kiln'), 'the big kiln isn’t for sale yet');
  s.acorns = 500;
  ok(buy(s, 'sponge') && has(s, 'sponge'), 'buys the big sponge');
  ok(!buy(s, 'sponge'), 'only once');
  const n = nextDay(s); ok(n.ok && s.day === 2, 'on to day two'); eq(n.tips, 0, 'no shelf, no tips');
  ok(upgradeOpen(s, 'quiet') && buy(s, 'glazes') && glazeOpen(s, 'plum'), 'the shop’s glazes, once bought');
  for (const id of ['o4', 'o5', 'o6']) deliver(s, piece(id));
  s.acorns = 500; nextDay(s); ok(buy(s, 'shelf') && buy(s, 'kiln'), 'day three: the shelf and the big kiln');
  eq(kilnSize(s), 2, 'two pots at once');
  ok(keepInGallery(s, piece('o1'), 'Blackberry bowl'), 'a pot kept in the gallery');
  for (const id of ['o7', 'o8', 'o9']) deliver(s, piece(id));
  const before = s.acorns, t = nextDay(s);
  eq(t.tips, 1, 'the display shelf earns a tip for each gallery pot'); eq(s.acorns, before + 1, 'paid in');
  eq(starCount(s), 27, 'nine orders at three stars');
  for (let i = 0; i < GALLERY_MAX + 3; i++) keepInGallery(s, piece('o2'), 'Cup ' + i);
  eq(s.gallery.length, GALLERY_MAX, 'the gallery holds a dozen');
}

// ---- saving
{
  eq(SAVE_KEY, 'kiln-clay-v1', 'the save key');
  eq(readSave(null), freshSave(), 'no save: a fresh one');
  for (const bad of ['', 'nope', '[]', '{"v":2}', '{"v":1,"acorns":"lots","day":"x","done":7,"gallery":{}}', 'null', '{"v":1,"settings":7,"upgrades":["moon",5]}']) {
    const s = readSave(bad); eq(s.acorns, 0, `corrupt save ${bad}: no acorns`); eq(s.day, 1, `corrupt save ${bad}: day one`); eq(s.upgrades, [], `corrupt save ${bad}: no upgrades`);
  }
  const s = freshSave();
  s.acorns = 42; s.done = { o1: 3, o2: 2, o3: 1 }; s.day = 2; s.upgrades = ['sponge']; s.settings.ghost = false; s.seen = ['o2'];
  const prof = packProfile(throwShape(SHAPES.cup).w.profile());
  s.gallery.push({ name: 'Cup', parts: [{ id: 'body', prof }], handle: 'loop', glaze: glazeFor(ORDER.o2), finish: 'shine', cracked: false, lip: false });
  s.rack.push({ order: 'o4', parts: [{ id: 'body', prof, stars: 3 }], handle: 'ear', glaze: glazeFor(ORDER.o4), throwStars: 3, fire: null });
  const back = readSave(JSON.stringify(s));
  eq(back, s, 'a save reads back the same');
  // damage: days ahead of the orders, unknown ids, broken profiles and glazes
  const raw = JSON.parse(JSON.stringify(s));
  raw.day = 6; raw.done.o99 = 3; raw.done.o5 = 7; raw.upgrades.push('moon', 'sponge');
  raw.gallery.push({ name: 5, parts: [{ id: 'body', prof: { h: 4, r: [1, 2], ri: [0, 0], floor: 0 } }] });
  raw.gallery.push({ name: 'Odd', parts: [{ id: 'body', prof }], glaze: { base: 'gold', bands: [{ u0: 0.5, u1: 0.2, g: 'sky' }, { u0: 0.1, u1: 0.3, g: 'sky' }, 'x'], speckle: 'yes' }, handle: 'trunk', finish: 'sparkly' });
  raw.rack.push({ order: 'o21', parts: [{ id: 'body', prof, stars: 3 }], throwStars: 3 });
  const d = readSave(JSON.stringify(raw));
  eq(d.day, 2, 'the day can’t be ahead of the orders delivered');
  eq(d.done, { o1: 3, o2: 2, o3: 1 }, 'unknown orders and impossible stars are dropped');
  eq(d.upgrades, ['sponge'], 'unknown upgrades dropped, no doubles');
  eq(d.gallery.length, 2, 'a pot with a broken profile is dropped');
  eq(d.gallery[1].glaze, { base: null, bands: [{ u0: 0.1, u1: 0.3, g: 'sky' }], speckle: false, drip: null }, 'only the good bands of a damaged glaze are kept');
  eq([d.gallery[1].handle, d.gallery[1].finish], [null, 'good'], 'unknown handles and finishes fall back');
  eq(d.rack.length, 1, 'a rack pot for an order that isn’t open yet is dropped');
  ok(readProfile({ h: 3, r: Array(PROFILE_N).fill(2), ri: Array(PROFILE_N).fill(5), floor: 1 }).ri.every((r) => r < 2), 'an inside wider than the outside is mended');
  eq(readProfile({ h: 3, r: Array(PROFILE_N).fill('a'), ri: Array(PROFILE_N).fill(0), floor: 1 }), null, 'a profile of nonsense is dropped');
  const ended = freshSave(); ended.ended = true; eq(readSave(JSON.stringify(ended)).ended, false, 'the ending needs the teapot delivered');
}

console.log(`pottery engine: ${checks} checks passed`);
