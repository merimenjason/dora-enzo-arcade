export const CIRCUIT=240,LAPS=3;
export const ITEMS={boost:{name:'Hay Turbo',description:'A three-second burst of speed.'},frost:{name:'Frost Pellet',description:'Slows the closest rival ahead for three seconds.'},dust:{name:'Dust Bath',description:'Slows nearby rivals behind you for three seconds.'}};
export type Item=keyof typeof ITEMS;
export type Racer={name:string;s:number;lane:number;speed:number;slow:number;finish:number|null};
/** A circuit: an oval of radii rx × rz whose radius swells by wobble at k bends; pads and patches repeat every lap. */
export type Track={id:string;name:string;place:string;blurb:string;rx:number;rz:number;wobble:number;k:number;phase:number;pads:{s:number;lane:number}[];crate:number;patches:{s:number;lane:number;len:number}[];patch:string;pace:number;sky:string;ground:number;rock:number[];road:number};
export const TRACKS:Track[]=[
 {id:'dust',name:'Dust Valley Circuit',place:'ANDES · DUST VALLEY',blurb:'A wide, friendly oval. Learn the gold strips on the outside line.',rx:38,rz:28,wobble:0,k:1,phase:0,pads:[{s:65,lane:3},{s:145,lane:3},{s:225,lane:3}],crate:45,patches:[],patch:'',pace:1,sky:'#9bbacb',ground:0x9c9871,rock:[0x7c8b95,0x8a8277],road:0x384446},
 {id:'canyon',name:'Moonpebble Canyon',place:'ANDES · MOONPEBBLE CANYON',blurb:'Three sweeping bends and sticky mud. Weave between the patches.',rx:38,rz:29,wobble:.15,k:3,phase:.5,pads:[{s:40,lane:-3},{s:120,lane:3},{s:200,lane:-3}],crate:40,patches:[{s:58,lane:2.5,len:9},{s:95,lane:-2.5,len:9},{s:150,lane:0,len:7},{s:182,lane:3,len:9},{s:222,lane:-1.5,len:8}],patch:'Mud',pace:1,sky:'#e2b08a',ground:0xb98a5c,rock:[0xa45f43,0xc4865a],road:0x4a3a34},
 {id:'frost',name:'Frostwhisker Pass',place:'ANDES · FROSTWHISKER PASS',blurb:'A snowy hourglass with icy puddles. The quickest rivals race here.',rx:40,rz:27,wobble:.12,k:2,phase:1.2,pads:[{s:30,lane:3},{s:90,lane:-3},{s:150,lane:3},{s:210,lane:-3}],crate:48,patches:[{s:48,lane:-2,len:8},{s:76,lane:2.5,len:8},{s:118,lane:0,len:10},{s:168,lane:-3,len:8},{s:192,lane:1.5,len:9}],patch:'Ice',pace:1.02,sky:'#cfe0ea',ground:0xe4ecef,rock:[0xb9cad6,0xdfe8ee],road:0x47525a}];
export const CLASSES={pebble:{name:'Pebble Cup',pace:1.08,blurb:'Gentle rivals. A good first cup.'},boulder:{name:'Boulder Cup',pace:1.27,blurb:'The full field at racing pace.'},summit:{name:'Summit Cup',pace:1.36,blurb:'Fast rivals. Drift, hit the gold strips and dodge every patch.'}};
export type Speed=keyof typeof CLASSES;
export const POINTS=[10,7,5,3,1],YOU='Dora & Enzo';
export function trackPoint(s:number,lane=0,t:Track=TRACKS[0]){const a=s/CIRCUIT*Math.PI*2,q=t.k*a+t.phase,R=1+t.wobble*Math.sin(q),dR=t.wobble*t.k*Math.cos(q),tx=t.rx*(Math.cos(a)*R+Math.sin(a)*dR),tz=t.rz*(-Math.sin(a)*R+Math.cos(a)*dR),d=Math.hypot(tx,tz);return {x:Math.sin(a)*t.rx*R-tz/d*lane,z:Math.cos(a)*t.rz*R+tx/d*lane,tx:tx/d,tz:tz/d}}
/** The patch (mud or ice) under a spot on the circuit, if any. */
export function patchAt(t:Track,s:number,lane:number){const u=((s%CIRCUIT)+CIRCUIT)%CIRCUIT;return t.patches.find(p=>u>=p.s&&u<=p.s+p.len&&Math.abs(lane-p.lane)<1.6)??null}
export class KartGame{
 resumeState:'racing'|'countdown'='racing';
 state:'ready'|'countdown'|'racing'|'paused'|'finished'='ready';countdown=3;s=0;lane=0;speed=0;time=0;boost=0;drift=0;drifting=false;item:Item|null=null;message='';messageTime=0;hitTime=0;serial=0;finishTime=0;finishPlace=0;lastPad=-1;lastCrate=-1;inPatch=false;
 track:Track;
 rivals:Racer[];
 constructor(track=0,speed:Speed='boulder'){this.track=TRACKS[track]??TRACKS[0];const f=this.track.pace*CLASSES[speed].pace;this.rivals=[{name:'Copper Fox',s:5,lane:-3,speed:18.5*f,slow:0,finish:null},{name:'Night Owl',s:9,lane:2,speed:19.2*f,slow:0,finish:null},{name:'Sly Snake',s:13,lane:-1,speed:20*f,slow:0,finish:null},{name:'Mountain Cougar',s:17,lane:3.5,speed:20.7*f,slow:0,finish:null}]}
 get lap(){return Math.min(LAPS,Math.floor(this.s/CIRCUIT)+1)}
 get place(){return this.state==='finished'?this.finishPlace:1+this.rivals.filter(r=>r.s>this.s).length}
 get offroad(){return Math.abs(this.lane)>5.6}
 start(){if(this.state==='ready')this.state='countdown'}
 pause(){if(this.state==='racing'||this.state==='countdown'){this.resumeState=this.state;this.state='paused'}else if(this.state==='paused')this.state=this.resumeState}
 say(s:string){this.message=s;this.messageTime=2}
 /** Finishing order once the race is over: rivals already home, then Dora & Enzo, then the rest by distance. */
 order(){const all=[...this.rivals.map(r=>({name:r.name,key:r.finish!==null&&r.finish<=this.finishTime?r.finish:1e6-r.s})),{name:YOU,key:this.finishTime+1e-9}];return all.sort((a,b)=>a.key-b.key).map(r=>r.name)}
 useItem(){if(this.state!=='racing'||!this.item)return false;const item=this.item;if(item==='boost'){this.boost=Math.max(this.boost,3);this.say('Hay Turbo!')}else if(item==='frost'){const r=this.rivals.filter(r=>r.finish===null&&r.s>this.s).sort((a,b)=>a.s-b.s)[0];if(!r){this.say('No rival ahead. Save your pellet.');return false}r.slow=3;this.say(r.name+' caught a frost pellet!')}else{const targets=this.rivals.filter(r=>r.finish===null&&r.s<this.s&&this.s-r.s<35);if(!targets.length){this.say('No rival close behind. Save your dust.');return false}targets.forEach(r=>r.slow=3);this.say('Dust Bath! Rivals behind are slowed.')}this.item=null;return true}
 step(dt:number,input={gas:false,brake:false,steer:0,drift:false}){dt=Math.min(dt,1/60);if(this.state==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.state='racing';this.say('GO!')}}if(this.state!=='racing')return;this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.boost=Math.max(0,this.boost-dt);this.hitTime=Math.max(0,this.hitTime-dt);
 const t=this.track,patch=patchAt(t,this.s,this.lane);if(patch&&!this.inPatch)this.say(t.patch==='Ice'?'Ice! Hard to steer.':'Mud! Steer around it.');this.inPatch=!!patch;
 const isDrift=input.drift&&Math.abs(input.steer)>.1&&this.speed>8;if(isDrift)this.drift=Math.min(1.5,this.drift+dt);if(this.drifting&&!isDrift){if(this.drift>=.65){this.boost=Math.max(this.boost,1+this.drift*.6);this.say('Drift boost!')}this.drift=0}this.drifting=isDrift;
 const mud=!!patch&&t.patch==='Mud',grip=patch&&t.patch==='Ice'?.35:1,max=this.offroad?11:mud?14:this.boost>0?32:23;this.speed=Math.max(0,Math.min(max,this.speed+(input.brake?-22*grip:input.gas?13:-5)*dt));this.lane=Math.max(-9,Math.min(9,this.lane+input.steer*(isDrift?6.5:4.5)*grip*Math.min(1,this.speed/10)*dt));const old=this.s;this.s+=this.speed*dt;
 for(const r of this.rivals){if(r.finish!==null)continue;r.slow=Math.max(0,r.slow-dt);r.s+=r.speed*(r.slow>0?.7:1)*dt;r.lane=Math.sin(this.time*.4+this.rivals.indexOf(r)*1.8)*3.8;if(r.s>=CIRCUIT*LAPS){r.finish=this.time;r.s=CIRCUIT*LAPS}if(this.hitTime===0&&Math.abs(r.s-this.s)<1.6&&Math.abs(r.lane-this.lane)<1.1){this.speed*=.72;this.hitTime=.8;this.say('Bump! Keep your line.')}}
 const base=Math.floor(this.s/CIRCUIT)*CIRCUIT;for(const p of t.pads){const at=base+p.s;if(at!==this.lastPad&&old<at&&this.s>=at&&Math.abs(this.lane-p.lane)<1.7){this.lastPad=at;this.boost=Math.max(this.boost,1.6);this.say('Boost strip!')}}
 const crate=Math.floor((this.s-30)/t.crate);if(crate>=0&&crate!==this.lastCrate&&old<30+crate*t.crate&&this.s>=30+crate*t.crate&&Math.abs(this.lane)<2.5&&!this.item){this.lastCrate=crate;this.item=(['boost','frost','dust'] as Item[])[this.serial++%3];this.say(ITEMS[this.item].name+' collected · Space to use')}
 if(this.s>=CIRCUIT*LAPS){this.s=CIRCUIT*LAPS;this.finishTime=this.time;this.finishPlace=1+this.rivals.filter(r=>r.finish!==null&&r.finish<=this.time).length;this.state='finished';this.speed=0}
 }
}
/** A cup: the three circuits in order, with points for every finishing place. */
export class KartCup{
 race=0;points:Record<string,number>={};last:string[]=[];
 constructor(public speed:Speed='boulder'){}
 get done(){return this.race>=TRACKS.length}
 game(){return new KartGame(this.race,this.speed)}
 add(order:string[]){if(this.done)return;this.last=order;order.forEach((n,i)=>this.points[n]=(this.points[n]??0)+(POINTS[i]??0));this.race++}
 /** Standings, best first; Dora & Enzo win a tie. */
 standings(){return Object.entries(this.points).sort((a,b)=>b[1]-a[1]||+(b[0]===YOU)-+(a[0]===YOU))}
 get place(){return 1+this.standings().findIndex(([n])=>n===YOU)}
}
/** Saved progress: best race time per circuit and best cup finish per class. */
export type KartSave={best:Record<string,number>;cups:Partial<Record<Speed,number>>};
export const KART_KEY='pawprint-grand-prix-v1';
export function loadKart(raw:string|null):KartSave{try{const v=JSON.parse(raw??'');if(v&&typeof v.best==='object'&&typeof v.cups==='object')return {best:{...v.best},cups:{...v.cups}}}catch{}return {best:{},cups:{}}}
export function recordRace(save:KartSave,track:string,time:number){const old=save.best[track];if(old===undefined||time<old){save.best[track]=time;return true}return false}
export function recordCup(save:KartSave,speed:Speed,place:number){const old=save.cups[speed];if(old===undefined||place<old){save.cups[speed]=place;return true}return false}
