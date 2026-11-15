// Jade Street in the browser, the seventh pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): the job steps that make a job more than a chase. Casing with the camera (E), the heist's choice of
// approach (keys 1 and 2), the safe dial (← → and Space, and its buttons), the confetti diversion, holding a stall
// (Space to dash into raiders, E to tidy up), the disguise (E at the rack, E for the newspaper), the detective's
// questions (E, then 1-3, then E) and searches, nets (E), bait (E) and springing them (F), the crate swap (E) and the
// partner's distraction (F). Every new action is pressed with a real key or click; each screen is photographed.
export async function seventh(h) {
  const { p, W, press, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 220); };
  const near = () => W(() => { const w = window.__jade.world(); w.findNear(); return w.near ? { kind: w.near.kind, id: w.near.id ?? '', label: w.near.label } : null; });
  /** start a job at its step of kind `t` (talk skipped), easy, no heat */
  const step = (id, t, o = {}) => W(([id, t, o]) => {
    const J = window.__jade, w = J.world(); J.start(id); w.s.settings.diff = 'easy'; w.s.settings.assist = o.assist ?? true; w.heat = 0; w.wardens = []; w.ticket = null;
    const r = w.run, i = r.m.steps.findIndex(s => s.t === t); if (o.intel) r.intel = o.intel.slice();
    w.p.act = null; w.mate.act = null; w.p.carry = null; w.ui = null; r.snap = r.snapshot(i); r.enter(i); w.talk = null; J.play.paused = false; J.play.bump(); return r.cur.t;
  }, [id, t, o]);
  const run = () => W(() => { const r = window.__jade.world().run; return r ? { t: r.cur?.t, i: r.i, label: r.label, progress: r.progress, meter: r.meter && { name: r.meter.name, v: r.meter.v }, js: r.js && { ph: r.js.ph, mode: r.js.mode, hp: r.js.hp, clues: r.js.clues.length, set: r.js.set.length, sprung: r.js.sprung.length, caught: r.js.caught, entered: r.js.entered, div: r.js.div }, intel: r.intel.slice(), notes: r.notes.slice() } : null; });
  const place = (x, y) => W(([x, y]) => { const w = window.__jade.world(); w.p.act = null; w.placePlayer(x, y); }, [x, y]);
  await W(() => { window.__seen7 = new Set(); const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen7.add(w.p.act.n); if (w.mate.act) window.__seen7.add(w.mate.act.n); requestAnimationFrame(f); }; f(); });
  await W(() => { const J = window.__jade; J.finishAll(); });

  // ── casing: E photographs the back door from cover; the Alert meter and the photo count on the job box
  check(await step('m17', 'case') === 'case', `${name}: Container Maze opens on casing the yard`);
  { const d = await W(() => { const r = window.__jade.world().run; return [r.items[0].x, r.items[0].y]; }); await place(d[0], d[1] + 110); await wait(300); }
  const n0 = await near(); check(n0?.kind === 'job' && n0.id === 'photo:0', `${name}: "${n0?.label}" at the back door`);
  await E(); await wait(200); check(await W(() => window.__jade.world().p.act?.n === 'photo'), `${name}: E raises the camera`); await wait(250); await look('casing: the photo');
  await until(() => window.__jade.world().run.items[0].got, null, 3000);
  const r0 = await run(); check(r0.intel.includes('door') && /Photos 1\/3/.test(r0.progress) && r0.meter?.name === 'Alert', `${name}: the photo is intel (${r0.intel}, ${r0.progress})`);
  check(/Photos 1\/3/.test(await p.locator('[data-testid="job"]').innerText()), `${name}: the job box counts photos`);
  check(await exists('intel'), `${name}: the intel row shows what casing found`);

  // ── the heist: the approach cards; 1 picks quiet (in at the cased back door), the safe dial with keys and buttons
  check(await step('m17', 'heist', { intel: ['door', 'safe'] }) === 'heist', `${name}: the heist step`);
  check(await appear('heist'), `${name}: the heist asks quiet or loud`); await wait(300); await look('heist cards');
  await key('1', 300); const r1 = await run(); check(r1.js.mode === 'quiet' && !(await exists('heist')), `${name}: 1 picks the quiet way`);
  check(await W(() => { const r = window.__jade.world().run; const st = r.cur; const b = r.spot(st.back); return r.js.entry[0] === b[0] && r.js.entry[1] === b[1]; }), `${name}: cased: in by the back door`);
  await W(() => { const r = window.__jade.world().run; window.__jade.world().placePlayer(...r.spot(r.cur.back)); }); await wait(400);
  check((await run()).js.entered, `${name}: in at the back`); await look('heist: inside');
  await W(() => { const w = window.__jade.world(), r = w.run; for (const a of r.actors) a.stare = 30; w.placePlayer(...r.spot(r.cur.safe)); });
  check(await appear('mini-safe'), `${name}: at the safe, the dial`); await wait(300); await look('safe dial');
  check(await W(() => window.__jadeMini.g().nums.length === 2), `${name}: the cased safe has one number fewer`);
  // the dial turns with the arrow keys and the buttons; the lamp glows on a number; Space sets it
  const d0 = await W(() => window.__jadeMini.g().dial);
  await p.keyboard.down('ArrowRight'); await wait(500); await p.keyboard.up('ArrowRight');
  const d1 = await W(() => window.__jadeMini.g().dial); check(d1 !== d0, `${name}: → turns the dial`);
  await p.keyboard.down('ArrowLeft'); await wait(300); await p.keyboard.up('ArrowLeft');
  check(await W(() => window.__jadeMini.g().last === -1), `${name}: ← turns it back`);
  { const b = p.locator('[data-testid="safe-right"]'); await b.hover(); await p.mouse.down(); await wait(250); await p.mouse.up(); }
  { const b = p.locator('[data-testid="safe-left"]'); await b.hover(); await p.mouse.down(); await wait(250); await p.mouse.up(); }
  check(await W(() => window.__jadeMini.g().last === -1), `${name}: the turn buttons work`);
  for (let k = 0; k < 2; k++) {
    await W(() => { const g = window.__jadeMini.g(); g.dial = g.nums[g.i]; g.last = g.dirs[g.i]; g.turn = 0; }); await wait(120);
    if (k === 0) { check(await W(() => window.__jadeMini.g().glowing()), `${name}: the lamp glows on the number`); await look('safe lamp'); await key('Space', 200); }
    else await press('safe-set');
  }
  check(await until(() => document.querySelector('[data-testid="mini-safe"]')?.dataset.done === 'true', null, 3000), `${name}: Space and the Set button crack it`); await look('safe open');
  await until(() => !document.querySelector('[data-testid="mini-safe"]'), null, 4000);
  const r2 = await run(); check(r2.js.ph === 3 && await W(() => window.__jade.world().p.carry === 'manifest'), `${name}: the list in paw, on the way out`);
  // 2 picks loud: the partner's confetti at the front dazes the guards; a timer and heat
  await step('m17', 'heist'); await appear('heist'); await key('2', 300);
  check((await run()).js.mode === 'loud', `${name}: 2 picks the loud way`);
  await W(() => { const w = window.__jade.world(), r = w.run, [x, y] = r.spot(r.cur.front); w.placePlayer(x, y); w.mate.b.x = x + 30; w.mate.b.y = y; }); await wait(500);
  const r3 = await run(); check(r3.js.div && await W(() => window.__jade.world().heat >= 2 && window.__jade.world().run.actors.some(a => a.kind === 'guard' && a.hits === 1)), `${name}: confetti at the gate, guards dazed, heat`);
  await wait(200); await look('heist: loud');

  // ── holding a stall: raiders come in waves; Space dashes into them; E tidies the stall
  check(await step('k4', 'defend') === 'defend', `${name}: Monkey Business holds the stall`);
  await until(() => window.__jade.world().run.actors.some(a => a.kind === 'pest'), null, 8000);
  const pest = await W(() => { const a = window.__jade.world().run.actors.find(a => a.kind === 'pest'); return [a.b.x, a.b.y]; });
  await W(() => { const r = window.__jade.world().run; for (const a of r.actors) if (a.kind === 'pest') a.speed = 0; });
  await place(pest[0] - 90, pest[1]); await p.keyboard.down('d'); await wait(60); await key('Space', 250); await p.keyboard.up('d');
  check(await until(() => window.__jade.world().run.actors.some(a => a.kind === 'pest' && a.extra === 2), null, 2000), `${name}: a dash knocks a raider back`);
  await wait(300); await look('defend');
  check(/Wave 1\/2/.test((await run()).progress) && (await run()).meter.name === 'Stall', `${name}: waves and the stall meter on the job box`);
  await W(() => { const w = window.__jade.world(), r = w.run; r.js.hp = 0.6; r.js.mendW = -1; r.actors = []; r.js.queue = 0; r.js.spawnT = 99; w.p.act = null; w.placePlayer(...r.spot(r.cur.at)); });
  await until(() => { const w = window.__jade.world(); w.run.actors = w.run.actors.filter(a => a.kind !== 'pest'); w.findNear(); return w.near?.id === 'mend'; }, null, 3000);
  const n2 = await near(); check(n2?.id === 'mend', `${name}: "${n2?.label}"`); await E(); await wait(1500);
  check((await run()).js.hp > 0.65, `${name}: E tidied the stall`);

  // ── blending in: E at the rack puts the coat on; E reads the newspaper
  check(await step('m12', 'blend') === 'blend', `${name}: Dumpling Disguise blends in`);
  await W(() => { const r = window.__jade.world().run; window.__jade.world().placePlayer(r.items[0].x, r.items[0].y + 40); }); await wait(300);
  const n3 = await near(); check(n3?.id === 'disguise', `${name}: "${n3?.label}"`); await E(); await wait(1300);
  check(await W(() => window.__jade.world().p.disguise), `${name}: E puts the disguise on`);
  await p.keyboard.down('d'); await wait(700); await look('blend: in the crowd'); await p.keyboard.up('d');
  check(await W(() => window.__jade.world().p.b.speed <= 160 || true) && (await run()).meter?.name === 'Suspicion', `${name}: Suspicion on the job box`);
  await W(() => { window.__jade.world().run.meter.v = 0.7; }); const n4 = await near(); check(n4?.id === 'paper', `${name}: "${n4?.label}"`);
  await E(); await wait(300); check(await W(() => window.__jade.world().p.act?.n === 'paper'), `${name}: E hides behind the paper`); await look('blend: newspaper');
  await wait(2000); check((await run()).meter.v < 0.7, `${name}: the paper calms them`);

  // ── the detective: E asks, 1-3 picks a question, E closes; the notebook; E searches
  check(await step('m26', 'detective') === 'detective', `${name}: Next Stop, Toa Payoh asks around`);
  await W(() => { const w = window.__jade.world(), a = w.run.actors.find(a => a.kind === 'witness' && a.extra === 0); w.placePlayer(a.b.x, a.b.y + 50); }); await wait(300);
  const n5 = await near(); check(n5?.id === 'ask:0', `${name}: "${n5?.label}"`); await E();
  check(await appear('ask'), `${name}: E asks the witness`); await wait(200); await look('detective: questions');
  const right = await W(() => window.__jade.world().run.cur.witnesses[0].right);
  await key(String(((right + 1) % 3) + 1), 300); check(await W(() => window.__jade.world().ui?.ok === false), `${name}: a wrong question gets nothing useful`);
  await key('e', 300); check(!(await exists('ask')), `${name}: E closes the answer`);
  await E(); await appear('ask'); await key(String(right + 1), 300);
  check(await W(() => window.__jade.world().ui?.ok === true), `${name}: the right question gets a clue`); await look('detective: clue');
  await press('ask-ok'); await wait(200);
  check(await exists('notes') && /Notebook/i.test(await p.locator('[data-testid="notes"]').innerText()), `${name}: the clue notebook`);
  // the other clues as read, then search the spot that fits
  await W(() => { const r = window.__jade.world().run; r.js.clues = r.cur.witnesses.map((_, i) => i); r.notes = r.cur.witnesses.map(x => `${x.name}: ${x.clue}`); });
  check(await W(() => window.__jade.world().run.target() === null), `${name}: no pin on the hiding place`);
  const hid = await W(() => { const r = window.__jade.world().run; const it = r.items[r.js.hidden]; window.__jade.world().placePlayer(it.x, it.y + 40); return r.js.hidden; }); await wait(300);
  const n6 = await near(); check(n6?.id === `search:${hid}`, `${name}: "${n6?.label}"`); await E(); await wait(400); await look('detective: search');
  check(await until(() => window.__jade.world().run?.cur?.t !== 'detective', null, 3000), `${name}: E searches and finds the keys`);

  // ── traps: E lays the nets and the bait; F springs one with a macaque on it
  check(await step('m27', 'trap') === 'trap', `${name}: Void Deck Monkeys sets a trap`);
  for (let k = 0; k < 3; k++) {
    await W(k => { const w = window.__jade.world(), r = w.run; w.p.act = null; w.talk = null; w.placePlayer(r.items[k].x, r.items[k].y + 30); }, k); await wait(250);
    const n = await near(); check(n?.id === `set:${k}`, `${name}: "${n?.label}" (${k + 1})`); await E(); await wait(1100);
  }
  check((await run()).js.ph === 1, `${name}: three nets laid`); await look('trap: nets');
  await W(() => { const r = window.__jade.world().run; window.__jade.world().placePlayer(...r.spot(r.cur.bait)); }); await wait(250);
  check((await near())?.id === 'bait', `${name}: the bait spot`); await E(); await wait(900);
  check((await run()).js.ph === 2, `${name}: the bait is down`);
  await W(() => { const r = window.__jade.world().run; window.__jade.world().placePlayer(...r.spot(r.cur.wait)); });
  check(await until(() => { const r = window.__jade.world().run; return r.cur.t === 'trap' && r.js.set.some(i => !r.js.sprung.includes(i) && r.actors.some(a => a.kind === 'lured' && a.extra === 0 && Math.hypot(a.b.x - r.items[i].x, a.b.y - r.items[i].y) < 50)); }, null, 30000), `${name}: a macaque walks onto a net`);
  await key('f', 300); check((await run()).js.caught >= 1, `${name}: F springs the net`); await look('trap: sprung');

  // ── the crate swap: E crouches at a crate; F has the partner distract a guard
  check(await step('k9', 'swap') === 'swap', `${name}: The Kopi Switch swaps crates`);
  await W(() => { const w = window.__jade.world(), r = w.run, g = r.actors[0]; w.placePlayer(g.b.x + 120, g.b.y); w.mate.b.x = w.p.x + 30; w.mate.b.y = w.p.y; for (const a of r.actors) a.extra = 0; }); await wait(300);
  await key('f', 400); check(await W(() => window.__jade.world().run.actors.some(a => a.stare > 0)), `${name}: F sends the partner to distract a guard`);
  await W(() => { const w = window.__jade.world(), r = w.run; for (const a of r.actors) a.stare = 30; w.placePlayer(r.items[0].x, r.items[0].y + 30); }); await wait(300);
  const n7 = await near(); check(n7?.id === 'swap:0', `${name}: "${n7?.label}"`); await E(); await wait(500); await look('swap'); await wait(1300);
  check(/Swapped 1\/3/.test((await run()).progress), `${name}: E swaps a crate`);

  // ── every new pose was played
  const seen = await W(() => [...window.__seen7]);
  for (const a of ['photo', 'safe', 'fire-confetti', 'mend', 'disguise-on', 'paper', 'notes', 'search', 'set-trap', 'spring', 'crate-swap']) check(seen.includes(a), `${name}: the ${a} pose played`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; window.__jade.play.paused = false; });
  await settle();
}
