const { chromium } = require('/home/jason/repos/dora-enzo-arcade/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  for (const [name, q] of (process.argv[2] ? JSON.parse(process.argv[2]) : [])) {
    await p.goto('file://' + process.env.OUT + "/grumble-hunt-look-test.html" + q);
    await p.waitForTimeout(3000); await p.screenshot({ path: process.env.SHOTS + "/" + name + ".png" });
  }
  await b.close();
})();
