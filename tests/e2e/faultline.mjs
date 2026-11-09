import { faultline } from '../../.checks/faultline-game.js';
import { checkBrowser, checkMap } from './arcade-originals-common.mjs';
await checkBrowser(faultline, '__faultline');
await checkMap(faultline, '__faultline');
