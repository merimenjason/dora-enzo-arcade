import {chromium} from 'playwright';
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:1100}});
pg.setDefaultTimeout(15000);
const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});pg.on('pageerror',e=>errs.push(String(e)));
const has=async sel=>await pg.locator(sel).count()>0;
await pg.goto('http://localhost:3000/checkpoint',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1500); // let React hydrate before clicking
console.log('briefing:',await pg.locator('.cp-briefing h2').textContent(),'| rules:',await pg.locator('.cp-briefing ol li').count());
await pg.getByRole('button',{name:/OPEN THE BOOTH/}).click();
await pg.waitForSelector('.cp-view canvas');
await pg.waitForFunction(()=>!document.querySelector('.cp-loading'),null,{timeout:15000});
await pg.waitForTimeout(1200);
console.log('nameplate:',await pg.locator('.cp-nameplate strong').textContent(),'|',await pg.locator('.cp-nameplate small').textContent());
console.log('speech:',(await pg.locator('.cp-speech').textContent()).trim(),'| scale:',await pg.locator('.cp-readout b').textContent());
console.log('docs:',await pg.locator('.cp-doc').count(),'| permit rows:',await pg.locator('.cp-doc').first().locator('.cp-row').count());
let shifts=0,judged=0,stamps=0,detained=0;
for(let guard=0;guard<260;guard++){
 if(await has('.cp-ending'))break;
 if(await has('.cp-briefing')){await pg.getByRole('button',{name:/OPEN THE BOOTH/}).click();await pg.waitForSelector('.cp-view canvas');await pg.waitForTimeout(250);continue}
 if(await has('.cp-report')){shifts++;await pg.locator('.cp-panel .cp-primary').click();await pg.waitForTimeout(250);continue}
 if(!await has('.cp-verdict')){
  // Read everything the player can see, and apply the day's rules from the rulebook.
  const info=await pg.evaluate(()=>{
   const rows=[...document.querySelectorAll('.cp-doc')].map(d=>Object.fromEntries(
    [...d.querySelectorAll('.cp-row')].map(r=>[r.querySelector('span').textContent,r.querySelector('b').textContent])));
   return {permit:rows[0]||{},card:rows[1]||{},
    missing:!!document.querySelector('.cp-missing'),
    seal:document.querySelector('.cp-seal')?.textContent||'',
    scale:document.querySelector('.cp-readout b')?.textContent||'',
    day:+(document.querySelector('.cp-header span')?.textContent.match(/DAY (\d+)/)||[0,1])[1],
    rules:[...document.querySelectorAll('.cp-rulecard li')].map(li=>li.textContent)}});
  const {permit,card}=info;
  const rulesText=info.rules.join(' ');
  const openRegions=(rulesText.match(/Open regions today: ([^.]+)\./)||[])[1]||'';
  const barred=(rulesText.match(/Barred today: ([^.]+)\./)||[])[1]||'';
  const minDate=+((rulesText.match(/expire before day (\d+)/)||[])[1]||0);
  const permitDay=+((permit.EXPIRES||'').match(/(\d+)/)||[0,0])[1];
  const stated=parseInt(permit['STATED WEIGHT']||'0',10),actual=parseInt(info.scale||'0',10);
  const bad = info.missing
   || (rulesText.includes('republic seal')&&info.seal==='NO SEAL')
   || (permit.NAME&&card.NAME&&permit.NAME!==card.NAME)
   || (permitDay&&minDate&&permitDay<minDate)
   || (card.FROM&&openRegions&&!openRegions.toUpperCase().includes(card.FROM.toUpperCase()))
   || (permit.REGION&&card.FROM&&permit.REGION!==card.FROM)
   || (rulesText.includes('within 15 grams')&&Math.abs(stated-actual)>15)
   || (barred&&card.SPECIES&&barred.toUpperCase().includes(card.SPECIES.toUpperCase()))
   || (rulesText.includes('Transit permits are suspended')&&card.PURPOSE==='TRANSIT');
  await pg.locator('body').click({position:{x:5,y:5}});
  await pg.keyboard.press(bad?'d':'a');
  await pg.waitForSelector('.cp-verdict');judged++;
  if(await has('.cp-stampmark'))stamps++;
 }
 if(await has('.cp-detain')){await pg.locator('.cp-detain').click();detained++}
 await pg.locator('.cp-panel .cp-primary, .cp-actions .cp-primary').last().click();
 await pg.waitForTimeout(70);
}
console.log('played',shifts,'shifts,',judged,'judged,',stamps,'stamp marks,',detained,'detained');
console.log('ending:',await has('.cp-ending')?await pg.locator('.cp-ending h2').textContent():'(not reached)');
if(await has('.cp-ending'))console.log('ending text:',(await pg.locator('.cp-ending p').first().textContent()).slice(0,100));
await pg.screenshot({path:'/tmp/ending.png',fullPage:true});
console.log('ERRORS:',errs.length?errs.slice(0,4):'none');
await b.close();
