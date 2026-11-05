// Tetherball engine checks: arenas (seeded layouts clear of the start, Enzo and the props, waves that grow, the golem
// last), the hook (it flies, latches the first thing in its way, misses past its reach, and a tap yanks instead of
// swinging), the rope (it never stretches, a held rope whirls a light enemy up to its top speed and a heavy one only
// slowly, a heavy boar drags Dora), letting go (the enemy flies off along its swing), impacts (damage from speed, both
// sides hurt, bowling chains, armour, walls, spikes, pits, crates and hearts), bomb beetles, Enzo as an anchor, the
// dash, enemies (contact damage, the spitter's acorns and the shield a swung enemy makes, the boar's charge and stun,
// the golem), the run (waves, clearing, upgrades, healing, losing, winning), replays from a seed, and the save.
import assert from 'node:assert/strict';
import { Run, DT, FLOOR, ROPE, SPIN, FOES, UPGRADES, ARENAS, ARENAS_PER_BIOME, makeLayout, damageAt, swingMeter, idleInput, newSave, parseSave, serialise, bank } from '../.checks/tether-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const inp = (o = {}) => ({ ...idleInput(), ...o });
const run = (r, secs, i = inp()) => { for (let k = 0; k < secs / DT && !r.over && r.phase === 'fight'; k++) r.tick(typeof i === 'function' ? i(r) : i); return r; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** an empty arena with the props cleared away, so a check sees only what it sets up */
const bare = (o = {}) => { const r = new Run({ seed: 5, empty: true, ...o }); r.layout.spikes = []; r.layout.pits = []; r.layout.crates = []; r.layout.posts = []; r.layout.enzo = { x: -500, y: -500, r: 8 }; r.inv = 0; return r; };
const cx = (FLOOR.x0 + FLOOR.x1) / 2, cy = (FLOOR.y0 + FLOOR.y1) / 2;
const place = (r, x, y) => { r.x = x; r.y = y; r.vx = r.vy = 0; };
/** hook the enemy (aiming straight at it) and keep the button held */
const hookOn = (r, f) => { const a = { ax: f.x - r.x, ay: f.y - r.y }; r.tick(inp({ ...a, hook: true })); for (let i = 0; i < 30 && !r.rope; i++) r.tick(inp({ ...a, hook: true })); assert.ok(r.rope, 'hooked'); };

// ---- arenas
{
  for (let a = 0; a < ARENAS; a++) for (const seed of [1, 2, 3, 99]) {
    const L = makeLayout(a, seed), props = [...L.spikes, ...L.pits, ...L.posts, ...L.crates, L.enzo];
    for (const p of props) assert.ok(p.x - p.r >= FLOOR.x0 && p.x + p.r <= FLOOR.x1 && p.y - p.r >= FLOOR.y0 && p.y + p.r <= FLOOR.y1, `arena ${a} prop inside the floor`);
    for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) assert.ok(dist(props[i], props[j]) > props[i].r + props[j].r + 10, `arena ${a} props apart`);
    assert.deepEqual(makeLayout(a, seed), L, 'the same layout from the same seed');
  }
  assert.equal(makeLayout(0, 1).pits.length, 0, 'no pits in the first arena');
  const size = (a) => makeLayout(a, 7).waves.flat().length;
  assert.ok(size(10) > size(1), 'later arenas have more enemies');
  assert.ok(makeLayout(2, 7).waves.flat().includes('boar'), 'the first boar ends the courtyard');
  assert.ok(makeLayout(ARENAS_PER_BIOME, 7).waves[0].includes('spitter'), 'the meadow brings spitters');
  assert.deepEqual(makeLayout(ARENAS - 1, 7).waves[0][0], 'golem', 'the golem last');
  for (let a = 1; a < ARENAS - 1; a++) assert.ok(makeLayout(a, 3).waves.flat().filter((k) => k === 'boar').length <= 3 * (1 + Math.floor(a / 6)));
  ok(`arenas: ${ARENAS} seeded layouts with props inside and apart, waves growing, newcomers on cue, the golem last`);
}

// ---- damage and the meter
{
  assert.equal(damageAt(59), 0); assert.equal(damageAt(60), 1); assert.equal(damageAt(110), 2); assert.equal(damageAt(210), 4);
  assert.equal(swingMeter(225), 9);
  ok('damage: nothing below 60, one more per 50 above');
}

// ---- the hook
{
  const r = bare(); place(r, cx - 60, cy); const f = r.spawn('grumble', cx, cy, true);
  r.tick(inp({ ax: 1, ay: 0, hook: true })); assert.ok(r.hook, 'the hook flies');
  for (let i = 0; i < 20 && !r.rope; i++) r.tick(inp({ ax: 1, ay: 0, hook: true }));
  assert.ok(r.rope && r.rope.to.kind === 'foe' && r.rope.to.id === f.id, 'it latches the grumble');
  assert.ok(Math.abs(r.rope.len - 60) < 12, 'the rope is as long as the gap');
  // out of reach
  const m = bare(); place(m, FLOOR.x0 + 20, cy); m.spawn('grumble', FLOOR.x1 - 20, cy, true);
  let missed = false; for (let i = 0; i < 40; i++) { m.tick(inp({ ax: 1, ay: 0, hook: i < 30 })); if (m.events.some((e) => e.k === 'miss')) missed = true; }
  assert.ok(missed && !m.rope, 'too far: the hook comes back');
  // a tap yanks the enemy over
  const y = bare(); place(y, cx - 70, cy); const g = y.spawn('slime', cx, cy, true);
  y.tick(inp({ ax: 1, ay: 0, hook: true })); let yanked = false;
  for (let i = 0; i < 20; i++) { y.tick(inp({ ax: 1, ay: 0 })); if (y.events.some((e) => e.k === 'yank')) yanked = true; }
  assert.ok(yanked && !y.rope && g.x < cx - 15, 'a tap yanks it towards Dora');
  // keyboard and touch aim: no aim given, so it finds the enemy Dora is facing
  const a = bare(); place(a, cx, cy); const t = a.spawn('grumble', cx - 50, cy + 18, true); a.face = -1; a.aim = { x: -1, y: 0 };
  for (let i = 0; i < 20 && !a.rope; i++) a.tick(inp({ hook: true }));
  assert.ok(a.rope && a.rope.to.id === t.id, 'auto-aim finds the enemy ahead');
  ok('the hook: flies, latches, misses past its reach, a tap yanks, and auto-aim finds what Dora faces');
}

// ---- the rope: whirling, never stretching, heavy things dragging
{
  const r = bare(); place(r, cx, cy); const f = r.spawn('slime', cx + 50, cy, true);
  hookOn(r, f); let maxStretch = 0, top = 0;
  for (let i = 0; i < 120; i++) { r.tick(inp({ hook: true })); maxStretch = Math.max(maxStretch, dist(r, f) - r.rope.len); top = Math.max(top, r.swing); }
  assert.ok(maxStretch < 2, `the rope never stretches (${maxStretch.toFixed(2)})`);
  assert.ok(top > SPIN.cap * 0.85, `a slime whirls up to near the top speed in two seconds (${top.toFixed(0)})`);
  assert.ok(dist(r, { x: cx, y: cy }) < 25, 'Dora barely moves swinging a slime');
  const h = bare(); place(h, cx, cy); const b = h.spawn('boar', cx + 50, cy, true); b.cd = 99;
  hookOn(h, b); let btop = 0; for (let i = 0; i < 120; i++) { h.tick(inp({ hook: true })); btop = Math.max(btop, h.swing); }
  assert.ok(btop < top * 0.75, `a boar is slower to whirl (${btop.toFixed(0)} against ${top.toFixed(0)})`);
  // a charging boar drags her across the floor
  const d = bare(); place(d, cx - 80, cy); const c = d.spawn('boar', cx - 30, cy, true);
  hookOn(d, c); c.state = 'charge'; c.t = 1.1; c.dir = { x: 1, y: 0 };
  const x0 = d.x; for (let i = 0; i < 40; i++) d.tick(inp({ hook: true }));
  assert.ok(d.x - x0 > 60, `the charging boar drags Dora (${(d.x - x0).toFixed(0)} px)`);
  ok(`the rope: never stretches, whirls a slime to ${top.toFixed(0)} px/s and a boar to ${btop.toFixed(0)}, and a charging boar drags Dora`);
}

// ---- letting go, impacts and bowling
{
  const r = bare(); place(r, cx - 120, cy); const f = r.spawn('shellback', cx - 70, cy, true);
  hookOn(r, f); for (let i = 0; i < 90; i++) r.tick(inp({ hook: true }));
  const v0 = Math.hypot(f.vx, f.vy); r.tick(inp({ hook: false }));
  assert.ok(!r.rope && f.flung > 1, 'letting go sets it flying'); assert.ok(Math.hypot(f.vx, f.vy) > v0 * 0.9, 'at its swing speed');
  // send it into a line of grumbles
  const t = bare(); place(t, cx - 140, cy); const s = t.spawn('shellback', cx - 100, cy, true); s.vx = 195; s.vy = 0; s.flung = 1.4;
  const line = [0, 1, 2].map((i) => t.spawn('grumble', cx - 40 + i * 17, cy + (i % 2) * 3, true)); for (const g of line) g.cd = 99;
  let hits = 0, kills = 0; for (let i = 0; i < 80; i++) { t.tick(inp()); hits += t.events.filter((e) => e.k === 'hit').length; kills += t.events.filter((e) => e.k === 'kill').length; }
  assert.ok(hits >= 3, `one throw bowls through the line (${hits} hits)`); assert.ok(kills >= 2, `and knocks out most of it (${kills})`);
  assert.ok(!s.dead && s.hp === FOES.shellback.hp, 'the shellback shrugs off hits slower than its armour');
  assert.ok(t.stats.bestCombo >= 3, 'a combo is counted');
  // both sides are hurt when the swung one is soft
  const b = bare(); place(b, cx - 140, cy); const sl = b.spawn('grumble', cx - 60, cy, true); sl.vx = 200; sl.flung = 1; const g2 = b.spawn('grumble', cx, cy, true); g2.cd = 99;
  run(b, 0.6); assert.ok(sl.hp < FOES.grumble.hp && (g2.hp < FOES.grumble.hp || g2.dead), 'a swung grumble is hurt by the hit too');
  ok(`impacts: letting go flings it, a shellback bowls through three grumbles (${hits} hits, ${kills} out), armour, and both sides hurt`);
}

// ---- the room: walls, spikes, pits, crates and hearts
{
  const w = bare(); const g = w.spawn('boar', FLOOR.x0 + 70, cy, true); g.vx = -260; g.flung = 1; g.cd = 99; place(w, FLOOR.x1 - 30, cy);
  let slam = false; for (let i = 0; i < 60; i++) { w.tick(inp()); if (w.events.some((e) => e.k === 'slam')) slam = true; }
  assert.ok(slam && g.hp < FOES.boar.hp && g.x >= FLOOR.x0 + g.r - 0.5, 'a wall slam hurts and it stays inside');
  const s = bare(); s.layout.spikes = [{ x: cx + 40, y: cy, r: 9 }]; const sh = s.spawn('shellback', cx, cy, true); sh.vx = 120; sh.flung = 1; sh.cd = 99; place(s, cx - 120, cy + 60);
  run(s, 0.6); assert.ok(sh.hp <= FOES.shellback.hp - 3, 'spikes pierce armour');
  const p = bare(); p.layout.pits = [{ x: cx + 50, y: cy, r: 16 }]; const sl = p.spawn('slime', cx, cy, true); sl.vx = 140; sl.flung = 1; sl.cd = 99; place(p, cx - 120, cy + 60);
  let fell = false; for (let i = 0; i < 60; i++) { p.tick(inp()); if (p.events.some((e) => e.k === 'kill' && e.how === 'fall')) fell = true; }
  assert.ok(fell, 'knocked into a pit, it falls');
  // Dora can't walk into a pit
  const q = bare(); q.layout.pits = [{ x: cx + 30, y: cy, r: 16 }]; place(q, cx - 20, cy); run(q, 1.5, inp({ x: 1 }));
  assert.ok(Math.hypot(q.x - (cx + 30), q.y - cy) > 16, 'Dora stops at the edge of a pit');
  // crates break under a flung enemy and may hold a heart
  let hearts = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const c = bare({ seed }); c.layout.crates = [{ x: cx + 30, y: cy, r: 8, broken: false }]; const gg = c.spawn('grumble', cx, cy, true); gg.vx = 160; gg.flung = 1; gg.cd = 99; place(c, cx - 120, cy + 70);
    run(c, 0.5); assert.ok(c.layout.crates[0].broken, 'the crate breaks'); hearts += c.pickups.length;
  }
  assert.ok(hearts >= 5 && hearts <= 18, `about a third of crates hold a heart (${hearts}/30)`);
  const hp = bare(); hp.hp = 3; hp.pickups = [{ x: cx + 20, y: cy, t: 0 }]; place(hp, cx, cy); run(hp, 0.5, inp({ x: 1 }));
  assert.equal(hp.hp, 4, 'a heart heals one');
  ok(`the room: wall slams, spikes through armour, pits, Dora safe at pit edges, crates (${hearts}/30 with hearts) and hearts`);
}

// ---- bomb beetles chain
{
  const r = bare(); place(r, cx - 150, cy + 80);
  const a = r.spawn('beetle', cx, cy, true), b = r.spawn('beetle', cx + 34, cy, true), gs = [r.spawn('grumble', cx + 66, cy, true), r.spawn('grumble', cx + 20, cy - 26, true)];
  for (const f of [a, b, ...gs]) f.cd = 99;
  r.hurtFoe(a, 1, 'hit'); let booms = 0; for (let i = 0; i < 30; i++) { booms += r.events.filter((e) => e.k === 'boom').length; r.tick(inp()); }
  assert.ok(a.dead && b.dead, 'one beetle sets off the next'); assert.ok(gs.every((g) => g.dead || g.hp < FOES.grumble.hp), 'the blast hurts what is near');
  ok('bomb beetles: one blast sets off the next and hurts everything near');
}

// ---- Enzo, the living anchor
{
  const r = bare(); r.layout.enzo = { x: cx, y: cy, r: 8 }; place(r, cx - 60, cy);
  for (let i = 0; i < 20 && !r.rope; i++) r.tick(inp({ ax: 1, ay: 0, hook: true }));
  assert.equal(r.rope?.to.kind, 'enzo', 'Dora hooks Enzo');
  let top = 0, worst = 0; for (let i = 0; i < 100; i++) { r.tick(inp({ hook: true })); top = Math.max(top, Math.hypot(r.vx, r.vy)); worst = Math.max(worst, dist(r, r.layout.enzo) - r.rope.len); }
  assert.ok(top > 180 && worst < 2, `she swings round him on a taut rope (${top.toFixed(0)} px/s)`);
  // whatever she meets at that speed takes the hit, and she doesn't
  const ang = Math.atan2(r.y - cy, r.x - cx), ahead = ang + 0.9 * r.rope.spin; const g = r.spawn('grumble', cx + Math.cos(ahead) * r.rope.len, cy + Math.sin(ahead) * r.rope.len, true); g.cd = 99;
  const hp = r.hp; let hit = false; for (let i = 0; i < 60; i++) { r.tick(inp({ hook: true })); if (r.events.some((e) => e.k === 'hit')) hit = true; }
  assert.ok(hit && r.hp === hp, 'Dora is the flail: she hits it, it does not hurt her');
  r.tick(inp({ hook: false })); assert.ok(!r.rope && r.flying > 0, 'letting go of Enzo flings Dora');
  ok(`Enzo: Dora swings round him at ${top.toFixed(0)} px/s, slams what she meets, and flies when she lets go`);
}

// ---- the dash
{
  const r = bare(); place(r, cx, cy); const g = r.spawn('grumble', cx + 20, cy, true); g.cd = 99; g.vx = -40;
  r.tick(inp({ x: 1, dash: true })); let hurt = false; for (let i = 0; i < 9; i++) { r.tick(inp({ x: 1, dash: true })); if (r.events.some((e) => e.k === 'hurt')) hurt = true; }
  assert.ok(!hurt && r.x > cx + 25, 'dashing through an enemy is safe');
  const c = bare(); place(c, cx, cy); const f = c.spawn('slime', cx + 50, cy, true); hookOn(c, f); for (let i = 0; i < 30; i++) c.tick(inp({ hook: true }));
  const before = c.swing; c.tick(inp({ hook: true, dash: true })); assert.ok(c.swing > before + 40, 'a dash cracks the rope like a whip');
  ok('the dash: safe through enemies, and a whip-crack of swing speed');
}

// ---- enemies
{
  const r = bare(); place(r, cx, cy); r.spawn('grumble', cx + 40, cy, true); run(r, 2);
  assert.ok(r.hp < 5, 'a grumble walks up and hurts'); const hp = r.hp; run(r, 0.5); assert.ok(r.hp >= hp - 1, 'then a moment of safety');
  const s = bare(); place(s, cx - 100, cy); const sp = s.spawn('spitter', cx + 60, cy, true); sp.cd = 0;
  let shot = false, tele = false; for (let i = 0; i < 120; i++) { s.tick(inp()); if (s.events.some((e) => e.k === 'telegraph')) tele = true; if (s.events.some((e) => e.k === 'shot')) shot = true; }
  assert.ok(tele && shot, 'the spitter warns, then spits');
  assert.ok(s.hp < 5, 'its acorn hurts');
  // a swung enemy blocks acorns
  const b = bare(); place(b, cx - 60, cy); const shield = b.spawn('grumble', cx - 40, cy, true); hookOn(b, shield);
  b.shots.push({ x: cx + 80, y: cy, vx: -150, vy: 0, r: 3, kind: 'acorn', dead: false });
  let blocked = 0; for (let i = 0; i < 90; i++) { b.tick(inp({ hook: true })); blocked += b.events.filter((e) => e.k === 'tink').length; }
  assert.equal(b.hp, 5, 'the whirling grumble blocks the acorn'); assert.ok(blocked >= 1);
  // the boar telegraphs, charges, and stuns itself on a wall
  const c = bare(); place(c, FLOOR.x0 + 30, cy); const boar = c.spawn('boar', cx - 40, cy, true); boar.cd = 0;
  let stunned = false; for (let i = 0; i < 180; i++) { c.tick(inp({ y: i < 60 ? 0 : -1 })); if (boar.state === 'charge') c.y = FLOOR.y0 + 20; if (boar.state === 'stun') stunned = true; }
  assert.ok(stunned && boar.hp < FOES.boar.hp, 'a charging boar that hits the wall is stunned and hurt');
  // the golem slams and throws, and calls for help
  const g = bare({ arena: ARENAS - 1 }); place(g, cx, FLOOR.y1 - 20); const gol = g.spawn('golem', cx, cy - 30, true); gol.cd = 0;
  const kinds = new Set(); for (let i = 0; i < 60 * 12; i++) { g.tick(inp()); for (const e of g.events) kinds.add(e.k); if (g.hp < 3) g.hp = 5; }
  assert.ok(kinds.has('quake') && kinds.has('shot') && kinds.has('summon'), `the golem slams, throws and summons (${[...kinds].join(' ')})`);
  ok('enemies: grumbles bite, spitters warn then spit, a swung enemy is a shield, boars charge and stun, the golem slams, throws and summons');
}

// ---- the run
{
  const r = new Run({ seed: 11 });
  assert.equal(r.layout.waves.length, 2); assert.equal(r.queue.length, 4);
  run(r, 4); assert.equal(r.foes.filter((f) => !f.dead).length, 4, 'the first wave arrives');
  for (const f of r.foes) r.hurtFoe(f, 99, 'boom'); run(r, 2); assert.equal(r.waveIx, 1, 'then the second');
  for (let i = 0; i < 6; i++) { run(r, 0.6); for (const f of r.foes) r.hurtFoe(f, 99, 'boom'); }
  run(r, 1); assert.equal(r.phase, 'pick', 'arena clear: pick an upgrade'); assert.equal(r.offer.length, 3); assert.equal(new Set(r.offer).size, 3);
  assert.ok(!r.pick('nope')); const up = r.offer[0]; assert.ok(r.pick(up)); assert.equal(r.mods[up], 1); assert.equal(r.arena, 1); assert.equal(r.phase, 'fight');
  // every upgrade does something to the numbers it names
  const m = new Run({ seed: 1, mods: { long: 2, heart: 1, dash: 2, heavy: 2 } });
  assert.equal(m.ropeMax, ROPE.max + 44); assert.equal(m.maxHp, 6); assert.ok(m.dashCdMax < 0.3); assert.ok(m.mass > 6);
  for (const u of UPGRADES) assert.ok(u.max >= 2 && u.line.length > 10);
  // maxed upgrades are not offered
  const x = new Run({ seed: 2, mods: Object.fromEntries(UPGRADES.map((u) => [u.id, u.max])) }); x.phase = 'fight'; for (const f of x.foes) f.dead = true; x.queue = []; x.waveIx = x.layout.waves.length - 1; run(x, 1);
  assert.equal(x.offer.length, 0); assert.ok(x.pick(), 'with nothing on offer, Dora just goes on'); assert.equal(x.arena, 1);
  // losing
  const l = bare(); l.hp = 1; place(l, cx, cy); l.spawn('grumble', cx + 30, cy, true); run(l, 3);
  assert.equal(l.phase, 'lost');
  // winning: the golem down
  const w = new Run({ seed: 3, arena: ARENAS - 1 }); run(w, 3); const gol = w.foes.find((f) => f.kind === 'golem'); assert.ok(gol);
  w.hurtFoe(gol, 99, 'boom'); run(w, 2); assert.equal(w.phase, 'won');
  // a seed replays exactly
  const play = (seed) => { const a = new Run({ seed }); for (let i = 0; i < 60 * 25; i++) { const t = i / 60; a.tick(inp({ x: Math.sin(t), y: Math.cos(t * 0.7), hook: i % 90 < 60, dash: i % 200 === 0 })); if (a.phase !== 'fight') break; } return JSON.stringify([a.x, a.y, a.hp, a.stats, a.foes.map((f) => [f.kind, f.x, f.y, f.hp])]); };
  assert.equal(play(42), play(42)); assert.notEqual(play(42), play(43));
  ok('the run: waves, a cleared arena, three upgrades on offer, every upgrade applied, losing, winning, and seeded replays');
}

// ---- the save
{
  const s = newSave(); assert.deepEqual(parseSave(serialise(s)), s);
  assert.deepEqual(parseSave('{bad'), newSave()); assert.deepEqual(parseSave('{"v":2}'), newSave()); assert.deepEqual(parseSave(null), newSave());
  const odd = parseSave(JSON.stringify({ v: 1, best: { arena: -3, kills: 'x' }, seen: ['boar', 'dragon'], settings: { sound: false } }));
  assert.equal(odd.best.arena, 0); assert.equal(odd.best.kills, 0); assert.deepEqual(odd.seen, ['boar']); assert.equal(odd.settings.sound, false); assert.equal(odd.settings.music, true);
  const r = new Run({ seed: 1 }); r.stats.kills = 12; r.stats.bestCombo = 5; r.stats.topSpeed = 230; r.arena = 4; r.phase = 'lost'; bank(s, r);
  assert.deepEqual(s.best, { arena: 5, kills: 12, combo: 5, speed: 9 }); assert.equal(s.stats.runs, 1);
  ok('the save: round trip, corrupt and wrong-version saves ignored, odd values cleaned, a run banked');
}

console.log(`\n${n} Tetherball checks passed`);
