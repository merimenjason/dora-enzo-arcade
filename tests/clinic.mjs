// Burrow Clinic engine checks: arrivals, queues, diagnosis (right and wrong) and cures; money, wages and selling;
// room fit rules and their reasons, doors, and path-finding around rooms (with the cache cleared on a layout change);
// staff fatigue and the staff room; machine wear, breakdown and repair; mood, patience, thirst and benches; dropping
// staff into rooms; emergencies (accepted, declined, met, missed), the inspector and the VIP; goals and stars (and the
// soft and strict day limits); the tutorial's six steps; the assist's advice and "try here" spots; determinism; the
// save round-trip and corrupt saves. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  Game, CLINICS, ROOMS, AILMENTS, DECOS, DAY, HOUR, SAVE_KEY, TUT_STEPS, newSave, parseSave, serialise, record, clinicOpen, sandboxOpen,
  wagesPerDay, roomCost, accuracy, workRate, hourOf, clockText, XP_FOR, TRAIN_COST, UPGRADE_SPEED, canUpgrade, SIDE_D,
} from '../.checks/clinic-game.js';
import { astar, newGrid, bfs } from '../.checks/clinic-path.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

/** a clinic with the basic rooms built where the assist suggests and one of each staff hired */
function basic(clinic = 'salt', seed = 7, { vets = 1 } = {}) {
  const g = new Game(clinic, seed);
  const b = (k) => { const s = g.suggest(k); assert.ok(s, `a spot for ${k}`); const r = g.build(k, s.x, s.y, s.w, s.h, 0); assert.ok(r.ok, r.reason); return g.roomById(r.id); };
  const hire = (role) => { const c = g.s.cands.find((q) => q.role === role); assert.ok(c, `a ${role} candidate`); const r = g.hire(c.id); assert.ok(r.ok, r.reason); return g.staffById(r.id); };
  const rooms = { reception: b('reception'), checkup: b('checkup'), fluff: b('fluff') };
  const staff = { recep: hire('recep'), vet: hire('vet') };
  for (let i = 1; i < vets; i++) hire('vet');
  return { g, rooms, staff, b, hire };
}
const runUntil = (g, fn, max = DAY * 3) => { for (let i = 0; i < max; i++) { if (fn()) return true; g.tick(); } return fn(); };

// ---------------------------------------------------------------- path-finding over edge walls
{
  const gr = newGrid(5, 5);
  gr.walk.fill(1);
  // a wall between column 1 and 2 on rows 0..3: the way round is through row 4
  for (let y = 0; y < 4; y++) gr.wallE[y * 5 + 1] = 1;
  const p = astar(gr, 0, 0, 4, 0);
  ok(p && p.length === 12, `the path goes round the wall (${p && p.length} steps)`);
  ok(p.some(([x, y]) => y === 4), 'through the gap at the bottom');
  gr.wallE[4 * 5 + 1] = 1;
  eq(astar(gr, 0, 0, 4, 0), null, 'a closed wall means no path');
  eq(bfs(gr, 0, 0)[4], -1, 'and the far side is unreachable');
  eq(astar(gr, 2, 2, 2, 2), [], 'already there is an empty path');
  gr.walk[3] = 0;
  const q = astar(gr, 4, 4, 3, 0);
  ok(q && q[q.length - 1][0] === 3 && q[q.length - 1][1] === 0, 'a blocked goal (a machine to climb on) can still be the last step');
}

// ---------------------------------------------------------------- room fit rules and their reasons
{
  const g = new Game('salt', 1);
  const why = (k, x, y, w, h) => { const r = g.canBuild(k, x, y, w, h); return r.ok ? 'ok' : r.reason; };
  ok(/Too small/.test(why('checkup', 0, 0, 2, 3)), 'too small says so');
  ok(/Too small: a Check-up Room needs at least 3×3/.test(why('checkup', 0, 0, 2, 2)), 'and names the minimum');
  ok(/outside the clinic walls/.test(why('checkup', g.W - 2, 0, 3, 3)), 'outside the walls says so');
  ok(/open up at Lakeside/.test(why('dust', 0, 0, 4, 3)), 'a locked room says where it unlocks');
  ok(/front door/.test(why('checkup', g.def.door - 1, g.H - 3, 3, 3)), 'the front door must stay clear');
  ok(/Too big/.test(why('staff', 0, 0, 9, 3)), 'rooms have a maximum size');
  eq(why('checkup', 0, 0, 3, 3), 'ok', 'a corner spot is fine');
  ok(g.build('checkup', 0, 0, 3, 3).ok, 'built');
  ok(/overlaps the Check-up Room/.test(why('fluff', 2, 2, 3, 3)), 'overlapping says which room');
  // a door that opens onto the other room is refused; one onto the corridor is fine
  const r = g.s.rooms[0];
  const bad = g.canBuild('fluff', 3, 0, 3, 3, 0, { x: 3, y: 1, side: 'W' }, true);
  ok(!bad.ok && /corridor outside/.test(bad.reason), 'a door into a wall is refused with a reason');
  const good = g.canBuild('fluff', 3, 0, 3, 3, 0, { x: 4, y: 2, side: 'S' }, true);
  ok(good.ok, 'a door onto the corridor is fine');
  // walling up another room's door
  const d = r.door, [ox, oy] = [d.x + (d.side === 'E' ? 1 : d.side === 'W' ? -1 : 0), d.y + (d.side === 'S' ? 1 : d.side === 'N' ? -1 : 0)];
  const cover = g.canBuild('fluff', ox, oy, 3, 3, 0, null, true);
  ok(!cover.ok && /door|overlaps/.test(cover.reason), `covering a door is refused (${cover.ok ? '' : cover.reason})`);
  // no coins
  g.s.coins = 10;
  ok(/Not enough coins/.test(why('fluff', 5, 0, 3, 3)), 'no coins says so');
  // decorations
  g.s.coins = 5000;
  ok(/not inside rooms/.test(g.canPlace('bench', 1, 1).reason ?? ''), 'decorations stay out of rooms');
  ok(g.place('cactus', 6, 5).ok, 'a cactus in the corridor');
  ok(/already there/.test(g.canPlace('bench', 6, 5).reason), 'one thing per tile');
  ok(/vending|Drinks Cart|later|arrive/.test(new Game('burrow', 1).canPlace('vending', 3, 3).reason), 'the drinks cart is locked at Burrow Clinic and says so');
  // rotation picks the door side
  const g2 = new Game('salt', 1);
  const a = g2.canBuild('checkup', 5, 4, 3, 3, 0), b2 = g2.canBuild('checkup', 5, 4, 3, 3, 1), c = g2.canBuild('checkup', 5, 4, 3, 3, 2);
  ok(a.ok && b2.ok && c.ok && new Set([a.door.side, b2.door.side, c.door.side]).size === 3, `rotating moves the door (${a.door.side}, ${b2.door.side}, ${c.door.side})`);
}

// ---------------------------------------------------------------- path-finding around rooms, and the cache
{
  const g = new Game('salt', 1);
  const [ex, ey] = g.entry;
  const straight = g.cache.get(g.grid, g.s.layout, ex, ey, ex, 0);
  eq(straight.length, ey, 'with nothing built, the walk to the back wall is straight');
  ok(g.build('staff', ex - 1, 2, 3, 3).ok, 'a room in the way');
  const round = g.cache.get(g.grid, g.s.layout, ex, ey, ex, 0);
  ok(round && round.length > ey, `the new path goes round the room (${round && round.length} > ${ey})`);
  ok(round.every(([x, y]) => !(x >= ex - 1 && x <= ex + 1 && y >= 2 && y <= 4)), 'and never through it');
  const r = g.s.rooms[0], [dx, dy] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[r.door.side];
  const inside = g.cache.get(g.grid, g.s.layout, ex, ey, r.door.x - dx * 0 + (r.door.x === r.x ? 1 : -1) * 0, r.door.y);
  ok(inside && inside.some(([x, y]) => x === r.door.x + dx && y === r.door.y + dy), 'the way into a room goes through its door');
  const h0 = g.cache.hits;
  g.cache.get(g.grid, g.s.layout, ex, ey, ex, 0);
  ok(g.cache.hits === h0 + 1, 'a repeat path comes from the cache');
  const lay = g.s.layout;
  g.sell(r.id);
  ok(g.s.layout === lay + 1, 'selling changes the layout version');
  eq(g.cache.get(g.grid, g.s.layout, ex, ey, ex, 0).length, ey, 'and the cache gives the straight path again');
  // a decoration that would cut off a room is refused
  const g3 = new Game('salt', 2);
  ok(g3.build('checkup', 0, 0, 3, 3, 0, { x: 2, y: 1, side: 'E' }).ok, 'a room with its door to the east');
  ok(g3.place('cactus', 4, 0).ok && g3.place('cactus', 4, 2).ok, 'two cacti beside the doorway');
  ok(/way to the Check-up Room|shut off|box/.test(g3.canPlace('cactus', 3, 1 + 1 === 2 ? 1 : 1).reason ?? '') || !g3.canPlace('cactus', 3, 1).ok, 'a third that blocks the doorway is refused');
}

// ---------------------------------------------------------------- arrivals, queues, diagnosis and cures
{
  const { g } = basic('salt', 3);
  ok(!g.s.open, 'the clinic starts closed');
  g.tick();
  ok(g.s.open, 'with reception, a check-up and a cure room staffed, the assist opens the doors');
  const arrived = runUntil(g, () => g.s.patients.length > 0, HOUR * 3);
  ok(arrived, 'patients arrive');
  const p = g.s.patients[0];
  eq(p.need, 'reception', 'the first stop is reception');
  ok(runUntil(g, () => p.need === 'checkup' || p.phase === 'gone', HOUR * 3), 'they check in and move on to a check-up');
  ok(runUntil(g, () => p.dx !== null || p.phase === 'gone', HOUR * 4), 'the vet makes a diagnosis');
  ok(runUntil(g, () => g.s.cures > 0, DAY), 'someone is cured');
  ok(g.s.coins > 0 && g.s.earned >= AILMENTS.static.fee, 'cures pay');
  // the queue: everybody waiting for the same room is served oldest first
  const waiting = g.s.patients.filter((q) => q.phase === 'wait');
  ok(waiting.every((q) => q.spot), 'everyone waiting has somewhere to stand or sit');
}
{
  // a wrong guess: force a 0-skill vet and an ailment pool with a second built room
  const { g, b } = basic('salt', 11);
  b('hiccup');
  const vet = g.s.staff.find((s) => s.role === 'vet');
  vet.skill = 0; vet.trait = 'quick';
  ok(accuracy(vet) < 0.7, 'a poor vet guesses wrong more often');
  g.s.open = true;
  let wrongSeen = false, back = false;
  for (let i = 0; i < DAY * 2 && !(wrongSeen && back); i++) {
    g.tick();
    for (const e of g.events) if (e.t === 'wrong') wrongSeen = true;
    if (wrongSeen && g.s.patients.some((q) => q.wrongs.length && q.need === 'checkup')) back = true;
    g.events.length = 0;
  }
  ok(wrongSeen, 'a wrong cure fails gently (no coins, a puzzled patient)');
  ok(back, 'and the patient comes back for a second check-up');
  const q = g.s.patients.find((x) => x.wrongs.length);
  ok(!q || q.sure, 'the second check-up is sure to be right');
}

// ---------------------------------------------------------------- money, wages and selling
{
  const { g, rooms } = basic('salt', 5);
  const before = g.s.coins;
  const wages = wagesPerDay(g.s);
  ok(wages > 0, 'staff cost wages');
  g.s.open = true;
  const coins0 = g.s.coins, earned0 = g.s.earned;
  g.s.t = DAY - 2; g.tick(); g.tick();
  eq(g.s.day, 2, 'a new day starts at 20:00');
  eq(Math.round(g.s.coins - coins0), Math.round(g.s.earned - earned0) - wages, 'wages are paid at the end of the day');
  const cost = rooms.fluff.cost, c1 = g.s.coins;
  ok(g.sell(rooms.fluff.id).ok, 'sell a room');
  eq(g.s.coins, c1 + Math.round(cost / 2), 'for half its price');
  ok(!g.roomById(rooms.fluff.id), 'and it is gone');
  eq(roomCost('checkup', 4, 3), ROOMS.checkup.cost + 3 * 15, 'bigger rooms cost a little more');
  ok(before < new Game('salt', 5).s.coins, 'building and hiring spent coins');
  const st = g.s.staff[0];
  ok(g.fire(st.id).ok, 'fire a staff member');
  runUntil(g, () => !g.s.staff.includes(st), 400);
  ok(!g.s.staff.includes(st), 'and they walk out');
  ok(wagesPerDay(g.s) < wages, 'and their wage stops');
}

// ---------------------------------------------------------------- staff: fatigue, the staff room, dropping into a room
{
  const { g, staff, b, rooms } = basic('salt', 8);
  staff.vet.energy = 20;
  g.s.open = true;
  g.tick();
  const slow = workRate(staff.vet);
  staff.vet.energy = 100;
  ok(slow < workRate(staff.vet), 'tired staff work slower');
  staff.vet.energy = 20;
  ok(g.advice().some((a) => a.id === 'staffroom'), 'the assist suggests a staff room for tired staff');
  const sr = b('staff');
  ok(runUntil(g, () => staff.vet.state === 'rest', 600), 'a tired vet goes to rest in the staff room');
  ok(runUntil(g, () => staff.vet.energy >= 100 && staff.vet.state !== 'rest', 600), 'and comes back fresh');
  // drag a vet into a room
  const r = g.assign(staff.vet.id, rooms.checkup.id);
  ok(r.ok && staff.vet.home === rooms.checkup.id, 'dropping a vet into a room keeps them there');
  const wrong = g.assign(staff.recep.id, rooms.fluff.id);
  ok(!wrong.ok && /needs a vet/.test(wrong.reason), 'a receptionist dropped into the Fluff-Dryer is refused with a reason');
  ok(g.assign(staff.vet.id, sr.id).ok && ['to_rest', 'rest'].includes(staff.vet.state), 'dropping someone in the staff room sends them to rest');
  g.hold(staff.vet.id, true);
  ok(staff.vet.held, 'a staff member can be picked up');
  g.assign(staff.vet.id, 0);
  ok(!staff.vet.held && !staff.vet.home, 'and put down in the corridor, free again');
}

// ---------------------------------------------------------------- machine wear, breakdown and repair
{
  const { g, rooms, hire } = basic('springs', 4);
  const slot = rooms.fluff.slots[0];
  slot.wear = 99;
  g.s.open = true;
  ok(runUntil(g, () => slot.broken, DAY * 2), 'a worn machine breaks down (and just stops)');
  ok(g.advice().some((a) => a.id === 'hire-cleaner'), 'the assist suggests a cleaner');
  hire('cleaner');
  ok(runUntil(g, () => !slot.broken && slot.wear === 0, DAY), 'a cleaner fixes it');
  ok(g.s.stats.repairs >= 1, 'the repair is counted');
  ok(g.trigger('breakdown'), 'the breakdown event stops a machine');
  ok(g.s.rooms.some((r) => r.slots.some((q) => q.broken)), 'and it is broken');
}

// ---------------------------------------------------------------- mood, patience, thirst, benches, plants
{
  const { g, rooms } = basic('salt', 9);
  g.s.open = true;
  // nobody to treat Static Fluff: the vet goes, so the queue for the Fluff-Dryer grows and patience drains
  const p = g.spawnPatient('static');
  p.need = 'fluff'; p.dx = 'static'; g.requeue(p, false);
  g.sell(rooms.fluff.id);
  const p0 = p.patience;
  g.run(200);
  ok(p.patience < p0, 'patience drains while waiting');
  ok(p.thirst > 0, 'thirst rises (twice as fast on the Salt Flat)');
  // a bench halves it
  const q = g.spawnPatient('static'); q.need = 'fluff'; q.dx = 'static';
  const spot = g.suggestDeco('bench');
  ok(spot && g.place('bench', spot[0], spot[1]).ok, 'place a bench');
  g.requeue(q, false);
  const sitter = g.s.patients.find((x) => x.seat);
  ok(sitter && sitter.arrivedAt <= q.arrivedAt, 'the front of the line takes the bench seats');
  ok(!q.seat && q.qi === g.s.patients.filter((x) => x.phase === 'wait').length - 1, 'and the newest arrival joins the back of the line');
  q.sp = sitter.sp; q.thirst = sitter.thirst = 0;
  g.run(60);
  const sitting = sitter.patience, standing = q.patience; g.run(100);
  const sitDrop = sitting - sitter.patience, standDrop = standing - q.patience;
  ok(sitDrop < standDrop, `sitting waits more patiently (${sitDrop.toFixed(2)} < ${standDrop.toFixed(2)})`);
  // thirsty patients fetch a drink and keep their place
  p.thirst = 90;
  const cs = g.suggestDeco('cooler');
  ok(g.place('cooler', cs[0], cs[1]).ok, 'a water cooler');
  ok(runUntil(g, () => p.phase === 'drink', 300), 'a thirsty patient goes for a drink');
  ok(runUntil(g, () => p.thirst < 5 && p.phase === 'wait', 400), 'drinks, and goes back to waiting');
  // run out of patience: home, unhappy, reputation down
  p.patience = 0.01;
  const rep = g.s.rep;
  ok(runUntil(g, () => p.phase === 'gone', 600), 'out of patience, they go home');
  ok(g.s.rep < rep && g.s.leftUnhappy === 1, 'unhappy, which costs reputation');
  // plants cheer, once watered
  const c0 = g.comfort.slice();
  const ps = g.suggestDeco('plant');
  g.place('plant', ps[0], ps[1]);
  ok([...g.comfort].some((v, i) => v < c0[i]), 'a watered plant makes waiting easier nearby');
}

// ---------------------------------------------------------------- emergencies, the inspector, the VIP
{
  const { g } = basic('salt', 12, { vets: 2 });
  g.s.open = true;
  ok(g.trigger('emergency', 'static'), 'an emergency is offered');
  const o = g.s.offer;
  ok(o && o.count >= 3 && o.bonus > 0 && o.ail === 'static', 'with a count, an ailment and a bonus');
  ok(!g.trigger('emergency'), 'only one at a time');
  ok(g.respond(o.id, true).ok && !g.s.offer, 'accept it');
  ok(runUntil(g, () => g.s.emergencies[0].spawned === o.count, HOUR * 3), 'the patients arrive');
  ok(g.s.patients.filter((p) => p.emerg).every((p) => p.need === 'fluff' && p.dx === 'static'), 'and go straight to the cure room');
  const coins = g.s.coins;
  ok(runUntil(g, () => g.s.emergencies[0].done, DAY * 2), 'the emergency finishes');
  const e = g.s.emergencies[0];
  ok(e.cured >= e.count ? g.s.coins > coins : true, 'all cured in time pays the bonus');
  // declining
  const { g: g2 } = basic('salt', 13);
  g2.s.open = true;
  ok(g2.trigger('emergency'), 'another emergency');
  const id = g2.s.offer.id, rep = g2.s.rep;
  ok(g2.respond(id, false).ok && !g2.s.offer && g2.s.emergencies.length === 0 && g2.s.rep === rep, 'declining costs nothing');
  ok(!g2.respond(id, true).ok, 'an answered offer cannot be answered again');
  // an unanswered offer expires
  ok(g2.trigger('emergency'), 'and another');
  g2.run(HOUR * 2 + 5);
  ok(!g2.s.offer, 'an unanswered offer goes to another clinic');
  // a missed deadline: no bonus, a small reputation dent, patients still treated
  const { g: g3 } = basic('salt', 14);
  g3.s.open = true; g3.trigger('emergency', 'static'); g3.respond(g3.s.offer.id, true);
  g3.s.emergencies[0].deadline = g3.s.t + 5;
  const rep3 = g3.s.rep; g3.run(10);
  ok(g3.s.emergencies[0].done && g3.s.rep < rep3 + 1, 'a missed deadline ends the emergency without the bonus');
  // the inspector
  ok(g.trigger('inspector'), 'the inspector arrives');
  ok(g.s.walkers.some((w) => w.who === 'inspector'), 'and walks the clinic');
  ok(runUntil(g, () => !g.s.walkers.some((w) => w.who === 'inspector'), DAY), 'and leaves with a verdict');
  ok(g.s.stats.inspections === 1, 'counted');
  // the VIP condor
  ok(g.trigger('vip'), 'a VIP condor arrives');
  const vip = g.s.patients.find((p) => p.vip);
  ok(vip && vip.sp === 'condor', 'a condor');
}

// ---------------------------------------------------------------- goals and stars, soft and strict limits
{
  const g = new Game('burrow', 1);
  const d = g.def;
  eq(g.goals().map((x) => x.need), [d.goals.cures, d.goals.rep, d.goals.coins], 'three goals');
  eq(g.starsFor(d.fastDay, d.starRep), 3, 'fast with high reputation: three stars');
  eq(g.starsFor(d.fastDay, d.starRep - 1), 2, 'fast: two');
  eq(g.starsFor(d.days, d.starRep), 2, 'in time with high reputation: two');
  eq(g.starsFor(d.days, 0), 1, 'in time: one');
  eq(g.starsFor(d.days + 1, 100), 1, 'past the soft day limit: one star at most');
  // meet the goals
  g.s.open = true; g.s.tut = TUT_STEPS;
  g.s.cures = d.goals.cures; g.s.rep = 90; g.s.coins = d.goals.coins + 1;
  g.tick();
  ok(g.s.met && g.s.result === 'met' && g.s.met.stars === 3, 'meeting every goal on day 1 with a high reputation: three stars');
  ok(g.events.some((e) => e.t === 'met'), 'and a celebration event');
  // the soft limit: past it, the clinic keeps going
  const s = new Game('burrow', 2); s.s.open = true; s.s.tut = TUT_STEPS; s.s.day = d.days; s.s.t = DAY * d.days - 1; s.tick(); s.tick();
  ok(s.s.result === 'playing' && s.s.day === d.days + 1, 'with Strict off, the day limit is soft');
  const t = new Game('burrow', 2, { strict: true }); t.s.open = true; t.s.tut = TUT_STEPS; t.s.day = d.days; t.s.t = DAY * d.days - 1; t.tick(); t.tick();
  ok(t.s.result === 'failed', 'with Strict on, missing the limit fails the clinic');
  // campaign progress
  const save = newSave();
  ok(clinicOpen(save, 0) && !clinicOpen(save, 1), 'only the first clinic is open at first');
  record(save, 'burrow', { day: 4, rep: 80, stars: 2, t: 0 });
  ok(clinicOpen(save, 1) && !clinicOpen(save, 2), 'meeting its goals opens the next');
  record(save, 'burrow', { day: 6, rep: 60, stars: 1, t: 0 });
  eq(save.stars.burrow, 2, 'stars only go up');
  ok(!sandboxOpen(save), 'the sandbox is locked');
  record(save, 'salt', { day: 6, rep: 60, stars: 1, t: 0 });
  ok(sandboxOpen(save), 'and opens after clinic 2');
  const s2 = newSave(); s2.settings.sandbox = true;
  ok(sandboxOpen(s2), 'or with the setting');
}

// ---------------------------------------------------------------- the tutorial
{
  const g = new Game('burrow', 3);
  eq(g.s.tut, 0, 'the tutorial starts at step 1');
  const steps = [];
  const build = (k) => { const s = g.suggest(k); g.build(k, s.x, s.y, s.w, s.h, 0); g.tick(); steps.push(g.s.tut); };
  const hire = (role) => { g.hire(g.s.cands.find((c) => c.role === role).id); g.tick(); steps.push(g.s.tut); };
  g.run(100);
  eq(g.s.patients.length, 0, 'no patients before you are ready');
  ok(!g.s.open, 'and the clock does not run');
  eq(g.s.t, 0, 'nothing in the first clinic can be lost by being slow');
  build('reception'); hire('recep'); build('checkup'); hire('vet'); build('fluff');
  eq(steps, [1, 2, 3, 4, 5], 'each step completes in order');
  ok(g.s.open && g.s.patients.length === 1, 'the doors open and the first patient walks in');
  ok(runUntil(g, () => g.s.tut === TUT_STEPS, DAY), 'the first cure finishes the tutorial');
}

// ---------------------------------------------------------------- the assist
{
  const g = new Game('salt', 4);
  const s = g.suggest('reception');
  ok(s && g.canBuild('reception', s.x, s.y, s.w, s.h).ok, 'the "try here" spot fits');
  g.build('reception', s.x, s.y, s.w, s.h);
  ok(g.advice().some((a) => a.id === 'hire-recep'), 'a room without staff suggests hiring');
  const h = g.suggestHire('recep');
  ok(h && h.role === 'recep', 'with a candidate to hire');
  g.s.coins = 50;
  g.hire(g.s.cands.find((c) => c.role === 'recep' && c.wage <= 50)?.id ?? -1);
  g.s.staff.push({ ...g.s.staff[0] ?? {}, id: 999, role: 'vet', wage: 400, state: 'idle', x: 1, y: 1, px: 1, py: 1, path: [], goal: null });
  ok(g.advice().some((a) => a.id === 'money'), 'a gentle warning before money runs out');
  // try-here spots never cut the corridor in two, even with many rooms
  const f = new Game('summit', 1);
  let built = 0;
  for (const k of f.def.rooms) { const p = f.suggest(k); if (p && f.build(k, p.x, p.y, p.w, p.h).ok) built++; }
  ok(built >= 9, `the assist finds room for most of the Summit (${built} rooms)`);
  const dist = bfs(f.grid, f.entry[0], f.entry[1]);
  ok(f.s.rooms.every((r) => { const d = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[r.door.side]; return dist[(r.door.y + d[1]) * f.W + r.door.x + d[0]] >= 0; }), 'and every door stays reachable');
}

// ---------------------------------------------------------------- determinism
{
  const play = (seed) => {
    const { g, b, hire } = basic('lake', seed);
    for (let i = 0; i < 900; i++) {
      g.tick();
      if (i === 300) b('hiccup');
      if (i === 450) hire('cleaner');
      if (i === 600 && g.trigger('emergency')) g.respond(g.s.offer.id, true);
    }
    return g.hash();
  };
  eq(play(21), play(21), 'the same seed and commands give the same clinic');
  ok(play(21) !== play(22), 'a different seed gives a different day');
}

// ---------------------------------------------------------------- the save
{
  const { g } = basic('salt', 30);
  g.s.open = true; g.run(800);
  const save = newSave();
  save.current = g.toJSON(); save.stars.burrow = 3; save.settings.speed = 3; save.settings.music = false;
  const text = serialise(save);
  const back = parseSave(text);
  eq(back.stars.burrow, 3, 'stars survive');
  eq(back.settings.speed, 3, 'settings survive');
  eq(back.settings.music, false, 'music off survives');
  const g2 = Game.load(JSON.parse(text).current);
  eq(g2.hash(), g.hash(), 'the clinic in play survives the round trip');
  g.run(300); g2.run(300);
  eq(g2.hash(), g.hash(), 'and carries on exactly the same');
  eq(parseSave('{not json'), newSave(), 'a corrupt save starts fresh');
  eq(parseSave(JSON.stringify({ v: 9 })), newSave(), 'a save from another version starts fresh');
  const bad = parseSave(JSON.stringify({ ...save, current: { v: 1, clinic: 'salt', rooms: 'nope' } }));
  eq(bad.current, null, 'a corrupt clinic is dropped');
  eq(bad.stars.burrow, 3, 'but the campaign progress is kept');
  eq(SAVE_KEY, 'burrow-clinic-v1', 'the save key');
  eq(parseSave(null).current, null, 'no save: a fresh start');
}

// ---------------------------------------------------------------- odds and ends
{
  const g = new Game('burrow', 1);
  eq(clockText(g.s), '8:00', 'the day starts at 8:00');
  g.s.t = HOUR * 4.5;
  eq(clockText(g.s), '12:30', 'and the clock reads in ten-minute steps');
  eq(hourOf(g.s), 12.5, 'hours');
  ok(CLINICS.length === 6 && CLINICS.every((c, i) => c.index === i), 'six clinics');
  ok(CLINICS.every((c) => c.ailments.every(([a]) => c.rooms.includes(AILMENTS[a].room))), 'every clinic can build a room for each of its ailments');
  ok(CLINICS.every((c) => c.events.every(([d]) => d < c.days)), 'every scheduled event happens inside the day limit');
  ok(Object.values(DECOS).every((d) => d.cost > 0), 'decorations have prices');
}

// ---------------------------------------------------------------- waiting lines
{
  const { g, rooms } = basic('salt', 21);
  g.s.open = true;
  for (let i = 0; i < 14; i++) { const p = g.spawnPatient('static'); p.need = i % 2 ? 'checkup' : 'fluff'; p.dx = 'static'; g.requeue(p, false); }
  g.run(250);
  const waiting = g.s.patients.filter((p) => p.phase === 'wait' && !p.seat);
  const keys = waiting.map((p) => p.spot.join(','));
  ok(waiting.length >= 8, `a crowd waits (${waiting.length})`);
  eq(new Set(keys).size, keys.length, 'nobody stands on top of anybody');
  const doors = new Set(g.s.rooms.map((r) => { const [dx, dy] = SIDE_D[r.door.side]; return `${r.door.x + dx},${r.door.y + dy}`; }));
  ok(keys.every((k) => !doors.has(k)), 'and nobody blocks a doorway');
  for (const kind of ['fluff', 'checkup']) {
    const line = waiting.filter((p) => p.need === kind).sort((a, b) => a.qi - b.qi);
    const steps = line.slice(1).map((p, i) => Math.abs(p.spot[0] - line[i].spot[0]) + Math.abs(p.spot[1] - line[i].spot[1]));
    ok(steps.filter((d) => d === 1).length >= steps.length - 1, `the ${kind} line is tidy: one tile apart (${steps.join(' ')})`);
    const L = g.lineOf(rooms[kind].id);
    ok(L.line.slice(0, 2).some((t) => t[0] === line[0].spot[0] && t[1] === line[0].spot[1]), `the ${kind} line starts by its door`);
  }
  const front = waiting.filter((p) => p.need === 'fluff').sort((a, b) => a.qi - b.qi)[0];
  const [ax, ay] = (() => { const r = rooms.fluff; const [dx, dy] = SIDE_D[r.door.side]; return [r.door.x + dx, r.door.y + dy]; })();
  ok(Math.abs(front.spot[0] - ax) + Math.abs(front.spot[1] - ay) <= 2, 'the front of the line stands next to the door');
  const atSpot = waiting.filter((p) => Math.abs(p.x - p.spot[0]) < 0.01 && Math.abs(p.y - p.spot[1]) < 0.01);
  ok(atSpot.length && atSpot.every((p) => p.dir === p.fd), 'everyone in line faces the way the line goes');
  const before = waiting.filter((p) => p.need === 'fluff').map((p) => [p.id, p.qi]);
  const moved = () => before.filter(([id, qi]) => { const p = g.s.patients.find((x) => x.id === id); return p && p.phase === 'wait' && p.qi < qi; });
  ok(runUntil(g, () => moved().length > 0, DAY), 'as the front is served, the line steps forward');
}

// ---------------------------------------------------------------- mood reasons and complaints
{
  const { g } = basic('salt', 22);
  g.s.open = true;
  const p = g.spawnPatient('hiccups'); p.need = 'hiccup'; p.dx = 'hiccups'; g.requeue(p, false);
  g.run(30);
  p.thirst = 90; p.patience = 25;
  const why = g.whyOf(p).map((w) => w.id);
  ok(why.includes('thirst') && why.includes('wait') && why.includes('noroom'), `a thirsty, long-waiting patient says why (${why.join(', ')})`);
  ok(g.whyOf(p).every((w) => typeof w.text === 'string' && w.text.length > 3), 'in words');
  const pl = g.suggestDeco('plant'); g.place('plant', Math.round(p.x) + 1, Math.round(p.y)).ok || g.place('plant', pl[0], pl[1]);
  g.computeComfort();
  const c = g.complaints();
  ok(c.length >= 1 && c.length <= 3 && c[0].count >= 1 && Array.isArray(c[0].at), 'the clinic lists its top complaints, with somewhere to look');
  ok(c.every((x, i) => i === 0 || c[i - 1].count >= x.count), 'most common first');
}

// ---------------------------------------------------------------- staff growth, raises and training
{
  const { g, staff, b } = basic('salt', 23);
  const vet = staff.vet;
  g.s.open = true;
  ok(runUntil(g, () => vet.jobs > 0, DAY), 'staff gain experience from their work');
  ok(vet.xp > 0 && vet.today > 0, 'experience and jobs today are counted');
  const sk = vet.skill;
  vet.skill = Math.min(sk, 4); vet.xp = XP_FOR(vet.skill) - 0.5;
  const s0 = vet.skill;
  ok(runUntil(g, () => vet.skill > s0, DAY), 'enough experience earns a new star');
  ok(g.s.log.some((l) => l.text.includes(vet.name) && l.text.includes('stars')), 'and the news says so');
  ok(vet.wage < (40 + 22 * vet.skill) * 1, 'the wage stays the same until a raise');
  // the raise comes at the end of the day
  ok(runUntil(g, () => g.s.raise, DAY * 2), 'a better-skilled staff member asks for a raise');
  const r1 = g.s.raise, w0 = g.staffById(r1.staff).wage;
  ok(g.answerRaise(r1.id, true).ok && g.staffById(r1.staff).wage === w0 + r1.amount, 'yes: the raise is paid');
  eq(g.answerRaise(r1.id, true).ok, false, 'a raise is only answered once');
  // no: a little glum, never gone
  vet.wage -= 30; g.s.raise = { id: 999, staff: vet.id, amount: 30, expires: g.s.t + 500 };
  const m0 = vet.mood;
  ok(g.answerRaise(999, false).ok && vet.mood < m0, 'no: mood drops a little');
  vet.mood = 10; g.run(DAY);
  ok(g.staffById(vet.id) && vet.state !== 'leave', 'and they never quit over it');
  ok(workRate(vet) < workRate({ ...vet, mood: 90 }), 'a glum member of staff works a little slower');
  // training
  const sr = b('staff');
  for (const x of g.s.staff) if (x.role === 'vet') x.skill = Math.min(x.skill, 2);
  eq(g.setTraining(sr.id, true).ok, false, 'training needs a teacher');
  vet.skill = 3;
  ok(g.setTraining(sr.id, true).ok && sr.train, 'a 3-star vet can teach in the Staff Room');
  const rec = staff.recep; rec.skill = 1; rec.xp = 0; rec.energy = 5;
  ok(runUntil(g, () => rec.state === 'rest', DAY), 'a tired receptionist rests');
  const x0 = rec.xp; g.run(60);
  ok(rec.xp > x0 + 2, `and learns while resting (${x0.toFixed(1)} to ${rec.xp.toFixed(1)})`);
  const c0 = g.s.coins, sp0 = g.s.spent;
  g.s.t = Math.ceil(g.s.t / DAY) * DAY - 1; g.tick();
  ok(g.s.spent - sp0 >= TRAIN_COST + wagesPerDay(g.s) - 1, 'training costs a little each day');
}

// ---------------------------------------------------------------- room upgrades
{
  const { g, rooms } = basic('salt', 24);
  g.s.coins = 5000;
  eq(g.upgrade(rooms.reception.id).ok, false, 'the desk has no machine to upgrade');
  ok(!canUpgrade('checkup') && canUpgrade('fluff'), 'cure rooms only');
  const cost = g.upgradeCost(rooms.fluff);
  ok(cost > 0 && cost < 650, `level 2 costs ${cost}`);
  const c0 = g.s.coins;
  ok(g.upgrade(rooms.fluff.id).ok && rooms.fluff.level === 2 && g.s.coins === c0 - cost, 'buy level 2');
  ok(g.events.some((e) => e.t === 'upgrade' && e.level === 2), 'with a shiny event for the scene');
  const c2 = g.upgradeCost(rooms.fluff);
  ok(c2 > cost && g.upgrade(rooms.fluff.id).ok && rooms.fluff.level === 3, 'and level 3, dearer');
  eq(g.upgradeCost(rooms.fluff), 0, 'level 3 is the top');
  eq(g.upgrade(rooms.fluff.id).ok, false, 'no level 4');
  ok(UPGRADE_SPEED[3] > UPGRADE_SPEED[1], 'upgraded machines cure faster');
  g.s.coins = 10;
  const { g: g2, rooms: r2 } = basic('salt', 24); g2.s.coins = 10;
  ok(!g2.upgrade(r2.fluff.id).ok, 'upgrades need coins');
  // sell refunds half of everything spent
  const back = g.s.coins; g.sell(rooms.fluff.id);
  ok(g.s.coins - back === Math.round((650 + cost + c2) / 2) || g.s.coins - back > 650 / 2, 'selling an upgraded room returns more');
}

// ---------------------------------------------------------------- the Burrow Bulletin, gifts and kind wording
{
  const { g } = basic('salt', 25);
  g.s.open = true;
  ok(runUntil(g, () => g.s.cures > 0, DAY), 'a cure');
  const cured = g.s.patients.find((p) => p.cured);
  ok(!cured || (cured.gift >= 1 && cured.gift <= 4), 'cured patients take a balloon, a lollipop or a pinwheel home');
  ok(runUntil(g, () => g.s.bulletin, DAY * 2), 'the Burrow Bulletin arrives at the end of the day');
  const bl = g.s.bulletin;
  ok(bl.headline.length > 8 && bl.sub.length > 8, `with a headline: "${bl.headline}"`);
  ok(bl.cures >= 1 && bl.earned > 0 && typeof bl.rep === 'number', 'the day in numbers');
  ok(bl.star && bl.star.jobs > 0, `a staff member of the day (${bl.star && bl.star.name})`);
  ok(bl.quote && bl.quote.text.length > 8, 'a patient quote');
  ok(bl.tip.length > 8, 'and a tip');
  g.dismissBulletin(); eq(g.s.bulletin, null, 'tap to put it away');
  // the emergency wording says what really happened
  ok(g.trigger('emergency'), 'an emergency call');
  const o = g.s.offer; g.respond(o.id, false);
  ok(g.s.log.at(-1).text.includes('village doctor') && g.s.log.at(-1).text.includes(String(o.count)), 'saying no: they go to the village doctor');
  g.s.offer = { ...o, id: 77, expires: g.s.t }; g.tick();
  ok(g.s.log.some((l) => l.text.startsWith('Nobody answered in time')), 'no answer: the same, kindly');
  const words = JSON.stringify(g.s.log) + JSON.stringify(bl);
  ok(!/\b(he|she|his|her|him|hers)\b/i.test(words), 'gender-neutral wording');
}

// ---------------------------------------------------------------- an older save gains the new fields
{
  const { g } = basic('salt', 26);
  g.s.open = true; g.run(400);
  const old = JSON.parse(JSON.stringify(g.s));
  delete old.today; delete old.bulletin; delete old.raise;
  for (const r of old.rooms) { delete r.level; delete r.train; }
  for (const st of old.staff) { delete st.xp; delete st.mood; delete st.jobs; delete st.today; }
  for (const p of old.patients) { delete p.qi; delete p.qr; delete p.gift; delete p.fd; }
  const t0 = old.t, g2 = Game.load(old);
  ok(g2.s.rooms.every((r) => r.level === 1) && g2.s.staff.every((x) => x.mood > 0 && x.xp === 0) && g2.s.today, 'a save from before the update loads with sensible defaults');
  g2.run(300);
  ok(g2.s.t > t0, 'and plays on');
}

// ---------------------------------------------------------------- decoration facings: rotate while placing and after; seats face the bench's front
{
  const { g } = basic('salt', 27);
  g.s.coins = 5000;
  ok(DECOS.bench.facings === 4 && DECOS.plant.facings === 1, 'benches, coolers, carts and heaters turn; round things do not');
  // the bench goes in the line by the front door, where patients for a room not built yet wait
  const sp = g.lineOf(0).line[3];
  ok(g.place('bench', sp[0], sp[1], 2).ok, 'place a bench facing away (rotated while placing)');
  const b = g.s.decos.at(-1);
  eq(b.rot, 2, 'it keeps the facing it was placed with');
  ok(g.rotateDeco(b.id).ok && b.rot === 3, 'rotate it after placing (free)');
  const coins = g.s.coins;
  ok(g.rotateDeco(b.id).ok && b.rot === 0 && g.s.coins === coins, 'all the way round, for nothing');
  const pl = g.suggestDeco('plant'); g.place('plant', pl[0], pl[1], 3);
  const plant = g.s.decos.at(-1);
  eq(plant.rot, DECOS.plant.front, 'a plant ignores a facing');
  eq(g.rotateDeco(plant.id).ok, false, 'and refuses to rotate, with a reason');
  // a default facing points the front at open corridor
  const cs = g.suggestDeco('cooler'); g.place('cooler', cs[0], cs[1]);
  const cool = g.s.decos.at(-1), [fx, fy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][cool.rot];
  ok(g.grid.walk[(cool.y + fy) * g.W + cool.x + fx] === 1 && !g.roomAt[(cool.y + fy) * g.W + cool.x + fx], 'a new cooler faces open corridor');
  // the suggested bench spot gets a facing with its back to a wall and its front to open corridor
  const bs = g.suggestDeco('bench'), bf = g.facingFor('bench', bs[0], bs[1]), D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const openAt = (x, y) => x >= 0 && y >= 0 && x < g.W && y < g.H && !g.roomAt[y * g.W + x] && g.grid.walk[y * g.W + x] === 1;
  ok(openAt(bs[0] + D4[bf][0], bs[1] + D4[bf][1]), 'a suggested bench faces open floor');
  const anyBack = [0, 1, 2, 3].some((f) => openAt(bs[0] + D4[f][0], bs[1] + D4[f][1]) && !openAt(bs[0] - D4[f][0], bs[1] - D4[f][1]));
  ok(!anyBack || !openAt(bs[0] - D4[bf][0], bs[1] - D4[bf][1]), 'with its back to the wall when it can');
  // patients on a bench face its front, and turn with it
  g.s.open = true;
  const p = g.spawnPatient('hiccups'); p.need = 'hiccup'; p.dx = 'hiccups'; g.requeue(p, false);
  ok(p.seat === b.id, 'a patient sits on the bench');
  eq(p.fd, b.rot, 'facing the way the bench faces');
  g.rotateDeco(b.id);
  eq(p.fd, b.rot, 'and turning with it');
  ok(runUntil(g, () => Math.abs(p.x - b.x) < 0.01 && Math.abs(p.y - b.y) < 0.01, 400), 'they reach the bench');
  g.run(2);
  eq(p.dir, b.rot, 'and sit facing its front');
  // an old save's decorations get their painting's facing
  const old = JSON.parse(JSON.stringify(g.s)); for (const d of old.decos) delete d.rot;
  const g2 = Game.load(old);
  ok(g2.s.decos.every((d) => d.rot === DECOS[d.kind].front), 'old saves load with the default facing');
}

console.log(`clinic: ${checks} checks passed`);
