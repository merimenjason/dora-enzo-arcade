import assert from 'node:assert/strict';import{chromium}from'playwright';
const b=await chromium.launch(),base=process.env.E2E_BASE_URL||'http://localhost:3000';try{
 const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/saga');await p.getByTestId('start').click();await p.evaluate(()=>window.__saga().art.loadAll());
 const parts=await p.evaluate(()=>window.__saga().art.rigs());assert.equal(parts.length,24);
 assert.ok(parts.every(a=>a.loaded && a.pixels>150 && !a.edge),'fixed painted rig parts are complete and have safety gutters');
 await p.getByTestId('fight').click();assert.equal(await p.locator('main').getAttribute('data-scene-version'),'planted-feet-v5');await p.evaluate(()=>{window.__saga().game.battle.marchT=3;});
 let first=null,changed=false;
 for(let i=0;i<36;i++){
  const pose=await p.evaluate(()=>{const s=window.__saga();return s.field.inspect(s.game.battle).heroes[0].pose;});
  assert.equal(pose.mode,'rig');if(first && Math.abs(pose.near.x-first.near.x)>.02)changed=true;if(!first)first=pose;
  await p.waitForTimeout(35);
 }
 assert.ok(changed,'the live walk moves the same painted paw continuously');
 const requests=await p.evaluate(()=>window.__saga().art.status().requested);
 assert.ok(!requests.some(key=>key.startsWith('motion-')),'the inconsistent generated pose sheets are never requested');
 await p.getByTestId('pause').click();await p.waitForTimeout(60);const cv=p.getByTestId('field'),image=await cv.evaluate(c=>c.toDataURL());
 await p.waitForTimeout(250);assert.equal(await cv.evaluate(c=>c.toDataURL()),image,'pause freezes all rig layers');
 await p.emulateMedia({reducedMotion:'reduce'});await p.getByTestId('pause').click();
 const poses=await p.evaluate(()=>{const s=window.__saga();return s.field.inspect(s.game.battle).heroes.map(h=>h.pose)});
 assert.ok(poses.every(a=>a.near.x===0 && a.near.y===0 && a.head===0 && a.tail===0),'reduced motion holds every joint still');
 assert.deepEqual(errors,[]);await p.close();
 const fail=await b.newPage();let held=true;await fail.route('**/rig-dora.png*',r=>held?r.abort():r.continue());
 await fail.goto(base+'/saga');await fail.getByTestId('start').click();await fail.getByTestId('fight').click();await fail.getByRole('button',{name:'Retry artwork'}).waitFor();await fail.waitForFunction(()=>window.__saga().game.battle.phase==='fight');
 held=false;await fail.getByRole('button',{name:'Retry artwork'}).click();await fail.waitForFunction(()=>window.__saga().art.status().loaded.includes('rig-dora'));await fail.close();
 console.log('PASS Saga painted rigs: 24 stable parts, continuous live paws, no rejected pose-sheet requests, frozen pause, reduced motion and playable download fallback/retry.');
}finally{await b.close()}
