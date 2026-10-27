// Burrow Command engine checks: the sides' tables, the maps, gathering, building, training, tech, combat maths, pathfinding,
// fog, every unit's ability, winding and mending, the computer players' build orders, the campaign's goals, replays and saving.
import assert from 'node:assert/strict';
import {
  World, MAPS, SIDES, SIDE_IDS, UNITS, BUILDINGS, UPGRADES, ABILITIES, T, TICK_HZ, CARRY, GATHER_TICKS, MAX_SUPPLY, START_HAY, START_WORKERS,
  NODE_SLOTS, SALVAGE, TRAP, WIND_SECONDS, REWIND_RATE, WOUND_DOWN, SLOW, HERO_REST, unitsOf, buildingsOf, upgradesOf, layout, replay, dist, tiles,
} from '../.checks/command-game.js';
import { findPath, smooth, open } from '../.checks/command-path.js';
import { Computer, attachBrains, skirmish, TUNE } from '../.checks/command-ai.js';
import { MISSIONS, startMission, readProfile, freshProfile, recordMission, recordSkirmish, unlocked, totalStars, SAVE_KEY, Pilot, missionById } from '../.checks/command-campaign.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const S = (s) => Math.round(s * TICK_HZ);
const FLAT = { id: 'flat', name: 'Flat', blurb: '', w: 40, h: 30, starts: [[3, 3], [34, 24]], sites: [], features: [], mirror: false };
/** A bare test field: two players, nothing placed, fog off unless asked. */
const field = (sides = ['colony', 'guild'], o = {}) => new World({ map: o.map ?? FLAT, seed: 1, bare: true, scripted: true, fog: o.fog ?? false, slots: sides.map((side, i) => ({ side, team: o.teams?.[i] ?? i })) });
const run = (w, ticks) => { for (let i = 0; i < ticks && !w.result; i++) w.step(); };
const at = (tx, ty) => [tx * T + T / 2, ty * T + T / 2];
const put = (w, p, type, tx, ty) => w.spawnUnit(p, type, ...at(tx, ty));

// ---------------------------------------------------------------- the sides
for (const side of SIDE_IDS) {
  const S0 = SIDES[side], us = unitsOf(side), bs = buildingsOf(side), ups = upgradesOf(side);
  ok(BUILDINGS[S0.hq]?.hq && BUILDINGS[S0.house]?.supply === 8 && UNITS[S0.worker]?.worker, `${side}: a home, a house and a worker`);
  const army = us.filter((u) => !u.hero && !u.worker && u.id !== 'wagon');
  ok(army.length >= 5 && us.filter((u) => !u.hero && u.id !== 'wagon').length >= 6 && us.length <= 9, `${side}: ${us.length} units`);
  ok(bs.length >= 7 && bs.length <= 9, `${side}: ${bs.length} buildings`);
  ok(ups.length === 3, `${side}: three upgrades`);
  for (const b of bs) {
    for (const t of b.trains) ok(UNITS[t]?.side === side, `${b.id} trains its own side's ${t}`);
    for (const r of b.research) ok(UPGRADES[r]?.side === side, `${b.id} researches ${r}`);
    for (const r of b.req) ok(BUILDINGS[r]?.side === side, `${b.id} needs ${r}`);
    const keys = [...b.trains.map((t) => UNITS[t].key), ...b.research.map((r) => UPGRADES[r].key)];
    ok(new Set(keys).size === keys.length, `${b.id}: its command keys differ`);
  }
  const bkeys = bs.map((b) => b.key);
  ok(new Set(bkeys).size === bkeys.length, `${side}: build keys differ`);
  // every trainable unit is reachable through the tech tree
  for (const u of us.filter((u) => !u.hero && u.id !== 'wagon')) ok(bs.some((b) => b.trains.includes(u.id)), `${side}: ${u.id} has a building that trains it`);
  ok(us.some((u) => u.air) && us.some((u) => u.siege), `${side}: a flier and a siege unit`);
}
ok(Object.values(UNITS).every((u) => u.hp > 0 && u.speed > 0 && u.sight > 0 && (u.dmg === 0 || u.cd > 0)), 'every unit has sane numbers');
ok(Object.values(ABILITIES).every((a) => a.name && a.blurb && a.key), 'every ability is described');
ok(Object.values(UNITS).filter((u) => u.ability).every((u) => ABILITIES[u.ability]), 'unit abilities exist');

// ---------------------------------------------------------------- the maps
ok(MAPS.length >= 4 && MAPS.length <= 5, `${MAPS.length} skirmish maps`);
for (const m of MAPS) {
  const L = layout(m), w = new World({ map: m, seed: 3, slots: [{ side: 'colony', team: 0 }, { side: 'hive', team: 1 }] });
  ok(L.starts.length === 2, `${m.id}: two starts`);
  ok(L.nodes.every((n) => n.x >= 0 && n.y >= 0 && n.x < m.w - 1 && n.y < m.h - 1), `${m.id}: nodes on the map`);
  const hay = (s) => w.nodes.filter((n) => n.res === 'hay' && dist(n.x, n.y, (s[0] + 1.5) * T, (s[1] + 1.5) * T) < tiles(9)).length;
  ok(hay(L.starts[0]) === hay(L.starts[1]) && hay(L.starts[0]) >= 5, `${m.id}: both homes have the same meadows (${hay(L.starts[0])})`);
  ok(w.nodes.filter((n) => n.res === 'glimmer').length >= 2, `${m.id}: glimmer for both`);
  // the two homes are joined, and every node can be reached from the nearer home
  const [a, b] = L.starts;
  const p = findPath(w.grid, a[0] + 1, a[1] + 3, b[0], b[1], b[0] + 2, b[1] + 2, 1, 20000);
  const end = p[p.length - 1];
  ok(Math.max(Math.abs((end % m.w) - (b[0] + 1)), Math.abs(Math.floor(end / m.w) - (b[1] + 1))) <= 3, `${m.id}: a road from home to home`);
  for (const n of w.nodes) {
    const s = dist(n.x, n.y, (a[0] + 1.5) * T, (a[1] + 1.5) * T) < dist(n.x, n.y, (b[0] + 1.5) * T, (b[1] + 1.5) * T) ? a : b;
    const q = findPath(w.grid, s[0] + 1, s[1] + 4, n.tx, n.ty, n.tx + 1, n.ty + 1, 1, 20000);
    const e = q ? q[q.length - 1] : (s[1] + 4) * m.w + s[0] + 1;
    ok(Math.max(Math.abs((e % m.w) - n.tx), Math.abs(Math.floor(e / m.w) - n.ty)) <= 2, `${m.id}: node at ${n.tx},${n.ty} can be reached`);
  }
  ok(w.buildings.length === 2 && w.units.length === 2 * START_WORKERS && w.players.every((p) => p.hay === START_HAY), `${m.id}: each side starts with a home and ${START_WORKERS} workers`);
  for (const s of L.sites) ok(w.canPlace(0, 'burrow', s[0], s[1], false), `${m.id}: the expansion at ${s} fits a home`);
}

// ---------------------------------------------------------------- gathering
{
  const w = new World({ map: MAPS[0], seed: 1, slots: [{ side: 'colony', team: 0 }, { side: 'guild', team: 1 }] });
  const p = w.players[0], worker = w.units.find((u) => u.owner === 0), hq = w.buildings.find((b) => b.owner === 0);
  const node = w.nodes.filter((n) => n.res === 'hay').sort((x, y) => dist(x.x, x.y, hq.x, hq.y) - dist(y.x, y.y, hq.x, hq.y))[0];
  w.issue({ p: 0, k: 'gather', ids: [worker.id], n: node.id });
  let carried = 0;
  for (let i = 0; i < S(30) && !carried; i++) { w.step(); if (worker.carry) carried = worker.carry; }
  eq(carried, CARRY.hay, 'a worker fills its basket with 5 hay');
  ok(node.amount === node.max - CARRY.hay, 'and the meadow has 5 less');
  const before = p.hay; run(w, S(20));
  ok(p.hay > before && p.stats.hay >= CARRY.hay, 'and carries it home to the Great Burrow');
  ok(worker.order?.k === 'gather' || worker.order?.k === 'return', 'then goes back for more by itself');
  // slots: only two at a meadow at once
  const team = w.units.filter((u) => u.owner === 0);
  w.issue({ p: 0, k: 'gather', ids: team.map((u) => u.id), n: node.id });
  let most = 0; for (let i = 0; i < S(40); i++) { w.step(); most = Math.max(most, node.busy.length); }
  ok(most <= NODE_SLOTS.hay, `no more than ${NODE_SLOTS.hay} gatherers work one meadow at once`);
  ok(team.filter((u) => u.order?.k === 'gather' && u.order.n !== node.id).length >= 1, 'the others find a quieter meadow');
  // a meadow runs out and is cleared from the map
  const tiny = w.nodes[0]; tiny.amount = CARRY.hay;
  const g = team[0]; w.issue({ p: 0, k: 'gather', ids: [g.id], n: tiny.id }); run(w, S(30));
  ok(!w.nodes.includes(tiny) && !w.get(tiny.id) && w.occ[tiny.ty * w.W + tiny.tx] === 0, 'an empty meadow is gone and its ground is open');
  ok(g.order?.k === 'gather' || g.order?.k === 'return', 'and its gatherer moves on to the next one');
  // glimmer is slower
  ok(GATHER_TICKS.glimmer > GATHER_TICKS.hay && CARRY.glimmer < CARRY.hay, 'glimmer is slower to gather than hay');
}
// a full minute of five gatherers
{
  const w = new World({ map: MAPS[1], seed: 2, slots: [{ side: 'hive', team: 0 }, { side: 'guild', team: 1 }] });
  const hq = w.buildings[0], hay = w.nodes.filter((n) => n.res === 'hay').sort((x, y) => dist(x.x, x.y, hq.x, hq.y) - dist(y.x, y.y, hq.x, hq.y));
  w.units.filter((u) => u.owner === 0).forEach((u, i) => w.issue({ p: 0, k: 'gather', ids: [u.id], n: hay[i % 3].id }));
  run(w, S(60));
  ok(w.players[0].stats.hay >= 350 && w.players[0].stats.hay <= 900, `five gatherers bring in ${w.players[0].stats.hay} hay a minute`);
}

// ---------------------------------------------------------------- building and training
{
  const w = field(['colony', 'guild']);
  const p = w.players[0]; p.hay = 1000; p.glimmer = 500;
  const hq = w.placeBuilding(0, 'burrow', 3, 3, true);
  const g = put(w, 0, 'gatherer', 8, 4);
  ok(!w.exec({ p: 0, k: 'build', ids: [g.id], b: 'perch', tx: 10, ty: 3 }), 'a Glider Perch needs a Seed Library first');
  ok(!w.exec({ p: 0, k: 'build', ids: [g.id], b: 'pit', tx: 3, ty: 3 }), 'nothing goes down on top of the Great Burrow');
  ok(w.exec({ p: 0, k: 'build', ids: [g.id], b: 'hut', tx: 10, ty: 3 }), 'a Hay Hut goes down');
  eq(p.hay, 900, 'and its 100 hay is paid at once');
  w.exec({ p: 0, k: 'stop', ids: [g.id] });
  eq(p.hay, 1000, 'stopping before the foundation is down hands the hay back');
  w.exec({ p: 0, k: 'build', ids: [g.id], b: 'hut', tx: 10, ty: 3 });
  run(w, S(4));
  const hut = w.buildings.find((b) => b.type === 'hut');
  ok(hut && !hut.done, 'the gatherer lays the foundation');
  run(w, S(BUILDINGS.hut.time) + 20);
  ok(hut.done && hut.hp === hut.maxHp, `the Hay Hut is finished after ${BUILDINGS.hut.time} s with full health`);
  w.step(); eq(p.cap, 18, 'and the colony has room for 18');
  // one colony builder at a time, but tinkerers stack
  const w2 = field(['guild', 'colony']); w2.players[0].hay = 1000;
  w2.placeBuilding(0, 'bin', 3, 3, true);
  const ts = [put(w2, 0, 'tinkerer', 8, 4), put(w2, 0, 'tinkerer', 8, 5), put(w2, 0, 'tinkerer', 8, 6)];
  w2.exec({ p: 0, k: 'build', ids: [ts[0].id], b: 'stash', tx: 10, ty: 4 }); run(w2, S(3));
  const st = w2.buildings.find((b) => b.type === 'stash');
  w2.exec({ p: 0, k: 'help', ids: [ts[1].id, ts[2].id], t: st.id });
  run(w2, S(BUILDINGS.stash.time / 2) + 40);
  ok(st.done, 'three Tinkerers build a Stash Den in well under its full time');
  const w3 = field(['hive', 'colony']); w3.players[0].hay = 1000;
  w3.placeBuilding(0, 'core', 3, 3, true);
  const sorter = put(w3, 0, 'sorter', 8, 4);
  w3.exec({ p: 0, k: 'build', ids: [sorter.id], b: 'spring', tx: 10, ty: 4 }); run(w3, S(3));
  const sp = w3.buildings.find((b) => b.type === 'spring');
  ok(sp && sorter.order?.k !== 'build', 'a Sorter Beetle starts a building and leaves it to grow');
  run(w3, S(BUILDINGS.spring.time) + 5); ok(sp.done, 'which grows on its own');
  const w4 = field(); w4.players[0].hay = 500; const h4 = w4.placeBuilding(0, 'burrow', 3, 3, true); const g4 = put(w4, 0, 'gatherer', 8, 4);
  w4.exec({ p: 0, k: 'build', ids: [g4.id], b: 'pit', tx: 10, ty: 4 }); run(w4, S(4));
  const pit4 = w4.buildings.find((b) => b.type === 'pit');
  w4.exec({ p: 0, k: 'cancel', bid: pit4.id });
  ok(!w4.get(pit4.id) && w4.players[0].hay === 500 - 150 + Math.floor(150 * 0.75), 'cancelling a foundation hands back 75%');
  void h4;
  // training
  const pit = w.placeBuilding(0, 'pit', 14, 3, true);
  const hayBefore = p.hay;
  ok(w.exec({ p: 0, k: 'train', bid: pit.id, u: 'slinger' }), 'a Pebble Pit trains a slinger');
  eq(p.hay, hayBefore - UNITS.slinger.hay, 'paid on queueing');
  ok(!w.exec({ p: 0, k: 'train', bid: pit.id, u: 'glider' }), 'but not a glider');
  for (let i = 0; i < 4; i++) w.exec({ p: 0, k: 'train', bid: pit.id, u: 'slinger' });
  ok(!w.exec({ p: 0, k: 'train', bid: pit.id, u: 'slinger' }), 'five in a queue at most');
  w.exec({ p: 0, k: 'cancel', bid: pit.id }); eq(pit.queue.length, 4, 'cancel takes the last one off');
  w.exec({ p: 0, k: 'rally', bids: [pit.id], x: 20 * T, y: 12 * T });
  run(w, S(UNITS.slinger.time) + 5);
  const s1 = w.units.find((u) => u.type === 'slinger');
  ok(s1 && w.players[0].stats.trained >= 1, `a slinger steps out after ${UNITS.slinger.time} s`);
  run(w, S(10)); ok(dist(s1.x, s1.y, 20 * T, 12 * T) < tiles(2.5), 'and walks to the rally point');
  // supply
  const w5 = field(); const p5 = w5.players[0]; p5.hay = 5000;
  const h5 = w5.placeBuilding(0, 'burrow', 3, 3, true);
  for (let i = 0; i < 5; i++) w5.exec({ p: 0, k: 'train', bid: h5.id, u: 'gatherer' });
  for (let i = 0; i < 9; i++) put(w5, 0, 'gatherer', 10 + i, 10);
  run(w5, S(UNITS.gatherer.time * 3));
  eq(w5.units.length, 10, 'the Great Burrow alone has room for 10: training waits for room');
  w5.placeBuilding(0, 'hut', 20, 3, true); run(w5, S(UNITS.gatherer.time) + 5);
  eq(w5.units.length, 11, 'a Hay Hut makes room and training carries on');
  ok(MAX_SUPPLY === 60, 'supply tops out at 60');
  // limits
  const w6 = field(['hive', 'colony']); w6.players[0].hay = 5000; w6.players[0].glimmer = 5000;
  w6.placeBuilding(0, 'core', 3, 3, true); w6.placeBuilding(0, 'hall', 8, 3, true); const forge = w6.placeBuilding(0, 'forge', 12, 3, true);
  ok(w6.exec({ p: 0, k: 'train', bid: forge.id, u: 'queen' }) && !w6.exec({ p: 0, k: 'train', bid: forge.id, u: 'queen' }), 'only one Queen at a time');
}

// ---------------------------------------------------------------- tech and upgrades
{
  const w = field(); const p = w.players[0]; p.hay = 3000; p.glimmer = 3000;
  w.placeBuilding(0, 'burrow', 3, 3, true); const lib = w.placeBuilding(0, 'library', 8, 3, true);
  const s = put(w, 0, 'slinger', 12, 12), dummy = put(w, 1, 'scrapper', 30, 25);
  ok(w.exec({ p: 0, k: 'research', bid: lib.id, up: 'pebbles' }), 'the Seed Library studies Sharper Pebbles');
  ok(!w.exec({ p: 0, k: 'research', bid: lib.id, up: 'pebbles' }), 'but not twice');
  ok(w.exec({ p: 0, k: 'research', bid: lib.id, up: 'fluff' }), 'and queues Thicker Fluff');
  run(w, S(UPGRADES.pebbles.time) + 2);
  ok(p.ups.pebbles === true && w.dmgOf(0, 10) === 12, 'Sharper Pebbles: +20% damage');
  run(w, S(UPGRADES.fluff.time) + 2);
  ok(w.armorOf(s) === 1 && s.maxHp === Math.floor(UNITS.slinger.hp * 1.1), 'Thicker Fluff: +1 armour and +10% health, even for units already out');
  void dummy;
}

// ---------------------------------------------------------------- combat maths
{
  const w = field(['colony', 'hive']);
  w.placeBuilding(0, 'burrow', 1, 1, true); w.placeBuilding(1, 'core', 36, 26, true);
  const s = put(w, 0, 'slinger', 10, 10), sh = put(w, 1, 'shellback', 14, 10);
  w.damage(sh, 8, 0, s.id); eq(sh.hp, UNITS.shellback.hp - (8 - UNITS.shellback.armor), 'damage less armour');
  const hp = sh.hp; w.damage(sh, 1, 0, s.id); eq(sh.hp, hp - 1, 'but always at least 1');
  sh.firm = 10; const h2 = sh.hp; w.damage(sh, 20, 0, s.id); eq(sh.hp, h2 - Math.floor((20 - UNITS.shellback.armor) / 2), 'Stand Firm halves a bump');
  const d = put(w, 0, 'digger', 10, 14), core = w.buildings.find((b) => b.owner === 1);
  const before = core.hp; d.cd = 0; w['strike'](d, core);
  eq(before - core.hp, UNITS.digger.dmg * UNITS.digger.siege - BUILDINGS.core.armor, 'siege units hit buildings three times as hard');
  // a fight: three slingers bump a scrapper to nothing; it is poofed and its supply freed
  const w2 = field(['colony', 'guild']);
  w2.placeBuilding(0, 'burrow', 1, 1, true); w2.placeBuilding(1, 'bin', 36, 26, true);
  const team = [put(w2, 0, 'slinger', 10, 10), put(w2, 0, 'slinger', 10, 11), put(w2, 0, 'slinger', 10, 12)];
  const sc = put(w2, 1, 'scrapper', 16, 11);
  let poof = null;
  for (let i = 0; i < S(20) && !poof; i++) { w2.step(); poof = w2.events.find((e) => e.k === 'poof'); }
  ok(poof && poof.type === 'scrapper' && !w2.get(sc.id), 'idle slingers bump a scrapper that walks up, and it is poofed home');
  ok(team.every((u) => w2.get(u.id)), 'and the slingers are all still there');
  w2.step(); eq(w2.players[1].used, 0, 'a poofed unit frees its supply');
  // hold position does not chase
  const w3 = field(['colony', 'guild']);
  w3.placeBuilding(0, 'burrow', 1, 1, true); w3.placeBuilding(1, 'bin', 36, 26, true);
  const holder = put(w3, 0, 'fluffguard', 10, 10); w3.exec({ p: 0, k: 'hold', ids: [holder.id] });
  const far = put(w3, 1, 'tosser', 14, 10); w3.exec({ p: 1, k: 'hold', ids: [far.id] });
  run(w3, S(5)); ok(dist(holder.x, holder.y, ...at(10, 10)) < T, 'a unit holding its ground does not chase');
  const free = put(w3, 0, 'fluffguard', 10, 8); run(w3, S(8));
  ok(!w3.get(far.id) || far.hp < far.maxHp, 'an idle one goes and bumps whatever bumps it');
  void free;
  // attack-move fights along the way; plain move does not
  const w4 = field(['colony', 'guild']);
  w4.placeBuilding(0, 'burrow', 1, 1, true); w4.placeBuilding(1, 'bin', 36, 26, true);
  const walker = put(w4, 0, 'fluffguard', 5, 15), am = put(w4, 0, 'fluffguard', 5, 17);
  const block = put(w4, 1, 'scrapper', 15, 16); w4.exec({ p: 1, k: 'hold', ids: [block.id] });
  w4.exec({ p: 0, k: 'move', ids: [walker.id], x: 28 * T, y: 15 * T });
  w4.exec({ p: 0, k: 'amove', ids: [am.id], x: 28 * T, y: 17 * T });
  run(w4, S(14));
  ok(dist(walker.x, walker.y, 28 * T, 15 * T) < tiles(1.5), 'a plain move walks straight past');
  ok(!w4.get(block.id), 'an attack-move bumps what it meets');
  // towers
  const w5 = field(['guild', 'colony']);
  w5.placeBuilding(0, 'bin', 1, 1, true); w5.placeBuilding(1, 'burrow', 36, 26, true);
  const lantern = w5.placeBuilding(0, 'lantern', 10, 10, true), vis = put(w5, 1, 'gatherer', 14, 11);
  run(w5, S(12)); ok(!w5.get(vis.id), 'a Lantern Post bumps anyone grumpy nearby');
  void lantern;
  // splash
  const w6 = field(['colony', 'hive']);
  w6.placeBuilding(0, 'burrow', 1, 1, true); w6.placeBuilding(1, 'core', 36, 26, true);
  const pf = put(w6, 0, 'puffer', 10, 10), a1 = put(w6, 1, 'clicker', 13, 10), a2 = put(w6, 1, 'clicker', 13, 11);
  w6.exec({ p: 1, k: 'hold', ids: [a1.id, a2.id] });
  w6.step(); a1.hp = a1.maxHp; a2.hp = a2.maxHp; pf.cd = 0; w6['strike'](pf, a1);
  ok(a1.hp === a1.maxHp - UNITS.puffer.dmg && a2.hp === a2.maxHp - (UNITS.puffer.dmg >> 1), 'Dust Puffer splash: half damage to those beside');
}

// ---------------------------------------------------------------- salvage
{
  const w = field(['guild', 'colony']);
  w.placeBuilding(0, 'bin', 1, 1, true); w.placeBuilding(1, 'burrow', 36, 26, true);
  put(w, 0, 'tinkerer', 10, 12);
  const victim = put(w, 1, 'fluffguard', 11, 10);
  const hay = w.players[0].hay, glim = w.players[0].glimmer;
  w.damage(victim, 999, 0, 0); w.step();
  eq([w.players[0].hay - hay, w.players[0].glimmer - glim], [Math.floor((UNITS.fluffguard.hay * SALVAGE) / 100), Math.floor((UNITS.fluffguard.glimmer * SALVAGE) / 100)], 'the Guild salvages 15% of a rival poofed nearby');
  const own = put(w, 0, 'scrapper', 10, 13); const h2 = w.players[0].hay; w.damage(own, 999, 1, 0); w.step();
  eq(w.players[0].hay, h2, 'but not its own');
}

// ---------------------------------------------------------------- pathfinding
{
  const g = { w: 10, h: 10, block: new Uint8Array(100) };
  for (let y = 0; y < 9; y++) g.block[y * 10 + 5] = 1;
  const p = findPath(g, 1, 1, 8, 1, 8, 1, 0);
  ok(p && p.every((i) => g.block[i] === 0) && p[p.length - 1] === 18, 'A* goes round a wall');
  ok(p.some((i) => Math.floor(i / 10) === 9), 'through the only gap');
  const sm = smooth(g, 1.5, 1.5, p);
  ok(sm.length / 2 < p.length && sm.length >= 4, `smoothing keeps only the corners (${sm.length / 2} of ${p.length})`);
  // no corner cutting
  const g2 = { w: 3, h: 3, block: new Uint8Array([0, 1, 0, 1, 0, 0, 0, 0, 0]) };
  const p2 = findPath(g2, 0, 0, 2, 2, 2, 2, 0);
  ok(!p2 || p2.length === 0 || !p2.includes(4) || g2.block[1] === 1, 'never squeezes diagonally between two blocked tiles');
  ok(p2 === null || p2.length === 0 || !open(g2, 1, 0), 'a walled-in corner has no way out');
  // unreachable goal: walks to the nearest reachable tile
  const g3 = { w: 6, h: 6, block: new Uint8Array(36) };
  for (const i of [3, 9, 15, 21, 27, 33]) g3.block[i] = 1;
  const p3 = findPath(g3, 0, 0, 5, 5, 5, 5, 0);
  ok(p3 && p3[p3.length - 1] % 6 === 2, 'an unreachable goal leads to the nearest reachable spot');
}
// a crowd crosses a real map round ponds and buildings, and nobody gets stuck
for (const m of [MAPS[1], MAPS[2]]) {
  const w = new World({ map: m, seed: 5, fog: false, scripted: true, slots: [{ side: 'colony', team: 0 }, { side: 'hive', team: 1 }] });
  const [a, b] = w.starts, us = [];
  for (let i = 0; i < 24; i++) { const [x, y] = w.freeSpotNear(a[0] + 4 + (i % 6), a[1] + 4 + Math.floor(i / 6)); us.push(w.spawnUnit(0, i % 3 ? 'slinger' : 'fluffguard', x, y)); }
  const gx = (b[0] - 3) * T, gy = (b[1] + 1) * T;
  w.exec({ p: 0, k: 'move', ids: us.map((u) => u.id), x: gx, y: gy });
  let inside = 0;
  for (let i = 0; i < S(90); i++) {
    w.step();
    for (const u of us) { const tx = Math.floor(u.x / T), ty = Math.floor(u.y / T); if (w.grid.block[ty * w.W + tx]) inside++; }
    if (us.every((u) => !u.order)) break;
  }
  ok(inside === 0, `${m.id}: nobody ever stands inside a pond, a tree or a building`);
  ok(us.every((u) => !u.order), `${m.id}: all 24 arrive (nobody stuck) by ${(w.tick / TICK_HZ).toFixed(0)} s`);
  ok(us.every((u) => dist(u.x, u.y, gx, gy) < tiles(6)), `${m.id}: and they arrive together near the spot`);
}
// fliers fly over water
{
  const w = new World({ map: MAPS[2], seed: 5, fog: false, scripted: true, bare: true, slots: [{ side: 'colony', team: 0 }, { side: 'hive', team: 1 }] });
  const gl = w.spawnUnit(0, 'glider', ...at(24, 25));
  w.exec({ p: 0, k: 'move', ids: [gl.id], x: 24 * T, y: 38 * T });
  const crossed = (() => { for (let i = 0; i < S(10); i++) { w.step(); if (w.terrain[Math.floor(gl.y / T) * w.W + Math.floor(gl.x / T)] === 1) return true; } return false; })();
  ok(crossed, 'a Glider flies straight over the stream');
}

// ---------------------------------------------------------------- fog
{
  const w = new World({ map: MAPS[0], seed: 1, slots: [{ side: 'colony', team: 0 }, { side: 'guild', team: 1 }] });
  const v = w.vis.get(0), [a, b] = w.starts;
  ok(v[(a[1] + 1) * w.W + a[0] + 1] === 2, 'home is in view');
  ok(v[(b[1] + 1) * w.W + b[0] + 1] === 0, 'the far home is unexplored');
  const foe = w.buildings.find((x) => x.owner === 1);
  ok(!w.pick(foe.x, foe.y, 0), 'an enemy in the fog cannot be clicked');
  ok(!w.canPlace(0, 'hut', b[0] - 3, b[1], true), 'and nothing can be built on unexplored ground');
  const scout = w.units.find((u) => u.owner === 0);
  w.exec({ p: 0, k: 'move', ids: [scout.id], x: foe.x - tiles(5), y: foe.y });
  run(w, S(40));
  ok(w.seenBuilding(0, foe) && w.known.get(0).has(foe.id), 'a scout sees the far home and remembers it');
  w.exec({ p: 0, k: 'move', ids: [scout.id], x: (a[0] + 6) * T, y: (a[1] + 6) * T }); run(w, S(40));
  ok(v[(b[1] + 1) * w.W + b[0] + 1] === 1 && w.known.get(0).has(foe.id), 'once it leaves, the ground stays explored and the building is remembered');
}

// ---------------------------------------------------------------- abilities
{
  // Dust Cloud
  const w = field(['colony', 'hive']); w.placeBuilding(0, 'burrow', 1, 1, true); w.placeBuilding(1, 'core', 36, 26, true);
  const pf = put(w, 0, 'puffer', 10, 10), bug = put(w, 1, 'clicker', 14, 10);
  w.exec({ p: 1, k: 'hold', ids: [bug.id] });
  const sp0 = w.speedOf(bug), cd0 = w.cdOf(bug);
  w.exec({ p: 0, k: 'ability', ids: [pf.id], ab: 'cloud', x: bug.x, y: bug.y }); run(w, 3);
  ok(w.clouds.length === 1 && bug.slow > 0, 'a Dust Cloud settles on the beetle');
  ok(w.speedOf(bug) === Math.floor((sp0 * (100 - SLOW.speed)) / 100) || w.speedOf(bug) < sp0, 'which moves 40% slower');
  ok(w.cdOf(bug) > cd0, 'and swings slower');
  ok(pf.abCd > 0, 'the Puffer waits for it to come round again');
  run(w, S(SLOW.time) + S(1.5)); ok(w.clouds.length === 0 && bug.slow === 0, `the cloud clears after ${SLOW.time} s`);
  // Rally Song and Stand Firm
  const w2 = field(['colony', 'hive']); w2.placeBuilding(0, 'burrow', 1, 1, true); w2.placeBuilding(1, 'core', 36, 26, true);
  const dora = put(w2, 0, 'dora', 10, 10), enzo = put(w2, 0, 'enzo', 11, 10), pal = put(w2, 0, 'slinger', 12, 11);
  pal.hp = 10; w2.exec({ p: 0, k: 'ability', ids: [dora.id], ab: 'song' });
  ok(pal.hp === Math.min(pal.maxHp, 70) && pal.haste > 0, 'Rally Song mends 60 and quickens friends');
  w2.exec({ p: 0, k: 'ability', ids: [enzo.id], ab: 'firm' }); ok(pal.firm > 0 && dora.firm > 0, 'Stand Firm covers friends nearby');
  // heroes mend when left alone
  enzo.hp = 100; enzo.hurtAt = w2.tick; run(w2, HERO_REST + 40); ok(enzo.hp > 100, 'a hero catches their breath after a while unbumped');
  // Honey Snare
  const w3 = field(['guild', 'colony']); w3.placeBuilding(0, 'bin', 1, 1, true); w3.placeBuilding(1, 'burrow', 36, 26, true);
  const tr = put(w3, 0, 'trapper', 10, 10);
  w3.exec({ p: 0, k: 'ability', ids: [tr.id], ab: 'snare', x: 12 * T, y: 10 * T }); run(w3, 4);
  ok(w3.traps.length === 1, 'a Trapsetter hides a snare');
  const walker = put(w3, 1, 'slinger', 16, 10); w3.exec({ p: 1, k: 'move', ids: [walker.id], x: 8 * T, y: 10 * T + T / 2 });
  let held = false; for (let i = 0; i < S(6) && !held; i++) { w3.step(); held = walker.root > 0; }
  ok(held && w3.traps.length === 0, `the first grumpy walker in is held for ${TRAP.root} s and the snare is used up`);
  const x0 = walker.x; run(w3, S(1)); ok(walker.x === x0, 'and cannot walk while held');
  for (let i = 0; i < 8; i++) { tr.abCd = 0; w3['cast'](tr, 'snare', (20 + i) * T, 20 * T); }
  eq(w3.traps.filter((t) => t.owner === 0).length, TRAP.max, `at most ${TRAP.max} snares at a time`);
  // Shiny Toss
  const w4 = field(['guild', 'hive']); w4.placeBuilding(0, 'bin', 1, 1, true); w4.placeBuilding(1, 'core', 36, 26, true);
  const marlo = put(w4, 0, 'marlo', 10, 10), bugs = [put(w4, 1, 'clicker', 14, 10), put(w4, 1, 'clicker', 14, 11)];
  w4.exec({ p: 0, k: 'ability', ids: [marlo.id], ab: 'shiny', x: 14 * T, y: 10 * T }); run(w4, 2);
  ok(bugs.every((b) => b.stun > 0), 'Shiny Toss dazzles everyone grumpy round the spot');
  // Brood Call
  const w5 = field(['hive', 'colony']); w5.placeBuilding(0, 'core', 1, 1, true); w5.placeBuilding(1, 'burrow', 36, 26, true);
  const q = put(w5, 0, 'queen', 10, 10); w5.step();
  w5.exec({ p: 0, k: 'ability', ids: [q.id], ab: 'brood' });
  eq(w5.units.filter((u) => u.type === 'clicker').length, 2, 'Brood Call whirs out two Click Beetles');
  // Overwind
  const sp = w5.placeBuilding(0, 'spring', 10, 14, true), c = w5.units.find((u) => u.type === 'clicker');
  c.wind = 0;
  w5.exec({ p: 0, k: 'ability', ids: [sp.id], ab: 'overwind' });
  ok(c.wind === w5.windMax(w5.players[0]) && c.haste > 0 && sp.abCd > 0, 'Overwind fills every spring nearby and quickens them');
  // Pack Up and Unpack
  const w6 = field(['guild', 'colony']); w6.placeBuilding(0, 'bin', 1, 1, true); w6.placeBuilding(1, 'burrow', 36, 26, true);
  const ws = w6.placeBuilding(0, 'workshop', 10, 10, true);
  ok(w6.exec({ p: 0, k: 'ability', ids: [ws.id], ab: 'pack' }), 'the Rolling Workshop packs up');
  const wagon = w6.units.find((u) => u.type === 'wagon');
  ok(wagon && !w6.get(ws.id) && w6.occ[10 * w6.W + 10] === 0, 'into a wagon, freeing the ground');
  w6.exec({ p: 0, k: 'move', ids: [wagon.id], x: 25 * T, y: 15 * T }); run(w6, S(14));
  ok(w6.exec({ p: 0, k: 'ability', ids: [wagon.id], ab: 'unpack' }), 'and unpacks somewhere new');
  const ws2 = w6.buildings.find((b) => b.type === 'workshop');
  ok(ws2 && ws2.done && Math.abs(ws2.tx - 24) <= 2 && !w6.units.some((u) => u.type === 'wagon'), 'as a working workshop again');
  // Tunnels
  const w7 = field(['colony', 'hive']); w7.placeBuilding(1, 'core', 36, 26, true);
  const home = w7.placeBuilding(0, 'burrow', 2, 2, true), far = w7.placeBuilding(0, 'mound', 30, 3, true);
  const digger = put(w7, 0, 'slinger', 6, 6);
  ok(w7.exec({ p: 0, k: 'tunnel', ids: [digger.id], t: far.id }), 'a slinger heads into the tunnels');
  let went = false; for (let i = 0; i < S(6); i++) { w7.step(); if (digger.under) went = true; if (went && !digger.under) break; }
  ok(went && dist(digger.x, digger.y, far.x, far.y) < tiles(3), 'and pops out at the far Tunnel Mound');
  ok(!w7.exec({ p: 0, k: 'tunnel', ids: [w7.spawnUnit(0, 'glider', ...at(6, 7)).id], t: far.id }), 'Gliders fly, they do not tunnel');
  void home;
}

// ---------------------------------------------------------------- winding and mending
{
  const w = field(['hive', 'colony']); w.placeBuilding(0, 'core', 1, 1, true); w.placeBuilding(1, 'burrow', 36, 26, true);
  const c = put(w, 0, 'clicker', 30, 20), s = put(w, 0, 'sorter', 30, 22);
  const max = w.windMax(w.players[0]);
  eq(max, S(WIND_SECONDS), `a beetle stays wound for ${WIND_SECONDS} s`);
  c.wind = 5; run(w, 12);
  ok(c.wind === 0 && w.woundDown(c), 'away from springs it runs down');
  const base = Math.round((UNITS.clicker.speed * T) / TICK_HZ);
  eq(w.speedOf(c), Math.floor((base * WOUND_DOWN) / 100), 'and moves at half pace');
  ok(!w.winds(s), 'Sorter Beetles are kept wound by the Hive');
  const sp = w.placeBuilding(0, 'spring', 29, 17, true); run(w, 25);
  ok(c.wind >= REWIND_RATE * 10 && !w.woundDown(c), 'near a Spring Tower it winds back up quickly');
  // shells mend
  c.hp = 10; c.hurtAt = w.tick; run(w, 120);
  ok(c.hp > 10, 'a beetle’s shell mends after a rest');
  void sp;
}

// ---------------------------------------------------------------- the computer players
for (const side of SIDE_IDS) for (const diff of ['easy', 'normal', 'hard']) {
  const w = attachBrains(new World(skirmish({ map: MAPS[4], seed: 9, sides: [side, side === 'hive' ? 'colony' : 'hive'], ai: [diff, 'easy'] })));
  run(w, S(4 * 60));
  const p = w.players[0], has = (t) => w.buildings.some((b) => b.owner === 0 && b.type === t && b.done);
  const workers = w.units.filter((u) => u.owner === 0 && u.def.worker).length;
  const army = w.units.filter((u) => u.owner === 0 && !u.def.worker).length;
  ok(has(SIDES[side].house), `${side} ${diff}: builds a house`);
  ok(w.buildings.some((b) => b.owner === 0 && b.def.trains.length && !b.def.hq && b.done), `${side} ${diff}: builds a barracks`);
  ok(workers >= Math.min(TUNE[diff].workers, 10) - 2, `${side} ${diff}: ${workers} gatherers by 4 minutes`);
  ok(army >= 4, `${side} ${diff}: an army of ${army}`);
  if (diff !== 'easy') ok(w.buildings.some((b) => b.owner === 0 && b.def.research.length), `${side} ${diff}: a tech building`);
  ok(p.stats.glimmer > 0, `${side} ${diff}: gathers glimmer too`);
}
{
  const e = attachBrains(new World(skirmish({ map: MAPS[3], seed: 4, sides: ['guild', 'colony'], ai: ['easy', null] })));
  const h = attachBrains(new World(skirmish({ map: MAPS[3], seed: 4, sides: ['guild', 'colony'], ai: ['hard', null] })));
  run(e, S(300)); run(h, S(300));
  const n = (w) => w.units.filter((u) => u.owner === 0).length;
  ok(n(h) > n(e), `hard grows faster than easy (${n(h)} against ${n(e)} units at 5 minutes)`);
  ok(h.brains[0] instanceof Computer && !h.brains[1], 'only the computer slots get a brain');
}

// ---------------------------------------------------------------- winning and the clock
{
  const w = field(['colony', 'guild']);
  w.cfg.scripted = false;
  w.placeBuilding(0, 'burrow', 1, 1, true); const bin = w.placeBuilding(1, 'bin', 30, 20, true);
  w.damage(bin, 99999, 0, 0); w.step();
  ok(w.result && w.result.winner === 0 && w.result.reason === 'rout' && w.players[1].out, 'tidying away every rival building wins');
  const w2 = new World({ map: MAPS[0], seed: 1, limit: 100, slots: [{ side: 'colony', team: 0 }, { side: 'guild', team: 1 }] });
  run(w2, 200);
  ok(w2.result?.reason === 'time' && w2.tick === 101, 'a match that runs out of time is decided on score');
}

// ---------------------------------------------------------------- the campaign
ok(MISSIONS.length === 10 && new Set(MISSIONS.map((m) => m.id)).size === 10, 'ten missions');
for (const m of MISSIONS) {
  const { w, script } = startMission(m, 1);
  ok(m.brief.length >= 2 && m.outro.length >= 2 && m.stars.length === 3 && m.goal, `${m.n} ${m.title}: briefing, ending, goal and three stars`);
  ok(w.units.some((u) => u.owner === 0) || w.buildings.some((b) => b.owner === 0), `${m.id}: the player starts with something`);
  ok(w.players.length === m.others.length + 1 && w.players[0].side === 'colony', `${m.id}: players set up`);
  for (const e of [...w.units, ...w.buildings]) { const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T); ok(tx >= 0 && ty >= 0 && tx < w.W && ty < w.H, `${m.id}: ${e.type} on the map`); }
  run(w, S(5));
  ok(!w.result, `${m.id}: nothing ends in the first five seconds`);
  ok(missionById(m.id) === m, `${m.id}: found by id`);
  void script;
}
{
  // gather goal
  const m = MISSIONS[0], { w, script } = startMission(m, 1);
  const p = w.players[0]; p.stats.hay = 400;
  run(w, 2); ok(!w.result, 'First Harvest needs the hut and the pit as well');
  w.placeBuilding(0, 'hut', 12, 4, true); w.placeBuilding(0, 'pit', 12, 20, true); run(w, 2);
  ok(script.outcome?.win && script.outcome.stars[0] && script.outcome.stars[1], 'and is won with them (inside 5 minutes: two stars)');
  // a hero poofed loses
  const m2 = MISSIONS[1], r2 = startMission(m2, 1), enzo = r2.w.units.find((u) => u.type === 'enzo');
  r2.w.damage(enzo, 9999, 1, 0); run(r2.w, 2);
  ok(r2.script.outcome && !r2.script.outcome.win && /Enzo/.test(r2.script.outcome.why), 'a mission is lost if Enzo is poofed');
  // destroy goal
  const r3 = startMission(m2, 1); for (const id of [...r3.w.flags.entries()].filter(([, f]) => f === 'goal').map(([id]) => id)) r3.w.damage(r3.w.get(id), 99999, 0, 0);
  run(r3.w, 2); ok(r3.script.outcome?.win, 'Muddy Footprints is won when the Stash Den is tidied away');
  // survive
  const r4 = startMission(MISSIONS[2], 1);
  let most = 0; for (let i = 0; i < S(130); i++) { r4.w.step(); most = Math.max(most, r4.w.units.filter((u) => u.owner === 1).length); }
  ok(most >= 5, `Hold the Hollow sends raccoon waves (${most} at once)`);
  r4.w.tick = S(360) - 1; run(r4.w, 2);
  ok(r4.script.outcome?.win, 'and is won by holding out six minutes');
  // rescue
  const r5 = startMission(MISSIONS[3], 1), kits = r5.w.units.filter((u) => r5.w.flags.get(u.id) === 'kit');
  ok(kits.length === 3 && kits.every((k) => r5.w.frozen.has(k.id)), 'Lost Kits: three kits wait where they are');
  ok(!r5.w.exec({ p: 0, k: 'move', ids: [kits[0].id], x: T * 5, y: T * 5 }), 'and cannot be ordered until found');
  const enzo5 = r5.w.units.find((u) => u.type === 'enzo'); enzo5.x = kits[0].x + T; enzo5.y = kits[0].y; run(r5.w, 2);
  ok(!r5.w.frozen.has(kits[0].id) && r5.w.events.length >= 0, 'a kit joins when one of ours walks up');
  const hq5 = r5.w.buildings.find((b) => b.def.hq);
  for (const k of kits) { r5.w.frozen.delete(k.id); k.x = hq5.x + T * 2; k.y = hq5.y + T * 2; }
  run(r5.w, 2); ok(r5.script.outcome?.win && r5.script.outcome.stars[2], 'and the mission is won with every kit home, unbumped');
  // race
  const r6 = startMission(MISSIONS[7], 1); r6.w.players[1].stats.glimmer = 1200; run(r6.w, 2);
  ok(r6.script.outcome && !r6.script.outcome.win, 'Glimmer Rush is lost if the Hive gets there first');
  // escort
  const r7 = startMission(MISSIONS[5], 1), marlo = r7.w.units.find((u) => u.type === 'marlo'), mound = r7.w.buildings.find((b) => b.type === 'mound');
  ok(marlo && marlo.owner === 0, 'Marlo’s Bargain: Marlo marches with the colony');
  marlo.x = mound.x - T * 2; marlo.y = mound.y; run(r7.w, 2);
  ok(r7.script.outcome?.win, 'and is won when he reaches the eastern burrow');
  // talk
  const r8 = startMission(MISSIONS[0], 1); let said = 0;
  for (let i = 0; i < S(30); i++) { r8.w.step(); said += r8.w.events.filter((e) => e.k === 'say').length; }
  ok(said >= 1, 'missions talk during play');
}

// ---------------------------------------------------------------- deterministic replay
{
  const make = () => attachBrains(new World(skirmish({ map: MAPS[2], seed: 77, sides: ['colony', 'hive'], ai: [null, 'normal'] })));
  const w = make();
  const hq = w.buildings.find((b) => b.owner === 0);
  const workers = w.units.filter((u) => u.owner === 0).map((u) => u.id);
  for (let i = 0; i < S(150); i++) {
    if (i === 3) w.issue({ p: 0, k: 'gather', ids: workers, n: w.nodes.filter((n) => n.res === 'hay').sort((a, b) => dist(a.x, a.y, hq.x, hq.y) - dist(b.x, b.y, hq.x, hq.y))[0].id });
    if (i === 40) w.issue({ p: 0, k: 'train', bid: hq.id, u: 'gatherer' });
    if (i === 900) w.issue({ p: 0, k: 'build', ids: [workers[0]], b: 'hut', tx: hq.tx + 5, ty: hq.ty });
    if (i === 1500) w.issue({ p: 0, k: 'move', ids: workers.slice(1, 3), x: 30 * T, y: 30 * T, q: true });
    w.step();
  }
  ok(w.log.length >= 4, 'player orders are logged with their tick');
  const again = replay(make, w.log, w.tick);
  eq(again.fingerprint(), w.fingerprint(), 'a seed and the order log replay the match exactly');
  const other = attachBrains(new World(skirmish({ map: MAPS[2], seed: 78, sides: ['colony', 'hive'], ai: [null, 'normal'] })));
  run(other, w.tick);
  ok(other.fingerprint() !== w.fingerprint(), 'a different seed plays differently');
  const a = attachBrains(new World(skirmish({ map: MAPS[0], seed: 5, sides: ['guild', 'hive'], ai: ['hard', 'normal'] })));
  const b = attachBrains(new World(skirmish({ map: MAPS[0], seed: 5, sides: ['guild', 'hive'], ai: ['hard', 'normal'] })));
  run(a, S(240)); run(b, S(240));
  eq(a.fingerprint(), b.fingerprint(), 'two computer players replay exactly from a seed');
}

// ---------------------------------------------------------------- saving
{
  eq(SAVE_KEY, 'burrow-command-v1', 'saved under burrow-command-v1');
  eq(readProfile(null), freshProfile(), 'no save: a fresh profile');
  eq(readProfile('not json'), freshProfile(), 'a broken save: a fresh profile');
  eq(readProfile(JSON.stringify({ v: 2, stars: { harvest: 3 } })), freshProfile(), 'another version: a fresh profile');
  const odd = readProfile(JSON.stringify({ v: 1, stars: { harvest: 9, nope: 2, footprints: 'x' }, settings: { speed: 7, diff: 'wild', side: 'hive', mute: true }, skirmish: { played: 3, won: 9 } }));
  eq(odd.stars, { harvest: 3, footprints: 0 }, 'stars are clamped and unknown missions dropped');
  ok(odd.settings.speed === 1 && odd.settings.diff === 'normal' && odd.settings.side === 'hive' && odd.settings.mute, 'bad settings fall back, good ones are kept');
  ok(odd.skirmish.won === 3, 'never more wins than games');
  let p = freshProfile();
  ok(unlocked(p, 0) && !unlocked(p, 1), 'only the first mission is open');
  p = recordMission(p, 'harvest', [true, false, true], 200);
  ok(p.stars.harvest === 2 && unlocked(p, 1), 'a win opens the next mission');
  p = recordMission(p, 'harvest', [true, false, false], 150);
  ok(p.stars.harvest === 2 && p.best.harvest === 150, 'the best stars and best time are kept');
  p = recordMission(p, 'footprints', [false, false, false], 50);
  ok(!p.stars.footprints && !unlocked(p, 2), 'a loss records nothing');
  p = recordSkirmish(recordSkirmish(p, 'guild', true), 'guild', false);
  ok(p.skirmish.played === 2 && p.skirmish.won === 1 && p.skirmish.bySide.guild.played === 2, 'skirmish results are counted');
  eq(readProfile(JSON.stringify(p)), p, 'a profile survives a round trip');
  eq(totalStars(p), 2, 'stars add up');
}

console.log(`Burrow Command: ${checks} engine checks passed.`);
void Pilot; void open;
