import type {SkillKind} from './saga-game';
type Point={x:number;y:number};
const COLOURS:Record<string,string>={dora:'#ffe27d',enzo:'#ffd47b',pip:'#b7f88a',bramble:'#ebbf62',flint:'#a9eaff',mossy:'#edc974',cinder:'#ff9b4d',frost:'#deefff',clover:'#b1f375',nutmeg:'#efae54',pebble:'#adc8ed',thistle:'#d0a1ff',willow:'#e7ef7e',ember:'#ffd59c',gale:'#b6eaff',aurora:'#ffe9a0',onyx:'#ba8cff',zephyr:'#cae6ff',fennel:'#b7e67d',sable:'#9feee9'};
/** A single continuous cast envelope: gather, impact, then dissipate. No character frame swaps. */
export function drawSagaSkillFx(c:CanvasRenderingContext2D,id:string,kind:SkillKind,origin:Point,targets:Point[],unit:number,phase:number){
 const p=Math.min(1,phase),impact=Math.max(0,Math.min(1,(p-.12)/.22)),fade=Math.min(1,p/.08)*Math.min(1,(1-p)/.35),colour=COLOURS[id]??'#ffe29a';
 c.save();c.globalAlpha=fade;c.strokeStyle=colour;c.fillStyle=colour;c.lineWidth=Math.max(2,unit*.024);c.lineCap='round';c.lineJoin='round';c.shadowColor=colour;c.shadowBlur=unit*.04;
 const line=(a:Point,b:Point,bend=0)=>{c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-bend,b.x,b.y);c.stroke();};
 const leaf=(x:number,y:number,size:number,angle:number)=>{c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.ellipse(0,0,size,size*.4,0,0,Math.PI*2);c.fill();c.restore();};
 const flower=(x:number,y:number,r:number)=>{for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.ellipse(x+Math.cos(a)*r*.5,y+Math.sin(a)*r*.5,r*.45,r*.45,0,0,Math.PI*2);c.fill();}};
 const sparks=(at:Point,count=8)=>{for(let i=0;i<count;i++){const a=i*2.399,r=unit*(.16+.7*p);c.globalAlpha=fade*(1-p)*.7;leaf(at.x+Math.cos(a)*r,at.y+Math.sin(a)*r-unit*p*.15,unit*.025,a+p);}};
 if(p<.16){c.globalAlpha=fade*.6;c.beginPath();c.arc(origin.x,origin.y,unit*(.3-.15*p/.16),-Math.PI*.8,Math.PI*.6);c.stroke();sparks(origin,5);c.restore();return;}
 const end=targets[0]??{x:origin.x+unit,y:origin.y};
 if(kind==='chain'){
  let prev=origin;for(const [i,t] of targets.slice(0,3).entries()){c.globalAlpha=fade*(1-i*.18);line(prev,t,unit*.25*impact);flower(t.x,t.y,unit*.1*impact);sparks(t,5);prev=t;}
 }else if(kind==='ward'){
  const all=[origin,...targets],x=all.reduce((a,t)=>a+t.x,0)/all.length,y=Math.max(...all.map(t=>t.y))+unit*.45;
  const r=Math.max(unit*.9,(Math.max(...all.map(t=>t.x))-Math.min(...all.map(t=>t.x)))/2+unit*.65)*(.6+.4*impact);
  c.globalAlpha=fade*.14;c.beginPath();c.ellipse(x,y,r,unit*1.25,0,Math.PI,Math.PI*2);c.fill();c.globalAlpha=fade*.85;c.stroke();
  for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6,xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*unit*1.25;if(id==='pebble'){c.strokeRect(xx-unit*.045,yy-unit*.045,unit*.09,unit*.09);}else flower(xx,yy,unit*.045);}
 }else if(['heal','mend','cleanse','rally'].includes(kind)){
  for(const t of targets){c.globalAlpha=fade*.7;c.beginPath();c.ellipse(t.x,t.y+unit*.35,unit*(.35+.3*impact),unit*.13,0,0,Math.PI*2);c.stroke();
   for(let i=0;i<5;i++){const a=i*2.399+p*1.2,x=t.x+Math.cos(a)*unit*.4,y=t.y+Math.sin(a)*unit*.25-unit*p*.4;
    if(kind==='rally'){c.font=`${unit*.16}px Georgia`;c.fillText('♪',x,y);}else if(id==='frost'||id==='sable'){line({x:x-unit*.04,y},{x:x+unit*.04,y});line({x,y:y-unit*.04},{x,y:y+unit*.04});}else flower(x,y,unit*.04);}
   if(kind==='mend'||kind==='cleanse'){c.globalAlpha=fade*.35;c.beginPath();c.ellipse(t.x,t.y,unit*.5,unit*.7,0,0,Math.PI*2);c.stroke();}
  }
 }else if(['bramble','clover','gale','aurora'].includes(id)){
  for(const t of targets){const rain=id==='bramble',count=id==='aurora'||rain?3:1;
   for(let i=0;i<count;i++){const a=rain?{x:t.x-unit*.3+i*unit*.25,y:t.y-unit*1.2}:origin,b={x:t.x+(i-(count-1)/2)*unit*.15,y:t.y};
    const tip={x:a.x+(b.x-a.x)*impact,y:a.y+(b.y-a.y)*impact};line(a,tip,id==='gale'?unit*.08:0);
    c.beginPath();c.moveTo(tip.x-unit*.09,tip.y-unit*.05);c.lineTo(tip.x,tip.y);c.lineTo(tip.x-unit*.09,tip.y+unit*.05);c.stroke();if(id==='clover')flower(tip.x,tip.y,unit*.05);
   }sparks(t,5);
  }
 }else if(kind==='strike'||id==='cinder'){
  if(id==='thistle'){line(origin,{x:origin.x+(end.x-origin.x)*impact,y:end.y});}else if(id==='mossy'){c.beginPath();c.ellipse(end.x,end.y,unit*.3*impact,unit*.4*impact,0,0,Math.PI*2);c.stroke();}
  else{const radius=unit*(id==='cinder'?1.1:.85)*impact;c.lineWidth=unit*.07*fade;c.beginPath();c.arc(end.x-unit*.18,end.y,radius,-1.35,1.35);c.stroke();c.lineWidth=unit*.025;c.beginPath();c.arc(end.x-unit*.18,end.y,radius*.8,-1.3,1.3);c.stroke();}
  sparks(end,id==='cinder'?15:9);
 }else{
  for(const t of targets){c.globalAlpha=fade*.7;
   if(id==='nutmeg'){for(let i=0;i<5;i++){c.globalAlpha=fade*.14;const x=t.x+Math.sin(i*2.4)*unit*.5*impact,y=t.y+Math.cos(i*2.4)*unit*.35;const g=c.createRadialGradient(x,y,0,x,y,unit*.4);g.addColorStop(0,colour);g.addColorStop(1,'transparent');c.fillStyle=g;c.beginPath();c.arc(x,y,unit*.4,0,Math.PI*2);c.fill();}}
   else{c.beginPath();c.arc(t.x,t.y,unit*(.25+.65*impact),-.7+p,Math.PI*1.5+p);c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4+p*.5,x=t.x+Math.cos(a)*unit*.65*impact,y=t.y+Math.sin(a)*unit*.65*impact;if(id==='willow')flower(x,y,unit*.045);else{line({x:x-unit*.05,y},{x:x+unit*.05,y});line({x,y:y-unit*.05},{x,y:y+unit*.05});}}}
   sparks(t,7);
  }
 }
 c.restore();
}
