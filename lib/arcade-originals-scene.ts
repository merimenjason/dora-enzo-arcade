import type { Choice, Edge, Hero, Spot, View } from './arcade-originals-rules.js';

export type SceneTheme = { open: string; closed: string; hot: string; linked: string };
export type Scene = {
  game:string; theme:SceneTheme; fields:HTMLImageElement[]; dora:HTMLImageElement;
  enzo:HTMLImageElement; objects:HTMLImageElement;
};
/** What the board shows on top of the rules' view: whose move is being picked, where they can go, and the plan so far. */
export type Overlay = {
  active?:Hero; targets?:number[]; edgeTargets?:Edge[];
  plans?:{hero:Hero;from:number;to:number;edge?:Edge}[];
  /** the hero who moves first in a turn (the other follows a beat later) */
  first?:Hero; now?:number;
};
export function loadScene(game:string,theme:SceneTheme):Promise<Scene>{
  const get=(name:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
    const art=new Image();
    art.onload=()=>resolve(art);art.onerror=()=>reject(new Error(`Could not load ${name}`));
    art.src=`/art/${game}/${name}`;
  });
  return Promise.all([get('dora.png'),get('enzo.png'),get('objects.png'),
    ...[0,1,2,3].map(i=>get(`field-${i}.webp`))]).then(([dora,enzo,objects,...fields])=>({game,theme,fields,dora,enzo,objects}));
}

const width=432,height=270,HERO_SCALE=1.35;
const tint={dora:'#ffc98f',enzo:'#9fdcff'};
const point=(spot:Spot)=>[Math.round(spot.x*width/100),Math.round(spot.y*height/100)] as const;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const sameEdge=([a,b]:Edge,[c,d]:Edge)=>(a===c&&b===d)||(a===d&&b===c);
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement,i:number,x:number,y:number,flip=false,scale=1){
  c.save();c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);
  c.drawImage(img,(i%4)*48,Math.floor(i/4)*48,48,48,-24*scale,-46*scale,48*scale,48*scale);c.restore();
}
const pose={interact:6,hurt:7,ability:9,victory:11};
// t is this hero's own share of the turn animation (0 → 1), so the two heroes take turns on the board
function hero(c:CanvasRenderingContext2D,img:HTMLImageElement,who:Hero,spots:Spot[],v:View,old:View,pair:Choice,t:number){
  const [x,y]=point(spots[v[who]]),[a,b]=point(spots[old[who]]);
  const both=v.dora===v.enzo,offset=both?(who==='dora'?-13:13):0;
  const event=who==='dora'?v.doraPose:v.enzoPose;
  if(a!==x||b!==y){
    const n=clamp(t/.9);
    const up=b-y>14,down=y-b>14;
    const i=t>=1?0:t>.9?4:up?5:down?3:1+Math.floor(t*12)%2;
    sprite(c,img,i,a+(x+offset-a)*n,b+(y-b)*n-Math.sin(n*Math.PI)*(down?12:4),x<a,HERO_SCALE);
  }else{
    const code=pair[who].split(':')[0];
    const idle=t<.88&&code==='wait'?10:0;
    const frame=event==='ability'&&['brace','patch','rig','plug'].includes(code)&&t<.5?8:event&&t>0?pose[event]:idle;
    sprite(c,img,frame,x+offset,y-(event==='victory'&&t>0?Math.abs(Math.sin(t*Math.PI*3))*5:0),who==='enzo'&&both,HERO_SCALE);
  }
}
function arrow(c:CanvasRenderingContext2D,[x,y]:readonly [number,number],[j,k]:readonly [number,number],color:string,now:number){
  const d=Math.hypot(j-x,k-y);if(d<4)return;
  const ux=(j-x)/d,uy=(k-y)/d,ex=j-ux*10,ey=k-uy*10;
  c.save();c.strokeStyle='#14131b';c.lineWidth=5;c.beginPath();c.moveTo(x,y-14);c.lineTo(ex,ey-14);c.stroke();
  c.strokeStyle=color;c.lineWidth=2;c.setLineDash([5,4]);c.lineDashOffset=-now*24;c.stroke();c.setLineDash([]);
  c.fillStyle=color;c.beginPath();c.moveTo(j-ux,k-uy-14);c.lineTo(ex-uy*5,ey+ux*5-14);c.lineTo(ex+uy*5,ey-ux*5-14);c.closePath();c.fill();c.restore();
}
// a pulsing ring with a bobbing chevron over it, so a pickable spot reads at a glance even on a busy painting
function ring(c:CanvasRenderingContext2D,x:number,y:number,color:string,now:number,r=13){
  const p=(Math.sin(now*5)+1)/2,rr=r+p*3;
  c.save();c.fillStyle=color;c.globalAlpha=.18+p*.12;c.beginPath();c.ellipse(x,y,rr,rr*.55,0,0,Math.PI*2);c.fill();
  c.globalAlpha=1;c.strokeStyle='#14131b';c.lineWidth=5;c.stroke();c.strokeStyle=color;c.lineWidth=2.5;c.stroke();
  const cy=y-34-p*4;c.fillStyle='#14131b';c.beginPath();c.moveTo(x-7,cy-2);c.lineTo(x+7,cy-2);c.lineTo(x,cy+8);c.closePath();c.fill();
  c.fillStyle=color;c.beginPath();c.moveTo(x-5,cy);c.lineTo(x+5,cy);c.lineTo(x,cy+6);c.closePath();c.fill();c.restore();
}
function diamond(c:CanvasRenderingContext2D,x:number,y:number,color:string,now:number){
  const s=6+(Math.sin(now*5)+1)*1.5;
  c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#14131b';c.fillRect(-s-2,-s-2,2*s+4,2*s+4);c.fillStyle=color;c.fillRect(-s,-s,2*s,2*s);c.restore();
}

export function drawScene(c:CanvasRenderingContext2D,art:Scene,chapter:number,spots:Spot[],v:View,old:View,pair:Choice,t:number,o:Overlay={}){
  const now=o.now??0,first=o.first??'dora',second:Hero=first==='dora'?'enzo':'dora';
  c.imageSmoothingEnabled=false;
  c.drawImage(art.fields[chapter],0,0,width,height);
  c.fillStyle='rgba(5,10,18,.15)';c.fillRect(0,0,width,height);
  // the world answers once both heroes have acted: a span that just gave way flashes and crumbles
  const world=clamp((t-.7)/.3);
  for(const {edge,style} of v.links){
    const [a,b]=edge,[x,y]=point(spots[a]),[j,k]=point(spots[b]);
    const was=old.links.find(l=>sameEdge(l.edge,edge))?.style;
    const shown=style==='closed'&&was!=='closed'&&world<1?(world>0?'hot':was??'open'):style;
    const shake=shown==='hot'?Math.sin(now*40)*1.2:0;
    c.save();c.translate(0,shake);c.beginPath();c.moveTo(x,y);c.lineTo(j,k);c.strokeStyle='#14131b';c.lineWidth=shown==='open'?4:5;c.stroke();
    c.strokeStyle=art.theme[shown];c.lineWidth=shown==='open'?1:2;c.setLineDash(shown==='closed'?[2,4]:shown==='hot'?[7,3]:[]);c.stroke();c.restore();
    if(style==='closed'&&was!=='closed'&&world>0&&world<1){
      c.save();c.fillStyle=art.theme.closed;
      for(let n=0;n<9;n++){
        const f=(n+.5)/9,px=x+(j-x)*f+Math.sin(n*7.1)*4,py=y+(k-y)*f+world*world*36+n%3*3;
        c.globalAlpha=1-world;c.fillRect(Math.round(px),Math.round(py),2,2);
      }
      c.restore();
    }
    if(style==='linked'&&old.links.find(l=>sameEdge(l.edge,edge))?.style!=='linked'&&t<1){
      c.save();c.globalAlpha=1-t;c.strokeStyle=art.theme.linked;c.lineWidth=6;c.beginPath();c.moveTo(x,y);c.lineTo(j,k);c.stroke();c.restore();
    }
  }
  for(const spot of spots){
    const [x,y]=point(spot);c.fillStyle='#17161d';c.fillRect(x-3,y-3,7,7);c.fillStyle=art.theme.open;c.fillRect(x-1,y-1,3,3);
  }
  const count=new Map<number,number>();
  for(const obj of [...v.marks,...v.actors]){
    const n=count.get(obj.at)??0;count.set(obj.at,n+1);
    const [x,y]=point(spots[obj.at]);
    const dx=n===0?22:n===1?-21:32;
    sprite(c,art.objects,obj.art,x+dx,y-1,false,1);
  }
  // planning: where each hero is headed, and what the selected hero may pick
  for(const p of o.plans??[]){
    if(p.edge){const [a,b]=p.edge,[x,y]=point(spots[a]),[j,k]=point(spots[b]);
      c.save();c.strokeStyle=tint[p.hero];c.globalAlpha=.55+.3*Math.sin(now*5);c.lineWidth=5;c.beginPath();c.moveTo(x,y);c.lineTo(j,k);c.stroke();c.restore();}
    else if(p.to!==p.from)arrow(c,point(spots[p.from]),point(spots[p.to]),tint[p.hero],now);
  }
  if(o.active){
    for(const s of o.targets??[]){const [x,y]=point(spots[s]);ring(c,x,y,tint[o.active],now);}
    for(const [a,b] of o.edgeTargets??[]){const [x,y]=point(spots[a]),[j,k]=point(spots[b]);diamond(c,(x+j)/2,(y+k)/2,tint[o.active],now);}
    const [x,y]=point(spots[v[o.active]]),both=v.dora===v.enzo;
    c.save();c.fillStyle=tint[o.active];c.globalAlpha=.35;c.beginPath();c.ellipse(x+(both?(o.active==='dora'?-13:13):0),y+1,16,5,0,0,Math.PI*2);c.fill();c.restore();
  }
  hero(c,art[second],second,spots,v,old,pair,clamp((t-.3)/.45));
  hero(c,art[first],first,spots,v,old,pair,clamp(t/.45));
}
