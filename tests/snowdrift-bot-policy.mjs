// The players Snowdrift's bots and tests use, as functions from the game to the button.

/** Holds on a downslope just ahead and under a cave roof; lets go on the way up and in the air. Reacts 6 ticks late. */
export function human(lag = 6) {
  const plan = [];
  return (g) => {
    let want = false;
    if (!g.air && !g.tumbling) {
      const look = g.x + g.speed * 0.12, q = g.course.ground(look);
      const roof = g.course.ceiling(g.x + g.speed * 0.4) !== null;
      want = roof || (q ? q.m < -0.04 : false);
    }
    plan.push(want);
    return plan.length > lag ? plan[plan.length - 1 - lag] : false;
  };
}
/** The rhythm, plus a backflip on any flight with room for one: holds in the air until nearly round, then lets go. */
export function expert(lag = 3, room = 7) {
  const base = human(lag);
  let flipping = false;
  return (g) => {
    const b = base(g);
    if (!g.air) { flipping = false; return b; }
    const q = g.course.ground(g.x + g.vx * 0.5), high = q ? g.y - q.y : 0;
    if (!flipping && g.airT > 0.13 && g.spin === 0 && high > room && g.vy > -4) flipping = true;
    if (flipping && g.spin > Math.PI * 2 - 0.9) flipping = false;
    return flipping;
  };
}
/**
 * A careful planner for proving the daylight medal can be won: every few ticks it tries holding and letting go, plays
 * each on with the plain rhythm for a few seconds, and keeps whichever left the sled further ahead of the dusk.
 */
export function planRun(g, K = 6, R = 150) {
  g.step(true); g.events.length = 0;
  const score = () => (g.phase === 'caught' ? -1e9 : g.phase === 'finish' ? 1e6 - g.finishT : g.x - g.duskX);
  const roll = (first) => {
    const s = g.snapshot(), pol = human(0);
    for (let i = 0; i < K && !g.done; i++) g.step(first);
    for (let i = 0; i < R && !g.done; i++) g.step(pol(g));
    g.events.length = 0;
    const v = score(); g.restore(s); return v;
  };
  for (let n = 0; !g.done && n < 60 * 400; ) { const hold = roll(true) > roll(false); for (let i = 0; i < K && !g.done; i++, n++) { g.step(hold); g.events.length = 0; } }
  return g;
}
