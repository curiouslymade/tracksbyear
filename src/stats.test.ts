import { describe, expect, it } from 'vitest';
import type { SongWithEstimate } from './estimate';
import type { GenreFamily } from './genres';
import { genreBreakdown, highlights, releaseDecades } from './stats';

let nextId = 1;
function item(title: string, artist: string, released: string | undefined, likely: string, genre?: GenreFamily): SongWithEstimate {
  const d = new Date(likely + 'T00:00:00Z');
  return {
    song: { id: nextId++, title, artist, releaseDate: released, genreOverride: genre, hint: { kind: 'onRelease' }, addedAt: '2026-11-24' },
    estimate: { from: d, to: d, likely: d, confidence: 0.5, label: 'Medium', reason: '' },
  } as SongWithEstimate;
}

const items = [
  item('Wonderwall', 'Oasis', '1995-10-02', '1996-01-01', 'indie'),
  item('Live Forever', 'oasis', '1994-08-08', '1995-01-01', 'indie'),
  item('Hey Jude', 'The Beatles', '1968-08-26', '2005-06-01', 'pop'),
  item('Born Slippy', 'Underworld', '1996-06-24', '2001-06-01', 'electronic'),
  item('Mystery', 'Someone', undefined, '2001-03-01'),
];

describe('genreBreakdown', () => {
  it('counts songs per genre, largest first, with "Not known" last', () => {
    const s = genreBreakdown(items);
    expect(s.map((x) => [x.id, x.count])).toEqual([['indie', 2], ['electronic', 1], ['pop', 1], ['unknown', 1]]);
    expect(s.reduce((n, x) => n + x.share, 0)).toBeCloseTo(1);
  });
  it('folds the smallest genres into "Other"', () => {
    const s = genreBreakdown(items, 3);
    expect(s.map((x) => [x.id, x.count])).toEqual([['indie', 2], ['other', 2], ['unknown', 1]]);
  });
});

describe('releaseDecades', () => {
  it('counts releases per decade in date order', () => {
    expect(releaseDecades(items)).toEqual([{ label: '1960s', count: 1 }, { label: '1990s', count: 3 }]);
  });
});

describe('highlights', () => {
  it('finds the oldest song, the longest wait and the top artist', () => {
    const h = highlights(items);
    expect(h.songs).toBe(5);
    expect(h.artists).toBe(4);
    expect(h.oldest?.item.song.title).toBe('Hey Jude');
    expect(h.newest?.item.song.title).toBe('Born Slippy');
    expect(h.longestWait?.detail).toBe('37 years after release');
    expect(h.topArtist).toEqual({ name: 'Oasis', count: 2 });
    expect(h.busiestYear).toEqual({ year: 2001, count: 2 });
    expect(h.heardNewShare).toBeCloseTo(0.5);
  });
  it('handles an empty list', () => {
    const h = highlights([]);
    expect(h.songs).toBe(0);
    expect(h.oldest).toBeUndefined();
    expect(h.medianWait).toBeUndefined();
  });
});
