import {
  gridSpots, moveActions, totalTurns, secret, wait, distance, type Action, type Edge,
  type Difficulty, type Mission, type Rules, type State, type View,
} from './arcade-originals-rules.js';

type Call = readonly [from: number, to: number, reply: string, after?: number];
type Case = Mission & { calls: Call[]; faults: number[]; origin: number };
type Wire = State & {
  dora: number; enzo: number; known: number[]; delivered: number[]; faults: number[];
  fuses: number; bypass: number; expires: number; archive: number; cords: number[]; log: string[];
  difficulty: Difficulty; work: string;
};
const spots = gridSpots(['Exchange','Signal tower','Lighthouse','Pier','Junction','Ferry landing','Clinic','Pump house','Breakwater']);
const networks: Edge[][] = [
  [[0,1],[0,3],[1,4],[1,2],[2,5],[3,4],[3,6],[4,5],[4,7],[5,8],[6,7],[7,8]],
  [[0,3],[0,4],[1,4],[1,2],[2,5],[3,6],[4,7],[5,8],[6,7],[7,8],[4,5]],
  [[0,1],[0,3],[1,2],[2,5],[3,4],[4,7],[4,5],[5,8],[7,8],[6,7],[3,6]],
  [[0,1],[1,2],[0,3],[3,4],[4,1],[2,5],[5,8],[4,7],[7,8],[6,7],[3,6]],
];
const dock: Call = [3,7,'The pier keeper sends the floodgate key to the pump crew.'];
const lamp: Call = [2,5,'The keeper gives the ferry a bearing between the rocks.'];
const nurse: Call = [6,3,'The clinic asks the pier to clear a stretcher route.'];
const tide: Call = [8,1,'The breakwater watch reads out the next swell.'];
const engine: Call = [5,7,'The ferry engineer requests a portable pump.'];
const search: Call = [1,3,'The tower passes along a report of a lantern at sea.'];
const records: Call = [7,6,'The pump crew found the missing crew list.'];
const shore: Call = [8,2,'The watch tells the keeper where the signal cable broke.'];
const later = ([a,b,line]: Call, after: number): Call => [a,b,line,after];
const files: [string,string,Call[],number[],number,number,number][] = [
  ['The first ring','One cord still works. Hear the pier keeper and send their request to the pump house.',[dock],[],3,8,3],
  ['Dry feet','The clinic needs a clear pier as the water rises. The pier’s terminal went quiet.',[dock,nurse],[3],4,11,5],
  ['A light to steer by','The ferry wants a bearing. A tower report follows only after the keeper gets through.',[lamp,later(search,0)],[2],4,12,6],
  ['The missing crossing','Three callers are waiting, but the ferry’s request only arrives after the first bearing.',[lamp,dock,later(engine,0)],[2,5],3,15,8],
  ['The island clinic','The nurse has a message, and the clinic terminal needs drying first.',[nurse,records],[6],3,12,6],
  ['Call at the breakwater','Someone has seen a small lamp on the waves. Put the right eyes on it.',[tide,search],[8],7,12,6],
  ['Pump before dusk','The only spare pump is on the wrong side of the island. Send both crews the same plan.',[engine,dock,later(records,0)],[5,7],4,16,9],
  ['Names on the list','The list is complete, but nobody can agree which boat carried it. Listen before joining the lines.',[records,nurse,tide],[6,8],3,16,9],
  ['Above the spray','Dora has to walk the cliff to restore the keeper’s line.',[lamp,shore],[2,8],3,17,9],
  ['Two lanterns','Two reports look alike until one caller gives a bearing. Send the shore report and dispatch the ferry.',[shore,later(lamp,0),search],[5,1],4,17,9],
  ['The empty cable hut','Repairing the far terminals takes time. Use the temporary jumper for a single report.',[tide,engine,later(nurse,1)],[8,7],4,17,9],
  ['Long-distance silence','The headland has gone quiet. Carry three reports over the repaired loop.',[shore,later(lamp,0),later(engine,1)],[2,5],0,20,12],
  ['Outer water','The watch and the ferry both need the keeper tonight.',[shore,later(lamp,0),dock],[8,2],3,18,11],
  ['The stretcher boat','The clinic needs a route while the pump crew needs the landing. Keep the two pairs apart.',[nurse,engine,tide],[6,5],4,18,10],
  ['Before daybreak','The reports are ready, but one jack cannot hold two cords. Move the live line as replies arrive.',[records,later(nurse,0),dock,later(search,2)],[3,7],6,20,12],
  ['Bring them in','The ferry is in sight. Route bearings, a pump and a crew list before the final swell.',[shore,later(lamp,0),later(engine,1),later(records,2)],[2,5,7],4,24,15],
];
export const CASES: Case[] = files.map(([title,story,calls,faults,origin,limit,par],i)=>({title,story,calls,faults,origin,limit,par,chapter:Math.floor(i/4)}));
const available=(c:Call,s:Wire)=>c[3]===undefined||s.delivered.includes(c[3]);
function signal(m:Case,s:Wire,a:number,b:number) {
  const active=(v:number)=>!s.faults.includes(v)||(v===s.bypass&&s.turn<=s.expires);
  return active(a)&&active(b)&&distance(networks[m.chapter].filter(([x,y])=>active(x)&&active(y)),a,b)<12;
}
function actions(m:Case,s:Wire,h:'dora'|'enzo'):Action[] {
  if(s.phase!=='playing')return [];
  if(h==='dora')return [
    wait,...moveActions(networks[m.chapter],s.dora,spots,'Walk to'),
    ...(s.faults.includes(s.dora)?[
      ...(s.fuses ? [{id:'fix',text:`Repair the ${spots[s.dora].name} relay`,to:s.dora}] : []),
      {id:'bypass',text:'Bridge the cut for two turns',to:s.dora},
    ]:[]),
  ];
  const out=[wait];
  m.calls.forEach((c,i)=>{
    if(s.delivered.includes(i)||!available(c,s))return;
    if(!s.known.includes(i))out.push({id:`hear:${i}`,text:`Answer ${spots[c[0]].name}`,to:c[0]});
    else if(!s.cords.includes(i))out.push({id:`plug:${i}`,text:`Patch ${spots[c[0]].name} to ${spots[c[1]].name}`,to:c[1]});
  });
  if(!s.bonus)out.push({id:'archive',text:`Listen to the old line at ${spots[s.archive].name}`,to:s.archive});
  return out;
}
function step(m:Case,s:Wire,p:{dora:string;enzo:string}):Wire {
  const n:Wire={...s,turn:s.turn+1,notes:[],known:[...s.known],delivered:[...s.delivered],faults:[...s.faults],cords:[...s.cords],log:[...s.log],work:p.dora};
  if(p.dora.startsWith('go:'))n.dora=Number(p.dora.slice(3));
  else if(p.dora==='fix'){
    n.fuses--;n.faults=n.faults.filter(v=>v!==n.dora);n.notes.push({text:`${spots[n.dora].name} is back on the line.`,tone:'good'});
  } else if(p.dora==='bypass'){
    n.bypass=n.dora;n.expires=n.turn+1;n.notes.push({text:'The jumper gives that terminal two turns.',tone:'good'});
  }
  const [act,idx]=p.enzo.split(':'),i=Number(idx),call=m.calls[i];
  if(act==='hear'){
    if(signal(m,n,0,call[0])){
      n.known.push(i);n.notes.push({text:`${spots[call[0]].name}: please put us through to ${spots[call[1]].name}.`});
    } else n.notes.push({text:`${spots[call[0]].name} is calling through a damaged route.`,tone:'warning'});
  } else if(act==='plug'){
    n.cords=n.cords.filter((v)=>!m.calls[v].slice(0,2).some(a=>a===call[0]||a===call[1]));
    n.cords=[...n.cords.slice(-1),i]; n.enzo=0;
  } else if(act==='archive'){
    if(signal(m,n,0,n.archive)){n.bonus=true;n.notes.push({text:'An old recording: the lighthouse crew singing the ferry in.',tone:'good'});}
    else n.notes.push({text:'The old recording cannot reach the exchange through a cut.',tone:'warning'});
  }
  for(const k of n.cords){
    const c=m.calls[k];
    if(signal(m,n,c[0],c[1])){
      n.delivered.push(k);n.log.push(c[2]);n.notes.push({text:c[2],tone:'good'});
    } else n.notes.push({text:`The cord to ${spots[c[1]].name} is live, but a relay is cut.`,tone:'warning'});
  }
  n.cords=n.cords.filter(k=>!n.delivered.includes(k));
  if(n.delivered.length===m.calls.length)n.phase='clear';
  else if(n.turn>=totalTurns(m,n.difficulty))n.phase='lost';
  return n;
}
function view(m:Case,s:Wire):View{
  const urgent=m.calls.findIndex((c,i)=>!s.delivered.includes(i)&&available(c,s));
  const call=m.calls[urgent];
  const fault=s.faults.find((x)=>x===call?.[0]||x===call?.[1])??s.faults[0];
  return{
    dora:s.dora,enzo:0,doraPose:s.phase==='clear'?'victory':s.work==='fix'||s.work==='bypass'?'ability':undefined,
    enzoPose:s.phase==='clear'?'victory':s.notes.some(n=>n.tone==='good')?'interact':undefined,
    links:[...networks[m.chapter].map(edge=>({edge,style:edge.some(v=>s.faults.includes(v)&&!(v===s.bypass&&s.turn<=s.expires))?'closed' as const:'open' as const})),
      ...s.cords.map(i=>({edge:[m.calls[i][0],m.calls[i][1]] as Edge,style:'linked' as const}))],
    marks:[{at:0,art:5,label:'Exchange',kind:'safe'}, ...s.faults.map(at=>({at,art:0,label:'Cut relay',kind:'warning' as const})),
      ...m.calls.flatMap((c,i)=>!s.delivered.includes(i)&&available(c,s)?[{at:c[0],art:3,label:'Waiting caller',kind:'focus' as const}]:[])],
    actors:[{id:'keeper',at:2,art:1,name:'Ione, lighthouse keeper'},{id:'pump',at:7,art:2,name:'Otis, pump mechanic'}],
    facts:[{label:'Calls delivered',value:`${s.delivered.length} / ${m.calls.length}`},{label:'Cut relays',value:String(s.faults.length)},{label:'Fuses',value:String(s.fuses)},{label:'Turns left',value:String(totalTurns(m,s.difficulty)-s.turn)}],
    objective:'Deliver every dispatch before the swell.',journal:s.log,
    preview:call?`${spots[call[0]].name} is waiting${s.known.includes(urgent)?` for ${spots[call[1]].name}`:''}.`:'The harbor crews are connected.',
    hint:fault!==undefined&&call&&!signal(m,s,call[0],s.known.includes(urgent)?call[1]:0)?
      `Dora can ${s.fuses?'repair or bridge':'temporarily bridge'} the relay at ${spots[fault].name}.`:call?(s.known.includes(urgent)?'Enzo can patch the named pair.':'Enzo can answer the waiting call.'):'Every crew has its orders.',
  };
}
export const nightWire:Rules<Wire,Case>={
  id:'night-wire',title:'The Night Wire',ending:'Ione saw the ferry’s lights pass the breakwater. The crew read their names back over the wire, then the exchange fell quiet.',caption:'Listen. Patch. Bring the ferry home.',spots,
  chapterNames:['Tidal harbor','Island service loop','Cliff cable','Outer breakwater'],
  chapters:['Put each caller through to the crew they ask for.','Repair cut relays while keeping the harbor talking.','Use a jumper for an urgent call, or repair for the long night.','The last reports will bring the ferry home.'],
  heroHelp:{dora:'Walk the line, repair a cut relay or bridge it temporarily.',enzo:'Answer each caller to learn their destination. Patch the matching jacks.'},
  stepLabel:'Advance calls',maxPlan:1,missions:CASES,
  start(i,difficulty,seed){
    const m=CASES[i];
    return{turn:0,phase:'playing',notes:[],bonus:false,dora:m.origin,enzo:0,known:[],delivered:[],faults:[...m.faults],fuses:Math.max(0,m.faults.length-(m.faults.length>1&&difficulty!=='story'?1:0)),bypass:-1,expires:0,archive:secret(i,seed,[1,2,6,8]),cords:[],log:[],difficulty,work:''};
  },
  actions:(i,s,h)=>actions(CASES[i],s,h),
  step:(i,s,p)=>step(CASES[i],s,p),
  view:(i,s)=>view(CASES[i],s),
  rank(i,s){
    const m=CASES[i],next=m.calls.findIndex((c,k)=>available(c,s)&&!s.delivered.includes(k));
    const call=m.calls[next], priorities=call?[call[0],...(s.known.includes(next)?[call[1]]:[])]:[];
    const cuts=priorities.filter(x=>s.faults.includes(x));
    return s.delivered.length*65+s.known.length*6-s.faults.length*9-
      (cuts.length?Math.min(...cuts.map(x=>distance(networks[m.chapter],s.dora,x)))*1.5:0)-s.turn*.6+(s.bonus?1:0);
  },
  signature:s=>[s.dora,s.known,s.delivered,s.faults,s.fuses,s.bypass,s.expires,s.cords,s.bonus,s.turn].join('|'),
};
