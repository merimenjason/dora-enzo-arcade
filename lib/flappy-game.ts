import {random} from './dungeon.js';
export const FLIGHT={width:900,height:540,ground:495,ceiling:28,x:[218,164],radius:19,gravity:790,flap:-285,goal:20};
export type FlightGate={id:number;x:number;center:number;gap:number;passed:boolean;centers?:number[]};
export class FlappyGame{
 perfect=0;perfectTime=0;endTime=0;hitHero=-1;hitReason='';events:string[]=[];
 get points(){return this.score*100+this.perfect*50}
 get canRetry(){return (this.state==='lost'||this.state==='won')&&this.endTime>=.55}
 crash(hero:number,reason:string){this.state='lost';this.hitHero=hero;this.hitReason=reason;this.events.push('crash')}
 state:'ready'|'playing'|'paused'|'lost'|'won'='ready';y=250;vy=0;score=0;time=0;distance=0;flapTime=0;gates:FlightGate[]=[];serial=0;roll:()=>number;
 constructor(seed=Math.floor(Math.random()*4294967296)){this.roll=random(seed);this.addGate(820)}
 get speed(){return 155+this.score*2}
 addGate(x:number){const previous=this.gates.at(-1)?.center??250;const center=Math.max(150,Math.min(355,previous+(this.roll()-.5)*145));this.gates.push({id:this.serial++,x,center,gap:Math.max(164,198-this.score*1.7),passed:false})}
 flap(){if(this.state==='ready')this.state='playing';if(this.state!=='playing')return;this.vy=FLIGHT.flap;this.flapTime=.23;this.events.push('flap')}
 pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing'}
 step(dt:number){dt=Math.min(dt,1/60);if(this.state==='lost'||this.state==='won'){this.endTime+=dt;return}if(this.state!=='playing')return;this.perfectTime=Math.max(0,this.perfectTime-dt);this.time+=dt;this.flapTime=Math.max(0,this.flapTime-dt);this.vy+=FLIGHT.gravity*dt;this.y+=this.vy*dt;const movement=this.speed*dt;this.distance+=movement;for(const g of this.gates)g.x-=movement;
 if(this.y-FLIGHT.radius<FLIGHT.ceiling||this.y+FLIGHT.radius>FLIGHT.ground){this.crash(-1,this.y<250?'the ceiling':'the ground');return}
 for(const g of this.gates){for(const [hero,x] of FLIGHT.x.entries()){if(g.x+37<=x&&g.x+37+movement>x)(g.centers??=[])[hero]=Math.abs(this.y-g.center);const nearestX=Math.max(g.x,Math.min(x,g.x+74)),top=g.center-g.gap/2,bottom=g.center+g.gap/2;const dy=this.y<top?0:this.y-top,dyBottom=this.y>bottom?0:bottom-this.y;if((x-nearestX)**2+dy**2<FLIGHT.radius**2||(x-nearestX)**2+dyBottom**2<FLIGHT.radius**2){this.crash(hero,'a checkpoint');return}}
 if(!g.passed&&g.x+74<FLIGHT.x[1]-FLIGHT.radius){g.passed=true;this.score++;if(g.centers&&g.centers[0]<=30&&g.centers[1]<=30){this.perfect++;this.perfectTime=1.25;this.events.push('perfect')}else this.events.push('point');if(this.score===FLIGHT.goal){this.state='won';this.events.push('win');return}}}
 this.gates=this.gates.filter(g=>g.x>-100);if(this.gates.at(-1)!.x<660)this.addGate(this.gates.at(-1)!.x+265);
 }
}
