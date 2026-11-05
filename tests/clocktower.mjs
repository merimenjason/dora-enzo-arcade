// The Clocktower Mystery rules: the walkthrough plays to the end through all four chapters, the paths that stay shut
// until the story opens them, Dora's and Enzo's own talents, walking together and apart (Dora on the mill lever), each
// of the four wheels, the works only taking each wheel on its own spindle, using things where they don't belong, the
// notebook always having a hint, moves only counting when something happens, and saves (round trip, corrupt or
// tampered saves, the best result).
import assert from 'node:assert/strict';
import {
  CHAPTERS, GEARS, ITEMS, ROOMS, SAVE_KEY, SLOTS, SPOTS, WALKTHROUGH, act, clone, exits, finish, has, hint, newSave, newState, parseSave, room, serialise, spots,
} from '../.checks/clocktower-game.js';

let pass = 0;
const ok = (m) => { pass++; console.log('PASS', m); };
const play = (n) => { const s = newState(); for (const a of WALKTHROUGH.slice(0, n)) assert.ok(act(s, a).ok, JSON.stringify(a)); return s; };
const at = (pred) => WALKTHROUGH.findIndex((a) => pred(a));

// ---- the world
{
  assert.equal(Object.keys(ROOMS).length, 8);
  for (const [r, d] of Object.entries(ROOMS)) for (const to of d.exits) assert.ok(ROOMS[to].exits.includes(r), `${r} ↔ ${to} goes both ways`);
  for (const [id, sp] of Object.entries(SPOTS)) assert.ok(ROOMS[sp.room], `${id} is in a real room`);
  assert.deepEqual(GEARS.slice().sort(), SLOTS.slice().sort());
  for (const it of Object.values(ITEMS)) assert.ok(it.name && it.look.length > 10);
  assert.equal(Object.keys(CHAPTERS).length, 4);
  ok('eight rooms joined both ways, every hotspot in a room, four wheels for four spindles');
}

// ---- the walkthrough
{
  const s = newState(); assert.equal(s.ch, 1); assert.equal(room(s), 'square'); assert.equal(s.who, 'dora');
  const chapters = [];
  WALKTHROUGH.forEach((a, i) => { const before = s.ch, o = act(s, a); assert.ok(o.ok, `step ${i} ${JSON.stringify(a)}: ${o.lines.map((l) => l.text).join(' ')}`); if (s.ch !== before) chapters.push([i, s.ch]); });
  assert.deepEqual(chapters.map((c) => c[1]), [2, 3, 4]);
  assert.equal(s.moves, WALKTHROUGH.length); assert.deepEqual(s.fitted, SLOTS); assert.equal(s.inv.filter((i) => GEARS.includes(i)).length, 0);
  ok(`the walkthrough mends the clock in ${WALKTHROUGH.length} moves, through chapters 2, 3 and 4`);
}

// ---- paths shut until the story opens them
{
  const s = newState();
  assert.ok(exits('square').includes('bakery'));
  const o = act(s, { k: 'go', to: 'bakery' }); assert.equal(o.ok, false); assert.ok(o.lines.length > 0); assert.equal(room(s), 'square');
  assert.equal(act(s, { k: 'go', to: 'riverside' }).ok, false);
  assert.equal(act(s, { k: 'go', to: 'hatshop' }).ok, false);
  assert.equal(s.moves, 0, 'nothing happening is not a move');
  const t = play(9);
  assert.equal(t.ch, 2); assert.ok(t.inv.includes('lantern'));
  const u = clone(t); act(u, { k: 'go', to: 'square' }); assert.ok(act(u, { k: 'go', to: 'bakery' }).ok);
  ok('the bakery, the river and the hat shop stay shut in chapter 1, and open in chapter 2');
}

// ---- hidden things and talents
{
  const s = play(27); // back in the square in chapter 2, before the lantern goes on the well
  assert.equal(room(s), 'square'); assert.ok(!spots(s, 'square').includes('button'), 'the button is hidden in the dark');
  act(s, { k: 'item', item: 'lantern', id: 'well' }); assert.ok(has(s, 'cornerLit')); assert.ok(spots(s, 'square').includes('button'));
  // only Dora climbs out on the ledge; only Enzo hears the clink
  const c = play(6); assert.equal(room(c), 'clockroom'); assert.ok(has(c, 'hatchOpen'));
  const e = clone(c); act(e, { k: 'swap' }); act(e, { k: 'spot', id: 'hatch' }); assert.ok(!has(e, 'ledge'), 'Enzo doesn’t climb');
  act(c, { k: 'spot', id: 'hatch' }); assert.ok(has(c, 'ledge')); assert.ok(c.inv.includes('tuft'));
  const b = play(14); assert.equal(room(b), 'bakery'); assert.equal(b.who, 'enzo');
  const d = clone(b); act(d, { k: 'swap' }); act(d, { k: 'spot', id: 'tub2' }); assert.ok(!has(d, 'clink'), 'Dora doesn’t hear the clink');
  act(b, { k: 'spot', id: 'tub2' }); assert.ok(has(b, 'clink'));
  ok('the button hides until the lantern lights the corner; Dora climbs out on the ledge and Enzo hears the clink');
}

// ---- together and apart: Dora on the mill lever, Enzo with the hook
{
  const s = play(at((a) => a.k === 'spot' && a.id === 'lever') + 1);
  assert.ok(has(s, 'holding')); assert.equal(s.at.dora, 'mill');
  act(s, { k: 'swap' }); assert.equal(s.who, 'enzo'); act(s, { k: 'go', to: 'riverside' });
  assert.equal(s.at.enzo, 'riverside'); assert.equal(s.at.dora, 'mill', 'Dora stays on the lever while Enzo walks');
  assert.ok(act(s, { k: 'item', item: 'boathook', id: 'wheel' }).ok); assert.ok(s.got.includes('brass')); assert.ok(!has(s, 'holding'));
  // without Dora on the lever the hook can’t reach
  const t = play(at((a) => a.k === 'spot' && a.id === 'lever'));
  act(t, { k: 'go', to: 'riverside' }); act(t, { k: 'item', item: 'boathook', id: 'wheel' }); assert.ok(!t.got.includes('brass'));
  ok('Dora holds the lever in the mill while Enzo hooks the brass wheel; without her it can’t be done');
}

// ---- the works: each wheel on its own spindle
{
  const n = at((a) => a.k === 'fit'), s = play(n);
  assert.equal(room(s), 'clockroom'); assert.equal(s.ch, 3);
  for (const g of GEARS) assert.ok(s.inv.includes(g), `holding the ${g} wheel`);
  const m = s.moves;
  assert.equal(act(s, { k: 'fit', item: 'star', slot: 0 }).ok, false); assert.equal(s.fitted[0], null); assert.equal(s.moves, m);
  assert.equal(act(s, { k: 'fit', item: 'oilcan', slot: 1 }).ok, false);
  SLOTS.forEach((g, k) => { const o = act(s, { k: 'fit', item: g, slot: k }); assert.ok(o.ok); if (k < 3) assert.ok(!o.end); else assert.ok(o.end); });
  assert.equal(s.ch, 4);
  assert.equal(act(s, { k: 'fit', item: 'brass', slot: 0 }).ok, false, 'nothing left to fit');
  ok('a wheel only fits its own spindle, and the fourth one ends the mystery');
}

// ---- using things where they don't belong
{
  const s = play(3);
  for (const id of spots(s, room(s))) { const t = clone(s); const o = act(t, { k: 'item', item: 'oilcan', id }); assert.ok(o.lines.length > 0, `something is said for oil can → ${id}`); }
  assert.equal(act(clone(s), { k: 'item', item: 'lantern', id: 'tock' }).ok, false, 'can’t use what you haven’t got');
  assert.equal(act(clone(s), { k: 'spot', id: 'works' }).ok, false, 'a hotspot in another room does nothing');
  assert.equal(act(clone(s), { k: 'go', to: 'mill' }).ok, false, 'you can only walk to the next room');
  ok('every misuse gets a line, and nothing works from the wrong room or without the thing');
}

// ---- the notebook
{
  const s = newState(); const seen = new Set();
  for (const a of WALKTHROUGH) { const h = hint(s); assert.ok(typeof h === 'string' && h.length > 10); seen.add(h); act(s, a); }
  assert.ok(seen.size >= 15, `plenty of different hints (${seen.size})`);
  ok(`the notebook always has a hint (${seen.size} different ones on the way through)`);
}

// ---- saves
{
  assert.equal(SAVE_KEY, 'clocktower-mystery-v1');
  const sv = newSave(); sv.game = play(30); sv.settings.music = false;
  const back = parseSave(serialise(sv)), sorted = (a) => [...a].sort();
  assert.deepEqual(parseSave(serialise(back)), back, 'loading a loaded save changes nothing');
  assert.deepEqual(sorted(back.game.got), sorted(sv.game.got)); assert.deepEqual(sorted(back.game.inv), sorted(sv.game.inv));
  assert.deepEqual(sorted(back.game.seen), sorted(sv.game.seen));
  assert.deepEqual({ ...back.game, got: 0, inv: 0, seen: 0 }, { ...sv.game, got: 0, inv: 0, seen: 0 }); assert.deepEqual(back.settings, sv.settings);
  for (const bad of [null, '', '{', '[]', '{"v":2}', 'null', '{"v":1,"game":{"ch":9}}']) { const p = parseSave(bad); assert.equal(p.game, null); assert.equal(p.done, false); }
  const t = JSON.parse(serialise(sv)); t.game.inv.push('star'); t.game.at.dora = 'moon'; assert.equal(parseSave(JSON.stringify(t)).game, null, 'a room that doesn’t exist');
  const u = JSON.parse(serialise(sv)); u.game.inv.push('star'); u.game.flags.push('cheat'); u.game.moves = -5;
  const pu = parseSave(JSON.stringify(u)).game; assert.ok(!pu.inv.includes('star'), 'only things you’ve found'); assert.ok(!pu.flags.includes('cheat')); assert.equal(pu.moves, 0);
  const w = JSON.parse(serialise(sv)); w.game.fitted = ['star', 'brass', null, null]; assert.deepEqual(parseSave(JSON.stringify(w)).game.fitted, [null, null, null, null]);
  // the best: fewest hints first, then fewest moves
  const best = newSave(), g = newState();
  g.hints = 3; g.moves = 80; assert.ok(finish(best, g)); assert.ok(best.done);
  g.hints = 3; g.moves = 90; assert.ok(!finish(best, g)); assert.deepEqual(best.best, { moves: 80, hints: 3 });
  g.hints = 1; g.moves = 120; assert.ok(finish(best, g)); assert.deepEqual(best.best, { moves: 120, hints: 1 });
  g.hints = 1; g.moves = 70; assert.ok(finish(best, g)); assert.deepEqual(best.best, { moves: 70, hints: 1 });
  ok('saves round-trip, corrupt and tampered saves are cleaned, and the best is the fewest hints then moves');
}
console.log(`clocktower: ${pass} groups passed`);
