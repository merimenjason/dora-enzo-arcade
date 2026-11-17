'use client';
// Jade Street: the Singapore panels. The warden's ticket (pay it with E, or run and the wardens give chase), the
// fines list for the phone, the mama shop at the void deck, Uncle Teo's kopi counter (the kopi mini-game) and the
// kopi lingo glossary. The rules live in lib/jade-fines.ts, lib/jade-sg.ts and lib/jade-mini.ts.
import { useEffect, useRef, useState } from 'react';
import { FINE, type Offence } from '@/lib/jade-fines';
import { MAMA, mamaBuy, LINGO } from '@/lib/jade-sg';
import { KopiGame, KOPI_FIELDS, kopiName, kopiSprite, type KopiOrder } from '@/lib/jade-mini';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Panel } from './panels';
import { Btn, Icon, Sprite, artUrl, fmt } from './ui';

/** the ticket a warden is holding out: the offence, the amount, the quip, and how long before it counts as fleeing */
export function TicketCard({ play }: { play: Play }) {
  const t = play.w.ticket; if (!t) return null;
  const f = FINE[t.kind as Offence];
  const left = Math.max(0, Math.ceil((play.w.assist ? 12 : 8) - t.t));
  return (
    <div className="jade-ticket" role="alert" data-testid="ticket" data-kind={t.kind}>
      <Sprite name="warden-ticket" h={86} />
      <div>
        <b>FINE · {f.name}</b>
        <span className="amt">{t.amt} coins</span>
        <i>“{f.quip}”</i>
        <small>Press E to pay · walk away and it becomes a chase ({left}s)</small>
      </div>
    </div>
  );
}

/** the fines page for the phone: what you have paid, for what, and how often */
export function FinesList({ play }: { play: Play }) {
  const F = play.w.s.fines;
  return (
    <div className="jade-fines" data-testid="fines-list">
      <p><b>{fmt(F.paid)}</b> coins paid in {F.n} fine{F.n === 1 ? '' : 's'}{F.fled ? ` · ran from ${F.fled}` : ''}.</p>
      {!F.list.length && <p className="small">Not a single fine. A model citizen! (Use the zebra crossings, mind the red lights, no gum.)</p>}
      <ul>{F.list.slice(-12).reverse().map((r, i) => <li key={i}><span>{FINE[r.kind as Offence]?.name ?? r.kind}</span><small>night {r.night}</small><b>{r.amt}</b></li>)}</ul>
      {Object.keys(F.by).length > 0 && <p className="small">Repeat offences cost more: half again for each earlier ticket of the same kind, up to three times.</p>}
    </div>
  );
}

/** the mama shop: tissue packets for choping, bird seed, bananas */
export function MamaShop({ play, snd, onClose, onSave }: { play: Play; snd: JadeSound | null; onClose: () => void; onSave: () => void }) {
  const s = play.w.s; const [msg, setMsg] = useState(''); const [, force] = useState(0);
  const buy = (id: string) => { const r = mamaBuy(play.w, id); if (r) { setMsg(r); snd?.bad(); } else { setMsg('Thank you! Come again.'); snd?.coins(); onSave(); } force(x => x + 1); play.bump(); };
  const ICON: Record<string, string> = { tissue: 'tissue', seed: 'seed-bag', banana: 'bananas' };
  return (
    <Panel title="Mama shop" onClose={onClose} cls="mama" testid="mama">
      <p className="small">The little shop under the HDB block sells a bit of everything. <Icon name="ui-coin" size={16} /> {fmt(s.cash)}</p>
      {msg && <p className="jade-msg" data-testid="mama-msg">{msg}</p>}
      <div className="jade-ups">
        {MAMA.map(m => (
          <div className="jade-up" key={m.id}>
            <Sprite name={ICON[m.id]} h={54} w={64} />
            <b>{m.name}</b><small>{m.blurb}</small><small>You have {s.bag[m.id]}</small>
            <Btn kind="gold" testid={`mama-${m.id}`} onClick={() => buy(m.id)}>{m.price} coins</Btn>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** the kopi lingo, for the phone and the kopi counter */
export function Glossary() {
  return (
    <dl className="jade-glossary" data-testid="glossary">
      {LINGO.map(l => <div key={l.term}><dt>{l.term}</dt><dd>{l.means}</dd></div>)}
    </dl>
  );
}

const FIELD_ICON: Record<string, string[]> = {
  base: ['drink-kopi', 'drink-teh'], milk: ['tin-condensed', '', 'tin-evap'], sugar: ['jar-sugar', 'jar-sugar', '', 'jar-sugar'], temp: ['', 'bucket-ice'],
};
/** Uncle Teo's counter: read the order, set the cup, serve. Keys: 1-4 pick a row, ← → change it, Enter serves */
export function KopiMini({ level, assist, seed, snd, onDone, head }: { level: number; assist: boolean; seed: number; snd: JadeSound | null; onDone: (ok: boolean) => void; /** a job's own counter (pass 13: Teh Tarik Time opened as Uncle Teo's) */ head?: [string, string] }) {
  const g = useRef(new KopiGame({ level, assist, seed })).current;
  const [, tick] = useState(0); const [row, setRow] = useState(0); const [help, setHelp] = useState(false);
  const [end, setEnd] = useState<null | boolean>(null);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => {
    let raf = 0, last = 0, endT = 0, ended = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      g.step(dt); for (const e of g.ev.splice(0)) snd?.mini(e.t === 'serve' ? 'ready' : e.t === 'wrong' ? 'oops' : e.t);
      if ((g.done || g.failed) && !ended) { ended = true; setEnd(g.done); }
      if (ended) { endT += dt; if (endT > 1.1) { cancelAnimationFrame(raf); doneRef.current(g.done); return; } }
      tick(t => (t + 1) % 1e6);
    };
    raf = requestAnimationFrame(loop);
    (window as unknown as Record<string, unknown>).__jadeMini = { g: () => g };
    return () => { cancelAnimationFrame(raf); delete (window as unknown as Record<string, unknown>).__jadeMini; };
  }, [g, snd]);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^[1-4]$/.test(k)) setRow(+k - 1);
      else if (k === 'ArrowUp' || k === 'w') setRow(r => (r + 3) % 4);
      else if (k === 'ArrowDown' || k === 's') setRow(r => (r + 1) % 4);
      else if (k === 'ArrowLeft' || k === 'a') g.cycle(row, -1);
      else if (k === 'ArrowRight' || k === 'd') g.cycle(row, 1);
      else if (k === 'Enter' || k === ' ') g.serve();
      else if (k === 'h') setHelp(v => !v);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
  }, [g, row]);
  const o: KopiOrder | undefined = g.order;
  return (
    <div className="jade-mini jade-kopi" data-testid="mini-kopi" data-done={end === null ? undefined : String(end)} style={{ backgroundImage: `url(${artUrl('bg-mg-kopi')})` }}>
      <div className="jade-mini-head">
        <b data-testid="kopi-title">{head?.[0] ?? 'Uncle Teo’s kopi counter'}</b><span>{head?.[1] ?? 'Make each drink the way he calls it, then serve.'}</span>
        <span className={'jade-timer' + (g.time < 10 ? ' low' : '')}>{Math.ceil(g.time)}s</span>
      </div>
      <div className="jade-kopi-body">
        <div className="jade-kopi-order" data-testid="kopi-order">
          <Sprite name="face-teo" h={72} w={72} />
          <div><small>Order {Math.min(g.orders.length, g.i + 1)} of {g.orders.length}</small><b data-testid="kopi-call">“{o ? kopiName(o) : 'All done!'}”</b><small>Tries left: {g.tries}</small></div>
        </div>
        <div className="jade-kopi-cup"><Sprite name={kopiSprite(g.cup)} h={120} /><b>{kopiName(g.cup)}</b></div>
        <div className="jade-kopi-rows">
          {KOPI_FIELDS.map((F, fi) => (
            <div key={F.k} className={'jade-kopi-row' + (row === fi ? ' on' : '')} onClick={() => setRow(fi)}>
              <span className="n">{fi + 1}</span>
              {F.opts.map((v, j) => (
                <button type="button" key={v} data-testid={`kopi-${F.k}-${v}`} className={'jade-kopi-opt' + (g.cup[F.k] === v ? ' on' : '')} onClick={() => { setRow(fi); g.set(F.k, v); }}>
                  {FIELD_ICON[F.k][j] && <Sprite name={FIELD_ICON[F.k][j]} h={26} w={26} />}{F.names[j]}
                </button>
              ))}
            </div>
          ))}
        </div>
        {help && <Glossary />}
      </div>
      <div className="jade-mini-foot">
        <span className="jade-mini-keys">1-4 or ↑ ↓ pick a row · ← → change it · Enter serves · H lingo</span>
        <Btn kind="plain" testid="kopi-help" onClick={() => setHelp(v => !v)}>{help ? 'Hide lingo' : 'Kopi lingo'}</Btn>
        <Btn kind="red" testid="kopi-serve" onClick={() => g.serve()}>Serve</Btn>
        <button type="button" className="jade-btn plain" data-testid="mini-quit" onClick={() => { g.failed = true; g.ev.push({ t: 'fail' }); }}>Give up</button>
      </div>
      {end !== null && <div className={'jade-mini-end ' + (end ? 'ok' : 'bad')}>{end ? 'Shiok! Order up.' : 'Aiyoh, wrong cup.'}</div>}
    </div>
  );
}
