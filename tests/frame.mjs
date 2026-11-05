// Out of Frame engine checks: the plan (nine screens, the start first, each place's own segments, the same plan from
// the same seed), the segments (the right size, ground that meets at the joins), the live rule (only what's inside
// the frame moves, Dora included), Dora (walks on her own, hops single steps, waits at walls, jumps, falls back to her
// last safe spot), frozen hazards as solid ground, Grumbles (patrol, hurt, stomped, turn at frozen Dora), traps and
// arrows (fire while live, stop dead outside, stick in rock and build a bridge, jam), boulders (roll, break, rest on
// spikes), hanging rocks, crumbling floor that only crumbles in the picture, rafts and lifts, pickups, the film running
// out, clearing a screen, lenses, healing, winning, replays from a seed, and the save.
import assert from 'node:assert/strict';
import { Run, DT, TILE, COLS, ROWS, W, DORA, FILM, HP, SCREENS, PER_BIOME, SEG, SEGMENTS, LENSES, plan, buildScreen, segment, newSave, parseSave, serialise, bank } from '../.checks/frame-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
/** an empty screen: solid ground from row 12 down, no things, Dora standing at x 40 */
const bare = () => {
  const r = new Run(5);
  r.grid = Array.from({ length: COLS * ROWS }, (_, i) => (Math.floor(i / COLS) >= 12 ? '#' : '.'));
  r.ents = []; Object.assign(r.dora, { x: 40, y: 192, vx: 0, vy: 0, ground: true, on: -1, inv: 0, hurt: 0, safe: { x: 40, y: 192 } });
  r.film = 999; r.filmMax = 999;
  return r;
};
const set = (r, c, row, t) => { r.grid[row * COLS + c] = t; };
/** park the frame with its top-left at (x, y) and keep it there */
const frameAt = (r, x, y) => { r.frame.x = x; r.frame.y = y; };
const still = (r) => ({ tx: r.frame.x + r.frame.w / 2, ty: r.frame.y + r.frame.h / 2, jump: false });
const ticks = (r, k, inp = still) => { for (let i = 0; i < k && r.phase === 'play'; i++) r.tick(typeof inp === 'function' ? inp(r) : inp); return r; };
const secs = (s) => Math.round(s / DT);
/** a frame round Dora, and one far from her */
const onDora = (r) => frameAt(r, Math.max(0, r.dora.x - 40), 120);
const away = (r) => frameAt(r, W - r.frame.w, 0);

// ---- the plan and the segments
{
  for (const seed of [1, 2, 77, 4242]) {
    const p = plan(seed);
    assert.equal(p.length, SCREENS); assert.equal(p[0][0], 'start');
    const used = p.flat().filter((id) => id !== 'start');
    assert.equal(new Set(used).size, used.length, 'no segment twice in a run');
    p.forEach((ids, s) => ids.forEach((id) => { if (id !== 'start') assert.equal(segment(id).tier, Math.floor(s / PER_BIOME), `${id} in its own place`); }));
    assert.deepEqual(plan(seed), p);
  }
  for (const g of SEGMENTS) {
    assert.equal(g.rows.length, ROWS - 4, `${g.id} rows`);
    for (const row of g.rows) assert.equal(row.length, SEG, `${g.id} row width`);
  }
  // the ground height at each segment's two ends is the same as the start's, so any two can sit side by side
  // the ground in a column: the top of the solid run that reaches the bottom
  const ground = (g, c) => { let r = g.rows.length; while (r > 0 && '#=AaL'.includes(g.rows[r - 1][c])) r--; return r; };
  const h0 = ground(segment('start'), SEG - 1);
  for (const g of SEGMENTS) { assert.equal(ground(g, 0), h0, `${g.id} meets on the left`); assert.equal(ground(g, SEG - 1), h0, `${g.id} meets on the right`); }
  const { grid } = buildScreen([segment('start'), segment('gap')]);
  assert.equal(grid.length, COLS * ROWS);
  ok('the plan: nine screens, the start first, each place’s own segments once each, and segments that join up');
}

// ---- the live rule and Dora
{
  const r = bare(); onDora(r);
  ticks(r, secs(1));
  assert.ok(Math.abs(r.dora.x - (40 + 64)) < 3, `Dora walks right at 64 a second (${r.dora.x})`);
  away(r); const x = r.dora.x; ticks(r, secs(1));
  assert.equal(r.dora.x, x, 'out of the frame, Dora is frozen');
  assert.equal(r.dora.live, false);
  ok('Dora walks right on her own inside the frame, and freezes outside it');
}
{
  // a single step is hopped, a two-tile wall is waited at, and a jump gets her up it
  const r = bare(); for (let c = 6; c < 20; c++) set(r, c, 11, '#'); onDora(r);
  ticks(r, secs(1.5), (r) => { onDora(r); return still(r); });
  assert.equal(r.dora.y, 176, 'up the step'); assert.ok(r.dora.x > 6 * TILE);
  const w = bare(); for (let c = 6; c < 20; c++) { set(w, c, 11, '#'); set(w, c, 10, '#'); } onDora(w);
  ticks(w, secs(2), (r) => { onDora(r); return still(r); });
  assert.ok(w.dora.x < 6 * TILE && w.dora.y === 192, 'waits at a two-tile wall');
  w.tick({ ...still(w), jump: true }); ticks(w, secs(1.5), (r) => { onDora(r); return still(r); });
  assert.ok(w.dora.x > 6 * TILE && w.dora.y === 160, `a jump gets her on top (${w.dora.x}, ${w.dora.y})`);
  ok('Dora hops single steps by herself, waits at a taller wall, and jumps onto it');
}
{
  // a fall into the water sends her back to solid rock she'd stood on, a heart down
  const r = bare(); for (let c = 8; c < 12; c++) { for (let row = 12; row < 14; row++) set(r, c, row, '.'); set(r, c, 14, '~'); set(r, c, 15, '~'); }
  for (let i = 0; i < secs(5) && !r.stats.falls; i++) { frameAt(r, Math.max(0, Math.min(W - r.frame.w, r.dora.x - 60)), 144); r.tick(still(r)); }
  assert.equal(r.dora.hp, HP - 1); assert.equal(r.stats.falls, 1);
  assert.ok(r.dora.x < 8 * TILE && r.dora.y === 192, 'back on the rock before the pit');
  ok('falling costs a heart and puts her back on the last safe rock');
}

// ---- Grumbles
{
  const r = bare(); const g = r.add('grumble', 200, 179, 14, 13);
  away(r); ticks(r, secs(1));
  assert.equal(g.x, 200, 'a Grumble outside the frame doesn’t move');
  frameAt(r, 150, 120); ticks(r, secs(1));
  assert.ok(Math.abs(g.x - 170) < 2, `inside it walks (${g.x})`);
  ok('Grumbles only walk while they’re in the picture');
}
{
  // a frozen Grumble is a step: Dora walks up onto it (the frame's bottom edge is above the Grumble's middle but below
  // Dora's face)
  const r = bare(); const g = r.add('grumble', 100, 179, 14, 13);
  let stood = false;
  ticks(r, secs(1.4), (r) => { frameAt(r, 0, 184 - r.frame.h); r.frame.w = 300; stood ||= r.dora.on === g.id; return still(r); });
  assert.equal(r.stats.hits, 0, 'no bump from a frozen Grumble');
  assert.ok(stood && r.stats.frozenSteps >= 1, 'she stood on it'); assert.ok(r.dora.x > g.x + g.w, 'and walked on past');
  // a live one bumps her
  const h = bare(); h.add('grumble', 90, 179, 14, 13); onDora(h);
  ticks(h, secs(1.5), (r) => { onDora(r); return still(r); });
  assert.equal(h.dora.hp, HP - 1, 'a live Grumble hurts');
  // and landing on its head squashes it
  const s = bare(); const sg = s.add('grumble', 100, 179, 14, 13, { dir: 1 });
  Object.assign(s.dora, { x: 108, y: 140, ground: false }); frameAt(s, 40, 100);
  ticks(s, secs(0.5));
  assert.ok(sg.dead, 'squashed'); assert.equal(s.stats.stomps, 1); assert.equal(s.dora.hp, HP, 'no harm to Dora');
  ok('a frozen Grumble is a step, a live one bumps Dora, and landing on its head squashes it');
}
{
  const r = bare(); r.add('grumble', 70, 179, 14, 13, { dir: -1 });
  // Dora frozen outside the frame; the Grumble walks into her and turns round
  frameAt(r, 60, 120); r.frame.w = 100;
  Object.assign(r.dora, { x: 40 });
  ticks(r, secs(1.5));
  assert.equal(r.dora.hp, HP, 'frozen Dora is safe');
  ok('a live Grumble that walks into frozen Dora turns round');
}

// ---- traps and arrows
{
  const r = bare(); set(r, 20, 11, 'A'); const t = r.add('trap', 320, 176, 16, 16, { dir: -1, t: 0.1 });
  set(r, 10, 11, '#'); // a rock to stick in
  frameAt(r, 150, 120); r.frame.w = 200;
  ticks(r, secs(0.5));
  const a = r.ents.find((e) => e.k === 'arrow'); assert.ok(a, 'the trap fires while live');
  ticks(r, secs(2));
  assert.equal(a.s, 'stuck', 'it sticks in the rock'); assert.ok(a.x > 10 * TILE && a.x < 11 * TILE + 4);
  // the next one sticks into the end of that one
  ticks(r, secs(2));
  const stuck = r.ents.filter((e) => e.k === 'arrow' && e.s === 'stuck').sort((p, q) => p.x - q.x);
  assert.ok(stuck.length >= 2 && stuck[1].x > stuck[0].x + 6, 'arrows build out from the rock');
  // out of the frame, an arrow in flight stops dead
  const f = bare(); f.add('trap', 320, 176, 16, 16, { dir: -1, t: 0.05 }); set(f, 20, 11, 'A');
  frameAt(f, 230, 120); ticks(f, 10);
  const fa = f.ents.find((e) => e.k === 'arrow'); away(f); f.frame.x = 0; f.frame.y = 0; const x0 = fa.x; ticks(f, 30);
  assert.equal(fa.x, x0, 'a frozen arrow hangs in the air');
  assert.ok(f.solids(fa.x, fa.y - 1, fa.x + fa.w, fa.y + 2).some((b) => b.id === fa.id && b.one), 'and holds Dora up like a plank');
  void t;
  ok('traps fire while live; arrows stick in rock and in each other, and a frozen one is a plank');
}

// ---- boulders and hanging rocks
{
  const r = bare(); for (let c = 6; c < 9; c++) set(r, c, 12, '^');
  const b = r.add('boulder', 200, 178, 14, 14, { dir: -1 });
  frameAt(r, 0, 100); r.frame.w = 300; Object.assign(r.dora, { x: 20 }); r.frame.x = 30;
  ticks(r, secs(3));
  assert.equal(b.s, 'rest', 'a boulder that rolls into spikes stays there'); assert.ok(!b.dead);
  assert.ok(r.solids(b.x, b.y - 1, b.x + b.w, b.y + 2).some((s) => s.id === b.id), 'and is solid ground');
  const w = bare(); set(w, 4, 11, '#'); const wb = w.add('boulder', 150, 178, 14, 14, { dir: -1 });
  Object.assign(w.dora, { x: 20 }); frameAt(w, 50, 100); ticks(w, secs(3));
  assert.ok(wb.dead, 'a boulder breaks on a wall');
  ok('boulders roll while live, break on walls, and come to rest on spikes as a block');
}
{
  const r = bare(); const k = r.add('rock', 98, 140, 12, 14, { s: 'hang' }); onDora(r);
  Object.assign(r.dora, { x: 70 });
  ticks(r, secs(0.2), (r) => { onDora(r); return still(r); });
  assert.equal(k.s, 'shake', 'it shakes when Dora walks under');
  ticks(r, secs(1.2), (r) => { onDora(r); return still(r); });
  assert.ok(k.dead && r.dora.hp === HP - 1, 'and drops on her');
  const f = bare(); const fk = f.add('rock', 98, 140, 12, 14, { s: 'hang' });
  ticks(f, secs(2), (r) => { frameAt(r, 0, 150); r.frame.w = 96; return still(r); });
  assert.equal(fk.s, 'hang', 'outside the frame it never notices her');
  ok('hanging rocks shake and drop on Dora when live, and stay put when frozen');
}

// ---- crumbling floor, rafts and lifts
{
  const r = bare(); set(r, 4, 12, '=');
  Object.assign(r.dora, { x: 72 }); onDora(r); r.tick(still(r));
  const i = 12 * COLS + 4; assert.ok(r.crumble[i] !== undefined, 'stepping on it starts it going');
  away(r); ticks(r, secs(1));
  assert.equal(r.grid[i], '=', 'out of the frame it waits');
  frameAt(r, 20, 120); ticks(r, secs(0.6));
  assert.equal(r.grid[i], '.', 'in the frame it falls');
  ok('crumbling floor crumbles only while it’s in the picture');
}
{
  const r = bare(); const p = r.add('plat', 200, 186, 32, 6, { dir: 1, x0: 200 });
  away(r); r.frame.x = 0; ticks(r, secs(1)); assert.equal(p.x, 200, 'a frozen raft stays');
  frameAt(r, 160, 120); ticks(r, secs(1)); assert.ok(p.x > 220, 'a live one moves');
  ticks(r, secs(4)); assert.ok(p.x >= 200 && p.x <= 280, 'back and forth over five tiles');
  const l = bare(); const lift = l.add('lift', 200, 186, 32, 6, { dir: -1, y0: 186 });
  frameAt(l, 160, 100); ticks(l, secs(1)); assert.ok(lift.y < 186, 'a lift goes up');
  ok('rafts and lifts move only while they’re in the picture');
}

// ---- pickups, film and the run
{
  const r = bare(); r.add('acorn', 70, 180, 10, 10); r.add('film', 90, 180, 10, 10); r.add('heart', 110, 180, 10, 10);
  r.dora.hp = 2; r.film = 30; r.filmMax = FILM.max;
  ticks(r, secs(1.5), (r) => { onDora(r); return still(r); });
  assert.equal(r.stats.acorns, 1); assert.equal(r.dora.hp, 3); assert.ok(r.film > 30 + FILM.can - 2, 'a can of film adds ten seconds');
  const f = bare(); f.film = 0.5; ticks(f, secs(1));
  assert.equal(f.phase, 'lost', 'out of film, out of the run');
  ok('acorns, film cans and hearts; and running out of film ends the run');
}
{
  const r = new Run(9); r.film = 20;
  Object.assign(r.dora, { x: W - 7 }); onDora(r); r.tick(still(r));
  assert.equal(r.phase, 'pick'); assert.equal(r.film, 20 - DT + FILM.clear);
  assert.equal(r.offer.length, 3); assert.equal(new Set(r.offer).size, 3);
  assert.equal(r.pick('nope'), false);
  const id = r.offer.includes('wide') ? 'wide' : r.offer[0];
  r.pick(id); assert.equal(r.screen, 1); assert.equal(r.lenses[id], 1); assert.equal(r.phase, 'play');
  if (id === 'wide') assert.equal(r.frame.w, 144 + 32);
  // a heart back at the end of each place, and the ninth screen wins
  const h = new Run(9); h.screen = PER_BIOME - 1; h.dora.hp = 2; Object.assign(h.dora, { x: W - 7 }); onDora(h); h.tick(still(h));
  assert.equal(h.dora.hp, 3);
  const w = new Run(9); w.enter(SCREENS - 1); Object.assign(w.dora, { x: W - 7 }); onDora(w); w.tick(still(w));
  assert.equal(w.phase, 'won');
  assert.equal(LENSES.length, 8);
  ok('reaching the right edge: film back, three lenses offered, a heart at the end of each place, the ninth screen wins');
}
{
  // the same seed and the same hands make the same run
  const play = () => { const r = new Run(31337); for (let i = 0; i < secs(20) && r.phase === 'play'; i++) r.tick({ tx: r.dora.x + 50 + 30 * Math.sin(i / 40), ty: r.dora.y - 30, jump: i % 50 === 0 }); return r; };
  const a = play(), b = play();
  assert.deepEqual({ d: a.dora, f: a.frame, s: a.stats, e: a.ents.length }, { d: b.dora, f: b.frame, s: b.stats, e: b.ents.length });
  const o = new Run(8), c = o.clone(); c.tick(still(c)); c.ents[0].x += 50; assert.equal(o.stats.time, 0, 'a clone is its own run'); assert.notEqual(c.ents[0].x, o.ents[0].x);
  ok('a seed replays a run exactly, and a clone doesn’t touch the original');
}

// ---- the save
{
  const s = newSave();
  assert.deepEqual(parseSave(serialise(s)), s);
  assert.deepEqual(parseSave('{oops'), newSave()); assert.deepEqual(parseSave(JSON.stringify({ v: 2 })), newSave());
  const odd = parseSave(JSON.stringify({ v: 1, best: { screen: -4, acorns: 'x' }, seen: ['grumble', 'dragon'], settings: { music: false } }));
  assert.equal(odd.best.screen, 0); assert.equal(odd.best.acorns, 0); assert.deepEqual(odd.seen, ['grumble']); assert.equal(odd.settings.music, false);
  const r = new Run(3); r.screen = 4; r.stats.acorns = 12; r.phase = 'lost';
  bank(s, r); assert.equal(s.best.screen, 5); assert.equal(s.best.acorns, 12); assert.equal(s.stats.runs, 1); assert.equal(s.stats.wins, 0);
  r.phase = 'won'; r.stats.time = 300.4; bank(s, r); assert.equal(s.best.screen, SCREENS); assert.equal(s.best.time, 300); assert.equal(s.stats.wins, 1);
  ok('the save: round trip, corrupt and wrong-version saves ignored, odd values cleaned, runs banked');
}

void DORA;
console.log(`\n${n} Out of Frame checks passed`);
