export type Block={x:number;z:number;w:number;d:number;h:number};
export type Floor={blocks:Block[];spawns:{x:number;z:number;type:number}[];name:string;seed:number};
export function random(seed:number){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export function generateFloor(seed:number,depth:number):Floor{
 const roll=random((seed+Math.imul(depth+1,2654435761))>>>0),blocks:Block[]=[];
 // Two dividing walls with broad, independently placed doorways make three connected rooms.
 for(const z of [-4,2]){const gap=Math.floor(roll()*13)-6,half=2.25;
  const left=gap-half+12,right=12-gap-half;
  if(left>.5)blocks.push({x:-12+left/2,z,w:left,d:.7,h:1.35});
  if(right>.5)blocks.push({x:gap+half+right/2,z,w:right,d:.7,h:1.35});
 }
 // Low crypt furniture changes cover without closing the outer passageways.
 for(const z of [-8,-1,5]){const x=(roll()>.5?1:-1)*(8+Math.floor(roll()*2));blocks.push({x,z,w:1.1+roll()*.6,d:1.1,h:.8+roll()*.65})}
 const free=(x:number,z:number,r=.95)=>Math.abs(x)<11&&Math.abs(z)<11&&!blocks.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);
 const reachable=new Set<string>(),queue=[{x:0,z:8}];reachable.add('0,8');for(let i=0;i<queue.length;i++){const p=queue[i];for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,k=x+','+z;if(!reachable.has(k)&&free(x,z)){reachable.add(k);queue.push({x,z})}}}
 const candidates=queue.filter(p=>p.z<6&&Math.hypot(p.x,p.z-8)>4&&Math.hypot(p.x,p.z+9.8)>2);
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(roll()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
 const spawns:Floor['spawns']=[];for(const p of candidates){if(spawns.every(e=>Math.hypot(e.x-p.x,e.z-p.z)>2.2))spawns.push({...p,type:roll()<.3?1:0});if(spawns.length>=9+Math.min(6,depth))break}
 if((depth+1)%3===0)spawns.push({x:0,z:-9.8,type:2});
 const prefixes=['Hollow','Forgotten','Ashen','Sunken','Moonlit','Shattered'],names=['Warrens','Catacombs','Vaults','Crypt','Dustworks','Burrows'];
 return {blocks,spawns,name:prefixes[Math.floor(roll()*prefixes.length)]+' '+names[Math.floor(roll()*names.length)],seed:(seed+Math.imul(depth+1,2654435761))>>>0};
}
