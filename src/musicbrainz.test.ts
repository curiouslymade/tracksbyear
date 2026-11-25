import { describe, expect, it } from 'vitest';
import { cleanTitle, earliest, groupSongResults, isMatch } from './musicbrainz';

describe('cleanTitle', () => {
  it('removes remaster and version suffixes that Spotify adds', () => {
    expect(cleanTitle('Bohemian Rhapsody - Remastered 2011')).toBe('Bohemian Rhapsody');
    expect(cleanTitle('Wonderwall - Remastered')).toBe('Wonderwall');
    expect(cleanTitle('Heroes - 2017 Remaster')).toBe('Heroes');
    expect(cleanTitle('Song 2 (2012 Remaster)')).toBe('Song 2');
    expect(cleanTitle('Common People - Radio Edit')).toBe('Common People');
  });
  it('keeps ordinary titles', () => {
    expect(cleanTitle('Don’t Look Back in Anger')).toBe('Don’t Look Back in Anger');
    expect(cleanTitle('Love Will Tear Us Apart')).toBe('Love Will Tear Us Apart');
    expect(cleanTitle('(What’s the Story) Morning Glory?')).toBe('(What’s the Story) Morning Glory?');
  });
});

describe('earliest', () => {
  it('returns the earliest date and ignores empty values', () => {
    expect(earliest(['2011-09-05', '1975-10-31', undefined, ''])).toBe('1975-10-31');
    expect(earliest([undefined])).toBeUndefined();
  });
  it('prefers a full date in the same year to a year alone', () => {
    expect(earliest(['1996-01-01', '1995', '1995-10-30', '1995-10-02'])).toBe('1995-10-02');
    expect(earliest(['1995', '1996-01-01'])).toBe('1995');
  });
});

describe('isMatch', () => {
  const rec = (title: string, ...artists: string[]) => ({
    id: 'x',
    title,
    'artist-credit': artists.map((name) => ({ name })),
  });
  it('agrees on title and artist, ignoring case and punctuation', () => {
    expect(isMatch(rec('Don’t Look Back in Anger', 'Oasis'), "Don't Look Back In Anger", 'Oasis')).toBe(true);
    expect(isMatch(rec('Mr. Brightside', 'The Killers'), 'Mr Brightside', 'Killers')).toBe(true);
  });
  it('accepts any one of several Spotify artists', () => {
    expect(isMatch(rec('Under Pressure', 'Queen', 'David Bowie'), 'Under Pressure', 'Queen, David Bowie')).toBe(true);
  });
  it('rejects covers and other songs', () => {
    expect(isMatch(rec('Wonderwall', 'Ryan Adams'), 'Wonderwall', 'Oasis')).toBe(false);
    expect(isMatch(rec('Wonderwall (live)', 'Oasis'), 'Wonderwall', 'Oasis')).toBe(false);
  });
});

describe('groupSongResults', () => {
  const r = (title: string, artist: string, date?: string, release?: string) => ({
    id: title + artist + date,
    title,
    'first-release-date': date,
    'artist-credit': [{ name: artist }],
    releases: release ? [{ title: release, status: 'Official', date }] : undefined,
  });
  it('joins recordings of the same song and keeps the earliest date', () => {
    const rows = groupSongResults([
      r('Wonderwall', 'Oasis', '2014-05-16', 'Definitely Maybe (Remastered)'),
      r('Wonderwall', 'Ryan Adams', '2004-11-02', 'Love Is Hell'),
      r('Wonderwall (Remastered)', 'Oasis', '1995-10-02', "(What's the Story) Morning Glory?"),
    ]);
    expect(rows).toEqual([
      { title: 'Wonderwall', artist: 'Oasis', release: "(What's the Story) Morning Glory?", firstReleaseDate: '1995-10-02' },
      { title: 'Wonderwall', artist: 'Ryan Adams', release: 'Love Is Hell', firstReleaseDate: '2004-11-02' },
    ]);
  });
  it('ignores the dates of bootlegs and promos', () => {
    const rows = groupSongResults([
      { id: '1', title: 'Common People', 'first-release-date': '1994', 'artist-credit': [{ name: 'Pulp' }], releases: [
        { title: 'Get Frisky', status: 'Bootleg', date: '1994' },
        { title: 'Common People', status: 'Official', date: '1995-05-22' },
      ] },
    ]);
    expect(rows[0]).toEqual({ title: 'Common People', artist: 'Pulp', release: 'Common People', firstReleaseDate: '1995-05-22' });
  });
});
