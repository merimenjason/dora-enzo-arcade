/** Botanical toy models ported from docs/grumble-hunt/look-test/main.ts.txt. */
import * as T from 'three';
import { poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { BEAST_MATS, weaponNode, type BeastId, type Branch, type Tier, type WeaponType } from './grumble-hunt-content';
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
type Pair = { soft: T.Material; toon: T.Material };
/** Same beast palette as the hunt, without importing the deterministic engine. */
const BEAST_COLOURS: Record<BeastId,number> = { bristleback:0xb98050, puffwart:0x8c9d4b, skreel:0x788ca6, hornclack:0x8b919f, frostmane:0xaccfe7 };
/** Decorate a handle-local group once; caller owns visibility and disposal sets (also used by actor's hammer). */
export function decorateHuntWeapon(g: T.Group, type: WeaponType, material: (color:number)=>T.Material, geometries: Set<T.BufferGeometry>, materials: Set<T.Material>, shield=false) {
  const looks: { tier:Tier; branch:Branch|null; group:T.Group }[]=[];
  const band=material(type==='feather'||type==='puffer'||type==='umbrella'?0x519c99:0xaab5bf), gold=material(0xe7bc57);
  materials.add(band); materials.add(gold);
  const ring=new T.TorusGeometry(.047,.012,5,10), bead=new T.SphereGeometry(1,8,6); geometries.add(ring); geometries.add(bead);
  const at=shield?V(.15,.02,0):type==='hammer'?V(0,.5,0):type==='bow'?V(.125,0,0):type==='claws'?V(.12,.04,0):type==='yoyo'?V(0,-.24,0):type==='pogo'?V(0,.02,-.15):type==='heavybow'?V(.08,.15,0):V(0,.12,0);
  for(const tier of [2,3,4,5] as Tier[]) for(const branch of tier===2?[null]:['A','B'] as Branch[]) {
    const group=new T.Group(); group.position.copy(at); if(shield) group.rotation.z=-Math.PI/2; g.add(group); group.visible=false; looks.push({tier,branch,group});
    const add=(geo:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);group.add(o);return o;};
    add(ring,band,0,0,0).rotation.x=Math.PI/2;
    if(tier>=3) {
      // Tier-3 costs encode TREES' branch beast, including Skreel's summed feather cost.
      const node=weaponNode(`${type}-3${branch}`)!;
      const beast=(Object.keys(BEAST_MATS) as BeastId[]).find(id=>node.cost[BEAST_MATS[id].common])!;
      const accent=material(BEAST_COLOURS[beast]); materials.add(accent);
      add(ring,gold,0,.045,0).rotation.x=Math.PI/2;
      const count=tier>=4?2:1;
      for(let i=0;i<count;i++) {
        const o=add(bead,accent,(i?-.035:.035),.065,.025,.035,.055,.022);
        if(beast==='bristleback') {o.scale.set(.025,.05,.025);o.rotation.z=i?-.5:.5;}
        if(beast==='hornclack') o.scale.set(.05,.035,.018);
        if(beast==='skreel') {o.scale.set(.018,.07,.012);o.rotation.z=.5;}
        if(beast==='frostmane') o.scale.set(.04,.055,.03);
        if(beast==='puffwart') o.scale.set(.045,.04,.035);
      }
      if(tier===5) {
        const glow=new T.MeshBasicMaterial({color:0xffb94f,toneMapped:false}); glow.userData.outlineParameters={visible:false}; materials.add(glow);
        add(bead,glow,0,.08,.055,.035,.045,.025);
        const halo=glow.clone(); halo.transparent=true;halo.opacity=.13;halo.depthWrite=false;materials.add(halo);
        add(bead,halo,0,.08,.055,.06,.07,.045);
      }
    }
  }
  return { setLook(tier:Tier,branch:Branch|null) { for(const look of looks) look.group.visible=look.tier===tier && look.branch===(tier===2?null:branch??'A'); } };
}
export function createHuntWeapons(model: HuntChinchilla, material: (color: number) => T.Material, geometries: Set<T.BufferGeometry>, materials: Set<T.Material>) {
  const held: Partial<Record<WeaponType, T.Group[]>> = {};
  const pair = (color: number): Pair => { const m = material(color); return { soft: m, toon: m }; };
  const mesh = (geo: T.BufferGeometry, p: Pair, parent: T.Object3D) => { geometries.add(geo); const m = new T.Mesh(geo, p.toon); m.castShadow = true; parent.add(m); return m; };
function grip(...parts: [T.BufferGeometry, Pair, number, number, number, number?, number?, number?][]) {
  const g = new T.Group(); model.body.add(g); g.scale.setScalar(1 / 0.75);
  for (const [geo, p, x, y, z, rx = 0, ry = 0, rz = 0] of parts) { const m = mesh(geo, p, g); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); }
  return g;
}
{
  const dark = pair(0x6e4423), bubble = pair(0xbfe6ff);
  // Twin Claws: a curved wooden paw-blade in each paw, rounded at the tip
  // a long flattened leaf of pale wood out past the paw, curving up a little, on a dark grip
  const blade = new T.SphereGeometry(1, 16, 10), pale = pair(0xe3b77a);
  held.claws = [-1, 1].map(() => {
    const g = grip([blade, pale, 0.2, 0.04, 0, 0, 0, 0.28], [new T.CylinderGeometry(0.04, 0.04, 0.16, 8), dark, 0.02, 0, 0, 0, 0, Math.PI / 2]);
    g.children[0].scale.set(0.22, 0.06, 0.03); return g;
  });
  // Bubble Wand: a reed stick with a ring, and a bubble drifting off it
  const ring = new T.TorusGeometry(0.1, 0.02, 8, 20);
  const bubbleMat = bubble; for (const m of [bubbleMat.toon]) { m.transparent = true; m.opacity = 0.55; }
  held.wand = [grip([new T.CylinderGeometry(0.022, 0.026, 0.55, 8), pair(0x9fbf5a), 0, 0.22, 0, 0, 0, -0.3], [ring, pair(0xf2c14e), 0.17, 0.53, 0, 0, Math.PI / 2, -0.3], [new T.SphereGeometry(0.11, 16, 12), bubbleMat, 0.38, 0.7, 0])];
  // Pinecone Yo-yo: hangs from the right paw on a string and swings
  const cone = grip([new T.SphereGeometry(0.11, 12, 10), pair(0x8a5a34), 0, -0.24, 0]);
  for (let i = 0; i < 12; i++) { const sc = mesh(new T.ConeGeometry(0.035, 0.07, 6), pair(0x6e4423), cone); const a = i * 2.4, h = -0.24 + ((i % 4) - 1.5) * 0.05; sc.position.set(Math.cos(a) * 0.1, h, Math.sin(a) * 0.1); sc.rotation.z = Math.PI; }
  cone.children[0].scale.set(1, 1.3, 1);
  const lineGeo = new T.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -0.14, 0)]), lineMat = new T.LineBasicMaterial({ color: 0xf3ead8 }); geometries.add(lineGeo); materials.add(lineMat); cone.add(new T.Line(lineGeo, lineMat));
  held.yoyo = [cone];
}

// Every other toy is built around its handle: the group's origin is where one paw grips it, the
// handle runs along local +y, and `hold` turns and places the group so that grip lands in front of
// the chest. Grip points are local to the groups; pose() maps them back to body space every frame.
const idleGrips: Partial<Record<WeaponType, [T.Vector3 | null, T.Vector3 | null]>> = {};
// A second toy for the other paw (a shield), gripped at its own origin.
const offhand: Partial<Record<WeaponType, T.Group>> = {};
const woodW = pair(0xc39359), paleW = pair(0xe8cca0), greenW = pair(0x6eaa4e), wrapW = pair(0x845638), barkW = pair(0x8a5b36);
function ball(g: T.Group, p: Pair, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const m = mesh(new T.SphereGeometry(1, 20, 14), p, g); m.position.set(x,y,z); m.scale.set(sx,sy,sz); return m;
}
function rod(g: T.Group, a: T.Vector3, b: T.Vector3, r = .028, p = woodW) {
  const m = mesh(new T.CapsuleGeometry(r, Math.max(.001,a.distanceTo(b)-2*r), 4, 10), p, g);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize()); return m;
}
function toy(id: WeaponType, left: T.Vector3 | null, right: T.Vector3 | null) {
  const g = grip(); held[id] = [g]; idleGrips[id] = [left,right]; return g;
}
const qRoll = new T.Quaternion();
/** Turn local +y to `dir` (then roll about it) and move the group so its local `anchor` sits at `at`, all in body space. */
function hold(g: T.Group, anchor: T.Vector3, at: T.Vector3, dir: T.Vector3, roll = 0) {
  g.quaternion.setFromUnitVectors(V(0,1,0), dir.clone().normalize()).multiply(qRoll.setFromAxisAngle(V(0,1,0), roll));
  g.position.copy(at).sub(anchor.clone().multiplyScalar(1/0.75).applyQuaternion(g.quaternion));
}
function wrapped(g: T.Group, a: T.Vector3, b: T.Vector3) {
  rod(g,a,b,.04,wrapW);
  for(let i=1;i<5;i++) { const m=mesh(new T.TorusGeometry(.042,.008,6,12),paleW,g); m.position.copy(a).lerp(b,i/5); m.quaternion.setFromUnitVectors(V(0,0,1),b.clone().sub(a).normalize()); }
}
/** A round bark shield (or a pea-pod one) facing forward from the left paw. */
function shield(id: WeaponType, pod = false) {
  const g = grip(); held[id]!.push(g); offhand[id] = g;
  if(pod) { ball(g,greenW,.07,.02,0,.06,.25,.14); for(let i=0;i<3;i++) ball(g,paleW,.12,.02+(i-1)*.13,0,.035,.065,.075); }
  else { ball(g,barkW,.07,.02,0,.05,.2,.2); ball(g,woodW,.1,.02,0,.03,.15,.15); ball(g,paleW,.13,.02,0,.03,.05,.05); }
  hold(g,V(),V(.56,.42,-.24),V(0,1,0),-.35);
}
// Two-paw carry, right paw lowest on the handle under the chin: the blade rests back over the
// right shoulder, leaning out past the big head, so a swing chops forward from beside it.
// Each rest was searched to clear the head, ears and body (.checks/clip-search.mjs).
{
  // Driftwood Greatsword: a broad rounded plank with grain lines, a crossguard and a wrapped grip
  let g=toy('greatsword',V(0,.15,0),V(0,0,0));
  wrapped(g,V(0,-.1,0),V(0,.22,0)); ball(g,paleW,0,.25,0,.18,.045,.08);
  ball(g,woodW,0,.66,0,.16,.44,.05);
  for(const z of [-.046,.046]) for(const x of [-.06,.05]) rod(g,V(x,.36,z),V(x*.6,.94,z),.007,barkW);
  ball(g,barkW,.05,.8,.045,.025,.035,.012);
  hold(g,V(),V(.55,.35,-.02),V(-.18,.67,.72),.29);
  g=toy('katana',V(0,.15,0),V(0,0,0)); wrapped(g,V(0,-.08,0),V(0,.22,0));
  ball(g,greenW,0,.26,0,.13,.035,.13);
  const curve=new T.QuadraticBezierCurve3(V(0,.28,0),V(.02,.65,0),V(.18,.98,0));
  const leafBlade=mesh(new T.TubeGeometry(curve,24,.045,10,false),greenW,g); leafBlade.scale.z=.55;
  ball(g,greenW,.18,.98,0,.045,.045,.025);
  for(let i=0;i<3;i++) ball(g,paleW,.015+i*.035,.42+i*.19,0,.05,.018,.03);
  hold(g,V(),V(.56,.38,-.05),V(.36,.64,.68),-.66);
  // Sword and shield: a short paddle-blade in the right paw, the shield on the left
  for(const id of ['sword','chargeblade'] as WeaponType[]) {
    g=toy(id,null,V(0,0,0)); wrapped(g,V(0,-.08,0),V(0,.1,0)); ball(g,paleW,0,.13,0,.12,.035,.06);
    ball(g,id==='sword'?woodW:greenW,0,.38,0,.085,.25,.04);
    if(id==='chargeblade') for(let i=0;i<3;i++) ball(g,paleW,0,.26+i*.1,.035,.04,.035,.018);
    hold(g,V(),V(.61,.36,.32),V(-.23,.81,.54),-.87); shield(id,id==='chargeblade');
  }
  g=toy('horn',V(0,.15,0),V(0,0,0)); wrapped(g,V(0,-.08,0),V(0,.26,0));
  ball(g,pair(0xd8ae54),0,.5,0,.2,.25,.18); ball(g,woodW,.02,.72,0,.09,.09,.09);
  for(let i=0;i<3;i++) ball(g,wrapW,.18,.38+i*.11,.04,.025,.028,.04);
  hold(g,V(),V(.5,.43,.03),V(-.04,.58,.81),.24);
  // Gunlance: a long reed lance with a seed-pod bell, levelled forward under a pod shield
  g=toy('gunlance',null,V(0,0,0)); wrapped(g,V(0,-.14,0),V(0,.08,0)); rod(g,V(0,.08,0),V(0,.82,0),.042);
  ball(g,pair(0xf4d6ae),0,.86,0,.16,.14,.16);
  for(let i=0;i<5;i++) ball(g,paleW,Math.sin(i*1.26)*.11,.95,Math.cos(i*1.26)*.11,.03,.035,.03);
  hold(g,V(),V(.59,.39,.29),V(.98,.18,.06)); shield('gunlance',true);
  // Thistle Lance: a long wooden shaft tipped with a thistle puff, under a leaf shield
  g=toy('lance',null,V(0,0,0)); rod(g,V(0,-.18,0),V(0,.9,0),.035); wrapped(g,V(0,-.06,0),V(0,.1,0));
  ball(g,pair(0x5d9a3f),0,.92,0,.07,.06,.07); mesh(new T.IcosahedronGeometry(.1,1),pair(0xa77bd6),g).position.set(0,1.0,0);
  hold(g,V(),V(.59,.39,.29),V(.99,.14,.04)); shield('lance');
  g=toy('switchaxe',V(0,.15,0),V(0,0,0)); wrapped(g,V(0,-.12,0),V(0,.3,0)); rod(g,V(0,.3,0),V(0,.7,0));
  ball(g,pair(0xe6a7bc),0,.6,0,.09,.09,.09); ball(g,woodW,.08,.82,0,.2,.2,.06);
  ball(g,paleW,.1,.85,.05,.14,.12,.022);
  hold(g,V(),V(.58,.36,-.03),V(-.18,.62,.77),1.21);
  g=toy('glaive',V(0,.15,0),V(0,0,0)); rod(g,V(0,-.26,0),V(0,.9,0));
  for(let i=0;i<5;i++) {const a=i*Math.PI*2/5;ball(g,pair(0xf0b4cd),Math.cos(a)*.1,.91,Math.sin(a)*.1,.07,.14,.07);}
  ball(g,pair(0xffdf74),0,.89,0,.08,.09,.08); hold(g,V(),V(.55,.43,-.01),V(.04,.77,.64),-.07);
  const glow=new T.MeshBasicMaterial({color:0xfff18c,toneMapped:false}); glow.userData.outlineParameters={visible:false};
  materials.add(glow); const flyGeo=new T.SphereGeometry(.04,12,8); geometries.add(flyGeo); const fly=new T.Mesh(flyGeo,glow); g.add(fly); g.userData.firefly=fly;
  for(const z of [-.04,.04]) { const wing=new T.Mesh(flyGeo,glow);wing.scale.set(1,.3,1);wing.position.z=z;fly.add(wing); }
  // The three bows rest in one paw, out beside the body so the camera behind the hero sees them.
  // Slingshot: held upright by its handle at the right side
  g=toy('lightbow',V(0,0,0),null);
  rod(g,V(0,-.12,0),V(0,.12,0),.035,wrapW); rod(g,V(0,.1,0),V(0,.3,-.12),.03);rod(g,V(0,.1,0),V(0,.3,.12),.03);
  rod(g,V(0,.3,-.12),V(-.13,.12,0),.01,paleW);rod(g,V(0,.3,.12),V(-.13,.12,0),.01,paleW);
  ball(g,wrapW,-.13,.12,0,.035,.03,.045); hold(g,V(),V(.42,.5,-.56),V(0,1,-.25));
  // Pumpkin cannon: carried by its stalk at the left side, hanging clear of the body
  g=toy('heavybow',null,V(-.1,.15,.06));
  const pumpkin=pair(0xe4a04c);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ball(g,pumpkin,0,Math.cos(a)*.08,Math.sin(a)*.08,.25,.15,.15);}
  ball(g,wrapW,.235,0,0,.018,.095,.095);ball(g,paleW,.25,0,0,.015,.065,.065);
  rod(g,V(-.1,.08,.06),V(-.1,.17,.06),.035,greenW); ball(g,greenW,-.02,.15,-.05,.08,.02,.05);
  hold(g,V(-.1,.15,.06),V(.3,.65,.58),V(0,-1,0),Math.PI);
  // Bow: held upright by its grip at the right side
  g=toy('bow',V(.125,0,0),null);
  const arc=new T.QuadraticBezierCurve3(V(0,-.34,0),V(.25,0,0),V(0,.34,0));
  mesh(new T.TubeGeometry(arc,24,.025,10,false),woodW,g);
  rod(g,V(0,-.34,0),V(0,.34,0),.008,paleW); ball(g,wrapW,.125,0,0,.035,.06,.035);
  hold(g,V(.125,0,0),V(.42,.55,-.56),V(0,1,-.3),Math.PI/2);
}
// The post-game toys.
const pinkW = pair(0xf2a7c3), blushW = pair(0xfbd3e0), creamW = pair(0xfff3dc), leafW = pair(0x8cc152), capW = pair(0xd9634f);
/** Remembers a second rest pose (the open umbrella) for pose() to blend towards. */
function alsoHold(g: T.Group, at: T.Vector3, dir: T.Vector3, roll = 0) {
  const pos = g.position.clone(), q = g.quaternion.clone();
  hold(g,V(),at,dir,roll); g.userData.guardPos = g.position.clone(); g.userData.guardQ = g.quaternion.clone();
  g.position.copy(pos); g.quaternion.copy(q);
}
{
  // Tickle Feather: a big curled pink plume on a twig, held up like a short sword
  let g=toy('feather',null,V(0,0,0));
  rod(g,V(0,-.1,0),V(0,.24,0),.026,barkW); ball(g,barkW,.02,.08,0,.035,.03,.035);
  const quill=new T.QuadraticBezierCurve3(V(0,.2,0),V(-.06,.72,0),V(.24,1.04,0));
  mesh(new T.TubeGeometry(quill,16,.013,6,false),creamW,g);
  // The vane: two rows of soft barbs swept towards the tip, one instanced batch with two pinks
  const BARBS=13, barbs=new T.InstancedMesh(new T.SphereGeometry(1,10,6),pair(0xffffff).toon,BARBS*2), m4=new T.Matrix4(), side=new T.Vector3(), out=V(1,0,0);
  geometries.add(barbs.geometry); barbs.castShadow=true; g.add(barbs);
  for(let i=0;i<BARBS;i++) for(const sd of [-1,1]) {
    const t=.08+i*.068, at=quill.getPoint(t), tan=quill.getTangent(t), len=.06+.15*Math.sin(Math.PI*Math.pow(t,.8));
    side.set(-tan.y*sd,tan.x*sd,0); const d=side.multiplyScalar(.8).addScaledVector(tan,.6).normalize();
    m4.compose(at.clone().addScaledVector(d,len*.5),new T.Quaternion().setFromUnitVectors(out,d),V(len*.55,.034,.018));
    const n=i*2+(sd>0?1:0); barbs.setMatrixAt(n,m4); barbs.setColorAt(n,new T.Color((i+(sd>0?1:0))%2?0xfbd3e0:0xf2a7c3));
  }
  ball(g,pinkW,.25,1.05,0,.045,.035,.022);
  hold(g,V(),V(.59,.43,.23),V(-.06,.77,.63),-1.47);
  // Dandelion Puffer: a seed clock on a long stem, held upright in both paws; the seeds thin out
  // while Big Breath recharges (pose's `recharge`)
  g=toy('puffer',V(0,.16,0),V(0,0,0));
  rod(g,V(0,-.12,0),V(0,.64,0),.024,greenW); ball(g,greenW,.07,-.02,0,.1,.025,.045).rotation.z=.5;
  ball(g,pair(0xc8b27a),0,.66,0,.045,.04,.045);
  const SEEDS=34, stalkGeo=new T.CylinderGeometry(1,1,1,4), tuftGeo=new T.SphereGeometry(1,8,6); geometries.add(stalkGeo); geometries.add(tuftGeo);
  const stalks=new T.InstancedMesh(stalkGeo,creamW.toon,SEEDS), tufts=new T.InstancedMesh(tuftGeo,creamW.toon,SEEDS), up=V(0,1,0);
  for(let i=0;i<SEEDS;i++) {
    const y=1-2*(i+.5)/SEEDS, a=i*2.39996, r=Math.sqrt(1-y*y), dir=V(Math.cos(a)*r,y,Math.sin(a)*r), q=new T.Quaternion().setFromUnitVectors(up,dir);
    stalks.setMatrixAt(i,m4.compose(dir.clone().multiplyScalar(.1).add(V(0,.66,0)),q,V(.005,.16,.005)));
    tufts.setMatrixAt(i,m4.compose(dir.clone().multiplyScalar(.19).add(V(0,.66,0)),q,V(.045,.03,.045)));
  }
  for(const m of [stalks,tufts]) { m.castShadow=true; g.add(m); }
  g.userData.seeds=[stalks,tufts];
  hold(g,V(),V(.57,.5,.01),V(-.3,.46,.83),.3);
  // Pogo Spring: a reed pole with a T-bar for both paws, a coiled spring and a mushroom-cap foot
  g=toy('pogo',V(0,0,-.3),V(0,0,0));
  rod(g,V(0,0,.1),V(0,0,-.4),.034,wrapW); for(const z of [.11,-.41]) ball(g,paleW,0,0,z,.05,.05,.05);
  rod(g,V(0,.16,-.15),V(0,-.22,-.15),.045,greenW); ball(g,leafW,0,.18,-.15,.06,.06,.06);
  for(const y of [-.06,-.17]) { const ring=mesh(new T.TorusGeometry(.047,.01,6,12),paleW,g); ring.position.set(0,y,-.15); ring.rotation.x=Math.PI/2; }
  const coil=new T.CatmullRomCurve3(Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*9;return V(Math.cos(a)*.085,-.22-i/48*.2,-.15+Math.sin(a)*.085);}));
  mesh(new T.TubeGeometry(coil,72,.02,6,false),pair(0xe9b949),g);
  rod(g,V(0,-.22,-.15),V(0,-.44,-.15),.025,paleW);
  ball(g,capW,0,-.47,-.15,.17,.08,.17); ball(g,creamW,0,-.52,-.15,.08,.03,.08);
  for(let i=0;i<5;i++) { const a=i*1.26+.4; ball(g,creamW,Math.cos(a)*.1,-.43,-.15+Math.sin(a)*.1,.03,.015,.03); }
  hold(g,V(0,0,-.15),V(.6,.44,.15),V(.55,.49,-.68),.09);
  // Leaf Umbrella: a curved twig handle and six leaves that hang folded and fan open to guard
  g=toy('umbrella',null,V(0,0,0));
  const hook=new T.CatmullRomCurve3([V(0,.02,0),V(0,-.12,0),V(.05,-.19,0),V(.12,-.15,0),V(.12,-.08,0)]);
  mesh(new T.TubeGeometry(hook,16,.024,8,false),barkW,g); rod(g,V(0,0,0),V(0,1.02,0),.02,barkW);
  const canopy=new T.Group(); canopy.position.y=.98; g.add(canopy); const ribs: T.Group[]=[];
  for(let i=0;i<6;i++) {
    const turnY=new T.Group(), tilt=new T.Group(); turnY.rotation.y=i*Math.PI/3; canopy.add(turnY); turnY.add(tilt); ribs.push(tilt);
    ball(tilt,i%2?leafW:greenW,.2,0,0,.22,.022,.12); rod(tilt,V(.02,.012,0),V(.38,.012,0),.006,pair(0xd8e8a8));
  }
  ball(g,greenW,0,1.02,0,.05,.04,.05); g.userData.ribs=ribs; g.userData.canopy=canopy;
  hold(g,V(),V(.58,.36,.18),V(-.2,.8,.57),-.9);
  alsoHold(g,V(.54,.5,.14),V(.28,1,.08),0);
}
const looks = {} as Partial<Record<WeaponType,ReturnType<typeof decorateHuntWeapon>[]>>;
for(const [id,gs] of Object.entries(held)) looks[id as WeaponType]=gs.map(g=>decorateHuntWeapon(g,id as WeaponType,material,geometries,materials,g===offhand[id as WeaponType]));
for (const gs of Object.values(held)) for (const g of gs) g.visible = false;

  // Attack motion: a quick wind-up, the strike around contact (0.1 s), then an eased return to rest.
  const ease = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const fastTypes: WeaponType[] = ['claws', 'sword', 'glaive', 'lightbow', 'feather'];
  function strike(type: WeaponType, swing: number, delay = 0) {
    if (swing < 0) return 0;
    const u = (swing - delay) / (fastTypes.includes(type) ? 0.2 : 0.4);
    return u < 0 ? 0 : u < 0.2 ? -0.35 * ease(u / 0.2) : u < 0.4 ? -0.35 + 1.35 * ease((u - 0.2) / 0.2) : 1 - ease((u - 0.4) / 0.6);
  }
  // Swings turn each toy around its own grip in body space (x forward, y up, z the right-paw side);
  // `lunge` steps the whole body forward on the strike so thrusts reach without stretching the arms.
  const SWINGS: Partial<Record<WeaponType, { axis: T.Vector3; angle: number; reach?: T.Vector3; lunge?: number }>> = {
    greatsword: { axis: V(0, 0, 1), angle: -1.5, lunge: 0.12 }, katana: { axis: V(0.45, 0, 1).normalize(), angle: -1.7, lunge: 0.1 }, switchaxe: { axis: V(0, 0, 1), angle: -1.4, lunge: 0.12 },
    horn: { axis: V(0, 0, 1), angle: -1.1, lunge: 0.1 }, glaive: { axis: V(1, 0, 0.3).normalize(), angle: 1.3 },
    sword: { axis: V(0, 0, 1), angle: -1.3, lunge: 0.1 }, chargeblade: { axis: V(0, 0, 1), angle: -1.3, lunge: 0.1 },
    gunlance: { axis: V(0, 0, 1), angle: 0, reach: V(0.14, 0, 0), lunge: 0.2 }, lance: { axis: V(0, 0, 1), angle: 0, reach: V(0.14, 0, 0), lunge: 0.2 },
    feather: { axis: V(0.3, 0, 1).normalize(), angle: -1.5, lunge: 0.08 }, puffer: { axis: V(0, 0, 1), angle: -1.2, reach: V(0.04, 0.08, 0) },
    pogo: { axis: V(0, 0, 1), angle: -0.35, reach: V(0.08, -0.05, 0), lunge: 0.2 }, umbrella: { axis: V(0, 0, 1), angle: -1.3, lunge: 0.1 },
    bow: { axis: V(0, 0, 1), angle: 0.25, reach: V(-0.08, 0, 0) }, lightbow: { axis: V(0, 0, 1), angle: 0.2, reach: V(-0.08, 0, 0) }, heavybow: { axis: V(0, 0, 1), angle: 0.35, reach: V(-0.14, 0.04, 0) },
  };
  const turn = new T.Quaternion(), toBody = new T.Matrix4();
  // Paws reach at most this far from the shoulder; a toy held further out slides back towards them.
  const REACH = 0.42;
  const gripAt = (g: T.Group, local: T.Vector3) => local.clone().applyMatrix4(g.matrix);
  function keepInReach(g: T.Group, grips: (T.Group | null)[], locals: (T.Vector3 | null)[]) {
    for (let pass = 0; pass < 3; pass++) {
      let fix: T.Vector3 | null = null;
      model.arms.forEach((a, i) => {
        const local = locals[i], owner = grips[i]; if (!local || owner !== g) return;
        const off = gripAt(g, local).sub(a.shoulder), over = off.length() - REACH;
        if (over > 0 && (!fix || over > fix.length())) fix = off.setLength(-over);
      });
      if (!fix) return; g.position.add(fix); g.updateMatrix();
    }
  }

  return {
    setLook(type:WeaponType,tier:Tier,branch:Branch|null) { const groups=looks[type]; if(groups) for(const look of groups) look.setLook(tier,branch); },
    /** `charge` (the held K) draws the toy back ready to strike; `guard` lifts a shield to the front (or opens
     *  the umbrella); `recharge` (1 just used, 0 ready) thins the dandelion's seeds. */
    pose(type: WeaponType, time: number, swing: number, charge = 0, guard = false, recharge = 0) {
      for (const [id, groups] of Object.entries(held)) for (const g of groups) g.visible = id === type;
      model.body.position.x = 0; model.body.rotation.y = 0;
      const groups = held[type]; if (!groups) return;
      const bob = Math.sin(time * 2) * 0.015; let k = swing < 0 && charge > 0 ? -0.5 * Math.min(1, charge / 0.35) : strike(type, swing);
      const grips = idleGrips[type];
      if (grips) {
        const g = groups[0], move = SWINGS[type], side = offhand[type];
        for (const o of [g, side]) if (o) { o.userData.restPos ??= o.position.clone(); o.userData.restQ ??= o.quaternion.clone(); o.position.copy(o.userData.restPos); o.quaternion.copy(o.userData.restQ); o.position.y += bob; }
        const ribs = g.userData.ribs as T.Group[] | undefined;
        if (ribs) {
          // The umbrella eases open over about 0.15 s and folds its leaves down when it closes.
          const dt = Math.min(0.1, Math.max(0, time - (g.userData.at ?? time))); g.userData.at = time;
          const open = g.userData.open = time ? (g.userData.open ?? 0) + Math.max(-dt * 7, Math.min(dt * 7, (guard ? 1 : 0) - (g.userData.open ?? 0))) : guard ? 1 : 0;
          g.position.lerp(g.userData.guardPos, open); g.quaternion.slerp(g.userData.guardQ, open);
          for (const rib of ribs) rib.rotation.z = -1.35 + 1.1 * open;
          (g.userData.canopy as T.Group).scale.setScalar(1 + 0.45 * open);
          // Raindrop Spin: J while it's open turns the whole hero once around.
          if (guard && swing >= 0) { model.body.rotation.y = Math.PI * 2 * ease(Math.min(1, swing / 0.4)); k = 0; }
        }
        const seeds = g.userData.seeds as T.InstancedMesh[] | undefined;
        if (seeds) for (const m of seeds) m.count = Math.round(m.instanceMatrix.count * (1 - 0.85 * Math.min(1, recharge)));
        if (move && k) {
          g.quaternion.premultiply(turn.setFromAxisAngle(move.axis, move.angle * k)); if (move.reach) g.position.addScaledVector(move.reach, Math.max(0, k));
          model.body.position.x = (move.lunge ?? 0) * Math.max(0, k);
        }
        if (side && guard) { side.position.add(V(.08, .14, .16)); side.quaternion.premultiply(turn.setFromAxisAngle(V(0, 1, 0), .35)); }
        g.updateMatrix(); side?.updateMatrix();
        const owners = [side ?? (grips[0] ? g : null), grips[1] ? g : null], locals = [side ? V() : grips[0], grips[1]];
        keepInReach(g, owners, locals); if (side) keepInReach(side, owners, locals);
        poseArms(model, owners[0] && locals[0] ? gripAt(owners[0], locals[0]) : null, owners[1] && locals[1] ? gripAt(owners[1], locals[1]) : null);
        const fly = g.userData.firefly as T.Mesh | undefined; if (fly) fly.position.copy(V(.34 + Math.cos(time * 2) * .85, 1.7, Math.sin(time * 2) * .85).applyMatrix4(toBody.copy(g.matrix).invert()));
      } else if (type === 'claws') {
        // Left then right jab, stepping into it.
        const kl = Math.max(0, k), kr = Math.max(0, strike(type, swing, 0.06));
        model.body.position.x = 0.1 * Math.max(kl, kr);
        const l = V(.58 + .14 * kl, .52 + bob, -.24), r = V(.58 + .14 * kr, .52 - bob, .24); poseArms(model, l, r); groups[0].position.copy(l); groups[1].position.copy(r);
      } else if (type === 'yoyo') {
        // Thrown out along the string and reeled back in.
        const r = V(.56, .74 + bob, .38), out = Math.max(0, k); poseArms(model, null, r.clone().add(V(.12 * out, 0, 0)));
        groups[0].position.copy(r).add(V(1.1 * out, -.25 * out, 0)); groups[0].rotation.z = Math.sin(time * 1.7) * .25 - out * 6;
      } else {
        // The wand leans out to the right so its ring stays beside the face, further while charging; a cast flicks it forward.
        const r = V(.54 + .1 * Math.max(0, k), .56 + bob, .3 - .12 * Math.min(0, k)); poseArms(model, null, r); groups[0].position.copy(r); groups[0].rotation.set(.45 - .9 * Math.min(0, k), 0, -1.1 * Math.max(0, k));
      }
    },
  };
}
