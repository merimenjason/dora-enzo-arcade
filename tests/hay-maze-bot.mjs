// A simple planner that plays Hay Maze Defence through the real engine, to prove every map can be won by building a
// maze, and that the maps get harder in order.
import assert from 'node:assert/strict';
import { MazeGame, MAPS, COLS, ROWS, TOWERS, WAVES, TOTAL_WAVES } from '../.checks/hay-maze-game.js';

/** Wall columns every third tile, each open at alternate ends, so the route snakes up and down the map. */
export function plan(g) {
  const tiles = [];
  let flip = false;
  for (let c = 2; c < COLS - 2; c += 3) {
    const rows = [...Array(ROWS).keys()].filter((r) => (flip ? r !== 0 : r !== ROWS - 1));
    for (const r of flip ? rows.reverse() : rows) tiles.push([c, r]);
    flip = !flip;
  }
  return tiles.filter(([c, r]) => !g.rock(c, r) && !g.isEntrance(c, r) && !g.isExit(c, r));
}

const ORDER = ['flicker', 'puffer', 'roller', 'flicker', 'roller', 'bell'];
/** Route tiles within reach of a tower on (c, r). */
const cover = (g, c, r, range) => {
  let n = 0;
  for (let e = 0; e < g.entrances.length; e++) for (const [pc, pr] of g.route(e)) if (Math.hypot(pc - c, pr - r) <= range) n++;
  return n;
};

/** One planning pass: fill the maze with bales, then put towers where they reach the most of the route. */
export function think(g, { maze = true, ratio = 1 } = {}) {
  const spots = maze ? plan(g) : [];
  const upcoming = WAVES.slice(Math.max(0, g.wave - 1), g.wave + 2).flat().some(([k]) => k === 'hawk' || k === 'lynx');
  let gliders = g.towers.filter((t) => t.kind === 'glider').length;
  const attackers = g.towers.filter((t) => t.kind !== 'hay');
  const bestSpot = (kind, pool) => {
    let best = null, score = -Infinity;
    for (const [c, r] of pool) {
      if (g.canBuild(kind, c, r) !== 'ok') continue;
      const s = kind === 'glider' ? -Math.hypot(COLS - c, ROWS / 2 - r) : cover(g, c, r, TOWERS[kind].levels[0].range);
      if (s > score) { best = [c, r]; score = s; }
    }
    return best;
  };
  // Towers go wherever they reach most of the route; bales fill in the maze plan.
  const pool = [...Array(COLS * ROWS).keys()].map((i) => [i % COLS, (i / COLS) | 0]);
  const wall = () => { const at = spots.find(([c, r]) => g.canBuild('hay', c, r) === 'ok'); return !!at && g.build('hay', ...at) === 'ok'; };
  for (let guard = 0; guard < 40; guard++) {
    if (upcoming && gliders < 1 + Math.floor(g.wave / 5)) {
      if (g.hay < TOWERS.glider.cost) break;
      const at = bestSpot('glider', pool); if (at && g.build('glider', ...at) === 'ok') { gliders++; continue; }
    }
    const kind = ORDER[attackers.length % ORDER.length], walls = g.towers.length - attackers.length;
    const buy = () => { const at = bestSpot(kind, pool); if (at && g.build(kind, ...at) === 'ok') { attackers.push(g.towers.at(-1)); return true; } return false; };
    if (attackers.length < 2 + g.wave) { if (g.hay >= TOWERS[kind].cost && buy()) continue; break; }
    if (walls < ratio * attackers.length && g.hay >= 4 && wall()) continue;
    const up = attackers.filter((t) => g.upgradeCost(t) !== null).sort((x, y) => x.level - y.level)[0];
    if (attackers.length >= 12 && up && g.hay >= g.upgradeCost(up) && g.upgrade(up)) continue;
    if (g.hay >= TOWERS[kind].cost && buy()) continue;
    break;
  }
}

export function play(round, opts = {}) {
  const g = new MazeGame(round);
  think(g, opts);
  g.sendWave();
  for (let i = 0; i < 60 * 60 * 40 && (g.state === 'playing'); i++) {
    if (i % 30 === 0) think(g, opts);
    g.update(1 / 60);
  }
  return g;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const kept = MAPS.map((m, round) => {
    const open = new MazeGame(round).walk, g = play(round);
    console.log(`${m.name}: ${g.state} with ${g.raisins} raisins left, ${g.kills} caught; the walk grew from ${open} to ${g.walk} tiles.`);
    assert.equal(g.state, 'won', `${m.name} can be won`);
    assert.equal(g.wave, TOTAL_WAVES);
    assert.ok(g.walk >= open * 2, 'the maze at least doubles the walk');
    return g.raisins;
  });
  assert.ok(kept[0] > kept[1] && kept[1] > kept[2], `each map is harder than the last (${kept.join(', ')} raisins kept)`);
  console.log('Passed: a maze-building planner wins every map, and each map is harder than the last.');
}
