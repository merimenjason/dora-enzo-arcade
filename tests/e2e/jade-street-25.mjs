// Jade Street in the browser, the twenty-fifth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Punggol and Coney Island and chapter sixteen, "King Tide". Chapter fifteen's finale opens the district
// (a text from Pak Camar, chapter sixteen's card); the plaque plans a trip there by the MRT; the district is walked (the
// kopitiam, the safe house, a property); the small pleasures by E with their own poses (fishing off the jetty, the view
// across to Ubin); then every chapter-sixteen job, the three new Hawker Tales and the park connector loop played the way a
// first-timer plays them: nothing is teleported once a job is on offer, the player follows the gold line, reads the
// on-screen hint and the E prompt, and presses only what they name. Herding, they walk round to the green arc drawn
// behind the cow and keep to it, step back out when the hint says too close, and wait while she bolts. The herding poses
// and the Pucong Boys on watch are checked drawn on the way. It ends on a hook: no ending.
export async function twentyFifth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(300); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id ?? null, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen25.has(n), n);
  await W(() => {
    window.__seen25 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen25.add(w.p.act.n); if (w.p.anim) window.__seen25.add(w.p.anim); if (w.p.ride) window.__seen25.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen25.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });

  const SIXTEEN = ['m126', 'm127', 'm128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135'], TALES = ['k56', 'k57', 'k58'];
  const OPENS = 'm125'; // chapter fifteen's finale (lib/jade-story.ts PUNGGOL_OPENS)

  // ── chapter fifteen's finale opens Punggol and Coney Island: a text, chapter sixteen's card
  const n0 = await W(([LATER, OPENS]) => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id) && id !== OPENS); w.s.story.ch = 15; w.s.cash = 5000;
    w.open.delete('punggol'); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start(OPENS); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump();
    J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id));
    for (const k of Object.keys(w.s.best)) if (k === 'gig:pcn-loop') delete w.s.best[k];
    w.s.settings.partner = 'tag'; w.s.settings.assist = true; w.s.settings.diff = 'normal'; return n;
  }, [[...SIXTEEN, ...TALES], OPENS]);
  check(await W(() => window.__jade.world().open.has('punggol')), `${name}: chapter fifteen's finale opens Punggol and Coney Island`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Punggol/.test(m.text) && /Pekaka/.test(m.text)), n0), `${name}: Pak Camar texts about the Punggol datum and Puan Pekaka`);
  if (await appear('jade-chapter-card')) {
    check(/King Tide/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names King Tide`); await wait(400); await look('chapter sixteen');
    check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-16/.test(im.src); }), `${name}: the card's painting is chapter sixteen's`);
    await press('jade-story-skip'); await settle();
  } else check(false, `${name}: chapter sixteen's card`);
  check(await W(() => window.__jade.world().s.story.ch === 16), `${name}: chapter sixteen is under way`);
  check(await W(() => { const J = window.__jade; return J.jobs().side > 0 && J.jobs().story > 0; }), `${name}: the story and tale counts come from the data`);

  // ── the plaque plans the trip: a pin on the old tide gauge from Chinatown goes by the MRT
  await at('safe-market', 0, 64);
  await W(() => { const w = window.__jade.world(), pl = w.c.places['pg-gauge']; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/MRT|Punggol|station/i.test(tl), `${name}: from Chinatown a pin on Punggol Point is planned by the MRT ("${tl.replace(/\n/g, ' ')}")`); await look('plaque: chinatown to punggol');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── Punggol and Coney Island: the kopitiam, the safe house, a property
  await at('stn-punggol', 0, 60); await settle(); await look('punggol station');
  const nm = await at('mk-punggol'); check(nm?.kind === 'market', `${name}: the Punggol Point kopitiam's prompt: "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the kopitiam`); await wait(300); await look('market: punggol point kopitiam'); await press('close'); await free();
  const ns = await at('safe-punggol'); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the Punggol flat's prompt: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await W(() => { window.__jade.world().s.rep.punggol = 40; }); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens the Punggol flat for sale`); await press('buy-safe'); await wait(300); }
  await free();
  for (const biz of ['crabhouse', 'coneykiosk', 'kayakhire']) {
    const nb = await W(id => window.__jade.toBiz(id), biz); check(nb?.kind === 'biz', `${name}: a property for sale in Punggol: "${nb?.label}"`);
    if (biz !== 'coneykiosk') continue;
    await E(); check(await appear('biz-panel') || await exists('biz-buy'), `${name}: E opens the property panel`);
    if (await exists('biz-buy')) { await press('biz-buy'); await wait(250); check(await W(id => window.__jade.world().s.biz[id].lvl >= 1, biz), `${name}: Buy buys the Coney Island kiosk`); }
    await look('property: coney island drinks kiosk'); if (await exists('close')) await press('close'); await free();
  }

  // ── the small pleasures, each by E with its own pose
  const K = await W(() => { const c = window.__jade.world().c.punggol; return { jetty: c.jetty, lookout: c.lookout }; });
  for (const [what, xy, id, pose, stat, ms] of [['the jetty end', K.jetty, 'fish', 'fish', 'fishes', 5000], ['the Promenade', K.lookout, 'view', 'lookout', null, 5000]]) {
    const nk = await stand(xy[0], xy[1]); check(nk?.kind === 'punggol' && nk.id === id, `${name}: ${what}'s prompt: "${nk?.label}"`);
    await E(); check(await until(p => window.__seen25.has(p), pose, 2000), `${name}: ${what} plays its own pose (${pose})`); await wait(700); await look(what);
    await until(() => !window.__jade.world().p.act, null, ms); if (stat) check(await W(s => window.__jade.world().s.stats[s] >= 1, stat), `${name}: ${what} is counted`);
    await free();
  }

  // ── every chapter-sixteen job, the new Hawker Tales and the side gig, played as a first-timer
  const state = (id, gig) => W(([id, gig]) => {
    const J = window.__jade, w = J.world(), q = s => document.querySelector(`[data-testid="${s}"]`);
    const g = !w.run ? (gig ? w.gigs().find(b => b.id === id) : (w.cast || []).find(c => c.job === id)) : null;
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    // (the coral heads: drawn on the reef as dark rocks, ringed in gold once the tide turns)
    const rocks = w.c.islands?.rocks ?? [], rock = rocks.length ? rocks.reduce((a, b) => Math.hypot(b[0] - w.p.x, b[1] - w.p.y) < Math.hypot(a[0] - w.p.x, a[1] - w.p.y) ? b : a) : null;
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), view: !!q('ride-view'), branch: !!q('branch'), mini: window.__jadeMini ? (q('mini-lock') ? 'lock' : 'other') : null,
      run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null, x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act, boostCd: w.p.boostCd ?? 0, ferry: !!w.ferry,
      near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null, to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, obj: o, giver: g ? [g.x, g.y] : null, rock,
      won: gig ? !!w.s.best['gig:' + id] : w.s.done.includes(id),
      // (on a herding job: the green arc drawn behind the cow, where to stand, and the two rings round her)
      arc: w.run?.cur?.t === 'herd' ? (J.play.scene.herdArc ?? null) : null };
  }, [id, gig]);
  let held = new Set();
  const hold = async keys => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
  let stuckAt = null, side = 0;
  const steer = async (s, extra = []) => {
    const keys = new Set(); if (s.to) { const dx = s.to[0] - s.x, dy = s.to[1] - s.y, l = Math.hypot(dx, dy) || 1; if (l > 20) { if (dx / l > 0.38) keys.add('d'); if (dx / l < -0.38) keys.add('a'); if (dy / l > 0.38) keys.add('s'); if (dy / l < -0.38) keys.add('w'); } }
    const now = Date.now();
    if (!keys.size || !stuckAt || Math.hypot(s.x - stuckAt.x, s.y - stuckAt.y) > 12) stuckAt = { x: s.x, y: s.y, t: now };
    else if (now - stuckAt.t > 1000 && now > side) side = now + 500;
    if (now < side) { const across = keys.has('a') || keys.has('d') ? ['w', 's'] : ['a', 'd']; keys.clear(); keys.add(across[Math.floor(side / 500) % 2]); if (now >= side - 40) stuckAt = null; }
    for (const k of extra) keys.add(k);
    await hold(keys);
  };
  const lock = async () => {
    for (let tries = 0; tries < 20 && !(await W(() => !window.__jadeMini || window.__jadeMini.g().done)); tries++) {
      await p.keyboard.down(' '); await until(() => { const g = window.__jadeMini?.g(); return !g || g.glowing() || g.pins[g.sel].h > 0.97; }, null, 4000); await p.keyboard.up(' '); await wait(150);
    }
  };
  const only = process.env.ONLY25 ? process.env.ONLY25.split(',') : null;
  async function play(id, gig, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', fAt = 0;
    const runId = gig ? 'gig-' + id : id;
    if (only && !only.includes(id)) { await W(([id, gig]) => { const w = window.__jade.world(); if (gig) w.s.best['gig:' + id] = 1; else w.s.done.push(id); }, [id, gig]); return { won: true, fails: 0, secs: 0, skipped: true }; }
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id, gig);
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE25) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { if (process.env.TRACE25 || process.env.WHY25) console.log(`    ${id} failed: step ${s.step} hint ${s.hint}`); fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      if (s.branch) { await hold(new Set()); await p.locator('[data-testid^="branch-"]').first().click(); await wait(300); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.mini === 'lock') { await hold(new Set()); await lock(); continue; }
      if (s.run === runId) started = true;
      if (started && s.run !== runId && !s.won) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== runId) { await hold(new Set()); const won = (await state(id, gig)).won; return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      const want = /kayak/i.test(s.hint) ? 'kayak' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && (s.near.kind === 'fine' || (s.near.kind === 'mission' && s.near.id === id) || (s.near.kind === 'gig' && s.near.id === id && !started) || s.near.kind === 'job'
        || (s.near.kind === 'ferry' && s.step === 'cable' && !s.ferry) || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      // (the crate swap: E when the hint says "Go!"; otherwise send the partner to distract the crab on watch (F) and swap)
      if (s.step === 'swap' && s.near?.kind === 'job' && ready) {
        if (/^Go!/.test(s.hint) || now - fAt < 3000) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
        if (now - fAt > 8000) { await hold(new Set()); await key('f', 200); fAt = Date.now(); lastKey = 0; continue; }
        await hold(new Set()); await wait(120); continue;
      }
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      if (ready && /^F: /.test(s.hint)) { await key('f', 150); lastKey = Date.now(); }
      // (walking into a hedge, the HUD says "Q hops the hedge": so hop)
      if (ready && /^Q hops the hedge/.test(s.hint)) { await key('q', 120); lastKey = Date.now(); }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
      if (s.step === 'chase' && /Space dashes/.test(s.hint) && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 110 && ready) { await key(' ', 60); lastKey = Date.now(); }
      if (s.step === 'tail' && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 280) { await hold(new Set()); await wait(120); continue; }
      // (a mudflat crossing, as the hint says: go while the crocodiles doze; "stirring", "FREEZE" or "watching" says stop
      // and stand still; "Scrambling" says wait)
      if (s.step === 'mud' && !/^Crocs dozing/.test(s.hint) && !(s.near?.kind === 'job' && ready)) { await hold(new Set()); await wait(100); continue; }
      // (herding, as the hint and the drawn rings say: "bolted" says wait; "Too close" says step straight back out of the
      // inner ring; otherwise walk round the outside of the inner ring to the green arc behind her, and keep to it)
      if (s.step === 'herd' && s.arc && !s.ride) {
        const [ax, ay, cx, cy, near, far] = s.arc;
        if (/bolted/.test(s.hint)) { await hold(new Set()); await wait(150); continue; }
        if (/Too close/.test(s.hint)) { const dx = s.x - cx, dy = s.y - cy, l = Math.hypot(dx, dy) || 1; s.to = [s.x + dx / l * 160, s.y + dy / l * 160]; await steer(s); await wait(90); continue; }
        const r = Math.hypot(ax - cx, ay - cy), back = Math.atan2(ay - cy, ax - cx), cur = Math.atan2(s.y - cy, s.x - cx);
        let da = cur - back; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const a = Math.abs(da) < 0.5 ? back : cur - Math.sign(da) * 0.5, rr = Math.abs(da) < 0.5 ? r : Math.max(r, near * 1.6);
        s.to = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
        if (Math.hypot(s.to[0] - s.x, s.to[1] - s.y) < 26) { await hold(new Set()); await wait(90); continue; }
        await steer(s); await wait(90); continue;
      }
      if (/^Wait for|^Here they come|wait for them|Hold the/i.test(s.hint) && !s.to) { await hold(new Set()); await wait(150); continue; }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs: (Date.now() - t0) / 1000 };
  }
  const arrive = async (x, y) => {
    await W(([x, y]) => { const w = window.__jade.world(); w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.placePlayer(x, y); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [x, y]);
    await wait(500); await free();
  };
  // (each job's place, from lib/jade-story.ts)
  const AT = { m126: 'pekaka', m127: 'bubut', m128: 'bubut', m129: 'berang', m130: 'tempua', m131: 'tempua', m132: 'bubut', m133: 'pekaka', m134: 'berang', m135: 'pekaka', k56: 'berang', k57: 'bubut', k58: 'berang' };
  const results = {};
  for (const id of [...SIXTEEN, ...TALES]) {
    const g = await W(p => { const pl = window.__jade.world().c.places[p]; return [pl.x, pl.y]; }, AT[id]);
    await arrive(g[0], g[1] + 70);
    const r = await play(id, false, id === 'm135' ? 420 : 300); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (id === 'm127') { for (const n of ['herd', 'herd-still']) check(await seen(n), `${name}: herding plays its own pose (${n})`); }
    if (id === 'm128') check(await seen('skin:pucong'), `${name}: the Pucong Boys keep watch`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  {
    const b = await W(() => { const g = window.__jade.world().gigs().find(g => g.id === 'pcn-loop'); return g && [g.x, g.y]; });
    check(!!b, `${name}: the park connector loop's flag is up`);
    if (b) {
      await arrive(b[0], b[1] + 70);
      const r = await play('pcn-loop', true, 240); results['pcn-loop'] = r;
      check(r.won, `${name}: a first-timer finishes the park connector loop from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
      await look('gig pcn-loop done');
    }
  }
  // the chapter ends on a hook, not an ending: Pak Camar's text about the junk and the king tide, and no finale card
  check(await W(() => window.__jade.world().s.msgs.some(m => /junk/.test(m.text) && /Three nights/.test(m.text))), `${name}: Pak Camar's text about the junk (a hook)`);
  check(!(await exists('jade-ending')), `${name}: no ending after King Tide`);
  return results;
}
