// Kumori Pass bots. A competent, human-like driver (the AI's racing-line follower reacting 0.2 s late, wandering off the
// line, through the smoothed steering, with small seeded mistakes) finishes every pass
// cleanly and beats every rival in a fair share of seeded duels, the dawn champion hardest of all; a full-throttle,
// no-brake driver crashes or loses past the first rival; and the delivery medal times in the engine come from the
// competent bot's real runs. `--quick` runs fewer seeds (used by npm test).
import assert from 'node:assert/strict';
import { Race, Duel, RIVALS, PASSES, BOT_TIMES, BUNS, idleInput, getTrack, at, DT, REMATCH_RIVALS } from '../.checks/pass-game.js';

const quick = process.argv.includes('--quick');
const SEEDS = 16; // the whole run takes seconds, so --quick only trims the naive checks
const PACE = 0.985;
const ladderUpgrades = ['tyres', 'flywheel', 'lsd', 'rack', 'intake'];
const t0 = Date.now();

// ---- deliveries: the competent bot finishes every pass, and its times set the medals
const measured = {};
for (const p of PASSES) {
  const r = new Race({ pass: p.id, autopilot: PACE, buns: true, countdown: 0.1, seed: 3, noteLevel: 3 });
  let steps = 0; while (!r.done && steps < 120 * 300) { r.tick(idleInput()); steps++; }
  assert.ok(r.done, `${p.id}: the bot finishes`);
  assert.equal(r.player.resets, 0, `${p.id}: no spins`);
  assert.ok(r.buns >= BUNS - 1, `${p.id}: buns intact (${r.buns})`);
  measured[p.id] = +r.player.finished.toFixed(2);
}
console.log('delivery times', JSON.stringify(measured));
if (!process.env.TUNE) for (const p of PASSES) assert.ok(Math.abs(BOT_TIMES[p.id] - measured[p.id]) <= Math.max(0.6, measured[p.id] * 0.01),
  `BOT_TIMES.${p.id} (${BOT_TIMES[p.id]}) matches the bot's real run (${measured[p.id]})`);
// the uphill relay leg too
{
  const r = new Race({ pass: 'summit', reversed: true, autopilot: PACE, countdown: 0.1, seed: 3 });
  let steps = 0; while (!r.done && steps < 120 * 300) { r.tick(idleInput()); steps++; }
  assert.ok(r.done && r.player.resets === 0, 'the uphill leg is drivable');
  console.log('uphill leg', r.player.finished.toFixed(2));
}

// ---- duels
function runDuel(rivalId, seed, driver) {
  const i = RIVALS.findIndex((r) => r.id === rivalId);
  const d = new Duel({ rival: rivalId, relay: rivalId === 'fox', seed, upgrades: ladderUpgrades.slice(0, i), autopilot: driver === 'bot' ? PACE : 0, countdown: 0.1, noteLevel: 3 });
  const inp = idleInput();
  while (!d.over) {
    const r = d.race; let steps = 0;
    while (!r.done && steps < 120 * 240) {
      if (driver === 'naive') naive(r, inp);
      r.tick(inp); steps++;
    }
    if (!r.done) return { won: false, rounds: d.rounds.length, stuck: true };
    if (!d.finishRound()) d.startRound();
  }
  return { won: d.winner === 0, rounds: d.rounds.length, crashes: d.rounds.filter((x) => x.result.reason === 'crash' && x.result.winner === 1).length };
}
// flat out, no brakes: steer at the centreline a little way ahead
function naive(r, out) {
  const c = r.player.car, t = r.track, j = at(t, r.player.s + 8);
  const dx = t.x[j] - c.x, dy = t.y[j] - c.y, ly = -dx * Math.sin(c.h) + dy * Math.cos(c.h);
  out.steer = Math.max(-1, Math.min(1, ly * 0.35)); out.throttle = 1; out.brake = 0; out.hand = false;
}

const share = {};
for (const rv of RIVALS) {
  let wins = 0, rounds = 0;
  for (let s = 1; s <= SEEDS; s++) { const res = runDuel(rv.id, s * 101, 'bot'); if (res.won) wins++; rounds += res.rounds; }
  share[rv.id] = wins / SEEDS;
  console.log(`bot vs ${rv.name.padEnd(9)} won ${wins}/${SEEDS}  avg rounds ${(rounds / SEEDS).toFixed(1)}`);
}
// the human-like bot's ladder: the first two rivals forgiving, then rising to the dawn champion, and Hush after the story
const TARGET = { stoat: 16, otter: 14, badger: 13, pika: 12, bat: 11, goat: 9, fox: 7, owl: 5 };
for (const rv of RIVALS) assert.ok(Math.abs(share[rv.id] * SEEDS - TARGET[rv.id]) <= 2, `${rv.name}: ${share[rv.id] * SEEDS}/${SEEDS} wins, near the ${TARGET[rv.id]} the ladder wants`);
assert.ok(share.stoat >= 15 / 16 && share.otter >= 12 / 16, 'the first two rivals are forgiving');
for (const rv of RIVALS) if (rv.id !== 'fox' && rv.id !== 'owl') assert.ok(share.fox <= share[rv.id], `Aurora is the hardest in the story (${share.fox} vs ${rv.name} ${share[rv.id]})`);
assert.ok(share.owl <= share.fox, `Hush, after the story, is harder still (${share.owl} vs Aurora ${share.fox})`);

// rematches after the story: on each pass, with the ladder's five parts, the bot wins about half of them against the six duel rivals
{
  const RS = 8, table = [];
  for (const p of PASSES) {
    const row = REMATCH_RIVALS.map((rv) => { let w = 0; for (let s = 1; s <= RS; s++) { const d = new Duel({ rival: rv, pass: p.id, rematch: true, seed: s * 101, upgrades: ladderUpgrades, autopilot: PACE, countdown: 0.1, noteLevel: 3 });
      while (!d.over) { const r = d.race; let n = 0; while (!r.done && n < 120 * 240) { r.tick(idleInput()); n++; } if (!r.done) break; if (!d.finishRound()) d.startRound(); } if (d.winner === 0) w++; } return w; });
    const share = row.reduce((a, b) => a + b) / (row.length * RS);
    table.push(`${p.id} ${row.join('/')}`);
    assert.ok(share >= 0.3 && share <= 0.7, `rematches on ${p.name}: the bot wins ${(share * 100).toFixed(0)}%, near half`);
  }
  console.log(`rematch bot wins of ${RS} (${REMATCH_RIVALS.join('/')}): ${table.join('  ')}`);
}

let naiveWins = 0, naiveCrashes = 0;
for (const rv of RIVALS.slice(1)) for (let s = 1; s <= (quick ? 2 : 4); s++) {
  const res = runDuel(rv.id, s * 7, 'naive'); if (res.won) naiveWins++; naiveCrashes += res.crashes ?? 0;
}
{
  const r = new Race({ pass: 'stairs', countdown: 0.1, buns: true }); const inp = idleInput(); let steps = 0;
  while (!r.done && steps < 120 * 200) { naive(r, inp); r.tick(inp); steps++; }
  console.log(`naive delivery on the Hairpin Stairs: ${r.done ? r.player.finished.toFixed(1) + ' s' : 'did not finish'}, ${r.player.resets} resets, ${r.buns} buns, ${r.hits} wall hits`);
  assert.ok(r.player.resets > 0 || r.buns < BUNS / 2, 'flat out with no brakes wrecks a delivery');
}
console.log(`naive vs rivals 2-7: won ${naiveWins}, crashed out of ${naiveCrashes} rounds`);
assert.equal(naiveWins, 0, 'flat out with no brakes never wins past the first rival');
console.log(`pass-bot: all good in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
void getTrack; void DT;
