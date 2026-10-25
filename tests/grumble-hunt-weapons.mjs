// Body-space, radial ellipsoid penetration in model units; includes every visible instance.
import * as T from 'three';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
// From the repository root: node tests/grumble-hunt-weapons.mjs --compile --looks --assert
if(process.argv.includes('--compile')) {
 mkdirSync('.checks/lab-out',{recursive:true});
 execFileSync('npx',['tsc','lib/hunt-chinchilla.ts','lib/grumble-hunt-weapons.ts','--outDir','.checks/lab-out','--module','es2022','--target','es2022','--moduleResolution','bundler','--skipLibCheck'],{stdio:'inherit'});
 for(const file of readdirSync('.checks/lab-out').filter(f=>f.endsWith('.js'))) {
  const path=`.checks/lab-out/${file}`;writeFileSync(path,readFileSync(path,'utf8').replace(/from '(\.\/[a-z-]+)'/g,"from '$1.js'"));
 }
 writeFileSync('.checks/lab-out/package.json','{"type":"module"}');
}

const lab=process.env.HUNT_LAB ?? '../.checks/lab-out/';
const {createHuntChinchilla}=await import(lab+'hunt-chinchilla.js');
const W=await import(lab+'grumble-hunt-weapons.js');
const {WEAPON_TYPES}=await import(lab+'grumble-hunt-content.js');
const guards=['greatsword','sword','chargeblade','lance','gunlance','heavybow','umbrella'];
const mat=c=>new T.MeshToonMaterial({color:c});
function hammer(m){const g=new T.Group();m.body.add(g);g.scale.setScalar(1/.75);g.position.set(.46,.58,.32);g.rotation.x=.45;
 const add=(p,geo,at,scale)=>{const o=new T.Mesh(geo,mat(0xaa8844));o.position.set(...at);o.scale.set(...scale);p.add(o)};
 add(g,new T.CylinderGeometry(1,1,1,12),[0,.39,0],[.034,.78,.034]);
 const h=new T.Group();g.add(h);h.position.y=.82;h.rotation.z=Math.PI/2;
 add(h,new T.SphereGeometry(1,16,12),[0,-.06,0],[.24,.29,.24]);add(h,new T.SphereGeometry(1,16,12),[0,.12,0],[.255,.12,.255]);add(h,new T.CylinderGeometry(1,1,1,12),[0,.28,0],[.025,.12,.025]);return g;}
const rows=[];
// --looks covers every branch/tier; --assert enforces penetration and shoulder reach limits.
for(const type of Object.keys(WEAPON_TYPES)){if(process.env.ONLY && type!==process.env.ONLY)continue;
 const m=createHuntChinchilla(true), before=new Set(m.body.children), gs=new Set(), ms=new Set(), w=W.createHuntWeapons(m,mat,gs,ms), hg=hammer(m);
 const hammerLook=W.decorateHuntWeapon?.(hg,'hammer',mat,gs,ms);
 const roots=m.body.children.filter(g=>!before.has(g));
 const hulls=[{matrix:new T.Matrix4().makeTranslation(-.06,.52,0),r:new T.Vector3(.56,.52,.5)}, {matrix:new T.Matrix4().makeTranslation(.34,1,0),r:new T.Vector3(.46,.42,.46)}];
 m.root.updateMatrixWorld(true);for(const e of m.ears){const o=e.children[0]; hulls.push({matrix:o.matrixWorld.clone(),r:new T.Vector3(1,1,1)});}
 for(const h of hulls){h.inv=h.matrix.clone().invert();h.linear=new T.Matrix3().setFromMatrix4(h.matrix);}
 const resources=[gs.size,ms.size];
 let worst=0,reach=0,pose='',meshes=0;
 const cases=[];for(const time of [0,.7,2.3]){cases.push([time,-1,0,false,0],[time,-1,1,false,0]);for(const swing of [...Array.from({length:41},(_,i)=>i*.015),.04,.08,.16,.2,.4,.6])cases.push([time,swing,0,false,0]);if(guards.includes(type))for(const s of [-1,.08,.2])cases.push([time,s,0,true,0]);}
 const looks=process.argv.includes('--looks')?[[1,null],[2,null],[3,'A'],[3,'B'],[4,'A'],[4,'B'],[5,'A'],[5,'B']]:[[1,null]];
 for(const [tier,branch] of looks)for(const args of cases){w.setLook?.(type,tier,branch);hammerLook?.setLook(tier,branch);w.pose(type,...args);hg.visible=type==='hammer';
 if(type==='hammer'){{const t=args[1];hg.rotation.z=args[2]>0?1.3:t<0?.9:t<.15?.9+.4*t/.15:t<.25?1.3-3.3*(t-.15)/.1:-2+2.9*Math.min(1,(t-.25)/.3)**2;}}
 m.root.updateMatrixWorld(true);const inv=m.body.matrixWorld.clone().invert();let count=0;
 for(const root of roots)if(root.visible)root.traverseVisible(o=>{if(!o.isMesh)return;count++;const a=o.geometry.getAttribute('position'), instances=o.isInstancedMesh?o.count:1;
 for(let j=0;j<instances;j++){const matrix=o.matrixWorld.clone();if(o.isInstancedMesh){const im=new T.Matrix4();o.getMatrixAt(j,im);matrix.multiply(im);}matrix.premultiply(inv);
 for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(matrix);for(const h of hulls){const q=v.clone().applyMatrix4(h.inv), norm=q.clone().divide(h.r).length();if(norm>=1)continue;const depth=q.applyMatrix3(h.linear).length()*(1/norm-1);if(depth>worst){worst=depth;pose=JSON.stringify([args,o.geometry.type,v.toArray()]);}}}}
 });meshes=Math.max(meshes,count);for(const a of m.arms)reach=Math.max(reach,a.paw.position.distanceTo(a.shoulder));}
 assert.deepEqual([gs.size,ms.size],resources,`${type}: posing must not allocate decoration resources`);
 rows.push({type,depth:+worst.toFixed(4),reach:+reach.toFixed(4),meshes,pose});
}
console.table(rows.map(({pose,...r})=>r));if(process.argv.includes('--assert'))for(const r of rows){assert.ok(r.depth<=.2,`${r.type} clips ${r.depth}`);assert.ok(r.reach<=.45,`${r.type} reach ${r.reach}`);}
if(process.argv.includes('--json'))console.log(JSON.stringify(rows));
