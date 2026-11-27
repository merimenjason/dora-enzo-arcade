// Moth Hoop engine tests: the six kits and their pictures, determinism, stitching from the bottom up, darning, golden
// thread, every foe kind (moths chewing holes, larvae and cocoons, gold moths diving, the silk moth's buttons, the
// queen), every power, spare spools, both ways to lose, the win and its stars, two players and the swap, saves, and the
// human-delay bots: a casual player clears every kit, a player who never throws never does. Run after compiling the
// engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { MothGame, Bot, HOOPS, NO_INPUT, W, H, HAND_Y, RAIL_Y, X_MIN, X_MAX, TODO, DONE, HOLE, POWERS, POWER_TIME, freshSave, parseSave, hoopOpen, record } from '../.checks/moth-game.js';
import { MOTH_PATTERNS } from '../.checks/moth-patterns.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log(`  ok ${name}`); };
const inp = (o = {}) => ({ ...NO_INPUT, ...o });
const run = (g, frames, p1 = {}, p2 = {}) => { for (let k = 0; k < frames; k++) g.step(inp(p1), inp(p2)); };
/** a quiet kit: nothing arrives unless the test adds it */
const quiet = (hoop = 0, o = {}) => { const g = new MothGame({ hoop, seed: 7, ...o }); g.spawnT = 1e9; g.queenSpawned = true; return g; };
const sewer = (g) => g.heroes.find((h) => h.ctrl === 'p1');
/** a column of the picture, and the lowest picture row in it */
const column = (g) => { for (let x = 40; x < W; x++) for (let y = H - 1; y >= 0; y--) if (g.cloth[y * W + x] === TODO) return { x, y }; throw new Error('no column'); };
/** throw one needle from column x and let it land */
const throwAt = (g, x) => { const h = sewer(g); h.x = x; h.cool = 0; g.step(inp({ fire: true })); run(g, 60); };
const evs = (g, frames, p1 = {}) => { const out = []; for (let k = 0; k < frames; k++) { g.step(inp(p1)); out.push(...g.events); } return out; };

console.log('moth hoop');

ok('six kits, each with a Singapore picture that fits the cloth above the hands', () => {
  assert.equal(HOOPS.length, 6);
  assert.equal(new Set(HOOPS.map((h) => h.id)).size, 6);
  for (const h of HOOPS) {
    const p = MOTH_PATTERNS[h.pattern]; assert.ok(p, h.pattern);
    assert.ok(p.x0 >= X_MIN && p.x0 + p.w <= X_MAX + 1, `${h.id} fits between the reels' ends`);
    assert.ok(p.y0 >= 1 && p.y0 + p.h < HAND_Y - 4, `${h.id} sits above the hands`);
    let max = 0, cells = 0; for (const c of p.cells) { if (c) cells++; max = Math.max(max, c); }
    assert.ok(max <= p.palette.length, `${h.id} palette covers every colour`);
    assert.ok(cells > 400, `${h.id} is a real picture (${cells} stitches)`);
    for (const c of p.palette) assert.match(c, /^#[0-9a-f]{6}$/i);
    assert.ok(h.run >= 1 && h.par > 0 && h.tear > 0 && h.tear < 0.5 && h.chew > 0);
  }
  assert.ok(HOOPS[5].queen, 'the last kit has the queen');
  assert.equal(HOOPS.filter((h) => h.queen).length, 1);
});

ok('the same seed and inputs replay the same kit', () => {
  const play = () => { const g = new MothGame({ hoop: 2, seed: 99 }), b = new Bot(5, 0.6); for (let k = 0; k < 3600; k++) g.step(b.input(g, g.heroes[0])); return [g.score, g.done, g.holes, g.foes.length, g.spools, g.pinned].join(); };
  assert.equal(play(), play());
});

ok('a needle stitches the picture from the bottom up, one run of crosses', () => {
  const g = quiet(1), { x, y } = column(g);
  sewer(g).x = x; sewer(g).cool = 0; g.step(inp({ fire: true }));
  const out = evs(g, 60);
  const st = out.find((v) => v.k === 'stitch'); assert.ok(st, 'stitched');
  assert.equal(st.cells.length, Math.min(HOOPS[1].run, st.cells.length));
  assert.equal(st.cells[0], y * W + x, 'starts at the lowest unstitched cell');
  for (let i = 1; i < st.cells.length; i++) assert.equal(st.cells[i], st.cells[i - 1] - W, 'climbs one row at a time');
  for (const c of st.cells) assert.equal(g.cloth[c], DONE);
  assert.equal(g.done, st.cells.length); assert.equal(g.stitched, st.cells.length);
  // the next needle carries on above the run
  throwAt(g, x);
  assert.ok(g.done > st.cells.length);
});

ok('a needle in an empty column flies off the top', () => {
  const g = quiet(0); const h = sewer(g); h.x = X_MIN; h.cool = 0; g.step(inp({ fire: true }));
  const out = evs(g, 90); assert.ok(out.some((v) => v.k === 'miss')); assert.equal(g.done, 0);
});

ok('holding throw keeps throwing, at the cooldown', () => {
  const g = quiet(0); const out = evs(g, 60, { fire: true });
  const n = out.filter((v) => v.k === 'throw').length; assert.ok(n >= 6 && n <= 8, `${n} throws a second`);
});

ok('a hole takes a needle to darn, then stitches as normal', () => {
  const g = quiet(1), { x, y } = column(g);
  g.cloth[y * W + x] = HOLE; g.holes = 1;
  throwAt(g, x);
  assert.equal(g.cloth[y * W + x], TODO, 'darned back to plain cloth'); assert.equal(g.holes, 0); assert.equal(g.darned, 1); assert.equal(g.done, 0);
  throwAt(g, x); assert.equal(g.cloth[y * W + x], DONE);
});

ok('golden thread darns and stitches in one needle, and sews twice as far', () => {
  const g = quiet(1), { x, y } = column(g);
  g.cloth[y * W + x] = HOLE; g.holes = 1; g.grant('gold', 'dora');
  assert.equal(g.powers.gold, POWER_TIME.gold);
  throwAt(g, x);
  assert.equal(g.holes, 0); assert.equal(g.cloth[y * W + x], DONE);
  let col = 0; for (let yy = 0; yy < H; yy++) if (g.cloth[yy * W + x] !== 0) col++;
  assert.equal(g.done, Math.min(col, HOOPS[1].run * 2));
});

ok('three needles throws three columns', () => {
  const g = quiet(1); g.grant('triple', 'dora'); const { x } = column(g); const h = sewer(g); h.x = x + 3; h.cool = 0;
  g.step(inp({ fire: true })); assert.equal(g.needles.length, 3);
  assert.deepEqual(g.needles.map((v) => v.x).sort((a, b) => a - b), [x, x + 3, x + 6]);
});

ok('a moth lands on a finished stitch, chews it into a hole, and a needle pins it', () => {
  const g = quiet(1), { x } = column(g);
  throwAt(g, x);
  const m = g.addFoe('moth', x, 2);
  assert.ok(m.cell >= 0 && g.cloth[m.cell] === DONE, 'it hunts a finished stitch');
  const out = evs(g, 60 * 12);
  assert.ok(out.some((v) => v.k === 'chew')); assert.ok(out.some((v) => v.k === 'hole'));
  assert.ok(g.holes >= 1); assert.ok(g.done < HOOPS[1].run);
  // pin it: line up under it and throw
  const f = g.foes.find((v) => v.kind === 'moth'); assert.ok(f);
  f.state = 'chew'; f.t = 0; const h = sewer(g); h.x = Math.round(f.x); h.cool = 0;
  g.step(inp({ fire: true })); const out2 = evs(g, 60);
  const pin = out2.find((v) => v.k === 'pin'); assert.ok(pin && pin.dead && pin.foe === 'moth'); assert.equal(g.pinned, 1);
});

ok('with nothing stitched, moths wander and never chew', () => {
  const g = quiet(0); g.addFoe('moth', 60, -2); const out = evs(g, 600);
  assert.ok(!out.some((v) => v.k === 'chew' || v.k === 'hole')); assert.equal(g.foes.length, 1);
});

ok('a larva crawls the row eating stitches, spins a cocoon, and the cocoon hatches a moth', () => {
  const g = quiet(3);
  // stitch a whole row of the picture so the larva has a meal
  const row = MOTH_PATTERNS[HOOPS[3].pattern].y0 + 20;
  for (let x = 0; x < W; x++) if (g.cloth[row * W + x] === TODO) { g.cloth[row * W + x] = DONE; g.done++; }
  let start = -1; for (let x = 40; x < W; x++) if (g.cloth[row * W + x] === DONE) { start = x; break; }
  const l = g.addFoe('larva', start, row); l.cell = row * W + start;
  const out = evs(g, 60 * 20);
  assert.ok(out.filter((v) => v.k === 'hole').length >= 4, 'four stitches eaten');
  assert.ok(out.some((v) => v.k === 'arrive' && v.foe === 'cocoon'), 'cocoon spun');
  assert.ok(out.some((v) => v.k === 'hatch'), 'cocoon hatched');
  assert.ok(g.foes.some((f) => f.kind === 'moth'), 'a moth came out');
});

ok('a gold moth hovers, shivers, dives at the reel and costs a spool; the thimble blocks one', () => {
  const g = quiet(2); const h = sewer(g); h.x = 64;
  const f = g.addFoe('gold', 64, -2);
  let out = evs(g, 60 * 8);
  assert.ok(out.some((v) => v.k === 'shiver')); assert.ok(out.some((v) => v.k === 'dive'));
  assert.ok(out.some((v) => v.k === 'hurt' && !v.blocked)); assert.equal(g.spools, 2); assert.equal(g.spoolsLost, 1);
  assert.ok(f.state === 'dive' || f.state === 'enter' || f.state === 'hover');
  // thimble
  const g2 = quiet(2); g2.grant('thimble', 'dora'); g2.addFoe('gold', 64, -2);
  out = evs(g2, 60 * 8);
  assert.ok(out.some((v) => v.k === 'hurt' && v.blocked)); assert.equal(g2.spools, 3); assert.equal(g2.powers.thimble, 0);
});

ok('stepping out of the dive line dodges it', () => {
  const g = quiet(2); sewer(g).x = 64; g.addFoe('gold', 64, -2);
  let dodged = false;
  for (let k = 0; k < 60 * 8; k++) {
    const f = g.foes.find((v) => v.kind === 'gold');
    const go = f && (f.state === 'shiver' || f.state === 'dive') && Math.abs(sewer(g).x - f.tx) < 14;
    g.step(inp({ right: !!go }));
    if (f && f.state === 'dive') dodged = true;
  }
  assert.ok(dodged); assert.equal(g.spools, 3);
});

ok('the silk moth takes three pins and drops a button; the reel catches it', () => {
  const g = quiet(1); const f = g.addFoe('silk', 64, 10); f.vx = 0; f.state = 'fly';
  // clear the picture out of column 64 so needles reach the moth
  for (let y = 0; y < H; y++) if (g.cloth[y * W + 64]) { g.cloth[y * W + 64] = 0; g.total--; }
  const h = sewer(g); h.x = 64; const out = [];
  for (let k = 0; k < 60 * 4 && !out.some((v) => v.k === 'drop'); k++) { g.step(inp({ fire: true })); out.push(...g.events); f.x = 64; }
  const pins = out.filter((v) => v.k === 'pin' && v.foe === 'silk');
  assert.equal(pins.length, 3); assert.ok(pins[2].dead && !pins[0].dead);
  const drop = out.find((v) => v.k === 'drop'); assert.ok(drop);
  const out2 = evs(g, 60 * 6); const pw = out2.find((v) => v.k === 'power');
  assert.ok(pw, 'caught by the reel'); assert.equal(pw.power, drop.power); assert.equal(g.drops.length, 0);
});

ok('a button nobody catches falls off the table', () => {
  const g = quiet(1); g.drops.push({ id: 999, power: 'triple', x: 20, y: 30 }); sewer(g).x = 100;
  const out = evs(g, 60 * 5); assert.ok(!out.some((v) => v.k === 'power')); assert.equal(g.drops.length, 0);
});

ok('lavender sends the moths away and stops arrivals while it lasts', () => {
  const g = quiet(1); g.spawnT = 0.1; const m = g.addFoe('moth', 60, 10);
  g.grant('lavender', 'enzo'); assert.equal(m.state, 'flee');
  const out = evs(g, Math.round(60 * (POWER_TIME.lavender - 0.5)));
  assert.ok(!out.some((v) => v.k === 'arrive')); assert.ok(!g.foes.includes(m), 'the moth left');
  assert.ok(g.powers.lavender > 0);
  run(g, 60); assert.equal(g.powers.lavender, 0);
});

ok('every power lands, and each times out except the thimble', () => {
  for (const p of POWERS) {
    const g = quiet(0); g.grant(p, 'dora'); assert.ok(g.powers[p] > 0, p);
    run(g, 60 * 12); assert.equal(g.powers[p] > 0, p === 'thimble', p);
  }
});

ok('Ah Ma hands back a lost spool at a third and two thirds done', () => {
  const g = quiet(1); g.spools = 1; g.spoolsLost = 2;
  const cells = []; for (let i = 0; i < W * H; i++) if (g.cloth[i] === TODO) cells.push(i);
  const fill = (frac) => { for (const i of cells.slice(0, Math.ceil(cells.length * frac))) g.cloth[i] = DONE; g.done = 0; for (const i of cells) if (g.cloth[i] === DONE) g.done++; };
  fill(0.33); const { x } = column(g); throwAt(g, x);
  assert.equal(g.spools, 2);
  fill(0.67); throwAt(g, column(g).x); assert.equal(g.spools, 3);
  fill(0.9); throwAt(g, column(g).x); assert.equal(g.spools, 3, 'only two spares');
});

ok('finishing every stitch wins, with a bonus and stars', () => {
  const g = quiet(0); const { x, y } = column(g);
  for (let i = 0; i < W * H; i++) if (g.cloth[i] === TODO && i !== y * W + x) g.cloth[i] = DONE;
  g.done = g.total - 1;
  const before = g.score; throwAt(g, x);
  assert.equal(g.over, 'win'); assert.ok(g.score >= before + 1000 + 3 * 300);
  const st = g.stats(); assert.equal(st.stars, 3);
  const g2 = quiet(0); g2.done = g2.total; g2.spoolsLost = 1; g2.time = HOOPS[0].par + 10; g2.step(inp());
  assert.equal(g2.over, 'win'); assert.equal(g2.stats().stars, 1);
});

ok('a finished row scores a bonus', () => {
  const g = quiet(0); const p = MOTH_PATTERNS[HOOPS[0].pattern]; const row = p.y0 + p.h - 1;
  const xs = []; for (let x = 0; x < W; x++) if (g.cloth[row * W + x] === TODO) xs.push(x);
  for (const x of xs.slice(1)) { g.cloth[row * W + x] = DONE; g.done++; }
  const out = []; const h = sewer(g); h.x = xs[0]; h.cool = 0; g.step(inp({ fire: true })); for (let k = 0; k < 60; k++) { g.step(inp()); out.push(...g.events); }
  assert.ok(out.some((v) => v.k === 'row' && v.row === row));
});

ok('too many holes tears the cloth; no spools left loses too', () => {
  const g = quiet(1); g.holes = g.tearAt; g.step(inp()); assert.equal(g.over, 'lose'); assert.equal(g.why, 'tear'); assert.equal(g.stats().stars, 0);
  const g2 = quiet(1); g2.spools = 0; g2.step(inp()); assert.equal(g2.why, 'spools');
  const t = g2.time; g2.step(inp()); assert.equal(g2.time, t, 'a finished kit stops');
});

ok('the National Day kit brings the queen at a quarter done; she lays larvae and must be pinned to win', () => {
  const g = new MothGame({ hoop: 5, seed: 3 }); g.spawnT = 1e9;
  const cells = []; for (let i = 0; i < W * H; i++) if (g.cloth[i] === TODO) cells.push(i);
  for (const i of cells.slice(0, Math.ceil(cells.length * 0.3))) g.cloth[i] = DONE; g.done = Math.ceil(cells.length * 0.3);
  const out = evs(g, 60 * 14);
  const q = g.foes.find((f) => f.kind === 'queen'); assert.ok(q, 'she arrived');
  assert.ok(out.some((v) => v.k === 'egg'), 'she lays');
  // everything stitched but the queen still up: no win
  for (const i of cells) g.cloth[i] = DONE; g.done = g.total; g.holes = 0; g.step(inp()); assert.equal(g.over, null);
  q.hp = 1; q.x = 64; sewer(g).x = 64; sewer(g).cool = 0; g.spools = 3;
  for (let k = 0; k < 120 && !g.over; k++) { q.x = 64; g.step(inp({ fire: true })); }
  assert.ok(g.queenDown); assert.equal(g.over, 'win');
});

ok('solo: the rider sits on the sewer\'s reel; Q swaps who sews; player 2 joins with a reel of their own', () => {
  const g = quiet(0); const [a, b] = g.heroes; assert.equal(a.ctrl, 'p1'); assert.equal(b.ctrl, 'ride');
  run(g, 30, { right: true }); assert.equal(b.x, a.x, 'rides along');
  assert.equal(g.throwers().length, 1);
  g.swap(); assert.equal(b.ctrl, 'p1'); assert.equal(a.ctrl, 'ride');
  g.join(); assert.equal(a.ctrl, 'p2'); assert.ok(g.twoP); assert.equal(g.throwers().length, 2);
  const x2 = a.x; run(g, 30, {}, { left: true }); assert.ok(a.x < x2, 'player 2 moves');
  a.cool = 0; g.step(inp(), inp({ fire: true })); assert.ok(g.needles.some((v) => v.by === a.id), 'player 2 throws');
  g.swap(); assert.equal(a.ctrl, 'p2', 'no swap in two-player');
  const g2 = new MothGame({ hoop: 0, seed: 1, twoP: true, sewer: 'enzo' });
  assert.equal(g2.heroes[0].id, 'enzo'); assert.equal(g2.heroes[1].ctrl, 'p2');
});

ok('reels stay on the tape', () => {
  const g = quiet(0); run(g, 400, { left: true }); assert.equal(sewer(g).x, X_MIN);
  run(g, 600, { right: true }); assert.equal(sewer(g).x, X_MAX);
  assert.ok(RAIL_Y > HAND_Y);
});

ok('saves: fresh, round trip, junk rejected, kits open in order, best scores kept', () => {
  const s = freshSave(); assert.equal(s.stars.length, 6); assert.ok(s.assist && s.music && s.sound);
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  assert.equal(parseSave('nope'), null); assert.equal(parseSave(JSON.stringify({ v: 0 })), null); assert.equal(parseSave(null), null);
  const odd = parseSave(JSON.stringify({ v: 1, stars: [9, -1, 'x'], best: [5.5], sewer: 'zz', assist: false }));
  assert.deepEqual(odd.stars, [3, 0, 0, 0, 0, 0]); assert.equal(odd.best[0], 5); assert.equal(odd.sewer, 'dora'); assert.equal(odd.assist, false);
  assert.ok(hoopOpen(s, 0)); assert.ok(!hoopOpen(s, 1));
  const won = record(s, 0, { stars: 2, score: 4000 }); assert.ok(hoopOpen(won, 1)); assert.equal(won.best[0], 4000);
  const lost = record(won, 0, { stars: 0, score: 9000 }); assert.equal(lost.stars[0], 2); assert.equal(lost.best[0], 4000, 'a loss never sets a best');
  assert.equal(s.stars[0], 0, 'record copies');
});

ok('bots: a casual player with human reactions clears every kit; one who never throws never does', () => {
  const res = [];
  for (let h = 0; h < HOOPS.length; h++) {
    let wins = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const g = new MothGame({ hoop: h, seed: seed * 31 }), b = new Bot(seed, 0.45);
      while (!g.over && g.time < 480) g.step(b.input(g, g.heroes[0]));
      if (g.over === 'win') wins++;
    }
    res.push(wins);
    assert.ok(wins >= 3, `${HOOPS[h].id}: casual bot won ${wins}/4`);
  }
  console.log(`    casual wins per kit: ${res.join(' ')}`);
  for (let h = 0; h < HOOPS.length; h += 2) {
    const g = new MothGame({ hoop: h, seed: 5 });
    while (!g.over && g.time < 240) g.step(inp({ left: g.time % 6 < 3, right: g.time % 6 >= 3 }));
    assert.notEqual(g.over, 'win', `${HOOPS[h].id}: never throwing never wins`);
  }
});

console.log(`moth: ${n} passed`);
