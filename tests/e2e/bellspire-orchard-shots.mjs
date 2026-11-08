// Review captures only. The browser route suite drives actual inputs separately.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ROOMS, isOrchardRoom } from '../../.checks/bellspire-game.js';
import { graftFlag } from '../../.checks/bellspire-orchard-world.js';
import { orchardSave } from '../bellspire-orchard.mjs';

const base = process.env.BASE_URL ?? 'http://localhost:3109';
const dir = process.env.SHOTS_DIR ?? '.shots/night-orchard';
const browser = await chromium.launch();
try {
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((save) => localStorage.setItem('bellspire-v1', JSON.stringify(save)), orchardSave('enzo'));
  await page.goto(`${base}/bellspire`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('main[data-ready="true"]').waitFor();
  const rooms = ROOMS.filter(isOrchardRoom);
  const shots = [];
  async function shot(name, id, c, floor, flags = [], guardian = null) {
    await page.evaluate(({ id, c, floor, flags, guardian }) => {
      const game = window.__bellspire().game;
      for (const flag of flags) game.setFlag(flag);
      if (guardian) game.setFlag(`boss:${guardian}`);
      for (const hero of ['dora', 'enzo']) {
        game.setHp(hero, 1000);
        if (id.startsWith('orchard-')) {
          game.save.equip[hero].coat = `${hero}-orchard-coat`;
          if (!game.save.gear.includes(`${hero}-orchard-coat`)) game.save.gear.push(`${hero}-orchard-coat`);
        }
      }
      game.teleport(id, c, floor - 1);
      game.toast = null;
    }, { id, c, floor, flags, guardian });
    await page.waitForTimeout(420);
    const path = `${dir}/${name}.png`;
    await page.screenshot({ path });
    shots.push({ name, room: id, column: c, floor, path });
  }
  await shot('00-casting-halls', 'channel', 4, 15);
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const number = String(i + 1).padStart(2, '0');
    for (const [suffix, c] of [['west', 12], ['east', 46]]) {
      const floor = room.rows.findIndex((row, r) => r >= 10 && row[c] === '#');
      const grown = suffix === 'east' ? (room.grafts ?? []).flatMap((g, k) =>
        [graftFlag(room.id, k, 'bloom'), ...(g.shear ? [graftFlag(room.id, k, 'shear')] : [])]) : [];
      await shot(`${number}-${room.id}-${suffix}`, room.id, c, floor, grown, room.boss);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${dir}/index.json`, JSON.stringify(shots, null, 2));
  console.log(`Night Orchard review: ${shots.length - 1} new room screenshots plus Casting Halls, all 1280×800.`);
} finally {
  await browser.close();
}
