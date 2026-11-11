import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ABILITY_ORDER, freshSave, roomById, roomRect, TILE } from '../../.checks/bellspire-game.js';
import { GLACIER_GATE, GLACIER_RETURN, GLACIER_ROOMS, GLACIER_VAULT, GLACIER_VAULT_FROM, GLACIER_VAULT_DOOR, ROOT_LIFT } from '../../.checks/bellspire-glacier-world.js';

const base = process.env.BASE_URL ?? 'http://localhost:3109';
const shots = process.env.GLACIER_SHOTS;
const viewports = [{width:1280,height:800},{width:844,height:390},{width:390,height:844}];
const browser = await chromium.launch();
const point = (room,c) => roomRect(roomById(room)).x+(c+.5)*TILE;
const pause = (page,ms) => page.waitForTimeout(ms);
const normal = { up:'ArrowUp', down:'ArrowDown', cast:'KeyV', tag:'ShiftLeft', attack:'KeyX', jump:'KeyZ' };
const remap = { up:'KeyE', down:'KeyG', cast:'KeyB', tag:'KeyQ', attack:'KeyF', jump:'KeyZ' };

async function play(viewport) {
  const mobile=viewport.width<1000;
  const keys=mobile?normal:remap;
  const page=await browser.newPage({viewport,hasTouch:mobile});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let checks=0;
  const ok=(v,m)=>{assert.ok(v,m);checks++;};
  const save=freshSave();
  save.flags.push('unlock:salt','unlock:orchard','unlock:glacier','script:intro','script:belfryCall','epilogue','epilogue2','epilogue3','boss:mother','boss:tune','boss:hollow','boss:tollkeeper','boss:graft-mother');
  save.abilities=ABILITY_ORDER.filter(a=>!['sunmirror','icepick'].includes(a));
  save.spells.push('frost');
  for(const h of Object.values(save.heroes)){h.level=32;h.hp=200;h.mp=100;}
  await page.addInitScript(({save,keys,mobile})=>{
    localStorage.setItem('bellspire-v1',JSON.stringify(save));
    localStorage.setItem('bellspire-v1-settings',JSON.stringify({wisp:false,shake:false,sound:false,music:false,keys:Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,[v]])),touch:mobile?'on':'off'}));
  },{save,keys,mobile});
  const info=()=>page.evaluate(()=>{
    const g=window.__bellspire().game,b=g.body;
    return {room:g.room.id,x:b.x,y:b.y,vx:b.vx,ground:b.ground,climb:b.climb,brake:b.iceBraking,grip:g.glacierClimbing,
      lead:g.lead, abilities:g.save.abilities,flags:g.save.flags,dialog:!!g.dialog,fall:g.glacier?.state(0),
      lit:g.room.glacier?.sockets?.map((_,i)=>g.glacier.lit(i)),
      boss:g.boss&&{st:g.boss.st,hp:g.boss.hp,x:g.boss.x,y:g.boss.y}};
  });
  async function until(test, what, max=6000){
    const end=Date.now()+max;
    while(Date.now()<end){const s=await info();if(test(s))return s;await pause(page,36);}
    throw new Error(`${viewport.width}: ${what}: ${JSON.stringify(await info())}`);
  }
  async function tap(action,wait=120) {
    await page.keyboard.down(keys[action]);
    await pause(page,70);
    await page.keyboard.up(keys[action]);
    await pause(page,wait);
  }
  async function stage(room,c,r=14){
    // Scenario checkpoints place the heroes at the start of a challenge. All actions, including doors, lifts,
    // mirror switches and climbs, use the player controls.
    await page.evaluate(([room,c,r])=>window.__bellspire().teleport(room,c,r),[room,c,r]);
    await pause(page,110);
  }
  async function walk(x, limit=10000){
    const start=await info(), dir=x>start.x?1:-1;
    if(Math.abs(x-start.x)<3)return;
    const code=dir===1?'ArrowRight':'ArrowLeft';
    await page.keyboard.down(code);
    try{await until(s=>(s.x-x)*dir>=-2,'walk to '+x,limit);}
    finally{await page.keyboard.up(code);}
  }
  async function tag(hero){
    for(let i=0;i<3&&(await info()).lead!==hero;i++)await tap('tag',430);
    ok((await info()).lead===hero,'tagged to '+hero);
  }
  async function dismiss(){for(let i=0;i<9&&(await info()).dialog;i++)await tap('jump');}
  const prompt=()=>page.locator('.bs-shrine-prompt');
  async function hint(text, desktopKey){
    await prompt().filter({hasText:text}).waitFor({timeout:5000});
    const copy=await prompt().textContent();
    ok(copy.includes(text)&& (mobile||!desktopKey||copy.includes(desktopKey)),copy);
  }
  async function climb(room,c,top){
    await walk(point(room,c));
    await page.keyboard.down(keys.up);
    try{await until(s=>s.grip,'Dora gripped painted ice');await until(s=>s.ground&&s.y<=roomRect(roomById(room)).y+top*TILE,'Dora climbed to the ledge');}
    finally{await page.keyboard.up(keys.up);}
    ok(true,'Dora reached the ledge with held Use');
  }
  async function bossStage(id,c){
    await page.evaluate(id=>window.__bellspire().game.setFlag('script:boss:'+id),roomById(id).boss);
    await stage(id,c);
    await until(s=>s.boss&&['glacierRest','glacierTell'].includes(s.boss.st),'guardian ready');
  }
  async function openAndHit(id){
    const a=await until(s=>s.boss?.st==='glacierOpen',id+' opens',10000);
    await tag('dora');
    const side=(await info()).x>=a.boss.x?1:-1;
    const x=a.boss.x+side*28;
    await walk(x);
    const st=await info();
    if(side>0&&st.x>=a.boss.x){
      await page.keyboard.press('ArrowLeft');await pause(page,55);
    } else {await page.keyboard.press('ArrowRight');await pause(page,55);}
    await hint('Strike now','F');
    await tap('attack',320);
    const b=await info();
    ok(b.boss.hp<a.boss.hp,id+' took a real Dora attack');
  }
  try {
    await page.goto(base+'/bellspire');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.locator('main[data-ready=true]').waitFor();

    await stage(GLACIER_RETURN,ROOT_LIFT[0]+2,ROOT_LIFT[1]);await walk(point(GLACIER_RETURN,ROOT_LIFT[0]));await tap('up');
    await until(s=>s.room===GLACIER_GATE,'root lift took the heroes up');checks++;
    await walk(point(GLACIER_GATE,8));await tap('up');
    await until(s=>s.dialog,'Phuyu talks');ok(await page.getByText('Phuyu',{exact:true}).isVisible(),'Phuyu has dialogue');await dismiss();
    await stage(GLACIER_GATE,23);await walk(point(GLACIER_GATE,30));await until(s=>s.vx>1,'Dora carried ice momentum after release');checks++;
    await stage('glacier-camp',24);await walk(point('glacier-camp',25));await until(s=>s.abilities.includes('sunmirror'),'Sun Mirror picked up');checks++;

    await stage('glacier-first-thaw',19);
    await hint('Tag to Enzo to turn the mirror','Q');await tag('enzo');
    await hint('Turn the mirror','E');await tap('up');
    await until(s=>s.fall==='water','mirror made a waterfall');
    await prompt().filter({hasText:'Turn the mirror'}).waitFor({state:'hidden'});checks+=2;
    await walk(point('glacier-first-thaw',34));
    ok((await info()).x>point('glacier-first-thaw',31),'Enzo walked through the waterfall');

    await stage('glacier-mirrors',34,10);await tap('up');
    ok((await info()).fall==='plug','shadowed mirror stays off');
    await stage('glacier-mirrors',48);await tap('up');await until(s=>s.lit?.[0],'first gallery mirror lit');
    await stage('glacier-mirrors',34,10);await tap('up');await until(s=>s.fall==='water','second mirror reached shadowed fall');checks+=2;

    await stage('glacier-serac',51);await until(s=>s.abilities.includes('icepick'),'Ice Pick picked up');checks++;
    await tag('dora');await stage('glacier-slide',22);
    await page.keyboard.down('ArrowRight');
    try{
      await until(s=>s.vx>2.5,'built speed on ice');
      await hint('Plant the Ice Pick to brake','G + F');
      await page.keyboard.down(keys.down);await page.keyboard.down(keys.attack);
      await until(s=>s.brake&&s.vx===0,'pick stopped the slide');
      await prompt().filter({hasText:'Plant the Ice Pick'}).waitFor({state:'hidden'});checks+=2;
    }finally{await page.keyboard.up(keys.attack);await page.keyboard.up(keys.down);await page.keyboard.up('ArrowRight');}
    await stage('glacier-serac',23);await walk(point('glacier-serac',24));
    await page.keyboard.down(keys.up);
    try{await until(s=>s.grip,'Ice Pick grips the static ice wall');}
    finally{await page.keyboard.up(keys.up);} checks++;
    await stage('glacier-frozen',43);await tag('enzo');await tap('up');
    await until(s=>s.fall==='water','teaching fall melted');
    await walk(point('glacier-frozen',34));await hint('Freeze the fall','B');await tap('cast');
    await until(s=>s.fall==='frozen','Frost Fan froze the fall');
    await prompt().filter({hasText:'Freeze the fall'}).waitFor({state:'hidden'});checks+=2;
    await walk(point('glacier-frozen',30));await tag('dora');await hint('Climb the ice','E');
    await climb('glacier-frozen',30,9);
    await prompt().filter({hasText:'Climb the ice'}).waitFor({state:'hidden'});checks++;

    await stage(GLACIER_VAULT_FROM,...GLACIER_VAULT_DOOR);await tap('up');
    await until(s=>s.room===GLACIER_VAULT,'entered optional vault');
    await tap('up');await until(s=>s.room===GLACIER_VAULT_FROM,'returned from optional vault');checks+=2;
    for(const [col,index] of [[36,0],[41,1],[45,2]]){
      await stage(GLACIER_VAULT,col,7);await tap('up');
      await until(s=>s.flags.includes('chest:'+GLACIER_VAULT+':'+index),'opened Glacier chest');checks++;
    }
    await stage(GLACIER_VAULT,47,7);await tap('up');
    await until(s=>s.flags.includes('mural:27'),'read the Glacier mural');checks++;
    await page.keyboard.press('Escape');await pause(page,200);

    await bossStage('glacier-vicuna',42);await tag('enzo');await tap('up');
    await openAndHit('glass-horn vicuña');
    await bossStage('glacier-osjollo',17);await tag('enzo');await tap('up');
    await until(s=>s.fall==='water','mountain cat lost its ice perch');checks++;
    await walk(point('glacier-osjollo',32));await tap('cast');
    await until(s=>s.fall==='frozen','froze the cat’s fall');await tag('dora');
    await climb('glacier-osjollo',36,8);
    await openAndHit('serac osjollo');
    await bossStage('glacier-sun-gate',29);await tag('enzo');
    await until(s=>s.boss.st==='glacierTell','Warden sunlight is live');await tap('up');
    await openAndHit('sun gate warden');
    await dismiss();
    ok(errors.length===0,errors.join('\n'));
    console.log(`Glacier browser ${viewport.width}×${viewport.height}: ${checks} assertions; moves, prompts, routes and both roles in all guardian openings.`);
  } finally {await page.close();}
}

async function capture(viewport) {
  const page=await browser.newPage({viewport,hasTouch:viewport.width<600});
  const dir=join(shots,`${viewport.width}x${viewport.height}`);
  await mkdir(dir,{recursive:true});
  const save=freshSave();
  save.flags.push('unlock:salt','unlock:orchard','unlock:glacier','script:intro','script:belfryCall','boss:mother','boss:tune','boss:hollow','boss:tollkeeper','boss:graft-mother');
  save.abilities=[...ABILITY_ORDER];save.spells.push('frost');
  await page.addInitScript(s=>{
    localStorage.setItem('bellspire-v1',JSON.stringify(s));
    localStorage.setItem('bellspire-v1-settings',JSON.stringify({wisp:false,shake:false,sound:false,music:false}));
  },save);
  try{
    await page.goto(base+'/bellspire');await page.getByRole('button',{name:'Continue',exact:true}).click();
    const rooms=[
      ['orchard-grafts',19,14],
      [GLACIER_GATE,10,14],['glacier-camp',24,14],['glacier-first-thaw',27,14],['glacier-slide',30,14],
      ['glacier-vicuna',23,14],['glacier-serac',27,14],['glacier-frozen',32,14],['glacier-mirrors',33,10],
      ['glacier-osjollo',35,14],[GLACIER_VAULT_FROM,20,14],[GLACIER_VAULT,32,7],['glacier-sun-gate',39,14],
    ];
    for(const [room,c,r] of rooms){
      await page.evaluate(([room,c,r])=>{
        const api=window.__bellspire(),g=api.game;
        if(room==='orchard-grafts')g.setFlag('orchard:orchard-grafts:0:bloom');
        const id=g.room.id;void id;
        const b=api.teleport(room,c,r);void b;
        api.skipDialog();
        if(g.boss){g.setFlag('script:boss:'+g.boss.id);g.boss.st='glacierRest';g.boss.t=0;g.boss.dur=10000;}
        if(room==='glacier-osjollo')g.glacier.change(0,'frozen',g.tick,true);
        if(room==='glacier-meltwater')g.glacier.change(0,'water',g.tick,true);
        if(room==='glacier-vault'){
          g.glacier.change(0,'frozen',g.tick,true);
          g.save.gear.push('dora-glacier-coat','enzo-glacier-coat');
          if(g.equip('dora','coat','dora-glacier-coat') || g.equip('enzo','coat','enzo-glacier-coat'))
            throw new Error('Glacier outfit could not equip');
        } else {
          g.equip('dora','coat','teal-coat');g.equip('enzo','coat','rust-coat');
        }
        if(room==='glacier-mirrors')g.glacier.turn(0,g.tick,true);
      },[room,c,r]);
      await pause(page,480);
      assert.equal(await page.evaluate(()=>window.__bellspire().state.room),room);
      await page.screenshot({path:join(dir,room+'.png')});
    }
    console.log(`Glacier captures ${viewport.width}×${viewport.height}: ${GLACIER_ROOMS.length} rooms plus Night Orchard.`);
  }finally{await page.close();}
}
try {
  if(shots) for(const v of viewports.filter(v=>v.width!==844)) await capture(v);
  else for(const v of viewports.filter(v=>!process.env.GLACIER_VIEWPORT||v.width===Number(process.env.GLACIER_VIEWPORT))) await play(v);
} finally { await browser.close(); }
