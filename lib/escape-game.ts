export type Point={x:number;z:number};
export type Cover={x:number;z:number;w:number;d:number};
export const BLOCKS:Cover[]=[{x:-2,z:0,w:3.5,d:2.6},{x:4,z:-2,w:2,d:4},{x:6,z:4,w:3,d:2}];
export const HIDES:Cover[]=[{x:-8,z:0,w:3,d:2.2},{x:0,z:4,w:3,d:2.2},{x:8,z:-6,w:2.6,d:2.3}];
export const PLATFORMS=[
 {id:'lower',x:-3,z:1,w:2.4,d:2,y:.65},
 {id:'middle',x:-3,z:-1.35,w:2.2,d:1.6,y:1.35},
 {id:'step',x:-.65,z:-1.5,w:2.4,d:1.6,y:2.05},
 {id:'upper',x:-.6,z:-3.1,w:5,d:1.4,y:2.75},
 {id:'right',x:2.8,z:-1.2,w:2,d:2,y:2.05},
 {id:'feeder',x:3,z:1.2,w:2,d:2,y:1.35},
];
export const PAIR_RADIUS=.7, PAIR_HEIGHT=1, JUMP_SPEED=5.9;
// Props stay out of the landing pads; collision volumes match their solid sides.
export const CAGE_PROPS=[
 {x:-3,z:2.7,w:2.5,d:1.5,bottom:.65,top:2.15},
 {x:3,z:2.3,w:1.7,d:.7,bottom:1.35,top:2.58},
 {x:4.3,z:3.5,w:.8,d:.8,bottom:.45,top:3.14},
 {x:-.7,z:.3,w:1.5,d:1.4,bottom:0,top:.9},
 {x:1.7,z:-.1,w:2.4,d:1.6,bottom:0,top:.52},
];
export const TARGETS={stick:{x:-3,z:1,y:.65},clip:{x:-.6,z:-3,y:2.75},key:{x:3,z:1.2,y:1.35},latch:{x:0,z:3,y:0},badge:{x:-1,z:-6,y:0},intel:{x:8,z:-6,y:0},exit:{x:10.5,z:-7,y:0}};
export const VISION_RANGE=6.2, VISION_HALF_ANGLE=Math.PI/4.5, DECOY_DURATION=2.6, MAX_DECOYS=2, SEARCH_TIME=2;
export const ROUTES:Point[][]=[[{x:-5,z:-4},{x:1.5,z:-4},{x:1.5,z:1.5},{x:-5,z:1.5}],[{x:8,z:-3},{x:9,z:6},{x:1,z:6},{x:1,z:1}],[{x:8,z:-7},{x:-4,z:-7},{x:-4,z:-5},{x:8,z:-5}]];
export type Guard={x:number;z:number;angle:number;target:number;distracted:number;stunned?:number;investigate?:number;lastKnown?:Point};
export const within=(p:Point,r:Cover,pad=0)=>Math.abs(p.x-r.x)<r.w/2+pad&&Math.abs(p.z-r.z)<r.d/2+pad;
export function occluded(a:Point,b:Point){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)*6);for(let i=1;i<n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n};if(BLOCKS.some(r=>within(p,r)))return true}return false}
export class EscapeGame{
 intel=false;hacking=false;hackProgress=0;boxed=false;stunCharges=2;stunFlash=0;stunPoint:Point|null=null;
 leader:'Enzo'|'Dora'='Enzo';tunnelRolled=false;actionTime=0;actionKind:''|'roll'|'squeeze'|'bath'='';hayHidden=false;coyote=0;jumpBuffer=0;
 state:'ready'|'playing'|'paused'|'caught'|'won'='ready';phase:'cage'|'room'='cage';x=0;z=2.6;y=0;vy=0;time=0;stick=false;clip=false;key=false;badge=false;searching=false;searchProgress=0;sneaking=false;moving=false;alert=0;noticed=false;decoys=MAX_DECOYS;decoy:Point|null=null;decoyTime=0;face={x:0,z:1};message='';messageTime=0;guards:Guard[]=ROUTES.map(r=>({x:r[0].x,z:r[0].z,angle:0,target:1,distracted:0}));
 get active(){return this.state==='playing'}
 get solids(){return this.phase==='cage'?[...PLATFORMS.map(p=>({...p,bottom:p.y-.13,top:p.y})),...CAGE_PROPS.map((p,i)=>i===0&&this.tunnelRolled?{...p,z:p.z+.25}:p)]:BLOCKS.map(p=>({...p,bottom:0,top:2}))}
 get grounded(){return this.vy===0&&(Math.abs(this.y)<.01||this.solids.some(p=>within(this,p,PAIR_RADIUS)&&Math.abs(this.y-p.top)<.02))}
 surfaceBelow(x=this.x,z=this.z,y=this.y){return Math.max(0,...this.solids.filter(p=>within({x,z},p)&&p.top<=y+.03).map(p=>p.top))}
 canReach(p:typeof PLATFORMS[number]){const rise=p.y-this.y,disc=JUMP_SPEED*JUMP_SPEED-22*rise;if(disc<0)return false;return Math.hypot(p.x-this.x,p.z-this.z)<=3.4*(JUMP_SPEED+Math.sqrt(disc))/11}
 switchLeader(){if(!this.active||this.actionTime>0||this.hayHidden)return false;this.leader=this.leader==='Enzo'?'Dora':'Enzo';this.say(this.leader==='Enzo'?'Enzo leads. Strong paws roll and brace heavy objects.':'Dora leads. She can squeeze into narrow spaces.');return true}
 get nearHay(){return this.phase==='cage'&&this.grounded&&Math.abs(this.y-1.35)<.2&&Math.hypot(this.x-3,this.z-1.2)<1.1}
 hideInHay(){if(!this.active||this.actionTime>0||(!this.hayHidden&&!this.nearHay))return false;this.hayHidden=!this.hayHidden;this.say(this.hayHidden?'Both friends nestle into the hay. Press H to come out.':'Back together on the shelf.');return true}
 dustBath(){if(!this.active||!this.grounded||this.actionTime>0||this.hayHidden)return false;this.actionKind='bath';this.actionTime=1.1;this.say('A quick dust roll. Even an escape needs a little fluff.');return true}
 get hidden(){return this.hayHidden||(this.phase==='room'&&this.boxed&&!this.moving&&this.grounded)|| this.y<.15&&this.phase==='room'&&this.sneaking&&HIDES.some(r=>within(this,r,-.35))}
 get security(){return this.noticed?'ALERT':this.guards.some(g=>(g.investigate??0)>0)?'SEARCHING':'PATROL'}
 toggleBox(){if(!this.active||this.phase!=='room'||!this.grounded||this.actionTime>0)return false;this.boxed=!this.boxed;this.say(this.boxed?'Cardboard camouflage. Stay still to blend in; guards spot moving boxes.':'Box stowed. Move quietly.');return true}
 stun(){if(!this.active||this.phase!=='room'||this.stunCharges===0||this.boxed)return false;const target=this.guards.filter(g=>(g.stunned??0)===0&&!occluded(this,g)&&Math.hypot(g.x-this.x,g.z-this.z)<4).sort((a,b)=>Math.hypot(a.x-this.x,a.z-this.z)-Math.hypot(b.x-this.x,b.z-this.z))[0];if(!target){this.say('Get within four steps of a guard with a clear line of sight.');return false}this.stunCharges--;target.stunned=4;target.investigate=0;target.lastKnown=undefined;this.stunFlash=.6;this.stunPoint={x:target.x,z:target.z};this.say('Pocket dust! A sneezing fit disables the guard for four seconds.');return true}
 get objective(){return this.phase==='cage'?!this.stick?(this.tunnelRolled?'Pick up the chew stick beside the rolled tunnel.':'Lead with Enzo: roll the blue tunnel on the lower shelf.'):!this.clip?'Lead with Dora: squeeze into the upper ledge gap for the clip.':!this.key?'Lead with Dora: squeeze into the pink hay feeder for the key.':'Bring the toy key to the wire door latch.':!this.badge?'Sneak to the desk and collect the exit card.':!this.intel?'Reach the covered terminal. Download the escape intel.':'Intel secured. Reach the green exit with both chinchillas.'}
 get target(){return this.phase==='cage'?!this.stick?TARGETS.stick:!this.clip?TARGETS.clip:!this.key?TARGETS.key:TARGETS.latch:!this.badge?TARGETS.badge:!this.intel?TARGETS.intel:TARGETS.exit}
 get nearTarget(){return this.grounded&&Math.abs(this.y-this.target.y)<.25&&Math.hypot(this.x-this.target.x,this.z-this.target.z)<1.25}
 start(){if(this.state==='ready')this.state='playing'}
 pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing'}
 say(s:string){this.message=s;this.messageTime=4}
 interact(){if(!this.active||!this.nearTarget||this.actionTime>0||this.hayHidden)return false;if(this.phase==='cage'){if(!this.stick){if(!this.tunnelRolled){if(this.leader!=='Enzo'){this.say('This tunnel needs Enzo’s strong paws. Press R to switch.');return false}this.tunnelRolled=true;this.actionKind='roll';this.actionTime=.9;this.say('Enzo rolls the tunnel. A chew stick tumbles loose!')}else{this.stick=true;this.say('Chew stick collected. Dora can reach the narrow upper gap.')}}else if(!this.clip){if(this.leader!=='Dora'){this.say('Only Dora can squeeze into this gap. Press R to switch.');return false}this.actionKind='squeeze';this.actionTime=.9;this.clip=true;this.say('At the upper ledge, Dora retrieves a loose metal latch clip.')}else if(!this.key){if(this.leader!=='Dora'){this.say('Dora can slip between the feeder bars. Press R to switch.');return false}this.actionKind='squeeze';this.actionTime=.9;this.key=true;this.say('Stick and clip lift the feeder catch. The toy key is free!')}else{this.phase='room';this.x=-9;this.z=-5;this.y=0;this.vy=0;this.alert=0;this.say('The cage opens. Stay low and find the exit card.')}}else if(!this.badge){this.searching=true;this.say('Searching the desk… stay still for two seconds.')}else if(!this.intel){this.hacking=true;this.say('Radio link open. Stay still for three seconds to download the intel.')}else{this.state='won';this.say('Enzo and Dora escaped together!')}return true}
 jump(){if(!this.active||this.actionTime>0||this.hayHidden||this.boxed)return false;if(this.grounded||(this.coyote>0&&this.vy<=0)){this.vy=JUMP_SPEED;this.coyote=0;this.jumpBuffer=0;return true}this.jumpBuffer=.12;return false}
 distract(){if(!this.active||this.phase!=='room'||this.decoys===0)return false;this.decoys--;this.decoy={x:Math.max(-11,Math.min(11,this.x+this.face.x*4)),z:Math.max(-8,Math.min(8,this.z+this.face.z*4))};this.decoyTime=DECOY_DURATION;for(const g of this.guards)if(Math.hypot(g.x-this.decoy.x,g.z-this.decoy.z)<9)g.distracted=DECOY_DURATION;this.say('A dust puff draws their attention. Move!');return true}
 sees(g:Guard){if((g.stunned??0)>0)return false;const dx=this.x-g.x,dz=this.z-g.z,d=Math.hypot(dx,dz);if(d>.8&&this.hidden)return false;if(d>VISION_RANGE||occluded(g,this))return false;const dot=(dx*Math.sin(g.angle)+dz*Math.cos(g.angle))/(d||1);return d<.8||dot>Math.cos(VISION_HALF_ANGLE)}
 retry(){if(this.state!=='caught')return;this.state='playing';this.x=-9;this.z=-5;this.y=0;this.vy=0;this.alert=0;this.badge=false;this.intel=false;this.hacking=false;this.hackProgress=0;this.boxed=false;this.stunCharges=2;this.stunFlash=0;this.stunPoint=null;this.hayHidden=false;this.actionTime=0;this.coyote=0;this.jumpBuffer=0;this.searching=false;this.searchProgress=0;this.decoys=MAX_DECOYS;this.decoy=null;this.decoyTime=0;this.guards=ROUTES.map(r=>({x:r[0].x,z:r[0].z,angle:0,target:1,distracted:0}));this.say('Back by the cage. Both friends are safe. Try another route.')}
 step(dt:number,input={x:0,z:0,sneak:false}){if(!this.active)return;dt=Math.min(dt,1/60);this.time+=dt;this.coyote=this.grounded?.1:Math.max(0,this.coyote-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.actionTime=Math.max(0,this.actionTime-dt);if(this.actionTime===0)this.actionKind='';if(this.hayHidden||this.actionTime>0)input={x:0,z:0,sneak:this.hayHidden};this.messageTime=Math.max(0,this.messageTime-dt);this.sneaking=input.sneak;this.moving=Math.hypot(input.x,input.z)>.01;const n=Math.max(1,Math.hypot(input.x,input.z));if(this.moving)this.face={x:input.x/n,z:input.z/n};const speed=this.boxed?1.1:this.sneaking?1.65:3.4;const limit=this.phase==='cage'?{x:4.2,z:3.15}:{x:11.05,z:7.85};
 const solids=this.solids;
 const blocked=(x:number,z:number)=>solids.some(p=>this.y<p.top-.01&&this.y+PAIR_HEIGHT>p.bottom+.01&&within({x,z},p,PAIR_RADIUS));
 const nx=Math.max(-limit.x,Math.min(limit.x,this.x+input.x/n*speed*dt));
 if(!blocked(nx,this.z))this.x=nx;
 const nz=Math.max(-limit.z,Math.min(limit.z,this.z+input.z/n*speed*dt));
 if(!blocked(this.x,nz))this.z=nz;
 const previousY=this.y;this.vy-=11*dt;let nextY=this.y+this.vy*dt;
 if(this.vy>0){const ceiling=solids.filter(p=>within(this,p,PAIR_RADIUS)&&previousY+PAIR_HEIGHT<=p.bottom+.001&&nextY+PAIR_HEIGHT>=p.bottom).sort((a,b)=>a.bottom-b.bottom)[0];if(ceiling){nextY=ceiling.bottom-PAIR_HEIGHT;this.vy=0}}
 if(this.vy<=0){const landing=solids.filter(p=>within(this,p,PAIR_RADIUS)&&previousY>=p.top-.001&&nextY<=p.top).sort((a,b)=>b.top-a.top)[0];if(landing){nextY=landing.top;this.vy=0}}
 this.y=Math.max(0,nextY);if(this.y===0)this.vy=0;if(this.grounded&&this.jumpBuffer>0)this.jump();if(this.phase==='cage')return;
 this.decoyTime=Math.max(0,this.decoyTime-dt);if(this.decoyTime===0)this.decoy=null;
 this.stunFlash=Math.max(0,this.stunFlash-dt);
 for(const [i,g]of this.guards.entries()){
  g.stunned=Math.max(0,(g.stunned??0)-dt);if(g.stunned>0)continue;
  g.distracted=Math.max(0,g.distracted-dt);g.investigate=Math.max(0,(g.investigate??0)-dt);
  if(g.distracted===0&&this.sees(g)){g.lastKnown={x:this.x,z:this.z};g.investigate=3}
  const investigating=g.distracted===0&&(g.investigate??0)>0&&g.lastKnown;
  const target=g.distracted>0&&this.decoy?this.decoy:investigating?g.lastKnown!:ROUTES[i][g.target];const dx=target.x-g.x,dz=target.z-g.z,d=Math.hypot(dx,dz);
  if(d>.05)g.angle=Math.atan2(dx,dz);
  if(g.distracted===0){if(d<.12){if(!investigating)g.target=(g.target+1)%ROUTES[i].length}else{const step=Math.min(d,(investigating?1.35:this.badge?1.9:1.65)*dt),nx=g.x+dx/d*step,nz=g.z+dz/d*step;if(!BLOCKS.some(b=>within({x:nx,z:g.z},b,.3)))g.x=nx;if(!BLOCKS.some(b=>within({x:g.x,z:nz},b,.3)))g.z=nz}}
 }
 if(this.hacking){if(this.moving||!this.nearTarget){this.hacking=false;this.hackProgress=0;this.say('Signal lost. Return to the terminal and press E.')}else{this.hackProgress+=dt;if(this.hackProgress>=3){this.intel=true;this.hacking=false;this.say('Intel downloaded. Extraction is ready at the green door.')}}}
 if(this.searching){if(this.moving||!this.nearTarget){this.searching=false;this.searchProgress=0;this.say('Search interrupted. Return to the desk and press E.')}else{this.searchProgress+=dt;if(this.searchProgress>=SEARCH_TIME){this.badge=true;this.searching=false;this.say('Access card secured. Patrols are speeding up—download intel at the covered terminal.')}}}
 this.noticed=this.guards.some(g=>this.sees(g));this.alert=Math.max(0,Math.min(1,this.alert+(this.noticed?.85:-.18)*dt));if(this.alert>=1){this.state='caught';this.say('Spotted. The pair is returned to the cage.')}}
}
