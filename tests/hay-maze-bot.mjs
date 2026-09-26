// A simple planner that plays whole Hay Maze Defence runs through the real engine: it lays each hay-bale card where it
// lengthens the predators' walk the most, puts towers on the bales that reach most of the route, and picks rewards.
// It proves a run can be won and keeps the balance honest.
import assert from 'node:assert/strict';
import { Run, TOWERS, COLS, ROWS, LEVELS, cellsAt, isPiece } from '../.checks/hay-maze-game.js';

/** Route tiles within reach of (c, r). */
const cover = (b, c, r, range) => {
  let n = 0;
  for (let e = 0; e < b.entrances.length; e += 2) for (const [pc, pr] of b.route(e)) if (Math.hypot(pc - c, pr - r) <= range) n++;
  return n;
};
const walkOf = (b, d) => Math.max(...b.entrances.map(([c, r]) => d[r * COLS + c]));

/** A snaking plan: walls every third column, open at alternate ends. Bales on it score extra. */
const planned = (c, r) => c >= 2 && c <= COLS - 3 && (c - 2) % 3 === 0 && r !== ((c - 2) / 3 % 2 ? 0 : ROWS - 1);
/** Hawks fly straight from each way in to the Hearthlight; count how much of that line (c, r) can reach. */
const flightCover = (b, c, r, range) => {
  let n = 0;
  for (let e = 0; e < b.entrances.length; e += 2) {
    const [ec, er] = b.entrances[e], [hx, hy] = b.hearth;
    for (let i = 0; i <= 20; i++) { const x = ec + 0.5 + ((hx - ec - 0.5) * i) / 20, y = er + 0.5 + ((hy - er - 0.5) * i) / 20; if (Math.hypot(x - c - 0.5, y - r - 0.5) <= range) n++; }
  }
  return n;
};

/** Lays every bale card in hand where it makes the walk longest, and plays the items. */
export function lay(b) {
  for (let guard = 0; guard < 12; guard++) {
    const slot = b.hand.findIndex((id) => isPiece(id) || id === 'bundle' || id === 'cocoa');
    if (slot < 0) return;
    const id = b.hand[slot];
    if (!isPiece(id)) { b.play(slot); continue; }
    let best = null, score = -Infinity;
    for (let rot = 0; rot < 4; rot++) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (b.canPlace(id, rot, c, r) !== 'ok') continue;
      const cells = cellsAt(id, rot, c, r);
      const touching = cells.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.inGrid(x + dx, y + dy) && (b.block(x + dx, y + dy) || b.rock(x + dx, y + dy)))).length;
      const onPlan = cells.filter(([x, y]) => planned(x, y)).length;
      const s = walkOf(b, b.preview(id, rot, c, r)) * 10 + onPlan * 8 + touching;
      if (s > score) { score = s; best = [rot, c, r]; }
    }
    if (!best) { b.hand.splice(slot, 1); continue; }
    b.play(slot, best[1], best[2], best[0]);
  }
}

const PREFER = ['spark', 'lantern', 'brazier', 'bell', 'glider'];
/** Spends hay: towers on the best-placed bales, then upgrades. */
export function spend(b) {
  const run = b.run, kinds = run.unlocked.filter((k) => k !== 'bell' || b.towers.length > 6);
  for (let guard = 0; guard < 30; guard++) {
    const attackers = b.towers.length;
    const air = b.towers.filter((t) => TOWERS[t.kind].hits !== 'ground').length;
    let kind = kinds[attackers % kinds.length];
    // Anti-air only when flyers are on their way.
    const flyers = (b.plan[b.phase === 'wave' ? b.wave - 1 : b.wave] ?? []).some(([k]) => k === 'hawk');
    if (flyers && air < 2 + Math.floor(b.level / 2)) kind = kinds.includes('glider') ? 'glider' : kinds.find((k) => TOWERS[k].hits !== 'ground') ?? kind;
    else if (kind === 'glider') kind = kinds.find((k) => k !== 'glider') ?? kind;
    if (b.hay >= TOWERS[kind].cost) {
      let best = null, score = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (b.canBuild(kind, c, r) !== 'ok') continue;
        const range = b.stats(kind).range, hits = TOWERS[kind].hits;
        const s = (hits !== 'air' ? cover(b, c, r, range) : 0) + (hits !== 'ground' ? flightCover(b, c, r, range) * 2 : 0);
        if (s > score) { score = s; best = [c, r]; }
      }
      if (best && b.build(kind, ...best) === 'ok') continue;
    }
    const up = b.towers.filter((t) => b.upgradeCost(t) !== null).sort((x, y) => x.level - y.level)[0];
    if (attackers >= 6 && up && b.hay >= b.upgradeCost(up) && b.upgrade(up)) continue;
    break;
  }
}

/** Plays a whole run with seed `seed`. */
export function play(seed) {
  const run = new Run(seed);
  for (let guard = 0; guard < 200 && (run.state === 'battle' || run.state === 'reward'); guard++) {
    if (run.state === 'reward') {
      // Two strong new towers first, then relics; top up the Hearthlight when it's low.
      const strong = run.unlocked.filter((t) => PREFER.slice(0, 3).includes(t)).length;
      const tower = run.rewards.findIndex((r) => r.kind === 'tower' && PREFER.includes(r.tower));
      const relic = run.rewards.findIndex((r) => r.kind === 'relic'), heal = run.rewards.findIndex((r) => r.kind === 'heal');
      run.choose(run.flame < 8 && heal >= 0 ? heal : strong < 2 && tower >= 0 ? tower : relic >= 0 ? relic : Math.max(0, tower));
      continue;
    }
    const b = run.battle;
    lay(b); spend(b); b.sendWave();
    for (let i = 0; i < 60 * 240 && b.phase === 'wave'; i++) { if (i % 30 === 0) spend(b); b.update(1 / 60); }
  }
  return run;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = [1, 2, 3, 4, 5, 6];
  const runs = seeds.map((seed) => {
    const run = play(seed);
    console.log(`Seed ${seed}: ${run.state} on level ${run.level + 1}/${LEVELS} with the Hearthlight at ${run.flame}/${run.maxFlame}, ${run.kills} caught, towers ${run.unlocked.join(', ')}, relics ${run.relics.join(', ') || 'none'}.`);
    return run;
  });
  const won = runs.filter((r) => r.state === 'won').length;
  assert.ok(won >= 3, `the planner wins most runs (${won}/${seeds.length})`);
  assert.ok(won < seeds.length || runs.some((r) => r.flame < r.maxFlame), 'and runs aren’t a walkover');
  assert.ok(runs.every((r) => r.level >= 2), 'every run gets past the first region');
  console.log(`Passed: a maze-building planner wins ${won} of ${seeds.length} runs.`);
}
