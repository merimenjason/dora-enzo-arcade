// Jade Street in the browser, the nineteenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Mandai and chapter twelve, "Night Safari". Chapter eleven's finale opens Mandai (a text from Encik
// Kongkang, chapter twelve's card); the plaque plans a trip there by MRT to Mandai Lake Road; the district is walked (its
// market, safe house, a property, the night animals); the three small pleasures by E with their own poses (the Night
// Safari tram, the lories, the Creatures of the Night show); then every chapter-twelve job and the three new Hawker Tales
// played the way a first-timer plays them: nothing is teleported once a job is on offer, the player follows the gold
// line, reads the on-screen hint and the E prompt, and presses only what they name (Shift to creep when the torch trail's
// hint says an animal is near). The torch trail's own poses are checked drawn on the way, and the barn owls on watch. It
// ends on a hook: no ending.
export async function nineteenth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(300); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen19.has(n), n);
  await W(() => {
    window.__seen19 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen19.add(w.p.act.n); if (w.p.anim) window.__seen19.add(w.p.anim); if (w.p.ride) window.__seen19.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen19.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const TWELVE = ['m86', 'm87', 'm88', 'm89', 'm90', 'm91', 'm92', 'm93', 'm94', 'm95'], TALES = ['k30', 'k31', 'k32'];

  // ── chapter eleven's finale opens Mandai: a text, chapter twelve's card
  const n0 = await W(LATER => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id) && id !== 'm85'); w.s.story.ch = 11; w.s.story.lights = true; w.s.story.coast = true; w.s.story.lake = true; w.s.cash = 5000;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong', 'pulau', 'kallang']); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start('m85'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump();
    // (starting m85 replays the story up to it, which leaves the Hawker Tales undone: put back every earlier one)
    J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id));
    w.s.settings.partner = 'tag'; w.s.settings.assist = true; return n;
  }, [...TWELVE, ...TALES]);
  check(await W(() => window.__jade.world().open.has('mandai')), `${name}: Kallang Roar's finale opens Mandai`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Night Safari/.test(m.text) && /Mandai Lake Road/.test(m.text)), n0), `${name}: Encik Kongkang texts that Mandai is open, by MRT to Mandai Lake Road`);
  check(await appear('jade-chapter-card'), `${name}: chapter twelve's card`);
  check(/Night Safari/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names the Night Safari`); await wait(400); await look('chapter twelve');
  check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-12/.test(im.src); }), `${name}: the card's painting is chapter twelve's`);
  await press('jade-story-skip'); await settle();
  check(await W(() => window.__jade.world().s.story.ch === 12), `${name}: chapter twelve is under way`);
  check(await W(() => window.__jade.jobs().side) === 32 && await W(() => window.__jade.jobs().story) === 95, `${name}: 95 story jobs and 32 Hawker Tales, counted from the data`);

  // ── the plaque plans the trip: a pin on the Night Safari from Chinatown goes by MRT to Mandai Lake Road
  await at('safe-market', 0, 64);
  await W(() => { const w = window.__jade.world(), pl = w.c.places.safari; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/MRT|Mandai/i.test(tl), `${name}: from Chinatown a pin on the Night Safari is planned by MRT ("${tl.replace(/\n/g, ' ')}")`); await look('plaque: chinatown to mandai');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── Mandai: the night animals, the market, the safe house, a property
  await at('stn-mandai', 0, 60); await settle(); await look('mandai lake road station');
  check(await until(() => window.__jade.world().peds.some(q => window.__jade.district(Math.floor(q.x / 64), Math.floor(q.y / 64)) === 'mandai'), null, 6000), `${name}: night animals about in Mandai`);
  const nm = await at('mk-mandai'); check(nm?.kind === 'market', `${name}: the Mandai market's prompt: "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the Mandai market`); await wait(300); await look('market: mandai'); await press('close'); await free();
  const ns = await at('safe-mandai'); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the ranger hut safe house prompt: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await W(() => { window.__jade.world().s.rep.mandai = 40; }); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens the ranger hut safe house for sale`); await press('buy-safe'); await wait(300); }
  await free();
  for (const biz of ['safarishop', 'boardkopi', 'nectarbar']) {
    const nb = await W(id => window.__jade.toBiz(id), biz); check(nb?.kind === 'biz', `${name}: a property for sale in Mandai: "${nb?.label}"`);
    if (biz !== 'safarishop') continue;
    await E(); check(await appear('biz-panel') || await exists('biz-buy'), `${name}: E opens the property panel`);
    if (await exists('biz-buy')) { await press('biz-buy'); await wait(250); check(await W(id => window.__jade.world().s.biz[id].lvl >= 1, biz), `${name}: Buy buys the souvenir shop`); }
    await look('property: night safari souvenir shop'); if (await exists('close')) await press('close'); await free();
  }

  // ── the small pleasures, each by E with its own pose
  const M = await W(() => { const m = window.__jade.world().c.mandai; return { stop: m.stops[0], perch: m.perch, stage: m.stage }; });
  let nk = await stand(M.stop[0], M.stop[1]); check(nk?.kind === 'mandai' && nk.id === 'tram', `${name}: the tram stop's prompt: "${nk?.label}"`);
  await E(); check(await until(() => window.__seen19.has('tram'), null, 2000), `${name}: riding the tram plays its own pose`); await wait(1200); await look('the night safari tram');
  await until(() => !window.__jade.world().p.act, null, 8000); check(await W(() => window.__jade.world().s.stats.trams >= 1), `${name}: the tram ride is counted`);
  await free();
  nk = await stand(M.perch[0], M.perch[1]); check(nk?.kind === 'mandai' && nk.id === 'lory', `${name}: the lory perch's prompt: "${nk?.label}"`);
  await E(); check(await until(() => window.__seen19.has('lory'), null, 2000), `${name}: feeding the lories plays its own pose`); await wait(700); await look('feeding the lories');
  await until(() => !window.__jade.world().p.act, null, 5000); check(await W(() => window.__jade.world().s.stats.lories >= 1), `${name}: the lories are counted`);
  await free();
  nk = await stand(M.stage[0], M.stage[1]); check(nk?.kind === 'mandai' && nk.id === 'show', `${name}: the show's prompt: "${nk?.label}"`);
  await E(); check(await until(() => window.__seen19.has('clap'), null, 2000), `${name}: watching the show plays its own pose`); await wait(700); await look('creatures of the night show');
  await until(() => !window.__jade.world().p.act, null, 5000); check(await W(() => window.__jade.world().s.stats.shows >= 1), `${name}: the show is counted`);
  await free();

  // ── every chapter-twelve job and the new Hawker Tales, played as a first-timer
  const state = (id = null) => W(id => {
    const J = window.__jade, w = J.world(), g = id && !w.run ? (w.cast || []).find(c => c.job === id) : null, q = s => document.querySelector(`[data-testid="${s}"]`);
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), view: !!q('ride-view'), branch: !!q('branch'), mini: window.__jadeMini ? (q('mini-lock') ? 'lock' : 'other') : null, mrt: !!q('mrt'),
      run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null, x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act,
      near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null, ferry: !!w.ferry, to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, obj: o, giver: g ? [g.x, g.y] : null, onNet: (() => { const R = w.run, js = R?.js; if (!R || R.cur?.t !== 'trap' || !js || js.ph !== 2) return false; return js.set.some(i => !js.sprung.includes(i) && R.actors.some(a => a.kind === 'lured' && a.extra === 0 && Math.hypot(a.b.x - R.items[i].x, a.b.y - R.items[i].y) < 50)); })(), boostCd: w.p.boostCd };
  }, id);
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
  /** the lock mini-game, as a person plays it: hold Space while the pin rises, let go when it glows */
  const lock = async () => {
    for (let tries = 0; tries < 20 && !(await W(() => !window.__jadeMini || window.__jadeMini.g().done)); tries++) {
      await p.keyboard.down(' '); await until(() => { const g = window.__jadeMini?.g(); return !g || g.glowing() || g.pins[g.sel].h > 0.97; }, null, 4000); await p.keyboard.up(' '); await wait(150);
    }
  };
  const only = process.env.ONLY19 ? process.env.ONLY19.split(',') : null;
  async function play(id, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', fAt = 0;
    if (only && !only.includes(id)) { await W(id => window.__jade.world().s.done.push(id), id); return { won: true, fails: 0, secs: 0, skipped: true }; }
    if (process.env.TRACE19) console.log(`  [${id}] tales done`, JSON.stringify(await W(() => window.__jade.world().s.done.filter(x => /^k/.test(x)))));
    if (process.env.TRACE19) console.log(`  [${id}] cast`, JSON.stringify(await W(() => { const w = window.__jade.world(); return { cast: (w.cast || []).filter(c => c.job).map(c => [c.id, c.job, Math.round(c.x), Math.round(c.y)]), ch: w.s.story.ch, run: w.run?.m.id ?? null }; })));
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id);
      // (before the job starts a person walks up to the giver waving it, not along the gold line to wherever it last led)
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE19) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      // (the branch cards: the first, which is the way the label already describes, as nets on m74)
      if (s.branch) { await hold(new Set()); await p.locator('[data-testid^="branch-"]').first().click(); await wait(300); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.mini === 'lock') { await hold(new Set()); await lock(); continue; }
      // (the MRT gates: the stop the plan marks, as a person reading "take the MRT to Mandai Lake Road" picks that stop)
      if (s.mrt) { await hold(new Set()); const b = p.locator('[data-testid="mrt"] [data-plan="true"]:not([disabled]), [data-testid="mrt-stn-mandai"]:not([disabled])').first(); if (await b.count()) await b.click(); else await key('Escape', 200); await wait(600); continue; }
      if (s.run === id) started = true;
      // (a job that has just failed leaves the run a frame before its card shows: look again for the card's Retry)
      if (started && s.run !== id && !(await W(id => window.__jade.world().s.done.includes(id), id))) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== id) { await hold(new Set()); const won = await W(id => window.__jade.world().s.done.includes(id), id); return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      // (a ride: the one the hint names, as a person reading "step into a dragon boat" picks a dragon boat, not the sampan beside it)
      const want = /dragon boat/i.test(s.hint) ? 'dragon' : /tandem/i.test(s.hint) ? 'tandem' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && ((s.near.kind === 'mission' && s.near.id === id) || s.near.kind === 'job' || (s.near.kind === 'station' && s.step === 'train') || (s.near.kind === 'ferry' && s.step === 'cable' && !s.ferry) || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
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
      // (a chase whose hint says "Space dashes": a dash when the one you chase is close)
      if (s.step === 'chase' && /Space dashes/.test(s.hint) && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 110 && ready) { await key(' ', 60); lastKey = Date.now(); }
      if (process.env.TRACE19 && s.step === 'chase' && Math.random() < 0.05) console.log(`    chase p ${s.x.toFixed(0)},${s.y.toFixed(0)} obj ${s.obj?.map(v => v.toFixed(0))} to ${s.to?.map(v => v.toFixed(0))}`);
      // (a tail, as the label says: keep back from the one you follow, keep them in sight, and Tab when it says to)
      if (s.step === 'tail') {
        if (ready && /\(Tab\)/.test(s.hint) && /knows your face/.test(s.hint)) { await hold(new Set()); await key('Tab', 300); lastKey = Date.now(); continue; }
        if (s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 280) { await hold(new Set()); await wait(120); continue; }
      }
      // (a crowd, as the hint says: stand still at the edge while it says "Wait", walk on when it says "Go!" or "Squeeze")
      if (s.step === 'crowd' && /^Wait at the edge/.test(s.hint)) { await hold(new Set()); await wait(60); continue; }
      // (a torch trail, as the hint says: when it names an animal near, hold Shift and creep; "stirring" says stand still
      // till it settles (or creep), so a person stops a moment)
      if (s.step === 'torch' && /stirring/.test(s.hint)) { await hold(new Set()); await wait(400); continue; }
      if (s.step === 'torch' && /Shh|[Cc]reep|hold Shift|Hold Shift/.test(s.hint) && !/^Follow|^Walk|^Lead|^Take/.test(s.hint)) { await steer(s, ['Shift']); await wait(90); continue; }
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
  // (each job's giver, from lib/jade-story.ts)
  const GIVER = { m86: 'kubung', m87: 'kongkang', m88: 'kongkang', m89: 'enggang', m90: 'bintu', m91: 'bintu', m92: 'kongkang', m93: 'kongkang', m94: 'enggang', m95: 'kongkang', k30: 'aviary', k31: 'safari', k32: 'boardwalk' };
  const results = {};
  for (const id of [...TWELVE, ...TALES]) {
    await arrive(GIVER[id]);
    const r = await play(id, id === 'm95' ? 420 : 300); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (id === 'm87') check(await seen('torch'), `${name}: the torch trail plays its own creeping pose`);
    if (id === 'm88') check(await seen('skin:owl'), `${name}: barn owls keep watch`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  // the chapter ends on a hook, not an ending: Encik Kongkang's text about bearing 182 and the lighthouse, and no finale card
  check(await W(() => window.__jade.world().s.msgs.some(m => /lighthouse/i.test(m.text))), `${name}: Encik Kongkang's text about the lighthouse (a hook)`);
  check(!(await exists('jade-ending')), `${name}: no ending after the Night Safari`);
  for (const n of ['torch', 'tram', 'lory', 'clap']) check(await seen(n), `${name}: ${n} was seen`);
  return results;
}
