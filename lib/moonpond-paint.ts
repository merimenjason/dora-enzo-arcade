import { POND_CROPS } from './moonpond-crops';
/** Painted layers and isolated atlas cells. Rules, moon phases and animation remain live. */
type Sheet = 'environment' | 'dock' | 'heroes' | 'fishing-heroes' | 'props' | 'umbrella' | 'velvet-crayfish' | `creatures-${number}`;
const grids: Record<string,[number,number]> = { environment:[1,1],dock:[1,1],umbrella:[1,1],'velvet-crayfish':[1,1],heroes:[2,2],'fishing-heroes':[2,2],props:[3,4], 'creatures-0':[4,2], 'creatures-1':[4,2], 'creatures-2':[4,2], 'creatures-3':[4,2], 'creatures-4':[4,2] };
const images = new Map<string,HTMLImageElement>(), cells = new Map<string,HTMLCanvasElement>();
let pending:Promise<void>|null=null, revision=0;
export const pondPaintVersion=()=>revision;
export const pondPaintReady=()=>images.size===Object.keys(grids).length;
export function loadPondPainting():Promise<void>{
 if(pending)return pending;
 pending=Promise.allSettled(Object.keys(grids).map(key=>new Promise<void>((resolve,reject)=>{
  if(images.has(key)){resolve();return;}const image=new Image();image.onload=()=>{images.set(key,image);revision++;resolve();};image.onerror=()=>reject(new Error('Could not load '+key));image.src='/art/moonpond/'+key+'.png';
 }))).then(results=>{if(results.some(r=>r.status==='rejected'))throw new Error('Some Moonpond artwork could not load');for(const [key,[cols,rows]] of Object.entries(grids))if(key!=='environment'&&key!=='dock')for(let i=0;i<cols*rows;i++)cell(key as Sheet,i);}).catch(error=>{pending=null;throw error;});return pending;
}
function cell(sheet:Sheet,index:number){
 const key=sheet+':'+index;if(cells.has(key))return cells.get(key)!;const image=images.get(sheet);if(!image)return null;
 const [cols,rows]=grids[sheet],fallbackW=Math.floor(image.naturalWidth/cols),fallbackH=Math.floor(image.naturalHeight/rows);
 const raw=POND_CROPS[sheet]?.[index]??[index%cols*fallbackW,Math.floor(index/cols)*fallbackH,fallbackW,fallbackH];
 const sx=Math.max(0,raw[0]-32),sy=Math.max(0,raw[1]-32),w=Math.min(image.naturalWidth,raw[0]+raw[2]+32)-sx,h=Math.min(image.naturalHeight,raw[1]+raw[3]+32)-sy;
 const scratch=document.createElement('canvas');scratch.width=w;scratch.height=h;const c=scratch.getContext('2d')!;c.drawImage(image,sx,sy,w,h,0,0,w,h);
 if(sheet==='environment'||sheet==='dock'){cells.set(key,scratch);return scratch;}
 const rgba=c.getImageData(0,0,w,h), pixels=rgba.data;
 // Keep the largest connected silhouette, dropping any neighbouring prop fragment inside its rectangle.
 const visited=new Uint8Array(w*h);let biggest:number[]=[];
 for(let start=0;start<w*h;start++){if(visited[start]||pixels[start*4+3]<=3)continue;const q=[start];visited[start]=1;
  for(let i=0;i<q.length;i++){const n=q[i],x=n%w,y=Math.floor(n/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const at=yy*w+xx;if(!visited[at]&&pixels[at*4+3]>3){visited[at]=1;q.push(at);}}}if(q.length>biggest.length)biggest=q;
 }
 const keep=new Uint8Array(w*h);for(const n of biggest)keep[n]=1;for(let n=0;n<w*h;n++)if(!keep[n])pixels[n*4+3]=0;c.putImageData(rgba,0,0);
 let x0=w,y0=h,x1=0,y1=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x0>=x1||y0>=y1)return null;x0=Math.max(0,x0-3);y0=Math.max(0,y0-3);x1=Math.min(w-1,x1+3);y1=Math.min(h-1,y1+3);
 const cropped=document.createElement('canvas');cropped.width=x1-x0+1;cropped.height=y1-y0+1;cropped.getContext('2d')!.drawImage(scratch,x0,y0,cropped.width,cropped.height,0,0,cropped.width,cropped.height);cells.set(key,cropped);return cropped;
}
/** Centred fit preserves complete tails, fins, antennae and paws. */
export function pondSprite(c:CanvasRenderingContext2D,sheet:Sheet,index:number,x:number,y:number,w:number,h:number){const image=cell(sheet,index);if(!image)return false;const k=Math.min(w/image.width,h/image.height),dw=image.width*k,dh=image.height*k;c.drawImage(image,x-dw/2,y-dh/2,dw,dh);return true;}
export function pondLayer(c:CanvasRenderingContext2D,key:'environment'|'dock',w:number,h:number){const image=images.get(key);if(!image)return false;
 if(key==='environment'){const sw=Math.min(image.naturalWidth,image.naturalHeight*w/h);const bank=image.naturalHeight*.435; c.drawImage(image,(image.naturalWidth-sw)/2,0,sw,bank,0,0,w,h*.36); c.drawImage(image,(image.naturalWidth-sw)/2,bank,sw,image.naturalHeight-bank,0,h*.36,w,h*.64);}else c.drawImage(image,w*.13,h*.56,w*.74,h*.44);return true;}
export const EXTRA_PROPS={ 'glow-bead':6,'clover-knot':7,'dust-puff':8,moon:9,rope:10,umbrella:11 };
export function pondExtra(c:CanvasRenderingContext2D,key:keyof typeof EXTRA_PROPS,x:number,y:number,w:number,h=w){return key==='umbrella'?pondSprite(c,'umbrella',0,x,y,w,h):pondSprite(c,'props',EXTRA_PROPS[key],x,y,w,h);}
export function pondHero(c:CanvasRenderingContext2D,who:'dora'|'enzo',angler:boolean,x:number,feet:number,height:number,time:number,busy=false){
 c.save();c.translate(x,feet);c.rotate(busy?Math.sin(time*5)*.025:Math.sin(time*.7)*.006);
 const good=pondSprite(c,'fishing-heroes',(who==='dora'?0:2)+(angler?0:1),0,-height/2,height*1.25,height);c.restore();return good;
}
export function pondCreature(c:CanvasRenderingContext2D,index:number,x:number,y:number,w:number,h:number){return index===27?pondSprite(c,'velvet-crayfish',0,x,y,w,h):pondSprite(c,`creatures-${Math.floor(index/8)}`,index%8,x,y,w,h);}

export function pondPortrait(c:CanvasRenderingContext2D,who:'dora'|'enzo',w:number,h:number){const image=cell('heroes',who==='dora'?1:3);if(!image)return false;const size=Math.min(image.width,image.height*.62);c.drawImage(image,0,0,size,size,0,0,w,h);return true;}

export function pondWater(c:CanvasRenderingContext2D,w:number,h:number,t:number,motion:boolean){const image=images.get('environment');if(!image||!motion)return;const sw=Math.min(image.naturalWidth,image.naturalHeight*w/h),sx=(image.naturalWidth-sw)/2;c.save();c.globalAlpha=.085;for(let i=0;i<18;i++){const a=i/18,b=(i+1)/18,sy=image.naturalHeight*(.435+.565*a),sh=image.naturalHeight*.565/18;const shift=Math.sin(t*.65+i*1.4)*w*.004*(.3+a);c.drawImage(image,sx,sy,sw,sh,shift,h*(.36+.64*a),w,h*.64*(b-a));}c.restore();}

/** Read-only QA of the effective runtime silhouettes, invoked only by the browser test hook. */
export function pondPaintStats(){const list:{name:string;width:number;height:number;edge:boolean;pixels:number}[]=[];const inspect=(sheet:Sheet,index:number,name:string)=>{const image=cell(sheet,index);if(!image)return;const d=image.getContext('2d')!.getImageData(0,0,image.width,image.height).data;let pixels=0,edge=false;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(d[(y*image.width+x)*4+3]>8){pixels++;if(x===0||y===0||x===image.width-1||y===image.height-1)edge=true;}list.push({name,width:image.width,height:image.height,edge,pixels});};for(let i=0;i<40;i++)inspect(i===27?'velvet-crayfish':`creatures-${Math.floor(i/8)}`,i===27?0:i%8,'creature-'+i);for(let i=0;i<4;i++){inspect('heroes',i,'hero-'+i);inspect('fishing-heroes',i,'fishing-hero-'+i);}for(let i=0;i<11;i++)inspect('props',i,'prop-'+i);inspect('umbrella',0,'umbrella');return list;}
const releasePoints=new Map<string,{x:number;y:number;onDock:boolean}>();
/** Choose open water beside the pier, avoiding not only its planks but its posts and ropes. */
export function pondReleasePoint(w:number,h:number){const key=w+':'+h+':'+revision,old=releasePoints.get(key);if(old)return old;const image=cell('dock',0);let x=w*.21;const y=h*.885;const occupied=(px:number)=>{if(!image)return false;const sx=Math.floor((px-w*.13)/(w*.74)*image.width),sy=Math.floor((y-h*.56)/(h*.44)*image.height);return sx>=0&&sy>=0&&sx<image.width&&sy<image.height&&image.getContext('2d')!.getImageData(sx,sy,1,1).data[3]>24;};for(let i=0;i<15&&occupied(x);i++)x-=w*.012;const point={x,y,onDock:occupied(x)};releasePoints.set(key,point);return point;}
