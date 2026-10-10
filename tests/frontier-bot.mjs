// A steady settler that plays Frostpaw Frontier through the real engine: it keeps the hay coming, builds lodges and
// quarries, nests for newcomers, a lantern over its workshops and watchtowers when the next raid looks too strong,
// raises the burrow, trains its heroes, clears dens it can beat, and explores towards the summit. It proves every map
// can be won and that standing still loses.
import assert from 'node:assert/strict';
import { Game, MAPS, BUILDINGS, DENS, HOME, W, H, HQ_COST, HQ_MAX, heroPower } from '../.checks/frontier-game.js';

const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const count = (g, kind) => g.buildings.filter((b) => b.kind === kind).length;

/** Every open tile you could build `kind` on, nearest home first. */
function spots(g, kind) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.canBuild(kind, x, y) !== 'terrain' && g.canBuild(kind, x, y) !== 'taken' && g.canBuild(kind, x, y) !== 'fog' && g.canBuild(kind, x, y) !== 'hq') out.push({ x, y });
  return out.sort((a, b) => near(a, HOME) - near(b, HOME) + (g.lit(b.x, b.y) - g.lit(a.x, a.y)) * 2);
}
/** Builds one `kind` if it can; returns false when it should save up for it instead. */
function put(g, kind, where) {
  const s = where ?? spots(g, kind)[0];
  if (!s) return true;
  return g.build(kind, s.x, s.y) === 'ok';
}

export function tend(g) {
  if (g.state === 'event') {
    const id = g.pending.event, pick = id === 'kit' ? (g.survivors < g.housing ? 0 : 1) : id === 'storm' ? (g.stock.wood >= 80 ? 0 : 1) : id === 'owl' ? (g.stock.hay >= 90 ? 0 : 1) : 0;
    if (!g.choose(pick)) g.choose(pick ? 0 : 1);
    return;
  }
  if (g.state !== 'playing') return;
  const inc = g.income();
  // The beacon, as soon as it can go up.
  const s = g.summit;
  if (g.tile(s.x, s.y).f === 'beacon' && g.canBuild('beacon', s.x, s.y) === 'ok') { g.build('beacon', s.x, s.y); return; }
  for (const b of g.buildings) if (b.damaged) g.repair(b.id);
  // Dens the squad can beat, the lair last.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = g.tile(x, y);
    if (t.seen && t.den && g.squadPower >= DENS[t.den].power && g.canAttack(x, y) === 'ok') g.attack(x, y);
  }
  // Explore first, since it costs only stamina: the nearest tile to home, or towards the summit once the burrow is big, cheap ones first.
  let pick = null, score = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g.canExplore(x, y) !== 'ok') continue;
    const v = (g.hqLevel >= 3 ? near({ x, y }, s) : near({ x, y }, HOME) * 2) + g.staminaCost(x, y) * 1.5;
    if (v < score) { score = v; pick = { x, y }; }
  }
  if (pick) g.explore(pick.x, pick.y);
  // Move hands where they're needed: to farms while hay is falling, to an empty quarry or watchtower when wood piles up.
  const move = (to) => {
    const from = g.buildings.filter((b) => b.kind === 'lodge' && b.workers > 0).sort((a, b) => b.workers - a.workers)[0] ?? (to.kind !== 'farm' ? null : null);
    if (g.idle <= 0 && from) g.assign(from.id, -1);
    g.assign(to.id, 1);
  };
  const short = (kind) => g.buildings.find((b) => b.kind === kind && !b.damaged && b.workers < BUILDINGS[kind].workers);
  if (inc.hay < 0.25 && short('farm')) move(short('farm'));
  else if (g.stock.wood > 80 && short('quarry')) move(short('quarry'));
  else if (g.stock.wood > 80 && short('tower')) move(short('tower'));
  // Food first.
  const unstaffed = (kind) => g.buildings.some((b) => b.kind === kind && b.workers < BUILDINGS[kind].workers);
  if (inc.hay < 0.25 && !unstaffed('farm') && !put(g, 'farm')) return;
  // Room for everyone waiting.
  const waiting = g.tiles.filter((t) => t.seen && t.f === 'stray').length;
  if ((waiting > 0 || g.survivors >= g.housing) && g.idle <= 0 && count(g, 'nest') < 6 && !put(g, 'nest')) return;
  if (count(g, 'lodge') < 2 + g.hqLevel && !unstaffed('lodge') && !put(g, 'lodge')) return;
  if (g.hqLevel >= 2 && count(g, 'quarry') < Math.max(2, g.hqLevel) && !unstaffed('quarry') && !put(g, 'quarry')) return;
  // A watchtower when the coming raid would get through.
  const next = g.raidStrength(g.night ? g.day + 1 : g.day);
  if (g.hqLevel >= 2 && next > g.defence() - 4 && !unstaffed('tower') && !put(g, 'tower')) return;
  if (g.hqLevel >= 2 && count(g, 'lantern') < 1 + Math.floor(g.buildings.length / 8)) {
    // Over the most workshops.
    let best = null, most = 0;
    for (const sp of spots(g, 'lantern')) { const n = g.buildings.filter((b) => BUILDINGS[b.kind].make && near(b, sp) <= g.reach() && !g.lit(b.x, b.y)).length; if (n > most) { most = n; best = sp; } }
    if (best && most >= 3 && !put(g, 'lantern', best)) return;
  }
  if (g.hqLevel < HQ_MAX && g.canUpgrade() === 'ok') g.upgrade();
  else if (g.hqLevel < HQ_MAX && !g.afford(HQ_COST[g.hqLevel])) { /* saving for the burrow */ }
  // Train the strongest hero while there's spare.
  const spare = g.hqLevel >= HQ_MAX ? { hay: 160, wood: 260, stone: 190 } : HQ_COST[g.hqLevel];
  for (const h of [...g.heroes].sort((a, b) => heroPower(b) - heroPower(a))) if (g.stock.hay > spare.hay + 10 && g.stock.wood > spare.wood + 30 && g.stock.stone > spare.stone + 30) g.train(h.id);
}

export function play(map, seed = 1, idle = false) {
  const g = new Game(map, seed);
  for (let i = 0; i < 60 * 60 * 40 && (g.state === 'playing' || g.state === 'event'); i++) {
    if (!idle && i % 20 === 0) tend(g);
    else if (g.state === 'event') g.choose(1);
    g.update(1 / 60);
  }
  return g;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let wins = 0;
  for (let m = 0; m < MAPS.length; m++) for (const seed of [1, 2, 3, 4]) {
    const g = play(m, seed);
    if (g.state === 'won') wins++;
    console.log(`${MAPS[m].name} seed ${seed}: ${g.state} on day ${g.day}, ${g.stars()}★, burrow ${g.hqLevel}, ${g.survivors} chinchillas, ${g.denCleared} dens, ${g.raidsHeld} raids held, heroes ${g.heroes.map((h) => h.id + h.level).join(' ')}`);
  }
  for (let m = 0; m < MAPS.length; m++) assert.equal(play(m, 1).state, 'won', `${MAPS[m].name} can be won`);
  assert.ok(wins >= 10, `the settler wins at least 10 of 12 seeded runs (won ${wins})`);
  for (let m = 0; m < MAPS.length; m++) assert.equal(play(m, 1, true).state, 'lost', `standing still loses ${MAPS[m].name}`);
  console.log(`Passed: a steady settler wins ${wins} of 12 runs, including every map on seed 1, and standing still loses.`);
}
