import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { newRiverSave, SAVE_KEY } from '../../.checks/river-game.js';
import { REACHES, TILE } from '../../.checks/river-world.js';
import { waypoint } from '../river-driver.mjs';

const base=process.env.BASE_URL??'http://localhost:3109';
const captures=process.env.RIVER_SHOTS;
const smoke=process.env.RIVER_SMOKE==='1';
const views=[[1280,800],[844,390],[390,844]];
const browser=await chromium.launch();
const modes=process.env.RIVER_VIEWPORT ? views.filter(v=>v[0]===Number(process.env.RIVER_VIEWPORT)):views;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

async function dragRight(page,mobile){
  const box=await page.getByRole('button',{name:'Drag to move'}).boundingBox();
  const x=Math.round(box.x+box.width/2), y=Math.round(box.y+box.height/2);
  await mobile.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await mobile.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+24,y}]});
  try{await page.waitForTimeout(125);}
  finally{await mobile.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
}

async function deniedGamepads(width,height){
  const touch=width<1000;
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
  try{
    await context.route('**/river',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,headers:{...response.headers(),'permissions-policy':'gamepad=()'}});
    });
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/river');
    assert.equal(await page.evaluate(()=>{
      try{navigator.getGamepads();return '';}catch(e){return e.name;}
    }),'SecurityError','browser is actually blocking gamepad access');
    const mobile=touch?await context.newCDPSession(page):null;
    for(const label of ['Begin the river','Continue']){
      await page.getByRole('button',{name:label}).click();
      await page.locator('[data-screen=play]').waitFor();
      const x=await page.evaluate(()=>window.__river().game.player.x);
      if(mobile)await dragRight(page,mobile);
      else{
        await page.keyboard.down(label==='Continue'?'KeyD':'ArrowRight');
        try{await page.waitForFunction(x=>window.__river().game.player.x>x+6,x,{timeout:2000});}
        finally{await page.keyboard.up(label==='Continue'?'KeyD':'ArrowRight');}
      }
      assert.ok(await page.evaluate(x=>window.__river().game.player.x>x+6,x),label+' moved with gamepads blocked');
      if(label==='Begin the river')await page.reload();
    }
    assert.deepEqual(errors,[]);
    console.log(`River movement ${width}x${height}: ${touch?'touch':'arrow keys and WASD'} on new and resumed saves with gamepad access blocked.`);
  }finally{await context.close();}
}

async function exercise(width,height){
  const touch=width<1000;
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
  await context.addInitScript(()=>{
    const held=new Set();
    const native=navigator.getGamepads.bind(navigator);
    let connected=false;
    Object.defineProperty(navigator,'getGamepads',{value:()=>connected?[{axes:[0,0],buttons:Array.from({length:17},(_,i)=>({pressed:held.has(i)}))}]:native()});
    window.__riverConnectPad=on=>{connected=on;held.clear();};
    window.__riverPad=(i,on)=>on?held.add(i):held.delete(i);
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(8500);
  const mobile=touch?await context.newCDPSession(page):null;
  const useButton=(name)=>page.getByRole('button',{name,exact:typeof name==='string'});
  let real=0;
  const press=async code=>{await page.keyboard.press(code);real++;await page.waitForTimeout(90);};
  const activate=async control=>{
    if(touch)await control.tap();
    else {await control.focus();await page.keyboard.press('Enter');}
    real++;
  };
  const button=(name)=>activate(useButton(name));
  const shot=async name=>{
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scrolling');
    if(!captures||width===844)return;
    const dir=join(captures,`${width}x${height}`);
    await mkdir(dir,{recursive:true});
    await page.screenshot({path:join(dir,`${name}.png`),animations:'disabled'});
  };
  const ready=()=>page.locator('main[data-ready=true]').waitFor();
  const status=()=>page.evaluate(()=>{
    const {game:g,screen,settings}=window.__river();
    return {screen, settings, id:g.room.id, room:g.roomIndex, lead:g.lead, actor:g.player, boat:g.boat,
      gates:g.gates, pinned:g.pinned, weight:g.weight, water:g.water, wheel:g.wheel, hearts:g.hearts, beat:g.beat, phase:g.arena?.phase,
      tick:g.tick, clear:g.clear, marks:g.save.marks, fall:g.fall};
  });
  const start=async (level=null)=>{
    if(level!==null){
      await page.evaluate(([key,save])=>localStorage.setItem(key,JSON.stringify(save)),[SAVE_KEY,{...newRiverSave(),room:level,frontier:level}]);
      await page.reload();await ready();
    }
    await button(level!==null?'Continue':'Begin the river');
    await page.locator('[data-screen=play]').waitFor();
  };
  const pad=async index=>{
    await page.evaluate(async i=>{
      window.__riverPad(i,true);
      await new Promise(r=>setTimeout(r,75));
      window.__riverPad(i,false);
      await new Promise(r=>setTimeout(r,75));
    },index);
  };
  const action=async(name,code)=>{
    if(touch)await button(name);else await press(code);
    await page.waitForTimeout(105);
  };
  const markers=(type)=>page.evaluate(type=>window.__river().game.get(type),type);
  async function go(target,{sail=false,radius=15,limit=78}={}){
    for(let i=0;i<limit;i++){
      const state=await status();
      if(state.fall)throw new Error('fell in '+state.id);
      if(distance(state.actor,target)<=radius)return;
      const data=await page.evaluate(sail=>{
        const g=window.__river().game,{width,height}=g.room;
        return {width,height,pass:Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{
          const s=g.surface(x,y);return !s.solid&&(sail?s.depth>=.48:s.depth<.48);
        }))};
      },sail);
      const next=waypoint(data.width,data.height,state.actor,(x,y)=>data.pass[y]?.[x],target,Math.max(9,radius-2));
      assert.ok(next,`no route to ${JSON.stringify(target)} in ${state.id}`);
      let dx=next.x-state.actor.x,dy=next.y-state.actor.y;
      if(sail&&Math.abs(dx)>3&&Math.abs(dy)>3){
        if(Math.abs(dx)>Math.abs(dy)*1.55)dy=0;
        else if(Math.abs(dy)>Math.abs(dx)*1.55)dx=0;
      }
      const keys=[];
      if(Math.abs(dx)>4)keys.push(dx>0?'ArrowRight':'ArrowLeft');
      if(Math.abs(dy)>4)keys.push(dy>0?'ArrowDown':'ArrowUp');
      if(!keys.length)throw new Error('navigation stalled '+state.id);
      for(const code of keys)await page.keyboard.down(code);
      await page.waitForTimeout(Math.max(44,Math.min(125,Math.hypot(dx,dy)*6.15)));
      for(const code of keys)await page.keyboard.up(code);
      real+=keys.length;
      if(sail)await page.waitForTimeout(22);
    }
    throw new Error(`failed to reach ${JSON.stringify(target)}: ${JSON.stringify(await status())}`);
  }
  async function tag(hero,code='KeyQ'){
    if((await status()).lead!==hero)await action('Tag',code);
    assert.equal((await status()).lead,hero);
  }
  async function gate(marker,code='KeyE'){
    await tag('dora');
    await go(marker,{radius:8});
    await action('Use',code);
    await page.waitForTimeout(405);
  }
  async function launch(code='KeyE'){
    await tag('enzo');
    if((await status()).boat.aboard)return;
    await go((await markers('J'))[0]);
    await action('Use',code);
    assert.ok((await status()).boat.aboard);
  }
  async function moor(code='KeyE'){
    await go((await markers('m'))[0],{sail:true,radius:24});
    await action('Use',code);
    assert.equal((await status()).boat.aboard,false);
  }
  async function exit(code='KeyE'){
    await go((await markers('X'))[0]);
    await action('Use',code);
    await page.locator('[data-screen=clear], [data-screen=ending]').waitFor();
  }
  try{
    if(!smoke)await page.route('**/art/river/surface-0.webp',route=>route.abort());
    await page.goto(base+'/river');
    if(!smoke){
      await useButton('Try artwork again').waitFor();
      await page.unroute('**/art/river/surface-0.webp');
      await button('Try artwork again');
    }
    await ready();await shot('00-title');
    await button('How to play');await shot('01-how-to-play');await button('Back');
    await button('Watershed chart');await shot('02-watershed-chart');assert.ok(await useButton('The Sluice Crab').isDisabled());await button('Back');
    await button('Settings');await shot('03-settings');
    for(const label of ['Helping hand','Music','Effects','Reduced motion']){
      const control=useButton(new RegExp('^'+label+': '));
      await activate(control);
      await activate(control);
    }
    await button('Story');await button('Expert');await button('Standard');
    for(const label of ['Up','Down','Left','Right','Use','Brace / pole','Hop','Tag','Pause']){
      await activate(useButton(new RegExp('^'+label+': ')));
      await press('Escape');
    }
    await button('Reset keys');
    await button('Use: E');await press('KeyR');
    assert.equal((await status()).settings.keys.use,'KeyR');
    await button('Back');await start();
    const spawnX=(await status()).actor.x;
    if(mobile){await dragRight(page,mobile);real++;}
    else{
      await page.keyboard.down('ArrowRight');real++;
      try{await page.waitForFunction(x=>window.__river().game.player.x>x+6,spawnX,{timeout:2000});}
      finally{await page.keyboard.up('ArrowRight');}
    }
    assert.ok((await status()).actor.x>spawnX+6,'Dora moved without a connected gamepad');
    await action('Hop','Space');
    assert.ok((await status()).actor.air>0,'hop actually started');
    await action('Brace / pole','KeyF');
    assert.ok((await status()).actor.guard>0,'brace actually started');
    await page.evaluate(()=>window.__riverConnectPad(true));
    const beforePad=(await status()).actor.x;
    await pad(15);assert.ok((await status()).actor.x>beforePad+4,'D-pad moved Dora');
    await pad(3);assert.equal((await status()).lead,'enzo');
    await pad(3);assert.equal((await status()).lead,'dora');
    await page.evaluate(()=>window.__riverConnectPad(false));
    await gate((await markers('g'))[0],'KeyR');
    assert.equal((await status()).gates[0],true);
    if(!touch)assert.match(await page.locator('.rv-prompt').innerText(),/R/);
    await launch('KeyR');
    await action('Brace / pole','KeyF');
    await moor('KeyR');
    const mark=(await markers('s'))[0];await go(mark);await action('Use','KeyR');
    assert.ok((await status()).marks.includes('landing'));
    await go((await markers('O'))[0]);await action('Use','KeyR');
    assert.ok((await status()).wheel);
    await exit('KeyR');await shot('04-reach-clear');
    await button('Next reach');assert.equal((await status()).room,1);
    await press('Escape');await shot('05-pause');
    await button('Resume');await button('Pause');
    await button('Restart reach');assert.ok((await status()).tick<90);
    await button('Pause');await button('Settings');await button('Reset keys');await button('Back');
    await button('How to play');await button('Back');
    await button('Watershed chart');await button('Reed Fork');
    await button('Pause');await button('Title screen');await button('Continue');
    assert.equal((await status()).room,1);
    // Start from a saved district checkpoint. Every gate, boss action,
    // crossing and exit in the arena uses the public controls.
    const finale=!smoke;
    if (!smoke){
      await start(3);
      await gate((await markers('g'))[0]);
      await go((await markers('J'))[0],{radius:8});
      await action('Use','KeyE');
      assert.ok((await status()).boat.passenger);
      await launch();
      const middle=(await markers('o'))[0];
      await go(middle,{sail:true,radius:24});
      await action('Use','KeyE');
      assert.equal((await status()).boat.aboard,false);
      await gate((await markers('q'))[0]);
      await tag('enzo');
      await go((await markers('k'))[0],{radius:8});
      await action('Use','KeyE');
      assert.ok((await status()).weight);
      await go(middle,{radius:8});
      await action('Use','KeyE');
      await moor();
      await go((await markers('O'))[0]);
      await action('Use','KeyE');
      assert.ok((await status()).wheel);
      await exit();
      await start(10);
      await gate((await markers('g'))[0]);
      await launch();
      await moor();
      const stair=(await markers('H'))[0];
      await go(stair,{radius:8});await action('Use','KeyE');
      assert.equal((await status()).actor.pose,'climb');
    }
    await start(finale?41:6);
    if(finale){
      const first=(await markers('g'))[0];
      await go(first,{radius:8});await action('Brace / pole','KeyF');
      assert.equal((await status()).pinned[0],true);
    }
    for(let phase=0;phase<2;phase++){
      await gate((await markers(phase?'j':'g'))[0]);
      await launch();
      const stake=(await markers(phase?'w':'u'))[0];
      await go(stake,{sail:true,radius:18});
      await action('Use','KeyE');
      const end=Date.now()+4600;
      while((await status()).phase===phase&&Date.now()<end){
        await go(stake,{sail:true,radius:18});
        await action('Use','KeyE');
      }
      assert.equal((await status()).phase,phase+1);
    }
    await moor();await exit();
    if(finale){
      await shot('06-ending');await button('Start Spring Run');
      assert.equal((await status()).room,5);
      // Stage a finished post-game save to check the result menu. The
      // actual six alternate routes are cleared in the engine suite.
      await page.evaluate(ids=>{
        const g=window.__river().game;
        g.save.springCleared=ids;g.clear=true;
      },REACHES.filter((_,i)=>i%7===5).map(r=>r.id));
      await page.locator('[data-screen=spring]').waitFor();
      await shot('08-spring-complete');
      await button('Title screen');
      await button('Spring Run');
      assert.equal((await status()).room,5);
    }else await button('Title screen');
    if(!smoke){
      await start(0);
      await page.evaluate(()=>{
        const g=window.__river().game;
        const foe=g.foes[0];
        g.hearts=1;
        Object.assign(g.player,{x:foe.x-16,y:foe.y});
      });
      await page.keyboard.down('ArrowRight');
      try{await page.locator('[data-screen=fall]').waitFor({timeout:4500});}
      finally{await page.keyboard.up('ArrowRight');}
      await shot('07-retry');
      await button('Try again');
      assert.equal((await status()).hearts,5);
      await button('Pause');await button('Title screen');
    }
    if(captures&&width!==844){
      await page.evaluate(([key,save])=>localStorage.setItem(key,JSON.stringify(save)),[SAVE_KEY,{...newRiverSave(),room:0,frontier:41}]);
      await page.reload();await ready();await button('Watershed chart');
      for(const [index,r] of REACHES.entries()){
        if(index>0){await button('Pause');await button('Watershed chart');}
        await button(r.title);
        if(r.guardian){
          await page.evaluate(()=>{
            const g=window.__river().game;
            const stake=g.get('u')[0];
            g.lead='enzo';
            Object.assign(g.boat,{x:stake.x-11,y:stake.y+8,aboard:true});
            Object.assign(g.heroes.enzo,{x:stake.x-11,y:stake.y+8});
            g.arena.primed=true;g.arena.since=g.tick;
          });
          await page.waitForTimeout(240);
        }else await page.waitForTimeout(130);
        await shot(`${String(index+10).padStart(2,'0')}-${r.id}`);
      }
    }
    assert.deepEqual(errors,[]);
    console.log(`River browser ${width}x${height}: ${real} input activations, tutorial, two boss phases, remapping, menus, save and controller tag.`);
  }finally{await context.close();}
}
try{
  for(const [width,height] of modes)await deniedGamepads(width,height);
  for(const [width,height] of modes)await exercise(width,height);
}
finally{await browser.close();}
