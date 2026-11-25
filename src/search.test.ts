import { describe, expect, it } from 'vitest';
import type { SongWithEstimate } from './estimate';
import { searchPeriods, searchTimeline } from './search';
import type { LifePeriod } from './types';

const item = (id: number, title: string, artist: string, extra = {}) => {
  const d = new Date(Date.UTC(1995 + id, 0, 1));
  return {
    song: { id, title, artist, hint: { kind: 'onRelease' }, addedAt: '', ...extra },
    estimate: { from: d, to: d, likely: d, confidence: 0.8, label: 'High', reason: '' },
  } as SongWithEstimate;
};
const periods: LifePeriod[] = [
  { id: 1, name: 'University', place: 'Leeds', start: '2000', end: '2003' },
  { id: 2, name: 'School', place: 'Bristol', start: '1995', end: '1998' },
];
const items = [
  item(1, 'Wonderwall', 'Oasis', { genreOverride: 'indie' }),
  item(2, 'Beyoncé Medley', 'Someone'),
  item(3, 'Crazy in Love', 'Beyoncé', { hint: { kind: 'period', periodId: 1 } }),
  item(4, 'Song 2', 'Blur', { album: 'Blur' }),
];

describe('searchTimeline', () => {
  it('finds songs by title, artist, album, genre or life period, ignoring accents', () => {
    expect(searchTimeline(items, periods, 'wonder').map((i) => i.song.id)).toEqual([1]);
    expect(searchTimeline(items, periods, 'beyonce').map((i) => i.song.id)).toEqual([2, 3]);
    expect(searchTimeline(items, periods, 'indie').map((i) => i.song.id)).toEqual([1]);
    expect(searchTimeline(items, periods, 'university').map((i) => i.song.id)).toEqual([3]);
  });
  it('finds songs that sit inside a life period, by its name or place', () => {
    // Songs 1 to 3 have likely dates in 1996, 1997 and 1998: inside School.
    expect(searchTimeline(items, periods, 'school').map((i) => i.song.id)).toEqual([1, 2, 3]);
    expect(searchTimeline(items, periods, 'bristol').map((i) => i.song.id)).toEqual([1, 2, 3]);
    expect(searchTimeline(items, periods, 'leeds').map((i) => i.song.id)).toEqual([3]);
  });
  it('finds the life periods themselves', () => {
    expect(searchPeriods(periods, 'uni').map((p) => p.name)).toEqual(['University']);
    expect(searchPeriods(periods, 'bristol').map((p) => p.name)).toEqual(['School']);
    expect(searchPeriods(periods, 'oasis')).toEqual([]);
  });
  it('needs every word, and finds nothing for an empty search', () => {
    expect(searchTimeline(items, periods, 'blur song').map((i) => i.song.id)).toEqual([4]);
    expect(searchTimeline(items, periods, 'blur oasis')).toEqual([]);
    expect(searchTimeline(items, periods, '  ')).toEqual([]);
  });
});
