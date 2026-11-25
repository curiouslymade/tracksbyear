import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './db';
import { buildTimeline, sortPeriods } from './estimate';
import { todayUtc } from './dates';
import { AddSong } from './components/AddSong';
import { BundleList } from './components/BundleList';
import { Modal } from './components/Modal';
import { SharePanel } from './components/SharePanel';
import { Dock } from './components/Dock';
import { DEFAULT_ZOOM, ZOOM_LEVELS } from './road';
import { LifePeriods } from './components/LifePeriods';
import { Road } from './components/Road';
import { SearchPanel } from './components/SearchPanel';
import { Settings, type Theme } from './components/Settings';
import { Stats } from './components/Stats';
import type { Player } from './listen';
import { decodeShare, fromShare, shareInLocation } from './share';
import type { LifePeriod, Song } from './types';
import { DeleteSongButton, PlaySongButton, SongDetails } from './components/SongDetails';

type View = { kind: 'add' } | { kind: 'periods' } | { kind: 'share' } | { kind: 'stats' } | { kind: 'search' } | { kind: 'settings' } | { kind: 'song'; id: number } | { kind: 'bundle'; ids: number[]; year: number };

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private windows can block storage. The setting then resets on reload. */
  }
}

const HEADLINE = 'Tracks by(ear)';

/** The saved zoom step, or the normal step. */
function readZoom(): number {
  const n = Number(readSetting('zoom') ?? NaN);
  return Number.isInteger(n) && n >= 0 && n < ZOOM_LEVELS.length ? n : DEFAULT_ZOOM;
}

/** A timeline from a share link: kept in memory, never saved. */
type Shared = { songs: Song[]; periods: LifePeriod[] } | 'broken';

/** Reads a share link in the address, and again when the address changes. */
function useShared(): [Shared | undefined, boolean, () => void] {
  const [shared, setShared] = useState<Shared>();
  const [checked, setChecked] = useState(!shareInLocation());
  useEffect(() => {
    const read = () => {
      const code = shareInLocation();
      if (!code) {
        setShared(undefined);
        setChecked(true);
        return;
      }
      decodeShare(code)
        .then((data) => setShared(fromShare(data)))
        .catch(() => setShared('broken'))
        .finally(() => setChecked(true));
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const leave = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setShared(undefined);
  };
  return [shared, checked, leave];
}

/** The saved choice, or else the light or dark mode of the device. */
function readTheme(): Theme {
  const saved = readSetting('theme');
  if (saved === 'night' || saved === 'day') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

export function App() {
  const ownPeriods = useLiveQuery(() => db.periods.toArray(), []);
  const ownSongs = useLiveQuery(() => db.songs.toArray(), []);
  const [shared, shareChecked, leaveShared] = useShared();
  const viewing = shared && shared !== 'broken' ? shared : undefined;
  const periods = viewing ? viewing.periods : ownPeriods;
  const songs = viewing ? viewing.songs : ownSongs;
  const [view, setView] = useState<View>();
  const [focus, setFocus] = useState<{ id: number; n: number; kind?: 'song' | 'period' }>();
  const header = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderH(el.getBoundingClientRect().bottom));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [showMoments, setShowMoments] = useState(() => readSetting('moments') !== 'hide');
  const [player, setPlayer] = useState<Player>(() => (readSetting('player') === 'apple' ? 'apple' : 'spotify'));

  const [zoom, setZoom] = useState(readZoom);
  // Below this step the timeline already fits the screen, so zooming out changes nothing.
  const [lowestZoom, setLowestZoom] = useState(0);
  const shownZoom = Math.max(zoom, lowestZoom);

  useEffect(() => saveSetting('player', player), [player]);

  useEffect(() => saveSetting('zoom', String(zoom)), [zoom]);

  useEffect(() => saveSetting('moments', showMoments ? 'show' : 'hide'), [showMoments]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Private windows can block storage. The theme then resets on reload. */
    }
  }, [theme]);

  const today = useMemo(() => todayUtc(), []);
  const sortedPeriods = useMemo(() => sortPeriods(periods ?? []), [periods]);
  const groups = useMemo(() => buildTimeline(songs ?? [], sortedPeriods, today), [songs, sortedPeriods, today]);
  const items = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  if (!periods || !songs || !shareChecked) return null;

  const selected = view?.kind === 'song' ? items.find((i) => i.song.id === view.id) : undefined;
  const close = () => setView(undefined);
  const hasTimeline = items.length > 0 || periods.length > 0;

  return (
    <div className="page">
      <header className="top" ref={header}>
        {viewing && <p className="top__kicker">A shared timeline</p>}
        <h1 className="top__title">{HEADLINE}</h1>
        {shared && (
          <p className="top__shared">
            {shared === 'broken' ? 'This share link does not work. It may be cut short. ' : 'You are looking at someone else’s timeline. '}
            <button className="tm-btn tm-btn--quiet tm-btn--sm" onClick={leaveShared}>
              {shared === 'broken' ? 'Open my timeline' : 'Make your own'}
            </button>
          </p>
        )}
      </header>


      <main>
        {!hasTimeline ? (
          <section className="empty">
            <h2 className="empty__title">Your timeline is empty</h2>
            <p className="empty__text">
              Add the times of your life, then the songs you remember. Use the buttons at the bottom of the page.
            </p>
          </section>
        ) : (
          <Road
            items={items}
            periods={sortedPeriods}
            selectedId={view?.kind === 'song' ? view.id : undefined}
            showMoments={showMoments}
            player={player}
            readOnly={!!viewing}
            topClear={headerH}
            focus={focus}
            zoom={shownZoom}
            onLowestZoom={setLowestZoom}
            onSelect={(id) => setView({ kind: 'song', id })}
            onOpenBundle={(ids, year) => setView({ kind: 'bundle', ids, year })}
          />
        )}
      </main>

      <p className="counts">
        {songs.length} song{songs.length === 1 ? '' : 's'} · {periods.length} life period{periods.length === 1 ? '' : 's'}
      </p>

      <Dock
        current={view?.kind}
        onOpen={(kind) => setView(view?.kind === kind ? undefined : { kind })}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'day' ? 'night' : 'day'))}
        only={viewing ? ['stats', 'search'] : undefined}
        zoom={
          hasTimeline
            ? {
                canOut: shownZoom > lowestZoom,
                canIn: shownZoom < ZOOM_LEVELS.length - 1,
                onZoom: (d) => setZoom(Math.max(lowestZoom, Math.min(ZOOM_LEVELS.length - 1, shownZoom + d))),
              }
            : undefined
        }
      />

      {view?.kind === 'add' && (
        <Modal key="add" title="Add a song" onClose={close}>
          <AddSong periods={sortedPeriods} />
        </Modal>
      )}
      {view?.kind === 'periods' && (
        <Modal key="periods" title="Life periods" onClose={close}>
          <LifePeriods periods={sortedPeriods} />
        </Modal>
      )}
      {view?.kind === 'share' && !viewing && (
        <Modal key="share" title="Share" onClose={close}>
          <SharePanel items={items} groups={groups} periods={sortedPeriods} title={HEADLINE} theme={theme} />
        </Modal>
      )}
      {view?.kind === 'stats' && (
        <Modal key="stats" title={viewing ? 'Their breakdown' : 'Your breakdown'} wide onClose={close}>
          <Stats items={items} groups={groups} />
        </Modal>
      )}
      {view?.kind === 'settings' && (
        <Modal key="settings" title="Settings" onClose={close}>
          <Settings
            showMoments={showMoments}
            onShowMoments={setShowMoments}
            player={player}
            onPlayer={setPlayer}
            onStartedAgain={close}
          />
        </Modal>
      )}
      {view?.kind === 'search' && (
        <Modal key="search" title="Search" onClose={close}>
          <SearchPanel
            items={items}
            periods={sortedPeriods}
            onPick={(id) => {
              setView(undefined);
              setFocus((f) => ({ id, n: (f?.n ?? 0) + 1, kind: 'song' }));
            }}
            onPickPeriod={(id) => {
              setView(undefined);
              setFocus((f) => ({ id, n: (f?.n ?? 0) + 1, kind: 'period' }));
            }}
          />
        </Modal>
      )}
      {view?.kind === 'bundle' && (
        <Modal key="bundle" title={`${view.ids.length} songs around ${view.year}`} onClose={close}>
          <BundleList
            items={items.filter((i) => view.ids.includes(i.song.id!))}
            player={player}
            readOnly={!!viewing}
            onSelect={(id) => setView({ kind: 'song', id })}
          />
        </Modal>
      )}
      {selected && !viewing && (
        <Modal key={`song-${selected.song.id}`} kicker={selected.song.artist} title={selected.song.title}
          titleAside={<PlaySongButton song={selected.song} player={player} />}
          actions={<DeleteSongButton song={selected.song} onDeleted={close} />}
          onClose={close}
        >
          <SongDetails item={selected} periods={sortedPeriods} />
        </Modal>
      )}
    </div>
  );
}
