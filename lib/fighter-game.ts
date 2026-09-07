export type FighterId='dora'|'enzo'|'fox'|'owl'|'snake'|'agent'|'trump';
export const ROSTER: {id:FighterId;name:string;tag:string;special:string;color:string;speed:number;power:number}[]=[
{id:'dora',name:'DORA',tag:'The white whirlwind',special:'Dust Blossom',color:'#e6c7df',speed:4.6,power:1},
{id:'enzo',name:'ENZO',tag:'The grey bruiser',special:'Thunder Chew',color:'#78bbd0',speed:4,power:1.14},
{id:'fox',name:'ANDEAN FOX',tag:'The canyon hunter',special:'Ember Pounce',color:'#ec9d57',speed:4.7,power:.96},
{id:'owl',name:'NIGHT OWL',tag:'Silent wings, loud hits',special:'Feather Cyclone',color:'#c1aedf',speed:4.2,power:1.04},
{id:'snake',name:'VIPER',tag:'The coiled challenger',special:'Venom Wave',color:'#aed278',speed:3.8,power:1.13},
{id:'agent',name:'ICE AGENT',tag:'The checkpoint brawler',special:'Red Tape',color:'#78b1b5',speed:3.7,power:1.15},
{id:'trump',name:'DONALD TRUMP',tag:'The podium powerhouse',special:'Golden Tweet',color:'#f2c960',speed:3.5,power:1.2},
];
export type Input={move:number;jump?:boolean;block?:boolean;jab?:boolean;kick?:boolean;special?:boolean};
export type Attack='jab'|'kick'|'special';
export type Body={id:FighterId;x:number;y:number;vy:number;hp:number;meter:number;facing:number;block:boolean;stun:number;cooldown:number;attack:Attack|null;attackTime:number;hit:boolean;flash:number;combo:number;comboTime:number};
export type Shot={x:number;y:number;dir:number;owner:0|1;life:number};
const empty:Input={move:0};
const body=(id:FighterId,x:number,facing:number):Body=>({id,x,y:0,vy:0,hp:100,meter:50,facing,block:false,stun:0,cooldown:0,attack:null,attackTime:0,hit:false,flash:0,combo:0,comboTime:0});
export class FighterGame{
 state:'select'|'fight'|'paused'|'round'|'match'|'champion'='select';selected:FighterId='dora';opponent=0;round=1;wins=[0,0];time=60;fighters:[Body,Body]=[body('dora',-3,1),body('fox',3,-1)];shots:Shot[]=[];message='CHOOSE YOUR FIGHTER';ai=true;aiClock=0;seed=17;intro=1.2;result:0|1|2=2;impact=0;
 get rivals(){return ROSTER.filter(r=>r.id!==this.selected).map(r=>r.id)}
 get active(){return this.state==='fight'}
 pick(id:FighterId){if(this.state!=='select')return;this.selected=id;this.fighters=[body(id,-3,1),body(this.rivals[0],3,-1)]}
 start(){this.opponent=0;this.round=1;this.wins=[0,0];this.resetRound()}
 resetRound(){this.fighters=[body(this.selected,-3,1),body(this.rivals[this.opponent],3,-1)];this.shots=[];this.time=60;this.intro=1.2;this.aiClock=.6;this.state='fight';this.message=`ROUND ${this.round}`;this.impact=0}
 next(){if(this.state==='round'){this.round++;this.resetRound()}else if(this.state==='match'){if(this.wins[0]===2){if(this.opponent===this.rivals.length-1){this.state='champion';return}this.opponent++;this.round=1;this.wins=[0,0];this.resetRound()}else{this.round=1;this.wins=[0,0];this.resetRound()}}}
 pause(){if(this.state==='fight')this.state='paused';else if(this.state==='paused')this.state='fight'}
 random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296}
 attack(i:0|1,a:Attack){const f=this.fighters[i];if(!this.active||this.intro>0||f.stun>0||f.cooldown>0||f.block||(a==='special'&&f.meter<35))return false;f.attack=a;f.attackTime=0;f.hit=false;f.cooldown=a==='jab'?.33:a==='kick'?.55:.8;if(a==='special')f.meter-=35;return true}
 damage(owner:0|1,amount:number){const a=this.fighters[owner],b=this.fighters[owner===0?1:0],blocked=b.block&&b.y===0&&b.facing===-Math.sign(b.x-a.x);b.hp=Math.max(0,b.hp-(blocked?Math.max(1,amount*.15):amount));b.flash=.14;b.stun=blocked?.08:.2;if(!blocked){b.x=Math.max(-6.8,Math.min(6.8,b.x+a.facing*.2));a.combo=a.comboTime>0?a.combo+1:1;a.comboTime=.9;a.meter=Math.min(100,a.meter+8);this.impact=.1}else b.meter=Math.min(100,b.meter+4)}
 finish(){this.result=this.fighters[0].hp===this.fighters[1].hp?2:this.fighters[0].hp>this.fighters[1].hp?0:1;if(this.result!==2)this.wins[this.result]++;this.state=this.wins.some(w=>w>=2)?'match':'round';this.message=this.result===2?'DRAW — REMATCH':this.result===0?'YOU WIN':'RIVAL WINS';this.shots=[]}
 step(dt:number,input:Input=empty,rivalInput?:Input){if(!this.active)return;dt=Math.min(dt,1/60);this.impact=Math.max(0,this.impact-dt);if(this.intro>0){this.intro=Math.max(0,this.intro-dt);this.message=this.intro>.5?`ROUND ${this.round}`:'FIGHT!';return}this.time=Math.max(0,this.time-dt);this.message='';
 const [p,r]=this.fighters;let ai:Input=rivalInput??empty;if(this.ai&&!rivalInput){this.aiClock-=dt;const distance=Math.abs(p.x-r.x),dir=Math.sign(p.x-r.x);ai={move:distance>1.7?dir:distance<1?-dir:0,block:p.attack!==null&&distance<2.6&&this.random()<.62};if(this.aiClock<=0){const n=this.random();ai={...ai,jab:distance<2&&n<.55,kick:distance<2.4&&n>=.55,special:distance>2.4&&r.meter>=35&&n>.35,jump:p.attack==='special'||n<.12};this.aiClock=.25+this.random()*.4}}
 for(const [i,f]of this.fighters.entries()){const n=i as 0|1,other=this.fighters[i===0?1:0],control=i===0?input:ai,profile=ROSTER.find(r=>r.id===f.id)!;f.facing=other.x>=f.x?1:-1;f.stun=Math.max(0,f.stun-dt);f.cooldown=Math.max(0,f.cooldown-dt);f.flash=Math.max(0,f.flash-dt);f.comboTime=Math.max(0,f.comboTime-dt);if(f.comboTime===0)f.combo=0;f.meter=Math.min(100,f.meter+7*dt);f.block=!!control.block&&f.y===0&&!f.attack&&f.stun===0;
 if(f.stun===0){if(control.jump&&f.y===0&&!f.block){f.vy=7.2}if(control.jab)this.attack(n,'jab');else if(control.kick)this.attack(n,'kick');else if(control.special)this.attack(n,'special');if(!f.block&&!f.attack){const nx=Math.max(-6.8,Math.min(6.8,f.x+Math.max(-1,Math.min(1,control.move))*profile.speed*dt));if(Math.abs(nx-other.x)>1.05||Math.abs(f.y-other.y)>.9||Math.abs(nx-other.x)>Math.abs(f.x-other.x))f.x=nx}}
 f.vy-=19*dt;f.y=Math.max(0,f.y+f.vy*dt);if(f.y===0)f.vy=0;
 if(f.attack){f.attackTime+=dt;if(!f.hit&&f.attackTime>=.12){f.hit=true;if(f.attack==='special')this.shots.push({x:f.x+f.facing*.8,y:f.y+.9,dir:f.facing,owner:n,life:2.2});else if(Math.abs(f.x-other.x)<(f.attack==='jab'?1.85:2.35)&&Math.abs(f.y-other.y)<.95)this.damage(n,(f.attack==='jab'?7:11)*profile.power)}if(f.attackTime> (f.attack==='jab'?.25:.4))f.attack=null}
 }
 for(const shot of this.shots){shot.x+=shot.dir*7*dt;shot.life-=dt;const target=this.fighters[shot.owner===0?1:0];if(shot.life>0&&Math.abs(shot.x-target.x)<.65&&Math.abs(shot.y-(target.y+.85))<.7){this.damage(shot.owner,16*ROSTER.find(r=>r.id===this.fighters[shot.owner].id)!.power);shot.life=0}}this.shots=this.shots.filter(s=>s.life>0&&Math.abs(s.x)<8);if(p.hp<=0||r.hp<=0||this.time<=0)this.finish();
 }
}
