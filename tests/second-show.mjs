import assert from 'node:assert/strict';
import { secondShow as rules } from '../.checks/second-show-game.js';
import { checkCampaign } from './arcade-originals-common.mjs';

const turn=(s,dora='wait',enzo='wait')=>rules.step(0,s,{dora,enzo});
const first=rules.start(0,'standard',91);
const bow=turn(first,'bow','go:8');
assert.equal(bow.applause,1);
assert.equal(bow.enzo,8);
assert.equal(turn(bow,'bow').applause,1,'repeating the last cue does not count');
const take=turn(bow,'go:1','take:0');
assert.equal(take.carried,0);
const wave=turn(take,'wave','go:7');
assert.equal(wave.applause,2);
assert.equal(wave.enzo,7,'a fresh cue protects the move to the watched location');
assert.equal(turn(take,'wait','go:7').alarm,1,'the same crossing without cover raises suspicion');
assert.equal(turn(turn(wave,'wait','go:6'),'wait','drop').phase,'clear');
assert.notEqual(rules.start(0,'standard',91).keepsake, rules.start(0,'standard',92).keepsake);
checkCampaign(rules);
