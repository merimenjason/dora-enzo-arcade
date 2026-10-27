import {chromium} from 'playwright';
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:1100}});
pg.setDefaultTimeout(15000);
const errs=[];pg.on('pageerror',e=>errs.push(String(e).slice(0,150)));
await pg.goto('http://localhost:3000/fighter',{waitUntil:'domcontentloaded'});await pg.waitForSelector('.fighter-cards button');await pg.waitForTimeout(2500);
console.log('roster cards:',await pg.locator('.fighter-cards button').count(),'| move lists:',await pg.locator('.fighter-move-list').count());
await pg.locator('.cp-shell button, .fighter-header button').filter({hasText:'STORY MODE'}).first().click();await pg.waitForSelector('.fighter-overlay.story');
console.log('story:',await pg.locator('.fighter-overlay.story h2').textContent(),'|',await pg.locator('.fighter-overlay.story span').textContent());
console.log('text:',(await pg.locator('.fighter-overlay.story p').textContent()).slice(0,80));
await pg.getByRole('button',{name:/FIGHT →/}).click();await pg.waitForTimeout(900);
console.log('arena tag:',await pg.locator('.fighter-arena-tags span').last().textContent());
await pg.locator('.fighter-header button').filter({hasText:/^TRAINING$/}).first().click();await pg.waitForSelector('.fighter-training');
console.log('dummy buttons:',await pg.locator('.fighter-training button').allTextContents());
await pg.locator('body').click({position:{x:5,y:5}});
await pg.keyboard.down('d');await pg.waitForTimeout(900);await pg.keyboard.up('d'); // walk into range
for(let i=0;i<30;i++){await pg.keyboard.press('j');await pg.waitForTimeout(60)}
await pg.keyboard.press('o');await pg.waitForTimeout(300);
console.log('training readout:',(await pg.locator('.fighter-training p').textContent()).trim());
// combo trials: picking one lists its moves
await pg.locator('.fighter-trials button').first().click();await pg.waitForTimeout(200);
console.log('trial moves:',await pg.locator('.fighter-trials em').allTextContents());
// versus: player two picks, keys on the right half move player two only
await pg.locator('.fighter-header button').filter({hasText:/^VERSUS$/}).click();await pg.waitForSelector('.fighter-overlay.versus');
await pg.locator('.fighter-pick button').nth(4).click();await pg.locator('.fighter-stages button').filter({hasText:/DOCKS/}).click();
await pg.locator('.fighter-overlay.versus .fighter-start').click();await pg.waitForFunction(()=>window.__fighter().state==='fight'&&window.__fighter().intro<=0,null,{timeout:8000});
const before=await pg.evaluate(()=>window.__fighter().fighters.map(f=>f.x));
await pg.keyboard.down('ArrowLeft');await pg.waitForTimeout(500);await pg.keyboard.up('ArrowLeft');
const after=await pg.evaluate(()=>window.__fighter().fighters.map(f=>f.x));
const vs=await pg.evaluate(()=>({mode:window.__fighter().mode,stage:window.__fighter().stage,p2:window.__fighter().fighters[1].id}));
if(vs.mode!=='versus'||after[1]>=before[1]-.3||Math.abs(after[0]-before[0])>.05)throw new Error('versus input: '+JSON.stringify({vs,before,after}));
console.log('versus:',vs.p2,'on',vs.stage,'| P2 walked',(before[1]-after[1]).toFixed(2));
// CPU level is saved, and survival starts from the select screen
await pg.locator('.fighter-header button').filter({hasText:'CHARACTER SELECT'}).click();
await pg.locator('.fighter-level button').filter({hasText:'HARD'}).click();
await pg.reload({waitUntil:'domcontentloaded'});await pg.waitForSelector('main[data-ready="true"]');
const level=await pg.locator('.fighter-level button[aria-pressed="true"]').textContent();if(level!=='HARD')throw new Error('level not saved: '+level);
await pg.locator('.fighter-modes button').filter({hasText:/^Survival/}).click();await pg.waitForTimeout(400);
console.log('saved level:',level,'| survival tag:',await pg.locator('.fighter-arena-tags span').last().textContent());
await pg.locator('.fighter-arena').screenshot({path:'/tmp/fighter.png'});
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
