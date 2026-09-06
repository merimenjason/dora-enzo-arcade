import {FLIGHT,FlappyGame} from './flappy-game';
const W=FLIGHT.width,H=FLIGHT.height;
export function drawFlight(c:CanvasRenderingContext2D,g:FlappyGame,t:number){
 c.clearRect(0,0,W,H);const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#719eb4');sky.addColorStop(.66,'#eed4ad');sky.addColorStop(1,'#d6a478');c.fillStyle=sky;c.fillRect(0,0,W,H);
 c.fillStyle='#ffedbe';c.beginPath();c.arc(724,100,42,0,Math.PI*2);c.fill();
 for(let layer=0;layer<3;layer++){const offset=g.distance*(.09+layer*.09)%400;c.fillStyle=['#8395a0','#aa9d96','#c09c80'][layer];c.beginPath();c.moveTo(-400,H);for(let i=-1;i<5;i++){const x=i*400-offset;c.lineTo(x,340+layer*38);c.lineTo(x+75,210+layer*53);c.lineTo(x+155,245+layer*44);c.lineTo(x+205,185+layer*65);c.lineTo(x+290,330+layer*35)}c.lineTo(W+400,H);c.closePath();c.fill()}
 // Sparse roadside cacti and scrub in the parallax distance.
 for(let i=0;i<9;i++){const x=((i*139-g.distance*.4)%1251+1251)%1251-100;const y=464;c.strokeStyle='#7c886a';c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(x,y-45);c.moveTo(x,y-18);c.lineTo(x-13,y-18);c.lineTo(x-13,y-33);c.moveTo(x,y-25);c.lineTo(x+12,y-25);c.lineTo(x+12,y-40);c.stroke()}
 for(const gate of g.gates){const top=gate.center-gate.gap/2,bottom=gate.center+gate.gap/2,x=gate.x;
 // Stylized checkpoint columns, with bold striped lips around each gap.
 for(const [y,h] of [[0,top],[bottom,FLIGHT.ground-bottom]]){c.fillStyle='#435d62';c.fillRect(x,y,74,h);c.fillStyle='#658084';for(let k=0;k<4;k++)c.fillRect(x+7+k*18,y,4,h);c.fillStyle='#34494e';c.fillRect(x-5,y===0?top-16:y,84,16);c.save();c.beginPath();c.rect(x-5,y===0?top-13:y+3,84,10);c.clip();c.strokeStyle='#ebbb69';c.lineWidth=7;for(let k=-2;k<9;k++){c.beginPath();c.moveTo(x+k*16,y===0?top-20:y);c.lineTo(x+k*16+20,y===0?top:y+20);c.stroke()}c.restore()}
 c.fillStyle='#f4e4bc';c.fillRect(x+16,bottom+30,42,28);c.fillStyle='#3a515b';c.font='bold 15px system-ui';c.textAlign='center';c.fillText(String(gate.id+1).padStart(2,'0'),x+37,bottom+50);
 if(!gate.passed){c.fillStyle='#fff2b4';c.font='25px system-ui';c.fillText('✦',x+37,gate.center+8)}
 }
 c.fillStyle='#bc8c5f';c.fillRect(0,FLIGHT.ground,W,H-FLIGHT.ground);c.fillStyle='#ead09c';c.fillRect(0,FLIGHT.ground,W,5);for(let i=0;i<35;i++){c.fillStyle=i%2?'#ab7c53':'#d4ae78';c.fillRect(((i*41-g.distance)%1000+1000)%1000,511+i%3*7,12,3)}
 if(g.state==='won'){c.fillStyle='#2a665d';c.fillRect(340,145,300,125);c.strokeStyle='#eddfb8';c.lineWidth=3;c.strokeRect(350,155,280,105);c.fillStyle='#fff3d5';c.font='bold 19px system-ui';c.textAlign='center';c.fillText('WELCOME TO THE',490,197);c.font='bold 34px Georgia';c.fillText('USA',490,239)}
 if(g.flapTime>0){const progress=1-g.flapTime/.23;c.save();c.globalAlpha=1-progress;for(const x of FLIGHT.x)for(let i=0;i<5;i++){c.fillStyle='#fff5df';c.beginPath();c.ellipse(x-30-progress*40-i*6,g.y+12+Math.sin(i*2)*progress*20,3+progress*3,2,0,0,Math.PI*2);c.fill()}c.restore()}
 if(g.perfectTime>0){c.save();c.globalAlpha=Math.min(1,g.perfectTime*3);c.fillStyle='#fff3c2';c.strokeStyle='#76562f';c.lineWidth=4;c.font='bold 25px Georgia';c.textAlign='center';c.strokeText('✦ PERFECT PAIR +50',450,88);c.fillText('✦ PERFECT PAIR +50',450,88);for(let i=0;i<8;i++){const a=i*Math.PI/4,r=(1.25-g.perfectTime)*70;c.fillText('·',450+Math.cos(a)*r,88+Math.sin(a)*r)}c.restore()}
 if(g.state==='lost'){c.fillStyle=`rgba(198,79,54,${Math.max(0,.22-g.endTime*.5)})`;c.fillRect(0,0,W,H);c.strokeStyle='#fff4ce';c.lineWidth=3;for(const [i,x]of FLIGHT.x.entries())if(g.hitHero<0||g.hitHero===i){c.beginPath();c.arc(x,g.y,33,0,Math.PI*2);c.stroke()}c.fillStyle='#fff0c8';c.font='bold 15px system-ui';c.textAlign='center';c.fillText(g.hitHero<0?'Watch the '+g.hitReason:(g.hitHero===0?'Dora':'Enzo')+' clipped the checkpoint',250,Math.max(55,g.y-47))}
 for(let i=1;i>=0;i--)chinchilla(c,FLIGHT.x[i],g.state==='ready'?g.y+Math.sin(t*2)*7:g.y,i===0,g.vy,g.flapTime>0||g.state==='ready',t);
}
function chinchilla(c:CanvasRenderingContext2D,x:number,y:number,white:boolean,vy:number,flap:boolean,t:number){c.save();c.translate(x,y);c.rotate(Math.max(-.27,Math.min(.45,vy/1000)));const coat=white?'#f4efe4':'#737a83',shade=white?'#d3cbbf':'#505a66';
 const ellipse=(x:number,y:number,rx:number,ry:number,color:string,angle=0)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill()};
 ellipse(-29,10,24,10,shade,-.5);ellipse(-43,5,12,10,coat,-.7);
 // Little paper wings make the shared flap visible.
 ellipse(-6,flap?-23:0,10,23,'#fff0cf',flap?-.8:.9);c.strokeStyle='#c9b48e';c.lineWidth=1;c.beginPath();c.moveTo(-7,0);c.lineTo(-16,flap?-35:-8);c.stroke();
 ellipse(0,1,25,21,shade);ellipse(1,-1,24,21,coat);for(let j=0;j<12;j++){const a=j*Math.PI/6;ellipse(Math.cos(a)*21,Math.sin(a)*17,5,4,coat)}
 ellipse(7,-24,9,17,coat,-.2);ellipse(8,-25,5,12,white?'#d6aa9f':'#b49b99',-.2);ellipse(24,-17,8,14,coat,.55);ellipse(25,-18,4,9,'#c3a29a',.55);ellipse(19,1,13,14,coat);ellipse(22,-4,3.7,4,'#222c35');ellipse(23,-5,1.2,1.3,'#fff');ellipse(32,4,3,2,'#a77d78');ellipse(8,20,8,3,'#c09b91');c.strokeStyle=white?'#9b9187':'#bec3c6';c.lineWidth=.8;for(let j=0;j<3;j++){c.beginPath();c.moveTo(28,7);c.lineTo(43,2+j*5);c.stroke()}
 c.fillStyle=white?'#648e88':'#bd7959';c.fillRect(-15,4,12,12);c.fillStyle='#f7e7b8';c.font='bold 8px system-ui';c.textAlign='center';c.fillText(white?'D':'E',-9,13);c.restore();}
