// Puttering Paws bot. `node tests/putt-bot.mjs --find [hole ids]` searches for a par line and an acorn line for each hole
// and prints them for lib/putt-courses.ts. Without --find it plays every hole as a careful player who aims along the game's
// suggested line and misses each putt a little (±5° and ±20% power), eight times, and checks that par is fair: the average
// lands between par - 1 and par + 1.
import assert from 'node:assert/strict';
import { ALL_HOLES } from '../.checks/putt-game.js';
import { search, noisyRound, seeded } from './putt-solver.mjs';

const args = process.argv.slice(2), find = args.includes('--find'), only = args.filter((a) => !a.startsWith('--'));
const holes = ALL_HOLES.filter((h) => !only.length || only.includes(h.id));
if (find) {
  for (const h of holes) {
    const t0 = Date.now();
    const proof = search(h.id, { limit: h.par }), acorn = search(h.id, { limit: h.par + 2, acorn: true });
    const fmt = (r) => (r ? JSON.stringify(r.line) : 'null');
    console.log(`${h.id} par ${h.par}: proof ${fmt(proof)} (${proof?.strokes ?? '-'}) acornProof ${fmt(acorn)} (${acorn?.strokes ?? '-'}) ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
} else {
  const rows = [];
  for (const h of holes) {
    const rand = seeded(h.id.length * 977 + h.par), scores = Array.from({ length: 8 }, () => noisyRound(h.id, rand));
    const mean = scores.reduce((s, n) => s + n, 0) / scores.length;
    rows.push({ id: h.id, par: h.par, mean, scores });
    console.log(`${h.id.padEnd(12)} par ${h.par}  careful player ${mean.toFixed(2)}  [${scores.join(' ')}]`);
  }
  for (const r of rows) assert.ok(r.mean >= r.par - 1 && r.mean <= r.par + 1, `${r.id}: par ${r.par} is unfair, a careful player averages ${r.mean.toFixed(2)}`);
  console.log(`Puttering Paws bot: par is fair on all ${rows.length} holes.`);
}
