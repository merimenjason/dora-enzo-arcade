// Jade Street in the browser, the twelfth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): over the Geylang River. Chapter eight's card when Orchard Road and Katong open; walking each new
// district (Orchard Road, Katong, Changi) with its folk and its market; the hired bike (E to get on, the riding pose,
// quicker on the cycling track); the coast's small pleasures, each with its own pose (laksa, a bauble, a kite, a plane
// spotted, a suitcase); the Atas Bats (a raid, Datin Ciku's text, E shoos one); a chapter-eight job and a new Hawker
// Tale starting; Ah Huat waiting outside your property with his job; the Christmas Star ending; the Controls row; saved
// as v13; and every new pose played.
export async function twelfth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  // stand at (world units), let the prompt settle, read it
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(260); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id, label: n.label } : null; }); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen12.has(n), n);
  await W(() => {
    window.__seen12 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen12.add(w.p.act.n); if (w.p.ride) window.__seen12.add('ride:' + w.p.ride.kind); for (const m of w.gangs.ev?.mobs ?? []) window.__seen12.add('mob:' + m.st); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });

  // ── chapter eight's card: the Island Lights done, the bridges over the Geylang River open
  const n0 = await W(() => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !/^m(4[5-9]|5\d)$/.test(id)); w.s.story.ch = 7; w.s.story.lights = true; w.s.story.coast = false;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort']); w.fieldCache.clear(); J.play.scene.map = null; w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start('m45'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump(); return n;
  });
  check(await W(() => { const o = window.__jade.world().open; return o.has('orchard') && o.has('katong') && !o.has('changi'); }), `${name}: the Island Lights opens Orchard Road and Katong (Changi later)`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Geylang River|Orchard|Katong/.test(m.text)), n0), `${name}: a text says the coast is open`);
  check(await appear('jade-chapter-card'), `${name}: chapter eight's card`);
  check(/Christmas Star/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Christmas Star`); await wait(300); await look('chapter eight');
  await press('jade-story-skip'); await settle();
  await W(() => { const J = window.__jade, w = J.world(); const n = J.play.notices; n.queue = []; n.shown = []; J.finishAll(); J.talesAll(); w.s.story.lights = true; w.s.story.ch = 8; w.s.cash = 5000; w.today = '2026-12-01'; }); await free();
  check(await W(() => ['orchard', 'katong', 'changi'].every(d => window.__jade.world().open.has(d))), `${name}: Changi opens with the rest of chapter eight`);

  // ── each new district: walk it, its folk about, its market's stall
  for (const [d, mk, label] of [['orchard', 'mk-orchard', 'Orchard Road'], ['katong', 'mk-katong', 'Katong'], ['changi', 'mk-changi', 'Changi']]) {
    const near = await W(mk => { const w = window.__jade.world(), pl = w.c.places[mk]; w.placePlayer(pl.x, pl.y + 40); w.p.act = null; return null; }, mk);
    void near; await wait(700);
    check(await W(d => window.__jade.district(Math.floor(window.__jade.world().p.x / 64), Math.floor(window.__jade.world().p.y / 64)) === d, d), `${name}: standing in ${label}`);
    check(await W(() => window.__jade.world().peds.length > 0), `${name}: folk about in ${label}`);
    await look(`district: ${label}`);
  }

  // ── the hired bike: E to get on, the riding pose, quicker on the cycling track
  const bike = await W(() => { const w = window.__jade.world(), r = w.rides.find(r => r.kind === 'bike'); return r ? [r.b.x, r.b.y] : null; });
  check(!!bike, `${name}: a hired bike by the rack`);
  if (bike) {
    const nb = await stand(bike[0] + 30, bike[1]); check(nb?.kind === 'ride' && /bike/i.test(nb.label), `${name}: the bike's prompt: "${nb?.label}"`);
    await E(); await wait(500); check(await W(() => window.__jade.world().p.ride?.kind === 'bike'), `${name}: E gets on the bike`);
    await p.keyboard.down('d'); await wait(1200); await look('riding a hired bike'); await p.keyboard.up('d');
    check(await seen('ride:bike'), `${name}: riding the bike`);
    await W(() => { const w = window.__jade.world(); if (w.p.ride) { w.p.ride.parked = true; w.p.ride.b.speed = 0; w.p.ride = null; } }); await free();
  }

  // ── the coast's small pleasures, each with its own pose
  const pleasures = await W(() => { const w = window.__jade.world(), F = w.c.far, P = w.c.places; return { laksa: [P.laksa.x, P.laksa.y + 30], bauble: [F.trees[0][0], F.trees[0][1] + 30], kite: F.kites[0], plane: F.spots[0], suitcase: [P.terminal.x, P.terminal.y + 20] }; });
  for (const [id, [x, y]] of Object.entries(pleasures)) {
    if (id === 'plane') await W(() => { const w = window.__jade.world(); w.time = Math.ceil(w.time / 24) * 24 + 1; });
    const n = await stand(x, y); check(n?.kind === 'far' && n.id.startsWith(id), `${name}: the ${id} prompt: "${n?.label}"`);
    await E(); await wait(500); await look(`coast: ${id}`);
    check(await until(n => window.__seen12.has(n), id, 3000), `${name}: the ${id} pose plays`);
    await until(() => !window.__jade.world().p.act, null, 5000);
  }
  const st = await W(() => ({ ...window.__jade.world().s.stats }));
  check(st.laksa >= 1 && st.baubles >= 1 && st.kites >= 1 && st.planes >= 1, `${name}: laksa, bauble, kite and plane all counted`);
  await free();

  // ── the Atas Bats: a raid in Katong, Datin Ciku's text, E shoos a bat
  const m0 = await W(() => { const w = window.__jade.world(), pl = w.c.places.rosie; w.placePlayer(pl.x, pl.y + 90); return Math.max(0, ...w.s.msgs.map(m => m.id)); });
  check(await W(() => window.__jade.gang('bats')), `${name}: the Atas Bats raid Katong`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && m.from === 'ciku'), m0), `${name}: Datin Ciku texts`);
  await wait(900); await look('the atas bats');
  const sh = await W(() => { const w = window.__jade.world(), m = w.gangs.ev.mobs[0]; m.fly = undefined; m.st = 'run'; m.has = true; w.placePlayer(m.b.x + 30, m.b.y); w.p.act = null; return [m.b.x, m.b.y]; });
  await wait(120); const nsh = await W(() => window.__jade.world().near); check(nsh?.kind === 'gang' && /bat/i.test(nsh.label), `${name}: the shoo prompt: "${nsh?.label}"`);
  void sh; await key('e', 400); check(await until(() => window.__seen12.has('shoo'), null, 2000), `${name}: E shoos the bat`); await look('shoo a bat');
  await free();

  // ── a chapter-eight job (Pedal to the Park, on a bike) and a new Hawker Tale start
  check(await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm48'); return J.job('m48'); }) !== null, `${name}: Pedal to the Park starts`);
  await wait(500); await look('job: pedal to the park'); await W(() => { const w = window.__jade.world(); w.quitJob(); w.s.done.push('m48'); }); await free();
  check(await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'k14'); return J.job('k14'); }) !== null, `${name}: the Katong Hawker Tale starts`);
  await wait(500); await look('hawker tale: katong'); await W(() => { const w = window.__jade.world(); w.quitJob(); w.s.done.push('k14'); }); await free();

  // ── Ah Huat waits outside your property with his job; Pak Duri stands guard
  await W(() => { const J = window.__jade; J.setBiz('chicken', { lvl: 1, bank: 100, jaga: true }); J.rank(2); J.play.bump(); });
  const huat = await W(() => { const w = window.__jade.world(); w.castK = ''; w.refreshCast(); const c = w.cast.find(m => m.id === 'huat'); return c ? [c.x, c.y] : null; });
  check(!!huat, `${name}: Ah Huat stands in the street`);
  if (huat) { const nh = await stand(huat[0] + 30, huat[1]); check(nh?.kind === 'empire' && /Ah Huat/.test(nh.label), `${name}: Ah Huat's prompt: "${nh?.label}"`); await look('ah huat outside'); }
  await free();

  // ── the Christmas Star ending
  await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm55'); w.s.story.coast = false; w.finishMission(J.mission('m55')); w.talk = null; J.play.bump(); });
  check(await p.waitForSelector('[data-testid="jade-ending"]', { timeout: 9000 }).then(() => true, () => false), `${name}: the Christmas Star ending plays`);
  check(/Christmas|coast|Jewel/i.test(await loc('jade-ending').innerText()), `${name}: it is the new ending`); await look('christmas star ending');
  await press('jade-story-skip'); if (await appear('jade-credits')) await press('jade-credits-done');
  check(await W(() => window.__jade.world().s.story.coast), `${name}: the ending is remembered`); await settle();

  // ── the Controls page, the save, every new pose
  await press('pause-btn'); await press('tab-controls');
  check(/Geylang River/.test(await loc('jade-controls').innerText()), `${name}: the Controls page has the coast`);
  await press('close'); if (await exists('resume')) await press('resume');
  await W(() => window.__jade.play.persist(window.__jade.world().s));
  check(await until(() => !!localStorage.getItem('jade-street-v13') && JSON.parse(localStorage.getItem('jade-street-v13')).v === 13, null, 6000), `${name}: saved as v13`);
  for (const n of ['laksa', 'bauble', 'kite', 'plane', 'suitcase', 'shoo', 'ride:bike']) check(await seen(n), `${name}: the ${n} pose played`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; window.__jade.play.paused = false; });
  await settle();
}
