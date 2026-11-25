import { describe, expect, it } from 'vitest';
import { MOMENTS, type Moment } from './moments';
import { makeScale, momentWidth, placeMoments } from './road';
import { parsePartialDate } from './dates';

const today = new Date(Date.UTC(2026, 10, 24));
// An empty road from 1993 to today: no songs, one life period.
const scale = makeScale([], [{ name: 'School', start: '1994-09-01', end: '1999-07-31' }], today);

describe('MOMENTS', () => {
  it('has valid dates in date order', () => {
    const times = MOMENTS.map((m) => parsePartialDate(m.date)!.getTime());
    expect(times.every((t) => Number.isFinite(t))).toBe(true);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('placeMoments', () => {
  it('keeps only the moments inside the year range', () => {
    const placed = placeMoments(MOMENTS, scale);
    const years = placed.map((p) => Number(p.moment.date.slice(0, 4)));
    expect(Math.min(...years)).toBeGreaterThanOrEqual(scale.startYear);
    expect(Math.max(...years)).toBeLessThan(scale.endYear);
    expect(placed.some((p) => p.moment.label === 'Kurt Cobain dies')).toBe(true);
    expect(placed.some((p) => p.moment.label === 'Moon landing')).toBe(false);
  });
  it('puts close moments in different lanes so labels do not overlap', () => {
    const close: Moment[] = [
      { date: '1997-05-01', label: 'Blair elected', kind: 'news' },
      { date: '1997-08-31', label: 'Diana dies', kind: 'news' },
      { date: '1999-06-01', label: 'Napster', kind: 'music' },
    ];
    const placed = placeMoments(close, scale);
    expect(placed.map((p) => p.lane)).toEqual([0, 1, 0]);
    expect(placed[0].x + momentWidth(close[0])).toBeGreaterThan(placed[1].x);
  });
  it('leaves out moments that do not fit in the rows', () => {
    const close: Moment[] = [
      { date: '1997-05-01', label: 'Blair elected', kind: 'news' },
      { date: '1997-06-01', label: 'Diana dies', kind: 'news' },
      { date: '1997-07-01', label: 'Napster', kind: 'music' },
    ];
    expect(placeMoments(close, scale, 2).map((p) => p.moment.label)).toEqual(['Blair elected', 'Diana dies']);
  });
});
