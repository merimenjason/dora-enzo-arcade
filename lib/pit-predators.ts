import * as T from 'three';
export type Predator='fox'|'owl'|'snake'|'cougar';
const sphere=new T.SphereGeometry(1,14,10),cone=new T.ConeGeometry(1,1,4),coil=new T.TorusGeometry(.34,.12,8,22);
/** Compact animal silhouettes sized to the existing enemy collision cells. */
export function predatorIcon(kind:Predator){
 const root=new T.Group();const palette:Record<string,T.MeshStandardMaterial>={};
 function mat(color:number){const key=String(color);return palette[key]??=(new T.MeshStandardMaterial({color,roughness:.84}))}
 function shape(geo:T.BufferGeometry,color:number,p:[number,number,number],scale:[number,number,number]){const m=new T.Mesh(geo,mat(color));m.position.set(...p);m.scale.set(...scale);m.castShadow=true;root.add(m);return m}
 const ball=(c:number,p:[number,number,number],s:[number,number,number])=>shape(sphere,c,p,s);
 const eye=(x:number,y:number,z:number,size=.055)=>{ball(0x1d2025,[x,y,z],[size,size,size*.65]);ball(0xfff6df,[x-.015,y+.02,z+.035],[.018,.018,.012])};
 if(kind==='fox'||kind==='cougar'){
  const fur=kind==='fox'?0xc9743b:0xbfa076;
  ball(fur,[0,.52,0],[.54,.46,.45]);
  for(const x of [-.35,.35]){if(kind==='fox'){const ear=shape(cone,fur,[x,.98,-.08],[.26,.57,.24]);ear.rotation.z=-Math.sign(x)*.18;shape(cone,0x49382f,[x,1.0,.02],[.13,.32,.09])}else{ball(fur,[x,.86,-.05],[.19,.2,.12]);ball(0x6a4b40,[x,.88,.045],[.1,.11,.04])}}
  for(const x of [-.18,.18]){ball(0xf0dcc0,[x,.39,.35],[.25,.2,.20]);eye(x,.67,.39,.065)}
  ball(0x292529,[0,.45,.56],[.105,.07,.065]);
  if(kind==='fox'){const tail=ball(fur,[.43,.24,-.3],[.19,.19,.42]);tail.rotation.y=-.5;ball(0xf4e4c8,[.58,.24,-.55],[.15,.15,.15])}
 }else if(kind==='owl'){
  ball(0x796350,[0,.46,0],[.48,.47,.36]);
  for(const x of [-.47,.47]){const wing=ball(0x544c43,[x,.36,0],[.17,.36,.27]);wing.rotation.z=Math.sign(x)*.23}
  for(const x of [-.21,.21]){ball(0xe5cda1,[x,.64,.29],[.245,.26,.12]);ball(0xe4ac4f,[x,.65,.395],[.12,.135,.06]);eye(x,.65,.45,.067);const tuft=shape(cone,0x65503e,[x*1.4,.96,-.02],[.21,.29,.19]);tuft.rotation.z=-Math.sign(x)*.3}
  const beak=shape(cone,0xd6a14e,[0,.40,.46],[.11,.22,.14]);beak.rotation.z=Math.PI;
 }else{
  const ring=shape(coil,0x6d9555,[0,.21,-.10],[1.2,1,1]);ring.rotation.x=Math.PI/2;
  const neck=ball(0x84ac67,[0,.49,.18],[.15,.42,.16]);neck.rotation.x=-.2;
  ball(0x91b775,[0,.80,.31],[.30,.19,.29]);ball(0xcbd59e,[0,.71,.39],[.23,.07,.21]);
  for(const x of [-.17,.17]){ball(0xe3bf64,[x,.87,.47],[.078,.075,.045]);eye(x,.87,.51,.038)}
  for(const x of [-.04,.04]){const tongue=ball(0xdb807a,[x,.72,.65],[.017,.014,.13]);tongue.rotation.y=-Math.sign(x)*.2}
  for(const x of [-.32,0,.32])ball(0xb6c58a,[x,.32,-.29],[.07,.025,.06]);
 }
 root.userData.materials=Object.values(palette);return root;
}
export function predatorKind(id:number,boss:boolean):Predator{return boss?'cougar':(['fox','owl','snake'] as const)[id%3]}
