// Players for the Cloudsteel tests and bot run. `human` plays like a person: it notices a wind-up a reaction time
// late, guards a little early or late, dodges jade attacks, steps off an archer's red line once it locks (or wards
// it, as Enzo), and cuts when the foe is open. With `swaps` it plays the tag team: it swaps in on a full meter (a tag
// strike), sends Enzo in against a group or an archer, and brings Dora back for the finisher.
import { idleInput, ARROW } from '../.checks/cloudsteel-game.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** reaction: ticks before a wind-up is noticed; jitter: how far off (in ticks, either way) the guard press lands;
 *  swaps: plays both heroes (otherwise it stays Dora, as the old one-hero duel did, and never presses E) */
export function makeBot({ seed = 1, reaction = 16, jitter = 5, swaps = true, useTag, guardOnly = false } = {}) {
  if (useTag === false) swaps = false;
  const rand = rng(seed); let mash = 0, lastSwap = -999; const seen = new Map();
  return (g) => {
    const inp = idleInput(), f = g.targetFoe;
    if (!f || g.phase !== 'fight') return inp;
    const enzo = g.hero === 'enzo', me = g.me, dx = f.x - me.x, dz = f.z - me.z, d = Math.hypot(dx, dz) || 1;
    // ------------------------------------------------ what is coming: a blade's wind-up, or an archer's draw
    let plan = null;
    for (const o of g.foes) {
      if ((o.state !== 'windup' && o.state !== 'strike') || !o.atk) continue;
      // a strike's own clock starts again: find the wind-up it came from
      const start = o.state === 'windup' ? g.tick_ - o.t : g.tick_ - o.t - o.atk.windup, key = `${o.id}@${start}`;
      if (!seen.has(key)) {
        const off = Math.round((rand() * 2 - 1) * jitter), land = start + o.atk.windup;
        seen.set(key, { start, see: start + reaction, land, press: land - 4 + off, jade: o.atk.jade, arrow: o.kind === 'archer', lock: land - ARROW.lock, id: o.id });
      }
      const s = seen.get(key);
      if (g.tick_ >= s.see && (!plan || s.land < plan.land)) plan = s;
    }
    // arrows in flight at the hero: when they will arrive, and whether they will pass close
    let arrow = null, noSweep = false;
    for (const a of g.arrows) {
      const rx = me.x - a.x, rz = me.z - a.z, along = (rx * a.vx + rz * a.vz) / ARROW.speed, side = Math.abs(rx * a.vz - rz * a.vx) / ARROW.speed;
      if (along > 0 && side < 0.8) { const ticks = along / ARROW.speed; if (!arrow || ticks < arrow.ticks) arrow = { ticks, vx: a.vx, vz: a.vz }; }
    }
    const living = g.living, archers = living.filter((o) => o.kind === 'archer'), broken = living.find((o) => o.state === 'broken');
    // ------------------------------------------------ the archer: off the line, or Enzo's ward
    if (arrow || (plan && plan.arrow)) {
      if (enzo && !guardOnly) {
        const left = arrow ? arrow.ticks : plan.land - g.tick_ + 18;
        // a press, not a hold: let go between tries so the next one counts
        if (left < 14 + jitter * 0.5 && g.enzo.wardCd === 0 && g.enzo.state !== 'ward') { inp.guard = g.tick_ % 2 === 0; return inp; }
        if (g.enzo.state === 'ward') return inp;
        if (left < 45) noSweep = true; // no sweep now: it would still be swinging when the arrow comes
      } else if (!guardOnly && plan && plan.arrow && g.tick_ >= plan.lock + Math.round(reaction / 2) || arrow && !guardOnly) {
        // step sideways off the red line
        const from = plan ? g.foe(plan.id) ?? f : f, ax = arrow ? arrow.vx : me.x - from.x, az = arrow ? arrow.vz : me.z - from.z, l = Math.hypot(ax, az) || 1, sgn = (seed + (plan?.id ?? 0)) % 2 ? 1 : -1;
        let sx = (az / l) * sgn, sz = (-ax / l) * sgn; if (Math.hypot(me.x + sx * 2, me.z + sz * 2) > 7) { sx = -sx; sz = -sz; }
        inp.x = sx; inp.z = sz; return inp;
      } else if (guardOnly && arrow && arrow.ticks < 8) { inp.guard = true; return inp; }
      // still drawing: carry on, but start nothing that would still be swinging when the line locks
      if (plan && plan.arrow && !arrow) { if (!enzo && g.tick_ >= plan.lock - 22) noSweep = true; plan = null; }
    }
    // ------------------------------------------------ a blade
    if (plan && !plan.arrow) {
      if (plan.jade || enzo) { // run out of reach, and roll (or hop) as it lands
        inp.x = -(plan.jade ? dx : (g.foe(plan.id)?.x ?? f.x) - me.x) / d; inp.z = -(plan.jade ? dz : (g.foe(plan.id)?.z ?? f.z) - me.z) / d;
        if (g.tick_ >= plan.press - 6 && g.tick_ <= plan.press - 4) inp.dodge = true;
        return inp;
      }
      if (g.tick_ >= plan.press) { inp.guard = true; return inp; }
      if (guardOnly) return inp;
      // too late to start another cut: wait for the strike
      if (g.tick_ >= plan.press - 14) return inp;
    }
    // ------------------------------------------------ the tag team
    if (swaps && !guardOnly && g.swapCd === 0 && g.tick_ - lastSwap > 40) {
      const groups = living.length >= 2 || archers.length > 0;
      let want = false;
      if (g.tag >= 100 && g.tick_ % 3 === 0) want = true; // in on a full meter: a tag strike
      else if (enzo && broken && !g.doraDown) want = true; // Dora for the finisher
      else if (enzo && !groups && !g.doraDown && g.tick_ - lastSwap > 240) want = true; // one sword left: Dora's duel
      else if (!enzo && groups && !broken && !g.enzoDown && g.tick_ - lastSwap > 360) want = true; // a group: Enzo's sweep
      if (want) { lastSwap = g.tick_; inp.tag = true; return inp; }
    }
    if (guardOnly) return inp;
    // ------------------------------------------------ attack: Dora cuts, Enzo sweeps
    const reach = enzo ? (f.kind === 'bear' ? 3.1 : 2.6) : f.kind === 'bear' ? 3.0 : 2.4;
    if (d > reach) { inp.x = dx / d; inp.z = dz / d; }
    // tap attack: two ticks down, four up
    mash = (mash + 1) % 6; if (d < reach + 2 && mash < 2 && !noSweep && (!enzo || d < reach + 0.3)) inp.attack = true;
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
