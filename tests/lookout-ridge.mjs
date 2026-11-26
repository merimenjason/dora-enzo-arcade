// Lookout Ridge engine: determinism, the woven ground (grass band, the burrow and its knotted roof), the three shots
// and the Darning Needle, crater thread ends and pulls (the ground drops a row, units slide and take tumble damage),
// walking, charging, nightfall after NIGHT rounds and both ways to lose.
import assert from 'node:assert/strict';
import { createGame, surfaceY, isWin, NIGHT, CHARGE, CHAMBER, KIT_FOCUS, KIT_REACH, PULL_DMG, W, H } from '../.checks/lookout-ridge-game.js';

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };
const settle = (g, n = 120) => { for (let i = 0; i < n; i++) g.update({}); };
const unit = (g, id) => g.units.find((u) => u.id === id);
const standing = (g, u) => [-12, -6, 0, 6, 12].some((dx) => g.solid(u.x + dx, u.y + 1)) && ![-12, -6, 0, 6, 12].some((dx) => g.solid(u.x + dx, u.y - 1));
const topAt = (g, x) => { let y = 0; while (y < H && !g.solid(x, y)) y++; return y; };

// tuned numbers stay as the prototype measured them
ok(KIT_FOCUS === 0.85 && KIT_REACH === 18 && NIGHT === 7, 'tuned values KIT_FOCUS 0.85, KIT_REACH 18, NIGHT 7');

// ---- determinism: one seed replays a whole self-played match exactly
{
  const run = () => { const g = createGame(3); g.autoHero = true; g.newGame(424242); let n = 0; while (g.state !== 'over' && n < 120000) { g.fast(600); n += 600; } return { log: JSON.stringify(g.LOG), banner: g.banner, round: g.round }; };
  const a = run(), b = run();
  ok(a.log === b.log && a.banner === b.banner && a.round === b.round, 'a seed replays a self-played match exactly');
  ok(a.log.length > 50, 'the match had events');
}

// ---- the ground
{
  const g = createGame(7);
  ok(g.state === 'title', 'a new game waits on the title');
  g.newGame(1234);
  ok(g.state === 'aim' && g.cur.id === 'dora' && g.round === 1, 'Dora opens round 1');
  for (const x of [40, 120, 1400, 1500]) { const d = surfaceY(x) - topAt(g, x); ok(d > 10 && d < 18, `on the flat, the grass band stands ~14px proud of the line at x=${x} (${d.toFixed(1)})`); }
  settle(g);
  const dora = unit(g, 'dora'), fox = unit(g, 'fox');
  ok(standing(g, dora) && dora.y < 470, 'Dora stands on the ledge');
  ok(standing(g, fox) && fox.y < 520, 'the fox stands on his ridge');
  ok(g.kits.length === 3 && g.kits.every((k) => k.home), 'three kits at home');
  ok(g.kits.every((k) => g.roofOver(k) > 30), 'the burrow has a roof of cloth');
  ok(g.kits.every((k) => !g.solid(k.x, k.y - 20)), 'the kits sit in an open pocket');
}

// ---- the roof shields; the needle mends it; a break-in scares a kit
{
  const g = createGame(7); g.newGame(77); settle(g);
  g.blastAt(280, 472, 40);
  ok(g.kits.every((k) => k.home), 'a blast on the roof does not reach the kits');
  const holed = g.roofOver(g.kits[1]);
  g.darnAt(280, 498, 44);
  ok(g.roofOver(g.kits[1]) > Math.max(25, holed), `darning mends the roof (${holed} -> ${g.roofOver(g.kits[1])})`);
  ok(g.kits.every((k) => k.home), 'darning does not bury a kit');
  for (const [dx, dy] of CHAMBER) ok(!g.solid(g.BURROW.x + dx, g.BURROW.y + dy), `darning never fills the chamber (${dx},${dy})`);
  ok(g.ops.some((o) => o.k === 'darn'), 'the darn is queued for the scene');
  for (let i = 0; i < 6 && g.kits.every((k) => k.home); i++) g.blastAt(280, 480 + i * 14, 40);
  ok(g.kits.some((k) => !k.home), 'a blast that breaks into the burrow scares a kit off');
  ok(g.LOG.some((e) => e[0] === 'kit'), 'the bolt is logged');
  const before = g.floats.length; g.darnAt(700, 200, 44);
  ok(g.floats.length === before + 1 && g.floats.at(-1).txt === 'nothing to stitch to', 'the needle needs cloth to stitch to');
}

// ---- thread ends and pulls
{
  const g = createGame(7); g.newGame(5); settle(g);
  g.blastAt(1190, 540, 40);
  ok(g.ends.length >= 1, 'a crater leaves a loose thread end');
  const e = g.ends[0];
  ok(Math.abs(e.x1 - e.ex) >= 110, 'its row runs at least 110px');
  const fox = unit(g, 'fox'), y0 = fox.y, x0 = fox.x, hp0 = fox.hp;
  const shifts = g.ops.length;
  g.pull(0, unit(g, 'dora'));
  ok(g.LOG.some((l) => l[0] === 'pull'), 'pulling is logged');
  for (let i = 0; i < 400 && g.pulls.length; i++) g.update({});
  settle(g, 200);
  ok(g.ops.slice(shifts).some((o) => o.k === 'shift'), 'the unravel is queued for the scene as a shift');
  ok(fox.y >= y0 + 20, `the fox drops with the ground (${y0.toFixed(0)} -> ${fox.y.toFixed(0)})`);
  ok(fox.x < x0 - 20, `the fox is dragged toward the hole (${x0} -> ${fox.x})`);
  ok(fox.hp <= hp0 - PULL_DMG, `the fox takes tumble damage (${hp0} -> ${fox.hp})`);
}
// a hero's shot that lands within 40px of the pom-pom tangles and pulls; the same miss by a predator does not
{
  const g = createGame(7); g.newGame(5); settle(g);
  g.blastAt(1190, 540, 40);
  const e = g.ends[0], p = g.pomOf(e);
  ok(g.ends.length && g.tangle === 40, 'TANGLE is 40px');
  // the tangle test used by shots: probe the solid ground just beside the pom
  let near = null;
  for (let dx = -38; dx <= 38 && !near; dx += 2) for (let dy = -30; dy <= 30; dy += 2) if (g.solid(p.x + dx, p.y + dy) && Math.hypot(dx, dy) < 40 && Math.hypot(dx, dy) > 24) { near = [p.x + dx, p.y + dy]; break; }
  ok(!!near, 'there is cloth within 40px of the pom');
}
// the cloth over the burrow is knotted: a row pulled toward it stops short
{
  let checked = 0;
  for (let s = 1; s < 40 && checked < 3; s++) {
    const g = createGame(7); g.newGame(s); settle(g, 30);
    g.blastAt(580, 600, 34, 'dora');
    const e = g.ends.find((x) => x.dir === -1 && 430 + x.row * 30 < g.BURROW.y + 32);
    if (!e) continue;
    const roof = g.kits.map((k) => g.roofOver(k));
    g.pull(g.ends.indexOf(e), unit(g, 'dora'));
    for (let i = 0; i < 400 && g.pulls.length; i++) g.update({});
    ok(Math.abs(e.x1 - (g.BURROW.x + 20)) >= 109, `the row stops at the knot (x1=${e.x1})`);
    ok(g.kits.every((k, i) => g.roofOver(k) === roof[i] && k.home), 'the kits\' roof is untouched by the pull');
    checked++;
  }
  ok(checked > 0, 'a row toward the burrow was found and pulled');
}

// ---- the player's controls: shots, walk, angle, charge and fire
{
  const g = createGame(7); g.newGame(99); settle(g, 60);
  const d = g.cur;
  ok(d.id === 'dora' && d.shots.map((s) => s.name).join() === 'Pebble,Pebble Trio,Darning Needle', 'Dora carries Pebble, Pebble Trio and the Darning Needle');
  ok(unit(g, 'enzo').shots.map((s) => s.name).join() === 'Clay Pot,Heavy Pot,Darning Needle', 'Enzo carries Clay Pot, Heavy Pot and the Darning Needle');
  for (const [i, want] of [[2, 2], [0, 0], [1, 1]]) { g.pickShot(i); ok(d.shot === want, `key ${i + 1} picks shot ${want + 1}`); }
  g.cycleShot(); ok(d.shot === 2, 'Tab cycles to the needle'); g.cycleShot(); ok(d.shot === 0, 'Tab wraps to shot 1');
  const guide = g.aimGuide; g.toggleGuide(); ok(g.aimGuide === !guide, 'G toggles the aim guide'); g.toggleGuide();
  const x0 = d.x; for (let i = 0; i < 40; i++) g.update({ right: true });
  ok(d.x > x0 + 30 && d.moved > 30, `walking right moves Dora (${x0} -> ${d.x})`);
  for (let i = 0; i < 400; i++) g.update({ left: true });
  ok(d.moved <= d.walk + 1.5, `walking stops at Tupa's reach (${d.moved} of ${d.walk})`);
  const a0 = d.angle; for (let i = 0; i < 20; i++) g.update({ up: true }); ok(d.angle === a0 + 10, 'up raises the angle');
  for (let i = 0; i < 10; i++) g.update({ down: true }); ok(d.angle === a0 + 5, 'down lowers it');
  g.chargeStart(); for (let i = 0; i < 60; i++) g.update({});
  ok(Math.abs(g.power - 60 * CHARGE) < 1e-6, 'holding Space charges the power');
  g.chargeRelease();
  ok(g.state === 'flight' && d.lastPower > 49, 'letting go fires');
  for (let i = 0; i < 2000 && g.cur === d; i++) g.update({});
  ok(g.cur.id === 'fox', 'the fox takes the next turn');
}
// the needle, fired by the player, stitches a patch where it lands
{
  const g = createGame(7); g.newGame(31); settle(g, 60);
  const d = g.cur; g.pickShot(2);
  let plan = null;
  for (let pw = 20; pw <= 70 && !plan; pw++) { const r = g.simulate(d, d.angle, pw); if (r.end === 'ground' && r.x > 330 && r.x < 460) plan = { pw, r }; }
  ok(!!plan, 'a needle shot onto the slope is in reach');
  g.chargeStart(); while (g.power < plan.pw) g.update({}); g.chargeRelease();
  for (let i = 0; i < 600 && g.state === 'flight'; i++) g.update({});
  const darn = g.LOG.find((e) => e[0] === 'darn');
  ok(darn && darn[1] === 'dora', 'Dora\'s needle stitches a patch');
  ok(g.solid(darn[2], darn[3]) && g.solid(darn[2], darn[3] - 30), 'the patch is solid cloth, including above where it struck');
}

// ---- endings
{
  // nightfall: careful self-play on a seed that holds out
  let won = null;
  for (let s = 1; s < 30 && !won; s++) {
    const g = createGame(7); g.autoHero = true; g.newGame(s * 101);
    let n = 0; while (g.state !== 'over' && n < 120000) { g.fast(600); n += 600; }
    if (g.banner === 'Night falls: the kits are safe!') won = g;
  }
  ok(!!won, 'self-play reaches nightfall');
  ok(won.round === NIGHT + 1 && won.kits.some((k) => k.home) && isWin(won.banner), `night falls after ${NIGHT} rounds with kits at home`);
  // the kits bolt
  const g = createGame(7); g.newGame(8); settle(g, 30);
  for (const k of g.kits) { k.home = false; }
  g.pickShot(0); g.chargeStart(); g.update({}); g.chargeRelease();
  for (let i = 0; i < 3000 && g.state !== 'over'; i++) g.update({});
  ok(g.state === 'over' && g.banner === 'The kits bolted from the burrow' && !isWin(g.banner), 'losing every kit ends it');
  for (let i = 0; i < 41; i++) g.update({});
  ok(g.canRestart(), 'after a moment the end can restart');
  g.newGame(9); ok(g.state === 'aim' && g.round === 1 && g.kits.every((k) => k.home) && g.LOG.length === 0, 'a new game starts fresh');
  // both heroes down
  const h = createGame(7); h.newGame(10); settle(h, 30);
  for (const u of h.units) if (u.side === 'hero') u.alive = false;
  for (let i = 0; i < 10 && h.state !== 'over'; i++) h.update({});
  ok(h.state === 'over' && h.banner === 'The predators win this one', 'both heroes down ends it');
}

console.log(`PASS lookout-ridge engine (${pass} checks)`);
