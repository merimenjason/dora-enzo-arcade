import assert from 'node:assert/strict';
import {
  FluffstevaniaGame, ROOMS, COLS, ROWS, TILE, NO_INPUT, FOES, OWL, rawTile, roomAt, roomById, isSolid, parseSave, freshSave, xpToNext,
  TOTAL_CELLS, DASH_T,
} from '../.checks/fluffstevania-game.js';

const DT = 1 / 120;
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const run = (g, input, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) g.step(DT, { ...NO_INPUT, ...input }); };
const tap = (g, key) => { g.step(DT, { ...NO_INPUT, [key]: true }); g.step(DT, NO_INPUT); };
const skipTalk = (g) => { let n = 0; while (g.dialog && n++ < 40) tap(g, 'jump'); };
/** Put the leader's feet on world tile (c, r) of a room and let one step settle them. */
const place = (g, roomId, c, r) => {
  const room = roomById(roomId);
  g.body.x = (room.mx * COLS + c + 0.5) * TILE; g.body.y = (room.my * ROWS + r + 1) * TILE; g.body.vx = 0; g.body.vy = 0;
  g.step(DT, NO_INPUT);
  skipTalk(g);
};
const fresh = () => { const g = new FluffstevaniaGame(); skipTalk(g); return g; };

// ─── The map ──────────────────────────────────────────────────────────────

test('every room is a whole number of screens and no two rooms share a cell', () => {
  let cells = 0;
  for (const r of ROOMS) {
    assert.equal(r.rows.length, r.h * ROWS, r.id);
    for (const row of r.rows) assert.equal(row.length, r.w * COLS, r.id);
    cells += r.w * r.h;
  }
  assert.equal(TOTAL_CELLS, cells);
  assert.equal(new Set(ROOMS.map((r) => r.id)).size, ROOMS.length);
});

test('every opening on a side or floor edge leads into another room', () => {
  for (const r of ROOMS) {
    const c0 = r.mx * COLS, r0 = r.my * ROWS, c1 = c0 + r.w * COLS - 1, r1 = r0 + r.h * ROWS - 1;
    const edges = [];
    for (let y = r0; y <= r1; y++) edges.push([c0, y, -1, 0], [c1, y, 1, 0]);
    for (let x = c0; x <= c1; x++) edges.push([x, r1, 0, 1]);
    for (const [x, y, dx, dy] of edges) {
      if (isSolid(rawTile(x, y))) continue;
      if (r.area === 'approach' && dy === 0 && y < r0 + 9) continue; // open sky over the approach
      assert.ok(roomAt(Math.floor((x + dx) / COLS), Math.floor((y + dy) / ROWS)), `${r.id} opens at ${x},${y} onto nothing`);
    }
  }
});

// A coarse movement model over the whole map: walk, fall, drop through ledges and jump (4 tiles up, a few across).
// The Dust Dash stretches the jump across. Cracked walls count as open because any attack breaks them.
const open = (c, r) => { const ch = rawTile(c, r); return !(ch === '#' || ch === 'D' || ch === '^'); };
const floorAt = (c, r) => { const ch = rawTile(c, r); return ch === '#' || ch === '=' || ch === 'D' || ch === '%'; };
const standable = (c, r) => open(c, r) && open(c, r - 1) && floorAt(c, r + 1);
const key = (c, r) => `${c},${r}`;
function land(c, r) {
  for (let y = r; y < r + 80; y++) {
    if (!open(c, y) || !open(c, y - 1)) return null;
    if (standable(c, y)) return [c, y];
    if (rawTile(c, y + 1) === '^') return null;
  }
  return null;
}
function moves(c, r, dash) {
  const out = [];
  for (const s of [-1, 1]) {
    if (open(c + s, r) && open(c + s, r - 1)) { const l = land(c + s, r); if (l) out.push(l); }
  }
  if (rawTile(c, r + 1) === '=') { const l = land(c, r + 2); if (l) out.push(l); }
  for (let k = 1; k <= 4; k++) {
    if (!open(c, r - k) || !open(c, r - k - 1)) break;
    const reach = dash ? (k <= 2 ? 10 : 7) : k <= 2 ? 5 : 3;
    for (const s of [-1, 1]) for (let d = 1; d <= reach; d++) {
      const x = c + s * d, y = r - k;
      if (!open(x, y) || !open(x, y - 1)) break;
      const l = land(x, y); if (l) out.push(l);
    }
    if (standable(c, r - k)) out.push([c, r - k]);
  }
  return out;
}
function explore(dash) {
  const start = [5, 2 * ROWS + 11], seen = new Map([[key(...start), start]]), queue = [start], edges = new Map();
  while (queue.length) {
    const [c, r] = queue.shift(), from = key(c, r);
    for (const [x, y] of moves(c, r, dash)) {
      const k = key(x, y);
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k).push(from);
      if (!seen.has(k)) { seen.set(k, [x, y]); queue.push([x, y]); }
    }
  }
  return { seen, edges, start: key(...start) };
}
const roomsIn = (seen) => new Set([...seen.values()].map(([c, r]) => roomAt(Math.floor(c / COLS), Math.floor(r / ROWS))?.id));

test('without the Dust Dash the cellar and relic are reachable but the belfry is not', () => {
  const rooms = roomsIn(explore(false).seen);
  for (const id of ['path', 'gate', 'hall', 'save-hall', 'shaft', 'cellar', 'relic', 'secret']) assert.ok(rooms.has(id), id);
  for (const id of ['stair', 'save-belfry', 'belfry', 'sealed']) assert.ok(!rooms.has(id), `${id} should need the Dust Dash`);
});

test('with the Dust Dash every room is reachable and every spot can get back to the start', () => {
  const { seen, edges, start } = explore(true);
  const rooms = roomsIn(seen);
  for (const r of ROOMS) assert.ok(rooms.has(r.id), r.id);
  const back = new Set([start]), queue = [start];
  while (queue.length) for (const k of edges.get(queue.shift()) ?? []) if (!back.has(k)) { back.add(k); queue.push(k); }
  const stuck = [...seen.keys()].filter((k) => !back.has(k));
  assert.deepEqual(stuck, [], 'spots with no way back');
});

// ─── The engine ───────────────────────────────────────────────────────────

test('a new game opens on the moonlit path with the story and both heroes at full health', () => {
  const g = new FluffstevaniaGame();
  assert.equal(g.room.id, 'path');
  assert.ok(g.dialog, 'the intro plays');
  assert.equal(g.dialog.lines[0].who, 'enzo');
  const x = g.body.x;
  run(g, { right: true }, 0.3);
  assert.equal(g.body.x, x, 'the world waits while they talk');
  skipTalk(g);
  assert.equal(g.dialog, null);
  assert.equal(g.hp.dora, g.stats('dora').maxHp);
  assert.equal(g.hp.enzo, g.stats('enzo').maxHp);
  assert.equal(g.leader, 'dora');
  assert.equal(g.banner.text, 'Moonlit Approach');
});

test('walking, jumping and the partner following behind', () => {
  const g = fresh();
  run(g, {}, 0.3);
  const x = g.body.x;
  run(g, { right: true }, 0.5);
  assert.ok(Math.abs(g.body.x - x - 70) < 3, `Dora walks 140 px/s, moved ${g.body.x - x}`);
  assert.ok(g.follower.x < g.body.x - 15 && g.follower.x > g.body.x - 30, 'Enzo trails behind');
  run(g, {}, 0.5);
  const y = g.body.y;
  let top = y;
  for (let i = 0; i < 120; i++) { g.step(DT, { ...NO_INPUT, jump: true }); top = Math.min(top, g.body.y); }
  assert.ok(y - top > 70 && y - top < 85, `a full jump rises ${y - top}px`);
  run(g, {}, 1);
  let low = g.body.y;
  g.step(DT, { ...NO_INPUT, jump: true });
  for (let i = 0; i < 120; i++) { g.step(DT, NO_INPUT); low = Math.min(low, g.body.y); }
  assert.ok(g.body.y - low < 20, 'a tap makes a short hop');
});

test('attacks hurt enemies, pop damage numbers, and kills give XP and levels', () => {
  const g = fresh();
  place(g, 'path', 8, 11);
  g.enemies = [];
  const e = g.spawn('beetle', g.body.x + 30, g.body.y);
  e.face = 1;
  run(g, {}, 0.05);
  tap(g, 'attack');
  run(g, {}, 0.4);
  assert.ok(e.hp < FOES.beetle.hp, 'the whip reaches the beetle');
  assert.ok(g.pops.length > 0, 'a damage number pops');
  e.hp = 1; e.x = g.body.x + 28; e.y = g.body.y; e.face = 1; e.vx = 0; e.vy = 0; g.body.invT = 0;
  tap(g, 'attack');
  run(g, {}, 0.3);
  assert.ok(e.dead > 0 || !g.enemies.includes(e), 'beetle defeated');
  assert.equal(g.xp, FOES.beetle.xp);
  g.gainXp(xpToNext(1));
  assert.equal(g.level, 2);
  assert.ok(g.hp.dora > 50 && g.stats('dora').atk > 6, 'levels raise HP and attack');
});

test('tagging swaps heroes and the incoming tumble hurts enemies on its way', () => {
  const g = fresh();
  place(g, 'path', 8, 11);
  g.enemies = [];
  run(g, { right: true }, 0.4);
  run(g, {}, 0.3);
  const e = g.spawn('bat', g.body.x - 10, g.body.y);
  e.state = 'awake';
  tap(g, 'tag');
  assert.equal(g.leader, 'enzo');
  assert.ok(g.tag, 'the tag animation plays');
  run(g, {}, 0.5);
  assert.equal(g.tag, null);
  assert.ok(e.hp < FOES.bat.hp, 'the tumble hit the bat');
  tap(g, 'tag');
  assert.equal(g.leader, 'enzo', 'the tag needs a moment before the next one');
  run(g, {}, 1);
  tap(g, 'tag');
  assert.equal(g.leader, 'dora');
});

test('the Dust Dash needs its relic, then bursts forward once in the air', () => {
  const g = fresh();
  place(g, 'path', 8, 11);
  g.enemies = [];
  let x = g.body.x;
  tap(g, 'dash');
  run(g, {}, 0.3);
  assert.equal(g.body.x, x, 'no relic, no dash');
  place(g, 'relic', 6, 11);
  run(g, { right: true, jump: true }, 0.6);
  run(g, {}, 0.6);
  skipTalk(g);
  assert.ok(g.has('dash'), 'picked up from the pedestal');
  assert.ok(g.flags.has('relic:dash'));
  place(g, 'path', 30, 11);
  run(g, {}, 0.2);
  x = g.body.x;
  tap(g, 'dash');
  run(g, {}, DASH_T + 0.05);
  assert.ok(g.body.x - x > 70, `dashed ${g.body.x - x}px`);
  run(g, {}, 0.3);
  g.step(DT, { ...NO_INPUT, jump: true });
  run(g, { jump: true }, 0.15);
  x = g.body.x;
  tap(g, 'dash');
  assert.ok(g.body.airDash, 'one air dash');
  run(g, {}, 0.05);
  const again = g.body.x;
  run(g, {}, DASH_T);
  tap(g, 'dash');
  run(g, {}, 0.1);
  assert.ok(g.body.x - again < 90, 'no second air dash');
});

test('the broken gallery: a running jump falls short, a jump and an air dash clear it', () => {
  const cross = (dash) => {
    const g = fresh();
    if (dash) g.relics.add('dash');
    place(g, 'hall', 42, 10);
    g.enemies = [];
    const room = roomById('hall'), edge = (room.mx * COLS + 50) * TILE;
    let jumped = false, dashed = false;
    for (let i = 0; i < 240; i++) {
      const x = g.body.x, input = { right: true, jump: false, dash: false };
      if (!jumped && x > edge - 8) { input.jump = true; jumped = true; }
      else if (jumped && g.body.vy < 0 && i % 1 === 0 && !g.body.ground) input.jump = true;
      if (dash && jumped && !dashed && !g.body.ground && g.body.vy > -200) { input.dash = true; dashed = true; }
      g.step(DT, { ...NO_INPUT, ...input });
    }
    return g.body.y < (room.my * ROWS + 12) * TILE && g.body.x > (room.mx * COLS + 59) * TILE;
  };
  assert.equal(cross(false), false, 'too wide to jump');
  assert.equal(cross(true), true, 'the Dust Dash carries them over');
});

test('getting hurt knocks back, grants a moment of safety, and a worn-out hero is tagged out', () => {
  const g = fresh();
  place(g, 'path', 8, 11);
  g.enemies = [];
  const e = g.spawn('beetle', g.body.x + 8, g.body.y);
  g.step(DT, NO_INPUT);
  const lost = 50 - g.hp.dora;
  assert.equal(lost, FOES.beetle.atk - g.stats('dora').def);
  run(g, {}, 0.2);
  assert.equal(50 - g.hp.dora, lost, 'no second hit while flashing');
  e.dead = 1;
  g.hp.dora = 1; g.body.invT = 0;
  g.hurtHero(20, g.body.x + 5);
  assert.equal(g.hp.dora, 0);
  assert.equal(g.leader, 'enzo', 'Enzo takes over');
  run(g, {}, 1.5);
  tap(g, 'tag');
  assert.equal(g.leader, 'enzo', 'Dora can’t tag back in until rested');
  g.hp.enzo = 1; g.body.invT = 0;
  g.hurtHero(30, g.body.x + 5);
  assert.equal(g.state, 'dead');
});

test('a dust-bath shrine heals both, revives, and writes a save that loads back', () => {
  const g = fresh();
  g.hp.dora = 3; g.hp.enzo = 0;
  g.leaves = 1; g.raisins = 12;
  place(g, 'save-hall', 4, 11);
  assert.equal(g.saved, null);
  run(g, { right: true }, 0.6);
  assert.ok(g.saved, 'saved');
  assert.equal(g.hp.dora, g.stats('dora').maxHp);
  assert.equal(g.hp.enzo, g.stats('enzo').maxHp);
  const text = JSON.stringify(g.saved), back = parseSave(text);
  assert.equal(back.room, 'save-hall');
  assert.equal(back.raisins, 12);
  const h = new FluffstevaniaGame(back);
  assert.equal(h.room.id, 'save-hall');
  assert.equal(h.stats('dora').maxHp, g.stats('dora').maxHp);
  const saves = g.events.filter((e) => e === 'save').length;
  run(g, { right: true }, 0.2);
  assert.equal(g.events.filter((e) => e === 'save').length, saves, 'standing on it doesn’t save again');
  assert.equal(parseSave('nonsense'), null);
  assert.equal(parseSave(JSON.stringify({ v: 1, room: 'nowhere' })), null);
  assert.equal(parseSave(JSON.stringify({ ...freshSave(), bag: { junk: 3, cake: 2 } })).bag.cake, 2);
});

test('cracked walls crumble when hit and stay broken; hidden treasure is kept', () => {
  const g = fresh();
  place(g, 'hall', 7, 10);
  g.enemies = [];
  g.body.face = -1;
  const room = roomById('hall'), wc = room.mx * COLS + 5, wr = room.my * ROWS + 9;
  assert.ok(g.solidAt((wc + 0.5) * TILE, (wr + 0.5) * TILE));
  tap(g, 'attack');
  run(g, {}, 0.4);
  assert.ok(!g.solidAt((wc + 0.5) * TILE, (wr + 0.5) * TILE), 'the wall broke');
  assert.ok(g.flags.has(`wall:${wc},${wr}`));
  const hp = g.stats('dora').maxHp;
  run(g, { left: true }, 1);
  assert.equal(g.leaves, 1, 'Wolfberry Leaf taken');
  assert.equal(g.stats('dora').maxHp, hp + 10);
  const h = new FluffstevaniaGame(parseSave(JSON.stringify(g.snapshot())));
  assert.ok(!h.solidAt((wc + 0.5) * TILE, (wr + 0.5) * TILE), 'still broken after loading');
  assert.ok(!h.pickups.some((p) => p.kind === 'leaf'), 'the leaf doesn’t come back');
});

test('candles drop seeds and raisins; seeds are thrown with up + attack', () => {
  const g = fresh();
  place(g, 'path', 17, 11);
  g.enemies = [];
  const seeds = g.seeds, raisins = g.raisins;
  for (let i = 0; i < 20 && g.candles.some((c) => c.alive); i++) {
    const c = g.candles.find((c) => c.alive);
    g.body.x = c.x - 20; g.body.y = c.y + 12; g.body.face = 1; g.body.vy = 0;
    g.body.attackT = 0; tap(g, 'attack'); run(g, {}, 0.4);
    for (const p of g.pickups) { g.body.x = p.x; g.body.y = p.y; run(g, {}, 0.1); }
  }
  assert.ok(g.candles.every((c) => !c.alive));
  assert.ok(g.seeds + g.raisins > seeds + raisins, 'candles dropped something');
  const before = g.seeds;
  place(g, 'path', 8, 11);
  g.step(DT, { ...NO_INPUT, up: true, attack: true });
  assert.equal(g.seeds, before - 1);
  assert.ok(g.shots.some((s) => s.kind === 'seed' && s.hero));
});

test('armadillo guards block from the front until their lunge leaves them open, and a tag tumble breaks through', () => {
  const g = fresh();
  place(g, 'path', 30, 11);
  g.enemies = [];
  const e = g.spawn('armadillo', g.body.x + 30, g.body.y);
  e.face = -1; e.state = 'awake'; e.stateT = 0;
  tap(g, 'attack');
  run(g, {}, 0.4);
  assert.equal(e.hp, FOES.armadillo.hp, 'blocked');
  assert.ok(g.pops.some((p) => p.text === 'GUARD'));
  e.state = 'rest'; e.stateT = 0; e.x = g.body.x + 30;
  tap(g, 'attack');
  run(g, {}, 0.4);
  const open = e.hp;
  assert.ok(open < FOES.armadillo.hp, 'hit while resting after a lunge');
  e.state = 'awake'; e.stateT = 0; e.x = g.body.x + 16; g.body.invT = 5;
  run(g, {}, 1.2);
  tap(g, 'tag');
  run(g, {}, 0.5);
  assert.ok(e.hp < open, 'the tag tumble ignores the shell');
});

test('gear changes stats and only fits the right hero; food heals', () => {
  const g = fresh();
  g.bag = { acorn: 1, cake: 1, bell: 1 };
  const atk = g.stats('enzo').atk;
  assert.equal(g.equip('dora', 'weapon', 'acorn'), false, 'Dora can’t swing a cudgel');
  assert.ok(g.equip('enzo', 'weapon', 'acorn'));
  assert.equal(g.stats('enzo').atk, atk + 7);
  assert.equal(g.bag.claws, 1, 'the old claws go back in the bag');
  assert.equal(g.weaponOf('enzo').style, 'club');
  assert.ok(g.equip('dora', 'acc', 'bell'));
  assert.equal(g.equip('enzo', 'acc', 'bell'), false, 'only one bell');
  g.hp.dora = 5;
  assert.ok(g.eat('cake', 'dora'));
  assert.equal(g.hp.dora, 45);
  assert.equal(g.bag.cake, undefined);
});

test('Duke Hootsworth: the gates shut, he attacks, and beating him opens the way', () => {
  const g = fresh();
  g.relics.add('dash');
  place(g, 'belfry', 5, 11);
  skipTalk(g);
  assert.ok(g.fight, 'the fight starts');
  assert.ok(g.boss);
  const room = roomById('belfry');
  assert.equal(g.tile(room.mx * COLS + 1, room.my * ROWS + 10), 'G', 'gate shut');
  g.hp.dora = g.hp.enzo = 9999;
  const moves = new Set();
  for (let i = 0; i < 120 * 30; i++) { g.step(DT, NO_INPUT); moves.add(g.boss.move); }
  for (const m of ['hover', 'feathers', 'rise', 'swoop']) assert.ok(moves.has(m), `uses ${m}`);
  assert.ok(g.hp.dora + g.hp.enzo < 9999 * 2, 'he lands hits');
  g.boss.hp = OWL.hp / 2 - 1; g.hitBoss(1, 0);
  for (let i = 0; i < 120 * 30; i++) { g.step(DT, NO_INPUT); moves.add(g.boss.move); }
  assert.ok(g.boss.phase2 && moves.has('drop'), 'phase two adds the dive');
  g.boss.hp = 1; g.hitBoss(50, 0);
  assert.equal(g.boss.move, 'dying');
  run(g, {}, 2.2);
  assert.ok(g.flags.has('boss:owl'));
  assert.equal(g.boss, null);
  assert.equal(g.fight, false);
  assert.equal(g.tile(room.mx * COLS + 1, room.my * ROWS + 10), '.', 'gate open');
  assert.equal(g.dialog.lines[0].who, 'owl');
  skipTalk(g);
  assert.ok(g.pickups.some((p) => p.kind === 'leaf'), 'he drops a Wolfberry Leaf');
  place(g, 'belfry', 5, 11);
  assert.equal(g.fight, false, 'he stays beaten');
});

test('reading the sealed door after the owl ends chapter one', () => {
  const g = fresh();
  g.flags.add('boss:owl');
  place(g, 'sealed', 13, 11);
  assert.ok(g.atSign);
  tap(g, 'up');
  assert.equal(g.dialog.lines[0].who, 'sign');
  skipTalk(g);
  assert.equal(g.state, 'chapter');
  g.resume();
  assert.equal(g.state, 'play');
  assert.ok(g.completion > 0 && g.completion <= 100);
});

test('the same inputs always play out the same way', () => {
  const play = () => { const g = fresh(); for (let i = 0; i < 1200; i++) g.step(DT, { ...NO_INPUT, right: i % 200 < 150, jump: i % 90 < 30, attack: i % 40 === 0 }); return JSON.stringify([g.body.x, g.body.y, g.hp, g.xp, g.raisins]); };
  assert.equal(play(), play());
});

console.log(`PASS Fluffstevania: ${passed} checks covering the map, reachability with and without the Dust Dash, movement, combat, tagging, saves, secrets, gear and the owl.`);
