// A simple gardener that plays Chinchillas vs Zombies through the real engine: it collects every seed, plants Seed
// Gatherers at the back, shooters in front of them, Grandpa Pebble further out, and drops boulders and traps on
// crowded lanes. It proves every level can be won, and that doing nothing loses.
import assert from 'node:assert/strict';
import { Game, LEVELS, DEFENDERS, COLS } from '../.checks/cvz-game.js';

/** One decision pass, in priority order. When the most important thing can't be afforded yet, it waits. */
export function tend(g) {
  g.collectAll();
  const rows = g.def.rows, has = (k) => g.unlocked.includes(k);
  const plant = (kind, row, col) => g.canPlant(kind, row, col) === 'ok' && g.plant(kind, row, col) === 'ok';
  const threat = (row) => g.zombies.filter((z) => z.row === row).reduce((s, z) => s + z.hp + z.armor, 0);
  const guns = (row) => g.defenders.filter((d) => d.row === row && DEFENDERS[d.kind].kind === 'shooter').length;
  const shooter = has('twins') ? 'twins' : 'flicker';
  // The cheap Flicker answers a fresh threat; Frost Fans and Twin Flickers come as the lane fills out.
  const pick = (row) => (guns(row) === 0 ? 'flicker' : has('frost') && guns(row) % 2 === 1 ? 'frost' : shooter);
  const free = (row, cols) => cols.find((c) => !g.at(row, c));
  /** Plants if it can; returns false when it should wait for seeds or a recharge. */
  const want = (kind, row, col) => {
    if (col === undefined) return true;
    if (g.seeds < DEFENDERS[kind].cost || g.recharge[kind] > 0) return false;
    plant(kind, row, col);
    return true;
  };
  // A boulder on any lane that's about to be overrun.
  if (has('boulder')) for (const r of rows) {
    const lead = g.zombies.filter((z) => z.row === r && z.x < COLS - 0.5).sort((a, b) => a.x - b.x)[0];
    if (lead && (threat(r) >= 900 || (lead.x < 3 && threat(r) > 300))) { const c = Math.max(0, Math.min(COLS - 1, Math.floor(lead.x - 0.2))); plant('boulder', r, g.at(r, c) ? Math.min(COLS - 1, c + 1) : c); }
  }
  // A pogo coming with nothing in front to jump: give it something cheap to jump, ahead of the shooters.
  for (const z of g.zombies) {
    if (z.kind !== 'pogo' || z.jumped) continue;
    const front = Math.max(-1, ...g.defenders.filter((d) => d.row === z.row).map((d) => d.col));
    const ahead = g.defenders.some((d) => d.row === z.row && d.col > 2 && DEFENDERS[d.kind].kind !== 'shooter' && d.col < z.x);
    if (ahead || front < 0) continue;
    const col = Math.min(COLS - 1, Math.floor(z.x) - 1);
    if (col > front) for (const kind of ['pebble', 'trap', 'gatherer']) if (has(kind) && plant(kind, z.row, col)) break;
  }
  // 1. Lanes under attack: a shooter for every 250 health coming, most threatened lane first.
  for (const r of [...rows].sort((a, b) => threat(b) - threat(a))) {
    const need = Math.max(threat(r) > 0 ? 1 : 0, Math.ceil(threat(r) / 250));
    if (guns(r) < need && !want(pick(r), r, free(r, [2, 3, 4, 5, 1, 6]))) return;
  }
  // 2. Pogo levels: Grandpa Pebble out in front of every lane that has a shooter, to take the jump.
  if (has('pebble') && g.def.pool.includes('pogo')) for (const r of rows) if (guns(r) && !g.at(r, 7) && !want('pebble', r, 7)) break;
  // 3. Two gatherers a lane.
  for (const col of [0, 1]) for (const r of rows) if (!g.at(r, col) && !want('gatherer', r, col)) return;
  // 4. More shooters, evenly, up to five a lane.
  for (const r of [...rows].sort((a, b) => guns(a) - guns(b))) if (guns(r) < 5 && !want(pick(r), r, free(r, [2, 3, 4, 5, 6]))) return;
  // 5. Spare seeds: traps in front of lanes with zombies.
  if (has('trap')) for (const r of rows) if (threat(r) > 0) plant('trap', r, 8);
}

export function play(level, seed = 1, idle = false) {
  const g = new Game(level, seed);
  for (let i = 0; i < 60 * 60 * 12 && g.state === 'playing'; i++) { if (!idle && i % 15 === 0) tend(g); g.update(1 / 60); }
  return g;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (let n = 0; n < LEVELS.length; n++) {
    const g = play(n), carts = g.carts.filter((c) => c !== 'ready').length - (5 - g.def.rows.length);
    console.log(`Level ${n + 1} (${LEVELS[n].name}): ${g.state} at ${g.time.toFixed(0)}s, ${g.kills} zombies, ${carts} hay cart${carts === 1 ? '' : 's'} used, ${g.defenders.length} defenders standing.`);
    assert.equal(g.state, 'won', `level ${n + 1} can be won`);
  }
  for (const n of [0, 3, 7]) assert.equal(play(n, 1, true).state, 'lost', `doing nothing loses level ${n + 1}`);
  console.log('Passed: a simple gardener wins all eight levels, and doing nothing loses.');
}
