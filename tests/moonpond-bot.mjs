// A patient angler for Moonpond. It only presses what a player can press: hold, left and right, the shop and the
// lure box. It reads the journal's odds to decide where to cast, reacts to a bite after a human delay, and works
// the reel a beat behind the gauge.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Game, SPECIES, BANDS, LURES, UPGRADE_IDS, BAND_LOW, STEP, rng } from '../.checks/moonpond-game.js';

const SHOP = ['rod', 'clover', 'oil', 'dust', 'line', 'bobber', 'rod', 'oil', 'line', 'spyglass', 'bobber', 'oil', 'line', 'oil'];
const middle = (zone) => { const i = BANDS.findIndex(([z]) => z === zone), from = BANDS[i][1], to = BANDS[i + 1]?.[1] ?? 1; return [from, to]; };

/** Plays until the journal is full or `nights` have passed. `skill` 0 to 1 scales reaction and care. */
export function play(seed = 1, nights = 70, { skill = 0.7, shop = true, onCast } = {}) {
  const g = new Game(seed), r = rng(seed * 977 + 13), stats = { casts: 0, landed: 0, hooked: 0, lost: {}, nights: 0, noBite: 0, fights: [], caught: {} };
  const step = (input) => g.update(STEP, input);
  const list = [...SHOP];
  const spend = () => {
    if (!shop) return;
    for (;;) {
      const want = list[0]; if (!want) return;
      const ok = LURES.includes(want) ? g.buyLure(want) : g.buy(want);
      if (!ok) return; list.shift();
    }
  };
  while (!g.complete && g.night <= nights) {
    spend();
    let bites = 0;
    while (g.state !== 'dawn') {
      // Choose the water and lure most likely to show something new, else the richest.
      let best = null;
      for (const lure of g.lures) {
        g.setLure(lure);
        const spots = BANDS.map(([z]) => z); if (g.moon && g.up.rod >= 2) spots.push('moon');
        for (const zone of spots) {
          const [from, to] = zone === 'moon' ? [g.moon.d, g.moon.d] : middle(zone), d = zone === 'moon' ? g.moon.d : Math.min((from + to) / 2, g.reach - 0.02);
          if (d < from || d > g.reach) continue;
          const odds = g.odds(zone), fresh = odds.filter((o) => !g.known(o.sp.id)).reduce((a, o) => a + o.chance * (o.sp.rarity + 1), 0), value = fresh * 10 + odds.reduce((a, o) => a + o.chance * o.sp.rarity, 0) * 0.1;
          if (!best || value > best.value) best = { value, lure, zone, d, aim: zone === 'moon' ? g.moon.aim : 0 };
        }
      }
      g.setLure(best.lure);
      for (let i = 0; i < 400 && Math.abs(g.aim - best.aim) > 0.02; i++) step({ left: g.aim > best.aim, right: g.aim < best.aim });
      const wobble = (r() - 0.5) * 0.06 * (1 - skill), want = Math.min(1, Math.max(0.1, best.d / g.reach + wobble));
      step({ hold: true });
      for (let i = 0; i < 400 && g.charge < want; i++) step({ hold: true });
      step({});
      assert.equal(g.state, 'flying', 'a held and released charge casts');
      while (g.state === 'flying') step({});
      stats.casts++; onCast?.(g, best);
      // Wait for the bobber, and now and then be fooled by a nibble.
      const react = 0.2 + r() * (0.62 - 0.3 * skill), fooled = r() < 0.08 * (1 - skill);
      let seen = -1;
      for (let i = 0; i < 4000 && g.state === 'waiting'; i++) {
        if (fooled && g.nibbling) { step({ hold: true }); step({}); break; }
        if (g.biting && seen < 0) seen = 0;
        if (seen >= 0) { seen += STEP; if (seen >= react) { step({ hold: true }); break; } }
        step({});
      }
      if (seen >= 0) bites++;
      if (g.state === 'hooked') {
        stats.hooked++;
        // The reel: act on what the gauge showed a moment ago.
        const lag = Math.round((0.18 + 0.14 * (1 - skill)) / STEP), seenQ = [];
        let hold = true, frames = 0;
        while (g.state === 'hooked' && frames++ < 60 * 240) {
          seenQ.push({ t: g.fight.tension, jump: g.fight.jump, tell: g.fight.tell });
          const then = seenQ[Math.max(0, seenQ.length - 1 - lag)];
          if (then.jump || then.tell) hold = false;
          else if (then.t > g.bandHigh - 0.05) hold = false;
          else if (then.t < BAND_LOW + 0.12) hold = true;
          else if (then.t < g.bandHigh - 0.14) hold = true;
          step({ hold });
        }
        assert.notEqual(g.state, 'hooked', 'a fight ends');
        stats.fights.push(frames / 60);
      }
      if (g.state === 'landed') { stats.landed++; stats.caught[g.caught.id] = (stats.caught[g.caught.id] || 0) + 1; }
      else { assert.equal(g.state, 'lost'); stats.lost[g.loss] = (stats.lost[g.loss] || 0) + 1; }
      for (let i = 0; i < 60; i++) step({});
      step({ hold: true }); step({});
      spend();
    }
    if (!bites) stats.noBite++;
    stats.nights++;
    spend();
    if (!g.complete) g.nextNight();
  }
  return { g, stats };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const done = [], everything = {};
  for (let seed = 1; seed <= 8; seed++) {
    const { g, stats } = play(seed);
    for (const [id, n] of Object.entries(stats.caught)) everything[id] = (everything[id] || 0) + n;
    const fights = stats.fights.sort((a, b) => a - b);
    console.log(`Seed ${seed}: journal ${g.found}/${SPECIES.length} after ${stats.nights} nights, ${stats.landed}/${stats.casts} casts landed, lost ${JSON.stringify(stats.lost)}, median fight ${fights[fights.length >> 1].toFixed(1)}s, longest ${fights.at(-1).toFixed(1)}s, ${g.shells} shells left, gear ${UPGRADE_IDS.map((id) => g.up[id]).join('')}`);
    assert.ok(g.complete, `seed ${seed}: the journal is filled within 70 nights (missing ${SPECIES.filter((x) => !g.known(x.id)).map((x) => x.id).join(', ')})`);
    assert.equal(stats.noBite, 0, `seed ${seed}: every night has a bite`);
    done.push(stats.nights);
  }
  for (const sp of SPECIES) assert.ok(everything[sp.id] > 0, `${sp.name} was caught at least once`);
  // Starter gear, no shop: the first evenings should be winnable but not automatic.
  let landed = 0, casts = 0;
  for (let seed = 1; seed <= 8; seed++) { const { stats } = play(seed + 100, 6, { skill: 0.35, shop: false }); landed += stats.landed; casts += stats.casts; }
  const rate = landed / casts;
  console.log(`Starter gear, a middling angler: ${(rate * 100).toFixed(0)}% of ${casts} casts landed. Journals took ${Math.min(...done)} to ${Math.max(...done)} nights.`);
  assert.ok(rate >= 0.55 && rate <= 0.85, `starter landing rate ${rate.toFixed(2)} is between 55% and 85%`);
  console.log('PASS Moonpond bot: eight journals filled, every entry caught, every night had a bite.');
}
