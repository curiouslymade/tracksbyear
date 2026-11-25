import {
  addMonths,
  endOfDay,
  endOfYear,
  maxDate,
  midpoint,
  minDate,
  parsePartialDate,
  startOfYear,
} from './dates';
import type { ConfidenceLabel, HearingEstimate, LifePeriod, Song } from './types';

/** Confidence for each kind of evidence, from 0 to 1. */
export const CONFIDENCE = {
  year: 0.9,
  period: 0.8,
  onRelease: 0.75,
  nearRelease: 0.45,
  conflict: 0.25,
  nothingKnown: 0.1,
} as const;

/** Most people hear a new song within this many months of its release. */
const NEW_SONG_WINDOW_MONTHS = 12;
/** When the answer cannot be used, the guess covers this many months after release. */
const NO_HINT_WINDOW_MONTHS = 24;

function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.4) return 'Medium';
  return 'Low';
}

function make(
  from: Date,
  to: Date,
  confidence: number,
  reason: string,
  today: Date,
  conflict?: string,
): HearingEstimate {
  // Nobody can have heard a song in the future.
  const cappedTo = to > today ? today : to;
  const cappedFrom = from > cappedTo ? cappedTo : from;
  return {
    from: cappedFrom,
    to: cappedTo,
    likely: midpoint(cappedFrom, cappedTo),
    confidence,
    label: confidenceLabel(confidence),
    reason,
    conflict,
  };
}

/** The earliest start date of all life periods, if there are any. */
function earliestLifeStart(periods: LifePeriod[]): Date | undefined {
  return minDate(...periods.map((p) => parsePartialDate(p.start)));
}

/**
 * Estimates when the user first heard a song. The release date is the hard
 * lower limit. The user's hint sets the window. Life periods narrow it.
 */
export function estimateHearing(song: Song, periods: LifePeriod[], today: Date): HearingEstimate {
  const release = parsePartialDate(song.releaseDate);
  const lifeStart = earliestLifeStart(periods);
  const hint = song.hint;

  switch (hint.kind) {
    case 'year': {
      if (hint.year === undefined) break;
      const from = startOfYear(hint.year);
      const to = endOfYear(hint.year);
      if (release && release > to) {
        return make(
          release,
          release,
          CONFIDENCE.conflict,
          `You chose ${hint.year}`,
          today,
          `The song came out after ${hint.year}. Check the year or the release date.`,
        );
      }
      return make(maxDate(from, release)!, to, CONFIDENCE.year, `You chose ${hint.year}`, today);
    }

    case 'period': {
      const period = periods.find((p) => p.id === hint.periodId);
      if (!period) break;
      const pStart = parsePartialDate(period.start)!;
      const pEnd = endOfDay(period.end);
      if (release && release > pEnd) {
        return make(
          release,
          release,
          CONFIDENCE.conflict,
          `You chose "${period.name}"`,
          today,
          `The song came out after "${period.name}" ended. Check the period or the release date.`,
        );
      }
      return make(maxDate(pStart, release)!, pEnd, CONFIDENCE.period, `You chose "${period.name}"`, today);
    }

    case 'onRelease': {
      if (!release) break;
      return make(release, addMonths(release, NEW_SONG_WINDOW_MONTHS), CONFIDENCE.onRelease, 'Heard when it was new', today);
    }
  }

  // The answer cannot be used, for example "When it came out" before the release
  // date is known, or a year or period that is missing. Guess from what is known.
  if (release) {
    return make(
      release,
      addMonths(release, NO_HINT_WINDOW_MONTHS),
      CONFIDENCE.nearRelease,
      'Guess: soon after release',
      today,
    );
  }
  return make(lifeStart ?? today, today, CONFIDENCE.nothingKnown, 'No release date or hint', today);
}

export interface SongWithEstimate {
  song: Song;
  estimate: HearingEstimate;
}

export interface TimelineGroup {
  /** `period-<id>` or `none`. */
  key: string;
  period?: LifePeriod;
  items: SongWithEstimate[];
}

export const NO_PERIOD_KEY = 'none';

export function periodKey(id: number | undefined): string {
  return id === undefined ? NO_PERIOD_KEY : `period-${id}`;
}

/** Life periods in date order. */
export function sortPeriods(periods: LifePeriod[]): LifePeriod[] {
  return [...periods].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

/** The life period a song belongs to: the one the user chose, else the one that holds its likely date. */
function periodFor(item: SongWithEstimate, sorted: LifePeriod[]): LifePeriod | undefined {
  const { hint } = item.song;
  if (hint.kind === 'period') {
    const chosen = sorted.find((p) => p.id === hint.periodId);
    if (chosen) return chosen;
  }
  const t = item.estimate.likely;
  // If periods overlap, the one that started last is the most specific.
  return [...sorted]
    .reverse()
    .find((p) => parsePartialDate(p.start)! <= t && t <= endOfDay(p.end));
}

/** Puts songs in groups by life period, each group in order of likely date. */
export function buildTimeline(songs: Song[], periods: LifePeriod[], today: Date): TimelineGroup[] {
  const sorted = sortPeriods(periods);
  const groups = new Map<string, TimelineGroup>();
  for (const p of sorted) groups.set(periodKey(p.id), { key: periodKey(p.id), period: p, items: [] });
  const none: TimelineGroup = { key: NO_PERIOD_KEY, items: [] };

  for (const song of songs) {
    const item = { song, estimate: estimateHearing(song, sorted, today) };
    const period = periodFor(item, sorted);
    (period ? groups.get(periodKey(period.id))! : none).items.push(item);
  }

  const all = [...groups.values(), none];
  for (const g of all) {
    g.items.sort(
      (a, b) =>
        a.estimate.likely.getTime() - b.estimate.likely.getTime() ||
        a.song.artist.localeCompare(b.song.artist) ||
        a.song.title.localeCompare(b.song.title),
    );
  }
  return all;
}
