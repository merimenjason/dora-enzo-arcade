// Jade Street in the browser, the sixteenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): the four ride jobs, each played the way a first-timer plays it. Nothing is teleported once the job is
// on offer: the player walks the gold route line to the giver, reads the on-screen hint (the HUD's objective line and
// the E prompt) and presses only the keys it names: E at a prompt, Q when it says ring the chime, F when it says toss,
// Space when it says surge. On the way each new action is checked drawn in its own frames: the ice-cream bell and the
// sidecar's cone, the bats eating, the tandem toss, the dragon boat's power stroke. Then a screenshot.
export async function sixteenth(h) {
  const { p, W, look, check, until, wait, name } = h;
  const tap = async (k, ms = 120) => { await p.keyboard.press(k); await wait(ms); };
  const drawn = () => W(() => window.__jade.rideDrawn());
  await W(() => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.story.ch = 9; w.s.cash = 5000;
    w.s.done = w.s.done.filter(id => !['k20', 'k21', 'k22', 'k23'].includes(id));
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong']);
    w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null; w.s.settings.partner = 'tag'; w.s.settings.assist = true; J.play.paused = false; J.play.bump();
  });
  check(await W(() => { const n = window.__jade.jobs(); return n.side; }) === 23, `${name}: twenty-three Hawker Tales, counted from the data`);

  /** the on-screen state a player sees, plus where the gold line goes (its points, in world units) */
  const seen = () => W(() => {
    const J = window.__jade, w = J.world(), q = s => document.querySelector(`[data-testid="${s}"]`);
    // the gold line's next bend (its points are its corners; the first is where you stand)
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    return { hint: q('objective')?.textContent ?? '', prompt: q('prompt')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null,
      x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act, near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null,
      to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, boostCd: w.p.boostCd, chimeT: w.p.chimeT };
  });
  const only = process.env.ONLY16 ? process.env.ONLY16.split(',') : null, want = id => !only || only.includes(id);
  let held = new Set();
  const hold = async keys => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
  /** follow the gold line a moment (direct controls: hold the keys towards its next bend, eight ways) */
  // (and, like a person, steer round whatever the line runs through: stuck a second, sidestep half a second)
  let stuckAt = null, side = 0;
  const steer = async s => {
    const keys = new Set(); if (s.to) { const dx = s.to[0] - s.x, dy = s.to[1] - s.y, l = Math.hypot(dx, dy) || 1; if (l > 20) { if (dx / l > 0.38) keys.add('d'); if (dx / l < -0.38) keys.add('a'); if (dy / l > 0.38) keys.add('s'); if (dy / l < -0.38) keys.add('w'); } }
    const now = Date.now();
    if (!keys.size || !stuckAt || Math.hypot(s.x - stuckAt.x, s.y - stuckAt.y) > 12) stuckAt = { x: s.x, y: s.y, t: now };
    else if (now - stuckAt.t > 1000 && now > side) side = now + 500;
    if (now < side) { const across = keys.has('a') || keys.has('d') ? ['w', 's'] : ['a', 'd']; keys.clear(); keys.add(across[Math.floor(side / 500) % 2]); if (now >= side - 40) stuckAt = null; }
    await hold(keys);
  };
  /**
   * play job `id` from where the player stands until it is done (or `secs` run out), as a first-timer: only the hint
   * and the prompt decide what to press. `on(s)` sees every tick, for the checks along the way. Returns the fails.
   */
  async function play(id, rideKind, secs, on = async () => {}) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0;
    if (!want(id)) { await W(id => window.__jade.world().s.done.push(id), id); return { won: false, fails: 0, secs: 0, skipped: true }; } // ONLY16=k22 (debugging one job)
    while (Date.now() - t0 < secs * 1000) {
      const s = await seen(); await on(s);
      if (process.env.TRACE16) { const k = `${id}|${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}`; if (k !== play.last) { play.last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await tap('e', 160); continue; }
      if (s.run === id) started = true;
      if (started && s.run !== id) { await hold(new Set()); const won = await W(id => window.__jade.world().s.done.includes(id), id); return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      // the prompt: the giver's job, a photo, or the job's own ride (not just any parked ride)
      if (ready && s.near && ((s.near.kind === 'mission' && s.near.id === id) || s.near.kind === 'job' || (s.near.kind === 'ride' && s.near.ride === rideKind && !s.ride && !/hop off/i.test(s.hint)))) { await hold(new Set()); await tap('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await tap('e', 400); lastKey = Date.now(); continue; }
      if (ready && /ring the chime \(Q\)!|Ring the ice-cream chime \(Q\)!/i.test(s.hint)) { await tap('q', 150); lastKey = Date.now(); }
      if (ready && /^F: /.test(s.hint)) { await tap('f', 150); lastKey = Date.now(); }
      if (/Space: surge/.test(s.hint) && s.boostCd <= 0) await tap(' ', 60);
      if (/^Wait for|^Here they come|wait for them/.test(s.hint)) { await hold(new Set()); await wait(150); continue; }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs };
  }
  // the jobs in the order the gold line offers them (Assist leads to the next Hawker Tale's giver: k20, k21, k22, k23)
  /** stand a little way from a giver, as if just arrived in the district, and play their job */
  const arrive = async (giver, dx = -260) => {
    await W(([g, dx]) => { const w = window.__jade.world(), pl = w.c.places[g]; w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } /* (off the boat: as if paddled to the bank) */ w.placePlayer(pl.x + dx, pl.y + 80); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [giver, dx]);
    await wait(500);
  };

  // ── Two Scoops (Uncle Buaya, Orchard Road): ring the chime, the bats come and eat, photograph while they do
  await arrive('buaya');
  let bell = '', serve = '', munch = false, ate = 0;
  const k20 = await play('k20', 'icecream', 240, async s => {
    if (s.ride === 'icecream' && s.chimeT > 0 && !bell) { const d = await drawn(); if (/-ride-bell-[01]$/.test(d.driver)) { bell = d.driver; serve = d.partner; await look('ringing the ice-cream chime'); } }
    if (!munch && s.step === 'case') { const e = await W(() => window.__jade.world().run?.actors.filter(a => (a.mind?.treat ?? 0) > 0).length ?? 0); if (e) { ate = e; munch = true; await look('the bats eating ice cream'); } }
  });
  check(k20.won, `${name}: a first-timer finishes Two Scoops from the hints alone (${k20.secs.toFixed(0)} s, ${k20.fails} retries)`);
  check(!!bell, `${name}: Q on the ice-cream motorbike rings the bell, drawn as ${bell || 'nothing'}`);
  check(/-serve-[01]$|pass-serve/.test(serve) || /-sidecar-[01]$/.test(serve), `${name}: the partner in the sidecar hands out a cone, drawn as ${serve}`);
  check(munch && ate > 0, `${name}: the chime draws the bats off their posts to eat (${ate} eating at once)`);
  await look('Two Scoops done');

  // ── Bak Chang by Boat (Coach Kerbau, Clarke Quay): paddle with the partner on the drum, Space on the beat
  await arrive('kerbau', -200);
  let stroke = '', drum = '';
  const k21 = await play('k21', 'dragon', 200, async s => {
    if (!stroke && s.ride === 'dragon') { const b = await W(() => window.__jade.world().p.boostT); if (b > 0) { const d = await drawn(); if (/-ride-stroke-[01]$/.test(d.driver)) { stroke = d.driver; drum = d.partner; await look('the dragon boat surging on the drum'); } } }
  });
  check(k21.won, `${name}: a first-timer finishes Bak Chang by Boat from the hints alone (${k21.secs.toFixed(0)} s, ${k21.fails} retries)`);
  check(!!stroke, `${name}: Space in the dragon boat is a power stroke, drawn as ${stroke || 'nothing'} (the drum: ${drum})`);

  // ── Picnic Post (Uncle Bala, East Coast Park): pedal the tandem, F and the partner tosses each parcel
  await arrive('bala');
  let toss = '';
  const k22 = await play('k22', 'tandem', 300, async s => {
    if (!toss && s.step === 'toss') { const t = await W(() => window.__jade.world().mate.tossT); if (t > 0) { const d = await drawn(); toss = d.partner; await look('tossing a parcel from the tandem'); } }
  });
  check(k22.won, `${name}: a first-timer finishes Picnic Post from the hints alone (${k22.secs.toFixed(0)} s, ${k22.fails} retries)`);
  check(/-toss-[01]$/.test(toss), `${name}: F on the tandem has the partner toss a parcel, drawn as ${toss || 'nothing'}`);

  // ── Down Siloso Road (Sergeant Helang, Sentosa): a luge chase after the mynah
  await arrive('helang', -200);
  let luge = '';
  const k23 = await play('k23', 'luge', 200, async s => {
    if (!luge && s.ride === 'luge' && s.step === 'chase') { luge = (await drawn()).driver; await look('luge chase down Siloso Road'); }
  });
  check(k23.won, `${name}: a first-timer finishes Down Siloso Road from the hints alone (${k23.secs.toFixed(0)} s, ${k23.fails} retries)`);
  check(/-ride-luge-[01]$/.test(luge), `${name}: the luge chase is drawn in the luge frames (${luge || 'nothing'})`);

  // ── the art: the six stands in their own paintings, Jurong Lake's bank and the calmer Katong ground
  await W(() => { const w = window.__jade.world(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.p.act = null; });
  await wait(400);
  for (const b of ['lakeshop', 'riversatay']) { await W(b => window.__jade.toBiz(b), b); await wait(1500); await look(`the ${b} stand in its own painting`); }
  await W(() => { const w = window.__jade.world(), b = w.c.places.lake; w.placePlayer(b.x, b.y + 300); window.__jade.play.bump(); }); await wait(1500); await look('Jurong Lake and its bank');
  await W(() => { const w = window.__jade.world(), b = w.c.places['katong-laksa'] ?? Object.values(w.c.places).find(q => q.d === 'katong'); w.placePlayer(b.x, b.y + 100); window.__jade.play.bump(); }); await wait(1500); await look('Katong ground');
}
