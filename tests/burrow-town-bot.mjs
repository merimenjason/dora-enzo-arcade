// A bot that plays Burrow Town with the real engine, to check the valleys can actually be finished
// and that no single building is a strategy on its own.
//
// The policy is the one a player would use: keep the hay coming in, keep the roads growing towards
// whatever is wanted next, and build what Dora and Enzo are asking for. It reads nothing the game
// does not show a player. It prints how long each valley took, which is what the goals are tuned on.
import assert from 'node:assert/strict';
import { BurrowTown, BUILDINGS, VALLEYS, HOUSING, AMENITIES, NUISANCES, ROAD_COST, TICK, DAY, GRANARY, WORKSHOP_RANGE } from '../.checks/burrow-town-game.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MIDDLE = { x: 8, y: 6 };
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const key = (x, y) => y * 16 + x;
/** Does this tile touch the road network that reaches a plaza? */
const onNetwork = (g, t) => DIRS.some(([dx, dy]) => {
  const o = g.tile(t.x + dx, t.y + dy);
  return o && ((o.road && o.linked) || (o.b === 'plaza' && !o.ruin));
});
const bare = (t) => !t.b && !t.road;
/** Could a road ever be laid here? Rock and built-on tiles never; the river only as a bridge. */
const pavable = (t) => t.road || (!t.b && t.t !== 'rock');
const best = (list, score) => (list.length ? list.reduce((a, b) => (score(b) > score(a) ? b : a)) : null);
const nearMiddle = (t) => -dist(t, MIDDLE);
const farmScore = (g) => (t) => (t.t === 'terrace' ? 2 : 0) + (DIRS.some(([dx, dy]) => g.tile(t.x + dx, t.y + dy)?.t === 'river') ? 2 : 0) - dist(t, MIDDLE) * 0.3;
// Keep the town tight: amenities only reach so far, so a home near the others is a home near comfort.
const homeScore = (g) => (t) => g.desireAt(t.x, t.y) * 2 - dist(t, MIDDLE) * 0.6;

/** Tiles that could take a road right now: the edge the town can still grow from. */
const frontier = (g) => g.tiles.filter((t) => onNetwork(g, t) && !g.blocked('road', t.x, t.y));

/**
 * Lay the next road tile on the shortest route from the network to somewhere beside `target`.
 * Greedily stepping towards a target walks into dead ends; the valleys have rock ridges and a river
 * to get around, so the route is searched properly and only its first tile is laid.
 */
function roadTowards(g, target, cap = 150) {
  if (!target || g.stats.roads >= cap) return false;
  const want = new Set([key(target.x, target.y), ...DIRS.map(([dx, dy]) => key(target.x + dx, target.y + dy))]);
  const from = new Map();
  const queue = [];
  for (const t of g.tiles) {
    if ((t.road && t.linked) || (t.b === 'plaza' && !t.ruin)) {
      from.set(key(t.x, t.y), null);
      queue.push(t);
    }
  }
  let found = null;
  for (let i = 0; i < queue.length && !found; i++) {
    for (const [dx, dy] of DIRS) {
      const n = g.tile(queue[i].x + dx, queue[i].y + dy);
      if (!n || from.has(key(n.x, n.y)) || !pavable(n)) continue;
      from.set(key(n.x, n.y), queue[i]);
      if (want.has(key(n.x, n.y))) {
        found = n;
        break;
      }
      queue.push(n);
    }
  }
  if (!found) return false;
  // Walk the route back to the first tile that is not paved yet.
  let step = found;
  for (let prev = from.get(key(found.x, found.y)); prev && !((prev.road && prev.linked) || prev.b === 'plaza'); prev = from.get(key(prev.x, prev.y))) step = prev;
  return !step.road && g.apply(step.x, step.y, 'road') === '';
}

/**
 * Walled in: the roads touch nothing that can still be paved, yet there is open ground out there.
 * Clear one building on the edge and pave the gap it leaves. Half the hay comes back, and a town
 * that cannot grow is worth less than whatever stood in the way.
 */
function unseal(g) {
  if (!g.tiles.some((t) => bare(t) && t.t !== 'rock')) return false;
  const opens = (t) => DIRS.filter(([dx, dy]) => {
    const n = g.tile(t.x + dx, t.y + dy);
    return n && bare(n) && n.t !== 'rock';
  }).length;
  // Never a home and never the plaza: those cost residents and connection. A farm or a bath rebuilds.
  const gate = best(g.tiles.filter((t) => t.b && t.b !== 'plaza' && !HOUSING.includes(t.b) && !t.ruin && onNetwork(g, t) && opens(t) > 0), (t) => opens(t) * 2 - dist(t, MIDDLE) * 0.2);
  return !!gate && g.apply(gate.x, gate.y, 'demolish') === '' && g.apply(gate.x, gate.y, 'road') === '';
}

/** One road tile laid where it opens the most ground, so the town never boxes itself in. */
function openRoad(g) {
  const t = best(frontier(g), (o) => DIRS.filter(([dx, dy]) => {
    const n = g.tile(o.x + dx, o.y + dy);
    return n && bare(n) && n.t !== 'rock';
  }).length * 2 - dist(o, MIDDLE) * 0.3);
  if (t && g.apply(t.x, t.y, 'road') === '') return true;
  // Nothing on the edge can be paved: push the network out towards open ground instead.
  return roadTowards(g, best(g.tiles.filter((o) => bare(o) && o.t !== 'rock'), (o) => -dist(o, MIDDLE)));
}

/**
 * How much open ground a tile is holding open. Building in a dead-end pocket costs the town nothing,
 * while building across its last corridor walls off everything beyond it, so every placement leans
 * towards the pockets and leaves the corridors to become road.
 */
const openness = (g, t) => -0.9 * DIRS.filter(([dx, dy]) => {
  const n = g.tile(t.x + dx, t.y + dy);
  return n && bare(n) && n.t !== 'rock';
}).length;

/**
 * Put one of these up somewhere it will work. When there is a good spot the roads have not reached,
 * lay road towards it instead — but only while the building itself is affordable, so the bot never
 * paves the valley with hay it needs.
 */
function tryBuild(g, tool, score = nearMiddle, where = () => true) {
  const cands = g.tiles.filter((t) => BUILDINGS[tool].on.includes(t.t) && where(g, t));
  const pick = best(cands.filter((t) => onNetwork(g, t) && !g.blocked(tool, t.x, t.y)), (t) => score(t) + openness(g, t));
  if (pick) return g.apply(pick.x, pick.y, tool) === '';
  if (!g.unlocked(tool) || BUILDINGS[tool].cost > g.hay || BUILDINGS[tool].stone > g.stone) return false;
  return roadTowards(g, best(cands.filter(bare), score));
}

/** Somewhere quiet for a quarry or a workshop: the noise carries two tiles into the burrows. */
const awayFromHomes = (g, homes) => (t) => -homes.reduce((n, h) => n + (dist(h, t) <= 3 ? 4 : 0), 0) - dist(t, MIDDLE) * 0.1;

/**
 * What each wish is asking to be built, and where it has to go: a wish for terrace farms is not
 * granted by a farm on the grass. Wishes that ask for people or hay instead of buildings are not here.
 */
const WISH_BUILD = {
  gardens: { tool: 'garden' },
  bigburrow: { tool: 'bigburrow' },
  workshops: { tool: 'workshop' },
  watchtower: { tool: 'watchtower' },
  silos: { tool: 'silo' },
  farms: { tool: 'hayfarm' },
  homes: { tool: 'burrow' },
  quarry: { tool: 'quarry' },
  roads: { tool: 'road' },
  market: { tool: 'market', limit: 3, score: (g) => (t) => g.residentsNear(t, 4) },
  'terrace-farm': { tool: 'hayfarm', where: (g, t) => t.t === 'terrace' },
  'plaza-garden': { tool: 'garden', where: (g, t) => g.near(t, 'plaza', 2) },
  'bath-near': { tool: 'dustbath', where: (g, t) => g.tiles.some((h) => h.b && HOUSING.includes(h.b) && !h.ruin && dist(h, t) <= 3 && !g.near(h, 'dustbath', 3)) },
};

/** Raise the comfort of the least comfortable home, and keep the amenity only if it really helped. */
function comfort(g, homes, floor = 4) {
  const sad = best(homes.filter((h) => h.comfort < floor), (h) => -h.comfort);
  if (!sad) return false;
  for (const id of AMENITIES) {
    if (!g.unlocked(id)) continue;
    const spot = best(g.tiles.filter((t) => dist(t, sad) <= BUILDINGS[id].radius && onNetwork(g, t) && !g.blocked(id, t.x, t.y)), (t) => -dist(t, sad));
    if (!spot) continue;
    const before = sad.desire;
    if (g.apply(spot.x, spot.y, id) === '') {
      if (sad.desire > before + 0.3) return true;
      g.undo();
    }
  }
  // The roads have not reached anywhere an amenity would help this home. Lay one towards it.
  return g.hay > 90 && roadTowards(g, sad, 110);
}

/** One decision. Returns true when it did something. */
function act(g) {
  const homes = g.tiles.filter((t) => t.b && HOUSING.includes(t.b) && !t.ruin);
  const goal = g.valley.goal;
  const surplus = g.stats.income - g.stats.upkeep;
  const wants = (id) => g.requests.some((r) => WISH_BUILD[r.key]?.tool === id);
  // Always keep somewhere left to build. A town that paves over its own edge can never grow again,
  // so this comes before everything else: while the edge is thin, road is the only thing worth
  // laying, and when there is no hay for one it is better to wait than to spend the last of the
  // edge on a building that seals the town in for good.
  if (frontier(g).length < 3) {
    if (openRoad(g)) return true;
    if (g.hay < ROAD_COST * 4) return false;
    if (unseal(g)) return true;
  }
  // Rebuild anything derelict the roads reach: it is half price and often already useful.
  const ruin = g.tiles.find((t) => t.ruin && onNetwork(g, t) && !g.blocked(t.b, t.x, t.y));
  if (ruin && g.apply(ruin.x, ruin.y, ruin.b) === '') return true;
  // Keep the hay coming in before anything else. If a farm cannot be placed or afforded right now,
  // carry on down the list rather than standing still for the rest of the turn.
  if (surplus < 6 + homes.length * 0.8 && tryBuild(g, 'hayfarm', farmScore(g))) return true;
  // Stop the granary spilling, and raise it when an advisor wants more hay stored than it holds.
  const hayWish = g.requests.find((r) => r.key === 'hay');
  if ((g.hay > g.granary * 0.8 || (hayWish && hayWish.progress[1] > g.granary * 0.9)) && tryBuild(g, 'silo')) return true;
  // Stone, kept away from the homes because quarries are noisy.
  if (g.stats.stoneIncome === 0 && tryBuild(g, 'quarry', awayFromHomes(g, homes))) return true;

  // Whatever the advisors are asking for: approval is the only way a valley is finished.
  for (const r of g.requests) {
    const w = WISH_BUILD[r.key];
    if (!w) continue;
    if (w.tool === 'road') {
      if (roadTowards(g, best(g.tiles.filter((t) => bare(t) && t.t !== 'rock'), (t) => -dist(t, MIDDLE))) || openRoad(g)) return true;
      continue;
    }
    if (!g.unlocked(w.tool)) continue;
    // Only build what the wish is short of. Most wishes count the thing they ask for, so their own
    // progress says when to stop; a market wish counts residents instead, so it caps the buildings.
    const built = g.count((t) => t.b === w.tool && !t.ruin);
    if (w.limit ? built >= w.limit : r.progress[0] >= r.progress[1]) continue;
    const score = w.score ? w.score(g) : w.tool === 'hayfarm' ? farmScore(g) : HOUSING.includes(w.tool) ? homeScore(g) : NUISANCES.includes(w.tool) ? awayFromHomes(g, homes) : nearMiddle;
    if (tryBuild(g, w.tool, score, w.where)) return true;
  }
  // Wishes that ask for a number rather than a building still need the town built up to reach it.
  if (g.requests.some((r) => r.key === 'happy' || r.key === 'delight') && comfort(g, homes)) return true;
  if (g.requests.some((r) => r.key === 'income') && surplus < 30 && tryBuild(g, 'hayfarm', farmScore(g))) return true;

  // More beds. Homes rarely fill completely, so aim past the goal, and keep aiming as long as the
  // town is still short of it: a bed nobody wants is cheaper than stopping one resident early.
  // Every home wants a dust bath within three tiles: the cheapest comfort there is, and the first
  // thing Dora asks for. Somewhere unreachable is left alone rather than holding the town up.
  const unbathed = homes.find((h) => !g.near(h, 'dustbath', 3));
  if (unbathed && tryBuild(g, 'dustbath', (t) => -dist(t, unbathed), (_g, t) => dist(t, unbathed) <= 3)) return true;
  // With beds to spare, the way to more residents is comfort, not more building: an uncomfortable
  // burrow only ever half fills, and each empty bed still cost hay to dig.
  if (g.stats.capacity >= Math.ceil(goal.residents * 1.2) && comfort(g, homes)) return true;
  // Beds only once the farms can feed them. Every resident eats every tick forever, so a town that
  // fills up before it can afford to spends its last hay on mouths and can never dig its way out.
  const fed = surplus > 2 && g.hay > 90;
  if (fed && (g.stats.residents < goal.residents || Math.ceil(goal.residents * 1.4) > g.stats.capacity)) {
    if (g.unlocked('bigburrow') && (wants('bigburrow') || g.stone >= 60) && tryBuild(g, 'bigburrow', homeScore(g))) return true;
    if (tryBuild(g, 'burrow', homeScore(g))) return true;
  }
  // Comfort fills the beds that are already built, which is cheaper than building more.
  if (comfort(g, homes)) return true;
  // Otherwise save: paving for the sake of it is how a town goes broke.
  return false;
}

function play(index, maxTicks = 1500) {
  const g = new BurrowTown(index);
  let ticks = 0;
  for (; ticks < maxTicks && !g.won; ticks++) {
    for (let i = 0; i < 6 && act(g); i++);
    g.step(TICK);
  }
  return { g, ticks, days: (ticks * TICK) / DAY };
}

const t0 = Date.now();
const rows = [];
for (let i = 0; i < VALLEYS.length; i++) {
  const { g, ticks, days } = play(i);
  assert.ok(
    g.won,
    `${VALLEYS[i].name}: the bot could not finish it in ${ticks} ticks — it reached ${g.stats.residents}/${g.valley.goal.residents} residents, Dora ${g.approval.dora} and Enzo ${g.approval.enzo} of ${g.valley.goal.approval}`,
  );
  rows.push({ name: VALLEYS[i].name, ticks, days, g });
}
for (let i = 1; i < rows.length; i++) assert.ok(rows[i].ticks > rows[0].ticks * 0.7, `${rows[i].name} should not be quicker than the tutorial valley`);

// Nothing is a strategy on its own: workshops with no stone to mill are a quarter of a building.
/** A sandbox with hay, stone and a road already run out to the nearest rock. */
const stocked = () => {
  const g = new BurrowTown(-1);
  g.hay = 4000;
  g.stone = 200;
  g.approval.enzo = 100;
  const rock = best(g.tiles.filter((t) => t.t === 'rock'), (t) => -dist(t, MIDDLE));
  for (let i = 0; i < 80 && !onNetwork(g, rock); i++) if (!roadTowards(g, rock)) break;
  assert.ok(onNetwork(g, rock), 'the sandbox should have rock the roads can reach');
  return { g, rock };
};
/** Workshops on the road, within carting distance of that rock. */
const raise = (g, rock, want) => {
  let made = 0;
  for (const t of g.tiles) {
    if (made >= want) break;
    if (dist(t, rock) <= WORKSHOP_RANGE && onNetwork(g, t) && g.apply(t.x, t.y, 'workshop') === '') made++;
  }
  return made;
};
const { g: spam, rock: spamRock } = stocked();
const { g: mixed, rock: mixedRock } = stocked();
const made = raise(spam, spamRock, 6);
const mixedShops = raise(mixed, mixedRock, 3);
assert.equal(mixed.apply(mixedRock.x, mixedRock.y, 'quarry'), '', 'the quarry should go up on the rock the roads reached');
assert.ok(made === 6 && mixedShops === 3, `expected 6 and 3 workshops, built ${made} and ${mixedShops}`);
spam.tick();
mixed.tick();
assert.ok(mixed.stats.income > spam.stats.income, `three workshops with a quarry (${mixed.stats.income}) should beat six without (${spam.stats.income})`);

// And hoarding one crop does not work either: the granary stops taking it in.
const { g: hoard } = stocked();
let farms = 0;
for (const t of hoard.tiles) {
  if (farms >= 5) break;
  if (onNetwork(hoard, t) && hoard.apply(t.x, t.y, 'hayfarm') === '') farms++;
}
assert.equal(farms, 5, 'five farms should go up beside the road');
assert.ok(hoard.stats.income > 0, 'connected farms should actually earn');
hoard.hay = GRANARY - 1;
for (let i = 0; i < 10; i++) hoard.tick();
assert.ok(hoard.hay <= GRANARY, `farm spam without silos stalls at the granary, got ${hoard.hay} from ${farms} farms`);

console.log('Burrow Town bot: every valley finished with the rules as written, and no one building carries a town.');
for (const r of rows) console.log(`  ${r.name.padEnd(20)} ${String(r.ticks).padStart(4)} ticks · ${r.days.toFixed(1)} days · ${r.g.stats.residents} residents · Dora ${r.g.approval.dora} · Enzo ${r.g.approval.enzo}`);
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
