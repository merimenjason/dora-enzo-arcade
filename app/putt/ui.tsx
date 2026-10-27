import { useState } from 'react';
import { COURSES, COURSE_IDS, HEROES, ALL_HOLES, MAX_STROKES, PICKUP, coursePar, scoreLabel, lanternOpen, getHole, type CourseId, type HeroId, type Profile, type PuttGame } from '@/lib/putt-game';

export type Players = 'dora' | 'enzo' | 'both';

export function Portrait({ who, mood = 0, size = 44 }: { who: HeroId; mood?: 0 | 1 | 2 | 3; size?: number }) {
  return <span className="putt-portrait" aria-hidden="true" style={{ width: size, height: size, backgroundImage: `url(/art/hunt/portraits-${who}.webp)`, backgroundPosition: `${(mood % 2) * 100}% ${Math.floor(mood / 2) * 100}%` }} />;
}
export function Acorn({ got, size = 18 }: { got: boolean; size?: number }) {
  return <svg className={`putt-acorn${got ? ' is-got' : ''}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <ellipse cx="10" cy="12.5" rx="5.6" ry="6.2" fill={got ? '#f2c440' : '#e7dcc4'} stroke="#5b3b22" strokeWidth="1.3" />
    <path d="M3.6 9.2c0-3.4 2.9-5.4 6.4-5.4s6.4 2 6.4 5.4c0 .9-.6 1.3-1.4 1.3H5c-.8 0-1.4-.4-1.4-1.3z" fill={got ? '#8a5a32' : '#c9b9a0'} stroke="#5b3b22" strokeWidth="1.3" />
    <path d="M10 3.8V1.6" stroke="#5b3b22" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}
const relative = (n: number) => (n === 0 ? 'even' : n > 0 ? `+${n}` : `${n}`);
/** The running score in words: "level par", "2 over", "6 under". */
const versus = (n: number) => (n === 0 ? 'level par' : n > 0 ? `${n} over` : `${-n} under`);
const cell = (n: number | null, par: number) => (n === null ? '' : n >= PICKUP ? `${PICKUP}` : String(n));
const tone = (n: number | null, par: number) => (n === null ? '' : n === 1 ? 'is-ace' : n < par ? 'is-under' : n === par ? 'is-par' : 'is-over');

export function Menu({ profile, players, setPlayers, hasRun, muted, onSound, onCourse, onResume, onPractise }: {
  profile: Profile; players: Players; setPlayers: (p: Players) => void; hasRun: boolean; muted: boolean; onSound: () => void;
  onCourse: (c: CourseId) => void; onResume: () => void; onPractise: (hole: string) => void; courseOf: (id: string) => CourseId;
}) {
  const open = lanternOpen(profile), [tab, setTab] = useState<CourseId>('clover');
  const lit = (c: CourseId) => c === 'clover' || open;
  return <div className="putt-menu">
    <div className="putt-menu-art" aria-hidden="true"><img src="/art/putt/title.webp" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>
    <header className="putt-menu-top">
      <a className="putt-back" href="/">← MAIN ARCADE</a>
      <button className="putt-chip" onClick={onSound} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
    </header>
    <section className="putt-menu-panel" aria-label="Puttering Paws clubhouse">
      <p className="putt-eyebrow">STORYBOOK MINI GOLF</p>
      <h1>Puttering <em>Paws</em></h1>
      <p className="putt-lede">Dora and Enzo putt through two meadow courses: ramps and windmills, burrows and dust baths, mushrooms that bounce and a Bristleback that sleep-walks. Every hole hides a golden acorn.</p>
      <h2 className="putt-label">Who's putting?</h2>
      <div className="putt-who" role="radiogroup" aria-label="Who's putting">
        {(['dora', 'enzo', 'both'] as Players[]).map((p) => <button key={p} role="radio" aria-checked={players === p} className={players === p ? 'is-on' : ''} onClick={() => setPlayers(p)}>
          {p === 'both' ? <span className="putt-pair"><Portrait who="dora" size={34} /><Portrait who="enzo" size={34} /></span> : <Portrait who={p} size={40} />}
          <span>{p === 'both' ? 'Both, taking turns' : HEROES[p].name}</span>
        </button>)}
      </div>
      {hasRun && <button className="putt-primary putt-resume" onClick={onResume}>Carry on with your round</button>}
      <div className="putt-courses">
        {COURSE_IDS.map((c) => {
          const holes = COURSES[c].holes, found = holes.filter((h) => profile.acorns.includes(h.id)).length, best = profile.courseBest[c];
          return <article key={c} className={`putt-course is-${c}${lit(c) ? '' : ' is-locked'}`}>
            <div><h3>{COURSES[c].name}</h3><p>{lit(c) ? COURSES[c].blurb : 'Finish the Clover Nine to light the lanterns.'}</p></div>
            <dl><div><dt>Par</dt><dd>{coursePar(c)}</dd></div><div><dt>Best</dt><dd>{best ?? '–'}</dd></div><div><dt>Acorns</dt><dd>{found}/{holes.length}</dd></div></dl>
            <button className="putt-primary" disabled={!lit(c) || !holes.length} onClick={() => onCourse(c)}>{lit(c) ? `Play the ${COURSES[c].name}` : 'Locked'}</button>
          </article>;
        })}
      </div>
      <h2 className="putt-label">Practise a hole</h2>
      <div className="putt-tabs" role="tablist">{COURSE_IDS.map((c) => <button key={c} role="tab" aria-selected={tab === c} disabled={!lit(c)} className={tab === c ? 'is-on' : ''} onClick={() => setTab(c)}>{COURSES[c].name}</button>)}</div>
      <ol className="putt-holes">
        {COURSES[tab].holes.map((h, i) => <li key={h.id}><button disabled={!lit(tab)} onClick={() => onPractise(h.id)}>
          <span className="putt-hole-n">{i + 1}</span><span className="putt-hole-name">{h.name}</span>
          <span className="putt-hole-meta">Par {h.par}{profile.holeBest[h.id] ? ` · best ${profile.holeBest[h.id]}` : ''}{profile.aces.includes(h.id) ? ' · ace' : ''}</span>
          <Acorn got={profile.acorns.includes(h.id)} />
        </button></li>)}
      </ol>
      <p className="putt-acorn-row" aria-label={`${profile.acorns.length} of ${ALL_HOLES.length} golden acorns found`}>{ALL_HOLES.map((h) => <Acorn key={h.id} got={profile.acorns.includes(h.id)} size={16} />)}<span>{profile.acorns.length}/{ALL_HOLES.length} golden acorns</span></p>
      <p className="putt-help">Drag back from the ball and let go to putt, like a slingshot. Keys: ← → aim (Shift for fine), ↑ ↓ power, Space putts, V shows the whole hole, M sound, Esc pauses.</p>
    </section>
  </div>;
}

export function Hud({ game, dragging, overview, muted, onOverview, onSound, onPause }: {
  game: PuttGame; dragging: boolean; overview: boolean; muted: boolean; onOverview: () => void; onSound: () => void; onPause: () => void;
}) {
  const h = game.hole, spec = h.spec, who = game.hero, p = game.player, total = game.total(p), vs = total - game.parSoFar(p);
  const number = game.practice ? Number(spec.id.split('-')[1]) : game.holeIndex + 1;
  return <>
    <header className="putt-hud">
      <div className="putt-hud-card">
        <span className="putt-hud-hole">{game.practice ? 'PRACTICE' : `HOLE ${number} OF ${game.holeIds.length}`}</span>
        <strong>{spec.name}</strong>
        <span>Par {spec.par} · {game.mode === 'sunk' || game.mode === 'card' ? game.label : `Putt ${Math.min(MAX_STROKES, game.strokes + (game.mode === 'aim' || game.mode === 'intro' ? 1 : 0))}`}</span>
      </div>
      <div className="putt-hud-who"><Portrait who={who} mood={game.mode === 'sunk' ? 0 : 1} size={46} /><div><strong>{HEROES[who].name}</strong><span>{game.practice ? `${game.strokes} so far` : `${total} · ${versus(vs)}`}</span></div></div>
      <div className="putt-hud-actions">
        <button onClick={onOverview} aria-pressed={overview} title="See the whole hole (V)">{overview ? 'Back to ball' : 'Whole hole'}</button>
        <button onClick={onSound} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
        <button onClick={onPause} title="Pause (Esc)">Pause</button>
      </div>
    </header>
    {game.mode === 'intro' && <div className="putt-intro" aria-live="polite"><span>{game.practice ? 'Practice' : `Hole ${number}`} · Par {spec.par}</span><strong>{spec.name}</strong><p>{spec.tip}</p>{game.players.length > 1 && <em>{HEROES[who].name} putts {game.turn === 0 ? 'first' : 'next'}</em>}</div>}
    {game.mode === 'aim' && <div className="putt-power" aria-label={`Power ${Math.round(game.aim.power * 100)} percent`}>
      <div className="putt-meter"><i style={{ width: `${Math.round(game.aim.power * 100)}%` }} /></div>
      <span>{dragging ? 'Let go to putt' : 'Drag back from the ball, or use the arrow keys and Space'}</span>
    </div>}
    {game.acorns.includes(h.id) && <div className="putt-found"><Acorn got size={20} /> found</div>}
  </>;
}

export function Scorecard({ game, onNext, onMenu, onAgain, onPractise }: { game: PuttGame; onNext: () => void; onMenu: () => void; onAgain: () => void; onPractise: (hole: string) => void }) {
  const holes = game.holeIds.map(getHole), last = game.holeIndex + 1 >= game.holeIds.length;
  if (game.practice) {
    const id = game.holeIds[0], course = COURSES[id.startsWith('lantern') ? 'lantern' : 'clover'].holes, i = course.findIndex((h) => h.id === id), following = course[i + 1];
    return <div className="putt-shade"><section className="putt-panel putt-card" role="dialog" aria-label="Practice result">
      <h2>{holes[0].spec.name}</h2>
      <ul className="putt-practice">{game.players.map((p, k) => { const n = game.scores[k][0]; return <li key={p}><strong>{HEROES[p].name}</strong> {n ?? '–'} <span>(par {holes[0].spec.par})</span>{n !== null && <em className={tone(n, holes[0].spec.par)}>{scoreLabel(n, holes[0].spec.par)}</em>}</li>; })}</ul>
      {game.acorns.includes(id) && <p className="putt-found"><Acorn got size={20} /> Golden acorn found!</p>}
      <div className="putt-row"><button className="putt-primary" onClick={onAgain} autoFocus>Play it again</button>{following && <button onClick={() => onPractise(following.id)}>Next hole: {following.name}</button>}<button onClick={onMenu}>Clubhouse</button></div>
    </section></div>;
  }
  return <div className="putt-shade"><section className="putt-panel putt-card" role="dialog" aria-label="Scorecard">
    <h2>{COURSES[game.course!].name} · after hole {game.holeIndex + 1}</h2>
    <ScoreTable game={game} />
    <div className="putt-row"><button className="putt-primary" onClick={onNext} autoFocus>{last ? 'See how it went' : `On to hole ${game.holeIndex + 2}`}</button><button onClick={onMenu}>Clubhouse</button></div>
  </section></div>;
}

function ScoreTable({ game }: { game: PuttGame }) {
  const holes = game.holeIds.map(getHole);
  return <div className="putt-table-wrap"><table className="putt-table">
    <thead><tr><th scope="col">Hole</th>{holes.map((h, i) => <th key={h.id} scope="col" className={i === game.holeIndex ? 'is-now' : ''}>{i + 1}</th>)}<th scope="col">Total</th></tr></thead>
    <tbody>
      <tr className="is-par-row"><th scope="row">Par</th>{holes.map((h) => <td key={h.id}>{h.spec.par}</td>)}<td>{holes.reduce((s, h) => s + h.spec.par, 0)}</td></tr>
      {game.players.map((p, k) => <tr key={p}><th scope="row">{HEROES[p].name}</th>{holes.map((h, i) => <td key={h.id} className={tone(game.scores[k][i], h.spec.par)}>{cell(game.scores[k][i], h.spec.par)}</td>)}<td><strong>{game.total(k)}</strong> <small>{relative(game.total(k) - game.parSoFar(k))}</small></td></tr>)}
    </tbody>
  </table></div>;
}

export function Finale({ game, profile, onMenu, onAgain, onLantern }: { game: PuttGame; profile: Profile; onMenu: () => void; onAgain: () => void; onLantern: () => void }) {
  if (game.practice) return null;
  const c = game.course!, totals = game.players.map((_, k) => game.total(k)), par = coursePar(c), best = profile.courseBest[c];
  const duo = game.players.length > 1, gap = duo ? Math.abs(totals[0] - totals[1]) : 0, leader = duo ? (totals[0] < totals[1] ? 0 : 1) : 0;
  const headline = duo ? (gap === 0 ? 'A tie! Best of friends.' : `${HEROES[game.players[leader]].name} wins by ${gap}!`) : `${totals[0]} strokes · ${versus(totals[0] - par)}`;
  const firstLantern = c === 'clover' && profile.finished.includes('clover') && profile.rounds === 1;
  const acorns = COURSES[c].holes.filter((h) => game.acorns.includes(h.id)).length;
  return <div className="putt-shade"><section className={`putt-panel putt-finale is-${c}`} role="dialog" aria-label="Round complete">
    <img className="putt-finale-art" src={c === 'lantern' ? '/art/putt/lantern.webp' : '/art/putt/trophy.webp'} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    <p className="putt-eyebrow">{COURSES[c].name} complete</p>
    <h2>{headline}</h2>
    <ScoreTable game={game} />
    <p>{best !== undefined && totals.some((t) => t === best) ? `That's your best ${COURSES[c].name} yet: ${best}. ` : best !== undefined ? `Your best here is ${best}. ` : ''}{acorns ? `${acorns} golden ${acorns === 1 ? 'acorn' : 'acorns'} found this round.` : 'The golden acorns are still hiding. Try a trick shot!'}</p>
    {c === 'clover' && <p className="putt-unlock">{firstLantern ? 'The Lantern Nine is lit! The same meadow at dusk, with trickier holes.' : 'The Lantern Nine is open whenever you are.'}</p>}
    <div className="putt-row">{c === 'clover' && COURSES.lantern.holes.length > 0 && <button className="putt-primary" onClick={onLantern} autoFocus>Play the Lantern Nine</button>}<button className={c === 'clover' ? '' : 'putt-primary'} onClick={onAgain}>Play the {COURSES[c].name} again</button><button onClick={onMenu}>Clubhouse</button></div>
  </section></div>;
}
