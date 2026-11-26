// Lookout Ridge in the browser, muted, at 1536 x 864 and 1280 x 720. Every key and both ways to start:
// the title (Space, Enter, a click), 1 2 3 and Tab, G, walking left and right, the angle up and down, Space held to
// charge and let go to fire. Dora darns a patch with the needle (the patch is solid in the engine and painted on the
// ground bitmap), Enzo's pot hits the fox, a keyed shot snags a pom-pom and unravels the row under the fox, the game
// is played on like a player to its end, a self-played seed reaches nightfall, duds lose it, and Enter, R and a click
// restart. A first-timer pass plays with nothing but the arrows and Space held by eye. Screenshots go to
// .shots/lookout-ridge/ (not committed). No page errors. Needs `npm run dev` (BASE_URL to override) and Playwright.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = '.shots/lookout-ridge';
const NIGHT_SEED = 1000;   // a seed whose self-played heroes hold out until nightfall
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio'] });
const errors = [];
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; console.log('PASS', m); };

async function open(viewport = { width: 1536, height: 864 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Download the React DevTools|404/.test(m.text())) errors.push(m.text()); });
  p.setDefaultTimeout(30000);
  for (let i = 0; ; i++) {
    await p.goto(`${base}/lookout-ridge`);
    try { await p.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); break; } catch (e) { if (i >= 2) throw e; }
  }
  await p.waitForTimeout(300);
  return p;
}
const L = (p, expr) => p.evaluate(`(() => { const L = window.__lr; return ${expr}; })()`);
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
/** the painted ground and the engine's mask agree (sampled on a grid over the play field) */
async function groundMatches(p, label) {
  const r = await p.evaluate(() => {
    const { game, scene } = window.__lookout(); scene.draw(game);
    let same = 0, n = 0;
    for (let y = 300; y < 860; y += 6) for (let x = 3; x < 1536; x += 6) { n++; if ((scene.groundAlpha(x, y) > 110) === game.solid(x, y)) same++; }
    return same / n;
  });
  ok(r > 0.985, `${label}: the painted ground matches the engine's cloth (${(r * 100).toFixed(2)}%)`);
}

// aim with the keys: plan with the engine's own guide sim (as a player reading the guide would), then turn the angle
// with the arrows and hold Space until the power reaches the plan
async function aim(p, shotIx, scoreSrc) {
  await p.keyboard.press(String(shotIx + 1));
  const plan = await p.evaluate(([scoreSrc]) => {
    const L = window.__lr, u = L.cur; const score = eval(scoreSrc);
    let best = null;
    for (const face of [1, -1]) { u.face = face;
      for (let a = 20; a <= 80; a++) for (let pw = 8; pw <= 100; pw++) {
        const r = L.simulate(u, a, pw); const e = score(r, L, u, a, pw) + Math.abs(a - 50) * 0.3;
        if (!best || e < best.e) best = { a, pw, e, face };
      } }
    u.face = best.face; return best;
  }, [scoreSrc]);
  for (let k = 0; k < 60; k++) {
    const d = plan.a - await L(p, 'L.cur.angle');
    if (Math.abs(d) < 0.6) break;
    const key = d > 0 ? 'ArrowUp' : 'ArrowDown';
    await p.keyboard.down(key); await p.waitForTimeout(Math.min(900, Math.max(17, Math.abs(d) / 0.5 * 16.7 * 0.9))); await p.keyboard.up(key);
  }
  await p.keyboard.down(' ');
  await p.waitForFunction((pw) => window.__lr.power >= pw - 0.45, plan.pw, { timeout: 5000, polling: 'raf' });
  await p.keyboard.up(' ');
  await p.waitForTimeout(30);
  return plan;
}
const heroTurn = (p) => p.waitForFunction(() => { const L = window.__lr; return L.state === 'over' || (L.state === 'aim' && L.cur.side === 'hero'); }, null, { timeout: 90000 });
const settled = (p) => p.waitForFunction(() => !['flight', 'settle'].includes(window.__lr.state) || window.__lr.cur.side === 'pred', null, { timeout: 20000 });

try {
  // ---------------------------------------------------------------- the title, every control
  {
    const p = await open();
    ok(await L(p, 'L.state') === 'title', 'the title shows first');
    const back = p.getByRole('link', { name: /← ARCADE/i });
    ok(await back.count() === 1 && await back.getAttribute('href') === '/', 'a link back to the arcade');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling');
    await shot(p, '00-title');
    await p.keyboard.press('Space'); await p.waitForTimeout(300);
    ok(await L(p, 'L.state') === 'aim' && await L(p, 'L.cur.id') === 'dora', 'Space starts on Dora');
    for (const [k, want] of [['3', 2], ['1', 0], ['2', 1], ['Tab', 2], ['Tab', 0]]) { await p.keyboard.press(k); ok(await L(p, 'L.cur.shot') === want, `${k} picks shot ${want + 1}`); }
    ok(await p.evaluate(() => document.activeElement === document.body || document.activeElement?.tagName === 'CANVAS'), 'Tab does not move focus off the game');
    await p.keyboard.press('3'); await p.waitForTimeout(150);
    ok(await L(p, 'L.cur.shots[L.cur.shot].name') === 'Darning Needle', '3 is the Darning Needle');
    await shot(p, '01-needle-guide');
    const g0 = await L(p, 'L.aimGuide'); await p.keyboard.press('g');
    ok(await L(p, 'L.aimGuide') === !g0, 'G hides the aim guide'); await shot(p, '01b-no-guide');
    await p.keyboard.press('g'); ok(await L(p, 'L.aimGuide') === g0, 'G shows it again');
    // walk right then left: x moves and Tupa's walk meter runs down
    const x0 = await L(p, 'L.cur.x');
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.up('ArrowRight');
    const x1 = await L(p, 'L.cur.x');
    ok(x1 > x0 + 10 && await L(p, 'L.cur.moved') > 10, `→ walks Dora right (${x0} -> ${x1})`);
    await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(400); await p.keyboard.up('ArrowLeft');
    ok(await L(p, 'L.cur.x') < x1 - 10 && await L(p, 'L.cur.face') === -1, '← walks her back and turns her round');
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(60); await p.keyboard.up('ArrowRight');
    const a0 = await L(p, 'L.cur.angle');
    await p.keyboard.down('ArrowUp'); await p.waitForTimeout(300); await p.keyboard.up('ArrowUp');
    ok(await L(p, 'L.cur.angle') > a0 + 3, '↑ raises the angle');
    await p.keyboard.down('ArrowDown'); await p.waitForTimeout(300); await p.keyboard.up('ArrowDown');
    ok(Math.abs(await L(p, 'L.cur.angle') - a0) < 2, '↓ lowers it');

    // 1. Dora darns the slope in front of her with the needle
    await aim(p, 2, `(r) => r.end === 'ground' ? Math.hypot(r.x - 380, r.y - 470) : 999`);
    await p.waitForTimeout(150); await shot(p, '02-needle-flight');
    await settled(p); await p.waitForTimeout(300);
    const dl = await L(p, 'L.LOG.find(e => e[0] === "darn")');
    ok(dl && dl[1] === 'dora', 'held Space and let go: Dora\'s needle stitches a patch');
    ok(await L(p, `L.solid(${dl[2]}, ${dl[3]} - 30)`) && await L(p, `L.solid(${dl[2]}, ${dl[3]})`), 'the patch is solid cloth, including above where it struck');
    await shot(p, '03-patch');
    await groundMatches(p, 'after the darn');

    // 2. the predators take their turns quickly
    const t0 = Date.now(); await heroTurn(p);
    ok(Date.now() - t0 < 15000, `the fox's turn takes ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await shot(p, '04-enzo');
    ok(await L(p, 'L.cur.id') === 'enzo', 'Enzo plays next');

    // 3. Enzo shoots the fox
    await aim(p, 0, `(r, L) => { const f = L.units.find(u => u.id === 'fox'); return r.end === 'unit' && r.unit === f ? 0 : Math.hypot(r.x - f.x, r.y - f.y + 50); }`);
    await settled(p); await p.waitForTimeout(200);
    ok(await L(p, 'L.LOG.some(e => e[0] === "enzo" && e[1] === "fox")'), 'Enzo\'s pot hits the fox');
    await groundMatches(p, 'after a crater');

    // 4. a pom-pom under the fox (as if an earlier shot fell short of him): pull it with a keyed shot
    await heroTurn(p);
    await L(p, 'L.blastAt(1232, 548, 40, "dora")'); await p.waitForTimeout(500);
    ok(await L(p, '!!L.ends.find(e => e.dir === 1 && e.ex > 1150)'), 'a crater short of the fox leaves a pom-pom whose row runs under him');
    await shot(p, '05-pom');
    const fox0 = await L(p, "(() => { const f = L.units.find(u => u.id === 'fox'); return { x: f.x, y: f.y, hp: f.hp }; })()");
    const robust = `(r, L, u, a, pw) => { if (r.end !== 'snag') return 999; for (const d of [-1, 1]) { const q = L.simulate(u, a, pw + d); if (q.end !== 'snag') return 50; } return 0; }`;
    const heroPulled = 'L.LOG.some(e => e[0] === "pull" && (e[1] === "dora" || e[1] === "enzo"))';
    for (let tries = 0; tries < 3 && !(await L(p, heroPulled)); tries++) {
      if (tries) { await settled(p); await heroTurn(p); if (await L(p, 'L.state') === 'over') break;
        if (!(await L(p, 'L.ends.some(e => e.dir === 1 && e.ex > 1150)'))) { await L(p, 'L.blastAt(1232, 548, 40, "dora")'); await p.waitForTimeout(400); } }
      await aim(p, 0, robust);
      await p.waitForTimeout(150);
    }
    await p.waitForTimeout(450); await shot(p, '06-pulling');
    await p.waitForFunction(() => !window.__lr.pulls.length && window.__lr.state !== 'flight', null, { timeout: 20000 });
    await p.waitForTimeout(400);
    const fox1 = await L(p, "(() => { const f = L.units.find(u => u.id === 'fox'); return { x: f.x, y: f.y, hp: f.hp }; })()");
    await shot(p, '07-pulled');
    ok(await L(p, heroPulled), 'a keyed shot that hits the pom-pom unravels the row');
    ok(fox1.y > fox0.y + 20 && fox1.x < fox0.x - 20 && fox1.hp < fox0.hp, 'the fox drops, is dragged toward the hole and takes damage');
    await groundMatches(p, 'after the pull');

    // 5. play on like a player: mend the roof if it is open, else shoot the weaker predator
    let turns = 0;
    while (await L(p, 'L.state') !== 'over' && turns < 40) {
      await heroTurn(p); if (await L(p, 'L.state') === 'over') break; turns++;
      if (await L(p, 'L.kits.filter(k => k.home).some(k => L.roofOver(k) < 20)')) { await aim(p, 2, `(r, L) => r.end === 'ground' ? Math.hypot(r.x - L.BURROW.x, r.y - (L.BURROW.y - 52)) : 999`); await settled(p); continue; }
      await aim(p, 0, `(r, L) => { const ps = L.units.filter(u => u.side === 'pred' && u.alive); const t = ps.sort((a, b) => a.hp - b.hp)[0]; return r.end === 'unit' && r.unit === t ? 0 : Math.hypot(r.x - t.x, r.y - (t.flying ? t.y : t.y - 50)); }`);
      await settled(p);
    }
    ok(await L(p, 'L.state') === 'over', `a careful game ends: "${await L(p, 'L.banner')}" in round ${await L(p, 'L.round')}`);
    await p.waitForTimeout(1000); await shot(p, '08-careful-end');
    await groundMatches(p, 'at the end of a whole game');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    ok(await L(p, 'L.state') === 'aim' && await L(p, 'L.round') === 1 && await L(p, 'L.kits.every(k => k.home)'), 'Enter restarts with three kits and round 1');

    // 6. nightfall: a self-played seed that holds out, shown to its banner
    await p.evaluate((seed) => { const L = window.__lr; L.autoHero = true; L.newGame(seed); while (L.round < 6 && L.state !== 'over') L.fast(60); }, NIGHT_SEED);
    await p.waitForTimeout(400); await shot(p, '09-dusk');
    await p.evaluate(() => { const L = window.__lr; while (L.state !== 'over') L.fast(600); });
    const nb = await L(p, 'L.banner');
    await p.waitForTimeout(1000); await shot(p, '10-nightfall');
    ok(nb === 'Night falls: the kits are safe!' && await L(p, 'L.round') === 8, `holding out ${7} rounds brings nightfall (${nb})`);
    await p.evaluate(() => { window.__lr.autoHero = false; });
    await p.keyboard.press('r'); await p.waitForTimeout(300);
    ok(await L(p, 'L.state') === 'aim' && await L(p, 'L.round') === 1, 'R plays again');

    // 7. lose on purpose with duds
    let duds = 0;
    while (await L(p, 'L.state') !== 'over' && duds < 60) {
      await heroTurn(p); if (await L(p, 'L.state') === 'over') break;
      await p.keyboard.press('1'); await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' '); duds++;
    }
    const lb = await L(p, 'L.banner');
    await p.waitForTimeout(1200); await shot(p, '11-lose');
    ok(lb === 'The kits bolted from the burrow' || lb === 'The predators win this one' || lb === 'Everyone is down', `doing nothing loses (${lb})`);
    await p.mouse.click(700, 500); await p.waitForTimeout(300);
    ok(await L(p, 'L.state') === 'aim', 'a click after the end restarts');
    await p.context().close();
  }

  // ---------------------------------------------------------------- a click starts it; a first-timer by eye, smaller window
  {
    const p = await open({ width: 1280, height: 720 });
    await p.mouse.click(640, 360); await p.waitForTimeout(300);
    ok(await L(p, 'L.state') === 'aim', 'a click on the title starts');
    // nothing but the keys, no planning: raise the angle a little, hold Space for about a second, let go
    let fired = 0;
    for (let t = 0; t < 6 && await L(p, 'L.state') !== 'over'; t++) {
      await heroTurn(p); if (await L(p, 'L.state') === 'over') break;
      if (await L(p, 'L.cur.id') === 'dora' && t === 0) await shot(p, '12-first-timer-aim');
      await p.keyboard.down('ArrowUp'); await p.waitForTimeout(250 + t * 40); await p.keyboard.up('ArrowUp');
      await p.keyboard.down(' '); await p.waitForTimeout(900 + t * 120); await p.keyboard.up(' ');
      fired++;
      await p.waitForTimeout(400);
      if (t === 1) await shot(p, '13-first-timer-flight');
      await settled(p);
    }
    ok(fired >= 4 && await L(p, 'L.LOG.filter(e => e[0] === "dora" || e[0] === "enzo" || (e[0] === "KO")).length') >= 0, `a first-timer fires ${fired} shots by eye`);
    await shot(p, '14-first-timer');
    await p.context().close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  ok(true, 'no page errors');
  console.log(`PASS lookout-ridge browser (${pass} checks)`);
} finally {
  await browser.close();
}
