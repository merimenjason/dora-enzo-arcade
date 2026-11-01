// The Night Market bots' policies, shared by tests/market-bot.mjs and the engine suite. All three buy and set out
// the stall the same sensible way; they differ in how they haggle:
//  - reader: reads the tells into a guess at the top price, asks about that, and takes a decent counter;
//  - greedy: always asks the top of the dial;
//  - giveaway: always asks well under the going rate.
export function stockUp(G, s) {
  const M = s.market;
  const reserve = 3 * Math.min(2, Math.max(1, Math.floor(s.stock.length / 4)));
  const held = (id) => s.stock.filter((u) => u.item === id).length;
  for (let guard = 0; guard < 40; guard++) {
    let best = null, bestScore = 0;
    for (const id of G.ITEM_IDS) {
      if (!M.open.includes(G.ITEMS[id].supplier) || !G.canBuy(s, id) || s.purse - M.cost[id] < reserve) continue;
      const value = G.goingRate(s, id), margin = value - M.cost[id];
      if (margin < 2) continue;
      const score = margin * M.demand[id] / (1 + held(id) * 0.9);
      if (score > bestScore) { best = id; bestScore = score; }
    }
    if (!best) break;
    G.buy(s, best);
  }
  // the front: the most valuable wares, completing a set when one is on hand
  const items = [...new Set(s.stock.map((u) => u.item))].sort((a, b) => G.goingRate(s, b) - G.goingRate(s, a));
  for (const id of items) G.setFront(s, id, false);
  const front = [];
  for (const st of Object.values(G.SETS)) if (st.items.every((i) => items.includes(i)) && front.length <= 1) front.push(...st.items);
  for (const id of items) if (front.length < 3 && !front.includes(id)) front.push(id);
  for (const id of front.slice(0, 3)) G.setFront(s, id, true);
  const without = G.crowd({ ...s, lanterns: 0 });
  G.setLanterns(s, Math.max(0, Math.min(3, s.stock.length - without - 1)));
}

export function haggle(G, s, c, policy) {
  const [lo, hi] = G.askRange(c);
  if (policy === 'greedy') {
    for (let i = 0; i < 6 && s.customer; i++) G.ask(s, hi);
    return;
  }
  if (policy === 'giveaway') { G.ask(s, Math.max(lo, Math.round(c.value * 0.65))); if (s.customer) G.takeOffer(s); return; }
  const est = G.hunch(c);
  const fairish = c.persona === 'regular' ? 0.9 : 1;
  let r = G.ask(s, Math.max(lo, Math.round(est * fairish)));
  for (let i = 0; i < 3 && r.kind === 'counter'; i++) {
    if (r.offer >= est * 0.84 || c.persona === 'impulsive' || c.persona === 'hurry') { r = G.takeOffer(s); break; }
    r = G.ask(s, Math.max(r.offer + 1, Math.round(est * 0.9)));
  }
}

/** Plays a whole month (or free market); returns the final state and the week results. */
export function play(G, seed, policy, mode = 'moon') {
  const s = G.newGame(seed, mode);
  for (let guard = 0; guard < 40 && s.phase !== 'end'; guard++) {
    stockUp(G, s);
    G.openStall(s);
    for (let c = G.nextCustomer(s); c; c = G.nextCustomer(s)) haggle(G, s, c, policy);
    G.closeStall(s);
    if (s.phase === 'dawn') G.nextDusk(s);
  }
  return s;
}
