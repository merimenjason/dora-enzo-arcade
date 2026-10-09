/** Deterministic fixed-step pinball. All coordinates also drive the painted scene. */
export const WIDTH=1000,HEIGHT=1000,STEP=1/240,RADIUS=10;
export type Point={x:number;y:number};
export type Mode='arcade'|'practice';
export type State='ready'|'play'|'over';
export type Input={left:boolean;right:boolean;launch:boolean};
export type Rail='left'|'right'|'dust';
export type Ball=Point&{id:number;vx:number;vy:number;moon:boolean;launcher:boolean;rail:Rail|null;progress:number;cool:number};
export type Ev={t:'launch'|'bumper'|'sling'|'target'|'rescue'|'ramp'|'dust'|'lock'|'multiball'|'save'|'drain'|'nudge'|'tilt'|'over';x:number;y:number;n?:number};
export const BUMPERS=[{x:500,y:255,r:47},{x:420,y:350,r:47},{x:585,y:350,r:47}];
export const TARGETS=[{x:199,y:140},{x:242,y:140},{x:285,y:140}];
export const FLIPPERS=[{x:360,y:820,length:125,rest:.45,up:-.4},{x:640,y:820,length:125,rest:Math.PI-.45,up:Math.PI+.4}];
export const RAMPS={left:[{x:325,y:485},{x:270,y:415},{x:190,y:340},{x:150,y:250},{x:178,y:190},{x:300,y:115},{x:500,y:100},{x:685,y:155},{x:790,y:330},{x:828,y:610},{x:810,y:770},{x:695,y:800}],right:[{x:715,y:475},{x:795,y:410},{x:822,y:290},{x:775,y:220},{x:767,y:175}],dust:[{x:780,y:235},{x:785,y:190},{x:750,y:155},{x:735,y:185},{x:767,y:205},{x:789,y:173},{x:767,y:175}]};
type Segment=[number,number,number,number];
export const WALLS:Segment[]=[
 [170,180,300,65],[300,65,650,50],[650,50,850,45],[850,45,960,120],[960,120,960,985],
 [900,300,910,990],
 [170,180,245,310],[245,310,340,475],[340,475,280,630],[280,630,305,790],
 [850,195,820,320],[820,320,770,490],[770,490,815,635],[815,635,755,790],
 [175,540,135,795],[135,795,355,940],
 [850,540,858,795],[858,795,645,940],
];
export const SLINGS:Segment[]=[[265,645,337,717],[337,717,329,755],[329,755,265,700],[735,645,663,717],[663,717,671,755],[671,755,735,700]];
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
 launch(power:number){if(this.state!=='ready'||this.paused||!finite(power))return false;this.state='play';this.charging=false;this.charge=0;this.saveUntil=this.time+7;const b=this.add(925,880,(this.random()-.5)*6,-(900+clamp(power,.05,1)*550),false,true);this.emit('launch',b.x,b.y);this.say('Aim with the flipper tips. The right ramp locks moonberries.');return true;}
 nudge(){if(this.paused||this.state!=='play'||this.time<this.nudgeUntil||this.time<this.tiltUntil)return false;this.nudgeUntil=this.time+.45;this.tilt=Math.min(1.5,this.tilt+.38);for(const b of this.balls)if(!b.rail){b.vy-=110;b.vx+=(b.x<500?1:-1)*80;}this.emit('nudge');if(this.tilt>=1){this.tiltUntil=this.time+3;this.emit('tilt');this.say('Tilt! The paws rest for three seconds.');}return true;}
 private circle(b:Ball,p:Point,r:number,kick:number){let dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);if(d>=r+RADIUS)return false;if(d<.001){dx=0;dy=-1;d=1;}const nx=dx/d,ny=dy/d;b.x=p.x+nx*(r+RADIUS+.05);b.y=p.y+ny*(r+RADIUS+.05);const vn=b.vx*nx+b.vy*ny;if(vn<0){b.vx-=1.85*vn*nx;b.vy-=1.85*vn*ny;}if(kick){b.vx+=nx*kick;b.vy+=ny*kick;}return true;}
 private capsule(b:Ball,a:Point,p:Point,r:number,vx=0,vy=0,restitution=.78){const q=closest(b,a,p),dx=b.x-q.x,dy=b.y-q.y,d=Math.hypot(dx,dy);if(d>=r+RADIUS)return false;let nx=dx/(d||1),ny=dy/(d||1);if(d<.001){const len=Math.hypot(p.x-a.x,p.y-a.y)||1;nx=-(p.y-a.y)/len;ny=(p.x-a.x)/len;}b.x=q.x+nx*(r+RADIUS+.05);b.y=q.y+ny*(r+RADIUS+.05);const vn=(b.vx-vx)*nx+(b.vy-vy)*ny;if(vn<0){b.vx-=(1+restitution)*vn*nx;b.vy-=(1+restitution)*vn*ny;}return true;}
 private enter(b:Ball,rail:Rail){b.rail=rail;b.progress=0;const p=railPoint(rail,0);b.x=p.x;b.y=p.y;b.launcher=false;b.cool=.4;const n=this.award(500,b.x,b.y);this.emit(rail==='dust'?'dust':'ramp',b.x,b.y,n);}
 private lock(b:Ball){this.balls=this.balls.filter(p=>p!==b);if(this.multiball){this.add(700,785,-160,150,true);return;}this.locks++;this.emit('lock',767,175,this.locks);this.say(`Moonberry ${this.locks} / 3 locked.`);if(this.locks>=3){this.locks=0;this.multiball=true;this.saveUntil=this.time+12;this.award(5000,500,255);for(const [x,y,vx,vy] of [[330,500,140,200],[520,235,-160,160],[700,485,-80,260]])this.add(x,y,vx+(this.random()-.5)*70,vy,true);this.emit('multiball',500,255);this.say('Moonberry multiball! Double points and twelve seconds of ball save.');}else if(!this.balls.length){this.state='ready';this.release();}}
 private drain(b:Ball){this.balls=this.balls.filter(p=>p!==b);if(b.launcher){if(!this.balls.length)this.state='ready';this.say('A firmer launch will reach the top curve.');return;}if(this.time<this.saveUntil){this.add(500,700,(this.random()-.5)*180,-900,this.multiball);this.emit('save',500,700);this.say('Ball saved! Keep the berry bouncing.');return;}this.emit('drain',b.x,b.y);if(this.balls.length){if(this.balls.length===1){this.multiball=false;this.balls[0].moon=false;}return;}this.multiball=false;this.ballNo++;this.release();if(this.mode==='arcade'&&this.ballNo>3){this.state='over';this.emit('over');this.say('A lovely little run. Try to beat your best!');}else{this.state='ready';this.say('Hold Launch for the next berry.');}}
 private step(input:Input){const dt=STEP;this.time+=dt;this.tilt=Math.max(0,this.tilt-dt*.12);if(this.comboUntil<this.time)this.combo=1;
  if(this.resetLamps&&this.time>=this.resetLamps){this.lamps=[false,false,false];this.resetLamps=0;}
  const tilt=this.time<this.tiltUntil;
  for(let i=0;i<2;i++){const f=FLIPPERS[i],up=!tilt&&(i?input.right:input.left),goal=up?f.up:f.rest,old=this.angles[i];this.angles[i]+=clamp(goal-old,-22*dt,22*dt);this.omega[i]=(this.angles[i]-old)/dt;}
  if(this.state==='ready'){if(input.launch){this.charging=true;this.charge=Math.min(1,this.charge+dt*.9);}else if(this.charging)this.launch(this.charge);return;}
  // oxlint-disable-next-line unicorn/no-useless-spread -- Locking or draining replaces the live ball array during this pass.
  for(const b of [...this.balls]){b.cool=Math.max(0,b.cool-dt);
   if(b.rail){b.progress=Math.min(1,b.progress+dt/(b.rail==='left'?1.8:b.rail==='right'?.85:.65));const p=railPoint(b.rail,b.progress);b.x=p.x;b.y=p.y;if(b.progress>=1){const rail=b.rail;b.rail=null;b.progress=0;this.ramps++;if(rail==='left'){b.x=695;b.y=785;b.vx=-165;b.vy=160;b.cool=.5;const n=this.award(2500,b.x,b.y);this.emit('ramp',b.x,b.y,n);this.say('Bridge run! Try the right ramp for a moonberry lock.');}else this.lock(b);}continue;}
   b.vy+=650*dt;b.vx*=Math.exp(-.08*dt);b.vy*=Math.exp(-.08*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;
   if(b.launcher&&b.x<890&&b.y<300)b.launcher=false;
   if(!b.launcher&&b.cool===0&&b.vy<-70){if(Math.hypot(b.x-325,b.y-485)<36){this.enter(b,'left');continue;}if(Math.hypot(b.x-715,b.y-475)<36){this.enter(b,'right');continue;}if(Math.hypot(b.x-780,b.y-235)<32){this.enter(b,'dust');continue;}}
   if(!b.launcher){for(const p of BUMPERS)if(this.circle(b,p,p.r,b.cool===0?180:0)&&b.cool===0){b.cool=.07;this.hits++;this.combo=Math.min(5,this.combo+Number(this.time<this.comboUntil));this.comboUntil=this.time+2;const n=this.award(500*this.combo,p.x,p.y);this.emit('bumper',p.x,p.y,n);}
    TARGETS.forEach((p,i)=>{if(this.circle(b,p,16,70)&&b.cool===0){b.cool=.06;if(!this.lamps[i]&&!this.resetLamps){this.lamps[i]=true;const n=this.award(1000,p.x,p.y);this.emit('target',p.x,p.y,n);if(this.lamps.every(Boolean)){this.rescues++;this.resetLamps=this.time+3;const reward=this.award(10000,242,140);this.emit('rescue',242,140,reward);this.say('Burrow rescued! Three new targets will light shortly.');}}}});
   }
   for(const [x,y,a,c] of WALLS)this.capsule(b,{x,y},{x:a,y:c},4);
   if(!b.launcher){for(let i=0;i<SLINGS.length;i++){const [x,y,a,c]=SLINGS[i];if(this.capsule(b,{x,y},{x:a,y:c},5)&&b.cool===0){b.vx+=(i<3?1:-1)*230;b.vy-=220;b.cool=.16;const n=this.award(250,b.x,b.y);this.emit('sling',b.x,b.y,n);}}
    for(let i=0;i<2;i++){const f=FLIPPERS[i],angle=this.angles[i],end={x:f.x+Math.cos(angle)*f.length,y:f.y+Math.sin(angle)*f.length},q=closest(b,f,end),omega=this.omega[i];this.capsule(b,f,end,17,-(q.y-f.y)*omega,(q.x-f.x)*omega,.84);}
   }
   const speed=Math.hypot(b.vx,b.vy);if(speed>1550){b.vx*=1550/speed;b.vy*=1550/speed;}
   if(b.x<20){b.x=20;b.vx=Math.abs(b.vx);}if(b.x>980){b.x=980;b.vx=-Math.abs(b.vx);}if(b.y<20){b.y=20;b.vy=Math.abs(b.vy);}
   if(b.y>1020)this.drain(b);
  }
  for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++){const a=this.balls[i],b=this.balls[j];if(a.rail||b.rail)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=RADIUS*2)continue;const nx=d?dx/d:1,ny=d?dy/d:0,over=(RADIUS*2-d+.05)/2;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){const impulse=-v*.94;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}}
  for(const b of this.balls){const speed=Math.hypot(b.vx,b.vy);if(speed>1550){b.vx*=1550/speed;b.vy*=1550/speed;}}
 }
 update(dt:number,input:Input={left:false,right:false,launch:false}){if(this.paused||this.ended||!finite(dt)||dt<0)return;const safe={left:!!input.left,right:!!input.right,launch:!!input.launch};this.last=safe;this.accumulator+=Math.min(dt,.25);while(this.accumulator>=STEP-1e-12&&!this.ended){this.accumulator=Math.max(0,this.accumulator-STEP);this.step(safe);}if(this.events.length>120)this.events.splice(0,this.events.length-120);}
 save(){return JSON.stringify({v:1,mode:this.mode,state:this.state,time:this.time,score:this.score,ballNo:this.ballNo,balls:this.balls,nextId:this.nextId,seed:this.seed,rng:this.rng,angles:this.angles,lamps:this.lamps,rescues:this.rescues,resetLamps:this.resetLamps,locks:this.locks,multiball:this.multiball,ramps:this.ramps,saveUntil:this.saveUntil,tilt:this.tilt,tiltUntil:this.tiltUntil,nudgeUntil:this.nudgeUntil,combo:this.combo,comboUntil:this.comboUntil,hits:this.hits,maxBalls:this.maxBalls,accumulator:this.accumulator});}
 static load(text:string):Game|null{try{const s=JSON.parse(text);if(s.v!==1||!['arcade','practice'].includes(s.mode)||!['ready','play'].includes(s.state))return null;const g=new Game(s.mode,s.seed);if(!finite(s.time)||s.time<0||s.time>1e7||!Number.isSafeInteger(s.score)||s.score<0||s.score>1e12||!Number.isInteger(s.ballNo)||s.ballNo<1||s.mode==='arcade'&&s.ballNo>3)return null;
  for(const k of ['nextId','seed','rng','rescues','ramps','hits','maxBalls','locks','combo'])if(!Number.isSafeInteger(s[k])||s[k]<0||s[k]>4294967295)return null;
  if(s.nextId<1||s.locks>2||s.combo<1||s.combo>5||s.maxBalls<1||s.maxBalls>3||typeof s.multiball!=='boolean'||!Array.isArray(s.balls)||s.balls.length>3||s.state==='ready'&&s.balls.length||s.state==='play'&&!s.balls.length)return null;
  for(const k of ['resetLamps','saveUntil','tiltUntil','nudgeUntil','comboUntil'])if(!finite(s[k])||s[k]<0||s[k]>s.time+30)return null;
  if(!finite(s.tilt)||s.tilt<0||s.tilt>1.5||!finite(s.accumulator)||s.accumulator<0||s.accumulator>=STEP||!Array.isArray(s.angles)||s.angles.length!==2||s.angles.some((a:number,i:number)=>!finite(a)||a<Math.min(FLIPPERS[i].rest,FLIPPERS[i].up)-.001||a>Math.max(FLIPPERS[i].rest,FLIPPERS[i].up)+.001)||!Array.isArray(s.lamps)||s.lamps.length!==3||s.lamps.some((v:unknown)=>typeof v!=='boolean'))return null;
  const ids=new Set<number>();for(const b of s.balls){if(!point(b)||!Number.isInteger(b.id)||b.id<1||b.id>=s.nextId||ids.has(b.id)||!finite(b.vx)||!finite(b.vy)||Math.hypot(b.vx,b.vy)>1551||typeof b.moon!=='boolean'||typeof b.launcher!=='boolean'||b.rail!==null&&!['left','right','dust'].includes(b.rail)||!finite(b.progress)||b.progress<0||b.progress>1||!finite(b.cool)||b.cool<0||b.cool>.51)return null;ids.add(b.id);if(b.rail&&Math.hypot(b.x-railPoint(b.rail,b.progress).x,b.y-railPoint(b.rail,b.progress).y)>2)return null;}
  for(const k of ['state','time','score','ballNo','balls','nextId','seed','rng','angles','lamps','rescues','resetLamps','locks','multiball','ramps','saveUntil','tilt','tiltUntil','nudgeUntil','combo','comboUntil','hits','maxBalls'])Object.assign(g,{[k]:s[k]});g.accumulator=s.accumulator;g.paused=true;g.release();g.say('Saved table restored. Carry on when ready.');return g;
 }catch{return null;}}
}
