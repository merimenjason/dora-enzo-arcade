// Players for the Cloudsteel tests and bot run. `human` plays like a person: it notices a wind-up a reaction time
// late, guards a little early or late, dodges jade attacks, and cuts when the foe is open.
import { idleInput } from '../.checks/cloudsteel-game.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** reaction: ticks before a wind-up is noticed; jitter: how far off (in ticks, either way) the guard press lands;
 *  tap: how many ticks an attack press is held */
export function makeBot({ seed = 1, reaction = 16, jitter = 5, useTag = true, guardOnly = false } = {}) {
  const rand = rng(seed); let plan = null, mash = 0, seen = new Map();
  return (g) => {
    const inp = idleInput(), f = g.targetFoe;
    if (!f || g.phase !== 'fight') return inp;
    const dx = f.x - g.x, dz = f.z - g.z, d = Math.hypot(dx, dz) || 1;
    // who is winding up at Dora?
    const threat = g.foes.find((o) => o.state === 'windup' || o.state === 'strike');
    if (threat && threat.state === 'windup') {
      if (!seen.has(threat.id) || seen.get(threat.id).start !== g.tick_ - threat.t) {
        const start = g.tick_ - threat.t, land = start + threat.atk.windup, off = Math.round((rand() * 2 - 1) * jitter);
        seen.set(threat.id, { start, see: start + reaction, press: land - 4 + off, jade: threat.atk.jade });
      }
      const s = seen.get(threat.id);
      if (g.tick_ >= s.see) plan = { ...s, id: threat.id };
    } else if (!threat) plan = null;
    if (plan) {
      if (plan.jade) { // run out of reach, and dodge as it lands
        inp.x = -dx / d; inp.z = -dz / d;
        if (g.tick_ >= plan.press - 6 && g.tick_ <= plan.press - 4) inp.dodge = true;
        return inp;
      }
      if (g.tick_ >= plan.press) { inp.guard = true; return inp; }
      if (guardOnly) return inp;
      // too late to start another cut: wait for the strike
      if (g.tick_ >= plan.press - 14) return inp;
    }
    if (useTag && g.tag >= 100 && (g.tick_ % 3 === 0)) { inp.tag = true; return inp; }
    if (guardOnly) return inp;
    const reach = f.kind === 'bear' ? 3.0 : 2.4;
    if (d > reach) { inp.x = dx / d; inp.z = dz / d; }
    // tap attack: two ticks down, four up
    mash = (mash + 1) % 6; if (d < reach + 2 && mash < 2) inp.attack = true;
    return inp;
  };
}
/** plays a whole fight; a fall retries the round up to `retries` times */
export function play(Fight, bot, { seed = 1, assist = true, retries = 3, maxTicks = 60 * 600 } = {}) {
  const g = new Fight(seed, assist); let n = 0;
  while (n++ < maxTicks) {
    g.tick(bot(g));
    if (g.phase === 'won') break;
    if (g.phase === 'lost') { if (g.stats.falls >= retries) break; g.retryRound(); }
  }
  return g;
}
