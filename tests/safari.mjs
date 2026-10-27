// Snapshot Safari engine checks: the creatures and trails, moving and being noticed, scoring a photo, the tools,
// the end of the day, the journal and its unlocks, and the save.
import assert from 'node:assert/strict';
import {
  SPECIES, SPECIES_BY_ID, TRAILS, TIMES, UNLOCKS, LIGHT, FILM, DAY, DT, BERRIES, TRAP_FRAMES, PACE_SPEED, NOISE, ZOOM, FRAME_H, ASPECT, ALL_SLOTS, MAX_STARS,
  SafariGame, layTrail, rng, scoreView, frameOf, boxOf, behaviourOf, comment, hint, slotKey, freshProfile, readProfile, cleanPhoto, journalStars, slotsFilled,
  isOpen, nextUnlock, toolsFor, develop, paste, SAVE_KEY, WHISTLE_COOLDOWN,
} from '../.checks/safari-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const TI = { morning: 0, noon: 1, dusk: 2 };

// ---- the creatures
ok(SPECIES.length === 24 && new Set(SPECIES.map((s) => s.id)).size === 24, 'twenty-four creatures with their own ids');
ok(SPECIES.every((s) => s.b.length >= 3 && s.b.length <= 4 && new Set(s.b.map((b) => b.id)).size === s.b.length), 'each has three or four behaviours with their own ids');
const behaviours = SPECIES.flatMap((s) => s.b), rares = behaviours.filter((b) => b.rare);
ok(behaviours.length >= 76 && behaviours.length <= 86 && ALL_SLOTS.length === behaviours.length, `about eighty journal slots (${behaviours.length})`);
ok(rares.length >= behaviours.length * 0.2 && rares.length <= behaviours.length * 0.32, `about a quarter are rare (${rares.length})`);
ok(MAX_STARS === behaviours.length * 5, 'five stars a slot');
for (const s of SPECIES) {
  ok(s.w > 0 && s.h > 0 && s.shy >= 0 && s.shy <= 1 && s.group[0] >= 1 && s.group[1] >= s.group[0] && s.fact.length > 20, `${s.id}: sizes, shyness, group and a fact`);
  ok(Object.keys(s.where).length >= 1 && Object.keys(s.where).every((t) => TRAILS.some((x) => x.id === t)), `${s.id}: lives on a real trail`);
  for (const b of s.b) {
    ok(b.dur[0] > 0 && b.dur[1] >= b.dur[0] && b.motion >= 0 && b.motion <= 1 && b.face >= 0 && b.face <= 1, `${s.id}.${b.id}: well formed`);
    // every slot can be found somewhere, at some time, with some tool
    const somewhere = Object.entries(s.where).some(([, w]) => w.some((x, i) => x > 0 && (b.w[i] > 0 || b.need === 'berries' || b.need === 'whistle')));
    ok(somewhere, `${s.id}.${b.id}: can be photographed somewhere`);
    if (b.need === 'berries') ok(b.w.every((x) => x === 0), `${s.id}.${b.id}: only berries start it`);
    if (b.need === 'whistle') ok(b.w.every((x) => x === 0), `${s.id}.${b.id}: only a whistle starts it`);
    ok(hint(s, b).length > 3, `${s.id}.${b.id}: has a hint`);
  }
}
ok(SPECIES_BY_ID.chinchilla && SPECIES_BY_ID.cat.b.some((b) => b.need === 'alone'), 'wild chinchilla cousins, and a cat only a camera trap sees prowling');
for (const tr of TRAILS) for (const tm of TIMES) {
  const n = SPECIES.filter((s) => (s.where[tr.id]?.[TI[tm.id]] ?? 0) > 0).length;
  ok(n >= 5, `${tr.id}/${tm.id}: ${n} creatures about`);
}
ok(SPECIES_BY_ID.cat.where.cliffs[2] > 0 && SPECIES_BY_ID.cat.where.cliffs[0] === 0, 'the Andean cat only comes out at dusk');
ok(LIGHT.puna[2] > LIGHT.puna[0] && LIGHT.puna[0] > LIGHT.puna[1], 'dusk glows most and noon is harsh');
eq(UNLOCKS.map((u) => [u.id, u.need]), [['noon', 12], ['forest', 30], ['berries', 50], ['dusk', 70], ['salar', 95], ['whistle', 125], ['cliffs', 155], ['trap', 190]], 'unlocks by journal stars');

// ---- the generator and the trail
{
  const a = rng(42), b = rng(42), xs = Array.from({ length: 50 }, () => a());
  eq(xs, Array.from({ length: 50 }, () => b()), 'the seeded generator repeats');
  ok(xs.every((x) => x >= 0 && x < 1), 'and stays in [0, 1)');
  for (const tr of TRAILS) {
    const t = layTrail(tr.id, 'morning', rng(7));
    ok(t.features.every((f, i) => i === 0 || f.x >= t.features[i - 1].x), `${tr.id}: features in order`);
    ok(t.features.every((f) => f.x >= 0 && f.x <= t.len && f.w > 0), `${tr.id}: features on the trail`);
    ok(t.features.filter((f) => f.kind === 'grass').length >= 7, `${tr.id}: plenty of cover to hide in`);
  }
  ok(layTrail('salar', 'noon', rng(3)).features.some((f) => f.kind === 'water'), 'the salt flat has its lagoons');
  ok(layTrail('forest', 'noon', rng(3)).features.filter((f) => f.kind === 'tree').length >= 10, 'the cloud forest has its trees');
}

// ---- outings replay exactly from a seed
const all = { berries: true, whistle: true, trap: true };
{
  const run = (seed) => {
    const g = new SafariGame({ trail: 'puna', time: 'morning', seed, tools: all });
    for (let i = 0; i < 1800; i++) { if (i === 30) g.move(1, 'walk'); if (i === 600) g.move(1, 'tiptoe'); if (i === 900) g.move(0); if (i % 200 === 0) { g.aim(g.x + 6, 1, 3); g.snap(); } g.step(); }
    return JSON.stringify({ x: g.x, a: g.animals.map((a) => [a.x, a.y, a.beh, a.state, a.alarm]), p: g.photos });
  };
  ok(run(11) === run(11), 'the same seed and inputs replay exactly');
  ok(run(11) !== run(12), 'a different seed is a different outing');
  const g = new SafariGame({ trail: 'cliffs', time: 'dusk', seed: 5 });
  ok(new Set(g.animals.map((a) => a.group)).size === 5 && g.animals.every((a) => (a.sp.where.cliffs?.[2] ?? 0) > 0), 'five groups of creatures that live there at that time');
  ok(g.animals.every((a) => a.sp.spot !== 'rock' || a.baseY > 0), 'rock-dwellers sit up on their rocks');
}

// ---- moving
{
  const g = new SafariGame({ trail: 'puna', time: 'morning', seed: 1 });
  ok(g.film === FILM && g.berries === 0 && g.state === 'out' && g.x === 4, 'a fresh outing: full film, no tools');
  g.move(1, 'walk'); for (let i = 0; i < 30; i++) g.step();
  ok(Math.abs(g.x - (4 + PACE_SPEED.walk)) < 1e-6, 'walking covers 2 m a second');
  g.move(1, 'run'); for (let i = 0; i < 15; i++) g.step();
  ok(g.steady === 0, 'hurrying shakes the camera');
  g.move(0); for (let i = 0; i < 45; i++) g.step();
  ok(g.steady > 0.95, 'standing still steadies it');
  g.move(-1, 'run'); for (let i = 0; i < 300; i++) g.step();
  ok(g.x === 0, 'the trail starts at 0');
  ok(NOISE.run > NOISE.walk && NOISE.walk > NOISE.tiptoe && NOISE.tiptoe > NOISE.still, 'hurrying is loudest, standing still the quietest');
  const cov = g.trail.features.find((f) => f.kind === 'grass');
  g.x = cov.x; g.move(0); g.hide(true);
  ok(g.hidden && g.noise() === 0, 'crouching in tall grass hides you completely');
  g.move(0, 'tiptoe'); ok(g.hidden, 'choosing a pace without moving keeps you hidden');
  g.move(1, 'tiptoe'); ok(!g.hidden && g.noise() < NOISE.tiptoe, 'moving stands you up, though cover still muffles you');
  g.x = cov.x + cov.w + 3; while (g.cover()) g.x += 1; g.move(0); g.hide(true);
  ok(!g.hidden && g.noise() === NOISE.still, 'out in the open, crouching does not hide you');
  g.aim(g.x + 100, -5, 99);
  ok(g.view.x === g.x + 14 && g.view.y === 0 && g.view.zoom === ZOOM[1], 'the viewfinder stays in reach');
}

// ---- being noticed
{
  const near = (shyId, pace, hide = false) => {
    for (let seed = 1; seed < 500; seed++) {
      const g = new SafariGame({ trail: 'puna', time: 'morning', seed });
      const a = g.animals.find((x) => x.sp.id === shyId); if (!a) continue;
      g.x = a.x - 22; g.move(1, pace);
      for (let i = 0; i < 30 * 40 && a.state === 'live'; i++) { if (hide && a.x - g.x < 12) { g.move(0); g.hide(true); } g.step(); }
      return { a, g };
    }
  };
  const run = near('vicuna', 'run');
  ok(run.a.state !== 'live', 'hurrying at vicuñas sends them trotting off');
  ok(run.g.events.some((e) => e.kind === 'flee' && e.sp === 'vicuna'), 'and says so');
  const hidden = near('vicuna', 'tiptoe', true);
  ok(hidden.a.state === 'live', 'tiptoeing in and hiding keeps them close');
  ok(hidden.a.calm > 0.6, `and calms them down (${hidden.a.calm.toFixed(2)})`);
  const llama = near('llama', 'walk');
  ok(llama.a.state === 'live', 'easy-going llamas do not mind a walk past');
}

// ---- scoring a photo
{
  const g = new SafariGame({ trail: 'salar', time: 'dusk', seed: 9 });
  const flam = g.animals.find((a) => a.sp.id === 'flamingo');
  ok(flam, 'flamingos on the lagoon');
  const solo = (setup) => { const a = { ...flam, state: 'live', alarm: 0, face: 'toward', beh: 0, cub: false, y: 0, ...setup }; return [a]; };
  const ctx = { tr: 'salar', tm: 'dusk', who: 'dora', day: 1, id: 't' };
  const at = (a, nx = 0, ny = 0, zoom = 2) => { const b = boxOf(a), F = frameOf({ x: 0, y: 0, zoom }); return { x: b.cx - nx * F.fw, y: b.cy + ny * F.fh, zoom }; };
  const one = solo({ x: 50 });
  const good = scoreView(one, at(one[0], 1 / 6, 1 / 6), 1, ctx);
  ok(good && good.st >= 4 && good.sp === 'flamingo' && good.bh === 'filter', `a sharp, well-framed flamingo on a third scores well (${good.st}★)`);
  ok(good.k.every((v) => v >= 0 && v <= 1) && good.pts > 60, 'with its breakdown');
  const centre = scoreView(one, at(one[0]), 1, ctx);
  ok(centre.k[1] >= 0.85 && centre.k[1] <= good.k[1], 'the centre frames nicely, a third even better');
  const edge = scoreView(one, at(one[0], 0.38, 0.1), 1, ctx);
  ok(edge.k[1] < 0.4, 'off at the edge frames poorly');
  const tiny = scoreView(one, at(one[0], 0, 0, 1), 1, { ...ctx }), tiny2 = scoreView(solo({ x: 50 }), { ...at(one[0], 0, 0, 1), zoom: 1 }, 1, ctx);
  ok(tiny.k[0] < 1 && tiny2, 'wide shots make the subject smaller');
  const far = scoreView(solo({ x: 50, sp: { ...flam.sp, h: 0.2, w: 0.15 } }), at(one[0], 0, 0, 1), 1, ctx);
  ok(far.st === 0 && far.k[0] === 0, 'a speck is no photo at all');
  const shaky = scoreView(one, at(one[0], 1 / 6, 1 / 6), 0, ctx);
  ok(shaky.st <= 1 && shaky.k[2] < 0.35, 'a shaky camera blurs it');
  const back = scoreView(solo({ x: 50, face: 'away' }), at(one[0], 1 / 6, 1 / 6), 1, ctx);
  ok(back.k[3] < 0.3 && back.pts < good.pts, 'a view of its back is worth less');
  const fleeing = scoreView(solo({ x: 50, state: 'flee' }), at(one[0], 1 / 6, 1 / 6), 1, ctx);
  ok(fleeing.k[2] < good.k[2], 'an animal running off is blurrier');
  const dance = flam.sp.b.findIndex((b) => b.id === 'march');
  const rare = scoreView(solo({ x: 50, beh: dance }), at(one[0], 1 / 6, 1 / 6), 1, ctx);
  ok(rare.rare && rare.st === 5, `a rare flamingo dance, done well, is worth five stars (${rare.st}★)`);
  const noon = scoreView(one, at(one[0], 1 / 6, 1 / 6), 1, { ...ctx, tm: 'noon' });
  ok(noon.pts < good.pts && noon.light < good.light, 'harsh noon light is worth less than dusk');
  const pair = [one[0], { ...one[0], x: 50.9 }];
  const both = scoreView(pair, at(one[0], 0, 0, 2.2), 1, ctx);
  ok(both.ex.length === 1 && both.ex[0].sp === 'flamingo', 'a friend in the frame is recorded');
  ok(scoreView(one, { x: 80, y: 1, zoom: 3 }, 1, ctx) === null, 'an empty frame has no subject');
  const half = scoreView(one, at(one[0], 0.5, 0), 1, ctx);
  ok(half === null, 'half an animal at the edge does not count');
  ok(scoreView(one, at(one[0], 1 / 6, 1 / 6), 1, ctx).st === good.st, 'scoring is pure');
  ok(Object.keys(good).every((k) => ['sp', 'bh', 'nx', 'ny', 'sz', 'dir', 'face', 'cub', 'st', 'pts', 'tr', 'tm', 'who', 'ax', 'ay', 'z', 'sharp', 'k', 'ex', 'rare', 'light', 'day', 'id', 'trap'].includes(k)), 'a photo is a compact description');
  for (const p of [null, good, far, shaky, back, rare, both, edge]) ok(typeof comment(p) === 'string' && comment(p).length > 10, 'every photo gets a kind comment');
  ok(/speck|far/i.test(comment(far)) && /wobbl|movement/i.test(comment(shaky)), 'comments say what to try next');
}

// ---- snapping
{
  const g = new SafariGame({ trail: 'puna', time: 'morning', seed: 2 });
  const a = g.animals[0]; g.x = a.x - 8; g.aim(a.x, a.y + 0.6, 2);
  for (let i = 0; i < 30; i++) g.step();
  const p = g.snap();
  ok(g.film === FILM - 1, 'a photo uses a frame of film');
  ok(g.snap() === undefined && g.film === FILM - 1, 'the shutter needs half a second to wind on');
  ok(p === null || p.sp, 'a snap returns its photo');
  g.film = 0; for (let i = 0; i < 30; i++) g.step();
  ok(g.snap() === undefined, 'no film, no photo');
  ok(g.events.some((e) => e.kind === 'snap'), 'the page hears the shutter');
}

// ---- tools
{
  ok(new SafariGame({ trail: 'puna', time: 'noon', seed: 3 }).toss() === false, 'no pouch, no berries');
  let found = false;
  for (let seed = 1; seed < 300 && !found; seed++) {
    const g = new SafariGame({ trail: 'puna', time: 'morning', seed, tools: all });
    const a = g.animals.find((x) => x.sp.id === 'llama'); if (!a) continue; found = true;
    g.x = a.x - 7; g.dir = 1; for (let i = 0; i < 30; i++) g.step();
    ok(g.berries === BERRIES && g.toss() && g.berries === BERRIES - 1 && !g.toss(), 'three handfuls, one on the ground at a time');
    let ate = false;
    for (let i = 0; i < 30 * 20 && !ate; i++) { g.step(); if (behaviourOf(a).need === 'berries') ate = true; }
    ok(ate && Math.abs(a.x - (g.x + 4)) < 1, 'a llama trots over for a berry snack');
  }
  ok(found, 'found a llama');
  found = false;
  for (let seed = 1; seed < 300 && !found; seed++) {
    const g = new SafariGame({ trail: 'puna', time: 'morning', seed, tools: all });
    const a = g.animals.find((x) => x.sp.id === 'tinamou'); if (!a) continue; found = true;
    g.x = a.x - 8;
    ok(g.whistle() && behaviourOf(a).id === 'call', 'a tinamou whistles back');
    ok(!g.whistle(), 'the whistle needs a rest');
    for (let i = 0; i <= 30 * WHISTLE_COOLDOWN; i++) g.step();
    ok(g.whistle(), 'and works again later');
  }
  ok(found, 'found a tinamou');
  ok(!new SafariGame({ trail: 'puna', time: 'morning', seed: 1 }).whistle(), 'no whistle until it is unlocked');
  // the camera trap
  found = false;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const g = new SafariGame({ trail: 'puna', time: 'morning', seed, tools: all });
    const a = g.animals.find((x) => x.sp.id === 'vicuna' && x.y === 0); if (!a) continue; found = true;
    g.x = a.x; ok(g.placeTrap() && !g.placeTrap(), 'one camera trap per outing');
    g.x = Math.max(0, a.x - 30);
    for (let i = 0; i < 30 * 60; i++) { a.x = g.trap.x + Math.sin(i / 40); a.state = 'live'; a.alarm = 0; g.step(); }
    ok(g.trap.shots.length >= 1 && g.trap.shots.length <= TRAP_FRAMES, `the trap snaps creatures passing while you are away (${g.trap.shots.length})`);
    ok(g.trap.shots.every((p) => p.trap && p.sharp > 0.4), 'trap photos are marked and steady');
    ok(g.photos.every((p) => !p.trap), 'they stay in the trap until you fetch it');
    ok(g.trapLost, 'leaving now would lose them');
    g.x = g.trap.x; g.step();
    ok(g.trap.back && g.photos.filter((p) => p.trap).length === g.trap.shots.length && !g.trapLost, 'walking back fetches the trap and its photos');
    ok(g.events.some((e) => e.kind === 'trapBack'), 'with a cheer');
  }
  ok(found, 'found a vicuña');
}

// ---- the day
{
  const g = new SafariGame({ trail: 'forest', time: 'noon', seed: 4 });
  for (let i = 0; i < 10; i++) g.tick(0.1);
  ok(Math.abs(g.t - 1) <= DT + 1e-9, 'the clock runs in fixed steps');
  g.tick(5); ok(g.t < 1.3, 'a long stall only catches up a quarter of a second');
  while (g.state === 'out') g.step();
  ok(Math.abs(g.t - DAY) < DT * 1.5 && g.events.some((e) => e.kind === 'late') && g.events.some((e) => e.kind === 'end'), 'the day ends after six minutes, with a warning first');
  const n = g.t; g.step(); g.move(1); ok(g.t === n && g.snap() === undefined, 'nothing happens once home');
  const h = new SafariGame({ trail: 'forest', time: 'noon', seed: 4 }); h.home(); ok(h.state === 'done', 'or head home whenever you like');
}

// ---- the journal
{
  const p = freshProfile();
  ok(isOpen(p, 'puna') && isOpen(p, 'morning') && !isOpen(p, 'noon') && !isOpen(p, 'forest'), 'a new journal starts with the grassland in the morning');
  eq(toolsFor(p), { berries: false, whistle: false, trap: false }, 'and no tools');
  eq(nextUnlock(p).id, 'noon', 'noon opens first');
  const g = new SafariGame({ trail: 'puna', time: 'morning', seed: 2 });
  const shot = (sp, bh, st, pts = 50) => ({ ...scoreView([{ ...g.animals[0], sp: SPECIES_BY_ID[sp], beh: SPECIES_BY_ID[sp].b.findIndex((b) => b.id === bh), state: 'live', x: 10, y: 0, face: 'toward' }], { x: 10, y: 0.7, zoom: 3 }, 1, { tr: 'puna', tm: 'morning', who: 'dora', day: 1, id: 'x' }), st, pts });
  const roll = [shot('llama', 'chew', 3), shot('llama', 'chew', 4), shot('vicuna', 'graze', 2), shot('vicuna', 'graze', 0)];
  const dev = develop(p, roll);
  eq(dev.map((d) => d.keep), [false, true, true, false], 'developing suggests the best of each new slot');
  ok(dev.every((d) => d.isNew), 'both slots are new');
  const news = paste(p, roll, dev.filter((d) => d.keep).map((d) => d.photo));
  ok(journalStars(p) === 6 && slotsFilled(p) === 2 && p.outings === 1 && p.shots === 4, 'pasting fills the journal');
  ok(news.includes('2 NEW PAGE SLOTS'), 'and says so');
  ok(p.best.st === 4 && p.bestRoll === 9 && p.seen.includes('llama'), 'the best photo and roll are kept');
  const d2 = develop(p, [shot('llama', 'chew', 3), shot('llama', 'chew', 5)]);
  ok(!d2[0].better && d2[1].better && d2[1].keep, 'only a better shot replaces a journal photo');
  paste(p, [], [shot('llama', 'chew', 2)]);
  ok(p.journal['llama:chew'].st === 4, 'a worse photo never replaces a better one');
  const big = SPECIES.flatMap((s) => s.b.slice(0, 2).map((b) => shot(s.id, b.id, 5)));
  const n2 = paste(p, big, big);
  ok(n2.includes('UNLOCKED: NOON OUTINGS') && n2.includes('UNLOCKED: CAMERA TRAP'), 'stars unlock times, trails and tools');
  ok(isOpen(p, 'cliffs') && toolsFor(p).trap && nextUnlock(p) === null, 'everything opens in the end');

  // the save
  const raw = JSON.stringify(p), back = readProfile(raw);
  eq(back, JSON.parse(raw), 'a save reads back exactly');
  eq(readProfile(null), freshProfile(), 'no save, a fresh journal');
  eq(readProfile('{nope'), freshProfile(), 'a broken save starts afresh');
  eq(readProfile('[1,2]'), freshProfile(), 'so does a strange one');
  const bad = JSON.parse(raw);
  bad.journal['llama:chew'].st = 9; bad.journal['vicuna:graze'].sp = 'dragon'; bad.journal['alpaca:graze'] = bad.journal['llama:peek'] ?? bad.journal['llama:chew'];
  bad.outings = -3; bad.who = 'zebra'; bad.trail = 'moon'; bad.seen = ['llama', 'unicorn', 'llama'];
  const fixed = readProfile(JSON.stringify(bad));
  ok(!fixed.journal['llama:chew'] && !fixed.journal['vicuna:graze'] && !fixed.journal['alpaca:graze'], 'impossible photos are dropped');
  ok(fixed.outings === 0 && fixed.who === 'dora' && fixed.trail === 'puna', 'odd numbers and names fall back');
  eq(fixed.seen, ['llama'], 'unknown creatures are forgotten');
  const locked = readProfile(JSON.stringify({ trail: 'cliffs', time: 'dusk' }));
  ok(locked.trail === 'puna' && locked.time === 'morning', 'a save cannot pick a locked trail or time');
  ok(cleanPhoto({ ...good(), k: [2, 0, 0, 0] }) === null, 'photo scores stay in range');
  function good() { return JSON.parse(raw).journal['llama:chew']; }
  ok(SAVE_KEY === 'snapshot-safari-v1', 'saved under a versioned key');
}

console.log(`Snapshot Safari: ${checks} engine checks passed.`);
