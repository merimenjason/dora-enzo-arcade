export type Point={x:number;z:number};
export type Cover={x:number;z:number;w:number;d:number};
export const BLOCKS:Cover[]=[{x:-2,z:0,w:3.5,d:2.6},{x:4,z:-2,w:2,d:4},{x:6,z:4,w:3,d:2}];
export const HIDES:Cover[]=[{x:-8,z:0,w:3,d:2.2},{x:0,z:4,w:3,d:2.2},{x:8,z:-6,w:2.6,d:2.3}];
export const PLATFORMS=[
 {id:'lower',x:-3,z:1,w:2.4,d:2,y:.65},
 {id:'middle',x:-3,z:-1.35,w:2.2,d:1.6,y:1.35},
 {id:'step',x:-.65,z:-1.5,w:2.4,d:1.6,y:2.05},
 {id:'upper',x:-.6,z:-3,w:5,d:1.8,y:2.75},
 {id:'right',x:2.8,z:-1.2,w:2,d:2,y:2.05},
 {id:'feeder',x:3,z:1.2,w:2,d:2,y:1.35},
];
export const TARGETS={stick:{x:-3,z:1,y:.65},clip:{x:-.6,z:-3,y:2.75},key:{x:3,z:1.2,y:1.35},latch:{x:0,z:3,y:0},badge:{x:-1,z:-6,y:0},exit:{x:10.5,z:-7,y:0}};
export const ROUTES:Point[][]=[[{x:-5,z:-4},{x:1.5,z:-4},{x:1.5,z:1.5},{x:-5,z:1.5}],[{x:8,z:-3},{x:9,z:6},{x:1,z:6},{x:1,z:1}]];
export type Guard={x:number;z:number;angle:number;target:number;distracted:number};
export const within=(p:Point,r:Cover,pad=0)=>Math.abs(p.x-r.x)<r.w/2+pad&&Math.abs(p.z-r.z)<r.d/2+pad;
export function occluded(a:Point,b:Point){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)*6);for(let i=1;i<n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n};if(BLOCKS.some(r=>within(p,r)))return true}return false}
export class EscapeGame{
 state:'ready'|'playing'|'paused'|'caught'|'won'='ready';phase:'cage'|'room'='cage';x=0;z=0;y=0;vy=0;time=0;stick=false;clip=false;key=false;badge=false;sneaking=false;moving=false;alert=0;noticed=false;decoys=3;decoy:Point|null=null;decoyTime=0;face={x:0,z:1};message='';messageTime=0;guards:Guard[]=ROUTES.map(r=>({x:r[0].x,z:r[0].z,angle:0,target:1,distracted:0}));
 get active(){return this.state==='playing'}
 get grounded(){return this.vy===0&&(Math.abs(this.y)<.01||(this.phase==='cage'&&PLATFORMS.some(p=>within(this,p,-.34)&&Math.abs(this.y-p.y)<.02)))}
 get hidden(){return this.y<.15&&this.phase==='room'&&this.sneaking&&HIDES.some(r=>within(this,r,-.35))}
 get objective(){return this.phase==='cage'?!this.stick?'Hop onto the lower shelf to search the blue tunnel.':!this.clip?'Jump up the staggered shelves to collect the latch clip.':!this.key?'Reach the pink hay feeder on the right-hand shelf.':'Bring the toy key to the wire door latch.':!this.badge?'Sneak to the desk and collect the exit card.':'Reach the green exit with both chinchillas.'}
 get target(){return this.phase==='cage'?!this.stick?TARGETS.stick:!this.clip?TARGETS.clip:!this.key?TARGETS.key:TARGETS.latch:!this.badge?TARGETS.badge:TARGETS.exit}
 get nearTarget(){return this.grounded&&Math.abs(this.y-this.target.y)<.25&&Math.hypot(this.x-this.target.x,this.z-this.target.z)<1.25}
 start(){if(this.state==='ready')this.state='playing'}
 pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing'}
 say(s:string){this.message=s;this.messageTime=4}
 interact(){if(!this.active||!this.nearTarget)return false;if(this.phase==='cage'){if(!this.stick){this.stick=true;this.say('Enzo braces the tunnel. Dora pulls out a chew stick.')}else if(!this.clip){this.clip=true;this.say('At the upper ledge, Dora retrieves a loose metal latch clip.')}else if(!this.key){this.key=true;this.say('Stick and clip lift the feeder catch. The toy key is free!')}else{this.phase='room';this.x=-9;this.z=-5;this.y=0;this.vy=0;this.alert=0;this.say('The cage opens. Stay low and find the exit card.')}}else if(!this.badge){this.badge=true;this.say('Exit card found. Reach the green door together.')}else{this.state='won';this.say('Enzo and Dora escaped together!')}return true}
 jump(){if(this.active&&this.grounded){this.vy=4.8;return true}return false}
 distract(){if(!this.active||this.phase!=='room'||this.decoys===0)return false;this.decoys--;this.decoy={x:Math.max(-11,Math.min(11,this.x+this.face.x*4)),z:Math.max(-8,Math.min(8,this.z+this.face.z*4))};this.decoyTime=3.5;for(const g of this.guards)if(Math.hypot(g.x-this.decoy.x,g.z-this.decoy.z)<9)g.distracted=3.5;this.say('A dust puff draws their attention. Move!');return true}
 sees(g:Guard){const dx=this.x-g.x,dz=this.z-g.z,d=Math.hypot(dx,dz);if(d>.8&&this.hidden)return false;if(d>5.6||occluded(g,this))return false;const dot=(dx*Math.sin(g.angle)+dz*Math.cos(g.angle))/(d||1);return d<.8||dot>Math.cos(Math.PI/5)}
 retry(){if(this.state!=='caught')return;this.state='playing';this.x=-9;this.z=-5;this.y=0;this.vy=0;this.alert=0;this.badge=false;this.decoys=3;this.decoy=null;this.decoyTime=0;this.guards=ROUTES.map(r=>({x:r[0].x,z:r[0].z,angle:0,target:1,distracted:0}));this.say('Back by the cage. Both friends are safe. Try another route.')}
 step(dt:number,input={x:0,z:0,sneak:false}){if(!this.active)return;dt=Math.min(dt,1/60);this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.sneaking=input.sneak;this.moving=Math.hypot(input.x,input.z)>.01;const n=Math.max(1,Math.hypot(input.x,input.z));if(this.moving)this.face={x:input.x/n,z:input.z/n};const speed=this.sneaking?1.65:3.4;const limit=this.phase==='cage'?{x:4.3,z:3.3}:{x:11.2,z:8};const nx=Math.max(-limit.x,Math.min(limit.x,this.x+input.x/n*speed*dt)),nz=Math.max(-limit.z,Math.min(limit.z,this.z+input.z/n*speed*dt));if(this.phase==='cage'||!BLOCKS.some(r=>within({x:nx,z:this.z},r,.55)))this.x=nx;if(this.phase==='cage'||!BLOCKS.some(r=>within({x:this.x,z:nz},r,.55)))this.z=nz;const previousY=this.y;this.vy-=11*dt;let nextY=this.y+this.vy*dt;if(this.phase==='cage'&&this.vy<=0){const landing=PLATFORMS.filter(p=>within(this,p,-.34)&&previousY>=p.y-.001&&nextY<=p.y).sort((a,b)=>b.y-a.y)[0];if(landing){nextY=landing.y;this.vy=0}}this.y=Math.max(0,nextY);if(this.y===0)this.vy=0;if(this.phase==='cage')return;
 this.decoyTime=Math.max(0,this.decoyTime-dt);if(this.decoyTime===0)this.decoy=null;
 for(const [i,g]of this.guards.entries()){g.distracted=Math.max(0,g.distracted-dt);const target=g.distracted>0&&this.decoy?this.decoy:ROUTES[i][g.target],dx=target.x-g.x,dz=target.z-g.z,d=Math.hypot(dx,dz);g.angle=Math.atan2(dx,dz);if(g.distracted===0){if(d<.12)g.target=(g.target+1)%ROUTES[i].length;else{const step=Math.min(d,1.25*dt);g.x+=dx/d*step;g.z+=dz/d*step}}}
 this.noticed=this.guards.some(g=>this.sees(g));this.alert=Math.max(0,Math.min(1,this.alert+(this.noticed?.62:-.28)*dt));if(this.alert>=1){this.state='caught';this.say('Spotted. The pair is returned to the cage.')}}
}
