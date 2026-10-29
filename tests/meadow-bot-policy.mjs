// Meadowmend's bot players, shared by the engine tests and the bot. Each takes a game and returns a placement
// [q, r, rot] for the current tile.
//  - naive: a random cell next to the valley, turned at random (a player who does not look at the edges).
//  - casual: the best turn at a handful of cells it happens to look at (roughly a new player).
//  - greedy: the placement that scores the most points right now (tiles counted as 30 points each).
//  - smart: greedy, plus a look at the holes it leaves behind (a hole that asks for three different terrains is hard
//    to fill, a hole whose sides all agree is a Perfect waiting to happen, a mismatch spoils the Perfects round it),
//    checking its best five ideas one tile ahead against the peek at the next tile.
import { MeadowGame, DIRS, key, opp, rotate, parseEdges, segments, rotations } from '../.checks/meadow-game.js';

/** A seeded little generator for the naive bot. */
export function lcg(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export const naive = (seed = 1) => { const rnd = lcg(seed); return (g) => { const f = g.frontier(); const [q, r] = f[Math.floor(rnd() * f.length)]; return [q, r, Math.floor(rnd() * 6)]; }; };

/** A casual player: looks at a few cells near where they last played and picks the best turn among them. */
export const casual = (seed = 1, look = 4) => { const rnd = lcg(seed); return (g) => {
  const f = g.frontier(); let best = null, bv = -Infinity;
  for (let n = 0; n < look; n++) { const [q, r] = f[Math.floor(rnd() * f.length)]; for (const { rot, value } of rotations(g, q, r, 30)) if (value > bv) { bv = value; best = [q, r, rot]; } }
  return best;
}; };

export function greedy(g) {
  let best = null, bv = -Infinity;
  for (const [q, r] of g.frontier()) for (const { rot, value } of rotations(g, q, r, 30)) if (value > bv) { bv = value; best = [q, r, rot]; }
  return best;
}

/** How a placement leaves the empty cells round it. */
function future(g, q, r, e) {
  const k = key(q, r);
  g.cells.set(k, { q, r, kind: 'tile', e, seg: segments(e), closed: [false, false, false, false, false, false], perfect: false, turn: 0, tile: -1 });
  let v = 0;
  try {
    for (let i = 0; i < 6; i++) {
      const nq = q + DIRS[i][0], nr = r + DIRS[i][1];
      if (!g.inBounds(nq, nr)) continue;
      const n = g.cells.get(key(nq, nr));
      if (n) { if (n.kind !== 'rock' && n.e[opp(i)] !== e[i]) v -= n.perfect ? 0 : 14; continue; }
      // an empty neighbour: what will it ask for?
      const want = [];
      let sides = 0;
      for (let j = 0; j < 6; j++) {
        const mq = nq + DIRS[j][0], mr = nr + DIRS[j][1];
        if (!g.inBounds(mq, mr)) { sides++; continue; }
        const m = g.cells.get(key(mq, mr)); if (!m) continue;
        sides++; if (m.kind !== 'rock') want.push(m.e[opp(j)]);
      }
      const kinds = new Set(want).size;
      if (kinds >= 3) v -= 10 * (kinds - 2);
      if (want.includes('stream') && kinds >= 2) v -= 4;
      if (kinds === 1 && sides >= 4) v += 6 + (sides - 4) * 3;
    }
  } finally { g.cells.delete(k); }
  return v;
}

/** Every placement for the current tile, valued now and for the holes it leaves. */
function candidates(g, tv = 45) {
  const out = [], e0 = parseEdges(g.current.e);
  for (const [q, r] of g.frontier()) for (const { rot, a, value } of rotations(g, q, r, tv)) out.push({ m: [q, r, rot], v: value + future(g, q, r, rotate(e0, rot)) - a.wishes.filter((w) => w.state === 'failed').length * 25 });
  return out.sort((x, y) => y.v - x.v);
}
/** Smart: the best few placements, each checked one tile ahead (where the next tile would go best after it). */
export const smartWith = ({ tv = 45, ahead = 0.7 } = {}) => (g) => {
  const list = candidates(g, tv);
  if (!g.peek) return list[0].m;
  let best = list[0].m, bv = -Infinity;
  for (const c of list.slice(0, 5)) {
    const h = MeadowGame.load(g.snapshot()); h.place(...c.m);
    const next = h.done || !h.current ? 0 : candidates(h, tv)[0]?.v ?? 0;
    const v = c.v + ahead * next;
    if (v > bv) { bv = v; best = c.m; }
  }
  return best;
};
export const smart = smartWith();
/** The smart bot's settings the medal targets are tried with: it keeps the best of these runs. */
export const SMART_STYLES = [{ tv: 45, ahead: 0.7 }, { tv: 60, ahead: 0.4 }, { tv: 35, ahead: 1 }];

/** Plays a whole run with a policy and returns the game. */
export function playOut(g, policy, limit = 2000) {
  for (let i = 0; i < limit && !g.done; i++) { const m = policy(g); if (!m || !g.place(m[0], m[1], m[2])) throw new Error('the bot found no legal move'); }
  return g;
}
