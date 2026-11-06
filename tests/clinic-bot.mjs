// Burrow Clinic bots: three managers run every clinic headless through the engine, the same commands the page sends.
// - casual: builds what Enzo's notes and the assist suggest, in a sensible but imperfect layout (one of the top few
//   "try here" spots), hires an average candidate, reacts to problems 20 to 40 in-game minutes late, says yes to
//   about half the emergencies and never drags staff about;
// - pro: plans ahead for the day's ailments, two check-up rooms, benches, drinks, plants, bins and heaters where
//   they matter, hires the best value staff and keeps a cleaner per few machines, reacts within minutes;
// - idle: opens the clinic page and does nothing.
// Targets (from the brief): casual meets clinic 1's goals in 90% of seeds, clinic 2's in 80%, every later clinic's
// in 60%; pro meets every clinic's in 95% and earns 3 stars on clinic 1 in 70%; idle never meets clinic 1's goals.
// `--quick` plays 12 seeds a clinic, the full run 40. Run after compiling the engine into .checks/.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Game, CLINICS, ROOMS, AILMENTS, DECOS, HOUR, DAY } from '../.checks/clinic-game.js';

const quick = process.argv.includes('--quick');
const SEEDS = quick ? 12 : 40;
const only = process.argv.find((a) => a.startsWith('--clinic='))?.slice(9);
const verbose = process.argv.includes('--verbose');
const trace = process.argv.includes('--trace');
const onlySeed = Number(process.argv.find((a) => a.startsWith('--seed='))?.slice(7) ?? 0);

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const MIN = HOUR / 60;

/** one manager over one clinic: returns the result */
export function play(clinic, seed, kind, hook) {
  const g = new Game(clinic.id, seed);
  const r = rng(seed * 977 + kind.length * 13 + clinic.index * 7);
  const pro = kind === 'pro';
  const delay = () => Math.round((pro ? 2 + r() * 6 : 20 + r() * 20) * MIN);
  const pending = new Map(); // problem id -> tick to act on it
  const coins = () => g.s.coins;
  const reserve = pro ? 150 : 250;

  const hireRole = (role) => {
    const cs = g.s.cands.filter((c) => c.role === role && c.wage <= coins() - reserve / 2);
    if (!cs.length) return false;
    let c;
    if (pro) c = cs.sort((a, b) => score(b) - score(a))[0];
    else { cs.sort((a, b) => a.skill - b.skill); c = cs[Math.floor((cs.length - 1) / 2)]; } // the middle one: average
    return g.hire(c.id).ok;
  };
  const score = (c) => c.skill * 30 - c.wage * 0.4 + (c.trait === 'quick' ? 20 : c.trait === 'cheery' ? 12 : c.trait === 'careful' ? 10 : -15);
  const buildRoom = (k, again = false) => {
    if (g.hasRoom(k) && !again) return false;
    if (coins() < ROOMS[k].cost + reserve) return false;
    const s = g.suggest(k, pro ? {} : { rank: Math.floor(r() * 4) }) ?? g.suggest(k);
    if (!s) return false;
    return g.build(k, s.x, s.y, s.w, s.h, s.rot).ok;
  };
  const placeDeco = (k) => {
    if (coins() < DECOS[k].cost + reserve) return false;
    const p = g.suggestDeco(k, pro ? 0 : Math.floor(r() * 5));
    return !!p && g.place(k, p[0], p[1]).ok;
  };
  const count = (role) => g.s.staff.filter((x) => x.role === role && x.state !== 'leave' && x.state !== 'gone').length;
  const later = (id, fn) => { if (!pending.has(id)) pending.set(id, { at: g.s.t + delay(), fn }); };

  // the opening moves: the tutorial's own order
  const opening = ['reception', 'recep', 'checkup', 'vet', 'cure'];
  let step = 0, openTicks = 0;
  const limit = (clinic.days + 1) * DAY;
  while (g.s.t < limit && g.s.result === 'playing') {
    if (kind === 'idle') { g.tick(); if (++openTicks > limit) break; continue; }
    // before opening, a human still takes time between clicks
    if (step < opening.length) {
      const o = opening[step];
      let ok = false;
      if (o === 'reception' || o === 'checkup') ok = buildRoom(o);
      else if (o === 'cure') { const first = clinic.ailments[0][0]; ok = buildRoom(AILMENTS[first].room); }
      else ok = hireRole(o);
      if (ok || g.hasRoom(o)) step++;
      for (let i = 0; i < (pro ? 20 : 120); i++) g.tick();
      if (++openTicks > 400) break;
      continue;
    }
    if (!g.s.open && g.s.tut >= 6 && g.s.t === 0) { g.openDoors(); }
    g.tick();
    const t = g.s.t;
    // emergencies: yes or no
    if (g.s.offer) {
      const o = g.s.offer;
      if (!pending.has('offer' + o.id)) {
        const yes = pro ? count('vet') + count('nurse') >= 3 : r() < 0.5;
        later('offer' + o.id, () => g.respond(o.id, yes));
      }
    }
    if (t % 10 === 0) {
      // the assist's notes are what a casual player reacts to
      for (const a of g.advice()) {
        if (!a.act) continue;
        if (a.act.hire) later(a.id, () => hireRole(a.act.hire));
        else if (a.act.build) later(a.id, () => buildRoom(a.act.build, a.id.startsWith('more-')));
        else if (a.act.place) later(a.id, () => placeDeco(a.act.place) && placeDeco(a.act.place));
      }
      if (pro) proThink();
      else casualThink();
    }
    for (const [id, p] of pending) if (t >= p.at) { pending.delete(id); p.fn(); }
    if (hook && t % DAY === DAY - 1) hook(g);
    if (trace && t % DAY === DAY - 1) {
      const s = g.s, q = {};
      for (const p of s.patients) if (p.phase === 'wait') q[p.need] = (q[p.need] ?? 0) + 1;
      console.log(`  ${kind} day ${s.day} coins ${Math.round(s.coins)} rep ${s.rep.toFixed(0)} cures ${s.cures} unhappy ${s.leftUnhappy} wait ${JSON.stringify(q)} rooms ${s.rooms.map((x) => x.kind).join(',')} staff ${s.staff.map((x) => x.role[0] + x.skill + ':' + Math.round(x.energy)).join(' ')} decos ${s.decos.length} litter ${s.litter.length} broken ${s.rooms.reduce((a, x) => a + x.slots.filter((y) => y.broken).length, 0)}`);
    }
  }

  function casualThink() {
    // a casual player builds a room for a new ailment once they notice patients waiting (the advice), and the
    // staff room when told; on top of that, now and then, one more vet when the check-up line is long
    const s = g.s;
    if (s.t % (HOUR * 2) === 0 && count('cleaner') === 0 && s.day >= 3) later('cleaner', () => hireRole('cleaner'));
  }
  function proThink() {
    const s = g.s;
    const rich = (n) => coins() > n;
    // every room for ailments arriving today or tomorrow, as soon as it is affordable
    for (const [a, d] of clinic.ailments) if (d <= s.day + 1 && !g.hasRoom(AILMENTS[a].room) && rich(ROOMS[AILMENTS[a].room].cost + 300)) later('room-' + a, () => buildRoom(AILMENTS[a].room));
    if (s.day >= 2 && g.roomsOf('checkup').length < 2 && rich(1500)) later('check2', () => buildRoom('checkup', true));
    if (!g.hasRoom('staff') && s.cures > 4 && rich(900)) later('staffroom', () => buildRoom('staff'));
    const vetRooms = s.rooms.filter((q) => ROOMS[q.kind].staff === 'vet').length;
    const nurseRooms = s.rooms.filter((q) => ROOMS[q.kind].staff === 'nurse').length;
    const queue = s.patients.filter((p) => p.phase === 'wait' && p.need !== 'reception').length;
    if (count('vet') < Math.min(vetRooms, 2 + Math.floor(queue / 6)) && rich(600)) later('vet', () => hireRole('vet'));
    if (nurseRooms && count('nurse') < Math.min(nurseRooms, 1 + Math.floor(queue / 10)) && rich(500)) later('nurse', () => hireRole('nurse'));
    const machines = s.rooms.reduce((a, q) => a + (q.kind === 'staff' || q.kind === 'reception' ? 0 : q.slots.length), 0);
    if (count('cleaner') < Math.ceil(machines / (clinic.twist === 'heat' ? 4 : 7)) && rich(400)) later('cleaner', () => hireRole('cleaner'));
    if (!rich(1200)) return;
    const benches = s.decos.filter((d) => d.kind === 'bench').length;
    if (benches < Math.min(6, 2 + s.rooms.length / 2)) later('bench' + benches, () => placeDeco('bench'));
    const plants = s.decos.filter((d) => d.kind === 'plant' || d.kind === 'cactus').length;
    if (s.cures > 5 && plants < 3) later('plant' + plants, () => placeDeco(clinic.twist === 'plants' ? 'plant' : 'cactus'));
    if (s.decos.filter((d) => d.kind === 'bin').length < 2 && s.cures > 5) later('bin', () => placeDeco('bin'));
    const drinks = s.decos.filter((d) => d.kind === 'cooler' || d.kind === 'vending').length;
    if (drinks < (clinic.twist === 'thirst' ? 3 : 1) && s.cures > 3) later('drink' + drinks, () => placeDeco(clinic.decos.includes('vending') ? 'vending' : 'cooler'));
    if (clinic.twist === 'cold' && s.decos.filter((d) => d.kind === 'heater').length < 4) later('heat', () => placeDeco('heater'));
  }

  const met = g.s.met;
  return { met: !!met && met.day <= clinic.days, stars: met ? met.stars : 0, day: met?.day ?? null, cures: g.s.cures, rep: Math.round(g.s.rep), coins: Math.round(g.s.coins), unhappy: g.s.leftUnhappy, emerg: g.s.emergencies.filter((e) => e.done && e.cured >= e.count).length };
}

const main = import.meta.url === pathToFileURL(process.argv[1]).href;
const TARGET = { casual: (i) => (i === 0 ? 0.9 : i === 1 ? 0.8 : 0.6), pro: () => 0.95 };
const rows = [];
let fails = 0;
for (const c of main ? CLINICS : []) {
  if (only && c.id !== only) continue;
  for (const kind of ['casual', 'pro', 'idle']) {
    if (kind === 'idle' && c.index > 0) continue;
    const res = [];
    for (let seed = onlySeed || 1; seed <= (onlySeed || SEEDS); seed++) res.push(play(c, seed, kind));
    const met = res.filter((x) => x.met).length / res.length;
    const three = res.filter((x) => x.met && x.stars === 3).length / res.length;
    const avg = (f) => Math.round(res.reduce((a, x) => a + f(x), 0) / res.length);
    const days = res.filter((x) => x.met).map((x) => x.day);
    rows.push(`${c.name.padEnd(14)} ${kind.padEnd(7)} met ${(met * 100).toFixed(0).padStart(3)}%  3★ ${(three * 100).toFixed(0).padStart(3)}%  day ${days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : '-'}/${c.days}  cures ${avg((x) => x.cures)}  rep ${avg((x) => x.rep)}  coins ${avg((x) => x.coins)}  unhappy ${avg((x) => x.unhappy)}`);
    if (verbose) for (const x of res) console.log('   ', JSON.stringify(x));
    const want = kind === 'idle' ? null : TARGET[kind](c.index);
    try {
      if (kind === 'idle') assert.equal(met, 0, `${c.name}: the idle player must never meet the goals`);
      else assert.ok(met >= want, `${c.name}: the ${kind} bot met the goals in ${(met * 100).toFixed(0)}% of seeds, needs ${want * 100}%`);
      if (kind === 'pro' && c.index === 0) assert.ok(three >= 0.7, `${c.name}: the pro earned 3 stars in ${(three * 100).toFixed(0)}% of seeds, needs 70%`);
    } catch (e) { fails++; console.error('FAIL', e.message); }
  }
}
if (main) console.log(rows.join('\n'));
if (fails) { console.error(`clinic bots: ${fails} target(s) missed`); process.exit(1); }
if (main) console.log(`clinic bots: every target met (${SEEDS} seeds a clinic)`);
