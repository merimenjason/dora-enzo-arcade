// The Arcade After Dark bots, ported from the prototype's play-throughs: three bots with a human reaction delay (each
// acts on what it decided 200-300 ms earlier) and imperfect input (now and then it looks away for up to 1.6 s, holds
// the wrong way for a moment, or jumps a little early or late). They read the same wordless hints a player sees.
// - casual: follows the hints and nothing else.
// - curious: follows the hints but detours for any pearl within half a screen, and pings now and then to find more.
// - random: wanders off to random spots two thirds of the time and presses random buttons, then follows the hints.
// Each plays the whole chapter (hub, castle, secret room, sea, the Deep, cloud fortress, the giant) over seeds, with
// assist on (the default) and off. Thresholds, from the prototype's results (casual cleared 5/5 in about 200 s with
// assist on): with assist on, casual and curious must clear every run, casual's average under 260 s, curious must find
// at least 21 of the 22 pearls on average and every pearl in at least one run; random must clear at least 60% within
// 30 minutes; with assist off, casual must clear every run within 20 minutes and spend under 300 s in the castle on
// average (the chandelier pit). `--quick` runs fewer seeds. Run after compiling the engine into .checks/.
import assert from 'node:assert/strict';
import { newGame, step, hintFor, platsOf, solidsOf, groundBelow, goal, W0, lead, pearlsTotal, NO_INPUT } from '../.checks/afterdark-game.js';

const QUICK = process.argv.includes('--quick');
const VERBOSE = process.argv.includes('--verbose');
const RUNS = QUICK ? 2 : 5;

export function playRun(kind, seed, assist, maxMin) {
  const g = newGame({ seed, assist });
  let r = (seed * 7919) % 2147483647 || 1; const rand = () => (r = (r * 48271) % 2147483647) / 2147483647;
  const delay = Math.round((0.2 + rand() * 0.1) * 60);          // reaction delay in frames (200-300 ms)
  const Q = []; let aim = null, pause = 0, wrongT = 0, wrongDir = 0, roam = null, roamT = 0;
  const stuck = []; let lastProg = 0, progAt = 0;
  // a support under or ahead: platforms, movers, swings, solid tops, the floor (minus the pit)
  function supports(w) {
    const s = platsOf(w).map((p) => ({ x0: p.x0, x1: p.x1, y: p.y, mv: p.mv }));
    for (const q of solidsOf(g, w)) if (q.id !== 'wall' && q.id !== 'static' && q.id !== 'bank') s.push({ x0: q.x0, x1: q.x1, y: q.y0 });
    if (w.floor < 5000) {
      if (w.pit) { s.push({ x0: -1e4, x1: w.pit.x0 - 10, y: w.floor }); s.push({ x0: w.pit.x1 + 10, x1: 1e5, y: w.floor }); }
      else s.push({ x0: -1e4, x1: 1e5, y: w.floor });
    }
    return s;
  }
  function decide() {
    const w = W0(g), h = lead(g), out = { mx: 0, my: 0, jump: false, jumpP: false, e: false, j: false, k: false, swap: false };
    if (g.mode !== 'play' || g.trans || g.cut) return out;
    const H = hintFor(g);
    const explore = kind === 'random' && rand() < 0.65;
    if (kind === 'random' && (!roam || roamT <= 0)) { roam = { x: rand() * w.W, y: 120 + rand() * 450 }; roamT = 120 + rand() * 240; }
    if (kind === 'random' && rand() < 0.01) out[['j', 'k', 'e', 'swap'][Math.floor(rand() * 4)]] = true;
    let tx = null, ty = null;
    // curious: detour for any pearl within reach of the screen
    if (kind === 'curious') { const pr = w.pearls.filter((p) => p.revealed && !p.got && Math.abs(p.x - h.x) < 500)[0]; if (pr) { tx = pr.x; ty = pr.y; } else if (w.chest && !w.chest.open && w.web.burnt && Math.abs(w.chest.x - h.x) < 500) { tx = w.chest.x; ty = w.chest.y - 60; } if (rand() < 0.004 && g.abil.ping) out.j = true; }
    if (H && !explore && tx === null) {
      if (H.key === 'E') { out.e = true; tx = H.tx; }
      else if (H.key === 'J') out.j = true;
      else if (H.key === 'K') out.k = true;
      else if (H.key === 'swap') out.swap = true;
      else if (H.key === 'jump') { out.jump = true; tx = aim ? (aim.mv ? aim.mv.x : (aim.x0 + aim.x1) / 2) : h.x + h.face * 200; }
      else { tx = H.tx; ty = H.ty; }
    }
    if (explore) { tx = roam.x; ty = roam.y; }
    // the giant: get close to the heart while it is bare, step out of slam rings, jump the waves
    if (g.boss) {
      const B = g.boss;
      if (B.phase === 'scatter') { tx = 730; if (Math.abs(h.x - 730) > 60) out.j = false; }
      else if (B.phase === 'core') tx = 450; else tx = 350;
      if (B.atk && B.atk.kind === 'slam' && !B.atk.hit && Math.abs(h.x - B.atk.x) < 150) tx = B.atk.x + (h.x < B.atk.x || B.atk.x > 600 ? -260 : 260);
      for (const v of B.waves) if (Math.abs(v.x - h.x) < 110 && Math.sign(h.x - v.x) === v.dir && h.ground) out.jumpP = out.jump = true;
    }
    // cloud: the updraft is the way up to the shrine terrace
    if (w.id === 'cloud' && !w.shrine.taken && h.y > 450 && h.x > 1750 && h.x < 2250) { tx = 2080; ty = 200; }
    if (tx === null) return out;
    const dx = tx - h.x, dir = Math.abs(dx) > 18 ? Math.sign(dx) : 0;
    if (w.kind === 'swim') {
      out.mx = dir; const dy = (ty ?? 340) - h.y; out.my = Math.abs(dy) > 24 ? Math.sign(dy) : 0;
      for (const j of w.jellies) if (j.stun <= 0 && Math.hypot(j.x - h.x - dir * 60, j.y - h.y) < 120) out.my = j.y > h.y ? -1 : 1;
      if (w.guards) for (const q of w.guards) if (q.alive && Math.hypot(q.x - h.x, q.y - h.y) < 150) { out.my = q.y > h.y ? -1 : 1; if (Math.abs(q.x - h.x) < 100) out.mx = -Math.sign(q.x - h.x) || -1; }
      return out;
    }
    out.mx = dir;
    if (h.ground && dir) {
      const S = supports(w), ahead = h.x + dir * 50;
      const hazard = w.statics.some((s) => s.alive && !s.solid && ahead > s.x0 && ahead < s.x1 && h.y > s.y0 - 10 && h.y - 140 < s.y1) ||
        (w.armours || []).some((a) => a.daze <= 0 && Math.abs(a.x - ahead) < 70 && h.y > 640 - a.h);
      const cont = !hazard && S.some((s) => ahead > s.x0 && ahead < s.x1 && Math.abs(s.y - h.y) < 6);
      const blocked = h.blockedT > 0;
      const higher = ty !== null && ty !== undefined && ty < h.y - 120 && Math.abs(dx) < 220;
      if (!cont || blocked || higher) {
        let best = null;
        for (const s of S) {
          const near = dir > 0 ? s.x0 - h.x : h.x - s.x1;
          if (s.y < h.y - 165 || s.y > h.y + 320) continue;
          if (Math.abs(s.y - h.y) < 6 && near < 0) continue;
          if ((dir > 0 ? s.x1 : -s.x0) <= (dir > 0 ? h.x + 40 : -h.x + 40)) continue;
          if (near > (w.id === 'cloud' ? 420 : 230)) continue;
          const score = -Math.abs((s.x0 + s.x1) / 2 - tx) * 0.2 - Math.max(0, near) * 0.5 - (s.y < h.y ? 0 : 40);
          if (!best || score > best.score) best = { s, near, score };
        }
        if (best && (best.near < 170 || blocked || (!cont && !best.s.mv))) { out.jumpP = out.jump = true; aim = best.s; }
        else if (!cont && !blocked) out.mx = 0;   // wait at the edge for a mover to come round
      }
    } else if (!h.ground) {
      out.jump = h.vy < 0 || !groundBelow(w, h.x, h.y);
      if (aim) {   // steer onto the platform we jumped for (movers move)
        const m = aim.mv, cx = m ? m.x : (aim.x0 + aim.x1) / 2, half = m ? m.half : (aim.x1 - aim.x0) / 2;
        if (Math.abs(cx - h.x) < half - 20 && (m || Math.abs(tx - h.x) > half)) out.mx = m ? Math.sign(cx - h.x) * (Math.abs(cx - h.x) > 15 ? 1 : 0) : out.mx;
        else out.mx = Math.sign(cx - h.x) || out.mx;
      }
    }
    if (h.ground) aim = null;
    return out;
  }
  const total = maxMin * 60 * 60;
  for (let f = 0; f < total; f++) {
    if (g.mode === 'end') break;
    let d = decide();
    // imperfection: sometimes look away, sometimes hold the wrong way, jump a little early or late
    if (pause > 0) { pause--; d = { mx: 0, my: 0 }; }
    else if (rand() < (kind === 'casual' ? 0.0025 : 0.0012)) pause = Math.round((0.4 + rand() * 1.2) * 60);
    if (wrongT > 0) { wrongT--; d.mx = wrongDir; } else if (rand() < 0.002) { wrongT = Math.round(rand() * 25); wrongDir = -(d.mx || 1); }
    Q.push(d);
    const now = Q.length > delay + Math.round((rand() - 0.5) * 6) ? Q.shift() : { mx: 0, my: 0 };
    step(g, { ...NO_INPUT, mx: now.mx || 0, my: now.my || 0, jumpH: !!now.jump, jumpP: !!now.jumpP, eP: !!now.e, jP: !!now.j, kP: !!now.k, swapP: !!now.swap });
    roamT--;
    // stuck detector: no new milestone for 90 s of play
    const key = g.stats.events.filter((e) => /^[A-Z]|enter|pearl|room clear|door to|exit/.test(e[1])).length;
    if (key !== lastProg) { lastProg = key; progAt = g.playT; }
    else if (g.playT - progAt > 90) { stuck.push(`${g.world} @${Math.round(lead(g).x)},${Math.round(lead(g).y)} goal=${goal(g)}`); progAt = g.playT; }
  }
  const S = g.stats;
  const missed = [];
  for (const k of ['sea', 'castle', 'cloud', 'deep']) for (const p of g.W[k].pearls) if (!p.got) missed.push(`${k}:${p.id}@${p.x},${p.y}`);
  if (!g.W.castle.chest.open) missed.push('castle:chest');
  return { kind, seed, assist, done: g.mode === 'end', t: Math.round(g.playT), tPing: Math.round(S.tPing), tSweep: Math.round(S.tCrest), tGust: Math.round(S.tGust), tAnchor: Math.round(S.tAnchor), tBoss: Math.round(S.tBoss),
    worldT: Object.fromEntries(Object.entries(S.worldT).map(([k, v]) => [k, Math.round(v)])), hurts: S.hurts, falls: S.falls, bossHurts: S.bossHurts, pearls: S.pearls, total: pearlsTotal(g), missed, stuck: stuck.slice(0, 4) };
}

const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const res = [];
const plan = [['casual', true, 20], ['curious', true, 20], ['random', true, 30], ['casual', false, 20], ['curious', false, 20]];
for (const [kind, assist, cap] of plan) for (let i = 0; i < (kind === 'random' ? Math.max(2, RUNS - 2) : RUNS); i++) {
  const o = playRun(kind, 101 + i * 17, assist, cap);
  res.push(o);
  if (VERBOSE) console.log(JSON.stringify(o));
}
const sel = (k, a) => res.filter((o) => o.kind === k && o.assist === a);
const line = (k, a) => {
  const R = sel(k, a), D = R.filter((o) => o.done);
  return `${k.padEnd(7)} assist ${a ? 'on ' : 'off'}: cleared ${D.length}/${R.length}, avg ${Math.round(avg(D.map((o) => o.t)))} s (castle ${Math.round(avg(R.map((o) => o.worldT.castle || 0)))} s), hurts ${avg(R.map((o) => o.hurts)).toFixed(1)}, falls ${avg(R.map((o) => o.falls)).toFixed(1)}, pearls ${avg(R.map((o) => o.pearls)).toFixed(1)}/22`;
};
for (const [k, a] of [['casual', true], ['curious', true], ['random', true], ['casual', false], ['curious', false]]) console.log(line(k, a));
const missedCount = {};
for (const o of sel('curious', true)) for (const m of o.missed) missedCount[m] = (missedCount[m] || 0) + 1;
if (Object.keys(missedCount).length) console.log('curious missed:', JSON.stringify(missedCount));
const stuck = res.flatMap((o) => o.stuck.map((s) => `${o.kind}/${o.assist ? 'on' : 'off'}: ${s}`));
if (stuck.length) console.log('stuck:', stuck.slice(0, 6).join(' | '));

const cas = sel('casual', true), cur = sel('curious', true), rnd = sel('random', true), off = sel('casual', false);
assert.ok(cas.every((o) => o.done), 'casual (assist on) clears every run');
assert.ok(avg(cas.map((o) => o.t)) < 260, 'casual (assist on) clears in under 260 s on average');
assert.ok(cur.every((o) => o.done), 'curious (assist on) clears every run');
assert.ok(avg(cur.map((o) => o.pearls)) >= 21, 'curious finds at least 21 of 22 pearls on average');
assert.ok(cur.some((o) => o.missed.length === 0), 'curious finds every pearl in at least one run');
assert.ok(rnd.filter((o) => o.done).length / rnd.length >= 0.6, 'random clears at least 60% of runs within 30 minutes');
assert.ok(off.every((o) => o.done), 'casual (assist off) clears every run');
assert.ok(avg(off.map((o) => o.worldT.castle || 0)) < 300, 'casual (assist off) gets through the castle in under 300 s on average');
console.log(`afterdark bots: ok (${res.length} runs)`);
