import { useMemo, useState } from 'react';
import { formatRange, parsePartialDate } from '../dates';
import type { SongWithEstimate } from '../estimate';
import { searchPeriods, searchTimeline } from '../search';
import type { LifePeriod } from '../types';

/** Searches the timeline. A click on a result shows that song on the timeline. */
export function SearchPanel({
  items,
  periods,
  onPick,
  onPickPeriod,
}: {
  items: SongWithEstimate[];
  periods: LifePeriod[];
  onPick: (id: number) => void;
  onPickPeriod: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTimeline(items, periods, query), [items, periods, query]);
  const periodHits = useMemo(() => searchPeriods(periods, query), [periods, query]);

  return (
    <div className="stack-4">
      <input
        className="tm-input"
        type="search"
        aria-label="Search the timeline"
        placeholder="Song, artist, album, genre or life period"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          if (periodHits[0]) onPickPeriod(periodHits[0].id!);
          else if (results[0]) onPick(results[0].song.id!);
        }}
        autoFocus
      />
      {query.trim() && results.length === 0 && periodHits.length === 0 && <p className="modal__fine">Nothing on your timeline matches.</p>}
      {periodHits.length > 0 && (
        <ul className="ruled-list bundle-list">
          {periodHits.map((p) => (
            <li key={p.id}>
              <button className="bundle-list__song" onClick={() => onPickPeriod(p.id!)}>
                <span className="ruled-list__title">
                  {p.name}
                  {p.place && <span className="ruled-list__muted"> · {p.place}</span>}
                </span>
                <span className="ruled-list__muted">
                  Life period · {formatRange(parsePartialDate(p.start)!, parsePartialDate(p.end)!)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length > 0 && (
        <ul className="ruled-list bundle-list">
          {results.map(({ song, estimate }) => (
            <li key={song.id}>
              <button className="bundle-list__song" onClick={() => onPick(song.id!)}>
                <span className="ruled-list__title">{song.title}</span>
                <span className="ruled-list__muted">
                  {song.artist} · {formatRange(estimate.from, estimate.to)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
