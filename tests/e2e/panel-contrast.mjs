// app/globals.css styles bare `p` and `footer` elements for the arcade's dark shell.
// An element selector beats inheritance, so a game panel that sets its own `color`
// and expects its paragraphs to inherit it silently loses: the text renders in the
// dark-shell grey instead. On a light panel that is unreadable — it made the Dusty
// Hollow dialogue and the Dust & Documents: Remake footer nearly invisible.
//
// This test walks every game and finds each `p`/`footer` that took the global colour
// instead of its parent's. It FAILS on a leak that lands below readable contrast;
// leaks onto dark panels, where the grey happens to read fine, are reported as drift
// so a restyle isn't forced. Fix a failure in the game's own stylesheet by handing the
// colour back (`color: inherit`, or the panel's own token).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROUTES = ['', 'fighter', 'checkpoint-remake', 'checkpoint', 'escape', 'adventure', 'chin-x-pit',
  'survival', 'kart', 'soccer', 'hop', 'dust-bath', 'mountain-retreat', 'paw-buster', 'burrow-town', 'dusty-hollow'];
// The two colours app/globals.css hands to bare `p` and `footer`.
const GLOBAL = ['rgb(210, 213, 212)', 'rgb(137, 158, 170)'];

const PROBE = (globals) => {
  const px = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
  // Composite ancestor backgrounds until one is opaque. A gradient anywhere up the
  // chain means the painted colour isn't knowable from computed styles, so skip it.
  const bgOf = (el) => {
    let acc = null, n = el;
    while (n) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = px(cs.backgroundColor), a = c.length === 4 ? c[3] : 1;
      if (a > 0.001) {
        const rgb = c.slice(0, 3);
        acc = acc === null ? { rgb, a } : { rgb: over(acc.rgb, acc.a, rgb), a: acc.a + a * (1 - acc.a) };
        if (acc.a >= 0.995) return acc.rgb.map(Math.round);
      }
      n = n.parentElement;
    }
    return acc ? acc.rgb.map(Math.round) : [23, 25, 30];
  };
  const out = [];
  for (const el of document.querySelectorAll('p, footer')) {
    const col = getComputedStyle(el).color;
    if (!globals.includes(col)) continue;            // not a colour the global rule sets
    const parent = el.parentElement;
    if (!parent || getComputedStyle(parent).color === col) continue;  // inherited legitimately
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    out.push({
      tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 45),
      leaked: col, wanted: getComputedStyle(parent).color,
      bg: `rgb(${bg.join(', ')})`, cr: Math.round(ratio(px(col).slice(0, 3), bg) * 100) / 100,
    });
  }
  return out;
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.setDefaultTimeout(20000);
  const failures = [], drift = [];
  const MIN = 4.5;  // below this the leaked text is not readable on its panel
  for (const route of ROUTES) {
    await page.goto(`http://localhost:3000/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const leaks = await page.evaluate(PROBE, GLOBAL);
    for (const l of leaks) {
      const line = `/${route} <${l.tag}> "${l.text}" is ${l.leaked} on ${l.bg} (contrast ${l.cr}); its panel wanted ${l.wanted}`;
      (l.cr < MIN ? failures : drift).push(line);
    }
    const bad = leaks.filter((l) => l.cr < MIN).length;
    console.log(`${bad ? 'FAIL' : 'PASS'} /${route || ''} — ${bad} unreadable, ${leaks.length - bad} benign leak(s)`);
  }
  if (drift.length) console.log(`\nBenign colour drift (readable, but not the panel's intended colour):\n  ${drift.join('\n  ')}`);
  assert.deepEqual(failures, [], `\n  ${failures.join('\n  ')}\n`);
  console.log(`\nPanel contrast: ${ROUTES.length} routes, no unreadable colour leaks`);
} finally { await browser.close(); }
