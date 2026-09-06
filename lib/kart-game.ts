export const CIRCUIT=240,LAPS=3;
export const ITEMS={boost:{name:'Hay Turbo',description:'A three-second burst of speed.'},frost:{name:'Frost Pellet',description:'Slows the closest rival ahead for three seconds.'},dust:{name:'Dust Bath',description:'Slows nearby rivals behind you for three seconds.'}};
export type Item=keyof typeof ITEMS;
export type Racer={name:string;s:number;lane:number;speed:number;slow:number;finish:number|null};
export function trackPoint(s:number,lane=0){const a=s/CIRCUIT*Math.PI*2,tx=Math.cos(a)*38,tz=-Math.sin(a)*28,d=Math.hypot(tx,tz);return {x:Math.sin(a)*38-tz/d*lane,z:Math.cos(a)*28+tx/d*lane,tx:tx/d,tz:tz/d}}
export class KartGame{
 resumeState:'racing'|'countdown'='racing';
 state:'ready'|'countdown'|'racing'|'paused'|'finished'='ready';countdown=3;s=0;lane=0;speed=0;time=0;boost=0;drift=0;drifting=false;item:Item|null=null;message='';messageTime=0;hitTime=0;serial=0;finishTime=0;finishPlace=0;lastPad=-1;lastCrate=-1;
 rivals:Racer[]=[{name:'Copper Fox',s:5,lane:-3,speed:18.5,slow:0,finish:null},{name:'Night Owl',s:9,lane:2,speed:19.2,slow:0,finish:null},{name:'Sly Snake',s:13,lane:-1,speed:20,slow:0,finish:null},{name:'Mountain Cougar',s:17,lane:3.5,speed:20.7,slow:0,finish:null}];
 get lap(){return Math.min(LAPS,Math.floor(this.s/CIRCUIT)+1)}
 get place(){return this.state==='finished'?this.finishPlace:1+this.rivals.filter(r=>r.s>this.s).length}
 get offroad(){return Math.abs(this.lane)>5.6}
 start(){if(this.state==='ready')this.state='countdown'}
 pause(){if(this.state==='racing'||this.state==='countdown'){this.resumeState=this.state;this.state='paused'}else if(this.state==='paused')this.state=this.resumeState}
 say(s:string){this.message=s;this.messageTime=2}
 useItem(){if(this.state!=='racing'||!this.item)return false;const item=this.item;if(item==='boost'){this.boost=Math.max(this.boost,3);this.say('Hay Turbo!')}else if(item==='frost'){const r=this.rivals.filter(r=>r.finish===null&&r.s>this.s).sort((a,b)=>a.s-b.s)[0];if(!r){this.say('No rival ahead. Save your pellet.');return false}r.slow=3;this.say(r.name+' caught a frost pellet!')}else{const targets=this.rivals.filter(r=>r.finish===null&&r.s<this.s&&this.s-r.s<35);if(!targets.length){this.say('No rival close behind. Save your dust.');return false}targets.forEach(r=>r.slow=3);this.say('Dust Bath! Rivals behind are slowed.')}this.item=null;return true}
 step(dt:number,input={gas:false,brake:false,steer:0,drift:false}){dt=Math.min(dt,1/60);if(this.state==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.state='racing';this.say('GO!')}}if(this.state!=='racing')return;this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.boost=Math.max(0,this.boost-dt);this.hitTime=Math.max(0,this.hitTime-dt);
 const isDrift=input.drift&&Math.abs(input.steer)>.1&&this.speed>8;if(isDrift)this.drift=Math.min(1.5,this.drift+dt);if(this.drifting&&!isDrift){if(this.drift>=.65){this.boost=Math.max(this.boost,1+this.drift*.6);this.say('Drift boost!')}this.drift=0}this.drifting=isDrift;
 const max=this.offroad?11:this.boost>0?32:23;this.speed=Math.max(0,Math.min(max,this.speed+(input.brake?-22:input.gas?13:-5)*dt));this.lane=Math.max(-9,Math.min(9,this.lane+input.steer*(isDrift?6.5:4.5)*Math.min(1,this.speed/10)*dt));const old=this.s;this.s+=this.speed*dt;
 for(const r of this.rivals){if(r.finish!==null)continue;r.slow=Math.max(0,r.slow-dt);r.s+=r.speed*(r.slow>0?.48:1)*dt;r.lane=Math.sin(this.time*.4+this.rivals.indexOf(r)*1.8)*3.8;if(r.s>=CIRCUIT*LAPS){r.finish=this.time;r.s=CIRCUIT*LAPS}if(this.hitTime===0&&Math.abs(r.s-this.s)<1.6&&Math.abs(r.lane-this.lane)<1.1){this.speed*=.72;this.hitTime=.8;this.say('Bump! Keep your line.')}}
 const pad=Math.floor((this.s-65)/80);if(pad>=0&&pad!==this.lastPad&&old<65+pad*80&&this.s>=65+pad*80&&Math.abs(this.lane-3)<1.7){this.lastPad=pad;this.boost=Math.max(this.boost,1.6);this.say('Boost strip!')}
 const crate=Math.floor((this.s-30)/45);if(crate>=0&&crate!==this.lastCrate&&old<30+crate*45&&this.s>=30+crate*45&&Math.abs(this.lane)<2.5&&!this.item){this.lastCrate=crate;this.item=(['boost','frost','dust'] as Item[])[this.serial++%3];this.say(ITEMS[this.item].name+' collected · Space to use')}
 if(this.s>=CIRCUIT*LAPS){this.s=CIRCUIT*LAPS;this.finishTime=this.time;this.finishPlace=1+this.rivals.filter(r=>r.finish!==null&&r.finish<=this.time).length;this.state='finished';this.speed=0}
 }
}
