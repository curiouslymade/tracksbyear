import { useMemo, useState } from 'react';
import type { SongWithEstimate, TimelineGroup } from '../estimate';
import { genreBreakdown, highlights, releaseDecades, songsPerPeriod, type Bar, type GenreSlice, type SongFact } from '../stats';

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** The breakdown: headline numbers, genres, release decades, life periods and highlights. */
export function Stats({ items, groups }: { items: SongWithEstimate[]; groups: TimelineGroup[] }) {
  const slices = useMemo(() => genreBreakdown(items), [items]);
  const decades = useMemo(() => releaseDecades(items), [items]);
  const perPeriod = useMemo(() => songsPerPeriod(groups), [groups]);
  const h = useMemo(() => highlights(items), [items]);

  if (!items.length) return <p className="modal__lead">Add some songs to see your breakdown.</p>;

  // Three highlights at most, in this order of interest.
  // A song shows once only: if the oldest song is also the longest wait, the next highlight takes its place.
  const used = new Set<number>();
  const songFact = (label: string, f?: SongFact) => {
    if (!f || used.has(f.item.song.id!)) return undefined;
    used.add(f.item.song.id!);
    return { label, main: f.item.song.title, sub: `${f.item.song.artist} · ${f.detail}` };
  };
  const facts = [
    songFact('Oldest song', h.oldest),
    songFact('Longest wait', h.longestWait),
    h.topArtist && { label: 'Most added artist', main: h.topArtist.name, sub: `${h.topArtist.count} songs` },
    h.busiestYear && { label: 'Busiest year', main: String(h.busiestYear.year), sub: `${h.busiestYear.count} songs first heard` },
    songFact('Newest song', h.newest),
  ]
    .filter((f): f is { label: string; main: string; sub: string } => !!f)
    .slice(0, 3);

  return (
    <div className="stats">
      <div className="stat-tiles">
        <Tile value={String(h.songs)} label={h.songs === 1 ? 'song' : 'songs'} />
        <Tile value={String(h.artists)} label={h.artists === 1 ? 'artist' : 'artists'} />
        {h.medianWait !== undefined && (
          <Tile value={formatYears(h.medianWait)} label="typical wait from release to first listen" />
        )}
        {h.heardNewShare !== undefined && <Tile value={pct(h.heardNewShare)} label="heard within a year of release" />}
      </div>

      <div className="stats__grid">
        <section className="stats__section stats__genres" aria-labelledby="stats-genres">
          <h3 id="stats-genres" className="modal__subhead">
            Genres
          </h3>
          <GenreDonut slices={slices} total={items.length} />
        </section>
        {decades.length > 0 && <BarList id="stats-decades" title="Release decades" bars={decades} />}
        {perPeriod.length > 0 && <BarList id="stats-periods" title="Life periods" bars={perPeriod} />}
      </div>

      <section className="stats__section" aria-labelledby="stats-highlights">
        <h3 id="stats-highlights" className="modal__subhead">
          Highlights
        </h3>
        <dl className="facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>
                <span className="facts__main">{f.main}</span>
                <span className="facts__sub">{f.sub}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function formatYears(y: number): string {
  const months = Math.round(y * 12);
  if (months < 12) return `${Math.max(1, months)} mo`;
  const years = y < 10 ? Math.round(y * 10) / 10 : Math.round(y);
  return `${years} yr${years === 1 ? '' : 's'}`;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}

/** The colour of a slice: chart slots for genres in rank order, neutral greys for "Other" and "Not known". */
function sliceColour(s: GenreSlice, genreIndex: number): string {
  if (s.id === 'other') return 'var(--chart-other)';
  if (s.id === 'unknown') return 'var(--chart-unknown)';
  return `var(--chart-${genreIndex + 1})`;
}

const R_OUT = 92;
const R_IN = 60;
const C = 100;

function sector(a0: number, a1: number): string {
  const p = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(R_OUT, a0)} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${p(R_OUT, a1)} L ${p(R_IN, a1)} A ${R_IN} ${R_IN} 0 ${large} 0 ${p(R_IN, a0)} Z`;
}

/** A donut of the genres, with a legend that doubles as the table of numbers. Hover a slice or a row for its figures. */
function GenreDonut({ slices, total }: { slices: GenreSlice[]; total: number }) {
  const [active, setActive] = useState<string>();
  let genreIndex = 0;
  const coloured = slices.map((s) => ({ ...s, colour: sliceColour(s, s.id === 'other' || s.id === 'unknown' ? 0 : genreIndex++) }));
  let angle = -Math.PI / 2;
  const arcs = coloured.map((s) => {
    const a0 = angle;
    angle += s.share * Math.PI * 2;
    return { ...s, a0, a1: angle };
  });
  const shown = coloured.find((s) => s.id === active);

  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" className="donut__chart" role="img" aria-label={`Genres: ${slices.map((s) => `${s.label} ${pct(s.share)}`).join(', ')}`}>
        {arcs.length === 1 ? (
          <circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} fill="none" stroke={arcs[0].colour} strokeWidth={R_OUT - R_IN} />
        ) : (
          arcs.map((s) => (
            <path
              key={s.id}
              d={sector(s.a0, s.a1)}
              fill={s.colour}
              className="donut__slice"
              data-dim={active !== undefined && active !== s.id}
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(undefined)}
            />
          ))
        )}
        <text x={C} y={C - 4} textAnchor="middle" className="donut__value">
          {shown ? pct(shown.share) : total}
        </text>
        <text x={C} y={C + 16} textAnchor="middle" className="donut__label">
          {shown ? `${shown.count} ${shown.count === 1 ? 'song' : 'songs'}` : total === 1 ? 'song' : 'songs'}
        </text>
      </svg>
      <ul className="donut__legend">
        {coloured.map((s) => (
          <li
            key={s.id}
            data-dim={active !== undefined && active !== s.id}
            onMouseEnter={() => setActive(s.id)}
            onMouseLeave={() => setActive(undefined)}
          >
            <span className="donut__swatch" style={{ background: s.colour }} />
            <span className="donut__name">{s.label}</span>
            <span className="donut__count">{s.count}</span>
            <span className="donut__share">{pct(s.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars on one baseline, in one colour, with the count at the end of each bar. */
function BarList({ id, title, bars }: { id: string; title: string; bars: Bar[] }) {
  const max = Math.max(...bars.map((b) => b.count));
  return (
    <section className="stats__section" aria-labelledby={id}>
      <h3 id={id} className="modal__subhead">
        {title}
      </h3>
      <ul className="bars">
        {bars.map((b) => (
          <li key={b.label} title={`${b.label}: ${b.count} ${b.count === 1 ? 'song' : 'songs'}`}>
            <span className="bars__label">{b.label}</span>
            <span className="bars__track">
              <span className="bars__bar" style={{ width: `${(b.count / max) * 100}%` }} />
            </span>
            <span className="bars__count">{b.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
