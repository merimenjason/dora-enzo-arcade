import * as T from 'three';
export type Predator='fox'|'owl'|'snake'|'cougar';
const sphere=new T.SphereGeometry(1,14,10),cone=new T.ConeGeometry(1,1,4);
export function predatorIcon(kind:Predator){
 const root=new T.Group(),palette:Record<string,T.MeshStandardMaterial>={};
 const mat=(c:number)=>palette[c]??=(new T.MeshStandardMaterial({color:c,roughness:.87}));
 function part(geo:T.BufferGeometry,c:number,p:number[],s:number[]){const m=new T.Mesh(geo,mat(c));m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);m.castShadow=true;root.add(m);return m}
 const ell=(c:number,p:number[],s:number[])=>part(sphere,c,p,s);
 function tube(points:number[][],r:number,c:number){return part(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),24,r,7,false),c,[0,0,0],[1,1,1])}
 const eye=(x:number,y:number,z:number)=>{ell(0x14171b,[x,y,z],[.043,.046,.027]);ell(0xfff2cb,[x-.011,y+.014,z+.022],[.012,.012,.009])};
 if(kind==='fox'||kind==='cougar'){
  const fox=kind==='fox',fur=fox?0xc9652d:0xb69768,pale=fox?0xf0debb:0xd6c3a0;
  ell(fur,[0,.38,-.09],[.30,.28,.48]);ell(pale,[0,.29,.17],[.22,.20,.27]);
  for(const x of [-.21,.21])for(const z of [-.34,.25]){const leg=ell(fox?0x41312b:fur,[x,.17,z],[.07,.20,.085]);leg.name='leg';ell(fox?0x302a29:fur,[x,.055,z+.04],[.09,.065,.12])}
  ell(fur,[0,.64,.30],[.28,.26,.26]);ell(pale,[0,.53,.51],[.19,.14,.24]);ell(0x292528,[0,.55,.72],[.069,.05,.045]);
  for(const x of [-.19,.19]){if(fox){part(cone,fur,[x,.92,.22],[.18,.37,.18]).rotation.z=-Math.sign(x)*.13;part(cone,0x473029,[x,.94,.27],[.09,.21,.055])}else{ell(fur,[x,.86,.23],[.11,.13,.09]);ell(0x665044,[x,.88,.30],[.055,.067,.025])}eye(x*.73,.7,.51)}
  if(fox){const tail=tube([[0,.31,-.42],[.24,.28,-.63],[.43,.33,-.58],[.49,.39,-.43]],.13,fur);tail.name='tail';ell(pale,[.49,.39,-.43],[.14,.13,.18])}else{const tail=tube([[0,.31,-.43],[.3,.30,-.65],[.48,.35,-.63],[.52,.49,-.49]],.045,fur);tail.name='tail';ell(0x64513b,[.52,.49,-.49],[.058,.07,.06])}
 }else if(kind==='owl'){
  ell(0x786049,[0,.47,0],[.27,.34,.36]);ell(0xd7c49b,[0,.44,.22],[.20,.25,.14]);
  for(const side of [-1,1]){const wing=ell(0x69503b,[side*.33,.49,-.01],[.28,.085,.32]);wing.rotation.z=side*.2;wing.name='wing';for(let j=0;j<4;j++){const feather=ell(j%2?0x4d4136:0x8d7255,[side*(.37+j*.055),.47,-.16+j*.12],[.095,.05,.24-j*.025]);feather.rotation.y=side*.3;feather.name='wing'}ell(0xb8924c,[side*.12,.16,.21],[.045,.045,.15])}
  ell(0x8b7257,[0,.77,.23],[.30,.24,.21]);for(const x of [-.135,.135]){ell(0xe3d2ac,[x,.8,.39],[.14,.15,.06]);ell(0xe2ab43,[x,.81,.448],[.065,.075,.024]);eye(x,.81,.471);part(cone,0x57422f,[x*1.55,1.0,.17],[.12,.22,.14])}part(cone,0xc59843,[0,.64,.43],[.07,.15,.1]).rotation.z=Math.PI;
  for(const x of [-.09,0,.09])ell(0x4d4136,[x,.39,-.37],[.065,.04,.22]);
 }else{
  tube([[-.44,.15,-.41],[-.15,.14,-.50],[.18,.15,-.39],[.27,.17,-.15],[-.14,.20,.03],[-.22,.3,.25],[0,.47,.36]],.10,0x789655);
  ell(0x9ab376,[0,.48,.47],[.18,.12,.23]);ell(0xc6ce92,[0,.41,.5],[.15,.04,.17]);for(const x of [-.115,.115]){ell(0xd4bd52,[x,.54,.59],[.046,.05,.026]);eye(x,.55,.615)}for(const x of [-.025,.025]){const tongue=ell(0xc57270,[x,.43,.76],[.009,.009,.11]);tongue.rotation.y=-Math.sign(x)*.22}
  for(const p of [[-.3,.235,-.44],[0,.235,-.47],[.25,.255,-.3],[-.05,.30,0]])ell(0x3f633c,p,[.045,.018,.07]);
 }
 root.userData.materials=Object.values(palette);return root;
}
export function predatorKind(id:number,boss:boolean):Predator{return boss?'cougar':(['fox','owl','snake'] as const)[id%3]}
