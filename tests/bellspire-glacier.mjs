import assert from 'node:assert/strict';
import { BellspireGame, ABILITY_ORDER, COMPLETION, INFO, NO_INPUT, TILE, COLS, ROWS, freshSave, roomRect, roomById } from '../.checks/bellspire-game.js';
import { GLACIER_ROOMS, GLACIER_GATE, GLACIER_RETURN, ROOT_LIFT, GLACIER_VAULT, GLACIER_VAULT_FROM, GLACIER_VAULT_DOOR } from '../.checks/bellspire-glacier-world.js';
import { GLACIER_TELL, GLACIER_TIMING } from '../.checks/bellspire-glacier.js';
import { navEnv, Graph } from '../.checks/bellspire-nav.js';
import { onIce, stepBody } from '../.checks/bellspire-physics.js';

const names = { vicuna:'glacier-vicuna', cat:'glacier-osjollo', gate:'glacier-sun-gate', frozen:'glacier-frozen',
  gallery:'glacier-mirrors', thaw:'glacier-first-thaw', slide:'glacier-slide', serac:'glacier-serac' };
let checks = 0;
const eq = (...a) => { assert.equal(...a); checks++; };
const ok = (...a) => { assert.ok(...a); checks++; };
const tick = (g, input = {}, n = 1) => { for (let i=0;i<n;i++) g.step({...NO_INPUT,...input}); };
const tap = (g, input) => { tick(g,input); tick(g); };
const state = (g) => g.boss?.st;
function wait(g, test, max=420, input={}) {
  for (let i=0;i<max;i++) { if (test()) return i; tick(g,input); }
  assert.fail('Wait expired: '+[g.room.id,state(g),g.body.x-roomRect(g.room).x,g.body.y-roomRect(g.room).y,g.lead,g.glacier?.state(0)]);
}
const goal = (g,c,r) => ({x:roomRect(g.room).x + (c+.5)*TILE,y:roomRect(g.room).y+(r+1)*TILE});
function stance(g,c,r) {
  Object.assign(g.body,goal(g,c,r),{vx:0,vy:0,ground:true,climb:false,coyote:0});
  Object.assign(g.follower,goal(g,c,r));
  g.glacierClimbing=false;
  tick(g);
}
function glacierSave(hero='dora', gear=true) {
  const s=freshSave();
  s.lead=hero; s.flags.push('boss:mother','boss:hollow','boss:tollkeeper','boss:graft-mother','script:intro','script:belfryCall','epilogue','epilogue2','epilogue3');
  s.abilities=ABILITY_ORDER.filter(a=>gear||!['sunmirror','icepick'].includes(a)); s.spells.push('frost');
  return s;
}
function testGame(hero='dora',gear=true,assist=false) { return new BellspireGame(glacierSave(hero,gear),{assist,strict:!assist,wisp:false},31); }
function begin(id, hero='enzo', x=20) {
  const g=testGame(hero);
  const room=roomById(id);
  g.setFlag('script:boss:'+room.boss);
  g.teleport(id,x,14); stance(g,x,14);
  wait(g,()=>state(g)==='glacierRest',220);
  return g;
}
function tag(g, to) {
  if(g.lead!==to) { wait(g,()=>!g.tagCd,75); tap(g,{tag:true}); }
  eq(g.lead,to);
}
function socket(g,i=0){
  const [c,r]=g.room.glacier.sockets[i].at;
  stance(g,c,r); tap(g,{up:true});
}

eq(GLACIER_ROOMS.length,12);
eq(COMPLETION.glacier.cells,24);
for(const r of GLACIER_ROOMS) {
  eq(r.rows.length,17,r.id); ok(r.rows.every(row=>row.length===60),r.id);
  ok(!r.dark,r.id);
}
{
  const g=testGame('dora',false);
  g.save.flags=g.save.flags.filter(f=>f!=='boss:graft-mother');
  g.teleport(GLACIER_RETURN,...ROOT_LIFT); stance(g,...ROOT_LIFT); tap(g,{up:true});
  eq(g.room.id,GLACIER_RETURN,'root lift stays locked for old saves');
  g.setFlag('boss:graft-mother'); g.boss=null; g.dialog=null; tap(g,{up:true}); eq(g.room.id,GLACIER_GATE);
  ok(g.flag('glacier:visited'));
  tap(g,{up:true}); eq(g.room.id,GLACIER_RETURN,'root lift is reversible');
  g.teleport('glacier-camp',25,14); tick(g,{},10); ok(g.has('sunmirror'),'camp pedestal gives Sun Mirror');
  g.teleport(names.serac,51,14); tick(g,{},10); ok(g.has('icepick'),'Serac Walk pedestal gives Ice Pick');
  g.teleport(GLACIER_VAULT_FROM,...GLACIER_VAULT_DOOR); stance(g,...GLACIER_VAULT_DOOR);tap(g,{up:true});eq(g.room.id,GLACIER_VAULT);
  tap(g,{up:true});eq(g.room.id,GLACIER_VAULT_FROM,'optional vault has a return');
}
{
  const g=testGame('enzo',true,true);
  g.teleport(names.gallery,34,10); socket(g,1);
  eq(g.glacier.state(0),'plug'); ok(!g.glacier.lit(1),'shadowed mirror cannot fire');
  socket(g); eq(g.glacier.state(0),'plug'); ok(g.glacier.lit(0));
  socket(g,1); eq(g.glacier.state(0),'water'); ok(g.glacier.lit(1));
  g.teleport(names.frozen,43,14); socket(g);
  eq(g.glacier.state(0),'water');
  stance(g,34,14); eq(g.glacierHint()?.keys[0],'cast');
  tap(g,{cast:true}); eq(g.glacier.state(0),'frozen');
  stance(g,30,14); eq(g.glacierHint()?.keys[0],'tag');
  tick(g,{up:true},18); ok(!g.body.climb,'Enzo cannot climb frozen ice');
  tick(g); tag(g,'dora');
  eq(g.glacierHint()?.keys[0],'up');
  wait(g,()=>g.body.ground&&g.body.y<goal(g,30,14).y,150,{up:true});
  ok(g.body.y <= roomRect(g.room).y + 9*TILE,'Dora climbed all the way to the top');
  g.teleport(names.thaw,19,14); socket(g); eq(g.glacier.state(0),'plug','Dora cannot turn the Sun Mirror');
  tag(g,'enzo'); socket(g); eq(g.glacier.state(0),'water');
  g.teleport(names.gallery,52,14); g.teleport(names.thaw,28,14); eq(g.glacier.state(0),'water','untimed fall survives room reload');
}
{
  const g=testGame('enzo',true,true);
  g.teleport(GLACIER_VAULT_FROM,14,14);socket(g);
  eq(g.glacier.state(0),'water');
  tick(g,{},GLACIER_TIMING.helpWater); eq(g.glacier.state(0),'frozen','Meltwater refreezes on its own');
  tick(g,{},GLACIER_TIMING.helpIce); eq(g.glacier.state(0),'plug','it resets from a safe distance');
  g.teleport(names.slide,16,14);tag(g,'dora');stance(g,16,14);
  tick(g,{right:true},20);ok(g.body.vx>2.5);
  tick(g,{right:true,down:true,attack:true});eq(g.body.vx,0);ok(g.body.iceBraking);
}
for(const hero of ['dora','enzo']) {
  const run=(react)=>{
    const g=testGame(hero);g.teleport(names.serac,30,14);
    const ice=g.glacier.icicles[1], x=ice.x+(react<0?0:39);
    Object.assign(g.body,{x,ground:true,vx:0,vy:0});
    const hp=g.save.heroes[hero].hp;
    wait(g,()=>ice.stage==='tell',10);
    if(react>=0){tick(g,{},react);tick(g,{right:true},86);}
    else tick(g,{},105);
    return hp===g.save.heroes[hero].hp;
  };
  ok(!run(-1),'standing under an icicle is a real threat');
  for(let f=12;f<=18;f++)ok(run(f),'both heroes can leave the icicle footprint after a human delay');
}
function approachRootLift(g) {
  const o=roomRect(g.room);
  tick(g,{},10);
  wait(g,()=>g.body.x-o.x>46.4*TILE,170,{right:true});
  wait(g,()=>g.body.ground&&g.body.y-o.y<=9*TILE,140,{up:true});
  tick(g,{right:true,jump:true},18);
  wait(g,()=>g.body.x-o.x>=52.5*TILE,100,{right:true});
  tick(g,{},10);
  eq(g.nearbyLabel(),'Take the root lift up','root lift is reachable from the orchard arena floor');
}
for (const hero of ['dora','enzo']) {
  const g=testGame(hero);
  g.teleport(GLACIER_RETURN,33,14);
  approachRootLift(g);
  tap(g,{up:true});
  eq(g.room.id,GLACIER_GATE,'either hero can ride the root lift from the arena');
}

const navState = (g) => ({ abilities:g.save.abilities,water:g.save.water,keeper:true,calmed:g.save.flags.filter(f=>f.startsWith('boss:')).map(f=>f.slice(5)),
  glacierFalls:new Map((g.room.glacier?.falls??[]).map((_,i)=>[g.room.id+':'+i,g.glacier.state(i)])) });
for(const room of GLACIER_ROOMS) {
  const g=testGame();
  g.teleport(room.id,7,14);
  for(const stage of ['plug','water','frozen']){
    for(let i=0;i<(room.glacier.falls?.length??0);i++)g.glacier.change(i,stage,g.tick,false);
    for(const hero of ['dora','enzo']) {
      g.lead=hero; const env=navEnv(navState(g),hero), c0=room.gx*COLS,r0=room.gy*ROWS;
      for(let y=0;y<ROWS;y++)for(let x=0;x<60;x++){
        const c=c0+x,r=r0+y;
        eq(env.solid(c,r),g.solidTile(c,r),`${room.id} solid ${x},${y}`);
        eq(env.ladder(c,r),g.ladderTile(c,r),`${room.id} climb ${x},${y}`);
        eq(env.ice(c,r),g.env.ice(c,r),`${room.id} slick ${x},${y}`);
      }
    }
  }
}
{
  const g=testGame();g.teleport(names.frozen,30,14);
  g.glacier.change(0,'frozen',g.tick,false);
  const graph = new Graph(navState(g)); const p=goal(g,30,14);
  const start=graph.nodeAt(p.x,p.y);
  const path=graph.path(start,n=>n.y<=roomRect(g.room).y+9*TILE,1500);
  ok(path?.length && path.every(e=>e.macro.hero==='dora'),'planner can route Dora up the authored frozen fall');
}
function damageWindow(g){
  const h=g.boss.hp;
  g.damageBoss(50,g.boss.x,g.boss.y);
  eq(g.boss.hp,h,'Enzo cannot damage the opening');
  tag(g,'dora');
  const b=g.boss;
  Object.assign(g.body,{x:b.x-31,y:b.y,vx:0,vy:0,face:1,ground:true,climb:false});
  g.glacierClimbing=false;
  tick(g,{},16);tap(g,{attack:true});tick(g,{},20);
  ok(g.boss.hp<h,'Dora can land a sword strike during the opening');
}
{
  const g=begin(names.vicuna,'enzo',44), h=g.boss.hp;
  g.damageBoss(50,g.boss.x,g.boss.y);eq(g.boss.hp,h);
  socket(g);eq(g.glacier.state(0),'water');
  wait(g,()=>state(g)==='glacierOpen',200);
  damageWindow(g);
}
{
  const g=begin(names.cat,'enzo',17);socket(g);
  eq(state(g),'glacierDrop');eq(g.glacier.state(0),'water');
  stance(g,33,14);tap(g,{cast:true});eq(g.glacier.state(0),'frozen');
  tag(g,'dora');stance(g,35,14);
  wait(g,()=>g.body.y<=g.boss.sy+1,160,{up:true});
  tick(g,{right:true},28);
  wait(g,()=>state(g)==='glacierOpen',260);
  // damageWindow checks both heroes. The earlier Enzo check already proved he could not climb.
  tag(g,'enzo');damageWindow(g);
}
{
  const g=begin(names.gate,'enzo',29);
  socket(g);eq(state(g),'glacierRest','reflection requires a live sun beam');
  wait(g,()=>state(g)==='glacierTell');
  socket(g);eq(state(g),'glacierOpen');damageWindow(g);
}

const jumps=[];
for (const [id, left, right] of [[names.slide,32,34],[names.serac,34,36]]) {
  for (const dir of [-1,1]) for (const surface of ['ice','stone']) for (const run of [0,2,4,8]) for (const hero of ['dora','enzo']) {
    const g=testGame(hero,false);
    const ox=roomRect(roomById(id)).x, oy=roomRect(roomById(id)).y;
    const lip=(dir>0?left:right)*TILE+ox, far=(dir>0?right:left)*TILE+ox, y=oy+15*TILE;
    g.teleport(id,dir>0?left-1:right,14);
    // Surface override changes friction only. Solid tiles and landing geometry remain the real room.
    const env={...g.env, ice: (c,r) => r===y/TILE && surface==='ice' && g.solidTile(c,r)};
    const cap={...g.caps(),double:false,glide:false,dash:false,wallkick:false,rope:false,ropeAssist:false};
    const held={dir,up:false,down:false,dashP:false,jumpP:false,jumpH:false};
    let best=0, count=0, attempts=0;
    for(let offset=64;offset>=4;offset-=4){
      const at=lip-dir*offset;
      const b={...g.body,x:at-dir*run*TILE,y,vx:0,vy:0,ground:true,coyote:0,climb:false};
      if(!env.solid(Math.floor(b.x/TILE),y/TILE)) { count=0; continue; }
      for(let t=0;t<120&&(b.x-at)*dir<-.001&&b.ground;t++)stepBody(b,held,env,cap);
      attempts++;
      if(!b.ground || (b.x-at)*dir<-.01) { count=0; continue; }
      let clear=false;
      for(let t=0;t<55;t++){
        stepBody(b,{...held,jumpP:t===0,jumpH:t<12},env,cap);
        if(b.ground){clear=b.y===y&&(b.x-far)*dir>=0;break;}
      }
      if(clear){ count++; best=Math.max(best,(count-1)*4); } else count=0;
    }
    jumps.push({id,dir,surface,run,hero,best,attempts});
    ok(best>=16,JSON.stringify(jumps.at(-1)));
  }
}
console.table(jumps);
const dodges=[];
for(const [key,id,c] of [['vicuna',names.vicuna,18],['osjollo',names.cat,25],['warden',names.gate,34]]) {
  for(const hero of ['dora','enzo']){
    function run(reaction){
      const g=begin(id,hero,c), b=g.boss;
      // Hold the practice spot until the real wind-up picks a target.
      stance(g,c,14);
      wait(g,()=>state(g)==='glacierTell');
      const hp=g.save.heroes[hero].hp;
      const tell=wait(g,()=>state(g)==='glacierRush');
      let jumped=false;
      for(let t=0;t<120&&state(g)==='glacierRush';t++){
        tick(g,{jump:reaction>=0&&t>=reaction&&t<reaction+18});
        jumped ||= g.body.jumped==='ground';
      }
      return { tell, survived:g.save.heroes[hero].hp===hp, jumped };
    }
    const idle=run(-1);
    ok(!idle.survived,`${key} control is a real threat to ${hero}`);
    const wins=[];
    for(let t=12;t<=18;t++) { const d=run(t); if(d.survived&&d.jumped)wins.push(t); }
    ok(wins.length === 7,`${key} needs a human-delay jump window for ${hero}`);
    dodges.push({guardian:key,hero,tell:idle.tell,passed:wins.join(',')});
  }
}
console.table(dodges);
console.log(`Glacier Stair: ${checks} assertions; ${GLACIER_ROOMS.length} authored rooms and three two-hero guardian openings.`);

// From the old-save root lift to the ending using only inputs. The fixture sets the player's earned
// Orchard/Foundry progress and equipment; after initial placement there are no teleports or puzzle flags.
{
  const save=glacierSave('dora',false);
  for(const h of Object.values(save.heroes)){h.level=28;h.hp=200;h.mp=100;}
  save.gear.push('moonsteel');save.equip.dora.weapon='moonsteel';
  for(const r of GLACIER_ROOMS)if(r.boss)save.flags.push('script:boss:'+r.boss);
  const g=new BellspireGame(save,{assist:true,wisp:false},123);
  g.teleport(GLACIER_RETURN,33,14);
  const seen=[g.room.id];
  const remember=()=>{if(!seen.includes(g.room.id))seen.push(g.room.id);};
  function walkTo(room,c,limit=1400){
    const x=roomRect(roomById(room)).x+(c+.5)*TILE;
    const d=Math.sign(x-g.body.x), inp=d>0?{right:true}:{left:true};
    if(Math.abs(g.body.x-x)>2)wait(g,()=>d*(g.body.x-x)>=-2,limit,inp);
    eq(g.room.id,room,'room edge led to '+room);remember();
  }
  function holdUpUntil(test){wait(g,test,280,{up:true});tick(g);}
  function downShaft(room,c,to){
    walkTo(room,c);
    wait(g,()=>g.room.id===to&&g.body.ground&&!g.body.climb,360,{down:true});
    tick(g); remember();
  }
  function gap(room,lip,dir){
    walkTo(room,lip+(dir>0?-1.9:1.3));
    const horiz=dir>0?{right:true}:{left:true};
    tick(g,{...horiz,jump:true},18);
    wait(g,()=>g.body.ground,70,horiz);
    tick(g);
  }
  function mirror(i=0){
    const [c]=g.room.glacier.sockets[i].at;
    walkTo(g.room.id,c);tap(g,{up:true});
    ok(g.glacier.lit(i),'used real mirror input');
  }
  function frost(room,c){
    walkTo(room,c);tap(g,{cast:true});eq(g.glacier.state(0),'frozen');
  }
  function attackOpened(room){
    eq(state(g),'glacierOpen');
    tag(g,'dora');
    const b=g.boss, side=g.body.x>=b.x?1:-1, o=roomRect(g.room);
    walkTo(room,(b.x+side*26-o.x)/TILE-0.5);
    tick(g,side>0?{left:true}:{right:true});tick(g);
    const hp=b.hp;
    for(let i=0;i<60&&g.boss?.st==='glacierOpen';i++){tap(g,{attack:true});tick(g,{},12);}
    ok(!g.boss || g.boss.hp<hp,'a real melee attack landed on '+room);
    if(g.boss?.st==='calm')wait(g,()=>!g.boss,180);
  }
  approachRootLift(g);tap(g,{up:true});eq(g.room.id,GLACIER_GATE);remember();
  walkTo('glacier-camp',25);tick(g,{},4);ok(g.has('sunmirror'));
  tag(g,'enzo');walkTo(names.thaw,19);mirror();
  walkTo(names.slide,24);gap(names.slide,32,1);walkTo(names.slide,53);
  downShaft(names.slide,54,names.vicuna);
  wait(g,()=>state(g)==='glacierRest',280);mirror();
  wait(g,()=>state(g)==='glacierOpen',320);attackOpened(names.vicuna);
  eq(g.boss,null,'vicuña calmed on the route');
  walkTo(names.serac,51);tick(g,{},8);ok(g.has('icepick'));
  walkTo(names.serac,39);gap(names.serac,36,-1);
  tag(g,'enzo');walkTo(names.frozen,43);mirror();frost(names.frozen,34);
  walkTo(names.frozen,30);tag(g,'dora');
  holdUpUntil(()=>g.body.ground&&g.body.y<=roomRect(g.room).y+9*TILE);
  walkTo(names.frozen,4);wait(g,()=>g.body.ground,80);
  walkTo(names.gallery,48);tag(g,'enzo');mirror();
  walkTo(names.gallery,38);holdUpUntil(()=>g.body.ground&&g.body.y<=roomRect(g.room).y+11*TILE);
  mirror(1);walkTo(names.gallery,5);wait(g,()=>g.body.ground,100);
  downShaft(names.gallery,4,names.cat);
  walkTo(names.cat,17);wait(g,()=>state(g)==='glacierRest',300);
  mirror();frost(names.cat,32);walkTo(names.cat,36);tag(g,'dora');
  holdUpUntil(()=>g.body.ground&&g.body.y<=roomRect(g.room).y+8*TILE);
  wait(g,()=>state(g)==='glacierOpen',250);attackOpened(names.cat);
  eq(g.boss,null,'mountain cat calmed on the route');
  walkTo(names.cat,52);wait(g,()=>g.body.ground&&g.body.y>=roomRect(g.room).y+15*TILE,175,{down:true});tick(g);
  walkTo(GLACIER_VAULT_FROM,14);tag(g,'enzo');mirror();frost(GLACIER_VAULT_FROM,19);
  walkTo(GLACIER_VAULT_FROM,22);tag(g,'dora');
  holdUpUntil(()=>g.body.ground&&g.body.y<=roomRect(g.room).y+9*TILE);
  walkTo(GLACIER_VAULT_FROM,47);wait(g,()=>g.body.ground,100);
  tap(g,{up:true});eq(g.room.id,GLACIER_VAULT);remember();
  walkTo(GLACIER_VAULT,18);tag(g,'enzo');mirror();frost(GLACIER_VAULT,26);
  walkTo(GLACIER_VAULT,30);tag(g,'dora');
  holdUpUntil(()=>g.body.ground&&g.body.y<=roomRect(g.room).y+8*TILE);
  for(const c of [36,41,45]){walkTo(GLACIER_VAULT,c);tap(g,{up:true});}
  ok(g.save.gear.includes('dora-glacier-coat')&&g.save.gear.includes('enzo-glacier-coat'),'both optional outfits earned');
  walkTo(GLACIER_VAULT,47);tap(g,{up:true});ok(g.flag('mural:27'));
  walkTo(GLACIER_VAULT,3);wait(g,()=>g.body.ground,120);tap(g,{up:true});eq(g.room.id,GLACIER_VAULT_FROM);
  for(let phase=0;phase<5&&(phase===0||g.boss);phase++){
    walkTo(names.gate,29);tag(g,'enzo');
    wait(g,()=>state(g)==='glacierTell',400);mirror();attackOpened(names.gate);
  }
  eq(g.boss,null,'Warden calmed on the route');
  for(let i=0;i<8&&g.dialog;i++)tap(g,{jump:true});
  ok(g.flag('glacier:ending'));eq(seen.filter(id=>id.startsWith('glacier-')).length,12);
  console.log(`Glacier full route: ${seen.length-1} expansion rooms, 3 guardians, 2 outfits and ending, ${g.tick} engine ticks; ${checks} total assertions.`);
}
