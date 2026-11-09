import { nightWire } from '../../.checks/night-wire-game.js';
import { checkBrowser, checkMap } from './arcade-originals-common.mjs';
await checkBrowser(nightWire, '__nightWire');
await checkMap(nightWire, '__nightWire');
