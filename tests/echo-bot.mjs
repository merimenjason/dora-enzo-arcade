// Echo Burrow bot: every room is played from its stored inputs (tests/echo-solutions.json). For each room the main
// solution clears in two loops (so par is always reachable), the seed solution clears with the golden seed, idling
// clears nothing, and the second climber can't clear alone: with an empty first recording, the stored live run
// fails, and (without --quick) a breadth-first search over the live climber's moves never reaches the burrow door.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EchoGame, ROOMS, ROOM_COUNT, playRoom } from '../.checks/echo-game.js';

const quick = process.argv.includes('--quick');
const only = process.argv.find((a) => /^[a-z]\d$/.test(a));
const sols = JSON.parse(readFileSync(new URL('./echo-solutions.json', import.meta.url), 'utf8'));
const ACTS = [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]];

/** Breadth-first search over 8-tick moves for the live climber beside an echo that never moved. */
function soloSearch(index, budget) {
  const g = new EchoGame(index); g.lean = true;
  g.rewind(); g.skipRewind();
  const key = () => {
    const p = g.p;
    let k = `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.vx / 24)},${Math.round(p.vy / 40)},${p.ground ? 1 : 0}${p.held ? 1 : 0}`;
    for (const c of g.crates) k += `|${Math.round(c.x)},${Math.round(c.y)}`;
    for (const d of g.doors) k += `|${Math.round(d.open * 5)}${d.hold > 0 ? Math.ceil(d.hold / 30) : ''}`;
    for (const l of g.lifts) k += `|${Math.round(l.y / 4)}`;
    for (const s of g.saws) k += `|${s.down}`;
    let cr = 0; for (let i = 0; i < g.crumble.length; i++) if (g.crumble[i] !== 0) cr = (cr * 31 + i * (g.crumble[i] < 0 ? 1 : 2)) % 1e9;
    return k + `|${cr}|${g.seed ? 1 : 0}`;
  };
  const seen = new Set([key()]);
  let frontier = [g.snapshot()], nodes = 0;
  while (frontier.length && nodes < budget) {
    const next = [];
    for (const s of frontier) {
      for (const [x, j] of ACTS) {
        g.restore(s);
        for (let i = 0; i < 8 && g.phase === 'live'; i++) g.step({ x, jump: !!j });
        nodes++;
        if (g.phase === 'clear') return { cleared: true, nodes };
        const k = key();
        if (seen.has(k)) continue;
        seen.add(k); next.push(g.snapshot());
      }
      if (nodes >= budget) break;
    }
    frontier = next;
  }
  return { cleared: false, nodes, exhausted: frontier.length === 0 };
}

let rooms = 0;
const t0 = Date.now();
for (let i = 0; i < ROOM_COUNT; i++) {
  const R = ROOMS[i];
  if (only && R.id !== only) continue;
  const s = sols[R.id];
  assert.ok(s, `${R.id}: has stored solutions`);
  const main = playRoom(i, s.main[0], s.main[1]);
  assert.equal(main.phase, 'clear', `${R.id}: the main solution clears`);
  assert.ok(main.loops <= R.def.par, `${R.id}: par (${R.def.par}) is reachable`);
  const seed = playRoom(i, s.seed[0], s.seed[1]);
  assert.ok(seed.phase === 'clear' && seed.seed, `${R.id}: the seed solution clears with the seed`);
  const idle = playRoom(i, '', '', 60 * 40);
  assert.notEqual(idle.phase, 'clear', `${R.id}: idling clears nothing`);
  const alone = playRoom(i, '', s.main[1], 600);
  assert.notEqual(alone.phase, 'clear', `${R.id}: the live run alone fails`);
  let note = '';
  if (!quick) {
    const r = soloSearch(i, 60000);
    assert.ok(!r.cleared, `${R.id}: the second climber found a way out alone`);
    note = r.exhausted ? ' (alone: every move tried)' : ` (alone: ${r.nodes} moves tried)`;
  }
  rooms++;
  if (!quick) console.log(`  ${String(i + 1).padStart(2)} ${R.name.padEnd(16)} clear, seed, par${note}`);
}
console.log(`echo bot: ${rooms} room${rooms === 1 ? '' : 's'} cleared with stars and need the echo${quick ? ' (quick)' : ''} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
