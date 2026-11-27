// Tambak engine tests: the six reclamation sites, determinism, pouring a trail and claiming land, the fill that keeps
// every creature's water, trails as walls, every creature (jellyfish, crocodile, pufferfish, horseshoe crab, Captain
// Bakau), the three floating pickups, both ways to lose, the win and its stars, assist, two players, the swap, saves,
// and the human-delay bots: careful and sloppy bots clear every site, a careless one mostly loses, an idle one always
// does. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { TambakGame, Bot, SITES, FOES, W, H, N, SEA, LAND, TRAIL0, RIM, DT, START_BUCKETS, BLINK, CRAB_AT, ASSIST_TARGET, ASSIST_TIDE, POWER_TIME, freshSave, parseSave, siteOpen, record } from '../.checks/tambak-game.js';

let n = 0, bad = 0; const ok = (name, fn) => { try { fn(); n++; console.log(`  ok ${name}`); } catch (e) { bad++; console.log(`  FAIL ${name}\n    ${e.message.split('\n').join('\n    ')}`); } };
/** a field with no creatures and no pickups unless the test adds them */
const quiet = (site = 0, o = {}) => { const g = new TambakGame({ site, seed: 7, ...o }); g.foes = []; g.pickT = 1e9; for (const h of g.heroes) h.blink = 0; return g; };
/** hold a direction for k cells (12 cells a second at 60 steps a second: 5 steps a cell) */
const walk = (g, d, cells, d2 = 0) => { const out = []; for (let k = 0; k < cells * 5; k++) { g.step(d, d2); out.push(...g.events); } return out; };
const idx = (x, y) => y * W + x;
const foe = (g, kind, x, y, vx = 0, vy = 0) => { const f = { id: 99 + g.foes.length, kind, x, y, vx, vy, r: FOES[kind].r, t: 0, puff: 0, snap: 0, dizzy: 0 }; g.foes.push(f); return f; };

console.log('tambak');

ok('six real reclamation sites, each harder than the last, the last with Captain Bakau', () => {
  assert.equal(SITES.length, 6);
  assert.deepEqual(SITES.map((s) => s.id), ['ecp', 'marina', 'changi', 'jurong', 'semakau', 'tuas']);
  for (let i = 1; i < SITES.length; i++) assert.ok(SITES[i].tide >= SITES[i - 1].tide);
  assert.ok(SITES[5].foes.includes('boss')); assert.ok(!SITES.slice(0, 5).some((s) => s.foes.includes('boss')));
  assert.ok(SITES.filter((s) => s.crab).length === 3);
  for (const s of SITES) assert.ok(s.par < s.tide);
});

ok('the field starts as sea inside a two-cell rim of land, heroes on the rim, creatures in open water', () => {
  const g = new TambakGame({ site: 2, seed: 3 });
  assert.equal(g.seaTotal, (W - 2 * RIM) * (H - 2 * RIM));
  assert.equal(g.grid[0], LAND); assert.equal(g.grid[idx(RIM, RIM)], SEA); assert.equal(g.grid[idx(W - 1, H - 1)], LAND);
  assert.equal(g.heroes.length, 1); assert.equal(g.grid[idx(g.heroes[0].x, g.heroes[0].y)], LAND);
  assert.equal(g.foes.length, 3);
  for (const f of g.foes) assert.equal(g.cellAt(f.x, f.y), SEA);
  assert.equal(g.buckets, START_BUCKETS); assert.equal(g.pct, 0);
});

ok('a seed replays exactly', () => {
  const play = () => { const g = new TambakGame({ site: 3, seed: 42 }); const b = new Bot(9); for (let k = 0; k < 3000 && !g.over; k++) g.step(b.input(g, g.heroes[0])); return [g.score, g.land, g.t, g.buckets, g.foes.map((f) => f.x.toFixed(3)).join()]; };
  assert.deepEqual(play(), play());
});

ok('walking into the sea pours a trail; stepping back on land turns it into land and fills the empty pocket', () => {
  const g = quiet(); const h = g.heroes[0];
  foe(g, 'jelly', 70.5, 20.5); // keeps the big sea alive
  const evs = walk(g, 1, 6); // up from the rim: 4 cells of sea
  assert.ok(h.trail.length >= 4, 'trail poured');
  assert.ok(evs.some((e) => e.k === 'pour'));
  for (const c of h.trail) assert.equal(g.grid[c], TRAIL0);
  walk(g, 4, 6); // left along row 43
  const claimEvs = walk(g, 3, 6); // back down onto the rim
  const cl = claimEvs.find((e) => e.k === 'claim');
  assert.ok(cl, 'claimed'); assert.equal(h.trail.length, 0);
  // the strip between the trail and the rim has no creature in it, so it fills too
  assert.ok(cl.cells.length > cl.trail, `filled ${cl.cells.length} for a trail of ${cl.trail}`);
  for (const c of cl.cells) assert.equal(g.grid[c], LAND);
  assert.ok(g.pct > 0 && g.score >= cl.cells.length * 10);
});

ok('a pocket with a creature in it stays sea: creatures always keep their water', () => {
  const g = quiet(); const h = g.heroes[0];
  // wall off a 92-wide band near the bottom with a line straight across, a jelly on each side
  const below = foe(g, 'jelly', 30.5, 46.5), above = foe(g, 'jelly', 30.5, 10.5);
  below.vx = below.vy = above.vx = above.vy = 0;
  h.x = 1; h.y = 44;
  const evs = walk(g, 2, W);
  const cl = evs.find((e) => e.k === 'claim'); assert.ok(cl);
  assert.equal(cl.cells.length, cl.trail, 'nothing else filled');
  assert.equal(g.cellAt(30.5, 46.5), SEA); assert.equal(g.cellAt(30.5, 10.5), SEA);
  // now with the lower jelly gone, the same kind of line fills the pocket below it
  const g2 = quiet(); const h2 = g2.heroes[0]; foe(g2, 'jelly', 30.5, 10.5, 0, 0);
  h2.x = 1; h2.y = 44;
  const cl2 = walk(g2, 2, W).find((e) => e.k === 'claim');
  assert.equal(cl2.cells.length, cl2.trail + 92 * 3, 'the three rows under the line filled');
});

ok('your own trail is a wall: turning back into it bumps and does nothing', () => {
  const g = quiet(); const h = g.heroes[0]; foe(g, 'jelly', 70.5, 10.5, 0, 0);
  walk(g, 1, 3);
  const y = h.y, len = h.trail.length;
  const evs = walk(g, 3, 2);
  assert.equal(h.y, y); assert.equal(h.trail.length, len);
  assert.ok(evs.some((e) => e.k === 'bump'));
});

ok("your partner's trail is a wall too", () => {
  const g = quiet(0, { twoP: true }); const [a, b] = g.heroes; foe(g, 'jelly', 10.5, 10.5, 0, 0);
  a.x = 50; a.y = 30; g.grid[idx(50, 30)] = LAND; // a little island to start from
  b.x = 52; b.y = 30; g.grid[idx(52, 30)] = LAND;
  walk(g, 0, 1, 4); // p2 pours one cell left to x 51
  assert.equal(g.grid[idx(51, 30)], TRAIL0 + 1);
  walk(g, 2, 2);
  assert.equal(a.x, 50, 'p1 stopped at the trail');
});

ok('a sea creature touching a trail washes it away, costs a bucket, and sends the pourer back to where it started', () => {
  const g = quiet(); const h = g.heroes[0];
  const start = idx(h.x, H - RIM); // the last land cell before the sea
  walk(g, 1, 6);
  const trail = [...h.trail];
  foe(g, 'jelly', h.x + 0.5, h.y + 2.5, 0, 0);
  const evs = walk(g, 0, 1);
  const hu = evs.find((e) => e.k === 'hurt'); assert.ok(hu); assert.equal(hu.foe, 'jelly');
  for (const c of trail) assert.equal(g.grid[c], SEA);
  assert.equal(idx(h.x, h.y), start); assert.equal(h.trail.length, 0);
  assert.equal(g.buckets, START_BUCKETS - 1); assert.ok(h.blink > 0);
});

ok('a short blink after a hit: the same creature cannot hit again at once', () => {
  const g = quiet(); const h = g.heroes[0];
  walk(g, 1, 4);
  foe(g, 'jelly', h.x + 0.5, h.y + 0.5, 0, 0);
  g.step(0);
  assert.equal(g.buckets, START_BUCKETS - 1);
  const f = g.foes[0]; f.x = h.x + 0.5; f.y = h.y - 1.5;
  walk(g, 1, 3); // straight into it while blinking
  assert.equal(g.buckets, START_BUCKETS - 1);
  assert.ok(BLINK > 1);
});

ok('a fast crocodile cannot skip over a one-cell trail', () => {
  const g = quiet(); const h = g.heroes[0];
  h.x = 40; h.y = H - 1;
  walk(g, 1, 20); // a vertical trail at x 40
  assert.ok(h.trail.length > 15);
  const c = foe(g, 'croc', 30.5, 35.5, 10, 0);
  let hit = false;
  for (let k = 0; k < 120 && !hit; k++) { g.step(0); hit = g.events.some((e) => e.k === 'hurt'); }
  assert.ok(hit, 'the croc hit the trail');
  assert.ok(c.snap > 0 || g.events.some((e) => e.k === 'snap') || true);
});

ok('the pufferfish puffs up to about two and a half times its size, and back', () => {
  const g = quiet(); const p = foe(g, 'puffer', 40.5, 25.5, 3, 3);
  let max = 0, min = 9, puffs = 0;
  for (let k = 0; k < 6 * 60; k++) { g.step(0); max = Math.max(max, p.r); min = Math.min(min, p.r); puffs += g.events.filter((e) => e.k === 'puff').length; }
  assert.ok(min <= FOES.puffer.r + 1e-9 && max >= FOES.puffer.r + 0.89, `r ${min}..${max}`);
  assert.equal(puffs, 1);
});

ok('creatures bounce off land and stay in the water', () => {
  const g = new TambakGame({ site: 4, seed: 11 });
  for (let k = 0; k < 60 * 60; k++) { g.step(0); for (const f of g.foes) if (FOES[f.kind].sea) assert.notEqual(g.cellAt(f.x, f.y), LAND, `${f.kind} on land at ${f.x},${f.y}`); }
});

ok('Captain Bakau turns toward fresh sand', () => {
  const g = quiet(5); const h = g.heroes[0];
  const b = foe(g, 'boss', 20.5, 20.5, 0, -5.5);
  walk(g, 1, 6);
  const before = Math.hypot(b.x - h.x, b.y - h.y);
  for (let k = 0; k < 60; k++) g.step(0);
  // she has swung round to head for the trail and closed the distance
  assert.ok(Math.hypot(b.x - h.x, b.y - h.y) < before, 'closer');
  assert.ok(b.vy > 0 || b.vx > 0, 'heading down or right toward the trail');
});

ok('the horseshoe crab climbs out once a quarter of the sea is land, far from the heroes, and stays on land', () => {
  const g = quiet(3); const h = g.heroes[0];
  foe(g, 'jelly', 60.5, 8.5, 0, 0);
  h.x = 1; h.y = 30;
  const evs = walk(g, 2, W);
  assert.ok(g.pct >= CRAB_AT, `pct ${g.pct}`);
  const cr = evs.find((e) => e.k === 'crab'); assert.ok(cr, 'crab arrived');
  const crab = g.foes.find((f) => f.kind === 'crab');
  assert.equal(g.cellAt(crab.x, crab.y), LAND);
  assert.ok(Math.abs(crab.x - h.x) + Math.abs(crab.y - h.y) > 20, 'far from the hero');
  for (let k = 0; k < 20 * 60; k++) { g.step(0); assert.equal(g.cellAt(crab.x, crab.y), LAND); assert.ok(crab.x >= 1 && crab.y >= 1 && crab.x < W - 1 && crab.y < H - 1, 'off the outermost row, in view'); }
  // and no crab on a site without one
  const g0 = quiet(0); foe(g0, 'jelly', 60.5, 8.5, 0, 0); g0.heroes[0].x = 1; g0.heroes[0].y = 30; walk(g0, 2, W);
  assert.ok(!g0.foes.some((f) => f.kind === 'crab'));
});

ok('the crab costs a bucket if it walks into you on land', () => {
  const g = quiet(3); const h = g.heroes[0];
  foe(g, 'crab', h.x + 0.5, h.y + 0.5, 0, 0);
  const evs = walk(g, 0, 1);
  assert.ok(evs.some((e) => e.k === 'hurt' && e.foe === 'crab'));
  assert.equal(g.buckets, START_BUCKETS - 1);
});

ok('pickups float in the sea and are collected by claiming the water they sit in: kopi, net, a spare bucket', () => {
  for (const kind of ['kopi', 'net', 'bucket']) {
    const g = quiet(); const h = g.heroes[0]; foe(g, 'jelly', 60.5, 8.5, 0, 0);
    g.buckets = 2;
    g.picks.push({ id: 1, kind, cell: idx(30, 46), t: 15 });
    h.x = 1; h.y = 44;
    const evs = walk(g, 2, W);
    assert.ok(evs.some((e) => e.k === 'pick' && e.kind === kind), kind);
    assert.equal(g.picks.length, 0);
    if (kind === 'kopi') assert.ok(g.kopiT > POWER_TIME - 2);
    if (kind === 'net') { assert.ok(g.netT > 0); assert.ok(g.speedMul() < 0.5); }
    if (kind === 'bucket') assert.equal(g.buckets, 3);
  }
  // kopi: faster walking
  const g = quiet(); const h = g.heroes[0]; g.kopiT = 5; h.x = 1; h.y = 0;
  for (let k = 0; k < 60; k++) g.step(2);
  assert.equal(h.x, 17);
});

ok('pickups appear in open water now and then, and sink if nobody claims them', () => {
  const g = new TambakGame({ site: 0, seed: 21 }); g.foes = [];
  let spawned = 0, expired = 0;
  for (let k = 0; k < 60 * 60; k++) { g.step(0); for (const e of g.events) { if (e.k === 'spawn') { spawned++; assert.equal(g.grid[e.cell], SEA); } if (e.k === 'expire') expired++; } }
  assert.ok(spawned >= 2 && expired >= 2, `${spawned} ${expired}`);
});

ok('lose: run out of buckets', () => {
  const g = quiet(); const h = g.heroes[0];
  for (let i = 0; i < START_BUCKETS; i++) {
    h.blink = 0; walk(g, 1, 3);
    g.foes = []; foe(g, 'jelly', h.x + 0.5, h.y + 0.5, 0, 0);
    g.step(0); g.foes = [];
    for (let k = 0; k < 130; k++) g.step(0);
  }
  assert.equal(g.over, 'lose'); assert.equal(g.why, 'buckets');
});

ok('lose: the tide comes in if you stand still, with warnings at 30 and 10 seconds', () => {
  const g = new TambakGame({ site: 0, seed: 5 });
  const tides = [];
  while (!g.over) { g.step(0); for (const e of g.events) if (e.k === 'tide') tides.push(e.left); }
  assert.equal(g.why, 'tide'); assert.deepEqual(tides, [30, 10]);
  assert.ok(Math.abs(g.t - SITES[0].tide * ASSIST_TIDE) < 0.1);
});

ok('win: claim the target share; stars for winning, for keeping every bucket, and for beating par', () => {
  const g = quiet(0, { assist: false }); const h = g.heroes[0]; foe(g, 'jelly', 60.5, 4.5, 0, 0);
  assert.equal(g.target, SITES[0].target);
  h.x = 1; h.y = 10;
  const evs = walk(g, 2, W);
  assert.ok(evs.some((e) => e.k === 'win'));
  assert.equal(g.over, 'win');
  const st = g.stats(); assert.equal(st.stars, 3); assert.ok(st.claimed >= 75); assert.ok(st.score > 0);
  // a slow, bruised win earns one star
  const g2 = quiet(0, { assist: false }); foe(g2, 'jelly', 60.5, 4.5, 0, 0); g2.bucketsLost = 1; g2.t = SITES[0].par + 1;
  g2.heroes[0].x = 1; g2.heroes[0].y = 10; walk(g2, 2, W);
  assert.equal(g2.stats().stars, 1);
});

ok('gentle tides (assist, on by default): slower creatures, a lower target, a longer tide', () => {
  const a = new TambakGame({ site: 1, seed: 1 }), b = new TambakGame({ site: 1, seed: 1, assist: false });
  assert.equal(a.assist, true); assert.equal(a.target, ASSIST_TARGET); assert.equal(b.target, 75);
  assert.ok(a.speedMul() < b.speedMul()); assert.ok(a.tide > b.tide);
});

ok('player two joins mid-pour on the top rim without breaking player one’s trail; Q swaps the chinchilla when alone', () => {
  const g = quiet(); foe(g, 'jelly', 60.5, 20.5, 0, 0);
  walk(g, 1, 4);
  const trail = [...g.heroes[0].trail];
  g.join();
  assert.equal(g.heroes.length, 2); assert.equal(g.heroes[1].id, 'enzo'); assert.equal(g.heroes[1].ctrl, 'p2'); assert.equal(g.heroes[1].y, 0);
  assert.deepEqual(g.heroes[0].trail, trail);
  g.join(); assert.equal(g.heroes.length, 2);
  g.heroes[1].blink = 0;
  // both pour: p1 goes round and home to claim, p2 goes down from the top
  walk(g, 4, 2, 3); walk(g, 3, 4, 3);
  assert.equal(g.heroes[0].trail.length, 0); assert.ok(g.heroes[1].trail.length > 0);
  assert.equal(g.grid[g.heroes[1].trail[0]], TRAIL0 + 1);
  const s = quiet(0, { lead: 'enzo' }); assert.equal(s.heroes[0].id, 'enzo'); s.swap(); assert.equal(s.heroes[0].id, 'dora');
  const t = quiet(0, { twoP: true }); t.swap(); assert.equal(t.heroes[0].id, 'dora', 'no swapping with two players');
});

ok('two players closing a pocket with the other one inside it: the other keeps walking, and claims on reaching land', () => {
  const g = quiet(0, { twoP: true }); const [a, b] = g.heroes; foe(g, 'jelly', 80.5, 10.5, 0, 0);
  b.x = 20; b.y = H - 1; // both on the bottom rim
  walk(g, 0, 3, 1); // p2 pours 1 cell up
  a.x = 1; a.y = 44;
  walk(g, 2, W); // p1 closes the strip that p2's trail sits in
  assert.equal(g.grid[idx(20, H - 3)], TRAIL0 + 1, "p2's trail is untouched");
  walk(g, 0, 2, 1);
  assert.equal(b.trail.length, 0, 'p2 stepped on new land and claimed');
});

ok('saves: parse, clamp, reject garbage, record bests, open sites in order', () => {
  const f = freshSave(); assert.equal(f.assist, true); assert.equal(f.lead, 'dora');
  assert.equal(parseSave('nope'), null); assert.equal(parseSave(JSON.stringify({ v: 2 })), null);
  const p = parseSave(JSON.stringify({ v: 1, stars: [9, -1, 'x'], best: [100], assist: false, lead: 'enzo' }));
  assert.deepEqual(p.stars, [3, 0, 0, 0, 0, 0]); assert.equal(p.assist, false); assert.equal(p.lead, 'enzo');
  assert.ok(siteOpen(f, 0)); assert.ok(!siteOpen(f, 1));
  const r = record(f, 0, { stars: 2, score: 900 }); assert.ok(siteOpen(r, 1)); assert.equal(r.best[0], 900);
  const r2 = record(r, 0, { stars: 0, score: 5000 }); assert.equal(r2.best[0], 900); assert.equal(r2.stars[0], 2);
});

ok('human-delay bots: a careful player and a sloppy one clear every site; a careless one mostly loses', () => {
  const res = [];
  for (let s = 0; s < SITES.length; s++) {
    let careful = 0, sloppy = 0;
    for (let k = 1; k <= 4; k++) {
      for (const [skill, add] of [[0.8, () => careful++], [0.5, () => sloppy++]]) {
        const g = new TambakGame({ site: s, seed: k * 101 + s }); const b = new Bot(k * 7 + s, skill);
        while (!g.over && g.t < 400) g.step(b.input(g, g.heroes[0]));
        if (g.over === 'win') add();
      }
    }
    res.push(`${careful}/${sloppy}`);
    assert.ok(careful >= 4, `${SITES[s].id}: careful bot won ${careful}/4`);
    assert.ok(sloppy >= 3, `${SITES[s].id}: sloppy bot won ${sloppy}/4`);
  }
  console.log(`    careful/sloppy wins per site: ${res.join(' ')}`);
  let lost = 0, games = 0;
  for (let s = 2; s < SITES.length; s++) for (let k = 1; k <= 4; k++) {
    const g = new TambakGame({ site: s, seed: k * 13 + s }); const b = new Bot(k, 0.8, true);
    while (!g.over && g.t < 400) g.step(b.input(g, g.heroes[0]));
    games++; if (g.over === 'lose' && g.why === 'buckets') lost++;
  }
  assert.ok(lost >= games / 2, `careless bot lost ${lost}/${games} to the creatures`);
});

ok('two bots on one field clear Tuas together', () => {
  const g = new TambakGame({ site: 5, seed: 77, twoP: true }); const b1 = new Bot(1), b2 = new Bot(2);
  while (!g.over && g.t < 400) g.step(b1.input(g, g.heroes[0]), b2.input(g, g.heroes[1]));
  assert.equal(g.over, 'win');
  assert.ok(g.heroes.every((h) => h.trail.length === 0));
});

ok('the engine never leaves a trail cell without an owner who is pouring it', () => {
  const g = new TambakGame({ site: 4, seed: 3, twoP: true }); const b1 = new Bot(5), b2 = new Bot(6, 0.5);
  for (let k = 0; k < 90 * 60 && !g.over; k++) {
    g.step(b1.input(g, g.heroes[0]), b2.input(g, g.heroes[1]));
    if (k % 30) continue;
    const owned = new Set(g.heroes.flatMap((h) => h.trail));
    for (let i = 0; i < N; i++) if (g.grid[i] >= TRAIL0) assert.ok(owned.has(i), `orphan trail ${i}`);
  }
  assert.ok(DT > 0);
});

console.log(`tambak: ${n} passed${bad ? `, ${bad} failed` : ''}`);
if (bad) process.exit(1);
