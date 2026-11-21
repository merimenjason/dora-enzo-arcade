// Jade Street: the little phone. Contacts text you: a job offer when one of their jobs opens up, a market tip at the
// start of most nights (it really moves that price), and a shout for help when a street event starts near you. The
// texts live in the save (the last 30); the HUD shows the phone with an unread badge.
import { DISTRICT_NAME, type District } from './jade-city.js';
import { GOODS, GOOD } from './jade-trade.js';
import { offered } from './jade-save.js';
import { PEOPLE } from './jade-story.js';
import type { World } from './jade-game.js';
import type { Msg } from './jade-save.js';

export const CONTACT_OF: Record<District, string> = { market: 'kee', temple: 'pang', canal: 'kiri', docks: 'bo', arcade: 'gizmo', heartland: 'kamal', bay: 'vanda', india: 'raju', glam: 'kancil', resort: 'duyung', orchard: 'tiara', katong: 'rosie', changi: 'ubin', tiong: 'seng', quay: 'melati', jurong: 'musang', pulau: 'ayu', kallang: 'tenuk', mandai: 'kongkang' };
export function text(w: World, from: string, msg: string, o: { kind?: Msg['kind']; job?: string } = {}) {
  const s = w.s; const id = (s.msgs[s.msgs.length - 1]?.id ?? 0) + 1;
  s.msgs.push({ id, from, text: msg, night: s.night, read: false, ...o });
  if (s.msgs.length > 30) s.msgs.splice(0, s.msgs.length - 30);
  w.fx.push({ t: 'text', name: from, msg });
}
/** the badge: unread job offers, fines and calls for help (tips and chatter don't count) */
export const unread = (w: World) => w.s.msgs.filter(m => !m.read && !!m.kind).length;
export function readAll(w: World) { for (const m of w.s.msgs) m.read = true; }

/** a job's blurb in the giver's own voice: "Ah Beng’s wok rolled off…" becomes "My wok rolled off…" */
export function firstPerson(blurb: string, name: string) {
  if (!name) return blurb;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return blurb.replace(new RegExp(`(^|[.!?]\\s+)${esc}’s `, 'g'), '$1My ').replace(new RegExp(`${esc}’s `, 'g'), 'my ').replace(new RegExp(`(^|[.!?]\\s+)${esc}\\b`, 'g'), '$1I').replace(new RegExp(`\\b${esc}\\b`, 'g'), 'me');
}
/** job offers: text once for each job that becomes available (not the very first, Uncle Kee is right there) */
export function phoneStep(w: World) {
  // (pass 13: nothing until Opening Night is done: Chef Mo's text competed with the first job)
  if (w.tick % 30 !== 0 || !w.s.story.intro || !w.s.done.includes('m1')) return;
  const ids = offered(w.s).map(m => m.id);
  for (const m of offered(w.s)) {
    if (w.offered.has(m.id)) continue;
    w.offered.add(m.id);
    if (m.id === 'm1' || w.run) continue;
    // once per job, ever (the save remembers the text, so a reload doesn't send it again)
    if (w.s.msgs.some(x => x.job === m.id)) continue;
    const where = w.c.places[m.at];
    text(w, m.giver, `Job for you: “${m.title}”. ${firstPerson(m.blurb, PEOPLE[m.giver]?.name ?? '')} Come and find me${where ? ` in ${DISTRICT_NAME[where.d].replace(/^the /, 'the ')}` : ''}.`, { kind: 'job', job: m.id });
  }
  void ids;
}
/** at the start of a night, a contact in an open district may text a tip that lifts a good's price at their market */
export function nightTip(w: World) {
  const open = [...w.open]; if (!open.length || w.R() < 0.25) return;
  const d = open[Math.floor(w.R() * open.length)]; const g = GOODS[Math.floor(w.R() * GOODS.length)];
  const mult = 1.25 + w.R() * 0.15; const from = CONTACT_OF[d];
  w.s.tips.push({ night: w.s.night, market: d, good: g, mult, from: PEOPLE[from].name, text: '' });
  text(w, from, `Psst! Buyers at my market want ${GOOD[g].name.toLowerCase()} tonight. They will pay about ${Math.round((mult - 1) * 100)}% more.`);
}
