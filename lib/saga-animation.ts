/** Continuous joint motion. The painted parts remain identical at every display frame. */
export type SagaMotion = {
  time:number; walking?:boolean; gait?:number; landing?:number; phase?:number; attack?:number; hurt?:number;
  cast?:number; prepare?:number; ward?:boolean; motion?:boolean;
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const p=clamp(v);return p*p*(3-2*p);};
const impulse=(remaining:number)=>{
  if(remaining<=0)return 0;
  const p=1-clamp(remaining);
  return p<.22?smooth(p/.22):1-smooth((p-.22)/.78);
};
/** Backward travel while planted, followed by a small, eased return arc. */
export function rigFoot(phase:number){
  const p=((phase/(Math.PI*2))%1+1)%1;
  if(p<.6)return {x:.075-.15*p/.6,y:0};
  const swing=(p-.6)/.4;
  return {x:-.075+.15*smooth(swing),y:-(Math.sin(swing*Math.PI)**2)*.025};
}
export function sagaRigPose(p:SagaMotion){
  const motion=!!p.motion, gait=motion?clamp(p.gait??(p.walking?1:0)):0;
  const near=rigFoot(p.phase??0),far=rigFoot((p.phase??0)+Math.PI),land=smooth(p.landing??(p.walking?0:1));
  const attack=motion?impulse(p.attack??0):0,hurt=motion?impulse(p.hurt??0):0;
  const pre=motion?Math.max(p.prepare??0,(p.attack??0)>0?1-smooth((1-(p.attack??0))/.18):0):0;
  const ward=motion && p.ward && (p.cast??0)>0?impulse(p.cast??0):0;
  return {mode:'rig' as const,state:!motion?'idle':hurt>0?'hurt':ward>0?'ward':attack>0?'attack':p.walking && gait>.05?'walk':'idle',
    near:{x:near.x*gait,y:near.y*gait*(1-land)},far:{x:far.x*gait,y:far.y*gait*(1-land)},gait,attack,
    arm:motion?-.12*pre+.20*attack-.06*ward+Math.sin(p.phase??0)*gait*.025:0,
    weapon:motion?-.45-.28*pre+.5*attack:-.45,
    tail:motion?Math.sin(p.time*1.5-.7)*.018+Math.sin((p.phase??0)-.6)*gait*.012:0,
    head:motion?Math.sin(p.time*1.8)*.002-hurt*.012:0,
    breath:motion?Math.sin(p.time*2.1)*.002:0,bodyLean:motion && p.walking?Math.sin((p.phase??0)*2)*.006*(1-land):0,recoil:-hurt*.012,
  };
}
