import {Game,WIDTH,HEIGHT,RADIUS,BUMPERS,TARGETS,BURROWS,FLIPPERS,SLINGS,LAUNCH,type Ev} from './pinball-game';
type C=CanvasRenderingContext2D;type Sprite={image:HTMLImageElement;x:number;y:number;w:number;h:number};
const sprites=new Map<string,Sprite>();let table:HTMLImageElement|null=null,promise:Promise<void>|null=null;
export function loadArt(){if(promise)return promise;promise=Promise.all(['table','pieces'].map(name=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`Cannot load ${name}`));im.src=`/art/pinball/${name}.png`;}))).then(([t,p])=>{table=t;const cv=document.createElement('canvas');cv.width=p.width;cv.height=p.height;const c=cv.getContext('2d')!;c.drawImage(p,0,0);const px=c.getImageData(0,0,p.width,p.height).data;
 const regions:[string,number,number,number,number][]=[['bumper',0,0,510,515],['flipper',520,150,675,285],['gold',1220,120,316,390],['moon',0,545,420,479],['dora',420,515,550,509],['enzo',980,515,556,509]];
 for(const [key,x0,y0,w,h] of regions){let x=w,y=h,r=0,b=0;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(px[((y0+yy)*p.width+x0+xx)*4+3]>24){x=Math.min(x,xx);y=Math.min(y,yy);r=Math.max(r,xx);b=Math.max(b,yy);}if(r>x&&b>y)sprites.set(key,{image:p,x:x0+x,y:y0+y,w:r-x+1,h:b-y+1});}if(sprites.size<6)throw new Error('Incomplete pinball artwork');
 }).catch(e=>{promise=null;throw e;});return promise;}
function sprite(c:C,key:string,x:number,y:number,w:number,h:number){const s=sprites.get(key);if(!s)return;const k=Math.min(w/s.w,h/s.h);c.drawImage(s.image,s.x,s.y,s.w,s.h,x+(w-s.w*k)/2,y+h-s.h*k,s.w*k,s.h*k);}
function glow(c:C,x:number,y:number,r:number,color:string){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(255,215,110,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function text(c:C,t:string,x:number,y:number,size=16,color='#ffedb9'){c.font=`600 ${size}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(t,x,y);}
export function graphic(c:C,key:'moon'|'burrow',w:number,h:number){c.clearRect(0,0,w,h);if(key==='burrow'&&table)c.drawImage(table,table.width*.13,table.height*.025,table.width*.25,table.height*.23,0,0,w,h);else sprite(c,key,0,0,w,h);}
export function portrait(c:C,who:'dora'|'enzo',w:number,h:number){c.clearRect(0,0,w,h);sprite(c,who,0,0,w,h);}
/** The painted plunger, in table units: the cap and its collar (`top` to `collar`) slide down by up to `travel`, squashing the spring (`collar` to `spring`); `lane` is how much of the lane above stretches to fill in behind. */
const PLUNGER={x:904,w:64,top:640,collar:708,spring:808,travel:40,lane:70};
/** Where the painted lanterns are, for their flicker. */
const LANTERNS=[[110,125],[357,147],[880,110],[930,255],[210,362],[210,585],[800,590],[32,512],[275,835],[742,835],[85,840]];
const ring=(c:C,x:number,y:number,r:number,color:string,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(0,r),0,Math.PI*2);c.stroke();};
export class Stage{
 motion=typeof window==='undefined'||!matchMedia('(prefers-reduced-motion: reduce)').matches;clock=0;effects:(Ev&{born:number})[]=[];private tails=new Map<number,{x:number;y:number}[]>();
 /** How far each berry has rolled, as a turn of its sprite, and how far the plunger is drawn back (0 to 1). */
 private spin=new Map<number,number>();private pull=0;
 feed(events:Ev[]){if(this.motion)this.effects.push(...events.map(e=>({...e,born:this.clock})));this.effects=this.effects.slice(-60);}
 update(dt:number,g:Game){const drawn=g.state==='ready'?g.charge:0;
  // The plunger follows the charge even with motion reduced: it is the launch gauge. Only its spring back is an animation.
  if(!this.motion){this.pull=drawn;this.effects=[];this.tails.clear();this.spin.clear();return;}if(g.paused||g.state==='over')return;const step=Math.min(.1,dt);this.clock+=step;this.pull=drawn>=this.pull?drawn:Math.max(drawn,this.pull-step*13);this.effects=this.effects.filter(e=>this.clock-e.born<.8);const ids=new Set(g.balls.map(b=>b.id));for(const id of this.tails.keys())if(!ids.has(id)){this.tails.delete(id);this.spin.delete(id);}
  for(const b of g.balls){const t=this.tails.get(b.id)||[];t.push({x:b.x,y:b.y});if(t.length>10)t.shift();this.tails.set(b.id,t);const last=t.at(-2);if(last){const dx=b.x-last.x,dy=b.y-last.y;this.spin.set(b.id,(this.spin.get(b.id)||0)+Math.sign(dx||dy)*Math.min(40,Math.hypot(dx,dy))/RADIUS*.6);}}}
 inspect(){return{clock:this.clock,motion:this.motion,trails:this.tails.size,effects:this.effects.length,pull:this.pull};}
 private since(t:Ev['t']){const e=this.effects.findLast(f=>f.t===t);return e?this.clock-e.born:9;}
 /** Redraws the plunger pulled back, from the painting itself: the lane above the cap stretches down to follow it, the cap and its collar (with the brackets that ride the rails) move down, and the spring squashes into what is left. */
 private plunger(c:C){const d=this.pull*PLUNGER.travel;if(d<.25||!table)return;const k=table.width/WIDTH,{x,w,top,collar,spring,lane}=PLUNGER;c.drawImage(table,x*k,(top-lane)*k,w*k,lane*k,x,top-lane,w,lane+d);c.drawImage(table,x*k,collar*k,w*k,(spring-collar)*k,x,collar+d,w,spring-collar-d);c.drawImage(table,x*k,top*k,w*k,(collar-top)*k,x,top+d,w,collar-top);}
 draw(c:C,w:number,h:number,dpr:number,g:Game){c.setTransform(dpr*w/WIDTH,0,0,dpr*h/HEIGHT,0,0);c.clearRect(0,0,WIDTH,HEIGHT);if(!table||sprites.size<6)return;const live=this.motion,now=this.clock;
  // A nudge rocks the table and a tilt rocks it harder.
  const tilted=this.since('tilt'),nudged=Math.min(this.since('nudge'),tilted);if(live&&nudged<.3)c.translate(Math.sin(nudged*70)*(tilted<.3?6:3)*(1-nudged/.3),Math.cos(nudged*55)*1.5*(1-nudged/.3));
  c.drawImage(table,0,0,WIDTH,HEIGHT);this.plunger(c);
  if(live){c.save();c.globalCompositeOperation='lighter';LANTERNS.forEach(([x,y],i)=>{const flicker=.5+.5*Math.sin(now*(5.3+i*.7)+i*2.1)*Math.sin(now*(2.1+i*.3)+i);glow(c,x,y,30+flicker*8,`rgba(255,196,96,${.07+flicker*.09})`);});
   // Fireflies drift over the table on slow loops.
   for(let i=0;i<8;i++){const x=500+Math.sin(now*(.11+i*.017)+i*1.9)*430,y=470+Math.cos(now*(.09+i*.021)+i*2.7)*400,blink=Math.max(0,Math.sin(now*(1.3+i*.21)+i*4));glow(c,x,y,9,`rgba(214,255,150,${blink*.5})`);c.fillStyle=`rgba(240,255,200,${blink*.8})`;c.fillRect(x-.8,y-.8,1.6,1.6);}c.restore();}
  for(const p of BUMPERS){const hit=this.effects.findLast(e=>e.t==='bumper'&&Math.hypot(e.x-p.x,e.y-p.y)<3),age=hit?now-hit.born:1;glow(c,p.x,p.y,70,age<.45?`rgba(255,224,124,${(.45-age)*.8})`:'rgba(255,218,114,.09)');const bounce=live&&age<.3?Math.sin(age/.3*Math.PI)*4:0;sprite(c,'bumper',p.x-54-bounce,p.y-62-bounce,108+bounce*2,114+bounce*2);if(live&&age<.45)ring(c,p.x,p.y,p.r+age*70,`rgba(255,232,150,${(.45-age)*1.6})`,3);}
  // Each brass stud on the stone wall lights the burrow window above it.
  const beat=live?.5+.5*Math.sin(now*5):.5,lamp=(p:{x:number;y:number},r:number,lit:boolean)=>{const grad=c.createRadialGradient(p.x-r*.3,p.y-r*.3,1,p.x,p.y,r+1);grad.addColorStop(0,lit?'#fff5c7':'#5d4224');grad.addColorStop(.6,lit?'#efb437':'#2b1a0c');grad.addColorStop(1,'#8e622f');c.fillStyle=grad;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();if(lit)glow(c,p.x,p.y,r*(1.5+beat*.5),`rgba(255,207,85,${.2+beat*.14})`);};
  BURROWS.forEach((p,i)=>lamp(p,17,g.lamps[i]));TARGETS.forEach((p,i)=>{lamp(p,p.r,g.lamps[i]);c.strokeStyle='#e9c77c';c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,p.r-.75,0,Math.PI*2);c.stroke();});
  // A struck cushion flashes and bulges out from its face.
  if(live)for(const e of this.effects){if(e.t!=='sling')continue;const a=now-e.born;if(a>.28)continue;const [x,y,x2,y2]=SLINGS[e.x<500?0:1],len=Math.hypot(x2-x,y2-y),side=e.x<500?1:-1,out=Math.sin(a/.28*Math.PI)*9,nx=side*Math.abs(y2-y)/len,ny=-Math.abs(x2-x)/len;c.save();c.lineCap='round';c.strokeStyle=`rgba(255,236,170,${1-a/.28})`;c.lineWidth=6;c.shadowColor='#ffd978';c.shadowBlur=14;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo((x+x2)/2+nx*out*2,(y+y2)/2+ny*out*2,x2,y2);c.stroke();c.restore();}
  for(let i=0;i<2;i++){const f=FLIPPERS[i],s=sprites.get('flipper')!;c.save();c.translate(f.x,f.y);c.rotate(g.angles[i]);const sourceAngle=Math.atan2(55,485),k=f.length/Math.hypot(485,55);c.rotate(-sourceAngle);c.scale(k,k);c.shadowColor='#110b08aa';c.shadowBlur=15;c.shadowOffsetY=15;c.drawImage(s.image,s.x,s.y,s.w,s.h,s.x-630,s.y-250,s.w,s.h);c.restore();}
  if(g.state==='ready'){const y=LAUNCH.y+this.pull*PLUNGER.travel;if(live&&g.charge>0)glow(c,LAUNCH.x,y,16+g.charge*16,`rgba(255,214,120,${.12+g.charge*.3})`);sprite(c,'gold',LAUNCH.x-15,y-18+(live&&g.charge>.85?Math.sin(now*60)*.8:0),30,33);c.fillStyle='#ffd98e';c.fillRect(915,955,20,3+g.charge*26);}
  for(const b of g.balls){const trail=this.tails.get(b.id)||[];if(live&&trail.length>1){c.save();c.lineWidth=3;c.lineCap='round';for(let i=1;i<trail.length;i++){c.strokeStyle=b.moon?`rgba(213,147,255,${i/trail.length*.35})`:`rgba(255,212,116,${i/trail.length*.45})`;c.beginPath();c.moveTo(trail[i-1].x,trail[i-1].y);c.lineTo(trail[i].x,trail[i].y);c.stroke();}c.restore();}glow(c,b.x,b.y,24,b.moon?'rgba(201,139,255,.2)':'rgba(255,217,117,.2)');
   // On a ramp the berry is raised: a little larger, with its shadow left on the boards. Everywhere it turns as it rolls.
   const lift=b.rail?1.14:1;if(b.rail){c.fillStyle='rgba(12,7,5,.3)';c.beginPath();c.ellipse(b.x+4,b.y+9,10,5,0,0,Math.PI*2);c.fill();}c.save();c.translate(b.x,b.y);c.rotate(this.spin.get(b.id)||0);c.scale(lift,lift);sprite(c,b.moon?'moon':'gold',-15,-18,30,33);c.restore();}
  for(const e of this.effects){const a=now-e.born;c.save();c.globalAlpha=Math.max(0,1-a/.8);if(e.n&&['bumper','sling','target','ramp','rescue'].includes(e.t))text(c,`+${e.n.toLocaleString()}`,e.x,e.y-25-a*30,e.t==='rescue'?24:16);if(['bumper','rescue','multiball'].includes(e.t)){for(let i=0;i<9;i++){const angle=i*Math.PI*2/9,r=20+a*50;text(c,'✧',e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r*.65,11);}}if(e.t==='dust'||e.t==='lock'){for(let i=0;i<15;i++){c.fillStyle='#e6d7b6';c.beginPath();c.ellipse(767+Math.cos(i*2.4)*a*(15+i),175+Math.sin(i*2.4)*a*(8+i),1.7,1.1,0,0,Math.PI*2);c.fill();}}
   if(e.t==='target')ring(c,e.x,e.y,12+a*45,'#ffe9a8',2.5);if(e.t==='ramp')for(let i=0;i<2;i++)ring(c,e.x,e.y,8+a*(40+i*30),'#ffe1a0',2);if(e.t==='rescue')for(let i=0;i<3;i++)ring(c,e.x,e.y,20+a*(90+i*45),'#fff0bd',3);
   // A launch throws sparks off the plunger; a drain ripples at the slot; a saved berry comes back up a streak of light.
   if(e.t==='launch')for(let i=0;i<10;i++){const angle=-Math.PI/2+(i-4.5)*.2,r=10+a*(120+i%3*40);c.fillStyle='#ffe7a6';c.fillRect(LAUNCH.x+Math.cos(angle)*r-1,LAUNCH.y+10+Math.sin(angle)*r-1+a*a*90,2,2);}
   if(e.t==='drain')for(let i=0;i<3;i++)ring(c,500,925,6+a*(34+i*22),'#c9b79a',2);
   if(e.t==='save'){const grad=c.createLinearGradient(0,930,0,930-a*420);grad.addColorStop(0,'rgba(255,232,160,.8)');grad.addColorStop(1,'rgba(255,232,160,0)');c.fillStyle=grad;c.fillRect(494,930-a*420,12,a*420);text(c,'SAVED',500,890-a*40,18);}
   c.restore();}
  const flash=this.since('multiball');if(live&&flash<.7){c.fillStyle=`rgba(190,120,255,${(.7-flash)*.45})`;c.fillRect(0,0,WIDTH,HEIGHT);}
  const swell=live?1+.04*Math.sin(now*6):1;if(g.multiball)text(c,'MOONBERRY MULTIBALL · DOUBLE POINTS',500,575,22*swell,'#e6c0ff');else if(g.combo>1&&g.comboUntil>g.time)text(c,`${g.combo}× BUMPER COMBO`,500,585,20*swell);
  if(g.time<g.saveUntil&&g.state==='play')text(c,`BALL SAVE ${Math.ceil(g.saveUntil-g.time)}s`,500,920,16);
  if(g.time<g.tiltUntil)text(c,`TILT · ${Math.ceil(g.tiltUntil-g.time)}s`,500,600,25,'#ffc1a4');
 }
}
