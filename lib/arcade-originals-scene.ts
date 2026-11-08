import type { Choice, Hero, Spot, View } from './arcade-originals-rules.js';

export type SceneTheme = { open: string; closed: string; hot: string; linked: string };
export type Scene = {
  game:string; theme:SceneTheme; fields:HTMLImageElement[]; dora:HTMLImageElement;
  enzo:HTMLImageElement; objects:HTMLImageElement;
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

const width=432,height=270;
const point=(spot:Spot)=>[Math.round(spot.x*width/100),Math.round(spot.y*height/100)] as const;
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement,i:number,x:number,y:number,flip=false,scale=1){
  c.save();c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);
  c.drawImage(img,(i%4)*48,Math.floor(i/4)*48,48,48,-24*scale,-46*scale,48*scale,48*scale);c.restore();
}
const pose={interact:6,hurt:7,ability:9,victory:11};
function hero(c:CanvasRenderingContext2D,img:HTMLImageElement,who:Hero,spots:Spot[],v:View,old:View,pair:Choice,t:number){
  const [x,y]=point(spots[v[who]]),[a,b]=point(spots[old[who]]);
  const both=v.dora===v.enzo,offset=both?(who==='dora'?-11:11):0;
  const event=who==='dora'?v.doraPose:v.enzoPose;
  if(a!==x||b!==y){
    const n=Math.min(1,t/.86);
    const up=b-y>14,down=y-b>14;
    const i=t>.86?4:up?5:down?3:1+Math.floor(t*9)%2;
    sprite(c,img,t<1?i:0,a+(x+offset-a)*n,b+(y-b)*n-(down?Math.sin(n*Math.PI)*10:0),x<a);
  }else{
    const code=pair[who].split(':')[0];
    const idle=t<.88&&code==='wait'?10:0;
    const frame=event==='ability'&&['brace','patch','rig'].includes(code)&&t<.38?8:event?pose[event]:idle;
    sprite(c,img,frame,x+offset,y,who==='enzo'&&both);
  }
}

export function drawScene(c:CanvasRenderingContext2D,art:Scene,chapter:number,spots:Spot[],v:View,old:View,pair:Choice,t:number){
  c.imageSmoothingEnabled=false;
  c.drawImage(art.fields[chapter],0,0,width,height);
  c.fillStyle='rgba(5,10,18,.15)';c.fillRect(0,0,width,height);
  for(const {edge:[a,b],style} of v.links){
    const [x,y]=point(spots[a]),[j,k]=point(spots[b]);
    c.save();c.beginPath();c.moveTo(x,y);c.lineTo(j,k);c.strokeStyle='#14131b';c.lineWidth=style==='open'?4:5;c.stroke();
    c.strokeStyle=art.theme[style];c.lineWidth=style==='open'?1:2;c.setLineDash(style==='closed'?[2,4]:style==='hot'?[7,3]:[]);c.stroke();c.restore();
  }
  for(const spot of spots){
    const [x,y]=point(spot);c.fillStyle='#17161d';c.fillRect(x-3,y-3,7,7);c.fillStyle=art.theme.open;c.fillRect(x-1,y-1,3,3);
  }
  const count=new Map<number,number>();
  for(const obj of [...v.marks,...v.actors]){
    const n=count.get(obj.at)??0;count.set(obj.at,n+1);
    const [x,y]=point(spots[obj.at]);
    const dx=n===0?20:n===1?-19:30;
    sprite(c,art.objects,obj.art,x+dx,y-1,false,1);
  }
  hero(c,art.dora,'dora',spots,v,old,pair,t);
  hero(c,art.enzo,'enzo',spots,v,old,pair,t);
}
