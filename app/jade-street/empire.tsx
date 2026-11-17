'use client';
// Jade Street, the tenth pass: the empire's screens. The Empire page (the pause menu's Empire tab and the phone's
// Empire tab): your rank and the next one, the ledger (tonight's takings, the tills, raids seen off and missed), a raid
// in progress with Route me and Send partner, the partner's round of the tills, and every property by district with
// its level, takings, damage, jaga and a Route me button. The property panel's empire row (repair, hire a jaga, the
// empire jobs on offer there tonight), and the HUD's raid clock. The rules are in lib/jade-empire.ts and lib/jade-biz.ts.
import { travelHint } from '@/lib/jade-mrt';
import { useState } from 'react';
import { BIZ, BIZ_OF, bizPos, bizSprite, RANKS, rankOf, empireValue, EMPIRE_COST, DISTRICTS_WITH_PROPS, type BizId } from '@/lib/jade-biz';
import { EMP, ledger, sendRound, sendDefend, canSend, repairBiz, hireJaga, repairCost, jagaCost, jobsAt, startEmpireJob, RAID_WHAT } from '@/lib/jade-empire';
import { GANG_NAME } from '@/lib/jade-props';
import { EMPIRE_JOBS } from '@/lib/jade-empjobs';
import { DISTRICT_NAME, type District } from '@/lib/jade-city';
import { PEOPLE } from '@/lib/jade-story';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Sprite, Btn, fmt, Icon, artUrl } from './ui';
import './empire.css';

const dName = (d: string) => DISTRICT_NAME[d as District].replace(/^the /, 'The ');
const secs = (t: number) => `${Math.floor(t / 60)}:${String(Math.max(0, Math.floor(t % 60))).padStart(2, '0')}`;
/** the route line to a property, from any screen */
export function routeTo(play: Play, id: BizId) {
  const w = play.w, [x, y] = bizPos(BIZ_OF[id]); w.waypoint = [x, y + 40]; w.routeT = 0; w.updateRoute(); play.bump();
}

/** the rank badge, its name and how far to the next */
export function RankCard({ play }: { play: Play }) {
  const s = play.w.s, r = rankOf(s), v = empireValue(s), next = RANKS[r + 1];
  const pct = next ? Math.min(100, Math.round(v / next.need * 100)) : 100;
  return (
    <div className="jade-rank" data-testid="emp-rank">
      {r > 0 ? <Sprite name={`rank-${r}`} h={72} w={72} /> : <span className="jade-rank-none" aria-hidden />}
      <div>
        <b className="jade-rank-name" data-testid="emp-rank-name">{RANKS[r].name}</b>
        {r > 0 && <small>{RANKS[r].perk}</small>}
        <div className="jade-meter" aria-label={next ? `${pct}% of the way to ${next.name}` : 'The top rank'}><span style={{ width: `${pct}%` }} /></div>
        <small>{next ? <>Next, <b>{next.name}</b>: {v <= 0 ? <>buy your first property (any stall or shop with a gold pin)</> : <>put {fmt(Math.max(0, next.need - v))} more coin{Math.max(0, next.need - v) === 1 ? '' : 's'} into properties</>}{r === 3 ? ', with a property in every district' : ''}. Perk: {next.perk.replace(/^./, c => c.toLowerCase())}.</> : <>The top rank. Everything you own takes 10% more.</>}</small>
        <small>Empire value {fmt(v)} of {fmt(EMPIRE_COST)} coins.</small>
      </div>
    </div>
  );
}

/** a raid in progress: where, who, the clock, and what you can do about it */
export function RaidCard({ play, onClose }: { play: Play; onClose?: () => void }) {
  const w = play.w, rd = w.emp.raid; const [msg, setMsg] = useState('');
  if (!rd) return null;
  const b = BIZ_OF[rd.id], why = canSend(w);
  return (
    <div className="jade-raidcard" data-testid="emp-raid">
      <Icon name="pin-raid" size={34} />
      <div>
        <b>Raid on the {b.name}!</b>
        <small>The {GANG_NAME[rd.gang]} are at it in {dName(b.d)} (<span data-testid="emp-raid-far">{travelHint(w, ...bizPos(b))}</span>). {RAID_WHAT[rd.kind]}. {rd.sent ? 'Your partner is on the way.' : <>Get there in <b data-testid="emp-raid-t">{secs(rd.t)}</b>.</>}</small>
        {msg && <small className="jade-msg">{msg}</small>}
        {!rd.sent && <div className="jade-card-btns">
          <Btn kind="red" testid="emp-raid-route" onClick={() => { routeTo(play, rd.id); onClose?.(); }}>Route me there</Btn>
          <Btn kind="jade" testid="emp-raid-send" disabled={!!why} onClick={() => { const r = sendDefend(w); setMsg(r ?? 'Off they go. Their odds are better at a bigger place, or one with a jaga.'); play.bump(); }}>{why ?? 'Send my partner'}</Btn>
        </div>}
      </div>
    </div>
  );
}

/** the Empire page: the pause menu's tab and the phone's */
export function EmpirePage({ play, onClose }: { play: Play; onClose?: () => void }) {
  const w = play.w, s = w.s, L = ledger(w), r = rankOf(s); const [msg, setMsg] = useState(''); const [, force] = useState(0);
  const why = canSend(w) ?? (r < 2 ? 'From Kopi Boss' : L.till < 1 ? 'Every till is empty' : null);
  const st = s.stats;
  return (
    <div className="jade-empire" data-testid="emp-page">
      <img className="jade-emp-banner" src={artUrl('bg-empire')} alt="" draggable={false} />
      <RankCard play={play} />
      <RaidCard play={play} onClose={onClose} />
      <div className="jade-ledger" data-testid="emp-ledger">
        <Icon name="i-ledger" size={30} />
        <p>You own <b data-testid="emp-owned">{L.mine}</b> of {L.all} properties. Tonight they should take about <b>{fmt(L.tonight)}</b> coins; <b data-testid="emp-till">{fmt(L.till)}</b> are waiting in the tills.
          {' '}Raids seen off {st.raidsWon}, missed {st.raidsMissed}.{L.damaged ? <> <b className="bad">{L.damaged} damaged</b>: repair them to take anything.</> : ''}{L.jagas ? ` Pak Duri watches ${L.jagas}.` : ''}</p>
      </div>
      {msg && <p className="jade-msg" data-testid="emp-msg">{msg}</p>}
      <div className="jade-card-btns">
        <Btn kind="gold" testid="emp-round" disabled={!!why || !!w.emp.round} onClick={() => { const e = sendRound(w); setMsg(e ?? 'Your partner sets off round the tills. They’ll hand the coins over when they’re back.'); force(n => n + 1); play.bump(); }}>
          <Icon name="i-round" size={20} /> {w.emp.round ? `Out on a round: ${w.emp.round.got} coins so far` : why ? `Send partner round the tills (${why})` : `Send partner round the tills (${fmt(L.till)})`}
        </Btn>
      </div>
      <p className="small">Takings fill each till through the night (it holds about three nights). Collect in person, at any safe house, or send your partner. Gangs raid now and then, at 11 pm and 3 am: you get a text and a red pin, and about {Math.round(w.assist ? EMP.windowAssist : EMP.window)} seconds to get there. A place is never lost for good. Empire jobs: {EMPIRE_JOBS.filter(j => (s.empire.jobs[j.id] ?? 0) > 0).length} of {EMPIRE_JOBS.length} kinds done.</p>
      {DISTRICTS_WITH_PROPS.filter(d => BIZ.some(b => b.d === d)).map(d => (
        <div key={d} className="jade-empdist">
          <h3>{dName(d)}{w.open.has(d) ? '' : ' (not open yet)'}</h3>
          <div className="jade-bizlist">
            {BIZ.filter(b => b.d === d).map(b => {
              const bs = s.biz[b.id], rate = L.rate(b.id);
              return (
                <div key={b.id} className={'jade-bizrow' + (bs.lvl ? ' mine' : '') + (bs.dmg ? ' dmg' : '')} data-testid={`emp-row-${b.id}`}>
                  <Sprite name={bizSprite(b.id, bs.lvl)} h={56} w={64} />
                  <div><b>{b.name}</b>
                    <small>{bs.lvl ? <>level {bs.lvl} of 3 · {bs.dmg ? <b className="bad">damaged</b> : `${rate}/night`} · till {Math.floor(bs.bank)}{bs.jaga ? ' · jaga' : ''}{bs.boost ? ` · busy (${bs.boost} nights)` : ''}</> : <>for sale: {fmt(b.price)} coins (needs {b.need} rep)</>}{bs.raids ? ` · raids ${bs.defended}/${bs.raids}` : ''}</small>
                  </div>
                  {w.open.has(d) && <Btn kind="plain" testid={`emp-route-${b.id}`} onClick={() => { routeTo(play, b.id); onClose?.(); }}>Route me</Btn>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** the property panel's empire row: repair, hire the jaga, and the empire jobs on offer tonight */
export function EmpireActions({ play, id, snd, onClose, onSave }: { play: Play; id: BizId; snd: JadeSound | null; onClose: () => void; onSave: () => void }) {
  const w = play.w, s = w.s, st = s.biz[id]; const [msg, setMsg] = useState(''); const [, force] = useState(0);
  if (!st.lvl) return null;
  const done = (r: string | null, ok: string) => { if (r) { setMsg(r); snd?.bad(); } else { setMsg(ok); onSave(); } force(x => x + 1); play.bump(); };
  const jobs = jobsAt(w, id);
  return (
    <div className="jade-empact" data-testid="emp-actions">
      {st.dmg > 0 && <p className="bad" data-testid="biz-dmg">Smashed up in a raid. It takes nothing until it is repaired.</p>}
      {msg && <p className="jade-msg" data-testid="emp-act-msg">{msg}</p>}
      <div className="jade-card-btns">
        {st.dmg > 0 && <Btn kind="red" testid="biz-repair" disabled={s.cash < repairCost(id)} onClick={() => done(repairBiz(w, id), 'Patched up and open again.')}><Icon name="i-repair" size={20} /> Repair for {fmt(repairCost(id))} coins</Btn>}
        {!st.jaga && <Btn kind="plain" testid="biz-jaga" disabled={s.empire.rank < 3 || s.cash < jagaCost(id)} onClick={() => done(hireJaga(w, id), 'Pak Duri keeps watch here now: missed raids cost half, and he joins any stand at the shop.')}><Icon name="i-jaga" size={20} /> {s.empire.rank < 3 ? 'A jaga (night watchman): from Shophouse Tycoon' : `Hire Pak Duri as jaga for ${fmt(jagaCost(id))} coins`}</Btn>}
        {st.jaga && <span className="small" data-testid="biz-jaga-on"><Icon name="i-jaga" size={18} /> Pak Duri keeps watch here.</span>}
      </div>
      {jobs.length > 0 && <div className="jade-empjobs" data-testid="emp-jobs">
        <b>Empire jobs tonight</b>
        {jobs.map(j => (
          <div key={j.id} className="jade-empjob">
            <Sprite name={PEOPLE[j.giver]?.face ?? 'face-kee'} h={44} w={44} />
            <p><b>{j.title}</b> <small>({PEOPLE[j.giver]?.name}) {j.blurb} Reward {j.reward} coins and {Math.round((j.boost[0] - 1) * 100)}% more takings for {j.boost[1]} nights.</small></p>
            <Btn kind="jade" testid={`emp-job-${j.id}`} disabled={!!w.run} onClick={() => { const r = startEmpireJob(w, j.id, id); if (r) done(r, ''); else { onClose(); play.bump(); } }}>Take it</Btn>
          </div>
        ))}
      </div>}
    </div>
  );
}

/** the HUD's raid clock (and the partner's errand) */
export function RaidHud({ play }: { play: Play }) {
  const w = play.w, rd = w.emp.raid, rn = w.emp.round;
  if (!rd && !rn) return null;
  return (
    <div className="jade-raidhud" data-testid="hud-raid">
      {rd && !rd.sent && !w.run && <div className={'jade-raidclock' + (rd.t < 30 ? ' low' : '')}><Icon name="pin-raid" size={22} /> Raid on the {BIZ_OF[rd.id].name}! <b>{secs(rd.t)}</b></div>}
      {rn && <div className="jade-roundhud"><Icon name="i-round" size={20} /> {rn.kind === 'collect' ? `Partner on a round: ${rn.got} coins` : 'Partner seeing off the raid'}</div>}
    </div>
  );
}
