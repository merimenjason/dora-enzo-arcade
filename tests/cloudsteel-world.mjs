// Cloudsteel story tests: walking and walls, the scenes that start by themselves, talk and choices, pickups, the
// lantern (bridges, deep planks and the Long Wick, the sun-stone, the three worlds in order, jade seals), duels
// (starting, losing and stepping back, winning, rewards), the save, determinism, and that the whole story can be
// played through, main path and everything, by a bot that plays the duels like a person.
import assert from 'node:assert/strict';
import { World, idleW, LANTERN, PICKUP } from '../.checks/cloudsteel-world.js';
import { AREAS, SCENES, NAMES, ITEMS, DUELS, PICKUPS, NPCS, QUIPUS } from '../.checks/cloudsteel-story.js';
import { playStory } from './cloudsteel-story-bots.mjs';

let n = 0; const ok = (name) => console.log(`ok ${++n} - ${name}`);
const W = (o = {}) => ({ ...idleW(), ...o });
/** reads through a talk, saying `choose` to any choice */
function talk(w, choose = 1) { let k = 0, p = false, evs = []; while (w.mode === 'talk' && k++ < 5000) { p = !p; w.tick(W({ act: p, choose: w.choosing ? choose : 0 })); evs.push(...w.events); } return evs; }
function tick(w, inp, k = 1) { const evs = []; for (let i = 0; i < k; i++) { w.tick(inp); evs.push(...w.events); } return evs; }
const press = (w, key, k = 80) => { tick(w, W()); const e = tick(w, W({ [key]: true })); return e.concat(tick(w, W(), k)); };
const at = (w, area, x, z) => { w.area = area; w.x = x; w.z = z; w.enzo.x = x; w.enzo.z = z + 1; w.mode = 'walk'; };
const fresh = () => { const w = new World(); tick(w, W()); talk(w); return w; };

{ // the start
  const w = new World(); assert.equal(w.area, 'terrace'); assert.ok(w.walkable(w.x, w.z));
  const e = tick(w, W()); assert.equal(w.mode, 'talk'); assert.ok(e.some((x) => x.t === 'talk' || x.t === 'line'));
  talk(w); assert.equal(w.mode, 'walk'); assert.ok(w.has('seen:start'));
  tick(w, W(), 30); assert.equal(w.mode, 'walk');
  ok('the climb starts with Dora and Enzo talking, once');
}
{ // walking, walls and gates
  const w = fresh(), z0 = w.z; tick(w, W({ z: -1 }), 60); assert.ok(w.z < z0 - 3, `walked north ${w.z}`); assert.ok(w.moving);
  assert.ok(!w.walkable(-8.8, 4), 'the bell-house is solid'); assert.ok(!w.walkable(0, -25.3), 'the sun gate is shut');
  assert.ok(!w.walkable(0, -60) && !w.walkable(60, 0), 'off the cliff is not walkable');
  w.flags.add('gate:sun'); assert.ok(w.walkable(0, -25.3), 'an open gate can be walked through');
  // Enzo keeps up behind her
  const d = Math.hypot(w.enzo.x - w.x, w.enzo.z - w.z); assert.ok(d > 0.8 && d < 3, `Enzo is ${d.toFixed(2)} m behind`);
  ok('Dora walks, walls and shut gates stop her, and Enzo follows a step behind');
}
{ // talk, and lines that change with the story
  for (const [id, f] of Object.entries(SCENES)) {
    for (const w of [new World(), (() => { const v = new World(); for (const d of DUELS) v.wonDuels.add(d.id); for (const i of Object.keys(ITEMS)) v.gotItems.add(i); for (const fl of ['met:atoq', 'seen:start', 'seen:forest', 'seen:crossed', 'seen:citadel', 'met:titu', 'met:mallku']) v.flags.add(fl); return v; })()]) {
      const s = f(w); assert.ok(s.lines.length > 0, id);
      for (const l of s.lines) { assert.ok(l.who in NAMES, `${id}: ${l.who}`); assert.ok(l.text.length > 3 && l.text.length < 260, `${id}: ${l.text}`); }
    }
  }
  const early = SCENES.qori(new World()).lines.map((l) => l.text).join(), v = new World(); v.wonDuels.add('atoq'); v.flags.add('met:atoq');
  assert.notEqual(SCENES.qori(v).lines.map((l) => l.text).join(), early, 'Qori says something new after Atoq');
  const w = fresh(); at(w, 'terrace', -5.6, 6.6); assert.equal(w.near()?.kind, 'npc');
  tick(w, W()); tick(w, W({ act: true })); assert.equal(w.mode, 'talk'); const who = new Set(talk(w).filter((e) => e.t === 'line').map((e) => e.who));
  assert.ok(who.has('dora') || who.has('enzo'), 'Dora or Enzo answers'); assert.equal(w.mode, 'walk');
  ok(`every scene (${Object.keys(SCENES).length}) has lines early and late; Qori's change after Atoq; Dora and Enzo answer`);
}
{ // pickups
  const w = fresh(); at(w, 'terrace', 6, 11.2); assert.equal(w.near()?.kind, 'pickup');
  const e = press(w, 'act', PICKUP.len + 5); assert.ok(w.got('q1')); assert.ok(e.some((x) => x.t === 'pickup') && e.some((x) => x.t === 'got' && x.id === 'q1'));
  assert.equal(w.quipus, 1); assert.ok(!w.pickups().some((p) => p.id === 'q1'));
  assert.equal(PICKUPS.filter((p) => p.id.startsWith('q')).length, QUIPUS); assert.equal(PICKUPS.filter((p) => !p.id.startsWith('q')).length, 2);
  ok('picking up takes a moment, then the item is kept; nine quipus and two upgrades lie about');
}
{ // the lantern: the sun-stone, nothing nearby
  const w = fresh(); at(w, 'terrace', 0, 0); let e = press(w, 'lantern', LANTERN.len + 2); assert.ok(e.some((x) => x.t === 'cold')); assert.equal(w.mode, 'walk');
  at(w, 'terrace', 1.6, -22.2); e = press(w, 'lantern', LANTERN.len + 2); assert.ok(e.some((x) => x.t === 'stone') && w.has('gate:sun'));
  ok('the lantern wakes the sun-stone, which opens the terrace gate; with nothing near, it gutters');
}
{ // sleeping bridges, deep planks and the Long Wick
  const w = fresh(); at(w, 'forest', 11, -26.6); press(w, 'lantern', LANTERN.len + 2);
  const lit = AREAS.forest.planks.filter((p) => w.isLit(p.id)).map((p) => p.id); assert.ok(lit.includes('b0') && !lit.includes('b11'), lit.join());
  assert.ok(w.walkable(11, -27.6) && !w.walkable(11, -27.6 - 1.5 * 11), 'lit planks hold, dark ones do not');
  const deep = AREAS.forest.planks.find((p) => p.deep); at(w, 'forest', deep.x, -48.5); press(w, 'lantern', LANTERN.len + 2); assert.ok(!w.isLit(deep.id), 'a deep plank sleeps through the small flame');
  w.gotItems.add('wick'); press(w, 'lantern', LANTERN.len + 2); assert.ok(w.isLit(deep.id), 'the Long Wick wakes it');
  ok('the lantern wakes the planks near Enzo; deep planks need the Long Wick');
}
{ // the three worlds, in order
  const w = fresh(), S = { serpent: [-6.6, -15], puma: [0, -17.6], condor: [6.6, -15] };
  const light = (g) => { at(w, 'citadel', ...S[g]); return press(w, 'lantern', LANTERN.len + 2); };
  let e = light('puma'); assert.ok(e.some((x) => x.t === 'stonesReset'), 'starting in the middle puts the stones out'); assert.ok(!w.isLit('puma'));
  light('serpent'); assert.ok(w.isLit('serpent')); e = light('condor'); assert.ok(e.some((x) => x.t === 'stonesReset') && !w.isLit('serpent'), 'skipping one puts them out');
  light('serpent'); light('puma'); assert.ok(!w.has('gate:worlds')); light('condor'); assert.ok(w.has('gate:worlds'));
  ok('the three stones open the inner gate only below, middle, above: serpent, puma, condor');
}
{ // jade seals
  const w = fresh(); at(w, 'citadel', 0, -3.2); press(w, 'lantern', LANTERN.len + 2); assert.ok(!w.has('gate:outer'), 'no Jade Glass, no opening');
  w.gotItems.add('jade'); press(w, 'lantern', LANTERN.len + 2); assert.ok(w.has('gate:outer'));
  ok('jade seals open to the lantern only with the Jade Glass');
}
{ // a required duel: starts by itself; losing steps back; winning records it and talks
  const w = fresh(); at(w, 'terrace', 0, 1); let k = 0; while (w.mode === 'walk' && k++ < 600) tick(w, W({ z: -1 }));
  assert.equal(w.mode, 'talk'); talk(w); assert.equal(w.mode, 'duel'); assert.equal(w.duel.id, 'atoq');
  w.endDuel(false, { ticks: 600, deflects: 1, falls: 1, finishers: 0, damage: 100 }); assert.equal(w.mode, 'arrive'); assert.ok(Math.hypot(w.x - 0, w.z - 4) < 0.1); assert.ok(!w.won('atoq'));
  assert.equal(w.stats.falls, 1); tick(w, W(), 40); assert.equal(w.mode, 'walk');
  k = 0; while (w.mode === 'walk' && k++ < 600) tick(w, W({ z: -1 })); talk(w); assert.equal(w.mode, 'duel');
  w.placeFromFight(0, 1, Math.PI, 1, 2); assert.ok(Math.abs(w.x) < 0.01 && Math.abs(w.z + 7) < 0.01, `placed at ${w.x},${w.z}`);
  w.endDuel(true); assert.ok(w.won('atoq')); assert.equal(w.mode, 'talk'); talk(w); assert.equal(w.mode, 'walk');
  ok('a required duel starts by itself; a loss steps Dora back down the path; a win is kept and talked over');
}
{ // an optional duel: can be turned down; its reward
  const w = fresh(); w.wonDuels.add('atoq'); at(w, 'terrace', 26.4, -8.6); assert.equal(w.near()?.kind, 'duel');
  tick(w, W()); tick(w, W({ act: true })); talk(w, 2); assert.equal(w.mode, 'walk'); assert.ok(!w.duel, '"Not now" walks away');
  tick(w, W(), 2); tick(w, W({ act: true })); talk(w, 1); assert.equal(w.mode, 'duel'); assert.equal(w.duel.id, 'kin1'); assert.equal(w.duel.foes.length, 2);
  const e = []; w.endDuel(true); e.push(...w.events); assert.ok(w.got('edge') && e.some((x) => x.t === 'got' && x.id === 'edge')); assert.ok(w.ups.edge);
  talk(w); assert.ok(w.npcs().some((o) => o.id === 'kin1-after'), 'Sami stays to talk');
  ok('an optional duel can be turned down; winning it gives a sword upgrade, and the foe stays to talk');
}
{ // the save
  const w = fresh(); w.gotItems.add('q1'); w.wonDuels.add('atoq'); w.lit.add('sun'); w.flags.add('gate:sun'); at(w, 'terrace', 2, -20);
  const s = JSON.parse(JSON.stringify(w.toSave())), b = World.fromSave(s);
  assert.deepEqual(b.toSave(), w.toSave()); assert.equal(b.area, 'terrace'); assert.ok(b.got('q1') && b.won('atoq') && b.has('gate:sun'));
  for (const bad of [null, 3, {}, { v: 9, area: 'terrace' }, { v: 1, area: 'moon' }]) assert.equal(World.fromSave(bad), null);
  const odd = World.fromSave({ v: 1, area: 'forest', x: 999, z: 999, got: ['q1', 'sword-of-lies', 4], won: ['nobody'] });
  assert.ok(odd.walkable(odd.x, odd.z)); assert.deepEqual([...odd.gotItems], ['q1']); assert.equal(odd.wonDuels.size, 0);
  ok('the place on the mountain round-trips; broken saves are refused and odd ones cleaned');
}
{ // the whole story, by the bot
  const main = playStory({ seed: 3, full: false }), all = playStory({ seed: 4, full: true });
  assert.ok(main.w.done && all.w.done);
  assert.deepEqual([...main.w.wonDuels].sort(), ['ambush', 'atoq', 'ukhu']);
  assert.equal(all.w.wonDuels.size, DUELS.length); assert.equal(all.w.quipus, QUIPUS); for (const i of ['edge', 'feather', 'claw', 'wick', 'jade', 'flame']) assert.ok(all.w.got(i), i);
  const again = playStory({ seed: 3, full: false }); assert.deepEqual(again.w.toSave(), main.w.toSave());
  const mins = (r) => ((r.w.stats.ticks + r.w.stats.fightTicks) / 3600).toFixed(1);
  assert.ok(NPCS.length >= 7);
  ok(`the bot plays the story through: main path ${mins(main)} min (3 duels), everything ${mins(all)} min (${DUELS.length} duels, ${QUIPUS} quipus, 6 upgrades); the same seed replays it`);
}
console.log(`\n${n} Cloudsteel story tests passed`);
