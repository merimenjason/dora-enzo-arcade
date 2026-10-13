import {sagaRigPose,type SagaMotion} from './saga-animation';
import {sagaRigPart,sagaRigReady,sagaRigVector,sagaRigLeg} from './saga-paint';
type C=CanvasRenderingContext2D;
/** A fixed set of painted layers; only the joints move, never the character design. */
export function drawSagaHeroRig(c:C,id:'dora'|'enzo',x:number,feet:number,size:number,motion:SagaMotion){
 const key='rig-'+id;if(!sagaRigReady(key))return false;
 const p=sagaRigPose(motion);
 const part=(index:number,xx:number,yy:number,w:number,h:number,angle=0,px=.5,py=.5)=>sagaRigPart(c,key,index,xx,yy,w,h,angle,px,py);
 c.save();c.translate(x+p.recoil*size,feet);c.scale(size,size);
 part(2,-.19,-.12,.53,.69,p.tail,.85,.9);
 // The foot itself follows a contact-and-return path; the upper root overlaps the torso.
 sagaRigLeg(c,key,3,-.13,0,.25,.17,p.far.x,p.far.y);
 part(5,.02,-.38,.19,.20,-p.arm*.5,.2,.1);
 sagaRigLeg(c,key,4,.15,0,.27,.18,p.near.x,p.near.y);
 part(1,-.02,-.04,.67,.52,p.bodyLean,.5,.96);
 part(0,.16,-.38+p.breath,.66,.65,p.head,.52,.96);
 const shoulder={x:.16,y:-.38},angle=p.arm;
 part(6,shoulder.x,shoulder.y,.25,.22,angle,.15,.1);
 const joint=sagaRigVector(key,6,.25,.22,.15,.1,id==='dora'?.80:.86,id==='dora'?.77:.72);
 const grip={x:shoulder.x+Math.cos(angle)*joint.x-Math.sin(angle)*joint.y,y:shoulder.y+Math.sin(angle)*joint.x+Math.cos(angle)*joint.y};
 if(id==='dora')part(7,grip.x,grip.y,.41,.115,p.weapon,.12,.5);
 else part(7,grip.x+p.attack*.04,grip.y-.03,.29,.35,angle*.35,.40,.55);
 c.restore();return true;
}
export function drawSagaBeetleRig(c:C,x:number,feet:number,size:number,motion:SagaMotion){
 const key='rig-beetle';if(!sagaRigReady(key))return false;
 const p=sagaRigPose(motion),part=(i:number,xx:number,yy:number,w:number,h:number,a=0,px=.5,py=.5)=>sagaRigPart(c,key,i,xx,yy,w,h,a,px,py);
 c.save();c.translate(x+p.recoil*size,feet);c.scale(size*1.15,size*1.15);
 const legs=[{x:-.40,i:1,w:.35,h:.32,px:.12},{x:.03,i:2,w:.23,h:.30,px:.5},{x:.43,i:3,w:.35,h:.32,px:.88}];
 for(const far of [true,false]){
  c.globalAlpha=far?.70:1;
  for(let i=0;i<3;i++){
   const leg=legs[i],foot=((i+(far?1:0))%2===0)?p.near:p.far;
   part(leg.i,leg.x-foot.x*1.5+(far?.04:0),foot.y*(far?.7:1)-(far?.045:0),leg.w*(far?.9:1),leg.h,0,leg.px,.96);
  }
 }
 c.globalAlpha=1;
 part(4,-.19,-.59,.30,.29,p.tail*.7,.88,.96);
 part(0,.02,-.10,1.08,.65,0,.5,.96);
 part(5,-.39,-.51,.32,.30,-p.tail,.88,.96);
 part(6,-.29,-.16,.16,.18,-p.attack*.12,.8,.1);
 part(7,-.39,-.18,.19,.20,p.attack*.12,.8,.1);
 c.restore();return true;
}
