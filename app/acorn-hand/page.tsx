/* oxlint-disable react/react-compiler -- The run is a mutable engine object read on each render, like the other card games. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation back to the menu. */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Run, BLIND, ANTES, ITEM_COST, MAX_PLAY, INTEREST_EVERY, HANDS, CHARMS, GLOSS_TEXT, SUITS, VOUCHERS, VOUCHER_COST,
  charmById, handById, itemName, itemText, rankLong, voucherById, packById, loadProfile, freshProfile, record,
  type Card, type Score, type Profile, type Item, type Rival, type PackType, type PackKind,
} from '../../lib/acorn-hand-game';
import { drawCard, drawCharm, drawRival, drawVoucher, drawPack } from '../../lib/acorn-hand-scene';
import { drawChinchilla } from '../../lib/chinchilla-art';
import { fitDraw } from '../../lib/art-fit';
import { useHoverNote } from '../../components/hover-note';
import { sound } from './sound';
import './acorn-hand.css';

const RUN_KEY = 'acorn-hand-run-v2', PROFILE_KEY = 'acorn-hand-v1';
const readJson = (key: string): unknown => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } };
const writeJson = (key: string, v: unknown) => { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* private window: nothing is kept */ } };
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const fmtMult = (n: number) => (Number.isInteger(n) ? fmt(n) : n.toFixed(1));
const RARITY = ['', 'Common', 'Uncommon', 'Rare'];
const TREAT_ICON: Record<string, string> = { honey: '🍯', spice: '🌶️', dew: '💧', leaf: '🍂', dye0: '🌰', dye1: '☘️', dye2: '🍓', dye3: '🪨', mirror: '🪞', compost: '🪱', sprout: '🌱', tea: '🍵', wish: '⭐' };
const itemIcon = (it: Item) => (it.kind === 'almanac' ? '📖' : TREAT_ICON[it.id] ?? '🍀');
const cardName = (c: Card) => `${rankLong(c.rank)} of ${SUITS[c.suit]}${c.gloss ? `, ${c.gloss}` : ''}`;
const PACK_TEXT: Record<PackKind, string> = {
  charm: 'Chinchilla charms: take one into a free slot.', almanac: 'Almanac pages, each used as you take it.',
  treat: 'Treats, used at once on cards dealt from your deck.', card: 'Playing cards, some glossed, that join your deck.',
};
const packLine = (t: PackType, bonus: number) => `Pick ${t.picks} of ${t.shown + bonus}`;

type Anim = { score: Score; cards: Card[]; step: number; total: boolean };

/** A canvas that redraws when `sig` changes. */
function Paint({ w, h, sig, draw, className, label }: { w: number; h: number; sig: string; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (c) { c.setTransform(1, 0, 0, 1, 0, 0); draw(c, w, h); } }, [sig, w, h]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} width={w} height={h} className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />;
}
const CardArt = ({ card, down, asleep }: { card: Card; down?: boolean; asleep?: boolean }) =>
  <Paint w={150} h={210} sig={`${card.rank}-${card.suit}-${card.gloss}-${!!down}-${!!asleep}`} draw={(c, w, h) => drawCard(c, card, w, h, { down, asleep })} />;
const CharmArt = ({ id }: { id: string }) => <Paint w={120} h={150} sig={id} draw={(c, w, h) => drawCharm(c, charmById(id)!, w, h)} />;
const RivalArt = ({ rival }: { rival: Rival }) => <Paint w={160} h={120} sig={rival} draw={(c, w, h) => drawRival(c, rival, w, h)} />;
const VoucherArt = ({ id }: { id: string }) => <Paint w={150} h={110} sig={id} draw={(c, w, h) => drawVoucher(c, voucherById(id)!, w, h)} />;
const PackArt = ({ id }: { id: string }) => <Paint w={110} h={150} sig={id} draw={(c, w, h) => drawPack(c, packById(id)!, w, h)} />;

/** Dora and Enzo with a royal flush fanned out between them, for the title. */
function TitleArt() {
  return <Paint w={520} h={300} sig="title" className="ah-title-art" draw={(c, w, h) => {
    c.clearRect(0, 0, w, h);
    const fan = [10, 11, 12, 13, 14];
    fan.forEach((rank, i) => {
      const off = document.createElement('canvas'); off.width = 150; off.height = 210;
      drawCard(off.getContext('2d')!, { id: -1, rank, suit: 0, gloss: rank === 14 ? 'gold' : '' }, 150, 210);
      c.save(); c.translate(w / 2 + (i - 2) * 40, h * 0.98); c.rotate((i - 2) * 0.17); c.drawImage(off, -55, -232, 110, 154); c.restore();
    });
    // Each chinchilla in a box of its own, so tails and ears stay inside the picture.
    fitDraw(c, 'ah-title-dora', 0, h * 0.34, w * 0.3, h * 0.64, (q) => drawChinchilla(q, 'dora', 0, 0, { face: 1, h: 24, time: 0.4 }));
    fitDraw(c, 'ah-title-enzo', w * 0.7, h * 0.32, w * 0.3, h * 0.66, (q) => drawChinchilla(q, 'enzo', 0, 0, { face: 1, h: 24, time: 0.9 }), -1);
  }} />;
}

export default function AcornHandPage() {
  const runRef = useRef<Run | null>(null), [, setTick] = useState(0), refresh = useCallback(() => setTick((n) => n + 1), []);
  const [profile, setProfile] = useState<Profile>(freshProfile), [view, setView] = useState<'title' | 'run'>('title');
  const [kept, setKept] = useState<Run | null>(null), [selected, setSelected] = useState<number[]>([]), [anim, setAnim] = useState<Anim | null>(null);
  const [ready, setReady] = useState(false), [note, setNote] = useState(''), [muted, setMuted] = useState(false), [sortBy, setSortBy] = useState<'rank' | 'suit'>('rank'), [help, setHelp] = useState(false);
  const motion = useRef(true), timers = useRef<number[]>([]), finished = useRef(new Set<string>()), handBefore = useRef<number[] | null>(null);
  const { tip, view: noteView } = useHoverNote();
  const run = runRef.current;

  useEffect(() => {
    setProfile(loadProfile(readJson(PROFILE_KEY))); setKept(Run.load(readJson(RUN_KEY))); setMuted(sound.muted()); setReady(true);
    const media = matchMedia('(prefers-reduced-motion: reduce)'), sync = () => { motion.current = !media.matches; }; sync();
    media.addEventListener('change', sync);
    const pending = timers.current;
    return () => { media.removeEventListener('change', sync); pending.forEach(clearTimeout); };
  }, []);
  useEffect(() => { (window as unknown as { __acorn?: () => unknown }).__acorn = () => ({ run: runRef.current, profile, anim, selected, refresh, motion: motion.current, pack: runRef.current?.pack ?? null, offer: runRef.current?.offer ?? null, vouchers: runRef.current?.vouchers ?? [] }); });

  /** Save the run and fold it into the record. A finished run is counted once and its save is cleared. */
  const persist = useCallback(() => {
    const r = runRef.current; if (!r) return;
    const done = r.phase === 'over' || r.phase === 'victory', key = `${r.seed}`, first = done && !finished.current.has(key);
    if (first) finished.current.add(key);
    setProfile((p) => { const next = record(p, r, first); writeJson(PROFILE_KEY, next); return next; });
    writeJson(RUN_KEY, r.phase === 'over' ? null : r.save());
  }, []);
  const act = (did: unknown, cue: Parameters<typeof sound.cue>[0] = 'click', fail = '') => {
    if (did) { sound.cue(cue); persist(); setNote(''); } else { sound.cue('nope'); if (fail) setNote(fail); }
    refresh(); return !!did;
  };
  const begin = (r: Run) => { runRef.current = r; setSelected([]); setAnim(null); setNote(''); setView('run'); persist(); refresh(); sound.cue('deal'); };
  const newRun = () => begin(new Run((Math.random() * 0xffffffff) >>> 0));
  const toTitle = () => { persist(); setKept(runRef.current && runRef.current.phase !== 'over' ? Run.load(runRef.current.save()) : null); setView('title'); };
  const resort = (r: Run, by = sortBy) => r.sort(by);
  const toggle = (id: number) => {
    if (anim || !(run?.phase === 'round' || (run?.phase === 'pack' && run.pack?.dealt.includes(id)))) return;
    setSelected((s) => { if (s.includes(id)) { sound.cue('drop'); return s.filter((x) => x !== id); } if (s.length >= MAX_PLAY) { sound.cue('nope'); return s; } sound.cue('pick'); return [...s, id]; });
  };

  /** Play the selected cards and count the score up step by step. */
  const playHand = () => {
    const r = runRef.current; if (!r || anim) return;
    const why = r.whyNot(selected); if (why) { act(false, 'nope', why); return; }
    const cards = selected.map((id) => ({ ...r.card(id) }));
    handBefore.current = r.round!.hand.filter((id) => !selected.includes(id));
    const s = r.play(selected)!; setSelected([]);
    if (r.phase === 'round') resort(r);
    persist();
    if (!motion.current) { finishAnim(r, s); return; }
    const per = Math.max(110, Math.min(260, 2600 / s.steps.length));
    setAnim({ score: s, cards, step: 0, total: false });
    s.steps.forEach((st, i) => timers.current.push(window.setTimeout(() => {
      setAnim((a) => (a ? { ...a, step: i } : a));
      sound.cue(st.who === 'boss' ? 'sleep' : st.text.includes('×') ? 'times' : st.text.includes('mult') ? 'mult' : 'chip', Math.min(12, i), 1, 0.02);
    }, 300 + i * per)));
    timers.current.push(window.setTimeout(() => { setAnim((a) => (a ? { ...a, total: true } : a)); sound.cue('total'); }, 300 + s.steps.length * per + 120));
    timers.current.push(window.setTimeout(() => finishAnim(r, s), 300 + s.steps.length * per + 1000));
  };
  const finishAnim = (r: Run, s: Score) => {
    setAnim(null); handBefore.current = null;
    setNote(`${handById(s.hand).name} scored ${fmt(s.total)}.`);
    if (r.phase === 'cashout') sound.cue('won'); else if (r.phase === 'over') sound.cue('lost'); else sound.cue('deal');
    refresh();
  };
  const discard = () => {
    const r = runRef.current; if (!r || anim) return;
    if (!selected.length) { act(false, 'nope', 'Select the cards to throw away.'); return; }
    if (r.round!.discards <= 0) { act(false, 'nope', 'No discards left this round.'); return; }
    const ok = r.discard(selected); if (ok) { resort(r); setSelected([]); }
    act(ok, 'discard', 'Those cards cannot be discarded.');
  };
  const sortHand = () => { const r = runRef.current; if (!r?.round || anim) return; const by = sortBy === 'rank' ? 'suit' : 'rank'; setSortBy(by); r.sort(by); sound.cue('click'); refresh(); };
  const applyItem = (slot: number) => {
    const r = runRef.current; if (!r) return;
    const why = r.itemWhyNot(slot, selected); if (why) { act(false, 'nope', why); return; }
    const it = r.items[slot], ok = r.useItem(slot, selected);
    // Clear the selection, so the cards a treat just changed are not thrown away by the next discard.
    if (ok) { setSelected([]); setNote(`${itemName(it)} used.`); if (r.round) resort(r); }
    sound.cue(ok ? 'use' : 'nope'); persist(); refresh();
  };
  /** Take option `i` of the open pack, using the selected dealt cards for a treat. */
  const takeOption = (i: number) => {
    const r = runRef.current; if (!r?.pack) return;
    const why = r.packWhyNot(i, selected); if (why) { act(false, 'nope', why); return; }
    const ok = r.takePack(i, selected); if (ok) setSelected([]);
    act(ok, 'use');
  };
  const skipPack = () => { const r = runRef.current; if (!r) return; setSelected([]); act(r.skipPack(), 'click'); };

  // Keyboard: 1 to 9 pick cards, Enter plays, D discards, S sorts, Escape clears, M mutes; in a pack 1 to 9 take, S skips.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'm' || e.key === 'M') { const m = !sound.muted(); sound.setMuted(m); setMuted(m); return; }
      const r = runRef.current; if (view !== 'run' || !r || anim) return;
      if (r.phase === 'pack') {
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); takeOption(Number(e.key) - 1); }
        else if (e.key === 's' || e.key === 'S') skipPack();
        else if (e.key === 'Escape') setSelected([]);
        return;
      }
      if (r.phase !== 'round') return;
      if (/^[1-9]$/.test(e.key)) { const id = r.round!.hand[Number(e.key) - 1]; if (id !== undefined) { e.preventDefault(); toggle(id); } }
      else if (e.key === 'Enter') { e.preventDefault(); playHand(); }
      else if (e.key === 'd' || e.key === 'D') discard();
      else if (e.key === 's' || e.key === 'S') sortHand();
      else if (e.key === 'Escape') setSelected([]);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const mute = () => { const m = !muted; sound.setMuted(m); setMuted(m); };
  const header = (
    <header className="ah-top">
      <a className="ah-back" href="/">← Arcade</a>
      <h1>Acorn Hand</h1>
      <div className="ah-top-right">
        {view === 'run' && run && <span className="ah-nuts" data-testid="nuts" aria-label={`${run.nuts} nuts`}>🌰 {run.nuts}</span>}
        <button data-testid="mute" aria-pressed={muted} onClick={mute}>{muted ? 'Sound off' : 'Sound on'}</button>
        {view === 'run' && <button data-testid="menu" onClick={toTitle}>Menu</button>}
      </div>
    </header>
  );

  if (view === 'title' || !run) {
    return (
      <main className="ah-shell" data-ready={ready}>
        {header}
        <section className="ah-title" data-testid="title">
          <TitleArt />
          <p className="ah-eyebrow">A poker-scoring card run</p>
          <h2>Acorn Hand</h2>
          <p className="ah-lede">Dora and Enzo deal cards by lantern light against the rivals of the wood. Play poker hands for chips × mult, gather chinchilla charms that bend the rules, and beat eight antes of rising targets.</p>
          <div className="ah-row ah-center">
            {kept && <button className="ah-gold" data-testid="continue" onClick={() => begin(kept)}>Continue · ante {Math.min(kept.ante, 99)}{kept.endless ? ' (endless)' : ''}</button>}
            <button className={kept ? '' : 'ah-gold'} data-testid="new-run" onClick={newRun}>{kept ? 'New run' : 'Deal me in'}</button>
            <button data-testid="how" onClick={() => setHelp(!help)} aria-expanded={help}>How to play</button>
          </div>
          {help && <ul className="ah-help" data-testid="help">
            <li><b>A round:</b> you hold eight cards. Pick up to five and play them, or throw some away to draw new ones. You have four plays and three discards to reach the target.</li>
            <li><b>Scoring:</b> the best poker hand among the cards you play sets a base of chips and mult. Each card that counts adds its chips (aces 11, faces 10), then your charms join in, left to right. Chips × mult is the score.</li>
            <li><b>A run:</b> each ante has a small round, a big round and a boss whose rule changes how you play. Beat the eighth boss to win; then keep going in endless.</li>
            <li><b>Between rounds:</b> spend nuts on charms (five slots), almanac pages that level up a hand type, treats that change your cards, one voucher an ante that lasts the whole run, and booster packs to pick from. Every five nuts you keep earns one more, up to five.</li>
            <li><b>Keys:</b> 1 to 8 pick cards, Enter plays, D discards, S sorts by rank or suit, Esc clears, M sound. In a pack, 1 to 5 take and S skips. On a phone, tap. Hold a charm or item to read it.</li>
          </ul>}
          <dl className="ah-record" data-testid="record">
            <div><dt>Runs</dt><dd>{profile.runs}</dd></div><div><dt>Wins</dt><dd>{profile.wins}</dd></div>
            <div><dt>Best ante</dt><dd>{profile.bestAnte || '–'}</dd></div><div><dt>Best hand</dt><dd>{profile.bestHand ? fmt(profile.bestHand) : '–'}</dd></div>
            <div><dt>Charms met</dt><dd>{profile.seen.length}/{CHARMS.length}</dd></div>
          </dl>
        </section>
        {noteView}
      </main>
    );
  }

  const r = run, round = r.round, boss = r.bossFor(r.ante);
  const charmTip = (id: string, owned?: { state: number }, price?: number) => () => {
    const d = charmById(id)!;
    return { title: d.name, sub: `${RARITY[d.rarity]} charm`, body: d.text, foot: [owned && d.shows ? `Now: ${d.shows(owned.state)}.` : '', price ? `Costs ${price} nuts.` : owned ? `Sells for ${r.sellPrice(id)} nuts.` : ''].filter(Boolean).join(' ') || undefined };
  };
  const voucherTip = (id: string, price?: number) => () => { const v = voucherById(id)!; return { title: v.name, sub: 'Voucher', body: v.text, foot: price ? `Costs ${price} nuts and lasts the rest of the run.` : 'Yours for the rest of the run.' }; };
  const itemTip = (it: Item, price?: number) => () => ({ title: itemName(it), sub: it.kind === 'almanac' ? `Almanac page · ${handById(it.id as never).name} is level ${r.levels[it.id as keyof typeof r.levels]}` : 'Treat', body: itemText(it), foot: price ? `Costs ${price} nuts.` : undefined });
  const packTip = (t: PackType) => () => ({ title: t.name, sub: packLine(t, r.packBonus), body: PACK_TEXT[t.kind], foot: `Costs ${t.cost} nuts.` });
  /** What one option in an open pack looks like. */
  const packOption = (kind: PackKind, o: string | Card) => {
    if (kind === 'charm') { const d = charmById(o as string)!; return <><div {...tip(charmTip(d.id))}><CharmArt id={d.id} /></div><h3>{d.name}</h3><p className="ah-small">{RARITY[d.rarity]}</p><p>{d.text}</p></>; }
    if (kind === 'card') { const c = o as Card; return <><CardArt card={c} /><h3>{cardName(c)}</h3>{c.gloss && <p>{GLOSS_TEXT[c.gloss as keyof typeof GLOSS_TEXT]}</p>}</>; }
    const it: Item = { kind: kind === 'almanac' ? 'almanac' : 'treat', id: o as string };
    return <><div className="ah-item-big" aria-hidden="true" {...tip(itemTip(it))}>{itemIcon(it)}</div><h3>{itemName(it)}</h3><p>{itemText(it)}</p></>;
  };

  const charmsRow = (shop: boolean) => (
    <section className="ah-charms" aria-label="Your charms" data-testid="charms">
      {Array.from({ length: r.charmSlots }, (_, i) => {
        const o = r.charms[i];
        if (!o) return <div key={`e${i}`} className="ah-charm ah-empty" aria-hidden="true" />;
        const d = charmById(o.id)!;
        return <div key={o.id} className="ah-charm" data-rarity={d.rarity} data-testid={`charm-${i}`}>
          <button className="ah-charm-face" aria-label={`${d.name}: ${d.text}`} {...tip(charmTip(o.id, o))}><CharmArt id={o.id} /><span className="ah-charm-name">{d.name}</span>{d.shows && <span className="ah-charm-state">{d.shows(o.state)}</span>}</button>
          {shop && <div className="ah-charm-tools">
            <button aria-label={`Move ${d.name} left`} disabled={i === 0} onClick={() => act(r.shift(i, -1), 'click')}>◀</button>
            <button data-testid={`sell-${i}`} onClick={() => act(r.sell(i), 'sell')}>Sell {r.sellPrice(o.id)}</button>
            <button aria-label={`Move ${d.name} right`} disabled={i === r.charms.length - 1} onClick={() => act(r.shift(i, 1), 'click')}>▶</button>
          </div>}
        </div>;
      })}
    </section>
  );
  const itemsRow = (
    <section className="ah-items" aria-label="Your items" data-testid="items">
      {Array.from({ length: r.itemSlots }, (_, i) => {
        const it = r.items[i];
        if (!it) return <div key={`e${i}`} className="ah-item ah-empty"><small>Empty item slot</small></div>;
        const why = r.itemWhyNot(i, selected);
        return <div key={`${it.id}-${i}`} className="ah-item" data-kind={it.kind} data-testid={`item-${i}`} {...tip(itemTip(it))}>
          <span className="ah-item-icon" aria-hidden="true">{itemIcon(it)}</span>
          <span className="ah-item-name">{itemName(it)}</span>
          <button data-testid={`use-${i}`} disabled={!!anim} aria-disabled={!!why} onClick={() => applyItem(i)} title={why ?? itemText(it)}>Use</button>
        </div>;
      })}
    </section>
  );

  // What the chips × mult box says: the counting score, else the selection's hand, else nothing yet.
  const preview = !anim && round && selected.length ? r.preview(selected) : null;
  const why = !anim && round && selected.length ? r.whyNot(selected) : null;
  const shownStep = anim ? anim.score.steps[anim.step] : null;
  const counter = (
    <section className="ah-counter" data-testid="counter" aria-live="polite">
      <p className="ah-hand-name" data-testid="hand-name">{anim ? `${handById(anim.score.hand).name} · lvl ${anim.score.level}` : preview ? `${handById(preview.hand).name} · lvl ${preview.level}` : why ?? 'Pick up to five cards'}</p>
      <div className="ah-cm">
        <output className="ah-chips" data-testid="chips">{anim ? fmt(shownStep!.chips) : preview ? fmt(preview.steps[0].chips) : '0'}</output>
        <span aria-hidden="true">×</span>
        <output className="ah-mult" data-testid="mult">{anim ? fmtMult(shownStep!.mult) : preview ? fmtMult(preview.steps[0].mult) : '0'}</output>
      </div>
      {anim?.total && <p className="ah-total" data-testid="hand-total">{fmt(anim.score.total)}</p>}
    </section>
  );

  const roundInfo = round && (
    <section className="ah-roundinfo" aria-label="This round">
      <p className="ah-eyebrow">Ante {r.ante}{r.endless ? ' · endless' : ` of ${ANTES}`} · {BLIND[r.blind].name}</p>
      <div className="ah-target"><span>Target</span><strong data-testid="target">{fmt(round.target)}</strong></div>
      <div className="ah-score"><span>Score</span><strong data-testid="score">{fmt(round.score)}</strong></div>
      <progress max={round.target} value={Math.min(round.score, round.target)} aria-label="Score towards the target" />
      <div className="ah-left"><span data-testid="plays">Plays <b>{round.plays}</b></span><span data-testid="discards">Discards <b>{round.discards}</b></span><span>Deck <b>{round.draw.length}</b></span></div>
      {r.blind === 2 && <div className="ah-boss-mini" data-testid="boss-rule" {...tip(() => ({ title: boss.name, body: boss.text }))}><RivalArt rival={boss.rival} /><span><b>{boss.name}</b>{boss.text}</span></div>}
    </section>
  );

  let body: React.ReactNode = null;
  if (r.phase === 'pick') {
    body = <section className="ah-pick" data-testid="pick">
      {BLIND.map((b, i) => {
        const isBoss = i === 2, here = i === r.blind, past = i < r.blind;
        return <article key={b.name} className="ah-blind" data-state={here ? 'now' : past ? 'past' : 'later'} data-testid={`blind-${i}`}>
          <p className="ah-eyebrow">Ante {r.ante} · {b.name}</p>
          {isBoss ? <><RivalArt rival={boss.rival} /><h3>{boss.name}</h3><p className="ah-rule">{boss.text}</p></> : <div className="ah-blind-pip" aria-hidden="true">{i === 0 ? '🌰' : '🌰🌰'}</div>}
          <p>Target <b>{fmt(r.targetOf(i))}</b></p>
          <p className="ah-small">Win: {b.reward} nuts, +1 for each play left</p>
          {here && <div className="ah-row ah-center">
            <button className="ah-gold" data-testid="start" onClick={() => { r.start(); resort(r); act(true, isBoss ? 'boss' : 'deal'); }}>Play</button>
            {!isBoss && <button data-testid="skip" onClick={() => { const got = r.skip(); act(!!got, 'use'); setNote(got === 'nuts' ? `Skipped: your item slots are full, so ${4} nuts instead.` : got ? `Skipped for ${itemName(got)}.` : ''); }}>Skip for an item</button>}
          </div>}
          {past && <p className="ah-small">Done</p>}
        </article>;
      })}
    </section>;
  } else if (r.phase === 'round' && round) {
    const shown = anim && handBefore.current ? handBefore.current : round.hand;
    body = <section className="ah-table" data-testid="table">
      <div className="ah-played" aria-label="Played cards" data-testid="played">
        {anim && anim.cards.map((c, i) => {
          const lit = shownStep?.card === i, scoring = anim.score.scoring.includes(i);
          return <div key={c.id} className="ah-card ah-in-play" data-scoring={scoring} data-lit={lit}>
            <CardArt card={c} asleep={r.boss?.rule === `suit${c.suit}`} />
            {lit && <span className="ah-pop" data-testid="pop">{shownStep!.text}</span>}
          </div>;
        })}
        {anim && shownStep && shownStep.who !== 'card' && shownStep.who !== 'hand' && <span className="ah-pop ah-pop-wide">{shownStep.who === 'boss' ? shownStep.text : `${charmById(shownStep.ref)?.name ?? ''} ${shownStep.text}`}</span>}
        {!anim && note && <p className="ah-note" data-testid="note">{note}</p>}
      </div>
      <div className="ah-hand" data-testid="hand" style={{ '--n': shown.length } as React.CSSProperties}>
        {shown.map((id, i) => {
          const c = r.card(id), sel = selected.includes(id), down = r.hidden(id);
          return <button key={id} className="ah-card" data-selected={sel} data-testid={`card-${i}`} aria-pressed={sel} aria-label={down ? 'A face-down card' : cardName(c)}
            onClick={() => toggle(id)} disabled={!!anim} {...(c.gloss && !down ? tip(() => ({ title: cardName(c), body: GLOSS_TEXT[c.gloss as keyof typeof GLOSS_TEXT] })) : {})}>
            <CardArt card={c} down={down} asleep={r.boss?.rule === `suit${c.suit}`} /><kbd aria-hidden="true">{i + 1}</kbd>
          </button>;
        })}
      </div>
      <div className="ah-actions">
        <button className="ah-gold" data-testid="play" disabled={!!anim || !selected.length} onClick={playHand}>Play hand</button>
        <button data-testid="discard" disabled={!!anim || !selected.length || round.discards <= 0} onClick={discard}>Discard ({round.discards})</button>
        <button data-testid="sort" disabled={!!anim} onClick={sortHand}>Sort: {sortBy}</button>
      </div>
    </section>;
  } else if (r.phase === 'cashout' && r.cash) {
    const k = r.cash;
    body = <section className="ah-card-panel" data-testid="cashout">
      <p className="ah-eyebrow">Ante {r.ante} · {BLIND[r.blind].name}</p>
      <h2>Round won</h2>
      {round && <p>You scored <b>{fmt(round.score)}</b> against {fmt(round.target)}.</p>}
      <ul className="ah-cash">
        <li><span>{BLIND[r.blind].name}</span><b>+{k.blind}</b></li>
        {k.plays > 0 && <li><span>Plays left ({k.plays})</span><b>+{k.plays}</b></li>}
        {k.interest > 0 && <li><span>Interest (1 per {INTEREST_EVERY} held, at most {r.interestCap})</span><b>+{k.interest}</b></li>}
        {k.charms > 0 && <li><span>Charms</span><b>+{k.charms}</b></li>}
        {k.gold > 0 && <li><span>Gold cards in hand</span><b>+{k.gold}</b></li>}
      </ul>
      <button className="ah-gold" data-testid="collect" onClick={() => { const last = r.blind === 2 && r.ante === ANTES && !r.endless; act(r.collect(), last ? 'victory' : 'coin'); }}>Collect {k.total} nuts</button>
    </section>;
  } else if (r.phase === 'shop' && r.shop) {
    const s = r.shop;
    body = <section className="ah-shop" data-testid="shop">
      <div className="ah-shop-head"><h2>The hollow-log shop</h2><p>Next: ante {r.ante}, {BLIND[r.blind].name.toLowerCase()}{r.blind === 2 ? ` against ${boss.name}` : ''}.</p>
        {r.vouchers.length > 0 && <p className="ah-vouchers" data-testid="vouchers">Vouchers: {r.vouchers.map((v, i) => <span key={v} {...tip(voucherTip(v))}>{i ? ', ' : ''}{voucherById(v)!.name}</span>)}</p>}
      </div>
      <div className="ah-offers">
        {s.charms.map((id, i) => id ? <article key={`c${i}`} className="ah-offer" data-testid={`offer-charm-${i}`} data-rarity={charmById(id)!.rarity}>
          <div {...tip(charmTip(id, undefined, r.priceOf(id)))}><CharmArt id={id} /></div>
          <h3>{charmById(id)!.name}</h3><p className="ah-small">{RARITY[charmById(id)!.rarity]}</p><p>{charmById(id)!.text}</p>
          <button className="ah-gold" data-testid={`buy-charm-${i}`} disabled={r.nuts < r.priceOf(id) || r.charms.length >= r.charmSlots} onClick={() => act(r.buyCharm(i), 'buy')}>Buy · {r.priceOf(id)}</button>
        </article> : <article key={`c${i}`} className="ah-offer ah-sold"><p>Sold</p></article>)}
        {s.items.map((it, i) => it ? <article key={`i${i}`} className="ah-offer ah-offer-item" data-testid={`offer-item-${i}`} data-kind={it.kind}>
          <div className="ah-item-big" aria-hidden="true" {...tip(itemTip(it, ITEM_COST))}>{itemIcon(it)}</div>
          <h3>{itemName(it)}</h3><p className="ah-small">{it.kind === 'almanac' ? 'Almanac page' : 'Treat'}</p><p>{itemText(it)}</p>
          <button className="ah-gold" data-testid={`buy-item-${i}`} disabled={r.nuts < ITEM_COST || r.items.length >= r.itemSlots} onClick={() => act(r.buyItem(i), 'buy')}>Buy · {ITEM_COST}</button>
        </article> : <article key={`i${i}`} className="ah-offer ah-sold"><p>Sold</p></article>)}
      </div>
      <div className="ah-offers ah-offers-extra">
        <article className="ah-offer ah-offer-voucher" data-testid="offer-voucher">
          {r.offer ? <>
            <div {...tip(voucherTip(r.offer, VOUCHER_COST))}><VoucherArt id={r.offer} /></div>
            <h3>{voucherById(r.offer)!.name}</h3><p className="ah-small">Voucher · this ante</p><p>{voucherById(r.offer)!.text}</p>
            <button className="ah-gold" data-testid="buy-voucher" disabled={r.nuts < VOUCHER_COST} onClick={() => act(r.buyVoucher(), 'buy')}>Buy · {VOUCHER_COST}</button>
          </> : <p>{r.vouchers.length >= VOUCHERS.length ? 'Every voucher is yours.' : 'Voucher bought. A new one comes after the boss.'}</p>}
        </article>
        {s.packs.map((id, i) => {
          const t = id ? packById(id) : undefined;
          return t ? <article key={`p${i}`} className="ah-offer ah-offer-pack" data-testid={`offer-pack-${i}`} data-kind={t.kind}>
            <div {...tip(packTip(t))}><PackArt id={t.id} /></div>
            <h3>{t.name}</h3><p className="ah-small">{packLine(t, r.packBonus)}</p><p>{PACK_TEXT[t.kind]}</p>
            <button className="ah-gold" data-testid={`open-pack-${i}`} disabled={r.nuts < t.cost} onClick={() => { setSelected([]); act(r.openPack(i), 'deal'); }}>Open · {t.cost}</button>
          </article> : <article key={`p${i}`} className="ah-offer ah-sold"><p>Opened</p></article>;
        })}
      </div>
      <div className="ah-row ah-center">
        <button data-testid="reroll" disabled={r.nuts < r.rerollCost} onClick={() => act(r.reroll(), 'reroll')}>New charms · {r.rerollCost}</button>
        <button className="ah-gold" data-testid="leave" onClick={() => act(r.leave(), 'click')}>Next round</button>
      </div>
      <details className="ah-levels"><summary>Hand levels</summary><ul>{HANDS.filter((h) => r.levels[h.id] > 1 || r.played[h.id] > 0 || !['five', 'ffive'].includes(h.id)).map((h) => <li key={h.id}><span>{h.name}</span><span>lvl {r.levels[h.id]}</span><span>{h.chips + h.upChips * (r.levels[h.id] - 1)} × {h.mult + h.upMult * (r.levels[h.id] - 1)}</span><span>played {r.played[h.id]}</span></li>)}</ul></details>
    </section>;
  } else if (r.phase === 'pack' && r.pack) {
    const p = r.pack, t = packById(p.id)!;
    body = <section className="ah-shop ah-pack" data-testid="pack" data-kind={t.kind}>
      <div className="ah-shop-head"><h2>{t.name}</h2><p>{p.picks} pick{p.picks === 1 ? '' : 's'} left. {t.kind === 'treat' ? 'Select dealt cards, then use a treat on them.' : 'Take what you want, or skip the rest.'}</p></div>
      <div className="ah-offers">
        {p.options.map((o, i) => {
          if (o === null) return <article key={i} className="ah-offer ah-sold"><p>Taken</p></article>;
          const why = r.packWhyNot(i, selected);
          return <article key={i} className="ah-offer" data-testid={`pack-option-${i}`} data-rarity={t.kind === 'charm' ? charmById(o as string)!.rarity : undefined}>
            {packOption(t.kind, o)}
            <button className="ah-gold" data-testid={`take-${i}`} aria-disabled={!!why} title={why ?? undefined} onClick={() => takeOption(i)}>{t.kind === 'treat' ? 'Use' : 'Take'} <kbd aria-hidden="true">{i + 1}</kbd></button>
          </article>;
        })}
      </div>
      {t.kind === 'treat' && <div className="ah-hand ah-dealt" data-testid="dealt" style={{ '--n': p.dealt.length } as React.CSSProperties}>
        {p.dealt.map((id, i) => {
          const c = r.card(id), sel = selected.includes(id);
          return <button key={id} className="ah-card" data-selected={sel} data-testid={`dealt-${i}`} aria-pressed={sel} aria-label={cardName(c)} onClick={() => toggle(id)}><CardArt card={c} /></button>;
        })}
      </div>}
      <div className="ah-row ah-center"><button data-testid="skip-pack" onClick={skipPack}>Skip the rest</button></div>
    </section>;
  } else if (r.phase === 'victory') {
    body = <section className="ah-card-panel" data-testid="victory">
      <p className="ah-eyebrow">Ante {ANTES} beaten</p><h2>The wood is yours</h2>
      <p>All eight rivals are beaten. Your best hand scored <b>{fmt(r.best)}</b>. Keep going into endless antes, where the targets climb faster, or rest here.</p>
      <div className="ah-row ah-center"><button className="ah-gold" data-testid="endless" onClick={() => act(r.goEndless(), 'deal')}>Keep going</button><button data-testid="end-run" onClick={() => { writeJson(RUN_KEY, null); setKept(null); setView('title'); }}>End the run</button></div>
    </section>;
  } else if (r.phase === 'over') {
    body = <section className="ah-card-panel" data-testid="over">
      <p className="ah-eyebrow">Ante {r.ante} · {BLIND[r.blind].name}</p><h2>Out of plays</h2>
      {round && <p>You scored <b>{fmt(round.score)}</b> of {fmt(round.target)}. Your best hand this run was {fmt(r.best)}, and you won {r.rounds} round{r.rounds === 1 ? '' : 's'}.</p>}
      <p className="ah-small">Charms with ×mult score most at the right-hand end. An almanac page for the hand you play most makes every round easier.</p>
      <div className="ah-row ah-center"><button className="ah-gold" data-testid="again" onClick={newRun}>New run</button><button onClick={() => { setKept(null); setView('title'); }}>Title</button></div>
    </section>;
  }

  return (
    <main className="ah-shell" data-ready={ready} data-phase={r.phase}>
      {header}
      <div className="ah-board">
        <aside className="ah-side">
          {roundInfo ?? <section className="ah-roundinfo">
            <p className="ah-eyebrow">{r.phase === 'victory' ? `All ${ANTES} antes beaten` : `Ante ${r.ante}${r.endless ? ' · endless' : ` of ${ANTES}`}`}</p>
            {r.phase !== 'victory' && <p className="ah-small">Rival this ante: <b>{boss.name}</b>. {boss.text}</p>}
          </section>}
          {r.phase === 'round' && counter}
        </aside>
        <div className="ah-main">
          {charmsRow(r.phase === 'shop' || r.phase === 'pick' || r.phase === 'pack')}
          {body}
          {itemsRow}
          {note && r.phase !== 'round' && <p className="ah-note" data-testid="note">{note}</p>}
        </div>
      </div>
      {noteView}
    </main>
  );
}
