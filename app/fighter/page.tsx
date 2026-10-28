'use client';
import {useEffect,useRef,useState} from 'react';
import {FighterGame,ROSTER,SPECIALS,RISERS,SUPERS,STORY,STORY_END,STAGES,STAGE_ORDER,TRIALS,SAVE_KEY,moveName,readProfile,writeProfile,record,type FighterId,type Input,type Mode,type Difficulty,type Dummy,type StageId,type FighterProfile,type FightEvent} from '../../lib/fighter-game';
import type {FighterScene} from '../../lib/fighter-scene';
import {EscapeSound} from '../../lib/escape-sound';
import './fighter.css';

/** Keyboard layouts: one player uses either side of the keyboard; in versus the left half is player one and the right half player two. */
const SOLO={left:['a','arrowleft'],right:['d','arrowright'],jump:[' ','w','arrowup'],down:['s','arrowdown'],block:['i','s','arrowdown'],jab:['j'],kick:['k'],special:['l'],rising:['u'],super:['o'],throw:['h']};
const P1={left:['a'],right:['d'],jump:['w',' '],down:['s'],block:['s'],jab:['f'],kick:['g'],special:['h'],rising:['r'],super:['t'],throw:['y']};
const P2={left:['arrowleft'],right:['arrowright'],jump:['arrowup'],down:['arrowdown'],block:['arrowdown','i'],jab:['j'],kick:['k'],special:['l'],rising:['u'],super:['o'],throw:[';']};
type Layout=typeof SOLO;
const read=(k:Set<string>,L:Layout):Input=>{const has=(list:string[])=>list.some(x=>k.has(x));return {move:+has(L.right)-+has(L.left),jump:has(L.jump),down:has(L.down),block:has(L.block),jab:has(L.jab),kick:has(L.kick),special:has(L.special),rising:has(L.rising),super:has(L.super),throw:has(L.throw)}};
/** A standard gamepad: X jab, A kick, Y special, B rising, RB super, LB block, RT throw. */
const pad=(p:Gamepad|null|undefined):Input|null=>{if(!p)return null;const b=(i:number)=>!!p.buttons[i]?.pressed||(p.buttons[i]?.value??0)>.5,ax=p.axes[0]??0,ay=p.axes[1]??0;
 return {move:(b(15)||ax>.45?1:0)-(b(14)||ax<-.45?1:0),jump:b(12)||ay<-.65,down:b(13)||ay>.6,block:b(4)||b(13)||ay>.6,jab:b(2),kick:b(0),special:b(3),rising:b(1),super:b(5),throw:b(7)||b(6)}};
const merge=(a:Input,b:Input|null):Input=>{if(!b)return a;const o:Input={move:Math.max(-1,Math.min(1,a.move+b.move))};for(const k of ['jump','down','block','jab','kick','special','rising','super','throw'] as const)o[k]=!!a[k]||!!b[k];return o};
const clockText=(s:number)=>`${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,'0')}`;
const MODE_NAME:Record<Mode,string>={arcade:'ARCADE',story:'STORY',training:'TRAINING',versus:'VERSUS',survival:'SURVIVAL',timeattack:'TIME ATTACK'};
const SOUND:Partial<Record<FightEvent['kind'],'interact'|'switch'|'jump'|'bath'>>={hit:'interact',block:'switch',throw:'jump',break:'switch',guardbreak:'jump',clash:'switch',trial:'bath'};

export default function Fighter(){
 const canvas=useRef<HTMLCanvasElement>(null),game=useRef(new FighterGame()),scene=useRef<FighterScene|null>(null),keys=useRef(new Set<string>()),audio=useRef<EscapeSound|null>(null),profile=useRef<FighterProfile>(readProfile(null)),seen=useRef('');
 const [version,setVersion]=useState(0),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[sound,setSound]=useState(false),[portraits,setPortraits]=useState<Partial<Record<FighterId,string>>>({}),[setup,setSetup]=useState(false),[news,setNews]=useState<string[]>([]),[pads,setPads]=useState(0);
 const g=game.current,P=profile.current;void version;
 const refresh=()=>setVersion(v=>v+1);
 const save=()=>{try{localStorage.setItem(SAVE_KEY,writeProfile(profile.current))}catch{}};
 function focus(){keys.current.clear();canvas.current?.focus();refresh()}
 function pick(id:FighterId){game.current.pick(id);keys.current.clear();setSetup(false);refresh()}
 /** Starts a mode with the saved CPU level and this fighter's outfit. */
 function begin(mode:Mode){setSetup(false);g.difficulty=P.difficulty;g.alt=[!!P.alt[g.selected],mode==='versus'&&g.p2===g.selected];g.start(mode);if(mode==='training'){g.setDummy(P.dummy)}audio.current?.play('interact');focus()}
 function versus(){g.alt=[!!P.alt[g.selected],g.p2===g.selected];g.startVersus(g.p2,g.versusStage);setSetup(false);audio.current?.play('interact');focus()}
 function setDummy(d:Dummy){g.setDummy(d);P.dummy=d;save();focus()}
 function setLevel(d:Difficulty){g.difficulty=d;P.difficulty=d;save();refresh()}
 function setAlt(on:boolean){P.alt[g.selected]=on;save();g.alt=[on,g.alt[1]];refresh()}
 function advance(){g.advance();audio.current?.play('interact');focus()}
 function pause(){g.pause();focus()}
 function select(){pick(game.current.selected)}
 async function toggleSound(){audio.current??=new EscapeSound();setSound(await audio.current.toggle())}
 useEffect(()=>{(window as unknown as {__fighter:()=>FighterGame}).__fighter=()=>game.current;try{profile.current=readProfile(localStorage.getItem(SAVE_KEY))}catch{}game.current.difficulty=profile.current.difficulty;game.current.dummy=profile.current.dummy;refresh()},[]);
 useEffect(()=>{let dead=false,raf=0,last=0,acc=0,ui=0,padPause=false;const resize=()=>scene.current?.resize();
  import('../../lib/fighter-scene').then(({FighterScene})=>{if(dead||!canvas.current)return;try{scene.current=new FighterScene(canvas.current);setPortraits(scene.current.portraits());setLoaded(true);
   const loop=(now:number)=>{const gm=game.current,dt=last?Math.min(.1,(now-last)/1000):0;acc+=dt;last=now;
    const list=typeof navigator.getGamepads==='function'?[...navigator.getGamepads()].filter(Boolean) as Gamepad[]:[];
    if(list[0]?.buttons[9]?.pressed){if(!padPause){padPause=true;gm.pause();refresh()}}else padPause=false;
    while(acc>=1/120){const k=keys.current,two=gm.mode==='versus';const one=merge(read(k,two?P1:SOLO),pad(list[0])),other=two?merge(read(k,P2),pad(list[1])):undefined;gm.step(1/120,one,other);acc-=1/120}
    for(const e of gm.events.splice(0)){scene.current!.spark(e);const s=SOUND[e.kind];if(s)audio.current?.play(s)}
    // fold results into the save as they happen
    const mark=`${gm.mode}|${gm.state}|${gm.beat?.title}|${gm.opponent}|${gm.trialDone}`;if(mark!==seen.current){seen.current=mark;const got=record(profile.current,gm);if(got.length){setNews(got);setTimeout(()=>setNews([]),4200)}try{localStorage.setItem(SAVE_KEY,writeProfile(profile.current))}catch{}}
    if(gm.trialDone&&gm.state==='fight')gm.trialDone=false;
    scene.current!.render(gm,now/1000,dt);if(now-ui>50){refresh();setPads(list.length);ui=now}raf=requestAnimationFrame(loop)};
   raf=requestAnimationFrame(loop);window.addEventListener('resize',resize)}catch{setError('Enable hardware acceleration to enter the 3D arena.')}}).catch(()=>setError('The arena could not load. Please refresh.'));
  const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('button,a,input,select'))return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();keys.current.add(key);if(!e.repeat&&(key==='p'||key==='escape')){game.current.pause();keys.current.clear();refresh()}};
  const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());const blur=()=>{keys.current.clear();if(game.current.active)game.current.pause();refresh()};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  return()=>{dead=true;cancelAnimationFrame(raf);scene.current?.dispose();audio.current?.dispose();window.removeEventListener('resize',resize);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}},[]);
 const hold=(key:string,label:string)=><button onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key)}} onPointerUp={()=>keys.current.delete(key)} onPointerCancel={()=>keys.current.delete(key)} onLostPointerCapture={()=>keys.current.delete(key)}>{label}</button>;
 const profileOf=(id:FighterId)=>ROSTER.find(r=>r.id===id)!,me=profileOf(g.selected),medals=P.medals[g.selected],two=g.mode==='versus',playing=g.state==='fight'||g.state==='paused';
 const storyDone=P.story[g.selected],trialsDone=TRIALS.filter((_,i)=>P.trials[`${g.selected}:${i}`]).length;
 const levelPicker=<div className="fighter-level" role="group" aria-label="CPU level">{(['easy','normal','hard'] as Difficulty[]).map(d=><button key={d} aria-pressed={g.difficulty===d} onClick={()=>setLevel(d)}>{d.toUpperCase()}</button>)}</div>;
 const tag=g.mode==='training'?'TRAINING DOJO':g.mode==='story'?`CHAPTER ${g.opponent+1} · ${STORY[g.rivals[g.opponent]].place}`:g.mode==='versus'?'PLAYER 1 VS PLAYER 2':g.mode==='survival'?`SURVIVAL · ${g.streak} DEFEATED`:g.mode==='timeattack'?`TIME ATTACK · BOUT ${g.opponent+1} / ${g.rivals.length}`:`BOUT ${g.opponent+1} / ${g.rivals.length}`;
 return <main className="fighter-shell" data-ready={loaded?'true':undefined} data-state={g.state}>
  <header className="fighter-header"><a href="/">← MAIN ARCADE</a><a className="fighter-brand" href="/fighter">PAW FIGHTER <em>II</em></a><div><button onClick={select}>CHARACTER SELECT</button><button onClick={()=>begin('story')}>STORY MODE</button><button onClick={()=>begin('training')}>TRAINING</button><button onClick={()=>{select();setSetup(true)}}>VERSUS</button><button onClick={toggleSound} aria-pressed={sound}>{sound?'SOUND ON':'SOUND OFF'}</button><a href="/checkpoint">CHECKPOINT ↗</a><a href="/escape">SPY ESCAPE ↗</a></div></header>
  <div className="fighter-title"><div><span>THE ANDES AFTER DARK</span><h1>Small paws.<br/><em>Big trouble.</em></h1></div><p>Seven fighters, eight arenas, six ways to play.<br/>Story mode: one chinchilla, the Andes to the oath.</p></div>
  <section className="fighter-roster"><div className="fighter-roster-heading"><h2>CHOOSE YOUR FIGHTER</h2><span>{g.state==='select'?'ALL SEVEN PLAYABLE · CLEAR ARCADE TO UNLOCK A NEW OUTFIT':'Choosing a fighter starts afresh'}</span></div>
   <div className="fighter-cards">{ROSTER.map((r,i)=>{const m=P.medals[r.id];return <button key={r.id} aria-pressed={g.selected===r.id} className={g.selected===r.id?'chosen':''} style={{'--fighter-color':r.color} as React.CSSProperties} onClick={()=>pick(r.id)}>
    <span className="fighter-portrait">{portraits[r.id]?<img src={portraits[r.id]} alt={r.name+' character portrait'} width={192} height={192}/>:<span className="fighter-number">0{i+1}</span>}</span>
    <strong>{r.name}</strong><small>{r.special}</small><span className="fighter-move-detail">{SPECIALS[r.id].description}</span>
    <span className="fighter-move-list"><b>{r.special}</b> ↓↘→ J · 35<br/><b>{RISERS[r.id].name}</b> →↓↘ J · 20<br/><b>{SUPERS[r.id].name}</b> O · 100<br/><b>Throw</b> J + K up close</span>
    <span className="fighter-medals" aria-label={`${r.name} medals`}>{m.arcade&&<i title="Arcade cleared">ARCADE</i>}{m.story&&<i title="Story cleared">STORY</i>}{m.survival>0&&<i title="Best survival streak">SURV {m.survival}</i>}{m.time!==null&&<i title="Best time attack">{clockText(m.time)}</i>}</span>
    <span className="fighter-style">{r.speed>=4.5?'QUICK':r.power>=1.1?'POWER':'BALANCED'}</span></button>})}</div></section>
  <section className="fighter-cabinet" aria-label="Arcade fighting game">
   <div className="fighter-hud">{g.fighters.map((f,i)=>{const p=profileOf(f.id);return <div className={'fighter-vitals '+(i?'rival':'')} key={i}><div><span>{i?(two?'2P':'CPU'):'1P'} · {p.name}</span><b>{g.need>1?<>{g.wins[i]>0?'●':'○'} {g.wins[i]>1?'●':'○'}</>:null}</b></div>
    <div className="fighter-health" role="progressbar" aria-label={p.name+' health'} aria-valuenow={Math.ceil(f.hp)} aria-valuemin={0} aria-valuemax={100}><i style={{width:f.hp+'%'}}/></div>
    <div className={'fighter-guard'+(f.guard<35?' low':'')} aria-label={p.name+' guard'}><i style={{width:f.guard+'%'}}/></div>
    <small>{p.special.toUpperCase()} <b>{Math.floor(f.meter)} / 100</b></small><div className="fighter-meter"><i style={{width:f.meter+'%',background:p.color}}/></div></div>})}
    <div className="fighter-timer"><b>{g.mode==='training'?'∞':Math.ceil(g.time)}</b><small>{g.mode==='timeattack'?clockText(g.clock):g.mode==='survival'?`STREAK ${g.streak}`:`ROUND ${g.round}`}</small></div></div>
   <div className="fighter-arena"><canvas ref={canvas} tabIndex={0} aria-label="Move with A D or arrows; Space jump; J jab; K kick; L special; U rising; O super; J and K together throw; I block; P pause"/>
    <div className="fighter-arena-tags"><span>{STAGES[g.stage]}</span><span>{tag}</span></div>
    {g.active&&g.intro>0&&<div className="fighter-shout">{g.message}</div>}
    {g.active&&g.noticeTime>0&&<div className="fighter-special-call" role="status">{g.notice}</div>}
    {g.fighters.map((f,i)=>g.active&&f.combo>1&&f.comboTime>0&&<div key={i} className={'fighter-combo'+(i?' right':'')}><b>{f.combo}</b> HIT{f.combo>=5?'S!!':'!'}</div>)}
    {news.length>0&&<div className="fighter-unlock" role="status">{news.map(n=><b key={n}>{n}</b>)}</div>}
    {g.mode==='training'&&playing&&<><div className="fighter-training"><span>TRAINING · infinite power, no timer</span><p><b>{Math.round(g.training.damage)}</b> combo damage · best <b>{Math.round(g.training.best)}</b> · longest <b>{g.training.bestCombo}</b> hits · total {g.training.hits}</p><div>{(['stand','block','jump','fight'] as const).map(d=><button key={d} aria-pressed={g.dummy===d} className={g.dummy===d?'on':''} onClick={()=>setDummy(d)}>{d.toUpperCase()}</button>)}<button onClick={()=>{g.resetTraining();focus()}}>RESET</button></div></div>
     <div className="fighter-trials"><span>COMBO TRIALS · {trialsDone} / {TRIALS.length}</span><ol>{TRIALS.map((t,n)=>{const done=P.trials[`${g.selected}:${n}`],on=g.trial===n;return <li key={t.name}><button aria-pressed={on} className={on?'on':''} onClick={()=>{g.setTrial(on?-1:n);focus()}}>{done?'✓ ':''}{t.name}</button>{on&&<p>{t.moves.map((m,k)=><em key={k} className={k<g.trialStep?'got':''}>{moveName(g.selected,m)}</em>)}</p>}</li>})}</ol></div></>}
    {g.state==='story'&&g.beat&&<div className="fighter-overlay story"><div><span>{g.beat.place}</span><h2>{g.beat.title}</h2><p>{g.beat.text}</p><button className="fighter-start" disabled={!loaded} onClick={advance}>{g.beat.title==='OATH TAKEN'?'SEE THE ENDING →':g.beat.title==='CHAPTER CLEARED'?'CONTINUE THE STORY →':'FIGHT →'}</button><button className="fighter-back" onClick={select}>Character select</button></div></div>}
    {setup&&g.state==='select'&&<div className="fighter-overlay versus"><div><span>VERSUS · TWO PLAYERS</span><h2>{me.name} VS {profileOf(g.p2).name}</h2>
     <p>Player 2 picks a fighter:</p><div className="fighter-pick">{ROSTER.map(r=><button key={r.id} aria-pressed={g.p2===r.id} className={g.p2===r.id?'on':''} style={{'--fighter-color':r.color} as React.CSSProperties} onClick={()=>{g.p2=r.id;refresh()}}>{portraits[r.id]?<img src={portraits[r.id]} alt="" width={48} height={48}/>:null}<small>{r.name}</small></button>)}</div>
     <p>Arena:</p><div className="fighter-stages">{STAGE_ORDER.map(s=><button key={s} aria-pressed={g.versusStage===s} className={g.versusStage===s?'on':''} onClick={()=>{g.versusStage=s;refresh()}}>{STAGES[s]}</button>)}</div>
     <p className="fighter-keys"><b>1P</b> A D move · W jump · S block · F jab · G kick · H special · R rising · T super · Y throw<br/><b>2P</b> arrows · J jab · K kick · L special · U rising · O super · ↓ block · J+K throw<br/>{pads?`${pads} gamepad${pads>1?'s':''} connected: the first is 1P, the second 2P.`:'Gamepads work too: plug one in and press a button.'}</p>
     <button className="fighter-start" disabled={!loaded} onClick={versus}>FIGHT →</button><button className="fighter-back" onClick={()=>setSetup(false)}>Back</button></div></div>}
    {!setup&&(g.state==='select'||g.state==='paused'||g.state==='round'||g.state==='match'||g.state==='champion'||g.state==='result'||error)&&<div className={'fighter-overlay '+(g.state==='select'?'selection':'')}><div>
     <span>{error?'ARENA OFFLINE':g.state==='select'?'INSERT FLUFF · PRESS START':g.state==='paused'?'TIME OUT':g.state==='result'?'SURVIVAL OVER':g.state==='champion'?(g.mode==='story'?'CITIZENSHIP GRANTED':g.mode==='timeattack'?'TIME ATTACK CLEARED':'ARCADE CLEARED'):'THE CROWD GOES WILD'}</span>
     <h2>{error?'One moment…':g.state==='select'?`${me.name}\nIS READY`:g.state==='paused'?'PAUSED':g.state==='result'?`${g.streak} DEFEATED`:g.state==='champion'?(g.mode==='story'?'CITIZEN':g.mode==='timeattack'?clockText(g.clock):'NEW CHAMPION'):g.message}</h2>
     <p>{error||(g.state==='select'?`${me.tag}. ${SPECIALS[me.id].description} Special: L or ↓ ↘ → + J. Rising: U or → ↓ ↘ + J. Super: O at 100. Throw: J + K together, up close; press them as you are grabbed to break free.`:g.state==='paused'?'Take a breath. Your bout is waiting.':g.state==='result'?`Best streak with ${me.name}: ${medals.survival}.`:g.state==='champion'?(g.mode==='story'?`${me.name} fought from the Andes to the naturalization podium. ${STORY_END}`:g.mode==='timeattack'?`${me.name}'s best: ${medals.time!==null?clockText(medals.time):'—'}.`:`${me.name} defeated every rival in the Andes.${medals.arcade?' A new outfit is waiting on the select screen.':''}`):g.state==='match'?(two?`${g.message}. Again?`:g.wins[0]>=g.need?(g.mode==='survival'?'Thirty health back. The next rival steps up.':'Your next challenger awaits.'):'Your rival takes the match. Try again or choose another fighter.'):g.mode==='survival'?'One round per rival.':'First to two round wins takes the match.')}</p>
     {g.state==='select'&&!error&&<>{levelPicker}{medals.arcade&&<label className="fighter-alt"><input type="checkbox" checked={!!P.alt[g.selected]} onChange={e=>setAlt(e.target.checked)}/> Alternate outfit</label>}</>}
     {!error&&<button className="fighter-start" disabled={!loaded} onClick={g.state==='select'?()=>begin('arcade'):g.state==='paused'?pause:g.state==='champion'?select:g.state==='result'?()=>begin('survival'):()=>{g.next();focus()}}>{!loaded?'LOADING ARENA…':g.state==='select'?'START ARCADE →':g.state==='paused'?'RESUME →':g.state==='champion'?'CHOOSE A FIGHTER →':g.state==='result'?'TRY AGAIN →':g.state==='round'?'NEXT ROUND →':two?'REMATCH →':g.wins[0]>=g.need?'CONTINUE →':'REMATCH →'}</button>}
     {g.state==='select'&&<div className="fighter-modes"><button disabled={!loaded} onClick={()=>begin('story')}>Story mode{storyDone?` · ${storyDone}/6`:''}</button><button disabled={!loaded} onClick={()=>setSetup(true)}>Versus · 2 players</button><button disabled={!loaded} onClick={()=>begin('survival')}>Survival{medals.survival?` · best ${medals.survival}`:''}</button><button disabled={!loaded} onClick={()=>begin('timeattack')}>Time attack{medals.time!==null?` · ${clockText(medals.time)}`:''}</button><button disabled={!loaded} onClick={()=>begin('training')}>Training · trials {trialsDone}/{TRIALS.length}</button></div>}
     {g.state!=='select'&&g.state!=='champion'&&<button className="fighter-back" onClick={select}>Character select</button>}</div></div>}
   </div>
   <div className="fighter-strip"><span>J <b>JAB</b></span><span>K <b>KICK</b></span><span>J+K <b>THROW</b></span><span>L <b>SPECIAL · 35</b></span><span>U <b>RISING · 20</b></span><span>O <b>SUPER · 100</b></span><span>I / ↓ <b>BLOCK</b></span><span className="fighter-mode-tag">{MODE_NAME[g.mode]} · {g.mode==='versus'?'2P':`CPU ${g.difficulty.toUpperCase()}`}</span><button onClick={pause} disabled={!['fight','paused'].includes(g.state)}>P · {g.state==='paused'?'RESUME':'PAUSE'}</button></div>
  </section>
  <div className="fighter-touch"><div>{hold('a','←')}{hold('d','→')}{hold(' ','JUMP')}{hold('i','BLOCK')}</div><div>{hold('j','JAB')}{hold('k','KICK')}{hold('h','THROW')}{hold('l','SPECIAL')}{hold('u','RISING')}{hold('o','SUPER')}</div></div>
  <footer className="fighter-help"><p><b>MOVE</b> A / D or ← / → · <b>JUMP</b> Space / W / ↑ · <b>THROW</b> J + K or H · <b>PAUSE</b> P · <b>GAMEPAD</b> X jab, A kick, Y special, B rising, RB super, LB block, RT throw</p><p>Chain your hits: a jab that connects can cancel into a kick, and a kick into your special, rising attack or super. Each extra hit in a combo does a little less. Blocking stops jabs and kicks cold, but specials and supers still chip, and every blocked hit wears down your guard bar until it breaks. Throws beat blocking; press J + K as you are grabbed to break free. Fireballs cancel each other out. Clear arcade with a fighter to unlock their alternate outfit, and try the combo trials in training.</p></footer>
 </main>;
}
