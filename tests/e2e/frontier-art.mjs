import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch(),base=process.env.E2E_BASE_URL||'http://localhost:3000';
try {
 for(const [width,height] of [[1536,1050],[390,844],[320,568],[844,390]]) {
  const p=await browser.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(`${base}/frontier`);await p.waitForSelector('[data-art-ready="true"]');await p.getByTestId('map-1').click();
  await p.waitForSelector('[data-art-ready="true"]');await p.evaluate(()=>scrollTo(0,0));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}`);
  assert.equal(await p.locator('.ff-toolbar button').count(),7);
  const still = await p.getByTestId('map').evaluate(c => c.toDataURL()); await p.waitForTimeout(150);
  assert.equal(await p.getByTestId('map').evaluate(c => c.toDataURL()),still,'reduced motion stops decorative drift');
  for(const b of await p.locator('.ff-toolbar button').all()) { const r=await b.boundingBox();assert.ok(r.width>=40&&r.height>=40,'usable building targets'); }
  await p.getByTestId('tool-farm').click();await p.getByTestId('tool-farm').click();
  await p.getByRole('button',{name:'Pause · P',exact:true}).click();await p.getByRole('button',{name:'Back to the frontier →',exact:true}).click();
  assert.equal(await p.getByTestId('map').getAttribute('data-state'),'playing');assert.deepEqual(errors,[]);await p.close();
 }
 // Live animation changes the scene, then freezes completely when the game is paused.
 const live=await browser.newPage({viewport:{width:1280,height:1050}});await live.goto(`${base}/frontier`);await live.waitForSelector('[data-art-ready="true"]');await live.getByTestId('map-1').click();await live.waitForTimeout(1800);
 const first=await live.getByTestId('map').evaluate(c=>c.toDataURL());await live.waitForTimeout(350);assert.notEqual(await live.getByTestId('map').evaluate(c=>c.toDataURL()),first,'live scene animates');
 await live.getByRole('button',{name:'Pause · P',exact:true}).click();await live.waitForTimeout(200);const paused=await live.getByTestId('map').evaluate(c=>c.toDataURL());await live.waitForTimeout(250);assert.equal(await live.getByTestId('map').evaluate(c=>c.toDataURL()),paused,'pause freezes the entire scene');await live.close();
 // Partial artwork failure must preserve playable controls and offer a successful retry.
 const p=await browser.newPage();let blocked=true;
 await p.route('**/art/frontier/buildings.png',route=>blocked?route.abort():route.continue());await p.goto(`${base}/frontier`);
 await p.getByRole('button',{name:'Retry artwork'}).waitFor();await p.getByTestId('map-1').click();
 await p.getByTestId('map').waitFor();assert.equal(await p.getByTestId('map').getAttribute('data-state'),'playing');
 blocked=false;await p.getByRole('button',{name:'Retry artwork'}).click();await p.waitForSelector('[data-art-ready="true"]');
 assert.equal(await p.getByRole('button',{name:'Retry artwork'}).count(),0);await p.close();
 console.log('PASS painted Frontier: atlas loading, four screen sizes, usable tools, walking scene, frozen pause/reduced motion, playable artwork fallback and retry.');
}finally{await browser.close();}
