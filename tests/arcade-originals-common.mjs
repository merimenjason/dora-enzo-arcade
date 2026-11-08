import assert from 'node:assert/strict';
import { applyTurns, freshSave, readSave, replay, seeded } from '../.checks/arcade-originals-rules.js';

const modes = ['story','standard','expert'];
function choices(rules, level, state) {
  return rules.actions(level,state,'dora').flatMap(d => rules.actions(level,state,'enzo').map(e=>({dora:d.id,enzo:e.id})));
}
export function solve(rules, level, initial, {width=110, turns=40, goal=s=>s.phase==='clear', permit=()=>true}={}) {
  let beam=[{state:initial,plan:[]}];
  for(let i=0;i<=turns&&beam.length;i++) {
    const next=new Map();
    for(const {state,plan} of beam) {
      if(goal(state))return plan;
      if(state.phase!=='playing')continue;
      for(const pair of choices(rules,level,state)) {
        if(!permit(state,pair))continue;
        const result=rules.step(level,state,pair);
        if(result.phase==='lost')continue;
        const signature=rules.signature(result);
        if(!next.has(signature))next.set(signature,{state:result,plan:[...plan,pair],rank:rules.rank(level,result)});
      }
    }
    beam=[...next.values()].sort((a,b)=>b.rank-a.rank).slice(0,width);
  }
  return null;
}
export function checkCampaign(rules) {
  for(const difficulty of modes) {
    let save={...freshSave(),difficulty};
    for(let level=0;level<rules.missions.length;level++) {
      save={...save,level,turns:[]};
      const initial=replay(rules,save),copy=JSON.stringify(initial);
      const plan=solve(rules,level,initial);
      assert.ok(plan?.length,`${rules.id} ${difficulty} ${level+1} is solvable`);
      assert.equal(JSON.stringify(initial),copy,'pure transitions');
      assert.deepEqual(rules.start(level,difficulty,save.seed),initial);
      assert.deepEqual(applyTurns(rules,save,[{dora:'no',enzo:'wait'}]).turns,[]);
      save=applyTurns(rules,save,plan);
      assert.equal(replay(rules,save).phase,'clear');
      assert.equal(replay(rules,{...save,turns:save.turns.slice(0,-1)}).phase,'playing');
      assert.equal(save.unlocked,Math.min(level+1,rules.missions.length-1));
      assert.ok(save.records[`${difficulty}:${level}`]>0);
      assert.deepEqual(readSave(JSON.stringify(save),rules),save);
      assert.deepEqual(readSave(JSON.stringify({...save,seed:0}),rules),freshSave());
      assert.deepEqual(readSave(JSON.stringify({...save,turns:[...save.turns,{dora:'wait',enzo:'wait'}]}),rules),freshSave());
    }
    console.log(`${rules.title}: ${difficulty} — ${rules.missions.length} clears, deterministic save/replay`);
  }
}
export function runBots(rules) {
  const quick=process.argv.includes('--quick');
  const levels=quick?[0,7,15]:[0,1,3,5,7,10,12,15],seeds=quick?[91,814]:[91,230,814,903];
  for(const difficulty of modes) {
    let wins=0,early=0,total=0,frames=0,decision=0,mistakes=0;
    for(const level of levels)for(const seed of seeds) {
      let state=rules.start(level,difficulty,seed), plan;
      const rng=seeded(seed+level*913);
      for(let turn=0;state.phase==='playing'&&turn<45;turn++) {
        const reaction=12+Math.floor(rng()*7);
        const before=JSON.stringify(state);
        for(let frame=0;frame<reaction;frame++)rules.view(level,state);
        assert.equal(JSON.stringify(state),before,'thinking time cannot change simulation');
        frames+=reaction;decision++;
        plan??=solve(rules,level,state,{width:55});
        const intended=plan?.shift();
        if(!intended)break;
        const mistake=rng()<({story:.04,standard:.07,expert:.1}[difficulty]);
        if(mistake)mistakes++;
        const hero=rng()<.5?'dora':'enzo';
        const legal=rules.actions(level,state,hero);
        const pair=mistake?{...intended,[hero]:legal[Math.floor(rng()*legal.length)].id}:intended;
        state=rules.step(level,state,pair);
        if(mistake)plan=null;
      }
      if(state.phase==='clear'){wins++;if(level<4)early++;}
      total++;
    }
    const earlyTotal=levels.filter(n=>n<4).length*seeds.length;
    if(difficulty!=='expert')assert.ok(early/earlyTotal>=.9,'early missions must tolerate common input mistakes');
    console.log(JSON.stringify({game:rules.id,difficulty,wins,total,early,earlyTotal,decisions:decision,meanFrames:(frames/decision).toFixed(1),mistakes}));
  }
}
