// The Sunken Bellspire engine checks: the map (every room the right size, every open edge leading into another room),
// the gates (each ability's pedestal can be reached with the abilities before it, and the places behind each gate
// can't be reached without it), nowhere to get trapped, the physics (jump, dash, Wind Leap, Wall Kick, ladders,
// swimming, the Deep-Dive Coat, spikes), water bells and floats, doors and why they are locked, the lantern and
// ghost-glass, combat, XP and levels, tagging, knock-outs and the coin bag, shrines and travel, gear, the shop and
// food, a boss from door to reward, the saves (round trip and corrupt), determinism and completion.
// Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  BellspireGame, MAP_EXITS, freshSave, parseSave, heroStats, xpToNext, ROOMS, INFO, COLS, ROWS, TILE, COMPLETION, ABILITY_ORDER, ABILITIES, BOSSES, GEAR, SHOP,
  rawChar, roomOfTile, groupAt, roomById, NO_INPUT, HEART_HP, TAG_CD, surfaceRow, roomRect as roomRectOf, FOES, foeBox, foeFrame,
  BASE_ABILITIES, isBelfryRoom, MURALS, NOTE_LIFE, GALE_HOLD,
} from '../.checks/bellspire-game.js';
import { Graph, nodeRoom, HeroAnimator, ANIMS, animFrames, heroHas } from '../.checks/bellspire-nav.js';
import { BOXES, FOE_BODY, ART } from '../.checks/bellspire-art.js';
import belfry from './bellspire-belfry.mjs';
import trials from './bellspire-trials.mjs';
import strips from './bellspire-strips.mjs';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const I = (o = {}) => ({ ...NO_INPUT, ...o });
const run = (g, n, inp = {}) => { for (let i = 0; i < n; i++) g.step(I(inp)); };
const fresh = (abilities = [], extra = {}) => { const s = freshSave(); s.abilities = abilities; s.flags.push('script:intro', 'script:firstDark', 'script:wayra', 'script:bell'); Object.assign(s, extra); return s; };
const thing = (ch, pred = () => true) => { for (const info of INFO.values()) for (const t of info.things) if (t.ch === ch && pred(t, info.room)) return { ...t, room: info.room }; throw new Error(`no ${ch}`); };
const quiet = (g) => { g.dialog = null; g.enemies = []; };
/** Put the lead on the ground at a thing's tile (or beside it). */
const at = (g, t, dc = 0) => { g.teleport(t.room.id, t.c - t.room.gx * COLS + dc, t.r - t.room.gy * ROWS); quiet(g); run(g, 4); quiet(g); };

// ─── the map ──────────────────────────────────────────────────────────────
for (const r of ROOMS) {
  eq(r.rows.length, r.h * ROWS, `${r.id} has ${r.h * ROWS} rows`);
  ok(r.rows.every((row) => row.length === r.w * COLS), `${r.id}: every row is ${r.w * COLS} wide`);
}
let open = 0;
for (const r of ROOMS) {
  const c0 = r.gx * COLS, r0 = r.gy * ROWS, W = r.w * COLS, H = r.h * ROWS;
  const edge = [];
  for (let x = 0; x < W; x++) edge.push([c0 + x, r0, 0, -1], [c0 + x, r0 + H - 1, 0, 1]);
  for (let y = 0; y < H; y++) edge.push([c0, r0 + y, -1, 0], [c0 + W - 1, r0 + y, 1, 0]);
  for (const [c, rr, dx, dy] of edge) {
    if ('#^'.includes(rawChar(c, rr))) continue;
    const n = roomOfTile(c + dx, rr + dy);
    ok(n && !'#^'.includes(rawChar(c + dx, rr + dy)), `${r.id}: the open edge at (${c - c0},${rr - r0}) leads into another room`);
    open++;
  }
}
ok(open > 100, 'the rooms are joined up');
eq(new Set(ROOMS.map((r) => r.id)).size, ROOMS.length, 'room ids are unique');
eq(COMPLETION.murals, 18, 'eighteen murals: ten in the citadel, eight more with the Windward Belfry');
eq(COMPLETION.base.murals, 10, 'the citadel alone still holds ten');
ok(ROOMS.every((r) => (r.murals?.length ?? 0) === INFO.get(r.id).things.filter((t) => t.ch === 'R').length), 'every mural mark has its text');
const muralIds = ROOMS.flatMap((r) => r.murals ?? []);
eq([...muralIds].sort((a, b) => a - b), [...Array(MURALS.length).keys()], 'each mural text appears once');
ok(ROOMS.every((r) => INFO.get(r.id).things.filter((t) => t.ch === 'C').length === (r.chests?.length ?? 0)), 'every chest has its contents');
ok(ROOMS.filter((r) => r.ability).every((r) => INFO.get(r.id).things.some((t) => t.ch === 'A')), 'every ability room has its pedestal');
eq(ROOMS.filter((r) => r.ability).map((r) => r.ability), ['dash', 'double', 'wallkick', 'chime', 'rope'], 'five pedestals; the lantern, the glide and the Echo Step come from guardians and the coat from a chest');

// ─── the gates, with the route planner ────────────────────────────────────
const start = new BellspireGame(fresh()).body;
const WATERS = [{ halls: 1, docks: 0, throne: 1 }, { halls: 0, docks: 0, throne: 1 }, { halls: 1, docks: 1, throne: 1 }, { halls: 0, docks: 1, throne: 0 }];
function reachable(abilities, keeper = false, calmed = ['frog', 'hydra', 'puma', 'warden']) {
  const rooms = new Set(), spots = [];
  for (const water of WATERS) {
    const G = new Graph({ abilities, water, keeper, calmed });
    for (const k of G.reach([G.nodeAt(start.x, start.y)])) { const n = G.nodes.get(k); rooms.add(nodeRoom(n)?.id); spots.push(n); }
  }
  const near = (t) => spots.some((n) => Math.abs(n.x - (t.c * TILE + 8)) < 18 && Math.abs(n.y - (t.r + 1) * TILE) < 20);
  return { rooms, near };
}
const ped = (a) => thing('A', (t, r) => r.ability === a);
const before = (a) => ABILITY_ORDER.slice(0, ABILITY_ORDER.indexOf(a));
for (const a of ['dash', 'double', 'wallkick', 'chime']) ok(reachable(before(a)).near(ped(a)), `the ${a} pedestal can be reached with what comes before it`);
const CITADEL = ROOMS.filter((r) => !isBelfryRoom(r.id)), ROPE_ROOMS = ['ropeloft', 'ropegallery', 'ropecellar'];
const r0 = reachable([]);
ok(!r0.rooms.has('idol') && !r0.rooms.has('dgate'), 'without the dash: no frog and no docks');
const r1 = reachable(['dash']);
ok(r1.rooms.has('idol') && r1.rooms.has('dgate'), 'with the dash: the frog and the docks');
ok(!r1.near(ped('wallkick')), 'without the lantern the Wall Kick stays out of reach');
ok(!reachable(['dash', 'lantern']).rooms.has('lagoon'), 'the hydra waits behind the Wind Leap');
ok(!reachable(['dash', 'lantern', 'double', 'wallkick']).rooms.has('warden'), 'the warden waits behind the Bell Chime');
const r6 = reachable(['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide']);
ok(!r6.rooms.has('tgate'), 'the Sunken Throne waits behind the Deep-Dive Coat');
ok(r6.near(thing('C', (t, r) => r.chests?.[t.i] === 'ability:deep')), 'the coat chest is reachable with the glide');
const r7 = reachable(BASE_ABILITIES, false);
ok(!r7.rooms.has('mother'), 'the Lake Mother waits until Ukumari opens the door');
const rAll = reachable(BASE_ABILITIES, true);
eq(rAll.rooms.size, CITADEL.length - ROPE_ROOMS.length, 'with the citadel’s seven abilities, every citadel room but the three rope rooms can be reached');
ok(ROPE_ROOMS.every((id) => !rAll.rooms.has(id)), 'the rope rooms stay shut without the Bell Rope');
ok(ROOMS.every((r) => !isBelfryRoom(r.id) || !rAll.rooms.has(r.id)), 'the Windward Belfry can’t be walked to: it is across the water');
const rRope = reachable([...BASE_ABILITIES, 'rope'], true);
eq(rRope.rooms.size, CITADEL.length, 'with the Bell Rope too, every citadel room can be reached, the rope rooms included');
for (const id of ROPE_ROOMS) for (const t of INFO.get(id).things.filter((t) => 'CR'.includes(t.ch))) ok(rRope.near(t), `the rope room ${id}'s ${t.ch === 'C' ? 'chest' : 'mural'} can be reached with the rope`);
// the throne needs all four guardians calm: without any one of them, the planner can't reach the Lake Mother
for (const miss of ['frog', 'hydra', 'puma', 'warden']) ok(!reachable(BASE_ABILITIES, true, ['frog', 'hydra', 'puma', 'warden'].filter((b) => b !== miss)).rooms.has('mother'), `without the ${miss} calmed, the Lake Mother is out of reach`);
// and every guardian can be reached before the throne, with every ability but no seals open
{ const pre = reachable(BASE_ABILITIES, false, []); for (const b of ['frog', 'hydra', 'puma', 'warden']) ok(pre.rooms.has(ROOMS.find((r) => r.boss === b).id), `the ${b} can be reached before the throne opens`); }
// nowhere to get stuck: from every reachable spot there is a way back to the landing (or a shrine to travel from)
for (const [abilities, water] of [[[], WATERS[0]], [['dash'], WATERS[2]], [['dash', 'lantern', 'double', 'wallkick'], WATERS[1]], [BASE_ABILITIES, WATERS[0]], [[...BASE_ABILITIES, 'rope'], WATERS[0]]]) {
  const G = new Graph({ abilities, water, keeper: true, calmed: ['frog', 'hydra', 'puma', 'warden'] });
  const R = G.reach([G.nodeAt(start.x, start.y)]);
  const back = new Map();
  for (const k of R) for (const e of G.edges.get(k) ?? []) { if (!back.has(e.to)) back.set(e.to, []); back.get(e.to).push(k); }
  const shrineRooms = new Set(ROOMS.filter((r) => INFO.get(r.id).things.some((t) => t.ch === 'S')).map((r) => r.id));
  const home = [...R].filter((k) => shrineRooms.has(nodeRoom(G.nodes.get(k))?.id));
  const safe = new Set(home), q = [...home];
  while (q.length) { const k = q.pop(); for (const p of back.get(k) ?? []) if (!safe.has(p)) { safe.add(p); q.push(p); } }
  const trapped = [...R].filter((k) => !safe.has(k)).map((k) => nodeRoom(G.nodes.get(k))?.id);
  eq([...new Set(trapped)], [], `no trap with [${abilities.join(', ')}]: every spot can get back to a shrine`);
}

// ─── physics ──────────────────────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 3);
  quiet(g);
  const y0 = g.body.y;
  let top = y0;
  g.step(I({ jump: true }));
  for (let i = 0; i < 60; i++) { g.step(I({ jump: true })); top = Math.min(top, g.body.y); }
  ok(y0 - top > 48 && y0 - top < 64, `a held jump rises about three and a half tiles (${(y0 - top).toFixed(1)}px)`);
  run(g, 60);
  let low = g.body.y;
  g.step(I({ jump: true }));
  for (let i = 0; i < 40; i++) { g.step(I()); low = Math.min(low, g.body.y); }
  ok(y0 - low < 30, 'a tapped jump is a small hop');
  const x0 = g.body.x;
  run(g, 30, { right: true });
  ok(g.body.x - x0 > 50, 'Dora runs');
  g.step(I({ dash: true }));
  ok(/Reed Dash/.test(g.toast?.text ?? ''), 'pressing dash before finding it says why: ' + g.toast?.text);
}
{
  const g = new BellspireGame(fresh(['dash', 'double']), {}, 3);
  quiet(g); run(g, 10);
  const x0 = g.body.x;
  g.step(I({ dash: true, right: true }));
  run(g, 14, { right: true });
  ok(g.body.x - x0 > 50, `the Reed Dash covers ground fast (${(g.body.x - x0).toFixed(0)}px in 15 ticks)`);
  run(g, 40);
  const y0 = g.body.y;
  let top = y0;
  g.step(I({ jump: true })); for (let i = 0; i < 14; i++) { g.step(I({ jump: true })); top = Math.min(top, g.body.y); }
  g.step(I()); g.step(I({ jump: true }));
  for (let i = 0; i < 50; i++) { g.step(I({ jump: true })); top = Math.min(top, g.body.y); }
  ok(y0 - top > 80, `the Wind Leap jumps again in mid-air (${(y0 - top).toFixed(0)}px)`);
}
{
  // Wall Kick: climb the four-wide tower shaft
  const g = new BellspireGame(fresh(['dash', 'lantern', 'double', 'wallkick']), {}, 3);
  g.teleport('shaft', 14, 9); quiet(g);
  const y0 = g.body.y;
  let dir = -1, top = y0;
  for (let k = 0; k < 16; k++) {
    // drift to a wall, then kick off it towards the other one
    for (let i = 0; i < 50 && g.body.wall === 0; i++) g.step(I({ left: dir < 0, right: dir > 0 }));
    g.step(I({ left: dir < 0, right: dir > 0, jump: true }));
    dir = -dir;
    for (let i = 0; i < 8; i++) g.step(I({ jump: true, left: dir < 0, right: dir > 0 }));
    top = Math.min(top, g.body.y);
  }
  ok(y0 - top > 120, `kicking from wall to wall climbs the shaft (${(y0 - top).toFixed(0)}px)`);
}
{
  // ladders, swimming, deep water and spikes
  const g = new BellspireGame(fresh(), {}, 3);
  const landing = roomById('landing');
  g.teleport('landing', 14, 14); quiet(g);
  run(g, 4, { down: true });
  run(g, 60, { down: true });
  ok(g.room.id === 'well' || g.body.climb, 'down climbs the ladder into the well');
  void landing;
  const g2 = new BellspireGame(fresh(['dash']), {}, 3);
  g2.teleport('cistern', 20, 3); quiet(g2);
  run(g2, 120);
  ok(g2.body.swim, 'Dora swims in the flooded cistern');
  const y0 = g2.body.y;
  for (let i = 0; i < 40; i++) g2.step(I({ jump: i % 10 === 0, up: true }));
  ok(g2.body.y < y0 + 4, 'swim strokes lift her');
  const g3 = new BellspireGame(fresh(['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide']), {}, 3);
  g3.teleport('sink', 15, 5); quiet(g3);
  run(g3, 400, { down: true });
  const deep = (roomById('sink').gy * ROWS + roomById('sink').deep) * TILE;
  ok(g3.body.y <= deep + 24, 'without the Deep-Dive Coat the deep water pushes the heroes back up');
  const g4 = new BellspireGame(fresh(ABILITY_ORDER), {}, 3);
  g4.teleport('sink', 15, 5); quiet(g4);
  run(g4, 400, { down: true });
  ok(g4.body.y > deep + 24 || g4.room.id !== 'sink', 'with the coat they dive down');
  // spikes: back to the last safe ledge, with a small cost
  const g5 = new BellspireGame(fresh(['dash']), {}, 3);
  g5.teleport('chapel', 11, 14); quiet(g5); run(g5, 30);
  const hp = g5.leadSave.hp, safe = { ...g5.safe };
  for (let i = 0; i < 120 && !g5.toast; i++) g5.step(I({ left: true }));
  ok(/safe ledge/.test(g5.toast?.text ?? ''), 'falling on spikes says what happened');
  ok(g5.leadSave.hp < hp && g5.leadSave.hp > hp - 6, 'spikes cost a little HP');
  ok(Math.abs(g5.body.x - safe.x) < 40, 'and put the hero back on the ledge');
}

// ─── turning while attacking ──────────────────────────────────────────────
{
  // facing holds only while a blow lands: the wind-up and recovery turn, so a combo can be swung back the other way
  for (const hero of ['dora', 'enzo']) {
    const g = new BellspireGame(fresh(), {}, 41); g.teleport('gate', 20, 14); quiet(g); run(g, 6); quiet(g);
    if (g.lead !== hero) { g.tryTag(); run(g, 30); quiet(g); }
    run(g, 4, { right: true }); run(g, 2);
    ok(g.body.face === 1, `${hero}: facing right to start`);
    g.step(I({ attack: true }));
    ok(g.leadRt.act?.kind === 'swing', `${hero}: a swing starts`);
    g.step(I({ left: true }));
    ok(g.body.face === -1, `${hero}: ← in the wind-up turns the swing round`);
    const box = (() => { for (let i = 0; i < 12; i++) { const b = g.attackBox(); if (b) return b; g.step(I({ left: true })); } return null; })();
    ok(box && box.r.x + box.r.w <= g.body.x + 0.5, `${hero}: and the cut lands on the left`);
    g.step(I({ right: true }));
    ok(g.body.face === -1, `${hero}: but not while the blade is landing`);
    // keep attacking and hold →: the next cut of the combo turns back to the right
    let turned = false;
    for (let i = 0; i < 60 && !turned; i++) { g.step(I({ attack: i % 4 === 0, right: true })); if (g.leadRt.act?.kind === 'swing' && g.leadRt.act.n > 0 && g.body.face === 1) turned = true; }
    ok(turned, `${hero}: holding → while chaining the combo turns the next cut`);
  }
}

// ─── turning while attacking ──────────────────────────────────────────────
{
  // facing holds only while a blow lands: the wind-up and recovery turn, so a combo can be swung back the other way
  for (const hero of ['dora', 'enzo']) {
    const g = new BellspireGame(fresh(), {}, 41); g.teleport('gate', 20, 14); quiet(g); run(g, 6); quiet(g);
    if (g.lead !== hero) { g.tryTag(); run(g, 30); quiet(g); }
    run(g, 4, { right: true }); run(g, 2);
    ok(g.body.face === 1, `${hero}: facing right to start`);
    g.step(I({ attack: true }));
    ok(g.leadRt.act?.kind === 'swing', `${hero}: a swing starts`);
    g.step(I({ left: true }));
    ok(g.body.face === -1, `${hero}: ← in the wind-up turns the swing round`);
    const box = (() => { for (let i = 0; i < 12; i++) { const b = g.attackBox(); if (b) return b; g.step(I({ left: true })); } return null; })();
    ok(box && box.r.x + box.r.w <= g.body.x + 0.5, `${hero}: and the cut lands on the left`);
    g.step(I({ right: true }));
    ok(g.body.face === -1, `${hero}: but not while the blade is landing`);
    // keep attacking and hold →: the next cut of the combo turns back to the right
    let turned = false;
    for (let i = 0; i < 60 && !turned; i++) { g.step(I({ attack: i % 4 === 0, right: true })); if (g.leadRt.act?.kind === 'swing' && g.leadRt.act.n > 0 && g.body.face === 1) turned = true; }
    ok(turned, `${hero}: holding → while chaining the combo turns the next cut`);
  }
}

// ─── water bells and floats ───────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(['dash']), {}, 5);
  const bell = thing('B', (t, r) => r.id === 'nave');
  eq(g.save.water.halls, 1, 'the Flooded Halls start flooded');
  at(g, bell, -1);
  for (let i = 0; i < 30 && g.save.water.halls === 1; i++) g.step(I({ right: i < 2, attack: i % 6 === 3 }));
  eq(g.save.water.halls, 0, 'hitting the water bell drains the halls');
  ok(/drains/.test(g.toast?.text ?? ''), 'and says so: ' + g.toast?.text);
  ok(g.waterMoving(), 'the water level moves, not jumps');
  for (let i = 0; i < 600 && g.waterMoving(); i++) run(g, 1);
  ok(!g.waterMoving(), 'and settles');
  const jetty = roomById('jetty');
  eq(surfaceRow(jetty, { halls: 0, docks: 1, throne: 1 }), jetty.water[1], 'the docks bell raises the jetty water');
  const g2 = new BellspireGame(fresh(['dash']), {}, 5);
  g2.teleport('jetty', 34, 13); quiet(g2);
  const f0 = g2.floatCache[0].y;
  g2.ringBell('docks', 0, 0);
  for (let i = 0; i < 400; i++) { quiet(g2); g2.step(I()); }
  ok(g2.floatCache[0].y < f0 - 32, `floats rise with the water (${f0} to ${g2.floatCache[0].y})`);
}

// ─── doors, the lantern and ghost-glass ───────────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 5);
  const d = [...INFO.get('landing').doors].find((x) => x.ch === 'd');
  g.teleport('landing', d.c - 150 - 2, d.r - 51 + d.h - 1); quiet(g);
  for (let i = 0; i < 60 && !g.toast; i++) g.step(I({ right: true }));
  eq(g.toast?.text, `${ABILITIES.dash.needs}.`, 'a locked dash door says what it needs');
  ok(!g.doorOpen(d), 'and stays shut');
  g.giveAbility('dash', false);
  for (let i = 0; i < 30; i++) g.step(I({ right: true }));
  ok(g.doorOpen(d), 'with the Reed Dash it opens on touch');
  const hatch = [...INFO.get('well').doors].find((x) => x.ch === 'l');
  ok(hatch, 'the well has a lantern hatch');
  const g2 = new BellspireGame(fresh(['dash', 'lantern']), {}, 5);
  g2.teleport('well', 14, 15); quiet(g2);
  g2.tryTag(); run(g2, 2);
  eq(g2.lead, 'enzo', 'tagging swaps the lead');
  g2.step(I()); g2.step(I({ down: true, cast: true })); run(g2, 30);
  ok(g2.lanternUp, 'Enzo raises the lantern with ↓ + V');
  ok(g2.lanternR > 100, 'and it shines wide');
  for (let i = 0; i < 300 && !g2.doorOpen(hatch); i++) { quiet(g2); g2.step(I({ up: true })); }
  ok(g2.doorOpen(hatch), 'the raised lantern opens the hatch');
  const g3 = new BellspireGame(fresh(['dash']), {}, 5);
  g3.lead = 'enzo';
  g3.step(I({ down: true, cast: true }));
  ok(/Moonwick/.test(g3.toast?.text ?? ''), 'raising the lantern before the Moonwick says why');
  // ghost-glass
  const glass = [];
  for (const info of INFO.values()) { const r = info.room; for (let y = 0; y < r.rows.length; y++) for (let x = 0; x < r.rows[y].length; x++) if (r.rows[y][x] === 'g') glass.push([r.gx * COLS + x, r.gy * ROWS + y, r.id]); }
  ok(glass.length > 10, 'there is ghost-glass');
  const [gc, gr, gid] = glass[0];
  const g4 = new BellspireGame(fresh(['dash', 'lantern']), {}, 5);
  const room = roomById(gid);
  g4.teleport(gid, gc - room.gx * COLS, gr - room.gy * ROWS - 1);
  ok(!g4.solidTile(gc, gr), 'ghost-glass is not solid in the dark');
  g4.lead = 'enzo'; g4.lanternUp = true; g4.lanternR = 118;
  g4.body.x = gc * TILE + 40; g4.body.y = gr * TILE - 30;
  ok(g4.solidTile(gc, gr), 'the raised lantern makes it solid');
  const cdoor = [...INFO.values()].flatMap((i) => i.doors).find((x) => x.ch === 'c');
  const g5 = new BellspireGame(fresh(['dash', 'lantern', 'double', 'wallkick']), {}, 5);
  g5.lead = 'enzo'; g5.step(I({ up: true, cast: true }));
  ok(/Bell Chime/.test(g5.toast?.text ?? ''), 'ringing before learning the Bell Chime says why');
  const g6 = new BellspireGame(fresh(['dash', 'lantern', 'double', 'wallkick', 'chime']), {}, 5);
  g6.save.spells.push('chime');
  const cr = roomOfTile(cdoor.c, cdoor.r);
  g6.teleport(cr.id, Math.max(1, cdoor.c - cr.gx * COLS - 3), cdoor.r - cr.gy * ROWS + cdoor.h - 1);
  quiet(g6); g6.lead = 'enzo'; g6.body.x = cdoor.c * TILE - 30;
  g6.step(I()); g6.step(I({ up: true, cast: true }));
  for (let i = 0; i < 40; i++) { quiet(g6); g6.step(I()); }
  ok(g6.doorOpen(cdoor), 'the Bell Chime opens a bell-sealed door');
  const u = [...INFO.values()].flatMap((i) => i.doors).find((x) => x.ch === 'u');
  const g7 = new BellspireGame(fresh(ABILITY_ORDER), {}, 5);
  ok(!g7.doorOpen(u), 'the throne door is shut');
  g7.setFlag('keeper');
  ok(!g7.doorOpen(u), 'Ukumari alone can’t open it: the four bell seals hold it');
  for (const b of ['frog', 'hydra', 'puma', 'warden']) g7.setFlag(`boss:${b}`);
  ok(g7.doorOpen(u), 'and it opens once Ukumari has the bells and all four guardians are calm');
}

// ─── combat, XP, coins ────────────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 9);
  quiet(g); run(g, 5);
  const b = g.body;
  g.enemies = [{ id: 999, kind: 'imp', x: b.x + 18, y: b.y, vx: 0, vy: 0, hp: 40, max: 40, face: -1, st: 'idle', t: 0, cd: 999, hx: b.x + 18, hy: b.y, flash: 0, hidden: false, alive: true, ground: true, tx: 0, ty: 0, stun: 0 }];
  b.face = 1;
  g.step(I({ attack: true }));
  for (let i = 0; i < 6; i++) g.step(I());
  ok(g.enemies[0].hp < 40, 'a swing hits');
  const hp1 = g.enemies[0].hp;
  for (let i = 0; i < 60; i++) g.step(I({ attack: i % 4 === 0, right: i % 8 < 4 }));
  ok(g.enemies.length === 0 || g.enemies[0].hp < hp1, 'the combo keeps hitting');
  const xp0 = g.save.heroes.dora.xp + g.save.heroes.dora.level * 1000;
  g.enemies = [{ ...{ id: 1000, kind: 'moth', x: b.x + 14, y: b.y, vx: 0, vy: 0, hp: 1, max: 5, face: -1, st: 'idle', t: 0, cd: 999, hx: b.x + 14, hy: b.y, flash: 0, hidden: false, alive: true, ground: false, tx: 0, ty: 0, stun: 0 } }];
  g.damageFoe(g.enemies[0], 5, 1, false);
  ok(g.save.heroes.dora.xp + g.save.heroes.dora.level * 1000 > xp0, 'a defeated foe gives XP to both heroes');
  ok(g.pickups.some((p) => p.kind === 'coin'), 'and drops coins');
  const c0 = g.save.coins;
  for (let i = 0; i < 90; i++) g.step(I());
  ok(g.save.coins > c0, 'coins drift to the hero and are picked up');
  const g2 = new BellspireGame(fresh(), {}, 9);
  const lv = g2.save.heroes.enzo.level;
  g2.gainXp(xpToNext(1) + 1);
  eq(g2.save.heroes.enzo.level, lv + 1, 'enough XP levels a hero up');
  ok(heroStats(g2.save, 'enzo').maxHp > heroStats(freshSave(), 'enzo').maxHp, 'levels raise max HP');
}

// ─── tagging, knock-outs and the coin bag ─────────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 11);
  quiet(g);
  g.tryTag();
  eq(g.lead, 'enzo', 'Shift tags Enzo in');
  g.tryTag();
  eq(g.lead, 'enzo', 'tagging has a short cooldown');
  run(g, TAG_CD + 1);
  g.tryTag();
  eq(g.lead, 'dora', 'and then Dora comes back');
  g.save.coins = 50;
  g.setHp('dora', 0);
  eq(g.lead, 'enzo', 'a knocked-out lead hands over to the partner');
  g.tagCd = 0; g.tryTag();
  ok(/knocked out/.test(g.toast?.text ?? ''), 'tagging a knocked-out partner says why');
  g.teleport('gate', 10, 14); quiet(g);
  const where = { ...g.safe };
  g.setHp('enzo', 0);
  eq(g.save.coins, 0, 'when both are knocked out the coins are dropped');
  ok(g.save.drop && g.save.drop.coins === 50 && Math.abs(g.save.drop.x - where.x) < 1, 'where they fell');
  eq(g.room.id, g.save.shrine, 'and the heroes wake at the shrine');
  ok(!g.save.heroes.dora.down && !g.save.heroes.enzo.down, 'both awake');
  g.teleport('gate', 10, 14); quiet(g);
  for (let i = 0; i < 60 && g.save.drop; i++) g.step(I());
  for (let i = 0; i < 200 && g.save.drop; i++) g.step(I({ left: g.body.x > where.x, right: g.body.x < where.x }));
  eq(g.save.coins, 50, 'walking back picks the bag up');
}

// ─── shrines, travel, gear, the shop and food ─────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 13);
  quiet(g);
  g.save.heroes.dora.hp = 3;
  const s = thing('S', (t, r) => r.id === 'landing');
  at(g, s);
  g.drainEvents();
  g.step(I()); g.step(I({ up: true }));
  const ev = g.drainEvents();
  ok(ev.some((e) => e.k === 'save'), 'resting at a shrine saves');
  eq(g.save.heroes.dora.hp, heroStats(g.save, 'dora').maxHp, 'and heals');
  eq(g.travel('cshrine'), 'Light that shrine first by resting at it.', 'travel to an unlit shrine says why');
  g.setFlag('shrine:cshrine');
  eq(g.travel('cshrine'), null, 'travel to a lit shrine works');
  eq(g.room.id, 'cshrine', 'and arrives there');
  const st = new BellspireGame(fresh(), { strict: true }, 13);
  st.setFlag('shrine:cshrine'); st.teleport('gate', 10, 14);
  ok(/strict/.test(st.travel('cshrine') ?? ''), 'strict mode only travels from a shrine');
  eq(g.equip('enzo', 'weapon', 'bronze-sword'), 'Only Dora can use the Bronze Sword.', 'Enzo can’t use Dora’s sword');
  eq(g.equip('dora', 'ring', 'oak-staff'), 'That doesn’t go there.', 'a staff is not a ring');
  eq(g.equip('dora', 'weapon', null), 'Every hero needs a weapon.', 'a weapon can’t be taken off');
  eq(g.equip('dora', 'ring', 'moon-ring'), 'You don’t have that.', 'gear you don’t own can’t be worn');
  g.save.coins = 5;
  eq(g.buy('reed-ring'), `Not enough coins: it costs ${SHOP.find((x) => x.id === 'reed-ring').price}.`, 'the shop says when coins are short');
  g.save.coins = 500;
  eq(g.buy('reed-ring'), null, 'buying works');
  eq(g.buy('reed-ring'), 'You already have one.', 'gear is bought once');
  eq(g.equip('dora', 'ring', 'reed-ring'), null, 'and can be worn');
  ok(g.perk('dora', 'lucky'), 'with its perk');
  eq(g.equip('enzo', 'ring', 'reed-ring'), null, 'passing a ring to Enzo');
  eq(g.save.equip.dora.ring, null, 'takes it off Dora');
  g.save.heroes.dora.hp = heroStats(g.save, 'dora').maxHp;
  ok(/full HP/.test(g.eat('cake') ?? ''), 'a cake at full HP says why not');
  g.save.heroes.dora.hp = 5;
  eq(g.eat('cake'), null, 'a cake heals');
  ok(g.save.heroes.dora.hp > 5, 'some HP');
  g.save.food.tea = 0;
  ok(/No/.test(g.eat('tea') ?? ''), 'no tea left says so');
  ok(Object.values(GEAR).every((x) => x.icon >= 0 && x.icon < ART.icons[2]), 'every piece of gear has an icon');
}

// ─── a boss, from the door to the reward ──────────────────────────────────
{
  const g = new BellspireGame(fresh(['dash']), {}, 17);
  g.save.heroes.dora.level = 3; g.save.heroes.enzo.level = 3;
  g.fightBoss('frog');
  eq(g.boss?.st, 'wait', 'the frog waits for the heroes to come in');
  const door = INFO.get('idol').doors.find((d) => d.ch === 'b');
  ok(g.doorOpen(door), 'the door is open until the fight starts');
  for (let i = 0; i < 40 && g.boss.st === 'wait'; i++) g.step(I({ left: true }));
  ok(g.boss.st === 'intro', 'walking in starts the fight');
  ok(!g.doorOpen(door), 'and the door shuts');
  g.dialog = null;
  for (let i = 0; i < 400; i++) { g.dialog = null; g.step(I()); }
  ok(g.boss.step >= 2, `the frog cycles its attacks (${g.boss.st}, step ${g.boss.step})`);
  const hp0 = g.boss.hp;
  g.damageBoss(30, g.boss.x, g.boss.y);
  eq(g.boss.hp, hp0 - 30, 'hits hurt it');
  g.damageBoss(9999, g.boss.x, g.boss.y);
  ok(g.boss.calm, 'at zero it calms down');
  ok(!g.doorOpen(door), 'the door stays shut until it has settled');
  for (let i = 0; i < 200 && !g.flag('boss:frog'); i++) { g.dialog = null; g.step(I()); }
  ok(g.flag('boss:frog'), 'then it is done');
  ok(g.has('lantern'), 'the reward: the Moonwick');
  eq(g.save.hearts, 1, 'and a Bell Heart');
  ok(g.doorOpen(door), 'and the door opens');
  eq(heroStats(g.save, 'dora').maxHp, heroStats({ ...g.save, hearts: 0 }, 'dora').maxHp + HEART_HP, 'a heart adds max HP');
  // a wipe in the boss room retries from the door, with nothing lost
  const g2 = new BellspireGame(fresh(['dash']), {}, 17);
  g2.save.coins = 20;
  g2.fightBoss('frog');
  for (let i = 0; i < 40 && g2.boss.st === 'wait'; i++) g2.step(I({ left: true }));
  g2.dialog = null;
  g2.setHp('enzo', 0); g2.setHp('dora', 0);
  eq(g2.room.id, 'idol', 'a wipe in a boss fight retries at the boss door');
  eq(g2.save.coins, 20, 'without dropping coins');
  eq(g2.boss?.hp, BOSSES.frog.hp, 'with the boss healed');
}

// ─── the wisp ─────────────────────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(), { assist: true }, 31);
  quiet(g);
  eq(g.nextGoal()?.room, 'cistern', 'the first goal is the Reed Dash in the cistern');
  // with the helping hand on it is there every tick, with no waiting
  const w0 = new BellspireGame(fresh(), { assist: true }, 31); let every = true;
  for (let i = 0; i < 120; i++) { w0.step(I(i % 40 < 20 ? { right: true } : {})); quiet(w0); if (!w0.wisp.on) every = false; }
  ok(every, 'with the helping hand on, the wisp is there every tick, walking or standing');
  run(g, 90);
  ok(g.wisp.on && g.wisp.tx < g.body.x - 20, 'it floats ahead towards the doorway to the cistern');
  ok(g.wispPath.length >= 1, 'along a path of waypoints');
  // never over a face
  let close = 0;
  for (let i = 0; i < 300; i++) { g.step(I(i % 90 < 45 ? { left: true } : { right: true })); quiet(g); if (Math.hypot(g.wisp.tx - g.body.x, g.wisp.ty - (g.body.y - 30)) < 23.5) close++; }
  eq(close, 0, 'it keeps its distance from the lead’s face');
  // nothing it does changes the game
  const twinA = new BellspireGame(fresh(), { assist: true }, 9), twinB = new BellspireGame(fresh(), { assist: true, wisp: false }, 9);
  for (let i = 0; i < 600; i++) { const inp = I(i % 120 < 60 ? { right: true, jump: i % 30 === 0 } : { left: true }); twinA.step(inp); twinB.step(inp); }
  eq([twinA.body.x, twinA.body.y, twinA.save.coins], [twinB.body.x, twinB.body.y, twinB.save.coins], 'the wisp never changes play');
  const noW = new BellspireGame(fresh(), { assist: true, wisp: false }, 31); quiet(noW); run(noW, 60);
  ok(!noW.wisp.on, 'with the Guiding wisp setting off, no wisp');
  const strict = new BellspireGame(fresh(), { assist: true, strict: true }, 31); quiet(strict); run(strict, 60);
  ok(!strict.wisp.on, 'never in Strict');
  // its flight never passes through stone, in any room, towards any doorway
  let crossings = 0;
  for (const r of ROOMS) {
    const h = new BellspireGame(fresh(ABILITY_ORDER), {}, 31);
    h.teleport(r.id, 2, 2); quiet(h);
    for (const [x0, y0, x1, y1] of [[h.body.x, h.body.y - 20, roomRectOf(r).x + roomRectOf(r).w - 24, roomRectOf(r).y + roomRectOf(r).h - 24]]) {
      const pts = h.flightPath(x0, y0, x1, y1);
      for (let i = 1; i < pts.length; i++) {
        const steps = 8;
        for (let k = 0; k <= steps; k++) {
          const x = pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * k) / steps, y = pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * k) / steps;
          if (h.solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) crossings++;
        }
      }
    }
  }
  eq(crossings, 0, 'the wisp never flies through a wall');
  // a door the heroes can already open (the dash door, with the dash) is a way through for the wisp, not a wall
  const dd = new BellspireGame(fresh(['dash']), {}, 33); dd.teleport('landing', 15, 14); quiet(dd);
  const dashDoor = INFO.get('landing').doors.concat(INFO.get('dgate').doors).find((d) => d.ch === 'd');
  ok(dashDoor && !dd.doorOpen(dashDoor), 'the dash door is still shut');
  dd.nextGoal = () => ({ room: 'dgate', x: roomRectOf(ROOMS.find((r) => r.id === 'dgate')).x + 200, y: roomRectOf(ROOMS.find((r) => r.id === 'dgate')).y + 200 });
  const way = dd.wayToGoal();
  ok(way && way.x !== roomRectOf(ROOMS.find((r) => r.id === 'dgate')).x + 200, 'the wisp heads for the dash door the heroes can open, not through the wall');
  const off = new BellspireGame(fresh(), { assist: false }, 31);
  let ever = false; for (let i = 0; i < 7 * 60; i++) { off.step(I()); quiet(off); if (off.wisp.on) ever = true; }
  ok(!ever, 'with the helping hand off there is never a wisp');
  const late = new BellspireGame(fresh(ABILITY_ORDER), {}, 31);
  for (const id of Object.keys(BOSSES)) late.setFlag(`boss:${id}`);
  late.setFlag('keeper');
  eq(late.nextGoal(), null, 'once everything is done there is nothing left to point at');
  // every ability, but the hydra and the puma skipped: the wisp leads to the nearer one
  const skip = new BellspireGame(fresh(ABILITY_ORDER), {}, 31);
  for (const id of ['frog', 'warden']) skip.setFlag(`boss:${id}`);
  skip.teleport('lagoon', 4, 10); quiet(skip);
  eq(skip.nextGoal()?.room, 'lagoon', 'all abilities but seals missing: the wisp points at the nearest restless guardian');
  skip.teleport(ROOMS.find((r) => r.boss === 'puma').id, 4, 10); quiet(skip);
  eq(skip.nextGoal()?.room, 'puma', 'from the crypt, the puma');
}

// ─── saves ────────────────────────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(['dash']), {}, 19);
  g.save.coins = 77; g.setFlag('chest:gallery:0');
  const raw = JSON.stringify(g.snapshot());
  const back = parseSave(raw);
  eq(back.coins, 77, 'a save round-trips');
  eq(back.abilities, ['dash'], 'with abilities');
  ok(back.flags.includes('chest:gallery:0'), 'and flags');
  eq(parseSave(null), null, 'no save: a new game');
  eq(parseSave('{oops'), null, 'a corrupt save starts fresh');
  eq(parseSave(JSON.stringify({ ...JSON.parse(raw), v: 2 })), null, 'another version is ignored');
  eq(parseSave(JSON.stringify({ ...JSON.parse(raw), shrine: 'nowhere' })), null, 'an unknown shrine is rejected');
  eq(parseSave(JSON.stringify({ ...JSON.parse(raw), abilities: ['fly'] })), null, 'an unknown ability is rejected');
  const bad = JSON.parse(raw); bad.equip.dora.weapon = 'moonsteel';
  eq(parseSave(JSON.stringify(bad)), null, 'wearing gear you don’t own is rejected');
  const bad2 = JSON.parse(raw); bad2.heroes.dora.hp = -5;
  eq(parseSave(JSON.stringify(bad2)), null, 'negative HP is rejected');
  const g2 = new BellspireGame(back, {}, 19);
  eq(g2.room.id, back.shrine, 'a loaded game starts at the last shrine');
}

// ─── determinism and completion ───────────────────────────────────────────
{
  const play = () => {
    const g = new BellspireGame(fresh(['dash']), {}, 23);
    g.teleport('gate', 4, 14);
    for (let i = 0; i < 1500; i++) { g.dialog = null; g.step(I({ right: i % 200 < 150, left: i % 200 >= 150, jump: i % 37 < 10, attack: i % 9 === 0, dash: i % 61 === 0 })); }
    return JSON.stringify([g.body.x, g.body.y, g.save, g.enemies.map((e) => [e.x, e.y, e.hp])]);
  };
  eq(play(), play(), 'the same seed and inputs replay exactly');
  const g = new BellspireGame(fresh(), {}, 29);
  const c = g.completion();
  ok(c.total === COMPLETION.cells + COMPLETION.chests + COMPLETION.pedestals + COMPLETION.murals + COMPLETION.bosses, 'completion counts rooms, chests, pedestals, murals and bosses');
  ok(c.pct < 5, 'a new game has barely started');
  g.unlockMap();
  eq(g.completion().cells, COMPLETION.cells, 'every map cell can be seen');
}

// ─── hitboxes match the art ───────────────────────────────────────────────
{
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // for every foe kind and every frame that shows its body, both ways round, the box you hit is centred on the painted
  // body (within 3 px) and covers 70–110% of its area; touching hurts only well inside it
  let n = 0;
  for (const kind of Object.keys(FOES)) {
    ok(FOE_BODY[kind]?.length > 0, `${kind} has body frames`);
    for (let fr = FOE_BODY[kind][0]; fr < FOE_BODY[kind][0] + 8; fr++) {
      const [x0, y0, x1, y1] = BOXES.foes[fr];
      for (const face of [-1, 1]) {
        const g = new BellspireGame(fresh(), {}, 1);
        const e = { kind, x: 100, y: 200, face };
        const r = foeBox(e, 0.9, fr), c = foeBox(e, 0.72, fr);
        // the painted bounds, where the scene draws them: from (x, y + 1), mirrored when facing right
        const l = face > 0 ? -x1 : x0, rr = face > 0 ? -x0 : x1;
        const art = { x: 100 + l, y: 201 + y0, w: rr - l, h: y1 - y0 };
        const dc = Math.hypot(r.x + r.w / 2 - art.x - art.w / 2, r.y + r.h / 2 - art.y - art.h / 2);
        ok(dc <= 3, `${kind} frame ${fr}: hurtbox centred on the art (${dc.toFixed(1)} px off)`);
        const k = (r.w * r.h) / (art.w * art.h);
        ok(k >= 0.7 && k <= 1.1, `${kind} frame ${fr}: hurtbox is ${(k * 100).toFixed(0)}% of the art`);
        ok(c.w < r.w && c.h < r.h && c.x > r.x && c.y > r.y, `${kind}: the contact box sits inside the hurtbox`);
        void g; n++;
      }
    }
  }
  ok(n >= 160, 'every kind and frame checked');
  // the engine's hitbox follows the frame the scene shows
  const gg = new BellspireGame(fresh(), {}, 2);
  gg.teleport('gate', 8, 8); gg.dialog = null;
  const mo = gg.enemies.find((x) => x.kind === 'moth');
  const seen = new Set();
  for (let i = 0; i < 40; i++) { gg.step(I()); gg.dialog = null; gg.save.heroes.dora.hp = 99; const fr = foeFrame(mo, gg.tick); seen.add(fr); const a = gg.foeRect(mo), b = foeBox(mo, 0.9, fr); ok(a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h, 'the moth’s box is its current frame’s'); }
  ok(seen.size >= 3, 'the moth flaps through its frames');
  // a swing through a moth's painted body hits it
  const g = new BellspireGame(fresh(), {}, 5);
  g.teleport('landing', 8, 14); quiet(g);
  const [x0, y0, x1, y1] = BOXES.foes[FOE_BODY.moth[0]];
  const m = { id: 999, kind: 'moth', x: g.body.x + 18, y: 0, vx: 0, vy: 0, hp: 50, max: 50, face: -1, st: 'idle', t: 0, cd: 99, hx: 0, hy: 0, flash: 0, hidden: false, alive: true, ground: false, tx: 0, ty: 0, stun: 0 };
  m.y = g.body.y - 12 - (y0 + y1) / 2 - 1; // the moth's painted middle at the lead's chest
  void x0; void x1;
  const r = g.foeRect(m), sw = (() => { g.leadRt.act = null; g.startAct('swing', 0); for (let i = 0; i < 30; i++) { const b = g.attackBox(); if (b) return b.r; g.leadRt.act.t++; } return null; })();
  ok(sw && overlap(sw, r), 'a swing at chest height meets a moth drawn there');
}

// ─── ladders: up, out at the top, and down again ──────────────────────────
{
  // the boathouse ladder: column 6, rungs from row 9 (its top, a ledge you can stand on) down to the floor at row 15
  const room = ROOMS.find((r) => r.id === 'boathouse'), X = (room.gx * COLS + 6) * TILE + TILE / 2;
  const TOP = (room.gy * ROWS + 9) * TILE, FLOOR = (room.gy * ROWS + 15) * TILE;
  const bottom = (seed) => { const g = new BellspireGame(fresh(ABILITY_ORDER), {}, seed); g.teleport('boathouse', 6, 14); quiet(g); run(g, 6); quiet(g); g.drainEvents(); return g; };
  const g = bottom(41);
  eq([g.body.x, g.body.y, g.body.ground], [X, FLOOR, true], 'standing at the foot of the ladder');
  let reached = -1, fell = false;
  for (let i = 0; i < 260; i++) {
    g.step(I({ up: true })); quiet(g);
    if (reached < 0 && g.body.ground && g.body.y === TOP) reached = i;
    else if (reached >= 0 && (g.body.y !== TOP || !g.body.ground)) fell = true;
  }
  ok(reached > 0, 'holding ↑ climbs all the way up');
  ok(!fell, 'and the hero stands on the top, without falling back (held ↑ for another three seconds)');
  ok(!g.body.climb && g.body.onOneway, 'standing on the ladder top, off the ladder');
  ok(!g.drainEvents().some((e) => e.k === 'sfx' && e.id === 'land'), 'stepping off the top is no landing thump');
  // the partner climbs the same ladder, in its climbing pose, with the climb cycle turning
  {
    const p = bottom(47);
    const anim = new HeroAnimator(p.lead === 'dora' ? 'enzo' : 'dora');
    let climbed = false; const frames = new Set();
    let fx = p.follower.x, fy = p.follower.y;
    for (let i = 0; i < 300; i++) {
      p.step(I({ up: true })); quiet(p);
      const f = p.follower, vy = f.y - fy; fx = f.x; fy = f.y;
      if (f.climb) {
        climbed = true;
        const out = anim.step({ ground: true, vx: 0, vy, face: f.face, climb: true, swim: false, wade: false, glide: false, wallSlide: false, dash: false, hurt: false, down: false, act: null, castHold: false, lanternUp: false, events: [] });
        if (out.state === 'climb') frames.add(out.frame);
      }
    }
    ok(climbed, 'the partner climbs where the lead climbed');
    ok(frames.size >= 3, `in the climbing pose, with the cycle turning (${[...frames].join(',')})`);
    ok(!p.follower.climb && Math.abs(p.follower.y - TOP) < 2, 'and ends standing on the top too');
  }
  // down again
  let down = false;
  for (let i = 0; i < 260 && !down; i++) { g.step(I({ down: true })); quiet(g); if (g.body.ground && g.body.y === FLOOR) down = true; }
  ok(down, 'from the top, ↓ climbs back down to the floor');
  // off the top sideways onto the ledge
  const s = bottom(42);
  for (let i = 0; i < 200; i++) { s.step(I({ up: true })); quiet(s); }
  const x0 = s.body.x;
  run(s, 20, { right: true }); quiet(s);
  ok(s.body.x > x0 + 10 && s.body.y <= TOP, '→ at the top walks off along the ledge');
  // a jump from halfway up
  const j = bottom(43);
  run(j, 30, { up: true });
  ok(j.body.climb && j.body.y < FLOOR - 20, 'halfway up the ladder');
  j.step(I({ jump: true, right: true }));
  ok(!j.body.climb && j.body.vy < 0, 'jumping off mid-ladder works');
  run(j, 8, { right: true });
  ok(j.body.x > X + 8, 'and carries the hero away from it');
  // a forgiving grab: ↑ a little to one side still takes the ladder
  const o = bottom(44);
  o.body.x = (room.gx * COLS + 7) * TILE + 4; // 4 px into the next column, 12 px from the ladder's middle
  o.step(I({ up: true }));
  ok(o.body.climb, '↑ beside the ladder (within about 6 px of its column) grabs it');
  run(o, 12, { up: true });
  ok(Math.abs(o.body.x - X) < 1.5, 'and the climb eases the hero to its middle');
  const far = bottom(45);
  far.body.x = (room.gx * COLS + 7) * TILE + 9;
  far.step(I({ up: true }));
  ok(!far.body.climb, 'but not from further away');
  // ↑ held in a jump at the ladder grabs it in mid-air
  const air = bottom(46);
  air.body.x = X + 26; run(air, 2);
  air.step(I({ jump: true, left: true }));
  let grabbed = false;
  for (let i = 0; i < 40 && !grabbed; i++) { air.step(I({ jump: true, left: true, up: true })); quiet(air); if (air.body.climb && air.body.y < FLOOR - 4) grabbed = true; }
  ok(grabbed, 'holding ↑ while jumping into a ladder grabs it in mid-air');
}

// ─── the heroes' animation ────────────────────────────────────────────────
{
  const base = { ground: true, vx: 0, vy: 0, face: 1, climb: false, swim: false, wade: false, glide: false, wallSlide: false, dash: false, hurt: false, down: false, act: null, castHold: false, lanternUp: false, events: [] };
  const run = (hero, inputs) => { const a = new HeroAnimator(hero); return inputs.map((i) => a.step({ ...base, ...i, events: i.events ?? [] })); };
  for (const hero of ['dora', 'enzo']) {
    // every state has its own frames, and climbing never borrows the jump pose
    const jump = new Set([...animFrames('rise', hero), ...animFrames('fall', hero), ...animFrames('apex', hero)]);
    ok(animFrames('climb', hero).every((f) => !jump.has(f)), `${hero}: the climb has its own frames, not the jump's`);
    eq(animFrames('climb', hero).length, 4, `${hero}: a four-frame climb`);
    eq(new Set(animFrames('climb', hero)).size, 4, `${hero}: four different climb frames`);
    eq(animFrames('run', hero).length, 6, `${hero}: a six-frame run`);
    eq(animFrames('swim', hero).length, 4, `${hero}: a four-stroke swim`);
    for (const [s, d] of Object.entries(ANIMS)) for (const f of animFrames(s, hero)) ok(f >= 0 && f < ART[hero][2], `${hero} ${s}: frame ${f} is on the strip`);
    // on a ladder: the frame moves only while the hero climbs, and holds when they stop
    const up = run(hero, [{ climb: true, ground: false }, ...Array.from({ length: 40 }, () => ({ climb: true, ground: false, vy: -1.5 }))]);
    eq(up[0].state, 'climbOn', `${hero}: stepping onto a ladder has its own frame`);
    ok(up.slice(8).every((o) => o.state === 'climb'), `${hero}: then climbs`);
    ok(new Set(up.slice(8).map((o) => o.frame)).size === 4, `${hero}: climbing up cycles all four frames`);
    const a = new HeroAnimator(hero);
    for (let i = 0; i < 20; i++) a.step({ ...base, climb: true, ground: false, vy: -1.5 });
    const held = []; for (let i = 0; i < 30; i++) held.push(a.step({ ...base, climb: true, ground: false, vy: 0 }).frame);
    eq(new Set(held).size, 1, `${hero}: holding still on a ladder holds the frame`);
    ok(!jump.has(held[0]), `${hero}: and it is a climbing frame`);
    // off the top: the pull-up
    const top = run(hero, [...Array.from({ length: 10 }, () => ({ climb: true, ground: false, vy: -1.5 })), { ground: true }]);
    eq(top[10].state, 'climbOff', `${hero}: climbing off the top pulls up onto the ledge`);
    eq(top[10].dust, '', `${hero}: with no landing dust`);
    // the run, a skid and a turn
    const r = run(hero, [{}, ...Array.from({ length: 30 }, () => ({ vx: 2.2 })), { vx: 0 }]);
    eq(r[1].state, 'runStart', `${hero}: a start-up before the run`);
    ok(new Set(r.slice(8, 31).map((o) => o.frame)).size === 6, `${hero}: running cycles six frames`);
    eq(r[31].state, 'skid', `${hero}: stopping from a run skids`);
    eq(run(hero, [{ vx: 2 }, { vx: 2 }, { vx: -2 }])[2].state, 'turn', `${hero}: turning round has a frame`);
    // jumping: rise, apex, fall, a landing squash, and a crouch after a long fall
    const j = run(hero, [{}, { ground: false, vy: -4, events: ['jumped'] }, { ground: false, vy: 0 }, { ground: false, vy: 3 }, {}]);
    eq(j.slice(1).map((o) => o.state), ['rise', 'apex', 'fall', 'land'], `${hero}: rise, apex, fall, land`);
    ok(j[1].sy > 1 && j[4].sy < 1, `${hero}: stretched on take-off, squashed on landing`);
    const long = run(hero, [...Array.from({ length: 60 }, () => ({ ground: false, vy: 7 })), {}]);
    eq(long[60].state, 'hardLand', `${hero}: a long fall lands in a crouch`);
    eq(long[60].dust, 'hard', `${hero}: with a burst of dust`);
    // control is never held up: a jump during a landing shows the jump at once
    eq(run(hero, [{ ground: false, vy: 3 }, {}, { ground: false, vy: -4 }])[2].state, 'rise', `${hero}: a jump cuts a landing short`);
    // attacks: three distinct combo cuts, each with a wind-up and a cut
    const sw = (n, t) => run(hero, [{ act: { kind: 'swing', n, t, wind: 3, active: 5 } }])[0].frame;
    const cuts = [0, 1, 2].map((n) => sw(n, 4));
    eq(new Set(cuts).size, 3, `${hero}: three different combo cuts`);
    ok([0, 1, 2].every((n) => sw(n, 0) !== sw(n, 4)), `${hero}: each cut has a wind-up`);
    // water, hurt, knocked out, the tag, and the interactions all have their own pose
    eq(run(hero, [{ swim: true, vx: 1.5 }])[0].state, 'swim', `${hero}: swims`);
    eq(run(hero, [{ swim: true, vy: 2 }])[0].state, 'dive', `${hero}: dives`);
    eq(run(hero, [{ wade: true, vx: 1.5 }, { wade: true, vx: 1.5 }])[1].state, 'wade', `${hero}: wades`);
    for (const [ev, st] of [['rest', 'rest'], ['chest', 'chest'], ['relic', 'relic'], ['ring', 'ring'], ['read', 'read'], ['shop', 'shop'], ['tagOut', 'tagOut'], ['revive', 'revive']])
      eq(run(hero, [{ events: [ev] }])[0].state, st, `${hero}: ${ev} has its pose`);
    // idle: breathing, a blink, and a fidget after five seconds of standing still
    const idle = run(hero, Array.from({ length: 400 }, () => ({})));
    ok(new Set(idle.slice(0, 100).map((o) => o.frame)).size >= 2, `${hero}: idle breathes`);
    ok(idle.some((o) => o.state === 'blink'), `${hero}: and blinks`);
    ok(idle.slice(300).some((o) => o.state === 'fidget'), `${hero}: and fidgets after about five seconds`);
  }
  // which states each hero can be in: the ones the game never puts a hero in have no frames for that hero
  const NEVER = {
    // the lantern and its spells are Enzo's (the Echo Step, Frost Fan and Gale Wave too)
    dora: ['glide', 'cast', 'castWind', 'lanternUp', 'lanternDown', 'chime', 'echo', 'frostWind', 'frost', 'galeWind', 'gale', 'noteHop'],
    // the dash, wall kick, down-thrust and Whirl Slash are Dora's, and so is the Bell Rope (and only she lifts a shield
    // arm to hail: Enzo shelters under the lantern's glow)
    enzo: ['dash', 'wallSlide', 'wallKick', 'thrust', 'whirl', 'ropeThrow', 'ropeSwing', 'ropeRelease', 'shield'],
  };
  // the one deliberate share: a hard landing recovers through the ordinary landing frame
  const SHARED = [['hardLand', 'land']];
  for (const hero of ['dora', 'enzo']) {
    for (const st of NEVER[hero]) eq(animFrames(st, hero), [], `${hero} never enters ${st}, so it has no frames for it`);
    const states = Object.keys(ANIMS).filter((st) => !NEVER[hero].includes(st));
    for (const st of states) ok(animFrames(st, hero).length > 0, `${hero}: ${st} has frames`);
    for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
      const a = states[i], b = states[j];
      if (SHARED.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
      const both = animFrames(a, hero).filter((f) => animFrames(b, hero).includes(f));
      eq(both, [], `${hero}: ${a} and ${b} share no frame`);
    }
    // whatever happens, the animator only picks states the hero has
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const a = new HeroAnimator(hero), seen = new Set(), bad = [];
    const kinds = [null, 'swing', 'thrust', 'whirl', 'cast', 'tagin'], spells = ['bolt', 'ember', 'chime', 'lantern'], evs = ['jumped', 'kicked', 'tagOut', 'rest', 'chest', 'relic', 'ring', 'read', 'shop', 'revive'];
    for (let i = 0; i < 20000; i++) {
      const k = kinds[Math.floor(rnd() * 6)];
      const o = a.step({ ground: rnd() < 0.6, vx: (rnd() - 0.5) * 5, vy: (rnd() - 0.5) * 8, face: rnd() < 0.5 ? 1 : -1, climb: rnd() < 0.1, swim: rnd() < 0.1, wade: rnd() < 0.1,
        glide: rnd() < 0.1, wallSlide: rnd() < 0.1, dash: rnd() < 0.05, hurt: rnd() < 0.02, down: rnd() < 0.01,
        act: k && rnd() < 0.3 ? { kind: k, n: Math.floor(rnd() * 3), t: Math.floor(rnd() * 20), wind: 3, active: 5, spell: spells[Math.floor(rnd() * 4)] } : null,
        castHold: rnd() < 0.05, lanternUp: rnd() < 0.3, events: rnd() < 0.05 ? [evs[Math.floor(rnd() * evs.length)]] : [] });
      seen.add(o.state);
      if (!heroHas(o.state, hero) || !animFrames(o.state, hero).includes(o.frame)) bad.push(`${o.state}:${o.frame}`);
    }
    eq(bad.slice(0, 5), [], `${hero}: 20,000 random ticks only ever show a state the hero has, with that state's own frames`);
    ok(seen.size >= 25, `${hero}: the fuzz reaches most states (${seen.size})`);
  }
  // Enzo's spells each have their pose; a struck bell shows the strike for the rest of that swing
  const cast = (spell, extra = {}) => run('enzo', [{ act: { kind: 'cast', n: 0, t: 2, wind: 0, active: 0, spell }, ...extra }])[0].state;
  eq(cast('bolt'), 'cast', 'the Lantern Bolt: the cast pose');
  eq(cast('chime'), 'chime', 'the Bell Chime: the staff struck down');
  eq(cast('lantern', { lanternUp: true }), 'lanternUp', 'raising the lantern');
  eq(cast('lantern', { lanternUp: false }), 'lanternDown', 'lowering the lantern');
  for (const hero of ['dora', 'enzo']) {
    const sw = (t, ev = []) => ({ act: { kind: 'swing', n: 0, t, wind: 3, active: 5 }, events: ev });
    const r = run(hero, [sw(3), sw(4, ['ring']), ...Array.from({ length: 8 }, (_, k) => sw(5 + k)), sw(0)]);
    ok(r.slice(1, 10).every((o) => o.state === 'ring'), `${hero}: a swing that strikes a bell shows the bell strike`);
    eq(r[10].state, 'swing', `${hero}: and the next swing shows at once`);
    ok(r[1].frame !== r[8].frame, `${hero}: the strike has a raise and a hit`);
  }
  eq(run('dora', [{ ground: false, wallSlide: true, vy: 1 }])[0].state, 'wallSlide', 'Dora slides down walls');
  eq(run('enzo', [{ ground: false, wallSlide: true, vy: 2 }])[0].state, 'fall', 'Enzo has no wall slide (the Wall Kick is Dora’s)');
  eq(run('dora', [{ ground: false, glide: true, vy: 0.5 }])[0].state, 'apex', 'Dora has no glide (the lantern is Enzo’s)');
  eq(run('dora', [{ swim: true }])[0].state, 'tread', 'treading water');
  ok(!animFrames('swim', 'dora').some((f) => animFrames('tread', 'dora').includes(f)), 'treading water is upright, not the swim stroke');
  eq(run('enzo', [{ ground: false, glide: true, vy: 0.5 }])[0].state, 'glide', 'Enzo glides with the lantern open');
}

// ─── gear really does what it says ────────────────────────────────────────
{
  const ALL = Object.keys(GEAR);
  const dressed = (equip = {}, seed = 51, abilities = ABILITY_ORDER) => {
    const g = new BellspireGame(fresh(abilities, { gear: [...ALL] }), {}, seed);
    for (const [k, id] of Object.entries(equip)) { const [h, slot] = k.split('.'); eq(g.equip(h, slot, id), null, `equip ${id}`); }
    return g;
  };
  // a swing at a frog standing right in front of Dora: how much it takes
  const hit = (weapon) => {
    const g = dressed({ 'dora.weapon': weapon });
    g.teleport('gate', 18, 14); g.dialog = null; run(g, 4); g.dialog = null;
    const f = g.enemies.find((e) => e.kind === 'frog');
    g.enemies = [f]; f.hp = 999; f.x = g.body.x + 20; f.y = g.body.y; f.st = 'idle'; g.body.face = 1;
    g.step(I({ attack: true })); run(g, 14); g.dialog = null;
    return 999 - f.hp;
  };
  const bronze = hit('bronze-sword'), cutter = hit('reed-cutter'), moon = hit('moonsteel');
  ok(cutter > bronze && moon > cutter, `swings hit harder with better blades (${bronze}, ${cutter}, ${moon})`);
  // the box a swing hits with: the Moonsteel reaches further; the Reed-Cutter's swing is over sooner
  const swingBox = (weapon) => {
    const g = dressed({ 'dora.weapon': weapon }); g.teleport('gate', 4, 14); quiet(g); run(g, 4);
    g.step(I({ attack: true })); let w = 0;
    for (let i = 0; i < 30; i++) { const b = g.attackBox(); if (b) w = Math.max(w, b.r.w); g.step(I()); }
    const g2 = dressed({ 'dora.weapon': weapon }); g2.teleport('gate', 4, 14); quiet(g2); run(g2, 4); g2.step(I({ attack: true }));
    return { w, dur: g2.leadRt.act.dur };
  };
  const sb = swingBox('bronze-sword'), sm = swingBox('moonsteel'), sc = swingBox('reed-cutter');
  ok(sm.w > sb.w, `the Moonsteel reaches further (${sb.w} → ${sm.w})`);
  ok(sc.dur < sb.dur, `the Reed-Cutter's swing is over sooner (${sb.dur} → ${sc.dur} ticks)`);
  // the Frog Ring: ten more HP, which the HUD reads from the same stats
  const fr = dressed({ 'dora.ring': 'frog-ring' }), plain = dressed();
  eq(fr.stats('dora').maxHp, plain.stats('dora').maxHp + 10, 'the Frog Ring adds 10 HP');
  eq(heroStats(fr.save, 'dora').maxHp, fr.stats('dora').maxHp, 'and the HUD’s numbers agree');
  // the Snail-Shell Coat: hits don't knock the wearer back
  const knock = (coat) => { const g = dressed({ 'dora.coat': coat }); g.teleport('gate', 10, 14); quiet(g); run(g, 4); g.leadRt.inv = 0; g.hurtLead(5, g.body.x + 10); return g.body.vx; };
  ok(knock('teal-coat') !== 0, 'a hit knocks Dora back');
  eq(knock('snail-coat'), 0, 'not in the Snail-Shell Coat');
  // the Reedweave Coat swims a third faster
  eq(dressed({ 'dora.coat': 'reed-coat' }).caps().swimMul, 1.3, 'the Reedweave Coat swims faster');
  eq(dressed().caps().swimMul, 1, 'than the teal coat');
  // the Moon Ring: MP comes back faster
  const mpBack = (ring) => { const g = dressed(ring ? { 'enzo.ring': ring } : {}); g.teleport('gate', 10, 14); quiet(g); g.save.heroes.enzo.mp = 0; for (let i = 0; i < 900; i++) { g.step(I()); quiet(g); } return g.save.heroes.enzo.mp; };
  const m0 = mpBack(null), m1 = mpBack('moon-ring');
  ok(m1 > m0, `the Moon Ring brings MP back faster (${m0} → ${m1} in 15 s)`);
  // the Lucky Reed Ring: a quarter more coins
  const coins = (ring) => { const g = dressed(ring ? { 'dora.ring': ring } : {}); g.drainEvents(); g.dropCoins(0, 0, 8); return g.drainEvents().find((e) => e.k === 'num' && e.kind === 'coin').n; };
  eq([coins(null), coins('reed-ring')], [8, 10], 'the Lucky Reed Ring adds a quarter more coins');
  // the Bell Staff: a cheaper Bell Chime
  const chime = (weapon) => { const g = dressed({ 'enzo.weapon': weapon }); g.save.spells.push('chime'); g.teleport('gate', 10, 14); quiet(g); g.lead = 'enzo'; const mp = (g.save.heroes.enzo.mp = 30); g.castChime(); return mp - g.save.heroes.enzo.mp; };
  ok(chime('bell-staff') === chime('oak-staff') - 2, 'the Bell Staff makes the Chime cost 2 less MP');
  // the Star Lamp: a bigger lantern light
  const lamp = (weapon) => { const g = dressed({ 'enzo.weapon': weapon }); g.teleport('gate', 10, 14); quiet(g); g.lanternUp = true; for (let i = 0; i < 120; i++) { g.step(I()); quiet(g); g.lanternUp = true; } return g.lanternR; };
  ok(lamp('star-lamp') > lamp('oak-staff') * 1.3, 'the Star Lamp lights a much bigger circle');
  // the Puma Tooth: some hits land twice as hard, and say so
  const pt = dressed({ 'dora.relic': 'puma-tooth' }); let crits = 0;
  pt.teleport('gate', 18, 14); pt.dialog = null; run(pt, 4);
  for (let k = 0; k < 40; k++) {
    pt.dialog = null; const f = pt.enemies.find((e) => e.kind === 'frog') ?? pt.enemies[0];
    if (!f) break;
    pt.enemies = [f]; f.alive = true; f.hp = 999; f.x = pt.body.x + 20; f.y = pt.body.y; f.st = 'idle'; pt.body.face = 1; pt.leadRt.inv = 99;
    pt.drainEvents(); pt.step(I({ attack: true })); run(pt, 24);
    if (pt.drainEvents().some((e) => e.k === 'crit')) crits++;
  }
  ok(crits > 0 && crits < 30, `the Puma Tooth lands some hits twice as hard, and flags them (${crits} of 40)`);
}

// ─── doorways on the map ──────────────────────────────────────────────────
{
  // the exit list matches the map's real open edges: for every pair of neighbouring cells in different rooms, an exit
  // exists exactly when some border tile is open on both sides
  const open = (c, r) => !'#^'.includes(rawChar(c, r));
  let bad = 0, checked = 0;
  for (const room of ROOMS) for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    const cx = room.gx + x, cy = room.gy + y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = roomOfTile((cx + dx) * COLS, (cy + dy) * ROWS);
      if (!n || n.id === room.id) continue;
      let any = false;
      for (let i = 0; i < (dx ? ROWS : COLS); i++) {
        const [a, b, c, d] = dx ? [cx * COLS + (dx > 0 ? COLS - 1 : 0), cy * ROWS + i, cx * COLS + (dx > 0 ? COLS : -1), cy * ROWS + i] : [cx * COLS + i, cy * ROWS + (dy > 0 ? ROWS - 1 : 0), cx * COLS + i, cy * ROWS + (dy > 0 ? ROWS : -1)];
        if (open(a, b) && open(c, d)) any = true;
      }
      const has = MAP_EXITS.some((e) => e.cx === cx && e.cy === cy && e.dx === dx && e.dy === dy);
      checked++; if (has !== any) bad++;
    }
  }
  eq(bad, 0, `every exit on the map is a real open edge, and every open edge has one (${checked} edges)`);
  // they come in pairs: a way out of one room is a way into the next
  ok(MAP_EXITS.every((e) => MAP_EXITS.some((o) => o.cx === e.cx + e.dx && o.cy === e.cy + e.dy && o.dx === -e.dx && o.dy === -e.dy)), 'every doorway is drawn from both sides');
  // the landing: its ways out, and the ones into other areas carry that area
  const land = ROOMS.find((r) => r.id === 'landing');
  const out = MAP_EXITS.filter((e) => e.from === 'landing');
  ok(out.length >= 2, `the landing has its doorways (${out.map((e) => e.to).join(', ')})`);
  ok(MAP_EXITS.every((e) => e.cross === (e.toArea !== roomById(e.from).area) && e.toArea === roomById(e.to).area), 'an exit into another area carries that area');
  const crossings = MAP_EXITS.filter((e) => e.cross);
  ok(['halls', 'docks', 'towers', 'crypt', 'throne'].every((a) => crossings.some((e) => e.toArea === a && roomById(e.from).area === 'hub' || e.toArea === a)), 'every area has an entrance from somewhere else');
  void land;
  // gated exits know their door: the throne door, and the ability doors
  const u = MAP_EXITS.find((e) => e.door?.ch === 'u');
  ok(u && u.toArea === 'throne' || u && roomById(u.from).area === 'throne', 'the throne door sits on a doorway into the Sunken Throne');
  ok(['d', 'j', 'k', 'c'].some((ch) => MAP_EXITS.some((e) => e.door?.ch === ch)), 'ability doors sit on their doorways');
  ok(MAP_EXITS.some((e) => e.dy !== 0), 'shafts up and down are doorways too');
}

// ─── the throne's four bell seals ─────────────────────────────────────────
{
  const G4 = ['frog', 'hydra', 'puma', 'warden'];
  const NAMES = { frog: 'the Grand Frog Idol in the Flooded Halls', hydra: 'the Reed Hydra in the Reed Docks', puma: 'the Puma of the Murals in the Crypt Murals', warden: 'the Bell Warden in the Bell Towers' };
  const u = [...INFO.values()].flatMap((i) => i.doors).find((x) => x.ch === 'u');
  const keeperRoom = ROOMS.find((r) => INFO.get(r.id).things.some((t) => t.ch === 'U'));
  const ukT = INFO.get(keeperRoom.id).things.find((t) => t.ch === 'U');
  const talk = (g) => {
    g.teleport(keeperRoom.id, ukT.c - keeperRoom.gx * COLS, ukT.r - keeperRoom.gy * ROWS);
    for (let i = 0; i < 5; i++) { g.dialog = null; g.step(I()); }
    g.step(I({ up: true })); const lines = [];
    for (let i = 0; i < 400 && g.dialog; i++) { lines.push(g.dialog.lines[g.dialog.i].text); g.step(I({ jump: i % 2 === 0 })); }
    return [...new Set(lines)].join(' ');
  };
  for (let n = 0; n <= 4; n++) {
    const calm = G4.slice(0, n), miss = G4.slice(n);
    const g = new BellspireGame(fresh(ABILITY_ORDER), {}, 70 + n);
    for (const b of calm) g.setFlag(`boss:${b}`);
    const said = talk(g);
    if (n < 4) {
      ok(!g.flag('keeper') && !g.doorOpen(u), `${n} of 4 guardians calm: Ukumari doesn't open the door`);
      ok(miss.every((b) => said.includes(NAMES[b])) && calm.every((b) => !said.includes(NAMES[b])), `and names exactly the restless ones (${miss.join(', ')}): “${said.slice(-260)}”`);
      ok(!/\b(he|she|his|her)\b/i.test(said.replace(/Be gentle with her/, '')), 'without he or she');
    } else ok(g.flag('keeper') && g.doorOpen(u), 'all four calm: Ukumari opens the throne door');
  }
  // the locked-door hint lists the missing guardians
  const h = new BellspireGame(fresh(ABILITY_ORDER), {}, 80); h.setFlag('boss:frog'); h.setFlag('boss:puma'); h.lockedDoor(u);
  ok(/1 of 4|2 of 4/.test(h.toast.text) && h.toast.text.includes(NAMES.hydra) && h.toast.text.includes(NAMES.warden) && !h.toast.text.includes(NAMES.frog), `the door's hint names the missing guardians (“${h.toast.text}”)`);
  // the door is solid until it opens
  const s = new BellspireGame(fresh(ABILITY_ORDER), {}, 81); s.setFlag('keeper');
  ok(s.env.solid(u.c, u.r), 'the throne door is solid while seals are shut');
  for (const b of G4) s.setFlag(`boss:${b}`);
  ok(!s.env.solid(u.c, u.r), 'and open once all four are calm');
  // calming a guardian lights a seal, with a word
  const c = new BellspireGame(fresh(ABILITY_ORDER), {}, 82); c.setFlag('boss:frog'); c.setFlag('boss:warden');
  c.boss = { id: 'hydra', x: 100, y: 100 }; c.drainEvents(); c.bossDone();
  eq(c.toast.text, 'The Reed Docks bell is quiet. 3 of 4 seals open.', 'calming the hydra opens its seal');
  ok(c.drainEvents().some((e) => e.k === 'seal' && e.n === 3), 'and the door hears it');
  // old saves: Ukumari opened the door before the guardians were calm: the seals lock it again, unless the story is over
  const old = freshSave(); old.flags.push('keeper', 'boss:frog');
  ok(!new BellspireGame(old).flag('keeper'), 'an old save with a guardian skipped has the throne locked again');
  const done = freshSave(); done.flags.push('keeper', 'boss:frog', 'ending');
  ok(new BellspireGame(done).flag('keeper'), 'but a finished story is left alone');
}

// ─── after the Lake Mother: the epilogue the moment everything is found ────
{
  // a save that has seen and found everything except one chest, with the Lake Mother calm and the ending stripped
  // ("Keep exploring")
  const allDone = () => {
    const sv = fresh(ABILITY_ORDER);
    sv.seen = []; for (const r of ROOMS) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) sv.seen.push(`${r.gx + x},${r.gy + y}`);
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') sv.flags.push(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < 10; i++) sv.flags.push(`mural:${i}`);
    for (const b of Object.keys(BOSSES)) sv.flags.push(`boss:${b}`);
    sv.flags.push('keeper');
    return sv;
  };
  const sv = allDone(); const lastChest = sv.flags.find((f) => f.startsWith('chest:')); sv.flags = sv.flags.filter((f) => f !== lastChest);
  const g = new BellspireGame(sv, {}, 90); quiet(g);
  ok(g.completion().pct < 100, `one chest short: ${g.completion().pct}%`);
  const ends = []; const drain = () => { for (const e of g.drainEvents()) if (e.k === 'ending') ends.push(e); };
  for (let i = 0; i < 120; i++) { g.step(I()); drain(); }
  eq(ends.length, 0, 'under 100% after the Lake Mother: no ending yet');
  ok(!g.wisp.on && !g.wispOn(), 'and after the Lake Mother the wisp rests');
  g.setFlag(lastChest);
  for (let i = 0; i < 400; i++) { g.step(I({ jump: i % 2 === 0 })); drain(); }
  eq(ends.map((e) => e.full), [true], 'the last thing found: the ending with the epilogue, once');
  ok(g.flag('epilogue') && g.flag('ending'), 'and the epilogue is remembered');
  // keep exploring again: it never fires twice
  const again = g.snapshot(); again.flags = again.flags.filter((f) => f !== 'ending');
  const g2 = new BellspireGame(again, {}, 91); quiet(g2); let twice = 0;
  for (let i = 0; i < 300; i++) { g2.step(I({ jump: i % 2 === 0 })); for (const e of g2.drainEvents()) if (e.k === 'ending') twice++; }
  eq(twice, 0, 'the epilogue plays only once');
  // calming the Lake Mother with everything found: the epilogue straight away
  const full = allDone(); full.flags = full.flags.filter((f) => f !== 'boss:mother');
  const g3 = new BellspireGame(full, {}, 92); g3.setFlag('boss:mother'); g3.drainEvents(); g3.finish();
  ok(g3.drainEvents().some((e) => e.k === 'ending' && e.full) && g3.flag('epilogue'), 'calming the Lake Mother at 100% plays the epilogue');
  // the seal re-lock leaves a finished story alone even after Keep exploring
  const post = freshSave(); post.flags.push('keeper', 'boss:mother', 'boss:frog');
  ok(new BellspireGame(post).flag('keeper'), 'after the Lake Mother (ending stripped by Keep exploring) the throne stays open');
  // the Lake Mother doesn't come back
  const room = ROOMS.find((r) => r.boss === 'mother');
  const g4 = new BellspireGame(allDone(), {}, 93); g4.teleport(room.id, 6, 12); quiet(g4); run(g4, 60);
  ok(!g4.boss, 'revisiting the throne after the ending: no Lake Mother, the arena is quiet');
}

// ─── shrine travel ────────────────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 21);
  quiet(g);
  const s = thing('S', (t, r) => r.id === 'landing');
  at(g, s); g.drainEvents();
  // ↑ at a lit shrine rests, as always
  g.step(I()); g.step(I({ up: true }));
  ok(g.drainEvents().some((e) => e.k === 'save'), '↑ at a shrine rests');
  g.setFlag('shrine:chapel');
  // attack at the shrine, nothing awake nearby: the map opens for travel instead of a swing
  g.step(I()); g.step(I({ attack: true }));
  const ev = g.drainEvents();
  ok(ev.some((e) => e.k === 'travelOpen' && e.id === 'landing'), 'attack at a lit shrine opens travel');
  ok(!g.leadRt.act, 'and does not swing');
  g.step(I()); g.step(I({ up: true }));
  ok(!g.drainEvents().some((e) => e.k === 'travelOpen'), '↑ never opens travel');
  // with an awake foe close by, attack is a swing, so a fight at a shrine still works
  const fz = new BellspireGame(fresh(), {}, 26); quiet(fz); at(fz, s); fz.drainEvents();
  const foe = fz.enemies[0] ?? null;
  if (foe) { foe.alive = true; foe.hidden = false; foe.st = 'idle'; foe.x = fz.body.x + 40; foe.y = fz.body.y; }
  else { const src = new BellspireGame(fresh(), {}, 28); src.teleport('gate', 20, 14); const f2 = src.enemies.find((x) => x.kind === 'frog'); fz.enemies.push({ ...f2, st: 'idle', x: fz.body.x + 40, y: fz.body.y }); }
  fz.step(I()); fz.step(I({ attack: true }));
  ok(!fz.drainEvents().some((e) => e.k === 'travelOpen'), 'attack near an awake foe does not open travel');
  ok(fz.leadRt.act && fz.leadRt.act.kind === 'swing', 'it swings');
  // in the air, it swings too
  const air = new BellspireGame(fresh(), {}, 27); quiet(air); at(air, s); air.drainEvents();
  air.step(I({ jump: true })); air.step(I({ jump: true })); air.step(I({ attack: true }));
  ok(!air.drainEvents().some((e) => e.k === 'travelOpen'), 'attack in the air at a shrine swings');
  eq(g.whyNotTravel('landing'), 'You are here.', 'the shrine you stand at says you are here');
  eq(g.whyNotTravel('cshrine'), 'Light that shrine first by resting at it.', 'an unlit shrine says why');
  g.save.heroes.dora.hp = 5;
  eq(g.travel('chapel'), null, 'travel between lit shrines works');
  eq(g.room.id, 'chapel', 'and arrives');
  eq(g.save.heroes.dora.hp, 5, 'travelling heals nothing');
  const ev2 = g.drainEvents();
  ok(ev2.some((e) => e.k === 'travel' && e.id === 'chapel'), 'the arrival is announced for the animation');
  ok(/Chapel Candle/.test(g.toast?.text ?? ''), 'with the shrine’s name in a toast');
  // a boss fight blocks it
  const b = new BellspireGame(fresh(ABILITY_ORDER), {}, 22); quiet(b);
  b.setFlag('shrine:chapel'); b.fightBoss('frog'); b.boss.st = 'idle';
  ok(/boss fight/.test(b.whyNotTravel('chapel') ?? ''), 'no travel during a guardian fight');
  // strict: only from a shrine; assist: from anywhere
  const st = new BellspireGame(fresh(), { strict: true }, 23); quiet(st);
  st.setFlag('shrine:chapel'); st.teleport('landing', 2, 14);
  ok(/strict/.test(st.travel('chapel') ?? ''), 'strict: not from the far end of the shrine room');
  at(st, s);
  eq(st.travel('chapel'), null, 'strict: from the shrine itself it works');
  const as = new BellspireGame(fresh(), {}, 24); quiet(as);
  as.setFlag('shrine:chapel'); as.teleport('gate', 10, 14);
  eq(as.travel('chapel'), null, 'with the helping hand, travel from anywhere');
  // the tip, the first time a second shrine is lit
  const tip = new BellspireGame(fresh(), {}, 25); quiet(tip);
  tip.teleport('chapel', 4, 14); tip.rest();
  ok(/Shrines are linked: ↑ to rest, X to travel\./.test(tip.toast?.text ?? ''), 'lighting the second shrine explains travel');
}

// ─── numbers that pop off hits ────────────────────────────────────────────
{
  const g = new BellspireGame(fresh(), {}, 31);
  g.teleport('gate', 18, 14); g.dialog = null;
  const e = g.enemies.find((x) => x.kind === 'frog');
  g.drainEvents();
  g.damageFoe(e, 3, 1, false);
  ok(g.drainEvents().some((v) => v.k === 'num' && v.n === 3 && v.kind === 'hit'), 'a hit pops its damage');
  g.damageFoe(e, 4, 1, true);
  ok(g.drainEvents().some((v) => v.k === 'num' && v.kind === 'big'), 'a finisher pops a big number');
  g.damageFoe(e, 50, 1, false, true);
  const ev = g.drainEvents();
  ok(ev.some((v) => v.k === 'num' && v.kind === 'spell'), 'spell damage has its own colour');
  ok(ev.some((v) => v.k === 'num' && v.kind === 'xp') && ev.some((v) => v.k === 'num' && v.kind === 'coin'), 'a calmed foe pops +XP and +coins');
  g.leadRt.inv = 0; g.hurtLead(5, g.body.x + 10);
  ok(g.drainEvents().some((v) => v.k === 'num' && v.kind === 'hurt'), 'the heroes’ hurts pop in red');
  g.save.heroes.dora.hp = 2; g.rest();
  ok(g.drainEvents().some((v) => v.k === 'num' && v.kind === 'heal'), 'resting pops a green heal');
}

checks += belfry();
checks += trials();
checks += strips();
console.log(`bellspire: ${checks} checks passed`);
