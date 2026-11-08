// The Sunken Bellspire: the Foundry Below's checks. The route planner proves the expansion's gates (the seal under the
// throne, the Bell Hammer's cracked glass, Resonance's beam doors and crystal bridges, the deep seal: what each opens,
// what stays shut without it, and that nowhere strands the heroes), then the engine checks every new move and rule:
// molten channels and the Frost Fan, the vents and their slag, the forge heat (and the helping hand's floor under
// it), the Bell Hammer's slam and the bounce plates, Resonance at crystals and prisms, Tupa's recasts, the new foes,
// the three guardians' rules, the endings, saves from before the expansion and the totals.
// Run from tests/bellspire.mjs (after compiling the engine into .checks/).
import assert from 'node:assert/strict';
import {
  BellspireGame, freshSave, parseSave, heroStats, newGamePlusSave, ROOMS, INFO, COLS, ROWS, TILE, COMPLETION, BOSSES, GEAR, NO_INPUT,
  BELFRY_ABILITIES, ABILITY_ORDER, MURALS, SCRIPTS, CHANNELS, FROST_T, FROST_ASSIST, VENT_P, RECAST_PRICE, isFoundryRoom, roomById, groupAt, rawChar,
} from '../.checks/bellspire-game.js';
import { Graph, nodeRoom } from '../.checks/bellspire-nav.js';

const STRICT = { assist: false, strict: true };
export default function foundry() {
  let checks = 0;
  const ok = (c, m) => { assert.ok(c, m); checks++; };
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
  const I = (o = {}) => ({ ...NO_INPUT, ...o });
  const run = (g, n, inp = {}) => { for (let i = 0; i < n; i++) g.step(I(inp)); };
  const quiet = (g) => { g.dialog = null; g.enemies = []; };
  const BELFRY_CALM = ['frog', 'hydra', 'puma', 'warden', 'mother', 'condor', 'clappers', 'tune'];
  /** a save that has finished the Windward Belfry (the Out-of-Tune Bell calm), with `extra` abilities and flags */
  const done = (extra = [], flags = []) => {
    const s = freshSave();
    s.abilities = [...BELFRY_ABILITIES, ...extra];
    s.spells = ['whirl', 'bolt', 'ember', 'chime', 'frost', 'gale'];
    s.flags.push('keeper', 'belfry:visited', ...BELFRY_CALM.map((b) => `boss:${b}`), ...Object.keys(SCRIPTS).map((k) => `script:${k}`), ...flags);
    for (const h of ['dora', 'enzo']) s.heroes[h].level = 13;
    return s;
  };
  const game = (extra = [], flags = [], settings = {}, seed = 1) => { const g = new BellspireGame(done(extra, flags), settings, seed); quiet(g); return g; };
  const thing = (room, ch, i = 0) => INFO.get(room).things.filter((t) => t.ch === ch)[i];
  const at = (g, room, c, r) => { g.teleport(room, c, r); quiet(g); run(g, 3); quiet(g); };
  const lead = (g, h) => { if (g.lead !== h) { g.tagCd = 0; g.step(I({ tag: true })); run(g, 30); quiet(g); } };

  // ─── the map ──────────────────────────────────────────────────────────────
  const fd = ROOMS.filter((r) => r.fd);
  const screens = fd.reduce((a, r) => a + r.w * r.h, 0);
  ok(screens >= 22 && screens <= 26, `the Foundry Below is 22 to 26 screens (${screens})`);
  ok(fd.every((r) => r.exp && isFoundryRoom(r.id)), 'every foundry room counts as the expansion');
  eq(new Set(fd.map((r) => r.area)), new Set(['cast', 'glass']), 'two new areas: the Casting Halls and the Glasswork Caves');
  eq(fd.flatMap((r) => r.murals ?? []).length, 6, 'six new murals');
  eq(fd.filter((r) => r.boss).map((r) => r.boss).sort(), ['choir', 'founder', 'hollow'], 'three guardians');
  ok(fd.filter((r) => INFO.get(r.id).things.some((t) => t.ch === 'S')).length >= 3, 'three new shrines');
  ok(INFO.get('fgate').things.some((t) => t.ch === 'N'), 'Tupa’s forge by the foundry gate');
  eq(['ingot', 'ember', 'cbat', 'gsnail'].map((k) => fd.some((r) => INFO.get(r.id).things.some((t) => ({ 1: 'ingot', 2: 'ember', 3: 'cbat', 4: 'gsnail' })[t.ch] === k))), [true, true, true, true], 'all four new foes live down there');
  ok(INFO.get('tshrine').doors.some((d) => d.ch === '9'), 'the seal is in the Pearl Throne Candle’s floor');
  for (const r of fd) if (r.crystals) eq(r.crystals.length, INFO.get(r.id).things.filter((t) => t.ch === '*').length, `${r.id}: every humming crystal has its bridge`);
  ok(CHANNELS.length >= 3 && CHANNELS.every((q) => isFoundryRoom(q.room)), `molten channels (${CHANNELS.length}), only in the foundry`);

  // ─── the planner: the foundry's gates ─────────────────────────────────────
  const sh = thing('tshrine', 'S');
  const start = { x: sh.c * TILE + 8, y: (sh.r + 1) * TILE };
  const reach = (abilities, calmed = BELFRY_CALM) => {
    const G = new Graph({ abilities, water: { halls: 1, docks: 0, throne: 1 }, keeper: true, calmed, wind: { cloud: 1, loft: 1 } });
    const rooms = new Set(), spots = [];
    for (const k of G.reach([G.nodeAt(start.x, start.y)])) { const n = G.nodes.get(k); rooms.add(nodeRoom(n)?.id); spots.push(n); }
    const near = (t) => spots.some((n) => Math.abs(n.x - (t.c * TILE + 8)) < 18 && Math.abs(n.y - (t.r + 1) * TILE) < 20);
    return { rooms, near, G };
  };
  const before = reach(BELFRY_ABILITIES, BELFRY_CALM.filter((b) => b !== 'tune'));
  ok(fd.every((r) => !before.rooms.has(r.id)), 'before the Out-of-Tune Bell is calm, the seal holds: no foundry room can be reached');
  const r0 = reach(BELFRY_ABILITIES);
  for (const id of ['fgate', 'channel', 'vents', 'anvilhall', 'crucible']) ok(r0.rooms.has(id), `once the seal cracks: the ${id}`);
  ok(r0.near(thing('anvilhall', 'A')), 'the Bell Hammer’s pedestal can be reached with the belfry’s abilities');
  ok(r0.near(thing('fgate', 'N')), 'and Tupa');
  ok(!r0.rooms.has('founder'), 'without the Bell Hammer, the crucible’s cracked glass keeps the Molten Founder shut away');
  ok(!r0.near(thing('anvilhall', 'C', 1)), 'and the glass box’s chest in the anvil hall');
  const r1 = reach([...BELFRY_ABILITIES, 'hammer']);
  for (const id of ['founder', 'forgeshrine']) ok(r1.rooms.has(id), `with the Bell Hammer: the ${id}`);
  ok(r1.near(thing('anvilhall', 'C', 1)), 'and the glass box’s chest');
  ok(r1.near(thing('anvilhall', 'C', 0)), 'the heart on the ledge, by the bounce plate');
  for (const id of ['prism', 'glassstair', 'snails', 'caveshrine', 'choir', 'hollow']) ok(!r1.rooms.has(id), `without Resonance the beam doors keep the ${id} shut`);
  const r2 = reach([...BELFRY_ABILITIES, 'hammer', 'resonance'], [...BELFRY_CALM, 'founder']);
  for (const id of ['prism', 'glassstair', 'snails', 'caveshrine', 'choir']) ok(r2.rooms.has(id), `with Resonance: the ${id}`);
  ok(!r2.rooms.has('hollow'), 'the Hollow Bell waits behind the deep seal');
  for (const miss of ['founder', 'choir']) ok(!reach([...BELFRY_ABILITIES, 'hammer', 'resonance'], [...BELFRY_CALM, miss === 'founder' ? 'choir' : 'founder']).rooms.has('hollow'), `without the ${miss} calm, the deep seal holds`);
  const fin = reach([...BELFRY_ABILITIES, 'hammer', 'resonance'], [...BELFRY_CALM, 'founder', 'choir']);
  eq(fd.filter((r) => !fin.rooms.has(r.id)).map((r) => r.id), [], 'with everything, every foundry room can be reached');
  for (const r of fd) for (const t of INFO.get(r.id).things.filter((t) => 'CRSAN*!'.includes(t.ch))) ok(fin.near(t), `${r.id}: its ${t.ch} can be reached`);
  // nowhere to get stuck: from every spot reached there is a way back to a shrine
  for (const [abilities, calmed] of [[BELFRY_ABILITIES, BELFRY_CALM], [[...BELFRY_ABILITIES, 'hammer'], BELFRY_CALM], [[...BELFRY_ABILITIES, 'hammer', 'resonance'], [...BELFRY_CALM, 'founder', 'choir']]]) {
    const { G } = reach(abilities, calmed);
    const R = G.reach([G.nodeAt(start.x, start.y)]);
    const back = new Map();
    for (const k of R) for (const e of G.edges.get(k) ?? []) { if (!back.has(e.to)) back.set(e.to, []); back.get(e.to).push(k); }
    const shrineRooms = new Set(ROOMS.filter((r) => INFO.get(r.id).things.some((t) => t.ch === 'S')).map((r) => r.id));
    const home = [...R].filter((k) => shrineRooms.has(nodeRoom(G.nodes.get(k))?.id));
    const safe = new Set(home), q = [...home];
    while (q.length) { const k = q.pop(); for (const p of back.get(k) ?? []) if (!safe.has(p)) { safe.add(p); q.push(p); } }
    // (the Hollow Bell's pit is a one-way drop into the last fight: its ending takes the heroes home)
    const trapped = [...R].filter((k) => !safe.has(k)).map((k) => nodeRoom(G.nodes.get(k))?.id).filter((id) => id !== 'hollow');
    eq([...new Set(trapped)], [], `no trap with [${abilities.slice(9).join(', ') || 'the belfry’s'}]: every spot can get back to a shrine`);
  }

  // ─── the seal ─────────────────────────────────────────────────────────────
  {
    const seal = INFO.get('tshrine').doors.find((d) => d.ch === '9');
    const s = done(); s.flags = s.flags.filter((f) => f !== 'boss:tune');
    const g = new BellspireGame(s, {}, 1); quiet(g);
    ok(!g.doorOpen(seal), 'the seal is shut while the Out-of-Tune Bell is out of tune');
    g.lockedDoor(seal); ok(/ring true/.test(g.toast?.text ?? ''), 'and says why');
    ok(game().doorOpen(seal), 'and cracked once it is calm');
    // Ukumari hears it crack: at the next rest, once
    const h = new BellspireGame(done([], []), {}, 1);
    h.save.flags = h.save.flags.filter((f) => f !== 'script:foundryCall'); quiet(h);
    at(h, 'tshrine', 11, 14); h.rest();
    ok(h.dialog && h.dialog.lines === SCRIPTS.foundryCall, 'resting after the Bell, Ukumari tells of the seal');
  }

  // ─── molten channels and the Frost Fan ────────────────────────────────────
  {
    const g = game([], [], { assist: false });
    lead(g, 'enzo');
    const q = CHANNELS.find((c) => c.room === 'channel');
    const lr = roomById('channel');
    ok(g.hazardTile(q.c0 + 2, q.r), 'molten bronze burns');
    at(g, 'channel', q.c0 - lr.gx * COLS - 2, 14);
    ok(g.hotChannelNear(5 * TILE) === q, 'standing by it, Enzo is close enough to cool it');
    eq(g.frostHint(), null, 'no frost prompt without the helping hand');
    g.save.heroes.enzo.mp = 99;
    g.step(I({ cast: true })); run(g, 2);
    ok(g.frozen.has(q.id), 'a Frost Fan on the ground cools the channel into a crust');
    ok(!g.hazardTile(q.c0 + 2, q.r), 'and the crust is safe to stand on');
    eq(g.channelState(q), 'crust', 'a cold crust');
    run(g, FROST_T - 100);
    eq(g.channelState(q), 'glow', 'it glows before it melts');
    run(g, 120);
    eq(g.channelState(q), 'hot', 'and then it melts');
    // the helping hand: longer, and never melting under a hero
    const h = game([], [], { assist: true }); lead(h, 'enzo');
    at(h, 'channel', q.c0 - lr.gx * COLS - 2, 14); h.save.heroes.enzo.mp = 99;
    eq(h.frostHint(), { q, ask: 'frost' }, 'with the helping hand, Enzo by hot bronze: “V frost the bronze”');
    const hd = game([], [], { assist: true }); lead(hd, 'dora'); at(hd, 'channel', q.c0 - lr.gx * COLS - 2, 14);
    eq(hd.frostHint()?.ask, 'tag', 'Dora by it: “tag to Enzo to frost”');
    hd.save.heroes.enzo.down = true;
    eq(hd.frostHint(), null, 'not with Enzo knocked out');
    const hf = game([], [], { assist: true }); lead(hf, 'enzo'); at(hf, 'channel', q.c0 - lr.gx * COLS - 12, 14);
    eq(hf.frostHint(), null, 'nothing from well back from the bronze');
    h.step(I({ cast: true })); run(h, 2);
    eq(h.frostHint(), null, 'and none once it is a crust');
    ok(h.frozen.get(q.id) > FROST_T * FROST_ASSIST - 10, 'with the helping hand the crust lasts half as long again');
    h.teleport('channel', q.c0 - lr.gx * COLS + 4, 14); quiet(h);
    run(h, FROST_T * FROST_ASSIST + 60);
    ok(h.frozen.has(q.id), 'and never melts under a hero standing on it');
    // hail shots: a Frost Fan in the air cools a channel it lands on
    const a = game([], [], {}); lead(a, 'enzo'); a.save.heroes.enzo.mp = 99;
    at(a, 'channel', q.c0 - lr.gx * COLS - 1, 14);
    a.step(I({ jump: true })); run(a, 6, { jump: true }); a.step(I({ cast: true, jump: true })); run(a, 40);
    ok(a.frozen.has(q.id), 'hail from the air cools it too');
    // a hot channel under a hero: a hazard (back to safe ground, and a hurt)
    const b = game([], [], STRICT); lead(b, 'dora');
    at(b, 'channel', q.c0 - lr.gx * COLS - 2, 14); const hp = b.leadSave.hp;
    let burnt = false;
    for (let i = 0; i < 60; i++) { b.step(I({ right: true })); b.enemies = []; if (b.leadSave.hp < hp) { burnt = true; break; } }
    run(b, 40); quiet(b);
    ok(burnt && b.body.x < q.c0 * TILE, 'walking into molten bronze hurts and sets the hero back');
  }

  // ─── vents and slag; the forge heat ───────────────────────────────────────
  {
    const g = game([], [], STRICT);
    const cr = roomById('crucible');
    at(g, 'crucible', 30, 14);
    const slag = { c: cr.gx * COLS + 35, r: cr.gy * ROWS + 15 };
    let up = 0, down = 0;
    for (let i = 0; i < VENT_P; i++) { g.step(I()); quiet(g); if (g.hazardTile(slag.c, slag.r)) down++; else up++; }
    ok(up > 100 && down > 100, `slag is hard while the vents puff (${up} ticks) and molten between (${down})`);
    eq(g.ventHint(), null, 'no vent prompt without the helping hand');
    // the helping hand: at the edge of the vents' tunnel, wait for a puff, then go
    const v = game([], [], { assist: true }); at(v, 'vents', 5, 31);
    let waits = 0, goes = 0;
    for (let i = 0; i < VENT_P; i++) { v.step(I()); quiet(v); const h = v.ventHint(); if (h?.ask === 'wait') waits++; if (h?.ask === 'go') goes++; ok(!h || (h.ask === 'go') === v.ventUp(), 'the prompt follows the puffs'); }
    ok(waits > 0 && goes > 0, `by the slag: “Wait for the vents to puff”, then “Mist! Hop across the slag” (${waits}/${goes})`);
    const vf = game([], [], { assist: true }); at(vf, 'vents', 20, 20);
    eq(vf.ventHint(), null, 'none up in the cavern, away from the slag');
    // heat: in a hot zone it builds; full, it burns; with the helping hand it never knocks a hero out
    const hot = (settings) => {
      const h = game([], [], settings); at(h, 'crucible', 20, 14);
      h.teleport('crucible', 10, 14); quiet(h);
      for (let i = 0; i < 60 * 60 && h.heat < 100; i++) { h.step(I()); h.enemies = []; }
      return h;
    };
    const s = hot(STRICT);
    eq(Math.round(s.heat), 100, 'standing in the crucible’s heat fills the gauge');
    s.setHp(s.lead, 3); run(s, 70); quiet(s);
    ok(s.save.heroes.dora.down || s.lead === 'enzo', 'full, in Strict, it can knock a hero out');
    const c = hot({ assist: true });
    c.setHp(c.lead, 3); for (let i = 0; i < 400; i++) { c.step(I()); c.enemies = []; }
    ok(!c.save.heroes[c.lead].down && c.leadSave.hp >= 1, 'with the helping hand it burns, but never knocks a hero out');
    // the cool perk halves it; a vent's mist and a shrine reset it
    const p = game([], [], STRICT); p.save.gear.push('forge-apron'); p.equip('dora', 'coat', 'forge-apron');
    at(p, 'crucible', 10, 14); for (let i = 0; i < 300; i++) { p.step(I()); p.enemies = []; }
    const q2 = game([], [], STRICT); at(q2, 'crucible', 10, 14); for (let i = 0; i < 300; i++) { q2.step(I()); q2.enemies = []; }
    ok(Math.abs(p.heat * 2 - q2.heat) < 2, `the Forge Apron halves the heat (${p.heat.toFixed(1)} against ${q2.heat.toFixed(1)})`);
    q2.teleport('crucible', 35, 14); quiet(q2);
    for (let i = 0; i < VENT_P && q2.heat > 0; i++) { q2.step(I()); q2.enemies = []; }
    eq(q2.heat, 0, 'a vent’s mist cools the heroes at once');
    const r = game(); at(r, 'forgeshrine', 6, 14); r.heat = 80; r.rest(); eq(r.heat, 0, 'and so does a shrine');
  }

  // ─── the Bell Hammer and the bounce plates ────────────────────────────────
  {
    const g = game(['hammer'], [], STRICT); lead(g, 'dora');
    at(g, 'crucible', 49, 14);
    const glass = groupAt(roomById('crucible').gx * COLS + 49, roomById('crucible').gy * ROWS + 15);
    ok(glass && glass.ch === '8' && !g.doorOpen(glass), 'cracked glass in the crucible floor');
    g.step(I({ jump: true })); run(g, 12, { jump: true });
    g.step(I({ down: true, attack: true })); run(g, 2, { down: true });
    eq(g.hero.dora.act?.kind, 'slam', '↓ + attack in the air with the Bell Hammer is a slam');
    run(g, 60);
    ok(g.doorOpen(glass), 'landing on cracked glass shatters it');
    // a plain jump and a slam off the anvil hall's bounce plate
    const top = (slam) => {
      const h = game(['hammer'], [], STRICT); lead(h, 'dora'); at(h, 'anvilhall', 21, 14);
      h.step(I({ jump: true })); run(h, 14, { jump: true });
      if (slam) { h.step(I({ down: true, attack: true })); run(h, 30, { down: true }); }
      let y = h.body.y; for (let i = 0; i < 90; i++) { h.step(I({ jump: true })); y = Math.min(y, h.body.y); }
      return roomById('anvilhall').gy * ROWS * TILE + 15 * TILE - y;
    };
    const plain = top(false), bounced = top(true);
    ok(bounced > plain + 40, `a slam on a bounce plate springs much higher (${bounced.toFixed(0)}px against a jump's ${plain.toFixed(0)}px)`);
    ok(bounced > 9 * TILE, 'high enough to reach the ledge with the heart');
    // without the hammer, ↓ + attack is still the down-thrust; and Enzo can't slam
    const n = game([], [], STRICT); lead(n, 'dora'); at(n, 'crucible', 20, 14);
    n.step(I({ jump: true })); run(n, 10, { jump: true }); n.step(I({ down: true, attack: true }));
    eq(n.hero.dora.act?.kind, 'thrust', 'without the hammer, the down-thrust as before');
    // a glass snail's shell: half a blow, three times a slam
    const s = game(['hammer'], [], STRICT); s.teleport('snails', 30, 14); s.dialog = null; run(s, 2);
    const sn = s.enemies.find((e) => e.kind === 'gsnail'), hp0 = sn.hp;
    s.damageFoe(sn, 10, 1, false); eq(hp0 - sn.hp, 5, 'a glass snail’s shell takes half a blow');
    s.slamming = true; s.damageFoe(sn, 10, 1, false); s.slamming = false; eq(hp0 - 5 - sn.hp, 30, 'and a slam’s shockwave three times over');
  }

  // ─── Resonance: crystal bridges and beam doors ────────────────────────────
  {
    const g = game(['hammer', 'resonance'], ['boss:founder'], {}); lead(g, 'enzo');
    const pr = roomById('prism'), cry = thing('prism', '*', 0);
    at(g, 'prism', 2, 14); g.save.heroes.enzo.mp = 99;
    g.step(I({ up: true, cast: true })); run(g, 40);
    const slabs = g.notes.filter((n) => n.key.startsWith('prism:x0:'));
    eq(slabs.length, pr.crystals[0].length, 'the chime by a humming crystal lights its whole bridge');
    ok(slabs.every((n) => n.y < (pr.gy * ROWS + 15) * TILE), 'over the lava');
    ok(g.notes.find((n) => n.key === 'prism:x0:0').life >= 600 * 3, 'with the helping hand it stands three times as long');
    void cry;
    // a prism: its beam opens the beam door near it
    const p = game(['hammer', 'resonance'], ['boss:founder'], {}); lead(p, 'enzo');
    const door = INFO.get('crucible').doors.find((d) => d.ch === '&');
    ok(!p.doorOpen(door), 'the crucible’s beam door is shut');
    at(p, 'caveshrine', 4, 14); p.save.heroes.enzo.mp = 99;
    p.step(I({ up: true, cast: true })); run(p, 40);
    ok(p.doorOpen(door), 'the chime by the cave shrine’s prism sends a beam that opens it');
    // without Resonance: nothing, and a word why
    const w = game(['hammer'], [], {}); lead(w, 'enzo'); at(w, 'prism', 2, 14); w.save.heroes.enzo.mp = 99;
    w.step(I({ up: true, cast: true })); run(w, 40);
    eq(w.notes.filter((n) => n.key.includes(':x')).length, 0, 'without Resonance the crystal only hums');
  }

  // ─── Tupa's recasts ───────────────────────────────────────────────────────
  {
    const g = game(); g.save.coins = 500;
    at(g, 'fgate', 18, 14);
    const tupa = thing('fgate', 'N');
    g.teleport('fgate', tupa.c - roomById('fgate').gx * COLS, 14); quiet(g); run(g, 2);
    g.save.flags = g.save.flags.filter((f) => f !== 'script:tupa');
    g.interact(); ok(g.dialog?.lines === SCRIPTS.tupa, 'Tupa introduces themself the first time');
    const then = g.dialog.then; g.dialog = null; then();
    ok(g.drainEvents().some((e) => e.k === 'forge'), 'then opens the forge');
    const before = heroStats(g.save, 'dora');
    eq(g.recast('bronze-sword', 'keen'), null, 'Tupa recasts the bronze sword with a keen edge');
    eq(g.save.coins, 500 - RECAST_PRICE, `for ${RECAST_PRICE} coins`);
    eq(heroStats(g.save, 'dora').atk, before.atk + 3, 'and Dora hits 3 harder');
    ok(heroStats(g.save, 'dora').perks.includes('keen'), 'the perk is hers while she holds it');
    ok(g.whyNotRecast('bronze-sword', 'keen'), 'the same recast again is refused, with a reason');
    g.save.coins = 10; ok(/coins/.test(g.whyNotRecast('bronze-sword', 'tempered')), 'and too few coins says how many more');
    const back = parseSave(JSON.stringify(g.snapshot()));
    eq(back.recast, { 'bronze-sword': 'keen' }, 'recasts are saved');
    const bad = JSON.parse(JSON.stringify(g.snapshot())); bad.recast = { 'bronze-sword': 'nonsense', 'not-owned': 'keen' };
    eq(parseSave(JSON.stringify(bad)).recast, {}, 'a recast of an unknown perk or gear not owned is dropped');
    const old = JSON.parse(JSON.stringify(g.snapshot())); delete old.recast;
    eq(parseSave(JSON.stringify(old)).recast, {}, 'a save from before the foundry loads with no recasts');
    // New Game+ keeps them
    const fin = done(['hammer', 'resonance'], ['boss:founder', 'boss:choir', 'boss:hollow', 'ending']); fin.recast = { 'bronze-sword': 'keen' };
    eq(newGamePlusSave(fin).recast, { 'bronze-sword': 'keen' }, 'New Game+ keeps Tupa’s recasts');
  }

  // ─── the guardians' rules ─────────────────────────────────────────────────
  {
    // the Molten Founder: a blade only bites where Enzo's frost has landed
    const g = game(['hammer'], [], STRICT); g.fightBoss('founder'); quiet(g);
    for (let i = 0; i < 200 && g.boss.st === 'wait'; i++) { g.step(I({ left: true })); quiet(g); }
    for (let i = 0; i < 200 && g.boss.st === 'intro'; i++) { g.step(I()); quiet(g); if (g.dialog) g.dialog = null; }
    const b = g.boss, hp = b.hp;
    g.damageBoss(30, b.x, b.y - 40, false, b.body, 'swing');
    eq(b.hp, hp, 'the founder shrugs off a blade where it isn’t frosted');
    g.damageBoss(20, b.x, b.y - 40, true, b.body, 'hail');
    ok(b.spots.length === 1 && b.hp < hp, 'Enzo’s frost leaves a cold spot');
    const h2 = b.hp; g.damageBoss(30, b.x + 4, b.y - 40, false, b.body, 'swing');
    ok(h2 - b.hp > 30, 'and a blade on the spot bites hard');
    g.save.heroes.enzo.down = true; const h3 = b.hp; g.damageBoss(30, b.x + 80, b.y - 40, false, b.body, 'swing');
    ok(b.hp < h3, 'with Enzo knocked out, every blow counts');
    // the Glass Choir: strike the singers in the order they sang
    const c = game(['hammer', 'resonance'], ['boss:founder'], STRICT); c.fightBoss('choir'); quiet(c);
    for (let i = 0; i < 2000 && c.boss.st !== 'listen'; i++) { c.step(I(c.boss.st === 'wait' ? { left: true } : {})); quiet(c); if (c.dialog) c.dialog = null; }
    eq(c.boss.st, 'listen', 'the choir sings, then listens');
    ok(c.boss.song.length === 3, 'a song of three notes to start');
    const song = [...c.boss.song], part = (i) => c.boss.hurt[i];
    const wrong = (song[0] + 1) % 3, ch0 = c.boss.hp;
    c.damageBoss(10, part(wrong).x, part(wrong).y, false, part(wrong));
    ok(c.boss.hp === ch0 && c.boss.sung === 0 && c.rings.some((r) => !r.friendly), 'out of turn: a sour chord, and the song starts again');
    for (const n of song) c.damageBoss(10, part(n).x, part(n).y, false, part(n));
    eq(c.boss.st, 'stun', 'the whole song rung back stuns it');
    ok(c.boss.hp < ch0 - c.boss.max * 0.15, 'for a good part of its strength');
    // the Hollow Bell: two forms; the lava rises in the second (with the helping hand never over the stone)
    for (const settings of [STRICT, { assist: true }]) {
      const h = game(['hammer', 'resonance'], ['boss:founder', 'boss:choir'], settings); h.fightBoss('hollow'); quiet(h);
      for (let i = 0; i < 400 && (h.boss.st === 'wait' || h.boss.st === 'intro'); i++) { h.step(I({ right: true })); quiet(h); if (h.dialog) h.dialog = null; }
      h.boss.hp = h.boss.max / 2 - 1; h.boss.flash = 0;
      let top = 1e9;
      for (let i = 0; i < 2400; i++) { h.save.heroes.dora.hp = h.save.heroes.enzo.hp = 999; h.step(I()); quiet(h); top = Math.min(top, h.boss.lava); }
      eq(h.boss.form, 2, 'at half strength its shell cracks: the second form');
      const stone = (roomById('hollow').gy * ROWS + 12) * TILE;
      if (settings.assist) ok(top > stone, `with the helping hand the lava never covers the stone (${(top - stone).toFixed(0)}px below it)`);
      else ok(top < stone, 'without it, the lava rises over the stone (to the ledges!)');
    }
  }

  // ─── the endings and the totals ───────────────────────────────────────────
  {
    eq(COMPLETION.bosses, 11, 'eleven guardians in all');
    eq(COMPLETION.murals, MURALS.length, 'every mural counts');
    const g = game(['hammer', 'resonance'], ['boss:founder', 'boss:choir', 'ending', 'belfry:ending', 'epilogue', 'epilogue2']);
    g.setFlag('boss:hollow'); g.drainEvents();
    g.finishFoundry();
    const ev = g.drainEvents().find((e) => e.k === 'ending');
    ok(ev && ev.foundry && !ev.full, 'the Hollow Bell calm: the foundry’s ending (not everything found yet)');
    ok(g.completion().belfry.pct < 100 || g.completion().pct < 100, 'and not 100% yet');
    // everything: the third epilogue
    const e = game(['hammer', 'resonance'], ['boss:founder', 'boss:choir', 'boss:hollow', 'epilogue', 'epilogue2']);
    e.unlockMap();
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') e.setFlag(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < MURALS.length; i++) e.setFlag(`mural:${i}`);
    eq(e.completion().pct, 100, 'with everything found: 100%');
    e.drainEvents(); e.checkEpilogue();
    ok(e.dialog, 'the heroes say so');
    const then = e.dialog.then; e.dialog = null; then();
    ok(e.flag('epilogue3') && e.drainEvents().some((x) => x.k === 'ending' && x.foundry && x.full), 'and the third epilogue plays');
    // the second epilogue no longer needs the foundry
    const b = game([], ['epilogue']);
    b.unlockMap();
    for (const info of INFO.values()) if (!info.room.fd) for (const t of info.things) if (t.ch === 'C') b.setFlag(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < 18; i++) b.setFlag(`mural:${i}`);
    eq(b.completion().belfry.pct, 100, 'the citadel and belfry alone: 100% of them');
    ok(b.completion().pct < 100, 'but not of everything');
    b.drainEvents(); b.checkEpilogue(); ok(b.dialog, 'so the second epilogue plays without the foundry');
    // the wisp leads on into the foundry after the Bell, to the Bell Hammer
    const w = game([], [], { assist: true });
    ok(w.wispOn(), 'the wisp is on after the Bell');
    eq(w.nextGoal()?.room, 'anvilhall', 'and leads to the Bell Hammer');
    const w2 = game(['hammer'], [], { assist: true }); eq(w2.nextGoal()?.room, 'founder', 'then to the Molten Founder');
    const w3 = game(['hammer', 'resonance'], ['boss:founder'], { assist: true }); eq(w3.nextGoal()?.room, 'choir', 'then the Glass Choir');
    const w4 = game(['hammer', 'resonance'], ['boss:founder', 'boss:choir'], { assist: true }); eq(w4.nextGoal()?.room, 'hollow', 'then the Hollow Bell');
    // a save from before the foundry still loads
    const old = JSON.parse(JSON.stringify(done())); delete old.recast;
    const og = new BellspireGame(parseSave(JSON.stringify(old)), {}, 1);
    ok(og.save.recast && og.foundryKnown(), 'a save from before the foundry loads, and the map knows the seal has cracked');
    ok(ABILITY_ORDER.slice(-2).join() === 'hammer,resonance', 'the two new abilities come last');
    void GEAR; void BOSSES; void rawChar;
  }
  return checks;
}
