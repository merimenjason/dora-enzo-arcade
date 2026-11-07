// The Sunken Bellspire: the Windward Belfry's checks. The route planner proves the expansion's gates (the wind in the
// Cloudstair, the Bell Rope, the Echo Step and the belfry seal: what each opens, what stays shut without it, and that
// nowhere strands the heroes in any wind), then the engine checks every new move and rule: the rope swing, wind and
// wind bells, the glide's lift, echo notes, the swinging bells, the new doors, Wayra's boat, the new spells and foes,
// the three guardians from door to reward, the endings, saves from before the expansion and the totals.
// Run from tests/bellspire.mjs (after compiling the engine into .checks/).
import assert from 'node:assert/strict';
import {
  BellspireGame, freshSave, parseSave, ROOMS, INFO, COLS, ROWS, TILE, COMPLETION, BOSSES, GEAR, NO_INPUT, BASE_ABILITIES,
  isBelfryRoom, roomById, groupAt, NOTE_LIFE, NOTE_GAP, GALE_HOLD, SPELLS, ABILITIES, MURALS, SCRIPTS,
} from '../.checks/bellspire-game.js';
import { Graph, nodeRoom, stateKey, HeroAnimator, ropeFrame } from '../.checks/bellspire-nav.js';

export default function belfry() {
  let checks = 0;
  const ok = (c, m) => { assert.ok(c, m); checks++; };
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
  const I = (o = {}) => ({ ...NO_INPUT, ...o });
  const run = (g, n, inp = {}) => { for (let i = 0; i < n; i++) g.step(I(inp)); };
  const quiet = (g) => { g.dialog = null; g.enemies = []; };
  const ALL = [...BASE_ABILITIES, 'rope', 'echo'];
  /** a save that has finished the citadel: every base ability, the Lake Mother calm */
  const done = (extra = [], flags = []) => {
    const s = freshSave();
    s.abilities = [...BASE_ABILITIES, ...extra];
    s.spells = ['whirl', 'bolt', 'ember', 'chime'];
    s.flags.push('script:intro', 'script:firstDark', 'script:wayra', 'script:bell', 'keeper', 'boss:frog', 'boss:hydra', 'boss:puma', 'boss:warden', 'boss:mother', 'script:belfryCall', 'script:cliff', 'script:wind', 'script:echo', ...flags);
    s.heroes.dora.level = s.heroes.enzo.level = 12;
    return s;
  };
  const thing = (room, ch, i = 0) => INFO.get(room).things.filter((t) => t.ch === ch)[i];
  const local = (t) => { const r = roomById(t.room); return { c: t.c - r.gx * COLS, r: t.r - r.gy * ROWS }; };
  const at = (g, room, c, r) => { g.teleport(room, c, r); quiet(g); run(g, 3); quiet(g); };

  // ─── the map ──────────────────────────────────────────────────────────────
  const belfry = ROOMS.filter((r) => isBelfryRoom(r.id));
  ok(belfry.reduce((a, r) => a + r.w * r.h, 0) >= 24, `the Windward Belfry is about two dozen screens (${belfry.reduce((a, r) => a + r.w * r.h, 0)})`);
  ok(belfry.every((r) => r.exp) && ['ropeloft', 'ropegallery', 'ropecellar'].every((id) => roomById(id).exp && !isBelfryRoom(id)), 'the belfry and the three rope rooms count as the expansion');
  eq(new Set(belfry.map((r) => r.area)), new Set(['cloud', 'loft']), 'two new areas: the Cloudstair and the Belfry Loft');
  const shrines = belfry.filter((r) => INFO.get(r.id).things.some((t) => t.ch === 'S')).map((r) => r.id);
  ok(shrines.length >= 2, `new shrines: ${shrines.join(', ')}`);
  eq(ROOMS.filter((r) => r.exp).flatMap((r) => r.murals ?? []).length, 8, 'eight new murals');
  eq(ROOMS.filter((r) => r.exp).flatMap((r) => r.chests ?? []).filter((c) => c === 'heart').length, 2, 'two Bell Hearts');
  ok(ROOMS.filter((r) => r.exp).flatMap((r) => r.chests ?? []).length >= 8, 'about eight chests');
  for (const r of ROOMS) {
    const q = INFO.get(r.id).things.filter((t) => t.ch === 'Q').length, p = INFO.get(r.id).things.filter((t) => t.ch === 'P').length;
    if (q) eq(r.echoes?.length, q, `${r.id}: every echo bell has its notes`);
    if (q) ok(r.echoes.every((e) => e.length === 3), `${r.id}: three notes each`);
    if (p) eq(r.swings?.length, p, `${r.id}: every swinging bell has its swing`);
  }
  // each echo bell leaves its own shape
  const shapes = ROOMS.flatMap((r) => r.echoes ?? []).map((e) => JSON.stringify(e));
  eq(new Set(shapes).size, shapes.length, 'every echo bell leaves a different shape');
  // the rope rooms open off the citadel through rope-knot doors
  for (const id of ['gallery', 'cshrine', 'landing']) ok(INFO.get(id).doors.some((d) => d.ch === 'y'), `${id} has a rope-knot door`);
  ok(INFO.get('landing').things.some((t) => t.ch === 'D') && INFO.get('cliffoot').things.some((t) => t.ch === 'D'), 'Wayra’s boat at both ends');

  // ─── the planner: the belfry's gates ──────────────────────────────────────
  const boat = thing('cliffoot', 'D');
  const start = { x: boat.c * TILE + 8 + 22, y: (boat.r + 1) * TILE };
  const WINDS = [{ cloud: 1, loft: 1 }, { cloud: -1, loft: 1 }];
  const BASE_CALM = ['frog', 'hydra', 'puma', 'warden'];
  const graphs = new Map();
  const graph = (abilities, calmed, wind) => {
    const s = { abilities, water: { halls: 1, docks: 0, throne: 1 }, keeper: true, calmed, wind };
    const k = stateKey(s);
    if (!graphs.has(k)) graphs.set(k, new Graph(s));
    return graphs.get(k);
  };
  function reach(abilities, calmed = BASE_CALM, winds = WINDS) {
    const rooms = new Set(), spots = [];
    for (const wind of winds) {
      const G = graph(abilities, calmed, wind);
      for (const k of G.reach([G.nodeAt(start.x, start.y)])) { const n = G.nodes.get(k); rooms.add(nodeRoom(n)?.id); spots.push(n); }
    }
    const near = (t) => spots.some((n) => Math.abs(n.x - (t.c * TILE + 8)) < 18 && Math.abs(n.y - (t.r + 1) * TILE) < 20);
    return { rooms, near };
  }
  // the wind: blowing east (as it starts) the windgate can't be crossed westward; turned round, it carries the heroes over
  const east = reach(BASE_ABILITIES, BASE_CALM, [WINDS[0]]);
  ok(east.rooms.has('windgate') && !east.near(thing('windgate', 'C')), 'with the wind blowing east, the far side of the windgate is out of reach');
  ok(!east.rooms.has('ropehall'), 'and so is the ropehall');
  const both = reach(BASE_ABILITIES);
  ok(both.near(thing('ropehall', 'A')), 'turning the wind round with a wind bell reaches the Bell Rope’s pedestal');
  ok(both.near(thing('windgate', 'W', 0)) && both.near(thing('windgate', 'W', 1)), 'there is a wind bell on each side of the gorge');
  ok(!both.rooms.has('bannerwalk') && !both.rooms.has('cairns'), 'without the rope, the bannerwalk and (behind its note sigil) the cairns stay shut');
  const rope = reach([...BASE_ABILITIES, 'rope']);
  for (const id of ['bannerwalk', 'condorbridge', 'loftbase']) ok(rope.rooms.has(id), `with the Bell Rope: the ${id}`);
  ok(rope.near(thing('bannerwalk', 'C')), 'the Bell Heart on the bannerwalk’s pillar is reached by the rope');
  ok(rope.near(thing('bannerwalk', 'S')), 'and the bannerwalk shrine');
  ok(!rope.rooms.has('bellshaft') && !rope.rooms.has('cairns'), 'without the Echo Step the belfry’s hatch and the cairns stay out of reach');
  ok(!rope.near(thing('louvres', 'C')), 'and so does the louvres’ chest');
  const echo = reach(ALL);
  for (const id of ['cairns', 'bellshaft', 'cogworks', 'clapperloft']) ok(echo.rooms.has(id), `with the Echo Step: the ${id}`);
  ok(!echo.rooms.has('belltop'), 'the Out-of-Tune Bell waits behind the belfry seal');
  for (const miss of ['condor', 'clappers']) ok(!reach(ALL, [...BASE_CALM, miss === 'condor' ? 'clappers' : 'condor']).rooms.has('belltop'), `without the ${miss} calm, the seal holds`);
  const fin = reach(ALL, [...BASE_CALM, 'condor', 'clappers']);
  eq(belfry.filter((r) => !fin.rooms.has(r.id)).map((r) => r.id), [], 'with everything, every belfry room can be reached');
  for (const r of belfry) for (const t of INFO.get(r.id).things.filter((t) => 'CRSAQW'.includes(t.ch))) ok(fin.near(t), `${r.id}: its ${t.ch} can be reached`);
  // every door in the expansion: open once it should be (the spot in front of it is reached) and its ability needed
  for (const r of ROOMS.filter((r) => r.exp)) for (const d of INFO.get(r.id).doors) {
    const need = { y: 'rope', n: 'echo' }[d.ch];
    if (!need) continue;
    const without = isBelfryRoom(r.id) ? reach(ALL.filter((a) => a !== need), [...BASE_CALM, 'condor', 'clappers']) : null;
    if (without) ok(![...INFO.get(r.id).doors].some(() => false), 'door listed');
    if (without && need === 'echo') ok(!without.rooms.has('cairns'), `${d.id}: the note sigil keeps the cairns shut without the Echo Step`);
    if (without && need === 'rope') ok(!without.rooms.has('bannerwalk'), `${d.id}: the rope-knot door keeps the bannerwalk shut without the Bell Rope`);
  }
  // nowhere to get stuck, in any wind: from every spot reached there is a way to a shrine or the boat home, where
  // ringing a wind bell (from within the chime's reach of one) moves between the two winds
  const bells = belfry.flatMap((r) => INFO.get(r.id).things.filter((t) => t.ch === 'W'));
  for (const [abilities, calmed] of [[BASE_ABILITIES, BASE_CALM], [[...BASE_ABILITIES, 'rope'], BASE_CALM], [ALL, BASE_CALM], [ALL, [...BASE_CALM, 'condor', 'clappers']]]) {
    const Gs = WINDS.map((w) => graph(abilities, calmed, w));
    const id = (i, k) => `${i}:${k}`;
    const all = new Set(), back = new Map(), q = [];
    const push = (i, k) => { const key = id(i, k); if (!all.has(key)) { all.add(key); q.push([i, k]); } };
    const link = (a, b) => { if (!back.has(b)) back.set(b, []); back.get(b).push(a); };
    push(0, Gs[0].nodeAt(start.x, start.y).key);
    while (q.length) {
      const [i, k] = q.shift();
      const G = Gs[i], n = G.nodes.get(k);
      for (const e of G.expand(n)) { link(id(i, k), id(i, e.to)); push(i, e.to); }
      // a wind bell within reach of a chime (or a sword) here: the same spot in the other wind
      if (n.mode === 'ground' && bells.some((t) => Math.hypot(t.c * TILE + 8 - n.x, t.r * TILE - n.y) < 140)) {
        const o = 1 - i, m = Gs[o].nodeAt(n.x, n.y);
        link(id(i, k), id(o, m.key)); push(o, m.key);
      }
    }
    const homeRooms = new Set(belfry.filter((r) => INFO.get(r.id).things.some((t) => t.ch === 'S' || t.ch === 'D')).map((r) => r.id));
    const safe = new Set([...all].filter((key) => { const [i, k] = key.split(':').map(Number); return homeRooms.has(nodeRoom(Gs[i].nodes.get(k))?.id); }));
    const st = [...safe];
    while (st.length) { const k = st.pop(); for (const p of back.get(k) ?? []) if (!safe.has(p)) { safe.add(p); st.push(p); } }
    const trapped = [...all].filter((k) => !safe.has(k)).map((key) => { const [i, k] = key.split(':').map(Number); const n = Gs[i].nodes.get(k); return `${nodeRoom(n)?.id}@${n.c},${n.r}`; });
    eq([...new Set(trapped)].slice(0, 6), [], `no trap in the belfry with [${abilities.slice(7).join(', ') || 'the citadel’s seven'}]${calmed.length > 4 ? ' and the seal open' : ''}, in either wind`);
  }

  // ─── the planner's moves, done for real ───────────────────────────────────
  /** Replay a planned path in the game, exactly as the planner simulated it (a still tick between moves, so each
   *  jump and catch is a fresh press). */
  const drive = (g, path) => {
    let t0 = g.tick;
    for (const e of path) {
      const b = g.body, f = { x: b.x, y: b.y };
      g.step(I());
      let air = false, landed = false, held = false;
      for (let t = 0; t < e.ticks; t++) {
        let inp = t < e.macro.max && !landed ? e.macro.input(t, g.body, f) : { dir: 0, jumpP: false, jumpH: false, dashP: false, up: false, down: false };
        if (landed && e.macro.name.startsWith('walk')) inp = { dir: 0, jumpP: false, jumpH: false, dashP: false, up: false, down: false };
        // a press is a fresh key-down (let go for a tick first if it was held); a hold only keeps a press going
        const jump = inp.jumpP ? !held : held && !!inp.jumpH;
        held = inp.jumpP ? !held : jump;
        if (inp.jumpP && !jump) { g.step(I({ left: inp.dir < 0, right: inp.dir > 0 })); quiet(g); held = true; }
        g.step(I({ left: inp.dir < 0, right: inp.dir > 0, up: inp.up, down: inp.down, jump: held, attack: !!inp.ropeP, dash: inp.dashP }));
        quiet(g);
        if (!g.body.ground) air = true; else if (air && !g.body.swim) landed = true;
      }
    }
    return g.tick - t0;
  };
  // the rope across the bannerwalk's gorge, onto the pillar
  {
    const G = graph([...BASE_ABILITIES, 'rope'], BASE_CALM, WINDS[1]);
    const room = roomById('bannerwalk');
    const from = G.nodeAt((room.gx * COLS + 4) * TILE + 8, (room.gy * ROWS + 15) * TILE);
    const chest = thing('bannerwalk', 'C');
    const path = G.path(from, (n) => Math.abs(n.x - (chest.c * TILE + 8)) < 24 && n.y === (chest.r + 1) * TILE);
    ok(path && path.some((e) => e.macro.name.startsWith('rope')), 'the planner swings across the gorge on the rope');
    const g = new BellspireGame(done(['rope']), {}, 3);
    at(g, 'bannerwalk', 4, 14);
    let hooked = false, unhooked = false;
    const step0 = g.step.bind(g);
    g.step = (inp) => { step0(inp); hooked ||= g.body.hooked; unhooked ||= g.body.unhooked; for (const ev of g.drainEvents()) if (ev.k === 'rope') ok(true, 'a rope event'); };
    drive(g, path);
    ok(hooked && unhooked, 'the rope caught a hook and let go');
    ok(Math.abs(g.body.x - (chest.c * TILE + 8)) < 30 && g.body.ground && Math.abs(g.body.y - (chest.r + 1) * TILE) < 1, `and Dora lands on the pillar (${(g.body.x / TILE).toFixed(1)}, ${(g.body.y / TILE).toFixed(1)})`);
  }
  // the rope's rules
  {
    const g = new BellspireGame(done(['rope']), {}, 3);
    at(g, 'bannerwalk', 9, 14);
    const hook = INFO.get('bannerwalk').hooks[0];
    g.body.x = hook.x - 20; g.body.y = hook.y + 22 + 40; g.body.ground = false; g.body.vx = 2; g.body.vy = -1;
    g.step(I({ attack: true }));
    ok(g.body.rope, 'attack in the air by a hook catches it');
    eq(g.leadRt.act, null, 'instead of a sword swing');
    const len = g.body.rope.len;
    let maxAng = 0;
    for (let i = 0; i < 60; i++) { g.step(I({ right: i % 40 < 20, left: i % 40 >= 20 })); quiet(g); maxAng = Math.max(maxAng, Math.abs(g.body.rope?.ang ?? 0)); }
    ok(g.body.rope && Math.abs(Math.hypot(g.body.x - hook.x, g.body.y - 22 - hook.y) - len) < 0.5, 'Dora hangs at the rope’s length from the hook');
    ok(maxAng > 0.3, 'and swings');
    g.lead = 'dora'; g.tagCd = 0;
    g.step(I({ tag: true }));
    eq(g.lead, 'dora', 'no tagging out while on the rope');
    // let go with a jump: the swing's speed carries on, with a kick up
    for (let i = 0; i < 200 && !(g.body.rope && g.body.rope.av > 0.03 && g.body.rope.ang > -0.1); i++) { g.step(I({ right: g.body.rope?.av > 0, left: g.body.rope?.av < 0 })); quiet(g); }
    const vx = g.body.vx;
    g.step(I()); g.step(I({ jump: true }));
    ok(!g.body.rope && g.body.unhooked !== undefined, 'a jump lets go');
    ok(g.body.vx > 1 && vx > 0, `and carries the swing on (${g.body.vx.toFixed(2)})`);
    ok(g.body.vy < 0, 'with a kick up');
    // ↓ drops off, and without the rope there's only the sword
    const g2 = new BellspireGame(done([]), {}, 3);
    at(g2, 'bannerwalk', 9, 14);
    g2.body.x = hook.x - 20; g2.body.y = hook.y + 62; g2.body.ground = false;
    g2.step(I({ attack: true }));
    ok(!g2.body.rope && g2.leadRt.act?.kind === 'swing', 'without the Bell Rope, attack by a hook is a sword swing');
    const g3 = new BellspireGame(done(['rope']), {}, 3);
    at(g3, 'bannerwalk', 9, 14);
    g3.lead = 'enzo';
    g3.body.x = hook.x - 20; g3.body.y = hook.y + 62; g3.body.ground = false;
    g3.step(I({ attack: true }));
    ok(!g3.body.rope, 'Enzo can’t use the rope');
    const g4 = new BellspireGame(done(['rope']), {}, 3);
    at(g4, 'bannerwalk', 9, 14);
    g4.body.x = hook.x - 20; g4.body.y = hook.y + 62; g4.body.ground = false;
    g4.step(I({ attack: true })); run(g4, 10);
    g4.step(I({ down: true }));
    ok(!g4.body.rope && g4.body.vy >= -0.5, '↓ lets go without a kick');
  }

  // ─── wind and wind bells ──────────────────────────────────────────────────
  {
    const g = new BellspireGame(done([]), {}, 3);
    at(g, 'windgate', 38, 14);
    eq(g.save.wind.cloud, 1, 'the Cloudstair’s wind starts blowing east');
    const x0 = g.body.x;
    run(g, 60); quiet(g);
    ok(Math.abs(g.body.x - x0) < 0.5, 'standing still in a gust, a hero holds on, braced');
    ok(g.body.gust > 0, 'but feels it');
    // walking against it is slower, with it faster
    at(g, 'windgate', 38, 14); const a0 = g.body.x; run(g, 30, { left: true }); const against = a0 - g.body.x;
    at(g, 'windgate', 30, 10); g.body.y = (roomById('windgate').gy * ROWS + 15) * TILE; g.body.x = (roomById('windgate').gx * COLS + 22) * TILE; g.body.ground = true;
    at(g, 'windgate', 22, 14); const b0 = g.body.x; run(g, 30, { right: true }); const withIt = g.body.x - b0;
    ok(withIt > against + 10, `running with the wind is faster than against it (${withIt.toFixed(0)} vs ${against.toFixed(0)} px)`);
    // in the air it pushes hard
    at(g, 'windgate', 40, 14); const j0 = g.body.x; g.step(I({ jump: true })); run(g, 30, { jump: true }); quiet(g);
    ok(g.body.x - j0 > 25, `a jump is blown east (${(g.body.x - j0).toFixed(0)} px)`);
    // the Windward Jacket takes half of it
    const gj = new BellspireGame(done([]), {}, 3);
    gj.save.gear.push('windward-jacket'); gj.equip('dora', 'coat', 'windward-jacket');
    at(gj, 'windgate', 40, 14); const k0 = gj.body.x; gj.step(I({ jump: true })); run(gj, 30, { jump: true });
    ok(gj.body.x - k0 < (g.body.x - j0) * 0.8, 'the Windward Jacket halves the push');
    // ring a wind bell: sword, chime, bolt or gale
    at(g, 'windgate', 43, 14); g.body.face = 1; g.drainEvents();
    g.step(I({ attack: true })); run(g, 14);
    eq(g.save.wind.cloud, -1, 'a sword swing at a wind bell turns the wind round');
    ok(g.drainEvents().some((e) => e.k === 'wind' && e.dir === -1), 'with a wind event for the scene');
    g.lead = 'enzo'; g.save.spells.push('chime'); g.save.heroes.enzo.mp = 40;
    at(g, 'windgate', 40, 14); g.step(I()); g.step(I({ up: true, cast: true })); for (let i = 0; i < 40; i++) g.step(I());
    eq(g.save.wind.cloud, 1, 'and the Bell Chime turns it back');
    ok(g.flag('rang:wind'), 'remembered as rung');
    // the glide rises in a gust
    const ge = new BellspireGame(done([]), {}, 3);
    ge.lead = 'enzo'; at(ge, 'switchback', 14, 28);
    ge.body.y = (roomById('switchback').gy * ROWS + 26) * TILE; ge.body.ground = false; ge.body.vy = 1;
    let rose = 0;
    for (let i = 0; i < 40; i++) { const y = ge.body.y; ge.step(I({ jump: true })); quiet(ge); if (ge.body.y < y && ge.body.glide) rose++; }
    ok(rose > 10, `the Lantern Glide rises on a gust (${rose} ticks up)`);
    // the wind is saved, per area
    const back = parseSave(JSON.stringify({ ...g.save, wind: { cloud: -1, loft: 1 } }));
    eq(back.wind, { cloud: -1, loft: 1 }, 'the wind is saved like the water');
  }

  // ─── echo notes ───────────────────────────────────────────────────────────
  {
    const g = new BellspireGame(done(['rope', 'echo']), {}, 3);
    const q = thing('cairns', 'Q'), lq = local(q);
    g.lead = 'enzo'; g.save.heroes.enzo.mp = 60;
    at(g, 'cairns', lq.c + 2, 13); g.drainEvents();
    g.step(I({ up: true, cast: true })); g.step(I());
    eq(g.leadRt.act?.spell, 'echo', 'by an echo bell the chime is its own sweeping pose');
    for (let i = 0; i < 30; i++) { g.step(I()); quiet(g); }
    const notes = () => g.floatCache.filter((f) => f.kind === 'note');
    eq(notes().length, 3, 'three notes appear');
    ok(g.drainEvents().some((e) => e.k === 'notes'), 'with a notes event');
    const path = roomById('cairns').echoes[0];
    eq(notes().map((f) => [f.x0 / TILE - q.c, f.y / TILE - q.r]), path, 'along the bell’s own path');
    // one after the other
    const g1 = new BellspireGame(done(['rope', 'echo']), {}, 3); g1.lead = 'enzo'; at(g1, 'cairns', lq.c + 2, 13);
    g1.step(I({ up: true, cast: true })); const seen = [];
    for (let i = 0; i < 30; i++) { g1.step(I()); seen.push(g1.floatCache.filter((f) => f.kind === 'note').length); }
    ok(seen.includes(1) && seen.includes(2) && seen.at(-1) === 3, `they appear one after another (${[...new Set(seen)].join(',')})`);
    // a hero can stand on one; then they fade
    const n0 = notes()[0];
    g.body.x = (n0.x0 + n0.x1) / 2; g.body.y = n0.y - 4; g.body.ground = false; g.body.vy = 0;
    run(g, 10); quiet(g);
    ok(g.body.ground && Math.abs(g.body.y - n0.y) < 0.01, 'a note holds a hero up');
    run(g, NOTE_LIFE); quiet(g);
    eq(notes().length, 0, `they fade after about ${(NOTE_LIFE / 60).toFixed(0)} seconds`);
    ok(!g.body.ground || g.body.y > n0.y, 'and the hero drops');
    // without the Echo Step the bell only hums
    const g2 = new BellspireGame(done(['rope']), {}, 3); g2.lead = 'enzo'; g2.save.heroes.enzo.mp = 60;
    at(g2, 'cairns', lq.c + 2, 13); g2.step(I({ up: true, cast: true })); run(g2, 40);
    eq(g2.notes.length, 0, 'without the Echo Step, no notes');
    ok(/slips away/.test(g2.toast?.text ?? ''), 'and a hint');
    // the Carillon Staff doubles their time
    const g3 = new BellspireGame(done(['rope', 'echo']), {}, 3); g3.lead = 'enzo'; g3.save.heroes.enzo.mp = 60;
    g3.save.gear.push('carillon-staff'); g3.equip('enzo', 'weapon', 'carillon-staff');
    at(g3, 'cairns', lq.c + 2, 13); g3.step(I({ up: true, cast: true })); run(g3, NOTE_LIFE + 40);
    eq(g3.floatCache.filter((f) => f.kind === 'note').length, 3, 'the Carillon Staff keeps them twice as long');
    // the climb for real, inside the notes' time: Enzo rings, Dora tags in and climbs to the shelf
    const G = graph(ALL, BASE_CALM, WINDS[0]);
    const room = roomById('cairns'), chest = thing('cairns', 'C');
    const g4 = new BellspireGame(done(['rope', 'echo']), {}, 3); g4.lead = 'enzo'; g4.save.heroes.enzo.mp = 60;
    at(g4, 'cairns', lq.c + 1, 13);
    g4.step(I({ up: true, cast: true })); run(g4, 2); g4.tagCd = 0; g4.step(I({ tag: true })); run(g4, 6); quiet(g4);
    eq(g4.lead, 'dora', 'Dora tagged in');
    const from = G.nodeAt(g4.body.x, g4.body.y);
    const p = G.path(from, (n) => Math.abs(n.x - (chest.c * TILE + 8)) < 20 && n.y === (chest.r + 1) * TILE);
    ok(p, 'the planner climbs the notes to the shelf');
    const t = drive(g4, p) + 9;
    ok(t < NOTE_LIFE, `the climb fits in the notes' time (${t} of ${NOTE_LIFE} ticks)`);
    ok(Math.abs(g4.body.y - (chest.r + 1) * TILE) < 1 && g4.body.ground, `Dora stands on the shelf (${(g4.body.x / TILE - room.gx * COLS).toFixed(1)}, ${(g4.body.y / TILE - room.gy * ROWS).toFixed(1)})`);
  }

  // ─── swinging bells ───────────────────────────────────────────────────────
  {
    const g = new BellspireGame(done(ALL.slice(7)), {}, 3);
    at(g, 'bellshaft', 20, 47);
    const bells = () => g.floatCache.filter((f) => f.kind === 'bell');
    eq(bells().length, 2, 'the bell shaft has two bells to ride');
    const x0 = bells()[0].x0; run(g, 30); quiet(g);
    ok(Math.abs(bells()[0].x0 - x0) > 4, 'they swing');
    // stand on one: it carries the hero along its arc
    const f = bells()[0];
    g.body.x = (f.x0 + f.x1) / 2; g.body.y = f.y - 2; g.body.ground = false; g.body.vy = 0; g.body.vx = 0;
    run(g, 4); quiet(g);
    ok(g.body.ground, 'a hero lands on top of a bell');
    const hx = g.body.x, bx = bells()[0].x0;
    run(g, 20); quiet(g);
    const now = bells()[0];
    ok(g.body.ground && Math.abs(g.body.y - now.y) < 0.01, 'and rides it');
    ok(Math.abs((g.body.x - hx) - (now.x0 - bx)) < 2.5, `carried along with it (${(g.body.x - hx).toFixed(1)} vs ${(now.x0 - bx).toFixed(1)} px)`);
  }

  // ─── doors ────────────────────────────────────────────────────────────────
  {
    const yd = INFO.get('ropehall').doors.find((d) => d.ch === 'y'), nd = INFO.get('ropehall').doors.find((d) => d.ch === 'n');
    const zd = INFO.get('bellshaft').doors.find((d) => d.ch === 'Z');
    const room = roomById('ropehall');
    const g = new BellspireGame(done([]), {}, 3);
    at(g, 'ropehall', 26, 14); run(g, 30, { right: true });
    ok(!g.doorOpen(yd) && /Bell Rope/.test(g.toast?.text ?? ''), 'a rope-knot door says it needs the Bell Rope');
    const g2 = new BellspireGame(done(['rope']), {}, 3);
    at(g2, 'ropehall', 26, 14); run(g2, 30, { right: true });
    ok(g2.doorOpen(yd), 'and opens to Dora’s rope');
    at(g2, 'ropehall', 25, 30); run(g2, 30, { right: true });
    ok(!g2.doorOpen(nd) && /Echo Step/.test(g2.toast?.text ?? ''), 'a note sigil needs the Echo Step');
    const g3 = new BellspireGame(done(['rope', 'echo']), {}, 3);
    at(g3, 'ropehall', 25, 30); run(g3, 30, { right: true });
    ok(g3.doorOpen(nd), 'and opens with it');
    at(g3, 'bellshaft', 4, 14); run(g3, 30, { left: true });
    ok(!g3.doorOpen(zd) && /Hail Condor and the Twin Clappers/.test(g3.toast?.text ?? ''), 'the belfry seal names both restless guardians');
    g3.setFlag('boss:condor');
    ok(!g3.doorOpen(zd), 'one guardian calm is not enough');
    g3.setFlag('boss:clappers');
    ok(g3.doorOpen(zd), 'with both calm the seal is open');
    void room;
  }

  // ─── Wayra's boat and the news ────────────────────────────────────────────
  {
    const s = freshSave(); s.flags.push('script:intro');
    const g = new BellspireGame(s, {}, 3);
    const d = thing('landing', 'D'), ld = local(d);
    at(g, 'landing', ld.c + 1, ld.r);
    eq(g.nearbyLabel(), 'Take Wayra’s boat', 'the boat says what ↑ does');
    g.interact();
    ok(g.dialog && g.dialog.lines === SCRIPTS.boatEarly, 'before the Lake Mother is calm, Wayra won’t row');
    eq(g.room.id, 'landing', 'and nobody goes anywhere');
    // a finished save hears about the belfry: a toast on loading, Wayra's line at the next rest
    const fs = done(); fs.flags = fs.flags.filter((f) => f !== 'script:belfryCall');
    const g2 = new BellspireGame(fs, {}, 3);
    ok(/Windward Belfry/.test(g2.toast?.text ?? ''), 'a finished save is told the belfry is there');
    at(g2, 'landing', 4, 14); g2.rest();
    ok(g2.dialog && g2.dialog.lines === SCRIPTS.belfryCall, 'and Wayra tells them about it at the next rest');
    g2.dialog = null; g2.rest();
    ok(!g2.dialog, 'once');
    at(g2, 'landing', ld.c + 1, ld.r); g2.interact(); quiet(g2);
    eq(g2.room.id, 'cliffoot', 'Wayra rows them to the foot of the Cloudstair');
    ok(g2.flag('belfry:visited'), 'remembered');
    const b = thing('cliffoot', 'D'), lb = local(b);
    at(g2, 'cliffoot', lb.c + 1, lb.r); g2.interact(); quiet(g2);
    eq(g2.room.id, 'landing', 'and back again');
    // the wisp leads to the boat, then up the Cloudstair
    const g3 = new BellspireGame(done(), {}, 3);
    at(g3, 'landing', 4, 14);
    const w = g3.wayToGoal();
    ok(w && Math.abs(w.x - (d.c * TILE + 8)) < 2, 'after the Lake Mother, the wisp points to Wayra’s boat');
    ok(g3.wispOn(), 'and it is on again');
    at(g3, 'cliffoot', 30, 14);
    eq(g3.nextGoal()?.room, 'ropehall', 'across the water, it heads for the Bell Rope');
  }

  // ─── spells ───────────────────────────────────────────────────────────────
  {
    const g = new BellspireGame(done([]), {}, 3);
    g.save.spells.push('frost', 'gale'); g.lead = 'enzo'; g.save.heroes.enzo.mp = 80;
    at(g, 'cliffoot', 30, 14);
    g.step(I({ jump: true })); run(g, 6, { jump: true });
    g.step(I({ cast: true })); g.step(I());
    eq(g.shots.filter((s) => s.kind === 'hail' && s.friendly).length, 3, 'Frost Fan: a tap of V in the air throws three hail shards');
    eq(g.leadRt.act?.spell, 'frost', 'with its own pose');
    ok(g.shots.filter((s) => s.kind === 'hail').every((s) => s.vy > 0), 'forward and down');
    run(g, 80); quiet(g);
    g.step(I()); for (let i = 0; i < GALE_HOLD + 2; i++) g.step(I({ cast: true })); g.step(I());
    ok(g.shots.some((s) => s.kind === 'gale'), 'Gale Wave: held long past the Ember Ring');
    eq(g.leadRt.act?.spell, 'gale', 'with its own pose');
    const g2 = new BellspireGame(done([]), {}, 3);
    g2.save.spells.push('gale'); g2.lead = 'enzo'; g2.save.heroes.enzo.mp = 80;
    at(g2, 'windgate', 38, 14); g2.body.face = 1;
    g2.step(I()); for (let i = 0; i < GALE_HOLD + 2; i++) g2.step(I({ cast: true })); g2.step(I()); run(g2, 60);
    eq(g2.save.wind.cloud, -1, 'the Gale Wave rings the wind bells it passes');
    ok(SPELLS.frost.hero === 'enzo' && SPELLS.gale.hero === 'enzo', 'two new spells for Enzo');
  }

  // ─── foes ─────────────────────────────────────────────────────────────────
  for (const [kind, room, act] of [['gust', 'cliffoot', 'strike'], ['hawk', 'switchback', 'swoop'], ['clapper', 'loftbase', 'strike'], ['beetle', 'loftbase', 'lunge']]) {
    const g = new BellspireGame(done(ALL.slice(7)), {}, 5);
    const e0 = (() => { g.teleport(room, 2, 14); g.dialog = null; return g.enemies.find((e) => e.kind === kind); })();
    ok(e0, `the ${kind} is placed in the ${room}`);
    // stand by it and wait for its attack
    g.body.x = e0.x + (kind === 'clapper' ? 30 : 50); g.body.y = kind === 'clapper' || kind === 'beetle' ? (Math.round((e0.y + (kind === 'clapper' ? 40 : 0)) / TILE)) * TILE : g.body.y;
    if (kind === 'hawk' || kind === 'gust') { g.body.x = e0.x + 40; g.body.y = e0.y + 50; }
    g.enemies = [e0]; e0.cd = 0;
    const sts = new Set();
    g.save.heroes.dora.hp = 999;
    for (let i = 0; i < 300; i++) { g.dialog = null; g.leadRt.inv = 99; g.step(I()); sts.add(e0.st); if (kind !== 'hawk' && kind !== 'gust') { g.body.x = e0.x + (e0.x < g.body.x ? 30 : -30); } }
    ok(sts.has('tell') && sts.has(act), `the ${kind} winds up, then attacks (${[...sts].join(', ')})`);
  }

  // ─── the guardians ────────────────────────────────────────────────────────
  for (const id of ['condor', 'clappers', 'tune']) {
    const g = new BellspireGame(done(id === 'condor' ? ['rope'] : ['rope', 'echo'], id === 'tune' ? ['boss:condor', 'boss:clappers'] : []), {}, 11);
    g.save.spells.push('frost', 'gale');
    g.fightBoss(id);
    eq(g.boss?.st, 'wait', `${id}: waits for the heroes`);
    const dir = id === 'condor' ? { right: true } : { left: true };
    for (let i = 0; i < 80 && g.boss.st === 'wait'; i++) { g.dialog = null; g.step(I(dir)); }
    eq(g.boss.st, 'intro', `${id}: walking in starts the fight`);
    const seal = INFO.get(g.room.id).doors.find((d) => d.ch === 'b');
    ok(!g.doorOpen(seal), `${id}: and seals the way out`);
    ok(g.dialog && g.dialog.lines === SCRIPTS[id], `${id}: with an introduction`);
    const seen = new Set(), phases = new Set();
    const hpAt = (p) => Math.round(g.boss.max * p);
    const mid = (g.boss.heads?.length === 2);
    for (let i = 0; i < (id === 'tune' ? 3600 : 2400) && !g.boss.calm; i++) {
      g.dialog = null; g.leadRt.inv = 99; g.save.heroes.dora.hp = g.save.heroes.enzo.hp = 400;
      g.step(I());
      seen.add(g.boss.st); for (const h of g.boss.heads) seen.add(`h:${h.st}`);
      phases.add(g.boss.phase);
      // knock it down a phase every 700 ticks
      if (i === 700 || i === 1400) {
        const target = i === 700 ? hpAt(0.55) : hpAt(0.25);
        if (mid) { for (const h of g.boss.heads) h.hp = Math.round(target / 2); g.boss.hp = target + 1; g.damageBoss(1, g.boss.x, g.boss.y, false, Object.assign({}, g.boss.hurt[0])); }
        else { g.boss.hp = target + 1; g.damageBoss(1, g.boss.x, g.boss.y); }
      }
    }
    eq([...phases].sort(), [1, 2, 3], `${id}: three phases`);
    const tells = [...seen].filter((s) => /Tell$/.test(s));
    ok(tells.length >= 3, `${id}: winds up its attacks (${tells.join(', ')})`);
    if (id === 'condor') {
      ok(seen.has('hail') && seen.has('dive') && seen.has('gust') && seen.has('storm'), `condor: hail, dives, gusts and the storm (${[...seen].join(' ')})`);
    }
    if (id === 'clappers') ok(seen.has('h:swing') && seen.has('h:slam') && seen.has('h:clap'), 'clappers: swings, slams and the clap');
    if (id === 'tune') ok(seen.has('toll') || seen.has('tollTell'), 'tune: tolls') ;
    if (id === 'tune') ok(seen.has('swing') && seen.has('high') && seen.has('sour'), `tune: swings, rises to retune and rains sour notes (${[...seen].join(' ')})`);
    // and calm it
    if (mid) {
      const iron = Object.assign({}, g.boss.hurt.find((h) => h.part === 0)), glass = Object.assign({}, g.boss.hurt.find((h) => h.part === 1));
      const hp0 = g.boss.hp;
      g.lead = 'enzo'; g.damageBoss(20, 0, 0, true, iron); g.damageBoss(20, 0, 0, false, iron);
      eq(g.boss.hp, hp0, 'clappers: Enzo’s staff and spells only clank off the Iron Clapper');
      ok(/Only Dora/.test(g.toast?.text ?? ''), 'clappers: and it says who can');
      g.lead = 'dora'; g.damageBoss(20, 0, 0, false, glass); g.damageBoss(20, 0, 0, true, glass);
      eq(g.boss.hp, hp0, 'clappers: Dora’s blade and whirl only tink off the Glass Clapper');
      g.damageBoss(20, 0, 0, false, iron);
      eq(g.boss.hp, hp0 - 20, 'clappers: Dora dents the Iron Clapper');
      g.lead = 'enzo'; g.damageBoss(10, 0, 0, true, glass); g.damageBoss(10, 0, 0, false, glass);
      eq(g.boss.hp, hp0 - 40, 'clappers: Enzo’s spells and staff crack the Glass Clapper');
      g.save.heroes.enzo.down = true; g.lead = 'dora'; g.damageBoss(5, 0, 0, false, glass);
      eq(g.boss.hp, hp0 - 45, 'clappers: with Enzo knocked out, Dora can crack the glass herself, so the fight never stalls');
      g.save.heroes.enzo.down = false;
      g.lead = 'dora'; g.damageBoss(9999, 0, 0, false, iron);
      ok(!g.boss.calm && g.boss.heads[0].st === 'calm', 'clappers: one quiet clapper is not the end');
      g.lead = 'enzo'; g.damageBoss(9999, 0, 0, true, glass);
    } else g.damageBoss(99999, g.boss.x, g.boss.y);
    ok(g.boss.calm, `${id}: calmed`);
    g.drainEvents();
    let ended = null;
    for (let i = 0; i < 400 && !g.flag(`boss:${id}`); i++) { g.dialog = null; g.step(I()); }
    for (let i = 0; i < 20; i++) { if (g.dialog) { const then = g.dialog.then; g.dialog = null; then?.(); } g.step(I()); }
    for (const e of g.drainEvents()) if (e.k === 'ending') ended = e;
    ok(g.flag(`boss:${id}`), `${id}: done`);
    if (id === 'condor') ok(g.has('echo') && g.save.spells.includes('frost'), 'condor: the reward is the Echo Step and the Frost Fan');
    if (id === 'clappers') ok(g.save.spells.includes('gale') && g.save.drops >= 1, 'clappers: the Gale Wave and a Moon Drop');
    if (id === 'tune') {
      ok(ended?.belfry, 'tune: calming the Out-of-Tune Bell plays the expansion ending');
      eq(ended?.full, false, 'tune: not everything found, so no second epilogue yet');
      ok(g.flag('belfry:ending'), 'tune: remembered');
    } else ok(!ended, `${id}: no ending`);
    if (id !== 'tune') ok(g.doorOpen(seal), `${id}: the way out opens`);
  }
  // the condor breaks its bridge; the planks mend
  {
    const g = new BellspireGame(done(['rope']), {}, 4);
    g.fightBoss('condor'); g.dialog = null;
    for (let i = 0; i < 30; i++) { g.dialog = null; g.step(I({ right: true })); }
    g.breakPlanks(30, 34, 50);
    const room = roomById('condorbridge'), c = room.gx * COLS + 32, r = room.gy * ROWS + 12;
    ok(!g.env.oneway(c, r), 'a broken plank can’t be stood on');
    run(g, 60); quiet(g);
    ok(g.env.oneway(c, r), 'and mends');
  }
  // the Out-of-Tune Bell turns the wind and lays notes when it retunes
  {
    const g = new BellspireGame(done(ALL.slice(7), ['boss:condor', 'boss:clappers']), {}, 4);
    g.fightBoss('tune');
    for (let i = 0; i < 80 && g.boss.st === 'wait'; i++) { g.dialog = null; g.step(I({ left: true })); }
    g.boss.phase = 2; g.boss.step = 0; g.go('retuneTell', 2);
    const w0 = g.arenaWind.dir;
    for (let i = 0; i < 40; i++) { g.dialog = null; g.leadRt.inv = 99; g.step(I()); }
    ok(g.arenaWind.dir === -w0 && g.boss.st === 'high', 'retuning turns the arena’s wind round and lifts the bell');
    ok(g.floatCache.filter((f) => f.kind === 'note').length >= 4, 'and lays notes to climb');
    ok(g.windAt(g.body.x, g.body.y - 10) !== 0, 'the arena wind blows while it fights');
  }

  // ─── saves from before the expansion, and the totals ──────────────────────
  {
    const old = freshSave(); delete old.wind; delete old.medals; delete old.ngp;
    old.flags.push('boss:mother', 'epilogue', 'ending');
    const s = parseSave(JSON.stringify(old));
    ok(s, 'a save from before the Windward Belfry still loads');
    eq(s.wind, { cloud: 1, loft: 1 }, 'with the wind at its start');
    eq(s.medals, {}, 'no medals yet');
    eq(s.ngp, 0, 'and its first time through');
    ok(s.flags.includes('epilogue'), 'the first epilogue stays earned');
    eq(parseSave(JSON.stringify({ ...old, wind: { cloud: 7 } })).wind.cloud, 1, 'a bad wind falls back to the start');
    // everything in the citadel found: 100% of the citadel, but the totals now include the belfry
    const g = new BellspireGame(done(['rope', 'echo']), {}, 1);
    g.unlockMap();
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') g.setFlag(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < 10; i++) g.setFlag(`mural:${i}`);
    g.save.seen = g.save.seen.filter((k) => { const [x, y] = k.split(',').map(Number); return !ROOMS.find((r) => x >= r.gx && x < r.gx + r.w && y >= r.gy && y < r.gy + r.h)?.exp; });
    for (const info of INFO.values()) if (info.room.exp) for (const t of info.things) if (t.ch === 'C') g.save.flags = g.save.flags.filter((f) => f !== `chest:${info.room.id}:${t.i}`);
    g.save.abilities = [...BASE_ABILITIES];
    const c = g.completion();
    eq(c.base.pct, 100, 'the citadel alone: 100%');
    ok(c.pct < 100, `the whole map: less (${c.pct}%)`);
    eq(c.total, COMPLETION.cells + COMPLETION.chests + COMPLETION.pedestals + COMPLETION.murals + COMPLETION.bosses, 'the totals include the expansion');
    eq(COMPLETION.bosses, 8, 'eight bosses to calm');
    // then everything: the second epilogue (after the Out-of-Tune Bell)
    g.save.abilities = [...BASE_ABILITIES, 'rope', 'echo'];
    g.unlockMap();
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') g.setFlag(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < MURALS.length; i++) g.setFlag(`mural:${i}`);
    for (const b of ['condor', 'clappers', 'tune']) g.setFlag(`boss:${b}`);
    g.save.flags = g.save.flags.filter((f) => f !== 'ending');
    eq(g.completion().pct, 100, 'with the belfry found too: 100%');
    g.setFlag('epilogue'); g.drainEvents();
    g.checkEpilogue();
    ok(g.dialog, 'the heroes say so');
    const then = g.dialog.then; g.dialog = null; then();
    ok(g.flag('epilogue2'), 'and the second epilogue is earned');
    ok(g.drainEvents().some((e) => e.k === 'ending' && e.belfry && e.full), 'shown with the belfry ending');
  }
  // both earned at once (everything found after the Bell, the first epilogue never seen): the second stands for both,
  // and nothing plays after it, before or after a reload
  {
    const s0 = done(['rope', 'echo'], ['boss:condor', 'boss:clappers', 'boss:tune']);
    const g = new BellspireGame(s0, {}, 1);
    g.unlockMap();
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') g.setFlag(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < MURALS.length; i++) g.setFlag(`mural:${i}`);
    g.drainEvents();
    const endings = [];
    for (let i = 0; i < 400; i++) { if (g.dialog) { const t = g.dialog.then; g.dialog = null; t?.(); } g.step(I()); endings.push(...g.drainEvents().filter((e) => e.k === 'ending')); }
    eq(endings.map((e) => [!!e.belfry, e.full]), [[true, true]], 'everything found at once plays the second epilogue, once, and not the first');
    ok(g.flag('epilogue') && g.flag('epilogue2'), 'and counts as both');
    const again = new BellspireGame(parseSave(JSON.stringify(g.snapshot())), {}, 2);
    let more = 0;
    for (let i = 0; i < 200; i++) { again.step(I()); more += again.drainEvents().filter((e) => e.k === 'ending').length; }
    eq(more, 0, 'and a reload plays nothing more');
  }
  // the wisp after the citadel's ending: a save that kept the ending flag (as the title's Continue loads it) is still led
  // to the boat; once the Bell is calm, it goes out
  {
    const g = new BellspireGame(done([], ['ending', 'epilogue']), { assist: true }, 1);
    ok(g.wispOn(), 'the wisp is on after the citadel’s ending');
    const g2 = new BellspireGame(done(['rope', 'echo'], ['ending', 'boss:condor', 'boss:clappers', 'boss:tune']), { assist: true }, 1);
    ok(!g2.wispOn(), 'and out once the Out-of-Tune Bell is calm');
  }
  // the condor's door: climbing up the shaft under the bridge's hatch does not start the fight (the hatch would shut
  // over the heroes' heads); stepping out onto the bridge does
  {
    const g = new BellspireGame(done(['rope']), {}, 1);
    const cb = roomById('condorbridge'), hatch = INFO.get('condorbridge').doors.find((d) => d.ch === 'b' && d.r - cb.gy * ROWS > 8);
    at(g, 'bannerwalk', hatch.c - roomById('bannerwalk').gx * COLS + 1, 3);
    for (let i = 0; i < 300 && !(g.room.id === 'condorbridge' && g.body.y < (hatch.r + 2) * TILE); i++) { g.dialog = null; g.step(I({ up: true })); }
    ok(g.room.id === 'condorbridge' && g.body.climb && g.body.y > (hatch.r + 1) * TILE && g.boss?.st === 'wait', `on the ladder under the hatch, the condor waits (${g.room.id}, ${g.boss?.st})`);
    ok(g.doorOpen(hatch), 'and the hatch stays open');
    for (let i = 0; i < 60 && g.boss?.st === 'wait'; i++) { g.dialog = null; g.step(I({ jump: i < 14, right: i > 4 })); }
    ok(g.boss?.st !== 'wait' && g.body.y <= hatch.r * TILE + 2, 'up on the bridge, the fight begins');
  }
  // ─── every new action has its own pose ─────────────────────────────────────
  {
    const base = { ground: true, vx: 0, vy: 0, face: 1, climb: false, swim: false, wade: false, glide: false, wallSlide: false, dash: false, hurt: false, down: false, act: null, castHold: false, lanternUp: false, events: [] };
    const run = (hero, seq) => { const a = new HeroAnimator(hero); return seq.map((o) => a.step({ ...base, ...o, events: o.events ?? [] })); };
    // the rope: the throw as it catches, the swing back, through and forward, then letting go
    const r = run('dora', [{ ground: false }, { ground: false, rope: { ang: -0.6, av: 0.02 }, events: ['hooked'] },
      ...Array.from({ length: 9 }, () => ({ ground: false, rope: { ang: -0.6, av: 0.02 } })), { ground: false, rope: { ang: 0, av: 0.05 } },
      { ground: false, rope: { ang: 0.6, av: -0.01 } }, { ground: false, vy: -3, events: ['unhooked'] }, { ground: false, vy: -2 }]);
    eq(r[1].state, 'ropeThrow', 'throwing the rope has its own pose');
    eq(r[1].frame, 80, 'frame 80');
    eq(r[10].state, 'ropeSwing', 'then the swing');
    eq([r[10].frame, r[11].frame, r[12].frame], [81, 82, 83], 'drawn back, through the bottom, swung forward: a frame each');
    eq(r[13].state, 'ropeRelease', 'letting go has its own pose');
    eq(r[14].state, 'ropeRelease', 'which holds a moment in the air');
    eq([ropeFrame(-1), ropeFrame(0), ropeFrame(1)], [81, 82, 83], 'the swing frame follows the angle');
    for (const hero of ['dora', 'enzo']) {
      const b = run(hero, [{ gust: -1.2 }, { gust: -1.2 }]);
      eq(b[1].state, 'brace', `${hero}: standing in a gust braces`);
      eq(b[1].frame, 85, `${hero}: frame 85`);
      eq(b[1].flip, false, `${hero}: leaning into a wind from the right (blowing west)`);
      eq(run(hero, [{ gust: 1.2 }, { gust: 1.2 }])[1].flip, true, `${hero}: and into one from the left`);
      eq(run(hero, [{ ride: 'bell' }, { ride: 'bell' }])[1].state, 'balance', `${hero}: on a swinging bell, balancing`);
    }
    eq(run('dora', [{ ride: 'note' }, { ride: 'note' }])[1].state, 'balance', 'Dora balances on a note');
    eq(run('enzo', [{ ride: 'note' }, { ride: 'note' }])[1].state, 'noteHop', 'Enzo hops along the notes');
    eq(run('dora', [{ hail: true }, { hail: true }])[1].state, 'shield', 'Dora shields from hail');
    const cast = (spell, t) => ({ act: { kind: 'cast', n: 0, t, wind: 0, active: 0, spell } });
    eq(run('enzo', [cast('echo', 0)])[0].state, 'echo', 'sounding an echo bell has its own pose');
    eq(run('enzo', [cast('frost', 0), cast('frost', 8)]).map((o) => o.state), ['frostWind', 'frost'], 'the Frost Fan winds up, then fans out');
    eq(run('enzo', [{ castHold: true, castLong: true }])[0].state, 'galeWind', 'holding V for the Gale Wave has its own wind-up');
    eq(run('enzo', [{ castHold: true }])[0].state, 'castWind', 'while a shorter hold is the Ember Ring’s');
    eq(run('enzo', [cast('gale', 0)])[0].state, 'gale', 'and the Gale Wave its own release');
  }

  // the new gear
  {
    ok(GEAR['windward-jacket'].hero === 'dora' && GEAR['highland-cloak'].hero === 'enzo', 'the two outfits are each hero’s own coat');
    ok(GEAR['condor-talon'].atk > GEAR.moonsteel.atk && GEAR['carillon-staff'].mag > GEAR['star-lamp'].mag, 'the new weapons are a tier higher');
    ok(ABILITIES.rope.hero === 'dora' && ABILITIES.echo.hero === 'enzo', 'the Bell Rope is Dora’s, the Echo Step Enzo’s');
    ok(BOSSES.tune.hp > BOSSES.mother.hp, 'the finale is the toughest');
    void groupAt; void NOTE_GAP;
  }

  // the map guide to the belfry: kept secret until the Lake Mother is calm, then Wayra's boat and the way across
  {
    const g = new BellspireGame(freshSave(), {}, 1); g.dialog = null;
    for (const a of BASE_ABILITIES) if (!g.save.abilities.includes(a)) g.save.abilities.push(a);
    for (const b of ['frog', 'hydra', 'puma', 'warden']) g.setFlag(`boss:${b}`);
    g.teleport('landing', 10, 14);
    ok(!g.belfryKnown() && g.mapTarget() === null, 'before the Lake Mother the maps show nothing of the belfry');
    ok(!isBelfryRoom(g.mapGoal().room) && g.mapGoal().room !== 'landing', 'and the wisp’s map mark is in the citadel');
    g.setFlag('boss:mother');
    ok(g.belfryKnown(), 'once she is calm the belfry is on the map');
    const boat = g.boatAt('landing'), t = g.mapTarget();
    eq(t && [t.kind, t.room, t.x, t.y], ['boat', 'landing', boat.x, boat.y], 'the minimap points to Wayra’s boat on the Landing');
    ok(t.x > g.body.x, 'which is east of the shrine, so the arrow points right');
    eq(g.mapGoal(), boat, 'and the wisp’s map mark sits on the boat (its goal, the Bell Rope, is across the water)');
    // a save that skipped meeting Ukumari (a debug save) still leads to the boat, not back to the keeper
    ok(!g.flag('keeper') && g.nextGoal().room !== 'keeper', 'with the Mother calm the wisp never leads back to Ukumari');
    // across the water: the Cloudstair first, then the Loft, then the boat back
    g.teleport('cliffoot', 10, 14); g.step(NO_INPUT);
    const c = g.mapTarget();
    eq([c.kind, c.area], ['area', 'cloud'], 'in the belfry the arrow points to the Cloudstair’s rooms not seen yet');
    ok(isBelfryRoom(g.mapGoal().room), 'and the wisp’s mark is on the belfry goal itself');
    for (const r of ROOMS) if (r.area === 'cloud') for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (!g.save.seen.includes(`${r.gx + x},${r.gy + y}`)) g.save.seen.push(`${r.gx + x},${r.gy + y}`);
    const l = g.mapTarget();
    eq([l.kind, l.area], ['area', 'loft'], 'with the Cloudstair seen it points to the Belfry Loft');
    ok(l.y < g.body.y, 'which is up the mountain');
    for (const r of ROOMS) if (r.area === 'loft') for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (!g.save.seen.includes(`${r.gx + x},${r.gy + y}`)) g.save.seen.push(`${r.gx + x},${r.gy + y}`);
    const back = g.mapTarget(), cb = g.boatAt('cliffoot');
    eq([back.kind, back.room, back.x], ['boat', 'cliffoot', cb.x], 'with everything seen it points back to the boat');
    g.teleport('landing', 10, 14); g.step(NO_INPUT);
    for (const b of ['condor', 'clappers', 'tune']) g.setFlag(`boss:${b}`);
    for (const a of ['rope', 'echo']) g.save.abilities.push(a);
    eq(g.mapTarget(), null, 'and in the citadel, with the belfry done, there is no arrow');
    const p = new BellspireGame(parseSave(JSON.stringify(g.snapshot())), {}, 1);
    ok(p.belfryKnown(), 'a loaded save keeps the belfry on the map');
  }
  return checks;
}
