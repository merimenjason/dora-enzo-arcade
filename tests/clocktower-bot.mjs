// The Clocktower Mystery solver. From the start it tries every action a player could take (walk through every exit,
// click every hotspot, use every item on every hotspot, swap between Dora and Enzo, fit every wheel on every spindle)
// and walks every state the story can reach. It checks that the clock can be mended from the start, that there is no
// dead end (from every reachable state the ending can still be reached), that every hotspot and every item gets used
// on the way, and that the shortest solution is a sensible length. Then it follows the notebook's hints alone from the
// start and checks they lead all the way to the end.
import assert from 'node:assert/strict';
import { GEARS, ITEMS, ROOMS, SPOTS, act, exits, hint, newState, spots } from '../.checks/clocktower-game.js';

// Two simplifications keep the search small. Flags that only change what someone says (the chart, the torn sack, the
// glint, the whispering) are left out of a state's key. And when Dora isn't hanging on the mill lever, Enzo is counted
// as standing wherever she is: walking can never strand anyone (no exit closes again once open), so where the other
// one waits can't make a dead end, only more states.
const COSMETIC = new Set(['readChart', 'sawSack', 'sawGlint', 'heardTwins']);
const key = (s) => JSON.stringify([s.ch, s.at.dora, s.at.enzo, s.who, [...s.inv].sort(), s.got, s.flags.filter((f) => !COSMETIC.has(f)), s.fitted]);
const copy = (s) => ({ ...s, at: { ...s.at }, inv: [...s.inv], got: [...s.got], flags: [...s.flags], fitted: [...s.fitted], seen: [...s.seen] });
const settle = (s) => { if (!s.flags.includes('holding')) { const o = s.who === 'dora' ? 'enzo' : 'dora'; s.at[o] = s.at[s.who]; } return s; };
const actions = (s) => {
  const r = s.at[s.who], out = [{ k: 'swap' }];
  for (const to of exits(r)) out.push({ k: 'go', to });
  for (const id of spots(s, r)) { out.push({ k: 'spot', id }); for (const item of s.inv) out.push({ k: 'item', item, id }); }
  if (r === 'clockroom') for (const item of s.inv) if (GEARS.includes(item)) for (let slot = 0; slot < 4; slot++) out.push({ k: 'fit', item, slot });
  return out;
};

// ---- every reachable state, and the moves between them
const start = newState(), ids = new Map([[key(start), 0]]), nodes = [{ s: start, next: [], end: false }], queue = [0];
const usedSpots = new Set(), usedItems = new Set();
let edges = 0;
for (let qi = 0; qi < queue.length; qi++) {
  const id = queue[qi], node = nodes[id], s = node.s, ks = key(s);
  if (s.ch === 4) { node.end = true; continue; }
  for (const a of actions(s)) {
    const t = copy(s), o = act(t, a);
    if (!o.ok) continue;
    if (a.k === 'spot') usedSpots.add(a.id); if (a.k === 'item') usedItems.add(a.item); if (a.k === 'fit') usedItems.add(a.item);
    settle(t); const k = key(t); if (k === ks) continue;
    edges++;
    let j = ids.get(k);
    if (j === undefined) { j = nodes.length; ids.set(k, j); nodes.push({ s: t, next: [], end: false }); queue.push(j); }
    node.next.push(j);
  }
}
// ---- which states can still reach the end (walk backwards from the ends)
const back = nodes.map(() => []); nodes.forEach((n, i) => { for (const m of n.next) back[m].push(i); });
const good = new Uint8Array(nodes.length), stack = [];
nodes.forEach((n, i) => { if (n.end) { good[i] = 1; stack.push(i); } });
while (stack.length) for (const p of back[stack.pop()]) if (!good[p]) { good[p] = 1; stack.push(p); }
const stuck = nodes.map((_, i) => i).filter((i) => !good[i]);
console.log(`clocktower solver: ${nodes.length} states, ${edges} moves, ${stuck.length} dead ends`);
assert.ok(good[0], 'the mystery can be solved from the start');
assert.equal(stuck.length, 0, `no dead ends (first: ${stuck.length ? key(nodes[stuck[0]].s) : ''})`);

// ---- the shortest solution
const dist = new Int32Array(nodes.length).fill(-1), q2 = [0]; dist[0] = 0; let shortest = -1;
for (let qi = 0; qi < q2.length; qi++) { const k = q2[qi]; if (nodes[k].end) { shortest = dist[k]; break; } for (const m of nodes[k].next) if (dist[m] < 0) { dist[m] = dist[k] + 1; q2.push(m); } }
console.log(`shortest solution: ${shortest} actions`);
assert.ok(shortest >= 45 && shortest <= 110, `a sensible length (${shortest})`);

// ---- everything gets used
for (const id of Object.keys(SPOTS)) assert.ok(usedSpots.has(id), `the ${id} hotspot does something`);
for (const it of Object.keys(ITEMS)) assert.ok(usedItems.has(it) || ['tuft', 'note', 'button', 'oilcan', 'lantern', 'boathook'].includes(it), `the ${it} gets used`);
for (const it of ['oilcan', 'lantern', 'tuft', 'button', 'boathook', 'note', ...GEARS]) assert.ok(usedItems.has(it), `${it} is used on something`);
assert.equal(Object.keys(ROOMS).length, 8);

// ---- following the hints alone gets to the end: a pilot that does whatever action brings the hint closest
// (it reads the hint, then takes the shortest path to the nearest state with a hint it hasn't seen yet)
{
  let at = 0, steps = 0, hints = 0; const shown = new Set();
  while (nodes[at].s.ch !== 4 && steps < 400) {
    const h = hint(nodes[at].s); hints++; shown.add(h);
    // breadth-first from here to the nearest state whose hint is different (the hinted step done)
    const prev = new Map([[at, -1]]), q = [at]; let goal = -1;
    for (let qi = 0; qi < q.length && goal < 0; qi++) {
      for (const m of nodes[q[qi]].next) if (!prev.has(m)) { prev.set(m, q[qi]); const t = nodes[m].s; if (t.ch === 4 || !shown.has(hint(t))) { goal = m; break; } q.push(m); }
    }
    assert.ok(goal >= 0, `the hint “${h}” can be followed`);
    let len = 0; for (let k = goal; k !== at; k = prev.get(k)) len++;
    assert.ok(len <= 12, `the hint “${h}” is a short way from where you are (${len})`);
    at = goal; steps += len; if (process.env.TRACE) console.log(len, h);
  }
  const s = nodes[at].s;
  assert.equal(s.ch, 4, 'the hints lead to the end');
  console.log(`following the hints: ${hints} hints, ${steps} actions`);
}
console.log('clocktower bot: all good');
