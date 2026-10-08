import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Game, HOME, CAGE, BOWL, CRATE, GAP, dist } from '../.checks/moonlight-game.js';
export function walk(g,to,limit=40,check=()=>{}){
  const until=g.time+limit;g.go(to);g.trail=g.path(g.hero,to,true);let catches=g.catches;
  while(dist(g.hero,to)>24&&g.time<until&&g.state==='playing'){
    if(g.catches!==catches){g.trail=g.path(g.hero,to,true);g.target=to;catches=g.catches;}
    if(g.hero.who==='dora'&&g.hero.cooldown===0)g.ability();
    if(g.hero.who==='enzo'&&g.hero.cooldown===0&&g.owls.some(o=>dist(o,g.hero)<220))g.ability();
    g.update(.1);check(g);g.events=[];
  }return dist(g.hero,to)<=24;
}
export function play(night,mode='night',delay=0,check=()=>{}){
  const g=new Game(night,mode);g.go({...g.hero});for(let t=0;t<delay;t+=.1)g.update(.1);check(g);g.events=[];g.switch();const move=p=>walk(g,p,40,check);
  move(BOWL);g.interact();move(CRATE);g.interact();move(CAGE);g.interact();
  for(const t of g.treats.filter(t=>!t.taken).sort((a,b)=>b.x-a.x))move(t);
  move(HOME);g.interact();g.switch();move(GAP[0]);g.interact();move(HOME);g.interact();
  for(let i=0;i<100&&g.state==='playing';i++)g.update(.1);
  return g;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){for(let n=0;n<3;n++)for(const delay of [0,3,7,12,20]){const g=play(n,'night',delay);console.log(`Night ${n+1}, ${delay}s start: ${g.state}, ${g.collected}/${g.treats.length} treats, rescue ${g.rescued}, ${g.catches} catches, ${g.time.toFixed(1)}s, ${g.stars} stars.`);assert.equal(g.state,'won');}}
