/**
 * Numbers for the stats view. Pure functions over the songs and their hearing
 * estimates, so they are testable. No network calls.
 */
import { parsePartialDate } from './dates';
import type { SongWithEstimate, TimelineGroup } from './estimate';
import { genreInfo, type GenreFamily } from './genres';
import { normalise } from './musicbrainz';
import { fractionalYear, songGenre } from './road';

export interface GenreSlice {
  /** A genre family, or `other` for the small genres together, or `unknown`. */
  id: GenreFamily | 'other' | 'unknown';
  label: string;
  count: number;
  share: number;
}

/**
 * Songs per genre, largest first. Keeps at most `maxSlices` slices: the
 * smallest genres go into one "Other" slice. Songs with no genre are "Not known".
 */
export function genreBreakdown(items: SongWithEstimate[], maxSlices = 6): GenreSlice[] {
  const total = items.length;
  if (!total) return [];
  const counts = new Map<GenreFamily, number>();
  let unknown = 0;
  for (const i of items) {
    const g = songGenre(i.song);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    else unknown += 1;
  }
  const known = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const room = maxSlices - (unknown ? 1 : 0);
  const shown = known.length > room ? known.slice(0, room - 1) : known;
  const rest = known.slice(shown.length).reduce((n, [, c]) => n + c, 0);

  const slices: GenreSlice[] = shown.map(([id, count]) => ({ id, label: genreInfo(id)!.label, count, share: count / total }));
  if (rest) slices.push({ id: 'other', label: 'Other genres', count: rest, share: rest / total });
  if (unknown) slices.push({ id: 'unknown', label: 'Not known', count: unknown, share: unknown / total });
  return slices;
}

export interface Bar {
  label: string;
  count: number;
}

/** Songs per release decade, in date order. Songs with no release date are left out. */
export function releaseDecades(items: SongWithEstimate[]): Bar[] {
  const counts = new Map<number, number>();
  for (const i of items) {
    const d = parsePartialDate(i.song.releaseDate);
    if (!d) continue;
    const decade = Math.floor(d.getUTCFullYear() / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([decade, count]) => ({ label: `${decade}s`, count }));
}

/** Songs per life period, in the order of the timeline. Songs outside all periods come last. */
export function songsPerPeriod(groups: TimelineGroup[]): Bar[] {
  return groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({ label: g.period?.name ?? 'Other times', count: g.items.length }));
}

/** Years from the release to the likely first hearing. Never less than 0. */
function waitYears(item: SongWithEstimate): number | undefined {
  const released = parsePartialDate(item.song.releaseDate);
  if (!released) return undefined;
  return Math.max(0, fractionalYear(item.estimate.likely) - fractionalYear(released));
}

export interface SongFact {
  item: SongWithEstimate;
  /** A short line, for example "1968" or "37 years after release". */
  detail: string;
}

export interface Highlights {
  songs: number;
  artists: number;
  /** The median wait from release to first hearing, in years. */
  medianWait?: number;
  /** The share of songs first heard within one year of release. */
  heardNewShare?: number;
  oldest?: SongFact;
  newest?: SongFact;
  longestWait?: SongFact;
  topArtist?: { name: string; count: number };
  busiestYear?: { year: number; count: number };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function highlights(items: SongWithEstimate[]): Highlights {
  const artists = new Map<string, { name: string; count: number }>();
  for (const i of items) {
    const key = normalise(i.song.artist);
    const a = artists.get(key) ?? { name: i.song.artist, count: 0 };
    a.count += 1;
    artists.set(key, a);
  }

  const dated = items
    .map((item) => ({ item, released: parsePartialDate(item.song.releaseDate), wait: waitYears(item) }))
    .filter((d): d is { item: SongWithEstimate; released: Date; wait: number } => !!d.released && d.wait !== undefined);
  const byRelease = [...dated].sort((a, b) => a.released.getTime() - b.released.getTime());
  const waits = dated.map((d) => d.wait).sort((a, b) => a - b);
  const median = waits.length
    ? waits.length % 2
      ? waits[(waits.length - 1) / 2]
      : (waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2
    : undefined;
  const longest = dated.reduce<(typeof dated)[number] | undefined>((best, d) => (!best || d.wait > best.wait ? d : best), undefined);

  const years = new Map<number, number>();
  for (const i of items) {
    const y = i.estimate.likely.getUTCFullYear();
    years.set(y, (years.get(y) ?? 0) + 1);
  }
  const busiest = [...years.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const top = [...artists.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0];

  return {
    songs: items.length,
    artists: artists.size,
    medianWait: median,
    heardNewShare: dated.length ? dated.filter((d) => d.wait <= 1).length / dated.length : undefined,
    oldest: byRelease[0] && { item: byRelease[0].item, detail: String(byRelease[0].released.getUTCFullYear()) },
    newest: byRelease.length > 1 ? { item: byRelease.at(-1)!.item, detail: String(byRelease.at(-1)!.released.getUTCFullYear()) } : undefined,
    longestWait:
      longest && longest.wait >= 2
        ? { item: longest.item, detail: `${plural(Math.round(longest.wait), 'year')} after release` }
        : undefined,
    topArtist: top && top.count > 1 ? top : undefined,
    busiestYear: busiest && busiest[1] > 1 ? { year: busiest[0], count: busiest[1] } : undefined,
  };
}
