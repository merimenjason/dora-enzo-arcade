'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckpointGame,FLAG_TEXT,PAY_PER_TRAVELER,FINE,rentFor,type Flag} from '../../lib/checkpoint-game';
import {EscapeSound} from '../../lib/escape-sound';
import type {CheckpointScene} from '../../lib/checkpoint-scene';

export default function Checkpoint(){
 const game=useRef(new CheckpointGame(Math.floor(Date.now()/86400000))),audio=useRef<EscapeSound|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null),scene=useRef<CheckpointScene|null>(null),[ready,setReady]=useState(false),[boothError,setBoothError]=useState('');
 const [,setVersion]=useState(0),[sound,setSound]=useState(false),[open,setOpen]=useState(true);
 const g=game.current,refresh=()=>setVersion(v=>v+1);
 async function toggleSound(){audio.current??=new EscapeSound();setSound(await audio.current.toggle())}
 function begin(){g.begin();audio.current?.play('interact');refresh()}
 function decide(approve:boolean){g.decide(approve);scene.current?.judge(approve);audio.current?.play('interact');refresh()}
 function detain(){g.detain();audio.current?.play('interact');refresh()}
 function next(){g.nextTraveler();if(g.state==='shift')scene.current?.arrive(g.traveler.papers.species);refresh()}
 function nextDay(){g.nextDay();refresh()}
 function restart(){game.current=new CheckpointGame(Math.floor(Math.random()*100000));refresh()}
 const booth=g.state==='shift';
 useEffect(()=>{if(!booth)return;let dead=false,raf=0,last=0;const resize=()=>scene.current?.resize();
  import('../../lib/checkpoint-scene').then(({CheckpointScene})=>{
   if(dead||!canvas.current)return;
   try{
    scene.current=new CheckpointScene(canvas.current);setReady(true);
    scene.current.arrive(game.current.traveler.papers.species);
    const loop=(now:number)=>{const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
     scene.current!.render(game.current,now/1000,dt);raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);window.addEventListener('resize',resize);
   }catch{setBoothError('Enable hardware acceleration to see the booth.')}
  }).catch(()=>setBoothError('The booth could not load. Please refresh.'));
  return ()=>{dead=true;cancelAnimationFrame(raf);scene.current?.dispose();window.removeEventListener('resize',resize);scene.current=null;setReady(false)}},[booth]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{
  if((e.target as HTMLElement).closest('button,a,input'))return;const k=e.key.toLowerCase();
  if(g.state==='briefing'&&(k==='enter'||k===' ')){e.preventDefault();begin();return}
  if(g.state!=='shift')return;
  if(g.verdict){if(k==='enter'||k===' '){e.preventDefault();next()}else if(k==='x')detain();return}
  if(k==='a')decide(true);else if(k==='d')decide(false)};
  window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);audio.current?.dispose()}},[]);

 const t=g.traveler,p=t.papers,v=g.verdict;
 const row=(label:string,value:string|number,bad=false)=><div className={bad?'cp-row bad':'cp-row'}><span>{label}</span><b>{value}</b></div>;
 const shown=(f:Flag)=>!!v&&v.flags.includes(f);

 return <main className="cp-shell">
  <header className="cp-header"><span>DUST &amp; DOCUMENTS</span>
   <div><span>DAY {g.day.day} / {g.lastDay}</span><span>{g.credits} CREDITS</span>
    <button onClick={toggleSound} aria-pressed={sound}>{sound?'SOUND ON':'SOUND OFF'}</button>
    <a href="/">← MAIN ARCADE</a></div></header>

  <div className="cp-title"><div><span>NORTH REPUBLIC BORDER · BOOTH 9</span>
   <h1>Dora inspects.<br/><em>Enzo stamps.</em></h1></div>
   <p>Seven shifts in a border booth. Read the day&apos;s rules, check every permit, and keep two chinchillas fed.</p></div>

  {g.state==='briefing'&&<section className="cp-panel cp-briefing">
   <span>SHIFT BRIEFING · DAY {g.day.day}</span>
   <h2>Today&apos;s rules</h2>
   <p className="cp-dialogue">{g.day.dialogue}</p>
   <ol>{g.day.rules.map(r=><li key={r.id}>{r.text}</li>)}</ol>
   <p className="cp-note">Quota: {g.day.quota} travelers. Each processed traveler pays {PAY_PER_TRAVELER} credits, each citation costs {FINE}, and rent takes {rentFor(g.day.day)} at the end of the shift.</p>
   <button className="cp-primary" onClick={begin}>OPEN THE BOOTH →</button></section>}

  {g.state==='shift'&&<section className="cp-booth">
   <div className="cp-view">
    <canvas ref={canvas} aria-label={`Border booth: Dora inspects a ${p.species} named ${p.name} at the window`}/>
    <div className="cp-nameplate"><strong>{p.name}</strong><small>{p.species} · seeking {p.purpose}</small></div>
    <p className="cp-speech">&ldquo;{t.line}&rdquo;</p>
    <div className="cp-readout"><span>BOOTH SCALE</span><b>{p.weight} g</b></div>
    {!ready&&!boothError&&<div className="cp-loading">OPENING THE BOOTH…</div>}
    {boothError&&<div className="cp-loading">{boothError}</div>}
    {v&&<div className={v.approved?'cp-stampmark ok':'cp-stampmark no'}>{v.approved?'APPROVED':'DENIED'}</div>}
   </div>

   <div className="cp-desk">
    <article className="cp-doc">
     <h3>ENTRY PERMIT</h3>
     {p.hasPermit?<>
      {row('NAME',p.permitName,shown('name'))}
      {row('PERMIT NO.',p.permitId)}
      {row('REGION',p.permitRegion,shown('region'))}
      {row('EXPIRES',`DAY ${p.expires}`,shown('expired'))}
      {row('STATED WEIGHT',`${p.statedWeight} g`,shown('weight'))}
      <div className={shown('seal')?'cp-seal missing':'cp-seal'}>{p.sealed?'★ REPUBLIC SEAL':'NO SEAL'}</div>
     </>:<p className="cp-missing">NO PERMIT PRESENTED</p>}
    </article>
    <article className="cp-doc">
     <h3>TRAVELER CARD</h3>
     {row('NAME',p.name,shown('name'))}
     {row('SPECIES',p.species,shown('species'))}
     {row('FROM',p.region,shown('region'))}
     {row('PURPOSE',p.purpose,shown('purpose'))}
     <div className="cp-rulecard">
      <button onClick={()=>setOpen(o=>!o)} aria-expanded={open}>{open?'HIDE RULEBOOK':'SHOW RULEBOOK'}</button>
      {open&&<ul>{g.day.rules.map(r=><li key={r.id}>{r.text}</li>)}</ul>}</div>
    </article>
   </div>

   <div className="cp-actions">
    {!v?<><button className="cp-approve" onClick={()=>decide(true)}>A · APPROVE</button>
     <button className="cp-deny" onClick={()=>decide(false)}>D · DENY</button></>:
     <><p className={v.correct?'cp-verdict good':'cp-verdict bad'}>{v.reason}</p>
      {!v.approved&&v.flags.length>0&&<button className="cp-detain" onClick={detain}>X · DETAIN</button>}
      <button className="cp-primary" onClick={next}>NEXT IN LINE →</button></>}
    <span className="cp-progress">{g.processed} / {g.day.quota} processed · {g.citations} citation{g.citations===1?'':'s'} · {g.credits} credits</span>
   </div>
  </section>}

  {g.state==='report'&&<section className="cp-panel">
   <span>END OF SHIFT · DAY {g.day.day}</span>
   <h2>{g.citations===0?'A clean shift':`${g.citations} citation${g.citations===1?'':'s'}`}</h2>
   <div className="cp-report">
    <div><b>{g.processed}</b><small>PROCESSED</small></div>
    <div><b>{g.approved}</b><small>APPROVED</small></div>
    <div><b>{g.denied}</b><small>DENIED</small></div>
    <div><b>{g.detained}</b><small>DETAINED</small></div>
    <div><b>{g.accuracy}%</b><small>ACCURACY</small></div>
    <div><b>{g.credits}</b><small>CREDITS AFTER RENT</small></div>
   </div>
   <ul className="cp-log">{g.log.slice(-8).map((line,i)=><li key={i}>{line}</li>)}</ul>
   <button className="cp-primary" onClick={nextDay}>{g.day.day>=g.lastDay||g.credits<=0?'SEE HOW IT ENDS →':'NEXT SHIFT →'}</button></section>}

  {g.state==='ending'&&<section className="cp-panel cp-ending">
   <span>THE BOOTH AT THE END OF THE WEEK</span>
   <h2>{g.ending.title}</h2><p>{g.ending.text}</p>
   <p className="cp-note">{g.credits} credits left. {g.detained} traveler{g.detained===1?'':'s'} detained.</p>
   <button className="cp-primary" onClick={restart}>WORK ANOTHER WEEK →</button></section>}

  <footer className="cp-help">
   <p><b>A</b> approve · <b>D</b> deny · <b>X</b> detain a denied violator · <b>Enter</b> next in line</p>
   <p>Every mismatch counts: an expired date, a closed region, a name that is one letter off, a missing seal, or fur that weighs more than the permit claims. {Object.values(FLAG_TEXT).length} kinds of violation appear across the week.</p></footer>
 </main>;
}
