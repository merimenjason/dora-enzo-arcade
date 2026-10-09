/** Deterministic fixed-step pinball. All coordinates also drive the painted scene. */
export const WIDTH=1000,HEIGHT=1000,STEP=1/240,RADIUS=10,GRAVITY=900,MAX_SPEED=1800;
export type Point={x:number;y:number};
export type Mode='arcade'|'practice';
export type State='ready'|'play'|'over';
export type Input={left:boolean;right:boolean;launch:boolean};
export type Rail='left'|'right'|'launch';
export type Ball=Point&{id:number;vx:number;vy:number;moon:boolean;launcher:boolean;rail:Rail|null;progress:number;cool:number};
export type Ev={t:'launch'|'bumper'|'sling'|'target'|'rescue'|'ramp'|'dust'|'lock'|'multiball'|'save'|'drain'|'nudge'|'tilt'|'over';x:number;y:number;n?:number};
type Segment=[number,number,number,number];
const chain=(ps:number[][]):Segment[]=>ps.slice(1).map((p,i)=>[ps[i][0],ps[i][1],p[0],p[1]]);
/** The table is painted symmetric about x = 500, so each half of the felt is traced once and mirrored. */
const both=(ps:number[][])=>[...chain(ps),...chain(ps.map(([x,y])=>[WIDTH-x,y]))];
// Every collider below is traced from public/art/pinball/table.png (scaled to 1000 × 1000): the berry only touches what is painted.
export const BUMPERS=[{x:500,y:257,r:48},{x:420,y:357,r:48},{x:581,y:349,r:48}];
/** Rescue studs along the stone wall under the burrow, and the burrow windows each one lights. */
export const TARGETS=[{x:340,y:249,r:12},{x:364,y:234,r:12},{x:388,y:219,r:12}];
export const BURROWS=[{x:199,y:140},{x:242,y:140},{x:285,y:140}];
/** Paw flippers: `base` and `tip` are the half-widths at the pivot and at the far end. */
export const FLIPPERS=[{x:360,y:816,length:114,rest:.5,up:-.42,base:17,tip:17},{x:640,y:816,length:114,rest:Math.PI-.5,up:Math.PI+.42,base:17,tip:17}];
export const WALL_R=5,LAUNCH={x:927,y:634};
/** The felt's edge: under the bridge, the stone wall, the fences, the ramp doorsteps, the pockets, and the stone step down to each flipper. */
export const WALLS:Segment[]=[
 [440,146,560,146],
 ...both([[440,146],[438,196],[402,202],[318,254],[314,292],[300,340],[330,390],[372,432],[362,440],[362,478],[334,496],[300,484]]),
 // The two pockets are the one place the painting is not symmetric: the right one is shorter.
 ...chain([[300,484],[172,482],[166,502],[225,538],[310,618],[313,632]]),...chain([[700,484],[806,484],[812,504],[775,538],[690,618],[687,632]]),
 ...both([[350,722],[372,750],[376,800]]),
 ...both([[340,836],[350,894],[478,930],[478,1000]]),
];
/** The face of each cushion island that kicks; a berry rolling down it is only guided. */
export const SLINGS:Segment[]=both([[313,632],[350,722]]);
/** The launcher lane: its two brass rails and the plunger's top. Only a berry still in the launcher touches these. */
export const LANE:Segment[]=[[903,330,903,650],[951,330,951,650],[903,650,951,650]];
/** Where a berry moving up the felt is lifted onto a wooden ramp: the brass doorsteps beside each pocket. */
export const GATES={left:{x:270,y:500,r:24},right:{x:730,y:500,r:24}};
/** Raised wooden paths, followed point to point: the berry is above the felt and touches nothing until it comes off the end. */
const path=(ps:number[][]):Point[]=>ps.map(([x,y])=>({x,y}));
export const RAMPS:Record<Rail,Point[]>={
 left:path([[270,486],[262,438],[268,395],[281,345],[262,292],[215,252],[162,216],[137,172],[150,142],[205,158],[290,168],[350,125],[395,108],[450,100],[500,98],[560,106],[620,126],[648,158],[692,196],[742,224],[790,246],[835,238],[866,282],[888,330],[872,400],[858,470],[855,545],[855,700],[820,750],[760,772],[705,798],[655,778],[612,772]]),
 right:path([[730,486],[748,446],[776,420],[798,390],[815,335],[802,280],[790,246],[822,238],[812,212],[782,186],[765,170]]),
 launch:path([[927,362],[905,335],[888,318],[866,282],[835,238],[790,246],[742,224],[692,196],[648,158],[604,122],[552,105],[506,99],[500,170]]),
};
/** Seconds a berry spends on each ramp. */
const RIDE:Record<Rail,number>={left:2.7,right:1.1,launch:1.3};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function closest(p:Point,a:Point,b:Point){const d=(b.x-a.x)**2+(b.y-a.y)**2,t=d?clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d,0,1):0;return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),t};}
export function railPoint(rail:Rail,progress:number){const ps=RAMPS[rail],lengths=ps.slice(1).map((p,i)=>Math.hypot(p.x-ps[i].x,p.y-ps[i].y)),total=lengths.reduce((a,b)=>a+b,0);let d=clamp(progress,0,1)*total;for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const t=d/lengths[i];return {x:lerp(ps[i].x,ps[i+1].x,t),y:lerp(ps[i].y,ps[i+1].y,t)};}d-=lengths[i];}return ps.at(-1)!;}
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
const point=(p:Point)=>finite(p?.x)&&finite(p?.y)&&p.x>=0&&p.x<=WIDTH&&p.y>=0&&p.y<=HEIGHT+80;
export class Game{
 get ended(){return this.state==='over';}
 mode:Mode;state:State='ready';paused=false;time=0;score=0;ballNo=1;balls:Ball[]=[];nextId=1;seed:number;rng:number;
 angles=FLIPPERS.map(f=>f.rest);omega=[0,0];charge=0;charging=false;last={left:false,right:false,launch:false};
 lamps=[false,false,false];rescues=0;resetLamps=0;locks=0;multiball=false;ramps=0;saveUntil=0;tilt=0;tiltUntil=0;nudgeUntil=0;combo=1;comboUntil=0;
 hits=0;maxBalls=1;events:Ev[]=[];note='Hold Space or Launch, then release. Arrows control the paw flippers.';noteUntil=5;
 private accumulator=0;
 constructor(mode:Mode='arcade',seed=1){this.mode=mode;this.seed=seed>>>0||1;this.rng=this.seed;}
 private random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 private emit(t:Ev['t'],x=500,y=500,n?:number){this.events.push({t,x,y,n});}
 private say(s:string){this.note=s;this.noteUntil=this.time+4;}
 private add(x:number,y:number,vx:number,vy:number,moon=false,launcher=false){const b:Ball={id:this.nextId++,x,y,vx,vy,moon,launcher,rail:null,progress:0,cool:0};this.balls.push(b);this.maxBalls=Math.max(this.maxBalls,this.balls.length);return b;}
 private award(n:number,_x:number,_y:number){const amount=Math.round(n*(this.multiball?2:1));this.score+=amount;return amount;}
 release(){this.last={left:false,right:false,launch:false};this.charging=false;this.charge=0;}
 pause(on:boolean){if(this.state==='over')return;this.paused=on;this.release();}
 launch(power:number){if(this.state!=='ready'||this.paused||!finite(power))return false;this.state='play';this.charging=false;this.charge=0;this.saveUntil=this.time+7;const b=this.add(LAUNCH.x,LAUNCH.y,0,-(560+clamp(power,.05,1)*840),false,true);this.emit('launch',b.x,b.y);this.say('Aim with the flipper tips. The right ramp locks moonberries.');return true;}
 nudge(){if(this.paused||this.state!=='play'||this.time<this.nudgeUntil||this.time<this.tiltUntil)return false;this.nudgeUntil=this.time+.45;this.tilt=Math.min(1.5,this.tilt+.38);for(const b of this.balls)if(!b.rail&&!b.launcher){b.vy-=110;b.vx+=(b.x<500?1:-1)*80;}this.emit('nudge');if(this.tilt>=1){this.tiltUntil=this.time+3;this.emit('tilt');this.say('Tilt! The paws rest for three seconds.');}return true;}
 /** Pushes the berry out along (nx, ny) and bounces it off a surface moving at (vx, vy). Returns how hard it hit. */
 private bounce(b:Ball,nx:number,ny:number,restitution:number,vx=0,vy=0){const vn=(b.vx-vx)*nx+(b.vy-vy)*ny;if(vn>=0)return 0;const e=vn>-45?0:restitution;b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;return -vn;}
 /** A round obstacle. Returns how hard the berry hit it, or -1 when they do not touch. */
 private circle(b:Ball,p:Point,r:number,restitution:number,kick=0){let dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);if(d>=r+RADIUS)return -1;if(d<.001){dx=0;dy=-1;d=1;}const nx=dx/d,ny=dy/d;b.x=p.x+nx*(r+RADIUS+.05);b.y=p.y+ny*(r+RADIUS+.05);const hit=this.bounce(b,nx,ny,restitution);if(kick){const out=b.vx*nx+b.vy*ny;if(out<kick){b.vx+=(kick-out)*nx;b.vy+=(kick-out)*ny;}}return hit;}
 /** A rounded bar from `a` to `p`, `r0` thick at `a` and `r1` at `p`, moving at (vx, vy) where the berry meets it. Returns how hard the berry hit, or -1. */
 private capsule(b:Ball,a:Point,p:Point,r0:number,r1:number,restitution:number,vx=0,vy=0){const q=closest(b,a,p),r=lerp(r0,r1,q.t),dx=b.x-q.x,dy=b.y-q.y,d=Math.hypot(dx,dy);if(d>=r+RADIUS)return -1;let nx=dx/(d||1),ny=dy/(d||1);if(d<.001){const len=Math.hypot(p.x-a.x,p.y-a.y)||1;nx=-(p.y-a.y)/len;ny=(p.x-a.x)/len;}b.x=q.x+nx*(r+RADIUS+.05);b.y=q.y+ny*(r+RADIUS+.05);return this.bounce(b,nx,ny,restitution,vx,vy);}
 private enter(b:Ball,rail:Rail){b.rail=rail;b.progress=0;const p=railPoint(rail,0);b.x=p.x;b.y=p.y;b.vx=0;b.vy=0;b.launcher=false;b.cool=.4;if(rail==='launch')return;const n=this.award(500,b.x,b.y);this.emit('ramp',b.x,b.y,n);}
 /** A berry coming off the end of a ramp. */
 private leave(b:Ball,rail:Rail){b.rail=null;b.progress=0;const end=RAMPS[rail].at(-1)!;b.x=end.x;b.y=end.y;
  if(rail==='launch'){b.vx=(this.random()-.5)*90;b.vy=160;b.cool=.1;return;}
  this.ramps++;if(rail==='right'){this.emit('dust',end.x,end.y);this.lock(b);return;}
  b.vx=-50;b.vy=130;b.cool=.3;const n=this.award(2500,b.x,b.y);this.emit('ramp',b.x,b.y,n);this.say('Bridge run! Try the right ramp for a moonberry lock.');}
 private lock(b:Ball){this.balls=this.balls.filter(p=>p!==b);if(this.multiball){this.add(612,772,-50,130,true);return;}this.locks++;this.emit('lock',765,170,this.locks);this.say(`Moonberry ${this.locks} / 3 locked.`);if(this.locks>=3){this.locks=0;this.multiball=true;this.saveUntil=this.time+12;this.award(5000,500,255);for(const [x,y,vx,vy] of [[400,520,90,-420],[500,180,-60,140],[600,520,-90,-420]])this.add(x,y,vx+(this.random()-.5)*70,vy,true);this.emit('multiball',500,255);this.say('Moonberry multiball! Double points and twelve seconds of ball save.');}else if(!this.balls.length){this.state='ready';this.release();}}
 private drain(b:Ball){this.balls=this.balls.filter(p=>p!==b);if(b.launcher){if(!this.balls.length)this.state='ready';this.say('A firmer launch will reach the top of the lane.');return;}if(this.time<this.saveUntil){this.add(500,905,(this.random()-.5)*60,-1000,this.multiball);this.emit('save',500,880);this.say('Ball saved! Keep the berry bouncing.');return;}this.emit('drain',b.x,b.y);if(this.balls.length){if(this.balls.length===1){this.multiball=false;this.balls[0].moon=false;}return;}this.multiball=false;this.ballNo++;this.release();if(this.mode==='arcade'&&this.ballNo>3){this.state='over';this.emit('over');this.say('A lovely little run. Try to beat your best!');}else{this.state='ready';this.say('Hold Launch for the next berry.');}}
 private step(input:Input){const dt=STEP;this.time+=dt;this.tilt=Math.max(0,this.tilt-dt*.12);if(this.comboUntil<this.time)this.combo=1;
  if(this.resetLamps&&this.time>=this.resetLamps){this.lamps=[false,false,false];this.resetLamps=0;}
  const tilt=this.time<this.tiltUntil;
  // A flipper swings up faster than it falls back. While it swings it carries the berry, so a shot is as fast as the part of the paw it leaves from: gentle near the pivot, hard off the tip.
  for(let i=0;i<2;i++){const f=FLIPPERS[i],up=!tilt&&(i?input.right:input.left),goal=up?f.up:f.rest,old=this.angles[i],rate=(up?15:11)*dt;this.angles[i]+=clamp(goal-old,-rate,rate);this.omega[i]=(this.angles[i]-old)/dt;}
  if(this.state==='ready'){if(input.launch){this.charging=true;this.charge=Math.min(1,this.charge+dt*.9);}else if(this.charging)this.launch(this.charge);return;}
  // oxlint-disable-next-line unicorn/no-useless-spread -- Locking or draining replaces the live ball array during this pass.
  for(const b of [...this.balls]){b.cool=Math.max(0,b.cool-dt);
   if(b.rail){b.progress=Math.min(1,b.progress+dt/RIDE[b.rail]);const p=railPoint(b.rail,b.progress);b.x=p.x;b.y=p.y;if(b.progress>=1)this.leave(b,b.rail);continue;}
   b.vy+=GRAVITY*dt;b.vx*=Math.exp(-.08*dt);b.vy*=Math.exp(-.08*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;
   // In the launcher the berry only meets the lane: over the top it takes the ramp to the bridge, and a weak shot settles back on the plunger.
   if(b.launcher){for(const [x,y,a,c] of LANE)this.capsule(b,{x,y},{x:a,y:c},WALL_R,WALL_R,.3);if(b.y<=RAMPS.launch[0].y)this.enter(b,'launch');else if(b.vy>=0&&b.y>=LAUNCH.y)this.drain(b);continue;}
   if(b.cool===0&&b.vy<-60){if(Math.hypot(b.x-GATES.left.x,b.y-GATES.left.y)<GATES.left.r){this.enter(b,'left');continue;}if(Math.hypot(b.x-GATES.right.x,b.y-GATES.right.y)<GATES.right.r){this.enter(b,'right');continue;}}
   for(const p of BUMPERS)if(this.circle(b,p,p.r,.5,b.cool===0?520:0)>=0&&b.cool===0){b.cool=.07;this.hits++;this.combo=Math.min(5,this.combo+Number(this.time<this.comboUntil));this.comboUntil=this.time+2;const n=this.award(500*this.combo,p.x,p.y);this.emit('bumper',p.x,p.y,n);}
   TARGETS.forEach((p,i)=>{if(this.circle(b,p,p.r,.55)<0||b.cool>0)return;b.cool=.06;if(!this.lamps[i]&&!this.resetLamps){this.lamps[i]=true;const n=this.award(1000,p.x,p.y);this.emit('target',p.x,p.y,n);if(this.lamps.every(Boolean)){this.rescues++;this.resetLamps=this.time+3;const reward=this.award(10000,242,140);this.emit('rescue',242,140,reward);this.say('Burrow rescued! Three new targets will light shortly.');}}});
   for(let i=0;i<2;i++){const f=FLIPPERS[i],angle=this.angles[i],end={x:f.x+Math.cos(angle)*f.length,y:f.y+Math.sin(angle)*f.length},q=closest(b,f,end),omega=this.omega[i];this.capsule(b,f,end,f.base,f.tip,omega?.1:.3,-(q.y-f.y)*omega,(q.x-f.x)*omega);}
   // A cushion kicks a berry that strikes it, straight out from its face; one rolling down it is left alone.
   for(let i=0;i<SLINGS.length;i++){const [x,y,a,c]=SLINGS[i],hit=this.capsule(b,{x,y},{x:a,y:c},WALL_R,WALL_R,.4);if(hit>140&&b.cool===0){const len=Math.hypot(a-x,c-y),side=i?-1:1;b.vx+=side*(c-y)/len*430;b.vy-=Math.abs(a-x)/len*430;b.cool=.16;const n=this.award(250,b.x,b.y);this.emit('sling',b.x,b.y,n);}}
   for(const [x,y,a,c] of WALLS)this.capsule(b,{x,y},{x:a,y:c},WALL_R,WALL_R,.42);
   const speed=Math.hypot(b.vx,b.vy);if(speed>MAX_SPEED){b.vx*=MAX_SPEED/speed;b.vy*=MAX_SPEED/speed;}
   // Down the slot between the flippers, or (never, with the walls closed) off the table.
   if(b.y>985||b.y<0||b.x<0||b.x>WIDTH)this.drain(b);
  }
  for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++){const a=this.balls[i],b=this.balls[j];if(a.rail||b.rail)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=RADIUS*2)continue;const nx=d?dx/d:1,ny=d?dy/d:0,over=(RADIUS*2-d+.05)/2;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){const impulse=-v*.94;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}}
  for(const b of this.balls){const speed=Math.hypot(b.vx,b.vy);if(speed>MAX_SPEED){b.vx*=MAX_SPEED/speed;b.vy*=MAX_SPEED/speed;}}
 }
 update(dt:number,input:Input={left:false,right:false,launch:false}){if(this.paused||this.ended||!finite(dt)||dt<0)return;const safe={left:!!input.left,right:!!input.right,launch:!!input.launch};this.last=safe;this.accumulator+=Math.min(dt,.25);while(this.accumulator>=STEP-1e-12&&!this.ended){this.accumulator=Math.max(0,this.accumulator-STEP);this.step(safe);}if(this.events.length>120)this.events.splice(0,this.events.length-120);}
 save(){return JSON.stringify({v:2,mode:this.mode,state:this.state,time:this.time,score:this.score,ballNo:this.ballNo,balls:this.balls,nextId:this.nextId,seed:this.seed,rng:this.rng,angles:this.angles,lamps:this.lamps,rescues:this.rescues,resetLamps:this.resetLamps,locks:this.locks,multiball:this.multiball,ramps:this.ramps,saveUntil:this.saveUntil,tilt:this.tilt,tiltUntil:this.tiltUntil,nudgeUntil:this.nudgeUntil,combo:this.combo,comboUntil:this.comboUntil,hits:this.hits,maxBalls:this.maxBalls,accumulator:this.accumulator});}
 static load(text:string):Game|null{try{const s=JSON.parse(text);if(s.v!==2||!['arcade','practice'].includes(s.mode)||!['ready','play'].includes(s.state))return null;const g=new Game(s.mode,s.seed);if(!finite(s.time)||s.time<0||s.time>1e7||!Number.isSafeInteger(s.score)||s.score<0||s.score>1e12||!Number.isInteger(s.ballNo)||s.ballNo<1||s.mode==='arcade'&&s.ballNo>3)return null;
  for(const k of ['nextId','seed','rng','rescues','ramps','hits','maxBalls','locks','combo'])if(!Number.isSafeInteger(s[k])||s[k]<0||s[k]>4294967295)return null;
  if(s.nextId<1||s.locks>2||s.combo<1||s.combo>5||s.maxBalls<1||s.maxBalls>3||typeof s.multiball!=='boolean'||!Array.isArray(s.balls)||s.balls.length>3||s.state==='ready'&&s.balls.length||s.state==='play'&&!s.balls.length)return null;
  for(const k of ['resetLamps','saveUntil','tiltUntil','nudgeUntil','comboUntil'])if(!finite(s[k])||s[k]<0||s[k]>s.time+30)return null;
  if(!finite(s.tilt)||s.tilt<0||s.tilt>1.5||!finite(s.accumulator)||s.accumulator<0||s.accumulator>=STEP||!Array.isArray(s.angles)||s.angles.length!==2||s.angles.some((a:number,i:number)=>!finite(a)||a<Math.min(FLIPPERS[i].rest,FLIPPERS[i].up)-.001||a>Math.max(FLIPPERS[i].rest,FLIPPERS[i].up)+.001)||!Array.isArray(s.lamps)||s.lamps.length!==3||s.lamps.some((v:unknown)=>typeof v!=='boolean'))return null;
  const ids=new Set<number>();for(const b of s.balls){if(!point(b)||!Number.isInteger(b.id)||b.id<1||b.id>=s.nextId||ids.has(b.id)||!finite(b.vx)||!finite(b.vy)||Math.hypot(b.vx,b.vy)>MAX_SPEED+1||typeof b.moon!=='boolean'||typeof b.launcher!=='boolean'||b.rail!==null&&!['left','right','launch'].includes(b.rail)||!finite(b.progress)||b.progress<0||b.progress>1||!finite(b.cool)||b.cool<0||b.cool>.51)return null;ids.add(b.id);if(b.rail&&Math.hypot(b.x-railPoint(b.rail,b.progress).x,b.y-railPoint(b.rail,b.progress).y)>2)return null;}
  for(const k of ['state','time','score','ballNo','balls','nextId','seed','rng','angles','lamps','rescues','resetLamps','locks','multiball','ramps','saveUntil','tilt','tiltUntil','nudgeUntil','combo','comboUntil','hits','maxBalls'])Object.assign(g,{[k]:s[k]});g.accumulator=s.accumulator;g.paused=true;g.release();g.say('Saved table restored. Carry on when ready.');return g;
 }catch{return null;}}
}
