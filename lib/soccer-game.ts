// Fluffball Cup: four-a-side top-down soccer on a 100 × 60 pitch. Dora's Sky Squad (team 0, you) attacks right.
// A friendly is one match against Enzo's Ember FC; the cup is three knockout rounds, and a level cup match
// goes to golden goal. Everything here is deterministic, so tests can replay whole matches.
export type Footballer={id:number;name:string;team:0|1;x:number;y:number;vx:number;vy:number;keeper:boolean;stamina:number;face:1|-1;speed:number;dash:number;dashCool:number;dive:number};
export type SoccerInput={x:number;y:number;sprint:boolean};
export type Mode='friendly'|'cup';
export type Rival={id:'viscacha'|'degu'|'ember';name:string;short:string;captain:string;names:[string,string,string,string];
 /** Chase and carry speed, how far out they shoot, how hard, how quickly the keeper shuffles, how far ahead the
  * chaser reads your run (seconds), how fast the keeper dives at a shot and whether a second defender covers the shot. */
 chase:number;carry:number;range:number;power:number;keeper:number;dive:number;lead:number;cover:boolean;dash:boolean};
export type Fx={kind:'kick'|'tackle'|'chip';x:number;y:number;age:number};
export const MATCH_SECONDS=90;
export const RIVALS:Rival[]=[
 {id:'viscacha',name:'Viscacha United',short:'VIS',captain:'Vito',names:['Vito','Luna','Tito','Quena'],chase:8.2,carry:7.5,range:30,power:44,keeper:4.5,dive:6,lead:0,cover:false,dash:false},
 {id:'degu',name:'Degu Dynamo',short:'DEG',captain:'Dino',names:['Dino','Mina','Gus','Rolo'],chase:9,carry:8.5,range:33,power:47,keeper:6,dive:7.5,lead:.25,cover:true,dash:false},
 {id:'ember',name:'Ember FC',short:'EMB',captain:'Enzo',names:['Enzo','Ash','Coco','Slate'],chase:9.3,carry:8.5,range:35,power:48,keeper:7,dive:9,lead:.4,cover:true,dash:true},
];
export const CUP_ROUNDS=['Round one','Semi-final','Final'];
export const HOME_NAMES=['Dora','Pip','Pebble','Cloud'];
/** The goal mouth spans y 23–37; a ball has to be under the bar (z < BAR) to count. */
export const GOAL_TOP=23,GOAL_BOTTOM=37,BAR=3;
const GRAVITY=34;
export class SoccerGame{
 state:'ready'|'playing'|'paused'|'goal'|'finished'='ready';time=0;score=[0,0];active=0;owner:number|null=0;
 ball={x:27,y:30,z:0,vx:0,vy:0,vz:0,spin:0};aim={x:100,y:30};players:Footballer[]=[];lock=0;aiTime=0;goalTime=0;kickoff:0|1=0;
 message='';messageTime=0;events:string[]=[];fx:Fx[]=[];
 mode:Mode;round:number;rival:Rival;
 /** Dora's side's Fluff meter, 0–1: passes, tackles and time fill it; a full meter buys one Cloud Chip. */
 meter=0;golden=false;shots=[0,0];possession=[0,0];lastKick:{team:0|1;pass:boolean}|null=null;scorer='';
 constructor(opts:{mode?:Mode;round?:number}={}){this.mode=opts.mode??'friendly';this.round=this.mode==='cup'?Math.max(0,Math.min(2,opts.round??0)):2;this.rival=RIVALS[this.round];this.reset(0)}
 reset(team:0|1){
  const names=[...HOME_NAMES,...this.rival.names];
  this.players=names.map((name,id)=>{const side=(id<4?0:1) as 0|1,index=id%4;return {id,name,team:side,keeper:index===3,x:side?([73,67,67,95][index]):[27,33,33,5][index],y:[30,16,44,30][index],vx:0,vy:0,stamina:1,face:side?-1:1,speed:0,dash:0,dashCool:3,dive:0}});
  this.owner=team===0?0:4;this.active=0;this.ball={x:team===0?28.5:71.5,y:30,z:0,vx:0,vy:0,vz:0,spin:0};this.lock=.8;this.aiTime=0;this.aim={x:100,y:30};this.lastKick=null;
 }
 start(){if(this.state==='ready')this.state='playing'}
 pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing'}
 say(s:string){this.message=s;this.messageTime=1.8}
 /** Who won: 0 for Dora's side, 1 for the rival, null for a draw (friendlies only). */
 get winner(){return this.state!=='finished'||this.score[0]===this.score[1]?null:this.score[0]>this.score[1]?0:1}
 switchPlayer(){if(this.state!=='playing')return;const candidates=this.players.filter(p=>p.team===0&&!p.keeper&&p.id!==this.active).sort((a,b)=>Math.hypot(a.x-this.ball.x,a.y-this.ball.y)-Math.hypot(b.x-this.ball.x,b.y-this.ball.y));this.active=candidates[0].id;this.say(this.players[this.active].name+' selected')}
 kick(target:{x:number;y:number},speed:number,lift=0,pass=false){
  if(this.owner===null)return false;const p=this.players[this.owner],dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;
  this.ball.x=p.x+dx/d*1.8;this.ball.y=p.y+dy/d*1.8;this.ball.z=lift?.3:0;this.ball.vx=dx/d*speed;this.ball.vy=dy/d*speed;this.ball.vz=lift;
  this.lastKick={team:p.team,pass};this.owner=null;this.lock=.18;this.aiTime=0;this.fx.push({kind:lift?'chip':'kick',x:p.x,y:p.y,age:0});return true;
 }
 shoot(){if(this.state!=='playing'||this.owner!==this.active)return false;this.events.push('shot');this.shots[0]++;this.say('Shot!');return this.kick(this.aim,52)}
 /** Dora's side's special: a lofted shot that sails over everyone, keeper included, and dips under the bar. */
 chip(){
  if(this.state!=='playing'||this.owner!==this.active||this.meter<1)return false;
  const p=this.players[this.active],d=Math.max(8,Math.hypot(this.aim.x-p.x,this.aim.y-p.y));
  // Pick the lift so the ball comes down near the aim point, allowing for the ball slowing as it flies.
  const speed=Math.min(46,Math.max(26,d*1.15)),flight=Math.min(1.5,d/speed*1.15);
  this.meter=0;this.events.push('chip');this.shots[0]++;this.say('Cloud Chip!');return this.kick(this.aim,speed,GRAVITY*flight/2);
 }
 pass(){if(this.state!=='playing'||this.owner!==this.active)return false;const p=this.players[this.active],mate=this.players.filter(q=>q.team===0&&!q.keeper&&q.id!==p.id).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];this.say('Pass to '+mate.name);return this.kick(mate,30,0,true)}
 goal(team:0|1){
  this.score[team]++;this.state='goal';this.goalTime=2;this.kickoff=team===0?1:0;this.owner=null;this.ball.vx=0;this.ball.vy=0;this.ball.vz=0;this.ball.z=0;this.events.push('goal');
  this.scorer=team===0?'Dora’s team':this.rival.id==='ember'?'Enzo’s team':this.rival.name;
  this.say(`GOAL! ${this.golden?'Golden goal for ':''}${this.scorer}!`);
 }
 private gain(amount:number){this.meter=Math.min(1,this.meter+amount)}
 private takes(p:Footballer,how:'receive'|'tackle'){
  const kick=this.lastKick;this.owner=p.id;this.lock=how==='tackle'?.75:.55;this.aiTime=0;
  if(p.team===0&&!p.keeper)this.active=p.id;
  if(how==='tackle'){if(p.team===0)this.gain(.25);this.fx.push({kind:'tackle',x:p.x,y:p.y,age:0});this.events.push('tackle');this.say(p.name+' wins the ball')}
  else if(kick&&kick.pass&&kick.team===0&&p.team===0)this.gain(.2);
  this.lastKick=null;
 }
 step(dt:number,input:SoccerInput={x:0,y:0,sprint:false}){
  dt=Math.min(dt,1/60);
  for(const f of this.fx)f.age+=dt;this.fx=this.fx.filter(f=>f.age<.6);
  if(this.state==='goal'){this.goalTime-=dt;if(this.goalTime<=0){if(this.time>=MATCH_SECONDS)this.state='finished';else{this.reset(this.kickoff);this.state='playing'}}return}
  if(this.state!=='playing')return;
  this.time+=dt;this.lock=Math.max(0,this.lock-dt);this.aiTime+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.gain(dt*.02);
  const before=this.players.map(p=>[p.x,p.y]);
  const human=this.players[this.active],n=Math.max(1,Math.hypot(input.x,input.y)),running=input.sprint&&human.stamina>.05&&(input.x!==0||input.y!==0);
  human.x+=input.x/n*(running?15:10)*dt;human.y+=input.y/n*(running?15:10)*dt;human.stamina=Math.max(0,Math.min(1,human.stamina+(running?-.24:.14)*dt));
  const move=(p:Footballer,x:number,y:number,speed:number)=>{const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);if(d>.15){const step=Math.min(d,speed*dt);p.x+=dx/d*step;p.y+=dy/d*step}};
  const r=this.rival;
  for(const team of [0,1]){
   const chase=team===0?9.3:r.chase,carry=team===0?8.5:r.carry;
   const outfield=this.players.filter(p=>p.team===team&&!p.keeper&&p.id!==this.active);
   const chaser=outfield.slice().sort((a,b)=>Math.hypot(a.x-this.ball.x,a.y-this.ball.y)-Math.hypot(b.x-this.ball.x,b.y-this.ball.y))[0];
   for(const p of this.players.filter(p=>p.team===team&&p.id!==this.active)){
    p.stamina=Math.min(1,p.stamina+dt*.14);p.dashCool=Math.max(0,p.dashCool-dt);p.dash=Math.max(0,p.dash-dt);p.dive=Math.max(0,p.dive-dt);
    if(p.keeper){
     const kx=team===0?5:95,ky=this.ball.y;
     // A shot on target: dive for where it will cross the line.
     const b=this.ball,toward=this.owner===null&&(team===0?b.vx<-8:b.vx>8)&&b.z<BAR;
     const cross=toward?b.y+b.vy*Math.abs(((team===0?0:100)-b.x)/b.vx):0;
     if(toward&&cross>GOAL_TOP-1&&cross<GOAL_BOTTOM+1){p.dive=.3;move(p,team===0?4:96,Math.max(GOAL_TOP,Math.min(GOAL_BOTTOM,cross)),team===0?9:r.dive);continue}
     move(p,kx,Math.max(24,Math.min(36,ky)),team===0?5:r.keeper);continue;
    }
    if(this.owner===p.id){
     // Enzo's Ember Dash: now and then he bursts forward with the ball.
     if(team===1&&r.dash&&p.id===4&&p.dashCool===0&&p.x>30){p.dash=.8;p.dashCool=5;this.events.push('dash');this.say('Ember Dash!')}
     move(p,team===0?94:6,30+Math.sin(this.time*.8)*7,carry*(p.dash>0?1.7:1));
     if(this.aiTime>1.1&&team===0){this.kick(human,29,0,true)}
     else if(team===1&&((p.x<r.range&&this.aiTime>.55)||this.aiTime>3)){this.shots[1]++;this.kick({x:0,y:26+Math.sin(this.time*1.7)*4},r.power)}
     continue;
    }
    const friendly=this.owner!==null&&this.players[this.owner].team===team,carrier=this.owner===null?null:this.players[this.owner];
    const lead=team===1&&carrier?r.lead:0,bx=this.ball.x+(carrier?carrier.vx*lead:0),by=this.ball.y+(carrier?carrier.vy*lead:0);
    if(!friendly&&p===chaser)move(p,bx,by,chase);
    else if(team===1&&r.cover&&carrier&&carrier.team===0&&p===outfield.filter(q=>q!==chaser).sort((a,b)=>Math.hypot(a.x-this.ball.x,a.y-this.ball.y)-Math.hypot(b.x-this.ball.x,b.y-this.ball.y))[0]){
     // Cover: stand goal-side on the line from the ball to the middle of the goal.
     const gx=100,gy=30,f=Math.min(.55,Math.max(.3,8/Math.max(1,Math.hypot(gx-this.ball.x,gy-this.ball.y))*2));
     move(p,this.ball.x+(gx-this.ball.x)*f,this.ball.y+(gy-this.ball.y)*f,chase);
    }
    else{const targetX=friendly?this.ball.x+(team===0?11:-11):team===0?28:72;move(p,Math.max(12,Math.min(88,targetX)),p.id%4===1?17:p.id%4===2?43:30,6.5)}
   }
  }
  for(const [i,p] of this.players.entries()){
   p.x=Math.max(2,Math.min(98,p.x));p.y=Math.max(3,Math.min(57,p.y));
   const dx=p.x-before[i][0],dy=p.y-before[i][1];p.vx=dx/dt;p.vy=dy/dt;p.speed=Math.hypot(dx,dy)/dt;if(Math.abs(dx)>1e-4)p.face=dx>0?1:-1;
  }
  const b=this.ball;
  if(this.owner!==null){
   const p=this.players[this.owner];this.possession[p.team]+=dt;
   b.x=p.x+(p.team===0?1.5:-1.5);b.y=p.y;b.z=0;b.vx=0;b.vy=0;b.vz=0;b.spin+=p.speed*dt*.6;
   if(p.keeper&&this.aiTime>.7){const mate=this.players.find(q=>q.team===p.team&&!q.keeper)!;this.kick(mate,32,0,true)}
   if(this.lock===0){const tackler=this.players.find(q=>q.team!==p.team&&Math.hypot(q.x-p.x,q.y-p.y)<1.6);if(tackler)this.takes(tackler,'tackle')}
  }else{
   b.x+=b.vx*dt;b.y+=b.vy*dt;b.spin+=Math.hypot(b.vx,b.vy)*dt*.6;const damping=Math.exp(-.36*dt);b.vx*=damping;b.vy*=damping;
   if(b.z>0||b.vz>0){b.vz-=GRAVITY*dt;b.z+=b.vz*dt;if(b.z<=0){b.z=0;b.vz=Math.abs(b.vz)>6?-b.vz*.35:0;b.vx*=.8;b.vy*=.8}}
   if(b.x<0||b.x>100){
    if(b.y>GOAL_TOP&&b.y<GOAL_BOTTOM&&b.z<BAR){this.goal(b.x>100?0:1);return}
    if(b.y>GOAL_TOP&&b.y<GOAL_BOTTOM){
     // Over the bar: the defending keeper takes a goal kick.
     const keeper=this.players[b.x>100?7:3];b.x=keeper.x;b.y=keeper.y;b.z=0;b.vz=0;this.takes(keeper,'receive');this.say('Over the bar!');
    }else{b.x=Math.max(0,Math.min(100,b.x));b.vx*=-.7}
   }
   if(b.y<1||b.y>59){b.y=Math.max(1,Math.min(59,b.y));b.vy*=-.7}
   if(this.lock===0&&b.z<1.4){const receiver=this.players.slice().sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y)).find(p=>Math.hypot(p.x-b.x,p.y-b.y)<(p.keeper?1.8:1.2));if(receiver)this.takes(receiver,'receive')}
  }
  if(this.time>=MATCH_SECONDS){
   this.time=MATCH_SECONDS;
   if(this.mode==='cup'&&this.score[0]===this.score[1]){if(!this.golden){this.golden=true;this.events.push('golden');this.say('Golden goal! Next goal wins.')}}
   else{this.state='finished';this.events.push('whistle')}
  }
 }
}
