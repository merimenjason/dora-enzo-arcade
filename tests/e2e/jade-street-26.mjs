// Jade Street in the browser, the twenty-sixth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Toa Payoh grows north into Bishan and Ang Mo Kio, and chapter seventeen, "Red-Haired Man’s Bridge".
// Chapter sixteen's hook opens the district (a text from Mr Kamal, chapter seventeen's card); the plaque plans a trip
// there from Toa Payoh by the MRT; the district is walked (the market, the safe house); the small pleasures by E with
// their own poses (blitz chess at the AMK void deck, a carton slide down the park's grassy bank); then every
// chapter-seventeen job, the three new Hawker Tales and the kopi round played the way a first-timer plays them: nothing is
// teleported once a job is on offer, the player follows the gold line, reads the on-screen hint and the E prompt, and
// presses only what they name. On the stepping stones they press E when the hint says Calm (or says get off a low stone)
// and otherwise stand and wait. The stone poses and the Koel Boys on watch are checked drawn on the way. It ends on a
// hook: no ending.
export async function twentySixth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(300); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id ?? null, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen26.has(n), n);
  await W(() => {
    window.__seen26 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen26.add(w.p.act.n); if (w.p.anim) window.__seen26.add(w.p.anim); if (w.p.ride) window.__seen26.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen26.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });

  const SEVENTEEN = ['m136', 'm137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145'], TALES = ['k59', 'k60', 'k61'];
  const OPENS = 'm135'; // chapter sixteen's last job (lib/jade-story.ts BISHAN_OPENS)

  // ── chapter sixteen's hook opens Bishan and Ang Mo Kio: a text, chapter seventeen's card
  const n0 = await W(([LATER, OPENS]) => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id) && id !== OPENS); w.s.story.ch = 16; w.s.cash = 5000;
    w.open.delete('bishan'); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start(OPENS); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump();
    J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id));
    for (const k of Object.keys(w.s.best)) if (k === 'gig:amk-kopi') delete w.s.best[k];
    w.s.settings.partner = 'tag'; w.s.settings.assist = true; w.s.settings.diff = 'normal'; return n;
  }, [[...SEVENTEEN, ...TALES], OPENS]);
  check(await W(() => window.__jade.world().open.has('bishan')), `${name}: chapter sixteen's hook opens Bishan and Ang Mo Kio`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Bishan/.test(m.text) && /Kamal/.test(m.text)), n0), `${name}: Mr Kamal texts about Bishan and Ang Mo Kio`);
  if (await appear('jade-chapter-card')) {
    check(/Red-Haired/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Red-Haired Man’s Bridge`); await wait(400); await look('chapter seventeen');
    check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-17/.test(im.src); }), `${name}: the card's painting is chapter seventeen's`);
    await press('jade-story-skip'); await settle();
  } else check(false, `${name}: chapter seventeen's card`);
  check(await W(() => window.__jade.world().s.story.ch === 17), `${name}: chapter seventeen is under way`);

  // ── the plaque plans the trip: a pin on the survey stone from Toa Payoh goes by the MRT
  await at('stn-toapayoh', 90, 60);
  await W(() => { const w = window.__jade.world(), pl = w.c.places['bs-survey']; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/MRT|Bishan|station/i.test(tl), `${name}: from Toa Payoh a pin in Bishan-Ang Mo Kio Park is planned by the MRT ("${tl.replace(/\n/g, ' ')}")`); await look('plaque: toa payoh to bishan');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── Bishan and Ang Mo Kio: the market, the safe house
  await at('stn-bishan', 0, 60); await settle(); await look('bishan station');
  const nm = await at('mk-bishan'); check(nm?.kind === 'market', `${name}: the Ang Mo Kio market's prompt: "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the market`); await wait(300); await look('market: ang mo kio'); await press('close'); await free();
  const ns = await at('safe-bishan'); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the Bishan flat's prompt: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await W(() => { window.__jade.world().s.rep.bishan = 40; }); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens the Bishan flat for sale`); await press('buy-safe'); await wait(300); }
  await free();
  await at('bs-holt', 0, 60); await wait(600); await look('the otters on the river');

  // ── the small pleasures, each by E with its own pose
  const K = await W(() => { const c = window.__jade.world().c.bishan; return { chess: [c.chess[0] - 46, c.chess[1] + 12], bank: c.bank[0] }; });
  for (const [what, xy, id, pose, stat, ms] of [['the void-deck chess table', K.chess, 'chess', 'blitz', 'blitz', 5000], ['the grassy bank', K.bank, 'slide', 'bankslide', 'bankslides', 5000]]) {
    const nk = await stand(xy[0], xy[1]); check(nk?.kind === 'bishan' && nk.id === id, `${name}: ${what}'s prompt: "${nk?.label}"`);
    await E(); check(await until(p => window.__seen26.has(p), pose, 2000), `${name}: ${what} plays its own pose (${pose})`); await wait(500); await look(what);
    await until(() => !window.__jade.world().p.act, null, ms); check(await W(s => window.__jade.world().s.stats[s] >= 1, stat), `${name}: ${what} is counted`);
    await free();
  }

  // ── every chapter-seventeen job, the new Hawker Tales and the side gig, played as a first-timer
  const state = (id, gig) => W(([id, gig]) => {
    const J = window.__jade, w = J.world(), q = s => document.querySelector(`[data-testid="${s}"]`);
    const g = !w.run ? (gig ? w.gigs().find(b => b.id === id) : (w.cast || []).find(c => c.job === id)) : null;
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    // (the coral heads: drawn on the reef as dark rocks, ringed in gold once the tide turns)
    const rocks = w.c.islands?.rocks ?? [], rock = rocks.length ? rocks.reduce((a, b) => Math.hypot(b[0] - w.p.x, b[1] - w.p.y) < Math.hypot(a[0] - w.p.x, a[1] - w.p.y) ? b : a) : null;
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), view: !!q('ride-view'), branch: !!q('branch'), mrt: !!q('mrt'), mini: window.__jadeMini ? (q('mini-lock') ? 'lock' : 'other') : null,
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
  const only = process.env.ONLY26 ? process.env.ONLY26.split(',') : null;
  async function play(id, gig, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', fAt = 0;
    const runId = gig ? 'gig-' + id : id;
    if (only && !only.includes(id)) { await W(([id, gig]) => { const w = window.__jade.world(); if (gig) w.s.best['gig:' + id] = 1; else w.s.done.push(id); }, [id, gig]); return { won: true, fails: 0, secs: 0, skipped: true }; }
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id, gig);
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE26) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { if (process.env.TRACE26 || process.env.WHY26) console.log(`    ${id} failed: step ${s.step} hint ${s.hint}`); fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      if (s.branch) { await hold(new Set()); await p.locator('[data-testid^="branch-"]').first().click(); await wait(300); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      // (the MRT map: the stop the hint names is marked as the plan; click it)
      if (s.mrt) { await hold(new Set()); const b = p.locator('[data-testid="mrt"] [data-plan="true"]:not([disabled]), [data-testid="mrt-stn-bishan"]:not([disabled])').first(); if (await b.count()) await b.click(); else await key('Escape', 200); await wait(600); continue; }
      if (s.mini === 'lock') { await hold(new Set()); await lock(); continue; }
      if (s.run === runId) started = true;
      if (started && s.run !== runId && !s.won) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== runId) { await hold(new Set()); const won = (await state(id, gig)).won; return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      const want = /kayak/i.test(s.hint) ? 'kayak' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && (s.near.kind === 'fine' || (s.near.kind === 'mission' && s.near.id === id) || (s.near.kind === 'gig' && s.near.id === id && !started) || s.near.kind === 'job' || (s.near.kind === 'station' && s.step === 'train')
        || (s.near.kind === 'ferry' && s.step === 'cable' && !s.ferry) || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      // (the crate swap: E when the hint says "Go!"; otherwise send the partner to distract the crab on watch (F) and swap)
      if (s.step === 'swap' && s.near?.kind === 'job' && ready) {
        if (/^Go!/.test(s.hint) || now - fAt < 3000) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
        if (now - fAt > 8000) { await hold(new Set()); await key('f', 200); fAt = Date.now(); lastKey = 0; continue; }
        await hold(new Set()); await wait(120); continue;
      }
      // (the stepping stones, as the hint and the River meter say: "Calm" or "SURGE! Off" or "RISING: hop on" says press E;
      // otherwise stand on the stone and wait for the water; off the stones, walk the gold line to the first one)
      if (s.step === 'stones' && s.near?.kind === 'job') {
        await hold(new Set());
        if (ready && /^Calm|^SURGE! Off|RISING: hop on|^Rising: hop on/.test(s.hint)) { await key('e', 300); lastKey = Date.now(); continue; }
        await wait(100); continue;
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
  const AT = { m136: 'kamal', m137: 'kura', m138: 'kura', m139: 'merbok', m140: 'puyuh', m141: 'merbok', m142: 'kijang', m143: 'kura', m144: 'kura', m145: 'kura', k59: 'kura', k60: 'puyuh', k61: 'kamal' };
  const results = {};
  for (const id of [...SEVENTEEN, ...TALES]) {
    const g = await W(p => { const pl = window.__jade.world().c.places[p]; return [pl.x, pl.y]; }, AT[id]);
    await arrive(g[0], g[1] + 70);
    const r = await play(id, false, id === 'm145' ? 420 : 300); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (id === 'm137') { for (const n of ['stone-hop', 'stone-land']) check(await seen(n), `${name}: the stepping stones play their own pose (${n})`); }
    if (id === 'm138') check(await seen('skin:koel'), `${name}: the Koel Boys keep watch`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  {
    const b = await W(() => { const g = window.__jade.world().gigs().find(g => g.id === 'amk-kopi'); return g && [g.x, g.y]; });
    check(!!b, `${name}: the AMK kopi round's flag is up`);
    if (b) {
      await arrive(b[0], b[1] + 70);
      const r = await play('amk-kopi', true, 240); results['amk-kopi'] = r;
      check(r.won, `${name}: a first-timer finishes the kopi round from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
      await look('gig amk-kopi done');
    }
  }
  // the chapter ends on a hook, not an ending: Pak Camar's text about the junk turning east to Horsburgh Light, no finale card
  check(await W(() => window.__jade.world().s.msgs.some(m => /junk/.test(m.text) && /Horsburgh/.test(m.text))), `${name}: Pak Camar's text about Horsburgh Light (a hook)`);
  check(!(await exists('jade-ending')), `${name}: no ending after Red-Haired Man’s Bridge`);
  return results;
}
