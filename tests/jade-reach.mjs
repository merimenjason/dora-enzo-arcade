// Jade Street: can a player get there? With the districts laid out where they are in Singapore (lib/jade-layout.ts)
// and joined by the seams' roads, this walks the nav graph (lib/jade-nav.ts, the one the route arrow and the bots use)
// with the districts each chapter has opened:
// - every story job and Hawker Tales side job, from its giver through each of its targets in order, the way the step
//   is played (on foot, on the ride kind the job hands you, by boat; the MRT, the cable car and the ferry carry you);
// - every district from Chinatown's market, on foot, at every chapter, over the districts open by then;
// - every place, parked ride, ride and cast member stands on ground its class can stand on (or right beside it).
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { city, T, W, H, DISTRICTS, districtAt, passable } from '../.checks/jade-city.js';
import { field, nearestFree } from '../.checks/jade-nav.js';
import { MISSIONS, SIDE, FINALE } from '../.checks/jade-story.js';
import { newSave, openDistricts } from '../.checks/jade-save.js';
import { VEHICLES } from '../.checks/jade-move.js';
import { castOf } from '../.checks/jade-cast.js';
import { missionSave } from './jade-bot.mjs';

const c = city();
const tile = (v) => Math.floor(v / T);
/** a spot (place name or tile) as a world point */
const spot = (s) => typeof s === 'string' ? (c.places[s] ? [c.places[s].x, c.places[s].y] : null) : [s[0] * T + T / 2, s[1] * T + T / 2];
const FIELDS = new Map();
/** can a mover of class `cls` get from world point a to world point b over the open districts (each end snapped to the
 * nearest tile it can stand on, as the game does for a spot inside a stall or a boat beside a jetty) */
function reach(cls, a, b, open, okey) {
  const [bx, by] = nearestFree(c, cls, b[0], b[1], open, 4), [ax, ay] = nearestFree(c, cls, a[0], a[1], open, 4);
  const k = `${cls}:${tile(bx)},${tile(by)}:${okey}`;
  let f = FIELDS.get(k); if (!f) { f = field(c, cls, tile(bx), tile(by), open); FIELDS.set(k, f); if (FIELDS.size > 60) FIELDS.delete(FIELDS.keys().next().value); }
  return f.dist[tile(ay) * W + tile(ax)] >= 0;
}
const clsOf = (ride) => !ride || ride === 'foot' ? 'foot' : VEHICLES[ride].cls;

// ── every job, giver to last target
let legs = 0;
for (const m of [...MISSIONS, ...SIDE]) {
  const s = missionSave(m.id), open = new Set(openDistricts(s)), okey = [...open].sort().join(',');
  let at = spot(m.at), cls = 'foot';
  assert.ok(at, `${m.id}: its giver ${m.at} is a place`);
  const go = (to, how, what) => {
    const p = spot(to); if (!p) return; // 'here', 'loot' and the like: where you already are
    assert.ok(open.has(districtAt(tile(p[0]), tile(p[1]))), `${m.id} ${what}: in an open district`);
    assert.ok(reach(how, at, p, open, okey), `${m.id} ${what}: reachable ${how === 'foot' ? 'on foot' : `by ${how}`} from ${tile(at[0])},${tile(at[1])} to ${tile(p[0])},${tile(p[1])}`);
    at = p; legs++;
  };
  m.steps.forEach((st, i) => {
    const what = `step ${i} (${st.t})`;
    switch (st.t) {
      case 'ride': if (st.near !== undefined) go(st.near, 'foot', what); cls = clsOf(st.kind); break;
      case 'goto': { const how = st.ride ? clsOf(st.ride) : cls; go(st.at, how, what); if (st.ride === 'foot') cls = 'foot'; break; }
      case 'pickup': case 'raid': case 'post': case 'defend': case 'bag': go(st.at, cls, what); break;
      case 'deliver': go(st.to, cls, what); break;
      case 'chase': case 'tail': case 'escort': go(st.from, cls, what); st.route.forEach((r, k) => go(r, cls, `${what} route ${k}`)); break;
      case 'race': if (!st.roof) { const how = st.ride ? clsOf(st.ride) : st.rival === 'boat' ? 'boat' : cls; st.marks.forEach((r, k) => go(r, how, `${what} mark ${k}`)); } break;
      case 'stealth': go(st.goal, cls, `${what} goal`); go(st.exit, cls, `${what} exit`); break;
      case 'collect': { const from = at; for (const [k, it] of st.items.entries()) { at = from; go(it, cls, `${what} item ${k}`); } break; }
      // a boar trail: walk print to print (the old prints of a false branch too)
      case 'track': st.route.forEach((r, k) => go(r, cls, `${what} print ${k}`)); for (const [k, r] of (st.old ?? []).entries()) go(r, cls, `${what} old ${k}`); break;
      case 'hold': go(st.lever, cls, `${what} lever`); go(st.through, cls, `${what} through`); break;
      // the MRT, the cable car, the ferry and the Ubin bumboat: walk to the gates, ride, step out at the other end
      case 'train': { const t = c.isle.stations.find(x => x.id === st.to); assert.ok(t, `${m.id} ${what}: station ${st.to}`); at = [t.x, t.y]; cls = 'foot'; break; }
      case 'cable': { const t = [c.east.cable, c.east.ferry, c.ubin.boat].flatMap(l => l.stops).find(x => x.id === st.to); assert.ok(t, `${m.id} ${what}: stop ${st.to}`); at = [t.x, t.y]; cls = 'foot'; break; }
    }
  });
}

// ── every district from the market on foot, at each chapter, over what is open by then
const s = newSave(3); const start = [c.places['safe-market'].x, c.places['safe-market'].y];
const stages = [[], ...FINALE.map((_, k) => MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === FINALE[k]) + 1).map(m => m.id)), MISSIONS.map(m => m.id)];
let pairs = 0;
for (const done of stages) {
  s.done = done; const open = new Set(openDistricts(s)), okey = [...open].sort().join(',');
  for (const d of open) {
    // the district's places, or (one with none) any tile of it a walker can stand on
    const ps = Object.values(c.places).filter(p => p.d === d).map(p => [p.x, p.y]);
    if (!ps.length) { for (let y = 0; y < H && !ps.length; y += 2) for (let x = 0; x < W; x += 2) if (districtAt(x, y) === d && passable(c, 'foot', x, y)) { ps.push([x * T + T / 2, y * T + T / 2]); break; } }
    // (Pulau Ubin is an island: walked from the bumboat's jetty, which the bumboat reaches from Changi Point)
    const from = d === 'pulau' ? [c.places['jetty-ubin'].x, c.places['jetty-ubin'].y] : start;
    for (const p of ps) assert.ok(reach('foot', from, p, open, okey), `${d} (${tile(p[0])},${tile(p[1])}) on foot from the market, with ${okey} open`);
    pairs++;
  }
}
assert.equal(new Set(openDistricts({ ...s, done: MISSIONS.map(m => m.id) })).size, DISTRICTS.length, 'the whole city opens');

// ── every place, parked ride, ride and cast member stands where its class can stand
const all = newSave(5); all.started = true; all.story.intro = true; all.story.ch = 10; all.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)];
const w = new World(all, 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT);
// (on the tile, or for a counter or a ride squeezed by a later prop, a tile beside it: three of the build's, the same in the
// old frame, are a hawker counter, a Sentosa spot and a scooter under Kampong Glam's bougainvillea)
const ALL = new Set(DISTRICTS);
const stand = (cls, x, y, what) => { const [nx, ny] = nearestFree(c, cls, x, y, ALL, 1); assert.ok(passable(c, cls, tile(nx), tile(ny)) && Math.abs(tile(nx) - tile(x)) <= 1 && Math.abs(tile(ny) - tile(y)) <= 1, `${what} at ${tile(x)},${tile(y)}: ${cls} can stand there`); };
for (const [id, p] of Object.entries(c.places)) stand(p.kind === 'pier' || p.kind === 'jetty' ? 'boat' : 'foot', p.x, p.y, `place ${id}`);
for (const p of c.parking) stand(VEHICLES[p.kind].cls, p.x, p.y, `parking ${p.kind}`);
for (const r of w.rides) stand(r.b.cls, r.b.x, r.b.y, `ride ${r.kind}`);
for (const m of castOf(w)) stand('foot', m.x, m.y, `cast ${m.id}`);
console.log(`jade reach: ${MISSIONS.length + SIDE.length} jobs walked giver to last target (${legs} legs, each the way it is played); ${pairs} district checks from the market over ${stages.length} stages of the story; ${Object.keys(c.places).length} places, ${c.parking.length} parked rides, ${w.rides.length} rides and the cast on ground they can stand on`);
