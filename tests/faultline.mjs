import assert from 'node:assert/strict';
import { faultline as rules } from '../.checks/faultline-game.js';
import { checkCampaign } from './arcade-originals-common.mjs';

const turn=(s,dora='wait',enzo='wait')=>rules.step(0,s,{dora,enzo});
const approach=turn(rules.start(0,'standard',91),'go:1');
const unbraced=turn(approach,'go:2');
assert.equal(unbraced.dora,1,'an unbraced crossing returns Dora safely');
assert.deepEqual(unbraced.blocked,[0]);
const braced=turn(approach,'go:2','brace:0');
assert.equal(braced.dora,2,'Enzo’s brace applies before Dora crosses');
assert.deepEqual(braced.blocked,[]);
const lead=turn(braced,'escort:0');
assert.equal(lead.carried,0);
const done=turn(turn(lead,'go:1'),'go:0');
assert.equal(done.phase,'clear');
assert.deepEqual(done.residents,[-1]);
assert.notEqual(rules.start(0,'standard',91).ledger, rules.start(0,'standard',92).ledger);
checkCampaign(rules);
