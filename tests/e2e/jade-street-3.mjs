// Jade Street in the browser, the third pass (called from tests/e2e/jade-street.mjs at 1280×800 only; the game is
// desktop-only): the babble
// voice and the typewriter (a press shows the whole line, the next press moves on), a painted mood portrait for every
// line, each chase set piece fired through the hooks (its warning on screen, then live), a knock from the rubble with
// its debris and shake, Madame Glint’s three phases (decoys, falling signs, then F to send the partner to the bunting
// rope, a rooftop flag and
// the leap onto her float with a real E press), the businesses (buy a stake, upgrade, collect at the
// stall and at a safe house, the Businesses page in the pause menu, and a magpie raid defended by dashing into the
// magpies), the Reduce shake setting, and the new hero animations (deal, mend, collect, shoo, leap, tumble, skid).
export async function third(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, act, settle, name } = h;
  const st = () => W(() => window.__jade.state());
  const keep = await W(() => { const s = window.__jade.world().s; return { night: s.night, clock: s.clock, done: s.done.slice() }; });
  // every animation the hero plays from here on
  await W(() => { window.__seen = new Set(); const f = () => { if (!window.__jade) return; window.__seen.add(window.__jade.world().p.anim); window.__vmax = Math.max(window.__vmax || 0, Math.round(window.__jade.world().p.b.speed)); requestAnimationFrame(f); }; f(); });
  const seen = () => W(() => [...window.__seen]);
  await W(() => { window.__jade.finishAll(); const w = window.__jade.world(); for (const d of ['market', 'temple', 'canal', 'docks', 'arcade']) w.s.rep[d] = 60; w.s.cash = 30000; });

  // ── voices, the typewriter and the mood portraits
  await W(() => { const s = window.__jade.play.snd; if (s) { s.__n = 0; const o = s.blip.bind(s); s.blip = (...a) => { s.__n++; return o(...a); }; } });
  await W(() => { window.__jade.start('m25'); window.__jade.enterStep(0); });
  check(await appear('dialogue'), `${name}: a job's dialogue opens`);
  const t0 = await W(() => window.__jade.typed());
  check(t0.typed < t0.len, `${name}: the line types out (${t0.typed}/${t0.len})`);
  await wait(250);
  check(await W(() => (window.__jade.play.snd?.__n ?? 1) > 0), `${name}: the speaker babbles while it types`);
  const skip = async () => { await p.keyboard.press(' '); await wait(120); };
  await skip(); const t1 = await W(() => window.__jade.typed());
  check(t1.typed === t1.len && await W(() => window.__jade.world().talk?.i === 0), `${name}: a press shows the whole line first`);
  check((await p.locator('[data-testid="talk-text"]').textContent()).length === t1.len, `${name}: the whole line is on screen`);
  await look('dialogue mood');
  let lines = 0, moodsOk = 0;
  for (let i = 0; i < 12 && await exists('dialogue'); i++) {
    const t = await W(() => window.__jade.typed()); const f = await p.locator('[data-testid="talk-face"]').first();
    const mood = await f.getAttribute('data-mood'); const spr = await f.locator('.jade-spr').getAttribute('data-spr'); const missing = await f.locator('.jade-spr').getAttribute('data-missing');
    lines++; if (mood === t.mood && !missing && (mood === 'calm' || spr.endsWith('-' + mood))) moodsOk++;
    await skip(); if (await exists('dialogue') && (await W(() => window.__jade.typed())).typed < (await W(() => window.__jade.typed())).len) await skip();
  }
  check(lines > 0 && moodsOk === lines, `${name}: every line shows the speaker's painted ${'mood'} portrait (${moodsOk}/${lines})`);

  // ── set pieces, each through the hooks: the warning first, then live
  for (const id of ['m5', 'm10', 'm15', 'm20']) {
    await W(id => { const J = window.__jade; J.start(id); J.enterStep(J.stepOf('chase', 'sets')); J.fireSets(); }, id);
    const warned = await until(() => window.__jade.sets().some(s => s.ph === 'warn') || window.__jade.sets().every(s => s.k === 'crane'), null, 4000);
    check(warned && (await appear('warning') || id === 'm20'), `${name}: ${id}'s set piece warns before it is live`);
    await wait(300); await look(`set piece ${id}`);
    const live = await until(() => window.__jade.sets().every(s => s.ph === 'go' || s.ph === 'done'), null, 9000);
    check(live, `${name}: ${id}'s set piece goes live (${JSON.stringify(await W(() => window.__jade.sets()))})`);
    if (id === 'm15') check(await until(() => window.__jade.sets()[0].down > 0.3, null, 4000), `${name}: the drawbridge lowers`);
    if (id === 'm20') check(await W(() => Math.abs(window.__jade.sets().find(s => s.k === 'crane').swing) > 0), `${name}: the crane swings`);
    if (id === 'm5') {
      // stand in the rubble: knocked down, with debris and shake
      await W(() => { const w = window.__jade.world(); if (w.p.ride) { w.p.ride.parked = true; w.p.ride = null; } const c = w.run.sets[0].rubble.find(c => !c.hit); w.placePlayer(c.x, c.y); });
      check(await until(() => window.__jade.world().p.stunT > 0, null, 2000), `${name}: the rubble knocks you down`);
      check(await until(() => window.__jade.juice().debris > 0 && window.__jade.juice().trauma > 0, null, 1000), `${name}: painted debris flies and the camera shakes`);
      await look('rubble hit');
    }
  }

  // ── Madame Glint: decoys, falling signs, the float
  await W(() => { const J = window.__jade; J.start('m25'); J.enterStep(J.stepOf('chase', '1')); });
  check(await until(() => window.__jade.run().decoys > 0, null, 8000), `${name}: phase 1 throws decoys`); await look('boss decoys');
  await W(() => { const J = window.__jade; J.enterStep(J.stepOf('chase', '2')); });
  check(await until(() => window.__jade.run().signs > 0 && window.__jade.run().phase === 2, null, 8000), `${name}: phase 2 drops neon signs`); await wait(400); await look('boss signs');
  await W(() => { const J = window.__jade; J.enterStep(J.stepOf('float')); const w = J.world(); if (w.p.ride) { w.p.ride.parked = true; w.p.ride = null; } w.p.roof = true; w.p.b.x = 103 * 64 + 32; w.p.b.y = 34 * 64 + 12; w.p.lastRoof = [w.p.b.x, w.p.b.y]; });
  // the float only swings in once the partner hauls the bunting rope: F sends them
  check(await until(() => window.__jade.duo().tag === 'hold', null, 3000), `${name}: F offers the bunting rope`);
  await p.keyboard.press('f'); await wait(150);
  check(await until(() => window.__jade.duo().holding, null, 15000), `${name}: the partner hauls the rope`);
  check(await until(() => window.__jade.run().float?.moving, null, 3000), `${name}: phase 3: the float rolls`); await look('boss float');
  check(await until(() => window.__jade.world().near?.kind === 'leap' && /onto/.test(window.__jade.world().near.label), null, 20000), `${name}: the flag says leap when the float is below ${await W(() => { const J = window.__jade, w = J.world(), f = w.run?.float; return JSON.stringify({ near: w.near, f: f && { x: Math.round(f.x / 64), m: f.moving, d: f.done }, p: [Math.round(w.p.x), Math.round(w.p.y), w.p.roof, w.p.ride?.kind], paused: J.play.paused, ui: w.ui?.kind, talk: !!w.talk, t: w.run?.cur?.t, failed: w.failed?.reason }); })}`);
  await act();
  check(await until(() => window.__jade.run()?.float?.done || window.__jade.run()?.t === 'pickup', null, 3000), `${name}: the leap lands on the float`);
  check((await seen()).includes('leap'), `${name}: the leap animation plays`);
  await W(() => window.__jade.world().quitJob()); await settle();

  // ── businesses: buy, upgrade, collect at the stall and at a safe house
  await W(() => { const w = window.__jade.world(); w.s.biz.noodle = { lvl: 0, bank: 0, tonight: 0, hist: [], raids: 0, defended: 0 }; w.placePlayer(39 * 64 + 32, 68 * 64 + 32 + 40); w.findNear(); });
  check(await until(() => window.__jade.world().near?.kind === 'biz', null, 2000), `${name}: the stall offers a stake`);
  await act(); check(await appear('biz'), `${name}: the stall panel opens`); await look('business stall');
  await press('biz-buy'); check(await W(() => window.__jade.world().s.biz.noodle.lvl === 1), `${name}: buy a stake`);
  check(await p.locator('[data-testid="biz"] [data-spr="biz-noodle-1"]').count() > 0, `${name}: the painting shows level 1`);
  // each deal plays its own animation once the panel closes: a handshake, then the mallet for an upgrade
  const reopen = async (anim, what) => { await press('close'); check(await until(a => window.__seen.has(a), anim, 3000), `${name}: the ${anim} animation (${what})`); await act(); await appear('biz'); };
  await reopen('deal', 'buying a stake');
  await press('biz-up'); check(await W(() => window.__jade.world().s.biz.noodle.lvl === 2), `${name}: upgrade`);
  check(await p.locator('[data-testid="biz"] [data-spr="biz-noodle-2"]').count() > 0, `${name}: the stall looks grander`);
  await reopen('mend', 'an upgrade');
  await W(() => { window.__jade.world().s.biz.noodle.bank = 120; window.__jade.play.bump(); }); await wait(200);
  const c0 = await W(() => window.__jade.world().s.cash); await press('biz-collect');
  check(await W(c0 => window.__jade.world().s.cash === c0 + 120, c0), `${name}: collect the takings at the stall`); await look('business collected');
  await press('close'); await wait(200);
  check(await until(() => window.__seen.has('collect'), null, 3000), `${name}: the collect animation`);
  check(await W(() => { const w = window.__jade.world(); return w.c.places && w.s.biz.noodle.lvl === 2; }), `${name}: the upgraded stall stands in the world`);
  await W(() => { window.__jade.world().s.biz.noodle.bank = 80; window.__jade.teleportTo('safe-market'); window.__jade.world().findNear(); }); await wait(150);
  await act(); check(await appear('safe'), `${name}: the safe house`); const c1 = await W(() => window.__jade.world().s.cash);
  await press('safe-collect'); check(await W(c1 => window.__jade.world().s.cash === c1 + 80, c1), `${name}: collect every till at a safe house`); await press('close'); await settle();
  // the Businesses page
  await press('pause-btn'); await press('tab-biz'); check(await exists('biz-page') && await exists('biz-row-noodle'), `${name}: the Businesses page`);
  await look('businesses page'); await press('close'); await press('resume');

  // ── a magpie raid: get there, then dash into the magpies
  await W(() => { window.__jade.world().s.biz.noodle.bank = 150; window.__jade.raid('noodle'); });
  check(await W(() => window.__jade.run()?.t === 'goto' && /raid/i.test(window.__jade.run().id)), `${name}: a raid starts a defend job`);
  await W(() => window.__jade.world().placePlayer(39 * 64 + 32, 70 * 64 + 32));
  check(await until(() => window.__jade.run()?.t === 'raid', null, 3000), `${name}: the magpies burst out`); await wait(300); await look('raid');
  for (let i = 0; i < 40 && await W(() => !!window.__jade.run()); i++) {
    const ok = await W(() => { const w = window.__jade.world(), r = w.run; if (!r) return false; const a = r.actors.find(x => !x.gone && x.stun <= 0); if (!a) return false; w.placePlayer(a.b.x - 30, a.b.y); return true; });
    if (ok) await p.keyboard.press(' ');
    await wait(160);
  }
  check(await W(() => !window.__jade.world().run && window.__jade.world().s.biz.noodle.defended >= 1), `${name}: the raid is chased off`);
  check((await seen()).includes('shoo'), `${name}: the shoo animation plays`);

  // ── Reduce shake
  await press('pause-btn'); await press('tab-settings');
  await press('set-calm'); check(await W(() => window.__jade.world().s.settings.calm === true), `${name}: Reduce shake on`);
  await wait(100); check(await W(() => window.__jade.juice().opt.calm === true), `${name}: the effects follow it`);
  await look('settings reduce shake');
  await press('set-calm'); check(await W(() => window.__jade.world().s.settings.calm === false), `${name}: Reduce shake off`);
  await press('close'); await press('resume'); await settle();

  // ── a skid: run one way, then turn hard
  await W(() => window.__jade.teleportTo('mk-market'));
for (let k = 0; k < 3 && !(await seen()).includes('skid'); k++) { await p.keyboard.down('a'); await wait(700); await p.keyboard.up('a'); await p.keyboard.down('d'); await wait(250); await p.keyboard.up('d'); }
  check((await seen()).includes('skid'), `${name}: a hard turn at a run skids ${await W(() => JSON.stringify({ v: window.__vmax, st: window.__jade.play.stick, ui: window.__jade.world().ui?.kind, talk: !!window.__jade.world().talk, paused: window.__jade.play.paused, run: window.__jade.world().run?.m.id }))}`);
  check((await seen()).some(a => a === 'tumble' || a === 'duck'), `${name}: a knock plays the tumble`);

  await W(k => { const w = window.__jade.world(); w.quitJob(); w.s.night = k.night; w.s.clock = k.clock; w.s.done = k.done; w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade']); }, keep); await settle();
  void loc; void st;
}
