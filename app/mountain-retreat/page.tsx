'use client';
/* Imperative deterministic engine, explicitly repainted after each tick/action. */
/* oxlint-disable react-compiler */
import { useEffect, useRef, useState } from 'react';
import {
  activitySeconds,
  advanceRetreat,
  awaySummary,
  canGrant,
  choosePerk,
  COATS as COAT_NAMES,
  DAY_SECONDS,
  DECOR_CAP,
  FESTIVAL,
  festivalReward,
  freshRetreat,
  FRIENDSHIP_CAP,
  GUESTS,
  guestPool,
  HOST_STOP_SECONDS,
  hostStop,
  isNight,
  ITEM_TIPS,
  ITEMS,
  nextVisitAt,
  NIGHT_FROM,
  PANTRY_CAP,
  parseRetreat,
  PERKS,
  POSTCARDS,
  rating,
  RECIPE_COST,
  RECIPE_SECONDS,
  REGULARS,
  restoreRetreat,
  ROOMS,
  roomCost,
  SAVE_KEY,
  season,
  SEASON_SECONDS,
  SEASONS,
  startActivity,
  SUPPLY_CAP,
  SUPPLY_SECONDS,
  supplyParts,
  supplyRate,
  total,
  trailClosed,
  TRAILS,
  upcomingGuest,
  upgradeRoom,
  VISCACHA,
  visitPeriod,
  visitRewards,
  WISH_HEARTS,
  WISH_TIPS,
  type GuestVisit,
  type Part,
  type RetreatState,
  type Trail,
} from '@/lib/mountain-retreat-game';
import { enableSound, playCue } from './sound';
import './retreat.css';
// Cutaway order: upper floor (suite, bath), then ground floor (hearth, kitchen).
const SLOT = [2, 3, 0, 1];
const place = (room: number) => {
  const slot = SLOT.indexOf(room);
  return { col: slot % 2, row: slot < 2 ? 1 : 0 };
};
const COATS = ['beige', 'velvet', 'violet', 'ebony', 'sapphire'];
const ITEM_ICON = { oatcake: '◍', soap: '❀' } as const;
const SEASON_ICON = { spring: '❀', summer: '☀', autumn: '❦', winter: '❄' } as const;
const TRAIL_ORDER: Trail[] = ['lake', 'juniper', 'summit'];
const ROOM_ICON = ['♨', '▥', '☾', '≈'];
/** Summit finds, in the order they arrive. */
const TROPHIES = ['pennant', 'wind chime', 'lantern', 'garden gnome', 'flower box', 'weathervane'];
const WEATHER = { spring: 'petals', summer: 'butterflies', autumn: 'leaves', winter: 'snow' } as const;
const wishIcon = (guest: number) => {
  const g = GUESTS[guest];
  return `${g.comfort ? '♛' : ''}${g.item ? ITEM_ICON[g.item] : ROOM_ICON[g.room]}`;
};
const TRAIL_COPY = {
  lake: {
    art: '≈',
    button: 'Paddle to the lake ↗',
    finds: 'Brings home 1 oat cake and 1 herbal soap.',
    start: 'Dora packs a picnic. Enzo checks the canoe. Back soon!',
    done: 'Home from Glass lake! +18 supplies, +12 tips and a little picnic for the pantry.',
  },
  juniper: {
    art: '↟',
    button: 'Take an expedition ↗',
    finds: 'The steady choice for a full supply shed.',
    start: 'Dora packs the tea. Enzo takes the map. See you in a bit!',
    done: 'Back from the trail! +48 supplies and +35 tips.',
  },
  summit: {
    art: '▲',
    button: 'Climb the summit ↗',
    finds: 'Finds a lodge decoration (+1 tip per visit, up to 6), 10 hearts and a viscacha for the album.',
    start: 'Warm scarves on. The condors are waiting!',
    done: 'Summit reached! +60 supplies, +90 tips, 10 hearts and a new decoration for the lodge.',
  },
} as const;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
const guestName = (v: GuestVisit) =>
  v.regular >= 0
    ? `${REGULARS[v.regular].name} the ${GUESTS[v.guest].name.toLowerCase()}`
    : `${/^[aeiou]/.test(COAT_NAMES[v.coat]) ? 'An' : 'A'} ${COAT_NAMES[v.coat]} ${GUESTS[v.guest].name.toLowerCase()}`;
const wishText = (guest: number) => {
  const g = GUESTS[guest];
  return `the ${ROOMS[g.room].name}${g.item ? ` and some ${ITEMS[g.item].name}` : ''}${g.comfort ? ', with Extra comfort' : ''}`;
};
const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const SHORTCUTS: Record<string, (s: RetreatState) => void> = {
  '1': (s) => {
    s.dora = 'welcome';
  },
  '2': (s) => {
    s.dora = 'comfort';
  },
  '3': (s) => {
    s.enzo = 'gather';
  },
  '4': (s) => {
    s.enzo = 'craft';
  },
};
/** A disclosure rather than a hover tooltip, so it works with touch, keyboard and screen readers. */
function Why({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="mr-why">
      <summary aria-label={label} title={label}>
        ?
      </summary>
      <div className="mr-why-panel">{children}</div>
    </details>
  );
}
function Parts({ parts, unit }: { parts: Part[]; unit: string }) {
  return (
    <ul>
      {parts.map((p) => (
        <li key={p.label}>
          <span>{p.label}</span>
          <b>
            +{p.value} {unit}
          </b>
        </li>
      ))}
    </ul>
  );
}
function Fur() {
  return (
    <>
      <i className="ear left" />
      <i className="ear right" />
      <i className="tail" />
      <i className="body" />
      <i className="face" />
      <i className="eyes" />
      <i className="nose" />
      <i className="apron" />
    </>
  );
}
/** A visiting chinchilla; `kind` (a GUESTS index) adds that guest type's accessory. */
function Visitor({ coat, kind = -1 }: { coat: number; kind?: number }) {
  const id = kind >= 0 ? GUESTS[kind].id : '';
  return (
    <span
      aria-hidden="true"
      className={`mr-chin small guest ${COATS[coat % COATS.length]}${id ? ` kind-${id}` : ''}`}
    >
      <Fur />
      {id && (
        <>
          <i className="gear" />
          <i className="gear2" />
        </>
      )}
    </span>
  );
}
function Chin({
  name,
  small = false,
}: {
  name: 'Dora' | 'Enzo';
  small?: boolean;
}) {
  return (
    // CSS pixel artwork is one accessible image, not an external asset.
    <span
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={`${name}, ${name === 'Dora' ? 'white' : 'grey'} chinchilla`}
      className={`mr-chin ${name.toLowerCase()} ${small ? 'small' : ''}`}
    >
      <Fur />
    </span>
  );
}
export default function MountainRetreat() {
  const game = useRef<RetreatState>(freshRetreat());
  // Last guest visit this session, so visitors only appear when one really happened.
  const visit = useRef({ visits: 0, at: -1 });
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mountain-retreat-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system')
        setTheme(saved);
    } catch {
      /* Theme switching still works without storage. */
    }
  }, []);
  const changeTheme = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    try {
      localStorage.setItem('mountain-retreat-theme', value);
    } catch {
      /* Optional preference. */
    }
  };
  const [, render] = useState(0);
  const [notice, setNotice] = useState('A little lodge. A very big welcome.');
  const [storage, setStorage] = useState('Loading local journal…');
  const [guide, setGuide] = useState(false);
  const [away, setAway] = useState<
    (ReturnType<typeof awaySummary> & { minutes: number }) | null
  >(null);
  const [sound, setSound] = useState(false);
  const soundOn = useRef(false);
  // Visit number whose featured guest added a new album coat, so the scene can celebrate it.
  const newCoat = useRef(-1);
  // Lodge second until which the viscacha lingers after a summit trip.
  const viscachaUntil = useRef(-1);
  useEffect(() => {
    try {
      if (localStorage.getItem('mountain-retreat-sound') === 'on') {
        soundOn.current = true;
        setSound(true);
      }
    } catch {
      /* Sound stays off without storage. */
    }
    // A remembered "on" still needs a gesture before the browser allows audio.
    const wake = () => {
      if (soundOn.current) enableSound();
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);
  const toggleSound = () => {
    const on = !soundOn.current;
    soundOn.current = on;
    setSound(on);
    if (on) {
      enableSound();
      playCue('happy');
    }
    try {
      localStorage.setItem('mountain-retreat-sound', on ? 'on' : 'off');
    } catch {
      /* Optional preference. */
    }
  };
  const persist = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.current));
      setStorage('Journal saved on this device');
    } catch {
      setStorage('Storage unavailable · progress lasts this visit only');
    }
  };
  useEffect(() => {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const before = parseRetreat(raw);
      const restored = restoreRetreat(raw, now);
      game.current = restored.state;
      if (restored.invalid)
        setNotice('Unreadable journal. A fresh lodge is ready for you.');
      else if (restored.seconds >= 30) {
        setNotice(
          `Welcome home! ${Math.floor(restored.seconds / 60)} minutes away · +${restored.earned} tips. Offline work is capped at 8 hours.`,
        );
        if (before)
          setAway({
            minutes: Math.floor(restored.seconds / 60),
            ...awaySummary(before, restored.state),
          });
      }
    } catch {
      game.current = freshRetreat(now);
    }
    visit.current = { visits: game.current.visits, at: -1 };
    setReady(true);
    persist();
    render((n) => n + 1);
    const sync = () => {
      const current = Date.now();
      const seconds = Math.max(
        0,
        Math.floor((current - game.current.savedAt) / 1000),
      );
      if (seconds) {
        const was = game.current.activity;
        const before = structuredClone(game.current);
        advanceRetreat(game.current, seconds);
        const g = game.current;
        const changed = awaySummary(before, g);
        if (g.visits > visit.current.visits) {
          visit.current = {
            visits: g.visits,
            at: g.elapsed - (g.elapsed % visitPeriod(g)),
          };
          if (g.last) {
            if (changed.coats > 0) {
              newCoat.current = g.visits;
              setNotice(
                `New in the album: ${guestName(g.last).replace(/^A/, 'a')}!`,
              );
            }
            if (soundOn.current)
              playCue(
                changed.coats > 0
                  ? 'coat'
                  : g.last.outcome === 'happy'
                    ? 'happy'
                    : g.last.outcome === 'away'
                      ? 'away'
                      : 'visit',
              );
          }
          if (g.last && g.last.postcard >= 0 && g.last.regular >= 0) {
            setNotice(
              `A postcard from ${REGULARS[g.last.regular].name}! “Thank you for the warm welcome.” +${POSTCARDS[g.last.postcard].tips} tips.`,
            );
            if (soundOn.current) playCue('return');
          }
        }
        // A soft footstep whenever a host sets off for the next room.
        if (
          soundOn.current &&
          !g.activity &&
          g.elapsed !== before.elapsed &&
          (['dora', 'enzo'] as const).some(
            (h) => hostStop(g, h).walking && g.elapsed % HOST_STOP_SECONDS[h] === 0,
          )
        )
          playCue('step');
        game.current.savedAt =
          current -
          (seconds < 28800 ? (current - game.current.savedAt) % 1000 : 0);
        if (was && !game.current.activity) {
          if (soundOn.current) playCue('return');
          if (was.trail === 'summit') viscachaUntil.current = g.elapsed + 60;
          const reward = festivalReward(g);
          setNotice(
            was.kind === 'festival'
              ? `Lanterns, laughter, full hearts! +${reward.tips} tips, +${reward.hearts} hearts and +5 reputation.`
              : TRAIL_COPY[was.trail ?? 'juniper'].done,
          );
        }
        persist();
        render((n) => n + 1);
      }
    };
    const timer = setInterval(sync, 1000);
    window.addEventListener('pagehide', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  const s = game.current;
  const act = (fn: () => void) => {
    fn();
    persist();
    render((n) => n + 1);
  };
  const busy = !!s.activity;
  // Number keys 1–4 set the hosts' duties; the latest render's state is always used.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    const target = e.target as HTMLElement | null;
    const shortcut = SHORTCUTS[e.key];
    if (
      !shortcut ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      !ready ||
      busy ||
      (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))
    )
      return;
    e.preventDefault();
    act(() => shortcut(game.current));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const open = s.rooms.filter(Boolean).length;
  const period = visitPeriod(s);
  const since = visit.current.at < 0 ? -1 : s.elapsed - visit.current.at;
  const recent = !busy && since >= 0 && since < period && !!s.last;
  const staying = recent && s.last?.outcome !== 'away';
  const turnedAway = recent && s.last?.outcome === 'away';
  const arriving =
    !busy && s.elapsed % period >= period - 3 && s.supplies >= open;
  const when = season(s.elapsed);
  const night = isNight(s.elapsed);
  const stars5 = rating(s);
  const next = upcomingGuest(s);
  const nextGuest = GUESTS[next.guest];
  const grantable = canGrant(s, next.guest);
  const featuredRoom = s.last ? GUESTS[s.last.guest].room : -1;
  const albumSeen = s.album.reduce(
    (n, mask) => n + COAT_NAMES.filter((_, k) => mask & (1 << k)).length,
    0,
  );
  const perSecond = (supplyRate(s) / SUPPLY_SECONDS).toFixed(1);
  const rewards = visitRewards(s, nextVisitAt(s));
  const recipes = s.enzo === 'craft' && (s.rooms[1] > 0 || s.rooms[3] > 0);
  const netSupplies = Math.round(
    (60 / SUPPLY_SECONDS) * supplyRate(s) -
      (60 / period) * open -
      (recipes ? (60 / RECIPE_SECONDS) * RECIPE_COST : 0),
  );
  const ring = busy ? 0 : 1 - (nextVisitAt(s) - s.elapsed) / period;
  const freshCoat = (s.album[next.guest] & (1 << next.coat)) === 0;
  // Guests who aren't featured still dress as a plausible guest type for the lodge.
  const pool = guestPool(s);
  const filler = (n: number) => (pool.length ? pool[(s.visits + n) % pool.length] : 0);
  const hostRooms = busy
    ? []
    : (['dora', 'enzo'] as const).flatMap((h): number[] => {
        const stop = hostStop(s, h);
        return stop.walking ? [] : [stop.room];
      });
  const viscacha =
    s.album[VISCACHA] > 0 &&
    !night &&
    (s.elapsed < viscachaUntil.current || s.elapsed % 240 < 60);
  const smoke = busy ? 0 : staying ? Math.min(3, 1 + Math.floor(open / 2)) : 1;
  const seasonLeft = SEASON_SECONDS - (s.elapsed % SEASON_SECONDS);
  const nextSeason = SEASONS[(SEASONS.indexOf(when) + 1) % SEASONS.length];
  const lightLeft = night
    ? DAY_SECONDS - (s.elapsed % DAY_SECONDS)
    : NIGHT_FROM - (s.elapsed % DAY_SECONDS);
  const awayLines = away
    ? (
        [
          [away.visits, `${away.visits} guest ${away.visits === 1 ? 'visit' : 'visits'}`],
          [away.tips, `${signed(away.tips)} tips`],
          [away.hearts, `${signed(away.hearts)} hearts`],
          [away.reputation, `${signed(away.reputation)} reputation`],
          [away.supplies, `${signed(away.supplies)} supplies`],
          [away.oatcakes, `${signed(away.oatcakes)} oat cakes`],
          [away.soap, `${signed(away.soap)} herbal soap`],
          [away.postcards, `${away.postcards} ${away.postcards === 1 ? 'postcard' : 'postcards'} ✉`],
          [away.coats, `${away.coats} new album ${away.coats === 1 ? 'coat' : 'coats'} ✧`],
          [away.outings, `${away.outings} ${away.outings === 1 ? 'outing' : 'outings'} finished`],
        ] as [number, string][]
      ).filter(([n]) => n !== 0)
    : [];
  return (
    <main className="mr-shell" data-theme={theme}>
      <header className="mr-top">
        {/* Full navigation disposes this standalone simulation, matching arcade conventions. */}
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a href="/">← MAIN ARCADE</a>
        <span>THE ANDES · 2,840 M</span>
        <label className="mr-theme">
          Theme
          <select
            aria-label="Color theme"
            value={theme}
            onChange={(e) =>
              changeTheme(e.target.value as 'light' | 'dark' | 'system')
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button onClick={toggleSound} aria-pressed={sound} data-testid="sound">
          Sound {sound ? 'on ♪' : 'off'}
        </button>
        <button onClick={() => setGuide(!guide)} aria-expanded={guide}>
          Field guide {guide ? '−' : '+'}
        </button>
      </header>
      <section className="mr-heading">
        <div>
          <p className="mr-kicker">DORA & ENZO’S</p>
          <h1>
            Mountain Retreat<span>A soft place to land.</span>
          </h1>
        </div>
        <p className="mr-intro">
          Make tea. Make friends. Make a little home
          <br />
          above the clouds.
        </p>
      </section>
      {guide && (
        <aside className="mr-guide">
          <h2>Your first 5–10 minutes</h2>
          <p>
            Enzo brings supplies every 2 seconds. Dora uses one supply per open
            room to welcome guests, earning hearts and tips automatically. Spend
            tips to open rooms and improve them to level 3, then choose one of
            two specialties for each room.
          </p>
          <p>
            Shortcuts: press 1 for Welcome, 2 for Extra comfort, 3 for Gather
            and 4 for Craft with care. Open the ? beside a number to see
            exactly where it comes from. Sound is off until you switch it on.
          </p>
          <p>
            Every visit has a featured guest with a wish: a room, sometimes an
            oat cake or herbal soap, and sometimes Extra comfort. Granting it
            earns bonus tips, hearts and reputation. Leaving it unmet costs 1
            reputation, and turning guests away for lack of supplies costs 3.
            Every 20 reputation adds a star, which brings new guests and bigger
            tips. Set Enzo to craft to fill the pantry, and check the guest
            book to see who is coming next.
          </p>
          <p>
            Regulars Pip, Mochi and Luna return every fifth visit and send
            postcards as your friendship grows. Seasons change every 6 minutes
            of lodge time and nights come every 2: stargazers only visit at
            night, and the summit is snowed in over winter.
          </p>
          <p>
            Both hosts stop ALL normal work on outings. Rewards arrive on
            return. The lodge keeps working while you are away, up to 8 hours.
            There are no accounts or purchases. Your journal stays in this
            browser. A second open tab has its own simulation, so play in one
            tab.
          </p>
        </aside>
      )}
      {away && (
        <aside
          className="mr-away"
          data-testid="away-summary"
          aria-labelledby="mr-away-title"
        >
          <h2 id="mr-away-title">While you were away · {away.minutes} min</h2>
          {awayLines.length ? (
            <ul>
              {awayLines.map(([, text]) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : (
            <p>The lodge rested quietly.</p>
          )}
          <button onClick={() => setAway(null)}>Back to the lodge</button>
        </aside>
      )}
      <section className="mr-wallet" aria-label="Lodge resources">
        <div>
          <span>✦ TIPS</span>
          <strong data-testid="tips">{s.coins}</strong>
          <small>+{total(rewards.tips)} per visit</small>
          <Why label="Where tips come from">
            <p>The next visit pays +{total(rewards.tips)} tips:</p>
            <Parts parts={rewards.tips} unit="✦" />
            <p>
              Granting the featured guest’s wish adds +{WISH_TIPS}, or +
              {WISH_TIPS + ITEM_TIPS} when it uses an oat cake or herbal soap.
              Regulars’ postcards add {POSTCARDS.map((p) => p.tips).join(', ')}
              . Trails and festivals pay when the hosts return.
            </p>
          </Why>
        </div>
        <div>
          <span>♥ GUEST HEARTS</span>
          <strong data-testid="hearts">{s.hearts}</strong>
          <small>+{total(rewards.hearts)} per visit</small>
          <Why label="Where hearts come from">
            <p>The next visit brings +{total(rewards.hearts)} hearts:</p>
            <Parts parts={rewards.hearts} unit="♥" />
            <p>
              A granted wish adds +{WISH_HEARTS}. A festival costs{' '}
              {FESTIVAL.hearts} and returns {festivalReward(s).hearts}; the
              summit brings 10.
            </p>
          </Why>
        </div>
        <div>
          <span>▧ SUPPLIES</span>
          <strong data-testid="supplies">
            {s.supplies}
            <small> / {SUPPLY_CAP}</small>
          </strong>
          <small>+{perSecond} per second</small>
          <Why label="Where supplies come from and go">
            <p>
              Every {SUPPLY_SECONDS} seconds, +{supplyRate(s)}:
            </p>
            <Parts parts={supplyParts(s)} unit="▧" />
            <p>
              Each visit uses {open} (one per open room) every {period}{' '}
              seconds
              {recipes
                ? `, and Enzo’s recipes use ${RECIPE_COST} every ${RECIPE_SECONDS} seconds while the pantry has room`
                : ''}
              . About {signed(netSupplies)} per minute.
            </p>
          </Why>
        </div>
        <div>
          <span>⌂ YOUR LODGE</span>
          <strong>
            {open}
            <small> / 4 rooms</small>
          </strong>
          <small>{s.served} happy guest visits</small>
        </div>
        <div>
          <span>✧ RATING</span>
          <strong
            data-testid="rating"
            aria-label={`${stars5} of 5 stars`}
            className="mr-stars"
          >
            {stars(stars5)}
          </strong>
          <small>{s.reputation} / 100 reputation</small>
          <Why label="How reputation works">
            <p>
              {stars5 < 5
                ? `${stars5 * 20 - s.reputation} more reputation for ${stars5 + 1} stars.`
                : 'Top rating!'}
            </p>
            <ul>
              <li>
                <span>Granted wish</span>
                <b>+{s.perks[0] === 0 ? 2 : 1}</b>
              </li>
              <li>
                <span>Festival</span>
                <b>+5</b>
              </li>
              <li>
                <span>Unmet wish</span>
                <b>−1</b>
              </li>
              <li>
                <span>Guest turned away</span>
                <b>−3</b>
              </li>
            </ul>
            <p>
              Each star past the first adds 1 tip per room on every visit and
              invites new kinds of guests.
            </p>
          </Why>
        </div>
      </section>
      <div className="mr-columns">
        <section
          className="mr-scene-panel"
          aria-label="Animated cutaway mountain lodge"
        >
          <div className="mr-scene-caption">
            <span>
              01 / JUNIPER LODGE ·{' '}
              <span data-testid="season">
                {SEASON_ICON[when]} {when.toUpperCase()} ·{' '}
                {night ? '☾ NIGHT' : '☼ DAY'}
              </span>
            </span>
            <span data-testid="scene-status">
              {busy
                ? '◌ BOTH HOSTS AWAY'
                : turnedAway
                  ? '✕ A GUEST WAS TURNED AWAY'
                  : staying
                    ? `● ${open} ${open === 1 ? 'GUEST' : 'GUESTS'} STAYING`
                    : arriving
                      ? '● GUESTS ON THE PATH'
                      : '● THE KETTLE IS ON'}
            </span>
          </div>
          <div
            className={`mr-landscape season-${when}${night ? ' night' : ''}${busy ? ' away' : ''}`}
            data-testid="landscape"
          >
            <div className="mr-sun" />
            <div className="mr-cloud c1" />
            <div className="mr-cloud c2" />
            <div className="mr-mountain m1" />
            <div className="mr-mountain m2" />
            <div className="mr-pine p1" />
            <div className="mr-pine p2" />
            <div className="mr-sky-stars" aria-hidden="true">
              {Array.from({ length: 14 }, (_, n) => (
                <i
                  key={n}
                  style={
                    {
                      '--x': `${(n * 41 + 7) % 96}%`,
                      '--y': `${(n * 23 + 5) % 38}%`,
                      '--d': `${(n % 5) * 0.4}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <div className={`mr-weather ${WEATHER[when]}`} aria-hidden="true">
              {Array.from({ length: when === 'summer' ? 5 : 12 }, (_, n) => (
                <i
                  key={n}
                  style={
                    {
                      '--x': `${(n * 37 + 11) % 100}%`,
                      '--d': `${-((n * 0.9) % 7)}s`,
                      '--t': `${6 + (n % 4)}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            {viscacha && (
              <div className="mr-viscacha" data-testid="viscacha" aria-hidden="true">
                <Visitor coat={0} kind={VISCACHA} />
              </div>
            )}
            <div className="mr-lodge">
              {TROPHIES.slice(0, s.decor).map((name, n) => (
                <i
                  key={name}
                  className={`mr-trophy t${n + 1}`}
                  title={name}
                  aria-hidden="true"
                >
                  <b />
                </i>
              ))}
              {night && !busy && s.rooms[2] > 0 && (
                <div className="mr-roof-guest" aria-hidden="true">
                  <Visitor coat={Math.floor(s.elapsed / DAY_SECONDS)} kind={2} />
                </div>
              )}
              {/* Outside the roof, whose clip-path would hide smoke above it. */}
              <i className={`mr-chimney smoke-${smoke}`} aria-hidden="true">
                <b />
                <b />
                <b />
              </i>
              <div className="mr-roof">
                <span>JUNIPER</span>
              </div>
              <div className="mr-rooms">
                {SLOT.map((i) => (
                  <div
                    key={i}
                    className={`mr-room room-${i} ${s.rooms[i] ? 'unlocked' : 'locked'}`}
                    data-testid={`room-${i}`}
                  >
                    <span className="mr-room-label">
                      {s.rooms[i] ? ROOMS[i].name : '✧ A room to grow into'}
                    </span>
                    {s.rooms[i] ? (
                      <>
                        <div className="mr-window" />
                        <div className={`mr-furniture furniture-${i}`}>
                          <i />
                          <b />
                          {i === 0 ? '♨' : i === 1 ? '▥' : i === 2 ? '✦' : '≈'}
                        </div>
                        {s.rooms[i] > 1 && (
                          <div className="mr-decor">
                            ✿ {s.rooms[i] === 3 ? '✦' : ''}
                          </div>
                        )}
                        <span className="mr-level">
                          {'★'.repeat(s.rooms[i])}
                        </span>
                        {s.perks[i] >= 0 && (
                          <i
                            className={`mr-perk-art perk-${i}-${s.perks[i]}`}
                            title={PERKS[i][s.perks[i]].name}
                            aria-hidden="true"
                          >
                            <b />
                            <b />
                            <b />
                          </i>
                        )}
                        {staying && s.last && (
                          <span
                            key={s.visits}
                            className={`mr-visitor${since === period - 1 ? ' leaving' : ''}${featuredRoom === i ? ' featured' : ''}${featuredRoom === i && newCoat.current === s.visits ? ' new-coat' : ''}${featuredRoom === i && s.last.outcome === 'happy' ? ' hop' : ''}${featuredRoom === i && s.last.regular >= 0 ? ' regular' : ''}`}
                          >
                            <Visitor
                              coat={
                                featuredRoom === i
                                  ? s.last.coat
                                  : s.visits + i
                              }
                              kind={featuredRoom === i ? s.last.guest : filler(i)}
                            />
                            {featuredRoom === i && s.last.regular >= 0 && (
                              <b className="mr-nametag">
                                {REGULARS[s.last.regular].name}
                              </b>
                            )}
                            {night ? (
                              <span className="mr-zzz" aria-hidden="true">
                                z
                              </span>
                            ) : (
                              hostRooms.includes(i) && (
                                <span className="mr-chat" aria-hidden="true">
                                  {since % 2 ? '♪' : '…'}
                                </span>
                              )
                            )}
                            <span
                              className={`mr-guest${featuredRoom === i && s.last.outcome === 'plain' ? ' unmet' : ''}`}
                            >
                              {featuredRoom === i && s.last.outcome === 'plain'
                                ? '…'
                                : '♥'}
                            </span>
                            {featuredRoom === i && since <= 1 && (
                              <span
                                className="mr-float"
                                data-testid="visit-float"
                                aria-hidden="true"
                              >
                                +{s.last.tips} ✦ +{s.last.hearts} ♥
                              </span>
                            )}
                            {featuredRoom === i &&
                              newCoat.current === s.visits && (
                                <span className="mr-sparkle" aria-hidden="true">
                                  ✧ NEW
                                </span>
                              )}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="mr-blueprint">
                          {i === 2 ? '☾' : i === 3 ? '≈' : '♨'}
                        </span>
                        <small>
                          {ROOMS[i].name}
                          <br />
                          {ROOMS[i].cost} tips to open
                        </small>
                      </>
                    )}
                  </div>
                ))}
                {ready &&
                  !busy &&
                  (['dora', 'enzo'] as const).map((host) => {
                    const stop = hostStop(s, host);
                    const to = place(stop.room);
                    const from = place(stop.from);
                    const motion = !stop.walking
                      ? ''
                      : to.col === from.col
                        ? ' walking climbing'
                        : to.col < from.col
                          ? ' walking facing-left'
                          : ' walking';
                    const name = host === 'dora' ? 'Dora' : 'Enzo';
                    return (
                      <div
                        key={host}
                        data-room={stop.room}
                        className={`mr-host ${host}-host${motion}`}
                        style={
                          { '--col': to.col, '--row': to.row } as React.CSSProperties
                        }
                      >
                        <Chin name={name} small />
                        <span>
                          {name} · {s[host]}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="mr-foundation">
                EST. TODAY · STAY A LITTLE LONGER
              </div>
            </div>
            <div className="mr-path" />
            {arriving && (
              <div
                className="mr-arrivals"
                key={Math.floor(s.elapsed / period)}
                aria-hidden="true"
              >
                {Array.from({ length: open }, (_, n) => (
                  <span
                    key={n}
                    className={n === 0 ? 'featured' : undefined}
                    style={{ '--n': n } as React.CSSProperties}
                  >
                    <Visitor
                      coat={n === 0 ? next.coat : s.visits + 1 + n}
                      kind={n === 0 ? next.guest : filler(n + 1)}
                    />
                    {n === 0 && (
                      <b className="mr-wish-bubble">{wishIcon(next.guest)}</b>
                    )}
                    {n === 0 && next.regular >= 0 && (
                      <b className="mr-nametag">{REGULARS[next.regular].name}</b>
                    )}
                  </span>
                ))}
              </div>
            )}
            {turnedAway && s.last && (
              <div className="mr-sad" key={s.visits} aria-hidden="true">
                <Visitor coat={s.last.coat} kind={s.last.guest} />
                <b>…</b>
              </div>
            )}
            {busy && (
              <div
                className={`mr-trail-hosts ${s.activity?.kind === 'festival' ? 'festival' : (s.activity?.trail ?? 'juniper')}`}
              >
                <i className="mr-outing-prop" aria-hidden="true" />
                <Chin name="Dora" small />
                <Chin name="Enzo" small />
                <span>
                  {s.activity?.kind === 'festival'
                    ? 'Hosting the lantern festival'
                    : `Exploring ${TRAILS[s.activity?.trail ?? 'juniper'].name}`}
                </span>
              </div>
            )}
          </div>
          <div className="mr-scene-foot">
            <span>Two friends. One shared dream.</span>
            <span>
              ✦ {s.festivals} festivals · {s.expeditions} trails · {s.decor} /{' '}
              {DECOR_CAP} decorations
              {s.decor ? ` (${TROPHIES.slice(0, s.decor).join(', ')})` : ''}
            </span>
          </div>
          <div className="mr-seasons" data-testid="season-timeline">
            <div className="mr-year">
              <ol aria-label="Seasons">
                {SEASONS.map((x) => (
                  <li key={x} aria-current={x === when ? 'true' : undefined}>
                    {SEASON_ICON[x]} {x}
                  </li>
                ))}
              </ol>
              <i
                aria-hidden="true"
                style={
                  {
                    '--p': (s.elapsed % (SEASON_SECONDS * 4)) / (SEASON_SECONDS * 4),
                  } as React.CSSProperties
                }
              />
            </div>
            <p>
              {nextSeason[0].toUpperCase() + nextSeason.slice(1)} in{' '}
              {mmss(seasonLeft)} · {night ? 'Dawn' : 'Nightfall'} in{' '}
              {mmss(lightLeft)}
              {nextSeason === 'winter' ? ' · winter snows in the summit' : ''}
              {busy ? ' · lodge time pauses while the hosts are away' : ''}
            </p>
          </div>
        </section>
        <aside className="mr-host-panel">
          <div className="mr-section-title">
            <span>THE HEART OF THE HOUSE</span>
            <h2>Better, together.</h2>
          </div>
          <article
            className={`mr-guest-book ${grantable ? 'ok' : 'warn'}`}
            data-testid="next-guest"
            aria-live="polite"
          >
            <span
              className="mr-ring"
              data-testid="visit-ring"
              style={{ '--p': ring } as React.CSSProperties}
              aria-hidden="true"
            >
              <Visitor coat={next.coat} kind={next.guest} />
            </span>
            <div>
              {freshCoat && (
                <p className="mr-new-coat" data-testid="new-coat">
                  ✧ New coat for the album
                </p>
              )}
              <h3>
                Next guest{' '}
                <span>
                  {busy
                    ? 'AFTER THE OUTING'
                    : `IN ${nextVisitAt(s) - s.elapsed}S`}
                </span>
              </h3>
              <p>
                {guestName(next)}
                {next.regular >= 0 ? ' (a regular)' : ''} hopes for{' '}
                {wishText(next.guest)}.
              </p>
              <p className="mr-wish">
                {grantable
                  ? '✓ Their wish can be granted.'
                  : nextGuest.comfort && s.dora !== 'comfort'
                    ? '✕ Switch Dora to Extra comfort.'
                    : `✕ No ${ITEMS[nextGuest.item ?? 'oatcake'].name} in the pantry. Set Enzo to Craft with care.`}
              </p>
              {s.last && (
                <p className="mr-last" data-testid="last-guest">
                  Last: {guestName(s.last)}{' '}
                  {s.last.outcome === 'happy'
                    ? `left happy · +${s.last.tips} tips, +${s.last.hearts} ♥`
                    : s.last.outcome === 'plain'
                      ? `stayed, but their wish was unmet · −1 reputation`
                      : 'was turned away, with no supplies to spare · −3 reputation'}
                </p>
              )}
            </div>
          </article>
          <article className="mr-host-card">
            <Chin name="Dora" />
            <div>
              <h3>
                Dora <span>HOSPITALITY</span>
              </h3>
              <p>“Every guest deserves a warm hello.”</p>
            </div>
            <fieldset disabled={!ready || busy}>
              <legend>Dora’s attention</legend>
              <button
                aria-pressed={s.dora === 'welcome'}
                aria-keyshortcuts="1"
                onClick={() =>
                  act(() => {
                    s.dora = 'welcome';
                  })
                }
              >
                Welcome <kbd aria-hidden="true">1</kbd>
                <small>Guests every 6s · 1 ♥ / room</small>
              </button>
              <button
                aria-pressed={s.dora === 'comfort'}
                aria-keyshortcuts="2"
                onClick={() =>
                  act(() => {
                    s.dora = 'comfort';
                  })
                }
              >
                Extra comfort <kbd aria-hidden="true">2</kbd>
                <small>Guests every 10s · 3 ♥ / room</small>
              </button>
            </fieldset>
          </article>
          <article className="mr-host-card">
            <Chin name="Enzo" />
            <div>
              <h3>
                Enzo <span>SUPPLIES</span>
              </h3>
              <p>“I brought a little extra. Just in case.”</p>
            </div>
            <fieldset disabled={!ready || busy}>
              <legend>Enzo’s attention</legend>
              <button
                aria-pressed={s.enzo === 'gather'}
                aria-keyshortcuts="3"
                onClick={() =>
                  act(() => {
                    s.enzo = 'gather';
                  })
                }
              >
                Gather <kbd aria-hidden="true">3</kbd>
                <small>+3 supplies / 2s · 2 tips / level</small>
              </button>
              <button
                aria-pressed={s.enzo === 'craft'}
                aria-keyshortcuts="4"
                onClick={() =>
                  act(() => {
                    s.enzo = 'craft';
                  })
                }
              >
                Craft with care <kbd aria-hidden="true">4</kbd>
                <small>+1 supply / 2s · 3 tips / level · bakes & makes soap</small>
              </button>
            </fieldset>
            <p className="mr-pantry" data-testid="pantry">
              Pantry: {ITEM_ICON.oatcake} {s.pantry.oatcake} oat{' '}
              {s.pantry.oatcake === 1 ? 'cake' : 'cakes'} ·{' '}
              {ITEM_ICON.soap} {s.pantry.soap} herbal soap
              <small>
                {' '}
                (up to {PANTRY_CAP} each
                {s.rooms[1] || s.rooms[3]
                  ? ''
                  : '; open the kitchen or bath to start recipes'}
                )
              </small>
            </p>
          </article>
          <p className="mr-stock-note">
            {busy
              ? 'Both friends are making memories. Room production is paused.'
              : s.supplies < open
                ? 'Low supplies. Let Enzo gather, or bring supplies back from a trail.'
                : when === 'spring'
                  ? 'Spring blossoms: +1 supply on every delivery.'
                  : when === 'summer'
                    ? 'Summer: festivals pay half as much again.'
                    : when === 'autumn'
                      ? 'Autumn harvest: +1 tip per room on every visit.'
                      : 'Winter: cozy guests give +1 heart per room, but the summit is snowed in.'}
          </p>
        </aside>
      </div>
      <output className="mr-notice">✉ {notice}</output>
      <section className="mr-improvements">
        <div className="mr-section-title">
          <span>SMALL CHANGES, WARMER STAYS</span>
          <h2>Room to grow.</h2>
          <p>
            Open rooms in order. Each level adds tips to every guest visit. At
            level 3, choose a specialty.
          </p>
        </div>
        <div className="mr-upgrades">
          {ROOMS.map((room, i) => (
            <article key={room.name}>
              <span className="mr-card-number">
                0{i + 1}{' '}
                <span>
                  {s.rooms[i] ? `LEVEL ${s.rooms[i]} / 3` : 'NOT YET OPEN'}
                </span>
              </span>
              <h3>{room.name}</h3>
              <p>{room.detail}</p>
              {s.rooms[i] < 3 ? (
                <button
                  disabled={
                    !ready ||
                    busy ||
                    s.coins < roomCost(s, i) ||
                    (i > 0 && !s.rooms[i - 1])
                  }
                  onClick={() =>
                    act(() => {
                      if (upgradeRoom(s, i))
                        setNotice(
                          s.rooms[i] === 3
                            ? `${room.name} is lovely as can be. Choose its specialty!`
                            : `${room.name} ${s.rooms[i] === 1 ? 'is open. Come on in!' : 'feels even cozier.'}`,
                        );
                    })
                  }
                >
                  {`${s.rooms[i] ? 'Improve' : 'Open room'} · ${roomCost(s, i)} tips`}
                </button>
              ) : s.perks[i] >= 0 ? (
                <p className="mr-perk" data-testid={`perk-${i}`}>
                  ✓ {PERKS[i][s.perks[i]].name}
                  <small>{PERKS[i][s.perks[i]].detail}</small>
                </p>
              ) : (
                <fieldset className="mr-perk-choice">
                  <legend className="mr-sr">{room.name} specialty</legend>
                  {PERKS[i].map((perk, p) => (
                    <button
                      key={perk.name}
                      disabled={!ready || busy}
                      onClick={() =>
                        act(() => {
                          if (choosePerk(s, i, p))
                            setNotice(`${room.name}: ${perk.name}. ${perk.detail}.`);
                        })
                      }
                    >
                      {perk.name}
                      <small>{perk.detail}</small>
                    </button>
                  ))}
                </fieldset>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="mr-outings">
        <div className="mr-section-title">
          <span>STEP OUT OF THE EVERYDAY</span>
          <h2>Memories are made outside.</h2>
          <p>Both hosts go together. Normal work pauses until they return.</p>
        </div>
        <div className="mr-outing-grid">
          {TRAIL_ORDER.map((id) => {
            const trail = TRAILS[id];
            const copy = TRAIL_COPY[id];
            const closed = trailClosed(s, id);
            return (
              <article key={id} className={`trail-${id}`}>
                <span className="mr-outing-art">{copy.art}</span>
                <div>
                  <h3>{trail.name}</h3>
                  <p>
                    {activitySeconds(s, 'expedition', id)} seconds · costs{' '}
                    {trail.cost} supplies
                    <br />
                    Bring home {trail.supplies} supplies + {trail.tips} tips.{' '}
                    {copy.finds}
                  </p>
                  {closed && <p className="mr-closed">✕ {closed}</p>}
                  <button
                    disabled={!ready || busy || !!closed || s.supplies < trail.cost}
                    onClick={() =>
                      act(() => {
                        if (startActivity(s, 'expedition', id))
                          setNotice(copy.start);
                      })
                    }
                  >
                    {copy.button}
                  </button>
                </div>
              </article>
            );
          })}
          <article>
            <span className="mr-outing-art lantern">✧</span>
            <div>
              <h3>A thousand little lanterns</h3>
              <p>
                {activitySeconds(s, 'festival')} seconds · costs{' '}
                {FESTIVAL.hearts} hearts + {FESTIVAL.supplies} supplies
                <br />
                Celebrate for {festivalReward(s).tips} tips +{' '}
                {festivalReward(s).hearts} hearts + 5 reputation.
                {when === 'summer' ? ' Summer crowds: half as much again!' : ''}
              </p>
              <button
                disabled={
                  !ready ||
                  busy ||
                  s.hearts < FESTIVAL.hearts ||
                  s.supplies < FESTIVAL.supplies
                }
                onClick={() =>
                  act(() => {
                    if (startActivity(s, 'festival'))
                      setNotice(
                        'The whole mountain is invited. Your lantern festival has begun!',
                      );
                  })
                }
              >
                Host a festival ↗
              </button>
            </div>
          </article>
        </div>
        {s.activity && (
          <output className="mr-activity">
            <strong>
              {s.activity.kind === 'festival'
                ? 'Lantern festival'
                : TRAILS[s.activity.trail ?? 'juniper'].name}{' '}
              · {s.activity.remaining}s remaining
            </strong>
            <progress
              aria-label="Activity progress"
              max={activitySeconds(s, s.activity.kind, s.activity.trail ?? 'juniper')}
              value={
                activitySeconds(s, s.activity.kind, s.activity.trail ?? 'juniper') -
                s.activity.remaining
              }
            />
            <span>Hospitality & supplies paused · reward on return</span>
          </output>
        )}
      </section>
      <section className="mr-album" aria-labelledby="mr-album-title">
        <div className="mr-section-title">
          <span>
            GUEST ALBUM · {albumSeen} / {GUESTS.length * COAT_NAMES.length}{' '}
            COATS
          </span>
          <h2 id="mr-album-title">Everyone who stayed.</h2>
          <p>
            Each featured guest adds their coat to the album. Regulars return
            every fifth visit and send a postcard at 3, 6 and 10 friendship.
          </p>
        </div>
        <div className="mr-regulars">
          {REGULARS.map((r, i) => {
            const cards = POSTCARDS.filter((p) => s.friends[i] >= p.at).length;
            const waiting = !s.rooms[GUESTS[r.guest].room];
            return (
              <article key={r.name} data-testid={`regular-${i}`}>
                <Visitor coat={r.coat} kind={r.guest} />
                <div>
                  <h3>
                    {r.name} <span>{GUESTS[r.guest].name.toUpperCase()}</span>
                  </h3>
                  <progress
                    aria-label={`Friendship with ${r.name}`}
                    max={FRIENDSHIP_CAP}
                    value={s.friends[i]}
                  />
                  <p>
                    {s.friends[i]} / {FRIENDSHIP_CAP} friendship ·{' '}
                    {'✉'.repeat(cards)}
                    {'·'.repeat(POSTCARDS.length - cards)} postcards
                    {waiting
                      ? ` · visits once the ${ROOMS[GUESTS[r.guest].room].name} opens`
                      : ''}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mr-album-grid">
          {GUESTS.map((g, i) => (
            <article key={g.id}>
              <h3>{g.name}</h3>
              <p>
                {i === VISCACHA
                  ? 'Only spotted from the Condor summit'
                  : `${stars(g.stars).slice(0, g.stars)} · ${ROOMS[g.room].name}${g.item ? ` · ${ITEM_ICON[g.item]} ${ITEMS[g.item].name}` : ''}${g.night ? ' · night' : ''}${g.comfort ? ' · Extra comfort' : ''}`}
              </p>
              <ul aria-label={`${g.name} coats`}>
                {COATS.map((coat, k) => {
                  const seen = (s.album[i] & (1 << k)) > 0;
                  return (
                    <li
                      key={coat}
                      className={`mr-swatch ${coat}${seen ? ' seen' : ''}`}
                      title={seen ? COAT_NAMES[k] : 'Not seen yet'}
                    >
                      <span className="mr-sr">
                        {seen ? COAT_NAMES[k] : 'not seen yet'}
                      </span>
                      {seen ? '' : '?'}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <footer className="mr-footer">
        <span>{storage}</span>
        <span>5–10 minute visits · 8-hour offline cap · no accounts</span>
      </footer>
    </main>
  );
}
