import assert from 'node:assert/strict';
import {
  FluffstevaniaGame, ROOMS, COLS, ROWS, TILE, NO_INPUT, FOES, OWL, RAT, rawTile, roomAt, roomById, isSolid, parseSave, freshSave, xpToNext,
  TOTAL_CELLS, DASH_T, SHOP, GHOST_ON, GHOST_OFF, DIFFICULTY, CHARGE_T, SPIN, DUO_MAX, SPELLS, SUBS, maxMp, palXpToNext,
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
// The Dust Dash stretches the jump across and the Cloud Hop doubles its height. Cracked walls count as open because
// any attack breaks them; sealed doors are open once the owl (`ab.owl`) is beaten.
let ab = { dash: false, hop: false, owl: false };
const door = (c, r) => rawTile(c, r) === 'D' && !(ab.owl && roomAt(Math.floor(c / COLS), Math.floor(r / ROWS))?.opens === 'boss:owl');
const open = (c, r) => { const ch = rawTile(c, r); return !(ch === '#' || ch === '^' || door(c, r)); };
const floorAt = (c, r) => { const ch = rawTile(c, r); return ch === '#' || ch === '=' || ch === '%' || door(c, r); };
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
function moves(c, r) {
  const out = [];
  for (const s of [-1, 1]) {
    if (open(c + s, r) && open(c + s, r - 1)) { const l = land(c + s, r); if (l) out.push(l); }
  }
  if (rawTile(c, r + 1) === '=') { const l = land(c, r + 2); if (l) out.push(l); }
  for (let k = 1; k <= (ab.hop ? 7 : 4); k++) {
    if (!open(c, r - k) || !open(c, r - k - 1)) break;
    const reach = k > 4 ? 3 : ab.dash ? (k <= 2 ? 10 : 7) : k <= 2 ? 5 : 3;
    for (const s of [-1, 1]) for (let d = 1; d <= reach; d++) {
      const x = c + s * d, y = r - k;
      if (!open(x, y) || !open(x, y - 1)) break;
      const l = land(x, y); if (l) out.push(l);
    }
    if (standable(c, r - k)) out.push([c, r - k]);
  }
  return out;
}
function explore(abilities) {
  ab = { dash: false, hop: false, owl: false, ...abilities };
  const start = [5, 2 * ROWS + 11], seen = new Map([[key(...start), start]]), queue = [start], edges = new Map();
  while (queue.length) {
    const [c, r] = queue.shift(), from = key(c, r);
    for (const [x, y] of moves(c, r)) {
      const k = key(x, y);
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k).push(from);
      if (!seen.has(k)) { seen.set(k, [x, y]); queue.push([x, y]); }
    }
  }
  return { seen, edges, start: key(...start) };
}
const roomsIn = (seen) => new Set([...seen.values()].map(([c, r]) => roomAt(Math.floor(c / COLS), Math.floor(r / ROWS))?.id));
const CHAPTER_1 = ['path', 'gate', 'hall', 'save-hall', 'shaft', 'cellar', 'relic', 'secret', 'stair', 'save-belfry', 'belfry', 'sealed'];
/** A spot a hero could stand next to a marker in a room, e.g. the ledge under an item. */
const spotOf = (roomId, ch) => { const room = roomById(roomId); for (let r = 0; r < room.rows.length; r++) { const c = room.rows[r].indexOf(ch); if (c >= 0) return key(room.mx * COLS + c, room.my * ROWS + r); } };

test('without the Dust Dash the cellar and relic are reachable but the belfry is not', () => {
  const rooms = roomsIn(explore({}).seen);
  for (const id of ['path', 'gate', 'hall', 'save-hall', 'shaft', 'cellar', 'relic', 'secret']) assert.ok(rooms.has(id), id);
  for (const id of ['stair', 'save-belfry', 'belfry', 'sealed']) assert.ok(!rooms.has(id), `${id} should need the Dust Dash`);
});

test('the sealed door keeps chapter II shut until the owl is beaten', () => {
  const rooms = roomsIn(explore({ dash: true }).seen);
  for (const id of CHAPTER_1) assert.ok(rooms.has(id), id);
  for (const r of ROOMS) if (r.area === 'catacombs') assert.ok(!rooms.has(r.id), `${r.id} should be behind the sealed door`);
});

test('in the catacombs the Cloud Hop is reachable, but the Rat King and the high treasures need it', () => {
  const { seen } = explore({ dash: true, owl: true }), rooms = roomsIn(seen);
  for (const id of ['crypt-stair', 'ossuary', 'save-crypt', 'larder', 'hop-vault', 'jam-vault']) assert.ok(rooms.has(id), id);
  for (const id of ['chimney', 'throne', 'library']) assert.ok(!rooms.has(id), `${id} should need the Cloud Hop`);
  assert.ok(seen.has(spotOf('hop-vault', 'R')), 'the Cloud Hop pedestal');
  assert.ok(seen.has(spotOf('larder', 'I')), 'the rolling pin shelf');
  assert.ok(!seen.has(spotOf('jam-vault', 'I')), 'the Wolfberry Blade needs the Cloud Hop');
  assert.ok(!seen.has(spotOf('ossuary', 'H')), 'the ossuary leaf needs the Cloud Hop');
});

test('sub-weapons and familiars sit where they can be reached at the right time', () => {
  let { seen } = explore({});
  assert.ok(seen.has(spotOf('cellar', 'U')), 'the Seed Spread is an early find');
  assert.ok(seen.has(spotOf('cellar', 'P')), 'Pudding is in the cellar');
  ({ seen } = explore({ dash: true }));
  assert.ok(seen.has(spotOf('stair', 'Z')), 'Zippy’s cage is on the belfry stair');
  assert.ok(!seen.has(spotOf('stair', 'U')), 'the Boomerang Acorn waits for the Cloud Hop');
  ({ seen } = explore({ dash: true, owl: true }));
  assert.ok(seen.has(spotOf('larder', 'U')), 'the Pumpkin Flask is in the larder');
  assert.ok(seen.has(spotOf('save-crypt', 'Y')), 'Mochi soaks by the catacomb shrine');
});

test('with every relic every room is reachable and every spot can get back to the start', () => {
  const { seen, edges, start } = explore({ dash: true, hop: true, owl: true });
  const rooms = roomsIn(seen);
  for (const r of ROOMS) assert.ok(rooms.has(r.id), r.id);
  for (const [room, ch] of [['jam-vault', 'I'], ['jam-vault', 'H'], ['ossuary', 'H'], ['stair', 'U']]) assert.ok(seen.has(spotOf(room, ch)), `${room} ${ch}`);
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
  assert.ok(e.hp < FOES.beetle.hp, 'the fan reaches the beetle');
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

test('Enzo lunges into his swipes, stopping when they connect', () => {
  const g = fresh();
  place(g, 'path', 8, 11);
  g.enemies = [];
  g.leader = 'enzo';
  run(g, {}, 0.05);
  // Nothing in the way: the lunge carries him forward.
  let x = g.body.x;
  tap(g, 'attack');
  run(g, {}, 0.3);
  assert.ok(g.body.x - x > 16, `lunged ${g.body.x - x}px`);
  // A foe 44 px away: the old 20 px claws never reached that far.
  x = g.body.x;
  const e = g.spawn('beetle', x + 44, g.body.y);
  e.face = 1;
  g.body.attackT = 0; tap(g, 'attack');
  run(g, {}, 0.3);
  assert.ok(e.hp < FOES.beetle.hp, 'the claws reach');
  assert.ok(g.body.x - x < 30, 'the lunge stops where it lands');
  assert.equal(g.hp.enzo, g.stats('enzo').maxHp, 'lunging in doesn’t bump into the beetle');
});

test('a lunge won’t carry anyone off a ledge', () => {
  const g = fresh();
  g.leader = 'enzo';
  place(g, 'hall', 45, 10);
  g.enemies = [];
  g.body.x = ((roomById('hall').mx * COLS) + 49 + 0.5) * TILE; g.body.face = 1;
  run(g, {}, 0.1);
  const y = g.body.y;
  tap(g, 'attack');
  run(g, {}, 0.3);
  assert.equal(g.body.y, y, 'still on the gallery');
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

test('the Cloud Hop is a second jump in mid-air, once per jump', () => {
  const peak = (hop) => {
    const g = fresh();
    if (hop) g.relics.add('hop');
    place(g, 'path', 8, 11);
    g.enemies = [];
    run(g, {}, 0.2);
    const y = g.body.y;
    let top = y;
    run(g, { jump: true }, 0.3);
    g.step(DT, NO_INPUT);
    for (let i = 0; i < 90; i++) { g.step(DT, { ...NO_INPUT, jump: true }); top = Math.min(top, g.body.y); }
    g.step(DT, NO_INPUT);
    for (let i = 0; i < 60; i++) { g.step(DT, { ...NO_INPUT, jump: true }); top = Math.min(top, g.body.y); }
    return y - top;
  };
  const one = peak(false), two = peak(true);
  assert.ok(one < 85, `one jump rises ${one}`);
  assert.ok(two > 125, `a hop on top rises ${two}`);
});

test('the shrine ledge in the catacombs needs the Cloud Hop', () => {
  const climb = (hop) => {
    const g = fresh();
    g.flags.add('boss:owl'); g.flags.add('script:pip');
    if (hop) g.relics.add('hop');
    place(g, 'save-crypt', 11, 11);
    g.enemies = [];
    run(g, {}, 0.2);
    run(g, { jump: true }, 0.35);
    g.step(DT, NO_INPUT);
    run(g, { jump: true }, 0.4);
    run(g, {}, 0.8);
    return g.body.y <= (roomById('save-crypt').my * ROWS + 5) * TILE;
  };
  assert.equal(climb(false), false, 'one jump falls short');
  assert.equal(climb(true), true, 'a jump and a hop land on it');
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

test('older saves swap the whips and swords for fans', () => {
  const old = { ...freshSave(), equip: { dora: { weapon: 'ribbon', armor: null, acc: null }, enzo: { weapon: 'claws', armor: 'scarf', acc: null } }, bag: { bramble: 1, cake: 1 } };
  const s = parseSave(JSON.stringify(old));
  assert.equal(s.equip.dora.weapon, 'fan');
  assert.equal(s.bag.moonfan, 1);
  assert.equal(s.bag.bramble, undefined);
  assert.equal(new FluffstevaniaGame(s).weaponOf('dora').style, 'fan');
});

test('Pip’s stall sells for raisins and pauses the world', () => {
  const g = fresh();
  g.flags.add('boss:owl'); g.flags.add('script:pip');
  place(g, 'save-crypt', 18, 11);
  assert.equal(g.prompt, 'SHOP');
  tap(g, 'up');
  assert.ok(g.shop);
  const x = g.body.x;
  run(g, { left: true }, 0.3);
  assert.equal(g.body.x, x, 'the world waits');
  g.raisins = 30;
  assert.equal(g.buy('ring'), false, 'too dear');
  assert.ok(g.buy('cake'));
  assert.equal(g.raisins, 30 - SHOP.find((s) => s.id === 'cake').price);
  assert.equal(g.bag.cake, 1);
  const seeds = g.seeds;
  g.raisins = 100;
  assert.ok(g.buy('seeds'));
  assert.equal(g.seeds, seeds + 10);
  g.closeShop();
  run(g, { left: true }, 0.3);
  assert.ok(g.body.x < x, 'walking again');
});

test('catacomb foes: rats charge, ghosts fade out of reach, spiders drop from their threads', () => {
  const g = fresh();
  place(g, 'path', 33, 11);
  g.enemies = []; g.body.invT = 99;
  const rat = g.spawn('rat', g.body.x + 100, g.body.y);
  let fastest = 0, closest = 1e9;
  for (let i = 0; i < 240; i++) { const x = rat.x; g.step(DT, NO_INPUT); fastest = Math.max(fastest, Math.abs(rat.x - x) / DT); closest = Math.min(closest, Math.abs(rat.x - g.body.x)); }
  assert.ok(fastest > 200 && closest < 10, `the rat charged over (${Math.round(fastest)} px/s, ${Math.round(closest)} px away)`);
  g.enemies = [];
  const ghost = g.spawn('ghost', g.body.x + 30, g.body.y - 4);
  ghost.t = GHOST_ON + 0.1;
  g.body.invT = 0; g.body.face = 1;
  tap(g, 'attack');
  run(g, {}, 0.3);
  assert.equal(ghost.hp, FOES.ghost.hp, 'a faded ghost can’t be hit');
  assert.equal(g.hp.dora, g.stats('dora').maxHp, 'nor can it hurt');
  ghost.t = 0; ghost.x = g.body.x + 30; ghost.y = g.body.y - 4;
  g.body.attackT = 0; tap(g, 'attack');
  run(g, {}, 0.1);
  assert.ok(ghost.hp < FOES.ghost.hp, 'a solid ghost can');
  g.enemies = []; g.body.invT = 99;
  const spider = g.spawn('spider', g.body.x, g.body.y - 90);
  run(g, {}, 0.5);
  assert.ok(spider.y > spider.hy + 40, 'the spider dropped');
  g.body.x += 100;
  run(g, {}, 3);
  assert.ok(Math.abs(spider.y - spider.hy) < 2, 'and climbed back up');
  assert.ok(GHOST_OFF > 0);
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
  assert.equal(g.state, 'chapter', 'chapter one ends');
  assert.equal(g.chapter, 1);
  assert.ok(g.pickups.some((p) => p.kind === 'leaf'), 'he drops a Wolfberry Leaf');
  g.resume();
  place(g, 'belfry', 5, 11);
  assert.equal(g.fight, false, 'he stays beaten');
  const sealed = roomById('sealed');
  assert.equal(g.tile(sealed.mx * COLS + 18, sealed.my * ROWS + 10), '.', 'the sealed door is open');
  assert.equal(new FluffstevaniaGame().tile(sealed.mx * COLS + 18, sealed.my * ROWS + 10), 'D', 'but shut in a new game');
  place(g, 'sealed', 13, 11);
  assert.ok(g.atSign);
  tap(g, 'up');
  assert.equal(g.dialog.lines[0].who, 'sign');
  skipTalk(g);
  assert.equal(g.state, 'play');
  assert.ok(g.completion > 0 && g.completion <= 100);
});

test('Gnawdrick the Rat King: charges, leaps, bowls cheese, calls rats, and ends chapter two', () => {
  const g = fresh();
  for (const f of ['boss:owl', 'script:crypt', 'script:pip', 'script:larder']) g.flags.add(f);
  g.relics.add('dash'); g.relics.add('hop');
  place(g, 'throne', 6, 11);
  skipTalk(g);
  assert.ok(g.fight && g.boss && g.boss.kind === 'rat');
  const room = roomById('throne');
  assert.equal(g.tile(room.mx * COLS + 1, room.my * ROWS + 10), 'G', 'gate shut');
  g.hp.dora = g.hp.enzo = 9999;
  const moves = new Set();
  for (let i = 0; i < 120 * 30; i++) { g.step(DT, NO_INPUT); moves.add(g.boss.move); }
  for (const m of ['wind', 'charge', 'stunned', 'crouch', 'leap', 'cheese']) assert.ok(moves.has(m), `uses ${m}`);
  assert.ok(g.hp.dora + g.hp.enzo < 9999 * 2, 'he lands hits');
  const floor = (room.my * ROWS + 12) * TILE;
  assert.ok(g.boss.y + RAT.h / 2 <= floor + 0.5, 'he stays on the floor');
  g.boss.hp = RAT.hp / 2 - 1; g.hitBoss(1, 0);
  g.step(DT, NO_INPUT);
  assert.ok(g.boss.phase2);
  assert.equal(g.enemies.filter((e) => e.kind === 'rat' && !e.dead).length, 2, 'two rats answer his call');
  g.boss.hp = 1; g.hitBoss(50, 0);
  run(g, {}, 2.2);
  assert.ok(g.flags.has('boss:rat'));
  assert.equal(g.dialog.lines[0].who, 'rat');
  skipTalk(g);
  assert.equal(g.state, 'chapter');
  assert.equal(g.chapter, 2);
});


// ─── Round three: difficulty, combos, the fan, Duo Strike, magic, familiars ───

test('difficulty scales foes, Easy heals at doorways and Hard bosses start fierce', () => {
  for (const d of ['easy', 'normal', 'hard']) {
    const g = new FluffstevaniaGame(freshSave(d)); skipTalk(g);
    const e = g.spawn('beetle', 0, 0);
    assert.equal(e.hp, Math.round(FOES.beetle.hp * DIFFICULTY[d].foeHp), d);
    g.body.invT = 0;
    g.hurtHero(20, g.body.x + 5);
    assert.equal(g.stats('dora').maxHp - g.hp.dora, Math.max(1, Math.round(20 * DIFFICULTY[d].foeAtk - g.stats('dora').def)), `${d} damage`);
  }
  const easy = new FluffstevaniaGame(freshSave('easy')); skipTalk(easy);
  easy.hp.dora = 10;
  run(easy, { right: true }, 3.5);
  assert.equal(easy.room.id, 'path');
  place(easy, 'gate', 2, 11);
  assert.ok(easy.hp.dora > 10, 'a doorway healed Dora');
  const hard = new FluffstevaniaGame(freshSave('hard')); skipTalk(hard);
  place(hard, 'belfry', 5, 11); skipTalk(hard);
  hard.hp.dora = hard.hp.enzo = 9999;
  const moves = new Set();
  for (let i = 0; i < 120 * 30; i++) { hard.step(DT, NO_INPUT); moves.add(hard.boss.move); }
  assert.ok(!hard.boss.phase2 && moves.has('drop'), 'the owl dives before half health on Hard');
  assert.equal(parseSave(JSON.stringify(hard.snapshot())).difficulty, 'hard');
});

test('defeated foes stay down until a rest or a change of area', () => {
  const g = fresh();
  place(g, 'path', 16, 11);
  const beetle = g.enemies.find((e) => e.kind === 'beetle');
  beetle.hp = 1; beetle.x = g.body.x + 24; beetle.face = 1;
  tap(g, 'attack'); run(g, {}, 0.6);
  assert.equal(g.kills.beetle, 1, 'counted for the Bestiary');
  place(g, 'gate', 2, 11); place(g, 'path', 40, 11);
  assert.ok(!g.enemies.some((e) => e.kind === 'beetle'), 'still gone after coming back');
  place(g, 'hall', 4, 24); place(g, 'gate', 20, 11); place(g, 'path', 40, 11);
  assert.ok(g.enemies.some((e) => e.kind === 'beetle'), 'back after a trip to another area');
  const beetles = () => g.enemies.filter((e) => e.kind === 'beetle' && !e.dead).length;
  place(g, 'cellar', 30, 7);
  const before = beetles();
  const b2 = g.enemies.find((e) => e.kind === 'beetle'); b2.hp = 0; b2.dead = 1; g.slain.add(b2.key);
  place(g, 'shaft', 10, 25); place(g, 'cellar', 30, 7);
  assert.equal(beetles(), before - 1, 'the same area keeps it down');
  place(g, 'save-hall', 4, 11); run(g, { right: true }, 0.6);
  assert.equal(g.slain.size, 0, 'a rest at a shrine brings everything back');
});

test('bosses are saved the moment they fall', () => {
  const g = fresh();
  g.relics.add('dash');
  place(g, 'belfry', 5, 11); skipTalk(g);
  g.boss.hp = 1; g.hitBoss(50, 0);
  run(g, {}, 2.2);
  assert.ok(g.saved && g.saved.flags.includes('boss:owl'), 'saved with the owl beaten');
  const again = new FluffstevaniaGame(parseSave(JSON.stringify(g.saved)));
  assert.ok(!again.fight && !again.boss, 'no second fight after loading');
  assert.ok(again.pickups.some((p) => p.kind === 'leaf'), 'the unclaimed leaf waits in the room');
});

test('attacks chain into a three-hit combo whose finisher hits harder, and Enzo’s launches', () => {
  const g = fresh();
  place(g, 'path', 34, 11);
  g.enemies = [];
  const e = g.spawn('beetle', g.body.x + 26, g.body.y); e.hp = 999; e.face = 1;
  const combos = [];
  for (let i = 0; i < 3; i++) { tap(g, 'attack'); combos.push(g.body.combo); run(g, {}, 0.22); e.x = g.body.x + 26; e.vx = 0; }
  assert.deepEqual(combos, [0, 1, 2]);
  run(g, {}, 0.6);
  tap(g, 'attack');
  assert.equal(g.body.combo, 0, 'a pause starts the string again');
  run(g, {}, 0.5);
  g.enemies = []; g.leader = 'enzo';
  const f = g.spawn('bone', g.body.x + 26, g.body.y); f.hp = 999; f.face = 1;
  let launched = false;
  for (let i = 0; i < 3; i++) { tap(g, 'attack'); for (let k = 0; k < 26; k++) { g.step(DT, NO_INPUT); if (f.vy < -250) launched = true; } f.x = g.body.x + 26; }
  assert.ok(launched, 'the third swipe throws the foe up');
});

test('Dora’s fan blows gusts and, held and released, spins to hit both sides', () => {
  const g = fresh();
  place(g, 'path', 34, 11);
  g.enemies = [];
  tap(g, 'attack');
  run(g, {}, 0.1);
  assert.ok(g.shots.some((s) => s.kind === 'gust' && s.hero), 'a gust of dust flies out');
  run(g, {}, 0.6);
  const front = g.spawn('bone', g.body.x + 20, g.body.y), back = g.spawn('bone', g.body.x - 20, g.body.y);
  front.hp = back.hp = 999; front.face = back.face = 1; g.body.invT = 99;
  run(g, { attack: true }, 0.3 + CHARGE_T + 0.1);
  g.step(DT, NO_INPUT);
  assert.ok(g.body.spin, 'the spin starts on release');
  run(g, {}, SPIN.total);
  assert.ok(front.hp < 999 && back.hp < 999, 'both sides were hit');
});

test('the Duo Strike fills from hits and strikes everything in view', () => {
  const g = fresh();
  place(g, 'path', 34, 11);
  g.enemies = [];
  const near = g.spawn('beetle', g.body.x + 60, g.body.y), far = g.spawn('beetle', g.body.x + 150, g.body.y);
  near.hp = far.hp = 999;
  g.duo = DUO_MAX - 1;
  tap(g, 'duo');
  assert.equal(g.duoT, -1, 'not ready yet');
  g.duo = DUO_MAX; g.body.attackT = 0;
  g.step(DT, { ...NO_INPUT, tag: true, attack: true });
  assert.ok(g.duoT >= 0 && g.duo === 0, 'tag and attack together set it off');
  assert.equal(g.leader, 'dora', 'no ordinary tag');
  run(g, {}, 1.2);
  assert.ok(near.hp < 999 && far.hp < 999, 'every foe on screen was hit');
  assert.equal(g.duoT, -1);
  const h = fresh(); place(h, 'path', 34, 11); h.enemies = [];
  const e = h.spawn('beetle', h.body.x + 26, h.body.y); e.hp = 999; e.face = 1;
  for (let i = 0; i < 6; i++) { h.body.attackT = 0; h.body.comboT = 9; tap(h, 'attack'); run(h, {}, 0.4); e.x = h.body.x + 26; }
  assert.ok(h.duo > 0, 'hits fill the meter');
});

test('spells cost Dust and are cast with a motion or the spell button', () => {
  const g = fresh();
  place(g, 'path', 34, 11);
  g.enemies = [];
  tap(g, 'spell');
  assert.ok(!g.shots.some((s) => s.kind === 'wind'), 'Dora doesn’t know Whirlwind at level 1');
  g.gainXp(xpToNext(1) + xpToNext(2));
  assert.equal(g.spellOf('dora'), 'whirlwind');
  const mp = g.mp;
  // ↓, ↓→, → then attack.
  g.step(DT, { ...NO_INPUT, down: true }); g.step(DT, { ...NO_INPUT, down: true, right: true }); g.step(DT, { ...NO_INPUT, right: true });
  g.step(DT, { ...NO_INPUT, right: true, attack: true });
  assert.ok(g.shots.some((s) => s.kind === 'wind'), 'Whirlwind');
  assert.equal(g.mp, mp - SPELLS.whirlwind.cost);
  run(g, {}, 0.6);
  g.mp = 3; g.shots = [];
  tap(g, 'spell');
  assert.ok(!g.shots.some((s) => s.kind === 'wind'), 'not enough Dust');
  run(g, {}, 3.7);
  assert.ok(g.mp >= 6, 'Dust trickles back');
  g.gainXp(xpToNext(3));
  g.leader = 'enzo'; g.mp = maxMp(g.level);
  tap(g, 'spell');
  assert.equal(g.shots.filter((s) => s.kind === 'quake').length, 2, 'Burrow Quake runs both ways');
});

test('sub-weapons: the spread, the boomerang acorn and the pumpkin flask', () => {
  const g = fresh();
  place(g, 'cellar', 17, 11);
  run(g, { jump: true, right: true }, 0.25); run(g, {}, 0.8);
  assert.ok(g.subs.has('spread') && g.sub === 'spread', 'the Seed Spread was on the shelf');
  place(g, 'path', 34, 11); g.enemies = []; g.seeds = 10;
  g.step(DT, { ...NO_INPUT, up: true, attack: true });
  assert.equal(g.shots.filter((s) => s.kind === 'seed').length, 3);
  assert.equal(g.seeds, 10 - SUBS.spread.cost);
  run(g, {}, 2);
  g.subs.add('acorn'); assert.ok(g.setSub('acorn')); g.shots = [];
  const e = g.spawn('beetle', g.body.x + 50, g.body.y); e.hp = 999;
  g.step(DT, { ...NO_INPUT, up: true, attack: true });
  let out = 0;
  for (let i = 0; i < 200 && g.shots.length; i++) { g.step(DT, NO_INPUT); out = Math.max(out, g.shots[0]?.x - g.body.x || 0); }
  assert.ok(out > 60 && g.shots.length === 0, 'the acorn flew out and came back');
  assert.ok(999 - e.hp > 0, 'and hit on the way');
  g.enemies = []; g.subs.add('pumpkin'); g.setSub('pumpkin'); g.body.subCd = 0;
  g.step(DT, { ...NO_INPUT, up: true, attack: true });
  run(g, {}, 0.8);
  assert.ok(g.shots.filter((s) => s.kind === 'flame').length >= 3, 'the flask burst into flames');
  assert.equal(g.setSub('nothing'), false);
});

test('shrines you have found can warp you to one another', () => {
  const g = fresh();
  place(g, 'save-hall', 4, 11); run(g, { right: true }, 0.6);
  assert.equal(g.prompt, null, 'one shrine is nowhere to go');
  g.relics.add('dash');
  place(g, 'save-belfry', 8, 11); run(g, { right: true }, 0.4);
  assert.equal(g.prompt, 'WARP');
  tap(g, 'up');
  assert.ok(g.warp);
  assert.deepEqual(g.shrines(), ['save-hall', 'save-belfry']);
  assert.ok(g.warpTo('save-hall'));
  assert.equal(g.room.id, 'save-hall');
  assert.equal(g.warp, false);
  assert.equal(g.warpTo('save-crypt'), false, 'not found yet');
});

test('familiars: Pudding for a Hay Cake, Zippy out of the cage, Mochi once the Rat King falls', () => {
  const g = fresh();
  place(g, 'cellar', 56, 11);
  assert.equal(g.prompt, 'TALK');
  tap(g, 'up');
  assert.equal(g.dialog.lines[0].who, 'pudding'); skipTalk(g);
  assert.ok(!g.pals.pudding, 'hungry, not joining yet');
  g.bag.cake = 1;
  tap(g, 'up'); skipTalk(g);
  assert.ok(g.pals.pudding && g.pal === 'pudding' && !g.bag.cake, 'Pudding joins for the cake');
  // Pudding heals the lead when they are badly hurt.
  g.enemies = []; g.hp.dora = 5; g.palBody.cd = 0;
  run(g, {}, 0.2);
  assert.ok(g.hp.dora > 5, 'squeak, heal');
  g.relics.add('dash');
  place(g, 'stair', 17, 11);
  assert.ok(g.cage);
  g.enemies = []; g.body.face = 1;
  for (let i = 0; i < 3; i++) { g.body.x = g.cage.x - 24; g.body.attackT = 0; g.body.comboT = 9; tap(g, 'attack'); run(g, {}, 0.45); if (!g.cage) break; }
  assert.equal(g.cage, null, 'three hits break the cage');
  skipTalk(g);
  assert.ok(g.pals.zippy);
  assert.ok(g.setPal('zippy'));
  // Zippy glides at a nearby foe.
  const bat = g.spawn('beetle', g.body.x + 60, g.body.y); bat.hp = 999; g.palBody.cd = 0; g.body.invT = 99;
  run(g, {}, 1.5);
  assert.ok(bat.hp < 999, 'Zippy nipped it');
  g.flags.add('boss:owl'); g.flags.add('script:pip');
  place(g, 'save-crypt', 2, 11);
  tap(g, 'up'); assert.equal(g.dialog.lines[0].who, 'mochi'); skipTalk(g);
  assert.ok(!g.pals.mochi);
  g.flags.add('boss:rat');
  tap(g, 'up'); skipTalk(g);
  assert.ok(g.pals.mochi && g.setPal('mochi'));
  // Mochi bonks away a shot heading for the lead.
  g.palBody.cd = 0; g.body.invT = 0;
  g.shots.push({ kind: 'bone', x: g.body.x + 30, y: g.body.y - 10, vx: -120, vy: 0, grav: 0, r: 5, dmg: 9, hero: false, life: 2, spin: 0 });
  const hp = g.hp.dora;
  run(g, {}, 0.4);
  assert.equal(g.hp.dora, hp, 'BONK');
  // Familiars level up with you.
  g.gainXp(palXpToNext(1) + 1);
  assert.equal(g.pals.mochi.level, 2);
  const back = new FluffstevaniaGame(parseSave(JSON.stringify(g.snapshot())));
  assert.equal(back.pal, 'mochi'); assert.equal(back.pals.mochi.level, 2); assert.ok(back.pals.zippy && back.pals.pudding);
  assert.ok(!back.cage || back.room.id !== 'stair');
});

test('the Silver Bell gives away a nearby cracked wall', () => {
  const g = fresh();
  g.equipped.dora.acc = 'bell';
  place(g, 'hall', 12, 21);
  run(g, {}, 0.5);
  assert.ok(!g.events.includes('secret'), 'too far away');
  g.events.length = 0;
  place(g, 'hall', 8, 13);
  run(g, {}, 0.5);
  assert.ok(g.events.includes('secret'), 'jingle');
});

test('the same inputs always play out the same way', () => {
  const play = () => { const g = fresh(); for (let i = 0; i < 1200; i++) g.step(DT, { ...NO_INPUT, right: i % 200 < 150, jump: i % 90 < 30, attack: i % 40 === 0 }); return JSON.stringify([g.body.x, g.body.y, g.hp, g.xp, g.raisins]); };
  assert.equal(play(), play());
});

console.log(`PASS Fluffstevania: ${passed} checks covering the map, reachability, movement, combat and combos, the fan, Duo Strike, spells, sub-weapons, tagging, saves, difficulty, respawns, warps, familiars, the shop, the foes and both bosses.`);
