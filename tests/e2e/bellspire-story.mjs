// The Sunken Bellspire in a browser: the expansions' people and endings. Talk to Killa and Suma at every stage of
// the story (pressing Up beside them and clicking through each line), check their names and portraits and that their
// sprites use the talk frames while they speak; calm each expansion's last guardian and click through its ending
// scene, with and without everything found; and open each "See the … epilogue" title button.
// Run against a build: BASE_URL=http://localhost:3123 node tests/e2e/bellspire-story.mjs (STORY_SHOTS=<folder> saves screenshots).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ABILITY_ORDER, ALL_BOSSES, SALT_GUARDIANS, ORCHARD_GUARDIANS, GLACIER_GUARDIANS, INFO, ROOMS, COLS, ROWS, freshSave, isOrchardRoom, roomById } from '../../.checks/bellspire-game.js';

const base = process.env.BASE_URL ?? 'http://localhost:3109';
const shots = process.env.STORY_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const before = (a) => ABILITY_ORDER.slice(0, ABILITY_ORDER.indexOf(a));
const others = ALL_BOSSES.filter((b) => ![...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS].includes(b));

function save(shrine, flags = []) {
  const s = freshSave();
  s.abilities = [...ABILITY_ORDER];
  s.flags.push('script:intro', 'script:firstDark', 'script:belfryCall', 'script:trials', 'script:foundryCall', 'keeper', 'epilogue', 'epilogue2', 'epilogue3',
    'unlock:salt', 'unlock:orchard', 'unlock:glacier', 'salt:visited', 'orchard:visited', 'glacier:visited', ...others.map((b) => `boss:${b}`), ...flags);
  s.shrine = shrine;
  for (const h of Object.values(s.heroes)) { h.level = 30; h.hp = 200; h.mp = 100; }
  return s;
}
async function open(s, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/bellspire`);
  await page.evaluate((s) => {
    localStorage.setItem('bellspire-v1', JSON.stringify(s));
    localStorage.setItem('bellspire-v1-settings', JSON.stringify({ sound: false, music: false, shake: false }));
  }, s);
  await page.reload();
  await page.locator('main[data-ready="true"]').waitFor();
  return { page, errors };
}
/** The dialog box as it stands: the speaker's name, the words and the portrait's painting (null when none is up). */
const readDialog = (page) => page.evaluate(() => {
  const d = document.querySelector('.bs-dialog');
  if (!d) return null;
  const name = d.querySelector('b')?.textContent ?? '', text = d.querySelector('.bs-dialog-text')?.textContent ?? '';
  const p = d.querySelector('.bs-npc-portrait');
  return { name, text: text.slice(name.length), portrait: p ? getComputedStyle(p).backgroundImage : '' };
});
/** Click the dialog on to its next line, and wait until that line (or nothing) is showing. */
async function advance(page, cur) {
  await page.locator('.bs-dialog').click({ timeout: 2000 }).catch(() => {});
  await page.waitForFunction((t) => { const d = document.querySelector('.bs-dialog-text'); return !d || d.textContent !== t; }, cur.name + cur.text, { timeout: 3000 });
  return readDialog(page);
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`) }); };

// ─── Killa and Suma, at every stage ────────────────────────────────────────
const NPCS = {
  killa: { room: 'orchard-wicket', ch: 'q', stages: [
    ['meet', before('bloom'), [...SALT_GUARDIANS], false, ['orchard:visited']],
    ['bloom', before('bloom'), [...SALT_GUARDIANS], true, ['orchard:visited']],
    ['shear', before('shear'), [...SALT_GUARDIANS], true, ['orchard:visited']],
    ['stag', before('sunmirror'), [...SALT_GUARDIANS], true, ['orchard:visited']],
    ['rootback', before('sunmirror'), [...SALT_GUARDIANS, 'bracken-stag'], true, ['orchard:visited']],
    ['mother', before('sunmirror'), [...SALT_GUARDIANS, 'bracken-stag', 'rootback'], true, ['orchard:visited']],
    ['rootlift', before('sunmirror'), [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], true, ['orchard:visited']],
    ['stair', before('sunmirror'), [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], true, ['orchard:visited', 'glacier:visited']],
    ['pass', ABILITY_ORDER, [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS], true, ['orchard:visited', 'glacier:visited']],
  ] },
  suma: { room: 'salt-gate', ch: ';', stages: [
    ['meet', before('ballast'), [], false],
    ['shift', before('ballast'), [], true],
    ['catch', before('catch'), [], true],
    ['weighmaster', before('bloom'), [], true],
    ['panback', before('bloom'), ['weighmaster'], true],
    ['tollkeeper', before('bloom'), ['weighmaster', 'panback'], true],
    ['wicket', before('bloom'), [...SALT_GUARDIANS], true],
    ['orchard', before('sunmirror'), [...SALT_GUARDIANS], true, ['orchard:visited']],
    ['mother', before('sunmirror'), [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], true, ['orchard:visited']],
    ['pass', ABILITY_ORDER, [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS], true, ['orchard:visited', 'glacier:visited']],
  ] },
};
for (const [who, npc] of Object.entries(NPCS)) {
  const { page, errors } = await open(save(npc.room === 'salt-gate' ? 'salt-toll-road' : 'orchard-wicket'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__bellspire().game);
  const t = INFO.get(npc.room).things.find((th) => th.ch === npc.ch), r = roomById(npc.room);
  const said = new Set();
  for (const [stage, abil, bosses, met, visited = []] of npc.stages) {
    // set the story to this stage: abilities, guardians calm, the areas visited, and whether they have met
    await page.evaluate(({ abil, bosses, met, who, visited }) => {
      const g = window.__bellspire().game;
      g.save.abilities = [...abil];
      const keep = g.save.flags.filter((f) => !/^boss:(weighmaster|panback|tollkeeper|bracken-stag|rootback|graft-mother|glass-vicuna|serac-osjollo|sun-gate)$/.test(f)
        && f !== `script:${who}` && f !== 'orchard:visited' && f !== 'glacier:visited');
      g.save.flags = [...keep, ...visited, ...bosses.map((b) => `boss:${b}`), ...(met ? [`script:${who}`] : [])];
    }, { abil, bosses, met, who, visited });
    // stand just within reach on her left, facing her, so she stays in view
    await page.evaluate(([room, c, rr]) => window.__bellspire().teleport(room, c, rr), [npc.room, t.c - 1 - r.gx * COLS, t.r - r.gy * ROWS]);
    await page.waitForFunction(() => window.__bellspire().game.body.ground);
    await page.evaluate((x) => { const g = window.__bellspire().game; g.body.x = x; g.body.face = 1; g.follower.x = x - 30; }, t.c * 16 + 8 - 19);
    await page.keyboard.press('ArrowUp');
    const dialog = page.locator('.bs-dialog');
    await dialog.waitFor({ timeout: 4000 });
    const lines = [];
    let sawPortrait = false;
    for (let i = 0, cur = await readDialog(page); i < 12 && cur; i++) {
      lines.push(`${cur.name}: ${cur.text}`);
      if (cur.name === (who === 'killa' ? 'Killa' : 'Suma')) {
        sawPortrait ||= cur.portrait.includes(`${who}-portrait`);
        if (i === 0) await shot(page, `story-${who}-${stage}`);
      }
      cur = await advance(page, cur);
    }
    ok(lines.length >= 1 && lines.some((l) => l.startsWith(who === 'killa' ? 'Killa:' : 'Suma:')), `${who} ${stage}: speaks as ${who}: ${lines.join(' / ')}`);
    ok(!lines.some((l) => l.startsWith(': ')), `${who} ${stage}: no unnamed sign lines`);
    ok(sawPortrait, `${who} ${stage}: her own portrait`);
    if (stage === 'meet') ok(lines.some((l) => l.startsWith('Dora:')) && lines.some((l) => l.startsWith('Enzo:')), `${who} meets Dora and Enzo, and both reply`);
    const key = lines.join(' / ');
    ok(!said.has(key), `${who} ${stage}: a new line for this stage`);
    said.add(key);
  }
  ok(errors.length === 0, `${who}: no page errors: ${errors.join(' | ')}`);
  await page.close();
}

// ─── the talk frames: sampled from the scene while each speaks ─────────────
{
  const { page } = await open(save('orchard-wicket', [...SALT_GUARDIANS].map((b) => `boss:${b}`)));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__bellspire().game);
  const frames = await page.evaluate(() => {
    const sc = window.__bellspire().scene, g = window.__bellspire().game, seen = [];
    const orig = sc.spr.bind(sc);
    sc.spr = (name, f, ...rest) => { if (name === 'killa' || name === 'suma') seen.push(`${name}:${f}:${g.dialog?.lines[g.dialog.i]?.who ?? '-'}`); return orig(name, f, ...rest); };
    window.__frames = seen;
    return true;
  });
  ok(frames, 'hooked the scene');
  const t = INFO.get('orchard-wicket').things.find((th) => th.ch === 'q'), r = roomById('orchard-wicket');
  await page.evaluate(([c, rr]) => window.__bellspire().teleport('orchard-wicket', c, rr), [t.c - r.gx * COLS, t.r - r.gy * ROWS]);
  await page.waitForTimeout(3000);
  await page.keyboard.press('ArrowUp');
  await page.locator('.bs-dialog').waitFor();
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => window.__frames.splice(0));
  const idle = new Set(seen.filter((s) => s.endsWith(':-')).map((s) => s.split(':')[1]));
  const talk = new Set(seen.filter((s) => s.endsWith(':killa')).map((s) => s.split(':')[1]));
  ok([...idle].every((f) => f === '0' || f === '1') && idle.has('0'), `Killa idles on frames 0 and 1: ${[...idle]}`);
  ok([...talk].every((f) => f === '2' || f === '3') && talk.size === 2, `Killa talks on frames 2 and 3: ${[...talk]}`);
  await page.close();
}

// ─── each expansion's ending scene, short of and at 100% ───────────────────
const AREA = {
  salt: { last: 'tollkeeper', before: [], shrine: 'salt-toll-road', rooms: ROOMS.filter((r) => r.salt), name: 'Salt Road' },
  orchard: { last: 'graft-mother', before: [...SALT_GUARDIANS], shrine: 'orchard-wicket', rooms: ROOMS.filter(isOrchardRoom), name: 'Night Orchard' },
  glacier: { last: 'sun-gate', before: [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], shrine: 'glacier-camp', rooms: ROOMS.filter((r) => r.glacier), name: 'Glacier Stair' },
};
const GUARDS = { salt: SALT_GUARDIANS, orchard: ORCHARD_GUARDIANS, glacier: GLACIER_GUARDIANS };
for (const [area, a] of Object.entries(AREA)) {
  for (const full of [false, true]) {
    const s = save(a.shrine, [...a.before, ...GUARDS[area].filter((b) => b !== a.last)].map((b) => `boss:${b}`));
    if (full) for (const r of a.rooms) {
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) s.seen.push(`${r.gx + x},${r.gy + y}`);
      for (const t of INFO.get(r.id).things) if (t.ch === 'C') s.flags.push(`chest:${r.id}:${t.i}`);
      for (const n of r.murals ?? []) s.flags.push(`mural:${n}`);
    }
    const { page, errors } = await open(s);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForFunction(() => window.__bellspire().game);
    await page.evaluate((id) => { const g = window.__bellspire().game; g.fightBoss(id); g.boss.hp = 0; g.bossDone(); }, a.last);
    const dialog = page.locator('.bs-dialog');
    await dialog.waitFor();
    const speakers = new Set();
    for (let i = 0, cur = await readDialog(page); i < 12 && cur; i++) {
      speakers.add(cur.name);
      if (i === 1) await shot(page, `story-${area}-ending-scene`);
      cur = await advance(page, cur);
    }
    ok(speakers.has('Dora') && speakers.has('Enzo') && [...speakers].some((n) => ['Suma', 'Killa', 'Phuyu'].includes(n)), `${area}: the ending scene has its people: ${[...speakers]}`);
    const end = page.locator(`main.bs-end[data-area="${area}"]`);
    await end.waitFor();
    ok((await end.getAttribute('data-full')) === (full ? 'true' : 'false'), `${area}${full ? ' 100%' : ''}: ${full ? 'the epilogue' : 'the ending'} page`);
    const stats = await end.locator('.bs-end-stats').textContent();
    ok(stats.includes(`${a.name} explored`) && stats.includes('guardians') && stats.includes('Dora level') && /\d+h \d\dm/.test(stats), `${area}: full stats: ${stats}`);
    if (full) ok(stats.includes('explored 100%'), `${area}: 100%`);
    const art = await end.locator('.bs-end-art').evaluate((el) => getComputedStyle(el).backgroundImage);
    ok(art.includes(full ? `epilogue-${area}` : area === 'glacier' ? 'ending-glacier' : area === 'salt' ? 'ending4' : 'ending5'), `${area}: the right painting: ${art}`);
    const loaded = await end.locator('.bs-end-art').evaluate(async (el) => { const u = getComputedStyle(el).backgroundImage.slice(5, -2); const im = new Image(); im.src = u; await im.decode(); return im.naturalWidth; });
    ok(loaded === 480, `${area}: the painting loads (${loaded} px wide)`);
    if (area !== 'glacier') ok((await end.locator('.bs-end-next').textContent()).length > 20, `${area}: what's next`);
    await shot(page, `story-${area}-${full ? 'epilogue' : 'ending'}`);
    // Keep exploring returns to play
    await end.getByRole('button', { name: 'Keep exploring' }).click();
    await page.waitForFunction(() => window.__bellspire().screen === 'game');
    ok(true, `${area}: keep exploring`);
    // and the title has its epilogue button once earned
    await page.goto(`${base}/bellspire`);
    await page.locator('main[data-ready="true"]').waitFor();
    const btn = page.getByRole('button', { name: `See the ${a.name} epilogue` });
    ok((await btn.count()) === (full ? 1 : 0), `${area}: the title ${full ? 'has' : 'has no'} "See the ${a.name} epilogue"`);
    if (full) {
      await btn.click();
      await page.locator(`main.bs-end[data-area="${area}"][data-full="true"]`).waitFor();
      ok(true, `${area}: the title button opens the epilogue`);
      await page.getByRole('button', { name: 'Title' }).click();
      await page.locator('.bs-title').waitFor();
      if (area === 'glacier') await shot(page, 'story-title-buttons');
    }
    ok(errors.length === 0, `${area}: no page errors: ${errors.join(' | ')}`);
    await page.close();
  }
}
// the phone layout of one epilogue, upright and sideways: the whole painting shows, the words sit clear of it, and
// the buttons stay on screen
for (const [w, h] of [[390, 844], [844, 390]]) {
  const s = save('salt-toll-road', [...SALT_GUARDIANS.map((b) => `boss:${b}`), 'salt:ending', 'salt:epilogue']);
  const { page } = await open(s, { width: w, height: h });
  await page.getByRole('button', { name: 'See the Salt Road epilogue' }).click();
  await page.locator('main.bs-end[data-area="salt"]').waitFor();
  await shot(page, `story-salt-epilogue-phone-${w}x${h}`);
  const box = await page.locator('.bs-end-panel').boundingBox(), art = await page.locator('.bs-end-art').boundingBox();
  ok(box.x >= 0 && box.x + box.width <= w, `${w}×${h}: the epilogue panel fits a phone`);
  const ix = Math.max(0, Math.min(art.x + art.width, box.x + box.width) - Math.max(art.x, box.x)), iy = Math.max(0, Math.min(art.y + art.height, box.y + box.height) - Math.max(art.y, box.y));
  ok(ix * iy === 0 && Math.abs(art.width / art.height - 16 / 9) < 0.02 && art.x >= 0 && art.x + art.width <= w + 1, `${w}×${h}: the whole painting shows, clear of the words`);
  const btn = await page.getByRole('button', { name: 'Title' }).boundingBox();
  ok(btn.y >= 0 && btn.y + btn.height <= h, `${w}×${h}: the buttons are on screen`);
  await page.getByRole('button', { name: 'Title' }).click();
  await page.locator('.bs-title').waitFor();
  await page.close();
}
await browser.close();
console.log(`bellspire story e2e: ${checks} checks passed`);
