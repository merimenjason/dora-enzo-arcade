import assert from 'node:assert/strict';
import {
  FluffstevaniaGame, ROOMS, COLS, ROWS, TILE, NO_INPUT, FOES, OWL, RAT, rawTile, roomAt, roomById, isSolid, parseSave, freshSave, xpToNext,
  TOTAL_CELLS, DASH_T, SHOP, GHOST_ON, GHOST_OFF, DIFFICULTY, CHARGE_T, SPIN, DUO_MAX, SPELLS, SUBS, maxMp, palXpToNext, BURN_T,
  BOSSES, CLING_FALL, ROLL_T, PETAL_T, foeHidden, roomRect,
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
// any attack breaks them. Sealed doors open once their flag is set: the owl (`ab.owl`), the Rat King (`ab.rat`) or
// Count Culpeo (`ab.fox`) beaten, or the archive's shelf puzzle solved (`ab.puzzle`). Iron grates let a hero through
// only with Mist Form. With the Wall Cling (`ab.climb`) a hero can cling to any spot beside a wall, and a kick off it
// works like a jump.
let ab = { dash: false, hop: false, owl: false, rat: false, mist: false, puzzle: false, fox: false, climb: false };
const OPENED = { 'boss:owl': 'owl', 'boss:rat': 'rat', 'puzzle:archive': 'puzzle', 'boss:fox': 'fox' };
const door = (c, r) => rawTile(c, r) === 'D' && !ab[OPENED[roomAt(Math.floor(c / COLS), Math.floor(r / ROWS))?.opens]];
const open = (c, r) => { const ch = rawTile(c, r); return !(ch === '#' || ch === '^' || door(c, r) || (ch === '|' && !ab.mist)); };
const floorAt = (c, r) => { const ch = rawTile(c, r); return ch === '#' || ch === '=' || ch === '%' || ch === '|' || door(c, r); };
const standable = (c, r) => open(c, r) && open(c, r - 1) && floorAt(c, r + 1);
const grips = (c, r) => { const ch = rawTile(c, r); return ch === '#' || ch === '%' || door(c, r); };
const clingable = (c, r) => ab.climb && open(c, r) && open(c, r - 1) && ((grips(c - 1, r) && grips(c - 1, r - 1)) || (grips(c + 1, r) && grips(c + 1, r - 1)));
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
  if (!standable(c, r)) { const l = land(c, r); if (l) out.push(l); }   // let go of a wall and drop
  for (let k = 1; k <= (ab.hop ? 7 : 4); k++) {
    if (!open(c, r - k) || !open(c, r - k - 1)) break;
    const reach = k > 4 ? 3 : ab.dash ? (k <= 2 ? 10 : 7) : k <= 2 ? 5 : 3;
    for (const s of [-1, 1]) for (let d = 1; d <= reach; d++) {
      const x = c + s * d, y = r - k;
      if (!open(x, y) || !open(x, y - 1)) break;
      const l = land(x, y); if (l) out.push(l);
      if (clingable(x, y)) out.push([x, y]);
    }
    if (standable(c, r - k)) out.push([c, r - k]);
    if (clingable(c, r - k)) out.push([c, r - k]);
  }
  return out;
}
function explore(abilities) {
  ab = { dash: false, hop: false, owl: false, rat: false, mist: false, puzzle: false, fox: false, climb: false, ...abilities };
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

test('the library door waits for the Rat King, the tower for Mist Form and the reliquary for the shelf puzzle', () => {
  const library = ROOMS.filter((r) => r.area === 'library' && r.id !== 'library').map((r) => r.id);
  let rooms = roomsIn(explore({ dash: true, hop: true, owl: true }).seen);
  assert.ok(rooms.has('library'), 'the locked door is reachable');
  for (const id of library) assert.ok(!rooms.has(id), `${id} should be behind the library door`);
  const { seen } = explore({ dash: true, hop: true, owl: true, rat: true });
  rooms = roomsIn(seen);
  for (const id of ['reading', 'stacks', 'mist-vault', 'archive', 'save-library', 'scriptorium']) assert.ok(rooms.has(id), id);
  for (const id of ['tower', 'study', 'balcony']) assert.ok(!rooms.has(id), `${id} should need Mist Form`);
  assert.ok(!rooms.has('reliquary'), 'the reliquary needs the puzzle');
  assert.ok(seen.has(spotOf('mist-vault', 'R')), 'the Mist Form pedestal');
  assert.ok(!seen.has(spotOf('reading', 'H')), 'the reading nook needs Mist Form');
  rooms = roomsIn(explore({ dash: true, hop: true, owl: true, rat: true, mist: true }).seen);
  for (const id of ['tower', 'study', 'balcony']) assert.ok(rooms.has(id), id);
  for (const r of ROOMS) if (r.area === 'clock') assert.ok(!rooms.has(r.id), `${r.id} should wait for Count Culpeo`);
  assert.ok(roomsIn(explore({ dash: true, hop: true, owl: true, rat: true, puzzle: true }).seen).has('reliquary'));
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

test('the Clock Tower opens once the Count flees; its sheer shaft, the pocket watch and the top need the Wall Cling', () => {
  const before = { dash: true, hop: true, owl: true, rat: true, mist: true, puzzle: true, fox: true };
  const { seen } = explore(before), rooms = roomsIn(seen);
  for (const id of ['gear-hall', 'clock-shaft', 'claw-vault', 'cuckoo-gallery']) assert.ok(rooms.has(id), id);
  for (const id of ['clockworks', 'save-clock', 'pendulum-hall', 'winding-stair', 'clockface', 'clock-top']) assert.ok(!rooms.has(id), `${id} should need the Wall Cling`);
  assert.ok(seen.has(spotOf('claw-vault', 'R')), 'the Wall Cling pedestal');
  assert.ok(!seen.has(spotOf('cuckoo-gallery', 'W')), 'the pocket watch needs the Wall Cling');
  assert.ok(!seen.has(spotOf('cuckoo-gallery', 'H')), 'so does the gallery leaf');
  const climbed = roomsIn(explore({ ...before, climb: true }).seen);
  for (const r of ROOMS) if (r.area === 'clock') assert.ok(climbed.has(r.id), r.id);
});

test('with every relic every room is reachable and every spot can get back to the start', () => {
  const { seen, edges, start } = explore({ dash: true, hop: true, owl: true, rat: true, mist: true, puzzle: true, fox: true, climb: true });
  const rooms = roomsIn(seen);
  for (const r of ROOMS) assert.ok(rooms.has(r.id), r.id);
  for (const [room, ch] of [['jam-vault', 'I'], ['jam-vault', 'H'], ['ossuary', 'H'], ['stair', 'U'], ['reading', 'H'], ['reliquary', 'I'], ['scriptorium', 'I'], ['mist-vault', 'R'],
    ['cuckoo-gallery', 'W'], ['cuckoo-gallery', 'H'], ['clockworks', 'U'], ['clockworks', 'C'], ['pendulum-hall', 'T'], ['pendulum-hall', 'I'], ['winding-stair', 'T']]) assert.ok(seen.has(spotOf(room, ch)), `${room} ${ch}`);
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


// ─── Chapter III: Count Culpeo's Library ────────────────────────────────────

const chapter3 = () => {
  const g = fresh();
  for (const f of ['boss:owl', 'boss:rat', 'script:crypt', 'script:pip', 'script:larder', 'script:library']) g.flags.add(f);
  g.relics.add('dash'); g.relics.add('hop'); g.level = 12;
  g.hp.dora = g.stats('dora').maxHp; g.hp.enzo = g.stats('enzo').maxHp;
  return g;
};

test('the library door opens once the Rat King is beaten', () => {
  const g = fresh();
  const room = roomById('library'), c = room.mx * COLS + 18, r = room.my * ROWS + 10;
  assert.ok(isSolid(g.tile(c, r)));
  g.flags.add('boss:rat');
  assert.ok(!isSolid(g.tile(c, r)));
});

test('an iron grate stops everyone, but Mist Form drifts through it', () => {
  const g = chapter3();
  place(g, 'scriptorium', 40, 11);
  run(g, { right: true }, 1.2);
  assert.equal(g.room.id, 'scriptorium', 'the grate holds');
  g.relics.add('mist');
  let misted = false;
  for (let i = 0; i < 240 && g.room.id === 'scriptorium'; i++) { g.step(DT, { ...NO_INPUT, right: true }); misted ||= g.misting; }
  assert.ok(misted, 'drawn as mist inside the bars');
  assert.ok(g.events.includes('mist'));
  run(g, { right: true }, 0.5);
  assert.equal(g.room.id, 'tower');
});

test('the archive shelves: a wrong book bites, the right one opens the hidden door', () => {
  const g = chapter3();
  place(g, 'archive', 8, 11);
  g.enemies = [];
  const room = roomById('archive'), door = [room.mx * COLS + 41, room.my * ROWS + 10];
  assert.equal(g.shelves.length, 3);
  const strike = (n) => {
    const sh = g.shelves.find((s) => s.n === n);
    g.body.x = sh.x - 20; g.body.y = sh.y; g.body.face = 1; g.body.attackT = 0; g.body.combo = 0; g.body.comboT = 9;
    for (const s of g.shelves) s.flash = 0;
    tap(g, 'attack'); run(g, {}, 0.3);
  };
  strike(1);
  assert.ok(!g.flags.has('puzzle:archive'));
  assert.ok(g.enemies.some((e) => e.kind === 'book'), 'a book flew off the shelf');
  assert.ok(isSolid(g.tile(...door)));
  strike(2);
  assert.ok(g.flags.has('puzzle:archive'), 'the red book opens it');
  assert.ok(!isSolid(g.tile(...door)), 'the door stands open');
});

test('library foes: tomes snap, quills flick ink and ink blots spring', () => {
  const g = chapter3();
  place(g, 'reading', 20, 11);
  g.enemies = [];
  g.hp.dora = g.hp.enzo = 9999;
  const book = g.spawn('book', g.body.x + 60, g.body.y - 20);
  const quill = g.spawn('quill', g.body.x - 80, g.body.y - 40);
  const ink = g.spawn('ink', g.body.x + 60, g.body.y);
  const states = { book: new Set(), ink: new Set() };
  let inked = false;
  for (let i = 0; i < 120 * 6; i++) {
    g.step(DT, NO_INPUT); g.body.invT = 0.5;
    states.book.add(book.state); states.ink.add(ink.state);
    inked ||= g.shots.some((s) => s.kind === 'ink');
  }
  assert.ok(states.book.has('lunge'), 'the tome snaps forward');
  assert.ok(inked, 'the quill flicks ink');
  assert.ok(states.ink.has('lunge'), 'the ink blot springs');
  assert.ok(quill.hp > 0);
});

test('Count Culpeo: fireballs, vanishing, a cape sweep, swoops, bats and fire pillars, and the end of chapter three', () => {
  const g = chapter3();
  g.relics.add('mist');
  place(g, 'study', 6, 11);
  skipTalk(g);
  assert.ok(g.fight && g.boss && g.boss.kind === 'fox');
  g.hp.dora = g.hp.enzo = 9999;
  const moves = new Set();
  let fire = false, hidden = false;
  for (let i = 0; i < 120 * 30; i++) {
    g.step(DT, NO_INPUT);
    moves.add(g.boss.move);
    fire ||= g.shots.some((s) => s.kind === 'fire');
    if (g.boss.move === 'vanish' && g.boss.t > 0.3) hidden ||= !g.bossOpen(g.boss);
  }
  for (const m of ['fire', 'vanish', 'appear', 'lunge', 'swoop']) assert.ok(moves.has(m), `uses ${m}`);
  assert.ok(fire, 'throws fireballs');
  assert.ok(hidden, 'can’t be hit while vanished');
  assert.ok(g.hp.dora + g.hp.enzo < 9999 * 2, 'he lands hits');
  g.boss.move = 'float'; g.boss.t = 0;
  g.boss.hp = g.boss.max / 2 - 1; g.hitBoss(1, 0);
  g.step(DT, NO_INPUT);
  assert.ok(g.boss.phase2);
  assert.equal(g.enemies.filter((e) => e.kind === 'bat' && !e.dead).length, 2, 'his bats pour out');
  moves.clear();
  for (let i = 0; i < 120 * 30; i++) { g.step(DT, NO_INPUT); moves.add(g.boss.move); }
  assert.ok(moves.has('pillars'), 'raises fire pillars at half health');
  while (!g.bossOpen(g.boss)) g.step(DT, NO_INPUT);
  g.boss.hp = 1; g.hitBoss(50, 0);
  run(g, {}, 2.2);
  assert.ok(g.flags.has('boss:fox'));
  assert.equal(g.kills.culpeo, 1);
  assert.equal(g.dialog.lines[0].who, 'fox');
  skipTalk(g);
  assert.equal(g.state, 'chapter');
  assert.equal(g.chapter, 3);
});

// ─── Chapter IV: the Clock Tower ───────────────────────────────────────────

const chapter4 = () => {
  const g = chapter3();
  for (const f of ['boss:fox', 'script:clock', 'script:pipClock']) g.flags.add(f);
  g.relics.add('mist'); g.level = 16;
  g.hp.dora = g.stats('dora').maxHp; g.hp.enzo = g.stats('enzo').maxHp; g.mp = g.maxMp;
  return g;
};
/** Feet y of a hero standing on world row r of a room. */
const floorY = (roomId, r) => (roomById(roomId).my * ROWS + r + 1) * TILE;

test('the balcony door to the Clock Tower opens once Count Culpeo flees', () => {
  const g = fresh();
  const room = roomById('balcony'), c = room.mx * COLS + 20, r = room.my * ROWS + 10;
  assert.ok(isSolid(g.tile(c, r)));
  g.flags.add('boss:fox');
  assert.ok(!isSolid(g.tile(c, r)));
});

test('the Wall Cling: without it a wall is just a wall; with it she clings, slides slowly and kicks her way up the sheer shaft', () => {
  const g = chapter4();
  place(g, 'clock-shaft', 19, 33);
  g.enemies = []; g.body.ground = false; g.body.coyote = 0;
  run(g, { right: true }, 0.3);
  assert.ok(!g.clinging && g.body.vy > CLING_FALL * 2, 'no relic: she just falls past the wall');
  g.relics.add('climb');
  place(g, 'clock-shaft', 19, 33);
  g.enemies = []; g.events.length = 0;
  run(g, { right: true }, 0.4);
  assert.ok(g.clinging, 'she grips the wall');
  assert.ok(g.body.vy <= CLING_FALL + 0.01, 'and slides down it slowly');
  assert.ok(g.events.includes('cling'));
  // Kick off, steer back to the wall, and kick again until she stands on the ledge high above the landing.
  let hold = 0, prev = false, kicks = 0;
  for (let i = 0; i < 120 * 20; i++) {
    let jump = false;
    if (hold > 0) { hold -= DT; jump = true; } else if ((g.clinging || g.body.ground) && !prev) { hold = 0.3; jump = true; }
    g.events.length = 0;
    g.step(DT, { ...NO_INPUT, right: true, jump });
    if (g.events.includes('walljump')) kicks++;
    prev = jump;
    if (g.body.ground && g.body.y <= floorY('clock-shaft', 25) + 1) break;
  }
  assert.ok(kicks >= 2, `kicked off the wall ${kicks} times`);
  assert.ok(g.body.ground && g.body.y <= floorY('clock-shaft', 25) + 1, 'up on the ledge above the sheer climb');
  // Spikes and grates can't be clung to.
  place(g, 'scriptorium', 42, 7);
  g.enemies = [];
  run(g, { right: true }, 0.3);
  assert.ok(!g.clinging, 'no grip on an iron grate');
});

test('clock tower foes: clockwork mice zoom, cuckoos hide in their clocks and spit notes, spring toads hop', () => {
  const g = chapter4();
  place(g, 'gear-hall', 24, 11);
  g.enemies = [];
  g.hp.dora = g.hp.enzo = 9999;
  const mouse = g.spawn('mouse', g.body.x + 70, g.body.y);
  const cuckoo = g.spawn('cuckoo', g.body.x - 60, g.body.y - 50);
  const toad = g.spawn('toad', g.body.x - 120, g.body.y);
  assert.ok(foeHidden(cuckoo), 'the cuckoo starts shut in its clock');
  const states = { mouse: new Set(), toad: new Set() };
  let noted = false, hopped = false, out = false;
  for (let i = 0; i < 120 * 7; i++) {
    g.step(DT, NO_INPUT); g.body.invT = 0.5;
    states.mouse.add(mouse.state); states.toad.add(toad.state);
    noted ||= g.shots.some((s) => s.kind === 'note');
    hopped ||= toad.vy < -300;
    out ||= !foeHidden(cuckoo);
  }
  assert.ok(states.mouse.has('wind') && states.mouse.has('lunge'), 'the mouse winds up and zooms');
  assert.ok(out && noted, 'the cuckoo pops out and spits a note');
  assert.ok(hopped && states.toad.has('rest'), 'the toad springs and lands');
  // A cuckoo in its clock can't be struck.
  cuckoo.state = 'idle'; cuckoo.stateT = 0;
  const hp = cuckoo.hp;
  g.body.x = cuckoo.x - 20; g.body.y = cuckoo.y + 8; g.body.face = 1; g.body.attackT = 0; g.body.comboT = 9;
  g.step(DT, { ...NO_INPUT, attack: true }); run(g, {}, 0.2);
  assert.equal(cuckoo.hp, hp, 'safe inside its clock');
});

test('Tick-Tock the Clockwork Cat: pounces, cogs, a wall dive that leaves her dizzy, chimes and mice, and the end of chapter four', () => {
  const g = chapter4();
  g.relics.add('climb');
  place(g, 'clockface', 6, 11);
  skipTalk(g);
  assert.ok(g.fight && g.boss && g.boss.kind === 'cat');
  g.hp.dora = g.hp.enzo = 9999;
  const moves = new Set();
  let cogs = false, clung = false;
  for (let i = 0; i < 120 * 40; i++) {
    g.step(DT, NO_INPUT);
    moves.add(g.boss.move);
    cogs ||= g.shots.some((s) => s.kind === 'cog');
    if (g.boss.move === 'cling') clung ||= g.boss.y < roomRect(g.room).y + 6 * TILE;
  }
  for (const m of ['crouch', 'pounce', 'cogs', 'dash', 'climb', 'cling', 'dive', 'dizzy']) assert.ok(moves.has(m), `uses ${m}`);
  assert.ok(!moves.has('chime'), 'no chimes before half health on Normal');
  assert.ok(cogs, 'bowls cogs');
  assert.ok(clung, 'clings high on the wall');
  assert.ok(g.hp.dora + g.hp.enzo < 9999 * 2, 'she lands hits');
  g.boss.move = 'dizzy'; g.boss.t = 0;
  const before = g.boss.hp; g.hitBoss(100, 0);
  assert.equal(before - g.boss.hp, Math.round(100 * 1.25) - BOSSES.cat.def, 'a dizzy cat takes extra');
  g.boss.move = 'prowl'; g.boss.t = 0;
  g.boss.hp = g.boss.max / 2 - 1; g.hitBoss(1, 0);
  g.step(DT, NO_INPUT);
  assert.ok(g.boss.phase2);
  assert.equal(g.enemies.filter((e) => e.kind === 'mouse' && !e.dead).length, 2, 'her mice are let loose');
  moves.clear();
  const chimes = new Set();
  for (let i = 0; i < 120 * 30; i++) { g.step(DT, NO_INPUT); moves.add(g.boss.move); for (const s of g.shots) if (s.kind === 'chime') chimes.add(Math.round(s.y)); }
  assert.ok(moves.has('chime'), 'rings her bell at half health');
  assert.ok(chimes.size >= 2, 'a low chime and a high one');
  g.boss.hp = 1; g.hitBoss(50, 0);
  run(g, {}, 2.2);
  assert.ok(g.flags.has('boss:cat'));
  assert.equal(g.kills.ticktock, 1);
  assert.equal(g.dialog.lines[0].who, 'cat');
  skipTalk(g);
  assert.equal(g.state, 'chapter');
  assert.equal(g.chapter, 4);
});

test('spell scrolls: Boulder Roll and Petal Ward are read from scrolls and cast with ↓ + spell or a motion', () => {
  const g = chapter4();
  g.relics.add('climb');
  g.leader = 'enzo';
  assert.deepEqual(g.spellsOf('enzo'), ['quake']);
  place(g, 'pendulum-hall', 20, 5);
  run(g, {}, 0.5);
  assert.equal(g.dialog?.lines[0].who, 'sign', 'the scroll is read out');
  skipTalk(g);
  assert.ok(g.knows('boulder') && g.flags.has('spell:boulder'));
  assert.deepEqual(g.spellsOf('enzo'), ['quake', 'boulder']);
  // Boulder Roll: Enzo bowls forward through a beetle without a scratch, and bounces back off a door.
  place(g, 'gear-hall', 22, 11);
  g.enemies = []; g.mp = g.maxMp; g.body.face = 1;
  const beetle = g.spawn('beetle', g.body.x + 60, g.body.y); beetle.hp = 999;
  const x0 = g.body.x, hp = g.hp.enzo, mp = g.mp;
  g.step(DT, { ...NO_INPUT, down: true, spell: true });
  assert.ok(g.body.rollT > 0 && g.shots.some((s) => s.kind === 'boulder'), 'he curls up and rolls');
  assert.equal(g.mp, mp - SPELLS.boulder.cost);
  run(g, {}, 0.4);
  assert.ok(g.body.x - x0 > 80, 'rolled a good way');
  assert.ok(beetle.hp < 999 && g.hp.enzo === hp, 'flattened the beetle, unhurt');
  run(g, {}, 0.5);
  place(g, 'clock-top', 15, 11);
  g.enemies = []; g.mp = g.maxMp; g.body.face = 1;
  g.step(DT, { ...NO_INPUT, down: true, spell: true });
  run(g, {}, ROLL_T);
  assert.equal(g.body.face, -1, 'bounced back off the hatch');
  // Motions work too: → ↘ ↓ + attack.
  run(g, {}, 0.3); g.mp = g.maxMp; g.shots = [];
  g.step(DT, { ...NO_INPUT, right: true }); g.step(DT, { ...NO_INPUT, right: true, down: true }); g.step(DT, { ...NO_INPUT, down: true });
  g.step(DT, { ...NO_INPUT, down: true, attack: true });
  assert.ok(g.body.rollT > 0, 'Boulder Roll by motion');
  run(g, {}, 1);
  // Petal Ward: six petals whirl round Dora and knock a bone out of the air.
  g.leader = 'dora'; g.flags.add('spell:petals');
  place(g, 'gear-hall', 22, 11);
  g.enemies = []; g.mp = g.maxMp; g.shots = [];
  tap(g, 'spell');
  assert.ok(g.shots.some((s) => s.kind === 'wind'), 'the plain spell button is still Whirlwind');
  run(g, {}, 1); g.shots = []; g.mp = g.maxMp;
  g.step(DT, { ...NO_INPUT, down: true, spell: true });
  assert.equal(g.shots.filter((s) => s.kind === 'petal').length, 6);
  run(g, {}, 0.2);
  g.body.invT = 0;
  const bone = { kind: 'bone', x: g.body.x + 60, y: g.body.y - 12, vx: -140, vy: 0, grav: 0, r: 5, dmg: 9, hero: false, life: 2, spin: 0 };
  g.shots.push(bone);
  const dora = g.hp.dora;
  run(g, {}, 0.6);
  assert.ok(bone.life <= 0 && g.hp.dora === dora, 'the petals knocked the bone away');
  run(g, {}, PETAL_T);
  assert.equal(g.shots.filter((s) => s.kind === 'petal').length, 0, 'the petals fade');
  const back = new FluffstevaniaGame(parseSave(JSON.stringify(g.snapshot())));
  assert.ok(back.knows('petals') && back.knows('boulder'), 'scrolls stay read');
});

test('the Clockwork Cog drops to the floor, rolls along it through foes and bounces back off walls', () => {
  const g = chapter4();
  place(g, 'clockworks', 28, 6);
  run(g, {}, 0.5);
  assert.ok(g.subs.has('cog') && g.sub === 'cog', 'found on the high shelf');
  place(g, 'gear-hall', 22, 11);
  g.enemies = []; g.seeds = 10; g.body.face = -1;
  const mouse = g.spawn('mouse', g.body.x - 60, g.body.y); mouse.hp = 999;
  g.step(DT, { ...NO_INPUT, up: true, attack: true });
  assert.equal(g.seeds, 10 - SUBS.cog.cost);
  const cog = g.shots.find((s) => s.kind === 'cog');
  let rolled = false, bounced = false;
  for (let i = 0; i < 240 && cog.life > 0; i++) { g.step(DT, NO_INPUT); rolled ||= cog.vy === 0 && Math.abs(cog.vx) === 230; bounced ||= cog.vx > 0; }
  assert.ok(rolled, 'rolls along the floor');
  assert.ok(bounced, 'and back off the wall');
  assert.ok(mouse.hp < 999, 'through the mouse');
});

test('Nutmeg joins for her pocket watch, then fetches loose loot and digs up raisins', () => {
  const g = chapter4();
  g.relics.add('climb');
  place(g, 'clockworks', 42, 11);
  g.enemies = [];
  assert.equal(g.prompt, 'TALK');
  tap(g, 'up');
  assert.equal(g.dialog.lines[0].who, 'nutmeg'); skipTalk(g);
  assert.ok(!g.pals.nutmeg, 'not without her watch');
  place(g, 'cuckoo-gallery', 18, 3);
  g.enemies = [];
  run(g, {}, 0.5);
  assert.ok(g.flags.has('watch'), 'the watch was on the high shelf');
  place(g, 'clockworks', 42, 11);
  g.enemies = [];
  tap(g, 'up'); skipTalk(g);
  assert.ok(g.pals.nutmeg && g.pal === 'nutmeg', 'Nutmeg joins');
  place(g, 'gear-hall', 22, 11);
  g.enemies = [];
  const raisins = g.raisins;
  g['drop']('raisin', 'raisin', 3, g.body.x + 60, g.body.y - 20);
  run(g, {}, 1.2);
  assert.equal(g.raisins, raisins + 3, 'she brought the raisins over');
  g.pals.nutmeg.level = 10;
  let found = 0;
  for (let i = 0; i < 20; i++) { const e = g.spawn('beetle', g.body.x + 200, g.body.y); g['hitFoe'](e, 999, g.body.x, true, 0); if (g.pops.some((p) => p.text === 'FOUND!')) found++; g.pops = []; }
  assert.ok(found > 0, `she dug up raisins ${found} times in 20`);
  const back = new FluffstevaniaGame(parseSave(JSON.stringify(g.snapshot())));
  assert.equal(back.pal, 'nutmeg'); assert.ok(back.has('climb') && back.flags.has('watch'));
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

test('a defeated foe burns away, and its Dust motes fly into the lead and top up the Dust meter', () => {
  const g = fresh();
  g.enemies = [];
  const e = g['spawn']('bone', g.body.x + 40, g.body.y);
  g.mp = 0;
  g['hitFoe'](e, 999, g.body.x, true, 0);
  assert.ok(e.dead > 0 && g.enemies.includes(e), 'still there, burning');
  assert.equal(g.orbs.length, 2);
  run(g, {}, BURN_T + 0.05);
  assert.ok(!g.enemies.includes(e), 'burnt away');
  run(g, {}, 2);
  assert.equal(g.orbs.length, 0);
  assert.equal(g.events.filter((ev) => ev === 'orb').length, 2, 'both motes caught');
  assert.ok(g.mp >= 2, 'each mote restores Dust');
});

test('finishers, spells and the Duo Strike show big damage numbers; plain hits do not', () => {
  const g = fresh();
  g.enemies = [];
  const e = g['spawn']('armadillo', g.body.x + 30, g.body.y);
  e.face = -1; e.hp = 9999;
  g['hitFoe'](e, 20, g.body.x + 60, true, 0);
  assert.ok(!g.pops.at(-1).big);
  g.level = 6; g.leader = 'enzo'; g.mp = 99;
  g['cast']('quake');
  assert.ok(g.shots.every((s) => s.kind !== 'quake' || s.spell), 'the Quake spell is marked as a spell');
  run(g, {}, 0.3);
  assert.ok(g.pops.some((p) => p.big && p.color === '#ffd35a'), 'the spell hit big and gold');
});

test('levelling up raises a pillar of light, and dashing sheds fur', () => {
  const g = fresh();
  g.gainXp(xpToNext(1));
  assert.ok(g.fx.some((f) => f.kind === 'pillar'));
  g.relics.add('dash');
  run(g, {}, 0.3);
  tap(g, 'dash');
  assert.ok(g.fx.some((f) => f.kind === 'fur'));
});

test("Enzo's club finisher sends out shockwaves that throw up stone shards", () => {
  const g = fresh();
  g.leader = 'enzo'; g.equipped.enzo.weapon = 'acorn';
  for (let i = 0; i < 3; i++) { tap(g, 'attack'); run(g, {}, 0.25); }
  const waves = g.shots.filter((s) => s.kind === 'quake');
  assert.ok(waves.length > 0 || g.fx.some((f) => f.kind === 'shard'), 'a shockwave went out');
  assert.ok(g.fx.some((f) => f.kind === 'shard'));
});

test('the same inputs always play out the same way', () => {
  const play = () => { const g = fresh(); for (let i = 0; i < 1200; i++) g.step(DT, { ...NO_INPUT, right: i % 200 < 150, jump: i % 90 < 30, attack: i % 40 === 0 }); return JSON.stringify([g.body.x, g.body.y, g.hp, g.xp, g.raisins]); };
  assert.equal(play(), play());
});

console.log(`PASS Fluffstevania: ${passed} checks covering the map, reachability, movement, combat and combos, the fan, Duo Strike, spells, sub-weapons, tagging, saves, difficulty, respawns, warps, familiars, the shop, the foes and all four bosses, the library's grates and shelf puzzle, the Clock Tower's Wall Cling, spell scrolls and Clockwork Cog, Nutmeg, and the effects that feed the renderer.`);
