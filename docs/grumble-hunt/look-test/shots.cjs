const { chromium } = require('/home/jason/repos/dora-enzo-arcade/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  for (const [name, q] of (process.argv[2] ? JSON.parse(process.argv[2]) : [])) {
    await p.goto('file://' + process.env.OUT + "/grumble-hunt-look-test.html" + q);
    await p.waitForTimeout(3000); for (let k = 0; k < 3; k++) { try { await p.screenshot({ path: process.env.SHOTS + "/" + name + ".png", timeout: 60000 }); break; } catch (e) { if (k === 2) throw e; await p.reload(); await p.waitForTimeout(3000); } }
  }
  await b.close();
})();
