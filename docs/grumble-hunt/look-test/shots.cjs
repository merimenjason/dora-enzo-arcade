const { chromium } = require('/home/jason/repos/dora-enzo-arcade/node_modules/playwright');
// A fresh page per shot keeps headless Chrome from stalling on long shot lists, and puts the beast back at
// its start; a stalled screenshot is retried up to twice.
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, q] of (process.argv[2] ? JSON.parse(process.argv[2]) : [])) {
    for (let k = 0; k < 3; k++) {
      const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
      p.on('pageerror', e => console.log('pageerror', e.message));
      try {
        await p.goto('file://' + process.env.OUT + "/grumble-hunt-look-test.html" + q); await p.waitForTimeout(3000);
        await p.screenshot({ path: process.env.SHOTS + "/" + name + ".png", timeout: 60000 }); await p.close(); break;
      } catch (e) { await p.close(); if (k === 2) throw e; }
    }
  }
  await b.close();
})();
