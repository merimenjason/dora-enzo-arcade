import assert from 'node:assert/strict';
import { RiverGame, newRiverSave } from '../.checks/river-game.js';
import { REACHES } from '../.checks/river-world.js';
import { playReach } from './river-driver.mjs';

const quick=process.argv.includes('--quick');
const seeds=quick?[17]:[17,38,91,3731];
const modes=quick?['standard']:['story','standard','expert'];
const levels=quick?[0,6,14,27,41]:REACHES.map((_,i)=>i);
for(const difficulty of modes){
  let total=0,clear=0,first=0,firstTotal=0,ticks=0;
  const failures=[];
  for(const seed of seeds)for(const room of levels){
    let word=seed^Math.imul(room+4,1013904223);
    const rng=()=>{word=(Math.imul(word,1664525)+1013904223)>>>0;return word/4294967296;};
    const g=new RiverGame({...newRiverSave(seed),room,frontier:room},{assist:difficulty!=='expert',difficulty});
    const result=playReach(g,{rng,noise:difficulty==='story'?.038:difficulty==='standard'?.064:.083});
    total++;ticks+=g.tick;
    if(room<7)firstTotal++;
    if(result==='clear'){clear++;if(room<7)first++;}
    else failures.push(`${g.room.id}:${seed} ${result} (${g.hearts} HP, ${g.player.x.toFixed(0)},${g.player.y.toFixed(0)})`);
  }
  console.log(JSON.stringify({difficulty,clear,total,first,firstTotal,meanSeconds:Math.round(ticks/total/60),failures}));
  if(!process.argv.includes('--diagnose')){
    assert.ok(first>=Math.ceil(firstTotal*(difficulty==='expert'?.75:.9)),difficulty+' first area clears');
    assert.ok(clear>=Math.ceil(total*(difficulty==='expert'?.75:.9)),difficulty+' full clear target');
  }
}
