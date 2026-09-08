'use client';
import { useEffect, useRef, useState } from 'react';
import {
  RemakeGame,
  REASONS,
  PROVISIONS,
  type Provision,
} from '../../lib/checkpoint-remake-game';
import type { Flag } from '../../lib/checkpoint-game';
import type { RemakeScene } from '../../lib/checkpoint-remake-scene';
import Link from 'next/link';
import './remake.css';
export default function CheckpointRemake() {
  'use no memo'; // The deterministic controller mutates in event handlers, with explicit refreshes.
  const [g, setGame] = useState(() => new RemakeGame());
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<RemakeScene | null>(null);
  const [, refresh] = useState(0),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false),
    [moving, setMoving] = useState(false),
    [arrived, setArrived] = useState(true),
    [timed, setTimed] = useState(false);
  const p = g.traveler.papers,
    v = g.verdict;
  const update = () => refresh((n) => n + 1);
  useEffect(() => {
    let dead = false,
      raf = 0,
      last = 0;
    import('../../lib/checkpoint-remake-scene')
      .then(({ RemakeScene }) => {
        if (dead || !canvas.current) return;
        try {
          const s = new RemakeScene(canvas.current);
          scene.current = s;
          s.arrive(g.traveler.papers.species);
          setLoaded(true);
          const loop = (now: number) => {
            const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
            last = now;
            s.render(now / 1000, dt);
            setArrived(s.arrival >= 1);
            if (s.complete) setMoving(false);
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        } catch {
          setError(
            '3D view unavailable. You can still inspect every document below.',
          );
          setMoving(false);
        }
      })
      .catch(() =>
        setError('3D view unavailable. Document inspection is still playable.'),
      );
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [g]);
  useEffect(() => {
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden) {
        g.tick((now - last) / 1000);
        update();
      }
      last = now;
    }, 250);
    return () => clearInterval(timer);
  }, [g]);
  function decide(approve: boolean) {
    if (scene.current && scene.current.arrival < 1) return;
    const verdict = g.decide(approve);
    if (!verdict) return;
    scene.current?.judge(approve);
    setMoving(!!scene.current);
    update();
  }
  function next() {
    if (moving) return;
    g.next();
    if (g.state === 'shift') scene.current?.arrive(g.traveler.papers.species);
    update();
  }
  const row = (label: string, value: string | number, flag?: Flag) => (
    <button
      className={`rm-field ${flag && g.selected.includes(flag) ? 'selected' : ''}`}
      disabled={!flag || g.state !== 'shift' || !!v}
      onClick={() => {
        if (flag) g.toggle(flag);
        update();
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {flag && g.selected.includes(flag) && <i>FLAGGED</i>}
    </button>
  );
  return (
    <main className="rm-shell">
      <header className="rm-header">
        <Link href="/">← MAIN ARCADE</Link>
        <Link className="rm-wordmark" href="/checkpoint-remake">
          DUST <i>&</i> DOCUMENTS
        </Link>
        <Link href="/checkpoint">ORIGINAL EDITION ↗</Link>
      </header>
      <section className="rm-mast">
        <div>
          <span className="rm-eyebrow">THE NORTH PASS · A BORDER STORY</span>
          <h1>
            Small paws.
            <br />
            <em>Weighty decisions.</em>
          </h1>
        </div>
        <p>
          A name. A stamp. A chance to start again.
          <br />
          Keep the crossing honest and get Dora
          <br />
          and Enzo through seven cold nights.
        </p>
        <div className="rm-day">
          <b>0{g.day.day}</b>
          <span>SHIFT / 07</span>
        </div>
      </section>
      <div className="rm-status">
        <span>
          <i /> BOOTH 09 · {g.state === 'shift' ? 'ON DUTY' : 'STANDING BY'}
        </span>
        <span>
          {g.processed} / {g.day.quota} TRAVELERS
        </span>
        <span>
          {g.credits} cr <small>HOUSEHOLD FUND</small>
        </span>
        <span>
          {g.timed && g.state === 'shift'
            ? `${Math.ceil(g.remaining)}s REMAINING`
            : 'UNTIMED · TAKE YOUR TIME'}
        </span>
      </div>
      <section className="rm-world">
        <canvas
          ref={canvas}
          aria-label="Open-front border booth. White Dora and gray Enzo stand side by side facing a traveler. Weighing station is left. A separate gated exit lane runs right."
        />
        <div className="rm-world-tag">
          LIVE FROM THE PASS <span>09</span>
        </div>
        <div className="rm-cast">
          DORA <span>Inspection</span>
          <b>+</b> ENZO <span>Records</span>
        </div>
        {!loaded && (
          <div className="rm-fallback">
            {error || 'Opening the mountain pass…'}
          </div>
        )}
        <div className="rm-world-caption">
          ANDES CROSSING <span>06:40 · FIRST LIGHT</span>
        </div>
      </section>
      {g.state === 'briefing' && (
        <section className="rm-brief rm-panel">
          <div>
            <span className="rm-eyebrow">MORNING DISPATCH / {g.day.date}</span>
            <h2>The line is waiting.</h2>
            <p className="rm-quote">“{g.day.dialogue.replace('ENZO: ', '')}”</p>
            <p>
              Compare the traveler card with the permit and today’s rules. Click
              suspicious fields or select a denial reason. One valid discrepancy
              is enough, but every reason you submit must be supported.
            </p>
            <label className="rm-toggle">
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
              />{' '}
              Timed shift · {150 + g.bonus} seconds{' '}
              <small>Clock pauses when this tab is hidden.</small>
            </label>
            <button
              className="rm-primary"
              onClick={() => {
                g.begin(timed);
                scene.current?.arrive(g.traveler.papers.species);
                update();
              }}
            >
              OPEN THE BOOTH <span>→</span>
            </button>
          </div>
          <aside className="rm-rules">
            <span className="rm-eyebrow">MINISTRY BULLETIN</span>
            <h3>Today’s requirements</h3>
            <ol>
              {g.day.rules.map((r) => (
                <li key={r.id}>{r.text}</li>
              ))}
            </ol>
            <p>
              Correct decision +6 cr · Citation −3 cr
              <br />
              Rent is deducted at shift end. Supper costs 3 or 7 cr.
            </p>
          </aside>
        </section>
      )}
      {g.state === 'shift' && (
        <>
          <section className="rm-inspect">
            <div className="rm-inspect-title">
              <span className="rm-eyebrow">
                CASE {String(g.processed + (v ? 0 : 1)).padStart(2, '0')} /
                DOCUMENT INSPECTION
              </span>
              <h2>
                {p.name}
                <small>
                  {p.species} · {p.purpose}
                </small>
              </h2>
              <p>“{g.traveler.line}”</p>
            </div>
            <div className="rm-documents">
              <article className="rm-paper rm-card">
                <div className="rm-doc-heading">
                  <span>01 / IDENTITY</span>
                  <b>TRAVELER CARD</b>
                </div>
                {row('Full name', p.name, 'name')}
                {row('Home region', p.region, 'region')}
                {row('Species', p.species, 'species')}
                {row('Purpose of entry', p.purpose, 'purpose')}
                <div className="rm-scale">
                  <span>VERIFIED SCALE READING</span>
                  <b>
                    {p.weight}
                    <small> g</small>
                  </b>
                </div>
              </article>
              <article className="rm-paper rm-permit">
                <div className="rm-doc-heading">
                  <span>02 / AUTHORIZATION</span>
                  <b>ENTRY PERMIT</b>
                </div>
                {p.hasPermit ? (
                  <>
                    {row('Issued to', p.permitName, 'name')}
                    {row('Issuing region', p.permitRegion, 'region')}
                    {row('Valid through', `DAY ${p.expires}`, 'expired')}
                    {row('Declared weight', `${p.statedWeight} g`, 'weight')}
                    <button
                      className={`rm-seal ${g.selected.includes('seal') ? 'selected' : ''}`}
                      disabled={!!v}
                      onClick={() => {
                        g.toggle('seal');
                        update();
                      }}
                    >
                      {p.sealed ? '✺ REPUBLIC SEAL' : '○ SEAL ABSENT'}
                    </button>
                    <small className="rm-serial">
                      {p.permitId} · NORTH REPUBLIC
                    </small>
                  </>
                ) : (
                  <div className="rm-absent">
                    No permit presented.
                    <button
                      onClick={() => {
                        g.toggle('permit');
                        update();
                      }}
                      disabled={!!v}
                    >
                      Flag missing permit
                    </button>
                  </div>
                )}
              </article>
            </div>
          </section>
          <section className="rm-workspace">
            <aside className="rm-rules">
              <span className="rm-eyebrow">KEEP OPEN WHILE INSPECTING</span>
              <h3>
                Rulebook <small>DAY {g.day.date}</small>
              </h3>
              <ol>
                {g.day.rules.map((r) => (
                  <li key={r.id}>{r.text}</li>
                ))}
              </ol>
            </aside>
            <div className="rm-evidence">
              <span className="rm-eyebrow">03 / RECORD YOUR FINDINGS</span>
              <h3>Is there a discrepancy?</h3>
              <p>
                Choose supported reasons to deny entry. Clear papers need no
                flags.
              </p>
              <div className="rm-chips">
                {(Object.keys(REASONS) as Flag[]).map((f) => (
                  <button
                    key={f}
                    disabled={!!v}
                    aria-pressed={g.selected.includes(f)}
                    onClick={() => {
                      g.toggle(f);
                      update();
                    }}
                  >
                    {g.selected.includes(f) ? '✓' : '+'} {REASONS[f]}
                  </button>
                ))}
              </div>
              {v ? (
                <output className={`rm-verdict ${v.correct ? 'good' : 'bad'}`}>
                  <b>
                    {v.approved ? 'ENTRY APPROVED' : 'ENTRY DENIED'} ·{' '}
                    {v.correct ? '+6 cr' : '−3 cr'}
                  </b>
                  <p>{v.text}</p>
                  <button
                    className="rm-primary"
                    disabled={moving}
                    onClick={next}
                  >
                    {moving
                      ? 'TRAVELER LEAVING…'
                      : g.processed >= g.day.quota || g.remaining <= 0
                        ? 'CLOSE THE SHIFT →'
                        : 'CALL NEXT TRAVELER →'}
                  </button>
                </output>
              ) : (
                <div className="rm-decisions">
                  <button
                    className="rm-approve"
                    disabled={!arrived}
                    onClick={() => decide(true)}
                  >
                    ✓ APPROVE ENTRY
                  </button>
                  <button
                    className="rm-deny"
                    disabled={!g.selected.length || !arrived}
                    onClick={() => decide(false)}
                  >
                    ✕ DENY · {g.selected.length} REASON
                    {g.selected.length === 1 ? '' : 'S'}
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      {g.state === 'report' && (
        <section className="rm-panel">
          <span className="rm-eyebrow">EVENING LEDGER</span>
          <h2>
            {g.citations ? 'A long day at the pass.' : 'An honest day’s work.'}
          </h2>
          <div className="rm-ledger">
            <p>
              <b>{g.processed}</b> processed
            </p>
            <p>
              <b>{g.citations}</b> citations
            </p>
            <p>
              <b>−{g.rentPaid} cr</b> rent paid
            </p>
            <p>
              <b>{g.credits} cr</b> available
            </p>
          </div>
          <h3>Set something aside for supper.</h3>
          <div className="rm-meals">
            {(Object.keys(PROVISIONS) as Provision[]).map((key) => (
              <button
                key={key}
                disabled={g.settled || g.credits < PROVISIONS[key].cost}
                onClick={() => {
                  g.settle(key);
                  update();
                }}
              >
                <b>
                  {PROVISIONS[key].label} · {PROVISIONS[key].cost} cr
                </b>
                <span>{PROVISIONS[key].description}</span>
              </button>
            ))}
          </div>
          {g.settled && (
            <p>
              Supper paid: {g.mealPaid} cr. Tomorrow’s time bonus: {g.bonus}s.
            </p>
          )}
          {!g.settled && g.credits < 3 && (
            <p>
              There is not enough left for supper. The booth cannot stay open.
            </p>
          )}
          <button
            className="rm-primary"
            disabled={!g.settled && g.credits >= 3}
            onClick={() => {
              g.nextDay();
              update();
            }}
          >
            {g.day.day === 7 || !g.settled
              ? 'READ THE EPILOGUE'
              : 'NEXT MORNING'}{' '}
            →
          </button>
          <details>
            <summary>Review the decision ledger</summary>
            <ul>
              {g.log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
      {g.state === 'ending' && (
        <section className="rm-panel">
          <span className="rm-eyebrow">THE PASS REMEMBERS</span>
          <h2>{g.ending}</h2>
          <p>
            {g.credits < 0 || !g.settled
              ? 'Dora closes the ledger. Enzo packs the stamps. Tomorrow they will look for a kinder place to work.'
              : 'Seven mornings, seven nights. Dora closes the ledger and Enzo puts the kettle on. There is enough for another beginning.'}
          </p>
          <p>
            {g.total} decisions · {g.accuracy}% accuracy · {g.credits} credits
            saved
          </p>
          <button
            className="rm-primary"
            onClick={() => {
              setGame(new RemakeGame());
              setMoving(false);
              update();
            }}
          >
            WORK ANOTHER WEEK →
          </button>
        </section>
      )}
      <footer className="rm-footer">
        <span>DUST & DOCUMENTS / THE REMAKE</span>
        <p>Two inspectors. One small booth. Everyone has somewhere to go.</p>
        <Link href="/checkpoint">Play the original ↗</Link>
      </footer>
    </main>
  );
}
