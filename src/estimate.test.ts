import { describe, expect, it } from 'vitest';
import { buildTimeline, CONFIDENCE, estimateHearing, NO_PERIOD_KEY, periodKey } from './estimate';
import { formatRange, parsePartialDate } from './dates';
import type { Hint, LifePeriod, Song } from './types';

const TODAY = new Date(Date.UTC(2026, 10, 23));

const periods: LifePeriod[] = [
  { id: 1, name: 'School', start: '1995-09-01', end: '2002-07-31' },
  { id: 2, name: 'University', place: 'Leeds', start: '2002-09-01', end: '2005-06-30' },
  { id: 3, name: 'London', start: '2005-07-01', end: '2012-12-31' },
];

function song(releaseDate: string | undefined, hint: Hint = { kind: 'onRelease' }, title = 'Song'): Song {
  return { title, artist: 'Artist', releaseDate, hint, addedAt: '2026-11-23' };
}

const year = (d: Date) => d.getUTCFullYear();

describe('parsePartialDate', () => {
  it('reads year, month and full dates', () => {
    expect(parsePartialDate('1997')?.toISOString()).toBe('1997-01-01T00:00:00.000Z');
    expect(parsePartialDate('1997-05')?.toISOString()).toBe('1997-05-01T00:00:00.000Z');
    expect(parsePartialDate('1997-05-12')?.toISOString()).toBe('1997-05-12T00:00:00.000Z');
  });
  it('rejects bad input', () => {
    expect(parsePartialDate('')).toBeUndefined();
    expect(parsePartialDate('May 1997')).toBeUndefined();
    expect(parsePartialDate(undefined)).toBeUndefined();
  });
});

describe('formatRange', () => {
  it('shows a whole year as the year', () => {
    expect(formatRange(new Date(Date.UTC(1997, 0, 1)), new Date(Date.UTC(1997, 11, 31)))).toBe('1997');
  });
  it('shows short ranges in months and long ranges in years', () => {
    expect(formatRange(new Date(Date.UTC(1997, 4, 1)), new Date(Date.UTC(1998, 2, 1)))).toBe('May 1997 to Mar 1998');
    expect(formatRange(new Date(Date.UTC(1997, 0, 1)), new Date(Date.UTC(2003, 0, 1)))).toBe('1997 to 2003');
  });
});

describe('estimateHearing', () => {
  it('"when it came out" gives a one-year window from release', () => {
    const e = estimateHearing(song('2003-03'), periods, TODAY);
    expect(e.from.toISOString().slice(0, 10)).toBe('2003-03-01');
    expect(e.to.toISOString().slice(0, 10)).toBe('2004-03-01');
    expect(e.label).toBe('High');
  });

  it('"when it came out" also works for a song older than all life periods', () => {
    const e = estimateHearing(song('1970'), periods, TODAY);
    expect(year(e.likely)).toBe(1970);
    expect(e.conflict).toBeUndefined();
    expect(e.confidence).toBe(CONFIDENCE.onRelease);
  });

  it('a chosen period limits the window to the period, but not before release', () => {
    const e = estimateHearing(song('2004-01-15', { kind: 'period', periodId: 2 }), periods, TODAY);
    expect(e.from.toISOString().slice(0, 10)).toBe('2004-01-15');
    expect(e.to.toISOString().slice(0, 10)).toBe('2005-06-30');
    expect(e.confidence).toBe(CONFIDENCE.period);
  });

  it('a chosen period that ended before release is a conflict', () => {
    const e = estimateHearing(song('2010', { kind: 'period', periodId: 1 }), periods, TODAY);
    expect(e.conflict).toMatch(/after "School" ended/);
    expect(year(e.likely)).toBe(2010);
  });

  it('a known year gives a high-confidence one-year window', () => {
    const e = estimateHearing(song('1980', { kind: 'year', year: 2008 }), periods, TODAY);
    expect(year(e.from)).toBe(2008);
    expect(year(e.to)).toBe(2008);
    expect(e.label).toBe('High');
  });

  it('a year before release is a conflict', () => {
    const e = estimateHearing(song('2010', { kind: 'year', year: 2008 }), periods, TODAY);
    expect(e.conflict).toBeDefined();
  });

  it('never estimates a date in the future', () => {
    const e = estimateHearing(song('2026-10-01'), periods, TODAY);
    expect(e.to.getTime()).toBeLessThanOrEqual(TODAY.getTime());
    expect(e.likely.getTime()).toBeLessThanOrEqual(TODAY.getTime());
  });

  it('falls back to the release date when a hint points to a deleted period', () => {
    const e = estimateHearing(song('1997', { kind: 'period', periodId: 99 }), periods, TODAY);
    expect(e.confidence).toBe(CONFIDENCE.nearRelease);
  });

  it('with no release date yet, has the lowest confidence', () => {
    const e = estimateHearing(song(undefined), periods, TODAY);
    expect(e.confidence).toBe(CONFIDENCE.nothingKnown);
  });
});

describe('buildTimeline', () => {
  it('puts songs in groups by period, in order of likely date, with a group for the rest', () => {
    const songs = [
      song('2004', { kind: 'onRelease' }, 'Uni late'),
      song('1996', { kind: 'onRelease' }, 'School'),
      song('2002-10', { kind: 'onRelease' }, 'Uni early'),
      song('2020', { kind: 'onRelease' }, 'Recent'),
      song('1980', { kind: 'period', periodId: 3 }, 'Old in London'),
    ];
    const groups = buildTimeline(songs, periods, TODAY);
    expect(groups.map((g) => g.key)).toEqual([periodKey(1), periodKey(2), periodKey(3), NO_PERIOD_KEY]);
    const titles = (k: string) => groups.find((g) => g.key === k)!.items.map((i) => i.song.title);
    expect(titles(periodKey(1))).toEqual(['School']);
    expect(titles(periodKey(2))).toEqual(['Uni early', 'Uni late']);
    expect(titles(periodKey(3))).toEqual(['Old in London']);
    expect(titles(NO_PERIOD_KEY)).toEqual(['Recent']);
  });

  it('sorts periods by start date, whatever order they were added in', () => {
    const groups = buildTimeline([], [periods[2], periods[0], periods[1]], TODAY);
    expect(groups.map((g) => g.period?.name)).toEqual(['School', 'University', 'London', undefined]);
  });
});
