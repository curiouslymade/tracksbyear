/**
 * Searches the timeline. Every word must appear in the title, the artist, the
 * album or the genre of a song, or in the name or place of a life period that the
 * song sits in. Case and accents do not matter. Title matches come first.
 * `searchPeriods` finds the life periods themselves.
 */
import { endOfDay, parsePartialDate } from './dates';
import type { SongWithEstimate } from './estimate';
import { genreInfo } from './genres';
import { normalise } from './musicbrainz';
import { songGenre } from './road';
import type { LifePeriod } from './types';

export function searchTimeline(items: SongWithEstimate[], periods: LifePeriod[], query: string, max = 50): SongWithEstimate[] {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const ranges = periods.map((p) => ({
    p,
    text: normalise(`${p.name} ${p.place ?? ''}`),
    from: parsePartialDate(p.start)?.getTime() ?? Infinity,
    to: endOfDay(p.end).getTime(),
  }));
  const scored = items
    .map((item) => {
      const { song } = item;
      const title = normalise(song.title);
      const likely = item.estimate.likely.getTime();
      const inPeriods = ranges
        .filter((r) => (song.hint.kind === 'period' && song.hint.periodId === r.p.id) || (likely >= r.from && likely <= r.to))
        .map((r) => r.text);
      const text = [title, normalise(song.artist), normalise(song.album ?? ''), normalise(genreInfo(songGenre(song))?.label ?? ''), ...inPeriods].join(' ');
      if (!words.every((w) => text.includes(w))) return undefined;
      const score = (title.startsWith(words[0]) ? 0 : title.includes(words[0]) ? 1 : 2);
      return { item, score };
    })
    .filter((r): r is { item: SongWithEstimate; score: number } => !!r);
  scored.sort((a, b) => a.score - b.score || a.item.estimate.likely.getTime() - b.item.estimate.likely.getTime());
  return scored.slice(0, max).map((r) => r.item);
}

/** Life periods whose name or place holds every word of the search. */
export function searchPeriods(periods: LifePeriod[], query: string): LifePeriod[] {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return periods.filter((p) => {
    const text = normalise(`${p.name} ${p.place ?? ''}`);
    return words.every((w) => text.includes(w));
  });
}
