import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.E2E_BASE_URL||'http://localhost:3000',browser=await chromium.launch();
mkdirSync('.checks/saga-results',{recursive:true});
try{
 for(const [width,height] of [[2048,1000],[1280,720],[768,1024],[390,844],[360,640],[844,390]]){
  const p=await browser.newPage({viewport:{width,height}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  let releaseBoss;
  const bossHeld=new Promise(resolve=>{releaseBoss=resolve;});
  await p.route('**/bosses-0.png',async route=>{await bossHeld;await route.continue();});
  await p.goto(base+'/saga');await p.getByTestId('start').click();
  await p.evaluate(()=>{const s=window.__saga();for(let i=0;i<9;i++)s.game.stars[i]=3;s.refresh();});
  await p.getByTestId('stage-9').click();
  await p.waitForFunction(()=>window.__saga().art.status().requested.includes('bosses-0'));
  assert.equal(await p.getByTestId('field').count(),0,'boss requested from the map before combat');
  releaseBoss();
  await p.waitForFunction(()=>window.__saga().art.status().loaded.includes('bosses-0'));
  await p.getByTestId('fight').click();
  await p.evaluate(()=>{
   const s=window.__saga(),b=s.game.battle;
   for(const u of b.heroes){u.atk*=100;u.max*=100;u.hp=u.max;}
   const id=setInterval(()=>{
    if(b.phase==='won'||b.phase==='lost')return clearInterval(id);
    if(b.phase==='march')b.marchT=.001;
    for(const u of b.foes)u.hp=Math.min(u.hp,1);
   },20);
  });
  await p.getByTestId('won').waitFor({timeout:30000});
  await p.getByTestId('won').getByRole('heading',{name:'Victory',exact:true}).waitFor();
  const box=await p.getByTestId('won').boundingBox();
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'whole result card fits the viewport');
  const heading=await p.getByTestId('won').getByRole('heading',{name:'Victory',exact:true}).boundingBox();
  assert.ok(heading.y>=box.y&&heading.y+heading.height<=box.y+box.height,'heading is not clipped');
  const actions=p.getByTestId('won').locator('.sg-row');
  await actions.scrollIntoViewIfNeeded();
  for(const id of ['next','again','to-map']){
   const button=await p.getByTestId(id).boundingBox();
   assert.ok(button.y>=box.y&&button.y+button.height<=box.y+box.height+1,'result actions remain reachable inside the card');
  }
  assert.ok(await p.getByTestId('joined').isVisible(),'chapter recruitment result present');
  assert.deepEqual(errors,[]);
  await p.screenshot({path:`.checks/saga-results/victory-${width}x${height}.png`});
  console.log(`PASS Saga victory ${width}×${height}: preloaded boss, unclipped title, reachable rewards and actions.`);
  await p.close();
 }
}finally{await browser.close();}
