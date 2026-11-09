'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HEROES, DEFAULT_KEYS, applyTurns, difficultyNames, emptyChoice, freshSave, readSave, replay, validChoice,
  type Action, type Choice, type Difficulty, type Hero, type Mission, type Rules, type Save, type State,
} from '../../lib/arcade-originals-rules';
import { drawScene, type Overlay, type Scene } from '../../lib/arcade-originals-scene';
import styles from './cabinet.module.css';

type Screen = 'title' | 'campaign' | 'play' | 'settings' | 'help';
type Binding = keyof Save['keys'];
const labelKey=(key:string)=>key.replace(/^Key|^Digit/,'');
const heroName={dora:'Dora',enzo:'Enzo'};
const bindings: [Binding,string][]=[['step','Play turn'],['undo','Undo turn'],['swap','Switch hero']];
const buttonLabels={faultline:'Rescue', 'night-wire':'Case','second-show':'Act'};
const worldNames={faultline:'the aftershock', 'night-wire':'the night line','second-show':'the inspector'};
const TURN_MS=1300;
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));

export default function Cabinet<S extends State,M extends Mission>({rules,loadArt,debugName}:{rules:Rules<S,M>;loadArt:()=>Promise<Scene>;debugName:string}){
  const [save,setSave]=useState<Save>(freshSave), [hydrated,setHydrated]=useState(false);
  const [art,setArt]=useState<Scene>(),[artError,setArtError]=useState(false);
  const [screen,setScreen]=useState<Screen>('title'),[back,setBack]=useState<Screen>('title');
  const [hero,setHero]=useState<Hero>('dora'), [draft,setDraft]=useState<Choice>(emptyChoice);
  const [queue,setQueue]=useState<Choice[]>([]),[capture,setCapture]=useState<Binding>();
  const [notice,setNotice]=useState(''),[storageError,setStorageError]=useState(false);
  const [confirm,setConfirm]=useState<'retry'|'new-secret'|Difficulty>(),[cursor,setCursor]=useState(0);
  const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null),audio=useRef<AudioContext>(null);
  const paintedState=useRef<S>(null);
  const paintInput=useRef<{overlay:Overlay}>({overlay:{}});
  const key=`${rules.id}-v1`;
  useEffect(()=>{
    try { setSave(readSave(localStorage.getItem(key),rules)); } catch { setStorageError(true); }
    setHydrated(true);
  },[key,rules]);
  useEffect(()=>{if(hydrated)try {localStorage.setItem(key,JSON.stringify(save));} catch {setStorageError(true);}},[hydrated,key,save]);
  useEffect(()=>{let active=true;loadArt().then(result=>{if(active)setArt(result);},()=>{if(active)setArtError(true);});return()=>{active=false;};},[loadArt]);
  const state=useMemo(()=>replay(rules,save),[rules,save]);
  const mission=rules.missions[save.level], index=save.level;
  const view=rules.view(index,state);
  const planned=useMemo(()=>queue.reduce((s,p)=>rules.step(index,s,p),state),[rules,index,state,queue]);
  const planningView=queue.length?rules.view(index,planned):view;
  const actions={dora:rules.actions(index,planned,'dora'),enzo:rules.actions(index,planned,'enzo')};
  const outcome=validChoice(rules,index,planned,draft)?rules.step(index,planned,draft):null;
  const warning=outcome?.notes.find(n=>n.tone==='warning');
  const choices=[...HEROES].map(h=>({hero:h,action:actions[h].find(a=>a.id===draft[h])}));
  const chosen=choices.filter(p=>p.action?.to!==undefined);
  const visibleMarks=planningView.marks.filter(m=>m.kind==='warning'||m.kind==='focus');
  // The board: rings on the spots the selected hero can pick, ◆ on the paths it can act on, arrows for the plan.
  const firstHero:Hero=rules.id==='faultline'?'enzo':'dora',secondHero:Hero=firstHero==='dora'?'enzo':'dora';
  const here=planningView[hero];
  const spotActions=(i:number):Action[]=>[...actions[hero].filter(a=>a.to===i&&!a.edge),...(i===here?actions[hero].filter(a=>a.id==='wait'):[])];
  const targets=rules.spots.flatMap((_,i)=>spotActions(i).some(a=>a.id!=='wait')?[i]:[]);
  const edgeActions=actions[hero].filter(a=>a.edge);
  const plans=HEROES.flatMap(h=>{const a=actions[h].find(x=>x.id===draft[h]);
    return a?.edge?[{hero:h,from:planningView[h],to:planningView[h],edge:a.edge}]:a?.to!==undefined?[{hero:h,from:planningView[h],to:a.to}]:[];});
  paintInput.current.overlay=state.phase==='playing'&&!confirm?{active:hero,targets,edgeTargets:edgeActions.map(a=>a.edge!),plans,first:firstHero}:{first:firstHero};
  const pickSpot=(i:number)=>{
    const list=spotActions(i);if(!list.length)return;
    const at=list.findIndex(a=>a.id===draft[hero]);
    pick(list[(at+1)%list.length]);
  };
  // after Dora's move is picked on the board, it is Enzo's turn to pick (unless he already has a plan)
  const pick=(a:Action)=>{choose(hero,a.id);if(hero==='dora'&&a.id.startsWith('go:')&&draft.enzo==='wait'&&actions.enzo.length>1)setHero('enzo');};
  const picked=HEROES.filter(h=>draft[h]!=='wait');
  const [coached,setCoached]=useState(true);
  useEffect(()=>{try{setCoached(localStorage.getItem(`${rules.id}-coached`)==='1');}catch{/* the coach card just shows again */}},[rules.id]);
  const dismissCoach=()=>{setCoached(true);try{localStorage.setItem(`${rules.id}-coached`,'1');}catch{/* ignored */}};
  const ready=hydrated&&(!!art||artError);
  const resetPlan=useCallback(()=>{setDraft(emptyChoice());setQueue([]);setCursor(0);},[]);
  const start=useCallback((level:number,difficulty:Difficulty=save.difficulty)=>{
    setSave(prev=>({...prev,level,difficulty,active:true,turns:[]}));setHero('dora');resetPlan();setConfirm(undefined);setScreen('play');
  },[save.difficulty,resetPlan]);
  const sound=useCallback((win:boolean)=>{
    if(!save.sound)return;
    try{
      const ctx=audio.current??new AudioContext();audio.current=ctx;void ctx.resume().catch(()=>{});
      const base=rules.id==='faultline'?262:rules.id==='night-wire'?330:392;
      (win?[1,1.25,1.5]:[1]).forEach((n,i)=>{
        const when=ctx.currentTime+i*.09,o=ctx.createOscillator(),g=ctx.createGain();
        o.type='triangle';o.frequency.value=base*n;g.gain.setValueAtTime(.045,when);g.gain.exponentialRampToValueAtTime(.0001,when+.17);
        o.connect(g);g.connect(ctx.destination);o.start(when);o.stop(when+.18);
      });
    }catch{/* Sound is optional when unavailable. */}
  },[rules.id,save.sound]);
  const commit=useCallback(()=>{
    if(screen!=='play'||state.phase!=='playing'||confirm)return;
    const turns=validChoice(rules,index,planned,draft)&&queue.length<rules.maxPlan&&(queue.length===0||HEROES.some(h=>draft[h]!=='wait'))?[...queue,draft]:queue;
    if(!turns.length)return;
    const next=applyTurns(rules,save,turns);sound(replay(rules,next).phase==='clear');setSave(next);resetPlan();setHero('dora');
  },[screen,state.phase,confirm,rules,index,planned,draft,queue,save,resetPlan,sound]);
  const undo=useCallback(()=>{
    if(screen!=='play'||confirm)return;
    if(queue.length){setQueue(q=>q.slice(0,-1));setDraft(emptyChoice());return;}
    if(!save.turns.length)return;
    setSave(s=>({...s,turns:s.turns.slice(0,-1)}));resetPlan();
  },[screen,confirm,queue.length,save.turns.length,resetPlan]);
  const choose=(h:Hero,id:string)=>{setDraft(p=>({...p,[h]:id}));setHero(h);setCursor(0);};
  const swap=()=>{setHero(h=>h==='dora'?'enzo':'dora');setCursor(0);};
  const changeCursor=(by:number)=>setCursor(c=>Math.max(0,Math.min((actions[hero].length||1)-1,c+by)));
  const selectCursor=()=>{const a=actions[hero][cursor];if(a)choose(hero,a.id);};
  const queueBeat=()=>{
    if(rules.maxPlan<=1||queue.length>=rules.maxPlan||!outcome)return;
    setQueue([...queue,draft]);setDraft(emptyChoice());setCursor(0);
  };
  const dispatch=useRef<(input:string)=>void>(null);
  dispatch.current=(code)=>{
    if(code==='Escape'&&confirm){setConfirm(undefined);return;}
    if(code==='Escape'&&screen==='play'){setScreen('title');return;}
    if(screen!=='play'||confirm||state.phase!=='playing'){
      if(code===save.keys.undo&&!confirm){
        if(screen==='help'||screen==='settings'){setScreen(back);return;}
        if(screen==='campaign'){setScreen('title');return;}
        if(screen==='play'){undo();return;}
      }
      const scope=confirm?root.current?.querySelector('[role="alertdialog"]'):
        screen==='play'?root.current?.querySelector('[data-game-result]'):root.current;
      const controls=Array.from(scope?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')??[]);
      const current=controls.indexOf(document.activeElement as HTMLElement);
      if(controls.length&&(code==='ArrowUp'||code==='ArrowDown')){
        controls[current<0?(code==='ArrowUp'?controls.length-1:0):(current+(code==='ArrowUp'?-1:1)+controls.length)%controls.length].focus();
      }
      const first=screen==='title'&&!confirm?root.current?.querySelector<HTMLElement>('[data-pad-default] button'):controls[0];
      if(code==='PadA'||code===save.keys.step) (controls[current]??first)?.click();
      return;
    }
    if(code===save.keys.step)commit();
    else if(code===save.keys.undo)undo();
    else if(code===save.keys.swap)swap();
    else if(code==='ArrowDown')changeCursor(1);
    else if(code==='ArrowUp')changeCursor(-1);
    else if(code==='PadA'||code==='ArrowRight')selectCursor();
    else if(code==='PadX')queueBeat();
  };
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
      const code=event.code;
      if(capture){
        event.preventDefault();
        if(code==='Escape'){setCapture(undefined);setNotice('Binding unchanged.');return;}
        if(!/^(Key[A-Z]|Digit[0-9]|Enter|Space)$/.test(code)){setNotice('Choose a letter, number, Enter or Space.');return;}
        if(bindings.some(([b])=>b!==capture&&save.keys[b]===code)){setNotice('That key already has an action.');return;}
        setSave(s=>({...s,keys:{...s.keys,[capture]:code}}));setCapture(undefined);setNotice(`Bound to ${labelKey(code)}.`);return;
      }
      if(screen!=='play')return;
      if(['Enter','Space'].includes(code)&&document.activeElement instanceof HTMLButtonElement)return;
      if([...Object.values(save.keys),'Escape','ArrowUp','ArrowDown','ArrowRight'].includes(code)){
        event.preventDefault();dispatch.current?.(code);
      }
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[screen,capture,save.keys]);
  useEffect(()=>{
    let frame=0,last=new Set<number>();
    const poll=()=>{
      const pad=Array.from(navigator.getGamepads?.()??[]).find(Boolean);
      const codes: Record<number,string>={0:'PadA',1:save.keys.undo,2:'PadX',8:'Escape',9:save.keys.step,12:'ArrowUp',13:'ArrowDown',14:save.keys.swap,15:save.keys.swap};
      const now=new Set<number>();
      if(pad)for(const [k,code] of Object.entries(codes)){
        const i=Number(k);if(pad.buttons[i]?.pressed){now.add(i);if(!last.has(i)&&!capture)dispatch.current?.(code);}
      }
      last=now;frame=requestAnimationFrame(poll);
    };
    frame=requestAnimationFrame(poll);return()=>cancelAnimationFrame(frame);
  },[save.keys,capture]);
  useEffect(()=>{
    Object.assign(window,{[debugName]:()=>({state,save,screen,queue,draft,hero})});
    return()=>{delete (window as unknown as Record<string,unknown>)[debugName];};
  },[debugName,state,save,screen,queue,draft,hero]);
  // The board repaints every frame while a mission is open (the target rings pulse); a played turn animates for
  // TURN_MS: the first hero walks, the other follows, then the world answers.
  const turnAnim=useRef<{level:number;turn:number;old:S;begin:number}>(null);
  useEffect(()=>{
    const context=canvas.current?.getContext('2d');
    if(!art||!context||screen!=='play'){turnAnim.current=null;return;}
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prev=turnAnim.current;
    const anim={level:index,turn:state.turn,
      old:prev&&prev.level===index&&prev.turn===state.turn-1?(paintedState.current??state):state,
      begin:prev&&prev.level===index&&prev.turn!==state.turn&&!reduce?performance.now():-Infinity};
    turnAnim.current=anim;paintedState.current=state;
    const current=rules.view(index,state),old=rules.view(index,anim.old),pair=save.turns.at(-1)??emptyChoice();
    let frame=0;
    const paint=(now:number)=>{
      const t=clamp01((now-anim.begin)/TURN_MS);
      drawScene(context,art,mission.chapter,rules.spots,current,t<1?old:current,pair,t,{...paintInput.current.overlay,now:reduce?0:now/1000});
      frame=requestAnimationFrame(paint);
    };
    frame=requestAnimationFrame(paint);paint(performance.now());return()=>cancelAnimationFrame(frame);
  },[screen,art,index,rules,state,save.turns,mission.chapter]);
  function panel(next:'settings'|'help'){setBack(screen);setScreen(next);setNotice('');setCapture(undefined);}
  const gameLabel=buttonLabels[rules.id as keyof typeof buttonLabels];
  const button=(title:string,fn:()=>void)=> <button type="button" onClick={fn}>{title}</button>;
  return <main ref={root} className={styles.cabinet} data-game={rules.id} data-ready={String(ready)}>
    <div className={styles.frame}>
      <header className={styles.header}>
        <a href="/" className={styles.home}>← Arcade</a>
        <div className={styles.wordmark}>{rules.title}</div>
        <div className={styles.headerButtons}>
          {screen!=='title'&&button('Menu',()=>{setCapture(undefined);setConfirm(undefined);setScreen('title');})}
          {screen!=='settings'&&button('Settings',()=>panel('settings'))}
          {screen!=='help'&&button('How to play',()=>panel('help'))}
        </div>
      </header>
      {storageError&&<p role="status">Your browser blocked saving. Keep this tab open to retain progress.</p>}
      {artError&&<p role="alert">Some artwork could not load. The routes are still available in the action list.</p>}
      {screen==='title'&&<section className={styles.title} style={{backgroundImage:`linear-gradient(90deg,rgba(13,12,22,.98),rgba(13,12,22,.52)),url(/art/${rules.id}/field-0.webp)`}}>
        <div><p className={styles.eyebrow}>A Dora &amp; Enzo game</p><h1>{rules.title}</h1><p>{rules.caption}</p>
          <p className={styles.titleCopy}>{rules.chapters[0]}</p>
          <div className={styles.group} data-pad-default="">
            {save.active?button('Continue',()=>setScreen('play')):button('Start',()=>start(0))}
            {button('Chapters',()=>setScreen('campaign'))}
          </div>
          <p className={styles.dim}>{rules.missions.length} {gameLabel.toLowerCase()}s · 4 chapters · Take as long as you need to plan</p>
        </div>
      </section>}
      {screen==='campaign'&&<section className={styles.panel}><p className={styles.eyebrow}>Campaign</p><h1>Chapters</h1>
        <p>Finish a {gameLabel.toLowerCase()} to open the next. Ribbons reward a clear, finishing under par, and finding the optional objective.</p>
        <div className={styles.chapters}>{rules.chapterNames.map((chapter,i)=><section key={chapter}><h2>{chapter}</h2><p>{rules.chapters[i]}</p>
          <ol>{rules.missions.map((m,n)=>m.chapter!==i?null:<li key={m.title}>
            <button disabled={n>save.unlocked} onClick={()=>n===index&&save.active?setScreen('play'):start(n)}>
              <span>{String(n+1).padStart(2,'0')} · {m.title}</span><small>{n>save.unlocked?'Locked':`${save.records[`${save.difficulty}:${n}`]??0} / 3 ribbons`}</small>
            </button>
          </li>)}</ol>
        </section>)}</div>
      </section>}
      {screen==='help'&&<section className={styles.panel}><p className={styles.eyebrow}>Field guide</p><h1>How to play</h1>
        <p>Every turn has three steps.</p>
        <ol className={styles.howto}>
          <li><strong>Pick Dora&rsquo;s move.</strong> Pick a glowing ring on the map, or choose from her action list.</li>
          <li><strong>Pick Enzo&rsquo;s move</strong> the same way. Some of his actions sit on a path: pick the ◆.</li>
          <li><strong>Press {rules.stepLabel}</strong> (<kbd>{labelKey(save.keys.step)}</kbd>). {heroName[firstHero]} acts, then {heroName[secondHero]}, then {worldNames[rules.id as keyof typeof worldNames]} answers.</li>
        </ol>
        <p>A hero with no plan holds still: pick their own spot to hold on purpose. Undo takes back a turn at any time, so try things.</p>
        <div className={styles.chapters}>{HEROES.map(h=><section key={h}><h2>{heroName[h]}</h2><p>{rules.heroHelp[h]}</p></section>)}</div>
        <p><kbd>{labelKey(save.keys.step)}</kbd> Play turn · <kbd>{labelKey(save.keys.undo)}</kbd> Undo · <kbd>{labelKey(save.keys.swap)}</kbd> Switch hero.</p>
        <p>Tab and Enter work on every button, or use ↑/↓ to browse actions and → to choose. Tap on touchscreens. On a gamepad, D-pad left/right switches hero, up/down browses actions, A selects, B undoes, X queues a beat in The Second Show, Start plays, and Select opens the menu.</p>
        {rules.maxPlan>1&&<p>Queue up to three beats. The next beat uses the last queued positions. Play the scene to commit them.</p>}
        {button('Back',()=>setScreen(back))}
      </section>}
      {screen==='settings'&&<section className={styles.panel}><p className={styles.eyebrow}>Cabinet</p><h1>Settings</h1>
        <div className={styles.group}>
          <button aria-pressed={save.assist} onClick={()=>setSave(s=>({...s,assist:!s.assist}))}>Helping hand: {save.assist?'On':'Off'}</button>
          <button aria-pressed={save.sound} onClick={()=>setSave(s=>({...s,sound:!s.sound}))}>Sound: {save.sound?'On':'Off'}</button>
        </div>
        <fieldset><legend>Difficulty</legend><div className={styles.group}>{Object.entries(difficultyNames).map(([mode,name])=>
          <button key={mode} aria-pressed={mode===save.difficulty} onClick={()=>mode!==save.difficulty&&(state.turn?setConfirm(mode as Difficulty):setSave(s=>({...s,difficulty:mode as Difficulty})))}>{name}</button>)}</div></fieldset>
        <fieldset><legend>Keyboard</legend><div className={styles.group}>{bindings.map(([id,label])=><button key={id} onClick={()=>{setCapture(id);setNotice(`Press a key for ${label.toLowerCase()}, or Escape to cancel.`);}}>{label}: {labelKey(save.keys[id])}</button>)}
          {button('Reset keys',()=>{setCapture(undefined);setSave(s=>({...s,keys:{...DEFAULT_KEYS}}));setNotice('Default keys restored.');})}</div>
          <p role="status" className={styles.dim}>{notice}</p>
        </fieldset>
        {button('Move hidden collectibles',()=>setConfirm('new-secret'))}
        {button('Back',()=>{setScreen(back);setCapture(undefined);setConfirm(undefined);})}
      </section>}
      {screen==='play'&&<section aria-label={mission.title} className={styles.play}>
        <div className={styles.mission}><div><p className={styles.eyebrow}>{rules.chapterNames[mission.chapter]} · {gameLabel} {index+1}/{rules.missions.length}</p>
          <h1>{mission.title}</h1></div><span className={styles.turn}>Turn {state.turn}</span></div>
        <div className={styles.grid}>
          <div className={styles.fieldColumn}>
            <figure className={styles.map}>
              <canvas ref={canvas} width={432} height={270} aria-label={`${rules.chapterNames[mission.chapter]} route map`} role="img"/>
              {state.phase==='playing'&&!confirm&&<div className={styles.hits}>
                {rules.spots.map((spot,i)=>{const list=spotActions(i);if(!list.length)return null;
                  const at=list.findIndex(a=>a.id===draft[hero]),next=list[(at+1)%list.length];
                  return <button key={spot.name} type="button" style={{left:`${spot.x}%`,top:`${spot.y}%`}} data-spot={i} aria-label={`Map: ${next.text}`} onClick={()=>pickSpot(i)}/>;})}
                {edgeActions.map(a=>{const [p,q]=a.edge!.map(n=>rules.spots[n]);
                  return <button key={a.id} type="button" className={styles.edgeHit} style={{left:`${(p.x+q.x)/2}%`,top:`${(p.y+q.y)/2}%`}} data-edge-action={a.id} aria-label={`Map: ${a.text}`} aria-pressed={draft[hero]===a.id} onClick={()=>pick(a)}/>;})}
              </div>}
              {state.notes.length>0&&state.turn>0&&<ul key={`${index}:${state.turn}`} className={styles.callouts} aria-hidden="true">
                {state.notes.map((n,i)=><li key={i} data-tone={n.tone} style={{animationDelay:`${TURN_MS*.75+i*220}ms`}}>{n.text}</li>)}</ul>}
              {!coached&&save.assist&&index===0&&state.turn===0&&state.phase==='playing'&&<div className={styles.coach} role="dialog" aria-label="How a turn works">
                <p className={styles.eyebrow}>How a turn works</p>
                <ol><li>Pick a glowing ring to plan <strong>Dora</strong>&rsquo;s move.</li><li>Then plan <strong>Enzo</strong>&rsquo;s move the same way{rules.id==='faultline'?' (◆ on a path braces it)':''}.</li>
                  <li>Press <strong>{rules.stepLabel}</strong>: both act, then {worldNames[rules.id as keyof typeof worldNames]} answers.</li></ol>
                <p className={styles.dim}>Goal: {view.objective}</p>
                <button type="button" className={styles.primary} onClick={dismissCoach}>Got it</button>
              </div>}
              <div className={styles.locations} aria-hidden="true">{rules.spots.map((spot,i)=><span key={spot.name} style={{left:`${spot.x}%`,top:`${spot.y}%`}} data-occupied={view.dora===i||view.enzo===i}
                data-target={chosen.some(p=>p.action?.to===i)} data-warning={visibleMarks.some(m=>m.at===i&&m.kind==='warning')}>{spot.name}</span>)}</div>
            </figure>
            <dl className={styles.facts}>{view.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
            <p className={styles.story}>{mission.story}</p>
            <p className={styles.objective}>{view.objective}</p>
          </div>
          <div className={styles.desk}>
            {state.phase==='playing'?<>
              <div className={styles.forecast}><strong>{rules.id==='faultline'?'Stress forecast':rules.id==='night-wire'?'Switchboard': 'Inspector’s next look'}</strong><span>{planningView.preview}</span></div>
              <p className={styles.step} data-step={picked.length===2?3:hero==='dora'?1:2}>{picked.length===2||(picked.length===1&&hero==='enzo'&&draft.enzo!=='wait')
                ?<><b>Step 3</b> Press <strong>{rules.stepLabel}</strong> (<kbd>{labelKey(save.keys.step)}</kbd>): {heroName[firstHero]} acts, then {heroName[secondHero]}, then {worldNames[rules.id as keyof typeof worldNames]}.</>
                :<><b>Step {hero==='dora'?1:2}</b> {heroName[hero]}: pick a glowing ring on the map{edgeActions.length?' or a ◆ on a path':''}.{draft[hero]!=='wait'?<> Planned: <strong>{actions[hero].find(a=>a.id===draft[hero])?.text}</strong>.</>:''}</>}</p>
              {save.assist&&<p className={styles.hint} data-testid="helping-hand">{planningView.hint} <kbd>{labelKey(save.keys.step)}</kbd> to play.</p>}
              <div className={styles.heroTabs} role="group" aria-label="Choose hero">{HEROES.map(h=><button key={h} aria-pressed={hero===h} onClick={()=>{setHero(h);setCursor(0);}} data-hero={h}>
                <img src={`/art/${rules.id}/${h}.png`} alt="" />
                <span><strong>{heroName[h]} <span className={styles.position}>{rules.spots[planningView[h]].name}</span></strong><small>{actions[h].find(a=>a.id===draft[h])?.text??'Hold'}</small></span>
              </button>)}</div>
              <div className={styles.actions} aria-label={`${heroName[hero]} actions`}>
                {actions[hero].map((a,i)=><button key={a.id} aria-pressed={draft[hero]===a.id} data-action={a.id} data-cursor={cursor===i} onClick={()=>choose(hero,a.id)}>{a.text}</button>)}
              </div>
              {save.assist&&warning&&<p className={styles.warning} aria-live="polite">If played: {warning.text}</p>}
              {queue.length>0&&<div className={styles.queue}><strong>Queued beats</strong><ol>{queue.map((p,i)=><li key={i}>{HEROES.map(h=>{
                const before=queue.slice(0,i).reduce((s,t)=>rules.step(index,s,t),state);
                return rules.actions(index,before,h).find(a=>a.id===p[h])?.text??'Hold';
              }).join(' · ')}</li>)}</ol></div>}
              <div className={styles.group}>
                {rules.maxPlan>1&&<button disabled={queue.length>=rules.maxPlan||!outcome} onClick={queueBeat}>Queue beat ({queue.length}/{rules.maxPlan})</button>}
                <button className={styles.primary} onClick={commit} data-testid="commit" data-armed={picked.length>0}>{rules.stepLabel}</button>
                <button disabled={!state.turn&&!queue.length} onClick={undo}>Undo</button>
              </div>
            </>:<div className={styles.result} role="status" data-game-result=""><p className={styles.eyebrow}>{state.phase==='clear'?'Chapter record':'Try another plan'}</p>
              <h2>{state.phase==='clear'?'Cleared': 'Out of turns or chances'}</h2>
              {state.phase==='clear'&&index===rules.missions.length-1&&<p>{rules.ending}</p>}
              {state.phase==='clear'&&<p>{save.records[`${save.difficulty}:${index}`]} / 3 ribbons · {state.turn} turns</p>}
              <div className={styles.group}>
                {state.phase==='clear'&&index<rules.missions.length-1&&button('Next',()=>start(index+1))}
                {button('Retry',()=>start(index))}
                {button('Undo',undo)}
                {button('Chapters',()=>setScreen('campaign'))}
              </div>
            </div>}
            {state.notes.length>0&&<ul className={styles.notes} aria-label="Turn report">{state.notes.map((n,i)=><li key={i} data-tone={n.tone}>{n.text}</li>)}</ul>}
            {view.journal&&view.journal.length>0&&<section aria-label="Delivered dispatches" className={styles.journal}><strong>Delivered dispatches</strong><ol>{view.journal.map((line,i)=><li key={i}>{line}</li>)}</ol></section>}
            <button className={styles.subtle} onClick={()=>setConfirm('retry')}>Restart {gameLabel.toLowerCase()}</button>
          </div>
        </div>
      </section>}
      {confirm&&<div className={styles.confirm}><section className={styles.panel} role="alertdialog" aria-label="Restart current mission" aria-modal="true">
        <h2>{confirm==='retry'?'Restart this mission?':confirm==='new-secret'?'Move hidden collectibles?':'Change difficulty and restart?'}</h2>
        <p>Progress in this mission will reset. Chapters and ribbons you earned will stay.</p>
        <div className={styles.group}>{button('Cancel',()=>setConfirm(undefined))}
          {button('Restart',()=>{if(confirm==='new-secret'){setSave(s=>({...s,seed:s.seed===0xffffffff?1:s.seed+1,turns:[]}));setConfirm(undefined);resetPlan();}else if(screen==='settings'&&confirm!=='retry'){setSave(s=>({...s,difficulty:confirm,turns:[]}));setConfirm(undefined);resetPlan();}else start(index);})}</div>
      </section></div>}
    </div>
  </main>;
}
