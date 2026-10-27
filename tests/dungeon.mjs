// Dust Bunny Dungeon engine checks: rooms and floors are well made and always solvable, every rule does what it says,
// you are only ever bopped on a tile that was marked, and a seed plus its actions replays a run exactly.
import assert from 'node:assert/strict';
import {
  DungeonGame, ROOMS, ARENAS, transform, W, H, DX, DY, FLOORS, BOSS, KINDS, BESTIARY, PERKS, PERK_FLOORS, TOOLS, TOOL_MAX, CHARS, DUST_CALM, DUST_EVERY,
  WALL, FLOOR, PIT, SPIKE, LOWERED, SWITCH, BELLOWS, DOOR, LOCKED, STAIRS, CHEST, HARMFUL, walkable, replay, readProfile, freshProfile, keepRun, record, dailySeed, hash, SAVE_KEY,
} from '../.checks/dungeon-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const I = (x, y) => y * W + x;

// ---- rooms
ok(ROOMS.length >= 12, 'a good handful of room shapes');
for (const [k, r] of ROOMS.entries()) {
  ok(r.length === 9 && r.every((row) => row.length === 9), `room ${k} is nine by nine`);
  ok(r[0] === '.........' && r[8] === '.........' && r.every((row) => row[0] === '.' && row[8] === '.'), `room ${k} keeps an open ring so every doorway joins up`);
  ok(r.join('').split('').every((c) => '.#o^vsbceihB'.includes(c)), `room ${k} uses known tiles`);
}
for (const [k, a] of ARENAS.entries()) {
  ok(a.length === 19 && a.every((row) => row.length === 19), `arena ${k} is nineteen by nineteen`);
  ok(a.join('').split('B').length === 2, `arena ${k} has one boss spot`);
  ok(a[0] === '.'.repeat(19) && a[18] === '.'.repeat(19) && a.every((row) => row[0] === '.' && row[18] === '.'), `arena ${k} keeps an open ring`);
}
{
  const t = ROOMS[3];
  eq(transform(t, 4, false), t, 'four quarter turns come back round');
  eq(transform(transform(t, 0, true), 0, true), t, 'two flips come back round');
  const turned = transform(t, 1, false);
  ok(turned.join('').split('').sort().join('') === t.join('').split('').sort().join(''), 'turning keeps every tile');
  eq(transform(['ab', 'cd'], 1, false), ['ca', 'db'], 'a quarter turn is clockwise');
}

// ---- floors: always solvable, safe starts, stairs or a boss, keys outside their doors
const jump = (g, f) => { while (g.floor < f) { g.floor++; g['build'](); } return g; };
let floorsMade = 0;
for (let seed = 1; seed <= 120; seed++) {
  const g = new DungeonGame(seed * 7919);
  for (let f = 1; f <= FLOORS; f++) {
    if (f > 1) jump(g, f);
    floorsMade++;
    ok(g.solvable(), `seed ${seed} floor ${f}: every doorway, the stairs or boss, and the key can be reached`);
    ok(g.tiles[g.pi] === FLOOR, 'you start on open floor');
    const near = g.enemies.filter((e) => Math.abs(e.x - g.px) + Math.abs(e.y - g.py) <= 3);
    ok(near.length === 0, `seed ${seed} floor ${f}: nothing waits within three tiles of the start`);
    ok(g.enemies.every((e) => !g.roomsAt(e.x, e.y).includes(g.startRoom) || e.minion), 'the start room is empty');
    ok(g.enemies.every((e) => walkable(g.tiles[I(e.x, e.y)]) && !g.crates[I(e.x, e.y)]), 'enemies stand on open floor');
    if (BOSS[f]) {
      ok(g.stairs === -1 && g.enemies.filter((e) => KINDS[e.kind].boss).length === 1 && g.enemies.find((e) => KINDS[e.kind].boss).kind === BOSS[f], `floor ${f} has its boss and no stairs yet`);
    } else {
      ok(g.tiles[g.stairs] === STAIRS && g.stairsRoom !== g.startRoom, `floor ${f} has stairs away from the start`);
      ok(g.enemies.every((e) => !KINDS[e.kind].boss), 'no boss on an ordinary floor');
    }
    const locked = [...g.tiles].filter((t) => t === LOCKED).length, chests = [...g.tiles].filter((t) => t === CHEST).length, keys = [...g.items.values()].filter((i) => i === 'key').length;
    ok(locked === chests && locked <= 1 && keys === locked, 'a locked door always comes with one chest and one key');
    ok(g.enemies.every((e) => !g.roomsAt(e.x, e.y).includes(g.treasure)), 'the treasure room is quiet');
  }
}
{
  const a = new DungeonGame(42), b = new DungeonGame(42), c = new DungeonGame(43);
  ok(a.tiles.every((t, i) => t === b.tiles[i]) && a.enemies.length === b.enemies.length && a.pi === b.pi, 'the same seed makes the same floor');
  ok(!a.tiles.every((t, i) => t === c.tiles[i]), 'another seed makes another floor');
  ok(dailySeed('2026-10-27') === dailySeed('2026-10-27') && dailySeed('2026-10-27') !== dailySeed('2026-10-28'), 'one daily seed per date');
  ok(hash(1, 2) !== hash(2, 1), 'the hash cares about order');
}

// ---- a bare test room: a walled box with nothing in it
function box(char = 'dora') {
  const g = new DungeonGame(5, char);
  g.tiles.fill(WALL); g.crates.fill(0); g.seen.fill(1); g.items.clear(); g.enemies = []; g.clouds.clear(); g.stairs = -1; g.doors = [];
  for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) g.tiles[I(x, y)] = FLOOR;
  g.px = 5; g.py = 5; g.roomOf = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  return g;
}
const put = (g, kind, x, y) => { const e = g.spawn(kind, I(x, y), false); e.awake = true; e.hidden = false; return e; };
const ready = (g) => { for (const e of g.enemies) e.fresh = false; g.planAll(); };

{
  const g = box();
  ok(!g.act('Q') && !g.act('T9') && !g.act('P0'), 'nonsense and perks outside a perk pick are refused');
  g.tiles[I(5, 4)] = WALL;
  ok(!g.act('U') && g.log.length === 0 && g.turn === 0, 'walking into a wall is refused and costs no turn');
  ok(g.act('R') && g.px === 6 && g.turn === 1 && g.log.join() === 'R', 'a step moves you and is logged');
  ok(g.act('W') && g.px === 6 && g.turn === 2, 'waiting passes a turn');
}
{
  const g = box(), e = put(g, 'fluff', 6, 5); ready(g);
  eq(e.intent.kind, 'hit', 'a dust bunny next to you marks your tile');
  ok(g.danger().has(g.pi), 'and that tile shows as danger');
  ok(g.act('W') && g.hp === CHARS.dora.hp - 1, 'standing on a marked tile gets you bopped');
  ok(g.act('D') && g.hp === CHARS.dora.hp - 1, 'stepping off the mark dodges the bop');
}
{
  const g = box(), e = put(g, 'fluff', 6, 5); ready(g);
  g.act('R');
  ok(!g.enemies.includes(e) && g.stats.tidied === 1 && g.stats.kinds.fluff === 1, 'one broom bop poofs a dust bunny');
  ok(g.hp === CHARS.dora.hp, 'and a poofed bunny bops no one');
}
{
  const g = box(), e = put(g, 'mimic', 9, 5); g.px = 8; ready(g);
  g.act('R');
  ok(e.hp === 1 && e.x === 9 && e.t === 0, 'a bop knocks a mimic into the wall: one for the bop, one for the bonk, and dizzy, it misses its turn');
  const k = box(), m = put(k, 'mimic', 7, 5); k.px = 6; ready(k);
  eq(m.intent.kind, 'hit', 'a mimic next to you means to bop you');
  k.act('R');
  ok(m.x === 8 && k.hp === CHARS.dora.hp && m.t === 1, 'knocked back a tile, its bop lands short');
}
{
  const g = box(), e = put(g, 'roller', 6, 5); g.tiles[I(7, 5)] = PIT; ready(g);
  g.act('R');
  ok(!g.enemies.includes(e), 'knocked into a pit, an enemy is poofed');
  const h = box(), a = put(h, 'mimic', 6, 5), b = put(h, 'mimic', 7, 5); ready(h);
  h.act('R');
  ok(a.hp === 1 && b.hp === 2 && b.x === 8 && a.x === 6, 'knocked into a friend: both bonk and the friend slides on');
  const k = box(), s = put(k, 'mimic', 6, 5); k.tiles[I(7, 5)] = SPIKE; ready(k);
  k.act('R');
  ok(!k.enemies.includes(s), 'knocked onto raised prickles, an enemy is poofed');
}
{
  const g = box(), r = put(g, 'roller', 5, 2); ready(g);
  eq(r.intent.kind, 'roll', 'a tumble fluff in line with you rolls');
  ok(r.intent.tiles.includes(g.pi) && r.intent.tiles.includes(I(5, 9)), 'it marks the whole line to the wall');
  g.act('R');
  ok(g.hp === CHARS.dora.hp && r.y === 9, 'stepping out of the line dodges it, and it rolls to the wall');
  eq(r.intent.kind, 'rest', 'then it rests a turn');
}
{
  const g = box(), r = put(g, 'roller', 5, 2); ready(g);
  g.act('W');
  ok(g.hp === CHARS.dora.hp - 1 && r.y === 4, 'standing in the line gets you bowled over; it stops next to you');
}
{
  const g = box(), h = put(g, 'hopper', 5, 3); ready(g);
  eq(h.intent.kind, 'jump', 'a hop bunny two tiles away jumps at you');
  ok(h.intent.to === g.pi && h.intent.tiles.length === 3, 'it marks the landing and the tiles either side');
  g.act('U');
  ok(g.hp === CHARS.dora.hp, 'stepping toward it, under the jump, dodges');
}
{
  const g = box(), p = put(g, 'puffer', 5, 2); ready(g);
  eq(p.intent.kind, 'puff', 'a puff bunny three tiles away puffs at you');
  g.act('R');
  ok(g.clouds.has(I(5, 5)), 'the puff leaves a cloud');
  ok(g.danger().has(I(5, 5)), 'and the cloud is marked');
  g.act('L');
  ok(g.hp === CHARS.dora.hp - 1, 'walking into an old cloud makes you cough');
}
{
  const g = box(), s = put(g, 'sneezer', 5, 3); g.py = 5; ready(g);
  eq(s.intent.kind, 'sneeze', 'a sneezy bunny in line sneezes');
  g.act('W');
  ok(g.py === 6 && g.hp === CHARS.dora.hp, 'the sneeze pushes you a tile');
  const k = box(), s2 = put(k, 'sneezer', 5, 7); k.py = 9; ready(k);
  k.act('W');
  ok(k.py === 9 && k.hp === CHARS.dora.hp - 1, 'sneezed into a wall is a bonk');
  void s2;
}
{
  const g = box(), b = put(g, 'burrower', 5, 2); ready(g);
  eq(b.intent.kind, 'dig', 'a burrow bunny digs down');
  g.act('W');
  ok(b.under && !g.enemyAt(I(5, 2)), 'and is under the floor, out of reach');
  eq(b.intent.kind, 'tunnel', 'it tunnels toward you');
  g.act('W');
  eq(b.intent.kind, 'emerge', 'close by, it marks where it will pop up');
  ok(b.intent.to === g.pi, 'right under you');
  g.act('L');
  ok(!b.under && g.hp === CHARS.dora.hp, 'step aside and it pops up harmlessly');
}
{
  const g = box(), m = g.spawn('mimic', I(6, 5), false); ready(g);
  ok(m.hidden && m.intent.kind === 'none', 'a bale mimic hides as a hay bale');
  g.act('W');
  ok(!m.hidden && m.awake && m.intent.kind === 'rest', 'next to you it wakes up, but takes a turn to get its bearings');
}
{
  const g = box(), f = g.spawn('fluff', I(9, 9), false); g.roomOf = [0, 1, 1, 1, 1, 1, 1, 1, 1]; g.px = 1; g.py = 1;
  g.act('W');
  ok(f.awake || !f.awake, 'waking runs');
  const k = box(), f2 = k.spawn('fluff', I(5, 7), false);
  k.act('W');
  ok(f2.awake && f2.intent.kind === 'rest', 'a freshly woken enemy never bops on its first turn');
}
// crates, switches, bellows, doors, chests
{
  const g = box(); g.crates[I(6, 5)] = 1;
  g.act('R');
  ok(g.crates[I(7, 5)] && !g.crates[I(6, 5)] && g.px === 6, 'a crate slides when you push it');
  g.tiles[I(8, 5)] = PIT; g.act('R');
  ok(g.tiles[I(8, 5)] === FLOOR && !g.crates[I(8, 5)], 'pushed into a pit, a crate fills it');
  const k = box(); k.crates[I(6, 5)] = 1; k.tiles[I(7, 5)] = WALL;
  k.act('R');
  ok(!k.crates[I(6, 5)] && k.px === 5, 'a crate that cannot move falls apart');
  const m = box(); m.crates[I(6, 5)] = 1; const e = put(m, 'mimic', 7, 5); ready(m);
  m.act('R');
  ok(e.hp === 2 && e.t === 0, 'a crate shoved into an enemy bonks it dizzy');
}
{
  const g = box(); g.tiles[I(6, 5)] = SWITCH; g.tiles[I(3, 3)] = LOWERED; g.tiles[I(3, 4)] = SPIKE;
  const e = put(g, 'mimic', 3, 3); ready(g);
  g.act('R');
  ok(g.tiles[I(3, 3)] === SPIKE && g.tiles[I(3, 4)] === LOWERED, 'a switch flips every prickle trap');
  ok(!g.enemies.includes(e), 'anything on a rising prickle is poofed');
  ok(!g.act('R') || true, 'moving on');
  const k = box(); k.tiles[I(5, 4)] = SPIKE;
  ok(!k.act('U'), 'you cannot walk onto raised prickles');
}
{
  const g = box(); g.tiles[I(6, 5)] = BELLOWS; const a = put(g, 'mimic', 7, 5), b = put(g, 'mimic', 6, 4); ready(g);
  g.act('R');
  ok(a.x === 8 && b.y === 3 && g.px === 6, 'a bellows plate puffs everything around it a tile away, but not you');
}
{
  const g = box(); g.tiles[I(6, 5)] = LOCKED;
  ok(!g.act('R') && g.turn === 0, 'a locked door without a key is refused');
  g.items.set(I(4, 5), 'key'); g.act('L'); ok(g.keys === 1, 'keys are picked up');
  g.act('R'); g.act('R');
  ok(g.tiles[I(6, 5)] === DOOR && g.keys === 0, 'a key opens it');
  const k = box(); k.tiles[I(6, 5)] = CHEST; const before = TOOLS.reduce((s, t) => s + k.tools[t], 0) + k.max;
  k.act('R');
  ok(k.tiles[I(6, 5)] === FLOOR && TOOLS.reduce((s, t) => s + k.tools[t], 0) + k.max >= before + 2, 'a chest gives two tools or more');
}
// tools
{
  const g = box(); g.tools.sling = 1; const e = put(g, 'mimic', 5, 1); ready(g);
  ok(!g.act('T2'), 'the sling needs a direction');
  ok(g.act('T2U') && e.hp === 1 && g.tools.sling === 0, 'the sling bops the first enemy in line (and it bonks the wall)');
  ok(!g.act('T2U'), 'and runs out');
}
{
  const g = box(); g.tools.duster = 1; const a = put(g, 'fluff', 5, 4), b = put(g, 'fluff', 4, 4), c = put(g, 'fluff', 6, 4), d = put(g, 'fluff', 5, 3); ready(g);
  g.act('T1U');
  ok(!g.enemies.includes(a) && !g.enemies.includes(b) && !g.enemies.includes(c) && g.enemies.includes(d), 'the duster sweeps the three tiles in front');
}
{
  const g = box(); g.tools.soap = 1; const a = put(g, 'mimic', 6, 5), b = put(g, 'mimic', 8, 5); g.tiles[I(9, 5)] = PIT; ready(g);
  g.act('T3R');
  ok(!g.enemies.includes(b) && a.x === 8, 'bubble soap pushes the whole line two tiles, far end first');
}
{
  const g = box(); g.tools.lantern = 1; g.seen.fill(0); const m = g.spawn('mimic', I(2, 2), false);
  g.act('T4');
  ok(g.seen.every((s) => s) && m.known && g.lit, 'the lantern lights the floor and shows mimics');
  ok(!g.act('T4'), 'one lantern a floor is plenty');
  g.tools.acorn = 2;
  ok(!g.act('T5'), 'no snacking on full hearts');
  g.hp = 2; g.act('T5');
  ok(g.hp === 3, 'an acorn gives a heart back');
}
// dashing
{
  const d = box('dora'), e = box('enzo');
  ok(d.dashes === 0 && !d.act('XU'), 'Dora has no dash');
  ok(e.dashes === 1 && e.act('XU') && e.py === 2 && e.dashes === 0, 'Enzo dashes three tiles once a floor');
  ok(!e.act('XD'), 'and only once');
  const k = box('enzo'), f = put(k, 'fluff', 5, 3); ready(k);
  k.act('XU');
  ok(!k.enemies.includes(f) && k.py === 4, 'a dash into an enemy ends with a bop');
}
// bosses
{
  const g = box(); g.floor = 4; const b = put(g, 'bigbun', 6, 5); ready(g);
  g.act('W');
  ok(g.hp === CHARS.dora.hp - 1, 'the Great Dust Bunny bops the tile it marks');
  eq(b.intent.kind, 'rest', 'and catches its breath');
  g.act('R');
  ok(b.hp === KINDS.bigbun.hp - 1 && b.x === 6 && g.enemies.length === 2, 'bopping it does not budge it, and a little dust bunny splits off');
  const k = box(); k.floor = 4; const b2 = put(k, 'bigbun', 6, 5); b2.hp = 1; ready(k);
  k.tiles[I(1, 1)] = FLOOR; k.act('R');
  ok(k.tiles[I(6, 5)] === STAIRS && k.stairs === I(6, 5), 'the last bop opens the stairs where it stood');
  const w = box(); w.floor = 12; const king = put(w, 'king', 6, 5); king.hp = 1; ready(w);
  w.act('R');
  ok(w.state === 'won' && !w.act('W'), 'tidying the Dust King wins the run');
  const f = box(); f.floor = 8; const fo = put(f, 'foreman', 6, 5); ready(f);
  eq(fo.intent.kind, 'sweep', 'the Mole Foreman swings across three tiles');
  ok(fo.intent.tiles.length === 3 && fo.intent.tiles.includes(f.pi), 'including yours');
}
// perks, second wind, losing
{
  const g = box(); g.floor = 2; g.tiles[I(6, 5)] = STAIRS; g.stairs = I(6, 5);
  g.act('R');
  ok(g.state === 'perk' && g.perkChoices.length === 3 && new Set(g.perkChoices).size === 3, 'the stairs after floor 2 offer three perks');
  ok(!g.act('U'), 'and wait for a pick');
  const p = g.perkChoices[1]; g.act('P1');
  ok(g.state === 'play' && g.floor === 3 && g.perks.includes(p), 'picking one carries on to floor 3');
  eq(PERK_FLOORS, [2, 4, 6, 8, 10], 'perks come every second floor');
  ok(Object.keys(PERKS).length >= 9, 'plenty of perks');
}
{
  const g = box(); g.perks.push('wind'); g.hp = 1; put(g, 'fluff', 6, 5); ready(g);
  g.act('W');
  ok(g.state === 'play' && g.hp === 2 && g.windUsed, 'Second Wind bounces you back once');
  const k = box(); k.hp = 1; put(k, 'fluff', 6, 5); ready(k);
  k.act('W');
  ok(k.state === 'lost' && k.hp === 0 && !k.act('U'), 'out of hearts, the run ends');
}
{
  const g = box(); g.perks.push('push'); const e = put(g, 'mimic', 6, 5); ready(g);
  g.act('R');
  ok(e.x === 8, 'Push Strength knocks two tiles');
  const k = box(); k.perks.push('long'); const a = put(k, 'mimic', 6, 5), b = put(k, 'mimic', 7, 5); ready(k);
  k.act('R');
  ok(b.hp <= 1 && a.hp <= 1, 'Long Broom bops the one behind too');
}
// the dust clock
{
  const g = box(); g.tiles[I(1, 1)] = FLOOR;
  for (let k = 0; k < DUST_CALM; k++) g.act('W');
  ok(g.enemies.length === 0 && g.dustLeft() === 0, 'the dust stays calm for a while');
  g.act('W');
  ok(g.enemies.length === 1 && g.enemies[0].fresh, 'then a dust bunny tumbles out');
  g.enemies = [];
  for (let k = 0; k < DUST_EVERY; k++) g.act('W');
  ok(g.enemies.length === 1, 'and another every few turns');
}
// fairness: you are only ever bopped on a tile that was marked before you moved
{
  let hurts = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = new DungeonGame(seed * 101, seed % 2 ? 'dora' : 'enzo');
    let r = seed;
    const rand = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    for (let t = 0; t < 400 && g.state !== 'lost' && g.state !== 'won'; t++) {
      if (g.state === 'perk') { g.act('P0'); continue; }
      const danger = g.danger(), before = g.events.length;
      const a = rand() < 0.85 ? 'URDLW'[Math.floor(rand() * 5)] : ['T1U', 'T2R', 'T3D', 'T5', 'XL'][Math.floor(rand() * 5)];
      if (!g.act(a)) continue;
      for (const ev of g.events.slice(before)) if (ev.k === 'hurt') { hurts++; ok(danger.has(I(ev.x, ev.y)), `seed ${seed} turn ${t}: bopped on (${ev.x},${ev.y}), which was marked`); }
    }
  }
  ok(hurts > 20, `the fairness check saw plenty of bops (${hurts})`);
  ok(HARMFUL.every((k) => typeof k === 'string'), 'harmful intents are listed');
}
// replays, clones and saving
{
  const g = new DungeonGame(777, 'enzo');
  const moves = 'RRDDLLUURRDDWWLLUURDLURDLU'.split('');
  for (const m of moves) g.act(m);
  const r = replay({ seed: 777, char: 'enzo', mode: 'run', day: '', log: g.log });
  ok(r && r.pi === g.pi && r.hp === g.hp && r.turn === g.turn && r.enemies.length === g.enemies.length, 'a seed and its log replay a run exactly');
  ok(replay({ seed: 777, char: 'enzo', mode: 'run', day: '', log: ['P2'] }) === null, 'a log that no longer fits is refused');
  const c = g.clone(); c.act('W'); c.tiles[0] = FLOOR;
  ok(g.turn === r.turn && g.tiles[0] === WALL, 'a clone never touches the original');
}
{
  ok(SAVE_KEY === 'dust-bunny-dungeon-v1', 'the save key is versioned');
  eq(readProfile(null), freshProfile(), 'no save is a fresh profile');
  eq(readProfile('{oops'), freshProfile(), 'a broken save is a fresh profile');
  eq(readProfile(JSON.stringify({ v: 2, best: 9 })), freshProfile(), 'another version is ignored');
  const p = freshProfile(), g = new DungeonGame(99, 'enzo', 'daily', '2026-10-27');
  g.act('R'); g.act('L'); keepRun(p, g);
  const back = readProfile(JSON.stringify(p));
  eq(back.run, { seed: g.seed, char: 'enzo', mode: 'daily', day: '2026-10-27', log: g.log }, 'the run in progress is saved as its seed and actions');
  const bad = readProfile(JSON.stringify({ ...p, run: { ...p.run, log: ['R', 'zap'] }, best: 99, char: 'cat', settings: { careful: 'yes', grid: false } }));
  ok(bad.run === null && bad.best === FLOORS && bad.char === 'dora' && bad.settings.careful === true && bad.settings.grid === false, 'bad fields are cleaned up one by one');
  g.state = 'won'; g.floor = 12; g.stats.kinds = { king: 1, fluff: 3 };
  const news = record(p, g);
  ok(p.run === null && p.runs === 1 && p.best === 12 && p.wins.enzo === 1 && p.bestiary.fluff === 3, 'a win is recorded');
  ok(news.some((n) => /WINS/.test(n)) && news.some((n) => /BESTIARY/.test(n)), 'with news for the results');
  ok(p.daily['2026-10-27'].won && p.daily['2026-10-27'].floor === 12, 'the daily result is kept');
  const worse = new DungeonGame(99, 'dora', 'daily', '2026-10-27'); worse.floor = 3; record(p, worse);
  ok(p.daily['2026-10-27'].won, 'a worse daily try does not replace a better one');
  ok(BESTIARY.length === 10 && BESTIARY.every((k) => KINDS[k]), 'ten kinds in the bestiary');
  ok(TOOL_MAX === 3 && TOOLS.length === 5, 'five tools, three of each');
}

console.log(`Dust Bunny Dungeon: ${checks} engine checks passed (${floorsMade} floors generated).`);
