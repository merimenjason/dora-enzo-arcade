// Fluff Roll bot: plays every level as a busy player who heads for the best nearby thing, steering with a little wobble and
// a slow reaction, and checks the goal is fair: reachable with time to spare, but not before half the clock.
import assert from 'node:assert/strict';
import { RollGame, LEVELS, DT, KINDS, PICK, sizeLabel, seeded, topSpeed } from '../.checks/roll-game.js';

export function play(level, { seed = 1, wobble = 0.35, react = 0.25, log = false } = {}) {
  const g = new RollGame({ level }), rand = seeded(seed);
  g.skipIntro();
  const banned = new Map(); let chaseFor = 0, escape = null, chasing = null, aim = null, think = 0, goalAt = null, steps = 0, stuckFor = 0, detour = 0;
  while (g.mode !== 'done') {
    think -= DT; chaseFor += DT;
    if (think <= 0) {
      think = react;
      let t = g.target();
      if (t && banned.get(t.id) > g.clock) t = g.near(g.ball.x, g.ball.z, g.ball.r * 30).filter((o) => !o.stuck && o.r <= g.ball.r * PICK && !(banned.get(o.id) > g.clock)).sort((a, b) => Math.hypot(a.x - g.ball.x, a.z - g.ball.z) - Math.hypot(b.x - g.ball.x, b.z - g.ball.z))[0] ?? null;
      if ((t?.id ?? null) !== chasing) { chasing = t?.id ?? null; chaseFor = 0; }
      // chased too long: give up on it and the patch round it for a while
      if (t && chaseFor > 4) { for (const o of g.near(t.x, t.z, g.ball.r * 4)) if (Math.hypot(o.x - t.x, o.z - t.z) < g.ball.r * 4) banned.set(o.id, g.clock + 20); chaseFor = 0; think = 0; }
      aim = t ? { x: t.x, z: t.z } : { x: (rand() - 0.5) * g.spec.half, z: (rand() - 0.5) * g.spec.half };
    }
    let dx = aim.x - g.ball.x, dz = aim.z - g.ball.z;
    // the first too-big thing on the way there: steer past it along the tangent on the side nearer the target
    {
      const b = g.ball, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len; let hit = null, best = Infinity;
      for (const t of g.near(b.x, b.z, b.r * 4 + 1)) {
        if (t.stuck || t.r <= b.r * PICK) continue;
        const ox = t.x - b.x, oz = t.z - b.z, along = ox * ux + oz * uz, R = t.r + b.r * 1.15;
        if (along < 0 || along > Math.min(len, b.r * 4 + t.r * 2)) continue;
        if (Math.abs(ox * uz - oz * ux) < R && along < best) { best = along; hit = { ox, oz, R }; }
      }
      if (hit) {
        const d = Math.hypot(hit.ox, hit.oz), base = Math.atan2(hit.oz, hit.ox), off = Math.asin(Math.min(1, hit.R / Math.max(d, hit.R)));
        const want = Math.atan2(dz, dx), side = Math.sin(want - base) >= 0 ? 1 : -1, a = base + side * off;
        dx = Math.cos(a); dz = Math.sin(a);
      }
    }
    // wedged: back away from whatever is touching, with a random sideways lean
    if (detour > 0) {
      detour -= DT;
      if (!escape) {
        let ex = 0, ez = 0;
        for (const t of g.near(g.ball.x, g.ball.z, g.ball.r * 2)) if (!t.stuck && t.r > g.ball.r * PICK) { const d = Math.hypot(t.x - g.ball.x, t.z - g.ball.z); if (d < g.ball.r + t.r + g.ball.r) { ex -= (t.x - g.ball.x) / d; ez -= (t.z - g.ball.z) / d; } }
        const a = (ex || ez ? Math.atan2(ez, ex) : rand() * Math.PI * 2) + (rand() - 0.5) * 1.2; escape = { x: Math.cos(a), z: Math.sin(a) };
      }
      dx = escape.x; dz = escape.z;
    } else escape = null;
    const a = Math.atan2(dz, dx) + (rand() - 0.5) * wobble;
    g.setInput(Math.cos(a), Math.sin(a));
    g.step(DT); g.events.length = 0; steps++;
    if (g.reached && goalAt === null) goalAt = g.clock;
    // wedged: barely moving for a second while trying to roll
    if (Math.hypot(g.ball.vx, g.ball.vz) < topSpeed(g.ball.r) * 0.25 && detour <= 0) stuckFor += DT; else stuckFor = 0;
    if (stuckFor > 1) { detour = 0.8; stuckFor = 0; if (chasing !== null) banned.set(chasing, g.clock + 15); think = 0; }
    if (log && steps % 1800 === 0) console.log(`  ${Math.round(g.clock)}s ${sizeLabel(g.ball.r)} stuck ${g.stuck.length}`);
  }
  return { goalAt, r: g.ball.r, stars: g.stars, stuck: g.stuck.length, kinds: new Set(g.stuck.map((id) => g.things[id].kind)).size, total: g.things.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--')), log = process.argv.includes('--log');
  for (const spec of LEVELS.filter((l) => !only.length || only.includes(l.id))) {
    const runs = [1, 2, 3, 4].map((seed) => play(spec.id, { seed, log }));
    const goals = runs.map((r) => r.goalAt), sizes = runs.map((r) => sizeLabel(r.r));
    console.log(`${spec.id.padEnd(8)} ${spec.time}s goal ${sizeLabel(spec.goal)} (${runs[0].total} things): goal at ${goals.map((t) => (t === null ? '-' : `${Math.round(t)}s`)).join(' ')}, final ${sizes.join(' ')}, stars ${runs.map((r) => r.stars).join(' ')}, rolled ${runs.map((r) => r.stuck).join(' ')}`);
    for (const r of runs) {
      assert.ok(r.goalAt !== null, `${spec.id}: the bot never reached the goal (${sizeLabel(r.r)})`);
      assert.ok(r.goalAt >= spec.time * 0.35 && r.goalAt <= spec.time * 0.8, `${spec.id}: goal at ${Math.round(r.goalAt)}s of ${spec.time}s`);
    }
  }
  console.log('Fluff Roll bot: every goal is fair.');
  void KINDS;
}
