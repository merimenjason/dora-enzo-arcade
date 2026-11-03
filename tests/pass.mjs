// Kumori Pass engine checks: the car model (determinism, the tyre curve, top speed per gear, braking distance, a drift
// held with counter-steer, upgrades that change the handling), guardrails, the road (progress, sides, finish, the
// reversed uphill leg, no road crossing itself), the touge duel rules (lead, chase, gap, overtake, crash, sudden death),
// Enzo's pace notes (severity numbers that match the real corner radius, levels that call earlier and say more), the bun
// tray, medals, ghosts replayed from inputs, the story ladder, and saves including corrupt ones.
import assert from 'node:assert/strict';
import { BASE, DT, makeCar, stepCar, tyre, gearSpeed, slipAngle, idleInput, withUpgrades, statCard, UPGRADES, quantise, filterSteer, steerLock } from '../.checks/pass-car.js';
import { buildTrack, locate, radiusAt, at, PASSES, NARROW, WIDE } from '../.checks/pass-tracks.js';
import { Race, Duel, duelOutcome, RIVALS, rival, paceNotes, readRoad, severity, SEVERITY, NOTE_LEAD, noteLevel, getTrack,
  encodeInput, decodeInput, packGhost, unpackGhost, parseSave, newSave, serialise, buyUpgrade, recordRun, passUnlocked,
  deliveryMedal, medalTimes, BOT_TIMES, STORY, BUNS, DUEL_GAP, finishS, SAVE_KEY, rng, GHOST_VERSION, ASSIST } from '../.checks/pass-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const env = { grade: 0, gripMul: 1, boostMul: 1.2 };
const drive = (c, inp, secs) => { for (let t = 0; t < secs; t += DT) stepCar(c, inp, env); return c; };
const I = (o) => ({ ...idleInput(), ...o });

// ---------------------------------------------------------------- car
{
  const run = () => { const c = makeCar(BASE, 0, 0, 0); for (let i = 0; i < 2400; i++) stepCar(c, I({ throttle: 1, steer: Math.sin(i / 90) * 0.7, hand: i % 400 < 30 }), env); return c; };
  const a = run(), b = run();
  assert.deepEqual([a.x, a.y, a.h, a.u, a.v, a.r, a.rpm, a.gear], [b.x, b.y, b.h, b.u, b.v, b.r, b.rpm, b.gear]);
  const q = quantise({ steer: 0.33, throttle: 0.6, brake: 0.1, hand: false, up: false, down: false });
  assert.equal(q.steer, 5 / 16); assert.equal(q.throttle, 0.5); assert.equal(q.brake, 0);
  ok('the car is deterministic and inputs are quantised');
}
{
  // grip rises with slip, peaks, then falls away toward the slide value
  const f = (a) => tyre(a, BASE.br, BASE.cr, BASE.slideR);
  assert.ok(f(0.02) < f(0.06) && f(0.06) < f(0.15), 'grip builds with slip');
  let peak = 0, peakA = 0; for (let a = 0; a < 1.2; a += 0.005) if (f(a) > peak) { peak = f(a); peakA = a; }
  assert.ok(peakA > 0.1 && peakA < 0.35, `peak near 0.1–0.35 rad (${peakA.toFixed(3)})`);
  assert.ok(f(1.0) < peak * 0.9 && f(1.0) >= BASE.slideR - 1e-9, 'past the peak the tyre slides with less grip');
  assert.equal(tyre(-0.2, 10, 1.3, 0.8), -tyre(0.2, 10, 1.3, 0.8));
  ok(`tyre curve: peak at ${peakA.toFixed(2)} rad, ${(f(1.0) / peak * 100).toFixed(0)} % left sliding`);
}
{
  let last = 0;
  for (let g = 1; g <= BASE.ratios.length; g++) { const v = gearSpeed(BASE, g); assert.ok(v > last, 'each gear is taller'); last = v; }
  // held in each gear at full throttle, the car tops out at that gear's redline speed
  for (const g of [1, 2, 3]) {
    const c = makeCar(BASE, 0, 0, 0, false); c.gear = g; c.u = gearSpeed(BASE, g) * 0.7;
    drive(c, I({ throttle: 1 }), 12);
    assert.ok(Math.abs(c.u - gearSpeed(BASE, g)) < 1.2, `gear ${g} tops out at ${(gearSpeed(BASE, g) * 3.6).toFixed(0)} km/h (${(c.u * 3.6).toFixed(0)})`);
  }
  const c = makeCar(BASE, 0, 0, 0); let t100 = 0;
  for (let t = 0; t < 20 && !t100; t += DT) { stepCar(c, I({ throttle: 1 }), env); if (c.u >= 100 / 3.6) t100 = t; }
  assert.ok(t100 > 4 && t100 < 8, `0–100 km/h in ${t100.toFixed(2)} s`);
  assert.ok(c.gear >= 2, 'the automatic box shifts up');
  ok(`top speed per gear ${BASE.ratios.map((_, g) => (gearSpeed(BASE, g + 1) * 3.6).toFixed(0)).join('/')} km/h, 0–100 in ${t100.toFixed(1)} s`);
}
const brakeDist = (spec) => { const c = makeCar(spec, 0, 0, 0); c.u = 100 / 3.6; c.gear = 3; let t = 0; for (; c.u > 0.3 && t < 10; t += DT) stepCar(c, I({ brake: 1 }), env); return { d: c.x, straight: Math.abs(c.y) < 0.5 }; };
{
  const b = brakeDist(BASE);
  assert.ok(b.d > 30 && b.d < 50 && b.straight, `100–0 km/h in ${b.d.toFixed(1)} m, in a straight line`);
  ok(`braking distance from 100 km/h: ${b.d.toFixed(1)} m`);
}
const driftRun = (spec, assist, hold, thr) => {
  const c = makeCar(spec, 0, 0, 0); c.u = 22; c.gear = 3; c.assist = assist; let held = 0, maxB = 0, minU = 99;
  for (let t = 0; t < 6; t += DT) {
    stepCar(c, t < 0.45 ? I({ steer: 1, throttle: 0.6, hand: t > 0.1 && t < 0.35 }) : I({ steer: hold, throttle: thr }), env);
    const b = Math.abs(slipAngle(c)); maxB = Math.max(maxB, b);
    if (t > 1) { minU = Math.min(minU, c.u); if (b > 0.15 && b < 0.9) held += DT; }
  }
  return { held, maxB, minU };
};
{
  const d = driftRun(BASE, 0.6, 0.3, 1);
  assert.ok(d.held > 3.5 && d.minU > 10, `a handbrake flick then throttle and a little lock holds a drift (${d.held.toFixed(1)} s, never below ${d.minU.toFixed(1)} m/s)`);
  const hi = driftRun(BASE, 0.85, 0.6, 1);
  assert.ok(hi.held > 3.5 && hi.maxB < 0.9, `with high assist it holds a tidy angle (max ${hi.maxB.toFixed(2)} rad)`);
  const off = driftRun(BASE, 0, 0.3, 1);
  assert.ok(off.maxB > 1 || off.held < 2, 'with no assist and no counter-steer the same move spins');
  const lift = driftRun(BASE, 0.6, 0.3, 0);
  assert.ok(lift.held < d.held, 'lifting off the throttle lets the tail come back');
  ok(`drift sustained with counter-steer: ${d.held.toFixed(1)} s held at assist 0.6, ${hi.held.toFixed(1)} s at 0.85, spins with none`);
}

// ---------------------------------------------------------------- keyboard feel: smoothed steering, easy drifts, no beginner spins
{
  // the filter: a held key reaches full steering in 0.3 s and lets go in 0.15 s; a stick goes through the same filter
  const c = makeCar(BASE, 0, 0, 0); let up = 0, down = 0;
  for (let k = 1; k <= 120 && !up; k++) { filterSteer(c, 1); if (c.steerIn >= 1) up = k * DT; }
  for (let k = 1; k <= 120 && !down; k++) { filterSteer(c, 0); if (c.steerIn <= 0) down = k * DT; }
  assert.ok(up > 0.25 && up < 0.35 && down > 0.1 && down < 0.2, `steering ramps in over ${up.toFixed(2)} s and back in ${down.toFixed(2)} s`);
  const sharp = makeCar(BASE, 0, 0, 0, true, ASSIST.strong, 'sharp'); for (let k = 0; k < 18; k++) filterSteer(sharp, 1);
  assert.ok(sharp.steerIn === 1, 'Sharp steering is quicker');
  // much less lock at speed
  assert.ok(steerLock(BASE, 40) < BASE.lock * 0.15 && steerLock(BASE, 5) > BASE.lock * 0.6, `lock ${steerLock(BASE, 5).toFixed(2)} rad at 5 m/s, ${steerLock(BASE, 40).toFixed(3)} at 40`);
}
const cruiseCar = (u, assist = ASSIST.strong) => { const c = makeCar(BASE, 0, 0, 0, true, assist); c.u = u; c.gear = u > 20 ? 3 : 2; c.rpm = 5000; return c; };
{
  // one keyboard tap (a tenth of a second of full steer) at 90 km/h is a small correction, not a lurch
  const c = cruiseCar(25), h0 = c.h; let peakR = 0;
  for (let k = 0; k < 180; k++) { stepCar(c, I({ steer: k < 12 ? 1 : 0, throttle: Math.max(0, Math.min(1, (25 - c.u) * 0.5 + 0.35)) }), env); peakR = Math.max(peakR, Math.abs(c.r)); }
  assert.ok(Math.abs(c.h - h0) < 0.025 && peakR < 0.2, `a tap at 25 m/s turns the car ${(c.h - h0).toFixed(3)} rad (peak yaw ${peakR.toFixed(2)} rad/s)`);
  ok(`a steering tap at speed yaws ${(c.h - h0).toFixed(3)} rad`);
}
const handSlide = (u, assist) => {
  // into a hairpin: wheel in and a handbrake tap, then throttle and steering held, then let go
  const c = cruiseCar(u, assist); let held = 0, run = 0, maxB = 0, snap = 0, settle = -1;
  for (let k = 0; k < 120 * 5; k++) {
    const t = k * DT;
    stepCar(c, t < 0.35 ? I({ steer: 1, hand: true }) : t < 3 ? I({ steer: 1, throttle: 0.75 }) : I({ throttle: 0.4 }), env);
    const b = slipAngle(c);
    if (t < 3) { maxB = Math.max(maxB, Math.abs(b)); if (Math.abs(b) > 0.14 && c.u > 6) { run += DT; held = Math.max(held, run); } else run = 0; }
    else { snap = Math.max(snap, b); if (settle < 0 && Math.abs(b) < 0.05) settle = t - 3; } // the slide is to the left (b < 0): a snap is b > 0
  }
  return { held, maxB, snap, settle };
};
{
  for (const u of [13, 16, 19]) {
    const d = handSlide(u, ASSIST.strong);
    assert.ok(d.held >= 1.5, `a handbrake slide at ${u} m/s holds ${d.held.toFixed(2)} s with throttle and steer`);
    assert.ok(d.maxB < 0.9 && d.snap < 0.1 && d.settle >= 0 && d.settle < 1.2, `it holds a steady angle (max ${d.maxB.toFixed(2)} rad) and straightens in ${d.settle.toFixed(2)} s without a snap (${d.snap.toFixed(2)})`);
  }
  // a lift-off and a hard turn-in starts a slide too
  const c = cruiseCar(17); let maxB = 0;
  for (let k = 0; k < 240; k++) { stepCar(c, I({ steer: 1, throttle: k < 60 ? 0 : 0.8 }), env); maxB = Math.max(maxB, Math.abs(slipAngle(c))); }
  assert.ok(maxB > 0.25 && maxB < 0.9, `a lift-off turn-in slides (${maxB.toFixed(2)} rad)`);
  // with the assist on, no ordinary corner entry spins: 12–34 m/s, short to long turns, any throttle
  for (const assist of [ASSIST.strong, ASSIST.light]) {
    let spins = 0, n = 0;
    for (let u = 12; u <= 34; u += 2) for (const dur of [0.4, 0.8, 1.2, 1.8]) for (const thr of [0, 0.5, 1]) {
      const e = cruiseCar(u, assist); let spun = false;
      for (let k = 0; k < 480; k++) { stepCar(e, I({ steer: k * DT < dur ? 1 : 0, throttle: k < 24 ? 0 : thr }), env); if (Math.abs(slipAngle(e)) > 1.0) spun = true; }
      n++; if (spun) spins++;
    }
    assert.equal(spins, 0, `no spins from ${n} corner entries at assist ${assist}`);
  }
  // but a clear mistake still spins: full handbrake and lock at top speed with the assist off
  const m = cruiseCar(40, ASSIST.off); let mb = 0;
  for (let k = 0; k < 240; k++) { stepCar(m, I({ steer: 1, hand: true }), env); mb = Math.max(mb, Math.abs(slipAngle(m))); }
  assert.ok(mb > 1.2, 'a full handbrake at top speed with no assist spins');
  ok(`drifts: a handbrake tap holds ${handSlide(16, ASSIST.strong).held.toFixed(1)} s and straightens without a snap; no spins from 264 corner entries with the assist`);
}

// ---------------------------------------------------------------- upgrades
{
  const tyres = withUpgrades(BASE, ['tyres']);
  assert.ok(tyres.mu > BASE.mu && brakeDist(tyres).d < brakeDist(BASE).d, 'sticky tyres: more grip, shorter stops');
  const accel = (spec) => { const c = makeCar(spec, 0, 0, 0); let t = 0; for (; c.u < 25 && t < 20; t += DT) stepCar(c, I({ throttle: 1 }), env); return t; };
  assert.ok(accel(withUpgrades(BASE, ['intake'])) < accel(BASE) - 0.2, 'the turbo pulls harder');
  assert.ok(accel(withUpgrades(BASE, ['flywheel'])) < accel(BASE), 'a lighter flywheel revs up quicker');
  const turnIn = (spec) => { const c = makeCar(spec, 0, 0, 0); c.u = 18; c.gear = 3; c.assist = 0; drive(c, I({ steer: 0.8, throttle: 0.3 }), 0.5); return c.r; };
  assert.ok(turnIn(withUpgrades(BASE, ['rear'])) > turnIn(BASE), 'a stiffer rear rotates the car more');
  assert.ok(withUpgrades(BASE, ['rack']).lock > BASE.lock, 'the quick rack gives more lock');
  assert.ok(driftRun(withUpgrades(BASE, ['lsd']), 0.6, 0.3, 1).held >= driftRun(BASE, 0.6, 0.3, 1).held - 0.1, 'the diff keeps a drift going');
  assert.ok(withUpgrades(BASE, ['tray']).bunDamp < 1, 'the sprung tray damps the buns');
  const base = statCard([]), all = statCard(UPGRADES.map((u) => u.id));
  assert.ok(all.power > base.power && all.grip > base.grip && all.buns > base.buns);
  for (const v of Object.values(all)) assert.ok(v >= 0 && v <= 10);
  assert.equal(withUpgrades(BASE, []).mu, BASE.mu, 'no upgrades, stock car');
  ok('upgrades change the handling: tyres, turbo, flywheel, rear, rack, diff, tray, and the stat card');
}

// ---------------------------------------------------------------- the roads
for (const p of PASSES) {
  const t = buildTrack(p.id);
  assert.ok(t.len > 1000 && t.len < 2200, `${p.id} is a proper pass (${t.len} m)`);
  // the road never crosses or touches itself
  let minSep = Infinity;
  for (let i = 0; i < t.n; i += 2) for (let j = i + 70; j < t.n; j += 2) minSep = Math.min(minSep, Math.hypot(t.x[i] - t.x[j], t.y[i] - t.y[j]));
  assert.ok(minSep > 2 * WIDE + 8, `${p.id}: separate legs stay ${minSep.toFixed(1)} m apart`);
  for (let i = 0; i < t.n; i++) assert.ok(t.wl[i] >= NARROW - 1e-9 && t.wr[i] >= NARROW - 1e-9);
  assert.ok([...t.wide].some((w) => w), `${p.id} has passing places`);
  // locate finds the road position from a point offset to the left
  const w = { i: 0, s: 0, d: 0, px: 0, py: 0 };
  for (const s of [100, 400, 800]) {
    const i = at(t, s), x = t.x[i] - Math.sin(t.h[i]) * 1.5, y = t.y[i] + Math.cos(t.h[i]) * 1.5;
    locate(t, x, y, i + 3, w);
    assert.ok(Math.abs(w.s - s) < 0.6 && Math.abs(w.d - 1.5) < 0.05, `${p.id}: locate at ${s} m`);
  }
}
{
  const down = buildTrack('summit'), up = buildTrack('summit', true);
  assert.equal(up.n, down.n);
  assert.ok(Math.abs(up.x[0] - down.x[down.n - 1]) < 1e-9 && Math.abs(up.z[0] - down.z[down.n - 1]) < 1e-9, 'the uphill leg starts where the downhill ends');
  assert.ok(up.grade[200] > 0 && down.grade[200] < 0, 'up is up');
  assert.ok(Math.abs(up.k[300] + down.k[down.n - 301]) < 1e-12, 'corners mirror');
  assert.equal([...up.gutter].filter((g) => g).length, [...down.gutter].filter((g) => g).length);
  ok('roads: lengths, no crossings, passing places, locate, and the reversed uphill leg');
}
{
  // progress and the finish: the autopilot drives a delivery; progress only grows and the finish fires once
  const r = new Race({ pass: 'cedar', autopilot: 0.95, countdown: 0.5, buns: true });
  let last = -1, finishes = 0, go = 0, steps = 0, back = 0;
  while (!r.done && steps < 120 * 200) { r.tick(idleInput()); steps++; if (r.player.s < last - 0.5) back++; last = r.player.s; for (const e of r.events) { if (e.k === 'finish') finishes++; if (e.k === 'go') go++; } }
  assert.ok(r.done && finishes === 1 && go === 1 && back === 0);
  assert.ok(r.player.s >= finishS(r.track) && r.result.reason === 'solo' && Math.abs(r.result.time - r.player.finished) < 1e-9);
  assert.equal(r.inputs.length > 0, true);
  ok(`progress and finish: cedar delivered in ${r.player.finished.toFixed(1)} s`);
}

// ---------------------------------------------------------------- guardrails
{
  const r = new Race({ pass: 'lake', countdown: 0.1 });
  const inp = I({ throttle: 1, steer: 0 });
  let walls = 0, maxOut = 0, steps = 0, scrapes = 0, speedAtHit = 0, speedAfter = 0;
  while (steps < 120 * 12 && !r.done) {
    inp.steer = steps > 240 ? 1 : 0; // turn hard left into the rail
    r.tick(inp); steps++;
    const p = r.player, i = p.idx;
    maxOut = Math.max(maxOut, p.w.d - r.track.wl[i], -p.w.d - r.track.wr[i]);
    for (const e of r.events) { if (e.k === 'wall') { walls++; if (!speedAtHit) { speedAtHit = e.mag; } } if (e.k === 'scrape') scrapes++; }
  }
  assert.ok(walls > 0 && scrapes > 0, 'hitting the rail is reported');
  assert.ok(maxOut < 0.05, `the car stays inside the rails (${maxOut.toFixed(3)})`);
  // a big hit wrecks the car: it stops, waits and is put back on the road
  const w = new Race({ pass: 'stairs', countdown: 0.1, buns: true });
  let resets = 0; steps = 0;
  const full = I({ throttle: 1 });
  while (steps < 120 * 25 && !w.done) { w.tick(full); steps++; for (const e of w.events) if (e.k === 'reset') resets++; }
  assert.ok(resets > 0 && w.buns < BUNS, `flat out into the first hairpin wrecks it (${resets} resets, ${w.buns} buns left)`);
  void speedAfter;
  ok(`guardrails: ${walls} hits, stays inside, big hits wreck and reset`);
}

// ---------------------------------------------------------------- duels
{
  const R = (winner, reason = 'held', gap = 0.5) => ({ winner, reason, gap, time: 60 });
  assert.equal(duelOutcome([R(0, 'pulled-away', 1.4)]), null, 'one round decides nothing');
  assert.equal(duelOutcome([R(0, 'pulled-away', 1.4), R(-1)]), 0, 'win the lead, hold the chase: you win');
  assert.equal(duelOutcome([R(-1), R(1, 'pulled-away', 1.2)]), 1, 'held the lead but dropped in the chase: you lose');
  assert.equal(duelOutcome([R(0, 'pulled-away'), R(1, 'pulled-away')]), null, 'one each: sudden death');
  assert.equal(duelOutcome([R(-1), R(-1)]), null, 'two held rounds: sudden death');
  assert.equal(duelOutcome([R(-1), R(-1), R(-1)]), null);
  assert.equal(duelOutcome([R(-1), R(-1), R(-1), R(0, 'passed')]), 0, 'sudden death: the first clear round wins');
  assert.equal(duelOutcome([R(0), R(1), R(1, 'crash')]), 1);
  assert.notEqual(duelOutcome([R(-1, 'held', 0.9), R(-1, 'held', 0.1), R(-1), R(-1), R(-1), R(-1)]), null, 'after six rounds the gaps decide');
  ok('duel rules: lead, chase, sudden death, the six-round limit');
}
{
  // a rival chasing a stationary player goes past and the stalled car is a crash
  const r = new Race({ pass: 'cedar', rival: 'stoat', role: 'lead', countdown: 0.1, seed: 4 });
  let overtakes = 0, steps = 0;
  while (!r.done && steps < 120 * 60) { r.tick(idleInput()); steps++; for (const e of r.events) if (e.k === 'overtake') overtakes++; }
  assert.ok(r.done && r.result.winner === 1, 'the stalled leader loses the round');
  assert.ok(overtakes >= 1 || r.result.reason === 'crash');
  // the gap meter: positive when behind, negative when ahead
  const g = new Race({ pass: 'cedar', rival: 'stoat', role: 'chase', countdown: 0.1, autopilot: 0.95, seed: 2 });
  steps = 0; while (g.t < 15 && !g.done) { g.tick(idleInput()); steps++; }
  const gap = g.gapOf(0);
  assert.ok(gap > 0 && gap < 3, `chasing, the gap is a little behind (${gap.toFixed(2)} s)`);
  assert.ok(Math.abs(g.gapOf(1) + gap) < 0.6, 'the rival sees the mirror of it');
  assert.ok(g.player.s < g.rival.s);
  ok(`duel race: a stalled leader is passed and loses; gap ${gap.toFixed(2)} s while chasing`);
}
{
  // a slow leader gets overtaken in a wide place and the chaser takes the round
  const saved = rival('stoat').pace; rival('stoat').pace = 0.6;
  const r = new Race({ pass: 'cedar', rival: 'stoat', role: 'chase', countdown: 0.1, autopilot: 0.97, seed: 3 });
  let over = null, steps = 0;
  while (!r.done && steps < 120 * 120) { r.tick(idleInput()); steps++; for (const e of r.events) if (e.k === 'overtake' && over === null) over = { by: e.by, s: r.player.s }; }
  rival('stoat').pace = saved;
  assert.ok(over && over.by === 0, 'the player car passes');
  assert.equal(r.result.winner, 0); assert.ok(['passed', 'pulled-away'].includes(r.result.reason));
  const wideAt = r.track.wide[at(r.track, over.s)] || r.track.wide[at(r.track, over.s - 30)] || r.track.wide[at(r.track, over.s - 60)];
  assert.ok(wideAt, `the pass happens in or just after a passing place (${over.s.toFixed(0)} m)`);
  ok(`overtake: the chaser passes at ${over.s.toFixed(0)} m and wins the round (${r.result.reason})`);
}
{
  // a full duel runs its rounds, roles alternate, the relay starts uphill
  const d = new Duel({ rival: 'fox', relay: true, autopilot: 0.985, countdown: 0.1, seed: 5, upgrades: ['tyres', 'flywheel', 'lsd', 'rack', 'intake'] });
  assert.ok(d.race.track.reversed && d.race.opts.role === 'lead', 'relay leg one: uphill, leading');
  while (!d.over) { let s = 0; while (!d.race.done && s < 120 * 200) { d.race.tick(idleInput()); s++; } if (!d.finishRound()) { d.startRound(); assert.equal(d.race.track.reversed, false, 'later legs run downhill'); } }
  assert.ok(d.rounds.length >= 2 && d.rounds[0].role === 'lead' && d.rounds[1].role === 'chase');
  assert.ok(d.winner === 0 || d.winner === 1);
  ok(`the dawn relay: ${d.rounds.length} rounds, ${d.winner === 0 ? 'won' : 'lost'}`);
}

// ---------------------------------------------------------------- pace notes
{
  assert.deepEqual([severity(12), severity(20), severity(40), severity(60), severity(90), severity(130), severity(200), severity(400)], [0, 1, 2, 3, 4, 5, 6, 7]);
  let checked = 0, mism = 0;
  for (const p of PASSES) {
    const t = getTrack(p.id);
    const { corners } = readRoad(t);
    assert.ok(corners.length >= 8, `${p.id} has corners to call`);
    for (const c of corners) {
      // measure the corner geometrically from the road points, independently of the stored curvature
      let rGeo = Infinity; for (let s = c.start; s <= c.end; s++) rGeo = Math.min(rGeo, radiusAt(t, at(t, s), 6));
      assert.ok(Math.abs(rGeo - c.radius) / c.radius < 0.12, `${p.id} corner at ${c.start}: radius ${c.radius} vs measured ${rGeo.toFixed(1)}`);
      const sg = severity(rGeo);
      if (sg !== c.sev) { mism++; const edge = SEVERITY[Math.min(sg, c.sev)]; assert.ok(Math.abs(rGeo - edge) / edge < 0.12, 'only on a boundary'); }
      checked++;
    }
  }
  assert.ok(mism <= checked * 0.1);
  const stairs = getTrack('stairs');
  const hair = readRoad(stairs).corners.filter((c) => c.sev === 0);
  assert.ok(hair.length >= 6 && hair.every((c) => c.radius >= 13 && c.radius <= 18), 'the Hairpin Stairs are hairpins');
  ok(`pace-note severities match the measured corner radius on ${checked} corners (${mism} on a boundary)`);
}
{
  const t = getTrack('stairs');
  const l0 = paceNotes(t, 0), l1 = paceNotes(t, 1), l2 = paceNotes(t, 2), l3 = paceNotes(t, 3);
  assert.ok(l0.every((x) => !/\d/.test(x.text.join(' '))), 'level 0: no numbers');
  assert.ok(l0.some((x) => /Uh… a (left|right)\? Big one!/.test(x.text[0])), 'level 0: vague');
  assert.ok(l1.some((x) => /^Hairpin (left|right)!$/.test(x.text[0])), 'level 1: names the hairpins');
  assert.ok(l2.some((x) => /\d/.test(x.text[0])) || l2.some((x) => /Hairpin/.test(x.text[0])), 'level 2: severity');
  assert.ok(l3.some((x) => /gutter!/.test(x.text[0])), 'level 3: gutter warnings');
  assert.ok(!l2.some((x) => /gutter/.test(x.text[0])), 'gutters are a level 3 note');
  assert.ok(l3.some((x) => x.kind === 'wide'), 'level 3: passing places');
  const lake = paceNotes(getTrack('lake'), 2);
  assert.ok(lake.some((x) => /into (left|right)/.test(x.text[0])), 'linked esses are called with "into"');
  assert.ok(paceNotes(getTrack('lake'), 3).some((x) => x.kind === 'crest'), 'crests are called at level 3');
  assert.ok(paceNotes(getTrack('tunnel'), 3).some((x) => x.kind === 'tunnel'));
  for (let i = 1; i < 4; i++) assert.ok(NOTE_LEAD[i].t > NOTE_LEAD[i - 1].t && NOTE_LEAD[i].min > NOTE_LEAD[i - 1].min);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(noteLevel), [0, 1, 2, 2, 3, 3]);
  // in a run, a better notebook calls each corner further ahead
  const callAhead = (lvl) => {
    const r = new Race({ pass: 'cedar', autopilot: 0.95, countdown: 0.1, noteLevel: lvl });
    let s = 0, sum = 0, k = 0; while (!r.done && s < 120 * 120) { r.tick(idleInput()); s++; for (const e of r.events) if (e.k === 'note' && e.note.kind === 'corner') { sum += e.note.s - r.player.s; k++; } }
    return sum / k;
  };
  const a0 = callAhead(0), a3 = callAhead(3);
  assert.ok(a3 > a0 * 2, `level 3 calls ${a3.toFixed(0)} m ahead, level 0 only ${a0.toFixed(0)} m`);
  ok(`pace notes: four levels, "${l3.find((x) => /gutter/.test(x.text[0])).text[0]}", calls ${a0.toFixed(0)} m → ${a3.toFixed(0)} m ahead`);
}

// ---------------------------------------------------------------- buns, medals, ghosts
{
  for (const p of PASSES) { const [g, s, b] = medalTimes(p.id); assert.ok(BOT_TIMES[p.id] > 40 && g < s && s < b && g > BOT_TIMES[p.id]); }
  const [g, s] = medalTimes('cedar');
  assert.equal(deliveryMedal('cedar', g - 1, 12), 3);
  assert.equal(deliveryMedal('cedar', g - 1, 9), 2, 'gold time but bruised buns is silver');
  assert.equal(deliveryMedal('cedar', s + 0.05, 12), 1);
  assert.equal(deliveryMedal('cedar', 999, 12), 0);
  ok('medals need the time and the buns');
}
{
  const codes = [];
  const rnd = rng(9);
  for (let i = 0; i < 300; i++) { const inp = quantise({ steer: rnd() * 2 - 1, throttle: rnd(), brake: rnd() < 0.2 ? 1 : 0, hand: rnd() < 0.1, up: false, down: rnd() < 0.05 }); const c = encodeInput(inp); codes.push(c); assert.deepEqual(decodeInput(c), inp); }
  assert.deepEqual(unpackGhost(packGhost(codes)), codes);
  assert.equal(unpackGhost('zz!'), null); assert.equal(unpackGhost('5.0'), null); assert.equal(unpackGhost(42), null);
  // record a run, replay it as a ghost: the ghost crosses the line at the same moment
  const r = new Race({ pass: 'lake', countdown: 0.2, upgrades: ['tyres'], assist: 0.6, autopilot: 0.93, seed: 4 });
  let s = 0; while (!r.done && s < 120 * 200) { r.tick(idleInput()); s++; }
  assert.ok(r.done, 'the recorded run finishes');
  const ghost = unpackGhost(packGhost(r.inputs));
  const g = new Race({ pass: 'lake', countdown: 0.2, upgrades: ['tyres'], assist: 0.6, ghost });
  s = 0; while (s < 120 * 200 && g.ghost.finished < 0) { g.tick(idleInput()); s++; }
  assert.ok(Math.abs(g.ghost.finished - r.player.finished) < 1e-9, `the ghost replays the run exactly (${g.ghost.finished.toFixed(3)} = ${r.player.finished.toFixed(3)})`);
  ok(`ghosts: ${packGhost(r.inputs).length} characters replay a ${r.player.finished.toFixed(1)} s run exactly`);
}

// ---------------------------------------------------------------- story and saves
{
  for (const rv of RIVALS) assert.ok(STORY.some((s) => (s.kind === 'duel' || s.kind === 'relay') && s.rival === rv.id), `${rv.name} is in the story`);
  for (const p of PASSES.filter((p) => p.id !== 'summit')) assert.ok(STORY.some((s) => s.kind === 'delivery' && s.pass === p.id), `${p.name} has a delivery`);
  for (const sc of ['bakery', 'carpark', 'fog', 'relay', 'ending']) assert.ok(STORY.some((s) => s.kind === 'scene' && s.scene === sc));
  assert.equal(STORY[STORY.length - 1].kind, 'scene');
  ok(`story: ${STORY.length} steps`);
}
{
  assert.equal(SAVE_KEY, 'kumori-pass-v1');
  const s = newSave(); s.coins = 500; recordRun(s, 'fog'); recordRun(s, 'fog');
  assert.equal(noteLevel(s.runs.fog), 2);
  assert.ok(buyUpgrade(s, 'tyres') && s.coins === 440 && !buyUpgrade(s, 'tyres') && !buyUpgrade(s, 'nope'));
  s.story = 4; s.beaten = ['stoat']; s.medals.cedar = 3; s.best.cedar = 61.25;
  s.ghosts.cedar = packGhost([5, 5, 5, 9]); s.ghostMeta.cedar = { up: ['tyres'], assist: 1, manual: false, sharp: false, hv: GHOST_VERSION };
  s.settings.lite = true; s.settings.sharp = true; s.settings.assist = ASSIST.light;
  const back = parseSave(serialise(s));
  assert.deepEqual(back, s, 'a save round-trips');
  assert.ok(passUnlocked(back, 'lake') && !passUnlocked(back, 'tunnel') && passUnlocked(back, 'cedar'));
  for (const bad of [null, '', '{', 'null', '[]', '42', '"x"', '{"v":2,"coins":5}', JSON.stringify({ v: 1, coins: 'lots', upgrades: 'tyres', runs: { fog: -5, cedar: 1e9 }, story: 99, beaten: ['dragon', 'stoat', 'stoat'], medals: { cedar: 7 }, best: { lake: NaN }, ghosts: { cedar: 'bad!' }, settings: { assist: 'max', camera: 9 } })]) {
    let p; assert.doesNotThrow(() => { p = parseSave(bad); });
    assert.ok(p.coins >= 0 && Array.isArray(p.upgrades) && p.story <= STORY.length && p.runs.fog >= 0 && p.medals.cedar <= 3 && !p.ghosts.cedar);
    assert.ok(p.beaten.every((b) => RIVALS.some((r) => r.id === b)) && new Set(p.beaten).size === p.beaten.length);
    assert.ok(p.settings.assist >= 0 && p.settings.assist <= 1 && p.settings.camera <= 2);
  }
  // saves from before the handling update: the old default assist becomes Strong, Low becomes Light, old ghosts go
  const old = parseSave(JSON.stringify({ v: 1, settings: { assist: 0.6 }, ghosts: { cedar: packGhost([5, 5]) }, ghostMeta: { cedar: { up: [], assist: 0.6, manual: false } } }));
  assert.equal(old.settings.assist, ASSIST.strong); assert.equal(old.settings.sharp, false); assert.ok(!old.ghosts.cedar, 'a ghost from the old handling is dropped');
  assert.equal(parseSave(JSON.stringify({ v: 1, settings: { assist: 0.35 } })).settings.assist, ASSIST.light);
  assert.equal(parseSave(JSON.stringify({ v: 1, settings: { assist: 0 } })).settings.assist, ASSIST.off);
  assert.equal(newSave().settings.assist, ASSIST.strong, 'Strong assist and Smooth steering by default');
  ok('saves round-trip, unlock the ladder, old settings and ghosts migrate, and corrupt saves fall back without throwing');
}
console.log(`pass: ${n} checks passed`);
void DUEL_GAP;
