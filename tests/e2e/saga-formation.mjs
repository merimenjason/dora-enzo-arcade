import assert from 'node:assert/strict';import{chromium}from'playwright';
const b=await chromium.launch(),base=process.env.E2E_BASE_URL||'http://localhost:3000';try{
 const p=await b.newPage({viewport:{width:1600,height:1000}});await p.goto(base+'/saga');await p.getByTestId('start').click();await p.evaluate(()=>window.__saga().art.loadAll());
 await p.evaluate(()=>{const s=window.__saga(),g=s.game;for(const id of ['pip','bramble','flint'])g.heroes[id]={level:1,stars:1,shards:0,gear:[0,0,0,0]};g.squad=['dora','enzo','pip','bramble','flint'];s.refresh();});
 await p.getByTestId('fight').click();await p.getByTestId('pause').click();
 for(const [w,h] of [[1600,1000],[1280,900],[768,1024],[390,844],[844,390]]){
  await p.setViewportSize({width:w,height:h});await p.waitForTimeout(80);
  const data=await p.evaluate(()=>{const s=window.__saga();return s.field.inspect(s.game.battle)});
  assert.ok(data.heroes[0].y>data.heroes[1].y,'the foreground hero is painted after the rear tail');
  assert.ok(data.heroes[1].x-data.heroes[0].x<data.unit*1.45,'the front line remains compact');
  for(const hero of data.heroes)assert.ok(hero.x-hero.size*.75>=0 && hero.x+hero.size*.75<w,'complete rig silhouettes remain in view');
  assert.ok(data.heroes[2].y+data.heroes[0].size*.95<data.heroes[0].y,'front bodies stay clear of rear faces');
 }
 // A stopped march must complete to a contact pose before selecting idle.
 await p.setViewportSize({width:1280,height:900});await p.getByTestId('pause').click();
 await p.evaluate(()=>{const s=window.__saga(),b=s.game.battle;b.phase='march';b.marchT=5;});await p.waitForTimeout(330);
 await p.evaluate(()=>{const b=window.__saga().game.battle;b.phase='fight';for(const h of b.heroes)h.cd=100;for(const f of b.foes)f.cd=100;});
 await p.waitForFunction(()=>{const s=window.__saga();return s.field.inspect(s.game.battle).heroes.every(h=>!h.animation.walking)});
 const landed=await p.evaluate(()=>{const s=window.__saga();return s.field.inspect(s.game.battle).heroes.map(h=>h.pose);});
 assert.ok(landed.every(p=>p.near.y===0 && p.far.y===0),'the lifted paw lowers onto the ground without another walking step');
 const paws=await p.evaluate(()=>{const s=window.__saga();return s.field.inspect(s.game.battle).heroes.map(h=>[h.pose.near,h.pose.far]);});
 await p.waitForTimeout(500);
 const laterPaws=await p.evaluate(()=>{const s=window.__saga();return s.field.inspect(s.game.battle).heroes.map(h=>[h.pose.near,h.pose.far]);});
 assert.deepEqual(laterPaws,paws,'idle feet stay planted instead of sliding back into a default pose');
 await p.close();console.log('PASS Saga formation: compact diagonal depth keeps stable rig silhouettes visible and five screen sizes; rear faces remain visible and stops lower the lifted paw without moving planted feet.');
}finally{await b.close()}
