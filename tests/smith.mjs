// Pixel Smith engine checks: painting the weapon (pixels must join the handle, corners count, repainting and rubbing
// out refund the paint, anything left hanging comes off), sketches and the last weapon drawn again, patching fur, the
// weapon's geometry (the easel picture turned to point where Dora aims, reach, weight), swings hitting with exactly the
// painted cells (the tip hardest, each colour doing its thing), Grumbles bursting into loose pixels that fill the pots,
// ice blocked by the weapon at the cost of a pixel, the Smudge's rub, bumps, rolls and smouldering fur, the rooms and
// waves, the sketchbook, winning, losing, and the save.
import assert from 'node:assert/strict';
import { Run, GRID, GRIP, CELL, FUR, ROOMS, PERK_AFTER, FROZEN, local, tip, attached, weaponStats, cellsCode, codeCells, redraw, newSave, parseSave, serialise, bank } from '../.checks/smith-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const at = (x, y) => y * GRID + x;
const still = { mx: 0, my: 0, ax: 0, ay: 0, swing: false, roll: false };
/** a run in a fight with nobody in it, for testing one rule at a time */
const arena = (draw = () => {}, seed = 5) => {
  const r = new Run(seed); r.paint = { grey: 50, gold: 50, blue: 50, red: 50, green: 50 }; draw(r); r.fight();
  r.foes = []; r.waves = [[], []]; r.wave = 2;
  return r;
};
const foe = (r, k, x, y, more = {}) => { const f = { id: r.nextId++, k, x, y, vx: 0, vy: 0, hp: 50, max: 50, r: 7, t: 9, mode: 'walk', dx: 0, dy: 0, chill: 0, burn: 0, hitBy: -1, flash: 0, ...more }; r.foes.push(f); return f; };
/** paints a straight line from the handle up and to the right, n cells long, in one colour */
const line = (r, c, len = 11) => { for (let k = 1; k <= len; k++) if (r.cells[at(k, GRID - 1 - k)] !== c) assert.ok(r.paintCell(at(k, GRID - 1 - k), c)); };

// ---- painting
{
  const r = new Run(1);
  assert.equal(r.phase, 'easel'); assert.deepEqual(r.paint, { grey: 12, gold: 6, blue: 0, red: 0, green: 0 });
  assert.ok(!r.paintCell(at(5, 5), 'gold'), 'a pixel floating on its own can’t go down');
  assert.ok(r.paintCell(at(1, 10), 'gold'), 'a corner touching the handle is enough');
  assert.ok(r.paintCell(at(2, 9), 'gold'));
  assert.ok(!r.paintCell(GRIP, 'gold'), 'the handle stays wood');
  assert.ok(!r.paintCell(at(0, 0), 'blue'), 'no blue paint yet');
  assert.equal(r.paint.gold, 4);
  assert.ok(r.paintCell(at(1, 10), 'grey')); assert.equal(r.paint.gold, 5, 'repainting puts the old colour back'); assert.equal(r.paint.grey, 11);
  assert.ok(r.paintCell(at(3, 8), 'gold')); assert.ok(r.paintCell(at(4, 7), 'gold'));
  // rubbing out the pixel next to the handle drops everything past it, all back in the pots
  assert.ok(r.eraseCell(at(1, 10)));
  assert.equal(r.cells.filter(Boolean).length, 0); assert.deepEqual(r.paint, { grey: 12, gold: 6, blue: 0, red: 0, green: 0 });
  assert.equal(attached(r.cells).size, 1);
  ok('painting: pixels must join the handle (corners count), repainting and rubbing out refund, hanging pixels fall off');
}

// ---- sketches, drawing it again, patching fur
{
  const r = new Run(1); r.paint = { grey: 40, gold: 40, blue: 0, red: 0, green: 0 };
  for (const shape of ['sword', 'dagger', 'hammer', 'fan']) {
    const k = r.sketch(shape, ['gold']); assert.ok(k > 4, shape);
    assert.equal(attached(r.cells).size - 1, r.cells.filter(Boolean).length, `${shape}: every pixel is joined to the handle`);
  }
  r.clearWeapon(); assert.deepEqual(r.paint, { grey: 40, gold: 40, blue: 0, red: 0, green: 0 });
  // a sketch with too little paint stops where the paint runs out, nearest the handle first
  r.paint = { grey: 0, gold: 5, blue: 0, red: 0, green: 0 }; assert.equal(r.sketch('sword', ['gold']), 5);
  assert.ok(r.cells.every((c, i) => !c || local(i).a < 5));
  r.paint = { grey: 30, gold: 30, blue: 30, red: 30, green: 30 }; r.sketch('sword', ['blue', 'gold']);
  const code = cellsCode(r.cells); assert.deepEqual(codeCells(code), r.cells);
  r.clearWeapon(); redraw(r, code); assert.equal(cellsCode(r.cells), code, 'the last weapon is drawn again exactly');
  assert.equal(codeCells('nonsense'), null);
  // patching fur
  r.dora.fur = 20; assert.ok(r.patch('grey')); assert.equal(r.dora.fur, 22); assert.equal(r.paint.grey, 29);
  r.dora.fur = FUR; assert.ok(!r.patch('grey'), 'no patching a full coat');
  r.perks.patch = 1; r.dora.fur = 10; r.patch('red'); assert.equal(r.dora.fur, 14);
  ok('sketches, drawing the last weapon again, and patching fur with paint');
}

// ---- geometry and weight
{
  assert.ok(Math.abs(local(GRIP).a - Math.SQRT1_2) < 1e-9 && Math.abs(local(GRIP).b) < 1e-9, 'the handle sits at the paw');
  const corner = local(at(GRID - 1, 0)); assert.ok(Math.abs(corner.b) < 1e-9 && corner.a > 16, 'the top right corner is straight out along the aim');
  // the easel picture is turned, not mirrored: right of the diagonal on the easel is clockwise of the aim on screen
  assert.ok(local(at(GRID - 1, GRID - 1)).b > 0 && local(at(0, 0)).b < 0);
  assert.ok(tip(at(GRID - 1, 0)) > 2 * tip(at(1, GRID - 2)) * 0.9, 'the tip hits about twice as hard as the paw');
  const r = new Run(1); r.paint = { grey: 200, gold: 0, blue: 0, red: 0, green: 0 };
  const bare = weaponStats(r.cells); line(r, 'grey', 4); const short = weaponStats(r.cells); line(r, 'grey', 11); const long = weaponStats(r.cells);
  assert.ok(bare.reach < short.reach && short.reach < long.reach);
  for (let more = true; more;) { more = false; for (let i = 0; i < GRID * GRID; i++) if (!r.cells[i] && r.paintCell(i, 'grey')) more = true; }
  const huge = weaponStats(r.cells);
  assert.equal(huge.pixels, GRID * GRID - 1);
  assert.ok(huge.swing > 2 * long.swing && huge.speed < long.speed * 0.7, 'a huge weapon swings slowly and slows Dora down');
  r.perks.light = 1; assert.ok(weaponStats(r.cells, r.perks).swing < huge.swing, 'the Feather handle lightens it');
  ok('the weapon: turned to point along the aim, the tip hits hardest, reach, and weight');
}

// ---- swings
{
  const swingAt = (r, f) => { r.aim = Math.atan2(f.y - f.r * 0.6 - (r.dora.y - 6), f.x - r.dora.x); for (let k = 0; k < 60 && f.hitBy < 0; k++) r.tick({ ...still, ax: f.x, ay: f.y - f.r * 0.6, swing: k === 0 }); };
  const hitWith = (c, len = 11, dist = 24) => {
    const r = arena((q) => line(q, c, len));
    const f = foe(r, 'pebble', r.dora.x + dist, r.dora.y); swingAt(r, f); return { r, f };
  };
  const gold = hitWith('gold'), grey = hitWith('grey'), blue = hitWith('blue'), red = hitWith('red'), green = hitWith('green');
  for (const h of [gold, grey, blue, red, green]) assert.ok(h.f.hitBy > 0 && h.f.hp < 50, 'the painted cells hit');
  assert.ok(50 - gold.f.hp > 50 - grey.f.hp && 50 - grey.f.hp > 50 - blue.f.hp, 'gold cuts deepest, then stone');
  assert.ok(Math.hypot(grey.f.vx, grey.f.vy) > 20 || grey.f.x > gold.f.x + 3, 'stone shoves');
  assert.ok(blue.f.chill > 0 && red.f.burn > 0, 'blue chills, red burns');
  // a far-away Grumble is only reached by a long weapon
  const miss = hitWith('gold', 3, 30); assert.equal(miss.f.hitBy, -1, 'a stub can’t reach');
  // the same gold line hits harder with its tip than with its middle
  const mid = hitWith('gold', 11, 14), end = hitWith('gold', 11, 30);
  assert.ok(50 - end.f.hp > 50 - mid.f.hp, 'the tip hits harder');
  // green grows fur back
  const g = arena((q) => line(q, 'green')); g.dora.fur = 10; const gf = foe(g, 'pebble', g.dora.x + 24, g.dora.y); swingAt(g, gf); g.tick(still);
  assert.ok(g.dora.fur > 10, 'green heals');
  // frozen solid: no moving and no biting
  const b = arena(); const bf = foe(b, 'pebble', 100, 100, { chill: FROZEN + 1 }); const x0 = bf.x; b.dora.x = 100; b.dora.y = 100; b.dora.inv = 0;
  b.tick(still); assert.equal(bf.x, x0); assert.equal(b.dora.fur, FUR, 'a frozen Grumble can’t bite');
  ok('swings: only painted cells hit, gold cuts, stone shoves, blue chills and freezes, red burns, green heals, reach matters');
}

// ---- loose pixels, ice, the Smudge, bumps
{
  const r = arena((q) => line(q, 'gold', 4));
  const f = foe(r, 'frost', 300, 100, { hp: 0.01 }); r.foes = [f]; f.burn = 1; r.tick(still);
  assert.equal(r.foes.length, 0); assert.equal(r.loose.length, 3); assert.ok(r.loose.every((p) => p.c === 'blue'), 'a Frost Grumble bursts into blue');
  const before = r.paint.blue; for (let k = 0; k < 400 && r.loose.length; k++) r.tick(still);
  assert.equal(r.paint.blue, before + 3, 'the pixels fly to Dora once the room is clear');
  // ice: blocked by the weapon at the cost of the pixel it hits (and anything hanging off it)
  const s = arena((q) => line(q, 'gold', 6)); foe(s, 'pebble', 40, 200, { mode: 'spawn', t: 99 });
  s.aim = 0; const tipCell = s.cellsNow().cells.find((c) => c.i === at(6, 5));
  s.shots.push({ x: tipCell.x + 6, y: tipCell.y, vx: -70, vy: 0, k: 'ice', t: 0 });
  const had = s.cells.filter(Boolean).length; for (let k = 0; k < 20; k++) s.tick({ ...still, ax: s.dora.x + 50, ay: s.dora.y - 6 });
  assert.equal(s.shots.length, 0); assert.ok(s.cells.filter(Boolean).length < had, 'the ice knocks a pixel off'); assert.equal(s.dora.fur, FUR, 'and Dora is fine');
  assert.ok(s.loose.some((p) => p.c === 'gold'), 'the pixel lands on the floor to be picked up');
  // the Smudge rubs pixels off
  const m = arena((q) => line(q, 'gold')); const sm = foe(m, 'smudge', m.dora.x + 30, m.dora.y - 10, { r: 19, hp: 200, max: 200, mode: 'wind', t: 0.01 });
  sm.dx = -1; sm.dy = 0; m.aim = 0; const n0 = m.cells.filter(Boolean).length;
  m.dora.inv = 9; m.tick({ ...still, ax: m.dora.x + 50, ay: m.dora.y - 6 }); m.tick(still);
  assert.ok(m.cells.filter(Boolean).length < n0, 'the rub wipes pixels off');
  // bumps, rolls and smouldering fur
  const h = arena(); h.dora.inv = 0; foe(h, 'ember', h.dora.x, h.dora.y); h.tick(still);
  assert.equal(h.dora.fur, FUR - 3); assert.ok(h.dora.smoulder > 0); assert.ok(h.dora.inv > 0);
  h.foes = []; foe(h, 'pebble', 40, 200, { mode: 'spawn', t: 99 }); for (let k = 0; k < 150; k++) h.tick(still);
  assert.ok(h.dora.fur <= FUR - 5, 'smouldering fur keeps going');
  const o = arena(); o.dora.inv = 0; o.tick({ ...still, roll: true, mx: 1 }); foe(o, 'pebble', o.dora.x, o.dora.y); o.tick(still);
  assert.equal(o.dora.fur, FUR, 'rolling goes straight through');
  ok('Grumbles burst into pixels, ice is blocked by the weapon at a cost, the Smudge rubs, bumps, rolls and smouldering');
}

// ---- rooms, the sketchbook, winning and losing
{
  const r = new Run(9); r.sketch('sword', ['gold', 'grey']);
  for (let room = 0; room < ROOMS; room++) {
    assert.equal(r.phase, 'easel'); assert.equal(r.room, room); assert.ok(r.fight());
    assert.ok(r.waves.length >= 2);
    if (room === 3) assert.ok(r.waves[0].includes('frost'), 'the first cellar room has a Frost Grumble');
    if (room === 6) assert.ok(r.waves[0].includes('moss'), 'the first forge room has a Moss Grumble');
    if (room === ROOMS - 1) assert.deepEqual(r.waves[0], ['smudge']);
    // clear it the quick way
    for (let k = 0; k < 2000 && r.phase === 'fight'; k++) { for (const f of r.foes) if (f.mode !== 'spawn') f.hp = 0.001, f.burn = 1; r.dora.fur = FUR; r.tick(still); }
    if (PERK_AFTER.includes(room)) { assert.equal(r.phase, 'pick'); assert.equal(r.offer.length, 3); const id = r.offer[1]; assert.ok(r.pick(id)); assert.equal(r.perks[id], 1); }
  }
  assert.equal(r.phase, 'won'); assert.equal(r.stats.rooms, ROOMS);
  const a = new Run(77), b = new Run(77); a.fight(); b.fight();
  assert.deepEqual(a.waves, b.waves, 'the same seed, the same rooms');
  const l = arena(); l.dora.fur = 1; l.dora.inv = 0; foe(l, 'pebble', l.dora.x, l.dora.y); l.tick(still);
  assert.equal(l.phase, 'lost');
  ok('ten rooms over three places, the sketchbook after each place, winning, losing, and the same seed giving the same rooms');
}

// ---- the save
{
  const s = newSave();
  assert.deepEqual(parseSave(serialise(s)), s);
  assert.deepEqual(parseSave('{"v":2}'), newSave()); assert.deepEqual(parseSave('not json'), newSave());
  const odd = parseSave(JSON.stringify({ v: 1, intro: true, best: { rooms: -3, kills: 'x', biggest: 40 }, last: 'zz', seen: ['pebble', 'dragon'], settings: { music: false } }));
  assert.equal(odd.best.rooms, 0); assert.equal(odd.best.biggest, 40); assert.equal(odd.last, ''); assert.deepEqual(odd.seen, ['pebble']); assert.equal(odd.settings.music, false); assert.equal(odd.settings.sound, true);
  const r = new Run(3); r.stats.rooms = 4; r.stats.kills = 20; r.stats.biggest = 33; r.phase = 'lost';
  bank(s, r); assert.deepEqual(s.best, { rooms: 4, kills: 20, biggest: 33 }); assert.equal(s.stats.runs, 1);
  r.phase = 'won'; r.stats.rooms = ROOMS; bank(s, r); assert.equal(s.stats.wins, 1); assert.equal(s.best.rooms, ROOMS);
  ok('the save: round trip, corrupt and wrong-version saves ignored, odd values cleaned, runs banked');
}
void CELL;
console.log(`\n${n} Pixel Smith checks passed`);
