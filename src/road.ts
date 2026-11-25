/**
 * Layout of the road timeline: where each song, life period and genre era
 * sits along the x axis. Pure functions, so the layout is testable.
 */
import { endOfDay, parsePartialDate } from './dates';
import type { SongWithEstimate } from './estimate';
import { familyFromGenres, genreInfo, NO_GENRE_ACCENT, NO_GENRE_BACKDROP, type GenreFamily } from './genres';
import type { Moment } from './moments';
import type { LifePeriod, Song } from './types';

/** The width of one year at the normal zoom. */
export const PX_PER_YEAR = 240;
/** The zoom steps, as the width of one year in pixels. The cards keep their size at every step. */
export const ZOOM_LEVELS = [60, 120, 240, 480] as const;
export const DEFAULT_ZOOM = ZOOM_LEVELS.indexOf(PX_PER_YEAR);

/** The lowest zoom step that still changes the timeline: below it, the timeline already fits the screen. */
export function lowestZoom(fitPxPerYear: number): number {
  let lowest = 0;
  ZOOM_LEVELS.forEach((px, i) => {
    if (px <= fitPxPerYear) lowest = i;
  });
  return lowest;
}
/** At most this many rows of moment labels. A moment that does not fit is left out. */
const MAX_MOMENT_LANES = 3;
export const EDGE_PAD = 120;
export const CARD_WIDTH = 188;
const CARD_GAP = 16;
/** Genre weight of a song falls to half at about this many years from its likely date. */
const GENRE_SPREAD_YEARS = 1.2;
/** A year needs at least this much genre weight to take a colour. */
const MIN_GENRE_WEIGHT = 0.2;

export function songGenre(song: Song): GenreFamily | undefined {
  return song.genreOverride ?? familyFromGenres(song.genres);
}

/** A date as a fractional year, for example 1 July 2004 is about 2004.5. */
export function fractionalYear(d: Date): number {
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - start) / (end - start);
}


export interface Scale {
  startYear: number;
  endYear: number;
  width: number;
  /** The width of one year in pixels. */
  pxPerYear: number;
  /** The width of one year that makes the timeline exactly fill the screen. */
  fitPxPerYear: number;
  /** The x position of today. The road and the life periods stop here. */
  todayX: number;
  x: (d: Date) => number;
  yearAt: (x: number) => number;
}

/** The year range covers all songs and life periods, with one empty year on each side, and always runs to the current year. */
/**
 * The x axis of the timeline. `minWidth` is the width of the screen: the timeline
 * never gets narrower than it, so zooming out stops when the whole timeline fits.
 */
export function makeScale(items: SongWithEstimate[], periods: LifePeriod[], today: Date, zoomPxPerYear = PX_PER_YEAR, minWidth = 0): Scale {
  const years: number[] = [];
  for (const i of items) years.push(fractionalYear(i.estimate.likely));
  for (const p of periods) {
    const s = parsePartialDate(p.start);
    if (s) years.push(fractionalYear(s), fractionalYear(endOfDay(p.end)));
  }
  const thisYear = today.getUTCFullYear();
  let startYear = years.length ? Math.floor(Math.min(...years)) - 1 : thisYear - 5;
  // The timeline always runs to the end of the current year.
  let endYear = Math.max(years.length ? Math.ceil(Math.max(...years)) + 1 : 0, thisYear + 1);
  // At least 6 years, so a short timeline still looks like a road.
  if (endYear - startYear < 6) {
    const extra = 6 - (endYear - startYear);
    startYear -= Math.floor(extra / 2);
    endYear += Math.ceil(extra / 2);
  }
  const yearsToToday = fractionalYear(today) - startYear;
  const fitPxPerYear = minWidth > 0 && yearsToToday > 0 ? (minWidth - EDGE_PAD * 2) / yearsToToday : 0;
  const pxPerYear = Math.max(zoomPxPerYear, fitPxPerYear);
  // The timeline stops a little after today: nobody heard a song in the future.
  const todayX = EDGE_PAD + yearsToToday * pxPerYear;
  const width = Math.min((endYear - startYear) * pxPerYear + EDGE_PAD * 2, Math.ceil(todayX + EDGE_PAD));
  return {
    startYear,
    endYear,
    width,
    pxPerYear,
    fitPxPerYear,
    todayX,
    x: (d) => EDGE_PAD + (fractionalYear(d) - startYear) * pxPerYear,
    yearAt: (x) => startYear + (x - EDGE_PAD) / pxPerYear,
  };
}

export interface GenreSegment {
  genre?: GenreFamily;
  startX: number;
  endX: number;
}

/**
 * The main genre of each year, from the songs near that year, merged into
 * segments. A song counts most in its likely year and less in the years near it.
 */
export function genreSegments(items: SongWithEstimate[], scale: Scale): GenreSegment[] {
  const placed = items
    .map((i) => ({ year: fractionalYear(i.estimate.likely), genre: songGenre(i.song) }))
    .filter((p): p is { year: number; genre: GenreFamily } => !!p.genre);

  const perYear: (GenreFamily | undefined)[] = [];
  for (let y = scale.startYear; y < scale.endYear; y++) {
    const scores = new Map<GenreFamily, number>();
    for (const p of placed) {
      const d = (p.year - (y + 0.5)) / GENRE_SPREAD_YEARS;
      const w = Math.exp(-d * d);
      scores.set(p.genre, (scores.get(p.genre) ?? 0) + w);
    }
    let best: GenreFamily | undefined;
    let bestScore = MIN_GENRE_WEIGHT;
    for (const [g, s] of scores) {
      if (s > bestScore) {
        best = g;
        bestScore = s;
      }
    }
    perYear.push(best);
  }

  const segments: GenreSegment[] = [];
  perYear.forEach((genre, i) => {
    const startX = EDGE_PAD + i * scale.pxPerYear;
    if (startX >= scale.width) return;
    const last = segments.at(-1);
    if (last && last.genre === genre) last.endX = startX + scale.pxPerYear;
    else segments.push({ genre, startX, endX: startX + scale.pxPerYear });
  });
  // The edge padding takes the colour of the nearest segment.
  if (segments.length) {
    segments[0].startX = 0;
    segments.at(-1)!.endX = scale.width;
  } else {
    segments.push({ startX: 0, endX: scale.width });
  }
  return segments;
}

/** A CSS gradient that blends each genre segment into the next. */
export function backdropGradient(
  segments: GenreSegment[],
  width: number,
  blendPx = 140,
  palette: 'backdrop' | 'accent' = 'backdrop',
): string {
  const pct = (x: number) => `${((Math.max(0, Math.min(width, x)) / width) * 100).toFixed(2)}%`;
  const colour = (g?: GenreFamily) =>
    palette === 'accent' ? (genreInfo(g)?.accent ?? NO_GENRE_ACCENT) : (genreInfo(g)?.backdrop ?? NO_GENRE_BACKDROP);
  const stops: string[] = [];
  segments.forEach((s, i) => {
    const c = colour(s.genre);
    const half = blendPx / 2;
    const from = i === 0 ? s.startX : s.startX + half;
    const to = i === segments.length - 1 ? s.endX : s.endX - half;
    stops.push(`${c} ${pct(from)}`, `${c} ${pct(Math.max(from, to))}`);
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export interface PlacedSong {
  item: SongWithEstimate;
  x: number;
  side: 'above' | 'below';
  lane: number;
}

/** The most card rows on each side of the road (10 cards at one place). More songs there go into a bundle. */
export const MAX_LANES = 5;

/** Songs that did not fit in the card rows, shown as one "+N more" card in the row above the others. */
export interface SongBundle {
  items: SongWithEstimate[];
  x: number;
  side: 'above';
  lane: number;
}

/**
 * Puts each song card in a lane above or below the road, so cards do not
 * overlap. Fills the lanes nearest the road first, and alternates sides.
 * Uses at most `maxLanes` lanes on each side. A song that does not fit joins a
 * bundle in the lane above them. Bundles never overlap: a song that is close to
 * the last bundle joins it.
 */
export function placeSongs(
  items: SongWithEstimate[],
  scale: Scale,
  maxLanes = MAX_LANES,
): { placed: PlacedSong[]; bundles: SongBundle[] } {
  const sorted = [...items].sort((a, b) => a.estimate.likely.getTime() - b.estimate.likely.getTime());
  const laneEnds: Record<'above' | 'below', number[]> = { above: [], below: [] };
  const placed: PlacedSong[] = [];
  const bundles: SongBundle[] = [];
  for (const item of sorted) {
    const x = scale.x(item.estimate.likely);
    const left = x - CARD_WIDTH / 2;
    let done = false;
    for (let lane = 0; lane < maxLanes && !done; lane++) {
      for (const side of ['above', 'below'] as const) {
        const end = laneEnds[side][lane] ?? -Infinity;
        if (end + CARD_GAP <= left) {
          laneEnds[side][lane] = left + CARD_WIDTH;
          placed.push({ item, x, side, lane });
          done = true;
          break;
        }
      }
    }
    if (done) continue;
    const last = bundles.at(-1);
    if (last && left < last.x + CARD_WIDTH / 2 + CARD_GAP) last.items.push(item);
    else bundles.push({ items: [item], x, side: 'above', lane: maxLanes });
  }
  return { placed, bundles };
}

interface PlacedPeriod {
  period: LifePeriod;
  startX: number;
  endX: number;
  lane: number;
}

/** Puts life periods in lanes below the road, so overlapping periods do not cover each other. */
export function placePeriods(periods: LifePeriod[], scale: Scale): PlacedPeriod[] {
  const laneEnds: number[] = [];
  return [...periods]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((period) => {
      // A period stops at today, also when it ends (or starts) in the future.
      const startX = Math.min(scale.x(parsePartialDate(period.start)!), scale.todayX);
      const endX = Math.min(scale.x(endOfDay(period.end)), scale.todayX);
      let lane = laneEnds.findIndex((end) => end + 8 <= startX);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = endX;
      return { period, startX, endX, lane };
    });
}

interface PlacedMoment {
  moment: Moment;
  x: number;
  lane: number;
}

/** Approximate width of a moment label: the marker, then the text. */
export function momentWidth(m: Moment): number {
  return 22 + m.label.length * 7;
}

/**
 * Puts the moments inside the year range in lanes under the road, so
 * labels do not overlap. Moments outside the range are left out, and so are
 * moments that do not fit in `maxLanes` rows (when the timeline is zoomed out).
 */
export function placeMoments(moments: Moment[], scale: Scale, maxLanes = MAX_MOMENT_LANES): PlacedMoment[] {
  const laneEnds: number[] = [];
  const placed: PlacedMoment[] = [];
  moments
    .map((moment) => ({ moment, date: parsePartialDate(moment.date) }))
    .filter((m): m is { moment: Moment; date: Date } => {
      if (!m.date) return false;
      const y = m.date.getUTCFullYear();
      return y >= scale.startYear && y < scale.endYear;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach(({ moment, date }) => {
      const x = scale.x(date);
      let lane = laneEnds.findIndex((end) => end + 12 <= x);
      if (lane === -1) lane = laneEnds.length;
      if (lane >= maxLanes) return;
      laneEnds[lane] = x + momentWidth(moment);
      placed.push({ moment, x, lane });
    });
  return placed;
}

export function laneCount(placed: PlacedSong[], side: 'above' | 'below'): number {
  return placed.reduce((n, p) => (p.side === side ? Math.max(n, p.lane + 1) : n), 0);
}

/** A guess this wide or wider can be spread. Narrower windows stay where the estimate puts them. */
const SPREAD_MIN_YEARS = 2;
/** Only guesses this weak or weaker are spread. Songs the user placed keep their place. */
const SPREAD_MAX_CONFIDENCE = 0.3;

/**
 * Songs with the same wide, weak guess (for example "Not sure" songs older than
 * the first life period) all get the same middle date. On the timeline they
 * would sit on one spot. This spreads each such group evenly across its window,
 * oldest release first, so the cards sit side by side. Only the place on the
 * timeline changes: the estimate itself stays as it is.
 */
export function spreadGuesses(items: SongWithEstimate[]): SongWithEstimate[] {
  const groups = new Map<string, SongWithEstimate[]>();
  for (const i of items) {
    const { from, to, confidence } = i.estimate;
    const years = (to.getTime() - from.getTime()) / (365.25 * 86_400_000);
    if (confidence > SPREAD_MAX_CONFIDENCE || years < SPREAD_MIN_YEARS) continue;
    const key = `${from.getTime()}|${to.getTime()}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const moved = new Map<SongWithEstimate, Date>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => (a.song.releaseDate ?? '9999').localeCompare(b.song.releaseDate ?? '9999') || a.song.title.localeCompare(b.song.title),
    );
    const { from, to } = sorted[0].estimate;
    const span = to.getTime() - from.getTime();
    sorted.forEach((item, n) => moved.set(item, new Date(from.getTime() + ((n + 0.5) / sorted.length) * span)));
  }
  if (!moved.size) return items;
  return items.map((i) => (moved.has(i) ? { ...i, estimate: { ...i.estimate, likely: moved.get(i)! } } : i));
}
