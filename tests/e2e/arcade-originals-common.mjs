import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { freshSave } from '../../.checks/arcade-originals-rules.js';
import { solve } from '../arcade-originals-common.mjs';

const base=process.env.BASE_URL??'http://localhost:3109';
const shots=process.env.ARCADE_SHOTS;
const sizes=[[1280,800],[844,390],[390,844]];
const variants={
  faultline:{tool:'rescue',hidden:'ledger',verbs:['wait','go','brace','patch','escort','ledger'],
    extra:[s=>s.kits<1,s=>s.bonus],prepareLevel:0},
  'night-wire':{tool:'case',hidden:'archive',verbs:['wait','go','fix','bypass','hear','plug','archive'],extra:[s=>s.bonus],prepareLevel:3},
  'second-show':{tool:'act',hidden:'keepsake',verbs:['wait','go','bow','wave','curtain','rig','take','drop','keepsake'],
    extra:[s=>s.lastCue==='curtain',s=>s.bonus,s=>s.trap],prepareLevel:3},
};
export async function checkBrowser(rules, debug){
  const browser=await chromium.launch(), variant=variants[rules.id];
  try{
    for(const [width,height] of sizes){
      const touch=width!==1280, tag=width===1280?'desktop':width===390?'portrait':'landscape';
      const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce',deviceScaleFactor:1});
      await context.addInitScript(()=>{
        const pressed=new Set();
        Object.defineProperty(navigator,'getGamepads',{value:()=>[{buttons:Array.from({length:17},(_,i)=>({pressed:pressed.has(i)}))}]});
        window.__pressOriginalPad=(i,on)=>on?pressed.add(i):pressed.delete(i);
      });
      const page=await context.newPage(), errors=[];
      page.on('pageerror',err=>errors.push(err.message));page.setDefaultTimeout(8000);
      const state=()=>page.evaluate(name=>window[name](),debug);
      const ready=()=>page.locator('main[data-ready="true"]').waitFor();
      const button=(name)=>page.getByRole('button',{name,exact:typeof name==='string'});
      let actions=0, turns=0;
      const activate=async (control)=>{
        if(touch)await control.tap();
        else {await control.focus();await page.keyboard.press('Enter');}
        actions++;
      };
      const press=(name)=>activate(button(name));
      const pad=async (i)=>{
        await page.evaluate(async i=>{
          window.__pressOriginalPad(i,true);
          for(let n=0;n<3;n++)await new Promise(requestAnimationFrame);
          window.__pressOriginalPad(i,false);
          for(let n=0;n<3;n++)await new Promise(requestAnimationFrame);
        },i);
      };
      const verbs=new Set();
      const draft=async pair=>{
        for(const who of ['dora','enzo']){
          verbs.add(pair[who].split(':')[0]);
          if(pair[who]==='wait')continue;
          if((await state()).hero!==who)await activate(page.locator(`button[data-hero="${who}"]`));
          await activate(page.locator(`button[data-action="${pair[who]}"]`));
        }
      };
      const execute=async pairs=>{
        for(const pair of pairs){
          await draft(pair);
          await activate(page.getByTestId('commit'));
          turns++;
        }
      };
      const snap=async name=>{
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll');
        if(!shots||tag==='landscape')return;
        const dir=join(shots,rules.id,tag);await mkdir(dir,{recursive:true});
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:join(dir,name+'.png'),animations:'disabled'});
      };
      const load=async level=>{
        await page.evaluate(([id,save])=>localStorage.setItem(id+'-v1',JSON.stringify(save)),
          [rules.id,{...freshSave(),level,unlocked:level,active:true}]);
        await page.reload();await ready();await press('Continue');
        assert.equal((await state()).state.turn,0);
      };
      await page.goto(base+'/'+rules.id);await ready();await snap('01-title');
      assert.equal(await page.getByRole('alert').count(),0,'all artwork loaded');
      await press('Chapters');await snap('02-chapters');
      assert.equal(await button(/^02 · /).isDisabled(),true);
      await press('Menu');await press('How to play');await snap('04-help');await press('Back');
      await press('Settings');await snap('03-settings');
      await press('Helping hand: On');await press('Sound: On');
      await press('Story');assert.equal((await state()).save.difficulty,'story');
      await press('Expert');assert.equal((await state()).save.difficulty,'expert');
      await press('Standard');assert.equal((await state()).save.difficulty,'standard');
      const firstHidden=(await state()).state[variant.hidden];
      await press('Move hidden collectibles');await press('Cancel');
      await press('Move hidden collectibles');await press('Restart');assert.equal((await state()).save.seed,92);
      assert.notEqual((await state()).state[variant.hidden],firstHidden);
      await press('Play turn: Enter');await page.keyboard.press('KeyZ');
      assert.match(await page.getByRole('status').innerText(),/already has/);
      await page.keyboard.press('KeyK');
      await press('Switch hero: Q');await page.keyboard.press('Escape');
      await press('Undo turn: Z');await page.keyboard.press('KeyJ');
      await press('Back');await press('Start');
      assert.equal(await page.getByTestId('helping-hand').count(),0);
      await press('Settings');await press('Helping hand: Off');await press('Sound: Off');await press('Back');
      assert.match(await page.getByTestId('helping-hand').innerText(),/K to play/);
      await page.keyboard.press('KeyQ');assert.equal((await state()).hero,'enzo');
      await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');
      assert.notEqual((await state()).draft.enzo,'wait');
      const snapshot=await state();
      await page.waitForTimeout(350);
      assert.deepEqual((await state()).state,snapshot.state,'decision remains legal after 21 frames');
      await page.keyboard.press('KeyK');assert.equal((await state()).state.turn,1);
      await page.keyboard.press('KeyJ');assert.equal((await state()).state.turn,0);
      await pad(15);assert.equal((await state()).hero,'dora');
      await pad(13);await pad(0);
      const doraFirst=rules.actions(0,(await state()).state,'dora')[1]?.id??'wait';
      assert.equal((await state()).draft.dora,doraFirst);
      await pad(9);assert.equal((await state()).state.turn,1);
      await pad(1);assert.equal((await state()).state.turn,0);
      await press('Settings');await press('Reset keys');assert.equal((await state()).save.keys.step,'Enter');
      await press('Back');
      await press(`Restart ${variant.tool}`);await press('Cancel');
      await press(`Restart ${variant.tool}`);await press('Restart');
      await snap('05-chapter-1');
      const start=(await state()).state;
      const first=solve(rules,0,start);assert.ok(first);
      await draft(first[0]);await snap('05b-planning');
      const activeHero=(await state()).hero;
      await press('Hold');assert.equal((await state()).draft[activeHero],'wait');
      await draft(first[0]);
      if(rules.maxPlan>1){
        await pad(2);
        assert.equal((await state()).queue.length,1);await press('Undo');
        assert.equal((await state()).queue.length,0);
        for(const pair of first.slice(0,3)){await draft(pair);await press(/^Queue beat/);turns++;}
        assert.ok(await button(/^Queue beat/).isDisabled());
        await activate(page.getByTestId('commit'));assert.equal((await state()).state.turn,3);
        await execute(first.slice(3));
      }else await execute(first);
      assert.equal((await state()).state.phase,'clear');assert.equal((await state()).save.unlocked,1);
      const firstClear=(await state()).save;
      await press('Next');assert.equal((await state()).save.level,1);
      await page.evaluate(([id,save])=>localStorage.setItem(id+'-v1',JSON.stringify(save)),[rules.id,firstClear]);
      await page.reload();await ready();await press('Continue');
      assert.equal((await state()).state.phase,'clear');
      await pad(9);assert.equal((await state()).save.level,1);
      await pad(8);assert.equal((await state()).screen,'title');
      await pad(0);assert.equal((await state()).screen,'play');assert.equal((await state()).save.level,1);
      await activate(page.getByTestId('commit'));await press('Undo');
      await activate(page.getByTestId('commit'));await press('Settings');await press('Story');
      await press('Restart');await press('Back');assert.equal((await state()).state.turn,0);
      await press('Menu');await press('Chapters');await press(/^01 · /);
      assert.equal((await state()).save.level,0);
      for(let n=0;n<rules.missions[0].limit+7;n++)await activate(page.getByTestId('commit'));
      assert.equal((await state()).state.phase,'lost');
      await press('Retry');assert.equal((await state()).state.turn,0);
      for(const goal of variant.extra){
        await load(variant.prepareLevel);
        const plan=solve(rules,variant.prepareLevel,(await state()).state,{goal,width:150});
        assert.ok(plan?.length,`${rules.id} optional mechanic is reachable`);
        await execute(plan);
        assert.ok(goal((await state()).state));
      }
      for(const [i,level] of [4,8,12,15].entries()){
        await load(level);
        await snap(i<3?`0${6+i}-chapter-${i+2}`:'09-finale');
        if(level===15){
          const plan=solve(rules,15,(await state()).state);assert.ok(plan);
          await execute(plan);
          assert.equal((await state()).state.phase,'clear');
          assert.ok(await page.getByText(rules.ending,{exact:true}).isVisible());
          await snap('10-finale-clear');
          await press('Undo');assert.equal((await state()).state.phase,'playing');
          await execute(plan.slice(-1));await press('Chapters');
        }
      }
      assert.deepEqual([...verbs].sort(),[...variant.verbs].sort(),`${rules.id} action kinds`);
      assert.ok(!(await page.locator('body').innerText()).match(/\bNaN\b|undefined|\[object Object\]/));
      await activate(page.getByRole('link',{name:'← Arcade'}));await page.waitForURL(base+'/');
      assert.equal(await page.locator('.arcade-card').count(),98);
      assert.deepEqual(errors,[]);
      console.log(`${rules.title} ${width}×${height}: ${actions} real button inputs, ${turns} planned actions, ${verbs.size} action kinds; first mission, finale and input checks passed`);
      await context.close();
    }
  }finally{await browser.close();}
}
