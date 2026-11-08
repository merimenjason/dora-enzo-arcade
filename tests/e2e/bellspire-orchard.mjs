import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { roomById, roomRect, TILE } from '../../.checks/bellspire-game.js';
import { ORCHARD_EXIT, ORCHARD_RETURN, graftFlag } from '../../.checks/bellspire-orchard-world.js';
import { orchardSave } from '../bellspire-orchard.mjs';

const base = process.env.BASE_URL ?? 'http://localhost:3109';
const viewports = [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 390, height: 844 }];
const browser = await chromium.launch();
const point = (room, column) => roomRect(roomById(room)).x + (column + 0.5) * TILE;
const rightKey = (d) => d > 0 ? 'ArrowRight' : 'ArrowLeft';

async function play(viewport) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
  const remap = viewport.width >= 1000;
  const controls = { jump: 'KeyZ', use: remap ? 'KeyE' : 'ArrowUp', attack: remap ? 'KeyF' : 'KeyX', tag: remap ? 'KeyQ' : 'ShiftLeft' };
  let checks = 0;
  const check = (v, msg) => { assert.ok(v, msg); checks++; };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const save = orchardSave('dora', false);
  for (const h of Object.values(save.heroes)) { h.level = 20; h.hp = 200; h.mp = 100; }
  save.equip.dora.weapon = 'bronze-sword';
  await page.addInitScript((s) => localStorage.setItem('bellspire-v1', JSON.stringify(s)), save);
  if (remap) await page.addInitScript(({ use, attack, tag }) => {
    localStorage.setItem('bellspire-v1-settings', JSON.stringify({ keys: { up: [use], attack: [attack], tag: [tag] } }));
  }, controls);
  const state = () => page.evaluate(() => {
    const g = window.__bellspire().game, b = g.body;
    return { room: g.room.id, x: b.x, y: b.y, ground: b.ground, climb: b.climb, face: b.face, lead: g.lead,
      hp: g.save.heroes[g.lead].hp, dialog: !!g.dialog, abilities: g.save.abilities, flags: g.save.flags,
      riding: g.riding, act: g.leadRt.act?.kind ?? null, target: g.orchardControl(),
      boss: g.boss && { x: g.boss.x, y: g.boss.y, st: g.boss.st, hp: g.boss.hp } };
  });
  const pause = (ms) => page.waitForTimeout(ms);
  async function until(pred, description, ms = 12000) {
    const end = Date.now() + ms;
    do {
      const s = await state();
      if (pred(s)) return s;
      await pause(40);
    } while (Date.now() < end);
    throw new Error(`${description}: ${JSON.stringify(await state())}`);
  }
  async function dismiss() {
    for (let i = 0; i < 12 && (await state()).dialog; i++) { await page.keyboard.press(controls.jump); await pause(70); }
  }
  async function tag(hero) {
    if ((await state()).lead === hero) return;
    await until((s) => s.ground, 'land before tagging');
    for (let i = 0; i < 4 && (await state()).lead !== hero; i++) {
      await page.keyboard.press(controls.tag);
      await pause(420);
    }
    check((await state()).lead === hero, `tagged to ${hero}`);
  }
  async function jump() {
    await page.keyboard.down(controls.jump);
    await pause(306);
    await page.keyboard.up(controls.jump);
    await pause(145);
  }
  async function drive(x, { flat = false } = {}) {
    const start = await state();
    const dir = x >= start.x ? 1 : -1;
    if (Math.abs(x - start.x) < 4) return;
    const key = rightKey(dir);
    await page.keyboard.down(key);
    try {
      let lastX = start.x, stalled = 0;
      const deadline = Date.now() + 27000;
      while (Date.now() < deadline) {
        const s = await state();
        if ((s.x - x) * dir >= -2) return;
        if (s.dialog) { await page.keyboard.up(key); await dismiss(); await page.keyboard.down(key); }
        const hazard = !flat && s.ground && await page.evaluate((dir) => {
          const { body: b, env } = window.__bellspire().game;
          for (let d = 21; d <= 38; d += 4) {
            const c = Math.floor((b.x + d * dir) / 16), r = Math.ceil(b.y / 16) - 1;
            if (env.hazard(c, r) || env.hazard(c, r + 1)) return true;
          }
          return false;
        }, dir);
        stalled = Math.abs(lastX - s.x) < 1 && s.ground ? stalled + 1 : 0;
        if (!flat && (hazard || stalled >= 3)) { stalled = 0; await jump(); }
        lastX = s.x;
        await pause(55);
      }
      throw new Error(`walk stalled on way to x=${x}: ${JSON.stringify(await state())}`);
    } finally { await page.keyboard.up(key); }
  }
  async function jumpTo(id, col, row, dir) {
    await drive(point(id, col));
    await until((s) => s.ground, `${id}: stand before jumping`);
    const key = rightKey(dir), target = roomRect(roomById(id)).y + row * TILE;
    await page.keyboard.down(key);
    try {
      await jump();
      await until((s) => s.ground && Math.abs(s.y - target) < 1, `${id}: land on branch at row ${row}`, 2600);
    } finally { await page.keyboard.up(key); }
    check(true, `${id}: jumped onto row ${row}`);
  }
  async function cross(id, col) {
    await drive(point(id, col));
    check((await state()).room === id, `reached ${id}`);
    if (process.env.ORCHARD_TRACE) console.log(`${viewport.width}: reached ${id}`);
  }
  const prompt = (s) => page.getByText(s, { exact: false }).first();
  async function graft(id, index, stage) {
    const spec = roomById(id).grafts[index];
    const [c] = stage === 'bloom' ? spec.bud : spec.tie;
    const action = stage === 'bloom' ? controls.use : controls.attack;
    const hero = stage === 'bloom' ? 'enzo' : 'dora';
    const text = stage === 'bloom' ? 'Wake the golden bud' : 'Cut the ochre tie';
    const flag = graftFlag(id, index, stage);
    await drive(point(id, c));
    if (remap && (await state()).lead !== hero) {
      await prompt(stage === 'bloom' ? 'Q · Tag to Enzo to wake the bud' : 'Q · Tag to Dora to cut the tie').waitFor({ timeout: 5000 });
      checks++;
    }
    await tag(hero);
    await prompt(text).waitFor({ timeout: 4500 });
    check(await prompt(text).isVisible(), `${id}: ${text} prompt`);
    if (remap) check(await prompt(`${stage === 'bloom' ? 'E' : 'F'} · ${text}`).isVisible(), `${id}: prompt shows the bound key`);
    for (let i = 0; i < 4 && !(await state()).flags.includes(flag); i++) {
      await page.keyboard.press(action);
      await pause(470);
    }
    check((await state()).flags.includes(flag), `${id}: ${stage} with ${hero}`);
    await prompt(text).waitFor({ state: 'hidden', timeout: 3500 });
    checks++;
  }
  async function downShaft(from, to, col) {
    await drive(point(from, col));
    await page.keyboard.down('ArrowDown');
    try { await until((s) => s.room === to && s.y > roomRect(roomById(to)).y + 128, `climb from ${from} to ${to}`); }
    finally { await page.keyboard.up('ArrowDown'); }
    checks++;
  }
  async function guardian(id) {
    let status = await until((s) => s.boss, `${id}: guardian appeared`);
    const flag = `boss:${id}`;
    for (let cycle = 0; cycle < 6 && status.boss && !status.flags.includes(flag); cycle++) {
      if (status.dialog) await dismiss();
      status = await until((s) => s.target, `${id}: the arena control`, 9000);
      await drive(status.target.x);
      await tag('enzo');
      await until((s) => s.boss?.st === 'orchardRest', `${id}: gold bud is ready`);
      await prompt('Wake the golden bud').waitFor({ timeout: 2500 });
      await page.keyboard.press(controls.use);
      await until((s) => s.boss?.st === 'orchardCaught', `${id}: Enzo caught the attack`);
      await tag('dora');
      await prompt('Cut the ochre tie').waitFor({ timeout: 3500 });
      await page.keyboard.press(controls.attack);
      status = await until((s) => s.boss?.st === 'orchardOpen', `${id}: Dora exposed the weak point`);
      check(true, `${id}: both heroes were used`);
      const side = Math.sign(status.x - status.boss.x) || -1;
      await drive(status.boss.x + side * 30, { flat: true });
      const hp = status.boss.hp;
      for (let i = 0; i < 22; i++) {
        status = await state();
        if (!status.boss || status.boss.st !== 'orchardOpen') break;
        await page.keyboard.press(controls.attack);
        await pause(245);
      }
      check(!status.boss || status.boss.hp < hp, `${id}: attacks dealt damage to the opened guardian`);
      if (status.boss?.st === 'calm') status = await until((s) => s.flags.includes(flag), `${id}: calmed`);
    }
    check((await state()).flags.includes(flag), `${id}: defeated with real controls`);
    await dismiss();
  }

  try {
    await page.goto(`${base}/bellspire`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('main[data-ready="true"]').waitFor();
    // A save at the previous expansion's exit sets up the new content. Every transition from here uses keys.
    await page.evaluate(([r, c, y]) => window.__bellspire().teleport(r, c, y), [ORCHARD_RETURN, ORCHARD_EXIT[0] - 3, ORCHARD_EXIT[1]]);
    await drive(point(ORCHARD_RETURN, ORCHARD_EXIT[0]));
    await page.keyboard.press(controls.use);
    await until((s) => s.room === 'orchard-wicket', 'walked through the orchard wicket');
    checks++;
    await cross('orchard-wicket', 31);
    await until((s) => s.abilities.includes('bloom'), 'Enzo picked up Lantern Bloom');
    await cross('orchard-nursery', 19);
    await graft('orchard-nursery', 0, 'bloom');
    await jumpTo('orchard-nursery', 19.5, 12, 1);
    await cross('orchard-grafts', 15);
    await until((s) => s.abilities.includes('shear'), 'Dora picked up Graft Shear');
    await graft('orchard-grafts', 0, 'bloom');
    await graft('orchard-grafts', 0, 'shear');
    await jumpTo('orchard-grafts', 17, 13, 1);
    await jumpTo('orchard-grafts', 27.25, 11, 1);
    await cross('orchard-stag', 11);
    await guardian('bracken-stag');
    await downShaft('orchard-stag', 'orchard-seeds', 54);
    await cross('orchard-seeds', 35);
    await graft('orchard-seeds', 0, 'bloom');
    await cross('orchard-pruning', 46);
    await graft('orchard-pruning', 0, 'bloom');
    await graft('orchard-pruning', 1, 'bloom');
    await graft('orchard-pruning', 1, 'shear');
    await cross('orchard-espalier', 42);
    await graft('orchard-espalier', 0, 'bloom');
    await jumpTo('orchard-espalier', 41, 13, -1);
    await graft('orchard-espalier', 0, 'shear');
    await cross('orchard-cistern', 8);
    await downShaft('orchard-cistern', 'orchard-silt', 5);
    await cross('orchard-silt', 15);
    await graft('orchard-silt', 0, 'bloom');
    await jumpTo('orchard-silt', 16, 13, 1);
    await cross('orchard-rootback', 10);
    await guardian('rootback');
    await cross('orchard-weir', 12);
    await graft('orchard-weir', 0, 'bloom');
    await graft('orchard-weir', 0, 'shear');
    await jumpTo('orchard-weir', 15.5, 12, 1);
    await jumpTo('orchard-weir', 27.25, 10, 1);
    await cross('orchard-mother', 11);
    await guardian('graft-mother');
    await page.getByRole('heading', { name: 'The Orchard Wakes' }).waitFor({ timeout: 8000 });
    check(!errors.length, errors.join('\n'));
    console.log(`Night Orchard ${viewport.width}×${viewport.height}: ${checks} browser checks, twelve rooms and three guardians.`);
  } finally { await page.close(); }
}

try {
  const selected = process.env.ORCHARD_VIEWPORT;
  for (const viewport of viewports.filter((v) => !selected || Number(selected) === v.width)) await play(viewport);
} finally {
  await browser.close();
}
