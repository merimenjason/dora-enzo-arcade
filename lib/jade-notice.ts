// Jade Street: one queue for everything that pops up over the street, so hints, toasts and speech bubbles don't pile
// on top of each other. Each notice has a priority (a failure warning or a fine over a trophy, over a cheerful
// "+15 coins", over a passing remark); at most two toasts show at once, the rest wait their turn by priority, a
// repeat of a showing message just refreshes it, and low-priority ones that waited too long are dropped. While a
// banner or an important toast is up, the lesson hint steps aside, and speech bubbles stay quiet. No DOM.
export type Notice = { id: number; msg: string; kind: string; t: number; prio: number; wait: number };
/** priority by kind: bad news first, then gold (trophies, medals), then good news, then plain chatter */
export const PRIO: Record<string, number> = { bad: 3, gold: 2, good: 1, '': 0 };
export const SHOW = 2, LIFE = 3.2, STALE = 6;

export class Notices {
  shown: Notice[] = []; queue: Notice[] = []; private id = 1;
  push(msg: string, kind = '') {
    const prio = PRIO[kind] ?? 0;
    const same = this.shown.find(n => n.msg === msg); if (same) { same.t = LIFE; return; }
    if (this.queue.some(n => n.msg === msg)) return;
    const n: Notice = { id: this.id++, msg, kind, t: LIFE, prio, wait: 0 };
    // room on screen, or more important than the least important one showing: show it now
    if (this.shown.length < SHOW) { this.shown.push(n); return; }
    const low = [...this.shown].sort((a, b) => a.prio - b.prio || b.t - a.t)[0];
    if (prio > low.prio) { this.shown = this.shown.filter(x => x !== low); low.t = LIFE; this.queue.push(low); this.shown.push(n); }
    else this.queue.push(n);
    this.queue.sort((a, b) => b.prio - a.prio || a.id - b.id);
  }
  step(dt: number) {
    for (const n of this.shown) n.t -= dt;
    this.shown = this.shown.filter(n => n.t > 0);
    for (const n of this.queue) n.wait += dt;
    // chatter that waited too long is old news
    this.queue = this.queue.filter(n => n.prio >= 2 || n.wait < STALE);
    while (this.shown.length < SHOW && this.queue.length) this.shown.push(this.queue.shift()!);
  }
  /** clear the passing news (good news and chatter), shown or waiting; warnings and trophies stay */
  dropChatter() { this.shown = this.shown.filter(n => n.prio >= 2); this.queue = this.queue.filter(n => n.prio >= 2); }
  /** something important is on screen: the lesson hint and speech bubbles hold back */
  get busy() { return this.shown.some(n => n.prio >= 2); }
}
