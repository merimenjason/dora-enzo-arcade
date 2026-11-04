// Cloudberry Balloon bots. A pilot flies every hop the way a player would: it cruises at the lowest height whose wind
// blows towards what it wants next and clears the ground ahead, holding it with short bursts of the burner and the
// vent; it starts down once a dive would come down near the target, steering the dive with the pedals; it skims each
// cloudberry bush, lets each parcel go when its parachute would land on the garden, fills up in a village when it's
// low, and creeps onto the meadow in the calm near the ground. The "hurried" pilot skips the berries and parcels.
// Both must land every hop, the hurried one with a quarter of the fuel to spare; the careful one must earn two stars
// on at least half the hops and pick and deliver about half of everything (a player does better: the bot gives up on
// anything that takes it more than 75 s). A pilot who never touches the burner must not get anywhere.
import assert from 'node:assert/strict';
import { Flight, LEVELS, DT, groundAt, surfaceAt, idleInput } from '../.checks/balloon-game.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** the highest ground (or treetop) over the next stretch in a direction */
const ahead = (f, dir, span) => { let m = -999; for (let d = 0; d <= span; d += 4) m = Math.max(m, surfaceAt(f.ter, f.x + dir * d)); return m; };

/** a controller that holds a height (or sinks gently onto the ground below it), as a player does with short bursts */
function hold(f, ty, lastSand) {
  const ag = f.y - surfaceAt(f.ter, f.x);
  let vyd = clamp((ty - f.y) * 0.15, -2.4, 3);
  if (ag < 14 && vyd < -1) vyd = -1;
  const hT = f.neutral() + (0.5 * vyd) / 6 + 0.25 * (vyd - f.vy) / 6 - f.lift(f.x, f.y) / 6;
  const inp = { ...idleInput(), burn: f.heat < hT, vent: f.heat > hT + 0.04 };
  if (f.fuel < 2 && f.sandbags > 0 && vyd > 0 && f.vy < -0.5) inp.sand = !lastSand;
  return inp;
}
/** the cruising height towards x `tx`: the lowest band that clears the ground ahead and blows that way, well inside it */
function cruise(f, tx, close = false) {
  const dir = Math.sign(tx - f.x) || 1, floor = ahead(f, dir, 140) + (close ? 18 : 30), cands = [];
  for (let y = floor; y < 800; y += 10) cands.push(y);
  const best = Math.max(0, ...cands.map((y) => f.wind(f.x, y, 0) * dir));
  // (closing in, any wind that way will do: the lower, the less to come down through)
  for (const y of cands) if (f.wind(f.x, y, 0) * dir > (close ? 1.5 : Math.max(1.5, best * 0.75))) return y + 8;
  return null;
}
/** where a dive started now would reach height `h` (or the ground): sinking at 2.2 m/s, 1 m/s for the last 14 m above
 * the ground, pedalling `ped`. Coarse steps: it only has to be about right. */
function predictAt(f, h, ped = 0) {
  const S = 0.25, k = 1 - Math.exp(-S / 2.2); let x = f.x, y = f.y, vx = f.vx;
  for (let i = 0; i < 1200; i++) {
    const ag = y - surfaceAt(f.ter, x); if (ag <= 0 || y <= h) return x;
    vx += (f.wind(x, y, f.t + i * S) + ped * 2.2 - vx) * k; x = clamp(x + vx * S, 8, f.lv.w - 8); y -= (ag < 14 ? 1 : 2.2) * S;
  }
  return x;
}
export function pilot(lv, careful) {
  const f = new Flight(lv);
  const todo = careful ? [...lv.bushes.map((x, i) => ({ k: 'bush', x, i })), ...lv.drops.map((d, i) => ({ k: 'drop', x: d.x, i }))] : [];
  const fin = lv.pads.find((p) => p.kind === 'finish');
  let skip = new Set(), focusT = 0, focus = null, lastSand = false, dive = false;
  const refuelled = new Set(), vilT = new Map();
  while (!f.over && f.t < 1500) {
    // what next: the nearest target still to do (giving up on one after 75 s, or on all of them with under 45% of the fuel
    // left), else the meadow
    const left = f.fuel < lv.fuel * 0.45 ? [] : todo.filter((t) => !skip.has(t) && !(t.k === 'bush' ? f.picked[t.i] : f.delivered[t.i]) && !(t.k === 'drop' && f.parcels === 0));
    let tgt = left.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0] ?? null;
    // low on fuel with a village still ahead: land there to fill up first
    const vil = lv.pads.find((p) => p.kind === 'village' && p.x > f.x - 100 && !refuelled.has(p));
    if (careful && vil && f.fuel < lv.fuel * 0.7 && Math.abs(vil.x - f.x) < 400) {
      const v = vilT.get(vil) ?? vilT.set(vil, { k: 'village', x: vil.x, pad: vil }).get(vil);
      if (!skip.has(v)) tgt = v;
    }
    if (tgt !== focus) { focus = tgt; focusT = 0; dive = false; } else if ((focusT += DT) > 75 && tgt) { skip.add(tgt); continue; }
    const tx = tgt ? tgt.x : fin.x, gy = groundAt(f.ter, tx);
    // everything is reached by diving: start down once a dive (pedalling towards it) would come down within reach of the
    // pedals; for a parcel, down to 8 m over the garden, letting go when the parachute would land on it
    const goal = !tgt || tgt.k === 'village' ? gy : tgt.k === 'bush' ? gy + 2 : gy + 8;
    const pad = !tgt ? fin : tgt.pad;
    let ped = 0, ty, p0 = f.x;
    if (goal !== null && Math.abs(tx - f.x) < 500) {
      p0 = predictAt(f, goal);
      if (!dive && Math.abs(p0 - tx) < 20) dive = true;
    }
    if (dive) {
      // in the dive, sink at 2.2 m/s (1 near the ground) onto it
      // (pedalling so the predicted touchdown moves onto it; right over it, straight at it)
      const dx = tx - f.x, miss = tx - p0; ped = f.y - goal < 8 ? (Math.abs(dx) > 1 ? Math.sign(dx) : 0) : Math.abs(miss) > 2 ? Math.sign(miss) : 0;
      // (a bush: skim at its height; a meadow: down to 6 m up, creep along until over it, then down)
      ty = !pad ? goal : Math.abs(dx) < pad.w * 0.35 ? goal - 8 : goal + 6;
      // carried past and no way back at this height: climb out and come round again
      if (Math.abs(dx) > 60 && Math.sign(f.vx) !== Math.sign(dx)) dive = false;
    } else {
      ty = cruise(f, tx, Math.abs(tx - f.x) < 500);
      if (ty === null && tgt) { skip.add(tgt); continue; }
      if (ty === null) ty = f.y + 20;
      // right over it but too high to dive at it: come down to just above it and pedal in
      if (Math.abs(tx - f.x) < 60 && f.y - goal < 80 && Math.abs(f.wind(f.x, goal + 6)) < 2) ty = goal + 6;
      ped = Math.sign(tx - f.x);
    }
    // filled up in the village: off again
    if (tgt?.k === 'village' && f.grounded && f.pad === tgt.pad) { refuelled.add(tgt.pad); focus = null; ty = f.y + 40; dive = false; }
    // landed short of it (on a hilltop, say): off again
    if (f.grounded && f.pad !== fin && !(tgt?.k === 'village' && f.pad === tgt.pad)) ty = f.y + 30;
    let inp = { ...hold(f, ty, lastSand), pedal: ped };
    // (one parcel at a time: it waits to see where the last one came down)
    if (tgt?.k === 'drop' && f.parcels > 0 && !f.grounded && Math.abs(tx - f.x) < 200 && f.drops.every((p) => p.done)) {
      const px = f.predictDrop(); if (Math.abs(px - tx) < 2) inp.drop = true;
      else if (Math.abs(px - tx) < 25) inp.pedal = Math.sign(tx - px);
    }
    lastSand = inp.sand;
    if (process.env.DBG === lv.id + (careful ? 'C' : 'H') && Math.round(f.t * 60) % 180 === 0) console.log(f.t.toFixed(0), 'x', f.x.toFixed(0), 'y', f.y.toFixed(0), 'ag', f.altitude.toFixed(0), 'ty', ty.toFixed(0), dive ? 'DIVE' : '', 'vy', f.vy.toFixed(2), 'wind', f.wind(f.x, f.y).toFixed(1), 'tgt', tgt ? tgt.k + tgt.x : 'fin', 'fuel', f.fuel.toFixed(0));
    f.tick(inp); if (process.env.DBG) for (const e of f.events) if (e.k === "parcel" || e.k === "drop") console.log("EV", f.t.toFixed(1), JSON.stringify(e), f.x.toFixed(0), tgt?.x);
  }
  return f;
}

if (process.argv[1].endsWith('balloon-bot.mjs')) {
  let twoStar = 0, berries = 0, parcels = 0, bushes = 0, gardens = 0;
  for (const lv of LEVELS) {
    const c = pilot(lv, true), h = pilot(lv, false), r = c.result(), hr = h.result();
    // a pilot who never burns
    const lazy = new Flight(lv); while (!lazy.over && lazy.t < 300) lazy.tick(idleInput());
    console.log(`${lv.n} ${lv.name.padEnd(24)} careful ${c.why ?? 'flying'} ${c.t.toFixed(0)}s ★${r.stars} berries ${r.berries}/${lv.berryGoal} parcels ${r.hits}/${lv.drops.length} fuel ${r.fuel}/${lv.fuel} bumps ${c.bumps} | hurried ${h.why ?? 'flying'} ${h.t.toFixed(0)}s fuel ${hr.fuel}`);
    assert.equal(h.why, 'landed', `${lv.name}: the hurried pilot lands`);
    assert.ok(hr.fuel > lv.fuel * 0.25, `${lv.name}: flying straight there leaves a quarter of the fuel`);
    assert.equal(c.why, 'landed', `${lv.name}: the careful pilot lands`);
    assert.ok(Math.abs(lazy.x - lv.pads[0].x) < 1, `${lv.name}: nobody gets anywhere without the burner`);
    if (r.stars >= 2) twoStar++;
    berries += r.berries; parcels += r.hits; bushes += lv.bushes.length * 3; gardens += lv.drops.length;
  }
  console.log(`careful: two stars or more on ${twoStar} hops, ${berries}/${bushes} berries, ${parcels}/${gardens} parcels`);
  assert.ok(twoStar >= 4, 'the careful pilot gets two stars on at least half the hops');
  assert.ok(berries >= bushes * 0.45 && parcels >= gardens * 0.45, 'the careful pilot picks and delivers about half of everything');
  console.log('balloon-bot: all good');
}
