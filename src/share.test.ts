import { describe, expect, it } from 'vitest';
import { buildTimeline } from './estimate';
import { buildShare, decodeShare, encodeShare, fromShare, shareInLocation } from './share';
import type { LifePeriod, Song } from './types';

const today = new Date(Date.UTC(2026, 10, 24));
const periods: LifePeriod[] = [
  { id: 7, name: 'School', place: 'Bristol', start: '1993-09-01', end: '2000-07-31' },
  { id: 9, name: 'University', place: 'Leeds', start: '2000-09-01', end: '2003-06-30' },
];
const songs: Song[] = [
  { id: 1, title: 'Wonderwall', artist: 'Oasis', releaseDate: '1995-10-02', genreOverride: 'indie', hint: { kind: 'onRelease' }, addedAt: '' },
  { id: 2, title: 'Born Slippy', artist: 'Underworld', releaseDate: '1996-06-24', hint: { kind: 'period', periodId: 9 }, addedAt: '' },
  { id: 3, title: 'Hey Jude', artist: 'The Beatles', releaseDate: '1968-08-26', spotifyUri: 'spotify:track:abc', hint: { kind: 'year', year: 2005 }, addedAt: '' },
];
const items = buildTimeline(songs, periods, today).flatMap((g) => g.items);

describe('share links', () => {
  it('round-trips songs, hints, genres and periods', async () => {
    const data = buildShare(items, periods, { periods: true, places: true });
    const back = fromShare(await decodeShare(await encodeShare(data)));
    expect(back.periods.map((p) => [p.name, p.place])).toEqual([['School', 'Bristol'], ['University', 'Leeds']]);
    const slippy = back.songs.find((s) => s.title === 'Born Slippy')!;
    expect(back.periods.find((p) => p.id === slippy.hint.periodId)!.name).toBe('University');
    expect(back.songs.find((s) => s.title === 'Wonderwall')!.genreOverride).toBe('indie');
    expect(back.songs.find((s) => s.title === 'Hey Jude')!.hint).toEqual({ kind: 'year', year: 2005 });
  });
  it('leaves out places, and turns a period hint into a year when periods are left out', async () => {
    const noPlaces = buildShare(items, periods, { periods: true, places: false });
    expect(noPlaces.periods.every((p) => p.pl === undefined)).toBe(true);
    const noPeriods = buildShare(items, periods, { periods: false, places: false });
    expect(noPeriods.periods).toEqual([]);
    expect(noPeriods.songs.find((s) => s.t === 'Born Slippy')!.h[0]).toBe('year');
  });
  it('rejects broken or hostile links', async () => {
    await expect(decodeShare('not*base64')).rejects.toThrow();
    const bad = await encodeShare({ v: 1, periods: [], songs: [{ t: 'x', a: 'y', h: ['period', 3] }] });
    await expect(decodeShare(bad)).rejects.toThrow();
    const badUri = await encodeShare({ v: 1, periods: [], songs: [{ t: 'x', a: 'y', h: ['onRelease'], u: 'javascript:alert(1)' }] });
    await expect(decodeShare(badUri)).rejects.toThrow();
  });
  it('reads the old answers in older links as "When it came out"', async () => {
    const old = await encodeShare({ v: 1, periods: [], songs: [{ t: 'x', a: 'y', h: ['later' as 'onRelease'] }] });
    expect((await decodeShare(old)).songs[0].h).toEqual(['onRelease']);
  });
  it('finds the share data in the address', () => {
    expect(shareInLocation('#share=abc_-1')).toBe('abc_-1');
    expect(shareInLocation('#other')).toBeUndefined();
  });
});
