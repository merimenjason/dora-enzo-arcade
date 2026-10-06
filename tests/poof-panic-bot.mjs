// Poof Panic balance bot: plays rivals against each other and against three stand-in players, round after round.
// RUNS=40 node tests/poof-panic-bot.mjs   (HARD=1 for the hard ladder)
import assert from 'node:assert/strict';
import { Match, Brain, RIVALS, harder, TPS } from '../.checks/poof-panic-game.js';

const RUNS = Number(process.env.RUNS ?? 30), HARD = !!process.env.HARD, LIMIT = TPS * 420;
// Three kinds of player, written as rivals: one who pops whatever turns up, one who makes two-chains, one who builds threes.
const base = { id: 'p', kind: 'p', title: '', blurb: '', depth: 1, poke: 0, gravity: 1 / 40, style: 'sprinkle' };
export const PLAYERS = {
  novice: { ...base, name: 'novice', think: 40, pace: 12, drop: 0.3, greed: 1, sight: 0, slip: 0.22, poke: 1 },
  casual: { ...base, name: 'casual', think: 26, pace: 9, drop: 0.5, greed: 2, sight: 0.6, slip: 0.1 },
  keen: { ...base, name: 'keen', think: 18, pace: 7, drop: 0.7, greed: 3, sight: 1, slip: 0.05 },
  sharp: { ...base, name: 'sharp', think: 12, pace: 5, drop: 0.85, greed: 4, sight: 1, slip: 0.03, depth: 2 },
};

/** One round with a brain on the player's side. Returns who won and what happened. */
export function round(player, rival, seed) {
  const m = new Match({ seed, rival, hero: 'dora' }), me = new Brain(player, seed + 404);
  while (m.winner < 0 && m.tick < LIMIT) m.step(me.step(m.a));
  return { winner: m.winner, secs: m.tick / TPS, a: m.a, b: m.b };
}
export function series(player, rival, runs = RUNS, from = 1) {
  let wins = 0, secs = 0, chain = 0, sent = 0, stuck = 0;
  for (let i = 0; i < runs; i++) {
    const r = round(player, rival, from + i * 7919);
    if (r.winner === 0) wins++;
    if (r.winner < 0) stuck++;
    secs += r.secs; chain += r.b.best; sent += r.b.sent;
  }
  return { rate: wins / runs, secs: secs / runs, chain: chain / runs, sent: sent / runs, stuck };
}

const rivals = RIVALS.map((r) => (HARD ? harder(r) : r)), pct = (v) => `${Math.round(v * 100)}%`.padStart(5);
console.log(`Poof Panic bot: ${RUNS} rounds a pairing${HARD ? ', hard ladder' : ''}`);
console.log('\nA stand-in player against each rival (share of rounds the player wins):');
console.log('         ' + rivals.map((r) => r.id.padStart(7)).join(''));
const table = {};
for (const [name, p] of Object.entries(PLAYERS)) {
  table[name] = rivals.map((r) => series(p, r));
  console.log(name.padEnd(9) + table[name].map((s) => pct(s.rate).padStart(7)).join(''));
}
console.log('\nEach rival against the casual player: round length, longest chain a round, dust sent a round');
rivals.forEach((r, i) => { const s = table.casual[i]; console.log(`${r.id.padEnd(8)} ${s.secs.toFixed(0).padStart(4)} s  chain ${s.chain.toFixed(1)}  dust ${s.sent.toFixed(0).padStart(4)}${s.stuck ? `  (${s.stuck} unfinished)` : ''}`); });
console.log('\nRival against the rival one rung below (share of rounds the higher one wins):');
const climb = [];
for (let i = 1; i < rivals.length; i++) { const s = series(rivals[i], rivals[i - 1]); climb.push(s.rate); console.log(`${rivals[i].id} beats ${rivals[i - 1].id}: ${pct(s.rate)}`); }

if (!process.env.TRIAL) {
  // On the hard ladder the bottom two are close; the order is only promised on the ordinary one.
  if (!HARD) for (const [i, rate] of climb.entries()) assert.ok(rate >= 0.5, `${rivals[i + 1].id} should beat ${rivals[i].id} more often than not (${pct(rate)})`);
  for (const name of Object.keys(PLAYERS)) for (let i = 0; i < rivals.length; i++) assert.equal(table[name][i].stuck, 0, `${name} v ${rivals[i].id}: every round ends`);
  console.log('\nPoof Panic bot checks passed.');
}
