// Jade Street bots: every story mission played through the engine by players who think at human speed. A bot looks at
// the city only every 200-300 ms of game time (never faster than a person), steers a little off its line, sometimes
// overshoots a turn, and plays the mini-games with a human's timing slop. It walks to the contact from the safe house,
// talks, takes the rides the job needs, and on a failure presses Retry (from the checkpoint), as a player would.
//   perfect - reaction 200 ms, no noise: the scripted solver that tests/jade.mjs uses to prove every job completable
//   casual  - 200-300 ms, wobbly steering, sloppy timing, Assist on (Easy): must finish every job within its retries, on every
//             seed; it uses the partner (tag-team key) and the gadgets where a person would
//   normal  - a steadier player on Normal with Assist off, and the same player on Hard: first-try and finish rates
//             are reported (Normal should fail a fair share of first tries but still finish)
// The empire (tenth pass): every empire job at a property that offers it, and every kind of raid each gang brings, played
// the same way (`empireCases`); a raid starts as an alert across town, so the bot has to get there before the clock.
// The eleventh pass: generated contracts (`contractCase`), a few hundred of them in the full run.
// `--quick` (npm test) runs fewer seeds; `--diff` runs only the Normal and Hard players. Exports `playMission` and `missionSave` for tests/jade.mjs.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE } from '../.checks/jade-story.js';
import { newSave, available, offered } from '../.checks/jade-save.js';
import { VEHICLES } from '../.checks/jade-move.js';
import { T, W, S, F_ROOF, OW, city } from '../.checks/jade-city.js';
import { unmvP } from '../.checks/jade-layout.js';
import { downhill, los } from '../.checks/jade-nav.js';
import { rng } from '../.checks/jade-rng.js';
import { makeMini } from '../.checks/jade-mini.js';
import { GOODS, midPrice, prices } from '../.checks/jade-trade.js';
import { LIGHTS, lightOf } from '../.checks/jade-traffic.js';
import { ROADS } from '../.checks/jade-city.js';
import { inWindow, LADDER } from '../.checks/jade-boss.js';
import { tagOption, boostXY } from '../.checks/jade-tag.js';
import { carried, giveGadget, GEAR_GIFT } from '../.checks/jade-gear.js';
import { hiddenSpot, sightRange, BRANCHES } from '../.checks/jade-jobs.js';
import { BIZ_OF } from '../.checks/jade-biz.js';
import { startRaidAlert, startEmpireJob, RAID_KINDS, gangOf } from '../.checks/jade-empire.js';
import { contractOf, tierOf, starsFor } from '../.checks/jade-contracts.js';
import { contractMission } from '../.checks/jade-proc.js';
import { openDistricts, SAFE_HOUSES } from '../.checks/jade-save.js';

const QUICK = process.argv.includes('--quick');
const MAIN = import.meta.url === `file://${process.argv[1]}`;

/** a save that has finished every job before `id` */
export function missionSave(id, o = {}) {
  const s = newSave(o.seed ?? 7);
  // a Hawker Tales side job: the story up to (and including) the job that opens it
  const side = MISSION[id]?.side;
  const i = side ? MISSIONS.findIndex(m => m.id === side) + 1 : MISSIONS.findIndex(m => m.id === id);
  s.done = MISSIONS.slice(0, i).map(m => m.id);
  if (side) s.done.push(...SIDE.slice(0, SIDE.findIndex(m => m.id === id)).map(m => m.id));
  // the gadgets the story handed over by then (each job that gives one)
  if (o.gear !== false) for (const d of s.done) for (const g of GEAR_GIFT[d] ?? []) giveGadget(s, g);
  s.started = true; s.cash = o.cash ?? 400;
  s.settings.assist = o.assist ?? true; s.settings.diff = o.diff ?? 'easy';
  // start at the safe house nearest the job's contact
  s.safe = 'safe-market';
  // on the island, the safe house of the contact's district
  const d = city().places[MISSION[id]?.at]?.d;
  if (['heartland', 'bay', 'india', 'glam', 'resort'].includes(d)) s.safe = `safe-${d}`;
  return s;
}

const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

/** play one mission start to finish; returns { won, time, fails } */
/** a save that has finished the story, with the empire's property `id` owned (and coins in its till) */
export function empireSave(id, seed = 0) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)];
  for (const d of Object.keys(s.rep)) s.rep[d] = 60; s.cash = 2000; s.biz[id].lvl = 1; s.biz[id].bank = 200; s.empire.rank = 2;
  s.safe = `safe-${BIZ_OF[id].d}`; if (!city().places[s.safe]) s.safe = 'safe-market';
  return s;
}
/** the empire's cases: [label, property, options for playMission] — each empire job at a property that offers it, and
 *  every raid kind of each gang (at one property in the gang's district); a raid alert starts across town, with the
 *  real clock */
export function empireCases() {
  const out = [];
  for (const [job, id] of [['supplier', 'chicken'], ['inspector', 'prata'], ['pricewar', 'textile'], ['taxi', 'taxi'], ['tour', 'bumboat'], ['tour', 'kayak'], ['karaoke', 'karaoke']])
    out.push([`emp ${job} @${id}`, id, s => ({ save: s, setup: w => { w.placePlayer(...[BIZ_OF[id].at[0] * T + T / 2, BIZ_OF[id].at[1] * T + T + T / 2]); startEmpireJob(w, job, id); }, done: () => (s.empire.jobs[job] ?? 0) > 0, maxT: 700 })]);
  for (const id of ['claw', 'noodle', 'bumboat', 'kopitiam', 'prata']) for (const kind of RAID_KINDS[gangOf(id)])
    out.push([`raid ${kind} @${id}`, id, s => ({ save: s, setup: w => { startRaidAlert(w, id); w.emp.raid.kind = kind; }, done: () => s.stats.raidsWon > 0, lost: () => s.stats.raidsMissed > 0, maxT: 600 })]);
  return out;
}

/** the eleventh pass: a save past the first ending (variant 0: chapter six under way, 1: the whole story done, 2: the
 *  story done and an empire of a few properties, so the tier is higher), every safe house bought */
export function contractSave(seed, variant = seed % 3) {
  const s = newSave(seed + 1); s.started = true; s.story.intro = true;
  s.done = variant === 0 ? MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm25') + 1).map(m => m.id) : [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)];
  for (const d of s.done) for (const g of GEAR_GIFT[d] ?? []) giveGadget(s, g);
  for (const d of Object.keys(s.rep)) s.rep[d] = 50; s.cash = 600;
  for (const h of SAFE_HOUSES) s.best['house:' + h.id] = 1;
  if (variant === 2) { for (const id of ['noodle', 'bumboat', 'kopitiam', 'prata', 'claw']) s.biz[id].lvl = 2; s.empire.rank = 3; s.contracts.done = 12; }
  return s;
}
/** a generated contract for the bots: seed k, its slot's stars from the save's tier (or forced) */
export function contractCase(k, o = {}) {
  const s = contractSave(1000 + k, o.variant);
  const tier = tierOf(s), ref = { seed: 7919 * k + 13, tier, stars: o.stars ?? starsFor(k % 3, tier), open: openDistricts(s) };
  const c = contractOf(ref);
  return { s, c, opts: { save: s, setup: w => { const pl = w.c.places[c.at]; w.placePlayer(pl.x, pl.y + T); w.startMission(contractMission(c, w.assist, w.s.settings.diff === 'hard'), { key: 'con:test:' + ref.seed, reward: c.pay, d: c.d }); }, done: () => s.contracts.done > 0, maxT: 900 } };
}
export function playMission(id, profile = 'perfect', seed = 1, o = {}) {
  // lapse: the chance per decision of a human slip (a glance at the map, a fumbled turn) lasting 0.5-1.1 s;
  // notice: the chance of reading a telegraphed hazard in time to steer round it
  const P = { perfect: { lo: 0.2, hi: 0.2, wob: 0, slop: 0, lapse: 0, notice: 1, surge: 1 }, casual: { lo: 0.2, hi: 0.3, wob: 0.28, slop: 1, lapse: 0, notice: 0.85, surge: 0.25 }, normal: { lo: 0.22, hi: 0.34, wob: 0.24, slop: 0.8, lapse: o.lapse ?? 0.05, notice: 0.7, surge: 0.12 } }[profile];
  const assist = o.assist ?? profile !== 'normal';
  // the tenth pass: an empire raid or empire job is not a story job: `o.save` gives its save, `o.setup(w)` sets it up
  // (a raid alert, or the job started at its property) and `o.done(w)` says when it is over
  const s = o.save ?? missionSave(id, { seed: 3 + seed, assist, diff: o.diff ?? (assist ? 'easy' : 'normal') });
  if (o.save) { s.settings.assist = assist; s.settings.diff = o.diff ?? (assist ? 'easy' : 'normal'); }
  const w = new World(s, 100 + seed);
  w.quiet = true;
  const R = rng(seed * 991 + id.length * 31 + id.charCodeAt(1) * 7);
  const m = MISSION[id] ?? { at: '' };
  const why = []; let lapse = 0, inp = { ...NO_INPUT }, think = 0, fails = 0, t = 0, mini = null, miniT = 0, stuck = 0, lastPos = [0, 0], unstick = 0, uDir = [0, 0];
  const maxT = o.maxT ?? 900;
  let started = false, forced = false;
  const wantMission = () => { const a = offered(s); return a.some(x => x.id === id); };
  if (o.setup) o.setup(w); else assert.ok(wantMission(), `${id} is offered at the start`);

  // steering toward a world point with the right flow field
  const steer = (x, y, cls) => {
    const p = w.p; const px = p.x, py = p.y;
    if (cls !== 'fly' && dist(px, py, x, y) > T * 1.3) {
      const f = w.fieldTo(cls, x, y); const n = downhill(w.c, f, px, py, w.open);
      if (n) { x = n[0]; y = n[1]; }
    }
    const dx = x - px, dy = y - py, l = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx) + (R() - 0.5) * P.wob * 2;
    return [Math.cos(a), Math.sin(a), l];
  };
  const clsNow = () => w.p.ride ? VEHICLES[w.p.ride.kind].cls : 'foot';
  const go = (x, y, mag = 1) => {
    const [ix, iy] = steer(x, y, clsNow()); inp.mx = ix * mag; inp.my = iy * mag;
    // a low prop (crates, a bench) in the way on foot: hop it, as the route expects
    if (!w.p.ride && !w.p.roof) { const tx = Math.floor((w.p.x + ix * 44) / T), ty = Math.floor((w.p.y + iy * 44) / T); if (w.c.solid[ty * W + tx] === S.LOW) inp.hop = true; }
  };
  const press = k => { inp[k] = true; };
  // the tag-team key: pressed when F offers the move this player wants (the HUD shows it)
  const tagIf = (...kinds) => { const o = tagOption(w); if (o && kinds.includes(o.kind)) { press('tag'); return true; } return false; };
  // a gadget shot at a point: whoever fires (the passenger on a ride) needs one in hand
  const shooter = () => w.p.ride ? (w.mate.seat === w.p.ride ? w.mate : null) : w.p;
  const canFire = (g) => { const sh = shooter(); if (!sh || o.gadgets === false) return false; const c = carried(s, sh.who); return !!c && (!g || g.includes(c)) && s.gear.clip[c] + s.gear.ammo[c] > 0 && sh.fireCd <= 0 && sh.reloadT <= 0; };
  const shoot = (x, y, g) => { if (!canFire(g)) return false; inp.fire = true; inp.ax = x + (R() - 0.5) * 30 * P.wob; inp.ay = y + (R() - 0.5) * 30 * P.wob; return true; };
  // the gadget we'd rather hold for a job: switch hands with 1/2 when the other one fits better
  const wantGadget = (gs) => { const sh = shooter(); if (!sh) return; const c = s.gear.carry[sh.who]; const i = c.findIndex(g => gs.includes(g)); if (i >= 0 && s.gear.slot[sh.who] !== i) inp.slot = i; };
  const getRide = (pred, near) => {
    // walk to the closest matching parked ride and get on
    if (w.p.ride && !pred(w.p.ride)) { if (w.near?.kind === 'exit') press('act'); return; }
    const rides = w.rides.filter(r => r.parked && pred(r) && w.open.has(w.c.ground ? districtOf(r.b.x, r.b.y) : 'market'));
    rides.sort((a, b) => dist(a.b.x, a.b.y, near?.[0] ?? w.p.x, near?.[1] ?? w.p.y) - dist(b.b.x, b.b.y, near?.[0] ?? w.p.x, near?.[1] ?? w.p.y));
    const r = rides[0]; if (!r) return;
    if (w.near?.kind === 'ride' && w.near.ride === r) { press('act'); return; }
    go(r.b.x, r.b.y);
  };
  const districtOf = (x, y) => { const [ox, oy] = unmvP(x, y) ?? [0, 0], tx = Math.floor(ox / T), ty = Math.floor(oy / T); return tx >= OW ? (ty < 38 ? 'heartland' : 'bay') : tx < 46 ? (ty < 30 ? 'temple' : 'market') : ty >= 62 ? 'docks' : tx < 75 ? 'canal' : 'arcade'; };
  const offFoot = () => { if (w.p.ride && w.near?.kind === 'exit') press('act'); };

  // what a careful player sees coming: rubble rings, drum lanes, the container's shadow, sign shadows and decoys
  function hazards() {
    const run = w.run; if (!run) return [];
    const out = [];
    for (const st of run.sets) {
      if (st.def.k === 'stall' && st.ph !== 'wait') for (const c of st.rubble) if (!c.hit) out.push([c.x, c.y, c.r]);
      if (st.def.k === 'drums' && st.ph !== 'wait' && st.ph !== 'done') for (const d of st.drums) if (!d.hit) out.push([d.x, d.on ? d.y : Math.max(d.y, Math.min(w.p.y, st.y + 4 * T)), 30]);
      if (st.def.k === 'crane') out.push([st.x + st.swing, st.y, 46]);
    }
    for (const sg of run.signs) if (sg.ph !== 'wreck') out.push([sg.x, sg.y, 56]);
    for (const a of run.actors) if (a.kind === 'decoy' && !a.gone) out.push([a.b.x, a.b.y, 30]);
    // a person doesn't read every warning: each hazard is noticed (or missed) once, by chance
    return out.filter(h => { const k = `${Math.round(h[0] / 40)},${Math.round(h[1] / 40)}`; if (!(k in seen)) seen[k] = R() < P.notice; return seen[k]; });
  }
  const seen = {};
  function dodge() {
    const p = w.p; const l = Math.hypot(inp.mx, inp.my); if (l < 0.2) return;
    let ux = inp.mx / l, uy = inp.my / l, px = 0, py = 0;
    for (const [hx, hy, hr] of hazards()) {
      const dx = hx - p.x, dy = hy - p.y; const along = dx * ux + dy * uy, side = dx * -uy + dy * ux;
      if (along < -10 || along > 190 || Math.abs(side) > hr + 34) continue;
      const k = side >= 0 ? -1 : 1; px += -uy * k * 1.4; py += ux * k * 1.4;
    }
    if (px || py) { ux += px; uy += py; const m = Math.hypot(ux, uy) || 1; inp.mx = ux / m * l; inp.my = uy / m * l; }
  }
  // a careful rider stops for a red light (Normal and Hard care about them): brake before a crossing that is red
  // for the way we are heading, unless we are already in it
  function redStop() {
    const p = w.p, r = p.ride; if (!r || r.kind === 'boat' || !(w.diff.redLight > 0)) return;
    if (Math.hypot(inp.mx, inp.my) < 0.2) return;
    const h = Math.atan2(inp.my, inp.mx), axis = Math.abs(Math.cos(h)) >= Math.abs(Math.sin(h)) ? 'h' : 'v';
    for (let li = 0; li < LIGHTS.length; li++) {
      const L = LIGHTS[li], bx = ROADS[L.v].at * T, by = ROADS[L.h].at * T;
      const inBox = (x, y) => x > bx - 4 && x < bx + 4 * T + 4 && y > by - 4 && y < by + 4 * T + 4;
      if (inBox(p.x, p.y)) return;
      const cx = bx + 2 * T, cy = by + 2 * T, dx = cx - p.x, dy = cy - p.y;
      const along = dx * Math.cos(h) + dy * Math.sin(h), side = Math.abs(-dx * Math.sin(h) + dy * Math.cos(h));
      if (side > 2.2 * T || along < 2 * T || along > 2 * T + 40 + r.b.speed * r.b.speed / 2400) continue;
      // look ahead by the time it takes to get there, as a person judging an amber would
      const col = lightOf({ time: w.time + Math.max(0, along - 2 * T) / Math.max(120, r.b.speed) }, li, axis);
      if (col !== 'green') { inp.mx = 0; inp.my = 0; return; }
    }
  }
  // ── the job steps (lib/jade-jobs.ts)
  const angTo = (a, x, y) => Math.abs(((Math.atan2(y - a.b.y, x - a.b.x) - a.b.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  const blindA = a => (a.extra2 ?? 0) > 0 || (a.stare ?? 0) > 0 || (a.mind?.treat ?? 0) > 0;
  /** would a guard or a camera see a point (with a margin a careful player leaves)? */
  const watched = (x, y, margin = 1) => w.run.actors.some(a => {
    if (blindA(a)) return false;
    if (a.kind === 'guard') return dist(a.b.x, a.b.y, x, y) < sightRange(w.run) * margin + 30 && angTo(a, x, y) < (assist ? 0.45 : 0.55) + 0.35 * margin && los(w.c, a.b.x, a.b.y, x, y);
    if (a.kind === 'cam') return dist(a.b.x, a.b.y, x, y) < (assist ? 200 : 240) * margin + 20 && angTo(a, x, y) < 1.0 && los(w.c, a.b.x, a.b.y, x, y);
    return false;
  });
  /** a guard or lookout on edge (a "?" or "!" over its head) that has you in its eye or is coming over: a person backs
   * off to the last spot where nobody was looking and waits there for it to give up (lib/jade-aware.ts) */
  let trail = [], hideTo = null;
  function backOff() {
    const p = w.p, run = w.run;
    const edgy = run.actors.filter(a => a.mind && a.mind.st !== 'patrol' && a.mind.st !== 'back' && !blindA(a));
    if (!trail.length || dist(trail[trail.length - 1][0], trail[trail.length - 1][1], p.x, p.y) > 40) { trail.push([p.x, p.y]); if (trail.length > 40) trail.shift(); }
    if (trail.length && dist(trail[0][0], trail[0][1], p.x, p.y) > 1400) trail = [[p.x, p.y]];
    if (!edgy.length) { hideTo = null; return false; }
    const near = edgy.some(a => a.mind.seen || dist(a.b.x, a.b.y, p.x, p.y) < 320 && los(w.c, a.b.x, a.b.y, p.x, p.y));
    if (!near && !hideTo) return false;
    // the most recent spot behind us that none of them can see
    const safe = ([x, y]) => edgy.every(a => !los(w.c, a.b.x, a.b.y, x, y) || dist(a.b.x, a.b.y, x, y) > 330);
    if (!hideTo || !safe(hideTo)) { hideTo = null; for (let k = trail.length - 1; k >= 0; k--) if (safe(trail[k])) { hideTo = trail[k]; break; } }
    if (!hideTo) hideTo = trail[0];
    // one is shouting and coming for us: run (a run outpaces a chase) back the way we came, as far as it takes
    const hunter = edgy.find(a => a.mind.st === 'alert' && dist(a.b.x, a.b.y, p.x, p.y) < 360);
    if (hunter) { let best = trail[0], bv = -1; for (const q of trail) { const v = dist(q[0], q[1], hunter.b.x, hunter.b.y) - dist(q[0], q[1], p.x, p.y) * 0.3 + (los(w.c, hunter.b.x, hunter.b.y, q[0], q[1]) ? 0 : 200); if (v > bv) { bv = v; best = q; } } inp.sneak = false; go(best[0], best[1], 1); return true; }
    if (!hideTo || dist(hideTo[0], hideTo[1], p.x, p.y) < 18) { inp.mx = 0; inp.my = 0; inp.sneak = true; return !!hideTo; }
    inp.sneak = !edgy.some(a => a.mind.st === 'alert'); go(hideTo[0], hideTo[1], 1); return true;
  }
  /** sneak towards a point, holding back while the next stretch is watched, backing out of a guard's way */
  function sneakTo(x, y) {
    if (backOff()) return;
    const p = w.p; inp.sneak = true; go(x, y, 1);
    const nx = p.x + inp.mx * 60, ny = p.y + inp.my * 60;
    if (watched(nx, ny) && !watched(p.x, p.y, 0.8)) { inp.mx = 0; inp.my = 0; }
    const close = w.run.actors.find(a => a.kind === 'guard' && !blindA(a) && dist(a.b.x, a.b.y, p.x, p.y) < 170 && angTo(a, p.x, p.y) < 0.8);
    if (close) { const ax = p.x - close.b.x, ay = p.y - close.b.y, l = Math.hypot(ax, ay) || 1; const hx = Math.cos(close.b.h), hy = Math.sin(close.b.h); const sd = (ax * -hy + ay * hx) >= 0 ? 1 : -1; inp.mx = (-hy * sd * 0.8 + ax / l * 0.6); inp.my = (hx * sd * 0.8 + ay / l * 0.6); }
  }
  const nearJob = pre => w.near?.kind === 'job' && w.near.id.startsWith(pre);
  const job = { asked: {}, order: null };
  function decideJob(st) {
    const p = w.p, run = w.run, js = run.js; if (!js) return;
    // the sixteenth pass: a case beside the ice-cream motorbike: ride up, ring the chime, and hop off to photograph
    // while the guards eat (back on and ring again once they go back to their posts)
    if (st.t === 'case' && st.skin === 'bat') {
      const guards = run.actors.filter(a => a.kind === 'guard'), tg = run.target();
      const eating = guards.filter(a => (a.mind?.treat ?? 0) > 3).length, coming = guards.filter(a => a.mind?.wantTreat).length;
      const hungry = guards.some(a => (a.mind?.cones ?? 0) < 2);
      if (p.ride?.kind === 'icecream') {
        if (!tg) return;
        if (dist(tg[0], tg[1], p.x, p.y) > 230) { go(tg[0], tg[1], 0.7); return; }
        inp.mx = 0; inp.my = 0;
        if (eating + coming === 0) { if (hungry && p.chimeT <= 0 && (w.tick & 15) === 0) press('hop'); else if (!hungry) offFoot(); return; }
        if (coming === 0) offFoot();
        return;
      }
      if (!p.ride && eating === 0 && hungry && !p.act && guards.every(a => a.mind?.st === 'patrol' || a.mind?.st === 'back')) { getRide(r => r.kind === 'icecream'); return; }
    }
    if (p.ride && !(st.t === 'heist' && js.ph === 3 && js.mode === 'loud') && st.t !== 'defend') { offFoot(); return; }
    switch (st.t) {
      case 'case': {
        if (p.act) return;
        if (nearJob('photo') && !watched(p.x, p.y, 0.9)) { press('act'); return; }
        const tg = run.target(); if (!tg) return;
        // a guard about to turn this way: the partner draws it off
        if (watched(p.x, p.y, 1.1) && R() < 0.5) tagIf('distract');
        sneakTo(tg[0], tg[1]); return;
      }
      case 'heist': {
        const tg = run.target();
        if (js.mode === 'loud') {
          if (js.ph === 3) { if (!p.ride) { getRide(r => r.kind === 'scooter' && !r.locked); return; } if (tg) go(tg[0], tg[1]); return; }
          if (tg) go(tg[0], tg[1]); if (!p.ride && tg && dist(tg[0], tg[1], p.x, p.y) > 200 && R() < 0.2) press('dash');
          return;
        }
        if (p.act || !tg) return;
        // quiet: paint a camera that looks our way, have the partner distract a guard, sneak
        const cam = run.actors.find(a => a.kind === 'cam' && !blindA(a) && dist(a.b.x, a.b.y, p.x, p.y) < 330);
        if (cam) { wantGadget(['paint']); shoot(cam.b.x, cam.b.y, ['paint']); }
        if (watched(p.x, p.y, 1.1) && R() < 0.5) tagIf('distract');
        sneakTo(tg[0], tg[1]); return;
      }
      case 'defend': {
        if (nearJob('mend') && !p.act) { press('act'); return; }
        const tg = run.target(); if (!tg) return;
        const [sx, sy] = run.spot(st.at);
        const a = run.actors.filter(x => x.kind === 'pest' && x.extra !== 2).sort((u, v) => dist(u.b.x, u.b.y, sx, sy) - dist(v.b.x, v.b.y, sx, sy))[0];
        if (!a) { if (dist(sx, sy, p.x, p.y) > 70) go(sx, sy, 0.8); return; }
        go(a.b.x, a.b.y);
        const d = dist(a.b.x, a.b.y, p.x, p.y);
        if (d < 110) press('dash');
        else if (d < 380) shoot(a.b.x, a.b.y);
        return;
      }
      case 'blend': {
        if (p.act) return;
        if (js.pick === 'commotion') {
          // the racket: hurry to the goal while they stare; after it, sneak on (and wait while a lookout faces us)
          const [gx, gy] = run.spot(st.goal); go(gx, gy);
          if (js.t <= 0) { inp.sneak = true; const nx = p.x + inp.mx * 60, ny = p.y + inp.my * 60; if (run.actors.some(a => a.kind === 'watcher' && !blindA(a) && dist(a.b.x, a.b.y, nx, ny) < 300 && angTo(a, nx, ny) < 1.1 && los(w.c, a.b.x, a.b.y, nx, ny))) { inp.mx = 0; inp.my = 0; } }
          else if (js.t < 3) inp.sneak = false;
          return;
        }
        if (js.ph === 0) { if (nearJob('disguise')) { press('act'); return; } go(run.items[0].x, run.items[0].y); return; }
        if ((run.meter?.v ?? 0) > (P.slop ? 0.5 : 0.4) && nearJob('paper')) { press('act'); return; }
        const [gx, gy] = run.spot(st.goal);
        // keep to a walk, beside the nearest stroller heading our way
        inp.sneak = true;
        const c = run.actors.filter(a => a.kind === 'crowd').sort((u, v) => dist(u.b.x, u.b.y, p.x, p.y) - dist(v.b.x, v.b.y, p.x, p.y))[0];
        if (c && dist(c.b.x, c.b.y, p.x, p.y) > 110 && (run.meter2?.bad)) go(c.b.x, c.b.y); else go(gx, gy);
        // don't walk into people
        for (const q of run.actors) if (q.kind === 'crowd' && dist(q.b.x, q.b.y, p.x + inp.mx * 30, p.y + inp.my * 30) < 26) { const ax = p.x - q.b.x, ay = p.y - q.b.y, l = Math.hypot(ax, ay) || 1; inp.mx += ax / l * 0.8; inp.my += ay / l * 0.8; }
        return;
      }
      case 'detective': {
        if (p.act) return;
        if (js.clues.length < st.witnesses.length) {
          if (nearJob('ask')) { press('act'); return; }
          const a = run.actors.filter(x => x.kind === 'witness' && !js.clues.includes(x.extra)).sort((u, v) => dist(u.b.x, u.b.y, p.x, p.y) - dist(v.b.x, v.b.y, p.x, p.y))[0];
          if (a) go(a.b.x, a.b.y);
          return;
        }
        // every clue in: reason it out (a hurried player sometimes tries a near miss first)
        if (!job.order) {
          const h = hiddenSpot(st), tags = st.witnesses.map(x => x.tag);
          const near = st.spots.map((sp, i) => [i, tags.filter(t => sp.tags.includes(t)).length]).filter(([i, n]) => i !== h && n === tags.length - 1).map(([i]) => i);
          job.order = (near.length && R() < 0.12 * P.slop) ? [near[0], h] : [h];
        }
        const j = job.order.find(i => !js.searched.includes(i)) ?? hiddenSpot(st);
        if (w.near?.kind === 'job' && w.near.id === `search:${j}`) { press('act'); return; }
        go(run.items[j].x, run.items[j].y, 0.8); return;
      }
      case 'trap': {
        if (p.act) return;
        if (js.pick === 'chase') {
          // run each one down: head for the nearest still walking (cutting in ahead of it) and dash when close
          const a = run.actors.filter(x => x.kind === 'lured' && x.extra === 0).sort((u, v) => dist(u.b.x, u.b.y, p.x, p.y) - dist(v.b.x, v.b.y, p.x, p.y))[0];
          if (!a) { const [x0, y0] = run.path(st.path, 'foot')[0]; if (dist(x0, y0, p.x, p.y) > 200) go(x0, y0); return; }
          const d = dist(a.b.x, a.b.y, p.x, p.y), lead = Math.min(1, d / 400) * 60;
          go(a.b.x + Math.cos(a.b.h) * lead, a.b.y + Math.sin(a.b.h) * lead);
          if (d < 95) press('dash');
          return;
        }
        if (js.ph === 0) { if (nearJob('set')) { press('act'); return; } const tg = run.target(); if (tg) go(tg[0], tg[1]); return; }
        if (js.ph === 1) { if (nearJob('bait')) { press('act'); return; } const [bx, by] = run.spot(st.bait); go(bx, by); return; }
        const [wx, wy] = run.spot(st.wait);
        if (dist(wx, wy, p.x, p.y) > 40) go(wx, wy);
        const Rr = assist ? 70 : 52;
        const on = js.set.some(i => !js.sprung.includes(i) && run.actors.some(a => a.kind === 'lured' && a.extra === 0 && dist(a.b.x, a.b.y, run.items[i].x, run.items[i].y) < Rr * (0.8 - 0.25 * P.slop * R())));
        if (on) tagIf('spring');
        return;
      }
      case 'swap': {
        if (p.act) return;
        const tg = run.target(); if (!tg) return;
        const d = dist(tg[0], tg[1], p.x, p.y);
        if (nearJob('swap')) {
          // only when nobody will look this way for the next second and a half
          const risky = run.actors.some(a => a.kind === 'guard' && !blindA(a) && dist(a.b.x, a.b.y, p.x, p.y) < sightRange(run) + 60 && (angTo(a, p.x, p.y) < 1.2 || a.lookCd < 1.8 || (a.extra ?? 0) > 0) && los(w.c, a.b.x, a.b.y, p.x, p.y));
          if (!risky) { press('act'); return; }
          if (R() < 0.4) tagIf('distract');
          inp.mx = 0; inp.my = 0; return;
        }
        if (d < 200 && watched(p.x, p.y, 0.9) && R() < 0.3) tagIf('distract');
        sneakTo(tg[0], tg[1]); return;
      }
    }
  }
  function decide() {
    decide0(); dodge(); redStop();
  }
  function decide0() {
    inp = { ...NO_INPUT };
    const p = w.p;
    if (!w.run) {
      if (started) return;
      // an empire raid: hurry to the property (the raid starts on arrival)
      if (w.emp.raid) { const b = w.emp.raid, pl = w.c; void pl; const [bx, by] = [BIZ_OF[b.id].at[0] * T + T / 2, BIZ_OF[b.id].at[1] * T + T / 2]; go(bx, by + T); return; }
      if (o.setup) return;
      // walk to the contact and press the action button
      const pl = w.c.places[m.at];
      if (w.near?.kind === 'mission' && w.near.id === id) { press('act'); return; }
      // (a job offered at a station's gates is taken from its giver, who waits beside them)
      const gv = w.cast.find(c => c.job === id); if (gv && m.at.startsWith('stn-')) { go(gv.x, gv.y); return; }
      go(pl.x, pl.y); return;
    }
    started = true;
    const run = w.run, st = run.cur;
    if (!st) return;
    switch (st.t) {
      case 'post': return;
      case 'switch': press('swap'); return;
      case 'hold': {
        const [lx, ly] = run.spot(st.lever), [tx, ty] = run.spot(st.through);
        const m2 = w.mate;
        if (!(m2.ai.mode === 'hold' && m2.ai.holding)) { if (m2.ai.mode !== 'hold' && !tagIf('hold')) go(lx, ly, 0.6); else { inp.mx = 0; inp.my = 0; } return; }
        go(tx, ty, 0.8); return;
      }
      case 'boost': {
        if (p.ride) { offFoot(); return; }
        const [gx, gy] = boostXY(st.at, false);
        if (dist(gx, gy, p.x, p.y) > 70) { go(gx, gy, 0.8); return; }
        if (!tagIf('boost-mate')) { inp.mx = 0; inp.my = 0; }
        return;
      }
      case 'bag': {
        const a = run.actors.find(x => x.kind === 'bagbird'); if (!a) return;
        wantGadget(['sling', 'paint', 'net', 'popper']);
        if (dist(a.b.x, a.b.y, p.x, p.y) < 420) shoot(a.b.x, a.b.y);
        if ((a.extra ?? 0) > 0) { go(a.b.x, a.b.y); if (!p.ride && dist(a.b.x, a.b.y, p.x, p.y) < 80) press('dash'); if (p.ride && dist(a.b.x, a.b.y, p.x, p.y) < 160) tagIf('snatch'); }
        else { const d = dist(a.b.x, a.b.y, p.x, p.y); if (d > 200) go(a.b.x, a.b.y, 0.7); else { inp.mx = 0; inp.my = 0; } }
        return;
      }
      case 'goto': {
        const [x, y] = run.spot(st.at);
        if (st.ride === 'foot' && p.ride) { if ((dist(p.x, p.y, x, y) < 400 || w.near?.kind === 'exit') && (w.tick & 63) < 32) offFoot(); else go(x, y); return; }
        if (st.ride && st.ride !== 'foot' && p.ride?.kind !== st.ride) { getRide(r => r.kind === st.ride); return; }
        if (p.roof) { const l = w.c.ladders.map(l => [l.rx * T + 32, l.ry * T + 32]).sort((a, b) => dist(...a, p.x, p.y) - dist(...b, p.x, p.y))[0]; if (w.near?.kind === 'ladder-down') press('act'); else go(l[0], l[1]); return; }
        go(x, y); return;
      }
      case 'ride': {
        const r = run.ride;
        if (p.ride && p.ride !== r) { offFoot(); return; }
        if (r && !p.ride && !p.act) { if (w.near?.kind === 'ride' && (w.near.ride === r || (w.near.ride.kind === st.kind && !st.locked && !w.near.ride.locked))) press('act'); else go(r.b.x, r.b.y); }
        return;
      }
      case 'pickup': { const [x, y] = run.spot(st.at); go(x, y, 0.8); return; }
      case 'train': {
        if (p.ride) { offFoot(); return; }
        if (w.near?.kind === 'station') { press('act'); return; }
        const tg = run.target(); if (tg) go(tg[0], tg[1]); return;
      }
      case 'cable': {
        if (p.ride) { offFoot(); return; }
        if (w.ui) { w.ui = null; return; }
        if (w.ferry) return;
        if (w.near?.kind === 'cable' || w.near?.kind === 'ferry') { press('act'); return; }
        const tg = run.target(); if (tg) go(tg[0], tg[1]); return;
      }
      // the sixteenth pass: the tandem's tosses and the dragon boat's paddle (surge whenever the drum allows)
      case 'toss': {
        if (p.ride?.kind !== 'tandem') { getRide(r => r.kind === 'tandem'); return; }
        if (w.mate.seat !== p.ride) { inp.mx = 0; inp.my = 0; return; }
        if (tagIf('toss')) return;
        const tg = run.target(); if (tg) go(tg[0], tg[1], 0.8); return;
      }
      case 'paddle': {
        if (p.ride?.kind !== 'dragon') { getRide(r => r.kind === 'dragon'); return; }
        if (w.mate.seat !== p.ride && !o.solo) { inp.mx = 0; inp.my = 0; return; }
        const [x, y] = run.spot(st.to); go(x, y);
        if (p.boostCd <= 0 && !o.nosurge && R() < P.surge) press('dash');
        return;
      }
      case 'beat': { if (!p.ride) { getRide(r => r.kind === 'scooter'); return; } const [x, y] = run.spot(st.to); go(x, y); return; }
      case 'deliver': { const [x, y] = run.spot(st.to); go(x, y, st.fragile ? 0.62 : 1); if (st.fragile && p.ride && p.ride.b.speed > 200) { inp.mx *= 0.2; inp.my *= 0.2; } return; }
      case 'chase': {
        const a = run.actors[0]; if (!a) return;
        // fell off (or hopped off by mistake) in a ride chase: back on the nearest ride of the kind
        if (!p.ride && st.who !== 'runner' && !p.act) { const kind = st.who === 'boat' ? 'boat' : 'scooter'; getRide(r => r.kind === kind && !r.locked); return; }
        const lead = Math.min(80, dist(a.b.x, a.b.y, p.x, p.y) * 0.3);
        const tx = a.b.x + Math.cos(a.b.h) * lead, ty = a.b.y + Math.sin(a.b.h) * lead;
        const sees = los(w.c, p.x, p.y, tx, ty) && dist(tx, ty, p.x, p.y) < 400;
        if (sees) { const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1; const an = Math.atan2(dy, dx) + (R() - 0.5) * P.wob; inp.mx = Math.cos(an); inp.my = Math.sin(an); }
        else go(tx, ty);
        const da = dist(a.b.x, a.b.y, p.x, p.y), last = a.hits >= st.bumps - 1;
        if (st.finish === 'pounce' && !p.ride) { if (w.mate.ai.mode !== 'pounce' && dist(a.b.x, a.b.y, w.mate.x, w.mate.y) < 300 && !assist) tagIf('pounce'); }
        if (last && (st.finish === 'snatch' || st.finish === 'net') && p.ride) {
          // alongside for the grab, or the net from the back seat
          if (tagIf('snatch')) return;
          // still dizzy from the last bump: hold back and let it roll on, or every nudge dizzies it again
          if (a.stun > 0 && da < 140) { inp.mx = 0; inp.my = 0; return; }
          if (st.finish === 'net') { wantGadget(['net']); if (da < 380) shoot(a.b.x, a.b.y, ['net']); }
          if (da < 120) { const sp = p.ride.b.speed, as = a.b.speed; if (sp > as + 30) { inp.mx *= 0.4; inp.my *= 0.4; } }
          return;
        }
        // the net on foot: trip it first, then throw the net
        if (last && st.finish === 'net' && !p.ride) { if (!s.gear.carry[p.who].includes('net') && s.gear.carry[w.mate.who].includes('net') && !w.mate.seat) { press('swap'); return; } wantGadget(['net']); if (da < 330 && a.stun <= 0 && shoot(a.b.x, a.b.y, ['net'])) return; }
        if (!p.ride && da < 90) press('dash');
        if (p.ride && da > 300 && R() < 0.3) press('dash');

        return;
      }
      case 'tail': {
        const a = run.actors[0]; if (!a) return;
        const d = dist(a.b.x, a.b.y, p.x, p.y);
        if (p.ride) { offFoot(); return; }
        if (st.relay && a.wp >= st.relay.at && p.who === run.starter) { press('swap'); return; }
        inp.sneak = true;
        if (d > 300 && !(a.look > 0 && d < 260)) go(a.b.x, a.b.y, d > 460 ? 1 : 0.9);
        if (d > 460) inp.sneak = false;
        return;
      }
      case 'escort': {
        const lion = run.actors[0]; if (!lion) return;
        const swoop = run.actors.filter(x => x.kind === 'swoop' && x.stun <= 0).sort((a, b) => dist(a.b.x, a.b.y, lion.b.x, lion.b.y) - dist(b.b.x, b.b.y, lion.b.x, lion.b.y))[0];
        if (swoop && dist(swoop.b.x, swoop.b.y, lion.b.x, lion.b.y) < 360) {
          const dx = swoop.b.x - p.x, dy = swoop.b.y - p.y, l = Math.hypot(dx, dy) || 1;
          if (l < 300 && los(w.c, p.x, p.y, swoop.b.x, swoop.b.y)) { inp.mx = dx / l; inp.my = dy / l; } else go(swoop.b.x, swoop.b.y);
          if (l < 80) press('dash');
          if (l < 360 && l > 90) { wantGadget(st.flanks ? ['confetti', 'sling', 'popper', 'paint'] : ['sling', 'paint', 'popper']); shoot(swoop.b.x, swoop.b.y); }
        } else if (dist(lion.b.x, lion.b.y, p.x, p.y) > 120) go(lion.b.x, lion.b.y);
        return;
      }
      case 'race': {
        let mk = run.marks[run.mark]; if (!mk) return;
        if (st.relay !== undefined && run.mark >= st.relay && p.who === run.starter) mk = [w.mate.x, w.mate.y];
        if (st.ride === 'foot' && p.ride) { offFoot(); return; }
        if (st.ride && st.ride !== 'foot' && p.ride?.kind !== st.ride) { getRide(r => r.kind === st.ride); return; }
        if (st.roof && !p.roof) { const l = w.c.ladders.map(l => [l.x * T + 32, l.y * T + 32]).sort((a, b) => dist(...a, p.x, p.y) - dist(...b, p.x, p.y))[0]; if (w.near?.kind === 'ladder-up') press('act'); else go(l[0], l[1]); return; }
        if (p.roof) {
          const dx = mk[0] - p.x, dy = mk[1] - p.y, l = Math.hypot(dx, dy) || 1;
          // axis-first so we cross gaps square on, easing off near the marker like a person lining up a jump
          let ux = 0, uy = 0; if (Math.abs(dx) > 14) ux = Math.sign(dx) * Math.min(1, Math.abs(dx) / 70); else uy = Math.sign(dy) * Math.min(1, Math.abs(dy) / 70);
          inp.mx = ux; inp.my = uy;
          const ax = p.x + Math.sign(ux) * 40, ay = p.y + Math.sign(uy) * 40; const tx = Math.floor(ax / T), ty = Math.floor(ay / T);
          if (!(w.c.flags[ty * W + tx] & F_ROOF)) { press('hop'); inp.mx = Math.sign(ux); inp.my = Math.sign(uy); }
          void l; return;
        }
        go(mk[0], mk[1]);
        if (!p.ride) { const tx = Math.floor((p.x + inp.mx * 50) / T), ty = Math.floor((p.y + inp.my * 50) / T); if (w.c.solid[ty * W + tx] === S.LOW) press('hop'); if (R() < 0.15) press('dash'); }
        return;
      }
      case 'stealth': {
        if (p.ride) { offFoot(); return; }
        const tgt = run.phase === 0 ? run.spot(st.goal) : run.spot(st.exit);
        if (st.shutter && run.phase === 0 && !(w.mate.ai.mode === 'hold')) { if (tagIf('hold')) return; }
        inp.sneak = true;
        if (backOff()) return;
        if (st.shutter && run.phase === 0 && !(w.mate.ai.mode === 'hold' && w.mate.ai.holding)) { inp.mx = 0; inp.my = 0; return; }
        go(tgt[0], tgt[1], 1);
        // wait when the next stretch is in a lookout's beam
        const nx = p.x + inp.mx * 60, ny = p.y + inp.my * 60;
        const danger = run.actors.some(a => { const d = dist(a.b.x, a.b.y, nx, ny); const ang = Math.abs(((Math.atan2(ny - a.b.y, nx - a.b.x) - a.b.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d < 260 && ang < 0.9 && los(w.c, a.b.x, a.b.y, nx, ny); });
        if (danger) { inp.mx = 0; inp.my = 0; }
        // a lookout walking towards us: back away out of its path, as a person would, rather than wait to be found
        const close = run.actors.find(a => { const d = dist(a.b.x, a.b.y, p.x, p.y); const ang = Math.abs(((Math.atan2(p.y - a.b.y, p.x - a.b.x) - a.b.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d < 190 && ang < 0.8; });
        if (close) { const ax = p.x - close.b.x, ay = p.y - close.b.y, l = Math.hypot(ax, ay) || 1; const hx = Math.cos(close.b.h), hy = Math.sin(close.b.h); const side = (ax * -hy + ay * hx) >= 0 ? 1 : -1; inp.mx = (-hy * side * 0.8 + ax / l * 0.6); inp.my = (hx * side * 0.8 + ay / l * 0.6); }
        return;
      }
      case 'collect': {
        const o = run.target(); if (!o) return;
        // a window lookout: paint the glass or send the partner to distract it
        const win = run.actors.find(a => a.kind === 'window');
        if (win && !((win.extra2 ?? 0) > 0) && dist(win.b.x, win.b.y, p.x, p.y) < 560) {
          wantGadget(['paint']);
          if (!shoot(win.b.x, win.b.y, ['paint']) && !((win.stare ?? 0) > 0)) tagIf('distract');
          if ((run.meter2?.v ?? 0) > 0.3 && !((win.stare ?? 0) > 0)) { inp.mx = 0; inp.my = 0; inp.sneak = true; return; }
        }
        go(o[0], o[1], st.high ? 0.75 : 1);
        if (st.high) { if (p.ride && dist(o[0], o[1], p.x, p.y) < 150) tagIf('snatch'); if (dist(o[0], o[1], p.x, p.y) < 380) shoot(o[0], o[1]); }
        return;
      }
      case 'raid': {
        const o = run.target(); if (!o) return;
        go(o[0], o[1]);
        if (!p.ride && dist(o[0], o[1], p.x, p.y) < 90) press('dash');
        return;
      }
      case 'float': {
        if (p.ride) { offFoot(); return; }
        if (st.rope && w.mate.ai.mode !== 'hold' && tagIf('hold')) return;
        if (!p.roof) { const lx = LADDER[0] * T + 32, ly = LADDER[1] * T + 32; if (w.near?.kind === 'ladder-up' && dist(lx, ly, p.x, p.y) < 90) press('act'); else go(lx, ly); return; }
        if (w.near?.kind === 'leap' && inWindow(run) >= 0) { press('act'); return; }
        const o = run.target(); if (!o) return;
        const dx = o[0] - p.x, dy = o[1] - p.y;
        let ux = 0, uy = 0; if (Math.abs(dx) > 12) ux = Math.sign(dx) * Math.min(1, Math.abs(dx) / 70); else if (Math.abs(dy) > 10) uy = Math.sign(dy) * Math.min(1, Math.abs(dy) / 70);
        inp.mx = ux; inp.my = uy;
        const tx = Math.floor((p.x + Math.sign(ux) * 40) / T), ty = Math.floor((p.y + Math.sign(uy) * 40) / T);
        if ((ux || uy) && !(w.c.flags[ty * W + tx] & F_ROOF)) { press('hop'); inp.mx = Math.sign(ux); inp.my = Math.sign(uy); }
        return;
      }
      case 'heat': {
        // head for the nearest safe house and swap jackets
        const ids = SAFE_HOUSES.map(h => h.id).filter(id => w.open.has(w.c.places[id].d) && (id === 'safe-market' || s.best['house:' + id]));
        const pl = ids.map(id => w.c.places[id]).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
        if (!p.ride && w.near?.kind === 'safe') { press('act'); return; }
        if (p.ride && dist(pl.x, pl.y, p.x, p.y) < 160) { offFoot(); return; }
        if (!p.ride && dist(pl.x, pl.y, p.x, p.y) > 900 && !w.run.m.mods?.includes('foot')) { getRide(r => r.kind === 'scooter'); return; }
        go(pl.x, pl.y); return;
      }
      case 'case': case 'heist': case 'defend': case 'blend': case 'detective': case 'trap': case 'swap': return decideJob(st);
      case 'trade': return trade(st);
      case 'fares': {
        const f = run.fare; if (!f) return;
        if (!p.ride || VEHICLES[p.ride.kind].seats < 2) { getRide(r => VEHICLES[r.kind].seats >= 2 && VEHICLES[r.kind].cls !== 'boat'); return; }
        const [x, y] = f.to ?? [f.x, f.y];
        go(x, y);
        if (!f.to && dist(x, y, p.x, p.y) < 90) { inp.mx = 0; inp.my = 0; }
        return;
      }
    }
  }
  // trading: buy the tip's good where it's cheapest tonight, sell it at the tip's market
  let plan = null;
  function trade(st) {
    const p = w.p, tip = m.tip;
    if (!p.ride || p.ride.kind !== 'scooter') { getRide(r => r.kind === 'scooter'); return; }
    const g = tip.good;
    if (!plan) {
      const open = [...w.open];
      const from = open.filter(d => d !== tip.market).sort((a, b) => w.price(a, g).buy - w.price(b, g).buy)[0];
      plan = { from, to: tip.market };
    }
    const have = s.cargo[g];
    const d = have > 0 ? plan.to : plan.from;
    const pl = Object.values(w.c.places).find(q => q.kind === 'market' && q.d === d);
    if (w.near?.kind === 'market' && w.near.id === d) {
      if (have > 0) w.sell(d, g, have); else w.buy(d, g, 99);
      return;
    }
    if (p.ride && dist(pl.x, pl.y, p.x, p.y) < 110) { inp.mx = 0; inp.my = 0; return; }
    go(pl.x, pl.y);
  }
  function playMini() {
    const ui = w.ui;
    if (!mini) { mini = makeMini(ui.mini, { level: ui.level, assist: s.settings.assist, seed: 5 + seed + miniT }); miniT++; }
    const dt = 1 / 30;
    // human timing: aim for the middle, miss by up to `slop` of the window
    const err = (R() - 0.5) * P.slop;
    if (ui.mini === 'lock') {
      const pin = mini.pins[mini.sel];
      if (!mini.holding && !pin.set && pin.h === 0) mini.hold(true);
      else if (mini.holding && pin.h >= (pin.lo + pin.hi) / 2 + err * (pin.hi - pin.lo) * 0.5) mini.hold(false);
    } else if (ui.mini === 'wires') {
      if (!mini.wired) { const l = mini.links.findIndex(x => x === null); mini.pick(l); mini.connect(R() < 0.12 * P.slop ? (mini.right.indexOf(l) + 1) % 4 : mini.right.indexOf(l)); }
      else mini.turnKey();
    } else if (ui.mini === 'kopi') {
      // read the order, a field every half second or so; a slip now and then serves one field wrong
      if (R() < 0.06) {
        const o = mini.order, c = mini.cup; const wrong = ['base', 'milk', 'sugar', 'temp'].filter(k => o[k] !== c[k]);
        if (wrong.length && !(wrong.length === 1 && R() < 0.05 * P.slop)) mini.set(wrong[0], o[wrong[0]]); else mini.serve();
      }
    } else if (ui.mini === 'safe') {
      // turn the right way; near the number, tap (the dial starts slow); set when the lamp glows
      if (mini.i < mini.nums.length) {
        const d = mini.dirs[mini.i], ahead = ((mini.nums[mini.i] - mini.dial) * d % 1 + 1) % 1;
        if (mini.glowing() && R() < 0.75 - 0.2 * P.slop) { mini.hold(0); mini.set(); }
        else if (mini.glowing()) mini.hold(0);
        else if (ahead > 0.1 || mini.last !== d) mini.hold(d);
        else mini.hold(mini.turn ? 0 : d);
      }
    } else if (ui.mini === 'wok') {
      const want = mini.items.filter(i => (mini.need[i.f] ?? 0) > (mini.got[i.f] ?? 0) && i.vy > 0 && i.y < 0.8).sort((a, b) => b.y - a.y)[0];
      if (want) mini.moveTo(want.x + err * 0.06);
      if (mini.burn > 0.55) mini.toss();
    } else {
      const z = mini.phase === 'fill' ? Math.abs(mini.spoon() - 0.5) < mini.zone * (0.5 + Math.abs(err) * 0.7) : (() => { const d = Math.abs(((mini.ring - mini.target) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d < mini.arc * (0.25 + Math.abs(err) * 0.4); })();
      if (z && mini.phase !== 'next') mini.press();
    }
    mini.step(dt);
    if (mini.done || mini.failed) { const ok = mini.done; mini = null; w.miniDone(ok); }
    return dt;
  }

  while (t < maxT) {
    if (w.failed) { fails++; why.push(`${w.run?.i}:${w.failed.reason ?? w.failed}`); w.retry(); if (fails > (o.maxFails ?? 6)) break; continue; }
    // tests: fail on purpose the first time the job reaches step `failAt`, to prove the checkpoint restores
    if (o.failAt !== undefined && !forced && w.run && w.run.i === o.failAt && !w.talk && (!w.ui || w.ui.kind === 'mini') && !w.p.act) { forced = true; if (w.ui) { w.ui = null; mini = null; } w.fail('test: a forced failure'); }
    if (w.talk) { w.advanceTalk(); t += 0.25; continue; }
    if (w.ui) {
      if (w.ui.kind === 'mini') { t += playMini(); continue; }
      if (w.ui.kind === 'safe') { w.swapJacket(); w.ui = null; continue; }
      // the heist: the bots take turns, quiet on even seeds, loud on odd ones (o.heist forces one)
      if (w.ui.kind === 'heist') { t += 0.6; w.run.heistPick(o.heist ?? (seed % 2 ? 'loud' : 'quiet')); continue; }
      // the branch cards (blend, trap, detective): the same, the first way on even seeds and the second on odd ones
      if (w.ui.kind === 'branch') { t += 0.6; const two = BRANCHES[w.run.cur.t]; w.run.branchPick(o.branch && two.includes(o.branch) ? o.branch : two[seed % 2]); continue; }
      // a witness: the right question most of the time (a person reads them), another one now and then
      if (w.ui.kind === 'ask') {
        const ui = w.ui, wi = w.run.cur.witnesses[ui.i]; t += 0.8;
        if (ui.said) { w.run.askClose(); continue; }
        const tried = job.asked[ui.i] ?? (job.asked[ui.i] = []);
        const wrong = [0, 1, 2].filter(q => q !== wi.right && !tried.includes(q));
        const q = !tried.length && wrong.length && R() < 0.25 * P.slop ? wrong[0] : wi.right;
        tried.push(q); w.run.askPick(q); continue;
      }
      w.ui = null; continue;
    }
    think -= DT;
    if (think <= 0) {
      think = P.lo + R() * (P.hi - P.lo);
      if (lapse > 0) lapse -= think;
      else if (P.lapse && w.run && R() < P.lapse) { lapse = 0.5 + R() * 0.6; const a = Math.atan2(inp.my, inp.mx) + (R() - 0.5) * 1.6; inp.mx = Math.cos(a); inp.my = Math.sin(a); }
      else decide();
      // never stuck: if we haven't moved for a while, wiggle sideways for a moment like a person would
      const p = w.p;
      if (dist(p.x, p.y, lastPos[0], lastPos[1]) < 6 && (Math.abs(inp.mx) + Math.abs(inp.my)) > 0.3) { stuck += think; } else stuck = 0;
      lastPos = [p.x, p.y];
      if (stuck > 1.2) { unstick = 0.6; const a = R() * Math.PI * 2; uDir = [Math.cos(a), Math.sin(a)]; stuck = 0; }
    }
    if (unstick > 0) { unstick -= DT; inp.mx = uDir[0]; inp.my = uDir[1]; }
    // a ticket from a warden: pay it at once (a person reads the popup within a moment or so)
    if (w.ticket && w.ticket.t > 0.6 && !w.p.act) inp.act = true;
    w.step(inp, DT); t += DT; o.each?.(w);
    if (o.trace && Math.floor(t / o.trace) !== Math.floor((t - DT) / o.trace)) { const r = w.run; const a = r?.actors[0]; console.log(`t${Math.round(t)} p(${Math.round(w.p.x / T)},${Math.round(w.p.y / T)}) ride=${w.p.ride?.kind ?? '-'} roof=${w.p.roof} step=${r?.i}:${r?.cur?.t} near=${w.near?.kind ?? '-'} inp=${inp.mx.toFixed(1)},${inp.my.toFixed(1)}${a ? ` a(${Math.round(a.b.x / T)},${Math.round(a.b.y / T)}) wp${a.wp}/${a.route.length} look${a.look.toFixed(1)}` : ''} meter=${r?.meter ? r.meter.name + ':' + r.meter.v.toFixed(2) : '-'} heat=${w.heat.toFixed(1)} ui=${w.ui?.kind ?? "-"} wd=${w.wardens.map(x => Math.round(Math.hypot(x.b.x - w.p.x, x.b.y - w.p.y)) + "@" + Math.round(x.b.x) + "," + Math.round(x.b.y) + (x.leave ? "L" : "")).join("|")} pp=${Math.round(w.p.x)},${Math.round(w.p.y)} fail=${w.failed ?? ""}${o.traceRide && r?.ride ? ` rr(${(r.ride.b.x / T).toFixed(1)},${(r.ride.b.y / T).toFixed(1)} ${r.ride.parked} ${r.ride.locked}) nr(${w.near?.ride ? (w.near.ride.b.x / T).toFixed(1) + ',' + (w.near.ride.b.y / T).toFixed(1) + ' ' + w.near.ride.kind + ' ' + w.near.ride.locked : '-'}) act=${w.p.act?.n ?? '-'}` : ''}`); }
    w.drain();
    inp.act = false; inp.dash = false; inp.hop = false; inp.tag = false; inp.swap = false; inp.fire = false; inp.slot = undefined; inp.reload = false;
    if (o.done ? o.done(w) : s.done.includes(id)) return { won: true, time: Math.round(t), fails, why };
    if (o.lost?.(w)) break;
  }
  return { won: false, time: Math.round(t), fails, why, at: w.run ? `${w.run.i}:${w.run.cur?.t}:${w.run.label}` : (w.failed?.reason ?? 'no run') };
}

if (MAIN) {
  const only = process.argv.find(a => /^[mk]\d+$/.test(a));
  const ids = only ? [only] : [...MISSIONS, ...SIDE].map(m => m.id);
  // the casual bot plays the same 10 seeds in --quick (npm test) as in the full run: with fewer, one unlucky run could
  // sink a job below 90% by itself; --quick only trims the Normal and Hard runs and the perfect bot
  const seeds = 10;
  const rows = [];
  let worst = 1, maxTries = 0; const tot = { nw: 0, nf: 0, hw: 0, hf: 0, n: 0 };
  for (const id of ids) {
    let cw = 0, nw = 0, ct = 0, first = 0, nFirst = 0, hw = 0, hFirst = 0;
    const DIFF_ONLY = process.argv.includes('--diff');
    for (let k = 0; k < (DIFF_ONLY ? 0 : seeds); k++) { const r = playMission(id, 'casual', k); if (r.won) { cw++; ct += r.time; if (!r.fails) first++; } else if (process.argv.includes('-v')) console.log('  casual lost', id, k, r); }
    const ns = QUICK ? 1 : 8; let nTries = 0, hTries = 0;
    for (let k = 0; k < ns; k++) { const r = playMission(id, 'normal', 50 + k, { assist: false, diff: 'normal' }); nTries += r.fails + 1; if (r.won) { nw++; if (!r.fails) nFirst++; } else if (process.argv.includes('-v')) console.log('  normal lost', id, k, r); }
    for (let k = 0; k < ns; k++) { const r = playMission(id, 'normal', 80 + k, { assist: false, diff: 'hard' }); hTries += r.fails + 1; if (r.won) { hw++; if (!r.fails) hFirst++; } else if (process.argv.includes('-v')) console.log('  hard lost', id, k, r); }
    const pr = DIFF_ONLY ? { won: false, time: 0 } : playMission(id, 'perfect', 1);
    maxTries = Math.max(maxTries, nTries / ns, hTries / ns);
    tot.nw += nw; tot.nf += nFirst; tot.hw += hw; tot.hf += hFirst; tot.n += ns;
    const rate = DIFF_ONLY ? 1 : cw / seeds; worst = Math.min(worst, rate);
    rows.push(`${id.padEnd(4)} ${MISSION[id].title.padEnd(26)} casual ${String(Math.round(rate * 100)).padStart(3)}%  avg ${cw ? Math.round(ct / cw) : '-'}s  first try ${first}/${seeds}   Normal ${nw}/${ns} (first ${nFirst}, tries ${(nTries / ns).toFixed(1)})   Hard ${hw}/${ns} (first ${hFirst}, tries ${(hTries / ns).toFixed(1)})   perfect ${pr.won ? Math.round(pr.time) + 's' : 'LOST'}`);
    console.log(rows[rows.length - 1]);
  }
  // the empire: each empire job and raid kind, casual on every seed, Normal and Hard reported
  if (!only) for (const [label, id, opts] of empireCases()) {
    let cw = 0, ct = 0, first = 0, nw = 0, hw = 0; const cs = QUICK ? 3 : seeds, ns = QUICK ? 1 : 4;
    for (let k = 0; k < cs; k++) { const s = empireSave(id, k); const r = playMission(label, 'casual', k, opts(s)); if (r.won) { cw++; ct += r.time; if (!r.fails) first++; } else if (process.argv.includes('-v')) console.log('  casual lost', label, k, r); }
    for (let k = 0; k < ns; k++) { const s = empireSave(id, 50 + k); if (playMission(label, 'normal', 50 + k, { ...opts(s), assist: false, diff: 'normal' }).won) nw++; }
    for (let k = 0; k < ns; k++) { const s = empireSave(id, 80 + k); if (playMission(label, 'normal', 80 + k, { ...opts(s), assist: false, diff: 'hard' }).won) hw++; }
    const rate = cw / cs; worst = Math.min(worst, rate);
    rows.push(`${label.padEnd(31)} casual ${String(Math.round(rate * 100)).padStart(3)}%  avg ${cw ? Math.round(ct / cw) : '-'}s  first try ${first}/${cs}   Normal ${nw}/${ns}   Hard ${hw}/${ns}`);
    console.log(rows[rows.length - 1]);
  }
  // the eleventh pass: generated contracts, each a new seed (a different job every time), across the three saves
  // (just past chapter six, the whole story, a small empire at a higher tier): casual must finish at least 90%, Normal
  // fails a fair share of first tries without walling anyone, Hard finishes at least 80%
  if (!only) {
    const cn = QUICK ? 24 : 300, nn = QUICK ? 8 : 150; const kinds = {};
    let cw = 0, cf = 0, nw = 0, nf = 0, hw = 0, hf = 0;
    for (let k = 0; k < cn; k++) { const { c, opts } = contractCase(k); const r = playMission('con' + k, 'casual', k, opts); const kd = kinds[c.kind] ??= { n: 0, w: 0 }; kd.n++; if (r.won) { cw++; kd.w++; if (!r.fails) cf++; } else if (process.argv.includes('-v')) console.log('  casual lost contract', k, c.kind, c.mods.join(), r.at); }
    for (let k = 0; k < nn; k++) { const { opts } = contractCase(1000 + k); const r = playMission('con' + k, 'normal', k, { ...opts, assist: false, diff: 'normal' }); if (r.won) { nw++; if (!r.fails) nf++; } }
    for (let k = 0; k < nn; k++) { const { opts } = contractCase(2000 + k); const r = playMission('con' + k, 'normal', k, { ...opts, assist: false, diff: 'hard' }); if (r.won) { hw++; if (!r.fails) hf++; } }
    console.log(`contracts: casual ${cw}/${cn} (first ${cf})   Normal ${nw}/${nn} (first ${nf})   Hard ${hw}/${nn} (first ${hf})   by kind ${Object.entries(kinds).map(([k, v]) => `${k} ${v.w}/${v.n}`).join(', ')}`);
    assert.ok(cw / cn >= 0.9, `the casual bot finishes at least 90% of generated contracts (${cw}/${cn})`);
    assert.ok(hw / nn >= 0.8, `the Hard bot finishes at least 80% of generated contracts (${hw}/${nn})`);
    if (!QUICK) { assert.ok(nw / nn >= 0.95, 'the Normal bot finishes (almost) every contract'); assert.ok(nf / nn <= 0.96 && nf / nn >= 0.85, `Normal first tries land near 88 to 95% (${nf}/${nn})`); }
  }
  const pc = (a, b) => `${Math.round(100 * a / Math.max(1, b))}%`;
  console.log(`Normal: finished ${pc(tot.nw, tot.n)}, first try ${pc(tot.nf, tot.n)}   Hard: finished ${pc(tot.hw, tot.n)}, first try ${pc(tot.hf, tot.n)}`);
  assert.ok(worst >= 1, `the casual bot finishes every job every time on Assist (worst ${Math.round(worst * 100)}%)`);
  if (!QUICK && !only) {
    // the full run also holds Normal and Hard to their targets: every job finishable, Normal failing a fair share of
    // first tries without walling anyone, Hard clearly harder
    assert.ok(tot.hw / tot.n >= 0.97 && tot.nw / tot.n >= 0.97, 'Normal and Hard bots finish (almost) every job');
    assert.ok(tot.nf / tot.n <= 0.95, 'Normal fails some first tries');
    assert.ok(tot.hf < tot.nf, 'Hard fails more first tries than Normal');
    assert.ok(maxTries <= 4, `no job takes more than about three tries on average (worst ${maxTries.toFixed(1)})`);
  }
  console.log('jade bots ok');
}
