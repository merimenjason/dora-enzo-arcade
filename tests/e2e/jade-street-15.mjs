// Jade Street in the browser, the fifteenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): the four new rides, each the way a first-timer finds it. Walk along the street (or the river bank) up to
// it until its prompt shows, E to get on, the partner climbing aboard by themselves, ride it with both heroes really
// drawn (the driver's riding frames, the partner on the back saddle, in the sidecar, at the drum, or on their own luge
// cart), Tab to swap seats, Q for its own horn, E to get off, and a screenshot of each.
export async function fifteenth(h) {
  const { p, W, look, check, until, wait, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const near = () => W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, label: n.label, kindOf: n.ride?.kind } : null; });
  const drawn = () => W(() => window.__jade.rideDrawn());
  await W(() => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.story.ch = 9; w.s.cash = 5000;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong']);
    w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null; w.s.settings.partner = 'tag'; J.play.paused = false; J.play.bump();
  });
  // OUTFIT=<id> rides them all in that outfit (the outfits are hue shifts of the painted frames)
  if (process.env.OUTFIT) await W(o => { const w = window.__jade.world(); w.s.outfit.dora = o; w.s.outfit.enzo = o; }, process.env.OUTFIT);
  await free();
  // each ride: where a first-timer walks up from (a few tiles back along the street, or the river bank), the way to walk,
  // and the frames the driver and the partner should be drawn with
  const RIDES = [
    { kind: 'tandem', label: 'East Coast Park', from: [-200, 0], walk: 'd', drv: /-ride-tandem-[01]$/, pas: /-tandem-back-[01]$/ },
    { kind: 'icecream', label: 'Orchard Road', from: [-200, 0], walk: 'd', drv: /-ride-moto-[01]$/, pas: /-sidecar-[01]$/ },
    { kind: 'luge', label: 'Sentosa', from: [-200, 0], walk: 'd', drv: /-ride-luge-[01]$/, pas: /-ride-luge-[01]$/ },
    { kind: 'dragon', label: 'Clarke Quay', from: [-120, -64], walk: 'd', drv: /-ride-paddle-[01]$/, pas: /-drum-[01]$/ },
  ];
  for (const R of RIDES) {
    const at = await W(k => { const r = window.__jade.world().rides.find(r => r.kind === k); return r ? [r.b.x, r.b.y] : null; }, R.kind);
    check(!!at, `${name}: a ${R.kind} parked at ${R.label}`); if (!at) continue;
    // walk up to it from along the street, the partner at your side, until its prompt shows
    await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [at[0] + R.from[0], at[1] + R.from[1]]);
    await wait(400); await p.keyboard.down(R.walk);
    const found = await until(k => { const n = window.__jade.world().near; return n?.kind === 'ride' && n.ride?.kind === k; }, R.kind, 5000);
    await p.keyboard.up(R.walk);
    const n = await near();
    check(found, `${name}: walking up to the ${R.kind} at ${R.label}, its prompt shows: "${n?.label}"`);
    if (!found) await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); window.__jade.play.bump(); }, [at[0], at[1] + 40]);
    await look(`${R.kind} parked`);
    await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 600);
    check(await W(k => window.__jade.world().p.ride?.kind === k, R.kind), `${name}: E gets on the ${R.kind}`);
    // the partner climbs aboard (a seat, or their own luge cart) by themselves
    const aboard = await until(k => window.__jade.world().mate.seat?.kind === k, R.kind, 6000);
    check(aboard, `${name}: the partner climbs aboard the ${R.kind}`);
    // ride it: both heroes drawn, the driver in the ride's own frames and the partner in their seat
    await p.keyboard.down(R.walk); await wait(1100);
    const d = await drawn(); const who = await W(() => [window.__jade.world().p.who, window.__jade.world().mate.who]);
    await look(`riding the ${R.kind}`); await p.keyboard.up(R.walk);
    check(R.drv.test(d.driver) && d.driver.startsWith(who[0]), `${name}: ${who[0]} drives the ${R.kind} drawn as ${d.driver}`);
    check(R.pas.test(d.partner) && d.partner.startsWith(who[1]), `${name}: ${who[1]} rides along on the ${R.kind} drawn as ${d.partner}`);
    // the two frames of the cycle both play
    const frames = new Set(); for (let i = 0; i < 12; i++) { frames.add((await drawn()).driver); await wait(90); }
    check([...frames].filter(f => R.drv.test(f)).length === 2, `${name}: the ${R.kind}'s riding cycle plays both frames (${[...frames].join(', ')})`);
    // the partner's moves on the seat (aim, grab, duck, cheer), each its own pose (on the luge they keep to their own
    // cart), and a bump for the driver
    for (const [f, pose] of [['fireT', 'pass-aim'], ['grabT', 'pass-grab'], ['reloadT', 'pass-duck'], ['cheerT', 'pass-cheer']]) {
      await W(f => { window.__jade.world().mate[f] = 0.8; }, f); await wait(150);
      const pd = (await drawn()).partner; await look(`${R.kind} partner ${pose}`);
      check(R.kind === 'luge' ? R.pas.test(pd) : pd.endsWith(pose), `${name}: the partner's ${pose} on the ${R.kind} drawn as ${pd}`);
      await W(f => { window.__jade.world().mate[f] = 0; }, f); await wait(100);
    }
    await W(() => { window.__jade.world().p.bumpT = 0.6; }); await wait(120);
    const bd = (await drawn()).driver; await look(`${R.kind} bump`);
    check(bd.endsWith('-ride-bump'), `${name}: a bump on the ${R.kind} drawn as ${bd}`); await wait(600);
    // Tab: the partner drives and you take the other seat, both still drawn
    await key('Tab', 500);
    const d2 = await drawn(); const who2 = await W(() => [window.__jade.world().p.who, window.__jade.world().mate.who]);
    check(who2[0] === who[1] && R.drv.test(d2.driver) && d2.driver.startsWith(who2[0]) && R.pas.test(d2.partner) && d2.partner.startsWith(who2[1]), `${name}: Tab swaps seats on the ${R.kind} (${d2.driver}, ${d2.partner})`);
    await look(`${R.kind} swapped`);
    // Q: its own horn
    await W(() => { const w = window.__jade.world(); window.__honk15 = ''; const h0 = w.honk; w.honk = function () { const n = this.fx.length; h0.call(this); const f = this.fx.slice(n).find(f => f.t === 'honk'); if (f) window.__honk15 = f.kind; }; });
    await key('q', 200); check(await W(() => window.__honk15) === R.kind, `${name}: Q sounds the ${R.kind}'s own horn`);
    await W(() => { delete window.__jade.world().honk; });
    // E: off, both heroes on their feet on open ground
    await W(() => { const w = window.__jade.world(); if (w.p.ride) w.p.ride.b.speed = 0; }); await wait(300);
    await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 800);
    check(await W(() => !window.__jade.world().p.ride && !window.__jade.world().mate.seat), `${name}: E gets off the ${R.kind}, the partner too`);
    await look(`off the ${R.kind}`);
    await free();
  }
}
