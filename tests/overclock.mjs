// Overclock engine tests: saves, the feel (coyote time, jump buffer, variable jump, dash, the wall moves, hover),
// tag, all sixteen powers, weaknesses, the city changes, assist and strict, capsules and chips, the hitboxes taken
// from the art, the animation map, and the words players read. Runs against the compiled engine in .checks/.
//   npx tsc lib/overclock-game.ts lib/overclock-anim.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck
//   node tests/overclock.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OverclockGame, NO_INPUT, freshSave, parseSave, SAVE_KEY, STAGES, BOSS_STAGES, CORE_BOSSES, WEAK, CHANGES, POWERS, POWER, powersOf, maxHp, tankCount,
  heartCount, buyChip, toggleChip, CHIPS, CHIP_SLOTS, FOES, BOSSES, foeBox, bossBox, COYOTE, BUFFER, T, ROWS, reqMet, stageOpen, lockedWhy, weakHint, completion, itemMap, MINI_NAME,
} from '../.checks/overclock-game.js';
import { heroFrame, POSE_STATES, HERO_ACTIONS } from '../.checks/overclock-anim.js';
import { FOE_BOXES, BOSS_BOXES } from '../.checks/overclock-boxes.js';

let n = 0;
const test = (name, fn) => { fn(); n++; if (process.argv.includes('-v')) console.log('  ok', name); };
const inp = (o = {}) => ({ ...NO_INPUT, ...o });

/** a game on a hand-made test room: rows of text, ground at the bottom */
function room(rows, opts = {}) {
  const s = opts.save ?? Object.assign(freshSave(), { intro: true });
  const g = new OverclockGame(s, 'training', { assist: opts.assist ?? true }, 1);
  const w = rows[0].length;
  const pad = Array.from({ length: ROWS - rows.length }, () => ' '.repeat(w));
  g.stage = { ...g.stage, w, checks: [], items: [], foes: [], pickups: [], bikes: [], mini: null, arena: null, door: null, gate: opts.gate ?? null, gravity: 1, dark: false, rain: false, prompts: [] };
  g.grid = [...pad, ...rows].map((r) => r.split(''));
  g.foes = []; g.pickups = []; g.bike = [];
  g.mode = 'play';
  const [c, r] = opts.at ?? [2, ROWS - rows.length + rows.findIndex((x) => x.includes('#')) - 1];
  g.body = g.newBody(c * T + 8, (r + 1) * T); g.lastSafe = { x: g.body.x, y: g.body.y };
  return g;
}
const run = (g, n, i = {}) => { for (let k = 0; k < n; k++) g.step(inp(i)); };
const flat = (w = 40) => ['#'.repeat(w), '#'.repeat(w)];

// ─── saves ───
test('save key is versioned', () => assert.equal(SAVE_KEY, 'overclock-v1'));
test('parseSave rejects junk and keeps good fields', () => {
  assert.equal(parseSave(null), null);
  assert.equal(parseSave('{nope'), null);
  assert.equal(parseSave('{"v":2}'), null);
  const s = freshSave(); s.beaten = ['crab', 'crab', 'nobody']; s.items = ['heart-port', 'heart-port']; s.bolts = 12;
  const p = parseSave(JSON.stringify(s));
  assert.deepEqual(p.beaten, ['crab']); assert.deepEqual(p.items, ['heart-port']); assert.equal(p.bolts, 12);
});

// ─── the feel ───
test('coyote time: a jump up to 6 frames after leaving a ledge still works', () => {
  for (const late of [1, COYOTE - 1]) {
    const g = room(['##########          ', '##########          '], { at: [8, ROWS - 3] });
    let t = 0; while (g.body.ground && t++ < 120) g.step(inp({ right: true }));
    run(g, late - 1, { right: true });
    const y0 = g.body.y; g.step(inp({ right: true, jump: true }));
    assert.ok(g.body.vy < -4, `jump ${late} frames late`); assert.ok(g.body.y <= y0 + 1);
  }
  const g = room(['##########          ', '##########          '], { at: [8, ROWS - 3] });
  let t = 0; while (g.body.ground && t++ < 120) g.step(inp({ right: true }));
  run(g, COYOTE + 2, { right: true }); g.step(inp({ right: true, jump: true }));
  assert.ok(g.body.vy > 0, 'too late: no jump');
});
test('jump buffer: a press up to 6 frames before landing jumps on landing', () => {
  const g = room(flat()); g.body.y -= 60; g.body.ground = false;
  let t = 0; while (t++ < 200) { const b = g.body; if (!b.ground && b.vy > 0 && b.y > (ROWS - 2) * T - 14) break; g.step(inp()); }
  g.step(inp({ jump: true })); // pressed in the air
  let jumped = false; for (let k = 0; k < BUFFER + 4; k++) { g.step(inp({ jump: true })); if (g.body.vy < -4) jumped = true; }
  assert.ok(jumped);
});
test('variable jump: letting go early jumps lower', () => {
  const peak = (hold) => { const g = room(flat()); let top = g.body.y; for (let k = 0; k < 60; k++) { g.step(inp({ jump: k < hold })); top = Math.min(top, g.body.y); } return (ROWS - 2) * T - top; };
  assert.ok(peak(4) < peak(30) - 20, `${peak(4)} vs ${peak(30)}`);
});
test('dash is faster than running, and only the boots give an air-dash', () => {
  const g = room(flat()); run(g, 10, { right: true }); const x0 = g.body.x; run(g, 10, { right: true }); const runD = g.body.x - x0;
  g.step(inp({ right: true, dash: true })); const x1 = g.body.x; run(g, 10, { right: true, dash: true }); assert.ok(g.body.x - x1 > runD * 1.6);
  const a = room(flat()); a.step(inp({ jump: true })); run(a, 6, { jump: true }); const vx0 = a.body.x; a.step(inp({ right: true, dash: true })); run(a, 6, { right: true, dash: true });
  const noBoots = a.body.x - vx0;
  const s = Object.assign(freshSave(), { intro: true, items: ['legs'] });
  const b = room(flat(), { save: s }); b.step(inp({ jump: true })); run(b, 6, { jump: true }); const bx0 = b.body.x; b.step(inp({ right: true, dash: true })); run(b, 6, { right: true, dash: true });
  assert.ok(b.body.x - bx0 > noBoots + 8, `${b.body.x - bx0} vs ${noBoots}`);
});
test('Dora climbs walls with up; Enzo slides down them and can wall-jump', () => {
  const rows = ['#     ##', '#     ##', '#     ##', '#     ##', '#     ##', '#     ##', '########', '########'];
  const d = room(rows, { at: [4, ROWS - 3] });
  run(d, 20, { right: true }); const y0 = d.body.y; run(d, 30, { right: true, up: true });
  assert.ok(d.body.y < y0 - 20, 'Dora climbed'); assert.equal(d.pose.st, 'climb');
  const e = room(rows, { at: [4, ROWS - 3] }); e.lead = 'enzo';
  e.step(inp({ jump: true })); run(e, 20, { right: true, jump: true }); run(e, 10, { right: true });
  assert.ok(e.body.cling, 'Enzo clings'); const y1 = e.body.y; run(e, 5, { right: true }); assert.ok(e.body.y > y1, 'and slides');
  const x2 = e.body.x; e.step(inp({ right: true, jump: true })); assert.ok(e.body.vy < -3, 'wall-jump'); run(e, 3, { right: true, jump: true }); assert.ok(e.body.x < x2, 'kicks away from the wall');
});
test('Enzo hovers for a second at the top of a jump', () => {
  const g = room(flat()); g.lead = 'enzo';
  g.step(inp({ jump: true })); let t = 0; while (g.body.vy < 0 && t++ < 60) g.step(inp({ jump: true }));
  g.step(inp()); let hovered = 0; for (let k = 0; k < 80; k++) { g.step(inp({ jump: true })); if (g.body.hovering) hovered++; }
  assert.ok(hovered >= 40 && hovered <= 64, `hovered ${hovered}`);
});
test('down + jump drops through a one-way ledge', () => {
  const g = room(['   ====   ', '          ', '          ', '##########', '##########'], { at: [4, ROWS - 6] });
  run(g, 5); assert.ok(g.body.ground); const y0 = g.body.y;
  g.step(inp({ down: true, jump: true })); run(g, 30); assert.ok(g.body.y > y0 + 30);
});

// ─── tag ───
test('tag swaps the lead, has a cooldown, and the swap-in attack hits', () => {
  const g = room(flat()); g.step(inp({ tag: true })); assert.equal(g.lead, 'enzo');
  g.step(inp()); g.step(inp({ tag: true })); assert.equal(g.lead, 'enzo', 'cooldown');
  run(g, 45); g.step(inp({ tag: true })); assert.equal(g.lead, 'dora');
  const h = room(flat()); h.foes.push({ id: 99, kind: 'sentry', x: h.body.x + 16, y: h.body.y - 14, vx: 0, vy: 0, hp: 10, max: 10, face: -1, st: 'idle', t: 0, cd: 999, flash: 0, alive: true, hx: 0, hy: 0, big: false, shield: false, frozen: 0, hidden: false, ground: true, mini: false, respawn: 0 });
  h.step(inp({ tag: true })); run(h, 10); assert.ok(h.foes[0].hp < 10, 'the swap-in attack hurt it');
});
test('a knocked-out hero rests, then can tag back in', () => {
  const g = room(flat()); g.heroes.dora.hp = 1; g.hurt(10, g.body.x + 20);
  assert.equal(g.lead, 'enzo'); assert.ok(g.heroes.dora.down);
  g.step(inp({ tag: true })); assert.equal(g.lead, 'enzo');
  run(g, 60 * 21); assert.equal(g.heroes.dora.down, false);
});

// ─── powers ───
test('sixteen powers: one per hero per core, and every one does something', () => {
  const pw = POWERS.filter((p) => p.core);
  assert.equal(pw.length, 16);
  for (const b of CORE_BOSSES) { assert.equal(pw.filter((p) => p.core === b && p.hero === 'dora').length, 1); assert.equal(pw.filter((p) => p.core === b && p.hero === 'enzo').length, 1); }
  for (const p of pw) {
    const s = Object.assign(freshSave(), { intro: true, beaten: [...CORE_BOSSES] });
    const g = room(flat(60), { save: s, at: [20, ROWS - 3] }); g.lead = p.hero;
    const before = JSON.stringify([g.shots.length, g.effects.length, g.ghostT, g.moonT, g.body.drillT]);
    assert.ok(g.usePower(p.id, g.muzzle()), p.id);
    const after = JSON.stringify([g.shots.length, g.effects.length, g.ghostT, g.moonT, g.body.drillT]);
    assert.ok(before !== after || g.events.some((e) => e.k === 'flash'), `${p.id} had an effect`);
  }
  assert.deepEqual(powersOf(freshSave(), 'dora'), ['blaster']);
});
test('weaknesses form one loop through all eight bosses', () => {
  const seen = new Set(); let b = 'crab';
  for (let i = 0; i < 8; i++) { seen.add(b); b = Object.keys(WEAK).find((k) => WEAK[k] === b); }
  assert.equal(seen.size, 8); assert.equal(b, 'crab');
});
test('a weakness hits much harder than the blaster and staggers', () => {
  const s = Object.assign(freshSave(), { intro: true, beaten: ['heron'] });
  const g = new OverclockGame(s, 'port', { assist: true }, 3); g.mode = 'play';
  g.startBoss('crab', STAGES.port.arena); g.boss.st = 'idle';
  const h0 = g.boss.hp; g.damageBoss(1, 'blaster'); const base = h0 - g.boss.hp;
  g.boss.flash = 0; const h1 = g.boss.hp; g.damageBoss(1, 'spark'); assert.ok(h1 - g.boss.hp >= base * 3); assert.equal(g.boss.st, 'hurt');
  g.boss.flash = 0; g.boss.st = 'idle'; g.damageBoss(1, 'blaster'); const h2 = g.boss.hp; g.damageBoss(1, 'blaster'); assert.equal(g.boss.hp, h2, 'the guard after a hit');
});

// ─── the city changes ───
test('rebooting a boss changes another stage: barriers, ledges and puddles follow the gate', () => {
  for (const [boss, list] of Object.entries(CHANGES)) for (const c of list) assert.ok(STAGES[c.stage].gate === boss || (boss === 'firefly' && c.stage === 'highway'), `${boss} → ${c.stage}`);
  const g = room(['  x  w  o ', '##########', '##########'], { gate: 'crab', at: [0, ROWS - 4] });
  const r = ROWS - 3;
  assert.ok(g.solid(2, r)); assert.ok(g.hazard(5, r)); assert.equal(g.oneway(8, r), false);
  g.save.beaten.push('crab');
  assert.equal(g.solid(2, r), false); assert.equal(g.hazard(5, r), false); assert.ok(g.oneway(8, r));
});

// ─── assist and strict ───
test('assist: less damage, and a pit puts the hero back on the ledge', () => {
  const a = room(flat()); a.hurt(10, a.body.x + 10); const lostA = maxHp(a.save) - a.heroes.dora.hp;
  const s = room(flat(), { assist: false }); s.hurt(10, s.body.x + 10); const lostS = maxHp(s.save) - s.heroes.dora.hp;
  assert.equal(lostA, 6); assert.equal(lostS, 10);
  const p = room(['####      ', '####      '], { at: [1, ROWS - 3] }); const safe = { ...p.lastSafe };
  run(p, 200, { right: true }); assert.ok(p.stats.falls >= 1); assert.equal(p.lead, 'dora'); assert.ok(Math.abs(p.body.x - safe.x) < 80);
  const q = room(['####      ', '####      '], { assist: false, at: [1, ROWS - 3] }); let k = 0; while (q.stats.falls === 0 && k++ < 300) q.step(inp({ right: true })); assert.ok(q.heroes.dora.down && q.lead === 'enzo', 'strict: the fall knocks the hero out');
  assert.ok(STAGES.port.checks.some((c) => c.assist), 'extra checkpoints on assist');
});

// ─── capsules, chips, stages ───
test('capsules: 8 heart cells, the 4 armour parts and energy tanks, each reachable once its city change is in', () => {
  const all = BOSS_STAGES.flatMap((id) => STAGES[id].items);
  assert.equal(all.filter((i) => i.kind === 'heart').length, 8);
  for (const a of ['helmet', 'legs', 'body', 'arm']) assert.equal(all.filter((i) => i.kind === a).length, 1);
  assert.ok(all.filter((i) => i.kind === 'tank').length >= 4);
  const s = freshSave(); s.items = all.filter((i) => i.kind === 'heart').map((i) => i.id); assert.equal(heartCount(s), 8); assert.equal(maxHp(s), 32);
  const full = Object.assign(freshSave(), { beaten: [...CORE_BOSSES], items: ['legs'] });
  for (const i of all) assert.ok(reqMet(full, i.req), `${i.id} reachable with everything`);
  assert.equal(itemMap(freshSave()).length, 8);
});
test('chips: buy with bolts, slot up to three', () => {
  const s = freshSave(); assert.equal(buyChip(s, 'rapid').ok, false); s.bolts = 1000;
  for (const c of CHIPS.slice(0, 4)) assert.ok(buyChip(s, c.id).ok);
  assert.equal(s.equipped.length, CHIP_SLOTS);
  assert.equal(toggleChip(s, CHIPS[3].id).ok, false);
  assert.ok(toggleChip(s, CHIPS[0].id).ok); assert.ok(toggleChip(s, CHIPS[3].id).ok);
});
test('stage locks: the eight after the rooftop, the tower after all eight cores', () => {
  const s = freshSave(); assert.equal(stageOpen(s, 'port'), false); assert.ok(lockedWhy(s, 'port'));
  s.intro = true; assert.ok(stageOpen(s, 'port')); assert.equal(stageOpen(s, 'tower1'), false);
  s.beaten.push(...CORE_BOSSES); assert.ok(stageOpen(s, 'tower1')); assert.equal(stageOpen(s, 'tower2'), false);
  assert.ok(weakHint(s, 'crab').includes('Storm Heron'));
  assert.equal(completion(freshSave()).pct, 0);
});
test('energy tanks heal and refill on assist only', () => {
  const s = Object.assign(freshSave(), { intro: true, items: ['tank-signs'], tanks: 1 });
  const g = room(flat(), { save: s }); g.heroes.dora.hp = 3;
  assert.ok(g.useTank().ok); assert.equal(g.heroes.dora.hp, maxHp(s)); assert.equal(g.useTank().ok, false);
  assert.equal(tankCount(s), 1);
});

// ─── bosses and Lumen ───
test('every boss has a full attack list per phase, and Lumen has a second form', () => {
  for (const [id, b] of Object.entries(BOSSES)) { assert.equal(b.attacks.length, 3, id); for (const p of b.attacks) assert.ok(p.length >= 2, id); }
  const s = Object.assign(freshSave(), { intro: true, beaten: [...CORE_BOSSES, 'spider', 'serpent'] });
  const g = new OverclockGame(s, 'tower3', { assist: true }, 1); g.mode = 'play';
  g.startBoss('lumen', STAGES.tower3.gallery.lumen); g.boss.st = 'idle'; g.boss.hp = 1; g.damageBoss(2, 'blaster');
  assert.equal(g.boss.form, 2); assert.ok(g.boss.hp > 0);
});

// ─── hitboxes from the art ───
test('every foe and boss has per-frame hitboxes from the art, mirrored when facing right', () => {
  for (const k of Object.keys(FOES)) { assert.equal(FOE_BOXES[k]?.length, 4, k); for (const b of FOE_BOXES[k]) assert.ok(b[2] > 4 && b[3] > 4, k); }
  for (const k of ['crab', 'chameleon', 'mole', 'peacock', 'heron', 'rhino', 'owl', 'firefly', 'spider', 'serpent', 'lumen-a', 'lumen-b']) assert.equal(BOSS_BOXES[k]?.length, 8, k);
  const e = { kind: 'riot', x: 100, y: 100, face: -1, big: false, st: 'idle', flash: 0 };
  const l = foeBox(e), r = foeBox({ ...e, face: 1 });
  assert.equal(l.w, r.w); assert.ok(Math.abs((l.x + l.w / 2 - 100) + (r.x + r.w / 2 - 100)) < 1.01, 'mirror image');
  const big = foeBox({ ...e, big: true }); assert.equal(big.w, l.w * 2);
  void bossBox;
});

// ─── animation ───
test('every action has its own painted drawing: no two actions share a frame, for both heroes', () => {
  const pose = (id, st, t, extra = {}) => heroFrame({ id, x: 0, y: 0, face: 1, st, t, shoot: 0, charge: 0, ghost: false, inv: 0, bike: false, ...extra });
  for (const id of ['dora', 'enzo']) {
    const frames = new Map();
    for (const act of HERO_ACTIONS[id]) {
      const [kind, st] = act.includes(':') ? act.split(':') : ['', act];
      const set = new Set();
      for (let t = 0; t < 1200; t++) set.add(pose(id, st, t, kind === 'shoot' ? { shoot: 8 } : kind === 'power' ? { shoot: 8, pw: true } : {}));
      for (const f of set) assert.ok(Number.isInteger(f) && f >= 0 && f < 32, `${id} ${act}: frame ${f}`);
      frames.set(act, set);
    }
    const acts = [...frames.keys()];
    for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) {
      const shared = [...frames.get(acts[i])].filter((f) => frames.get(acts[j]).has(f));
      assert.deepEqual(shared, [], `${id}: ${acts[i]} and ${acts[j]} share frame ${shared}`);
    }
    // every state the engine can give this hero is one of the listed actions
    for (const st of POSE_STATES) assert.ok(Number.isInteger(pose(id, st, 0)), st);
  }
  assert.equal(new Set(Array.from({ length: 24 }, (_, t) => pose('dora', 'run', t))).size, 4, 'a four-frame run');
});
test('no stand-in art: every hero sheet, area, boss, mini-boss and painting is its own', () => {
  const art = readFileSync(new URL('../lib/overclock-art.ts', import.meta.url), 'utf8');
  const have = new Set(JSON.parse(art.match(/HAVE: string\[\] = (\[[^\]]*\])/)[1].replace(/'/g, '"')));
  const painted = Object.fromEntries([...art.match(/PAINTED[^{]*\{([^}]*)\}/)[1].matchAll(/(\w+): '(\w*)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(painted, { dora: 'abcd', enzo: 'abcd' }, 'all four sheets painted for both heroes (32 frames each)');
  const need = ['dora', 'enzo', 'foes', 'water', 'bg-bike', 'title', 'hub', 'ending', 'portraits', 'select', 'icons', 'parts', 'cores', 'props'];
  for (const a of ['roof', 'port', 'signs', 'depot', 'arcade', 'highway', 'scrap', 'observatory', 'plant', 'tower']) need.push(`tiles-${a}`, `bg-${a}`, `mid-${a}`);
  for (const b of ['sentinel', 'crab', 'chameleon', 'mole', 'peacock', 'heron', 'rhino', 'owl', 'firefly', 'spider', 'serpent', 'lumen-a', 'lumen-b']) need.push(`boss-${b}`);
  for (const id of BOSS_STAGES) need.push(`mini-${STAGES[id].foes.find((f) => f.big).kind}`);
  const missing = need.filter((k) => !have.has(k));
  assert.deepEqual(missing, [], 'painted');
  const scene = readFileSync(new URL('../lib/overclock-scene.ts', import.meta.url), 'utf8');
  const map = scene.match(/const AREA_ART[^{]*\{([^}]*)\}/)[1];
  for (const [, k, v] of map.matchAll(/(\w+): '(\w+)'/g)) assert.equal(v, k, `area ${k} draws its own paintings`);
  const boxes = readFileSync(new URL('../lib/overclock-boxes.ts', import.meta.url), 'utf8');
  for (const k of need.filter((x) => x.startsWith('mini-'))) assert.ok(boxes.includes(`'${k.slice(5)}': [[`), `${k} has per-frame hitboxes`);
  assert.ok(boxes.includes("'sentinel': [["), 'the sentinel has per-frame hitboxes');
});

// ─── determinism ───
test('the hover-bike bumps its rider off a tunnel roof and rides on; tunnels have no barrier to hop just before them', () => {
  const g = room(['          ##########          ', '                              ', '                              ', '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'], { at: [1, ROWS - 3] });
  g.bike = [{ x: g.body.x, y: g.body.y, x1: 28 * T, on: true, home: g.body.x }]; g.riding = 0;
  const roofBottom = (ROWS - 4) * T;
  let maxUp = 0;
  for (let k = 0; k < 140; k++) { g.step(inp({ jump: k % 30 === 0 && g.body.x > 10 * T && g.body.x < 19 * T })); if (g.body.x > 10 * T && g.body.x < 20 * T) maxUp = Math.max(maxUp, roofBottom - (g.body.y - 30)); }
  assert.ok(maxUp <= 2, 'the rider never pushes into the roof');
  assert.ok(g.body.x > 21 * T, 'and comes out the far side');
  for (const id of BOSS_STAGES) {
    const st = STAGES[id], it = st.items.find((i) => i.req.bike);
    if (!it) continue;
    const c0 = Math.floor(it.x / T) - 4, r = Math.floor(it.y / T);
    for (let c = c0 - 14; c < c0; c++) assert.notEqual(st.grid[r][c], '#', `${id}: no barrier at column ${c} before the tunnel`);
  }
});
test('each district has its own named mini-boss', () => {
  const kinds = BOSS_STAGES.map((id) => STAGES[id].foes.find((f) => f.big)?.kind);
  assert.equal(new Set(kinds).size, 8);
  for (const k of kinds) assert.ok(MINI_NAME[k], k);
});
test('the air-dash capsule is a forgiving jump with the boots and out of reach without them', () => {
  const reach = (legs, dashAt) => {
    const s = Object.assign(freshSave(), { intro: true }); if (legs) s.items.push('legs');
    const g = new OverclockGame(s, 'plant', { assist: true }, 1); g.mode = 'play'; g.foes = [];
    const it = g.stage.items.find((i) => i.req.legs), tc = it.x - 12 * T;
    g.teleport(tc - 2 * T, it.y); run(g, 3);
    let jumped = false, t0 = 0;
    for (let t = 0; t < 300 && !g.taken.has(it.id); t++) {
      const i = { right: true };
      if (g.body.x > tc + 2 && !jumped) i.jump = true;
      if (!g.body.ground && !jumped) { jumped = true; t0 = t; }
      if (jumped) { i.jump = true; if (t - t0 >= dashAt && t - t0 < dashAt + 22) i.dash = true; }
      g.step(inp(i));
    }
    return g.taken.has(it.id);
  };
  const ok = [15, 18, 21, 24, 27, 30, 33].filter((d) => reach(true, d));
  assert.ok(ok.length >= 6, `a wide window of air-dash timings works (${ok})`);
  assert.ok(![0, 10, 20, 30].some((d) => reach(false, d)), 'no way across without the boots');
});
test('a seed replays exactly', () => {
  const play = () => { const g = new OverclockGame(Object.assign(freshSave(), { intro: true }), 'port', { assist: true }, 7); for (let i = 0; i < 1200; i++) g.step(inp({ right: i % 90 < 70, jump: i % 40 === 0, shoot: i % 9 < 4 })); return [g.body.x, g.body.y, g.heroes.dora.hp, g.foes.filter((e) => e.alive).length]; };
  assert.deepEqual(play(), play());
});

// ─── the words players read ───
test('player-facing text uses names or they/them, never he/she', () => {
  const files = ['lib/overclock-game.ts', 'lib/overclock-world.ts', 'app/overclock/page.tsx'];
  const bad = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    // string literals and JSX text only (comments are for developers)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    const strings = [...code.matchAll(/'([^'\n]*)'|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const s of strings) assert.ok(!bad.test(s), `${f}: "${s}"`);
  }
});
test('no Paw Buster names: no maverick, buster or X-titles', () => {
  const words = JSON.stringify([STAGES, BOSSES, POWERS, CHIPS]).toLowerCase();
  assert.ok(!/maverick|buster|\bdr\./.test(words));
  void POWER;
});

console.log(`overclock: ${n} engine tests passed`);
