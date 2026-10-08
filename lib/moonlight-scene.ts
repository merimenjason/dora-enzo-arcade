import { Game, WIDTH, HEIGHT, HOME, CAGE, BOWL, CRATE, GAP, HIDES, type Point, type Hero, type Event } from './moonlight-game';
type C = CanvasRenderingContext2D;
type Sprite = { image: HTMLImageElement; x: number; y: number; w: number; h: number };
const sprites=new Map<string,Sprite>();let village:HTMLImageElement|null=null,loading:Promise<void>|null=null;
function atlas(image:HTMLImageElement,names:string[],cols:number,rows:number) {
  const cv=document.createElement('canvas');cv.width=image.width;cv.height=image.height;const c=cv.getContext('2d')!;c.drawImage(image,0,0);const data=c.getImageData(0,0,cv.width,cv.height).data;
  names.forEach((key,i)=>{const x0=Math.floor(i%cols*image.width/cols),y0=Math.floor(Math.floor(i/cols)*image.height/rows),cw=Math.floor(image.width/cols),ch=Math.floor(image.height/rows);let x=cw,y=ch,r=0,b=0;
    for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++)if(data[((y0+yy)*image.width+x0+xx)*4+3]>24){x=Math.min(x,xx);y=Math.min(y,yy);r=Math.max(r,xx);b=Math.max(b,yy);}if(r>x&&b>y)sprites.set(key,{image,x:x0+x,y:y0+y,w:r-x+1,h:b-y+1});
  });
}
export function loadArt() {
  if(loading)return loading;
  loading=Promise.all(['village','characters','props','details'].map(name=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`Could not load ${name}`));im.src=`/art/moonlight/${name}.png`;}))).then(([v,h,p,d])=>{village=v;atlas(h,['dora0','dora1','dora2','dora3','enzo0','enzo1','enzo2','enzo3'],4,2);atlas(p,['owl','cage','open','treat','dust','hay'],3,2);atlas(d,['portrait-dora','portrait-enzo','barrel','sign'],2,2);const owl=sprites.get('owl')!;sprites.set('owl-ground',{...owl,h:owl.h*.75});if(sprites.size<19)throw new Error('Incomplete artwork');}).catch(e=>{loading=null;throw e;});return loading;
}
function sprite(c:C,key:string,x:number,y:number,w:number,h:number,face=1) {const s=sprites.get(key);if(!s)return;c.save();c.translate(x,y);if(face<0){c.translate(w,0);c.scale(-1,1);}const k=Math.min(w/s.w,h/s.h);c.drawImage(s.image,s.x,s.y,s.w,s.h,(w-s.w*k)/2,h-s.h*k,s.w*k,s.h*k);c.restore();}
function oval(c:C,p:Point,rx:number,ry:number,fill:string){c.fillStyle=fill;c.beginPath();c.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);c.fill();}
function text(c:C,s:string,p:Point,size=14,fill='#fff0cc'){c.font=`600 ${size}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=fill;c.fillText(s,p.x,p.y);}
function badge(c:C,s:string,p:Point,w=65){c.fillStyle='#211829eb';c.strokeStyle='#d9b36b';c.lineWidth=1;c.beginPath();c.roundRect(p.x-w/2,p.y-11,w,22,6);c.fill();c.stroke();text(c,s,p,12);}
export function portrait(c:C,who:'dora'|'enzo',w:number,h:number){c.clearRect(0,0,w,h);sprite(c,'portrait-'+who,0,0,w,h);}
export class Stage {
  motion=typeof window==='undefined'||!window.matchMedia('(prefers-reduced-motion: reduce)').matches;clock=0;effects:(Event&{born:number})[]=[];private footprints:(Point&{born:number;face:number})[]=[];private lastFoot=0;
  feed(events:Event[]) {if(this.motion)this.effects.push(...events.map(e=>({...e,born:this.clock})));this.effects=this.effects.slice(-40);}
  update(dt:number,g:Game){if(!this.motion){this.effects=[];this.footprints=[];return;}if(g.paused||g.state!=='playing')return;this.clock+=Math.min(.1,dt);this.effects=this.effects.filter(e=>this.clock-e.born<(e.t==='distract'?4.5:1.2));this.footprints=this.footprints.filter(p=>this.clock-p.born<3);if(g.hero.moving&&this.clock-this.lastFoot>.2){this.lastFoot=this.clock;this.footprints.push({x:g.hero.x,y:g.hero.y,born:this.clock,face:g.hero.face});}}
  inspect(){return {clock:this.clock,motion:this.motion,effects:this.effects.length};}
  private hero(c:C,h:Hero,selected:boolean){if(h.home)return;c.save();if(h.hidden)c.globalAlpha=.55;oval(c,h,19,5,'#11132066');const move=this.motion&&h.moving,phase=Math.sin(this.clock*12),frame=h.hidden?3:h.dash>0?2:move&&phase>0?1:0,bob=move?Math.abs(phase)*1.8:this.motion?Math.sin(this.clock*2)*.45:0;
    if(selected){c.strokeStyle='#f5d788';c.lineWidth=1.8;c.beginPath();c.ellipse(h.x,h.y+2,23,7,0,0,Math.PI*2);c.stroke();}sprite(c,h.who+frame,h.x-34,h.y-54-bob,68,56,h.face);if(h.dust>0){for(let i=0;i<7;i++)oval(c,{x:h.x+Math.sin(i*3+this.clock)*22,y:h.y-5-i*4},1.2,.8,'#e3d8bc99');}c.restore();if(h.hidden)badge(c,'HIDDEN',{x:h.x,y:h.y-63});}
  draw(c:C,w:number,h:number,dpr:number,g:Game,showPaths:boolean){c.setTransform(dpr*w/WIDTH,0,0,dpr*h/HEIGHT,0,0);c.clearRect(0,0,WIDTH,HEIGHT);if(!village||sprites.size<19)return;c.drawImage(village,0,0,WIDTH,HEIGHT);
    if(g.night){c.fillStyle=g.night===1?'#182c4f12':'#23184922';c.fillRect(0,0,WIDTH,HEIGHT);}
    for(const o of g.owls){if(showPaths){c.save();c.strokeStyle='#efdfbb88';c.lineWidth=1.4;c.setLineDash([4,7]);c.beginPath();o.route.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.stroke();c.restore();}
      const grad=c.createRadialGradient(o.x,o.y,5,o.x,o.y,165);grad.addColorStop(0,o.alarm>.6?'#ff906466':'#f8d67d77');grad.addColorStop(1,'#f8d67d26');c.fillStyle=grad;c.strokeStyle=o.alarm>.6?'#ffb484':'#ffe3a6cc';c.lineWidth=1;c.beginPath();c.moveTo(o.x,o.y);for(let i=0;i<=28;i++){const p=g.ray(o,o.angle-.48+i*.96/28);c.lineTo(p.x,p.y);}c.closePath();c.fill();c.stroke();
    }
    if(this.motion)for(const [x,y,i] of [[185,230,0],[540,320,1],[845,118,2],[730,455,3],[390,510,4],[865,370,5]]){const p={x:x+Math.sin(this.clock*.7+i)*6,y:y+Math.cos(this.clock*.9+i)*4},glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,7);glow.addColorStop(0,`rgba(255,225,134,${.3+Math.sin(this.clock*1.5+i)*.12})`);glow.addColorStop(1,'rgba(255,225,134,0)');c.fillStyle=glow;c.fillRect(p.x-7,p.y-7,14,14);oval(c,p,1,1,'#fff2b7');}
    for(const p of this.footprints){c.save();c.globalAlpha=Math.max(0,1-(this.clock-p.born)/3)*.4;for(const side of [-1,1])oval(c,{x:p.x+side*3,y:p.y+side*2},2,1.5,'#cfae7a');c.restore();}
    if(g.trail.length){c.save();c.strokeStyle='#fce4a4aa';c.lineWidth=1.6;c.setLineDash([3,6]);c.beginPath();c.moveTo(g.hero.x,g.hero.y);g.trail.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.restore();}
    sprite(c,'dust',BOWL.x-42,BOWL.y-24,84,42);HIDES.forEach(p=>sprite(c,'hay',p.x-28,p.y-36,56,40));
    GAP.forEach(p=>{sprite(c,'sign',p.x-11,p.y-30,22,33);});
    for(const t of g.treats)if(!t.taken){const glow=c.createRadialGradient(t.x,t.y-10,0,t.x,t.y-10,30);glow.addColorStop(0,'#ffe89b40');glow.addColorStop(1,'#ffe89b00');c.fillStyle=glow;c.fillRect(t.x-30,t.y-40,60,60);sprite(c,'treat',t.x-14,t.y-28,28,32);text(c,'✧',{x:t.x+19,y:t.y-28},16);}
    sprite(c,g.rescued?'open':'cage',CAGE.x-41,CAGE.y-67,82,74);if(!g.rescued)badge(c,'RESCUE',{x:CAGE.x,y:CAGE.y-75},72);
    const push=this.effects.findLast(e=>e.t==='push'),t=g.pushed?push?Math.min(1,(this.clock-push.born)/.55):1:0,ease=t*t*(3-2*t);sprite(c,'barrel',CRATE.x-30+ease*43,CRATE.y-30+ease*16,60,42);if(!g.pushed)badge(c,'PUSH',{x:CRATE.x,y:CRATE.y-38},52);
    const actors:{y:number;draw:()=>void}[]=g.heroes.map(h=>({y:h.y,draw:()=>this.hero(c,h,h.who===g.active)}));
    for(const o of g.owls)actors.push({y:o.y,draw:()=>{oval(c,o,16,5,'#17102266');sprite(c,'owl-ground',o.x-24,o.y-52,48,54,Math.cos(o.angle)<0?-1:1);if(o.alarm>0){badge(c,o.alarm>.65?'!':'?',{x:o.x,y:o.y-75},24);c.strokeStyle='#ffbc78';c.lineWidth=3;c.beginPath();c.arc(o.x,o.y-40,28,-Math.PI/2,-Math.PI/2+o.alarm*Math.PI*2);c.stroke();}else if(o.curious)text(c,'?',{x:o.x,y:o.y-77},25);}});
    if(g.friend&&!g.friendHome){const p=g.friend;actors.push({y:p.y,draw:()=>sprite(c,'enzo1',p.x-21,p.y-32,42,34)});}actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
    badge(c,'HOME',{x:HOME.x,y:HOME.y-54},66);
    if(g.target) {c.strokeStyle='#f8dfa2';c.lineWidth=2;c.beginPath();c.arc(g.target.x,g.target.y,8,0,Math.PI*2);c.stroke();}
    for(const e of this.effects){const age=this.clock-e.born;c.save();c.globalAlpha=Math.max(0,1-age/(e.t==='distract'?4.5:1.2));if(e.t==='dust'){for(let i=0;i<18;i++){const r=age*(15+i);oval(c,{x:e.x+Math.cos(i*2.4)*r,y:e.y-10+Math.sin(i*2.4)*r*.4-age*7},1.2,.9,'#e5d8ba');}}else if(e.t==='treat')text(c,'+1',{x:e.x,y:e.y-35-age*25},18);else if(e.t==='distract'){c.strokeStyle='#f7d483';c.lineWidth=2;c.beginPath();if(age<1){c.ellipse(e.x,e.y,age*65,age*22,0,0,Math.PI*2);c.stroke();}for(let i=0;i<4;i++)for(const side of [-1,1]){const p={x:e.x+(i-2)*7,y:e.y+side*3};oval(c,p,2,1.5,'#f7d483');}}else if(['rescue','gap','home'].includes(e.t)){for(let i=0;i<9;i++){const a=i*Math.PI*2/9,r=8+age*26;text(c,'✧',{x:e.x+Math.cos(a)*r,y:e.y-24+Math.sin(a)*r*.6},9);}}else if(e.t==='alert')text(c,'!',{x:e.x,y:e.y-70-age*6},22,'#ffc098');c.restore();}
    // Legends stay compact on phones; each gameplay marker has an accessible equivalent below the map.
    const sw=Math.max(135,1000/w*88);c.fillStyle='#241b2ee8';c.strokeStyle='#c29d65';c.lineWidth=1;c.beginPath();c.roundRect(16,16,sw,42,6);c.fill();c.stroke();text(c,`TREATS  ${g.collected} / ${g.treats.length}`,{x:16+sw/2,y:37},Math.max(15,1000/w*11));
  }
}
