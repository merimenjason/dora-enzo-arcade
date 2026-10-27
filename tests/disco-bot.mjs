// Dust Disco bots: a steady player with human timing should clear every song, and the harder charts should cost them more.
import assert from 'node:assert/strict';
import { SONGS, DIFFS, DiscoGame } from '../.checks/disco-game.js';

// a seeded generator, so a run replays exactly
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Presses each note `spread` seconds off on average, sometimes forgets one, lets holds go a little early or late, and uses Dust Up in the chorus. */
function player(id, diff, { spread, slip, seed }) {
  const r = rng(seed), g = new DiscoGame(id, diff), tl = [];
  for (const n of g.chart.notes) {
    if (r() < slip) continue;
    const at = n.t + gauss(r) * spread;
    tl.push([at, 'p', n.lane]);
    tl.push([n.len ? n.t + n.len + gauss(r) * spread : at + 0.08, 'r', n.lane]);
  }
  tl.sort((a, b) => a[0] - b[0]);
  for (const [t, k, lane] of tl) { if (g.state !== 'play') break; if (g.sparkle >= 100) g.dust(t); k === 'p' ? g.press(lane, t) : g.release(lane, t); }
  g.tick(g.chart.end + 0.1);
  return g.result();
}

const table = [];
for (const s of SONGS) {
  const row = { song: s.title };
  for (const d of DIFFS) {
    const steady = player(s.id, d, { spread: 0.035, slip: 0.01, seed: 7 });
    const shaky = player(s.id, d, { spread: 0.07, slip: 0.05, seed: 11 });
    assert.ok(steady.cleared, `a steady player clears ${s.title} on ${d}`);
    assert.ok(steady.accuracy >= 85, `a steady player reads ${s.title} on ${d} well (${steady.accuracy}%)`);
    if (d !== 'hard') assert.ok(shaky.cleared, `a shaky player still clears ${s.title} on ${d}`);
    const again = player(s.id, d, { spread: 0.035, slip: 0.01, seed: 7 });
    assert.equal(again.score, steady.score, 'a seeded run replays exactly');
    row[d] = `${steady.grade} ${steady.accuracy}% / ${shaky.cleared ? shaky.grade : 'fail'}`;
  }
  table.push(row);
}
console.table(table);
console.log(`Dust Disco bot: a steady player clears all ${SONGS.length * 3} charts, a shaky one clears every easy and normal chart.`);
