import * as T from 'three';
import {ORBS,type OrbKind} from './pit-game';
const sphere=new T.SphereGeometry(1,10,8),rock=new T.IcosahedronGeometry(1,0),cone=new T.ConeGeometry(1,1,8),box=new T.BoxGeometry(1,1,1),stem=new T.CylinderGeometry(1,1,1,8),cap=new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI/2);
/** Shared multipart projectile miniatures; all are readable from the overhead camera. */
export function weaponIcons(){const icons={} as Record<OrbKind,T.Group>;
 for(const kind of Object.keys(ORBS) as OrbKind[]){const g=new T.Group();const main=new T.MeshStandardMaterial({color:ORBS[kind].color,roughness:.5,emissive:ORBS[kind].color,emissiveIntensity:.22}),dark=new T.MeshStandardMaterial({color:0x715035,roughness:.8}),light=new T.MeshStandardMaterial({color:0xffedc8,emissive:0xffd995,emissiveIntensity:.18});
 const add=(geo:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o};
 const nut=()=>{add(sphere,main,0,0,.04,.19,.15,.26);const c=add(cap,dark,0,.02,-.1,.21,.18,.21);c.rotation.x=-Math.PI/2;add(stem,dark,0,0,-.3,.035,.15,.035).rotation.x=Math.PI/2};
 const mushroom=()=>{add(stem,light,0,0,0,.07,.27,.07);add(cap,main,0,.13,0,.26,.16,.26);for(const [x,z]of [[-.1,0],[.09,.08],[0,-.12]])add(sphere,light,x,.24,z,.045,.018,.045)};
 const bolt=(x=0,z=0,scale=1)=>{const s=new T.Shape();s.moveTo(-.03,-.4);s.lineTo(-.22,.06);s.lineTo(-.035,.02);s.lineTo(-.08,.4);s.lineTo(.23,-.1);s.lineTo(.035,-.045);s.closePath();const mesh=add(new T.ExtrudeGeometry(s,{depth:.07,bevelEnabled:false}),main,x,.04,z,scale,scale,scale);mesh.rotation.x=Math.PI/2};
 if(kind==='seed'){add(sphere,main,0,0,0,.12,.10,.3);add(box,dark,0,.10,0,.025,.018,.43);add(cone,light,0,0,-.29,.065,.14,.065).rotation.x=-Math.PI/2}
 if(kind==='stone'){add(rock,main,0,0,0,.26,.18,.25);add(rock,light,.11,.11,-.04,.09,.07,.11)}
 if(kind==='frost'){for(let i=0;i<6;i++){const a=i*Math.PI/3;const o=add(box,main,Math.sin(a)*.15,0,Math.cos(a)*.15,.045,.065,.32);o.rotation.y=a;add(rock,light,Math.sin(a)*.3,0,Math.cos(a)*.3,.065,.055,.065)}add(rock,light,0,0,0,.11,.1,.11)}
 if(kind==='spark')bolt();
 if(kind==='spore'||kind==='leech'||kind==='tempest'){mushroom();if(kind==='leech'){for(const x of [-1,1]){const w=add(cone,main,x*.26,.08,0,.18,.28,.065);w.rotation.z=x*Math.PI/2;add(cone,light,x*.08,-.04,.16,.035,.16,.035).rotation.z=Math.PI}}if(kind==='tempest'){bolt(-.23,0,.6);bolt(.23,0,.6)}}
 if(kind==='scatter'||kind==='ember'||kind==='meteor'){nut();if(kind==='scatter'){for(const x of [-.1,.1])add(box,light,x,.14,.09,.018,.018,.24).rotation.y=x*3}else{for(let i=0;i<3;i++){const flame=add(cone,i===1?light:main,(i-1)*.11,0,.3,.105,.5-i*.07,.1);flame.rotation.x=Math.PI/2}if(kind==='meteor')g.scale.setScalar(1.2)}}
 if(kind==='drill'){add(cone,main,0,0,-.09,.18,.56,.18).rotation.x=-Math.PI/2;for(let i=0;i<3;i++){const ring=add(new T.TorusGeometry(.07+i*.035,.025,5,10),dark,0,0,-.2+i*.14,1,1,1);ring.rotation.x=0}}
 if(kind==='gale'||kind==='moonwhirl'){for(let i=0;i<3;i++){const arc=add(new T.TorusGeometry(.13+i*.07,.03,5,18,Math.PI*1.5),main,0,0,0,1,1,1);arc.rotation.x=Math.PI/2;arc.rotation.z=i*2}if(kind==='moonwhirl'){add(rock,light,0,.02,0,.09,.13,.09);for(const x of [-.15,.15])add(cone,light,x,0,.26,.055,.2,.06).rotation.x=Math.PI/2}}
 if(kind==='steam'){add(rock,main,0,0,-.15,.18,.18,.23);for(const [x,z]of [[-.18,.12],[0,.22],[.18,.12]])add(sphere,light,x,0,z,.15,.10,.16)}
 if(kind==='shrapnel'){add(rock,dark,0,0,0,.15,.15,.15);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const q=add(cone,main,Math.sin(a)*.18,0,Math.cos(a)*.18,.065,.37,.065);q.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.sin(a),0,Math.cos(a)))}}
 if(kind==='boomerang'||kind==='windscythe'){for(const sign of [-1,1]){const blade=add(box,main,sign*.15,0,0,.13,.07,.49);blade.rotation.y=sign*.65;add(rock,light,sign*.29,0,-.18,.08,.05,.13)}if(kind==='windscythe'){const arc=add(new T.TorusGeometry(.35,.045,6,24,Math.PI*1.6),light,0,0,0,1,1,1);arc.rotation.x=Math.PI/2}}
 if(kind==='thorn'){add(cone,main,0,0,-.07,.15,.7,.12).rotation.x=-Math.PI/2;for(const sign of [-1,1]){const leaf=add(sphere,dark,sign*.13,0,.17,.18,.04,.08);leaf.rotation.y=sign*.6}add(rock,light,0,.05,.07,.075,.04,.13)}
 if(kind==='bramble'){const ring=add(new T.TorusGeometry(.22,.055,6,16),dark,0,0,0,1,1,1);ring.rotation.x=Math.PI/2;for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const spike=add(cone,main,Math.sin(a)*.24,0,Math.cos(a)*.24,.075,.28,.075);spike.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.sin(a),.4,Math.cos(a)).normalize())}add(rock,light,0,0,0,.1,.1,.1)}
 if(kind==='sunburst'){add(rock,main,0,0,0,.2,.21,.2);for(const x of [-.2,.2])for(const z of [-.2,.2])add(box,dark,x,0,z,.045,.4,.045);for(const y of [-.2,.2]){add(box,light,0,y,0,.47,.045,.47)}add(cone,light,0,.04,0,.1,.37,.1);const handle=add(new T.TorusGeometry(.12,.025,5,12),dark,0,.3,0,1,1,1);handle.rotation.y=Math.PI/2}
 icons[kind]=g;
 }return icons;
}
