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
await pg.locator('.fighter-arena').screenshot({path:'/tmp/fighter.png'});
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
