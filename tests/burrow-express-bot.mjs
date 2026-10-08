// A transport planner using the same editing actions and clock as a player. No passenger deletion or free resources.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Game, MAPS } from '../.checks/burrow-express-game.js';

export function order(g) {
  const open = g.active, x = open.reduce((n, s) => n + s.x, 0) / open.length, y = open.reduce((n, s) => n + s.y, 0) / open.length;
  return [...open].sort((a, b) => Math.atan2(a.y - y, a.x - x) - Math.atan2(b.y - y, b.x - x)).map((s) => s.id);
}
export function build(g) {
  if (g.lines[0].loop) g.loop(0);
  while (g.lines[0].stops.length) g.removeLast(0);
  const want = order(g), left = [...want];
  // If rock drills are scarce, try all remaining stops rather than blocking the whole route at a bad edge.
  for (let guard = 0; left.length && guard < 20; guard++) {
    const i = left.findIndex((id) => { const at = g.lines[0].stops.at(-1); return at === undefined || !g.needsDrill(at, id) || g.drills > 0; });
    if (i < 0) break;
    const [id] = left.splice(i, 1); assert.equal(g.append(0, id), '');
  }
  g.loop(0);
  while (g.available > 0 && g.lines[0].stops.length >= 2) assert.equal(g.addCart(0), '');
}
export function play(map, seed = 1, mode = 'challenge') {
  const g = Game.start(map, mode, seed); build(g);
  for (let guard = 0; guard < 12000 && g.state !== 'won' && g.state !== 'lost'; guard++) {
    if (g.state === 'upgrade') {
      const choices = g.offers();
      const pick = g.drills < 2 && choices.includes('drill') ? 'drill' : g.fleet < 7 && choices.includes('cart') ? 'cart' : choices.includes('capacity') ? 'capacity' : choices[0];
      assert.equal(g.upgrade(pick), ''); if (g.block && g.drills) g.repair(); build(g);
    }
    g.update(0.5); g.events.length = 0;
    if (mode === 'endless' && g.day >= 12) break;
  }
  return g;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let wins = 0;
  for (let map = 0; map < MAPS.length; map++) for (let seed = 1; seed <= 4; seed++) {
    const g = play(map, seed); wins += g.state === 'won' ? 1 : 0;
    console.log(`${MAPS[map].name}, seed ${seed}: ${g.state}, ${g.delivered}/${g.goal} delivered on day ${g.day}. ${g.reason}`);
  }
  assert.ok(wins >= 9, `a competent planner should win at least 9 of 12 shifts (won ${wins})`);
}
