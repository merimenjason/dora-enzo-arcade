// Tetherball bots. A swinger plays whole runs like a player who knows the trick: it hooks the nearest light enemy it
// can reach, whirls it while stepping away from trouble, and lets go when the swing points at the thickest crowd (or a
// wall, spikes or a pit beside one). It dashes out of a boar's charge and away from anything about to touch it, hooks
// Enzo to slam through a crowd when nothing light is near, and picks upgrades by a fixed liking. A careless one walks
// at the nearest enemy and only taps the hook. The swinger has to win some runs and get a fair way in the rest; the
// careless one must not get far, so the rope is what wins; no run may stall or produce a bad number.
import assert from 'node:assert/strict';
import { Run, DT, ARENAS, FOES, idleInput } from '../.checks/tether-game.js';

const SEEDS = process.argv.includes('--quick') ? 12 : 30;
const LIKE = ['whirl', 'heart', 'mend', 'bowl', 'elastic', 'long', 'heavy', 'blast', 'dash', 'quake', 'barb'];
const live = (r) => r.foes.filter((f) => !f.dead && f.state !== 'spawn');
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function swinger(r, mem) {
  const foes = live(r), i = { ...idleInput() };
  if (!foes.length) return i;
  // danger first: a boar winding up or charging nearby, or anything about to touch
  const threat = foes.find((f) => (f.kind === 'boar' && (f.state === 'aim' || f.state === 'charge') && d2(f, r) < 120) || (d2(f, r) < f.r + 16 && f.flung <= 0 && !(r.rope && r.rope.to.kind === 'foe' && r.rope.to.id === f.id)));
  const away = (f) => { const dx = r.x - f.x, dy = r.y - f.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
  // keep clear of anything heavy
  const big = foes.find((f) => FOES[f.kind].mass >= 6 && d2(f, r) < f.r + 50 && !(r.rope && r.rope.to.kind === 'foe' && r.rope.to.id === f.id));
  if (big) { const a = away(big); i.x = a.x; i.y = a.y; }
  // a shot on its way: step (or dash) out of its line, unless the whirling rope will block it
  const shot = r.shield ? null : r.shots.find((s) => { const dx = r.x - s.x, dy = r.y - s.y, v = Math.hypot(s.vx, s.vy), along = (dx * s.vx + dy * s.vy) / v; if (along < 0 || along > 90) return false; const off = Math.abs(dx * s.vy - dy * s.vx) / v; return off < 12; });
  if (shot) { const v = Math.hypot(shot.vx, shot.vy), side = { x: -shot.vy / v, y: shot.vx / v }, k = side.x * (r.x - shot.x) + side.y * (r.y - shot.y) >= 0 ? 1 : -1; i.x = side.x * k; i.y = side.y * k; if (r.dashCd <= 0 && !r.rope) i.dash = true; }
  if (threat && r.dashCd <= 0 && !(r.rope && r.rope.to.kind !== 'foe')) { const a = away(threat); const side = { x: -a.y, y: a.x }; i.x = a.x * 0.4 + side.x; i.y = a.y * 0.4 + side.y; i.dash = true; }
  if (r.rope) {
    const held = r.rope.to.kind === 'foe' ? r.foe(r.rope.to.id) : null;
    mem.held += DT;
    if (held) {
      // let go when the swing points at a crowd
      const v = Math.hypot(held.vx, held.vy), dir = { x: held.vx / (v || 1), y: held.vy / (v || 1) };
      let best = 0;
      for (const f of foes) if (f !== held) { const dx = f.x - held.x, dy = f.y - held.y, l = Math.hypot(dx, dy); if (l < 220) { const dot = (dx * dir.x + dy * dir.y) / (l || 1); if (dot > 0.93) best += 1 + (220 - l) / 220; } }
      const ready = v > Math.min(200, 0.85 * mem.cap);
      if ((ready && best >= 1) || mem.held > 3.2) { i.hook = false; mem.held = 0; return i; }
      i.hook = true;
      // drift away from the nearest walker while whirling
      const near = foes.filter((f) => f !== held).sort((a, b) => d2(a, r) - d2(b, r))[0];
      if (near && d2(near, r) < 70 && !i.dash && !shot && !big) { const a = away(near); i.x = a.x; i.y = a.y; }
      return i;
    }
    // swinging round Enzo: let go after a lap and a bit, or once something has been slammed
    i.hook = mem.held < 1.4; if (!i.hook) mem.held = 0; return i;
  }
  mem.held = 0;
  // pick something light to hook, or Enzo when the only things near are heavy
  const light = foes.filter((f) => FOES[f.kind].mass <= 3).sort((a, b) => d2(a, r) - d2(b, r));
  const target = light[0] ?? null;
  if (target) {
    mem.cap = FOES[target.kind].mass >= 3 ? 190 : 235;
    const d = d2(target, r);
    if (d < r.ropeMax - 10 && r.hookCd <= 0 && !r.hook) { i.ax = target.x - r.x; i.ay = target.y - r.y; i.hook = true; return i; }
    if (r.hook) { i.hook = true; return i; }
    if (!i.dash && !shot && !big) { const dx = target.x - r.x, dy = target.y - r.y, l = Math.hypot(dx, dy) || 1; i.x = dx / l; i.y = dy / l; }
    return i;
  }
  const e = r.layout.enzo, de = d2(e, r);
  if (de < r.ropeMax - 10 && r.hookCd <= 0 && !r.hook) { i.ax = e.x - r.x; i.ay = e.y - r.y; i.hook = true; return i; }
  if (r.hook) { i.hook = true; return i; }
  if (!i.dash) { const dx = e.x - r.x, dy = e.y - r.y, l = Math.hypot(dx, dy) || 1; i.x = dx / l; i.y = dy / l; }
  return i;
}

function careless(r) {
  const foes = live(r), i = { ...idleInput() }; if (!foes.length) return i;
  const t = foes.sort((a, b) => d2(a, r) - d2(b, r))[0], dx = t.x - r.x, dy = t.y - r.y, l = Math.hypot(dx, dy) || 1;
  i.x = dx / l; i.y = dy / l; i.ax = dx; i.ay = dy; i.hook = Math.floor(r.t * 4) % 2 === 0; return i;
}

function play(seed, brain) {
  const r = new Run({ seed }), mem = { held: 0, cap: 235 };
  let ticks = 0, stuck = 0, lastKills = 0;
  while (!r.over && ticks < 60 * 60 * 40) {
    if (r.phase === 'pick') { r.pick([...r.offer].sort((a, b) => LIKE.indexOf(a) - LIKE.indexOf(b))[0]); continue; }
    const i = brain(r, mem);
    // a new hook needs a new press: let go for a tick first if the button was still down with nothing on the rope
    if (i.hook && mem.down && !r.rope && !r.hook) i.hook = false;
    mem.down = i.hook;
    r.tick(i); ticks++;
    for (const v of [r.x, r.y, r.vx, r.vy, ...r.foes.flatMap((f) => [f.x, f.y, f.vx, f.vy])]) assert.ok(Number.isFinite(v), `seed ${seed}: a bad number`);
    if (r.stats.kills !== lastKills) { lastKills = r.stats.kills; stuck = 0; }
    else if (++stuck > 60 * 90) { if (brain === swinger) throw new Error(`seed ${seed}: no kill for 90 s in arena ${r.arena + 1}`); break; }
  }
  assert.ok(r.over || brain !== swinger, `seed ${seed}: the run ended`);
  return { won: r.phase === 'won', arena: r.phase === 'won' ? ARENAS : r.arena + 1, secs: ticks * DT, kills: r.stats.kills, combo: r.stats.bestCombo, speed: r.stats.topSpeed };
}

const sw = [], cl = [];
for (let s = 1; s <= SEEDS; s++) { sw.push(play(s, swinger)); cl.push(play(1000 + s, careless)); }
const avg = (a, k) => a.reduce((t, x) => t + x[k], 0) / a.length;
const wins = sw.filter((x) => x.won).length;
console.log(`swinger: ${wins}/${SEEDS} won, arena ${avg(sw, 'arena').toFixed(1)} on average (furthest ${Math.max(...sw.map((x) => x.arena))}), ${avg(sw, 'kills').toFixed(0)} kills, best combo ${Math.max(...sw.map((x) => x.combo))}, ${(avg(sw, 'secs') / 60).toFixed(1)} min a run`);
console.log(`careless: ${cl.filter((x) => x.won).length}/${SEEDS} won, arena ${avg(cl, 'arena').toFixed(1)} on average (furthest ${Math.max(...cl.map((x) => x.arena))})`);
console.log('swinger arenas:', sw.map((x) => x.arena).join(' '));
assert.ok(wins >= 1, 'the swinger wins some runs');
assert.ok(wins <= SEEDS * 0.8, 'but not nearly all of them');
assert.ok(avg(sw, 'arena') >= 5, 'and gets a fair way in the rest');
assert.ok(avg(cl, 'arena') < avg(sw, 'arena') - 2, 'the careless player gets much less far');
console.log('Tetherball bots passed');
