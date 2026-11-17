// Jade Street in the browser, the fourteenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): chapter nine's card and the south shore opening (Tiong Bahru and Clarke Quay, then Jurong), each new
// district walked with its folk, market, safe house and property, the MRT to the new stations by the gates, the
// objective plaque naming the right stations, every small pleasure by E with its own pose, the switch box and its own
// key, a bumboat on the Singapore River, every chapter-nine job and new Hawker Tale started (four of them at their
// giver with E), Towkay Hoot on the run, the Lights by the Lake ending, the Controls row, the map's plaques, and the
// art fixes (the repainted Katong Park and Changi Airport stations, the calmer Katong and Kampong Glam ground).
export async function fourteenth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(260); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen14.has(n), n);
  const district = () => W(() => window.__jade.district(Math.floor(window.__jade.world().p.x / 64), Math.floor(window.__jade.world().p.y / 64)));
  await W(() => {
    window.__seen14 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen14.add(w.p.act.n); if (w.p.ride) window.__seen14.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen14.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });

  // ── chapter nine's card: the Christmas Star home, the south shore opens (Jurong later)
  const n0 = await W(() => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !/^(m5[5-9]|m6\d|k1[789])$/.test(id)); w.s.story.ch = 8; w.s.story.lights = true; w.s.story.coast = true; w.s.story.lake = false; w.s.cash = 5000;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi']); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start('m55'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump(); return n;
  });
  check(await W(() => { const o = window.__jade.world().open; return o.has('tiong') && o.has('quay') && !o.has('jurong'); }), `${name}: the Christmas Star opens Tiong Bahru and Clarke Quay (Jurong later)`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Tiong Bahru/.test(m.text) && /Clarke Quay/.test(m.text)), n0), `${name}: a text says the south shore is open`);
  check(await appear('jade-chapter-card'), `${name}: chapter nine's card`);
  check(/Lights by the Lake/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Lights by the Lake`); await wait(400); await look('chapter nine');
  check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-9/.test(im.src); }), `${name}: the card's painting is chapter nine's`);
  await press('jade-story-skip'); await settle();
  check(await W(() => window.__jade.world().s.story.ch === 9), `${name}: chapter nine is under way`);

  // ── the plaque names the right stations: from Chinatown the next giver (Mr Kamal's job is done here) is by MRT
  await W(() => { const J = window.__jade, w = J.world(); w.s.done.push('m56'); J.play.notices.queue = []; J.play.notices.shown = []; const pl = w.c.places['safe-market']; w.placePlayer(pl.x, pl.y + 64); w.waypoint = null; J.play.bump(); }); await free(); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/Tiong Bahru/i.test(tl) && /MRT/i.test(tl) && /Chinatown/i.test(tl), `${name}: from Chinatown the plaque sends you by MRT to Tiong Bahru ("${tl}")`); await look('plaque: chinatown to tiong bahru');
  // standing in Tiong Bahru with the next job in Tiong Bahru: no station named, least of all Chinatown's
  await at('stn-tiong'); await wait(900);
  const tl2 = await loc('travel-label').innerText().catch(() => ''), ob2 = await loc('objective').innerText().catch(() => '');
  check(!/Chinatown|Changi|Katong/i.test(tl2 + ob2), `${name}: in Tiong Bahru the plaque names no far station ("${(ob2 + ' ' + tl2).replace(/\n/g, ' ').slice(0, 90)}")`); await look('plaque: in tiong bahru');
  // a pin at Clarke Quay from Katong: the MRT, Katong Park to Clarke Quay
  await at('stn-katong'); await W(() => { const w = window.__jade.world(), pl = w.c.places['central-quay']; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl3 = await loc('travel-label').innerText().catch(() => '');
  check(/Katong Park/i.test(tl3) && /Clarke Quay/i.test(tl3) && !/Chinatown/i.test(tl3), `${name}: Katong to a Clarke Quay pin goes Katong Park to Clarke Quay ("${tl3}")`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── the MRT by the gates: E at Tiong Bahru station, click Clarke Quay, arrive
  const ng = await at('stn-tiong', 0, 50); check(ng?.kind === 'station', `${name}: the gate prompt at Tiong Bahru station: "${ng?.label}"`);
  await E(); check(await appear('mrt-stn-quay') || await exists('mrt-stn-quay'), `${name}: the gates list Clarke Quay`);
  check(await exists('mrt-stn-tiong') && !(await W(() => !!document.querySelector('[data-testid="mrt-stn-jurong"]:not([disabled])'))), `${name}: Jurong East is not open yet at the gates`);
  await look('mrt gates at tiong bahru'); await press('mrt-stn-quay');
  check(await appear('ride-view'), `${name}: the ride view`); await key('e', 400);
  check(await until(() => window.__jade.district(Math.floor(window.__jade.world().p.x / 64), Math.floor(window.__jade.world().p.y / 64)) === 'quay', null, 9000), `${name}: the train arrives at Clarke Quay`); await settle(); await free();

  // ── Jurong opens with Godown No. 9
  const n1 = await W(() => { const J = window.__jade, w = J.world(); w.s.done.push('m57', 'm58', 'm59', 'm60'); const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start('m61'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; J.play.paused = false; J.play.bump(); return n; });
  check(await W(() => window.__jade.world().open.has('jurong')), `${name}: Godown No. 9 opens Jurong`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Jurong East/.test(m.text)), n1), `${name}: a text says Jurong is open`); await wait(600); await look('jurong opens');
  await W(() => { const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.story.ch = 10; w.s.story.lake = true; w.s.cash = 50000; J.play.notices.queue = []; J.play.notices.shown = []; }); await free(); await settle();

  // ── each new district: stand in it, its folk about, its market's stall and keeper, its safe house, a property
  for (const [d, label, keeper, biz] of [['tiong', 'Tiong Bahru', 'Uncle Seng', 'chweekueh'], ['quay', 'Clarke Quay', 'Kak Melati', 'riversatay'], ['jurong', 'Jurong', 'Sifu Musang', 'lakeshop']]) {
    const nm = await at('mk-' + d); await wait(700);
    check(await district() === d, `${name}: standing in ${label}`);
    check(await until(() => window.__jade.world().peds.length > 0, null, 6000), `${name}: folk about in ${label}`);
    await look(`district: ${label}`);
    check(nm?.kind === 'market', `${name}: ${label}'s market prompt: "${nm?.label}"`);
    await E(); check(await appear('market'), `${name}: E opens ${label}'s market`);
    check(await until(k => { const im = document.querySelector('[data-testid="market"] img'); return !!im && im.complete && im.naturalWidth > 0 && im.alt.includes(k); }, keeper, 6000), `${name}: ${keeper} behind the counter, painted`);
    await wait(300); await look(`market: ${label}`); await press('close'); await free();
    const ns = await at('safe-' + d); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: ${label}'s safe house prompt: "${ns?.label}"`);
    if (ns?.kind === 'buy-safe') { await W(d => { window.__jade.world().s.rep[d] = 40; }, d); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens ${label}'s safe house for sale`); await press('buy-safe'); await wait(300); check(/yours/i.test(await loc('safe').innerText().catch(() => '')) || (await at('safe-' + d))?.kind === 'safe', `${name}: Buy buys ${label}'s safe house`); await look(`safe house: ${label}`); if (await exists('close')) await press('close'); }
    await free();
    const nb = await W(id => window.__jade.toBiz(id), biz); check(nb?.kind === 'biz', `${name}: a property for sale in ${label}: "${nb?.label}"`);
    await E(); check(await appear('biz-panel') || await exists('biz-buy'), `${name}: E opens the property panel in ${label}`);
    if (await exists('biz-buy')) { await press('biz-buy'); await wait(250); check(await W(id => window.__jade.world().s.biz[id].lvl >= 1, biz), `${name}: Buy buys the ${label} property`); }
    await look(`property: ${label}`); if (await exists('close')) await press('close'); await free();
  }

  // ── the landmarks, for the contact sheet
  for (const [id, label] of [['tbmarket', 'tiong bahru market'], ['birdcorner', 'bird corner'], ['flats', 'moh guan terrace flats'], ['stn-tiong', 'tiong bahru station'], ['godowns', 'clarke quay godowns'], ['readbridge', 'read bridge'], ['police', 'old hill street police station'], ['stn-quay', 'clarke quay station'], ['science', 'science centre'], ['snowcity', 'snow city'], ['stn-jurong', 'jurong east station'], ['garden', 'chinese garden gate'], ['pagoda', 'pagoda'], ['twin', 'twin pagodas'], ['lawn', 'jurong lake']]) { await at(id, 0, 50); await wait(650); await look(`landmark: ${label}`); }
  // the art fixes: the two repainted stations and the retiled ground
  for (const [id, label] of [['stn-katong', 'katong park station (repainted)'], ['stn-changi', 'changi airport station (repainted)'], ['joochiat', 'katong ground (calmer)'], ['safe-glam', 'kampong glam ground (calmer)']]) { await at(id, 0, 60); await wait(700); await look(`art fix: ${label}`); }
  check(await W(() => { const s = window.__jade.play.scene; return typeof s.glowCount !== 'function' || s.glowCount() <= 64; }), `${name}: the glow cache holds`);

  // ── the south shore's small pleasures, each by E, each with its own pose
  const spots = await W(() => { const S = window.__jade.world().c.south; return { chwee: [S.kueh[0], S.kueh[1] + 60], birds: [S.birds[0] + 32, S.birds[1] + 70], sling: [S.sling[0], S.sling[1] + 80], koi: S.koi[0], stars: [S.scope[0], S.scope[1] + 50], walk: S.walk[0] }; });
  const POSE = { chwee: 'chwee', birds: 'birdsong', sling: 'sling', koi: 'koi', stars: 'stars', walk: 'lantern-walk' };
  // (the lantern walk is offered while the lake's lanterns are lit: in season by the calendar)
  await W(() => { window.__jade.world().today = '2026-11-18'; }); await stand(spots.walk[0], spots.walk[1]);
  check(await W(() => window.__jade.world().near?.id !== 'walk'), `${name}: out of season the lake's lanterns are dark: no lantern walk`);
  await W(() => { window.__jade.world().today = '2026-09-25'; });
  const cash0 = await W(() => window.__jade.world().s.cash);
  for (const [id, [x, y]] of Object.entries(spots)) {
    const n = await stand(x, y); check(n?.kind === 'south' && n.id === id, `${name}: the ${id} prompt: "${n?.label}"`);
    await E(); await wait(id === 'sling' ? 1500 : 500); await look(`south shore: ${id}`);
    check(await until(n => window.__seen14.has(n), POSE[id], 3000), `${name}: the ${id} pose plays`);
    await until(() => !window.__jade.world().p.act, null, 7000);
  }
  const st = await W(() => ({ ...window.__jade.world().s.stats, cash: window.__jade.world().s.cash }));
  check(st.chwee >= 1 && st.songs >= 1 && st.slings >= 1 && st.koi >= 1 && st.stars >= 1 && st.lwalks >= 1, `${name}: chwee kueh, songbirds, Slingshot, koi, telescope and lantern walk all counted`);
  check(st.cash === cash0 - 3 - 8, `${name}: the chwee kueh and the Slingshot were paid for (${cash0} to ${st.cash})`);
  await free();

  // ── a bumboat on the Singapore River: E gets in, it sails
  const boat = await W(() => { const w = window.__jade.world(), r = w.rides.find(r => r.kind === 'boat' && Math.floor(r.b.x / 64) > 288 && Math.floor(r.b.y / 64) > 100); return r ? [r.b.x, r.b.y] : null; });
  check(!!boat, `${name}: a bumboat at the steps by Read Bridge`);
  if (boat) {
    const nb = await stand(boat[0], boat[1] - 70); check(nb?.kind === 'ride', `${name}: the bumboat's prompt: "${nb?.label}"`);
    await E(); await wait(500); check(await W(() => window.__jade.world().p.ride?.kind === 'boat'), `${name}: E gets in the bumboat`);
    const x0 = await W(() => window.__jade.world().p.x); await p.keyboard.down('d'); await wait(1300); await look('bumboat on the singapore river'); await p.keyboard.up('d');
    check(await W(x0 => window.__jade.world().p.x > x0 + 60, x0), `${name}: the bumboat sails down the river`);
    await W(() => { const w = window.__jade.world(); if (w.p.ride) { w.p.ride.parked = true; w.p.ride.b.speed = 0; w.p.ride = null; } const pl = w.c.places.melati; w.placePlayer(pl.x, pl.y + 60); }); await free();
  }

  // ── chapter nine by E at the givers: Uncle Seng, Kak Melati, Dr Suria and Sifu Musang each give their job in person
  for (const [id, giver, who] of [['m57', 'seng', 'Uncle Seng'], ['m58', 'melati', 'Kak Melati'], ['m62', 'suria', 'Dr Suria'], ['m64', 'musang', 'Sifu Musang']]) {
    await W(id => { const J = window.__jade, w = J.world(); w.quitJob(); J.finishAll(); J.talesAll(); const k = +id.slice(1); w.s.done = w.s.done.filter(x => !/^m\d+$/.test(x) || +x.slice(1) < k); w.castK = ''; w.refreshCast?.(); J.play.bump(); }, id);
    const c = await W(g => { const w = window.__jade.world(); w.castK = ''; w.refreshCast?.(); const m = w.cast.find(m => m.id === g); return m ? [m.x, m.y] : null; }, giver);
    check(!!c, `${name}: ${who} stands in the street`);
    if (!c) continue;
    const ng = await stand(c[0] + 34, c[1] + 10); check(ng && /mission|giver/.test(ng.kind), `${name}: ${who}'s prompt: "${ng?.label}"`);
    await look(`giver: ${who}`); await E(); await wait(400);
    if (await exists('job-start')) await press('job-start'); else if (await exists('prompt-goals')) await key('e', 300);
    check(await until(id => window.__jade.world().run?.m.id === id, id, 4000), `${name}: E at ${who} starts ${id}`);
    check(await appear('dialogue') && (await loc('dialogue').innerText()).length > 10, `${name}: ${who} talks`);
    check(await W(() => { const im = document.querySelector('[data-testid="talk-face"]'); return !!im; }), `${name}: a face beside the words`); await wait(500); await look(`talk: ${who}`);
    await W(() => { const w = window.__jade.world(); w.talk = null; w.quitJob(); }); await free();
  }
  await W(() => { const J = window.__jade; J.finishAll(); J.talesAll(); }); await free();

  // ── every chapter-nine job and new Hawker Tale starts, and its main step stands up
  const MAIN = { m56: 'deliver', m57: 'detective', m58: 'collect', m59: 'race', m60: 'defend', m61: 'heist', m62: 'trap', m63: 'swap', m64: 'escort', m65: 'chase', k17: 'deliver', k18: 'collect', k19: 'collect' };
  for (const [id, t] of Object.entries(MAIN)) {
    const ok = await W(([id, t]) => { const J = window.__jade, w = J.world(); w.quitJob(); w.s.done = w.s.done.filter(x => x !== id); const r = J.job(id); if (r === null || !w.run) return 'no run'; const i = w.run.m.steps.findIndex(s => s.t === t); if (i < 0) return 'no step'; return J.enterStep(i) === t ? 'ok' : 'wrong step'; }, [id, t]);
    check(ok === 'ok', `${name}: ${id} starts and reaches its ${t} step (${ok})`); await wait(700);
    const lab = await loc('objective').innerText().catch(() => ''); check(lab.length > 8, `${name}: ${id}'s plaque: "${lab.replace(/\n/g, ' ').slice(0, 70)}"`);
    await look(`job: ${id} ${t}`);
    if (id === 'm65') { check(await until(() => window.__seen14.has('skin:hoot'), null, 3000), `${name}: Towkay Hoot is on the run`); await p.keyboard.down('a'); await wait(900); await p.keyboard.up('a'); await look('towkay hoot runs'); }
    if (id === 'm60') { await key(' ', 300); await key(' ', 300); check(await W(() => window.__jade.world().run?.cur?.t === 'defend'), `${name}: holding the Clarke Quay stage`); }
    await W(id => { const w = window.__jade.world(); w.ui = null; w.talk = null; w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); if (w.p.ride) { w.p.ride.parked = true; w.p.ride = null; } }, id); await free();
  }

  // ── Canopy Lights opens the switch box, with the switch box's own key; wire it with the keys and turn the key
  const sw = await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(x => x !== 'm58'); J.job('m58'); const i = w.run.m.steps.findIndex(s => s.t === 'mini' && s.kind === 'wires'); J.enterStep(i); w.talk = null; w.ui = { kind: 'mini', mini: 'wires', level: 1, from: 'mission' }; J.play.bump(); return w.run.cur.label; });
  check(/light/i.test(sw) && await appear('mini-wires'), `${name}: Canopy Lights' wires`);
  const head = await loc('mini-wires').innerText().catch(() => '');
  check(/switch box/i.test(head) && /switch key/i.test(head) && !/Jump-start/.test(head), `${name}: it is the switch box with a switch key (${head.split('\n')[0]})`);
  // (pick wire i with its number, try each free socket with its number; the "Wires joined n/4" line says when it took)
  const joined = async () => +((await loc('mini-wires').innerText().catch(() => '')).match(/Wires joined (\d)\/4/)?.[1] ?? (await W(() => { const b = document.querySelector('[data-testid="wire-key"]'); return b && !b.disabled ? 4 : 0; })));
  const used = new Set();
  for (let i = 1; i <= 4; i++) { const n = await joined(); for (let j = 1; j <= 4; j++) { if (used.has(j)) continue; await key(String(i), 80); await key(String(j), 200); if (await joined() > n) { used.add(j); break; } } }
  check(await W(() => { const b = document.querySelector('[data-testid="wire-key"]'); return !!b && !b.disabled; }), `${name}: every wire joined with the number keys`);
  await wait(250); await look('switch box and its key'); check(/switch key/i.test(await loc('wire-key').innerText()), `${name}: the button says switch key`);
  await press('wire-key'); check(await until(() => /Lights on/.test(document.querySelector('[data-testid="mini-wires"]')?.textContent ?? '') || window.__jade.world().ui?.kind !== 'mini', null, 5000), `${name}: the switch key turns: lights on`);
  await wait(500); await look('switch key turned'); await wait(1200);
  await W(() => { const w = window.__jade.world(); w.ui = null; w.talk = null; w.quitJob(); if (!w.s.done.includes('m58')) w.s.done.push('m58'); }); await free(); await settle();

  // ── the Lights by the Lake ending
  await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm65'); w.s.story.lake = false; w.finishMission(J.mission('m65')); w.talk = null; J.play.bump(); });
  check(await p.waitForSelector('[data-testid="jade-ending"]', { timeout: 9000 }).then(() => true, () => false), `${name}: the Lights by the Lake ending plays`);
  check(/Moon Lantern|Jurong Lake|Lights by the Lake/i.test(await loc('jade-ending').innerText()), `${name}: it is the new ending`); await wait(500); await look('lights by the lake ending');
  check(await W(() => { const im = [...document.querySelectorAll('[data-testid="jade-ending"] img')]; return im.some(i => /bg-chapter-9|bg-end-7/.test(i.src) && i.complete && i.naturalWidth > 0); }), `${name}: its paintings are chapter nine's`);
  await press('jade-story-skip'); if (await appear('jade-credits')) await press('jade-credits-done');
  check(await W(() => window.__jade.world().s.story.lake), `${name}: the ending is remembered`); await settle();

  // ── the map: the three districts' plaques; the jobs book's chapter nine; the Controls row; the save
  await W(() => { const w = window.__jade.world(), pl = w.c.places['stn-tiong']; w.placePlayer(pl.x, pl.y + 60); }); await free();
  await press('map-btn'); check(await appear('jade-map'), `${name}: the map opens`); await wait(900);
  const pq = await p.locator('[data-testid="jade-map-plaque"]').allInnerTexts();
  for (const d of ['Tiong Bahru', 'Clarke Quay', 'Jurong']) check(pq.some(t => t.includes(d)), `${name}: the map's ${d} plaque`);
  check(pq.filter(t => /Clarke Quay/.test(t)).length === 1 && pq.some(t => /Club Street/.test(t)), `${name}: one Clarke Quay on the map; the old neon quarter is Club Street`);
  await look('map with the south shore'); await press('close'); await free();
  await press('pause-btn'); await press('tab-jobs'); if (await exists('jade-jobs-ch9')) await press('jade-jobs-ch9');
  check(await exists('jade-jobs-ch9') && /Breakfast at Tiong Bahru/.test(await loc('pause').innerText()) && /Lights by the Lake/.test(await loc('pause').innerText()), `${name}: the jobs book's chapter nine`); await look('jobs book chapter nine');
  await key('Escape'); await press('tab-controls');
  check(/south shore/i.test(await loc('jade-controls').innerText()), `${name}: the Controls page has the south shore`);
  await press('close'); if (await exists('resume')) await press('resume');
  await W(() => window.__jade.play.persist(window.__jade.world().s));
  check(await until(() => { const r = localStorage.getItem('jade-street-v13'); if (!r) return false; const s = JSON.parse(r); return s.v === 13 && s.story.lake === true && s.stats.slings >= 1 && 'tiong' in s.rep; }, null, 6000), `${name}: saved as v13 with the new counts`);
  for (const n of ['chwee', 'birdsong', 'sling', 'koi', 'stars', 'lantern-walk', 'ride:boat', 'skin:hoot']) check(await seen(n), `${name}: ${n} was seen`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; window.__jade.play.paused = false; });
  await settle();
}
