// Snowball Siege engine checks: scooping a wall cube (and the floor snow) for a snowball, patching one back in, the
// throw's flight (the preview and the real flight agree, and a seed replays), hits on cubes (a hard snowball's cross of
// five), cubes left hanging falling, the flag falling when its tower's top goes, stuns (only standing characters can
// be hit), the pond's ice, the ridge's wind, the pines' snow, time-up scoring, every slope loading and being won by the
// pro bot, the save, and the shared voxel mesher. Run after `npm test` has compiled the engines into .checks/ (or
// `npm run test:snowball`).
import assert from 'node:assert/strict';
import { Match, SLOPES, W, D, H, TICK, POOL, DIG_TICKS, FLOOR_TICKS, PATCH_TICKS, STUN_TICKS, MATCH_TICKS, SAVE_KEY, newSave, parseSave, serialise, record, unlocked, starCount, solve } from '../.checks/snowball-game.js';
import { parseModel, meshModel, meshVoxels } from '../.checks/voxel-model.js';

let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
const run = (m, n) => { for (let i = 0; i < n && !m.over; i++) m.step(); };
/** a match where nobody acts on its own: both sides human, nobody pressing anything */
const still = (id = 'sunny', seed = 5) => new Match(id, seed, { humans: [true, true] });

// ---- scooping
{
  const m = still(), c = m.activeChar(0), f = m.frontCube(0);
  assert.ok(f, 'there is a wall cube in reach');
  const before = m.count(0), ammo = m.ammo[0];
  assert.ok(m.dig(0, f.x, f.y, f.z));
  run(m, DIG_TICKS - 1); assert.equal(m.ammo[0], ammo, 'not until the scoop is done');
  run(m, 1);
  assert.equal(m.ammo[0], ammo + 1); assert.equal(m.count(0), before - 1);
  assert.equal(m.stats.dug[0], 1);
  // never their snow, never out of reach, never the flag's own cubes
  assert.equal(m.canDig(c, W - 14, 0, 3), false);
  assert.equal(m.canDig(c, 3, 0, 1), false);
  const fl = m.forts[0].flag; assert.equal(m.canDig({ ...c, x: fl.x + 0.5, z: fl.z + 0.5 }, fl.x, fl.top - 1, fl.z), false);
  // a full pool can't scoop
  m.ammo[0] = POOL; const g = m.frontCube(0); assert.equal(m.dig(0, g.x, g.y, g.z), false);
  // floor snow: slow, and costs no wall
  const n = still(); n.ammo[0] = 0; const walls = n.count(0);
  assert.ok(n.scoopFloor(0)); run(n, FLOOR_TICKS); assert.equal(n.ammo[0], 1); assert.equal(n.count(0), walls);
  assert.ok(FLOOR_TICKS > DIG_TICKS * 3, 'the floor is much slower than the wall');
  ok('scooping: a wall cube becomes a snowball, fast; the floor snow is slow and free; not theirs, not the flag');
}

// ---- patching
{
  const m = still(), f = m.frontCube(0);
  m.dig(0, f.x, f.y, f.z); run(m, DIG_TICKS);
  assert.equal(m.at(f.x, f.y, f.z), 0);
  const ammo = m.ammo[0];
  assert.ok(m.patch(0, f.x, f.y, f.z)); assert.equal(m.ammo[0], ammo - 1);
  run(m, PATCH_TICKS); assert.equal(m.at(f.x, f.y, f.z), 1); assert.equal(m.stats.patched[0], 1);
  // not in the air, not on their side, not with no snowballs
  const c = m.activeChar(0);
  assert.equal(m.canPatch(c, f.x, 5, f.z), false);
  assert.equal(m.canPatch(c, W - 12, 0, 3), false);
  m.dig(0, f.x, f.y, f.z); run(m, DIG_TICKS); m.ammo[0] = 0; assert.equal(m.patch(0, f.x, f.y, f.z), false);
  ok('patching: a snowball goes back into the wall as a cube');
}

// ---- the throw: the preview is the flight, and a seed replays
{
  const m = still(), c = m.activeChar(0), f = m.forts[1].flag;
  c.z = f.z + 0.5;   // throws fly straight across the valley, so the thrower walks into line with the tower first
  const s = solve(m, 0, m.hand(c), { x: f.x + 0.5, y: f.top - 0.5, z: f.z + 0.5 }, false, 0);
  assert.ok(s, 'the solver finds a throw onto their tower');
  const p = m.path(0, s.vx, s.vy, 400);
  assert.ok(p.end && p.end.cube, 'the preview ends on a cube');
  assert.ok(m.throw(0, s.vx, s.vy)); assert.equal(m.ammo[0], 1);
  let hit = null; for (let i = 0; i < 400 && !hit; i++) { m.step(); hit = m.events.find((e) => e.k === 'hit'); }
  assert.ok(hit); assert.deepEqual([hit.x, hit.y, hit.z], [p.end.x, p.end.y, p.end.z]);
  // a thrower who isn't ready, or has nothing, can't throw; a feeble flick doesn't count
  const n = still(); n.ammo[0] = 0; assert.equal(n.throw(0, 10, 10), false);
  const q = still(); assert.equal(q.throw(0, 1, 1), false); assert.equal(q.ammo[0], 2);
  // a whole match replays from its seed
  const play = (seed) => { const a = new Match('ridge', seed, { humans: [false, false], bot: 'pro' }); run(a, MATCH_TICKS); return [a.t, a.winner, a.count(0), a.count(1), a.stats.thrown.join()]; };
  assert.deepEqual(play(42), play(42));
  assert.notDeepEqual(play(42), play(43));
  ok('throwing: the preview path is the real flight, and a seed replays a whole match');
}

// ---- hits on cubes: one cube (and sometimes a neighbour), or a hard snowball's cross of five
{
  const m = still();
  // a cube in the middle of their front wall, from in front
  const x = W - 14, y = 1, z = 5;
  assert.equal(m.at(x, y, z), 2);
  const b = { side: 0, x: x - 0.3, y: y + 0.5, z: z + 0.5, vx: 20, vy: 0, hard: true, age: 0 };
  m.balls.push(b);
  const around = [[x, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
  const solid = around.filter(([a, c, d]) => m.at(a, c, d) === 2).length;
  m.step();
  assert.ok(around.every(([a, c, d]) => m.at(a, c, d) === 0), 'the cross is gone');
  assert.ok(m.stats.knocked[0] >= solid);
  const n = still(), before = n.count(1);
  n.balls.push({ side: 0, x: x - 0.3, y: y + 0.5, z: z + 0.5, vx: 20, vy: 0, hard: false, age: 0 });
  n.step();
  assert.equal(n.at(x, y, z), 0); assert.ok(before - n.count(1) >= 1 && before - n.count(1) <= 5);
  // a hard snowball costs two
  const h = still(); h.ammo[0] = 3; assert.ok(h.throw(0, 25, 12, true)); assert.equal(h.ammo[0], 1);
  const g = still(); g.ammo[0] = 1; assert.ok(g.throw(0, 25, 12, true)); assert.equal(g.balls[0].hard, false, 'one snowball makes a normal throw');
  ok('hits: a snowball takes out the cube it hits; a hard one takes a cross of five and costs two');
}

// ---- cubes left hanging fall
{
  const m = still();
  // a cube on top of a crenellation's single-cube column: take the cube under it and it falls
  const x = W - 14; let z = 1; while (!(m.at(x, 2, z) === 2)) z++;
  m.set(x, 1, z, 0); m.set(x - 1, 2, z, 0); m.set(x + 1, 2, z, 0);
  m.support();
  assert.equal(m.at(x, 2, z), 0, 'the crenellation fell');
  assert.ok(m.events.some((e) => e.k === 'cube' && e.x === x && e.y === 2 && e.z === z));
  ok('support: a cube with nothing joining it to the ground falls as debris');
}

// ---- the flag falls when the top of its tower is gone
{
  const m = still(), f = m.forts[1].flag;
  const layer = (y, keep) => { for (let x = f.x - 1; x <= f.x + 1; x++) for (let z = f.z - 1; z <= f.z + 1; z++) if (!(keep && x === f.x + 1 && z === f.z)) m.set(x, y, z, 0); };
  assert.equal(m.topLeft(1), 27);
  layer(f.top - 1); layer(f.top - 2); m.flagCheck(); assert.equal(m.over, false, 'two layers are not enough');
  layer(f.top - 3, true); m.flagCheck(); assert.equal(m.over, false); assert.equal(m.topLeft(1), 1);
  m.set(f.x + 1, f.top - 3, f.z, 0); m.flagCheck();
  assert.equal(m.over, true); assert.equal(m.winner, 0); assert.equal(m.how, 'flag');
  assert.ok(m.events.some((e) => e.k === 'flag' && e.fell && e.side === 1));
  ok('the flag: it stands while any of the top three layers of its tower is left, and falls with the last');
}

// ---- stuns: standing characters can be hit, ducked ones can't
{
  const m = still(), them = m.activeChar(1);
  const shot = () => m.balls.push({ side: 0, x: them.x - 1, y: 2, z: them.z, vx: 20, vy: 0, hard: false, age: 0 });
  shot(); run(m, 10);
  assert.equal(them.stun, 0, 'ducked behind the wall, nothing happens');
  them.aiming = true; m.ammo[1] = 1; shot(); run(m, 10);
  assert.ok(them.stun > 0 && them.stun <= STUN_TICKS); assert.equal(them.aiming, false);
  assert.equal(m.aim(1, true), false, 'a stunned character cannot throw');
  run(m, STUN_TICKS); assert.equal(them.stun, 0); assert.ok(m.aim(1, true));
  ok('stuns: a standing thrower is hit and sees stars for 1.5 s; a ducked one is safe');
}

// ---- the pond's ice, the ridge's wind, the pines' snow
{
  const m = still('pond'), c = m.activeChar(0), hz = c.z + 2, k = Math.floor(c.x) * D + Math.floor(hz);
  assert.equal(m.ice[Math.floor(c.x) * D + Math.floor(c.z)], 1, 'our thrower stands on the ice');
  for (let i = 0; i < 3; i++) { m.balls.push({ side: 1, x: c.x, y: 0.2, z: hz, vx: 0, vy: -6, hard: false, age: 0 }); run(m, 20); }
  assert.equal(m.ice[k], 4, 'three snowballs crack it into a hole');
  assert.ok(m.events.some((e) => e.k === 'crack') || m.stats.thrown[1] === 0);
  c.z = hz; m.step();
  assert.equal(c.stun > 0 && c.splash, true, 'step on the hole and you fall in');
  assert.notEqual(m.ice[Math.floor(c.x) * D + Math.floor(c.z)], 4, 'climbed out onto solid ice');
  run(m, 12 * TICK + 10); assert.equal(m.ice[k], 1, 'the hole freezes over');

  const r = still('ridge'); run(r, 1); assert.notEqual(r.wind, 0);
  const calm = still('sunny'), h = calm.hand(calm.activeChar(0));
  const a = calm.path(0, 18, 14, 400, h).end, b = r.path(0, 18, 14, 400, h).end;
  assert.ok(Math.sign((b.cube ? b.x + 0.5 : b.x) - (a.cube ? a.x + 0.5 : a.x)) === Math.sign(r.wind), 'the wind drifts the arc its way');

  const p = still('pines'); assert.equal(p.pines.length, 4);
  const pine = p.pines[2], foe = p.chars.find((c) => c.side === 1); foe.x = pine.x + 1; foe.z = pine.z;
  p.balls.push({ side: 0, x: pine.x - 1.5, y: 3, z: pine.z, vx: 20, vy: 0, hard: false, age: 0 }); run(p, 10);
  assert.equal(pine.snow, 0); assert.ok(foe.stun > 0, 'the snow drops on whoever is underneath');
  ok('slopes: the pond cracks and you fall in, the wind drifts the arc, the pines drop their snow');
}

// ---- time-up
{
  const m = still(), f = m.forts[0].flag;
  m.set(f.x, f.top - 1, f.z, 0);
  run(m, MATCH_TICKS); assert.equal(m.over, true); assert.equal(m.how, 'time'); assert.equal(m.winner, 1, 'the tower with more of its top left wins');
  const n = still(); n.stats.knocked = [3, 5]; run(n, MATCH_TICKS); assert.equal(n.winner, 1, 'then whoever knocked more out');
  const d = still(); run(d, MATCH_TICKS); assert.equal(d.winner, -1);
  ok('time-up after two minutes: the tower top, then the cubes knocked out, decide it');
}

// ---- every slope loads and can be won
for (const sl of SLOPES) {
  const m = new Match(sl.id, 9, { humans: [false, false], bot: 'pro' });
  assert.equal(m.chars.length, 4); assert.ok(m.count(0) > 80 && m.count(0) === m.count(1), `${sl.id}: two equal forts`);
  assert.equal(m.chars[2].species, sl.rival.species);
  let won = 0; for (let k = 0; k < 6; k++) { const a = new Match(sl.id, 100 + k, { humans: [false, false], bot: 'pro' }); run(a, MATCH_TICKS); if (a.winner === 0) won++; }
  assert.ok(won >= 2, `${sl.id}: the pro wins (${won}/6)`);
}
{ const v = new Match('versus', 1); assert.equal(v.chars.length, 2); assert.deepEqual(v.humans, [true, true]); assert.equal(v.brains[1], null); }
ok('slopes: all six load with equal forts and their own rivals, and the pro wins every one; Versus is two players');

// ---- the save
{
  assert.equal(SAVE_KEY, 'snowball-siege-v1');
  const s = newSave(); assert.equal(unlocked(s, 1), true); assert.equal(unlocked(s, 2), false);
  const m = still(); m.finish('flag', 0);
  const r = record(s, m); assert.equal(r.won.sunny, true); assert.ok(r.stars.sunny & 1); assert.equal(unlocked(r, 2), true);
  assert.equal(starCount(7), 3);
  const back = parseSave(serialise(r)); assert.deepEqual(back, r);
  assert.deepEqual(parseSave('{bad json'), newSave());
  assert.deepEqual(parseSave(JSON.stringify({ won: { moon: true }, stars: { sunny: 99 } })), newSave());
  const lost = still(); lost.finish('flag', 1); assert.deepEqual(record(s, lost), s);
  ok('the save: slopes won, star bits, settings; bad saves are ignored');
}

// ---- the shared voxel mesher
{
  const one = parseModel({ name: 'cube', size: [1, 1, 1], palette: ['#ff0000'], cubes: [0, 0, 0, 0] });
  const a = meshModel(one, 1); assert.equal(a.indices.length, 36); assert.equal(a.positions.length, 24 * 3);
  // two cubes side by side share a hidden face; the corner beside a neighbour is darker
  const two = meshVoxels([0, 2, 0, 1, 0, 1], (x, y, z) => (x === 0 || x === 1) && y === 0 && z === 0, (x, y, z) => (y === 0 && z === 0 && (x === 0 || x === 1) ? [1, 1, 1] : null));
  assert.equal(two.indices.length, 10 * 6);
  const ao = meshVoxels([0, 1, 0, 1, 0, 1], (x, y, z) => (x === 0 && z === 0 && (y === 0 || y === 1)) || (x === 1 && y === 1 && z === 0), (x, y, z) => (x === 0 && y === 0 && z === 0 ? [1, 1, 1] : null));
  assert.ok(Math.min(...ao.colors) < 1, 'ambient occlusion darkens a tucked-in corner');
  // stride-5 models paint the front from the front view and the sides from the side view
  const fs = parseModel({ name: 'fs', size: [1, 1, 1], palette: ['#ff0000', '#0000ff'], stride: 5, cubes: [0, 0, 0, 0, 1] });
  const fm = meshModel(fs, 1, false); const reds = [], blues = [];
  for (let i = 0; i < fm.normals.length; i += 3) (fm.colors[i] > 0.5 ? reds : blues).push(fm.normals[i + 2]);
  assert.ok(reds.filter((n) => n === 1).length === 4 && blues.every((n) => n !== 1));
  ok('voxel meshes: hidden faces culled, corners shaded, front and side colours');
}

console.log(`\n${pass} Snowball Siege checks passed`);
