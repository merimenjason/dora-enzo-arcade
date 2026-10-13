import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch(),base=process.env.E2E_BASE_URL||'http://localhost:3000';
mkdirSync('.checks/saga-trials',{recursive:true});
try{
 const owned=()=>({level:1,stars:1,shards:0,gear:[0,0,0,0]});
 const old={v:1,seed:91,heroes:{dora:owned(),enzo:owned()},squad:['enzo','dora',null,null,null],gold:120,scrolls:3,bag:Array.from({length:4},()=>Array(6).fill(0)),stars:Array.from({length:80},(_,i)=>i<10?3:0),chests:Array(8).fill(0),tower:0,battles:0,summons:0,pity:0,campAt:0};
 const p=await browser.newPage({viewport:{width:1280,height:900}});
 await p.addInitScript(save=>localStorage.setItem('saga-v1',JSON.stringify(save)),old);
 await p.goto(base+'/saga');await p.getByTestId('continue').click();await p.getByTestId('tab-trials').click();
 assert.ok(await p.getByTestId('trial-0').isEnabled());assert.ok(await p.getByTestId('trial-1').isDisabled());
 await p.evaluate(()=>window.__saga().art.loadAll());
 await p.screenshot({path:'.checks/saga-trials/trials.png',fullPage:true});
 await p.getByTestId('trial-0').click();
 await p.evaluate(()=>{const s=window.__saga(),b=s.game.battle;for(const u of b.heroes){u.atk*=100;u.hp*=100;u.max=u.hp;}const timer=setInterval(()=>{if(b.phase==='won'||b.phase==='lost')return clearInterval(timer);if(b.phase==='march')b.marchT=.001;for(const u of b.foes)u.hp=Math.min(u.hp,1);},20);});
 await p.getByTestId('won').waitFor();assert.match(await p.getByTestId('joined').innerText(),/Fennel/);
 await p.getByTestId('to-map').click();await p.getByTestId('tab-squad').click();await p.getByTestId('hero-fennel').click();
 assert.match(await p.getByTestId('detail').innerText(),/Briar Relay/);
 const state=await p.evaluate(()=>window.__saga().game.save());assert.equal(state.v,2);assert.equal(state.bag[0].length,7);assert.equal(state.stars.filter(Boolean).length,10);assert.ok(state.trials[0]>0);
 await p.screenshot({path:'.checks/saga-trials/fennel.png',fullPage:true});
 await p.getByTestId('tab-forge').click();assert.equal(await p.getByTestId('bag-0-6').getByRole('img').getAttribute('aria-label'),'Weapon, tier 6');
 await p.setViewportSize({width:390,height:844});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile Forge does not spill outside screen');
 await p.screenshot({path:'.checks/saga-trials/forge-phone.png',fullPage:true});
 await p.getByTestId('tab-trials').click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile trials fit the viewport');await p.screenshot({path:'.checks/saga-trials/trials-phone.png',fullPage:true});
 console.log('PASS Saga trials: old-save migration, gates, recruitment, persistent separate stars, new portrait/skill and responsive Ascendant Forge.');
 await p.close();
}finally{await browser.close();}
