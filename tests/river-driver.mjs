import { TILE } from '../.checks/river-world.js';
const ZERO={x:0,y:0};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const frames=(game,n,input=ZERO)=>{for(let i=0;i<n;i++)game.step(input);};
export const press=(g,key)=>{g.step({...ZERO,[key]:true});g.step(ZERO);};
const point=(x,y)=>({x:x*TILE+TILE/2,y:y*TILE+TILE/2});
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
export function waypoint(width,height,from,pass,to,radius) {
  const start=[Math.floor(from.x/TILE),Math.floor(from.y/TILE)];
  const id=(x,y)=>y*width+x;
  const startId=id(...start), queue=[start], parent=new Map([[startId,-1]]);
  for(let k=0;k<queue.length;k++){
    const [x,y]=queue[k], here=id(x,y);
    if(dist(point(x,y),to)<=radius){
      let target=here;
      while(parent.get(target)!==-1&&parent.get(target)!==startId)target=parent.get(target);
      return point(target%width,Math.floor(target/width));
    }
    for(const [dx,dy] of directions){
      const u=x+dx,v=y+dy,key=id(u,v);
      if(u<0||u>=width||v<0||v>=height||parent.has(key)||!pass(u,v))continue;
      parent.set(key,here);queue.push([u,v]);
    }
  }
  return null;
}
export function moveTo(g,target,{sail=false,radius=15,rng=()=>.5,noise=0,max=2300}={}) {
  const begin=g.tick;
  const aimRadius=Math.max(8,radius-2);
  while(!g.fall&&g.tick-begin<max){
    const at=g.player;
    if(dist(at,target)<=radius)return true;
    const next=waypoint(g.room.width,g.room.height,at,(x,y)=>{
      const cell=g.surface(x,y);
      return !cell.solid&&(sail?cell.depth>=.48:cell.depth<.48);
    },target,aimRadius);
    if(!next)return false;
    const direction={x:next.x-at.x,y:next.y-at.y};
    const length=Math.hypot(direction.x,direction.y)||1;
    // Choose a direction on a human cadence. A commitment is held for
    // 12–18 frames. Slow near the chosen cell to account for momentum.
    const reaction=12+Math.floor(rng()*7);
    const n=()=>noise*(rng()-.5);
    const scale=sail?Math.min(1,length/(reaction*2.25)):Math.min(1,length/(reaction*2.25));
    const drift=sail?g.at(at).flow:ZERO;
    const input={x:direction.x/length*scale-drift.x/2.65+n(),y:direction.y/length*scale-drift.y/2.65+n()};
    if(!sail&&g.foes.some(e=>dist(e,at)<40)&&rng()<.62)input.skill=true;
    if(sail&&g.foes.some(e=>dist(e,at)<31)&&rng()<.45)input.skill=true;
    frames(g,reaction,input);
  }
  return !g.fall&&dist(g.player,target)<=radius;
}
export function playReach(g,{rng=()=>.5,noise=0,onStep=()=>{}}={}) {
  const wait=()=>frames(g,48);
  const go=(target,sail=false,radius=17)=>moveTo(g,target,{sail,radius,rng,noise});
  const tag=(hero)=>{if(g.lead!==hero)press(g,'tag');};
  const operate=(mark)=>{
    tag('dora');
    if(!go(mark,false,8))return false;
    press(g,'use');wait();
    return g.worked[mark.type==='g'?0:1];
  };
  const sail=()=>{
    tag('enzo');
    if(g.boat.aboard)return true;
    if(!go(g.room.markers[g.boat.dock]))return false;
    press(g,'use');frames(g,7);
    return g.boat.aboard;
  };
  if(g.arena){
    for(let i=0;i<2;i++){
      if(!operate(g.get(i===0?'g':'j')[0]))return 'gate '+i;
      if(!sail())return 'launch '+i;
      const target=g.get(i===0?'u':'w')[0];
      let success=false;
      for(let j=0;j<20;j++){
        if(!go(target,true,17))return 'stake route '+i;
        onStep('stake',g);
        if(g.beat==='open')press(g,'use');
        if(g.arena.phase>i){success=true;break;}
        frames(g,12+Math.floor(rng()*7));
      }
      if(!success)return 'stake timing '+i;
    }
  }else{
    for(const gate of g.get('gj'))if(!operate(gate))return 'gate '+gate.type;
    const remote=g.get('q')[0];
    if(remote){
      tag('dora');
      if(!go(g.get('J')[0],false,8))return 'passenger dock';
      press(g,'use');
      if(!g.boat.passenger)return 'passenger';
    }
    if(!sail())return 'launch';
    const weight=g.get('k')[0];
    if(weight){
      const dock=g.get('o').sort((a,b)=>dist(a,weight)-dist(b,weight))[0];
      if(!go(dock,true,24))return 'island route';
      press(g,'use');frames(g,4);
      if(g.boat.aboard)return 'island moor';
      if(remote&&!operate(remote))return 'island gate';
      tag('enzo');
      if(!go(weight,false,8))return 'weight route';
      press(g,'use');
      if(!g.weight||!sail())return 'weight';
    }
  }
  const dock=g.get('m')[0];
  if(!go(dock,true,24))return 'mooring route';
  press(g,'use');frames(g,4);
  if(g.boat.aboard)return 'moor';
  onStep('dock',g);
  if(!g.arena){
    for(const intake of g.get('TV')){
      const branch=intake.type==='T'?0:1;
      const gate=g.get(branch?'jq':'g')[0];
      if(g.gates[branch]&&!operate(gate))return 'intake gate';
    }
    tag('enzo');
    if(!go(g.get('O')[0]))return 'wheel route';
    press(g,'use');
    if(!g.wheel)return 'wheel';
  }
  if(!go(g.get('X')[0]))return 'exit route';
  press(g,'use');frames(g,3);
  return g.clear?'clear':'exit';
}
