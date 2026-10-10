import assert from 'node:assert/strict';
import {
  Game, SPECIES, byId, weight, zoneAt, pullAt, requestText, BANDS, REACH, DORA_CAST, ENZO_WINDOW, CHARGE_RATE, MIN_CHARGE, FLIGHT, SETTLE, LINGER,
  BITE_WINDOW, BOBBER_WINDOW, NIBBLE, BASE_CASTS, TIMES, WEATHERS, LURES, ZONES, UPGRADES, UPGRADE_IDS, LURE_COST, SHELLS, CURIO_SHELLS, BAND_LOW, BAND_HIGH,
  LINE_BAND, SNAP_AFTER, LINE_STRAIN, SLIP_AFTER, JUMP, TELL, FULL_MOON, SAVE_VERSION, STEP, MOON_RADIUS,
} from '../.checks/moonpond-game.js';
import { play } from './moonpond-bot.mjs';

const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`);
const step = (g, input = {}, n = 1) => { for (let i = 0; i < n; i++) g.update(STEP, input); };
const secs = (g, s, input = {}) => step(g, input, Math.round(s / STEP));
/** Charges to a fraction of a full cast and lets go. */
const cast = (g, charge) => { step(g, { hold: true }); for (let i = 0; i < 400 && g.charge < charge; i++) step(g, { hold: true }); step(g); };
/** Casts, waits out the flight and returns with the bobber in the water. */
const land = (g, d) => { cast(g, d / g.reach); assert.equal(g.state, 'flying'); secs(g, FLIGHT + 0.05); assert.equal(g.state, 'waiting'); };
/** Waits for the real bite and hooks it half-way through the window. */
const hook = (g) => { while (!g.biting) step(g); secs(g, g.bite.window / 2); step(g, { hold: true }); assert.equal(g.state, 'hooked'); };
/** A careful hand on the reel: eases off near the top of the band and for every leap. */
const fight = (g, limit = 240) => {
  let hold = true;
  for (let i = 0; i < limit * 60 && g.state === 'hooked'; i++) {
    const f = g.fight;
    if (f.jump || f.tell || f.tension > g.bandHigh - 0.06) hold = false; else if (f.tension < g.bandHigh - 0.16) hold = true;
    step(g, { hold });
  }
};
const dismiss = (g) => { secs(g, LINGER + 0.05); step(g, { hold: true }); step(g); };
/** Puts a chosen creature on the line. */
const rig = (g, id, size) => {
  const sp = byId.get(id);
  g.bob = { aim: 0, d: 0.3, zone: sp.zone }; g.state = 'hooked';
  g.bite = { id, at: 0, nibbles: [], window: g.window, size: size ?? (sp.size ? sp.size[0] : 0), o1: 0.3, o2: 0.6 };
  g.fight = { p: 0, tension: 0.45, strain: 0, slack: 0, tau: 0, pull: 0, jump: false, tell: false, strained: false };
  return sp;
};

// ---------- The journal's shape ----------
assert.equal(SPECIES.length, 40);
assert.equal(new Set(SPECIES.map((x) => x.id)).size, 40);
assert.equal(SPECIES.filter((x) => x.kind === 'creature').length, 30);
assert.equal(SPECIES.filter((x) => x.kind === 'curio').length, 6);
assert.equal(SPECIES.filter((x) => x.kind === 'legend').length, 4);
for (const sp of SPECIES) {
  assert.ok(ZONES.includes(sp.zone) && sp.clue.length > 10 && sp.strength > 0 && sp.strength <= 1, sp.id);
  if (sp.kind === 'curio') assert.equal(sp.size, undefined); else assert.ok(sp.size[0] < sp.size[1], `${sp.id} has a size range`);
  if (sp.kind === 'legend') assert.ok(sp.phase?.length && sp.time && sp.lure, `${sp.id} is tied to the moon, an hour and a lure`);
}
for (const zone of ['reeds', 'lily', 'open', 'deep']) assert.ok(SPECIES.filter((x) => x.zone === zone && x.rarity === 1 && !x.weather).length >= 3, `${zone} always has commons to bite`);

// ---------- Who comes to the lure ----------
{
  const none = () => false, all = () => true, at = (over) => ({ zone: 'reeds', time: 'dusk', weather: 'clear', lure: 'glow', phase: 3, ...over });
  const peeper = byId.get('rain-peeper'), newt = byId.get('dusk-newt'), koi = byId.get('moon-koi'), button = byId.get('lost-button');
  assert.equal(weight(peeper, at({}), none), 0, 'an uncommon creature needs its weather');
  assert.ok(weight(peeper, at({ weather: 'rain' }), none) > 0);
  assert.equal(weight(peeper, at({ weather: 'rain', zone: 'lily' }), none), 0, 'and its own water');
  assert.ok(weight(newt, at({ time: 'midnight' }), none) > 0, 'a common still turns up off its hour');
  assert.ok(weight(newt, at({}), none) > weight(newt, at({ time: 'midnight' }), none) * 3, 'but far more at the right one');
  assert.ok(weight(newt, at({}), none) > weight(newt, at({}), all), 'a creature not yet sketched is more curious');
  assert.ok(weight(button, at({}), none) > weight(button, at({}), all));
  const koiNight = at({ zone: 'moon', time: 'midnight', lure: 'glow', phase: FULL_MOON });
  assert.equal(weight(koi, koiNight, none), 0, 'the Moon Koi waits for the other three legends');
  assert.ok(weight(koi, koiNight, (id) => ['ink-eel', 'crescent-carp', 'old-mossback'].includes(id)) > 0);
  assert.equal(weight(koi, { ...koiNight, phase: 3 }, all), 0);
  // Every entry has a night on which it can be caught.
  for (const sp of SPECIES) {
    const c = { zone: sp.zone, time: sp.time?.[0] ?? 'dusk', weather: sp.zone === 'moon' ? 'clear' : sp.weather?.[0] ?? 'clear', lure: sp.lure?.[0] ?? 'glow', phase: sp.phase?.[0] ?? 3 };
    assert.ok(weight(sp, c, all) > 0, `${sp.id} comes under its own conditions`);
    if (sp.zone === 'moon') assert.ok(!sp.weather || sp.weather.includes('clear'), `${sp.id} can only be met under a clear sky`);
  }
  const g = new Game(3), odds = g.odds('lily');
  near(odds.reduce((a, o) => a + o.chance, 0), 1, 'the odds add up');
  assert.ok(odds.every((o) => o.sp.zone === 'lily'));
}

// ---------- Nights ----------
{
  const g = new Game(5);
  assert.equal(g.casts, BASE_CASTS); assert.equal(g.phase, 0); assert.equal(g.hour, 'dusk'); assert.equal(g.requests.length, 3);
  const hours = []; for (let c = 0; c < g.casts; c++) { g.cast = c; hours.push(g.hour); }
  assert.deepEqual(hours, ['dusk', 'dusk', 'moonrise', 'moonrise', 'midnight', 'midnight', 'firstlight', 'firstlight']);
  g.up.oil = 4; const twelve = []; for (let c = 0; c < g.casts; c++) { g.cast = c; twelve.push(g.hour); }
  assert.equal(g.casts, 12); for (const t of TIMES) assert.equal(twelve.filter((h) => h === t).length, 3, 'twelve casts are three at each hour');
  const seen = new Set(), h = new Game(9);
  for (let n = 1; n <= 80; n++) { h.night = n; assert.equal(h.phase, (n - 1) % 8); const w = h.rollWeather(); seen.add(w); if (h.phase === FULL_MOON) assert.equal(w, 'clear', 'the full moon is always clear'); }
  assert.deepEqual([...seen].sort((a, b) => a.localeCompare(b)), [...WEATHERS].sort((a, b) => a.localeCompare(b)), 'every weather comes round');
  const a = new Game(77), b = new Game(77); a.night = b.night = 6; assert.equal(a.rollWeather(), b.rollWeather());
  assert.equal(new Game(0).seed, 1);
}

// ---------- Casting ----------
{
  assert.deepEqual([0.05, 0.25, 0.5, 0.9].map(zoneAt), ['reeds', 'lily', 'open', 'deep']);
  const g = new Game(2);
  near(g.reach, REACH[0] * DORA_CAST, 'Dora casts further'); assert.ok(g.reach < BANDS[3][1], 'the first rod cannot reach the deep channel');
  g.setAngler('enzo'); near(g.reach, REACH[0], 'Enzo casts the plain distance'); near(g.window, BITE_WINDOW * ENZO_WINDOW, 'and has longer to hook');
  g.setAngler('dora'); near(g.window, BITE_WINDOW, 'Dora has the plain window');
  // A touch too light to be a cast is dropped.
  step(g, { hold: true }); step(g, { hold: true }, 2); step(g);
  assert.equal(g.state, 'ready'); assert.equal(g.cast, 0); assert.ok(MIN_CHARGE > CHARGE_RATE * STEP * 3);
  // The charge swings up and back down.
  step(g, { hold: true }); secs(g, 1 / CHARGE_RATE + 0.3, { hold: true }); assert.ok(g.charge < 0.8 && g.charge > 0.5, 'past full, the charge falls again');
  g.cancel(); assert.equal(g.state, 'ready'); assert.equal(g.charge, 0, 'an interrupted touch casts nothing'); step(g);
  // Aim.
  secs(g, 0.5, { right: true }); assert.ok(g.aim > 0.5); secs(g, 3, { left: true }); assert.equal(g.aim, -1);
  cast(g, 0.5);
  assert.equal(g.state, 'flying'); near(g.bob.d, 0.5 * g.reach, 'distance follows the charge', 0.02); assert.equal(g.bob.aim, -1); assert.equal(g.bob.zone, zoneAt(g.bob.d));
  assert.equal(g.setAngler('enzo'), false, 'the angler is fixed once a cast is in the air'); assert.equal(g.setLure('glow'), false);
  secs(g, FLIGHT + 0.05); assert.equal(g.state, 'waiting'); assert.ok(g.bite && byId.get(g.bite.id).zone === g.bob.zone);
  // With the willow rod the deep channel is in reach.
  const far = new Game(2); far.up.rod = 1; near(far.reach, 1, 'Dora reaches the far bank'); land(far, 0.8); assert.equal(far.bob.zone, 'deep');
}

// ---------- The moon's reflection ----------
{
  const g = new Game(4); g.weather = 'mist'; assert.equal(g.moon, null, 'no reflection without a clear sky');
  g.weather = 'clear'; const m = g.moon; assert.ok(Math.abs(m.aim) <= 0.6 && m.d > 0.66 && m.d < REACH[2]);
  assert.equal(g.zoneFor(m.aim, m.d), 'deep', 'the plain rods find only deep water there');
  g.up.rod = 2; assert.equal(g.zoneFor(m.aim, m.d), 'moon'); assert.equal(g.zoneFor(m.aim + MOON_RADIUS * 1.2, m.d), 'deep'); assert.equal(g.zoneFor(m.aim, m.d - MOON_RADIUS), 'deep');
  g.setAngler('enzo'); assert.ok(m.d <= g.reach, 'either angler can reach it');
}

// ---------- The bite ----------
{
  let withNibble = null;
  for (let seed = 1; seed < 60 && !withNibble; seed++) { const g = new Game(seed); land(g, 0.3); if (g.bite.nibbles.length) withNibble = seed; }
  assert.ok(withNibble, 'some bites start with a nibble');
  // Pressing on a nibble scares it off.
  let g = new Game(withNibble); land(g, 0.3);
  assert.ok(g.bite.nibbles[0] >= SETTLE && g.bite.at >= g.bite.nibbles.at(-1) + NIBBLE, 'the bite follows the last nibble');
  while (!g.nibbling) step(g); assert.equal(g.biting, false); step(g, { hold: true });
  assert.equal(g.state, 'lost'); assert.equal(g.loss, 'early'); assert.equal(g.cast, 1); assert.equal(g.tonight.lost, 1);
  // A press before the water settles is ignored.
  g = new Game(withNibble); land(g, 0.3); step(g, { hold: true }); step(g); assert.equal(g.state, 'waiting');
  // Waiting too long misses it.
  while (!g.biting) step(g); secs(g, g.bite.window + 0.05); assert.equal(g.state, 'lost'); assert.equal(g.loss, 'missed');
  // The window.
  g = new Game(withNibble); g.up.bobber = 2; near(g.window, BITE_WINDOW + 2 * BOBBER_WINDOW, 'a better bobber gives longer');
  land(g, 0.3); const events = []; while (!g.biting) { step(g); events.push(...g.events.splice(0)); }
  assert.equal(events.filter((e) => e.t === 'nibble').length, g.bite.nibbles.length); assert.equal(events.filter((e) => e.t === 'bite').length, 1);
  secs(g, g.bite.window - 0.05); assert.equal(g.biting, true); step(g, { hold: true }); assert.equal(g.state, 'hooked');
  // A lost cast is dismissed with a press, but not at once.
  g = new Game(withNibble); land(g, 0.3); while (!g.biting) step(g); secs(g, g.bite.window + 0.05);
  step(g, { hold: true }); step(g); assert.equal(g.state, 'lost'); dismiss(g); assert.equal(g.state, 'ready'); assert.equal(g.bite, null);
  // Rain hurries the bite and mist slows it.
  const wait = (weather) => { let total = 0; for (let seed = 1; seed <= 40; seed++) { const x = new Game(seed); x.weather = weather; land(x, 0.3); total += x.bite.at - x.bite.nibbles.length * 1.3; } return total; };
  assert.ok(wait('rain') < wait('clear') && wait('clear') < wait('mist'));
}

// ---------- The reel ----------
{
  // Styles.
  for (let t = 0; t < 30; t += 0.05) for (const style of ['steady', 'darter', 'diver', 'heavy']) { const p = pullAt(style, t, 0.4, 0.2); assert.ok(p.pull >= 0 && p.pull <= 1.2 && !p.jump && !p.tell, `${style} pulls sensibly`); }
  let jumps = 0, tells = 0; for (let t = 0; t < 30; t += STEP) { const p = pullAt('jumper', t, 0.5, 0.5); jumps += p.jump; tells += p.tell; }
  const period = 2.8 + 0.5 * 0.8; near(jumps * STEP, (30 / period) * JUMP, 'a jumper leaps on a rhythm', 0.7); near(tells * STEP, (30 / period) * TELL, 'and gathers itself first', 0.5);
  const surges = (strength) => { let n = 0; for (let t = 1; t < 400; t += 0.45) n += pullAt('steady', t + 0.01, 0.4, 0.7, strength).pull > 0.6; return n; };
  assert.ok(surges(1) > surges(0.2) * 2 && surges(0.2) > 0, 'strong creatures surge more often');
  // A gentle one comes in on a steady hand.
  let g = new Game(1); rig(g, 'reed-skipper', 6.5); const start = g.shells;
  secs(g, 12, { hold: true }); assert.equal(g.state, 'landed', 'holding the reel lands a Reed Skipper');
  assert.equal(g.caught.id, 'reed-skipper'); assert.equal(g.caught.first, true); assert.equal(g.caught.stars, 2); assert.equal(g.journal['reed-skipper'].n, 1);
  assert.equal(g.shells - start, g.caught.shells); assert.equal(g.cast, 1); assert.equal(g.fight, null);
  // Never reeling lets it slip.
  g = new Game(1); rig(g, 'reed-skipper'); secs(g, SLIP_AFTER + 2); assert.equal(g.state, 'lost'); assert.equal(g.loss, 'slipped');
  // Hauling on a heavy one snaps the line; a better line lasts longer.
  const haul = (line) => { const x = new Game(1); x.up.line = line; rig(x, 'old-mossback'); let n = 0; while (x.state === 'hooked' && n < 6000) { step(x, { hold: true }); n++; } assert.equal(x.loss, 'snapped'); return n; };
  assert.ok(haul(3) > haul(0), 'spider-silk outlasts the first line');
  g = new Game(1); near(g.bandHigh, BAND_HIGH, 'the band'); near(g.snapAfter, SNAP_AFTER, 'strain'); g.up.line = 3; near(g.bandHigh, BAND_HIGH + 3 * LINE_BAND, 'a wider band'); near(g.snapAfter, SNAP_AFTER + 3 * LINE_STRAIN, 'more strain');
  assert.ok(BAND_LOW < BAND_HIGH);
  // Leaps: reeling through one strains the line, riding it out helps.
  const leap = (hold) => { const x = new Game(1); rig(x, 'lily-hopper'); x.bite.o1 = 0.5; let before = null; for (let i = 0; i < 2000 && x.state === 'hooked'; i++) { const f = x.fight; if (f.jump && before === null) before = { p: f.p, strain: f.strain }; if (before && !f.jump) return { dp: f.p - before.p, strain: f.strain - before.strain }; step(x, { hold: f.jump ? hold : f.tension < 0.6 && !f.tell }); } return { snapped: x.loss === 'snapped' }; };
  const ridden = leap(false), fought = leap(true);
  assert.ok(ridden.dp >= 0.039 && ridden.strain <= 0, 'a leap ridden out on a loose line tires it');
  assert.equal(fought.snapped, true, 'reeling right through a leap snaps the first line');
  // Every creature can be landed by a careful hand on the best line.
  for (const sp of SPECIES) { const x = new Game(2); x.up.line = 3; rig(x, sp.id); fight(x); assert.equal(x.state, 'landed', `${sp.id} can be landed`); }
}

// ---------- Sketching, shells and stars ----------
{
  const g = new Game(1); g.requests = [{ type: 'big', reward: 14 }, { type: 'species', id: 'storm-pike', reward: 12 }, { type: 'weather', weather: g.weather === 'rain' ? 'mist' : 'rain', reward: 6 }];
  const sp = rig(g, 'clover-carp', 46); fight(g);
  assert.equal(g.caught.stars, 3); assert.equal(g.caught.first, true); assert.equal(g.caught.requests, 1);
  assert.equal(g.caught.shells, Math.round(SHELLS[2] * 1.5) + SHELLS[2] + 14, 'three stars, a first sketch and a request');
  assert.equal(g.requests.length, 3); assert.ok(g.requests[1].type === 'species' && g.requests[1].id === 'storm-pike', 'unmet requests stay');
  dismiss(g); rig(g, 'clover-carp', 20); fight(g);
  assert.equal(g.caught.first, false); assert.equal(g.caught.record, false); assert.equal(g.caught.stars, 1); assert.equal(g.caught.shells, SHELLS[2]);
  assert.deepEqual(g.journal['clover-carp'], { n: 2, best: 46, stars: 3 }, 'the journal keeps the best');
  assert.equal(sp.size[1], 46);
  dismiss(g); rig(g, 'brass-key'); fight(g); assert.equal(g.caught.stars, 1); assert.ok(g.caught.shells >= CURIO_SHELLS * 2); assert.equal(g.journal['brass-key'].best, 0);
  // Requests by place and hour, by weather and by name.
  const h = new Game(1); h.cast = 4; h.requests = [{ type: 'spot', zone: 'lily', time: 'midnight', reward: 10 }, { type: 'weather', weather: h.weather, reward: 6 }, { type: 'species', id: 'pad-minnow', reward: 12 }];
  rig(h, 'pad-minnow'); fight(h); assert.equal(h.caught.requests, 3); assert.equal(h.caught.shells, SHELLS[1] * 2 + 28);
  for (const r of h.requests) assert.ok(requestText(r).length > 10 && r.reward > 0);
  const kinds = new Set(); const many = new Game(8); for (let i = 0; i < 80; i++) kinds.add(many.makeRequest().type); assert.equal(kinds.size, 4);
}

// ---------- The shop ----------
{
  const g = new Game(1);
  assert.equal(g.buy('rod'), false, 'nothing without shells'); g.shells = 10000;
  for (const id of UPGRADE_IDS) { const costs = UPGRADES[id].costs; assert.equal(costs.length, UPGRADES[id].blurb.length); for (const c of costs) { const before = g.shells; assert.equal(g.cost(id), c); assert.ok(g.buy(id)); assert.equal(before - g.shells, c); } assert.equal(g.cost(id), null); assert.equal(g.buy(id), false, `${id} tops out`); }
  assert.equal(g.casts, 12); assert.equal(g.setLure('dust'), false, 'a lure has to be bought');
  for (const l of LURES) { if (l !== 'glow') { const before = g.shells; assert.ok(g.buyLure(l)); assert.equal(before - g.shells, LURE_COST[l]); } assert.equal(g.buyLure(l), false); assert.ok(g.setLure(l)); }
  cast(g, 0.5); const shells = g.shells; g.up.line = 0; assert.equal(g.buy('line'), false, 'the shop is shut while a cast is out'); assert.equal(g.shells, shells);
}

// ---------- A whole night, and the next ----------
{
  const g = new Game(6); let n = 0;
  while (g.state !== 'dawn' && n++ < 40) { land(g, 0.3); hook(g); fight(g); assert.ok(g.state === 'landed' || g.state === 'lost'); dismiss(g); }
  assert.equal(g.state, 'dawn'); assert.equal(g.cast, BASE_CASTS); assert.equal(g.tonight.catches.length + g.tonight.lost, BASE_CASTS);
  assert.equal(g.tonight.shells, g.tonight.catches.reduce((a, c) => a + c.shells, 0)); assert.equal(g.shells, g.tonight.shells);
  step(g, { hold: true }); assert.equal(g.state, 'dawn', 'dawn waits for the next night');
  assert.ok(g.buy('line') || g.shells < UPGRADES.line.costs[0], 'the shop is open at dawn');
  assert.equal(g.nextNight('rain'), true); assert.equal(g.night, 2); assert.equal(g.phase, 1); assert.equal(g.cast, 0); assert.equal(g.state, 'ready'); assert.equal(g.tonight.catches.length, 0);
  const plain = new Game(6); plain.night = 2; assert.equal(g.weather, plain.rollWeather(), 'the weather cannot be chosen before the journal is full');
  assert.equal(g.nextNight(), false, 'only from dawn');
}

// ---------- Filling the journal ----------
{
  const g = new Game(1); for (const sp of SPECIES) if (sp.id !== 'moon-koi') g.journal[sp.id] = { n: 1, best: sp.size ? sp.size[0] : 0, stars: 1 };
  assert.equal(g.found, 39); assert.equal(g.complete, false);
  rig(g, 'moon-koi', 100); g.up.line = 3; fight(g); assert.equal(g.state, 'landed'); assert.equal(g.complete, true); assert.ok(g.events.some((e) => e.t === 'complete'));
  g.cast = g.casts; dismiss(g); assert.equal(g.state, 'dawn'); g.nextNight('fireflies'); assert.equal(g.weather, 'fireflies', 'a full journal lets you choose the weather');
}

// ---------- Replays and saves ----------
{
  const run = (seed) => { const g = new Game(seed), log = []; for (let c = 0; c < 6; c++) { land(g, 0.2 + c * 0.05); hook(g); fight(g); log.push([g.state, g.caught?.id, g.caught?.size, g.loss]); dismiss(g); } return JSON.stringify([log, g.shells, g.journal, g.requests]); };
  assert.equal(run(11), run(11), 'a seed replays exactly'); assert.notEqual(run(11), run(12));
  // The step size does not change the outcome.
  const fine = new Game(4), coarse = new Game(4); rig(fine, 'pond-bream'); rig(coarse, 'pond-bream');
  for (let i = 0; i < 300; i++) fine.update(1 / 60, { hold: i % 30 < 20 }); for (let i = 0; i < 150; i++) coarse.update(1 / 30, { hold: (i * 2) % 30 < 20 });
  near(fine.fight?.p ?? 1, coarse.fight?.p ?? 1, 'frames are subdivided', 0.02);

  const g = new Game(21); g.shells = 500; g.buy('rod'); g.buy('oil'); g.buyLure('clover'); g.setLure('clover'); g.setAngler('enzo');
  for (let c = 0; c < 3; c++) { land(g, 0.3); hook(g); fight(g); dismiss(g); }
  land(g, 0.3);
  const copy = Game.load(JSON.parse(JSON.stringify(g.profile())), JSON.parse(JSON.stringify(g.progress())));
  assert.ok(copy); assert.equal(copy.state, 'ready', 'a cast in the water is taken again'); assert.equal(copy.cast, 3); assert.equal(copy.night, g.night); assert.equal(copy.weather, g.weather);
  assert.deepEqual(copy.journal, g.journal); assert.equal(copy.shells, g.shells); assert.deepEqual(copy.up, g.up); assert.deepEqual(copy.lures, g.lures); assert.equal(copy.lure, 'clover'); assert.equal(copy.angler, 'enzo');
  assert.deepEqual(copy.requests, g.requests); assert.deepEqual(copy.tonight, g.tonight);
  land(copy, 0.3); assert.equal(copy.bite.id, g.bite.id, 'and the same creature is waiting'); assert.equal(copy.bite.size, g.bite.size);
  assert.equal(copy.makeRequest().type, g.makeRequest().type, 'the request stream carries on');
  // Without the night, the profile alone starts that night afresh.
  const fresh = Game.load(g.profile()); assert.equal(fresh.cast, 0); assert.equal(fresh.night, g.night); assert.deepEqual(fresh.journal, g.journal);
  // A finished night comes back at dawn.
  const d = new Game(3); d.cast = d.casts; d.tonight = { catches: [], lost: d.casts, shells: 0 }; d.state = 'dawn';
  assert.equal(Game.load(d.profile(), d.progress()).state, 'dawn');
  // Damaged saves are refused, and a damaged night is dropped without losing the journal.
  const p = () => JSON.parse(JSON.stringify(g.profile())), n = () => JSON.parse(JSON.stringify(g.progress()));
  const bad = [null, 'x', {}, { ...p(), v: SAVE_VERSION + 1 }, { ...p(), seed: 0 }, { ...p(), night: 0 }, { ...p(), shells: -1 }, { ...p(), shells: 1.5 }, { ...p(), up: { ...p().up, rod: 3 } }, { ...p(), up: {} },
    { ...p(), lures: ['clover'] }, { ...p(), lures: ['glow', 'glow'] }, { ...p(), lures: ['glow', 'worm'] }, { ...p(), lure: 'dust' }, { ...p(), angler: 'pip' }, { ...p(), journal: { nessie: { n: 1, best: 1, stars: 1 } } },
    { ...p(), journal: { 'reed-skipper': { n: 1, best: 900, stars: 1 } } }, { ...p(), journal: { 'reed-skipper': { n: 0, best: 5, stars: 1 } } }, { ...p(), journal: { 'brass-key': { n: 1, best: 3, stars: 1 } } },
    { ...p(), requests: [] }, { ...p(), requests: [{ type: 'spot', zone: 'sea', time: 'dusk', reward: 10 }, ...p().requests.slice(1)] }, { ...p(), requests: [{ type: 'big', reward: 0 }, ...p().requests.slice(1)] }, { ...p(), asked: 1 }];
  for (const b of bad) assert.equal(Game.load(b), null, `refused: ${JSON.stringify(b)?.slice(0, 60)}`);
  for (const b of [{ ...n(), v: 9 }, { ...n(), night: g.night + 1 }, { ...n(), cast: 99 }, { ...n(), cast: 2 }, { ...n(), weather: 'snow' }, { ...n(), aim: 4 }, { ...n(), tonight: null }, { ...n(), tonight: { catches: [{ id: 'nessie', stars: 1, shells: 1, size: 1 }, ...n().tonight.catches.slice(1)], lost: n().tonight.lost, shells: 0 } }]) {
    const back = Game.load(p(), b); assert.ok(back, 'the journal survives a damaged night'); assert.equal(back.cast, 0); assert.deepEqual(back.journal, g.journal);
  }
  const wrongWeather = Game.load(p(), { ...n(), weather: WEATHERS.find((w) => w !== g.weather) }); assert.equal(wrongWeather.cast, 0, 'a night whose weather does not match the seed is dropped');
}

// ---------- The bot ----------
{
  const { g, stats } = play(2, 70);
  assert.ok(g.complete, 'the bot fills a journal'); assert.equal(stats.noBite, 0);
  assert.ok(stats.landed / stats.casts > 0.8);
  const again = play(2, 70); assert.equal(again.stats.nights, stats.nights, 'and does it the same way twice'); assert.equal(again.g.shells, g.shells);
}

console.log(`PASS Moonpond: ${SPECIES.length} journal entries, casting, the moon's reflection, nibbles and bites, five ways of fighting, stars, shells, requests, the shop, nights and moon phases, a full journal, seed replay, saves and a bot that fills the book.`);
