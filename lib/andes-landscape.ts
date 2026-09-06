import * as T from 'three';

/** Dry Andean plateau: low ground detail keeps the survival arena readable. */
export function addAndesLandscape(scene:T.Scene){
 let seed=7183;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 scene.background=new T.Color('#94a6b7');scene.fog=new T.Fog('#94a6b7',65,145);
 const ground=new T.PlaneGeometry(180,180,90,90);ground.rotateX(-Math.PI/2);
 const positions=ground.getAttribute('position'),colors=new Float32Array(positions.count*3),color=new T.Color();
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),outside=Math.max(0,Math.max(Math.abs(x),Math.abs(z))-29);positions.setY(i,-.13+Math.min(outside*.18,2)*Math.sin(x*.19)*Math.cos(z*.17));const wash=Math.sin(x*.23+Math.sin(z*.2)*2)*Math.cos(z*.16),grain=random()*.045;color.setHSL(.075+wash*.013,.15+grain,.31+wash*.035+grain);colors.set([color.r,color.g,color.b],i*3)}
 ground.setAttribute('color',new T.BufferAttribute(colors,3));ground.computeVertexNormals();const floor=new T.Mesh(ground,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));floor.receiveShadow=true;scene.add(floor);
 const dummy=new T.Object3D(),rockGeo=new T.IcosahedronGeometry(1,0),stoneMat=new T.MeshStandardMaterial({color:0x8a8076,roughness:1,flatShading:true});
 const scree=new T.InstancedMesh(rockGeo,stoneMat,260);for(let i=0;i<260;i++){const x=(random()-.5)*58,z=(random()-.5)*58,r=.08+random()*.22;dummy.position.set(x,-.08,z);dummy.scale.set(r,.05+random()*.13,r*.7);dummy.rotation.set(random(),random()*6,random());dummy.updateMatrix();scree.setMatrixAt(i,dummy.matrix)}scene.add(scree);
 // Large outcrops sit beyond movement bounds; no invisible obstacles in combat.
 const outcrops=new T.InstancedMesh(rockGeo,stoneMat,100);for(let i=0;i<100;i++){const side=i%4,u=(random()-.5)*65,v=30+random()*5;dummy.position.set(side<2?(side===0?-v:v):u,.1,side<2?u:(side===2?-v:v));dummy.scale.set(.6+random()*1.8,.6+random()*2, .7+random()*1.3);dummy.rotation.set(random()*.3,random()*6,random()*.3);dummy.updateMatrix();outcrops.setMatrixAt(i,dummy.matrix)}scene.add(outcrops);
 const grassGeo=new T.ConeGeometry(.09,.42,3),grassMat=new T.MeshStandardMaterial({color:0x9a9567,roughness:1});const tussocks=new T.InstancedMesh(grassGeo,grassMat,360);for(let i=0;i<90;i++){const x=(random()-.5)*57,z=(random()-.5)*57;for(let j=0;j<4;j++){dummy.position.set(x+(random()-.5)*.3,.06,z+(random()-.5)*.3);dummy.scale.setScalar(.65+random()*.55);dummy.rotation.set((random()-.5)*.6,random()*6,(random()-.5)*.6);dummy.updateMatrix();tussocks.setMatrixAt(i*4+j,dummy.matrix)}}scene.add(tussocks);
 // Layered angular ridges and pale summit caps around the plateau.
 const peakGeo=new T.ConeGeometry(1,1,5),ridgeMat=new T.MeshStandardMaterial({color:0x696d78,roughness:1,flatShading:true}),farMat=new T.MeshStandardMaterial({color:0x7c899b,roughness:1,flatShading:true}),snowMat=new T.MeshStandardMaterial({color:0xd3d9dc,roughness:1});
 for(let i=0;i<40;i++){const a=i*Math.PI*2/40,r=44+(i%2)*17+random()*5,h=9+random()*14,w=6+random()*8;const peak=new T.Mesh(peakGeo,i%2?farMat:ridgeMat);peak.position.set(Math.cos(a)*r,h/2-1,Math.sin(a)*r);peak.scale.set(w,h,w*.72);peak.rotation.y=a;scene.add(peak);if(h>17){const cap=new T.Mesh(peakGeo,snowMat);cap.position.copy(peak.position);cap.position.y=h-1-h*.13;cap.scale.set(w*.27,h*.27,w*.72*.27);cap.rotation.y=a;scene.add(cap)}}
}
