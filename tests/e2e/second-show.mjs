import { secondShow } from '../../.checks/second-show-game.js';
import { checkBrowser, checkMap } from './arcade-originals-common.mjs';
await checkBrowser(secondShow, '__secondShow');
await checkMap(secondShow, '__secondShow');
