// Kiln & Clay bot: a careful potter throws every part of every order through the same pointer samples a player
// makes (press, move, release, water, speed, trim), shaping towards the customer's outline the way a person would:
// centre, open, raise the walls a few times, then sweep up the pot pushing in or out, trim the rim and deepen the
// floor. Every part must reach three stars without a collapse, and (without --quick) replaying its samples into a
// fresh wheel must throw exactly the same pot. A lazy lump (no shaping) and a lump that is only opened must score
// one star or fail; a hasty potter (one quick sweep, no trim) must average clearly fewer stars than the careful one,
// so the star lines are set from real throws. Then the glazes and the kiln: a planner meets every glaze wish, a
// steady hand on the bellows gets a shine, and leaving the kiln alone, or holding the bellows the whole time, does
// not. Finally the whole week is played through the save: every order delivered at three stars, the ending reached,
// and enough acorns along the way to buy every upgrade.
import assert from 'node:assert/strict';
import {
  Wheel, ORDERS, SHAPES, clayFor, shapeR, scoreThrow, replay, DT, freshGlaze, dip, paintBand, scoreGlaze, GLAZE_IDS, GLAZES, Firing,
  FIRE_TIME, hashSeed, freshSave, deliver, nextDay, buy, UPGRADES, UPGRADE_IDS, DAY_COUNT, dayOrders, glazeOpen, partsStars, shapeMaxR,
} from '../.checks/pottery-game.js';

const quick = process.argv.includes('--quick');
const verbose = process.argv.includes('-v');
const only = process.argv.find((a) => /^o\d+$/.test(a));

/** Records inputs as it plays them into a live wheel, stepping the wheel one frame at a time. */
export class Hand {
  constructor(w) { this.w = w; this.f = 0; this.inputs = []; }
  send(k, x, y, v) { const e = { f: this.f, k }; if (x !== undefined) e.x = +x.toFixed(3); if (y !== undefined) e.y = +y.toFixed(3); if (v !== undefined) e.v = v; this.inputs.push(e); this.w.apply(e); }
  wait(n) { for (let i = 0; i < n; i++) { this.w.step(); this.w.events.length = 0; this.f++; } }
}

/** Throws a shape the careful way (or, with hasty, one quick sweep and no trim). */
export function throwShape(shape, { hasty = false, speed } = {}) {
  const wide = shapeMaxR(shape) > 5.5;
  const w = new Wheel(clayFor(shape), { solid: !shape.hollow }), h = new Hand(w), Ht = shape.h;
  h.send('speed', undefined, undefined, speed ?? (wide ? 1 : 2));
  // centre: hold a finger on the side of the lump
  h.send('down', w.maxR + 0.3, 1.2);
  while (w.centred < 1) h.wait(1);
  h.wait(2); h.send('up'); h.wait(2);
  const push = (y, want, hold) => { const { R } = w.at(Math.min(y, w.top - 0.01)); h.send('down', R + 0.6, y); h.send('move', want, y); h.wait(hold); h.send('up'); h.wait(1); };
  const pull = (y, want, hold) => { const { R, Ri } = w.at(Math.min(y, w.top - 0.01)), A = R * R - Ri * Ri; h.send('down', Math.max(0.3, Ri - 0.3), y); h.send('move', Math.sqrt(Math.max(0.1, want * want - A)), y); h.wait(hold); h.send('up'); h.wait(1); };
  const trim = () => { if (w.top > Ht + 0.05) { h.send('trim', 0, Ht); h.wait(2); } };
  if (!shape.hollow) {
    // a lid: press down on the middle to squash it low and wide, then push the top in to raise the knob
    const wantMax = shapeMaxR(shape); let g = 0;
    h.send('down', 0, w.top + 0.2);
    while (w.maxR < wantMax * 1.03 && w.top > 0.95 && g++ < 900) { h.send('move', 0, w.top - 0.4); h.wait(1); }
    h.send('up'); h.wait(2);
    for (let s = 0; s < (hasty ? 1 : 4); s++) {
      for (let y = 0.1; y <= Math.min(w.top, Ht) + 0.01; y += hasty ? 0.4 : 0.2) { const want = shapeR(shape, Math.min(y, Ht)); if (w.at(Math.min(y, w.top - 0.01)).R - want > 0.06) push(y, want, hasty ? 5 : 10); }
      if (!hasty) trim();
    }
    h.wait(10);
    return { w, h, score: scoreThrow(w, shape) };
  }
  // open: press into the middle of the top and down to the floor
  h.send('down', 0, w.top + 0.3);
  for (let i = 1; i <= 40; i++) { h.send('move', 0.8, w.top + 0.3 - (w.top + 0.3 - 0.75) * (i / 40)); h.wait(1); }
  h.wait(30); h.send('up'); h.wait(2);
  // widen the hollow until the walls are about a centimetre and a half thick
  for (let y = w.floor + 0.2; y <= w.top; y += 0.3) { const { R, Ri } = w.at(y); if (Ri > 0.2 && R - 1.4 > Ri + 0.05) { h.send('down', Math.max(0.3, Ri - 0.3), y); h.send('move', R - 1.4, y); h.wait(10); h.send('up'); h.wait(1); } }
  // raise the walls: a finger on the outside of the wall slides from the bottom to the top
  const lift = () => {
    let y = w.floor + 0.15; h.send('down', w.radiusAt(y) + 0.05, y);
    while (y < w.top + 0.2) { y += 5 * DT; h.send('move', w.radiusAt(Math.min(y, w.top)) - 0.02, y); h.wait(1); if (w.slump >= 0) break; }
    h.send('up'); h.wait(2);
  };
  for (let g = 0; g < 30 && w.top < Ht * (hasty ? 1 : 1.12); g++) { if (Math.min(...w.walls()) < 0.42) break; lift(); }
  // shape: sweep up the pot, pushing in or pulling out each height towards the outline
  const sweep = (hold, step) => {
    for (let y = w.floor + 0.15; y <= Math.min(w.top, Ht) + 0.01; y += step) {
      const want = shapeR(shape, Math.min(y, Ht)), { R, Ri } = w.at(Math.min(y, w.top - 0.01));
      if (R - want > 0.06) push(y, want, hold);
      else if (w.strain > 0.85) h.send('speed', undefined, undefined, 1);
      else if (want - R > 0.06 && Ri > 0.2) pull(y, want, hold);
      if (w.slump >= 0) return;
    }
  };
  if (hasty) { sweep(6, 0.5); h.wait(10); return { w, h, score: scoreThrow(w, shape) }; }
  for (let s = 0; s < 4 && w.slump < 0; s++) sweep(10, 0.25);
  trim();
  // deepen the floor again if squeezing the foot pushed it up
  if (w.floor > 1.0) { const y = w.floor + 0.3, { Ri } = w.at(y), x = Math.max(0.3, Ri - 0.2); h.send('down', x, y); for (let i = 1; i <= 30; i++) { h.send('move', x, y - ((y - 0.75) * i) / 30); h.wait(1); } h.wait(30); h.send('up'); h.wait(2); }
  sweep(12, 0.25); trim(); sweep(12, 0.25);
  // a dab of water if it has dried out, as a player would
  if (w.wet < 0.3) { h.send('water'); h.wait(2); }
  h.wait(10);
  return { w, h, score: scoreThrow(w, shape) };
}

/** Paints a glaze that meets every wish of an order with the glazes open on its day. */
export function glazeFor(order, open = (g) => GLAZES[g].day <= order.day && !GLAZES[g].shop) {
  const pick = (fam) => GLAZE_IDS.find((g) => GLAZES[g].fam === fam && open(g));
  const gl = freshGlaze(), a = order.glaze;
  if (a.all) dip(gl, pick(a.all));
  if (a.stripes) { const n = a.stripes.n; for (let i = 0; i < n; i++) { const c = 0.3 + (0.4 * (i + 0.5)) / n; paintBand(gl, pick(a.stripes.fam), c - 0.03, c + 0.03); } }
  if (a.rim) paintBand(gl, pick(a.rim), 0.9, 1);
  if (a.foot) paintBand(gl, pick(a.foot), 0, 0.08);
  if (a.speckle) gl.speckle = true;
  if (a.drip) gl.drip = pick(a.drip);
  return gl;
}
/** Fires the kiln with a rule for the bellows; returns the result. */
export function fire(seed, rule, big = false) {
  const k = new Firing(seed, big);
  while (!k.done) { k.heat = rule(k); k.step(); }
  return k.result();
}
export const steady = (k) => k.T < (k.lo + k.hi) / 2;

if (process.argv[1].endsWith('pottery-bot.mjs')) {
  const t0 = Date.now();
  let parts = 0, careful = 0, hastyStars = 0, carefulStars = 0;
  for (const o of ORDERS) {
    if (only && o.id !== only) continue;
    for (const p of o.parts) {
      const name = `${o.id} ${p.id} (${p.shape.name})`;
      const r = throwShape(p.shape);
      assert.equal(r.w.flumps, 0, `${name}: the careful potter never collapses it`);
      assert.equal(r.score.stars, 3, `${name}: three stars for the careful potter (err ${r.score.err.toFixed(3)})`);
      assert.ok(r.w.strain < 1, `${name}: the finished pot stands`);
      if (!quick) {
        const last = r.h.inputs[r.h.inputs.length - 1].f;
        const again = replay(clayFor(p.shape), r.h.inputs, { solid: !p.shape.hollow }, r.h.f - 1 - last);
        assert.equal(again.fingerprint(), r.w.fingerprint(), `${name}: the same samples throw the same pot`);
      }
      // lazy: nothing but the lump; then a lump that is only opened (or, for a lid, only pressed flat)
      const lazy = new Wheel(clayFor(p.shape), { solid: !p.shape.hollow }); for (let i = 0; i < 120; i++) lazy.step();
      assert.ok(scoreThrow(lazy, p.shape).stars <= 1, `${name}: a lazy lump scores one star at most`);
      if (p.shape.hollow) assert.equal(scoreThrow(lazy, p.shape).stars, 0, `${name}: an unopened lump fails`);
      const op = new Wheel(clayFor(p.shape), { solid: !p.shape.hollow }), h = new Hand(op);
      h.send('down', op.maxR + 0.3, 1); while (op.centred < 1) h.wait(1); h.send('up'); h.wait(1);
      h.send('down', 0, op.top + 0.3); for (let i = 1; i <= 40; i++) { h.send('move', 0.8, op.top + 0.3 - (op.top - 0.45) * (i / 40)); h.wait(1); } h.wait(30); h.send('up'); h.wait(5);
      if (p.shape.hollow) assert.ok(scoreThrow(op, p.shape).stars <= 1, `${name}: a lump that is only opened scores one star at most`);
      const hz = throwShape(p.shape, { hasty: true });
      hastyStars += hz.score.stars; carefulStars += r.score.stars; parts++;
      if (verbose || !quick) console.log(`  ${name.padEnd(30)} ★${r.score.stars} err ${r.score.err.toFixed(3)} (3★ line ${(0.55 * (0.5 + 0.1 * shapeMaxR(p.shape))).toFixed(3)}) · ${(r.h.f * DT).toFixed(0)} s on the wheel · hasty ★${hz.score.stars} · lazy ★${scoreThrow(lazy, p.shape).stars} · opened only ★${scoreThrow(op, p.shape).stars}`);
    }
    // the glaze wishes
    const gl = glazeFor(o), g = scoreGlaze(gl, o.glaze);
    assert.equal(g.score, 1, `${o.id}: the glaze planner meets every wish (${g.wishes.map((w) => w.text + ':' + w.got).join(', ')})`);
    assert.ok(scoreGlaze(freshGlaze(), o.glaze).score < 0.5, `${o.id}: an unglazed pot misses the wishes`);
    careful++;
  }
  assert.ok(hastyStars / parts <= carefulStars / parts - 0.4, `a hasty potter earns clearly fewer stars (${(hastyStars / parts).toFixed(2)} against ${(carefulStars / parts).toFixed(2)})`);

  // the kiln: a steady hand shines; doing nothing is dull; holding the bellows cracks it
  let shines = 0;
  for (let i = 0; i < 40; i++) {
    const seed = hashSeed('kiln' + i);
    const good = fire(seed, steady), idle = fire(seed, () => false), hot = fire(seed, () => true);
    if (good.finish === 'shine' && !good.cracked) shines++;
    assert.equal(idle.finish, 'dull', 'leaving the kiln alone fires it dull');
    assert.equal(hot.cracked, true, 'holding the bellows the whole time cracks the pot');
    const big = fire(seed, steady, true); assert.ok(big.quality >= good.quality - 1e-9 || big.finish === 'shine', 'the big kiln is no harder');
  }
  assert.ok(shines >= 38, `a steady hand on the bellows shines nearly every time (${shines}/40)`);
  assert.ok(FIRE_TIME <= 15 && FIRE_TIME >= 10, 'a firing takes 10 to 15 seconds');

  // the whole week through the save
  if (!only) {
    const s = freshSave(); let spentAll = 0;
    for (let d = 1; d <= DAY_COUNT; d++) {
      assert.equal(s.day, d, `day ${d}`);
      for (const o of dayOrders(d)) {
        const ps = o.parts.map((p) => ({ id: p.id, prof: throwShape(p.shape).w.profile(), stars: 3 }));
        const gl = glazeFor(o, (g) => glazeOpen(s, g));
        const r = deliver(s, { order: o.id, parts: ps, handle: o.handle ? 'loop' : null, glaze: gl, throwStars: partsStars(ps), fire: fire(hashSeed(o.id), steady) });
        assert.equal(r.stars, 3, `${o.id}: delivered at three stars`);
        for (const u of UPGRADE_IDS) if (buy(s, u)) spentAll += UPGRADES[u].cost;
      }
      if (d < DAY_COUNT) assert.ok(nextDay(s).ok, `day ${d} ends`);
    }
    assert.equal(s.ended, true, 'the picnic tea set is delivered and the story ends');
    assert.equal(s.upgrades.length, UPGRADE_IDS.length, 'every upgrade bought along the way');
    console.log(`  the week: ${ORDERS.length} orders at three stars, ${spentAll} acorns spent on upgrades, ${s.acorns} left`);
  }
  console.log(`pottery bot: ${parts} part${parts === 1 ? '' : 's'} of ${careful} order${careful === 1 ? '' : 's'} thrown at three stars with no collapse${quick ? '' : ', every throw replays exactly'}; lazy and opened-only lumps fail; hasty ★${(hastyStars / parts).toFixed(2)} vs careful ★${(carefulStars / parts).toFixed(2)}; the kiln shines ${shines}/40 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
