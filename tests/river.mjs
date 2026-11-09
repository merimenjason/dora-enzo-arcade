import assert from 'node:assert/strict';
import { RiverGame, newRiverSave, readRiverSave } from '../.checks/river-game.js';
import { REACHES, TILE } from '../.checks/river-world.js';
import { frames, press, playReach } from './river-driver.mjs';

const setup=(room,seed=17,assist=true)=>new RiverGame({...newRiverSave(seed),room,frontier:room},{assist,difficulty:'standard'});
assert.equal(REACHES.length,42);
assert.equal(new Set(REACHES.map(r=>r.rows.join('\n'))).size,42);
assert.equal(REACHES.filter(r=>r.guardian).length,6);
assert.equal(REACHES.reduce((sum,r)=>sum+r.markers.filter(m=>'sS'.includes(m.type)).length,0),24);
for(const room of REACHES){
  for(const type of 'DEJXm')assert.ok(room.markers.some(m=>m.type===type),room.id+' lacks '+type);
  assert.ok(room.markers.some(m=>m.type===(room.guardian?'w':'O')));
}
assert.deepEqual(readRiverSave('{broken'),newRiverSave());
const original={...newRiverSave(3),room:7,frontier:14,marks:['landing'],cleared:['landing']};
assert.deepEqual(readRiverSave(JSON.stringify(original)),original);
assert.deepEqual(readRiverSave(JSON.stringify({...original,room:41,marks:['fake']})).marks,[]);
assert.equal(readRiverSave(JSON.stringify({...original,room:41})).room,14);
const a=setup(1),b=setup(1);
for(let i=0;i<720;i++){
  const input={x:i%80<40?.5:-.25,y:i%105<56?.15:0,use:i%89===0,tag:i%102===0,skill:i%45===0,jump:i%120===0};
  a.step(input);b.step(input);
}
assert.deepEqual(structuredClone(a),structuredClone(b),'seeded frame replay');
const first=setup(0);
Object.assign(first.player,first.get('g')[0]);
const branch=first.get('g')[0];
assert.ok(first.prompt().text.includes('sluice'));
press(first,'use');
frames(first,50);
assert.ok(first.water[0]>.98&&first.water[1]<.02,'one branch fills and the other drains');
assert.equal(first.lead,'dora');
press(first,'tag');
assert.equal(first.lead,'enzo');
assert.equal(first.heroes.dora.x,branch.x);
Object.assign(first.player,first.get('J')[0]);
press(first,'use');
assert.equal(first.boat.aboard,true);
const before=first.player.x;
frames(first,9,{x:1,y:0,skill:true});
assert.ok(first.player.x>before,'pole drives the same skiff the scene draws');
assert.equal(first.exitReady,false);

for(let i=0;i<REACHES.length;i++){
  const game=setup(i);
  assert.equal(playReach(game),'clear',game.room.id);
  assert.ok(game.save.cleared.includes(game.room.id));
  if(i+1<REACHES.length)assert.ok(game.advance());
}
const finale=setup(41);
assert.equal(playReach(finale),'clear');
assert.equal(finale.ending,true);
assert.equal(finale.beginSpring(),true);
for(let i=0;i<6;i++){
  assert.equal(finale.roomIndex,i*7+5);
  assert.equal(finale.gates[0],true);
  assert.equal(playReach(finale),'clear','Spring '+finale.room.id);
  if(i<5)assert.ok(finale.advance());
}
assert.equal(finale.save.springCleared.length,6);
assert.ok(finale.beginSpring());
assert.deepEqual(finale.save.springCleared,[]);
console.log('River engine: 42 reaches, 6 Spring remixes, save, seeded replay and tag-swap rules passed.');

const sample=[];
for(let i=0;i<REACHES.length;i++){
  const r=REACHES[i];
  r.rows.forEach((line,row)=>[...line].forEach((tile,col)=>{
    if(tile!=='+')return;
    const x=col*TILE+10,y=row*TILE+10;
    const base=setup(i);
    const axes=[[1,0],[-1,0],[0,1],[0,-1]];
    const dir=axes.find(([dx,dy])=>[14,-24,-28].every(a=>{
      const c=base.at({x:x+dx*a,y:y+dy*a});
      return !c.solid&&c.depth<.48;
    }));
    assert.ok(dir,'safe hop approach '+r.id);
    const widths={};
    for(const hero of ['dora','enzo']){
      let best=0,run=0;
      for(let d=52;d>=12;d-=4){
        const g=setup(i,17,false);
        g.lead=hero;g.foes=[];
        const [dx,dy]=dir;
        Object.assign(g.player,{x:x-dx*d,y:y-dy*d});
        const stand=g.at(g.player);
        frames(g,29,{x:dx,y:dy,jump:true});
        const passed=!stand.solid&&stand.depth<.48&&((g.player.x-x)*dx+(g.player.y-y)*dy)>=14;
        run=passed?run+1:0;best=Math.max(best,run);
      }
      widths[hero]=Math.max(0,(best-1)*4);
      assert.ok(widths[hero]>=16,`${r.id} ${hero} only ${widths[hero]}px`);
    }
    sample.push({reach:r.id,...widths});
  }));
}
const bossWindows=[];
for(let i=6;i<REACHES.length;i+=7)for(let phase=0;phase<2;phase++){
  const intervals=[];
  const fixture=setup(i,17,false);
  fixture.arena.phase=phase;
  for(let delay=0;delay<fixture.cycle;delay++){
    const g=setup(i,17,false), stake=g.get(phase?'w':'u')[0];
    g.lead='enzo';g.boat.aboard=true;
    Object.assign(g.player,stake);Object.assign(g.boat,stake);
    Object.assign(g.arena,{primed:true,phase,since:0});
    g.tick=delay;
    g.gates[phase]=true;g.water[phase*2]=1;
    press(g,'use');
    if(g.arena.phase>phase)intervals.push(delay);
  }
  assert.ok(intervals.length>=6,REACHES[i].id);
  bossWindows.push({reach:REACHES[i].id,phase:phase+1,frames:intervals.length});
}
console.log(JSON.stringify({hopWindows:sample,bossWindows},null,2));
