import { describe, expect, it } from 'vitest';
import type { TimelineGroup } from './estimate';
import { csvCell, filePlaylists, toCsv, toText } from './exportFile';

const d = new Date(Date.UTC(1996, 0, 1));
const est = { from: d, to: d, likely: d, confidence: 0.8, label: 'High', reason: '' } as const;
const song = (id: number, title: string, artist: string, extra = {}) =>
  ({ song: { id, title, artist, hint: { kind: 'onRelease' }, addedAt: '2026-11-24', ...extra }, estimate: est }) as unknown as TimelineGroup['items'][number];

const groups: TimelineGroup[] = [
  { key: 'period-1', period: { id: 1, name: 'School', start: '1993', end: '2000' }, items: [song(1, 'Wonderwall', 'Oasis', { releaseDate: '1995-10-02', spotifyUri: 'spotify:track:abc123' })] },
  { key: 'none', items: [song(2, 'Crazy in Love', 'Beyoncé, Jay-Z')] },
];

describe('csvCell', () => {
  it('quotes commas and quotes, and stops spreadsheet formulas', () => {
    expect(csvCell('Oasis')).toBe('Oasis');
    expect(csvCell('Beyoncé, Jay-Z')).toBe('"Beyoncé, Jay-Z"');
    expect(csvCell('Say "Hi"')).toBe('"Say ""Hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});

describe('filePlaylists', () => {
  it('makes one playlist for each life period, or one for the whole timeline', () => {
    expect(filePlaylists(groups, 'perPeriod', true).map((p) => p.name)).toEqual(['Tracks by(ear): School', 'Tracks by(ear): Other']);
    expect(filePlaylists(groups, 'perPeriod', false).map((p) => p.name)).toEqual(['Tracks by(ear): School']);
    expect(filePlaylists(groups, 'whole', true)[0].items).toHaveLength(2);
  });
});

describe('toCsv and toText', () => {
  it('writes a header, UK dates and Spotify links', () => {
    const csv = toCsv(filePlaylists(groups, 'perPeriod', true));
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Playlist,Position,Title,Artist,Album,Release date,First heard,Spotify');
    expect(lines[1]).toBe('Tracks by(ear): School,1,Wonderwall,Oasis,,02/10/1995,Jan 1996,https://open.spotify.com/track/abc123');
    expect(lines[2]).toContain('"Beyoncé, Jay-Z"');
    expect(lines[2]).toContain('https://open.spotify.com/search/Crazy%20in%20Love%20Beyonc%C3%A9%2C%20Jay-Z');
  });
  it('writes "Artist - Title" lines under each playlist name', () => {
    expect(toText(filePlaylists(groups, 'perPeriod', true))).toBe(
      'Tracks by(ear): School\nOasis - Wonderwall\n\nTracks by(ear): Other\nBeyoncé, Jay-Z - Crazy in Love\n',
    );
  });
});
