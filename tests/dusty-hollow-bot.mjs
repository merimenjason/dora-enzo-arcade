// A playtest bot for Dusty Hollow: plays a full 16-day year through the engine to
// prove the loan ladder is finishable and every species is catchable in its window.
import assert from 'node:assert/strict';
import { Hollow, FISH, BUGS, FOSSILS, LOANS, DAY, H, BUILDINGS, MAX_BUGS } from '../.checks/dusty-hollow-game.js';

const setHour = (g, h) => { g.clock = (h / 24) * DAY; };
const stand = (g, x, y, facing) => { g.x = x + 0.5; g.y = y + 0.5; g.facing = facing; };
const SPOTS = { river: [17, 5, 1], pond: [5, 3, 1], sea: [10, H - 4, 2] };
const park = (g) => g.villagers.forEach((v) => { v.x = v.tx = -5; v.y = v.ty = -5; });

/** Cast, hook on the bite and reel with a sensible rhythm. Returns the fish id or null. */
function fish(g, habitat) {
  const before = g.pockets.length;
  stand(g, ...SPOTS[habitat]);
  g.setTool('rod');
  g.interact();
  for (let i = 0; i < 300 && g.fishing && g.fishing.phase !== 'bite'; i++) g.step(0.05);
  if (!g.fishing) return null;
  g.interact();
  for (let i = 0; i < 600 && g.fishing; i++) g.step(0.05, { dx: 0, dy: 0, run: false, hold: g.fishing.tension < 0.55 });
  return g.pockets.length > before ? g.pockets[g.pockets.length - 1].id : null;
}
function sellAll(g) { g.screen = 'shop'; g.sellAll(); g.screen = 'world'; }
function payLoan(g) { const door = BUILDINGS.find((b) => b.id === 'friend').door; stand(g, door[0], door[1], 0); g.interact(); if (g.dialog) g.choose(0); }

// ---- 1. Every fish is catchable in its listed window --------------------------
{
  const g = new Hollow('dora', 21);
  park(g);
  const seen = new Set();
  for (const s of FISH) {
    const season = s.seasons[0];
    g.day = ['spring', 'summer', 'autumn', 'winter'].indexOf(season) * 4 + 1;
    for (let attempt = 0; attempt < 400 && !seen.has(s.id); attempt++) {
      setHour(g, s.time === 'night' ? 22 : 12);
      const id = fish(g, s.habitat);
      if (id) seen.add(id);
      if (g.pockets.length > 15) sellAll(g);
    }
    assert.ok(seen.has(s.id), `${s.name} was never caught in ${season} (${s.time}, ${s.habitat})`);
  }
  console.log(`PASS bot: all ${FISH.length} fish caught in their listed season, time and water`);
}

// ---- 2. Every bug spawns in its listed window and can be netted -----------------
{
  const g = new Hollow('dora', 22);
  park(g);
  const seen = new Set();
  for (const s of BUGS) {
    // Pick a day in one of its seasons with the right weather for rain-only bugs, looking up to four years ahead.
    const candidates = [];
    for (let year = 0; year < 4; year++) for (const season of s.seasons) for (let i = 1; i <= 4; i++) candidates.push(year * 16 + ['spring', 'summer', 'autumn', 'winter'].indexOf(season) * 4 + i);
    const day = candidates.find((d) => { g.day = d; return !!s.rain === (g.weather !== 'clear'); });
    assert.ok(day, `no ${s.rain ? 'rainy' : 'clear'} day found for the ${s.name}`);
    g.day = day;
    const season = g.season;
    for (let attempt = 0; attempt < 600 && !seen.has(s.id); attempt++) {
      setHour(g, s.time === 'night' ? 21 : 12);
      g.bugs = [];
      g.bugTimer = 0;
      for (let i = 0; i < 12 && g.bugs.length < MAX_BUGS; i++) g.step(0.1);
      for (const b of g.bugs.slice()) {
        stand(g, Math.floor(b.x), Math.floor(b.y) + 1, 0);
        g.setTool('net');
        g.moving = false; g.running = false;
        if (/Caught/.test(g.interact())) seen.add(b.id);
      }
      if (g.pockets.length > 15) sellAll(g);
    }
    assert.ok(seen.has(s.id), `${s.name} never appeared in ${season} (${s.time}${s.rain ? ', rain' : ''})`);
  }
  console.log(`PASS bot: all ${BUGS.length} bugs netted in their listed season and time`);
}

// ---- 3. A year of ordinary play pays off the whole loan ladder --------------------
{
  const g = new Hollow('enzo', 23);
  park(g);
  let bestDay = 0;
  for (let day = 1; day <= 40 && g.debt > 0; day++) {
    // Morning: shake every tree, hit every rock, dig every fossil.
    setHour(g, 8);
    for (const t of g.trees) { stand(g, t.x, t.y + 1, 0); while (t.count && !g.full) g.interact(); }
    if (g.tools.includes('shovel')) {
      for (const r of g.rocks) { stand(g, r.x, r.y + 1, 0); for (let i = 0; i < 4; i++) g.interact(); }
      for (const f of g.fossils.slice()) { stand(g, f.x, f.y + 1, 0); if (!g.full) g.interact(); }
    }
    for (const s of g.shells.slice()) { stand(g, s.x, s.y - 1, 2); g.setTool('hands'); if (!g.full) g.interact(); }
    // Day: fish the sea and river until the shop is about to close, selling whenever pockets fill.
    // The clock runs honestly here, so a six-minute day only allows so many casts.
    for (let i = 0; g.hour < 21.5 && g.hour >= 8; i++) {
      fish(g, i % 2 ? 'river' : 'sea');
      if (g.fishing) g.fishing = null;
      if (g.full) { g.screen = 'museum'; g.assess(); g.screen = 'world'; sellAll(g); }
    }
    g.screen = 'museum'; g.assess(); g.screen = 'world';
    sellAll(g);
    // Evening: buy the shovel when affordable, pay the loan.
    if (g.hour >= 22 || g.hour < 8) setHour(g, 21.8);
    if (!g.tools.includes('shovel') && g.raisins >= 600) { g.screen = 'shop'; g.buy('shovel'); g.screen = 'world'; }
    payLoan(g);
    if (g.debt === 0) bestDay = day;
    g.screen = 'home'; g.sleep(); g.screen = 'world';
  }
  g.step(0.1);
  assert.equal(g.debt, 0, `the loan ladder (${LOANS.join(' → ')}) should be finishable in 40 days; ${g.debt} left with ${g.raisins} in hand`);
  assert.equal(g.homeLevel, 3);
  assert.ok(g.goals.includes('fish') && g.goals.includes('shake') && g.goals.includes('loan') && g.goals.includes('grand'));
  assert.ok(bestDay <= 40 && bestDay >= 6, `paying everything off in ${bestDay} days should take real effort`);
  assert.ok(g.arrived.includes('lupe'), 'four goals bring Lupe to town');
  console.log(`PASS bot: Grand Burrow paid off on day ${bestDay} with ${g.stats.fish} fish, ${g.stats.fruit} fruit and ${g.stats.fossils} fossils`);
}

// ---- 4. Festivals and fossils over a year ----------------------------------------
{
  const g = new Hollow('dora', 24);
  park(g);
  g.tools.push('shovel');
  let festivals = 0;
  const fossilKinds = new Set();
  for (let day = 1; day <= 16; day++) {
    setHour(g, 9);
    for (const f of g.fossils.slice()) { stand(g, f.x, f.y + 1, 0); g.interact(); }
    g.screen = 'museum'; g.assess(); for (const p of g.pockets.slice()) if (p.kind === 'fossil') fossilKinds.add(p.id); g.screen = 'world';
    if (g.festival === 'tourney') { setHour(g, 12); for (let i = 0; i < 6; i++) fish(g, 'sea'); }
    if (g.festival === 'snowday') { g.setTool('hands'); for (const s of g.snowballs.slice()) { stand(g, s.x, s.y + 1, 0); g.interact(); } assert.equal(g.stats.snowmen, 3); }
    if (g.festival) festivals++;
    sellAll(g);
    g.screen = 'home'; g.sleep(); g.screen = 'world';
  }
  assert.equal(festivals, 4, 'one festival per season');
  assert.ok(g.stats.festivals >= 1, 'the tourney was entered');
  assert.ok(fossilKinds.size >= 5, `a year of digging should turn up most of the ${FOSSILS.length} fossils (got ${fossilKinds.size})`);
  console.log(`PASS bot: a full year ran ${festivals} festivals, ${g.stats.snowmen} snowmen and ${fossilKinds.size} fossil kinds`);
}
