// Jade Street in the browser, the seventeenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Pulau Ubin and chapter ten, "Kampong Spirit". Chapter nine's finale opens the island (a text from Pak
// Ubin, chapter ten's card); the plaque plans a trip there by bumboat; the island is walked (its market, safe house,
// property, folk and boars); every small pleasure by E with its own pose (shoo a boar, catch a dizzy one, shake a durian
// tree, climb Jejawi Tower); then every chapter-ten job and the three new Hawker Tales played the way a first-timer
// plays them: nothing is teleported once a job is on offer, the player follows the gold line, reads the on-screen hint
// and the E prompt, and presses only what they name. The new `track` step's read pose and the bumboat hail are checked
// drawn on the way. Then a screenshot of each.
export async function seventeenth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(300); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen17.has(n), n);
  await W(() => {
    window.__seen17 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen17.add(w.p.act.n); if (w.p.ride) window.__seen17.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen17.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const TEN = ['m66', 'm67', 'm68', 'm69', 'm70', 'm71', 'm72', 'm73', 'm74', 'm75'], TALES = ['k24', 'k25', 'k26'];

  // ── chapter nine's finale opens Pulau Ubin: a text, chapter ten's card
  const n0 = await W(TEN_TALES => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !TEN_TALES.includes(id) && id !== 'm65'); w.s.story.ch = 9; w.s.story.lights = true; w.s.story.coast = true; w.s.story.lake = true; w.s.cash = 5000;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong']); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start('m65'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump();
    w.s.settings.partner = 'tag'; w.s.settings.assist = true; return n;
  }, [...TEN, ...TALES]);
  check(await W(() => window.__jade.world().open.has('pulau')), `${name}: the lake's finale opens Pulau Ubin`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Pulau Ubin/.test(m.text) && /bumboat/.test(m.text)), n0), `${name}: Pak Ubin texts that the island is open, by bumboat`);
  check(await appear('jade-chapter-card'), `${name}: chapter ten's card`);
  check(/Kampong Spirit/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Kampong Spirit`); await wait(400); await look('chapter ten');
  check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-10/.test(im.src); }), `${name}: the card's painting is chapter ten's`);
  await press('jade-story-skip'); await settle();
  check(await W(() => window.__jade.world().s.story.ch === 10), `${name}: chapter ten is under way`);
  check(await W(() => window.__jade.jobs().side) === 26 && await W(() => window.__jade.jobs().story) === 75, `${name}: 75 story jobs and 26 Hawker Tales, counted from the data`);

  // ── the plaque plans the trip: a pin on Ubin from Chinatown goes by the bumboat from Changi Point
  await at('safe-market', 0, 64);
  await W(() => { const w = window.__jade.world(), pl = w.c.places.wayang; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/bumboat/i.test(tl) || /Changi/i.test(tl), `${name}: from Chinatown a pin on Ubin is planned via Changi and the bumboat ("${tl.replace(/\n/g, ' ')}")`); await look('plaque: chinatown to ubin');
  await at('ferry-cv', 0, 50); await W(() => { const w = window.__jade.world(); w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl2 = await loc('travel-label').innerText().catch(() => '');
  check(/bumboat/i.test(tl2), `${name}: at Changi Point the plaque says bumboat ("${tl2.replace(/\n/g, ' ')}")`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── the bumboat by its jetty: E, the hail pose, the crossing, step out on Ubin
  const nf = await at('ferry-cv', 0, 50); check(nf?.kind === 'ferry' && /bumboat/i.test(nf?.label ?? ''), `${name}: the bumboat prompt at Changi Point: "${nf?.label}"`);
  await E(); check(await until(() => window.__seen17.has('boat-hail'), null, 2500), `${name}: E hails the bumboat (its own pose)`);
  check(await until(() => !!window.__jade.world().ferry, null, 4000), `${name}: the bumboat sets off`); await wait(1200); await look('bumboat crossing, the heroes aboard');
  check(await until(() => { const w = window.__jade.world(); return !w.ferry && window.__jade.district(Math.floor(w.p.x / 64), Math.floor(w.p.y / 64)) === 'pulau'; }, null, 15000), `${name}: the bumboat lands on Pulau Ubin`);
  await settle(); await free(); await look('ubin jetty');

  // ── the island: folk, the market, the safe house, a property
  check(await until(() => window.__jade.world().peds.some(q => window.__jade.district(Math.floor(q.x / 64), Math.floor(q.y / 64)) === 'pulau'), null, 6000), `${name}: wildlife townsfolk about on Ubin`);
  const nm = await at('mk-pulau'); check(nm?.kind === 'market', `${name}: the provision shop's prompt: "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the provision shop`); await wait(300); await look('market: ubin'); await press('close'); await free();
  const ns = await at('safe-ubin'); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the kampong safe house prompt: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await W(() => { window.__jade.world().s.rep.pulau = 40; }); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens the kampong safe house for sale`); await press('buy-safe'); await wait(300); }
  await free();
  for (const biz of ['ubinbikes', 'durianstall', 'kelongseafood']) {
    const nb = await W(id => window.__jade.toBiz(id), biz); check(nb?.kind === 'biz', `${name}: a property for sale on Ubin: "${nb?.label}"`);
    if (biz !== 'ubinbikes') continue;
    await E(); check(await appear('biz-panel') || await exists('biz-buy'), `${name}: E opens the property panel`);
    if (await exists('biz-buy')) { await press('biz-buy'); await wait(250); check(await W(id => window.__jade.world().s.biz[id].lvl >= 1, biz), `${name}: Buy buys the bicycle rental`); }
    await look('property: ubin bicycle rental'); if (await exists('close')) await press('close'); await free();
  }

  // ── the small pleasures, each by E with its own pose
  // a boar at its dig: shoo it
  const dig = await until(() => { const w = window.__jade.world(); return w.ubin.boars.find(b => b.st === 'root') ? true : false; }, null, 6000);
  check(dig, `${name}: the Tusker Boys root at their digs`);
  const bo = await W(() => { const w = window.__jade.world(), b = w.ubin.boars.find(b => b.st === 'root'); return [b.x, b.y]; });
  let nb = await stand(bo[0] + 46, bo[1]); check(nb?.kind === 'ubin' && /^shoo:/.test(nb.id), `${name}: the shoo prompt: "${nb?.label}"`);
  const cash0 = await W(() => window.__jade.world().s.cash);
  await E(); check(await until(() => window.__seen17.has('shoo'), null, 2000), `${name}: shoo plays its own pose`); await wait(700); await look('shooing a boar');
  check(await W(c => window.__jade.world().s.cash > c && window.__jade.world().s.stats.digs >= 1, cash0), `${name}: the boar bolts and leaves a find`);
  // a charge: stand on a track down from a rooting boar; step off when it paws (the hint says so)
  const charge = await W(() => {
    const w = window.__jade.world(), U = w.c.ubin, [a, b] = U.tracks[0], b0 = w.ubin.boars.find(q => q.st === 'root') ?? w.ubin.boars[0];
    b0.st = 'root'; b0.x = a[0]; b0.y = a[1]; w.ubin.cd = 0; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); w.placePlayer(a[0] + (b[0] - a[0]) / L * 210, a[1] + (b[1] - a[1]) / L * 210); w.p.act = null;
    return { horiz: Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) };
  });
  check(await until(() => window.__jade.world().ubin.boars.some(b => b.st === 'paw'), null, 4000), `${name}: a boar paws the ground at you down the track`); await look('a boar pawing');
  // step off the line, as the hint says
  const off = charge.horiz ? 'w' : 'd'; await p.keyboard.down(off); await wait(650); await p.keyboard.up(off);
  check(await until(() => window.__jade.world().ubin.boars.some(b => b.st === 'charge' || b.st === 'dizzy'), null, 3000), `${name}: it charges down the track`); await look('a boar charging');
  check(await until(() => window.__jade.world().ubin.boars.some(b => b.st === 'dizzy'), null, 3000), `${name}: it misses and ends up dizzy`);
  const dz = await W(() => { const b = window.__jade.world().ubin.boars.find(b => b.st === 'dizzy'); return b ? [b.x, b.y] : null; });
  if (dz) {
    nb = await stand(dz[0] + 40, dz[1]); check(nb?.kind === 'ubin' && /^grab:/.test(nb.id), `${name}: the catch prompt: "${nb?.label}"`);
    await E(); await wait(800); check(await W(() => window.__jade.world().s.stats.boars >= 1), `${name}: E catches the dizzy boar`); await look('caught a boar');
  }
  await free();
  // a durian tree: shake, catch, eat
  const dur = await W(() => window.__jade.world().c.ubin.durians[0]);
  nb = await stand(dur[0], dur[1] + 36); check(nb?.kind === 'ubin' && nb.id === 'durian', `${name}: the durian tree prompt: "${nb?.label}"`);
  await E(); for (const pose of ['tree-shake', 'catch', 'eat-durian']) { check(await until(n => window.__seen17.has(n), pose, 4000), `${name}: the ${pose} pose plays`); await look(`durian: ${pose}`); }
  await until(() => !window.__jade.world().p.act, null, 6000);
  check(await W(() => window.__jade.world().s.stats.durians >= 1), `${name}: the durian is eaten and counted`);
  // Jejawi Tower: look out
  const tw = await W(() => window.__jade.world().c.ubin.tower);
  nb = await stand(tw[0], tw[1] + 30); check(nb?.kind === 'ubin' && nb.id === 'spy', `${name}: the tower prompt: "${nb?.label}"`);
  await E(); check(await until(() => window.__seen17.has('spy'), null, 2000), `${name}: the binoculars pose plays`); await wait(900); await look('jejawi tower');
  await until(() => !window.__jade.world().p.act, null, 5000); check(await W(() => window.__jade.world().s.stats.spies >= 1), `${name}: the look-out is counted`);
  await free();

  // ── every chapter-ten job and the new Hawker Tales, played as a first-timer
  const state = (id = null) => W(id => {
    const J = window.__jade, w = J.world(), g = id && !w.run ? (w.cast || []).find(c => c.job === id) : null, q = s => document.querySelector(`[data-testid="${s}"]`);
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), view: !!q('ride-view'), branch: !!q('branch'), mini: window.__jadeMini ? (q('mini-lock') ? 'lock' : 'other') : null,
      run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null, x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act,
      near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null, ferry: !!w.ferry, to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, obj: o, giver: g ? [g.x, g.y] : null, onNet: (() => { const R = w.run, js = R?.js; if (!R || R.cur?.t !== 'trap' || !js || js.ph !== 2) return false; return js.set.some(i => !js.sprung.includes(i) && R.actors.some(a => a.kind === 'lured' && a.extra === 0 && Math.hypot(a.b.x - R.items[i].x, a.b.y - R.items[i].y) < 50)); })(), boostCd: w.p.boostCd };
  }, id);
  let held = new Set();
  const hold = async keys => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
  let stuckAt = null, side = 0;
  const steer = async s => {
    const keys = new Set(); if (s.to) { const dx = s.to[0] - s.x, dy = s.to[1] - s.y, l = Math.hypot(dx, dy) || 1; if (l > 20) { if (dx / l > 0.38) keys.add('d'); if (dx / l < -0.38) keys.add('a'); if (dy / l > 0.38) keys.add('s'); if (dy / l < -0.38) keys.add('w'); } }
    const now = Date.now();
    if (!keys.size || !stuckAt || Math.hypot(s.x - stuckAt.x, s.y - stuckAt.y) > 12) stuckAt = { x: s.x, y: s.y, t: now };
    else if (now - stuckAt.t > 1000 && now > side) side = now + 500;
    if (now < side) { const across = keys.has('a') || keys.has('d') ? ['w', 's'] : ['a', 'd']; keys.clear(); keys.add(across[Math.floor(side / 500) % 2]); if (now >= side - 40) stuckAt = null; }
    await hold(keys);
  };
  /** the lock mini-game, as a person plays it: hold Space while the pin rises, let go when it glows */
  const lock = async () => {
    for (let tries = 0; tries < 20 && !(await W(() => !window.__jadeMini || window.__jadeMini.g().done)); tries++) {
      await p.keyboard.down(' '); await until(() => { const g = window.__jadeMini?.g(); return !g || g.glowing() || g.pins[g.sel].h > 0.97; }, null, 4000); await p.keyboard.up(' '); await wait(150);
    }
  };
  const only = process.env.ONLY17 ? process.env.ONLY17.split(',') : null;
  async function play(id, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', fAt = 0;
    if (only && !only.includes(id)) { await W(id => window.__jade.world().s.done.push(id), id); return { won: true, fails: 0, secs: 0, skipped: true }; }
    if (process.env.TRACE17) console.log(`  [${id}] cast`, JSON.stringify(await W(() => { const w = window.__jade.world(); return { cast: (w.cast || []).filter(c => c.job).map(c => [c.id, c.job, Math.round(c.x), Math.round(c.y)]), ch: w.s.story.ch, run: w.run?.m.id ?? null }; })));
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id);
      // (before the job starts a person walks up to the giver waving it, not along the gold line to wherever it last led)
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE17) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      // (the branch cards: the first, which is the way the label already describes, as nets on m74)
      if (s.branch) { await hold(new Set()); await p.locator('[data-testid^="branch-"]').first().click(); await wait(300); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.mini === 'lock') { await hold(new Set()); await lock(); continue; }
      if (s.run === id) started = true;
      if (started && s.run !== id) { await hold(new Set()); const won = await W(id => window.__jade.world().s.done.includes(id), id); return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      // (a ride: the one the hint names, as a person reading "hop on a rental bike" picks a bike, not the tandem beside it)
      const want = /tandem/i.test(s.hint) ? 'tandem' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && ((s.near.kind === 'mission' && s.near.id === id) || s.near.kind === 'job' || (s.near.kind === 'ferry' && s.step === 'cable' && !s.ferry) || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      // (a net: spring it the moment a boar stands on one, as the label says)
      if (s.onNet && ready) { await hold(new Set()); await key('f', 150); lastKey = Date.now(); continue; }
      // (the sack swap: E when a guard is looking away ("Go!"); otherwise send the partner to distract them (F, the game's
      // own tip) and swap while they stare)
      if (s.step === 'swap' && s.near?.kind === 'job' && ready) {
        if (/^Go!/.test(s.hint) || now - fAt < 3000) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
        if (now - fAt > 8000) { await hold(new Set()); await key('f', 200); fAt = Date.now(); lastKey = 0; continue; }
        await hold(new Set()); await wait(120); continue;
      }
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      if (ready && /^F: /.test(s.hint)) { await key('f', 150); lastKey = Date.now(); }
      // ("pedal under each tree and press F": a person presses F once they are under the one the gold line points at)
      if (ready && s.ride && /press F/.test(s.hint) && s.to && Math.hypot(s.to[0] - s.x, s.to[1] - s.y) < 150) { await key('f', 150); lastKey = Date.now(); }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
      // (a tail, as the label says: keep back from the one you follow, keep them in sight, and Tab when it says to)
      if (s.step === 'tail') {
        if (ready && /\(Tab\)/.test(s.hint) && /knows your face/.test(s.hint)) { await hold(new Set()); await key('Tab', 300); lastKey = Date.now(); continue; }
        if (s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 280) { await hold(new Set()); await wait(120); continue; }
      }
      if (/^Wait for|^Here they come|wait for them|Hold the stage/i.test(s.hint) && !s.to) { await hold(new Set()); await wait(150); continue; }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs };
  }
  /** stand a little way from a giver, as if just arrived, and play their job */
  const arrive = async (place, dx = 0) => {
    await W(([g, dx]) => { const w = window.__jade.world(), pl = w.c.places[g]; w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.placePlayer(pl.x + dx, pl.y + (dx ? 80 : 56)); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [place, dx]);
    await wait(500); await free();
  };
  // (each job's giver, from lib/jade-story.ts: Pak Ubin waits at Changi Point, the rest on the island)
  const GIVER = { m66: 'ubin', m67: 'ayu', m68: 'lan', m69: 'lan', m70: 'belangkas', m71: 'belangkas', m72: 'ayu', m73: 'ayu', m74: 'lan', m75: 'belangkas', k24: 'bikes-ubin', k25: 'chekjawa', k26: 'orchard-ubin' };
  const results = {};
  for (const id of [...TEN, ...TALES]) {
    await arrive(GIVER[id], id === 'm66' ? -200 : 0);
    const r = await play(id, id === 'm66' ? 300 : id === 'm72' ? 360 : 260); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (id === 'm67') check(await seen('read'), `${name}: reading hoof prints plays its own pose`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  // the chapter ends on a hook, not an ending: the junk's text, and no finale card
  check(await W(() => window.__jade.world().s.msgs.some(m => /black-sailed junk/.test(m.text))), `${name}: Uncle Belangkas's text about the black-sailed junk (a hook)`);
  check(!(await exists('jade-ending')), `${name}: no ending after Kampong Spirit`);
  for (const n of ['read', 'boat-hail', 'shoo', 'tree-shake', 'catch', 'eat-durian', 'spy', 'ride:bike']) check(await seen(n), `${name}: ${n} was seen`);
  return results;
}
