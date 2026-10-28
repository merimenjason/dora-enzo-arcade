// Seedstorm engine checks: exact replays, the hitbox and grazing, Bloom and the last-gasp Bloom, hearts, game over and
// continues, the pools, seeds and the Breeze multiplier, the shop, the stage timelines and bosses, practice, and saving.
import assert from 'node:assert/strict';
import {
  SeedstormGame, W, H, HZ, HITBOX, GRAZE, START, BOUNDS, FOCUS_SLOW, CAPS, INVULN, LAST_GASP, HIT_CLEAR, BLOOM, BREEZE, SEED, SCORE,
  PILOTS, DIFFS, DIFF_IDS, UPGRADES, UP_IDS, HEART_CAP, STAGES, STAGE_COUNT, BOSSES, CRITTERS, LOOK, HUE, THEN, idleInput, moveBullet, pathAt,
  readSave, freshSave, recordScore, noteReached, practiceUpTo, speakerName, SAVE_KEY, TOP,
} from '../.checks/seedstorm-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`);

/** A quiet game: the timeline is switched off, nothing on screen, and the pilot can be hit straight away. */
function lab({ pilot = 'dora', diff = 'gusty', seed = 7 } = {}) {
  const g = new SeedstormGame({ seed, pilot, diff });
  g.next = g.def.timeline.length; g.player.invuln = 0; g.events.length = 0;
  return g;
}
const steps = (g, n, input = () => idleInput()) => { for (let i = 0; i < n && g.phase === 'play'; i++) g.step(input(i)); };
const kinds = (g) => g.events.map((e) => e.k);
const live = (pool) => pool.filter((x) => x.on).length;

// ---- replays
{
  const drive = (i) => ({ dx: Math.sign(Math.sin(i * 0.013)), dy: Math.sign(Math.cos(i * 0.007)) * (i % 300 < 150 ? 1 : 0), focus: i % 500 > 380, bloom: i === 1400 || i === 2600, tx: null, ty: null });
  const run = (seed) => { const g = new SeedstormGame({ seed, pilot: 'enzo', diff: 'gusty' }); for (let i = 0; i < 3000; i++) { if (g.phase === 'chat') g.skipChat(); if (g.phase === 'over') g.continueRun(); g.step(drive(i)); } return g; };
  const a = run(42), b = run(42);
  eq(a.hash(), b.hash(), 'the same seed and inputs give the same state after 3,000 ticks');
  ok(a.tick > 2900 && a.hash() !== run(43).hash(), `the replayed run really played (${a.tick} ticks, score ${a.score})`);
  const w1 = new SeedstormGame({ seed: 3, pilot: 'dora', diff: 'gusty' }), w2 = new SeedstormGame({ seed: 3, pilot: 'dora', diff: 'gusty' });
  w1.warp(5); w2.warp(5);
  for (let i = 0; i < 2000; i++) { if (w1.phase === 'chat') w1.skipChat(); if (w2.phase === 'chat') w2.skipChat(); w1.step(drive(i)); w2.step(drive(i)); }
  eq(w1.hash(), w2.hash(), 'a boss fight replays exactly too');
}

// ---- moving
{
  const g = lab({ pilot: 'dora' });
  g.step({ ...idleInput(), dx: 1 }); near(g.player.x - START.x, PILOTS.dora.speed, 1e-9, 'Dora moves her speed a tick');
  const x = g.player.x; g.step({ ...idleInput(), dx: 1, focus: true }); near(g.player.x - x, PILOTS.dora.speed * FOCUS_SLOW, 1e-9, 'focus slows to 45%');
  const y = g.player.y, x2 = g.player.x; g.step({ ...idleInput(), dx: 1, dy: -1 }); near(Math.hypot(g.player.x - x2, g.player.y - y), PILOTS.dora.speed, 1e-9, 'diagonals are no faster');
  const e = lab({ pilot: 'enzo' }); e.step({ ...idleInput(), dx: -1 }); near(START.x - e.player.x, PILOTS.enzo.speed, 1e-9, 'Enzo is steadier');
  ok(PILOTS.dora.speed > PILOTS.enzo.speed, 'Dora is the faster pilot');
  const t = lab(); t.step({ ...idleInput(), tx: START.x + 100, ty: START.y }); near(t.player.x - START.x, PILOTS.dora.speed, 1e-9, 'a touch target is chased at flying speed');
  t.step({ ...idleInput(), tx: t.player.x + 1, ty: START.y }); near(t.player.x - START.x, PILOTS.dora.speed + 1, 1e-9, 'and reached exactly when close');
  for (let i = 0; i < 200; i++) t.step({ ...idleInput(), dx: -1, dy: 1 });
  eq([t.player.x, t.player.y], [BOUNDS.x0, BOUNDS.y1], 'the pilot stays inside the field');
  const n = lab(); n.step({ ...idleInput(), dx: NaN, dy: Infinity }); eq([n.player.x, n.player.y], [START.x, START.y], 'broken input is ignored');
  const f = lab(); f.step({ ...idleInput(), focus: true }); for (let i = 0; i < 40; i++) f.step({ ...idleInput(), focus: true });
  ok(Math.abs(f.wing.x - f.player.x) < 1 && f.wing.y < f.player.y, 'focus pulls the wingmate in front');
  const u = lab(); for (let i = 0; i < 40; i++) u.step(); ok(u.wing.y > u.player.y && u.wing.x < u.player.x, 'otherwise Enzo trails behind Dora, to one side');
}

// ---- shots
{
  const g = lab({ pilot: 'dora' }); g.tick = 4; g.step(); ok(live(g.shots) === 3, `Dora fires a 3-petal spread at Shot Power 1 (${live(g.shots)})`);
  g.ups.power = 4; g.tick = 9; g.step(); ok(live(g.shots) === 3 + 9, 'nine petals at Shot Power 4');
  for (let i = 0; i < 15; i++) g.step(); ok(g.shots.some((s) => s.on && s.kind === 2), 'and the wingmate’s homing seed every fifth volley');
  const e = lab({ pilot: 'enzo' }); e.tick = 4; e.step(); ok(live(e.shots) === 2, 'Enzo’s lance is two pebbles at Shot Power 1');
  // pierce: a pebble passes through a small critter and hits the one behind
  const p = lab({ pilot: 'enzo' });
  p['addCritter']('kite', { k: 'drift', x: START.x, vx: 0, vy: 0, amp: 0, f: 0 }, null); p['addCritter']('beetle', { k: 'drift', x: START.x, vx: 0, vy: 0, amp: 0, f: 0 }, null);
  const [kite, beetle] = p.critters.filter((c) => c.on); kite.path = { k: 'stop', sx: START.x, tx: START.x, ty: 300, enter: 1, stay: 1e9, exit: 'up' }; beetle.path = { ...kite.path, ty: 200 };
  kite.hp = 1000; beetle.hp = 1000;
  p['addShot'](START.x, 330, 0, -12, 1.45, 1, true);
  for (let i = 0; i < 20; i++) p['moveShots'](), p['moveCritters']();
  ok(kite.hp < 1000 && beetle.hp < 1000, 'Enzo’s pebble pierces a small kite and still reaches the beetle');
  const d = lab({ pilot: 'dora' });
  d['addCritter']('kite', kite.path, null); d['addCritter']('beetle', beetle.path, null);
  const [k2, b2] = d.critters.filter((c) => c.on); k2.hp = 1000; b2.hp = 1000;
  d['addShot'](START.x, 330, 0, -10, 1, 0, false);
  for (let i = 0; i < 20; i++) d['moveShots'](), d['moveCritters']();
  ok(k2.hp < 1000 && b2.hp === 1000, 'Dora’s petal stops at the first critter');
}

// ---- hitbox, grazes, invulnerability, hearts
{
  const g = lab(), m0 = g.meter, s0 = g.score;
  const b = g.shoot(START.x + 10, 400, Math.PI / 2, 4, LOOK.seed, HUE.gold);
  steps(g, 70);
  ok(g.grazes === 1 && g.hearts === 3, `a bullet passing 10 units away grazes and doesn't hit (${g.grazes})`);
  near(g.meter - m0, BLOOM.graze, 1e-9, 'a graze fills the Bloom meter'); ok(g.score - s0 >= SCORE.graze, 'and scores');
  ok(!b.on, 'the bullet flew off the bottom and went back to the pool');
  const g2 = lab(); g2.shoot(START.x + 10, 400, Math.PI / 2, 4, LOOK.seed, HUE.gold); g2.shoot(START.x + 10, 380, Math.PI / 2, 4, LOOK.seed, HUE.gold);
  steps(g2, 80); ok(g2.grazes === 2, 'each bullet grazes once');
  const g3 = lab(); g3.shoot(START.x + GRAZE + 1, 400, Math.PI / 2, 4, LOOK.seed, HUE.gold); steps(g3, 80); ok(g3.grazes === 0, `beyond ${GRAZE} units is not a graze`);
  // the hit radius is the bullet plus the 2.5 hitbox: 5.6 units apart misses a seed (3.2), 5.6 - 0.2 hits
  const g4 = lab(); g4.shoot(START.x + 3.2 + HITBOX + 0.1, 400, Math.PI / 2, 4, LOOK.seed, HUE.gold); steps(g4, 80);
  ok(g4.hearts === 3 && g4.grazes === 1, 'just outside the hitbox only grazes');
  const g5 = lab(); g5.shoot(START.x + 3.2 + HITBOX - 0.2, 400, Math.PI / 2, 4, LOOK.seed, HUE.gold);
  let gasped = -1; for (let i = 0; i < 80; i++) { g5.step(); if (gasped < 0 && g5.player.gasp > 0) gasped = i; if (g5.hearts < 3) break; }
  ok(gasped >= 0 && g5.hearts === 2, 'just inside the hitbox is a hit');
  ok(g5.player.invuln === INVULN.hit - 1 && g5.events.some((e) => e.k === 'hit'), 'a hit gives two seconds of invulnerability');
  // nearby bullets are cleared, far ones aren't
  const g6 = lab(); g6.shoot(START.x, 300, Math.PI / 2, 4, LOOK.seed, HUE.gold);
  const close = g6.shoot(START.x + 60, START.y, -Math.PI / 2, 0.01, LOOK.seed, HUE.gold), far = g6.shoot(START.x + HIT_CLEAR + 30, 100, 0, 0.01, LOOK.seed, HUE.gold);
  for (let i = 0; i < 120 && g6.hearts === 3; i++) g6.step();
  ok(!close.on && far.on, 'losing a heart clears bullets near the pilot only');
  // invulnerable: a bullet passes through
  const inv = g6.player.invuln; g6.shoot(g6.player.x, g6.player.y - 30, Math.PI / 2, 3, LOOK.seed, HUE.gold); steps(g6, 30);
  ok(g6.hearts === 2 && inv > 30, 'while blinking, bullets pass straight through');
  steps(g6, INVULN.hit); ok(g6.player.invuln === 0, 'the blinking wears off');
  // critter bodies hurt
  const g7 = lab(); g7['addCritter']('beetle', { k: 'stop', sx: START.x, tx: START.x, ty: START.y, enter: 1, stay: 1e9, exit: 'up' }, null); g7.critters.find((c) => c.on).hp = 1e9;
  steps(g7, 20); ok(g7.hearts === 2, 'bumping into a critter costs a heart');
}

// ---- Bloom, and the last-gasp Bloom
{
  const g = lab();
  for (let i = 0; i < 60; i++) g.shoot(20 + i * 5, 100 + (i % 7) * 20, Math.PI / 2, 0.3, LOOK.petal, HUE.pink);
  const seeds0 = live(g.seeds);
  g.step({ ...idleInput(), bloom: true });
  ok(g.blooms === BLOOM.start - 1 && kinds(g).includes('bloom'), 'Bloom spends one');
  ok(g.player.invuln >= INVULN.bloom - 1, 'and gives three seconds of invulnerability');
  steps(g, BLOOM.sweep);
  ok(g.bulletCount === 0, 'the petal ring clears every bullet on screen');
  ok(live(g.seeds) - seeds0 === 60, `and turns each into a seed (${live(g.seeds) - seeds0})`);
  g.step({ ...idleInput(), bloom: true }); g.step({ ...idleInput(), bloom: true });
  ok(g.blooms === BLOOM.start - 2, 'holding the button only Blooms once');
  const e = lab(); e.blooms = 0; e.step({ ...idleInput(), bloom: true }); ok(!kinds(e).includes('bloom'), 'no Bloom without one in hand');
  // a Bloom damages critters
  const c = lab(); c['addCritter']('bumble', { k: 'stop', sx: 100, tx: 100, ty: 100, enter: 1, stay: 1e9, exit: 'up' }, null); c.step(); c.step({ ...idleInput(), bloom: true });
  ok(c.critterCount === 0, 'Bloom puffs small critters');
  // last gasp: Bloom within LAST_GASP ticks of a hit cancels it
  for (const late of [0, LAST_GASP - 1, LAST_GASP]) {
    const l = lab(); l.shoot(START.x, START.y - 20, Math.PI / 2, 4, LOOK.seed, HUE.gold);
    let t = 0; while (l.player.gasp === 0 && t++ < 30) l.step();
    ok(l.player.gasp === LAST_GASP, 'a hit opens the last-gasp window');
    for (let i = 0; i < late; i++) l.step();
    l.step({ ...idleInput(), bloom: true }); steps(l, 20);
    if (late < LAST_GASP) ok(l.hearts === 3 && l.blooms === BLOOM.start - 1, `a Bloom ${late} ticks after the hit cancels it`);
    else ok(l.hearts === 2, 'after the window the heart is lost');
  }
  // the meter: a full meter is a Bloom, up to the cap
  const m = lab(); m.blooms = 0; m['addMeter'](BLOOM.meter * 2.5); ok(m.blooms === 2 && Math.abs(m.meter - BLOOM.meter * 0.5) < 1e-9, 'a full meter adds a Bloom');
  m['addMeter'](BLOOM.meter * 5); ok(m.blooms === m.bloomCap && m.meter === BLOOM.meter, 'at the cap the meter waits, full');
  m.step({ ...idleInput(), bloom: true }); ok(m.blooms === m.bloomCap && m.meter === 0, 'and turns into a Bloom as soon as there is room');
}

// ---- game over and continues
{
  const g = lab(); g.hearts = 1; g.score = 1234; g.shoot(START.x, START.y - 20, Math.PI / 2, 4, LOOK.seed, HUE.gold);
  steps(g, 40);
  ok(g.phase === 'over' && g.hearts === 0, 'losing the last heart ends the run');
  const t = g.tick; g.step(); ok(g.tick === t, 'nothing moves after the run ends');
  ok(g.canContinue && g.continueRun(), 'Gusty offers a continue');
  ok(g.phase === 'play' && g.hearts === DIFFS.gusty.hearts && g.score === 0 && g.continues === 1, 'a continue refills the hearts, resets the score and counts');
  const s = lab({ diff: 'stormy' }); s.hearts = 1; s.shoot(START.x, START.y - 20, Math.PI / 2, 4, LOOK.seed, HUE.gold); steps(s, 40);
  ok(s.phase === 'over' && !s.canContinue && !s.continueRun(), 'Stormy has no continues');
  eq(new SeedstormGame({ seed: 1, pilot: 'dora', diff: 'breezy' }).hearts, 5, 'Breezy starts with five hearts');
}

// ---- pools
{
  const g = lab();
  let made = 0; for (let i = 0; i < 1000; i++) if (g.shoot(180, 100, i, 0.1, LOOK.seed, HUE.gold)) made++;
  ok(made === CAPS.bullets && g.bulletCount === CAPS.bullets && live(g.bullets) === CAPS.bullets, `the bullet pool stops at ${CAPS.bullets}`);
  g.step({ ...idleInput(), bloom: true }); steps(g, BLOOM.sweep + 5);
  ok(g.bulletCount === 0 && live(g.seeds) <= CAPS.seeds && g.seedCount === live(g.seeds), 'a Bloom on a full pool overflows seeds safely');
  ok(g.purse + g.seedCount >= CAPS.bullets - 5, 'seeds that don’t fit are collected at once');
  made = 0; for (let i = 0; i < CAPS.bullets; i++) if (g.shoot(180, 100, i, 0.1, LOOK.seed, HUE.gold)) made++;
  ok(made === CAPS.bullets, 'every slot comes back to the pool');
  // the busiest boss, never hit, for a long while
  for (const diff of DIFF_IDS) {
    const s = new SeedstormGame({ seed: 9, pilot: 'dora', diff }); s.warp(5); let peak = 0;
    for (let i = 0; i < 8000 && s.phase !== 'won'; i++) {
      if (s.phase === 'chat') s.skipChat();
      s.player.invuln = 99; s.step({ ...idleInput(), dx: Math.sin(i * 0.02) });
      peak = Math.max(peak, s.bulletCount);
      assert.ok(s.bulletCount === live(s.bullets) && s.bulletCount <= CAPS.bullets && s.seedCount <= CAPS.seeds && s.shotCount <= CAPS.shots && s.critterCount <= CAPS.critters);
    }
    ok(peak > 100, `the Grumble Storm fills the sky on ${diff} without breaking the pools (peak ${peak})`);
  }
}

// ---- seeds and Breeze
{
  const g = lab();
  g['addSeed'](START.x + 30, START.y - 10, 0, 0, false, 0);
  steps(g, 30); ok(g.seedCount === 0 && g.purse === SEED.purse, 'a seed within the magnet is pulled in and collected');
  g['addSeed'](40, 200, 0, 0, false, 0); steps(g, 30); ok(g.seedCount === 1, 'a far seed just drifts');
  for (let i = 0; i < 200 && g.player.y > SEED.top - 5; i++) g.step({ ...idleInput(), dy: -1 });
  steps(g, 60); ok(g.seedCount === 0 && g.purse === 2 * SEED.purse, 'flying into the top quarter calls every seed');
  const h = lab(); h['addSeed'](40, 100, 0, 0, false, 24); steps(h, 120); ok(h.seedCount === 0, 'Bloom seeds fly home on their own');
  const f = lab(); f['addSeed'](40, 600, 0, 0, false, 0); steps(f, 200); ok(f.seedCount === 0 && f.purse === 0, 'missed seeds fall away');
  const mg = lab(); mg.ups.magnet = 2; mg['addSeed'](START.x + SEED.pull + 30, START.y, 0, 0, false, 0); steps(mg, 30); ok(mg.purse === 1, 'Magnet Paws pull from further away');
  // Breeze: kills within 1.5 s chain it up, then it decays back to 1
  const b = lab(); const kill = () => { b['addCritter']('kite', { k: 'stop', sx: 40, tx: 40, ty: 50, enter: 1, stay: 1e9, exit: 'up' }, null); b['puff'](b.critters.find((c) => c.on)); };
  kill(); eq(b.breeze, 1, 'the first kill starts a chain');
  for (let i = 0; i < 10; i++) { steps(b, 30); kill(); }
  near(b.breeze, 1 + 10 * BREEZE.step, 1e-9, 'ten chained kills raise Breeze by 1.0');
  const sc = b.score; b['collect'](0, 0, false); ok(b.score - sc === Math.round(SEED.score * b.breeze), 'seeds score times Breeze');
  steps(b, BREEZE.window + 20); ok(b.breeze < 2 && b.breeze > 1, 'it decays when the chain breaks');
  steps(b, 600); eq(b.breeze, 1, 'down to 1');
  for (let i = 0; i < 80; i++) { b.tick++; kill(); } eq(b.breeze, BREEZE.max, 'Breeze tops out at ×5');
}

// ---- the shop
{
  const g = lab(); g.phase = 'shop'; g.purse = 1e6;
  const prices = []; while (g.canBuy('power') === 'ok') { prices.push(g.price('power')); g.buy('power'); }
  eq(g.ups.power, UPGRADES.power.max, 'Shot Power goes up to 4'); eq(g.canBuy('power'), 'max', 'and stops there');
  ok(prices.every((p, i) => i === 0 || p > prices[i - 1]), `prices rise per purchase (${prices.join(', ')})`);
  eq(prices[0], UPGRADES.power.base, 'the first costs the base price');
  while (g.buy('wings')); eq(g.ups.wings, 3, 'Wingmate Wings max 3');
  while (g.buy('magnet')); eq(g.ups.magnet, 2, 'Magnet Paws max 2');
  while (g.buy('pouch')); eq(g.ups.pouch, 4, 'Bloom Pouch max 4'); eq(g.bloomCap, BLOOM.cap + 4, 'each pouch carries one more Bloom');
  ok(g.buy('heart') && g.hearts === 4, 'an Extra Heart'); eq(g.canBuy('heart'), 'once', 'only once per shop');
  const poor = lab(); poor.phase = 'shop'; poor.purse = 10; eq(poor.canBuy('magnet'), 'poor', 'too few seeds'); ok(!poor.buy('magnet') && poor.purse === 10, 'buying fails cleanly');
  eq(lab().canBuy('power'), 'closed', 'the shop is shut mid-flight');
  g.leaveShop(); ok(g.stage === 2 && g.phase === 'play', 'leaving the shop starts the next stage');
  g.phase = 'shop'; ok(g.buy('heart'), 'the next shop sells a heart again');
  const full = lab(); full.phase = 'shop'; full.purse = 1e7; full.hearts = HEART_CAP; eq(full.canBuy('heart'), 'max', `hearts stop at ${HEART_CAP}`);
}

// ---- stages, bosses, chats
{
  eq(STAGES.length, 5, 'five stages');
  for (const s of STAGES) {
    const tl = s.timeline, last = tl[tl.length - 1];
    ok(last.k === 'boss' && last.boss === s.boss, `${s.name} ends with its boss`);
    ok(tl.filter((e) => e.k === 'boss').length === 1 && tl.filter((e) => e.k === 'mid').length === 1, `${s.name} has one mid-boss and one boss`);
    ok(tl.every((e, i) => i === 0 || e.at >= tl[i - 1].at), `${s.name}'s timeline is in order`);
    const kinds = new Set(tl.filter((e) => e.k === 'spawn').map((e) => e.kind));
    ok([...kinds].every((k) => s.critters.includes(k)) && s.critters.every((k) => kinds.has(k)), `${s.name} flies its own critters (${[...kinds].join(', ')})`);
  }
  eq(STAGES.map((s) => s.boss), ['magpie', 'crow', 'cloud', 'owl', 'storm'], 'the five bosses in order');
  const names = new Set();
  for (const b of Object.values(BOSSES)) {
    ok(b.phases.length === (b.id === 'storm' ? 4 : b.mid ? 1 : 3), `${b.name} has ${b.phases.length} phases`);
    for (const ph of b.phases) { ok(typeof ph.name === 'string' && ph.name.length > 3 && ph.time >= 15 && ph.hp > 0, `${b.name}: “${ph.name}” has a name, ${ph.time} s and ${ph.hp} health`); names.add(ph.name); }
    if (!b.mid) ok(b.chat.length >= 2 && b.chat.length <= 4 && b.friends.length >= 1, `${b.name} chats before and makes friends after`);
  }
  eq(names.size, Object.values(BOSSES).reduce((n, b) => n + b.phases.length, 0), 'every attack has its own name');
  ok(['Button Barrage', 'Crabapple Cascade', 'Static Spiral', 'Moonmoth Waltz', 'Grumble Typhoon'].every((n) => names.has(n)), 'the named attacks are there');
  // a critter's path is a pure function of its age
  const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
  for (const e of STAGES[0].timeline) if (e.k === 'spawn') { pathAt(e.path, 77, a); pathAt(e.path, 77, b); assert.deepEqual(a, b); }
  ok(true, 'paths are pure');
}
{
  // a whole boss: arrival, the chat, phases, Clear Sky, the after-chat and the results
  const g = new SeedstormGame({ seed: 1, pilot: 'dora', diff: 'gusty' }); g.warp(1); const evs = [];
  for (let i = 0; i < 200 && g.phase === 'play'; i++) { g.step(); evs.push(...g.events.splice(0)); }
  ok(g.phase === 'chat' && g.chat.lines === BOSSES.magpie.chat && g.boss.y > 100, 'the boss flies in, then chats');
  ok(evs.some((e) => e.k === 'bossIn' && e.boss === 'magpie'), 'its arrival is announced');
  eq(speakerName(g, g.chat.lines[1].who, 'magpie'), 'Dora', 'the pilot speaks as Dora'); eq(speakerName(g, 'wing', 'magpie'), 'Enzo', 'the wingmate as Enzo');
  g.step(); ok(g.phase === 'chat' && g.tick === g.tick, 'the chat holds the game still');
  for (let i = 0; i < 10 && g.phase === 'chat'; i++) g.advanceChat();
  ok(g.phase === 'play' && g.boss.state === 'fight' && g.boss.phase === 0 && g.banner.text === 'Button Barrage', 'the last line starts the first attack, with its banner');
  ok(g.events.some((e) => e.k === 'phase' && e.name === 'Button Barrage'), 'events from a chat survive until read');
  eq(g.boss.timer, 40 * HZ, 'the phase timer starts full');
  // beat phase 1 cleanly
  g.events.length = 0; g.player.invuln = 1e9; const s0 = g.score; g['damageBoss'](1e6);
  const brk = g.events.find((e) => e.k === 'break');
  ok(brk && brk.clearSky > 0 && g.ss.clearSky === 1 && g.score - s0 === SCORE.phase + brk.clearSky, `beating a phase unhit earns Clear Sky (${brk.clearSky})`);
  for (let i = 0; i < 100 && g.boss.phase === 0; i++) g.step();
  ok(g.boss.phase === 1 && g.boss.state === 'fight', 'then the next attack');
  // phase 2: time out
  g.boss.hp = 1e9; g.events.length = 0; for (let i = 0; i < 50 * HZ && g.boss.phase === 1; i++) { g.step(); if (g.events.some((e) => e.k === 'break')) break; }
  const to = g.events.find((e) => e.k === 'break'); ok(to && to.timedOut && to.clearSky === 0, 'a timed-out phase ends with no bonus');
  for (let i = 0; i < 100 && g.boss.phase === 1; i++) g.step();
  // phase 3: hit, then beaten: no Clear Sky
  g.boss.hit = true; g.events.length = 0; g['damageBoss'](1e6); ok(g.events.find((e) => e.k === 'break').clearSky === 0, 'a hit during the phase loses Clear Sky');
  for (let i = 0; i < 400 && g.phase === 'play'; i++) g.step();
  ok(g.phase === 'chat' && g.chat.after && g.chat.lines === BOSSES.magpie.friends, 'the calmed boss makes friends');
  g.skipChat();
  ok(g.phase === 'shop' && g.results && g.results.stage === 1 && g.results.clearSky === 1 && g.results.phases === 2, 'then the stage results and the shop');
  ok(g.results.noHit && g.results.noHitBonus === SCORE.noHit && g.results.bloomBonus === g.blooms * SCORE.bloomLeft, 'no-hit and Bloom bonuses');
}
{
  // a mid-boss stops the stage clock, then flies home
  const g = new SeedstormGame({ seed: 1, pilot: 'enzo', diff: 'gusty' }); const at = STAGES[0].timeline.find((e) => e.k === 'mid').at;
  g.player.invuln = 1e9; let saw = false;
  for (let i = 0; i < at + 300; i++) { g.player.invuln = 99; g.step(); if (g.boss && g.boss.def.mid) saw = true; }
  ok(saw && g.boss && g.boss.def.id === 'bumbleQueen', 'Big Bumble arrives on time');
  const c = g.clock; g.step(); eq(g.clock, c, 'the stage clock waits for the mid-boss');
  g['damageBoss'](1e6); for (let i = 0; i < 300 && g.boss; i++) { g.player.invuln = 99; g.step(); } steps(g, 5);
  ok(!g.boss && g.clock > c, 'it flies off and the stage carries on');
}
{
  // practice: one stage, fresh hearts and default upgrades, and no high score
  const g = new SeedstormGame({ seed: 2, pilot: 'dora', diff: 'gusty', stage: 3, practice: true });
  ok(g.stage === 3 && g.hearts === 3 && g.ups.power === 1, 'practice starts the stage fresh');
  g.warp(3); for (let i = 0; i < 20000 && g.phase !== 'won'; i++) { if (g.phase === 'chat') g.skipChat(); g.player.invuln = 99; if (g.boss && g.boss.state === 'fight') g['damageBoss'](1e6); g.step(); }
  ok(g.phase === 'won' && g.results.stage === 3, 'clearing a practice stage ends the run');
  const s = freshSave(); eq(recordScore(s, g, 1), -1, 'practice runs don’t go on the table'); eq(s.reached.gusty, 0, 'nor count as reaching a stage');
}
{
  // a full run with an invulnerable pilot reaches the ending
  const g = new SeedstormGame({ seed: 5, pilot: 'enzo', diff: 'breezy' }), seen = [];
  for (let i = 0; i < HZ * 60 * 30 && g.phase !== 'won'; i++) {
    if (g.phase === 'chat') g.skipChat(); if (g.phase === 'shop') { seen.push(g.results.stage); g.leaveShop(); }
    g.player.invuln = 99; g.step({ ...idleInput(), dx: Math.sin(i * 0.01), focus: true });
  }
  ok(g.phase === 'won' && seen.join() === '1,2,3,4', `five stages end to end (${seen.join()}, ${(g.tick / HZ / 60).toFixed(1)} min)`);
}

// ---- difficulty
{
  const [b, gu, st] = DIFF_IDS.map((d) => DIFFS[d]);
  for (const k of ['speed', 'density', 'rate', 'bossHp']) ok(b[k] < gu[k] && gu[k] < st[k], `${k} rises from Breezy to Stormy`);
  ok(b.hearts >= gu.hearts && gu.hearts >= st.hearts, 'hearts never rise with difficulty');
  ok(b.continues && gu.continues && !st.continues, 'continues on Breezy and Gusty only');
  // the same pattern on each difficulty: more bullets, faster
  const counts = DIFF_IDS.map((d) => { const g = lab({ diff: d }); g.ring(180, 100, 20, 2, 0, LOOK.seed, HUE.gold); const b0 = g.bullets.find((x) => x.on); return [g.bulletCount, Math.hypot(b0.vx, b0.vy)]; });
  ok(counts[0][0] < counts[1][0] && counts[1][0] < counts[2][0] && counts[0][1] < counts[1][1] && counts[1][1] < counts[2][1], `rings get denser and faster (${counts.map((c) => c[0]).join(', ')})`);
  const hp = DIFF_IDS.map((d) => { const g = new SeedstormGame({ seed: 1, pilot: 'dora', diff: d }); g.warp(1); for (let i = 0; i < 200 && g.phase === 'play'; i++) g.step(); g.skipChat(); return g.boss.max; });
  ok(hp[0] < hp[1] && hp[1] < hp[2], `boss health rises (${hp.join(', ')})`);
}

// ---- bullet behaviours
{
  const mk = (o) => Object.assign({ on: true, i: 0, x: 100, y: 100, vx: 0, vy: 2, r: 3, look: 0, hue: 0, t: 0, acc: 0, minS: 0, maxS: 99, tc: 1, ts: 0, grav: 0, bounce: 0, at: 0, then: 0, thenSpd: 0, homeTil: 0, homeRate: 0, wav: 0, wavF: 0, grazed: false }, o);
  const b = mk({ acc: -0.1, at: 30, then: THEN.aim, thenSpd: 3 }); for (let i = 0; i < 29; i++) moveBullet(b, 300, 100);
  near(Math.hypot(b.vx, b.vy), 0, 1e-9, 'a burst bullet slows to a stop'); moveBullet(b, 300, 100); ok(Math.abs(Math.hypot(b.vx, b.vy) - 3) < 1e-9 && b.vx > 2.9, 'then turns to the pilot at its new speed');
  const f = mk({ vx: 1, vy: 0, at: 5, then: THEN.fall, thenSpd: 0.05 }); for (let i = 0; i < 60; i++) moveBullet(f, 0, 0); ok(f.vy > 2, 'hail stops, then falls faster and faster');
  const w = mk({ vx: -3, vy: 0, x: 4, bounce: 1 }); for (let i = 0; i < 4; i++) moveBullet(w, 0, 0); ok(w.vx > 0 && w.bounce === 0, 'a bouncing petal comes off the wall once');
  const h = mk({ vx: 0, vy: 2, homeTil: 200, homeRate: 0.05 }); for (let i = 0; i < 100; i++) moveBullet(h, 300, 100); ok(h.x > 150, 'a crabapple homes in');
}

// ---- saving
{
  eq(SAVE_KEY, 'seedstorm-v1', 'the save key');
  eq(readSave(null), freshSave(), 'no save gives the defaults');
  for (const bad of ['', 'nope', '[]', 'null', '42', '{"v":2}', JSON.stringify({ v: 1, scores: 'x', reached: { gusty: 'far' }, settings: 7 })]) {
    const s = readSave(bad); ok(s.reached.gusty === 0 && Array.isArray(s.scores.gusty) && s.settings.sound === true, `bad data is ignored: ${bad.slice(0, 30)}`);
  }
  const g = new SeedstormGame({ seed: 1, pilot: 'enzo', diff: 'stormy' }); g.warp(4); g.score = 5000;
  const s = freshSave(); s.settings.music = false; s.pilot = 'enzo'; s.diff = 'stormy';
  eq(recordScore(s, g, 1700000000000), 0, 'a first score goes to the top');
  eq(s.reached.stormy, 4, 'and the stage reached is remembered'); eq(practiceUpTo(s), 4, 'so stages 1 to 4 can be practised');
  for (let i = 1; i <= 6; i++) { g.score = 1000 * i; recordScore(s, g, 1700000000000 + i); }
  eq(s.scores.stormy.length, TOP, `only the top ${TOP} are kept`);
  eq(s.scores.stormy.map((e) => e.score), [6000, 5000, 5000, 4000, 3000], 'best first');
  g.score = 10; eq(recordScore(s, g, 1), -1, 'a low score doesn’t make the table');
  const back = readSave(JSON.stringify(s));
  eq(back, s, 'a save reads back exactly');
  const messy = JSON.parse(JSON.stringify(s)); messy.scores.stormy.push({ score: 'lots', pilot: 'fox' }, null, { score: 9e99, pilot: 'dora', stage: 99, date: -5 }); messy.reached.gusty = 77; messy.cleared.breezy = 'yes';
  const m = readSave(JSON.stringify(messy));
  ok(m.scores.stormy.length === TOP && m.scores.stormy[0].score === 1e9 && m.scores.stormy[0].stage === STAGE_COUNT && m.scores.stormy[0].date === 0, 'odd entries are dropped or clamped');
  ok(m.reached.gusty === STAGE_COUNT && m.cleared.breezy === false, 'other fields are clamped');
  const w = new SeedstormGame({ seed: 1, pilot: 'dora', diff: 'breezy' }); w.phase = 'won'; w.stage = 5; w.score = 99; const ws = freshSave(); recordScore(ws, w, 5);
  ok(ws.cleared.breezy && ws.scores.breezy[0].cleared, 'a cleared run is marked'); noteReached(ws, w); ok(ws.reached.breezy === 5, 'and reached stage 5');
}

console.log(`Seedstorm: ${checks} checks passed.`);
