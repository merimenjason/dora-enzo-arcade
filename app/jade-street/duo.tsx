'use client';
// Jade Street HUD for the duo and the gadgets: both portraits (click the partner, or press Tab, to switch; what the
// partner is up to underneath), the tag-team prompt (F and what it will do right now), the gadget hands (two slots,
// clip and spare ammo, the reload bar; click a slot or press 1 and 2), and Tock's toy stall (buy gadgets, ammo packs
// and upgrades, and choose who carries what).
import { useState } from 'react';
import { tagOption } from '@/lib/jade-tag';
import { GADGETS, GADGET_IDS, carried, clipOf, ammoCap, buyGadget, buyAmmo, upgradeGadget, carry, shooterFor, type GadgetId } from '@/lib/jade-gear';
import type { Hero } from '@/lib/jade-save';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Sprite, Icon, Btn, fmt } from './ui';
import { Panel } from './panels';

const NAME: Record<string, string> = { dora: 'Dora', enzo: 'Enzo' };
/** what the partner is doing, in a few words */
export function mateStatus(play: Play): string {
  const w = play.w, m = w.mate, ai = m.ai;
  if (w.two) return 'Player 2';
  if (m.seat) return 'Riding behind you';
  if (m.hide) return 'Hiding with you';
  if (ai.mode === 'hold') return ai.holding ? (m.anim === 'haul' ? 'Hauling the rope' : 'Holding the lever') : 'Running to the lever';
  if (ai.mode === 'distract') return 'Distracting!';
  if (ai.mode === 'pounce') return 'Pouncing!';
  if (ai.mode === 'guard') return 'Guarding the far flank';
  if (ai.mode === 'post') return 'Heading to the meeting point';
  if (ai.mode === 'stay') return 'Waiting for you';
  return 'Following you';
}

export function DuoBar({ play }: { play: Play }) {
  const w = play.w, p = w.p, m = w.mate;
  return (
    <div className="jade-duo" data-testid="duo">
      <span className="jade-duo-face on" data-testid="duo-active" title={`You are playing ${NAME[p.who]}`}><Sprite name={`face-${p.who}`} h={46} w={46} /><b>{NAME[p.who]}</b></span>
      <button type="button" className="jade-duo-face mate" data-testid="duo-switch" disabled={w.two} title={w.two ? 'Player 2 is playing this hero' : `Switch to ${NAME[m.who]} (Tab)`}
        onClick={() => play.press('swap')}>
        <Sprite name={`face-${m.who}`} h={34} w={34} /><span><b>{NAME[m.who]}</b><small data-testid="mate-status">{mateStatus(play)}</small></span>{!w.two && <kbd>Tab</kbd>}
      </button>
    </div>
  );
}

/** F: the tag-team move on offer right now */
export function TagPrompt({ play }: { play: Play }) {
  const w = play.w; if (w.talk || w.ui || w.failed) return null;
  // waiting and calling over are always there (the Controls page lists them); only a real move gets the prompt
  const o = tagOption(w); if (!o || o.kind === 'wait' || o.kind === 'call') return null;
  return (
    <button type="button" className="jade-tag-prompt" data-testid="tag-prompt" data-kind={o.kind} onClick={() => play.press('tag')}>
      <kbd>F</kbd><span>{o.label}</span>
    </button>
  );
}

/** the gadget hands of whoever would fire now (the passenger when riding) */
export function GearHud({ play }: { play: Play }) {
  const w = play.w, s = w.s; if (!s.gear.own.length || w.talk || w.ui) return null;
  const sh = shooterFor(w, w.p); const who = sh?.who ?? w.p.who; const hand = s.gear.carry[who]; const cur = carried(s, who);
  const pct = sh && sh.reloadT > 0 && cur ? 1 - sh.reloadT / (GADGETS[cur].reload * (1 - 0.2 * s.gear.lvl[cur])) : 0;
  return (
    <div className={'jade-gear' + (sh ? '' : ' off')} data-testid="gear-hud">
      <div className="jade-gear-who">{sh ? (sh === w.p ? `${NAME[who]}’s gadgets` : `${NAME[who]} fires from the back seat`) : 'Driving: no free paws'}</div>
      <div className="jade-gear-slots">
        {[0, 1].map(i => {
          const g = hand[i] as GadgetId | undefined;
          return (
            <button key={i} type="button" className={'jade-gear-slot' + (g && g === cur ? ' on' : '')} data-testid={`gear-slot-${i}`} disabled={!g} onClick={() => { play.pend.slot = i; }} title={g ? GADGETS[g].name : 'Empty hand'}>
              <kbd>{i + 1}</kbd>
              {g ? <><Sprite name={`g-${g}`} h={40} w={40} /><span className="ammo" data-testid={`gear-ammo-${i}`}><b>{s.gear.clip[g]}</b>/{clipOf(s, g)} <small>+{s.gear.ammo[g]}</small></span></> : <span className="empty">empty</span>}
            </button>
          );
        })}
      </div>
      {pct > 0 && <div className="jade-gear-reload" data-testid="gear-reload"><b style={{ width: `${Math.round(pct * 100)}%` }} /></div>}
      <div className="jade-gear-keys">Click fire · 1 2 swap · X reload</div>
    </div>
  );
}

/** Tock's toy stall */
export function GearStall({ play, snd, onClose, onSave }: { play: Play; snd: JadeSound | null; onClose: () => void; onSave: () => void }) {
  const s = play.w.s; const [, force] = useState(0); const [msg, setMsg] = useState('');
  const done = (r: string | null, ok: string) => { if (r) { setMsg(r); snd?.bad(); } else { setMsg(ok); snd?.coins(); onSave(); } force(x => x + 1); play.bump(); };
  const heroes: Hero[] = ['dora', 'enzo'];
  return (
    <Panel title="Tock’s toy stall" onClose={onClose} cls="gear" testid="gear-stall">
      <div className="jade-gear-head">
        <Sprite name="face-tock-happy" h={88} w={88} />
        <p>“Festival toys, never weapons! Splat a magpie, dizzy a cart. Mind the wardens, they don’t laugh.” <span className="small"><Icon name="ui-coin" size={16} /> {fmt(s.cash)}</span></p>
      </div>
      {msg && <p className="jade-msg" data-testid="gear-msg">{msg}</p>}
      <div className="jade-gear-list">
        {GADGET_IDS.map(g => {
          const d = GADGETS[g], own = s.gear.own.includes(g), lvl = s.gear.lvl[g];
          const who = heroes.find(h => s.gear.carry[h].includes(g));
          return (
            <div className={'jade-gear-item' + (own ? ' own' : '')} key={g} data-testid={`gear-${g}`}>
              <Sprite name={`g-${g}`} h={58} w={58} />
              <div className="jade-gear-info">
                <b>{d.name}</b><small>{d.blurb}</small>
                {own && <small className="jade-gear-stat">{s.gear.clip[g] + s.gear.ammo[g]} {d.ammoName} (holds {ammoCap(s, g)}) · tuned {lvl}/2 · {who ? `${NAME[who]} carries it` : 'in the kit'}</small>}
              </div>
              <div className="jade-gear-btns">
                {!own && <Btn kind="gold" testid={`buy-${g}`} onClick={() => done(buyGadget(s, g), `The ${d.name.toLowerCase()} is yours!`)}>{d.price} coins</Btn>}
                {own && <Btn kind="jade" testid={`ammo-${g}`} onClick={() => done(buyAmmo(s, g), `+${d.pack} ${d.ammoName}`)}>{`+${d.pack} for ${d.packPrice}`}</Btn>}
                {own && <Btn kind="gold" testid={`up-${g}`} disabled={lvl >= 2} onClick={() => done(upgradeGadget(s, g), `${d.name} tuned up: bigger clip, stronger, quicker to reload`)}>{lvl >= 2 ? 'Fully tuned' : `Tune ${d.up[lvl]}`}</Btn>}
                {own && heroes.map(h => <Btn key={h} kind="plain" testid={`carry-${g}-${h}`} disabled={s.gear.carry[h].includes(g)} onClick={() => done(carry(s, h, g), `${NAME[h]} carries the ${d.name.toLowerCase()}`)}>{`Give ${NAME[h]}`}</Btn>)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="small">Each hero carries two gadgets. On a ride, the one behind fires. Red supply crates around the quarter refill every satchel.</p>
    </Panel>
  );
}
