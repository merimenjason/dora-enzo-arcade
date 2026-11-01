// Tidepool's bots. The caretaker looks after the pool the way a thoughtful player would: it sketches what it sees,
// brings the basket's creatures in, plants and trims seaweed, places rocks, drops a shell for a cramped hermit crab,
// shades the warm pool with the plank, fetches seawater when the air runs short, shoos every gull, and turns the
// season once its pages are done. The idle bot does nothing at all but turn the season when it may.
import { TIDE, PAGES, SPECIES, floorY } from '../.checks/tide-game.js';

const PLANT_AT = [40, 56, 70, 84, 98, 112, 122, 34, 48, 118];
const ROCK_AT = [62, 90, 116, 40];

/** One look at the pool every few steps, as a player would. */
export function caretaker(g) {
  if (g.tick % 8 !== 0) return;
  // gulls first: they will not wait
  for (const gu of g.gulls) if (gu.st === 'eye' || (gu.st === 'in' && gu.t > 20)) g.act({ t: 'shoo', x: gu.x, y: gu.y });
  // sketch whatever is not finished yet
  for (const a of g.agents) if ((g.sketch[a.sp] ?? 0) < 3) { const before = g.sketch[a.sp] ?? 0; g.act({ t: 'look', x: a.x, y: a.y }); if ((g.sketch[a.sp] ?? 0) > before) break; }
  for (const w of g.weeds) if ((g.sketch.seaweed ?? 0) < 3 && w.size > 0.3) { g.act({ t: 'look', x: w.x, y: floorY(w.x) - 4 }); break; }
  for (const gu of g.gulls) if ((g.sketch.gull ?? 0) < 3 && gu.st !== 'out') g.act({ t: 'look', x: gu.x, y: gu.y });
  for (const j of g.jellies) if ((g.sketch.jelly ?? 0) < 3) g.act({ t: 'look', x: j.x, y: j.y });
  // the basket
  for (const sp of SPECIES) if (g.basket[sp] > 0 && g.count(sp) < 4) {
    const at = sp === 'hermit' ? [80, 78] : sp === 'blenny' ? [70, 70] : sp === 'starfish' ? [104, 74] : [60 + (g.tick % 40), 64];
    g.act({ t: 'bring', sp, x: at[0], y: at[1] });
  }
  if (g.basket.rock > 0) for (const x of ROCK_AT) if (g.act({ t: 'rock', x })) break;
  if (g.basket.seedling > 0 && g.season < 3) for (const x of PLANT_AT) if (g.act({ t: 'plant', x })) break;
  // a cramped hermit crab gets a shell dropped beside it
  const cramped = g.agents.find((a) => a.sp === 'hermit' && a.size > a.shell - 0.02);
  if (cramped && g.basket.shell > 0 && !g.shells.some((s) => s.size >= cramped.size + 0.04)) g.act({ t: 'shell', x: cramped.x + 3 });
  // shade and seawater at low tide
  if (!g.connected) {
    const hot = g.temp > 19.5;
    if (hot !== g.plank && g.tools.includes('plank') && (hot || g.o2 < 50)) g.act({ t: 'plank' });
    if ((g.o2 < 56 || g.temp > 24) && g.tools.includes('bucket')) g.act({ t: 'bucket' });
  }
  // autumn: keep the dying weed trimmed
  if (g.season === 3 && g.tick % 80 === 0) { const w = g.weeds.find((q) => q.size > 0.62); if (w) g.act({ t: 'trim', x: w.x, y: floorY(w.x) - 6 }); }
  turn(g, true);
}
/** Turns the season once its pages are done (or enough of them and a while has passed); in autumn, the spring tide. */
export function turn(g, care) {
  const left = PAGES.filter((p) => p.season === g.season && p.id !== 24 && !g.done[p.id]).length;
  if (g.season < 3 && g.canTurn() && (left === 0 || g.seasonTide >= (care ? 16 : 10))) g.act({ t: 'season' });
  if (g.season === 3 && g.canRelease() && (left === 0 || g.seasonTide >= (care ? 16 : 10))) g.act({ t: 'release' });
}
export function idle(g) { if (g.tick % 8 === 0) turn(g, false); }
/** Plays a pool with a policy for up to `tides` tides (or to the ending). */
export function playOut(g, policy, tides = 80, onTide) {
  for (let i = 0; i < tides * TIDE && !g.ended; i++) { policy(g); const t = g.tideNo; g.step(); g.events.length = 0; if (onTide && g.tideNo !== t) onTide(g); }
  return g;
}
/** For the idle bot: run a fixed number of tides in each season, turning when it can. */
export function idleThrough(g, perSeason = 10) {
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < perSeason * TIDE; i++) { g.step(); g.events.length = 0; }
    if (g.season < 3) { if (g.canTurn()) g.act({ t: 'season' }); else g.setSeason(g.season + 1); }
  }
  return g;
}
