'use client';
/* Imperative deterministic engine, explicitly repainted after each tick/action. */
/* oxlint-disable react-compiler */
import { useEffect, useRef, useState } from 'react';
import {
  activitySeconds,
  advanceRetreat,
  awaySummary,
  canGrant,
  canTreat,
  CATCH_CAP,
  CATCH_COOLDOWN,
  catchReady,
  catchReward,
  choosePerk,
  COATS as COAT_NAMES,
  DAY_SECONDS,
  DECOR_CAP,
  EVENT_EVERY,
  EVENTS,
  FESTIVAL,
  festivalReward,
  freshRetreat,
  FRIENDSHIP_CAP,
  GOALS,
  GUESTS,
  guestIdentity,
  guestPool,
  HOST_STOP_SECONDS,
  hostStop,
  isNight,
  ITEM_TIPS,
  ITEMS,
  lodgeTitle,
  nextVisitAt,
  NIGHT_FROM,
  offerTreat,
  PANTRY_CAP,
  parseRetreat,
  PERKS,
  POSTCARDS,
  pourTea,
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
  TEA_COOLDOWN,
  TEA_REWARDS,
  teaReady,
  total,
  trailClosed,
  TRAILS,
  TREAT,
  upcomingGuest,
  upgradeRoom,
  VISCACHA,
  visitPeriod,
  visitRewards,
  WISH_HEARTS,
  WISH_TIPS,
  type EventKind,
  type GuestVisit,
  type Part,
  type RetreatState,
  type Season,
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
const CATCHABLE = {
  petals: 'petal',
  butterflies: 'butterfly',
  leaves: 'leaf',
  snow: 'snowflake',
  rain: 'raindrop',
} as const;
type Weather = keyof typeof CATCHABLE;
/** One keepsake glyph per GOALS entry. */
const KEEPSAKE_ICON = ['▭', '♨', '⚑', '⌖', '▣', '▦', '◈', '✧', '◒'];
/** Guests who aren't featured get identities keyed by visit and room, so arrivals match who then stays. */
const fillerSeed = (visits: number, room: number) => 100000 + visits * 4 + room;
interface ProfileTarget {
  seed: number;
  guest: number;
  coat: number;
  regular: number;
  where: 'room' | 'path' | 'next' | 'roof' | 'viscacha' | 'leaving' | 'album' | 'musician';
  room: number;
  /** `visits` when the profile was opened, to tell whether the guest has since moved on. */
  visit: number;
  featured: boolean;
}
/** Scrapbook photos store what was on screen, and are redrawn in miniature. */
interface Photo {
  at: number;
  caption: string;
  season: Season;
  night: boolean;
  event: EventKind | null;
  rooms: number[];
  perks: number[];
  guests: { room: number; coat: number; kind: number }[];
  hosts: number[];
}
const PHOTO_KEY = 'mountain-retreat-scrapbook';
const PHOTO_CAP = 12;
const isRoom = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 4;
function validPhoto(p: unknown): p is Photo {
  const x = p as Photo;
  return (
    !!x &&
    typeof x.at === 'number' &&
    typeof x.caption === 'string' &&
    x.caption.length <= 120 &&
    SEASONS.includes(x.season) &&
    typeof x.night === 'boolean' &&
    (x.event === null || Object.hasOwn(EVENTS, x.event)) &&
    Array.isArray(x.rooms) &&
    x.rooms.length === 4 &&
    x.rooms.every((r) => Number.isInteger(r)) &&
    Array.isArray(x.perks) &&
    x.perks.length === 4 &&
    x.perks.every((r) => Number.isInteger(r)) &&
    Array.isArray(x.guests) &&
    x.guests.every(
      (g) =>
        !!g &&
        isRoom(g.room) &&
        Number.isInteger(g.coat) &&
        g.coat >= 0 &&
        Number.isInteger(g.kind) &&
        g.kind >= 0 &&
        g.kind < GUESTS.length,
    ) &&
    Array.isArray(x.hosts) &&
    x.hosts.every(isRoom)
  );
}
/** Tea meter position (0–1) at `ms` into a pour: a 1.6-second back-and-forth sweep. */
const meter = (ms: number) => {
  const u = (ms % 1600) / 1600;
  return u < 0.5 ? u * 2 : 2 - u * 2;
};
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
  rescue: {
    art: '✚',
    button: 'Rescue the hiker ↗',
    finds: 'Reputation +8 and a grateful hiker for the album.',
    start: 'Dora grabs the lantern, Enzo the blanket. Hold on, little hiker!',
    done: 'The lost hiker is safe and warm! +40 tips and +8 reputation.',
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
function GuestButton({
  target,
  onOpen,
  children,
}: {
  target: ProfileTarget;
  onOpen: (t: ProfileTarget, el: HTMLElement) => void;
  children: React.ReactNode;
}) {
  const who = guestIdentity(target.seed, target.guest, target.regular);
  return (
    <button
      type="button"
      className="mr-guest-btn"
      aria-label={`${who.name} the ${GUESTS[target.guest].name.toLowerCase()}: open profile`}
      onClick={(e) => onOpen(target, e.currentTarget)}
    >
      {children}
    </button>
  );
}
function PhotoScene({ photo }: { photo: Photo }) {
  return (
    <div
      className={`mr-photo-scene season-${photo.season}${photo.night ? ' night' : ''}${photo.event === 'storm' ? ' storm' : ''}`}
      aria-hidden="true"
    >
      <div className="mr-photo-lodge">
        {SLOT.map((i) => (
          <div key={i} className={`mr-photo-room${photo.rooms[i] ? '' : ' locked'}`}>
            {photo.perks[i] >= 0 && (
              <i className={`mr-perk-art perk-${i}-${photo.perks[i]}`}>
                <b />
                <b />
                <b />
              </i>
            )}
            {photo.guests
              .filter((g) => g.room === i)
              .map((g) => (
                <Visitor key={`${g.room}-${g.coat}`} coat={g.coat} kind={g.kind} />
              ))}
            {photo.hosts.map(
              (room, h) =>
                room === i && (
                  <span key={h} className={`mr-chin small ${h ? 'enzo' : 'dora'}`}>
                    <Fur />
                  </span>
                ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function TeaGame({
  ready,
  wait,
  onPour,
}: {
  ready: boolean;
  wait: number;
  onPour: (accuracy: number) => void;
}) {
  const [start, setStart] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  // Only this card re-renders every frame while the tea is pouring.
  useEffect(() => {
    if (start === null) return;
    let frame = 0;
    const tick = () => {
      setPos(meter(performance.now() - start));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start]);
  if (start === null)
    return (
      <button
        disabled={!ready}
        onClick={() => {
          setPos(0);
          setStart(performance.now());
        }}
      >
        {ready ? 'Pour tea ↗' : `Kettle warming · ${wait}s`}
      </button>
    );
  return (
    <>
      <div className="mr-meter" aria-hidden="true">
        <i className="good" />
        <i className="perfect" />
        <i className="mark" style={{ left: `${pos * 100}%` }} />
      </div>
      <button
        onClick={() => {
          const p = meter(performance.now() - start);
          setStart(null);
          onPour(Math.max(0, 1 - Math.abs(p - 0.7) / 0.3));
        }}
      >
        Stop pouring
      </button>
    </>
  );
}
function CatchGame({
  ready,
  wait,
  weather,
  onDone,
}: {
  ready: boolean;
  wait: number;
  weather: Weather;
  onDone: (caught: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<{ id: number; x: number }[]>([]);
  const [caught, setCaught] = useState(0);
  const count = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const spawn = setInterval(() => {
      const n = ++id;
      setItems((list) => [...list, { id: n, x: 5 + Math.random() * 85 }]);
      setTimeout(() => setItems((list) => list.filter((it) => it.id !== n)), 2400);
    }, 450);
    const end = setTimeout(() => {
      clearInterval(spawn);
      setRunning(false);
      setItems([]);
      done.current(count.current);
    }, 8000);
    return () => {
      clearInterval(spawn);
      clearTimeout(end);
    };
  }, [running]);
  if (!running)
    return (
      <button
        disabled={!ready}
        onClick={() => {
          count.current = 0;
          setCaught(0);
          setRunning(true);
        }}
      >
        {ready ? `Catch the ${weather} ↗` : `Resting · ${wait}s`}
      </button>
    );
  return (
    <div className={`mr-catch ${weather}`} data-testid="catch-field">
      <span className="mr-catch-count">{caught} caught</span>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="mr-catch-item"
          aria-label={`Catch a ${CATCHABLE[weather]}`}
          style={{ left: `${it.x}%` }}
          onClick={() => {
            count.current++;
            setCaught(count.current);
            setItems((list) => list.filter((x) => x.id !== it.id));
          }}
        />
      ))}
    </div>
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
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const profileHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openProfile = (target: ProfileTarget, el: HTMLElement) => {
    opener.current = el;
    setProfile(target);
  };
  const closeProfile = () => {
    setProfile(null);
    opener.current?.focus();
  };
  useEffect(() => {
    if (profile) profileHeading.current?.focus();
  }, [profile]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  useEffect(() => {
    try {
      const list: unknown = JSON.parse(localStorage.getItem(PHOTO_KEY) ?? '[]');
      if (Array.isArray(list)) setPhotos(list.filter(validPhoto).slice(0, PHOTO_CAP));
    } catch {
      /* A damaged scrapbook starts empty. */
    }
  }, []);
  const savePhotos = (list: Photo[]) => {
    setPhotos(list);
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify(list));
    } catch {
      /* The scrapbook lasts this visit only. */
    }
  };
  // The latest memorable moment; the camera suggests itself for 30 lodge seconds.
  const moment = useRef({ caption: '', until: -1 });
  const markMoment = (caption: string) => {
    moment.current = { caption, until: game.current.elapsed + 30 };
  };
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
  const announceGoals = (before: number) => {
    const g = game.current;
    const won = GOALS.filter((_, i) => g.goals & (1 << i) && !(before & (1 << i)));
    if (!won.length) return;
    setNotice(
      `Goal complete: ${won.map((w) => w.name).join(', ')}! Keepsake: ${won.map((w) => w.keepsake.toLowerCase()).join(', ')} (+${won.reduce((a, w) => a + w.tips, 0)} tips).`,
    );
    markMoment(`Goal complete: ${won[0].name}`);
    if (soundOn.current) playCue('return');
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
        if (g.event && g.event.kind !== before.event?.kind) {
          setNotice(`${EVENTS[g.event.kind].name}! ${EVENTS[g.event.kind].detail}`);
          markMoment(`${EVENTS[g.event.kind].name} at the lodge`);
          if (soundOn.current) playCue('visit');
        }
        if (rating(g) > rating(before))
          markMoment(`Juniper Lodge earns ${rating(g)} stars`);
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
            markMoment(`A postcard from ${REGULARS[g.last.regular].name}`);
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
          markMoment(
            was.kind === 'festival'
              ? `A ${season(g.elapsed)} lantern festival`
              : was.trail === 'rescue'
                ? 'The lost hiker, safe at last'
                : `Home from ${TRAILS[was.trail ?? 'juniper'].name}`,
          );
        }
        announceGoals(before.goals);
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
    const goals = game.current.goals;
    fn();
    announceGoals(goals);
    persist();
    render((n) => n + 1);
  };
  const busy = !!s.activity;
  // Number keys 1–4 set the hosts' duties; the latest render's state is always used.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (e.key === 'Escape' && profile) {
      closeProfile();
      return;
    }
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
  const weather: Weather = s.event?.kind === 'storm' ? 'rain' : WEATHER[when];
  const openRooms = SLOT.filter((i) => s.rooms[i] > 0);
  const nextRoom = GUESTS[next.guest].room;
  const arrivalRooms = [nextRoom, ...openRooms.filter((i) => i !== nextRoom)];
  const stayTarget = (i: number): ProfileTarget =>
    s.last && featuredRoom === i
      ? { seed: s.visits - 1, guest: s.last.guest, coat: s.last.coat, regular: s.last.regular, where: 'room', room: i, visit: s.visits, featured: true }
      : { seed: fillerSeed(s.visits, i), guest: filler(i), coat: s.visits + i, regular: -1, where: 'room', room: i, visit: s.visits, featured: false };
  const nextTarget = (where: 'path' | 'next'): ProfileTarget => ({
    seed: s.visits,
    guest: next.guest,
    coat: next.coat,
    regular: next.regular,
    where,
    room: nextRoom,
    visit: s.visits,
    featured: true,
  });
  const snap = () => {
    const g = game.current;
    const photo: Photo = {
      at: Date.now(),
      caption:
        g.elapsed < moment.current.until
          ? moment.current.caption
          : `A ${when} ${night ? 'night' : 'day'} at Juniper Lodge`,
      season: when,
      night,
      event: g.event?.kind ?? null,
      rooms: [...g.rooms],
      perks: [...g.perks],
      guests:
        staying && g.last
          ? openRooms.map((i) => {
              const t = stayTarget(i);
              return { room: i, coat: t.coat % COATS.length, kind: t.guest };
            })
          : [],
      hosts: busy ? [] : [hostStop(g, 'dora').room, hostStop(g, 'enzo').room],
    };
    moment.current.until = -1;
    savePhotos([photo, ...photos].slice(0, PHOTO_CAP));
    setNotice(`Snap! “${photo.caption}” is in the scrapbook.`);
  };
  const onPour = (accuracy: number) =>
    act(() => {
      const grade = pourTea(game.current, accuracy);
      if (!grade) return;
      const r = TEA_REWARDS[grade];
      setNotice(
        grade === 'perfect'
          ? `A perfect pour! +${r.tips} tips and +${r.hearts} hearts.`
          : grade === 'good'
            ? `A lovely cup. +${r.tips} tips and +${r.hearts} heart.`
            : `Oops, a little spill. +${r.tips} tips for trying.`,
      );
      if (grade === 'perfect') markMoment('A perfect cup of tea');
    });
  const onCatch = (caught: number) =>
    act(() => {
      const tips = catchReward(game.current, caught);
      if (tips !== null) setNotice(`You caught ${caught}! +${tips} tips.`);
    });
  const pid = profile ? guestIdentity(profile.seed, profile.guest, profile.regular) : null;
  const treatRoom =
    profile && profile.where === 'room' && profile.visit === s.visits && staying
      ? profile.room
      : -1;
  const profileStatus = (p: ProfileTarget) => {
    const room = p.room >= 0 ? ROOMS[p.room].name : '';
    const fresh = p.visit === s.visits;
    switch (p.where) {
      case 'room':
        return !fresh || !staying
          ? 'Has checked out. Safe travels!'
          : p.featured && s.last
            ? `Staying in the ${room}. ${s.last.outcome === 'happy' ? 'Their wish was granted ♥' : 'Their wish went unmet this time.'}`
            : `Staying in the ${room}.`;
      case 'path':
      case 'next':
        return fresh
          ? `On the way up, hoping for ${wishText(p.guest)}.`
          : s.visits === p.visit + 1 && s.last && s.last.outcome !== 'away'
            ? `Checked in to the ${room}.`
            : 'Has moved on.';
      case 'roof':
        return 'Counting stars on the roof tonight.';
      case 'viscacha':
        return 'Sunning on the mountainside. Spotted after summit trips.';
      case 'leaving':
        return 'Turned away with no supplies to spare. Maybe next time.';
      case 'musician':
        return 'Playing the charango by the door for anyone who will listen.';
      default:
        return s.rooms[p.room]
          ? 'Drops by on every fifth visit.'
          : `Will visit once the ${room} opens.`;
    }
  };
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
            Click any guest to see their profile, and offer the guest in a room
            an oat cake or herbal soap once per visit. Lodge goals pay tips and
            leave keepsakes. Every few minutes a surprise may arrive: a storm, a
            travelling musician, or a lost hiker to rescue. Pour tea and catch
            the weather for a few bonus tips, and snap photos for the scrapbook.
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
              <span data-testid="lodge-title">{lodgeTitle(s).toUpperCase()}</span> ·{' '}
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
            className={`mr-landscape season-${when}${night ? ' night' : ''}${busy ? ' away' : ''}${s.event?.kind === 'storm' ? ' storm' : ''}`}
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
            <div className={`mr-weather ${weather}`} aria-hidden="true">
              {Array.from({ length: weather === 'butterflies' ? 5 : 12 }, (_, n) => (
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
              <div className="mr-viscacha" data-testid="viscacha">
                <GuestButton
                  target={{ seed: 300000 + s.expeditions, guest: VISCACHA, coat: 0, regular: -1, where: 'viscacha', room: -1, visit: s.visits, featured: false }}
                  onOpen={openProfile}
                >
                  <Visitor coat={0} kind={VISCACHA} />
                </GuestButton>
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
                <div className="mr-roof-guest">
                  <GuestButton
                    target={{ seed: 200000 + Math.floor(s.elapsed / DAY_SECONDS), guest: 2, coat: Math.floor(s.elapsed / DAY_SECONDS) % COATS.length, regular: -1, where: 'roof', room: 2, visit: s.visits, featured: false }}
                    onOpen={openProfile}
                  >
                    <Visitor coat={Math.floor(s.elapsed / DAY_SECONDS)} kind={2} />
                  </GuestButton>
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
                            <GuestButton target={stayTarget(i)} onOpen={openProfile}>
                              <Visitor
                                coat={
                                  featuredRoom === i
                                    ? s.last.coat
                                    : s.visits + i
                                }
                                kind={featuredRoom === i ? s.last.guest : filler(i)}
                              />
                            </GuestButton>
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
              {s.goals > 0 && (
                <div className="mr-keepsakes" data-testid="keepsakes" aria-hidden="true">
                  {GOALS.map((g, i) =>
                    s.goals & (1 << i) ? (
                      <i key={g.name} title={g.keepsake}>
                        {KEEPSAKE_ICON[i]}
                      </i>
                    ) : null,
                  )}
                </div>
              )}
              <div className="mr-foundation">
                EST. TODAY · STAY A LITTLE LONGER
              </div>
            </div>
            <div className="mr-path" />
            {arriving && (
              <div
                className="mr-arrivals"
                key={Math.floor(s.elapsed / period)}
              >
                {arrivalRooms.map((room, n) => (
                  <span
                    key={room}
                    className={n === 0 ? 'featured' : undefined}
                    style={{ '--n': n } as React.CSSProperties}
                  >
                    <GuestButton
                      target={
                        n === 0
                          ? nextTarget('path')
                          : { seed: fillerSeed(s.visits + 1, room), guest: filler(room + 1), coat: s.visits + 1 + room, regular: -1, where: 'path', room, visit: s.visits, featured: false }
                      }
                      onOpen={openProfile}
                    >
                      <Visitor
                        coat={n === 0 ? next.coat : s.visits + 1 + room}
                        kind={n === 0 ? next.guest : filler(room + 1)}
                      />
                    </GuestButton>
                    {n === 0 && (
                      <b className="mr-wish-bubble" aria-hidden="true">
                        {wishIcon(next.guest)}
                      </b>
                    )}
                    {n === 0 && next.regular >= 0 && (
                      <b className="mr-nametag" aria-hidden="true">
                        {REGULARS[next.regular].name}
                      </b>
                    )}
                  </span>
                ))}
              </div>
            )}
            {turnedAway && s.last && (
              <div className="mr-sad" key={s.visits}>
                <GuestButton
                  target={{ seed: s.visits - 1, guest: s.last.guest, coat: s.last.coat, regular: s.last.regular, where: 'leaving', room: GUESTS[s.last.guest].room, visit: s.visits, featured: true }}
                  onOpen={openProfile}
                >
                  <Visitor coat={s.last.coat} kind={s.last.guest} />
                </GuestButton>
                <b aria-hidden="true">…</b>
              </div>
            )}
            {s.event?.kind === 'musician' && !busy && (
              <div className="mr-musician" data-testid="musician">
                <GuestButton
                  target={{ seed: 400000 + Math.floor(s.elapsed / EVENT_EVERY), guest: 0, coat: 3, regular: -1, where: 'musician', room: -1, visit: s.visits, featured: false }}
                  onOpen={openProfile}
                >
                  <Visitor coat={3} kind={0} />
                </GuestButton>
                <b className="mr-notes" aria-hidden="true">
                  ♪ ♫
                </b>
              </div>
            )}
            {s.event?.kind === 'lost' && (
              <b className="mr-lost-signal" aria-hidden="true">
                !
              </b>
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
                    : s.activity?.trail === 'rescue'
                      ? 'Rescuing a lost hiker'
                      : `Exploring ${TRAILS[s.activity?.trail ?? 'juniper'].name}`}
                </span>
              </div>
            )}
          </div>
          {profile && pid && (
            // Non-modal: the lodge keeps running behind the open profile.
            <dialog
              open
              className="mr-profile"
              aria-labelledby="mr-profile-name"
              data-testid="guest-profile"
            >
              <div className="mr-profile-portrait" aria-hidden="true">
                <Visitor coat={profile.coat} kind={profile.guest} />
              </div>
              <div className="mr-profile-body">
                <h3 id="mr-profile-name" tabIndex={-1} ref={profileHeading}>
                  {pid.name} <span>{GUESTS[profile.guest].name.toUpperCase()}</span>
                </h3>
                <p className="mr-profile-meta">
                  {COAT_NAMES[profile.coat % COAT_NAMES.length]} coat · from {pid.home}
                  {profile.regular >= 0 ? ' · a regular' : ''}
                </p>
                <p className="mr-profile-bio">“{pid.bio}”</p>
                <p data-testid="profile-status">{profileStatus(profile)}</p>
                {profile.guest !== VISCACHA && (
                  <p>
                    {profile.featured || profile.regular >= 0
                      ? `Hopes for ${wishText(profile.guest)}.`
                      : `Favourite room: the ${ROOMS[GUESTS[profile.guest].room].name}.`}
                  </p>
                )}
                {profile.regular >= 0 && (
                  <p>
                    Friendship {s.friends[profile.regular]} / {FRIENDSHIP_CAP} ·{' '}
                    {POSTCARDS.filter((p) => s.friends[profile.regular] >= p.at).length}{' '}
                    postcards
                  </p>
                )}
                <p>
                  {s.album[profile.guest] & (1 << (profile.coat % COAT_NAMES.length))
                    ? '✧ This coat is in your album.'
                    : 'Not in your album yet.'}
                </p>
                {treatRoom >= 0 && (
                  <div className="mr-treats">
                    {(['oatcake', 'soap'] as const).map((item) => (
                      <button
                        key={item}
                        disabled={!canTreat(s, treatRoom) || s.pantry[item] < 1}
                        onClick={() =>
                          act(() => {
                            if (offerTreat(game.current, treatRoom, item))
                              setNotice(
                                `${pid.name} loved the ${ITEMS[item].name}! +${TREAT.hearts} hearts.`,
                              );
                          })
                        }
                      >
                        Offer {ITEMS[item].name} {ITEM_ICON[item]}
                        <small>
                          {s.pantry[item]} in the pantry · +{TREAT.hearts} ♥
                        </small>
                      </button>
                    ))}
                    {!canTreat(s, treatRoom) && <p>Already spoiled this visit.</p>}
                  </div>
                )}
                <button className="mr-profile-close" onClick={closeProfile}>
                  Close profile
                </button>
              </div>
            </dialog>
          )}
          <div className="mr-scene-foot">
            <span>Two friends. One shared dream.</span>
            <button
              className={`mr-snap${s.elapsed < moment.current.until ? ' suggest' : ''}`}
              data-testid="snap"
              onClick={snap}
            >
              ◉ Snap a photo
            </button>
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
          {s.event && (
            <article
              className={`mr-event ${s.event.kind}`}
              data-testid="event"
              aria-live="polite"
            >
              <h3>
                {EVENTS[s.event.kind].name} <span>{s.event.remaining}s left</span>
              </h3>
              <p>{EVENTS[s.event.kind].detail}</p>
              {s.event.kind === 'lost' && (
                <button
                  disabled={
                    !ready ||
                    busy ||
                    !!trailClosed(s, 'rescue') ||
                    s.supplies < TRAILS.rescue.cost
                  }
                  onClick={() =>
                    act(() => {
                      if (startActivity(game.current, 'expedition', 'rescue'))
                        setNotice(TRAIL_COPY.rescue.start);
                    })
                  }
                >
                  {TRAIL_COPY.rescue.button}
                  <small>
                    {activitySeconds(s, 'expedition', 'rescue')}s · costs{' '}
                    {TRAILS.rescue.cost} supplies · +{TRAILS.rescue.tips} tips, +8
                    reputation
                  </small>
                </button>
              )}
            </article>
          )}
          <article
            className={`mr-guest-book ${grantable ? 'ok' : 'warn'}`}
            data-testid="next-guest"
            aria-live="polite"
          >
            <span
              className="mr-ring"
              data-testid="visit-ring"
              style={{ '--p': ring } as React.CSSProperties}
            >
              <GuestButton target={nextTarget('next')} onOpen={openProfile}>
                <Visitor coat={next.coat} kind={next.guest} />
              </GuestButton>
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
      <section className="mr-games" aria-labelledby="mr-games-title">
        <div className="mr-section-title">
          <span>LITTLE PLEASURES</span>
          <h2 id="mr-games-title">A moment for yourself.</h2>
          <p>
            Quick optional bonuses. They pause during outings and rest between
            rounds in lodge time.
          </p>
        </div>
        <div className="mr-game-grid">
          <article>
            <h3>Pour the perfect cup</h3>
            <p>
              Stop the pour in the gold band. Perfect: +{TEA_REWARDS.perfect.tips}{' '}
              tips and +{TEA_REWARDS.perfect.hearts} ♥ · good: +
              {TEA_REWARDS.good.tips} · spill: +{TEA_REWARDS.spill.tips}. Once every{' '}
              {TEA_COOLDOWN} lodge seconds.
            </p>
            <TeaGame
              ready={ready && teaReady(s)}
              wait={Math.max(0, s.teaReadyAt - s.elapsed)}
              onPour={onPour}
            />
          </article>
          <article>
            <h3>Catch the {weather}</h3>
            <p>
              Tap as many as you can in 8 seconds: +1 tip each, up to {CATCH_CAP}.
              Once every {CATCH_COOLDOWN} lodge seconds.
            </p>
            <CatchGame
              ready={ready && catchReady(s)}
              wait={Math.max(0, s.catchReadyAt - s.elapsed)}
              weather={weather}
              onDone={onCatch}
            />
          </article>
        </div>
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
                <GuestButton
                  target={{ seed: -1 - i, guest: r.guest, coat: r.coat, regular: i, where: 'album', room: GUESTS[r.guest].room, visit: s.visits, featured: false }}
                  onOpen={openProfile}
                >
                  <Visitor coat={r.coat} kind={r.guest} />
                </GuestButton>
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
      <section className="mr-goals" aria-labelledby="mr-goals-title">
        <div className="mr-section-title">
          <span>
            LODGE GOALS · {GOALS.filter((_, i) => s.goals & (1 << i)).length} /{' '}
            {GOALS.length} · {lodgeTitle(s).toUpperCase()}
          </span>
          <h2 id="mr-goals-title">Something to aim for.</h2>
          <p>
            Each goal pays tips once and leaves a keepsake by the lodge. Meet more
            goals to raise the lodge’s title.
          </p>
        </div>
        <ol className="mr-goal-list">
          {GOALS.map((g, i) => {
            const met = (s.goals & (1 << i)) > 0;
            return (
              <li key={g.name} className={met ? 'done' : ''} data-testid={`goal-${i}`}>
                <b aria-hidden="true">{met ? KEEPSAKE_ICON[i] : '?'}</b>
                <div>
                  <h3>
                    {met ? '✓ ' : ''}
                    {g.name}
                  </h3>
                  <p>
                    {g.detail} · +{g.tips} tips · {met ? g.keepsake : 'a keepsake'}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="mr-scrapbook" aria-labelledby="mr-scrapbook-title">
        <div className="mr-section-title">
          <span>
            SCRAPBOOK · {photos.length} / {PHOTO_CAP} PHOTOS
          </span>
          <h2 id="mr-scrapbook-title">Moments worth keeping.</h2>
          <p>
            Use ◉ Snap a photo under the lodge. It glows after a memorable
            moment. The newest {PHOTO_CAP} photos are kept on this device.
          </p>
        </div>
        {photos.length ? (
          <div className="mr-photo-grid">
            {photos.map((photo, n) => (
              <figure key={photo.at + '-' + n} className="mr-photo" data-testid="photo">
                <PhotoScene photo={photo} />
                <figcaption>
                  <input
                    aria-label="Photo caption"
                    maxLength={120}
                    value={photo.caption}
                    onChange={(e) =>
                      savePhotos(
                        photos.map((p, m) =>
                          m === n ? { ...p, caption: e.target.value } : p,
                        ),
                      )
                    }
                  />
                  <small>
                    {new Date(photo.at).toLocaleDateString()} · {photo.season}
                    {photo.night ? ' night' : ''}
                  </small>
                  <button onClick={() => savePhotos(photos.filter((_, m) => m !== n))}>
                    Remove photo
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="mr-empty">No photos yet.</p>
        )}
      </section>
      <footer className="mr-footer">
        <span>{storage}</span>
        <span>5–10 minute visits · 8-hour offline cap · no accounts</span>
      </footer>
    </main>
  );
}
