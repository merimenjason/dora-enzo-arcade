import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { BellspireGame, ABILITY_ORDER, COMPLETION, ALL_BOSSES, SALT_GUARDIANS, ORCHARD_GUARDIANS, INFO, MAP_EXITS,
  NO_INPUT, ROOMS, ROWS, COLS, TILE, freshSave, isOrchardRoom, parseSave, roomRect, roomById } from '../.checks/bellspire-game.js';
import { Graph, navEnv, nodeRoom } from '../.checks/bellspire-nav.js';
import { ORCHARD_EXIT, ORCHARD_GATE, ORCHARD_RETURN, graftFlag, graftSpans } from '../.checks/bellspire-orchard-world.js';

const orchard = ROOMS.filter(isOrchardRoom);
const grafts = new Set(orchard.flatMap((room) => (room.grafts ?? []).flatMap((g, i) =>
  [graftFlag(room.id, i, 'bloom'), ...(g.shear ? [graftFlag(room.id, i, 'shear')] : [])])));
export function orchardSave(lead = 'dora', ready = true) {
  const s = freshSave();
  s.lead = lead;
  s.shrine = 'salt-toll-road';
  s.abilities = ABILITY_ORDER.filter((a) => ready || (a !== 'bloom' && a !== 'shear'));
  s.spells.push('ember', 'chime', 'frost', 'gale');
  s.flags.push('unlock:salt', 'unlock:orchard', 'unlock:glacier', 'script:intro', 'script:firstDark', 'script:belfryCall', 'epilogue', 'epilogue2', 'epilogue3', 'salt:visited',
    ...[...ALL_BOSSES, ...SALT_GUARDIANS].map((id) => `boss:${id}`));
  return s;
}

// All heights are exact top edges from the authored tiles or from graftSpans.
// Candidate take-off coordinates are four pixels apart. A candidate starts with a run-up on the
// same surface and uses one jump held through the rise, then released near the apex.
// Columns are measured at their edges, in tiles; the start and landing intervals allow room to
// stand with the collision body clear of the obstacle.
export const JUMPS = [
  ['Orchard Wicket · first stone step', 'orchard-wicket', 1, 15, [20, 23.5], 14, [24, 26]],
  ['Orchard Wicket · next terrace', 'orchard-wicket', 1, 14, [24.25, 25.5], 12, [26, 32]],
  ['Nursery · bloom from basin', 'orchard-nursery', 1, 15, [16, 22], 12, [21, 34]],
  ['Graft Terraces · lower branch', 'orchard-grafts', 1, 15, [14, 19], 13, [19, 30]],
  ['Graft Terraces · upper branch', 'orchard-grafts', 1, 13, [24, 28.75], 11, [30, 40]],
  ['Stag · east shoulder', 'orchard-stag', 1, 15, [36, 40.5], 14, [41, 52.75]],
  ['Seed Steps · thorns eastbound', 'orchard-seeds', 1, 15, [22.25, 26.5], 15, [28.5, 35.5], 'ground'],
  ['Seed Steps · thorns westbound', 'orchard-seeds', -1, 15, [28.5, 33.75], 15, [19, 26.5], 'ground'],
  ['Seed Steps · branch back uphill', 'orchard-seeds', 1, 14, [36.25, 40], 11, [41, 47]],
  ['Pruning Walk · first graft', 'orchard-pruning', -1, 15, [44, 48], 12, [35, 44]],
  ['Pruning Walk · second graft', 'orchard-pruning', -1, 15, [28, 29.75], 12, [21, 28]],
  ['Pruning Walk · released limb', 'orchard-pruning', -1, 12, [22, 27.5], 10, [12, 21]],
  ['Double Espalier · bloom to lower branch', 'orchard-espalier', -1, 15, [38, 43], 13, [33, 40]],
  ['Double Espalier · cut to upper branch', 'orchard-espalier', -1, 13, [34, 39], 11, [28, 35]],
  ['Cistern · shelf out of the bowl', 'orchard-cistern', -1, 15, [25.25, 30], 13, [17, 25]],
  ['Silt Ladder · low graft', 'orchard-silt', 1, 15, [13, 18], 13, [18, 32]],
  ['Silt Ladder · crystal deck', 'orchard-silt', 1, 13, [24, 28], 11, [29, 37], 'crystal'],
  ['Silt Ladder · east landing', 'orchard-silt', 1, 15, [39, 41.75], 14, [42, 48]],
  ['Root Vault · exit shoulder', 'orchard-rootback', 1, 15, [43, 46.75], 14, [47, 55]],
  ['Lantern Weir · first thorns eastbound', 'orchard-weir', 1, 15, [21, 24.5], 15, [26.5, 34.5], 'ground'],
  ['Lantern Weir · first thorns westbound', 'orchard-weir', -1, 15, [26.5, 32], 15, [18.25, 24.5], 'ground'],
  ['Lantern Weir · second thorns eastbound', 'orchard-weir', 1, 15, [32, 35.5], 15, [37.5, 45], 'ground'],
  ['Lantern Weir · second thorns westbound', 'orchard-weir', -1, 15, [37.5, 42], 15, [27, 35.5], 'ground'],
  ['Lantern Weir · high route branch', 'orchard-weir', 1, 14, [13, 16.5], 12, [17, 29]],
  ['Lantern Weir · high route released limb', 'orchard-weir', 1, 12, [23, 28.25], 10, [29, 43]],
  ['Mother of Grafts · upper east stairs', 'orchard-mother', 1, 15, [44, 46.75], 13, [48, 51]],
];

function advance(g, input = {}, n = 1) {
  for (let i = 0; i < n; i++) g.step({ ...NO_INPUT, ...input });
}

function sample(spec, hero, takeoff) {
  const [, id, dir, floor, , toY, bounds, route = 'graft'] = spec;
  const game = new BellspireGame(orchardSave(hero), { assist: true, wisp: false }, 17);
  game.save.flags.push('boss:bracken-stag', 'boss:rootback', 'boss:graft-mother');
  if (route === 'graft') game.save.flags.push(...grafts);
  game.teleport(id, Math.floor(takeoff / TILE), floor - 1);
  game.enemies = []; // Measure geometry separately from foe timing.
  const origin = roomRect(game.room);
  const initialHp = game.save.heroes[hero].hp;
  const input = dir > 0 ? { right: true } : { left: true };
  const y = origin.y + floor * TILE;
  for (const back of [24, 16, 8]) {
    const start = takeoff - dir * back;
    game.teleport(id, Math.floor(start / TILE), floor - 1);
    game.enemies = [];
    game.body.x = origin.x + start;
    game.body.y = y;
    if (route === 'crystal') {
      game.ringCrystal(INFO.get(id).things.find((t) => t.ch === '*'));
      advance(game, {}, 18);
    } else advance(game);
    if (!game.body.ground || Math.abs(game.body.y - y) > 0.1) continue;
    let touched = false;
    for (let t = 0; t < 48 && (game.body.x - origin.x - takeoff) * dir < 0; t++) {
      advance(game, input);
      touched ||= game.body.hazard;
    }
    if (!game.body.ground || Math.abs(game.body.y - y) > 0.1 ||
        (game.body.x - origin.x - takeoff) * dir < 0 || touched || game.save.heroes[hero].hp < initialHp) continue;
    // Retain the running velocity. Place the feet at the exact sampled coordinate instead
    // of counting the small overshoot from the last 60 Hz running step.
    game.body.x = origin.x + takeoff;
    let jumped = false;
    for (let t = 0; t < 90; t++) {
      advance(game, { ...input, jump: t < 19 });
      if (game.body.hazard || game.save.heroes[hero].hp < initialHp || game.room.id !== id) return false;
      if (!game.body.ground) jumped = true;
      if (!jumped || !game.body.ground) continue;
      const x = (game.body.x - origin.x) / TILE, fy = (game.body.y - origin.y) / TILE;
      if (fy > toY + 0.01 || x < bounds[0] || x > bounds[1]) return false;
      for (let settle = 0; settle < 4; settle++) {
        advance(game);
        if (game.body.hazard) return false;
      }
      return game.save.heroes[hero].hp === initialHp && game.body.ground;
    }
    return false;
  }
  return false;
}

function widest(spec, hero) {
  let current = 0, best = 0, bestEnd = 0;
  for (let x = spec[4][0] * TILE; x <= spec[4][1] * TILE; x += 4) {
    if (sample(spec, hero, x)) {
      current++;
      if (current > best) { best = current; bestEnd = x; }
    } else current = 0;
  }
  // Report the span between the first and last successful sampled take-off, not the number of samples.
  return { width: Math.max(0, (best - 1) * 4), first: best ? bestEnd - (best - 1) * 4 : null, last: best ? bestEnd : null };
}

export function measureJumps() {
  return JUMPS.map((spec) => ({ name: spec[0], room: spec[1], dora: widest(spec, 'dora'), enzo: widest(spec, 'enzo') }));
}

export function testOrchard() {
  let checks = 0;
  const ok = (v, msg) => { assert.ok(v, msg); checks++; };
  const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
  eq(orchard.length, 12);
  eq(COMPLETION.orchard, { cells: 24, chests: 3, murals: 3, bosses: 3 });
  eq(new Set(orchard.map((r) => r.rows.join())).size, orchard.length);
  for (const room of orchard) {
    eq(room.rows.length, 17, room.id);
    ok(room.rows.every((row) => row.length === 60), room.id);
    ok(!room.dark, room.id);
    ok(new Set(Array.from({ length: 56 }, (_, c) => room.rows.findIndex((row, y) => y >= 8 && row[c + 2] === '#'))).size >= 4, `${room.id}: at least four floor heights`);
    ok(room.rows.some((row) => row.includes('=') || row.includes('C')), `${room.id}: detour`);
  }
  const game = new BellspireGame(orchardSave('enzo', false));
  game.teleport(ORCHARD_RETURN, ...ORCHARD_EXIT);
  advance(game, {}, 5); advance(game, { up: true });
  eq(game.room.id, ORCHARD_GATE, 'a pre-Orchard save can open the wicket');
  ok(game.flag('orchard:visited'));
  const g = new BellspireGame(orchardSave('enzo'));
  g.teleport('orchard-grafts', 15, 14);
  advance(g, {}, 5);
  eq(g.orchardHint()?.key, 'up', 'Enzo gets the Bloom input');
  advance(g, { up: true });
  ok(g.flag(graftFlag(g.room.id, 0, 'bloom')));
  eq(g.orchardHint()?.key, 'tag', 'the same graft now asks for Dora');
  advance(g, {}, 28);
  advance(g, { tag: true });
  advance(g, {}, 25);
  advance(g, { attack: true });
  ok(g.flag(graftFlag(g.room.id, 0, 'shear')));
  eq(g.orchardHint(), null, 'finished grafts no longer prompt');
  const save = parseSave(JSON.stringify(g.snapshot()));
  const wanted = graftSpans(g.room, (key) => save.flags.includes(key), TILE, COLS, ROWS);
  const state = { abilities: save.abilities, keeper: true, water: save.water, calmed: ['bracken-stag', 'rootback'] };
  const spans = (x) => x.map(({ x0, x1, y }) => [x0, x1, y]);
  eq(spans(g.floatList().filter((f) => f.kind === 'branch')), spans(wanted));
  const contains = (list, branch) => list.some((f) => f.x0 === branch.x0 && f.x1 === branch.x1 && f.y === branch.y);
  ok(wanted.every((f) => contains(navEnv({ ...state, grafts: new Set(save.flags) }).floats(), f)));
  ok(wanted.every((f) => !contains(navEnv(state).floats(), f)), 'planner never assumes an unworked graft');
  const ids = new Set(orchard.map((r) => r.id));
  const graph = new Graph({ ...state, grafts }, true);
  const start = roomRect(roomById(ORCHARD_GATE));
  const reached = [...graph.reach([graph.nodeAt(start.x + 56, start.y + 192)])].map((k) => graph.nodes.get(k));
  const visited = new Set(reached.map((n) => nodeRoom(n)?.id));
  ok([...ids].every((id) => visited.has(id)), `planner route is continuous: missing ${[...ids].filter((id) => !visited.has(id))}`);
  for (const id of ids) for (const thing of INFO.get(id).things.filter((t) => 'ACR'.includes(t.ch))) {
    ok(reached.some((n) => n.mode === 'ground' && Math.abs(n.x - (thing.c * TILE + 8)) <= 19 && Math.abs(n.y - (thing.r + 1) * TILE) <= 22),
      `${id}: ${thing.ch} at ${thing.c},${thing.r} is reachable from the wicket`);
  }
  eq(MAP_EXITS.filter((e) => ids.has(e.from) && ids.has(e.to) && e.dx === 0 && e.dy !== 0).length, 4, 'two orchard ladder seams, each with a return');
  for (const bossId of ORCHARD_GUARDIANS) {
    const room = orchard.find((r) => r.boss === bossId), start = INFO.get(room.id).things.find((t) => t.ch === 'O');
    const from = bossId === 'graft-mother' ? 8 : bossId === 'bracken-stag' ? -9 : -8;
    const h = new BellspireGame(orchardSave('enzo'), { assist: true, wisp: false }, 17);
    h.setFlag(`script:boss:${bossId}`);
    h.teleport(room.id, start.c - room.gx * COLS + from, start.r - room.gy * ROWS);
    const stepUntil = (pred, msg) => {
      for (let i = 0; i < 450 && !pred(); i++) advance(h);
      ok(pred(), msg);
    };
    stepUntil(() => h.boss?.st === 'orchardRest', `${bossId}: approached through the door`);
    eq(h.orchardHint()?.key, 'up');
    advance(h, { up: true });
    stepUntil(() => h.boss?.st === 'orchardCaught', `${bossId}: bloom catches the attack`);
    eq(h.boss.hurt.length, 0, `${bossId}: Enzo alone cannot damage it`);
    advance(h, { attack: true }); advance(h, {}, 32);
    eq(h.boss.st, 'orchardCaught', `${bossId}: Enzo cannot cut`);
    advance(h, { tag: true }); advance(h, {}, 12);
    eq(h.orchardHint()?.key, 'attack');
    advance(h, { attack: true });
    eq(h.boss.st, 'orchardOpen', `${bossId}: Dora opens the flank`);
    ok(h.boss.hurt.length > 0, `${bossId}: the open flank is hittable`);
  }
  // Each arena's low ledges sit inside its guardian's floor sweep: a hero who hops up (a real jump from the floor
  // below) rides the sweep out unhurt, and the same sweep hurts a hero left on the floor beside one of them (the
  // Stag's east ledge is out of its sweep, there for height).
  for (const bossId of ORCHARD_GUARDIANS) {
    const room = orchard.find((r) => r.boss === bossId), rows = room.rows;
    const ledges = [];
    for (let c = 0; c < rows[13].length; c++) if (rows[13][c] === '=' && rows[13][c - 1] !== '=') ledges.push(c + 1);
    ok(ledges.length > 0, `${bossId}: its arena has a low ledge`);
    for (const lead of ['dora', 'enzo']) {
    let floorHit = false;
    for (const col of ledges) for (const up of [true, false]) {
      const h = new BellspireGame(orchardSave(lead), { assist: true, wisp: false }, 17);
      h.setFlag(`script:boss:${bossId}`);
      h.teleport(room.id, col, 14);
      for (let i = 0; i < 450 && h.boss?.st !== 'orchardRest'; i++) advance(h);
      if (bossId === 'graft-mother') h.boss.side = col + room.gx * COLS < INFO.get(room.id).things.find((t) => t.ch === 'O').c ? -1 : 1;
      if (up) { advance(h, { jump: true }, 14); advance(h, {}, 30); }
      const onLedge = h.body.ground && Math.round(h.body.y / TILE) === (room.gy * ROWS) + 13;
      if (up) ok(onLedge, `${bossId} (${lead}): a jump lands on the ledge at column ${col}`);
      const hp = h.save.heroes[lead].hp;
      h.boss.t = h.boss.dur;
      let swept = false;
      for (let i = 0; i < 260 && !(swept && h.boss.st === 'orchardRest'); i++) { advance(h); if (h.boss.st === 'orchardRush') swept = true; }
      ok(swept, `${bossId}: the sweep came`);
      if (up) eq(h.save.heroes[lead].hp, hp, `${bossId} (${lead}): the ledge at column ${col} rides out the sweep`);
      else if (h.save.heroes[lead].hp < hp) floorHit = true;
    }
    ok(floorHit, `${bossId} (${lead}): the floor beside a ledge is in the sweep`);
    }
  }
  const jumps = measureJumps();
  for (const row of jumps) for (const hero of ['dora', 'enzo']) ok(row[hero].width >= 16, `${row.name}: ${hero} needs 16 px, saw ${row[hero].width}`);
  console.log(`Night Orchard: ${checks} engine assertions; ${jumps.length} jump windows per hero.`);
  return jumps;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--measure')) console.table(measureJumps().map((r) => ({ obstacle: r.name, Dora: r.dora.width, Enzo: r.enzo.width })));
  else testOrchard();
}
