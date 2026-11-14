// Jade Street bots: every story mission played through the engine by players who think at human speed. A bot looks at
// the city only every 200-300 ms of game time (never faster than a person), steers a little off its line, sometimes
// overshoots a turn, and plays the mini-games with a human's timing slop. It walks to the contact from the safe house,
// talks, takes the rides the job needs, and on a failure presses Retry (from the checkpoint), as a player would.
//   perfect - reaction 200 ms, no noise: the scripted solver that tests/jade.mjs uses to prove every job completable
//   casual  - 200-300 ms, wobbly steering, sloppy timing, Assist on (Easy): must finish every job within its retries, on every
//             seed; it uses the partner (tag-team key) and the gadgets where a person would
//   normal  - a steadier player on Normal with Assist off, and the same player on Hard: first-try and finish rates
//             are reported (Normal should fail a fair share of first tries but still finish)
// `--quick` (npm test) runs fewer seeds; `--diff` runs only the Normal and Hard players. Exports `playMission` and `missionSave` for tests/jade.mjs.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION } from '../.checks/jade-story.js';
import { newSave, available } from '../.checks/jade-save.js';
import { VEHICLES } from '../.checks/jade-move.js';
import { T, W, S, F_ROOF } from '../.checks/jade-city.js';
import { downhill, los } from '../.checks/jade-nav.js';
import { rng } from '../.checks/jade-rng.js';
import { makeMini } from '../.checks/jade-mini.js';
import { GOODS, midPrice, prices } from '../.checks/jade-trade.js';
import { LIGHTS, lightOf } from '../.checks/jade-traffic.js';
import { ROADS } from '../.checks/jade-city.js';
import { inWindow, LADDER } from '../.checks/jade-boss.js';
import { tagOption, boostXY } from '../.checks/jade-tag.js';
import { carried, giveGadget, GEAR_GIFT } from '../.checks/jade-gear.js';

const QUICK = process.argv.includes('--quick');
const MAIN = import.meta.url === `file://${process.argv[1]}`;

/** a save that has finished every job before `id` */
export function missionSave(id, o = {}) {
  const s = newSave(o.seed ?? 7);
  const i = MISSIONS.findIndex(m => m.id === id);
  s.done = MISSIONS.slice(0, i).map(m => m.id);
  // the gadgets the story handed over by then (each job that gives one)
  if (o.gear !== false) for (const d of s.done) for (const g of GEAR_GIFT[d] ?? []) giveGadget(s, g);
  s.started = true; s.cash = o.cash ?? 400;
  s.settings.assist = o.assist ?? true; s.settings.diff = o.diff ?? 'easy';
  // start at the safe house nearest the job's contact
  const m = MISSIONS[i];
  s.safe = { 1: 'safe-market', 2: 'safe-market', 3: 'safe-market', 4: 'safe-market', 5: 'safe-market' }[m.ch];
  return s;
}

const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

/** play one mission start to finish; returns { won, time, fails } */
export function playMission(id, profile = 'perfect', seed = 1, o = {}) {
  // lapse: the chance per decision of a human slip (a glance at the map, a fumbled turn) lasting 0.5-1.1 s;
  // notice: the chance of reading a telegraphed hazard in time to steer round it
  const P = { perfect: { lo: 0.2, hi: 0.2, wob: 0, slop: 0, lapse: 0, notice: 1 }, casual: { lo: 0.2, hi: 0.3, wob: 0.28, slop: 1, lapse: 0, notice: 0.85 }, normal: { lo: 0.22, hi: 0.34, wob: 0.24, slop: 0.8, lapse: o.lapse ?? 0.05, notice: 0.7 } }[profile];
  const assist = o.assist ?? profile !== 'normal';
  const s = missionSave(id, { seed: 3 + seed, assist, diff: o.diff ?? (assist ? 'easy' : 'normal') });
  const w = new World(s, 100 + seed);
  w.quiet = true;
  const R = rng(seed * 991 + id.length * 31 + id.charCodeAt(1) * 7);
  const m = MISSION[id];
  const why = []; let lapse = 0, inp = { ...NO_INPUT }, think = 0, fails = 0, t = 0, mini = null, miniT = 0, stuck = 0, lastPos = [0, 0], unstick = 0, uDir = [0, 0];
  const maxT = o.maxT ?? 900;
  let started = false, forced = false;
  const wantMission = () => { const a = available(s); return a.some(x => x.id === id); };
  assert.ok(wantMission(), `${id} is offered at the start`);

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
  const districtOf = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx < 46 ? (ty < 30 ? 'temple' : 'market') : ty >= 62 ? 'docks' : tx < 75 ? 'canal' : 'arcade'; };
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
  function decide() {
    decide0(); dodge(); redStop();
  }
  function decide0() {
    inp = { ...NO_INPUT };
    const p = w.p;
    if (!w.run) {
      if (started) return;
      // walk to the contact and press the action button
      const pl = w.c.places[m.at];
      if (w.near?.kind === 'mission' && w.near.id === id) { press('act'); return; }
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
        if (st.ride === 'foot' && p.ride) { if (dist(p.x, p.y, x, y) < 400 || w.near?.kind === 'exit') offFoot(); else go(x, y); return; }
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
        if (st.shutter && run.phase === 0 && !(w.mate.ai.mode === 'hold' && w.mate.ai.holding) && dist(tgt[0], tgt[1], p.x, p.y) < 200) { inp.mx = 0; inp.my = 0; return; }
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
        const ids = ['safe-market', 'safe-temple', 'safe-canal', 'safe-docks', 'safe-arcade'].filter(id => w.open.has(w.c.places[id].d) && (id === 'safe-market' || s.best['house:' + id]));
        const pl = ids.map(id => w.c.places[id]).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
        if (!p.ride && w.near?.kind === 'safe') { press('act'); return; }
        if (p.ride && dist(pl.x, pl.y, p.x, p.y) < 160) { offFoot(); return; }
        if (!p.ride && dist(pl.x, pl.y, p.x, p.y) > 900) { getRide(r => r.kind === 'scooter'); return; }
        go(pl.x, pl.y); return;
      }
      case 'trade': return trade(st);
      case 'fares': {
        const f = run.fare; if (!f) return;
        if (!p.ride || VEHICLES[p.ride.kind].seats < 2) { getRide(r => VEHICLES[r.kind].seats >= 2 && r.kind !== 'boat'); return; }
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
    w.step(inp, DT); t += DT;
    if (o.trace && Math.floor(t / o.trace) !== Math.floor((t - DT) / o.trace)) { const r = w.run; const a = r?.actors[0]; console.log(`t${Math.round(t)} p(${Math.round(w.p.x / T)},${Math.round(w.p.y / T)}) ride=${w.p.ride?.kind ?? '-'} roof=${w.p.roof} step=${r?.i}:${r?.cur?.t} near=${w.near?.kind ?? '-'} inp=${inp.mx.toFixed(1)},${inp.my.toFixed(1)}${a ? ` a(${Math.round(a.b.x / T)},${Math.round(a.b.y / T)}) wp${a.wp}/${a.route.length} look${a.look.toFixed(1)}` : ''} meter=${r?.meter ? r.meter.name + ':' + r.meter.v.toFixed(2) : '-'} heat=${w.heat.toFixed(1)} ui=${w.ui?.kind ?? "-"} wd=${w.wardens.map(x => Math.round(Math.hypot(x.b.x - w.p.x, x.b.y - w.p.y)) + "@" + Math.round(x.b.x) + "," + Math.round(x.b.y) + (x.leave ? "L" : "")).join("|")} pp=${Math.round(w.p.x)},${Math.round(w.p.y)} fail=${w.failed ?? ""}${o.traceRide && r?.ride ? ` rr(${(r.ride.b.x / T).toFixed(1)},${(r.ride.b.y / T).toFixed(1)} ${r.ride.parked} ${r.ride.locked}) nr(${w.near?.ride ? (w.near.ride.b.x / T).toFixed(1) + ',' + (w.near.ride.b.y / T).toFixed(1) + ' ' + w.near.ride.kind + ' ' + w.near.ride.locked : '-'}) act=${w.p.act?.n ?? '-'}` : ''}`); }
    w.drain();
    inp.act = false; inp.dash = false; inp.hop = false; inp.tag = false; inp.swap = false; inp.fire = false; inp.slot = undefined; inp.reload = false;
    if (s.done.includes(id)) return { won: true, time: Math.round(t), fails, why };
  }
  return { won: false, time: Math.round(t), fails, why, at: w.run ? `${w.run.i}:${w.run.cur?.t}:${w.run.label}` : (w.failed?.reason ?? 'no run') };
}

if (MAIN) {
  const only = process.argv.find(a => /^m\d+$/.test(a));
  const ids = only ? [only] : MISSIONS.map(m => m.id);
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
