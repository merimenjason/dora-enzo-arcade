// Dust & Documents: a document-inspection game starring Dora and Enzo.
// Deterministic engine. No rendering, no timers, no globals.
export type Region='ANDES BURROW'|'SALT FLATS'|'HAY VALLEY'|'CANYON RIDGE'|'BELL TOWER'|'NORTH REPUBLIC';
export const REGIONS:Region[]=['ANDES BURROW','SALT FLATS','HAY VALLEY','CANYON RIDGE','BELL TOWER','NORTH REPUBLIC'];
export type Species='chinchilla'|'viscacha'|'fox'|'owl'|'viper';
export const SPECIES:Species[]=['chinchilla','viscacha','fox','owl','viper'];
export type Purpose='visit'|'work'|'transit'|'asylum';
export const PURPOSES:Purpose[]=['visit','work','transit','asylum'];

export type Papers={
 name:string;species:Species;region:Region;purpose:Purpose;
 permitName:string;permitId:string;permitRegion:Region;expires:number;weight:number;statedWeight:number;
 hasPermit:boolean;sealed:boolean;
};
export type Traveler={papers:Papers;line:string;flags:Flag[]};
export type Flag='expired'|'region'|'name'|'permit'|'seal'|'weight'|'species'|'purpose';
export const FLAG_TEXT:Record<Flag,string>={
 expired:'Permit expired.',region:'Region is closed today.',name:'Name does not match the permit.',
 permit:'No permit presented.',seal:'Permit seal is missing.',weight:'Stated weight does not match the scale.',
 species:'Species is barred today.',purpose:'Purpose is not allowed today.'};

export type Rule={id:string;text:string};
export type Day={day:number;quota:number;rules:Rule[];allowed:Region[];bannedSpecies:Species[];allowedPurposes:Purpose[];requirePermit:boolean;checkWeight:boolean;checkSeal:boolean;date:number;dialogue:string};
export const PAY_PER_TRAVELER=5,FINE=7,CITATION_LIMIT=2,RENT=14;
export const rentFor=(day:number)=>RENT+day*3;

const NAMES=['DORA','ENZO','PIPA','MOTA','BRUNO','LUNA','TITO','SALTA','NIEVE','CHUÑO','PEPA','ROCO'];
const WRONG=['DORAA','ENSO','PIPPA','MOTTA','BRUNA','LUNO','TITA','SALTO'];

export class Rng{
 constructor(public seed=7){}
 next(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296}
 pick<T>(list:readonly T[]):T{return list[Math.floor(this.next()*list.length)%list.length]}
 int(min:number,max:number){return min+Math.floor(this.next()*(max-min+1))}
}

export function makeDay(day:number):Day{
 const date=1000+day;
 const allowed:Region[]=day<2?REGIONS.slice():REGIONS.filter((_,i)=>i!==((day*3)%REGIONS.length));
 const bannedSpecies:Species[]=day>=4?[SPECIES[(day+1)%SPECIES.length]]:[];
 const allowedPurposes:Purpose[]=day>=6?PURPOSES.filter(p=>p!=='transit'):PURPOSES.slice();
 const requirePermit=day>=1,checkWeight=day>=3,checkSeal=day>=5;
 const rules:Rule[]=[
  {id:'permit',text:requirePermit?'Every traveler must present a permit.':'Permits are not yet required.'},
  {id:'expired',text:`Permits must not expire before day ${date}.`},
  {id:'name',text:'The permit name must match the traveler.'},
  {id:'region',text:`Open regions today: ${allowed.join(', ')}.`},
 ];
 if(checkWeight)rules.push({id:'weight',text:'The stated weight must match the scale within 15 grams.'});
 if(bannedSpecies.length)rules.push({id:'species',text:`Barred today: ${bannedSpecies.join(', ')}.`});
 if(checkSeal)rules.push({id:'seal',text:'Permits must carry the republic seal.'});
 if(day>=6)rules.push({id:'purpose',text:'Transit permits are suspended.'});
 const dialogue=[
  'ENZO: First day in the booth. Read the rules, stamp the good ones, and we eat tonight.',
  'ENZO: They added a closed region overnight. Nobody told the travelers.',
  'ENZO: Bring the scale up. Smugglers pad their fur.',
  'ENZO: Somebody upstairs is barring a whole species now. I do not like it.',
  'ENZO: No seal, no entry. I know. I know.',
  'ENZO: Transit is suspended. Half the line will not understand why.',
  'ENZO: Last shift, Dora. Whatever you decide today, decide it fast.',
 ][Math.min(day-1,6)];
 return {day,quota:Math.min(4+day,10),rules,allowed,bannedSpecies,allowedPurposes,requirePermit,checkWeight,checkSeal,date,dialogue};
}

export function violations(p:Papers,day:Day):Flag[]{
 const flags:Flag[]=[];
 if(day.requirePermit&&!p.hasPermit)flags.push('permit');
 if(p.hasPermit){
  if(p.expires<day.date)flags.push('expired');
  if(p.permitName!==p.name)flags.push('name');
  if(p.permitRegion!==p.region)flags.push('region');
  if(day.checkSeal&&!p.sealed)flags.push('seal');
 }
 if(!day.allowed.includes(p.region))flags.push('region');
 if(day.checkWeight&&Math.abs(p.statedWeight-p.weight)>15)flags.push('weight');
 if(day.bannedSpecies.includes(p.species))flags.push('species');
 if(!day.allowedPurposes.includes(p.purpose))flags.push('purpose');
 return [...new Set(flags)];
}

export function makeTraveler(day:Day,rng:Rng,forceClean=false):Traveler{
 const name=rng.pick(NAMES),species=rng.pick(SPECIES);
 const region=rng.pick(day.allowed),purpose=rng.pick(day.allowedPurposes);
 const weight=rng.int(380,760);
 const papers:Papers={name,species,region,purpose,permitName:name,permitId:`CR-${rng.int(1000,9999)}`,
  permitRegion:region,expires:day.date+rng.int(1,40),weight,statedWeight:weight,hasPermit:true,sealed:true};
 const clean=forceClean||rng.next()<.4;
 if(!clean){
  const faults:Flag[]=['expired','name','region'];
  if(day.requirePermit)faults.push('permit');
  if(day.checkWeight)faults.push('weight');
  if(day.checkSeal)faults.push('seal');
  if(day.bannedSpecies.length)faults.push('species');
  if(day.allowedPurposes.length<PURPOSES.length)faults.push('purpose');
  const fault=rng.pick(faults);
  if(fault==='expired')papers.expires=day.date-rng.int(1,30);
  else if(fault==='name')papers.permitName=rng.pick(WRONG);
  else if(fault==='region'){const closed=REGIONS.filter(r=>!day.allowed.includes(r));
   if(closed.length){papers.region=rng.pick(closed);papers.permitRegion=papers.region}else{papers.permitRegion=rng.pick(REGIONS.filter(r=>r!==papers.region))}}
  else if(fault==='permit')papers.hasPermit=false;
  else if(fault==='weight')papers.statedWeight=weight+rng.int(20,90)*(rng.next()<.5?-1:1);
  else if(fault==='seal')papers.sealed=false;
  else if(fault==='species')papers.species=day.bannedSpecies[0];
  else if(fault==='purpose')papers.purpose=PURPOSES.find(p=>!day.allowedPurposes.includes(p))!;
 }
 const flags=violations(papers,day);
 const line=flags.length?rng.pick(['I have travelled a long way.','Please, my family is waiting.','The office was closed when I asked.','It was fine at the last checkpoint.']):
  rng.pick(['Good morning, inspector.','Cold today.','Everything is in order, I think.','Glory to the republic.']);
 return {papers,line,flags};
}

export type Verdict={correct:boolean;approved:boolean;reason:string;flags:Flag[]};
export class CheckpointGame{
 state:'briefing'|'shift'|'report'|'ending'='briefing';
 day:Day;rng:Rng;traveler:Traveler;processed=0;citations=0;credits=12;approved=0;denied=0;
 verdict:Verdict|null=null;log:string[]=[];detained=0;
 constructor(public seed=7,public lastDay=7){this.rng=new Rng(seed);this.day=makeDay(1);this.traveler=makeTraveler(this.day,this.rng)}
 get quotaLeft(){return Math.max(0,this.day.quota-this.processed)}
 get accuracy(){return this.processed?Math.round(((this.processed-this.citations)/this.processed)*100):100}
 begin(){if(this.state!=='briefing')return;this.state='shift';this.verdict=null}
 decide(approve:boolean){
  if(this.state!=='shift')return null;
  const flags=this.traveler.flags,shouldDeny=flags.length>0,correct=approve!==shouldDeny;
  this.processed++;if(approve)this.approved++;else this.denied++;
  if(!correct){this.citations++;this.credits=Math.max(0,this.credits-FINE)}
  this.credits+=PAY_PER_TRAVELER;
  const reason=correct?(shouldDeny?'Correctly denied. '+flags.map(f=>FLAG_TEXT[f]).join(' '):'Correctly approved. Papers are in order.')
   :(shouldDeny?'CITATION: you let a bad file through. '+flags.map(f=>FLAG_TEXT[f]).join(' '):'CITATION: those papers were valid.');
  this.verdict={correct,approved:approve,reason,flags};
  this.log.push(`${this.traveler.papers.name}: ${approve?'APPROVED':'DENIED'} — ${correct?'correct':'citation'}`);
  if(this.citations>CITATION_LIMIT)this.credits=Math.max(0,this.credits-FINE);
  return this.verdict;
 }
 detain(){
  if(this.state!=='shift'||!this.verdict||this.verdict.approved||!this.traveler.flags.length)return false;
  this.detained++;this.credits+=1;return true;
 }
 nextTraveler(){
  if(this.state!=='shift')return;
  this.verdict=null;
  if(this.processed>=this.day.quota){this.endDay();return}
  this.traveler=makeTraveler(this.day,this.rng);
 }
 endDay(){this.state='report';this.credits=Math.max(0,this.credits-rentFor(this.day.day))}
 nextDay(){
  if(this.state!=='report')return;
  if(this.day.day>=this.lastDay||this.credits<=0){this.state='ending';return}
  this.day=makeDay(this.day.day+1);this.processed=0;this.citations=0;this.approved=0;this.denied=0;
  this.traveler=makeTraveler(this.day,this.rng);this.state='briefing';this.verdict=null;
 }
 get ending(){
  if(this.credits<=0)return {title:'BOOTH CLOSED',text:'The rent went unpaid. Dora and Enzo lose the booth and walk south with nothing but their fur.'};
  if(this.credits>=80)return {title:'PAPERS IN ORDER',text:'Dora stamps the last permit of the last shift. The savings buy two tickets north, legally, with every seal in place.'};
  return {title:'ANOTHER WINTER',text:'The booth stays open, the hay is thin, and Enzo says next season will be better. He always says that.'};
 }
}
